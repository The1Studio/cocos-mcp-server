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
exports.ManageSettings = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
const base_action_tool_1 = require("./base-action-tool");
/**
 * General-purpose project settings management tool.
 * Read/write any project settings JSON file, with specialized actions for engine modules and texture config.
 */
class ManageSettings extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_settings';
        this.description = 'Manage project settings files (engine modules, builder config, texture presets). Actions: get, set, list, get_engine_modules, set_engine_modules, get_texture_config, set_texture_config.';
        this.actions = [
            'get', 'set', 'list',
            'get_engine_modules', 'set_engine_modules',
            'get_texture_config', 'set_texture_config'
        ];
        this.inputSchema = {
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
        this.actionHandlers = {
            get: (args) => this.getSettings(args.fileName),
            set: (args) => this.setSettings(args.fileName, args.data),
            list: () => this.listSettings(),
            get_engine_modules: () => this.getEngineModules(),
            set_engine_modules: (args) => this.setEngineModules(args.modules),
            get_texture_config: () => this.getTextureConfig(),
            set_texture_config: (args) => this.setTextureConfig(args.config)
        };
    }
    /** Settings directory: {project}/settings/v2/packages/ */
    getSettingsDir() {
        return path.join(Editor.Project.path, 'settings', 'v2', 'packages');
    }
    /** Validate file name: no path traversal, alphanumeric/hyphen/underscore only */
    validateFileName(name) {
        return /^[a-zA-Z0-9_-]+$/.test(name);
    }
    /** Read and parse a settings JSON file */
    readFile(fileName) {
        const filePath = path.join(this.getSettingsDir(), `${fileName}.json`);
        if (!fs.existsSync(filePath))
            throw new Error(`Settings file not found: ${fileName}.json`);
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    /** Write data to a settings JSON file */
    writeFile(fileName, data) {
        const filePath = path.join(this.getSettingsDir(), `${fileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    /** Deep merge source into target (arrays are replaced, not merged) */
    deepMerge(target, source) {
        const result = Object.assign({}, target);
        for (const key of Object.keys(source)) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
                && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
                result[key] = this.deepMerge(target[key], source[key]);
            }
            else {
                result[key] = source[key];
            }
        }
        return result;
    }
    async getSettings(fileName) {
        if (!fileName)
            return (0, types_1.errorResult)('fileName is required');
        if (!this.validateFileName(fileName))
            return (0, types_1.errorResult)('Invalid fileName: only alphanumeric, hyphens, underscores allowed');
        const data = this.readFile(fileName);
        return (0, types_1.successResult)(data, `Settings loaded: ${fileName}.json`);
    }
    async setSettings(fileName, data) {
        if (!fileName)
            return (0, types_1.errorResult)('fileName is required');
        if (!data)
            return (0, types_1.errorResult)('data is required');
        if (!this.validateFileName(fileName))
            return (0, types_1.errorResult)('Invalid fileName');
        const existing = this.readFile(fileName);
        const merged = this.deepMerge(existing, data);
        this.writeFile(fileName, merged);
        return (0, types_1.successResult)(merged, `Settings updated: ${fileName}.json`);
    }
    async listSettings() {
        const dir = this.getSettingsDir();
        if (!fs.existsSync(dir))
            return (0, types_1.errorResult)(`Settings directory not found: ${dir}`);
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        return (0, types_1.successResult)({ files, directory: dir }, `Found ${files.length} settings files`);
    }
    async getEngineModules() {
        var _a, _b, _c, _d, _e, _f;
        const engine = this.readFile('engine');
        const cache = (_c = (_b = (_a = engine === null || engine === void 0 ? void 0 : engine.modules) === null || _a === void 0 ? void 0 : _a.configs) === null || _b === void 0 ? void 0 : _b.migrationsConfig) === null || _c === void 0 ? void 0 : _c.cache;
        if (!cache)
            return (0, types_1.errorResult)('Could not find engine module cache in engine.json');
        const modules = {};
        for (const [name, value] of Object.entries(cache)) {
            modules[name] = (value === null || value === void 0 ? void 0 : value._value) === true;
        }
        const includeModules = ((_f = (_e = (_d = engine === null || engine === void 0 ? void 0 : engine.modules) === null || _d === void 0 ? void 0 : _d.configs) === null || _e === void 0 ? void 0 : _e.migrationsConfig) === null || _f === void 0 ? void 0 : _f.includeModules) || [];
        return (0, types_1.successResult)({ modules, includeModules }, `Found ${Object.keys(modules).length} engine modules`);
    }
    async setEngineModules(modulesMap) {
        var _a, _b, _c;
        if (!modulesMap)
            return (0, types_1.errorResult)('modules is required (e.g., {"3d": false, "profiler": false})');
        const engine = this.readFile('engine');
        const cache = (_c = (_b = (_a = engine === null || engine === void 0 ? void 0 : engine.modules) === null || _a === void 0 ? void 0 : _a.configs) === null || _b === void 0 ? void 0 : _b.migrationsConfig) === null || _c === void 0 ? void 0 : _c.cache;
        if (!cache)
            return (0, types_1.errorResult)('Could not find engine module cache in engine.json');
        const includeModules = [...(engine.modules.configs.migrationsConfig.includeModules || [])];
        const changes = [];
        for (const [name, enabled] of Object.entries(modulesMap)) {
            if (!cache[name]) {
                changes.push(`${name}: skipped (not found)`);
                continue;
            }
            cache[name]._value = enabled;
            const idx = includeModules.indexOf(name);
            if (enabled && idx === -1) {
                includeModules.push(name);
                changes.push(`${name}: enabled`);
            }
            else if (!enabled && idx !== -1) {
                includeModules.splice(idx, 1);
                changes.push(`${name}: disabled`);
            }
            else {
                changes.push(`${name}: ${enabled ? 'already enabled' : 'already disabled'}`);
            }
        }
        includeModules.sort();
        engine.modules.configs.migrationsConfig.includeModules = includeModules;
        this.writeFile('engine', engine);
        return (0, types_1.successResult)({ changes, includeModules }, `Updated ${changes.length} engine modules`);
    }
    async getTextureConfig() {
        const builder = this.readFile('builder');
        const textureConfig = (builder === null || builder === void 0 ? void 0 : builder.textureCompressConfig) || {};
        return (0, types_1.successResult)(textureConfig, 'Texture config loaded from builder.json');
    }
    async setTextureConfig(config) {
        if (!config)
            return (0, types_1.errorResult)('config is required');
        const builder = this.readFile('builder');
        builder.textureCompressConfig = this.deepMerge(builder.textureCompressConfig || {}, config);
        this.writeFile('builder', builder);
        return (0, types_1.successResult)(builder.textureCompressConfig, 'Texture config updated in builder.json');
    }
}
exports.ManageSettings = ManageSettings;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNldHRpbmdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFFcEQ7OztHQUdHO0FBQ0gsTUFBYSxjQUFlLFNBQVEsaUNBQWM7SUFBbEQ7O1FBQ2EsU0FBSSxHQUFHLGlCQUFpQixDQUFDO1FBQ3pCLGdCQUFXLEdBQUcsMkxBQTJMLENBQUM7UUFDMU0sWUFBTyxHQUFHO1lBQ2YsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNO1lBQ3BCLG9CQUFvQixFQUFFLG9CQUFvQjtZQUMxQyxvQkFBb0IsRUFBRSxvQkFBb0I7U0FDN0MsQ0FBQztRQUVPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ2hGLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtFQUFrRSxFQUFFO2dCQUM3RyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx3REFBd0QsRUFBRTtnQkFDL0YsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsZ0dBQWdHLEVBQUU7Z0JBQzFJLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGdGQUFnRixFQUFFO2FBQzVIO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxH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YSxFQUFDLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxFQUFFLFdBQVcsT0FBTyxDQUFDLE1BQU0saUJBQWlCLENBQUMsQ0FBQztJQUNsRyxDQUFDO0lBRU8sS0FBSyxDQUFDLGdCQUFnQjtRQUMxQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3pDLE1BQU0sYUFBYSxHQUFHLENBQUEsT0FBTyxhQUFQLE9BQU8sdUJBQVAsT0FBTyxDQUFFLHFCQUFxQixLQUFJLEVBQUUsQ0FBQztRQUMzRCxPQUFPLElBQUEscUJBQWEsRUFBQyxhQUFhLEVBQUUseUNBQXlDLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRU8sS0FBSyxDQUFDLGdCQUFnQixDQUFDLE1BQVc7UUFDdEMsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ3RELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDekMsT0FBTyxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLHFCQUFxQixJQUFJLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUM1RixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNuQyxPQUFPLElBQUEscUJBQWEsRUFBQyxPQUFPLENBQUMscUJBQXFCLEVBQUUsd0NBQXdDLENBQUMsQ0FBQztJQUNsRyxDQUFDO0NBQ0o7QUE1SUQsd0NBNElDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuXG4vKipcbiAqIEdlbmVyYWwtcHVycG9zZSBwcm9qZWN0IHNldHRpbmdzIG1hbmFnZW1lbnQgdG9vbC5cbiAqIFJlYWQvd3JpdGUgYW55IHByb2plY3Qgc2V0dGluZ3MgSlNPTiBmaWxlLCB3aXRoIHNwZWNpYWxpemVkIGFjdGlvbnMgZm9yIGVuZ2luZSBtb2R1bGVzIGFuZCB0ZXh0dXJlIGNvbmZpZy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZVNldHRpbmdzIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NldHRpbmdzJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgcHJvamVjdCBzZXR0aW5ncyBmaWxlcyAoZW5naW5lIG1vZHVsZXMsIGJ1aWxkZXIgY29uZmlnLCB0ZXh0dXJlIHByZXNldHMpLiBBY3Rpb25zOiBnZXQsIHNldCwgbGlzdCwgZ2V0X2VuZ2luZV9tb2R1bGVzLCBzZXRfZW5naW5lX21vZHVsZXMsIGdldF90ZXh0dXJlX2NvbmZpZywgc2V0X3RleHR1cmVfY29uZmlnLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFtcbiAgICAgICAgJ2dldCcsICdzZXQnLCAnbGlzdCcsXG4gICAgICAgICdnZXRfZW5naW5lX21vZHVsZXMnLCAnc2V0X2VuZ2luZV9tb2R1bGVzJyxcbiAgICAgICAgJ2dldF90ZXh0dXJlX2NvbmZpZycsICdzZXRfdGV4dHVyZV9jb25maWcnXG4gICAgXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJywgZW51bTogdGhpcy5hY3Rpb25zIH0sXG4gICAgICAgICAgICBmaWxlTmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTZXR0aW5ncyBmaWxlIG5hbWUgd2l0aG91dCBleHRlbnNpb24gKGUuZy4sIFwiZW5naW5lXCIsIFwiYnVpbGRlclwiKScgfSxcbiAgICAgICAgICAgIGRhdGE6IHsgdHlwZTogJ29iamVjdCcsIGRlc2NyaXB0aW9uOiAnRGF0YSB0byBkZWVwLW1lcmdlIGludG8gc2V0dGluZ3MgZmlsZSAoZm9yIHNldCBhY3Rpb24pJyB9LFxuICAgICAgICAgICAgbW9kdWxlczogeyB0eXBlOiAnb2JqZWN0JywgZGVzY3JpcHRpb246ICdNb2R1bGUgZW5hYmxlL2Rpc2FibGUgbWFwIChmb3Igc2V0X2VuZ2luZV9tb2R1bGVzLCBlLmcuLCB7XCIzZFwiOiBmYWxzZSwgXCJwaHlzaWNzLWFtbW9cIjogZmFsc2V9KScgfSxcbiAgICAgICAgICAgIGNvbmZpZzogeyB0eXBlOiAnb2JqZWN0JywgZGVzY3JpcHRpb246ICdUZXh0dXJlIGNvbmZpZyB0byB1cGRhdGUgKGZvciBzZXRfdGV4dHVyZV9jb25maWcsIGUuZy4sIHtcImdlbk1pcG1hcHNcIjogZmFsc2V9KScgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0OiAoYXJncykgPT4gdGhpcy5nZXRTZXR0aW5ncyhhcmdzLmZpbGVOYW1lKSxcbiAgICAgICAgc2V0OiAoYXJncykgPT4gdGhpcy5zZXRTZXR0aW5ncyhhcmdzLmZpbGVOYW1lLCBhcmdzLmRhdGEpLFxuICAgICAgICBsaXN0OiAoKSA9PiB0aGlzLmxpc3RTZXR0aW5ncygpLFxuICAgICAgICBnZXRfZW5naW5lX21vZHVsZXM6ICgpID0+IHRoaXMuZ2V0RW5naW5lTW9kdWxlcygpLFxuICAgICAgICBzZXRfZW5naW5lX21vZHVsZXM6IChhcmdzKSA9PiB0aGlzLnNldEVuZ2luZU1vZHVsZXMoYXJncy5tb2R1bGVzKSxcbiAgICAgICAgZ2V0X3RleHR1cmVfY29uZmlnOiAoKSA9PiB0aGlzLmdldFRleHR1cmVDb25maWcoKSxcbiAgICAgICAgc2V0X3RleHR1cmVfY29uZmlnOiAoYXJncykgPT4gdGhpcy5zZXRUZXh0dXJlQ29uZmlnKGFyZ3MuY29uZmlnKVxuICAgIH07XG5cbiAgICAvKiogU2V0dGluZ3MgZGlyZWN0b3J5OiB7cHJvamVjdH0vc2V0dGluZ3MvdjIvcGFja2FnZXMvICovXG4gICAgcHJpdmF0ZSBnZXRTZXR0aW5nc0RpcigpOiBzdHJpbmcge1xuICAgICAgICByZXR1cm4gcGF0aC5qb2luKEVkaXRvci5Qcm9qZWN0LnBhdGgsICdzZXR0aW5ncycsICd2MicsICdwYWNrYWdlcycpO1xuICAgIH1cblxuICAgIC8qKiBWYWxpZGF0ZSBmaWxlIG5hbWU6IG5vIHBhdGggdHJhdmVyc2FsLCBhbHBoYW51bWVyaWMvaHlwaGVuL3VuZGVyc2NvcmUgb25seSAqL1xuICAgIHByaXZhdGUgdmFsaWRhdGVGaWxlTmFtZShuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgcmV0dXJuIC9eW2EtekEtWjAtOV8tXSskLy50ZXN0KG5hbWUpO1xuICAgIH1cblxuICAgIC8qKiBSZWFkIGFuZCBwYXJzZSBhIHNldHRpbmdzIEpTT04gZmlsZSAqL1xuICAgIHByaXZhdGUgcmVhZEZpbGUoZmlsZU5hbWU6IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuZ2V0U2V0dGluZ3NEaXIoKSwgYCR7ZmlsZU5hbWV9Lmpzb25gKTtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSkgdGhyb3cgbmV3IEVycm9yKGBTZXR0aW5ncyBmaWxlIG5vdCBmb3VuZDogJHtmaWxlTmFtZX0uanNvbmApO1xuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGY4JykpO1xuICAgIH1cblxuICAgIC8qKiBXcml0ZSBkYXRhIHRvIGEgc2V0dGluZ3MgSlNPTiBmaWxlICovXG4gICAgcHJpdmF0ZSB3cml0ZUZpbGUoZmlsZU5hbWU6IHN0cmluZywgZGF0YTogYW55KTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHRoaXMuZ2V0U2V0dGluZ3NEaXIoKSwgYCR7ZmlsZU5hbWV9Lmpzb25gKTtcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhmaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xuICAgIH1cblxuICAgIC8qKiBEZWVwIG1lcmdlIHNvdXJjZSBpbnRvIHRhcmdldCAoYXJyYXlzIGFyZSByZXBsYWNlZCwgbm90IG1lcmdlZCkgKi9cbiAgICBwcml2YXRlIGRlZXBNZXJnZSh0YXJnZXQ6IGFueSwgc291cmNlOiBhbnkpOiBhbnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSB7IC4uLnRhcmdldCB9O1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhzb3VyY2UpKSB7XG4gICAgICAgICAgICBpZiAoc291cmNlW2tleV0gJiYgdHlwZW9mIHNvdXJjZVtrZXldID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShzb3VyY2Vba2V5XSlcbiAgICAgICAgICAgICAgICAmJiB0YXJnZXRba2V5XSAmJiB0eXBlb2YgdGFyZ2V0W2tleV0gPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHRhcmdldFtrZXldKSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdGhpcy5kZWVwTWVyZ2UodGFyZ2V0W2tleV0sIHNvdXJjZVtrZXldKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U2V0dGluZ3MoZmlsZU5hbWU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWZpbGVOYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2ZpbGVOYW1lIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghdGhpcy52YWxpZGF0ZUZpbGVOYW1lKGZpbGVOYW1lKSkgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIGZpbGVOYW1lOiBvbmx5IGFscGhhbnVtZXJpYywgaHlwaGVucywgdW5kZXJzY29yZXMgYWxsb3dlZCcpO1xuICAgICAgICBjb25zdCBkYXRhID0gdGhpcy5yZWFkRmlsZShmaWxlTmFtZSk7XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGRhdGEsIGBTZXR0aW5ncyBsb2FkZWQ6ICR7ZmlsZU5hbWV9Lmpzb25gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFNldHRpbmdzKGZpbGVOYW1lOiBzdHJpbmcsIGRhdGE6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWZpbGVOYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2ZpbGVOYW1lIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghZGF0YSkgcmV0dXJuIGVycm9yUmVzdWx0KCdkYXRhIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghdGhpcy52YWxpZGF0ZUZpbGVOYW1lKGZpbGVOYW1lKSkgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIGZpbGVOYW1lJyk7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5yZWFkRmlsZShmaWxlTmFtZSk7XG4gICAgICAgIGNvbnN0IG1lcmdlZCA9IHRoaXMuZGVlcE1lcmdlKGV4aXN0aW5nLCBkYXRhKTtcbiAgICAgICAgdGhpcy53cml0ZUZpbGUoZmlsZU5hbWUsIG1lcmdlZCk7XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG1lcmdlZCwgYFNldHRpbmdzIHVwZGF0ZWQ6ICR7ZmlsZU5hbWV9Lmpzb25gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxpc3RTZXR0aW5ncygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgZGlyID0gdGhpcy5nZXRTZXR0aW5nc0RpcigpO1xuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZGlyKSkgcmV0dXJuIGVycm9yUmVzdWx0KGBTZXR0aW5ncyBkaXJlY3Rvcnkgbm90IGZvdW5kOiAke2Rpcn1gKTtcbiAgICAgICAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhkaXIpLmZpbHRlcihmID0+IGYuZW5kc1dpdGgoJy5qc29uJykpLm1hcChmID0+IGYucmVwbGFjZSgnLmpzb24nLCAnJykpO1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGZpbGVzLCBkaXJlY3Rvcnk6IGRpciB9LCBgRm91bmQgJHtmaWxlcy5sZW5ndGh9IHNldHRpbmdzIGZpbGVzYCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRFbmdpbmVNb2R1bGVzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBlbmdpbmUgPSB0aGlzLnJlYWRGaWxlKCdlbmdpbmUnKTtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBlbmdpbmU/Lm1vZHVsZXM/LmNvbmZpZ3M/Lm1pZ3JhdGlvbnNDb25maWc/LmNhY2hlO1xuICAgICAgICBpZiAoIWNhY2hlKSByZXR1cm4gZXJyb3JSZXN1bHQoJ0NvdWxkIG5vdCBmaW5kIGVuZ2luZSBtb2R1bGUgY2FjaGUgaW4gZW5naW5lLmpzb24nKTtcbiAgICAgICAgY29uc3QgbW9kdWxlczogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4gPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGNhY2hlKSkge1xuICAgICAgICAgICAgbW9kdWxlc1tuYW1lXSA9ICh2YWx1ZSBhcyBhbnkpPy5fdmFsdWUgPT09IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW5jbHVkZU1vZHVsZXMgPSBlbmdpbmU/Lm1vZHVsZXM/LmNvbmZpZ3M/Lm1pZ3JhdGlvbnNDb25maWc/LmluY2x1ZGVNb2R1bGVzIHx8IFtdO1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1vZHVsZXMsIGluY2x1ZGVNb2R1bGVzIH0sIGBGb3VuZCAke09iamVjdC5rZXlzKG1vZHVsZXMpLmxlbmd0aH0gZW5naW5lIG1vZHVsZXNgKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldEVuZ2luZU1vZHVsZXMobW9kdWxlc01hcDogUmVjb3JkPHN0cmluZywgYm9vbGVhbj4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFtb2R1bGVzTWFwKSByZXR1cm4gZXJyb3JSZXN1bHQoJ21vZHVsZXMgaXMgcmVxdWlyZWQgKGUuZy4sIHtcIjNkXCI6IGZhbHNlLCBcInByb2ZpbGVyXCI6IGZhbHNlfSknKTtcbiAgICAgICAgY29uc3QgZW5naW5lID0gdGhpcy5yZWFkRmlsZSgnZW5naW5lJyk7XG4gICAgICAgIGNvbnN0IGNhY2hlID0gZW5naW5lPy5tb2R1bGVzPy5jb25maWdzPy5taWdyYXRpb25zQ29uZmlnPy5jYWNoZTtcbiAgICAgICAgaWYgKCFjYWNoZSkgcmV0dXJuIGVycm9yUmVzdWx0KCdDb3VsZCBub3QgZmluZCBlbmdpbmUgbW9kdWxlIGNhY2hlIGluIGVuZ2luZS5qc29uJyk7XG4gICAgICAgIGNvbnN0IGluY2x1ZGVNb2R1bGVzOiBzdHJpbmdbXSA9IFsuLi4oZW5naW5lLm1vZHVsZXMuY29uZmlncy5taWdyYXRpb25zQ29uZmlnLmluY2x1ZGVNb2R1bGVzIHx8IFtdKV07XG4gICAgICAgIGNvbnN0IGNoYW5nZXM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBbbmFtZSwgZW5hYmxlZF0gb2YgT2JqZWN0LmVudHJpZXMobW9kdWxlc01hcCkpIHtcbiAgICAgICAgICAgIGlmICghY2FjaGVbbmFtZV0pIHsgY2hhbmdlcy5wdXNoKGAke25hbWV9OiBza2lwcGVkIChub3QgZm91bmQpYCk7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICBjYWNoZVtuYW1lXS5fdmFsdWUgPSBlbmFibGVkO1xuICAgICAgICAgICAgY29uc3QgaWR4ID0gaW5jbHVkZU1vZHVsZXMuaW5kZXhPZihuYW1lKTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkICYmIGlkeCA9PT0gLTEpIHsgaW5jbHVkZU1vZHVsZXMucHVzaChuYW1lKTsgY2hhbmdlcy5wdXNoKGAke25hbWV9OiBlbmFibGVkYCk7IH1cbiAgICAgICAgICAgIGVsc2UgaWYgKCFlbmFibGVkICYmIGlkeCAhPT0gLTEpIHsgaW5jbHVkZU1vZHVsZXMuc3BsaWNlKGlkeCwgMSk7IGNoYW5nZXMucHVzaChgJHtuYW1lfTogZGlzYWJsZWRgKTsgfVxuICAgICAgICAgICAgZWxzZSB7IGNoYW5nZXMucHVzaChgJHtuYW1lfTogJHtlbmFibGVkID8gJ2FscmVhZHkgZW5hYmxlZCcgOiAnYWxyZWFkeSBkaXNhYmxlZCd9YCk7IH1cbiAgICAgICAgfVxuXG4gICAgICAgIGluY2x1ZGVNb2R1bGVzLnNvcnQoKTtcbiAgICAgICAgZW5naW5lLm1vZHVsZXMuY29uZmlncy5taWdyYXRpb25zQ29uZmlnLmluY2x1ZGVNb2R1bGVzID0gaW5jbHVkZU1vZHVsZXM7XG4gICAgICAgIHRoaXMud3JpdGVGaWxlKCdlbmdpbmUnLCBlbmdpbmUpO1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGNoYW5nZXMsIGluY2x1ZGVNb2R1bGVzIH0sIGBVcGRhdGVkICR7Y2hhbmdlcy5sZW5ndGh9IGVuZ2luZSBtb2R1bGVzYCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRUZXh0dXJlQ29uZmlnKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBidWlsZGVyID0gdGhpcy5yZWFkRmlsZSgnYnVpbGRlcicpO1xuICAgICAgICBjb25zdCB0ZXh0dXJlQ29uZmlnID0gYnVpbGRlcj8udGV4dHVyZUNvbXByZXNzQ29uZmlnIHx8IHt9O1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh0ZXh0dXJlQ29uZmlnLCAnVGV4dHVyZSBjb25maWcgbG9hZGVkIGZyb20gYnVpbGRlci5qc29uJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRUZXh0dXJlQ29uZmlnKGNvbmZpZzogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghY29uZmlnKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2NvbmZpZyBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBidWlsZGVyID0gdGhpcy5yZWFkRmlsZSgnYnVpbGRlcicpO1xuICAgICAgICBidWlsZGVyLnRleHR1cmVDb21wcmVzc0NvbmZpZyA9IHRoaXMuZGVlcE1lcmdlKGJ1aWxkZXIudGV4dHVyZUNvbXByZXNzQ29uZmlnIHx8IHt9LCBjb25maWcpO1xuICAgICAgICB0aGlzLndyaXRlRmlsZSgnYnVpbGRlcicsIGJ1aWxkZXIpO1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChidWlsZGVyLnRleHR1cmVDb21wcmVzc0NvbmZpZywgJ1RleHR1cmUgY29uZmlnIHVwZGF0ZWQgaW4gYnVpbGRlci5qc29uJyk7XG4gICAgfVxufVxuIl19