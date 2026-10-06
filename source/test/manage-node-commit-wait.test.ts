import { ManageNode } from '../tools/manage-node';

/**
 * #6 — after `scene:create-node`, the follow-up set-parent / create-component /
 * initial-transform steps waited out a fixed 100-150ms sleep and then proceeded whether or
 * not the node had actually committed. On a slow editor it had not, and those edits were
 * silently dropped. The wait is now a poll of `scene:query-node`.
 */
describe('ManageNode.create commit wait (#6)', () => {
    let tool: ManageNode;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        tool = new ManageNode();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    /**
     * `queryNodeVisibleAfterMs` models the editor's commit latency: `query-node` returns
     * nothing until that much time has passed since create-node resolved.
     */
    function routeCreate(queryNodeVisibleAfterMs: number, log: string[]) {
        let createdAt = 0;
        mockRequest.mockImplementation(async (_pkg: string, message: string) => {
            log.push(message);
            switch (message) {
                case 'create-node':
                    createdAt = Date.now();
                    return 'node-uuid-1';
                case 'query-node':
                    if (Date.now() - createdAt < queryNodeVisibleAfterMs) return null;
                    return { uuid: { value: 'node-uuid-1' }, name: { value: 'X' }, __comps__: [] };
                default:
                    return {};
            }
        });
    }

    it('adds components only after the node is actually queryable', async () => {
        const log: string[] = [];
        routeCreate(120, log);

        const result = await tool.execute('create', { name: 'X', components: ['cc.Sprite'] });

        expect(result.success).toBe(true);
        // The component was created, and only after query-node first succeeded.
        const firstSuccessfulQuery = log.indexOf('query-node');
        expect(log.indexOf('create-component')).toBeGreaterThan(firstSuccessfulQuery);
        // Polling means more than one query-node round trip while the editor was catching up.
        expect(log.filter(m => m === 'query-node').length).toBeGreaterThan(1);
    });

    it('does not silently proceed when the node never becomes queryable', async () => {
        const log: string[] = [];
        // Never visible within the 2000ms budget.
        routeCreate(60000, log);

        const result = await tool.execute('create', { name: 'X', components: ['cc.Sprite'] });

        // Create itself still reports (the node UUID exists); the dropped component is not
        // pretended into existence by a create-component fired at a node that is not there.
        expect(log).not.toContain('create-component');
    }, 20000);
});

/**
 * #136 — `create` passed `components` to `scene:create-node` AND re-added each one with
 * `scene:create-component`, so a component the editor had already attached (UITransform on a
 * UI-layer node) logged "already contains UITransform".
 */
describe('ManageNode.create does not duplicate-add components (#136)', () => {
    let tool: ManageNode;
    let mockRequest: jest.Mock;
    let added: string[];

    beforeEach(() => {
        tool = new ManageNode();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        added = [];
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    function route(comps: any[]) {
        mockRequest.mockImplementation(async (_pkg: string, message: string, ...args: any[]) => {
            switch (message) {
                case 'create-node': return 'node-uuid-1';
                case 'query-node': return { uuid: { value: 'node-uuid-1' }, name: { value: 'X' }, __comps__: comps };
                case 'create-component': added.push(args[0].component); return {};
                default: return {};
            }
        });
    }

    it('skips a component the node already carries and adds the rest', async () => {
        route([{ type: 'cc.UITransform' }]);
        const result = await tool.execute('create', { name: 'X', components: ['cc.UITransform', 'cc.Sprite'] });
        expect(result.success).toBe(true);
        expect(added).toEqual(['cc.Sprite']);
    });

    it('still adds every component when none is present', async () => {
        route([]);
        await tool.execute('create', { name: 'X', components: ['cc.UITransform', 'cc.Sprite'] });
        expect(added).toEqual(['cc.UITransform', 'cc.Sprite']);
    });
});
