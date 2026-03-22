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
exports.ManageCodeAnalysis = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
const base_action_tool_1 = require("./base-action-tool");
/** Directories to skip during code scanning */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'temp', 'library', 'build', 'native']);
/**
 * General-purpose code pattern scanning and analysis tool.
 * Scan project files for import patterns, arbitrary regex, file statistics, and module references.
 */
class ManageCodeAnalysis extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_code_analysis';
        this.description = 'Scan and analyze project code. Actions: scan_imports, scan_patterns, get_file_stats, find_references.';
        this.actions = ['scan_imports', 'scan_patterns', 'get_file_stats', 'find_references'];
        this.inputSchema = {
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
        this.actionHandlers = {
            scan_imports: (args) => this.scanImports(args.pattern, args.directory, args.maxResults),
            scan_patterns: (args) => this.scanPatterns(args.pattern, args.directory, args.extensions, args.maxResults),
            get_file_stats: (args) => this.getFileStats(args.directory),
            find_references: (args) => this.findReferences(args.name, args.directory, args.extensions, args.maxResults)
        };
    }
    /** Recursively walk files with extension filter, skipping non-source directories */
    walkFiles(dir, extensions) {
        const results = [];
        if (!fs.existsSync(dir))
            return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...this.walkFiles(fullPath, extensions));
            }
            else if (!extensions || extensions.some(ext => entry.name.endsWith(ext))) {
                results.push(fullPath);
            }
        }
        return results;
    }
    /** Resolve directory relative to project root */
    resolveDir(directory) {
        return path.join(Editor.Project.path, directory || 'assets');
    }
    /** Create regex safely, return error message on invalid pattern */
    createRegex(pattern) {
        try {
            return new RegExp(pattern);
        }
        catch (e) {
            return `Invalid regex: ${e.message}`;
        }
    }
    async scanImports(pattern, directory, maxResults = 100) {
        if (!pattern)
            return (0, types_1.errorResult)('pattern is required');
        const regex = this.createRegex(pattern);
        if (typeof regex === 'string')
            return (0, types_1.errorResult)(regex);
        const dir = this.resolveDir(directory);
        const files = this.walkFiles(dir, ['.ts', '.js']);
        const matches = [];
        for (const file of files) {
            if (matches.length >= maxResults)
                break;
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (matches.length >= maxResults)
                    break;
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
        return (0, types_1.successResult)({ matches, total: matches.length, capped: matches.length >= maxResults }, `Found ${matches.length} import matches for pattern "${pattern}"`);
    }
    async scanPatterns(pattern, directory, extensions, maxResults = 100) {
        if (!pattern)
            return (0, types_1.errorResult)('pattern is required');
        const regex = this.createRegex(pattern);
        if (typeof regex === 'string')
            return (0, types_1.errorResult)(regex);
        const dir = this.resolveDir(directory);
        const exts = (extensions === null || extensions === void 0 ? void 0 : extensions.length) ? extensions : ['.ts'];
        const files = this.walkFiles(dir, exts);
        const matches = [];
        for (const file of files) {
            if (matches.length >= maxResults)
                break;
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (matches.length >= maxResults)
                    break;
                if (regex.test(lines[i])) {
                    matches.push({
                        file: path.relative(Editor.Project.path, file),
                        lineNumber: i + 1,
                        line: lines[i].trim()
                    });
                }
            }
        }
        return (0, types_1.successResult)({ matches, total: matches.length, capped: matches.length >= maxResults }, `Found ${matches.length} matches for pattern "${pattern}"`);
    }
    async getFileStats(directory) {
        const dir = this.resolveDir(directory);
        const files = this.walkFiles(dir);
        const stats = {};
        let totalFiles = 0, totalBytes = 0;
        for (const file of files) {
            const ext = path.extname(file) || '(no extension)';
            const size = fs.statSync(file).size;
            if (!stats[ext])
                stats[ext] = { count: 0, totalBytes: 0 };
            stats[ext].count++;
            stats[ext].totalBytes += size;
            totalFiles++;
            totalBytes += size;
        }
        const byExtension = Object.entries(stats)
            .map(([ext, s]) => ({ extension: ext, count: s.count, totalBytes: s.totalBytes, totalKB: +(s.totalBytes / 1024).toFixed(1) }))
            .sort((a, b) => b.totalBytes - a.totalBytes);
        return (0, types_1.successResult)({
            byExtension,
            summary: { totalFiles, totalBytes, totalKB: +(totalBytes / 1024).toFixed(1) }
        }, `Scanned ${totalFiles} files in ${directory || 'assets'}`);
    }
    async findReferences(name, directory, extensions, maxResults = 100) {
        if (!name)
            return (0, types_1.errorResult)('name is required');
        const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        const dir = this.resolveDir(directory);
        const exts = (extensions === null || extensions === void 0 ? void 0 : extensions.length) ? extensions : ['.ts'];
        const files = this.walkFiles(dir, exts);
        const matches = [];
        for (const file of files) {
            if (matches.length >= maxResults)
                break;
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            const fileMatches = [];
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
        return (0, types_1.successResult)({ matches, totalFiles: matches.length, capped: matches.length >= maxResults }, `Found "${name}" in ${matches.length} files`);
    }
}
exports.ManageCodeAnalysis = ManageCodeAnalysis;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvZGUtYW5hbHlzaXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvZGUtYW5hbHlzaXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QixvQ0FBd0U7QUFDeEUseURBQW9EO0FBRXBELCtDQUErQztBQUMvQyxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLGNBQWMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFFbEc7OztHQUdHO0FBQ0gsTUFBYSxrQkFBbUIsU0FBUSxpQ0FBYztJQUF0RDs7UUFDYSxTQUFJLEdBQUcsc0JBQXNCLENBQUM7UUFDOUIsZ0JBQVcsR0FBRyx1R0FBdUcsQ0FBQztRQUN0SCxZQUFPLEdBQUcsQ0FBQyxjQUFjLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFFakYsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDaEYsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsMkRBQTJELEVBQUU7Z0JBQ3JHLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGdFQUFnRSxFQUFFO2dCQUM1RyxVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxXQUFXLEVB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QVUsSUFBSSxRQUFRLE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELENBQUM7Q0FDSjtBQXBLRCxnREFvS0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5cbi8qKiBEaXJlY3RvcmllcyB0byBza2lwIGR1cmluZyBjb2RlIHNjYW5uaW5nICovXG5jb25zdCBTS0lQX0RJUlMgPSBuZXcgU2V0KFsnbm9kZV9tb2R1bGVzJywgJy5naXQnLCAnZGlzdCcsICd0ZW1wJywgJ2xpYnJhcnknLCAnYnVpbGQnLCAnbmF0aXZlJ10pO1xuXG4vKipcbiAqIEdlbmVyYWwtcHVycG9zZSBjb2RlIHBhdHRlcm4gc2Nhbm5pbmcgYW5kIGFuYWx5c2lzIHRvb2wuXG4gKiBTY2FuIHByb2plY3QgZmlsZXMgZm9yIGltcG9ydCBwYXR0ZXJucywgYXJiaXRyYXJ5IHJlZ2V4LCBmaWxlIHN0YXRpc3RpY3MsIGFuZCBtb2R1bGUgcmVmZXJlbmNlcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZUNvZGVBbmFseXNpcyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9jb2RlX2FuYWx5c2lzJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdTY2FuIGFuZCBhbmFseXplIHByb2plY3QgY29kZS4gQWN0aW9uczogc2Nhbl9pbXBvcnRzLCBzY2FuX3BhdHRlcm5zLCBnZXRfZmlsZV9zdGF0cywgZmluZF9yZWZlcmVuY2VzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnc2Nhbl9pbXBvcnRzJywgJ3NjYW5fcGF0dGVybnMnLCAnZ2V0X2ZpbGVfc3RhdHMnLCAnZmluZF9yZWZlcmVuY2VzJ107XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybScsIGVudW06IHRoaXMuYWN0aW9ucyB9LFxuICAgICAgICAgICAgcGF0dGVybjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdSZWdleCBwYXR0ZXJuIHRvIHNlYXJjaCBmb3IgKHNjYW5faW1wb3J0cywgc2Nhbl9wYXR0ZXJucyknIH0sXG4gICAgICAgICAgICBkaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRGlyZWN0b3J5IHRvIHNjYW4gcmVsYXRpdmUgdG8gcHJvamVjdCByb290IChkZWZhdWx0OiBcImFzc2V0c1wiKScgfSxcbiAgICAgICAgICAgIGV4dGVuc2lvbnM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdGaWxlIGV4dGVuc2lvbnMgdG8gaW5jbHVkZSAoZGVmYXVsdDogW1wiLnRzXCJdKScsIGRlZmF1bHQ6IFsnLnRzJ10gfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnTW9kdWxlL2NsYXNzIG5hbWUgdG8gZmluZCByZWZlcmVuY2VzIGZvciAoZmluZF9yZWZlcmVuY2VzKScgfSxcbiAgICAgICAgICAgIG1heFJlc3VsdHM6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnTWF4aW11bSByZXN1bHRzIHRvIHJldHVybicsIGRlZmF1bHQ6IDEwMCB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBzY2FuX2ltcG9ydHM6IChhcmdzKSA9PiB0aGlzLnNjYW5JbXBvcnRzKGFyZ3MucGF0dGVybiwgYXJncy5kaXJlY3RvcnksIGFyZ3MubWF4UmVzdWx0cyksXG4gICAgICAgIHNjYW5fcGF0dGVybnM6IChhcmdzKSA9PiB0aGlzLnNjYW5QYXR0ZXJucyhhcmdzLnBhdHRlcm4sIGFyZ3MuZGlyZWN0b3J5LCBhcmdzLmV4dGVuc2lvbnMsIGFyZ3MubWF4UmVzdWx0cyksXG4gICAgICAgIGdldF9maWxlX3N0YXRzOiAoYXJncykgPT4gdGhpcy5nZXRGaWxlU3RhdHMoYXJncy5kaXJlY3RvcnkpLFxuICAgICAgICBmaW5kX3JlZmVyZW5jZXM6IChhcmdzKSA9PiB0aGlzLmZpbmRSZWZlcmVuY2VzKGFyZ3MubmFtZSwgYXJncy5kaXJlY3RvcnksIGFyZ3MuZXh0ZW5zaW9ucywgYXJncy5tYXhSZXN1bHRzKVxuICAgIH07XG5cbiAgICAvKiogUmVjdXJzaXZlbHkgd2FsayBmaWxlcyB3aXRoIGV4dGVuc2lvbiBmaWx0ZXIsIHNraXBwaW5nIG5vbi1zb3VyY2UgZGlyZWN0b3JpZXMgKi9cbiAgICBwcml2YXRlIHdhbGtGaWxlcyhkaXI6IHN0cmluZywgZXh0ZW5zaW9ucz86IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyKSkgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG4gICAgICAgICAgICBpZiAoU0tJUF9ESVJTLmhhcyhlbnRyeS5uYW1lKSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goLi4udGhpcy53YWxrRmlsZXMoZnVsbFBhdGgsIGV4dGVuc2lvbnMpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWV4dGVuc2lvbnMgfHwgZXh0ZW5zaW9ucy5zb21lKGV4dCA9PiBlbnRyeS5uYW1lLmVuZHNXaXRoKGV4dCkpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG5cbiAgICAvKiogUmVzb2x2ZSBkaXJlY3RvcnkgcmVsYXRpdmUgdG8gcHJvamVjdCByb290ICovXG4gICAgcHJpdmF0ZSByZXNvbHZlRGlyKGRpcmVjdG9yeT86IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oRWRpdG9yLlByb2plY3QucGF0aCwgZGlyZWN0b3J5IHx8ICdhc3NldHMnKTtcbiAgICB9XG5cbiAgICAvKiogQ3JlYXRlIHJlZ2V4IHNhZmVseSwgcmV0dXJuIGVycm9yIG1lc3NhZ2Ugb24gaW52YWxpZCBwYXR0ZXJuICovXG4gICAgcHJpdmF0ZSBjcmVhdGVSZWdleChwYXR0ZXJuOiBzdHJpbmcpOiBSZWdFeHAgfCBzdHJpbmcge1xuICAgICAgICB0cnkgeyByZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuKTsgfVxuICAgICAgICBjYXRjaCAoZTogYW55KSB7IHJldHVybiBgSW52YWxpZCByZWdleDogJHtlLm1lc3NhZ2V9YDsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2NhbkltcG9ydHMocGF0dGVybjogc3RyaW5nLCBkaXJlY3Rvcnk/OiBzdHJpbmcsIG1heFJlc3VsdHM6IG51bWJlciA9IDEwMCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXBhdHRlcm4pIHJldHVybiBlcnJvclJlc3VsdCgncGF0dGVybiBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZWdleCA9IHRoaXMuY3JlYXRlUmVnZXgocGF0dGVybik7XG4gICAgICAgIGlmICh0eXBlb2YgcmVnZXggPT09ICdzdHJpbmcnKSByZXR1cm4gZXJyb3JSZXN1bHQocmVnZXgpO1xuICAgICAgICBjb25zdCBkaXIgPSB0aGlzLnJlc29sdmVEaXIoZGlyZWN0b3J5KTtcbiAgICAgICAgY29uc3QgZmlsZXMgPSB0aGlzLndhbGtGaWxlcyhkaXIsIFsnLnRzJywgJy5qcyddKTtcbiAgICAgICAgY29uc3QgbWF0Y2hlczogYW55W10gPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaGVzLmxlbmd0aCA+PSBtYXhSZXN1bHRzKSBicmVhaztcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMubGVuZ3RoID49IG1heFJlc3VsdHMpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmUgPSBsaW5lc1tpXS50cmltKCk7XG4gICAgICAgICAgICAgICAgaWYgKGxpbmUuc3RhcnRzV2l0aCgnaW1wb3J0JykgJiYgcmVnZXgudGVzdChsaW5lKSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZTogcGF0aC5yZWxhdGl2ZShFZGl0b3IuUHJvamVjdC5wYXRoLCBmaWxlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGkgKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBtYXRjaGVzLCB0b3RhbDogbWF0Y2hlcy5sZW5ndGgsIGNhcHBlZDogbWF0Y2hlcy5sZW5ndGggPj0gbWF4UmVzdWx0cyB9LFxuICAgICAgICAgICAgYEZvdW5kICR7bWF0Y2hlcy5sZW5ndGh9IGltcG9ydCBtYXRjaGVzIGZvciBwYXR0ZXJuIFwiJHtwYXR0ZXJufVwiYCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzY2FuUGF0dGVybnMocGF0dGVybjogc3RyaW5nLCBkaXJlY3Rvcnk/OiBzdHJpbmcsIGV4dGVuc2lvbnM/OiBzdHJpbmdbXSwgbWF4UmVzdWx0czogbnVtYmVyID0gMTAwKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghcGF0dGVybikgcmV0dXJuIGVycm9yUmVzdWx0KCdwYXR0ZXJuIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlZ2V4ID0gdGhpcy5jcmVhdGVSZWdleChwYXR0ZXJuKTtcbiAgICAgICAgaWYgKHR5cGVvZiByZWdleCA9PT0gJ3N0cmluZycpIHJldHVybiBlcnJvclJlc3VsdChyZWdleCk7XG4gICAgICAgIGNvbnN0IGRpciA9IHRoaXMucmVzb2x2ZURpcihkaXJlY3RvcnkpO1xuICAgICAgICBjb25zdCBleHRzID0gZXh0ZW5zaW9ucz8ubGVuZ3RoID8gZXh0ZW5zaW9ucyA6IFsnLnRzJ107XG4gICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy53YWxrRmlsZXMoZGlyLCBleHRzKTtcbiAgICAgICAgY29uc3QgbWF0Y2hlczogYW55W10gPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGlmIChtYXRjaGVzLmxlbmd0aCA+PSBtYXhSZXN1bHRzKSBicmVhaztcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZSwgJ3V0ZjgnKTtcbiAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gY29udGVudC5zcGxpdCgnXFxuJyk7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMubGVuZ3RoID49IG1heFJlc3VsdHMpIGJyZWFrO1xuICAgICAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KGxpbmVzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICBtYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZTogcGF0aC5yZWxhdGl2ZShFZGl0b3IuUHJvamVjdC5wYXRoLCBmaWxlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpbmVOdW1iZXI6IGkgKyAxLFxuICAgICAgICAgICAgICAgICAgICAgICAgbGluZTogbGluZXNbaV0udHJpbSgpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1hdGNoZXMsIHRvdGFsOiBtYXRjaGVzLmxlbmd0aCwgY2FwcGVkOiBtYXRjaGVzLmxlbmd0aCA+PSBtYXhSZXN1bHRzIH0sXG4gICAgICAgICAgICBgRm91bmQgJHttYXRjaGVzLmxlbmd0aH0gbWF0Y2hlcyBmb3IgcGF0dGVybiBcIiR7cGF0dGVybn1cImApO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0RmlsZVN0YXRzKGRpcmVjdG9yeT86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBkaXIgPSB0aGlzLnJlc29sdmVEaXIoZGlyZWN0b3J5KTtcbiAgICAgICAgY29uc3QgZmlsZXMgPSB0aGlzLndhbGtGaWxlcyhkaXIpO1xuICAgICAgICBjb25zdCBzdGF0czogUmVjb3JkPHN0cmluZywgeyBjb3VudDogbnVtYmVyOyB0b3RhbEJ5dGVzOiBudW1iZXIgfT4gPSB7fTtcbiAgICAgICAgbGV0IHRvdGFsRmlsZXMgPSAwLCB0b3RhbEJ5dGVzID0gMDtcblxuICAgICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZShmaWxlKSB8fCAnKG5vIGV4dGVuc2lvbiknO1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGZzLnN0YXRTeW5jKGZpbGUpLnNpemU7XG4gICAgICAgICAgICBpZiAoIXN0YXRzW2V4dF0pIHN0YXRzW2V4dF0gPSB7IGNvdW50OiAwLCB0b3RhbEJ5dGVzOiAwIH07XG4gICAgICAgICAgICBzdGF0c1tleHRdLmNvdW50Kys7XG4gICAgICAgICAgICBzdGF0c1tleHRdLnRvdGFsQnl0ZXMgKz0gc2l6ZTtcbiAgICAgICAgICAgIHRvdGFsRmlsZXMrKztcbiAgICAgICAgICAgIHRvdGFsQnl0ZXMgKz0gc2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGJ5RXh0ZW5zaW9uID0gT2JqZWN0LmVudHJpZXMoc3RhdHMpXG4gICAgICAgICAgICAubWFwKChbZXh0LCBzXSkgPT4gKHsgZXh0ZW5zaW9uOiBleHQsIGNvdW50OiBzLmNvdW50LCB0b3RhbEJ5dGVzOiBzLnRvdGFsQnl0ZXMsIHRvdGFsS0I6ICsocy50b3RhbEJ5dGVzIC8gMTAyNCkudG9GaXhlZCgxKSB9KSlcbiAgICAgICAgICAgIC5zb3J0KChhLCBiKSA9PiBiLnRvdGFsQnl0ZXMgLSBhLnRvdGFsQnl0ZXMpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIGJ5RXh0ZW5zaW9uLFxuICAgICAgICAgICAgc3VtbWFyeTogeyB0b3RhbEZpbGVzLCB0b3RhbEJ5dGVzLCB0b3RhbEtCOiArKHRvdGFsQnl0ZXMgLyAxMDI0KS50b0ZpeGVkKDEpIH1cbiAgICAgICAgfSwgYFNjYW5uZWQgJHt0b3RhbEZpbGVzfSBmaWxlcyBpbiAke2RpcmVjdG9yeSB8fCAnYXNzZXRzJ31gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZpbmRSZWZlcmVuY2VzKG5hbWU6IHN0cmluZywgZGlyZWN0b3J5Pzogc3RyaW5nLCBleHRlbnNpb25zPzogc3RyaW5nW10sIG1heFJlc3VsdHM6IG51bWJlciA9IDEwMCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5hbWUpIHJldHVybiBlcnJvclJlc3VsdCgnbmFtZSBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoYFxcXFxiJHtuYW1lLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyl9XFxcXGJgKTtcbiAgICAgICAgY29uc3QgZGlyID0gdGhpcy5yZXNvbHZlRGlyKGRpcmVjdG9yeSk7XG4gICAgICAgIGNvbnN0IGV4dHMgPSBleHRlbnNpb25zPy5sZW5ndGggPyBleHRlbnNpb25zIDogWycudHMnXTtcbiAgICAgICAgY29uc3QgZmlsZXMgPSB0aGlzLndhbGtGaWxlcyhkaXIsIGV4dHMpO1xuICAgICAgICBjb25zdCBtYXRjaGVzOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICAgICAgaWYgKG1hdGNoZXMubGVuZ3RoID49IG1heFJlc3VsdHMpIGJyZWFrO1xuICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhmaWxlLCAndXRmOCcpO1xuICAgICAgICAgICAgY29uc3QgbGluZXMgPSBjb250ZW50LnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVNYXRjaGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KGxpbmVzW2ldKSkge1xuICAgICAgICAgICAgICAgICAgICBmaWxlTWF0Y2hlcy5wdXNoKHsgbGluZU51bWJlcjogaSArIDEsIGxpbmU6IGxpbmVzW2ldLnRyaW0oKSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZmlsZU1hdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIG1hdGNoZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGZpbGU6IHBhdGgucmVsYXRpdmUoRWRpdG9yLlByb2plY3QucGF0aCwgZmlsZSksXG4gICAgICAgICAgICAgICAgICAgIG9jY3VycmVuY2VzOiBmaWxlTWF0Y2hlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIGxpbmVzOiBmaWxlTWF0Y2hlcy5zbGljZSgwLCA1KSAvLyBmaXJzdCA1IG1hdGNoZXMgcGVyIGZpbGVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1hdGNoZXMsIHRvdGFsRmlsZXM6IG1hdGNoZXMubGVuZ3RoLCBjYXBwZWQ6IG1hdGNoZXMubGVuZ3RoID49IG1heFJlc3VsdHMgfSxcbiAgICAgICAgICAgIGBGb3VuZCBcIiR7bmFtZX1cIiBpbiAke21hdGNoZXMubGVuZ3RofSBmaWxlc2ApO1xuICAgIH1cbn1cbiJdfQ==