import { ManageComponent } from '../tools/manage-component';
import { convertPropertyValue, describeScalarWriteToArrayProperty } from '../tools/manage-component-property-helpers';

/**
 * #76: `convertPropertyValue('boolean', "false")` was `Boolean("false") === true`. A transport
 * that stringifies arguments therefore wrote `true`; on a property already holding `true` the
 * read-back matched and the call reported `changeVerified: true` for a value never requested.
 *
 * #115: a single-value propertyType aimed at an array-typed property made the field vanish from
 * the component, unrecoverably. It is now refused before anything is sent.
 */
describe('boolean coercion (#76)', () => {
    it.each([
        [false, false], [true, true], ['false', false], ['true', true], ['FALSE', false],
        [' true ', true], ['0', false], ['1', true], [0, false], [1, true], [null, false]
    ])('converts %p to %p', (input, expected) => {
        expect(convertPropertyValue('boolean', input)).toBe(expected);
    });

    it.each([['maybe'], [{}], [[]], ['']])('refuses %p instead of coercing by truthiness', (input) => {
        expect(() => convertPropertyValue('boolean', input as any)).toThrow(/boolean value must be true\/false/);
    });
});

describe('scalar write over an array property (#115)', () => {
    const NODE = 'node-1';
    const COMP = 'BoardView';
    const dump = () => ({
        __comps__: [{
            __type__: COMP, type: COMP, enabled: true,
            value: {
                uuid: { value: 'comp-1' },
                vehiclePrefabs: { name: 'vehiclePrefabs', type: 'cc.Prefab', value: [] },
                title: { name: 'title', type: 'String', value: 'x' }
            }
        }]
    });

    it('describes the refusal only for a scalar propertyType over an array', () => {
        expect(describeScalarWriteToArrayProperty('asset', [], 'vehiclePrefabs')).toMatch(/is an ARRAY/);
        expect(describeScalarWriteToArrayProperty('prefab', [{}], 'vehiclePrefabs')).toMatch(/assetArray/);
        expect(describeScalarWriteToArrayProperty('assetArray', [], 'vehiclePrefabs')).toBeNull();
        expect(describeScalarWriteToArrayProperty('nodeArray', [], 'slots')).toBeNull();
        expect(describeScalarWriteToArrayProperty('asset', 'some-uuid', 'singleRef')).toBeNull();
    });

    it('refuses the write and sends nothing to the editor', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (_m: string, action: string) => (action === 'query-node' ? dump() : {}));

        const result = await new ManageComponent().execute('set_property', {
            nodeUuid: NODE, componentType: COMP, property: 'vehiclePrefabs', propertyType: 'asset', value: 'prefab-uuid'
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/is an ARRAY.*Nothing was written/s);
        expect(mockRequest.mock.calls.some((c: any[]) => c[1] === 'set-property')).toBe(false);
    });

    afterAll(() => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });
});
