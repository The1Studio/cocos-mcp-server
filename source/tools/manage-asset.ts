import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Consolidated asset management tool.
 * Combines ProjectTools (asset methods) + AssetAdvancedTools into one action-based tool.
 */
export class ManageAsset extends BaseActionTool {
    readonly name = 'manage_asset';
    readonly description = 'Manage assets in the project (files, textures, scripts, etc). Actions: import, get_info, list, refresh, create, copy, move, delete, save, reimport, query_path, query_uuid, query_url, find_by_name, get_details, save_meta, generate_url, query_db_ready, open_external, batch_import, batch_delete, validate_references, get_dependencies, get_unused, compress_textures, export_manifest. NOT for scene nodes — use manage_node. Use query_db_ready to check asset DB before batch ops.';
    readonly actions = [
        'import', 'get_info', 'list', 'refresh', 'create', 'copy', 'move', 'delete',
        'save', 'reimport', 'query_path', 'query_uuid', 'query_url', 'find_by_name',
        'get_details', 'save_meta', 'generate_url', 'query_db_ready', 'open_external',
        'batch_import', 'batch_delete', 'validate_references', 'get_dependencies',
        'get_unused', 'compress_textures', 'export_manifest'
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        import: (args) => this.importAsset(args.sourcePath, args.targetFolder),
        get_info: (args) => this.getAssetInfo(args.assetPath || args.urlOrUUID),
        list: (args) => this.getAssets(args.type, args.folder),
        refresh: (args) => this.refreshAssets(args.folder),
        create: (args) => this.createAsset(args.url, args.content ?? null, args.overwrite === true || args.overwrite === 'true'),
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

    // ── From ProjectTools ────────────────────────────────────────────────────

    private async importAsset(sourcePath: string, targetFolder: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            if (!fs.existsSync(sourcePath)) {
                resolve(errorResult('Source file not found'));
                return;
            }

            const fileName = path.basename(sourcePath);
            const targetPath = targetFolder.startsWith('db://') ?
                targetFolder : `db://assets/${targetFolder}`;

            Editor.Message.request('asset-db', 'import-asset', sourcePath, `${targetPath}/${fileName}`).then((result: any) => {
                resolve(successResult({
                    uuid: result.uuid,
                    path: result.url,
                    message: `Asset imported: ${fileName}`
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getAssetInfo(assetPath: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-asset-info', assetPath).then((assetInfo: any) => {
                if (!assetInfo) {
                    resolve(errorResult('Asset not found'));
                    return;
                }

                const info: any = {
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

                resolve(successResult(info));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getAssets(type: string = 'all', folder: string = 'db://assets'): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            let pattern = `${folder}/**/*`;

            if (type !== 'all') {
                const typeExtensions: Record<string, string> = {
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

            Editor.Message.request('asset-db', 'query-assets', { pattern }).then((results: any[]) => {
                const assets = results.map(asset => ({
                    name: asset.name,
                    uuid: asset.uuid,
                    path: asset.url,
                    type: asset.type,
                    size: asset.size || 0,
                    isDirectory: asset.isDirectory || false
                }));

                resolve(successResult({
                    type,
                    folder,
                    count: assets.length,
                    assets
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async refreshAssets(folder?: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const targetPath = folder || 'db://assets';

            Editor.Message.request('asset-db', 'refresh-asset', targetPath).then(() => {
                resolve(successResult(null, `Assets refreshed in: ${targetPath}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async createAsset(url: string, content: string | null = null, overwrite: boolean = false): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const options = {
                overwrite,
                rename: !overwrite
            };

            Editor.Message.request('asset-db', 'create-asset', url, content, options).then((result: any) => {
                if (result && result.uuid) {
                    resolve(successResult({
                        uuid: result.uuid,
                        url: result.url,
                        message: content === null ? 'Folder created successfully' : 'File created successfully'
                    }));
                } else {
                    resolve(successResult({
                        url,
                        message: content === null ? 'Folder created successfully' : 'File created successfully'
                    }));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async copyAsset(source: string, target: string, overwrite: boolean = false): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const options = { overwrite, rename: !overwrite };

            Editor.Message.request('asset-db', 'copy-asset', source, target, options).then((result: any) => {
                if (result && result.uuid) {
                    resolve(successResult({
                        uuid: result.uuid,
                        url: result.url,
                        message: 'Asset copied successfully'
                    }));
                } else {
                    resolve(successResult({
                        source,
                        target,
                        message: 'Asset copied successfully'
                    }));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async moveAsset(source: string, target: string, overwrite: boolean = false): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const options = { overwrite, rename: !overwrite };

            Editor.Message.request('asset-db', 'move-asset', source, target, options).then((result: any) => {
                if (result && result.uuid) {
                    resolve(successResult({
                        uuid: result.uuid,
                        url: result.url,
                        message: 'Asset moved successfully'
                    }));
                } else {
                    resolve(successResult({
                        source,
                        target,
                        message: 'Asset moved successfully'
                    }));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async deleteAsset(url: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'delete-asset', url).then(() => {
                resolve(successResult({ url }, 'Asset deleted successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async saveAsset(url: string, content: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'save-asset', url, content).then((result: any) => {
                if (result && result.uuid) {
                    resolve(successResult({
                        uuid: result.uuid,
                        url: result.url
                    }, 'Asset saved successfully'));
                } else {
                    resolve(successResult({ url }, 'Asset saved successfully'));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async reimportAsset(url: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'reimport-asset', url).then(() => {
                resolve(successResult({ url }, 'Asset reimported successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryAssetPath(url: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-path', url).then((assetPath: string | null) => {
                if (assetPath) {
                    resolve(successResult({ url, path: assetPath }, 'Asset path retrieved successfully'));
                } else {
                    resolve(errorResult('Asset path not found'));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryAssetUuid(url: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-uuid', url).then((uuid: string | null) => {
                if (uuid) {
                    resolve(successResult({ url, uuid }, 'Asset UUID retrieved successfully'));
                } else {
                    resolve(errorResult('Asset UUID not found'));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryAssetUrl(uuid: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-url', uuid).then((url: string | null) => {
                if (url) {
                    resolve(successResult({ uuid, url }, 'Asset URL retrieved successfully'));
                } else {
                    resolve(errorResult('Asset URL not found'));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async findAssetByName(args: any): Promise<ActionToolResult> {
        const { name, exactMatch = false, assetType = 'all', folder = 'db://assets', maxResults = 20 } = args;

        return new Promise(async (resolve) => {
            try {
                const allAssetsResult = await this.getAssets(assetType, folder);
                if (!allAssetsResult.success || !allAssetsResult.data) {
                    resolve(errorResult(`Failed to get assets: ${allAssetsResult.error}`));
                    return;
                }

                const allAssets = allAssetsResult.data.assets as any[];
                const matchedAssets: any[] = [];

                for (const asset of allAssets) {
                    const assetName = asset.name;
                    const matches = exactMatch
                        ? assetName === name
                        : assetName.toLowerCase().includes(name.toLowerCase());

                    if (matches) {
                        try {
                            const detailResult = await this.getAssetInfo(asset.path);
                            if (detailResult.success) {
                                matchedAssets.push({ ...asset, details: detailResult.data });
                            } else {
                                matchedAssets.push(asset);
                            }
                        } catch {
                            matchedAssets.push(asset);
                        }

                        if (matchedAssets.length >= maxResults) break;
                    }
                }

                resolve(successResult({
                    searchTerm: name,
                    exactMatch,
                    assetType,
                    folder,
                    totalFound: matchedAssets.length,
                    maxResults,
                    assets: matchedAssets
                }, `Found ${matchedAssets.length} assets matching '${name}'`));

            } catch (error: any) {
                resolve(errorResult(`Asset search failed: ${error.message}`));
            }
        });
    }

    private async getAssetDetails(assetPath: string, includeSubAssets: boolean = true): Promise<ActionToolResult> {
        return new Promise(async (resolve) => {
            try {
                const assetInfoResult = await this.getAssetInfo(assetPath);
                if (!assetInfoResult.success) {
                    resolve(assetInfoResult);
                    return;
                }

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
                                    detailedInfo.subAssets.push({
                                        type: subAsset.type,
                                        uuid: subAsset.uuid,
                                        url: subAssetUrl,
                                        suffix: subAsset.suffix
                                    });
                                }
                            } catch {
                                // Sub-asset doesn't exist, skip it
                            }
                        }
                    }
                }

                resolve(successResult({
                    assetPath,
                    includeSubAssets,
                    ...detailedInfo
                }, `Asset details retrieved. Found ${detailedInfo.subAssets.length} sub-assets.`));

            } catch (error: any) {
                resolve(errorResult(`Failed to get asset details: ${error.message}`));
            }
        });
    }

    // ── From AssetAdvancedTools ───────────────────────────────────────────────

    private async saveAssetMeta(urlOrUUID: string, content: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'save-asset-meta', urlOrUUID, content).then((result: any) => {
                resolve(successResult({
                    uuid: result?.uuid,
                    url: result?.url
                }, 'Asset meta saved successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async generateAvailableUrl(url: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'generate-available-url', url).then((availableUrl: string) => {
                resolve(successResult({
                    originalUrl: url,
                    availableUrl,
                    message: availableUrl === url ? 'URL is available' : 'Generated new available URL'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryAssetDbReady(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-ready').then((ready: boolean) => {
                resolve(successResult({
                    ready,
                    message: ready ? 'Asset database is ready' : 'Asset database is not ready'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async openAssetExternal(urlOrUUID: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'open-asset', urlOrUUID).then(() => {
                resolve(successResult(null, 'Asset opened with external program'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async batchImportAssets(args: any): Promise<ActionToolResult> {
        return new Promise(async (resolve) => {
            try {
                const overwrite: boolean = args.overwrite === true || args.overwrite === 'true';
                const recursive: boolean = args.recursive === true || args.recursive === 'true';

                if (!fs.existsSync(args.sourceDirectory)) {
                    resolve(errorResult('Source directory does not exist'));
                    return;
                }

                const files = this.getFilesFromDirectory(
                    args.sourceDirectory,
                    args.fileFilter || [],
                    recursive
                );

                const importResults: any[] = [];
                let successCount = 0;
                let errorCount = 0;

                for (const filePath of files) {
                    try {
                        const fileName = path.basename(filePath);
                        const targetPath = `${args.targetDirectory}/${fileName}`;

                        const result = await Editor.Message.request('asset-db', 'import-asset',
                            filePath, targetPath, {
                                overwrite,
                                rename: !overwrite
                            });

                        importResults.push({ source: filePath, target: targetPath, success: true, uuid: result?.uuid });
                        successCount++;
                    } catch (err: any) {
                        importResults.push({ source: filePath, success: false, error: err.message });
                        errorCount++;
                    }
                }

                resolve(successResult({
                    totalFiles: files.length,
                    successCount,
                    errorCount,
                    results: importResults
                }, `Batch import completed: ${successCount} success, ${errorCount} errors`));
            } catch (err: any) {
                resolve(errorResult(err.message));
            }
        });
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
        return new Promise(async (resolve) => {
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

                resolve(successResult({
                    totalAssets: urls.length,
                    successCount,
                    errorCount,
                    results: deleteResults
                }, `Batch delete completed: ${successCount} success, ${errorCount} errors`));
            } catch (err: any) {
                resolve(errorResult(err.message));
            }
        });
    }

    private async validateAssetReferences(directory: string = 'db://assets'): Promise<ActionToolResult> {
        return new Promise(async (resolve) => {
            try {
                const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });

                const brokenReferences: any[] = [];
                const validReferences: any[] = [];

                for (const asset of assets) {
                    try {
                        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                        if (assetInfo) {
                            validReferences.push({ url: asset.url, uuid: asset.uuid, name: asset.name });
                        }
                    } catch (err) {
                        brokenReferences.push({
                            url: asset.url,
                            uuid: asset.uuid,
                            name: asset.name,
                            error: (err as Error).message
                        });
                    }
                }

                resolve(successResult({
                    directory,
                    totalAssets: assets.length,
                    validReferences: validReferences.length,
                    brokenReferences: brokenReferences.length,
                    brokenAssets: brokenReferences
                }, `Validation completed: ${brokenReferences.length} broken references found`));
            } catch (err: any) {
                resolve(errorResult(err.message));
            }
        });
    }

    private async getAssetDependencies(_urlOrUUID: string, _direction: string = 'dependencies'): Promise<ActionToolResult> {
        return errorResult(
            'Asset dependency analysis requires additional APIs not available in current Cocos Creator MCP implementation. Consider using the Editor UI for dependency analysis.'
        );
    }

    private async getUnusedAssets(_directory: string = 'db://assets', _excludeDirectories: string[] = []): Promise<ActionToolResult> {
        return errorResult(
            'Unused asset detection requires comprehensive project analysis not available in current Cocos Creator MCP implementation. Consider using the Editor UI or third-party tools for unused asset detection.'
        );
    }

    private async compressTextures(_directory: string = 'db://assets', _format: string = 'auto', _quality: number = 0.8): Promise<ActionToolResult> {
        return errorResult(
            "Texture compression requires image processing capabilities not available in current Cocos Creator MCP implementation. Use the Editor's built-in texture compression settings or external tools."
        );
    }

    private async exportAssetManifest(directory: string = 'db://assets', format: string = 'json', includeMetadata: boolean = true): Promise<ActionToolResult> {
        return new Promise(async (resolve) => {
            try {
                const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern: `${directory}/**/*` });

                const manifest: any[] = [];

                for (const asset of assets) {
                    const manifestEntry: any = {
                        name: asset.name,
                        url: asset.url,
                        uuid: asset.uuid,
                        type: asset.type,
                        size: (asset as any).size || 0,
                        isDirectory: asset.isDirectory || false
                    };

                    if (includeMetadata) {
                        try {
                            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', asset.url);
                            if (assetInfo && assetInfo.meta) {
                                manifestEntry.meta = assetInfo.meta;
                            }
                        } catch {
                            // Skip metadata if not available
                        }
                    }

                    manifest.push(manifestEntry);
                }

                let exportData: string;
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

                resolve(successResult({
                    directory,
                    format,
                    assetCount: manifest.length,
                    includeMetadata,
                    manifest: exportData
                }, `Asset manifest exported with ${manifest.length} assets`));
            } catch (err: any) {
                resolve(errorResult(err.message));
            }
        });
    }

    private convertToCSV(data: any[]): string {
        if (data.length === 0) return '';

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
