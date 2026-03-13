import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, NodeInfo, successResult, errorResult } from '../types';
import { coerceBool, coerceInt, normalizeVec3 } from '../utils/normalize';
import { is2DNode, normalizeTransformValue, getComponentCategory, getNodePath, searchNodeInTree } from './manage-node-transform-helpers';

export class ManageNode extends BaseActionTool {

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
        get_all: () => this.getAllNodes(),
        set_property: (args) => this.setNodeProperty(args.uuid, args.property, args.value),
        set_transform: (args) => this.setNodeTransform(args),
        delete: (args) => this.deleteNode(args.uuid),
        move: (args) => this.moveNode(args.nodeUuid, args.newParentUuid, coerceInt(args.siblingIndex) ?? -1, coerceBool(args.keepWorldTransform) ?? false),
        duplicate: (args) => this.duplicateNode(args.uuid, coerceBool(args.includeChildren) ?? true),
        detect_type: (args) => this.detectNodeType(args.uuid)
    };

    private async createNode(args: any): Promise<ActionToolResult> {
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
                        return errorResult(`Asset not found at path: ${args.assetPath}`);
                    }
                } catch (err) {
                    return errorResult(`Failed to resolve asset path '${args.assetPath}': ${err}`);
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
                            await Editor.Message.request('scene', 'create-component', {
                                uuid,
                                component: componentType
                            });
                            console.log(`Component ${componentType} added successfully`);
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

            return successResult({
                uuid,
                name: args.name,
                parentUuid: targetParentUuid,
                nodeType: args.nodeType || 'Node',
                fromAsset: !!finalAssetUuid,
                assetUuid: finalAssetUuid,
                message: successMessage,
                verificationData
            });

        } catch (err: any) {
            return errorResult(`Failed to create node: ${err.message}. Args: ${JSON.stringify(args)}`);
        }
    }

    private async getNodeInfo(uuid: string): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required');
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', uuid);
            if (!nodeData) return errorResult('Node not found or invalid response');
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
            return successResult(info);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async findNodes(pattern: string, exactMatch: boolean = false): Promise<ActionToolResult> {
        if (!pattern) return errorResult('pattern is required for action=find');
        try {
            const tree: any = await Editor.Message.request('scene', 'query-node-tree');
            const nodes: any[] = [];
            const searchTree = (node: any, currentPath: string = '') => {
                const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
                const matches = exactMatch
                    ? node.name === pattern
                    : node.name.toLowerCase().includes(pattern.toLowerCase());
                if (matches) nodes.push({ uuid: node.uuid, name: node.name, path: nodePath });
                if (node.children) {
                    for (const child of node.children) searchTree(child, nodePath);
                }
            };
            if (tree) searchTree(tree);
            return successResult(nodes);
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'findNodes', args: [pattern, exactMatch]
                });
                if (result && result.success) return successResult(result.data, result.message);
                return errorResult(result?.error || 'Unknown error');
            } catch (err2: any) {
                return errorResult(`Tree search failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }

    private async findNodeByName(name: string): Promise<ActionToolResult> {
        if (!name) return errorResult('name is required for action=find_by_name');
        try {
            const tree: any = await Editor.Message.request('scene', 'query-node-tree');
            const foundNode = searchNodeInTree(tree, name);
            if (foundNode) {
                return successResult({ uuid: foundNode.uuid, name: foundNode.name, path: getNodePath(foundNode) });
            }
            return errorResult(`Node '${name}' not found`);
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'findNodeByName', args: [name]
                });
                if (result && result.success) return successResult(result.data, result.message);
                return errorResult(result?.error || 'Unknown error');
            } catch (err2: any) {
                return errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }

    private async getAllNodes(): Promise<ActionToolResult> {
        try {
            const tree: any = await Editor.Message.request('scene', 'query-node-tree');
            const nodes: any[] = [];
            const traverseTree = (node: any) => {
                nodes.push({ uuid: node.uuid, name: node.name, type: node.type, active: node.active, path: getNodePath(node) });
                if (node.children) {
                    for (const child of node.children) traverseTree(child);
                }
            };
            if (tree && tree.children) traverseTree(tree);
            return successResult({ totalNodes: nodes.length, nodes });
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'getAllNodes', args: []
                });
                if (result && result.success) return successResult(result.data, result.message);
                return errorResult(result?.error || 'Unknown error');
            } catch (err2: any) {
                return errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }

    private async setNodeProperty(uuid: string, property: string, value: any): Promise<ActionToolResult> {
        if (!uuid || !property || value === undefined) {
            return errorResult('uuid, property, and value are required for action=set_property');
        }
        try {
            await Editor.Message.request('scene', 'set-property', { uuid, path: property, dump: { value } });
            try {
                const nodeInfo = await this.getNodeInfo(uuid);
                return successResult({
                    nodeUuid: uuid, property, newValue: value, nodeInfo: nodeInfo.data,
                    changeDetails: { property, value, timestamp: new Date().toISOString() }
                }, `Property '${property}' updated successfully`);
            } catch {
                return successResult({ nodeUuid: uuid, property, newValue: value }, `Property '${property}' updated successfully (verification failed)`);
            }
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'setNodeProperty', args: [uuid, property, value]
                });
                if (result && result.success) return successResult(result.data, result.message);
                return errorResult(result?.error || 'Unknown error');
            } catch (err2: any) {
                return errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }

    private async setNodeTransform(args: any): Promise<ActionToolResult> {
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
                return errorResult('Failed to get node information');
            }

            const nodeInfo = nodeInfoResponse.data;
            const nodeIs2D = is2DNode(nodeInfo);

            if (position) {
                const normalized = normalizeTransformValue(position, 'position', nodeIs2D);
                if (normalized.warning) warnings.push(normalized.warning);
                updatePromises.push(
                    Editor.Message.request('scene', 'set-property', {
                        uuid, path: 'position', dump: { value: normalized.value }
                    })
                );
                updates.push('position');
            }

            if (rotation) {
                const normalized = normalizeTransformValue(rotation, 'rotation', nodeIs2D);
                if (normalized.warning) warnings.push(normalized.warning);
                updatePromises.push(
                    Editor.Message.request('scene', 'set-property', {
                        uuid, path: 'rotation', dump: { value: normalized.value }
                    })
                );
                updates.push('rotation');
            }

            if (scale) {
                const normalized = normalizeTransformValue(scale, 'scale', nodeIs2D);
                if (normalized.warning) warnings.push(normalized.warning);
                updatePromises.push(
                    Editor.Message.request('scene', 'set-property', {
                        uuid, path: 'scale', dump: { value: normalized.value }
                    })
                );
                updates.push('scale');
            }

            if (updatePromises.length === 0) {
                return errorResult('No transform properties specified');
            }

            await Promise.all(updatePromises);

            const updatedNodeInfo = await this.getNodeInfo(uuid);
            const result: ActionToolResult = {
                success: true,
                message: `Transform properties updated: ${updates.join(', ')} ${nodeIs2D ? '(2D node)' : '(3D node)'}`,
                data: {
                    nodeUuid: uuid,
                    nodeType: nodeIs2D ? '2D' : '3D',
                    appliedChanges: updates,
                    transformConstraints: {
                        position: nodeIs2D ? 'x, y only (z ignored)' : 'x, y, z all used',
                        rotation: nodeIs2D ? 'z only (x, y ignored)' : 'x, y, z all used',
                        scale: nodeIs2D ? 'x, y main, z typically 1' : 'x, y, z all used'
                    },
                    nodeInfo: updatedNodeInfo.data,
                    transformDetails: {
                        originalNodeType: nodeIs2D ? '2D' : '3D',
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

            return result;

        } catch (err: any) {
            return errorResult(`Failed to update transform: ${err.message}`);
        }
    }

    private async deleteNode(uuid: string): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required for action=delete');
        try {
            await Editor.Message.request('scene', 'remove-node', { uuid });
            return successResult(null, 'Node deleted successfully');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async moveNode(nodeUuid: string, newParentUuid: string, siblingIndex: number = -1, keepWorldTransform: boolean = false): Promise<ActionToolResult> {
        if (!nodeUuid || !newParentUuid) {
            return errorResult('nodeUuid and newParentUuid are required for action=move');
        }
        try {
            await Editor.Message.request('scene', 'set-parent', {
                parent: newParentUuid,
                uuids: [nodeUuid],
                keepWorldTransform
            });
            if (siblingIndex >= 0) {
                try {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: 'siblingIndex',
                        dump: { value: siblingIndex }
                    });
                } catch (err) {
                    console.warn('Failed to set siblingIndex after move:', err);
                }
            }
            return successResult(null, 'Node moved successfully');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async duplicateNode(uuid: string, includeChildren: boolean = true): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required for action=duplicate');
        try {
            if (!includeChildren) {
                // Shallow duplicate: create new node with same name/parent but no children
                const nodeInfoResponse = await this.getNodeInfo(uuid);
                if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                    return errorResult('Failed to get node info for shallow duplicate');
                }
                const nodeInfo = nodeInfoResponse.data;
                const newNodeUuid = await Editor.Message.request('scene', 'create-node', {
                    name: nodeInfo.name,
                    parent: nodeInfo.parent || undefined
                });
                const newUuid = Array.isArray(newNodeUuid) ? newNodeUuid[0] : newNodeUuid;
                return successResult({ newUuid, shallow: true }, 'Node duplicated (without children) successfully');
            }
            const result: any = await Editor.Message.request('scene', 'duplicate-node', uuid);
            return successResult({
                newUuid: result?.uuid ?? result,
                message: 'Node duplicated successfully'
            });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async detectNodeType(uuid: string): Promise<ActionToolResult> {
        if (!uuid) return errorResult('uuid is required for action=detect_type');
        try {
            const nodeInfoResponse = await this.getNodeInfo(uuid);
            if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                return errorResult('Failed to get node information');
            }

            const nodeInfo = nodeInfoResponse.data;
            const is2D = is2DNode(nodeInfo);
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

            return successResult({
                nodeUuid: uuid,
                nodeName: nodeInfo.name,
                nodeType: is2D ? '2D' : '3D',
                detectionReasons,
                components: components.map((comp: any) => ({
                    type: comp.type,
                    category: getComponentCategory(comp.type)
                })),
                position: nodeInfo.position,
                transformConstraints: {
                    position: is2D ? 'x, y only (z ignored)' : 'x, y, z all used',
                    rotation: is2D ? 'z only (x, y ignored)' : 'x, y, z all used',
                    scale: is2D ? 'x, y main, z typically 1' : 'x, y, z all used'
                }
            });

        } catch (err: any) {
            return errorResult(`Failed to detect node type: ${err.message}`);
        }
    }

}
