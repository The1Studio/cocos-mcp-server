import { PrefabCreationService } from '../tools/manage-prefab-creation-service';

/**
 * #28 — `manage_prefab action=create` saved node structure but serialized every
 * component's properties as empty, then reported success.
 *
 * Two defects: the `query-node` dump was reduced to type/uuid/enabled before
 * serialization, and the only branch that wrote arbitrary properties was gated on the
 * key that reduction removed. Types with a hardcoded branch (UITransform / Sprite /
 * Button / Label) were worse — they wrote fabricated defaults, so the prefab looked
 * populated.
 */
describe('PrefabCreationService — component property capture (#28)', () => {
    let service: PrefabCreationService;
    let mockRequest: jest.Mock;

    /** Envelope keys a component carries even when it holds no properties. */
    const BASE_KEYS = ['__type__', '_name', '_objFlags', '__editorExtras__', 'node', '_enabled', '__prefab', '_id'];

    /** A `scene:query-node` dump: `__comps__[i].value` is the live property map. */
    function nodeDump(comps: any[]) {
        return {
            uuid: 'node-1',
            name: 'Emitter',
            active: true,
            position: { value: { x: 0, y: 0, z: 0 } },
            __comps__: comps,
        };
    }

    function particleSystemComp() {
        return {
            __type__: 'cc.ParticleSystem2D',
            type: 'cc.ParticleSystem2D',
            enabled: true,
            value: {
                uuid: { value: 'comp-uuid-1' },
                duration: { name: 'duration', value: -1, type: 'Number' },
                emissionRate: { name: 'emissionRate', value: 42, type: 'Number' },
                totalParticles: { name: 'totalParticles', value: 350, type: 'Number' },
                life: { name: 'life', value: 2.5, type: 'Number' },
                startSize: { name: 'startSize', value: 12, type: 'Number' },
                startColor: {
                    name: 'startColor', type: 'cc.Color',
                    value: { r: 10, g: 20, b: 30, a: 200 },
                },
            },
        };
    }

    /** Routes by message name so a wrong call order cannot pass by accident. */
    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    /** Drive `createPrefabWithAssetDB` and hand back the JSON it wrote. */
    async function createAndCapture(comps: any[]): Promise<{ result: any; written: any[] }> {
        let written: any[] = [];
        routeMessages({
            'query-node': () => nodeDump(comps),
            'query-node-tree': () => ({ uuid: 'node-1', name: 'Emitter', children: [] }),
            'create-asset': () => ({ uuid: 'prefab-uuid-1' }),
            'save-asset': (_url: string, content: string) => { written = JSON.parse(content); return {}; },
            'save-asset-meta': () => ({}),
            'reimport-asset': () => true,
            // No `file` and no query-path handler: the read-back falls to the in-memory
            // content, which is exactly what the check must still be able to verify.
            'query-asset-info': () => ({ url: 'db://assets/Emitter.prefab' }),
            'connect-prefab-instance': () => true,
        });

        const result = await service.createPrefabWithAssetDB('node-1', 'db://assets/Emitter.prefab', 'Emitter', true, true);
        return { result, written };
    }

    function findComponent(written: any[], type: string) {
        return written.find((entry: any) => entry && entry.__type__ === type);
    }

    beforeEach(() => {
        service = new PrefabCreationService();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('serializes the live values of an un-special-cased engine component', async () => {
        const { result, written } = await createAndCapture([particleSystemComp()]);

        expect(result.success).toBe(true);
        const particle = findComponent(written, 'cc.ParticleSystem2D');
        expect(particle).toBeDefined();
        // The bug: this component previously landed on disk carrying BASE_KEYS only.
        expect(Object.keys(particle).filter(k => !BASE_KEYS.includes(k)).length).toBeGreaterThan(0);
        expect(particle.emissionRate).toBe(42);
        expect(particle.totalParticles).toBe(350);
        expect(particle.life).toBe(2.5);
        expect(particle.startColor).toEqual({ __type__: 'cc.Color', r: 10, g: 20, b: 30, a: 200 });
    });

    it('captures a script component\'s declared fields', async () => {
        const { result, written } = await createAndCapture([{
            __type__: 'ScoreController',
            type: 'ScoreController',
            enabled: true,
            value: {
                uuid: { value: 'comp-uuid-2' },
                startingScore: { name: 'startingScore', value: 250, type: 'Number' },
                title: { name: 'title', value: 'Round 1', type: 'String' },
            },
        }]);

        expect(result.success).toBe(true);
        const script = findComponent(written, 'ScoreController');
        expect(script.startingScore).toBe(250);
        expect(script.title).toBe('Round 1');
    });

    it('flattens a nested CCClass group instead of writing editor descriptors', async () => {
        const { written } = await createAndCapture([{
            __type__: 'CameraRig', type: 'CameraRig', enabled: true,
            value: {
                cameraSection: {
                    name: 'cameraSection', type: 'CameraSection',
                    value: {
                        fov: { name: 'fov', value: 60, type: 'Number' },
                        smoothing: { name: 'smoothing', value: 0.25, type: 'Number' },
                    },
                },
            },
        }]);

        const rig = findComponent(written, 'CameraRig');
        expect(rig.cameraSection).toEqual({ __type__: 'CameraSection', fov: 60, smoothing: 0.25 });
    });

    it('writes the captured Label text, not the hardcoded "Label" default', async () => {
        const { written } = await createAndCapture([{
            __type__: 'cc.Label',
            type: 'cc.Label',
            enabled: true,
            value: {
                _string: { name: 'string', value: 'Score: 42', type: 'String' },
                _fontSize: { name: 'fontSize', value: 36, type: 'Number' },
            },
        }]);

        const label = findComponent(written, 'cc.Label');
        expect(label._string).toBe('Score: 42');
        expect(label._fontSize).toBe(36);
        // Untouched engine defaults still fill the gaps.
        expect(label._verticalAlign).toBe(1);
    });

    it('writes the captured UITransform size, not the hardcoded 100x100 default', async () => {
        const { written } = await createAndCapture([{
            __type__: 'cc.UITransform',
            type: 'cc.UITransform',
            enabled: true,
            value: {
                contentSize: { name: 'contentSize', type: 'cc.Size', value: { width: 640, height: 128 } },
                anchorPoint: { name: 'anchorPoint', type: 'cc.Vec2', value: { x: 0, y: 1 } },
            },
        }]);

        const transform = findComponent(written, 'cc.UITransform');
        expect(transform._contentSize).toEqual({ __type__: 'cc.Size', width: 640, height: 128 });
        expect(transform._anchorPoint).toEqual({ __type__: 'cc.Vec2', x: 0, y: 1 });
        // The public dump name must not leak into the serialized asset.
        expect(transform).not.toHaveProperty('contentSize');
    });

    it('falls back to engine defaults when the dump carries no value for a key', async () => {
        const { written } = await createAndCapture([{
            __type__: 'cc.UITransform', type: 'cc.UITransform', enabled: true, value: {},
        }]);

        const transform = findComponent(written, 'cc.UITransform');
        expect(transform._contentSize).toEqual({ __type__: 'cc.Size', width: 100, height: 100 });
        expect(transform._anchorPoint).toEqual({ __type__: 'cc.Vec2', x: 0.5, y: 0.5 });
    });

    it('fails instead of reporting success when a configured component serializes empty', async () => {
        let written: any[] = [];
        routeMessages({
            'query-node': () => nodeDump([particleSystemComp()]),
            'query-node-tree': () => ({ uuid: 'node-1', name: 'Emitter', children: [] }),
            'create-asset': () => ({ uuid: 'prefab-uuid-1' }),
            'save-asset': (_url: string, content: string) => { written = JSON.parse(content); return {}; },
            'save-asset-meta': () => ({}),
            'reimport-asset': () => true,
            // The asset on disk came back stripped — the exact #28 symptom.
            'query-asset-info': () => ({ url: 'db://assets/Emitter.prefab' }),
            'connect-prefab-instance': () => true,
        });
        jest.spyOn(service as any, 'readBackPrefab').mockResolvedValue({
            source: 'disk',
            data: [
                { __type__: 'cc.Prefab' },
                { __type__: 'cc.Node', _name: 'Emitter' },
                {
                    __type__: 'cc.ParticleSystem2D', _name: '', _objFlags: 0, __editorExtras__: {},
                    node: { __id__: 1 }, _enabled: true, __prefab: { __id__: 7 }, _id: '',
                },
            ],
        });

        const result = await service.createPrefabWithAssetDB('node-1', 'db://assets/Emitter.prefab', 'Emitter', true, true);

        expect(result.success).toBe(false);
        expect(result.fatal).toBe(true);
        expect(result.error).toMatch(/serialized with no properties/i);
        expect(result.data.componentsWithoutProperties).toContain('cc.ParticleSystem2D');
        expect(written.length).toBeGreaterThan(0);
    });

    it('does not demand properties for a component that genuinely had none', async () => {
        const { result } = await createAndCapture([{
            __type__: 'cc.Canvas', type: 'cc.Canvas', enabled: true, value: {},
        }]);

        expect(result.success).toBe(true);
    });
});

/**
 * Font assets were serialized as null on every cc.Label.
 *
 * `processComponentProperty` recognises an asset by an allowlist of type names, and the list
 * carried `cc.Font` but not its concrete subclasses — the dump for a Label's font reports
 * `cc.TTFFont`. Missing the asset branch, the value fell through to the component-reference
 * branch, whose catch-all is `type.startsWith('cc.')`. That matched, the uuid was not in the
 * component index, and the branch returned null "external ref". The prefab then loaded with no
 * font while the same node in the scene rendered correctly.
 */
describe('PrefabCreationService — font and other concrete asset types', () => {
    let service: PrefabCreationService;

    beforeEach(() => { service = new PrefabCreationService(); });

    const ref = (type: string, uuid: string) => ({ type, value: { uuid } });
    const call = (p: any) => (service as any).processComponentProperty(p, {
        nodeUuidToIndex: new Map(), componentUuidToIndex: new Map(),
    });

    it('serializes a cc.TTFFont reference as an asset, not a dangling component ref', () => {
        const out = call(ref('cc.TTFFont', '9f8ec1aa-affd-420e-8868-22e9e88bb581'));
        expect(out).not.toBeNull();
        expect(out.__uuid__).toBe('9f8ec1aa-affd-420e-8868-22e9e88bb581');
        expect(out.__expectedType__).toBe('cc.TTFFont');
    });

    it('serializes cc.BitmapFont and cc.LabelAtlas the same way', () => {
        for (const t of ['cc.BitmapFont', 'cc.LabelAtlas']) {
            const out = call(ref(t, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'));
            expect(out).not.toBeNull();
            expect(out.__expectedType__).toBe(t);
        }
    });

    it('keeps serializing the asset types that already worked', () => {
        const out = call(ref('cc.SpriteFrame', '16800020-83e2-48fa-9f23-f89779c630af@f9941'));
        expect(out.__expectedType__).toBe('cc.SpriteFrame');
        expect(out.__uuid__).toContain('@f9941');
    });

    it('still nulls a genuinely external component reference', () => {
        expect(call(ref('cc.Button', 'not-in-this-prefab'))).toBeNull();
    });

    // Measured against this project's 46 editor-authored .prefab/.scene files: all 560 asset
    // `__uuid__` values are full uuids and none is compressed. A compressed uuid resolves to
    // nothing, and the defect hid behind the sprite-frame case, whose 37-char sub-asset uuid
    // the old compressor skipped over.
    it('writes a plain asset uuid verbatim rather than compressing it', () => {
        for (const t of ['cc.TTFFont', 'cc.Texture2D', 'cc.Material', 'cc.AudioClip']) {
            expect(call(ref(t, '9f8ec1aa-affd-420e-8868-22e9e88bb581')).__uuid__)
                .toBe('9f8ec1aa-affd-420e-8868-22e9e88bb581');
        }
    });

    it('writes an array of asset references with full uuids too', () => {
        const out = (service as any).processComponentProperty({
            type: 'cc.SpriteFrame[]',
            elementTypeData: { type: 'cc.SpriteFrame' },
            value: [{ uuid: '0498a60a-90e8-4334-bd55-db75c722d651@f9941' },
                { uuid: 'dd255c32-1d56-4ed6-9d1e-8396d22210a3' }],
        }, { nodeUuidToIndex: new Map(), componentUuidToIndex: new Map() });

        expect(out.map((e: any) => e.__uuid__)).toEqual([
            '0498a60a-90e8-4334-bd55-db75c722d651@f9941',
            'dd255c32-1d56-4ed6-9d1e-8396d22210a3',
        ]);
    });

    /**
     * `cc.MeshRenderer.sharedMaterials`/`_materials` array items are NESTED property
     * descriptors — `{ value: { uuid }, type: 'cc.Material', ... }` — verified live against
     * Cocos Creator 3.8.7 (`manage_component action=get_info` on a smart-imported FBX's
     * MeshRenderer). The old code read `item.uuid` (flat), which matches nothing on this
     * shape, so a MeshRenderer with an assigned material serialized `_materials: []` /
     * `sharedMaterials: []` on every created prefab while `manage_prefab create` reported
     * `success: true`.
     */
    it('unwraps a nested-descriptor material array item instead of dropping it', () => {
        const out = (service as any).processComponentProperty({
            type: 'cc.Material[]',
            elementTypeData: { type: 'cc.Material' },
            value: [{ value: { uuid: 'f25bd87e-18d7-4acb-a941-0f0ff6d766f4' }, type: 'cc.Material' }],
        }, { nodeUuidToIndex: new Map(), componentUuidToIndex: new Map() });

        expect(out).toEqual([{ __uuid__: 'f25bd87e-18d7-4acb-a941-0f0ff6d766f4', __expectedType__: 'cc.Material' }]);
    });

    it('unwraps a nested-descriptor node array item the same way', () => {
        const nodeUuidToIndex = new Map([['node-uuid-1', 5]]);
        const out = (service as any).processComponentProperty({
            type: 'cc.Node[]',
            elementTypeData: { type: 'cc.Node' },
            value: [{ value: { uuid: 'node-uuid-1' }, type: 'cc.Node' }],
        }, { nodeUuidToIndex, componentUuidToIndex: new Map() });

        expect(out).toEqual([{ __id__: 5 }]);
    });
});

/**
 * A script component on the ROOT node referencing a component (MeshRenderer, Label)
 * that lives on a DESCENDANT node — e.g. `@property(MeshRenderer) bodyRenderer` dragged
 * to a child mesh three levels down. Reproduces the live symptom: `manage_prefab
 * action=create` wrote `bodyRenderer: null` / `ammoLabel: null` while reporting
 * `success: true`, even though the referenced components exist inside the very same
 * prefab and their scene node references (bedAnchor/labelMount) serialize correctly.
 *
 * `getNodeWithChildren` builds its working tree from `query-node-tree` — a uuid/name/
 * children skeleton with NO `__comps__` — then `enhanceTreeWithMCPComponents` re-queries
 * each node individually via `query-node` to attach real component data. Every prior
 * test in this file mocks `query-node` with `mockResolvedValueOnce`/a single dump that
 * ignores the requested uuid, so it never exercised more than one real node. Routing
 * `query-node` per-uuid (as this suite is the first to do) is what actually reproduces
 * the defect a flat single-node mock cannot.
 */
describe('PrefabCreationService — cross-node component reference (bodyRenderer/ammoLabel null)', () => {
    let service: PrefabCreationService;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        service = new PrefabCreationService();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
    });

    it('resolves a root script property that references a descendant node\'s component', async () => {
        const nodeTree = {
            uuid: 'root-uuid', name: 'bus-4',
            children: [
                { uuid: 'body-uuid', name: 'FourSeater_Body', children: [] },
                { uuid: 'label-uuid', name: 'label', children: [] },
            ],
        };

        const dumps: Record<string, any> = {
            'root-uuid': {
                uuid: 'root-uuid', name: { value: 'bus-4' },
                __comps__: [{
                    __type__: 'TruckView', type: 'TruckView', enabled: true,
                    value: {
                        uuid: { value: 'truckview-comp-uuid' },
                        bodyRenderer: { name: 'bodyRenderer', type: 'cc.MeshRenderer', value: { uuid: 'meshrenderer-comp-uuid' } },
                        ammoLabel: { name: 'ammoLabel', type: 'cc.Label', value: { uuid: 'label-comp-uuid' } },
                    },
                }],
            },
            // Per `manage-prefab-creation-service-transform.test.ts` (issue #50), the raw
            // `scene:query-node` dump carries the component's own uuid as a TOP-LEVEL
            // `uuid: { value }` field — this is what `enhanceTreeWithMCPComponents` reads
            // (`comp.uuid?.value`) into `nodeData.components[i].uuid`, and what
            // `createCompleteNodeTree` indexes into `componentUuidToIndex`. `value` holds
            // the separate property-dump map `extractComponentPropertyDump` reads.
            'body-uuid': {
                uuid: 'body-uuid', name: { value: 'FourSeater_Body' },
                __comps__: [{ __type__: 'cc.MeshRenderer', type: 'cc.MeshRenderer', enabled: true, uuid: { value: 'meshrenderer-comp-uuid' }, value: {} }],
            },
            'label-uuid': {
                uuid: 'label-uuid', name: { value: 'label' },
                __comps__: [{ __type__: 'cc.Label', type: 'cc.Label', enabled: true, uuid: { value: 'label-comp-uuid' }, value: {} }],
            },
        };

        let written: any[] = [];
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (_pkg: string, message: string, ...args: any[]) => {
            if (message === 'query-node-tree') return nodeTree;
            if (message === 'query-node') return dumps[args[0]] || { uuid: args[0] };
            if (message === 'create-asset') return { uuid: 'prefab-uuid-1' };
            if (message === 'save-asset') { written = JSON.parse(args[1]); return {}; }
            if (message === 'save-asset-meta') return {};
            if (message === 'reimport-asset') return true;
            if (message === 'query-asset-info') return { url: 'db://assets/Truck.prefab' };
            if (message === 'connect-prefab-instance') return true;
            throw new Error(`unexpected message: ${message}`);
        });

        const result = await service.createPrefabWithAssetDB('root-uuid', 'db://assets/Truck.prefab', 'Truck', true, true);

        expect(result.success).toBe(true);
        const truckView = written.find((e: any) => e && e.__type__ === 'TruckView');
        expect(truckView).toBeDefined();
        expect(truckView.bodyRenderer).not.toBeNull();
        expect(truckView.ammoLabel).not.toBeNull();
        const meshRenderer = written.find((e: any) => e && e.__type__ === 'cc.MeshRenderer');
        const label = written.find((e: any) => e && e.__type__ === 'cc.Label');
        const meshRendererIndex = written.indexOf(meshRenderer);
        const labelIndex = written.indexOf(label);
        expect(truckView.bodyRenderer).toEqual({ __id__: meshRendererIndex });
        expect(truckView.ammoLabel).toEqual({ __id__: labelIndex });
    });
});
