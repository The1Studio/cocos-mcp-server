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
        const validationError = this.validateScript(script);
        if (validationError)
            return (0, types_1.errorResult)(validationError);
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'console',
                method: 'eval',
                args: [script]
            });
            return (0, types_1.successResult)({
                result,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWRlYnVnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1kZWJ1Zy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLGtEQUEyRDtBQUUzRCxvREFBd0Q7QUFDeEQsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUU3QixNQUFhLFdBQVksU0FBUSxpQ0FBYztJQXFHM0M7UUFDSSxLQUFLLEVBQUUsQ0FBQztRQXJHSCxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsa1VBQWtVLENBQUM7UUFDalYsWUFBTyxHQUFHO1lBQ2Ysa0JBQWtCO1lBQ2xCLGVBQWU7WUFDZixnQkFBZ0I7WUFDaEIsZUFBZTtZQUNmLHVCQUF1QjtZQUN2QixnQkFBZ0I7WUFDaEIsaUJBQWlCO1lBQ2pCLGtCQUFrQjtZQUNsQixtQkFBbUI7WUFDbkIscUJBQXFCO1NBQ3hCLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsc0RBQXNEO29CQUNuRSxPQUFPLEVBQUUsR0FBRztpQkFDZjtnQkFDRCxNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdDQUF3QztvQkFDckQsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQztvQkFDN0MsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dCQUNELE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsNkNBQTZDO2lCQUM3RDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDRFQUE0RTtpQkFDNUY7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvQ0FBb0M7b0JBQ2pELE9BQU8sRUFBRSxFQUFFO2lCQUNkO2dCQUNELGtCQUFrQixFQUFFO29CQUNoQixJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVBQUUscURBQXFEO29CQUNsRSxPQUFPLEVBQUUsSUFBSTtpQkFDaEI7Z0JBQ0QsZ0JBQWdCLEVBQUU7b0JBQ2QsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsV0FBVyxFQUFFLCtDQUErQztvQkFDNUQsT0FBTyxFQUFFLElBQUk7aUJBQ2hCO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUseUVBQXlFO29CQUN0RixPQUFPLEVBQUUsR0FBRztvQkFDWixPQUFPLEVBQUUsQ0FBQztvQkFDVixPQUFPLEVBQUUsS0FBSztpQkFDakI7Z0JBQ0QsYUFBYSxFQUFFO29CQUNYLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx1RUFBdUU7aUJBQ3ZGO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsd0NBQXdDO29CQUNyRCxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssQ0FBQztvQkFDeEQsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsdURBQXVEO2lCQUN2RTtnQkFDRCxVQUFVLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDBEQUEwRDtvQkFDdkUsT0FBTyxFQUFFLEVBQUU7b0JBQ1gsT0FBTyxFQUFFLENBQUM7b0JBQ1YsT0FBTyxFQUFFLEdBQUc7aUJBQ2Y7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx5RUFBeUU7b0JBQ3RGLE9BQU8sRUFBRSxDQUFDO29CQUNWLE9BQU8sRUFBRSxDQUFDO29CQUNWLE9BQU8sRUFBRSxFQUFFO2lCQUNkO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVGLGtDQUFrQztRQUMxQixvQkFBZSxHQUFxQixFQUFFLENBQUM7UUFDOUIsZ0JBQVcsR0FBRyxJQUFJLENBQUM7UUEwQjFCLG1CQUFjLEdBQTZFO1lBQ2pHLGdCQUFnQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7O2dCQUFDLE9BQUEsSUFBSSxDQUFDLGNBQWMsQ0FDM0MsTUFBQSxJQUFBLHFCQUFTLEVBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBSSxHQUFHLEVBQzVCLE1BQUEsSUFBSSxDQUFDLE1BQU0sbUNBQUksS0FBSyxDQUN2QixDQUFBO2FBQUE7WUFDRCxhQUFhLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDN0MsY0FBYyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDekQsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7O2dCQUFDLE9BQUEsSUFBSSxDQUFDLFdBQVcsQ0FDckMsSUFBSSxDQUFDLFFBQVEsRUFDYixNQUFBLElBQUEscUJBQVMsRUFBQyxJQUFJLENBQUMsUUFBUSxDQUFDLG1DQUFJLEVBQUUsQ0FDakMsQ0FBQTthQUFBO1lBQ0QscUJBQXFCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtZQUM1RCxjQUFjLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRTs7Z0JBQUMsT0FBQSxJQUFJLENBQUMsYUFBYSxDQUFDO29CQUN6QyxrQkFBa0IsRUFBRSxNQUFBLElBQUEsc0JBQVUsRUFBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsbUNBQUksSUFBSTtvQkFDL0QsZ0JBQWdCLEVBQUUsTUFBQSxJQUFBLHNCQUFVLEVBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLG1DQUFJLElBQUk7aUJBQzlELENBQUMsQ0FBQTthQUFBO1lBQ0YsZUFBZSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ2hELGdCQUFnQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7O2dCQUFDLE9BQUEsSUFBSSxDQUFDLGNBQWMsQ0FDM0MsTUFBQSxJQUFBLHFCQUFTLEVBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBSSxHQUFHLEVBQzVCLElBQUksQ0FBQyxhQUFhLEVBQ2xCLE1BQUEsSUFBSSxDQUFDLFFBQVEsbUNBQUksS0FBSyxDQUN6QixDQUFBO2FBQUE7WUFDRCxpQkFBaUIsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUNuRCxtQkFBbUIsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFOztnQkFBQyxPQUFBLElBQUksQ0FBQyxpQkFBaUIsQ0FDakQsSUFBSSxDQUFDLE9BQU8sRUFDWixNQUFBLElBQUEscUJBQVMsRUFBQyxJQUFJLENBQUMsVUFBVSxDQUFDLG1DQUFJLEVBQUUsRUFDaEMsTUFBQSxJQUFBLHFCQUFTLEVBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQ0FBSSxDQUFDLENBQ3BDLENBQUE7YUFBQTtTQUNKLENBQUM7UUFsREUsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7SUFDL0IsQ0FBQztJQUVPLG1CQUFtQjtRQUN2QixvQ0FBb0M7UUFDcEMsaUZBQWlGO1FBQ2pGLDJEQUEyRDtRQUMzRCxPQUFPLENBQUMsR0FBRyxDQUFDLDJFQUEyRSxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVPLGlCQUFpQixDQUFDLE9BQVk7UUFDbEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLGlCQUNyQixTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsSUFDaEMsT0FBTyxFQUNaLENBQUM7UUFFSCw0QkFBNEI7UUFDNUIsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDakQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNqQyxDQUFDO0lBQ0wsQ0FBQztJQWdDTyxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQWEsRUFBRSxNQUFjO1FBQ3RELElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUM7UUFFaEMsSUFBSSxNQUFNLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDbkIsSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFdEMsT0FBTyxJQUFBLHFCQUFhLEVBQUM7WUFDakIsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ2xCLFFBQVEsRUFBRSxVQUFVLENBQUMsTUFBTTtZQUMzQixJQUFJLEVBQUUsVUFBVTtTQUNuQixDQUFDLENBQUM7SUFDUCxDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVk7UUFDdEIsSUFBSSxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUM7UUFFMUIsSUFBSSxDQUFDO1lBQ0QscUVBQXFFO1lBQ3JFLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN4QyxPQUFPLElBQUEscUJBQWEsRUFBQyxJQUFJLEVBQUUsOEJBQThCLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNMLENBQUM7SUFFTyxjQUFjLENBQUMsTUFBYztRQUNqQyxJQUFJLENBQUMsTUFBTSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVE7WUFBRSxPQUFPLG9CQUFvQixDQUFDO1FBQ3ZFLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxLQUFLO1lBQUUsT0FBTyx1Q0FBdUMsQ0FBQztRQUMxRSxNQUFNLFNBQVMsR0FBRztZQUNkLDBCQUEwQjtZQUMxQiwwQkFBMEI7WUFDMUIsY0FBYztZQUNkLE9BQU87WUFDUCxXQUFXO1NBQ2QsQ0FBQztRQUNGLEtBQUssTUFBTSxPQUFPLElBQUksU0FBUyxFQUFFLENBQUM7WUFDOUIsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQzNCLE9BQU8sdUNBQXVDLE9BQU8sRUFBRSxDQUFDO1lBQzVELENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBYztRQUN0QyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3BELElBQUksZUFBZTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO2dCQUN6RSxJQUFJLEVBQUUsU0FBUztnQkFDZixNQUFNLEVBQUUsTUFBTTtnQkFDZCxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDakIsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLE1BQU07Z0JBQ04sT0FBTyxFQUFFLDhCQUE4QjtnQkFDdkMsT0FBTyxFQUFFLHNGQUFzRjthQUNsRyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxRQUFpQixFQUFFLFdBQW1CLEVBQUU7UUFDOUQsTUFBTSxTQUFTLEdBQUcsS0FBSyxFQUFFLFFBQWdCLEVBQUUsUUFBZ0IsQ0FBQyxFQUFnQixFQUFFO1lBQzFFLElBQUksS0FBSyxJQUFJLFFBQVE7Z0JBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUNsRCxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUMvRSxNQUFNLElBQUksR0FBRztvQkFDVCxJQUFJLEVBQUUsUUFBUSxDQUFDLElBQUk7b0JBQ25CLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSTtvQkFDbkIsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNO29CQUN2QixVQUFVLEVBQUcsUUFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFFLFFBQWdCLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO29CQUN4RyxVQUFVLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzVELFFBQVEsRUFBRSxFQUFXO2lCQUN4QixDQUFDO2dCQUNGLElBQUksUUFBUSxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDcEQsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7d0JBQ3RDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sU0FBUyxDQUFDLE9BQU8sRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDNUQsQ0FBQztnQkFDTCxDQUFDO2dCQUNELE9BQU8sSUFBSSxDQUFDO1lBQ2hCLENBQUM7WUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO2dCQUNoQixPQUFPLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNsQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO1FBRUYsSUFBSSxDQUFDO1lBQ0QsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDWCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1lBQ3BELENBQUM7aUJBQU0sQ0FBQztnQkFDSixNQUFNLFNBQVMsR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO2dCQUNoRixNQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7Z0JBQ2pCLEtBQUssTUFBTSxRQUFRLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUN4QyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxDQUFDO2dCQUNELE9BQU8sSUFBQSxxQkFBYSxFQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2hDLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLG1CQUFtQjtRQUM3QixJQUFJLENBQUM7WUFDRCxNQUFNLEtBQUssR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1lBQzlFLE1BQU0sU0FBUyxHQUFxQjtnQkFDaEMsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQztnQkFDL0IsY0FBYyxFQUFFLEtBQUssQ0FBQyxjQUFjLElBQUksQ0FBQztnQkFDekMsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQztnQkFDL0IsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQztnQkFDL0IsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLElBQUksRUFBRTthQUM3QixDQUFDO1lBQ0YsT0FBTyxJQUFBLHFCQUFhLEVBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNMLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsT0FBTyxFQUFFLDhDQUE4QyxFQUFFLENBQUMsQ0FBQztRQUN0RixDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7Ozs7O09BVUc7SUFDSyxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQW1FO1FBQzNGLE1BQU0sTUFBTSxHQUFzQixFQUFFLENBQUM7UUFDckMsTUFBTSxNQUFNLEdBQTJCLEVBQUUsQ0FBQztRQUUxQyxJQUFJLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzdCLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDckQsSUFBSSxNQUFNLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ25CLE1BQU0sQ0FBQyxhQUFhLEdBQUcsUUFBUSxDQUFDO2dCQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2xDLENBQUM7aUJBQU0sQ0FBQztnQkFDSixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsRUFBRSxDQUFDO2dCQUNyRCxNQUFNLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztnQkFDbkYsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNoQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksT0FBTyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDM0IsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDekMsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDdEUsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoQyxDQUFDO1FBRUQsTUFBTSxNQUFNLEdBQXFCO1lBQzdCLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUMxRCxVQUFVLEVBQUUsTUFBTSxDQUFDLE1BQU07WUFDekIsTUFBTTtTQUNULENBQUM7UUFDRixPQUFPLElBQUEscUJBQWEsa0NBQU0sTUFBTSxLQUFFLE1BQU0sSUFBRyxDQUFDO0lBQ2hELENBQUM7SUFFRCw0RUFBNEU7SUFDcEUsS0FBSyxDQUFDLHdCQUF3QjtRQUNsQyxJQUFJLENBQUM7WUFDRCxNQUFNLFVBQVUsR0FBUSxNQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBZSxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1lBQy9GLElBQUksVUFBVSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7Z0JBQ2xELE9BQU87b0JBQ0gsU0FBUyxFQUFFLElBQUk7b0JBQ2YsTUFBTSxFQUFFLFVBQVUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDOzRCQUNqQyxJQUFJLEVBQUUsT0FBTzs0QkFDYixRQUFRLEVBQUUsUUFBUTs0QkFDbEIsT0FBTyxFQUFFLFNBQVMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxNQUFNLDJCQUEyQjs0QkFDdEUsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO3lCQUM5QixDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7aUJBQ1YsQ0FBQztZQUNOLENBQUM7WUFDRCxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFDNUMsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNMLE9BQU8sRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUM1QyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSyxLQUFLLENBQUMsMEJBQTBCOztRQUNwQyxJQUFJLFNBQW1CLENBQUM7UUFDeEIsSUFBSSxDQUFDO1lBQ0QsU0FBUyxHQUFHLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDbkQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLGlDQUFpQyxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxPQUFPLEtBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztRQUMxRixDQUFDO1FBRUQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7UUFDcEQsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUMvQixJQUFJLFFBQWEsQ0FBQztZQUNsQixJQUFJLENBQUM7Z0JBQ0QsUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUM3RSxDQUFDO1lBQUMsV0FBTSxDQUFDO2dCQUNMLFNBQVM7WUFDYixDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQUcsTUFBQSxNQUFBLE1BQUEsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLElBQUksMENBQUUsS0FBSyxtQ0FBSSxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUUsSUFBSSxtQ0FBSSxRQUFRLENBQUM7WUFDckUsS0FBSyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQUEsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLFNBQVMsbUNBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDN0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO2dCQUNyRSxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUEsOEJBQWlCLEVBQUMsTUFBQSxJQUFJLENBQUMsS0FBSyxtQ0FBSSxJQUFJLENBQUMsRUFBRSxDQUFDO29CQUN2RCxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7d0JBQUUsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO29CQUMvRCxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFFBQVEsTUFBTSxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUM3RCxDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBb0QsRUFBRSxDQUFDO1FBQ3BFLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUN6QyxJQUFJLElBQUksR0FBUSxJQUFJLENBQUM7WUFDckIsSUFBSSxDQUFDO2dCQUNELElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM5RSxDQUFDO1lBQUMsV0FBTSxDQUFDO2dCQUNMLElBQUksR0FBRyxJQUFJLENBQUM7WUFDaEIsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJO2dCQUFFLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUVELElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTTtZQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRSxFQUFFLENBQUM7UUFDM0MsT0FBTztZQUNILE1BQU0sRUFBRSxDQUFDO29CQUNMLElBQUksRUFBRSxPQUFPO29CQUNiLFFBQVEsRUFBRSxRQUFRO29CQUNsQixPQUFPLEVBQUUsU0FBUyxPQUFPLENBQUMsTUFBTSwyQkFBMkI7b0JBQzNELE9BQU8sRUFBRSxPQUFPO2lCQUNuQixDQUFDO1NBQ0wsQ0FBQztJQUNOLENBQUM7SUFFRCxzREFBc0Q7SUFDOUMsS0FBSyxDQUFDLHFCQUFxQjtRQUMvQixNQUFNLElBQUksR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQzNFLE1BQU0sS0FBSyxHQUFVLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZFLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQztRQUMzQixNQUFNLElBQUksR0FBRyxDQUFDLElBQVMsRUFBRSxFQUFFOztZQUN2QixJQUFJLENBQUMsSUFBSTtnQkFBRSxPQUFPO1lBQ2xCLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVE7Z0JBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDekQsS0FBSyxNQUFNLEtBQUssSUFBSSxDQUFDLE1BQUEsSUFBSSxDQUFDLFFBQVEsbUNBQUksRUFBRSxDQUFDO2dCQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMzRCxDQUFDLENBQUM7UUFDRixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3BCLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFFTyxLQUFLLENBQUMsY0FBYztRQUN4QixJQUFJLFNBQWlCLENBQUM7UUFDdEIsSUFBSSxDQUFDO1lBQ0QsU0FBUyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUM1RCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsaUNBQWlDLENBQUEsR0FBRyxhQUFILEdBQUcsdUJBQUgsR0FBRyxDQUFFLE9BQU8sS0FBSSxHQUFHLEdBQUcsRUFBRSxDQUFDO1FBQzFGLENBQUM7UUFDRCxJQUFJLFNBQVMsSUFBSSxJQUFJO1lBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUM3QyxPQUFPO1lBQ0gsTUFBTSxFQUFFLENBQUM7b0JBQ0wsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsUUFBUSxFQUFFLGFBQWE7b0JBQ3ZCLE9BQU8sRUFBRSxvQkFBb0IsU0FBUyw2QkFBNkI7b0JBQ25FLFVBQVUsRUFBRSxxREFBcUQ7aUJBQ3BFLENBQUM7U0FDTCxDQUFDO0lBQ04sQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhOztRQUN2QixNQUFNLElBQUksR0FBRztZQUNULE1BQU0sRUFBRTtnQkFDSixPQUFPLEVBQUUsQ0FBQSxNQUFDLE1BQWMsQ0FBQyxRQUFRLDBDQUFFLE1BQU0sS0FBSSxTQUFTO2dCQUN0RCxZQUFZLEVBQUUsQ0FBQSxNQUFDLE1BQWMsQ0FBQyxRQUFRLDBDQUFFLEtBQUssS0FBSSxTQUFTO2dCQUMxRCxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7Z0JBQzFCLElBQUksRUFBRSxPQUFPLENBQUMsSUFBSTtnQkFDbEIsV0FBVyxFQUFFLE9BQU8sQ0FBQyxPQUFPO2FBQy9CO1lBQ0QsT0FBTyxFQUFFO2dCQUNMLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUk7Z0JBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUk7Z0JBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUk7YUFDNUI7WUFDRCxNQUFNLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRTtZQUM3QixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU0sRUFBRTtTQUMzQixDQUFDO1FBRUYsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVPLGtCQUFrQjtRQUN0QixNQUFNLGFBQWEsR0FBRztZQUNsQixNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTtZQUMzQyxPQUFPLENBQUMsR0FBRyxFQUFFO1NBQ2hCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFlLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7UUFFekMsS0FBSyxNQUFNLFFBQVEsSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1lBQzlELElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUMxQixPQUFPLFFBQVEsQ0FBQztZQUNwQixDQUFDO1FBQ0wsQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQ1gsNENBQTRDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQ3pILENBQUM7SUFDTixDQUFDO0lBRUQsbUZBQW1GO0lBQzNFLGVBQWUsQ0FBQyxXQUFtQjtRQUN2QyxNQUFNLFNBQVMsR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUMsUUFBUTtRQUN0QyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDNUIsSUFBSSxRQUFRLElBQUksU0FBUyxFQUFFLENBQUM7WUFDeEIsT0FBTyxFQUFFLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNoRCxDQUFDO1FBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN2QyxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUM7WUFDRCxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRSxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUM7UUFDaEUsQ0FBQztnQkFBUyxDQUFDO1lBQ1AsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNyQixDQUFDO1FBQ0QseUNBQXlDO1FBQ3pDLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDcEMsTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxPQUFPLFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDN0QsQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBYSxFQUFFLGFBQXNCLEVBQUUsV0FBbUIsS0FBSztRQUN4RixJQUFJLENBQUM7WUFDRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUU5QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3JELE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBRTNFLHVCQUF1QjtZQUN2QixNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7WUFFM0MsZ0JBQWdCO1lBQ2hCLElBQUksYUFBYSxHQUFHLFdBQVcsQ0FBQztZQUVoQyxJQUFJLFFBQVEsS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDckIsYUFBYSxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDeEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFFBQVEsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FDMUUsQ0FBQztZQUNOLENBQUM7WUFFRCxJQUFJLGFBQWEsRUFBRSxDQUFDO2dCQUNoQixhQUFhLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUN4QyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUMzRCxDQUFDO1lBQ04sQ0FBQztZQUVELE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixVQUFVLEVBQUUsUUFBUSxDQUFDLE1BQU07Z0JBQzNCLGNBQWMsRUFBRSxLQUFLO2dCQUNyQixhQUFhLEVBQUUsYUFBYSxDQUFDLE1BQU07Z0JBQ25DLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixhQUFhLEVBQUUsYUFBYSxJQUFJLElBQUk7Z0JBQ3BDLElBQUksRUFBRSxhQUFhO2dCQUNuQixXQUFXLEVBQUUsV0FBVzthQUMzQixDQUFDLENBQUM7UUFDUCxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLElBQUEsbUJBQVcsRUFBQyxnQ0FBZ0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDeEUsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsY0FBYztRQUN4QixJQUFJLENBQUM7WUFDRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUM5QyxNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3ZDLDBEQUEwRDtZQUMxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUVwRixPQUFPLElBQUEscUJBQWEsRUFBQztnQkFDakIsUUFBUSxFQUFFLFdBQVc7Z0JBQ3JCLFFBQVEsRUFBRSxLQUFLLENBQUMsSUFBSTtnQkFDcEIsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUNsRCxZQUFZLEVBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUU7Z0JBQ3ZDLFNBQVM7Z0JBQ1QsT0FBTyxFQUFFLEtBQUssQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFO2dCQUN0QyxVQUFVLEVBQUUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJO2dCQUM3QixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLHlDQUF5QyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQ3BGLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGdDQUFnQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxPQUFlLEVBQUUsVUFBa0IsRUFBRSxZQUFvQjtRQUNyRixJQUFJLENBQUM7WUFDRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUU5QyxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3JELE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFeEMsZ0VBQWdFO1lBQ2hFLElBQUksS0FBYSxDQUFDO1lBQ2xCLElBQUksQ0FBQztnQkFDRCxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3RDLENBQUM7WUFBQyxXQUFNLENBQUM7Z0JBQ0wseURBQXlEO2dCQUN6RCxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM3RSxDQUFDO1lBRUQsTUFBTSxPQUFPLEdBQVUsRUFBRSxDQUFDO1lBQzFCLElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztZQUVwQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sSUFBSSxXQUFXLEdBQUcsVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ25FLE1BQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekIsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ25CLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQztvQkFDbkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUM7b0JBRW5FLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDO29CQUM3QixLQUFLLElBQUksQ0FBQyxHQUFHLFlBQVksRUFBRSxDQUFDLElBQUksVUFBVSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7d0JBQzlDLGlCQUFpQixDQUFDLElBQUksQ0FBQzs0QkFDbkIsVUFBVSxFQUFFLENBQUMsR0FBRyxDQUFDOzRCQUNqQixPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQzs0QkFDcEIsT0FBTyxFQUFFLENBQUMsS0FBSyxDQUFDO3lCQUNuQixDQUFDLENBQUM7b0JBQ1AsQ0FBQztvQkFFRCxPQUFPLENBQUMsSUFBSSxDQUFDO3dCQUNULFVBQVUsRUFBRSxDQUFDLEdBQUcsQ0FBQzt3QkFDakIsV0FBVyxFQUFFLElBQUk7d0JBQ2pCLE9BQU8sRUFBRSxpQkFBaUI7cUJBQzdCLENBQUMsQ0FBQztvQkFFSCxXQUFXLEVBQUUsQ0FBQztvQkFFZCwwQ0FBMEM7b0JBQzFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO2dCQUN4QixDQUFDO1lBQ0wsQ0FBQztZQUVELE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixPQUFPLEVBQUUsT0FBTztnQkFDaEIsWUFBWSxFQUFFLE9BQU8sQ0FBQyxNQUFNO2dCQUM1QixVQUFVLEVBQUUsVUFBVTtnQkFDdEIsWUFBWSxFQUFFLFlBQVk7Z0JBQzFCLFdBQVcsRUFBRSxXQUFXO2dCQUN4QixPQUFPLEVBQUUsT0FBTzthQUNuQixDQUFDLENBQUM7UUFDUCxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLElBQUEsbUJBQVcsRUFBQyxrQ0FBa0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDMUUsQ0FBQztJQUNMLENBQUM7SUFFTyxjQUFjLENBQUMsS0FBYTtRQUNoQyxNQUFNLEtBQUssR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3RDLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQztRQUNqQixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFFbEIsT0FBTyxJQUFJLElBQUksSUFBSSxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2xELElBQUksSUFBSSxJQUFJLENBQUM7WUFDYixTQUFTLEVBQUUsQ0FBQztRQUNoQixDQUFDO1FBRUQsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7SUFDcEQsQ0FBQztDQUNKO0FBem1CRCxrQ0F5bUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBjb2VyY2VCb29sLCBjb2VyY2VJbnQgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgQ29uc29sZU1lc3NhZ2UsIFBlcmZvcm1hbmNlU3RhdHMsIFZhbGlkYXRpb25SZXN1bHQsIFZhbGlkYXRpb25Jc3N1ZSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvbGxlY3RBc3NldFV1aWRzIH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcmVmcyc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlRGVidWcgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfZGVidWcnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ0RlYnVnIGFuZCBpbnNwZWN0IHRoZSBlZGl0b3IgZW52aXJvbm1lbnQuIEFjdGlvbnM6IGdldF9jb25zb2xlX2xvZ3MsIGNsZWFyX2NvbnNvbGUsIGV4ZWN1dGVfc2NyaXB0LCBnZXRfbm9kZV90cmVlLCBnZXRfcGVyZm9ybWFuY2Vfc3RhdHMsIHZhbGlkYXRlX3NjZW5lLCBnZXRfZWRpdG9yX2luZm8sIGdldF9wcm9qZWN0X2xvZ3MsIGdldF9sb2dfZmlsZV9pbmZvLCBzZWFyY2hfcHJvamVjdF9sb2dzLiBVc2UgZ2V0X2VkaXRvcl9pbmZvIGZvciBlbnZpcm9ubWVudCBkZXRhaWxzLiBVc2UgZXhlY3V0ZV9zY3JpcHQgdG8gcnVuIEpTIGluIHNjZW5lIGNvbnRleHQuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xuICAgICAgICAnZ2V0X2NvbnNvbGVfbG9ncycsXG4gICAgICAgICdjbGVhcl9jb25zb2xlJyxcbiAgICAgICAgJ2V4ZWN1dGVfc2NyaXB0JyxcbiAgICAgICAgJ2dldF9ub2RlX3RyZWUnLFxuICAgICAgICAnZ2V0X3BlcmZvcm1hbmNlX3N0YXRzJyxcbiAgICAgICAgJ3ZhbGlkYXRlX3NjZW5lJyxcbiAgICAgICAgJ2dldF9lZGl0b3JfaW5mbycsXG4gICAgICAgICdnZXRfcHJvamVjdF9sb2dzJyxcbiAgICAgICAgJ2dldF9sb2dfZmlsZV9pbmZvJyxcbiAgICAgICAgJ3NlYXJjaF9wcm9qZWN0X2xvZ3MnLFxuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsaW1pdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9jb25zb2xlX2xvZ3NdIE51bWJlciBvZiByZWNlbnQgbG9ncyB0byByZXRyaWV2ZScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMTAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZpbHRlcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9jb25zb2xlX2xvZ3NdIEZpbHRlciBsb2dzIGJ5IHR5cGUnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWxsJywgJ2xvZycsICd3YXJuJywgJ2Vycm9yJywgJ2luZm8nXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY3JpcHQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tleGVjdXRlX3NjcmlwdF0gSmF2YVNjcmlwdCBjb2RlIHRvIGV4ZWN1dGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJvb3RVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X25vZGVfdHJlZV0gUm9vdCBub2RlIFVVSUQgKG9wdGlvbmFsLCB1c2VzIHNjZW5lIHJvb3QgaWYgbm90IHByb3ZpZGVkKScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWF4RGVwdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfbm9kZV90cmVlXSBNYXhpbXVtIHRyZWUgZGVwdGgnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDEwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNoZWNrTWlzc2luZ0Fzc2V0czoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1t2YWxpZGF0ZV9zY2VuZV0gQ2hlY2sgZm9yIG1pc3NpbmcgYXNzZXQgcmVmZXJlbmNlcycsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjaGVja1BlcmZvcm1hbmNlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3ZhbGlkYXRlX3NjZW5lXSBDaGVjayBmb3IgcGVyZm9ybWFuY2UgaXNzdWVzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxpbmVzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X3Byb2plY3RfbG9nc10gTnVtYmVyIG9mIGxpbmVzIHRvIHJlYWQgZnJvbSB0aGUgZW5kIG9mIHRoZSBsb2cgZmlsZScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMTAwLFxuICAgICAgICAgICAgICAgIG1pbmltdW06IDEsXG4gICAgICAgICAgICAgICAgbWF4aW11bTogMTAwMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmlsdGVyS2V5d29yZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9wcm9qZWN0X2xvZ3NdIEZpbHRlciBsb2dzIGNvbnRhaW5pbmcgc3BlY2lmaWMga2V5d29yZCAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsb2dMZXZlbDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9wcm9qZWN0X2xvZ3NdIEZpbHRlciBieSBsb2cgbGV2ZWwnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnRVJST1InLCAnV0FSTicsICdJTkZPJywgJ0RFQlVHJywgJ1RSQUNFJywgJ0FMTCddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdBTEwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdHRlcm46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZWFyY2hfcHJvamVjdF9sb2dzXSBTZWFyY2ggcGF0dGVybiAoc3VwcG9ydHMgcmVnZXgpJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhSZXN1bHRzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2VhcmNoX3Byb2plY3RfbG9nc10gTWF4aW11bSBudW1iZXIgb2YgbWF0Y2hpbmcgcmVzdWx0cycsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMjAsXG4gICAgICAgICAgICAgICAgbWluaW11bTogMSxcbiAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29udGV4dExpbmVzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2VhcmNoX3Byb2plY3RfbG9nc10gTnVtYmVyIG9mIGNvbnRleHQgbGluZXMgdG8gc2hvdyBhcm91bmQgZWFjaCBtYXRjaCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMixcbiAgICAgICAgICAgICAgICBtaW5pbXVtOiAwLFxuICAgICAgICAgICAgICAgIG1heGltdW06IDEwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ10sXG4gICAgfTtcblxuICAgIC8vIFN0YXRlIHByZXNlcnZlZCBmcm9tIERlYnVnVG9vbHNcbiAgICBwcml2YXRlIGNvbnNvbGVNZXNzYWdlczogQ29uc29sZU1lc3NhZ2VbXSA9IFtdO1xuICAgIHByaXZhdGUgcmVhZG9ubHkgbWF4TWVzc2FnZXMgPSAxMDAwO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuc2V0dXBDb25zb2xlQ2FwdHVyZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2V0dXBDb25zb2xlQ2FwdHVyZSgpOiB2b2lkIHtcbiAgICAgICAgLy8gSW50ZXJjZXB0IEVkaXRvciBjb25zb2xlIG1lc3NhZ2VzXG4gICAgICAgIC8vIE5vdGU6IEVkaXRvci5NZXNzYWdlLmFkZEJyb2FkY2FzdExpc3RlbmVyIG1heSBub3QgYmUgYXZhaWxhYmxlIGluIGFsbCB2ZXJzaW9uc1xuICAgICAgICAvLyBUaGlzIGlzIGEgcGxhY2Vob2xkZXIgZm9yIGNvbnNvbGUgY2FwdHVyZSBpbXBsZW1lbnRhdGlvblxuICAgICAgICBjb25zb2xlLmxvZygnQ29uc29sZSBjYXB0dXJlIHNldHVwIC0gaW1wbGVtZW50YXRpb24gZGVwZW5kcyBvbiBFZGl0b3IgQVBJIGF2YWlsYWJpbGl0eScpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYWRkQ29uc29sZU1lc3NhZ2UobWVzc2FnZTogYW55KTogdm9pZCB7XG4gICAgICAgIHRoaXMuY29uc29sZU1lc3NhZ2VzLnB1c2goe1xuICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAuLi5tZXNzYWdlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEtlZXAgb25seSBsYXRlc3QgbWVzc2FnZXNcbiAgICAgICAgaWYgKHRoaXMuY29uc29sZU1lc3NhZ2VzLmxlbmd0aCA+IHRoaXMubWF4TWVzc2FnZXMpIHtcbiAgICAgICAgICAgIHRoaXMuY29uc29sZU1lc3NhZ2VzLnNoaWZ0KCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2NvbnNvbGVfbG9nczogKGFyZ3MpID0+IHRoaXMuZ2V0Q29uc29sZUxvZ3MoXG4gICAgICAgICAgICBjb2VyY2VJbnQoYXJncy5saW1pdCkgPz8gMTAwLFxuICAgICAgICAgICAgYXJncy5maWx0ZXIgPz8gJ2FsbCdcbiAgICAgICAgKSxcbiAgICAgICAgY2xlYXJfY29uc29sZTogKF9hcmdzKSA9PiB0aGlzLmNsZWFyQ29uc29sZSgpLFxuICAgICAgICBleGVjdXRlX3NjcmlwdDogKGFyZ3MpID0+IHRoaXMuZXhlY3V0ZVNjcmlwdChhcmdzLnNjcmlwdCksXG4gICAgICAgIGdldF9ub2RlX3RyZWU6IChhcmdzKSA9PiB0aGlzLmdldE5vZGVUcmVlKFxuICAgICAgICAgICAgYXJncy5yb290VXVpZCxcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLm1heERlcHRoKSA/PyAxMFxuICAgICAgICApLFxuICAgICAgICBnZXRfcGVyZm9ybWFuY2Vfc3RhdHM6IChfYXJncykgPT4gdGhpcy5nZXRQZXJmb3JtYW5jZVN0YXRzKCksXG4gICAgICAgIHZhbGlkYXRlX3NjZW5lOiAoYXJncykgPT4gdGhpcy52YWxpZGF0ZVNjZW5lKHtcbiAgICAgICAgICAgIGNoZWNrTWlzc2luZ0Fzc2V0czogY29lcmNlQm9vbChhcmdzLmNoZWNrTWlzc2luZ0Fzc2V0cykgPz8gdHJ1ZSxcbiAgICAgICAgICAgIGNoZWNrUGVyZm9ybWFuY2U6IGNvZXJjZUJvb2woYXJncy5jaGVja1BlcmZvcm1hbmNlKSA/PyB0cnVlLFxuICAgICAgICB9KSxcbiAgICAgICAgZ2V0X2VkaXRvcl9pbmZvOiAoX2FyZ3MpID0+IHRoaXMuZ2V0RWRpdG9ySW5mbygpLFxuICAgICAgICBnZXRfcHJvamVjdF9sb2dzOiAoYXJncykgPT4gdGhpcy5nZXRQcm9qZWN0TG9ncyhcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLmxpbmVzKSA/PyAxMDAsXG4gICAgICAgICAgICBhcmdzLmZpbHRlcktleXdvcmQsXG4gICAgICAgICAgICBhcmdzLmxvZ0xldmVsID8/ICdBTEwnXG4gICAgICAgICksXG4gICAgICAgIGdldF9sb2dfZmlsZV9pbmZvOiAoX2FyZ3MpID0+IHRoaXMuZ2V0TG9nRmlsZUluZm8oKSxcbiAgICAgICAgc2VhcmNoX3Byb2plY3RfbG9nczogKGFyZ3MpID0+IHRoaXMuc2VhcmNoUHJvamVjdExvZ3MoXG4gICAgICAgICAgICBhcmdzLnBhdHRlcm4sXG4gICAgICAgICAgICBjb2VyY2VJbnQoYXJncy5tYXhSZXN1bHRzKSA/PyAyMCxcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLmNvbnRleHRMaW5lcykgPz8gMlxuICAgICAgICApLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvbnNvbGVMb2dzKGxpbWl0OiBudW1iZXIsIGZpbHRlcjogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGxldCBsb2dzID0gdGhpcy5jb25zb2xlTWVzc2FnZXM7XG5cbiAgICAgICAgaWYgKGZpbHRlciAhPT0gJ2FsbCcpIHtcbiAgICAgICAgICAgIGxvZ3MgPSBsb2dzLmZpbHRlcihsb2cgPT4gbG9nLnR5cGUgPT09IGZpbHRlcik7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZWNlbnRMb2dzID0gbG9ncy5zbGljZSgtbGltaXQpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIHRvdGFsOiBsb2dzLmxlbmd0aCxcbiAgICAgICAgICAgIHJldHVybmVkOiByZWNlbnRMb2dzLmxlbmd0aCxcbiAgICAgICAgICAgIGxvZ3M6IHJlY2VudExvZ3NcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjbGVhckNvbnNvbGUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRoaXMuY29uc29sZU1lc3NhZ2VzID0gW107XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIE5vdGU6IEVkaXRvci5NZXNzYWdlLnNlbmQgbWF5IG5vdCByZXR1cm4gYSBwcm9taXNlIGluIGFsbCB2ZXJzaW9uc1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2Uuc2VuZCgnY29uc29sZScsICdjbGVhcicpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ0NvbnNvbGUgY2xlYXJlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHZhbGlkYXRlU2NyaXB0KHNjcmlwdDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmICghc2NyaXB0IHx8IHR5cGVvZiBzY3JpcHQgIT09ICdzdHJpbmcnKSByZXR1cm4gJ3NjcmlwdCBpcyByZXF1aXJlZCc7XG4gICAgICAgIGlmIChzY3JpcHQubGVuZ3RoID4gMTAyNDApIHJldHVybiAnU2NyaXB0IGV4Y2VlZHMgbWF4aW11bSBsZW5ndGggb2YgMTBLQic7XG4gICAgICAgIGNvbnN0IGRhbmdlcm91cyA9IFtcbiAgICAgICAgICAgIFwicmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpXCIsXG4gICAgICAgICAgICAncmVxdWlyZShcImNoaWxkX3Byb2Nlc3NcIiknLFxuICAgICAgICAgICAgJ3Byb2Nlc3MuZXhpdCcsXG4gICAgICAgICAgICAnZXZhbCgnLFxuICAgICAgICAgICAgJ0Z1bmN0aW9uKCcsXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBkYW5nZXJvdXMpIHtcbiAgICAgICAgICAgIGlmIChzY3JpcHQuaW5jbHVkZXMocGF0dGVybikpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYFNjcmlwdCBjb250YWlucyBkaXNhbGxvd2VkIHBhdHRlcm46ICR7cGF0dGVybn1gO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZXhlY3V0ZVNjcmlwdChzY3JpcHQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB2YWxpZGF0aW9uRXJyb3IgPSB0aGlzLnZhbGlkYXRlU2NyaXB0KHNjcmlwdCk7XG4gICAgICAgIGlmICh2YWxpZGF0aW9uRXJyb3IpIHJldHVybiBlcnJvclJlc3VsdCh2YWxpZGF0aW9uRXJyb3IpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvbnNvbGUnLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2V2YWwnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFtzY3JpcHRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1NjcmlwdCBleGVjdXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIHdhcm5pbmc6ICdDb2RlIHdhcyBleGVjdXRlZCBpbiB0aGUgc2NlbmUgY29udGV4dC4gRW5zdXJlIHNjcmlwdHMgYXJlIHRydXN0ZWQgYmVmb3JlIGV4ZWN1dGlvbi4nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVUcmVlKHJvb3RVdWlkPzogc3RyaW5nLCBtYXhEZXB0aDogbnVtYmVyID0gMTApOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgYnVpbGRUcmVlID0gYXN5bmMgKG5vZGVVdWlkOiBzdHJpbmcsIGRlcHRoOiBudW1iZXIgPSAwKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgICAgIGlmIChkZXB0aCA+PSBtYXhEZXB0aCkgcmV0dXJuIHsgdHJ1bmNhdGVkOiB0cnVlIH07XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmVlID0ge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlRGF0YS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBub2RlRGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGVEYXRhLmFjdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogKG5vZGVEYXRhIGFzIGFueSkuY29tcG9uZW50cyA/IChub2RlRGF0YSBhcyBhbnkpLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMuX190eXBlX18pIDogW10sXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkQ291bnQ6IG5vZGVEYXRhLmNoaWxkcmVuID8gbm9kZURhdGEuY2hpbGRyZW4ubGVuZ3RoIDogMCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdIGFzIGFueVtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuY2hpbGRyZW4gJiYgbm9kZURhdGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkSWQgb2Ygbm9kZURhdGEuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuY2hpbGRyZW4ucHVzaChhd2FpdCBidWlsZFRyZWUoY2hpbGRJZCwgZGVwdGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyZWU7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocm9vdFV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChhd2FpdCBidWlsZFRyZWUocm9vdFV1aWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGllcmFyY2h5OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1oaWVyYXJjaHknKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmVlcyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vdE5vZGUgb2YgaGllcmFyY2h5LmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyZWVzLnB1c2goYXdhaXQgYnVpbGRUcmVlKHJvb3ROb2RlLnV1aWQpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQodHJlZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGVyZm9ybWFuY2VTdGF0cygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1wZXJmb3JtYW5jZScpO1xuICAgICAgICAgICAgY29uc3QgcGVyZlN0YXRzOiBQZXJmb3JtYW5jZVN0YXRzID0ge1xuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogc3RhdHMubm9kZUNvdW50IHx8IDAsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50Q291bnQ6IHN0YXRzLmNvbXBvbmVudENvdW50IHx8IDAsXG4gICAgICAgICAgICAgICAgZHJhd0NhbGxzOiBzdGF0cy5kcmF3Q2FsbHMgfHwgMCxcbiAgICAgICAgICAgICAgICB0cmlhbmdsZXM6IHN0YXRzLnRyaWFuZ2xlcyB8fCAwLFxuICAgICAgICAgICAgICAgIG1lbW9yeTogc3RhdHMubWVtb3J5IHx8IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocGVyZlN0YXRzKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1lc3NhZ2U6ICdQZXJmb3JtYW5jZSBzdGF0cyBub3QgYXZhaWxhYmxlIGluIGVkaXQgbW9kZScgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZSB0aGUgb3BlbiBzY2VuZS5cbiAgICAgKlxuICAgICAqIEVhY2ggZW5hYmxlZCBjaGVjayBydW5zIGluIGl0cyBvd24gZmF1bHQgYm91bmRhcnkuIFByZXZpb3VzbHkgYSBzaW5nbGUgZmFpbGluZ1xuICAgICAqIGNoZWNrIGFib3J0ZWQgdGhlIHdob2xlIGFjdGlvbjogQ29jb3MgQ3JlYXRvciAzLjguNyByZWdpc3RlcnMgbm9cbiAgICAgKiBgc2NlbmU6Y2hlY2stbWlzc2luZy1hc3NldHNgIG1lc3NhZ2UsIHNvIHRoZSByZXF1ZXN0IHJlamVjdGVkIHdpdGhcbiAgICAgKiBgc2NlbmUgLSBjaGVjay1taXNzaW5nLWFzc2V0cyBkb2VzIG5vdCBleGlzdGAgYW5kIGB2YWxpZGF0ZV9zY2VuZWAgcmV0dXJuZWQgYW5cbiAgICAgKiBlcnJvciBpbnN0ZWFkIG9mIGEgcmVzdWx0ICgjMjMpLiBBbiB1bnN1cHBvcnRlZCBjaGVjayBpcyBub3cgcmVwb3J0ZWQgYXMgb25lXG4gICAgICogdW5zdXBwb3J0ZWQgY2hlY2ssIGFuZCB0aGUgbWlzc2luZy1hc3NldCBzY2FuIGZhbGxzIGJhY2sgdG8gd2Fsa2luZyB0aGUgc2NlbmUnc1xuICAgICAqIG93biBjb21wb25lbnQgZHVtcHMgZm9yIHVucmVzb2x2YWJsZSBhc3NldCBVVUlEcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlU2NlbmUob3B0aW9uczogeyBjaGVja01pc3NpbmdBc3NldHM6IGJvb2xlYW47IGNoZWNrUGVyZm9ybWFuY2U6IGJvb2xlYW4gfSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdID0gW107XG4gICAgICAgIGNvbnN0IGNoZWNrczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuXG4gICAgICAgIGlmIChvcHRpb25zLmNoZWNrTWlzc2luZ0Fzc2V0cykge1xuICAgICAgICAgICAgY29uc3QgbmF0aXZlID0gYXdhaXQgdGhpcy5jaGVja01pc3NpbmdBc3NldHNOYXRpdmUoKTtcbiAgICAgICAgICAgIGlmIChuYXRpdmUuc3VwcG9ydGVkKSB7XG4gICAgICAgICAgICAgICAgY2hlY2tzLm1pc3NpbmdBc3NldHMgPSAnbmF0aXZlJztcbiAgICAgICAgICAgICAgICBpc3N1ZXMucHVzaCguLi5uYXRpdmUuaXNzdWVzKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2NhbiA9IGF3YWl0IHRoaXMuc2Nhbk1pc3NpbmdBc3NldFJlZmVyZW5jZXMoKTtcbiAgICAgICAgICAgICAgICBjaGVja3MubWlzc2luZ0Fzc2V0cyA9IHNjYW4uZXJyb3IgPyBgdW5zdXBwb3J0ZWQ6ICR7c2Nhbi5lcnJvcn1gIDogJ2ZhbGxiYWNrLXNjYW4nO1xuICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKC4uLnNjYW4uaXNzdWVzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChvcHRpb25zLmNoZWNrUGVyZm9ybWFuY2UpIHtcbiAgICAgICAgICAgIGNvbnN0IHBlcmYgPSBhd2FpdCB0aGlzLmNoZWNrTm9kZUNvdW50KCk7XG4gICAgICAgICAgICBjaGVja3MucGVyZm9ybWFuY2UgPSBwZXJmLmVycm9yID8gYHVuc3VwcG9ydGVkOiAke3BlcmYuZXJyb3J9YCA6ICdvayc7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCguLi5wZXJmLmlzc3Vlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHQ6IFZhbGlkYXRpb25SZXN1bHQgPSB7XG4gICAgICAgICAgICB2YWxpZDogaXNzdWVzLmZpbHRlcihpID0+IGkudHlwZSA9PT0gJ2Vycm9yJykubGVuZ3RoID09PSAwLFxuICAgICAgICAgICAgaXNzdWVDb3VudDogaXNzdWVzLmxlbmd0aCxcbiAgICAgICAgICAgIGlzc3Vlc1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IC4uLnJlc3VsdCwgY2hlY2tzIH0pO1xuICAgIH1cblxuICAgIC8qKiBUcnkgdGhlIGVkaXRvcidzIG93biBtaXNzaW5nLWFzc2V0IGNoZWNrLiAzLjguNyBkb2VzIG5vdCByZWdpc3RlciBpdC4gKi9cbiAgICBwcml2YXRlIGFzeW5jIGNoZWNrTWlzc2luZ0Fzc2V0c05hdGl2ZSgpOiBQcm9taXNlPHsgc3VwcG9ydGVkOiBib29sZWFuOyBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0Q2hlY2s6IGFueSA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ2NoZWNrLW1pc3NpbmctYXNzZXRzJyk7XG4gICAgICAgICAgICBpZiAoYXNzZXRDaGVjayAmJiBBcnJheS5pc0FycmF5KGFzc2V0Q2hlY2subWlzc2luZykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdXBwb3J0ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGlzc3VlczogYXNzZXRDaGVjay5taXNzaW5nLmxlbmd0aCA/IFt7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYEZvdW5kICR7YXNzZXRDaGVjay5taXNzaW5nLmxlbmd0aH0gbWlzc2luZyBhc3NldCByZWZlcmVuY2VzYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IGFzc2V0Q2hlY2subWlzc2luZ1xuICAgICAgICAgICAgICAgICAgICB9XSA6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1cHBvcnRlZDogZmFsc2UsIGlzc3VlczogW10gfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4geyBzdXBwb3J0ZWQ6IGZhbHNlLCBpc3N1ZXM6IFtdIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWZXJzaW9uLWluZGVwZW5kZW50IGZhbGxiYWNrOiB3YWxrIHRoZSBzY2VuZSdzIG5vZGUgZHVtcHMsIGNvbGxlY3QgZXZlcnkgYXNzZXRcbiAgICAgKiBVVUlEIHJlZmVyZW5jZWQgYnkgYSBjb21wb25lbnQgcHJvcGVydHksIGFuZCByZXBvcnQgdGhlIG9uZXMgdGhlIGFzc2V0IERCIGNhbm5vdFxuICAgICAqIHJlc29sdmUuIFNhbWUgYFZhbGlkYXRpb25Jc3N1ZWAgc2hhcGUgYXMgdGhlIG5hdGl2ZSBwYXRoLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2Nhbk1pc3NpbmdBc3NldFJlZmVyZW5jZXMoKTogUHJvbWlzZTx7IGlzc3VlczogVmFsaWRhdGlvbklzc3VlW107IGVycm9yPzogc3RyaW5nIH0+IHtcbiAgICAgICAgbGV0IHJvb3RVdWlkczogc3RyaW5nW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByb290VXVpZHMgPSBhd2FpdCB0aGlzLmNvbGxlY3RTY2VuZU5vZGVVdWlkcygpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNzdWVzOiBbXSwgZXJyb3I6IGBjYW5ub3QgZW51bWVyYXRlIHNjZW5lIG5vZGVzICgke2Vycj8ubWVzc2FnZSB8fCBlcnJ9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlZmVyZW5jZWRCeSA9IG5ldyBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4oKTtcbiAgICAgICAgZm9yIChjb25zdCBub2RlVXVpZCBvZiByb290VXVpZHMpIHtcbiAgICAgICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG5vZGVOYW1lID0gbm9kZURhdGE/Lm5hbWU/LnZhbHVlID8/IG5vZGVEYXRhPy5uYW1lID8/IG5vZGVVdWlkO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wIG9mIChub2RlRGF0YT8uX19jb21wc19fID8/IFtdKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdXVpZCBvZiBjb2xsZWN0QXNzZXRVdWlkcyhjb21wLnZhbHVlID8/IGNvbXApKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghcmVmZXJlbmNlZEJ5Lmhhcyh1dWlkKSkgcmVmZXJlbmNlZEJ5LnNldCh1dWlkLCBuZXcgU2V0KCkpO1xuICAgICAgICAgICAgICAgICAgICByZWZlcmVuY2VkQnkuZ2V0KHV1aWQpIS5hZGQoYCR7bm9kZU5hbWV9IOKGkiAke2NvbXBUeXBlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG1pc3Npbmc6IEFycmF5PHsgdXVpZDogc3RyaW5nOyByZWZlcmVuY2VkQnk6IHN0cmluZ1tdIH0+ID0gW107XG4gICAgICAgIGZvciAoY29uc3QgW3V1aWQsIGhvbGRlcnNdIG9mIHJlZmVyZW5jZWRCeSkge1xuICAgICAgICAgICAgbGV0IGluZm86IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXVpZCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBpbmZvID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghaW5mbykgbWlzc2luZy5wdXNoKHsgdXVpZCwgcmVmZXJlbmNlZEJ5OiBbLi4uaG9sZGVyc10gfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW1pc3NpbmcubGVuZ3RoKSByZXR1cm4geyBpc3N1ZXM6IFtdIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBpc3N1ZXM6IFt7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYEZvdW5kICR7bWlzc2luZy5sZW5ndGh9IG1pc3NpbmcgYXNzZXQgcmVmZXJlbmNlc2AsXG4gICAgICAgICAgICAgICAgZGV0YWlsczogbWlzc2luZ1xuICAgICAgICAgICAgfV1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKiogRmxhdHRlbiB0aGUgc2NlbmUgdHJlZSB0byBhIGxpc3Qgb2Ygbm9kZSBVVUlEcy4gKi9cbiAgICBwcml2YXRlIGFzeW5jIGNvbGxlY3RTY2VuZU5vZGVVdWlkcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICBjb25zdCByb290czogYW55W10gPSBBcnJheS5pc0FycmF5KHRyZWUpID8gdHJlZSA6ICh0cmVlID8gW3RyZWVdIDogW10pO1xuICAgICAgICBjb25zdCB1dWlkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBub2RlLnV1aWQgPT09ICdzdHJpbmcnKSB1dWlkcy5wdXNoKG5vZGUudXVpZCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuID8/IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHJvb3RzLmZvckVhY2god2Fsayk7XG4gICAgICAgIHJldHVybiB1dWlkcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNoZWNrTm9kZUNvdW50KCk6IFByb21pc2U8eyBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgICAgIGxldCBub2RlQ291bnQ6IG51bWJlcjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG5vZGVDb3VudCA9IChhd2FpdCB0aGlzLmNvbGxlY3RTY2VuZU5vZGVVdWlkcygpKS5sZW5ndGg7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBpc3N1ZXM6IFtdLCBlcnJvcjogYGNhbm5vdCBlbnVtZXJhdGUgc2NlbmUgbm9kZXMgKCR7ZXJyPy5tZXNzYWdlIHx8IGVycn0pYCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlQ291bnQgPD0gMTAwMCkgcmV0dXJuIHsgaXNzdWVzOiBbXSB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgaXNzdWVzOiBbe1xuICAgICAgICAgICAgICAgIHR5cGU6ICd3YXJuaW5nJyxcbiAgICAgICAgICAgICAgICBjYXRlZ29yeTogJ3BlcmZvcm1hbmNlJyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSGlnaCBub2RlIGNvdW50OiAke25vZGVDb3VudH0gbm9kZXMgKHJlY29tbWVuZGVkIDwgMTAwMClgLFxuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb246ICdDb25zaWRlciB1c2luZyBvYmplY3QgcG9vbGluZyBvciBzY2VuZSBvcHRpbWl6YXRpb24nXG4gICAgICAgICAgICB9XVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0RWRpdG9ySW5mbygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgaW5mbyA9IHtcbiAgICAgICAgICAgIGVkaXRvcjoge1xuICAgICAgICAgICAgICAgIHZlcnNpb246IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uZWRpdG9yIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBjb2Nvc1ZlcnNpb246IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uY29jb3MgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgICAgICAgICAgICAgIGFyY2g6IHByb2Nlc3MuYXJjaCxcbiAgICAgICAgICAgICAgICBub2RlVmVyc2lvbjogcHJvY2Vzcy52ZXJzaW9uXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvamVjdDoge1xuICAgICAgICAgICAgICAgIG5hbWU6IEVkaXRvci5Qcm9qZWN0Lm5hbWUsXG4gICAgICAgICAgICAgICAgcGF0aDogRWRpdG9yLlByb2plY3QucGF0aCxcbiAgICAgICAgICAgICAgICB1dWlkOiBFZGl0b3IuUHJvamVjdC51dWlkXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWVtb3J5OiBwcm9jZXNzLm1lbW9yeVVzYWdlKCksXG4gICAgICAgICAgICB1cHRpbWU6IHByb2Nlc3MudXB0aW1lKClcbiAgICAgICAgfTtcblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlc29sdmVMb2dGaWxlUGF0aCgpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBwb3NzaWJsZVBhdGhzID0gW1xuICAgICAgICAgICAgRWRpdG9yLlByb2plY3QgPyBFZGl0b3IuUHJvamVjdC5wYXRoIDogbnVsbCxcbiAgICAgICAgICAgIHByb2Nlc3MuY3dkKCksXG4gICAgICAgIF0uZmlsdGVyKChwKTogcCBpcyBzdHJpbmcgPT4gcCAhPT0gbnVsbCk7XG5cbiAgICAgICAgZm9yIChjb25zdCBiYXNlUGF0aCBvZiBwb3NzaWJsZVBhdGhzKSB7XG4gICAgICAgICAgICBjb25zdCB0ZXN0UGF0aCA9IHBhdGguam9pbihiYXNlUGF0aCwgJ3RlbXAvbG9ncy9wcm9qZWN0LmxvZycpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmModGVzdFBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRlc3RQYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYFByb2plY3QgbG9nIGZpbGUgbm90IGZvdW5kLiBUcmllZCBwYXRoczogJHtwb3NzaWJsZVBhdGhzLm1hcChwID0+IHBhdGguam9pbihwLCAndGVtcC9sb2dzL3Byb2plY3QubG9nJykpLmpvaW4oJywgJyl9YFxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKiBSZWFkIHVwIHRvIGxhc3QgMTAwS0Igb2YgYSBsb2cgZmlsZSB0byBhdm9pZCBsb2FkaW5nIGh1Z2UgZmlsZXMgaW50byBtZW1vcnkuICovXG4gICAgcHJpdmF0ZSByZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IE1BWF9CWVRFUyA9IDEwMCAqIDEwMjQ7IC8vIDEwMEtCXG4gICAgICAgIGNvbnN0IHN0YXRzID0gZnMuc3RhdFN5bmMobG9nRmlsZVBhdGgpO1xuICAgICAgICBjb25zdCBmaWxlU2l6ZSA9IHN0YXRzLnNpemU7XG4gICAgICAgIGlmIChmaWxlU2l6ZSA8PSBNQVhfQllURVMpIHtcbiAgICAgICAgICAgIHJldHVybiBmcy5yZWFkRmlsZVN5bmMobG9nRmlsZVBhdGgsICd1dGY4Jyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jKE1BWF9CWVRFUyk7XG4gICAgICAgIGNvbnN0IGZkID0gZnMub3BlblN5bmMobG9nRmlsZVBhdGgsICdyJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy5yZWFkU3luYyhmZCwgYnVmZmVyLCAwLCBNQVhfQllURVMsIGZpbGVTaXplIC0gTUFYX0JZVEVTKTtcbiAgICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgICAgIGZzLmNsb3NlU3luYyhmZCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gU2tpcCB0aGUgZmlyc3QgKHBvc3NpYmx5IHBhcnRpYWwpIGxpbmVcbiAgICAgICAgY29uc3QgcmF3ID0gYnVmZmVyLnRvU3RyaW5nKCd1dGY4Jyk7XG4gICAgICAgIGNvbnN0IG5ld2xpbmVJZHggPSByYXcuaW5kZXhPZignXFxuJyk7XG4gICAgICAgIHJldHVybiBuZXdsaW5lSWR4ID49IDAgPyByYXcuc2xpY2UobmV3bGluZUlkeCArIDEpIDogcmF3O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJvamVjdExvZ3MobGluZXM6IG51bWJlciwgZmlsdGVyS2V5d29yZD86IHN0cmluZywgbG9nTGV2ZWw6IHN0cmluZyA9ICdBTEwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUxvZ0ZpbGVQYXRoKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvZ0NvbnRlbnQgPSB0aGlzLnJlYWRMb2dGaWxlVGFpbChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICBjb25zdCBsb2dMaW5lcyA9IGxvZ0NvbnRlbnQuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUudHJpbSgpICE9PSAnJyk7XG5cbiAgICAgICAgICAgIC8vIEdldCB0aGUgbGFzdCBOIGxpbmVzXG4gICAgICAgICAgICBjb25zdCByZWNlbnRMaW5lcyA9IGxvZ0xpbmVzLnNsaWNlKC1saW5lcyk7XG5cbiAgICAgICAgICAgIC8vIEFwcGx5IGZpbHRlcnNcbiAgICAgICAgICAgIGxldCBmaWx0ZXJlZExpbmVzID0gcmVjZW50TGluZXM7XG5cbiAgICAgICAgICAgIGlmIChsb2dMZXZlbCAhPT0gJ0FMTCcpIHtcbiAgICAgICAgICAgICAgICBmaWx0ZXJlZExpbmVzID0gZmlsdGVyZWRMaW5lcy5maWx0ZXIobGluZSA9PlxuICAgICAgICAgICAgICAgICAgICBsaW5lLmluY2x1ZGVzKGBbJHtsb2dMZXZlbH1dYCkgfHwgbGluZS5pbmNsdWRlcyhsb2dMZXZlbC50b0xvd2VyQ2FzZSgpKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmaWx0ZXJLZXl3b3JkKSB7XG4gICAgICAgICAgICAgICAgZmlsdGVyZWRMaW5lcyA9IGZpbHRlcmVkTGluZXMuZmlsdGVyKGxpbmUgPT5cbiAgICAgICAgICAgICAgICAgICAgbGluZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGZpbHRlcktleXdvcmQudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgdG90YWxMaW5lczogbG9nTGluZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHJlcXVlc3RlZExpbmVzOiBsaW5lcyxcbiAgICAgICAgICAgICAgICBmaWx0ZXJlZExpbmVzOiBmaWx0ZXJlZExpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBsb2dMZXZlbDogbG9nTGV2ZWwsXG4gICAgICAgICAgICAgICAgZmlsdGVyS2V5d29yZDogZmlsdGVyS2V5d29yZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGxvZ3M6IGZpbHRlcmVkTGluZXMsXG4gICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGxvZ0ZpbGVQYXRoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVhZCBwcm9qZWN0IGxvZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TG9nRmlsZUluZm8oKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUxvZ0ZpbGVQYXRoKCk7XG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgICAgIC8vIENvdW50IGxpbmVzIHVzaW5nIHRhaWwgcmVhZCB0byBhdm9pZCBsb2FkaW5nIGh1Z2UgZmlsZXNcbiAgICAgICAgICAgIGNvbnN0IHRhaWxDb250ZW50ID0gdGhpcy5yZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgbGluZUNvdW50ID0gdGFpbENvbnRlbnQuc3BsaXQoJ1xcbicpLmZpbHRlcihsaW5lID0+IGxpbmUudHJpbSgpICE9PSAnJykubGVuZ3RoO1xuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgZmlsZVBhdGg6IGxvZ0ZpbGVQYXRoLFxuICAgICAgICAgICAgICAgIGZpbGVTaXplOiBzdGF0cy5zaXplLFxuICAgICAgICAgICAgICAgIGZpbGVTaXplRm9ybWF0dGVkOiB0aGlzLmZvcm1hdEZpbGVTaXplKHN0YXRzLnNpemUpLFxuICAgICAgICAgICAgICAgIGxhc3RNb2RpZmllZDogc3RhdHMubXRpbWUudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBsaW5lQ291bnQsXG4gICAgICAgICAgICAgICAgY3JlYXRlZDogc3RhdHMuYmlydGh0aW1lLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgYWNjZXNzaWJsZTogZnMuY29uc3RhbnRzLlJfT0ssXG4gICAgICAgICAgICAgICAgbm90ZTogc3RhdHMuc2l6ZSA+IDEwMjQwMCA/ICdGaWxlIGlzIGxhcmdlOyBvbmx5IGxhc3QgMTAwS0IgaXMgcmVhZC4nIDogdW5kZWZpbmVkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGxvZyBmaWxlIGluZm86ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2VhcmNoUHJvamVjdExvZ3MocGF0dGVybjogc3RyaW5nLCBtYXhSZXN1bHRzOiBudW1iZXIsIGNvbnRleHRMaW5lczogbnVtYmVyKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb2dGaWxlUGF0aCA9IHRoaXMucmVzb2x2ZUxvZ0ZpbGVQYXRoKCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGxvZ0NvbnRlbnQgPSB0aGlzLnJlYWRMb2dGaWxlVGFpbChsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICBjb25zdCBsb2dMaW5lcyA9IGxvZ0NvbnRlbnQuc3BsaXQoJ1xcbicpO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgcmVnZXggcGF0dGVybiAoc3VwcG9ydCBib3RoIHN0cmluZyBhbmQgcmVnZXggcGF0dGVybnMpXG4gICAgICAgICAgICBsZXQgcmVnZXg6IFJlZ0V4cDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4sICdnaScpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gSWYgcGF0dGVybiBpcyBub3QgdmFsaWQgcmVnZXgsIHRyZWF0IGFzIGxpdGVyYWwgc3RyaW5nXG4gICAgICAgICAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHBhdHRlcm4ucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csICdcXFxcJCYnKSwgJ2dpJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBsZXQgcmVzdWx0Q291bnQgPSAwO1xuXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxvZ0xpbmVzLmxlbmd0aCAmJiByZXN1bHRDb3VudCA8IG1heFJlc3VsdHM7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsb2dMaW5lc1tpXTtcbiAgICAgICAgICAgICAgICBpZiAocmVnZXgudGVzdChsaW5lKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0U3RhcnQgPSBNYXRoLm1heCgwLCBpIC0gY29udGV4dExpbmVzKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGV4dEVuZCA9IE1hdGgubWluKGxvZ0xpbmVzLmxlbmd0aCAtIDEsIGkgKyBjb250ZXh0TGluZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRleHRMaW5lc0FycmF5ID0gW107XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSBjb250ZXh0U3RhcnQ7IGogPD0gY29udGV4dEVuZDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXh0TGluZXNBcnJheS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBqICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBsb2dMaW5lc1tqXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpc01hdGNoOiBqID09PSBpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBsaW5lTnVtYmVyOiBpICsgMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRMaW5lOiBsaW5lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dDogY29udGV4dExpbmVzQXJyYXlcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0Q291bnQrKztcblxuICAgICAgICAgICAgICAgICAgICAvLyBSZXNldCByZWdleCBsYXN0SW5kZXggZm9yIGdsb2JhbCBzZWFyY2hcbiAgICAgICAgICAgICAgICAgICAgcmVnZXgubGFzdEluZGV4ID0gMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiBwYXR0ZXJuLFxuICAgICAgICAgICAgICAgIHRvdGFsTWF0Y2hlczogbWF0Y2hlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgbWF4UmVzdWx0czogbWF4UmVzdWx0cyxcbiAgICAgICAgICAgICAgICBjb250ZXh0TGluZXM6IGNvbnRleHRMaW5lcyxcbiAgICAgICAgICAgICAgICBsb2dGaWxlUGF0aDogbG9nRmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWF0Y2hlczogbWF0Y2hlc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHNlYXJjaCBwcm9qZWN0IGxvZ3M6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZm9ybWF0RmlsZVNpemUoYnl0ZXM6IG51bWJlcik6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IHVuaXRzID0gWydCJywgJ0tCJywgJ01CJywgJ0dCJ107XG4gICAgICAgIGxldCBzaXplID0gYnl0ZXM7XG4gICAgICAgIGxldCB1bml0SW5kZXggPSAwO1xuXG4gICAgICAgIHdoaWxlIChzaXplID49IDEwMjQgJiYgdW5pdEluZGV4IDwgdW5pdHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgc2l6ZSAvPSAxMDI0O1xuICAgICAgICAgICAgdW5pdEluZGV4Kys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYCR7c2l6ZS50b0ZpeGVkKDIpfSAke3VuaXRzW3VuaXRJbmRleF19YDtcbiAgICB9XG59XG4iXX0=