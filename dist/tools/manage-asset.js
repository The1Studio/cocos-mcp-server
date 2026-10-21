"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageAsset = void 0;
const types_1 = require("../types");
const base_action_tool_1 = require("./base-action-tool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Returns true if the path is safe for asset operations.
 * Rejects traversal patterns and bare absolute paths (non-db:// form).
 */
function validateAssetPath(assetPath) {
    if (!assetPath || typeof assetPath !== 'string')
        return false;
    // Allow db:// protocol paths (Cocos asset DB format)
    if (assetPath.startsWith('db://'))
        return true;
    // Reject traversal patterns in any form
    if (assetPath.includes('..') || assetPath.startsWith('/') || assetPath.includes('\\..'))
        return false;
    // Must start with assets/ for relative paths
    return assetPath.startsWith('assets/');
}
function escapeCsvField(field) {
    if (typeof field !== 'string')
        return String(field);
    // Escape formula injection prefixes
    if (/^[=+\-@\t\r]/.test(field))
        field = "'" + field;
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
function isBinaryAsset(assetInfo, urlOrPath) {
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
class ManageAsset extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_asset';
        this.description = 'Manage assets in the project (files, textures, scripts, etc). Actions: import, get_info, list, refresh, create, copy, move, delete, save, reimport, query_path, query_uuid, query_url, find_by_name, get_details, save_meta, generate_url, query_db_ready, open_external, batch_import, batch_delete, validate_references, get_dependencies, export_manifest. NOT for scene nodes — use manage_node. Use query_db_ready to check asset DB before batch ops.';
        this.actions = [
            'import', 'get_info', 'list', 'refresh', 'create', 'copy', 'move', 'delete',
            'save', 'reimport', 'query_path', 'query_uuid', 'query_url', 'find_by_name',
            'get_details', 'save_meta', 'generate_url', 'query_db_ready', 'open_external',
            'batch_import', 'batch_delete', 'validate_references', 'get_dependencies',
            'export_manifest'
        ];
        this.inputSchema = {
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
        this.actionHandlers = {
            import: (args) => this.importAsset(args.sourcePath, args.targetFolder),
            get_info: (args) => this.getAssetInfo(this.resolveAssetArg(args)),
            list: (args) => this.getAssets(args.type, args.folder),
            // `folder` is the intended scope param; fall back to the asset-ref aliases only
            // when it is omitted, so passing `url` instead of `folder` can never silently
            // widen the refresh to the whole project (`db://assets`) — see refreshAssets().
            refresh: (args) => this.refreshAssets(args.folder || this.resolveAssetArg(args)),
            create: (args) => {
                var _a;
                return this.createAsset(this.resolveAssetArg(args), (_a = args.content) !== null && _a !== void 0 ? _a : null, args.overwrite === true || args.overwrite === 'true', args.isFolder === true || args.isFolder === 'true');
            },
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
    }
    /**
     * `manage_asset` actions historically read a different alias for the same "asset
     * reference" concept — some `url`, some `assetPath`, some `urlOrUUID` — with no
     * schema signal about which name a given action expected. A caller passing the
     * documented `assetPath` to `create` silently forwarded `undefined`, surfacing as
     * the editor's own unrelated `"options.target is required"` error (#80, #99 item 7).
     * Every action below now resolves through this same alias set.
     */
    resolveAssetArg(args) {
        return args.url || args.urlOrUUID || args.assetPath || undefined;
    }
    // ── From ProjectTools ────────────────────────────────────────────────────
    async importAsset(sourcePath, targetFolder) {
        if (!fs.existsSync(sourcePath))
            return (0, types_1.errorResult)('Source file not found');
        if (!validateAssetPath(targetFolder))
            return (0, types_1.errorResult)('Invalid target folder path: must be db:// URL or assets/ relative path without traversal');
        try {
            const fileName = path.basename(sourcePath);
            const targetPath = targetFolder.startsWith('db://') ? targetFolder : `db://assets/${targetFolder}`;
            const result = await Editor.Message.request('asset-db', 'import-asset', sourcePath, `${targetPath}/${fileName}`);
            return (0, types_1.successResult)({ uuid: result.uuid, path: result.url, message: `Asset imported: ${fileName}` });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getAssetInfo(assetPath) {
        if (!assetPath || typeof assetPath !== 'string' || assetPath.trim() === '') {
            return (0, types_1.errorResult)('get_info requires one of: url, urlOrUUID, assetPath');
        }
        try {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', assetPath);
            if (!assetInfo)
                return (0, types_1.errorResult)('Asset not found');
            const info = {
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
            return (0, types_1.successResult)(info);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getAssets(type = 'all', folder = 'db://assets') {
        try {
            let pattern = `${folder}/**/*`;
            if (type !== 'all') {
                const typeExtensions = {
                    'scene': '.scene', 'prefab': '.prefab', 'script': '.{ts,js}',
                    'texture': '.{png,jpg,jpeg,gif,tga,bmp,psd}', 'material': '.mtl',
                    'mesh': '.{fbx,obj,dae}', 'audio': '.{mp3,ogg,wav,m4a}', 'animation': '.{anim,clip}'
                };
                const extension = typeExtensions[type];
                if (extension)
                    pattern = `${folder}/**/*${extension}`;
            }
            const results = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            const assets = results.map(asset => ({
                name: asset.name, uuid: asset.uuid, path: asset.url,
                type: asset.type, size: asset.size || 0, isDirectory: asset.isDirectory || false
            }));
            return (0, types_1.successResult)({ type, folder, count: assets.length, assets });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    /**
     * `folder` is the intended scope for this action; the dispatch table now falls
     * back to the asset-ref aliases (`url`/`urlOrUUID`/`assetPath`) only when `folder`
     * itself is omitted, so a caller who passes `url` still refreshes just that path
     * instead of silently widening the refresh to the whole project (`db://assets`),
     * which is what happened when a non-`folder` argument reached here as `undefined`.
     */
    async refreshAssets(folder) {
        try {
            const targetPath = folder || 'db://assets';
            await Editor.Message.request('asset-db', 'refresh-asset', targetPath);
            return (0, types_1.successResult)(null, `Assets refreshed in: ${targetPath}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
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
    async createAsset(url, content = null, overwrite = false, isFolder = false) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return (0, types_1.errorResult)('create requires one of: url, urlOrUUID, assetPath — naming the asset to create');
        }
        try {
            const folder = isFolder || content === null;
            const effectiveContent = folder ? null : content;
            const options = { overwrite, rename: !overwrite };
            const result = await Editor.Message.request('asset-db', 'create-asset', url, effectiveContent, options);
            const msg = folder ? 'Folder created successfully' : 'File created successfully';
            return (0, types_1.successResult)(result && result.uuid ? { uuid: result.uuid, url: result.url, message: msg } : { url, message: msg });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async copyAsset(source, target, overwrite = false) {
        try {
            const result = await Editor.Message.request('asset-db', 'copy-asset', source, target, { overwrite, rename: !overwrite });
            return (0, types_1.successResult)(result && result.uuid
                ? { uuid: result.uuid, url: result.url, message: 'Asset copied successfully' }
                : { source, target, message: 'Asset copied successfully' });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async moveAsset(source, target, overwrite = false) {
        try {
            const result = await Editor.Message.request('asset-db', 'move-asset', source, target, { overwrite, rename: !overwrite });
            return (0, types_1.successResult)(result && result.uuid
                ? { uuid: result.uuid, url: result.url, message: 'Asset moved successfully' }
                : { source, target, message: 'Asset moved successfully' });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    /**
     * `delete-asset` resolving its promise is not proof the file is gone — the old code
     * trusted that resolution alone and reported success unconditionally. A read-back
     * query immediately after now confirms the asset db no longer knows about the url
     * before success is reported, mirroring the verify-don't-trust pattern already used
     * by `manage_scene`'s `save` action (#99 item 5).
     */
    async deleteAsset(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return (0, types_1.errorResult)('delete requires one of: url, urlOrUUID, assetPath');
        }
        try {
            await Editor.Message.request('asset-db', 'delete-asset', url);
            const stillPresent = await Editor.Message.request('asset-db', 'query-asset-info', url).catch(() => null);
            if (stillPresent) {
                return (0, types_1.errorResult)(`asset-db:delete-asset resolved, but '${url}' is still present in the asset DB immediately afterward — the delete did not take effect.`);
            }
            return (0, types_1.successResult)({ url }, 'Asset deleted successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    /**
     * Forwarding an arbitrary string over a binary asset (e.g. writing text content
     * over a `.png`) does not update it — it corrupts it. Query the target's importer
     * before writing and refuse the write for a known-binary kind (#99 item 1).
     * Legitimate text assets (.ts, .json, .txt, materials, scenes, ...) are unaffected.
     */
    async saveAsset(url, content) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return (0, types_1.errorResult)('save requires one of: url, urlOrUUID, assetPath');
        }
        if (typeof content !== 'string') {
            return (0, types_1.errorResult)('save requires content: a string');
        }
        try {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', url).catch(() => null);
            if (assetInfo && typeof content === 'string' && isBinaryAsset(assetInfo, url)) {
                return (0, types_1.errorResult)(`save cannot write string content over '${url}': it resolves to a binary asset ` +
                    `(importer='${assetInfo.importer}', type='${assetInfo.type}'). Writing text content over a ` +
                    'binary asset would corrupt it — use import/copy to replace binary asset content instead.');
            }
            const result = await Editor.Message.request('asset-db', 'save-asset', url, content);
            return (0, types_1.successResult)(result && result.uuid ? { uuid: result.uuid, url: result.url } : { url }, 'Asset saved successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    /**
     * `reimport-asset` on a directory URL previously forwarded straight to the editor
     * with no directory check, no child enumeration, and the boolean result was
     * discarded — an unconditional success regardless of what actually happened. The
     * decision here is REFUSE, not recurse: a folder does not have importable content
     * of its own, so each child asset must be reimported by its own url (#96).
     */
    async reimportAsset(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return (0, types_1.errorResult)('reimport requires one of: url, urlOrUUID, assetPath');
        }
        try {
            const info = await Editor.Message.request('asset-db', 'query-asset-info', url).catch(() => null);
            if (info && info.isDirectory) {
                return (0, types_1.errorResult)(`reimport does not accept a folder URL ('${url}' is a directory) — this action does not ` +
                    'recurse into folder contents. Reimport each child asset individually by its own url instead.');
            }
            // Declared void by the editor typings; the runtime can still return false.
            const result = await Editor.Message.request('asset-db', 'reimport-asset', url);
            if (result === false) {
                return (0, types_1.errorResult)(`asset-db:reimport-asset returned false for '${url}' — the editor rejected the reimport.`);
            }
            return (0, types_1.successResult)({ url }, 'Asset reimported successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async queryAssetPath(url) {
        try {
            const assetPath = await Editor.Message.request('asset-db', 'query-path', url);
            if (assetPath)
                return (0, types_1.successResult)({ url, path: assetPath }, 'Asset path retrieved successfully');
            return (0, types_1.errorResult)('Asset path not found');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async queryAssetUuid(url) {
        try {
            const uuid = await Editor.Message.request('asset-db', 'query-uuid', url);
            if (uuid)
                return (0, types_1.successResult)({ url, uuid }, 'Asset UUID retrieved successfully');
            return (0, types_1.errorResult)('Asset UUID not found');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async queryAssetUrl(uuid) {
        try {
            const url = await Editor.Message.request('asset-db', 'query-url', uuid);
            if (url)
                return (0, types_1.successResult)({ uuid, url }, 'Asset URL retrieved successfully');
            return (0, types_1.errorResult)('Asset URL not found');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async findAssetByName(args) {
        const { name, exactMatch = false, assetType = 'all', folder = 'db://assets', maxResults = 20 } = args;
        try {
            const allAssetsResult = await this.getAssets(assetType, folder);
            if (!allAssetsResult.success || !allAssetsResult.data) {
                return (0, types_1.errorResult)(`Failed to get assets: ${allAssetsResult.error}`);
            }
            const allAssets = allAssetsResult.data.assets;
            const matchedAssets = [];
            for (const asset of allAssets) {
                const matches = exactMatch
                    ? asset.name === name
                    : asset.name.toLowerCase().includes(name.toLowerCase());
                if (matches) {
                    try {
                        const detailResult = await this.getAssetInfo(asset.path);
                        matchedAssets.push(detailResult.success ? Object.assign(Object.assign({}, asset), { details: detailResult.data }) : asset);
                    }
                    catch (_a) {
                        matchedAssets.push(asset);
                    }
                    if (matchedAssets.length >= maxResults)
                        break;
                }
            }
            return (0, types_1.successResult)({
                searchTerm: name, exactMatch, assetType, folder,
                totalFound: matchedAssets.length, maxResults, assets: matchedAssets
            }, `Found ${matchedAssets.length} assets matching '${name}'`);
        }
        catch (error) {
            return (0, types_1.errorResult)(`Asset search failed: ${error.message}`);
        }
    }
    async getAssetDetails(assetPath, includeSubAssets = true) {
        if (!assetPath || typeof assetPath !== 'string' || assetPath.trim() === '') {
            return (0, types_1.errorResult)('get_details requires one of: url, urlOrUUID, assetPath');
        }
        try {
            const assetInfoResult = await this.getAssetInfo(assetPath);
            if (!assetInfoResult.success)
                return assetInfoResult;
            const assetInfo = assetInfoResult.data;
            const detailedInfo = Object.assign(Object.assign({}, assetInfo), { subAssets: [] });
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
                        }
                        catch ( /* sub-asset doesn't exist, skip */_a) { /* sub-asset doesn't exist, skip */ }
                    }
                }
            }
            return (0, types_1.successResult)(Object.assign({ assetPath, includeSubAssets }, detailedInfo), `Asset details retrieved. Found ${detailedInfo.subAssets.length} sub-assets.`);
        }
        catch (error) {
            return (0, types_1.errorResult)(`Failed to get asset details: ${error.message}`);
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
    async saveAssetMeta(urlOrUUID, content) {
        var _a;
        if (!urlOrUUID || typeof urlOrUUID !== 'string' || urlOrUUID.trim() === '') {
            return (0, types_1.errorResult)('save_meta requires one of: url, urlOrUUID, assetPath');
        }
        if (content === undefined || content === null || content === '') {
            return (0, types_1.errorResult)('save_meta requires content: a JSON string of the meta fields to merge (e.g. {"userData":{...}})');
        }
        let patch;
        try {
            patch = JSON.parse(content);
        }
        catch (err) {
            return (0, types_1.errorResult)(`save_meta content is not valid JSON: ${err.message}`);
        }
        try {
            const currentMeta = await Editor.Message.request('asset-db', 'query-asset-meta', urlOrUUID);
            if (!currentMeta) {
                return (0, types_1.errorResult)(`Could not read current meta for '${urlOrUUID}' — asset not found in the asset DB.`);
            }
            const mergedMeta = Object.assign(Object.assign({}, currentMeta), patch);
            const result = await Editor.Message.request('asset-db', 'save-asset-meta', urlOrUUID, JSON.stringify(mergedMeta));
            return (0, types_1.successResult)({ uuid: (_a = result === null || result === void 0 ? void 0 : result.uuid) !== null && _a !== void 0 ? _a : mergedMeta.uuid, url: result === null || result === void 0 ? void 0 : result.url }, 'Asset meta saved successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async generateAvailableUrl(url) {
        try {
            const availableUrl = await Editor.Message.request('asset-db', 'generate-available-url', url);
            return (0, types_1.successResult)({
                originalUrl: url, availableUrl,
                message: availableUrl === url ? 'URL is available' : 'Generated new available URL'
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async queryAssetDbReady() {
        try {
            const ready = await Editor.Message.request('asset-db', 'query-ready');
            return (0, types_1.successResult)({ ready, message: ready ? 'Asset database is ready' : 'Asset database is not ready' });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async openAssetExternal(urlOrUUID) {
        try {
            await Editor.Message.request('asset-db', 'open-asset', urlOrUUID);
            return (0, types_1.successResult)(null, 'Asset opened with external program');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async batchImportAssets(args) {
        try {
            const overwrite = args.overwrite === true || args.overwrite === 'true';
            const recursive = args.recursive === true || args.recursive === 'true';
            if (!validateAssetPath(args.targetDirectory || '')) {
                return (0, types_1.errorResult)('Invalid targetDirectory: must be db:// URL or assets/ relative path without traversal');
            }
            if (!fs.existsSync(args.sourceDirectory))
                return (0, types_1.errorResult)('Source directory does not exist');
            const files = this.getFilesFromDirectory(args.sourceDirectory, args.fileFilter || [], recursive);
            const importResults = [];
            let successCount = 0;
            let errorCount = 0;
            for (const filePath of files) {
                try {
                    const fileName = path.basename(filePath);
                    const targetPath = `${args.targetDirectory}/${fileName}`;
                    const result = await Editor.Message.request('asset-db', 'import-asset', filePath, targetPath, { overwrite, rename: !overwrite });
                    importResults.push({ source: filePath, target: targetPath, success: true, uuid: result === null || result === void 0 ? void 0 : result.uuid });
                    successCount++;
                }
                catch (err) {
                    importResults.push({ source: filePath, success: false, error: err.message });
                    errorCount++;
                }
            }
            return (0, types_1.successResult)({ totalFiles: files.length, successCount, errorCount, results: importResults }, `Batch import completed: ${successCount} success, ${errorCount} errors`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    getFilesFromDirectory(dirPath, fileFilter, recursive) {
        const files = [];
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                if (fileFilter.length === 0 || fileFilter.some(ext => item.toLowerCase().endsWith(ext.toLowerCase()))) {
                    files.push(fullPath);
                }
            }
            else if (stat.isDirectory() && recursive) {
                files.push(...this.getFilesFromDirectory(fullPath, fileFilter, recursive));
            }
        }
        return files;
    }
    async batchDeleteAssets(urls) {
        try {
            const deleteResults = [];
            let successCount = 0;
            let errorCount = 0;
            for (const url of urls) {
                try {
                    await Editor.Message.request('asset-db', 'delete-asset', url);
                    deleteResults.push({ url, success: true });
                    successCount++;
                }
                catch (err) {
                    deleteResults.push({ url, success: false, error: err.message });
                    errorCount++;
                }
            }
            return (0, types_1.successResult)({ totalAssets: urls.length, successCount, errorCount, results: deleteResults }, `Batch delete completed: ${successCount} success, ${errorCount} errors`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async validateAssetReferences(directory = 'db://assets') {
        try {
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });
            const brokenReferences = [];
            const validReferences = [];
            for (const asset of assets) {
                try {
                    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                    if (assetInfo)
                        validReferences.push({ url: asset.url, uuid: asset.uuid, name: asset.name });
                }
                catch (err) {
                    brokenReferences.push({ url: asset.url, uuid: asset.uuid, name: asset.name, error: err.message });
                }
            }
            return (0, types_1.successResult)({
                directory, totalAssets: assets.length,
                validReferences: validReferences.length, brokenReferences: brokenReferences.length,
                brokenAssets: brokenReferences
            }, `Validation completed: ${brokenReferences.length} broken references found`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
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
    async getAssetDependencies(urlOrUUID, direction = 'dependencies') {
        var _a, _b;
        if (!urlOrUUID || typeof urlOrUUID !== 'string' || urlOrUUID.trim() === '') {
            return (0, types_1.errorResult)('get_dependencies requires one of: url, urlOrUUID, assetPath — naming the asset to analyze');
        }
        const info = await Editor.Message.request('asset-db', 'query-asset-info', urlOrUUID).catch(() => null);
        if (!info || !info.uuid) {
            return (0, types_1.errorResult)(`Asset '${urlOrUUID}' not found in the asset DB — nothing to analyze. ` +
                'If the file was written outside the editor, run manage_asset action=refresh first.');
        }
        const wantsDependents = direction === 'dependents' || direction === 'both';
        const wantsDependencies = direction === 'dependencies' || direction === 'both';
        const data = {
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
            wantsDependents ? `${(_a = data.dependentCount) !== null && _a !== void 0 ? _a : 0} dependent asset(s) via ${data.dependentsSource}` : null,
            wantsDependencies ? `${(_b = data.dependencyCount) !== null && _b !== void 0 ? _b : 0} dependency/dependencies via ${data.dependenciesSource}` : null,
        ].filter(Boolean).join(', ');
        return (0, types_1.successResult)(data, `Resolved ${info.name || info.url}: ${summary}`);
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
    async queryAssetDependencies(uuid) {
        try {
            const result = await Editor.Message.request('asset-db', 'query-asset-dependencies', uuid, 'all');
            const list = Array.isArray(result) ? result : [];
            return { assets: list.map((dep) => (typeof dep === 'string' ? { uuid: dep } : dep)), source: 'asset-db query-asset-dependencies' };
        }
        catch (_a) {
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
    async queryAssetDependents(uuid, urlOrUUID) {
        const assets = [];
        const sources = [];
        try {
            const result = await Editor.Message.request('asset-db', 'query-asset-users', uuid, 'all');
            const list = Array.isArray(result) ? result : [];
            for (const dep of list)
                assets.push(typeof dep === 'string' ? { uuid: dep } : dep);
            sources.push('asset-db query-asset-users');
        }
        catch (_a) {
            // Not available in this build — the scene scan below is the whole answer.
        }
        let nodes = [];
        try {
            const nodeUuids = await Editor.Message.request('scene', 'query-nodes-by-asset-uuid', uuid);
            nodes = Array.isArray(nodeUuids) ? nodeUuids : [];
            if (nodes.length > 0)
                sources.push('scene query-nodes-by-asset-uuid');
        }
        catch (_b) {
            // No reverse scene lookup either; `sources` stays empty and is reported as such.
        }
        return {
            assets,
            nodes,
            source: sources.length > 0 ? sources.join(' + ') : `no reverse-reference query available for '${urlOrUUID}' in this editor build`
        };
    }
    async exportAssetManifest(directory = 'db://assets', format = 'json', includeMetadata = true) {
        try {
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });
            const manifest = [];
            for (const asset of assets) {
                const manifestEntry = {
                    name: asset.name, url: asset.url, uuid: asset.uuid,
                    type: asset.type, size: asset.size || 0, isDirectory: asset.isDirectory || false
                };
                if (includeMetadata) {
                    try {
                        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                        if (assetInfo && assetInfo.meta)
                            manifestEntry.meta = assetInfo.meta;
                    }
                    catch ( /* skip metadata if not available */_a) { /* skip metadata if not available */ }
                }
                manifest.push(manifestEntry);
            }
            let exportData;
            switch (format) {
                case 'csv':
                    exportData = this.convertToCSV(manifest);
                    break;
                case 'xml':
                    exportData = this.convertToXML(manifest);
                    break;
                default: exportData = JSON.stringify(manifest, null, 2);
            }
            return (0, types_1.successResult)({ directory, format, assetCount: manifest.length, includeMetadata, manifest: exportData }, `Asset manifest exported with ${manifest.length} assets`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    convertToCSV(data) {
        if (data.length === 0)
            return '';
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
    convertToXML(data) {
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
exports.ManageAsset = ManageAsset;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvQ0FBd0U7QUFDeEUseURBQW9EO0FBQ3BELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7OztHQUdHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxTQUFpQjtJQUN4QyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM5RCxxREFBcUQ7SUFDckQsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQy9DLHdDQUF3QztJQUN4QyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3RHLDZDQUE2QztJQUM3QyxPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDM0MsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEtBQWE7SUFDakMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1FBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEQsb0NBQW9DO0lBQ3BDLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFBRSxLQUFLLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQztJQUNwRCxxREFBcUQ7SUFDckQsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FB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Q0FBQyxDQUFDO1FBQ25DLENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVPLFlBQVksQ0FBQyxJQUFXO1FBQzVCLElBQUksR0FBRyxHQUFHLG9EQUFvRCxDQUFDO1FBQy9ELEtBQUssTUFBTSxJQUFJLElBQUksSUFBSSxFQUFFLENBQUM7WUFDdEIsR0FBRyxJQUFJLGFBQWEsQ0FBQztZQUNyQixLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUM5QyxNQUFNLFFBQVEsR0FBRyxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQztvQkFDeEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO29CQUN2QixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7Z0JBQ3JGLEdBQUcsSUFBSSxRQUFRLEdBQUcsSUFBSSxRQUFRLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDaEQsQ0FBQztZQUNELEdBQUcsSUFBSSxjQUFjLENBQUM7UUFDMUIsQ0FBQztRQUNELEdBQUcsSUFBSSxXQUFXLENBQUM7UUFDbkIsT0FBTyxHQUFHLENBQUM7SUFDZixDQUFDO0NBQ0o7QUE3eEJELGtDQTZ4QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBwYXRoIGlzIHNhZmUgZm9yIGFzc2V0IG9wZXJhdGlvbnMuXG4gKiBSZWplY3RzIHRyYXZlcnNhbCBwYXR0ZXJucyBhbmQgYmFyZSBhYnNvbHV0ZSBwYXRocyAobm9uLWRiOi8vIGZvcm0pLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUFzc2V0UGF0aChhc3NldFBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghYXNzZXRQYXRoIHx8IHR5cGVvZiBhc3NldFBhdGggIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gQWxsb3cgZGI6Ly8gcHJvdG9jb2wgcGF0aHMgKENvY29zIGFzc2V0IERCIGZvcm1hdClcbiAgICBpZiAoYXNzZXRQYXRoLnN0YXJ0c1dpdGgoJ2RiOi8vJykpIHJldHVybiB0cnVlO1xuICAgIC8vIFJlamVjdCB0cmF2ZXJzYWwgcGF0dGVybnMgaW4gYW55IGZvcm1cbiAgICBpZiAoYXNzZXRQYXRoLmluY2x1ZGVzKCcuLicpIHx8IGFzc2V0UGF0aC5zdGFydHNXaXRoKCcvJykgfHwgYXNzZXRQYXRoLmluY2x1ZGVzKCdcXFxcLi4nKSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vIE11c3Qgc3RhcnQgd2l0aCBhc3NldHMvIGZvciByZWxhdGl2ZSBwYXRoc1xuICAgIHJldHVybiBhc3NldFBhdGguc3RhcnRzV2l0aCgnYXNzZXRzLycpO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVDc3ZGaWVsZChmaWVsZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIGZpZWxkICE9PSAnc3RyaW5nJykgcmV0dXJuIFN0cmluZyhmaWVsZCk7XG4gICAgLy8gRXNjYXBlIGZvcm11bGEgaW5qZWN0aW9uIHByZWZpeGVzXG4gICAgaWYgKC9eWz0rXFwtQFxcdFxccl0vLnRlc3QoZmllbGQpKSBmaWVsZCA9IFwiJ1wiICsgZmllbGQ7XG4gICAgLy8gV3JhcCBpbiBxdW90ZXMgaWYgY29udGFpbnMgY29tbWEsIHF1b3RlIG9yIG5ld2xpbmVcbiAgICBpZiAoZmllbGQuaW5jbHVkZXMoJywnKSB8fCBmaWVsZC5pbmNsdWRlcygnXCInKSB8fCBmaWVsZC5pbmNsdWRlcygnXFxuJykpIHtcbiAgICAgICAgcmV0dXJuICdcIicgKyBmaWVsZC5yZXBsYWNlKC9cIi9nLCAnXCJcIicpICsgJ1wiJztcbiAgICB9XG4gICAgcmV0dXJuIGZpZWxkO1xufVxuXG4vKipcbiAqIEltcG9ydGVyIG5hbWVzIGZvciBhc3NldCBraW5kcyB3aG9zZSBzZXJpYWxpemVkIGZpbGUgaXMgbm90IHRleHQg4oCUIHdyaXRpbmcgYW5cbiAqIGFyYml0cmFyeSBzdHJpbmcgb3ZlciBvbmUgb2YgdGhlc2UgKHZpYSBgc2F2ZWApIHdvdWxkIGNvcnJ1cHQgaXQgcmF0aGVyIHRoYW4gdXBkYXRlXG4gKiBpdC4gS2VwdCBhbG9uZ3NpZGUgdGhlIGV4dGVuc2lvbiBjaGVjayBiZWxvdyBzaW5jZSBub3QgZXZlcnkgYXNzZXQgbG9va3VwIHJldHVybnMgYW5cbiAqIGBpbXBvcnRlcmAgKCM5OSBpdGVtIDEpLlxuICovXG5jb25zdCBCSU5BUllfSU1QT1JURVJfTkFNRVMgPSBuZXcgU2V0KFtcbiAgICAnaW1hZ2UnLCAndGV4dHVyZScsICd0ZXh0dXJlLWN1YmUnLCAnZXJwLXRleHR1cmUtY3ViZScsICdzcHJpdGUtZnJhbWUnLFxuICAgICdhdWRpby1jbGlwJywgJ3ZpZGVvLWNsaXAnLCAndHRmLWZvbnQnLCAnYml0bWFwLWZvbnQnLFxuICAgICdkcmFnb25ib25lcycsICdkcmFnb25ib25lcy1hdGxhcycsICdzcGluZS1kYXRhJyxcbiAgICAnZ2x0ZicsICdnbHRmLW1lc2gnLCAnZ2x0Zi1tYXRlcmlhbCcsICdnbHRmLWVtYmVkZWQtaW1hZ2UnLCAnZ2x0Zi1zY2VuZScsICdmYngnLCAnYnVmZmVyJ1xuXSk7XG5cbmNvbnN0IEJJTkFSWV9FWFRFTlNJT05TID0gbmV3IFNldChbXG4gICAgJy5wbmcnLCAnLmpwZycsICcuanBlZycsICcuZ2lmJywgJy5ibXAnLCAnLnRnYScsICcucHNkJywgJy53ZWJwJyxcbiAgICAnLm1wMycsICcub2dnJywgJy53YXYnLCAnLm00YScsICcudHRmJywgJy5vdGYnLCAnLmZudCcsXG4gICAgJy5mYngnLCAnLm9iaicsICcuZGFlJywgJy5nbGInLCAnLmdsdGYnLCAnLm1wNCcsICcud2VibSdcbl0pO1xuXG4vKiogVHJ1ZSB3aGVuIGBhc3NldEluZm9gL2B1cmxPclBhdGhgIG5hbWVzIGEgYmluYXJ5IGFzc2V0IGtpbmQgdGhhdCBgc2F2ZWAgbXVzdCByZWZ1c2UuICovXG5mdW5jdGlvbiBpc0JpbmFyeUFzc2V0KGFzc2V0SW5mbzogYW55LCB1cmxPclBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmIChhc3NldEluZm8gJiYgdHlwZW9mIGFzc2V0SW5mby5pbXBvcnRlciA9PT0gJ3N0cmluZycgJiYgQklOQVJZX0lNUE9SVEVSX05BTUVTLmhhcyhhc3NldEluZm8uaW1wb3J0ZXIpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjb25zdCBleHQgPSBwYXRoLmV4dG5hbWUodXJsT3JQYXRoIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIHJldHVybiBCSU5BUllfRVhURU5TSU9OUy5oYXMoZXh0KTtcbn1cblxuLyoqXG4gKiBDb25zb2xpZGF0ZWQgYXNzZXQgbWFuYWdlbWVudCB0b29sLlxuICogQ29tYmluZXMgUHJvamVjdFRvb2xzIChhc3NldCBtZXRob2RzKSArIEFzc2V0QWR2YW5jZWRUb29scyBpbnRvIG9uZSBhY3Rpb24tYmFzZWQgdG9vbC5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZUFzc2V0IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2Fzc2V0JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgYXNzZXRzIGluIHRoZSBwcm9qZWN0IChmaWxlcywgdGV4dHVyZXMsIHNjcmlwdHMsIGV0YykuIEFjdGlvbnM6IGltcG9ydCwgZ2V0X2luZm8sIGxpc3QsIHJlZnJlc2gsIGNyZWF0ZSwgY29weSwgbW92ZSwgZGVsZXRlLCBzYXZlLCByZWltcG9ydCwgcXVlcnlfcGF0aCwgcXVlcnlfdXVpZCwgcXVlcnlfdXJsLCBmaW5kX2J5X25hbWUsIGdldF9kZXRhaWxzLCBzYXZlX21ldGEsIGdlbmVyYXRlX3VybCwgcXVlcnlfZGJfcmVhZHksIG9wZW5fZXh0ZXJuYWwsIGJhdGNoX2ltcG9ydCwgYmF0Y2hfZGVsZXRlLCB2YWxpZGF0ZV9yZWZlcmVuY2VzLCBnZXRfZGVwZW5kZW5jaWVzLCBleHBvcnRfbWFuaWZlc3QuIE5PVCBmb3Igc2NlbmUgbm9kZXMg4oCUIHVzZSBtYW5hZ2Vfbm9kZS4gVXNlIHF1ZXJ5X2RiX3JlYWR5IHRvIGNoZWNrIGFzc2V0IERCIGJlZm9yZSBiYXRjaCBvcHMuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xuICAgICAgICAnaW1wb3J0JywgJ2dldF9pbmZvJywgJ2xpc3QnLCAncmVmcmVzaCcsICdjcmVhdGUnLCAnY29weScsICdtb3ZlJywgJ2RlbGV0ZScsXG4gICAgICAgICdzYXZlJywgJ3JlaW1wb3J0JywgJ3F1ZXJ5X3BhdGgnLCAncXVlcnlfdXVpZCcsICdxdWVyeV91cmwnLCAnZmluZF9ieV9uYW1lJyxcbiAgICAgICAgJ2dldF9kZXRhaWxzJywgJ3NhdmVfbWV0YScsICdnZW5lcmF0ZV91cmwnLCAncXVlcnlfZGJfcmVhZHknLCAnb3Blbl9leHRlcm5hbCcsXG4gICAgICAgICdiYXRjaF9pbXBvcnQnLCAnYmF0Y2hfZGVsZXRlJywgJ3ZhbGlkYXRlX3JlZmVyZW5jZXMnLCAnZ2V0X2RlcGVuZGVuY2llcycsXG4gICAgICAgICdleHBvcnRfbWFuaWZlc3QnXG4gICAgXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybScsXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc291cmNlUGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgZmlsZSBwYXRoIG9uIGRpc2sgKGZvciBpbXBvcnQpJyB9LFxuICAgICAgICAgICAgdGFyZ2V0Rm9sZGVyOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBmb2xkZXIgVVJMIChmb3IgaW1wb3J0KScgfSxcbiAgICAgICAgICAgIGFzc2V0UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBwYXRoIChkYjovL2Fzc2V0cy8uLi4pJyB9LFxuICAgICAgICAgICAgdXJsT3JVVUlEOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVSTCBvciBVVUlEJyB9LFxuICAgICAgICAgICAgdXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVSTCAoZGI6Ly9hc3NldHMvLi4uKScgfSxcbiAgICAgICAgICAgIHV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgVVVJRCcgfSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRmlsZSBjb250ZW50IG9yIG1ldGEgY29udGVudCcgfSxcbiAgICAgICAgICAgIG92ZXJ3cml0ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnT3ZlcndyaXRlIGV4aXN0aW5nIGZpbGUnLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgc291cmNlOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBhc3NldCBVUkwgKGZvciBjb3B5L21vdmUpJyB9LFxuICAgICAgICAgICAgdGFyZ2V0OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBhc3NldCBVUkwgKGZvciBjb3B5L21vdmUpJyB9LFxuICAgICAgICAgICAgZm9sZGVyOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZvbGRlciB0byBzZWFyY2gvbGlzdCcsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cycgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IHR5cGUgZmlsdGVyJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdzY2VuZScsICdwcmVmYWInLCAnc2NyaXB0JywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnbWVzaCcsICdhdWRpbycsICdhbmltYXRpb24nXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgbmFtZSB0byBzZWFyY2ggZm9yJyB9LFxuICAgICAgICAgICAgZXhhY3RNYXRjaDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnRXhhY3QgbmFtZSBtYXRjaCcsIGRlZmF1bHQ6IGZhbHNlIH0sXG4gICAgICAgICAgICBhc3NldFR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZpbHRlciBieSBhc3NldCB0eXBlJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdzY2VuZScsICdwcmVmYWInLCAnc2NyaXB0JywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnbWVzaCcsICdhdWRpbycsICdhbmltYXRpb24nLCAnc3ByaXRlRnJhbWUnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heFJlc3VsdHM6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnTWF4IHJlc3VsdHMgZm9yIGZpbmRfYnlfbmFtZScsIGRlZmF1bHQ6IDIwLCBtaW5pbXVtOiAxLCBtYXhpbXVtOiAxMDAgfSxcbiAgICAgICAgICAgIGluY2x1ZGVTdWJBc3NldHM6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0luY2x1ZGUgc3ViLWFzc2V0cyAoc3ByaXRlRnJhbWUsIHRleHR1cmUpJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICAgICAgc291cmNlRGlyZWN0b3J5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBkaXJlY3RvcnkgZm9yIGJhdGNoX2ltcG9ydCcgfSxcbiAgICAgICAgICAgIHRhcmdldERpcmVjdG9yeTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgZGlyZWN0b3J5IFVSTCBmb3IgYmF0Y2hfaW1wb3J0JyB9LFxuICAgICAgICAgICAgZmlsZUZpbHRlcjogeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCBkZXNjcmlwdGlvbjogJ0ZpbGUgZXh0ZW5zaW9ucyBmaWx0ZXInLCBkZWZhdWx0OiBbXSB9LFxuICAgICAgICAgICAgcmVjdXJzaXZlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdJbmNsdWRlIHN1YmRpcmVjdG9yaWVzJywgZGVmYXVsdDogZmFsc2UgfSxcbiAgICAgICAgICAgIHVybHM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdBcnJheSBvZiBhc3NldCBVUkxzIGZvciBiYXRjaF9kZWxldGUnIH0sXG4gICAgICAgICAgICBkaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRGlyZWN0b3J5IHRvIHNjYW4nLCBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnIH0sXG4gICAgICAgICAgICBleGNsdWRlRGlyZWN0b3JpZXM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdEaXJlY3RvcmllcyB0byBleGNsdWRlJywgZGVmYXVsdDogW10gfSxcbiAgICAgICAgICAgIGRpcmVjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRGVwZW5kZW5jeSBkaXJlY3Rpb24gZm9yIGdldF9kZXBlbmRlbmNpZXMnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZGVwZW5kZW50cycsICdkZXBlbmRlbmNpZXMnLCAnYm90aCddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkZXBlbmRlbmNpZXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybWF0OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGb3JtYXQgZm9yIGV4cG9ydF9tYW5pZmVzdCcsXG4gICAgICAgICAgICAgICAgZW51bTogWydhdXRvJywgJ2pwZycsICdwbmcnLCAnd2VicCcsICdqc29uJywgJ2NzdicsICd4bWwnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYXV0bydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbmNsdWRlTWV0YWRhdGE6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0luY2x1ZGUgYXNzZXQgbWV0YWRhdGEgaW4gbWFuaWZlc3QnLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgICAgICBpc0ZvbGRlcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEV4cGxpY2l0bHkgY3JlYXRlIGEgZm9sZGVyLCByZWdhcmRsZXNzIG9mIGBjb250ZW50YC4gVXNlIHRoaXMgaW5zdGVhZCBvZiBvbWl0dGluZyBgY29udGVudGAg4oCUIG1hbnkgTUNQIHRyYW5zcG9ydHMgY29lcmNlIGFuIG9taXR0ZWQgb3B0aW9uYWwgc3RyaW5nIHRvIGBcIlwiYCwgd2hpY2ggb3RoZXJ3aXNlIG1ha2VzIGZvbGRlciBjcmVhdGlvbiB1bnJlYWNoYWJsZS4nLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIGBtYW5hZ2VfYXNzZXRgIGFjdGlvbnMgaGlzdG9yaWNhbGx5IHJlYWQgYSBkaWZmZXJlbnQgYWxpYXMgZm9yIHRoZSBzYW1lIFwiYXNzZXRcbiAgICAgKiByZWZlcmVuY2VcIiBjb25jZXB0IOKAlCBzb21lIGB1cmxgLCBzb21lIGBhc3NldFBhdGhgLCBzb21lIGB1cmxPclVVSURgIOKAlCB3aXRoIG5vXG4gICAgICogc2NoZW1hIHNpZ25hbCBhYm91dCB3aGljaCBuYW1lIGEgZ2l2ZW4gYWN0aW9uIGV4cGVjdGVkLiBBIGNhbGxlciBwYXNzaW5nIHRoZVxuICAgICAqIGRvY3VtZW50ZWQgYGFzc2V0UGF0aGAgdG8gYGNyZWF0ZWAgc2lsZW50bHkgZm9yd2FyZGVkIGB1bmRlZmluZWRgLCBzdXJmYWNpbmcgYXNcbiAgICAgKiB0aGUgZWRpdG9yJ3Mgb3duIHVucmVsYXRlZCBgXCJvcHRpb25zLnRhcmdldCBpcyByZXF1aXJlZFwiYCBlcnJvciAoIzgwLCAjOTkgaXRlbSA3KS5cbiAgICAgKiBFdmVyeSBhY3Rpb24gYmVsb3cgbm93IHJlc29sdmVzIHRocm91Z2ggdGhpcyBzYW1lIGFsaWFzIHNldC5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlc29sdmVBc3NldEFyZyhhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICAgICAgcmV0dXJuIGFyZ3MudXJsIHx8IGFyZ3MudXJsT3JVVUlEIHx8IGFyZ3MuYXNzZXRQYXRoIHx8IHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgaW1wb3J0OiAoYXJncykgPT4gdGhpcy5pbXBvcnRBc3NldChhcmdzLnNvdXJjZVBhdGgsIGFyZ3MudGFyZ2V0Rm9sZGVyKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0SW5mbyh0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSksXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0cyhhcmdzLnR5cGUsIGFyZ3MuZm9sZGVyKSxcbiAgICAgICAgLy8gYGZvbGRlcmAgaXMgdGhlIGludGVuZGVkIHNjb3BlIHBhcmFtOyBmYWxsIGJhY2sgdG8gdGhlIGFzc2V0LXJlZiBhbGlhc2VzIG9ubHlcbiAgICAgICAgLy8gd2hlbiBpdCBpcyBvbWl0dGVkLCBzbyBwYXNzaW5nIGB1cmxgIGluc3RlYWQgb2YgYGZvbGRlcmAgY2FuIG5ldmVyIHNpbGVudGx5XG4gICAgICAgIC8vIHdpZGVuIHRoZSByZWZyZXNoIHRvIHRoZSB3aG9sZSBwcm9qZWN0IChgZGI6Ly9hc3NldHNgKSDigJQgc2VlIHJlZnJlc2hBc3NldHMoKS5cbiAgICAgICAgcmVmcmVzaDogKGFyZ3MpID0+IHRoaXMucmVmcmVzaEFzc2V0cyhhcmdzLmZvbGRlciB8fCB0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSksXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlQXNzZXQoXG4gICAgICAgICAgICB0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSxcbiAgICAgICAgICAgIGFyZ3MuY29udGVudCA/PyBudWxsLFxuICAgICAgICAgICAgYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJyxcbiAgICAgICAgICAgIGFyZ3MuaXNGb2xkZXIgPT09IHRydWUgfHwgYXJncy5pc0ZvbGRlciA9PT0gJ3RydWUnXG4gICAgICAgICksXG4gICAgICAgIGNvcHk6IChhcmdzKSA9PiB0aGlzLmNvcHlBc3NldChhcmdzLnNvdXJjZSwgYXJncy50YXJnZXQsIGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZScpLFxuICAgICAgICBtb3ZlOiAoYXJncykgPT4gdGhpcy5tb3ZlQXNzZXQoYXJncy5zb3VyY2UsIGFyZ3MudGFyZ2V0LCBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnKSxcbiAgICAgICAgZGVsZXRlOiAoYXJncykgPT4gdGhpcy5kZWxldGVBc3NldCh0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSksXG4gICAgICAgIHNhdmU6IChhcmdzKSA9PiB0aGlzLnNhdmVBc3NldCh0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSwgYXJncy5jb250ZW50KSxcbiAgICAgICAgcmVpbXBvcnQ6IChhcmdzKSA9PiB0aGlzLnJlaW1wb3J0QXNzZXQodGhpcy5yZXNvbHZlQXNzZXRBcmcoYXJncykpLFxuICAgICAgICBxdWVyeV9wYXRoOiAoYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0UGF0aChhcmdzLnVybCB8fCBhcmdzLnVybE9yVVVJRCksXG4gICAgICAgIHF1ZXJ5X3V1aWQ6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRVdWlkKGFyZ3MudXJsKSxcbiAgICAgICAgcXVlcnlfdXJsOiAoYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0VXJsKGFyZ3MudXVpZCksXG4gICAgICAgIGZpbmRfYnlfbmFtZTogKGFyZ3MpID0+IHRoaXMuZmluZEFzc2V0QnlOYW1lKGFyZ3MpLFxuICAgICAgICBnZXRfZGV0YWlsczogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXREZXRhaWxzKHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpLCBhcmdzLmluY2x1ZGVTdWJBc3NldHMgIT09IGZhbHNlKSxcbiAgICAgICAgc2F2ZV9tZXRhOiAoYXJncykgPT4gdGhpcy5zYXZlQXNzZXRNZXRhKHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpLCBhcmdzLmNvbnRlbnQpLFxuICAgICAgICBnZW5lcmF0ZV91cmw6IChhcmdzKSA9PiB0aGlzLmdlbmVyYXRlQXZhaWxhYmxlVXJsKGFyZ3MudXJsKSxcbiAgICAgICAgcXVlcnlfZGJfcmVhZHk6IChfYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0RGJSZWFkeSgpLFxuICAgICAgICBvcGVuX2V4dGVybmFsOiAoYXJncykgPT4gdGhpcy5vcGVuQXNzZXRFeHRlcm5hbChhcmdzLnVybE9yVVVJRCksXG4gICAgICAgIGJhdGNoX2ltcG9ydDogKGFyZ3MpID0+IHRoaXMuYmF0Y2hJbXBvcnRBc3NldHMoYXJncyksXG4gICAgICAgIGJhdGNoX2RlbGV0ZTogKGFyZ3MpID0+IHRoaXMuYmF0Y2hEZWxldGVBc3NldHMoYXJncy51cmxzKSxcbiAgICAgICAgdmFsaWRhdGVfcmVmZXJlbmNlczogKGFyZ3MpID0+IHRoaXMudmFsaWRhdGVBc3NldFJlZmVyZW5jZXMoYXJncy5kaXJlY3RvcnkpLFxuICAgICAgICAvLyBSb3V0ZXMgdGhyb3VnaCBgcmVzb2x2ZUFzc2V0QXJnYCBsaWtlIGV2ZXJ5IG90aGVyIGFzc2V0LXJlZiBhY3Rpb24uIEl0IHVzZWQgdG9cbiAgICAgICAgLy8gcmVhZCBgYXJncy51cmxPclVVSURgIGFsb25lLCBzbyBhIGNhbGxlciB1c2luZyB0aGUgc2NoZW1hLWRvY3VtZW50ZWQgYHVybGAgb3JcbiAgICAgICAgLy8gYGFzc2V0UGF0aGAgc3BlbGxpbmcgcmVhY2hlZCB0aGUgaGFuZGxlciB3aXRoIGB1bmRlZmluZWRgICgjMTI0KS5cbiAgICAgICAgZ2V0X2RlcGVuZGVuY2llczogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXREZXBlbmRlbmNpZXModGhpcy5yZXNvbHZlQXNzZXRBcmcoYXJncyksIGFyZ3MuZGlyZWN0aW9uKSxcbiAgICAgICAgZXhwb3J0X21hbmlmZXN0OiAoYXJncykgPT4gdGhpcy5leHBvcnRBc3NldE1hbmlmZXN0KGFyZ3MuZGlyZWN0b3J5LCBhcmdzLmZvcm1hdCwgYXJncy5pbmNsdWRlTWV0YWRhdGEgIT09IGZhbHNlKVxuICAgIH07XG5cbiAgICAvLyDilIDilIAgRnJvbSBQcm9qZWN0VG9vbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBwcml2YXRlIGFzeW5jIGltcG9ydEFzc2V0KHNvdXJjZVBhdGg6IHN0cmluZywgdGFyZ2V0Rm9sZGVyOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNvdXJjZVBhdGgpKSByZXR1cm4gZXJyb3JSZXN1bHQoJ1NvdXJjZSBmaWxlIG5vdCBmb3VuZCcpO1xuICAgICAgICBpZiAoIXZhbGlkYXRlQXNzZXRQYXRoKHRhcmdldEZvbGRlcikpIHJldHVybiBlcnJvclJlc3VsdCgnSW52YWxpZCB0YXJnZXQgZm9sZGVyIHBhdGg6IG11c3QgYmUgZGI6Ly8gVVJMIG9yIGFzc2V0cy8gcmVsYXRpdmUgcGF0aCB3aXRob3V0IHRyYXZlcnNhbCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKHNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHRhcmdldEZvbGRlci5zdGFydHNXaXRoKCdkYjovLycpID8gdGFyZ2V0Rm9sZGVyIDogYGRiOi8vYXNzZXRzLyR7dGFyZ2V0Rm9sZGVyfWA7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2ltcG9ydC1hc3NldCcsIHNvdXJjZVBhdGgsIGAke3RhcmdldFBhdGh9LyR7ZmlsZU5hbWV9YCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQ6IHJlc3VsdC51dWlkLCBwYXRoOiByZXN1bHQudXJsLCBtZXNzYWdlOiBgQXNzZXQgaW1wb3J0ZWQ6ICR7ZmlsZU5hbWV9YCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0SW5mbyhhc3NldFBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhc3NldFBhdGggfHwgdHlwZW9mIGFzc2V0UGF0aCAhPT0gJ3N0cmluZycgfHwgYXNzZXRQYXRoLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnZ2V0X2luZm8gcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0UGF0aCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykgcmV0dXJuIGVycm9yUmVzdWx0KCdBc3NldCBub3QgZm91bmQnKTtcbiAgICAgICAgICAgIGNvbnN0IGluZm86IGFueSA9IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhc3NldEluZm8ubmFtZSxcbiAgICAgICAgICAgICAgICB1dWlkOiBhc3NldEluZm8udXVpZCxcbiAgICAgICAgICAgICAgICBwYXRoOiBhc3NldEluZm8udXJsLFxuICAgICAgICAgICAgICAgIHR5cGU6IGFzc2V0SW5mby50eXBlLFxuICAgICAgICAgICAgICAgIHNpemU6IGFzc2V0SW5mby5zaXplLFxuICAgICAgICAgICAgICAgIGlzRGlyZWN0b3J5OiBhc3NldEluZm8uaXNEaXJlY3RvcnlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoYXNzZXRJbmZvLm1ldGEpIHtcbiAgICAgICAgICAgICAgICBpbmZvLm1ldGEgPSB7IHZlcjogYXNzZXRJbmZvLm1ldGEudmVyLCBpbXBvcnRlcjogYXNzZXRJbmZvLm1ldGEuaW1wb3J0ZXIgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGluZm8pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXRzKHR5cGU6IHN0cmluZyA9ICdhbGwnLCBmb2xkZXI6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBwYXR0ZXJuID0gYCR7Zm9sZGVyfS8qKi8qYDtcbiAgICAgICAgICAgIGlmICh0eXBlICE9PSAnYWxsJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGVFeHRlbnNpb25zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICAgICAgICAgICAnc2NlbmUnOiAnLnNjZW5lJywgJ3ByZWZhYic6ICcucHJlZmFiJywgJ3NjcmlwdCc6ICcue3RzLGpzfScsXG4gICAgICAgICAgICAgICAgICAgICd0ZXh0dXJlJzogJy57cG5nLGpwZyxqcGVnLGdpZix0Z2EsYm1wLHBzZH0nLCAnbWF0ZXJpYWwnOiAnLm10bCcsXG4gICAgICAgICAgICAgICAgICAgICdtZXNoJzogJy57ZmJ4LG9iaixkYWV9JywgJ2F1ZGlvJzogJy57bXAzLG9nZyx3YXYsbTRhfScsICdhbmltYXRpb24nOiAnLnthbmltLGNsaXB9J1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gdHlwZUV4dGVuc2lvbnNbdHlwZV07XG4gICAgICAgICAgICAgICAgaWYgKGV4dGVuc2lvbikgcGF0dGVybiA9IGAke2ZvbGRlcn0vKiovKiR7ZXh0ZW5zaW9ufWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzOiBhbnlbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHJlc3VsdHMubWFwKGFzc2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSwgdXVpZDogYXNzZXQudXVpZCwgcGF0aDogYXNzZXQudXJsLFxuICAgICAgICAgICAgICAgIHR5cGU6IGFzc2V0LnR5cGUsIHNpemU6IGFzc2V0LnNpemUgfHwgMCwgaXNEaXJlY3Rvcnk6IGFzc2V0LmlzRGlyZWN0b3J5IHx8IGZhbHNlXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHR5cGUsIGZvbGRlciwgY291bnQ6IGFzc2V0cy5sZW5ndGgsIGFzc2V0cyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgZm9sZGVyYCBpcyB0aGUgaW50ZW5kZWQgc2NvcGUgZm9yIHRoaXMgYWN0aW9uOyB0aGUgZGlzcGF0Y2ggdGFibGUgbm93IGZhbGxzXG4gICAgICogYmFjayB0byB0aGUgYXNzZXQtcmVmIGFsaWFzZXMgKGB1cmxgL2B1cmxPclVVSURgL2Bhc3NldFBhdGhgKSBvbmx5IHdoZW4gYGZvbGRlcmBcbiAgICAgKiBpdHNlbGYgaXMgb21pdHRlZCwgc28gYSBjYWxsZXIgd2hvIHBhc3NlcyBgdXJsYCBzdGlsbCByZWZyZXNoZXMganVzdCB0aGF0IHBhdGhcbiAgICAgKiBpbnN0ZWFkIG9mIHNpbGVudGx5IHdpZGVuaW5nIHRoZSByZWZyZXNoIHRvIHRoZSB3aG9sZSBwcm9qZWN0IChgZGI6Ly9hc3NldHNgKSxcbiAgICAgKiB3aGljaCBpcyB3aGF0IGhhcHBlbmVkIHdoZW4gYSBub24tYGZvbGRlcmAgYXJndW1lbnQgcmVhY2hlZCBoZXJlIGFzIGB1bmRlZmluZWRgLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVmcmVzaEFzc2V0cyhmb2xkZXI/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBmb2xkZXIgfHwgJ2RiOi8vYXNzZXRzJztcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCB0YXJnZXRQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBBc3NldHMgcmVmcmVzaGVkIGluOiAke3RhcmdldFBhdGh9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYGNvbnRlbnQgPT09IG51bGxgIChpLmUuIG9taXR0ZWQpIGhhcyBhbHdheXMgbWVhbnQgXCJjcmVhdGUgYSBmb2xkZXJcIi4gVGhhdFxuICAgICAqIGluZmVyZW5jZSBicmVha3Mgd2hlbmV2ZXIgdGhlIGNhbGxpbmcgTUNQIHRyYW5zcG9ydCBjb2VyY2VzIGFuIG9taXR0ZWQgb3B0aW9uYWxcbiAgICAgKiBzdHJpbmcgdG8gYFwiXCJgIGJlZm9yZSBpdCByZWFjaGVzIGhlcmUg4oCUIGBjb250ZW50ID8/IG51bGxgIG5ldmVyIHN1YnN0aXR1dGVzIG9uIGFuXG4gICAgICogZW1wdHkgc3RyaW5nLCBzbyBpdCBpcyBmb3J3YXJkZWQgZG93biB0aGUgRklMRSBwYXRoIGFuZCBmb2xkZXIgY3JlYXRpb24gYmVjb21lc1xuICAgICAqIHVucmVhY2hhYmxlIHRocm91Z2ggdGhhdCB0cmFuc3BvcnQuIGBpc0ZvbGRlcmAgbWFrZXMgdGhlIGludGVudCBleHBsaWNpdCBpbnN0ZWFkXG4gICAgICogb2YgaW5mZXJyaW5nIGl0IGZyb20gYGNvbnRlbnRgLCB3aGlsZSBgY29udGVudCA9PT0gbnVsbGAgaXMga2VwdCBhcyB0aGUgb3JpZ2luYWxcbiAgICAgKiAoc3RpbGwtdmFsaWQpIGltcGxpY2l0IGZvcm0gZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHkgKCM5OSBpdGVtIDYpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQXNzZXQodXJsPzogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcgfCBudWxsID0gbnVsbCwgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UsIGlzRm9sZGVyOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1cmwgfHwgdHlwZW9mIHVybCAhPT0gJ3N0cmluZycgfHwgdXJsLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnY3JlYXRlIHJlcXVpcmVzIG9uZSBvZjogdXJsLCB1cmxPclVVSUQsIGFzc2V0UGF0aCDigJQgbmFtaW5nIHRoZSBhc3NldCB0byBjcmVhdGUnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZm9sZGVyID0gaXNGb2xkZXIgfHwgY29udGVudCA9PT0gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IGVmZmVjdGl2ZUNvbnRlbnQgPSBmb2xkZXIgPyBudWxsIDogY29udGVudDtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH07XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIHVybCwgZWZmZWN0aXZlQ29udGVudCwgb3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSBmb2xkZXIgPyAnRm9sZGVyIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5JyA6ICdGaWxlIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5JztcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZCA/IHsgdXVpZDogcmVzdWx0LnV1aWQsIHVybDogcmVzdWx0LnVybCwgbWVzc2FnZTogbXNnIH0gOiB7IHVybCwgbWVzc2FnZTogbXNnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY29weUFzc2V0KHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY29weS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkXG4gICAgICAgICAgICAgICAgPyB7IHV1aWQ6IHJlc3VsdC51dWlkLCB1cmw6IHJlc3VsdC51cmwsIG1lc3NhZ2U6ICdBc3NldCBjb3BpZWQgc3VjY2Vzc2Z1bGx5JyB9XG4gICAgICAgICAgICAgICAgOiB7IHNvdXJjZSwgdGFyZ2V0LCBtZXNzYWdlOiAnQXNzZXQgY29waWVkIHN1Y2Nlc3NmdWxseScgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBtb3ZlQXNzZXQoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdtb3ZlLWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIHsgb3ZlcndyaXRlLCByZW5hbWU6ICFvdmVyd3JpdGUgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQgJiYgcmVzdWx0LnV1aWRcbiAgICAgICAgICAgICAgICA/IHsgdXVpZDogcmVzdWx0LnV1aWQsIHVybDogcmVzdWx0LnVybCwgbWVzc2FnZTogJ0Fzc2V0IG1vdmVkIHN1Y2Nlc3NmdWxseScgfVxuICAgICAgICAgICAgICAgIDogeyBzb3VyY2UsIHRhcmdldCwgbWVzc2FnZTogJ0Fzc2V0IG1vdmVkIHN1Y2Nlc3NmdWxseScgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYGRlbGV0ZS1hc3NldGAgcmVzb2x2aW5nIGl0cyBwcm9taXNlIGlzIG5vdCBwcm9vZiB0aGUgZmlsZSBpcyBnb25lIOKAlCB0aGUgb2xkIGNvZGVcbiAgICAgKiB0cnVzdGVkIHRoYXQgcmVzb2x1dGlvbiBhbG9uZSBhbmQgcmVwb3J0ZWQgc3VjY2VzcyB1bmNvbmRpdGlvbmFsbHkuIEEgcmVhZC1iYWNrXG4gICAgICogcXVlcnkgaW1tZWRpYXRlbHkgYWZ0ZXIgbm93IGNvbmZpcm1zIHRoZSBhc3NldCBkYiBubyBsb25nZXIga25vd3MgYWJvdXQgdGhlIHVybFxuICAgICAqIGJlZm9yZSBzdWNjZXNzIGlzIHJlcG9ydGVkLCBtaXJyb3JpbmcgdGhlIHZlcmlmeS1kb24ndC10cnVzdCBwYXR0ZXJuIGFscmVhZHkgdXNlZFxuICAgICAqIGJ5IGBtYW5hZ2Vfc2NlbmVgJ3MgYHNhdmVgIGFjdGlvbiAoIzk5IGl0ZW0gNSkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBkZWxldGVBc3NldCh1cmw/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1cmwgfHwgdHlwZW9mIHVybCAhPT0gJ3N0cmluZycgfHwgdXJsLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnZGVsZXRlIHJlcXVpcmVzIG9uZSBvZjogdXJsLCB1cmxPclVVSUQsIGFzc2V0UGF0aCcpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgY29uc3Qgc3RpbGxQcmVzZW50OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXJsKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgICAgIGlmIChzdGlsbFByZXNlbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYGFzc2V0LWRiOmRlbGV0ZS1hc3NldCByZXNvbHZlZCwgYnV0ICcke3VybH0nIGlzIHN0aWxsIHByZXNlbnQgaW4gdGhlIGFzc2V0IERCIGltbWVkaWF0ZWx5IGFmdGVyd2FyZCDigJQgdGhlIGRlbGV0ZSBkaWQgbm90IHRha2UgZWZmZWN0LmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmwgfSwgJ0Fzc2V0IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRm9yd2FyZGluZyBhbiBhcmJpdHJhcnkgc3RyaW5nIG92ZXIgYSBiaW5hcnkgYXNzZXQgKGUuZy4gd3JpdGluZyB0ZXh0IGNvbnRlbnRcbiAgICAgKiBvdmVyIGEgYC5wbmdgKSBkb2VzIG5vdCB1cGRhdGUgaXQg4oCUIGl0IGNvcnJ1cHRzIGl0LiBRdWVyeSB0aGUgdGFyZ2V0J3MgaW1wb3J0ZXJcbiAgICAgKiBiZWZvcmUgd3JpdGluZyBhbmQgcmVmdXNlIHRoZSB3cml0ZSBmb3IgYSBrbm93bi1iaW5hcnkga2luZCAoIzk5IGl0ZW0gMSkuXG4gICAgICogTGVnaXRpbWF0ZSB0ZXh0IGFzc2V0cyAoLnRzLCAuanNvbiwgLnR4dCwgbWF0ZXJpYWxzLCBzY2VuZXMsIC4uLikgYXJlIHVuYWZmZWN0ZWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXQodXJsPzogc3RyaW5nLCBjb250ZW50Pzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXJsIHx8IHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmUgcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBjb250ZW50ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlIHJlcXVpcmVzIGNvbnRlbnQ6IGEgc3RyaW5nJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIHR5cGVvZiBjb250ZW50ID09PSAnc3RyaW5nJyAmJiBpc0JpbmFyeUFzc2V0KGFzc2V0SW5mbywgdXJsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYHNhdmUgY2Fubm90IHdyaXRlIHN0cmluZyBjb250ZW50IG92ZXIgJyR7dXJsfSc6IGl0IHJlc29sdmVzIHRvIGEgYmluYXJ5IGFzc2V0IGAgK1xuICAgICAgICAgICAgICAgICAgICBgKGltcG9ydGVyPScke2Fzc2V0SW5mby5pbXBvcnRlcn0nLCB0eXBlPScke2Fzc2V0SW5mby50eXBlfScpLiBXcml0aW5nIHRleHQgY29udGVudCBvdmVyIGEgYCArXG4gICAgICAgICAgICAgICAgICAgICdiaW5hcnkgYXNzZXQgd291bGQgY29ycnVwdCBpdCDigJQgdXNlIGltcG9ydC9jb3B5IHRvIHJlcGxhY2UgYmluYXJ5IGFzc2V0IGNvbnRlbnQgaW5zdGVhZC4nXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIHVybCwgY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQgJiYgcmVzdWx0LnV1aWQgPyB7IHV1aWQ6IHJlc3VsdC51dWlkLCB1cmw6IHJlc3VsdC51cmwgfSA6IHsgdXJsIH0sICdBc3NldCBzYXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgcmVpbXBvcnQtYXNzZXRgIG9uIGEgZGlyZWN0b3J5IFVSTCBwcmV2aW91c2x5IGZvcndhcmRlZCBzdHJhaWdodCB0byB0aGUgZWRpdG9yXG4gICAgICogd2l0aCBubyBkaXJlY3RvcnkgY2hlY2ssIG5vIGNoaWxkIGVudW1lcmF0aW9uLCBhbmQgdGhlIGJvb2xlYW4gcmVzdWx0IHdhc1xuICAgICAqIGRpc2NhcmRlZCDigJQgYW4gdW5jb25kaXRpb25hbCBzdWNjZXNzIHJlZ2FyZGxlc3Mgb2Ygd2hhdCBhY3R1YWxseSBoYXBwZW5lZC4gVGhlXG4gICAgICogZGVjaXNpb24gaGVyZSBpcyBSRUZVU0UsIG5vdCByZWN1cnNlOiBhIGZvbGRlciBkb2VzIG5vdCBoYXZlIGltcG9ydGFibGUgY29udGVudFxuICAgICAqIG9mIGl0cyBvd24sIHNvIGVhY2ggY2hpbGQgYXNzZXQgbXVzdCBiZSByZWltcG9ydGVkIGJ5IGl0cyBvd24gdXJsICgjOTYpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVpbXBvcnRBc3NldCh1cmw/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1cmwgfHwgdHlwZW9mIHVybCAhPT0gJ3N0cmluZycgfHwgdXJsLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgncmVpbXBvcnQgcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB1cmwpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgICAgICAgaWYgKGluZm8gJiYgaW5mby5pc0RpcmVjdG9yeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYHJlaW1wb3J0IGRvZXMgbm90IGFjY2VwdCBhIGZvbGRlciBVUkwgKCcke3VybH0nIGlzIGEgZGlyZWN0b3J5KSDigJQgdGhpcyBhY3Rpb24gZG9lcyBub3QgYCArXG4gICAgICAgICAgICAgICAgICAgICdyZWN1cnNlIGludG8gZm9sZGVyIGNvbnRlbnRzLiBSZWltcG9ydCBlYWNoIGNoaWxkIGFzc2V0IGluZGl2aWR1YWxseSBieSBpdHMgb3duIHVybCBpbnN0ZWFkLidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRGVjbGFyZWQgdm9pZCBieSB0aGUgZWRpdG9yIHR5cGluZ3M7IHRoZSBydW50aW1lIGNhbiBzdGlsbCByZXR1cm4gZmFsc2UuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IHVua25vd24gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgYXNzZXQtZGI6cmVpbXBvcnQtYXNzZXQgcmV0dXJuZWQgZmFsc2UgZm9yICcke3VybH0nIOKAlCB0aGUgZWRpdG9yIHJlamVjdGVkIHRoZSByZWltcG9ydC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsIH0sICdBc3NldCByZWltcG9ydGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFBhdGgodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0UGF0aDogc3RyaW5nIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCB1cmwpIGFzIHN0cmluZyB8IG51bGw7XG4gICAgICAgICAgICBpZiAoYXNzZXRQYXRoKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCwgcGF0aDogYXNzZXRQYXRoIH0sICdBc3NldCBwYXRoIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgcGF0aCBub3QgZm91bmQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXRVdWlkKHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1dWlkOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXVpZCcsIHVybCkgYXMgc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgICAgIGlmICh1dWlkKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCwgdXVpZCB9LCAnQXNzZXQgVVVJRCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IFVVSUQgbm90IGZvdW5kJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0VXJsKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXJsOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXJsJywgdXVpZCkgYXMgc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgICAgIGlmICh1cmwpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXVpZCwgdXJsIH0sICdBc3NldCBVUkwgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdBc3NldCBVUkwgbm90IGZvdW5kJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kQXNzZXRCeU5hbWUoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbmFtZSwgZXhhY3RNYXRjaCA9IGZhbHNlLCBhc3NldFR5cGUgPSAnYWxsJywgZm9sZGVyID0gJ2RiOi8vYXNzZXRzJywgbWF4UmVzdWx0cyA9IDIwIH0gPSBhcmdzO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldHMoYXNzZXRUeXBlLCBmb2xkZXIpO1xuICAgICAgICAgICAgaWYgKCFhbGxBc3NldHNSZXN1bHQuc3VjY2VzcyB8fCAhYWxsQXNzZXRzUmVzdWx0LmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgYXNzZXRzOiAke2FsbEFzc2V0c1Jlc3VsdC5lcnJvcn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFsbEFzc2V0cyA9IGFsbEFzc2V0c1Jlc3VsdC5kYXRhLmFzc2V0cyBhcyBhbnlbXTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZWRBc3NldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFsbEFzc2V0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBleGFjdE1hdGNoXG4gICAgICAgICAgICAgICAgICAgID8gYXNzZXQubmFtZSA9PT0gbmFtZVxuICAgICAgICAgICAgICAgICAgICA6IGFzc2V0Lm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhuYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXRhaWxSZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0SW5mbyhhc3NldC5wYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaChkZXRhaWxSZXN1bHQuc3VjY2VzcyA/IHsgLi4uYXNzZXQsIGRldGFpbHM6IGRldGFpbFJlc3VsdC5kYXRhIH0gOiBhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZEFzc2V0cy5wdXNoKGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlZEFzc2V0cy5sZW5ndGggPj0gbWF4UmVzdWx0cykgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHNlYXJjaFRlcm06IG5hbWUsIGV4YWN0TWF0Y2gsIGFzc2V0VHlwZSwgZm9sZGVyLFxuICAgICAgICAgICAgICAgIHRvdGFsRm91bmQ6IG1hdGNoZWRBc3NldHMubGVuZ3RoLCBtYXhSZXN1bHRzLCBhc3NldHM6IG1hdGNoZWRBc3NldHNcbiAgICAgICAgICAgIH0sIGBGb3VuZCAke21hdGNoZWRBc3NldHMubGVuZ3RofSBhc3NldHMgbWF0Y2hpbmcgJyR7bmFtZX0nYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQXNzZXQgc2VhcmNoIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERldGFpbHMoYXNzZXRQYXRoPzogc3RyaW5nLCBpbmNsdWRlU3ViQXNzZXRzOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFzc2V0UGF0aCB8fCB0eXBlb2YgYXNzZXRQYXRoICE9PSAnc3RyaW5nJyB8fCBhc3NldFBhdGgudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdnZXRfZGV0YWlscyByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldEluZm8oYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhc3NldEluZm9SZXN1bHQ7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhc3NldEluZm9SZXN1bHQuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IGRldGFpbGVkSW5mbzogYW55ID0geyAuLi5hc3NldEluZm8sIHN1YkFzc2V0czogW10gfTtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlU3ViQXNzZXRzICYmIGFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8udHlwZSA9PT0gJ2NjLkltYWdlQXNzZXQnIHx8IGFzc2V0UGF0aC5tYXRjaCgvXFwuKHBuZ3xqcGd8anBlZ3xnaWZ8dGdhfGJtcHxwc2QpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlVXVpZCA9IGFzc2V0SW5mby51dWlkO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3NzaWJsZVN1YkFzc2V0cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3Nwcml0ZUZyYW1lJywgdXVpZDogYCR7YmFzZVV1aWR9QGY5OTQxYCwgc3VmZml4OiAnQGY5OTQxJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAndGV4dHVyZScsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3RleHR1cmUyRCcsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfVxuICAgICAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YkFzc2V0IG9mIHBvc3NpYmxlU3ViQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YkFzc2V0VXJsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXJsJywgc3ViQXNzZXQudXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YkFzc2V0VXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbGVkSW5mby5zdWJBc3NldHMucHVzaCh7IHR5cGU6IHN1YkFzc2V0LnR5cGUsIHV1aWQ6IHN1YkFzc2V0LnV1aWQsIHVybDogc3ViQXNzZXRVcmwsIHN1ZmZpeDogc3ViQXNzZXQuc3VmZml4IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggeyAvKiBzdWItYXNzZXQgZG9lc24ndCBleGlzdCwgc2tpcCAqLyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGFzc2V0UGF0aCwgaW5jbHVkZVN1YkFzc2V0cywgLi4uZGV0YWlsZWRJbmZvIH0sIGBBc3NldCBkZXRhaWxzIHJldHJpZXZlZC4gRm91bmQgJHtkZXRhaWxlZEluZm8uc3ViQXNzZXRzLmxlbmd0aH0gc3ViLWFzc2V0cy5gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGFzc2V0IGRldGFpbHM6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIOKUgOKUgCBGcm9tIEFzc2V0QWR2YW5jZWRUb29scyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIC8qKlxuICAgICAqIFRoZSBvbGQgaW1wbGVtZW50YXRpb24gZm9yd2FyZGVkIHRoZSBjYWxsZXIncyByYXcgc3RyaW5nIHN0cmFpZ2h0IHRvXG4gICAgICogYHNhdmUtYXNzZXQtbWV0YWAgd2l0aCBubyBwYXJzZSwgbm8gbWVyZ2UsIGFuZCBubyBwcmVzZW5jZSBndWFyZCDigJQgYVxuICAgICAqIGJ5dGUtaWRlbnRpY2FsIGAucG5nLm1ldGFgIHJvdW5kLXRyaXAgZGVwZW5kZWQgb24gdGhlIGNhbGxlciByZWNvbnN0cnVjdGluZyB0aGVcbiAgICAgKiAqZW50aXJlKiBtZXRhIGV4YWN0bHksIGFuZCBhbnkgZmllbGQgaXQgZHJvcHBlZCAob3IgdGhlIGFzc2V0LWRiJ3Mgb3duIGNvbXB1dGVkXG4gICAgICogZmllbGRzIGl0IG5ldmVyIGhhZCkgc2lsZW50bHkgZGl2ZXJnZWQgdGhlIHNhdmVkIG1ldGEuIFJvdXRlIHRocm91Z2hcbiAgICAgKiBgcXVlcnktYXNzZXQtbWV0YWAgLT4gbWVyZ2UgLT4gYEpTT04uc3RyaW5naWZ5YCAtPiBzYXZlIGluc3RlYWQsIG1hdGNoaW5nIHRoZVxuICAgICAqIHBhdHRlcm4gYWxyZWFkeSB1c2VkIGJ5IGBtYW5hZ2VfbWF0ZXJpYWxgL2BtYW5hZ2Vfc2hhZGVyX2VmZmVjdGAgKCM4MikuIGBjb250ZW50YFxuICAgICAqIGlzIG5vdyBhIEpTT04gKnBhdGNoKiBtZXJnZWQgb250byB0aGUgY3VycmVudCBtZXRhLCBub3QgdGhlIHdob2xlIG1ldGEgZG9jdW1lbnQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXRNZXRhKHVybE9yVVVJRD86IHN0cmluZywgY29udGVudD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXVybE9yVVVJRCB8fCB0eXBlb2YgdXJsT3JVVUlEICE9PSAnc3RyaW5nJyB8fCB1cmxPclVVSUQudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlX21ldGEgcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCB8fCBjb250ZW50ID09PSBudWxsIHx8IGNvbnRlbnQgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmVfbWV0YSByZXF1aXJlcyBjb250ZW50OiBhIEpTT04gc3RyaW5nIG9mIHRoZSBtZXRhIGZpZWxkcyB0byBtZXJnZSAoZS5nLiB7XCJ1c2VyRGF0YVwiOnsuLi59fSknKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcGF0Y2g6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHBhdGNoID0gSlNPTi5wYXJzZShjb250ZW50KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgc2F2ZV9tZXRhIGNvbnRlbnQgaXMgbm90IHZhbGlkIEpTT046ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRNZXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgdXJsT3JVVUlEKTtcbiAgICAgICAgICAgIGlmICghY3VycmVudE1ldGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvdWxkIG5vdCByZWFkIGN1cnJlbnQgbWV0YSBmb3IgJyR7dXJsT3JVVUlEfScg4oCUIGFzc2V0IG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREIuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBtZXJnZWRNZXRhID0geyAuLi5jdXJyZW50TWV0YSwgLi4ucGF0Y2ggfTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldC1tZXRhJywgdXJsT3JVVUlELCBKU09OLnN0cmluZ2lmeShtZXJnZWRNZXRhKSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQ6IHJlc3VsdD8udXVpZCA/PyBtZXJnZWRNZXRhLnV1aWQsIHVybDogcmVzdWx0Py51cmwgfSwgJ0Fzc2V0IG1ldGEgc2F2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUF2YWlsYWJsZVVybCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVXJsOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdnZW5lcmF0ZS1hdmFpbGFibGUtdXJsJywgdXJsKSBhcyBzdHJpbmc7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxVcmw6IHVybCwgYXZhaWxhYmxlVXJsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGF2YWlsYWJsZVVybCA9PT0gdXJsID8gJ1VSTCBpcyBhdmFpbGFibGUnIDogJ0dlbmVyYXRlZCBuZXcgYXZhaWxhYmxlIFVSTCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERiUmVhZHkoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZWFkeTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXJlYWR5JykgYXMgYm9vbGVhbjtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgcmVhZHksIG1lc3NhZ2U6IHJlYWR5ID8gJ0Fzc2V0IGRhdGFiYXNlIGlzIHJlYWR5JyA6ICdBc3NldCBkYXRhYmFzZSBpcyBub3QgcmVhZHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkFzc2V0RXh0ZXJuYWwodXJsT3JVVUlEOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCB1cmxPclVVSUQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ0Fzc2V0IG9wZW5lZCB3aXRoIGV4dGVybmFsIHByb2dyYW0nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJhdGNoSW1wb3J0QXNzZXRzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgb3ZlcndyaXRlOiBib29sZWFuID0gYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJztcbiAgICAgICAgICAgIGNvbnN0IHJlY3Vyc2l2ZTogYm9vbGVhbiA9IGFyZ3MucmVjdXJzaXZlID09PSB0cnVlIHx8IGFyZ3MucmVjdXJzaXZlID09PSAndHJ1ZSc7XG4gICAgICAgICAgICBpZiAoIXZhbGlkYXRlQXNzZXRQYXRoKGFyZ3MudGFyZ2V0RGlyZWN0b3J5IHx8ICcnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnSW52YWxpZCB0YXJnZXREaXJlY3Rvcnk6IG11c3QgYmUgZGI6Ly8gVVJMIG9yIGFzc2V0cy8gcmVsYXRpdmUgcGF0aCB3aXRob3V0IHRyYXZlcnNhbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGFyZ3Muc291cmNlRGlyZWN0b3J5KSkgcmV0dXJuIGVycm9yUmVzdWx0KCdTb3VyY2UgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuZ2V0RmlsZXNGcm9tRGlyZWN0b3J5KGFyZ3Muc291cmNlRGlyZWN0b3J5LCBhcmdzLmZpbGVGaWx0ZXIgfHwgW10sIHJlY3Vyc2l2ZSk7XG4gICAgICAgICAgICBjb25zdCBpbXBvcnRSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGAke2FyZ3MudGFyZ2V0RGlyZWN0b3J5fS8ke2ZpbGVOYW1lfWA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2ltcG9ydC1hc3NldCcsIGZpbGVQYXRoLCB0YXJnZXRQYXRoLCB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH0pO1xuICAgICAgICAgICAgICAgICAgICBpbXBvcnRSZXN1bHRzLnB1c2goeyBzb3VyY2U6IGZpbGVQYXRoLCB0YXJnZXQ6IHRhcmdldFBhdGgsIHN1Y2Nlc3M6IHRydWUsIHV1aWQ6IChyZXN1bHQgYXMgYW55KT8udXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50Kys7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wb3J0UmVzdWx0cy5wdXNoKHsgc291cmNlOiBmaWxlUGF0aCwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JDb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLCBzdWNjZXNzQ291bnQsIGVycm9yQ291bnQsIHJlc3VsdHM6IGltcG9ydFJlc3VsdHMgfSxcbiAgICAgICAgICAgICAgICBgQmF0Y2ggaW1wb3J0IGNvbXBsZXRlZDogJHtzdWNjZXNzQ291bnR9IHN1Y2Nlc3MsICR7ZXJyb3JDb3VudH0gZXJyb3JzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRGaWxlc0Zyb21EaXJlY3RvcnkoZGlyUGF0aDogc3RyaW5nLCBmaWxlRmlsdGVyOiBzdHJpbmdbXSwgcmVjdXJzaXZlOiBib29sZWFuKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBmaWxlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgaXRlbXMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKTtcbiAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXJQYXRoLCBpdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmdWxsUGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIGlmIChmaWxlRmlsdGVyLmxlbmd0aCA9PT0gMCB8fCBmaWxlRmlsdGVyLnNvbWUoZXh0ID0+IGl0ZW0udG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQudG9Mb3dlckNhc2UoKSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpICYmIHJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goLi4udGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoZnVsbFBhdGgsIGZpbGVGaWx0ZXIsIHJlY3Vyc2l2ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWxlcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJhdGNoRGVsZXRlQXNzZXRzKHVybHM6IHN0cmluZ1tdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkZWxldGVSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHVybCBvZiB1cmxzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlUmVzdWx0cy5wdXNoKHsgdXJsLCBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQrKztcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGVSZXN1bHRzLnB1c2goeyB1cmwsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yQ291bnQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHRvdGFsQXNzZXRzOiB1cmxzLmxlbmd0aCwgc3VjY2Vzc0NvdW50LCBlcnJvckNvdW50LCByZXN1bHRzOiBkZWxldGVSZXN1bHRzIH0sXG4gICAgICAgICAgICAgICAgYEJhdGNoIGRlbGV0ZSBjb21wbGV0ZWQ6ICR7c3VjY2Vzc0NvdW50fSBzdWNjZXNzLCAke2Vycm9yQ291bnR9IGVycm9yc2ApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVBc3NldFJlZmVyZW5jZXMoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuOiBgJHtkaXJlY3Rvcnl9LyoqLypgIH0pO1xuICAgICAgICAgICAgY29uc3QgYnJva2VuUmVmZXJlbmNlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkUmVmZXJlbmNlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0LnVybCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8pIHZhbGlkUmVmZXJlbmNlcy5wdXNoKHsgdXJsOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsIG5hbWU6IGFzc2V0Lm5hbWUgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyb2tlblJlZmVyZW5jZXMucHVzaCh7IHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLCBuYW1lOiBhc3NldC5uYW1lLCBlcnJvcjogKGVyciBhcyBFcnJvcikubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgZGlyZWN0b3J5LCB0b3RhbEFzc2V0czogYXNzZXRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB2YWxpZFJlZmVyZW5jZXM6IHZhbGlkUmVmZXJlbmNlcy5sZW5ndGgsIGJyb2tlblJlZmVyZW5jZXM6IGJyb2tlblJlZmVyZW5jZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGJyb2tlbkFzc2V0czogYnJva2VuUmVmZXJlbmNlc1xuICAgICAgICAgICAgfSwgYFZhbGlkYXRpb24gY29tcGxldGVkOiAke2Jyb2tlblJlZmVyZW5jZXMubGVuZ3RofSBicm9rZW4gcmVmZXJlbmNlcyBmb3VuZGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYW4gYXNzZXQncyBkZXBlbmRlbmN5IGdyYXBoLlxuICAgICAqXG4gICAgICogV2FzIGFuIHVuY29uZGl0aW9uYWwgc3R1YiByZXR1cm5pbmcgXCJyZXF1aXJlcyBhZGRpdGlvbmFsIEFQSXMgbm90IGF2YWlsYWJsZSBpblxuICAgICAqIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb25cIiBmb3IgZXZlcnkgaW5wdXQgKCMxMjQpLiBUaGUgdHJpYWdlJ3NcbiAgICAgKiByZXNvbHV0aW9uIHdhcyBleHBsaWNpdCDigJQgaW1wbGVtZW50IGl0LCBvciBzdG9wIGFkdmVydGlzaW5nIGl0IOKAlCBhbmQgdGhlXG4gICAgICogZGVsZXRlLXNhZmV0eSBhcmd1bWVudCBkZWNpZGVkIHRoZSBjaG9pY2U6IGJlY2F1c2UgQ29jb3MgcmVzb2x2ZXMgcmVmZXJlbmNlcyBieVxuICAgICAqIHRoZSB1dWlkIGluIHRoZSBzaWJsaW5nIGAubWV0YWAsIGEgcmVmZXJlbmNlIGxlZnQgZGFuZ2xpbmcgYnkgYSBwcmVtYXR1cmUgZGVsZXRlXG4gICAgICogcmVzb2x2ZXMgdG8gYE5vbmVgIHNpbGVudGx5IGFuZCBzdXJmYWNlcyBhdCBydW50aW1lIG9yIGJ1aWxkIHRpbWUsIGZhciBmcm9tIHRoZVxuICAgICAqIGRlbGV0ZSB0aGF0IGNhdXNlZCBpdC4gYGRpcmVjdGlvbjogZGVwZW5kZW50c2AgaXMgdGhlIG9ubHkgYWR2ZXJ0aXNlZCBwcmUtZmxpZ2h0XG4gICAgICogZm9yIHRoYXQsIHNvIHJlbW92aW5nIHRoZSBhY3Rpb24gd291bGQgcmVtb3ZlIHRoZSBzYWZldHkgY2hlY2suXG4gICAgICpcbiAgICAgKiBUaHJlZSBzb3VyY2VzIGFjcm9zcyB0d28gcGFja2FnZXMsIGJlY2F1c2Ugbm8gc2luZ2xlIG1lc3NhZ2UgYW5zd2VycyBib3RoIGhhbHZlczpcbiAgICAgKlxuICAgICAqIDEuIGBhc3NldC1kYiBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXNgIOKAlCB0aGUgREIncyBmb3J3YXJkIGluZGV4LCBnaXZpbmcgdGhlXG4gICAgICogICAgYGRlcGVuZGVuY2llc2AgZGlyZWN0aW9uIGRpcmVjdGx5LlxuICAgICAqIDIuIGBhc3NldC1kYiBxdWVyeS1hc3NldC11c2Vyc2Ag4oCUIHRoZSBEQidzIHJldmVyc2UgbG9va3VwLCB0aGUgc2FtZSBpbmRleCByZWFkIGZyb21cbiAgICAgKiAgICB0aGUgb3RoZXIgZW5kLiBCb3RoIGFyZSBkZWNsYXJlZCBpbiB0aGUgZWRpdG9yJ3Mgb3duIHR5cGluZ3M7IGJvdGggdGFrZSBhblxuICAgICAqICAgIG9wdGlvbmFsIGB0eXBlYCBzZWxlY3RpbmcgYGFzc2V0YCAvIGBzY3JpcHRgIC8gYGFsbGAsIHNvIGBhbGxgIGlzIHBhc3NlZC5cbiAgICAgKiAzLiBgc2NlbmUgcXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZGAg4oCUIHRoZSBsaXZlIHNjZW5lJ3MgcmV2ZXJzZSBsb29rdXAsIHdoaWNoIHRoZVxuICAgICAqICAgIEFzc2V0IEJyb3dzZXIgdXNlcyB0byBhbnN3ZXIgXCJ3aG8gcmVmZXJlbmNlcyB0aGlzXCIuIEtlcHQgaW4gYWRkaXRpb24gdG8gKDIpXG4gICAgICogICAgYmVjYXVzZSBhIG5vZGUgaW4gdGhlIG9wZW4gc2NlbmUgaXMgdGhlIHBvcHVsYXRpb24gYSBkZWxldGUgYnJlYWtzIGltbWVkaWF0ZWx5LFxuICAgICAqICAgIGFuZCBpcyBub3QgaXRzZWxmIGFuIGFzc2V0IGluIHRoZSBEQi5cbiAgICAgKlxuICAgICAqIEVhY2ggaXMgYXR0ZW1wdGVkIGluZGVwZW5kZW50bHkgYW5kIGl0cyByZWFjaGFiaWxpdHkgaXMgcmVwb3J0ZWQ6IGEgbWVzc2FnZSB0aGF0XG4gICAgICogdGhyb3dzIGNvbnRyaWJ1dGVzIG5vdGhpbmcgdG8gYHNvdXJjZXNgLCBhbmQgYSBjYWxsZXIgc2VlaW5nIGFuIGVtcHR5IGxpc3QgaXMgdG9sZFxuICAgICAqIHdoaWNoIHNvdXJjZXMgYW5zd2VyZWQuIEFuIGVtcHR5IHJlc3VsdCBpcyBzdGF0ZWQgYXMgYSBDT1VOVCBwbHVzIHRob3NlIHNvdXJjZXMsXG4gICAgICogbmV2ZXIgYXMgYSBiYXJlIGVtcHR5IGFycmF5OiBcIm5vIGRlcGVuZGVudHMgZm91bmRcIiBhbmQgXCJ0aGUgcXVlcnkgY291bGQgbm90IHJ1blwiXG4gICAgICogbXVzdCBub3QgcmVhZCB0aGUgc2FtZSB0byBhIGNhbGxlciBkZWNpZGluZyB3aGV0aGVyIGEgZGVsZXRlIGlzIHNhZmUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERlcGVuZGVuY2llcyh1cmxPclVVSUQ/OiBzdHJpbmcsIGRpcmVjdGlvbjogc3RyaW5nID0gJ2RlcGVuZGVuY2llcycpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1cmxPclVVSUQgfHwgdHlwZW9mIHVybE9yVVVJRCAhPT0gJ3N0cmluZycgfHwgdXJsT3JVVUlELnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnZ2V0X2RlcGVuZGVuY2llcyByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgg4oCUIG5hbWluZyB0aGUgYXNzZXQgdG8gYW5hbHl6ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybE9yVVVJRCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgIGlmICghaW5mbyB8fCAhaW5mby51dWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgYEFzc2V0ICcke3VybE9yVVVJRH0nIG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREIg4oCUIG5vdGhpbmcgdG8gYW5hbHl6ZS4gYCArXG4gICAgICAgICAgICAgICAgJ0lmIHRoZSBmaWxlIHdhcyB3cml0dGVuIG91dHNpZGUgdGhlIGVkaXRvciwgcnVuIG1hbmFnZV9hc3NldCBhY3Rpb249cmVmcmVzaCBmaXJzdC4nXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2FudHNEZXBlbmRlbnRzID0gZGlyZWN0aW9uID09PSAnZGVwZW5kZW50cycgfHwgZGlyZWN0aW9uID09PSAnYm90aCc7XG4gICAgICAgIGNvbnN0IHdhbnRzRGVwZW5kZW5jaWVzID0gZGlyZWN0aW9uID09PSAnZGVwZW5kZW5jaWVzJyB8fCBkaXJlY3Rpb24gPT09ICdib3RoJztcbiAgICAgICAgY29uc3QgZGF0YTogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgIHVybDogaW5mby51cmwgfHwgdXJsT3JVVUlELFxuICAgICAgICAgICAgdXVpZDogaW5mby51dWlkLFxuICAgICAgICAgICAgbmFtZTogaW5mby5uYW1lLFxuICAgICAgICAgICAgZGlyZWN0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHdhbnRzRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbmNpZXMgPSBhd2FpdCB0aGlzLnF1ZXJ5QXNzZXREZXBlbmRlbmNpZXMoaW5mby51dWlkKTtcbiAgICAgICAgICAgIGRhdGEuZGVwZW5kZW5jaWVzID0gZGVwZW5kZW5jaWVzLmFzc2V0cztcbiAgICAgICAgICAgIGRhdGEuZGVwZW5kZW5jeUNvdW50ID0gZGVwZW5kZW5jaWVzLmFzc2V0cy5sZW5ndGg7XG4gICAgICAgICAgICBkYXRhLmRlcGVuZGVuY2llc1NvdXJjZSA9IGRlcGVuZGVuY2llcy5zb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FudHNEZXBlbmRlbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbnRzID0gYXdhaXQgdGhpcy5xdWVyeUFzc2V0RGVwZW5kZW50cyhpbmZvLnV1aWQsIHVybE9yVVVJRCk7XG4gICAgICAgICAgICBkYXRhLmRlcGVuZGVudHMgPSBkZXBlbmRlbnRzLmFzc2V0cztcbiAgICAgICAgICAgIGRhdGEuZGVwZW5kZW50Q291bnQgPSBkZXBlbmRlbnRzLmFzc2V0cy5sZW5ndGg7XG4gICAgICAgICAgICBkYXRhLmRlcGVuZGVudHNTb3VyY2UgPSBkZXBlbmRlbnRzLnNvdXJjZTtcbiAgICAgICAgICAgIC8vIE5hbWVkIHNlcGFyYXRlbHkgZnJvbSBgZGVwZW5kZW50c2A6IGEgc2NlbmUgbm9kZSBpcyBhIGxpdmUgY29uc3VtZXIgYW5cbiAgICAgICAgICAgIC8vIGFzc2V0IGNsZWFudXAgbXVzdCBub3QgYnJlYWssIGFuZCBpdCBpcyBub3QgYW4gYXNzZXQgaW4gdGhlIERCLlxuICAgICAgICAgICAgZGF0YS5yZWZlcmVuY2luZ05vZGVzID0gZGVwZW5kZW50cy5ub2RlcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1bW1hcnkgPSBbXG4gICAgICAgICAgICB3YW50c0RlcGVuZGVudHMgPyBgJHtkYXRhLmRlcGVuZGVudENvdW50ID8/IDB9IGRlcGVuZGVudCBhc3NldChzKSB2aWEgJHtkYXRhLmRlcGVuZGVudHNTb3VyY2V9YCA6IG51bGwsXG4gICAgICAgICAgICB3YW50c0RlcGVuZGVuY2llcyA/IGAke2RhdGEuZGVwZW5kZW5jeUNvdW50ID8/IDB9IGRlcGVuZGVuY3kvZGVwZW5kZW5jaWVzIHZpYSAke2RhdGEuZGVwZW5kZW5jaWVzU291cmNlfWAgOiBudWxsLFxuICAgICAgICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGRhdGEsIGBSZXNvbHZlZCAke2luZm8ubmFtZSB8fCBpbmZvLnVybH06ICR7c3VtbWFyeX1gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3J3YXJkIGdyYXBoLiBVc2VzIHRoZSBhc3NldCBEQidzIG93biBpbmRleDsgcmV0dXJucyBgW11gIHdpdGggYSBuYW1lZCBlbXB0eSBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBgcXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzYCBpcyBkZWNsYXJlZCBpblxuICAgICAqIGBAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3Byb3RlY3RlZC9tZXNzYWdlLmQudHNgIGFzXG4gICAgICogYCh1dWlkOiBzdHJpbmcsIHR5cGU/OiBRdWVyeUFzc2V0VHlwZSkgPT4gc3RyaW5nW11gLiBUaGUgYHR5cGVgIGFyZ3VtZW50IHNlbGVjdHMgdGhlXG4gICAgICogcG9wdWxhdGlvbiDigJQgYGFzc2V0YCAocmVzb3VyY2VzKSwgYHNjcmlwdGAsIG9yIGBhbGxgIOKAlCBhbmQgb21pdHRpbmcgaXQgb21pdHMgc2NyaXB0XG4gICAgICogcmVmZXJlbmNlcywgc28gYGFsbGAgaXMgcGFzc2VkIHRvIG1hdGNoIHRoZSBcIndoYXQgd291bGQgYSBkZWxldGUgYnJlYWtcIiBxdWVzdGlvbiB0aGVcbiAgICAgKiBjYWxsZXIgaXMgYXNraW5nLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERlcGVuZGVuY2llcyh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHsgYXNzZXRzOiBhbnlbXTsgc291cmNlOiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLCB1dWlkLCAnYWxsJyk7XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogW107XG4gICAgICAgICAgICByZXR1cm4geyBhc3NldHM6IGxpc3QubWFwKChkZXA6IGFueSkgPT4gKHR5cGVvZiBkZXAgPT09ICdzdHJpbmcnID8geyB1dWlkOiBkZXAgfSA6IGRlcCkpLCBzb3VyY2U6ICdhc3NldC1kYiBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnIH07XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm8gc3VjaCBtZXNzYWdlIGluIHRoaXMgYnVpbGQg4oCUIGFuIGVtcHR5IGxpc3Qgd2l0aCBhIG5hbWVkIHNvdXJjZSwgc28gdGhlXG4gICAgICAgICAgICAvLyBjYWxsZXIgY2FuIHRlbGwgXCJub25lXCIgZnJvbSBcIm5vdCBhbnN3ZXJhYmxlIGhlcmVcIi5cbiAgICAgICAgICAgIHJldHVybiB7IGFzc2V0czogW10sIHNvdXJjZTogJ3VuYXZhaWxhYmxlIChubyBhc3NldC1kYiBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMgaW4gdGhpcyBlZGl0b3IgYnVpbGQpJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV2ZXJzZSBncmFwaC4gU2NhbnMgdGhlIGFzc2V0IERCJ3Mgb3duIHNlcmlhbGl6ZWQgcmVmZXJlbmNlcyB3aGVyZSB0aGUgYnVpbGRcbiAgICAgKiBleHBvc2VzIHRoZW0sIGFuZCBhbHdheXMgYWRkcyB0aGUgbGl2ZSBzY2VuZSdzIHJldmVyc2UgbG9va3VwLCB3aGljaCBpcyB0aGVcbiAgICAgKiBwb3B1bGF0aW9uIGEgZGVsZXRlIGFjdHVhbGx5IHJpc2tzIGJyZWFraW5nLlxuICAgICAqL1xuICAgIC8qKlxuICAgICAqIFJldmVyc2UgZ3JhcGguIEJvdGggZGlyZWN0aW9ucyBhcmUgYXNrZWQgb2YgdGhlIGVkaXRvciwgYmVjYXVzZSBlYWNoIHNlZXMgYVxuICAgICAqIHBvcHVsYXRpb24gdGhlIG90aGVyIGNhbiBtaXNzOiB0aGUgYXNzZXQgREIncyByZXZlcnNlIGluZGV4IHNlZXMgc2VyaWFsaXplZFxuICAgICAqIHJlZmVyZW5jZXMgYW55d2hlcmUgaW4gdGhlIHByb2plY3QsIHdoaWxlIHRoZSBsaXZlIHNjZW5lIHNjYW4gaXMgd2hhdCBhIGRlbGV0ZVxuICAgICAqIGFjdHVhbGx5IGJyZWFrcyByaWdodCBub3cuXG4gICAgICpcbiAgICAgKiBgcXVlcnktYXNzZXQtdXNlcnNgIGlzIHRoZSBEQidzIGRlY2xhcmVkIHJldmVyc2UgbWVzc2FnZVxuICAgICAqIChgQGNvY29zL2NyZWF0b3ItdHlwZXMvLi4uL2Fzc2V0LWRiL0B0eXBlcy9wcm90ZWN0ZWQvbWVzc2FnZS5kLnRzYCksIGRlY2xhcmVkIGFzXG4gICAgICogYCh1dWlkOiBzdHJpbmcsIHR5cGU/OiBRdWVyeUFzc2V0VHlwZSkgPT4gc3RyaW5nW10gfCBudWxsYC4gSXQgaXMgdGhlIHNhbWVcbiAgICAgKiBwb3B1bGF0aW9uIGBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXNgIGluZGV4ZXMgZnJvbSB0aGUgb3RoZXIgZW5kLCBzbyBpdCBuZWVkcyB0aGVcbiAgICAgKiBzYW1lIGBhbGxgIHRvIGluY2x1ZGUgc2NyaXB0IHJlZmVyZW5jZXMuXG4gICAgICpcbiAgICAgKiBOb3RoaW5nIGlzIGluZmVycmVkIGZyb20gYSBmYWlsZWQgY2FsbDogYW4gdW5yZWFjaGFibGUgbWVzc2FnZSBsZWF2ZXMgYHNvdXJjZXNgXG4gICAgICogc2hvcnQsIGFuZCB0aGUgY2FsbGVyIHJlcG9ydHMgdGhhdCBhcyBcIm5vdCBhbnN3ZXJhYmxlIGhlcmVcIiByYXRoZXIgdGhhbiBhcyB6ZXJvLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERlcGVuZGVudHModXVpZDogc3RyaW5nLCB1cmxPclVVSUQ6IHN0cmluZyk6IFByb21pc2U8eyBhc3NldHM6IGFueVtdOyBub2Rlczogc3RyaW5nW107IHNvdXJjZTogc3RyaW5nIH0+IHtcbiAgICAgICAgY29uc3QgYXNzZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICBjb25zdCBzb3VyY2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LXVzZXJzJywgdXVpZCwgJ2FsbCcpO1xuICAgICAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdCA6IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkZXAgb2YgbGlzdCkgYXNzZXRzLnB1c2godHlwZW9mIGRlcCA9PT0gJ3N0cmluZycgPyB7IHV1aWQ6IGRlcCB9IDogZGVwKTtcbiAgICAgICAgICAgIHNvdXJjZXMucHVzaCgnYXNzZXQtZGIgcXVlcnktYXNzZXQtdXNlcnMnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBOb3QgYXZhaWxhYmxlIGluIHRoaXMgYnVpbGQg4oCUIHRoZSBzY2VuZSBzY2FuIGJlbG93IGlzIHRoZSB3aG9sZSBhbnN3ZXIuXG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbm9kZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZHM6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCB1dWlkKTtcbiAgICAgICAgICAgIG5vZGVzID0gQXJyYXkuaXNBcnJheShub2RlVXVpZHMpID8gbm9kZVV1aWRzIDogW107XG4gICAgICAgICAgICBpZiAobm9kZXMubGVuZ3RoID4gMCkgc291cmNlcy5wdXNoKCdzY2VuZSBxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm8gcmV2ZXJzZSBzY2VuZSBsb29rdXAgZWl0aGVyOyBgc291cmNlc2Agc3RheXMgZW1wdHkgYW5kIGlzIHJlcG9ydGVkIGFzIHN1Y2guXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXNzZXRzLFxuICAgICAgICAgICAgbm9kZXMsXG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZXMubGVuZ3RoID4gMCA/IHNvdXJjZXMuam9pbignICsgJykgOiBgbm8gcmV2ZXJzZS1yZWZlcmVuY2UgcXVlcnkgYXZhaWxhYmxlIGZvciAnJHt1cmxPclVVSUR9JyBpbiB0aGlzIGVkaXRvciBidWlsZGBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydEFzc2V0TWFuaWZlc3QoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBmb3JtYXQ6IHN0cmluZyA9ICdqc29uJywgaW5jbHVkZU1ldGFkYXRhOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzOiBhbnlbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybjogYCR7ZGlyZWN0b3J5fS8qKi8qYCB9KTtcbiAgICAgICAgICAgIGNvbnN0IG1hbmlmZXN0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYW5pZmVzdEVudHJ5OiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBhc3NldC50eXBlLCBzaXplOiAoYXNzZXQgYXMgYW55KS5zaXplIHx8IDAsIGlzRGlyZWN0b3J5OiBhc3NldC5pc0RpcmVjdG9yeSB8fCBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVNZXRhZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXQudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLm1ldGEpIG1hbmlmZXN0RW50cnkubWV0YSA9IGFzc2V0SW5mby5tZXRhO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHsgLyogc2tpcCBtZXRhZGF0YSBpZiBub3QgYXZhaWxhYmxlICovIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbWFuaWZlc3QucHVzaChtYW5pZmVzdEVudHJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBleHBvcnREYXRhOiBzdHJpbmc7XG4gICAgICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Nzdic6IGV4cG9ydERhdGEgPSB0aGlzLmNvbnZlcnRUb0NTVihtYW5pZmVzdCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3htbCc6IGV4cG9ydERhdGEgPSB0aGlzLmNvbnZlcnRUb1hNTChtYW5pZmVzdCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGV4cG9ydERhdGEgPSBKU09OLnN0cmluZ2lmeShtYW5pZmVzdCwgbnVsbCwgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGRpcmVjdG9yeSwgZm9ybWF0LCBhc3NldENvdW50OiBtYW5pZmVzdC5sZW5ndGgsIGluY2x1ZGVNZXRhZGF0YSwgbWFuaWZlc3Q6IGV4cG9ydERhdGEgfSxcbiAgICAgICAgICAgICAgICBgQXNzZXQgbWFuaWZlc3QgZXhwb3J0ZWQgd2l0aCAke21hbmlmZXN0Lmxlbmd0aH0gYXNzZXRzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjb252ZXJ0VG9DU1YoZGF0YTogYW55W10pOiBzdHJpbmcge1xuICAgICAgICBpZiAoZGF0YS5sZW5ndGggPT09IDApIHJldHVybiAnJztcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xuICAgICAgICBjb25zdCBjc3ZSb3dzID0gW2hlYWRlcnMubWFwKGggPT4gZXNjYXBlQ3N2RmllbGQoaCkpLmpvaW4oJywnKV07XG4gICAgICAgIGZvciAoY29uc3Qgcm93IG9mIGRhdGEpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlcyA9IGhlYWRlcnMubWFwKGhlYWRlciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSByb3dbaGVhZGVyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdHIgPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gSlNPTi5zdHJpbmdpZnkodmFsdWUpIDogU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXNjYXBlQ3N2RmllbGQoc3RyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY3N2Um93cy5wdXNoKHZhbHVlcy5qb2luKCcsJykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjc3ZSb3dzLmpvaW4oJ1xcbicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29udmVydFRvWE1MKGRhdGE6IGFueVtdKTogc3RyaW5nIHtcbiAgICAgICAgbGV0IHhtbCA9ICc8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cXG48YXNzZXRzPlxcbic7XG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBkYXRhKSB7XG4gICAgICAgICAgICB4bWwgKz0gJyAgPGFzc2V0Plxcbic7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpdGVtKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHhtbFZhbHVlID0gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgIFN0cmluZyh2YWx1ZSkucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xuICAgICAgICAgICAgICAgIHhtbCArPSBgICAgIDwke2tleX0+JHt4bWxWYWx1ZX08LyR7a2V5fT5cXG5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeG1sICs9ICcgIDwvYXNzZXQ+XFxuJztcbiAgICAgICAgfVxuICAgICAgICB4bWwgKz0gJzwvYXNzZXRzPic7XG4gICAgICAgIHJldHVybiB4bWw7XG4gICAgfVxufVxuIl19