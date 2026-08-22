import { convertPropertyValue, ASSET_REFERENCE_PROPERTY_TYPES, SUPPORTED_PROPERTY_TYPES } from '../tools/manage-component-property-helpers';

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
