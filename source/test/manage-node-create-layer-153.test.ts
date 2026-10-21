import { ManageNode } from '../tools/manage-node';

/**
 * Issue #153 — `manage_node create` always left the new node on the DEFAULT layer and gave the
 * caller no way to choose another, so a UI node under a UI camera was culled until its layer was
 * fixed by hand. `create` now takes `layer`, applies it through the verified node write, and
 * reports whether it took effect.
 */
describe('ManageNode.create layer (#153)', () => {
    const UI_2D = 33554432;
    const DEFAULT = 1073741824;
    let tool: ManageNode;
    let mockRequest: jest.Mock;
    let layerNow: number;
    let setPropertyCalls: any[];

    beforeEach(() => {
        tool = new ManageNode();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        layerNow = DEFAULT;
        setPropertyCalls = [];
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    function routeCreate(opts: { honourLayerWrite: boolean }) {
        mockRequest.mockImplementation(async (_pkg: string, message: string, payload: any) => {
            switch (message) {
                case 'create-node':
                    return 'node-uuid-1';
                case 'query-node':
                    return { uuid: { value: 'node-uuid-1' }, name: { value: 'X' }, layer: { value: layerNow }, __comps__: [] };
                case 'set-property':
                    setPropertyCalls.push(payload);
                    if (payload.path === 'layer' && opts.honourLayerWrite) layerNow = payload.dump.value;
                    return true;
                default:
                    return {};
            }
        });
    }

    it('applies the requested layer after creation and reports it applied', async () => {
        routeCreate({ honourLayerWrite: true });

        const result = await tool.execute('create', { name: 'X', parentUuid: 'p', layer: UI_2D });

        expect(result.success).toBe(true);
        expect(setPropertyCalls).toEqual([{ uuid: 'node-uuid-1', path: 'layer', dump: { value: UI_2D } }]);
        expect(result.data.layer).toEqual({ requested: UI_2D, applied: true });
        expect(result.data.layerWarning).toBeUndefined();
        expect(layerNow).toBe(UI_2D);
    });

    it('accepts a stringified layer from a transport that stringifies arguments', async () => {
        routeCreate({ honourLayerWrite: true });

        const result = await tool.execute('create', { name: 'X', parentUuid: 'p', layer: String(UI_2D) });

        expect(result.data.layer).toEqual({ requested: UI_2D, applied: true });
    });

    it('does not touch the layer when none is requested', async () => {
        routeCreate({ honourLayerWrite: true });

        const result = await tool.execute('create', { name: 'X', parentUuid: 'p' });

        expect(result.success).toBe(true);
        expect(setPropertyCalls).toEqual([]);
        expect(result.data.layer).toBeUndefined();
    });

    it('reports a layer write the editor ignored instead of claiming success', async () => {
        routeCreate({ honourLayerWrite: false });

        const result = await tool.execute('create', { name: 'X', parentUuid: 'p', layer: UI_2D });

        expect(result.success).toBe(true); // the node exists
        expect(result.data.layer.applied).toBe(false);
        expect(result.data.layerWarning).toMatch(/NOT applied/);
    });

    it('rejects a non-numeric layer before creating any node', async () => {
        routeCreate({ honourLayerWrite: true });

        const result = await tool.execute('create', { name: 'X', parentUuid: 'p', layer: 'UI_2D' });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/layer must be an integer/);
        expect(mockRequest.mock.calls.some(c => c[1] === 'create-node')).toBe(false);
    });
});
