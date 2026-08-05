import { convertPropertyValue, ASSET_REFERENCE_PROPERTY_TYPES } from '../tools/manage-component-property-helpers';

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
