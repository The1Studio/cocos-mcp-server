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
                includeMetadata: { type: 'boolean', description: 'Include asset metadata in manifest', default: true }
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
            compress_textures: (args) => this.compressTextures(args.directory, args.format, args.quality),
            export_manifest: (args) => this.exportAssetManifest(args.directory, args.format, args.includeMetadata !== false)
        };
    }
    // ── From ProjectTools ────────────────────────────────────────────────────
    async importAsset(sourcePath, targetFolder) {
        return new Promise((resolve) => {
            if (!fs.existsSync(sourcePath)) {
                resolve((0, types_1.errorResult)('Source file not found'));
                return;
            }
            const fileName = path.basename(sourcePath);
            const targetPath = targetFolder.startsWith('db://') ?
                targetFolder : `db://assets/${targetFolder}`;
            Editor.Message.request('asset-db', 'import-asset', sourcePath, `${targetPath}/${fileName}`).then((result) => {
                resolve((0, types_1.successResult)({
                    uuid: result.uuid,
                    path: result.url,
                    message: `Asset imported: ${fileName}`
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getAssetInfo(assetPath) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-asset-info', assetPath).then((assetInfo) => {
                if (!assetInfo) {
                    resolve((0, types_1.errorResult)('Asset not found'));
                    return;
                }
                const info = {
                    name: assetInfo.name,
                    uuid: assetInfo.uuid,
                    path: assetInfo.url,
                    type: assetInfo.type,
                    size: assetInfo.size,
                    isDirectory: assetInfo.isDirectory
                };
                if (assetInfo.meta) {
                    info.meta = {
                        ver: assetInfo.meta.ver,
                        importer: assetInfo.meta.importer
                    };
                }
                resolve((0, types_1.successResult)(info));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getAssets(type = 'all', folder = 'db://assets') {
        return new Promise((resolve) => {
            let pattern = `${folder}/**/*`;
            if (type !== 'all') {
                const typeExtensions = {
                    'scene': '.scene',
                    'prefab': '.prefab',
                    'script': '.{ts,js}',
                    'texture': '.{png,jpg,jpeg,gif,tga,bmp,psd}',
                    'material': '.mtl',
                    'mesh': '.{fbx,obj,dae}',
                    'audio': '.{mp3,ogg,wav,m4a}',
                    'animation': '.{anim,clip}'
                };
                const extension = typeExtensions[type];
                if (extension) {
                    pattern = `${folder}/**/*${extension}`;
                }
            }
            Editor.Message.request('asset-db', 'query-assets', { pattern }).then((results) => {
                const assets = results.map(asset => ({
                    name: asset.name,
                    uuid: asset.uuid,
                    path: asset.url,
                    type: asset.type,
                    size: asset.size || 0,
                    isDirectory: asset.isDirectory || false
                }));
                resolve((0, types_1.successResult)({
                    type,
                    folder,
                    count: assets.length,
                    assets
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async refreshAssets(folder) {
        return new Promise((resolve) => {
            const targetPath = folder || 'db://assets';
            Editor.Message.request('asset-db', 'refresh-asset', targetPath).then(() => {
                resolve((0, types_1.successResult)(null, `Assets refreshed in: ${targetPath}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async createAsset(url, content = null, overwrite = false) {
        return new Promise((resolve) => {
            const options = {
                overwrite,
                rename: !overwrite
            };
            Editor.Message.request('asset-db', 'create-asset', url, content, options).then((result) => {
                if (result && result.uuid) {
                    resolve((0, types_1.successResult)({
                        uuid: result.uuid,
                        url: result.url,
                        message: content === null ? 'Folder created successfully' : 'File created successfully'
                    }));
                }
                else {
                    resolve((0, types_1.successResult)({
                        url,
                        message: content === null ? 'Folder created successfully' : 'File created successfully'
                    }));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async copyAsset(source, target, overwrite = false) {
        return new Promise((resolve) => {
            const options = { overwrite, rename: !overwrite };
            Editor.Message.request('asset-db', 'copy-asset', source, target, options).then((result) => {
                if (result && result.uuid) {
                    resolve((0, types_1.successResult)({
                        uuid: result.uuid,
                        url: result.url,
                        message: 'Asset copied successfully'
                    }));
                }
                else {
                    resolve((0, types_1.successResult)({
                        source,
                        target,
                        message: 'Asset copied successfully'
                    }));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async moveAsset(source, target, overwrite = false) {
        return new Promise((resolve) => {
            const options = { overwrite, rename: !overwrite };
            Editor.Message.request('asset-db', 'move-asset', source, target, options).then((result) => {
                if (result && result.uuid) {
                    resolve((0, types_1.successResult)({
                        uuid: result.uuid,
                        url: result.url,
                        message: 'Asset moved successfully'
                    }));
                }
                else {
                    resolve((0, types_1.successResult)({
                        source,
                        target,
                        message: 'Asset moved successfully'
                    }));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async deleteAsset(url) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'delete-asset', url).then(() => {
                resolve((0, types_1.successResult)({ url }, 'Asset deleted successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async saveAsset(url, content) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'save-asset', url, content).then((result) => {
                if (result && result.uuid) {
                    resolve((0, types_1.successResult)({
                        uuid: result.uuid,
                        url: result.url
                    }, 'Asset saved successfully'));
                }
                else {
                    resolve((0, types_1.successResult)({ url }, 'Asset saved successfully'));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async reimportAsset(url) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'reimport-asset', url).then(() => {
                resolve((0, types_1.successResult)({ url }, 'Asset reimported successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryAssetPath(url) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-path', url).then((assetPath) => {
                if (assetPath) {
                    resolve((0, types_1.successResult)({ url, path: assetPath }, 'Asset path retrieved successfully'));
                }
                else {
                    resolve((0, types_1.errorResult)('Asset path not found'));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryAssetUuid(url) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-uuid', url).then((uuid) => {
                if (uuid) {
                    resolve((0, types_1.successResult)({ url, uuid }, 'Asset UUID retrieved successfully'));
                }
                else {
                    resolve((0, types_1.errorResult)('Asset UUID not found'));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryAssetUrl(uuid) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-url', uuid).then((url) => {
                if (url) {
                    resolve((0, types_1.successResult)({ uuid, url }, 'Asset URL retrieved successfully'));
                }
                else {
                    resolve((0, types_1.errorResult)('Asset URL not found'));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async findAssetByName(args) {
        const { name, exactMatch = false, assetType = 'all', folder = 'db://assets', maxResults = 20 } = args;
        return new Promise(async (resolve) => {
            try {
                const allAssetsResult = await this.getAssets(assetType, folder);
                if (!allAssetsResult.success || !allAssetsResult.data) {
                    resolve((0, types_1.errorResult)(`Failed to get assets: ${allAssetsResult.error}`));
                    return;
                }
                const allAssets = allAssetsResult.data.assets;
                const matchedAssets = [];
                for (const asset of allAssets) {
                    const assetName = asset.name;
                    const matches = exactMatch
                        ? assetName === name
                        : assetName.toLowerCase().includes(name.toLowerCase());
                    if (matches) {
                        try {
                            const detailResult = await this.getAssetInfo(asset.path);
                            if (detailResult.success) {
                                matchedAssets.push(Object.assign(Object.assign({}, asset), { details: detailResult.data }));
                            }
                            else {
                                matchedAssets.push(asset);
                            }
                        }
                        catch (_a) {
                            matchedAssets.push(asset);
                        }
                        if (matchedAssets.length >= maxResults)
                            break;
                    }
                }
                resolve((0, types_1.successResult)({
                    searchTerm: name,
                    exactMatch,
                    assetType,
                    folder,
                    totalFound: matchedAssets.length,
                    maxResults,
                    assets: matchedAssets
                }, `Found ${matchedAssets.length} assets matching '${name}'`));
            }
            catch (error) {
                resolve((0, types_1.errorResult)(`Asset search failed: ${error.message}`));
            }
        });
    }
    async getAssetDetails(assetPath, includeSubAssets = true) {
        return new Promise(async (resolve) => {
            try {
                const assetInfoResult = await this.getAssetInfo(assetPath);
                if (!assetInfoResult.success) {
                    resolve(assetInfoResult);
                    return;
                }
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
                                    detailedInfo.subAssets.push({
                                        type: subAsset.type,
                                        uuid: subAsset.uuid,
                                        url: subAssetUrl,
                                        suffix: subAsset.suffix
                                    });
                                }
                            }
                            catch (_a) {
                                // Sub-asset doesn't exist, skip it
                            }
                        }
                    }
                }
                resolve((0, types_1.successResult)(Object.assign({ assetPath,
                    includeSubAssets }, detailedInfo), `Asset details retrieved. Found ${detailedInfo.subAssets.length} sub-assets.`));
            }
            catch (error) {
                resolve((0, types_1.errorResult)(`Failed to get asset details: ${error.message}`));
            }
        });
    }
    // ── From AssetAdvancedTools ───────────────────────────────────────────────
    async saveAssetMeta(urlOrUUID, content) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'save-asset-meta', urlOrUUID, content).then((result) => {
                resolve((0, types_1.successResult)({
                    uuid: result === null || result === void 0 ? void 0 : result.uuid,
                    url: result === null || result === void 0 ? void 0 : result.url
                }, 'Asset meta saved successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async generateAvailableUrl(url) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'generate-available-url', url).then((availableUrl) => {
                resolve((0, types_1.successResult)({
                    originalUrl: url,
                    availableUrl,
                    message: availableUrl === url ? 'URL is available' : 'Generated new available URL'
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryAssetDbReady() {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-ready').then((ready) => {
                resolve((0, types_1.successResult)({
                    ready,
                    message: ready ? 'Asset database is ready' : 'Asset database is not ready'
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async openAssetExternal(urlOrUUID) {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'open-asset', urlOrUUID).then(() => {
                resolve((0, types_1.successResult)(null, 'Asset opened with external program'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async batchImportAssets(args) {
        return new Promise(async (resolve) => {
            try {
                const overwrite = args.overwrite === true || args.overwrite === 'true';
                const recursive = args.recursive === true || args.recursive === 'true';
                if (!fs.existsSync(args.sourceDirectory)) {
                    resolve((0, types_1.errorResult)('Source directory does not exist'));
                    return;
                }
                const files = this.getFilesFromDirectory(args.sourceDirectory, args.fileFilter || [], recursive);
                const importResults = [];
                let successCount = 0;
                let errorCount = 0;
                for (const filePath of files) {
                    try {
                        const fileName = path.basename(filePath);
                        const targetPath = `${args.targetDirectory}/${fileName}`;
                        const result = await Editor.Message.request('asset-db', 'import-asset', filePath, targetPath, {
                            overwrite,
                            rename: !overwrite
                        });
                        importResults.push({ source: filePath, target: targetPath, success: true, uuid: result === null || result === void 0 ? void 0 : result.uuid });
                        successCount++;
                    }
                    catch (err) {
                        importResults.push({ source: filePath, success: false, error: err.message });
                        errorCount++;
                    }
                }
                resolve((0, types_1.successResult)({
                    totalFiles: files.length,
                    successCount,
                    errorCount,
                    results: importResults
                }, `Batch import completed: ${successCount} success, ${errorCount} errors`));
            }
            catch (err) {
                resolve((0, types_1.errorResult)(err.message));
            }
        });
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
        return new Promise(async (resolve) => {
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
                resolve((0, types_1.successResult)({
                    totalAssets: urls.length,
                    successCount,
                    errorCount,
                    results: deleteResults
                }, `Batch delete completed: ${successCount} success, ${errorCount} errors`));
            }
            catch (err) {
                resolve((0, types_1.errorResult)(err.message));
            }
        });
    }
    async validateAssetReferences(directory = 'db://assets') {
        return new Promise(async (resolve) => {
            try {
                const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });
                const brokenReferences = [];
                const validReferences = [];
                for (const asset of assets) {
                    try {
                        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                        if (assetInfo) {
                            validReferences.push({ url: asset.url, uuid: asset.uuid, name: asset.name });
                        }
                    }
                    catch (err) {
                        brokenReferences.push({
                            url: asset.url,
                            uuid: asset.uuid,
                            name: asset.name,
                            error: err.message
                        });
                    }
                }
                resolve((0, types_1.successResult)({
                    directory,
                    totalAssets: assets.length,
                    validReferences: validReferences.length,
                    brokenReferences: brokenReferences.length,
                    brokenAssets: brokenReferences
                }, `Validation completed: ${brokenReferences.length} broken references found`));
            }
            catch (err) {
                resolve((0, types_1.errorResult)(err.message));
            }
        });
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
        return new Promise(async (resolve) => {
            try {
                const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });
                const manifest = [];
                for (const asset of assets) {
                    const manifestEntry = {
                        name: asset.name,
                        url: asset.url,
                        uuid: asset.uuid,
                        type: asset.type,
                        size: asset.size || 0,
                        isDirectory: asset.isDirectory || false
                    };
                    if (includeMetadata) {
                        try {
                            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                            if (assetInfo && assetInfo.meta) {
                                manifestEntry.meta = assetInfo.meta;
                            }
                        }
                        catch (_a) {
                            // Skip metadata if not available
                        }
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
                    default:
                        exportData = JSON.stringify(manifest, null, 2);
                }
                resolve((0, types_1.successResult)({
                    directory,
                    format,
                    assetCount: manifest.length,
                    includeMetadata,
                    manifest: exportData
                }, `Asset manifest exported with ${manifest.length} assets`));
            }
            catch (err) {
                resolve((0, types_1.errorResult)(err.message));
            }
        });
    }
    convertToCSV(data) {
        if (data.length === 0)
            return '';
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'object' ? JSON.stringify(value) : String(value);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvQ0FBd0U7QUFDeEUseURBQW9EO0FBQ3BELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7OztHQUdHO0FBQ0gsTUFBYSxXQUFZLFNBQVEsaUNBQWM7SUFBL0M7O1FBQ2EsU0FBSSxHQUFHLGNBQWMsQ0FBQztRQUN0QixnQkFBVyxHQUFHLDRkQUE0ZCxDQUFDO1FBQzNlLFlBQU8sR0FBRztZQUNmLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRO1lBQzNFLE1BQU0sRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsY0FBYztZQUMzRSxhQUFhLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxlQUFlO1lBQzdFLGNBQWMsRUFBRSxjQUFjLEVBQUUscUJBQXFCLEVBQUUsa0JBQWtCO1lBQ3pFLFlBQVksRUFBRSxtQkFBbUIsRUFBRSxpQkFBaUI7U0FDdkQsQ0FBQztRQUVPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtQkFBbUI7b0JBQ2hDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTztpQkFDckI7Z0JBQ0QsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsdUNBQXVDLEVBQUU7Z0JBQ3BGLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGdDQUFnQyxFQUFFO2dCQUMvRSxT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LElBQUksQ0FBQyxZQUFZLENBQUM7WUFDdEUsUUFBUSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUN2RSxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3RELE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ2xELE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLFdBQUMsT0FBQSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsTUFBQSxJQUFJLENBQUMsT0FBTyxtQ0FBSSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxNQUFNLENBQUMsQ0FBQSxFQUFBO1lBQ3hILElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxNQUFNLENBQUM7WUFDOUcsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLE1BQU0sQ0FBQztZQUM5RyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztZ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eyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5cbi8qKlxuICogQ29uc29saWRhdGVkIGFzc2V0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvbWJpbmVzIFByb2plY3RUb29scyAoYXNzZXQgbWV0aG9kcykgKyBBc3NldEFkdmFuY2VkVG9vbHMgaW50byBvbmUgYWN0aW9uLWJhc2VkIHRvb2wuXG4gKi9cbmV4cG9ydCBjbGFzcyBNYW5hZ2VBc3NldCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9hc3NldCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGFzc2V0cyBpbiB0aGUgcHJvamVjdCAoZmlsZXMsIHRleHR1cmVzLCBzY3JpcHRzLCBldGMpLiBBY3Rpb25zOiBpbXBvcnQsIGdldF9pbmZvLCBsaXN0LCByZWZyZXNoLCBjcmVhdGUsIGNvcHksIG1vdmUsIGRlbGV0ZSwgc2F2ZSwgcmVpbXBvcnQsIHF1ZXJ5X3BhdGgsIHF1ZXJ5X3V1aWQsIHF1ZXJ5X3VybCwgZmluZF9ieV9uYW1lLCBnZXRfZGV0YWlscywgc2F2ZV9tZXRhLCBnZW5lcmF0ZV91cmwsIHF1ZXJ5X2RiX3JlYWR5LCBvcGVuX2V4dGVybmFsLCBiYXRjaF9pbXBvcnQsIGJhdGNoX2RlbGV0ZSwgdmFsaWRhdGVfcmVmZXJlbmNlcywgZ2V0X2RlcGVuZGVuY2llcywgZ2V0X3VudXNlZCwgY29tcHJlc3NfdGV4dHVyZXMsIGV4cG9ydF9tYW5pZmVzdC4gTk9UIGZvciBzY2VuZSBub2RlcyDigJQgdXNlIG1hbmFnZV9ub2RlLiBVc2UgcXVlcnlfZGJfcmVhZHkgdG8gY2hlY2sgYXNzZXQgREIgYmVmb3JlIGJhdGNoIG9wcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdpbXBvcnQnLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZWZyZXNoJywgJ2NyZWF0ZScsICdjb3B5JywgJ21vdmUnLCAnZGVsZXRlJyxcbiAgICAgICAgJ3NhdmUnLCAncmVpbXBvcnQnLCAncXVlcnlfcGF0aCcsICdxdWVyeV91dWlkJywgJ3F1ZXJ5X3VybCcsICdmaW5kX2J5X25hbWUnLFxuICAgICAgICAnZ2V0X2RldGFpbHMnLCAnc2F2ZV9tZXRhJywgJ2dlbmVyYXRlX3VybCcsICdxdWVyeV9kYl9yZWFkeScsICdvcGVuX2V4dGVybmFsJyxcbiAgICAgICAgJ2JhdGNoX2ltcG9ydCcsICdiYXRjaF9kZWxldGUnLCAndmFsaWRhdGVfcmVmZXJlbmNlcycsICdnZXRfZGVwZW5kZW5jaWVzJyxcbiAgICAgICAgJ2dldF91bnVzZWQnLCAnY29tcHJlc3NfdGV4dHVyZXMnLCAnZXhwb3J0X21hbmlmZXN0J1xuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9uc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNvdXJjZVBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnU291cmNlIGZpbGUgcGF0aCBvbiBkaXNrIChmb3IgaW1wb3J0KScgfSxcbiAgICAgICAgICAgIHRhcmdldEZvbGRlcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgZm9sZGVyIFVSTCAoZm9yIGltcG9ydCknIH0sXG4gICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgcGF0aCAoZGI6Ly9hc3NldHMvLi4uKScgfSxcbiAgICAgICAgICAgIHVybE9yVVVJRDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgb3IgVVVJRCcgfSxcbiAgICAgICAgICAgIHVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBVUkwgKGRiOi8vYXNzZXRzLy4uLiknIH0sXG4gICAgICAgICAgICB1dWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVVSUQnIH0sXG4gICAgICAgICAgICBjb250ZW50OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZpbGUgY29udGVudCBvciBtZXRhIGNvbnRlbnQnIH0sXG4gICAgICAgICAgICBvdmVyd3JpdGU6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ092ZXJ3cml0ZSBleGlzdGluZyBmaWxlJywgZGVmYXVsdDogZmFsc2UgfSxcbiAgICAgICAgICAgIHNvdXJjZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgYXNzZXQgVVJMIChmb3IgY29weS9tb3ZlKScgfSxcbiAgICAgICAgICAgIHRhcmdldDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgYXNzZXQgVVJMIChmb3IgY29weS9tb3ZlKScgfSxcbiAgICAgICAgICAgIGZvbGRlcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdGb2xkZXIgdG8gc2VhcmNoL2xpc3QnLCBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnIH0sXG4gICAgICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCB0eXBlIGZpbHRlcicsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IG5hbWUgdG8gc2VhcmNoIGZvcicgfSxcbiAgICAgICAgICAgIGV4YWN0TWF0Y2g6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0V4YWN0IG5hbWUgbWF0Y2gnLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgYXNzZXRUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGaWx0ZXIgYnkgYXNzZXQgdHlwZScsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAnc2NlbmUnLCAncHJlZmFiJywgJ3NjcmlwdCcsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ21lc2gnLCAnYXVkaW8nLCAnYW5pbWF0aW9uJywgJ3Nwcml0ZUZyYW1lJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXhSZXN1bHRzOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ01heCByZXN1bHRzIGZvciBmaW5kX2J5X25hbWUnLCBkZWZhdWx0OiAyMCwgbWluaW11bTogMSwgbWF4aW11bTogMTAwIH0sXG4gICAgICAgICAgICBpbmNsdWRlU3ViQXNzZXRzOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdJbmNsdWRlIHN1Yi1hc3NldHMgKHNwcml0ZUZyYW1lLCB0ZXh0dXJlKScsIGRlZmF1bHQ6IHRydWUgfSxcbiAgICAgICAgICAgIHNvdXJjZURpcmVjdG9yeTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgZGlyZWN0b3J5IGZvciBiYXRjaF9pbXBvcnQnIH0sXG4gICAgICAgICAgICB0YXJnZXREaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGRpcmVjdG9yeSBVUkwgZm9yIGJhdGNoX2ltcG9ydCcgfSxcbiAgICAgICAgICAgIGZpbGVGaWx0ZXI6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdGaWxlIGV4dGVuc2lvbnMgZmlsdGVyJywgZGVmYXVsdDogW10gfSxcbiAgICAgICAgICAgIHJlY3Vyc2l2ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBzdWJkaXJlY3RvcmllcycsIGRlZmF1bHQ6IGZhbHNlIH0sXG4gICAgICAgICAgICB1cmxzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnQXJyYXkgb2YgYXNzZXQgVVJMcyBmb3IgYmF0Y2hfZGVsZXRlJyB9LFxuICAgICAgICAgICAgZGlyZWN0b3J5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0RpcmVjdG9yeSB0byBzY2FuJywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJyB9LFxuICAgICAgICAgICAgZXhjbHVkZURpcmVjdG9yaWVzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sIGRlc2NyaXB0aW9uOiAnRGlyZWN0b3JpZXMgdG8gZXhjbHVkZScsIGRlZmF1bHQ6IFtdIH0sXG4gICAgICAgICAgICBkaXJlY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlcGVuZGVuY3kgZGlyZWN0aW9uJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlcGVuZGVudHMnLCAnZGVwZW5kZW5jaWVzJywgJ2JvdGgnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGVwZW5kZW5jaWVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvcm1hdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRm9ybWF0IGZvciBjb21wcmVzc190ZXh0dXJlcyBvciBleHBvcnRfbWFuaWZlc3QnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYXV0bycsICdqcGcnLCAncG5nJywgJ3dlYnAnLCAnanNvbicsICdjc3YnLCAneG1sJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2F1dG8nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcXVhbGl0eTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdDb21wcmVzc2lvbiBxdWFsaXR5ICgwLjEtMS4wKScsIG1pbmltdW06IDAuMSwgbWF4aW11bTogMS4wLCBkZWZhdWx0OiAwLjggfSxcbiAgICAgICAgICAgIGluY2x1ZGVNZXRhZGF0YTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnSW5jbHVkZSBhc3NldCBtZXRhZGF0YSBpbiBtYW5pZmVzdCcsIGRlZmF1bHQ6IHRydWUgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgaW1wb3J0OiAoYXJncykgPT4gdGhpcy5pbXBvcnRBc3NldChhcmdzLnNvdXJjZVBhdGgsIGFyZ3MudGFyZ2V0Rm9sZGVyKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0SW5mbyhhcmdzLmFzc2V0UGF0aCB8fCBhcmdzLnVybE9yVVVJRCksXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0cyhhcmdzLnR5cGUsIGFyZ3MuZm9sZGVyKSxcbiAgICAgICAgcmVmcmVzaDogKGFyZ3MpID0+IHRoaXMucmVmcmVzaEFzc2V0cyhhcmdzLmZvbGRlciksXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlQXNzZXQoYXJncy51cmwsIGFyZ3MuY29udGVudCA/PyBudWxsLCBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnKSxcbiAgICAgICAgY29weTogKGFyZ3MpID0+IHRoaXMuY29weUFzc2V0KGFyZ3Muc291cmNlLCBhcmdzLnRhcmdldCwgYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJyksXG4gICAgICAgIG1vdmU6IChhcmdzKSA9PiB0aGlzLm1vdmVBc3NldChhcmdzLnNvdXJjZSwgYXJncy50YXJnZXQsIGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZScpLFxuICAgICAgICBkZWxldGU6IChhcmdzKSA9PiB0aGlzLmRlbGV0ZUFzc2V0KGFyZ3MudXJsKSxcbiAgICAgICAgc2F2ZTogKGFyZ3MpID0+IHRoaXMuc2F2ZUFzc2V0KGFyZ3MudXJsIHx8IGFyZ3MudXJsT3JVVUlELCBhcmdzLmNvbnRlbnQpLFxuICAgICAgICByZWltcG9ydDogKGFyZ3MpID0+IHRoaXMucmVpbXBvcnRBc3NldChhcmdzLnVybCB8fCBhcmdzLnVybE9yVVVJRCksXG4gICAgICAgIHF1ZXJ5X3BhdGg6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRQYXRoKGFyZ3MudXJsIHx8IGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgcXVlcnlfdXVpZDogKGFyZ3MpID0+IHRoaXMucXVlcnlBc3NldFV1aWQoYXJncy51cmwpLFxuICAgICAgICBxdWVyeV91cmw6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXRVcmwoYXJncy51dWlkKSxcbiAgICAgICAgZmluZF9ieV9uYW1lOiAoYXJncykgPT4gdGhpcy5maW5kQXNzZXRCeU5hbWUoYXJncyksXG4gICAgICAgIGdldF9kZXRhaWxzOiAoYXJncykgPT4gdGhpcy5nZXRBc3NldERldGFpbHMoYXJncy5hc3NldFBhdGggfHwgYXJncy51cmxPclVVSUQsIGFyZ3MuaW5jbHVkZVN1YkFzc2V0cyAhPT0gZmFsc2UpLFxuICAgICAgICBzYXZlX21ldGE6IChhcmdzKSA9PiB0aGlzLnNhdmVBc3NldE1ldGEoYXJncy51cmxPclVVSUQsIGFyZ3MuY29udGVudCksXG4gICAgICAgIGdlbmVyYXRlX3VybDogKGFyZ3MpID0+IHRoaXMuZ2VuZXJhdGVBdmFpbGFibGVVcmwoYXJncy51cmwpLFxuICAgICAgICBxdWVyeV9kYl9yZWFkeTogKF9hcmdzKSA9PiB0aGlzLnF1ZXJ5QXNzZXREYlJlYWR5KCksXG4gICAgICAgIG9wZW5fZXh0ZXJuYWw6IChhcmdzKSA9PiB0aGlzLm9wZW5Bc3NldEV4dGVybmFsKGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgYmF0Y2hfaW1wb3J0OiAoYXJncykgPT4gdGhpcy5iYXRjaEltcG9ydEFzc2V0cyhhcmdzKSxcbiAgICAgICAgYmF0Y2hfZGVsZXRlOiAoYXJncykgPT4gdGhpcy5iYXRjaERlbGV0ZUFzc2V0cyhhcmdzLnVybHMpLFxuICAgICAgICB2YWxpZGF0ZV9yZWZlcmVuY2VzOiAoYXJncykgPT4gdGhpcy52YWxpZGF0ZUFzc2V0UmVmZXJlbmNlcyhhcmdzLmRpcmVjdG9yeSksXG4gICAgICAgIGdldF9kZXBlbmRlbmNpZXM6IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0RGVwZW5kZW5jaWVzKGFyZ3MudXJsT3JVVUlELCBhcmdzLmRpcmVjdGlvbiksXG4gICAgICAgIGdldF91bnVzZWQ6IChhcmdzKSA9PiB0aGlzLmdldFVudXNlZEFzc2V0cyhhcmdzLmRpcmVjdG9yeSwgYXJncy5leGNsdWRlRGlyZWN0b3JpZXMpLFxuICAgICAgICBjb21wcmVzc190ZXh0dXJlczogKGFyZ3MpID0+IHRoaXMuY29tcHJlc3NUZXh0dXJlcyhhcmdzLmRpcmVjdG9yeSwgYXJncy5mb3JtYXQsIGFyZ3MucXVhbGl0eSksXG4gICAgICAgIGV4cG9ydF9tYW5pZmVzdDogKGFyZ3MpID0+IHRoaXMuZXhwb3J0QXNzZXRNYW5pZmVzdChhcmdzLmRpcmVjdG9yeSwgYXJncy5mb3JtYXQsIGFyZ3MuaW5jbHVkZU1ldGFkYXRhICE9PSBmYWxzZSlcbiAgICB9O1xuXG4gICAgLy8g4pSA4pSAIEZyb20gUHJvamVjdFRvb2xzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbXBvcnRBc3NldChzb3VyY2VQYXRoOiBzdHJpbmcsIHRhcmdldEZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNvdXJjZVBhdGgpKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnU291cmNlIGZpbGUgbm90IGZvdW5kJykpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKHNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHRhcmdldEZvbGRlci5zdGFydHNXaXRoKCdkYjovLycpID9cbiAgICAgICAgICAgICAgICB0YXJnZXRGb2xkZXIgOiBgZGI6Ly9hc3NldHMvJHt0YXJnZXRGb2xkZXJ9YDtcblxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0Jywgc291cmNlUGF0aCwgYCR7dGFyZ2V0UGF0aH0vJHtmaWxlTmFtZX1gKS50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IHJlc3VsdC51dWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiByZXN1bHQudXJsLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgQXNzZXQgaW1wb3J0ZWQ6ICR7ZmlsZU5hbWV9YFxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXRJbmZvKGFzc2V0UGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0UGF0aCkudGhlbigoYXNzZXRJbmZvOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KCdBc3NldCBub3QgZm91bmQnKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBhc3NldEluZm8udXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogYXNzZXRJbmZvLnVybCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogYXNzZXRJbmZvLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIHNpemU6IGFzc2V0SW5mby5zaXplLFxuICAgICAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogYXNzZXRJbmZvLmlzRGlyZWN0b3J5XG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8ubWV0YSkge1xuICAgICAgICAgICAgICAgICAgICBpbmZvLm1ldGEgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXI6IGFzc2V0SW5mby5tZXRhLnZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIGltcG9ydGVyOiBhc3NldEluZm8ubWV0YS5pbXBvcnRlclxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChpbmZvKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0cyh0eXBlOiBzdHJpbmcgPSAnYWxsJywgZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgbGV0IHBhdHRlcm4gPSBgJHtmb2xkZXJ9LyoqLypgO1xuXG4gICAgICAgICAgICBpZiAodHlwZSAhPT0gJ2FsbCcpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlRXh0ZW5zaW9uczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICAgICAgJ3NjZW5lJzogJy5zY2VuZScsXG4gICAgICAgICAgICAgICAgICAgICdwcmVmYWInOiAnLnByZWZhYicsXG4gICAgICAgICAgICAgICAgICAgICdzY3JpcHQnOiAnLnt0cyxqc30nLFxuICAgICAgICAgICAgICAgICAgICAndGV4dHVyZSc6ICcue3BuZyxqcGcsanBlZyxnaWYsdGdhLGJtcCxwc2R9JyxcbiAgICAgICAgICAgICAgICAgICAgJ21hdGVyaWFsJzogJy5tdGwnLFxuICAgICAgICAgICAgICAgICAgICAnbWVzaCc6ICcue2ZieCxvYmosZGFlfScsXG4gICAgICAgICAgICAgICAgICAgICdhdWRpbyc6ICcue21wMyxvZ2csd2F2LG00YX0nLFxuICAgICAgICAgICAgICAgICAgICAnYW5pbWF0aW9uJzogJy57YW5pbSxjbGlwfSdcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ZW5zaW9uID0gdHlwZUV4dGVuc2lvbnNbdHlwZV07XG4gICAgICAgICAgICAgICAgaWYgKGV4dGVuc2lvbikge1xuICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuID0gYCR7Zm9sZGVyfS8qKi8qJHtleHRlbnNpb259YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KS50aGVuKChyZXN1bHRzOiBhbnlbXSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IHJlc3VsdHMubWFwKGFzc2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IGFzc2V0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6IGFzc2V0LnVybCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgc2l6ZTogYXNzZXQuc2l6ZSB8fCAwLFxuICAgICAgICAgICAgICAgICAgICBpc0RpcmVjdG9yeTogYXNzZXQuaXNEaXJlY3RvcnkgfHwgZmFsc2VcbiAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICAgICAgICBmb2xkZXIsXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiBhc3NldHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBhc3NldHNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlZnJlc2hBc3NldHMoZm9sZGVyPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGZvbGRlciB8fCAnZGI6Ly9hc3NldHMnO1xuXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgdGFyZ2V0UGF0aCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBBc3NldHMgcmVmcmVzaGVkIGluOiAke3RhcmdldFBhdGh9YCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBc3NldCh1cmw6IHN0cmluZywgY29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGwsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICBvdmVyd3JpdGUsXG4gICAgICAgICAgICAgICAgcmVuYW1lOiAhb3ZlcndyaXRlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCB1cmwsIGNvbnRlbnQsIG9wdGlvbnMpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjb250ZW50ID09PSBudWxsID8gJ0ZvbGRlciBjcmVhdGVkIHN1Y2Nlc3NmdWxseScgOiAnRmlsZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjb250ZW50ID09PSBudWxsID8gJ0ZvbGRlciBjcmVhdGVkIHN1Y2Nlc3NmdWxseScgOiAnRmlsZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY29weUFzc2V0KHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9O1xuXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjb3B5LWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIG9wdGlvbnMpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQXNzZXQgY29waWVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQXNzZXQgY29waWVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbW92ZUFzc2V0KHNvdXJjZTogc3RyaW5nLCB0YXJnZXQ6IHN0cmluZywgb3ZlcndyaXRlOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9O1xuXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdtb3ZlLWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIG9wdGlvbnMpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnQXNzZXQgbW92ZWQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdBc3NldCBtb3ZlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRlbGV0ZUFzc2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyB1cmwgfSwgJ0Fzc2V0IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXQodXJsOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCB1cmwsIGNvbnRlbnQpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdC51cmxcbiAgICAgICAgICAgICAgICAgICAgfSwgJ0Fzc2V0IHNhdmVkIHN1Y2Nlc3NmdWxseScpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyB1cmwgfSwgJ0Fzc2V0IHNhdmVkIHN1Y2Nlc3NmdWxseScpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlaW1wb3J0QXNzZXQodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIHVybCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgdXJsIH0sICdBc3NldCByZWltcG9ydGVkIHN1Y2Nlc3NmdWxseScpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFBhdGgodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1wYXRoJywgdXJsKS50aGVuKChhc3NldFBhdGg6IHN0cmluZyB8IG51bGwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IHVybCwgcGF0aDogYXNzZXRQYXRoIH0sICdBc3NldCBwYXRoIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknKSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnQXNzZXQgcGF0aCBub3QgZm91bmQnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0VXVpZCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXV1aWQnLCB1cmwpLnRoZW4oKHV1aWQ6IHN0cmluZyB8IG51bGwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyB1cmwsIHV1aWQgfSwgJ0Fzc2V0IFVVSUQgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KCdBc3NldCBVVUlEIG5vdCBmb3VuZCcpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXRVcmwodXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXJsJywgdXVpZCkudGhlbigodXJsOiBzdHJpbmcgfCBudWxsKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHVybCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyB1dWlkLCB1cmwgfSwgJ0Fzc2V0IFVSTCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoJ0Fzc2V0IFVSTCBub3QgZm91bmQnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kQXNzZXRCeU5hbWUoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbmFtZSwgZXhhY3RNYXRjaCA9IGZhbHNlLCBhc3NldFR5cGUgPSAnYWxsJywgZm9sZGVyID0gJ2RiOi8vYXNzZXRzJywgbWF4UmVzdWx0cyA9IDIwIH0gPSBhcmdzO1xuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhbGxBc3NldHNSZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0cyhhc3NldFR5cGUsIGZvbGRlcik7XG4gICAgICAgICAgICAgICAgaWYgKCFhbGxBc3NldHNSZXN1bHQuc3VjY2VzcyB8fCAhYWxsQXNzZXRzUmVzdWx0LmRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBhc3NldHM6ICR7YWxsQXNzZXRzUmVzdWx0LmVycm9yfWApKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGFsbEFzc2V0cyA9IGFsbEFzc2V0c1Jlc3VsdC5kYXRhLmFzc2V0cyBhcyBhbnlbXTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkQXNzZXRzOiBhbnlbXSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBhc3NldCBvZiBhbGxBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXROYW1lID0gYXNzZXQubmFtZTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGV4YWN0TWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYXNzZXROYW1lID09PSBuYW1lXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGFzc2V0TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKG5hbWUudG9Mb3dlckNhc2UoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGV0YWlsUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRBc3NldEluZm8oYXNzZXQucGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRldGFpbFJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaCh7IC4uLmFzc2V0LCBkZXRhaWxzOiBkZXRhaWxSZXN1bHQuZGF0YSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXNzZXRzLnB1c2goYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWRBc3NldHMucHVzaChhc3NldCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkQXNzZXRzLmxlbmd0aCA+PSBtYXhSZXN1bHRzKSBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIHNlYXJjaFRlcm06IG5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGV4YWN0TWF0Y2gsXG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgZm9sZGVyLFxuICAgICAgICAgICAgICAgICAgICB0b3RhbEZvdW5kOiBtYXRjaGVkQXNzZXRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgbWF4UmVzdWx0cyxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRzOiBtYXRjaGVkQXNzZXRzXG4gICAgICAgICAgICAgICAgfSwgYEZvdW5kICR7bWF0Y2hlZEFzc2V0cy5sZW5ndGh9IGFzc2V0cyBtYXRjaGluZyAnJHtuYW1lfSdgKSk7XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGBBc3NldCBzZWFyY2ggZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0RGV0YWlscyhhc3NldFBhdGg6IHN0cmluZywgaW5jbHVkZVN1YkFzc2V0czogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mb1Jlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QXNzZXRJbmZvKGFzc2V0UGF0aCk7XG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldEluZm9SZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGFzc2V0SW5mb1Jlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhc3NldEluZm9SZXN1bHQuZGF0YTtcbiAgICAgICAgICAgICAgICBjb25zdCBkZXRhaWxlZEluZm86IGFueSA9IHsgLi4uYXNzZXRJbmZvLCBzdWJBc3NldHM6IFtdIH07XG5cbiAgICAgICAgICAgICAgICBpZiAoaW5jbHVkZVN1YkFzc2V0cyAmJiBhc3NldEluZm8pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0SW5mby50eXBlID09PSAnY2MuSW1hZ2VBc3NldCcgfHwgYXNzZXRQYXRoLm1hdGNoKC9cXC4ocG5nfGpwZ3xqcGVnfGdpZnx0Z2F8Ym1wfHBzZCkkL2kpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiYXNlVXVpZCA9IGFzc2V0SW5mby51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zc2libGVTdWJBc3NldHMgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3ByaXRlRnJhbWUnLCB1dWlkOiBgJHtiYXNlVXVpZH1AZjk5NDFgLCBzdWZmaXg6ICdAZjk5NDEnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAndGV4dHVyZScsIHV1aWQ6IGAke2Jhc2VVdWlkfUA2YzQ4YWAsIHN1ZmZpeDogJ0A2YzQ4YScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICd0ZXh0dXJlMkQnLCB1dWlkOiBgJHtiYXNlVXVpZH1ANmM0OGFgLCBzdWZmaXg6ICdANmM0OGEnIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViQXNzZXQgb2YgcG9zc2libGVTdWJBc3NldHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJBc3NldFVybCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHN1YkFzc2V0LnV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3ViQXNzZXRVcmwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbGVkSW5mby5zdWJBc3NldHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogc3ViQXNzZXQudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBzdWJBc3NldC51dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybDogc3ViQXNzZXRVcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VmZml4OiBzdWJBc3NldC5zdWZmaXhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN1Yi1hc3NldCBkb2Vzbid0IGV4aXN0LCBza2lwIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRQYXRoLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlU3ViQXNzZXRzLFxuICAgICAgICAgICAgICAgICAgICAuLi5kZXRhaWxlZEluZm9cbiAgICAgICAgICAgICAgICB9LCBgQXNzZXQgZGV0YWlscyByZXRyaWV2ZWQuIEZvdW5kICR7ZGV0YWlsZWRJbmZvLnN1YkFzc2V0cy5sZW5ndGh9IHN1Yi1hc3NldHMuYCkpO1xuXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBhc3NldCBkZXRhaWxzOiAke2Vycm9yLm1lc3NhZ2V9YCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDilIDilIAgRnJvbSBBc3NldEFkdmFuY2VkVG9vbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVBc3NldE1ldGEodXJsT3JVVUlEOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIHVybE9yVVVJRCwgY29udGVudCkudGhlbigocmVzdWx0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiByZXN1bHQ/LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHVybDogcmVzdWx0Py51cmxcbiAgICAgICAgICAgICAgICB9LCAnQXNzZXQgbWV0YSBzYXZlZCBzdWNjZXNzZnVsbHknKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdlbmVyYXRlQXZhaWxhYmxlVXJsKHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZ2VuZXJhdGUtYXZhaWxhYmxlLXVybCcsIHVybCkudGhlbigoYXZhaWxhYmxlVXJsOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbFVybDogdXJsLFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVVcmwsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGF2YWlsYWJsZVVybCA9PT0gdXJsID8gJ1VSTCBpcyBhdmFpbGFibGUnIDogJ0dlbmVyYXRlZCBuZXcgYXZhaWxhYmxlIFVSTCdcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXREYlJlYWR5KCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXJlYWR5JykudGhlbigocmVhZHk6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICByZWFkeSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogcmVhZHkgPyAnQXNzZXQgZGF0YWJhc2UgaXMgcmVhZHknIDogJ0Fzc2V0IGRhdGFiYXNlIGlzIG5vdCByZWFkeSdcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIG9wZW5Bc3NldEV4dGVybmFsKHVybE9yVVVJRDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnb3Blbi1hc3NldCcsIHVybE9yVVVJRCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsICdBc3NldCBvcGVuZWQgd2l0aCBleHRlcm5hbCBwcm9ncmFtJykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBiYXRjaEltcG9ydEFzc2V0cyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG92ZXJ3cml0ZTogYm9vbGVhbiA9IGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZSc7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVjdXJzaXZlOiBib29sZWFuID0gYXJncy5yZWN1cnNpdmUgPT09IHRydWUgfHwgYXJncy5yZWN1cnNpdmUgPT09ICd0cnVlJztcblxuICAgICAgICAgICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhhcmdzLnNvdXJjZURpcmVjdG9yeSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnU291cmNlIGRpcmVjdG9yeSBkb2VzIG5vdCBleGlzdCcpKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVzID0gdGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoXG4gICAgICAgICAgICAgICAgICAgIGFyZ3Muc291cmNlRGlyZWN0b3J5LFxuICAgICAgICAgICAgICAgICAgICBhcmdzLmZpbGVGaWx0ZXIgfHwgW10sXG4gICAgICAgICAgICAgICAgICAgIHJlY3Vyc2l2ZVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBpbXBvcnRSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGxldCBzdWNjZXNzQ291bnQgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBlcnJvckNvdW50ID0gMDtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZmlsZVBhdGggb2YgZmlsZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gcGF0aC5iYXNlbmFtZShmaWxlUGF0aCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQYXRoID0gYCR7YXJncy50YXJnZXREaXJlY3Rvcnl9LyR7ZmlsZU5hbWV9YDtcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aCwgdGFyZ2V0UGF0aCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvdmVyd3JpdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbmFtZTogIW92ZXJ3cml0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpbXBvcnRSZXN1bHRzLnB1c2goeyBzb3VyY2U6IGZpbGVQYXRoLCB0YXJnZXQ6IHRhcmdldFBhdGgsIHN1Y2Nlc3M6IHRydWUsIHV1aWQ6IHJlc3VsdD8udXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW1wb3J0UmVzdWx0cy5wdXNoKHsgc291cmNlOiBmaWxlUGF0aCwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yQ291bnQrKztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIHRvdGFsRmlsZXM6IGZpbGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50LFxuICAgICAgICAgICAgICAgICAgICBlcnJvckNvdW50LFxuICAgICAgICAgICAgICAgICAgICByZXN1bHRzOiBpbXBvcnRSZXN1bHRzXG4gICAgICAgICAgICAgICAgfSwgYEJhdGNoIGltcG9ydCBjb21wbGV0ZWQ6ICR7c3VjY2Vzc0NvdW50fSBzdWNjZXNzLCAke2Vycm9yQ291bnR9IGVycm9yc2ApKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldEZpbGVzRnJvbURpcmVjdG9yeShkaXJQYXRoOiBzdHJpbmcsIGZpbGVGaWx0ZXI6IHN0cmluZ1tdLCByZWN1cnNpdmU6IGJvb2xlYW4pOiBzdHJpbmdbXSB7XG4gICAgICAgIGNvbnN0IGZpbGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBpdGVtcyA9IGZzLnJlYWRkaXJTeW5jKGRpclBhdGgpO1xuXG4gICAgICAgIGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuICAgICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oZGlyUGF0aCwgaXRlbSk7XG4gICAgICAgICAgICBjb25zdCBzdGF0ID0gZnMuc3RhdFN5bmMoZnVsbFBhdGgpO1xuXG4gICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIGlmIChmaWxlRmlsdGVyLmxlbmd0aCA9PT0gMCB8fCBmaWxlRmlsdGVyLnNvbWUoZXh0ID0+IGl0ZW0udG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQudG9Mb3dlckNhc2UoKSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpICYmIHJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goLi4udGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoZnVsbFBhdGgsIGZpbGVGaWx0ZXIsIHJlY3Vyc2l2ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZpbGVzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYmF0Y2hEZWxldGVBc3NldHModXJsczogc3RyaW5nW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGRlbGV0ZVJlc3VsdHM6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICAgICAgbGV0IGVycm9yQ291bnQgPSAwO1xuXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB1cmwgb2YgdXJscykge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZVJlc3VsdHMucHVzaCh7IHVybCwgc3VjY2VzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3NDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlUmVzdWx0cy5wdXNoKHsgdXJsLCBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JDb3VudCsrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgdG90YWxBc3NldHM6IHVybHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yQ291bnQsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdHM6IGRlbGV0ZVJlc3VsdHNcbiAgICAgICAgICAgICAgICB9LCBgQmF0Y2ggZGVsZXRlIGNvbXBsZXRlZDogJHtzdWNjZXNzQ291bnR9IHN1Y2Nlc3MsICR7ZXJyb3JDb3VudH0gZXJyb3JzYCkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVBc3NldFJlZmVyZW5jZXMoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhc3NldHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm46IGAke2RpcmVjdG9yeX0vKiovKmAgfSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBicm9rZW5SZWZlcmVuY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkUmVmZXJlbmNlczogYW55W10gPSBbXTtcblxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXQudXJsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWxpZFJlZmVyZW5jZXMucHVzaCh7IHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLCBuYW1lOiBhc3NldC5uYW1lIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyb2tlblJlZmVyZW5jZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBhc3NldC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogYXNzZXQudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiAoZXJyIGFzIEVycm9yKS5tZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIGRpcmVjdG9yeSxcbiAgICAgICAgICAgICAgICAgICAgdG90YWxBc3NldHM6IGFzc2V0cy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIHZhbGlkUmVmZXJlbmNlczogdmFsaWRSZWZlcmVuY2VzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgYnJva2VuUmVmZXJlbmNlczogYnJva2VuUmVmZXJlbmNlcy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgIGJyb2tlbkFzc2V0czogYnJva2VuUmVmZXJlbmNlc1xuICAgICAgICAgICAgICAgIH0sIGBWYWxpZGF0aW9uIGNvbXBsZXRlZDogJHticm9rZW5SZWZlcmVuY2VzLmxlbmd0aH0gYnJva2VuIHJlZmVyZW5jZXMgZm91bmRgKSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldERlcGVuZGVuY2llcyhfdXJsT3JVVUlEOiBzdHJpbmcsIF9kaXJlY3Rpb246IHN0cmluZyA9ICdkZXBlbmRlbmNpZXMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICdBc3NldCBkZXBlbmRlbmN5IGFuYWx5c2lzIHJlcXVpcmVzIGFkZGl0aW9uYWwgQVBJcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb24uIENvbnNpZGVyIHVzaW5nIHRoZSBFZGl0b3IgVUkgZm9yIGRlcGVuZGVuY3kgYW5hbHlzaXMuJ1xuICAgICAgICApO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0VW51c2VkQXNzZXRzKF9kaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycsIF9leGNsdWRlRGlyZWN0b3JpZXM6IHN0cmluZ1tdID0gW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgJ1VudXNlZCBhc3NldCBkZXRlY3Rpb24gcmVxdWlyZXMgY29tcHJlaGVuc2l2ZSBwcm9qZWN0IGFuYWx5c2lzIG5vdCBhdmFpbGFibGUgaW4gY3VycmVudCBDb2NvcyBDcmVhdG9yIE1DUCBpbXBsZW1lbnRhdGlvbi4gQ29uc2lkZXIgdXNpbmcgdGhlIEVkaXRvciBVSSBvciB0aGlyZC1wYXJ0eSB0b29scyBmb3IgdW51c2VkIGFzc2V0IGRldGVjdGlvbi4nXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjb21wcmVzc1RleHR1cmVzKF9kaXJlY3Rvcnk6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycsIF9mb3JtYXQ6IHN0cmluZyA9ICdhdXRvJywgX3F1YWxpdHk6IG51bWJlciA9IDAuOCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICBcIlRleHR1cmUgY29tcHJlc3Npb24gcmVxdWlyZXMgaW1hZ2UgcHJvY2Vzc2luZyBjYXBhYmlsaXRpZXMgbm90IGF2YWlsYWJsZSBpbiBjdXJyZW50IENvY29zIENyZWF0b3IgTUNQIGltcGxlbWVudGF0aW9uLiBVc2UgdGhlIEVkaXRvcidzIGJ1aWx0LWluIHRleHR1cmUgY29tcHJlc3Npb24gc2V0dGluZ3Mgb3IgZXh0ZXJuYWwgdG9vbHMuXCJcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydEFzc2V0TWFuaWZlc3QoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBmb3JtYXQ6IHN0cmluZyA9ICdqc29uJywgaW5jbHVkZU1ldGFkYXRhOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuOiBgJHtkaXJlY3Rvcnl9LyoqLypgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgbWFuaWZlc3Q6IGFueVtdID0gW107XG5cbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGFzc2V0IG9mIGFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBtYW5pZmVzdEVudHJ5OiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBhc3NldC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBhc3NldC51dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU6IChhc3NldCBhcyBhbnkpLnNpemUgfHwgMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzRGlyZWN0b3J5OiBhc3NldC5pc0RpcmVjdG9yeSB8fCBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlTWV0YWRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0LnVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0SW5mbyAmJiBhc3NldEluZm8ubWV0YSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYW5pZmVzdEVudHJ5Lm1ldGEgPSBhc3NldEluZm8ubWV0YTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTa2lwIG1ldGFkYXRhIGlmIG5vdCBhdmFpbGFibGVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIG1hbmlmZXN0LnB1c2gobWFuaWZlc3RFbnRyeSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IGV4cG9ydERhdGE6IHN0cmluZztcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGZvcm1hdCkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlICdjc3YnOlxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0RGF0YSA9IHRoaXMuY29udmVydFRvQ1NWKG1hbmlmZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBjYXNlICd4bWwnOlxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0RGF0YSA9IHRoaXMuY29udmVydFRvWE1MKG1hbmlmZXN0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgZXhwb3J0RGF0YSA9IEpTT04uc3RyaW5naWZ5KG1hbmlmZXN0LCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBkaXJlY3RvcnksXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdCxcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRDb3VudDogbWFuaWZlc3QubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlTWV0YWRhdGEsXG4gICAgICAgICAgICAgICAgICAgIG1hbmlmZXN0OiBleHBvcnREYXRhXG4gICAgICAgICAgICAgICAgfSwgYEFzc2V0IG1hbmlmZXN0IGV4cG9ydGVkIHdpdGggJHttYW5pZmVzdC5sZW5ndGh9IGFzc2V0c2ApKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNvbnZlcnRUb0NTVihkYXRhOiBhbnlbXSk6IHN0cmluZyB7XG4gICAgICAgIGlmIChkYXRhLmxlbmd0aCA9PT0gMCkgcmV0dXJuICcnO1xuXG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBPYmplY3Qua2V5cyhkYXRhWzBdKTtcbiAgICAgICAgY29uc3QgY3N2Um93cyA9IFtoZWFkZXJzLmpvaW4oJywnKV07XG5cbiAgICAgICAgZm9yIChjb25zdCByb3cgb2YgZGF0YSkge1xuICAgICAgICAgICAgY29uc3QgdmFsdWVzID0gaGVhZGVycy5tYXAoaGVhZGVyID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IHJvd1toZWFkZXJdO1xuICAgICAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gSlNPTi5zdHJpbmdpZnkodmFsdWUpIDogU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY3N2Um93cy5wdXNoKHZhbHVlcy5qb2luKCcsJykpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNzdlJvd3Muam9pbignXFxuJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjb252ZXJ0VG9YTUwoZGF0YTogYW55W10pOiBzdHJpbmcge1xuICAgICAgICBsZXQgeG1sID0gJzw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/Plxcbjxhc3NldHM+XFxuJztcblxuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZGF0YSkge1xuICAgICAgICAgICAgeG1sICs9ICcgIDxhc3NldD5cXG4nO1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB4bWxWYWx1ZSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSkgOlxuICAgICAgICAgICAgICAgICAgICBTdHJpbmcodmFsdWUpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbiAgICAgICAgICAgICAgICB4bWwgKz0gYCAgICA8JHtrZXl9PiR7eG1sVmFsdWV9PC8ke2tleX0+XFxuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhtbCArPSAnICA8L2Fzc2V0Plxcbic7XG4gICAgICAgIH1cblxuICAgICAgICB4bWwgKz0gJzwvYXNzZXRzPic7XG4gICAgICAgIHJldHVybiB4bWw7XG4gICAgfVxufVxuIl19