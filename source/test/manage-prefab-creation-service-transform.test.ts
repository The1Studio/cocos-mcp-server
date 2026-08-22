/**
 * Regression test for issue #50 — `manage_prefab` action=create reset every node's
 * transform to identity (0,0,0 / no rotation / scale 1) and reported success.
 *
 * Root cause: `enhanceTreeWithMCPComponents` re-fetched `query-node` to build an accurate
 * component list, but only carried `components` onto the working node — it dropped the
 * `position`/`rotation`/`scale` fields the same dump carries. `createEngineStandardNode`
 * therefore always fell through to its identity defaults, since the node it received never
 * had a `position`/`rotation`/`scale` key to read in the first place.
 *
 * NOT issue #50's originally-cited cause: `createPrefabFromNode` (source/scene.ts) is dead
 * code with no callers in `source/` — the real path is `PrefabCreationService`.
 */

import { PrefabCreationService } from '../tools/manage-prefab-creation-service';

declare const global: any;

describe('PrefabCreationService — transform carry-through (issue #50)', () => {
    let service: PrefabCreationService;
    let requestMock: jest.Mock;

    beforeEach(() => {
        service = new PrefabCreationService();
        requestMock = (global as any).Editor.Message.request as jest.Mock;
        requestMock.mockReset();
    });

    it('enhanceTreeWithMCPComponents carries position/rotation/scale onto the node', async () => {
        const queryNodeDump = {
            name: { value: 'Enemy' },
            position: { value: { x: 3, y: 4, z: 5 } },
            rotation: { value: { x: 0, y: 0, z: 0.7071, w: 0.7071 } },
            scale: { value: { x: 2, y: 2, z: 1 } },
            __comps__: [{ __type__: 'cc.Sprite', uuid: { value: 'comp-uuid-1' }, enabled: true }],
        };
        requestMock.mockResolvedValueOnce(queryNodeDump);

        const inputNode = { uuid: 'node-uuid-1', name: 'Enemy' };
        const enhanced = await (service as any).enhanceTreeWithMCPComponents(inputNode);

        expect(enhanced.position).toEqual(queryNodeDump.position);
        expect(enhanced.rotation).toEqual(queryNodeDump.rotation);
        expect(enhanced.scale).toEqual(queryNodeDump.scale);
        expect(enhanced.components).toHaveLength(1);
    });

    it('createEngineStandardNode reads the carried transform instead of falling back to identity', () => {
        const nodeData = {
            name: { value: 'Enemy' },
            position: { value: { x: 3, y: 4, z: 5 } },
            rotation: { value: { x: 0, y: 0, z: 0.7071, w: 0.7071 } },
            scale: { value: { x: 2, y: 2, z: 1 } },
        };

        const node = (service as any).createEngineStandardNode(nodeData, null);

        expect(node._lpos).toEqual({ __type__: 'cc.Vec3', x: 3, y: 4, z: 5 });
        expect(node._lrot).toEqual({ __type__: 'cc.Quat', x: 0, y: 0, z: 0.7071, w: 0.7071 });
        expect(node._lscale).toEqual({ __type__: 'cc.Vec3', x: 2, y: 2, z: 1 });
    });

    it('createEngineStandardNode still defaults to identity when no transform is present', () => {
        const node = (service as any).createEngineStandardNode({ name: { value: 'NoTransform' } }, null);

        expect(node._lpos).toEqual({ __type__: 'cc.Vec3', x: 0, y: 0, z: 0 });
        expect(node._lrot).toEqual({ __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 });
        expect(node._lscale).toEqual({ __type__: 'cc.Vec3', x: 1, y: 1, z: 1 });
    });

    it('enhanceTreeWithMCPComponents does not attach components when query-node has none', async () => {
        requestMock.mockResolvedValueOnce({ name: { value: 'Empty' }, position: { value: { x: 1, y: 0, z: 0 } } });

        const enhanced = await (service as any).enhanceTreeWithMCPComponents({ uuid: 'node-uuid-2', name: 'Empty' });

        expect(enhanced.position).toEqual({ value: { x: 1, y: 0, z: 0 } });
        expect(enhanced.components).toBeUndefined();
    });
});
