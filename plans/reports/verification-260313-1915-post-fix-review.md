# Post-Fix Verification Report

**Date**: 2026-03-13
**Scope**: 47 files changed, ~4000 lines net reduction
**Build**: PASSES (`npm run build` clean)

---

## Verification Results

### S1: Body Size Limit (mcp-server.ts) — FIXED

`MAX_BODY_SIZE = 1024 * 1024` (1MB) defined at module level. Enforced in both `handleMCPRequest` and `handleSimpleAPIRequest` via `bodySize` accumulator that calls `req.destroy()` + returns 413 when exceeded. Guard checks `res.writableEnded` before writing. Correctly handles the race between data events and the end event.

### S2: CORS Enforcement (mcp-server.ts) — PARTIALLY FIXED

Origin checking is present: if `allowedOrigins` is configured and non-empty, only matching origins get `Access-Control-Allow-Origin` set. However, **the request is still processed** when origin doesn't match — only the response header is omitted. Browsers will enforce CORS, but non-browser clients (curl, scripts) bypass it entirely. This is a CORS header approach, not server-side enforcement. For an MCP server intended for AI tool use (non-browser clients), this is effectively cosmetic. A proper fix would reject requests from disallowed origins with 403.

**Severity**: Medium. The setting name `allowedOrigins` implies enforcement, but only browser-based callers are restricted.

### S3: Prototype Pollution Guard (scene.ts) — FIXED

Two guards added:
- Line 274: `setNodeProperty` blocks `__proto__`, `constructor`, `prototype`
- Line 387: `setComponentProperty` blocks same set before any property assignment

Both return `{ success: false, error: ... }` on violation. Placement is correct — guard runs before `(node as any)[property] = value`.

### S4: execute_script Restriction (manage-debug.ts) — FIXED

`validateScript()` method added. Checks:
- Non-empty string, max 10KB length
- Blocks `require('child_process')`, `process.exit`, `eval(`, `Function(`
- Returns error string on violation, null on pass

Called before execution in `executeScript()`. **Limitation**: string-based blocklist is bypassable (e.g., `require("child_" + "process")`, template literals, `globalThis.eval`). This is defense-in-depth, not a sandbox. Acceptable for current threat model (local editor extension).

### S5: XSS Fix (tool-manager panel) — FIXED

`updateToolsDisplay()` fully rewritten to use safe DOM methods (`createElement`, `textContent`, `appendChild`). No user data flows through `innerHTML`. One remaining `innerHTML` at line 66 is a static string (`'<option value="">Select configuration...</option>'`) with no dynamic content — safe.

Bonus: rollback logic in `selectAllTools`/`deselectAllTools` now snapshots previous state instead of assuming inverse. Good fix.

### S6: Path Traversal (manage-asset.ts) — PARTIALLY FIXED

`validateAssetPath()` function added. Blocks `..`, leading `/`, and requires `db://` or `assets/` prefix. **However**, it's only called in 2 of 15+ asset operations:
- `importAsset` (line 139)
- `batchImportAssets` (line 401)

Missing from: `createAsset`, `copyAsset`, `moveAsset`, `deleteAsset`, `saveAsset`, `reimportAsset`, `saveAssetMeta`, `openAssetExternal`, `batchDeleteAssets`. These operations accept user-provided URLs/paths without validation.

**Severity**: High. The validation function exists but coverage is incomplete.

### D1: fixCommonJsonIssues Removed — FIXED

Method completely removed from `MCPServer`. Both call sites (MCP handler and simple API handler) now use strict `JSON.parse` only. No fallback to regex-based "fixing." Clean removal.

### E1: new Promise(async ...) Eliminated — PARTIALLY FIXED

Eliminated from key files that were modified:
- `manage-debug.ts` — all instances converted to async/await
- `manage-asset.ts` — all instances converted to async/await
- `manage-node.ts` — converted where modified
- `manage-component.ts` — converted where modified

**Still present** in `component-tools.ts` (4 instances at lines 220, 297, 518, 1105). This file was not part of the fix scope. Many other files (`manage-prefab.ts`, `manage-scene-query.ts`, `manage-node-hierarchy.ts`, `manage-scene-view.ts`, `manage-scene.ts`) still use `new Promise((resolve) => { ... })` wrapping single async calls — these aren't the dangerous `async` executor variant but are still unnecessarily verbose.

---

## Regressions Found

1. **None observed in build**. TypeScript compiles cleanly.

2. **Behavioral concern in CORS**: Previously all requests got `Access-Control-Allow-Origin: *`. Now, if `allowedOrigins` is set but request has no `Origin` header (common for non-browser MCP clients), no CORS header is set. This is correct browser behavior but could confuse users who set `allowedOrigins` expecting it to block curl/httpie.

3. **scene.ts spriteFrame/material loading**: Changed from fire-and-forget callbacks to Promises. This is a **positive behavioral change** (callers now wait for asset loading), but could surface latent bugs if callers don't handle the async result. Low risk since the return type matches.

---

## Remaining Issues

| Priority | Issue | Location |
|----------|-------|----------|
| High | `validateAssetPath` not applied to most asset write operations | `manage-asset.ts` |
| Medium | CORS doesn't reject non-matching origins, only omits header | `mcp-server.ts` |
| Medium | `new Promise(async ...)` in `component-tools.ts` (4 instances) | `component-tools.ts` |
| Low | `validateScript` blocklist is trivially bypassable | `manage-debug.ts` |
| Low | Many files still use unnecessary Promise wrapper pattern | `manage-prefab.ts`, `manage-scene-*.ts`, etc. |
| Low | Remaining `innerHTML` for static content at line 66 | `tool-manager/index.ts` |

---

## Grade

| Area | Grade | Notes |
|------|-------|-------|
| S1 Body limit | A | Clean implementation |
| S2 CORS | C+ | Header-only, no request rejection |
| S3 Prototype pollution | A | Both entry points guarded |
| S4 Script validation | B | Present but bypassable blocklist |
| S5 XSS | A | Complete DOM-safe rewrite |
| S6 Path traversal | D+ | Validation exists, barely applied |
| D1 JSON fixer removal | A | Clean removal |
| E1 Promise antipattern | B- | Fixed in scope, legacy remains |

**Overall: B-**

The critical security fixes (S1, S3, S5, D1) are well-executed. The path traversal fix (S6) needs immediate follow-up — the validation function is correct but only guards 2 of 15+ entry points. CORS enforcement (S2) is misleading — rename the setting or add actual enforcement.
