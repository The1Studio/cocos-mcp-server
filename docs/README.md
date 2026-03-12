# Cocos MCP Server v2.0 — Documentation Index

Complete documentation for Cocos MCP Server v2.0 (major rewrite with action-based tools).

## Quick Navigation

### For New Users
1. **[Quick Start Guide](./quick-start.md)** — Get running in 5 minutes
2. **[API Reference](./api-reference.md)** — Reference for all 21 tools
3. **[Project Overview](./project-overview-pdr.md)** — Project context and requirements

### For Developers
1. **[System Architecture](./system-architecture.md)** — Deep dive into architecture and data flows
2. **[Code Standards](./code-standards.md)** — Development patterns and conventions
3. **[CLAUDE.md](../CLAUDE.md)** — Quick reference for developers

### For Project Managers
1. **[Project Overview & PDR](./project-overview-pdr.md)** — Requirements, features, roadmap

---

## Documentation Overview

| Document | Purpose | Audience | Length |
|----------|---------|----------|--------|
| **Quick Start** | Get started in 5 minutes | New users | 256 lines |
| **API Reference** | Complete tool and endpoint documentation | Developers, integrators | 598 lines |
| **System Architecture** | Architecture, design patterns, data flows | Developers, architects | 400 lines |
| **Code Standards** | Implementation patterns and conventions | Developers | 382 lines |
| **Project Overview & PDR** | Project scope, requirements, roadmap | PMs, stakeholders | 493 lines |

---

## Key Concepts (v2.0)

### Action-Based Tools

All 21 tools follow a unified action-based pattern:

```
Tool Name: manage_node
  ├── Action: create
  ├── Action: update
  ├── Action: delete
  ├── Action: query
  └── Action: setParent
```

Each tool:
- Extends `BaseActionTool` abstract class
- Defines actions in `actionHandlers` map
- Returns standardized `ActionToolResult`
- Handles errors consistently

### 21 Consolidated Tools

| Category | Tools |
|----------|-------|
| **Scene** | manage_scene, manage_scene_view, manage_scene_query |
| **Nodes** | manage_node, manage_node_hierarchy, manage_selection |
| **Components** | manage_component, manage_validation |
| **Prefabs** | manage_prefab |
| **Assets** | manage_asset |
| **Project** | manage_project |
| **Editor** | manage_debug, manage_preferences, manage_server |
| **Advanced** | manage_broadcast, manage_undo, manage_reference_image, manage_script, manage_material, manage_animation |

### MCP Resources (Read-Only URIs)

| URI | Purpose |
|-----|---------|
| `cocos://editor/state` | Editor/project metadata |
| `cocos://scene/hierarchy` | Complete node tree |
| `cocos://project/info` | Project configuration |
| `cocos://scene/components` | Component type registry |

### MCP Protocol Endpoints

| Method | Purpose |
|--------|---------|
| `initialize` | Handshake with client |
| `tools/list` | List available tools |
| `tools/call` | Execute tool action |
| `resources/list` | List resource URIs |
| `resources/read` | Read resource content |

---

## Common Tasks

### Task: Connect Claude to Editor

1. Configure MCP in Claude settings
2. Point to `http://127.0.0.1:3000/mcp`
3. See all 21 tools available to Claude
4. Start creating scenes with AI assistance

**Reference**: [Quick Start Guide](./quick-start.md#connect-with-claude)

### Task: Create a New Tool

1. Create `source/tools/manage-{category}.ts`
2. Extend `BaseActionTool`
3. Define `name`, `description`, `inputSchema`, `actions`
4. Implement `actionHandlers` map
5. Register in `MCPServer.initializeTools()`

**Reference**: [Code Standards](./code-standards.md#action-tool-implementation-pattern)

### Task: Debug Tool Execution

1. Enable `enableDebugLog` in settings
2. Open extension console
3. Look for `[MCPServer]` and tool-specific logs
4. Check input/output in curl requests

**Reference**: [Quick Start Guide](./quick-start.md#troubleshooting)

### Task: Query Scene State

Use read-only resources instead of tools:

```bash
curl http://127.0.0.1:3000/mcp -d '{
  "method": "resources/read",
  "params": { "uri": "cocos://scene/hierarchy" }
}'
```

**Reference**: [API Reference](./api-reference.md#resources)

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  Cocos Creator Editor Extension         │
├─────────────────────────────────────────┤
│  HTTP Server (main.ts)                  │
│  ├── /mcp (JSON-RPC 2.0)               │
│  ├── /health (status check)             │
│  └── /api/* (REST alternative)          │
├─────────────────────────────────────────┤
│  Tool Executors (21 action tools)       │
│  └── All extend BaseActionTool          │
├─────────────────────────────────────────┤
│  Resources (4 read-only URIs)           │
├─────────────────────────────────────────┤
│  Scene Context (subprocess)             │
│  └── Direct node tree access            │
└─────────────────────────────────────────┘
            ↓ JSON-RPC 2.0
        AI Assistants
        (Claude, etc.)
```

**See**: [System Architecture](./system-architecture.md) for full diagrams and data flows

---

## v2.0 Major Changes

| Aspect | v1.0 | v2.0 |
|--------|------|------|
| Tool Count | 127+ fine-grained | 21 action-based |
| Tool Names | `category_action` | `manage_category` |
| Routing | Category prefix parsing | Flat `Map<string, ActionToolExecutor>` |
| Base Class | `ToolExecutor` interface | `BaseActionTool` abstract class |
| Result Type | `ToolResponse` (ad-hoc) | `ActionToolResult` (standardized) |
| Resources | None | 4 read-only URIs |
| Input Schema | Per-tool | Per-tool with action enum |
| Tool Manager | Category-based | Flat tool names |

**See**: [Project Overview](./project-overview-pdr.md#architecture-summary-v20-highlights)

---

## File Structure

```
docs/
├── README.md                    ← You are here
├── quick-start.md              (256 lines) - 5-min getting started
├── api-reference.md            (598 lines) - Complete API docs
├── system-architecture.md       (400 lines) - Full architecture
├── code-standards.md            (382 lines) - Dev standards & patterns
├── project-overview-pdr.md      (493 lines) - Project requirements
└── index.md                     (Optional) - Additional navigation

CLAUDE.md                        (186 lines) - Quick developer reference
```

---

## Type System

### ActionToolResult (Standard Response)

```typescript
interface ActionToolResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  instruction?: string;
  isError?: boolean;
}
```

### BaseActionTool (Base Class)

```typescript
abstract class BaseActionTool implements ActionToolExecutor {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: object;
  abstract readonly actions: string[];
  protected abstract actionHandlers: Record<string, handler>;
  async execute(action: string, args: Record<string, any>): Promise<ActionToolResult>;
}
```

**See**: [Code Standards](./code-standards.md#action-tool-implementation-pattern)

---

## API Endpoints

### POST /mcp (JSON-RPC 2.0)

Primary MCP endpoint. Supports all MCP methods:

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### GET /health

Health check endpoint. Returns server status and tool count:

```bash
curl http://127.0.0.1:3000/health
# {"status":"ok","tools":21}
```

### POST /api/{tool} (REST Alternative)

Simplified REST endpoint for non-MCP clients:

```bash
curl -X POST http://127.0.0.1:3000/api/manage_node \
  -H "Content-Type: application/json" \
  -d '{"action":"create","parentUuid":"root","name":"Node"}'
```

**See**: [API Reference](./api-reference.md) for complete documentation

---

## Configuration

### Server Settings

File: `settings/mcp-server.json`

```json
{
  "port": 3000,
  "autoStart": false,
  "enableDebugLog": false,
  "allowedOrigins": ["*"],
  "maxConnections": 10
}
```

### Tool Configuration

File: `settings/tool-manager.json`

Manage enabled/disabled tools and save multiple configurations.

**See**: [Quick Start Guide](./quick-start.md#server-settings) for details

---

## Support & Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in settings |
| Tool not appearing | Check Tool Manager, enable tool |
| Node not found | Query hierarchy using resources/read |
| Invalid JSON error | Check JSON syntax in request |
| Server won't start | Check editor logs, enable debug logging |

**See**: [Quick Start Guide](./quick-start.md#troubleshooting)

### Debug Logging

Enable `enableDebugLog` in settings to see detailed logs:

```json
{
  "enableDebugLog": true
}
```

Look for `[MCPServer]` and tool-specific prefixes in console.

---

## Development Workflow

### Adding a New Tool

1. Read [Code Standards](./code-standards.md#action-tool-implementation-pattern)
2. Create `source/tools/manage-{category}.ts`
3. Extend `BaseActionTool`
4. Implement required properties and `actionHandlers` map
5. Register in `MCPServer.initializeTools()`
6. Build: `npm run build`
7. Test via curl or MCP client

### Modifying Existing Tool

1. Find tool file in `source/tools/manage-*.ts`
2. Edit action handler or add new action
3. Update `actions` array if adding action
4. Update `inputSchema` if changing parameters
5. Build: `npm run build`
6. Test the modified action

### Debugging

1. Enable `enableDebugLog` in settings
2. Make request with curl or MCP client
3. Watch console for `[ToolName]` prefixed logs
4. Check error message in response

---

## Performance

**Response Times**:
- Tool list: < 100ms
- Tool execution: < 1s (most tools)
- Resource read: < 500ms
- Health check: < 10ms

**Limits**:
- Concurrent connections: 10 (configurable)
- Max tool execution: 30 seconds (timeout)
- Resource read timeout: 5 seconds

---

## Security

- Server listens only on `127.0.0.1` (localhost)
- No authentication (assumed trusted editor context)
- All operations visible in Cocos Creator
- No sensitive data in logs

---

## Getting Help

1. **Installation Issues** → [Quick Start Guide](./quick-start.md#installation)
2. **API Questions** → [API Reference](./api-reference.md)
3. **Architecture** → [System Architecture](./system-architecture.md)
4. **Development** → [Code Standards](./code-standards.md)
5. **Project Context** → [Project Overview](./project-overview-pdr.md)

---

## Related Documents

- **CLAUDE.md** — Quick reference for developers
- **README.EN.md** — User-facing features documentation
- **package.json** — Project dependencies and scripts
- **source/types/index.ts** — TypeScript type definitions

---

**Last Updated**: 2026-03-12
**Version**: v2.0.0
**Status**: Stable

See [Project Overview & PDR](./project-overview-pdr.md) for detailed project information, requirements, and roadmap.
