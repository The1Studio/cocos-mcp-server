import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceBool, coerceInt } from '../utils/normalize';
import { ConsoleMessage, PerformanceStats, ValidationResult, ValidationIssue } from '../types';
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

    // State preserved from DebugTools
    private consoleMessages: ConsoleMessage[] = [];
    private readonly maxMessages = 1000;

    constructor() {
        super();
        this.setupConsoleCapture();
    }

    private setupConsoleCapture(): void {
        // Intercept Editor console messages
        // Note: Editor.Message.addBroadcastListener may not be available in all versions
        // This is a placeholder for console capture implementation
        console.log('Console capture setup - implementation depends on Editor API availability');
    }

    private addConsoleMessage(message: any): void {
        this.consoleMessages.push({
            timestamp: new Date().toISOString(),
            ...message
        });

        // Keep only latest messages
        if (this.consoleMessages.length > this.maxMessages) {
            this.consoleMessages.shift();
        }
    }

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

    private async getConsoleLogs(limit: number, filter: string): Promise<ActionToolResult> {
        let logs = this.consoleMessages;

        if (filter !== 'all') {
            logs = logs.filter(log => log.type === filter);
        }

        const recentLogs = logs.slice(-limit);

        return successResult({
            total: logs.length,
            returned: recentLogs.length,
            logs: recentLogs
        });
    }

    private async clearConsole(): Promise<ActionToolResult> {
        this.consoleMessages = [];

        try {
            // Note: Editor.Message.send may not return a promise in all versions
            Editor.Message.send('console', 'clear');
            return successResult(null, 'Console cleared successfully');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async executeScript(script: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-scene-script', {
                name: 'console',
                method: 'eval',
                args: [script]
            }).then((result: any) => {
                resolve(successResult({
                    result: result,
                    message: 'Script executed successfully'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getNodeTree(rootUuid?: string, maxDepth: number = 10): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const buildTree = async (nodeUuid: string, depth: number = 0): Promise<any> => {
                if (depth >= maxDepth) {
                    return { truncated: true };
                }

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
                            const childTree = await buildTree(childId, depth + 1);
                            tree.children.push(childTree);
                        }
                    }

                    return tree;
                } catch (err: any) {
                    return { error: err.message };
                }
            };

            if (rootUuid) {
                buildTree(rootUuid).then(tree => {
                    resolve(successResult(tree));
                });
            } else {
                Editor.Message.request('scene', 'query-hierarchy').then(async (hierarchy: any) => {
                    const trees = [];
                    for (const rootNode of hierarchy.children) {
                        const tree = await buildTree(rootNode.uuid);
                        trees.push(tree);
                    }
                    resolve(successResult(trees));
                }).catch((err: Error) => {
                    resolve(errorResult(err.message));
                });
            }
        });
    }

    private async getPerformanceStats(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-performance').then((stats: any) => {
                const perfStats: PerformanceStats = {
                    nodeCount: stats.nodeCount || 0,
                    componentCount: stats.componentCount || 0,
                    drawCalls: stats.drawCalls || 0,
                    triangles: stats.triangles || 0,
                    memory: stats.memory || {}
                };
                resolve(successResult(perfStats));
            }).catch(() => {
                // Fallback to basic stats
                resolve(successResult({
                    message: 'Performance stats not available in edit mode'
                }));
            });
        });
    }

    private async validateScene(options: { checkMissingAssets: boolean; checkPerformance: boolean }): Promise<ActionToolResult> {
        const issues: ValidationIssue[] = [];

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

            const result: ValidationResult = {
                valid: issues.length === 0,
                issueCount: issues.length,
                issues: issues
            };

            return successResult(result);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private countNodes(nodes: any[]): number {
        let count = nodes.length;
        for (const node of nodes) {
            if (node.children) {
                count += this.countNodes(node.children);
            }
        }
        return count;
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
            '/Users/lizhiyong/NewProject_3',
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

    private async getProjectLogs(lines: number, filterKeyword?: string, logLevel: string = 'ALL'): Promise<ActionToolResult> {
        try {
            const logFilePath = this.resolveLogFilePath();

            const logContent = fs.readFileSync(logFilePath, 'utf8');
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
            const logContent = fs.readFileSync(logFilePath, 'utf8');
            const lineCount = logContent.split('\n').filter(line => line.trim() !== '').length;

            return successResult({
                filePath: logFilePath,
                fileSize: stats.size,
                fileSizeFormatted: this.formatFileSize(stats.size),
                lastModified: stats.mtime.toISOString(),
                lineCount: lineCount,
                created: stats.birthtime.toISOString(),
                accessible: fs.constants.R_OK
            });
        } catch (error: any) {
            return errorResult(`Failed to get log file info: ${error.message}`);
        }
    }

    private async searchProjectLogs(pattern: string, maxResults: number, contextLines: number): Promise<ActionToolResult> {
        try {
            const logFilePath = this.resolveLogFilePath();

            const logContent = fs.readFileSync(logFilePath, 'utf8');
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
