# Validation And Diagnostics Blueprint

`XRPresenceTestScene` remains the active development scene. The next scene milestone is to promote it or duplicate it into `Phase2IntegrationScene` with all validation zones visible together.

## Phase 2 Closeout Checklist

1. Host starts from the scene.
2. Client joins the same room.
3. Head and hand transforms sync.
4. Wrist menu can start/stop host/client flow.
5. Registry advertises and refreshes rooms.
6. Client grabs and releases an interactable.
7. Host grabs and releases an interactable.
8. Ownership transfers cleanly.
9. Cubes can stack without persistent jitter.
10. Irregular or compound collider object releases without tunneling.
11. Disconnect/reconnect cleans participant state.
12. Headless server supports the same scenario with useful logs.

## Phase 3 Validation Zones

- XR sync zone.
- Interaction and ownership zone.
- Lifecycle and reconnect zone.
- MR marker calibration zone.
- Diagnostics zone with runtime events and metrics snapshot status.

## Acceptance

- Editor two-client test passes.
- Windows local multi-room run passes.
- Linux headless run passes before phase completion.
