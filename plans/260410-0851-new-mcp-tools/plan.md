# Plan: 20 New MCP Tools for Cocos MCP Server

**Created**: 2026-04-10
**Branch**: main
**Status**: Complete
**Brainstorm**: [Gap Analysis Report](../reports/brainstorm-260409-2330-unity-mcp-gap-analysis.md)

## Goal

Expand Cocos MCP Server from 20 tools (193 actions) to 40 tools (~320 actions) by implementing missing tool categories identified from Unity MCP analysis.

## Phases

| Phase | Tools | Status | File |
|-------|-------|--------|------|
| 1. Core Tools | manage_physics, manage_camera, manage_ui, manage_light, batch_execute | Done | [phase-01](phase-01-core-tools.md) |
| 2. Game Tools | manage_audio, manage_particle, manage_tween, manage_editor | Done | [phase-02](phase-02-game-tools.md) |
| 3. Specialized | manage_tilemap, manage_spine, manage_dragonbones, execute_menu_item, manage_terrain | Done | [phase-03](phase-03-specialized-tools.md) |
| 4. Polish | manage_render_pipeline, manage_shader_effect, manage_mesh, manage_profiler, manage_video, manage_input | Done | [phase-04](phase-04-polish-tools.md) |

## Architecture Pattern (All Tools)

Every new tool follows the identical pattern:

```
source/tools/manage-{name}.ts  →  class Manage{Name} extends BaseActionTool
                                   - readonly name, description, inputSchema, actions
                                   - protected actionHandlers: Record<string, handler>
                                   - Each handler returns ActionToolResult via successResult()/errorResult()
```

**Registration**: Add import + instantiation in `source/mcp-server.ts` → `initializeTools()`.

**Scene operations**: Add methods in `source/scene.ts` when runtime `cc` module access needed. Tools call via `Editor.Message.request('scene', 'execute-scene-script', ...)`.

**Editor operations**: Use `Editor.Message.request(...)` directly in tool handlers.

## Key Dependencies

- Cocos Creator 3.5+ editor APIs (`Editor.Message`)
- Scene script context (`require('cc')`) for runtime component access
- Asset DB APIs for asset-based tools
- No external dependencies required

## Risk Assessment

| Risk | L | I | Score | Mitigation |
|------|---|---|-------|------------|
| Scene API limitations for physics/particle at edit-time | 3 | 4 | 12 | Fallback to component property setting via existing manage_component |
| File size exceeds 200 LOC for complex tools (manage_ui) | 3 | 2 | 6 | Split action handlers into helper modules |
| Spine/DragonBones not installed in all projects | 2 | 3 | 6 | Graceful error: "Spine module not found" |
| batch_execute error propagation complexity | 2 | 3 | 6 | Stop-on-error with partial results array |

## Timeline

| Phase | Effort | Notes |
|-------|--------|-------|
| Phase 1 | M (3d) | Well-known APIs, highest value |
| Phase 2 | M (3d) | Scene context needed for tween/particle |
| Phase 3 | M (3d) | Spine/DragonBones need availability checks |
| Phase 4 | S-M (2d) | Smaller scope per tool |
| **Total** | **~11d** | Phases 1-2 are critical path |

## Handoff

```
/t1k:cook plans/260410-0851-new-mcp-tools/
```
