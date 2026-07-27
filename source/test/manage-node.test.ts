import { ManageNode } from '../tools/manage-node';

describe('ManageNode', () => {
    let tool: ManageNode;

    beforeEach(() => {
        tool = new ManageNode();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_node');
        });
    });

    describe('create action with assetUuid/assetPath (linked-instance regression)', () => {
        // Regression test: manage_node create with assetUuid (or assetPath) shares the
        // same create-node code path as manage_prefab instantiate. 3.8.7's
        // NodeManager.createNodeFromAsset() picks the linked-instance branch based on
        // options.type — omitting it produces a flattened, unlinked copy that still
        // reports success.

        function mockNodeInfoResponse(mockRequest: jest.Mock) {
            // getNodeInfo() call made for verificationData after creation
            mockRequest.mockResolvedValueOnce({
                uuid: { value: 'created-node-uuid' },
                name: { value: 'Node' },
            });
        }

        it('resolves the asset type from assetUuid and passes it to create-node', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ uuid: 'scene-root-uuid' })              // query-node-tree (parent fallback)
                .mockResolvedValueOnce({ type: 'cc.Prefab', name: 'Card' })      // query-asset-info(assetUuid)
                .mockResolvedValueOnce('created-node-uuid');                     // create-node
            mockNodeInfoResponse(mockRequest);

            const result = await tool.execute('create', {
                name: 'Card',
                assetUuid: 'prefab-uuid-1234',
            });

            expect(result.success).toBe(true);
            const createNodeCall = mockRequest.mock.calls.find((c: any[]) => c[1] === 'create-node');
            expect(createNodeCall?.[2]).toEqual(expect.objectContaining({
                assetUuid: 'prefab-uuid-1234',
                type: 'cc.Prefab',
            }));
        });

        it('reuses the type already resolved from assetPath — does not double-query', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ uuid: 'scene-root-uuid' })                                          // query-node-tree
                .mockResolvedValueOnce({ uuid: 'prefab-uuid-5678', type: 'cc.Prefab' })                       // query-asset-info(assetPath)
                .mockResolvedValueOnce('created-node-uuid');                                                  // create-node
            mockNodeInfoResponse(mockRequest);

            const result = await tool.execute('create', {
                name: 'Card',
                assetPath: 'db://assets/prefabs/Card.prefab',
            });

            expect(result.success).toBe(true);
            const assetInfoCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'query-asset-info');
            expect(assetInfoCalls).toHaveLength(1);
            const createNodeCall = mockRequest.mock.calls.find((c: any[]) => c[1] === 'create-node');
            expect(createNodeCall?.[2]).toEqual(expect.objectContaining({
                assetUuid: 'prefab-uuid-5678',
                type: 'cc.Prefab',
            }));
        });

        it('still creates the node when the asset type lookup fails', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ uuid: 'scene-root-uuid' })   // query-node-tree
                .mockRejectedValueOnce(new Error('asset db unavailable')) // query-asset-info(assetUuid) fails
                .mockResolvedValueOnce('created-node-uuid');           // create-node
            mockNodeInfoResponse(mockRequest);

            const result = await tool.execute('create', {
                name: 'Card',
                assetUuid: 'prefab-uuid-9999',
            });

            expect(result.success).toBe(true);
            const createNodeCall = mockRequest.mock.calls.find((c: any[]) => c[1] === 'create-node');
            expect(createNodeCall?.[2]).not.toHaveProperty('type');
        });

        it('does not set type when no asset is involved', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ uuid: 'scene-root-uuid' }) // query-node-tree
                .mockResolvedValueOnce('created-node-uuid');        // create-node
            mockNodeInfoResponse(mockRequest);

            const result = await tool.execute('create', { name: 'PlainNode' });

            expect(result.success).toBe(true);
            const createNodeCall = mockRequest.mock.calls.find((c: any[]) => c[1] === 'create-node');
            expect(createNodeCall?.[2]).not.toHaveProperty('type');
            expect(createNodeCall?.[2]).not.toHaveProperty('assetUuid');
        });
    });
});
