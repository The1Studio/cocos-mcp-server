/**
 * Resolve the uuid `scene:create-node` can actually instantiate (issue #117).
 *
 * A raw model asset (`.fbx` / `.gltf`) is not instantiable itself: Cocos 3.8 stores the
 * instantiable hierarchy as a sub-asset of the model with importer `gltf-scene`, addressed
 * `<model-uuid>@<subMetaId>`. Handing the model's own uuid to `create-node` returns a uuid and
 * `success`, but the node carries no mesh, children or components. This resolves the model uuid
 * to its `gltf-scene` sub-asset uuid, and refuses outright when the model has none, so an empty
 * node is never reported as an instantiated model.
 */

/** Importers whose top-level asset must be redirected to its `gltf-scene` sub-asset. */
const MODEL_IMPORTERS = ['fbx', 'gltf'];

export interface ResolvedInstantiableAsset {
    uuid: string;
    /** Set when the input was a model and was redirected: the original model uuid. */
    resolvedFrom?: string;
    /** The `query-asset-info` record for the uuid, when one was read — lets the caller skip a second lookup. */
    info?: any;
}

export async function resolveInstantiableAssetUuid(assetUuid: string, knownInfo?: any): Promise<ResolvedInstantiableAsset> {
    // A sub-asset address is already the instantiable form.
    if (!assetUuid || assetUuid.includes('@')) return { uuid: assetUuid };

    let info: any = knownInfo;
    if (!info) {
        try {
            info = await Editor.Message.request('asset-db', 'query-asset-info', assetUuid);
        } catch {
            return { uuid: assetUuid }; // advisory lookup: never block a create on it
        }
    }
    const importer = String(info?.importer || '').toLowerCase();
    if (!MODEL_IMPORTERS.includes(importer)) return { uuid: assetUuid, info };

    const meta: any = await Editor.Message.request('asset-db', 'query-asset-meta', assetUuid);
    const subMetas: Record<string, any> = meta?.subMetas || {};
    for (const [subId, sub] of Object.entries(subMetas)) {
        if (sub?.importer === 'gltf-scene') {
            return { uuid: sub.uuid || `${assetUuid}@${subId}`, resolvedFrom: assetUuid };
        }
    }
    throw new Error(
        `Asset '${assetUuid}' is a ${importer} model with no 'gltf-scene' sub-asset, so it cannot be instantiated. ` +
        `Re-import the asset (manage_asset reimport) and retry, or pass the '<uuid>@<subId>' of the sub-asset to instantiate.`
    );
}
