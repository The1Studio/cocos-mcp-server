import { ActionToolResult, successResult, errorResult, PrefabInfo } from '../types';
import { BaseActionTool } from './base-action-tool';
import { normalizeVec3 } from '../utils/normalize';
import { PrefabCreationService } from './manage-prefab-creation-service';

export class ManagePrefab extends BaseActionTool {
    private readonly creationService = new PrefabCreationService();

    readonly name = 'manage_prefab';
    readonly description = 'Manage prefabs in the project. Actions: list=list all prefabs, load=load prefab by path, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to prefab, revert=revert prefab instance to original, get_info=get prefab details, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using asset (with undo). Prerequisites: project must be open in Cocos Creator.';
    readonly actions = ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'],
                description: 'Action to perform: list=list all prefabs in project, load=load prefab by uuid, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to existing prefab, revert=revert prefab instance to original, get_info=get detailed prefab info, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using prefab asset (built-in undo)'
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
                description: 'Scene node UUID (for create, update, revert, restore_node actions)'
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
                description: 'Prefab asset UUID to use when restoring node (for restore_node action, optional)'
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
        const { nodeUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        const result = await this.revertPrefab(nodeUuid);
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

    private async updatePrefab(nodeUuid: string): Promise<any> {
        try {
            // Get node info to find associated prefab
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeData) {
                return { success: false, error: 'Node not found' };
            }

            // Apply changes to prefab using the node's prefab connection
            await Editor.Message.request('scene', 'apply-prefab', { node: nodeUuid });

            return { success: true, message: 'Prefab updated successfully', data: { nodeUuid } };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async revertPrefab(nodeUuid: string): Promise<any> {
        try {
            await Editor.Message.request('scene', 'revert-prefab', { node: nodeUuid });
            return { success: true, message: 'Prefab instance reverted successfully', data: { nodeUuid } };
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
            try {
                const content: string = await Editor.Message.request('asset-db', 'read-asset', url);
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

    private async restorePrefabNode(nodeUuid: string, assetUuid?: string): Promise<any> {
        if (!nodeUuid) return { success: false, error: 'nodeUuid is required for action=restore' };
        try {
            // Use official restore-prefab API with positional args to restore the prefab node (includes built-in undo record)
            await (Editor.Message.request as any)('scene', 'restore-prefab', nodeUuid, assetUuid);
            return { success: true, data: { nodeUuid, assetUuid }, message: 'Prefab node restored successfully' };
        } catch (error: any) {
            return { success: false, error: `Failed to restore prefab node: ${error.message}` };
        }
    }
}
