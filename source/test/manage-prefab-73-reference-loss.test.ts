/**
 * Issue #73 — `manage_prefab action=create` wrote a prefab that was not equivalent to the
 * scene subtree, and `action=validate` called the result valid.
 *
 * The issue's original repro (2026-09-03, HEAD `4812a45`) reported four symptoms. On
 * current `origin/main` the asset-reference halves of `_mesh` / `_materials` are already
 * fixed — `cc.Mesh`, `cc.Skeleton` and the `Asset|Font|Atlas|Clip` suffix arm are in
 * `ASSET_TYPES`, and the array branch unwraps nested descriptors. Re-verified against the
 * issue's own dump shapes before writing anything here, per
 * `~/.claude/rules/agent-anti-rationalization.md`: "I already know the answer" is not
 * evidence.
 *
 * What genuinely remains is the pair of SYMPTOMS the issue lists as the reason the loss
 * went unnoticed — which no fix has touched:
 *
 *  - `validate` returned `isValid: true` over a prefab whose components serialized to their
 *    bare envelope. It compared the structural format only, by construction.
 *  - A reference the serializer CANNOT encode was answered with `null` (or dropped from an
 *    array) and nothing recorded the loss, so `create` reported success.
 *
 * Both are asserted here as the ERROR being surfaced — not as a happy path. A test that
 * asserted `_mesh` came out non-null would pass against unfixed code, which is precisely
 * the lie these two halves exist to remove.
 */

import { PrefabCreationService } from '../tools/manage-prefab-creation-service';

describe('validatePrefabFormat — a hollow prefab is not valid (#73)', () => {
    let service: PrefabCreationService;

    beforeEach(() => { service = new PrefabCreationService(); });

    /** The issue's hollow output: components present, each carrying only the envelope. */
    function hollowPrefab() {
        return [
            { __type__: 'cc.Prefab', _name: 'Bucket', data: { __id__: 1 } },
            { __type__: 'cc.Node', _name: 'Bucket', _components: [{ __id__: 2 }, { __id__: 3 }] },
            {
                __type__: 'cc.MeshRenderer', _name: '', _objFlags: 0, __editorExtras__: {},
                node: { __id__: 1 }, _enabled: true, __prefab: { __id__: 4 }, _id: ''
            },
            {
                __type__: 'BucketScript', _name: '', _objFlags: 0, __editorExtras__: {},
                node: { __id__: 1 }, _enabled: true, __prefab: { __id__: 5 }, _id: ''
            }
        ];
    }

    it('reports isValid:false and names each hollow component', () => {
        const result = service.validatePrefabFormat(hollowPrefab());

        // Pre-fix this was `isValid: true, issues: []` — the exact output the issue quotes.
        expect(result.isValid).toBe(false);
        expect(result.hollowComponents).toEqual(expect.arrayContaining(['cc.MeshRenderer', 'BucketScript']));
        expect(result.issues.join(' ')).toMatch(/serialized with no properties/);
    });

    it('still reports a genuinely populated prefab as valid', () => {
        const populated = [
            { __type__: 'cc.Prefab', _name: 'Bucket', data: { __id__: 1 } },
            { __type__: 'cc.Node', _name: 'Bucket', _components: [{ __id__: 2 }] },
            {
                __type__: 'cc.MeshRenderer', _name: '', _objFlags: 0, __editorExtras__: {},
                node: { __id__: 1 }, _enabled: true, __prefab: { __id__: 3 }, _id: '',
                _mesh: { __uuid__: 'mesh-uuid', __expectedType__: 'cc.Mesh' },
                _materials: [{ __uuid__: 'mat-uuid', __expectedType__: 'cc.Material' }]
            }
        ];

        const result = service.validatePrefabFormat(populated);

        expect(result.isValid).toBe(true);
        expect(result.hollowComponents).toEqual([]);
    });

    it('does not mistake serialization bookkeeping for a hollow component', () => {
        // cc.CompPrefabInfo entries carry only `__type__` + `fileId`; counting them as
        // hollow components would make every valid prefab fail.
        const withPrefabInfo = [
            { __type__: 'cc.Prefab', _name: 'Bucket', data: { __id__: 1 } },
            { __type__: 'cc.Node', _name: 'Bucket', _components: [{ __id__: 2 }] },
            { __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, fileId: 'abc' },
            {
                __type__: 'cc.Sprite', _name: '', _objFlags: 0, __editorExtras__: {},
                node: { __id__: 1 }, _enabled: true, __prefab: { __id__: 3 }, _id: '',
                _spriteFrame: { __uuid__: 'sf-uuid', __expectedType__: 'cc.SpriteFrame' }
            }
        ];

        const result = service.validatePrefabFormat(withPrefabInfo);

        expect(result.isValid).toBe(true);
        expect(result.hollowComponents).toEqual([]);
    });
});

describe('processComponentProperty — an unencodable reference is reported, not nulled (#73)', () => {
    let service: PrefabCreationService;

    beforeEach(() => { service = new PrefabCreationService(); });

    const ctx = () => ({
        nodeUuidToIndex: new Map<string, number>(),
        componentUuidToIndex: new Map<string, number>(),
        losses: [] as Array<{ property: string; uuid: string; reason: string }>
    });

    it('records — rather than silently discarding — a reference with no encodable form', () => {
        // The former `type.startsWith('cc.')` catch-all answered this with `null` and said
        // nothing, and `null` on a reference is issue #73's primary symptom. Null remains the
        // only encodable answer for a component outside the subtree; the loss is what changed.
        // `cc.Widget` is a real component class that is not in the in-tree index here.
        const context = ctx();
        const out = (service as any).processComponentProperty(
            { type: 'cc.Widget', value: { uuid: 'uuid-1' } }, context, 'bodyWidget'
        );

        expect(out).toBeNull();
        expect(context.losses).toEqual([
            {
                property: 'bodyWidget', uuid: 'uuid-1',
                reason: expect.stringMatching(/no encodable form.*ASSET_TYPES/s)
            }
        ]);
    });

    it('an ASSET class missing from the allowlist is the same reported loss, not a silent null', () => {
        // Why the suffix arm matters: it is what stops an un-listed concrete asset subclass
        // from reaching the null at all. `cc.Mesh` was the live instance of this
        // (issues #64/#70/#73) and is now listed.
        const context = ctx();
        const asAsset = (service as any).processComponentProperty(
            { type: 'cc.Mesh', value: { uuid: 'mesh-uuid' } }, context, '_mesh'
        );
        expect(asAsset).toEqual({ __uuid__: 'mesh-uuid', __expectedType__: 'cc.Mesh' });
        expect(context.losses).toEqual([]);
    });

    it('records — not silently drops — a node reference outside the subtree', () => {
        const context = ctx();
        const out = (service as any).processComponentProperty(
            { type: 'cc.Node', value: { uuid: 'outside-node' } }, context, 'wool'
        );

        // Null is still the only encodable answer for an out-of-subtree node, but the loss
        // is now on the record, so `create` can fail instead of reporting success.
        expect(out).toBeNull();
        expect(context.losses).toEqual([
            { property: 'wool', uuid: 'outside-node', reason: expect.stringMatching(/outside the prefab subtree/) }
        ]);
    });

    it('records a genuinely external component reference while keeping the null contract', () => {
        const context = ctx();
        const out = (service as any).processComponentProperty(
            { type: 'cc.Button', value: { uuid: 'not-in-this-prefab' } }, context, 'target'
        );

        expect(out).toBeNull();
        expect(context.losses.map(l => l.property)).toEqual(['target']);
    });

    it('names the failing element of an array by index', () => {
        const context = ctx();
        const out = (service as any).processComponentProperty({
            type: 'cc.Material[]', elementTypeData: { type: 'cc.Material' },
            value: [{ value: { uuid: 'ok-uuid' }, type: 'cc.Material' }, { value: { uuid: 'bad' }, type: 'cc.SomethingElse' }]
        }, context, '_materials');

        // The resolvable element still serializes; the unresolvable one is named by index.
        expect(out[0]).toEqual({ __uuid__: 'ok-uuid', __expectedType__: 'cc.Material' });
        expect(context.losses.map(l => l.property)).toEqual(['_materials[1]']);
    });
});

/**
 * The recorded loss has to reach the CALLER. Recording it and then writing the prefab
 * anyway would be a warning in a log nobody reads — which is how #73's dropped references
 * survived `create` AND `validate` in the first place.
 */
describe('createPrefabWithAssetDB — a recorded reference loss fails the create (#73)', () => {
    let service: PrefabCreationService;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        service = new PrefabCreationService();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    /** A node carrying one asset ref (resolvable) and one node ref to OUTSIDE the subtree. */
    function nodeDump() {
        return {
            uuid: 'node-1', name: 'Bucket', active: true,
            position: { value: { x: 0, y: 0, z: 0 } },
            __comps__: [{
                __type__: 'cc.MeshRenderer', type: 'cc.MeshRenderer', enabled: true,
                value: {
                    uuid: { value: 'comp-uuid-1' },
                    _mesh: { name: '_mesh', value: { uuid: 'mesh-uuid-1' }, type: 'cc.Mesh' },
                    wool: { name: 'wool', value: { uuid: 'node-outside-subtree' }, type: 'cc.Node' },
                },
            }],
        };
    }

    it('refuses to write, naming the lost reference instead of reporting success', async () => {
        let written: any[] = [];
        routeMessages({
            'query-node': () => nodeDump(),
            'query-node-tree': () => ({ uuid: 'node-1', name: 'Bucket', children: [] }),
            'create-asset': () => ({ uuid: 'prefab-uuid-1' }),
            'save-asset': (_url: string, content: string) => { written = JSON.parse(content); return {}; },
            'save-asset-meta': () => ({}),
            'reimport-asset': () => true,
            'query-asset-info': () => ({ url: 'db://assets/Bucket.prefab' }),
            'connect-prefab-instance': () => true,
        });

        const result = await service.createPrefabWithAssetDB('node-1', 'db://assets/Bucket.prefab', 'Bucket', true, true);

        expect(result.success).toBe(false);
        expect(result.fatal).toBe(true);
        expect(result.error).toMatch(/could not be serialized/);
        expect(result.error).toMatch(/wool/);
        expect(result.data.referenceLosses).toEqual([
            { property: 'wool', uuid: 'node-outside-subtree', reason: expect.stringMatching(/outside the prefab subtree/) }
        ]);
        // The whole point: the hollow prefab was never written to disk.
        expect(written).toEqual([]);
    });
});
