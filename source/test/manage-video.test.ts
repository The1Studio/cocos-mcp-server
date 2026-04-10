import { ManageVideo } from '../tools/manage-video';

describe('ManageVideo', () => {
    let tool: ManageVideo;

    beforeEach(() => {
        tool = new ManageVideo();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_video');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['add', 'set_property', 'play', 'get_info', 'list']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_video_action', {});
            expect(result.success).toBe(false);
        });
    });

    describe('add action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('add', { clipUrl: 'db://assets/video/intro.mp4' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('calls Editor.Message.request to add VideoPlayer', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('add', {
                nodeUuid: 'uuid-123',
                clipUrl: 'db://assets/video/intro.mp4'
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'addVideoPlayer',
                args: ['uuid-123', 'db://assets/video/intro.mp4']
            }));
        });

        it('adds VideoPlayer without clip URL', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('add', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', undefined]
            }));
        });
    });

    describe('set_property action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_property', {
                property: 'loop',
                value: true
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when property is missing', async () => {
            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                value: true
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/property is required/i);
        });

        it('returns error when value is missing', async () => {
            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                property: 'loop'
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/value is required/i);
        });

        it('sets loop property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                property: 'loop',
                value: true
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setVideoProperty',
                args: ['uuid-123', 'loop', true]
            }));
        });

        it('sets volume property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                property: 'volume',
                value: 0.5
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', 'volume', 0.5]
            }));
        });

        it('sets playbackRate property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_property', {
                nodeUuid: 'uuid-123',
                property: 'playbackRate',
                value: 1.5
            });
            expect(result.success).toBe(true);
        });
    });

    describe('play action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('play', { command: 'play' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when command is missing', async () => {
            const result = await tool.execute('play', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/command is required/i);
        });

        it('sends play command', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('play', { nodeUuid: 'uuid-123', command: 'play' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'controlVideo',
                args: ['uuid-123', 'play']
            }));
        });

        it('sends pause command', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('play', { nodeUuid: 'uuid-123', command: 'pause' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', 'pause']
            }));
        });

        it('sends stop command', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('play', { nodeUuid: 'uuid-123', command: 'stop' });
            expect(result.success).toBe(true);
        });

        it('sends resume command', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('play', { nodeUuid: 'uuid-123', command: 'resume' });
            expect(result.success).toBe(true);
        });
    });

    describe('get_info action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('calls Editor.Message.request to get video info', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                isPlaying: false,
                currentTime: 0,
                duration: 60,
                volume: 1.0
            });

            const result = await tool.execute('get_info', { nodeUuid: 'uuid-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getVideoInfo'
            }));
        });
    });

    describe('list action', () => {
        it('calls Editor.Message.request to list VideoPlayer nodes', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce([
                { nodeUuid: 'uuid-1', nodeName: 'VideoPlayer1' },
                { nodeUuid: 'uuid-2', nodeName: 'VideoPlayer2' }
            ]);

            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'listVideoPlayers'
            }));
        });
    });

    describe('error handling', () => {
        it('handles scene request errors gracefully', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Node is missing VideoPlayer component'));

            const result = await tool.execute('play', { nodeUuid: 'uuid-999', command: 'play' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/missing VideoPlayer/);
        });
    });
});
