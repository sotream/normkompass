CREATE EXTENSION IF NOT EXISTS vector SCHEMA public;

CREATE TABLE chunks (
  id          text PRIMARY KEY,
  unit_id     text NOT NULL,
  part        integer NOT NULL,
  parts       integer NOT NULL,
  document_id text NOT NULL,
  source      text NOT NULL,
  path        text[] NOT NULL,
  label       text NOT NULL,
  title       text NOT NULL,
  url         text NOT NULL,
  stand       text,
  kind        text NOT NULL,
  text        text NOT NULL,
  content_hash text NOT NULL,
  fts         tsvector GENERATED ALWAYS AS (
                to_tsvector('german', coalesce(title, '') || ' ' || text)
              ) STORED
);

CREATE INDEX chunks_fts_idx ON chunks USING gin (fts);
CREATE INDEX chunks_unit_idx ON chunks (unit_id);
CREATE INDEX chunks_document_idx ON chunks (document_id);
