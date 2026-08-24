import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceBool, coerceInt } from '../utils/normalize';
import { ConsoleMessage, PerformanceStats, ValidationResult, ValidationIssue } from '../types';
import { collectAssetUuids } from '../utils/asset-refs';
import * as fs from 'fs';
import * as path from 'path';

export class ManageDebug extends BaseActionTool {
    readonly name = 'manage_debug';
    readonly description = 'Debug and inspect the editor environment. Actions: get_console_logs, clear_console, execute_script, get_node_tree, get_performance_stats, validate_scene, get_editor_info, get_project_logs, get_log_file_info, search_project_logs. Use get_editor_info for environment details. Use execute_script to run JS in scene context.';
    readonly actions = [
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

    readonly inputSchema = {
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

    /** Lines this file's own tail-read has ever managed to match against. */
    private static readonly LOG_TYPE_PATTERNS: Array<{ type: ConsoleMessage['type']; re: RegExp }> = [
        { type: 'error', re: /\[error\]|(?:^|\s)error:/i },
        { type: 'warn', re: /\[warn(?:ing)?\]|(?:^|\s)warn(?:ing)?:/i },
        { type: 'info', re: /\[info\]|(?:^|\s)info:/i },
    ];

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_console_logs: (args) => this.getConsoleLogs(
            coerceInt(args.limit) ?? 100,
            args.filter ?? 'all'
        ),
        clear_console: (_args) => this.clearConsole(),
        execute_script: (args) => this.executeScript(args.script),
        get_node_tree: (args) => this.getNodeTree(
            args.rootUuid,
            coerceInt(args.maxDepth) ?? 10
        ),
        get_performance_stats: (_args) => this.getPerformanceStats(),
        validate_scene: (args) => this.validateScene({
            checkMissingAssets: coerceBool(args.checkMissingAssets) ?? true,
            checkPerformance: coerceBool(args.checkPerformance) ?? true,
        }),
        get_editor_info: (_args) => this.getEditorInfo(),
        get_project_logs: (args) => this.getProjectLogs(
            coerceInt(args.lines) ?? 100,
            args.filterKeyword,
            args.logLevel ?? 'ALL'
        ),
        get_log_file_info: (_args) => this.getLogFileInfo(),
        search_project_logs: (args) => this.searchProjectLogs(
            args.pattern,
            coerceInt(args.maxResults) ?? 20,
            coerceInt(args.contextLines) ?? 2
        ),
    };

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
    private async getConsoleLogs(limit: number, filter: string): Promise<ActionToolResult> {
        let logFilePath: string;
        try {
            logFilePath = this.resolveLogFilePath();
        } catch (err: any) {
            return errorResult(`Failed to read project logs: ${err.message}`);
        }

        const rawLines = this.readLogFileTail(logFilePath).split('\n').filter(line => line.trim() !== '');
        let logs: ConsoleMessage[] = rawLines.map(line => ({
            timestamp: new Date().toISOString(),
            type: this.classifyLogLine(line),
            message: line
        }));

        if (filter !== 'all') {
            logs = logs.filter(log => log.type === filter);
        }

        const recentLogs = logs.slice(-limit);

        return successResult({
            total: logs.length,
            returned: recentLogs.length,
            logs: recentLogs,
            logFilePath
        });
    }

    /** Classify a project.log line by the same bracket/prefix convention get_project_logs already filters on. */
    private classifyLogLine(line: string): ConsoleMessage['type'] {
        for (const { type, re } of ManageDebug.LOG_TYPE_PATTERNS) {
            if (re.test(line)) return type;
        }
        return 'log';
    }

    private async clearConsole(): Promise<ActionToolResult> {
        try {
            // Note: Editor.Message.send may not return a promise in all versions
            Editor.Message.send('console', 'clear');
            return successResult(null, 'Console cleared successfully. get_console_logs reads temp/logs/project.log directly, which this does not truncate.');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private validateScript(script: string): string | null {
        if (!script || typeof script !== 'string') return 'script is required';
        if (script.length > 10240) return 'Script exceeds maximum length of 10KB';
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

    private async executeScript(script: string): Promise<ActionToolResult> {
        const validationError = this.validateScript(script);
        if (validationError) return errorResult(validationError);
        try {
            // 'name' must be the registered package name (see package.json "name"), not an
            // arbitrary label — execute-scene-script resolves it to the package's scene.js
            // and calls the named export. 'console' is not a registered package, so this
            // previously always rejected with "instance not found" and execute_script was dead.
            const response: any = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server',
                method: 'eval',
                args: [script]
            });
            if (!response?.success) return errorResult(response?.error || 'Script execution failed');
            return successResult({
                result: response.data?.result,
                message: 'Script executed successfully',
                warning: 'Code was executed in the scene context. Ensure scripts are trusted before execution.'
            });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getNodeTree(rootUuid?: string, maxDepth: number = 10): Promise<ActionToolResult> {
        const buildTree = async (nodeUuid: string, depth: number = 0): Promise<any> => {
            if (depth >= maxDepth) return { truncated: true };
            try {
                const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
                const tree = {
                    uuid: nodeData.uuid,
                    name: nodeData.name,
                    active: nodeData.active,
                    components: (nodeData as any).components ? (nodeData as any).components.map((c: any) => c.__type__) : [],
                    childCount: nodeData.children ? nodeData.children.length : 0,
                    children: [] as any[]
                };
                if (nodeData.children && nodeData.children.length > 0) {
                    for (const childId of nodeData.children) {
                        tree.children.push(await buildTree(childId, depth + 1));
                    }
                }
                return tree;
            } catch (err: any) {
                return { error: err.message };
            }
        };

        try {
            if (rootUuid) {
                return successResult(await buildTree(rootUuid));
            } else {
                const hierarchy: any = await Editor.Message.request('scene', 'query-hierarchy');
                const trees = [];
                for (const rootNode of hierarchy.children) {
                    trees.push(await buildTree(rootNode.uuid));
                }
                return successResult(trees);
            }
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getPerformanceStats(): Promise<ActionToolResult> {
        try {
            const stats: any = await Editor.Message.request('scene', 'query-performance');
            const perfStats: PerformanceStats = {
                nodeCount: stats.nodeCount || 0,
                componentCount: stats.componentCount || 0,
                drawCalls: stats.drawCalls || 0,
                triangles: stats.triangles || 0,
                memory: stats.memory || {}
            };
            return successResult(perfStats);
        } catch {
            return successResult({ message: 'Performance stats not available in edit mode' });
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
    private async validateScene(options: { checkMissingAssets: boolean; checkPerformance: boolean }): Promise<ActionToolResult> {
        const issues: ValidationIssue[] = [];
        const checks: Record<string, string> = {};

        if (options.checkMissingAssets) {
            const native = await this.checkMissingAssetsNative();
            if (native.supported) {
                checks.missingAssets = 'native';
                issues.push(...native.issues);
            } else {
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

        const result: ValidationResult = {
            valid: issues.filter(i => i.type === 'error').length === 0,
            issueCount: issues.length,
            issues
        };
        return successResult({ ...result, checks });
    }

    /** Try the editor's own missing-asset check. 3.8.7 does not register it. */
    private async checkMissingAssetsNative(): Promise<{ supported: boolean; issues: ValidationIssue[] }> {
        try {
            const assetCheck: any = await (Editor.Message.request as any)('scene', 'check-missing-assets');
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
        } catch {
            return { supported: false, issues: [] };
        }
    }

    /**
     * Version-independent fallback: walk the scene's node dumps, collect every asset
     * UUID referenced by a component property, and report the ones the asset DB cannot
     * resolve. Same `ValidationIssue` shape as the native path.
     */
    private async scanMissingAssetReferences(): Promise<{ issues: ValidationIssue[]; error?: string }> {
        let rootUuids: string[];
        try {
            rootUuids = await this.collectSceneNodeUuids();
        } catch (err: any) {
            return { issues: [], error: `cannot enumerate scene nodes (${err?.message || err})` };
        }

        const referencedBy = new Map<string, Set<string>>();
        for (const nodeUuid of rootUuids) {
            let nodeData: any;
            try {
                nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            } catch {
                continue;
            }
            const nodeName = nodeData?.name?.value ?? nodeData?.name ?? nodeUuid;
            for (const comp of (nodeData?.__comps__ ?? [])) {
                const compType = comp.__type__ || comp.cid || comp.type || 'Unknown';
                for (const uuid of collectAssetUuids(comp.value ?? comp)) {
                    if (!referencedBy.has(uuid)) referencedBy.set(uuid, new Set());
                    referencedBy.get(uuid)!.add(`${nodeName} → ${compType}`);
                }
            }
        }

        const missing: Array<{ uuid: string; referencedBy: string[] }> = [];
        for (const [uuid, holders] of referencedBy) {
            let info: any = null;
            try {
                info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
            } catch {
                info = null;
            }
            if (!info) missing.push({ uuid, referencedBy: [...holders] });
        }

        if (!missing.length) return { issues: [] };
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
    private async collectSceneNodeUuids(): Promise<string[]> {
        const tree: any = await Editor.Message.request('scene', 'query-node-tree');
        const roots: any[] = Array.isArray(tree) ? tree : (tree ? [tree] : []);
        const uuids: string[] = [];
        const walk = (node: any) => {
            if (!node) return;
            if (typeof node.uuid === 'string') uuids.push(node.uuid);
            for (const child of (node.children ?? [])) walk(child);
        };
        roots.forEach(walk);
        return uuids;
    }

    private async checkNodeCount(): Promise<{ issues: ValidationIssue[]; error?: string }> {
        let nodeCount: number;
        try {
            nodeCount = (await this.collectSceneNodeUuids()).length;
        } catch (err: any) {
            return { issues: [], error: `cannot enumerate scene nodes (${err?.message || err})` };
        }
        if (nodeCount <= 1000) return { issues: [] };
        return {
            issues: [{
                type: 'warning',
                category: 'performance',
                message: `High node count: ${nodeCount} nodes (recommended < 1000)`,
                suggestion: 'Consider using object pooling or scene optimization'
            }]
        };
    }

    private async getEditorInfo(): Promise<ActionToolResult> {
        const info = {
            editor: {
                version: (Editor as any).versions?.editor || 'Unknown',
                cocosVersion: (Editor as any).versions?.cocos || 'Unknown',
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

        return successResult(info);
    }

    private resolveLogFilePath(): string {
        const possiblePaths = [
            Editor.Project ? Editor.Project.path : null,
            process.cwd(),
        ].filter((p): p is string => p !== null);

        for (const basePath of possiblePaths) {
            const testPath = path.join(basePath, 'temp/logs/project.log');
            if (fs.existsSync(testPath)) {
                return testPath;
            }
        }

        throw new Error(
            `Project log file not found. Tried paths: ${possiblePaths.map(p => path.join(p, 'temp/logs/project.log')).join(', ')}`
        );
    }

    /** Read up to last 100KB of a log file to avoid loading huge files into memory. */
    private readLogFileTail(logFilePath: string): string {
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
        } finally {
            fs.closeSync(fd);
        }
        // Skip the first (possibly partial) line
        const raw = buffer.toString('utf8');
        const newlineIdx = raw.indexOf('\n');
        return newlineIdx >= 0 ? raw.slice(newlineIdx + 1) : raw;
    }

    private async getProjectLogs(lines: number, filterKeyword?: string, logLevel: string = 'ALL'): Promise<ActionToolResult> {
        try {
            const logFilePath = this.resolveLogFilePath();

            const logContent = this.readLogFileTail(logFilePath);
            const logLines = logContent.split('\n').filter(line => line.trim() !== '');

            // Get the last N lines
            const recentLines = logLines.slice(-lines);

            // Apply filters
            let filteredLines = recentLines;

            if (logLevel !== 'ALL') {
                filteredLines = filteredLines.filter(line =>
                    line.includes(`[${logLevel}]`) || line.includes(logLevel.toLowerCase())
                );
            }

            if (filterKeyword) {
                filteredLines = filteredLines.filter(line =>
                    line.toLowerCase().includes(filterKeyword.toLowerCase())
                );
            }

            return successResult({
                totalLines: logLines.length,
                requestedLines: lines,
                filteredLines: filteredLines.length,
                logLevel: logLevel,
                filterKeyword: filterKeyword || null,
                logs: filteredLines,
                logFilePath: logFilePath
            });
        } catch (error: any) {
            return errorResult(`Failed to read project logs: ${error.message}`);
        }
    }

    private async getLogFileInfo(): Promise<ActionToolResult> {
        try {
            const logFilePath = this.resolveLogFilePath();
            const stats = fs.statSync(logFilePath);
            // Count lines using tail read to avoid loading huge files
            const tailContent = this.readLogFileTail(logFilePath);
            const lineCount = tailContent.split('\n').filter(line => line.trim() !== '').length;

            return successResult({
                filePath: logFilePath,
                fileSize: stats.size,
                fileSizeFormatted: this.formatFileSize(stats.size),
                lastModified: stats.mtime.toISOString(),
                lineCount,
                created: stats.birthtime.toISOString(),
                accessible: fs.constants.R_OK,
                note: stats.size > 102400 ? 'File is large; only last 100KB is read.' : undefined
            });
        } catch (error: any) {
            return errorResult(`Failed to get log file info: ${error.message}`);
        }
    }

    private async searchProjectLogs(pattern: string, maxResults: number, contextLines: number): Promise<ActionToolResult> {
        try {
            const logFilePath = this.resolveLogFilePath();

            const logContent = this.readLogFileTail(logFilePath);
            const logLines = logContent.split('\n');

            // Create regex pattern (support both string and regex patterns)
            let regex: RegExp;
            try {
                regex = new RegExp(pattern, 'gi');
            } catch {
                // If pattern is not valid regex, treat as literal string
                regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            }

            const matches: any[] = [];
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

            return successResult({
                pattern: pattern,
                totalMatches: matches.length,
                maxResults: maxResults,
                contextLines: contextLines,
                logFilePath: logFilePath,
                matches: matches
            });
        } catch (error: any) {
            return errorResult(`Failed to search project logs: ${error.message}`);
        }
    }

    private formatFileSize(bytes: number): string {
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
