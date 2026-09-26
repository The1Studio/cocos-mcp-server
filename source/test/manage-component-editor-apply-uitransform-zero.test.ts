/**
 * Regression tests for issue #114 — the falsy-zero coalesce in
 * `applyPropertyToEditor`'s `cc.UITransform` branches.
 *
 * `Number(value.x) || 0.5` cannot distinguish an explicit, entirely legal `0` from
 * `undefined`/`NaN`: `Number(0) || 0.5` evaluates to `0.5`, so the caller's value is
 * replaced by the type default and the write silently reverts one component. The
 * originating report pinned this with a `{x: 0.0001}` control that verifies fine —
 * that control is reproduced here as its own case, because it is the positive
 * evidence that the defect is a falsy-zero coalesce and NOT an editor-side clamp.
 *
 * These assertions deliberately pin the FAILURE state on `origin/main`: the `0` cases
 * go red there and green after the explicit-undefined/NaN guard lands.
 */

import { applyPropertyToEditor } from '../tools/manage-component-editor-apply';

declare const global: any;

let requestMock: jest.Mock;

beforeEach(() => {
    requestMock = jest.fn().mockResolvedValue(undefined);
    global.Editor = { Message: { request: requestMock } };
});

/**
 * Drive the UITransform branch and return the values actually sent to the editor, in
 * call order. The branch issues one `set-property` per component (width/height, or
 * anchorX/anchorY), so the payloads must be read as a list, not as "the one call".
 */
async function sentValues(property: string, value: any): Promise<number[]> {
    // Read only the calls THIS invocation made — a test that drives two writes in a row
    // would otherwise see the first one's payloads appended to the second's.
    const callsBefore = requestMock.mock.calls.length;

    await applyPropertyToEditor({
        nodeUuid: 'node-uuid-1',
        propertyPath: '__comps__.0.anchorPoint',
        rawComponentIndex: 0,
        componentType: 'cc.UITransform',
        property,
        propertyType: 'vec2',
        value,
        processedValue: value,
    }, jest.fn());

    return requestMock.mock.calls
        .slice(callsBefore)
        .filter((call: any[]) => call[1] === 'set-property')
        .map((call: any[]) => call[2].dump.value);
}

describe('applyPropertyToEditor — cc.UITransform anchorPoint preserves a legal zero (#114)', () => {
    it('writes x:0 instead of coalescing it to the 0.5 default', async () => {
        const values = await sentValues('anchorPoint', { x: 0, y: 0.5094 });

        expect(values).toEqual([0, 0.5094]);
        // Spelled separately so a regression names the failing component, not just a
        // mismatched array.
        expect(values[0]).toBe(0);
        expect(values[1]).toBe(0.5094);
    });

    it('writes x:0 through the private _anchorPoint alias too', async () => {
        // The originating report hit the same failure through the underscore spelling.
        expect(await sentValues('_anchorPoint', { x: 0, y: 1 })).toEqual([0, 1]);
    });

    it('writes y:0, not just x:0 — the coalesce is per-component', async () => {
        expect(await sentValues('anchorPoint', { x: 0.5, y: 0 })).toEqual([0.5, 0]);
    });

    it('keeps the 0.0001 control green — the defect is a falsy-zero coalesce, not a clamp', async () => {
        // Positive control from the report: a truthy near-zero already survives, which is
        // what rules out an editor-side clamp and pins the cause to `|| 0.5`.
        expect(await sentValues('anchorPoint', { x: 0.0001, y: 0.5094 })).toEqual([0.0001, 0.5094]);
    });

    it('still substitutes the default when the component is genuinely absent', async () => {
        // The fallback must survive the fix — only the *explicit zero* case changes.
        expect(await sentValues('anchorPoint', {})).toEqual([0.5, 0.5]);
        expect(await sentValues('anchorPoint', { x: undefined, y: null })).toEqual([0.5, 0.5]);
    });

    it('still substitutes the default for an unparseable (NaN) component', async () => {
        expect(await sentValues('anchorPoint', { x: 'abc', y: 0.5 })).toEqual([0.5, 0.5]);
    });
});

describe('applyPropertyToEditor — cc.UITransform contentSize preserves a legal zero (#114)', () => {
    it('writes width:0 instead of coalescing it to the 100 default', async () => {
        expect(await sentValues('contentSize', { width: 0, height: 128 })).toEqual([0, 128]);
    });

    it('writes height:0 too', async () => {
        expect(await sentValues('contentSize', { width: 640, height: 0 })).toEqual([640, 0]);
    });

    it('still substitutes 100 when a dimension is absent', async () => {
        expect(await sentValues('contentSize', {})).toEqual([100, 100]);
    });
});
