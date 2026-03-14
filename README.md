# Cocos Creator MCP Server Plugin

**[📖 English](README.md)** **[📖 中文](README.CN.md)**

An MCP (Model Context Protocol) server plugin for Cocos Creator 3.5+. Enables AI assistants to interact with the Cocos Creator editor through a standardized protocol.

**50 core tools covering 99% of editor functionality!**

- **[📖 Full Feature Guide (English)](FEATURE_GUIDE_EN.md)**
- **[📖 Full Feature Guide (中文)](FEATURE_GUIDE_CN.md)**

## Video Demo

[<img width="503" height="351" alt="Demo Video" src="https://github.com/user-attachments/assets/f186ce14-9ffc-4a29-8761-48bdd7c1ea16" />](https://www.bilibili.com/video/BV1mB8dzfEw8?spm_id_from=333.788.recommend_more_video.0&vd_source=6b1ff659dd5f04a92cc6d14061e8bb92)

---

## Requirements

- Cocos Creator 3.5.0+ (3.8.6+ recommended)
- Node.js (bundled with Cocos Creator)
- Git

---

## Installation

> **For AI agents:** Follow these steps sequentially. All commands run from the Cocos Creator project root directory.

### Step 1: Verify Cocos Creator Project

Confirm the current directory is a Cocos Creator project:

```bash
# MUST have an assets/ directory
ls assets/
```

If `assets/` does not exist, you are not in a Cocos Creator project root. Navigate to the correct directory first.

### Step 2: Clone the Plugin

```bash
# Clone into extensions directory
mkdir -p extensions
git clone https://github.com/nicekid1/cocos-mcp-server.git extensions/cocos-mcp-server
```

If the plugin already exists, pull latest instead:

```bash
cd extensions/cocos-mcp-server && git pull && cd ../..
```

### Step 3: Install Dependencies

```bash
cd extensions/cocos-mcp-server
npm install --production
cd ../..
```

### Step 4: Start the MCP Server

The user must start the server from Cocos Creator editor:

1. Open the project in Cocos Creator
2. Go to `Extensions > Cocos MCP Server`
3. Click **"Start Server"**
4. Default port: **3000**

### Step 5: Verify Server is Running

```bash
curl http://127.0.0.1:3000/health
```

Expected: JSON response with `status: "ok"`.

---

## MCP Client Setup

> **For AI agents:** After installation, register the MCP server in your client config. Pick the section matching your client.

### Claude Code (CLI)

Run this command:

```bash
claude mcp add --transport http cocos-creator http://127.0.0.1:3000/mcp
```

### OpenCode

Create or update `opencode.json` in the project root:

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

### Claude Desktop

Add to Claude Desktop config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cocos-creator": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp"
    }
  }
}
```

### Cursor / VS Code

Add to MCP settings:

```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Other Clients

Protocol: HTTP transport, JSON-RPC 2.0. Endpoint: `http://127.0.0.1:3000/mcp`

> **Note:** If you changed the port in the editor panel, replace `3000` with your configured port in all URLs above.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Server won't start | Check port `3000` is not in use: `lsof -i :3000` |
| Health check fails | Ensure server is started in Cocos Creator editor panel |
| Build errors | Run `cd extensions/cocos-mcp-server && npm run build` |
| Connection refused | Verify URL and port match editor panel settings |
| Tools not working | Ensure a scene is open in Cocos Creator |

Enable **Debug Log** in the editor plugin panel for detailed logs.

---

## License

Source code included for learning and secondary development. Commercial use and resale prohibited — contact author for commercial licensing.

## Contact / Community

<img alt="QR Code" src="https://github.com/user-attachments/assets/a276682c-4586-480c-90e5-6db132e89e0f" width="400" height="400" />
