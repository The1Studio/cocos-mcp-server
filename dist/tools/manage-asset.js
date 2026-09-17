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
        this.description = 'Manage assets in the project (files, textures, scripts, etc). Actions: import, get_info, list, refresh, create, copy, move, delete, save, reimport, query_path, query_uuid, query_url, find_by_name, get_details, save_meta, generate_url, query_db_ready, open_external, batch_import, batch_delete, validate_references, get_dependencies, get_unused, compress_textures, export_manifest. NOT for scene nodes — use manage_node. Use query_db_ready to check asset DB before batch ops.';
        this.actions = [
            'import', 'get_info', 'list', 'refresh', 'create', 'copy', 'move', 'delete',
            'save', 'reimport', 'query_path', 'query_uuid', 'query_url', 'find_by_name',
            'get_details', 'save_meta', 'generate_url', 'query_db_ready', 'open_external',
            'batch_import', 'batch_delete', 'validate_references', 'get_dependencies',
            'get_unused', 'compress_textures', 'export_manifest'
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
                    description: 'Dependency direction',
                    enum: ['dependents', 'dependencies', 'both'],
                    default: 'dependencies'
                },
                format: {
                    type: 'string',
                    description: 'Format for compress_textures or export_manifest',
                    enum: ['auto', 'jpg', 'png', 'webp', 'json', 'csv', 'xml'],
                    default: 'auto'
                },
                quality: { type: 'number', description: 'Compression quality (0.1-1.0)', minimum: 0.1, maximum: 1.0, default: 0.8 },
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
            get_dependencies: (args) => this.getAssetDependencies(args.urlOrUUID, args.direction),
            get_unused: (args) => this.getUnusedAssets(args.directory, args.excludeDirectories),
            compress_textures: (args) => this.compressTextures(args.directory, args.format, args.quality),
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
    async getAssetDependencies(_urlOrUUID, _direction = 'dependencies') {
        return (0, types_1.errorResult)('Asset dependency analysis requires additional APIs not available in current Cocos Creator MCP implementation. Consider using the Editor UI for dependency analysis.');
    }
    async getUnusedAssets(_directory = 'db://assets', _excludeDirectories = []) {
        return (0, types_1.errorResult)('Unused asset detection requires comprehensive project analysis not available in current Cocos Creator MCP implementation. Consider using the Editor UI or third-party tools for unused asset detection.');
    }
    async compressTextures(_directory = 'db://assets', _format = 'auto', _quality = 0.8) {
        return (0, types_1.errorResult)("Texture compression requires image processing capabilities not available in current Cocos Creator MCP implementation. Use the Editor's built-in texture compression settings or external tools.");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvQ0FBd0U7QUFDeEUseURBQW9EO0FBQ3BELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7OztHQUdHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxTQUFpQjtJQUN4QyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM5RCxxREFBcUQ7SUFDckQsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQy9DLHdDQUF3QztJQUN4QyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3RHLDZDQUE2QztJQUM3QyxPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDM0MsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEtBQWE7SUFDakMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1FBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEQsb0NBQW9DO0lBQ3BDLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFBRSxLQUFLLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQztJQUNwRCxxREFBcUQ7SUFDckQsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FB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RSxDQUFDO1lBQ3RCLEdBQUcsSUFBSSxhQUFhLENBQUM7WUFDckIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDOUMsTUFBTSxRQUFRLEdBQUcsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUM7b0JBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDdkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUNyRixHQUFHLElBQUksUUFBUSxHQUFHLElBQUksUUFBUSxLQUFLLEdBQUcsS0FBSyxDQUFDO1lBQ2hELENBQUM7WUFDRCxHQUFHLElBQUksY0FBYyxDQUFDO1FBQzFCLENBQUM7UUFDRCxHQUFHLElBQUksV0FBVyxDQUFDO1FBQ25CLE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQztDQUNKO0FBcHBCRCxrQ0FvcEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGF0aCBpcyBzYWZlIGZvciBhc3NldCBvcGVyYXRpb25zLlxuICogUmVqZWN0cyB0cmF2ZXJzYWwgcGF0dGVybnMgYW5kIGJhcmUgYWJzb2x1dGUgcGF0aHMgKG5vbi1kYjovLyBmb3JtKS5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVBc3NldFBhdGgoYXNzZXRQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAoIWFzc2V0UGF0aCB8fCB0eXBlb2YgYXNzZXRQYXRoICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIC8vIEFsbG93IGRiOi8vIHByb3RvY29sIHBhdGhzIChDb2NvcyBhc3NldCBEQiBmb3JtYXQpXG4gICAgaWYgKGFzc2V0UGF0aC5zdGFydHNXaXRoKCdkYjovLycpKSByZXR1cm4gdHJ1ZTtcbiAgICAvLyBSZWplY3QgdHJhdmVyc2FsIHBhdHRlcm5zIGluIGFueSBmb3JtXG4gICAgaWYgKGFzc2V0UGF0aC5pbmNsdWRlcygnLi4nKSB8fCBhc3NldFBhdGguc3RhcnRzV2l0aCgnLycpIHx8IGFzc2V0UGF0aC5pbmNsdWRlcygnXFxcXC4uJykpIHJldHVybiBmYWxzZTtcbiAgICAvLyBNdXN0IHN0YXJ0IHdpdGggYXNzZXRzLyBmb3IgcmVsYXRpdmUgcGF0aHNcbiAgICByZXR1cm4gYXNzZXRQYXRoLnN0YXJ0c1dpdGgoJ2Fzc2V0cy8nKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlQ3N2RmllbGQoZmllbGQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiBmaWVsZCAhPT0gJ3N0cmluZycpIHJldHVybiBTdHJpbmcoZmllbGQpO1xuICAgIC8vIEVzY2FwZSBmb3JtdWxhIGluamVjdGlvbiBwcmVmaXhlc1xuICAgIGlmICgvXls9K1xcLUBcXHRcXHJdLy50ZXN0KGZpZWxkKSkgZmllbGQgPSBcIidcIiArIGZpZWxkO1xuICAgIC8vIFdyYXAgaW4gcXVvdGVzIGlmIGNvbnRhaW5zIGNvbW1hLCBxdW90ZSBvciBuZXdsaW5lXG4gICAgaWYgKGZpZWxkLmluY2x1ZGVzKCcsJykgfHwgZmllbGQuaW5jbHVkZXMoJ1wiJykgfHwgZmllbGQuaW5jbHVkZXMoJ1xcbicpKSB7XG4gICAgICAgIHJldHVybiAnXCInICsgZmllbGQucmVwbGFjZSgvXCIvZywgJ1wiXCInKSArICdcIic7XG4gICAgfVxuICAgIHJldHVybiBmaWVsZDtcbn1cblxuLyoqXG4gKiBJbXBvcnRlciBuYW1lcyBmb3IgYXNzZXQga2luZHMgd2hvc2Ugc2VyaWFsaXplZCBmaWxlIGlzIG5vdCB0ZXh0IOKAlCB3cml0aW5nIGFuXG4gKiBhcmJpdHJhcnkgc3RyaW5nIG92ZXIgb25lIG9mIHRoZXNlICh2aWEgYHNhdmVgKSB3b3VsZCBjb3JydXB0IGl0IHJhdGhlciB0aGFuIHVwZGF0ZVxuICogaXQuIEtlcHQgYWxvbmdzaWRlIHRoZSBleHRlbnNpb24gY2hlY2sgYmVsb3cgc2luY2Ugbm90IGV2ZXJ5IGFzc2V0IGxvb2t1cCByZXR1cm5zIGFuXG4gKiBgaW1wb3J0ZXJgICgjOTkgaXRlbSAxKS5cbiAqL1xuY29uc3QgQklOQVJZX0lNUE9SVEVSX05BTUVTID0gbmV3IFNldChbXG4gICAgJ2ltYWdlJywgJ3RleHR1cmUnLCAndGV4dHVyZS1jdWJlJywgJ2VycC10ZXh0dXJlLWN1YmUnLCAnc3ByaXRlLWZyYW1lJyxcbiAgICAnYXVkaW8tY2xpcCcsICd2aWRlby1jbGlwJywgJ3R0Zi1mb250JywgJ2JpdG1hcC1mb250JyxcbiAgICAnZHJhZ29uYm9uZXMnLCAnZHJhZ29uYm9uZXMtYXRsYXMnLCAnc3BpbmUtZGF0YScsXG4gICAgJ2dsdGYnLCAnZ2x0Zi1tZXNoJywgJ2dsdGYtbWF0ZXJpYWwnLCAnZ2x0Zi1lbWJlZGVkLWltYWdlJywgJ2dsdGYtc2NlbmUnLCAnZmJ4JywgJ2J1ZmZlcidcbl0pO1xuXG5jb25zdCBCSU5BUllfRVhURU5TSU9OUyA9IG5ldyBTZXQoW1xuICAgICcucG5nJywgJy5qcGcnLCAnLmpwZWcnLCAnLmdpZicsICcuYm1wJywgJy50Z2EnLCAnLnBzZCcsICcud2VicCcsXG4gICAgJy5tcDMnLCAnLm9nZycsICcud2F2JywgJy5tNGEnLCAnLnR0ZicsICcub3RmJywgJy5mbnQnLFxuICAgICcuZmJ4JywgJy5vYmonLCAnLmRhZScsICcuZ2xiJywgJy5nbHRmJywgJy5tcDQnLCAnLndlYm0nXG5dKTtcblxuLyoqIFRydWUgd2hlbiBgYXNzZXRJbmZvYC9gdXJsT3JQYXRoYCBuYW1lcyBhIGJpbmFyeSBhc3NldCBraW5kIHRoYXQgYHNhdmVgIG11c3QgcmVmdXNlLiAqL1xuZnVuY3Rpb24gaXNCaW5hcnlBc3NldChhc3NldEluZm86IGFueSwgdXJsT3JQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAoYXNzZXRJbmZvICYmIHR5cGVvZiBhc3NldEluZm8uaW1wb3J0ZXIgPT09ICdzdHJpbmcnICYmIEJJTkFSWV9JTVBPUlRFUl9OQU1FUy5oYXMoYXNzZXRJbmZvLmltcG9ydGVyKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgZXh0ID0gcGF0aC5leHRuYW1lKHVybE9yUGF0aCB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICByZXR1cm4gQklOQVJZX0VYVEVOU0lPTlMuaGFzKGV4dCk7XG59XG5cbi8qKlxuICogQ29uc29saWRhdGVkIGFzc2V0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvbWJpbmVzIFByb2plY3RUb29scyAoYXNzZXQgbWV0aG9kcykgKyBBc3NldEFkdmFuY2VkVG9vbHMgaW50byBvbmUgYWN0aW9uLWJhc2VkIHRvb2wuXG4gKi9cbmV4cG9ydCBjbGFzcyBNYW5hZ2VBc3NldCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9hc3NldCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGFzc2V0cyBpbiB0aGUgcHJvamVjdCAoZmlsZXMsIHRleHR1cmVzLCBzY3JpcHRzLCBldGMpLiBBY3Rpb25zOiBpbXBvcnQsIGdldF9pbmZvLCBsaXN0LCByZWZyZXNoLCBjcmVhdGUsIGNvcHksIG1vdmUsIGRlbGV0ZSwgc2F2ZSwgcmVpbXBvcnQsIHF1ZXJ5X3BhdGgsIHF1ZXJ5X3V1aWQsIHF1ZXJ5X3VybCwgZmluZF9ieV9uYW1lLCBnZXRfZGV0YWlscywgc2F2ZV9tZXRhLCBnZW5lcmF0ZV91cmwsIHF1ZXJ5X2RiX3JlYWR5LCBvcGVuX2V4dGVybmFsLCBiYXRjaF9pbXBvcnQsIGJhdGNoX2RlbGV0ZSwgdmFsaWRhdGVfcmVmZXJlbmNlcywgZ2V0X2RlcGVuZGVuY2llcywgZ2V0X3VudXNlZCwgY29tcHJlc3NfdGV4dHVyZXMsIGV4cG9ydF9tYW5pZmVzdC4gTk9UIGZvciBzY2VuZSBub2RlcyDigJQgdXNlIG1hbmFnZV9ub2RlLiBVc2UgcXVlcnlfZGJfcmVhZHkgdG8gY2hlY2sgYXNzZXQgREIgYmVmb3JlIGJhdGNoIG9wcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdpbXBvcnQnLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZWZyZXNoJywgJ2NyZWF0ZScsICdjb3B5JywgJ21vdmUnLCAnZGVsZXRlJyxcbiAgICAgICAgJ3NhdmUnLCAncmVpbXBvcnQnLCAncXVlcnlfcGF0aCcsICdxdWVyeV91dWlkJywgJ3F1ZXJ5X3VybCcsICdmaW5kX2J5X25hbWUnLFxuICAgICAgICAnZ2V0X2RldGFpbHMnLCAnc2F2ZV9tZXRhJywgJ2dlbmVyYXRlX3VybCcsICdxdWVyeV9kYl9yZWFkeScsICdvcGVuX2V4dGVybmFsJyxcbiAgICAgICAgJ2JhdGNoX2ltcG9ydCcsICdiYXRjaF9kZWxldGUnLCAndmFsaWRhdGVfcmVmZXJlbmNlcycsICdnZXRfZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgJ2dldF91bnVzZWQnLCAnY29tcHJlc3NfdGV4dHVyZXMnLCAnZXhwb3J0X21hbmlmZXN0J1xuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9uc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNvdXJjZVBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnU291cmNlIGZpbGUgcGF0aCBvbiBkaXNrIChmb3IgaW1wb3J0KScgfSxcbiAgICAgICAgICAgIHRhcmdldEZvbGRlcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgZm9sZGVyIFVSTCAoZm9yIGltcG9ydCknIH0sXG4gICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgcGF0aCAoZGI6Ly9hc3NldHMvLi4uKScgfSxcbiAgICAgICAgICAgIHVybE9yVVVJRDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgb3IgVVVJRCcgfSxcbiAgICAgICAgICAgIHVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgKGRiOi8vYXNzZXRzLy4uLiknIH0sXG4gICAgICAgICAgICB1dWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVVSUQnIH0sXG4gICAgICAgICAgICBjb250ZW50OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZpbGUgY29udGVudCBvciBtZXRhIGNvbnRlbnQnIH0sXG4gICAgICAgICAgICBvdmVyd3JpdGU6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ092ZXJ3cml0ZSBleGlzdGluZyBmaWxlJywgZGVmYXVsdDogZmFsc2UgfSxcbiAgICAgICAgICAgIHNvdXJjZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgYXNzZXQgVVJMIChmb3IgY29weS9tb3ZlKScgfSxcbiAgICAgICAgICAgIHRhcmdldDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgYXNzZXQgVVJMIChmb3IgY29weS9tb3ZlKScgfSxcbiAgICAgICAgICAgIGZvbGRlcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdGb2xkZXIgdG8gc2VhcmNoL2xpc3QnLCBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnIH0sXG4gICAgICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCB0eXBlIGZpbHRlcicsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IG5hbWUgdG8gc2VhcmNoIGZvcicgfSxcbiAgICAgICAgICAgIGV4YWN0TWF0Y2g6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0V4YWN0IG5hbWUgbWF0Y2gnLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgYXNzZXRUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGaWx0ZXIgYnkgYXNzZXQgdHlwZScsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJywgJ3Nwcml0ZUZyYW1lJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhSZXN1bHRzOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ01heCByZXN1bHRzIGZvciBmaW5kX2J5X25hbWUnLCBkZWZhdWx0OiAyMCwgbWluaW11bTogMSwgbWF4aW11bTogMTAwIH0sXG4gICAgICAgICAgICBpbmNsdWRlU3ViQXNzZXRzOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdJbmNsdWRlIHN1Yi1hc3NldHMgKHNwcml0ZUZyYW1lLCB0ZXh0dXJlKScsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgICAgIHNvdXJjZURpcmVjdG9yeTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgZGlyZWN0b3J5IGZvciBiYXRjaF9pbXBvcnQnIH0sXG4gICAgICAgICAgICB0YXJnZXREaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGRpcmVjdG9yeSBVUkwgZm9yIGJhdGNoX2ltcG9ydCcgfSxcbiAgICAgICAgICAgIGZpbGVGaWx0ZXI6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdGaWxlIGV4dGVuc2lvbnMgZmlsdGVyJywgZGVmYXVsdDogW10gfSxcbiAgICAgICAgICAgIHJlY3Vyc2l2ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBzdWJkaXJlY3RvcmllcycsIGRlZmF1bHQ6IGZhbHNlIH0sXG4gICAgICAgICAgICB1cmxzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnQXJyYXkgb2YgYXNzZXQgVVJMcyBmb3IgYmF0Y2hfZGVsZXRlJyB9LFxuICAgICAgICAgICAgZGlyZWN0b3J5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0RpcmVjdG9yeSB0byBzY2FuJywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJyB9LFxuICAgICAgICAgICAgZXhjbHVkZURpcmVjdG9yaWVzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnRGlyZWN0b3JpZXMgdG8gZXhjbHVkZScsIGRlZmF1bHQ6IFtdIH0sXG4gICAgICAgICAgICBkaXJlY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlcGVuZGVuY3kgZGlyZWN0aW9uJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlcGVuZGVudHMnLCAnZGVwZW5kZW5jaWVzJywgJ2JvdGgnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGVwZW5kZW5jaWVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvcm1hdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRm9ybWF0IGZvciBjb21wcmVzc190ZXh0dXJlcyBvciBleHBvcnRfbWFuaWZlc3QnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYXV0bycsICdqcGcnLCAncG5nJywgJ3dlYnAnLCAnanNvbicsICdjc3YnLCAneG1sJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2F1dG8nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcXVhbGl0eTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdDb21wcmVzc2lvbiBxdWFsaXR5ICgwLjEtMS4wKScsIG1pbmltdW06IDAuMSwgbWF4aW11bTogMS4wLCBkZWZhdWx0OiAwLjggfSxcbiAgICAgICAgICAgIGluY2x1ZGVNZXRhZGF0YTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBhc3NldCBtZXRhZGF0YSBpbiBtYW5pZmVzdCcsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgICAgIGlzRm9sZGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gRXhwbGljaXRseSBjcmVhdGUgYSBmb2xkZXIsIHJlZ2FyZGxlc3Mgb2YgYGNvbnRlbnRgLiBVc2UgdGhpcyBpbnN0ZWFkIG9mIG9taXR0aW5nIGBjb250ZW50YCDigJQgbWFueSBNQ1AgdHJhbnNwb3J0cyBjb2VyY2UgYW4gb21pdHRlZCBvcHRpb25hbCBzdHJpbmcgdG8gYFwiXCJgLCB3aGljaCBvdGhlcndpc2UgbWFrZXMgZm9sZGVyIGNyZWF0aW9uIHVucmVhY2hhYmxlLicsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogYG1hbmFnZV9hc3NldGAgYWN0aW9ucyBoaXN0b3JpY2FsbHkgcmVhZCBhIGRpZmZlcmVudCBhbGlhcyBmb3IgdGhlIHNhbWUgXCJhc3NldFxuICAgICAqIHJlZmVyZW5jZVwiIGNvbmNlcHQg4oCUIHNvbWUgYHVybGAsIHNvbWUgYGFzc2V0UGF0aGAsIHNvbWUgYHVybE9yVVVJRGAg4oCUIHdpdGggbm9cbiAgICAgKiBzY2hlbWEgc2lnbmFsIGFib3V0IHdoaWNoIG5hbWUgYSBnaXZlbiBhY3Rpb24gZXhwZWN0ZWQuIEEgY2FsbGVyIHBhc3NpbmcgdGhlXG4gICAgICogZG9jdW1lbnRlZCBgYXNzZXRQYXRoYCB0byBgY3JlYXRlYCBzaWxlbnRseSBmb3J3YXJkZWQgYHVuZGVmaW5lZGAsIHN1cmZhY2luZyBhc1xuICAgICAqIHRoZSBlZGl0b3IncyBvd24gdW5yZWxhdGVkIGBcIm9wdGlvbnMudGFyZ2V0IGlzIHJlcXVpcmVkXCJgIGVycm9yICgjODAsICM5OSBpdGVtIDcpLlxuICAgICAqIEV2ZXJ5IGFjdGlvbiBiZWxvdyBub3cgcmVzb2x2ZXMgdGhyb3VnaCB0aGlzIHNhbWUgYWxpYXMgc2V0LlxuICAgICAqL1xuICAgIHByaXZhdGUgcmVzb2x2ZUFzc2V0QXJnKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgICAgICByZXR1cm4gYXJncy51cmwgfHwgYXJncy51cmxPclVVSUQgfHwgYXJncy5hc3NldFBhdGggfHwgdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBpbXBvcnQ6IChhcmdzKSA9PiB0aGlzLmltcG9ydEFzc2V0KGFyZ3Muc291cmNlUGF0aCwgYXJncy50YXJnZXRGb2xkZXIpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXRJbmZvKHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXRzKGFyZ3MudHlwZSwgYXJncy5mb2xkZXIpLFxuICAgICAgICAvLyBgZm9sZGVyYCBpcyB0aGUgaW50ZW5kZWQgc2NvcGUgcGFyYW07IGZhbGwgYmFjayB0byB0aGUgYXNzZXQtcmVmIGFsaWFzZXMgb25seVxuICAgICAgICAvLyB3aGVuIGl0IGlzIG9taXR0ZWQsIHNvIHBhc3NpbmcgYHVybGAgaW5zdGVhZCBvZiBgZm9sZGVyYCBjYW4gbmV2ZXIgc2lsZW50bHlcbiAgICAgICAgLy8gd2lkZW4gdGhlIHJlZnJlc2ggdG8gdGhlIHdob2xlIHByb2plY3QgKGBkYjovL2Fzc2V0c2ApIOKAlCBzZWUgcmVmcmVzaEFzc2V0cygpLlxuICAgICAgICByZWZyZXNoOiAoYXJncykgPT4gdGhpcy5yZWZyZXNoQXNzZXRzKGFyZ3MuZm9sZGVyIHx8IHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVBc3NldChcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpLFxuICAgICAgICAgICAgYXJncy5jb250ZW50ID8/IG51bGwsXG4gICAgICAgICAgICBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnLFxuICAgICAgICAgICAgYXJncy5pc0ZvbGRlciA9PT0gdHJ1ZSB8fCBhcmdzLmlzRm9sZGVyID09PSAndHJ1ZSdcbiAgICAgICAgKSxcbiAgICAgICAgY29weTogKGFyZ3MpID0+IHRoaXMuY29weUFzc2V0KGFyZ3Muc291cmNlLCBhcmdzLnRhcmdldCwgYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJyksXG4gICAgICAgIG1vdmU6IChhcmdzKSA9PiB0aGlzLm1vdmVBc3NldChhcmdzLnNvdXJjZSwgYXJncy50YXJnZXQsIGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZScpLFxuICAgICAgICBkZWxldGU6IChhcmdzKSA9PiB0aGlzLmRlbGV0ZUFzc2V0KHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpKSxcbiAgICAgICAgc2F2ZTogKGFyZ3MpID0+IHRoaXMuc2F2ZUFzc2V0KHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpLCBhcmdzLmNvbnRlbnQpLFxuICAgICAgICByZWltcG9ydDogKGFyZ3MpID0+IHRoaXMucmVpbXBvcnRBc3NldCh0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSksXG4gICAgICAgIHF1ZXJ5X3BhdGg6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRQYXRoKGFyZ3MudXJsIHx8IGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgcXVlcnlfdXVpZDogKGFyZ3MpID0+IHRoaXMucXVlcnlBc3NldFV1aWQoYXJncy51cmwpLFxuICAgICAgICBxdWVyeV91cmw6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRVcmwoYXJncy51dWlkKSxcbiAgICAgICAgZmluZF9ieV9uYW1lOiAoYXJncykgPT4gdGhpcy5maW5kQXNzZXRCeU5hbWUoYXJncyksXG4gICAgICAgIGdldF9kZXRhaWxzOiAoYXJncykgPT4gdGhpcy5nZXRBc3NldERldGFpbHModGhpcy5yZXNvbHZlQXNzZXRBcmcoYXJncyksIGFyZ3MuaW5jbHVkZVN1YkFzc2V0cyAhPT0gZmFsc2UpLFxuICAgICAgICBzYXZlX21ldGE6IChhcmdzKSA9PiB0aGlzLnNhdmVBc3NldE1ldGEodGhpcy5yZXNvbHZlQXNzZXRBcmcoYXJncyksIGFyZ3MuY29udGVudCksXG4gICAgICAgIGdlbmVyYXRlX3VybDogKGFyZ3MpID0+IHRoaXMuZ2VuZXJhdGVBdmFpbGFibGVVcmwoYXJncy51cmwpLFxuICAgICAgICBxdWVyeV9kYl9yZWFkeTogKF9hcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXREYlJlYWR5KCksXG4gICAgICAgIG9wZW5fZXh0ZXJuYWw6IChhcmdzKSA9PiB0aGlzLm9wZW5Bc3NldEV4dGVybmFsKGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgYmF0Y2hfaW1wb3J0OiAoYXJncykgPT4gdGhpcy5iYXRjaEltcG9ydEFzc2V0cyhhcmdzKSxcbiAgICAgICAgYmF0Y2hfZGVsZXRlOiAoYXJncykgPT4gdGhpcy5iYXRjaERlbGV0ZUFzc2V0cyhhcmdzLnVybHMpLFxuICAgICAgICB2YWxpZGF0ZV9yZWZlcmVuY2VzOiAoYXJncykgPT4gdGhpcy52YWxpZGF0ZUFzc2V0UmVmZXJlbmNlcyhhcmdzLmRpcmVjdG9yeSksXG4gICAgICAgIGdldF9kZXBlbmRlbmNpZXM6IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0RGVwZW5kZW5jaWVzKGFyZ3MudXJsT3JVVUlELCBhcmdzLmRpcmVjdGlvbiksXG4gICAgICAgIGdldF91bnVzZWQ6IChhcmdzKSA9PiB0aGlzLmdldFVudXNlZEFzc2V0cyhhcmdzLmRpcmVjdG9yeSwgYXJncy5leGNsdWRlRGlyZWN0b3JpZXMpLFxuICAgICAgICBjb21wcmVzc190ZXh0dXJlczogKGFyZ3MpID0+IHRoaXMuY29tcHJlc3NUZXh0dXJlcyhhcmdzLmRpcmVjdG9yeSwgYXJncy5mb3JtYXQsIGFyZ3MucXVhbGl0eSksXG4gICAgICAgIGV4cG9ydF9tYW5pZmVzdDogKGFyZ3MpID0+IHRoaXMuZXhwb3J0QXNzZXRNYW5pZmVzdChhcmdzLmRpcmVjdG9yeSwgYXJncy5mb3JtYXQsIGFyZ3MuaW5jbHVkZU1ldGFkYXRhICE9PSBmYWxzZSlcbiAgICB9O1xuXG4gICAgLy8g4pSA4pSAIEZyb20gUHJvamVjdFRvb2xzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbXBvcnRBc3NldChzb3VyY2VQYXRoOiBzdHJpbmcsIHRhcmdldEZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhzb3VyY2VQYXRoKSkgcmV0dXJuIGVycm9yUmVzdWx0KCdTb3VyY2UgZmlsZSBub3QgZm91bmQnKTtcbiAgICAgICAgaWYgKCF2YWxpZGF0ZUFzc2V0UGF0aCh0YXJnZXRGb2xkZXIpKSByZXR1cm4gZXJyb3JSZXN1bHQoJ0ludmFsaWQgdGFyZ2V0IGZvbGRlciBwYXRoOiBtdXN0IGJlIGRiOi8vIFVSTCBvciBhc3NldHMvIHJlbGF0aXZlIHBhdGggd2l0aG91dCB0cmF2ZXJzYWwnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShzb3VyY2VQYXRoKTtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSB0YXJnZXRGb2xkZXIuc3RhcnRzV2l0aCgnZGI6Ly8nKSA/IHRhcmdldEZvbGRlciA6IGBkYjovL2Fzc2V0cy8ke3RhcmdldEZvbGRlcn1gO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdpbXBvcnQtYXNzZXQnLCBzb3VyY2VQYXRoLCBgJHt0YXJnZXRQYXRofS8ke2ZpbGVOYW1lfWApO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1dWlkOiByZXN1bHQudXVpZCwgcGF0aDogcmVzdWx0LnVybCwgbWVzc2FnZTogYEFzc2V0IGltcG9ydGVkOiAke2ZpbGVOYW1lfWAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldEluZm8oYXNzZXRQYXRoPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXNzZXRQYXRoIHx8IHR5cGVvZiBhc3NldFBhdGggIT09ICdzdHJpbmcnIHx8IGFzc2V0UGF0aC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2dldF9pbmZvIHJlcXVpcmVzIG9uZSBvZjogdXJsLCB1cmxPclVVSUQsIGFzc2V0UGF0aCcpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhc3NldFBhdGgpO1xuICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgbm90IGZvdW5kJyk7XG4gICAgICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXRJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgdXVpZDogYXNzZXRJbmZvLnV1aWQsXG4gICAgICAgICAgICAgICAgcGF0aDogYXNzZXRJbmZvLnVybCxcbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldEluZm8udHlwZSxcbiAgICAgICAgICAgICAgICBzaXplOiBhc3NldEluZm8uc2l6ZSxcbiAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogYXNzZXRJbmZvLmlzRGlyZWN0b3J5XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGFzc2V0SW5mby5tZXRhKSB7XG4gICAgICAgICAgICAgICAgaW5mby5tZXRhID0geyB2ZXI6IGFzc2V0SW5mby5tZXRhLnZlciwgaW1wb3J0ZXI6IGFzc2V0SW5mby5tZXRhLmltcG9ydGVyIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0cyh0eXBlOiBzdHJpbmcgPSAnYWxsJywgZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgcGF0dGVybiA9IGAke2ZvbGRlcn0vKiovKmA7XG4gICAgICAgICAgICBpZiAodHlwZSAhPT0gJ2FsbCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlRXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICAgICAgJ3NjZW5lJzogJy5zY2VuZScsICdwcmVmYWInOiAnLnByZWZhYicsICdzY3JpcHQnOiAnLnt0cyxqc30nLFxuICAgICAgICAgICAgICAgICAgICAndGV4dHVyZSc6ICcue3BuZyxqcGcsanBlZyxnaWYsdGdhLGJtcCxwc2R9JywgJ21hdGVyaWFsJzogJy5tdGwnLFxuICAgICAgICAgICAgICAgICAgICAnbWVzaCc6ICcue2ZieCxvYmosZGFlfScsICdhdWRpbyc6ICcue21wMyxvZ2csd2F2LG00YX0nLCAnYW5pbWF0aW9uJzogJy57YW5pbSxjbGlwfSdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHR5cGVFeHRlbnNpb25zW3R5cGVdO1xuICAgICAgICAgICAgICAgIGlmIChleHRlbnNpb24pIHBhdHRlcm4gPSBgJHtmb2xkZXJ9LyoqLyoke2V4dGVuc2lvbn1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHV1aWQ6IGFzc2V0LnV1aWQsIHBhdGg6IGFzc2V0LnVybCxcbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldC50eXBlLCBzaXplOiBhc3NldC5zaXplIHx8IDAsIGlzRGlyZWN0b3J5OiBhc3NldC5pc0RpcmVjdG9yeSB8fCBmYWxzZVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlLCBmb2xkZXIsIGNvdW50OiBhc3NldHMubGVuZ3RoLCBhc3NldHMgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYGZvbGRlcmAgaXMgdGhlIGludGVuZGVkIHNjb3BlIGZvciB0aGlzIGFjdGlvbjsgdGhlIGRpc3BhdGNoIHRhYmxlIG5vdyBmYWxsc1xuICAgICAqIGJhY2sgdG8gdGhlIGFzc2V0LXJlZiBhbGlhc2VzIChgdXJsYC9gdXJsT3JVVUlEYC9gYXNzZXRQYXRoYCkgb25seSB3aGVuIGBmb2xkZXJgXG4gICAgICogaXRzZWxmIGlzIG9taXR0ZWQsIHNvIGEgY2FsbGVyIHdobyBwYXNzZXMgYHVybGAgc3RpbGwgcmVmcmVzaGVzIGp1c3QgdGhhdCBwYXRoXG4gICAgICogaW5zdGVhZCBvZiBzaWxlbnRseSB3aWRlbmluZyB0aGUgcmVmcmVzaCB0byB0aGUgd2hvbGUgcHJvamVjdCAoYGRiOi8vYXNzZXRzYCksXG4gICAgICogd2hpY2ggaXMgd2hhdCBoYXBwZW5lZCB3aGVuIGEgbm9uLWBmb2xkZXJgIGFyZ3VtZW50IHJlYWNoZWQgaGVyZSBhcyBgdW5kZWZpbmVkYC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlZnJlc2hBc3NldHMoZm9sZGVyPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gZm9sZGVyIHx8ICdkYjovL2Fzc2V0cyc7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgdGFyZ2V0UGF0aCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCBgQXNzZXRzIHJlZnJlc2hlZCBpbjogJHt0YXJnZXRQYXRofWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBjb250ZW50ID09PSBudWxsYCAoaS5lLiBvbWl0dGVkKSBoYXMgYWx3YXlzIG1lYW50IFwiY3JlYXRlIGEgZm9sZGVyXCIuIFRoYXRcbiAgICAgKiBpbmZlcmVuY2UgYnJlYWtzIHdoZW5ldmVyIHRoZSBjYWxsaW5nIE1DUCB0cmFuc3BvcnQgY29lcmNlcyBhbiBvbWl0dGVkIG9wdGlvbmFsXG4gICAgICogc3RyaW5nIHRvIGBcIlwiYCBiZWZvcmUgaXQgcmVhY2hlcyBoZXJlIOKAlCBgY29udGVudCA/PyBudWxsYCBuZXZlciBzdWJzdGl0dXRlcyBvbiBhblxuICAgICAqIGVtcHR5IHN0cmluZywgc28gaXQgaXMgZm9yd2FyZGVkIGRvd24gdGhlIEZJTEUgcGF0aCBhbmQgZm9sZGVyIGNyZWF0aW9uIGJlY29tZXNcbiAgICAgKiB1bnJlYWNoYWJsZSB0aHJvdWdoIHRoYXQgdHJhbnNwb3J0LiBgaXNGb2xkZXJgIG1ha2VzIHRoZSBpbnRlbnQgZXhwbGljaXQgaW5zdGVhZFxuICAgICAqIG9mIGluZmVycmluZyBpdCBmcm9tIGBjb250ZW50YCwgd2hpbGUgYGNvbnRlbnQgPT09IG51bGxgIGlzIGtlcHQgYXMgdGhlIG9yaWdpbmFsXG4gICAgICogKHN0aWxsLXZhbGlkKSBpbXBsaWNpdCBmb3JtIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5ICgjOTkgaXRlbSA2KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUFzc2V0KHVybD86IHN0cmluZywgY29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGwsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlLCBpc0ZvbGRlcjogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXJsIHx8IHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2NyZWF0ZSByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgg4oCUIG5hbWluZyB0aGUgYXNzZXQgdG8gY3JlYXRlJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGZvbGRlciA9IGlzRm9sZGVyIHx8IGNvbnRlbnQgPT09IG51bGw7XG4gICAgICAgICAgICBjb25zdCBlZmZlY3RpdmVDb250ZW50ID0gZm9sZGVyID8gbnVsbCA6IGNvbnRlbnQ7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9O1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCB1cmwsIGVmZmVjdGl2ZUNvbnRlbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgbXNnID0gZm9sZGVyID8gJ0ZvbGRlciBjcmVhdGVkIHN1Y2Nlc3NmdWxseScgOiAnRmlsZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseSc7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQgJiYgcmVzdWx0LnV1aWQgPyB7IHV1aWQ6IHJlc3VsdC51dWlkLCB1cmw6IHJlc3VsdC51cmwsIG1lc3NhZ2U6IG1zZyB9IDogeyB1cmwsIG1lc3NhZ2U6IG1zZyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvcHlBc3NldChzb3VyY2U6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NvcHktYXNzZXQnLCBzb3VyY2UsIHRhcmdldCwgeyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZFxuICAgICAgICAgICAgICAgID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsLCBtZXNzYWdlOiAnQXNzZXQgY29waWVkIHN1Y2Nlc3NmdWxseScgfVxuICAgICAgICAgICAgICAgIDogeyBzb3VyY2UsIHRhcmdldCwgbWVzc2FnZTogJ0Fzc2V0IGNvcGllZCBzdWNjZXNzZnVsbHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbW92ZUFzc2V0KHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnbW92ZS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkXG4gICAgICAgICAgICAgICAgPyB7IHV1aWQ6IHJlc3VsdC51dWlkLCB1cmw6IHJlc3VsdC51cmwsIG1lc3NhZ2U6ICdBc3NldCBtb3ZlZCBzdWNjZXNzZnVsbHknIH1cbiAgICAgICAgICAgICAgICA6IHsgc291cmNlLCB0YXJnZXQsIG1lc3NhZ2U6ICdBc3NldCBtb3ZlZCBzdWNjZXNzZnVsbHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBkZWxldGUtYXNzZXRgIHJlc29sdmluZyBpdHMgcHJvbWlzZSBpcyBub3QgcHJvb2YgdGhlIGZpbGUgaXMgZ29uZSDigJQgdGhlIG9sZCBjb2RlXG4gICAgICogdHJ1c3RlZCB0aGF0IHJlc29sdXRpb24gYWxvbmUgYW5kIHJlcG9ydGVkIHN1Y2Nlc3MgdW5jb25kaXRpb25hbGx5LiBBIHJlYWQtYmFja1xuICAgICAqIHF1ZXJ5IGltbWVkaWF0ZWx5IGFmdGVyIG5vdyBjb25maXJtcyB0aGUgYXNzZXQgZGIgbm8gbG9uZ2VyIGtub3dzIGFib3V0IHRoZSB1cmxcbiAgICAgKiBiZWZvcmUgc3VjY2VzcyBpcyByZXBvcnRlZCwgbWlycm9yaW5nIHRoZSB2ZXJpZnktZG9uJ3QtdHJ1c3QgcGF0dGVybiBhbHJlYWR5IHVzZWRcbiAgICAgKiBieSBgbWFuYWdlX3NjZW5lYCdzIGBzYXZlYCBhY3Rpb24gKCM5OSBpdGVtIDUpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZGVsZXRlQXNzZXQodXJsPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXJsIHx8IHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2RlbGV0ZSByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgIGNvbnN0IHN0aWxsUHJlc2VudDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgICAgICBpZiAoc3RpbGxQcmVzZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBhc3NldC1kYjpkZWxldGUtYXNzZXQgcmVzb2x2ZWQsIGJ1dCAnJHt1cmx9JyBpcyBzdGlsbCBwcmVzZW50IGluIHRoZSBhc3NldCBEQiBpbW1lZGlhdGVseSBhZnRlcndhcmQg4oCUIHRoZSBkZWxldGUgZGlkIG5vdCB0YWtlIGVmZmVjdC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsIH0sICdBc3NldCBkZWxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEZvcndhcmRpbmcgYW4gYXJiaXRyYXJ5IHN0cmluZyBvdmVyIGEgYmluYXJ5IGFzc2V0IChlLmcuIHdyaXRpbmcgdGV4dCBjb250ZW50XG4gICAgICogb3ZlciBhIGAucG5nYCkgZG9lcyBub3QgdXBkYXRlIGl0IOKAlCBpdCBjb3JydXB0cyBpdC4gUXVlcnkgdGhlIHRhcmdldCdzIGltcG9ydGVyXG4gICAgICogYmVmb3JlIHdyaXRpbmcgYW5kIHJlZnVzZSB0aGUgd3JpdGUgZm9yIGEga25vd24tYmluYXJ5IGtpbmQgKCM5OSBpdGVtIDEpLlxuICAgICAqIExlZ2l0aW1hdGUgdGV4dCBhc3NldHMgKC50cywgLmpzb24sIC50eHQsIG1hdGVyaWFscywgc2NlbmVzLCAuLi4pIGFyZSB1bmFmZmVjdGVkLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2F2ZUFzc2V0KHVybD86IHN0cmluZywgY29udGVudD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXVybCB8fCB0eXBlb2YgdXJsICE9PSAnc3RyaW5nJyB8fCB1cmwudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlIHJlcXVpcmVzIG9uZSBvZjogdXJsLCB1cmxPclVVSUQsIGFzc2V0UGF0aCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2YgY29udGVudCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnc2F2ZSByZXF1aXJlcyBjb250ZW50OiBhIHN0cmluZycpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB1cmwpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgICAgICAgaWYgKGFzc2V0SW5mbyAmJiB0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycgJiYgaXNCaW5hcnlBc3NldChhc3NldEluZm8sIHVybCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGBzYXZlIGNhbm5vdCB3cml0ZSBzdHJpbmcgY29udGVudCBvdmVyICcke3VybH0nOiBpdCByZXNvbHZlcyB0byBhIGJpbmFyeSBhc3NldCBgICtcbiAgICAgICAgICAgICAgICAgICAgYChpbXBvcnRlcj0nJHthc3NldEluZm8uaW1wb3J0ZXJ9JywgdHlwZT0nJHthc3NldEluZm8udHlwZX0nKS4gV3JpdGluZyB0ZXh0IGNvbnRlbnQgb3ZlciBhIGAgK1xuICAgICAgICAgICAgICAgICAgICAnYmluYXJ5IGFzc2V0IHdvdWxkIGNvcnJ1cHQgaXQg4oCUIHVzZSBpbXBvcnQvY29weSB0byByZXBsYWNlIGJpbmFyeSBhc3NldCBjb250ZW50IGluc3RlYWQuJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCB1cmwsIGNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsIH0gOiB7IHVybCB9LCAnQXNzZXQgc2F2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYHJlaW1wb3J0LWFzc2V0YCBvbiBhIGRpcmVjdG9yeSBVUkwgcHJldmlvdXNseSBmb3J3YXJkZWQgc3RyYWlnaHQgdG8gdGhlIGVkaXRvclxuICAgICAqIHdpdGggbm8gZGlyZWN0b3J5IGNoZWNrLCBubyBjaGlsZCBlbnVtZXJhdGlvbiwgYW5kIHRoZSBib29sZWFuIHJlc3VsdCB3YXNcbiAgICAgKiBkaXNjYXJkZWQg4oCUIGFuIHVuY29uZGl0aW9uYWwgc3VjY2VzcyByZWdhcmRsZXNzIG9mIHdoYXQgYWN0dWFsbHkgaGFwcGVuZWQuIFRoZVxuICAgICAqIGRlY2lzaW9uIGhlcmUgaXMgUkVGVVNFLCBub3QgcmVjdXJzZTogYSBmb2xkZXIgZG9lcyBub3QgaGF2ZSBpbXBvcnRhYmxlIGNvbnRlbnRcbiAgICAgKiBvZiBpdHMgb3duLCBzbyBlYWNoIGNoaWxkIGFzc2V0IG11c3QgYmUgcmVpbXBvcnRlZCBieSBpdHMgb3duIHVybCAoIzk2KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlaW1wb3J0QXNzZXQodXJsPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXJsIHx8IHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3JlaW1wb3J0IHJlcXVpcmVzIG9uZSBvZjogdXJsLCB1cmxPclVVSUQsIGFzc2V0UGF0aCcpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXJsKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgICAgIGlmIChpbmZvICYmIGluZm8uaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGByZWltcG9ydCBkb2VzIG5vdCBhY2NlcHQgYSBmb2xkZXIgVVJMICgnJHt1cmx9JyBpcyBhIGRpcmVjdG9yeSkg4oCUIHRoaXMgYWN0aW9uIGRvZXMgbm90IGAgK1xuICAgICAgICAgICAgICAgICAgICAncmVjdXJzZSBpbnRvIGZvbGRlciBjb250ZW50cy4gUmVpbXBvcnQgZWFjaCBjaGlsZCBhc3NldCBpbmRpdmlkdWFsbHkgYnkgaXRzIG93biB1cmwgaW5zdGVhZC4nXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBhc3NldC1kYjpyZWltcG9ydC1hc3NldCByZXR1cm5lZCBmYWxzZSBmb3IgJyR7dXJsfScg4oCUIHRoZSBlZGl0b3IgcmVqZWN0ZWQgdGhlIHJlaW1wb3J0LmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmwgfSwgJ0Fzc2V0IHJlaW1wb3J0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0UGF0aCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRQYXRoOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcGF0aCcsIHVybCkgYXMgc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgICAgIGlmIChhc3NldFBhdGgpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsLCBwYXRoOiBhc3NldFBhdGggfSwgJ0Fzc2V0IHBhdGggcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdBc3NldCBwYXRoIG5vdCBmb3VuZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFV1aWQodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQ6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgdXJsKSBhcyBzdHJpbmcgfCBudWxsO1xuICAgICAgICAgICAgaWYgKHV1aWQpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsLCB1dWlkIH0sICdBc3NldCBVVUlEIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgVVVJRCBub3QgZm91bmQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXRVcmwodXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmw6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11cmwnLCB1dWlkKSBhcyBzdHJpbmcgfCBudWxsO1xuICAgICAgICAgICAgaWYgKHVybCkgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1dWlkLCB1cmwgfSwgJ0Fzc2V0IFVSTCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IFVSTCBub3QgZm91bmQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZpbmRBc3NldEJ5TmFtZShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBuYW1lLCBleGFjdE1hdGNoID0gZmFsc2UsIGFzc2V0VHlwZSA9ICdhbGwnLCBmb2xkZXIgPSAnZGI6Ly9hc3NldHMnLCBtYXhSZXN1bHRzID0gMjAgfSA9IGFyZ3M7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhbGxBc3NldHNSZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0cyhhc3NldFR5cGUsIGZvbGRlcik7XG4gICAgICAgICAgICBpZiAoIWFsbEFzc2V0c1Jlc3VsdC5zdWNjZXNzIHx8ICFhbGxBc3NldHNSZXN1bHQuZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBhc3NldHM6ICR7YWxsQXNzZXRzUmVzdWx0LmVycm9yfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzID0gYWxsQXNzZXRzUmVzdWx0LmRhdGEuYXNzZXRzIGFzIGFueVtdO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZEFzc2V0czogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYWxsQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGV4YWN0TWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgPyBhc3NldC5uYW1lID09PSBuYW1lXG4gICAgICAgICAgICAgICAgICAgIDogYXNzZXQubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKG5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRldGFpbFJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QXNzZXRJbmZvKGFzc2V0LnBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZEFzc2V0cy5wdXNoKGRldGFpbFJlc3VsdC5zdWNjZXNzID8geyAuLi5hc3NldCwgZGV0YWlsczogZGV0YWlsUmVzdWx0LmRhdGEgfSA6IGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXNzZXRzLnB1c2goYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkQXNzZXRzLmxlbmd0aCA+PSBtYXhSZXN1bHRzKSBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgc2VhcmNoVGVybTogbmFtZSwgZXhhY3RNYXRjaCwgYXNzZXRUeXBlLCBmb2xkZXIsXG4gICAgICAgICAgICAgICAgdG90YWxGb3VuZDogbWF0Y2hlZEFzc2V0cy5sZW5ndGgsIG1heFJlc3VsdHMsIGFzc2V0czogbWF0Y2hlZEFzc2V0c1xuICAgICAgICAgICAgfSwgYEZvdW5kICR7bWF0Y2hlZEFzc2V0cy5sZW5ndGh9IGFzc2V0cyBtYXRjaGluZyAnJHtuYW1lfSdgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBBc3NldCBzZWFyY2ggZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0RGV0YWlscyhhc3NldFBhdGg/OiBzdHJpbmcsIGluY2x1ZGVTdWJBc3NldHM6IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXNzZXRQYXRoIHx8IHR5cGVvZiBhc3NldFBhdGggIT09ICdzdHJpbmcnIHx8IGFzc2V0UGF0aC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2dldF9kZXRhaWxzIHJlcXVpcmVzIG9uZSBvZjogdXJsLCB1cmxPclVVSUQsIGFzc2V0UGF0aCcpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm9SZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0SW5mbyhhc3NldFBhdGgpO1xuICAgICAgICAgICAgaWYgKCFhc3NldEluZm9SZXN1bHQuc3VjY2VzcykgcmV0dXJuIGFzc2V0SW5mb1Jlc3VsdDtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGFzc2V0SW5mb1Jlc3VsdC5kYXRhO1xuICAgICAgICAgICAgY29uc3QgZGV0YWlsZWRJbmZvOiBhbnkgPSB7IC4uLmFzc2V0SW5mbywgc3ViQXNzZXRzOiBbXSB9O1xuICAgICAgICAgICAgaWYgKGluY2x1ZGVTdWJBc3NldHMgJiYgYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0SW5mby50eXBlID09PSAnY2MuSW1hZ2VBc3NldCcgfHwgYXNzZXRQYXRoLm1hdGNoKC9cXC4ocG5nfGpwZ3xqcGVnfGdpZnx0Z2F8Ym1wfHBzZCkkL2kpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGJhc2VVdWlkID0gYXNzZXRJbmZvLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvc3NpYmxlU3ViQXNzZXRzID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3ByaXRlRnJhbWUnLCB1dWlkOiBgJHtiYXNlVXVpZH1AZjk5NDFgLCBzdWZmaXg6ICdAZjk5NDEnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICd0ZXh0dXJlJywgdXVpZDogYCR7YmFzZVV1aWR9QDZjNDhhYCwgc3VmZml4OiAnQDZjNDhhJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAndGV4dHVyZTJEJywgdXVpZDogYCR7YmFzZVV1aWR9QDZjNDhhYCwgc3VmZml4OiAnQDZjNDhhJyB9XG4gICAgICAgICAgICAgICAgICAgIF07XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViQXNzZXQgb2YgcG9zc2libGVTdWJBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3ViQXNzZXRVcmwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11cmwnLCBzdWJBc3NldC51dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3ViQXNzZXRVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGV0YWlsZWRJbmZvLnN1YkFzc2V0cy5wdXNoKHsgdHlwZTogc3ViQXNzZXQudHlwZSwgdXVpZDogc3ViQXNzZXQudXVpZCwgdXJsOiBzdWJBc3NldFVybCwgc3VmZml4OiBzdWJBc3NldC5zdWZmaXggfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7IC8qIHN1Yi1hc3NldCBkb2Vzbid0IGV4aXN0LCBza2lwICovIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgYXNzZXRQYXRoLCBpbmNsdWRlU3ViQXNzZXRzLCAuLi5kZXRhaWxlZEluZm8gfSwgYEFzc2V0IGRldGFpbHMgcmV0cmlldmVkLiBGb3VuZCAke2RldGFpbGVkSW5mby5zdWJBc3NldHMubGVuZ3RofSBzdWItYXNzZXRzLmApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgYXNzZXQgZGV0YWlsczogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8g4pSA4pSAIEZyb20gQXNzZXRBZHZhbmNlZFRvb2xzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgLyoqXG4gICAgICogVGhlIG9sZCBpbXBsZW1lbnRhdGlvbiBmb3J3YXJkZWQgdGhlIGNhbGxlcidzIHJhdyBzdHJpbmcgc3RyYWlnaHQgdG9cbiAgICAgKiBgc2F2ZS1hc3NldC1tZXRhYCB3aXRoIG5vIHBhcnNlLCBubyBtZXJnZSwgYW5kIG5vIHByZXNlbmNlIGd1YXJkIOKAlCBhXG4gICAgICogYnl0ZS1pZGVudGljYWwgYC5wbmcubWV0YWAgcm91bmQtdHJpcCBkZXBlbmRlZCBvbiB0aGUgY2FsbGVyIHJlY29uc3RydWN0aW5nIHRoZVxuICAgICAqICplbnRpcmUqIG1ldGEgZXhhY3RseSwgYW5kIGFueSBmaWVsZCBpdCBkcm9wcGVkIChvciB0aGUgYXNzZXQtZGIncyBvd24gY29tcHV0ZWRcbiAgICAgKiBmaWVsZHMgaXQgbmV2ZXIgaGFkKSBzaWxlbnRseSBkaXZlcmdlZCB0aGUgc2F2ZWQgbWV0YS4gUm91dGUgdGhyb3VnaFxuICAgICAqIGBxdWVyeS1hc3NldC1tZXRhYCAtPiBtZXJnZSAtPiBgSlNPTi5zdHJpbmdpZnlgIC0+IHNhdmUgaW5zdGVhZCwgbWF0Y2hpbmcgdGhlXG4gICAgICogcGF0dGVybiBhbHJlYWR5IHVzZWQgYnkgYG1hbmFnZV9tYXRlcmlhbGAvYG1hbmFnZV9zaGFkZXJfZWZmZWN0YCAoIzgyKS4gYGNvbnRlbnRgXG4gICAgICogaXMgbm93IGEgSlNPTiAqcGF0Y2gqIG1lcmdlZCBvbnRvIHRoZSBjdXJyZW50IG1ldGEsIG5vdCB0aGUgd2hvbGUgbWV0YSBkb2N1bWVudC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVBc3NldE1ldGEodXJsT3JVVUlEPzogc3RyaW5nLCBjb250ZW50Pzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXJsT3JVVUlEIHx8IHR5cGVvZiB1cmxPclVVSUQgIT09ICdzdHJpbmcnIHx8IHVybE9yVVVJRC50cmltKCkgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmVfbWV0YSByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkIHx8IGNvbnRlbnQgPT09IG51bGwgfHwgY29udGVudCA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnc2F2ZV9tZXRhIHJlcXVpcmVzIGNvbnRlbnQ6IGEgSlNPTiBzdHJpbmcgb2YgdGhlIG1ldGEgZmllbGRzIHRvIG1lcmdlIChlLmcuIHtcInVzZXJEYXRhXCI6ey4uLn19KScpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBwYXRjaDogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcGF0Y2ggPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBzYXZlX21ldGEgY29udGVudCBpcyBub3QgdmFsaWQgSlNPTjogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudE1ldGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCB1cmxPclVVSUQpO1xuICAgICAgICAgICAgaWYgKCFjdXJyZW50TWV0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ291bGQgbm90IHJlYWQgY3VycmVudCBtZXRhIGZvciAnJHt1cmxPclVVSUR9JyDigJQgYXNzZXQgbm90IGZvdW5kIGluIHRoZSBhc3NldCBEQi5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZE1ldGEgPSB7IC4uLmN1cnJlbnRNZXRhLCAuLi5wYXRjaCB9O1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCB1cmxPclVVSUQsIEpTT04uc3RyaW5naWZ5KG1lcmdlZE1ldGEpKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXVpZDogcmVzdWx0Py51dWlkID8/IG1lcmdlZE1ldGEudXVpZCwgdXJsOiByZXN1bHQ/LnVybCB9LCAnQXNzZXQgbWV0YSBzYXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlQXZhaWxhYmxlVXJsKHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhdmFpbGFibGVVcmw6IHN0cmluZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2dlbmVyYXRlLWF2YWlsYWJsZS11cmwnLCB1cmwpIGFzIHN0cmluZztcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFVybDogdXJsLCBhdmFpbGFibGVVcmwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYXZhaWxhYmxlVXJsID09PSB1cmwgPyAnVVJMIGlzIGF2YWlsYWJsZScgOiAnR2VuZXJhdGVkIG5ldyBhdmFpbGFibGUgVVJMJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0RGJSZWFkeSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcmVhZHknKSBhcyBib29sZWFuO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyByZWFkeSwgbWVzc2FnZTogcmVhZHkgPyAnQXNzZXQgZGF0YWJhc2UgaXMgcmVhZHknIDogJ0Fzc2V0IGRhdGFiYXNlIGlzIG5vdCByZWFkeScgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBvcGVuQXNzZXRFeHRlcm5hbCh1cmxPclVVSUQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnb3Blbi1hc3NldCcsIHVybE9yVVVJRCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnQXNzZXQgb3BlbmVkIHdpdGggZXh0ZXJuYWwgcHJvZ3JhbScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hJbXBvcnRBc3NldHMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnO1xuICAgICAgICAgICAgY29uc3QgcmVjdXJzaXZlOiBib29sZWFuID0gYXJncy5yZWN1cnNpdmUgPT09IHRydWUgfHwgYXJncy5yZWN1cnNpdmUgPT09ICd0cnVlJztcbiAgICAgICAgICAgIGlmICghdmFsaWRhdGVBc3NldFBhdGgoYXJncy50YXJnZXREaXJlY3RvcnkgfHwgJycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIHRhcmdldERpcmVjdG9yeTogbXVzdCBiZSBkYjovLyBVUkwgb3IgYXNzZXRzLyByZWxhdGl2ZSBwYXRoIHdpdGhvdXQgdHJhdmVyc2FsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoYXJncy5zb3VyY2VEaXJlY3RvcnkpKSByZXR1cm4gZXJyb3JSZXN1bHQoJ1NvdXJjZSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoYXJncy5zb3VyY2VEaXJlY3RvcnksIGFyZ3MuZmlsZUZpbHRlciB8fCBbXSwgcmVjdXJzaXZlKTtcbiAgICAgICAgICAgIGNvbnN0IGltcG9ydFJlc3VsdHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMDtcbiAgICAgICAgICAgIGxldCBlcnJvckNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gYCR7YXJncy50YXJnZXREaXJlY3Rvcnl9LyR7ZmlsZU5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0JywgZmlsZVBhdGgsIHRhcmdldFBhdGgsIHsgb3ZlcndyaXRlLCByZW5hbWU6ICFvdmVyd3JpdGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGltcG9ydFJlc3VsdHMucHVzaCh7IHNvdXJjZTogZmlsZVBhdGgsIHRhcmdldDogdGFyZ2V0UGF0aCwgc3VjY2VzczogdHJ1ZSwgdXVpZDogKHJlc3VsdCBhcyBhbnkpPy51dWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQrKztcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBpbXBvcnRSZXN1bHRzLnB1c2goeyBzb3VyY2U6IGZpbGVQYXRoLCBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICBlcnJvckNvdW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0b3RhbEZpbGVzOiBmaWxlcy5sZW5ndGgsIHN1Y2Nlc3NDb3VudCwgZXJyb3JDb3VudCwgcmVzdWx0czogaW1wb3J0UmVzdWx0cyB9LFxuICAgICAgICAgICAgICAgIGBCYXRjaCBpbXBvcnQgY29tcGxldGVkOiAke3N1Y2Nlc3NDb3VudH0gc3VjY2VzcywgJHtlcnJvckNvdW50fSBlcnJvcnNgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGdldEZpbGVzRnJvbURpcmVjdG9yeShkaXJQYXRoOiBzdHJpbmcsIGZpbGVGaWx0ZXI6IHN0cmluZ1tdLCByZWN1cnNpdmU6IGJvb2xlYW4pOiBzdHJpbmdbXSB7XG4gICAgICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBpdGVtcyA9IGZzLnJlYWRkaXJTeW5jKGRpclBhdGgpO1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpclBhdGgsIGl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGVGaWx0ZXIubGVuZ3RoID09PSAwIHx8IGZpbGVGaWx0ZXIuc29tZShleHQgPT4gaXRlbS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKGV4dC50b0xvd2VyQ2FzZSgpKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMucHVzaChmdWxsUGF0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkgJiYgcmVjdXJzaXZlKSB7XG4gICAgICAgICAgICAgICAgZmlsZXMucHVzaCguLi50aGlzLmdldEZpbGVzRnJvbURpcmVjdG9yeShmdWxsUGF0aCwgZmlsZUZpbHRlciwgcmVjdXJzaXZlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbGVzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hEZWxldGVBc3NldHModXJsczogc3RyaW5nW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRlbGV0ZVJlc3VsdHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMDtcbiAgICAgICAgICAgIGxldCBlcnJvckNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdXJsIG9mIHVybHMpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGVSZXN1bHRzLnB1c2goeyB1cmwsIHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudCsrO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZVJlc3VsdHMucHVzaCh7IHVybCwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JDb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdG90YWxBc3NldHM6IHVybHMubGVuZ3RoLCBzdWNjZXNzQ291bnQsIGVycm9yQ291bnQsIHJlc3VsdHM6IGRlbGV0ZVJlc3VsdHMgfSxcbiAgICAgICAgICAgICAgICBgQmF0Y2ggZGVsZXRlIGNvbXBsZXRlZDogJHtzdWNjZXNzQ291bnR9IHN1Y2Nlc3MsICR7ZXJyb3JDb3VudH0gZXJyb3JzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUFzc2V0UmVmZXJlbmNlcyhkaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm46IGAke2RpcmVjdG9yeX0vKiovKmAgfSk7XG4gICAgICAgICAgICBjb25zdCBicm9rZW5SZWZlcmVuY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgdmFsaWRSZWZlcmVuY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXQudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0SW5mbykgdmFsaWRSZWZlcmVuY2VzLnB1c2goeyB1cmw6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCwgbmFtZTogYXNzZXQubmFtZSB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJva2VuUmVmZXJlbmNlcy5wdXNoKHsgdXJsOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsIG5hbWU6IGFzc2V0Lm5hbWUsIGVycm9yOiAoZXJyIGFzIEVycm9yKS5tZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBkaXJlY3RvcnksIHRvdGFsQXNzZXRzOiBhc3NldHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHZhbGlkUmVmZXJlbmNlczogdmFsaWRSZWZlcmVuY2VzLmxlbmd0aCwgYnJva2VuUmVmZXJlbmNlczogYnJva2VuUmVmZXJlbmNlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYnJva2VuQXNzZXRzOiBicm9rZW5SZWZlcmVuY2VzXG4gICAgICAgICAgICB9LCBgVmFsaWRhdGlvbiBjb21wbGV0ZWQ6ICR7YnJva2VuUmVmZXJlbmNlcy5sZW5ndGh9IGJyb2tlbiByZWZlcmVuY2VzIGZvdW5kYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERlcGVuZGVuY2llcyhfdXJsT3JVVUlEOiBzdHJpbmcsIF9kaXJlY3Rpb246IHN0cmluZyA9ICdkZXBlbmRlbmNpZXMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgZGVwZW5kZW5jeSBhbmFseXNpcyByZXF1aXJlcyBhZGRpdGlvbmFsIEFQSXMgbm90IGF2YWlsYWJsZSBpbiBjdXJyZW50IENvY29zIENyZWF0b3IgTUNQIGltcGxlbWVudGF0aW9uLiBDb25zaWRlciB1c2luZyB0aGUgRWRpdG9yIFVJIGZvciBkZXBlbmRlbmN5IGFuYWx5c2lzLicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0VW51c2VkQXNzZXRzKF9kaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycsIF9leGNsdWRlRGlyZWN0b3JpZXM6IHN0cmluZ1tdID0gW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdVbnVzZWQgYXNzZXQgZGV0ZWN0aW9uIHJlcXVpcmVzIGNvbXByZWhlbnNpdmUgcHJvamVjdCBhbmFseXNpcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb24uIENvbnNpZGVyIHVzaW5nIHRoZSBFZGl0b3IgVUkgb3IgdGhpcmQtcGFydHkgdG9vbHMgZm9yIHVudXNlZCBhc3NldCBkZXRlY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjb21wcmVzc1RleHR1cmVzKF9kaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycsIF9mb3JtYXQ6IHN0cmluZyA9ICdhdXRvJywgX3F1YWxpdHk6IG51bWJlciA9IDAuOCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXCJUZXh0dXJlIGNvbXByZXNzaW9uIHJlcXVpcmVzIGltYWdlIHByb2Nlc3NpbmcgY2FwYWJpbGl0aWVzIG5vdCBhdmFpbGFibGUgaW4gY3VycmVudCBDb2NvcyBDcmVhdG9yIE1DUCBpbXBsZW1lbnRhdGlvbi4gVXNlIHRoZSBFZGl0b3IncyBidWlsdC1pbiB0ZXh0dXJlIGNvbXByZXNzaW9uIHNldHRpbmdzIG9yIGV4dGVybmFsIHRvb2xzLlwiKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydEFzc2V0TWFuaWZlc3QoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBmb3JtYXQ6IHN0cmluZyA9ICdqc29uJywgaW5jbHVkZU1ldGFkYXRhOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzOiBhbnlbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybjogYCR7ZGlyZWN0b3J5fS8qKi8qYCB9KTtcbiAgICAgICAgICAgIGNvbnN0IG1hbmlmZXN0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYW5pZmVzdEVudHJ5OiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBhc3NldC50eXBlLCBzaXplOiAoYXNzZXQgYXMgYW55KS5zaXplIHx8IDAsIGlzRGlyZWN0b3J5OiBhc3NldC5pc0RpcmVjdG9yeSB8fCBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVNZXRhZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXQudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLm1ldGEpIG1hbmlmZXN0RW50cnkubWV0YSA9IGFzc2V0SW5mby5tZXRhO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHsgLyogc2tpcCBtZXRhZGF0YSBpZiBub3QgYXZhaWxhYmxlICovIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbWFuaWZlc3QucHVzaChtYW5pZmVzdEVudHJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBleHBvcnREYXRhOiBzdHJpbmc7XG4gICAgICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Nzdic6IGV4cG9ydERhdGEgPSB0aGlzLmNvbnZlcnRUb0NTVihtYW5pZmVzdCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3htbCc6IGV4cG9ydERhdGEgPSB0aGlzLmNvbnZlcnRUb1hNTChtYW5pZmVzdCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGV4cG9ydERhdGEgPSBKU09OLnN0cmluZ2lmeShtYW5pZmVzdCwgbnVsbCwgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGRpcmVjdG9yeSwgZm9ybWF0LCBhc3NldENvdW50OiBtYW5pZmVzdC5sZW5ndGgsIGluY2x1ZGVNZXRhZGF0YSwgbWFuaWZlc3Q6IGV4cG9ydERhdGEgfSxcbiAgICAgICAgICAgICAgICBgQXNzZXQgbWFuaWZlc3QgZXhwb3J0ZWQgd2l0aCAke21hbmlmZXN0Lmxlbmd0aH0gYXNzZXRzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjb252ZXJ0VG9DU1YoZGF0YTogYW55W10pOiBzdHJpbmcge1xuICAgICAgICBpZiAoZGF0YS5sZW5ndGggPT09IDApIHJldHVybiAnJztcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xuICAgICAgICBjb25zdCBjc3ZSb3dzID0gW2hlYWRlcnMubWFwKGggPT4gZXNjYXBlQ3N2RmllbGQoaCkpLmpvaW4oJywnKV07XG4gICAgICAgIGZvciAoY29uc3Qgcm93IG9mIGRhdGEpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlcyA9IGhlYWRlcnMubWFwKGhlYWRlciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSByb3dbaGVhZGVyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdHIgPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gSlNPTi5zdHJpbmdpZnkodmFsdWUpIDogU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXNjYXBlQ3N2RmllbGQoc3RyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY3N2Um93cy5wdXNoKHZhbHVlcy5qb2luKCcsJykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjc3ZSb3dzLmpvaW4oJ1xcbicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29udmVydFRvWE1MKGRhdGE6IGFueVtdKTogc3RyaW5nIHtcbiAgICAgICAgbGV0IHhtbCA9ICc8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cXG48YXNzZXRzPlxcbic7XG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBkYXRhKSB7XG4gICAgICAgICAgICB4bWwgKz0gJyAgPGFzc2V0Plxcbic7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpdGVtKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHhtbFZhbHVlID0gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgIFN0cmluZyh2YWx1ZSkucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xuICAgICAgICAgICAgICAgIHhtbCArPSBgICAgIDwke2tleX0+JHt4bWxWYWx1ZX08LyR7a2V5fT5cXG5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeG1sICs9ICcgIDwvYXNzZXQ+XFxuJztcbiAgICAgICAgfVxuICAgICAgICB4bWwgKz0gJzwvYXNzZXRzPic7XG4gICAgICAgIHJldHVybiB4bWw7XG4gICAgfVxufVxuIl19