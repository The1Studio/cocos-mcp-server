import { ManageComponent } from '../tools/manage-component';
import { applyPropertyToEditor, describeUnhandledPropertyType } from '../tools/manage-component-editor-apply';
import { convertPropertyValue, SUPPORTED_PROPERTY_TYPES } from '../tools/manage-component-property-helpers';

/**
 * #66: array-of-plain-object properties (cc.RealCurve `keyFrames`, cc.Gradient `alphaKeys`)
 * had no whole-array propertyType. `objectArray` writes them the way the editor accepts them
 * (element-wise): resize with `<array>.length`, then one typeless `{ value }` write per leaf
 * through dotted index paths. Read-back is compared element-by-element against what was
 * requested, so a write the editor ignored is reported as failed, never as verified.
 */
const KEYFRAMES = [
    { time: 0, value: 5, interpMode: 0 },
    { time: 1, value: 1, interpMode: 2 }
];

describe('objectArray conversion (#66)', () => {
    it('is an advertised propertyType', () => {
        expect(SUPPORTED_PROPERTY_TYPES).toContain('objectArray');
    });

    it('accepts an array and a JSON-string array of plain objects', () => {
        expect(convertPropertyValue('objectArray', KEYFRAMES)).toEqual(KEYFRAMES);
        expect(convertPropertyValue('objectArray', JSON.stringify(KEYFRAMES))).toEqual(KEYFRAMES);
    });

    it('accepts an empty array (clears the list)', () => {
        expect(convertPropertyValue('objectArray', [])).toEqual([]);
    });

    it('refuses a non-array', () => {
        expect(() => convertPropertyValue('objectArray', { time: 0 })).toThrow(/must be an array/);
    });

    it('refuses primitive elements', () => {
        expect(() => convertPropertyValue('objectArray', [1, 2])).toThrow(/plain objects/);
    });

    it('refuses reference-shaped elements and names the right propertyTypes', () => {
        expect(() => convertPropertyValue('objectArray', [{ uuid: 'abc' }])).toThrow(/nodeArray|assetArray/);
    });

    it('is no longer reported as unhandled', () => {
        expect(describeUnhandledPropertyType('objectArray', KEYFRAMES)).toBeNull();
    });
});

describe('applyPropertyToEditor objectArray (#66)', () => {
    let requestMock: jest.Mock;
    beforeEach(() => {
        requestMock = jest.fn().mockResolvedValue(undefined);
        (global as any).Editor = { Message: { request: requestMock } };
    });

    const base = {
        nodeUuid: 'n1', propertyPath: '__comps__.0.curve.keyFrames', rawComponentIndex: 0,
        componentType: 'cc.ParticleSystem', property: 'curve.keyFrames', propertyType: 'objectArray'
    };

    it('resizes the array then writes every leaf by dotted index path', async () => {
        await applyPropertyToEditor(
            { ...base, value: KEYFRAMES, processedValue: KEYFRAMES, originalValue: [] }, jest.fn()
        );

        const writes = requestMock.mock.calls.map(c => [c[2].path, c[2].dump]);
        expect(writes).toEqual([
            ['__comps__.0.curve.keyFrames.length', { value: 2 }],
            ['__comps__.0.curve.keyFrames.0.time', { value: 0 }],
            ['__comps__.0.curve.keyFrames.0.value', { value: 5 }],
            ['__comps__.0.curve.keyFrames.0.interpMode', { value: 0 }],
            ['__comps__.0.curve.keyFrames.1.time', { value: 1 }],
            ['__comps__.0.curve.keyFrames.1.value', { value: 1 }],
            ['__comps__.0.curve.keyFrames.1.interpMode', { value: 2 }]
        ]);
    });

    it('skips the resize when the array already has the requested length', async () => {
        await applyPropertyToEditor(
            { ...base, value: KEYFRAMES, processedValue: KEYFRAMES, originalValue: [{}, {}] }, jest.fn()
        );
        expect(requestMock.mock.calls.some(c => String(c[2].path).endsWith('.length'))).toBe(false);
    });

    it('recurses into nested objects and nested arrays', async () => {
        const nested = [{ color: { r: 1, g: 2 }, tags: [7, 8] }];
        await applyPropertyToEditor(
            { ...base, value: nested, processedValue: nested, originalValue: [] }, jest.fn()
        );
        const paths = requestMock.mock.calls.map(c => c[2].path.replace('__comps__.0.curve.keyFrames.', ''));
        expect(paths).toEqual(['length', '0.color.r', '0.color.g', '0.tags.length', '0.tags.0', '0.tags.1']);
    });
});

describe('ManageComponent set_property objectArray end to end (#66)', () => {
    const NODE = 'n1';
    const TYPE = 'cc.ParticleSystem';
    let comp: any;

    function leaf(v: any, type = 'Float') { return { value: v, type }; }
    function element() {
        return { type: 'cc.RealKeyframeValue', value: { time: leaf(0), value: leaf(0), interpMode: leaf(0) } };
    }

    /** Resolve a dotted editor path (after `__comps__.<i>.`) inside the mock component dump. */
    function walk(segments: string[]): { parent: any; key: string } {
        let node: any = comp.value;
        for (let i = 0; i < segments.length - 1; i++) {
            const seg = segments[i];
            node = Array.isArray(node) ? node[Number(seg)] : node[seg];
            if (node && !Array.isArray(node) && 'value' in node && typeof node.value === 'object') node = node.value;
        }
        return { parent: node, key: segments[segments.length - 1] };
    }

    function wire(honourWrites: boolean) {
        comp = {
            __type__: TYPE, type: TYPE, enabled: true,
            value: {
                uuid: leaf('c1', 'String'),
                curve: {
                    type: 'cc.RealCurve',
                    value: { keyFrames: { type: 'cc.RealKeyframeValue', isArray: true, value: [element(), element()] } }
                }
            }
        };
        const mockRequest = jest.fn().mockImplementation(async (_m: string, action: string, payload: any) => {
            if (action === 'query-node') return { __comps__: [comp] };
            if (action === 'set-property' && honourWrites) {
                const segs = payload.path.split('.').slice(2);
                const { parent, key } = walk(segs);
                if (key === 'length') {
                    const arr = parent.value ?? parent;
                    const target = Array.isArray(arr) ? arr : arr;
                    while (target.length < payload.dump.value) target.push(element());
                    target.length = payload.dump.value;
                } else if (Array.isArray(parent)) {
                    parent[Number(key)].value = payload.dump.value;
                } else {
                    parent[key].value = payload.dump.value;
                }
            }
            return {};
        });
        (global as any).Editor = { Message: { request: mockRequest } };
        return mockRequest;
    }

    const run = (value: any) => new ManageComponent().execute('set_property', {
        nodeUuid: NODE, componentType: TYPE, property: 'curve.keyFrames', propertyType: 'objectArray', value
    });

    afterAll(() => { (global as any).Editor = { Message: { request: jest.fn().mockResolvedValue({}) } }; });

    it('writes a longer curve and verifies it element by element', async () => {
        wire(true);
        const keys = [
            { time: 0, value: 5, interpMode: 0 },
            { time: 0.5, value: 20, interpMode: 2 },
            { time: 1, value: 1, interpMode: 0 }
        ];
        const result = await run(keys);

        expect(result.success).toBe(true);
        expect(result.data.changeVerified).toBe(true);
        expect(comp.value.curve.value.keyFrames.value).toHaveLength(3);
        expect(comp.value.curve.value.keyFrames.value[1].value.time.value).toBe(0.5);
    });

    it('reports failure, not success, when the editor ignores the writes', async () => {
        wire(false);
        const result = await run([{ time: 0, value: 9, interpMode: 0 }]);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/did not verify/);
    });
});
