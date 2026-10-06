import { PrefabCreationService } from '../tools/manage-prefab-creation-service';

/**
 * #130 — `manage_prefab action=create` reported `convertedToPrefabInstance: false` with
 * a bare "node conversion failed" message, and the only link messages it tried
 * (`connect-prefab-instance` / `set-prefab-connection` / `apply-prefab-link`) are not
 * 3.8.7 messages. The editor's own facade call is `linkPrefab(nodeUuid, assetUuid)`.
 * (The importer `_name` exception from the same report is #114 defect 2, fixed.)
 */
declare const global: any;

describe('PrefabCreationService — node->instance conversion (#130)', () => {
    let service: PrefabCreationService;
    let mockRequest: jest.Mock;
    let linkCalls: any[][];

    function route(link: (...a: any[]) => any) {
        mockRequest.mockReset();
        linkCalls = [];
        mockRequest.mockImplementation(async (_pkg: string, message: string, ...args: any[]) => {
            switch (message) {
                case 'query-node': return { uuid: 'node-1', name: 'Tile', active: true, position: { value: { x: 0, y: 0, z: 0 } }, __comps__: [] };
                case 'query-node-tree': return { uuid: 'node-1', name: 'Tile', children: [] };
                case 'create-asset': return { uuid: 'prefab-uuid-1' };
                case 'save-asset':
                case 'save-asset-meta': return {};
                case 'reimport-asset': return true;
                case 'query-asset-info': return { url: 'db://assets/Tile.prefab' };
                case 'link-prefab': linkCalls.push(args); return link(...args);
                default: throw new Error(`Message does not exist: scene - ${message}`);
            }
        });
    }

    async function create() {
        return service.createPrefabWithAssetDB('node-1', 'db://assets/Tile.prefab', 'Tile', true, true);
    }

    beforeEach(() => {
        service = new PrefabCreationService();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
    });

    it('links the node with scene:link-prefab (nodeUuid, assetUuid) and reports it converted', async () => {
        route(() => true);
        const result = await create();
        expect(result.success).toBe(true);
        expect(linkCalls).toEqual([['node-1', 'prefab-uuid-1']]);
        expect(result.data.convertedToPrefabInstance).toBe(true);
        expect(result.data.warning).toBeUndefined();
    });

    it('treats a link-prefab that resolves false as a failed conversion, not a success', async () => {
        route(() => false);
        const result = await create();
        expect(result.data.convertedToPrefabInstance).toBe(false);
    });

    it('surfaces a failed conversion as a warning naming every rejected method', async () => {
        route(() => { throw new Error('boom'); });
        const result = await create();
        expect(result.success).toBe(true); // the prefab asset itself was written
        expect(result.data.convertedToPrefabInstance).toBe(false);
        expect(result.data.warning).toMatch(/NOT converted/);
        expect(result.data.conversionError).toMatch(/link-prefab: boom/);
        expect(result.data.conversionError).toMatch(/connect-prefab-instance: Message does not exist/);
        expect(result.data.instruction).toMatch(/Link Prefab/);
    });
});
