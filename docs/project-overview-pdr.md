# Project Overview & Product Development Requirements (v2.0)

## Project Overview

**Cocos MCP Server** is a Cocos Creator editor extension that exposes a Model Context Protocol (MCP) HTTP server, enabling AI assistants and external tools to programmatically control the Cocos Creator editor.

**Version**: 2.0.0 (major rewrite - action-based tools)
**Status**: Stable
**Maintained by**: PlayableLabs

### Purpose

Enable AI assistants (Claude, ChatGPT, etc.) to:
- Query editor and scene state via read-only resource URIs
- Create, modify, and delete scene nodes and components
- Manage prefabs, assets, and project configuration
- Control animation, materials, scripts, and other aspects
- Perform validation and debugging operations
- Broadcast events to multiple connected clients

### Key Features

- **21 Action-based Tools** — Flat tool system with action parameters (v2.0)
- **Read-only Resources** — 4 MCP resource URIs for editor/scene state queries
- **JSON-RPC 2.0 Protocol** — Standard MCP endpoint at `/mcp`
- **REST API Alternative** — Simplified endpoints for non-MCP clients
- **Selective Tool Exposure** — Tool Manager for enabling/disabling tools per configuration
- **Multi-client Support** — Multiple simultaneous MCP client connections
- **Localization** — English and Chinese UI

### Target Users

- **AI Assistants**: Claude, ChatGPT, and other MCP-compatible LLMs
- **Game Developers**: Using Cocos Creator for 2D/3D games
- **Development Tools**: Custom editors, asset pipelines, automation scripts
- **Game Studios**: Both indie and enterprise teams

## Architecture Summary (v2.0 Highlights)

### Changes from v1.0

| Aspect | v1.0 | v2.0 |
|--------|------|------|
| Tool System | 127+ fine-grained tools with category prefix routing | 21 action-based tools with flat map routing |
| Tool Names | `category_action` (e.g., `node_create`, `node_update`) | `manage_category` with action parameter |
| Tool Count | Large, fragmented | Consolidated, fewer tools |
| Action Routing | Manual string splitting on `_` | `BaseActionTool.actionHandlers` map |
| Base Class | `ToolExecutor` interface | `BaseActionTool` abstract class |
| Result Type | `ToolResponse` (ad-hoc) | `ActionToolResult` (standardized) |
| MCP Resources | None | 4 read-only resource URIs |
| Input Schema | Per-tool | Per-tool with action enum |
| Tool Manager | Supports categories | Flat tool names (no categories) |

### Architecture Layers

```
┌─────────────────────────────────────────┐
│         HTTP/REST Endpoints              │
│  /mcp (JSON-RPC) │ /health │ /api       │
├─────────────────────────────────────────┤
│         MCP Server & Routing             │
│  Parse requests → Tool dispatch          │
├─────────────────────────────────────────┤
│      Action Tool Executors (21 tools)    │
│  Each extends BaseActionTool             │
├─────────────────────────────────────────┤
│   Scene Context & Editor Message API     │
│  IPC to scene subprocess & Editor API    │
└─────────────────────────────────────────┘
```

## Product Requirements

### Functional Requirements

#### F1: MCP Protocol Support (JSON-RPC 2.0)

**Requirement**: Server must implement MCP v2.0.0 protocol with complete JSON-RPC 2.0 support.

**Methods**:
- `initialize` — Handshake with client capabilities
- `tools/list` — List available tools with input schemas
- `tools/call` — Execute tool action with parameters
- `resources/list` — List available resource URIs
- `resources/read` — Read resource content by URI

**Acceptance Criteria**:
- Requests are parsed as JSON-RPC 2.0
- Responses include proper `jsonrpc`, `id`, `result`/`error` fields
- Error responses follow JSON-RPC error format
- Protocol version negotiation in `initialize`

#### F2: 21 Consolidated Action Tools

**Requirement**: Provide exactly 21 action-based tools covering editor operations.

**Tools**: manage_scene, manage_node, manage_component, manage_prefab, manage_asset, manage_project, manage_debug, manage_preferences, manage_server, manage_broadcast, manage_scene_view, manage_node_hierarchy, manage_scene_query, manage_undo, manage_reference_image, manage_validation, manage_selection, manage_script, manage_material, manage_animation

**Each Tool**:
- Extends `BaseActionTool`
- Defines `inputSchema` with action enum
- Implements `actionHandlers` map for each action
- Returns `ActionToolResult` (success/error)

**Acceptance Criteria**:
- All 21 tools register and appear in `/mcp` tools/list
- All tool schemas are valid JSON Schema Draft 7
- Actions execute and return proper `ActionToolResult` format
- Errors are caught and returned with helpful messages

#### F3: Read-only Resource URIs

**Requirement**: Provide 4 read-only resource URIs for querying editor/scene state.

**Resources**:
- `cocos://editor/state` — Editor version, project info, scene status
- `cocos://scene/hierarchy` — Complete node tree with components
- `cocos://project/info` — Project metadata and available scenes
- `cocos://scene/components` — Registered component types

**Acceptance Criteria**:
- Resources appear in `resources/list` response
- `resources/read` returns correct content per URI
- Content includes expected fields (uuid, name, etc.)
- Resources are read-only (no write operations)

#### F4: Tool Enable/Disable Management

**Requirement**: Allow users to selectively enable/disable tools via Tool Manager configurations.

**Features**:
- Up to 5 named configurations
- Per-configuration tool enable/disable list
- Load/save to `settings/tool-manager.json`
- Apply configuration to active tool set

**Acceptance Criteria**:
- Configurations persist across editor restarts
- Tool Manager UI shows all tools with checkboxes
- Disabled tools do not appear in `/mcp` tools/list
- Active configuration is tracked and applied

#### F5: Health Check Endpoint

**Requirement**: Provide a `/health` endpoint for monitoring server status.

**Response**:
```json
{
  "status": "ok",
  "tools": 21
}
```

**Acceptance Criteria**:
- Endpoint returns 200 OK when server is running
- Response includes tool count
- Endpoint is lightweight and fast

#### F6: Scene Context Operations

**Requirement**: All node/scene operations must execute in the scene context (separate subprocess).

**Operations**:
- Query node tree
- Create/update/delete nodes
- Add/remove components
- Set component properties
- Scene management (open, save)

**Acceptance Criteria**:
- Operations use `Editor.Message.request('scene', ...)`
- Scene modifications reflect immediately in editor
- Operations are atomic (succeed or fail completely)
- Errors from scene include helpful messages

#### F7: Localization (i18n)

**Requirement**: Support both English and Chinese for UI panels and documentation.

**Files**:
- `i18n/en.js` — English translations
- `i18n/zh.js` — Chinese translations

**Acceptance Criteria**:
- All panel text is translated
- Descriptions in tool schemas are in English (for LLM understanding)
- Editor language setting switches UI language

### Non-Functional Requirements

#### NF1: Performance

**Requirement**: Tool execution must be responsive (< 1s for most operations).

**Metrics**:
- Tool list request: < 100ms
- Resource read: < 500ms
- Tool execution: < 1s (most tools)
- Concurrent clients: Support 10+ simultaneous connections

**Acceptance Criteria**:
- Load testing shows consistent sub-second responses
- No memory leaks under sustained load
- Server handles disconnections gracefully

#### NF2: Reliability

**Requirement**: Server must recover from errors gracefully.

**Error Handling**:
- Invalid JSON → Error response, server remains running
- Missing tool → Error response with available tools
- Scene operation failure → Error result returned
- Unhandled exception → Server continues serving

**Acceptance Criteria**:
- Error responses follow MCP format
- Server does not crash on malformed input
- Errors include helpful debugging context
- Logging shows all errors for troubleshooting

#### NF3: Compatibility

**Requirement**: Support Cocos Creator 3.5+ (3.8.6+ recommended).

**Tested Versions**: 3.5.0, 3.6.x, 3.7.x, 3.8.6

**Acceptance Criteria**:
- Extension installs without errors
- All tools function on supported versions
- Warnings or graceful degradation for older versions

#### NF4: Security

**Requirement**: Server operates securely on localhost only.

**Security Measures**:
- Listens only on `127.0.0.1` (localhost)
- No authentication (assumed trusted editor context)
- CORS configured (default: allow all)
- No sensitive data in logs

**Acceptance Criteria**:
- Server refuses connections from non-localhost
- No credentials logged
- CORS headers can be configured per security policy

#### NF5: Scalability

**Requirement**: Tool system must be extensible for future tools.

**Design**:
- `BaseActionTool` class for easy new tool creation
- Standardized `ActionToolResult` return type
- Tool registration via `MCPServer.initializeTools()`

**Acceptance Criteria**:
- Adding a new tool requires <50 lines of boilerplate
- New tools integrate seamlessly with MCP protocol
- No changes needed to server core

#### NF6: Maintainability

**Requirement**: Code must be clean, well-documented, and testable.

**Standards**:
- TypeScript strict mode
- Files under 200 lines
- Clear naming conventions
- TSDoc comments for public APIs

**Acceptance Criteria**:
- Code passes `npm run build` without warnings
- No `any` types without justification
- All public methods have documentation
- Project structure is self-evident

### Configuration Requirements

#### C1: Server Settings

**File**: `settings/mcp-server.json`

```json
{
  "port": 3000,
  "autoStart": false,
  "enableDebugLog": false,
  "allowedOrigins": ["*"],
  "maxConnections": 10
}
```

**User Control**: Editor panel for modifying settings

**Acceptance Criteria**:
- Settings persist across restarts
- Port change requires server restart
- autoStart flag controls extension behavior
- Debug logging can be toggled from UI

#### C2: Tool Configuration

**File**: `settings/tool-manager.json`

**User Control**: Tool Manager panel for enabling/disabling tools

**Acceptance Criteria**:
- Configurations persist
- Multiple named configs supported
- UI provides quick enable/disable toggles
- Active config applied to all new connections

### API Specification

#### MCP Tools Endpoint

**POST** `/mcp` (JSON-RPC 2.0)

**Request Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
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

**Response Format**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "type": "tool_result",
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"data\":{...}}"
      }
    ]
  }
}
```

#### REST API Alternative

**POST** `/api/manage_node`

Request:
```json
{
  "action": "create",
  "parentUuid": "...",
  "name": "NewNode"
}
```

Response:
```json
{
  "success": true,
  "data": { "uuid": "..." }
}
```

### Testing Requirements

#### T1: Manual Functional Testing

Each tool action must be tested:
1. Valid parameters → Success result
2. Missing parameters → Error result
3. Invalid parameters → Error result
4. Scene side effects verified in editor

#### T2: Protocol Testing

- MCP handshake works
- tools/list returns all 21 tools
- tools/call executes and returns proper format
- resources/list and resources/read work
- Concurrent requests handled correctly

#### T3: Error Scenarios

- Malformed JSON → Error response
- Invalid tool name → Helpful error
- Missing action → Helpful error
- Server restart → Clean state

### Success Metrics

**Adoption**:
- Used by AI assistants (Claude, ChatGPT plugins)
- Positive feedback from game developers
- Active use in game studios

**Quality**:
- Zero unhandled crashes
- >95% tool success rate
- <1s average tool execution

**Community**:
- Clear documentation
- Example scripts for common tasks
- Community contributions encouraged

## Dependencies

### Runtime

- `uuid` — UUID generation for nodes/assets
- `@cocos/creator-types` — Cocos Creator type definitions
- Node.js built-ins (`http`, `url`, `fs`)

### Development

- TypeScript
- Cocos Creator 3.5+

### No Heavy Dependencies

Intentional design choice:
- Minimal runtime overhead
- Fast extension load time
- Reduced bundle size

## Implementation Status

### Completed (v2.0)

- Architecture redesign (flat action tools)
- All 21 tools implemented
- MCP resources (4 URIs)
- Tool Manager (v2)
- UI panels (English)
- Error handling and logging
- Documentation

### Future Enhancements

- Plugin system for custom tools
- WebSocket support for persistent connections
- Advanced filtering and search in resources
- Performance profiling tools
- Team collaboration features

## Release Notes

**Current Version**: v2.1.0 (2026-03-13)

See [Project Changelog](./project-changelog.md) for complete version history and detailed release notes.

### v2.1.0 — Security & Quality Release

**Focus**: Security hardening and code quality improvements

**Key Improvements**:
- 6 critical security fixes (body size limits, CORS, XSS, path traversal, prototype pollution, script execution)
- Removed `new Promise(async ...)` anti-pattern from 12+ files
- Fixed JSON-RPC 2.0 compliance issues
- Removed dead code and unused imports from 15+ files
- Enhanced error messages and recovery

**Breaking Changes**: None (fully backward compatible)

### v2.0.0 — Major Rewrite (2026-03-12)

**Breaking Changes**:
- Tool names changed from `category_action` to `manage_category`
- Tool execution now requires `action` parameter in arguments
- Old v1 tool files removed
- Tool Manager configurations need upgrade

**New Features**:
- MCP resources (read-only URIs)
- `BaseActionTool` class for easier tool creation
- Standardized `ActionToolResult` type
- Flat tool routing (no category prefix parsing)

**Bug Fixes**:
- Improved error messages
- Better input validation
- Fixed memory leaks in long-running sessions

**Deprecations**:
- Old v1 tool system completely removed

## Support & Maintenance

**Issue Reporting**: GitHub Issues
**Documentation**: ./docs/ directory and CLAUDE.md
**Community**: Cocos Creator forums and Discord

### Maintenance Schedule

- **Critical bugs**: Fixed within 24 hours
- **Minor bugs**: Fixed within 1 week
- **Feature requests**: Reviewed and prioritized
- **Dependencies**: Updated monthly or as needed
