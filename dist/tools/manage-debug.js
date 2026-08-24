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
        super();
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
        // State preserved from DebugTools
        this.consoleMessages = [];
        this.maxMessages = 1000;
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
        this.setupConsoleCapture();
    }
    setupConsoleCapture() {
        // Intercept Editor console messages
        // Note: Editor.Message.addBroadcastListener may not be available in all versions
        // This is a placeholder for console capture implementation
        console.log('Console capture setup - implementation depends on Editor API availability');
    }
    addConsoleMessage(message) {
        this.consoleMessages.push(Object.assign({ timestamp: new Date().toISOString() }, message));
        // Keep only latest messages
        if (this.consoleMessages.length > this.maxMessages) {
            this.consoleMessages.shift();
        }
    }
    async getConsoleLogs(limit, filter) {
        let logs = this.consoleMessages;
        if (filter !== 'all') {
            logs = logs.filter(log => log.type === filter);
        }
        const recentLogs = logs.slice(-limit);
        return (0, types_1.successResult)({
            total: logs.length,
            returned: recentLogs.length,
            logs: recentLogs
        });
    }
    async clearConsole() {
        this.consoleMessages = [];
        try {
            // Note: Editor.Message.send may not return a promise in all versions
            Editor.Message.send('console', 'clear');
            return (0, types_1.successResult)(null, 'Console cleared successfully');
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
                regex = new RegExp(pattern, 'gi');
            }
            catch (_a) {
                // If pattern is not valid regex, treat as literal string
                regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
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
                    // Reset regex lastIndex for global search
                    regex.lastIndex = 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWRlYnVnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1kZWJ1Zy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLGtEQUEyRDtBQUUzRCxvREFBd0Q7QUFDeEQsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixNQUFhLFdBQVksU0FBUSxpQ0FBYztJQXFHM0M7UUFDSSxLQUFLLEVBQUUsQ0FBQztRQXJHSCxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsa1VBQWtVLENBQUM7UUFDalYsWUFBTyxHQUFHO1lBQ2Ysa0JBQWtCO1lBQ2xCLGVBQWU7WUFDZixnQkFBZ0I7WUFDaEIsZUFBZTtZQUNmLHVCQUF1QjtZQUN2QixnQkFBZ0I7WUFDaEIsaUJBQWlCO1lBQ2pCLGtCQUFrQjtZQUNsQixtQkFBbUI7WUFDbkIscUJBQXFCO1NBQ3hCLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsc0RBQXNEO29CQUNuRSxPQUFPLEVBQUUsR0FBRztpQkFDZjtnQkFDRCxNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdDQUF3QztvQkFDckQsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztvQkFDN0MsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dC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SyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7Z0JBQ3hCLENBQUM7WUFDTCxDQUFDO1lBRUQsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLE9BQU8sRUFBRSxPQUFPO2dCQUNoQixZQUFZLEVBQUUsT0FBTyxDQUFDLE1BQU07Z0JBQzVCLFVBQVUsRUFBRSxVQUFVO2dCQUN0QixZQUFZLEVBQUUsWUFBWTtnQkFDMUIsV0FBVyxFQUFFLFdBQVc7Z0JBQ3hCLE9BQU8sRUFBRSxPQUFPO2FBQ25CLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGtDQUFrQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUMxRSxDQUFDO0lBQ0wsQ0FBQztJQUVPLGNBQWMsQ0FBQyxLQUFhO1FBQ2hDLE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdEMsSUFBSSxJQUFJLEdBQUcsS0FBSyxDQUFDO1FBQ2pCLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztRQUVsQixPQUFPLElBQUksSUFBSSxJQUFJLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDbEQsSUFBSSxJQUFJLElBQUksQ0FBQztZQUNiLFNBQVMsRUFBRSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztJQUNwRCxDQUFDO0NBQ0o7QUE5bUJELGtDQThtQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wsIGNvZXJjZUludCB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5pbXBvcnQgeyBDb25zb2xlTWVzc2FnZSwgUGVyZm9ybWFuY2VTdGF0cywgVmFsaWRhdGlvblJlc3VsdCwgVmFsaWRhdGlvbklzc3VlIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29sbGVjdEFzc2V0VXVpZHMgfSBmcm9tICcuLi91dGlscy9hc3NldC1yZWZzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VEZWJ1ZyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9kZWJ1Zyc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnRGVidWcgYW5kIGluc3BlY3QgdGhlIGVkaXRvciBlbnZpcm9ubWVudC4gQWN0aW9uczogZ2V0X2NvbnNvbGVfbG9ncywgY2xlYXJfY29uc29sZSwgZXhlY3V0ZV9zY3JpcHQsIGdldF9ub2RlX3RyZWUsIGdldF9wZXJmb3JtYW5jZV9zdGF0cywgdmFsaWRhdGVfc2NlbmUsIGdldF9lZGl0b3JfaW5mbywgZ2V0X3Byb2plY3RfbG9ncywgZ2V0X2xvZ19maWxlX2luZm8sIHNlYXJjaF9wcm9qZWN0X2xvZ3MuIFVzZSBnZXRfZWRpdG9yX2luZm8gZm9yIGVudmlyb25tZW50IGRldGFpbHMuIFVzZSBleGVjdXRlX3NjcmlwdCB0byBydW4gSlMgaW4gc2NlbmUgY29udGV4dC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdnZXRfY29uc29sZV9sb2dzJyxcbiAgICAgICAgJ2NsZWFyX2NvbnNvbGUnLFxuICAgICAgICAnZXhlY3V0ZV9zY3JpcHQnLFxuICAgICAgICAnZ2V0X25vZGVfdHJlZScsXG4gICAgICAgICdnZXRfcGVyZm9ybWFuY2Vfc3RhdHMnLFxuICAgICAgICAndmFsaWRhdGVfc2NlbmUnLFxuICAgICAgICAnZ2V0X2VkaXRvcl9pbmZvJyxcbiAgICAgICAgJ2dldF9wcm9qZWN0X2xvZ3MnLFxuICAgICAgICAnZ2V0X2xvZ19maWxlX2luZm8nLFxuICAgICAgICAnc2VhcmNoX3Byb2plY3RfbG9ncycsXG4gICAgXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybScsXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxpbWl0OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2NvbnNvbGVfbG9nc10gTnVtYmVyIG9mIHJlY2VudCBsb2dzIHRvIHJldHJpZXZlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAxMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmlsdGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2NvbnNvbGVfbG9nc10gRmlsdGVyIGxvZ3MgYnkgdHlwZScsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnbG9nJywgJ3dhcm4nLCAnZXJyb3InLCAnaW5mbyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjcmlwdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2V4ZWN1dGVfc2NyaXB0XSBKYXZhU2NyaXB0IGNvZGUgdG8gZXhlY3V0ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm9vdFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfbm9kZV90cmVlXSBSb290IG5vZGUgVVVJRCAob3B0aW9uYWwsIHVzZXMgc2NlbmUgcm9vdCBpZiBub3QgcHJvdmlkZWQpJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhEZXB0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9ub2RlX3RyZWVdIE1heGltdW0gdHJlZSBkZXB0aCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMTAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2hlY2tNaXNzaW5nQXNzZXRzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3ZhbGlkYXRlX3NjZW5lXSBDaGVjayBmb3IgbWlzc2luZyBhc3NldCByZWZlcmVuY2VzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNoZWNrUGVyZm9ybWFuY2U6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbdmFsaWRhdGVfc2NlbmVdIENoZWNrIGZvciBwZXJmb3JtYW5jZSBpc3N1ZXMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGluZXM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfcHJvamVjdF9sb2dzXSBOdW1iZXIgb2YgbGluZXMgdG8gcmVhZCBmcm9tIHRoZSBlbmQgb2YgdGhlIGxvZyBmaWxlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAxMDAsXG4gICAgICAgICAgICAgICAgbWluaW11bTogMSxcbiAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMDAwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmaWx0ZXJLZXl3b3JkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X3Byb2plY3RfbG9nc10gRmlsdGVyIGxvZ3MgY29udGFpbmluZyBzcGVjaWZpYyBrZXl3b3JkIChvcHRpb25hbCknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxvZ0xldmVsOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X3Byb2plY3RfbG9nc10gRmlsdGVyIGJ5IGxvZyBsZXZlbCcsXG4gICAgICAgICAgICAgICAgZW51bTogWydFUlJPUicsICdXQVJOJywgJ0lORk8nLCAnREVCVUcnLCAnVFJBQ0UnLCAnQUxMJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ0FMTCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NlYXJjaF9wcm9qZWN0X2xvZ3NdIFNlYXJjaCBwYXR0ZXJuIChzdXBwb3J0cyByZWdleCknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heFJlc3VsdHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZWFyY2hfcHJvamVjdF9sb2dzXSBNYXhpbXVtIG51bWJlciBvZiBtYXRjaGluZyByZXN1bHRzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAyMCxcbiAgICAgICAgICAgICAgICBtaW5pbXVtOiAxLFxuICAgICAgICAgICAgICAgIG1heGltdW06IDEwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb250ZXh0TGluZXM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZWFyY2hfcHJvamVjdF9sb2dzXSBOdW1iZXIgb2YgY29udGV4dCBsaW5lcyB0byBzaG93IGFyb3VuZCBlYWNoIG1hdGNoJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAyLFxuICAgICAgICAgICAgICAgIG1pbmltdW06IDAsXG4gICAgICAgICAgICAgICAgbWF4aW11bTogMTAsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXSxcbiAgICB9O1xuXG4gICAgLy8gU3RhdGUgcHJlc2VydmVkIGZyb20gRGVidWdUb29sc1xuICAgIHByaXZhdGUgY29uc29sZU1lc3NhZ2VzOiBDb25zb2xlTWVzc2FnZVtdID0gW107XG4gICAgcHJpdmF0ZSByZWFkb25seSBtYXhNZXNzYWdlcyA9IDEwMDA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zZXR1cENvbnNvbGVDYXB0dXJlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXR1cENvbnNvbGVDYXB0dXJlKCk6IHZvaWQge1xuICAgICAgICAvLyBJbnRlcmNlcHQgRWRpdG9yIGNvbnNvbGUgbWVzc2FnZXNcbiAgICAgICAgLy8gTm90ZTogRWRpdG9yLk1lc3NhZ2UuYWRkQnJvYWRjYXN0TGlzdGVuZXIgbWF5IG5vdCBiZSBhdmFpbGFibGUgaW4gYWxsIHZlcnNpb25zXG4gICAgICAgIC8vIFRoaXMgaXMgYSBwbGFjZWhvbGRlciBmb3IgY29uc29sZSBjYXB0dXJlIGltcGxlbWVudGF0aW9uXG4gICAgICAgIGNvbnNvbGUubG9nKCdDb25zb2xlIGNhcHR1cmUgc2V0dXAgLSBpbXBsZW1lbnRhdGlvbiBkZXBlbmRzIG9uIEVkaXRvciBBUEkgYXZhaWxhYmlsaXR5Jyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhZGRDb25zb2xlTWVzc2FnZShtZXNzYWdlOiBhbnkpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIC4uLm1lc3NhZ2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gS2VlcCBvbmx5IGxhdGVzdCBtZXNzYWdlc1xuICAgICAgICBpZiAodGhpcy5jb25zb2xlTWVzc2FnZXMubGVuZ3RoID4gdGhpcy5tYXhNZXNzYWdlcykge1xuICAgICAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMuc2hpZnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBnZXRfY29uc29sZV9sb2dzOiAoYXJncykgPT4gdGhpcy5nZXRDb25zb2xlTG9ncyhcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLmxpbWl0KSA/PyAxMDAsXG4gICAgICAgICAgICBhcmdzLmZpbHRlciA/PyAnYWxsJ1xuICAgICAgICApLFxuICAgICAgICBjbGVhcl9jb25zb2xlOiAoX2FyZ3MpID0+IHRoaXMuY2xlYXJDb25zb2xlKCksXG4gICAgICAgIGV4ZWN1dGVfc2NyaXB0OiAoYXJncykgPT4gdGhpcy5leGVjdXRlU2NyaXB0KGFyZ3Muc2NyaXB0KSxcbiAgICAgICAgZ2V0X25vZGVfdHJlZTogKGFyZ3MpID0+IHRoaXMuZ2V0Tm9kZVRyZWUoXG4gICAgICAgICAgICBhcmdzLnJvb3RVdWlkLFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MubWF4RGVwdGgpID8/IDEwXG4gICAgICAgICksXG4gICAgICAgIGdldF9wZXJmb3JtYW5jZV9zdGF0czogKF9hcmdzKSA9PiB0aGlzLmdldFBlcmZvcm1hbmNlU3RhdHMoKSxcbiAgICAgICAgdmFsaWRhdGVfc2NlbmU6IChhcmdzKSA9PiB0aGlzLnZhbGlkYXRlU2NlbmUoe1xuICAgICAgICAgICAgY2hlY2tNaXNzaW5nQXNzZXRzOiBjb2VyY2VCb29sKGFyZ3MuY2hlY2tNaXNzaW5nQXNzZXRzKSA/PyB0cnVlLFxuICAgICAgICAgICAgY2hlY2tQZXJmb3JtYW5jZTogY29lcmNlQm9vbChhcmdzLmNoZWNrUGVyZm9ybWFuY2UpID8/IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBnZXRfZWRpdG9yX2luZm86IChfYXJncykgPT4gdGhpcy5nZXRFZGl0b3JJbmZvKCksXG4gICAgICAgIGdldF9wcm9qZWN0X2xvZ3M6IChhcmdzKSA9PiB0aGlzLmdldFByb2plY3RMb2dzKFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MubGluZXMpID8/IDEwMCxcbiAgICAgICAgICAgIGFyZ3MuZmlsdGVyS2V5d29yZCxcbiAgICAgICAgICAgIGFyZ3MubG9nTGV2ZWwgPz8gJ0FMTCdcbiAgICAgICAgKSxcbiAgICAgICAgZ2V0X2xvZ19maWxlX2luZm86IChfYXJncykgPT4gdGhpcy5nZXRMb2dGaWxlSW5mbygpLFxuICAgICAgICBzZWFyY2hfcHJvamVjdF9sb2dzOiAoYXJncykgPT4gdGhpcy5zZWFyY2hQcm9qZWN0TG9ncyhcbiAgICAgICAgICAgIGFyZ3MucGF0dGVybixcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLm1heFJlc3VsdHMpID8/IDIwLFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MuY29udGV4dExpbmVzKSA/PyAyXG4gICAgICAgICksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29uc29sZUxvZ3MobGltaXQ6IG51bWJlciwgZmlsdGVyOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgbGV0IGxvZ3MgPSB0aGlzLmNvbnNvbGVNZXNzYWdlcztcblxuICAgICAgICBpZiAoZmlsdGVyICE9PSAnYWxsJykge1xuICAgICAgICAgICAgbG9ncyA9IGxvZ3MuZmlsdGVyKGxvZyA9PiBsb2cudHlwZSA9PT0gZmlsdGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlY2VudExvZ3MgPSBsb2dzLnNsaWNlKC1saW1pdCk7XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgdG90YWw6IGxvZ3MubGVuZ3RoLFxuICAgICAgICAgICAgcmV0dXJuZWQ6IHJlY2VudExvZ3MubGVuZ3RoLFxuICAgICAgICAgICAgbG9nczogcmVjZW50TG9nc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNsZWFyQ29uc29sZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMgPSBbXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogRWRpdG9yLk1lc3NhZ2Uuc2VuZCBtYXkgbm90IHJldHVybiBhIHByb21pc2UgaW4gYWxsIHZlcnNpb25zXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5zZW5kKCdjb25zb2xlJywgJ2NsZWFyJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnQ29uc29sZSBjbGVhcmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgdmFsaWRhdGVTY3JpcHQoc2NyaXB0OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCFzY3JpcHQgfHwgdHlwZW9mIHNjcmlwdCAhPT0gJ3N0cmluZycpIHJldHVybiAnc2NyaXB0IGlzIHJlcXVpcmVkJztcbiAgICAgICAgaWYgKHNjcmlwdC5sZW5ndGggPiAxMDI0MCkgcmV0dXJuICdTY3JpcHQgZXhjZWVkcyBtYXhpbXVtIGxlbmd0aCBvZiAxMEtCJztcbiAgICAgICAgY29uc3QgZGFuZ2Vyb3VzID0gW1xuICAgICAgICAgICAgXCJyZXF1aXJlKCdjaGlsZF9wcm9jZXNzJylcIixcbiAgICAgICAgICAgICdyZXF1aXJlKFwiY2hpbGRfcHJvY2Vzc1wiKScsXG4gICAgICAgICAgICAncHJvY2Vzcy5leGl0JyxcbiAgICAgICAgICAgICdldmFsKCcsXG4gICAgICAgICAgICAnRnVuY3Rpb24oJyxcbiAgICAgICAgXTtcbiAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGRhbmdlcm91cykge1xuICAgICAgICAgICAgaWYgKHNjcmlwdC5pbmNsdWRlcyhwYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgU2NyaXB0IGNvbnRhaW5zIGRpc2FsbG93ZWQgcGF0dGVybjogJHtwYXR0ZXJufWA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlU2NyaXB0KHNjcmlwdDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHZhbGlkYXRpb25FcnJvciA9IHRoaXMudmFsaWRhdGVTY3JpcHQoc2NyaXB0KTtcbiAgICAgICAgaWYgKHZhbGlkYXRpb25FcnJvcikgcmV0dXJuIGVycm9yUmVzdWx0KHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyAnbmFtZScgbXVzdCBiZSB0aGUgcmVnaXN0ZXJlZCBwYWNrYWdlIG5hbWUgKHNlZSBwYWNrYWdlLmpzb24gXCJuYW1lXCIpLCBub3QgYW5cbiAgICAgICAgICAgIC8vIGFyYml0cmFyeSBsYWJlbCDigJQgZXhlY3V0ZS1zY2VuZS1zY3JpcHQgcmVzb2x2ZXMgaXQgdG8gdGhlIHBhY2thZ2UncyBzY2VuZS5qc1xuICAgICAgICAgICAgLy8gYW5kIGNhbGxzIHRoZSBuYW1lZCBleHBvcnQuICdjb25zb2xlJyBpcyBub3QgYSByZWdpc3RlcmVkIHBhY2thZ2UsIHNvIHRoaXNcbiAgICAgICAgICAgIC8vIHByZXZpb3VzbHkgYWx3YXlzIHJlamVjdGVkIHdpdGggXCJpbnN0YW5jZSBub3QgZm91bmRcIiBhbmQgZXhlY3V0ZV9zY3JpcHQgd2FzIGRlYWQuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2V2YWwnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFtzY3JpcHRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2U/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdChyZXNwb25zZT8uZXJyb3IgfHwgJ1NjcmlwdCBleGVjdXRpb24gZmFpbGVkJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgcmVzdWx0OiByZXNwb25zZS5kYXRhPy5yZXN1bHQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1NjcmlwdCBleGVjdXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIHdhcm5pbmc6ICdDb2RlIHdhcyBleGVjdXRlZCBpbiB0aGUgc2NlbmUgY29udGV4dC4gRW5zdXJlIHNjcmlwdHMgYXJlIHRydXN0ZWQgYmVmb3JlIGV4ZWN1dGlvbi4nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVUcmVlKHJvb3RVdWlkPzogc3RyaW5nLCBtYXhEZXB0aDogbnVtYmVyID0gMTApOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgYnVpbGRUcmVlID0gYXN5bmMgKG5vZGVVdWlkOiBzdHJpbmcsIGRlcHRoOiBudW1iZXIgPSAwKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgICAgIGlmIChkZXB0aCA+PSBtYXhEZXB0aCkgcmV0dXJuIHsgdHJ1bmNhdGVkOiB0cnVlIH07XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmVlID0ge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlRGF0YS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBub2RlRGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGVEYXRhLmFjdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogKG5vZGVEYXRhIGFzIGFueSkuY29tcG9uZW50cyA/IChub2RlRGF0YSBhcyBhbnkpLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMuX190eXBlX18pIDogW10sXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkQ291bnQ6IG5vZGVEYXRhLmNoaWxkcmVuID8gbm9kZURhdGEuY2hpbGRyZW4ubGVuZ3RoIDogMCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdIGFzIGFueVtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuY2hpbGRyZW4gJiYgbm9kZURhdGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkSWQgb2Ygbm9kZURhdGEuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuY2hpbGRyZW4ucHVzaChhd2FpdCBidWlsZFRyZWUoY2hpbGRJZCwgZGVwdGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyZWU7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocm9vdFV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChhd2FpdCBidWlsZFRyZWUocm9vdFV1aWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGllcmFyY2h5OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1oaWVyYXJjaHknKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmVlcyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vdE5vZGUgb2YgaGllcmFyY2h5LmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyZWVzLnB1c2goYXdhaXQgYnVpbGRUcmVlKHJvb3ROb2RlLnV1aWQpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQodHJlZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGVyZm9ybWFuY2VTdGF0cygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1wZXJmb3JtYW5jZScpO1xuICAgICAgICAgICAgY29uc3QgcGVyZlN0YXRzOiBQZXJmb3JtYW5jZVN0YXRzID0ge1xuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogc3RhdHMubm9kZUNvdW50IHx8IDAsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50Q291bnQ6IHN0YXRzLmNvbXBvbmVudENvdW50IHx8IDAsXG4gICAgICAgICAgICAgICAgZHJhd0NhbGxzOiBzdGF0cy5kcmF3Q2FsbHMgfHwgMCxcbiAgICAgICAgICAgICAgICB0cmlhbmdsZXM6IHN0YXRzLnRyaWFuZ2xlcyB8fCAwLFxuICAgICAgICAgICAgICAgIG1lbW9yeTogc3RhdHMubWVtb3J5IHx8IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocGVyZlN0YXRzKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1lc3NhZ2U6ICdQZXJmb3JtYW5jZSBzdGF0cyBub3QgYXZhaWxhYmxlIGluIGVkaXQgbW9kZScgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZSB0aGUgb3BlbiBzY2VuZS5cbiAgICAgKlxuICAgICAqIEVhY2ggZW5hYmxlZCBjaGVjayBydW5zIGluIGl0cyBvd24gZmF1bHQgYm91bmRhcnkuIFByZXZpb3VzbHkgYSBzaW5nbGUgZmFpbGluZ1xuICAgICAqIGNoZWNrIGFib3J0ZWQgdGhlIHdob2xlIGFjdGlvbjogQ29jb3MgQ3JlYXRvciAzLjguNyByZWdpc3RlcnMgbm9cbiAgICAgKiBgc2NlbmU6Y2hlY2stbWlzc2luZy1hc3NldHNgIG1lc3NhZ2UsIHNvIHRoZSByZXF1ZXN0IHJlamVjdGVkIHdpdGhcbiAgICAgKiBgc2NlbmUgLSBjaGVjay1taXNzaW5nLWFzc2V0cyBkb2VzIG5vdCBleGlzdGAgYW5kIGB2YWxpZGF0ZV9zY2VuZWAgcmV0dXJuZWQgYW5cbiAgICAgKiBlcnJvciBpbnN0ZWFkIG9mIGEgcmVzdWx0ICgjMjMpLiBBbiB1bnN1cHBvcnRlZCBjaGVjayBpcyBub3cgcmVwb3J0ZWQgYXMgb25lXG4gICAgICogdW5zdXBwb3J0ZWQgY2hlY2ssIGFuZCB0aGUgbWlzc2luZy1hc3NldCBzY2FuIGZhbGxzIGJhY2sgdG8gd2Fsa2luZyB0aGUgc2NlbmUnc1xuICAgICAqIG93biBjb21wb25lbnQgZHVtcHMgZm9yIHVucmVzb2x2YWJsZSBhc3NldCBVVUlEcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlU2NlbmUob3B0aW9uczogeyBjaGVja01pc3NpbmdBc3NldHM6IGJvb2xlYW47IGNoZWNrUGVyZm9ybWFuY2U6IGJvb2xlYW4gfSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdID0gW107XG4gICAgICAgIGNvbnN0IGNoZWNrczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLmNoZWNrTWlzc2luZ0Fzc2V0cykge1xuICAgICAgICAgICAgY29uc3QgbmF0aXZlID0gYXdhaXQgdGhpcy5jaGVja01pc3NpbmdBc3NldHNOYXRpdmUoKTtcbiAgICAgICAgICAgIGlmIChuYXRpdmUuc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICAgICAgY2hlY2tzLm1pc3NpbmdBc3NldHMgPSAnbmF0aXZlJztcbiAgICAgICAgICAgICAgICBpc3N1ZXMucHVzaCguLi5uYXRpdmUuaXNzdWVzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NhbiA9IGF3YWl0IHRoaXMuc2Nhbk1pc3NpbmdBc3NldFJlZmVyZW5jZXMoKTtcbiAgICAgICAgICAgICAgICBjaGVja3MubWlzc2luZ0Fzc2V0cyA9IHNjYW4uZXJyb3IgPyBgdW5zdXBwb3J0ZWQ6ICR7c2Nhbi5lcnJvcn1gIDogJ2ZhbGxiYWNrLXNjYW4nO1xuICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKC4uLnNjYW4uaXNzdWVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNoZWNrUGVyZm9ybWFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHBlcmYgPSBhd2FpdCB0aGlzLmNoZWNrTm9kZUNvdW50KCk7XG4gICAgICAgICAgICBjaGVja3MucGVyZm9ybWFuY2UgPSBwZXJmLmVycm9yID8gYHVuc3VwcG9ydGVkOiAke3BlcmYuZXJyb3J9YCA6ICdvayc7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCguLi5wZXJmLmlzc3Vlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHQ6IFZhbGlkYXRpb25SZXN1bHQgPSB7XG4gICAgICAgICAgICB2YWxpZDogaXNzdWVzLmZpbHRlcihpID0+IGkudHlwZSA9PT0gJ2Vycm9yJykubGVuZ3RoID09PSAwLFxuICAgICAgICAgICAgaXNzdWVDb3VudDogaXNzdWVzLmxlbmd0aCxcbiAgICAgICAgICAgIGlzc3Vlc1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IC4uLnJlc3VsdCwgY2hlY2tzIH0pO1xuICAgIH1cblxuICAgIC8qKiBUcnkgdGhlIGVkaXRvcidzIG93biBtaXNzaW5nLWFzc2V0IGNoZWNrLiAzLjguNyBkb2VzIG5vdCByZWdpc3RlciBpdC4gKi9cbiAgICBwcml2YXRlIGFzeW5jIGNoZWNrTWlzc2luZ0Fzc2V0c05hdGl2ZSgpOiBQcm9taXNlPHsgc3VwcG9ydGVkOiBib29sZWFuOyBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0Q2hlY2s6IGFueSA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ2NoZWNrLW1pc3NpbmctYXNzZXRzJyk7XG4gICAgICAgICAgICBpZiAoYXNzZXRDaGVjayAmJiBBcnJheS5pc0FycmF5KGFzc2V0Q2hlY2subWlzc2luZykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdXBwb3J0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGlzc3VlczogYXNzZXRDaGVjay5taXNzaW5nLmxlbmd0aCA/IFt7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEZvdW5kICR7YXNzZXRDaGVjay5taXNzaW5nLmxlbmd0aH0gbWlzc2luZyBhc3NldCByZWZlcmVuY2VzYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IGFzc2V0Q2hlY2subWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICB9XSA6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1cHBvcnRlZDogZmFsc2UsIGlzc3VlczogW10gfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4geyBzdXBwb3J0ZWQ6IGZhbHNlLCBpc3N1ZXM6IFtdIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWZXJzaW9uLWluZGVwZW5kZW50IGZhbGxiYWNrOiB3YWxrIHRoZSBzY2VuZSdzIG5vZGUgZHVtcHMsIGNvbGxlY3QgZXZlcnkgYXNzZXRcbiAgICAgKiBVVUlEIHJlZmVyZW5jZWQgYnkgYSBjb21wb25lbnQgcHJvcGVydHksIGFuZCByZXBvcnQgdGhlIG9uZXMgdGhlIGFzc2V0IERCIGNhbm5vdFxuICAgICAqIHJlc29sdmUuIFNhbWUgYFZhbGlkYXRpb25Jc3N1ZWAgc2hhcGUgYXMgdGhlIG5hdGl2ZSBwYXRoLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2Nhbk1pc3NpbmdBc3NldFJlZmVyZW5jZXMoKTogUHJvbWlzZTx7IGlzc3VlczogVmFsaWRhdGlvbklzc3VlW107IGVycm9yPzogc3RyaW5nIH0+IHtcbiAgICAgICAgbGV0IHJvb3RVdWlkczogc3RyaW5nW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByb290VXVpZHMgPSBhd2FpdCB0aGlzLmNvbGxlY3RTY2VuZU5vZGVVdWlkcygpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNzdWVzOiBbXSwgZXJyb3I6IGBjYW5ub3QgZW51bWVyYXRlIHNjZW5lIG5vZGVzICgke2Vycj8ubWVzc2FnZSB8fCBlcnJ9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlZmVyZW5jZWRCeSA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcbiAgICAgICAgZm9yIChjb25zdCBub2RlVXVpZCBvZiByb290VXVpZHMpIHtcbiAgICAgICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG5vZGVOYW1lID0gbm9kZURhdGE/Lm5hbWU/LnZhbHVlID8/IG5vZGVEYXRhPy5uYW1lID8/IG5vZGVVdWlkO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wIG9mIChub2RlRGF0YT8uX19jb21wc19fID8/IFtdKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdXVpZCBvZiBjb2xsZWN0QXNzZXRVdWlkcyhjb21wLnZhbHVlID8/IGNvbXApKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVmZXJlbmNlZEJ5Lmhhcyh1dWlkKSkgcmVmZXJlbmNlZEJ5LnNldCh1dWlkLCBuZXcgU2V0KCkpO1xuICAgICAgICAgICAgICAgICAgICByZWZlcmVuY2VkQnkuZ2V0KHV1aWQpIS5hZGQoYCR7bm9kZU5hbWV9IOKGkiAke2NvbXBUeXBlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1pc3Npbmc6IEFycmF5PHsgdXVpZDogc3RyaW5nOyByZWZlcmVuY2VkQnk6IHN0cmluZ1tdIH0+ID0gW107XG4gICAgICAgIGZvciAoY29uc3QgW3V1aWQsIGhvbGRlcnNdIG9mIHJlZmVyZW5jZWRCeSkge1xuICAgICAgICAgICAgbGV0IGluZm86IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXVpZCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBpbmZvID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghaW5mbykgbWlzc2luZy5wdXNoKHsgdXVpZCwgcmVmZXJlbmNlZEJ5OiBbLi4uaG9sZGVyc10gfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW1pc3NpbmcubGVuZ3RoKSByZXR1cm4geyBpc3N1ZXM6IFtdIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc3N1ZXM6IFt7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEZvdW5kICR7bWlzc2luZy5sZW5ndGh9IG1pc3NpbmcgYXNzZXQgcmVmZXJlbmNlc2AsXG4gICAgICAgICAgICAgICAgZGV0YWlsczogbWlzc2luZ1xuICAgICAgICAgICAgfV1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKiogRmxhdHRlbiB0aGUgc2NlbmUgdHJlZSB0byBhIGxpc3Qgb2Ygbm9kZSBVVUlEcy4gKi9cbiAgICBwcml2YXRlIGFzeW5jIGNvbGxlY3RTY2VuZU5vZGVVdWlkcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICBjb25zdCByb290czogYW55W10gPSBBcnJheS5pc0FycmF5KHRyZWUpID8gdHJlZSA6ICh0cmVlID8gW3RyZWVdIDogW10pO1xuICAgICAgICBjb25zdCB1dWlkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBub2RlLnV1aWQgPT09ICdzdHJpbmcnKSB1dWlkcy5wdXNoKG5vZGUudXVpZCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuID8/IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHJvb3RzLmZvckVhY2god2Fsayk7XG4gICAgICAgIHJldHVybiB1dWlkcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNoZWNrTm9kZUNvdW50KCk6IFByb21pc2U8eyBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgICAgIGxldCBub2RlQ291bnQ6IG51bWJlcjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG5vZGVDb3VudCA9IChhd2FpdCB0aGlzLmNvbGxlY3RTY2VuZU5vZGVVdWlkcygpKS5sZW5ndGg7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBpc3N1ZXM6IFtdLCBlcnJvcjogYGNhbm5vdCBlbnVtZXJhdGUgc2NlbmUgbm9kZXMgKCR7ZXJyPy5tZXNzYWdlIHx8IGVycn0pYCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlQ291bnQgPD0gMTAwMCkgcmV0dXJuIHsgaXNzdWVzOiBbXSB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNzdWVzOiBbe1xuICAgICAgICAgICAgICAgIHR5cGU6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogJ3BlcmZvcm1hbmNlJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSGlnaCBub2RlIGNvdW50OiAke25vZGVDb3VudH0gbm9kZXMgKHJlY29tbWVuZGVkIDwgMTAwMClgLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb246ICdDb25zaWRlciB1c2luZyBvYmplY3QgcG9vbGluZyBvciBzY2VuZSBvcHRpbWl6YXRpb24nXG4gICAgICAgICAgICB9XVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0RWRpdG9ySW5mbygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgIGVkaXRvcjoge1xuICAgICAgICAgICAgICAgIHZlcnNpb246IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uZWRpdG9yIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBjb2Nvc1ZlcnNpb246IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uY29jb3MgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgICAgICAgICAgICAgIGFyY2g6IHByb2Nlc3MuYXJjaCxcbiAgICAgICAgICAgICAgICBub2RlVmVyc2lvbjogcHJvY2Vzcy52ZXJzaW9uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvamVjdDoge1xuICAgICAgICAgICAgICAgIG5hbWU6IEVkaXRvci5Qcm9qZWN0Lm5hbWUsXG4gICAgICAgICAgICAgICAgcGF0aDogRWRpdG9yLlByb2plY3QucGF0aCxcbiAgICAgICAgICAgICAgICB1dWlkOiBFZGl0b3IuUHJvamVjdC51dWlkXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWVtb3J5OiBwcm9jZXNzLm1lbW9yeVVzYWdlKCksXG4gICAgICAgICAgICB1cHRpbWU6IHByb2Nlc3MudXB0aW1lKClcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlc29sdmVMb2dGaWxlUGF0aCgpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBwb3NzaWJsZVBhdGhzID0gW1xuICAgICAgICAgICAgRWRpdG9yLlByb2plY3QgPyBFZGl0b3IuUHJvamVjdC5wYXRoIDogbnVsbCxcbiAgICAgICAgICAgIHByb2Nlc3MuY3dkKCksXG4gICAgICAgIF0uZmlsdGVyKChwKTogcCBpcyBzdHJpbmcgPT4gcCAhPT0gbnVsbCk7XG5cbiAgICAgICAgZm9yIChjb25zdCBiYXNlUGF0aCBvZiBwb3NzaWJsZVBhdGhzKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXN0UGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgJ3RlbXAvbG9ncy9wcm9qZWN0LmxvZycpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGVzdFBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRlc3RQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYFByb2plY3QgbG9nIGZpbGUgbm90IGZvdW5kLiBUcmllZCBwYXRoczogJHtwb3NzaWJsZVBhdGhzLm1hcChwID0+IHBhdGguam9pbihwLCAndGVtcC9sb2dzL3Byb2plY3QubG9nJykpLmpvaW4oJywgJyl9YFxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKiBSZWFkIHVwIHRvIGxhc3QgMTAwS0Igb2YgYSBsb2cgZmlsZSB0byBhdm9pZCBsb2FkaW5nIGh1Z2UgZmlsZXMgaW50byBtZW1vcnkuICovXG4gICAgcHJpdmF0ZSByZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IE1BWF9CWVRFUyA9IDEwMCAqIDEwMjQ7IC8vIDEwMEtCXG4gICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMobG9nRmlsZVBhdGgpO1xuICAgICAgICBjb25zdCBmaWxlU2l6ZSA9IHN0YXRzLnNpemU7XG4gICAgICAgIGlmIChmaWxlU2l6ZSA8PSBNQVhfQllURVMpIHtcbiAgICAgICAgICAgIHJldHVybiBmcy5yZWFkRmlsZVN5bmMobG9nRmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jKE1BWF9CWVRFUyk7XG4gICAgICAgIGNvbnN0IGZkID0gZnMub3BlblN5bmMobG9nRmlsZVBhdGgsICdyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy5yZWFkU3luYyhmZCwgYnVmZmVyLCAwLCBNQVhfQllURVMsIGZpbGVTaXplIC0gTUFYX0JZVEVTKTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIGZzLmNsb3NlU3luYyhmZCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2tpcCB0aGUgZmlyc3QgKHBvc3NpYmx5IHBhcnRpYWwpIGxpbmVcbiAgICAgICAgY29uc3QgcmF3ID0gYnVmZmVyLnRvU3RyaW5nKCd1dGY4Jyk7XG4gICAgICAgIGNvbnN0IG5ld2xpbmVJZHggPSByYXcuaW5kZXhPZignXFxuJyk7XG4gICAgICAgIHJldHVybiBuZXdsaW5lSWR4ID49IDAgPyByYXcuc2xpY2UobmV3bGluZUlkeCArIDEpIDogcmF3O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJvamVjdExvZ3MobGluZXM6IG51bWJlciwgZmlsdGVyS2V5d29yZD86IHN0cmluZywgbG9nTGV2ZWw6IHN0cmluZyA9ICdBTEwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUxvZ0ZpbGVQYXRoKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvZ0NvbnRlbnQgPSB0aGlzLnJlYWRMb2dGaWxlVGFpbChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICBjb25zdCBsb2dMaW5lcyA9IGxvZ0NvbnRlbnQuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUudHJpbSgpICE9PSAnJyk7XG5cbiAgICAgICAgICAgIC8vIEdldCB0aGUgbGFzdCBOIGxpbmVzXG4gICAgICAgICAgICBjb25zdCByZWNlbnRMaW5lcyA9IGxvZ0xpbmVzLnNsaWNlKC1saW5lcyk7XG5cbiAgICAgICAgICAgIC8vIEFwcGx5IGZpbHRlcnNcbiAgICAgICAgICAgIGxldCBmaWx0ZXJlZExpbmVzID0gcmVjZW50TGluZXM7XG5cbiAgICAgICAgICAgIGlmIChsb2dMZXZlbCAhPT0gJ0FMTCcpIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJlZExpbmVzID0gZmlsdGVyZWRMaW5lcy5maWx0ZXIobGluZSA9PlxuICAgICAgICAgICAgICAgICAgICBsaW5lLmluY2x1ZGVzKGBbJHtsb2dMZXZlbH1dYCkgfHwgbGluZS5pbmNsdWRlcyhsb2dMZXZlbC50b0xvd2VyQ2FzZSgpKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmaWx0ZXJLZXl3b3JkKSB7XG4gICAgICAgICAgICAgICAgZmlsdGVyZWRMaW5lcyA9IGZpbHRlcmVkTGluZXMuZmlsdGVyKGxpbmUgPT5cbiAgICAgICAgICAgICAgICAgICAgbGluZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGZpbHRlcktleXdvcmQudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgdG90YWxMaW5lczogbG9nTGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHJlcXVlc3RlZExpbmVzOiBsaW5lcyxcbiAgICAgICAgICAgICAgICBmaWx0ZXJlZExpbmVzOiBmaWx0ZXJlZExpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBsb2dMZXZlbDogbG9nTGV2ZWwsXG4gICAgICAgICAgICAgICAgZmlsdGVyS2V5d29yZDogZmlsdGVyS2V5d29yZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGxvZ3M6IGZpbHRlcmVkTGluZXMsXG4gICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGxvZ0ZpbGVQYXRoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVhZCBwcm9qZWN0IGxvZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TG9nRmlsZUluZm8oKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUxvZ0ZpbGVQYXRoKCk7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgICAgIC8vIENvdW50IGxpbmVzIHVzaW5nIHRhaWwgcmVhZCB0byBhdm9pZCBsb2FkaW5nIGh1Z2UgZmlsZXNcbiAgICAgICAgICAgIGNvbnN0IHRhaWxDb250ZW50ID0gdGhpcy5yZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgbGluZUNvdW50ID0gdGFpbENvbnRlbnQuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUudHJpbSgpICE9PSAnJykubGVuZ3RoO1xuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgZmlsZVBhdGg6IGxvZ0ZpbGVQYXRoLFxuICAgICAgICAgICAgICAgIGZpbGVTaXplOiBzdGF0cy5zaXplLFxuICAgICAgICAgICAgICAgIGZpbGVTaXplRm9ybWF0dGVkOiB0aGlzLmZvcm1hdEZpbGVTaXplKHN0YXRzLnNpemUpLFxuICAgICAgICAgICAgICAgIGxhc3RNb2RpZmllZDogc3RhdHMubXRpbWUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBsaW5lQ291bnQsXG4gICAgICAgICAgICAgICAgY3JlYXRlZDogc3RhdHMuYmlydGh0aW1lLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgYWNjZXNzaWJsZTogZnMuY29uc3RhbnRzLlJfT0ssXG4gICAgICAgICAgICAgICAgbm90ZTogc3RhdHMuc2l6ZSA+IDEwMjQwMCA/ICdGaWxlIGlzIGxhcmdlOyBvbmx5IGxhc3QgMTAwS0IgaXMgcmVhZC4nIDogdW5kZWZpbmVkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGxvZyBmaWxlIGluZm86ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2VhcmNoUHJvamVjdExvZ3MocGF0dGVybjogc3RyaW5nLCBtYXhSZXN1bHRzOiBudW1iZXIsIGNvbnRleHRMaW5lczogbnVtYmVyKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUxvZ0ZpbGVQYXRoKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvZ0NvbnRlbnQgPSB0aGlzLnJlYWRMb2dGaWxlVGFpbChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICBjb25zdCBsb2dMaW5lcyA9IGxvZ0NvbnRlbnQuc3BsaXQoJ1xcbicpO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgcmVnZXggcGF0dGVybiAoc3VwcG9ydCBib3RoIHN0cmluZyBhbmQgcmVnZXggcGF0dGVybnMpXG4gICAgICAgICAgICBsZXQgcmVnZXg6IFJlZ0V4cDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4sICdnaScpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gSWYgcGF0dGVybiBpcyBub3QgdmFsaWQgcmVnZXgsIHRyZWF0IGFzIGxpdGVyYWwgc3RyaW5nXG4gICAgICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4ucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKSwgJ2dpJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBsZXQgcmVzdWx0Q291bnQgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxvZ0xpbmVzLmxlbmd0aCAmJiByZXN1bHRDb3VudCA8IG1heFJlc3VsdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsb2dMaW5lc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAocmVnZXgudGVzdChsaW5lKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0U3RhcnQgPSBNYXRoLm1heCgwLCBpIC0gY29udGV4dExpbmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGV4dEVuZCA9IE1hdGgubWluKGxvZ0xpbmVzLmxlbmd0aCAtIDEsIGkgKyBjb250ZXh0TGluZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRleHRMaW5lc0FycmF5ID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSBjb250ZXh0U3RhcnQ7IGogPD0gY29udGV4dEVuZDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0TGluZXNBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBqICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBsb2dMaW5lc1tqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc01hdGNoOiBqID09PSBpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBpICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRMaW5lOiBsaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dDogY29udGV4dExpbmVzQXJyYXlcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0Q291bnQrKztcblxuICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCByZWdleCBsYXN0SW5kZXggZm9yIGdsb2JhbCBzZWFyY2hcbiAgICAgICAgICAgICAgICAgICAgcmVnZXgubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgICAgICAgIHRvdGFsTWF0Y2hlczogbWF0Y2hlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgbWF4UmVzdWx0czogbWF4UmVzdWx0cyxcbiAgICAgICAgICAgICAgICBjb250ZXh0TGluZXM6IGNvbnRleHRMaW5lcyxcbiAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDogbG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWF0Y2hlczogbWF0Y2hlc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHNlYXJjaCBwcm9qZWN0IGxvZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZm9ybWF0RmlsZVNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHVuaXRzID0gWydCJywgJ0tCJywgJ01CJywgJ0dCJ107XG4gICAgICAgIGxldCBzaXplID0gYnl0ZXM7XG4gICAgICAgIGxldCB1bml0SW5kZXggPSAwO1xuXG4gICAgICAgIHdoaWxlIChzaXplID49IDEwMjQgJiYgdW5pdEluZGV4IDwgdW5pdHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgc2l6ZSAvPSAxMDI0O1xuICAgICAgICAgICAgdW5pdEluZGV4Kys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYCR7c2l6ZS50b0ZpeGVkKDIpfSAke3VuaXRzW3VuaXRJbmRleF19YDtcbiAgICB9XG59XG4iXX0=