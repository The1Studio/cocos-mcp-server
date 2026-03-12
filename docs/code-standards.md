# Code Standards (v2.0)

Development standards and conventions for Cocos MCP Server v2.0.

## Project Structure

```
source/
├── main.ts                 # Extension entry point, load/unload hooks
├── mcp-server.ts          # HTTP server, JSON-RPC 2.0 handler
├── scene.ts               # Scene context methods
├── settings.ts            # Settings persistence
├── types/
│   └── index.ts           # All TypeScript interfaces and types
├── tools/
│   ├── base-action-tool.ts        # Abstract base class for action tools
│   ├── manage-animation.ts        # 21 action tool implementations
│   ├── manage-asset.ts
│   ├── manage-broadcast.ts
│   ├── manage-component.ts
│   ├── manage-debug.ts
│   ├── manage-material.ts
│   ├── manage-node.ts
│   ├── manage-node-hierarchy.ts
│   ├── manage-prefab.ts
│   ├── manage-preferences.ts
│   ├── manage-project.ts
│   ├── manage-reference-image.ts
│   ├── manage-scene.ts
│   ├── manage-scene-query.ts
│   ├── manage-scene-view.ts
│   ├── manage-script.ts
│   ├── manage-selection.ts
│   ├── manage-server.ts
│   ├── manage-undo.ts
│   ├── manage-validation.ts
│   ├── component-tools.ts         # Legacy compatibility (deprecated)
│   └── tool-manager.ts            # Tool configuration management
├── resources/
│   ├── cocos-resources.ts         # MCP resource URIs implementation
│   └── resource-provider.ts       # Resource interface
├── panels/
│   └── *.vue                      # Vue 3 panel components
├── utils/
│   └── normalize.ts               # LLM input normalization
└── test/
    └── *                          # Test files

dist/                     # Compiled output (generated)
static/                   # HTML/CSS for panels
i18n/                     # Localization (en.js, zh.js)
```

## TypeScript Configuration

- **Target**: ES2017
- **Module**: CommonJS
- **Strict Mode**: Enabled
- **Declaration**: Generated for external use
- **Source Maps**: Enabled for debugging

Build: `npm run build` (source/ → dist/)
Watch: `npm run watch`

## Naming Conventions

### Files
- **Tool files**: `manage-{category}.ts` (kebab-case)
  - Examples: `manage-node.ts`, `manage-animation.ts`, `manage-scene-view.ts`
- **Utility files**: `{purpose}.ts` (kebab-case)
  - Example: `normalize.ts`
- **Other files**: PascalCase for classes, camelCase for utilities
  - Examples: `cocos-resources.ts`, `resource-provider.ts`

### Classes
- PascalCase (standard TypeScript convention)
- Action tool classes: `Manage{Category}` pattern
  - Examples: `ManageNode`, `ManageAnimation`, `ManageSceneView`
- Base classes prefixed with `Base`: `BaseActionTool`

### Constants
- UPPER_SNAKE_CASE for immutable constants
- Example: `const MAX_TOOL_SLOTS = 5;`

### Methods/Functions
- camelCase
- Verb-first for action methods: `execute`, `initialize`, `createNode`, `updateComponent`
- Predicate methods: `isValid`, `hasChildren`, `canExecute`

### Properties
- camelCase
- Readonly properties: `readonly` keyword
- Private properties: `private` prefix
- Protected properties: `protected` prefix

### MCP Tool Names
- Flat, kebab-case: `manage_node`, `manage_scene_view`, `manage_animation`
- **Action names** (within tools): camelCase or snake_case depending on convention
  - Example: `"create"`, `"update"`, `"setParent"`, `"query_nodes"`

### Input/Output Parameters
- Follow original casing from Cocos Creator API
- Examples: `uuid`, `nodeName`, `componentType`, `position`, `rotation`

## Action Tool Implementation Pattern

Every action tool extends `BaseActionTool` and follows this pattern:

```typescript
import { BaseActionTool, ActionToolResult, successResult, errorResult } from '..';

export class ManageCategory extends BaseActionTool {
  readonly name = "manage_category";

  readonly description = "Brief description of what this tool does for the LLM.";

  readonly actions = ["action1", "action2", "action3"];

  readonly inputSchema = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: this.actions,
        description: "Action to perform"
      },
      // Action-specific parameters follow
      paramName1: {
        type: "string",
        description: "Parameter description"
      },
      paramName2: {
        type: "number",
        description: "Parameter description"
      }
    },
    required: ["action"]
  };

  protected actionHandlers = {
    action1: async (args) => this.handleAction1(args),
    action2: async (args) => this.handleAction2(args),
    action3: async (args) => this.handleAction3(args)
  };

  private async handleAction1(args: Record<string, any>): Promise<ActionToolResult> {
    try {
      // Validate inputs
      if (!args.paramName1) {
        return errorResult("paramName1 is required");
      }

      // Perform action
      const result = await Editor.Message.request('scene', 'method-name', {
        // Pass to scene context
      });

      // Return success
      return successResult(result, "Action completed successfully");
    } catch (error: any) {
      return errorResult(`Failed to perform action: ${error.message}`);
    }
  }

  private async handleAction2(args: Record<string, any>): Promise<ActionToolResult> {
    // Similar pattern...
  }

  private async handleAction3(args: Record<string, any>): Promise<ActionToolResult> {
    // Similar pattern...
  }
}
```

## Input Validation Pattern

```typescript
// Always validate required parameters first
if (!args.uuid) return errorResult("uuid is required");
if (!args.name || args.name.trim() === "") return errorResult("name cannot be empty");

// Validate parameter types if needed
if (typeof args.position !== "object") return errorResult("position must be an object");
if (!Array.isArray(args.nodeList)) return errorResult("nodeList must be an array");

// Normalize input if needed (use source/utils/normalize.ts)
const normalizedName = normalize(args.name);
```

## Error Handling

**Tool-level errors** (within action handlers):
```typescript
try {
  const result = await Editor.Message.request('scene', 'create-node', args);
  return successResult(result, "Node created successfully");
} catch (error: any) {
  return errorResult(`Failed to create node: ${error.message}`);
}
```

**Expected errors** (validation failures):
```typescript
if (!uuid) return errorResult("uuid parameter is required");
if (position.x === undefined) return errorResult("position.x is required");
```

**Unexpected errors** (with helpful context):
```typescript
catch (error: any) {
  console.error('[ManageTool] Unexpected error:', error);
  return errorResult(`Unexpected error: ${error.message}. Please check editor logs.`);
}
```

## JSON Schema for MCP Tools

All tools define `inputSchema` as JSON Schema Draft 7 (for MCP compatibility):

```typescript
readonly inputSchema = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["create", "update", "delete", "query"],
      description: "Action to perform"
    },
    uuid: {
      type: "string",
      description: "Node UUID (required for update/delete)"
    },
    name: {
      type: "string",
      description: "Node name (required for create)"
    },
    properties: {
      type: "object",
      description: "Properties to set",
      properties: {
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            z: { type: "number" }
          }
        }
      }
    }
  },
  required: ["action"]
};
```

## Communication Patterns

### Editor Message (Scene Context)
```typescript
// Request from main context to scene context
const result = await Editor.Message.request('scene', 'method-name', {
  arg1: value1,
  arg2: value2
});
```

### IPC Messages (Panel ↔ Main)
```typescript
// From panel to main
Editor.Message.request('cocos-mcp-server', 'method-name', args);

// From main to panel
Editor.Message.broadcast('cocos-mcp-server:method-name', data);
```

## Type Safety

- Always use strict TypeScript types
- Avoid `any` type; use `Record<string, any>` for dynamic objects when necessary
- Use discriminated unions for variants
- Implement proper type guards for unsafe casts

```typescript
// Good
interface NodeCreateArgs {
  parentUuid: string;
  name: string;
  position?: { x: number; y: number; z: number };
}

// Avoid
async handleCreate(args: any) { }

// Better
async handleCreate(args: Record<string, any>): Promise<ActionToolResult> {
  if (!args.parentUuid) return errorResult("parentUuid required");
  // ...
}
```

## Logging

Use prefixed console logging for easy filtering:
```typescript
console.log('[ManageNode] Node created:', uuid);
console.warn('[ManageNode] Component not found:', componentType);
console.error('[ManageNode] Failed to update node:', error);
```

## Performance Guidelines

- Keep individual tool files under 200 lines
- Batch scene operations when possible
- Avoid recursive operations on large node trees
- Cache frequently accessed data (e.g., scene hierarchy)
- Use early returns to avoid nested conditionals

## Testing

No automated test runner is configured. Manual testing:
1. Build: `npm run build`
2. Open the extension in Cocos Creator
3. Test each action via the MCP endpoints or REST API

Verify:
- Tool actions execute without errors
- Responses follow `ActionToolResult` format
- Input validation catches invalid parameters
- Scene state updates correctly

## Documentation Comments

Use TSDoc comments for exported interfaces and public methods:

```typescript
/**
 * Creates a new scene node.
 *
 * @param parentUuid - UUID of the parent node (root if empty)
 * @param name - Name for the new node
 * @param position - Initial world position (optional)
 * @returns Node creation result with UUID
 */
async handleCreate(args: Record<string, any>): Promise<ActionToolResult>
```

## Deprecation

Mark deprecated code with `@deprecated`:
```typescript
/**
 * @deprecated Use manage_node instead
 */
export class OldToolName extends BaseActionTool { }
```

Old v1 tool files (e.g., `*-tools.ts` from before v2.0) should be gradually removed. Current deprecated file: `component-tools.ts` (use `manage_component.ts` instead).

## Security

- Validate all inputs before processing
- Sanitize strings for logging
- Never log sensitive data (passwords, API keys)
- All server operations run in trusted editor context
- No user authentication required (server is localhost-only)

## Dependencies

Core dependencies:
- `uuid` - UUID generation
- `@cocos/creator-types` - Cocos Creator type definitions

No heavy dependencies for runtime efficiency.

## Build Artifacts

Generated files (do not edit):
- `dist/` - Compiled JavaScript
- `*.d.ts` - TypeScript declarations
- Source maps for debugging

Clean build: Delete `dist/` before `npm run build`.
