CREATE TABLE applications (
  id uuid PRIMARY KEY,
  company text NOT NULL CHECK (length(trim(company)) BETWEEN 1 AND 120),
  role text NOT NULL CHECK (length(trim(role)) BETWEEN 1 AND 160),
  location text NOT NULL CHECK (length(location) <= 160),
  job_url text NOT NULL CHECK (length(job_url) <= 2000),
  contact text NOT NULL CHECK (length(contact) <= 200),
  salary text NOT NULL CHECK (length(salary) <= 160),
  notes text NOT NULL CHECK (length(notes) <= 4000),
  stage text NOT NULL CHECK (stage IN ('saved','applied','interview','offer','accepted','rejected','withdrawn')),
  applied_on date,
  follow_up_on date,
  archived boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activities (
  id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id),
  kind text NOT NULL CHECK (kind IN ('created','stage','note')),
  body text NOT NULL CHECK (length(body) <= 8000),
  from_stage text CHECK (from_stage IN ('saved','applied','interview','offer','accepted','rejected','withdrawn')),
  to_stage text CHECK (to_stage IN ('saved','applied','interview','offer','accepted','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_application_time ON activities(application_id,created_at DESC);
CREATE INDEX activities_time ON activities(created_at DESC);
CREATE TABLE sessions (token_hash text PRIMARY KEY, expires_at timestamptz NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
