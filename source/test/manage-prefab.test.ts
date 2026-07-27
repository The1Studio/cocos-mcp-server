import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManagePrefab } from '../tools/manage-prefab';

describe('ManagePrefab', () => {
    let tool: ManagePrefab;

    beforeEach(() => {
        tool = new ManagePrefab();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_prefab');
        });

        it('lists validate as an action', () => {
            expect(tool.actions).toContain('validate');
        });
    });

    describe('validate action (#7 — invalid asset-db "read-asset" message)', () => {
        it('returns error when uuid is missing', async () => {
            const result = await tool.execute('validate', {});
            expect(result.success).toBe(false);
        });

        it('resolves the db url to a file path and reads it — never calls read-asset', async () => {
            const tmpFile = path.join(os.tmpdir(), `t1k-prefab-${process.pid}-${Date.now()}.prefab`);
            fs.writeFileSync(
                tmpFile,
                JSON.stringify([{ __type__: 'cc.Prefab' }, { __type__: 'cc.Node', _name: 'Root' }]),
                'utf-8',
            );
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ url: 'db://assets/ScoreUI.prefab' }) // query-asset-meta
                .mockResolvedValueOnce(tmpFile); // query-path

            const result = await tool.execute('validate', { uuid: 'da1db047-660d-407c-9aa3-cab9b4d1141b' });

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('isValid');
            // The bug: the old code called a nonexistent 'read-asset' message.
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-path', 'db://assets/ScoreUI.prefab');
            const calledMessages = mockRequest.mock.calls.map((c: any[]) => c[1]);
            expect(calledMessages).not.toContain('read-asset');

            fs.unlinkSync(tmpFile);
        });

        it('errors clearly when the file path cannot be resolved on disk', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ url: 'db://assets/ScoreUI.prefab' }) // query-asset-meta
                .mockResolvedValueOnce(null); // query-path returns nothing

            const result = await tool.execute('validate', { uuid: 'some-uuid' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/could not resolve prefab file path/i);
        });

        it('reports a parse error on malformed prefab JSON', async () => {
            const tmpFile = path.join(os.tmpdir(), `t1k-prefab-bad-${process.pid}-${Date.now()}.prefab`);
            fs.writeFileSync(tmpFile, 'not-json{', 'utf-8');
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ url: 'db://assets/Bad.prefab' })
                .mockResolvedValueOnce(tmpFile);

            const result = await tool.execute('validate', { uuid: 'bad-uuid' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot parse json/i);

            fs.unlinkSync(tmpFile);
        });
    });

    describe('update action (#12 — apply-prefab argument shape)', () => {
        const ROOT_UUID = 'root-uuid-1111';
        const ASSET_UUID = 'asset-uuid-2222';

        /** Node dump shaped like Cocos Creator 3.8.7's `query-node` result for a prefab instance. */
        const nodeDump = { __prefab__: { rootUuid: ROOT_UUID, uuid: ASSET_UUID } };

        function writePrefabFile(): string {
            const tmpFile = path.join(os.tmpdir(), `t1k-prefab-apply-${process.pid}-${Date.now()}.prefab`);
            fs.writeFileSync(tmpFile, JSON.stringify([{ __type__: 'cc.Prefab' }]), 'utf-8');
            return tmpFile;
        }

        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('update', {});
            expect(result.success).toBe(false);
        });

        it('passes the instance root uuid POSITIONALLY, never as a { node } object', async () => {
            const tmpFile = writePrefabFile();
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(nodeDump)                          // query-node
                .mockResolvedValueOnce({ url: 'db://assets/Foo.prefab' }) // query-asset-meta
                .mockResolvedValueOnce(tmpFile)                           // query-path
                .mockImplementationOnce(async () => {                     // apply-prefab
                    fs.writeFileSync(tmpFile, JSON.stringify([{ __type__: 'cc.Prefab', v: 2 }]), 'utf-8');
                    const future = Date.now() + 5000;
                    fs.utimesSync(tmpFile, new Date(future), new Date(future));
                    return true;
                });

            const result = await tool.execute('update', { nodeUuid: 'child-uuid-9999' });

            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'apply-prefab', ROOT_UUID);
            // The bug: the old code sent an object, which resolved without writing anything.
            expect(mockRequest).not.toHaveBeenCalledWith('scene', 'apply-prefab', { node: 'child-uuid-9999' });

            fs.unlinkSync(tmpFile);
        });

        it('reports failure when apply-prefab resolves false', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(nodeDump)
                .mockResolvedValueOnce({ url: 'db://assets/Foo.prefab' })
                .mockResolvedValueOnce(null)   // path unresolvable
                .mockResolvedValueOnce(false); // apply-prefab rejected

            const result = await tool.execute('update', { nodeUuid: ROOT_UUID });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/rejected apply-prefab/i);
        });

        it('reports failure when the prefab file was never rewritten', async () => {
            const tmpFile = writePrefabFile();
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(nodeDump)
                .mockResolvedValueOnce({ url: 'db://assets/Foo.prefab' })
                .mockResolvedValueOnce(tmpFile)
                .mockResolvedValueOnce(undefined); // resolves, writes nothing — the #12 symptom

            const result = await tool.execute('update', { nodeUuid: ROOT_UUID });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/was not rewritten/i);

            fs.unlinkSync(tmpFile);
        });

        it('errors when the node is not part of a prefab instance', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ name: 'PlainNode' });

            const result = await tool.execute('update', { nodeUuid: 'plain-node' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not part of a prefab instance/i);
        });
    });

    describe('revert action (#13 — scene:revert-prefab does not exist in 3.8.7)', () => {
        const ROOT_UUID = 'root-uuid-3333';
        const ASSET_UUID = 'asset-uuid-4444';
        const nodeDump = { __prefab__: { rootUuid: ROOT_UUID, uuid: ASSET_UUID } };

        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('revert', {});
            expect(result.success).toBe(false);
        });

        it('uses restore-prefab with positional (rootUuid, assetUuid) — never revert-prefab', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(nodeDump) // query-node
                .mockResolvedValueOnce(true);    // restore-prefab

            const result = await tool.execute('revert', { nodeUuid: 'child-uuid-8888' });

            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'restore-prefab', ROOT_UUID, ASSET_UUID);
            const calledMessages = mockRequest.mock.calls.map((c: any[]) => c[1]);
            expect(calledMessages).not.toContain('revert-prefab');
        });

        it('prefers an explicitly supplied assetUuid', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(nodeDump).mockResolvedValueOnce(true);

            await tool.execute('revert', { nodeUuid: ROOT_UUID, assetUuid: 'explicit-asset' });
            expect(mockRequest).toHaveBeenCalledWith('scene', 'restore-prefab', ROOT_UUID, 'explicit-asset');
        });

        it('errors when the prefab asset cannot be resolved', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ __prefab__: { rootUuid: ROOT_UUID } });

            const result = await tool.execute('revert', { nodeUuid: ROOT_UUID });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/could not resolve the prefab asset/i);
        });

        it('reports failure when restore-prefab resolves false', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(nodeDump).mockResolvedValueOnce(false);

            const result = await tool.execute('revert', { nodeUuid: ROOT_UUID });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/rejected restore-prefab/i);
        });

        it('restore action shares the same corrected implementation', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(nodeDump).mockResolvedValueOnce(true);

            const result = await tool.execute('restore', { nodeUuid: ROOT_UUID });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'restore-prefab', ROOT_UUID, ASSET_UUID);
        });
    });

    describe('instantiate action (#15 — false-success envelope with no nodeUuid)', () => {
        const PREFAB_UUID = 'a20d75f5-d599-4f64-8792-b99253e0c91e';
        const assetInfo = { name: 'meteor', url: 'db://assets/meteor.prefab', type: 'cc.Prefab' };

        it('returns error when prefabUuid is missing', async () => {
            const result = await tool.execute('instantiate', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/prefabUuid is required/i);
        });

        it('fails when the uuid is absent from the asset DB — never a success envelope', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('asset not found')); // query-asset-info

            const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found in the asset DB/i);
            expect(result.instruction).toMatch(/refresh/i);
            const calledMessages = mockRequest.mock.calls.map((c: any[]) => c[1]);
            expect(calledMessages).not.toContain('create-node');
        });

        it('fails when query-asset-info resolves null for an unimported uuid', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(null); // query-asset-info

            const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID });

            expect(result.success).toBe(false);
            expect(result.error).toContain(PREFAB_UUID);
        });

        it('fails when create-node returns no node uuid', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(assetInfo)  // query-asset-info
                .mockResolvedValueOnce(undefined); // create-node

            const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/returned no node uuid/i);
        });

        it('fails when create-node returns an empty array', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(assetInfo) // query-asset-info
                .mockResolvedValueOnce([]);       // create-node

            const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID });
            expect(result.success).toBe(false);
        });

        it('succeeds with a non-empty nodeUuid when the prefab resolves', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(assetInfo)      // query-asset-info
                .mockResolvedValueOnce('new-node-777'); // create-node

            const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID });

            expect(result.success).toBe(true);
            expect(result.data.nodeUuid).toBe('new-node-777');
            expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.objectContaining({
                assetUuid: PREFAB_UUID,
                name: 'meteor'
            }));
        });

        it('passes the asset db type so create-node links a PrefabInstance instead of a flattened copy', async () => {
            // Regression test: 3.8.7's NodeManager.createNodeFromAsset() picks the
            // linked-instance branch based on options.type. Omitting it (as the old
            // code did) falls back to a plain-dump node with no cc.PrefabInfo — the
            // "instantiate reports success but produces an unlinked copy" bug.
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(assetInfo)      // query-asset-info
                .mockResolvedValueOnce('new-node-999'); // create-node

            const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID });

            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.objectContaining({
                assetUuid: PREFAB_UUID,
                type: 'cc.Prefab'
            }));
        });

        it('passes position as a top-level CreateNodeOptions field, never as an unused dump wrapper', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(assetInfo)
                .mockResolvedValueOnce('new-node-555');

            const result = await tool.execute('instantiate', {
                prefabUuid: PREFAB_UUID,
                position: { x: 1, y: 2, z: 3 }
            });

            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.objectContaining({
                position: { x: 1, y: 2, z: 3 }
            }));
            const createNodeCall = mockRequest.mock.calls.find((c: any[]) => c[1] === 'create-node');
            expect(createNodeCall?.[2]).not.toHaveProperty('dump');
        });

        it('applies rotation and scale after a successful create-node', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce(assetInfo)
                .mockResolvedValueOnce(['new-node-888']);

            const result = await tool.execute('instantiate', {
                prefabUuid: PREFAB_UUID,
                rotation: { x: 0, y: 90, z: 0 },
                scale: { x: 2, y: 2, z: 2 }
            });

            expect(result.success).toBe(true);
            expect(result.data.nodeUuid).toBe('new-node-888');
            expect(mockRequest).toHaveBeenCalledWith('scene', 'set-property', expect.objectContaining({
                uuid: 'new-node-888',
                path: 'eulerAngles'
            }));
            expect(mockRequest).toHaveBeenCalledWith('scene', 'set-property', expect.objectContaining({
                uuid: 'new-node-888',
                path: 'scale'
            }));
        });
    });
});
