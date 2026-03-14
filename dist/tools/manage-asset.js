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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFzc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hc3NldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxvQ0FBd0U7QUFDeEUseURBQW9EO0FBQ3BELHVDQUF5QjtBQUN6QiwyQ0FBNkI7QUFFN0I7OztHQUdHO0FBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxTQUFpQjtJQUN4QyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM5RCxxREFBcUQ7SUFDckQsSUFBSSxTQUFTLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQy9DLHdDQUF3QztJQUN4QyxJQUFJLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksU0FBUyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3RHLDZDQUE2QztJQUM3QyxPQUFPLFNBQVMsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDM0MsQ0FBQztBQUVELFNBQVMsY0FBYyxDQUFDLEtBQWE7SUFDakMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1FBQUUsT0FBTyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEQsb0NBQW9DO0lBQ3BDLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7UUFBRSxLQUFLLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQztJQUNwRCxxREFBcUQ7SUFDckQsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FB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QVksQ0FBQyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDdkUsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN0RCxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUNsRCxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFDLE9BQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQUEsSUFBSSxDQUFDLE9BQU8sbUNBQUksSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssTUFBTSxDQUFDLENBQUEsRUFBQTtZQUN4SCxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssTUFBTSxDQUFDO1lBQzlHLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxNQUFNLENBQUM7WUFDOUcsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7WUFDNUMsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFH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aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgcGF0aCBpcyBzYWZlIGZvciBhc3NldCBvcGVyYXRpb25zLlxuICogUmVqZWN0cyB0cmF2ZXJzYWwgcGF0dGVybnMgYW5kIGJhcmUgYWJzb2x1dGUgcGF0aHMgKG5vbi1kYjovLyBmb3JtKS5cbiAqL1xuZnVuY3Rpb24gdmFsaWRhdGVBc3NldFBhdGgoYXNzZXRQYXRoOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAoIWFzc2V0UGF0aCB8fCB0eXBlb2YgYXNzZXRQYXRoICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIC8vIEFsbG93IGRiOi8vIHByb3RvY29sIHBhdGhzIChDb2NvcyBhc3NldCBEQiBmb3JtYXQpXG4gICAgaWYgKGFzc2V0UGF0aC5zdGFydHNXaXRoKCdkYjovLycpKSByZXR1cm4gdHJ1ZTtcbiAgICAvLyBSZWplY3QgdHJhdmVyc2FsIHBhdHRlcm5zIGluIGFueSBmb3JtXG4gICAgaWYgKGFzc2V0UGF0aC5pbmNsdWRlcygnLi4nKSB8fCBhc3NldFBhdGguc3RhcnRzV2l0aCgnLycpIHx8IGFzc2V0UGF0aC5pbmNsdWRlcygnXFxcXC4uJykpIHJldHVybiBmYWxzZTtcbiAgICAvLyBNdXN0IHN0YXJ0IHdpdGggYXNzZXRzLyBmb3IgcmVsYXRpdmUgcGF0aHNcbiAgICByZXR1cm4gYXNzZXRQYXRoLnN0YXJ0c1dpdGgoJ2Fzc2V0cy8nKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlQ3N2RmllbGQoZmllbGQ6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiBmaWVsZCAhPT0gJ3N0cmluZycpIHJldHVybiBTdHJpbmcoZmllbGQpO1xuICAgIC8vIEVzY2FwZSBmb3JtdWxhIGluamVjdGlvbiBwcmVmaXhlc1xuICAgIGlmICgvXls9K1xcLUBcXHRcXHJdLy50ZXN0KGZpZWxkKSkgZmllbGQgPSBcIidcIiArIGZpZWxkO1xuICAgIC8vIFdyYXAgaW4gcXVvdGVzIGlmIGNvbnRhaW5zIGNvbW1hLCBxdW90ZSBvciBuZXdsaW5lXG4gICAgaWYgKGZpZWxkLmluY2x1ZGVzKCcsJykgfHwgZmllbGQuaW5jbHVkZXMoJ1wiJykgfHwgZmllbGQuaW5jbHVkZXMoJ1xcbicpKSB7XG4gICAgICAgIHJldHVybiAnXCInICsgZmllbGQucmVwbGFjZSgvXCIvZywgJ1wiXCInKSArICdcIic7XG4gICAgfVxuICAgIHJldHVybiBmaWVsZDtcbn1cblxuLyoqXG4gKiBDb25zb2xpZGF0ZWQgYXNzZXQgbWFuYWdlbWVudCB0b29sLlxuICogQ29tYmluZXMgUHJvamVjdFRvb2xzIChhc3NldCBtZXRob2RzKSArIEFzc2V0QWR2YW5jZWRUb29scyBpbnRvIG9uZSBhY3Rpb24tYmFzZWQgdG9vbC5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZUFzc2V0IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2Fzc2V0JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgYXNzZXRzIGluIHRoZSBwcm9qZWN0IChmaWxlcywgdGV4dHVyZXMsIHNjcmlwdHMsIGV0YykuIEFjdGlvbnM6IGltcG9ydCwgZ2V0X2luZm8sIGxpc3QsIHJlZnJlc2gsIGNyZWF0ZSwgY29weSwgbW92ZSwgZGVsZXRlLCBzYXZlLCByZWltcG9ydCwgcXVlcnlfcGF0aCwgcXVlcnlfdXVpZCwgcXVlcnlfdXJsLCBmaW5kX2J5X25hbWUsIGdldF9kZXRhaWxzLCBzYXZlX21ldGEsIGdlbmVyYXRlX3VybCwgcXVlcnlfZGJfcmVhZHksIG9wZW5fZXh0ZXJuYWwsIGJhdGNoX2ltcG9ydCwgYmF0Y2hfZGVsZXRlLCB2YWxpZGF0ZV9yZWZlcmVuY2VzLCBnZXRfZGVwZW5kZW5jaWVzLCBnZXRfdW51c2VkLCBjb21wcmVzc190ZXh0dXJlcywgZXhwb3J0X21hbmlmZXN0LiBOT1QgZm9yIHNjZW5lIG5vZGVzIOKAlCB1c2UgbWFuYWdlX25vZGUuIFVzZSBxdWVyeV9kYl9yZWFkeSB0byBjaGVjayBhc3NldCBEQiBiZWZvcmUgYmF0Y2ggb3BzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFtcbiAgICAgICAgJ2ltcG9ydCcsICdnZXRfaW5mbycsICdsaXN0JywgJ3JlZnJlc2gnLCAnY3JlYXRlJywgJ2NvcHknLCAnbW92ZScsICdkZWxldGUnLFxuICAgICAgICAnc2F2ZScsICdyZWltcG9ydCcsICdxdWVyeV9wYXRoJywgJ3F1ZXJ5X3V1aWQnLCAncXVlcnlfdXJsJywgJ2ZpbmRfYnlfbmFtZScsXG4gICAgICAgICdnZXRfZGV0YWlscycsICdzYXZlX21ldGEnLCAnZ2VuZXJhdGVfdXJsJywgJ3F1ZXJ5X2RiX3JlYWR5JywgJ29wZW5fZXh0ZXJuYWwnLFxuICAgICAgICAnYmF0Y2hfaW1wb3J0JywgJ2JhdGNoX2RlbGV0ZScsICd2YWxpZGF0ZV9yZWZlcmVuY2VzJywgJ2dldF9kZXBlbmRlbmNpZXMnLFxuICAgICAgICAnZ2V0X3VudXNlZCcsICdjb21wcmVzc190ZXh0dXJlcycsICdleHBvcnRfbWFuaWZlc3QnXG4gICAgXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybScsXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc291cmNlUGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdTb3VyY2UgZmlsZSBwYXRoIG9uIGRpc2sgKGZvciBpbXBvcnQpJyB9LFxuICAgICAgICAgICAgdGFyZ2V0Rm9sZGVyOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBmb2xkZXIgVVJMIChmb3IgaW1wb3J0KScgfSxcbiAgICAgICAgICAgIGFzc2V0UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdBc3NldCBwYXRoIChkYjovL2Fzc2V0cy8uLi4pJyB9LFxuICAgICAgICAgICAgdXJsT3JVVUlEOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVSTCBvciBVVUlEJyB9LFxuICAgICAgICAgICAgdXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVSTCAoZGI6Ly9hc3NldHMvLi4uKScgfSxcbiAgICAgICAgICAgIHV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgVVVJRCcgfSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRmlsZSBjb250ZW50IG9yIG1ldGEgY29udGVudCcgfSxcbiAgICAgICAgICAgIG92ZXJ3cml0ZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnT3ZlcndyaXRlIGV4aXN0aW5nIGZpbGUnLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgc291cmNlOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBhc3NldCBVUkwgKGZvciBjb3B5L21vdmUpJyB9LFxuICAgICAgICAgICAgdGFyZ2V0OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBhc3NldCBVUkwgKGZvciBjb3B5L21vdmUpJyB9LFxuICAgICAgICAgICAgZm9sZGVyOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZvbGRlciB0byBzZWFyY2gvbGlzdCcsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cycgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IHR5cGUgZmlsdGVyJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdzY2VuZScsICdwcmVmYWInLCAnc2NyaXB0JywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnbWVzaCcsICdhdWRpbycsICdhbmltYXRpb24nXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnQXNzZXQgbmFtZSB0byBzZWFyY2ggZm9yJyB9LFxuICAgICAgICAgICAgZXhhY3RNYXRjaDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnRXhhY3QgbmFtZSBtYXRjaCcsIGRlZmF1bHQ6IGZhbHNlIH0sXG4gICAgICAgICAgICBhc3NldFR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZpbHRlciBieSBhc3NldCB0eXBlJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdzY2VuZScsICdwcmVmYWInLCAnc2NyaXB0JywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnbWVzaCcsICdhdWRpbycsICdhbmltYXRpb24nLCAnc3ByaXRlRnJhbWUnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heFJlc3VsdHM6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnTWF4IHJlc3VsdHMgZm9yIGZpbmRfYnlfbmFtZScsIGRlZmF1bHQ6IDIwLCBtaW5pbXVtOiAxLCBtYXhpbXVtOiAxMDAgfSxcbiAgICAgICAgICAgIGluY2x1ZGVTdWJBc3NldHM6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ0luY2x1ZGUgc3ViLWFzc2V0cyAoc3ByaXRlRnJhbWUsIHRleHR1cmUpJywgZGVmYXVsdDogdHJ1ZSB9LFxuICAgICAgICAgICAgc291cmNlRGlyZWN0b3J5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBkaXJlY3RvcnkgZm9yIGJhdGNoX2ltcG9ydCcgfSxcbiAgICAgICAgICAgIHRhcmdldERpcmVjdG9yeTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdUYXJnZXQgZGlyZWN0b3J5IFVSTCBmb3IgYmF0Y2hfaW1wb3J0JyB9LFxuICAgICAgICAgICAgZmlsZUZpbHRlcjogeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCBkZXNjcmlwdGlvbjogJ0ZpbGUgZXh0ZW5zaW9ucyBmaWx0ZXInLCBkZWZhdWx0OiBbXSB9LFxuICAgICAgICAgICAgcmVjdXJzaXZlOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdJbmNsdWRlIHN1YmRpcmVjdG9yaWVzJywgZGVmYXVsdDogZmFsc2UgfSxcbiAgICAgICAgICAgIHVybHM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdBcnJheSBvZiBhc3NldCBVUkxzIGZvciBiYXRjaF9kZWxldGUnIH0sXG4gICAgICAgICAgICBkaXJlY3Rvcnk6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnRGlyZWN0b3J5IHRvIHNjYW4nLCBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnIH0sXG4gICAgICAgICAgICBleGNsdWRlRGlyZWN0b3JpZXM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSwgZGVzY3JpcHRpb246ICdEaXJlY3RvcmllcyB0byBleGNsdWRlJywgZGVmYXVsdDogW10gfSxcbiAgICAgICAgICAgIGRpcmVjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRGVwZW5kZW5jeSBkaXJlY3Rpb24nLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZGVwZW5kZW50cycsICdkZXBlbmRlbmNpZXMnLCAnYm90aCddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkZXBlbmRlbmNpZXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9ybWF0OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGb3JtYXQgZm9yIGNvbXByZXNzX3RleHR1cmVzIG9yIGV4cG9ydF9tYW5pZmVzdCcsXG4gICAgICAgICAgICAgICAgZW51bTogWydhdXRvJywgJ2pwZycsICdwbmcnLCAnd2VicCcsICdqc29uJywgJ2NzdicsICd4bWwnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYXV0bydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBxdWFsaXR5OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ0NvbXByZXNzaW9uIHF1YWxpdHkgKDAuMS0xLjApJywgbWluaW11bTogMC4xLCBtYXhpbXVtOiAxLjAsIGRlZmF1bHQ6IDAuOCB9LFxuICAgICAgICAgICAgaW5jbHVkZU1ldGFkYXRhOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdJbmNsdWRlIGFzc2V0IG1ldGFkYXRhIGluIG1hbmlmZXN0JywgZGVmYXVsdDogdHJ1ZSB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBpbXBvcnQ6IChhcmdzKSA9PiB0aGlzLmltcG9ydEFzc2V0KGFyZ3Muc291cmNlUGF0aCwgYXJncy50YXJnZXRGb2xkZXIpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXRJbmZvKGFyZ3MuYXNzZXRQYXRoIHx8IGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXRzKGFyZ3MudHlwZSwgYXJncy5mb2xkZXIpLFxuICAgICAgICByZWZyZXNoOiAoYXJncykgPT4gdGhpcy5yZWZyZXNoQXNzZXRzKGFyZ3MuZm9sZGVyKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVBc3NldChhcmdzLnVybCwgYXJncy5jb250ZW50ID8/IG51bGwsIGFyZ3Mub3ZlcndyaXRlID09PSB0cnVlIHx8IGFyZ3Mub3ZlcndyaXRlID09PSAndHJ1ZScpLFxuICAgICAgICBjb3B5OiAoYXJncykgPT4gdGhpcy5jb3B5QXNzZXQoYXJncy5zb3VyY2UsIGFyZ3MudGFyZ2V0LCBhcmdzLm92ZXJ3cml0ZSA9PT0gdHJ1ZSB8fCBhcmdzLm92ZXJ3cml0ZSA9PT0gJ3RydWUnKSxcbiAgICAgICAgbW92ZTogKGFyZ3MpID0+IHRoaXMubW92ZUFzc2V0KGFyZ3Muc291cmNlLCBhcmdzLnRhcmdldCwgYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJyksXG4gICAgICAgIGRlbGV0ZTogKGFyZ3MpID0+IHRoaXMuZGVsZXRlQXNzZXQoYXJncy51cmwpLFxuICAgICAgICBzYXZlOiAoYXJncykgPT4gdGhpcy5zYXZlQXNzZXQoYXJncy51cmwgfHwgYXJncy51cmxPclVVSUQsIGFyZ3MuY29udGVudCksXG4gICAgICAgIHJlaW1wb3J0OiAoYXJncykgPT4gdGhpcy5yZWltcG9ydEFzc2V0KGFyZ3MudXJsIHx8IGFyZ3MudXJsT3JVVUlEKSxcbiAgICAgICAgcXVlcnlfcGF0aDogKGFyZ3MpID0+IHRoaXMucXVlcnlBc3NldFBhdGgoYXJncy51cmwgfHwgYXJncy51cmxPclVVSUQpLFxuICAgICAgICBxdWVyeV91dWlkOiAoYXJncykgPT4gdGhpcy5xdWVyeUFzc2V0VXVpZChhcmdzLnVybCksXG4gICAgICAgIHF1ZXJ5X3VybDogKGFyZ3MpID0+IHRoaXMucXVlcnlBc3NldFVybChhcmdzLnV1aWQpLFxuICAgICAgICBmaW5kX2J5X25hbWU6IChhcmdzKSA9PiB0aGlzLmZpbmRBc3NldEJ5TmFtZShhcmdzKSxcbiAgICAgICAgZ2V0X2RldGFpbHM6IChhcmdzKSA9PiB0aGlzLmdldEFzc2V0RGV0YWlscyhhcmdzLmFzc2V0UGF0aCB8fCBhcmdzLnVybE9yVVVJRCwgYXJncy5pbmNsdWRlU3ViQXNzZXRzICE9PSBmYWxzZSksXG4gICAgICAgIHNhdmVfbWV0YTogKGFyZ3MpID0+IHRoaXMuc2F2ZUFzc2V0TWV0YShhcmdzLnVybE9yVVVJRCwgYXJncy5jb250ZW50KSxcbiAgICAgICAgZ2VuZXJhdGVfdXJsOiAoYXJncykgPT4gdGhpcy5nZW5lcmF0ZUF2YWlsYWJsZVVybChhcmdzLnVybCksXG4gICAgICAgIHF1ZXJ5X2RiX3JlYWR5OiAoX2FyZ3MpID0+IHRoaXMucXVlcnlBc3NldERiUmVhZHkoKSxcbiAgICAgICAgb3Blbl9leHRlcm5hbDogKGFyZ3MpID0+IHRoaXMub3BlbkFzc2V0RXh0ZXJuYWwoYXJncy51cmxPclVVSUQpLFxuICAgICAgICBiYXRjaF9pbXBvcnQ6IChhcmdzKSA9PiB0aGlzLmJhdGNoSW1wb3J0QXNzZXRzKGFyZ3MpLFxuICAgICAgICBiYXRjaF9kZWxldGU6IChhcmdzKSA9PiB0aGlzLmJhdGNoRGVsZXRlQXNzZXRzKGFyZ3MudXJscyksXG4gICAgICAgIHZhbGlkYXRlX3JlZmVyZW5jZXM6IChhcmdzKSA9PiB0aGlzLnZhbGlkYXRlQXNzZXRSZWZlcmVuY2VzKGFyZ3MuZGlyZWN0b3J5KSxcbiAgICAgICAgZ2V0X2RlcGVuZGVuY2llczogKGFyZ3MpID0+IHRoaXMuZ2V0QXNzZXREZXBlbmRlbmNpZXMoYXJncy51cmxPclVVSUQsIGFyZ3MuZGlyZWN0aW9uKSxcbiAgICAgICAgZ2V0X3VudXNlZDogKGFyZ3MpID0+IHRoaXMuZ2V0VW51c2VkQXNzZXRzKGFyZ3MuZGlyZWN0b3J5LCBhcmdzLmV4Y2x1ZGVEaXJlY3RvcmllcyksXG4gICAgICAgIGNvbXByZXNzX3RleHR1cmVzOiAoYXJncykgPT4gdGhpcy5jb21wcmVzc1RleHR1cmVzKGFyZ3MuZGlyZWN0b3J5LCBhcmdzLmZvcm1hdCwgYXJncy5xdWFsaXR5KSxcbiAgICAgICAgZXhwb3J0X21hbmlmZXN0OiAoYXJncykgPT4gdGhpcy5leHBvcnRBc3NldE1hbmlmZXN0KGFyZ3MuZGlyZWN0b3J5LCBhcmdzLmZvcm1hdCwgYXJncy5pbmNsdWRlTWV0YWRhdGEgIT09IGZhbHNlKVxuICAgIH07XG5cbiAgICAvLyDilIDilIAgRnJvbSBQcm9qZWN0VG9vbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBwcml2YXRlIGFzeW5jIGltcG9ydEFzc2V0KHNvdXJjZVBhdGg6IHN0cmluZywgdGFyZ2V0Rm9sZGVyOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKHNvdXJjZVBhdGgpKSByZXR1cm4gZXJyb3JSZXN1bHQoJ1NvdXJjZSBmaWxlIG5vdCBmb3VuZCcpO1xuICAgICAgICBpZiAoIXZhbGlkYXRlQXNzZXRQYXRoKHRhcmdldEZvbGRlcikpIHJldHVybiBlcnJvclJlc3VsdCgnSW52YWxpZCB0YXJnZXQgZm9sZGVyIHBhdGg6IG11c3QgYmUgZGI6Ly8gVVJMIG9yIGFzc2V0cy8gcmVsYXRpdmUgcGF0aCB3aXRob3V0IHRyYXZlcnNhbCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKHNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IHRhcmdldEZvbGRlci5zdGFydHNXaXRoKCdkYjovLycpID8gdGFyZ2V0Rm9sZGVyIDogYGRiOi8vYXNzZXRzLyR7dGFyZ2V0Rm9sZGVyfWA7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2ltcG9ydC1hc3NldCcsIHNvdXJjZVBhdGgsIGAke3RhcmdldFBhdGh9LyR7ZmlsZU5hbWV9YCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQ6IHJlc3VsdC51dWlkLCBwYXRoOiByZXN1bHQudXJsLCBtZXNzYWdlOiBgQXNzZXQgaW1wb3J0ZWQ6ICR7ZmlsZU5hbWV9YCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0SW5mbyhhc3NldFBhdGg6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IG5vdCBmb3VuZCcpO1xuICAgICAgICAgICAgY29uc3QgaW5mbzogYW55ID0ge1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgICAgIHV1aWQ6IGFzc2V0SW5mby51dWlkLFxuICAgICAgICAgICAgICAgIHBhdGg6IGFzc2V0SW5mby51cmwsXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXRJbmZvLnR5cGUsXG4gICAgICAgICAgICAgICAgc2l6ZTogYXNzZXRJbmZvLnNpemUsXG4gICAgICAgICAgICAgICAgaXNEaXJlY3Rvcnk6IGFzc2V0SW5mby5pc0RpcmVjdG9yeVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8ubWV0YSkge1xuICAgICAgICAgICAgICAgIGluZm8ubWV0YSA9IHsgdmVyOiBhc3NldEluZm8ubWV0YS52ZXIsIGltcG9ydGVyOiBhc3NldEluZm8ubWV0YS5pbXBvcnRlciB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBc3NldHModHlwZTogc3RyaW5nID0gJ2FsbCcsIGZvbGRlcjogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHBhdHRlcm4gPSBgJHtmb2xkZXJ9LyoqLypgO1xuICAgICAgICAgICAgaWYgKHR5cGUgIT09ICdhbGwnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZUV4dGVuc2lvbnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICAgICAgICAgICdzY2VuZSc6ICcuc2NlbmUnLCAncHJlZmFiJzogJy5wcmVmYWInLCAnc2NyaXB0JzogJy57dHMsanN9JyxcbiAgICAgICAgICAgICAgICAgICAgJ3RleHR1cmUnOiAnLntwbmcsanBnLGpwZWcsZ2lmLHRnYSxibXAscHNkfScsICdtYXRlcmlhbCc6ICcubXRsJyxcbiAgICAgICAgICAgICAgICAgICAgJ21lc2gnOiAnLntmYngsb2JqLGRhZX0nLCAnYXVkaW8nOiAnLnttcDMsb2dnLHdhdixtNGF9JywgJ2FuaW1hdGlvbic6ICcue2FuaW0sY2xpcH0nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjb25zdCBleHRlbnNpb24gPSB0eXBlRXh0ZW5zaW9uc1t0eXBlXTtcbiAgICAgICAgICAgICAgICBpZiAoZXh0ZW5zaW9uKSBwYXR0ZXJuID0gYCR7Zm9sZGVyfS8qKi8qJHtleHRlbnNpb259YDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gcmVzdWx0cy5tYXAoYXNzZXQgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLCB1dWlkOiBhc3NldC51dWlkLCBwYXRoOiBhc3NldC51cmwsXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSwgc2l6ZTogYXNzZXQuc2l6ZSB8fCAwLCBpc0RpcmVjdG9yeTogYXNzZXQuaXNEaXJlY3RvcnkgfHwgZmFsc2VcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdHlwZSwgZm9sZGVyLCBjb3VudDogYXNzZXRzLmxlbmd0aCwgYXNzZXRzIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVmcmVzaEFzc2V0cyhmb2xkZXI/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFBhdGggPSBmb2xkZXIgfHwgJ2RiOi8vYXNzZXRzJztcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCB0YXJnZXRQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBBc3NldHMgcmVmcmVzaGVkIGluOiAke3RhcmdldFBhdGh9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBc3NldCh1cmw6IHN0cmluZywgY29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGwsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBvcHRpb25zID0geyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9O1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCB1cmwsIGNvbnRlbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgbXNnID0gY29udGVudCA9PT0gbnVsbCA/ICdGb2xkZXIgY3JlYXRlZCBzdWNjZXNzZnVsbHknIDogJ0ZpbGUgY3JlYXRlZCBzdWNjZXNzZnVsbHknO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0ICYmIHJlc3VsdC51dWlkID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsLCBtZXNzYWdlOiBtc2cgfSA6IHsgdXJsLCBtZXNzYWdlOiBtc2cgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjb3B5QXNzZXQoc291cmNlOiBzdHJpbmcsIHRhcmdldDogc3RyaW5nLCBvdmVyd3JpdGU6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjb3B5LWFzc2V0Jywgc291cmNlLCB0YXJnZXQsIHsgb3ZlcndyaXRlLCByZW5hbWU6ICFvdmVyd3JpdGUgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQgJiYgcmVzdWx0LnV1aWRcbiAgICAgICAgICAgICAgICA/IHsgdXVpZDogcmVzdWx0LnV1aWQsIHVybDogcmVzdWx0LnVybCwgbWVzc2FnZTogJ0Fzc2V0IGNvcGllZCBzdWNjZXNzZnVsbHknIH1cbiAgICAgICAgICAgICAgICA6IHsgc291cmNlLCB0YXJnZXQsIG1lc3NhZ2U6ICdBc3NldCBjb3BpZWQgc3VjY2Vzc2Z1bGx5JyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIG1vdmVBc3NldChzb3VyY2U6IHN0cmluZywgdGFyZ2V0OiBzdHJpbmcsIG92ZXJ3cml0ZTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ21vdmUtYXNzZXQnLCBzb3VyY2UsIHRhcmdldCwgeyBvdmVyd3JpdGUsIHJlbmFtZTogIW92ZXJ3cml0ZSB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZFxuICAgICAgICAgICAgICAgID8geyB1dWlkOiByZXN1bHQudXVpZCwgdXJsOiByZXN1bHQudXJsLCBtZXNzYWdlOiAnQXNzZXQgbW92ZWQgc3VjY2Vzc2Z1bGx5JyB9XG4gICAgICAgICAgICAgICAgOiB7IHNvdXJjZSwgdGFyZ2V0LCBtZXNzYWdlOiAnQXNzZXQgbW92ZWQgc3VjY2Vzc2Z1bGx5JyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRlbGV0ZUFzc2V0KHVybDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdkZWxldGUtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmwgfSwgJ0Fzc2V0IGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXQodXJsOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgdXJsLCBjb250ZW50KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCAmJiByZXN1bHQudXVpZCA/IHsgdXVpZDogcmVzdWx0LnV1aWQsIHVybDogcmVzdWx0LnVybCB9IDogeyB1cmwgfSwgJ0Fzc2V0IHNhdmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVpbXBvcnRBc3NldCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVpbXBvcnQtYXNzZXQnLCB1cmwpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmwgfSwgJ0Fzc2V0IHJlaW1wb3J0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUFzc2V0UGF0aCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRQYXRoOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcGF0aCcsIHVybCkgYXMgc3RyaW5nIHwgbnVsbDtcbiAgICAgICAgICAgIGlmIChhc3NldFBhdGgpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsLCBwYXRoOiBhc3NldFBhdGggfSwgJ0Fzc2V0IHBhdGggcmV0cmlldmVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdBc3NldCBwYXRoIG5vdCBmb3VuZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldFV1aWQodXJsOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQ6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgdXJsKSBhcyBzdHJpbmcgfCBudWxsO1xuICAgICAgICAgICAgaWYgKHV1aWQpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsLCB1dWlkIH0sICdBc3NldCBVVUlEIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnQXNzZXQgVVVJRCBub3QgZm91bmQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QXNzZXRVcmwodXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1cmw6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11cmwnLCB1dWlkKSBhcyBzdHJpbmcgfCBudWxsO1xuICAgICAgICAgICAgaWYgKHVybCkgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1dWlkLCB1cmwgfSwgJ0Fzc2V0IFVSTCByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IFVSTCBub3QgZm91bmQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZpbmRBc3NldEJ5TmFtZShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBuYW1lLCBleGFjdE1hdGNoID0gZmFsc2UsIGFzc2V0VHlwZSA9ICdhbGwnLCBmb2xkZXIgPSAnZGI6Ly9hc3NldHMnLCBtYXhSZXN1bHRzID0gMjAgfSA9IGFyZ3M7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhbGxBc3NldHNSZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFzc2V0cyhhc3NldFR5cGUsIGZvbGRlcik7XG4gICAgICAgICAgICBpZiAoIWFsbEFzc2V0c1Jlc3VsdC5zdWNjZXNzIHx8ICFhbGxBc3NldHNSZXN1bHQuZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBhc3NldHM6ICR7YWxsQXNzZXRzUmVzdWx0LmVycm9yfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYWxsQXNzZXRzID0gYWxsQXNzZXRzUmVzdWx0LmRhdGEuYXNzZXRzIGFzIGFueVtdO1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZEFzc2V0czogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYWxsQXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGV4YWN0TWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgPyBhc3NldC5uYW1lID09PSBuYW1lXG4gICAgICAgICAgICAgICAgICAgIDogYXNzZXQubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKG5hbWUudG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRldGFpbFJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QXNzZXRJbmZvKGFzc2V0LnBhdGgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZEFzc2V0cy5wdXNoKGRldGFpbFJlc3VsdC5zdWNjZXNzID8geyAuLi5hc3NldCwgZGV0YWlsczogZGV0YWlsUmVzdWx0LmRhdGEgfSA6IGFzc2V0KTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkQXNzZXRzLnB1c2goYXNzZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChtYXRjaGVkQXNzZXRzLmxlbmd0aCA+PSBtYXhSZXN1bHRzKSBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgc2VhcmNoVGVybTogbmFtZSwgZXhhY3RNYXRjaCwgYXNzZXRUeXBlLCBmb2xkZXIsXG4gICAgICAgICAgICAgICAgdG90YWxGb3VuZDogbWF0Y2hlZEFzc2V0cy5sZW5ndGgsIG1heFJlc3VsdHMsIGFzc2V0czogbWF0Y2hlZEFzc2V0c1xuICAgICAgICAgICAgfSwgYEZvdW5kICR7bWF0Y2hlZEFzc2V0cy5sZW5ndGh9IGFzc2V0cyBtYXRjaGluZyAnJHtuYW1lfSdgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBBc3NldCBzZWFyY2ggZmFpbGVkOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFzc2V0RGV0YWlscyhhc3NldFBhdGg6IHN0cmluZywgaW5jbHVkZVN1YkFzc2V0czogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mb1Jlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QXNzZXRJbmZvKGFzc2V0UGF0aCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mb1Jlc3VsdC5zdWNjZXNzKSByZXR1cm4gYXNzZXRJbmZvUmVzdWx0O1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXNzZXRJbmZvUmVzdWx0LmRhdGE7XG4gICAgICAgICAgICBjb25zdCBkZXRhaWxlZEluZm86IGFueSA9IHsgLi4uYXNzZXRJbmZvLCBzdWJBc3NldHM6IFtdIH07XG4gICAgICAgICAgICBpZiAoaW5jbHVkZVN1YkFzc2V0cyAmJiBhc3NldEluZm8pIHtcbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRJbmZvLnR5cGUgPT09ICdjYy5JbWFnZUFzc2V0JyB8fCBhc3NldFBhdGgubWF0Y2goL1xcLihwbmd8anBnfGpwZWd8Z2lmfHRnYXxibXB8cHNkKSQvaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYmFzZVV1aWQgPSBhc3NldEluZm8udXVpZDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zc2libGVTdWJBc3NldHMgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdzcHJpdGVGcmFtZScsIHV1aWQ6IGAke2Jhc2VVdWlkfUBmOTk0MWAsIHN1ZmZpeDogJ0BmOTk0MScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ3RleHR1cmUnLCB1dWlkOiBgJHtiYXNlVXVpZH1ANmM0OGFgLCBzdWZmaXg6ICdANmM0OGEnIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICd0ZXh0dXJlMkQnLCB1dWlkOiBgJHtiYXNlVXVpZH1ANmM0OGFgLCBzdWZmaXg6ICdANmM0OGEnIH1cbiAgICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBzdWJBc3NldCBvZiBwb3NzaWJsZVN1YkFzc2V0cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJBc3NldFVybCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXVybCcsIHN1YkFzc2V0LnV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdWJBc3NldFVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXRhaWxlZEluZm8uc3ViQXNzZXRzLnB1c2goeyB0eXBlOiBzdWJBc3NldC50eXBlLCB1dWlkOiBzdWJBc3NldC51dWlkLCB1cmw6IHN1YkFzc2V0VXJsLCBzdWZmaXg6IHN1YkFzc2V0LnN1ZmZpeCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHsgLyogc3ViLWFzc2V0IGRvZXNuJ3QgZXhpc3QsIHNraXAgKi8gfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBhc3NldFBhdGgsIGluY2x1ZGVTdWJBc3NldHMsIC4uLmRldGFpbGVkSW5mbyB9LCBgQXNzZXQgZGV0YWlscyByZXRyaWV2ZWQuIEZvdW5kICR7ZGV0YWlsZWRJbmZvLnN1YkFzc2V0cy5sZW5ndGh9IHN1Yi1hc3NldHMuYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBhc3NldCBkZXRhaWxzOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDilIDilIAgRnJvbSBBc3NldEFkdmFuY2VkVG9vbHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVBc3NldE1ldGEodXJsT3JVVUlEOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCB1cmxPclVVSUQsIGNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1dWlkOiByZXN1bHQ/LnV1aWQsIHVybDogcmVzdWx0Py51cmwgfSwgJ0Fzc2V0IG1ldGEgc2F2ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZW5lcmF0ZUF2YWlsYWJsZVVybCh1cmw6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVXJsOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdnZW5lcmF0ZS1hdmFpbGFibGUtdXJsJywgdXJsKSBhcyBzdHJpbmc7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgb3JpZ2luYWxVcmw6IHVybCwgYXZhaWxhYmxlVXJsLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGF2YWlsYWJsZVVybCA9PT0gdXJsID8gJ1VSTCBpcyBhdmFpbGFibGUnIDogJ0dlbmVyYXRlZCBuZXcgYXZhaWxhYmxlIFVSTCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlBc3NldERiUmVhZHkoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZWFkeTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXJlYWR5JykgYXMgYm9vbGVhbjtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgcmVhZHksIG1lc3NhZ2U6IHJlYWR5ID8gJ0Fzc2V0IGRhdGFiYXNlIGlzIHJlYWR5JyA6ICdBc3NldCBkYXRhYmFzZSBpcyBub3QgcmVhZHknIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkFzc2V0RXh0ZXJuYWwodXJsT3JVVUlEOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCB1cmxPclVVSUQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ0Fzc2V0IG9wZW5lZCB3aXRoIGV4dGVybmFsIHByb2dyYW0nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJhdGNoSW1wb3J0QXNzZXRzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgb3ZlcndyaXRlOiBib29sZWFuID0gYXJncy5vdmVyd3JpdGUgPT09IHRydWUgfHwgYXJncy5vdmVyd3JpdGUgPT09ICd0cnVlJztcbiAgICAgICAgICAgIGNvbnN0IHJlY3Vyc2l2ZTogYm9vbGVhbiA9IGFyZ3MucmVjdXJzaXZlID09PSB0cnVlIHx8IGFyZ3MucmVjdXJzaXZlID09PSAndHJ1ZSc7XG4gICAgICAgICAgICBpZiAoIXZhbGlkYXRlQXNzZXRQYXRoKGFyZ3MudGFyZ2V0RGlyZWN0b3J5IHx8ICcnKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnSW52YWxpZCB0YXJnZXREaXJlY3Rvcnk6IG11c3QgYmUgZGI6Ly8gVVJMIG9yIGFzc2V0cy8gcmVsYXRpdmUgcGF0aCB3aXRob3V0IHRyYXZlcnNhbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGFyZ3Muc291cmNlRGlyZWN0b3J5KSkgcmV0dXJuIGVycm9yUmVzdWx0KCdTb3VyY2UgZGlyZWN0b3J5IGRvZXMgbm90IGV4aXN0Jyk7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IHRoaXMuZ2V0RmlsZXNGcm9tRGlyZWN0b3J5KGFyZ3Muc291cmNlRGlyZWN0b3J5LCBhcmdzLmZpbGVGaWx0ZXIgfHwgW10sIHJlY3Vyc2l2ZSk7XG4gICAgICAgICAgICBjb25zdCBpbXBvcnRSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpbGVQYXRoIG9mIGZpbGVzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZU5hbWUgPSBwYXRoLmJhc2VuYW1lKGZpbGVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0UGF0aCA9IGAke2FyZ3MudGFyZ2V0RGlyZWN0b3J5fS8ke2ZpbGVOYW1lfWA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2ltcG9ydC1hc3NldCcsIGZpbGVQYXRoLCB0YXJnZXRQYXRoLCB7IG92ZXJ3cml0ZSwgcmVuYW1lOiAhb3ZlcndyaXRlIH0pO1xuICAgICAgICAgICAgICAgICAgICBpbXBvcnRSZXN1bHRzLnB1c2goeyBzb3VyY2U6IGZpbGVQYXRoLCB0YXJnZXQ6IHRhcmdldFBhdGgsIHN1Y2Nlc3M6IHRydWUsIHV1aWQ6IChyZXN1bHQgYXMgYW55KT8udXVpZCB9KTtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2Vzc0NvdW50Kys7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgaW1wb3J0UmVzdWx0cy5wdXNoKHsgc291cmNlOiBmaWxlUGF0aCwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICAgICAgZXJyb3JDb3VudCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdG90YWxGaWxlczogZmlsZXMubGVuZ3RoLCBzdWNjZXNzQ291bnQsIGVycm9yQ291bnQsIHJlc3VsdHM6IGltcG9ydFJlc3VsdHMgfSxcbiAgICAgICAgICAgICAgICBgQmF0Y2ggaW1wb3J0IGNvbXBsZXRlZDogJHtzdWNjZXNzQ291bnR9IHN1Y2Nlc3MsICR7ZXJyb3JDb3VudH0gZXJyb3JzYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRGaWxlc0Zyb21EaXJlY3RvcnkoZGlyUGF0aDogc3RyaW5nLCBmaWxlRmlsdGVyOiBzdHJpbmdbXSwgcmVjdXJzaXZlOiBib29sZWFuKTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBmaWxlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgaXRlbXMgPSBmcy5yZWFkZGlyU3luYyhkaXJQYXRoKTtcbiAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXJQYXRoLCBpdGVtKTtcbiAgICAgICAgICAgIGNvbnN0IHN0YXQgPSBmcy5zdGF0U3luYyhmdWxsUGF0aCk7XG4gICAgICAgICAgICBpZiAoc3RhdC5pc0ZpbGUoKSkge1xuICAgICAgICAgICAgICAgIGlmIChmaWxlRmlsdGVyLmxlbmd0aCA9PT0gMCB8fCBmaWxlRmlsdGVyLnNvbWUoZXh0ID0+IGl0ZW0udG9Mb3dlckNhc2UoKS5lbmRzV2l0aChleHQudG9Mb3dlckNhc2UoKSkpKSB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goZnVsbFBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdC5pc0RpcmVjdG9yeSgpICYmIHJlY3Vyc2l2ZSkge1xuICAgICAgICAgICAgICAgIGZpbGVzLnB1c2goLi4udGhpcy5nZXRGaWxlc0Zyb21EaXJlY3RvcnkoZnVsbFBhdGgsIGZpbGVGaWx0ZXIsIHJlY3Vyc2l2ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWxlcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJhdGNoRGVsZXRlQXNzZXRzKHVybHM6IHN0cmluZ1tdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkZWxldGVSZXN1bHRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgbGV0IHN1Y2Nlc3NDb3VudCA9IDA7XG4gICAgICAgICAgICBsZXQgZXJyb3JDb3VudCA9IDA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHVybCBvZiB1cmxzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnZGVsZXRlLWFzc2V0JywgdXJsKTtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlUmVzdWx0cy5wdXNoKHsgdXJsLCBzdWNjZXNzOiB0cnVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzQ291bnQrKztcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGVSZXN1bHRzLnB1c2goeyB1cmwsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yQ291bnQrKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHRvdGFsQXNzZXRzOiB1cmxzLmxlbmd0aCwgc3VjY2Vzc0NvdW50LCBlcnJvckNvdW50LCByZXN1bHRzOiBkZWxldGVSZXN1bHRzIH0sXG4gICAgICAgICAgICAgICAgYEJhdGNoIGRlbGV0ZSBjb21wbGV0ZWQ6ICR7c3VjY2Vzc0NvdW50fSBzdWNjZXNzLCAke2Vycm9yQ291bnR9IGVycm9yc2ApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVBc3NldFJlZmVyZW5jZXMoZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuOiBgJHtkaXJlY3Rvcnl9LyoqLypgIH0pO1xuICAgICAgICAgICAgY29uc3QgYnJva2VuUmVmZXJlbmNlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkUmVmZXJlbmNlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0LnVybCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8pIHZhbGlkUmVmZXJlbmNlcy5wdXNoKHsgdXJsOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsIG5hbWU6IGFzc2V0Lm5hbWUgfSk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGJyb2tlblJlZmVyZW5jZXMucHVzaCh7IHVybDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLCBuYW1lOiBhc3NldC5uYW1lLCBlcnJvcjogKGVyciBhcyBFcnJvcikubWVzc2FnZSB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgZGlyZWN0b3J5LCB0b3RhbEFzc2V0czogYXNzZXRzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICB2YWxpZFJlZmVyZW5jZXM6IHZhbGlkUmVmZXJlbmNlcy5sZW5ndGgsIGJyb2tlblJlZmVyZW5jZXM6IGJyb2tlblJlZmVyZW5jZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGJyb2tlbkFzc2V0czogYnJva2VuUmVmZXJlbmNlc1xuICAgICAgICAgICAgfSwgYFZhbGlkYXRpb24gY29tcGxldGVkOiAke2Jyb2tlblJlZmVyZW5jZXMubGVuZ3RofSBicm9rZW4gcmVmZXJlbmNlcyBmb3VuZGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QXNzZXREZXBlbmRlbmNpZXMoX3VybE9yVVVJRDogc3RyaW5nLCBfZGlyZWN0aW9uOiBzdHJpbmcgPSAnZGVwZW5kZW5jaWVzJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0Fzc2V0IGRlcGVuZGVuY3kgYW5hbHlzaXMgcmVxdWlyZXMgYWRkaXRpb25hbCBBUElzIG5vdCBhdmFpbGFibGUgaW4gY3VycmVudCBDb2NvcyBDcmVhdG9yIE1DUCBpbXBsZW1lbnRhdGlvbi4gQ29uc2lkZXIgdXNpbmcgdGhlIEVkaXRvciBVSSBmb3IgZGVwZW5kZW5jeSBhbmFseXNpcy4nKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFVudXNlZEFzc2V0cyhfZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBfZXhjbHVkZURpcmVjdG9yaWVzOiBzdHJpbmdbXSA9IFtdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnVW51c2VkIGFzc2V0IGRldGVjdGlvbiByZXF1aXJlcyBjb21wcmVoZW5zaXZlIHByb2plY3QgYW5hbHlzaXMgbm90IGF2YWlsYWJsZSBpbiBjdXJyZW50IENvY29zIENyZWF0b3IgTUNQIGltcGxlbWVudGF0aW9uLiBDb25zaWRlciB1c2luZyB0aGUgRWRpdG9yIFVJIG9yIHRoaXJkLXBhcnR5IHRvb2xzIGZvciB1bnVzZWQgYXNzZXQgZGV0ZWN0aW9uLicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY29tcHJlc3NUZXh0dXJlcyhfZGlyZWN0b3J5OiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnLCBfZm9ybWF0OiBzdHJpbmcgPSAnYXV0bycsIF9xdWFsaXR5OiBudW1iZXIgPSAwLjgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFwiVGV4dHVyZSBjb21wcmVzc2lvbiByZXF1aXJlcyBpbWFnZSBwcm9jZXNzaW5nIGNhcGFiaWxpdGllcyBub3QgYXZhaWxhYmxlIGluIGN1cnJlbnQgQ29jb3MgQ3JlYXRvciBNQ1AgaW1wbGVtZW50YXRpb24uIFVzZSB0aGUgRWRpdG9yJ3MgYnVpbHQtaW4gdGV4dHVyZSBjb21wcmVzc2lvbiBzZXR0aW5ncyBvciBleHRlcm5hbCB0b29scy5cIik7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleHBvcnRBc3NldE1hbmlmZXN0KGRpcmVjdG9yeTogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJywgZm9ybWF0OiBzdHJpbmcgPSAnanNvbicsIGluY2x1ZGVNZXRhZGF0YTogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm46IGAke2RpcmVjdG9yeX0vKiovKmAgfSk7XG4gICAgICAgICAgICBjb25zdCBtYW5pZmVzdDogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgYXNzZXQgb2YgYXNzZXRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWFuaWZlc3RFbnRyeTogYW55ID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLCB1cmw6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogYXNzZXQudHlwZSwgc2l6ZTogKGFzc2V0IGFzIGFueSkuc2l6ZSB8fCAwLCBpc0RpcmVjdG9yeTogYXNzZXQuaXNEaXJlY3RvcnkgfHwgZmFsc2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGlmIChpbmNsdWRlTWV0YWRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFzc2V0LnVybCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIGFzc2V0SW5mby5tZXRhKSBtYW5pZmVzdEVudHJ5Lm1ldGEgPSBhc3NldEluZm8ubWV0YTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7IC8qIHNraXAgbWV0YWRhdGEgaWYgbm90IGF2YWlsYWJsZSAqLyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1hbmlmZXN0LnB1c2gobWFuaWZlc3RFbnRyeSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgZXhwb3J0RGF0YTogc3RyaW5nO1xuICAgICAgICAgICAgc3dpdGNoIChmb3JtYXQpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdjc3YnOiBleHBvcnREYXRhID0gdGhpcy5jb252ZXJ0VG9DU1YobWFuaWZlc3QpOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICd4bWwnOiBleHBvcnREYXRhID0gdGhpcy5jb252ZXJ0VG9YTUwobWFuaWZlc3QpOyBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBleHBvcnREYXRhID0gSlNPTi5zdHJpbmdpZnkobWFuaWZlc3QsIG51bGwsIDIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBkaXJlY3RvcnksIGZvcm1hdCwgYXNzZXRDb3VudDogbWFuaWZlc3QubGVuZ3RoLCBpbmNsdWRlTWV0YWRhdGEsIG1hbmlmZXN0OiBleHBvcnREYXRhIH0sXG4gICAgICAgICAgICAgICAgYEFzc2V0IG1hbmlmZXN0IGV4cG9ydGVkIHdpdGggJHttYW5pZmVzdC5sZW5ndGh9IGFzc2V0c2ApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgY29udmVydFRvQ1NWKGRhdGE6IGFueVtdKTogc3RyaW5nIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoID09PSAwKSByZXR1cm4gJyc7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBPYmplY3Qua2V5cyhkYXRhWzBdKTtcbiAgICAgICAgY29uc3QgY3N2Um93cyA9IFtoZWFkZXJzLm1hcChoID0+IGVzY2FwZUNzdkZpZWxkKGgpKS5qb2luKCcsJyldO1xuICAgICAgICBmb3IgKGNvbnN0IHJvdyBvZiBkYXRhKSB7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZXMgPSBoZWFkZXJzLm1hcChoZWFkZXIgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gcm93W2hlYWRlcl07XG4gICAgICAgICAgICAgICAgY29uc3Qgc3RyID0gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IEpTT04uc3RyaW5naWZ5KHZhbHVlKSA6IFN0cmluZyh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVzY2FwZUNzdkZpZWxkKHN0cik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNzdlJvd3MucHVzaCh2YWx1ZXMuam9pbignLCcpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3N2Um93cy5qb2luKCdcXG4nKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNvbnZlcnRUb1hNTChkYXRhOiBhbnlbXSk6IHN0cmluZyB7XG4gICAgICAgIGxldCB4bWwgPSAnPD94bWwgdmVyc2lvbj1cIjEuMFwiIGVuY29kaW5nPVwiVVRGLThcIj8+XFxuPGFzc2V0cz5cXG4nO1xuICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZGF0YSkge1xuICAgICAgICAgICAgeG1sICs9ICcgIDxhc3NldD5cXG4nO1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB4bWxWYWx1ZSA9IHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgP1xuICAgICAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSkgOlxuICAgICAgICAgICAgICAgICAgICBTdHJpbmcodmFsdWUpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbiAgICAgICAgICAgICAgICB4bWwgKz0gYCAgICA8JHtrZXl9PiR7eG1sVmFsdWV9PC8ke2tleX0+XFxuYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhtbCArPSAnICA8L2Fzc2V0Plxcbic7XG4gICAgICAgIH1cbiAgICAgICAgeG1sICs9ICc8L2Fzc2V0cz4nO1xuICAgICAgICByZXR1cm4geG1sO1xuICAgIH1cbn1cbiJdfQ==