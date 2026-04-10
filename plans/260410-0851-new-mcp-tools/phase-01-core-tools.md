# Phase 1: Core Tools (High Impact)

**Priority**: P0 — Critical
**Status**: Pending
**Effort**: M (3d)

## Context

- [Brainstorm Report](../reports/brainstorm-260409-2330-unity-mcp-gap-analysis.md)
- [plan.md](plan.md)
- Pattern reference: `source/tools/manage-animation.ts`, `source/tools/base-action-tool.ts`

## Overview

5 tools covering fundamental game engine capabilities missing from Cocos MCP. These are the most universally needed by AI agents building games.

## Tools

### 1. manage_physics (`source/tools/manage-physics.ts`)

**Actions**: configure, add_rigidbody, add_collider, set_rigidbody_property, set_collider_property, remove_physics, get_info, raycast

| Action | Description |
|--------|-------------|
| `configure` | Set physics system settings (gravity, fixedTimeStep, maxSubSteps) |
| `add_rigidbody` | Add RigidBody/RigidBody2D to node by UUID. Params: type (dynamic/static/kinematic), mass, useGravity |
| `add_collider` | Add collider to node. Params: shape (box/sphere/capsule/mesh for 3D; box/circle/polygon for 2D), size, isTrigger |
| `set_rigidbody_property` | Set rigidbody property (mass, linearDamping, angularDamping, useGravity, type) |
| `set_collider_property` | Set collider property (size, center, isTrigger, material) |
| `remove_physics` | Remove all physics components from node |
| `get_info` | Get physics components info on a node |
| `raycast` | Cast ray in scene (origin, direction, maxDistance). Returns hit results |

**Scene methods needed**: `addPhysicsComponents`, `setPhysicsProperty`, `getPhysicsInfo`, `performRaycast`

**Implementation notes**:
- Detect 2D vs 3D from node type (use existing `detect_type` pattern from manage_node)
- Physics system config via `PhysicsSystem.instance` in scene context
- Collider shapes map: `{box: BoxCollider, sphere: SphereCollider, capsule: CapsuleCollider}`
- 2D equivalents: `{box: BoxCollider2D, circle: CircleCollider2D, polygon: PolygonCollider2D}`

---

### 2. manage_camera (`source/tools/manage-camera.ts`)

**Actions**: get_info, set_property, set_clear_flags, set_projection, set_viewport, list

| Action | Description |
|--------|-------------|
| `get_info` | Get camera component properties on node (projection, fov, near, far, clearFlags, rect) |
| `set_property` | Set camera property (fov, orthoHeight, near, far, priority, visibility) |
| `set_clear_flags` | Set clear flags (SOLID_COLOR, DEPTH_ONLY, DONT_CLEAR, SKYBOX) |
| `set_projection` | Set projection type (ORTHO or PERSPECTIVE) |
| `set_viewport` | Set camera viewport rect (x, y, width, height as 0-1 normalized) |
| `list` | List all cameras in current scene |

**Scene methods needed**: `getCameraInfo`, `setCameraProperty`, `listCameras`

**Implementation notes**:
- Camera component accessed via `node.getComponent(Camera)` in scene context
- Clear flags enum: `Camera.ClearFlag.{SOLID_COLOR, DEPTH_ONLY, DONT_CLEAR, SKYBOX}`
- Projection enum: `Camera.ProjectionType.{ORTHO, PERSPECTIVE}`
- No asset DB operations — purely scene-based

---

### 3. manage_ui (`source/tools/manage-ui.ts`)

**Actions**: create_widget, create_label, create_button, create_sprite, create_layout, set_widget, set_label_property, set_sprite_property, get_info, list_ui_nodes, create_scrollview, create_editbox

| Action | Description |
|--------|-------------|
| `create_widget` | Create UI node with Widget component. Params: nodeUuid (parent), alignment (top/bottom/left/right/center/stretch), margins |
| `create_label` | Create Label node. Params: text, fontSize, color, horizontalAlign, verticalAlign, overflow |
| `create_button` | Create Button node with child Label. Params: text, normalColor, hoverColor, pressedColor |
| `create_sprite` | Create Sprite node. Params: spriteFrameUuid, type (SIMPLE/SLICED/TILED/FILLED), sizeMode |
| `create_layout` | Create Layout container. Params: type (HORIZONTAL/VERTICAL/GRID), spacingX, spacingY, padding |
| `set_widget` | Set Widget alignment on existing node. Params: isAlignTop, top, isAlignBottom, bottom, etc. |
| `set_label_property` | Set Label properties (string, fontSize, color, lineHeight, overflow, font) |
| `set_sprite_property` | Set Sprite properties (spriteFrame, type, sizeMode, color, fillType) |
| `get_info` | Get UI component info on a node (Widget, Label, Sprite, Button, Layout) |
| `list_ui_nodes` | List all nodes with UI components in scene |
| `create_scrollview` | Create ScrollView with content node. Params: direction (vertical/horizontal/both) |
| `create_editbox` | Create EditBox. Params: placeholder, maxLength, inputMode, inputFlag |

**Scene methods needed**: `createUINode`, `setWidgetProperty`, `setUIComponentProperty`, `getUIInfo`, `listUINodes`

**Implementation notes**:
- UI nodes need Canvas parent — auto-detect or auto-create Canvas
- Widget component alignment uses boolean flags: `isAlignTop`, `isAlignBottom`, etc.
- Label overflow: `Label.Overflow.{NONE, CLAMP, SHRINK, RESIZE_HEIGHT}`
- **File may exceed 200 LOC** — split helpers into `manage-ui-helpers.ts` if needed
- Use `manage_component.add` pattern for adding UI components internally

---

### 4. manage_light (`source/tools/manage-light.ts`)

**Actions**: add, set_property, get_info, list, remove

| Action | Description |
|--------|-------------|
| `add` | Add light to node. Params: type (directional/sphere/spot/ranged_directional), color, intensity |
| `set_property` | Set light property (color, intensity, range, spotAngle, shadowEnabled, shadowBias) |
| `get_info` | Get light component info on node |
| `list` | List all lights in scene with types and properties |
| `remove` | Remove light component from node |

**Scene methods needed**: `addLightComponent`, `setLightProperty`, `getLightInfo`, `listLights`

**Implementation notes**:
- Light types: `DirectionalLight`, `SphereLight`, `SpotLight` (3D only)
- Color uses `cc.Color` — accept hex string or {r,g,b,a} object
- Shadow properties on light: `shadowEnabled`, `shadowPcf`, `shadowBias`, `shadowNormalBias`
- 2D projects don't have lights — return helpful error

---

### 5. batch_execute (`source/tools/batch-execute.ts`)

**Actions**: execute

| Action | Description |
|--------|-------------|
| `execute` | Execute multiple tool calls in sequence. Params: calls[] (array of {tool, action, args}), stopOnError (default true) |

**Implementation notes**:
- This tool is **server-level**, not scene-level — implemented in the tool handler itself
- Accepts array of `{tool: string, action: string, args: object}`
- Executes each via `MCPServer.executeToolCall()` — needs reference to server
- Returns array of results: `{index, tool, action, result: ActionToolResult}`
- If `stopOnError=true`, stops at first failure and returns partial results
- Max batch size: 50 calls (prevent abuse)
- **Special pattern**: Constructor receives MCPServer reference (unlike other tools that are standalone)

**Constructor pattern**:
```typescript
export class BatchExecute extends BaseActionTool {
    constructor(private server: { executeToolCall(name: string, args: any): Promise<any> }) {
        super();
    }
}
```

**Registration change**: `new BatchExecute({ executeToolCall: this.executeToolCall.bind(this) })`

---

## Related Code Files

### Files to Create
- `source/tools/manage-physics.ts`
- `source/tools/manage-camera.ts`
- `source/tools/manage-ui.ts`
- `source/tools/manage-ui-helpers.ts` (if manage-ui exceeds 200 LOC)
- `source/tools/manage-light.ts`
- `source/tools/batch-execute.ts`

### Files to Modify
- `source/mcp-server.ts` — Add imports and registration for 5 new tools
- `source/scene.ts` — Add scene methods for physics, camera, UI, light operations

## Implementation Steps

1. Create `manage-light.ts` (simplest, 5 actions, no special patterns)
2. Create `manage-camera.ts` (6 actions, scene methods needed)
3. Create `manage-physics.ts` (8 actions, 2D/3D detection needed)
4. Create `manage-ui.ts` + helpers (12 actions, most complex)
5. Create `batch-execute.ts` (special server reference pattern)
6. Add scene methods to `source/scene.ts` for physics/camera/UI/light
7. Register all 5 tools in `source/mcp-server.ts`
8. Run `npm run build` — verify zero compilation errors

## Todo List

- [ ] Implement manage_light (5 actions)
- [ ] Implement manage_camera (6 actions)
- [ ] Implement manage_physics (8 actions, 2D/3D aware)
- [ ] Implement manage_ui (12 actions) + helpers if needed
- [ ] Implement batch_execute (1 action, server reference)
- [ ] Add scene.ts methods for new tools
- [ ] Register all in mcp-server.ts initializeTools()
- [ ] Build and verify: `npm run build`
- [ ] Manually test with curl against running Cocos editor

## Success Criteria

- All 5 tools compile without errors
- `tools/list` returns 25 tools (20 existing + 5 new)
- batch_execute can chain 3+ tool calls in one request
- Each tool's action returns proper ActionToolResult

## Risk Assessment

| Risk | L | I | Score | Mitigation |
|------|---|---|-------|------------|
| Physics API not fully available at edit-time | 3 | 3 | 9 | Component property setting still works; raycast may need runtime |
| manage_ui exceeds 200 LOC | 4 | 2 | 8 | Pre-planned helper module split |
| batch_execute circular dependency with MCPServer | 2 | 4 | 8 | Interface-based injection, not direct import |
| Canvas auto-creation for UI nodes may conflict | 2 | 3 | 6 | Check existing Canvas first, create only if missing |
