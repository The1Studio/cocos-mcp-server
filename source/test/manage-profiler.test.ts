import { ManageProfiler } from '../tools/manage-profiler';

describe('ManageProfiler', () => {
    let tool: ManageProfiler;

    beforeEach(() => {
        tool = new ManageProfiler();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_profiler');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_stats', 'get_memory', 'toggle_stats_display', 'get_draw_calls']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_profiler_action', {});
            expect(result.success).toBe(false);
        });
    });

    describe('get_stats action', () => {
        it('calls Editor.Message.request for performance stats', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                fps: 60,
                drawCalls: 150,
                triangles: 500000,
                nodeCount: 1000
            });

            const result = await tool.execute('get_stats', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getPerformanceStats'
            }));
        });

        it('returns performance metrics in data', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                fps: 45,
                drawCalls: 200,
                triangles: 1000000,
                nodeCount: 2000
            });

            const result = await tool.execute('get_stats', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('fps');
            expect(result.data).toHaveProperty('drawCalls');
        });
    });

    describe('get_memory action', () => {
        it('calls Editor.Message.request for memory stats', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                jsHeap: 125.5,
                nativeMemory: 512,
                total: 637.5
            });

            const result = await tool.execute('get_memory', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getMemoryStats'
            }));
        });

        it('returns memory metrics in MB', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                jsHeap: 250.75,
                nativeMemory: 1024,
                total: 1274.75
            });

            const result = await tool.execute('get_memory', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('jsHeap');
            expect(result.data).toHaveProperty('nativeMemory');
            expect(result.data).toHaveProperty('total');
        });
    });

    describe('toggle_stats_display action', () => {
        it('calls Editor.Message.request without visible param (toggle)', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ visible: true });

            const result = await tool.execute('toggle_stats_display', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'toggleStatsDisplay',
                args: [undefined]
            }));
        });

        it('forces stats display visible when visible=true', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ visible: true });

            const result = await tool.execute('toggle_stats_display', { visible: true });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [true]
            }));
        });

        it('forces stats display hidden when visible=false', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ visible: false });

            const result = await tool.execute('toggle_stats_display', { visible: false });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [false]
            }));
        });

        it('returns success message for stats toggle', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('toggle_stats_display', {});
            expect(result.success).toBe(true);
            expect(result.message).toMatch(/toggled/i);
        });
    });

    describe('get_draw_calls action', () => {
        it('calls Editor.Message.request for draw call stats', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                totalDrawCalls: 150,
                opaqueDrawCalls: 120,
                transparentDrawCalls: 30
            });

            const result = await tool.execute('get_draw_calls', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getDrawCallStats'
            }));
        });

        it('returns draw call breakdown', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                totalDrawCalls: 200,
                opaqueDrawCalls: 160,
                transparentDrawCalls: 40,
                shadowCasterDrawCalls: 50
            });

            const result = await tool.execute('get_draw_calls', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('totalDrawCalls');
        });
    });

    describe('error handling', () => {
        it('handles scene request errors gracefully', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Scene is not running'));

            const result = await tool.execute('get_stats', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Scene is not running/);
        });

        it('handles memory query failures', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Memory profiler unavailable'));

            const result = await tool.execute('get_memory', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/profiler unavailable/i);
        });
    });
});
