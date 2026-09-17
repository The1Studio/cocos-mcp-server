import { ManageScene } from '../tools/manage-scene';

/**
 * Issue #85 — `get_hierarchy` with `includeComponents: true` silently returned no
 * component data.
 *
 * Root cause: `getSceneHierarchy` builds the tree from `Editor.Message.request('scene',
 * 'query-node-tree')`, whose resolved nodes never carry `__comps__` — so
 * `buildHierarchy`'s `includeComponents && node.__comps__` branch never fires even
 * though the primary promise resolves successfully. The existing `execute-scene-script`
 * fallback (which DOES return real component data, from the live `cc.Node` tree) was
 * wired inside `.catch()`, so it only ever runs if `query-node-tree` REJECTS — never when
 * it resolves without components, which is the actual, common case.
 */
describe('ManageScene.get_hierarchy — includeComponents (issue #85)', () => {
    let tool: ManageScene;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        tool = new ManageScene();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('returns real component data via the scene-script even though query-node-tree resolves successfully', async () => {
        const scriptHierarchy = [
            {
                name: 'Root',
                uuid: 'root-uuid',
                active: true,
                components: [{ type: 'cc.UITransform', enabled: true }],
                children: []
            }
        ];
        mockRequest.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node-tree') {
                // Real editor behavior: resolves successfully, but WITHOUT __comps__.
                return Promise.resolve({
                    uuid: 'scene-uuid', name: 'Scene',
                    children: [{ uuid: 'root-uuid', name: 'Root', active: true, children: [] }]
                });
            }
            if (action === 'execute-scene-script' && payload?.method === 'getSceneHierarchy') {
                return Promise.resolve({ success: true, data: scriptHierarchy });
            }
            return Promise.resolve({});
        });

        const result = await tool.execute('get_hierarchy', { includeComponents: true });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(scriptHierarchy);
    });

    it('reports the scene-script error when it fails, instead of silently returning no components', async () => {
        mockRequest.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node-tree') {
                return Promise.resolve({ uuid: 'scene-uuid', name: 'Scene', children: [] });
            }
            if (action === 'execute-scene-script' && payload?.method === 'getSceneHierarchy') {
                return Promise.resolve({ success: false, error: 'No active scene' });
            }
            return Promise.resolve({});
        });

        const result = await tool.execute('get_hierarchy', { includeComponents: true });

        expect(result.success).toBe(false);
        expect(result.error).toBe('No active scene');
    });

    // Regression: the includeComponents:false path must keep using query-node-tree
    // directly, unchanged — it works correctly today and must not regress.
    it('still uses query-node-tree directly when includeComponents is false', async () => {
        const tree = {
            uuid: 'scene-uuid', name: 'Scene', type: 'cc.Scene', active: true,
            children: [{ uuid: 'root-uuid', name: 'Root', type: 'cc.Node', active: true, children: [] }]
        };
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node-tree') return Promise.resolve(tree);
            return Promise.resolve({});
        });

        const result = await tool.execute('get_hierarchy', { includeComponents: false });

        expect(result.success).toBe(true);
        expect(result.data.uuid).toBe('scene-uuid');
        expect(mockRequest.mock.calls.some((c: any[]) => c[1] === 'execute-scene-script')).toBe(false);
    });
});
