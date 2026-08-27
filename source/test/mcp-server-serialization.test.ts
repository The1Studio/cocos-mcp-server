import { MCPServer } from '../mcp-server';
import { resetMutationQueue } from '../tools/mutation-queue';

/**
 * #6 — `manage_scene save` reported success while a concurrently issued `manage_node
 * create` was still committing, so the created node was never written. Reproduces the
 * report's caller pattern at the dispatch point: two tool calls fired together without
 * awaiting the first. Before every tool call was serialized, `save-scene` ran while
 * `create-node` was still pending.
 */
describe('MCPServer.executeToolCall serialization (#6)', () => {
    const settings = {
        port: 0,
        autoStart: false,
        enableDebugLog: false,
        allowedOrigins: [],
        maxConnections: 1,
    };

    let server: MCPServer;
    let mockRequest: jest.Mock;
    let messageLog: string[];

    beforeEach(() => {
        resetMutationQueue();
        server = new MCPServer(settings);
        messageLog = [];
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('does not start a save while a concurrently issued node create is still committing', async () => {
        let createCommitted = false;
        let savedWhileCreatePending = false;

        mockRequest.mockImplementation(async (_pkg: string, message: string) => {
            messageLog.push(message);
            switch (message) {
                case 'create-node':
                    // The editor commits the node asynchronously — this is the window the
                    // report's concurrent save slipped into.
                    await new Promise(r => setTimeout(r, 30));
                    createCommitted = true;
                    return 'node-uuid-1';
                case 'query-node':
                    return createCommitted ? { uuid: { value: 'node-uuid-1' }, name: { value: 'X' } } : null;
                case 'save-scene':
                    if (!createCommitted) savedWhileCreatePending = true;
                    return true;
                case 'query-dirty':
                    return false;
                default:
                    return {};
            }
        });

        const create = server.executeToolCall('manage_node', { action: 'create', name: 'X' });
        const save = server.executeToolCall('manage_scene', { action: 'save' });
        const [createResult, saveResult] = await Promise.all([create, save]);

        expect(savedWhileCreatePending).toBe(false);
        expect(messageLog.indexOf('save-scene')).toBeGreaterThan(messageLog.indexOf('create-node'));
        expect(createResult.success).toBe(true);
        expect(saveResult.success).toBe(true);
    });

    it('runs batch_execute without deadlocking it behind its own queue slot', async () => {
        mockRequest.mockImplementation(async (_pkg: string, message: string) => {
            messageLog.push(message);
            if (message === 'save-scene') return true;
            if (message === 'query-dirty') return false;
            return {};
        });

        // batch_execute re-enters executeToolCall for each call: enqueueing it would park it
        // behind a slot only its own inner calls can release. It opts out via `reentrant`.
        const result = await server.executeToolCall('batch_execute', {
            action: 'execute',
            calls: [
                { tool: 'manage_scene', action: 'save' },
                { tool: 'manage_scene', action: 'save' },
            ],
        });

        expect(result.success).toBe(true);
        expect(messageLog.filter(m => m === 'save-scene')).toHaveLength(2);
    });
});
