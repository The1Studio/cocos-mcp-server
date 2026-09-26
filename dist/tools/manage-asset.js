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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvQ0FBd0U7QUFDeEUseURBQW9EO0FBQ3BELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7OztHQUdHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxTQUFpQjtJQUN4QyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM5RCxxREFBcUQ7SUFDckQsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQy9DLHdDQUF3QztJQUN4QyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3RHLDZDQUE2QztJQUM3QyxPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDM0MsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEtBQWE7SUFDakMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1FBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEQsb0NBQW9DO0lBQ3BDLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFBRSxLQUFLLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQztJQUNwRCxxREFBcUQ7SUFDckQsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FB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bkMsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBRU8sWUFBWSxDQUFDLElBQVc7UUFDNUIsSUFBSSxHQUFHLEdBQUcsb0RBQW9ELENBQUM7UUFDL0QsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN0QixHQUFHLElBQUksYUFBYSxDQUFDO1lBQ3JCLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQzlDLE1BQU0sUUFBUSxHQUFHLE9BQU8sS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDO29CQUN4QyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7b0JBQ3ZCLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDckYsR0FBRyxJQUFJLFFBQVEsR0FBRyxJQUFJLFFBQVEsS0FBSyxHQUFHLEtBQUssQ0FBQztZQUNoRCxDQUFDO1lBQ0QsR0FBRyxJQUFJLGNBQWMsQ0FBQztRQUMxQixDQUFDO1FBQ0QsR0FBRyxJQUFJLFdBQVcsQ0FBQztRQUNuQixPQUFPLEdBQUcsQ0FBQztJQUNmLENBQUM7Q0FDSjtBQTV4QkQsa0NBNHhCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHBhdGggaXMgc2FmZSBmb3IgYXNzZXQgb3BlcmF0aW9ucy5cbiAqIFJlamVjdHMgdHJhdmVyc2FsIHBhdHRlcm5zIGFuZCBiYXJlIGFic29sdXRlIHBhdGhzIChub24tZGI6Ly8gZm9ybSkuXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlQXNzZXRQYXRoKGFzc2V0UGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKCFhc3NldFBhdGggfHwgdHlwZW9mIGFzc2V0UGF0aCAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICAvLyBBbGxvdyBkYjovLyBwcm90b2NvbCBwYXRocyAoQ29jb3MgYXNzZXQgREIgZm9ybWF0KVxuICAgIGlmIChhc3NldFBhdGguc3RhcnRzV2l0aCgnZGI6Ly8nKSkgcmV0dXJuIHRydWU7XG4gICAgLy8gUmVqZWN0IHRyYXZlcnNhbCBwYXR0ZXJucyBpbiBhbnkgZm9ybVxuICAgIGlmIChhc3NldFBhdGguaW5jbHVkZXMoJy4uJykgfHwgYXNzZXRQYXRoLnN0YXJ0c1dpdGgoJy8nKSB8fCBhc3NldFBhdGguaW5jbHVkZXMoJ1xcXFwuLicpKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gTXVzdCBzdGFydCB3aXRoIGFzc2V0cy8gZm9yIHJlbGF0aXZlIHBhdGhzXG4gICAgcmV0dXJuIGFzc2V0UGF0aC5zdGFydHNXaXRoKCdhc3NldHMvJyk7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZUNzdkZpZWxkKGZpZWxkOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICh0eXBlb2YgZmllbGQgIT09ICdzdHJpbmcnKSByZXR1cm4gU3RyaW5nKGZpZWxkKTtcbiAgICAvLyBFc2NhcGUgZm9ybXVsYSBpbmplY3Rpb24gcHJlZml4ZXNcbiAgICBpZiAoL15bPStcXC1AXFx0XFxyXS8udGVzdChmaWVsZCkpIGZpZWxkID0gXCInXCIgKyBmaWVsZDtcbiAgICAvLyBXcmFwIGluIHF1b3RlcyBpZiBjb250YWlucyBjb21tYSwgcXVvdGUgb3IgbmV3bGluZVxuICAgIGlmIChmaWVsZC5pbmNsdWRlcygnLCcpIHx8IGZpZWxkLmluY2x1ZGVzKCdcIicpIHx8IGZpZWxkLmluY2x1ZGVzKCdcXG4nKSkge1xuICAgICAgICByZXR1cm4gJ1wiJyArIGZpZWxkLnJlcGxhY2UoL1wiL2csICdcIlwiJykgKyAnXCInO1xuICAgIH1cbiAgICByZXR1cm4gZmllbGQ7XG59XG5cbi8qKlxuICogSW1wb3J0ZXIgbmFtZXMgZm9yIGFzc2V0IGtpbmRzIHdob3NlIHNlcmlhbGl6ZWQgZmlsZSBpcyBub3QgdGV4dCDigJQgd3JpdGluZyBhblxuICogYXJiaXRyYXJ5IHN0cmluZyBvdmVyIG9uZSBvZiB0aGVzZSAodmlhIGBzYXZlYCkgd291bGQgY29ycnVwdCBpdCByYXRoZXIgdGhhbiB1cGRhdGVcbiAqIGl0LiBLZXB0IGFsb25nc2lkZSB0aGUgZXh0ZW5zaW9uIGNoZWNrIGJlbG93IHNpbmNlIG5vdCBldmVyeSBhc3NldCBsb29rdXAgcmV0dXJucyBhblxuICogYGltcG9ydGVyYCAoIzk5IGl0ZW0gMSkuXG4gKi9cbmNvbnN0IEJJTkFSWV9JTVBPUlRFUl9OQU1FUyA9IG5ldyBTZXQoW1xuICAgICdpbWFnZScsICd0ZXh0dXJlJywgJ3RleHR1cmUtY3ViZScsICdlcnAtdGV4dHVyZS1jdWJlJywgJ3Nwcml0ZS1mcmFtZScsXG4gICAgJ2F1ZGlvLWNsaXAnLCAndmlkZW8tY2xpcCcsICd0dGYtZm9udCcsICdiaXRtYXAtZm9udCcsXG4gICAgJ2RyYWdvbmJvbmVzJywgJ2RyYWdvbmJvbmVzLWF0bGFzJywgJ3NwaW5lLWRhdGEnLFxuICAgICdnbHRmJywgJ2dsdGYtbWVzaCcsICdnbHRmLW1hdGVyaWFsJywgJ2dsdGYtZW1iZWRlZC1pbWFnZScsICdnbHRmLXNjZW5lJywgJ2ZieCcsICdidWZmZXInXG5dKTtcblxuY29uc3QgQklOQVJZX0VYVEVOU0lPTlMgPSBuZXcgU2V0KFtcbiAgICAnLnBuZycsICcuanBnJywgJy5qcGVnJywgJy5naWYnLCAnLmJtcCcsICcudGdhJywgJy5wc2QnLCAnLndlYnAnLFxuICAgICcubXAzJywgJy5vZ2cnLCAnLndhdicsICcubTRhJywgJy50dGYnLCAnLm90ZicsICcuZm50JyxcbiAgICAnLmZieCcsICcub2JqJywgJy5kYWUnLCAnLmdsYicsICcuZ2x0ZicsICcubXA0JywgJy53ZWJtJ1xuXSk7XG5cbi8qKiBUcnVlIHdoZW4gYGFzc2V0SW5mb2AvYHVybE9yUGF0aGAgbmFtZXMgYSBiaW5hcnkgYXNzZXQga2luZCB0aGF0IGBzYXZlYCBtdXN0IHJlZnVzZS4gKi9cbmZ1bmN0aW9uIGlzQmluYXJ5QXNzZXQoYXNzZXRJbmZvOiBhbnksIHVybE9yUGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKGFzc2V0SW5mbyAmJiB0eXBlb2YgYXNzZXRJbmZvLmltcG9ydGVyID09PSAnc3RyaW5nJyAmJiBCSU5BUllfSU1QT1JURVJfTkFNRVMuaGFzKGFzc2V0SW5mby5pbXBvcnRlcikpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGNvbnN0IGV4dCA9IHBhdGguZXh0bmFtZSh1cmxPclBhdGggfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgcmV0dXJuIEJJTkFSWV9FWFRFTlNJT05TLmhhcyhleHQpO1xufVxuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBhc3NldCBtYW5hZ2VtZW50IHRvb2wuXG4gKiBDb21iaW5lcyBQcm9qZWN0VG9vbHMgKGFzc2V0IG1ldGhvZHMpICsgQXNzZXRBZHZhbmNlZFRvb2xzIGludG8gb25lIGFjdGlvbi1iYXNlZCB0b29sLlxuICovXG5leHBvcnQgY2xhc3MgTWFuYWdlQXNzZXQgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfYXNzZXQnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBhc3NldHMgaW4gdGhlIHByb2plY3QgKGZpbGVzLCB0ZXh0dXJlcywgc2NyaXB0cywgZXRjKS4gQWN0aW9uczogaW1wb3J0LCBnZXRfaW5mbywgbGlzdCwgcmVmcmVzaCwgY3JlYXRlLCBjb3B5LCBtb3ZlLCBkZWxldGUsIHNhdmUsIHJlaW1wb3J0LCBxdWVyeV9wYXRoLCBxdWVyeV91dWlkLCBxdWVyeV91cmwsIGZpbmRfYnlfbmFtZSwgZ2V0X2RldGFpbHMsIHNhdmVfbWV0YSwgZ2VuZXJhdGVfdXJsLCBxdWVyeV9kYl9yZWFkeSwgb3Blbl9leHRlcm5hbCwgYmF0Y2hfaW1wb3J0LCBiYXRjaF9kZWxldGUsIHZhbGlkYXRlX3JlZmVyZW5jZXMsIGdldF9kZXBlbmRlbmNpZXMsIGV4cG9ydF9tYW5pZmVzdC4gTk9UIGZvciBzY2VuZSBub2RlcyDigJQgdXNlIG1hbmFnZV9ub2RlLiBVc2UgcXVlcnlfZGJfcmVhZHkgdG8gY2hlY2sgYXNzZXQgREIgYmVmb3JlIGJhdGNoIG9wcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdpbXBvcnQnLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZWZyZXNoJywgJ2NyZWF0ZScsICdjb3B5JywgJ21vdmUnLCAnZGVsZXRlJyxcbiAgICAgICAgJ3NhdmUnLCAncmVpbXBvcnQnLCAncXVlcnlfcGF0aCcsICdxdWVyeV91dWlkJywgJ3F1ZXJ5X3VybCcsICdmaW5kX2J5X25hbWUnLFxuICAgICAgICAnZ2V0X2RldGFpbHMnLCAnc2F2ZV9tZXRhJywgJ2dlbmVyYXRlX3VybCcsICdxdWVyeV9kYl9yZWFkeScsICdvcGVuX2V4dGVybmFsJyxcbiAgICAgICAgJ2JhdGNoX2ltcG9ydCcsICdiYXRjaF9kZWxldGUnLCAndmFsaWRhdGVfcmVmZXJlbmNlcycsICdnZXRfZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgJ2V4cG9ydF9tYW5pZmVzdCdcbiAgICBdO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJyxcbiAgICAgICAgICAgICAgICBlbnVtOiB0aGlzLmFjdGlvbnNcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzb3VyY2VQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBmaWxlIHBhdGggb24gZGlzayAoZm9yIGltcG9ydCknIH0sXG4gICAgICAgICAgICB0YXJnZXRGb2xkZXI6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGZvbGRlciBVUkwgKGZvciBpbXBvcnQpJyB9LFxuICAgICAgICAgICAgYXNzZXRQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IHBhdGggKGRiOi8vYXNzZXRzLy4uLiknIH0sXG4gICAgICAgICAgICB1cmxPclVVSUQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgVVJMIG9yIFVVSUQnIH0sXG4gICAgICAgICAgICB1cmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgVVJMIChkYjovL2Fzc2V0cy8uLi4pJyB9LFxuICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVVUlEJyB9LFxuICAgICAgICAgICAgY29udGVudDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdGaWxlIGNvbnRlbnQgb3IgbWV0YSBjb250ZW50JyB9LFxuICAgICAgICAgICAgb3ZlcndyaXRlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdPdmVyd3JpdGUgZXhpc3RpbmcgZmlsZScsIGRlZmF1bHQ6IGZhbHNlIH0sXG4gICAgICAgICAgICBzb3VyY2U6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnU291cmNlIGFzc2V0IFVSTCAoZm9yIGNvcHkvbW92ZSknIH0sXG4gICAgICAgICAgICB0YXJnZXQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGFzc2V0IFVSTCAoZm9yIGNvcHkvbW92ZSknIH0sXG4gICAgICAgICAgICBmb2xkZXI6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRm9sZGVyIHRvIHNlYXJjaC9saXN0JywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJyB9LFxuICAgICAgICAgICAgdHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXNzZXQgdHlwZSBmaWx0ZXInLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWxsJywgJ3NjZW5lJywgJ3ByZWZhYicsICdzY3JpcHQnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdtZXNoJywgJ2F1ZGlvJywgJ2FuaW1hdGlvbiddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmFtZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBuYW1lIHRvIHNlYXJjaCBmb3InIH0sXG4gICAgICAgICAgICBleGFjdE1hdGNoOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdFeGFjdCBuYW1lIG1hdGNoJywgZGVmYXVsdDogZmFsc2UgfSxcbiAgICAgICAgICAgIGFzc2V0VHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRmlsdGVyIGJ5IGFzc2V0IHR5cGUnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWxsJywgJ3NjZW5lJywgJ3ByZWZhYicsICdzY3JpcHQnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdtZXNoJywgJ2F1ZGlvJywgJ2FuaW1hdGlvbicsICdzcHJpdGVGcmFtZSddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWF4UmVzdWx0czogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdNYXggcmVzdWx0cyBmb3IgZmluZF9ieV9uYW1lJywgZGVmYXVsdDogMjAsIG1pbmltdW06IDEsIG1heGltdW06IDEwMCB9LFxuICAgICAgICAgICAgaW5jbHVkZVN1YkFzc2V0czogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBzdWItYXNzZXRzIChzcHJpdGVGcmFtZSwgdGV4dHVyZSknLCBkZWZhdWx0OiB0cnVlIH0sXG4gICAgICAgICAgICBzb3VyY2VEaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnU291cmNlIGRpcmVjdG9yeSBmb3IgYmF0Y2hfaW1wb3J0JyB9LFxuICAgICAgICAgICAgdGFyZ2V0RGlyZWN0b3J5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBkaXJlY3RvcnkgVVJMIGZvciBiYXRjaF9pbXBvcnQnIH0sXG4gICAgICAgICAgICBmaWxlRmlsdGVyOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnRmlsZSBleHRlbnNpb25zIGZpbHRlcicsIGRlZmF1bHQ6IFtdIH0sXG4gICAgICAgICAgICByZWN1cnNpdmU6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0luY2x1ZGUgc3ViZGlyZWN0b3JpZXMnLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgdXJsczogeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCBkZXNjcmlwdGlvbjogJ0FycmF5IG9mIGFzc2V0IFVSTHMgZm9yIGJhdGNoX2RlbGV0ZScgfSxcbiAgICAgICAgICAgIGRpcmVjdG9yeTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdEaXJlY3RvcnkgdG8gc2NhbicsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cycgfSxcbiAgICAgICAgICAgIGV4Y2x1ZGVEaXJlY3RvcmllczogeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCBkZXNjcmlwdGlvbjogJ0RpcmVjdG9yaWVzIHRvIGV4Y2x1ZGUnLCBkZWZhdWx0OiBbXSB9LFxuICAgICAgICAgICAgZGlyZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdEZXBlbmRlbmN5IGRpcmVjdGlvbiBmb3IgZ2V0X2RlcGVuZGVuY2llcycsXG4gICAgICAgICAgICAgICAgZW51bTogWydkZXBlbmRlbnRzJywgJ2RlcGVuZGVuY2llcycsICdib3RoJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2RlcGVuZGVuY2llcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmb3JtYXQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Zvcm1hdCBmb3IgZXhwb3J0X21hbmlmZXN0JyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2F1dG8nLCAnanBnJywgJ3BuZycsICd3ZWJwJywgJ2pzb24nLCAnY3N2JywgJ3htbCddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhdXRvJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluY2x1ZGVNZXRhZGF0YTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBhc3NldCBtZXRhZGF0YSBpbiBtYW5pZmVzdCcsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgICAgIGlzRm9sZGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gRXhwbGljaXRseSBjcmVhdGUgYSBmb2xkZXIsIHJlZ2FyZGxlc3Mgb2YgYGNvbnRlbnRgLiBVc2UgdGhpcyBpbnN0ZWFkIG9mIG9taXR0aW5nIGBjb250ZW50YCDigJQgbWFueSBNQ1AgdHJhbnNwb3J0cyBjb2VyY2UgYW4gb21pdHRlZCBvcHRpb25hbCBzdHJpbmcgdG8gYFwiXCJgLCB3aGljaCBvdGhlcndpc2UgbWFrZXMgZm9sZGVyIGNyZWF0aW9uIHVucmVhY2hhYmxlLicsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogYG1hbmFnZV9hc3NldGAgYWN0aW9ucyBoaXN0b3JpY2FsbHkgcmVhZCBhIGRpZmZlcmVudCBhbGlhcyBmb3IgdGhlIHNhbWUgXCJhc3NldFxuICAgICAqIHJlZmVyZW5jZVwiIGNvbmNlcHQg4oCUIHNvbWUgYHVybGAsIHNvbWUgYGFzc2V0UGF0aGAsIHNvbWUgYHVybE9yVVVJRGAg4oCUIHdpdGggbm9cbiAgICAgKiBzY2hlbWEgc2lnbmFsIGFib3V0IHdoaWNoIG5hbWUgYSBnaXZlbiBhY3Rpb24gZXhwZWN0ZWQuIEEgY2FsbGVyIHBhc3NpbmcgdGhlXG4gICAgICogZG9jdW1lbnRlZCBgYXNzZXRQYXRoYCB0byBgY3JlYXRlYCBzaWxlbnRseSBmb3J3YXJkZWQgYHVuZGVmaW5lZGAsIHN1cmZhY2luZyBhc1xuICAgICAqIHRoZSBlZGl0b3IncyBvd24gdW5yZWxhdGVkIGBcIm9wdGlvbnMudGFyZ2V0IGlzIHJlcXVpcmVkXCJgIGVycm9yICgjODAsICM5OSBpdGVtIDcpLlxuICAgICAqIEV2ZXJ5IGFjdGlvbiBiZWxvdyBub3cgcmVzb2x2ZXMgdGhyb3VnaCB0aGlzIHNhbWUgYWxpYXMgc2V0LlxuICAgICAqL1xuICAgIHByaXZhdGUgcmVzb2x2ZUFzc2V0QXJnKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgICAgICByZXR1cm4gYXJncy51cmwgfHwgYXJncy51cmxPclVVSUQgfHwgYXJncy5hc3NldFBhdGggfHwgdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBpbXBvcnQ6IChhcmdzKSA9PiB0aGlzLmltcG9ydEFzc2V0KGFyZ3Muc291cmNlUGF0aCwgYXJncy50YXJnZXRGb2xkZXIpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXRJbmZvKHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXRzKGFyZ3MudHlwZSwgYXJncy5mb2xkZXIpLFxuICAgICAgICAvLyBgZm9sZGVyYCBpcyB0aGUgaW50ZW5kZWQgc2NvcGUgcGFyYW07IGZhbGwgYmFjayB0byB0aGUgYXNzZXQtcmVmIGFsaWFzZXMgb25seVxuICAgICAgICAvLyB3aGVuIGl0IGlzIG9taXR0ZWQsIHNvIHBhc3NpbmcgYHVybGAgaW5zdGVhZCBvZiBgZm9sZGVyYCBjYW4gbmV2ZXIgc2lsZW50bHlcbiAgICAgICAgLy8gd2lkZW4gdGhlIHJlZnJlc2ggdG8gdGhlIHdob2xlIHByb2plY3QgKGBkYjovL2Fzc2V0c2ApIOKAlCBzZWUgcmVmcmVzaEFzc2V0cygpLlxuICAgICAgICByZWZyZXNoOiAoYXJncykgPT4gdGhpcy5yZWZyZXNoQXNzZXRzKGFyZ3MuZm9sZGVyIHx8IHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVBc3NldChcbiAgICAgICAgICAgIHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpLFxuICAgICAgICAgICAgYXJncy5jb250ZW50ID8/IG51bGwsXG4gICAgICAgICAgICBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnLFxuICAgICAgICAgICAgYXJncy5pc0ZvbGRlciA9PT0gdHJ1ZSB8fCBhcmdzLmlzRm9sZGVyID09PSAndHJ1ZSdcbiAgICAgICAgKSxcbiAgICAgICAgY29weTogKGFyZ3MpID0+IHRoaXMuY29weUFzc2V0KGFyZ3Muc291cmNlLCBhcmdzLnRhcmdldCwgYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJyksXG4gICAgICAgIG1vdmU6IChhcmdzKSA9PiB0aGlzLm1vdmVBc3NldChhcmdzLnNvdXJjZSwgYXJncy50YXJnZXQsIGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZScpLFxuICAgICAgICBkZWxldGU6IChhcmdzKSA9PiB0aGlzLmRlbGV0ZUFzc2V0KHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpKSxcbiAgICAgICAgc2F2ZTogKGFyZ3MpID0+IHRoaXMuc2F2ZUFzc2V0KHRoaXMucmVzb2x2ZUFzc2V0QXJnKGFyZ3MpLCBhcmdzLmNvbnRlbnQpLFxuICAgICAgICByZWltcG9ydDogKGFyZ3MpID0+IHRoaXMucmVpbXBvcnRBc3NldCh0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSksXG4gICAgICAgIHF1ZXJ5X3BhdGg6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRQYXRoKGFyZ3MudXJsIHx8IGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgcXVlcnlfdXVpZDogKGFyZ3MpID0+IHRoaXMucXVlcnlBc3NldFV1aWQoYXJncy51cmwpLFxuICAgICAgICBxdWVyeV91cmw6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRVcmwoYXJncy51dWlkKSxcbiAgICAgICAgZmluZF9ieV9uYW1lOiAoYXJncykgPT4gdGhpcy5maW5kQXNzZXRCeU5hbWUoYXJncyksXG4gICAgICAgIGdldF9kZXRhaWxzOiAoYXJncykgPT4gdGhpcy5nZXRBc3NldERldGFpbHModGhpcy5yZXNvbHZlQXNzZXRBcmcoYXJncyksIGFyZ3MuaW5jbHVkZVN1YkFzc2V0cyAhPT0gZmFsc2UpLFxuICAgICAgICBzYXZlX21ldGE6IChhcmdzKSA9PiB0aGlzLnNhdmVBc3NldE1ldGEodGhpcy5yZXNvbHZlQXNzZXRBcmcoYXJncyksIGFyZ3MuY29udGVudCksXG4gICAgICAgIGdlbmVyYXRlX3VybDogKGFyZ3MpID0+IHRoaXMuZ2VuZXJhdGVBdmFpbGFibGVVcmwoYXJncy51cmwpLFxuICAgICAgICBxdWVyeV9kYl9yZWFkeTogKF9hcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXREYlJlYWR5KCksXG4gICAgICAgIG9wZW5fZXh0ZXJuYWw6IChhcmdzKSA9PiB0aGlzLm9wZW5Bc3NldEV4dGVybmFsKGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgYmF0Y2hfaW1wb3J0OiAoYXJncykgPT4gdGhpcy5iYXRjaEltcG9ydEFzc2V0cyhhcmdzKSxcbiAgICAgICAgYmF0Y2hfZGVsZXRlOiAoYXJncykgPT4gdGhpcy5iYXRjaERlbGV0ZUFzc2V0cyhhcmdzLnVybHMpLFxuICAgICAgICB2YWxpZGF0ZV9yZWZlcmVuY2VzOiAoYXJncykgPT4gdGhpcy52YWxpZGF0ZUFzc2V0UmVmZXJlbmNlcyhhcmdzLmRpcmVjdG9yeSksXG4gICAgICAgIC8vIFJvdXRlcyB0aHJvdWdoIGByZXNvbHZlQXNzZXRBcmdgIGxpa2UgZXZlcnkgb3RoZXIgYXNzZXQtcmVmIGFjdGlvbi4gSXQgdXNlZCB0b1xuICAgICAgICAvLyByZWFkIGBhcmdzLnVybE9yVVVJRGAgYWxvbmUsIHNvIGEgY2FsbGVyIHVzaW5nIHRoZSBzY2hlbWEtZG9jdW1lbnRlZCBgdXJsYCBvclxuICAgICAgICAvLyBgYXNzZXRQYXRoYCBzcGVsbGluZyByZWFjaGVkIHRoZSBoYW5kbGVyIHdpdGggYHVuZGVmaW5lZGAgKCMxMjQpLlxuICAgICAgICBnZXRfZGVwZW5kZW5jaWVzOiAoYXJncykgPT4gdGhpcy5nZXRBc3NldERlcGVuZGVuY2llcyh0aGlzLnJlc29sdmVBc3NldEFyZyhhcmdzKSwgYXJncy5kaXJlY3Rpb24pLFxuICAgICAgICBleHBvcnRfbWFuaWZlc3Q6IChhcmdzKSA9PiB0aGlzLmV4cG9ydEFzc2V0TWFuaWZlc3QoYXJncy5kaXJlY3RvcnksIGFyZ3MuZm9ybWF0LCBhcmdzLmluY2x1ZGVNZXRhZGF0YSAhPT0gZmFsc2UpXG4gICAgfTtcblxuICAgIC8vIOKUgOKUgCBGcm9tIFByb2plY3RUb29scyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIHByaXZhdGUgYXN5bmMgaW1wb3J0QXNzZXQoc291cmNlUGF0aDogc3RyaW5nLCB0YXJnZXRGb2xkZXI6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc291cmNlUGF0aCkpIHJldHVybiBlcnJvclJlc3VsdCgnU291cmNlIGZpbGUgbm90IGZvdW5kJyk7XG4gICAgICAgIGlmICghdmFsaWRhdGVBc3NldFBhdGgodGFyZ2V0Rm9sZGVyKSkgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIHRhcmdldCBmb2xkZXIgcGF0aDogbXVzdCBiZSBkYjovLyBVUkwgb3IgYXNzZXRzLyByZWxhdGl2ZSBwYXRoIHdpdGhvdXQgdHJhdmVyc2FsJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoc291cmNlUGF0aCk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gdGFyZ2V0Rm9sZGVyLnN0YXJ0c1dpdGgoJ2RiOi8vJykgPyB0YXJnZXRGb2xkZXIgOiBgZGI6Ly9hc3NldHMvJHt0YXJnZXRGb2xkZXJ9YDtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0Jywgc291cmNlUGF0aCwgYCR7dGFyZ2V0UGF0aH0vJHtmaWxlTmFtZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXVpZDogcmVzdWx0LnV1aWQsIHBhdGg6IHJlc3VsdC51cmwsIG1lc3NhZ2U6IGBBc3NldCBpbXBvcnRlZDogJHtmaWxlTmFtZX1gIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXRJbmZvKGFzc2V0UGF0aD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFzc2V0UGF0aCB8fCB0eXBlb2YgYXNzZXRQYXRoICE9PSAnc3RyaW5nJyB8fCBhc3NldFBhdGgudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdnZXRfaW5mbyByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IG5vdCBmb3VuZCcpO1xuICAgICAgICAgICAgY29uc3QgaW5mbzogYW55ID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgICAgIHV1aWQ6IGFzc2V0SW5mby51dWlkLFxuICAgICAgICAgICAgICAgIHBhdGg6IGFzc2V0SW5mby51cmwsXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXRJbmZvLnR5cGUsXG4gICAgICAgICAgICAgICAgc2l6ZTogYXNzZXRJbmZvLnNpemUsXG4gICAgICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IGFzc2V0SW5mby5pc0RpcmVjdG9yeVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8ubWV0YSkge1xuICAgICAgICAgICAgICAgIGluZm8ubWV0YSA9IHsgdmVyOiBhc3NldEluZm8ubWV0YS52ZXIsIGltcG9ydGVyOiBhc3NldEluZm8ubWV0YS5pbXBvcnRlciB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldHModHlwZTogc3RyaW5nID0gJ2FsbCcsIGZvbGRlcjogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHBhdHRlcm4gPSBgJHtmb2xkZXJ9LyoqLypgO1xuICAgICAgICAgICAgaWYgKHR5cGUgIT09ICdhbGwnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZUV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICAgICAgICAgICdzY2VuZSc6ICcuc2NlbmUnLCAncHJlZmFiJzogJy5wcmVmYWInLCAnc2NyaXB0JzogJy57dHMsanN9JyxcbiAgICAgICAgICAgICAgICAgICAgJ3RleHR1cmUnOiAnLntwbmcsanBnLGpwZWcsZ2lmLHRnYSxibXAscHNkfScsICdtYXRlcmlhbCc6ICcubXRsJyxcbiAgICAgICAgICAgICAgICAgICAgJ21lc2gnOiAnLntmYngsb2JqLGRhZX0nLCAnYXVkaW8nOiAnLnttcDMsb2dnLHdhdixtNGF9JywgJ2FuaW1hdGlvbic6ICcue2FuaW0sY2xpcH0nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSB0eXBlRXh0ZW5zaW9uc1t0eXBlXTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSBwYXR0ZXJuID0gYCR7Zm9sZGVyfS8qKi8qJHtleHRlbnNpb259YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gcmVzdWx0cy5tYXAoYXNzZXQgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLCB1dWlkOiBhc3NldC51dWlkLCBwYXRoOiBhc3NldC51cmwsXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSwgc2l6ZTogYXNzZXQuc2l6ZSB8fCAwLCBpc0RpcmVjdG9yeTogYXNzZXQuaXNEaXJlY3RvcnkgfHwgZmFsc2VcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdHlwZSwgZm9sZGVyLCBjb3VudDogYXNzZXRzLmxlbmd0aCwgYXNzZXRzIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBmb2xkZXJgIGlzIHRoZSBpbnRlbmRlZCBzY29wZSBmb3IgdGhpcyBhY3Rpb247IHRoZSBkaXNwYXRjaCB0YWJsZSBub3cgZmFsbHNcbiAgICAgKiBiYWNrIHRvIHRoZSBhc3NldC1yZWYgYWxpYXNlcyAoYHVybGAvYHVybE9yVVVJRGAvYGFzc2V0UGF0aGApIG9ubHkgd2hlbiBgZm9sZGVyYFxuICAgICAqIGl0c2VsZiBpcyBvbWl0dGVkLCBzbyBhIGNhbGxlciB3aG8gcGFzc2VzIGB1cmxgIHN0aWxsIHJlZnJlc2hlcyBqdXN0IHRoYXQgcGF0aFxuICAgICAqIGluc3RlYWQgb2Ygc2lsZW50bHkgd2lkZW5pbmcgdGhlIHJlZnJlc2ggdG8gdGhlIHdob2xlIHByb2plY3QgKGBkYjovL2Fzc2V0c2ApLFxuICAgICAqIHdoaWNoIGlzIHdoYXQgaGFwcGVuZWQgd2hlbiBhIG5vbi1gZm9sZGVyYCBhcmd1bWVudCByZWFjaGVkIGhlcmUgYXMgYHVuZGVmaW5lZGAuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZWZyZXNoQXNzZXRzKGZvbGRlcj86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGRlciB8fCAnZGI6Ly9hc3NldHMnO1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVmcmVzaC1hc3NldCcsIHRhcmdldFBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgYEFzc2V0cyByZWZyZXNoZWQgaW46ICR7dGFyZ2V0UGF0aH1gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgY29udGVudCA9PT0gbnVsbGAgKGkuZS4gb21pdHRlZCkgaGFzIGFsd2F5cyBtZWFudCBcImNyZWF0ZSBhIGZvbGRlclwiLiBUaGF0XG4gICAgICogaW5mZXJlbmNlIGJyZWFrcyB3aGVuZXZlciB0aGUgY2FsbGluZyBNQ1AgdHJhbnNwb3J0IGNvZXJjZXMgYW4gb21pdHRlZCBvcHRpb25hbFxuICAgICAqIHN0cmluZyB0byBgXCJcImAgYmVmb3JlIGl0IHJlYWNoZXMgaGVyZSDigJQgYGNvbnRlbnQgPz8gbnVsbGAgbmV2ZXIgc3Vic3RpdHV0ZXMgb24gYW5cbiAgICAgKiBlbXB0eSBzdHJpbmcsIHNvIGl0IGlzIGZvcndhcmRlZCBkb3duIHRoZSBGSUxFIHBhdGggYW5kIGZvbGRlciBjcmVhdGlvbiBiZWNvbWVzXG4gICAgICogdW5yZWFjaGFibGUgdGhyb3VnaCB0aGF0IHRyYW5zcG9ydC4gYGlzRm9sZGVyYCBtYWtlcyB0aGUgaW50ZW50IGV4cGxpY2l0IGluc3RlYWRcbiAgICAgKiBvZiBpbmZlcnJpbmcgaXQgZnJvbSBgY29udGVudGAsIHdoaWxlIGBjb250ZW50ID09PSBudWxsYCBpcyBrZXB0IGFzIHRoZSBvcmlnaW5hbFxuICAgICAqIChzdGlsbC12YWxpZCkgaW1wbGljaXQgZm9ybSBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSAoIzk5IGl0ZW0gNikuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBc3NldCh1cmw/OiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsLCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBmYWxzZSwgaXNGb2xkZXI6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXVybCB8fCB0eXBlb2YgdXJsICE9PSAnc3RyaW5nJyB8fCB1cmwudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdjcmVhdGUgcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoIOKAlCBuYW1pbmcgdGhlIGFzc2V0IHRvIGNyZWF0ZScpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmb2xkZXIgPSBpc0ZvbGRlciB8fCBjb250ZW50ID09PSBudWxsO1xuICAgICAgICAgICAgY29uc3QgZWZmZWN0aXZlQ29udGVudCA9IGZvbGRlciA/IG51bGwgOiBjb250ZW50O1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHsgb3ZlcndyaXRlLCByZW5hbWU6ICFvdmVyd3JpdGUgfTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgdXJsLCBlZmZlY3RpdmVDb250ZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9IGZvbGRlciA/ICdGb2xkZXIgY3JlYXRlZCBzdWNjZXNzZnVsbHknIDogJ0ZpbGUgY3JlYXRlZCBzdWNjZXNzZnVsbHknO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsLCBtZXNzYWdlOiBtc2cgfSA6IHsgdXJsLCBtZXNzYWdlOiBtc2cgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjb3B5QXNzZXQoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjb3B5LWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIHsgb3ZlcndyaXRlLCByZW5hbWU6ICFvdmVyd3JpdGUgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQgJiYgcmVzdWx0LnV1aWRcbiAgICAgICAgICAgICAgICA/IHsgdXVpZDogcmVzdWx0LnV1aWQsIHVybDogcmVzdWx0LnVybCwgbWVzc2FnZTogJ0Fzc2V0IGNvcGllZCBzdWNjZXNzZnVsbHknIH1cbiAgICAgICAgICAgICAgICA6IHsgc291cmNlLCB0YXJnZXQsIG1lc3NhZ2U6ICdBc3NldCBjb3BpZWQgc3VjY2Vzc2Z1bGx5JyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIG1vdmVBc3NldChzb3VyY2U6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ21vdmUtYXNzZXQnLCBzb3VyY2UsIHRhcmdldCwgeyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZFxuICAgICAgICAgICAgICAgID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsLCBtZXNzYWdlOiAnQXNzZXQgbW92ZWQgc3VjY2Vzc2Z1bGx5JyB9XG4gICAgICAgICAgICAgICAgOiB7IHNvdXJjZSwgdGFyZ2V0LCBtZXNzYWdlOiAnQXNzZXQgbW92ZWQgc3VjY2Vzc2Z1bGx5JyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgZGVsZXRlLWFzc2V0YCByZXNvbHZpbmcgaXRzIHByb21pc2UgaXMgbm90IHByb29mIHRoZSBmaWxlIGlzIGdvbmUg4oCUIHRoZSBvbGQgY29kZVxuICAgICAqIHRydXN0ZWQgdGhhdCByZXNvbHV0aW9uIGFsb25lIGFuZCByZXBvcnRlZCBzdWNjZXNzIHVuY29uZGl0aW9uYWxseS4gQSByZWFkLWJhY2tcbiAgICAgKiBxdWVyeSBpbW1lZGlhdGVseSBhZnRlciBub3cgY29uZmlybXMgdGhlIGFzc2V0IGRiIG5vIGxvbmdlciBrbm93cyBhYm91dCB0aGUgdXJsXG4gICAgICogYmVmb3JlIHN1Y2Nlc3MgaXMgcmVwb3J0ZWQsIG1pcnJvcmluZyB0aGUgdmVyaWZ5LWRvbid0LXRydXN0IHBhdHRlcm4gYWxyZWFkeSB1c2VkXG4gICAgICogYnkgYG1hbmFnZV9zY2VuZWAncyBgc2F2ZWAgYWN0aW9uICgjOTkgaXRlbSA1KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGRlbGV0ZUFzc2V0KHVybD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXVybCB8fCB0eXBlb2YgdXJsICE9PSAnc3RyaW5nJyB8fCB1cmwudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdkZWxldGUgcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2RlbGV0ZS1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICBjb25zdCBzdGlsbFByZXNlbnQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB1cmwpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgICAgICAgaWYgKHN0aWxsUHJlc2VudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgYXNzZXQtZGI6ZGVsZXRlLWFzc2V0IHJlc29sdmVkLCBidXQgJyR7dXJsfScgaXMgc3RpbGwgcHJlc2VudCBpbiB0aGUgYXNzZXQgREIgaW1tZWRpYXRlbHkgYWZ0ZXJ3YXJkIOKAlCB0aGUgZGVsZXRlIGRpZCBub3QgdGFrZSBlZmZlY3QuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCB9LCAnQXNzZXQgZGVsZXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3J3YXJkaW5nIGFuIGFyYml0cmFyeSBzdHJpbmcgb3ZlciBhIGJpbmFyeSBhc3NldCAoZS5nLiB3cml0aW5nIHRleHQgY29udGVudFxuICAgICAqIG92ZXIgYSBgLnBuZ2ApIGRvZXMgbm90IHVwZGF0ZSBpdCDigJQgaXQgY29ycnVwdHMgaXQuIFF1ZXJ5IHRoZSB0YXJnZXQncyBpbXBvcnRlclxuICAgICAqIGJlZm9yZSB3cml0aW5nIGFuZCByZWZ1c2UgdGhlIHdyaXRlIGZvciBhIGtub3duLWJpbmFyeSBraW5kICgjOTkgaXRlbSAxKS5cbiAgICAgKiBMZWdpdGltYXRlIHRleHQgYXNzZXRzICgudHMsIC5qc29uLCAudHh0LCBtYXRlcmlhbHMsIHNjZW5lcywgLi4uKSBhcmUgdW5hZmZlY3RlZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVBc3NldCh1cmw/OiBzdHJpbmcsIGNvbnRlbnQ/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1cmwgfHwgdHlwZW9mIHVybCAhPT0gJ3N0cmluZycgfHwgdXJsLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnc2F2ZSByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGNvbnRlbnQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmUgcmVxdWlyZXMgY29udGVudDogYSBzdHJpbmcnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdXJsKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgdHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnICYmIGlzQmluYXJ5QXNzZXQoYXNzZXRJbmZvLCB1cmwpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBgc2F2ZSBjYW5ub3Qgd3JpdGUgc3RyaW5nIGNvbnRlbnQgb3ZlciAnJHt1cmx9JzogaXQgcmVzb2x2ZXMgdG8gYSBiaW5hcnkgYXNzZXQgYCArXG4gICAgICAgICAgICAgICAgICAgIGAoaW1wb3J0ZXI9JyR7YXNzZXRJbmZvLmltcG9ydGVyfScsIHR5cGU9JyR7YXNzZXRJbmZvLnR5cGV9JykuIFdyaXRpbmcgdGV4dCBjb250ZW50IG92ZXIgYSBgICtcbiAgICAgICAgICAgICAgICAgICAgJ2JpbmFyeSBhc3NldCB3b3VsZCBjb3JydXB0IGl0IOKAlCB1c2UgaW1wb3J0L2NvcHkgdG8gcmVwbGFjZSBiaW5hcnkgYXNzZXQgY29udGVudCBpbnN0ZWFkLidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgdXJsLCBjb250ZW50KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZCA/IHsgdXVpZDogcmVzdWx0LnV1aWQsIHVybDogcmVzdWx0LnVybCB9IDogeyB1cmwgfSwgJ0Fzc2V0IHNhdmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGByZWltcG9ydC1hc3NldGAgb24gYSBkaXJlY3RvcnkgVVJMIHByZXZpb3VzbHkgZm9yd2FyZGVkIHN0cmFpZ2h0IHRvIHRoZSBlZGl0b3JcbiAgICAgKiB3aXRoIG5vIGRpcmVjdG9yeSBjaGVjaywgbm8gY2hpbGQgZW51bWVyYXRpb24sIGFuZCB0aGUgYm9vbGVhbiByZXN1bHQgd2FzXG4gICAgICogZGlzY2FyZGVkIOKAlCBhbiB1bmNvbmRpdGlvbmFsIHN1Y2Nlc3MgcmVnYXJkbGVzcyBvZiB3aGF0IGFjdHVhbGx5IGhhcHBlbmVkLiBUaGVcbiAgICAgKiBkZWNpc2lvbiBoZXJlIGlzIFJFRlVTRSwgbm90IHJlY3Vyc2U6IGEgZm9sZGVyIGRvZXMgbm90IGhhdmUgaW1wb3J0YWJsZSBjb250ZW50XG4gICAgICogb2YgaXRzIG93biwgc28gZWFjaCBjaGlsZCBhc3NldCBtdXN0IGJlIHJlaW1wb3J0ZWQgYnkgaXRzIG93biB1cmwgKCM5NikuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZWltcG9ydEFzc2V0KHVybD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXVybCB8fCB0eXBlb2YgdXJsICE9PSAnc3RyaW5nJyB8fCB1cmwudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdyZWltcG9ydCByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgaW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgICAgICBpZiAoaW5mbyAmJiBpbmZvLmlzRGlyZWN0b3J5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBgcmVpbXBvcnQgZG9lcyBub3QgYWNjZXB0IGEgZm9sZGVyIFVSTCAoJyR7dXJsfScgaXMgYSBkaXJlY3RvcnkpIOKAlCB0aGlzIGFjdGlvbiBkb2VzIG5vdCBgICtcbiAgICAgICAgICAgICAgICAgICAgJ3JlY3Vyc2UgaW50byBmb2xkZXIgY29udGVudHMuIFJlaW1wb3J0IGVhY2ggY2hpbGQgYXNzZXQgaW5kaXZpZHVhbGx5IGJ5IGl0cyBvd24gdXJsIGluc3RlYWQuJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgYXNzZXQtZGI6cmVpbXBvcnQtYXNzZXQgcmV0dXJuZWQgZmFsc2UgZm9yICcke3VybH0nIOKAlCB0aGUgZWRpdG9yIHJlamVjdGVkIHRoZSByZWltcG9ydC5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsIH0sICdBc3NldCByZWltcG9ydGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFBhdGgodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0UGF0aDogc3RyaW5nIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCB1cmwpIGFzIHN0cmluZyB8IG51bGw7XG4gICAgICAgICAgICBpZiAoYXNzZXRQYXRoKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCwgcGF0aDogYXNzZXRQYXRoIH0sICdBc3NldCBwYXRoIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgcGF0aCBub3QgZm91bmQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXRVdWlkKHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1dWlkOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXVpZCcsIHVybCkgYXMgc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgICAgIGlmICh1dWlkKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCwgdXVpZCB9LCAnQXNzZXQgVVVJRCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IFVVSUQgbm90IGZvdW5kJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0VXJsKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXJsOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXJsJywgdXVpZCkgYXMgc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgICAgIGlmICh1cmwpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXVpZCwgdXJsIH0sICdBc3NldCBVUkwgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdBc3NldCBVUkwgbm90IGZvdW5kJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kQXNzZXRCeU5hbWUoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbmFtZSwgZXhhY3RNYXRjaCA9IGZhbHNlLCBhc3NldFR5cGUgPSAnYWxsJywgZm9sZGVyID0gJ2RiOi8vYXNzZXRzJywgbWF4UmVzdWx0cyA9IDIwIH0gPSBhcmdzO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldHMoYXNzZXRUeXBlLCBmb2xkZXIpO1xuICAgICAgICAgICAgaWYgKCFhbGxBc3NldHNSZXN1bHQuc3VjY2VzcyB8fCAhYWxsQXNzZXRzUmVzdWx0LmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgYXNzZXRzOiAke2FsbEFzc2V0c1Jlc3VsdC5lcnJvcn1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGFsbEFzc2V0cyA9IGFsbEFzc2V0c1Jlc3VsdC5kYXRhLmFzc2V0cyBhcyBhbnlbXTtcbiAgICAgICAgICAgIGNvbnN0IG1hdGNoZWRBc3NldHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFsbEFzc2V0cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBleGFjdE1hdGNoXG4gICAgICAgICAgICAgICAgICAgID8gYXNzZXQubmFtZSA9PT0gbmFtZVxuICAgICAgICAgICAgICAgICAgICA6IGFzc2V0Lm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhuYW1lLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXRhaWxSZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0SW5mbyhhc3NldC5wYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaChkZXRhaWxSZXN1bHQuc3VjY2VzcyA/IHsgLi4uYXNzZXQsIGRldGFpbHM6IGRldGFpbFJlc3VsdC5kYXRhIH0gOiBhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZEFzc2V0cy5wdXNoKGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobWF0Y2hlZEFzc2V0cy5sZW5ndGggPj0gbWF4UmVzdWx0cykgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHNlYXJjaFRlcm06IG5hbWUsIGV4YWN0TWF0Y2gsIGFzc2V0VHlwZSwgZm9sZGVyLFxuICAgICAgICAgICAgICAgIHRvdGFsRm91bmQ6IG1hdGNoZWRBc3NldHMubGVuZ3RoLCBtYXhSZXN1bHRzLCBhc3NldHM6IG1hdGNoZWRBc3NldHNcbiAgICAgICAgICAgIH0sIGBGb3VuZCAke21hdGNoZWRBc3NldHMubGVuZ3RofSBhc3NldHMgbWF0Y2hpbmcgJyR7bmFtZX0nYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQXNzZXQgc2VhcmNoIGZhaWxlZDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERldGFpbHMoYXNzZXRQYXRoPzogc3RyaW5nLCBpbmNsdWRlU3ViQXNzZXRzOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFzc2V0UGF0aCB8fCB0eXBlb2YgYXNzZXRQYXRoICE9PSAnc3RyaW5nJyB8fCBhc3NldFBhdGgudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdnZXRfZGV0YWlscyByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldEluZm8oYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhc3NldEluZm9SZXN1bHQ7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhc3NldEluZm9SZXN1bHQuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IGRldGFpbGVkSW5mbzogYW55ID0geyAuLi5hc3NldEluZm8sIHN1YkFzc2V0czogW10gfTtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlU3ViQXNzZXRzICYmIGFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8udHlwZSA9PT0gJ2NjLkltYWdlQXNzZXQnIHx8IGFzc2V0UGF0aC5tYXRjaCgvXFwuKHBuZ3xqcGd8anBlZ3xnaWZ8dGdhfGJtcHxwc2QpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlVXVpZCA9IGFzc2V0SW5mby51dWlkO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3NzaWJsZVN1YkFzc2V0cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3Nwcml0ZUZyYW1lJywgdXVpZDogYCR7YmFzZVV1aWR9QGY5OTQxYCwgc3VmZml4OiAnQGY5OTQxJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAndGV4dHVyZScsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3RleHR1cmUyRCcsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfVxuICAgICAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YkFzc2V0IG9mIHBvc3NpYmxlU3ViQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YkFzc2V0VXJsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXJsJywgc3ViQXNzZXQudXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YkFzc2V0VXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbGVkSW5mby5zdWJBc3NldHMucHVzaCh7IHR5cGU6IHN1YkFzc2V0LnR5cGUsIHV1aWQ6IHN1YkFzc2V0LnV1aWQsIHVybDogc3ViQXNzZXRVcmwsIHN1ZmZpeDogc3ViQXNzZXQuc3VmZml4IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggeyAvKiBzdWItYXNzZXQgZG9lc24ndCBleGlzdCwgc2tpcCAqLyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGFzc2V0UGF0aCwgaW5jbHVkZVN1YkFzc2V0cywgLi4uZGV0YWlsZWRJbmZvIH0sIGBBc3NldCBkZXRhaWxzIHJldHJpZXZlZC4gRm91bmQgJHtkZXRhaWxlZEluZm8uc3ViQXNzZXRzLmxlbmd0aH0gc3ViLWFzc2V0cy5gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGFzc2V0IGRldGFpbHM6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIOKUgOKUgCBGcm9tIEFzc2V0QWR2YW5jZWRUb29scyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIC8qKlxuICAgICAqIFRoZSBvbGQgaW1wbGVtZW50YXRpb24gZm9yd2FyZGVkIHRoZSBjYWxsZXIncyByYXcgc3RyaW5nIHN0cmFpZ2h0IHRvXG4gICAgICogYHNhdmUtYXNzZXQtbWV0YWAgd2l0aCBubyBwYXJzZSwgbm8gbWVyZ2UsIGFuZCBubyBwcmVzZW5jZSBndWFyZCDigJQgYVxuICAgICAqIGJ5dGUtaWRlbnRpY2FsIGAucG5nLm1ldGFgIHJvdW5kLXRyaXAgZGVwZW5kZWQgb24gdGhlIGNhbGxlciByZWNvbnN0cnVjdGluZyB0aGVcbiAgICAgKiAqZW50aXJlKiBtZXRhIGV4YWN0bHksIGFuZCBhbnkgZmllbGQgaXQgZHJvcHBlZCAob3IgdGhlIGFzc2V0LWRiJ3Mgb3duIGNvbXB1dGVkXG4gICAgICogZmllbGRzIGl0IG5ldmVyIGhhZCkgc2lsZW50bHkgZGl2ZXJnZWQgdGhlIHNhdmVkIG1ldGEuIFJvdXRlIHRocm91Z2hcbiAgICAgKiBgcXVlcnktYXNzZXQtbWV0YWAgLT4gbWVyZ2UgLT4gYEpTT04uc3RyaW5naWZ5YCAtPiBzYXZlIGluc3RlYWQsIG1hdGNoaW5nIHRoZVxuICAgICAqIHBhdHRlcm4gYWxyZWFkeSB1c2VkIGJ5IGBtYW5hZ2VfbWF0ZXJpYWxgL2BtYW5hZ2Vfc2hhZGVyX2VmZmVjdGAgKCM4MikuIGBjb250ZW50YFxuICAgICAqIGlzIG5vdyBhIEpTT04gKnBhdGNoKiBtZXJnZWQgb250byB0aGUgY3VycmVudCBtZXRhLCBub3QgdGhlIHdob2xlIG1ldGEgZG9jdW1lbnQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXRNZXRhKHVybE9yVVVJRD86IHN0cmluZywgY29udGVudD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXVybE9yVVVJRCB8fCB0eXBlb2YgdXJsT3JVVUlEICE9PSAnc3RyaW5nJyB8fCB1cmxPclVVSUQudHJpbSgpID09PSAnJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlX21ldGEgcmVxdWlyZXMgb25lIG9mOiB1cmwsIHVybE9yVVVJRCwgYXNzZXRQYXRoJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvbnRlbnQgPT09IHVuZGVmaW5lZCB8fCBjb250ZW50ID09PSBudWxsIHx8IGNvbnRlbnQgPT09ICcnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmVfbWV0YSByZXF1aXJlcyBjb250ZW50OiBhIEpTT04gc3RyaW5nIG9mIHRoZSBtZXRhIGZpZWxkcyB0byBtZXJnZSAoZS5nLiB7XCJ1c2VyRGF0YVwiOnsuLi59fSknKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcGF0Y2g6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHBhdGNoID0gSlNPTi5wYXJzZShjb250ZW50KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgc2F2ZV9tZXRhIGNvbnRlbnQgaXMgbm90IHZhbGlkIEpTT046ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRNZXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgdXJsT3JVVUlEKTtcbiAgICAgICAgICAgIGlmICghY3VycmVudE1ldGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvdWxkIG5vdCByZWFkIGN1cnJlbnQgbWV0YSBmb3IgJyR7dXJsT3JVVUlEfScg4oCUIGFzc2V0IG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREIuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBtZXJnZWRNZXRhID0geyAuLi5jdXJyZW50TWV0YSwgLi4ucGF0Y2ggfTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldC1tZXRhJywgdXJsT3JVVUlELCBKU09OLnN0cmluZ2lmeShtZXJnZWRNZXRhKSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQ6IHJlc3VsdD8udXVpZCA/PyBtZXJnZWRNZXRhLnV1aWQsIHVybDogcmVzdWx0Py51cmwgfSwgJ0Fzc2V0IG1ldGEgc2F2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUF2YWlsYWJsZVVybCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVXJsOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdnZW5lcmF0ZS1hdmFpbGFibGUtdXJsJywgdXJsKSBhcyBzdHJpbmc7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxVcmw6IHVybCwgYXZhaWxhYmxlVXJsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGF2YWlsYWJsZVVybCA9PT0gdXJsID8gJ1VSTCBpcyBhdmFpbGFibGUnIDogJ0dlbmVyYXRlZCBuZXcgYXZhaWxhYmxlIFVSTCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERiUmVhZHkoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZWFkeTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXJlYWR5JykgYXMgYm9vbGVhbjtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgcmVhZHksIG1lc3NhZ2U6IHJlYWR5ID8gJ0Fzc2V0IGRhdGFiYXNlIGlzIHJlYWR5JyA6ICdBc3NldCBkYXRhYmFzZSBpcyBub3QgcmVhZHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkFzc2V0RXh0ZXJuYWwodXJsT3JVVUlEOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCB1cmxPclVVSUQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ0Fzc2V0IG9wZW5lZCB3aXRoIGV4dGVybmFsIHByb2dyYW0nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJhdGNoSW1wb3J0QXNzZXRzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgb3ZlcndyaXRlOiBib29sZWFuID0gYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJztcbiAgICAgICAgICAgIGNvbnN0IHJlY3Vyc2l2ZTogYm9vbGVhbiA9IGFyZ3MucmVjdXJzaXZlID09PSB0cnVlIHx8IGFyZ3MucmVjdXJzaXZlID09PSAndHJ1ZSc7XG4gICAgICAgICAgICBpZiAoIXZhbGlkYXRlQXNzZXRQYXRoKGFyZ3MudGFyZ2V0RGlyZWN0b3J5IHx8ICcnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnSW52YWxpZCB0YXJnZXREaXJlY3Rvcnk6IG11c3QgYmUgZGI6Ly8gVVJMIG9yIGFzc2V0cy8gcmVsYXRpdmUgcGF0aCB3aXRob3V0IHRyYXZlcnNhbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGFyZ3Muc291cmNlRGlyZWN0b3J5KSkgcmV0dXJuIGVycm9yUmVzdWx0KCdTb3VyY2UgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuZ2V0RmlsZXNGcm9tRGlyZWN0b3J5KGFyZ3Muc291cmNlRGlyZWN0b3J5LCBhcmdzLmZpbGVGaWx0ZXIgfHwgW10sIHJlY3Vyc2l2ZSk7XG4gICAgICAgICAgICBjb25zdCBpbXBvcnRSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGAke2FyZ3MudGFyZ2V0RGlyZWN0b3J5fS8ke2ZpbGVOYW1lfWA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2ltcG9ydC1hc3NldCcsIGZpbGVQYXRoLCB0YXJnZXRQYXRoLCB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH0pO1xuICAgICAgICAgICAgICAgICAgICBpbXBvcnRSZXN1bHRzLnB1c2goeyBzb3VyY2U6IGZpbGVQYXRoLCB0YXJnZXQ6IHRhcmdldFBhdGgsIHN1Y2Nlc3M6IHRydWUsIHV1aWQ6IChyZXN1bHQgYXMgYW55KT8udXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50Kys7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wb3J0UmVzdWx0cy5wdXNoKHsgc291cmNlOiBmaWxlUGF0aCwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JDb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLCBzdWNjZXNzQ291bnQsIGVycm9yQ291bnQsIHJlc3VsdHM6IGltcG9ydFJlc3VsdHMgfSxcbiAgICAgICAgICAgICAgICBgQmF0Y2ggaW1wb3J0IGNvbXBsZXRlZDogJHtzdWNjZXNzQ291bnR9IHN1Y2Nlc3MsICR7ZXJyb3JDb3VudH0gZXJyb3JzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRGaWxlc0Zyb21EaXJlY3RvcnkoZGlyUGF0aDogc3RyaW5nLCBmaWxlRmlsdGVyOiBzdHJpbmdbXSwgcmVjdXJzaXZlOiBib29sZWFuKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBmaWxlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgaXRlbXMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKTtcbiAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXJQYXRoLCBpdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmdWxsUGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIGlmIChmaWxlRmlsdGVyLmxlbmd0aCA9PT0gMCB8fCBmaWxlRmlsdGVyLnNvbWUoZXh0ID0+IGl0ZW0udG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQudG9Mb3dlckNhc2UoKSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpICYmIHJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goLi4udGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoZnVsbFBhdGgsIGZpbGVGaWx0ZXIsIHJlY3Vyc2l2ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWxlcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJhdGNoRGVsZXRlQXNzZXRzKHVybHM6IHN0cmluZ1tdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkZWxldGVSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHVybCBvZiB1cmxzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlUmVzdWx0cy5wdXNoKHsgdXJsLCBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQrKztcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGVSZXN1bHRzLnB1c2goeyB1cmwsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yQ291bnQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHRvdGFsQXNzZXRzOiB1cmxzLmxlbmd0aCwgc3VjY2Vzc0NvdW50LCBlcnJvckNvdW50LCByZXN1bHRzOiBkZWxldGVSZXN1bHRzIH0sXG4gICAgICAgICAgICAgICAgYEJhdGNoIGRlbGV0ZSBjb21wbGV0ZWQ6ICR7c3VjY2Vzc0NvdW50fSBzdWNjZXNzLCAke2Vycm9yQ291bnR9IGVycm9yc2ApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVBc3NldFJlZmVyZW5jZXMoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuOiBgJHtkaXJlY3Rvcnl9LyoqLypgIH0pO1xuICAgICAgICAgICAgY29uc3QgYnJva2VuUmVmZXJlbmNlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkUmVmZXJlbmNlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0LnVybCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8pIHZhbGlkUmVmZXJlbmNlcy5wdXNoKHsgdXJsOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsIG5hbWU6IGFzc2V0Lm5hbWUgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyb2tlblJlZmVyZW5jZXMucHVzaCh7IHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLCBuYW1lOiBhc3NldC5uYW1lLCBlcnJvcjogKGVyciBhcyBFcnJvcikubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgZGlyZWN0b3J5LCB0b3RhbEFzc2V0czogYXNzZXRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB2YWxpZFJlZmVyZW5jZXM6IHZhbGlkUmVmZXJlbmNlcy5sZW5ndGgsIGJyb2tlblJlZmVyZW5jZXM6IGJyb2tlblJlZmVyZW5jZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGJyb2tlbkFzc2V0czogYnJva2VuUmVmZXJlbmNlc1xuICAgICAgICAgICAgfSwgYFZhbGlkYXRpb24gY29tcGxldGVkOiAke2Jyb2tlblJlZmVyZW5jZXMubGVuZ3RofSBicm9rZW4gcmVmZXJlbmNlcyBmb3VuZGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYW4gYXNzZXQncyBkZXBlbmRlbmN5IGdyYXBoLlxuICAgICAqXG4gICAgICogV2FzIGFuIHVuY29uZGl0aW9uYWwgc3R1YiByZXR1cm5pbmcgXCJyZXF1aXJlcyBhZGRpdGlvbmFsIEFQSXMgbm90IGF2YWlsYWJsZSBpblxuICAgICAqIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb25cIiBmb3IgZXZlcnkgaW5wdXQgKCMxMjQpLiBUaGUgdHJpYWdlJ3NcbiAgICAgKiByZXNvbHV0aW9uIHdhcyBleHBsaWNpdCDigJQgaW1wbGVtZW50IGl0LCBvciBzdG9wIGFkdmVydGlzaW5nIGl0IOKAlCBhbmQgdGhlXG4gICAgICogZGVsZXRlLXNhZmV0eSBhcmd1bWVudCBkZWNpZGVkIHRoZSBjaG9pY2U6IGJlY2F1c2UgQ29jb3MgcmVzb2x2ZXMgcmVmZXJlbmNlcyBieVxuICAgICAqIHRoZSB1dWlkIGluIHRoZSBzaWJsaW5nIGAubWV0YWAsIGEgcmVmZXJlbmNlIGxlZnQgZGFuZ2xpbmcgYnkgYSBwcmVtYXR1cmUgZGVsZXRlXG4gICAgICogcmVzb2x2ZXMgdG8gYE5vbmVgIHNpbGVudGx5IGFuZCBzdXJmYWNlcyBhdCBydW50aW1lIG9yIGJ1aWxkIHRpbWUsIGZhciBmcm9tIHRoZVxuICAgICAqIGRlbGV0ZSB0aGF0IGNhdXNlZCBpdC4gYGRpcmVjdGlvbjogZGVwZW5kZW50c2AgaXMgdGhlIG9ubHkgYWR2ZXJ0aXNlZCBwcmUtZmxpZ2h0XG4gICAgICogZm9yIHRoYXQsIHNvIHJlbW92aW5nIHRoZSBhY3Rpb24gd291bGQgcmVtb3ZlIHRoZSBzYWZldHkgY2hlY2suXG4gICAgICpcbiAgICAgKiBUaHJlZSBzb3VyY2VzIGFjcm9zcyB0d28gcGFja2FnZXMsIGJlY2F1c2Ugbm8gc2luZ2xlIG1lc3NhZ2UgYW5zd2VycyBib3RoIGhhbHZlczpcbiAgICAgKlxuICAgICAqIDEuIGBhc3NldC1kYiBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXNgIOKAlCB0aGUgREIncyBmb3J3YXJkIGluZGV4LCBnaXZpbmcgdGhlXG4gICAgICogICAgYGRlcGVuZGVuY2llc2AgZGlyZWN0aW9uIGRpcmVjdGx5LlxuICAgICAqIDIuIGBhc3NldC1kYiBxdWVyeS1hc3NldC11c2Vyc2Ag4oCUIHRoZSBEQidzIHJldmVyc2UgbG9va3VwLCB0aGUgc2FtZSBpbmRleCByZWFkIGZyb21cbiAgICAgKiAgICB0aGUgb3RoZXIgZW5kLiBCb3RoIGFyZSBkZWNsYXJlZCBpbiB0aGUgZWRpdG9yJ3Mgb3duIHR5cGluZ3M7IGJvdGggdGFrZSBhblxuICAgICAqICAgIG9wdGlvbmFsIGB0eXBlYCBzZWxlY3RpbmcgYGFzc2V0YCAvIGBzY3JpcHRgIC8gYGFsbGAsIHNvIGBhbGxgIGlzIHBhc3NlZC5cbiAgICAgKiAzLiBgc2NlbmUgcXVlcnktbm9kZXMtYnktYXNzZXQtdXVpZGAg4oCUIHRoZSBsaXZlIHNjZW5lJ3MgcmV2ZXJzZSBsb29rdXAsIHdoaWNoIHRoZVxuICAgICAqICAgIEFzc2V0IEJyb3dzZXIgdXNlcyB0byBhbnN3ZXIgXCJ3aG8gcmVmZXJlbmNlcyB0aGlzXCIuIEtlcHQgaW4gYWRkaXRpb24gdG8gKDIpXG4gICAgICogICAgYmVjYXVzZSBhIG5vZGUgaW4gdGhlIG9wZW4gc2NlbmUgaXMgdGhlIHBvcHVsYXRpb24gYSBkZWxldGUgYnJlYWtzIGltbWVkaWF0ZWx5LFxuICAgICAqICAgIGFuZCBpcyBub3QgaXRzZWxmIGFuIGFzc2V0IGluIHRoZSBEQi5cbiAgICAgKlxuICAgICAqIEVhY2ggaXMgYXR0ZW1wdGVkIGluZGVwZW5kZW50bHkgYW5kIGl0cyByZWFjaGFiaWxpdHkgaXMgcmVwb3J0ZWQ6IGEgbWVzc2FnZSB0aGF0XG4gICAgICogdGhyb3dzIGNvbnRyaWJ1dGVzIG5vdGhpbmcgdG8gYHNvdXJjZXNgLCBhbmQgYSBjYWxsZXIgc2VlaW5nIGFuIGVtcHR5IGxpc3QgaXMgdG9sZFxuICAgICAqIHdoaWNoIHNvdXJjZXMgYW5zd2VyZWQuIEFuIGVtcHR5IHJlc3VsdCBpcyBzdGF0ZWQgYXMgYSBDT1VOVCBwbHVzIHRob3NlIHNvdXJjZXMsXG4gICAgICogbmV2ZXIgYXMgYSBiYXJlIGVtcHR5IGFycmF5OiBcIm5vIGRlcGVuZGVudHMgZm91bmRcIiBhbmQgXCJ0aGUgcXVlcnkgY291bGQgbm90IHJ1blwiXG4gICAgICogbXVzdCBub3QgcmVhZCB0aGUgc2FtZSB0byBhIGNhbGxlciBkZWNpZGluZyB3aGV0aGVyIGEgZGVsZXRlIGlzIHNhZmUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERlcGVuZGVuY2llcyh1cmxPclVVSUQ/OiBzdHJpbmcsIGRpcmVjdGlvbjogc3RyaW5nID0gJ2RlcGVuZGVuY2llcycpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1cmxPclVVSUQgfHwgdHlwZW9mIHVybE9yVVVJRCAhPT0gJ3N0cmluZycgfHwgdXJsT3JVVUlELnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnZ2V0X2RlcGVuZGVuY2llcyByZXF1aXJlcyBvbmUgb2Y6IHVybCwgdXJsT3JVVUlELCBhc3NldFBhdGgg4oCUIG5hbWluZyB0aGUgYXNzZXQgdG8gYW5hbHl6ZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHVybE9yVVVJRCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgIGlmICghaW5mbyB8fCAhaW5mby51dWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgYEFzc2V0ICcke3VybE9yVVVJRH0nIG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREIg4oCUIG5vdGhpbmcgdG8gYW5hbHl6ZS4gYCArXG4gICAgICAgICAgICAgICAgJ0lmIHRoZSBmaWxlIHdhcyB3cml0dGVuIG91dHNpZGUgdGhlIGVkaXRvciwgcnVuIG1hbmFnZV9hc3NldCBhY3Rpb249cmVmcmVzaCBmaXJzdC4nXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2FudHNEZXBlbmRlbnRzID0gZGlyZWN0aW9uID09PSAnZGVwZW5kZW50cycgfHwgZGlyZWN0aW9uID09PSAnYm90aCc7XG4gICAgICAgIGNvbnN0IHdhbnRzRGVwZW5kZW5jaWVzID0gZGlyZWN0aW9uID09PSAnZGVwZW5kZW5jaWVzJyB8fCBkaXJlY3Rpb24gPT09ICdib3RoJztcbiAgICAgICAgY29uc3QgZGF0YTogUmVjb3JkPHN0cmluZywgYW55PiA9IHtcbiAgICAgICAgICAgIHVybDogaW5mby51cmwgfHwgdXJsT3JVVUlELFxuICAgICAgICAgICAgdXVpZDogaW5mby51dWlkLFxuICAgICAgICAgICAgbmFtZTogaW5mby5uYW1lLFxuICAgICAgICAgICAgZGlyZWN0aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKHdhbnRzRGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbmNpZXMgPSBhd2FpdCB0aGlzLnF1ZXJ5QXNzZXREZXBlbmRlbmNpZXMoaW5mby51dWlkKTtcbiAgICAgICAgICAgIGRhdGEuZGVwZW5kZW5jaWVzID0gZGVwZW5kZW5jaWVzLmFzc2V0cztcbiAgICAgICAgICAgIGRhdGEuZGVwZW5kZW5jeUNvdW50ID0gZGVwZW5kZW5jaWVzLmFzc2V0cy5sZW5ndGg7XG4gICAgICAgICAgICBkYXRhLmRlcGVuZGVuY2llc1NvdXJjZSA9IGRlcGVuZGVuY2llcy5zb3VyY2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAod2FudHNEZXBlbmRlbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBkZXBlbmRlbnRzID0gYXdhaXQgdGhpcy5xdWVyeUFzc2V0RGVwZW5kZW50cyhpbmZvLnV1aWQsIHVybE9yVVVJRCk7XG4gICAgICAgICAgICBkYXRhLmRlcGVuZGVudHMgPSBkZXBlbmRlbnRzLmFzc2V0cztcbiAgICAgICAgICAgIGRhdGEuZGVwZW5kZW50Q291bnQgPSBkZXBlbmRlbnRzLmFzc2V0cy5sZW5ndGg7XG4gICAgICAgICAgICBkYXRhLmRlcGVuZGVudHNTb3VyY2UgPSBkZXBlbmRlbnRzLnNvdXJjZTtcbiAgICAgICAgICAgIC8vIE5hbWVkIHNlcGFyYXRlbHkgZnJvbSBgZGVwZW5kZW50c2A6IGEgc2NlbmUgbm9kZSBpcyBhIGxpdmUgY29uc3VtZXIgYW5cbiAgICAgICAgICAgIC8vIGFzc2V0IGNsZWFudXAgbXVzdCBub3QgYnJlYWssIGFuZCBpdCBpcyBub3QgYW4gYXNzZXQgaW4gdGhlIERCLlxuICAgICAgICAgICAgZGF0YS5yZWZlcmVuY2luZ05vZGVzID0gZGVwZW5kZW50cy5ub2RlcztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1bW1hcnkgPSBbXG4gICAgICAgICAgICB3YW50c0RlcGVuZGVudHMgPyBgJHtkYXRhLmRlcGVuZGVudENvdW50ID8/IDB9IGRlcGVuZGVudCBhc3NldChzKSB2aWEgJHtkYXRhLmRlcGVuZGVudHNTb3VyY2V9YCA6IG51bGwsXG4gICAgICAgICAgICB3YW50c0RlcGVuZGVuY2llcyA/IGAke2RhdGEuZGVwZW5kZW5jeUNvdW50ID8/IDB9IGRlcGVuZGVuY3kvZGVwZW5kZW5jaWVzIHZpYSAke2RhdGEuZGVwZW5kZW5jaWVzU291cmNlfWAgOiBudWxsLFxuICAgICAgICBdLmZpbHRlcihCb29sZWFuKS5qb2luKCcsICcpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGRhdGEsIGBSZXNvbHZlZCAke2luZm8ubmFtZSB8fCBpbmZvLnVybH06ICR7c3VtbWFyeX1gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBGb3J3YXJkIGdyYXBoLiBVc2VzIHRoZSBhc3NldCBEQidzIG93biBpbmRleDsgcmV0dXJucyBgW11gIHdpdGggYSBuYW1lZCBlbXB0eSBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBgcXVlcnktYXNzZXQtZGVwZW5kZW5jaWVzYCBpcyBkZWNsYXJlZCBpblxuICAgICAqIGBAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3Byb3RlY3RlZC9tZXNzYWdlLmQudHNgIGFzXG4gICAgICogYCh1dWlkOiBzdHJpbmcsIHR5cGU/OiBRdWVyeUFzc2V0VHlwZSkgPT4gc3RyaW5nW11gLiBUaGUgYHR5cGVgIGFyZ3VtZW50IHNlbGVjdHMgdGhlXG4gICAgICogcG9wdWxhdGlvbiDigJQgYGFzc2V0YCAocmVzb3VyY2VzKSwgYHNjcmlwdGAsIG9yIGBhbGxgIOKAlCBhbmQgb21pdHRpbmcgaXQgb21pdHMgc2NyaXB0XG4gICAgICogcmVmZXJlbmNlcywgc28gYGFsbGAgaXMgcGFzc2VkIHRvIG1hdGNoIHRoZSBcIndoYXQgd291bGQgYSBkZWxldGUgYnJlYWtcIiBxdWVzdGlvbiB0aGVcbiAgICAgKiBjYWxsZXIgaXMgYXNraW5nLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERlcGVuZGVuY2llcyh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHsgYXNzZXRzOiBhbnlbXTsgc291cmNlOiBzdHJpbmcgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnLCB1dWlkLCAnYWxsJyk7XG4gICAgICAgICAgICBjb25zdCBsaXN0ID0gQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogW107XG4gICAgICAgICAgICByZXR1cm4geyBhc3NldHM6IGxpc3QubWFwKChkZXA6IGFueSkgPT4gKHR5cGVvZiBkZXAgPT09ICdzdHJpbmcnID8geyB1dWlkOiBkZXAgfSA6IGRlcCkpLCBzb3VyY2U6ICdhc3NldC1kYiBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMnIH07XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm8gc3VjaCBtZXNzYWdlIGluIHRoaXMgYnVpbGQg4oCUIGFuIGVtcHR5IGxpc3Qgd2l0aCBhIG5hbWVkIHNvdXJjZSwgc28gdGhlXG4gICAgICAgICAgICAvLyBjYWxsZXIgY2FuIHRlbGwgXCJub25lXCIgZnJvbSBcIm5vdCBhbnN3ZXJhYmxlIGhlcmVcIi5cbiAgICAgICAgICAgIHJldHVybiB7IGFzc2V0czogW10sIHNvdXJjZTogJ3VuYXZhaWxhYmxlIChubyBhc3NldC1kYiBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXMgaW4gdGhpcyBlZGl0b3IgYnVpbGQpJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV2ZXJzZSBncmFwaC4gU2NhbnMgdGhlIGFzc2V0IERCJ3Mgb3duIHNlcmlhbGl6ZWQgcmVmZXJlbmNlcyB3aGVyZSB0aGUgYnVpbGRcbiAgICAgKiBleHBvc2VzIHRoZW0sIGFuZCBhbHdheXMgYWRkcyB0aGUgbGl2ZSBzY2VuZSdzIHJldmVyc2UgbG9va3VwLCB3aGljaCBpcyB0aGVcbiAgICAgKiBwb3B1bGF0aW9uIGEgZGVsZXRlIGFjdHVhbGx5IHJpc2tzIGJyZWFraW5nLlxuICAgICAqL1xuICAgIC8qKlxuICAgICAqIFJldmVyc2UgZ3JhcGguIEJvdGggZGlyZWN0aW9ucyBhcmUgYXNrZWQgb2YgdGhlIGVkaXRvciwgYmVjYXVzZSBlYWNoIHNlZXMgYVxuICAgICAqIHBvcHVsYXRpb24gdGhlIG90aGVyIGNhbiBtaXNzOiB0aGUgYXNzZXQgREIncyByZXZlcnNlIGluZGV4IHNlZXMgc2VyaWFsaXplZFxuICAgICAqIHJlZmVyZW5jZXMgYW55d2hlcmUgaW4gdGhlIHByb2plY3QsIHdoaWxlIHRoZSBsaXZlIHNjZW5lIHNjYW4gaXMgd2hhdCBhIGRlbGV0ZVxuICAgICAqIGFjdHVhbGx5IGJyZWFrcyByaWdodCBub3cuXG4gICAgICpcbiAgICAgKiBgcXVlcnktYXNzZXQtdXNlcnNgIGlzIHRoZSBEQidzIGRlY2xhcmVkIHJldmVyc2UgbWVzc2FnZVxuICAgICAqIChgQGNvY29zL2NyZWF0b3ItdHlwZXMvLi4uL2Fzc2V0LWRiL0B0eXBlcy9wcm90ZWN0ZWQvbWVzc2FnZS5kLnRzYCksIGRlY2xhcmVkIGFzXG4gICAgICogYCh1dWlkOiBzdHJpbmcsIHR5cGU/OiBRdWVyeUFzc2V0VHlwZSkgPT4gc3RyaW5nW10gfCBudWxsYC4gSXQgaXMgdGhlIHNhbWVcbiAgICAgKiBwb3B1bGF0aW9uIGBxdWVyeS1hc3NldC1kZXBlbmRlbmNpZXNgIGluZGV4ZXMgZnJvbSB0aGUgb3RoZXIgZW5kLCBzbyBpdCBuZWVkcyB0aGVcbiAgICAgKiBzYW1lIGBhbGxgIHRvIGluY2x1ZGUgc2NyaXB0IHJlZmVyZW5jZXMuXG4gICAgICpcbiAgICAgKiBOb3RoaW5nIGlzIGluZmVycmVkIGZyb20gYSBmYWlsZWQgY2FsbDogYW4gdW5yZWFjaGFibGUgbWVzc2FnZSBsZWF2ZXMgYHNvdXJjZXNgXG4gICAgICogc2hvcnQsIGFuZCB0aGUgY2FsbGVyIHJlcG9ydHMgdGhhdCBhcyBcIm5vdCBhbnN3ZXJhYmxlIGhlcmVcIiByYXRoZXIgdGhhbiBhcyB6ZXJvLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERlcGVuZGVudHModXVpZDogc3RyaW5nLCB1cmxPclVVSUQ6IHN0cmluZyk6IFByb21pc2U8eyBhc3NldHM6IGFueVtdOyBub2Rlczogc3RyaW5nW107IHNvdXJjZTogc3RyaW5nIH0+IHtcbiAgICAgICAgY29uc3QgYXNzZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICBjb25zdCBzb3VyY2VzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LXVzZXJzJywgdXVpZCwgJ2FsbCcpO1xuICAgICAgICAgICAgY29uc3QgbGlzdCA9IEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdCA6IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBkZXAgb2YgbGlzdCkgYXNzZXRzLnB1c2godHlwZW9mIGRlcCA9PT0gJ3N0cmluZycgPyB7IHV1aWQ6IGRlcCB9IDogZGVwKTtcbiAgICAgICAgICAgIHNvdXJjZXMucHVzaCgnYXNzZXQtZGIgcXVlcnktYXNzZXQtdXNlcnMnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBOb3QgYXZhaWxhYmxlIGluIHRoaXMgYnVpbGQg4oCUIHRoZSBzY2VuZSBzY2FuIGJlbG93IGlzIHRoZSB3aG9sZSBhbnN3ZXIuXG4gICAgICAgIH1cblxuICAgICAgICBsZXQgbm9kZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZHM6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCB1dWlkKTtcbiAgICAgICAgICAgIG5vZGVzID0gQXJyYXkuaXNBcnJheShub2RlVXVpZHMpID8gbm9kZVV1aWRzIDogW107XG4gICAgICAgICAgICBpZiAobm9kZXMubGVuZ3RoID4gMCkgc291cmNlcy5wdXNoKCdzY2VuZSBxdWVyeS1ub2Rlcy1ieS1hc3NldC11dWlkJyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm8gcmV2ZXJzZSBzY2VuZSBsb29rdXAgZWl0aGVyOyBgc291cmNlc2Agc3RheXMgZW1wdHkgYW5kIGlzIHJlcG9ydGVkIGFzIHN1Y2guXG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYXNzZXRzLFxuICAgICAgICAgICAgbm9kZXMsXG4gICAgICAgICAgICBzb3VyY2U6IHNvdXJjZXMubGVuZ3RoID4gMCA/IHNvdXJjZXMuam9pbignICsgJykgOiBgbm8gcmV2ZXJzZS1yZWZlcmVuY2UgcXVlcnkgYXZhaWxhYmxlIGZvciAnJHt1cmxPclVVSUR9JyBpbiB0aGlzIGVkaXRvciBidWlsZGBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydEFzc2V0TWFuaWZlc3QoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBmb3JtYXQ6IHN0cmluZyA9ICdqc29uJywgaW5jbHVkZU1ldGFkYXRhOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzOiBhbnlbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybjogYCR7ZGlyZWN0b3J5fS8qKi8qYCB9KTtcbiAgICAgICAgICAgIGNvbnN0IG1hbmlmZXN0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYW5pZmVzdEVudHJ5OiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBhc3NldC50eXBlLCBzaXplOiAoYXNzZXQgYXMgYW55KS5zaXplIHx8IDAsIGlzRGlyZWN0b3J5OiBhc3NldC5pc0RpcmVjdG9yeSB8fCBmYWxzZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVNZXRhZGF0YSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXQudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLm1ldGEpIG1hbmlmZXN0RW50cnkubWV0YSA9IGFzc2V0SW5mby5tZXRhO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHsgLyogc2tpcCBtZXRhZGF0YSBpZiBub3QgYXZhaWxhYmxlICovIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbWFuaWZlc3QucHVzaChtYW5pZmVzdEVudHJ5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBleHBvcnREYXRhOiBzdHJpbmc7XG4gICAgICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2Nzdic6IGV4cG9ydERhdGEgPSB0aGlzLmNvbnZlcnRUb0NTVihtYW5pZmVzdCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ3htbCc6IGV4cG9ydERhdGEgPSB0aGlzLmNvbnZlcnRUb1hNTChtYW5pZmVzdCk7IGJyZWFrO1xuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGV4cG9ydERhdGEgPSBKU09OLnN0cmluZ2lmeShtYW5pZmVzdCwgbnVsbCwgMik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGRpcmVjdG9yeSwgZm9ybWF0LCBhc3NldENvdW50OiBtYW5pZmVzdC5sZW5ndGgsIGluY2x1ZGVNZXRhZGF0YSwgbWFuaWZlc3Q6IGV4cG9ydERhdGEgfSxcbiAgICAgICAgICAgICAgICBgQXNzZXQgbWFuaWZlc3QgZXhwb3J0ZWQgd2l0aCAke21hbmlmZXN0Lmxlbmd0aH0gYXNzZXRzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjb252ZXJ0VG9DU1YoZGF0YTogYW55W10pOiBzdHJpbmcge1xuICAgICAgICBpZiAoZGF0YS5sZW5ndGggPT09IDApIHJldHVybiAnJztcbiAgICAgICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5rZXlzKGRhdGFbMF0pO1xuICAgICAgICBjb25zdCBjc3ZSb3dzID0gW2hlYWRlcnMubWFwKGggPT4gZXNjYXBlQ3N2RmllbGQoaCkpLmpvaW4oJywnKV07XG4gICAgICAgIGZvciAoY29uc3Qgcm93IG9mIGRhdGEpIHtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlcyA9IGhlYWRlcnMubWFwKGhlYWRlciA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSByb3dbaGVhZGVyXTtcbiAgICAgICAgICAgICAgICBjb25zdCBzdHIgPSB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gSlNPTi5zdHJpbmdpZnkodmFsdWUpIDogU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXNjYXBlQ3N2RmllbGQoc3RyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY3N2Um93cy5wdXNoKHZhbHVlcy5qb2luKCcsJykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjc3ZSb3dzLmpvaW4oJ1xcbicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29udmVydFRvWE1MKGRhdGE6IGFueVtdKTogc3RyaW5nIHtcbiAgICAgICAgbGV0IHhtbCA9ICc8P3htbCB2ZXJzaW9uPVwiMS4wXCIgZW5jb2Rpbmc9XCJVVEYtOFwiPz5cXG48YXNzZXRzPlxcbic7XG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBkYXRhKSB7XG4gICAgICAgICAgICB4bWwgKz0gJyAgPGFzc2V0Plxcbic7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhpdGVtKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHhtbFZhbHVlID0gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/XG4gICAgICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHZhbHVlKSA6XG4gICAgICAgICAgICAgICAgICAgIFN0cmluZyh2YWx1ZSkucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xuICAgICAgICAgICAgICAgIHhtbCArPSBgICAgIDwke2tleX0+JHt4bWxWYWx1ZX08LyR7a2V5fT5cXG5gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeG1sICs9ICcgIDwvYXNzZXQ+XFxuJztcbiAgICAgICAgfVxuICAgICAgICB4bWwgKz0gJzwvYXNzZXRzPic7XG4gICAgICAgIHJldHVybiB4bWw7XG4gICAgfVxufVxuIl19