import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, NodeInfo, successResult, errorResult } from '../types';
import { coerceBool, coerceInt, coerceFloat, normalizeVec3 } from '../utils/normalize';
import { is2DNode, is2DComponentType, is3DComponentType, normalizeTransformValue, getComponentCategory, getNodePath, searchNodeInTree } from './manage-node-transform-helpers';

/** Longest `awaitNodeCommit` waits for a freshly created node to become queryable. */
const NODE_COMMIT_TIMEOUT_MS = 2000;
/** Gap between `scene:query-node` polls while waiting for that commit. */
const NODE_COMMIT_POLL_MS = 20;

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
            propertyType: {
                type: 'string',
                enum: ['boolean', 'number', 'string'],
                description: "[set_property] Optional value-type hint, honoured the same way manage_component set_property does. 'active' is coerced as boolean automatically even when omitted; pass 'boolean' explicitly for any other boolean node property to avoid a truthy-string no-op (e.g. value=\"false\" over a transport that stringifies args)."
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
        set_property: (args) => this.setNodeProperty(args.uuid, args.property, args.value, args.propertyType),
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
            let assetType: string | undefined;
            if (args.assetPath && !finalAssetUuid) {
                try {
                    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetPath);
                    if (assetInfo && assetInfo.uuid) {
                        finalAssetUuid = assetInfo.uuid;
                        assetType = assetInfo.type;
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

                // `type` selects the createNodeFromAsset() branch that instantiates a
                // linked instance (e.g. a prefab's cc.PrefabInfo/PrefabInstance). Without
                // it, 3.8.7's node manager falls back to a plain node built from the
                // asset's raw dump — a flattened, unlinked copy that reports success
                // but carries no prefab link. Resolve it when not already known from the
                // assetPath lookup above.
                if (!assetType) {
                    try {
                        const info = await Editor.Message.request('asset-db', 'query-asset-info', finalAssetUuid);
                        assetType = info?.type;
                    } catch (err) {
                        console.warn(`Failed to resolve asset type for '${finalAssetUuid}':`, err);
                    }
                }
                if (assetType) {
                    createNodeOptions.type = assetType;
                }

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
                    await this.awaitNodeCommit(uuid);
                    await Editor.Message.request('scene', 'set-parent', {
                        parent: targetParentUuid,
                        uuids: [uuid],
                        keepWorldTransform: coerceBool(args.keepWorldTransform) || false
                    });
                    // Best-effort verification: this re-parent is a secondary ordering step
                    // after node creation already succeeded, so a mismatch is logged rather
                    // than failing the whole create — the verificationData read-back below
                    // still reports the node's true final parent either way.
                    const verifyInfo = await this.getNodeInfo(uuid);
                    if (!verifyInfo.success || verifyInfo.data?.parent !== targetParentUuid) {
                        console.warn(`Sibling-index reparent did not verify: expected parent '${targetParentUuid}', got '${verifyInfo.data?.parent}'`);
                    }
                } catch (err) {
                    console.warn('Failed to set sibling index:', err);
                }
            }

            if (args.components && args.components.length > 0 && uuid) {
                try {
                    await this.awaitNodeCommit(uuid);
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
                    await this.awaitNodeCommit(uuid);
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

    /**
     * `scene:create-node` resolves before the new node is queryable, so the follow-up
     * set-parent / create-component / initial-transform steps used to wait out a fixed
     * 100-150ms sleep and then proceed regardless of whether the commit had landed. On a
     * busy editor it had not, and those edits were silently dropped from the created node
     * (#6). Poll `scene:query-node` instead: continue as soon as the node is actually
     * visible, and throw when it never becomes visible so the caller's existing catch
     * reports a real reason rather than a blind failure further down.
     */
    private async awaitNodeCommit(uuid: string): Promise<void> {
        const deadline = Date.now() + NODE_COMMIT_TIMEOUT_MS;
        for (;;) {
            try {
                const nodeData: any = await Editor.Message.request('scene', 'query-node', uuid);
                if (nodeData) return;
            } catch (err) {
                // query-node rejects while the node is not yet in the graph — keep polling.
            }
            if (Date.now() >= deadline) {
                throw new Error(`Node '${uuid}' was not queryable within ${NODE_COMMIT_TIMEOUT_MS}ms of creation`);
            }
            await new Promise(r => setTimeout(r, NODE_COMMIT_POLL_MS));
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

    /** Node properties that must be treated as boolean even when propertyType is omitted. */
    private static readonly KNOWN_BOOLEAN_NODE_PROPERTIES = new Set(['active']);

    /**
     * Coerce a set_property value by the requested (or inferred) propertyType.
     * Throws on a value that cannot be coerced, so the caller returns errorResult
     * instead of silently forwarding a value the engine will misinterpret.
     */
    private coerceNodePropertyValue(property: string, value: any, propertyType?: string): any {
        const effectiveType = propertyType
            || (ManageNode.KNOWN_BOOLEAN_NODE_PROPERTIES.has(property) ? 'boolean' : undefined);

        if (effectiveType === 'boolean') {
            const coerced = coerceBool(value);
            if (coerced === undefined) {
                throw new Error(`Property '${property}' expects a boolean value (true/false/1/0/"true"/"false"), received: ${JSON.stringify(value)}`);
            }
            return coerced;
        }
        if (effectiveType === 'number') {
            const coerced = coerceFloat(value);
            if (coerced === undefined) {
                throw new Error(`Property '${property}' expects a numeric value, received: ${JSON.stringify(value)}`);
            }
            return coerced;
        }
        return value;
    }

    /**
     * Read a node property back from the live scene for set_property verification.
     * Only resolves top-level dump entries (active, name, layer, mobility, ...) — the
     * properties set_property actually documents. `found: false` means the path could
     * not be resolved this way (e.g. a nested property), NOT that the write failed.
     */
    private async readNodeProperty(uuid: string, property: string): Promise<{ found: boolean; value: any }> {
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', uuid);
            const entry = nodeData ? nodeData[property] : undefined;
            if (entry && typeof entry === 'object' && 'value' in entry) {
                return { found: true, value: entry.value };
            }
            return { found: false, value: undefined };
        } catch {
            return { found: false, value: undefined };
        }
    }

    private async setNodeProperty(uuid: string, property: string, value: any, propertyType?: string): Promise<ActionToolResult> {
        if (!uuid || !property || value === undefined) {
            return errorResult('uuid, property, and value are required for action=set_property');
        }

        // Issue #47: a boolean node property (active, ...) sent through any transport
        // that stringifies args arrives as `"false"` — a TRUTHY string — so
        // `node.active = "false"` silently leaves the node active. Coerce by an explicit
        // propertyType, or by a known boolean property name when propertyType is
        // omitted, the same way manage_component set_property honours propertyType.
        let coercedValue: any;
        try {
            coercedValue = this.coerceNodePropertyValue(property, value, propertyType);
        } catch (coerceErr: any) {
            return errorResult(coerceErr.message);
        }

        try {
            await Editor.Message.request('scene', 'set-property', { uuid, path: property, dump: { value: coercedValue } });

            // Issue #47: `set-property` resolving without throwing does NOT mean the
            // write took effect — read the property back and compare, the same
            // verify-don't-assume fix #34/#42 already applied to manage_component.
            const verify = await this.readNodeProperty(uuid, property);
            if (verify.found && verify.value !== coercedValue) {
                return errorResult(
                    `Property '${property}' write did not take effect: requested ${JSON.stringify(coercedValue)}, ` +
                    `actual value is ${JSON.stringify(verify.value)}.`
                );
            }
            const verifiedSuffix = verify.found ? '' : ' (unable to verify — read-back did not resolve a value at this property path)';

            try {
                const nodeInfo = await this.getNodeInfo(uuid);
                return successResult({
                    nodeUuid: uuid, property, newValue: coercedValue, nodeInfo: nodeInfo.data,
                    changeDetails: { property, value: coercedValue, timestamp: new Date().toISOString() }
                }, `Property '${property}' updated successfully${verifiedSuffix}`);
            } catch {
                return successResult({ nodeUuid: uuid, property, newValue: coercedValue }, `Property '${property}' updated successfully${verifiedSuffix}`);
            }
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'setNodeProperty', args: [uuid, property, coercedValue]
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

            // Read back the actual parent. `set-parent` silently no-ops for some prefab-
            // instance constraints (e.g. moving a prefab root out from under its instance),
            // so a resolved promise here does not guarantee the reparent took effect.
            const verifyInfo = await this.getNodeInfo(nodeUuid);
            if (!verifyInfo.success || !verifyInfo.data) {
                return errorResult(`Node move could not be verified: failed to read back node '${nodeUuid}' after the move.`);
            }
            if (verifyInfo.data.parent !== newParentUuid) {
                return errorResult(
                    `Node move did not take effect: expected parent '${newParentUuid}' but the node still reports parent '${verifyInfo.data.parent}'. ` +
                    `This can happen when the node is a prefab instance's root and reparenting is blocked by the prefab link.`
                );
            }

            return successResult({ nodeUuid, newParentUuid, nodeInfo: verifyInfo.data }, 'Node moved successfully');
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

            const twoDComponents = components.filter((comp: any) => is2DComponentType(comp.type));

            const threeDComponents = components.filter((comp: any) => is3DComponentType(comp.type));

            if (twoDComponents.length > 0) {
                detectionReasons.push(`Has 2D components: ${twoDComponents.map((c: any) => c.type).join(', ')}`);
            }
            if (threeDComponents.length > 0) {
                detectionReasons.push(`Has 3D components: ${threeDComponents.map((c: any) => c.type).join(', ')}`);
            }

            // Node position is NOT used to infer 2D-ness: a 3D node legitimately sits
            // at the origin (z = 0). Absent a 2D/UI component, the node is treated as 3D.
            if (twoDComponents.length === 0) {
                detectionReasons.push('No 2D/UI component found; treated as 3D (full x, y, z transform)');
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
