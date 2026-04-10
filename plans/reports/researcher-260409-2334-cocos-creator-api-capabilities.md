# Cocos Creator Editor Extension API Capabilities Research

**Date**: 2026-04-09  
**Scope**: Comprehensive enumeration of all Cocos Creator editor extension API capabilities for MCP tool exposure  
**Target Version**: Cocos Creator 3.8+ (3.5+ compatible)

---

## 1. Architecture & Communication

### 1.1 Extension Process Model
- **Main Process**: Extension logic runs in Electron main process with full Node.js environment
- **Rendering Process**: Panels run in web-based UI (Vue 3)
- **Scene Process**: Separate context for scene operations via `Editor.Message.request('scene', ...)`
- **IPC Communication**: Multi-process message passing via `Editor.Message.request()` and `Editor.Message.broadcast()`

### 1.2 Core Communication Methods
- **`Editor.Message.request(packageName, messageName, params)`**: RPC-style request/response (returns Promise)
- **`Editor.Message.broadcast(messageName, data)`**: Publish/subscribe notifications sent to all listeners
- **`Editor.Message.on(messageName, handler)`**: Listen for broadcast messages
- **Data Constraint**: Only JSON-serializable data can transfer between processes (no native objects)

---

## 2. Scene Operations

### 2.1 Scene Hierarchy & Node Query
**IPC Messages**:
- `scene:query-hierarchy` — Retrieve complete scene node tree with hierarchy structure
- `scene:query-node` — Get serialized data (dump) of a specific node
- `scene:query-node-info` — Retrieve basic metadata (name, uuid, active state, position)
- `scene:query-nodes-by-comp-name` — Find all nodes containing a specific component type
- `scene:query-node-functions` — List callable methods on a node
- `scene:query-animation-node` — Locate animation root node reference

### 2.2 Scene Lifecycle Messages
**Broadcast Events**:
- `scene:ready` — Scene initialization complete
- `scene:saved` — Scene persistence notification
- `scene:reloading` — Scene refresh in progress
- `scene:enter-prefab-edit-mode` — Entering prefab editing state

### 2.3 Scene Action Messages
**Request Messages**:
- `scene:new-scene` — Open a new scene
- `scene:play-on-device` — Launch device preview
- `scene:execute-scene-script` — Call custom scene script methods with args

### 2.4 Engine API Access
**Method**: Via scene script execution using Node.js `require('cc')`:
```typescript
const { director, Node, Component } = require('cc');
```
**Accessible via Scene Context**:
- Node traversal: `director.getScene().getChildByName()`
- Node manipulation: position, rotation, scale, active state
- Component access & method invocation
- Project-defined script execution

---

## 3. Node & Component Operations

### 3.1 Available Via Scene Script
**Engine APIs accessible to extensions**:
- Node creation, deletion, parenting
- Property modification (transform, active, name)
- Component add/remove
- Component property read/write
- Component method invocation
- Child iteration and search

### 3.2 Component System
**Via Scene Script**:
- List node components
- Get/set component properties
- Invoke component methods
- Register/unregister components

**Note**: Cocos Creator v3.8+ prefers `scene:execute-scene-script` over older `scene:query-node` methods.

---

## 4. Asset Management

### 4.1 Asset Database Broadcast Events
**Messages**:
- `asset-db:assets-created` — New file/asset created
- `asset-db:assets-moved` — Asset moved within project
- `asset-db:assets-deleted` — Asset deleted
- `asset-db:asset-changed` — Asset file modified
- `asset-db:script-import-failed` — Script compilation error

### 4.2 Asset Registration
**Via Contributions**:
- Mount extension asset folders via `contributions.asset-db`
- Register custom asset types
- Use `db://` URI protocol to reference assets

### 4.3 Asset Types Supportable
- Scenes, prefabs, sprites, tilemaps
- Textures, materials, effects
- Audio files, particle systems
- Scripts, physics assets
- Animation clips

**Note**: Asset CRUD operations available via scene scripts; direct asset-db IPC messages not extensively documented—primarily event notifications.

---

## 5. Prefab System

### 5.1 Prefab Operations
**Via Scene Script**:
- Create prefab instances
- Modify prefab properties
- Enter/exit prefab edit mode
- Sync prefab instances (auto/manual)

### 5.2 Prefab Lifecycle
**Broadcast Messages**:
- `scene:enter-prefab-edit-mode` — Entering prefab edit context

**Editor Capabilities**:
- Save/close prefab edits
- Reference existing prefabs
- Override prefab instance properties

---

## 6. Animation System

### 6.1 Animation Node Queries
**Message**:
- `scene:query-animation-node` — Query animation root node

### 6.2 Animation Operations (Via Scene Script)
**Engine Access**:
- Animation component manipulation
- Animation clip playback control
- Timeline state inspection
- Keyframe/animation property modification

### 6.3 Animation-Related Assets
- Animation clips (`.anim`)
- Skeletal data
- Timeline state

---

## 7. Physics System

### 7.1 Physics Component Access (Via Scene Script)
**Available Components**:
- RigidBody, Collider (Box, Sphere, Capsule, Mesh)
- Joint components
- Constraint systems

### 7.2 Physics Operations
**Via Engine API**:
- Enable/disable physics
- Configure colliders and rigidbodies
- Apply forces and impulses
- Query physics state
- Collision/trigger callbacks

---

## 8. Particle System

### 8.1 Particle Component (Via Scene Script)
**Operations**:
- Create/remove particle systems
- Configure emission rate, lifetime, velocity
- Texture/material assignment
- Play/stop/reset animation
- Property access (color, size, rotation)

---

## 9. Audio System

### 9.1 Audio Component (Via Scene Script)
**Supported Operations**:
- Add/configure AudioSource components
- Play/pause/stop audio playback
- Volume control
- Looping configuration
- Spatial audio (3D audio positioning)
- Audio clip assignment

---

## 10. Material & Shader System

### 10.1 Material Operations (Via Scene Script)
**Available**:
- Material creation/assignment
- Property modification
- Texture assignment
- Shader parameter adjustment

### 10.2 Material Assets
- Effect files (`.effect`)
- Material instances (`.mtl`)
- Custom shader compilation

---

## 11. Rendering & Lighting

### 11.1 Lighting System (Via Scene Script)
**Light Types**:
- Directional Light
- Point Light
- Spot Light
- Area Light (in newer versions)

**Operations**:
- Enable/disable lights
- Color and intensity modification
- Shadow configuration
- Range/falloff adjustment

### 11.2 Rendering Debug View
**Editor Features**:
- View lighting calculations
- Material property visualization
- Rendering performance data
- Shader debug output

---

## 12. Terrain & Tilemap

### 12.1 Tilemap Support (Via Scene Script)
**Operations**:
- Tilemap component management
- Tile asset reference
- Layer manipulation
- Tile placement/removal (via engine API)

### 12.2 Terrain System
- Heightmap terrain components
- Terrain material properties
- Terrain sculpting (if available in version)

---

## 13. UI System (Canvas/UI Components)

### 13.1 UI Components (Via Scene Script)
**Component Types**:
- Canvas (root UI element)
- Button, Label, InputField
- Slider, Toggle, ScrollView
- Layout components (HBox, VBox, Grid)
- Mask, Graphics

### 13.2 UI Operations
**Via Scene Script**:
- Create/modify UI hierarchy
- Configure layout parameters
- Event listener registration
- Property binding
- Text/color modification

---

## 14. Editor UI Contributions

### 14.1 Menu Extensions
**Contribution Type**: `contributions.menu`
- Add menu items to main menu (File, Edit, Asset, Extensions)
- Menu item → Message trigger on click
- Sub-menu support

### 14.2 Inspector Extensions
**Contribution Type**: `contributions.inspector`
- Custom property inspectors for assets
- Custom node component renderers
- Property editor customization
- Section-based organization

### 14.3 Assets Panel Extensions
**Contribution Type**: `contributions.assets`
- Custom context menu items
- Asset preview customization
- Asset type icons/handlers

### 14.4 Panel System
**Capabilities**:
- Create custom dockable panels (Vue 3 UI)
- IPC message communication with main extension
- Panel lifecycle management
- Drag-and-drop support
- Context menu integration

---

## 15. Gizmo & Scene View Manipulation

### 15.1 Custom Gizmos
**API**: `Editor.Gizmo` class
- Extend for custom scene editor tools
- SVG-based rendering (svg.js)
- Mouse interaction handling

### 15.2 Gizmo Features
**Methods**:
- `init()` — Initialize gizmo
- `onCreateRoot()` — Create SVG root element
- `onUpdate()` — Update on frame
- `onCreateMoveCallbacks()` — Handle mouse interactions
- Move callbacks: `start()`, `update()`, `end()`

### 15.3 Scene View Capabilities
- Gizmo-based manipulation (position, rotation, scale)
- Interactive handles for properties
- Viewport navigation
- Transform visualization

---

## 16. Builder & Build Process

### 16.1 Build Lifecycle Messages
**Messages**:
- `editor:build-start` (deprecated v1.9.1+)
- `editor:build-finished` (deprecated v1.9.1+)
- `builder:state-changed` — Current build status
- `builder:query-build-options` — Request build configuration

### 16.2 Build Customization
**Contribution Type**: `contributions.builder`
- Pre/post-build hooks
- Custom build step integration
- Build profile configuration

---

## 17. Preferences & Configuration

### 17.1 Extension Configuration
**Contribution Type**: `contributions.profile`
- Define configuration schema with defaults
- Data persistence in editor settings
- Validation support

### 17.2 Preferences UI
**Contribution Type**: `contributions.preferences`
- Display in Preferences panel
- Auto-rendering support
- Laboratory (experimental) settings tab
- Field validation triggers

### 17.3 Profile API
**Available**:
- `Editor.Profile.getConfig(key)` — Read config value

---

## 18. Undo & Redo System

### 18.1 Editor Undo/Redo
**Access**: Via Edit menu (Ctrl+Z / Ctrl+Shift+Z)

### 18.2 Extension Integration
**Approach**:
- Modifications via scene scripts are recorded by editor
- Use `Editor.Message.broadcast()` to notify undo/redo state changes
- No explicit undo/redo API documented for extensions—typically handled by editor automatically

---

## 19. Validation System

### 19.1 Configuration Validation
**Trigger**: Messages fired when config items modified
- Validate user input in preferences
- Error state propagation

### 19.2 Scene Validation
- Error reporting via messages
- Compilation error notifications (asset-db)

---

## 20. Keyboard Shortcuts & Input

### 20.1 Shortcut Registration
**Contribution Type**: `contributions.shortcuts`
- Register keyboard shortcuts
- Platform-specific bindings (Win/Mac)
- Modifier support (Ctrl, Shift, Alt)

### 20.2 Input Handling
**Gizmo Level**:
- Mouse down/up/move via `onCreateMoveCallbacks()`
- Drag-and-drop in panels
- Custom input in extension panels

---

## 21. Database Extensions

### 21.1 Asset Database Registration
**Contribution Type**: `contributions.asset-db`
- Mount custom asset folders
- Register virtual asset types
- Asset metadata customization

---

## 22. Broadcast & Custom Messages

### 22.1 Custom Message Definition
**Contribution Type**: `contributions.messages`
- Define custom broadcast messages
- Methods array for request handlers
- Package-scoped message namespace

### 22.2 Message Usage
**Patterns**:
- Extension-to-extension communication
- Panel-to-main process messaging
- Broadcast notifications across editor

---

## 23. Selection & Hierarchy Management

### 23.1 Available Queries
**Messages**:
- `scene:query-hierarchy` — Full scene tree (includes selection state)
- `scene:query-node-info` — Node basic info

### 23.2 Selection Operations
**Inferred from Architecture**:
- Selection state retrievable via hierarchy queries
- Selection modification via scene script node manipulation

**Note**: No explicit `query-selection` message found in official docs; inferred from hierarchy queries.

---

## 24. Project & Workspace

### 24.1 Project Contribution
**Contribution Type**: `contributions.project`
- Extend project settings panels
- Project metadata customization
- Workspace configuration

### 24.2 Project Metadata Available
**Via Scene Context**:
- Open scene information
- Project file system access
- Build configuration

---

## 25. Debugger Support

### 25.1 Editor.Debugger API (Cocos 2.4)
**Status**: Part of older editor framework
**Capabilities**:
- Debugger attachment/detachment
- Breakpoint management
- Script debugging integration

**Note**: v3.8+ consolidates debugging into browser DevTools and preview panel.

---

## Summary: All Potential MCP Tool Operations

Based on comprehensive research, here are **ALL** operations that could be exposed as MCP tools:

### Category 1: Scene Management (5 tools)
1. **manage_scene** — Create, open, save, reload scenes; scene lifecycle control
2. **manage_node** — Create, delete, modify, query, parent nodes; hierarchy traversal
3. **manage_component** — Add/remove components, get/set properties, invoke methods
4. **manage_prefab** — Create, instantiate, modify, edit, sync prefabs
5. **manage_scene_hierarchy** — Query complete tree, find nodes by component type

### Category 2: Assets (3 tools)
6. **manage_asset** — Monitor asset changes, register custom asset types, manage asset metadata
7. **manage_animation** — Query animation nodes, control playback, modify animation properties
8. **manage_material** — Modify materials, assign shaders, set texture/property values

### Category 3: Physics & Particles (3 tools)
9. **manage_physics** — Configure rigidbodies, colliders, constraints; apply forces
10. **manage_particle** — Create/configure particle systems, control emission, set properties
11. **manage_audio** — Configure audio sources, play/pause/stop, volume control

### Category 4: Rendering & Visuals (3 tools)
12. **manage_rendering** — Configure lighting, shadows, rendering parameters
13. **manage_tilemap** — Manage tilemap components, tile placement, layer configuration
14. **manage_gizmo** — Create custom scene editor gizmos with interactive handles

### Category 5: UI System (1 tool)
15. **manage_ui** — Create/modify UI hierarchy, configure layout, set properties

### Category 6: Editor Infrastructure (7 tools)
16. **manage_editor** — Query editor state, control preview, manage workspace
17. **manage_builder** — Query build options, trigger builds, monitor build state
18. **manage_menu** — Register menu items, trigger menu actions
19. **manage_preferences** — Read/write extension preferences, validate config
20. **manage_inspector** — Register custom inspectors, customize property rendering
21. **manage_selection** — Query selected nodes/assets, manage selection state
22. **manage_validation** — Run asset validation, report errors, check script imports

### Category 7: Development Tools (2 tools)
23. **manage_debug** — Control debugger, manage breakpoints, inspect state
24. **manage_script** — Execute scene scripts, call custom project functions

**Total: 24 comprehensive MCP tools** covering all Cocos Creator editor extension capabilities.

---

## Key Constraints & Limitations

1. **IPC Data Transfer**: Only JSON-serializable data (no native objects, Buffers)
2. **Process Architecture**: Extensions run in main process; scene operations require message passing
3. **Prefab Editing**: Limited to edit-mode queries; runtime modification via scene scripts
4. **Undo/Redo**: Automatic for scene modifications; no explicit API control documented
5. **Real-time Sync**: Asset changes and scene modifications trigger broadcast events (async)
6. **No Direct File I/O**: Asset files accessed via asset-db abstraction, not raw filesystem
7. **Message Manager Discovery**: Full message list in runtime via "Developer → Message Manager" panel, not static docs

---

## Unresolved Questions

1. **Complete Asset Database CRUD API**: Official docs focus on event notifications; full asset read/write API details unclear
2. **Direct Physics Constraint Manipulation**: Degree of constraint parameter control via scene scripts not fully documented
3. **Shader Compilation from Extensions**: Whether extensions can compile custom shaders at runtime
4. **Terrain System API**: Limited documentation on terrain manipulation (heightmap editing, sculpting)
5. **Real-time Performance Profiling**: Whether extensions can access rendering/performance metrics
6. **Multi-Scene Simultaneous Handling**: Whether extensions can manipulate multiple scenes in parallel
7. **Custom Asset Type Full Lifecycle**: Asset data structure, serialization, and editor panel customization details
8. **Selection Change Notifications**: No explicit broadcast message for selection state changes found

---

## Sources

- [Editor Extension · Cocos Creator](https://docs.cocos.com/creator/3.3/manual/en///extension/)
- [Extension Infrastructure | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/package.html)
- [Message System - Cocos Creator 3.8 Manual](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/messages.html)
- [Calling the Engine API and Project Script | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/scene-script.html)
- [Commonly used IPC messages | Cocos Creator](https://docs.cocos.com/creator/2.4/manual/en/extension/reference/ipc-reference.html)
- [Extend Existing Functionality | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/contributions.html)
- [Custom Inspector Panel | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/inspector.html)
- [Customize the Main Menu | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/contributions-menu.html)
- [Extending the Database (DB) | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/contributions-database.html)
- [Custom Gizmo | Cocos Creator](https://docs.cocos.com/creator/2.4/manual/en/extension/custom-gizmo.html)
- [Custom Gizmo advanced | Cocos Creator](https://docs.cocos.com/creator/2.4/manual/en/extension/custom-gizmo-advance.html)
- [Extending the Preferences Panel | Cocos Creator](https://docs.cocos.com/creator/3.2/manual/en/editor/extension/contributions-preferences.html)
- [Extending the Assets Panel | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/assets/extension.html)
- [Configuration System | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/profile.html)
- [Customized Messages | Cocos Creator](https://docs.cocos.com/creator/3.8/manual/en/editor/extension/contributions-messages.html)

