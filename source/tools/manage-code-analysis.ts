import * as fs from 'fs';
import * as path from 'path';
import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';

/** Directories to skip during code scanning */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'temp', 'library', 'build', 'native']);

/**
 * General-purpose code pattern scanning and analysis tool.
 * Scan project files for import patterns, arbitrary regex, file statistics, and module references.
 */
export class ManageCodeAnalysis extends BaseActionTool {
    readonly name = 'manage_code_analysis';
    readonly description = 'Scan and analyze project code. Actions: scan_imports, scan_patterns, get_file_stats, find_references.';
    readonly actions = ['scan_imports', 'scan_patterns', 'get_file_stats', 'find_references'];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: { type: 'string', description: 'Action to perform', enum: this.actions },
            pattern: { type: 'string', description: 'Regex pattern to search for (scan_imports, scan_patterns)' },
            directory: { type: 'string', description: 'Directory to scan relative to project root (default: "assets")' },
            extensions: { type: 'array', items: { type: 'string' }, description: 'File extensions to include (default: [".ts"])', default: ['.ts'] },
            name: { type: 'string', description: 'Module/class name to find references for (find_references)' },
            maxResults: { type: 'number', description: 'Maximum results to return', default: 100 }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        scan_imports: (args) => this.scanImports(args.pattern, args.directory, args.maxResults),
        scan_patterns: (args) => this.scanPatterns(args.pattern, args.directory, args.extensions, args.maxResults),
        get_file_stats: (args) => this.getFileStats(args.directory),
        find_references: (args) => this.findReferences(args.name, args.directory, args.extensions, args.maxResults)
    };

    /** Recursively walk files with extension filter, skipping non-source directories */
    private walkFiles(dir: string, extensions?: string[]): string[] {
        const results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...this.walkFiles(fullPath, extensions));
            } else if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
                results.push(fullPath);
            }
        }
        return results;
    }

    /** Resolve directory relative to project root */
    private resolveDir(directory?: string): string {
        return path.join(Editor.Project.path, directory || 'assets');
    }

    /** Create regex safely, return error message on invalid pattern */
    private createRegex(pattern: string): RegExp | string {
        try { return new RegExp(pattern); }
        catch (e: any) { return `Invalid regex: ${e.message}`; }
    }

    private async scanImports(pattern: string, directory?: string, maxResults: number = 100): Promise<ActionToolResult> {
        if (!pattern) return errorResult('pattern is required');
        const regex = this.createRegex(pattern);
        if (typeof regex === 'string') return errorResult(regex);
        const dir = this.resolveDir(directory);
        const files = this.walkFiles(dir, ['.ts', '.js']);
        const matches: any[] = [];

        for (const file of files) {
            if (matches.length >= maxResults) break;
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (matches.length >= maxResults) break;
                const line = lines[i].trim();
                if (line.startsWith('import') && regex.test(line)) {
                    matches.push({
                        file: path.relative(Editor.Project.path, file),
                        lineNumber: i + 1,
                        line: line
                    });
                }
            }
        }
        return successResult({ matches, total: matches.length, capped: matches.length >= maxResults },
            `Found ${matches.length} import matches for pattern "${pattern}"`);
    }

    private async scanPatterns(pattern: string, directory?: string, extensions?: string[], maxResults: number = 100): Promise<ActionToolResult> {
        if (!pattern) return errorResult('pattern is required');
        const regex = this.createRegex(pattern);
        if (typeof regex === 'string') return errorResult(regex);
        const dir = this.resolveDir(directory);
        const exts = extensions?.length ? extensions : ['.ts'];
        const files = this.walkFiles(dir, exts);
        const matches: any[] = [];

        for (const file of files) {
            if (matches.length >= maxResults) break;
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (matches.length >= maxResults) break;
                if (regex.test(lines[i])) {
                    matches.push({
                        file: path.relative(Editor.Project.path, file),
                        lineNumber: i + 1,
                        line: lines[i].trim()
                    });
                }
            }
        }
        return successResult({ matches, total: matches.length, capped: matches.length >= maxResults },
            `Found ${matches.length} matches for pattern "${pattern}"`);
    }

    private async getFileStats(directory?: string): Promise<ActionToolResult> {
        const dir = this.resolveDir(directory);
        const files = this.walkFiles(dir);
        const stats: Record<string, { count: number; totalBytes: number }> = {};
        let totalFiles = 0, totalBytes = 0;

        for (const file of files) {
            const ext = path.extname(file) || '(no extension)';
            const size = fs.statSync(file).size;
            if (!stats[ext]) stats[ext] = { count: 0, totalBytes: 0 };
            stats[ext].count++;
            stats[ext].totalBytes += size;
            totalFiles++;
            totalBytes += size;
        }

        const byExtension = Object.entries(stats)
            .map(([ext, s]) => ({ extension: ext, count: s.count, totalBytes: s.totalBytes, totalKB: +(s.totalBytes / 1024).toFixed(1) }))
            .sort((a, b) => b.totalBytes - a.totalBytes);

        return successResult({
            byExtension,
            summary: { totalFiles, totalBytes, totalKB: +(totalBytes / 1024).toFixed(1) }
        }, `Scanned ${totalFiles} files in ${directory || 'assets'}`);
    }

    private async findReferences(name: string, directory?: string, extensions?: string[], maxResults: number = 100): Promise<ActionToolResult> {
        if (!name) return errorResult('name is required');
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const dir = this.resolveDir(directory);
        const exts = extensions?.length ? extensions : ['.ts'];
        const files = this.walkFiles(dir, exts);
        const matches: any[] = [];

        for (const file of files) {
            if (matches.length >= maxResults) break;
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            const fileMatches: any[] = [];
            for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                    fileMatches.push({ lineNumber: i + 1, line: lines[i].trim() });
                }
            }
            if (fileMatches.length > 0) {
                matches.push({
                    file: path.relative(Editor.Project.path, file),
                    occurrences: fileMatches.length,
                    lines: fileMatches.slice(0, 5) // first 5 matches per file
                });
            }
        }
        return successResult({ matches, totalFiles: matches.length, capped: matches.length >= maxResults },
            `Found "${name}" in ${matches.length} files`);
    }
}
