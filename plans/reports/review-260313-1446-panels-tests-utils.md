# Code Review: UI Panels, Test Utilities & Support Modules

**Reviewer**: code-reviewer
**Date**: 2026-03-13
**Scope**: Panels, tool-manager, normalize utils, test files, static assets, i18n, package.json
**LOC**: ~1400 (source) + ~600 (static HTML/CSS)

## Overall Assessment

The codebase is functional and well-structured for a Cocos Creator extension. However, there are **XSS vulnerabilities in the tool-manager panel**, a **memory leak from an uncleared interval**, **missing panel registration in package.json**, and **dead legacy code**. The normalize utility is solid. Test utilities are v1-era and largely obsolete.

---

## Critical Issues

### C1. XSS via innerHTML in tool-manager panel

**File**: `source/panels/tool-manager/index.ts:108-120`

Tool names and descriptions from backend data are interpolated directly into innerHTML without sanitization:

```typescript
toolListDiv.innerHTML = `
    ...
    ${this.currentConfiguration.tools.map((tool: any) => `
        <div class="tool-item">
            <div class="tool-info">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-description">${tool.description}</div>
            </div>
            ...
        </div>
    `).join('')}
`;
```

If a malicious config is imported via JSON (line 291), `tool.name` or `tool.description` could contain `<script>` tags or event handlers. The `importConfiguration` method in `tool-manager.ts:258-275` does zero sanitization of the imported tool data.

**Impact**: Stored XSS. An attacker crafts a config JSON with `"name": "<img src=x onerror=alert(1)>"`, shares it, and it executes in the victim's editor panel.

**Fix**: Use `textContent` assignment or escape HTML entities before interpolation:

```typescript
function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

Or refactor to use DOM API (`createElement`/`textContent`) instead of innerHTML template strings.

### C2. importConfiguration allows arbitrary tool injection

**File**: `source/tools/tool-manager.ts:258-275`

```typescript
public importConfiguration(configJson: string): ToolConfiguration {
    const config = JSON.parse(configJson);
    if (!config.id || !config.name || !Array.isArray(config.tools)) {
        throw new Error('Invalid configuration format');
    }
    // config.tools is pushed directly without validation
    this.settings.configurations.push(config);
    this.saveSettings();
    return config;
}
```

No validation of `config.tools[*].name` or `config.tools[*].enabled` types. A crafted import could inject tools with non-string names, missing `enabled` fields, or extra properties that persist to the settings JSON. Combined with C1, this is the injection vector.

**Fix**: Validate and sanitize each tool entry:

```typescript
config.tools = config.tools.map((t: any) => ({
    name: String(t.name || ''),
    enabled: Boolean(t.enabled),
    description: String(t.description || '')
}));
```

---

## Important Issues

### H1. Memory leak: setInterval never cleared

**File**: `source/panels/default/index.ts:261-274`

```typescript
setInterval(async () => {
    // polls server status every 2 seconds
}, 2000);
```

The interval ID is never stored, so it cannot be cleared in `close()`. If the panel is opened/closed multiple times, intervals stack up and keep running.

**Fix**: Store the interval ID and clear it on close:

```typescript
// In setup():
const statusInterval = ref<ReturnType<typeof setInterval> | null>(null);

onMounted(() => {
    statusInterval.value = setInterval(async () => { ... }, 2000);
});

onUnmounted(() => {
    if (statusInterval.value) clearInterval(statusInterval.value);
});
```

Also expose cleanup in the panel `close()` method.

### H2. tool-manager panel not registered in package.json

**File**: `package.json:27-39`

Only the `default` panel is registered under `"panels"`. The `tool-manager` panel has a source file at `source/panels/tool-manager/index.ts` and an `open-tool-manager` message registered (line 55-59), but no panel entry exists:

```json
"panels": {
    "default": { ... }
    // Missing: "tool-manager": { ... }
}
```

**Impact**: The tool-manager panel cannot be opened via `Editor.Panel.open('cocos-mcp-server.tool-manager')`. The `open-tool-manager` message handler likely fails silently.

**Fix**: Add the tool-manager panel registration:

```json
"tool-manager": {
    "title": "i18n:cocos-mcp-server.tool_manager",
    "type": "dockable",
    "main": "dist/panels/tool-manager",
    "size": {
        "min-width": 500,
        "min-height": 400,
        "width": 800,
        "height": 600
    }
}
```

### H3. Inconsistent naming conventions in package.json messages

**File**: `package.json:49-139`

Message names mix kebab-case and camelCase inconsistently:

- kebab-case: `open-panel`, `start-server`, `stop-server`, `get-server-status`, `update-settings`, `get-server-settings`
- camelCase: `getToolsList`, `getToolManagerState`, `createToolConfiguration`, `updateToolStatus`, `updateToolStatusBatch`, `exportToolConfiguration`, `importToolConfiguration`, `getEnabledTools`, `setCurrentToolConfiguration`

**Impact**: Maintenance confusion. Cocos Creator IPC treats these as exact string matches, so consistency matters for developer ergonomics.

**Fix**: Standardize all message names to one convention (kebab-case is Cocos Creator convention).

### H4. selectAll/deselectAll rollback logic is wrong in tool-manager panel

**File**: `source/panels/tool-manager/index.ts:329-373`

In `selectAllTools`, on failure the rollback sets all tools to `false`:
```typescript
// Rollback on failure
this.currentConfiguration.tools.forEach((tool: any) => {
    tool.enabled = false;  // Wrong! Should restore previous state
});
```

In `deselectAllTools`, on failure the rollback sets all tools to `true`:
```typescript
this.currentConfiguration.tools.forEach((tool: any) => {
    tool.enabled = true;  // Wrong! Should restore previous state
});
```

Both assume the previous state was the inverse. If some tools were enabled and some disabled before, the rollback corrupts the state.

**Fix**: Snapshot the previous state before modifying:

```typescript
const previousStates = this.currentConfiguration.tools.map((t: any) => ({
    name: t.name, enabled: t.enabled
}));
// ... on failure:
previousStates.forEach(prev => {
    const tool = this.currentConfiguration.tools.find((t: any) => t.name === prev.name);
    if (tool) tool.enabled = prev.enabled;
});
```

### H5. normalizeVec3 produces NaN silently

**File**: `source/utils/normalize.ts:54-64`

```typescript
if (parsed && typeof parsed === 'object' && 'x' in parsed) {
    return { x: Number(parsed.x), y: Number(parsed.y), z: Number(parsed.z) };
}
```

If the object has `x` but not `y` or `z`, `Number(undefined)` produces `NaN`. Same issue in `normalizeVec4` (line 67-82).

**Fix**: Add fallback or validation:

```typescript
return {
    x: Number(parsed.x) || 0,
    y: Number(parsed.y) || 0,
    z: Number(parsed.z) || 0
};
```

Or return `undefined` if any component is NaN.

---

## Medium Priority Issues

### M1. zh.js is not actually Chinese

**File**: `i18n/zh.js`

The Chinese translation file contains all English strings. Not a single Chinese character exists. This is misleading -- either remove the file or add actual Chinese translations.

### M2. i18n keys not used in panels

The i18n translation files define keys like `server_running`, `settings_saved`, `config_created`, etc., but the panel code uses hardcoded English strings everywhere:

- `source/panels/default/index.ts:109` - `'[Vue App] Server toggled'`
- `source/panels/tool-manager/index.ts:197` - `'New Configuration'`
- `static/template/vue/mcp-server-app.html` - `'Server Status'`, `'Start Server'`, etc.

**Impact**: i18n is completely non-functional. All UI text is hardcoded.

### M3. tool-manager.html is a full HTML document used as a panel template

**File**: `static/template/default/tool-manager.html`

This is a complete HTML document with `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`, and inline `<style>` block (478 lines of CSS). Cocos Creator panel templates should be HTML fragments, not full documents. The panel also loads `index.css` via the `style` property in the panel definition (line 10), so there's duplicate styling.

### M4. Duplicate tool management UI

The default panel (`mcp-server-app.html` lines 73-113) includes an inline tool management tab, while a separate dedicated tool-manager panel exists. This violates DRY and causes maintenance overhead -- two UIs for the same functionality.

### M5. Event listeners not cleaned up in tool-manager panel

**File**: `source/panels/tool-manager/index.ts:127-134`

`bindToolEvents` attaches event listeners to `.tool-checkbox` elements via `document.querySelectorAll` after each `updateToolsDisplay` call. Since `updateToolsDisplay` replaces innerHTML, old listeners are garbage-collected, but using `document.querySelectorAll` in a panel context could match checkboxes outside this panel if multiple panels exist.

**Fix**: Scope queries to the panel's container element rather than `document`.

### M6. configSelector auto-applies on change

**File**: `source/panels/tool-manager/index.ts:433`

```typescript
this.$.configSelector.addEventListener('change', this.applyConfiguration.bind(this));
```

The "Apply" button (line 505 in HTML) exists but is redundant since selecting from the dropdown auto-applies. This is confusing UX -- either remove the Apply button or remove the auto-apply on change.

### M7. No port validation in default panel

**File**: `source/panels/default/index.ts:65-70`

The `settings.port` defaults to 3000 but there's no validation that the port is within valid range before sending to backend. The Vue template has `:min="1024" :max="65535"` on the UI control, but programmatic updates bypass this.

---

## Dead Code / Legacy

### D1. component-tools.ts is v1 legacy code still in active use

**File**: `source/tools/component-tools.ts` (~800+ lines)

This file implements the old v1 `ToolExecutor` interface with fine-grained tool names (`add_component`, `remove_component`, `get_components`, etc.). It is imported by `manage-node.ts` and used as a delegate:

```typescript
// manage-node.ts
import { ComponentTools } from './component-tools';
private componentTools = new ComponentTools();
```

This is a v1 artifact being used as a utility class within the v2 architecture. The entire `ToolExecutor` interface pattern (with `getTools()` and `executeTool()`) is the old v1 pattern. This should be refactored into the v2 action handler pattern.

### D2. Test files use v1 tool names

**File**: `source/test/mcp-tool-tester.ts`

References v1 tool names: `scene_get_current_scene`, `node_create_node`, `node_get_node_info`, `node_delete_node`, `node_find_node_by_name`, `project_get_project_info`, `prefab_get_prefab_list`, `component_get_available_components`, `debug_get_editor_info`.

None of these exist in v2. V2 uses `manage_scene`, `manage_node`, etc. with action parameters. These tests are completely broken for v2.

### D3. mcp-tool-tester.ts uses WebSocket but server is HTTP

**File**: `source/test/mcp-tool-tester.ts:14`

```typescript
this.ws = new WebSocket(`ws://localhost:${port}`);
```

The v2 server is HTTP-based (`POST /mcp`), not WebSocket. This tester cannot connect to the current server.

### D4. manual-test.ts uses Chinese comments and v1 APIs

**File**: `source/test/manual-test.ts`

All comments are in Chinese. Uses Cocos Creator IPC directly, not MCP protocol. Tests v1-era scene/asset/project APIs that may not match current implementation.

### D5. tool-tester.ts is generic but incomplete

**File**: `source/test/tool-tester.ts`

Tests v1 Cocos Creator IPC methods (`scene create-node`, `asset-db query-assets`). Does not test MCP protocol or v2 tools. No assertions -- just logs results.

---

## Strengths

1. **Default panel Vue 3 architecture** is clean: proper Composition API usage, reactive state, computed properties, optimistic updates with rollback.
2. **tool-manager.ts** (backend) is well-structured: proper CRUD operations, sync logic for tool list changes, max config slot enforcement, copy-on-read patterns (`[...this.availableTools]`).
3. **normalize.ts** is pragmatic and handles real LLM input issues well (string booleans, JSON payloads, Vec3/Vec4 variants).
4. **Error handling** in panels consistently catches errors and logs them.
5. **Settings persistence** pattern (file-based JSON in project settings dir) is appropriate for Cocos Creator extensions.

---

## Recommended Actions (Priority Order)

1. **[Critical]** Fix XSS in tool-manager panel -- escape HTML in innerHTML or switch to DOM API
2. **[Critical]** Validate imported config tool entries in `importConfiguration`
3. **[Important]** Fix memory leak: store and clear setInterval in default panel
4. **[Important]** Register tool-manager panel in package.json
5. **[Important]** Fix selectAll/deselectAll rollback logic to snapshot previous state
6. **[Important]** Fix normalizeVec3/Vec4 NaN propagation
7. **[Medium]** Remove or update all three test files for v2 compatibility
8. **[Medium]** Either add real Chinese translations to zh.js or remove it
9. **[Medium]** Resolve DRY violation between default panel tools tab and tool-manager panel
10. **[Low]** Standardize message naming convention in package.json

---

## Metrics

| Metric | Value |
|--------|-------|
| Type Coverage | ~60% (heavy use of `any`, especially in tool-manager panel) |
| Test Coverage | 0% (no automated tests; manual test files are v1 dead code) |
| Security Issues | 2 critical (XSS + unsanitized import) |
| Dead Code Files | 3 (all test files), 1 partial (component-tools.ts as v1 legacy) |

---

## Unresolved Questions

1. Is the tool-manager panel intended to be a standalone panel, or was it superseded by the tools tab in the default panel? If superseded, it should be removed entirely.
2. Is `component-tools.ts` being intentionally kept as a utility for `manage-node.ts`, or was the migration to v2 action handlers incomplete?
3. Should the test files be deleted or rewritten for v2? There is no test infrastructure (no test runner configured per CLAUDE.md).
