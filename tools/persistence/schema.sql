-- CXR Multiplayer append-first persistence schema.
-- Realtime gameplay must not block on these writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS rooms (
    room_id TEXT PRIMARY KEY,
    room_name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    port INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT REFERENCES rooms(room_id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS participants (
    participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(session_id),
    participant_net_id BIGINT NOT NULL,
    connection_id INTEGER NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS runtime_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    room_id TEXT,
    session_id UUID,
    participant_net_id BIGINT,
    entity_net_id BIGINT,
    message TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS interaction_events (
    id BIGSERIAL PRIMARY KEY,
    runtime_event_id TEXT REFERENCES runtime_events(event_id),
    participant_net_id BIGINT,
    entity_net_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS calibration_events (
    id BIGSERIAL PRIMARY KEY,
    runtime_event_id TEXT REFERENCES runtime_events(event_id),
    marker_id TEXT,
    state TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_runtime_events_occurred_at
    ON runtime_events(occurred_at);

CREATE INDEX IF NOT EXISTS ix_runtime_events_type
    ON runtime_events(event_type);

CREATE INDEX IF NOT EXISTS ix_interaction_events_entity
    ON interaction_events(entity_net_id, occurred_at);

CREATE INDEX IF NOT EXISTS ix_calibration_events_marker
    ON calibration_events(marker_id, occurred_at);
