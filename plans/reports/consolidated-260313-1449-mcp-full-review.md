# Consolidated MCP Server v2.0 Code Review

**Date**: 2026-03-13 | **Reviewers**: 4 parallel code-reviewer agents | **Scope**: All 36 source files (~12.4K LOC)

## Individual Reports
- [Core Infrastructure](./code-reviewer-260313-1446-core-infrastructure.md)
- [Scene/Node Tools](./review-260313-1446-scene-node-tools.md)
- [Utility/System Tools](./code-reviewer-260313-1446-utility-system-tools.md)
- [Panels/Tests/Utils](./review-260313-1446-panels-tests-utils.md)

---

## Critical Issues (13 total) — MUST FIX

### Security (6)
| # | Issue | File | Description |
|---|-------|------|-------------|
| S1 | **No request body size limit** | mcp-server.ts:210 | POST body accumulated without cap → memory exhaustion DoS |
| S2 | **CORS bypass** | mcp-server.ts:176 | `allowedOrigins` setting exists but hardcodes `Access-Control-Allow-Origin: *` |
| S3 | **Prototype pollution** | scene.ts:272,426 | `(node as any)[property] = value` allows `__proto__` injection |
| S4 | **Arbitrary code execution** | manage-debug.ts:191 | `execute_script` forwards raw JS to eval with zero sanitization |
| S5 | **XSS in tool-manager panel** | panels/tool-manager | `innerHTML` with unsanitized tool names from imported configs |
| S6 | **File path traversal** | manage-asset.ts, manage-script.ts | No path validation on import/read operations |

### Data Integrity (4)
| # | Issue | File | Description |
|---|-------|------|-------------|
| D1 | **`fixCommonJsonIssues` corrupts valid JSON** | mcp-server.ts:313 | Replaces single quotes globally (breaks `it's`), unsafe regex |
| D2 | **CSV injection** | manage-asset.ts:743 | No escaping of commas, quotes, formula prefixes in CSV export |
| D3 | **Async asset loading reports success prematurely** | scene.ts | Returns success synchronously before load callback fires |
| D4 | **Unsanitized config import** | tool-manager panel | Raw JSON pushed without type validation |

### Error Handling (3)
| # | Issue | File | Description |
|---|-------|------|-------------|
| E1 | **`new Promise(async ...)` anti-pattern** | 12+ locations | Silently swallows errors in manage-node, manage-component, manage-prefab |
| E2 | **Hardcoded `localhost:8585` self-call** | manage-prefab.ts | Uses v1 tool name that may not exist |
| E3 | **Hardcoded developer path** | manage-debug.ts:357 | `/Users/lizhiyong/NewProject_3` leaked in log resolution |

---

## Important Issues (23 total) — SHOULD FIX

### Protocol Compliance
- JSON-RPC 2.0 violations: no `jsonrpc` field validation, wrong error code for unknown methods (`-32603` vs `-32601`), no batch support
- `createPrefabFromNode` fakes success without doing anything

### Error Handling
- `updateSettings` calls `start()` without `await`/`.catch()` — unhandled rejection
- Response written after connection drops (no `res.writableEnded` guard)
- ~80 instances of unnecessary `new Promise` wrapping `Editor.Message.request` (already returns Promise)

### Input Validation
- Missing required parameter validation in ~7+ action handlers
- Non-null assertions on `coerceInt()` results that can be `undefined`
- `normalizeVec3`/`normalizeVec4` silently produce NaN on partial objects

### Logic Bugs
- `getNodePath` stops at hardcoded "Canvas" name instead of scene root type
- `moveNode` ignores `keepWorldTransform` and `siblingIndex` despite schema declaring them
- `duplicateNode` accepts but ignores `includeChildren`
- `saveSceneAs` accepts `path` but never passes it to Editor API
- `checkAndRedirectNodeProperties` false-positives on legitimate component properties
- Incorrect rollback logic in selectAll/deselectAll (assumes inverse state)

### Dead/Unused Code
- `maxConnections` and `enableDebugLog` settings never enforced
- Dead `clients` Map in mcp-server never populated
- Duplicate IPC methods (`getServerSettings`/`getSettings`)
- Unused v1 types (`ToolResponse`, `ToolExecutor`) in types/index.ts
- `ToolConfig` type defined in two places with conflicting fields
- Broadcast listeners and console capture are stubs that silently do nothing

### Performance
- Unbounded recursion in `buildNodeTree` — stack overflow on deep scenes
- Entire log file loaded into memory (could be hundreds of MB)
- Redundant `query-node-tree` calls on every find/get_all operation

---

## Minor Issues (14 total) — NICE TO FIX

- Dead import (`uuid` in mcp-server.ts)
- Memory leak from `setInterval` never cleared on panel close
- `zh.js` contains only English (no actual Chinese translations)
- i18n keys defined but never used (all UI text hardcoded)
- DRY violation: tool management UI duplicated in default panel and standalone tool-manager panel
- Inconsistent message naming (mixed kebab-case and camelCase)
- Hardcoded port 8585 in curl command (should use configured port)
- Event listeners scoped to `document` instead of panel container
- `falsy` default bug in `generateSampleParams`
- Error body leaking in parse error responses
- tool-manager panel missing from `package.json` registration
- No programmatic port validation
- Redundant Apply button (dropdown auto-applies)
- Heavy `any` typing (~70% type coverage)

---

## Systemic Patterns

| Pattern | Occurrences | Impact |
|---------|-------------|--------|
| `new Promise(async ...)` anti-pattern | 12+ files | Silently swallows errors |
| Unnecessary Promise wrapping | ~80 instances | Code bloat, error masking |
| Missing input validation | ~15 handlers | Runtime crashes, unexpected behavior |
| Files exceeding 200 LOC | 3 files (855-1165 LOC) | Context management burden |
| No undo integration for mutations | All mutation tools | No rollback capability |
| Zero test coverage | Entire codebase | No regression safety net |
| Manual schema-handler sync | All tools | Schema drift risk |

---

## Dead Code / v1 Legacy

| Item | Status | Recommendation |
|------|--------|----------------|
| `source/test/*.ts` (3 files) | All reference v1 tool names/protocols | Rewrite for v2 or delete |
| `source/tools/component-tools.ts` | v1 `ToolExecutor`, still imported by manage-node | Complete migration, remove |
| Unused v1 types in `types/index.ts` | `ToolResponse`, `ToolExecutor` | Delete |
| `ToolConfig.category` field | Stale v1 field | Remove from type |

---

## Strengths

- Clean `BaseActionTool` + `actionHandlers` pattern — elegant, extensible
- Per-section try/catch in `CocosResources` prevents cascading failures
- Tool configuration persistence with sync/import/export well-designed
- Extension lifecycle properly manages server creation/teardown
- Defensive defaults via spread on settings reads
- Build compiles clean under strict mode
- Comprehensive action coverage (21 tools, 100+ actions)

---

## Priority Action Plan

### P0 — Immediate (Security)
1. Add request body size limit (e.g., 1MB cap)
2. Enforce `allowedOrigins` CORS setting
3. Guard against prototype pollution in `scene.ts`
4. Sanitize or restrict `execute_script` in manage-debug
5. Use `textContent` instead of `innerHTML` in tool-manager panel
6. Add path traversal validation for asset/script tools

### P1 — Soon (Data Integrity + Error Handling)
7. Remove `fixCommonJsonIssues` entirely
8. Fix `new Promise(async ...)` anti-pattern (12+ locations)
9. Add CSV escaping in asset export
10. Fix async asset loading to await completion
11. Validate imported configs before applying

### P2 — Important (Logic + Protocol)
12. Fix JSON-RPC 2.0 compliance (error codes, field validation)
13. Implement promised but ignored params (`keepWorldTransform`, `includeChildren`, `path`)
14. Fix `getNodePath` Canvas hardcode
15. Add depth limit to `buildNodeTree`
16. Remove hardcoded developer path

### P3 — Cleanup (DRY + Dead Code)
17. Refactor `new Promise` wrapping to `try/catch + await` (~80 instances)
18. Delete or rewrite v1 test files
19. Complete component-tools migration, remove v1 file
20. Remove unused types, dead imports, stale settings
21. Split oversized files (manage-component, manage-prefab, manage-node)

---

## Unresolved Questions

1. Is localhost-only sufficient for auth, or should token-based auth be added?
2. Can `manage_server` modify its own server settings (privilege escalation risk)?
3. Are `scene.ts` methods all still invoked by v2 tools or partially dead?
4. Is lack of test infrastructure intentional or an oversight?
5. What is the intended status of the tool-manager panel — active or deprecated?
6. Should `execute_script` be removed entirely or sandboxed?
7. Should broadcast listeners be implemented or removed?
