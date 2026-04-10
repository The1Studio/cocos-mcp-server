import { ManageTilemap } from '../tools/manage-tilemap';

describe('ManageTilemap', () => {
    let tool: ManageTilemap;

    beforeEach(() => {
        tool = new ManageTilemap();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_tilemap');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_info', 'list', 'get_layer_info', 'set_tile', 'get_tile', 'get_tileset_info']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
            expect(tool.inputSchema.required).toContain('action');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('nonexistent', {});
            expect(result.success).toBe(false);
        });

        it('returns error for missing action', async () => {
            const result = await tool.execute('', {});
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
            mockRequest.mockResolvedValueOnce({ success: true, data: { tileMapName: 'TestTileMap' } });

            const result = await tool.execute('get_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                name: 'cocos-mcp-server',
                method: 'getTiledMapInfo'
            }));
        });

        it('returns error when scene request fails', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: false, error: 'Node not found' });

            const result = await tool.execute('get_info', { nodeUuid: 'uuid-999' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Node not found/);
        });
    });

    describe('list action', () => {
        it('calls Editor.Message.request without params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: [] });

            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'listTiledMaps'
            }));
        });
    });

    describe('get_layer_info action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_layer_info', { layerName: 'Layer1' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when layerName is missing', async () => {
            const result = await tool.execute('get_layer_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/layerName is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { tileCount: 100 } });

            const result = await tool.execute('get_layer_info', { nodeUuid: 'uuid-123', layerName: 'Layer1' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getTiledLayerInfo',
                args: ['uuid-123', 'Layer1']
            }));
        });
    });

    describe('set_tile action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_tile', { layerName: 'Layer1', x: 0, y: 0, gid: 1 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when layerName is missing', async () => {
            const result = await tool.execute('set_tile', { nodeUuid: 'uuid-123', x: 0, y: 0, gid: 1 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/layerName is required/i);
        });

        it('returns error when x is missing', async () => {
            const result = await tool.execute('set_tile', { nodeUuid: 'uuid-123', layerName: 'Layer1', y: 0, gid: 1 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/x is required/i);
        });

        it('returns error when y is missing', async () => {
            const result = await tool.execute('set_tile', { nodeUuid: 'uuid-123', layerName: 'Layer1', x: 0, gid: 1 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/y is required/i);
        });

        it('returns error when gid is missing', async () => {
            const result = await tool.execute('set_tile', { nodeUuid: 'uuid-123', layerName: 'Layer1', x: 0, y: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/gid is required/i);
        });

        it('calls Editor.Message.request with all tile params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_tile', {
                nodeUuid: 'uuid-123',
                layerName: 'Layer1',
                x: 5,
                y: 10,
                gid: 42
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setTile',
                args: ['uuid-123', 'Layer1', 5, 10, 42]
            }));
        });
    });

    describe('get_tile action', () => {
        it('returns error when x is missing', async () => {
            const result = await tool.execute('get_tile', { nodeUuid: 'uuid-123', layerName: 'Layer1', y: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/x is required/i);
        });

        it('returns error when y is missing', async () => {
            const result = await tool.execute('get_tile', { nodeUuid: 'uuid-123', layerName: 'Layer1', x: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/y is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { gid: 42 } });

            const result = await tool.execute('get_tile', {
                nodeUuid: 'uuid-123',
                layerName: 'Layer1',
                x: 5,
                y: 10
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getTile',
                args: ['uuid-123', 'Layer1', 5, 10]
            }));
        });
    });

    describe('get_tileset_info action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_tileset_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { tileWidth: 32, tileHeight: 32 } });

            const result = await tool.execute('get_tileset_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getTilesetInfo',
                args: ['uuid-123']
            }));
        });
    });
});
