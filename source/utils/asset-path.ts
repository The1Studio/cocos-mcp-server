/**
 * Asset-db path resolution.
 *
 * `asset-db:query-asset-meta` resolves to an `IAssetMeta`
 * (`ver` / `importer` / `imported` / `uuid` / `files` / `subMetas` / `userData` /
 * `displayName` / `id` / `name`) — it carries NEITHER `url` NOR `file`. Reading
 * `meta.url` therefore yields `undefined`, and forwarding the coerced `''` to
 * `asset-db:query-path` makes Cocos Creator 3.8.7 reject the call with a bare
 * `parameter error` (#25).
 *
 * `asset-db:query-asset-info` is the message that carries `url`, `file`, `importer`
 * and `type`, so every on-disk path lookup must go through it.
 */

export interface ResolvedAsset {
    /** Absolute path on disk, or null when it could not be determined. */
    filePath: string | null;
    /** `db://` url, or null when unknown. */
    url: string | null;
    /** Raw `AssetInfo` from `query-asset-info`, or null when the asset is unknown. */
    info: any | null;
    /**
     * Names the stage that failed, so callers surface which step rejected instead of
     * collapsing every failure into one opaque message.
     */
    error: string | null;
}

export async function resolveAsset(urlOrUuid: string): Promise<ResolvedAsset> {
    if (!urlOrUuid) {
        return { filePath: null, url: null, info: null, error: 'asset reference is empty' };
    }

    let info: any = null;
    try {
        info = await Editor.Message.request('asset-db', 'query-asset-info', urlOrUuid);
    } catch (err: any) {
        return {
            filePath: null, url: null, info: null,
            error: `query-asset-info rejected '${urlOrUuid}': ${err?.message || err}`
        };
    }
    if (!info) {
        return { filePath: null, url: null, info: null, error: `Asset not found in the asset DB: ${urlOrUuid}` };
    }

    const url: string | null = info.url || null;
    if (info.file) return { filePath: info.file, url, info, error: null };

    // Some importers omit `file`; fall back to an explicit path lookup on the url.
    if (url) {
        try {
            const filePath = await Editor.Message.request('asset-db', 'query-path', url) as string | null;
            if (filePath) return { filePath, url, info, error: null };
        } catch (err: any) {
            return { filePath: null, url, info, error: `query-path rejected '${url}': ${err?.message || err}` };
        }
    }

    return { filePath: null, url, info, error: null };
}
