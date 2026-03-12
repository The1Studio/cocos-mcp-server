# API Reference (v2.0)

Complete reference for all 21 action-based tools and MCP protocol endpoints.

## Quick Summary

| Tool | Purpose | Key Actions |
|------|---------|-------------|
| **manage_scene** | Scene operations | open, save, query, getOpenScene |
| **manage_node** | Create/update/delete nodes | create, update, delete, query, setParent |
| **manage_component** | Manage components | add, remove, update, query, setProperties |
| **manage_prefab** | Prefab operations | create, instantiate, save, query, applyChanges |
| **manage_asset** | Asset management | import, delete, move, query, reference |
| **manage_project** | Project settings | getInfo, updateSettings, build, getScenes |
| **manage_debug** | Debugging & logging | getConsoleLog, getPerformance, clearConsole, log |
| **manage_preferences** | Editor preferences | get, set, save, getAll |
| **manage_server** | Server control | start, stop, getStatus, setPort |
| **manage_broadcast** | Event broadcasting | broadcast, subscribe, unsubscribe |
| **manage_scene_view** | Viewport & camera | setCamera, getCamera, setGizmo, captureScreenshot |
| **manage_node_hierarchy** | Parent-child ops | getParent, getChildren, setParent, getDepth |
| **manage_scene_query** | Advanced queries | findNodesByName, findByComponent, queryProperties |
| **manage_undo** | Undo/redo control | undo, redo, clearStack, getStack |
| **manage_reference_image** | Reference overlays | add, remove, update, list |
| **manage_validation** | Scene/asset validation | validate, checkReferences, checkMaterials |
| **manage_selection** | Node selection | select, deselect, getSelected, clearSelection |
| **manage_script** | Script operations | compile, reload, getScripts, getRuntimeError |
| **manage_material** | Material management | create, update, delete, applyToNode |
| **manage_animation** | Animation control | playClip, stopClip, getClips, setSpeed |

## MCP Protocol

### Endpoints

**Base URL**: `http://127.0.0.1:3000` (default, configurable)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | POST | JSON-RPC 2.0 MCP protocol (primary) |
| `/health` | GET | Server status check |
| `/api/tools` | GET | List tools (REST alternative) |
| `/api/{tool}` | POST | Execute tool (REST alternative) |

### JSON-RPC 2.0 Methods

#### `initialize`

Handshake with server, negotiate protocol version and capabilities.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": {}
    }
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": {}
    }
  }
}
```

#### `tools/list`

List all available tools with input schemas.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "manage_node",
        "description": "Create, update, delete, and query scene nodes",
        "inputSchema": {
          "type": "object",
          "properties": {
            "action": {
              "type": "string",
              "enum": ["create", "update", "delete", "query", "setParent"]
            },
            "uuid": { "type": "string" },
            "name": { "type": "string" },
            "parentUuid": { "type": "string" }
          },
          "required": ["action"]
        }
      }
    ]
  }
}
```

#### `tools/call`

Execute a tool action.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "manage_node",
    "arguments": {
      "action": "create",
      "parentUuid": "root",
      "name": "MyNode"
    }
  }
}
```

**Response** (success):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "type": "tool_result",
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"data\":{\"uuid\":\"abc-123\",\"name\":\"MyNode\"},\"message\":\"Node created successfully\"}"
      }
    ]
  }
}
```

**Response** (error):
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "type": "tool_result",
    "content": [
      {
        "type": "text",
        "text": "{\"success\":false,\"error\":\"parentUuid is required\",\"isError\":true}"
      }
    ],
    "isError": true
  }
}
```

#### `resources/list`

List all available read-only resource URIs.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/list"
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resources": [
      {
        "uri": "cocos://editor/state",
        "name": "Editor State",
        "description": "Current editor state: open scene, version, project info",
        "mimeType": "application/json"
      },
      {
        "uri": "cocos://scene/hierarchy",
        "name": "Scene Hierarchy",
        "description": "Complete node tree of current scene with components",
        "mimeType": "application/json"
      }
    ]
  }
}
```

#### `resources/read`

Read resource content by URI.

**Request**:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "resources/read",
  "params": {
    "uri": "cocos://scene/hierarchy"
  }
}
```

**Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "contents": [
      {
        "uri": "cocos://scene/hierarchy",
        "mimeType": "application/json",
        "text": "{\"uuid\":\"scene-1\",\"name\":\"Scene\",\"children\":[...]}"
      }
    ]
  }
}
```

## Resource URIs

### `cocos://editor/state`

Current editor state and project information.

**Content**:
```json
{
  "versions": {
    "cocos": "3.8.6"
  },
  "project": {
    "name": "MyGame",
    "path": "/path/to/project",
    "uuid": "project-uuid"
  },
  "scene": {
    "open": true,
    "name": "MainScene",
    "uuid": "scene-uuid",
    "type": "Scene",
    "dirty": false,
    "ready": true
  }
}
```

### `cocos://scene/hierarchy`

Complete node tree with hierarchy and components.

**Content**:
```json
{
  "uuid": "scene-uuid",
  "name": "MainScene",
  "type": "Node",
  "active": true,
  "children": [
    {
      "uuid": "node-1",
      "name": "Player",
      "type": "Node",
      "active": true,
      "position": { "x": 0, "y": 0, "z": 0 },
      "components": [
        { "type": "cc.Sprite", "enabled": true },
        { "type": "cc.RigidBody", "enabled": true }
      ],
      "children": []
    }
  ]
}
```

### `cocos://project/info`

Project metadata and available scenes.

**Content**:
```json
{
  "name": "MyGame",
  "path": "/path/to/project",
  "uuid": "project-uuid",
  "version": "1.0.0",
  "cocosVersion": "3.8.6",
  "scenes": [
    { "name": "MainScene", "uuid": "...", "path": "assets/scenes/main.scene" },
    { "name": "MenuScene", "uuid": "...", "path": "assets/scenes/menu.scene" }
  ]
}
```

### `cocos://scene/components`

All registered component types in the project.

**Content**:
```json
{
  "components": [
    { "name": "cc.Node", "description": "Scene node" },
    { "name": "cc.Sprite", "description": "2D sprite renderer" },
    { "name": "cc.RigidBody", "description": "Physics body" },
    { "name": "cc.Collider", "description": "Collision component" },
    { "name": "cc.Animation", "description": "Animation controller" }
  ]
}
```

## Tool Details

### manage_node

Create, update, delete, and query scene nodes.

**Actions**:
- `create` — Create new node
- `update` — Update node properties
- `delete` — Delete node and children
- `query` — Get node properties
- `setParent` — Change parent node

**Example: Create Node**:
```json
{
  "action": "create",
  "parentUuid": "root",
  "name": "NewNode",
  "position": { "x": 100, "y": 100, "z": 0 }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "uuid": "node-abc123",
    "name": "NewNode",
    "parentUuid": "root"
  }
}
```

### manage_component

Add, remove, and configure components.

**Actions**:
- `add` — Add component to node
- `remove` — Remove component from node
- `update` — Update component properties
- `query` — Get component info
- `setProperties` — Batch update properties

**Example: Add Sprite Component**:
```json
{
  "action": "add",
  "nodeUuid": "node-abc123",
  "componentType": "cc.Sprite",
  "properties": {
    "sizeMode": 0
  }
}
```

### manage_prefab

Create, save, and instantiate prefabs.

**Actions**:
- `create` — Create prefab from node
- `instantiate` — Create instance from prefab
- `save` — Save prefab to disk
- `query` — Get prefab info
- `applyChanges` — Apply overrides to prefab

**Example: Instantiate Prefab**:
```json
{
  "action": "instantiate",
  "prefabUuid": "prefab-uuid",
  "parentUuid": "root",
  "name": "PlayerInstance"
}
```

### manage_scene

Open, save, and query scenes.

**Actions**:
- `open` — Open scene file
- `save` — Save current scene
- `query` — Get scene info
- `getOpenScene` — Get currently open scene
- `close` — Close scene without saving

**Example: Open Scene**:
```json
{
  "action": "open",
  "scenePath": "assets/scenes/main.scene"
}
```

### manage_asset

Import, delete, and reference assets.

**Actions**:
- `import` — Import asset file
- `delete` — Delete asset
- `move` — Move/rename asset
- `query` — Get asset info
- `reference` — Get asset references

**Example: Query Asset**:
```json
{
  "action": "query",
  "assetUuid": "asset-uuid"
}
```

## Error Handling

All tool responses follow a consistent error format:

**Error Response**:
```json
{
  "success": false,
  "error": "Description of what went wrong",
  "isError": true,
  "instruction": "Optional guidance on how to fix or retry"
}
```

**Common Errors**:
- `Missing required parameter 'action'` — Action parameter not provided
- `Unknown action 'actionName'` — Action doesn't exist for this tool
- `{param} is required` — Required parameter missing
- `Invalid {param} value` — Parameter value is invalid
- `Node not found` — UUID doesn't reference a valid node
- `Component already exists` — Cannot add duplicate component
- `File not found` — Asset or scene file doesn't exist

## REST API Alternative

For clients that don't support JSON-RPC, use the REST API.

**List Tools**:
```bash
GET http://127.0.0.1:3000/api/tools
```

**Execute Tool**:
```bash
POST http://127.0.0.1:3000/api/manage_node
Content-Type: application/json

{
  "action": "create",
  "parentUuid": "root",
  "name": "NewNode"
}
```

**Health Check**:
```bash
GET http://127.0.0.1:3000/health
```

## Response Format

All tool responses are `ActionToolResult`:

```typescript
interface ActionToolResult {
  success: boolean;              // true if action succeeded
  data?: any;                    // Action result data
  message?: string;              // Success message
  error?: string;                // Error message (if failed)
  instruction?: string;          // Guidance for LLM or user
  isError?: boolean;             // Flag for MCP error responses
}
```

## Common Patterns

### Query Node Info

```json
{
  "method": "tools/call",
  "params": {
    "name": "manage_node",
    "arguments": {
      "action": "query",
      "uuid": "node-uuid"
    }
  }
}
```

### Create Node with Component

Step 1: Create node
```json
{"action": "create", "parentUuid": "root", "name": "Player"}
```

Step 2: Add component
```json
{"action": "add", "nodeUuid": "returned-uuid", "componentType": "cc.Sprite"}
```

### Update Multiple Properties

```json
{
  "action": "setProperties",
  "nodeUuid": "node-uuid",
  "properties": {
    "position": { "x": 100, "y": 100, "z": 0 },
    "active": true
  }
}
```

### Validate Scene

```json
{
  "method": "tools/call",
  "params": {
    "name": "manage_validation",
    "arguments": {
      "action": "validate",
      "scope": "scene"
    }
  }
}
```

## Rate Limiting

No explicit rate limiting. Server supports up to 10 concurrent connections (configurable via `settings/mcp-server.json`).

## Timeouts

- Default tool execution timeout: 30 seconds
- Resource read timeout: 5 seconds
- Connection timeout: 60 seconds

## Version Compatibility

**MCP Protocol**: v2.0.0 (2024-11-05)
**Cocos Creator**: 3.5.0+
**Node.js**: 14+ (bundled with Cocos Creator)

## Support

For issues or questions:
- Check error messages for debugging hints
- Enable debug logging in MCP Server settings
- Review `/docs/system-architecture.md` for architectural details
- Check tool-specific documentation in this file
