import { ManageCamera } from '../tools/manage-camera';

describe('ManageCamera', () => {
    let tool: ManageCamera;

    beforeEach(() => {
        tool = new ManageCamera();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_camera');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['get_info', 'set_property', 'set_clear_flags', 'set_projection', 'set_viewport', 'list']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['get_info', 'set_property', 'set_clear_flags', 'set_projection', 'set_viewport', 'list']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Get info action tests
    it('get_info returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('get_info', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('get_info calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const cameraData = { fov: 45, near: 0.1, far: 1000, projection: 'PERSPECTIVE' };
        mockRequest.mockResolvedValueOnce({ success: true, data: cameraData });

        const result = await tool.execute('get_info', { nodeUuid: 'camera-123' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(cameraData);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'getCameraInfo',
            args: ['camera-123']
        }));
    });

    // Set property action tests
    it('set_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_property', { property: 'fov', value: 60 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_property returns error when property is missing', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'camera-123', value: 60 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property/i);
    });

    it('set_property returns error when value is undefined', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'camera-123', property: 'fov' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/value/i);
    });

    it('set_property calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_property', {
            nodeUuid: 'camera-123',
            property: 'fov',
            value: 60
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setCameraProperty',
            args: ['camera-123', 'fov', 60]
        }));
    });

    // Set clear flags action tests
    it('set_clear_flags returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_clear_flags', { clearFlags: 'SOLID_COLOR' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_clear_flags returns error when clearFlags is missing', async () => {
        const result = await tool.execute('set_clear_flags', { nodeUuid: 'camera-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/clearFlags/i);
    });

    it('set_clear_flags calls Editor.Message.request with setCameraProperty', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_clear_flags', {
            nodeUuid: 'camera-123',
            clearFlags: 'SKYBOX'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setCameraProperty',
            args: ['camera-123', 'clearFlags', 'SKYBOX']
        }));
    });

    // Set projection action tests
    it('set_projection returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_projection', { projection: 'ORTHO' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_projection returns error when projection is missing', async () => {
        const result = await tool.execute('set_projection', { nodeUuid: 'camera-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/projection/i);
    });

    it('set_projection calls Editor.Message.request with setCameraProperty', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_projection', {
            nodeUuid: 'camera-123',
            projection: 'ORTHO'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setCameraProperty',
            args: ['camera-123', 'projection', 'ORTHO']
        }));
    });

    // Set viewport action tests
    it('set_viewport returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_viewport', { x: 0, y: 0, width: 0.5, height: 0.5 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_viewport calls Editor.Message.request with setCameraProperty', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_viewport', {
            nodeUuid: 'camera-123',
            x: 0.25,
            y: 0.25,
            width: 0.5,
            height: 0.5
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setCameraProperty',
            args: ['camera-123', 'viewport', { x: 0.25, y: 0.25, width: 0.5, height: 0.5 }]
        }));
    });

    // List cameras action tests
    it('list calls Editor.Message.request without nodeUuid', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const cameras = [{ nodeUuid: 'camera-1', projection: 'PERSPECTIVE' }];
        mockRequest.mockResolvedValueOnce({ success: true, data: cameras });

        const result = await tool.execute('list', {});

        expect(result.success).toBe(true);
        expect(result.data).toEqual(cameras);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'listCameras',
            args: []
        }));
    });
});
