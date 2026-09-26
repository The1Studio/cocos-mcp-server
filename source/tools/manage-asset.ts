import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Returns true if the path is safe for asset operations.
 * Rejects traversal patterns and bare absolute paths (non-db:// form).
 */
function validateAssetPath(assetPath: string): boolean {
    if (!assetPath || typeof assetPath !== 'string') return false;
    // Allow db:// protocol paths (Cocos asset DB format)
    if (assetPath.startsWith('db://')) return true;
    // Reject traversal patterns in any form
    if (assetPath.includes('..') || assetPath.startsWith('/') || assetPath.includes('\\..')) return false;
    // Must start with assets/ for relative paths
    return assetPath.startsWith('assets/');
}

function escapeCsvField(field: string): string {
    if (typeof field !== 'string') return String(field);
    // Escape formula injection prefixes
    if (/^[=+\-@\t\r]/.test(field)) field = "'" + field;
    // Wrap in quotes if contains comma, quote or newline
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
}

/**
 * Importer names for asset kinds whose serialized file is not text — writing an
 * arbitrary string over one of these (via `save`) would corrupt it rather than update
 * it. Kept alongside the extension check below since not every asset lookup returns an
 * `importer` (#99 item 1).
 */
const BINARY_IMPORTER_NAMES = new Set([
    'image', 'texture', 'texture-cube', 'erp-texture-cube', 'sprite-frame',
    'audio-clip', 'video-clip', 'ttf-font', 'bitmap-font',
    'dragonbones', 'dragonbones-atlas', 'spine-data',
    'gltf', 'gltf-mesh', 'gltf-material', 'gltf-embeded-image', 'gltf-scene', 'fbx', 'buffer'
]);

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tga', '.psd', '.webp',
    '.mp3', '.ogg', '.wav', '.m4a', '.ttf', '.otf', '.fnt',
    '.fbx', '.obj', '.dae', '.glb', '.gltf', '.mp4', '.webm'
]);

/** True when `assetInfo`/`urlOrPath` names a binary asset kind that `save` must refuse. */
function isBinaryAsset(assetInfo: any, urlOrPath: string): boolean {
    if (assetInfo && typeof assetInfo.importer === 'string' && BINARY_IMPORTER_NAMES.has(assetInfo.importer)) {
        return true;
    }
    const ext = path.extname(urlOrPath || '').toLowerCase();
    return BINARY_EXTENSIONS.has(ext);
}

/**
 * Consolidated asset management tool.
 * Combines ProjectTools (asset methods) + AssetAdvancedTools into one action-based tool.
 */
export class ManageAsset extends BaseActionTool {
    readonly name = 'manage_asset';
    readonly description = 'Manage assets in the project (files, textures, scripts, etc). Actions: import, get_info, list, refresh, create, copy, move, delete, save, reimport, query_path, query_uuid, query_url, find_by_name, get_details, save_meta, generate_url, query_db_ready, open_external, batch_import, batch_delete, validate_references, get_dependencies, export_manifest. NOT for scene nodes — use manage_node. Use query_db_ready to check asset DB before batch ops.';
    readonly actions = [
        'import', 'get_info', 'list', 'refresh', 'create', 'copy', 'move', 'delete',
        'save', 'reimport', 'query_path', 'query_uuid', 'query_url', 'find_by_name',
        'get_details', 'save_meta', 'generate_url', 'query_db_ready', 'open_external',
        'batch_import', 'batch_delete', 'validate_references', 'get_dependencies',
        'export_manifest'
    ];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action to perform',
                enum: this.actions
            },
            sourcePath: { type: 'string', description: 'Source file path on disk (for import)' },
            targetFolder: { type: 'string', description: 'Target folder URL (for import)' },
            assetPath: { type: 'string', description: 'Asset path (db://assets/...)' },
            urlOrUUID: { type: 'string', description: 'Asset URL or UUID' },
            url: { type: 'string', description: 'Asset URL (db://assets/...)' },
            uuid: { type: 'string', description: 'Asset UUID' },
            content: { type: 'string', description: 'File content or meta content' },
            overwrite: { type: 'boolean', description: 'Overwrite existing file', default: false },
            source: { type: 'string', description: 'Source asset URL (for copy/move)' },
            target: { type: 'string', description: 'Target asset URL (for copy/move)' },
            folder: { type: 'string', description: 'Folder to search/list', default: 'db://assets' },
            type: {
                type: 'string',
                description: 'Asset type filter',
                enum: ['all', 'scene', 'prefab', 'script', 'texture', 'material', 'mesh', 'audio', 'animation'],
                default: 'all'
            },
            name: { type: 'string', description: 'Asset name to search for' },
            exactMatch: { type: 'boolean', description: 'Exact name match', default: false },
            assetType: {
                type: 'string',
                description: 'Filter by asset type',
                enum: ['all', 'scene', 'prefab', 'script', 'texture', 'material', 'mesh', 'audio', 'animation', 'spriteFrame'],
                default: 'all'
            },
            maxResults: { type: 'number', description: 'Max results for find_by_name', default: 20, minimum: 1, maximum: 100 },
            includeSubAssets: { type: 'boolean', description: 'Include sub-assets (spriteFrame, texture)', default: true },
            sourceDirectory: { type: 'string', description: 'Source directory for batch_import' },
            targetDirectory: { type: 'string', description: 'Target directory URL for batch_import' },
            fileFilter: { type: 'array', items: { type: 'string' }, description: 'File extensions filter', default: [] },
            recursive: { type: 'boolean', description: 'Include subdirectories', default: false },
            urls: { type: 'array', items: { type: 'string' }, description: 'Array of asset URLs for batch_delete' },
            directory: { type: 'string', description: 'Directory to scan', default: 'db://assets' },
            excludeDirectories: { type: 'array', items: { type: 'string' }, description: 'Directories to exclude', default: [] },
            direction: {
                type: 'string',
                description: 'Dependency direction for get_dependencies',
                enum: ['dependents', 'dependencies', 'both'],
                default: 'dependencies'
            },
            format: {
                type: 'string',
                description: 'Format for export_manifest',
                enum: ['auto', 'jpg', 'png', 'webp', 'json', 'csv', 'xml'],
                default: 'auto'
            },
            includeMetadata: { type: 'boolean', description: 'Include asset metadata in manifest', default: true },
            isFolder: {
                type: 'boolean',
                description: '[create] Explicitly create a folder, regardless of `content`. Use this instead of omitting `content` — many MCP transports coerce an omitted optional string to `""`, which otherwise makes folder creation unreachable.',
                default: false
            }
        },
        required: ['action']
    };

    /**
     * `manage_asset` actions historically read a different alias for the same "asset
     * reference" concept — some `url`, some `assetPath`, some `urlOrUUID` — with no
     * schema signal about which name a given action expected. A caller passing the
     * documented `assetPath` to `create` silently forwarded `undefined`, surfacing as
     * the editor's own unrelated `"options.target is required"` error (#80, #99 item 7).
     * Every action below now resolves through this same alias set.
     */
    private resolveAssetArg(args: Record<string, any>): string | undefined {
        return args.url || args.urlOrUUID || args.assetPath || undefined;
    }

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        import: (args) => this.importAsset(args.sourcePath, args.targetFolder),
        get_info: (args) => this.getAssetInfo(this.resolveAssetArg(args)),
        list: (args) => this.getAssets(args.type, args.folder),
        // `folder` is the intended scope param; fall back to the asset-ref aliases only
        // when it is omitted, so passing `url` instead of `folder` can never silently
        // widen the refresh to the whole project (`db://assets`) — see refreshAssets().
        refresh: (args) => this.refreshAssets(args.folder || this.resolveAssetArg(args)),
        create: (args) => this.createAsset(
            this.resolveAssetArg(args),
            args.content ?? null,
            args.overwrite === true || args.overwrite === 'true',
            args.isFolder === true || args.isFolder === 'true'
        ),
        copy: (args) => this.copyAsset(args.source, args.target, args.overwrite === true || args.overwrite === 'true'),
        move: (args) => this.moveAsset(args.source, args.target, args.overwrite === true || args.overwrite === 'true'),
        delete: (args) => this.deleteAsset(this.resolveAssetArg(args)),
        save: (args) => this.saveAsset(this.resolveAssetArg(args), args.content),
        reimport: (args) => this.reimportAsset(this.resolveAssetArg(args)),
        query_path: (args) => this.queryAssetPath(args.url || args.urlOrUUID),
        query_uuid: (args) => this.queryAssetUuid(args.url),
        query_url: (args) => this.queryAssetUrl(args.uuid),
        find_by_name: (args) => this.findAssetByName(args),
        get_details: (args) => this.getAssetDetails(this.resolveAssetArg(args), args.includeSubAssets !== false),
        save_meta: (args) => this.saveAssetMeta(this.resolveAssetArg(args), args.content),
        generate_url: (args) => this.generateAvailableUrl(args.url),
        query_db_ready: (_args) => this.queryAssetDbReady(),
        open_external: (args) => this.openAssetExternal(args.urlOrUUID),
        batch_import: (args) => this.batchImportAssets(args),
        batch_delete: (args) => this.batchDeleteAssets(args.urls),
        validate_references: (args) => this.validateAssetReferences(args.directory),
        // Routes through `resolveAssetArg` like every other asset-ref action. It used to
        // read `args.urlOrUUID` alone, so a caller using the schema-documented `url` or
        // `assetPath` spelling reached the handler with `undefined` (#124).
        get_dependencies: (args) => this.getAssetDependencies(this.resolveAssetArg(args), args.direction),
        export_manifest: (args) => this.exportAssetManifest(args.directory, args.format, args.includeMetadata !== false)
    };

    // ── From ProjectTools ────────────────────────────────────────────────────

    private async importAsset(sourcePath: string, targetFolder: string): Promise<ActionToolResult> {
        if (!fs.existsSync(sourcePath)) return errorResult('Source file not found');
        if (!validateAssetPath(targetFolder)) return errorResult('Invalid target folder path: must be db:// URL or assets/ relative path without traversal');
        try {
            const fileName = path.basename(sourcePath);
            const targetPath = targetFolder.startsWith('db://') ? targetFolder : `db://assets/${targetFolder}`;
            const result: any = await Editor.Message.request('asset-db', 'import-asset', sourcePath, `${targetPath}/${fileName}`);
            return successResult({ uuid: result.uuid, path: result.url, message: `Asset imported: ${fileName}` });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getAssetInfo(assetPath?: string): Promise<ActionToolResult> {
        if (!assetPath || typeof assetPath !== 'string' || assetPath.trim() === '') {
            return errorResult('get_info requires one of: url, urlOrUUID, assetPath');
        }
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'query-asset-info', assetPath);
            if (!assetInfo) return errorResult('Asset not found');
            const info: any = {
                name: assetInfo.name,
                uuid: assetInfo.uuid,
                path: assetInfo.url,
                type: assetInfo.type,
                size: assetInfo.size,
                isDirectory: assetInfo.isDirectory
            };
            if (assetInfo.meta) {
                info.meta = { ver: assetInfo.meta.ver, importer: assetInfo.meta.importer };
            }
            return successResult(info);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getAssets(type: string = 'all', folder: string = 'db://assets'): Promise<ActionToolResult> {
        try {
            let pattern = `${folder}/**/*`;
            if (type !== 'all') {
                const typeExtensions: Record<string, string> = {
                    'scene': '.scene', 'prefab': '.prefab', 'script': '.{ts,js}',
                    'texture': '.{png,jpg,jpeg,gif,tga,bmp,psd}', 'material': '.mtl',
                    'mesh': '.{fbx,obj,dae}', 'audio': '.{mp3,ogg,wav,m4a}', 'animation': '.{anim,clip}'
                };
                const extension = typeExtensions[type];
                if (extension) pattern = `${folder}/**/*${extension}`;
            }
            const results: any[] = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            const assets = results.map(asset => ({
                name: asset.name, uuid: asset.uuid, path: asset.url,
                type: asset.type, size: asset.size || 0, isDirectory: asset.isDirectory || false
            }));
            return successResult({ type, folder, count: assets.length, assets });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    /**
     * `folder` is the intended scope for this action; the dispatch table now falls
     * back to the asset-ref aliases (`url`/`urlOrUUID`/`assetPath`) only when `folder`
     * itself is omitted, so a caller who passes `url` still refreshes just that path
     * instead of silently widening the refresh to the whole project (`db://assets`),
     * which is what happened when a non-`folder` argument reached here as `undefined`.
     */
    private async refreshAssets(folder?: string): Promise<ActionToolResult> {
        try {
            const targetPath = folder || 'db://assets';
            await Editor.Message.request('asset-db', 'refresh-asset', targetPath);
            return successResult(null, `Assets refreshed in: ${targetPath}`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    /**
     * `content === null` (i.e. omitted) has always meant "create a folder". That
     * inference breaks whenever the calling MCP transport coerces an omitted optional
     * string to `""` before it reaches here — `content ?? null` never substitutes on an
     * empty string, so it is forwarded down the FILE path and folder creation becomes
     * unreachable through that transport. `isFolder` makes the intent explicit instead
     * of inferring it from `content`, while `content === null` is kept as the original
     * (still-valid) implicit form for backward compatibility (#99 item 6).
     */
    private async createAsset(url?: string, content: string | null = null, overwrite: boolean = false, isFolder: boolean = false): Promise<ActionToolResult> {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return errorResult('create requires one of: url, urlOrUUID, assetPath — naming the asset to create');
        }
        try {
            const folder = isFolder || content === null;
            const effectiveContent = folder ? null : content;
            const options = { overwrite, rename: !overwrite };
            const result: any = await Editor.Message.request('asset-db', 'create-asset', url, effectiveContent, options);
            const msg = folder ? 'Folder created successfully' : 'File created successfully';
            return successResult(result && result.uuid ? { uuid: result.uuid, url: result.url, message: msg } : { url, message: msg });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async copyAsset(source: string, target: string, overwrite: boolean = false): Promise<ActionToolResult> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'copy-asset', source, target, { overwrite, rename: !overwrite });
            return successResult(result && result.uuid
                ? { uuid: result.uuid, url: result.url, message: 'Asset copied successfully' }
                : { source, target, message: 'Asset copied successfully' });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async moveAsset(source: string, target: string, overwrite: boolean = false): Promise<ActionToolResult> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'move-asset', source, target, { overwrite, rename: !overwrite });
            return successResult(result && result.uuid
                ? { uuid: result.uuid, url: result.url, message: 'Asset moved successfully' }
                : { source, target, message: 'Asset moved successfully' });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    /**
     * `delete-asset` resolving its promise is not proof the file is gone — the old code
     * trusted that resolution alone and reported success unconditionally. A read-back
     * query immediately after now confirms the asset db no longer knows about the url
     * before success is reported, mirroring the verify-don't-trust pattern already used
     * by `manage_scene`'s `save` action (#99 item 5).
     */
    private async deleteAsset(url?: string): Promise<ActionToolResult> {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return errorResult('delete requires one of: url, urlOrUUID, assetPath');
        }
        try {
            await Editor.Message.request('asset-db', 'delete-asset', url);
            const stillPresent: any = await Editor.Message.request('asset-db', 'query-asset-info', url).catch(() => null);
            if (stillPresent) {
                return errorResult(`asset-db:delete-asset resolved, but '${url}' is still present in the asset DB immediately afterward — the delete did not take effect.`);
            }
            return successResult({ url }, 'Asset deleted successfully');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    /**
     * Forwarding an arbitrary string over a binary asset (e.g. writing text content
     * over a `.png`) does not update it — it corrupts it. Query the target's importer
     * before writing and refuse the write for a known-binary kind (#99 item 1).
     * Legitimate text assets (.ts, .json, .txt, materials, scenes, ...) are unaffected.
     */
    private async saveAsset(url?: string, content?: string): Promise<ActionToolResult> {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return errorResult('save requires one of: url, urlOrUUID, assetPath');
        }
        if (typeof content !== 'string') {
            return errorResult('save requires content: a string');
        }
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'query-asset-info', url).catch(() => null);
            if (assetInfo && typeof content === 'string' && isBinaryAsset(assetInfo, url)) {
                return errorResult(
                    `save cannot write string content over '${url}': it resolves to a binary asset ` +
                    `(importer='${assetInfo.importer}', type='${assetInfo.type}'). Writing text content over a ` +
                    'binary asset would corrupt it — use import/copy to replace binary asset content instead.'
                );
            }
            const result: any = await Editor.Message.request('asset-db', 'save-asset', url, content);
            return successResult(result && result.uuid ? { uuid: result.uuid, url: result.url } : { url }, 'Asset saved successfully');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    /**
     * `reimport-asset` on a directory URL previously forwarded straight to the editor
     * with no directory check, no child enumeration, and the boolean result was
     * discarded — an unconditional success regardless of what actually happened. The
     * decision here is REFUSE, not recurse: a folder does not have importable content
     * of its own, so each child asset must be reimported by its own url (#96).
     */
    private async reimportAsset(url?: string): Promise<ActionToolResult> {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return errorResult('reimport requires one of: url, urlOrUUID, assetPath');
        }
        try {
            const info: any = await Editor.Message.request('asset-db', 'query-asset-info', url).catch(() => null);
            if (info && info.isDirectory) {
                return errorResult(
                    `reimport does not accept a folder URL ('${url}' is a directory) — this action does not ` +
                    'recurse into folder contents. Reimport each child asset individually by its own url instead.'
                );
            }
            const result = await Editor.Message.request('asset-db', 'reimport-asset', url);
            if (result === false) {
                return errorResult(`asset-db:reimport-asset returned false for '${url}' — the editor rejected the reimport.`);
            }
            return successResult({ url }, 'Asset reimported successfully');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async queryAssetPath(url: string): Promise<ActionToolResult> {
        try {
            const assetPath: string | null = await Editor.Message.request('asset-db', 'query-path', url) as string | null;
            if (assetPath) return successResult({ url, path: assetPath }, 'Asset path retrieved successfully');
            return errorResult('Asset path not found');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async queryAssetUuid(url: string): Promise<ActionToolResult> {
        try {
            const uuid: string | null = await Editor.Message.request('asset-db', 'query-uuid', url) as string | null;
            if (uuid) return successResult({ url, uuid }, 'Asset UUID retrieved successfully');
            return errorResult('Asset UUID not found');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async queryAssetUrl(uuid: string): Promise<ActionToolResult> {
        try {
            const url: string | null = await Editor.Message.request('asset-db', 'query-url', uuid) as string | null;
            if (url) return successResult({ uuid, url }, 'Asset URL retrieved successfully');
            return errorResult('Asset URL not found');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async findAssetByName(args: any): Promise<ActionToolResult> {
        const { name, exactMatch = false, assetType = 'all', folder = 'db://assets', maxResults = 20 } = args;
        try {
            const allAssetsResult = await this.getAssets(assetType, folder);
            if (!allAssetsResult.success || !allAssetsResult.data) {
                return errorResult(`Failed to get assets: ${allAssetsResult.error}`);
            }
            const allAssets = allAssetsResult.data.assets as any[];
            const matchedAssets: any[] = [];
            for (const asset of allAssets) {
                const matches = exactMatch
                    ? asset.name === name
                    : asset.name.toLowerCase().includes(name.toLowerCase());
                if (matches) {
                    try {
                        const detailResult = await this.getAssetInfo(asset.path);
                        matchedAssets.push(detailResult.success ? { ...asset, details: detailResult.data } : asset);
                    } catch {
                        matchedAssets.push(asset);
                    }
                    if (matchedAssets.length >= maxResults) break;
                }
            }
            return successResult({
                searchTerm: name, exactMatch, assetType, folder,
                totalFound: matchedAssets.length, maxResults, assets: matchedAssets
            }, `Found ${matchedAssets.length} assets matching '${name}'`);
        } catch (error: any) {
            return errorResult(`Asset search failed: ${error.message}`);
        }
    }

    private async getAssetDetails(assetPath?: string, includeSubAssets: boolean = true): Promise<ActionToolResult> {
        if (!assetPath || typeof assetPath !== 'string' || assetPath.trim() === '') {
            return errorResult('get_details requires one of: url, urlOrUUID, assetPath');
        }
        try {
            const assetInfoResult = await this.getAssetInfo(assetPath);
            if (!assetInfoResult.success) return assetInfoResult;
            const assetInfo = assetInfoResult.data;
            const detailedInfo: any = { ...assetInfo, subAssets: [] };
            if (includeSubAssets && assetInfo) {
                if (assetInfo.type === 'cc.ImageAsset' || assetPath.match(/\.(png|jpg|jpeg|gif|tga|bmp|psd)$/i)) {
                    const baseUuid = assetInfo.uuid;
                    const possibleSubAssets = [
                        { type: 'spriteFrame', uuid: `${baseUuid}@f9941`, suffix: '@f9941' },
                        { type: 'texture', uuid: `${baseUuid}@6c48a`, suffix: '@6c48a' },
                        { type: 'texture2D', uuid: `${baseUuid}@6c48a`, suffix: '@6c48a' }
                    ];
                    for (const subAsset of possibleSubAssets) {
                        try {
                            const subAssetUrl = await Editor.Message.request('asset-db', 'query-url', subAsset.uuid);
                            if (subAssetUrl) {
                                detailedInfo.subAssets.push({ type: subAsset.type, uuid: subAsset.uuid, url: subAssetUrl, suffix: subAsset.suffix });
                            }
                        } catch { /* sub-asset doesn't exist, skip */ }
                    }
                }
            }
            return successResult({ assetPath, includeSubAssets, ...detailedInfo }, `Asset details retrieved. Found ${detailedInfo.subAssets.length} sub-assets.`);
        } catch (error: any) {
            return errorResult(`Failed to get asset details: ${error.message}`);
        }
    }

    // ── From AssetAdvancedTools ───────────────────────────────────────────────

    /**
     * The old implementation forwarded the caller's raw string straight to
     * `save-asset-meta` with no parse, no merge, and no presence guard — a
     * byte-identical `.png.meta` round-trip depended on the caller reconstructing the
     * *entire* meta exactly, and any field it dropped (or the asset-db's own computed
     * fields it never had) silently diverged the saved meta. Route through
     * `query-asset-meta` -> merge -> `JSON.stringify` -> save instead, matching the
     * pattern already used by `manage_material`/`manage_shader_effect` (#82). `content`
     * is now a JSON *patch* merged onto the current meta, not the whole meta document.
     */
    private async saveAssetMeta(urlOrUUID?: string, content?: string): Promise<ActionToolResult> {
        if (!urlOrUUID || typeof urlOrUUID !== 'string' || urlOrUUID.trim() === '') {
            return errorResult('save_meta requires one of: url, urlOrUUID, assetPath');
        }
        if (content === undefined || content === null || content === '') {
            return errorResult('save_meta requires content: a JSON string of the meta fields to merge (e.g. {"userData":{...}})');
        }
        let patch: any;
        try {
            patch = JSON.parse(content);
        } catch (err: any) {
            return errorResult(`save_meta content is not valid JSON: ${err.message}`);
        }
        try {
            const currentMeta: any = await Editor.Message.request('asset-db', 'query-asset-meta', urlOrUUID);
            if (!currentMeta) {
                return errorResult(`Could not read current meta for '${urlOrUUID}' — asset not found in the asset DB.`);
            }
            const mergedMeta = { ...currentMeta, ...patch };
            const result: any = await Editor.Message.request('asset-db', 'save-asset-meta', urlOrUUID, JSON.stringify(mergedMeta));
            return successResult({ uuid: result?.uuid ?? mergedMeta.uuid, url: result?.url }, 'Asset meta saved successfully');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async generateAvailableUrl(url: string): Promise<ActionToolResult> {
        try {
            const availableUrl: string = await Editor.Message.request('asset-db', 'generate-available-url', url) as string;
            return successResult({
                originalUrl: url, availableUrl,
                message: availableUrl === url ? 'URL is available' : 'Generated new available URL'
            });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async queryAssetDbReady(): Promise<ActionToolResult> {
        try {
            const ready: boolean = await Editor.Message.request('asset-db', 'query-ready') as boolean;
            return successResult({ ready, message: ready ? 'Asset database is ready' : 'Asset database is not ready' });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async openAssetExternal(urlOrUUID: string): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('asset-db', 'open-asset', urlOrUUID);
            return successResult(null, 'Asset opened with external program');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async batchImportAssets(args: any): Promise<ActionToolResult> {
        try {
            const overwrite: boolean = args.overwrite === true || args.overwrite === 'true';
            const recursive: boolean = args.recursive === true || args.recursive === 'true';
            if (!validateAssetPath(args.targetDirectory || '')) {
                return errorResult('Invalid targetDirectory: must be db:// URL or assets/ relative path without traversal');
            }
            if (!fs.existsSync(args.sourceDirectory)) return errorResult('Source directory does not exist');
            const files = this.getFilesFromDirectory(args.sourceDirectory, args.fileFilter || [], recursive);
            const importResults: any[] = [];
            let successCount = 0;
            let errorCount = 0;
            for (const filePath of files) {
                try {
                    const fileName = path.basename(filePath);
                    const targetPath = `${args.targetDirectory}/${fileName}`;
                    const result = await Editor.Message.request('asset-db', 'import-asset', filePath, targetPath, { overwrite, rename: !overwrite });
                    importResults.push({ source: filePath, target: targetPath, success: true, uuid: (result as any)?.uuid });
                    successCount++;
                } catch (err: any) {
                    importResults.push({ source: filePath, success: false, error: err.message });
                    errorCount++;
                }
            }
            return successResult({ totalFiles: files.length, successCount, errorCount, results: importResults },
                `Batch import completed: ${successCount} success, ${errorCount} errors`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private getFilesFromDirectory(dirPath: string, fileFilter: string[], recursive: boolean): string[] {
        const files: string[] = [];
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                if (fileFilter.length === 0 || fileFilter.some(ext => item.toLowerCase().endsWith(ext.toLowerCase()))) {
                    files.push(fullPath);
                }
            } else if (stat.isDirectory() && recursive) {
                files.push(...this.getFilesFromDirectory(fullPath, fileFilter, recursive));
            }
        }
        return files;
    }

    private async batchDeleteAssets(urls: string[]): Promise<ActionToolResult> {
        try {
            const deleteResults: any[] = [];
            let successCount = 0;
            let errorCount = 0;
            for (const url of urls) {
                try {
                    await Editor.Message.request('asset-db', 'delete-asset', url);
                    deleteResults.push({ url, success: true });
                    successCount++;
                } catch (err: any) {
                    deleteResults.push({ url, success: false, error: err.message });
                    errorCount++;
                }
            }
            return successResult({ totalAssets: urls.length, successCount, errorCount, results: deleteResults },
                `Batch delete completed: ${successCount} success, ${errorCount} errors`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async validateAssetReferences(directory: string = 'db://assets'): Promise<ActionToolResult> {
        try {
            const assets: any[] = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });
            const brokenReferences: any[] = [];
            const validReferences: any[] = [];
            for (const asset of assets) {
                try {
                    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                    if (assetInfo) validReferences.push({ url: asset.url, uuid: asset.uuid, name: asset.name });
                } catch (err) {
                    brokenReferences.push({ url: asset.url, uuid: asset.uuid, name: asset.name, error: (err as Error).message });
                }
            }
            return successResult({
                directory, totalAssets: assets.length,
                validReferences: validReferences.length, brokenReferences: brokenReferences.length,
                brokenAssets: brokenReferences
            }, `Validation completed: ${brokenReferences.length} broken references found`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    /**
     * Resolve an asset's dependency graph.
     *
     * Was an unconditional stub returning "requires additional APIs not available in
     * current Cocos Creator MCP implementation" for every input (#124). The triage's
     * resolution was explicit — implement it, or stop advertising it — and the
     * delete-safety argument decided the choice: because Cocos resolves references by
     * the uuid in the sibling `.meta`, a reference left dangling by a premature delete
     * resolves to `None` silently and surfaces at runtime or build time, far from the
     * delete that caused it. `direction: dependents` is the only advertised pre-flight
     * for that, so removing the action would remove the safety check.
     *
     * Three sources across two packages, because no single message answers both halves:
     *
     * 1. `asset-db query-asset-dependencies` — the DB's forward index, giving the
     *    `dependencies` direction directly.
     * 2. `asset-db query-asset-users` — the DB's reverse lookup, the same index read from
     *    the other end. Both are declared in the editor's own typings; both take an
     *    optional `type` selecting `asset` / `script` / `all`, so `all` is passed.
     * 3. `scene query-nodes-by-asset-uuid` — the live scene's reverse lookup, which the
     *    Asset Browser uses to answer "who references this". Kept in addition to (2)
     *    because a node in the open scene is the population a delete breaks immediately,
     *    and is not itself an asset in the DB.
     *
     * Each is attempted independently and its reachability is reported: a message that
     * throws contributes nothing to `sources`, and a caller seeing an empty list is told
     * which sources answered. An empty result is stated as a COUNT plus those sources,
     * never as a bare empty array: "no dependents found" and "the query could not run"
     * must not read the same to a caller deciding whether a delete is safe.
     */
    private async getAssetDependencies(urlOrUUID?: string, direction: string = 'dependencies'): Promise<ActionToolResult> {
        if (!urlOrUUID || typeof urlOrUUID !== 'string' || urlOrUUID.trim() === '') {
            return errorResult('get_dependencies requires one of: url, urlOrUUID, assetPath — naming the asset to analyze');
        }

        const info: any = await Editor.Message.request('asset-db', 'query-asset-info', urlOrUUID).catch(() => null);
        if (!info || !info.uuid) {
            return errorResult(
                `Asset '${urlOrUUID}' not found in the asset DB — nothing to analyze. ` +
                'If the file was written outside the editor, run manage_asset action=refresh first.'
            );
        }

        const wantsDependents = direction === 'dependents' || direction === 'both';
        const wantsDependencies = direction === 'dependencies' || direction === 'both';
        const data: Record<string, any> = {
            url: info.url || urlOrUUID,
            uuid: info.uuid,
            name: info.name,
            direction
        };

        if (wantsDependencies) {
            const dependencies = await this.queryAssetDependencies(info.uuid);
            data.dependencies = dependencies.assets;
            data.dependencyCount = dependencies.assets.length;
            data.dependenciesSource = dependencies.source;
        }

        if (wantsDependents) {
            const dependents = await this.queryAssetDependents(info.uuid, urlOrUUID);
            data.dependents = dependents.assets;
            data.dependentCount = dependents.assets.length;
            data.dependentsSource = dependents.source;
            // Named separately from `dependents`: a scene node is a live consumer an
            // asset cleanup must not break, and it is not an asset in the DB.
            data.referencingNodes = dependents.nodes;
        }

        const summary = [
            wantsDependents ? `${data.dependentCount ?? 0} dependent asset(s) via ${data.dependentsSource}` : null,
            wantsDependencies ? `${data.dependencyCount ?? 0} dependency/dependencies via ${data.dependenciesSource}` : null,
        ].filter(Boolean).join(', ');

        return successResult(data, `Resolved ${info.name || info.url}: ${summary}`);
    }

    /**
     * Forward graph. Uses the asset DB's own index; returns `[]` with a named empty source.
     *
     * `query-asset-dependencies` is declared in
     * `@cocos/creator-types/editor/packages/asset-db/@types/protected/message.d.ts` as
     * `(uuid: string, type?: QueryAssetType) => string[]`. The `type` argument selects the
     * population — `asset` (resources), `script`, or `all` — and omitting it omits script
     * references, so `all` is passed to match the "what would a delete break" question the
     * caller is asking.
     */
    private async queryAssetDependencies(uuid: string): Promise<{ assets: any[]; source: string }> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'query-asset-dependencies', uuid, 'all');
            const list = Array.isArray(result) ? result : [];
            return { assets: list.map((dep: any) => (typeof dep === 'string' ? { uuid: dep } : dep)), source: 'asset-db query-asset-dependencies' };
        } catch {
            // No such message in this build — an empty list with a named source, so the
            // caller can tell "none" from "not answerable here".
            return { assets: [], source: 'unavailable (no asset-db query-asset-dependencies in this editor build)' };
        }
    }

    /**
     * Reverse graph. Scans the asset DB's own serialized references where the build
     * exposes them, and always adds the live scene's reverse lookup, which is the
     * population a delete actually risks breaking.
     */
    /**
     * Reverse graph. Both directions are asked of the editor, because each sees a
     * population the other can miss: the asset DB's reverse index sees serialized
     * references anywhere in the project, while the live scene scan is what a delete
     * actually breaks right now.
     *
     * `query-asset-users` is the DB's declared reverse message
     * (`@cocos/creator-types/.../asset-db/@types/protected/message.d.ts`), declared as
     * `(uuid: string, type?: QueryAssetType) => string[] | null`. It is the same
     * population `query-asset-dependencies` indexes from the other end, so it needs the
     * same `all` to include script references.
     *
     * Nothing is inferred from a failed call: an unreachable message leaves `sources`
     * short, and the caller reports that as "not answerable here" rather than as zero.
     */
    private async queryAssetDependents(uuid: string, urlOrUUID: string): Promise<{ assets: any[]; nodes: string[]; source: string }> {
        const assets: any[] = [];
        const sources: string[] = [];

        try {
            const result: any = await Editor.Message.request('asset-db', 'query-asset-users', uuid, 'all');
            const list = Array.isArray(result) ? result : [];
            for (const dep of list) assets.push(typeof dep === 'string' ? { uuid: dep } : dep);
            sources.push('asset-db query-asset-users');
        } catch {
            // Not available in this build — the scene scan below is the whole answer.
        }

        let nodes: string[] = [];
        try {
            const nodeUuids: any = await Editor.Message.request('scene', 'query-nodes-by-asset-uuid', uuid);
            nodes = Array.isArray(nodeUuids) ? nodeUuids : [];
            if (nodes.length > 0) sources.push('scene query-nodes-by-asset-uuid');
        } catch {
            // No reverse scene lookup either; `sources` stays empty and is reported as such.
        }

        return {
            assets,
            nodes,
            source: sources.length > 0 ? sources.join(' + ') : `no reverse-reference query available for '${urlOrUUID}' in this editor build`
        };
    }

    private async exportAssetManifest(directory: string = 'db://assets', format: string = 'json', includeMetadata: boolean = true): Promise<ActionToolResult> {
        try {
            const assets: any[] = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });
            const manifest: any[] = [];
            for (const asset of assets) {
                const manifestEntry: any = {
                    name: asset.name, url: asset.url, uuid: asset.uuid,
                    type: asset.type, size: (asset as any).size || 0, isDirectory: asset.isDirectory || false
                };
                if (includeMetadata) {
                    try {
                        const assetInfo: any = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                        if (assetInfo && assetInfo.meta) manifestEntry.meta = assetInfo.meta;
                    } catch { /* skip metadata if not available */ }
                }
                manifest.push(manifestEntry);
            }
            let exportData: string;
            switch (format) {
                case 'csv': exportData = this.convertToCSV(manifest); break;
                case 'xml': exportData = this.convertToXML(manifest); break;
                default: exportData = JSON.stringify(manifest, null, 2);
            }
            return successResult({ directory, format, assetCount: manifest.length, includeMetadata, manifest: exportData },
                `Asset manifest exported with ${manifest.length} assets`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private convertToCSV(data: any[]): string {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const csvRows = [headers.map(h => escapeCsvField(h)).join(',')];
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
                return escapeCsvField(str);
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    }

    private convertToXML(data: any[]): string {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<assets>\n';
        for (const item of data) {
            xml += '  <asset>\n';
            for (const [key, value] of Object.entries(item)) {
                const xmlValue = typeof value === 'object' ?
                    JSON.stringify(value) :
                    String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                xml += `    <${key}>${xmlValue}</${key}>\n`;
            }
            xml += '  </asset>\n';
        }
        xml += '</assets>';
        return xml;
    }
}
