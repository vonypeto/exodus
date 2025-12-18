export const createTables = `
CREATE TABLE IF NOT EXISTS aggregates (
  id BYTEA PRIMARY KEY,
  version INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  final BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS events (
  id BYTEA PRIMARY KEY,
  type INTEGER NOT NULL,
  aggregate_id BYTEA NOT NULL,
  aggregate_version INTEGER NOT NULL,
  body JSONB,
  meta JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  final BOOLEAN DEFAULT FALSE,
  CONSTRAINT fk_aggregate FOREIGN KEY (aggregate_id) REFERENCES aggregates(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_aggregate_id_version ON events (aggregate_id, aggregate_version DESC);
CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events (aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_final ON events (final);
CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events (type, timestamp DESC);

CREATE TABLE IF NOT EXISTS snapshots (
  aggregate_id BYTEA NOT NULL,
  aggregate_version INTEGER NOT NULL,
  state JSONB,
  timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (aggregate_id, aggregate_version)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id_version ON snapshots (aggregate_id, aggregate_version DESC);

CREATE TABLE IF NOT EXISTS projection_checkpoints (
  projection TEXT NOT NULL,
  aggregate_id BYTEA NOT NULL,
  aggregate_version INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (projection, aggregate_id)
);

CREATE INDEX IF NOT EXISTS idx_projection_checkpoints_lookup ON projection_checkpoints (projection, aggregate_id, aggregate_version DESC);
`;
