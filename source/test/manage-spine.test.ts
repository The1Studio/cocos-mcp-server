import { ManageSpine } from '../tools/manage-spine';

describe('ManageSpine', () => {
    let tool: ManageSpine;

    beforeEach(() => {
        tool = new ManageSpine();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_spine');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_info', 'set_animation', 'set_skin', 'set_property', 'list', 'add_to_node']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_action', {});
            expect(result.success).toBe(false);
        });
    });

    describe('get_info action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { skeletonName: 'Hero' } });

            const result = await tool.execute('get_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getSpineInfo'
            }));
        });
    });

    describe('set_animation action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_animation', { animationName: 'walk' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when animationName is missing', async () => {
            const result = await tool.execute('set_animation', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/animationName is required/i);
        });

        it('calls Editor.Message.request with default loop=true and trackIndex=0', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_animation', { nodeUuid: 'uuid-123', animationName: 'walk' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setSpineAnimation',
                args: ['uuid-123', 'walk', true, 0]
            }));
        });

        it('calls Editor.Message.request with custom loop and trackIndex', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_animation', {
                nodeUuid: 'uuid-123',
                animationName: 'attack',
                loop: false,
                trackIndex: 1
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', 'attack', false, 1]
            }));
        });
    });

    describe('set_skin action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_skin', { skinName: 'skin1' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when skinName is missing', async () => {
            const result = await tool.execute('set_skin', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/skinName is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_skin', { nodeUuid: 'uuid-123', skinName: 'gold' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setSpineSkin',
                args: ['uuid-123', 'gold']
            }));
        });
    });

    describe('set_property action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_property', { property: 'timeScale', value: 1.5 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when property is missing', async () => {
            const result = await tool.execute('set_property', { nodeUuid: 'uuid-123', value: 1.5 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/property is required/i);
        });

        it('returns error when value is missing', async () => {
            const result = await tool.execute('set_property', { nodeUuid: 'uuid-123', property: 'timeScale' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/value is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                property: 'timeScale',
                value: 2.0
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setSpineProperty',
                args: ['uuid-123', 'timeScale', 2.0]
            }));
        });
    });

    describe('list action', () => {
        it('calls Editor.Message.request without params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: [] });

            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'listSpineNodes'
            }));
        });
    });

    describe('add_to_node action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('add_to_node', { skeletonDataUuid: 'uuid-456' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when skeletonDataUuid is missing', async () => {
            const result = await tool.execute('add_to_node', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/skeletonDataUuid is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('add_to_node', {
                nodeUuid: 'uuid-123',
                skeletonDataUuid: 'uuid-456'
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'addSpineToNode',
                args: ['uuid-123', 'uuid-456']
            }));
        });
    });
});
