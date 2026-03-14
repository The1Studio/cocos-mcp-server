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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const tool_manager_1 = require("../tools/tool-manager");
/** Create a fresh ToolManager backed by a temp directory */
function makeManager() {
    // Editor.Project.path is set to os.tmpdir() by editor-mock.ts
    // Ensure settings dir exists fresh for each test
    const settingsDir = path.join(os.tmpdir(), 'settings');
    const settingsFile = path.join(settingsDir, 'tool-manager.json');
    if (fs.existsSync(settingsFile))
        fs.unlinkSync(settingsFile);
    return new tool_manager_1.ToolManager();
}
describe('ToolManager.importConfiguration', () => {
    let mgr;
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
        const tool = imported.tools.find(t => t.name === 'manage_scene');
        expect(tool).toBeDefined();
        expect(tool.injected).toBeUndefined();
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
        var _a;
        const mgr = makeManager();
        const cfg = mgr.createConfiguration('Active');
        expect((_a = mgr.getCurrentConfiguration()) === null || _a === void 0 ? void 0 : _a.id).toBe(cfg.id);
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
        const cfg = mgr.getCurrentConfiguration();
        mgr.updateToolStatus(cfg.id, 'manage_scene', false);
        const names = mgr.getEnabledToolNames();
        expect(names).not.toContain('manage_scene');
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vbC1tYW5hZ2VyLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdGVzdC90b29sLW1hbmFnZXIudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsdUNBQXlCO0FBQ3pCLHdEQUFvRDtBQUVwRCw0REFBNEQ7QUFDNUQsU0FBUyxXQUFXO0lBQ2hCLDhEQUE4RDtJQUM5RCxpREFBaUQ7SUFDakQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFDdkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsbUJBQW1CLENBQUMsQ0FBQztJQUNqRSxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO1FBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUM3RCxPQUFPLElBQUksMEJBQVcsRUFBRSxDQUFDO0FBQzdCLENBQUM7QUFFRCxRQUFRLENBQUMsaUNBQWlDLEVBQUUsR0FBRyxFQUFFO0lBQzdDLElBQUksR0FBZ0IsQ0FBQztJQUVyQixVQUFVLENBQUMsR0FBRyxFQUFFO1FBQ1osR0FBRyxHQUFHLFdBQVcsRUFBRSxDQUFDO0lBQ3hCLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLCtCQUErQixFQUFFLEdBQUcsRUFBRTtRQUNyQyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdEUsa0NBQWtDO1FBQ2xDLE1BQU0sUUFBUSxHQUFHLEdBQUcsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqRCxN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R0FBRyxHQUFHLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUN4QyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4QyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzVDLENBQUMsQ0FBQyxDQUFDO0lBRUgsRUFBRSxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsRUFBRTtRQUM3QyxNQUFNLEdBQUcsR0FBRyxXQUFXLEVBQUUsQ0FBQztRQUMxQixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsdUJBQXVCLEVBQUcsQ0FBQztRQUMzQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDcEQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDeEMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLENBQUM7SUFDaEQsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgeyBUb29sTWFuYWdlciB9IGZyb20gJy4uL3Rvb2xzL3Rvb2wtbWFuYWdlcic7XG5cbi8qKiBDcmVhdGUgYSBmcmVzaCBUb29sTWFuYWdlciBiYWNrZWQgYnkgYSB0ZW1wIGRpcmVjdG9yeSAqL1xuZnVuY3Rpb24gbWFrZU1hbmFnZXIoKTogVG9vbE1hbmFnZXIge1xuICAgIC8vIEVkaXRvci5Qcm9qZWN0LnBhdGggaXMgc2V0IHRvIG9zLnRtcGRpcigpIGJ5IGVkaXRvci1tb2NrLnRzXG4gICAgLy8gRW5zdXJlIHNldHRpbmdzIGRpciBleGlzdHMgZnJlc2ggZm9yIGVhY2ggdGVzdFxuICAgIGNvbnN0IHNldHRpbmdzRGlyID0gcGF0aC5qb2luKG9zLnRtcGRpcigpLCAnc2V0dGluZ3MnKTtcbiAgICBjb25zdCBzZXR0aW5nc0ZpbGUgPSBwYXRoLmpvaW4oc2V0dGluZ3NEaXIsICd0b29sLW1hbmFnZXIuanNvbicpO1xuICAgIGlmIChmcy5leGlzdHNTeW5jKHNldHRpbmdzRmlsZSkpIGZzLnVubGlua1N5bmMoc2V0dGluZ3NGaWxlKTtcbiAgICByZXR1cm4gbmV3IFRvb2xNYW5hZ2VyKCk7XG59XG5cbmRlc2NyaWJlKCdUb29sTWFuYWdlci5pbXBvcnRDb25maWd1cmF0aW9uJywgKCkgPT4ge1xuICAgIGxldCBtZ3I6IFRvb2xNYW5hZ2VyO1xuXG4gICAgYmVmb3JlRWFjaCgoKSA9PiB7XG4gICAgICAgIG1nciA9IG1ha2VNYW5hZ2VyKCk7XG4gICAgfSk7XG5cbiAgICBpdCgnaW1wb3J0cyBhIHZhbGlkIGNvbmZpZ3VyYXRpb24nLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IG1nci5leHBvcnRDb25maWd1cmF0aW9uKG1nci5nZXRDb25maWd1cmF0aW9ucygpWzBdLmlkKTtcbiAgICAgICAgLy8gRGVsZXRlIG9uZSBzbG90IHNvIHRoZXJlJ3Mgcm9vbVxuICAgICAgICBjb25zdCBpbXBvcnRlZCA9IG1nci5pbXBvcnRDb25maWd1cmF0aW9uKGNvbmZpZyk7XG4gICAgICAgIGV4cGVjdChpbXBvcnRlZC5uYW1lKS50b0JlVHJ1dGh5KCk7XG4gICAgICAgIGV4cGVjdChBcnJheS5pc0FycmF5KGltcG9ydGVkLnRvb2xzKSkudG9CZSh0cnVlKTtcbiAgICB9KTtcblxuICAgIGl0KCdyZWplY3RzIG5vbi1vYmplY3QgaW5wdXQnLCAoKSA9PiB7XG4gICAgICAgIGV4cGVjdCgoKSA9PiBtZ3IuaW1wb3J0Q29uZmlndXJhdGlvbignXCJqdXN0IGEgc3RyaW5nXCInKSkudG9UaHJvdygpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JlamVjdHMgY29uZmlnIHdpdGhvdXQgYSBuYW1lIGZpZWxkJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBiYWQgPSBKU09OLnN0cmluZ2lmeSh7IHRvb2xzOiBbXSB9KTtcbiAgICAgICAgZXhwZWN0KCgpID0+IG1nci5pbXBvcnRDb25maWd1cmF0aW9uKGJhZCkpLnRvVGhyb3coL25hbWUvaSk7XG4gICAgfSk7XG5cbiAgICBpdCgncmVqZWN0cyBjb25maWcgd2l0aCBlbXB0eSBuYW1lJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBiYWQgPSBKU09OLnN0cmluZ2lmeSh7IG5hbWU6ICcgICAnLCB0b29sczogW10gfSk7XG4gICAgICAgIGV4cGVjdCgoKSA9PiBtZ3IuaW1wb3J0Q29uZmlndXJhdGlvbihiYWQpKS50b1Rocm93KC9uYW1lL2kpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JlamVjdHMgY29uZmlnIHdoZXJlIHRvb2xzIGlzIG5vdCBhbiBhcnJheScsICgpID0+IHtcbiAgICAgICAgY29uc3QgYmFkID0gSlNPTi5zdHJpbmdpZnkoeyBuYW1lOiAnVGVzdCcsIHRvb2xzOiAnbm90LWFuLWFycmF5JyB9KTtcbiAgICAgICAgZXhwZWN0KCgpID0+IG1nci5pbXBvcnRDb25maWd1cmF0aW9uKGJhZCkpLnRvVGhyb3coL3Rvb2xzL2kpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JlamVjdHMgdG9vbCBlbnRyaWVzIG1pc3NpbmcgbmFtZScsICgpID0+IHtcbiAgICAgICAgY29uc3QgYmFkID0gSlNPTi5zdHJpbmdpZnkoeyBuYW1lOiAnVGVzdCcsIHRvb2xzOiBbeyBlbmFibGVkOiB0cnVlIH1dIH0pO1xuICAgICAgICBleHBlY3QoKCkgPT4gbWdyLmltcG9ydENvbmZpZ3VyYXRpb24oYmFkKSkudG9UaHJvdygpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JlamVjdHMgdG9vbCBlbnRyaWVzIHdoZXJlIGVuYWJsZWQgaXMgbm90IGJvb2xlYW4nLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGJhZCA9IEpTT04uc3RyaW5naWZ5KHsgbmFtZTogJ1Rlc3QnLCB0b29sczogW3sgbmFtZTogJ21hbmFnZV9zY2VuZScsIGVuYWJsZWQ6ICd5ZXMnIH1dIH0pO1xuICAgICAgICBleHBlY3QoKCkgPT4gbWdyLmltcG9ydENvbmZpZ3VyYXRpb24oYmFkKSkudG9UaHJvdygpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3Nhbml0aXplcyB0b29sIGVudHJpZXMg4oCUIGlnbm9yZXMgdW5rbm93biBmaWVsZHMnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbGlkVG9vbHMgPSBbeyBuYW1lOiAnbWFuYWdlX3NjZW5lJywgZW5hYmxlZDogdHJ1ZSwgZGVzY3JpcHRpb246ICdvaycsIGluamVjdGVkOiAnZXZpbCcgfV07XG4gICAgICAgIGNvbnN0IHJhdyA9IEpTT04uc3RyaW5naWZ5KHsgbmFtZTogJ1Nhbml0aXplZCcsIHRvb2xzOiB2YWxpZFRvb2xzIH0pO1xuICAgICAgICBjb25zdCBpbXBvcnRlZCA9IG1nci5pbXBvcnRDb25maWd1cmF0aW9uKHJhdyk7XG4gICAgICAgIGNvbnN0IHRvb2wgPSBpbXBvcnRlZC50b29scy5maW5kKHQgPT4gdC5uYW1lID09PSAnbWFuYWdlX3NjZW5lJykhO1xuICAgICAgICBleHBlY3QodG9vbCkudG9CZURlZmluZWQoKTtcbiAgICAgICAgZXhwZWN0KCh0b29sIGFzIGFueSkuaW5qZWN0ZWQpLnRvQmVVbmRlZmluZWQoKTtcbiAgICB9KTtcblxuICAgIGl0KCdyZWplY3RzIGltcG9ydCB3aGVuIG1heCBzbG90cyByZWFjaGVkJywgKCkgPT4ge1xuICAgICAgICAvLyBEZWZhdWx0IG1heENvbmZpZ1Nsb3RzIGlzIDU7IGRlZmF1bHQgY29uc3RydWN0b3IgY3JlYXRlcyAxIGNvbmZpZyBhbHJlYWR5XG4gICAgICAgIC8vIEZpbGwgcmVtYWluaW5nIHNsb3RzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgICAgICBtZ3IuY3JlYXRlQ29uZmlndXJhdGlvbihgQ29uZmlnICR7aX1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb25maWcgPSBtZ3IuZXhwb3J0Q29uZmlndXJhdGlvbihtZ3IuZ2V0Q29uZmlndXJhdGlvbnMoKVswXS5pZCk7XG4gICAgICAgIGV4cGVjdCgoKSA9PiBtZ3IuaW1wb3J0Q29uZmlndXJhdGlvbihjb25maWcpKS50b1Rocm93KC9tYXhpbXVtL2kpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JlamVjdHMgbWFsZm9ybWVkIEpTT04nLCAoKSA9PiB7XG4gICAgICAgIGV4cGVjdCgoKSA9PiBtZ3IuaW1wb3J0Q29uZmlndXJhdGlvbigne2JhZCBqc29uJykpLnRvVGhyb3coKTtcbiAgICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnVG9vbE1hbmFnZXIuY3JlYXRlQ29uZmlndXJhdGlvbicsICgpID0+IHtcbiAgICBpdCgnY3JlYXRlcyBjb25maWd1cmF0aW9uIHdpdGggY29ycmVjdCBzdHJ1Y3R1cmUnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1nciA9IG1ha2VNYW5hZ2VyKCk7XG4gICAgICAgIGNvbnN0IGNmZyA9IG1nci5jcmVhdGVDb25maWd1cmF0aW9uKCdNeUNvbmZpZycsICdkZXNjJyk7XG4gICAgICAgIGV4cGVjdChjZmcubmFtZSkudG9CZSgnTXlDb25maWcnKTtcbiAgICAgICAgZXhwZWN0KGNmZy5kZXNjcmlwdGlvbikudG9CZSgnZGVzYycpO1xuICAgICAgICBleHBlY3QoY2ZnLnRvb2xzLmxlbmd0aCkudG9CZUdyZWF0ZXJUaGFuKDApO1xuICAgICAgICBleHBlY3QoY2ZnLmlkKS50b0JlVHJ1dGh5KCk7XG4gICAgfSk7XG5cbiAgICBpdCgnc2V0cyB0aGUgbmV3IGNvbmZpZyBhcyBjdXJyZW50JywgKCkgPT4ge1xuICAgICAgICBjb25zdCBtZ3IgPSBtYWtlTWFuYWdlcigpO1xuICAgICAgICBjb25zdCBjZmcgPSBtZ3IuY3JlYXRlQ29uZmlndXJhdGlvbignQWN0aXZlJyk7XG4gICAgICAgIGV4cGVjdChtZ3IuZ2V0Q3VycmVudENvbmZpZ3VyYXRpb24oKT8uaWQpLnRvQmUoY2ZnLmlkKTtcbiAgICB9KTtcbn0pO1xuXG5kZXNjcmliZSgnVG9vbE1hbmFnZXIuZ2V0RW5hYmxlZFRvb2xOYW1lcycsICgpID0+IHtcbiAgICBpdCgncmV0dXJucyBhbGwgdG9vbCBuYW1lcyB3aGVuIGFsbCBlbmFibGVkJywgKCkgPT4ge1xuICAgICAgICBjb25zdCBtZ3IgPSBtYWtlTWFuYWdlcigpO1xuICAgICAgICBjb25zdCBuYW1lcyA9IG1nci5nZXRFbmFibGVkVG9vbE5hbWVzKCk7XG4gICAgICAgIGV4cGVjdChuYW1lcy5sZW5ndGgpLnRvQmVHcmVhdGVyVGhhbigwKTtcbiAgICAgICAgZXhwZWN0KG5hbWVzKS50b0NvbnRhaW4oJ21hbmFnZV9zY2VuZScpO1xuICAgIH0pO1xuXG4gICAgaXQoJ3JldHVybnMgc3Vic2V0IGFmdGVyIGRpc2FibGluZyBhIHRvb2wnLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG1nciA9IG1ha2VNYW5hZ2VyKCk7XG4gICAgICAgIGNvbnN0IGNmZyA9IG1nci5nZXRDdXJyZW50Q29uZmlndXJhdGlvbigpITtcbiAgICAgICAgbWdyLnVwZGF0ZVRvb2xTdGF0dXMoY2ZnLmlkLCAnbWFuYWdlX3NjZW5lJywgZmFsc2UpO1xuICAgICAgICBjb25zdCBuYW1lcyA9IG1nci5nZXRFbmFibGVkVG9vbE5hbWVzKCk7XG4gICAgICAgIGV4cGVjdChuYW1lcykubm90LnRvQ29udGFpbignbWFuYWdlX3NjZW5lJyk7XG4gICAgfSk7XG59KTtcbiJdfQ==