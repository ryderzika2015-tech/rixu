/** Port to implement with a verified native SQLite driver in phase C, not a browser fallback. */
export interface SQLiteDriver {
 open(database:string):Promise<void>;
 transaction<T>(work:(tx:{query<T>(sql:string,values:unknown[]):Promise<T[]>;run(sql:string,values:unknown[]):Promise<void>})=>Promise<T>):Promise<T>;
 close():Promise<void>;
}
export const LOCAL_SCHEMA_SQL=`
CREATE TABLE IF NOT EXISTS entities (
 store TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL,
 payload TEXT NOT NULL, deleted_at TEXT, PRIMARY KEY (store, id)
);
CREATE TABLE IF NOT EXISTS outbox (
 operation_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL,
 payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'local-only'
);
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
`;
