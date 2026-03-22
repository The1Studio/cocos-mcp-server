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
const assetStatsHelpers = __importStar(require("./manage-asset-stats-helpers"));
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
 * Consolidated asset management tool.
 * Combines ProjectTools (asset methods) + AssetAdvancedTools into one action-based tool.
 */
class ManageAsset extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_asset';
        this.description = 'Manage assets in the project (files, textures, scripts, etc). Actions: import, get_info, list, refresh, create, copy, move, delete, save, reimport, query_path, query_uuid, query_url, find_by_name, get_details, save_meta, generate_url, query_db_ready, open_external, batch_import, batch_delete, validate_references, get_dependencies, get_unused, compress_textures, export_manifest, get_audio_stats, get_texture_stats, update_meta. NOT for scene nodes — use manage_node. Use query_db_ready to check asset DB before batch ops.';
        this.actions = [
            'import', 'get_info', 'list', 'refresh', 'create', 'copy', 'move', 'delete',
            'save', 'reimport', 'query_path', 'query_uuid', 'query_url', 'find_by_name',
            'get_details', 'save_meta', 'generate_url', 'query_db_ready', 'open_external',
            'batch_import', 'batch_delete', 'validate_references', 'get_dependencies',
            'get_unused', 'compress_textures', 'export_manifest',
            'get_audio_stats', 'get_texture_stats', 'update_meta'
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
                metaData: { type: 'object', description: 'Meta properties to deep-merge (for update_meta)' },
                presetId: { type: 'string', description: 'Texture compression preset ID from builder.json (for compress_textures)' }
            },
            required: ['action']
        };
        this.actionHandlers = {
            import: (args) => this.importAsset(args.sourcePath, args.targetFolder),
            get_info: (args) => this.getAssetInfo(args.assetPath || args.urlOrUUID),
            list: (args) => this.getAssets(args.type, args.folder),
            refresh: (args) => this.refreshAssets(args.folder),
            create: (args) => { var _a; return this.createAsset(args.url, (_a = args.content) !== null && _a !== void 0 ? _a : null, args.overwrite === true || args.overwrite === 'true'); },
            copy: (args) => this.copyAsset(args.source, args.target, args.overwrite === true || args.overwrite === 'true'),
            move: (args) => this.moveAsset(args.source, args.target, args.overwrite === true || args.overwrite === 'true'),
            delete: (args) => this.deleteAsset(args.url),
            save: (args) => this.saveAsset(args.url || args.urlOrUUID, args.content),
            reimport: (args) => this.reimportAsset(args.url || args.urlOrUUID),
            query_path: (args) => this.queryAssetPath(args.url || args.urlOrUUID),
            query_uuid: (args) => this.queryAssetUuid(args.url),
            query_url: (args) => this.queryAssetUrl(args.uuid),
            find_by_name: (args) => this.findAssetByName(args),
            get_details: (args) => this.getAssetDetails(args.assetPath || args.urlOrUUID, args.includeSubAssets !== false),
            save_meta: (args) => this.saveAssetMeta(args.urlOrUUID, args.content),
            generate_url: (args) => this.generateAvailableUrl(args.url),
            query_db_ready: (_args) => this.queryAssetDbReady(),
            open_external: (args) => this.openAssetExternal(args.urlOrUUID),
            batch_import: (args) => this.batchImportAssets(args),
            batch_delete: (args) => this.batchDeleteAssets(args.urls),
            validate_references: (args) => this.validateAssetReferences(args.directory),
            get_dependencies: (args) => this.getAssetDependencies(args.urlOrUUID, args.direction),
            get_unused: (args) => this.getUnusedAssets(args.directory, args.excludeDirectories),
            compress_textures: (args) => assetStatsHelpers.compressTextures(args.directory, args.presetId, args.quality),
            export_manifest: (args) => this.exportAssetManifest(args.directory, args.format, args.includeMetadata !== false),
            get_audio_stats: (args) => assetStatsHelpers.getAudioStats(args.directory),
            get_texture_stats: (args) => assetStatsHelpers.getTextureStats(args.directory),
            update_meta: (args) => assetStatsHelpers.updateMeta(args.assetPath, args.metaData)
        };
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
    async createAsset(url, content = null, overwrite = false) {
        try {
            const options = { overwrite, rename: !overwrite };
            const result = await Editor.Message.request('asset-db', 'create-asset', url, content, options);
            const msg = content === null ? 'Folder created successfully' : 'File created successfully';
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
    async deleteAsset(url) {
        try {
            await Editor.Message.request('asset-db', 'delete-asset', url);
            return (0, types_1.successResult)({ url }, 'Asset deleted successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async saveAsset(url, content) {
        try {
            const result = await Editor.Message.request('asset-db', 'save-asset', url, content);
            return (0, types_1.successResult)(result && result.uuid ? { uuid: result.uuid, url: result.url } : { url }, 'Asset saved successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async reimportAsset(url) {
        try {
            await Editor.Message.request('asset-db', 'reimport-asset', url);
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
    async saveAssetMeta(urlOrUUID, content) {
        try {
            const result = await Editor.Message.request('asset-db', 'save-asset-meta', urlOrUUID, content);
            return (0, types_1.successResult)({ uuid: result === null || result === void 0 ? void 0 : result.uuid, url: result === null || result === void 0 ? void 0 : result.url }, 'Asset meta saved successfully');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvQ0FBd0U7QUFDeEUseURBQW9EO0FBQ3BELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFDN0IsZ0ZBQWtFO0FBRWxFOzs7R0FHRztBQUNILFNBQVMsaUJBQWlCLENBQUMsU0FBaUI7SUFDeEMsSUFBSSxDQUFDLFNBQVMsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDOUQscURBQXFEO0lBQ3JELElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFBRSxPQUFPLElBQUksQ0FBQztJQUMvQyx3Q0FBd0M7SUFDeEMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLFNBQVMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN0Ryw2Q0FBNkM7SUFDN0MsT0FBTyxTQUFTLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzNDLENBQUM7QUFFRCxTQUFTLGNBQWMsQ0FBQyxLQUFhO0lBQ2pDLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtRQUFFLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3BELG9DQUFvQztJQUNwQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQUUsS0FBSyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUM7SUFDcEQscURBQXFEO0lBQ3JELElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNyRSxPQUFPLEdBQUcsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDakQsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsNmdCQUE2Z0IsQ0FBQztRQUM1aEIsWUFBTyxHQUFHO1lBQ2YsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVE7WUFDM0UsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxjQUFjO1lBQzNFLGFBQWEsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFFLGVBQWU7WUFDN0UsY0FBYyxFQUFFLGNBQWMsRUFBRSxxQkFBcUIsRUFBRSxrQkFBa0I7WUFDekUsWUFBWSxFQUFFLG1CQUFtQixFQUFFLGlCQUFpQjtZQUNwRCxpQkFBaUIsRUFBRSxtQkFBbUIsRUFBRSxhQUFhO1NBQ3hELENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLHVDQUF1QyxFQUFFO2dCQUNwRixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxnQ0FBZ0MsRUFBRTtnQkFDL0UsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsOEJBQThCLEVBQUU7Z0JBQzFFLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFFO2dCQUMvRCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSw2QkFBNkIsRUFBRTtnQkFDbkUsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFO2dCQUNuRCxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSw4QkFBOEIsRUFBRTtnQkFDeEUsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUseUJBQXlCLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRTtnQkFDdEYsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsa0NBQWtDLEVBQUU7Z0JBQzNFLE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtDQUFrQyxFQUFFO2dCQUMzRSxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFO2dCQUN4RixJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1CQUFtQjtvQkFDaEMsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUM7b0JBQy9GLE9BQU8sRUFBRSxLQUFLO2lCQUNqQjtnQkFDRCxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSwwQkFBMEIsRUFBRTtnQkFDakUsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsa0JBQWtCLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRTtnQkFDaEYsU0FBUyxFQUFFO29CQUNQLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxzQkFBc0I7b0JBQ25DLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQztvQkFDOUcsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dCQUNELFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLDhCQUE4QixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUNsSCxnQkFBZ0IsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLDJDQUEyQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUU7Z0JBQzlHLGVBQWUsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG1DQUFtQyxFQUFFO2dCQUNyRixlQUFlLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx1Q0FBdUMsRUFBRTtnQkFDekYsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLHdCQUF3QixFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUU7Z0JBQzVHLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLHdCQUF3QixFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7Z0JBQ3JGLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLFdBQVcsRUFBRSxzQ0FBc0MsRUFBRTtnQkFDdkcsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRTtnQkFDdkYsa0JBQWtCLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxXQUFXLEVBQUUsd0JBQXdCLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRTtnQkFDcEgsU0FBUyxFQUFFO29CQUNQLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxzQkFBc0I7b0JBQ25DLElBQUksRUFBRSxDQUFDLFlBQVksRUFBRSxjQUFjLEVBQUUsTUFBTSxDQUFDO29CQUM1QyxPQUFPLEVBQUUsY0FBYztpQkFDMUI7Z0JBQ0QsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxpREFBaUQ7b0JBQzlELElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQztvQkFDMUQsT0FBTyxFQUFFLE1BQU07aUJBQ2xCO2dCQUNELE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLCtCQUErQixFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUNuSCxlQUFlLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxvQ0FBb0MsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFO2dCQUN0RyxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxpREFBaUQsRUFBRTtnQkFDNUYsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUseUVBQXlFLEVBQUU7YUFDdkg7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDdEUsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUN2RSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3RELE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ2xELE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLFdBQUMsT0FBQSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBQSxJQUFJLENBQUMsT0FBTyxtQ0FBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxNQUFNLENBQUMsQ0FBQSxFQUFBO1lBQ3hILElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxNQUFNLENBQUM7WUFDOUcsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLE1BQU0sQ0FBQztZQUM5RyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUM1QyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDeEUsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNsRSxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQ3JFLFVBQVUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO1lBQ25ELFNBQVMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ2xELFlBQVksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7WUFDbEQsV0FBVyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsZ0JBQWdCLEtBQUssS0FBSyxDQUFDO1lBQzlHLFNBQVMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDckUsWUFBWSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztZQUMzRCxjQUFjLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUNuRCxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQy9ELFlBQVksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQztZQUNwRCxZQUFZLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3pELG1CQUFtQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUMzRSxnQkFBZ0IsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNyRixVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7WUFDbkYsaUJBQWlCLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQzVHLGVBQWUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsZUFBZSxLQUFLLEtBQUssQ0FBQztZQUNoSCxlQUFlLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQzFFLGlCQUFpQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUM5RSxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUM7U0FDckYsQ0FBQztJQXlhTixDQUFDO0lBdmFHLDRFQUE0RTtJQUVwRSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQWtCLEVBQUUsWUFBb0I7UUFDOUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUM1RSxJQUFJLENBQUMsaUJBQWlCLENBQUMsWUFBWSxDQUFDO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsMEZBQTBGLENBQUMsQ0FBQztRQUNySixJQUFJLENBQUM7WUFDRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzNDLE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsZUFBZSxZQUFZLEVBQUUsQ0FBQztZQUNuRyxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLEdBQUcsVUFBVSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDdEgsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsbUJBQW1CLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUMxRyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFlBQVksQ0FBQyxTQUFpQjtRQUN4QyxJQUFJLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMvRixJQUFJLENBQUMsU0FBUztnQkFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3RELE1BQU0sSUFBSSxHQUFRO2dCQUNkLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSTtnQkFDcEIsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJO2dCQUNwQixJQUFJLEVBQUUsU0FBUyxDQUFDLEdBQUc7Z0JBQ25CLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSTtnQkFDcEIsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJO2dCQUNwQixXQUFXLEVBQUUsU0FBUyxDQUFDLFdBQVc7YUFDckMsQ0FBQztZQUNGLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNqQixJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQy9FLENBQUM7WUFDRCxPQUFPLElBQUEscUJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQztRQUMvQixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFlLEtBQUssRUFBRSxTQUFpQixhQUFhO1FBQ3hFLElBQUksQ0FBQztZQUNELElBQUksT0FBTyxHQUFHLEdBQUcsTUFBTSxPQUFPLENBQUM7WUFDL0IsSUFBSSxJQUFJLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ2pCLE1BQU0sY0FBYyxHQUEyQjtvQkFDM0MsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxVQUFVO29CQUM1RCxTQUFTLEVBQUUsaUNBQWlDLEVBQUUsVUFBVSxFQUFFLE1BQU07b0JBQ2hFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsV0FBVyxFQUFFLGNBQWM7aUJBQ3ZGLENBQUM7Z0JBQ0YsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLFNBQVM7b0JBQUUsT0FBTyxHQUFHLEdBQUcsTUFBTSxRQUFRLFNBQVMsRUFBRSxDQUFDO1lBQzFELENBQUM7WUFDRCxNQUFNLE9BQU8sR0FBVSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQzdGLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNqQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUc7Z0JBQ25ELElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLO2FBQ25GLENBQUMsQ0FBQyxDQUFDO1lBQ0osT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBZTtRQUN2QyxJQUFJLENBQUM7WUFDRCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksYUFBYSxDQUFDO1lBQzNDLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUN0RSxPQUFPLElBQUEscUJBQWEsRUFBQyxJQUFJLEVBQUUsd0JBQXdCLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBVyxFQUFFLFVBQXlCLElBQUksRUFBRSxZQUFxQixLQUFLO1FBQzVGLElBQUksQ0FBQztZQUNELE1BQU0sT0FBTyxHQUFHLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2xELE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQ3BHLE1BQU0sR0FBRyxHQUFHLE9BQU8sS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLDZCQUE2QixDQUFDLENBQUMsQ0FBQywyQkFBMkIsQ0FBQztZQUMzRixPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQy9ILENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQWMsRUFBRSxNQUFjLEVBQUUsWUFBcUIsS0FBSztRQUM5RSxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQzlILE9BQU8sSUFBQSxxQkFBYSxFQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSTtnQkFDdEMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFLDJCQUEyQixFQUFFO2dCQUM5RSxDQUFDLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSwyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFDcEUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxTQUFTLENBQUMsTUFBYyxFQUFFLE1BQWMsRUFBRSxZQUFxQixLQUFLO1FBQzlFLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDOUgsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxJQUFJO2dCQUN0QyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUU7Z0JBQzdFLENBQUMsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLDBCQUEwQixFQUFFLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxHQUFXO1FBQ2pDLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUM5RCxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLDRCQUE0QixDQUFDLENBQUM7UUFDaEUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBVyxFQUFFLE9BQWU7UUFDaEQsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUN6RixPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLDBCQUEwQixDQUFDLENBQUM7UUFDL0gsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsR0FBVztRQUNuQyxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoRSxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLEdBQUcsRUFBRSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjLENBQUMsR0FBVztRQUNwQyxJQUFJLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBa0IsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLEdBQUcsQ0FBa0IsQ0FBQztZQUM5RyxJQUFJLFNBQVM7Z0JBQUUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFLG1DQUFtQyxDQUFDLENBQUM7WUFDbkcsT0FBTyxJQUFBLG1CQUFXLEVBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGNBQWMsQ0FBQyxHQUFXO1FBQ3BDLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFrQixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsR0FBRyxDQUFrQixDQUFDO1lBQ3pHLElBQUksSUFBSTtnQkFBRSxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxtQ0FBbUMsQ0FBQyxDQUFDO1lBQ25GLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDL0MsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBWTtRQUNwQyxJQUFJLENBQUM7WUFDRCxNQUFNLEdBQUcsR0FBa0IsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBa0IsQ0FBQztZQUN4RyxJQUFJLEdBQUc7Z0JBQUUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsa0NBQWtDLENBQUMsQ0FBQztZQUNqRixPQUFPLElBQUEsbUJBQVcsRUFBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQzlDLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQVM7UUFDbkMsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLEdBQUcsS0FBSyxFQUFFLFNBQVMsR0FBRyxLQUFLLEVBQUUsTUFBTSxHQUFHLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3RHLElBQUksQ0FBQztZQUNELE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDaEUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3BELE9BQU8sSUFBQSxtQkFBVyxFQUFDLHlCQUF5QixlQUFlLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztZQUN6RSxDQUFDO1lBQ0QsTUFBTSxTQUFTLEdBQUcsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFlLENBQUM7WUFDdkQsTUFBTSxhQUFhLEdBQVUsRUFBRSxDQUFDO1lBQ2hDLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sT0FBTyxHQUFHLFVBQVU7b0JBQ3RCLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUk7b0JBQ3JCLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztnQkFDNUQsSUFBSSxPQUFPLEVBQUUsQ0FBQztvQkFDVixJQUFJLENBQUM7d0JBQ0QsTUFBTSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDekQsYUFBYSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUMsaUNBQU0sS0FBSyxLQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsSUFBSSxJQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDaEcsQ0FBQztvQkFBQyxXQUFNLENBQUM7d0JBQ0wsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDOUIsQ0FBQztvQkFDRCxJQUFJLGFBQWEsQ0FBQyxNQUFNLElBQUksVUFBVTt3QkFBRSxNQUFNO2dCQUNsRCxDQUFDO1lBQ0wsQ0FBQztZQUNELE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixVQUFVLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsTUFBTTtnQkFDL0MsVUFBVSxFQUFFLGFBQWEsQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxhQUFhO2FBQ3RFLEVBQUUsU0FBUyxhQUFhLENBQUMsTUFBTSxxQkFBcUIsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLElBQUEsbUJBQVcsRUFBQyx3QkFBd0IsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDaEUsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLFNBQWlCLEVBQUUsbUJBQTRCLElBQUk7UUFDN0UsSUFBSSxDQUFDO1lBQ0QsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzNELElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTztnQkFBRSxPQUFPLGVBQWUsQ0FBQztZQUNyRCxNQUFNLFNBQVMsR0FBRyxlQUFlLENBQUMsSUFBSSxDQUFDO1lBQ3ZDLE1BQU0sWUFBWSxtQ0FBYSxTQUFTLEtBQUUsU0FBUyxFQUFFLEVBQUUsR0FBRSxDQUFDO1lBQzFELElBQUksZ0JBQWdCLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ2hDLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxlQUFlLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxvQ0FBb0MsQ0FBQyxFQUFFLENBQUM7b0JBQzlGLE1BQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7b0JBQ2hDLE1BQU0saUJBQWlCLEdBQUc7d0JBQ3RCLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsR0FBRyxRQUFRLFFBQVEsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFO3dCQUNwRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEdBQUcsUUFBUSxRQUFRLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRTt3QkFDaEUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxHQUFHLFFBQVEsUUFBUSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUU7cUJBQ3JFLENBQUM7b0JBQ0YsS0FBSyxNQUFNLFFBQVEsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO3dCQUN2QyxJQUFJLENBQUM7NEJBQ0QsTUFBTSxXQUFXLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQzs0QkFDekYsSUFBSSxXQUFXLEVBQUUsQ0FBQztnQ0FDZCxZQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDOzRCQUN6SCxDQUFDO3dCQUNMLENBQUM7d0JBQUMsUUFBUSxtQ0FBbUMsSUFBckMsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7b0JBQ25ELENBQUM7Z0JBQ0wsQ0FBQztZQUNMLENBQUM7WUFDRCxPQUFPLElBQUEscUJBQWEsa0JBQUcsU0FBUyxFQUFFLGdCQUFnQixJQUFLLFlBQVksR0FBSSxrQ0FBa0MsWUFBWSxDQUFDLFNBQVMsQ0FBQyxNQUFNLGNBQWMsQ0FBQyxDQUFDO1FBQzFKLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGdDQUFnQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDO0lBQ0wsQ0FBQztJQUVELDZFQUE2RTtJQUVyRSxLQUFLLENBQUMsYUFBYSxDQUFDLFNBQWlCLEVBQUUsT0FBZTtRQUMxRCxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDcEcsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxJQUFJLEVBQUUsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEdBQUcsRUFBRSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDcEcsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxHQUFXO1FBQzFDLElBQUksQ0FBQztZQUNELE1BQU0sWUFBWSxHQUFXLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLHdCQUF3QixFQUFFLEdBQUcsQ0FBVyxDQUFDO1lBQy9HLE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixXQUFXLEVBQUUsR0FBRyxFQUFFLFlBQVk7Z0JBQzlCLE9BQU8sRUFBRSxZQUFZLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsNkJBQTZCO2FBQ3JGLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCO1FBQzNCLElBQUksQ0FBQztZQUNELE1BQU0sS0FBSyxHQUFZLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBWSxDQUFDO1lBQzFGLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQyw2QkFBNkIsRUFBRSxDQUFDLENBQUM7UUFDaEgsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxTQUFpQjtRQUM3QyxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDbEUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLG9DQUFvQyxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFTO1FBQ3JDLElBQUksQ0FBQztZQUNELE1BQU0sU0FBUyxHQUFZLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssTUFBTSxDQUFDO1lBQ2hGLE1BQU0sU0FBUyxHQUFZLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssTUFBTSxDQUFDO1lBQ2hGLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsZUFBZSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7Z0JBQ2pELE9BQU8sSUFBQSxtQkFBVyxFQUFDLHVGQUF1RixDQUFDLENBQUM7WUFDaEgsQ0FBQztZQUNELElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUM7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsaUNBQWlDLENBQUMsQ0FBQztZQUNoRyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLEVBQUUsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUNqRyxNQUFNLGFBQWEsR0FBVSxFQUFFLENBQUM7WUFDaEMsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQ3JCLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztZQUNuQixLQUFLLE1BQU0sUUFBUSxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUMzQixJQUFJLENBQUM7b0JBQ0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDekMsTUFBTSxVQUFVLEdBQUcsR0FBRyxJQUFJLENBQUMsZUFBZSxJQUFJLFFBQVEsRUFBRSxDQUFDO29CQUN6RCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO29CQUNqSSxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFHLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxJQUFJLEVBQUUsQ0FBQyxDQUFDO29CQUN6RyxZQUFZLEVBQUUsQ0FBQztnQkFDbkIsQ0FBQztnQkFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO29CQUNoQixhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztvQkFDN0UsVUFBVSxFQUFFLENBQUM7Z0JBQ2pCLENBQUM7WUFDTCxDQUFDO1lBQ0QsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsRUFDL0YsMkJBQTJCLFlBQVksYUFBYSxVQUFVLFNBQVMsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxPQUFlLEVBQUUsVUFBb0IsRUFBRSxTQUFrQjtRQUNuRixNQUFNLEtBQUssR0FBYSxFQUFFLENBQUM7UUFDM0IsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0QyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzFDLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbkMsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztnQkFDaEIsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUM7b0JBQ3BHLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3pCLENBQUM7WUFDTCxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLFNBQVMsRUFBRSxDQUFDO2dCQUN6QyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztZQUMvRSxDQUFDO1FBQ0wsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBYztRQUMxQyxJQUFJLENBQUM7WUFDRCxNQUFNLGFBQWEsR0FBVSxFQUFFLENBQUM7WUFDaEMsSUFBSSxZQUFZLEdBQUcsQ0FBQyxDQUFDO1lBQ3JCLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztZQUNuQixLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUNyQixJQUFJLENBQUM7b0JBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUM5RCxhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO29CQUMzQyxZQUFZLEVBQUUsQ0FBQztnQkFDbkIsQ0FBQztnQkFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO29CQUNoQixhQUFhLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO29CQUNoRSxVQUFVLEVBQUUsQ0FBQztnQkFDakIsQ0FBQztZQUNMLENBQUM7WUFDRCxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxFQUMvRiwyQkFBMkIsWUFBWSxhQUFhLFVBQVUsU0FBUyxDQUFDLENBQUM7UUFDakYsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxZQUFvQixhQUFhO1FBQ25FLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFVLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxFQUFFLE9BQU8sRUFBRSxHQUFHLFNBQVMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNqSCxNQUFNLGdCQUFnQixHQUFVLEVBQUUsQ0FBQztZQUNuQyxNQUFNLGVBQWUsR0FBVSxFQUFFLENBQUM7WUFDbEMsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDekIsSUFBSSxDQUFDO29CQUNELE1BQU0sU0FBUyxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDMUYsSUFBSSxTQUFTO3dCQUFFLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQ2hHLENBQUM7Z0JBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztvQkFDWCxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLEVBQUcsR0FBYSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7Z0JBQ2pILENBQUM7WUFDTCxDQUFDO1lBQ0QsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLFNBQVMsRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLE1BQU07Z0JBQ3JDLGVBQWUsRUFBRSxlQUFlLENBQUMsTUFBTSxFQUFFLGdCQUFnQixFQUFFLGdCQUFnQixDQUFDLE1BQU07Z0JBQ2xGLFlBQVksRUFBRSxnQkFBZ0I7YUFDakMsRUFBRSx5QkFBeUIsZ0JBQWdCLENBQUMsTUFBTSwwQkFBMEIsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9CLENBQUMsVUFBa0IsRUFBRSxhQUFxQixjQUFjO1FBQ3RGLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHFLQUFxSyxDQUFDLENBQUM7SUFDOUwsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlLENBQUMsYUFBcUIsYUFBYSxFQUFFLHNCQUFnQyxFQUFFO1FBQ2hHLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHlNQUF5TSxDQUFDLENBQUM7SUFDbE8sQ0FBQztJQUVPLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxZQUFvQixhQUFhLEVBQUUsU0FBaUIsTUFBTSxFQUFFLGtCQUEyQixJQUFJO1FBQ3pILElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFVLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxFQUFFLE9BQU8sRUFBRSxHQUFHLFNBQVMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNqSCxNQUFNLFFBQVEsR0FBVSxFQUFFLENBQUM7WUFDM0IsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztnQkFDekIsTUFBTSxhQUFhLEdBQVE7b0JBQ3ZCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtvQkFDbEQsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFHLEtBQWEsQ0FBQyxJQUFJLElBQUksQ0FBQyxFQUFFLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVyxJQUFJLEtBQUs7aUJBQzVGLENBQUM7Z0JBQ0YsSUFBSSxlQUFlLEVBQUUsQ0FBQztvQkFDbEIsSUFBSSxDQUFDO3dCQUNELE1BQU0sU0FBUyxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGtCQUFrQixFQUFFLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDL0YsSUFBSSxTQUFTLElBQUksU0FBUyxDQUFDLElBQUk7NEJBQUUsYUFBYSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO29CQUN6RSxDQUFDO29CQUFDLFFBQVEsb0NBQW9DLElBQXRDLENBQUMsQ0FBQyxvQ0FBb0MsQ0FBQyxDQUFDO2dCQUNwRCxDQUFDO2dCQUNELFFBQVEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakMsQ0FBQztZQUNELElBQUksVUFBa0IsQ0FBQztZQUN2QixRQUFRLE1BQU0sRUFBRSxDQUFDO2dCQUNiLEtBQUssS0FBSztvQkFBRSxVQUFVLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFBQyxNQUFNO2dCQUM1RCxLQUFLLEtBQUs7b0JBQUUsVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQUMsTUFBTTtnQkFDNUQsT0FBTyxDQUFDLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM1RCxDQUFDO1lBQ0QsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQzFHLGdDQUFnQyxRQUFRLENBQUMsTUFBTSxTQUFTLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sWUFBWSxDQUFDLElBQVc7UUFDNUIsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUNqQyxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLEtBQUssTUFBTSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7WUFDckIsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtnQkFDaEMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMxQixNQUFNLEdBQUcsR0FBRyxPQUFPLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDOUUsT0FBTyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDL0IsQ0FBQyxDQUFDLENBQUM7WUFDSCxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBQ0QsT0FBTyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFTyxZQUFZLENBQUMsSUFBVztRQUM1QixJQUFJLEdBQUcsR0FBRyxvREFBb0QsQ0FBQztRQUMvRCxLQUFLLE1BQU0sSUFBSSxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ3RCLEdBQUcsSUFBSSxhQUFhLENBQUM7WUFDckIsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDOUMsTUFBTSxRQUFRLEdBQUcsT0FBTyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUM7b0JBQ3hDLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztvQkFDdkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUNyRixHQUFHLElBQUksUUFBUSxHQUFHLElBQUksUUFBUSxLQUFLLEdBQUcsS0FBSyxDQUFDO1lBQ2hELENBQUM7WUFDRCxHQUFHLElBQUksY0FBYyxDQUFDO1FBQzFCLENBQUM7UUFDRCxHQUFHLElBQUksV0FBVyxDQUFDO1FBQ25CLE9BQU8sR0FBRyxDQUFDO0lBQ2YsQ0FBQztDQUNKO0FBamhCRCxrQ0FpaEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgYXNzZXRTdGF0c0hlbHBlcnMgZnJvbSAnLi9tYW5hZ2UtYXNzZXQtc3RhdHMtaGVscGVycyc7XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBwYXRoIGlzIHNhZmUgZm9yIGFzc2V0IG9wZXJhdGlvbnMuXG4gKiBSZWplY3RzIHRyYXZlcnNhbCBwYXR0ZXJucyBhbmQgYmFyZSBhYnNvbHV0ZSBwYXRocyAobm9uLWRiOi8vIGZvcm0pLlxuICovXG5mdW5jdGlvbiB2YWxpZGF0ZUFzc2V0UGF0aChhc3NldFBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIGlmICghYXNzZXRQYXRoIHx8IHR5cGVvZiBhc3NldFBhdGggIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XG4gICAgLy8gQWxsb3cgZGI6Ly8gcHJvdG9jb2wgcGF0aHMgKENvY29zIGFzc2V0IERCIGZvcm1hdClcbiAgICBpZiAoYXNzZXRQYXRoLnN0YXJ0c1dpdGgoJ2RiOi8vJykpIHJldHVybiB0cnVlO1xuICAgIC8vIFJlamVjdCB0cmF2ZXJzYWwgcGF0dGVybnMgaW4gYW55IGZvcm1cbiAgICBpZiAoYXNzZXRQYXRoLmluY2x1ZGVzKCcuLicpIHx8IGFzc2V0UGF0aC5zdGFydHNXaXRoKCcvJykgfHwgYXNzZXRQYXRoLmluY2x1ZGVzKCdcXFxcLi4nKSkgcmV0dXJuIGZhbHNlO1xuICAgIC8vIE11c3Qgc3RhcnQgd2l0aCBhc3NldHMvIGZvciByZWxhdGl2ZSBwYXRoc1xuICAgIHJldHVybiBhc3NldFBhdGguc3RhcnRzV2l0aCgnYXNzZXRzLycpO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVDc3ZGaWVsZChmaWVsZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIGZpZWxkICE9PSAnc3RyaW5nJykgcmV0dXJuIFN0cmluZyhmaWVsZCk7XG4gICAgLy8gRXNjYXBlIGZvcm11bGEgaW5qZWN0aW9uIHByZWZpeGVzXG4gICAgaWYgKC9eWz0rXFwtQFxcdFxccl0vLnRlc3QoZmllbGQpKSBmaWVsZCA9IFwiJ1wiICsgZmllbGQ7XG4gICAgLy8gV3JhcCBpbiBxdW90ZXMgaWYgY29udGFpbnMgY29tbWEsIHF1b3RlIG9yIG5ld2xpbmVcbiAgICBpZiAoZmllbGQuaW5jbHVkZXMoJywnKSB8fCBmaWVsZC5pbmNsdWRlcygnXCInKSB8fCBmaWVsZC5pbmNsdWRlcygnXFxuJykpIHtcbiAgICAgICAgcmV0dXJuICdcIicgKyBmaWVsZC5yZXBsYWNlKC9cIi9nLCAnXCJcIicpICsgJ1wiJztcbiAgICB9XG4gICAgcmV0dXJuIGZpZWxkO1xufVxuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBhc3NldCBtYW5hZ2VtZW50IHRvb2wuXG4gKiBDb21iaW5lcyBQcm9qZWN0VG9vbHMgKGFzc2V0IG1ldGhvZHMpICsgQXNzZXRBZHZhbmNlZFRvb2xzIGludG8gb25lIGFjdGlvbi1iYXNlZCB0b29sLlxuICovXG5leHBvcnQgY2xhc3MgTWFuYWdlQXNzZXQgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfYXNzZXQnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBhc3NldHMgaW4gdGhlIHByb2plY3QgKGZpbGVzLCB0ZXh0dXJlcywgc2NyaXB0cywgZXRjKS4gQWN0aW9uczogaW1wb3J0LCBnZXRfaW5mbywgbGlzdCwgcmVmcmVzaCwgY3JlYXRlLCBjb3B5LCBtb3ZlLCBkZWxldGUsIHNhdmUsIHJlaW1wb3J0LCBxdWVyeV9wYXRoLCBxdWVyeV91dWlkLCBxdWVyeV91cmwsIGZpbmRfYnlfbmFtZSwgZ2V0X2RldGFpbHMsIHNhdmVfbWV0YSwgZ2VuZXJhdGVfdXJsLCBxdWVyeV9kYl9yZWFkeSwgb3Blbl9leHRlcm5hbCwgYmF0Y2hfaW1wb3J0LCBiYXRjaF9kZWxldGUsIHZhbGlkYXRlX3JlZmVyZW5jZXMsIGdldF9kZXBlbmRlbmNpZXMsIGdldF91bnVzZWQsIGNvbXByZXNzX3RleHR1cmVzLCBleHBvcnRfbWFuaWZlc3QsIGdldF9hdWRpb19zdGF0cywgZ2V0X3RleHR1cmVfc3RhdHMsIHVwZGF0ZV9tZXRhLiBOT1QgZm9yIHNjZW5lIG5vZGVzIOKAlCB1c2UgbWFuYWdlX25vZGUuIFVzZSBxdWVyeV9kYl9yZWFkeSB0byBjaGVjayBhc3NldCBEQiBiZWZvcmUgYmF0Y2ggb3BzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFtcbiAgICAgICAgJ2ltcG9ydCcsICdnZXRfaW5mbycsICdsaXN0JywgJ3JlZnJlc2gnLCAnY3JlYXRlJywgJ2NvcHknLCAnbW92ZScsICdkZWxldGUnLFxuICAgICAgICAnc2F2ZScsICdyZWltcG9ydCcsICdxdWVyeV9wYXRoJywgJ3F1ZXJ5X3V1aWQnLCAncXVlcnlfdXJsJywgJ2ZpbmRfYnlfbmFtZScsXG4gICAgICAgICdnZXRfZGV0YWlscycsICdzYXZlX21ldGEnLCAnZ2VuZXJhdGVfdXJsJywgJ3F1ZXJ5X2RiX3JlYWR5JywgJ29wZW5fZXh0ZXJuYWwnLFxuICAgICAgICAnYmF0Y2hfaW1wb3J0JywgJ2JhdGNoX2RlbGV0ZScsICd2YWxpZGF0ZV9yZWZlcmVuY2VzJywgJ2dldF9kZXBlbmRlbmNpZXMnLFxuICAgICAgICAnZ2V0X3VudXNlZCcsICdjb21wcmVzc190ZXh0dXJlcycsICdleHBvcnRfbWFuaWZlc3QnLFxuICAgICAgICAnZ2V0X2F1ZGlvX3N0YXRzJywgJ2dldF90ZXh0dXJlX3N0YXRzJywgJ3VwZGF0ZV9tZXRhJ1xuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9uc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNvdXJjZVBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnU291cmNlIGZpbGUgcGF0aCBvbiBkaXNrIChmb3IgaW1wb3J0KScgfSxcbiAgICAgICAgICAgIHRhcmdldEZvbGRlcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgZm9sZGVyIFVSTCAoZm9yIGltcG9ydCknIH0sXG4gICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgcGF0aCAoZGI6Ly9hc3NldHMvLi4uKScgfSxcbiAgICAgICAgICAgIHVybE9yVVVJRDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgb3IgVVVJRCcgfSxcbiAgICAgICAgICAgIHVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgKGRiOi8vYXNzZXRzLy4uLiknIH0sXG4gICAgICAgICAgICB1dWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVVSUQnIH0sXG4gICAgICAgICAgICBjb250ZW50OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZpbGUgY29udGVudCBvciBtZXRhIGNvbnRlbnQnIH0sXG4gICAgICAgICAgICBvdmVyd3JpdGU6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ092ZXJ3cml0ZSBleGlzdGluZyBmaWxlJywgZGVmYXVsdDogZmFsc2UgfSxcbiAgICAgICAgICAgIHNvdXJjZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgYXNzZXQgVVJMIChmb3IgY29weS9tb3ZlKScgfSxcbiAgICAgICAgICAgIHRhcmdldDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgYXNzZXQgVVJMIChmb3IgY29weS9tb3ZlKScgfSxcbiAgICAgICAgICAgIGZvbGRlcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdGb2xkZXIgdG8gc2VhcmNoL2xpc3QnLCBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnIH0sXG4gICAgICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCB0eXBlIGZpbHRlcicsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IG5hbWUgdG8gc2VhcmNoIGZvcicgfSxcbiAgICAgICAgICAgIGV4YWN0TWF0Y2g6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0V4YWN0IG5hbWUgbWF0Y2gnLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgYXNzZXRUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGaWx0ZXIgYnkgYXNzZXQgdHlwZScsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJywgJ3Nwcml0ZUZyYW1lJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhSZXN1bHRzOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ01heCByZXN1bHRzIGZvciBmaW5kX2J5X25hbWUnLCBkZWZhdWx0OiAyMCwgbWluaW11bTogMSwgbWF4aW11bTogMTAwIH0sXG4gICAgICAgICAgICBpbmNsdWRlU3ViQXNzZXRzOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdJbmNsdWRlIHN1Yi1hc3NldHMgKHNwcml0ZUZyYW1lLCB0ZXh0dXJlKScsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgICAgIHNvdXJjZURpcmVjdG9yeTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgZGlyZWN0b3J5IGZvciBiYXRjaF9pbXBvcnQnIH0sXG4gICAgICAgICAgICB0YXJnZXREaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGRpcmVjdG9yeSBVUkwgZm9yIGJhdGNoX2ltcG9ydCcgfSxcbiAgICAgICAgICAgIGZpbGVGaWx0ZXI6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdGaWxlIGV4dGVuc2lvbnMgZmlsdGVyJywgZGVmYXVsdDogW10gfSxcbiAgICAgICAgICAgIHJlY3Vyc2l2ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBzdWJkaXJlY3RvcmllcycsIGRlZmF1bHQ6IGZhbHNlIH0sXG4gICAgICAgICAgICB1cmxzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnQXJyYXkgb2YgYXNzZXQgVVJMcyBmb3IgYmF0Y2hfZGVsZXRlJyB9LFxuICAgICAgICAgICAgZGlyZWN0b3J5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0RpcmVjdG9yeSB0byBzY2FuJywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJyB9LFxuICAgICAgICAgICAgZXhjbHVkZURpcmVjdG9yaWVzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnRGlyZWN0b3JpZXMgdG8gZXhjbHVkZScsIGRlZmF1bHQ6IFtdIH0sXG4gICAgICAgICAgICBkaXJlY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlcGVuZGVuY3kgZGlyZWN0aW9uJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlcGVuZGVudHMnLCAnZGVwZW5kZW5jaWVzJywgJ2JvdGgnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGVwZW5kZW5jaWVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvcm1hdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRm9ybWF0IGZvciBjb21wcmVzc190ZXh0dXJlcyBvciBleHBvcnRfbWFuaWZlc3QnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYXV0bycsICdqcGcnLCAncG5nJywgJ3dlYnAnLCAnanNvbicsICdjc3YnLCAneG1sJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2F1dG8nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcXVhbGl0eTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdDb21wcmVzc2lvbiBxdWFsaXR5ICgwLjEtMS4wKScsIG1pbmltdW06IDAuMSwgbWF4aW11bTogMS4wLCBkZWZhdWx0OiAwLjggfSxcbiAgICAgICAgICAgIGluY2x1ZGVNZXRhZGF0YTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBhc3NldCBtZXRhZGF0YSBpbiBtYW5pZmVzdCcsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgICAgIG1ldGFEYXRhOiB7IHR5cGU6ICdvYmplY3QnLCBkZXNjcmlwdGlvbjogJ01ldGEgcHJvcGVydGllcyB0byBkZWVwLW1lcmdlIChmb3IgdXBkYXRlX21ldGEpJyB9LFxuICAgICAgICAgICAgcHJlc2V0SWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGV4dHVyZSBjb21wcmVzc2lvbiBwcmVzZXQgSUQgZnJvbSBidWlsZGVyLmpzb24gKGZvciBjb21wcmVzc190ZXh0dXJlcyknIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGltcG9ydDogKGFyZ3MpID0+IHRoaXMuaW1wb3J0QXNzZXQoYXJncy5zb3VyY2VQYXRoLCBhcmdzLnRhcmdldEZvbGRlciksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRBc3NldEluZm8oYXJncy5hc3NldFBhdGggfHwgYXJncy51cmxPclVVSUQpLFxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5nZXRBc3NldHMoYXJncy50eXBlLCBhcmdzLmZvbGRlciksXG4gICAgICAgIHJlZnJlc2g6IChhcmdzKSA9PiB0aGlzLnJlZnJlc2hBc3NldHMoYXJncy5mb2xkZXIpLFxuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmNyZWF0ZUFzc2V0KGFyZ3MudXJsLCBhcmdzLmNvbnRlbnQgPz8gbnVsbCwgYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJyksXG4gICAgICAgIGNvcHk6IChhcmdzKSA9PiB0aGlzLmNvcHlBc3NldChhcmdzLnNvdXJjZSwgYXJncy50YXJnZXQsIGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZScpLFxuICAgICAgICBtb3ZlOiAoYXJncykgPT4gdGhpcy5tb3ZlQXNzZXQoYXJncy5zb3VyY2UsIGFyZ3MudGFyZ2V0LCBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnKSxcbiAgICAgICAgZGVsZXRlOiAoYXJncykgPT4gdGhpcy5kZWxldGVBc3NldChhcmdzLnVybCksXG4gICAgICAgIHNhdmU6IChhcmdzKSA9PiB0aGlzLnNhdmVBc3NldChhcmdzLnVybCB8fCBhcmdzLnVybE9yVVVJRCwgYXJncy5jb250ZW50KSxcbiAgICAgICAgcmVpbXBvcnQ6IChhcmdzKSA9PiB0aGlzLnJlaW1wb3J0QXNzZXQoYXJncy51cmwgfHwgYXJncy51cmxPclVVSUQpLFxuICAgICAgICBxdWVyeV9wYXRoOiAoYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0UGF0aChhcmdzLnVybCB8fCBhcmdzLnVybE9yVVVJRCksXG4gICAgICAgIHF1ZXJ5X3V1aWQ6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRVdWlkKGFyZ3MudXJsKSxcbiAgICAgICAgcXVlcnlfdXJsOiAoYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0VXJsKGFyZ3MudXVpZCksXG4gICAgICAgIGZpbmRfYnlfbmFtZTogKGFyZ3MpID0+IHRoaXMuZmluZEFzc2V0QnlOYW1lKGFyZ3MpLFxuICAgICAgICBnZXRfZGV0YWlsczogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXREZXRhaWxzKGFyZ3MuYXNzZXRQYXRoIHx8IGFyZ3MudXJsT3JVVUlELCBhcmdzLmluY2x1ZGVTdWJBc3NldHMgIT09IGZhbHNlKSxcbiAgICAgICAgc2F2ZV9tZXRhOiAoYXJncykgPT4gdGhpcy5zYXZlQXNzZXRNZXRhKGFyZ3MudXJsT3JVVUlELCBhcmdzLmNvbnRlbnQpLFxuICAgICAgICBnZW5lcmF0ZV91cmw6IChhcmdzKSA9PiB0aGlzLmdlbmVyYXRlQXZhaWxhYmxlVXJsKGFyZ3MudXJsKSxcbiAgICAgICAgcXVlcnlfZGJfcmVhZHk6IChfYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0RGJSZWFkeSgpLFxuICAgICAgICBvcGVuX2V4dGVybmFsOiAoYXJncykgPT4gdGhpcy5vcGVuQXNzZXRFeHRlcm5hbChhcmdzLnVybE9yVVVJRCksXG4gICAgICAgIGJhdGNoX2ltcG9ydDogKGFyZ3MpID0+IHRoaXMuYmF0Y2hJbXBvcnRBc3NldHMoYXJncyksXG4gICAgICAgIGJhdGNoX2RlbGV0ZTogKGFyZ3MpID0+IHRoaXMuYmF0Y2hEZWxldGVBc3NldHMoYXJncy51cmxzKSxcbiAgICAgICAgdmFsaWRhdGVfcmVmZXJlbmNlczogKGFyZ3MpID0+IHRoaXMudmFsaWRhdGVBc3NldFJlZmVyZW5jZXMoYXJncy5kaXJlY3RvcnkpLFxuICAgICAgICBnZXRfZGVwZW5kZW5jaWVzOiAoYXJncykgPT4gdGhpcy5nZXRBc3NldERlcGVuZGVuY2llcyhhcmdzLnVybE9yVVVJRCwgYXJncy5kaXJlY3Rpb24pLFxuICAgICAgICBnZXRfdW51c2VkOiAoYXJncykgPT4gdGhpcy5nZXRVbnVzZWRBc3NldHMoYXJncy5kaXJlY3RvcnksIGFyZ3MuZXhjbHVkZURpcmVjdG9yaWVzKSxcbiAgICAgICAgY29tcHJlc3NfdGV4dHVyZXM6IChhcmdzKSA9PiBhc3NldFN0YXRzSGVscGVycy5jb21wcmVzc1RleHR1cmVzKGFyZ3MuZGlyZWN0b3J5LCBhcmdzLnByZXNldElkLCBhcmdzLnF1YWxpdHkpLFxuICAgICAgICBleHBvcnRfbWFuaWZlc3Q6IChhcmdzKSA9PiB0aGlzLmV4cG9ydEFzc2V0TWFuaWZlc3QoYXJncy5kaXJlY3RvcnksIGFyZ3MuZm9ybWF0LCBhcmdzLmluY2x1ZGVNZXRhZGF0YSAhPT0gZmFsc2UpLFxuICAgICAgICBnZXRfYXVkaW9fc3RhdHM6IChhcmdzKSA9PiBhc3NldFN0YXRzSGVscGVycy5nZXRBdWRpb1N0YXRzKGFyZ3MuZGlyZWN0b3J5KSxcbiAgICAgICAgZ2V0X3RleHR1cmVfc3RhdHM6IChhcmdzKSA9PiBhc3NldFN0YXRzSGVscGVycy5nZXRUZXh0dXJlU3RhdHMoYXJncy5kaXJlY3RvcnkpLFxuICAgICAgICB1cGRhdGVfbWV0YTogKGFyZ3MpID0+IGFzc2V0U3RhdHNIZWxwZXJzLnVwZGF0ZU1ldGEoYXJncy5hc3NldFBhdGgsIGFyZ3MubWV0YURhdGEpXG4gICAgfTtcblxuICAgIC8vIOKUgOKUgCBGcm9tIFByb2plY3RUb29scyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIHByaXZhdGUgYXN5bmMgaW1wb3J0QXNzZXQoc291cmNlUGF0aDogc3RyaW5nLCB0YXJnZXRGb2xkZXI6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoc291cmNlUGF0aCkpIHJldHVybiBlcnJvclJlc3VsdCgnU291cmNlIGZpbGUgbm90IGZvdW5kJyk7XG4gICAgICAgIGlmICghdmFsaWRhdGVBc3NldFBhdGgodGFyZ2V0Rm9sZGVyKSkgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIHRhcmdldCBmb2xkZXIgcGF0aDogbXVzdCBiZSBkYjovLyBVUkwgb3IgYXNzZXRzLyByZWxhdGl2ZSBwYXRoIHdpdGhvdXQgdHJhdmVyc2FsJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoc291cmNlUGF0aCk7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gdGFyZ2V0Rm9sZGVyLnN0YXJ0c1dpdGgoJ2RiOi8vJykgPyB0YXJnZXRGb2xkZXIgOiBgZGI6Ly9hc3NldHMvJHt0YXJnZXRGb2xkZXJ9YDtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0Jywgc291cmNlUGF0aCwgYCR7dGFyZ2V0UGF0aH0vJHtmaWxlTmFtZX1gKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXVpZDogcmVzdWx0LnV1aWQsIHBhdGg6IHJlc3VsdC51cmwsIG1lc3NhZ2U6IGBBc3NldCBpbXBvcnRlZDogJHtmaWxlTmFtZX1gIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXRJbmZvKGFzc2V0UGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhc3NldFBhdGgpO1xuICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgbm90IGZvdW5kJyk7XG4gICAgICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXRJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgdXVpZDogYXNzZXRJbmZvLnV1aWQsXG4gICAgICAgICAgICAgICAgcGF0aDogYXNzZXRJbmZvLnVybCxcbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldEluZm8udHlwZSxcbiAgICAgICAgICAgICAgICBzaXplOiBhc3NldEluZm8uc2l6ZSxcbiAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogYXNzZXRJbmZvLmlzRGlyZWN0b3J5XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKGFzc2V0SW5mby5tZXRhKSB7XG4gICAgICAgICAgICAgICAgaW5mby5tZXRhID0geyB2ZXI6IGFzc2V0SW5mby5tZXRhLnZlciwgaW1wb3J0ZXI6IGFzc2V0SW5mby5tZXRhLmltcG9ydGVyIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0cyh0eXBlOiBzdHJpbmcgPSAnYWxsJywgZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgcGF0dGVybiA9IGAke2ZvbGRlcn0vKiovKmA7XG4gICAgICAgICAgICBpZiAodHlwZSAhPT0gJ2FsbCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlRXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICAgICAgJ3NjZW5lJzogJy5zY2VuZScsICdwcmVmYWInOiAnLnByZWZhYicsICdzY3JpcHQnOiAnLnt0cyxqc30nLFxuICAgICAgICAgICAgICAgICAgICAndGV4dHVyZSc6ICcue3BuZyxqcGcsanBlZyxnaWYsdGdhLGJtcCxwc2R9JywgJ21hdGVyaWFsJzogJy5tdGwnLFxuICAgICAgICAgICAgICAgICAgICAnbWVzaCc6ICcue2ZieCxvYmosZGFlfScsICdhdWRpbyc6ICcue21wMyxvZ2csd2F2LG00YX0nLCAnYW5pbWF0aW9uJzogJy57YW5pbSxjbGlwfSdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHR5cGVFeHRlbnNpb25zW3R5cGVdO1xuICAgICAgICAgICAgICAgIGlmIChleHRlbnNpb24pIHBhdHRlcm4gPSBgJHtmb2xkZXJ9LyoqLyoke2V4dGVuc2lvbn1gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHV1aWQ6IGFzc2V0LnV1aWQsIHBhdGg6IGFzc2V0LnVybCxcbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldC50eXBlLCBzaXplOiBhc3NldC5zaXplIHx8IDAsIGlzRGlyZWN0b3J5OiBhc3NldC5pc0RpcmVjdG9yeSB8fCBmYWxzZVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlLCBmb2xkZXIsIGNvdW50OiBhc3NldHMubGVuZ3RoLCBhc3NldHMgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWZyZXNoQXNzZXRzKGZvbGRlcj86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGRlciB8fCAnZGI6Ly9hc3NldHMnO1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVmcmVzaC1hc3NldCcsIHRhcmdldFBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgYEFzc2V0cyByZWZyZXNoZWQgaW46ICR7dGFyZ2V0UGF0aH1gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUFzc2V0KHVybDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcgfCBudWxsID0gbnVsbCwgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH07XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIHVybCwgY29udGVudCwgb3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCBtc2cgPSBjb250ZW50ID09PSBudWxsID8gJ0ZvbGRlciBjcmVhdGVkIHN1Y2Nlc3NmdWxseScgOiAnRmlsZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseSc7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQgJiYgcmVzdWx0LnV1aWQgPyB7IHV1aWQ6IHJlc3VsdC51dWlkLCB1cmw6IHJlc3VsdC51cmwsIG1lc3NhZ2U6IG1zZyB9IDogeyB1cmwsIG1lc3NhZ2U6IG1zZyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvcHlBc3NldChzb3VyY2U6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NvcHktYXNzZXQnLCBzb3VyY2UsIHRhcmdldCwgeyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZFxuICAgICAgICAgICAgICAgID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsLCBtZXNzYWdlOiAnQXNzZXQgY29waWVkIHN1Y2Nlc3NmdWxseScgfVxuICAgICAgICAgICAgICAgIDogeyBzb3VyY2UsIHRhcmdldCwgbWVzc2FnZTogJ0Fzc2V0IGNvcGllZCBzdWNjZXNzZnVsbHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbW92ZUFzc2V0KHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnbW92ZS1hc3NldCcsIHNvdXJjZSwgdGFyZ2V0LCB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkXG4gICAgICAgICAgICAgICAgPyB7IHV1aWQ6IHJlc3VsdC51dWlkLCB1cmw6IHJlc3VsdC51cmwsIG1lc3NhZ2U6ICdBc3NldCBtb3ZlZCBzdWNjZXNzZnVsbHknIH1cbiAgICAgICAgICAgICAgICA6IHsgc291cmNlLCB0YXJnZXQsIG1lc3NhZ2U6ICdBc3NldCBtb3ZlZCBzdWNjZXNzZnVsbHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZGVsZXRlQXNzZXQodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2RlbGV0ZS1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCB9LCAnQXNzZXQgZGVsZXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVBc3NldCh1cmw6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCB1cmwsIGNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsIH0gOiB7IHVybCB9LCAnQXNzZXQgc2F2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWltcG9ydEFzc2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIHVybCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybCB9LCAnQXNzZXQgcmVpbXBvcnRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXRQYXRoKHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldFBhdGg6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1wYXRoJywgdXJsKSBhcyBzdHJpbmcgfCBudWxsO1xuICAgICAgICAgICAgaWYgKGFzc2V0UGF0aCkgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmwsIHBhdGg6IGFzc2V0UGF0aCB9LCAnQXNzZXQgcGF0aCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IHBhdGggbm90IGZvdW5kJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0VXVpZCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdXVpZDogc3RyaW5nIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXV1aWQnLCB1cmwpIGFzIHN0cmluZyB8IG51bGw7XG4gICAgICAgICAgICBpZiAodXVpZCkgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmwsIHV1aWQgfSwgJ0Fzc2V0IFVVSUQgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdBc3NldCBVVUlEIG5vdCBmb3VuZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFVybCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHVybDogc3RyaW5nIHwgbnVsbCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHV1aWQpIGFzIHN0cmluZyB8IG51bGw7XG4gICAgICAgICAgICBpZiAodXJsKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQsIHVybCB9LCAnQXNzZXQgVVJMIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgVVJMIG5vdCBmb3VuZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZmluZEFzc2V0QnlOYW1lKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5hbWUsIGV4YWN0TWF0Y2ggPSBmYWxzZSwgYXNzZXRUeXBlID0gJ2FsbCcsIGZvbGRlciA9ICdkYjovL2Fzc2V0cycsIG1heFJlc3VsdHMgPSAyMCB9ID0gYXJncztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFsbEFzc2V0c1Jlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QXNzZXRzKGFzc2V0VHlwZSwgZm9sZGVyKTtcbiAgICAgICAgICAgIGlmICghYWxsQXNzZXRzUmVzdWx0LnN1Y2Nlc3MgfHwgIWFsbEFzc2V0c1Jlc3VsdC5kYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGFzc2V0czogJHthbGxBc3NldHNSZXN1bHQuZXJyb3J9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBhbGxBc3NldHMgPSBhbGxBc3NldHNSZXN1bHQuZGF0YS5hc3NldHMgYXMgYW55W107XG4gICAgICAgICAgICBjb25zdCBtYXRjaGVkQXNzZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhbGxBc3NldHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVzID0gZXhhY3RNYXRjaFxuICAgICAgICAgICAgICAgICAgICA/IGFzc2V0Lm5hbWUgPT09IG5hbWVcbiAgICAgICAgICAgICAgICAgICAgOiBhc3NldC5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV0YWlsUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldEluZm8oYXNzZXQucGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXNzZXRzLnB1c2goZGV0YWlsUmVzdWx0LnN1Y2Nlc3MgPyB7IC4uLmFzc2V0LCBkZXRhaWxzOiBkZXRhaWxSZXN1bHQuZGF0YSB9IDogYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoZWRBc3NldHMubGVuZ3RoID49IG1heFJlc3VsdHMpIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBzZWFyY2hUZXJtOiBuYW1lLCBleGFjdE1hdGNoLCBhc3NldFR5cGUsIGZvbGRlcixcbiAgICAgICAgICAgICAgICB0b3RhbEZvdW5kOiBtYXRjaGVkQXNzZXRzLmxlbmd0aCwgbWF4UmVzdWx0cywgYXNzZXRzOiBtYXRjaGVkQXNzZXRzXG4gICAgICAgICAgICB9LCBgRm91bmQgJHttYXRjaGVkQXNzZXRzLmxlbmd0aH0gYXNzZXRzIG1hdGNoaW5nICcke25hbWV9J2ApO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEFzc2V0IHNlYXJjaCBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXREZXRhaWxzKGFzc2V0UGF0aDogc3RyaW5nLCBpbmNsdWRlU3ViQXNzZXRzOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldEluZm8oYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhc3NldEluZm9SZXN1bHQ7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhc3NldEluZm9SZXN1bHQuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IGRldGFpbGVkSW5mbzogYW55ID0geyAuLi5hc3NldEluZm8sIHN1YkFzc2V0czogW10gfTtcbiAgICAgICAgICAgIGlmIChpbmNsdWRlU3ViQXNzZXRzICYmIGFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8udHlwZSA9PT0gJ2NjLkltYWdlQXNzZXQnIHx8IGFzc2V0UGF0aC5tYXRjaCgvXFwuKHBuZ3xqcGd8anBlZ3xnaWZ8dGdhfGJtcHxwc2QpJC9pKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlVXVpZCA9IGFzc2V0SW5mby51dWlkO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3NzaWJsZVN1YkFzc2V0cyA9IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3Nwcml0ZUZyYW1lJywgdXVpZDogYCR7YmFzZVV1aWR9QGY5OTQxYCwgc3VmZml4OiAnQGY5OTQxJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAndGV4dHVyZScsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3RleHR1cmUyRCcsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfVxuICAgICAgICAgICAgICAgICAgICBdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHN1YkFzc2V0IG9mIHBvc3NpYmxlU3ViQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YkFzc2V0VXJsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXJsJywgc3ViQXNzZXQudXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YkFzc2V0VXJsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbGVkSW5mby5zdWJBc3NldHMucHVzaCh7IHR5cGU6IHN1YkFzc2V0LnR5cGUsIHV1aWQ6IHN1YkFzc2V0LnV1aWQsIHVybDogc3ViQXNzZXRVcmwsIHN1ZmZpeDogc3ViQXNzZXQuc3VmZml4IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggeyAvKiBzdWItYXNzZXQgZG9lc24ndCBleGlzdCwgc2tpcCAqLyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGFzc2V0UGF0aCwgaW5jbHVkZVN1YkFzc2V0cywgLi4uZGV0YWlsZWRJbmZvIH0sIGBBc3NldCBkZXRhaWxzIHJldHJpZXZlZC4gRm91bmQgJHtkZXRhaWxlZEluZm8uc3ViQXNzZXRzLmxlbmd0aH0gc3ViLWFzc2V0cy5gKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGFzc2V0IGRldGFpbHM6ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIOKUgOKUgCBGcm9tIEFzc2V0QWR2YW5jZWRUb29scyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZUFzc2V0TWV0YSh1cmxPclVVSUQ6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIHVybE9yVVVJRCwgY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQ6IHJlc3VsdD8udXVpZCwgdXJsOiByZXN1bHQ/LnVybCB9LCAnQXNzZXQgbWV0YSBzYXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlQXZhaWxhYmxlVXJsKHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhdmFpbGFibGVVcmw6IHN0cmluZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2dlbmVyYXRlLWF2YWlsYWJsZS11cmwnLCB1cmwpIGFzIHN0cmluZztcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFVybDogdXJsLCBhdmFpbGFibGVVcmwsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYXZhaWxhYmxlVXJsID09PSB1cmwgPyAnVVJMIGlzIGF2YWlsYWJsZScgOiAnR2VuZXJhdGVkIG5ldyBhdmFpbGFibGUgVVJMJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0RGJSZWFkeSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcmVhZHknKSBhcyBib29sZWFuO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyByZWFkeSwgbWVzc2FnZTogcmVhZHkgPyAnQXNzZXQgZGF0YWJhc2UgaXMgcmVhZHknIDogJ0Fzc2V0IGRhdGFiYXNlIGlzIG5vdCByZWFkeScgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBvcGVuQXNzZXRFeHRlcm5hbCh1cmxPclVVSUQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnb3Blbi1hc3NldCcsIHVybE9yVVVJRCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnQXNzZXQgb3BlbmVkIHdpdGggZXh0ZXJuYWwgcHJvZ3JhbScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hJbXBvcnRBc3NldHMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnO1xuICAgICAgICAgICAgY29uc3QgcmVjdXJzaXZlOiBib29sZWFuID0gYXJncy5yZWN1cnNpdmUgPT09IHRydWUgfHwgYXJncy5yZWN1cnNpdmUgPT09ICd0cnVlJztcbiAgICAgICAgICAgIGlmICghdmFsaWRhdGVBc3NldFBhdGgoYXJncy50YXJnZXREaXJlY3RvcnkgfHwgJycpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIHRhcmdldERpcmVjdG9yeTogbXVzdCBiZSBkYjovLyBVUkwgb3IgYXNzZXRzLyByZWxhdGl2ZSBwYXRoIHdpdGhvdXQgdHJhdmVyc2FsJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWZzLmV4aXN0c1N5bmMoYXJncy5zb3VyY2VEaXJlY3RvcnkpKSByZXR1cm4gZXJyb3JSZXN1bHQoJ1NvdXJjZSBkaXJlY3RvcnkgZG9lcyBub3QgZXhpc3QnKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoYXJncy5zb3VyY2VEaXJlY3RvcnksIGFyZ3MuZmlsZUZpbHRlciB8fCBbXSwgcmVjdXJzaXZlKTtcbiAgICAgICAgICAgIGNvbnN0IGltcG9ydFJlc3VsdHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMDtcbiAgICAgICAgICAgIGxldCBlcnJvckNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlTmFtZSA9IHBhdGguYmFzZW5hbWUoZmlsZVBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gYCR7YXJncy50YXJnZXREaXJlY3Rvcnl9LyR7ZmlsZU5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0JywgZmlsZVBhdGgsIHRhcmdldFBhdGgsIHsgb3ZlcndyaXRlLCByZW5hbWU6ICFvdmVyd3JpdGUgfSk7XG4gICAgICAgICAgICAgICAgICAgIGltcG9ydFJlc3VsdHMucHVzaCh7IHNvdXJjZTogZmlsZVBhdGgsIHRhcmdldDogdGFyZ2V0UGF0aCwgc3VjY2VzczogdHJ1ZSwgdXVpZDogKHJlc3VsdCBhcyBhbnkpPy51dWlkIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQrKztcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBpbXBvcnRSZXN1bHRzLnB1c2goeyBzb3VyY2U6IGZpbGVQYXRoLCBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICBlcnJvckNvdW50Kys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0b3RhbEZpbGVzOiBmaWxlcy5sZW5ndGgsIHN1Y2Nlc3NDb3VudCwgZXJyb3JDb3VudCwgcmVzdWx0czogaW1wb3J0UmVzdWx0cyB9LFxuICAgICAgICAgICAgICAgIGBCYXRjaCBpbXBvcnQgY29tcGxldGVkOiAke3N1Y2Nlc3NDb3VudH0gc3VjY2VzcywgJHtlcnJvckNvdW50fSBlcnJvcnNgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGdldEZpbGVzRnJvbURpcmVjdG9yeShkaXJQYXRoOiBzdHJpbmcsIGZpbGVGaWx0ZXI6IHN0cmluZ1tdLCByZWN1cnNpdmU6IGJvb2xlYW4pOiBzdHJpbmdbXSB7XG4gICAgICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBpdGVtcyA9IGZzLnJlYWRkaXJTeW5jKGRpclBhdGgpO1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aC5qb2luKGRpclBhdGgsIGl0ZW0pO1xuICAgICAgICAgICAgY29uc3Qgc3RhdCA9IGZzLnN0YXRTeW5jKGZ1bGxQYXRoKTtcbiAgICAgICAgICAgIGlmIChzdGF0LmlzRmlsZSgpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGZpbGVGaWx0ZXIubGVuZ3RoID09PSAwIHx8IGZpbGVGaWx0ZXIuc29tZShleHQgPT4gaXRlbS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKGV4dC50b0xvd2VyQ2FzZSgpKSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZXMucHVzaChmdWxsUGF0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChzdGF0LmlzRGlyZWN0b3J5KCkgJiYgcmVjdXJzaXZlKSB7XG4gICAgICAgICAgICAgICAgZmlsZXMucHVzaCguLi50aGlzLmdldEZpbGVzRnJvbURpcmVjdG9yeShmdWxsUGF0aCwgZmlsZUZpbHRlciwgcmVjdXJzaXZlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbGVzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hEZWxldGVBc3NldHModXJsczogc3RyaW5nW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGRlbGV0ZVJlc3VsdHM6IGFueVtdID0gW107XG4gICAgICAgICAgICBsZXQgc3VjY2Vzc0NvdW50ID0gMDtcbiAgICAgICAgICAgIGxldCBlcnJvckNvdW50ID0gMDtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdXJsIG9mIHVybHMpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGVSZXN1bHRzLnB1c2goeyB1cmwsIHN1Y2Nlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudCsrO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZVJlc3VsdHMucHVzaCh7IHVybCwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JDb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdG90YWxBc3NldHM6IHVybHMubGVuZ3RoLCBzdWNjZXNzQ291bnQsIGVycm9yQ291bnQsIHJlc3VsdHM6IGRlbGV0ZVJlc3VsdHMgfSxcbiAgICAgICAgICAgICAgICBgQmF0Y2ggZGVsZXRlIGNvbXBsZXRlZDogJHtzdWNjZXNzQ291bnR9IHN1Y2Nlc3MsICR7ZXJyb3JDb3VudH0gZXJyb3JzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUFzc2V0UmVmZXJlbmNlcyhkaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm46IGAke2RpcmVjdG9yeX0vKiovKmAgfSk7XG4gICAgICAgICAgICBjb25zdCBicm9rZW5SZWZlcmVuY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgdmFsaWRSZWZlcmVuY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhc3NldHMpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXQudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0SW5mbykgdmFsaWRSZWZlcmVuY2VzLnB1c2goeyB1cmw6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCwgbmFtZTogYXNzZXQubmFtZSB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgYnJva2VuUmVmZXJlbmNlcy5wdXNoKHsgdXJsOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsIG5hbWU6IGFzc2V0Lm5hbWUsIGVycm9yOiAoZXJyIGFzIEVycm9yKS5tZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBkaXJlY3RvcnksIHRvdGFsQXNzZXRzOiBhc3NldHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHZhbGlkUmVmZXJlbmNlczogdmFsaWRSZWZlcmVuY2VzLmxlbmd0aCwgYnJva2VuUmVmZXJlbmNlczogYnJva2VuUmVmZXJlbmNlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgYnJva2VuQXNzZXRzOiBicm9rZW5SZWZlcmVuY2VzXG4gICAgICAgICAgICB9LCBgVmFsaWRhdGlvbiBjb21wbGV0ZWQ6ICR7YnJva2VuUmVmZXJlbmNlcy5sZW5ndGh9IGJyb2tlbiByZWZlcmVuY2VzIGZvdW5kYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERlcGVuZGVuY2llcyhfdXJsT3JVVUlEOiBzdHJpbmcsIF9kaXJlY3Rpb246IHN0cmluZyA9ICdkZXBlbmRlbmNpZXMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgZGVwZW5kZW5jeSBhbmFseXNpcyByZXF1aXJlcyBhZGRpdGlvbmFsIEFQSXMgbm90IGF2YWlsYWJsZSBpbiBjdXJyZW50IENvY29zIENyZWF0b3IgTUNQIGltcGxlbWVudGF0aW9uLiBDb25zaWRlciB1c2luZyB0aGUgRWRpdG9yIFVJIGZvciBkZXBlbmRlbmN5IGFuYWx5c2lzLicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0VW51c2VkQXNzZXRzKF9kaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycsIF9leGNsdWRlRGlyZWN0b3JpZXM6IHN0cmluZ1tdID0gW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdVbnVzZWQgYXNzZXQgZGV0ZWN0aW9uIHJlcXVpcmVzIGNvbXByZWhlbnNpdmUgcHJvamVjdCBhbmFseXNpcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb24uIENvbnNpZGVyIHVzaW5nIHRoZSBFZGl0b3IgVUkgb3IgdGhpcmQtcGFydHkgdG9vbHMgZm9yIHVudXNlZCBhc3NldCBkZXRlY3Rpb24uJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleHBvcnRBc3NldE1hbmlmZXN0KGRpcmVjdG9yeTogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJywgZm9ybWF0OiBzdHJpbmcgPSAnanNvbicsIGluY2x1ZGVNZXRhZGF0YTogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm46IGAke2RpcmVjdG9yeX0vKiovKmAgfSk7XG4gICAgICAgICAgICBjb25zdCBtYW5pZmVzdDogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWFuaWZlc3RFbnRyeTogYW55ID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLCB1cmw6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSwgc2l6ZTogKGFzc2V0IGFzIGFueSkuc2l6ZSB8fCAwLCBpc0RpcmVjdG9yeTogYXNzZXQuaXNEaXJlY3RvcnkgfHwgZmFsc2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlTWV0YWRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0LnVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIGFzc2V0SW5mby5tZXRhKSBtYW5pZmVzdEVudHJ5Lm1ldGEgPSBhc3NldEluZm8ubWV0YTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7IC8qIHNraXAgbWV0YWRhdGEgaWYgbm90IGF2YWlsYWJsZSAqLyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1hbmlmZXN0LnB1c2gobWFuaWZlc3RFbnRyeSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgZXhwb3J0RGF0YTogc3RyaW5nO1xuICAgICAgICAgICAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdjc3YnOiBleHBvcnREYXRhID0gdGhpcy5jb252ZXJ0VG9DU1YobWFuaWZlc3QpOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICd4bWwnOiBleHBvcnREYXRhID0gdGhpcy5jb252ZXJ0VG9YTUwobWFuaWZlc3QpOyBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBleHBvcnREYXRhID0gSlNPTi5zdHJpbmdpZnkobWFuaWZlc3QsIG51bGwsIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBkaXJlY3RvcnksIGZvcm1hdCwgYXNzZXRDb3VudDogbWFuaWZlc3QubGVuZ3RoLCBpbmNsdWRlTWV0YWRhdGEsIG1hbmlmZXN0OiBleHBvcnREYXRhIH0sXG4gICAgICAgICAgICAgICAgYEFzc2V0IG1hbmlmZXN0IGV4cG9ydGVkIHdpdGggJHttYW5pZmVzdC5sZW5ndGh9IGFzc2V0c2ApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgY29udmVydFRvQ1NWKGRhdGE6IGFueVtdKTogc3RyaW5nIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoID09PSAwKSByZXR1cm4gJyc7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBPYmplY3Qua2V5cyhkYXRhWzBdKTtcbiAgICAgICAgY29uc3QgY3N2Um93cyA9IFtoZWFkZXJzLm1hcChoID0+IGVzY2FwZUNzdkZpZWxkKGgpKS5qb2luKCcsJyldO1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiBkYXRhKSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBoZWFkZXJzLm1hcChoZWFkZXIgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcm93W2hlYWRlcl07XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RyID0gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IEpTT04uc3RyaW5naWZ5KHZhbHVlKSA6IFN0cmluZyh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVzY2FwZUNzdkZpZWxkKHN0cik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNzdlJvd3MucHVzaCh2YWx1ZXMuam9pbignLCcpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3N2Um93cy5qb2luKCdcXG4nKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNvbnZlcnRUb1hNTChkYXRhOiBhbnlbXSk6IHN0cmluZyB7XG4gICAgICAgIGxldCB4bWwgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+XFxuPGFzc2V0cz5cXG4nO1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZGF0YSkge1xuICAgICAgICAgICAgeG1sICs9ICcgIDxhc3NldD5cXG4nO1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB4bWxWYWx1ZSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSkgOlxuICAgICAgICAgICAgICAgICAgICBTdHJpbmcodmFsdWUpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbiAgICAgICAgICAgICAgICB4bWwgKz0gYCAgICA8JHtrZXl9PiR7eG1sVmFsdWV9PC8ke2tleX0+XFxuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhtbCArPSAnICA8L2Fzc2V0Plxcbic7XG4gICAgICAgIH1cbiAgICAgICAgeG1sICs9ICc8L2Fzc2V0cz4nO1xuICAgICAgICByZXR1cm4geG1sO1xuICAgIH1cbn1cbiJdfQ==