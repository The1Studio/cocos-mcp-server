# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cocos MCP Server is a **Cocos Creator editor extension** that exposes an MCP (Model Context Protocol) HTTP server, allowing AI assistants to control the editor programmatically. It provides ~50 consolidated tools covering scene, node, component, prefab, asset, and project operations via JSON-RPC 2.0 over HTTP.

- **Runtime**: Node.js (CommonJS), bundled with Cocos Creator
- **UI**: Vue 3 Composition API panels
- **Editor compatibility**: Cocos Creator 3.5+ (3.8.6+ recommended)
- **Default endpoint**: `http://127.0.0.1:3000/mcp`

## Build & Development Commands

```bash
npm install        # Install deps (runs preinstall version check)
npm run build      # TypeScript compilation (source/ → dist/)
npm run watch      # Watch mode for development
```

No linter or test runner is configured. Verify changes compile cleanly with `npm run build`.

## Architecture

### Extension Lifecycle (`source/main.ts`)

Entry point registered as a Cocos Creator extension. Exports `load()`, `unload()`, and 22 IPC `methods` for panel communication. On load: initializes `ToolManager`, creates `MCPServer`, optionally auto-starts.

### HTTP Server (`source/mcp-server.ts`)

Plain `http.Server` handling three endpoint patterns:
- `POST /mcp` — JSON-RPC 2.0 MCP protocol (primary). Methods: `initialize`, `tools/list`, `tools/call`
- `GET /health` — health check
- `POST /api/*` and `GET /api/tools` — simplified REST alternative

Tool execution routes through `executeToolCall(toolName, args)` which splits the tool name by category prefix to find the correct executor.

### Tool System (`source/tools/`)

Each file exports a class implementing `ToolExecutor` (defined in `source/types/index.ts`):
- `getTools(): ToolDefinition[]` — returns tool metadata with JSON Schema `inputSchema`
- `execute(toolName: string, args: any): Promise<ToolResponse>` — switches on action name

**14 tool categories**: Scene, Node, Component, Prefab, Project, Debug, Preferences, Server, Broadcast, SceneAdvanced, SceneView, ReferenceImage, AssetAdvanced, Validation.

**Naming convention**: `category_action` (e.g., `node_lifecycle`, `scene_management`, `component_manage`).

### Tool Manager (`source/tools/tool-manager.ts`)

Manages named configurations for selectively enabling/disabling tools. Persists to `settings/tool-manager.json`. Supports up to 5 saved configurations with import/export.

### Settings (`source/settings.ts`)

File-based JSON persistence in the Cocos project's `settings/` directory:
- `settings/mcp-server.json` — port, autoStart, debugLog, maxConnections
- `settings/tool-manager.json` — tool configurations

### Panels (`source/panels/`)

Two Vue 3 panels registered in `package.json`:
- `default` — main control panel (start/stop server, settings)
- `tool-manager` — tool enable/disable UI

HTML templates and CSS live in `static/`. Panels communicate with main process via Cocos Creator IPC messages.

### Scene Extension (`source/scene.ts`)

Exposes 10 methods that run inside the Cocos Creator scene context (separate process from the main extension). Tools call these via `Editor.Message.request('scene', ...)`.

## Adding a New Tool

1. Create or edit a tool class in `source/tools/` implementing `ToolExecutor`
2. Register the instance in `MCPServer.initializeTools()` (`source/mcp-server.ts`)
3. The tool auto-appears in `/mcp` `tools/list` responses

## Key Types (`source/types/index.ts`)

- `ToolDefinition` — name, description, displayDescription, inputSchema
- `ToolResponse` — success, data, message, error, instruction, warning
- `ToolExecutor` — interface with getTools() and execute()
- `MCPServerSettings` — port, autoStart, debugLog, maxConnections

## i18n

Translation files in `i18n/en.js` and `i18n/zh.js`. Referenced in `package.json` via `i18n:cocos-mcp-server.*` keys.

## TypeScript Configuration

- Target: ES2017, Module: CommonJS, Strict mode enabled
- Source: `source/` → Output: `dist/`
- Uses `@cocos/creator-types` for editor API typings
- Base config in `base.tsconfig.json`, extended by `tsconfig.json`
