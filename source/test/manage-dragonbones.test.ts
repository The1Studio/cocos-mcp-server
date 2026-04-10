import { ManageDragonBones } from '../tools/manage-dragonbones';

describe('ManageDragonBones', () => {
    let tool: ManageDragonBones;

    beforeEach(() => {
        tool = new ManageDragonBones();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_dragonbones');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_info', 'set_animation', 'set_armature', 'set_property', 'list', 'add_to_node']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('invalid_action', {});
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
            mockRequest.mockResolvedValueOnce({ success: true, data: { armatureName: 'Hero' } });

            const result = await tool.execute('get_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getDragonBonesInfo'
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

        it('calls Editor.Message.request with default playTimes=-1', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_animation', { nodeUuid: 'uuid-123', animationName: 'walk' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setDragonBonesAnimation',
                args: ['uuid-123', 'walk', -1]
            }));
        });

        it('calls Editor.Message.request with custom playTimes', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_animation', {
                nodeUuid: 'uuid-123',
                animationName: 'attack',
                playTimes: 1
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', 'attack', 1]
            }));
        });
    });

    describe('set_armature action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_armature', { armatureName: 'Armature1' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when armatureName is missing', async () => {
            const result = await tool.execute('set_armature', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/armatureName is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('set_armature', { nodeUuid: 'uuid-123', armatureName: 'MainArmature' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setDragonBonesArmature',
                args: ['uuid-123', 'MainArmature']
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
                value: 0.5
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setDragonBonesProperty',
                args: ['uuid-123', 'timeScale', 0.5]
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
                method: 'listDragonBonesNodes'
            }));
        });
    });

    describe('add_to_node action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('add_to_node', {
                dragonBonesAssetUuid: 'uuid-456',
                dragonBonesAtlasAssetUuid: 'uuid-789'
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when dragonBonesAssetUuid is missing', async () => {
            const result = await tool.execute('add_to_node', {
                nodeUuid: 'uuid-123',
                dragonBonesAtlasAssetUuid: 'uuid-789'
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/dragonBonesAssetUuid is required/i);
        });

        it('returns error when dragonBonesAtlasAssetUuid is missing', async () => {
            const result = await tool.execute('add_to_node', {
                nodeUuid: 'uuid-123',
                dragonBonesAssetUuid: 'uuid-456'
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/dragonBonesAtlasAssetUuid is required/i);
        });

        it('calls Editor.Message.request with correct params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: {} });

            const result = await tool.execute('add_to_node', {
                nodeUuid: 'uuid-123',
                dragonBonesAssetUuid: 'uuid-456',
                dragonBonesAtlasAssetUuid: 'uuid-789'
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'addDragonBonesToNode',
                args: ['uuid-123', 'uuid-456', 'uuid-789']
            }));
        });
    });
});
