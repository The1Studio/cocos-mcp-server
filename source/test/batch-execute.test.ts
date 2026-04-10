import { BatchExecute, ToolExecutor, BatchCall } from '../tools/batch-execute';

describe('BatchExecute', () => {
    let tool: BatchExecute;
    let mockExecutor: jest.Mocked<ToolExecutor>;

    beforeEach(() => {
        mockExecutor = {
            executeToolCall: jest.fn()
        };
        tool = new BatchExecute(mockExecutor);
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('batch_execute');
    });

    it('has execute action', () => {
        expect(tool.actions).toEqual(['execute']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['execute']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Execute action tests
    it('returns error when calls array is missing', async () => {
        const result = await tool.execute('execute', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/calls.*array/i);
    });

    it('returns error when calls array is not an array', async () => {
        const result = await tool.execute('execute', { calls: 'not-an-array' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/calls.*array/i);
    });

    it('returns error when calls array is empty', async () => {
        const result = await tool.execute('execute', { calls: [] });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/empty|at least one/i);
    });

    it('returns error when calls exceed max batch size (50)', async () => {
        const calls: BatchCall[] = [];
        for (let i = 0; i < 51; i++) {
            calls.push({ tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } });
        }
        const result = await tool.execute('execute', { calls });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/exceed.*max|50/i);
    });

    it('allows exactly 50 calls', async () => {
        const calls: BatchCall[] = [];
        for (let i = 0; i < 50; i++) {
            calls.push({ tool: 'manage_node', action: 'query', args: { uuid: `node-${i}` } });
        }
        mockExecutor.executeToolCall.mockResolvedValue({ success: true, data: {} });

        const result = await tool.execute('execute', { calls, stopOnError: false });

        expect(result.success).toBe(true);
        expect(mockExecutor.executeToolCall).toHaveBeenCalledTimes(50);
    });

    it('executes all calls successfully when stopOnError=false', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root', name: 'Node1' } },
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root', name: 'Node2' } },
            { tool: 'manage_component', action: 'add', args: { nodeUuid: 'node-1', componentName: 'Sprite' } }
        ];
        mockExecutor.executeToolCall.mockResolvedValue({ success: true, data: { nodeUuid: 'created' } });

        const result = await tool.execute('execute', { calls, stopOnError: false });

        expect(result.success).toBe(true);
        expect(mockExecutor.executeToolCall).toHaveBeenCalledTimes(3);
        expect((result.data as any).results).toHaveLength(3);
        expect((result.data as any).results[0].success).toBe(true);
    });

    it('stops at first error when stopOnError=true (default)', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } },
            { tool: 'manage_node', action: 'delete', args: { uuid: 'nonexistent' } }, // This one will fail
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } }
        ];
        mockExecutor.executeToolCall
            .mockResolvedValueOnce({ success: true, data: { nodeUuid: 'node-1' } })
            .mockResolvedValueOnce({ success: false, error: 'Node not found' })
            .mockResolvedValueOnce({ success: true, data: { nodeUuid: 'node-3' } });

        const result = await tool.execute('execute', { calls, stopOnError: true });

        expect(result.success).toBe(true); // Overall success even though a call failed
        expect((result.data as any).results).toHaveLength(2); // Only 2 results (stopped after failure)
        expect((result.data as any).results[1].success).toBe(false);
        expect(mockExecutor.executeToolCall).toHaveBeenCalledTimes(2); // Stopped after first failure
    });

    it('continues past errors when stopOnError=false', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } },
            { tool: 'manage_node', action: 'delete', args: { uuid: 'nonexistent' } }, // This one will fail
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } }
        ];
        mockExecutor.executeToolCall
            .mockResolvedValueOnce({ success: true, data: { nodeUuid: 'node-1' } })
            .mockResolvedValueOnce({ success: false, error: 'Node not found' })
            .mockResolvedValueOnce({ success: true, data: { nodeUuid: 'node-3' } });

        const result = await tool.execute('execute', { calls, stopOnError: false });

        expect(result.success).toBe(true); // Overall success even though execution continued past error
        expect((result.data as any).results).toHaveLength(3); // All 3 results present
        expect((result.data as any).results[1].success).toBe(false);
        expect(mockExecutor.executeToolCall).toHaveBeenCalledTimes(3); // Executed all
    });

    it('returns correct tool and action names in results', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root', name: 'TestNode' } },
            { tool: 'manage_ui', action: 'create_label', args: { parentUuid: 'canvas' } }
        ];
        mockExecutor.executeToolCall.mockResolvedValue({ success: true, data: {} });

        const result = await tool.execute('execute', { calls, stopOnError: false });

        expect(result.success).toBe(true);
        const results = (result.data as any).results;
        expect(results[0].tool).toBe('manage_node');
        expect(results[0].action).toBe('create');
        expect(results[1].tool).toBe('manage_ui');
        expect(results[1].action).toBe('create_label');
    });

    it('includes index in each result entry', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } },
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } },
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } }
        ];
        mockExecutor.executeToolCall.mockResolvedValue({ success: true, data: {} });

        const result = await tool.execute('execute', { calls, stopOnError: false });

        const results = (result.data as any).results;
        expect(results[0].index).toBe(0);
        expect(results[1].index).toBe(1);
        expect(results[2].index).toBe(2);
    });

    it('captures executor errors as failed results', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } }
        ];
        mockExecutor.executeToolCall.mockRejectedValueOnce(new Error('Executor crashed'));

        const result = await tool.execute('execute', { calls, stopOnError: false });

        expect(result.success).toBe(true); // Overall success returns true
        const results = (result.data as any).results;
        expect(results[0].success).toBe(false);
        expect(results[0].error).toMatch(/Executor crashed/);
    });

    it('defaults stopOnError to true when not specified', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } },
            { tool: 'manage_node', action: 'delete', args: { uuid: 'nonexistent' } }
        ];
        mockExecutor.executeToolCall
            .mockResolvedValueOnce({ success: true, data: { nodeUuid: 'node-1' } })
            .mockResolvedValueOnce({ success: false, error: 'Node not found' });

        const result = await tool.execute('execute', { calls }); // No stopOnError specified

        expect(mockExecutor.executeToolCall).toHaveBeenCalledTimes(2); // Should stop at first error (default true)
        expect(result.success).toBe(true);
    });

    it('passes tool and action names correctly to executor', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_light', action: 'add', args: { nodeUuid: 'node-1', type: 'directional' } }
        ];
        mockExecutor.executeToolCall.mockResolvedValue({ success: true, data: {} });

        await tool.execute('execute', { calls, stopOnError: false });

        expect(mockExecutor.executeToolCall).toHaveBeenCalledWith(
            'manage_light',
            expect.objectContaining({
                action: 'add',
                nodeUuid: 'node-1',
                type: 'directional'
            })
        );
    });

    it('returns result count information in result data', async () => {
        const calls: BatchCall[] = [
            { tool: 'manage_node', action: 'create', args: { parentUuid: 'root' } }
        ];
        mockExecutor.executeToolCall.mockResolvedValue({ success: true, data: { nodeUuid: 'node-1' } });

        const result = await tool.execute('execute', { calls, stopOnError: false });

        expect(result.success).toBe(true);
        expect((result.data as any).results).toBeDefined();
        expect((result.data as any).results.length).toBe(1);
    });
});
