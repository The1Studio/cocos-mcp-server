import { ManagePrefab } from '../tools/manage-prefab';

/**
 * Regression tests for issue #120, items 1 and 3 — both in `manage_prefab`.
 *
 * Item 1 — `instantiate` with no `parentUuid` set `createNodeOptions.parent` only when a
 * parent was supplied, so the editor's own default-parent heuristic ran instead: three
 * back-to-back `instantiate` calls parented each new instance under the previous one
 * rather than under the scene root. That silent nesting is also what made item 2's
 * `update`-over-serialization reachable, so it is pinned here as its own defect.
 *
 * Item 3 — `load` called `scene:load-asset`, a message that does not exist in Cocos
 * Creator 3.8.7, so every `load` call rejected and the prefab-edit path through this tool
 * was unreachable.
 *
 * Both are pinned by what the tool SENDS: the editor call is the observable contract this
 * repo owns, and the assertion is on the message that must be produced.
 */

declare const global: any;

describe('ManagePrefab — instantiate parenting (#120 item 1)', () => {
    let tool: ManagePrefab;
    let mockRequest: jest.Mock;

    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    beforeEach(() => {
        tool = new ManagePrefab();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    /** The scene tree as `query-node-tree` returns it: the scene node, then its children. */
    function sceneTree() {
        return {
            uuid: 'scene-root-uuid', name: 'MainScene',
            children: [{ uuid: 'canvas-uuid', name: 'Canvas', children: [] }],
        };
    }

    function routerWithTree(created: any[], tree: any = sceneTree()) {
        return {
            'query-asset-info': () => ({ uuid: 'prefab-uuid-1', name: 'Door', type: 'prefab', url: 'db://assets/Door.prefab' }),
            'query-node-tree': () => tree,
            'create-node': (options: any) => { created.push(options); return ['new-node-uuid']; },
        };
    }

    it('parents an instance on the scene root when parentUuid is omitted', async () => {
        const created: any[] = [];
        routeMessages(routerWithTree(created));

        const result = await tool.execute('instantiate', { prefabUuid: 'prefab-uuid-1' });

        expect(result.success).toBe(true);
        // The defect: this was `undefined`, so `create-node` chose the parent itself.
        expect(created[0].parent).toBe('scene-root-uuid');
        // The parameter name is `parent`, not `parentUuid` — a rename here would be silently
        // ignored by the editor, which is exactly the class of bug this file keeps hitting.
        expect(created[0]).not.toHaveProperty('parentUuid');
    });

    it('keeps three back-to-back instances as siblings, all rooted at the scene', async () => {
        // The originating repro: three calls, no parentUuid, each previously nesting under
        // the last. Asserting the SAME parent for all three is what pins that.
        const created: any[] = [];
        routeMessages(routerWithTree(created));

        await tool.execute('instantiate', { prefabUuid: 'prefab-uuid-1' });
        await tool.execute('instantiate', { prefabUuid: 'prefab-uuid-1' });
        await tool.execute('instantiate', { prefabUuid: 'prefab-uuid-1' });

        expect(created.map(c => c.parent)).toEqual(['scene-root-uuid', 'scene-root-uuid', 'scene-root-uuid']);
    });

    it('does not override an explicit parentUuid', async () => {
        const created: any[] = [];
        routeMessages(routerWithTree(created));

        await tool.execute('instantiate', { prefabUuid: 'prefab-uuid-1', parentUuid: 'canvas-uuid' });

        expect(created[0].parent).toBe('canvas-uuid');
    });

    it('leaves the parent unset rather than guessing when the scene root cannot be read', async () => {
        // A failed lookup must degrade to the old behaviour, not invent a parent. This is
        // the one case where an absent `parent` is correct.
        const created: any[] = [];
        routeMessages({
            'query-asset-info': () => ({ uuid: 'prefab-uuid-1', name: 'Door', type: 'prefab', url: 'db://assets/Door.prefab' }),
            'query-node-tree': () => { throw new Error('scene not ready'); },
            'create-node': (options: any) => { created.push(options); return ['new-node-uuid']; },
        });

        const result = await tool.execute('instantiate', { prefabUuid: 'prefab-uuid-1' });

        expect(result.success).toBe(true);
        expect(created[0].parent).toBeUndefined();
    });
});

describe('ManagePrefab — load uses a message that exists (#120 item 3)', () => {
    let tool: ManagePrefab;
    let mockRequest: jest.Mock;

    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    beforeEach(() => {
        tool = new ManagePrefab();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('never calls scene:load-asset, which does not exist in 3.8.7', async () => {
        routeMessages({
            'query-asset-info': () => ({ uuid: 'prefab-uuid-1', name: 'Door', type: 'prefab', url: 'db://assets/Door.prefab' }),
            'open-asset': () => undefined,
        });

        await tool.execute('load', { uuid: 'prefab-uuid-1' });

        const messages = mockRequest.mock.calls.map((call: any[]) => `${call[0]}:${call[1]}`);
        expect(messages).not.toContain('scene:load-asset');
        expect(messages).toContain('asset-db:open-asset');
    });

    it('opens the resolved url, not the raw uuid', async () => {
        const opened: string[] = [];
        routeMessages({
            'query-asset-info': () => ({ uuid: 'prefab-uuid-1', name: 'Door', type: 'prefab', url: 'db://assets/ui/Door.prefab' }),
            'open-asset': (target: string) => { opened.push(target); return undefined; },
        });

        const result = await tool.execute('load', { uuid: 'prefab-uuid-1' });

        expect(result.success).toBe(true);
        expect(opened).toEqual(['db://assets/ui/Door.prefab']);
    });

    it('refuses a uuid that is not a prefab instead of opening it', async () => {
        routeMessages({
            'query-asset-info': () => ({ uuid: 'tex-uuid', name: 'Brick.png', type: 'texture', url: 'db://assets/Brick.png' }),
            'open-asset': () => { throw new Error('should not be called'); },
        });

        const result = await tool.execute('load', { uuid: 'tex-uuid' });

        expect(result.success).toBe(false);
        expect(String(result.error)).toMatch(/not a prefab/);
    });

    it('reports an unresolvable uuid as not found, not as a load failure', async () => {
        routeMessages({
            'query-asset-info': () => { throw new Error('asset not found'); },
        });

        const result = await tool.execute('load', { uuid: 'missing-uuid' });

        expect(result.success).toBe(false);
        expect(String(result.error)).toMatch(/not found in the asset DB/);
    });

    it('does not claim prefab-edit mode was verified — only that the open was accepted', async () => {
        // The editor's mode switch is editor-side state this repo cannot observe, so the
        // response must not present it as verified (see the #114-2 class of false greens).
        routeMessages({
            'query-asset-info': () => ({ uuid: 'prefab-uuid-1', name: 'Door', type: 'prefab', url: 'db://assets/Door.prefab' }),
            'open-asset': () => undefined,
        });

        const result = await tool.execute('load', { uuid: 'prefab-uuid-1' });

        expect(result.success).toBe(true);
        expect((result.data as any).prefabEditModeVerified).toBe(false);
    });
});
