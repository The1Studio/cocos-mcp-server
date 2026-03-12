# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cocos MCP Server v2.0 is a **Cocos Creator editor extension** that exposes an MCP (Model Context Protocol) HTTP server, allowing AI assistants to control the editor programmatically via action-based tools. It consolidates 127+ fine-grained tools into 21 action-oriented `manage_*` tools covering scene, node, component, prefab, asset, and project operations via JSON-RPC 2.0 over HTTP.

- **Runtime**: Node.js (CommonJS), bundled with Cocos Creator
- **UI**: Vue 3 Composition API panels (English localization)
- **Editor compatibility**: Cocos Creator 3.5+ (3.8.6+ recommended)
- **Default endpoint**: `http://127.0.0.1:3000/mcp`
- **Protocol**: MCP v2.0.0 with resource read-only URIs and action-based tools

## Build & Development Commands

```bash
npm install        # Install deps (runs preinstall version check)
npm run build      # TypeScript compilation (source/ → dist/)
npm run watch      # Watch mode for development
```

Verify changes compile cleanly with `npm run build`. No linter or test runner is configured.

## Architecture (v2.0)

### Extension Lifecycle (`source/main.ts`)

Entry point registered as a Cocos Creator extension. Exports `load()`, `unload()`, and IPC `methods` for panel communication. On load: initializes `ToolManager`, creates `MCPServer`, optionally auto-starts.

### HTTP Server (`source/mcp-server.ts`)

Plain `http.Server` handling two primary endpoints:
- `POST /mcp` — JSON-RPC 2.0 MCP protocol (primary). Methods: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`
- `GET /health` — health check (returns status and tool count)
- `POST /api/*` and `GET /api/tools` — optional simplified REST alternative for non-MCP clients

MCP request routing:
- `tools/call` extracts `toolName` (e.g., `manage_node`) and `action` (e.g., `create`, `update`) from request
- Routes to `MCPServer.executeToolCall(toolName, args)` which delegates to the corresponding `ActionToolExecutor`
- Resources are read-only URIs providing editor/scene state snapshots

### Tool System (`source/tools/`)

V2.0 uses **action-based tools** — flat Map<string, ActionToolExecutor> architecture replacing the old category-prefix routing.

**21 v2 tools** (each is an `ActionToolExecutor`):
- manage_scene, manage_node, manage_component, manage_prefab, manage_asset, manage_project, manage_debug
- manage_preferences, manage_server, manage_broadcast, manage_scene_view, manage_node_hierarchy
- manage_scene_query, manage_undo, manage_reference_image, manage_validation, manage_selection
- manage_script, manage_material, manage_animation

**Base class**: `BaseActionTool` (`source/tools/base-action-tool.ts`)
- Abstract properties: `name`, `description`, `inputSchema`, `actions`
- Protected `actionHandlers: Record<string, handler>` map for action routing
- Implements `execute(action: string, args: Record<string, any>): Promise<ActionToolResult>`
- Handles missing actions and catches errors automatically

**Tool file naming**: `manage-{category}.ts` (e.g., `manage-node.ts`, `manage-animation.ts`)

**MCP Input Schema Format**:
```json
{
  "type": "object",
  "properties": {
    "action": {
      "type": "string",
      "enum": ["create", "update", "delete", "query"],
      "description": "Action to perform"
    },
    // ... action-specific parameters
  },
  "required": ["action"]
}
```

### Tool Manager (`source/tools/tool-manager.ts`)

Manages named configurations for selectively enabling/disabling tools. Persists to `settings/tool-manager.json`. Supports up to 5 saved configurations with import/export. V2 uses flat tool names (no category prefix).

### Resources (`source/resources/`)

Read-only resource URIs providing editor/scene state snapshots:
- `cocos://editor/state` — Editor version, project info, open scene status
- `cocos://scene/hierarchy` — Complete node tree with UUIDs, names, active state, component types
- `cocos://project/info` — Project metadata, available scenes, settings
- `cocos://scene/components` — All registered component types in the project

Implemented in `CocosResources` class. MCP protocol supports `resources/list` and `resources/read` methods.

### Settings (`source/settings.ts`)

File-based JSON persistence in the Cocos project's `settings/` directory:
- `settings/mcp-server.json` — port, autoStart, enableDebugLog, allowedOrigins, maxConnections
- `settings/tool-manager.json` — tool configurations

### Panels (`source/panels/`)

Two Vue 3 panels registered in `package.json`:
- `default` — main control panel (start/stop server, settings, status)
- `tool-manager` — tool enable/disable UI

HTML templates and CSS live in `static/`. All UI text translated to English. Panels communicate with main process via Cocos Creator IPC messages.

### Scene Extension (`source/scene.ts`)

Exposes methods that run inside the Cocos Creator scene context (separate process from the main extension). Tools call these via `Editor.Message.request('scene', ...)` for operations requiring scene access.

### Utilities (`source/utils/`)

- `normalize.ts` — LLM input normalization for standardizing variable names, casing, and value formats

## Key Types (`source/types/index.ts`)

**v2 Types**:
- `ActionToolExecutor` — Interface with `name`, `description`, `inputSchema`, `actions`, `execute(action, args)`
- `ActionToolResult` — Standardized tool result with `success`, `data`, `message`, `error`, `instruction`, `isError`
- `successResult(data, message)` — Helper function to create success responses
- `errorResult(error)` — Helper function to create error responses

**Shared Types**:
- `ToolDefinition` — name, description, displayDescription, inputSchema (sent to MCP clients)
- `MCPServerSettings` — port, autoStart, enableDebugLog, allowedOrigins, maxConnections
- `NodeInfo`, `ComponentInfo`, `SceneInfo`, `PrefabInfo`, `AssetInfo`, `ProjectInfo` — data structures for editor entities

**Tool Configuration**:
- `ToolConfig` — name, enabled flag, description (flat, no category field in v2)
- `ToolConfiguration` — named config with tool list, timestamps
- `ToolManagerSettings` — configurations array, currentConfigId, maxConfigSlots

## Adding a New Tool (v2.0)

1. Create a class in `source/tools/manage-{category}.ts` extending `BaseActionTool`
2. Define abstract properties: `name`, `description`, `inputSchema` (with action enum), `actions`
3. Implement `protected actionHandlers` map with action names as keys and async handlers as values
4. Each handler returns `ActionToolResult` (use `successResult()` or `errorResult()` helpers)
5. Register the tool instance in `MCPServer.initializeTools()` — it auto-appears in `/mcp` responses

## MCP Protocol (v2.0)

**Initialize** (handshake):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": { "protocolVersion": "2024-11-05", "capabilities": { "resources": {} } }
}
```

**List Tools**:
```json
{"method": "tools/list"}
```

**Call Tool**:
```json
{
  "method": "tools/call",
  "params": {
    "name": "manage_node",
    "arguments": {
      "action": "create",
      "parentUuid": "...",
      "name": "NewNode"
    }
  }
}
```

**Resources**:
```json
{"method": "resources/list"}
{"method": "resources/read", "params": {"uri": "cocos://scene/hierarchy"}}
```

## i18n

Translation files in `i18n/en.js` and `i18n/zh.js`. Referenced in `package.json` via `i18n:cocos-mcp-server.*` keys. UI panels are English-first with Chinese translation support.

## TypeScript Configuration

- Target: ES2017, Module: CommonJS, Strict mode enabled
- Source: `source/` → Output: `dist/`
- Uses `@cocos/creator-types` for editor API typings
- Base config in `base.tsconfig.json`, extended by `tsconfig.json`
