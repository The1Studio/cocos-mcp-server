# Project Changelog

All notable changes to Cocos MCP Server are documented here.

## [2.1.0] — 2026-03-13

### Security Fixes

- **Body Size Limit**: Enforced strict request body size limits (1MB) to prevent denial-of-service attacks
- **CORS Enforcement**: Strengthened CORS header validation and origin checking
- **Prototype Pollution Guard**: Added safeguards against prototype pollution in tool arguments
- **Script Execution Restriction**: Enhanced restrictions preventing arbitrary script execution through tool parameters
- **XSS Prevention**: Fixed XSS vulnerabilities in resource URI handling and response formatting
- **Path Traversal Validation**: Enforced strict path validation in asset and resource operations to prevent directory traversal attacks

### Error Handling Improvements

- **Promise Anti-pattern**: Removed `new Promise(async ...)` anti-pattern from 12+ files, replaced with proper async/await patterns
- **Error Context**: Improved error messages with better context and actionable debugging information
- **Exception Safety**: Enhanced error recovery to prevent unhandled promise rejections

### Protocol & Data Integrity

- **JSON-RPC 2.0 Compliance**: Fixed response format compliance issues in error scenarios
- **CSV Injection Prevention**: Added escaping to prevent CSV injection in data exports
- **JSON Parser Cleanup**: Removed unused imports and dead code from JSON parsing logic

### Code Quality Improvements

- **Dead Code Removal**: Removed unused imports and deprecated helper maps from 15+ files
- **Type Safety**: Eliminated unnecessary `any` types and improved TypeScript strictness
- **Code Organization**: Reorganized tool modules for better maintainability

### Files Modified

**Security & Error Handling** (25+ files):
- `source/mcp-server.ts` — Request validation, body limits, CORS enforcement
- `source/tools/manage-*.ts` — Error handling, async/await patterns (all tool files)
- `source/scene.ts` — Script execution restrictions, path validation
- `source/resources/` — XSS prevention in resource handlers

**Code Cleanup** (15+ files):
- Removed dead maps and deprecated helper functions
- Eliminated unused imports across tool modules
- Consolidated duplicate utility functions

### Breaking Changes

None. All changes are backward compatible.

### Deprecations

None.

### Migration Guide

**For Extension Users**: Update to v2.1.0 for enhanced security. No configuration changes required.

**For API Consumers**: All endpoints maintain v2.0 API compatibility. No changes needed.

### Testing

- Manual testing confirmed all 21 tools execute successfully with fixes applied
- Security validation tests passed for all patched scenarios
- Protocol compliance verified with JSON-RPC 2.0 test suite

### Known Issues

None.

---

## [2.0.0] — 2026-03-12

### Initial v2.0 Release

Major rewrite consolidating tool system from 127+ fine-grained tools to 21 action-based tools.

### Features

- **Action-Based Tools** — All 21 tools follow unified action parameter pattern
- **BaseActionTool Class** — Standardized base class with automatic error handling
- **ActionToolResult Type** — Consistent response format across all tools
- **MCP Resources** — 4 read-only resource URIs for editor/scene queries
- **Flat Tool Routing** — No category prefix parsing, direct tool name lookup
- **Enhanced Tool Manager** — Simplified UI for enabling/disabling tools

### Breaking Changes

- Tool names changed from `node_create` to `manage_node` with action parameter
- Tool execution requires `action` parameter in arguments
- Old v1 tool system completely removed
- Tool configurations require upgrade from v1 format

### Bug Fixes

- Fixed memory leaks in long-running sessions
- Improved error recovery and graceful shutdown
- Better handling of malformed JSON input

### Deprecations

- v1 tool system fully deprecated and removed
- Old `ToolResponse` type replaced with `ActionToolResult`

### Known Issues

None.

---

## Version History

| Version | Release Date | Status | Notable |
|---------|--------------|--------|---------|
| 2.1.0 | 2026-03-13 | Stable | Security & quality fixes |
| 2.0.0 | 2026-03-12 | Stable | Action-based tools, major rewrite |
| 1.0.x | 2025-2026 | Deprecated | Original 127+ tool system |

---

## Guidelines for Future Changes

### Semantic Versioning

- **MAJOR** (2.0.0 → 3.0.0): Breaking API changes, removed features
- **MINOR** (2.0.0 → 2.1.0): New features, security fixes (backward compatible)
- **PATCH** (2.0.0 → 2.0.1): Bug fixes only

### Changelog Entries

When adding entries to this file:

1. **Use this format**:
   ```
   ## [VERSION] — YYYY-MM-DD

   ### Category Name
   - **Item Name**: Description of what changed and why
   ```

2. **Categories** (use in order):
   - Security Fixes
   - Bug Fixes
   - Features
   - Performance Improvements
   - Deprecations
   - Breaking Changes
   - Migration Guide
   - Known Issues

3. **Be specific**:
   - Mention tool names or file groups affected
   - Include count if affecting multiple files (e.g., "12+ files")
   - Explain impact for users

4. **Link to documentation**:
   - Reference related docs: "[API Reference](./api-reference.md)"
   - Reference code patterns: "[Code Standards](./code-standards.md)"

---

**Last Updated**: 2026-03-13
**Maintained by**: PlayableLabs
**Status**: v2.1.0 Current Release
