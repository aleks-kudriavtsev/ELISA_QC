CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL,
  steps JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS experiment_runs (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES experiment_plans(id),
  run_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_by_user_id TEXT NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  completed_signature JSONB,
  lots JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS step_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES experiment_runs(id),
  step_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'finished', 'failed')),
  timestamp TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  completion_signature JSONB,
  lots JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES experiment_runs(id),
  user_id TEXT NOT NULL,
  user_name TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES experiment_runs(id),
  step_id TEXT,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS instrument_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES experiment_runs(id),
  step_id TEXT,
  instrument_id TEXT NOT NULL,
  instrument_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  data_path TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiment_runs_plan_id ON experiment_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_step_logs_run_id ON step_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_run_id ON audit_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_attachments_run_id ON attachments(run_id);
CREATE INDEX IF NOT EXISTS idx_instrument_records_run_id ON instrument_records(run_id);
