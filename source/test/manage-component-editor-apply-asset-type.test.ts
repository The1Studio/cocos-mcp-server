/**
 * Regression tests for issue #26 — the EDITOR-APPLY half of the fix.
 *
 * Accepting `propertyType: "material"` in convertPropertyValue is not sufficient on its own:
 * applyPropertyToEditor gates on its own list, and anything missing from that gate falls through
 * to the terminal `else`, which sends `dump: { value }` with NO `type` field — the same shape
 * that makes the nodeArray path fail (issue #18). So an accepted-but-ungated propertyType would
 * turn a clear error into a silent non-apply.
 */

import { applyPropertyToEditor, resolveAssetType } from '../tools/manage-component-editor-apply';

declare const global: any;

const baseArgs = {
    nodeUuid: 'node-uuid-1',
    propertyPath: '__comps__.0.someProp',
    rawComponentIndex: 0,
    componentType: 'MyScript',
    value: 'asset-uuid-1',
    processedValue: { uuid: 'asset-uuid-1' }
};

const getComponentInfo = jest.fn();
let requestMock: jest.Mock;

beforeEach(() => {
    requestMock = jest.fn().mockResolvedValue(undefined);
    global.Editor = { Message: { request: requestMock } };
    getComponentInfo.mockReset();
});

async function applyWith(propertyType: string, property: string) {
    await applyPropertyToEditor({ ...baseArgs, propertyType, property }, getComponentInfo);
    expect(requestMock).toHaveBeenCalledTimes(1);
    return requestMock.mock.calls[0][2];
}

describe('applyPropertyToEditor — asset dump carries an explicit type', () => {
    it('sends type cc.Material for propertyType "material" (issue #26)', async () => {
        const payload = await applyWith('material', 'obstacleEdgeMaterial');
        expect(payload.dump).toEqual({ value: { uuid: 'asset-uuid-1' }, type: 'cc.Material' });
    });

    it('resolves from the propertyType even when the property NAME lacks the keyword', async () => {
        // Pre-existing bug: the old name-only heuristic resolved this to cc.SpriteFrame.
        const payload = await applyWith('material', 'skin');
        expect(payload.dump.type).toBe('cc.Material');
    });

    it('never falls through to the typeless dump for any asset propertyType', async () => {
        const types: Array<[string, string]> = [
            ['material', 'cc.Material'], ['texture', 'cc.Texture2D'],
            ['spriteFrame', 'cc.SpriteFrame'], ['spriteAtlas', 'cc.SpriteAtlas'],
            ['prefab', 'cc.Prefab'], ['audioClip', 'cc.AudioClip'],
            ['font', 'cc.Font'], ['animationClip', 'cc.AnimationClip'],
            ['mesh', 'cc.Mesh'], ['skeleton', 'cc.Skeleton'],
            ['physicsMaterial', 'cc.PhysicsMaterial'], ['renderTexture', 'cc.RenderTexture'],
            ['textAsset', 'cc.TextAsset'], ['jsonAsset', 'cc.JsonAsset'],
            ['particleAsset', 'cc.ParticleAsset'], ['sceneAsset', 'cc.SceneAsset']
        ];
        for (const [propertyType, expected] of types) {
            requestMock.mockClear();
            const payload = await applyWith(propertyType, 'someRef');
            expect(payload.dump.type).toBe(expected);
        }
    });
});

describe('applyPropertyToEditor — existing callers are unaffected', () => {
    it('generic "asset" still uses the property-name heuristic', async () => {
        // This is the exact path verified live before the fix.
        const payload = await applyWith('asset', 'obstacleEdgeMaterial');
        expect(payload.dump).toEqual({ value: { uuid: 'asset-uuid-1' }, type: 'cc.Material' });
    });

    it('generic "asset" on an unhinted name still defaults to cc.SpriteFrame', async () => {
        const payload = await applyWith('asset', 'someRef');
        expect(payload.dump.type).toBe('cc.SpriteFrame');
    });

    it('bare "string" with an asset-ish name still routes to the asset branch', async () => {
        const payload = await applyWith('string', 'iconTexture');
        expect(payload.dump.type).toBe('cc.Texture2D');
    });
});

describe('resolveAssetType', () => {
    it('prefers the explicit propertyType over the property name', () => {
        expect(resolveAssetType('mesh', 'bodyMaterial')).toBe('cc.Mesh');
    });

    it('falls back to the name heuristic for generic spellings', () => {
        expect(resolveAssetType('asset', 'bgTexture')).toBe('cc.Texture2D');
        expect(resolveAssetType('string', 'titleFont')).toBe('cc.Font');
        expect(resolveAssetType('asset', 'plain')).toBe('cc.SpriteFrame');
    });
});
