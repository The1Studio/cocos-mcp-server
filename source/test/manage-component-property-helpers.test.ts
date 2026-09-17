import { convertPropertyValue, ASSET_REFERENCE_PROPERTY_TYPES, SUPPORTED_PROPERTY_TYPES, verifyComponentPropertyChange } from '../tools/manage-component-property-helpers';

/**
 * Tests for convertPropertyValue's asset-reference coercion (issue #26).
 * `propertyType: "material"` (and other common Cocos asset-reference types) previously
 * threw "Unsupported property type: material" even though these all serialize identically
 * to `{ uuid }`, same as the existing `spriteFrame` / `prefab` / `asset` cases.
 */
describe('convertPropertyValue — asset-reference propertyTypes', () => {
    const UUID = 'abc-123-def-456';

    it('coerces material to { uuid }', () => {
        expect(convertPropertyValue('material', UUID)).toEqual({ uuid: UUID });
    });

    it.each([
        'texture', 'spriteAtlas', 'audioClip', 'font', 'animationClip',
        'mesh', 'skeleton', 'physicsMaterial', 'renderTexture',
        'textAsset', 'jsonAsset', 'particleAsset', 'sceneAsset'
    ])('coerces %s to { uuid }', (propertyType) => {
        expect(convertPropertyValue(propertyType, UUID)).toEqual({ uuid: UUID });
    });

    // Regression guard — pre-existing asset-ref types must keep behaving exactly as before.
    it.each(['spriteFrame', 'prefab', 'asset'])('still coerces pre-existing type %s to { uuid }', (propertyType) => {
        expect(convertPropertyValue(propertyType, UUID)).toEqual({ uuid: UUID });
    });

    it('throws when material value is not a string UUID', () => {
        expect(() => convertPropertyValue('material', { not: 'a string' }))
            .toThrow('material value must be a string UUID');
    });

    it('every declared asset-reference type round-trips through the same constant used by the fix', () => {
        for (const propertyType of ASSET_REFERENCE_PROPERTY_TYPES) {
            expect(convertPropertyValue(propertyType, UUID)).toEqual({ uuid: UUID });
        }
    });

    it('throws an actionable error listing supported types for a genuinely unknown propertyType', () => {
        expect(() => convertPropertyValue('bogusType', UUID)).toThrow(/Unsupported property type: bogusType/);
        try {
            convertPropertyValue('bogusType', UUID);
            fail('expected convertPropertyValue to throw');
        } catch (error: any) {
            // The message must name at least material (the reported gap) and a non-asset type,
            // proving the list is genuinely comprehensive rather than just the asset group.
            expect(error.message).toContain('material');
            expect(error.message).toContain('string');
        }
    });
});

// Regression: issue #18 — there was no way to set an array of component references
// (only a single one via propertyType "component"). convertPropertyValue's half of
// the fix mirrors "component": each item stays a plain node-UUID string, resolved to
// a component id later by applyPropertyToEditor / applyComponentReferenceArray.
describe('convertPropertyValue — componentArray propertyType (issue #18)', () => {
    it('keeps each item as a string node UUID', () => {
        expect(convertPropertyValue('componentArray', ['node-a', 'node-b'])).toEqual(['node-a', 'node-b']);
    });

    it('accepts an empty array', () => {
        expect(convertPropertyValue('componentArray', [])).toEqual([]);
    });

    it('throws when an item is not a string', () => {
        expect(() => convertPropertyValue('componentArray', [123])).toThrow(/must be string node UUIDs/);
    });

    it('throws when the value itself is not an array', () => {
        expect(() => convertPropertyValue('componentArray', 'not-an-array')).toThrow(/must be an array/);
    });

    it('is included in SUPPORTED_PROPERTY_TYPES', () => {
        expect(SUPPORTED_PROPERTY_TYPES).toContain('componentArray');
    });
});

// Regression: issue #52 — set_property rejected a valid cc.Size (and other object/array
// -shaped propertyTypes) whenever the value arrived as a JSON-encoded string rather than
// a parsed object, even though set_properties_batch accepted the byte-identical value
// because its schema keeps `properties` nested under `items: { type: 'object' }` and so
// never gets stringified by a transport in the first place. convertPropertyValue must
// treat both spellings identically.
describe('convertPropertyValue — JSON-string values for object/array propertyTypes (issue #52)', () => {
    it('accepts a JSON-string size identically to an already-parsed object', () => {
        const expected = { width: 94, height: 94 };
        expect(convertPropertyValue('size', '{"width":94,"height":94}')).toEqual(expected);
        expect(convertPropertyValue('size', { width: 94, height: 94 })).toEqual(expected);
    });

    it('accepts a JSON-string vec2 identically to an already-parsed object', () => {
        const expected = { x: 1, y: 2 };
        expect(convertPropertyValue('vec2', '{"x":1,"y":2}')).toEqual(expected);
        expect(convertPropertyValue('vec2', { x: 1, y: 2 })).toEqual(expected);
    });

    it('accepts a JSON-string vec3 identically to an already-parsed object', () => {
        const expected = { x: 1, y: 2, z: 3 };
        expect(convertPropertyValue('vec3', '{"x":1,"y":2,"z":3}')).toEqual(expected);
        expect(convertPropertyValue('vec3', { x: 1, y: 2, z: 3 })).toEqual(expected);
    });

    it('accepts a JSON-string color object, and still accepts a hex-string color unchanged', () => {
        expect(convertPropertyValue('color', '{"r":255,"g":0,"b":0}')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
        expect(convertPropertyValue('color', '#FF0000')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('accepts a JSON-string array for nodeArray/numberArray/stringArray/colorArray', () => {
        expect(convertPropertyValue('nodeArray', '["node-a","node-b"]')).toEqual([{ uuid: 'node-a' }, { uuid: 'node-b' }]);
        expect(convertPropertyValue('numberArray', '[1,2,3]')).toEqual([1, 2, 3]);
        expect(convertPropertyValue('stringArray', '["a","b"]')).toEqual(['a', 'b']);
        expect(convertPropertyValue('colorArray', '[{"r":255,"g":0,"b":0}]')).toEqual([{ r: 255, g: 0, b: 0, a: 255 }]);
    });

    it('still rejects a non-object, non-JSON-object size value, and names the actual received type', () => {
        expect(() => convertPropertyValue('size', 'not-json'))
            .toThrow(/Size value must be an object with width, height properties \(received typeof string\)/);
        expect(() => convertPropertyValue('size', 42))
            .toThrow(/received typeof number/);
    });

    it('still rejects a non-array, non-JSON-array numberArray value, and names the actual received type', () => {
        // The received value is a string (a JSON OBJECT string, not an array string) — the
        // error names the type of what was actually passed in, before any JSON parsing.
        expect(() => convertPropertyValue('numberArray', '{"not":"an array"}'))
            .toThrow(/NumberArray value must be an array \(received typeof string\)/);
        expect(() => convertPropertyValue('numberArray', { not: 'an array' }))
            .toThrow(/NumberArray value must be an array \(received typeof object\)/);
    });
});

// Regression: issue #75 — neither `null` nor `""` could clear a node/component/asset
// reference. `node` and the asset-reference types already forwarded `""` unrejected
// (it happens to satisfy `typeof value === 'string'`), but rejected `null` outright;
// `component`/`componentArray` forwarded `""` UNRESOLVED instead of treating it as "no
// reference", which then failed downstream in applyPropertyToEditor with a confusing
// "neither a node uuid nor a component uuid" error. A cleared single reference always
// serializes as `{ uuid: '' }` — the same shape a set reference uses.
describe('convertPropertyValue — clearing a reference (issue #75)', () => {
    it('clears a node reference on both null and ""', () => {
        expect(convertPropertyValue('node', null)).toEqual({ uuid: '' });
        expect(convertPropertyValue('node', '')).toEqual({ uuid: '' });
    });

    it('clears a component reference on both null and ""', () => {
        expect(convertPropertyValue('component', null)).toEqual({ uuid: '' });
        expect(convertPropertyValue('component', '')).toEqual({ uuid: '' });
    });

    it('clears every asset-reference propertyType on both null and ""', () => {
        for (const propertyType of ASSET_REFERENCE_PROPERTY_TYPES) {
            expect(convertPropertyValue(propertyType, null)).toEqual({ uuid: '' });
            expect(convertPropertyValue(propertyType, '')).toEqual({ uuid: '' });
        }
    });

    it('clears a componentArray to an empty array on both null and ""', () => {
        expect(convertPropertyValue('componentArray', null)).toEqual([]);
        expect(convertPropertyValue('componentArray', '')).toEqual([]);
    });
});

// Regression: issue #73 (secondary finding) — verifyComponentPropertyChange's
// reference-comparison branch had `verified = actualUuid === expectedUuid && expectedUuid
// !== ''`, which made `verified` ALWAYS false when the EXPECTED uuid was empty — even
// when the clear genuinely succeeded and actualUuid === expectedUuid === ''. This directly
// blocks issue #75: clearing a reference would always report as an unverified failure.
describe('verifyComponentPropertyChange — clearing a reference verifies correctly (issue #73/#75)', () => {
    const NODE_UUID = 'node-1';
    const COMP_TYPE = 'GameBootstrap';
    const PROPERTY = 'heroDrag';

    function getComponentInfoReturning(actualValue: any) {
        return jest.fn().mockResolvedValue({
            success: true,
            data: { properties: { [PROPERTY]: { name: PROPERTY, value: actualValue, type: 'HeroDragController' } } }
        });
    }

    it('reports verified=true when a cleared reference reads back with an empty uuid', async () => {
        const result = await verifyComponentPropertyChange(
            NODE_UUID, COMP_TYPE, PROPERTY, { uuid: 'old-uuid' }, { uuid: '' },
            getComponentInfoReturning({ uuid: '' })
        );
        expect(result.verified).toBe(true);
    });

    // The guard's original intent must survive: a missing/undefined actual value against
    // a NON-EMPTY expected uuid must still fail verification — dropping the trailing
    // clause must not turn every reference comparison into a pass.
    it('still reports verified=false when the actual value is missing and expected uuid is non-empty', async () => {
        const result = await verifyComponentPropertyChange(
            NODE_UUID, COMP_TYPE, PROPERTY, { uuid: '' }, { uuid: 'new-uuid' },
            getComponentInfoReturning(undefined)
        );
        expect(result.verified).toBe(false);
    });
});
