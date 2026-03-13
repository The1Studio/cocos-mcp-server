import { ActionToolResult, successResult, errorResult, PrefabInfo } from '../types';
import { BaseActionTool } from './base-action-tool';
import { normalizeVec3 } from '../utils/normalize';

export class ManagePrefab extends BaseActionTool {
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
        return new Promise((resolve) => {
            const pattern = folder.endsWith('/') ?
                `${folder}**/*.prefab` : `${folder}/**/*.prefab`;

            Editor.Message.request('asset-db', 'query-assets', { pattern }).then((results: any[]) => {
                const prefabs: PrefabInfo[] = results.map(asset => ({
                    name: asset.name,
                    path: asset.url,
                    uuid: asset.uuid,
                    folder: asset.url.substring(0, asset.url.lastIndexOf('/'))
                }));
                resolve({ success: true, data: prefabs });
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    private async loadPrefabByUuid(uuid: string): Promise<any> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'load-asset', { uuid }).then((prefabData: any) => {
                resolve({
                    success: true,
                    data: {
                        uuid: prefabData.uuid,
                        name: prefabData.name,
                        message: 'Prefab loaded successfully'
                    }
                });
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
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

            const assetDbResult = await this.createPrefabWithAssetDB(
                args.nodeUuid,
                fullPath,
                prefabName,
                includeChildren,
                includeComponents
            );

            if (assetDbResult.success) {
                return assetDbResult;
            }

            const nativeResult = await this.createPrefabNative(args.nodeUuid, fullPath);
            if (nativeResult.success) {
                return nativeResult;
            }

            return await this.createPrefabCustom(args.nodeUuid, fullPath, prefabName);
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
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'revert-prefab', { node: nodeUuid }).then(() => {
                resolve({ success: true, message: 'Prefab instance reverted successfully', data: { nodeUuid } });
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    private async getPrefabInfoByUuid(uuid: string): Promise<any> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-asset-meta', uuid).then((metaInfo: any) => {
                const info: PrefabInfo = {
                    name: metaInfo.name,
                    uuid: metaInfo.uuid,
                    path: metaInfo.url || '',
                    folder: metaInfo.url ? metaInfo.url.substring(0, metaInfo.url.lastIndexOf('/')) : '',
                    createTime: metaInfo.createTime,
                    modifyTime: metaInfo.modifyTime,
                    dependencies: metaInfo.depends || []
                };
                resolve({ success: true, data: info });
            }).catch((err: Error) => {
                resolve({ success: false, error: err.message });
            });
        });
    }

    private async validatePrefabByUuid(uuid: string): Promise<any> {
        return new Promise((resolve) => {
            try {
                Editor.Message.request('asset-db', 'query-asset-meta', uuid).then((assetInfo: any) => {
                    if (!assetInfo) {
                        resolve({ success: false, error: 'Prefab not found' });
                        return;
                    }

                    const url = assetInfo.url || '';
                    Editor.Message.request('asset-db', 'read-asset', url).then((content: string) => {
                        try {
                            const prefabData = JSON.parse(content);
                            const validationResult = this.validatePrefabFormat(prefabData);
                            resolve({
                                success: true,
                                data: {
                                    isValid: validationResult.isValid,
                                    issues: validationResult.issues,
                                    nodeCount: validationResult.nodeCount,
                                    componentCount: validationResult.componentCount,
                                    message: validationResult.isValid ? 'Prefab format is valid' : 'Prefab format has issues'
                                }
                            });
                        } catch (parseError) {
                            resolve({ success: false, error: 'Prefab file format error: cannot parse JSON' });
                        }
                    }).catch((error: any) => {
                        resolve({ success: false, error: `Failed to read prefab file: ${error.message}` });
                    });
                }).catch((error: any) => {
                    resolve({ success: false, error: `Failed to query prefab info: ${error.message}` });
                });
            } catch (error) {
                resolve({ success: false, error: `Error validating prefab: ${error}` });
            }
        });
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
        return new Promise((resolve) => {
            // Use official restore-prefab API with positional args to restore the prefab node (includes built-in undo record)
            (Editor.Message.request as any)('scene', 'restore-prefab', nodeUuid, assetUuid).then(() => {
                resolve({
                    success: true,
                    data: { nodeUuid, assetUuid },
                    message: 'Prefab node restored successfully'
                });
            }).catch((error: any) => {
                resolve({ success: false, error: `Failed to restore prefab node: ${error.message}` });
            });
        });
    }

    // ===== Prefab creation helpers (ported from PrefabTools) =====

    private async createPrefabWithAssetDB(nodeUuid: string, savePath: string, prefabName: string, includeChildren: boolean, includeComponents: boolean): Promise<any> {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData) {
                return { success: false, error: 'Cannot get node data' };
            }

            const tempPrefabContent = JSON.stringify([{ "__type__": "cc.Prefab", "_name": prefabName }], null, 2);
            const createResult = await this.createAssetWithAssetDB(savePath, tempPrefabContent);
            if (!createResult.success) {
                return createResult;
            }

            const actualPrefabUuid = createResult.data?.uuid;
            if (!actualPrefabUuid) {
                return { success: false, error: 'Cannot get engine-assigned prefab UUID' };
            }

            const prefabContent = await this.createStandardPrefabContent(nodeData, prefabName, actualPrefabUuid, includeChildren, includeComponents);
            const prefabContentString = JSON.stringify(prefabContent, null, 2);

            await this.updateAssetWithAssetDB(savePath, prefabContentString);
            const metaContent = this.createStandardMetaContent(prefabName, actualPrefabUuid);
            await this.createMetaWithAssetDB(savePath, metaContent);
            await this.reimportAssetWithAssetDB(savePath);
            const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, actualPrefabUuid, savePath);

            return {
                success: true,
                data: {
                    prefabUuid: actualPrefabUuid,
                    prefabPath: savePath,
                    nodeUuid,
                    prefabName,
                    convertedToPrefabInstance: convertResult.success,
                    message: convertResult.success ? 'Prefab created and node converted' : 'Prefab created, node conversion failed'
                }
            };
        } catch (error) {
            return { success: false, error: `Failed to create prefab: ${error}` };
        }
    }

    private async createPrefabNative(nodeUuid: string, prefabPath: string): Promise<any> {
        return {
            success: false,
            error: 'Native prefab creation API not available',
            instruction: 'To create a prefab in Cocos Creator:\n1. Select a node in the scene\n2. Drag it to the Asset Browser\n3. Or right-click the node and select "Create Prefab"'
        };
    }

    private async createPrefabCustom(nodeUuid: string, prefabPath: string, prefabName: string): Promise<any> {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData) {
                return { success: false, error: `Node not found: ${nodeUuid}` };
            }

            const prefabUuid = this.generateUUID();
            const prefabJsonData = await this.createStandardPrefabContent(nodeData, prefabName, prefabUuid, true, true);
            const standardMetaData = this.createStandardMetaData(prefabName, prefabUuid);
            const saveResult = await this.savePrefabWithMeta(prefabPath, prefabJsonData, standardMetaData);

            if (saveResult.success) {
                const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, prefabPath, prefabUuid);
                return {
                    success: true,
                    data: {
                        prefabUuid,
                        prefabPath,
                        nodeUuid,
                        prefabName,
                        convertedToPrefabInstance: convertResult.success,
                        message: convertResult.success ?
                            'Custom prefab created and node converted' :
                            'Prefab created, node conversion failed'
                    }
                };
            } else {
                return { success: false, error: saveResult.error || 'Failed to save prefab file' };
            }
        } catch (error) {
            return { success: false, error: `Error creating prefab: ${error}` };
        }
    }

    private async getNodeData(nodeUuid: string): Promise<any> {
        try {
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo) return null;
            const nodeTree = await this.getNodeWithChildren(nodeUuid);
            return nodeTree || nodeInfo;
        } catch (error) {
            return null;
        }
    }

    private async getNodeWithChildren(nodeUuid: string): Promise<any> {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (!tree) return null;
            const targetNode = this.findNodeInTree(tree, nodeUuid);
            if (targetNode) {
                return await this.enhanceTreeWithMCPComponents(targetNode);
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Enhance node tree with accurate component info via direct Editor API.
     * Replaces previous HTTP self-call to localhost:8585 which was fragile and port-dependent.
     */
    private async enhanceTreeWithMCPComponents(node: any): Promise<any> {
        if (!node || !node.uuid) return node;

        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', node.uuid);
            if (nodeData && nodeData.__comps__) {
                node.components = nodeData.__comps__.map((comp: any) => ({
                    type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                    uuid: comp.uuid?.value || comp.uuid || null,
                    enabled: comp.enabled !== undefined ? comp.enabled : true
                }));
                console.log(`Node ${node.uuid} enhanced with ${node.components.length} components (incl. script types)`);
            }
        } catch (error) {
            console.warn(`Failed to get component info for node ${node.uuid}:`, error);
        }

        if (node.children && Array.isArray(node.children)) {
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = await this.enhanceTreeWithMCPComponents(node.children[i]);
            }
        }
        return node;
    }

    private findNodeInTree(node: any, targetUuid: string): any {
        if (!node) return null;
        if (node.uuid === targetUuid || node.value?.uuid === targetUuid) return node;
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                const found = this.findNodeInTree(child, targetUuid);
                if (found) return found;
            }
        }
        return null;
    }

    private getChildrenToProcess(nodeData: any): any[] {
        const children: any[] = [];
        if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const child of nodeData.children) {
                if (this.isValidNodeData(child)) {
                    children.push(child);
                }
            }
        }
        return children;
    }

    private isValidNodeData(nodeData: any): boolean {
        if (!nodeData) return false;
        if (typeof nodeData !== 'object') return false;
        return nodeData.hasOwnProperty('uuid') ||
            nodeData.hasOwnProperty('name') ||
            nodeData.hasOwnProperty('__type__') ||
            (nodeData.value && (
                nodeData.value.hasOwnProperty('uuid') ||
                nodeData.value.hasOwnProperty('name') ||
                nodeData.value.hasOwnProperty('__type__')
            ));
    }

    private extractNodeUuid(nodeData: any): string | null {
        if (!nodeData) return null;
        if (typeof nodeData.uuid === 'string') return nodeData.uuid;
        if (nodeData.value && typeof nodeData.value.uuid === 'string') return nodeData.value.uuid;
        return null;
    }

    private async createStandardPrefabContent(nodeData: any, prefabName: string, prefabUuid: string, includeChildren: boolean, includeComponents: boolean): Promise<any[]> {
        const prefabData: any[] = [];
        let currentId = 0;

        const prefabAsset = {
            "__type__": "cc.Prefab",
            "_name": prefabName || "",
            "_objFlags": 0,
            "__editorExtras__": {},
            "_native": "",
            "data": { "__id__": 1 },
            "optimizationPolicy": 0,
            "persistent": false
        };
        prefabData.push(prefabAsset);
        currentId++;

        const context = {
            prefabData,
            currentId: currentId + 1,
            prefabAssetIndex: 0,
            nodeFileIds: new Map<string, string>(),
            nodeUuidToIndex: new Map<string, number>(),
            componentUuidToIndex: new Map<string, number>()
        };

        await this.createCompleteNodeTree(nodeData, null, 1, context, includeChildren, includeComponents, prefabName);
        return prefabData;
    }

    private async createCompleteNodeTree(
        nodeData: any,
        parentNodeIndex: number | null,
        nodeIndex: number,
        context: {
            prefabData: any[];
            currentId: number;
            prefabAssetIndex: number;
            nodeFileIds: Map<string, string>;
            nodeUuidToIndex: Map<string, number>;
            componentUuidToIndex: Map<string, number>;
        },
        includeChildren: boolean,
        includeComponents: boolean,
        nodeName?: string
    ): Promise<void> {
        const { prefabData } = context;
        const node = this.createEngineStandardNode(nodeData, parentNodeIndex, nodeName);

        while (prefabData.length <= nodeIndex) {
            prefabData.push(null);
        }
        prefabData[nodeIndex] = node;

        const nodeUuid = this.extractNodeUuid(nodeData);
        const fileId = nodeUuid || this.generateFileId();
        context.nodeFileIds.set(nodeIndex.toString(), fileId);
        if (nodeUuid) context.nodeUuidToIndex.set(nodeUuid, nodeIndex);

        const childrenToProcess = this.getChildrenToProcess(nodeData);
        if (includeChildren && childrenToProcess.length > 0) {
            const childIndices: number[] = [];
            for (let i = 0; i < childrenToProcess.length; i++) {
                const childIndex = context.currentId++;
                childIndices.push(childIndex);
                node._children.push({ "__id__": childIndex });
            }
            for (let i = 0; i < childrenToProcess.length; i++) {
                await this.createCompleteNodeTree(
                    childrenToProcess[i],
                    nodeIndex,
                    childIndices[i],
                    context,
                    includeChildren,
                    includeComponents,
                    childrenToProcess[i].name || `Child${i + 1}`
                );
            }
        }

        if (includeComponents && nodeData.components && Array.isArray(nodeData.components)) {
            for (const component of nodeData.components) {
                const componentIndex = context.currentId++;
                node._components.push({ "__id__": componentIndex });

                const componentUuid = component.uuid || (component.value && component.value.uuid);
                if (componentUuid) context.componentUuidToIndex.set(componentUuid, componentIndex);

                const componentObj = this.createComponentObject(component, nodeIndex, context);
                prefabData[componentIndex] = componentObj;

                const compPrefabInfoIndex = context.currentId++;
                prefabData[compPrefabInfoIndex] = {
                    "__type__": "cc.CompPrefabInfo",
                    "fileId": this.generateFileId()
                };
                if (componentObj && typeof componentObj === 'object') {
                    componentObj.__prefab = { "__id__": compPrefabInfoIndex };
                }
            }
        }

        const prefabInfoIndex = context.currentId++;
        node._prefab = { "__id__": prefabInfoIndex };

        const prefabInfo: any = {
            "__type__": "cc.PrefabInfo",
            "root": { "__id__": 1 },
            "asset": { "__id__": context.prefabAssetIndex },
            "fileId": fileId,
            "targetOverrides": null,
            "nestedPrefabInstanceRoots": null,
            "instance": null
        };

        prefabData[prefabInfoIndex] = prefabInfo;
        context.currentId = prefabInfoIndex + 1;
    }

    private createEngineStandardNode(nodeData: any, parentNodeIndex: number | null, nodeName?: string): any {
        const name = nodeName || nodeData.name?.value || nodeData.name || 'Node';
        const active = nodeData.active !== false;

        const lpos = nodeData.position?.value || nodeData.lpos?.value || nodeData._lpos || { x: 0, y: 0, z: 0 };
        const lrot = nodeData.rotation?.value || nodeData.lrot?.value || nodeData._lrot || { x: 0, y: 0, z: 0, w: 1 };
        const lscale = nodeData.scale?.value || nodeData.lscale?.value || nodeData._lscale || { x: 1, y: 1, z: 1 };

        return {
            "__type__": "cc.Node",
            "_name": name,
            "_objFlags": 0,
            "__editorExtras__": {},
            "_parent": parentNodeIndex !== null ? { "__id__": parentNodeIndex } : null,
            "_children": [],
            "_active": active,
            "_components": [],
            "_prefab": null,
            "_lpos": { "__type__": "cc.Vec3", "x": lpos.x || 0, "y": lpos.y || 0, "z": lpos.z || 0 },
            "_lrot": { "__type__": "cc.Quat", "x": lrot.x || 0, "y": lrot.y || 0, "z": lrot.z || 0, "w": lrot.w !== undefined ? lrot.w : 1 },
            "_lscale": { "__type__": "cc.Vec3", "x": lscale.x !== undefined ? lscale.x : 1, "y": lscale.y !== undefined ? lscale.y : 1, "z": lscale.z !== undefined ? lscale.z : 1 },
            "_mobility": 0,
            "_layer": 1073741824,
            "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
            "_id": ""
        };
    }

    private createComponentObject(componentData: any, nodeIndex: number, context?: any): any {
        const componentType = componentData.type || componentData.__type__ || 'cc.Component';
        const enabled = componentData.enabled !== undefined ? componentData.enabled : true;

        const component: any = {
            "__type__": componentType,
            "_name": "",
            "_objFlags": 0,
            "__editorExtras__": {},
            "node": { "__id__": nodeIndex },
            "_enabled": enabled,
            "__prefab": null
        };

        if (componentType === 'cc.UITransform') {
            const contentSize = componentData.properties?.contentSize?.value || { width: 100, height: 100 };
            const anchorPoint = componentData.properties?.anchorPoint?.value || { x: 0.5, y: 0.5 };
            component._contentSize = { "__type__": "cc.Size", "width": contentSize.width, "height": contentSize.height };
            component._anchorPoint = { "__type__": "cc.Vec2", "x": anchorPoint.x, "y": anchorPoint.y };
        } else if (componentType === 'cc.Sprite') {
            const spriteFrameProp = componentData.properties?._spriteFrame || componentData.properties?.spriteFrame;
            component._spriteFrame = spriteFrameProp ? this.processComponentProperty(spriteFrameProp, context) : null;
            component._type = componentData.properties?._type?.value ?? 0;
            component._fillType = componentData.properties?._fillType?.value ?? 0;
            component._sizeMode = componentData.properties?._sizeMode?.value ?? 1;
            component._fillCenter = { "__type__": "cc.Vec2", "x": 0, "y": 0 };
            component._fillStart = componentData.properties?._fillStart?.value ?? 0;
            component._fillRange = componentData.properties?._fillRange?.value ?? 0;
            component._isTrimmedMode = componentData.properties?._isTrimmedMode?.value ?? true;
            component._useGrayscale = componentData.properties?._useGrayscale?.value ?? false;
            component._atlas = null;
            component._id = "";
        } else if (componentType === 'cc.Button') {
            component._interactable = true;
            component._transition = 3;
            component._normalColor = { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 };
            component._hoverColor = { "__type__": "cc.Color", "r": 211, "g": 211, "b": 211, "a": 255 };
            component._pressedColor = { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 };
            component._disabledColor = { "__type__": "cc.Color", "r": 124, "g": 124, "b": 124, "a": 255 };
            component._normalSprite = null;
            component._hoverSprite = null;
            component._pressedSprite = null;
            component._disabledSprite = null;
            component._duration = 0.1;
            component._zoomScale = 1.2;
            const targetProp = componentData.properties?._target || componentData.properties?.target;
            component._target = targetProp ? this.processComponentProperty(targetProp, context) : { "__id__": nodeIndex };
            component._clickEvents = [];
            component._id = "";
        } else if (componentType === 'cc.Label') {
            component._string = componentData.properties?._string?.value || "Label";
            component._horizontalAlign = 1;
            component._verticalAlign = 1;
            component._actualFontSize = 20;
            component._fontSize = 20;
            component._fontFamily = "Arial";
            component._lineHeight = 25;
            component._overflow = 0;
            component._enableWrapText = true;
            component._font = null;
            component._isSystemFontUsed = true;
            component._spacingX = 0;
            component._isItalic = false;
            component._isBold = false;
            component._isUnderline = false;
            component._underlineHeight = 2;
            component._cacheMode = 0;
            component._id = "";
        } else if (componentData.properties) {
            // Generic handler for built-in and custom script components
            for (const [key, value] of Object.entries(componentData.properties)) {
                if (['node', 'enabled', '__type__', 'uuid', 'name', '__scriptAsset', '_objFlags'].includes(key)) continue;
                const propValue = this.processComponentProperty(value, context);
                if (propValue !== undefined) component[key] = propValue;
            }
        }

        // Ensure _id is last (matches engine serialization order)
        const _id = component._id || "";
        delete component._id;
        component._id = _id;

        return component;
    }

    /**
     * Process component property values, ensuring format matches manually-created prefabs.
     * Handles node refs, asset refs, component refs, typed math/color objects, and arrays.
     */
    private processComponentProperty(propData: any, context?: {
        nodeUuidToIndex?: Map<string, number>;
        componentUuidToIndex?: Map<string, number>;
    }): any {
        if (!propData || typeof propData !== 'object') return propData;

        const value = propData.value;
        const type = propData.type;

        if (value === null || value === undefined) return null;

        // Empty UUID object → null
        if (value && typeof value === 'object' && value.uuid === '') return null;

        // Node references → internal __id__ or null for external
        if (type === 'cc.Node' && value?.uuid) {
            if (context?.nodeUuidToIndex?.has(value.uuid)) {
                return { "__id__": context.nodeUuidToIndex.get(value.uuid) };
            }
            console.warn(`Node ref UUID ${value.uuid} not in prefab context (external), setting null`);
            return null;
        }

        // Asset references (prefab, texture, sprite frame, material, etc.)
        if (value?.uuid && [
            'cc.Prefab', 'cc.Texture2D', 'cc.SpriteFrame', 'cc.Material',
            'cc.AnimationClip', 'cc.AudioClip', 'cc.Font', 'cc.Asset'
        ].includes(type)) {
            // Prefab refs keep full UUID; other asset refs use compressed form
            const uuidToUse = type === 'cc.Prefab' ? value.uuid : this.uuidToCompressedId(value.uuid);
            return { "__uuid__": uuidToUse, "__expectedType__": type };
        }

        // Component references → internal __id__ or null for external
        if (value?.uuid && (type === 'cc.Component' ||
            type === 'cc.Label' || type === 'cc.Button' || type === 'cc.Sprite' ||
            type === 'cc.UITransform' || type === 'cc.RigidBody2D' ||
            type === 'cc.BoxCollider2D' || type === 'cc.Animation' ||
            type === 'cc.AudioSource' || (type?.startsWith('cc.') && !type.includes('@')))) {
            if (context?.componentUuidToIndex?.has(value.uuid)) {
                return { "__id__": context.componentUuidToIndex.get(value.uuid) };
            }
            console.warn(`Component ref ${type} UUID ${value.uuid} not in prefab context (external), setting null`);
            return null;
        }

        // Typed math/color objects
        if (value && typeof value === 'object') {
            if (type === 'cc.Color') {
                return {
                    "__type__": "cc.Color",
                    "r": Math.min(255, Math.max(0, Number(value.r) || 0)),
                    "g": Math.min(255, Math.max(0, Number(value.g) || 0)),
                    "b": Math.min(255, Math.max(0, Number(value.b) || 0)),
                    "a": value.a !== undefined ? Math.min(255, Math.max(0, Number(value.a))) : 255
                };
            } else if (type === 'cc.Vec3') {
                return { "__type__": "cc.Vec3", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0 };
            } else if (type === 'cc.Vec2') {
                return { "__type__": "cc.Vec2", "x": Number(value.x) || 0, "y": Number(value.y) || 0 };
            } else if (type === 'cc.Size') {
                return { "__type__": "cc.Size", "width": Number(value.width) || 0, "height": Number(value.height) || 0 };
            } else if (type === 'cc.Quat') {
                return {
                    "__type__": "cc.Quat",
                    "x": Number(value.x) || 0, "y": Number(value.y) || 0,
                    "z": Number(value.z) || 0, "w": value.w !== undefined ? Number(value.w) : 1
                };
            }
        }

        // Array properties
        if (Array.isArray(value)) {
            // Node array
            if (propData.elementTypeData?.type === 'cc.Node') {
                return value.map((item: any) => {
                    if (item?.uuid && context?.nodeUuidToIndex?.has(item.uuid)) {
                        return { "__id__": context.nodeUuidToIndex.get(item.uuid) };
                    }
                    return null;
                }).filter(Boolean);
            }
            // Asset array
            if (propData.elementTypeData?.type?.startsWith('cc.')) {
                return value.map((item: any) => item?.uuid
                    ? { "__uuid__": this.uuidToCompressedId(item.uuid), "__expectedType__": propData.elementTypeData.type }
                    : null
                ).filter(Boolean);
            }
            // Primitive array
            return value.map((item: any) => item?.value !== undefined ? item.value : item);
        }

        // Other complex typed objects — preserve __type__ marker
        if (value && typeof value === 'object' && type?.startsWith('cc.')) {
            return { "__type__": type, ...value };
        }

        return value;
    }

    private async convertNodeToPrefabInstance(nodeUuid: string, prefabRef: string, prefabUuid: string): Promise<any> {
        const methods = [
            () => Editor.Message.request('scene', 'connect-prefab-instance', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'set-prefab-connection', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'apply-prefab-link', { node: nodeUuid, prefab: prefabRef })
        ];

        for (const method of methods) {
            try {
                await method();
                return { success: true };
            } catch {
                // try next
            }
        }
        return { success: false, error: 'All prefab connection methods failed' };
    }

    private async savePrefabWithMeta(prefabPath: string, prefabData: any[], metaData: any): Promise<any> {
        try {
            const prefabContent = JSON.stringify(prefabData, null, 2);
            const metaContent = JSON.stringify(metaData, null, 2);
            await this.saveAssetFile(prefabPath, prefabContent);
            await this.saveAssetFile(`${prefabPath}.meta`, metaContent);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to save prefab file' };
        }
    }

    private async saveAssetFile(filePath: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const saveMethods = [
                () => Editor.Message.request('asset-db', 'create-asset', filePath, content),
                () => Editor.Message.request('asset-db', 'save-asset', filePath, content),
                () => Editor.Message.request('asset-db', 'write-asset', filePath, content)
            ];
            const trySave = (index: number) => {
                if (index >= saveMethods.length) { reject(new Error('All save methods failed')); return; }
                saveMethods[index]().then(() => resolve()).catch(() => trySave(index + 1));
            };
            trySave(0);
        });
    }

    private async createAssetWithAssetDB(assetPath: string, content: string): Promise<any> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'create-asset', assetPath, content, { overwrite: true, rename: false }).then((assetInfo: any) => {
                resolve({ success: true, data: assetInfo });
            }).catch((error: any) => {
                resolve({ success: false, error: error.message || 'Failed to create asset file' });
            });
        });
    }

    private async createMetaWithAssetDB(assetPath: string, metaContent: any): Promise<any> {
        return new Promise((resolve) => {
            const metaContentString = JSON.stringify(metaContent, null, 2);
            Editor.Message.request('asset-db', 'save-asset-meta', assetPath, metaContentString).then((assetInfo: any) => {
                resolve({ success: true, data: assetInfo });
            }).catch((error: any) => {
                resolve({ success: false, error: error.message || 'Failed to create meta file' });
            });
        });
    }

    private async reimportAssetWithAssetDB(assetPath: string): Promise<any> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'reimport-asset', assetPath).then((result: any) => {
                resolve({ success: true, data: result });
            }).catch((error: any) => {
                resolve({ success: false, error: error.message || 'Failed to reimport asset' });
            });
        });
    }

    private async updateAssetWithAssetDB(assetPath: string, content: string): Promise<any> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'save-asset', assetPath, content).then((result: any) => {
                resolve({ success: true, data: result });
            }).catch((error: any) => {
                resolve({ success: false, error: error.message || 'Failed to update asset file' });
            });
        });
    }

    private validatePrefabFormat(prefabData: any): { isValid: boolean; issues: string[]; nodeCount: number; componentCount: number } {
        const issues: string[] = [];
        let nodeCount = 0;
        let componentCount = 0;

        if (!Array.isArray(prefabData)) {
            issues.push('Prefab data must be an array');
            return { isValid: false, issues, nodeCount, componentCount };
        }
        if (prefabData.length === 0) {
            issues.push('Prefab data is empty');
            return { isValid: false, issues, nodeCount, componentCount };
        }

        const firstElement = prefabData[0];
        if (!firstElement || firstElement.__type__ !== 'cc.Prefab') {
            issues.push('First element must be cc.Prefab type');
        }

        prefabData.forEach((item: any) => {
            if (item.__type__ === 'cc.Node') nodeCount++;
            else if (item.__type__ && item.__type__.includes('cc.')) componentCount++;
        });

        if (nodeCount === 0) issues.push('Prefab must contain at least one node');

        return { isValid: issues.length === 0, issues, nodeCount, componentCount };
    }

    private createStandardMetaContent(prefabName: string, prefabUuid: string): any {
        return {
            "ver": "1.1.50",
            "importer": "prefab",
            "imported": true,
            "uuid": prefabUuid,
            "files": [".json"],
            "subMetas": {},
            "userData": { "syncNodeName": prefabName }
        };
    }

    private createStandardMetaData(prefabName: string, prefabUuid: string): any {
        return this.createStandardMetaContent(prefabName, prefabUuid);
    }

    private generateUUID(): string {
        const chars = '0123456789abcdef';
        let uuid = '';
        for (let i = 0; i < 32; i++) {
            if (i === 8 || i === 12 || i === 16 || i === 20) uuid += '-';
            uuid += chars[Math.floor(Math.random() * chars.length)];
        }
        return uuid;
    }

    private generateFileId(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
        let fileId = '';
        for (let i = 0; i < 22; i++) {
            fileId += chars[Math.floor(Math.random() * chars.length)];
        }
        return fileId;
    }

    /**
     * Convert UUID to Cocos Creator compressed format.
     * First 5 hex chars kept as-is; remaining 27 chars compressed to 18 via base64 encoding.
     */
    private uuidToCompressedId(uuid: string): string {
        const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
        if (cleanUuid.length !== 32) return uuid;

        let result = cleanUuid.substring(0, 5);
        const remainder = cleanUuid.substring(5);

        // Every 3 hex chars (12 bits) compressed into 2 base64 chars (12 bits)
        for (let i = 0; i < remainder.length; i += 3) {
            const hex1 = remainder[i] || '0';
            const hex2 = remainder[i + 1] || '0';
            const hex3 = remainder[i + 2] || '0';
            const value = parseInt(hex1 + hex2 + hex3, 16);
            result += BASE64_KEYS[(value >> 6) & 63] + BASE64_KEYS[value & 63];
        }
        return result;
    }
}
