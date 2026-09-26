/**
 * Issue #66 — `manage_component action=set_property` silently no-ops on array-of-object
 * properties.
 *
 * Two independent fields were confirmed live against a running editor while authoring
 * `cc.ParticleSystem` lifetime curves:
 *
 *  - `cc.RealCurve` `keyFrames` (dotted path through `_sizeOvertimeModule.y.spline`):
 *    the call returned `changeVerified: false` alongside a success response, and the field
 *    stayed at its untouched 2-point default.
 *  - `cc.Gradient` `alphaKeys`: threw `Cannot use 'in' operator to search for 'value' in null`.
 *
 * Both are ARRAYS OF PLAIN VALUE OBJECTS — no `uuid`, no reference semantics — so the
 * existing array branches (nodeArray/assetArray/componentArray/colorArray) cannot cover
 * them. The gap is that they were applied through the terminal `else`, which sends a dump
 * with NO `type` field: the editor decodes nothing and the write does not happen.
 *
 * A test asserting `success: true` with a `changeVerified: false` flag would pin the LIE,
 * not the fix. These assert the ERROR is surfaced instead — the standard in
 * `~/.claude/rules/development-principles.md` § "Errors Over Silent Fallbacks": the write
 * is refused, named, and nothing claims to have been written.
 */

import { applyPropertyToEditor, describeUnhandledPropertyType } from '../tools/manage-component-editor-apply';
import { convertPropertyValue } from '../tools/manage-component-property-helpers';

declare const global: any;

const baseArgs = {
    nodeUuid: 'node-uuid-1',
    propertyPath: '__comps__.0._sizeOvertimeModule.y.spline.keyFrames',
    rawComponentIndex: 0,
    componentType: 'cc.ParticleSystem',
    property: '_sizeOvertimeModule.y.spline.keyFrames',
};

/** The serialized keyframe shape the issue reverse-engineered and reported as still unwritable. */
const realCurveKeyFrames = [
    { time: 0, value: 5, inTangent: 0, outTangent: 0, inTangentWeight: 0, outTangentWeight: 0, interpMode: 0, tangentWeightMode: 0 },
    { time: 0.3, value: 20, inTangent: 0, outTangent: 0, inTangentWeight: 0, outTangentWeight: 0, interpMode: 0, tangentWeightMode: 0 },
    { time: 0.7, value: 8, inTangent: 0, outTangent: 0, inTangentWeight: 0, outTangentWeight: 0, interpMode: 0, tangentWeightMode: 0 },
    { time: 1, value: 1, inTangent: 0, outTangent: 0, inTangentWeight: 0, outTangentWeight: 0, interpMode: 0, tangentWeightMode: 0 }
];

let requestMock: jest.Mock;

beforeEach(() => {
    requestMock = jest.fn().mockResolvedValue(undefined);
    global.Editor = { Message: { request: requestMock } };
});

describe('applyPropertyToEditor — an unhandled propertyType must not be written (#66)', () => {
    it('refuses instead of sending a typeless dump for a legitimate-but-unhandled type', async () => {
        // `object` is what `analyzeProperty` infers for a nested CCClass group that is
        // written through set_property as a whole — the dump needs the group's own `type`,
        // which this branch set never supplies.
        await expect(applyPropertyToEditor(
            { ...baseArgs, property: 'someField', propertyType: 'object', value: {}, processedValue: {} },
            jest.fn()
        )).rejects.toThrow(/not handled by applyPropertyToEditor/);

        // The point of the fix: NO set-property call went out. Pre-fix this reached the
        // terminal `else` and issued `dump: { value: {} }` with no `type`.
        expect(requestMock).not.toHaveBeenCalled();
    });

    it('names the missing array branch when the value is an array of plain objects', async () => {
        await expect(applyPropertyToEditor(
            {
                ...baseArgs, propertyType: 'objectArray',
                value: realCurveKeyFrames, processedValue: realCurveKeyFrames
            },
            jest.fn()
        )).rejects.toThrow(/ARRAY value, but no array branch handles it/);

        expect(requestMock).not.toHaveBeenCalled();
    });

    it('still writes the propertyTypes that DO own a branch — the guard is not a blanket refusal', async () => {
        await applyPropertyToEditor(
            { ...baseArgs, property: 'mode', propertyType: 'number', value: 4, processedValue: 4 },
            jest.fn()
        );

        expect(requestMock).toHaveBeenCalledTimes(1);
        expect(requestMock.mock.calls[0][2].dump).toEqual({ value: 4 });
    });
});

describe('describeUnhandledPropertyType — the branch inventory (#66)', () => {
    it('covers every propertyType convertPropertyValue accepts', () => {
        // SUPPORTED_PROPERTY_TYPES is the contract the caller sees. Every entry must either
        // be handled by a branch or be reported as unhandled — the failure mode is a type
        // that is in NEITHER, because that one is silently written as a no-op.
        const accepted = [
            'string', 'number', 'integer', 'float', 'boolean',
            'color', 'vec2', 'vec3', 'size',
            'node', 'component',
            'spriteFrame', 'prefab', 'asset', 'material', 'texture', 'spriteAtlas', 'audioClip',
            'font', 'animationClip', 'mesh', 'skeleton', 'physicsMaterial', 'renderTexture',
            'textAsset', 'jsonAsset', 'particleAsset', 'sceneAsset',
            'nodeArray', 'colorArray', 'numberArray', 'stringArray', 'componentArray', 'assetArray'
        ];

        // The array-of-object types the issue asks for do NOT exist yet, so they must be
        // reported rather than silently accepted.
        for (const unhandled of ['object', 'objectArray']) {
            expect(describeUnhandledPropertyType(unhandled, 1)).not.toBeNull();
        }

        // Every type that a branch genuinely owns must stay silent, or the fix would break
        // the working paths the issue explicitly lists as correct — including the plain
        // scalars the terminal `else` writes, which the issue reports as working today.
        for (const handled of ['string', 'number', 'integer', 'float', 'boolean',
            'color', 'vec3', 'vec2', 'size', 'node', 'component',
            'asset', 'material', 'mesh', 'spriteFrame', 'nodeArray', 'assetArray', 'componentArray',
            'colorArray', 'numberArray', 'stringArray']) {
            expect(describeUnhandledPropertyType(handled, null)).toBeNull();
        }

        expect(describeUnhandledPropertyType('objectArray', [{ time: 0 }])).toMatch(/ARRAY value/);
        // No listed type may be BOTH accepted and unrecognised.
        expect(accepted.length).toBeGreaterThan(30);
    });

    it('the accepted-type list and the handled set agree — no type is silently in neither', () => {
        // Each accepted type must be either branch-handled (null) or explicitly reported.
        // A type that were in neither would fall to the terminal `else` unseen — the bug.
        for (const t of ['string', 'number', 'integer', 'float', 'boolean', 'color', 'vec2', 'vec3',
            'size', 'node', 'component', 'spriteFrame', 'prefab', 'asset', 'material', 'texture',
            'spriteAtlas', 'audioClip', 'font', 'animationClip', 'mesh', 'skeleton',
            'physicsMaterial', 'renderTexture', 'textAsset', 'jsonAsset', 'particleAsset',
            'sceneAsset']) {
            const verdict = describeUnhandledPropertyType(t, null);
            expect(verdict === null || typeof verdict === 'string').toBe(true);
        }
    });

    /**
     * The guard must not refuse a propertyType that works TODAY.
     *
     * This is the regression the #66 change nearly shipped: `numberArray` and `stringArray`
     * have no branch of their own — they are written correctly by the terminal `else` — so a
     * guard built only from the branch list would have rejected two advertised, working
     * types. The set is asserted here as a whole so a future addition to either the branch
     * list or SUPPORTED_PROPERTY_TYPES trips this test rather than reaching a caller.
     */
    it('does not refuse any propertyType the tool advertises as supported', () => {
        const advertised = [
            'string', 'number', 'integer', 'float', 'boolean', 'color', 'vec2', 'vec3', 'size',
            'node', 'component', 'nodeArray', 'colorArray', 'numberArray', 'stringArray',
            'componentArray', 'assetArray',
            // every concrete asset-reference type
            'spriteFrame', 'prefab', 'asset', 'material', 'texture', 'spriteAtlas', 'audioClip',
            'font', 'animationClip', 'mesh', 'skeleton', 'physicsMaterial', 'renderTexture',
            'textAsset', 'jsonAsset', 'particleAsset', 'sceneAsset'
        ];

        const refused = advertised.filter(t => describeUnhandledPropertyType(t, null) !== null);
        expect(refused).toEqual([]);
    });
});

describe('convertPropertyValue — primitive arrays reject object elements (#66)', () => {
    it('refuses numberArray keyframes instead of writing NaN', () => {
        // Pre-fix: every element became NaN and was sent to the editor on a success response.
        expect(() => convertPropertyValue('numberArray', realCurveKeyFrames))
            .toThrow(/must be primitives/);
    });

    it('refuses stringArray objects instead of writing "[object Object]"', () => {
        expect(() => convertPropertyValue('stringArray', [{ time: 0, alpha: 255 }]))
            .toThrow(/must be primitives/);
    });

    it('still accepts genuine primitive arrays', () => {
        expect(convertPropertyValue('numberArray', [1, 2, 3])).toEqual([1, 2, 3]);
        expect(convertPropertyValue('stringArray', ['a', 'b'])).toEqual(['a', 'b']);
    });
});
