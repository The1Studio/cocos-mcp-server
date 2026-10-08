import { ManagePrefab } from '../tools/manage-prefab';

/**
 * #148 — `manage_prefab instantiate` with `parentUuid` + `position` placed the node at that
 * position in WORLD space (scene:create-node's `position` option), not relative to the
 * parent, so under a transformed parent the instance landed in the wrong place. The tool
 * contract is parent-local, matching `manage_node create`.
 *
 * Pinned by what the tool SENDS, since the editor is not available here: when a parent is
 * supplied the position must not ride on `create-node` (world semantics); it must be applied
 * afterwards through `set-property path=position` (a local-position write), and a failed
 * write must surface as an error rather than leave the node silently at the origin.
 */
declare const global: any;

describe('ManagePrefab instantiate — position is local to the parent (#148)', () => {
    let tool: ManagePrefab;
    let mockRequest: jest.Mock;
    const PREFAB_UUID = 'prefab-uuid-1';

    function route(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    const base = () => ({
        'query-asset-info': () => ({ uuid: PREFAB_UUID, name: 'Door', type: 'cc.Prefab' }),
        'query-node-tree': () => ({ uuid: 'scene-root-uuid', name: 'Scene', children: [] }),
        'create-node': () => ['new-node-uuid'],
    });

    beforeEach(() => {
        tool = new ManagePrefab();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('does not hand a position to create-node when a parent is supplied (that option is world-space)', async () => {
        route({ ...base(), 'set-property': () => ({}), 'query-node': () => ({ position: { value: { x: 10, y: 0, z: 0 } } }) });

        const result = await tool.execute('instantiate', {
            prefabUuid: PREFAB_UUID, parentUuid: 'offset-parent', position: { x: 10, y: 0, z: 0 }
        });

        expect(result.success).toBe(true);
        const createCall = mockRequest.mock.calls.find((c: any[]) => c[1] === 'create-node');
        expect(createCall?.[2].parent).toBe('offset-parent');
        expect(createCall?.[2]).not.toHaveProperty('position');
    });

    it('applies the position as a local-position set-property on the new node', async () => {
        route({ ...base(), 'set-property': () => ({}), 'query-node': () => ({ position: { value: { x: 10, y: 0, z: 0 } } }) });

        await tool.execute('instantiate', {
            prefabUuid: PREFAB_UUID, parentUuid: 'offset-parent', position: { x: 10, y: 0, z: 0 }
        });

        expect(mockRequest).toHaveBeenCalledWith('scene', 'set-property', expect.objectContaining({
            uuid: 'new-node-uuid',
            path: 'position',
            dump: expect.objectContaining({ value: { x: 10, y: 0, z: 0 } })
        }));
    });

    it('fails loudly when the local position cannot be applied, naming the created node', async () => {
        route({
            ...base(),
            'set-property': () => { throw new Error('set-property rejected'); },
        });

        const result = await tool.execute('instantiate', {
            prefabUuid: PREFAB_UUID, parentUuid: 'offset-parent', position: { x: 10, y: 0, z: 0 }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/position/i);
        expect(result.error).toMatch(/new-node-uuid/);
    });

    it('fails when the read-back shows the position was not applied locally', async () => {
        route({
            ...base(),
            'set-property': () => ({}),
            // The node reads back at the origin: the write did not take.
            'query-node': () => ({ position: { value: { x: 0, y: 0, z: 0 } } }),
        });

        const result = await tool.execute('instantiate', {
            prefabUuid: PREFAB_UUID, parentUuid: 'offset-parent', position: { x: 10, y: 0, z: 0 }
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/position/i);
    });

    it('keeps the create-node position when parented on the scene root (world == local there)', async () => {
        route({ ...base(), 'set-property': () => ({}) });

        const result = await tool.execute('instantiate', { prefabUuid: PREFAB_UUID, position: { x: 1, y: 2, z: 3 } });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.objectContaining({
            parent: 'scene-root-uuid', position: { x: 1, y: 2, z: 3 }
        }));
    });

    it('documents the local-space semantics in the position schema', () => {
        const desc = (tool.inputSchema.properties as any).position.description as string;
        expect(desc).toMatch(/local/i);
    });
});
