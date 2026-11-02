-- What it cost to index with each embedding model, for comparing models.
CREATE TABLE embedding_models (
  model            text PRIMARY KEY,
  dimension        integer NOT NULL,
  indexing_seconds integer,
  weights_bytes    bigint,
  chunks           integer NOT NULL,
  indexed_at       timestamptz NOT NULL DEFAULT now()
);
