# Brainstorm: Cocos MCP Tool Gap Analysis vs Unity MCP

**Date**: 2026-04-09
**Status**: Analysis Complete

## Problem Statement

Cocos MCP Server has **20 tools / 193 actions**. Unity MCP has **61 tools** with significantly broader coverage. Goal: identify high-value tools missing from Cocos MCP that Cocos Creator's API can support.

## Current State

### Cocos MCP (20 tools)
manage_scene, manage_node, manage_component, manage_prefab, manage_asset, manage_project, manage_debug, manage_preferences, manage_server, manage_broadcast, manage_scene_view, manage_node_hierarchy, manage_scene_query, manage_undo, manage_reference_image, manage_validation, manage_selection, manage_script, manage_material, manage_animation

### Unity MCP (61 tools)
Everything Cocos has PLUS: physics, camera, audio, VFX/particles, UI, lighting, terrain, tilemap, mesh, shader, graphics/render pipeline, build management, test runner, packages, navigation, splines, input system, localization, profiler, video, timeline, batch execution, editor control (play/pause), menu item execution, scriptable objects, C# reflection, and more.

---

## Gap Analysis: Missing Tools by Priority

### Tier 1 — High Impact, Feasible Now (Core Cocos APIs exist)

| # | Proposed Tool | Unity Equivalent | Cocos API Available | Est. Actions |
|---|---------------|------------------|---------------------|--------------|
| 1 | **manage_physics** | manage_physics, manage_physics2d | `RigidBody`, `BoxCollider`, `PhysicsSystem` via scene script | 8-10 |
| 2 | **manage_camera** | manage_camera | `Camera` component, projection, clear flags, layers | 6-8 |
| 3 | **manage_audio** | manage_audio | `AudioSource` component, clip, volume, loop | 5-7 |
| 4 | **manage_particle** | manage_vfx | `ParticleSystem` (3D), `ParticleSystem2D` — emission, shape, renderer | 8-10 |
| 5 | **manage_ui** | manage_ui | `Canvas`, `Widget`, `Layout`, `Label`, `Sprite`, `Button`, `ScrollView`, `EditBox` | 10-12 |
| 6 | **manage_light** | manage_lighting | `DirectionalLight`, `SphereLight`, `SpotLight`, `RangedDirectionalLight` (3D) | 5-7 |
| 7 | **batch_execute** | batch_execute | Pure server-side batching of tool calls — no special Cocos API needed | 2-3 |

### Tier 2 — Medium Impact, Feasible

| # | Proposed Tool | Unity Equivalent | Cocos API Available | Est. Actions |
|---|---------------|------------------|---------------------|--------------|
| 8 | **manage_tween** | (none — Cocos unique!) | `tween()` API — create animation sequences programmatically | 4-6 |
| 9 | **manage_tilemap** | manage_tilemap | `TiledMap`, `TiledLayer` — Tiled TMX integration | 5-7 |
| 10 | **manage_spine** | (none — Cocos unique!) | `sp.Skeleton` — Spine 2D animation | 5-6 |
| 11 | **manage_dragonbones** | (none — Cocos unique!) | `dragonBones.ArmatureDisplay` — DragonBones 2D animation | 5-6 |
| 12 | **manage_editor** | manage_editor | Play/pause/step via `Editor.Message`, undo/redo (extends manage_undo) | 6-8 |
| 13 | **execute_menu_item** | execute_menu_item | `Editor.Message.request('menu', ...)` — trigger any menu action | 2-3 |
| 14 | **manage_terrain** | manage_terrain | `Terrain` component (3D) — layers, heightmap, detail | 5-7 |

### Tier 3 — Nice-to-Have

| # | Proposed Tool | Unity Equivalent | Cocos API Available | Est. Actions |
|---|---------------|------------------|---------------------|--------------|
| 15 | **manage_render_pipeline** | manage_render_pipeline | Custom render pipeline settings, post-processing | 4-6 |
| 16 | **manage_shader_effect** | manage_shader | Effect files (.effect), technique/pass configuration | 4-5 |
| 17 | **manage_mesh** | manage_mesh | `MeshRenderer` inspection, mesh asset info | 3-4 |
| 18 | **manage_profiler** | manage_profiler | Performance stats, draw call counts, memory | 3-4 |
| 19 | **manage_video** | manage_video | `VideoPlayer` component | 3-4 |
| 20 | **manage_input** | manage_input_system | Input event mappings, touch/keyboard/gamepad config | 4-5 |

---

## Innovative Features to Adopt from Unity MCP

### 1. Batch Execution (10-100x perf gain)
Unity MCP's `batch_execute` groups multiple tool calls into 1 round-trip. Critical for AI agents that issue rapid sequential operations.

**Implementation**: Server-side batching in `mcp-server.ts` — accept array of tool calls, execute sequentially, return array of results.

### 2. Dynamic Tool Groups
Unity MCP enables/disables tool categories at runtime. Reduces token consumption by hiding irrelevant tools.

**Implementation**: Extend `manage_server` with `enable_group`/`disable_group` actions. Tag tools by category.

### 3. Paging Support for Large Queries
Unity MCP adds `page_size`/`cursor` to query actions. Essential for projects with 1000+ nodes or assets.

**Implementation**: Add optional `pageSize`/`cursor` params to `manage_asset.list`, `manage_node.get_all`, etc.

---

## Cocos-Unique Opportunities (Not in Unity MCP)

| Feature | Why Unique | Tool Name |
|---------|-----------|-----------|
| **Tween system** | Cocos's tween() API is code-driven animation — Unity uses DOTween (3rd party) | manage_tween |
| **Spine integration** | Built-in Spine support (Unity requires separate package) | manage_spine |
| **DragonBones** | Built-in DragonBones support (Unity has none) | manage_dragonbones |
| **Safe Area** | `SafeArea` component for mobile notch handling | manage_ui (action) |
| **Widget layout** | `Widget` alignment system (different from Unity's anchors) | manage_ui (action) |
| **Block Input Events** | `BlockInputEvents` component — Cocos-specific UI feature | manage_ui (action) |

---

## Recommended Implementation Order

### Phase 1 — Core Missing (High Impact)
1. `manage_physics` — Every game needs physics
2. `manage_camera` — Camera control is fundamental
3. `manage_ui` — UI is the largest missing category
4. `manage_light` — 3D projects need lighting
5. `batch_execute` — Performance multiplier for all other tools

### Phase 2 — Game-Specific
6. `manage_audio` — Sound is essential
7. `manage_particle` — Visual effects
8. `manage_tween` — Cocos-unique, high value for AI animation
9. `manage_editor` — Play/pause control

### Phase 3 — Specialized
10. `manage_tilemap` — 2D game essential
11. `manage_spine` — Cocos-unique 2D animation
12. `manage_dragonbones` — Cocos-unique 2D animation
13. `execute_menu_item` — Editor automation
14. `manage_terrain` — 3D world building

### Phase 4 — Polish
15-20. Remaining Tier 3 tools

---

## Effort Estimates

| Phase | Tools | Est. Actions | Complexity |
|-------|-------|-------------|------------|
| Phase 1 | 5 tools | ~35-42 | Medium — well-known APIs |
| Phase 2 | 4 tools | ~22-31 | Medium — require scene context |
| Phase 3 | 5 tools | ~22-29 | Medium-High — specialized APIs |
| Phase 4 | 6 tools | ~21-28 | Low-Medium — smaller scope |
| **Total** | **20 new tools** | **~100-130** | — |

This would bring Cocos MCP from 20 tools → **40 tools** and ~193 → **~300+ actions**.

---

## Key Learnings from Unity MCP Architecture

1. **Tool groups for token efficiency** — Don't load all 40 tools into AI context; let AI enable what it needs
2. **Batch execution is critical** — AI agents benefit massively from grouped operations
3. **Paging prevents context explosion** — Large scenes/projects need paginated results
4. **Scene context required** — Most new tools need `Editor.Message.request('scene', ...)` calls
5. **Base class pattern works** — `BaseActionTool` pattern is sound; new tools follow same structure

---

## Unresolved Questions
1. Cocos Creator scene script API limits — some operations may not be available via `Editor.Message`
2. Physics system manipulation at editor time vs runtime — need to verify API availability
3. Particle system property enumeration completeness
4. Whether `batch_execute` should be an MCP-level feature or a separate tool
5. Tool group visibility — MCP protocol support for dynamic tool listing
