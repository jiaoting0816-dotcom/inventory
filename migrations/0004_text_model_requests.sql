-- Separate from all personal inventory; no existing records are rewritten.
CREATE TABLE IF NOT EXISTS text_model_requests (
  account_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  month TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  charge_nano INTEGER NOT NULL CHECK(charge_nano >= 0),
  status TEXT NOT NULL CHECK(status IN ('pending','complete','uncertain')),
  result TEXT,
  PRIMARY KEY(account_id, request_key)
);
CREATE INDEX IF NOT EXISTS text_model_month ON text_model_requests(month, day);
CREATE INDEX IF NOT EXISTS text_model_account_time ON text_model_requests(account_id, created_at);
