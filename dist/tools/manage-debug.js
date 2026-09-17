"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageDebug = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
const asset_refs_1 = require("../utils/asset-refs");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ManageDebug extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_debug';
        this.description = 'Debug and inspect the editor environment. Actions: get_console_logs, clear_console, execute_script, get_node_tree, get_performance_stats, validate_scene, get_editor_info, get_project_logs, get_log_file_info, search_project_logs. Use get_editor_info for environment details. Use execute_script to run JS in scene context.';
        this.actions = [
            'get_console_logs',
            'clear_console',
            'execute_script',
            'get_node_tree',
            'get_performance_stats',
            'validate_scene',
            'get_editor_info',
            'get_project_logs',
            'get_log_file_info',
            'search_project_logs',
        ];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform',
                    enum: this.actions,
                },
                limit: {
                    type: 'number',
                    description: '[get_console_logs] Number of recent logs to retrieve',
                    default: 100,
                },
                filter: {
                    type: 'string',
                    description: '[get_console_logs] Filter logs by type',
                    enum: ['all', 'log', 'warn', 'error', 'info'],
                    default: 'all',
                },
                script: {
                    type: 'string',
                    description: '[execute_script] JavaScript code to execute',
                },
                rootUuid: {
                    type: 'string',
                    description: '[get_node_tree] Root node UUID (optional, uses scene root if not provided)',
                },
                maxDepth: {
                    type: 'number',
                    description: '[get_node_tree] Maximum tree depth',
                    default: 10,
                },
                checkMissingAssets: {
                    type: 'boolean',
                    description: '[validate_scene] Check for missing asset references',
                    default: true,
                },
                checkPerformance: {
                    type: 'boolean',
                    description: '[validate_scene] Check for performance issues',
                    default: true,
                },
                lines: {
                    type: 'number',
                    description: '[get_project_logs] Number of lines to read from the end of the log file',
                    default: 100,
                    minimum: 1,
                    maximum: 10000,
                },
                filterKeyword: {
                    type: 'string',
                    description: '[get_project_logs] Filter logs containing specific keyword (optional)',
                },
                logLevel: {
                    type: 'string',
                    description: '[get_project_logs] Filter by log level',
                    enum: ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'ALL'],
                    default: 'ALL',
                },
                pattern: {
                    type: 'string',
                    description: '[search_project_logs] Search pattern (supports regex)',
                },
                maxResults: {
                    type: 'number',
                    description: '[search_project_logs] Maximum number of matching results',
                    default: 20,
                    minimum: 1,
                    maximum: 100,
                },
                contextLines: {
                    type: 'number',
                    description: '[search_project_logs] Number of context lines to show around each match',
                    default: 2,
                    minimum: 0,
                    maximum: 10,
                },
            },
            required: ['action'],
        };
        this.actionHandlers = {
            get_console_logs: (args) => {
                var _a, _b;
                return this.getConsoleLogs((_a = (0, normalize_1.coerceInt)(args.limit)) !== null && _a !== void 0 ? _a : 100, (_b = args.filter) !== null && _b !== void 0 ? _b : 'all');
            },
            clear_console: (_args) => this.clearConsole(),
            execute_script: (args) => this.executeScript(args.script),
            get_node_tree: (args) => {
                var _a;
                return this.getNodeTree(args.rootUuid, (_a = (0, normalize_1.coerceInt)(args.maxDepth)) !== null && _a !== void 0 ? _a : 10);
            },
            get_performance_stats: (_args) => this.getPerformanceStats(),
            validate_scene: (args) => {
                var _a, _b;
                return this.validateScene({
                    checkMissingAssets: (_a = (0, normalize_1.coerceBool)(args.checkMissingAssets)) !== null && _a !== void 0 ? _a : true,
                    checkPerformance: (_b = (0, normalize_1.coerceBool)(args.checkPerformance)) !== null && _b !== void 0 ? _b : true,
                });
            },
            get_editor_info: (_args) => this.getEditorInfo(),
            get_project_logs: (args) => {
                var _a, _b;
                return this.getProjectLogs((_a = (0, normalize_1.coerceInt)(args.lines)) !== null && _a !== void 0 ? _a : 100, args.filterKeyword, (_b = args.logLevel) !== null && _b !== void 0 ? _b : 'ALL');
            },
            get_log_file_info: (_args) => this.getLogFileInfo(),
            search_project_logs: (args) => {
                var _a, _b;
                return this.searchProjectLogs(args.pattern, (_a = (0, normalize_1.coerceInt)(args.maxResults)) !== null && _a !== void 0 ? _a : 20, (_b = (0, normalize_1.coerceInt)(args.contextLines)) !== null && _b !== void 0 ? _b : 2);
            },
        };
    }
    /**
     * `get_console_logs` used to read `this.consoleMessages`, a buffer nothing ever
     * wrote to: `setupConsoleCapture` was an explicit placeholder, and `addConsoleMessage`
     * — the only method that appended to it — had zero call sites. The buffer was
     * therefore permanently empty and the action always reported `total: 0`, indistinguishable
     * from a genuinely quiet editor (#51).
     *
     * `temp/logs/project.log` is the editor's own console output and is already read
     * reliably by `get_project_logs`/`search_project_logs` — reuse that same tail-read
     * instead of a broadcast-listener capture this repo cannot verify against a live
     * 3.8.7 editor.
     */
    async getConsoleLogs(limit, filter) {
        let logFilePath;
        try {
            logFilePath = this.resolveLogFilePath();
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to read project logs: ${err.message}`);
        }
        const rawLines = this.readLogFileTail(logFilePath).split('\n').filter(line => line.trim() !== '');
        let logs = rawLines.map(line => ({
            timestamp: new Date().toISOString(),
            type: this.classifyLogLine(line),
            message: line
        }));
        if (filter !== 'all') {
            logs = logs.filter(log => log.type === filter);
        }
        const recentLogs = logs.slice(-limit);
        return (0, types_1.successResult)({
            total: logs.length,
            returned: recentLogs.length,
            logs: recentLogs,
            logFilePath
        });
    }
    /** Classify a project.log line by the same bracket/prefix convention get_project_logs already filters on. */
    classifyLogLine(line) {
        for (const { type, re } of ManageDebug.LOG_TYPE_PATTERNS) {
            if (re.test(line))
                return type;
        }
        return 'log';
    }
    async clearConsole() {
        try {
            // Note: Editor.Message.send may not return a promise in all versions
            Editor.Message.send('console', 'clear');
            return (0, types_1.successResult)(null, 'Console cleared successfully. get_console_logs reads temp/logs/project.log directly, which this does not truncate.');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    validateScript(script) {
        if (!script || typeof script !== 'string')
            return 'script is required';
        if (script.length > 10240)
            return 'Script exceeds maximum length of 10KB';
        const dangerous = [
            "require('child_process')",
            'require("child_process")',
            'process.exit',
            'eval(',
            'Function(',
        ];
        for (const pattern of dangerous) {
            if (script.includes(pattern)) {
                return `Script contains disallowed pattern: ${pattern}`;
            }
        }
        return null;
    }
    async executeScript(script) {
        var _a;
        const validationError = this.validateScript(script);
        if (validationError)
            return (0, types_1.errorResult)(validationError);
        try {
            // 'name' must be the registered package name (see package.json "name"), not an
            // arbitrary label — execute-scene-script resolves it to the package's scene.js
            // and calls the named export. 'console' is not a registered package, so this
            // previously always rejected with "instance not found" and execute_script was dead.
            const response = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server',
                method: 'eval',
                args: [script]
            });
            if (!(response === null || response === void 0 ? void 0 : response.success))
                return (0, types_1.errorResult)((response === null || response === void 0 ? void 0 : response.error) || 'Script execution failed');
            return (0, types_1.successResult)({
                result: (_a = response.data) === null || _a === void 0 ? void 0 : _a.result,
                message: 'Script executed successfully',
                warning: 'Code was executed in the scene context. Ensure scripts are trusted before execution.'
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getNodeTree(rootUuid, maxDepth = 10) {
        const buildTree = async (nodeUuid, depth = 0) => {
            if (depth >= maxDepth)
                return { truncated: true };
            try {
                const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
                const tree = {
                    uuid: nodeData.uuid,
                    name: nodeData.name,
                    active: nodeData.active,
                    components: nodeData.components ? nodeData.components.map((c) => c.__type__) : [],
                    childCount: nodeData.children ? nodeData.children.length : 0,
                    children: []
                };
                if (nodeData.children && nodeData.children.length > 0) {
                    for (const childId of nodeData.children) {
                        tree.children.push(await buildTree(childId, depth + 1));
                    }
                }
                return tree;
            }
            catch (err) {
                return { error: err.message };
            }
        };
        try {
            if (rootUuid) {
                return (0, types_1.successResult)(await buildTree(rootUuid));
            }
            else {
                const hierarchy = await Editor.Message.request('scene', 'query-hierarchy');
                const trees = [];
                for (const rootNode of hierarchy.children) {
                    trees.push(await buildTree(rootNode.uuid));
                }
                return (0, types_1.successResult)(trees);
            }
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getPerformanceStats() {
        try {
            const stats = await Editor.Message.request('scene', 'query-performance');
            const perfStats = {
                nodeCount: stats.nodeCount || 0,
                componentCount: stats.componentCount || 0,
                drawCalls: stats.drawCalls || 0,
                triangles: stats.triangles || 0,
                memory: stats.memory || {}
            };
            return (0, types_1.successResult)(perfStats);
        }
        catch (_a) {
            return (0, types_1.successResult)({ message: 'Performance stats not available in edit mode' });
        }
    }
    /**
     * Validate the open scene.
     *
     * Each enabled check runs in its own fault boundary. Previously a single failing
     * check aborted the whole action: Cocos Creator 3.8.7 registers no
     * `scene:check-missing-assets` message, so the request rejected with
     * `scene - check-missing-assets does not exist` and `validate_scene` returned an
     * error instead of a result (#23). An unsupported check is now reported as one
     * unsupported check, and the missing-asset scan falls back to walking the scene's
     * own component dumps for unresolvable asset UUIDs.
     */
    async validateScene(options) {
        const issues = [];
        const checks = {};
        if (options.checkMissingAssets) {
            const native = await this.checkMissingAssetsNative();
            if (native.supported) {
                checks.missingAssets = 'native';
                issues.push(...native.issues);
            }
            else {
                const scan = await this.scanMissingAssetReferences();
                checks.missingAssets = scan.error ? `unsupported: ${scan.error}` : 'fallback-scan';
                issues.push(...scan.issues);
            }
        }
        if (options.checkPerformance) {
            const perf = await this.checkNodeCount();
            checks.performance = perf.error ? `unsupported: ${perf.error}` : 'ok';
            issues.push(...perf.issues);
        }
        const result = {
            valid: issues.filter(i => i.type === 'error').length === 0,
            issueCount: issues.length,
            issues
        };
        return (0, types_1.successResult)(Object.assign(Object.assign({}, result), { checks }));
    }
    /** Try the editor's own missing-asset check. 3.8.7 does not register it. */
    async checkMissingAssetsNative() {
        try {
            const assetCheck = await Editor.Message.request('scene', 'check-missing-assets');
            if (assetCheck && Array.isArray(assetCheck.missing)) {
                return {
                    supported: true,
                    issues: assetCheck.missing.length ? [{
                            type: 'error',
                            category: 'assets',
                            message: `Found ${assetCheck.missing.length} missing asset references`,
                            details: assetCheck.missing
                        }] : []
                };
            }
            return { supported: false, issues: [] };
        }
        catch (_a) {
            return { supported: false, issues: [] };
        }
    }
    /**
     * Version-independent fallback: walk the scene's node dumps, collect every asset
     * UUID referenced by a component property, and report the ones the asset DB cannot
     * resolve. Same `ValidationIssue` shape as the native path.
     */
    async scanMissingAssetReferences() {
        var _a, _b, _c, _d, _e;
        let rootUuids;
        try {
            rootUuids = await this.collectSceneNodeUuids();
        }
        catch (err) {
            return { issues: [], error: `cannot enumerate scene nodes (${(err === null || err === void 0 ? void 0 : err.message) || err})` };
        }
        const referencedBy = new Map();
        for (const nodeUuid of rootUuids) {
            let nodeData;
            try {
                nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            }
            catch (_f) {
                continue;
            }
            const nodeName = (_c = (_b = (_a = nodeData === null || nodeData === void 0 ? void 0 : nodeData.name) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : nodeData === null || nodeData === void 0 ? void 0 : nodeData.name) !== null && _c !== void 0 ? _c : nodeUuid;
            for (const comp of ((_d = nodeData === null || nodeData === void 0 ? void 0 : nodeData.__comps__) !== null && _d !== void 0 ? _d : [])) {
                const compType = comp.__type__ || comp.cid || comp.type || 'Unknown';
                for (const uuid of (0, asset_refs_1.collectAssetUuids)((_e = comp.value) !== null && _e !== void 0 ? _e : comp)) {
                    if (!referencedBy.has(uuid))
                        referencedBy.set(uuid, new Set());
                    referencedBy.get(uuid).add(`${nodeName} → ${compType}`);
                }
            }
        }
        const missing = [];
        for (const [uuid, holders] of referencedBy) {
            let info = null;
            try {
                info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
            }
            catch (_g) {
                info = null;
            }
            if (!info)
                missing.push({ uuid, referencedBy: [...holders] });
        }
        if (!missing.length)
            return { issues: [] };
        return {
            issues: [{
                    type: 'error',
                    category: 'assets',
                    message: `Found ${missing.length} missing asset references`,
                    details: missing
                }]
        };
    }
    /** Flatten the scene tree to a list of node UUIDs. */
    async collectSceneNodeUuids() {
        const tree = await Editor.Message.request('scene', 'query-node-tree');
        const roots = Array.isArray(tree) ? tree : (tree ? [tree] : []);
        const uuids = [];
        const walk = (node) => {
            var _a;
            if (!node)
                return;
            if (typeof node.uuid === 'string')
                uuids.push(node.uuid);
            for (const child of ((_a = node.children) !== null && _a !== void 0 ? _a : []))
                walk(child);
        };
        roots.forEach(walk);
        return uuids;
    }
    async checkNodeCount() {
        let nodeCount;
        try {
            nodeCount = (await this.collectSceneNodeUuids()).length;
        }
        catch (err) {
            return { issues: [], error: `cannot enumerate scene nodes (${(err === null || err === void 0 ? void 0 : err.message) || err})` };
        }
        if (nodeCount <= 1000)
            return { issues: [] };
        return {
            issues: [{
                    type: 'warning',
                    category: 'performance',
                    message: `High node count: ${nodeCount} nodes (recommended < 1000)`,
                    suggestion: 'Consider using object pooling or scene optimization'
                }]
        };
    }
    async getEditorInfo() {
        var _a, _b;
        const info = {
            editor: {
                version: ((_a = Editor.versions) === null || _a === void 0 ? void 0 : _a.editor) || 'Unknown',
                cocosVersion: ((_b = Editor.versions) === null || _b === void 0 ? void 0 : _b.cocos) || 'Unknown',
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version
            },
            project: {
                name: Editor.Project.name,
                path: Editor.Project.path,
                uuid: Editor.Project.uuid
            },
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
        return (0, types_1.successResult)(info);
    }
    resolveLogFilePath() {
        const possiblePaths = [
            Editor.Project ? Editor.Project.path : null,
            process.cwd(),
        ].filter((p) => p !== null);
        for (const basePath of possiblePaths) {
            const testPath = path.join(basePath, 'temp/logs/project.log');
            if (fs.existsSync(testPath)) {
                return testPath;
            }
        }
        throw new Error(`Project log file not found. Tried paths: ${possiblePaths.map(p => path.join(p, 'temp/logs/project.log')).join(', ')}`);
    }
    /** Read up to last 100KB of a log file to avoid loading huge files into memory. */
    readLogFileTail(logFilePath) {
        const MAX_BYTES = 100 * 1024; // 100KB
        const stats = fs.statSync(logFilePath);
        const fileSize = stats.size;
        if (fileSize <= MAX_BYTES) {
            return fs.readFileSync(logFilePath, 'utf8');
        }
        const buffer = Buffer.alloc(MAX_BYTES);
        const fd = fs.openSync(logFilePath, 'r');
        try {
            fs.readSync(fd, buffer, 0, MAX_BYTES, fileSize - MAX_BYTES);
        }
        finally {
            fs.closeSync(fd);
        }
        // Skip the first (possibly partial) line
        const raw = buffer.toString('utf8');
        const newlineIdx = raw.indexOf('\n');
        return newlineIdx >= 0 ? raw.slice(newlineIdx + 1) : raw;
    }
    async getProjectLogs(lines, filterKeyword, logLevel = 'ALL') {
        try {
            const logFilePath = this.resolveLogFilePath();
            const logContent = this.readLogFileTail(logFilePath);
            const logLines = logContent.split('\n').filter(line => line.trim() !== '');
            // Get the last N lines
            const recentLines = logLines.slice(-lines);
            // Apply filters
            let filteredLines = recentLines;
            if (logLevel !== 'ALL') {
                filteredLines = filteredLines.filter(line => line.includes(`[${logLevel}]`) || line.includes(logLevel.toLowerCase()));
            }
            if (filterKeyword) {
                filteredLines = filteredLines.filter(line => line.toLowerCase().includes(filterKeyword.toLowerCase()));
            }
            return (0, types_1.successResult)({
                totalLines: logLines.length,
                requestedLines: lines,
                filteredLines: filteredLines.length,
                logLevel: logLevel,
                filterKeyword: filterKeyword || null,
                logs: filteredLines,
                logFilePath: logFilePath
            });
        }
        catch (error) {
            return (0, types_1.errorResult)(`Failed to read project logs: ${error.message}`);
        }
    }
    async getLogFileInfo() {
        try {
            const logFilePath = this.resolveLogFilePath();
            const stats = fs.statSync(logFilePath);
            // Count lines using tail read to avoid loading huge files
            const tailContent = this.readLogFileTail(logFilePath);
            const lineCount = tailContent.split('\n').filter(line => line.trim() !== '').length;
            return (0, types_1.successResult)({
                filePath: logFilePath,
                fileSize: stats.size,
                fileSizeFormatted: this.formatFileSize(stats.size),
                lastModified: stats.mtime.toISOString(),
                lineCount,
                created: stats.birthtime.toISOString(),
                accessible: fs.constants.R_OK,
                note: stats.size > 102400 ? 'File is large; only last 100KB is read.' : undefined
            });
        }
        catch (error) {
            return (0, types_1.errorResult)(`Failed to get log file info: ${error.message}`);
        }
    }
    async searchProjectLogs(pattern, maxResults, contextLines) {
        try {
            const logFilePath = this.resolveLogFilePath();
            const logContent = this.readLogFileTail(logFilePath);
            const logLines = logContent.split('\n');
            // Create regex pattern (support both string and regex patterns)
            let regex;
            try {
                regex = new RegExp(pattern, 'i');
            }
            catch (_a) {
                // If pattern is not valid regex, treat as literal string
                regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            }
            const matches = [];
            let resultCount = 0;
            for (let i = 0; i < logLines.length && resultCount < maxResults; i++) {
                const line = logLines[i];
                if (regex.test(line)) {
                    const contextStart = Math.max(0, i - contextLines);
                    const contextEnd = Math.min(logLines.length - 1, i + contextLines);
                    const contextLinesArray = [];
                    for (let j = contextStart; j <= contextEnd; j++) {
                        contextLinesArray.push({
                            lineNumber: j + 1,
                            content: logLines[j],
                            isMatch: j === i
                        });
                    }
                    matches.push({
                        lineNumber: i + 1,
                        matchedLine: line,
                        context: contextLinesArray
                    });
                    resultCount++;
                }
            }
            return (0, types_1.successResult)({
                pattern: pattern,
                totalMatches: matches.length,
                maxResults: maxResults,
                contextLines: contextLines,
                logFilePath: logFilePath,
                matches: matches
            });
        }
        catch (error) {
            return (0, types_1.errorResult)(`Failed to search project logs: ${error.message}`);
        }
    }
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}
exports.ManageDebug = ManageDebug;
/** Lines this file's own tail-read has ever managed to match against. */
ManageDebug.LOG_TYPE_PATTERNS = [
    { type: 'error', re: /\[error\]|(?:^|\s)error:/i },
    { type: 'warn', re: /\[warn(?:ing)?\]|(?:^|\s)warn(?:ing)?:/i },
    { type: 'info', re: /\[info\]|(?:^|\s)info:/i },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWRlYnVnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1kZWJ1Zy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLGtEQUEyRDtBQUUzRCxvREFBd0Q7QUFDeEQsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsa1VBQWtVLENBQUM7UUFDalYsWUFBTyxHQUFHO1lBQ2Ysa0JBQWtCO1lBQ2xCLGVBQWU7WUFDZixnQkFBZ0I7WUFDaEIsZUFBZTtZQUNmLHVCQUF1QjtZQUN2QixnQkFBZ0I7WUFDaEIsaUJBQWlCO1lBQ2pCLGtCQUFrQjtZQUNsQixtQkFBbUI7WUFDbkIscUJBQXFCO1NBQ3hCLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsc0RBQXNEO29CQUNuRSxPQUFPLEVBQUUsR0FBRztpQkFDZjtnQkFDRCxNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdDQUF3QztvQkFDckQsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztvQkFDN0MsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dCQUNELE1BQU0sRUFBRTtvQkFDSixJ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Qkwsa0NBb25CQztBQW5oQkcseUVBQXlFO0FBQ2pELDZCQUFpQixHQUF3RDtJQUM3RixFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLDJCQUEyQixFQUFFO0lBQ2xELEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUseUNBQXlDLEVBQUU7SUFDL0QsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSx5QkFBeUIsRUFBRTtDQUNsRCxBQUp3QyxDQUl2QyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29lcmNlQm9vbCwgY29lcmNlSW50IH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcbmltcG9ydCB7IENvbnNvbGVNZXNzYWdlLCBQZXJmb3JtYW5jZVN0YXRzLCBWYWxpZGF0aW9uUmVzdWx0LCBWYWxpZGF0aW9uSXNzdWUgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBjb2xsZWN0QXNzZXRVdWlkcyB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LXJlZnMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZURlYnVnIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2RlYnVnJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdEZWJ1ZyBhbmQgaW5zcGVjdCB0aGUgZWRpdG9yIGVudmlyb25tZW50LiBBY3Rpb25zOiBnZXRfY29uc29sZV9sb2dzLCBjbGVhcl9jb25zb2xlLCBleGVjdXRlX3NjcmlwdCwgZ2V0X25vZGVfdHJlZSwgZ2V0X3BlcmZvcm1hbmNlX3N0YXRzLCB2YWxpZGF0ZV9zY2VuZSwgZ2V0X2VkaXRvcl9pbmZvLCBnZXRfcHJvamVjdF9sb2dzLCBnZXRfbG9nX2ZpbGVfaW5mbywgc2VhcmNoX3Byb2plY3RfbG9ncy4gVXNlIGdldF9lZGl0b3JfaW5mbyBmb3IgZW52aXJvbm1lbnQgZGV0YWlscy4gVXNlIGV4ZWN1dGVfc2NyaXB0IHRvIHJ1biBKUyBpbiBzY2VuZSBjb250ZXh0Lic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFtcbiAgICAgICAgJ2dldF9jb25zb2xlX2xvZ3MnLFxuICAgICAgICAnY2xlYXJfY29uc29sZScsXG4gICAgICAgICdleGVjdXRlX3NjcmlwdCcsXG4gICAgICAgICdnZXRfbm9kZV90cmVlJyxcbiAgICAgICAgJ2dldF9wZXJmb3JtYW5jZV9zdGF0cycsXG4gICAgICAgICd2YWxpZGF0ZV9zY2VuZScsXG4gICAgICAgICdnZXRfZWRpdG9yX2luZm8nLFxuICAgICAgICAnZ2V0X3Byb2plY3RfbG9ncycsXG4gICAgICAgICdnZXRfbG9nX2ZpbGVfaW5mbycsXG4gICAgICAgICdzZWFyY2hfcHJvamVjdF9sb2dzJyxcbiAgICBdO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJyxcbiAgICAgICAgICAgICAgICBlbnVtOiB0aGlzLmFjdGlvbnMsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGltaXQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfY29uc29sZV9sb2dzXSBOdW1iZXIgb2YgcmVjZW50IGxvZ3MgdG8gcmV0cmlldmUnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDEwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmaWx0ZXI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfY29uc29sZV9sb2dzXSBGaWx0ZXIgbG9ncyBieSB0eXBlJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdsb2cnLCAnd2FybicsICdlcnJvcicsICdpbmZvJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NyaXB0OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZXhlY3V0ZV9zY3JpcHRdIEphdmFTY3JpcHQgY29kZSB0byBleGVjdXRlJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb290VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9ub2RlX3RyZWVdIFJvb3Qgbm9kZSBVVUlEIChvcHRpb25hbCwgdXNlcyBzY2VuZSByb290IGlmIG5vdCBwcm92aWRlZCknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heERlcHRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X25vZGVfdHJlZV0gTWF4aW11bSB0cmVlIGRlcHRoJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAxMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjaGVja01pc3NpbmdBc3NldHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbdmFsaWRhdGVfc2NlbmVdIENoZWNrIGZvciBtaXNzaW5nIGFzc2V0IHJlZmVyZW5jZXMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2hlY2tQZXJmb3JtYW5jZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1t2YWxpZGF0ZV9zY2VuZV0gQ2hlY2sgZm9yIHBlcmZvcm1hbmNlIGlzc3VlcycsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsaW5lczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9wcm9qZWN0X2xvZ3NdIE51bWJlciBvZiBsaW5lcyB0byByZWFkIGZyb20gdGhlIGVuZCBvZiB0aGUgbG9nIGZpbGUnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDEwMCxcbiAgICAgICAgICAgICAgICBtaW5pbXVtOiAxLFxuICAgICAgICAgICAgICAgIG1heGltdW06IDEwMDAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZpbHRlcktleXdvcmQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfcHJvamVjdF9sb2dzXSBGaWx0ZXIgbG9ncyBjb250YWluaW5nIHNwZWNpZmljIGtleXdvcmQgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbG9nTGV2ZWw6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfcHJvamVjdF9sb2dzXSBGaWx0ZXIgYnkgbG9nIGxldmVsJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ0VSUk9SJywgJ1dBUk4nLCAnSU5GTycsICdERUJVRycsICdUUkFDRScsICdBTEwnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnQUxMJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2VhcmNoX3Byb2plY3RfbG9nc10gU2VhcmNoIHBhdHRlcm4gKHN1cHBvcnRzIHJlZ2V4KScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWF4UmVzdWx0czoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NlYXJjaF9wcm9qZWN0X2xvZ3NdIE1heGltdW0gbnVtYmVyIG9mIG1hdGNoaW5nIHJlc3VsdHMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDIwLFxuICAgICAgICAgICAgICAgIG1pbmltdW06IDEsXG4gICAgICAgICAgICAgICAgbWF4aW11bTogMTAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRleHRMaW5lczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NlYXJjaF9wcm9qZWN0X2xvZ3NdIE51bWJlciBvZiBjb250ZXh0IGxpbmVzIHRvIHNob3cgYXJvdW5kIGVhY2ggbWF0Y2gnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDIsXG4gICAgICAgICAgICAgICAgbWluaW11bTogMCxcbiAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddLFxuICAgIH07XG5cbiAgICAvKiogTGluZXMgdGhpcyBmaWxlJ3Mgb3duIHRhaWwtcmVhZCBoYXMgZXZlciBtYW5hZ2VkIHRvIG1hdGNoIGFnYWluc3QuICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTE9HX1RZUEVfUEFUVEVSTlM6IEFycmF5PHsgdHlwZTogQ29uc29sZU1lc3NhZ2VbJ3R5cGUnXTsgcmU6IFJlZ0V4cCB9PiA9IFtcbiAgICAgICAgeyB0eXBlOiAnZXJyb3InLCByZTogL1xcW2Vycm9yXFxdfCg/Ol58XFxzKWVycm9yOi9pIH0sXG4gICAgICAgIHsgdHlwZTogJ3dhcm4nLCByZTogL1xcW3dhcm4oPzppbmcpP1xcXXwoPzpefFxccyl3YXJuKD86aW5nKT86L2kgfSxcbiAgICAgICAgeyB0eXBlOiAnaW5mbycsIHJlOiAvXFxbaW5mb1xcXXwoPzpefFxccylpbmZvOi9pIH0sXG4gICAgXTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBnZXRfY29uc29sZV9sb2dzOiAoYXJncykgPT4gdGhpcy5nZXRDb25zb2xlTG9ncyhcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLmxpbWl0KSA/PyAxMDAsXG4gICAgICAgICAgICBhcmdzLmZpbHRlciA/PyAnYWxsJ1xuICAgICAgICApLFxuICAgICAgICBjbGVhcl9jb25zb2xlOiAoX2FyZ3MpID0+IHRoaXMuY2xlYXJDb25zb2xlKCksXG4gICAgICAgIGV4ZWN1dGVfc2NyaXB0OiAoYXJncykgPT4gdGhpcy5leGVjdXRlU2NyaXB0KGFyZ3Muc2NyaXB0KSxcbiAgICAgICAgZ2V0X25vZGVfdHJlZTogKGFyZ3MpID0+IHRoaXMuZ2V0Tm9kZVRyZWUoXG4gICAgICAgICAgICBhcmdzLnJvb3RVdWlkLFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MubWF4RGVwdGgpID8/IDEwXG4gICAgICAgICksXG4gICAgICAgIGdldF9wZXJmb3JtYW5jZV9zdGF0czogKF9hcmdzKSA9PiB0aGlzLmdldFBlcmZvcm1hbmNlU3RhdHMoKSxcbiAgICAgICAgdmFsaWRhdGVfc2NlbmU6IChhcmdzKSA9PiB0aGlzLnZhbGlkYXRlU2NlbmUoe1xuICAgICAgICAgICAgY2hlY2tNaXNzaW5nQXNzZXRzOiBjb2VyY2VCb29sKGFyZ3MuY2hlY2tNaXNzaW5nQXNzZXRzKSA/PyB0cnVlLFxuICAgICAgICAgICAgY2hlY2tQZXJmb3JtYW5jZTogY29lcmNlQm9vbChhcmdzLmNoZWNrUGVyZm9ybWFuY2UpID8/IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBnZXRfZWRpdG9yX2luZm86IChfYXJncykgPT4gdGhpcy5nZXRFZGl0b3JJbmZvKCksXG4gICAgICAgIGdldF9wcm9qZWN0X2xvZ3M6IChhcmdzKSA9PiB0aGlzLmdldFByb2plY3RMb2dzKFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MubGluZXMpID8/IDEwMCxcbiAgICAgICAgICAgIGFyZ3MuZmlsdGVyS2V5d29yZCxcbiAgICAgICAgICAgIGFyZ3MubG9nTGV2ZWwgPz8gJ0FMTCdcbiAgICAgICAgKSxcbiAgICAgICAgZ2V0X2xvZ19maWxlX2luZm86IChfYXJncykgPT4gdGhpcy5nZXRMb2dGaWxlSW5mbygpLFxuICAgICAgICBzZWFyY2hfcHJvamVjdF9sb2dzOiAoYXJncykgPT4gdGhpcy5zZWFyY2hQcm9qZWN0TG9ncyhcbiAgICAgICAgICAgIGFyZ3MucGF0dGVybixcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLm1heFJlc3VsdHMpID8/IDIwLFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MuY29udGV4dExpbmVzKSA/PyAyXG4gICAgICAgICksXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIGBnZXRfY29uc29sZV9sb2dzYCB1c2VkIHRvIHJlYWQgYHRoaXMuY29uc29sZU1lc3NhZ2VzYCwgYSBidWZmZXIgbm90aGluZyBldmVyXG4gICAgICogd3JvdGUgdG86IGBzZXR1cENvbnNvbGVDYXB0dXJlYCB3YXMgYW4gZXhwbGljaXQgcGxhY2Vob2xkZXIsIGFuZCBgYWRkQ29uc29sZU1lc3NhZ2VgXG4gICAgICog4oCUIHRoZSBvbmx5IG1ldGhvZCB0aGF0IGFwcGVuZGVkIHRvIGl0IOKAlCBoYWQgemVybyBjYWxsIHNpdGVzLiBUaGUgYnVmZmVyIHdhc1xuICAgICAqIHRoZXJlZm9yZSBwZXJtYW5lbnRseSBlbXB0eSBhbmQgdGhlIGFjdGlvbiBhbHdheXMgcmVwb3J0ZWQgYHRvdGFsOiAwYCwgaW5kaXN0aW5ndWlzaGFibGVcbiAgICAgKiBmcm9tIGEgZ2VudWluZWx5IHF1aWV0IGVkaXRvciAoIzUxKS5cbiAgICAgKlxuICAgICAqIGB0ZW1wL2xvZ3MvcHJvamVjdC5sb2dgIGlzIHRoZSBlZGl0b3IncyBvd24gY29uc29sZSBvdXRwdXQgYW5kIGlzIGFscmVhZHkgcmVhZFxuICAgICAqIHJlbGlhYmx5IGJ5IGBnZXRfcHJvamVjdF9sb2dzYC9gc2VhcmNoX3Byb2plY3RfbG9nc2Ag4oCUIHJldXNlIHRoYXQgc2FtZSB0YWlsLXJlYWRcbiAgICAgKiBpbnN0ZWFkIG9mIGEgYnJvYWRjYXN0LWxpc3RlbmVyIGNhcHR1cmUgdGhpcyByZXBvIGNhbm5vdCB2ZXJpZnkgYWdhaW5zdCBhIGxpdmVcbiAgICAgKiAzLjguNyBlZGl0b3IuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRDb25zb2xlTG9ncyhsaW1pdDogbnVtYmVyLCBmaWx0ZXI6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBsZXQgbG9nRmlsZVBhdGg6IHN0cmluZztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvZ0ZpbGVQYXRoID0gdGhpcy5yZXNvbHZlTG9nRmlsZVBhdGgoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHJlYWQgcHJvamVjdCBsb2dzOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmF3TGluZXMgPSB0aGlzLnJlYWRMb2dGaWxlVGFpbChsb2dGaWxlUGF0aCkuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUudHJpbSgpICE9PSAnJyk7XG4gICAgICAgIGxldCBsb2dzOiBDb25zb2xlTWVzc2FnZVtdID0gcmF3TGluZXMubWFwKGxpbmUgPT4gKHtcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgdHlwZTogdGhpcy5jbGFzc2lmeUxvZ0xpbmUobGluZSksXG4gICAgICAgICAgICBtZXNzYWdlOiBsaW5lXG4gICAgICAgIH0pKTtcblxuICAgICAgICBpZiAoZmlsdGVyICE9PSAnYWxsJykge1xuICAgICAgICAgICAgbG9ncyA9IGxvZ3MuZmlsdGVyKGxvZyA9PiBsb2cudHlwZSA9PT0gZmlsdGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlY2VudExvZ3MgPSBsb2dzLnNsaWNlKC1saW1pdCk7XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgdG90YWw6IGxvZ3MubGVuZ3RoLFxuICAgICAgICAgICAgcmV0dXJuZWQ6IHJlY2VudExvZ3MubGVuZ3RoLFxuICAgICAgICAgICAgbG9nczogcmVjZW50TG9ncyxcbiAgICAgICAgICAgIGxvZ0ZpbGVQYXRoXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKiBDbGFzc2lmeSBhIHByb2plY3QubG9nIGxpbmUgYnkgdGhlIHNhbWUgYnJhY2tldC9wcmVmaXggY29udmVudGlvbiBnZXRfcHJvamVjdF9sb2dzIGFscmVhZHkgZmlsdGVycyBvbi4gKi9cbiAgICBwcml2YXRlIGNsYXNzaWZ5TG9nTGluZShsaW5lOiBzdHJpbmcpOiBDb25zb2xlTWVzc2FnZVsndHlwZSddIHtcbiAgICAgICAgZm9yIChjb25zdCB7IHR5cGUsIHJlIH0gb2YgTWFuYWdlRGVidWcuTE9HX1RZUEVfUEFUVEVSTlMpIHtcbiAgICAgICAgICAgIGlmIChyZS50ZXN0KGxpbmUpKSByZXR1cm4gdHlwZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gJ2xvZyc7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjbGVhckNvbnNvbGUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiBFZGl0b3IuTWVzc2FnZS5zZW5kIG1heSBub3QgcmV0dXJuIGEgcHJvbWlzZSBpbiBhbGwgdmVyc2lvbnNcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnNlbmQoJ2NvbnNvbGUnLCAnY2xlYXInKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdDb25zb2xlIGNsZWFyZWQgc3VjY2Vzc2Z1bGx5LiBnZXRfY29uc29sZV9sb2dzIHJlYWRzIHRlbXAvbG9ncy9wcm9qZWN0LmxvZyBkaXJlY3RseSwgd2hpY2ggdGhpcyBkb2VzIG5vdCB0cnVuY2F0ZS4nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHZhbGlkYXRlU2NyaXB0KHNjcmlwdDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmICghc2NyaXB0IHx8IHR5cGVvZiBzY3JpcHQgIT09ICdzdHJpbmcnKSByZXR1cm4gJ3NjcmlwdCBpcyByZXF1aXJlZCc7XG4gICAgICAgIGlmIChzY3JpcHQubGVuZ3RoID4gMTAyNDApIHJldHVybiAnU2NyaXB0IGV4Y2VlZHMgbWF4aW11bSBsZW5ndGggb2YgMTBLQic7XG4gICAgICAgIGNvbnN0IGRhbmdlcm91cyA9IFtcbiAgICAgICAgICAgIFwicmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpXCIsXG4gICAgICAgICAgICAncmVxdWlyZShcImNoaWxkX3Byb2Nlc3NcIiknLFxuICAgICAgICAgICAgJ3Byb2Nlc3MuZXhpdCcsXG4gICAgICAgICAgICAnZXZhbCgnLFxuICAgICAgICAgICAgJ0Z1bmN0aW9uKCcsXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBkYW5nZXJvdXMpIHtcbiAgICAgICAgICAgIGlmIChzY3JpcHQuaW5jbHVkZXMocGF0dGVybikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYFNjcmlwdCBjb250YWlucyBkaXNhbGxvd2VkIHBhdHRlcm46ICR7cGF0dGVybn1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNjcmlwdChzY3JpcHQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB2YWxpZGF0aW9uRXJyb3IgPSB0aGlzLnZhbGlkYXRlU2NyaXB0KHNjcmlwdCk7XG4gICAgICAgIGlmICh2YWxpZGF0aW9uRXJyb3IpIHJldHVybiBlcnJvclJlc3VsdCh2YWxpZGF0aW9uRXJyb3IpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gJ25hbWUnIG11c3QgYmUgdGhlIHJlZ2lzdGVyZWQgcGFja2FnZSBuYW1lIChzZWUgcGFja2FnZS5qc29uIFwibmFtZVwiKSwgbm90IGFuXG4gICAgICAgICAgICAvLyBhcmJpdHJhcnkgbGFiZWwg4oCUIGV4ZWN1dGUtc2NlbmUtc2NyaXB0IHJlc29sdmVzIGl0IHRvIHRoZSBwYWNrYWdlJ3Mgc2NlbmUuanNcbiAgICAgICAgICAgIC8vIGFuZCBjYWxscyB0aGUgbmFtZWQgZXhwb3J0LiAnY29uc29sZScgaXMgbm90IGEgcmVnaXN0ZXJlZCBwYWNrYWdlLCBzbyB0aGlzXG4gICAgICAgICAgICAvLyBwcmV2aW91c2x5IGFsd2F5cyByZWplY3RlZCB3aXRoIFwiaW5zdGFuY2Ugbm90IGZvdW5kXCIgYW5kIGV4ZWN1dGVfc2NyaXB0IHdhcyBkZWFkLlxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2U6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdldmFsJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbc2NyaXB0XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQocmVzcG9uc2U/LmVycm9yIHx8ICdTY3JpcHQgZXhlY3V0aW9uIGZhaWxlZCcpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHJlc3VsdDogcmVzcG9uc2UuZGF0YT8ucmVzdWx0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdTY3JpcHQgZXhlY3V0ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgICAgICB3YXJuaW5nOiAnQ29kZSB3YXMgZXhlY3V0ZWQgaW4gdGhlIHNjZW5lIGNvbnRleHQuIEVuc3VyZSBzY3JpcHRzIGFyZSB0cnVzdGVkIGJlZm9yZSBleGVjdXRpb24uJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlVHJlZShyb290VXVpZD86IHN0cmluZywgbWF4RGVwdGg6IG51bWJlciA9IDEwKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGJ1aWxkVHJlZSA9IGFzeW5jIChub2RlVXVpZDogc3RyaW5nLCBkZXB0aDogbnVtYmVyID0gMCk6IFByb21pc2U8YW55PiA9PiB7XG4gICAgICAgICAgICBpZiAoZGVwdGggPj0gbWF4RGVwdGgpIHJldHVybiB7IHRydW5jYXRlZDogdHJ1ZSB9O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICAgICAgY29uc3QgdHJlZSA9IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZURhdGEudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbm9kZURhdGEubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlOiBub2RlRGF0YS5hY3RpdmUsXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IChub2RlRGF0YSBhcyBhbnkpLmNvbXBvbmVudHMgPyAobm9kZURhdGEgYXMgYW55KS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PiBjLl9fdHlwZV9fKSA6IFtdLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZENvdW50OiBub2RlRGF0YS5jaGlsZHJlbiA/IG5vZGVEYXRhLmNoaWxkcmVuLmxlbmd0aCA6IDAsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXSBhcyBhbnlbXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLmNoaWxkcmVuICYmIG5vZGVEYXRhLmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZElkIG9mIG5vZGVEYXRhLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmVlLmNoaWxkcmVuLnB1c2goYXdhaXQgYnVpbGRUcmVlKGNoaWxkSWQsIGRlcHRoICsgMSkpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cmVlO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKHJvb3RVdWlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoYXdhaXQgYnVpbGRUcmVlKHJvb3RVdWlkKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhpZXJhcmNoeTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaGllcmFyY2h5Jyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdHJlZXMgPSBbXTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJvb3ROb2RlIG9mIGhpZXJhcmNoeS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICB0cmVlcy5wdXNoKGF3YWl0IGJ1aWxkVHJlZShyb290Tm9kZS51dWlkKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHRyZWVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFBlcmZvcm1hbmNlU3RhdHMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzdGF0czogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktcGVyZm9ybWFuY2UnKTtcbiAgICAgICAgICAgIGNvbnN0IHBlcmZTdGF0czogUGVyZm9ybWFuY2VTdGF0cyA9IHtcbiAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHN0YXRzLm5vZGVDb3VudCB8fCAwLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudENvdW50OiBzdGF0cy5jb21wb25lbnRDb3VudCB8fCAwLFxuICAgICAgICAgICAgICAgIGRyYXdDYWxsczogc3RhdHMuZHJhd0NhbGxzIHx8IDAsXG4gICAgICAgICAgICAgICAgdHJpYW5nbGVzOiBzdGF0cy50cmlhbmdsZXMgfHwgMCxcbiAgICAgICAgICAgICAgICBtZW1vcnk6IHN0YXRzLm1lbW9yeSB8fCB7fVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHBlcmZTdGF0cyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBtZXNzYWdlOiAnUGVyZm9ybWFuY2Ugc3RhdHMgbm90IGF2YWlsYWJsZSBpbiBlZGl0IG1vZGUnIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVmFsaWRhdGUgdGhlIG9wZW4gc2NlbmUuXG4gICAgICpcbiAgICAgKiBFYWNoIGVuYWJsZWQgY2hlY2sgcnVucyBpbiBpdHMgb3duIGZhdWx0IGJvdW5kYXJ5LiBQcmV2aW91c2x5IGEgc2luZ2xlIGZhaWxpbmdcbiAgICAgKiBjaGVjayBhYm9ydGVkIHRoZSB3aG9sZSBhY3Rpb246IENvY29zIENyZWF0b3IgMy44LjcgcmVnaXN0ZXJzIG5vXG4gICAgICogYHNjZW5lOmNoZWNrLW1pc3NpbmctYXNzZXRzYCBtZXNzYWdlLCBzbyB0aGUgcmVxdWVzdCByZWplY3RlZCB3aXRoXG4gICAgICogYHNjZW5lIC0gY2hlY2stbWlzc2luZy1hc3NldHMgZG9lcyBub3QgZXhpc3RgIGFuZCBgdmFsaWRhdGVfc2NlbmVgIHJldHVybmVkIGFuXG4gICAgICogZXJyb3IgaW5zdGVhZCBvZiBhIHJlc3VsdCAoIzIzKS4gQW4gdW5zdXBwb3J0ZWQgY2hlY2sgaXMgbm93IHJlcG9ydGVkIGFzIG9uZVxuICAgICAqIHVuc3VwcG9ydGVkIGNoZWNrLCBhbmQgdGhlIG1pc3NpbmctYXNzZXQgc2NhbiBmYWxscyBiYWNrIHRvIHdhbGtpbmcgdGhlIHNjZW5lJ3NcbiAgICAgKiBvd24gY29tcG9uZW50IGR1bXBzIGZvciB1bnJlc29sdmFibGUgYXNzZXQgVVVJRHMuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVNjZW5lKG9wdGlvbnM6IHsgY2hlY2tNaXNzaW5nQXNzZXRzOiBib29sZWFuOyBjaGVja1BlcmZvcm1hbmNlOiBib29sZWFuIH0pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgaXNzdWVzOiBWYWxpZGF0aW9uSXNzdWVbXSA9IFtdO1xuICAgICAgICBjb25zdCBjaGVja3M6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcblxuICAgICAgICBpZiAob3B0aW9ucy5jaGVja01pc3NpbmdBc3NldHMpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hdGl2ZSA9IGF3YWl0IHRoaXMuY2hlY2tNaXNzaW5nQXNzZXRzTmF0aXZlKCk7XG4gICAgICAgICAgICBpZiAobmF0aXZlLnN1cHBvcnRlZCkge1xuICAgICAgICAgICAgICAgIGNoZWNrcy5taXNzaW5nQXNzZXRzID0gJ25hdGl2ZSc7XG4gICAgICAgICAgICAgICAgaXNzdWVzLnB1c2goLi4ubmF0aXZlLmlzc3Vlcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjYW4gPSBhd2FpdCB0aGlzLnNjYW5NaXNzaW5nQXNzZXRSZWZlcmVuY2VzKCk7XG4gICAgICAgICAgICAgICAgY2hlY2tzLm1pc3NpbmdBc3NldHMgPSBzY2FuLmVycm9yID8gYHVuc3VwcG9ydGVkOiAke3NjYW4uZXJyb3J9YCA6ICdmYWxsYmFjay1zY2FuJztcbiAgICAgICAgICAgICAgICBpc3N1ZXMucHVzaCguLi5zY2FuLmlzc3Vlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5jaGVja1BlcmZvcm1hbmNlKSB7XG4gICAgICAgICAgICBjb25zdCBwZXJmID0gYXdhaXQgdGhpcy5jaGVja05vZGVDb3VudCgpO1xuICAgICAgICAgICAgY2hlY2tzLnBlcmZvcm1hbmNlID0gcGVyZi5lcnJvciA/IGB1bnN1cHBvcnRlZDogJHtwZXJmLmVycm9yfWAgOiAnb2snO1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goLi4ucGVyZi5pc3N1ZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0OiBWYWxpZGF0aW9uUmVzdWx0ID0ge1xuICAgICAgICAgICAgdmFsaWQ6IGlzc3Vlcy5maWx0ZXIoaSA9PiBpLnR5cGUgPT09ICdlcnJvcicpLmxlbmd0aCA9PT0gMCxcbiAgICAgICAgICAgIGlzc3VlQ291bnQ6IGlzc3Vlcy5sZW5ndGgsXG4gICAgICAgICAgICBpc3N1ZXNcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyAuLi5yZXN1bHQsIGNoZWNrcyB9KTtcbiAgICB9XG5cbiAgICAvKiogVHJ5IHRoZSBlZGl0b3IncyBvd24gbWlzc2luZy1hc3NldCBjaGVjay4gMy44LjcgZG9lcyBub3QgcmVnaXN0ZXIgaXQuICovXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja01pc3NpbmdBc3NldHNOYXRpdmUoKTogUHJvbWlzZTx7IHN1cHBvcnRlZDogYm9vbGVhbjsgaXNzdWVzOiBWYWxpZGF0aW9uSXNzdWVbXSB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldENoZWNrOiBhbnkgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdjaGVjay1taXNzaW5nLWFzc2V0cycpO1xuICAgICAgICAgICAgaWYgKGFzc2V0Q2hlY2sgJiYgQXJyYXkuaXNBcnJheShhc3NldENoZWNrLm1pc3NpbmcpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VwcG9ydGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBpc3N1ZXM6IGFzc2V0Q2hlY2subWlzc2luZy5sZW5ndGggPyBbe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5OiAnYXNzZXRzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBGb3VuZCAke2Fzc2V0Q2hlY2subWlzc2luZy5sZW5ndGh9IG1pc3NpbmcgYXNzZXQgcmVmZXJlbmNlc2AsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiBhc3NldENoZWNrLm1pc3NpbmdcbiAgICAgICAgICAgICAgICAgICAgfV0gOiBbXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdXBwb3J0ZWQ6IGZhbHNlLCBpc3N1ZXM6IFtdIH07XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VwcG9ydGVkOiBmYWxzZSwgaXNzdWVzOiBbXSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVmVyc2lvbi1pbmRlcGVuZGVudCBmYWxsYmFjazogd2FsayB0aGUgc2NlbmUncyBub2RlIGR1bXBzLCBjb2xsZWN0IGV2ZXJ5IGFzc2V0XG4gICAgICogVVVJRCByZWZlcmVuY2VkIGJ5IGEgY29tcG9uZW50IHByb3BlcnR5LCBhbmQgcmVwb3J0IHRoZSBvbmVzIHRoZSBhc3NldCBEQiBjYW5ub3RcbiAgICAgKiByZXNvbHZlLiBTYW1lIGBWYWxpZGF0aW9uSXNzdWVgIHNoYXBlIGFzIHRoZSBuYXRpdmUgcGF0aC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHNjYW5NaXNzaW5nQXNzZXRSZWZlcmVuY2VzKCk6IFByb21pc2U8eyBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgICAgIGxldCByb290VXVpZHM6IHN0cmluZ1tdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcm9vdFV1aWRzID0gYXdhaXQgdGhpcy5jb2xsZWN0U2NlbmVOb2RlVXVpZHMoKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGlzc3VlczogW10sIGVycm9yOiBgY2Fubm90IGVudW1lcmF0ZSBzY2VuZSBub2RlcyAoJHtlcnI/Lm1lc3NhZ2UgfHwgZXJyfSlgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZWZlcmVuY2VkQnkgPSBuZXcgTWFwPHN0cmluZywgU2V0PHN0cmluZz4+KCk7XG4gICAgICAgIGZvciAoY29uc3Qgbm9kZVV1aWQgb2Ygcm9vdFV1aWRzKSB7XG4gICAgICAgICAgICBsZXQgbm9kZURhdGE6IGFueTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBub2RlTmFtZSA9IG5vZGVEYXRhPy5uYW1lPy52YWx1ZSA/PyBub2RlRGF0YT8ubmFtZSA/PyBub2RlVXVpZDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcCBvZiAobm9kZURhdGE/Ll9fY29tcHNfXyA/PyBbXSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wVHlwZSA9IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJztcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHV1aWQgb2YgY29sbGVjdEFzc2V0VXVpZHMoY29tcC52YWx1ZSA/PyBjb21wKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlZmVyZW5jZWRCeS5oYXModXVpZCkpIHJlZmVyZW5jZWRCeS5zZXQodXVpZCwgbmV3IFNldCgpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVmZXJlbmNlZEJ5LmdldCh1dWlkKSEuYWRkKGAke25vZGVOYW1lfSDihpIgJHtjb21wVHlwZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtaXNzaW5nOiBBcnJheTx7IHV1aWQ6IHN0cmluZzsgcmVmZXJlbmNlZEJ5OiBzdHJpbmdbXSB9PiA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IFt1dWlkLCBob2xkZXJzXSBvZiByZWZlcmVuY2VkQnkpIHtcbiAgICAgICAgICAgIGxldCBpbmZvOiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHV1aWQpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgaW5mbyA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWluZm8pIG1pc3NpbmcucHVzaCh7IHV1aWQsIHJlZmVyZW5jZWRCeTogWy4uLmhvbGRlcnNdIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFtaXNzaW5nLmxlbmd0aCkgcmV0dXJuIHsgaXNzdWVzOiBbXSB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNzdWVzOiBbe1xuICAgICAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBGb3VuZCAke21pc3NpbmcubGVuZ3RofSBtaXNzaW5nIGFzc2V0IHJlZmVyZW5jZXNgLFxuICAgICAgICAgICAgICAgIGRldGFpbHM6IG1pc3NpbmdcbiAgICAgICAgICAgIH1dXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqIEZsYXR0ZW4gdGhlIHNjZW5lIHRyZWUgdG8gYSBsaXN0IG9mIG5vZGUgVVVJRHMuICovXG4gICAgcHJpdmF0ZSBhc3luYyBjb2xsZWN0U2NlbmVOb2RlVXVpZHMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgY29uc3Qgcm9vdHM6IGFueVtdID0gQXJyYXkuaXNBcnJheSh0cmVlKSA/IHRyZWUgOiAodHJlZSA/IFt0cmVlXSA6IFtdKTtcbiAgICAgICAgY29uc3QgdXVpZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygbm9kZS51dWlkID09PSAnc3RyaW5nJykgdXVpZHMucHVzaChub2RlLnV1aWQpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiAobm9kZS5jaGlsZHJlbiA/PyBbXSkpIHdhbGsoY2hpbGQpO1xuICAgICAgICB9O1xuICAgICAgICByb290cy5mb3JFYWNoKHdhbGspO1xuICAgICAgICByZXR1cm4gdXVpZHM7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja05vZGVDb3VudCgpOiBQcm9taXNlPHsgaXNzdWVzOiBWYWxpZGF0aW9uSXNzdWVbXTsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBsZXQgbm9kZUNvdW50OiBudW1iZXI7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBub2RlQ291bnQgPSAoYXdhaXQgdGhpcy5jb2xsZWN0U2NlbmVOb2RlVXVpZHMoKSkubGVuZ3RoO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNzdWVzOiBbXSwgZXJyb3I6IGBjYW5ub3QgZW51bWVyYXRlIHNjZW5lIG5vZGVzICgke2Vycj8ubWVzc2FnZSB8fCBlcnJ9KWAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZUNvdW50IDw9IDEwMDApIHJldHVybiB7IGlzc3VlczogW10gfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGlzc3VlczogW3tcbiAgICAgICAgICAgICAgICB0eXBlOiAnd2FybmluZycsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdwZXJmb3JtYW5jZScsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEhpZ2ggbm9kZSBjb3VudDogJHtub2RlQ291bnR9IG5vZGVzIChyZWNvbW1lbmRlZCA8IDEwMDApYCxcbiAgICAgICAgICAgICAgICBzdWdnZXN0aW9uOiAnQ29uc2lkZXIgdXNpbmcgb2JqZWN0IHBvb2xpbmcgb3Igc2NlbmUgb3B0aW1pemF0aW9uJ1xuICAgICAgICAgICAgfV1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEVkaXRvckluZm8oKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICBlZGl0b3I6IHtcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnM/LmVkaXRvciB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgY29jb3NWZXJzaW9uOiAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnM/LmNvY29zIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogcHJvY2Vzcy5wbGF0Zm9ybSxcbiAgICAgICAgICAgICAgICBhcmNoOiBwcm9jZXNzLmFyY2gsXG4gICAgICAgICAgICAgICAgbm9kZVZlcnNpb246IHByb2Nlc3MudmVyc2lvblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb2plY3Q6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBFZGl0b3IuUHJvamVjdC5uYW1lLFxuICAgICAgICAgICAgICAgIHBhdGg6IEVkaXRvci5Qcm9qZWN0LnBhdGgsXG4gICAgICAgICAgICAgICAgdXVpZDogRWRpdG9yLlByb2plY3QudXVpZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1lbW9yeTogcHJvY2Vzcy5tZW1vcnlVc2FnZSgpLFxuICAgICAgICAgICAgdXB0aW1lOiBwcm9jZXNzLnVwdGltZSgpXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNvbHZlTG9nRmlsZVBhdGgoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgcG9zc2libGVQYXRocyA9IFtcbiAgICAgICAgICAgIEVkaXRvci5Qcm9qZWN0ID8gRWRpdG9yLlByb2plY3QucGF0aCA6IG51bGwsXG4gICAgICAgICAgICBwcm9jZXNzLmN3ZCgpLFxuICAgICAgICBdLmZpbHRlcigocCk6IHAgaXMgc3RyaW5nID0+IHAgIT09IG51bGwpO1xuXG4gICAgICAgIGZvciAoY29uc3QgYmFzZVBhdGggb2YgcG9zc2libGVQYXRocykge1xuICAgICAgICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsICd0ZW1wL2xvZ3MvcHJvamVjdC5sb2cnKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRlc3RQYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXN0UGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBQcm9qZWN0IGxvZyBmaWxlIG5vdCBmb3VuZC4gVHJpZWQgcGF0aHM6ICR7cG9zc2libGVQYXRocy5tYXAocCA9PiBwYXRoLmpvaW4ocCwgJ3RlbXAvbG9ncy9wcm9qZWN0LmxvZycpKS5qb2luKCcsICcpfWBcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKiogUmVhZCB1cCB0byBsYXN0IDEwMEtCIG9mIGEgbG9nIGZpbGUgdG8gYXZvaWQgbG9hZGluZyBodWdlIGZpbGVzIGludG8gbWVtb3J5LiAqL1xuICAgIHByaXZhdGUgcmVhZExvZ0ZpbGVUYWlsKGxvZ0ZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBNQVhfQllURVMgPSAxMDAgKiAxMDI0OyAvLyAxMDBLQlxuICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgY29uc3QgZmlsZVNpemUgPSBzdGF0cy5zaXplO1xuICAgICAgICBpZiAoZmlsZVNpemUgPD0gTUFYX0JZVEVTKSB7XG4gICAgICAgICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCAndXRmOCcpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IEJ1ZmZlci5hbGxvYyhNQVhfQllURVMpO1xuICAgICAgICBjb25zdCBmZCA9IGZzLm9wZW5TeW5jKGxvZ0ZpbGVQYXRoLCAncicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnMucmVhZFN5bmMoZmQsIGJ1ZmZlciwgMCwgTUFYX0JZVEVTLCBmaWxlU2l6ZSAtIE1BWF9CWVRFUyk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBmcy5jbG9zZVN5bmMoZmQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNraXAgdGhlIGZpcnN0IChwb3NzaWJseSBwYXJ0aWFsKSBsaW5lXG4gICAgICAgIGNvbnN0IHJhdyA9IGJ1ZmZlci50b1N0cmluZygndXRmOCcpO1xuICAgICAgICBjb25zdCBuZXdsaW5lSWR4ID0gcmF3LmluZGV4T2YoJ1xcbicpO1xuICAgICAgICByZXR1cm4gbmV3bGluZUlkeCA+PSAwID8gcmF3LnNsaWNlKG5ld2xpbmVJZHggKyAxKSA6IHJhdztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByb2plY3RMb2dzKGxpbmVzOiBudW1iZXIsIGZpbHRlcktleXdvcmQ/OiBzdHJpbmcsIGxvZ0xldmVsOiBzdHJpbmcgPSAnQUxMJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZVBhdGggPSB0aGlzLnJlc29sdmVMb2dGaWxlUGF0aCgpO1xuXG4gICAgICAgICAgICBjb25zdCBsb2dDb250ZW50ID0gdGhpcy5yZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgbG9nTGluZXMgPSBsb2dDb250ZW50LnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLnRyaW0oKSAhPT0gJycpO1xuXG4gICAgICAgICAgICAvLyBHZXQgdGhlIGxhc3QgTiBsaW5lc1xuICAgICAgICAgICAgY29uc3QgcmVjZW50TGluZXMgPSBsb2dMaW5lcy5zbGljZSgtbGluZXMpO1xuXG4gICAgICAgICAgICAvLyBBcHBseSBmaWx0ZXJzXG4gICAgICAgICAgICBsZXQgZmlsdGVyZWRMaW5lcyA9IHJlY2VudExpbmVzO1xuXG4gICAgICAgICAgICBpZiAobG9nTGV2ZWwgIT09ICdBTEwnKSB7XG4gICAgICAgICAgICAgICAgZmlsdGVyZWRMaW5lcyA9IGZpbHRlcmVkTGluZXMuZmlsdGVyKGxpbmUgPT5cbiAgICAgICAgICAgICAgICAgICAgbGluZS5pbmNsdWRlcyhgWyR7bG9nTGV2ZWx9XWApIHx8IGxpbmUuaW5jbHVkZXMobG9nTGV2ZWwudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmlsdGVyS2V5d29yZCkge1xuICAgICAgICAgICAgICAgIGZpbHRlcmVkTGluZXMgPSBmaWx0ZXJlZExpbmVzLmZpbHRlcihsaW5lID0+XG4gICAgICAgICAgICAgICAgICAgIGxpbmUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhmaWx0ZXJLZXl3b3JkLnRvTG93ZXJDYXNlKCkpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHRvdGFsTGluZXM6IGxvZ0xpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICByZXF1ZXN0ZWRMaW5lczogbGluZXMsXG4gICAgICAgICAgICAgICAgZmlsdGVyZWRMaW5lczogZmlsdGVyZWRMaW5lcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgbG9nTGV2ZWw6IGxvZ0xldmVsLFxuICAgICAgICAgICAgICAgIGZpbHRlcktleXdvcmQ6IGZpbHRlcktleXdvcmQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBsb2dzOiBmaWx0ZXJlZExpbmVzLFxuICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiBsb2dGaWxlUGF0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHJlYWQgcHJvamVjdCBsb2dzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldExvZ0ZpbGVJbmZvKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZVBhdGggPSB0aGlzLnJlc29sdmVMb2dGaWxlUGF0aCgpO1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICAvLyBDb3VudCBsaW5lcyB1c2luZyB0YWlsIHJlYWQgdG8gYXZvaWQgbG9hZGluZyBodWdlIGZpbGVzXG4gICAgICAgICAgICBjb25zdCB0YWlsQ29udGVudCA9IHRoaXMucmVhZExvZ0ZpbGVUYWlsKGxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVDb3VudCA9IHRhaWxDb250ZW50LnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLnRyaW0oKSAhPT0gJycpLmxlbmd0aDtcblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBsb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICBmaWxlU2l6ZTogc3RhdHMuc2l6ZSxcbiAgICAgICAgICAgICAgICBmaWxlU2l6ZUZvcm1hdHRlZDogdGhpcy5mb3JtYXRGaWxlU2l6ZShzdGF0cy5zaXplKSxcbiAgICAgICAgICAgICAgICBsYXN0TW9kaWZpZWQ6IHN0YXRzLm10aW1lLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgbGluZUNvdW50LFxuICAgICAgICAgICAgICAgIGNyZWF0ZWQ6IHN0YXRzLmJpcnRodGltZS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGFjY2Vzc2libGU6IGZzLmNvbnN0YW50cy5SX09LLFxuICAgICAgICAgICAgICAgIG5vdGU6IHN0YXRzLnNpemUgPiAxMDI0MDAgPyAnRmlsZSBpcyBsYXJnZTsgb25seSBsYXN0IDEwMEtCIGlzIHJlYWQuJyA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBsb2cgZmlsZSBpbmZvOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNlYXJjaFByb2plY3RMb2dzKHBhdHRlcm46IHN0cmluZywgbWF4UmVzdWx0czogbnVtYmVyLCBjb250ZXh0TGluZXM6IG51bWJlcik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZVBhdGggPSB0aGlzLnJlc29sdmVMb2dGaWxlUGF0aCgpO1xuXG4gICAgICAgICAgICBjb25zdCBsb2dDb250ZW50ID0gdGhpcy5yZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgbG9nTGluZXMgPSBsb2dDb250ZW50LnNwbGl0KCdcXG4nKTtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIHJlZ2V4IHBhdHRlcm4gKHN1cHBvcnQgYm90aCBzdHJpbmcgYW5kIHJlZ2V4IHBhdHRlcm5zKVxuICAgICAgICAgICAgbGV0IHJlZ2V4OiBSZWdFeHA7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnaScpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gSWYgcGF0dGVybiBpcyBub3QgdmFsaWQgcmVnZXgsIHRyZWF0IGFzIGxpdGVyYWwgc3RyaW5nXG4gICAgICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4ucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKSwgJ2knKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGxldCByZXN1bHRDb3VudCA9IDA7XG5cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbG9nTGluZXMubGVuZ3RoICYmIHJlc3VsdENvdW50IDwgbWF4UmVzdWx0czsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxvZ0xpbmVzW2ldO1xuICAgICAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KGxpbmUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRleHRTdGFydCA9IE1hdGgubWF4KDAsIGkgLSBjb250ZXh0TGluZXMpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0RW5kID0gTWF0aC5taW4obG9nTGluZXMubGVuZ3RoIC0gMSwgaSArIGNvbnRleHRMaW5lcyk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGV4dExpbmVzQXJyYXkgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IGNvbnRleHRTdGFydDsgaiA8PSBjb250ZXh0RW5kOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHRMaW5lc0FycmF5LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGogKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGxvZ0xpbmVzW2pdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzTWF0Y2g6IGogPT09IGlcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGkgKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZExpbmU6IGxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0OiBjb250ZXh0TGluZXNBcnJheVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0Q291bnQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgICAgICAgIHRvdGFsTWF0Y2hlczogbWF0Y2hlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgbWF4UmVzdWx0czogbWF4UmVzdWx0cyxcbiAgICAgICAgICAgICAgICBjb250ZXh0TGluZXM6IGNvbnRleHRMaW5lcyxcbiAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDogbG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWF0Y2hlczogbWF0Y2hlc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHNlYXJjaCBwcm9qZWN0IGxvZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZm9ybWF0RmlsZVNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHVuaXRzID0gWydCJywgJ0tCJywgJ01CJywgJ0dCJ107XG4gICAgICAgIGxldCBzaXplID0gYnl0ZXM7XG4gICAgICAgIGxldCB1bml0SW5kZXggPSAwO1xuXG4gICAgICAgIHdoaWxlIChzaXplID49IDEwMjQgJiYgdW5pdEluZGV4IDwgdW5pdHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgc2l6ZSAvPSAxMDI0O1xuICAgICAgICAgICAgdW5pdEluZGV4Kys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYCR7c2l6ZS50b0ZpeGVkKDIpfSAke3VuaXRzW3VuaXRJbmRleF19YDtcbiAgICB9XG59XG4iXX0=