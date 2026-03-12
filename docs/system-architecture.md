# System Architecture (v2.0)

Cocos MCP Server v2.0 uses a **flat action-based tool system** replacing the old category-prefix routing. This document describes the complete architecture.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│          Cocos Creator Editor Extension                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Extension Lifecycle (main.ts)               │   │
│  │  - Load/unload hooks                                │   │
│  │  - IPC method registry                              │   │
│  │  - Panel initialization                             │   │
│  └──────────────────┬──────────────────────────────────┘   │
│                     │                                        │
│    ┌────────────────┴────────────────┐                      │
│    ▼                                  ▼                      │
│  ┌──────────────────┐      ┌──────────────────┐             │
│  │ Tool Manager     │      │ MCP Server       │             │
│  │ (config mgmt)    │      │ (HTTP server)    │             │
│  └──────────────────┘      └────────┬─────────┘             │
│                                      │                       │
│                    ┌─────────────────┼─────────────────┐     │
│                    ▼                 ▼                 ▼     │
│              ┌──────────┐  ┌──────────────┐  ┌─────────────┐
│              │  /mcp    │  │ /health      │  │ /api/*      │
│              │ (primary)│  │ (status)     │  │ (REST alt)  │
│              └────┬─────┘  └──────────────┘  └─────────────┘
│                   │
│    ┌──────────────┼──────────────┐
│    ▼              ▼              ▼
│ tools/list  tools/call   resources/*
│
│  ┌────────────────────────────────────────────────────┐
│  │  Action Tool Executors (21 total)                  │
│  │                                                    │
│  │  manage_scene        │  manage_selection           │
│  │  manage_node         │  manage_script              │
│  │  manage_component    │  manage_material            │
│  │  manage_prefab       │  manage_animation           │
│  │  manage_asset        │  manage_undo                │
│  │  manage_project      │  manage_reference_image     │
│  │  manage_debug        │  manage_validation          │
│  │  manage_preferences  │  manage_scene_view          │
│  │  manage_server       │  manage_node_hierarchy      │
│  │  manage_broadcast    │  manage_scene_query         │
│  │                      │                             │
│  │  All extend BaseActionTool                         │
│  └────────────────────────────────────────────────────┘
│
│  ┌────────────────────────────────────────────────────┐
│  │  Resources (Read-only Editor State URIs)           │
│  │                                                    │
│  │  cocos://editor/state       cocos://project/info  │
│  │  cocos://scene/hierarchy    cocos://scene/components
│  └────────────────────────────────────────────────────┘
│
│  ┌────────────────────────────────────────────────────┐
│  │  Scene Context (separate process)                 │
│  │  - Direct scene node tree access                  │
│  │  - Component property manipulation                │
│  └────────────────────────────────────────────────────┘
│
└──────────────────────────────────────────────────────────┘
                        │
                        │ JSON-RPC 2.0
                        ▼
        ┌───────────────────────────────┐
        │   AI Assistant / MCP Client   │
        │  (Claude, etc.)               │
        └───────────────────────────────┘
```

## Key Components

### 1. Extension Entry Point (`source/main.ts`)

- Registered as Cocos Creator extension
- **Load phase**: Initializes `ToolManager`, creates `MCPServer`, optionally auto-starts based on settings
- **Unload phase**: Stops server, cleans up resources
- **IPC Methods**: Exports methods for panel ↔ main process communication

### 2. MCP Server (`source/mcp-server.ts`)

HTTP server handling JSON-RPC 2.0 requests.

**Architecture**:
- Maintains `Map<string, ActionToolExecutor>` of all tools
- Maintains `ToolDefinition[]` for MCP `/tools/list` responses
- Maintains `enabledTools: string[]` filter for selective tool exposure
- Provides `CocosResources` for read-only resource URIs

**Request Flow**:
```
HTTP Request
    ▼
Parse URL + body
    ▼
Route by pathname:
  /mcp        → JSON-RPC handler
  /health     → Status response
  /api/*      → REST handler
  /resources  → Resource handler
    ▼
For /mcp requests:
  Parse message (with JSON fix fallback)
    ▼
  Dispatch by method:
    - initialize    → Handshake response
    - tools/list    → Return enabled tools
    - tools/call    → Execute tool action
    - resources/list   → List resource URIs
    - resources/read   → Read resource content
    ▼
Response
```

### 3. Tool System (Action-based, v2.0)

**Base Class**: `BaseActionTool` (`source/tools/base-action-tool.ts`)

```typescript
abstract class BaseActionTool implements ActionToolExecutor {
  abstract readonly name: string;           // e.g., "manage_node"
  abstract readonly description: string;    // For LLM
  abstract readonly inputSchema: object;    // JSON Schema with action enum
  abstract readonly actions: string[];      // List of supported actions

  protected abstract actionHandlers: Record<string, handler>;

  async execute(action: string, args: Record<string, any>): Promise<ActionToolResult> {
    // Find handler by action name
    // Call handler with args
    // Catch errors and return ActionToolResult
  }
}
```

**Example Implementation** (`manage-node.ts`):
```typescript
class ManageNode extends BaseActionTool {
  readonly name = "manage_node";
  readonly description = "Create, update, query, and delete scene nodes";
  readonly actions = ["create", "update", "delete", "query", "setParent", "..."];
  readonly inputSchema = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["create", "update", ...] },
      // ... action-specific params
    },
    required: ["action"]
  };

  protected actionHandlers = {
    create: async (args) => { ... },
    update: async (args) => { ... },
    delete: async (args) => { ... },
    // ...
  };
}
```

**21 Tools in v2.0**:

| Tool | Purpose |
|------|---------|
| `manage_scene` | Scene operations (open, save, query) |
| `manage_node` | Create/update/delete nodes |
| `manage_component` | Component lifecycle and properties |
| `manage_prefab` | Prefab operations (create, instantiate, save) |
| `manage_asset` | Asset import, organization, reference |
| `manage_project` | Project settings, info, build |
| `manage_debug` | Performance, console, logging |
| `manage_preferences` | Editor preferences, settings |
| `manage_server` | Server control (start, stop, status) |
| `manage_broadcast` | Event broadcasting to all clients |
| `manage_scene_view` | Camera, viewport, gizmos |
| `manage_node_hierarchy` | Parent-child relationships, tree ops |
| `manage_scene_query` | Find nodes, query properties |
| `manage_undo` | Undo/redo stack control |
| `manage_reference_image` | Reference image overlays |
| `manage_validation` | Scene/asset validation |
| `manage_selection` | Node selection operations |
| `manage_script` | Script compilation, runtime control |
| `manage_material` | Material creation and modification |
| `manage_animation` | Animation clip and state management |

### 4. Resources (Read-only URIs)

`source/resources/cocos-resources.ts` implements MCP resource URIs for read-only editor state snapshots.

**Available Resources**:

1. **`cocos://editor/state`** — Current editor state
   - Editor versions, project info
   - Open scene name/UUID
   - Scene dirty/ready flags

2. **`cocos://scene/hierarchy`** — Complete node tree
   - All nodes with UUIDs, names, active state
   - Component types per node
   - Parent-child relationships

3. **`cocos://project/info`** — Project metadata
   - Name, path, UUID, Cocos version
   - Available scenes
   - Project-level settings

4. **`cocos://scene/components`** — Registered component types
   - All available component classes
   - Component properties and defaults

### 5. Scene Extension (`source/scene.ts`)

Runs in the scene subprocess context (separate Node.js process). Tools request scene operations via `Editor.Message.request('scene', methodName)`.

**Methods** (examples):
- `query-node-tree` — Get complete node hierarchy
- `query-node` — Get single node info
- `create-node` — Create new node in scene
- `set-node-property` — Modify node properties
- `add-component` — Add component to node
- `get-components` — Query node components

### 6. Tool Manager (`source/tools/tool-manager.ts`)

Manages named tool configurations for selective tool exposure.

**Features**:
- Load/save configurations to `settings/tool-manager.json`
- Support up to 5 named configurations
- Import/export configurations
- Activate/deactivate tools per configuration
- V2: Uses flat tool names (no category prefix)

### 7. Settings (`source/settings.ts`)

Persistent configuration in Cocos project's `settings/` directory.

**Files**:
- `settings/mcp-server.json` — port, autoStart, enableDebugLog, allowedOrigins, maxConnections
- `settings/tool-manager.json` — tool configurations and activation state

### 8. UI Panels (`source/panels/`)

Two Vue 3 panels for extension control:
- **default** — Server status, start/stop, port/settings configuration
- **tool-manager** — Enable/disable tools, manage configurations

HTML/CSS in `static/`. All text in English with Chinese translation files.

## Data Flow Examples

### Example 1: Create a Scene Node

```
MCP Client
    │
    ├─ tools/call
    │   {
    │     "name": "manage_node",
    │     "arguments": {
    │       "action": "create",
    │       "parentUuid": "abc123",
    │       "name": "NewNode",
    │       "position": { "x": 0, "y": 0, "z": 0 }
    │     }
    │   }
    │
    ▼
MCPServer.handleMCPRequest()
    │
    ├─ Parse message
    ├─ Check method = "tools/call"
    │
    ▼
MCPServer.executeToolCall("manage_node", { action, parentUuid, name, position })
    │
    ▼
toolExecutors.get("manage_node") → ManageNode instance
    │
    ├─ extract action = "create"
    │
    ▼
ManageNode.execute("create", { parentUuid, name, position })
    │
    ├─ Call actionHandlers["create"](args)
    │
    ▼
Create handler implementation
    │
    ├─ Calls Editor.Message.request('scene', 'create-node', args)
    │
    ▼
Scene subprocess
    │
    ├─ Receives request, creates node in scene
    │
    ▼
Return ActionToolResult { success: true, data: { uuid, ... } }
    │
    ▼
Response sent to MCP Client
```

### Example 2: Query Scene Hierarchy (via Resource)

```
MCP Client
    │
    ├─ resources/read
    │   {
    │     "uri": "cocos://scene/hierarchy"
    │   }
    │
    ▼
MCPServer.handleMCPRequest()
    │
    ├─ Check method = "resources/read"
    │
    ▼
CocosResources.read("cocos://scene/hierarchy")
    │
    ├─ Queries scene for full node tree
    ├─ Includes UUIDs, names, active state, components
    │
    ▼
Return MCPResourceContent { uri, mimeType, text }
    │
    ▼
Response sent to MCP Client
```

## Error Handling

**Tool Execution Errors**:
- Missing action → `BaseActionTool.execute()` returns `errorResult()`
- Handler throws → Caught and returned as `ActionToolResult { success: false, error, isError: true }`
- Unknown tool → `MCPServer.executeToolCall()` throws with available tools list

**MCP Response Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "type": "tool_result",
    "content": [{ "type": "text", "text": "..." }],
    "isError": true
  }
}
```

## Configuration

**MCP Server Settings** (`settings/mcp-server.json`):
```json
{
  "port": 3000,
  "autoStart": false,
  "enableDebugLog": false,
  "allowedOrigins": ["*"],
  "maxConnections": 10
}
```

**Tool Manager** (`settings/tool-manager.json`):
```json
{
  "configurations": [
    {
      "id": "default",
      "name": "Default Configuration",
      "tools": [
        { "name": "manage_node", "enabled": true, ... },
        { "name": "manage_scene", "enabled": true, ... },
        ...
      ]
    }
  ],
  "currentConfigId": "default"
}
```

## Security

- Server only listens on `127.0.0.1` (localhost)
- CORS headers allow all origins (configurable)
- No authentication (MCP clients assumed trusted)
- Scene operations require valid editor context

## Performance Considerations

- Scene operations block editor UI briefly (expected behavior)
- Large node trees may take time to serialize for resources
- Resource reads are synchronous from editor context
- Tools batch operations when possible to minimize context switches
