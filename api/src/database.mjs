import { Client } from '@neondatabase/serverless';
import { ProtocolError } from './protocol.mjs';
const timestampSql=`to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at`;
export async function pullRecords(connectionString,userId,cursor,limit=100) {
  const client=new Client(connectionString);
  await client.connect();
  try {
    const r=await client.query(`SELECT record_type,record_id,version,data,deleted_at,${timestampSql}
       FROM rixu.records WHERE user_id=$1 AND
       ($2::timestamptz IS NULL OR (updated_at,record_type,record_id)>($2::timestamptz,$3::text,$4::text))
       ORDER BY updated_at,record_type,record_id LIMIT $5`,
       [userId,cursor.t,cursor.k,cursor.i,limit]);
    return r.rows;
  } finally {await client.end();}
}
export async function applyMutation(connectionString,userId,mutation) {
  const {mutationId,recordType,recordId,expectedVersion,operation,data}=mutation;
  const client=new Client(connectionString);
  await client.connect();
  try {
    await client.query('BEGIN');
    const receipt=await client.query(`INSERT INTO rixu.sync_receipts(user_id,mutation_id)
       VALUES($1,$2::uuid) ON CONFLICT DO NOTHING RETURNING mutation_id`,[userId,mutationId]);
    if(receipt.rowCount===0) {
      await client.query('COMMIT');
      return {status:'duplicate',mutationId};
    }
    const existing=await client.query(`SELECT version FROM rixu.records
      WHERE user_id=$1 AND record_type=$2 AND record_id=$3 FOR UPDATE`,[userId,recordType,recordId]);
    const old=existing.rows[0];
    if ((old?Number(old.version):0)!==expectedVersion) {
      await client.query('ROLLBACK');
      throw new ProtocolError(409,'VERSION_CONFLICT');
    }
    const next=expectedVersion+1;
    const payload={...data,id:recordId,version:next,updatedAt:new Date().toISOString(),...(operation==='delete'?{deletedAt:new Date().toISOString()}:{})};
    if(old) {
      await client.query(`UPDATE rixu.records SET version=$4, data=$5::jsonb,
        deleted_at=CASE WHEN $6::boolean THEN clock_timestamp() ELSE NULL END,
        updated_at=clock_timestamp() WHERE user_id=$1 AND record_type=$2 AND record_id=$3`,
        [userId,recordType,recordId,next,JSON.stringify(payload),operation==='delete']);
    } else {
      await client.query(`INSERT INTO rixu.records(user_id,record_type,record_id,version,data,deleted_at,updated_at)
        VALUES($1,$2,$3,$4,$5::jsonb,NULL,clock_timestamp())`,[userId,recordType,recordId,next,JSON.stringify(payload)]);
    }
    await client.query('COMMIT');
    return {status:'applied',mutationId,recordType,recordId,version:next};
  } catch(e) {
    try{await client.query('ROLLBACK');}catch{}
    if(e?.code==='23505')throw new ProtocolError(409,'VERSION_CONFLICT');
    throw e;
  } finally {await client.end();}
}
