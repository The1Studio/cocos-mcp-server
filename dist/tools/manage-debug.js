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
    async validateScene(options) {
        const issues = [];
        try {
            // Check for missing assets
            if (options.checkMissingAssets) {
                const assetCheck = await Editor.Message.request('scene', 'check-missing-assets');
                if (assetCheck && assetCheck.missing) {
                    issues.push({
                        type: 'error',
                        category: 'assets',
                        message: `Found ${assetCheck.missing.length} missing asset references`,
                        details: assetCheck.missing
                    });
                }
            }
            // Check for performance issues
            if (options.checkPerformance) {
                const hierarchy = await Editor.Message.request('scene', 'query-hierarchy');
                const nodeCount = this.countNodes(hierarchy.children);
                if (nodeCount > 1000) {
                    issues.push({
                        type: 'warning',
                        category: 'performance',
                        message: `High node count: ${nodeCount} nodes (recommended < 1000)`,
                        suggestion: 'Consider using object pooling or scene optimization'
                    });
                }
            }
            const result = {
                valid: issues.length === 0,
                issueCount: issues.length,
                issues: issues
            };
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    countNodes(nodes) {
        let count = nodes.length;
        for (const node of nodes) {
            if (node.children) {
                count += this.countNodes(node.children);
            }
        }
        return count;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWRlYnVnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1kZWJ1Zy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLGtEQUEyRDtBQUUzRCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRTdCLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBcUczQztRQUNJLEtBQUssRUFBRSxDQUFDO1FBckdILFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRyxrVUFBa1UsQ0FBQztRQUNqVixZQUFPLEdBQUc7WUFDZixrQkFBa0I7WUFDbEIsZUFBZTtZQUNmLGdCQUFnQjtZQUNoQixlQUFlO1lBQ2YsdUJBQXVCO1lBQ3ZCLGdCQUFnQjtZQUNoQixpQkFBaUI7WUFDakIsa0JBQWtCO1lBQ2xCLG1CQUFtQjtZQUNuQixxQkFBcUI7U0FDeEIsQ0FBQztRQUVPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtQkFBbUI7b0JBQ2hDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTztpQkFDckI7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxzREFBc0Q7b0JBQ25FLE9BQU8sRUFBRSxHQUFHO2lCQUNmO2dCQUNELE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsd0NBQXdDO29CQUNyRCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO29CQUM3QyxPQUFPLEVBQUUsS0FBSztpQkFDakI7Z0JBQ0QsTUFBTSxFQUFF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QUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUM7SUFDcEQsQ0FBQztDQUNKO0FBamhCRCxrQ0FpaEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBjb2VyY2VCb29sLCBjb2VyY2VJbnQgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgQ29uc29sZU1lc3NhZ2UsIFBlcmZvcm1hbmNlU3RhdHMsIFZhbGlkYXRpb25SZXN1bHQsIFZhbGlkYXRpb25Jc3N1ZSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VEZWJ1ZyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9kZWJ1Zyc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnRGVidWcgYW5kIGluc3BlY3QgdGhlIGVkaXRvciBlbnZpcm9ubWVudC4gQWN0aW9uczogZ2V0X2NvbnNvbGVfbG9ncywgY2xlYXJfY29uc29sZSwgZXhlY3V0ZV9zY3JpcHQsIGdldF9ub2RlX3RyZWUsIGdldF9wZXJmb3JtYW5jZV9zdGF0cywgdmFsaWRhdGVfc2NlbmUsIGdldF9lZGl0b3JfaW5mbywgZ2V0X3Byb2plY3RfbG9ncywgZ2V0X2xvZ19maWxlX2luZm8sIHNlYXJjaF9wcm9qZWN0X2xvZ3MuIFVzZSBnZXRfZWRpdG9yX2luZm8gZm9yIGVudmlyb25tZW50IGRldGFpbHMuIFVzZSBleGVjdXRlX3NjcmlwdCB0byBydW4gSlMgaW4gc2NlbmUgY29udGV4dC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdnZXRfY29uc29sZV9sb2dzJyxcbiAgICAgICAgJ2NsZWFyX2NvbnNvbGUnLFxuICAgICAgICAnZXhlY3V0ZV9zY3JpcHQnLFxuICAgICAgICAnZ2V0X25vZGVfdHJlZScsXG4gICAgICAgICdnZXRfcGVyZm9ybWFuY2Vfc3RhdHMnLFxuICAgICAgICAndmFsaWRhdGVfc2NlbmUnLFxuICAgICAgICAnZ2V0X2VkaXRvcl9pbmZvJyxcbiAgICAgICAgJ2dldF9wcm9qZWN0X2xvZ3MnLFxuICAgICAgICAnZ2V0X2xvZ19maWxlX2luZm8nLFxuICAgICAgICAnc2VhcmNoX3Byb2plY3RfbG9ncycsXG4gICAgXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybScsXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxpbWl0OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2NvbnNvbGVfbG9nc10gTnVtYmVyIG9mIHJlY2VudCBsb2dzIHRvIHJldHJpZXZlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAxMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZmlsdGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2NvbnNvbGVfbG9nc10gRmlsdGVyIGxvZ3MgYnkgdHlwZScsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnbG9nJywgJ3dhcm4nLCAnZXJyb3InLCAnaW5mbyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjcmlwdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2V4ZWN1dGVfc2NyaXB0XSBKYXZhU2NyaXB0IGNvZGUgdG8gZXhlY3V0ZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm9vdFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfbm9kZV90cmVlXSBSb290IG5vZGUgVVVJRCAob3B0aW9uYWwsIHVzZXMgc2NlbmUgcm9vdCBpZiBub3QgcHJvdmlkZWQpJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhEZXB0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9ub2RlX3RyZWVdIE1heGltdW0gdHJlZSBkZXB0aCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMTAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2hlY2tNaXNzaW5nQXNzZXRzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3ZhbGlkYXRlX3NjZW5lXSBDaGVjayBmb3IgbWlzc2luZyBhc3NldCByZWZlcmVuY2VzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNoZWNrUGVyZm9ybWFuY2U6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbdmFsaWRhdGVfc2NlbmVdIENoZWNrIGZvciBwZXJmb3JtYW5jZSBpc3N1ZXMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGluZXM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfcHJvamVjdF9sb2dzXSBOdW1iZXIgb2YgbGluZXMgdG8gcmVhZCBmcm9tIHRoZSBlbmQgb2YgdGhlIGxvZyBmaWxlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAxMDAsXG4gICAgICAgICAgICAgICAgbWluaW11bTogMSxcbiAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMDAwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmaWx0ZXJLZXl3b3JkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X3Byb2plY3RfbG9nc10gRmlsdGVyIGxvZ3MgY29udGFpbmluZyBzcGVjaWZpYyBrZXl3b3JkIChvcHRpb25hbCknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxvZ0xldmVsOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X3Byb2plY3RfbG9nc10gRmlsdGVyIGJ5IGxvZyBsZXZlbCcsXG4gICAgICAgICAgICAgICAgZW51bTogWydFUlJPUicsICdXQVJOJywgJ0lORk8nLCAnREVCVUcnLCAnVFJBQ0UnLCAnQUxMJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ0FMTCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NlYXJjaF9wcm9qZWN0X2xvZ3NdIFNlYXJjaCBwYXR0ZXJuIChzdXBwb3J0cyByZWdleCknLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heFJlc3VsdHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZWFyY2hfcHJvamVjdF9sb2dzXSBNYXhpbXVtIG51bWJlciBvZiBtYXRjaGluZyByZXN1bHRzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAyMCxcbiAgICAgICAgICAgICAgICBtaW5pbXVtOiAxLFxuICAgICAgICAgICAgICAgIG1heGltdW06IDEwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb250ZXh0TGluZXM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZWFyY2hfcHJvamVjdF9sb2dzXSBOdW1iZXIgb2YgY29udGV4dCBsaW5lcyB0byBzaG93IGFyb3VuZCBlYWNoIG1hdGNoJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAyLFxuICAgICAgICAgICAgICAgIG1pbmltdW06IDAsXG4gICAgICAgICAgICAgICAgbWF4aW11bTogMTAsXG4gICAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXSxcbiAgICB9O1xuXG4gICAgLy8gU3RhdGUgcHJlc2VydmVkIGZyb20gRGVidWdUb29sc1xuICAgIHByaXZhdGUgY29uc29sZU1lc3NhZ2VzOiBDb25zb2xlTWVzc2FnZVtdID0gW107XG4gICAgcHJpdmF0ZSByZWFkb25seSBtYXhNZXNzYWdlcyA9IDEwMDA7XG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5zZXR1cENvbnNvbGVDYXB0dXJlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXR1cENvbnNvbGVDYXB0dXJlKCk6IHZvaWQge1xuICAgICAgICAvLyBJbnRlcmNlcHQgRWRpdG9yIGNvbnNvbGUgbWVzc2FnZXNcbiAgICAgICAgLy8gTm90ZTogRWRpdG9yLk1lc3NhZ2UuYWRkQnJvYWRjYXN0TGlzdGVuZXIgbWF5IG5vdCBiZSBhdmFpbGFibGUgaW4gYWxsIHZlcnNpb25zXG4gICAgICAgIC8vIFRoaXMgaXMgYSBwbGFjZWhvbGRlciBmb3IgY29uc29sZSBjYXB0dXJlIGltcGxlbWVudGF0aW9uXG4gICAgICAgIGNvbnNvbGUubG9nKCdDb25zb2xlIGNhcHR1cmUgc2V0dXAgLSBpbXBsZW1lbnRhdGlvbiBkZXBlbmRzIG9uIEVkaXRvciBBUEkgYXZhaWxhYmlsaXR5Jyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhZGRDb25zb2xlTWVzc2FnZShtZXNzYWdlOiBhbnkpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMucHVzaCh7XG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIC4uLm1lc3NhZ2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gS2VlcCBvbmx5IGxhdGVzdCBtZXNzYWdlc1xuICAgICAgICBpZiAodGhpcy5jb25zb2xlTWVzc2FnZXMubGVuZ3RoID4gdGhpcy5tYXhNZXNzYWdlcykge1xuICAgICAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMuc2hpZnQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBnZXRfY29uc29sZV9sb2dzOiAoYXJncykgPT4gdGhpcy5nZXRDb25zb2xlTG9ncyhcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLmxpbWl0KSA/PyAxMDAsXG4gICAgICAgICAgICBhcmdzLmZpbHRlciA/PyAnYWxsJ1xuICAgICAgICApLFxuICAgICAgICBjbGVhcl9jb25zb2xlOiAoX2FyZ3MpID0+IHRoaXMuY2xlYXJDb25zb2xlKCksXG4gICAgICAgIGV4ZWN1dGVfc2NyaXB0OiAoYXJncykgPT4gdGhpcy5leGVjdXRlU2NyaXB0KGFyZ3Muc2NyaXB0KSxcbiAgICAgICAgZ2V0X25vZGVfdHJlZTogKGFyZ3MpID0+IHRoaXMuZ2V0Tm9kZVRyZWUoXG4gICAgICAgICAgICBhcmdzLnJvb3RVdWlkLFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MubWF4RGVwdGgpID8/IDEwXG4gICAgICAgICksXG4gICAgICAgIGdldF9wZXJmb3JtYW5jZV9zdGF0czogKF9hcmdzKSA9PiB0aGlzLmdldFBlcmZvcm1hbmNlU3RhdHMoKSxcbiAgICAgICAgdmFsaWRhdGVfc2NlbmU6IChhcmdzKSA9PiB0aGlzLnZhbGlkYXRlU2NlbmUoe1xuICAgICAgICAgICAgY2hlY2tNaXNzaW5nQXNzZXRzOiBjb2VyY2VCb29sKGFyZ3MuY2hlY2tNaXNzaW5nQXNzZXRzKSA/PyB0cnVlLFxuICAgICAgICAgICAgY2hlY2tQZXJmb3JtYW5jZTogY29lcmNlQm9vbChhcmdzLmNoZWNrUGVyZm9ybWFuY2UpID8/IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBnZXRfZWRpdG9yX2luZm86IChfYXJncykgPT4gdGhpcy5nZXRFZGl0b3JJbmZvKCksXG4gICAgICAgIGdldF9wcm9qZWN0X2xvZ3M6IChhcmdzKSA9PiB0aGlzLmdldFByb2plY3RMb2dzKFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MubGluZXMpID8/IDEwMCxcbiAgICAgICAgICAgIGFyZ3MuZmlsdGVyS2V5d29yZCxcbiAgICAgICAgICAgIGFyZ3MubG9nTGV2ZWwgPz8gJ0FMTCdcbiAgICAgICAgKSxcbiAgICAgICAgZ2V0X2xvZ19maWxlX2luZm86IChfYXJncykgPT4gdGhpcy5nZXRMb2dGaWxlSW5mbygpLFxuICAgICAgICBzZWFyY2hfcHJvamVjdF9sb2dzOiAoYXJncykgPT4gdGhpcy5zZWFyY2hQcm9qZWN0TG9ncyhcbiAgICAgICAgICAgIGFyZ3MucGF0dGVybixcbiAgICAgICAgICAgIGNvZXJjZUludChhcmdzLm1heFJlc3VsdHMpID8/IDIwLFxuICAgICAgICAgICAgY29lcmNlSW50KGFyZ3MuY29udGV4dExpbmVzKSA/PyAyXG4gICAgICAgICksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29uc29sZUxvZ3MobGltaXQ6IG51bWJlciwgZmlsdGVyOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgbGV0IGxvZ3MgPSB0aGlzLmNvbnNvbGVNZXNzYWdlcztcblxuICAgICAgICBpZiAoZmlsdGVyICE9PSAnYWxsJykge1xuICAgICAgICAgICAgbG9ncyA9IGxvZ3MuZmlsdGVyKGxvZyA9PiBsb2cudHlwZSA9PT0gZmlsdGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlY2VudExvZ3MgPSBsb2dzLnNsaWNlKC1saW1pdCk7XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgdG90YWw6IGxvZ3MubGVuZ3RoLFxuICAgICAgICAgICAgcmV0dXJuZWQ6IHJlY2VudExvZ3MubGVuZ3RoLFxuICAgICAgICAgICAgbG9nczogcmVjZW50TG9nc1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNsZWFyQ29uc29sZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdGhpcy5jb25zb2xlTWVzc2FnZXMgPSBbXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogRWRpdG9yLk1lc3NhZ2Uuc2VuZCBtYXkgbm90IHJldHVybiBhIHByb21pc2UgaW4gYWxsIHZlcnNpb25zXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5zZW5kKCdjb25zb2xlJywgJ2NsZWFyJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnQ29uc29sZSBjbGVhcmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgdmFsaWRhdGVTY3JpcHQoc2NyaXB0OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCFzY3JpcHQgfHwgdHlwZW9mIHNjcmlwdCAhPT0gJ3N0cmluZycpIHJldHVybiAnc2NyaXB0IGlzIHJlcXVpcmVkJztcbiAgICAgICAgaWYgKHNjcmlwdC5sZW5ndGggPiAxMDI0MCkgcmV0dXJuICdTY3JpcHQgZXhjZWVkcyBtYXhpbXVtIGxlbmd0aCBvZiAxMEtCJztcbiAgICAgICAgY29uc3QgZGFuZ2Vyb3VzID0gW1xuICAgICAgICAgICAgXCJyZXF1aXJlKCdjaGlsZF9wcm9jZXNzJylcIixcbiAgICAgICAgICAgICdyZXF1aXJlKFwiY2hpbGRfcHJvY2Vzc1wiKScsXG4gICAgICAgICAgICAncHJvY2Vzcy5leGl0JyxcbiAgICAgICAgICAgICdldmFsKCcsXG4gICAgICAgICAgICAnRnVuY3Rpb24oJyxcbiAgICAgICAgXTtcbiAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGRhbmdlcm91cykge1xuICAgICAgICAgICAgaWYgKHNjcmlwdC5pbmNsdWRlcyhwYXR0ZXJuKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBgU2NyaXB0IGNvbnRhaW5zIGRpc2FsbG93ZWQgcGF0dGVybjogJHtwYXR0ZXJufWA7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlU2NyaXB0KHNjcmlwdDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHZhbGlkYXRpb25FcnJvciA9IHRoaXMudmFsaWRhdGVTY3JpcHQoc2NyaXB0KTtcbiAgICAgICAgaWYgKHZhbGlkYXRpb25FcnJvcikgcmV0dXJuIGVycm9yUmVzdWx0KHZhbGlkYXRpb25FcnJvcik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyAnbmFtZScgbXVzdCBiZSB0aGUgcmVnaXN0ZXJlZCBwYWNrYWdlIG5hbWUgKHNlZSBwYWNrYWdlLmpzb24gXCJuYW1lXCIpLCBub3QgYW5cbiAgICAgICAgICAgIC8vIGFyYml0cmFyeSBsYWJlbCDigJQgZXhlY3V0ZS1zY2VuZS1zY3JpcHQgcmVzb2x2ZXMgaXQgdG8gdGhlIHBhY2thZ2UncyBzY2VuZS5qc1xuICAgICAgICAgICAgLy8gYW5kIGNhbGxzIHRoZSBuYW1lZCBleHBvcnQuICdjb25zb2xlJyBpcyBub3QgYSByZWdpc3RlcmVkIHBhY2thZ2UsIHNvIHRoaXNcbiAgICAgICAgICAgIC8vIHByZXZpb3VzbHkgYWx3YXlzIHJlamVjdGVkIHdpdGggXCJpbnN0YW5jZSBub3QgZm91bmRcIiBhbmQgZXhlY3V0ZV9zY3JpcHQgd2FzIGRlYWQuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2V2YWwnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFtzY3JpcHRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghcmVzcG9uc2U/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdChyZXNwb25zZT8uZXJyb3IgfHwgJ1NjcmlwdCBleGVjdXRpb24gZmFpbGVkJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgcmVzdWx0OiByZXNwb25zZS5kYXRhPy5yZXN1bHQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1NjcmlwdCBleGVjdXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIHdhcm5pbmc6ICdDb2RlIHdhcyBleGVjdXRlZCBpbiB0aGUgc2NlbmUgY29udGV4dC4gRW5zdXJlIHNjcmlwdHMgYXJlIHRydXN0ZWQgYmVmb3JlIGV4ZWN1dGlvbi4nXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVUcmVlKHJvb3RVdWlkPzogc3RyaW5nLCBtYXhEZXB0aDogbnVtYmVyID0gMTApOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgYnVpbGRUcmVlID0gYXN5bmMgKG5vZGVVdWlkOiBzdHJpbmcsIGRlcHRoOiBudW1iZXIgPSAwKTogUHJvbWlzZTxhbnk+ID0+IHtcbiAgICAgICAgICAgIGlmIChkZXB0aCA+PSBtYXhEZXB0aCkgcmV0dXJuIHsgdHJ1bmNhdGVkOiB0cnVlIH07XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmVlID0ge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlRGF0YS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBub2RlRGF0YS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGVEYXRhLmFjdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogKG5vZGVEYXRhIGFzIGFueSkuY29tcG9uZW50cyA/IChub2RlRGF0YSBhcyBhbnkpLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMuX190eXBlX18pIDogW10sXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkQ291bnQ6IG5vZGVEYXRhLmNoaWxkcmVuID8gbm9kZURhdGEuY2hpbGRyZW4ubGVuZ3RoIDogMCxcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW46IFtdIGFzIGFueVtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuY2hpbGRyZW4gJiYgbm9kZURhdGEuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkSWQgb2Ygbm9kZURhdGEuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyZWUuY2hpbGRyZW4ucHVzaChhd2FpdCBidWlsZFRyZWUoY2hpbGRJZCwgZGVwdGggKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyZWU7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAocm9vdFV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChhd2FpdCBidWlsZFRyZWUocm9vdFV1aWQpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaGllcmFyY2h5OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1oaWVyYXJjaHknKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0cmVlcyA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgcm9vdE5vZGUgb2YgaGllcmFyY2h5LmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyZWVzLnB1c2goYXdhaXQgYnVpbGRUcmVlKHJvb3ROb2RlLnV1aWQpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQodHJlZXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGVyZm9ybWFuY2VTdGF0cygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHN0YXRzOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1wZXJmb3JtYW5jZScpO1xuICAgICAgICAgICAgY29uc3QgcGVyZlN0YXRzOiBQZXJmb3JtYW5jZVN0YXRzID0ge1xuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogc3RhdHMubm9kZUNvdW50IHx8IDAsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50Q291bnQ6IHN0YXRzLmNvbXBvbmVudENvdW50IHx8IDAsXG4gICAgICAgICAgICAgICAgZHJhd0NhbGxzOiBzdGF0cy5kcmF3Q2FsbHMgfHwgMCxcbiAgICAgICAgICAgICAgICB0cmlhbmdsZXM6IHN0YXRzLnRyaWFuZ2xlcyB8fCAwLFxuICAgICAgICAgICAgICAgIG1lbW9yeTogc3RhdHMubWVtb3J5IHx8IHt9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocGVyZlN0YXRzKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1lc3NhZ2U6ICdQZXJmb3JtYW5jZSBzdGF0cyBub3QgYXZhaWxhYmxlIGluIGVkaXQgbW9kZScgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlU2NlbmUob3B0aW9uczogeyBjaGVja01pc3NpbmdBc3NldHM6IGJvb2xlYW47IGNoZWNrUGVyZm9ybWFuY2U6IGJvb2xlYW4gfSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBpc3N1ZXM6IFZhbGlkYXRpb25Jc3N1ZVtdID0gW107XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIENoZWNrIGZvciBtaXNzaW5nIGFzc2V0c1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2hlY2tNaXNzaW5nQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRDaGVjayA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NoZWNrLW1pc3NpbmctYXNzZXRzJyk7XG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0Q2hlY2sgJiYgYXNzZXRDaGVjay5taXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgICAgIGlzc3Vlcy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgRm91bmQgJHthc3NldENoZWNrLm1pc3NpbmcubGVuZ3RofSBtaXNzaW5nIGFzc2V0IHJlZmVyZW5jZXNgLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsczogYXNzZXRDaGVjay5taXNzaW5nXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHBlcmZvcm1hbmNlIGlzc3Vlc1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2hlY2tQZXJmb3JtYW5jZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGhpZXJhcmNoeSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWhpZXJhcmNoeScpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVDb3VudCA9IHRoaXMuY291bnROb2RlcyhoaWVyYXJjaHkuY2hpbGRyZW4pO1xuXG4gICAgICAgICAgICAgICAgaWYgKG5vZGVDb3VudCA+IDEwMDApIHtcbiAgICAgICAgICAgICAgICAgICAgaXNzdWVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6ICdwZXJmb3JtYW5jZScsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgSGlnaCBub2RlIGNvdW50OiAke25vZGVDb3VudH0gbm9kZXMgKHJlY29tbWVuZGVkIDwgMTAwMClgLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbjogJ0NvbnNpZGVyIHVzaW5nIG9iamVjdCBwb29saW5nIG9yIHNjZW5lIG9wdGltaXphdGlvbidcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IFZhbGlkYXRpb25SZXN1bHQgPSB7XG4gICAgICAgICAgICAgICAgdmFsaWQ6IGlzc3Vlcy5sZW5ndGggPT09IDAsXG4gICAgICAgICAgICAgICAgaXNzdWVDb3VudDogaXNzdWVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBpc3N1ZXM6IGlzc3Vlc1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGNvdW50Tm9kZXMobm9kZXM6IGFueVtdKTogbnVtYmVyIHtcbiAgICAgICAgbGV0IGNvdW50ID0gbm9kZXMubGVuZ3RoO1xuICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgY291bnQgKz0gdGhpcy5jb3VudE5vZGVzKG5vZGUuY2hpbGRyZW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb3VudDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEVkaXRvckluZm8oKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGluZm8gPSB7XG4gICAgICAgICAgICBlZGl0b3I6IHtcbiAgICAgICAgICAgICAgICB2ZXJzaW9uOiAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnM/LmVkaXRvciB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgY29jb3NWZXJzaW9uOiAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnM/LmNvY29zIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBwbGF0Zm9ybTogcHJvY2Vzcy5wbGF0Zm9ybSxcbiAgICAgICAgICAgICAgICBhcmNoOiBwcm9jZXNzLmFyY2gsXG4gICAgICAgICAgICAgICAgbm9kZVZlcnNpb246IHByb2Nlc3MudmVyc2lvblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb2plY3Q6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBFZGl0b3IuUHJvamVjdC5uYW1lLFxuICAgICAgICAgICAgICAgIHBhdGg6IEVkaXRvci5Qcm9qZWN0LnBhdGgsXG4gICAgICAgICAgICAgICAgdXVpZDogRWRpdG9yLlByb2plY3QudXVpZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1lbW9yeTogcHJvY2Vzcy5tZW1vcnlVc2FnZSgpLFxuICAgICAgICAgICAgdXB0aW1lOiBwcm9jZXNzLnVwdGltZSgpXG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZXNvbHZlTG9nRmlsZVBhdGgoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgcG9zc2libGVQYXRocyA9IFtcbiAgICAgICAgICAgIEVkaXRvci5Qcm9qZWN0ID8gRWRpdG9yLlByb2plY3QucGF0aCA6IG51bGwsXG4gICAgICAgICAgICBwcm9jZXNzLmN3ZCgpLFxuICAgICAgICBdLmZpbHRlcigocCk6IHAgaXMgc3RyaW5nID0+IHAgIT09IG51bGwpO1xuXG4gICAgICAgIGZvciAoY29uc3QgYmFzZVBhdGggb2YgcG9zc2libGVQYXRocykge1xuICAgICAgICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oYmFzZVBhdGgsICd0ZW1wL2xvZ3MvcHJvamVjdC5sb2cnKTtcbiAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHRlc3RQYXRoKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXN0UGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBQcm9qZWN0IGxvZyBmaWxlIG5vdCBmb3VuZC4gVHJpZWQgcGF0aHM6ICR7cG9zc2libGVQYXRocy5tYXAocCA9PiBwYXRoLmpvaW4ocCwgJ3RlbXAvbG9ncy9wcm9qZWN0LmxvZycpKS5qb2luKCcsICcpfWBcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKiogUmVhZCB1cCB0byBsYXN0IDEwMEtCIG9mIGEgbG9nIGZpbGUgdG8gYXZvaWQgbG9hZGluZyBodWdlIGZpbGVzIGludG8gbWVtb3J5LiAqL1xuICAgIHByaXZhdGUgcmVhZExvZ0ZpbGVUYWlsKGxvZ0ZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBNQVhfQllURVMgPSAxMDAgKiAxMDI0OyAvLyAxMDBLQlxuICAgICAgICBjb25zdCBzdGF0cyA9IGZzLnN0YXRTeW5jKGxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgY29uc3QgZmlsZVNpemUgPSBzdGF0cy5zaXplO1xuICAgICAgICBpZiAoZmlsZVNpemUgPD0gTUFYX0JZVEVTKSB7XG4gICAgICAgICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKGxvZ0ZpbGVQYXRoLCAndXRmOCcpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IEJ1ZmZlci5hbGxvYyhNQVhfQllURVMpO1xuICAgICAgICBjb25zdCBmZCA9IGZzLm9wZW5TeW5jKGxvZ0ZpbGVQYXRoLCAncicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnMucmVhZFN5bmMoZmQsIGJ1ZmZlciwgMCwgTUFYX0JZVEVTLCBmaWxlU2l6ZSAtIE1BWF9CWVRFUyk7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBmcy5jbG9zZVN5bmMoZmQpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFNraXAgdGhlIGZpcnN0IChwb3NzaWJseSBwYXJ0aWFsKSBsaW5lXG4gICAgICAgIGNvbnN0IHJhdyA9IGJ1ZmZlci50b1N0cmluZygndXRmOCcpO1xuICAgICAgICBjb25zdCBuZXdsaW5lSWR4ID0gcmF3LmluZGV4T2YoJ1xcbicpO1xuICAgICAgICByZXR1cm4gbmV3bGluZUlkeCA+PSAwID8gcmF3LnNsaWNlKG5ld2xpbmVJZHggKyAxKSA6IHJhdztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByb2plY3RMb2dzKGxpbmVzOiBudW1iZXIsIGZpbHRlcktleXdvcmQ/OiBzdHJpbmcsIGxvZ0xldmVsOiBzdHJpbmcgPSAnQUxMJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZVBhdGggPSB0aGlzLnJlc29sdmVMb2dGaWxlUGF0aCgpO1xuXG4gICAgICAgICAgICBjb25zdCBsb2dDb250ZW50ID0gdGhpcy5yZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgbG9nTGluZXMgPSBsb2dDb250ZW50LnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLnRyaW0oKSAhPT0gJycpO1xuXG4gICAgICAgICAgICAvLyBHZXQgdGhlIGxhc3QgTiBsaW5lc1xuICAgICAgICAgICAgY29uc3QgcmVjZW50TGluZXMgPSBsb2dMaW5lcy5zbGljZSgtbGluZXMpO1xuXG4gICAgICAgICAgICAvLyBBcHBseSBmaWx0ZXJzXG4gICAgICAgICAgICBsZXQgZmlsdGVyZWRMaW5lcyA9IHJlY2VudExpbmVzO1xuXG4gICAgICAgICAgICBpZiAobG9nTGV2ZWwgIT09ICdBTEwnKSB7XG4gICAgICAgICAgICAgICAgZmlsdGVyZWRMaW5lcyA9IGZpbHRlcmVkTGluZXMuZmlsdGVyKGxpbmUgPT5cbiAgICAgICAgICAgICAgICAgICAgbGluZS5pbmNsdWRlcyhgWyR7bG9nTGV2ZWx9XWApIHx8IGxpbmUuaW5jbHVkZXMobG9nTGV2ZWwudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmlsdGVyS2V5d29yZCkge1xuICAgICAgICAgICAgICAgIGZpbHRlcmVkTGluZXMgPSBmaWx0ZXJlZExpbmVzLmZpbHRlcihsaW5lID0+XG4gICAgICAgICAgICAgICAgICAgIGxpbmUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhmaWx0ZXJLZXl3b3JkLnRvTG93ZXJDYXNlKCkpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHRvdGFsTGluZXM6IGxvZ0xpbmVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICByZXF1ZXN0ZWRMaW5lczogbGluZXMsXG4gICAgICAgICAgICAgICAgZmlsdGVyZWRMaW5lczogZmlsdGVyZWRMaW5lcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgbG9nTGV2ZWw6IGxvZ0xldmVsLFxuICAgICAgICAgICAgICAgIGZpbHRlcktleXdvcmQ6IGZpbHRlcktleXdvcmQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBsb2dzOiBmaWx0ZXJlZExpbmVzLFxuICAgICAgICAgICAgICAgIGxvZ0ZpbGVQYXRoOiBsb2dGaWxlUGF0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHJlYWQgcHJvamVjdCBsb2dzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldExvZ0ZpbGVJbmZvKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZVBhdGggPSB0aGlzLnJlc29sdmVMb2dGaWxlUGF0aCgpO1xuICAgICAgICAgICAgY29uc3Qgc3RhdHMgPSBmcy5zdGF0U3luYyhsb2dGaWxlUGF0aCk7XG4gICAgICAgICAgICAvLyBDb3VudCBsaW5lcyB1c2luZyB0YWlsIHJlYWQgdG8gYXZvaWQgbG9hZGluZyBodWdlIGZpbGVzXG4gICAgICAgICAgICBjb25zdCB0YWlsQ29udGVudCA9IHRoaXMucmVhZExvZ0ZpbGVUYWlsKGxvZ0ZpbGVQYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVDb3VudCA9IHRhaWxDb250ZW50LnNwbGl0KCdcXG4nKS5maWx0ZXIobGluZSA9PiBsaW5lLnRyaW0oKSAhPT0gJycpLmxlbmd0aDtcblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBsb2dGaWxlUGF0aCxcbiAgICAgICAgICAgICAgICBmaWxlU2l6ZTogc3RhdHMuc2l6ZSxcbiAgICAgICAgICAgICAgICBmaWxlU2l6ZUZvcm1hdHRlZDogdGhpcy5mb3JtYXRGaWxlU2l6ZShzdGF0cy5zaXplKSxcbiAgICAgICAgICAgICAgICBsYXN0TW9kaWZpZWQ6IHN0YXRzLm10aW1lLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgbGluZUNvdW50LFxuICAgICAgICAgICAgICAgIGNyZWF0ZWQ6IHN0YXRzLmJpcnRodGltZS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIGFjY2Vzc2libGU6IGZzLmNvbnN0YW50cy5SX09LLFxuICAgICAgICAgICAgICAgIG5vdGU6IHN0YXRzLnNpemUgPiAxMDI0MDAgPyAnRmlsZSBpcyBsYXJnZTsgb25seSBsYXN0IDEwMEtCIGlzIHJlYWQuJyA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBsb2cgZmlsZSBpbmZvOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNlYXJjaFByb2plY3RMb2dzKHBhdHRlcm46IHN0cmluZywgbWF4UmVzdWx0czogbnVtYmVyLCBjb250ZXh0TGluZXM6IG51bWJlcik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbG9nRmlsZVBhdGggPSB0aGlzLnJlc29sdmVMb2dGaWxlUGF0aCgpO1xuXG4gICAgICAgICAgICBjb25zdCBsb2dDb250ZW50ID0gdGhpcy5yZWFkTG9nRmlsZVRhaWwobG9nRmlsZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgbG9nTGluZXMgPSBsb2dDb250ZW50LnNwbGl0KCdcXG4nKTtcblxuICAgICAgICAgICAgLy8gQ3JlYXRlIHJlZ2V4IHBhdHRlcm4gKHN1cHBvcnQgYm90aCBzdHJpbmcgYW5kIHJlZ2V4IHBhdHRlcm5zKVxuICAgICAgICAgICAgbGV0IHJlZ2V4OiBSZWdFeHA7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLCAnZ2knKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIElmIHBhdHRlcm4gaXMgbm90IHZhbGlkIHJlZ2V4LCB0cmVhdCBhcyBsaXRlcmFsIHN0cmluZ1xuICAgICAgICAgICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChwYXR0ZXJuLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyksICdnaScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtYXRjaGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHJlc3VsdENvdW50ID0gMDtcblxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsb2dMaW5lcy5sZW5ndGggJiYgcmVzdWx0Q291bnQgPCBtYXhSZXN1bHRzOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsaW5lID0gbG9nTGluZXNbaV07XG4gICAgICAgICAgICAgICAgaWYgKHJlZ2V4LnRlc3QobGluZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGV4dFN0YXJ0ID0gTWF0aC5tYXgoMCwgaSAtIGNvbnRleHRMaW5lcyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRleHRFbmQgPSBNYXRoLm1pbihsb2dMaW5lcy5sZW5ndGggLSAxLCBpICsgY29udGV4dExpbmVzKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXh0TGluZXNBcnJheSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gY29udGV4dFN0YXJ0OyBqIDw9IGNvbnRleHRFbmQ7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGV4dExpbmVzQXJyYXkucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZU51bWJlcjogaiArIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudDogbG9nTGluZXNbal0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNNYXRjaDogaiA9PT0gaVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbGluZU51bWJlcjogaSArIDEsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkTGluZTogbGluZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRleHQ6IGNvbnRleHRMaW5lc0FycmF5XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdENvdW50Kys7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmVzZXQgcmVnZXggbGFzdEluZGV4IGZvciBnbG9iYWwgc2VhcmNoXG4gICAgICAgICAgICAgICAgICAgIHJlZ2V4Lmxhc3RJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgcGF0dGVybjogcGF0dGVybixcbiAgICAgICAgICAgICAgICB0b3RhbE1hdGNoZXM6IG1hdGNoZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIG1heFJlc3VsdHM6IG1heFJlc3VsdHMsXG4gICAgICAgICAgICAgICAgY29udGV4dExpbmVzOiBjb250ZXh0TGluZXMsXG4gICAgICAgICAgICAgICAgbG9nRmlsZVBhdGg6IGxvZ0ZpbGVQYXRoLFxuICAgICAgICAgICAgICAgIG1hdGNoZXM6IG1hdGNoZXNcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBzZWFyY2ggcHJvamVjdCBsb2dzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGZvcm1hdEZpbGVTaXplKGJ5dGVzOiBudW1iZXIpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCB1bml0cyA9IFsnQicsICdLQicsICdNQicsICdHQiddO1xuICAgICAgICBsZXQgc2l6ZSA9IGJ5dGVzO1xuICAgICAgICBsZXQgdW5pdEluZGV4ID0gMDtcblxuICAgICAgICB3aGlsZSAoc2l6ZSA+PSAxMDI0ICYmIHVuaXRJbmRleCA8IHVuaXRzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHNpemUgLz0gMTAyNDtcbiAgICAgICAgICAgIHVuaXRJbmRleCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGAke3NpemUudG9GaXhlZCgyKX0gJHt1bml0c1t1bml0SW5kZXhdfWA7XG4gICAgfVxufVxuIl19