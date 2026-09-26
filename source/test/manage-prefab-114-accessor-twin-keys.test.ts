import { PrefabCreationService } from '../tools/manage-prefab-creation-service';

/**
 * Regression tests for issue #114 defect 2 — `manage_prefab action=create` emitted
 * accessor-key duplicates for any component type the `DUMP_KEY_RENAMES` table does not
 * cover, producing a prefab Cocos Creator's asset importer rejects outright:
 *
 *     [Assets] Importer exec failed: {asset[...vfx_saber.prefab]}
 *     [Assets] Cannot read properties of undefined (reading '_name')  TypeError
 *
 * The mechanism: a `scene:query-node` dump carries BOTH spellings of an accessor-backed
 * field — the inspector accessor (`clips`, `defaultClip`, `sharedMaterials`) and the true
 * serialized field (`_clips`, `_defaultClip`, `_materials`). `createComponentObject`
 * passes every dump key through verbatim unless the type is in the rename table, so the
 * written component carried `clips` AND `_clips` as separate top-level keys with diverging
 * values. The originating report confirmed the fix shape empirically: stripping every
 * non-underscore key that has an underscore twin reproduced the key set of a hand-authored
 * prefab in the same project, and that prefab imported cleanly.
 *
 * These tests pin the FAILURE state — a duplicate accessor/underscore pair in the written
 * prefab — not the happy path, because `manage_prefab action=validate` reported
 * `isValid: true` on the broken file both before and after the manual repair.
 */

declare const global: any;

describe('PrefabCreationService — accessor/underscore twin keys (#114 defect 2)', () => {
    let service: PrefabCreationService;
    let mockRequest: jest.Mock;

    const BASE_KEYS = ['__type__', '_name', '_objFlags', '__editorExtras__', 'node', '_enabled', '__prefab', '_id'];

    function nodeDump(comps: any[]) {
        return {
            uuid: 'node-1',
            name: 'Saber',
            active: true,
            position: { value: { x: 0, y: 0, z: 0 } },
            __comps__: comps,
        };
    }

    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    async function createAndCapture(comps: any[]): Promise<{ result: any; written: any[] }> {
        let written: any[] = [];
        routeMessages({
            'query-node': () => nodeDump(comps),
            'query-node-tree': () => ({ uuid: 'node-1', name: 'Saber', children: [] }),
            'create-asset': () => ({ uuid: 'prefab-uuid-1' }),
            'save-asset': (_url: string, content: string) => { written = JSON.parse(content); return {}; },
            'save-asset-meta': () => ({}),
            'reimport-asset': () => true,
            'query-asset-info': () => ({ url: 'db://assets/Saber.prefab' }),
            'connect-prefab-instance': () => true,
        });

        const result = await service.createPrefabWithAssetDB('node-1', 'db://assets/Saber.prefab', 'Saber', true, true);
        // When the create-path guard refuses, it returns a fatal envelope and writes
        // nothing. Surface that verbatim: a bare `undefined` from findComponent would
        // otherwise read as a fixture mistake rather than "the guard fired".
        if (!result.success) {
            throw new Error(`createPrefabWithAssetDB refused: ${result.error}`);
        }
        return { result, written };
    }

    function findComponent(written: any[], type: string) {
        return written.find((entry: any) => entry && entry.__type__ === type);
    }

    /** Every key present in both spellings — the shape the importer rejects. */
    function duplicateAccessorKeys(component: any): string[] {
        return Object.keys(component).filter(
            key => !key.startsWith('_') && Object.prototype.hasOwnProperty.call(component, `_${key}`)
        );
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

    /** A `cc.Animation` dump: the type the report confirmed the defect on, with no table entry. */
    function animationComp() {
        return {
            __type__: 'cc.Animation',
            type: 'cc.Animation',
            enabled: true,
            value: {
                uuid: { value: 'comp-uuid-anim' },
                // The accessor keys and their serialized twins, exactly as the report
                // describes them (`clips` + `defaultClip` alongside `_clips` + `_defaultClip`).
                // Empty arrays so nothing here depends on the reference-encodability path
                // (#73), which is a different guard and would refuse the write first.
                clips: { name: 'clips', type: 'cc.AnimationClip', value: [] },
                _clips: { name: '_clips', type: 'cc.AnimationClip', value: [] },
                defaultClip: { name: 'defaultClip', type: 'cc.AnimationClip', value: null },
                _defaultClip: { name: '_defaultClip', type: 'cc.AnimationClip', value: null },
                playOnAwake: { name: 'playOnAwake', value: true, type: 'Boolean' },
                _playOnAwake: { name: '_playOnAwake', value: true, type: 'Boolean' },
            },
        };
    }

    it('does not emit an accessor key alongside its underscore twin (cc.Animation)', async () => {
        const { written } = await createAndCapture([animationComp()]);

        const anim = findComponent(written, 'cc.Animation');
        expect(anim).toBeDefined();
        // The defect: this was ['clips', 'defaultClip', 'playOnAwake'].
        expect(duplicateAccessorKeys(anim)).toEqual([]);
        // The serialized spelling is the one that must survive.
        expect(anim).toHaveProperty('_clips');
        expect(anim).toHaveProperty('_defaultClip');
        expect(anim).not.toHaveProperty('clips');
        expect(anim).not.toHaveProperty('defaultClip');
    });

    it('does not emit an accessor key alongside its underscore twin (cc.Sprite partial coverage)', async () => {
        // `cc.Sprite` IS in the rename table, but only for spriteFrame/type/sizeMode/fillType
        // — sharedMaterials/spriteAtlas/trim/grayscale fall through verbatim, which is the
        // "partial" half the report calls out.
        const { written } = await createAndCapture([{
            __type__: 'cc.Sprite',
            type: 'cc.Sprite',
            enabled: true,
            value: {
                uuid: { value: 'comp-uuid-sprite' },
                sharedMaterials: { name: 'sharedMaterials', type: 'cc.Material', value: [] },
                _materials: { name: '_materials', type: 'cc.Material', value: [] },
                trim: { name: 'trim', value: true, type: 'Boolean' },
                _isTrimmedMode: { name: '_isTrimmedMode', value: true, type: 'Boolean' },
            },
        }]);

        const sprite = findComponent(written, 'cc.Sprite');
        // `sharedMaterials`/`_materials` share a stem but are not a literal `_`-prefix pair,
        // so the literal-twin detector does not catch them — the rename table is what must.
        // What MUST hold is that no literal duplicate survives; that is the shape the
        // importer rejects.
        expect(duplicateAccessorKeys(sprite)).toEqual([]);
    });

    it('leaves a script component\'s declared fields untouched', async () => {
        // The twin invariant is an ENGINE-accessor artifact: a `@property _foo` on a script
        // serializes as `_foo` with no `foo` accessor in the dump. A script that genuinely
        // declares both `foo` and `_foo` must not have either dropped — the detector is
        // scoped to engine types for exactly this reason.
        const { written } = await createAndCapture([{
            __type__: 'ScoreController',
            type: 'ScoreController',
            enabled: true,
            value: {
                uuid: { value: 'comp-uuid-script' },
                score: { name: 'score', value: 10, type: 'Number' },
                _score: { name: '_score', value: 20, type: 'Number' },
            },
        }]);

        const script = findComponent(written, 'ScoreController');
        expect(script.score).toBe(10);
        expect(script._score).toBe(20);
    });

    it('keeps an accessor key that has NO underscore twin — the table still has to catch up', async () => {
        // Dropping a key with no serialized counterpart would lose the value entirely. The
        // twin check is a safety net for the both-present case, not a replacement for the
        // rename table; an accessor-only key still passes through verbatim.
        const { written } = await createAndCapture([{
            __type__: 'cc.Animation',
            type: 'cc.Animation',
            enabled: true,
            value: {
                uuid: { value: 'comp-uuid-anim' },
                clips: { name: 'clips', type: '[cc.AnimationClip]', value: [] },
            },
        }]);

        const anim = findComponent(written, 'cc.Animation');
        expect(anim).toHaveProperty('clips');
        expect(duplicateAccessorKeys(anim)).toEqual([]);
    });
});

describe('PrefabCreationService.validatePrefabFormat — reports accessor/underscore duplicates (#114 defect 2)', () => {
    let service: PrefabCreationService;

    beforeEach(() => {
        service = new PrefabCreationService();
    });

    /** A minimal well-formed prefab whose single component carries the duplicate pair. */
    function prefabWithComponent(component: any): any[] {
        return [
            { __type__: 'cc.Prefab', _name: 'Saber', data: { __id__: 1 }, optimizationPolicy: 0, persistent: false },
            { __type__: 'cc.Node', _name: 'Saber', _parent: null, _children: [], _components: [{ __id__: 2 }] },
            component,
        ];
    }

    it('flags a component carrying both `clips` and `_clips` as invalid', () => {
        const result = service.validatePrefabFormat(prefabWithComponent({
            __type__: 'cc.Animation', _name: '', _objFlags: 0, node: { __id__: 1 }, _enabled: true, __prefab: null,
            clips: [{ __uuid__: 'clip-uuid-1' }],
            _clips: [{ __uuid__: 'clip-uuid-1' }],
            _defaultClip: { __uuid__: 'clip-uuid-1' },
            defaultClip: { __uuid__: 'clip-uuid-1' },
        }));

        expect(result.isValid).toBe(false);
        expect(result.duplicateAccessorKeys.map(d => d.type)).toEqual(['cc.Animation']);
        expect(result.duplicateAccessorKeys[0].keys).toEqual(['clips', 'defaultClip']);
        // Named in `issues` too, so a caller reading only the human-readable list still sees it.
        expect(result.issues.join(' ')).toMatch(/clips/);
    });

    it('stays valid on the same component with the accessor twins removed', () => {
        // The positive control: the check must fire on the duplicate and NOT on the fixed
        // shape, or it would be a permanent red that tells a caller nothing.
        const result = service.validatePrefabFormat(prefabWithComponent({
            __type__: 'cc.Animation', _name: '', _objFlags: 0, node: { __id__: 1 }, _enabled: true, __prefab: null,
            _clips: [{ __uuid__: 'clip-uuid-1' }],
            _defaultClip: { __uuid__: 'clip-uuid-1' },
            _playOnAwake: true,
        }));

        expect(result.duplicateAccessorKeys).toEqual([]);
        expect(result.isValid).toBe(true);
    });

    it('does not flag a script component declaring both a field and its underscore sibling', () => {
        const result = service.validatePrefabFormat(prefabWithComponent({
            __type__: 'ScoreController', _name: '', _objFlags: 0, node: { __id__: 1 }, _enabled: true, __prefab: null,
            score: 10,
            _score: 20,
        }));

        expect(result.duplicateAccessorKeys).toEqual([]);
        expect(result.isValid).toBe(true);
    });
});

/**
 * The create-path guard. This one is a DIFFERENCE check — captured scene dump versus
 * emitted prefab — because the obvious re-run of `validatePrefabFormat(prefabContent)` is
 * unfireable: it applies `findAccessorTwinKeys` to output the emission filter already
 * applied the identical predicate to, so it stays green no matter what (confirmed by
 * neutering that branch and watching the suite stay at 7/7).
 *
 * These tests pin both directions, which is the only thing that makes the guard evidence
 * of anything: it must FIRE when an accessor key reaches the output beside its twin, and
 * stay SILENT on the repaired shape.
 */
describe('PrefabCreationService.findCapturedAccessorTwins — create-path guard (#114 defect 2)', () => {
    let service: PrefabCreationService;

    beforeEach(() => {
        service = new PrefabCreationService();
    });

    /** A captured node whose single `cc.Animation` component carries the twin pair. */
    function capturedNode(props: Record<string, any>) {
        return {
            uuid: 'node-1', name: 'Saber', components: [
                { type: 'cc.Animation', __type__: 'cc.Animation', properties: props },
            ], children: [],
        };
    }

    /** The emitted prefab for that node, with `emittedKeys` as the component's top-level keys. */
    function emittedPrefab(emittedKeys: Record<string, any>): any[] {
        return [
            { __type__: 'cc.Prefab', _name: 'Saber', data: { __id__: 1 } },
            { __type__: 'cc.Node', _name: 'Saber', _parent: null, _children: [], _components: [{ __id__: 2 }] },
            { __type__: 'cc.Animation', _name: '', node: { __id__: 1 }, ...emittedKeys },
        ];
    }

    it('fires when the accessor key survives into the emitted prefab alongside its twin', () => {
        // The failure mode: emission emitted `clips` AND `_clips`, and the importer rejects
        // the file. The guard must catch that from the output side, not trust the filter.
        const result = service.findCapturedAccessorTwins(
            capturedNode({
                clips: { name: 'clips', value: [] },
                _clips: { name: '_clips', value: [] },
            }),
            emittedPrefab({ clips: [], _clips: [] }),
        );

        expect(result.map(r => r.type)).toEqual(['cc.Animation']);
        expect(result[0].keys).toContain('clips');
    });

    it('stays silent on the repaired shape — the guard is not a permanent red', () => {
        // Same capture, but the emission filter did its job: only the underscore spelling.
        const result = service.findCapturedAccessorTwins(
            capturedNode({
                clips: { name: 'clips', value: [] },
                _clips: { name: '_clips', value: [] },
            }),
            emittedPrefab({ _clips: [] }),
        );

        expect(result).toEqual([]);
    });

    it('stays silent when the capture had no twins at all', () => {
        const result = service.findCapturedAccessorTwins(
            capturedNode({ _clips: { name: '_clips', value: [] } }),
            emittedPrefab({ _clips: [] }),
        );

        expect(result).toEqual([]);
    });

    it('does not fire on a script component declaring both spellings', () => {
        // Same scoping invariant as the filter: a script's `score`/`_score` are two real
        // fields, and reporting them would block a legitimate write.
        const node = {
            uuid: 'node-1', name: 'Root', children: [],
            components: [{ type: 'ScoreController', properties: { score: 10, _score: 20 } }],
        };
        const result = service.findCapturedAccessorTwins(node, emittedPrefab({ score: 10, _score: 20 }));

        expect(result).toEqual([]);
    });
});
