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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbC1tYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL3Rvb2wtbWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwrQkFBb0M7QUFDcEMsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQXdCN0IsaUNBQWlDO0FBQ2pDLE1BQU0sYUFBYSxHQUE0QztJQUMzRCxFQUFFLElBQUksRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLDhCQUE4QixFQUFFO0lBQ3JFLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsbUNBQW1DLEVBQUU7SUFDekUsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsV0FBVyxFQUFFLGtDQUFrQyxFQUFFO0lBQzdFLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsc0JBQXNCLEVBQUU7SUFDOUQsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRTtJQUM5RCxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBRSxXQUFXLEVBQUUseUNBQXlDLEVBQUU7SUFDbEYsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxpREFBaUQsRUFBRTtJQUN4RixFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsMkJBQTJCLEVBQUU7SUFDeEUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLFdBQVcsRUFBRSxzQ0FBc0MsRUFBRTtJQUM5RSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsa0NBQWtDLEVBQUU7SUFDN0UsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsV0FBVyxFQUFFLDBDQUEwQyxFQUFFO0lBQ3RGLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFFLFdBQVcsRUFBRSxtREFBbUQsRUFBRTtJQUNuRyxFQUFFLElBQUksRUFBRSxvQkFBb0IsRUFBRSxXQUFXLEVBQUUsdUNBQXVDLEVBQUU7SUFDcEYsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxtQ0FBbUMsRUFBRTtJQUN6RSxFQUFFLElBQUksRUFBRSx3QkFBd0IsRUFBRSxXQUFXLEVBQUUsb0NBQW9DLEVBQUU7SUFDckYsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsV0FBVyxFQUFFLDJCQUEyQixFQUFFO0lBQ3ZFLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLFdBQVcsRUFBRSxtQ0FBbUMsRUFBRTtJQUM5RSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsV0FBVyxFQUFFLG1DQUFtQyxFQUFFO0lBQzNFLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFFLFdBQVcsRUFBRSx5Q0FBeUMsRUFBRTtJQUNuRixFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxXQUFXLEVBQUUsMkJBQTJCLEVBQUU7Q0FDekUsQ0FBQztBQUVGLE1BQWEsV0FBVztJQUlwQjtRQUZRLG1CQUFjLEdBQWlCLEVBQUUsQ0FBQztRQUd0QyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBQy9DLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBRWhDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzVDLE9BQU8sQ0FBQyxHQUFHLENBQUMsNERBQTRELENBQUMsQ0FBQztZQUMxRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLENBQUM7UUFDbkYsQ0FBQztRQUVELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRU8sMEJBQTBCO1FBQzlCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztJQUMzRSxDQUFDO0lBRU8saUJBQWlCO1FBQ3JCLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNwRSxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQzlCLEVBQUUsQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyx1QkFBdUI7UUFDM0IsTUFBTSxPQUFPLEdBQXdCO1lBQ2pDLGNBQWMsRUFBRSxFQUFFO1lBQ2xCLGVBQWUsRUFBRSxFQUFFO1lBQ25CLGNBQWMsRUFBRSxDQUFDO1NBQ3BCLENBQUM7UUFFRixJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN6QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztZQUN2RCxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxPQUFPLEdBQUcsRUFBRSxDQUFDLFlBQVksQ0FBQyxZQUFZLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3RELHVDQUFZLE9BQU8sR0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxFQUFHO1lBQ2xELENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsdUNBQXVDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDOUQsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7SUFFTyx1QkFBdUIsQ0FBQyxRQUE2QjtRQUN6RCxJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN6QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztZQUN2RCxFQUFFLENBQUMsYUFBYSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsdUNBQXVDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDMUQsTUFBTSxDQUFDLENBQUM7UUFDWixDQUFDO0lBQ0wsQ0FBQztJQUVPLHdCQUF3QjtRQUM1QixJQUFJLENBQUMsY0FBYyxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSTtZQUNaLE9BQU8sRUFBRSxJQUFJO1lBQ2IsV0FBVyxFQUFFLENBQUMsQ0FBQyxXQUFXO1NBQzdCLENBQUMsQ0FBQyxDQUFDO1FBQ0osT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLFdBQVcsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFFRCxrRkFBa0Y7SUFDMUUsWUFBWTtRQUNoQixNQUFNLFlBQVksR0FBRyxJQUFJLEdBQUcsQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDN0QsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBRXBCLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUNoRCxvQ0FBb0M7WUFDcEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDbkMsTUFBTSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbEUsSUFBSSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sS0FBSyxNQUFNO2dCQUFFLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFFbkQsMkNBQTJDO1lBQzNDLE1BQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDN0QsS0FBSyxNQUFNLElBQUksSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFDL0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7b0JBQ2hDLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7b0JBQ3JGLE9BQU8sR0FBRyxJQUFJLENBQUM7Z0JBQ25CLENBQUM7WUFDTCxDQUFDO1lBRUQsb0JBQW9CO1lBQ3BCLE1BQU0sT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RSxLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDOUIsTUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3BDLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssSUFBSSxFQUFFLENBQUM7b0JBQ3BDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO29CQUN4QixPQUFPLEdBQUcsSUFBSSxDQUFDO2dCQUNuQixDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1YsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1lBQzVELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUN4QixDQUFDO0lBQ0wsQ0FBQztJQUVNLGlCQUFpQjtRQUNwQixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVNLGlCQUFpQjtRQUNwQixPQUFPLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFTSx1QkFBdUI7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ2hELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksQ0FBQztJQUNsRyxDQUFDO0lBRU0sbUJBQW1CLENBQUMsSUFBWSxFQUFFLFdBQW9CO1FBQ3pELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDdEUsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBd0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxDQUFDO1FBQzdGLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBc0I7WUFDOUIsRUFBRSxFQUFFLElBQUEsU0FBTSxHQUFFO1lBQ1osSUFBSTtZQUNKLFdBQVc7WUFDWCxLQUFLLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxtQkFBTSxDQUFDLEVBQUcsQ0FBQztZQUMvQyxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7WUFDbkMsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1NBQ3RDLENBQUM7UUFFRixJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQztRQUMxQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDcEIsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztJQUVNLG1CQUFtQixDQUFDLFFBQWdCLEVBQUUsT0FBbUM7UUFDNUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQztRQUMzRSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUM7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFFM0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDakQsTUFBTSxPQUFPLGlEQUNOLE1BQU0sR0FDTixPQUFPLEtBQ1YsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEdBQ3RDLENBQUM7UUFFRixJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUM7UUFDNUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ3BCLE9BQU8sT0FBTyxDQUFDO0lBQ25CLENBQUM7SUFFTSxtQkFBbUIsQ0FBQyxRQUFnQjtRQUN2QyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1FBQzNFLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQztZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUUzRCxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBRTVDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsTUFBTSxHQUFHLENBQUM7Z0JBQ25FLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNwQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ2IsQ0FBQztRQUNELElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRU0sdUJBQXVCLENBQUMsUUFBZ0I7UUFDM0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQztRQUN6RSxJQUFJLENBQUMsTUFBTTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsR0FBRyxRQUFRLENBQUM7UUFDekMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFTSxnQkFBZ0IsQ0FBQyxRQUFnQixFQUFFLFFBQWdCLEVBQUUsT0FBZ0I7UUFDeEUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQztRQUN6RSxJQUFJLENBQUMsTUFBTTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUV4RCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLElBQUk7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsUUFBUSxhQUFhLENBQUMsQ0FBQztRQUUzRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDNUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFTSxxQkFBcUIsQ0FBQyxRQUFnQixFQUFFLE9BQTZDO1FBQ3hGLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssUUFBUSxDQUFDLENBQUM7UUFDekUsSUFBSSxDQUFDLE1BQU07WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7UUFFeEQsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUMzQixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzVELElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQ1AsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO1lBQ2xDLENBQUM7UUFDTCxDQUFDO1FBRUQsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzVDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRU0sbUJBQW1CLENBQUMsUUFBZ0I7UUFDdkMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQztRQUN6RSxJQUFJLENBQUMsTUFBTTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUN4RCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRU0sbUJBQW1CLENBQUMsVUFBa0I7UUFDekMsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVuQyxxQ0FBcUM7UUFDckMsSUFBSSxDQUFDLEdBQUcsSUFBSSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7UUFDcEQsQ0FBQztRQUNELElBQUksT0FBTyxHQUFHLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUNuRCxNQUFNLElBQUksS0FBSyxDQUFDLCtEQUErRCxDQUFDLENBQUM7UUFDckYsQ0FBQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztRQUM1RSxDQUFDO1FBRUQsb0ZBQW9GO1FBQ3BGLE1BQU0sY0FBYyxHQUFpQixFQUFFLENBQUM7UUFDeEMsS0FBSyxNQUFNLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDM0IsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDckUsTUFBTSxJQUFJLEtBQUssQ0FBQyxxRUFBcUUsQ0FBQyxDQUFDO1lBQzNGLENBQUM7WUFDRCxjQUFjLENBQUMsSUFBSSxDQUFDO2dCQUNoQixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPO2dCQUNyQixXQUFXLEVBQUUsT0FBTyxJQUFJLENBQUMsV0FBVyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRTthQUM1RSxDQUFDLENBQUM7UUFDUCxDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUN0RSxNQUFNLElBQUksS0FBSyxDQUFDLHdDQUF3QyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsR0FBRyxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUVELHlFQUF5RTtRQUN6RSxNQUFNLE1BQU0sR0FBc0I7WUFDOUIsRUFBRSxFQUFFLElBQUEsU0FBTSxHQUFFO1lBQ1osSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ3JCLFdBQVcsRUFBRSxPQUFPLEdBQUcsQ0FBQyxXQUFXLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3ZFLEtBQUssRUFBRSxjQUFjO1lBQ3JCLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtZQUNuQyxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUU7U0FDdEMsQ0FBQztRQUVGLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7UUFDcEIsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztJQUVELHdFQUF3RTtJQUNqRSxtQkFBbUI7UUFDdEIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFDckQsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFDRCxPQUFPLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBRU0sbUJBQW1CO1FBQ3RCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1FBQ3JELE9BQU87WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLGNBQWMsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUM5RSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWU7WUFDL0MsY0FBYyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUN4QyxjQUFjLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjO1NBQy9DLENBQUM7SUFDTixDQUFDO0lBRU8sWUFBWTtRQUNoQixJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ2hELENBQUM7Q0FDSjtBQXBSRCxrQ0FvUkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB2NCBhcyB1dWlkdjQgfSBmcm9tICd1dWlkJztcclxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5cclxuLyoqIHYyIGZsYXQgdG9vbCBjb25maWcg4oCUIG5vIG1vcmUgY2F0ZWdvcnkgZmllbGQgKi9cclxuZXhwb3J0IGludGVyZmFjZSBUb29sQ29uZmlnIHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGVuYWJsZWQ6IGJvb2xlYW47XHJcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xDb25maWd1cmF0aW9uIHtcclxuICAgIGlkOiBzdHJpbmc7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBkZXNjcmlwdGlvbj86IHN0cmluZztcclxuICAgIHRvb2xzOiBUb29sQ29uZmlnW107XHJcbiAgICBjcmVhdGVkQXQ6IHN0cmluZztcclxuICAgIHVwZGF0ZWRBdDogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xNYW5hZ2VyU2V0dGluZ3Mge1xyXG4gICAgY29uZmlndXJhdGlvbnM6IFRvb2xDb25maWd1cmF0aW9uW107XHJcbiAgICBjdXJyZW50Q29uZmlnSWQ6IHN0cmluZztcclxuICAgIG1heENvbmZpZ1Nsb3RzOiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKiBBbGwgdjIgbWFuYWdlXyogdG9vbCBuYW1lcyAqL1xyXG5jb25zdCBWMl9UT09MX05BTUVTOiB7IG5hbWU6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZyB9W10gPSBbXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2Vfc2NlbmUnLCBkZXNjcmlwdGlvbjogJ01hbmFnZSBzY2VuZXMgaW4gdGhlIHByb2plY3QnIH0sXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2Vfbm9kZScsIGRlc2NyaXB0aW9uOiAnTWFuYWdlIG5vZGVzIGluIHRoZSBjdXJyZW50IHNjZW5lJyB9LFxyXG4gICAgeyBuYW1lOiAnbWFuYWdlX2NvbXBvbmVudCcsIGRlc2NyaXB0aW9uOiAnTWFuYWdlIGNvbXBvbmVudHMgb24gc2NlbmUgbm9kZXMnIH0sXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2VfcHJlZmFiJywgZGVzY3JpcHRpb246ICdNYW5hZ2UgcHJlZmFiIGFzc2V0cycgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9hc3NldCcsIGRlc2NyaXB0aW9uOiAnTWFuYWdlIHByb2plY3QgYXNzZXRzJyB9LFxyXG4gICAgeyBuYW1lOiAnbWFuYWdlX3Byb2plY3QnLCBkZXNjcmlwdGlvbjogJ01hbmFnZSBwcm9qZWN0IGJ1aWxkLCBydW4sIGFuZCBzZXR0aW5ncycgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9kZWJ1ZycsIGRlc2NyaXB0aW9uOiAnRGVidWcgdG9vbHM6IGNvbnNvbGUsIGxvZ3MsIHNjcmlwdHMsIHZhbGlkYXRpb24nIH0sXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2VfcHJlZmVyZW5jZXMnLCBkZXNjcmlwdGlvbjogJ01hbmFnZSBlZGl0b3IgcHJlZmVyZW5jZXMnIH0sXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2Vfc2VydmVyJywgZGVzY3JpcHRpb246ICdTZXJ2ZXIgbmV0d29yayBhbmQgY29ubmVjdGl2aXR5IGluZm8nIH0sXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2VfYnJvYWRjYXN0JywgZGVzY3JpcHRpb246ICdFZGl0b3IgYnJvYWRjYXN0IGV2ZW50IGxpc3RlbmVycycgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9zY2VuZV92aWV3JywgZGVzY3JpcHRpb246ICdTY2VuZSB2aWV3IGdpem1vcywgY2FtZXJhLCBncmlkIHNldHRpbmdzJyB9LFxyXG4gICAgeyBuYW1lOiAnbWFuYWdlX25vZGVfaGllcmFyY2h5JywgZGVzY3JpcHRpb246ICdBZHZhbmNlZCBub2RlIG9wZXJhdGlvbnM6IGNvcHksIHBhc3RlLCBjdXQsIHJlc2V0JyB9LFxyXG4gICAgeyBuYW1lOiAnbWFuYWdlX3NjZW5lX3F1ZXJ5JywgZGVzY3JpcHRpb246ICdTY2VuZSBpbnRyb3NwZWN0aW9uIGFuZCBjbGFzcyBxdWVyaWVzJyB9LFxyXG4gICAgeyBuYW1lOiAnbWFuYWdlX3VuZG8nLCBkZXNjcmlwdGlvbjogJ1VuZG8vcmVkbyByZWNvcmRpbmcgYW5kIGV4ZWN1dGlvbicgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9yZWZlcmVuY2VfaW1hZ2UnLCBkZXNjcmlwdGlvbjogJ1JlZmVyZW5jZSBpbWFnZSBvdmVybGF5IG1hbmFnZW1lbnQnIH0sXHJcbiAgICB7IG5hbWU6ICdtYW5hZ2VfdmFsaWRhdGlvbicsIGRlc2NyaXB0aW9uOiAnSlNPTiB2YWxpZGF0aW9uIHV0aWxpdGllcycgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9zZWxlY3Rpb24nLCBkZXNjcmlwdGlvbjogJ0VkaXRvciBzZWxlY3Rpb24gc3RhdGUgbWFuYWdlbWVudCcgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9zY3JpcHQnLCBkZXNjcmlwdGlvbjogJ1R5cGVTY3JpcHQgc2NyaXB0IGZpbGUgbWFuYWdlbWVudCcgfSxcclxuICAgIHsgbmFtZTogJ21hbmFnZV9tYXRlcmlhbCcsIGRlc2NyaXB0aW9uOiAnTWF0ZXJpYWwgYW5kIHNoYWRlciBwcm9wZXJ0eSBtYW5hZ2VtZW50JyB9LFxyXG4gICAgeyBuYW1lOiAnbWFuYWdlX2FuaW1hdGlvbicsIGRlc2NyaXB0aW9uOiAnQW5pbWF0aW9uIGNsaXAgbWFuYWdlbWVudCcgfSxcclxuXTtcclxuXHJcbmV4cG9ydCBjbGFzcyBUb29sTWFuYWdlciB7XHJcbiAgICBwcml2YXRlIHNldHRpbmdzOiBUb29sTWFuYWdlclNldHRpbmdzO1xyXG4gICAgcHJpdmF0ZSBhdmFpbGFibGVUb29sczogVG9vbENvbmZpZ1tdID0gW107XHJcblxyXG4gICAgY29uc3RydWN0b3IoKSB7XHJcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IHRoaXMucmVhZFRvb2xNYW5hZ2VyU2V0dGluZ3MoKTtcclxuICAgICAgICB0aGlzLmluaXRpYWxpemVBdmFpbGFibGVUb29scygpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tUb29sTWFuYWdlcl0gTm8gY29uZmlndXJhdGlvbnMgZm91bmQsIGNyZWF0aW5nIGRlZmF1bHQuLi4nKTtcclxuICAgICAgICAgICAgdGhpcy5jcmVhdGVDb25maWd1cmF0aW9uKCdEZWZhdWx0JywgJ0F1dG8tY3JlYXRlZCBkZWZhdWx0IHRvb2wgY29uZmlndXJhdGlvbicpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5zeW5jVG9vbExpc3QoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGdldFRvb2xNYW5hZ2VyU2V0dGluZ3NQYXRoKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGguam9pbihFZGl0b3IuUHJvamVjdC5wYXRoLCAnc2V0dGluZ3MnLCAndG9vbC1tYW5hZ2VyLmpzb24nKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGVuc3VyZVNldHRpbmdzRGlyKCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IHNldHRpbmdzRGlyID0gcGF0aC5kaXJuYW1lKHRoaXMuZ2V0VG9vbE1hbmFnZXJTZXR0aW5nc1BhdGgoKSk7XHJcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNldHRpbmdzRGlyKSkge1xyXG4gICAgICAgICAgICBmcy5ta2RpclN5bmMoc2V0dGluZ3NEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHJlYWRUb29sTWFuYWdlclNldHRpbmdzKCk6IFRvb2xNYW5hZ2VyU2V0dGluZ3Mge1xyXG4gICAgICAgIGNvbnN0IERFRkFVTFQ6IFRvb2xNYW5hZ2VyU2V0dGluZ3MgPSB7XHJcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiBbXSxcclxuICAgICAgICAgICAgY3VycmVudENvbmZpZ0lkOiAnJyxcclxuICAgICAgICAgICAgbWF4Q29uZmlnU2xvdHM6IDVcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB0aGlzLmVuc3VyZVNldHRpbmdzRGlyKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNldHRpbmdzRmlsZSA9IHRoaXMuZ2V0VG9vbE1hbmFnZXJTZXR0aW5nc1BhdGgoKTtcclxuICAgICAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoc2V0dGluZ3NGaWxlKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhzZXR0aW5nc0ZpbGUsICd1dGY4Jyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyAuLi5ERUZBVUxULCAuLi5KU09OLnBhcnNlKGNvbnRlbnQpIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byByZWFkIHRvb2wgbWFuYWdlciBzZXR0aW5nczonLCBlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIERFRkFVTFQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzYXZlVG9vbE1hbmFnZXJTZXR0aW5ncyhzZXR0aW5nczogVG9vbE1hbmFnZXJTZXR0aW5ncyk6IHZvaWQge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW5zdXJlU2V0dGluZ3NEaXIoKTtcclxuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NGaWxlID0gdGhpcy5nZXRUb29sTWFuYWdlclNldHRpbmdzUGF0aCgpO1xyXG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHNldHRpbmdzRmlsZSwgSlNPTi5zdHJpbmdpZnkoc2V0dGluZ3MsIG51bGwsIDIpKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIHRvb2wgbWFuYWdlciBzZXR0aW5nczonLCBlKTtcclxuICAgICAgICAgICAgdGhyb3cgZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplQXZhaWxhYmxlVG9vbHMoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5hdmFpbGFibGVUb29scyA9IFYyX1RPT0xfTkFNRVMubWFwKHQgPT4gKHtcclxuICAgICAgICAgICAgbmFtZTogdC5uYW1lLFxyXG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogdC5kZXNjcmlwdGlvblxyXG4gICAgICAgIH0pKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW1Rvb2xNYW5hZ2VyXSBJbml0aWFsaXplZCAke3RoaXMuYXZhaWxhYmxlVG9vbHMubGVuZ3RofSB2MiB0b29sc2ApO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiBTeW5jIHBlcnNpc3RlZCBjb25maWdzIHdpdGggY3VycmVudCB0b29sIGxpc3QgKGFkZCBuZXcgdG9vbHMsIHJlbW92ZSBzdGFsZSkgKi9cclxuICAgIHByaXZhdGUgc3luY1Rvb2xMaXN0KCk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGN1cnJlbnROYW1lcyA9IG5ldyBTZXQoVjJfVE9PTF9OQU1FUy5tYXAodCA9PiB0Lm5hbWUpKTtcclxuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IGNvbmZpZyBvZiB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zKSB7XHJcbiAgICAgICAgICAgIC8vIFJlbW92ZSB0b29scyB0aGF0IG5vIGxvbmdlciBleGlzdFxyXG4gICAgICAgICAgICBjb25zdCBiZWZvcmUgPSBjb25maWcudG9vbHMubGVuZ3RoO1xyXG4gICAgICAgICAgICBjb25maWcudG9vbHMgPSBjb25maWcudG9vbHMuZmlsdGVyKHQgPT4gY3VycmVudE5hbWVzLmhhcyh0Lm5hbWUpKTtcclxuICAgICAgICAgICAgaWYgKGNvbmZpZy50b29scy5sZW5ndGggIT09IGJlZm9yZSkgY2hhbmdlZCA9IHRydWU7XHJcblxyXG4gICAgICAgICAgICAvLyBBZGQgbmV3IHRvb2xzIHRoYXQgZG9uJ3QgZXhpc3QgaW4gY29uZmlnXHJcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nTmFtZXMgPSBuZXcgU2V0KGNvbmZpZy50b29scy5tYXAodCA9PiB0Lm5hbWUpKTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIFYyX1RPT0xfTkFNRVMpIHtcclxuICAgICAgICAgICAgICAgIGlmICghZXhpc3RpbmdOYW1lcy5oYXModG9vbC5uYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbmZpZy50b29scy5wdXNoKHsgbmFtZTogdG9vbC5uYW1lLCBlbmFibGVkOiB0cnVlLCBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbiB9KTtcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gU3luYyBkZXNjcmlwdGlvbnNcclxuICAgICAgICAgICAgY29uc3QgZGVzY01hcCA9IG5ldyBNYXAoVjJfVE9PTF9OQU1FUy5tYXAodCA9PiBbdC5uYW1lLCB0LmRlc2NyaXB0aW9uXSkpO1xyXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2wgb2YgY29uZmlnLnRvb2xzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBkZXNjID0gZGVzY01hcC5nZXQodG9vbC5uYW1lKTtcclxuICAgICAgICAgICAgICAgIGlmIChkZXNjICYmIHRvb2wuZGVzY3JpcHRpb24gIT09IGRlc2MpIHtcclxuICAgICAgICAgICAgICAgICAgICB0b29sLmRlc2NyaXB0aW9uID0gZGVzYztcclxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGNoYW5nZWQpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tUb29sTWFuYWdlcl0gU3luY2VkIHRvb2wgbGlzdCB3aXRoIHYyIHRvb2xzJyk7XHJcbiAgICAgICAgICAgIHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBnZXRBdmFpbGFibGVUb29scygpOiBUb29sQ29uZmlnW10ge1xyXG4gICAgICAgIHJldHVybiBbLi4udGhpcy5hdmFpbGFibGVUb29sc107XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGdldENvbmZpZ3VyYXRpb25zKCk6IFRvb2xDb25maWd1cmF0aW9uW10ge1xyXG4gICAgICAgIHJldHVybiBbLi4udGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9uc107XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGdldEN1cnJlbnRDb25maWd1cmF0aW9uKCk6IFRvb2xDb25maWd1cmF0aW9uIHwgbnVsbCB7XHJcbiAgICAgICAgaWYgKCF0aGlzLnNldHRpbmdzLmN1cnJlbnRDb25maWdJZCkgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMuZmluZChjID0+IGMuaWQgPT09IHRoaXMuc2V0dGluZ3MuY3VycmVudENvbmZpZ0lkKSB8fCBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBjcmVhdGVDb25maWd1cmF0aW9uKG5hbWU6IHN0cmluZywgZGVzY3JpcHRpb24/OiBzdHJpbmcpOiBUb29sQ29uZmlndXJhdGlvbiB7XHJcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMubGVuZ3RoID49IHRoaXMuc2V0dGluZ3MubWF4Q29uZmlnU2xvdHMpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNYXhpbXVtIGNvbmZpZ3VyYXRpb24gc2xvdHMgcmVhY2hlZCAoJHt0aGlzLnNldHRpbmdzLm1heENvbmZpZ1Nsb3RzfSlgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGNvbmZpZzogVG9vbENvbmZpZ3VyYXRpb24gPSB7XHJcbiAgICAgICAgICAgIGlkOiB1dWlkdjQoKSxcclxuICAgICAgICAgICAgbmFtZSxcclxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXHJcbiAgICAgICAgICAgIHRvb2xzOiB0aGlzLmF2YWlsYWJsZVRvb2xzLm1hcCh0ID0+ICh7IC4uLnQgfSkpLFxyXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLnB1c2goY29uZmlnKTtcclxuICAgICAgICB0aGlzLnNldHRpbmdzLmN1cnJlbnRDb25maWdJZCA9IGNvbmZpZy5pZDtcclxuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIHJldHVybiBjb25maWc7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHVwZGF0ZUNvbmZpZ3VyYXRpb24oY29uZmlnSWQ6IHN0cmluZywgdXBkYXRlczogUGFydGlhbDxUb29sQ29uZmlndXJhdGlvbj4pOiBUb29sQ29uZmlndXJhdGlvbiB7XHJcbiAgICAgICAgY29uc3QgaWR4ID0gdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBjb25maWdJZCk7XHJcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcclxuXHJcbiAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9uc1tpZHhdO1xyXG4gICAgICAgIGNvbnN0IHVwZGF0ZWQ6IFRvb2xDb25maWd1cmF0aW9uID0ge1xyXG4gICAgICAgICAgICAuLi5jb25maWcsXHJcbiAgICAgICAgICAgIC4uLnVwZGF0ZXMsXHJcbiAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9uc1tpZHhdID0gdXBkYXRlZDtcclxuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIHJldHVybiB1cGRhdGVkO1xyXG4gICAgfVxyXG5cclxuICAgIHB1YmxpYyBkZWxldGVDb25maWd1cmF0aW9uKGNvbmZpZ0lkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBpZHggPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcclxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgdGhyb3cgbmV3IEVycm9yKCdDb25maWd1cmF0aW9uIG5vdCBmb3VuZCcpO1xyXG5cclxuICAgICAgICB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLnNwbGljZShpZHgsIDEpO1xyXG5cclxuICAgICAgICBpZiAodGhpcy5zZXR0aW5ncy5jdXJyZW50Q29uZmlnSWQgPT09IGNvbmZpZ0lkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dGluZ3MuY3VycmVudENvbmZpZ0lkID0gdGhpcy5zZXR0aW5ncy5jb25maWd1cmF0aW9ucy5sZW5ndGggPiAwXHJcbiAgICAgICAgICAgICAgICA/IHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnNbMF0uaWRcclxuICAgICAgICAgICAgICAgIDogJyc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHNldEN1cnJlbnRDb25maWd1cmF0aW9uKGNvbmZpZ0lkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBjb25maWcgPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLmZpbmQoYyA9PiBjLmlkID09PSBjb25maWdJZCk7XHJcbiAgICAgICAgaWYgKCFjb25maWcpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcclxuICAgICAgICB0aGlzLnNldHRpbmdzLmN1cnJlbnRDb25maWdJZCA9IGNvbmZpZ0lkO1xyXG4gICAgICAgIHRoaXMuc2F2ZVNldHRpbmdzKCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHVwZGF0ZVRvb2xTdGF0dXMoY29uZmlnSWQ6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgZW5hYmxlZDogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMuZmluZChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcclxuICAgICAgICBpZiAoIWNvbmZpZykgdGhyb3cgbmV3IEVycm9yKCdDb25maWd1cmF0aW9uIG5vdCBmb3VuZCcpO1xyXG5cclxuICAgICAgICBjb25zdCB0b29sID0gY29uZmlnLnRvb2xzLmZpbmQodCA9PiB0Lm5hbWUgPT09IHRvb2xOYW1lKTtcclxuICAgICAgICBpZiAoIXRvb2wpIHRocm93IG5ldyBFcnJvcihgVG9vbCAnJHt0b29sTmFtZX0nIG5vdCBmb3VuZGApO1xyXG5cclxuICAgICAgICB0b29sLmVuYWJsZWQgPSBlbmFibGVkO1xyXG4gICAgICAgIGNvbmZpZy51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgdGhpcy5zYXZlU2V0dGluZ3MoKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgdXBkYXRlVG9vbFN0YXR1c0JhdGNoKGNvbmZpZ0lkOiBzdHJpbmcsIHVwZGF0ZXM6IHsgbmFtZTogc3RyaW5nOyBlbmFibGVkOiBib29sZWFuIH1bXSk6IHZvaWQge1xyXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMuZmluZChjID0+IGMuaWQgPT09IGNvbmZpZ0lkKTtcclxuICAgICAgICBpZiAoIWNvbmZpZykgdGhyb3cgbmV3IEVycm9yKCdDb25maWd1cmF0aW9uIG5vdCBmb3VuZCcpO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHVwZGF0ZSBvZiB1cGRhdGVzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRvb2wgPSBjb25maWcudG9vbHMuZmluZCh0ID0+IHQubmFtZSA9PT0gdXBkYXRlLm5hbWUpO1xyXG4gICAgICAgICAgICBpZiAodG9vbCkge1xyXG4gICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gdXBkYXRlLmVuYWJsZWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbmZpZy51cGRhdGVkQXQgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgdGhpcy5zYXZlU2V0dGluZ3MoKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgZXhwb3J0Q29uZmlndXJhdGlvbihjb25maWdJZDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBjb25maWcgPSB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLmZpbmQoYyA9PiBjLmlkID09PSBjb25maWdJZCk7XHJcbiAgICAgICAgaWYgKCFjb25maWcpIHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBub3QgZm91bmQnKTtcclxuICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY29uZmlnLCBudWxsLCAyKTtcclxuICAgIH1cclxuXHJcbiAgICBwdWJsaWMgaW1wb3J0Q29uZmlndXJhdGlvbihjb25maWdKc29uOiBzdHJpbmcpOiBUb29sQ29uZmlndXJhdGlvbiB7XHJcbiAgICAgICAgY29uc3QgcmF3ID0gSlNPTi5wYXJzZShjb25maWdKc29uKTtcclxuXHJcbiAgICAgICAgLy8gVmFsaWRhdGUgcmVxdWlyZWQgdG9wLWxldmVsIGZpZWxkc1xyXG4gICAgICAgIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWd1cmF0aW9uIGZvcm1hdCcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIHJhdy5uYW1lICE9PSAnc3RyaW5nJyB8fCAhcmF3Lm5hbWUudHJpbSgpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWd1cmF0aW9uIGZvcm1hdDogbmFtZSBtdXN0IGJlIGEgbm9uLWVtcHR5IHN0cmluZycpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocmF3LnRvb2xzKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29uZmlndXJhdGlvbiBmb3JtYXQ6IHRvb2xzIG11c3QgYmUgYW4gYXJyYXknKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFZhbGlkYXRlIGFuZCBzYW5pdGl6ZSBlYWNoIHRvb2wgZW50cnkg4oCUIG9ubHkga2VlcCBrbm93biBmaWVsZHMgd2l0aCBjb3JyZWN0IHR5cGVzXHJcbiAgICAgICAgY29uc3Qgc2FuaXRpemVkVG9vbHM6IFRvb2xDb25maWdbXSA9IFtdO1xyXG4gICAgICAgIGZvciAoY29uc3QgdG9vbCBvZiByYXcudG9vbHMpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0b29sLm5hbWUgIT09ICdzdHJpbmcnIHx8IHR5cGVvZiB0b29sLmVuYWJsZWQgIT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHRvb2wgZW50cnk6IG5hbWUgbXVzdCBiZSBzdHJpbmcgYW5kIGVuYWJsZWQgbXVzdCBiZSBib29sZWFuYCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgc2FuaXRpemVkVG9vbHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXHJcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0b29sLmVuYWJsZWQsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdHlwZW9mIHRvb2wuZGVzY3JpcHRpb24gPT09ICdzdHJpbmcnID8gdG9vbC5kZXNjcmlwdGlvbiA6ICcnXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3MuY29uZmlndXJhdGlvbnMubGVuZ3RoID49IHRoaXMuc2V0dGluZ3MubWF4Q29uZmlnU2xvdHMpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBNYXhpbXVtIGNvbmZpZ3VyYXRpb24gc2xvdHMgcmVhY2hlZCAoJHt0aGlzLnNldHRpbmdzLm1heENvbmZpZ1Nsb3RzfSlgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIEJ1aWxkIGEgY2xlYW4gY29uZmlnIG9iamVjdCDigJQgZGlzY2FyZCBhbnkgdW5leHBlY3RlZCBmaWVsZHMgZnJvbSBpbnB1dFxyXG4gICAgICAgIGNvbnN0IGNvbmZpZzogVG9vbENvbmZpZ3VyYXRpb24gPSB7XHJcbiAgICAgICAgICAgIGlkOiB1dWlkdjQoKSxcclxuICAgICAgICAgICAgbmFtZTogcmF3Lm5hbWUudHJpbSgpLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogdHlwZW9mIHJhdy5kZXNjcmlwdGlvbiA9PT0gJ3N0cmluZycgPyByYXcuZGVzY3JpcHRpb24gOiAnJyxcclxuICAgICAgICAgICAgdG9vbHM6IHNhbml0aXplZFRvb2xzLFxyXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnNldHRpbmdzLmNvbmZpZ3VyYXRpb25zLnB1c2goY29uZmlnKTtcclxuICAgICAgICB0aGlzLnNhdmVTZXR0aW5ncygpO1xyXG4gICAgICAgIHJldHVybiBjb25maWc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIFJldHVybnMgZmxhdCBhcnJheSBvZiBlbmFibGVkIHRvb2wgbmFtZXMgZm9yIE1DUCBzZXJ2ZXIgZmlsdGVyaW5nICovXHJcbiAgICBwdWJsaWMgZ2V0RW5hYmxlZFRvb2xOYW1lcygpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgY29uc3QgY3VycmVudENvbmZpZyA9IHRoaXMuZ2V0Q3VycmVudENvbmZpZ3VyYXRpb24oKTtcclxuICAgICAgICBpZiAoIWN1cnJlbnRDb25maWcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXZhaWxhYmxlVG9vbHMuZmlsdGVyKHQgPT4gdC5lbmFibGVkKS5tYXAodCA9PiB0Lm5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gY3VycmVudENvbmZpZy50b29scy5maWx0ZXIodCA9PiB0LmVuYWJsZWQpLm1hcCh0ID0+IHQubmFtZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIGdldFRvb2xNYW5hZ2VyU3RhdGUoKSB7XHJcbiAgICAgICAgY29uc3QgY3VycmVudENvbmZpZyA9IHRoaXMuZ2V0Q3VycmVudENvbmZpZ3VyYXRpb24oKTtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICBhdmFpbGFibGVUb29sczogY3VycmVudENvbmZpZyA/IGN1cnJlbnRDb25maWcudG9vbHMgOiB0aGlzLmdldEF2YWlsYWJsZVRvb2xzKCksXHJcbiAgICAgICAgICAgIHNlbGVjdGVkQ29uZmlnSWQ6IHRoaXMuc2V0dGluZ3MuY3VycmVudENvbmZpZ0lkLFxyXG4gICAgICAgICAgICBjb25maWd1cmF0aW9uczogdGhpcy5nZXRDb25maWd1cmF0aW9ucygpLFxyXG4gICAgICAgICAgICBtYXhDb25maWdTbG90czogdGhpcy5zZXR0aW5ncy5tYXhDb25maWdTbG90c1xyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBzYXZlU2V0dGluZ3MoKTogdm9pZCB7XHJcbiAgICAgICAgdGhpcy5zYXZlVG9vbE1hbmFnZXJTZXR0aW5ncyh0aGlzLnNldHRpbmdzKTtcclxuICAgIH1cclxufVxyXG4iXX0=