PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  steps TEXT NOT NULL,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS experiment_runs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  run_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_by_user_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (plan_id) REFERENCES experiment_plans(id),
  FOREIGN KEY (started_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS step_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'finished', 'failed')),
  timestamp TEXT NOT NULL,
  message TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id)
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id)
);

CREATE TABLE IF NOT EXISTS instrument_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT,
  instrument_id TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  data_path TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES experiment_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_plan_id ON experiment_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_step_logs_run_id ON step_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_attachments_run_id ON attachments(run_id);
CREATE INDEX IF NOT EXISTS idx_instrument_records_run_id ON instrument_records(run_id);
