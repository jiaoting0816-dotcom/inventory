CREATE TABLE IF NOT EXISTS private_pools (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id),
 payload TEXT NOT NULL, published_payload TEXT, revision INTEGER NOT NULL DEFAULT 1,
 request_key TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS private_pools_owner ON private_pools(owner_id);
CREATE TABLE IF NOT EXISTS private_media (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id), pool_id TEXT NOT NULL,
 media_key TEXT NOT NULL, request_key TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(owner_id,request_key)
);
CREATE INDEX IF NOT EXISTS private_media_owner ON private_media(owner_id,pool_id);
CREATE UNIQUE INDEX IF NOT EXISTS private_pool_series ON private_pools(owner_id,json_extract(published_payload,'$.category'),json_extract(published_payload,'$.name')) WHERE published_payload IS NOT NULL;
