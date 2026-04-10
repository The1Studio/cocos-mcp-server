import { ManageParticle } from '../tools/manage-particle';

describe('ManageParticle', () => {
    let tool: ManageParticle;

    beforeEach(() => {
        tool = new ManageParticle();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_particle');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['add', 'set_property', 'set_emission', 'set_shape', 'set_renderer', 'get_info', 'list', 'remove']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['add', 'set_property', 'set_emission', 'set_shape', 'set_renderer', 'get_info', 'list', 'remove']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Add action tests
    it('add returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add', { is2d: false });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('add calls Editor.Message.request correctly for 3D particle', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { particleUuid: 'ps-1' } });

        const result = await tool.execute('add', {
            nodeUuid: 'node-123',
            is2d: false
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'addParticleSystem',
            args: ['node-123', false]
        }));
    });

    it('add calls Editor.Message.request correctly for 2D particle', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { particleUuid: 'ps2d-1' } });

        const result = await tool.execute('add', {
            nodeUuid: 'node-456',
            is2d: true
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-456', true]
        }));
    });

    // Set property action tests
    it('set_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_property', { property: 'duration', value: 5.0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('set_property returns error when property is missing', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'node-123', value: 5.0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property.*required/i);
    });

    it('set_property returns error when value is undefined', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'node-123', property: 'duration' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/value.*required/i);
    });

    it('set_property calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_property', {
            nodeUuid: 'node-123',
            property: 'startLifetime',
            value: 2.5
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setParticleProperty',
            args: ['node-123', 'startLifetime', 2.5]
        }));
    });

    // Set emission action tests
    it('set_emission returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_emission', { rateOverTime: 10 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('set_emission calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_emission', {
            nodeUuid: 'node-123',
            rateOverTime: 50,
            bursts: [{ time: 0, count: 10 }, { time: 1, count: 5 }]
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setParticleEmission',
            args: ['node-123', 50, [{ time: 0, count: 10 }, { time: 1, count: 5 }]]
        }));
    });

    it('set_emission works with empty bursts array', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_emission', {
            nodeUuid: 'node-123',
            rateOverTime: 25,
            bursts: []
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-123', 25, []]
        }));
    });

    // Set shape action tests
    it('set_shape returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_shape', { shapeType: 'sphere', radius: 1 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('set_shape calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_shape', {
            nodeUuid: 'node-123',
            shapeType: 'cone',
            radius: 2.5,
            angle: 45
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setParticleShape',
            args: ['node-123', 'cone', 2.5, 45]
        }));
    });

    // Set renderer action tests
    it('set_renderer returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_renderer', { renderMode: 0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('set_renderer calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_renderer', {
            nodeUuid: 'node-123',
            renderMode: 1,
            materialUuid: 'mat-456'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setParticleRenderer',
            args: ['node-123', 1, 'mat-456']
        }));
    });

    // Get info action tests
    it('get_info returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('get_info', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('get_info calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const particleInfo = {
            duration: 5.0,
            startLifetime: 2.0,
            startSpeed: 1.0,
            loop: true,
            maxParticles: 100
        };
        mockRequest.mockResolvedValueOnce({ success: true, data: particleInfo });

        const result = await tool.execute('get_info', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(particleInfo);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'getParticleInfo',
            args: ['node-123']
        }));
    });

    // List action tests
    it('list calls Editor.Message.request without nodeUuid', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const particles = [
            { nodeUuid: 'node-1', name: 'Fire', is2d: false },
            { nodeUuid: 'node-2', name: 'Dust', is2d: true }
        ];
        mockRequest.mockResolvedValueOnce({ success: true, data: particles });

        const result = await tool.execute('list', {});

        expect(result.success).toBe(true);
        expect(result.data).toEqual(particles);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'listParticleSystems',
            args: []
        }));
    });

    it('list returns success with empty array when no particles exist', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: [] });

        const result = await tool.execute('list', {});

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
    });

    // Remove action tests
    it('remove returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('remove', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('remove calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('remove', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'removeParticleSystem',
            args: ['node-123']
        }));
    });

    it('remove returns error when scene call fails', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: false, error: 'Particle component not found' });

        const result = await tool.execute('remove', { nodeUuid: 'nonexistent' });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Particle component not found/);
    });
});
