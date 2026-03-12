# Quick Start Guide

Get started with Cocos MCP Server v2.0 in 5 minutes.

## Installation

1. **Open Cocos Creator** (3.5+)
2. **Go to**: Extension Manager → Install Extension
3. **Enter path**: `path/to/cocos-mcp-server`
4. **Click**: Install

Extension appears in the editor window.

## Start the Server

1. **Open the extension panel**: Panel tab → Cocos MCP Server
2. **Click**: "Start Server" button
3. **Confirm**: Server status shows "Running" and port (default: 3000)

Alternative (CLI): Set `autoStart: true` in `settings/mcp-server.json`

## Test the Connection

**Using curl** (or any HTTP client):

```bash
# Health check
curl http://127.0.0.1:3000/health

# Response
{"status":"ok","tools":21}
```

## Connect with Claude

### Option 1: MCP Configuration (Recommended)

Add to your Claude configuration file (`.claude/mcp.json` or similar):

```json
{
  "mcpServers": {
    "cocos": {
      "command": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "type": "stdio"
    }
  }
}
```

Restart Claude and you'll have access to all 21 Cocos tools.

### Option 2: Manual Testing

Use `curl` or Postman to test:

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

## Common First Steps

### 1. Create a Node

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "manage_node",
      "arguments": {
        "action": "create",
        "parentUuid": "root",
        "name": "MyNewNode"
      }
    }
  }'
```

### 2. Query Scene Hierarchy

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "resources/read",
    "params": {
      "uri": "cocos://scene/hierarchy"
    }
  }'
```

### 3. Add Component to Node

Replace `{nodeUuid}` with actual UUID:

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "manage_component",
      "arguments": {
        "action": "add",
        "nodeUuid": "{nodeUuid}",
        "componentType": "cc.Sprite"
      }
    }
  }'
```

## Tool Manager (Enable/Disable Tools)

1. **Open extension panel**: Panel tab → Cocos MCP Server
2. **Switch to**: Tool Manager tab
3. **Toggle tools**: Checkboxes next to each tool
4. **Save configuration**: Click "Save Configuration"

Only enabled tools appear in the MCP `/tools/list` response.

## Server Settings

**File**: `settings/mcp-server.json` (created in project root)

Edit to configure:
- `port` — Server port (default: 3000)
- `autoStart` — Auto-start on extension load (default: false)
- `enableDebugLog` — Console logging (default: false)
- `allowedOrigins` — CORS origins (default: ["*"])
- `maxConnections` — Concurrent clients (default: 10)

**GUI Settings**: Open extension panel → Settings tab

## Access Resources

MCP resources provide read-only snapshots of editor state:

1. **Editor State**: `cocos://editor/state`
   - Cocos version, project info, scene status

2. **Scene Hierarchy**: `cocos://scene/hierarchy`
   - Complete node tree with components

3. **Project Info**: `cocos://project/info`
   - Project metadata, available scenes

4. **Component Types**: `cocos://scene/components`
   - Registered component classes

Query via `/resources/read` endpoint:

```bash
curl -X POST http://127.0.0.1:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "resources/read",
    "params": {
      "uri": "cocos://editor/state"
    }
  }'
```

## Troubleshooting

### Server won't start

**Error**: "Port already in use"
- Solution: Change port in settings or stop other servers on that port

**Error**: "Failed to start server"
- Solution: Check Cocos Creator logs for details
- Enable `enableDebugLog` in settings

### Tools not executing

**Error**: "Unknown action"
- Solution: Check tool schema via `/tools/list` for valid actions

**Error**: "Node not found"
- Solution: Verify UUID is correct using `resources/read` with `cocos://scene/hierarchy`

### Extension won't load

**Error**: "Extension load failed"
- Solution: Check that extension path is correct
- Verify `package.json` exists in root

## Next Steps

1. **Read full docs**: See `/docs/` directory for complete documentation
2. **Explore API**: Check `docs/api-reference.md` for all 21 tools
3. **Setup Claude**: Use MCP configuration to connect Claude to editor
4. **Create workflows**: Automate scene building with AI assistance

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/system-architecture.md` | Complete system design and data flows |
| `docs/code-standards.md` | Development standards and patterns |
| `docs/project-overview-pdr.md` | Project overview and requirements |
| `docs/api-reference.md` | Complete API documentation for all tools |
| `CLAUDE.md` | Quick reference for developers |

## Support

- **Issues**: GitHub Issues (if applicable)
- **Documentation**: Read `/docs` files
- **Forum**: Cocos Creator forums and Discord
- **Debug**: Enable `enableDebugLog` in settings, check console output

## Example: AI-Powered Scene Generation

With Claude + MCP configured:

**Prompt**:
> "Create a game scene with a player sprite at (100, 100), add a RigidBody component to it, then create 5 enemy nodes as children with Sprite components."

**Claude will**:
1. Call `manage_node.create` to make player node
2. Call `manage_component.add` to add RigidBody
3. Call `manage_node.create` 5 times for enemies
4. Call `manage_component.add` for each enemy's Sprite

All operations synchronized with your editor in real-time.

## Performance Tips

- **Batch operations**: Group related calls to reduce latency
- **Query before modify**: Use resources/read to get current state
- **Disable unused tools**: Use Tool Manager to improve response times
- **Monitor connections**: Check `/health` endpoint periodically

## Security Reminder

- Server listens only on `127.0.0.1` (localhost)
- Assumed to run in trusted editor environment
- No authentication needed
- All scene operations are immediate and visible in editor
