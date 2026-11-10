import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMutation,encodeCursor,parseCursor,originAllowed,allowedUser,readJsonCapped} from '../src/protocol.mjs';
const uuid='550e8400-e29b-41d4-a716-446655440000';
const base={mutationId:uuid,recordType:'tasks',recordId:'abc-123',expectedVersion:0,operation:'upsert',data:{id:'abc-123',title:'读英语',userId:'someone-else',version:99}};
test('validates and drops client ownership and version',()=>{
 const x=parseMutation(base);assert.equal(x.data.title,'读英语');assert.equal(x.data.userId,undefined);assert.equal(x.data.version,undefined);
});
test('rejects unsafe data and invalid IDs',()=>{
 for(const b of [{...base,recordType:'users'},{...base,recordId:'a/../b'},{...base,expectedVersion:-1},{...base,mutationId:'bad'},{...base,data:{id:'wrong'}}])assert.throws(()=>parseMutation(b));
});
test('delete requires version',()=>assert.throws(()=>parseMutation({...base,operation:'delete'})));
test('cursor is opaque but lossless with microseconds',()=>{
 const v={updated_at:'2026-11-10T01:02:03.123456Z',record_type:'tasks',record_id:'abc-123'};
 assert.deepEqual(parseCursor(encodeCursor(v)),{t:v.updated_at,k:v.record_type,i:v.record_id});
 assert.throws(()=>parseCursor('invalid'));
});
test('origins and user ids fail closed',()=>{
 assert.equal(originAllowed('https://rixu-web.pages.dev',{}),false);
 assert.equal(originAllowed('https://rixu-web.pages.dev',{ALLOWED_ORIGINS:'https://rixu-web.pages.dev'}),true);
 assert.equal(allowedUser('someone',{}),false);
 assert.equal(allowedUser('someone',{ALLOWED_USER_IDS:'another,someone'}),true);
});
test('size capped JSON parsing',async()=>{
 const body=new Request('http://local.test/v1/sync/push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(base)});
 assert.equal((await readJsonCapped(body)).recordId,'abc-123');
 const huge=new Request('http://local.test/v1/sync/push',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(70000)});
 await assert.rejects(readJsonCapped(huge),e=>e.status===413);
});
