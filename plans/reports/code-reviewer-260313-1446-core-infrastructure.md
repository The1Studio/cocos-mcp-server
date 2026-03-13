# Code Review: Core Infrastructure

**Date**: 2026-03-13
**Scope**: mcp-server.ts, main.ts, settings.ts, types/index.ts, resources/, scene.ts, base-action-tool.ts, tool-manager.ts
**LOC**: ~1100 across 8 files
**Build**: Clean (tsc passes)

---

## Critical Issues

### C1. No request body size limit — Denial of Service
**File**: `source/mcp-server.ts:210-213`, `source/mcp-server.ts:353-356`
**Impact**: An attacker can send an infinitely large POST body, exhausting memory and crashing the Node.js process.

```typescript
// Current — unbounded accumulation
let body = '';
req.on('data', (chunk) => {
    body += chunk.toString();
});
```

**Fix**: Enforce a max body size (e.g., 1MB) and abort on exceed:
```typescript
const MAX_BODY = 1_048_576; // 1MB
let body = '';
req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > MAX_BODY) {
        res.writeHead(413);
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
        return;
    }
});
```

### C2. CORS allows all origins unconditionally — Security bypass
**File**: `source/mcp-server.ts:176`
**Impact**: `Access-Control-Allow-Origin: *` is hardcoded, ignoring the `allowedOrigins` setting entirely. Any website can make requests to the MCP server from the browser, enabling cross-site tool execution attacks.

```typescript
// Current — ignores settings.allowedOrigins
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Fix**: Check `this.settings.allowedOrigins` against the `Origin` request header:
```typescript
const origin = req.headers.origin || '';
const allowed = this.settings.allowedOrigins;
if (allowed.includes('*') || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
} else {
    res.writeHead(403);
    res.end(JSON.stringify({ error: 'Origin not allowed' }));
    return;
}
```

### C3. `fixCommonJsonIssues` silently corrupts valid JSON — Data integrity
**File**: `source/mcp-server.ts:313-332`
**Impact**: This function replaces ALL single quotes with double quotes (line 325), replaces all newlines (line 327), and applies regex on escape sequences. These transforms will corrupt valid JSON strings containing single quotes (e.g., `{"text": "it's fine"}` becomes `{"text": "it"s fine"}`) and break multiline string values. It runs as a fallback on parse failure but can make things worse.

```typescript
// This destroys valid content:
.replace(/'/g, '"')    // "it's" -> "it"s" -> parse error
.replace(/\n/g, '\\n') // Already-escaped \\n becomes \\\\n
```

**Fix**: Remove this function entirely. If JSON is malformed, return a clear error to the client. "Fixing" JSON from untrusted input is inherently unsafe and unreliable:
```typescript
// Just parse, no recovery attempt
try {
    message = JSON.parse(body);
} catch (parseError: any) {
    throw new Error(`Invalid JSON: ${parseError.message}`);
}
```

### C4. `setNodeProperty` allows arbitrary property injection
**File**: `source/scene.ts:272-274`
**Impact**: The fallback `(node as any)[property] = value` allows setting ANY property on a node object, including prototype properties. An attacker could set `__proto__`, `constructor`, or other sensitive properties.

```typescript
} else {
    // Try to set the property directly
    (node as any)[property] = value;
}
```

**Fix**: Whitelist allowed properties or at minimum guard against prototype pollution:
```typescript
const ALLOWED_PROPERTIES = new Set(['active', 'name', 'position', 'rotation', 'scale', 'layer', 'mobility']);
if (!ALLOWED_PROPERTIES.has(property)) {
    return { success: false, error: `Property '${property}' is not allowed. Allowed: ${[...ALLOWED_PROPERTIES].join(', ')}` };
}
```

### C5. `setComponentProperty` has same arbitrary property injection
**File**: `source/scene.ts:426`
**Impact**: The fallback `component[property] = value` allows setting any property on a component, including prototype properties.

```typescript
} else {
    component[property] = value;
}
```

**Fix**: Same approach — validate property name against a denylist at minimum:
```typescript
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
if (FORBIDDEN.has(property)) {
    return { success: false, error: `Property '${property}' is forbidden` };
}
```

---

## Important Issues

### I1. `updateSettings` fire-and-forget restart — unhandled rejection
**File**: `source/mcp-server.ts:462-468`
**Impact**: `this.start()` is async but called without `await` or `.catch()`. If the restart fails (e.g., port in use), the promise rejection is unhandled.

```typescript
public updateSettings(settings: MCPServerSettings) {
    this.settings = settings;
    if (this.httpServer) {
        this.stop();
        this.start(); // <-- async, no await, no catch
    }
}
```

**Fix**:
```typescript
public async updateSettings(settings: MCPServerSettings): Promise<void> {
    this.settings = settings;
    if (this.httpServer) {
        this.stop();
        await this.start();
    }
}
```

### I2. Same fire-and-forget in `main.ts:updateSettings`
**File**: `source/main.ts:68-74`
**Impact**: `mcpServer.start()` called without await after stop.

```typescript
mcpServer.stop();
mcpServer = new MCPServer(settings);
mcpServer.start(); // fire and forget
```

**Fix**: Add `await` and make the method async (it already returns to IPC which handles promises).

### I3. `handleMCPRequest` response can be sent after `res` is already closed
**File**: `source/mcp-server.ts:209-248`
**Impact**: The `req.on('end', async () => {...})` callback is not guarded. If the request is aborted or the connection drops before the callback completes, writing to `res` will throw. Similarly, `handleSimpleAPIRequest` (line 352-411) has the same pattern.

**Fix**: Check `res.writableEnded` before writing, or use `req.on('aborted', ...)`:
```typescript
req.on('aborted', () => { aborted = true; });
// ... in callback:
if (!res.writableEnded) {
    res.writeHead(200);
    res.end(JSON.stringify(response));
}
```

### I4. `maxConnections` setting is never enforced
**File**: `source/types/index.ts:6`, `source/mcp-server.ts`
**Impact**: The `maxConnections` setting exists in `MCPServerSettings` but is never checked. There is no connection limiting.

**Fix**: Either implement connection limiting via `http.Server.maxConnections` or remove the misleading setting.

### I5. `enableDebugLog` setting is never used
**File**: `source/types/index.ts:3`
**Impact**: The setting exists but is never referenced. All logging is unconditional `console.log`.

**Fix**: Conditionally log based on setting:
```typescript
private log(...args: any[]) {
    if (this.settings.enableDebugLog) console.log('[MCPServer]', ...args);
}
```

### I6. JSON-RPC 2.0 protocol violations
**File**: `source/mcp-server.ts:251-311`

Several deviations from the JSON-RPC 2.0 spec:

a. **Missing `jsonrpc` field validation**: The server never checks that `message.jsonrpc === '2.0'`. Per spec, this field is REQUIRED.

b. **Unknown method returns `-32603` (Internal Error)**: Per spec, unknown methods should return `-32601` (Method not found).

c. **Missing `params` validation**: For `tools/call` and `resources/read`, if `params` is undefined/null, destructuring will throw with an unhelpful error instead of returning `-32602` (Invalid params).

d. **Batch requests not handled**: JSON-RPC 2.0 allows arrays of requests. The server will crash on array input.

**Fix for (b)**:
```typescript
default:
    return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
    };
```

### I7. `ToolConfig` type mismatch between `types/index.ts` and `tool-manager.ts`
**File**: `source/types/index.ts:169-175` vs `source/tools/tool-manager.ts:6-10`
**Impact**: `types/index.ts` defines `ToolConfig` with a `category` field; `tool-manager.ts` defines its own `ToolConfig` without `category`. The exported type from `types/index.ts` is stale from v1 and misleading. CLAUDE.md says "no category field in v2" but the type still has one.

**Fix**: Remove `category` from the `ToolConfig` in `types/index.ts` or consolidate to a single definition.

### I8. `buildNodeTree` is unbounded recursion — stack overflow on deep scenes
**File**: `source/resources/cocos-resources.ts:122-143`
**Impact**: Deeply nested scene hierarchies (e.g., 10,000+ levels from imported models) will cause stack overflow. Same issue in `scene.ts:172-181` (`collectNodes`) and `scene.ts:297-317` (`processNode`).

**Fix**: Convert to iterative traversal or add a max depth guard:
```typescript
private buildNodeTree(node: any, depth = 0): any {
    if (depth > 100) return { uuid: node.uuid, name: node.name, truncated: true };
    // ...
    result.children = node.children.map((child: any) => this.buildNodeTree(child, depth + 1));
}
```

### I9. `createPrefabFromNode` is a fake implementation
**File**: `source/scene.ts:329-355`
**Impact**: The function claims success but does not actually create a prefab. The comment admits "This is a simulated implementation." This is misleading to the LLM client which will think the operation succeeded.

**Fix**: Either implement it properly using the Editor API or return an error indicating the operation is not supported in scene context.

### I10. Async asset loading returns synchronously in `setComponentProperty`
**File**: `source/scene.ts:383-399`, `source/scene.ts:405-419`
**Impact**: `assetManager.resources.load()` is async (callback-based), but the function returns `{ success: true }` immediately before the asset has loaded. The caller gets a success response while the property may never be set (silently failing if load fails).

```typescript
assetManager.resources.load(value, ..., (err, spriteFrame) => {
    // This runs AFTER the function already returned success
    component.spriteFrame = spriteFrame;
});
// ...
return { success: true, message: `Component property '${property}' updated successfully` };
```

**Fix**: Either await the load operation or return a warning that the operation is asynchronous.

---

## Minor Issues

### M1. `uuid` package imported but only used in tool-manager.ts
**File**: `source/mcp-server.ts:3`
**Impact**: `uuidv4` is imported but never used in `mcp-server.ts`. Dead import.

### M2. `clients` Map is maintained but never populated
**File**: `source/mcp-server.ts:30`
**Impact**: `this.clients` is never written to (no `set()` calls). `getClients()` always returns empty. `stop()` clears it unnecessarily. Dead code from WebSocket migration.

### M3. Duplicate method: `getServerSettings` and `getSettings` in `main.ts`
**File**: `source/main.ts:95-105`
**Impact**: Two IPC methods doing the exact same thing. Violates DRY.

### M4. `displayDescription` on `ToolConfig` in `types/index.ts` is unused
**File**: `source/types/index.ts:174`
**Impact**: The optional `displayDescription` field on `ToolConfig` is never set or read.

### M5. `ToolResponse` interface appears unused in v2
**File**: `source/types/index.ts:22-31`
**Impact**: `ToolResponse` and `ToolExecutor` (line 125-128) are v1 leftovers. No v2 code references them.

### M6. Error in `handleMCPRequest` leaks body content
**File**: `source/mcp-server.ts:229`
**Impact**: On parse error, the original body is included in the error message (`body.substring(0, 500)`). This could leak sensitive data in logs or error responses.

**Fix**: Remove body echoing from error responses.

### M7. `generateSampleParams` treats `false` as falsy default
**File**: `source/mcp-server.ts:449`
**Impact**: `propSchema.default || true` — if the default is `false`, it would be treated as falsy and `true` would be used instead. Same for `propSchema.default || 42` with `0`.

**Fix**: Use nullish coalescing: `propSchema.default ?? true`

---

## Strengths

1. **Clean v2 architecture**: The `BaseActionTool` + `actionHandlers` pattern is elegant and extensible. Adding new tools requires minimal boilerplate.

2. **Graceful error handling in BaseActionTool**: The `execute()` method catches handler exceptions and converts them to `errorResult`, preventing unhandled rejections from individual tools.

3. **Tool configuration persistence**: The `ToolManager` with sync, import/export, and max slots is well-designed for its purpose.

4. **Resource provider pattern**: Clean interface (`ResourceProvider`) with proper separation of concerns. The `CocosResources` implementation handles each resource independently with per-section try/catch so one failure doesn't break the whole response.

5. **Extension lifecycle**: `load()`/`unload()` properly creates and tears down the server. Auto-start with error catching is correctly implemented.

6. **Defensive defaults**: Settings use spread with defaults (`{ ...DEFAULT_SETTINGS, ...JSON.parse(content) }`), ensuring missing fields get sane values.

7. **Build is clean**: TypeScript strict mode enabled and compiles without errors.

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Critical issues | 5 (security + data integrity) |
| Important issues | 10 (error handling + protocol) |
| Minor issues | 7 (dead code + DRY) |
| Build status | Clean |
| Test coverage | 0% (no tests configured) |
| Type coverage | Moderate (many `any` casts, especially in scene.ts) |

## Priority Actions

1. **Immediately**: Add request body size limit (C1)
2. **Immediately**: Enforce `allowedOrigins` CORS check (C2)
3. **Immediately**: Remove `fixCommonJsonIssues` (C3)
4. **Immediately**: Guard against prototype pollution in scene.ts (C4, C5)
5. **Soon**: Fix unhandled promise rejections (I1, I2)
6. **Soon**: Fix JSON-RPC 2.0 compliance (I6)
7. **Soon**: Fix async asset loading returning sync success (I10)
8. **Later**: Clean up dead code (M1-M5)

## Unresolved Questions

- Is there any authentication/authorization planned? Currently any process on localhost can execute all tools.
- Should `manage_server` tool be able to modify its own server settings? This is a potential privilege escalation path.
- The `scene.ts` methods appear to be legacy v1 code — are they still invoked by any v2 tools, or are they dead code?
- Is the lack of test infrastructure intentional, or a gap to address?
