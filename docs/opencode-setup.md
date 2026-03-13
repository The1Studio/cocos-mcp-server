# OpenCode Setup Guide

How to use this Cocos MCP Server with [OpenCode](https://opencode.ai/) — an open-source AI coding CLI.

## Prerequisites

- OpenCode installed (`go install github.com/opencode-ai/opencode@latest` or via release binary)
- Cocos Creator 3.5+ with this extension installed and server running
- Server endpoint: `http://127.0.0.1:3000/mcp` (default port)

## Quick Setup

### 1. Add MCP Configuration

Create or update `opencode.json` in your Cocos Creator project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "cocos-creator": {
      "type": "remote",
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

Or use the CLI wizard:

```bash
opencode --add-mcp
# Select "remote", enter name "cocos-creator", URL "http://127.0.0.1:3000/mcp"
```

### 2. Verify Connection

```bash
# Health check
curl http://127.0.0.1:3000/health

# Start OpenCode in your project
opencode
```

The Cocos MCP tools should appear in OpenCode's tool list automatically.

## Configuration Options

### Custom Port

If you changed the server port in Cocos Creator's MCP panel, update the URL accordingly:

```json
{
  "mcp": {
    "cocos-creator": {
      "type": "remote",
      "url": "http://127.0.0.1:YOUR_PORT/mcp"
    }
  }
}
```

### Per-Agent MCP Access

Restrict MCP access to specific agents:

```json
{
  "agent": {
    "cocos-builder": {
      "description": "Cocos Creator scene builder",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "tools": {
        "write": true,
        "edit": true,
        "bash": true
      }
    }
  },
  "mcp": {
    "cocos-creator": {
      "type": "remote",
      "url": "http://127.0.0.1:3000/mcp",
      "agent": ["cocos-builder"]
    }
  }
}
```

## Claude Code Compatibility

OpenCode reads `.claude/` directories as fallback. If you already have Claude Code configured with this MCP server, OpenCode can pick up skills and agents from `.claude/skills/` automatically — no duplication needed.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tools not showing | Verify server is running in Cocos Creator panel |
| Connection refused | Check port matches editor config, firewall allows localhost |
| Timeout errors | Ensure Cocos Creator editor is open with a scene loaded |
