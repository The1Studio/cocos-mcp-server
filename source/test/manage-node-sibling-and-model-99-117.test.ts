import { ManageNode } from '../tools/manage-node';

/**
 * #99 items 2-3: `manage_node create|move` with `siblingIndex` reported success while the node
 * stayed the LAST child. `set-parent` appends and `siblingIndex` is not a settable property, so
 * the order must be driven through `move-array-element` on the parent's `children` and read back.
 *
 * #117: `manage_node create` with a raw `.fbx` uuid instantiated an empty node and reported
 * success; the instantiable content is the `gltf-scene` sub-asset.
 */
describe('ManageNode sibling ordering and model assets (#99, #117)', () => {
    let tool: ManageNode;
    let mockRequest: jest.Mock;
    let children: string[];
    let log: Array<{ message: string; args: any }>;

    /** A parent whose `children` list is mutable; `move-array-element` really reorders it. */
    function routeHierarchy(opts: { moveWorks?: boolean } = {}) {
        const moveWorks = opts.moveWorks !== false;
        mockRequest.mockImplementation(async (pkg: string, message: string, arg: any) => {
            log.push({ message, args: arg });
            if (pkg === 'scene') {
                switch (message) {
                    case 'create-node': children.push('new-node'); return 'new-node';
                    case 'set-parent': {
                        const uuid = arg.uuids[0];
                        const i = children.indexOf(uuid);
                        if (i >= 0) children.splice(i, 1);
                        children.push(uuid); // set-parent always appends
                        return true;
                    }
                    case 'move-array-element': {
                        if (!moveWorks) return true; // accepted, but order unchanged
                        const [item] = children.splice(arg.target, 1);
                        children.splice(arg.target + arg.offset, 0, item);
                        return true;
                    }
                    case 'query-node':
                        if (arg === 'parent-1') return { uuid: { value: 'parent-1' }, children: children.map(u => ({ value: { uuid: u } })) };
                        return { uuid: { value: arg }, name: { value: 'N' }, parent: { value: { uuid: 'parent-1' } }, __comps__: [] };
                    default: return {};
                }
            }
            return {};
        });
    }

    beforeEach(() => {
        tool = new ManageNode();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        children = ['a', 'b', 'c'];
        log = [];
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('create honours siblingIndex and reports where the node landed', async () => {
        routeHierarchy();
        const result = await tool.execute('create', { name: 'X', parentUuid: 'parent-1', siblingIndex: 0 });

        expect(result.success).toBe(true);
        expect(children).toEqual(['new-node', 'a', 'b', 'c']);
        expect(result.data.siblingOrder).toMatchObject({ requested: 0, applied: true, actualIndex: 0 });
        expect(result.data.warning).toBeUndefined();
    });

    it('create warns when the editor accepts the reorder but the order did not change', async () => {
        routeHierarchy({ moveWorks: false });
        const result = await tool.execute('create', { name: 'X', parentUuid: 'parent-1', siblingIndex: 0 });

        expect(result.success).toBe(true);
        expect(result.data.siblingOrder.applied).toBe(false);
        expect(result.data.warning).toMatch(/siblingIndex 0 was NOT applied/);
    });

    it('move places the node at siblingIndex instead of leaving it last', async () => {
        routeHierarchy();
        const result = await tool.execute('move', { nodeUuid: 'c', newParentUuid: 'parent-1', siblingIndex: 1 });

        expect(result.success).toBe(true);
        expect(children).toEqual(['a', 'c', 'b']);
        expect(result.data.siblingOrder).toMatchObject({ applied: true, actualIndex: 1 });
    });

    it('move fails loudly when siblingIndex cannot be applied', async () => {
        routeHierarchy({ moveWorks: false });
        const result = await tool.execute('move', { nodeUuid: 'c', newParentUuid: 'parent-1', siblingIndex: 0 });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/siblingIndex 0 was NOT applied/);
    });

    it('move clamps an index past the end to the last position', async () => {
        routeHierarchy();
        const result = await tool.execute('move', { nodeUuid: 'a', newParentUuid: 'parent-1', siblingIndex: 99 });

        expect(result.success).toBe(true);
        expect(children).toEqual(['b', 'c', 'a']);
    });

    describe('model assets (#117)', () => {
        function routeAsset(subMetas: Record<string, any>, importer = 'fbx') {
            mockRequest.mockImplementation(async (pkg: string, message: string, arg: any) => {
                log.push({ message, args: arg });
                if (pkg === 'asset-db' && message === 'query-asset-info') {
                    return arg.includes('@') ? { type: 'cc.Prefab', importer: 'gltf-scene' } : { type: 'cc.Asset', importer };
                }
                if (pkg === 'asset-db' && message === 'query-asset-meta') return { importer, subMetas };
                if (pkg === 'scene' && message === 'create-node') return 'model-node';
                if (pkg === 'scene' && message === 'query-node') return { uuid: { value: 'model-node' }, __comps__: [] };
                return {};
            });
        }

        it('redirects a raw fbx uuid to its gltf-scene sub-asset', async () => {
            routeAsset({ '3fb33': { importer: 'gltf-scene', uuid: 'fbx-uuid@3fb33' }, '1a': { importer: 'gltf-mesh', uuid: 'fbx-uuid@1a' } });
            const result = await tool.execute('create', { name: 'Visual', parentUuid: 'p', assetUuid: 'fbx-uuid' });

            const create = log.find(l => l.message === 'create-node')!;
            expect(create.args.assetUuid).toBe('fbx-uuid@3fb33');
            expect(create.args.type).toBe('cc.Prefab');
            expect(result.success).toBe(true);
            expect(result.data.assetUuid).toBe('fbx-uuid@3fb33');
            expect(result.data.resolvedFromModelUuid).toBe('fbx-uuid');
        });

        it('synthesises the sub-asset address when the sub-meta carries no uuid', async () => {
            routeAsset({ '3fb33': { importer: 'gltf-scene' } });
            await tool.execute('create', { name: 'Visual', parentUuid: 'p', assetUuid: 'fbx-uuid' });

            expect(log.find(l => l.message === 'create-node')!.args.assetUuid).toBe('fbx-uuid@3fb33');
        });

        it('refuses a model with no gltf-scene sub-asset instead of creating an empty node', async () => {
            routeAsset({ '1a': { importer: 'gltf-mesh', uuid: 'fbx-uuid@1a' } });
            const result = await tool.execute('create', { name: 'Visual', parentUuid: 'p', assetUuid: 'fbx-uuid' });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no 'gltf-scene' sub-asset/);
            expect(log.some(l => l.message === 'create-node')).toBe(false);
        });

        it('leaves an explicit sub-asset address untouched', async () => {
            routeAsset({});
            await tool.execute('create', { name: 'Visual', parentUuid: 'p', assetUuid: 'fbx-uuid@3fb33' });

            expect(log.find(l => l.message === 'create-node')!.args.assetUuid).toBe('fbx-uuid@3fb33');
            expect(log.some(l => l.message === 'query-asset-meta')).toBe(false);
        });
    });
});
