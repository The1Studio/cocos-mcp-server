import { ManageTween } from '../tools/manage-tween';

describe('ManageTween', () => {
    let tool: ManageTween;

    beforeEach(() => {
        tool = new ManageTween();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_tween');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['create', 'add_to', 'add_by', 'add_delay', 'stop_all', 'get_info']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['create', 'add_to', 'add_by', 'add_delay', 'stop_all', 'get_info']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Create action tests
    it('create returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('create', { steps: [{ type: 'to', duration: 1 }] });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('create returns error when steps is missing', async () => {
        const result = await tool.execute('create', { nodeUuid: 'node-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/steps.*required/i);
    });

    it('create returns error when steps is not an array', async () => {
        const result = await tool.execute('create', {
            nodeUuid: 'node-123',
            steps: 'not-an-array'
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/steps.*required/i);
    });

    it('create returns error when steps array is empty', async () => {
        const result = await tool.execute('create', {
            nodeUuid: 'node-123',
            steps: []
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/steps.*required/i);
    });

    it('create calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { tweenId: 'tween-1' } });

        const steps = [
            { type: 'to', duration: 1, properties: { position: { x: 10, y: 20 } } },
            { type: 'delay', duration: 0.5 },
            { type: 'to', duration: 1, properties: { position: { x: 0, y: 0 } }, easing: 'easeInOut' }
        ];

        const result = await tool.execute('create', {
            nodeUuid: 'node-123',
            steps: steps
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ tweenId: 'tween-1' });
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'createTween',
            args: ['node-123', steps]
        }));
    });

    it('create returns error when scene call fails', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: false, error: 'Node not found' });

        const result = await tool.execute('create', {
            nodeUuid: 'invalid-node',
            steps: [{ type: 'to', duration: 1 }]
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Node not found/);
    });

    // Add to action tests
    it('add_to returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add_to', {
            properties: { position: { x: 10 } },
            duration: 1
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('add_to returns error when properties is missing', async () => {
        const result = await tool.execute('add_to', {
            nodeUuid: 'node-123',
            duration: 1
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/properties.*required/i);
    });

    it('add_to returns error when duration is missing', async () => {
        const result = await tool.execute('add_to', {
            nodeUuid: 'node-123',
            properties: { position: { x: 10 } }
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/duration.*required/i);
    });

    it('add_to calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: null });

        const result = await tool.execute('add_to', {
            nodeUuid: 'node-123',
            properties: { position: { x: 100, y: 50 }, opacity: 128 },
            duration: 2,
            easing: 'cubicInOut'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'addTweenTo'
        }));
    });

    // Add by action tests
    it('add_by returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add_by', {
            properties: { position: { x: 5 } },
            duration: 0.5
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('add_by returns error when properties is missing', async () => {
        const result = await tool.execute('add_by', {
            nodeUuid: 'node-123',
            duration: 0.5
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/properties.*required/i);
    });

    it('add_by returns error when duration is missing', async () => {
        const result = await tool.execute('add_by', {
            nodeUuid: 'node-123',
            properties: { position: { x: 5 } }
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/duration.*required/i);
    });

    it('add_by calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: null });

        const result = await tool.execute('add_by', {
            nodeUuid: 'node-123',
            properties: { position: { x: 10, z: -5 }, rotation: { y: 45 } },
            duration: 1.5,
            easing: 'sineIn'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalled();
    });

    // Add delay action tests
    it('add_delay returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add_delay', { duration: 2 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('add_delay returns error when duration is missing', async () => {
        const result = await tool.execute('add_delay', { nodeUuid: 'node-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/duration.*required/i);
    });

    it('add_delay calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: null });

        const result = await tool.execute('add_delay', {
            nodeUuid: 'node-123',
            duration: 0.75
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'addTweenDelay'
        }));
    });

    // Stop all action tests
    it('stop_all returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('stop_all', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('stop_all calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: null });

        const result = await tool.execute('stop_all', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'stopTweens',
            args: ['node-123']
        }));
    });

    // Get info action tests
    it('get_info returns success with info message', async () => {
        const result = await tool.execute('get_info', {});

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect((result.data as any).note).toMatch(/runtime-only/i);
    });

    it('get_info does not call Editor.Message.request', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;

        await tool.execute('get_info', {});

        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('get_info returns helpful tip about tween system', async () => {
        const result = await tool.execute('get_info', {});

        expect(result.success).toBe(true);
        expect((result.data as any).tip).toBeDefined();
        expect((result.data as any).tip).toMatch(/create|add_to|add_by|stop_all/);
    });
});
