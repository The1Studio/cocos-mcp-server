import { ManageScene } from '../tools/manage-scene';

/**
 * #6 — `manage_scene action=save` reported `{"success":true,"message":"Scene saved
 * successfully"}` unconditionally: `scene:save-scene`'s boolean result was discarded,
 * there was no verification that pending edits were actually captured, and there was no
 * `.catch` for a rejected save.
 */
describe('ManageScene.save (#6)', () => {
    let tool: ManageScene;
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
        tool = new ManageScene();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('reports success only once the scene is verified not dirty', async () => {
        routeMessages({
            'save-scene': () => true,
            'query-dirty': () => false,
        });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
        expect(result.data.dirty).toBe(false);
    });

    it('fails when save-scene returns false — the old code discarded this result', async () => {
        routeMessages({ 'save-scene': () => false });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/returned false/i);
    });

    it('fails when the scene is still dirty immediately after a reported-successful save', async () => {
        routeMessages({
            'save-scene': () => true,
            'query-dirty': () => true,
        });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/still dirty/i);
        expect(result.error).toMatch(/sequentially/i);
    });

    it('propagates a rejected save-scene call instead of silently succeeding', async () => {
        routeMessages({
            'save-scene': () => { throw new Error('scene process crashed'); },
        });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/scene process crashed/i);
    });

    it('does not fail the save when the dirty check itself is unavailable', async () => {
        routeMessages({
            'save-scene': () => true,
            'query-dirty': () => { throw new Error('query-dirty does not exist'); },
        });

        const result = await tool.execute('save', {});

        expect(result.success).toBe(true);
    });
});
