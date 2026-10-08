import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManageScene } from '../tools/manage-scene';
import { readPrefabRootActive } from '../utils/save-artifact-guard';

/**
 * #99 item 4 — a `manage_scene save` while the editor is in prefab-edit mode was reported to
 * flip the prefab ROOT's `_active` to true in the written `.prefab`. The flip happens inside
 * the editor's own prefab serializer, so this repo cannot prevent it; what it can do — and
 * what #6/#78 already do for override records — is read the artifact back and refuse to call
 * the save good when the root's persisted `_active` disagrees with the live root's `active`.
 *
 * Verified here: the guard's decision logic against real files with a routed editor mock.
 * NOT verified (needs a live 3.8.x editor): that the editor's prefab-mode tree has the shape
 * mocked below (scene wrapper whose uuid resolves to the .prefab asset, one child = the root).
 */
describe('ManageScene.save — prefab root _active read-back (#99 item 4)', () => {
    let tool: ManageScene;
    let mockRequest: jest.Mock;
    let tmpDir: string;
    let prefabPath: string;

    function prefabJson(rootActive: boolean, marker = 'x'): string {
        return JSON.stringify([
            { __type__: 'cc.Prefab', _name: marker, data: { __id__: 1 } },
            { __type__: 'cc.Node', _name: 'Root', _active: rootActive, _children: [], _components: [] },
        ], null, 2);
    }

    function rewrite(rootActive: boolean) {
        fs.writeFileSync(prefabPath, prefabJson(rootActive, 'after'), 'utf-8');
        const future = new Date(Date.now() + 5000);
        fs.utimesSync(prefabPath, future, future);
    }

    function route(liveRootActive: boolean | 'unreadable', onSave: () => void, treeChildren: any[] | null = [{ uuid: 'root-node', name: 'Root', children: [] }]) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            switch (message) {
                case 'query-node-tree': return { uuid: 'prefab-asset-uuid', name: 'Door', ...(treeChildren ? { children: treeChildren } : {}) };
                case 'query-asset-info': return { uuid: 'prefab-asset-uuid', url: 'db://assets/Door.prefab', file: prefabPath };
                case 'save-scene': onSave(); return true;
                case 'query-dirty': return false;
                case 'query-node':
                    if (liveRootActive === 'unreadable') throw new Error('query-node failed');
                    return { uuid: { value: args[0] }, active: { value: liveRootActive } };
                default: throw new Error(`${pkg} - ${message} does not exist`);
            }
        });
    }

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-prefab-save-test-'));
        prefabPath = path.join(tmpDir, 'Door.prefab');
        fs.writeFileSync(prefabPath, prefabJson(false, 'before'), 'utf-8');
        tool = new ManageScene();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('readPrefabRootActive reads the root node _active through cc.Prefab.data', () => {
        expect(readPrefabRootActive(prefabPath)).toBe(false);
        fs.writeFileSync(prefabPath, prefabJson(true), 'utf-8');
        expect(readPrefabRootActive(prefabPath)).toBe(true);
    });

    it('readPrefabRootActive returns null (not false) for unreadable or non-prefab content', () => {
        expect(readPrefabRootActive(path.join(tmpDir, 'missing.prefab'))).toBeNull();
        fs.writeFileSync(prefabPath, '{"not":"an array"}', 'utf-8');
        expect(readPrefabRootActive(prefabPath)).toBeNull();
        expect(readPrefabRootActive(null)).toBeNull();
    });

    it('FAILS when the saved prefab root is _active:true but the live root is inactive', async () => {
        route(false, () => rewrite(true));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/_active/);
        expect(result.error).toMatch(/inactive|false/i);
        expect(result.error).toMatch(/#99/);
    });

    it('FAILS in the opposite direction too (live active, artifact _active:false)', async () => {
        route(true, () => rewrite(false));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/_active/);
    });

    it('SUCCEEDS when the persisted root _active matches the live root', async () => {
        route(false, () => rewrite(false));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.rootActiveVerified).toBe(true);
    });

    it('does not fail the save when the live root cannot be read; says it is unverified', async () => {
        route('unreadable', () => rewrite(true));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.rootActiveVerified).toBe(false);
    });

    it('does not guess the root when the tree has no single child to compare against', async () => {
        route(false, () => rewrite(true), []);

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.rootActiveVerified).toBe(false);
    });

    it('does not run for a .scene artifact', async () => {
        const scenePath = path.join(tmpDir, 'Main.scene');
        fs.writeFileSync(scenePath, JSON.stringify([{ __type__: 'cc.SceneAsset' }]), 'utf-8');
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string) => {
            switch (message) {
                case 'query-node-tree': return { uuid: 'scene-uuid', name: 'Main', children: [{ uuid: 'c', name: 'Canvas', children: [] }] };
                case 'query-asset-info': return { uuid: 'scene-uuid', url: 'db://assets/Main.scene', file: scenePath };
                case 'save-scene': {
                    fs.writeFileSync(scenePath, JSON.stringify([{ __type__: 'cc.SceneAsset', _name: 'after' }]), 'utf-8');
                    const future = new Date(Date.now() + 5000);
                    fs.utimesSync(scenePath, future, future);
                    return true;
                }
                case 'query-dirty': return false;
                default: throw new Error(`${pkg} - ${message} does not exist`);
            }
        });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data).not.toHaveProperty('rootActiveVerified');
        expect(mockRequest).not.toHaveBeenCalledWith('scene', 'query-node', expect.anything());
    });
});
