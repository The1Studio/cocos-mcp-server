# Code Review: Utility & System Management Tools

**Reviewer**: code-reviewer
**Date**: 2026-03-13
**Scope**: 13 tool files (manage-asset, manage-project, manage-debug, manage-server, manage-broadcast, manage-preferences, manage-selection, manage-undo, manage-validation, manage-script, manage-material, manage-animation, manage-reference-image)
**LOC**: ~1,950
**Build**: Compiles clean (tsc passes)

---

## Critical Issues

### C1. Arbitrary Script Execution Without Sanitization (SECURITY)
**File**: `source/tools/manage-debug.ts:191-206`
**Impact**: Remote code execution. Any string passed as `script` is forwarded directly to `execute-scene-script` with no validation, sanitization, or sandboxing.

```typescript
private async executeScript(script: string): Promise<ActionToolResult> {
    return new Promise((resolve) => {
        Editor.Message.request('scene', 'execute-scene-script', {
            name: 'console',
            method: 'eval',
            args: [script]
        })
```

While MCP runs on localhost and the AI client is trusted, there is no guard against:
- Scripts that crash the editor (infinite loops, process.exit)
- File system access via Node APIs in scene context
- No length limit on script input

**Suggested fix**: Add a script length limit and basic deny-list for dangerous patterns (`process.exit`, `require('child_process')`, `fs.unlinkSync`). At minimum, document the risk in the tool description so the LLM knows to be careful.

### C2. Hardcoded User Path in Log Resolution (SECURITY + CORRECTNESS)
**File**: `source/tools/manage-debug.ts:357`

```typescript
const possiblePaths = [
    Editor.Project ? Editor.Project.path : null,
    '/Users/lizhiyong/NewProject_3',  // <-- hardcoded personal path
    process.cwd(),
];
```

This is a leftover development path. It leaks a developer's username and will never match on other machines. It should be removed.

**Fix**: Remove the hardcoded path. The `Editor.Project.path` and `process.cwd()` fallbacks are sufficient.

### C3. CSV Injection in Asset Manifest Export
**File**: `source/tools/manage-asset.ts:743-757`

```typescript
private convertToCSV(data: any[]): string {
    // ...
    const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
    csvRows.push(values.join(','));
}
```

No CSV escaping. Values containing commas, quotes, or newlines will break the CSV. Additionally, values starting with `=`, `+`, `-`, `@` enable CSV injection if opened in Excel. Asset names are user-controlled.

**Fix**: Wrap each value in quotes and escape internal quotes:
```typescript
const escaped = String(value).replace(/"/g, '""');
return `"${escaped}"`;
```

---

## Important Issues

### I1. File Path Traversal Not Validated (manage-asset, manage-script)
**Files**: `manage-asset.ts:112`, `manage-script.ts:148-154`

`importAsset` accepts `sourcePath` from the network and passes it to `fs.existsSync` and then to the Editor's import API. `readScript` resolves a URL to a filesystem path and reads it with `fs.readFileSync`. Neither validates that paths stay within the project directory.

While the Cocos Editor API should enforce bounds on `db://` URLs, the `sourcePath` parameter in `importAsset` is a raw filesystem path. An attacker could read or import files from outside the project.

**Suggested fix**: Validate that resolved paths are within `Editor.Project.path` before performing filesystem operations.

### I2. `new Promise(async ...)` Anti-Pattern (6 occurrences)
**Files**: `manage-asset.ts:378,428,531,603,633,688`

```typescript
private async findAssetByName(args: any): Promise<ActionToolResult> {
    return new Promise(async (resolve) => {  // <-- anti-pattern
```

Using an async executor in `new Promise` swallows errors thrown before the first `await`. If an exception occurs, it will result in an unhandled rejection rather than being caught by the Promise.

**Fix**: Remove the Promise wrapper since the method is already `async`:
```typescript
private async findAssetByName(args: any): Promise<ActionToolResult> {
    try {
        // ... use await directly, return successResult/errorResult
    } catch (error: any) {
        return errorResult(`Asset search failed: ${error.message}`);
    }
}
```

### I3. Missing Required Parameter Validation in Multiple Tools
Several action handlers do not validate required parameters before using them, which would produce cryptic errors:

| File | Action | Missing validation |
|------|--------|--------------------|
| `manage-asset.ts:82` | `import` | `sourcePath`, `targetFolder` not checked |
| `manage-asset.ts:90` | `save` | `content` not checked |
| `manage-asset.ts:93` | `query_uuid` | `url` not checked |
| `manage-asset.ts:94` | `query_url` | `uuid` not checked |
| `manage-undo.ts:36` | `begin_recording` | `nodeUuid` not checked |
| `manage-undo.ts:46` | `end_recording` | `undoId` not checked |
| `manage-undo.ts:56` | `cancel_recording` | `undoId` not checked |

**Fix**: Add early-return validation for each required parameter, returning a clear error message.

### I4. Entire Log File Read Into Memory
**File**: `manage-debug.ts:377,417,438`

`getProjectLogs`, `getLogFileInfo`, and `searchProjectLogs` all call `fs.readFileSync(logFilePath, 'utf8')` loading the entire log file into memory. For long-running projects, log files can be several hundred MB.

**Fix**: Use `fs.createReadStream` with line-by-line reading, or at minimum use `readline` to only read the last N lines. For `getLogFileInfo`, only `fs.statSync` is needed to get file size -- no need to read the full content just to count lines.

### I5. `formatRequest` Uses Hardcoded Port 8585 Instead of 3000
**File**: `manage-validation.ts:182`

```typescript
return `curl -X POST http://127.0.0.1:8585/mcp \\...`
```

The CLAUDE.md says the default endpoint is port 3000, but the generated curl command uses 8585. This will confuse users.

**Fix**: Use the actual configured port, or at least match the documented default of 3000.

### I6. Broadcast Listeners Are Never Actually Registered
**File**: `manage-broadcast.ts:87-88`

```typescript
// Editor.Message.on(messageType, listener); -- API may not support
console.log(`[ManageBroadcast] Added listener for ${messageType} (simulated)`);
```

The entire broadcast tool is non-functional. Listeners are created in memory but never connected to the Editor's message system. The `messageLog` will always be empty. This is misleading -- the tool claims to work but silently does nothing.

**Fix**: Either implement using the actual Editor API, or update the tool description to clearly state it is a stub/placeholder. Consider removing from the tool list if it cannot function.

### I7. Console Capture Not Implemented
**File**: `manage-debug.ts:114-119`

```typescript
private setupConsoleCapture(): void {
    console.log('Console capture setup - implementation depends on Editor API availability');
}
```

`get_console_logs` will always return empty results. The `addConsoleMessage` method exists but is never called. Same issue as I6 -- tool advertises functionality it does not deliver.

### I8. Unused Variable `debug` in `buildProject`
**File**: `manage-project.ts:79`

```typescript
const debug: boolean = args.debug !== false && args.debug !== 'false';
```

This variable is computed but never used. The build action just opens the build panel.

---

## Minor Issues

### M1. Inconsistent Boolean Coercion
**Files**: `manage-asset.ts:86-88` vs `manage-debug.ts:146-147`

`manage-asset` manually coerces booleans:
```typescript
args.overwrite === true || args.overwrite === 'true'
```

While `manage-debug` uses the normalize utility:
```typescript
coerceBool(args.checkMissingAssets) ?? true
```

**Fix**: Use `coerceBool` from `normalize.ts` consistently across all tools.

### M2. `ManageServer.getStatus` Hardcodes MCP Port
**File**: `manage-server.ts:104`

```typescript
status.mcpServerPort = 3000;
```

The port is configurable in settings but hardcoded here.

### M3. Redundant `DEFAULT_ANIM_CLIP` Constant
**File**: `manage-animation.ts:5-19`

The `DEFAULT_ANIM_CLIP` constant is defined but never used. The `createClip` method constructs the clip data inline (lines 82-96).

### M4. `getLogFileInfo` Returns `fs.constants.R_OK` as `accessible`
**File**: `manage-debug.ts:427`

```typescript
accessible: fs.constants.R_OK
```

This returns the numeric constant (4), not the actual accessibility check result. It should use `fs.accessSync(logFilePath, fs.constants.R_OK)` wrapped in try/catch to return a boolean.

### M5. `ManageProject.startPreviewServer` and `stopPreviewServer` Always Fail
**File**: `manage-project.ts:185-205`

These methods always return error results. They should either be removed from the actions list or the description should indicate they are unsupported.

### M6. XML Escaping Incomplete
**File**: `manage-asset.ts:766-768`

Only `&`, `<`, `>` are escaped. Missing `"` and `'` escaping for attribute contexts. While currently values are only in element content, this is fragile.

### M7. `fixJsonString` Regex is Fragile
**File**: `manage-validation.ts:129-143`

The regex-based JSON fixer replaces single quotes globally with double quotes (line 141), which will break valid JSON strings containing apostrophes. The nested quote escaping regex (line 132) uses a pattern that can't reliably handle arbitrary nesting.

---

## Cross-Tool Patterns

### P1. DRY Violations: Repeated `new Promise((resolve) => { Editor.Message.request(...).then(...).catch(...) })` Pattern

Nearly every method across all tools wraps `Editor.Message.request` in a `new Promise`. Since `Editor.Message.request` already returns a Promise, this is unnecessary boilerplate. ~80+ occurrences across the reviewed files.

**Better pattern**:
```typescript
private async deleteAsset(url: string): Promise<ActionToolResult> {
    try {
        await Editor.Message.request('asset-db', 'delete-asset', url);
        return successResult({ url }, 'Asset deleted successfully');
    } catch (err: any) {
        return errorResult(err.message);
    }
}
```

This is already used in some newer tools (manage-script, manage-material, manage-animation) but not in the older ones (manage-asset, manage-project, manage-server, manage-broadcast, manage-undo).

### P2. DRY Violation: Repeated `get_info` and `list` Patterns

`manage-script.getScriptInfo`, `manage-material.getMaterialInfo`, `manage-animation.getClipInfo` are nearly identical -- they all call `query-asset-info` and optionally `query-asset-meta`. Similarly, the `list` actions all call `query-assets` with a pattern.

Could be extracted to `BaseActionTool` helper methods:
```typescript
protected async queryAssetInfo(url: string): Promise<ActionToolResult> { ... }
protected async queryAssetList(pattern: string): Promise<ActionToolResult> { ... }
```

### P3. `any` Type Usage is Pervasive

Nearly every handler uses `args: any` or `Record<string, any>`. While this is partly inherent to MCP's dynamic nature, specific handler parameters could be typed with interfaces for better safety.

### P4. No Input Length Limits

None of the tools validate input lengths. A malicious or buggy LLM could send extremely large content strings (e.g., multi-MB script content to `manage_script.write`), huge arrays (batch_delete with thousands of URLs), or enormous JSON strings.

---

## Strengths

1. **Consistent error handling pattern**: All tools use `successResult`/`errorResult` helpers, giving uniform response shape.
2. **Good LLM descriptions**: Tool and action descriptions are clear, with cross-references ("use manage_node instead", "use query_db_ready before batch ops").
3. **Normalize utilities**: The `coerceBool`, `coerceInt`, `coerceFloat`, `normalizeStringArray` utilities handle common LLM input mistakes gracefully.
4. **Input schema with enums**: Action enums in `inputSchema` help LLMs pick valid actions.
5. **BaseActionTool abstraction**: Clean routing pattern with automatic unknown-action handling and top-level error catching.
6. **Newer tools are cleaner**: `manage-script`, `manage-material`, `manage-animation`, `manage-selection` use `try/catch + await` instead of Promise wrappers, showing code quality improvement over time.
7. **Schema defaults**: Good use of schema defaults for optional parameters.

---

## Summary Metrics

| Metric | Value |
|--------|-------|
| Critical issues | 3 |
| Important issues | 8 |
| Minor issues | 7 |
| Cross-tool patterns | 4 |
| Files reviewed | 13 + 3 supporting |
| Build status | Pass |
| Test coverage | N/A (no tests configured) |
| Type safety | Low (heavy `any` usage) |

## Priority Fixes

1. **[C2]** Remove hardcoded user path -- trivial fix, immediate
2. **[C1]** Add basic script execution guardrails
3. **[C3]** Fix CSV escaping
4. **[I5]** Fix hardcoded port in curl command
5. **[I1]** Add path traversal validation for filesystem operations
6. **[I2]** Remove `new Promise(async ...)` anti-pattern (6 spots)
7. **[I3]** Add missing parameter validation
8. **[I6/I7]** Either implement or clearly mark broadcast and console capture as stubs
9. **[P1]** Refactor Promise wrappers to async/await (tech debt, batch)

## Unresolved Questions

1. Is `execute_script` intentionally exposed without restrictions? If so, should the tool description warn the LLM explicitly about dangerous operations?
2. Should non-functional tools (broadcast listeners, console capture, preview start/stop) be removed entirely, or is the plan to implement them later?
3. The `manage_asset` tool has 26 actions -- is this too many for LLM ergonomics? Would splitting into `manage_asset` and `manage_asset_advanced` improve usability?
4. Should there be rate limiting on batch operations (`batch_import`, `batch_delete`) to avoid overwhelming the Editor?
