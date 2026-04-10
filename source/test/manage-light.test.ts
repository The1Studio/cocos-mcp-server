import { ManageLight } from '../tools/manage-light';

describe('ManageLight', () => {
    let tool: ManageLight;

    beforeEach(() => {
        tool = new ManageLight();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_light');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['add', 'set_property', 'get_info', 'list', 'remove']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['add', 'set_property', 'get_info', 'list', 'remove']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Add light action tests
    it('add returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add', { type: 'directional' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('add returns error when type is missing', async () => {
        const result = await tool.execute('add', { nodeUuid: 'uuid-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/type/i);
    });

    it('add calls Editor.Message.request with correct parameters', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { componentUuid: 'light-uuid-1' } });

        const result = await tool.execute('add', {
            nodeUuid: 'node-123',
            type: 'directional',
            color: '#FFFFFF',
            intensity: 1.0
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ componentUuid: 'light-uuid-1' });
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            name: 'cocos-mcp-server',
            method: 'addLightComponent',
            args: ['node-123', 'directional', '#FFFFFF', 1.0]
        }));
    });

    it('add returns error when scene call fails', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: false, error: 'Node not found' });

        const result = await tool.execute('add', {
            nodeUuid: 'node-123',
            type: 'sphere'
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Node not found/);
    });

    // Set property action tests
    it('set_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_property', { property: 'intensity', value: 2.0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_property returns error when property is missing', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'node-123', value: 2.0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property/i);
    });

    it('set_property returns error when value is undefined', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'node-123', property: 'intensity' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/value/i);
    });

    it('set_property calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_property', {
            nodeUuid: 'node-123',
            property: 'intensity',
            value: 2.5
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setLightProperty',
            args: ['node-123', 'intensity', 2.5]
        }));
    });

    // Get info action tests
    it('get_info returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('get_info', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('get_info calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const lightData = { type: 'directional', intensity: 1.0, color: '#FFFFFF' };
        mockRequest.mockResolvedValueOnce({ success: true, data: lightData });

        const result = await tool.execute('get_info', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(lightData);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'getLightInfo',
            args: ['node-123']
        }));
    });

    // List lights action tests
    it('list calls Editor.Message.request without nodeUuid', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const lights = [{ nodeUuid: 'node-1', type: 'directional' }, { nodeUuid: 'node-2', type: 'spot' }];
        mockRequest.mockResolvedValueOnce({ success: true, data: lights });

        const result = await tool.execute('list', {});

        expect(result.success).toBe(true);
        expect(result.data).toEqual(lights);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'listLights',
            args: []
        }));
    });

    // Remove light action tests
    it('remove returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('remove', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('remove calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('remove', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'removeLightComponent',
            args: ['node-123']
        }));
    });
});
