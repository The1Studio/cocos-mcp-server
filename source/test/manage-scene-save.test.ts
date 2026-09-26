import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManageScene } from '../tools/manage-scene';

/**
 * #6 — `manage_scene action=save` reported `{"success":true,"message":"Scene saved
 * successfully"}` while the edit was never written to disk.
 *
 * The pre-fix suite below asserted only the two EDITOR-VISIBLE signals: `save-scene`'s
 * boolean and `query-dirty`. Both can read green while the artifact is untouched — #6's
 * 2026-09-21 regression report is exactly that (three `save` calls returning `true`,
 * `query_dirty` reading `false`, the `.scene` file's mtime frozen at its pre-edit
 * timestamp). These tests drive the ARTIFACT instead, so a save that reports success over
 * a file it did not write fails here.
 */
describe('ManageScene.save (#6)', () => {
    let tool: ManageScene;
    let mockRequest: jest.Mock;
    let tmpDir: string;
    let scenePath: string;

    /** A serialized scene carrying `overrideCount` cc.TargetOverrideInfo records. */
    function sceneJson(overrideCount: number, marker: string): string {
        const doc: any[] = [{ __type__: 'cc.SceneAsset', _name: marker }];
        for (let i = 0; i < overrideCount; i++) {
            doc.push({
                __type__: 'cc.TargetOverrideInfo',
                propertyPath: ['_target'],
                source: `source-${i}`,
                targetInfo: { __id__: i + 1 }
            });
        }
        return JSON.stringify(doc, null, 2);
    }

    function writeScene(content: string): void {
        fs.writeFileSync(scenePath, content, 'utf-8');
    }

    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    /** The messages every path through saveScene needs before it touches the artifact. */
    function baseHandlers(extra: Record<string, (...args: any[]) => any> = {}) {
        return {
            'query-node-tree': () => ({ uuid: 'scene-uuid-1', name: 'MainScene' }),
            'query-asset-info': () => ({ uuid: 'scene-uuid-1', url: 'db://assets/MainScene.scene', file: scenePath }),
            ...extra
        };
    }

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-save-test-'));
        scenePath = path.join(tmpDir, 'MainScene.scene');
        tool = new ManageScene();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // ---------------------------------------------------------------- the lie, reproduced

    it('FAILS when save-scene reports success but the file was never rewritten', async () => {
        writeScene(sceneJson(0, 'before'));

        routeMessages(baseHandlers({
            'save-scene': () => true,
            'query-dirty': () => false,
            // The editor "saves" — the artifact never changes. This is #6's regression
            // report: every editor-visible signal is green, the file is not.
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not rewritten|not serialised/i);
        expect(result.error).toMatch(/false-success shape/i);
        // The file is the evidence: still the pre-save bytes.
        expect(fs.readFileSync(scenePath, 'utf-8')).toBe(sceneJson(0, 'before'));
    });

    it('SUCCEEDS and reports the artifact as verified when the file IS rewritten', async () => {
        writeScene(sceneJson(0, 'before'));

        routeMessages(baseHandlers({
            'save-scene': () => {
                writeScene(sceneJson(0, 'after'));
                // Push the mtime past the baseline the tool captured before the call, the
                // way a real write does; a same-millisecond write would otherwise read as
                // "unchanged" regardless of the tool's logic.
                const future = new Date(Date.now() + 5000);
                fs.utimesSync(scenePath, future, future);
                return true;
            },
            'query-dirty': () => false,
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.persistenceVerified).toBe(true);
        expect(result.message).toMatch(/file rewritten/i);
    });

    // ------------------------------------------------- #78: the lossy round-trip

    it('FAILS and names the lost propertyPath when a save drops cc.TargetOverrideInfo records', async () => {
        writeScene(sceneJson(3, 'before'));

        routeMessages(baseHandlers({
            'save-scene': () => {
                // The file IS rewritten — mtime moves — but one override record is gone.
                // A count-only or mtime-only check calls this a clean save.
                writeScene(sceneJson(2, 'after'));
                const future = new Date(Date.now() + 5000);
                fs.utimesSync(scenePath, future, future);
                return true;
            },
            'query-dirty': () => false,
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/WAS LOSSY/i);
        expect(result.error).toMatch(/cc\.TargetOverrideInfo/);
        expect(result.error).toMatch(/propertyPath/);
        expect(result.data.persistenceVerified).toBe(true);
    });

    it('reports a save that PRESERVES every override record as verified', async () => {
        writeScene(sceneJson(25, 'before'));

        routeMessages(baseHandlers({
            'save-scene': () => {
                writeScene(sceneJson(25, 'after'));
                const future = new Date(Date.now() + 5000);
                fs.utimesSync(scenePath, future, future);
                return true;
            },
            'query-dirty': () => false,
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.persistenceVerified).toBe(true);
    });

    // ---------------------------------------------------- the pre-existing contracts

    it('fails when save-scene returns false — the old code discarded this result', async () => {
        writeScene(sceneJson(0, 'before'));
        routeMessages(baseHandlers({ 'save-scene': () => false }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/returned false/i);
    });

    it('fails when the scene is still dirty immediately after a reported-successful save', async () => {
        writeScene(sceneJson(0, 'before'));
        routeMessages(baseHandlers({
            'save-scene': () => true,
            'query-dirty': () => true,
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/still dirty/i);
        expect(result.error).toMatch(/sequentially/i);
    });

    it('propagates a rejected save-scene call instead of silently succeeding', async () => {
        writeScene(sceneJson(0, 'before'));
        routeMessages(baseHandlers({
            'save-scene': () => { throw new Error('scene process crashed'); },
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/scene process crashed/i);
    });

    it('does not fail the save when the dirty check itself is unavailable and the write is confirmed', async () => {
        writeScene(sceneJson(0, 'before'));
        routeMessages(baseHandlers({
            'save-scene': () => {
                writeScene(sceneJson(0, 'after'));
                const future = new Date(Date.now() + 5000);
                fs.utimesSync(scenePath, future, future);
                return true;
            },
            'query-dirty': () => { throw new Error('query-dirty does not exist'); },
        }));

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.persistenceVerified).toBe(true);
    });

    it('reports the artifact as unverified — not as a pass — when the scene file cannot be resolved', async () => {
        writeScene(sceneJson(0, 'before'));
        routeMessages({
            'query-node-tree': () => ({ uuid: 'scene-uuid-1', name: 'MainScene' }),
            // No `file` on the asset info and no url to fall back on: the on-disk path is
            // unknowable, so neither the write nor its contents can be checked.
            'query-asset-info': () => ({ uuid: 'scene-uuid-1' }),
            'save-scene': () => true,
            'query-dirty': () => false,
        });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.persistenceVerified).toBe(false);
        expect(result.message).toMatch(/dirty state unverifiable/i);
    });
});
