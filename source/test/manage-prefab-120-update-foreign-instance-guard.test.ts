import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManagePrefab } from '../tools/manage-prefab';

/**
 * #120 item 2 - `update` called `scene:apply-prefab` on the resolved root with no check of
 * what lived under it, so an unrelated prefab instance nested there was serialized into the
 * target asset (a 35-line leaf prefab became 646 lines). The guard refuses before the write.
 */
describe('manage_prefab update - foreign nested instance guard (#120)', () => {
    const ROOT = 'root-1';
    const ASSET = 'asset-target';
    const FOREIGN = 'asset-foreign';
    const KNOWN_NESTED = 'asset-already-nested';
    let tool: ManagePrefab;
    let tmpFile: string;
    let mockRequest: jest.Mock;
    let applyCalls: any[][];

    function route(tree: Record<string, any>) {
        mockRequest.mockReset();
        applyCalls = [];
        mockRequest.mockImplementation(async (_pkg: string, message: string, ...args: any[]) => {
            if (message === 'query-node') return tree[args[0]];
            if (message === 'query-asset-info') return { url: 'db://assets/T.prefab', file: tmpFile };
            if (message === 'apply-prefab') {
                applyCalls.push(args);
                fs.writeFileSync(tmpFile, JSON.stringify([{ __type__: 'cc.Prefab', v: 2, nested: KNOWN_NESTED }]), 'utf-8');
                const future = Date.now() + 5000;
                fs.utimesSync(tmpFile, new Date(future), new Date(future));
                return true;
            }
            throw new Error(`unexpected ${message}`);
        });
    }

    const node = (uuid: string, asset: string, children: string[] = []) => ({
        uuid, __prefab__: { rootUuid: ROOT, uuid: asset, fileId: `f-${uuid}` },
        children: children.map(c => ({ value: { uuid: c } })),
    });

    beforeEach(() => {
        tool = new ManagePrefab();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        tmpFile = path.join(os.tmpdir(), `t1k-prefab-120-${process.pid}-${Date.now()}.prefab`);
        fs.writeFileSync(tmpFile, JSON.stringify([{ __type__: 'cc.Prefab', nested: KNOWN_NESTED }]), 'utf-8');
    });
    afterEach(() => { try { fs.unlinkSync(tmpFile); } catch { /* already gone */ } });

    it('refuses, and never calls apply-prefab, when an unrelated instance is nested under the root', async () => {
        route({ [ROOT]: node(ROOT, ASSET, ['inner']), inner: node('inner', FOREIGN) });
        const result = await tool.execute('update', { nodeUuid: ROOT });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/asset-foreign/);
        expect(applyCalls).toHaveLength(0);
    });

    it('allows a nested instance the asset file already references', async () => {
        route({ [ROOT]: node(ROOT, ASSET, ['inner']), inner: node('inner', KNOWN_NESTED) });
        const result = await tool.execute('update', { nodeUuid: ROOT });
        expect(result.success).toBe(true);
        expect(applyCalls).toEqual([[ROOT]]);
    });

    it('allows a plain subtree whose members all belong to the target asset', async () => {
        route({ [ROOT]: node(ROOT, ASSET, ['inner']), inner: node('inner', ASSET) });
        const result = await tool.execute('update', { nodeUuid: ROOT });
        expect(result.success).toBe(true);
        expect(applyCalls).toHaveLength(1);
    });
});
