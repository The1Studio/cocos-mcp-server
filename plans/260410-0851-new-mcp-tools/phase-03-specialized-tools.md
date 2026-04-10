# Phase 3: Specialized Tools

**Priority**: P2 — Medium
**Status**: Pending
**Effort**: M (3d)
**Blocked by**: Phase 2

## Context

- [plan.md](plan.md)
- [Phase 2](phase-02-game-tools.md)

## Overview

5 tools for specialized game subsystems: TiledMap, Spine/DragonBones animation (Cocos-unique), editor menu automation, and 3D terrain.

## Tools

### 1. manage_tilemap (`source/tools/manage-tilemap.ts`)

**Actions**: get_info, list, get_layer_info, set_tile, get_tile, get_tileset_info

| Action | Description |
|--------|-------------|
| `get_info` | Get TiledMap component info on node (mapSize, tileSize, layers, orientation) |
| `list` | List all TiledMap nodes in scene |
| `get_layer_info` | Get layer details (name, layerSize, tileSize, tiles count). Params: nodeUuid, layerName |
| `set_tile` | Set tile GID at position. Params: nodeUuid, layerName, x, y, gid |
| `get_tile` | Get tile GID at position. Params: nodeUuid, layerName, x, y |
| `get_tileset_info` | Get tileset info (firstGid, name, tileCount, imageSize) |

**Scene methods needed**: `getTiledMapInfo`, `getTiledLayerInfo`, `setTile`, `getTile`

**Implementation notes**:
- `TiledMap` component from `cc` — reads TMX format files
- Layers accessed via `tiledMap.getLayers()` or `tiledMap.getLayer(name)`
- Tile operations: `layer.setTileGIDAt(gid, x, y)`, `layer.getTileGIDAt(x, y)`
- TiledMap must already exist on node (loaded from .tmx asset)
- Orientation types: ORTHO, ISO, HEX

---

### 2. manage_spine (`source/tools/manage-spine.ts`) — Cocos Unique

**Actions**: get_info, set_animation, set_skin, set_property, list, add_to_node

| Action | Description |
|--------|-------------|
| `get_info` | Get sp.Skeleton component info (animations list, skins list, current animation, current skin) |
| `set_animation` | Play animation. Params: nodeUuid, animationName, loop (bool), trackIndex (default 0) |
| `set_skin` | Set skin. Params: nodeUuid, skinName |
| `set_property` | Set Spine property. Params: nodeUuid, property (timeScale/premultipliedAlpha/useTint/debugBones/debugSlots), value |
| `list` | List all nodes with sp.Skeleton in scene |
| `add_to_node` | Add sp.Skeleton to node and assign skeleton data. Params: nodeUuid, skeletonDataUuid |

**Scene methods needed**: `getSpineInfo`, `setSpineAnimation`, `setSpineSkin`, `setSpineProperty`, `listSpineNodes`, `addSpineToNode`

**Implementation notes**:
- Spine module: `sp.Skeleton` component (may not be available if Spine not enabled in project)
- **Availability check**: `try { require('cc').sp } catch { return errorResult('Spine module not available') }`
- Animation names from: `skeleton.skeletonData.getAnimsEnum()` or `skeleton.animation`
- Skin names from: `skeleton.skeletonData.getSkinsEnum()`
- SkeletonData asset loaded via `assetManager.loadAny({uuid})`
- Track index for layered animations (0 = base, 1+ = overlay)

---

### 3. manage_dragonbones (`source/tools/manage-dragonbones.ts`) — Cocos Unique

**Actions**: get_info, set_animation, set_armature, set_property, list, add_to_node

| Action | Description |
|--------|-------------|
| `get_info` | Get dragonBones.ArmatureDisplay info (animations, armatureNames, current animation) |
| `set_animation` | Play animation. Params: nodeUuid, animationName, playTimes (-1=loop, 0=use data, N=times) |
| `set_armature` | Set armature name. Params: nodeUuid, armatureName |
| `set_property` | Set property (timeScale, debugBones, playTimes). Params: nodeUuid, property, value |
| `list` | List all nodes with ArmatureDisplay in scene |
| `add_to_node` | Add ArmatureDisplay and assign DragonBonesAsset. Params: nodeUuid, dragonBonesAssetUuid, dragonBonesAtlasAssetUuid |

**Scene methods needed**: `getDragonBonesInfo`, `setDragonBonesAnimation`, `setDragonBonesProperty`, `listDragonBonesNodes`, `addDragonBonesToNode`

**Implementation notes**:
- DragonBones module: `dragonBones.ArmatureDisplay` (may not be available)
- **Availability check**: `try { require('cc').dragonBones } catch { return errorResult('DragonBones module not available') }`
- Animation names: `armatureDisplay.getAnimationNames(armatureName)`
- Armature names: `armatureDisplay.getArmatureNames()`
- Two assets needed: DragonBonesAsset (.json) + DragonBonesAtlasAsset (texture atlas)
- Similar pattern to manage_spine — could share availability check utility

---

### 4. execute_menu_item (`source/tools/execute-menu-item.ts`)

**Actions**: execute, list, search

| Action | Description |
|--------|-------------|
| `execute` | Execute menu item by path. Params: menuPath (e.g., "i18n/File/i18n:menu.save_scene", "Project/Build...") |
| `list` | List all available top-level menu categories |
| `search` | Search menu items by keyword. Params: keyword |

**Implementation notes**:
- Execute: `Editor.Message.send('menu', 'click', menuPath)` or `Editor.Menu.click(menuPath)`
- List: `Editor.Menu.getMenu()` — may return nested menu structure
- **No scene methods needed** — pure Editor API
- Menu paths are i18n-dependent — may need to handle both English and Chinese paths
- Some menu items trigger dialogs (Build, Preferences) — document this limitation
- Safety: block dangerous paths like "File/Delete" without confirmation param

---

### 5. manage_terrain (`source/tools/manage-terrain.ts`)

**Actions**: get_info, set_property, get_layer_info, set_layer, get_height, set_height, list

| Action | Description |
|--------|-------------|
| `get_info` | Get Terrain component info (tileCount, weightMapSize, lightMapSize, blockCount, layers) |
| `set_property` | Set terrain property (tileSize, weightMapSize, lightMapSize). Params: nodeUuid, property, value |
| `get_layer_info` | Get terrain layer info. Params: nodeUuid, layerIndex |
| `set_layer` | Set terrain layer texture. Params: nodeUuid, layerIndex, detailMapUuid, normalMapUuid, tileSize |
| `get_height` | Get terrain height at position. Params: nodeUuid, x, y |
| `set_height` | Set terrain height at position. Params: nodeUuid, x, y, height |
| `list` | List all terrain nodes in scene |

**Scene methods needed**: `getTerrainInfo`, `setTerrainProperty`, `getTerrainHeight`, `setTerrainHeight`, `setTerrainLayer`

**Implementation notes**:
- `Terrain` component from `cc` (3D only, Cocos 3.x+)
- Height manipulation: `terrain.getHeight(x, y)`, terrain heightmap is `Float32Array`
- Terrain layers: up to 4 layers with detail textures + normal maps
- Block system: terrain split into blocks for LOD
- **3D only** — return clear error for 2D projects
- Performance: setting individual heights is slow for large areas; consider batch height action in future

---

## Related Code Files

### Files to Create
- `source/tools/manage-tilemap.ts`
- `source/tools/manage-spine.ts`
- `source/tools/manage-dragonbones.ts`
- `source/tools/execute-menu-item.ts`
- `source/tools/manage-terrain.ts`

### Files to Modify
- `source/mcp-server.ts` — Add imports and registration for 5 new tools
- `source/scene.ts` — Add scene methods for tilemap, spine, dragonbones, terrain

## Implementation Steps

1. Create `execute-menu-item.ts` (simplest — Editor API only)
2. Create `manage-tilemap.ts` (TiledMap API)
3. Create `manage-spine.ts` (with availability check)
4. Create `manage-dragonbones.ts` (with availability check)
5. Create `manage-terrain.ts` (3D-only terrain API)
6. Add scene.ts methods for tilemap/spine/dragonbones/terrain
7. Register all 5 tools in mcp-server.ts
8. Run `npm run build`

## Todo List

- [ ] Implement execute_menu_item (3 actions, Editor API)
- [ ] Implement manage_tilemap (6 actions)
- [ ] Implement manage_spine (6 actions, availability check)
- [ ] Implement manage_dragonbones (6 actions, availability check)
- [ ] Implement manage_terrain (7 actions, 3D only)
- [ ] Add scene.ts methods
- [ ] Register all in mcp-server.ts
- [ ] Build and verify: `npm run build`

## Success Criteria

- All 5 tools compile without errors
- `tools/list` returns 34 tools
- Spine/DragonBones tools return graceful error when modules not available
- execute_menu_item can trigger scene save

## Risk Assessment

| Risk | L | I | Score | Mitigation |
|------|---|---|-------|------------|
| Spine/DragonBones not installed in target project | 4 | 3 | 12 | Runtime availability check; clear error message |
| Menu paths vary by Cocos version/language | 3 | 3 | 9 | Use internal paths where possible; document known paths |
| Terrain heightmap direct access may be restricted | 3 | 2 | 6 | Fallback to component property setting |
| TiledMap requires .tmx asset pre-loaded | 2 | 2 | 4 | Document prerequisite; error if no TiledMap component |
