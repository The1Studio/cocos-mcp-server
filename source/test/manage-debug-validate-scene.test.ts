import { ManageDebug } from '../tools/manage-debug';

/**
 * #23 — `manage_debug.validate_scene` always requested
 * `Editor.Message.request('scene', 'check-missing-assets')`. Cocos Creator 3.8.7 does
 * not register that message, so the request rejected with
 * `scene - check-missing-assets does not exist` and the whole action returned an error
 * instead of a validation result.
 */
describe('ManageDebug.validate_scene (#23)', () => {
    let tool: ManageDebug;
    let mockRequest: jest.Mock;

    const SCENE_TREE = {
        uuid: 'root-1',
        name: 'Canvas',
        children: [
            { uuid: 'node-a', name: 'Background', children: [] },
            { uuid: 'node-b', name: 'Logo', children: [{ uuid: 'node-c', name: 'Shadow', children: [] }] },
        ],
    };

    /** A node dump whose Sprite points at a spriteFrame and whose target is a scene node. */
    function spriteNode(name: string, spriteFrameUuid: string | null) {
        return {
            uuid: 'x', name,
            __comps__: [{
                __type__: 'cc.Sprite', type: 'cc.Sprite', enabled: true,
                value: {
                    uuid: { value: 'sprite-comp-uuid' },
                    _spriteFrame: spriteFrameUuid
                        ? { name: 'spriteFrame', type: 'cc.SpriteFrame', value: { uuid: spriteFrameUuid } }
                        : { name: 'spriteFrame', type: 'cc.SpriteFrame', value: null },
                    // A scene-local node reference — must NOT be resolved against the asset DB.
                    _target: { name: 'target', type: 'cc.Node', value: { uuid: 'node-b' } },
                },
            }],
        };
    }

    /**
     * Routes by message name. `check-missing-assets` is deliberately absent, mirroring
     * 3.8.7 — an unregistered message rejects rather than resolving.
     */
    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    beforeEach(() => {
        tool = new ManageDebug();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('returns a structured result on 3.8.7, where check-missing-assets does not exist', async () => {
        routeMessages({
            'query-node-tree': () => SCENE_TREE,
            'query-node': () => spriteNode('Background', 'good-sprite-uuid'),
            'query-asset-info': () => ({ uuid: 'good-sprite-uuid', url: 'db://assets/bg.png' }),
        });

        const result = await tool.execute('validate_scene', { checkMissingAssets: true, checkPerformance: false });

        expect(result.success).toBe(true);
        expect(result.data.valid).toBe(true);
        expect(result.data.issueCount).toBe(0);
        expect(result.data.checks.missingAssets).toBe('fallback-scan');
    });

    it('reports the unresolvable asset uuid and the components referencing it', async () => {
        routeMessages({
            'query-node-tree': () => SCENE_TREE,
            'query-node': () => spriteNode('Background', 'dangling-uuid'),
            'query-asset-info': (uuid: string) => (uuid === 'dangling-uuid' ? null : { uuid }),
        });

        const result = await tool.execute('validate_scene', { checkMissingAssets: true, checkPerformance: false });

        expect(result.success).toBe(true);
        expect(result.data.valid).toBe(false);
        expect(result.data.issues).toHaveLength(1);
        expect(result.data.issues[0].category).toBe('assets');
        expect(result.data.issues[0].type).toBe('error');
        expect(result.data.issues[0].details[0].uuid).toBe('dangling-uuid');
        expect(result.data.issues[0].details[0].referencedBy[0]).toContain('cc.Sprite');
    });

    it('does not treat scene node references as missing assets', async () => {
        const queriedUuids: string[] = [];
        routeMessages({
            'query-node-tree': () => SCENE_TREE,
            'query-node': () => spriteNode('Background', 'good-sprite-uuid'),
            'query-asset-info': (uuid: string) => { queriedUuids.push(uuid); return { uuid }; },
        });

        await tool.execute('validate_scene', { checkMissingAssets: true, checkPerformance: false });

        // `node-b` is a cc.Node reference; resolving it against the asset DB would report
        // a false missing asset.
        expect(queriedUuids).not.toContain('node-b');
        expect(queriedUuids).toContain('good-sprite-uuid');
    });

    it('prefers the native check when the editor does register it', async () => {
        routeMessages({
            'check-missing-assets': () => ({ missing: [{ uuid: 'a' }, { uuid: 'b' }] }),
            'query-node-tree': () => SCENE_TREE,
        });

        const result = await tool.execute('validate_scene', { checkMissingAssets: true, checkPerformance: false });

        expect(result.success).toBe(true);
        expect(result.data.checks.missingAssets).toBe('native');
        expect(result.data.issues[0].message).toMatch(/2 missing asset references/);
    });

    it('keeps the performance check alive when the asset scan cannot run', async () => {
        const manyNodes = { uuid: 'root', name: 'Root', children: Array.from({ length: 1200 }, (_, i) => ({ uuid: `n${i}`, name: `N${i}`, children: [] })) };
        routeMessages({
            'query-node-tree': () => manyNodes,
            'query-node': () => { throw new Error('scene - query-node does not exist'); },
        });

        const result = await tool.execute('validate_scene', { checkMissingAssets: true, checkPerformance: true });

        expect(result.success).toBe(true);
        const perf = result.data.issues.find((i: any) => i.category === 'performance');
        expect(perf).toBeDefined();
        expect(perf.message).toMatch(/High node count: 1201/);
    });

    it('reports an unsupported check rather than failing the whole action', async () => {
        routeMessages({});  // nothing is registered

        const result = await tool.execute('validate_scene', { checkMissingAssets: true, checkPerformance: true });

        expect(result.success).toBe(true);
        expect(result.data.checks.missingAssets).toMatch(/^unsupported:/);
        expect(result.data.checks.performance).toMatch(/^unsupported:/);
        expect(result.data.issueCount).toBe(0);
    });

    it('a performance warning alone does not mark the scene invalid', async () => {
        const manyNodes = { uuid: 'root', name: 'Root', children: Array.from({ length: 1200 }, (_, i) => ({ uuid: `n${i}`, name: `N${i}`, children: [] })) };
        routeMessages({
            'query-node-tree': () => manyNodes,
        });

        const result = await tool.execute('validate_scene', { checkMissingAssets: false, checkPerformance: true });

        expect(result.success).toBe(true);
        expect(result.data.valid).toBe(true);
        expect(result.data.issues[0].type).toBe('warning');
    });
});
