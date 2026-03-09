---
name: cocos-mcp-setup
description: Install MCP server to Cocos project
allowed-tools: Bash(ls:*), Bash(git:*), Bash(npm install:*)
---

Installs the cocos-mcp-server plugin to a Cocos Creator project.

## Constants

- **Git Repository**: `https://github.com/TinycellCorp/cocos-mcp-server.git`
- **Installation Path**: `extensions/cocos-mcp-server`

## Procedure

### 1. Verify Cocos Creator Project

Check if `assets/` folder exists in the current directory.

```bash
ls assets/
```

- If not found: Display "Current directory is not a Cocos Creator project. Please run from the Cocos Creator project root." and **stop**

### 2. Install Plugin

Branch based on whether `extensions/cocos-mcp-server/package.json` exists.

```bash
ls extensions/cocos-mcp-server/package.json
```

#### If exists (Update)

Display "Existing installation detected. Updating." and pull.

```bash
git -C extensions/cocos-mcp-server pull
```

#### If not exists (Fresh install)

```bash
git clone https://github.com/TinycellCorp/cocos-mcp-server.git extensions/cocos-mcp-server
```

- On error: Display "Plugin installation failed." and **stop**

### 3. Install Dependencies

Use `--prefix` option to specify target directory. (Do not use `cd` - to ensure allowed-tools matching)

```bash
npm install --production --prefix extensions/cocos-mcp-server
```

- On error: Display "npm install failed." and **stop**

### 4. Result Message

When all steps are complete, output the following:

```
## Installation Complete

Plugin: extensions/cocos-mcp-server/

### Next Steps

1. Open the project in Cocos Creator editor and start the MCP server from the Extension panel.
2. Check the port number configured in the editor, then register the MCP server with the command below.

MCP Health Check:
  curl http://127.0.0.1:{port}/mcp

MCP Registration:
  claude mcp add --transport http --scope local cocos-creator http://127.0.0.1:{port}/mcp
```

## Error Handling

- Do **not** retry with alternative methods when errors occur at any step
- Show the error content to the user as-is and **stop immediately**
