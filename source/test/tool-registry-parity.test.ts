import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MCPServer } from '../mcp-server';
import { MCPServerSettings } from '../types';
import { ToolManager } from '../tools/tool-manager';

const BASE_SETTINGS: MCPServerSettings = {
    port: 0,
    autoStart: false,
    enableDebugLog: false,
    allowedOrigins: [],
    maxConnections: 10,
};

/** Create a fresh ToolManager backed by a temp directory (mirrors tool-manager.test.ts) */
function freshToolManager(): ToolManager {
    const settingsDir = path.join(os.tmpdir(), 'settings');
    const settingsFile = path.join(settingsDir, 'tool-manager.json');
    if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
    return new ToolManager();
}

describe('Tool registry parity (regression guard for #88/#94)', () => {
    it('ToolManager tracks every tool MCPServer actually registers — by identity, not count', () => {
        const server = new MCPServer(BASE_SETTINGS);
        // Populate toolsList with the full unfiltered set (no enabled-tools filter applied).
        server.updateEnabledTools([]);
        const mcpToolNames = new Set(server.getAvailableTools().map(t => t.name));

        const toolManager = freshToolManager();
        const managedNames = new Set(toolManager.getAvailableTools().map(t => t.name));

        // A tool the server can execute but ToolManager never persists/exposes for
        // enable-disable — this is exactly the #88/#94 drift (new tool added to
        // MCPServer.initializeTools() but never added to ToolManager's registry).
        const missingFromToolManager = [...mcpToolNames].filter(n => !managedNames.has(n)).sort();
        // A name ToolManager still thinks exists after it was removed/renamed in MCPServer.
        const staleInToolManager = [...managedNames].filter(n => !mcpToolNames.has(n)).sort();

        expect(missingFromToolManager).toEqual([]);
        expect(staleInToolManager).toEqual([]);
    });

    it('folds newly-registered tools into a pre-existing persisted config on next load', () => {
        // Simulate an install that persisted its tool-manager.json before the 20
        // Phase 1-4 tools existed — exactly the shape #88/#94 left on disk.
        const settingsDir = path.join(os.tmpdir(), 'settings');
        const settingsFile = path.join(settingsDir, 'tool-manager.json');
        if (!fs.existsSync(settingsDir)) fs.mkdirSync(settingsDir, { recursive: true });
        const legacyToolNames = [
            'manage_scene', 'manage_node', 'manage_component', 'manage_prefab', 'manage_asset',
            'manage_project', 'manage_debug', 'manage_preferences', 'manage_server', 'manage_broadcast',
            'manage_scene_view', 'manage_node_hierarchy', 'manage_scene_query', 'manage_undo',
            'manage_reference_image', 'manage_validation', 'manage_selection', 'manage_script',
            'manage_material', 'manage_animation',
        ];
        const legacySettings = {
            configurations: [{
                id: 'legacy-config',
                name: 'Default',
                tools: legacyToolNames.map(name => ({ name, enabled: true, description: 'stale' })),
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
            }],
            currentConfigId: 'legacy-config',
            maxConfigSlots: 5,
        };
        fs.writeFileSync(settingsFile, JSON.stringify(legacySettings, null, 2));

        const toolManager = new ToolManager();
        const enabledNames = new Set(toolManager.getEnabledToolNames());

        const server = new MCPServer(BASE_SETTINGS);
        server.updateEnabledTools([]);
        const mcpToolNames = server.getAvailableTools().map(t => t.name);

        for (const name of mcpToolNames) {
            expect(enabledNames.has(name)).toBe(true);
        }
    });
});
