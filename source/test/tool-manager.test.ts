import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolManager } from '../tools/tool-manager';

/** Create a fresh ToolManager backed by a temp directory */
function makeManager(): ToolManager {
    // Editor.Project.path is set to os.tmpdir() by editor-mock.ts
    // Ensure settings dir exists fresh for each test
    const settingsDir = path.join(os.tmpdir(), 'settings');
    const settingsFile = path.join(settingsDir, 'tool-manager.json');
    if (fs.existsSync(settingsFile)) fs.unlinkSync(settingsFile);
    return new ToolManager();
}

describe('ToolManager.importConfiguration', () => {
    let mgr: ToolManager;

    beforeEach(() => {
        mgr = makeManager();
    });

    it('imports a valid configuration', () => {
        const config = mgr.exportConfiguration(mgr.getConfigurations()[0].id);
        // Delete one slot so there's room
        const imported = mgr.importConfiguration(config);
        expect(imported.name).toBeTruthy();
        expect(Array.isArray(imported.tools)).toBe(true);
    });

    it('rejects non-object input', () => {
        expect(() => mgr.importConfiguration('"just a string"')).toThrow();
    });

    it('rejects config without a name field', () => {
        const bad = JSON.stringify({ tools: [] });
        expect(() => mgr.importConfiguration(bad)).toThrow(/name/i);
    });

    it('rejects config with empty name', () => {
        const bad = JSON.stringify({ name: '   ', tools: [] });
        expect(() => mgr.importConfiguration(bad)).toThrow(/name/i);
    });

    it('rejects config where tools is not an array', () => {
        const bad = JSON.stringify({ name: 'Test', tools: 'not-an-array' });
        expect(() => mgr.importConfiguration(bad)).toThrow(/tools/i);
    });

    it('rejects tool entries missing name', () => {
        const bad = JSON.stringify({ name: 'Test', tools: [{ enabled: true }] });
        expect(() => mgr.importConfiguration(bad)).toThrow();
    });

    it('rejects tool entries where enabled is not boolean', () => {
        const bad = JSON.stringify({ name: 'Test', tools: [{ name: 'manage_scene', enabled: 'yes' }] });
        expect(() => mgr.importConfiguration(bad)).toThrow();
    });

    it('sanitizes tool entries — ignores unknown fields', () => {
        const validTools = [{ name: 'manage_scene', enabled: true, description: 'ok', injected: 'evil' }];
        const raw = JSON.stringify({ name: 'Sanitized', tools: validTools });
        const imported = mgr.importConfiguration(raw);
        const tool = imported.tools.find(t => t.name === 'manage_scene')!;
        expect(tool).toBeDefined();
        expect((tool as any).injected).toBeUndefined();
    });

    it('rejects import when max slots reached', () => {
        // Default maxConfigSlots is 5; default constructor creates 1 config already
        // Fill remaining slots
        for (let i = 0; i < 4; i++) {
            mgr.createConfiguration(`Config ${i}`);
        }
        const config = mgr.exportConfiguration(mgr.getConfigurations()[0].id);
        expect(() => mgr.importConfiguration(config)).toThrow(/maximum/i);
    });

    it('rejects malformed JSON', () => {
        expect(() => mgr.importConfiguration('{bad json')).toThrow();
    });
});

describe('ToolManager.createConfiguration', () => {
    it('creates configuration with correct structure', () => {
        const mgr = makeManager();
        const cfg = mgr.createConfiguration('MyConfig', 'desc');
        expect(cfg.name).toBe('MyConfig');
        expect(cfg.description).toBe('desc');
        expect(cfg.tools.length).toBeGreaterThan(0);
        expect(cfg.id).toBeTruthy();
    });

    it('sets the new config as current', () => {
        const mgr = makeManager();
        const cfg = mgr.createConfiguration('Active');
        expect(mgr.getCurrentConfiguration()?.id).toBe(cfg.id);
    });
});

describe('ToolManager.getEnabledToolNames', () => {
    it('returns all tool names when all enabled', () => {
        const mgr = makeManager();
        const names = mgr.getEnabledToolNames();
        expect(names.length).toBeGreaterThan(0);
        expect(names).toContain('manage_scene');
    });

    it('returns subset after disabling a tool', () => {
        const mgr = makeManager();
        const cfg = mgr.getCurrentConfiguration()!;
        mgr.updateToolStatus(cfg.id, 'manage_scene', false);
        const names = mgr.getEnabledToolNames();
        expect(names).not.toContain('manage_scene');
    });
});
