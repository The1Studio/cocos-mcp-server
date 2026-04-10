import { ManageMesh } from '../tools/manage-mesh';

describe('ManageMesh', () => {
    let tool: ManageMesh;

    beforeEach(() => {
        tool = new ManageMesh();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_mesh');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_info', 'list', 'get_renderer_info', 'set_renderer_property']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_mesh_action', {});
            expect(result.success).toBe(false);
        });
    });

    describe('get_info action', () => {
        it('returns error when uuid is missing', async () => {
            const result = await tool.execute('get_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/uuid is required/i);
        });

        it('queries asset-db for mesh info', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                name: 'cube.mesh',
                path: 'db://assets/meshes/cube.mesh'
            });

            const result = await tool.execute('get_info', { uuid: 'uuid-mesh-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-asset-info', 'uuid-mesh-123');
        });

        it('includes optional asset metadata', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ name: 'cube.mesh' })
                .mockResolvedValueOnce({ subMeshes: 1 });

            const result = await tool.execute('get_info', { uuid: 'uuid-mesh-123' });
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('info');
            expect(result.data).toHaveProperty('meta');
        });
    });

    describe('list action', () => {
        it('queries mesh assets with default pattern', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce([
                { name: 'cube.mesh', uuid: 'uuid-1' },
                { name: 'sphere.mesh', uuid: 'uuid-2' }
            ]);

            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-assets', expect.objectContaining({
                pattern: 'db://assets/**/*.mesh'
            }));
        });

        it('accepts custom pattern for filtering', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce([
                { name: 'model.mesh', uuid: 'uuid-1' }
            ]);

            const result = await tool.execute('list', { pattern: 'db://assets/models/**/*.mesh' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-assets', expect.objectContaining({
                pattern: 'db://assets/models/**/*.mesh'
            }));
        });

        it('returns mesh count in result', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce([
                { name: 'mesh1.mesh' },
                { name: 'mesh2.mesh' },
                { name: 'mesh3.mesh' }
            ]);

            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(result.data.count).toBe(3);
        });
    });

    describe('get_renderer_info action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('get_renderer_info', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('calls scene method to get renderer info', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                shadowCastingMode: 1,
                receiveShadow: true,
                visibility: 0xffffffff
            });

            const result = await tool.execute('get_renderer_info', { nodeUuid: 'uuid-node-123' });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getMeshRendererInfo'
            }));
        });
    });

    describe('set_renderer_property action', () => {
        it('returns error when nodeUuid is missing', async () => {
            const result = await tool.execute('set_renderer_property', {
                property: 'receiveShadow',
                value: true
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/nodeUuid is required/i);
        });

        it('returns error when property is missing', async () => {
            const result = await tool.execute('set_renderer_property', {
                nodeUuid: 'uuid-123',
                value: true
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/property is required/i);
        });

        it('returns error when value is missing', async () => {
            const result = await tool.execute('set_renderer_property', {
                nodeUuid: 'uuid-123',
                property: 'receiveShadow'
            });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/value is required/i);
        });

        it('sets shadowCastingMode property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_renderer_property', {
                nodeUuid: 'uuid-123',
                property: 'shadowCastingMode',
                value: 1
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setMeshRendererProperty',
                args: ['uuid-123', 'shadowCastingMode', 1]
            }));
        });

        it('sets receiveShadow property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_renderer_property', {
                nodeUuid: 'uuid-123',
                property: 'receiveShadow',
                value: false
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', 'receiveShadow', false]
            }));
        });

        it('sets visibility property', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_renderer_property', {
                nodeUuid: 'uuid-123',
                property: 'visibility',
                value: 0xff000000
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: ['uuid-123', 'visibility', 0xff000000]
            }));
        });
    });

    describe('error handling', () => {
        it('handles asset-db query errors', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Database connection failed'));

            const result = await tool.execute('list', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Database connection failed/);
        });

        it('handles scene request errors', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Node not found'));

            const result = await tool.execute('get_renderer_info', { nodeUuid: 'uuid-999' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Node not found/);
        });
    });
});
