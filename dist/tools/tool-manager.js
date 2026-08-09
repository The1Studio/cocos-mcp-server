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
exports.ToolManager = void 0;
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** All v2 manage_* tool names */
const V2_TOOL_NAMES = [
    { name: 'manage_scene', description: 'Manage scenes in the project' },
    { name: 'manage_node', description: 'Manage nodes in the current scene' },
    { name: 'manage_component', description: 'Manage components on scene nodes' },
    { name: 'manage_prefab', description: 'Manage prefab assets' },
    { name: 'manage_asset', description: 'Manage project assets' },
    { name: 'manage_project', description: 'Manage project build, run, and settings' },
    { name: 'manage_debug', description: 'Debug tools: console, logs, scripts, validation' },
    { name: 'manage_preferences', description: 'Manage editor preferences' },
    { name: 'manage_server', description: 'Server network and connectivity info' },
    { name: 'manage_broadcast', description: 'Editor broadcast event listeners' },
    { name: 'manage_scene_view', description: 'Scene view gizmos, camera, grid settings' },
    { name: 'manage_node_hierarchy', description: 'Advanced node operations: copy, paste, cut, reset' },
    { name: 'manage_scene_query', description: 'Scene introspection and class queries' },
    { name: 'manage_undo', description: 'Undo/redo recording and execution' },
    { name: 'manage_reference_image', description: 'Reference image overlay management' },
    { name: 'manage_validation', description: 'JSON validation utilities' },
    { name: 'manage_selection', description: 'Editor selection state management' },
    { name: 'manage_script', description: 'TypeScript script file management' },
    { name: 'manage_material', description: 'Material and shader property management' },
    { name: 'manage_animation', description: 'Animation clip management' },
];
class ToolManager {
    constructor() {
        this.availableTools = [];
        this.settings = this.readToolManagerSettings();
        this.initializeAvailableTools();
        if (this.settings.configurations.length === 0) {
            console.log('[ToolManager] No configurations found, creating default...');
            this.createConfiguration('Default', 'Auto-created default tool configuration');
        }
        this.syncToolList();
    }
    getToolManagerSettingsPath() {
        return path.join(Editor.Project.path, 'settings', 'tool-manager.json');
    }
    ensureSettingsDir() {
        const settingsDir = path.dirname(this.getToolManagerSettingsPath());
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }
    }
    readToolManagerSettings() {
        const DEFAULT = {
            configurations: [],
            currentConfigId: '',
            maxConfigSlots: 5
        };
        try {
            this.ensureSettingsDir();
            const settingsFile = this.getToolManagerSettingsPath();
            if (fs.existsSync(settingsFile)) {
                const content = fs.readFileSync(settingsFile, 'utf8');
                return Object.assign(Object.assign({}, DEFAULT), JSON.parse(content));
            }
        }
        catch (e) {
            console.error('Failed to read tool manager settings:', e);
        }
        return DEFAULT;
    }
    saveToolManagerSettings(settings) {
        try {
            this.ensureSettingsDir();
            const settingsFile = this.getToolManagerSettingsPath();
            fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        }
        catch (e) {
            console.error('Failed to save tool manager settings:', e);
            throw e;
        }
    }
    initializeAvailableTools() {
        this.availableTools = V2_TOOL_NAMES.map(t => ({
            name: t.name,
            enabled: true,
            description: t.description
        }));
        console.log(`[ToolManager] Initialized ${this.availableTools.length} v2 tools`);
    }
    /** Sync persisted configs with current tool list (add new tools, remove stale) */
    syncToolList() {
        const currentNames = new Set(V2_TOOL_NAMES.map(t => t.name));
        let changed = false;
        for (const config of this.settings.configurations) {
            // Remove tools that no longer exist
            const before = config.tools.length;
            config.tools = config.tools.filter(t => currentNames.has(t.name));
            if (config.tools.length !== before)
                changed = true;
            // Add new tools that don't exist in config
            const existingNames = new Set(config.tools.map(t => t.name));
            for (const tool of V2_TOOL_NAMES) {
                if (!existingNames.has(tool.name)) {
                    config.tools.push({ name: tool.name, enabled: true, description: tool.description });
                    changed = true;
                }
            }
            // Sync descriptions
            const descMap = new Map(V2_TOOL_NAMES.map(t => [t.name, t.description]));
            for (const tool of config.tools) {
                const desc = descMap.get(tool.name);
                if (desc && tool.description !== desc) {
                    tool.description = desc;
                    changed = true;
                }
            }
        }
        if (changed) {
            console.log('[ToolManager] Synced tool list with v2 tools');
            this.saveSettings();
        }
    }
    getAvailableTools() {
        return [...this.availableTools];
    }
    getConfigurations() {
        return [...this.settings.configurations];
    }
    getCurrentConfiguration() {
        if (!this.settings.currentConfigId)
            return null;
        return this.settings.configurations.find(c => c.id === this.settings.currentConfigId) || null;
    }
    createConfiguration(name, description) {
        if (this.settings.configurations.length >= this.settings.maxConfigSlots) {
            throw new Error(`Maximum configuration slots reached (${this.settings.maxConfigSlots})`);
        }
        const config = {
            id: (0, uuid_1.v4)(),
            name,
            description,
            tools: this.availableTools.map(t => (Object.assign({}, t))),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.settings.configurations.push(config);
        this.settings.currentConfigId = config.id;
        this.saveSettings();
        return config;
    }
    updateConfiguration(configId, updates) {
        const idx = this.settings.configurations.findIndex(c => c.id === configId);
        if (idx === -1)
            throw new Error('Configuration not found');
        const config = this.settings.configurations[idx];
        const updated = Object.assign(Object.assign(Object.assign({}, config), updates), { updatedAt: new Date().toISOString() });
        this.settings.configurations[idx] = updated;
        this.saveSettings();
        return updated;
    }
    deleteConfiguration(configId) {
        const idx = this.settings.configurations.findIndex(c => c.id === configId);
        if (idx === -1)
            throw new Error('Configuration not found');
        this.settings.configurations.splice(idx, 1);
        if (this.settings.currentConfigId === configId) {
            this.settings.currentConfigId = this.settings.configurations.length > 0
                ? this.settings.configurations[0].id
                : '';
        }
        this.saveSettings();
    }
    setCurrentConfiguration(configId) {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config)
            throw new Error('Configuration not found');
        this.settings.currentConfigId = configId;
        this.saveSettings();
    }
    updateToolStatus(configId, toolName, enabled) {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config)
            throw new Error('Configuration not found');
        const tool = config.tools.find(t => t.name === toolName);
        if (!tool)
            throw new Error(`Tool '${toolName}' not found`);
        tool.enabled = enabled;
        config.updatedAt = new Date().toISOString();
        this.saveSettings();
    }
    updateToolStatusBatch(configId, updates) {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config)
            throw new Error('Configuration not found');
        for (const update of updates) {
            const tool = config.tools.find(t => t.name === update.name);
            if (tool) {
                tool.enabled = update.enabled;
            }
        }
        config.updatedAt = new Date().toISOString();
        this.saveSettings();
    }
    exportConfiguration(configId) {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config)
            throw new Error('Configuration not found');
        return JSON.stringify(config, null, 2);
    }
    importConfiguration(configJson) {
        const raw = JSON.parse(configJson);
        // Validate required top-level fields
        if (!raw || typeof raw !== 'object') {
            throw new Error('Invalid configuration format');
        }
        if (typeof raw.name !== 'string' || !raw.name.trim()) {
            throw new Error('Invalid configuration format: name must be a non-empty string');
        }
        if (!Array.isArray(raw.tools)) {
            throw new Error('Invalid configuration format: tools must be an array');
        }
        // Validate and sanitize each tool entry — only keep known fields with correct types
        const sanitizedTools = [];
        for (const tool of raw.tools) {
            if (typeof tool.name !== 'string' || typeof tool.enabled !== 'boolean') {
                throw new Error(`Invalid tool entry: name must be string and enabled must be boolean`);
            }
            sanitizedTools.push({
                name: tool.name,
                enabled: tool.enabled,
                description: typeof tool.description === 'string' ? tool.description : ''
            });
        }
        if (this.settings.configurations.length >= this.settings.maxConfigSlots) {
            throw new Error(`Maximum configuration slots reached (${this.settings.maxConfigSlots})`);
        }
        // Build a clean config object — discard any unexpected fields from input
        const config = {
            id: (0, uuid_1.v4)(),
            name: raw.name.trim(),
            description: typeof raw.description === 'string' ? raw.description : '',
            tools: sanitizedTools,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.settings.configurations.push(config);
        this.saveSettings();
        return config;
    }
    /** Returns flat array of enabled tool names for MCP server filtering */
    getEnabledToolNames() {
        const currentConfig = this.getCurrentConfiguration();
        if (!currentConfig) {
            return this.availableTools.filter(t => t.enabled).map(t => t.name);
        }
        return currentConfig.tools.filter(t => t.enabled).map(t => t.name);
    }
    getToolManagerState() {
        const currentConfig = this.getCurrentConfiguration();
        return {
            success: true,
            availableTools: currentConfig ? currentConfig.tools : this.getAvailableTools(),
            selectedConfigId: this.settings.currentConfigId,
            configurations: this.getConfigurations(),
            maxConfigSlots: this.settings.maxConfigSlots
        };
    }
    saveSettings() {
        this.saveToolManagerSettings(this.settings);
    }
}
exports.ToolManager = ToolManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbC1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL3Rvb2wtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0M7QUFDcEMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQXdCN0IsaUNBQWlDO0FBQ2pDLE1BQU0sYUFBYSxHQUE0QztJQUMzRCxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLDhCQUE4QixFQUFFO0lBQ3JFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsbUNBQW1DLEVBQUU7SUFDekUsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsV0FBVyxFQUFFLGtDQUFrQyxFQUFFO0lBQzdFLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsc0JBQXNCLEVBQUU7SUFDOUQsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRTtJQUM5RCxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUseUNBQXlDLEVBQUU7SUFDbEYsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxpREFBaUQsRUFBRTtJQUN4RixFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsMkJBQTJCLEVBQUU7SUFDeEUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxzQ0FBc0MsRUFBRTtJQUM5RSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsa0NBQWtDLEVBQUU7SUFDN0UsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsV0FBVyxFQUFFLDBDQUEwQyxFQUFFO0lBQ3RGLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLFdBQVcsRUFBRSxtREFBbUQsRUFBRTtJQUNuRyxFQUFFLElBQUks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RSxtQkFBbUI7UUFDdEIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFDckQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFDRCxPQUFPLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU0sbUJBQW1CO1FBQ3RCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBQ3JELE9BQU87WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLGNBQWMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUM5RSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWU7WUFDL0MsY0FBYyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUN4QyxjQUFjLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjO1NBQy9DLENBQUM7SUFDTixDQUFDO0lBRU8sWUFBWTtRQUNoQixJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDSjtBQXBSRCxrQ0FvUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8qKiB2MiBmbGF0IHRvb2wgY29uZmlnIOKAlCBubyBtb3JlIGNhdGVnb3J5IGZpZWxkICovXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xDb25maWcge1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBlbmFibGVkOiBib29sZWFuO1xuICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9vbENvbmZpZ3VyYXRpb24ge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICAgIHRvb2xzOiBUb29sQ29uZmlnW107XG4gICAgY3JlYXRlZEF0OiBzdHJpbmc7XG4gICAgdXBkYXRlZEF0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVG9vbE1hbmFnZXJTZXR0aW5ncyB7XG4gICAgY29uZmlndXJhdGlvbnM6IFRvb2xDb25maWd1cmF0aW9uW107XG4gICAgY3VycmVudENvbmZpZ0lkOiBzdHJpbmc7XG4gICAgbWF4Q29uZmlnU2xvdHM6IG51bWJlcjtcbn1cblxuLyoqIEFsbCB2MiBtYW5hZ2VfKiB0b29sIG5hbWVzICovXG5jb25zdCBWMl9UT09MX05BTUVTOiB7IG5hbWU6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZyB9W10gPSBbXG4gICAgeyBuYW1lOiAnbWFuYWdlX3NjZW5lJywgZGVzY3JpcHRpb246ICdNYW5hZ2Ugc2NlbmVzIGluIHRoZSBwcm9qZWN0JyB9LFxuICAgIHsgbmFtZTogJ21hbmFnZV9ub2RlJywgZGVzY3JpcHRpb246ICdNYW5hZ2Ugbm9kZXMgaW4gdGhlIGN1cnJlbnQgc2NlbmUnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX2NvbXBvbmVudCcsIGRlc2NyaXB0aW9uOiAnTWFuYWdlIGNvbXBvbmVudHMgb24gc2NlbmUgbm9kZXMnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX3ByZWZhYicsIGRlc2NyaXB0aW9uOiAnTWFuYWdlIHByZWZhYiBhc3NldHMnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX2Fzc2V0JywgZGVzY3JpcHRpb246ICdNYW5hZ2UgcHJvamVjdCBhc3NldHMnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX3Byb2plY3QnLCBkZXNjcmlwdGlvbjogJ01hbmFnZSBwcm9qZWN0IGJ1aWxkLCBydW4sIGFuZCBzZXR0aW5ncycgfSxcbiAgICB7IG5hbWU6ICdtYW5hZ2VfZGVidWcnLCBkZXNjcmlwdGlvbjogJ0RlYnVnIHRvb2xzOiBjb25zb2xlLCBsb2dzLCBzY3JpcHRzLCB2YWxpZGF0aW9uJyB9LFxuICAgIHsgbmFtZTogJ21hbmFnZV9wcmVmZXJlbmNlcycsIGRlc2NyaXB0aW9uOiAnTWFuYWdlIGVkaXRvciBwcmVmZXJlbmNlcycgfSxcbiAgICB7IG5hbWU6ICdtYW5hZ2Vfc2VydmVyJywgZGVzY3JpcHRpb246ICdTZXJ2ZXIgbmV0d29yayBhbmQgY29ubmVjdGl2aXR5IGluZm8nIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX2Jyb2FkY2FzdCcsIGRlc2NyaXB0aW9uOiAnRWRpdG9yIGJyb2FkY2FzdCBldmVudCBsaXN0ZW5lcnMnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX3NjZW5lX3ZpZXcnLCBkZXNjcmlwdGlvbjogJ1NjZW5lIHZpZXcgZ2l6bW9zLCBjYW1lcmEsIGdyaWQgc2V0dGluZ3MnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX25vZGVfaGllcmFyY2h5JywgZGVzY3JpcHRpb246ICdBZHZhbmNlZCBub2RlIG9wZXJhdGlvbnM6IGNvcHksIHBhc3RlLCBjdXQsIHJlc2V0JyB9LFxuICAgIHsgbmFtZTogJ21hbmFnZV9zY2VuZV9xdWVyeScsIGRlc2NyaXB0aW9uOiAnU2NlbmUgaW50cm9zcGVjdGlvbiBhbmQgY2xhc3MgcXVlcmllcycgfSxcbiAgICB7IG5hbWU6ICdtYW5hZ2VfdW5kbycsIGRlc2NyaXB0aW9uOiAnVW5kby9yZWRvIHJlY29yZGluZyBhbmQgZXhlY3V0aW9uJyB9LFxuICAgIHsgbmFtZTogJ21hbmFnZV9yZWZlcmVuY2VfaW1hZ2UnLCBkZXNjcmlwdGlvbjogJ1JlZmVyZW5jZSBpbWFnZSBvdmVybGF5IG1hbmFnZW1lbnQnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX3ZhbGlkYXRpb24nLCBkZXNjcmlwdGlvbjogJ0pTT04gdmFsaWRhdGlvbiB1dGlsaXRpZXMnIH0sXG4gICAgeyBuYW1lOiAnbWFuYWdlX3NlbGVjdGlvbicsIGRlc2NyaXB0aW9uOiAnRWRpdG9yIHNlbGVjdGlvbiBzdGF0ZSBtYW5hZ2VtZW50JyB9LFxuICAgIHsgbmFtZTogJ21hbmFnZV9zY3JpcHQnLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgc2NyaXB0IGZpbGUgbWFuYWdlbWVudCcgfSxcbiAgICB7IG5hbWU6ICdtYW5hZ2VfbWF0ZXJpYWwnLCBkZXNjcmlwdGlvbjogJ01hdGVyaWFsIGFuZCBzaGFkZXIgcHJvcGVydHkgbWFuYWdlbWVudCcgfSxcbiAgICB7IG5hbWU6ICdtYW5hZ2VfYW5pbWF0aW9uJywgZGVzY3JpcHRpb246ICdBbmltYXRpb24gY2xpcCBtYW5hZ2VtZW50JyB9LFxuXTtcblxuZXhwb3J0IGNsYXNzIFRvb2xNYW5hZ2VyIHtcbiAgICBwcml2YXRlIHNldHRpbmdzOiBUb29sTWFuYWdlclNldHRpbmdzO1xuICAgIHByaXZhdGUgYXZhaWxhYmxlVG9vbHM6IFRvb2xDb25maWdbXSA9IFtdO1xuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MgPSB0aGlzLnJlYWRUb29sTWFuYWdlclNldHRpbmdzKCk7XG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUF2YWlsYWJsZVRvb2xzKCk7XG5cbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1Rvb2xNYW5hZ2VyXSBObyBjb25maWd1cmF0aW9ucyBmb3VuZCwgY3JlYXRpbmcgZGVmYXVsdC4uLicpO1xuICAgICAgICAgICAgdGhpcy5jcmVhdGVDb25maWd1cmF0aW9uKCdEZWZhdWx0JywgJ0F1dG8tY3JlYXRlZCBkZWZhdWx0IHRvb2wgY29uZmlndXJhdGlvbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zeW5jVG9vbExpc3QoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFRvb2xNYW5hZ2VyU2V0dGluZ3NQYXRoKCk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBwYXRoLmpvaW4oRWRpdG9yLlByb2plY3QucGF0aCwgJ3NldHRpbmdzJywgJ3Rvb2wtbWFuYWdlci5qc29uJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBlbnN1cmVTZXR0aW5nc0RpcigpOiB2b2lkIHtcbiAgICAgICAgY29uc3Qgc2V0dGluZ3NEaXIgPSBwYXRoLmRpcm5hbWUodGhpcy5nZXRUb29sTWFuYWdlclNldHRpbmdzUGF0aCgpKTtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzRGlyKSkge1xuICAgICAgICAgICAgZnMubWtkaXJTeW5jKHNldHRpbmdzRGlyLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgcmVhZFRvb2xNYW5hZ2VyU2V0dGluZ3MoKTogVG9vbE1hbmFnZXJTZXR0aW5ncyB7XG4gICAgICAgIGNvbnN0IERFRkFVTFQ6IFRvb2xNYW5hZ2VyU2V0dGluZ3MgPSB7XG4gICAgICAgICAgICBjb25maWd1cmF0aW9uczogW10sXG4gICAgICAgICAgICBjdXJyZW50Q29uZmlnSWQ6ICcnLFxuICAgICAgICAgICAgbWF4Q29uZmlnU2xvdHM6IDVcbiAgICAgICAgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdGhpcy5lbnN1cmVTZXR0aW5nc0RpcigpO1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NGaWxlID0gdGhpcy5nZXRUb29sTWFuYWdlclNldHRpbmdzUGF0aCgpO1xuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2V0dGluZ3NGaWxlKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NGaWxlLCAndXRmOCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IC4uLkRFRkFVTFQsIC4uLkpTT04ucGFyc2UoY29udGVudCkgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHJlYWQgdG9vbCBtYW5hZ2VyIHNldHRpbmdzOicsIGUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBERUZBVUxUO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2F2ZVRvb2xNYW5hZ2VyU2V0dGluZ3Moc2V0dGluZ3M6IFRvb2xNYW5hZ2VyU2V0dGluZ3MpOiB2b2lkIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRoaXMuZW5zdXJlU2V0dGluZ3NEaXIoKTtcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzRmlsZSA9IHRoaXMuZ2V0VG9vbE1hbmFnZXJTZXR0aW5nc1BhdGgoKTtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMoc2V0dGluZ3NGaWxlLCBKU09OLnN0cmluZ2lmeShzZXR0aW5ncywgbnVsbCwgMikpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSB0b29sIG1hbmFnZXIgc2V0dGluZ3M6JywgZSk7XG4gICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplQXZhaWxhYmxlVG9vbHMoKTogdm9pZCB7XG4gICAgICAgIHRoaXMuYXZhaWxhYmxlVG9vbHMgPSBWMl9UT09MX05BTUVTLm1hcCh0ID0+ICh7XG4gICAgICAgICAgICBuYW1lOiB0Lm5hbWUsXG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHQuZGVzY3JpcHRpb25cbiAgICAgICAgfSkpO1xuICAgICAgICBjb25zb2xlLmxvZyhgW1Rvb2xNYW5hZ2VyXSBJbml0aWFsaXplZCAke3RoaXMuYXZhaWxhYmxlVG9vbHMubGVuZ3RofSB2MiB0b29sc2ApO1xuICAgIH1cblxuICAgIC8qKiBTeW5jIHBlcnNpc3RlZCBjb25maWdzIHdpdGggY3VycmVudCB0b29sIGxpc3QgKGFkZCBuZXcgdG9vbHMsIHJlbW92ZSBzdGFsZSkgKi9cbiAgICBwcml2YXRlIHN5bmNUb29sTGlzdCgpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgY3VycmVudE5hbWVzID0gbmV3IFNldChWMl9UT09MX05BTUVTLm1hcCh0ID0+IHQubmFtZSkpO1xuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xuXG4gICAgICAgIGZvciAoY29uc3QgY29uZmlnIG9mIHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSB0b29scyB0aGF0IG5vIGxvbmdlciBleGlzdFxuICAgICAgICAgICAgY29uc3QgYmVmb3JlID0gY29uZmlnLnRvb2xzLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbmZpZy50b29scyA9IGNvbmZpZy50b29scy5maWx0ZXIodCA9PiBjdXJyZW50TmFtZXMuaGFzKHQubmFtZSkpO1xuICAgICAgICAgICAgaWYgKGNvbmZpZy50b29scy5sZW5ndGggIT09IGJlZm9yZSkgY2hhbmdlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIC8vIEFkZCBuZXcgdG9vbHMgdGhhdCBkb24ndCBleGlzdCBpbiBjb25maWdcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nTmFtZXMgPSBuZXcgU2V0KGNvbmZpZy50b29scy5tYXAodCA9PiB0Lm5hbWUpKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbCBvZiBWMl9UT09MX05BTUVTKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFleGlzdGluZ05hbWVzLmhhcyh0b29sLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy50b29scy5wdXNoKHsgbmFtZTogdG9vbC5uYW1lLCBlbmFibGVkOiB0cnVlLCBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbiB9KTtcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTeW5jIGRlc2NyaXB0aW9uc1xuICAgICAgICAgICAgY29uc3QgZGVzY01hcCA9IG5ldyBNYXAoVjJfVE9PTF9OQU1FUy5tYXAodCA9PiBbdC5uYW1lLCB0LmRlc2NyaXB0aW9uXSkpO1xuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIGNvbmZpZy50b29scykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlc2MgPSBkZXNjTWFwLmdldCh0b29sLm5hbWUpO1xuICAgICAgICAgICAgICAgIGlmIChkZXNjICYmIHRvb2wuZGVzY3JpcHRpb24gIT09IGRlc2MpIHtcbiAgICAgICAgICAgICAgICAgICAgdG9vbC5kZXNjcmlwdGlvbiA9IGRlc2M7XG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1Rvb2xNYW5hZ2VyXSBTeW5jZWQgdG9vbCBsaXN0IHdpdGggdjIgdG9vbHMnKTtcbiAgICAgICAgICAgIHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0QXZhaWxhYmxlVG9vbHMoKTogVG9vbENvbmZpZ1tdIHtcbiAgICAgICAgcmV0dXJuIFsuLi50aGlzLmF2YWlsYWJsZVRvb2xzXTtcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0Q29uZmlndXJhdGlvbnMoKTogVG9vbENvbmZpZ3VyYXRpb25bXSB7XG4gICAgICAgIHJldHVybiBbLi4udGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9uc107XG4gICAgfVxuXG4gICAgcHVibGljIGdldEN1cnJlbnRDb25maWd1cmF0aW9uKCk6IFRvb2xDb25maWd1cmF0aW9uIHwgbnVsbCB7XG4gICAgICAgIGlmICghdGhpcy5zZXR0aW5ncy5jdXJyZW50Q29uZmlnSWQpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5maW5kKGMgPT4gYy5pZCA9PT0gdGhpcy5zZXR0aW5ncy5jdXJyZW50Q29uZmlnSWQpIHx8IG51bGw7XG4gICAgfVxuXG4gICAgcHVibGljIGNyZWF0ZUNvbmZpZ3VyYXRpb24obmFtZTogc3RyaW5nLCBkZXNjcmlwdGlvbj86IHN0cmluZyk6IFRvb2xDb25maWd1cmF0aW9uIHtcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMubGVuZ3RoID49IHRoaXMuc2V0dGluZ3MubWF4Q29uZmlnU2xvdHMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTWF4aW11bSBjb25maWd1cmF0aW9uIHNsb3RzIHJlYWNoZWQgKCR7dGhpcy5zZXR0aW5ncy5tYXhDb25maWdTbG90c30pYCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb25maWc6IFRvb2xDb25maWd1cmF0aW9uID0ge1xuICAgICAgICAgICAgaWQ6IHV1aWR2NCgpLFxuICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgdG9vbHM6IHRoaXMuYXZhaWxhYmxlVG9vbHMubWFwKHQgPT4gKHsgLi4udCB9KSksXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5wdXNoKGNvbmZpZyk7XG4gICAgICAgIHRoaXMuc2V0dGluZ3MuY3VycmVudENvbmZpZ0lkID0gY29uZmlnLmlkO1xuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICByZXR1cm4gY29uZmlnO1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVDb25maWd1cmF0aW9uKGNvbmZpZ0lkOiBzdHJpbmcsIHVwZGF0ZXM6IFBhcnRpYWw8VG9vbENvbmZpZ3VyYXRpb24+KTogVG9vbENvbmZpZ3VyYXRpb24ge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcblxuICAgICAgICBjb25zdCBjb25maWcgPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zW2lkeF07XG4gICAgICAgIGNvbnN0IHVwZGF0ZWQ6IFRvb2xDb25maWd1cmF0aW9uID0ge1xuICAgICAgICAgICAgLi4uY29uZmlnLFxuICAgICAgICAgICAgLi4udXBkYXRlcyxcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9uc1tpZHhdID0gdXBkYXRlZDtcbiAgICAgICAgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgcmV0dXJuIHVwZGF0ZWQ7XG4gICAgfVxuXG4gICAgcHVibGljIGRlbGV0ZUNvbmZpZ3VyYXRpb24oY29uZmlnSWQ6IHN0cmluZyk6IHZvaWQge1xuICAgICAgICBjb25zdCBpZHggPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcblxuICAgICAgICB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLnNwbGljZShpZHgsIDEpO1xuXG4gICAgICAgIGlmICh0aGlzLnNldHRpbmdzLmN1cnJlbnRDb25maWdJZCA9PT0gY29uZmlnSWQpIHtcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MuY3VycmVudENvbmZpZ0lkID0gdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgPyB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zWzBdLmlkXG4gICAgICAgICAgICAgICAgOiAnJztcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBzZXRDdXJyZW50Q29uZmlndXJhdGlvbihjb25maWdJZDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMuZmluZChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcbiAgICAgICAgaWYgKCFjb25maWcpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5jdXJyZW50Q29uZmlnSWQgPSBjb25maWdJZDtcbiAgICAgICAgdGhpcy5zYXZlU2V0dGluZ3MoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlVG9vbFN0YXR1cyhjb25maWdJZDogc3RyaW5nLCB0b29sTmFtZTogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMuZmluZChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcbiAgICAgICAgaWYgKCFjb25maWcpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcblxuICAgICAgICBjb25zdCB0b29sID0gY29uZmlnLnRvb2xzLmZpbmQodCA9PiB0Lm5hbWUgPT09IHRvb2xOYW1lKTtcbiAgICAgICAgaWYgKCF0b29sKSB0aHJvdyBuZXcgRXJyb3IoYFRvb2wgJyR7dG9vbE5hbWV9JyBub3QgZm91bmRgKTtcblxuICAgICAgICB0b29sLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICBjb25maWcudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVUb29sU3RhdHVzQmF0Y2goY29uZmlnSWQ6IHN0cmluZywgdXBkYXRlczogeyBuYW1lOiBzdHJpbmc7IGVuYWJsZWQ6IGJvb2xlYW4gfVtdKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMuZmluZChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcbiAgICAgICAgaWYgKCFjb25maWcpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcblxuICAgICAgICBmb3IgKGNvbnN0IHVwZGF0ZSBvZiB1cGRhdGVzKSB7XG4gICAgICAgICAgICBjb25zdCB0b29sID0gY29uZmlnLnRvb2xzLmZpbmQodCA9PiB0Lm5hbWUgPT09IHVwZGF0ZS5uYW1lKTtcbiAgICAgICAgICAgIGlmICh0b29sKSB7XG4gICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gdXBkYXRlLmVuYWJsZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25maWcudXBkYXRlZEF0ID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xuICAgIH1cblxuICAgIHB1YmxpYyBleHBvcnRDb25maWd1cmF0aW9uKGNvbmZpZ0lkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBjb25maWcgPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLmZpbmQoYyA9PiBjLmlkID09PSBjb25maWdJZCk7XG4gICAgICAgIGlmICghY29uZmlnKSB0aHJvdyBuZXcgRXJyb3IoJ0NvbmZpZ3VyYXRpb24gbm90IGZvdW5kJyk7XG4gICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShjb25maWcsIG51bGwsIDIpO1xuICAgIH1cblxuICAgIHB1YmxpYyBpbXBvcnRDb25maWd1cmF0aW9uKGNvbmZpZ0pzb246IHN0cmluZyk6IFRvb2xDb25maWd1cmF0aW9uIHtcbiAgICAgICAgY29uc3QgcmF3ID0gSlNPTi5wYXJzZShjb25maWdKc29uKTtcblxuICAgICAgICAvLyBWYWxpZGF0ZSByZXF1aXJlZCB0b3AtbGV2ZWwgZmllbGRzXG4gICAgICAgIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29uZmlndXJhdGlvbiBmb3JtYXQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIHJhdy5uYW1lICE9PSAnc3RyaW5nJyB8fCAhcmF3Lm5hbWUudHJpbSgpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29uZmlndXJhdGlvbiBmb3JtYXQ6IG5hbWUgbXVzdCBiZSBhIG5vbi1lbXB0eSBzdHJpbmcnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocmF3LnRvb2xzKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbmZpZ3VyYXRpb24gZm9ybWF0OiB0b29scyBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBWYWxpZGF0ZSBhbmQgc2FuaXRpemUgZWFjaCB0b29sIGVudHJ5IOKAlCBvbmx5IGtlZXAga25vd24gZmllbGRzIHdpdGggY29ycmVjdCB0eXBlc1xuICAgICAgICBjb25zdCBzYW5pdGl6ZWRUb29sczogVG9vbENvbmZpZ1tdID0gW107XG4gICAgICAgIGZvciAoY29uc3QgdG9vbCBvZiByYXcudG9vbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdG9vbC5uYW1lICE9PSAnc3RyaW5nJyB8fCB0eXBlb2YgdG9vbC5lbmFibGVkICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdG9vbCBlbnRyeTogbmFtZSBtdXN0IGJlIHN0cmluZyBhbmQgZW5hYmxlZCBtdXN0IGJlIGJvb2xlYW5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNhbml0aXplZFRvb2xzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0b29sLmVuYWJsZWQsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHR5cGVvZiB0b29sLmRlc2NyaXB0aW9uID09PSAnc3RyaW5nJyA/IHRvb2wuZGVzY3JpcHRpb24gOiAnJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5sZW5ndGggPj0gdGhpcy5zZXR0aW5ncy5tYXhDb25maWdTbG90cykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNYXhpbXVtIGNvbmZpZ3VyYXRpb24gc2xvdHMgcmVhY2hlZCAoJHt0aGlzLnNldHRpbmdzLm1heENvbmZpZ1Nsb3RzfSlgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJ1aWxkIGEgY2xlYW4gY29uZmlnIG9iamVjdCDigJQgZGlzY2FyZCBhbnkgdW5leHBlY3RlZCBmaWVsZHMgZnJvbSBpbnB1dFxuICAgICAgICBjb25zdCBjb25maWc6IFRvb2xDb25maWd1cmF0aW9uID0ge1xuICAgICAgICAgICAgaWQ6IHV1aWR2NCgpLFxuICAgICAgICAgICAgbmFtZTogcmF3Lm5hbWUudHJpbSgpLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IHR5cGVvZiByYXcuZGVzY3JpcHRpb24gPT09ICdzdHJpbmcnID8gcmF3LmRlc2NyaXB0aW9uIDogJycsXG4gICAgICAgICAgICB0b29sczogc2FuaXRpemVkVG9vbHMsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5wdXNoKGNvbmZpZyk7XG4gICAgICAgIHRoaXMuc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIHJldHVybiBjb25maWc7XG4gICAgfVxuXG4gICAgLyoqIFJldHVybnMgZmxhdCBhcnJheSBvZiBlbmFibGVkIHRvb2wgbmFtZXMgZm9yIE1DUCBzZXJ2ZXIgZmlsdGVyaW5nICovXG4gICAgcHVibGljIGdldEVuYWJsZWRUb29sTmFtZXMoKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBjdXJyZW50Q29uZmlnID0gdGhpcy5nZXRDdXJyZW50Q29uZmlndXJhdGlvbigpO1xuICAgICAgICBpZiAoIWN1cnJlbnRDb25maWcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmF2YWlsYWJsZVRvb2xzLmZpbHRlcih0ID0+IHQuZW5hYmxlZCkubWFwKHQgPT4gdC5uYW1lKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3VycmVudENvbmZpZy50b29scy5maWx0ZXIodCA9PiB0LmVuYWJsZWQpLm1hcCh0ID0+IHQubmFtZSk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldFRvb2xNYW5hZ2VyU3RhdGUoKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRDb25maWcgPSB0aGlzLmdldEN1cnJlbnRDb25maWd1cmF0aW9uKCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgYXZhaWxhYmxlVG9vbHM6IGN1cnJlbnRDb25maWcgPyBjdXJyZW50Q29uZmlnLnRvb2xzIDogdGhpcy5nZXRBdmFpbGFibGVUb29scygpLFxuICAgICAgICAgICAgc2VsZWN0ZWRDb25maWdJZDogdGhpcy5zZXR0aW5ncy5jdXJyZW50Q29uZmlnSWQsXG4gICAgICAgICAgICBjb25maWd1cmF0aW9uczogdGhpcy5nZXRDb25maWd1cmF0aW9ucygpLFxuICAgICAgICAgICAgbWF4Q29uZmlnU2xvdHM6IHRoaXMuc2V0dGluZ3MubWF4Q29uZmlnU2xvdHNcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHNhdmVTZXR0aW5ncygpOiB2b2lkIHtcbiAgICAgICAgdGhpcy5zYXZlVG9vbE1hbmFnZXJTZXR0aW5ncyh0aGlzLnNldHRpbmdzKTtcbiAgICB9XG59XG4iXX0=