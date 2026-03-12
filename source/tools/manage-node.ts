import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, NodeInfo, successResult, errorResult } from '../types';
import { coerceBool, coerceInt, normalizeVec3 } from '../utils/normalize';
import { ComponentTools } from './component-tools';

export class ManageNode extends BaseActionTool {
    private componentTools = new ComponentTools();

    readonly name = 'manage_node';
    readonly description = 'Manage nodes in the current scene. Actions: create, get_info, find, find_by_name, get_all, set_property, set_transform, delete, move, duplicate, detect_type. NOT for components — use manage_component. NOT for prefabs — use manage_prefab. Prerequisites: scene must be open (verify with manage_scene action=get_current). To find node UUIDs: use action=find or action=get_all first.';
    readonly actions = ['create', 'get_info', 'find', 'find_by_name', 'get_all', 'set_property', 'set_transform', 'delete', 'move', 'duplicate', 'detect_type'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'get_info', 'find', 'find_by_name', 'get_all', 'set_property', 'set_transform', 'delete', 'move', 'duplicate', 'detect_type'],
                description: 'Action to perform: create=create new node in scene, get_info=get node details by UUID, find=search nodes by name pattern, find_by_name=find first node by exact name, get_all=list all nodes with UUIDs, set_property=set a node property, set_transform=set position/rotation/scale, delete=remove node from scene, move=reparent node, duplicate=clone node, detect_type=detect if node is 2D or 3D'
            },
            uuid: {
                type: 'string',
                description: '[get_info, set_property, set_transform, delete, duplicate, detect_type] Node UUID'
            },
            name: {
                type: 'string',
                description: '[create] Node name. [find_by_name] Exact node name to find'
            },
            parentUuid: {
                type: 'string',
                description: '[create] Parent node UUID. STRONGLY RECOMMENDED. Use get_all to find parent UUIDs. If omitted, node is created at scene root.'
            },
            nodeType: {
                type: 'string',
                enum: ['Node', '2DNode', '3DNode'],
                description: '[create] Node type: Node, 2DNode, 3DNode',
                default: 'Node'
            },
            siblingIndex: {
                type: 'number',
                description: '[create, move] Sibling index for ordering (-1 means append at end)',
                default: -1
            },
            assetUuid: {
                type: 'string',
                description: '[create] Asset UUID to instantiate from (e.g., prefab UUID)'
            },
            assetPath: {
                type: 'string',
                description: '[create] Asset path to instantiate from (e.g., "db://assets/prefabs/MyPrefab.prefab"). Alternative to assetUuid.'
            },
            components: {
                type: 'array',
                items: { type: 'string' },
                description: '[create] Array of component type names to add (e.g., ["cc.Sprite", "cc.Button"])'
            },
            unlinkPrefab: {
                type: 'boolean',
                description: '[create] If true and creating from prefab, unlink from prefab to create a regular node',
                default: false
            },
            keepWorldTransform: {
                type: 'boolean',
                description: '[create, move] Whether to keep world transform',
                default: false
            },
            initialTransform: {
                type: 'object',
                properties: {
                    position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
                    rotation: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } },
                    scale: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } } }
                },
                description: '[create] Initial transform to apply after creation'
            },
            pattern: {
                type: 'string',
                description: '[find] Name pattern to search for'
            },
            exactMatch: {
                type: 'boolean',
                description: '[find] Use exact match instead of partial match',
                default: false
            },
            property: {
                type: 'string',
                description: '[set_property] Property name (e.g., active, name, layer)'
            },
            value: {
                description: '[set_property] Property value'
            },
            position: {
                type: 'object',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number', description: 'Z coordinate (ignored for 2D nodes)' }
                },
                description: '[set_transform] Node position. For 2D nodes, only x,y are used.'
            },
            rotation: {
                type: 'object',
                properties: {
                    x: { type: 'number', description: 'Ignored for 2D nodes' },
                    y: { type: 'number', description: 'Ignored for 2D nodes' },
                    z: { type: 'number', description: 'Main rotation axis for 2D nodes' }
                },
                description: '[set_transform] Node rotation in euler angles. For 2D nodes, only z is used.'
            },
            scale: {
                type: 'object',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number', description: 'Usually 1 for 2D nodes' }
                },
                description: '[set_transform] Node scale.'
            },
            nodeUuid: {
                type: 'string',
                description: '[move] Node UUID to move'
            },
            newParentUuid: {
                type: 'string',
                description: '[move] New parent node UUID'
            },
            includeChildren: {
                type: 'boolean',
                description: '[duplicate] Include children nodes',
                default: true
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        create: (args) => this.createNode(args),
        get_info: (args) => this.getNodeInfo(args.uuid),
        find: (args) => this.findNodes(args.pattern, coerceBool(args.exactMatch) ?? false),
        find_by_name: (args) => this.findNodeByName(args.name),
        get_all: (args) => this.getAllNodes(),
        set_property: (args) => this.setNodeProperty(args.uuid, args.property, args.value),
        set_transform: (args) => this.setNodeTransform(args),
        delete: (args) => this.deleteNode(args.uuid),
        move: (args) => this.moveNode(args.nodeUuid, args.newParentUuid, coerceInt(args.siblingIndex) ?? -1),
        duplicate: (args) => this.duplicateNode(args.uuid, coerceBool(args.includeChildren) ?? true),
        detect_type: (args) => this.detectNodeType(args.uuid)
    };

    private async createNode(args: any): Promise<ActionToolResult> {
        return new Promise(async (resolve) => {
            try {
                let targetParentUuid = args.parentUuid;

                if (!targetParentUuid) {
                    try {
                        const sceneInfo = await Editor.Message.request('scene', 'query-node-tree');
                        if (sceneInfo && typeof sceneInfo === 'object' && !Array.isArray(sceneInfo) && Object.prototype.hasOwnProperty.call(sceneInfo, 'uuid')) {
                            targetParentUuid = (sceneInfo as any).uuid;
                            console.log(`No parent specified, using scene root: ${targetParentUuid}`);
                        } else if (Array.isArray(sceneInfo) && sceneInfo.length > 0 && sceneInfo[0].uuid) {
                            targetParentUuid = sceneInfo[0].uuid;
                            console.log(`No parent specified, using scene root: ${targetParentUuid}`);
                        } else {
                            const currentScene = await Editor.Message.request('scene', 'query-current-scene');
                            if (currentScene && currentScene.uuid) {
                                targetParentUuid = currentScene.uuid;
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to get scene root, will use default behavior');
                    }
                }

                let finalAssetUuid = args.assetUuid;
                if (args.assetPath && !finalAssetUuid) {
                    try {
                        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetPath);
                        if (assetInfo && assetInfo.uuid) {
                            finalAssetUuid = assetInfo.uuid;
                            console.log(`Asset path '${args.assetPath}' resolved to UUID: ${finalAssetUuid}`);
                        } else {
                            resolve(errorResult(`Asset not found at path: ${args.assetPath}`));
                            return;
                        }
                    } catch (err) {
                        resolve(errorResult(`Failed to resolve asset path '${args.assetPath}': ${err}`));
                        return;
                    }
                }

                const createNodeOptions: any = { name: args.name };

                if (targetParentUuid) {
                    createNodeOptions.parent = targetParentUuid;
                }

                if (finalAssetUuid) {
                    createNodeOptions.assetUuid = finalAssetUuid;
                    if (coerceBool(args.unlinkPrefab)) {
                        createNodeOptions.unlinkPrefab = true;
                    }
                }

                if (args.components && args.components.length > 0) {
                    createNodeOptions.components = args.components;
                } else if (args.nodeType && args.nodeType !== 'Node' && !finalAssetUuid) {
                    createNodeOptions.components = [args.nodeType];
                }

                if (coerceBool(args.keepWorldTransform)) {
                    createNodeOptions.keepWorldTransform = true;
                }

                const siblingIndex = coerceInt(args.siblingIndex);

                console.log('Creating node with options:', createNodeOptions);

                const nodeUuid = await Editor.Message.request('scene', 'create-node', createNodeOptions);
                const uuid = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;

                if (siblingIndex !== undefined && siblingIndex >= 0 && uuid && targetParentUuid) {
                    try {
                        await new Promise(r => setTimeout(r, 100));
                        await Editor.Message.request('scene', 'set-parent', {
                            parent: targetParentUuid,
                            uuids: [uuid],
                            keepWorldTransform: coerceBool(args.keepWorldTransform) || false
                        });
                    } catch (err) {
                        console.warn('Failed to set sibling index:', err);
                    }
                }

                if (args.components && args.components.length > 0 && uuid) {
                    try {
                        await new Promise(r => setTimeout(r, 100));
                        for (const componentType of args.components) {
                            try {
                                const result = await this.componentTools.execute('add_component', {
                                    nodeUuid: uuid,
                                    componentType: componentType
                                });
                                if (result.success) {
                                    console.log(`Component ${componentType} added successfully`);
                                } else {
                                    console.warn(`Failed to add component ${componentType}:`, result.error);
                                }
                            } catch (err) {
                                console.warn(`Failed to add component ${componentType}:`, err);
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to add components:', err);
                    }
                }

                if (args.initialTransform && uuid) {
                    try {
                        await new Promise(r => setTimeout(r, 150));
                        const pos = normalizeVec3(args.initialTransform.position);
                        const rot = normalizeVec3(args.initialTransform.rotation);
                        const scl = normalizeVec3(args.initialTransform.scale);
                        await this.setNodeTransform({
                            uuid,
                            position: pos ?? args.initialTransform.position,
                            rotation: rot ?? args.initialTransform.rotation,
                            scale: scl ?? args.initialTransform.scale
                        });
                        console.log('Initial transform applied successfully');
                    } catch (err) {
                        console.warn('Failed to set initial transform:', err);
                    }
                }

                let verificationData: any = null;
                try {
                    const nodeInfo = await this.getNodeInfo(uuid);
                    if (nodeInfo.success) {
                        verificationData = {
                            nodeInfo: nodeInfo.data,
                            creationDetails: {
                                parentUuid: targetParentUuid,
                                nodeType: args.nodeType || 'Node',
                                fromAsset: !!finalAssetUuid,
                                assetUuid: finalAssetUuid,
                                assetPath: args.assetPath,
                                timestamp: new Date().toISOString()
                            }
                        };
                    }
                } catch (err) {
                    console.warn('Failed to get verification data:', err);
                }

                const successMessage = finalAssetUuid
                    ? `Node '${args.name}' instantiated from asset successfully`
                    : `Node '${args.name}' created successfully`;

                resolve(successResult({
                    uuid,
                    name: args.name,
                    parentUuid: targetParentUuid,
                    nodeType: args.nodeType || 'Node',
                    fromAsset: !!finalAssetUuid,
                    assetUuid: finalAssetUuid,
                    message: successMessage,
                    verificationData
                }));

            } catch (err: any) {
                resolve(errorResult(`Failed to create node: ${err.message}. Args: ${JSON.stringify(args)}`));
            }
        });
    }

    private async getNodeInfo(uuid: string): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node', uuid).then((nodeData: any) => {
                if (!nodeData) {
                    resolve(errorResult('Node not found or invalid response'));
                    return;
                }
                const info: NodeInfo = {
                    uuid: nodeData.uuid?.value || uuid,
                    name: nodeData.name?.value || 'Unknown',
                    active: nodeData.active?.value !== undefined ? nodeData.active.value : true,
                    position: nodeData.position?.value || { x: 0, y: 0, z: 0 },
                    rotation: nodeData.rotation?.value || { x: 0, y: 0, z: 0 },
                    scale: nodeData.scale?.value || { x: 1, y: 1, z: 1 },
                    parent: nodeData.parent?.value?.uuid || null,
                    children: nodeData.children || [],
                    components: (nodeData.__comps__ || []).map((comp: any) => ({
                        type: comp.__type__ || 'Unknown',
                        enabled: comp.enabled !== undefined ? comp.enabled : true
                    })),
                    layer: nodeData.layer?.value || 1073741824,
                    mobility: nodeData.mobility?.value || 0
                };
                resolve(successResult(info));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async findNodes(pattern: string, exactMatch: boolean = false): Promise<ActionToolResult> {
        if (!pattern) return errorResult('pattern is required for action=find');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                const nodes: any[] = [];

                const searchTree = (node: any, currentPath: string = '') => {
                    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
                    const matches = exactMatch
                        ? node.name === pattern
                        : node.name.toLowerCase().includes(pattern.toLowerCase());

                    if (matches) {
                        nodes.push({ uuid: node.uuid, name: node.name, path: nodePath });
                    }

                    if (node.children) {
                        for (const child of node.children) {
                            searchTree(child, nodePath);
                        }
                    }
                };

                if (tree) {
                    searchTree(tree);
                }

                resolve(successResult(nodes));
            }).catch((err: Error) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'findNodes',
                    args: [pattern, exactMatch]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve(errorResult(result?.error || 'Unknown error'));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Tree search failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private async findNodeByName(name: string): Promise<ActionToolResult> {
        if (!name) return errorResult('name is required for action=find_by_name');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                const foundNode = this.searchNodeInTree(tree, name);
                if (foundNode) {
                    resolve(successResult({
                        uuid: foundNode.uuid,
                        name: foundNode.name,
                        path: this.getNodePath(foundNode)
                    }));
                } else {
                    resolve(errorResult(`Node '${name}' not found`));
                }
            }).catch((err: Error) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'findNodeByName',
                    args: [name]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve(errorResult(result?.error || 'Unknown error'));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private searchNodeInTree(node: any, targetName: string): any {
        if (node.name === targetName) {
            return node;
        }
        if (node.children) {
            for (const child of node.children) {
                const found = this.searchNodeInTree(child, targetName);
                if (found) return found;
            }
        }
        return null;
    }

    private async getAllNodes(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                const nodes: any[] = [];

                const traverseTree = (node: any) => {
                    nodes.push({
                        uuid: node.uuid,
                        name: node.name,
                        type: node.type,
                        active: node.active,
                        path: this.getNodePath(node)
                    });
                    if (node.children) {
                        for (const child of node.children) {
                            traverseTree(child);
                        }
                    }
                };

                if (tree && tree.children) {
                    traverseTree(tree);
                }

                resolve(successResult({ totalNodes: nodes.length, nodes }));
            }).catch((err: Error) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getAllNodes',
                    args: []
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve(errorResult(result?.error || 'Unknown error'));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private getNodePath(node: any): string {
        const path = [node.name];
        let current = node.parent;
        while (current && current.name !== 'Canvas') {
            path.unshift(current.name);
            current = current.parent;
        }
        return path.join('/');
    }

    private async setNodeProperty(uuid: string, property: string, value: any): Promise<ActionToolResult> {
        if (!uuid || !property || value === undefined) {
            return errorResult('uuid, property, and value are required for action=set_property');
        }
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-property', {
                uuid,
                path: property,
                dump: { value }
            }).then(() => {
                this.getNodeInfo(uuid).then((nodeInfo) => {
                    resolve(successResult({
                        nodeUuid: uuid,
                        property,
                        newValue: value,
                        nodeInfo: nodeInfo.data,
                        changeDetails: {
                            property,
                            value,
                            timestamp: new Date().toISOString()
                        }
                    }, `Property '${property}' updated successfully`));
                }).catch(() => {
                    resolve(successResult({ nodeUuid: uuid, property, newValue: value }, `Property '${property}' updated successfully (verification failed)`));
                });
            }).catch((err: Error) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'setNodeProperty',
                    args: [uuid, property, value]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve(errorResult(result?.error || 'Unknown error'));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private async setNodeTransform(args: any): Promise<ActionToolResult> {
        return new Promise(async (resolve) => {
            const uuid = args.uuid;
            const position = normalizeVec3(args.position) ?? args.position;
            const rotation = normalizeVec3(args.rotation) ?? args.rotation;
            const scale = normalizeVec3(args.scale) ?? args.scale;

            const updatePromises: Promise<any>[] = [];
            const updates: string[] = [];
            const warnings: string[] = [];

            try {
                const nodeInfoResponse = await this.getNodeInfo(uuid);
                if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                    resolve(errorResult('Failed to get node information'));
                    return;
                }

                const nodeInfo = nodeInfoResponse.data;
                const is2DNode = this.is2DNode(nodeInfo);

                if (position) {
                    const normalized = this.normalizeTransformValue(position, 'position', is2DNode);
                    if (normalized.warning) warnings.push(normalized.warning);
                    updatePromises.push(
                        Editor.Message.request('scene', 'set-property', {
                            uuid, path: 'position', dump: { value: normalized.value }
                        })
                    );
                    updates.push('position');
                }

                if (rotation) {
                    const normalized = this.normalizeTransformValue(rotation, 'rotation', is2DNode);
                    if (normalized.warning) warnings.push(normalized.warning);
                    updatePromises.push(
                        Editor.Message.request('scene', 'set-property', {
                            uuid, path: 'rotation', dump: { value: normalized.value }
                        })
                    );
                    updates.push('rotation');
                }

                if (scale) {
                    const normalized = this.normalizeTransformValue(scale, 'scale', is2DNode);
                    if (normalized.warning) warnings.push(normalized.warning);
                    updatePromises.push(
                        Editor.Message.request('scene', 'set-property', {
                            uuid, path: 'scale', dump: { value: normalized.value }
                        })
                    );
                    updates.push('scale');
                }

                if (updatePromises.length === 0) {
                    resolve(errorResult('No transform properties specified'));
                    return;
                }

                await Promise.all(updatePromises);

                const updatedNodeInfo = await this.getNodeInfo(uuid);
                const result: ActionToolResult = {
                    success: true,
                    message: `Transform properties updated: ${updates.join(', ')} ${is2DNode ? '(2D node)' : '(3D node)'}`,
                    data: {
                        nodeUuid: uuid,
                        nodeType: is2DNode ? '2D' : '3D',
                        appliedChanges: updates,
                        transformConstraints: {
                            position: is2DNode ? 'x, y only (z ignored)' : 'x, y, z all used',
                            rotation: is2DNode ? 'z only (x, y ignored)' : 'x, y, z all used',
                            scale: is2DNode ? 'x, y main, z typically 1' : 'x, y, z all used'
                        },
                        nodeInfo: updatedNodeInfo.data,
                        transformDetails: {
                            originalNodeType: is2DNode ? '2D' : '3D',
                            appliedTransforms: updates,
                            timestamp: new Date().toISOString()
                        },
                        beforeAfterComparison: {
                            before: nodeInfo,
                            after: updatedNodeInfo.data
                        }
                    }
                };

                if (warnings.length > 0) {
                    (result as any).warning = warnings.join('; ');
                }

                resolve(result);

            } catch (err: any) {
                resolve(errorResult(`Failed to update transform: ${err.message}`));
            }
        });
    }

    private is2DNode(nodeInfo: any): boolean {
        const components = nodeInfo.components || [];

        const has2DComponents = components.some((comp: any) =>
            comp.type && (
                comp.type.includes('cc.Sprite') ||
                comp.type.includes('cc.Label') ||
                comp.type.includes('cc.Button') ||
                comp.type.includes('cc.Layout') ||
                comp.type.includes('cc.Widget') ||
                comp.type.includes('cc.Mask') ||
                comp.type.includes('cc.Graphics')
            )
        );

        if (has2DComponents) return true;

        const has3DComponents = components.some((comp: any) =>
            comp.type && (
                comp.type.includes('cc.MeshRenderer') ||
                comp.type.includes('cc.Camera') ||
                comp.type.includes('cc.Light') ||
                comp.type.includes('cc.DirectionalLight') ||
                comp.type.includes('cc.PointLight') ||
                comp.type.includes('cc.SpotLight')
            )
        );

        if (has3DComponents) return false;

        const position = nodeInfo.position;
        if (position && Math.abs(position.z) < 0.001) return true;

        return false;
    }

    private normalizeTransformValue(value: any, type: 'position' | 'rotation' | 'scale', is2D: boolean): { value: any; warning?: string } {
        const result = { ...value };
        let warning: string | undefined;

        if (is2D) {
            switch (type) {
                case 'position':
                    if (value.z !== undefined && Math.abs(value.z) > 0.001) {
                        warning = `2D node: z position (${value.z}) ignored, set to 0`;
                        result.z = 0;
                    } else if (value.z === undefined) {
                        result.z = 0;
                    }
                    break;
                case 'rotation':
                    if ((value.x !== undefined && Math.abs(value.x) > 0.001) ||
                        (value.y !== undefined && Math.abs(value.y) > 0.001)) {
                        warning = `2D node: x,y rotations ignored, only z rotation applied`;
                        result.x = 0;
                        result.y = 0;
                    } else {
                        result.x = result.x || 0;
                        result.y = result.y || 0;
                    }
                    result.z = result.z || 0;
                    break;
                case 'scale':
                    if (value.z === undefined) {
                        result.z = 1;
                    }
                    break;
            }
        } else {
            result.x = result.x !== undefined ? result.x : (type === 'scale' ? 1 : 0);
            result.y = result.y !== undefined ? result.y : (type === 'scale' ? 1 : 0);
            result.z = result.z !== undefined ? result.z : (type === 'scale' ? 1 : 0);
        }

        return { value: result, warning };
    }

    private async deleteNode(uuid: string): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required for action=delete');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'remove-node', { uuid }).then(() => {
                resolve(successResult(null, 'Node deleted successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async moveNode(nodeUuid: string, newParentUuid: string, siblingIndex: number = -1): Promise<ActionToolResult> {
        if (!nodeUuid || !newParentUuid) {
            return errorResult('nodeUuid and newParentUuid are required for action=move');
        }
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-parent', {
                parent: newParentUuid,
                uuids: [nodeUuid],
                keepWorldTransform: false
            }).then(() => {
                resolve(successResult(null, 'Node moved successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async duplicateNode(uuid: string, includeChildren: boolean = true): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required for action=duplicate');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'duplicate-node', uuid).then((result: any) => {
                resolve(successResult({
                    newUuid: result.uuid,
                    message: 'Node duplicated successfully'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async detectNodeType(uuid: string): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required for action=detect_type');
        return new Promise(async (resolve) => {
            try {
                const nodeInfoResponse = await this.getNodeInfo(uuid);
                if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                    resolve(errorResult('Failed to get node information'));
                    return;
                }

                const nodeInfo = nodeInfoResponse.data;
                const is2D = this.is2DNode(nodeInfo);
                const components = nodeInfo.components || [];

                const detectionReasons: string[] = [];

                const twoDComponents = components.filter((comp: any) =>
                    comp.type && (
                        comp.type.includes('cc.Sprite') ||
                        comp.type.includes('cc.Label') ||
                        comp.type.includes('cc.Button') ||
                        comp.type.includes('cc.Layout') ||
                        comp.type.includes('cc.Widget') ||
                        comp.type.includes('cc.Mask') ||
                        comp.type.includes('cc.Graphics')
                    )
                );

                const threeDComponents = components.filter((comp: any) =>
                    comp.type && (
                        comp.type.includes('cc.MeshRenderer') ||
                        comp.type.includes('cc.Camera') ||
                        comp.type.includes('cc.Light') ||
                        comp.type.includes('cc.DirectionalLight') ||
                        comp.type.includes('cc.PointLight') ||
                        comp.type.includes('cc.SpotLight')
                    )
                );

                if (twoDComponents.length > 0) {
                    detectionReasons.push(`Has 2D components: ${twoDComponents.map((c: any) => c.type).join(', ')}`);
                }
                if (threeDComponents.length > 0) {
                    detectionReasons.push(`Has 3D components: ${threeDComponents.map((c: any) => c.type).join(', ')}`);
                }

                const position = nodeInfo.position;
                if (position && Math.abs(position.z) < 0.001) {
                    detectionReasons.push('Z position is ~0 (likely 2D)');
                } else if (position && Math.abs(position.z) > 0.001) {
                    detectionReasons.push(`Z position is ${position.z} (likely 3D)`);
                }

                if (detectionReasons.length === 0) {
                    detectionReasons.push('No specific indicators found, defaulting based on heuristics');
                }

                resolve(successResult({
                    nodeUuid: uuid,
                    nodeName: nodeInfo.name,
                    nodeType: is2D ? '2D' : '3D',
                    detectionReasons,
                    components: components.map((comp: any) => ({
                        type: comp.type,
                        category: this.getComponentCategory(comp.type)
                    })),
                    position: nodeInfo.position,
                    transformConstraints: {
                        position: is2D ? 'x, y only (z ignored)' : 'x, y, z all used',
                        rotation: is2D ? 'z only (x, y ignored)' : 'x, y, z all used',
                        scale: is2D ? 'x, y main, z typically 1' : 'x, y, z all used'
                    }
                }));

            } catch (err: any) {
                resolve(errorResult(`Failed to detect node type: ${err.message}`));
            }
        });
    }

    private getComponentCategory(componentType: string): string {
        if (!componentType) return 'unknown';

        if (componentType.includes('cc.Sprite') || componentType.includes('cc.Label') ||
            componentType.includes('cc.Button') || componentType.includes('cc.Layout') ||
            componentType.includes('cc.Widget') || componentType.includes('cc.Mask') ||
            componentType.includes('cc.Graphics')) {
            return '2D';
        }

        if (componentType.includes('cc.MeshRenderer') || componentType.includes('cc.Camera') ||
            componentType.includes('cc.Light') || componentType.includes('cc.DirectionalLight') ||
            componentType.includes('cc.PointLight') || componentType.includes('cc.SpotLight')) {
            return '3D';
        }

        return 'generic';
    }
}
