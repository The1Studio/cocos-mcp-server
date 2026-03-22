import * as fs from 'fs';
import * as path from 'path';
import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';

/**
 * General-purpose project settings management tool.
 * Read/write any project settings JSON file, with specialized actions for engine modules and texture config.
 */
export class ManageSettings extends BaseActionTool {
    readonly name = 'manage_settings';
    readonly description = 'Manage project settings files (engine modules, builder config, texture presets). Actions: get, set, list, get_engine_modules, set_engine_modules, get_texture_config, set_texture_config.';
    readonly actions = [
        'get', 'set', 'list',
        'get_engine_modules', 'set_engine_modules',
        'get_texture_config', 'set_texture_config'
    ];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: { type: 'string', description: 'Action to perform', enum: this.actions },
            fileName: { type: 'string', description: 'Settings file name without extension (e.g., "engine", "builder")' },
            data: { type: 'object', description: 'Data to deep-merge into settings file (for set action)' },
            modules: { type: 'object', description: 'Module enable/disable map (for set_engine_modules, e.g., {"3d": false, "physics-ammo": false})' },
            config: { type: 'object', description: 'Texture config to update (for set_texture_config, e.g., {"genMipmaps": false})' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get: (args) => this.getSettings(args.fileName),
        set: (args) => this.setSettings(args.fileName, args.data),
        list: () => this.listSettings(),
        get_engine_modules: () => this.getEngineModules(),
        set_engine_modules: (args) => this.setEngineModules(args.modules),
        get_texture_config: () => this.getTextureConfig(),
        set_texture_config: (args) => this.setTextureConfig(args.config)
    };

    /** Settings directory: {project}/settings/v2/packages/ */
    private getSettingsDir(): string {
        return path.join(Editor.Project.path, 'settings', 'v2', 'packages');
    }

    /** Validate file name: no path traversal, alphanumeric/hyphen/underscore only */
    private validateFileName(name: string): boolean {
        return /^[a-zA-Z0-9_-]+$/.test(name);
    }

    /** Read and parse a settings JSON file */
    private readFile(fileName: string): any {
        const filePath = path.join(this.getSettingsDir(), `${fileName}.json`);
        if (!fs.existsSync(filePath)) throw new Error(`Settings file not found: ${fileName}.json`);
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    /** Write data to a settings JSON file */
    private writeFile(fileName: string, data: any): void {
        const filePath = path.join(this.getSettingsDir(), `${fileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    /** Deep merge source into target (arrays are replaced, not merged) */
    private deepMerge(target: any, source: any): any {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
                && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                result[key] = this.deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    private async getSettings(fileName: string): Promise<ActionToolResult> {
        if (!fileName) return errorResult('fileName is required');
        if (!this.validateFileName(fileName)) return errorResult('Invalid fileName: only alphanumeric, hyphens, underscores allowed');
        const data = this.readFile(fileName);
        return successResult(data, `Settings loaded: ${fileName}.json`);
    }

    private async setSettings(fileName: string, data: any): Promise<ActionToolResult> {
        if (!fileName) return errorResult('fileName is required');
        if (!data) return errorResult('data is required');
        if (!this.validateFileName(fileName)) return errorResult('Invalid fileName');
        const existing = this.readFile(fileName);
        const merged = this.deepMerge(existing, data);
        this.writeFile(fileName, merged);
        return successResult(merged, `Settings updated: ${fileName}.json`);
    }

    private async listSettings(): Promise<ActionToolResult> {
        const dir = this.getSettingsDir();
        if (!fs.existsSync(dir)) return errorResult(`Settings directory not found: ${dir}`);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        return successResult({ files, directory: dir }, `Found ${files.length} settings files`);
    }

    private async getEngineModules(): Promise<ActionToolResult> {
        const engine = this.readFile('engine');
        const cache = engine?.modules?.configs?.migrationsConfig?.cache;
        if (!cache) return errorResult('Could not find engine module cache in engine.json');
        const modules: Record<string, boolean> = {};
        for (const [name, value] of Object.entries(cache)) {
            modules[name] = (value as any)?._value === true;
        }
        const includeModules = engine?.modules?.configs?.migrationsConfig?.includeModules || [];
        return successResult({ modules, includeModules }, `Found ${Object.keys(modules).length} engine modules`);
    }

    private async setEngineModules(modulesMap: Record<string, boolean>): Promise<ActionToolResult> {
        if (!modulesMap) return errorResult('modules is required (e.g., {"3d": false, "profiler": false})');
        const engine = this.readFile('engine');
        const cache = engine?.modules?.configs?.migrationsConfig?.cache;
        if (!cache) return errorResult('Could not find engine module cache in engine.json');
        const includeModules: string[] = [...(engine.modules.configs.migrationsConfig.includeModules || [])];
        const changes: string[] = [];

        for (const [name, enabled] of Object.entries(modulesMap)) {
            if (!cache[name]) { changes.push(`${name}: skipped (not found)`); continue; }
            cache[name]._value = enabled;
            const idx = includeModules.indexOf(name);
            if (enabled && idx === -1) { includeModules.push(name); changes.push(`${name}: enabled`); }
            else if (!enabled && idx !== -1) { includeModules.splice(idx, 1); changes.push(`${name}: disabled`); }
            else { changes.push(`${name}: ${enabled ? 'already enabled' : 'already disabled'}`); }
        }

        includeModules.sort();
        engine.modules.configs.migrationsConfig.includeModules = includeModules;
        this.writeFile('engine', engine);
        return successResult({ changes, includeModules }, `Updated ${changes.length} engine modules`);
    }

    private async getTextureConfig(): Promise<ActionToolResult> {
        const builder = this.readFile('builder');
        const textureConfig = builder?.textureCompressConfig || {};
        return successResult(textureConfig, 'Texture config loaded from builder.json');
    }

    private async setTextureConfig(config: any): Promise<ActionToolResult> {
        if (!config) return errorResult('config is required');
        const builder = this.readFile('builder');
        builder.textureCompressConfig = this.deepMerge(builder.textureCompressConfig || {}, config);
        this.writeFile('builder', builder);
        return successResult(builder.textureCompressConfig, 'Texture config updated in builder.json');
    }
}
