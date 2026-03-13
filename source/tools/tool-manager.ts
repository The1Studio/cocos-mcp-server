import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

/** v2 flat tool config — no more category field */
export interface ToolConfig {
    name: string;
    enabled: boolean;
    description: string;
}

export interface ToolConfiguration {
    id: string;
    name: string;
    description?: string;
    tools: ToolConfig[];
    createdAt: string;
    updatedAt: string;
}

export interface ToolManagerSettings {
    configurations: ToolConfiguration[];
    currentConfigId: string;
    maxConfigSlots: number;
}

/** All v2 manage_* tool names */
const V2_TOOL_NAMES: { name: string; description: string }[] = [
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

export class ToolManager {
    private settings: ToolManagerSettings;
    private availableTools: ToolConfig[] = [];

    constructor() {
        this.settings = this.readToolManagerSettings();
        this.initializeAvailableTools();

        if (this.settings.configurations.length === 0) {
            console.log('[ToolManager] No configurations found, creating default...');
            this.createConfiguration('Default', 'Auto-created default tool configuration');
        }

        this.syncToolList();
    }

    private getToolManagerSettingsPath(): string {
        return path.join(Editor.Project.path, 'settings', 'tool-manager.json');
    }

    private ensureSettingsDir(): void {
        const settingsDir = path.dirname(this.getToolManagerSettingsPath());
        if (!fs.existsSync(settingsDir)) {
            fs.mkdirSync(settingsDir, { recursive: true });
        }
    }

    private readToolManagerSettings(): ToolManagerSettings {
        const DEFAULT: ToolManagerSettings = {
            configurations: [],
            currentConfigId: '',
            maxConfigSlots: 5
        };

        try {
            this.ensureSettingsDir();
            const settingsFile = this.getToolManagerSettingsPath();
            if (fs.existsSync(settingsFile)) {
                const content = fs.readFileSync(settingsFile, 'utf8');
                return { ...DEFAULT, ...JSON.parse(content) };
            }
        } catch (e) {
            console.error('Failed to read tool manager settings:', e);
        }
        return DEFAULT;
    }

    private saveToolManagerSettings(settings: ToolManagerSettings): void {
        try {
            this.ensureSettingsDir();
            const settingsFile = this.getToolManagerSettingsPath();
            fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
        } catch (e) {
            console.error('Failed to save tool manager settings:', e);
            throw e;
        }
    }

    private initializeAvailableTools(): void {
        this.availableTools = V2_TOOL_NAMES.map(t => ({
            name: t.name,
            enabled: true,
            description: t.description
        }));
        console.log(`[ToolManager] Initialized ${this.availableTools.length} v2 tools`);
    }

    /** Sync persisted configs with current tool list (add new tools, remove stale) */
    private syncToolList(): void {
        const currentNames = new Set(V2_TOOL_NAMES.map(t => t.name));
        let changed = false;

        for (const config of this.settings.configurations) {
            // Remove tools that no longer exist
            const before = config.tools.length;
            config.tools = config.tools.filter(t => currentNames.has(t.name));
            if (config.tools.length !== before) changed = true;

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

    public getAvailableTools(): ToolConfig[] {
        return [...this.availableTools];
    }

    public getConfigurations(): ToolConfiguration[] {
        return [...this.settings.configurations];
    }

    public getCurrentConfiguration(): ToolConfiguration | null {
        if (!this.settings.currentConfigId) return null;
        return this.settings.configurations.find(c => c.id === this.settings.currentConfigId) || null;
    }

    public createConfiguration(name: string, description?: string): ToolConfiguration {
        if (this.settings.configurations.length >= this.settings.maxConfigSlots) {
            throw new Error(`Maximum configuration slots reached (${this.settings.maxConfigSlots})`);
        }

        const config: ToolConfiguration = {
            id: uuidv4(),
            name,
            description,
            tools: this.availableTools.map(t => ({ ...t })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.settings.configurations.push(config);
        this.settings.currentConfigId = config.id;
        this.saveSettings();
        return config;
    }

    public updateConfiguration(configId: string, updates: Partial<ToolConfiguration>): ToolConfiguration {
        const idx = this.settings.configurations.findIndex(c => c.id === configId);
        if (idx === -1) throw new Error('Configuration not found');

        const config = this.settings.configurations[idx];
        const updated: ToolConfiguration = {
            ...config,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        this.settings.configurations[idx] = updated;
        this.saveSettings();
        return updated;
    }

    public deleteConfiguration(configId: string): void {
        const idx = this.settings.configurations.findIndex(c => c.id === configId);
        if (idx === -1) throw new Error('Configuration not found');

        this.settings.configurations.splice(idx, 1);

        if (this.settings.currentConfigId === configId) {
            this.settings.currentConfigId = this.settings.configurations.length > 0
                ? this.settings.configurations[0].id
                : '';
        }
        this.saveSettings();
    }

    public setCurrentConfiguration(configId: string): void {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config) throw new Error('Configuration not found');
        this.settings.currentConfigId = configId;
        this.saveSettings();
    }

    public updateToolStatus(configId: string, toolName: string, enabled: boolean): void {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config) throw new Error('Configuration not found');

        const tool = config.tools.find(t => t.name === toolName);
        if (!tool) throw new Error(`Tool '${toolName}' not found`);

        tool.enabled = enabled;
        config.updatedAt = new Date().toISOString();
        this.saveSettings();
    }

    public updateToolStatusBatch(configId: string, updates: { name: string; enabled: boolean }[]): void {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config) throw new Error('Configuration not found');

        for (const update of updates) {
            const tool = config.tools.find(t => t.name === update.name);
            if (tool) {
                tool.enabled = update.enabled;
            }
        }

        config.updatedAt = new Date().toISOString();
        this.saveSettings();
    }

    public exportConfiguration(configId: string): string {
        const config = this.settings.configurations.find(c => c.id === configId);
        if (!config) throw new Error('Configuration not found');
        return JSON.stringify(config, null, 2);
    }

    public importConfiguration(configJson: string): ToolConfiguration {
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
        const sanitizedTools: ToolConfig[] = [];
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
        const config: ToolConfiguration = {
            id: uuidv4(),
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
    public getEnabledToolNames(): string[] {
        const currentConfig = this.getCurrentConfiguration();
        if (!currentConfig) {
            return this.availableTools.filter(t => t.enabled).map(t => t.name);
        }
        return currentConfig.tools.filter(t => t.enabled).map(t => t.name);
    }

    public getToolManagerState() {
        const currentConfig = this.getCurrentConfiguration();
        return {
            success: true,
            availableTools: currentConfig ? currentConfig.tools : this.getAvailableTools(),
            selectedConfigId: this.settings.currentConfigId,
            configurations: this.getConfigurations(),
            maxConfigSlots: this.settings.maxConfigSlots
        };
    }

    private saveSettings(): void {
        this.saveToolManagerSettings(this.settings);
    }
}
