import { ManageTerrain } from '../tools/manage-terrain';

describe('ManageTerrain', () => {
    let tool: ManageTerrain;

    beforeEach(() => {
        tool = new ManageTerrain();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_terrain');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_info', 'set_property', 'get_layer_info', 'set_layer', 'get_height', 'set_height', 'list']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_terrain_action', {});
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
            mockRequest.mockResolvedValueOnce({ success: true, data: { size: 256 } });

            const result = await tool.execute('get_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getTerrainInfo'
            }));
        });
    });

    describe('set_property action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_property', { property: 'tileSize', value: 32 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when property is missing', async () => {
            const result = await tool.execute('set_property', { nodeUuid: 'uuid-123', value: 32 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/property is required/i);
        });

        it('returns error when value is missing', async () => {
            const result = await tool.execute('set_property', { nodeUuid: 'uuid-123', property: 'tileSize' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/value is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                property: 'tileSize',
                value: 64
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setTerrainProperty',
                args: ['uuid-123', 'tileSize', 64]
            }));
        });
    });

    describe('get_layer_info action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_layer_info', { layerIndex: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when layerIndex is missing', async () => {
            const result = await tool.execute('get_layer_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/layerIndex is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { layerName: 'Grass' } });

            const result = await tool.execute('get_layer_info', { nodeUuid: 'uuid-123', layerIndex: 0 });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getTerrainLayerInfo',
                args: ['uuid-123', 0]
            }));
        });
    });

    describe('set_layer action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_layer', {
                layerIndex: 0,
                detailMapUuid: 'uuid-456',
                tileSize: 32
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when layerIndex is missing', async () => {
            const result = await tool.execute('set_layer', {
                nodeUuid: 'uuid-123',
                detailMapUuid: 'uuid-456',
                tileSize: 32
            });
            expect(result.success).toBe(false);
        });

        it('calls Editor.Message.request with valid params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_layer', {
                nodeUuid: 'uuid-123',
                layerIndex: 0,
                detailMapUuid: 'uuid-456',
                tileSize: 32
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setTerrainLayer'
            }));
        });
    });

    describe('get_height action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_height', { x: 10, y: 20 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when x is missing', async () => {
            const result = await tool.execute('get_height', { nodeUuid: 'uuid-123', y: 20 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/x is required/i);
        });

        it('returns error when y is missing', async () => {
            const result = await tool.execute('get_height', { nodeUuid: 'uuid-123', x: 10 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/y is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { height: 45.5 } });

            const result = await tool.execute('get_height', { nodeUuid: 'uuid-123', x: 10, y: 20 });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getTerrainHeight',
                args: ['uuid-123', 10, 20]
            }));
        });
    });

    describe('set_height action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_height', { x: 10, y: 20, height: 50 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when x is missing', async () => {
            const result = await tool.execute('set_height', { nodeUuid: 'uuid-123', y: 20, height: 50 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/x is required/i);
        });

        it('returns error when y is missing', async () => {
            const result = await tool.execute('set_height', { nodeUuid: 'uuid-123', x: 10, height: 50 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/y is required/i);
        });

        it('returns error when height is missing', async () => {
            const result = await tool.execute('set_height', { nodeUuid: 'uuid-123', x: 10, y: 20 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/height is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_height', {
                nodeUuid: 'uuid-123',
                x: 10,
                y: 20,
                height: 75.5
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setTerrainHeight',
                args: ['uuid-123', 10, 20, 75.5]
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
                method: 'listTerrainNodes'
            }));
        });
    });
});
