import { ManagePhysics } from '../tools/manage-physics';

describe('ManagePhysics', () => {
    let tool: ManagePhysics;

    beforeEach(() => {
        tool = new ManagePhysics();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_physics');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['configure', 'add_rigidbody', 'add_collider', 'set_rigidbody_property', 'set_collider_property', 'remove_physics', 'get_info', 'raycast']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['configure', 'add_rigidbody', 'add_collider', 'set_rigidbody_property', 'set_collider_property', 'remove_physics', 'get_info', 'raycast']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Configure physics action tests
    it('configure calls Editor.Message.request without required nodeUuid', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { gravity: [0, -10, 0] } });

        const result = await tool.execute('configure', {
            gravity: { x: 0, y: -10, z: 0 },
            fixedTimeStep: 0.016,
            maxSubSteps: 5
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'configurePhysics'
        }));
    });

    // Add rigidbody action tests
    it('add_rigidbody returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add_rigidbody', { type: 'dynamic' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('add_rigidbody succeeds with nodeUuid only (type defaults to dynamic)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { rigidBodyUuid: 'rb-1' } });

        const result = await tool.execute('add_rigidbody', { nodeUuid: 'node-123' });
        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            args: ['node-123', 'dynamic', 1, true]
        }));
    });

    it('add_rigidbody calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { rigidBodyUuid: 'rb-123' } });

        const result = await tool.execute('add_rigidbody', {
            nodeUuid: 'node-123',
            type: 'dynamic',
            mass: 1.0,
            useGravity: true
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'addRigidbody',
            args: ['node-123', 'dynamic', 1.0, true]
        }));
    });

    // Add collider action tests
    it('add_collider returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('add_collider', { shape: 'box' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('add_collider returns error when shape is missing', async () => {
        const result = await tool.execute('add_collider', { nodeUuid: 'node-123' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/shape/i);
    });

    it('add_collider calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { colliderUuid: 'col-123' } });

        const result = await tool.execute('add_collider', {
            nodeUuid: 'node-123',
            shape: 'box',
            size: { width: 1, height: 1, depth: 1 },
            isTrigger: false
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'addCollider',
            args: ['node-123', 'box', { width: 1, height: 1, depth: 1 }, false]
        }));
    });

    // Set rigidbody property action tests
    it('set_rigidbody_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_rigidbody_property', { property: 'mass', value: 2.0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_rigidbody_property returns error when property is missing', async () => {
        const result = await tool.execute('set_rigidbody_property', { nodeUuid: 'node-123', value: 2.0 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property/i);
    });

    it('set_rigidbody_property calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_rigidbody_property', {
            nodeUuid: 'node-123',
            property: 'mass',
            value: 5.0
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setRigidbodyProperty',
            args: ['node-123', 'mass', 5.0]
        }));
    });

    // Set collider property action tests
    it('set_collider_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_collider_property', { property: 'isTrigger', value: true });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_collider_property calls Editor.Message.request correctly', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('set_collider_property', {
            nodeUuid: 'node-123',
            property: 'isTrigger',
            value: true
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'setColliderProperty'
        }));
    });

    // Remove physics action tests
    it('remove_physics returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('remove_physics', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('remove_physics calls Editor.Message.request with removePhysicsComponents', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true });

        const result = await tool.execute('remove_physics', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'removePhysicsComponents',
            args: ['node-123']
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
        const physicsData = { hasRigidbody: true, hasCollider: true, type: 'dynamic' };
        mockRequest.mockResolvedValueOnce({ success: true, data: physicsData });

        const result = await tool.execute('get_info', { nodeUuid: 'node-123' });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(physicsData);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'getPhysicsInfo',
            args: ['node-123']
        }));
    });

    // Raycast action tests
    it('raycast returns error when origin is missing', async () => {
        const result = await tool.execute('raycast', {
            direction: { x: 0, y: 0, z: 1 },
            maxDistance: 100
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/origin/i);
    });

    it('raycast returns error when direction is missing', async () => {
        const result = await tool.execute('raycast', {
            origin: { x: 0, y: 0, z: 0 },
            maxDistance: 100
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/direction/i);
    });

    it('raycast calls Editor.Message.request with performRaycast', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const hitData = { hit: true, distance: 5.5, nodeUuid: 'hit-node' };
        mockRequest.mockResolvedValueOnce({ success: true, data: hitData });

        const result = await tool.execute('raycast', {
            origin: { x: 0, y: 0, z: 0 },
            direction: { x: 0, y: 0, z: 1 },
            maxDistance: 100
        });

        expect(result.success).toBe(true);
        expect(result.data).toEqual(hitData);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
            method: 'performRaycast',
            args: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 100]
        }));
    });
});
