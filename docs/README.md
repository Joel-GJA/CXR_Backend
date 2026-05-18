# CXR Multiplayer Documentation

This folder documents the current Phase 1 multiplayer foundation and the developer-facing blueprints for using it in an XR app.

## Architecture

- [Multiplayer Foundation Architecture](Multiplayer_Foundation_Architecture.md): formal system architecture, development narrative, runtime layers, lifecycle flows, public API boundaries, and extension points.
- [Phase 1 Progress and Context](Phase1_Progress_Context.md): project progress, Codex development context, completion estimate, known gaps, and recommended next steps.

## Developer Blueprints

- [Phase 1 Developer Quickstart](Phase1_Developer_Quickstart.md): shortest path for placing the prefabs and validating host/client/discovery flow.
- [XRNetworkManager Prefab Blueprint](NetworkManager_Prefab_Blueprint.md): manager prefab responsibilities, required components, lifecycle hooks, and setup rules.
- [Runtime Facade and Debug GUI Blueprint](RuntimeFacade_DebugGUI_Blueprint.md): production UI API and debug GUI usage.
- [Runtime Participant Blueprint](RuntimeParticipant_Blueprint.md): participant prefab structure, anchors, registration flow, and customization rules.
- [Runtime Entity Blueprint](RuntimeEntity_Blueprint.md): networked object lifecycle, ownership, spawn/despawn, and registry rules.
- [Discovery and Session Blueprint](Discovery_Session_Blueprint.md): room discovery, metadata, runtime session state, and join flow.
- [Headless Server Testing](Headless_Server_Testing.md): dedicated server launcher, command-line arguments, metadata, and validation workflow.
- [Remote Room Registry](Remote_Room_Registry.md): multi-room hosting model for one physical Ubuntu server using a central HTTP registry.
- [Example Scenes Blueprint](Example_Scenes_Blueprint.md): intended role and validation criteria for lobby, session, and testing scenes.

## Existing SDK Docs

The lower-level SDK documentation remains in:

`Assets/SDK/Documentation`

Use those docs when working directly with the standalone LAN discovery SDK. Use the docs in this folder when building with the full multiplayer foundation.
