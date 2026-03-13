# Code Review: Scene & Node Management Tools

**Reviewer**: code-reviewer
**Date**: 2026-03-13
**Scope**: 8 files (base-action-tool, manage-scene, manage-node, manage-component, manage-prefab, manage-node-hierarchy, manage-scene-query, manage-scene-view)
**LOC**: ~2200

---

## Overall Assessment

The tool system is functional and well-structured around `BaseActionTool`. Descriptions are LLM-friendly with clear prerequisites and cross-tool references. However, there are several **critical anti-patterns** (Promise constructor anti-pattern, hardcoded URLs), **important missing validations**, and **significant DRY violations** across the codebase.

---

## Critical Issues

### C1. Promise Constructor Anti-Pattern with `async` (Multiple Files)

**Files**: manage-node.ts:150, manage-node.ts:539, manage-node.ts:758, manage-component.ts:70, manage-component.ts:133, manage-component.ts:277, manage-component.ts:707, manage-prefab.ts:223, manage-prefab.ts:295, manage-prefab.ts:339, manage-prefab.ts:454, manage-prefab.ts:510

`new Promise(async (resolve) => { ... })` is a dangerous anti-pattern. If an exception occurs in the async executor **before** any `resolve()` call but **after** the try/catch scope (or if the try doesn't cover all code paths), the promise silently swallows the error -- it never rejects.

```typescript
// BAD - manage-node.ts:150
private async createNode(args: any): Promise<ActionToolResult> {
    return new Promise(async (resolve) => {
        try { ... } catch (err: any) { resolve(errorResult(...)); }
    });
}
```

**Fix**: Remove the Promise wrapper entirely. These methods are already `async` -- just use `try/catch` with `return`:

```typescript
private async createNode(args: any): Promise<ActionToolResult> {
    try {
        // ... all the logic, replace resolve(x) with return x
    } catch (err: any) {
        return errorResult(`Failed to create node: ${err.message}`);
    }
}
```

This is the single most pervasive issue -- at least **12 occurrences** across 3 files.

### C2. Hardcoded localhost URL for Self-Call (manage-prefab.ts:582)

```typescript
const response = await fetch('http://localhost:8585/mcp', {
```

This hardcodes port 8585 but the server default is port 3000 (per CLAUDE.md). If the user configures a different port, this self-call silently fails. This is also a **v1 API call** (`component_get_components`) inside a v2 tool -- it will 404 if v1 tools are removed.

**Fix**: Either call `this.componentTools` directly (like ManageNode does) or read the configured port from settings. Remove the v1 tool name dependency.

### C3. Security: `execute_script` and `execute_method` Expose Arbitrary Code Execution

**manage-scene-query.ts:50** (`execute_script`) and **manage-node-hierarchy.ts:156** (`execute_method`) allow executing arbitrary methods on any scene object. While this is by design for an editor extension, there is **zero input validation** on method names or arguments.

```typescript
private async executeScript(name: string, method: string, args: any[] = [])
private async executeMethod(uuid: string, name: string, args: any[] = [])
```

**Recommendation**: At minimum, validate that `name` and `method` are non-empty strings and add a warning in the tool description that these are privileged operations. Consider a configurable allowlist.

---

## Important Issues

### H1. `getNodePath` Stops at "Canvas" Hardcoded (manage-node.ts:487)

```typescript
while (current && current.name !== 'Canvas') {
    path.unshift(current.name);
    current = current.parent;
}
```

Stops path construction at a node named "Canvas". In 3D scenes, there is no Canvas node -- the path will include the entire tree up to the root. In scenes with nested Canvas nodes or renamed Canvas nodes, the path is wrong. Also, the `node.parent` property from `query-node-tree` may not be populated (it depends on Cocos API version).

**Fix**: Stop at the scene root node (type `cc.Scene`) instead of a hardcoded name.

### H2. Missing Input Validation in ManageNodeHierarchy (manage-node-hierarchy.ts)

Action handlers use `coerceInt(args.target)!` with non-null assertion (line 51-52), but `coerceInt` returns `undefined` when the param is missing. The `!` suppresses TypeScript but passes `undefined` to the handler at runtime.

```typescript
move_array_element: (args) => this.moveArrayElement(args.uuid, args.path, coerceInt(args.target)!, coerceInt(args.offset)!),
```

The private methods have no null checks for `uuid`, `path`, `target`, or `offset`. Same issue for `remove_array_element` with `index`, and `copy/paste/cut` with `normalizeStringArray(args.uuids)!`.

**Fix**: Add validation at the start of each handler method, returning `errorResult()` for missing required params.

### H3. `moveNode` Ignores `keepWorldTransform` and `siblingIndex` (manage-node.ts:725-739)

The schema declares `keepWorldTransform` and `siblingIndex` as params for the `move` action, but the handler hardcodes `keepWorldTransform: false` and ignores `siblingIndex` entirely:

```typescript
private async moveNode(nodeUuid: string, newParentUuid: string, siblingIndex: number = -1) {
    // siblingIndex is accepted but never used
    Editor.Message.request('scene', 'set-parent', {
        parent: newParentUuid,
        uuids: [nodeUuid],
        keepWorldTransform: false  // hardcoded, ignores args
    })
}
```

**Fix**: Pass `keepWorldTransform` from args and implement `siblingIndex` support.

### H4. `duplicateNode` Ignores `includeChildren` (manage-node.ts:742-754)

The parameter `includeChildren` is accepted and defaulted to `true` but never passed to the Editor API:

```typescript
private async duplicateNode(uuid: string, includeChildren: boolean = true) {
    Editor.Message.request('scene', 'duplicate-node', uuid) // includeChildren not used
}
```

### H5. `checkAndRedirectNodeProperties` False Positives (manage-component.ts:1014)

```typescript
if (nodeBasicProperties.includes(property) || nodeTransformProperties.includes(property)) {
```

This catches **any** component property that happens to share a name with a node property (`name`, `active`, `position`, etc.). A custom script component could legitimately have a `name` or `position` property. The redirect fires even when `componentType` is not `cc.Node`.

**Fix**: Only redirect when `componentType` is `cc.Node` / `Node`, or when the property unambiguously doesn't exist on the target component (check after querying).

### H6. File Size Violations

- `manage-component.ts`: ~1065 lines
- `manage-prefab.ts`: ~1165 lines
- `manage-node.ts`: ~855 lines

All exceed the 200-line file size rule from development-rules.md. These should be split into focused modules (e.g., extract property setting logic, prefab creation helpers, node search utilities).

### H7. `saveSceneAs` Ignores `path` Parameter (manage-scene.ts:244-252)

```typescript
private async saveSceneAs(path: string): Promise<ActionToolResult> {
    (Editor.Message.request as any)('scene', 'save-as-scene').then(() => {
        resolve(successResult({ path, message: 'Scene save-as dialog opened' }));
    })
}
```

The `path` parameter is accepted but never sent to the Editor API. It opens a dialog (which may not work in headless/MCP context) and returns the input path as if it was used. This is misleading to the LLM.

### H8. Redundant `query-node-tree` Calls

Multiple methods in manage-node.ts independently call `Editor.Message.request('scene', 'query-node-tree')` for every find/get_all/find_by_name operation. For a scene with 1000+ nodes, rapid successive calls (common in LLM workflows) create unnecessary load.

---

## Medium Priority

### M1. Duplicated 2D/3D Component Classification (manage-node.ts)

The same component type lists appear in three places:
- `is2DNode()` (line 637-671)
- `detectNodeType()` (line 772-793)
- `getComponentCategory()` (line 836-853)

```typescript
// All three check the same lists:
comp.type.includes('cc.Sprite') || comp.type.includes('cc.Label') || ...
```

**Fix**: Extract constants `COMPONENT_2D_TYPES` and `COMPONENT_3D_TYPES` and a shared classifier method.

### M2. Inconsistent Return Types in ManagePrefab

Private methods return `Promise<any>` with raw `{ success, data, error }` objects instead of `ActionToolResult`. The handler methods then re-wrap them:

```typescript
// manage-prefab.ts:101
if (result.success) return successResult(result.data, result.message);
return errorResult(result.error || 'Failed to list prefabs');
```

This double-wrapping is fragile. If a private method forgets `message` or `error`, the handler silently returns generic messages.

**Fix**: Have private methods return `ActionToolResult` directly using `successResult()`/`errorResult()`.

### M3. `SceneInfo` Type Missing `path` in `getCurrentScene` (manage-scene.ts:53-83)

The `SceneInfo` interface requires `path`, but `getCurrentScene` doesn't include it in the returned object. TypeScript won't catch this because the return is typed as `ActionToolResult` with `data: any`.

### M4. `new Promise(resolve)` Wrapping Already-Promise APIs (Multiple Files)

Even non-async methods wrap `Editor.Message.request()` (which returns a Promise) in `new Promise((resolve) => { ... })`:

```typescript
// manage-scene.ts:86
private async getSceneList(): Promise<ActionToolResult> {
    return new Promise((resolve) => {
        Editor.Message.request(...).then(...)
    });
}
```

**Fix**: Use async/await directly:
```typescript
private async getSceneList(): Promise<ActionToolResult> {
    try {
        const results = await Editor.Message.request('asset-db', 'query-assets', ...);
        return successResult(scenes);
    } catch (err: any) {
        return errorResult(err.message);
    }
}
```

### M5. Fallback Pattern Duplication

Multiple methods repeat the same fallback pattern:
```typescript
Editor.Message.request('scene', 'someMethod', ...).then(...).catch((err) => {
    const options = { name: 'cocos-mcp-server', method: '...', args: [...] };
    Editor.Message.request('scene', 'execute-scene-script', options).then(...)
});
```

This appears in manage-node.ts (findNodes, findNodeByName, getAllNodes, setNodeProperty) and manage-scene.ts (getCurrentScene, getSceneHierarchy). Extract a shared `executeWithFallback()` helper.

### M6. Magic Number `setTimeout` Delays (manage-node.ts, manage-component.ts)

Scattered `setTimeout(r, 100)`, `setTimeout(r, 150)`, `setTimeout(r, 200)` for waiting on Editor operations. These are fragile race conditions -- too short on slow machines, unnecessary delays on fast ones.

```typescript
await new Promise(r => setTimeout(r, 100));  // manage-node.ts:223
await new Promise(r => setTimeout(r, 150));  // manage-node.ts:259
await new Promise(r => setTimeout(r, 200));  // manage-component.ts:685
```

**Suggestion**: Use a constant with a comment explaining why, or better, use Editor events/callbacks if available.

### M7. `createScene` Has 80-Line Hardcoded JSON Template (manage-scene.ts:138-218)

The scene template should be extracted to a constant or a separate template file, not inlined in the method body.

### M8. v1 `ComponentTools` Still Used in ManageNode (manage-node.ts:4,7)

```typescript
import { ComponentTools } from './component-tools';
private componentTools = new ComponentTools();
```

ManageNode depends on the v1 `ComponentTools` class for adding components during `createNode`. This creates a coupling to a legacy API that should eventually be removed.

---

## Minor Issues

### L1. `value` Property Has No Type in Schema (manage-node.ts:89)

```typescript
value: {
    description: '[set_property] Property value'
    // missing type declaration
},
```

No `type` field -- valid JSON Schema but unhelpful for LLMs that rely on type hints.

### L2. `getAvailableComponents` Returns a Static Hardcoded List (manage-component.ts:774-797)

This doesn't query the actual registered components in the project. Custom components and third-party plugins won't appear. The description doesn't mention this limitation.

### L3. Unnecessary `as any` Casts (manage-scene.ts:246, manage-node-hierarchy.ts:148, manage-prefab.ts:439)

```typescript
(Editor.Message.request as any)('scene', 'save-as-scene')
(Editor.Message.request as any)('scene', 'restore-prefab', nodeUuid, assetUuid)
```

These bypass type checking. If the API signature is different from the typed overloads, add proper type overloads instead of casting.

### L4. `generateUUID` is Not RFC4122-Compliant (manage-prefab.ts:1124-1132)

Uses `Math.random()` which is not cryptographically secure, and doesn't set version/variant bits. For editor use this is acceptable, but the UUID format has dashes at wrong positions (8-4-4-4-12 pattern but generates 32 chars with dashes at 8,12,16,20).

### L5. `schema.enum` References `this.actions` Before Definition (manage-scene-view.ts:25)

```typescript
enum: this.actions,  // this.actions defined at line 63
```

Works at runtime because TypeScript class fields are initialized in order within the constructor, but makes the code fragile if reordered.

---

## Cross-Tool Patterns

### Pattern 1: Inconsistent Error Handling Strategy

- **manage-scene-view.ts**: Uses `Promise.allSettled` for `getStatus()` -- gracefully handles partial failures. Good pattern.
- **manage-node.ts**: `createNode` catches errors per-step with `console.warn` and continues -- partial success with no error surfaced to LLM. Bad pattern.
- **manage-prefab.ts**: Uses cascading fallback methods (createPrefabWithAssetDB -> createPrefabNative -> createPrefabCustom). Reasonable strategy.

### Pattern 2: Schema-Handler Mismatch Risk

The `actions` array and `inputSchema.enum` are manually synchronized. If they diverge, the LLM might send an action that the schema allows but no handler exists for (caught by BaseActionTool) or vice versa. Consider generating one from the other.

### Pattern 3: No Undo Integration

Most mutation operations (create, delete, move, set_property) don't record undo snapshots. `manage_scene_query` has `snapshot()` but tools don't call it automatically. LLMs performing multi-step operations have no way to roll back partial failures.

---

## Strengths

1. **BaseActionTool** is clean and effective -- action routing with automatic error wrapping.
2. **LLM-friendly descriptions** -- tool descriptions include prerequisites, cross-references to other tools, and action explanations.
3. **Input normalization** via `normalize.ts` -- handles common LLM mistakes (string booleans, string numbers, JSON strings).
4. **2D/3D node type detection** -- the heuristic approach with component-based classification is pragmatic.
5. **Verification after mutation** -- many operations verify the result by re-querying (addComponent, setComponentProperty, createNode).
6. **`checkAndRedirectNodeProperties`** -- helpful LLM guidance when users target wrong tool.
7. **`ManageSceneView.getStatus()`** -- uses `Promise.allSettled` for robust composite queries.
8. **Color parsing** supports both hex strings and RGBA objects.
9. **`instruction` field** in error responses provides actionable guidance for LLMs.

---

## Recommended Actions (Priority Order)

1. **[Critical]** Eliminate all `new Promise(async (resolve) => ...)` anti-patterns (~12 occurrences)
2. **[Critical]** Fix hardcoded `localhost:8585` self-call in manage-prefab.ts
3. **[Important]** Add input validation to ManageNodeHierarchy handlers (remove `!` assertions)
4. **[Important]** Fix `moveNode` to use `keepWorldTransform` and `siblingIndex` from args
5. **[Important]** Fix `checkAndRedirectNodeProperties` false positives
6. **[Important]** Split large files (manage-component.ts, manage-prefab.ts, manage-node.ts)
7. **[Medium]** Extract shared 2D/3D component constants
8. **[Medium]** Replace `new Promise` wrapping with async/await throughout
9. **[Medium]** Extract fallback-to-scene-script pattern into shared helper
10. **[Medium]** Make ManagePrefab private methods return `ActionToolResult` directly

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | ~70% (heavy use of `any`) |
| Test Coverage | 0% (no test runner configured) |
| Linting Issues | Not measured (no linter configured) |
| DRY Violations | ~8 significant |
| Critical Issues | 3 |
| Important Issues | 8 |
| Medium Issues | 8 |
| Minor Issues | 5 |

---

## Unresolved Questions

1. Is the `execute-scene-script` fallback pattern actually needed? Under what Cocos Creator versions does the primary API fail? If never, the fallback code is dead weight.
2. Does Cocos Creator's `duplicate-node` API support an `includeChildren` flag? If not, the parameter should be removed from the schema.
3. Is `save-as-scene` intended to open a dialog? If so, it's useless for MCP (no user interaction). Consider removing or documenting the limitation.
4. What is the correct port for the self-call in `enhanceTreeWithMCPComponents`? Is it read from settings somewhere?
