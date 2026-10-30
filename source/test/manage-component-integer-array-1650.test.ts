import { ManageComponent } from '../tools/manage-component';
import { convertPropertyValue } from '../tools/manage-component-property-helpers';
import { normalizeVec4 } from '../utils/normalize';

/**
 * #1650: `manage_component action=set_property` with `propertyType: 'numberArray'` on a
 * `@property([CCInteger])` field (evidence: `Pa22GameRoot.pointsPerSize`) fails with
 * `Cannot use 'in' operator to search for '<key>' in <non-object>`.
 *
 * `normalizeVec4` is the only unguarded `in` on the value path: it tests
 * `parsed && typeof parsed === 'object'`, which a plain NUMBER passes, and then evaluates
 * `'r' in parsed`. Any route that hands a scalar to it throws a raw TypeError instead of a
 * typed, actionable message — so a wrong `propertyType` on an integer array surfaces as a
 * JavaScript internal error, not "use numberArray".
 */
describe('numberArray on a [CCInteger] property (#1650)', () => {
    const NODE = 'node-uuid';
    const POINTS_PER_SIZE = [4, 3, 3, 2];

    /** A `@property([CCInteger])` dump as `query-node` reports it inside `__comps__`. */
    const integerArrayComponentDump = () => ({
        type: 'pa22GameRoot-cid',
        value: {
            uuid: { value: 'component-uuid' },
            name: { value: 'GameRoot<Pa22GameRoot>' },
            pointsPerSize: { type: 'Number', value: POINTS_PER_SIZE }
        }
    });

    let tool: ManageComponent;
    let requestMock: jest.Mock;

    beforeEach(() => {
        tool = new ManageComponent();
        requestMock = (global as any).Editor.Message.request as jest.Mock;
        requestMock.mockReset();
        requestMock.mockImplementation((_domain: string, message: string) => {
            if (message === 'query-node') {
                return Promise.resolve({ uuid: NODE, __comps__: [integerArrayComponentDump()] });
            }
            if (message === 'set-property') return Promise.resolve(true);
            return Promise.resolve(undefined);
        });
    });

    describe('conversion', () => {
        it('accepts a plain number array unchanged', () => {
            expect(convertPropertyValue('numberArray', POINTS_PER_SIZE)).toEqual(POINTS_PER_SIZE);
        });

        it('accepts a JSON-string array of numbers', () => {
            expect(convertPropertyValue('numberArray', JSON.stringify(POINTS_PER_SIZE))).toEqual(POINTS_PER_SIZE);
        });

        it('coerces numeric strings to numbers', () => {
            expect(convertPropertyValue('numberArray', ['4', '3', '3', '2'])).toEqual(POINTS_PER_SIZE);
        });

        it('refuses a bare scalar with an actionable error, not a raw TypeError', () => {
            let thrown: any;
            try {
                convertPropertyValue('numberArray', 4);
            } catch (err: any) {
                thrown = err;
            }
            expect(thrown).toBeDefined();
            expect(thrown.message).toMatch(/must be an array/i);
            expect(thrown.message).not.toMatch(/in operator/i);
        });
    });

    describe('normalizeVec4 guard (the `in`-operator site)', () => {
        it('returns undefined for a plain number instead of throwing', () => {
            expect(() => normalizeVec4(4)).not.toThrow();
            expect(normalizeVec4(4)).toBeUndefined();
        });

        it('returns undefined for a boolean and for a numeric string', () => {
            expect(() => normalizeVec4(true)).not.toThrow();
            expect(normalizeVec4(true)).toBeUndefined();
            expect(() => normalizeVec4('4')).not.toThrow();
            expect(normalizeVec4('4')).toBeUndefined();
        });

        it('still reads a real color object and a real color tuple', () => {
            expect(normalizeVec4({ r: 255, g: 128, b: 0, a: 255 })).toEqual({ x: 255, y: 128, z: 0, w: 255 });
            expect(normalizeVec4([1, 2, 3, 4])).toEqual({ x: 1, y: 2, z: 3, w: 4 });
        });
    });

    describe('set_property end to end', () => {
        it('reports a valid numberArray write on a [CCInteger] property as SUCCESS', async () => {
            const result = await tool.execute('set_property', {
                nodeUuid: NODE,
                componentType: 'pa22GameRoot-cid',
                property: 'pointsPerSize',
                propertyType: 'numberArray',
                value: POINTS_PER_SIZE
            });

            // The editor read-back equals what was requested, so the write must verify.
            // On main it does not: verifyComponentPropertyChange sends every array down the
            // reference-array branch, where extractUuid(4) === '' makes verified always false,
            // and the caller sees "expected [4,3,3,2] but the editor reads back [4,3,3,2]".
            expect(result.success).toBe(true);
            expect(String(result.error ?? '')).not.toMatch(/did not verify/i);
        });

        it('does not claim the read-back differs when it equals what was written', async () => {
            const result = await tool.execute('set_property', {
                nodeUuid: NODE,
                componentType: 'pa22GameRoot-cid',
                property: 'pointsPerSize',
                propertyType: 'numberArray',
                value: POINTS_PER_SIZE
            });

            // The absurd shape this bug produces: the message quotes the SAME array twice.
            expect(String(result.error ?? '')).not.toMatch(
                /expected \[4,3,3,2\] but the editor reads back \[4,3,3,2\]/
            );
        });

        it('writes the whole array in one set-property call on the array path', async () => {
            await tool.execute('set_property', {
                nodeUuid: NODE,
                componentType: 'pa22GameRoot-cid',
                property: 'pointsPerSize',
                propertyType: 'numberArray',
                value: POINTS_PER_SIZE
            });

            const writeCalls = requestMock.mock.calls.filter((c: any[]) => c[1] === 'set-property');
            expect(writeCalls.length).toBeGreaterThan(0);
            expect(writeCalls[0][2].path).toBe('__comps__.0.pointsPerSize');
        });
    });
});
