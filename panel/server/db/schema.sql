-- Nareen Phase 3 — PostgreSQL Persistence Schema
-- Run once: psql -U postgres -d cxr -f schema.sql

CREATE TABLE IF NOT EXISTS rooms (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     TEXT        UNIQUE NOT NULL,
  room_name   TEXT        NOT NULL,
  ip_address  TEXT,
  port        INTEGER,
  max_players INTEGER     DEFAULT 8,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at  TIMESTAMPTZ,
  metadata    JSONB       DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        TEXT        UNIQUE NOT NULL,
  room_id           TEXT        NOT NULL REFERENCES rooms(room_id),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  participant_count INTEGER     DEFAULT 0
);

CREATE TABLE IF NOT EXISTS participants (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id TEXT        NOT NULL,
  session_id     TEXT        NOT NULL REFERENCES sessions(session_id),
  room_id        TEXT        NOT NULL,
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at        TIMESTAMPTZ,
  UNIQUE(participant_id, session_id)
);

CREATE TABLE IF NOT EXISTS runtime_events (
  id             TEXT        PRIMARY KEY,
  event_type     TEXT        NOT NULL,
  session_id     TEXT,
  room_id        TEXT,
  participant_id TEXT,
  payload        JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interaction_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   TEXT        REFERENCES runtime_events(id),
  action     TEXT        NOT NULL,   -- grab | release | transfer
  object_id  TEXT        NOT NULL,
  from_owner TEXT,
  to_owner   TEXT,
  session_id TEXT,
  room_id    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calibration_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   TEXT        REFERENCES runtime_events(id),
  state      TEXT        NOT NULL,   -- started | completed | failed
  marker_id  TEXT,
  session_id TEXT,
  room_id    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes — fast query by room + time
CREATE INDEX IF NOT EXISTS idx_re_room_time    ON runtime_events      (room_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_session      ON runtime_events      (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_type         ON runtime_events      (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ie_session      ON interaction_events  (session_id);
CREATE INDEX IF NOT EXISTS idx_cal_session     ON calibration_events  (session_id);
CREATE INDEX IF NOT EXISTS idx_part_session    ON participants         (session_id);
