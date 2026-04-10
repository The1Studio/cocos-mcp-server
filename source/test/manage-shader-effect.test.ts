import { ManageShaderEffect } from '../tools/manage-shader-effect';

describe('ManageShaderEffect', () => {
    let tool: ManageShaderEffect;

    beforeEach(() => {
        tool = new ManageShaderEffect();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_shader_effect');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['list', 'get_info', 'get_passes', 'set_pass_property', 'create']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_shader_action', {});
            expect(result.success).toBe(false);
        });
    });

    describe('list action', () => {
        it('calls Editor.Message.request to list effects', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce([
                { name: 'builtin-standard.effect', path: 'db://assets/effects/builtin-standard.effect' },
                { name: 'custom-effect.effect', path: 'db://assets/effects/custom-effect.effect' }
            ]);

            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-assets', expect.objectContaining({
                pattern: expect.stringContaining('*.effect')
            }));
        });
    });

    describe('get_info action', () => {
        it('returns error when url is missing', async () => {
            const result = await tool.execute('get_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/url is required/i);
        });

        it('calls asset-db to query effect info', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                name: 'test-effect',
                techniques: [{ name: 'opaque' }]
            });

            const result = await tool.execute('get_info', { url: 'db://assets/effects/test-effect.effect' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-asset-info', 'db://assets/effects/test-effect.effect');
        });
    });

    describe('get_passes action', () => {
        it('returns error when url is missing', async () => {
            const result = await tool.execute('get_passes', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/url is required/i);
        });

        it('queries effect asset for pass information', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                techniques: [
                    {
                        name: 'opaque',
                        passes: [
                            { vert: 'standard-vs:vert', frag: 'standard-fs:frag' }
                        ]
                    }
                ]
            });

            const result = await tool.execute('get_passes', { url: 'db://assets/effects/standard.effect' });
            expect(result.success).toBe(true);
        });
    });

    describe('set_pass_property action', () => {
        it('returns error when url is missing', async () => {
            const result = await tool.execute('set_pass_property', {
                techniqueIndex: 0,
                passIndex: 0,
                property: 'blend',
                value: 'add'
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/url is required/i);
        });

        it('calls scene method to set pass property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true });

            const result = await tool.execute('set_pass_property', {
                url: 'db://assets/effects/test.effect',
                techniqueIndex: 0,
                passIndex: 0,
                property: 'blend',
                value: 'add'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('create action', () => {
        it('returns error when url is missing', async () => {
            const result = await tool.execute('create', { template: 'unlit' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/url is required/i);
        });

        it('creates new effect from unlit template', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true, data: { url: 'db://assets/effects/new-effect.effect' } });

            const result = await tool.execute('create', {
                url: 'db://assets/effects/new-effect.effect',
                template: 'unlit'
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalled();
        });

        it('creates new effect from standard template', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true });

            const result = await tool.execute('create', {
                url: 'db://assets/effects/pbr-effect.effect',
                template: 'standard'
            });
            expect(result.success).toBe(true);
        });

        it('creates effect with custom template content', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({ success: true });

            const customTemplate = 'CCEffect %{ techniques: [] }%';
            const result = await tool.execute('create', {
                url: 'db://assets/effects/custom.effect',
                template: 'custom',
                templateContent: customTemplate
            });
            expect(result.success).toBe(true);
        });
    });

    describe('error handling', () => {
        it('handles asset-db errors gracefully', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Asset not found'));

            const result = await tool.execute('list', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Asset not found/);
        });
    });
});
