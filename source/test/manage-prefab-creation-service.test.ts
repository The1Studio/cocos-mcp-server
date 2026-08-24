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
