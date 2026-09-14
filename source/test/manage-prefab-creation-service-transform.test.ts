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

/**
 * Regression test for the euler/quaternion mix-up and the dropped layer.
 *
 * `query-node` reports `rotation` as EULER DEGREES (a cc.Vec3, no `w`) — the same value the
 * inspector's Rotation field shows. `_lrot` is a quaternion, so writing the dump straight
 * through stored a degree value in a quaternion component: a -0.1 degree tilt serialized as
 * `{z: -0.1, w: 1}`, which the engine reads back as roughly -11.46 degrees. The tests above
 * missed this because they mock `rotation` as a quaternion, a shape the editor never sends.
 *
 * `_layer` was hardcoded to DEFAULT (1 << 30), so every node in a created prefab landed on
 * the DEFAULT layer. A UI prefab whose nodes must be UI_2D (1 << 25) is culled by the UI
 * camera and renders nothing, while the same node in the scene renders correctly.
 *
 * Reference values are taken from a real Cocos Creator 3.8.7 scene: a node with euler
 * z = -0.1 serializes `_lrot` as z = -0.0008726645152351496, w = 0.9999996192282494.
 */
describe('PrefabCreationService — euler rotation and layer', () => {
    let service: PrefabCreationService;
    let requestMock: jest.Mock;

    const UI_2D = 33554432;
    const DEFAULT_LAYER = 1073741824;

    beforeEach(() => {
        service = new PrefabCreationService();
        requestMock = (global as any).Editor.Message.request as jest.Mock;
        requestMock.mockReset();
    });

    it('converts an euler-degrees rotation dump into a quaternion', () => {
        const node = (service as any).createEngineStandardNode({
            name: { value: 'QrCode' },
            rotation: { value: { x: 0, y: 0, z: -0.1 } },
        }, null);

        expect(node._lrot.x).toBeCloseTo(0, 12);
        expect(node._lrot.y).toBeCloseTo(0, 12);
        expect(node._lrot.z).toBeCloseTo(-0.0008726645152351496, 12);
        expect(node._lrot.w).toBeCloseTo(0.9999996192282494, 12);
    });

    it('carries the euler degrees through to _euler', () => {
        const node = (service as any).createEngineStandardNode({
            name: { value: 'QrCode' },
            rotation: { value: { x: 0, y: 0, z: -0.1 } },
        }, null);

        expect(node._euler).toEqual({ __type__: 'cc.Vec3', x: 0, y: 0, z: -0.1 });
    });

    it('passes a genuine quaternion dump through unconverted', () => {
        const node = (service as any).createEngineStandardNode({
            name: { value: 'Enemy' },
            rotation: { value: { x: 0, y: 0, z: 0.7071, w: 0.7071 } },
        }, null);

        expect(node._lrot).toEqual({ __type__: 'cc.Quat', x: 0, y: 0, z: 0.7071, w: 0.7071 });
    });

    it('serializes the node layer from the dump instead of hardcoding DEFAULT', () => {
        const node = (service as any).createEngineStandardNode({
            name: { value: 'Background' },
            layer: { value: UI_2D },
        }, null);

        expect(node._layer).toBe(UI_2D);
    });

    it('accepts a bare layer value as well as a wrapped one', () => {
        const node = (service as any).createEngineStandardNode({ name: { value: 'Background' }, layer: UI_2D }, null);

        expect(node._layer).toBe(UI_2D);
    });

    it('falls back to DEFAULT when the dump carries no layer', () => {
        const node = (service as any).createEngineStandardNode({ name: { value: 'NoLayer' } }, null);

        expect(node._layer).toBe(DEFAULT_LAYER);
    });

    it('enhanceTreeWithMCPComponents carries the layer onto the node', async () => {
        requestMock.mockResolvedValueOnce({
            name: { value: 'Background' },
            position: { value: { x: 0, y: -53, z: 0 } },
            layer: { value: UI_2D },
        });

        const enhanced = await (service as any).enhanceTreeWithMCPComponents({ uuid: 'node-uuid-3', name: 'Background' });

        expect(enhanced.layer).toEqual({ value: UI_2D });
    });
});
