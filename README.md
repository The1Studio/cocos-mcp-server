# Cocos Creator MCP Server Plugin

**[📖 English](README.md)** **[📖 中文](README.CN.md)**

An MCP (Model Context Protocol) server plugin for Cocos Creator 3.5+. Enables AI assistants to interact with the Cocos Creator editor through a standardized protocol. One-click installation, no complex configuration required. Tested with Claude Desktop, Claude CLI, Cursor, and other major clients. Theoretically supports all other editors as well.

**50 core tools covering 99% of editor functionality!**

## Video Demo

[<img width="503" height="351" alt="Demo Video" src="https://github.com/user-attachments/assets/f186ce14-9ffc-4a29-8761-48bdd7c1ea16" />](https://www.bilibili.com/video/BV1mB8dzfEw8?spm_id_from=333.788.recommend_more_video.0&vd_source=6b1ff659dd5f04a92cc6d14061e8bb92)

## Quick Links

- **[📖 Full Feature Guide (English)](FEATURE_GUIDE_EN.md)** - Complete tool documentation (being updated)
- **[📖 Full Feature Guide (中文)](FEATURE_GUIDE_CN.md)** - Complete tool documentation (being updated)

---

## Quick Installation (Claude CLI Skill)

If you're using Claude CLI, you can install it to your Cocos 3.x project with one click using the `/cocos-mcp-setup` skill.

### Prerequisites

1. [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) must be installed.
2. The skill file (`skills/cocos-mcp-setup/SKILL.md`) must be configured for Claude to recognize.

### Skill Installation

Copy the `skills/` directory from this repository to your project's `.claude/skills/`, or register it as a global skill.

```bash
# Method 1: Copy as project local skill
mkdir -p .claude/skills
cp -r <cocos-mcp-server path>/skills/cocos-mcp-setup .claude/skills/

# Method 2: Copy as global skill (available in all projects)
mkdir -p ~/.claude/skills
cp -r <cocos-mcp-server path>/skills/cocos-mcp-setup ~/.claude/skills/
```

### Execution

Open Claude CLI in your Cocos Creator project root and enter:

```
/cocos-mcp-setup
```

The skill will automatically perform the following:

1. Verify current directory is a Cocos Creator project (checks for `assets/` folder)
2. Git clone the plugin to `extensions/cocos-mcp-server/` (or git pull if already exists)
3. Install dependencies with `npm install --production`

### Post-Installation Setup

```bash
# 1. Open the project in Cocos Creator editor
#    Start the server from Extensions > Cocos MCP Server panel.

# 2. MCP health check (use the port configured in the editor)
curl http://127.0.0.1:3000/mcp

# 3. Register MCP server with Claude CLI
claude mcp add --transport http --scope local cocos-creator http://127.0.0.1:3000/mcp
```

---

## Manual Installation

### 1. Copy Plugin

Copy the entire `cocos-mcp-server` folder to the `extensions` directory of your Cocos Creator project. You can also import directly from the editor's Extension Manager.

```
Project/
├── assets/
├── extensions/
│   └── cocos-mcp-server/          <- Place here
│       ├── source/
│       ├── dist/
│       ├── package.json
│       └── ...
├── settings/
└── ...
```

### 2. Install Dependencies

```bash
cd extensions/cocos-mcp-server
npm install
```

### 3. Build

```bash
npm run build
```

### 4. Activate Plugin

1. Restart Cocos Creator or refresh extensions.
2. The plugin will appear in the Extensions menu.
3. Click `Extensions > Cocos MCP Server` to open the control panel.

---

## MCP Client Configuration

### Claude CLI

```bash
claude mcp add --transport http cocos-creator http://127.0.0.1:3000/mcp
```

### Claude Desktop

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

### Cursor / VS Code Family

```json
{
  "mcpServers": {
    "cocos-creator": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### OpenCode

Add to `opencode.json` in your project root:

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

### Other MCP-Compatible Clients

This server uses standard HTTP transport with JSON-RPC 2.0. Any MCP-compatible client can connect to `http://127.0.0.1:3000/mcp`.

> Change the port number to the value configured in the editor panel. Default is 3000.

---

## Usage

### Starting the Server

1. Open the MCP Server panel from `Extensions > Cocos MCP Server`.
2. Configuration options:
   - **Port**: HTTP server port (default: 3000)
   - **Auto Start**: Automatically start server when editor launches
   - **Debug Log**: Detailed logging for development debugging
   - **Max Connections**: Maximum concurrent connections
3. Click the "Start Server" button.

### Connecting AI Assistant

The server provides an HTTP endpoint at `http://localhost:3000/mcp` (or your configured port). AI assistants can connect via MCP protocol to access all tools.

---

## Tool System

All tools are named in "category_action" format, using unified Schema parameters and action codes. 50 core tools cover the entire editor functionality.

### Call Example

```json
{
  "tool": "node_lifecycle",
  "arguments": {
    "action": "create",
    "name": "MyNode",
    "parentUuid": "parent-uuid",
    "nodeType": "2DNode"
  }
}
```

---

## Feature List

### Scene Operations (scene_*)
- **scene_management**: Scene management - query current scene, open/save/create/close, list scenes
- **scene_hierarchy**: Scene hierarchy - query entire scene structure, including component information
- **scene_execution_control**: Execution control - execute component methods, run scene scripts, sync prefabs

### Node Operations (node_*)
- **node_query**: Node query - search nodes by name/pattern, query node info, detect 2D/3D types
- **node_lifecycle**: Node lifecycle - create/delete, pre-attach components, instantiate prefabs
- **node_transform**: Node transform - modify name, position, rotation, scale, visibility, etc.
- **node_hierarchy**: Node hierarchy - move, copy, paste, hierarchy manipulation
- **node_clipboard**: Node clipboard - copy/paste/cut
- **node_property_management**: Property management - initialize node, component, transform properties

### Component Operations (component_*)
- **component_manage**: Component management - add/remove engine components (cc.Sprite, cc.Button, etc.)
- **component_script**: Script components - attach/remove custom scripts
- **component_query**: Component query - component list, details, available types
- **set_component_property**: Property setting - set single/multiple component property values

### Prefab Operations (prefab_*)
- **prefab_browse**: Prefab browsing - list query, info check, file validation
- **prefab_lifecycle**: Prefab lifecycle - create prefab from node, delete
- **prefab_instance**: Prefab instance - instantiate in scene, unlink, apply changes, restore original
- **prefab_edit**: Prefab editing - enter/exit edit mode, save, test changes

### Project Control (project_*)
- **project_manage**: Project management - run, build, query project info and settings
- **project_build_system**: Build system - build panel control, check build status, preview server management

### Debug Tools (debug_*)
- **debug_console**: Console management - query/clear console logs, filtering and limiting
- **debug_logs**: Log analysis - read/search/analyze project log files, pattern matching
- **debug_system**: System debug - editor info, performance stats, environment info

### Resource Management (asset_*)
- **asset_manage**: Resource management - batch import/delete, save metadata, generate URLs
- **asset_analyze**: Resource analysis - query dependencies, export resource manifest
- **asset_system**: Resource system - refresh resources, query DB status
- **asset_query**: Resource query - query by type/folder, detailed info
- **asset_operations**: Resource operations - create/copy/move/delete/save/reimport

### Preferences (preferences_*)
- **preferences_manage**: Preferences management - query/set editor preferences
- **preferences_global**: Global settings - global configuration and system settings management

### Server & Broadcast (server_* / broadcast_*)
- **server_info**: Server info - server status, project info, environment info
- **broadcast_message**: Message broadcast - receive and send custom messages

### Reference Images (referenceImage_*)
- **reference_image_manage**: Reference image management - add/remove/manage reference images in scene view
- **reference_image_view**: Reference image view - display and editing control

### Scene View (sceneView_*)
- **scene_view_control**: Scene view control - Gizmo tools, coordinate system, view mode control
- **scene_view_tools**: Scene view tools - various tools and options management

### Validation Tools (validation_*)
- **validation_scene**: Scene validation - check scene integrity, inspect missing resources
- **validation_asset**: Resource validation - check resource references and integrity

### Tool Management
- **Tool Configuration System**: Selective enable/disable of tools, multiple configuration support
- **Configuration Persistence**: Automatic save and load
- **Import/Export Configuration**: Tool configuration file exchange
- **Real-time State Management**: Real-time tool state updates and synchronization

---

## Key Advantages

- **Unified Action Codes**: All tools use "category_action" naming, unified parameter Schema
- **High Reusability**: 50 core tools cover 99% of editor functionality
- **AI-Friendly**: Clear parameters, complete documentation, simple invocation
- **Performance Optimized**: 50% token consumption reduction, improved AI call success rate
- **Full Compatibility**: 100% alignment with Cocos Creator official APIs

---

## Changelog

### v1.5.0 - July 29, 2025 (Cocos Store update complete, GitHub version syncs in next release)

Cocos Store: https://store.cocos.com/app/detail/7941

- **Tool Consolidation & Refactoring**: Compressed existing 150+ tools into 50 high-reusability, high-coverage core tools, removed all unnecessary code
- **Unified Action Codes**: Applied "action code + parameters" pattern to all tools, greatly simplified AI call flow, 50% token reduction
- **Full Prefab Upgrade**: Completely fixed and enhanced all core prefab functions including creation, instantiation, synchronization, and references
- **Event Binding & Legacy Feature Completion**: Completed implementation of event binding, node/component/resource legacy features
- **Interface Optimization**: Clarified all interface parameters, improved documentation
- **Plugin Panel Optimization**: Simplified panel UI, improved operational intuitiveness
- **Performance & Compatibility Improvements**: Optimized overall architecture efficiency, compatible with all Cocos Creator versions 3.8.6+

### v1.4.0 - July 26, 2025 (Current GitHub Version)

#### Major Feature Fixes
- **Complete Prefab Creation Fix**: Fully resolved component/node/resource type reference loss issues during prefab creation
- **Correct Reference Handling**: Implemented reference format identical to manual creation
  - **Internal References**: Accurately convert node/component references within prefab to `{"__id__": x}` format
  - **External References**: Correctly set external node/component references to `null`
  - **Resource References**: Fully preserve UUID format for prefab, texture, sprite frame, and other resource references
- **Component/Script Removal API Standardization**: When removing, must pass the component's cid (type field). Cannot use script name or class name. Query the type field (cid) first with getComponents, then pass to removeComponent

#### Core Improvements
- **Index Order Optimization**: Adjusted prefab object creation order to match Cocos Creator standard format
- **Component Type Support**: Extended detection of all component type references starting with cc. (Label, Button, Sprite, etc.)
- **UUID Mapping Mechanism**: Enhanced internal UUID-index mapping system
- **Property Format Standardization**: Fixed component property order and format, resolved engine parsing errors

#### Bug Fixes
- Resolved `Cannot read properties of undefined (reading '_name')` error
- Resolved `placeHolder.initDefault is not a function` error
- Fixed issue where `_objFlags` and other core properties were overwritten by component data
- Fixed all types of references to save/load correctly

### v1.3.0 - July 25, 2025

- Added integrated tool management panel
- Tool configuration system (selective enable/disable, persistence)
- Dynamic tool loading (158 tools auto-discovery)
- Applied Vue 3 Composition API
- Fixed IPC communication issues

### v1.2.0 - Previous Version

- Initial release, 151 tools
- Basic MCP server functionality
- Scene, node, component, prefab operations
- Project control and debug tools

---

## Development

### Project Structure

```
cocos-mcp-server/
├── source/                    # TypeScript source
│   ├── main.ts               # Plugin entry
│   ├── mcp-server.ts         # MCP server implementation
│   ├── settings.ts           # Settings management
│   ├── types/                # TypeScript type definitions
│   ├── tools/                # Tool implementations
│   │   ├── scene-tools.ts
│   │   ├── node-tools.ts
│   │   ├── component-tools.ts
│   │   ├── prefab-tools.ts
│   │   ├── project-tools.ts
│   │   ├── debug-tools.ts
│   │   ├── preferences-tools.ts
│   │   ├── server-tools.ts
│   │   ├── broadcast-tools.ts
│   │   ├── scene-view-tools.ts
│   │   ├── reference-image-tools.ts
│   │   └── asset-advanced-tools.ts
│   ├── panels/               # UI panel implementations
│   └── test/                 # Test files
├── skills/                    # Claude CLI skills
│   └── cocos-mcp-setup/      # MCP installation skill
├── dist/                     # Compiled JavaScript output
├── static/                   # Static resources (icons, etc.)
├── i18n/                     # Internationalization files
├── package.json              # Plugin configuration
└── tsconfig.json             # TypeScript configuration
```

### Build from Source

```bash
# Install dependencies
npm install

# Development build (watch mode)
npm run watch

# Production build
npm run build
```

### Adding New Tools

1. Create new tool class in `source/tools/`
2. Implement the `ToolExecutor` interface
3. Add tool to `mcp-server.ts` initialization
4. Tool is automatically exposed through MCP protocol

---

## Troubleshooting

### Frequently Asked Questions

1. **Server won't start**: Check port availability and firewall settings
2. **Tools not working**: Verify scene is loaded and UUIDs are valid
3. **Build errors**: Check TypeScript errors with `npm run build`
4. **Connection issues**: Verify HTTP URL and server status

### Debug Mode

Enable debug logs in the plugin panel to view detailed operation logs.

---

## System Requirements

- Cocos Creator 3.5.0 or higher (3.8.6+ recommended)
- Node.js (bundled with Cocos Creator)
- TypeScript (installed as dev dependency)

## License

This plugin is for Cocos Creator projects and is packaged with source code. It can be used for learning and exchange purposes. It is not encrypted and can be directly modified/optimized for secondary development. However, commercial use and resale of this project's code or derivative code is prohibited. Please contact the author for commercial use requirements.

## Contact / Community

<img alt="QR Code" src="https://github.com/user-attachments/assets/a276682c-4586-480c-90e5-6db132e89e0f" width="400" height="400" />
