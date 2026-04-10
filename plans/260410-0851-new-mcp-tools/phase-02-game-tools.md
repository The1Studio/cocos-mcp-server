# Phase 2: Game-Specific Tools

**Priority**: P1 — High
**Status**: Pending
**Effort**: M (3d)
**Blocked by**: Phase 1 (batch_execute pattern established)

## Context

- [plan.md](plan.md)
- [Phase 1](phase-01-core-tools.md)
- Pattern reference: `source/tools/manage-animation.ts`, `source/scene.ts`

## Overview

4 tools for game-specific capabilities: audio, particles, tweens (Cocos-unique), and editor playback control.

## Tools

### 1. manage_audio (`source/tools/manage-audio.ts`)

**Actions**: add_source, set_property, play, stop, pause, resume, get_info, list

| Action | Description |
|--------|-------------|
| `add_source` | Add AudioSource component to node. Params: nodeUuid, clipUuid (optional) |
| `set_property` | Set AudioSource property. Params: nodeUuid, property (clip/volume/loop/playOnAwake/maxDistance), value |
| `play` | Play audio on node's AudioSource |
| `stop` | Stop audio playback |
| `pause` | Pause audio playback |
| `resume` | Resume paused audio |
| `get_info` | Get AudioSource properties on node |
| `list` | List all nodes with AudioSource in scene |

**Scene methods needed**: `addAudioSource`, `controlAudio`, `getAudioInfo`, `listAudioSources`

**Implementation notes**:
- `AudioSource` component from `cc` module
- `clipUuid` loaded via `assetManager.loadAny({uuid})` — async pattern like manage-component's spriteFrame
- play/stop/pause/resume are runtime operations — may only work in preview mode
- At edit-time, focus on component setup (add, set properties, assign clip)

---

### 2. manage_particle (`source/tools/manage-particle.ts`)

**Actions**: add, set_property, set_emission, set_shape, set_renderer, get_info, list, remove

| Action | Description |
|--------|-------------|
| `add` | Add ParticleSystem or ParticleSystem2D to node. Params: nodeUuid, is2d (bool, default false) |
| `set_property` | Set particle system property. Params: nodeUuid, property, value. Properties: duration, startLifetime, startSpeed, startSize, startColor, loop, playOnAwake, simulationSpace, maxParticles |
| `set_emission` | Set emission module. Params: nodeUuid, rateOverTime, bursts[{time, count}] |
| `set_shape` | Set shape module. Params: nodeUuid, shapeType (cone/sphere/box/circle/edge for 2D), radius, angle, arc |
| `set_renderer` | Set renderer properties. Params: nodeUuid, renderMode (billboard/stretchedBillboard/mesh), materialUuid |
| `get_info` | Get all particle system properties on node |
| `list` | List all particle system nodes in scene |
| `remove` | Remove particle system component from node |

**Scene methods needed**: `addParticleSystem`, `setParticleProperty`, `setParticleModule`, `getParticleInfo`, `listParticleSystems`

**Implementation notes**:
- 3D: `ParticleSystem` with modules (ShapeModule, EmissionModule, RendererModule)
- 2D: `ParticleSystem2D` — simpler, uses .plist files or direct property setting
- Module access: `particleSystem.shapeModule`, `particleSystem.emissionModule`
- Color accepts hex string or {r,g,b,a}
- Burst format: `{time: number, minCount: number, maxCount: number, repeatCount: number}`

---

### 3. manage_tween (`source/tools/manage-tween.ts`) — Cocos Unique

**Actions**: create, add_to, add_by, add_delay, add_call, add_repeat, get_info, stop_all

| Action | Description |
|--------|-------------|
| `create` | Create and start a tween on node. Params: nodeUuid, steps[] (array of tween operations) |
| `add_to` | Single absolute tween step. Params: nodeUuid, properties (position/rotation/scale/opacity), duration, easing |
| `add_by` | Single relative tween step. Params: nodeUuid, properties, duration, easing |
| `add_delay` | Add delay step. Params: nodeUuid, duration |
| `add_call` | Add callback step (limited — log message). Params: nodeUuid, message |
| `add_repeat` | Wrap existing tween in repeat. Params: nodeUuid, times (0=forever) |
| `get_info` | Get active tweens on node (limited info — tween system doesn't expose runtime state well) |
| `stop_all` | Stop and remove all tweens on node. Params: nodeUuid |

**Scene methods needed**: `createTween`, `stopTweens`, `getTweenInfo`

**Implementation notes**:
- Tween API: `tween(node).to(duration, {position: v3(x,y,z)}, {easing: 'cubicInOut'}).start()`
- `create` action builds tween from steps array: `[{type:'to', duration:1, props:{position:{x,y,z}}, easing:'linear'}, {type:'delay', duration:0.5}]`
- Easing options: `linear, quadIn, quadOut, quadInOut, cubicIn, cubicOut, cubicInOut, sineIn, sineOut, sineInOut, bounceIn, bounceOut, bounceInOut, elasticIn, elasticOut, elasticInOut, backIn, backOut, backInOut`
- **Runtime only** — tweens execute in play mode. At edit-time, we set up the tween definition but it won't animate
- This is a high-value tool for AI animation workflows

---

### 4. manage_editor (`source/tools/manage-editor.ts`)

**Actions**: play, pause, step, stop, get_state, reload_scene, open_panel, get_panels

| Action | Description |
|--------|-------------|
| `play` | Start game preview in editor |
| `pause` | Pause game preview |
| `step` | Step one frame forward (while paused) |
| `stop` | Stop game preview |
| `get_state` | Get current editor state (isPlaying, isPaused, currentScene) |
| `reload_scene` | Reload the current scene |
| `open_panel` | Open an editor panel by name (e.g., 'console', 'hierarchy', 'inspector', 'assets', 'build') |
| `get_panels` | List available editor panels |

**Implementation notes**:
- Play/pause/stop: `Editor.Message.request('preview', 'play')`, `Editor.Message.request('preview', 'pause')`, `Editor.Message.request('preview', 'stop')`
- Or use: `Editor.Message.send('scene', 'enter-prefab-mode')` / `Editor.Message.send('scene', 'exit-prefab-mode')`
- State query: `Editor.Message.request('preview', 'query-state')`
- Panel open: `Editor.Panel.open('panel-name')`
- **No scene methods needed** — all operations use Editor.Message directly
- This replaces/extends the limited controls in manage_project

---

## Related Code Files

### Files to Create
- `source/tools/manage-audio.ts`
- `source/tools/manage-particle.ts`
- `source/tools/manage-tween.ts`
- `source/tools/manage-editor.ts`

### Files to Modify
- `source/mcp-server.ts` — Add imports and registration for 4 new tools
- `source/scene.ts` — Add scene methods for audio, particle, tween operations

## Implementation Steps

1. Create `manage-editor.ts` (simplest — no scene methods, pure Editor.Message)
2. Create `manage-audio.ts` (standard component pattern)
3. Create `manage-particle.ts` (module-based property access)
4. Create `manage-tween.ts` (complex step builder)
5. Add scene.ts methods for audio/particle/tween
6. Register all 4 tools in mcp-server.ts
7. Run `npm run build` — verify zero errors

## Todo List

- [ ] Implement manage_editor (8 actions, Editor.Message only)
- [ ] Implement manage_audio (8 actions)
- [ ] Implement manage_particle (8 actions, module access)
- [ ] Implement manage_tween (8 actions, step builder)
- [ ] Add scene.ts methods for audio/particle/tween
- [ ] Register all in mcp-server.ts
- [ ] Build and verify: `npm run build`

## Success Criteria

- All 4 tools compile without errors
- `tools/list` returns 29 tools (25 from Phase 1 + 4 new)
- manage_editor can query play state
- manage_tween accepts multi-step tween definition

## Risk Assessment

| Risk | L | I | Score | Mitigation |
|------|---|---|-------|------------|
| Tween/audio operations require runtime (play mode) | 4 | 3 | 12 | Document limitation; focus on setup at edit-time |
| ParticleSystem module API varies between Cocos versions | 3 | 3 | 9 | Target 3.8+ API; version check in description |
| Preview control messages may differ between Cocos versions | 2 | 3 | 6 | Test against 3.8.6; document minimum version |
| Tween step array parsing complexity | 2 | 2 | 4 | Validate each step shape, return clear errors |
