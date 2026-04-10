import { ManageAudio } from '../tools/manage-audio';

describe('ManageAudio', () => {
    let tool: ManageAudio;

    beforeEach(() => {
        tool = new ManageAudio();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_audio');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['add_source', 'set_property', 'play', 'stop', 'pause', 'resume', 'get_info', 'list']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['add_source', 'set_property', 'play', 'stop', 'pause', 'resume', 'get_info', 'list']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Add source action tests
    it('add_source returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add_source', { clipUuid: 'clip-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('add_source calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { audioSourceUuid: 'as-1' } });

        const result = await tool.execute('add_source', {
            nodeUuid: 'node-123',
            clipUuid: 'clip-456'
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ audioSourceUuid: 'as-1' });
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'addAudioSource',
            args: ['node-123', 'clip-456']
        }));
    });

    it('add_source accepts null clipUuid', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { audioSourceUuid: 'as-2' } });

        const result = await tool.execute('add_source', {
            nodeUuid: 'node-123'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-123', null]
        }));
    });

    it('add_source returns error when scene call fails', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: false, error: 'Node not found' });

        const result = await tool.execute('add_source', { nodeUuid: 'invalid-node' });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Node not found/);
    });

    // Set property action tests
    it('set_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_property', { property: 'volume', value: 0.5 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('set_property returns error when property is missing', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'node-123', value: 0.5 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property.*required/i);
    });

    it('set_property returns error when value is undefined', async () => {
        const result = await tool.execute('set_property', { nodeUuid: 'node-123', property: 'volume' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/value.*required/i);
    });

    it('set_property calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_property', {
            nodeUuid: 'node-123',
            property: 'volume',
            value: 0.8
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setAudioProperty',
            args: ['node-123', 'volume', 0.8]
        }));
    });

    it('set_property works with boolean values (loop, playOnAwake)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_property', {
            nodeUuid: 'node-123',
            property: 'loop',
            value: true
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-123', 'loop', true]
        }));
    });

    // Play action tests
    it('play returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('play', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('play calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('play', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'controlAudio',
            args: ['node-123', 'play']
        }));
    });

    // Stop action tests
    it('stop returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('stop', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('stop calls Editor.Message.request with stop command', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('stop', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'controlAudio',
            args: ['node-123', 'stop']
        }));
    });

    // Pause action tests
    it('pause returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('pause', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('pause calls Editor.Message.request with pause command', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('pause', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-123', 'pause']
        }));
    });

    // Resume action tests
    it('resume returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('resume', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('resume calls Editor.Message.request with resume command', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('resume', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-123', 'resume']
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
        const audioInfo = { volume: 0.8, loop: false, playOnAwake: true, isPlaying: false };
        mockRequest.mockResolvedValueOnce({ success: true, data: audioInfo });

        const result = await tool.execute('get_info', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(audioInfo);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'getAudioInfo'
        }));
    });

    // List action tests
    it('list calls Editor.Message.request without nodeUuid', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const audioSources = [
            { nodeUuid: 'node-1', volume: 1.0, isPlaying: true },
            { nodeUuid: 'node-2', volume: 0.5, isPlaying: false }
        ];
        mockRequest.mockResolvedValueOnce({ success: true, data: audioSources });

        const result = await tool.execute('list', {});

        expect(result.success).toBe(true);
        expect(result.data).toEqual(audioSources);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'listAudioSources',
            args: []
        }));
    });

    it('list returns success even when no audio sources exist', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: [] });

        const result = await tool.execute('list', {});

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
    });
});
