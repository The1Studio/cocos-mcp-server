import * as fs from 'fs';
import { ActionToolResult, successResult, errorResult, PrefabInfo } from '../types';
import { BaseActionTool } from './base-action-tool';
import { normalizeVec3 } from '../utils/normalize';
import { PrefabCreationService } from './manage-prefab-creation-service';

export class ManagePrefab extends BaseActionTool {
    private readonly creationService = new PrefabCreationService();

    readonly name = 'manage_prefab';
    readonly description = 'Manage prefabs in the project. Actions: list=list all prefabs, load=load prefab by path, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to the prefab asset (verifies the asset was written), revert=revert prefab instance to the asset state (alias of restore), get_info=get prefab details, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using asset (with undo). For update/revert/restore, nodeUuid may be any node in the instance — the instance root is resolved automatically. Prerequisites: project must be open in Cocos Creator.';
    readonly actions = ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'],
                description: 'Action to perform: list=list all prefabs in project, load=load prefab by uuid, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to existing prefab, revert=revert prefab instance to the asset state (alias of restore), get_info=get detailed prefab info, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using prefab asset (built-in undo)'
            },
            uuid: {
                type: 'string',
                description: 'Prefab asset UUID (for load, get_info, validate, duplicate, restore_node actions)'
            },
            prefabUuid: {
                type: 'string',
                description: 'Prefab asset UUID (for instantiate action)'
            },
            nodeUuid: {
                type: 'string',
                description: 'Scene node UUID (for create, update, revert, restore actions). For update/revert/restore this may be any node inside the prefab instance; the instance root is resolved from it.'
            },
            savePath: {
                type: 'string',
                description: 'Asset DB path to save prefab (for create action, e.g. db://assets/prefabs/MyPrefab.prefab)'
            },
            parentUuid: {
                type: 'string',
                description: 'Parent node UUID for the instantiated prefab (for instantiate action, optional)'
            },
            position: {
                type: 'object',
                description: 'Initial position {x, y, z} for instantiated prefab (optional)',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' }
                }
            },
            rotation: {
                type: 'object',
                description: 'Initial rotation {x, y, z} for instantiated prefab (optional)',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' }
                }
            },
            scale: {
                type: 'object',
                description: 'Initial scale {x, y, z} for instantiated prefab (optional)',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' }
                }
            },
            folder: {
                type: 'string',
                description: 'Folder to search prefabs in (for list action, default: db://assets)',
                default: 'db://assets'
            },
            newName: {
                type: 'string',
                description: 'New prefab name (for duplicate action, optional)'
            },
            targetDir: {
                type: 'string',
                description: 'Target directory for duplicated prefab (for duplicate action, optional)'
            },
            assetUuid: {
                type: 'string',
                description: 'Prefab asset UUID to restore from (for revert and restore actions, optional — resolved from the node when omitted)'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        list: (args) => this.handleList(args),
        load: (args) => this.handleLoad(args),
        instantiate: (args) => this.handleInstantiate(args),
        create: (args) => this.handleCreate(args),
        update: (args) => this.handleUpdate(args),
        revert: (args) => this.handleRevert(args),
        get_info: (args) => this.handleGetInfo(args),
        validate: (args) => this.handleValidate(args),
        duplicate: (args) => this.handleDuplicate(args),
        restore: (args) => this.handleRestoreNode(args),
    };

    private async handleList(args: Record<string, any>): Promise<ActionToolResult> {
        const result = await this.getPrefabList(args.folder);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to list prefabs');
    }

    private async handleLoad(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.loadPrefabByUuid(uuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to load prefab');
    }

    private async handleInstantiate(args: Record<string, any>): Promise<ActionToolResult> {
        const { prefabUuid, parentUuid } = args;
        if (!prefabUuid) return errorResult('prefabUuid is required');
        const position = normalizeVec3(args.position);
        const rotation = normalizeVec3(args.rotation);
        const scale = normalizeVec3(args.scale);
        const result = await this.instantiatePrefabByUuid({ prefabUuid, parentUuid, position, rotation, scale });
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to instantiate prefab');
    }

    private async handleCreate(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid, savePath } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        if (!savePath) return errorResult('savePath is required');
        const prefabName = savePath.split('/').pop()?.replace('.prefab', '') || 'NewPrefab';
        const result = await this.createPrefab({ nodeUuid, savePath, prefabName });
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to create prefab');
    }

    private async handleUpdate(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        const result = await this.updatePrefab(nodeUuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to update prefab');
    }

    private async handleRevert(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid, assetUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        // `revert` and `restore` are the same editor operation — see restorePrefabNode.
        const result = await this.restorePrefabNode(nodeUuid, assetUuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to revert prefab');
    }

    private async handleGetInfo(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.getPrefabInfoByUuid(uuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to get prefab info');
    }

    private async handleValidate(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.validatePrefabByUuid(uuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to validate prefab');
    }

    private async handleDuplicate(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid, newName, targetDir } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.duplicatePrefabByUuid({ uuid, newName, targetDir });
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to duplicate prefab');
    }

    private async handleRestoreNode(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid, assetUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        const result = await this.restorePrefabNode(nodeUuid, assetUuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to restore prefab node');
    }

    // ============================================================
    // Private implementation methods (ported from PrefabTools)
    // ============================================================

    private async getPrefabList(folder: string = 'db://assets'): Promise<any> {
        try {
            const pattern = folder.endsWith('/') ? `${folder}**/*.prefab` : `${folder}/**/*.prefab`;
            const results: any[] = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            const prefabs: PrefabInfo[] = results.map(asset => ({
                name: asset.name, path: asset.url, uuid: asset.uuid,
                folder: asset.url.substring(0, asset.url.lastIndexOf('/'))
            }));
            return { success: true, data: prefabs };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async loadPrefabByUuid(uuid: string): Promise<any> {
        try {
            const prefabData: any = await Editor.Message.request('scene', 'load-asset', { uuid });
            return { success: true, data: { uuid: prefabData.uuid, name: prefabData.name, message: 'Prefab loaded successfully' } };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async instantiatePrefabByUuid(args: { prefabUuid: string; parentUuid?: string; position?: any; rotation?: any; scale?: any }): Promise<any> {
        try {
            const { prefabUuid, parentUuid, position, rotation, scale } = args;

            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', prefabUuid).catch(() => null);

            const createNodeOptions: any = {
                assetUuid: prefabUuid
            };

            if (parentUuid) {
                createNodeOptions.parent = parentUuid;
            }

            if (assetInfo && assetInfo.name) {
                createNodeOptions.name = assetInfo.name;
            }

            if (position) {
                createNodeOptions.dump = {
                    position: { value: position }
                };
            }

            const nodeUuid = await Editor.Message.request('scene', 'create-node', createNodeOptions);
            const uuid = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;

            // Apply rotation and scale if provided
            if (uuid) {
                if (rotation) {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid,
                        path: 'eulerAngles',
                        dump: { value: rotation, type: 'cc.Vec3' }
                    }).catch(() => {/* non-fatal */});
                }
                if (scale) {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid,
                        path: 'scale',
                        dump: { value: scale, type: 'cc.Vec3' }
                    }).catch(() => {/* non-fatal */});
                }
            }

            return {
                success: true,
                data: {
                    nodeUuid: uuid,
                    prefabUuid,
                    parentUuid,
                    position,
                    rotation,
                    scale,
                    message: 'Prefab instantiated successfully'
                }
            };
        } catch (err: any) {
            return {
                success: false,
                error: `Failed to instantiate prefab: ${err.message}`,
                instruction: 'Check that the prefabUuid is correct and the asset DB is ready.'
            };
        }
    }

    private async createPrefab(args: any): Promise<any> {
        try {
            const pathParam = args.prefabPath || args.savePath;
            if (!pathParam) {
                return { success: false, error: 'Missing prefab path parameter. Provide savePath.' };
            }

            const prefabName = args.prefabName || 'NewPrefab';
            const fullPath = pathParam.endsWith('.prefab') ?
                pathParam : `${pathParam}/${prefabName}.prefab`;

            const includeChildren = args.includeChildren !== false;
            const includeComponents = args.includeComponents !== false;

            const assetDbResult = await this.creationService.createPrefabWithAssetDB(
                args.nodeUuid, fullPath, prefabName, includeChildren, includeComponents
            );
            if (assetDbResult.success) return assetDbResult;

            const nativeResult = this.creationService.createPrefabNativeStub();
            if (nativeResult.success) return nativeResult;

            return await this.creationService.createPrefabCustom(args.nodeUuid, fullPath, prefabName);
        } catch (error) {
            return { success: false, error: `Error creating prefab: ${error}` };
        }
    }

    /**
     * Resolve the prefab-instance context for a node.
     *
     * Cocos Creator drives both prefab messages from the node dump's `__prefab__`
     * block — `rootUuid` (the prefab-instance ROOT, not whichever descendant the
     * caller happened to pass) and `uuid` (the backing prefab asset). See 3.8.7
     * `resources/3d/engine/editor/inspector/contributions/node.js`:
     *   request('scene', 'apply-prefab', prefab.rootUuid)
     *   request('scene', 'restore-prefab', prefab.rootUuid, prefab.uuid)
     */
    private async resolvePrefabContext(nodeUuid: string): Promise<any> {
        let nodeData: any;
        try {
            nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
        } catch (err: any) {
            return { success: false, error: `Failed to query node ${nodeUuid}: ${err.message}` };
        }
        if (!nodeData) return { success: false, error: 'Node not found' };

        const prefab = nodeData.__prefab__;
        if (!prefab) {
            return { success: false, error: `Node ${nodeUuid} is not part of a prefab instance` };
        }
        return {
            success: true,
            rootUuid: prefab.rootUuid || nodeUuid,
            assetUuid: prefab.uuid || prefab.prefabStateInfo?.assetUuid
        };
    }

    /** Resolve a prefab asset's on-disk path, or null when it cannot be determined. */
    private async resolvePrefabFilePath(assetUuid?: string): Promise<string | null> {
        if (!assetUuid) return null;
        try {
            const meta: any = await Editor.Message.request('asset-db', 'query-asset-meta', assetUuid);
            if (!meta?.url) return null;
            return (await Editor.Message.request('asset-db', 'query-path', meta.url)) as string | null;
        } catch {
            return null;
        }
    }

    private statMtimeMs(filePath: string | null): number | null {
        if (!filePath) return null;
        try {
            return fs.statSync(filePath).mtimeMs;
        } catch {
            return null;
        }
    }

    /** Poll for the prefab file to be rewritten; asset-db may flush shortly after the message resolves. */
    private async waitForPrefabWrite(filePath: string, baselineMs: number, timeoutMs = 2000): Promise<number | null> {
        const deadline = Date.now() + timeoutMs;
        let mtime = this.statMtimeMs(filePath);
        while (mtime !== null && mtime <= baselineMs && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
            mtime = this.statMtimeMs(filePath);
        }
        return mtime;
    }

    private async updatePrefab(nodeUuid: string): Promise<any> {
        try {
            const context = await this.resolvePrefabContext(nodeUuid);
            if (!context.success) return context;
            const { rootUuid, assetUuid } = context;

            const prefabPath = await this.resolvePrefabFilePath(assetUuid);
            const mtimeBefore = this.statMtimeMs(prefabPath);

            // `scene:apply-prefab` takes the instance root uuid as a POSITIONAL string
            // and resolves to a boolean. The old `{ node: uuid }` object form resolved
            // without throwing but never wrote the asset — a silent no-op reported as
            // success (#12).
            const applied = await (Editor.Message.request as any)('scene', 'apply-prefab', rootUuid);
            if (applied === false) {
                return {
                    success: false,
                    error: `Editor rejected apply-prefab for node ${rootUuid}. Confirm it is a prefab-instance root with a valid asset link.`,
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath }
                };
            }

            // Verify the asset was actually written rather than trusting a non-throwing
            // message. `unverified` means the path could not be resolved, not that the
            // write failed.
            let persisted: boolean | 'unverified' = 'unverified';
            if (prefabPath !== null && mtimeBefore !== null) {
                const mtimeAfter = await this.waitForPrefabWrite(prefabPath, mtimeBefore);
                if (mtimeAfter !== null) persisted = mtimeAfter > mtimeBefore;
            }

            if (persisted === false) {
                return {
                    success: false,
                    error: `apply-prefab reported no error but ${prefabPath} was not rewritten. The node may have no overrides to apply, or its prefab link is stale.`,
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted }
                };
            }

            return {
                success: true,
                message: 'Prefab updated successfully',
                data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted }
            };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async getPrefabInfoByUuid(uuid: string): Promise<any> {
        try {
            const metaInfo: any = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
            const info: PrefabInfo = {
                name: metaInfo.name, uuid: metaInfo.uuid, path: metaInfo.url || '',
                folder: metaInfo.url ? metaInfo.url.substring(0, metaInfo.url.lastIndexOf('/')) : '',
                createTime: metaInfo.createTime, modifyTime: metaInfo.modifyTime,
                dependencies: metaInfo.depends || []
            };
            return { success: true, data: info };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async validatePrefabByUuid(uuid: string): Promise<any> {
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
            if (!assetInfo) return { success: false, error: 'Prefab not found' };
            const url = assetInfo.url || '';
            // asset-db has no 'read-asset' message; resolve the db URL to a
            // filesystem path and read the .prefab file directly (same pattern
            // as manage-script / manage-animation).
            const filePath = await Editor.Message.request('asset-db', 'query-path', url) as string | null;
            if (!filePath) return { success: false, error: 'Could not resolve prefab file path on disk' };
            try {
                const content: string = fs.readFileSync(filePath, 'utf-8');
                try {
                    const prefabData = JSON.parse(content);
                    const validationResult = this.creationService.validatePrefabFormat(prefabData);
                    return {
                        success: true,
                        data: {
                            isValid: validationResult.isValid, issues: validationResult.issues,
                            nodeCount: validationResult.nodeCount, componentCount: validationResult.componentCount,
                            message: validationResult.isValid ? 'Prefab format is valid' : 'Prefab format has issues'
                        }
                    };
                } catch {
                    return { success: false, error: 'Prefab file format error: cannot parse JSON' };
                }
            } catch (error: any) {
                return { success: false, error: `Failed to read prefab file: ${error.message}` };
            }
        } catch (error: any) {
            return { success: false, error: `Error validating prefab: ${error}` };
        }
    }

    private async duplicatePrefabByUuid(args: { uuid: string; newName?: string; targetDir?: string }): Promise<any> {
        // Prefab duplication requires complex serialization — not available programmatically
        return {
            success: false,
            error: 'Prefab duplication is not available programmatically',
            instruction: 'To duplicate a prefab, use the Cocos Creator editor:\n1. Select the prefab in the Asset Browser\n2. Right-click and select Copy\n3. Paste in the target location'
        };
    }

    /**
     * Restore (a.k.a. revert) a prefab instance to its asset state.
     *
     * Backs both `action=restore` and `action=revert`. Cocos Creator 3.8.7 exposes
     * no `scene:revert-prefab` message at all — `restore-prefab` is what the editor
     * itself uses for the inspector's Revert button (#13). It takes positional
     * `(rootUuid, assetUuid)`, returns a boolean, and records its own undo entry.
     */
    private async restorePrefabNode(nodeUuid: string, assetUuid?: string): Promise<any> {
        if (!nodeUuid) return { success: false, error: 'nodeUuid is required' };
        try {
            const context = await this.resolvePrefabContext(nodeUuid);
            if (!context.success) return context;

            const rootUuid = context.rootUuid;
            const resolvedAssetUuid = assetUuid || context.assetUuid;
            if (!resolvedAssetUuid) {
                return { success: false, error: `Could not resolve the prefab asset for node ${nodeUuid}. Pass assetUuid explicitly.` };
            }

            const restored = await (Editor.Message.request as any)('scene', 'restore-prefab', rootUuid, resolvedAssetUuid);
            if (restored === false) {
                return {
                    success: false,
                    error: `Editor rejected restore-prefab for node ${rootUuid}. Confirm it is a prefab-instance root with a valid asset link.`,
                    data: { nodeUuid, rootUuid, assetUuid: resolvedAssetUuid }
                };
            }
            return {
                success: true,
                data: { nodeUuid, rootUuid, assetUuid: resolvedAssetUuid },
                message: 'Prefab instance restored from asset successfully'
            };
        } catch (error: any) {
            return { success: false, error: `Failed to restore prefab node: ${error.message}` };
        }
    }
}
