import { ManageRenderPipeline } from '../tools/manage-render-pipeline';

describe('ManageRenderPipeline', () => {
    let tool: ManageRenderPipeline;

    beforeEach(() => {
        tool = new ManageRenderPipeline();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_render_pipeline');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_info', 'set_shadow', 'set_fog', 'set_skybox', 'set_ambient', 'set_post_process']);
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
        it('calls Editor.Message.request without params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ fps: 60, shadows: true });

            const result = await tool.execute('get_info', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getRenderPipelineInfo'
            }));
        });
    });

    describe('set_shadow action', () => {
        it('calls Editor.Message.request with shadow params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_shadow', {
                enabled: true,
                type: 'ShadowMap',
                shadowMapSize: 1024
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setShadowSettings',
                args: [true, 'ShadowMap', 1024]
            }));
        });

        it('handles undefined optional params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_shadow', { enabled: false });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [false, undefined, undefined]
            }));
        });

        it('surfaces a scene-rejected out-of-range shadow type as a top-level error', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                success: false,
                error: 'Unknown shadow type: 5 — expected ShadowType.Planar or ShadowType.ShadowMap'
            });

            const result = await tool.execute('set_shadow', { type: 5 });
            expect(result.success).toBe(false);
            expect(result.isError).toBe(true);
            expect(result.error).toMatch(/Unknown shadow type/);
        });
    });

    describe('set_fog action', () => {
        it('calls Editor.Message.request with fog params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_fog', {
                enabled: true,
                fogColor: '#CCCCCC',
                type: 'LINEAR',
                fogStart: 1,
                fogEnd: 100,
                fogDensity: 0.5
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setFogSettings',
                args: [true, '#CCCCCC', 'LINEAR', 1, 100, 0.5]
            }));
        });

        it('handles undefined optional params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_fog', { enabled: false });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [false, undefined, undefined, undefined, undefined, undefined]
            }));
        });

        it('surfaces a scene-rejected out-of-range fog type as a top-level error', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                success: false,
                error: 'Unknown fog type: 99 — expected FogType.LINEAR/EXP/EXP_SQUARED/LAYERED'
            });

            const result = await tool.execute('set_fog', { type: 99 });
            expect(result.success).toBe(false);
            expect(result.isError).toBe(true);
            expect(result.error).toMatch(/Unknown fog type/);
        });
    });

    describe('set_skybox action', () => {
        it('calls Editor.Message.request with skybox params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_skybox', {
                enabled: true,
                useHDR: true,
                rotationAngle: 45
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setSkyboxSettings',
                args: [true, true, 45]
            }));
        });
    });

    describe('set_ambient action', () => {
        it('calls Editor.Message.request with ambient params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_ambient', {
                skyColor: '#804020',
                groundAlbedo: '#102030',
                skyIllum: 2.5
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setAmbientSettings',
                args: ['#804020', '#102030', 2.5]
            }));
        });
    });

    describe('set_post_process action', () => {
        it('calls Editor.Message.request with post-process params', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const bloomSettings = { enabled: true, intensity: 1.5 };
            const result = await tool.execute('set_post_process', {
                bloom: bloomSettings,
                tonemap: 'aces'
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setPostProcessSettings',
                args: [bloomSettings, 'aces']
            }));
        });
    });

    describe('error handling', () => {
        it('returns error when Editor.Message.request fails', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Scene not loaded'));

            const result = await tool.execute('get_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Scene not loaded/);
        });
    });
});
