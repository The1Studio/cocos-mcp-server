import { ManageNodeHierarchy } from '../tools/manage-node-hierarchy';

describe('ManageNodeHierarchy', () => {
    let tool: ManageNodeHierarchy;

    beforeEach(() => {
        tool = new ManageNodeHierarchy();
        jest.clearAllMocks();
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_node_hierarchy');
        });
    });

    describe('remove_array_element action (#84 — discarded boolean result)', () => {
        const UUID = 'node-uuid-1234';
        const PATH = '__comps__';

        it('reports failure when the editor resolves false (#84)', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(false);

            const result = await tool.execute('remove_array_element', { uuid: UUID, path: PATH, index: 0 });

            expect(mockRequest).toHaveBeenCalledWith('scene', 'remove-array-element', { uuid: UUID, path: PATH, index: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/rejected remove-array-element/i);
        });

        it('reports success when the editor resolves true', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(true);

            const result = await tool.execute('remove_array_element', { uuid: UUID, path: PATH, index: 0 });

            expect(result.success).toBe(true);
        });

        it('rejects a missing index before dispatching to the editor', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;

            const result = await tool.execute('remove_array_element', { uuid: UUID, path: PATH });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/index/i);
            expect(mockRequest).not.toHaveBeenCalled();
        });

        it('rejects a non-numeric index before dispatching to the editor', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;

            const result = await tool.execute('remove_array_element', { uuid: UUID, path: PATH, index: 'not-a-number' });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/index/i);
            expect(mockRequest).not.toHaveBeenCalled();
        });
    });

    describe('move_array_element action (#84 — discarded boolean result)', () => {
        const UUID = 'node-uuid-1234';
        const PATH = '__comps__';

        it('reports failure when the editor resolves false (#84)', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(false);

            const result = await tool.execute('move_array_element', { uuid: UUID, path: PATH, target: 0, offset: 1 });

            expect(mockRequest).toHaveBeenCalledWith('scene', 'move-array-element', { uuid: UUID, path: PATH, target: 0, offset: 1 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/rejected move-array-element/i);
        });

        it('reports success when the editor resolves true', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(true);

            const result = await tool.execute('move_array_element', { uuid: UUID, path: PATH, target: 0, offset: 1 });

            expect(result.success).toBe(true);
        });
    });

    describe('reset_property action (#84 — discarded boolean result)', () => {
        const UUID = 'node-uuid-1234';
        const PATH = 'position';

        it('reports failure when the editor resolves false (#84)', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(false);

            const result = await tool.execute('reset_property', { uuid: UUID, path: PATH });

            expect(mockRequest).toHaveBeenCalledWith('scene', 'reset-property', { uuid: UUID, path: PATH, dump: { value: null } });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/rejected reset-property/i);
        });

        it('reports success when the editor resolves true', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(true);

            const result = await tool.execute('reset_property', { uuid: UUID, path: PATH });

            expect(result.success).toBe(true);
        });
    });

    describe('paste / copy / cut uuids guard (#149)', () => {
        const getRequest = () => (global as any).Editor.Message.request as jest.Mock;

        it.each([
            ['absent', {}],
            ['empty array', { uuids: [] }],
            ['empty string', { uuids: '' }],
        ])('paste rejects %s uuids without dispatching to the editor', async (_label, extra) => {
            const result = await tool.execute('paste', { target: 'parent-uuid', ...extra });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/uuids/i);
            expect(getRequest()).not.toHaveBeenCalled();
        });

        it.each(['copy', 'cut'])('%s rejects absent uuids without dispatching to the editor', async (action) => {
            const result = await tool.execute(action, {});

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/uuids/i);
            expect(getRequest()).not.toHaveBeenCalled();
        });

        it('paste forwards a string target and the normalized uuids', async () => {
            getRequest().mockImplementation(async (_mod: string, msg: string) =>
                msg === 'paste-node' ? ['new-1'] : { uuid: 'new-1' });

            const result = await tool.execute('paste', { target: 'parent-uuid', uuids: 'src-1' });

            expect(getRequest()).toHaveBeenCalledWith('scene', 'paste-node', {
                target: 'parent-uuid', uuids: ['src-1'], keepWorldTransform: false,
            });
            expect(result.success).toBe(true);
            expect((result.data as any).newUuids).toEqual(['new-1']);
        });

        it('paste reports failure when the editor creates no nodes', async () => {
            getRequest().mockResolvedValue([]);

            const result = await tool.execute('paste', { target: 'p', uuids: ['src-1'] });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/no nodes/i);
        });

        it('paste reports failure when a returned uuid does not resolve to a node', async () => {
            getRequest().mockImplementation(async (_mod: string, msg: string) =>
                msg === 'paste-node' ? ['ghost-1'] : null);

            const result = await tool.execute('paste', { target: 'p', uuids: ['src-1'] });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/ghost-1/);
        });

        it('declares target as a string-or-number schema (parent UUID for paste)', () => {
            const types = ((tool.inputSchema.properties as any).target.oneOf as any[]).map((t) => t.type);
            expect(types).toEqual(expect.arrayContaining(['string', 'number']));
        });
    });

    describe('error propagation (unchanged behavior)', () => {
        it('still returns an error when the editor throws', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('boom'));

            const result = await tool.execute('reset_property', { uuid: 'x', path: 'y' });

            expect(result.success).toBe(false);
            expect(result.error).toBe('boom');
        });
    });
});
