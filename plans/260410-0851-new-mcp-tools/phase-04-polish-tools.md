# Phase 4: Polish Tools

**Priority**: P3 — Nice-to-Have
**Status**: Pending
**Effort**: S-M (2d)
**Blocked by**: Phase 3

## Context

- [plan.md](plan.md)
- [Phase 3](phase-03-specialized-tools.md)

## Overview

6 smaller-scope tools for rendering, shaders, mesh inspection, profiling, video, and input. Each has 3-5 actions. Lower priority but rounds out full engine coverage.

## Tools

### 1. manage_render_pipeline (`source/tools/manage-render-pipeline.ts`)

**Actions**: get_info, set_shadow, set_fog, set_skybox, set_post_process

| Action | Description |
|--------|-------------|
| `get_info` | Get current render pipeline settings (shadows, fog, skybox, ambient) |
| `set_shadow` | Configure shadow settings. Params: enabled, type (Planar/ShadowMap), shadowMapSize, maxReceived, saturation |
| `set_fog` | Configure fog. Params: enabled, fogColor, type (LINEAR/EXP/EXP2/LAYERED), fogStart, fogEnd, fogDensity |
| `set_skybox` | Configure skybox. Params: enabled, envmapUuid, useHDR, rotationAngle |
| `set_post_process` | Set post-process settings (bloom, tonemap). Params: varies by effect |

**Implementation notes**:
- Pipeline settings via `director.root.pipeline` in scene context
- Shadow: `director.root.pipeline.shadows` or project settings
- Fog: `director.root.pipeline.fog`
- Skybox: `director.root.pipeline.pipelineSceneData.skybox`
- Some settings persist via project settings file, others are runtime-only
- 3D only — return error for 2D projects

---

### 2. manage_shader_effect (`source/tools/manage-shader-effect.ts`)

**Actions**: list, get_info, get_passes, set_pass_property, create

| Action | Description |
|--------|-------------|
| `list` | List all .effect files in project |
| `get_info` | Get effect file info (techniques, passes, properties). Params: url |
| `get_passes` | Get pass details for a technique. Params: url, techniqueIndex (default 0) |
| `set_pass_property` | Set pass property value. Params: url, techniqueIndex, passIndex, property, value |
| `create` | Create basic effect file from template. Params: url, template (unlit/standard/toon) |

**Implementation notes**:
- Effect files (.effect) are YAML-like Cocos shader format
- Read/write via `asset-db` APIs (same as manage-material/manage-animation)
- Templates: provide pre-built unlit, standard, and toon effect content
- Pass properties: uniform values like mainColor, mainTexture, emissive
- No scene methods needed — asset DB operations only

---

### 3. manage_mesh (`source/tools/manage-mesh.ts`)

**Actions**: get_info, list, get_renderer_info, set_renderer_property

| Action | Description |
|--------|-------------|
| `get_info` | Get mesh asset info (vertexCount, primitiveCount, subMeshes, boundingBox). Params: uuid or nodeUuid |
| `list` | List all mesh assets in project. Params: pattern (default db://assets/**/*.mesh) |
| `get_renderer_info` | Get MeshRenderer component info on node (materials, mesh, shadowCastingMode, receiveShadow) |
| `set_renderer_property` | Set MeshRenderer property. Params: nodeUuid, property (mesh/shadowCastingMode/receiveShadow/visibility), value |

**Scene methods needed**: `getMeshRendererInfo`, `setMeshRendererProperty`

**Implementation notes**:
- MeshRenderer component from `cc`
- Mesh info via `mesh.struct` (vertexBundles, primitives)
- Asset listing via `asset-db query-assets` with mesh pattern
- Shadow properties: `shadowCastingMode` (OFF/ON), `receiveShadow` (bool)

---

### 4. manage_profiler (`source/tools/manage-profiler.ts`)

**Actions**: get_stats, get_memory, toggle_stats_display, get_draw_calls

| Action | Description |
|--------|-------------|
| `get_stats` | Get performance statistics (fps, drawCalls, triangles, instances, nodeCount, componentCount) |
| `get_memory` | Get memory usage info (textureMemory, bufferMemory, totalMemory) |
| `toggle_stats_display` | Toggle built-in stats display in editor. Params: enabled |
| `get_draw_calls` | Get detailed draw call breakdown by render pass |

**Scene methods needed**: `getPerformanceStats`, `getMemoryStats`

**Implementation notes**:
- Stats from `director.root.device` and `director.root.pipeline`
- FPS: `game.frameRate` or calculated from delta time
- Draw calls: `director.root.pipeline.pipelineStats` (if available)
- Node/component count: walk scene tree (existing pattern from manage_debug)
- Memory: limited access at editor time; `process.memoryUsage()` for Node.js side
- Some stats only available during play mode

---

### 5. manage_video (`source/tools/manage-video.ts`)

**Actions**: add, set_property, play, get_info, list

| Action | Description |
|--------|-------------|
| `add` | Add VideoPlayer component to node. Params: nodeUuid, clipUrl (remote URL or local path) |
| `set_property` | Set VideoPlayer property. Params: nodeUuid, property (resourceType/remoteURL/clip/playOnAwake/loop/playbackRate/volume/keepAspectRatio/fullScreen), value |
| `play` | Play/pause/stop video. Params: nodeUuid, command (play/pause/stop/resume) |
| `get_info` | Get VideoPlayer properties and state on node |
| `list` | List all VideoPlayer nodes in scene |

**Scene methods needed**: `addVideoPlayer`, `setVideoProperty`, `controlVideo`, `getVideoInfo`

**Implementation notes**:
- `VideoPlayer` component from `cc`
- Resource types: LOCAL (clip asset) or REMOTE (URL)
- Playback control is runtime-only (play mode)
- At edit-time: component setup and property configuration
- Platform limitations: VideoPlayer renders as native overlay on mobile

---

### 6. manage_input (`source/tools/manage-input.ts`)

**Actions**: get_config, set_touch_config, set_acceleration, get_event_types, simulate_input

| Action | Description |
|--------|-------------|
| `get_config` | Get input system configuration (multiTouch, touchEnabled, accelerometerEnabled) |
| `set_touch_config` | Set touch config. Params: multiTouchEnabled (bool) |
| `set_acceleration` | Set accelerometer config. Params: enabled, interval |
| `get_event_types` | List all available input event types (TOUCH_START, KEY_DOWN, etc.) |
| `simulate_input` | Simulate input event in play mode. Params: type (touch/key/mouse), eventData |

**Scene methods needed**: `getInputConfig`, `setInputConfig`, `simulateInput`

**Implementation notes**:
- Input system: `input` from `cc` module
- `input.multiTouchEnabled`, `input.setAccelerometerEnabled(true)`
- Event types: `Input.EventType.{TOUCH_START, TOUCH_MOVE, TOUCH_END, KEY_DOWN, KEY_UP, MOUSE_DOWN, ...}`
- Simulate: `input.emit(eventType, eventData)` — runtime only
- At edit-time: configuration is the primary use case
- Gamepad: `input.getGamepad()` — limited support

---

## Related Code Files

### Files to Create
- `source/tools/manage-render-pipeline.ts`
- `source/tools/manage-shader-effect.ts`
- `source/tools/manage-mesh.ts`
- `source/tools/manage-profiler.ts`
- `source/tools/manage-video.ts`
- `source/tools/manage-input.ts`

### Files to Modify
- `source/mcp-server.ts` — Add imports and registration for 6 new tools
- `source/scene.ts` — Add scene methods for mesh, profiler, video, input

## Implementation Steps

1. Create `manage-shader-effect.ts` (asset DB only, no scene methods)
2. Create `manage-mesh.ts` (simple component + asset inspection)
3. Create `manage-profiler.ts` (stats gathering)
4. Create `manage-render-pipeline.ts` (pipeline settings)
5. Create `manage-video.ts` (VideoPlayer component)
6. Create `manage-input.ts` (input system config)
7. Add scene.ts methods
8. Register all 6 tools in mcp-server.ts
9. Run `npm run build`

## Todo List

- [ ] Implement manage_shader_effect (5 actions)
- [ ] Implement manage_mesh (4 actions)
- [ ] Implement manage_profiler (4 actions)
- [ ] Implement manage_render_pipeline (5 actions)
- [ ] Implement manage_video (5 actions)
- [ ] Implement manage_input (5 actions)
- [ ] Add scene.ts methods
- [ ] Register all in mcp-server.ts
- [ ] Build and verify: `npm run build`

## Success Criteria

- All 6 tools compile without errors
- `tools/list` returns 40 tools (full target)
- manage_profiler returns meaningful stats
- manage_shader_effect can list all .effect files

## Risk Assessment

| Risk | L | I | Score | Mitigation |
|------|---|---|-------|------------|
| Pipeline stats API varies by Cocos version | 3 | 2 | 6 | Graceful fallback; return what's available |
| VideoPlayer native overlay limits testing | 2 | 2 | 4 | Focus on component setup, not playback |
| Effect file format changes between versions | 2 | 3 | 6 | Use asset-db APIs, don't parse YAML directly |
| Input simulation limited to play mode | 3 | 2 | 6 | Document limitation; focus on config at edit-time |
