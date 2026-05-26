# Runtime Event Contract

`RuntimeEvent` is the shared boundary between Unity runtime systems, telemetry, persistence, dashboards, and validation tooling.

Unity gameplay code emits events through `RuntimeEventEmitter`. It does not call Prometheus, PostgreSQL, or Grafana directly.

## Event Types

- `RoomCreated`, `RoomClosed`, `RoomStarted`, `RoomStopped`
- `PlayerJoined`, `PlayerLeft`
- `OwnershipAcquired`, `OwnershipReleased`, `OwnershipTransferred`
- `CalibrationStarted`, `CalibrationCompleted`
- `SessionStarted`, `SessionEnded`
- `ServerStarted`, `ServerStopped`

## Payload

- `eventId`: unique event id.
- `eventType`: one of the canonical event types.
- `timestampUtc`: UTC ISO-8601 timestamp.
- `source`: Unity component or service that emitted the event.
- `roomId`, `sessionId`: optional lifecycle correlation ids.
- `participantNetId`, `entityNetId`: optional Mirror ids.
- `message`: short human-readable context.
- `metadataJson`: optional JSON for marker ids, room metadata, release details, or future diagnostics.

## Current Unity Emitters

- `XRNetworkManager`: server start/stop.
- `RuntimeSessionManager`: session start/end and participant join/leave.
- `RuntimeInteractable`: authority acquired/released.
- `MRCalibrationManager`: calibration start/completion.

## Metrics

`RuntimeMetricsExporter` subscribes to `RuntimeEventEmitter` and can export a Prometheus-compatible text snapshot to `Application.persistentDataPath`. This is a bridge, not a gameplay dependency.

`RuntimeEventFileSink` can also append JSONL events to `Application.persistentDataPath/cxr_runtime_events.jsonl` for a local writer service or manual replay.
