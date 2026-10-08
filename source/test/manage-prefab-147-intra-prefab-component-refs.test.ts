import { PrefabCreationService } from '../tools/manage-prefab-creation-service';

/**
 * #147 — `manage_prefab create` serialized a custom component-typed `@property(Foo)` ref as
 * `{__uuid__}` (asset form) instead of the intra-prefab `{__id__: n}` index, and still
 * reported success; the ref was null/broken at runtime.
 *
 * Two mechanisms, both reproduced here against the real create flow with a routed editor mock:
 *
 *  1. Asset-first dispatch: `processComponentProperty` treated any ref whose TYPE NAME matched
 *     the asset allowlist/suffix arm (`/(?:Font|Asset|Atlas|Clip)$/`) as an asset — so a
 *     custom component named e.g. `TileAsset` was written as `{__uuid__}` even though its uuid
 *     is a component inside the subtree being serialized. A uuid that IS in the subtree's
 *     component index is a component, whatever its class is called.
 *  2. Order dependence: component/node indices were registered while walking the tree, but
 *     properties were serialized in the same walk, so a ref to something visited LATER (a
 *     child pointing at its parent's component, a later sibling, a later component on the
 *     same node) was unresolved at serialization time — an unencodable loss (create fails) or,
 *     with a suffix-matching type name, the `{__uuid__}` form from mechanism 1.
 */
declare const global: any;

describe('PrefabCreationService — intra-prefab component refs (#147)', () => {
    let service: PrefabCreationService;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        service = new PrefabCreationService();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
    });

    const comp = (type: string, compUuid: string, props: Record<string, any> = {}) => ({
        __type__: type, type, enabled: true, uuid: { value: compUuid }, value: props,
    });
    const refProp = (name: string, type: string, uuid: string) => ({ name, type, value: { uuid } });
    const nodeDump = (uuid: string, name: string, comps: any[]) => ({
        uuid, name: { value: name }, active: true, position: { value: { x: 0, y: 0, z: 0 } }, __comps__: comps,
    });

    async function create(tree: any, dumps: Record<string, any>) {
        let written: any[] = [];
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (_pkg: string, message: string, ...args: any[]) => {
            if (message === 'query-node-tree') return tree;
            if (message === 'query-node') return dumps[args[0]] || { uuid: args[0] };
            if (message === 'create-asset') return { uuid: 'prefab-uuid-1' };
            if (message === 'save-asset') { written = JSON.parse(args[1]); return {}; }
            if (message === 'save-asset-meta' || message === 'reimport-asset' || message === 'link-prefab') return true;
            if (message === 'query-asset-info') return { url: 'db://assets/P.prefab' };
            throw new Error(`unexpected message: ${message}`);
        });
        const result = await service.createPrefabWithAssetDB('root', 'db://assets/P.prefab', 'P', true, true);
        return { result, written };
    }

    const indexOfType = (written: any[], type: string) => written.findIndex(e => e && e.__type__ === type);

    it('writes {__id__} for a ref whose class name matches the asset suffix arm (root -> child component)', async () => {
        const tree = { uuid: 'root', name: 'Root', children: [{ uuid: 'child', name: 'Child', children: [] }] };
        const dumps = {
            root: nodeDump('root', 'Root', [comp('Controller', 'ctrl-uuid', { tile: refProp('tile', 'TileAsset', 'tile-uuid') })]),
            child: nodeDump('child', 'Child', [comp('TileAsset', 'tile-uuid')]),
        };

        const { result, written } = await create(tree, dumps);

        expect(result.success).toBe(true);
        const controller = written[indexOfType(written, 'Controller')];
        // Pre-fix: { __uuid__: 'tile-uuid', __expectedType__: 'TileAsset' }
        expect(controller.tile).toEqual({ __id__: indexOfType(written, 'TileAsset') });
    });

    it('resolves a child component ref to a component on its PARENT node (forward reference)', async () => {
        const tree = { uuid: 'root', name: 'Root', children: [{ uuid: 'child', name: 'Child', children: [] }] };
        const dumps = {
            root: nodeDump('root', 'Root', [comp('GameController', 'ctrl-uuid')]),
            child: nodeDump('child', 'Child', [comp('Hud', 'hud-uuid', { owner: refProp('owner', 'GameController', 'ctrl-uuid') })]),
        };

        const { result, written } = await create(tree, dumps);

        // Pre-fix: the parent's component was not indexed yet -> an unencodable-reference loss.
        expect(result.error).toBeUndefined();
        expect(result.success).toBe(true);
        const hud = written[indexOfType(written, 'Hud')];
        expect(hud.owner).toEqual({ __id__: indexOfType(written, 'GameController') });
    });

    it('resolves refs between sibling subtrees regardless of visit order', async () => {
        const tree = {
            uuid: 'root', name: 'Root',
            children: [{ uuid: 'a', name: 'A', children: [] }, { uuid: 'b', name: 'B', children: [] }],
        };
        const dumps = {
            root: nodeDump('root', 'Root', []),
            a: nodeDump('a', 'A', [comp('Alpha', 'alpha-uuid', {
                beta: refProp('beta', 'Beta', 'beta-uuid'),
                peer: refProp('peer', 'cc.Node', 'b'),
            })]),
            b: nodeDump('b', 'B', [comp('Beta', 'beta-uuid', { alpha: refProp('alpha', 'Alpha', 'alpha-uuid') })]),
        };

        const { result, written } = await create(tree, dumps);

        expect(result.success).toBe(true);
        const alpha = written[indexOfType(written, 'Alpha')];
        const beta = written[indexOfType(written, 'Beta')];
        expect(alpha.beta).toEqual({ __id__: indexOfType(written, 'Beta') });
        expect(beta.alpha).toEqual({ __id__: indexOfType(written, 'Alpha') });
        const bNode = written.findIndex(e => e && e.__type__ === 'cc.Node' && e._name === 'B');
        expect(alpha.peer).toEqual({ __id__: bNode });
    });

    it('resolves a ref to a LATER component on the same node', async () => {
        const tree = { uuid: 'root', name: 'Root', children: [] };
        const dumps = {
            root: nodeDump('root', 'Root', [
                comp('First', 'first-uuid', { second: refProp('second', 'Second', 'second-uuid') }),
                comp('Second', 'second-uuid'),
            ]),
        };

        const { result, written } = await create(tree, dumps);

        expect(result.success).toBe(true);
        expect(written[indexOfType(written, 'First')].second).toEqual({ __id__: indexOfType(written, 'Second') });
    });

    it('still serializes a genuine asset ref as {__uuid__} and still fails on a truly external component ref', async () => {
        const tree = { uuid: 'root', name: 'Root', children: [] };
        const dumps = {
            root: nodeDump('root', 'Root', [comp('Holder', 'holder-uuid', {
                font: refProp('font', 'cc.TTFFont', 'font-asset-uuid'),
                outside: refProp('outside', 'ElsewhereScript', 'not-in-subtree-uuid'),
            })]),
        };

        const { result } = await create(tree, dumps);

        // The external component ref is an unencodable loss: create must refuse, not write null.
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not-in-subtree-uuid/);
        expect(result.error).not.toMatch(/font-asset-uuid/);
    });
});
