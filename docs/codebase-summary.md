# Cocos MCP Server — Codebase Summary

**Generated from repomix analysis on 2026-03-13**
**Version**: v2.1.0
**Total Files**: 62
**Total Tokens**: 343,977

## Executive Summary

Cocos MCP Server is a TypeScript-based Cocos Creator editor extension that exposes a Model Context Protocol (MCP) HTTP server. It consolidates 127+ fine-grained v1 tools into 21 unified action-based tools covering scene, node, component, prefab, asset, and project operations via JSON-RPC 2.0 over HTTP.

**Current Status**: Production-ready (v2.1.0)
**Primary Users**: AI assistants (Claude, ChatGPT), game developers, automation tools
**Key Metrics**: 21 tools, 4 MCP resources, ~344K tokens codebase

---

## Project Structure Overview

```
cocos-mcp-server/
├── source/                    # Main TypeScript source code
│   ├── tools/                # 21 action-based tool implementations
│   ├── resources/            # MCP resource providers
│   ├── panels/               # Vue 3 editor UI panels
│   ├── types/                # TypeScript type definitions
│   ├── utils/                # Utility functions
│   ├── test/                 # Manual testing utilities
│   ├── main.ts              # Extension entry point
│   ├── mcp-server.ts        # HTTP server and MCP routing
│   ├── scene.ts             # Scene context operations
│   └── settings.ts          # Persistent settings management
├── dist/                      # Compiled JavaScript (npm run build)
├── docs/                      # Documentation
│   ├── README.md
│   ├── quick-start.md
│   ├── api-reference.md
│   ├── system-architecture.md
│   ├── code-standards.md
│   ├── project-overview-pdr.md
│   ├── project-changelog.md
│   └── journals/
├── i18n/                      # Localization (English, Chinese)
├── static/                    # HTML templates, CSS, icons
├── scripts/                   # Build and utility scripts
├── .claude/                   # Claude Code configuration
├── package.json              # Dependencies and build scripts
├── tsconfig.json            # TypeScript configuration
└── CLAUDE.md                 # Developer quick reference
```

---

## Architecture Layers

### 1. Extension Entry Point (`source/main.ts`)

- **Purpose**: Cocos Creator extension lifecycle management
- **Exports**: `load()`, `unload()`, IPC methods for panel communication
- **Key Functions**:
  - Initialize extension on load
  - Create and manage HTTP server
  - Handle panel lifecycle
  - Broadcast extension status

### 2. HTTP Server (`source/mcp-server.ts`)

- **Purpose**: HTTP server implementing MCP v2.0.0 protocol
- **Ports**: Default 3000 (configurable)
- **Endpoints**:
  - `POST /mcp` — JSON-RPC 2.0 MCP protocol (primary)
  - `GET /health` — Health check endpoint
  - `POST /api/*` — REST API alternative
- **Key Methods**:
  - `initialize()` — MCP handshake
  - `tools/list` — List available tools
  - `tools/call` — Execute tool with action
  - `resources/list` — List resource URIs
  - `resources/read` — Read resource by URI
- **Security**: Body size limits, CORS enforcement, path validation, XSS prevention

### 3. Action Tool System (21 Tools)

**Base Class**: `BaseActionTool` (`source/tools/base-action-tool.ts`)
- Abstract properties: `name`, `description`, `inputSchema`, `actions`
- Protected `actionHandlers` map for action routing
- Auto-error handling in `execute()` method
- Standardized `ActionToolResult` return type

**Tool Categories**:

| Category | Tools | Purpose |
|----------|-------|---------|
| **Scene** | manage_scene, manage_scene_view, manage_scene_query | Scene operations |
| **Nodes** | manage_node, manage_node_hierarchy, manage_selection | Node tree management |
| **Components** | manage_component, manage_validation | Component operations |
| **Prefabs** | manage_prefab | Prefab management |
| **Assets** | manage_asset | Asset operations |
| **Project** | manage_project | Project configuration |
| **Editor** | manage_debug, manage_preferences, manage_server | Editor settings |
| **Advanced** | manage_broadcast, manage_undo, manage_reference_image, manage_script, manage_material, manage_animation | Complex operations |

**File Naming**: `source/tools/manage-{category}.ts`

### 4. Resources System (`source/resources/`)

**Interface**: `ResourceProvider` and `CocosResources` class
**Read-Only URIs**:
- `cocos://editor/state` — Editor version, project info, scene status
- `cocos://scene/hierarchy` — Complete node tree with component info
- `cocos://project/info` — Project metadata, available scenes
- `cocos://scene/components` — Registered component types

### 5. UI Panels (`source/panels/`)

**Vue 3 Composition API**:
- `default` panel — Server control (start/stop, settings, status)
- `tool-manager` panel — Enable/disable tools

**HTML Templates**: `static/template/`
**CSS Styling**: `static/style/`
**Localization**: `i18n/en.js`, `i18n/zh.js`

### 6. Scene Context (`source/scene.ts`)

**Purpose**: Operations requiring scene subprocess access
**Methods**: Called via `Editor.Message.request('scene', ...)`
**Operations**:
- Query node tree
- Create/update/delete nodes
- Add/remove components
- Set component properties

### 7. Types & Utilities

**`source/types/index.ts`**:
- `ActionToolExecutor` — Tool interface
- `ActionToolResult` — Standardized response type
- `ToolDefinition` — MCP schema
- Entity types: `NodeInfo`, `ComponentInfo`, `SceneInfo`, etc.

**`source/utils/normalize.ts`**:
- Input normalization for LLM parameters
- Standardize variable names, casing, formats

---

## Tool System Deep Dive

### Action-Based Pattern (v2.0+)

Each tool extends `BaseActionTool`:

```typescript
class ManageNodeTool extends BaseActionTool {
  readonly name = 'manage_node';
  readonly description = '...';
  readonly inputSchema = {
    type: 'object',
    properties: {
      action: { enum: ['create', 'update', 'delete', 'query'] },
      // ... action-specific parameters
    }
  };

  protected actionHandlers = {
    create: async (args) => { /* ... */ },
    update: async (args) => { /* ... */ },
    // ...
  };
}
```

### Execution Flow

1. MCP request → `/mcp` endpoint
2. Parse JSON-RPC → Extract `toolName` and `arguments`
3. Route to `MCPServer.executeToolCall(toolName, args)`
4. Fetch tool from `ToolManager`
5. Extract `action` from arguments
6. Invoke `tool.execute(action, args)`
7. Return `ActionToolResult` (success/error)

### Tool Manager (`source/tools/tool-manager.ts`)

**Purpose**: Selectively enable/disable tools
**Configuration File**: `settings/tool-manager.json`
**Features**:
- Up to 5 named configurations
- Per-configuration tool enable/disable list
- Import/export configurations
- Persist to `settings/tool-manager.json`

---

## Key Files by Token Count

| File | Tokens | Purpose |
|------|--------|---------|
| `release-manifest.json` | 188,329 | Release version data |
| `source/tools/component-tools.ts` | 16,627 | Component utilities |
| `source/tools/manage-prefab.ts` | 11,015 | Prefab operations |
| `source/tools/manage-component.ts` | 10,338 | Component management |
| `FEATURE_GUIDE_EN.md` | 8,170 | User feature documentation |

---

## Build & Development

### Commands

```bash
npm install        # Install dependencies
npm run build      # TypeScript → dist/
npm run watch      # Watch mode for development
```

### Build Output

- **Source**: `source/` directory (TypeScript)
- **Output**: `dist/` directory (CommonJS)
- **Target**: Node.js (bundled with Cocos Creator)

### Configuration

- **TypeScript**: `tsconfig.json` (strict mode, ES2017 target)
- **Base Config**: `base.tsconfig.json`

---

## Settings & Configuration

### Server Settings (`settings/mcp-server.json`)

```json
{
  "port": 3000,
  "autoStart": false,
  "enableDebugLog": false,
  "allowedOrigins": ["*"],
  "maxConnections": 10
}
```

**Managed by**: `source/settings.ts`

### Tool Configuration (`settings/tool-manager.json`)

```json
{
  "configurations": [
    {
      "id": "config1",
      "name": "Default",
      "tools": [
        { "name": "manage_node", "enabled": true },
        { "name": "manage_scene", "enabled": true },
        // ...
      ]
    }
  ],
  "currentConfigId": "config1"
}
```

---

## Type System

### ActionToolResult

```typescript
interface ActionToolResult {
  success: boolean;
  data?: any;           // Operation result data
  message?: string;     // Human-readable message
  error?: string;       // Error description
  instruction?: string; // Next steps for client
  isError?: boolean;
}
```

### ToolDefinition (MCP)

```typescript
interface ToolDefinition {
  name: string;              // e.g., "manage_node"
  description: string;       // Tool purpose
  displayDescription?: string;
  inputSchema: object;       // JSON Schema with action enum
}
```

---

## Localization (i18n)

- **English**: `i18n/en.js`
- **Chinese**: `i18n/zh.js`
- **Scope**: UI panel text
- **Tool Descriptions**: English-first (for LLM understanding)
- **Translation Keys**: Format `cocos-mcp-server.*`

---

## Testing Infrastructure

### Test Files

- `source/test/tool-tester.ts` — Base tool testing utilities
- `source/test/manual-test.ts` — Manual testing examples
- `source/test/mcp-tool-tester.ts` — MCP protocol testing

### Testing Strategy

- **Manual Functional Tests**: Each tool action tested with valid/invalid inputs
- **Protocol Tests**: MCP handshake, tools/list, resources/read
- **Integration Tests**: Scene operations verified in editor

---

## Security Measures (v2.1.0)

- **Request Validation**: Body size limits (1MB max)
- **CORS Enforcement**: Origin checking, header validation
- **Path Traversal Prevention**: Strict path validation in asset operations
- **XSS Prevention**: Escaped output in resource URIs and responses
- **Prototype Pollution Guards**: Argument validation to prevent pollution
- **Script Execution Restrictions**: Disabled arbitrary script execution
- **localhost-only**: Listens on 127.0.0.1 (not exposed to network)

---

## Error Handling Patterns

### Standardized Error Response

```typescript
{
  success: false,
  error: 'Operation failed: node not found',
  instruction: 'Verify node UUID using resources/read cocos://scene/hierarchy',
  message: 'Node with UUID abc123 does not exist'
}
```

### Anti-patterns Removed (v2.1.0)

- `new Promise(async ...)` pattern removed from 12+ files
- Replaced with proper async/await usage
- Improved error recovery and promise handling

---

## Dependencies

### Runtime

- `uuid` — UUID generation for nodes/assets
- `@cocos/creator-types` — Cocos Creator type definitions
- Node.js built-ins: `http`, `url`, `fs`, `path`, `util`

### Development

- TypeScript
- Cocos Creator 3.5+ (3.8.6+ recommended)

### Deliberate Minimalism

- No heavy frameworks
- Fast extension load time
- Reduced bundle size

---

## Documentation Structure

| Document | Purpose | Audience |
|----------|---------|----------|
| **CLAUDE.md** | Quick developer reference | Developers |
| **README.md** | Documentation index | All users |
| **quick-start.md** | 5-minute getting started | New users |
| **api-reference.md** | Complete tool API docs | Developers, integrators |
| **system-architecture.md** | Architecture deep dive | Architects, senior devs |
| **code-standards.md** | Development patterns | Developers |
| **project-overview-pdr.md** | Requirements and PDR | PMs, stakeholders |
| **project-changelog.md** | Version history | All users |

---

## Performance Characteristics

### Response Times

- **Tool list**: < 100ms
- **Tool execution**: < 1s (most tools)
- **Resource read**: < 500ms
- **Health check**: < 10ms

### Limits

- **Concurrent connections**: 10 (configurable)
- **Max tool execution**: 30 seconds (timeout)
- **Resource read timeout**: 5 seconds
- **Body size limit**: 1MB

---

## Codebase Statistics

### Repository Metrics

| Metric | Value |
|--------|-------|
| Total Files | 62 |
| Total Lines | ~30,970 (XML packed) |
| Total Tokens | 343,977 |
| Main Language | TypeScript |
| Document Languages | Markdown, English/Chinese |
| Config Formats | JSON, YAML |

### File Distribution

- TypeScript (.ts): ~20 files
- Markdown (.md): ~15 files
- JSON: ~10 files
- HTML/CSS/Images: ~17 files

---

## Compatibility

**Supported Cocos Creator Versions**: 3.5+
**Recommended**: 3.8.6+
**Node Runtime**: CommonJS (bundled with Cocos Creator)
**TypeScript**: ES2017 target

---

## Known Limitations

- **No WebSocket**: HTTP request/response only (future enhancement)
- **localhost-only**: Not accessible from network (security design)
- **No Authentication**: Assumes trusted editor environment
- **No Plugin System**: Custom tools require code modification (future feature)

---

## Future Enhancements

- WebSocket support for persistent connections
- Plugin system for custom tools
- Advanced filtering/search in resources
- Performance profiling tools
- Team collaboration features

---

## Related Documentation

- **[Project Overview & PDR](./project-overview-pdr.md)** — Requirements and design
- **[System Architecture](./system-architecture.md)** — Data flows and patterns
- **[API Reference](./api-reference.md)** — All tools and endpoints
- **[Code Standards](./code-standards.md)** — Development guidelines
- **[CLAUDE.md](../CLAUDE.md)** — Developer quick reference

---

**Last Generated**: 2026-03-13
**Generation Tool**: Repomix v1.11.1
**Repository Root**: `/mnt/Work/1M/2. PlayableLabs/cocos-mcp-server`

See `/repomix-output.xml` for the complete packed repository representation.
