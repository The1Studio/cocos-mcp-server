/**
 * Extract asset UUIDs out of a Cocos Creator editor property dump.
 *
 * Component dumps nest arbitrarily: a property is `{ name, value, type }`, CCClass groups
 * hold another property map under `value`, and array properties describe their element
 * type under `elementTypeData`.
 *
 * Harvesting is deliberately conservative — a uuid is collected only from a descriptor the
 * dump explicitly types as an asset. Node and component references carry uuids too, but
 * those are scene-local and resolve against nothing in the asset DB, so treating them as
 * asset references would make a missing-asset scan report false positives.
 */

const ASSET_TYPES = new Set([
    'cc.Asset', 'cc.SpriteFrame', 'cc.SpriteAtlas', 'cc.Texture2D', 'cc.TextureCube',
    'cc.RenderTexture', 'cc.Material', 'cc.EffectAsset', 'cc.Mesh', 'cc.Prefab',
    'cc.SceneAsset', 'cc.AnimationClip', 'cc.AudioClip', 'cc.VideoClip',
    'cc.Font', 'cc.TTFFont', 'cc.BitmapFont', 'cc.LabelAtlas',
    'cc.JsonAsset', 'cc.TextAsset', 'cc.BufferAsset', 'cc.PhysicsMaterial',
    'cc.ParticleAsset', 'cc.TiledMapAsset', 'cc.Skeleton',
    'sp.SkeletonData', 'dragonBones.DragonBonesAsset', 'dragonBones.DragonBonesAtlasAsset',
]);

const MAX_DEPTH = 32;

export function collectAssetUuids(dump: any): string[] {
    const found = new Set<string>();
    walk(dump, found, new Set(), 0);
    return [...found];
}

function walk(node: any, found: Set<string>, seen: Set<any>, depth: number): void {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH || seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
        for (const item of node) walk(item, found, seen, depth + 1);
        return;
    }

    if (isAssetDescriptor(node)) {
        harvest(node.value, found);
        return;
    }

    for (const child of Object.values(node)) walk(child, found, seen, depth + 1);
}

function isAssetDescriptor(node: any): boolean {
    if (typeof node.type === 'string' && ASSET_TYPES.has(node.type)) return true;
    if (typeof node.elementTypeData?.type === 'string' && ASSET_TYPES.has(node.elementTypeData.type)) return true;
    return Array.isArray(node.extends) && node.extends.includes('cc.Asset');
}

function harvest(value: any, found: Set<string>): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        for (const item of value) harvest(item, found);
        return;
    }
    for (const key of ['uuid', '__uuid__']) {
        const uuid = value[key];
        if (typeof uuid === 'string' && uuid.length > 0) found.add(uuid);
    }
}
