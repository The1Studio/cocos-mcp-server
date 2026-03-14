"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageNode = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
const manage_node_transform_helpers_1 = require("./manage-node-transform-helpers");
class ManageNode extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_node';
        this.description = 'Manage nodes in the current scene. Actions: create, get_info, find, find_by_name, get_all, set_property, set_transform, delete, move, duplicate, detect_type. NOT for components — use manage_component. NOT for prefabs — use manage_prefab. Prerequisites: scene must be open (verify with manage_scene action=get_current). To find node UUIDs: use action=find or action=get_all first.';
        this.actions = ['create', 'get_info', 'find', 'find_by_name', 'get_all', 'set_property', 'set_transform', 'delete', 'move', 'duplicate', 'detect_type'];
        this.inputSchema = {
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
        this.actionHandlers = {
            create: (args) => this.createNode(args),
            get_info: (args) => this.getNodeInfo(args.uuid),
            find: (args) => { var _a; return this.findNodes(args.pattern, (_a = (0, normalize_1.coerceBool)(args.exactMatch)) !== null && _a !== void 0 ? _a : false); },
            find_by_name: (args) => this.findNodeByName(args.name),
            get_all: () => this.getAllNodes(),
            set_property: (args) => this.setNodeProperty(args.uuid, args.property, args.value),
            set_transform: (args) => this.setNodeTransform(args),
            delete: (args) => this.deleteNode(args.uuid),
            move: (args) => { var _a, _b; return this.moveNode(args.nodeUuid, args.newParentUuid, (_a = (0, normalize_1.coerceInt)(args.siblingIndex)) !== null && _a !== void 0 ? _a : -1, (_b = (0, normalize_1.coerceBool)(args.keepWorldTransform)) !== null && _b !== void 0 ? _b : false); },
            duplicate: (args) => { var _a; return this.duplicateNode(args.uuid, (_a = (0, normalize_1.coerceBool)(args.includeChildren)) !== null && _a !== void 0 ? _a : true); },
            detect_type: (args) => this.detectNodeType(args.uuid)
        };
    }
    async createNode(args) {
        try {
            let targetParentUuid = args.parentUuid;
            if (!targetParentUuid) {
                try {
                    const sceneInfo = await Editor.Message.request('scene', 'query-node-tree');
                    if (sceneInfo && typeof sceneInfo === 'object' && !Array.isArray(sceneInfo) && Object.prototype.hasOwnProperty.call(sceneInfo, 'uuid')) {
                        targetParentUuid = sceneInfo.uuid;
                        console.log(`No parent specified, using scene root: ${targetParentUuid}`);
                    }
                    else if (Array.isArray(sceneInfo) && sceneInfo.length > 0 && sceneInfo[0].uuid) {
                        targetParentUuid = sceneInfo[0].uuid;
                        console.log(`No parent specified, using scene root: ${targetParentUuid}`);
                    }
                    else {
                        const currentScene = await Editor.Message.request('scene', 'query-current-scene');
                        if (currentScene && currentScene.uuid) {
                            targetParentUuid = currentScene.uuid;
                        }
                    }
                }
                catch (err) {
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
                    }
                    else {
                        return (0, types_1.errorResult)(`Asset not found at path: ${args.assetPath}`);
                    }
                }
                catch (err) {
                    return (0, types_1.errorResult)(`Failed to resolve asset path '${args.assetPath}': ${err}`);
                }
            }
            const createNodeOptions = { name: args.name };
            if (targetParentUuid) {
                createNodeOptions.parent = targetParentUuid;
            }
            if (finalAssetUuid) {
                createNodeOptions.assetUuid = finalAssetUuid;
                if ((0, normalize_1.coerceBool)(args.unlinkPrefab)) {
                    createNodeOptions.unlinkPrefab = true;
                }
            }
            if (args.components && args.components.length > 0) {
                createNodeOptions.components = args.components;
            }
            else if (args.nodeType && args.nodeType !== 'Node' && !finalAssetUuid) {
                createNodeOptions.components = [args.nodeType];
            }
            if ((0, normalize_1.coerceBool)(args.keepWorldTransform)) {
                createNodeOptions.keepWorldTransform = true;
            }
            const siblingIndex = (0, normalize_1.coerceInt)(args.siblingIndex);
            console.log('Creating node with options:', createNodeOptions);
            const nodeUuid = await Editor.Message.request('scene', 'create-node', createNodeOptions);
            const uuid = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;
            if (siblingIndex !== undefined && siblingIndex >= 0 && uuid && targetParentUuid) {
                try {
                    await new Promise(r => setTimeout(r, 100));
                    await Editor.Message.request('scene', 'set-parent', {
                        parent: targetParentUuid,
                        uuids: [uuid],
                        keepWorldTransform: (0, normalize_1.coerceBool)(args.keepWorldTransform) || false
                    });
                }
                catch (err) {
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
                        }
                        catch (err) {
                            console.warn(`Failed to add component ${componentType}:`, err);
                        }
                    }
                }
                catch (err) {
                    console.warn('Failed to add components:', err);
                }
            }
            if (args.initialTransform && uuid) {
                try {
                    await new Promise(r => setTimeout(r, 150));
                    const pos = (0, normalize_1.normalizeVec3)(args.initialTransform.position);
                    const rot = (0, normalize_1.normalizeVec3)(args.initialTransform.rotation);
                    const scl = (0, normalize_1.normalizeVec3)(args.initialTransform.scale);
                    await this.setNodeTransform({
                        uuid,
                        position: pos !== null && pos !== void 0 ? pos : args.initialTransform.position,
                        rotation: rot !== null && rot !== void 0 ? rot : args.initialTransform.rotation,
                        scale: scl !== null && scl !== void 0 ? scl : args.initialTransform.scale
                    });
                    console.log('Initial transform applied successfully');
                }
                catch (err) {
                    console.warn('Failed to set initial transform:', err);
                }
            }
            let verificationData = null;
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
            }
            catch (err) {
                console.warn('Failed to get verification data:', err);
            }
            const successMessage = finalAssetUuid
                ? `Node '${args.name}' instantiated from asset successfully`
                : `Node '${args.name}' created successfully`;
            return (0, types_1.successResult)({
                uuid,
                name: args.name,
                parentUuid: targetParentUuid,
                nodeType: args.nodeType || 'Node',
                fromAsset: !!finalAssetUuid,
                assetUuid: finalAssetUuid,
                message: successMessage,
                verificationData
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to create node: ${err.message}. Args: ${JSON.stringify(args)}`);
        }
    }
    async getNodeInfo(uuid) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required');
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', uuid);
            if (!nodeData)
                return (0, types_1.errorResult)('Node not found or invalid response');
            const info = {
                uuid: ((_a = nodeData.uuid) === null || _a === void 0 ? void 0 : _a.value) || uuid,
                name: ((_b = nodeData.name) === null || _b === void 0 ? void 0 : _b.value) || 'Unknown',
                active: ((_c = nodeData.active) === null || _c === void 0 ? void 0 : _c.value) !== undefined ? nodeData.active.value : true,
                position: ((_d = nodeData.position) === null || _d === void 0 ? void 0 : _d.value) || { x: 0, y: 0, z: 0 },
                rotation: ((_e = nodeData.rotation) === null || _e === void 0 ? void 0 : _e.value) || { x: 0, y: 0, z: 0 },
                scale: ((_f = nodeData.scale) === null || _f === void 0 ? void 0 : _f.value) || { x: 1, y: 1, z: 1 },
                parent: ((_h = (_g = nodeData.parent) === null || _g === void 0 ? void 0 : _g.value) === null || _h === void 0 ? void 0 : _h.uuid) || null,
                children: nodeData.children || [],
                components: (nodeData.__comps__ || []).map((comp) => ({
                    type: comp.__type__ || 'Unknown',
                    enabled: comp.enabled !== undefined ? comp.enabled : true
                })),
                layer: ((_j = nodeData.layer) === null || _j === void 0 ? void 0 : _j.value) || 1073741824,
                mobility: ((_k = nodeData.mobility) === null || _k === void 0 ? void 0 : _k.value) || 0
            };
            return (0, types_1.successResult)(info);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async findNodes(pattern, exactMatch = false) {
        if (!pattern)
            return (0, types_1.errorResult)('pattern is required for action=find');
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            const nodes = [];
            const searchTree = (node, currentPath = '') => {
                const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
                const matches = exactMatch
                    ? node.name === pattern
                    : node.name.toLowerCase().includes(pattern.toLowerCase());
                if (matches)
                    nodes.push({ uuid: node.uuid, name: node.name, path: nodePath });
                if (node.children) {
                    for (const child of node.children)
                        searchTree(child, nodePath);
                }
            };
            if (tree)
                searchTree(tree);
            return (0, types_1.successResult)(nodes);
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'findNodes', args: [pattern, exactMatch]
                });
                if (result && result.success)
                    return (0, types_1.successResult)(result.data, result.message);
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error');
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Tree search failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    async findNodeByName(name) {
        if (!name)
            return (0, types_1.errorResult)('name is required for action=find_by_name');
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            const foundNode = (0, manage_node_transform_helpers_1.searchNodeInTree)(tree, name);
            if (foundNode) {
                return (0, types_1.successResult)({ uuid: foundNode.uuid, name: foundNode.name, path: (0, manage_node_transform_helpers_1.getNodePath)(foundNode) });
            }
            return (0, types_1.errorResult)(`Node '${name}' not found`);
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'findNodeByName', args: [name]
                });
                if (result && result.success)
                    return (0, types_1.successResult)(result.data, result.message);
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error');
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    async getAllNodes() {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            const nodes = [];
            const traverseTree = (node) => {
                nodes.push({ uuid: node.uuid, name: node.name, type: node.type, active: node.active, path: (0, manage_node_transform_helpers_1.getNodePath)(node) });
                if (node.children) {
                    for (const child of node.children)
                        traverseTree(child);
                }
            };
            if (tree && tree.children)
                traverseTree(tree);
            return (0, types_1.successResult)({ totalNodes: nodes.length, nodes });
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'getAllNodes', args: []
                });
                if (result && result.success)
                    return (0, types_1.successResult)(result.data, result.message);
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error');
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    async setNodeProperty(uuid, property, value) {
        if (!uuid || !property || value === undefined) {
            return (0, types_1.errorResult)('uuid, property, and value are required for action=set_property');
        }
        try {
            await Editor.Message.request('scene', 'set-property', { uuid, path: property, dump: { value } });
            try {
                const nodeInfo = await this.getNodeInfo(uuid);
                return (0, types_1.successResult)({
                    nodeUuid: uuid, property, newValue: value, nodeInfo: nodeInfo.data,
                    changeDetails: { property, value, timestamp: new Date().toISOString() }
                }, `Property '${property}' updated successfully`);
            }
            catch (_a) {
                return (0, types_1.successResult)({ nodeUuid: uuid, property, newValue: value }, `Property '${property}' updated successfully (verification failed)`);
            }
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'setNodeProperty', args: [uuid, property, value]
                });
                if (result && result.success)
                    return (0, types_1.successResult)(result.data, result.message);
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error');
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    async setNodeTransform(args) {
        var _a, _b, _c;
        const uuid = args.uuid;
        const position = (_a = (0, normalize_1.normalizeVec3)(args.position)) !== null && _a !== void 0 ? _a : args.position;
        const rotation = (_b = (0, normalize_1.normalizeVec3)(args.rotation)) !== null && _b !== void 0 ? _b : args.rotation;
        const scale = (_c = (0, normalize_1.normalizeVec3)(args.scale)) !== null && _c !== void 0 ? _c : args.scale;
        const updatePromises = [];
        const updates = [];
        const warnings = [];
        try {
            const nodeInfoResponse = await this.getNodeInfo(uuid);
            if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                return (0, types_1.errorResult)('Failed to get node information');
            }
            const nodeInfo = nodeInfoResponse.data;
            const nodeIs2D = (0, manage_node_transform_helpers_1.is2DNode)(nodeInfo);
            if (position) {
                const normalized = (0, manage_node_transform_helpers_1.normalizeTransformValue)(position, 'position', nodeIs2D);
                if (normalized.warning)
                    warnings.push(normalized.warning);
                updatePromises.push(Editor.Message.request('scene', 'set-property', {
                    uuid, path: 'position', dump: { value: normalized.value }
                }));
                updates.push('position');
            }
            if (rotation) {
                const normalized = (0, manage_node_transform_helpers_1.normalizeTransformValue)(rotation, 'rotation', nodeIs2D);
                if (normalized.warning)
                    warnings.push(normalized.warning);
                updatePromises.push(Editor.Message.request('scene', 'set-property', {
                    uuid, path: 'rotation', dump: { value: normalized.value }
                }));
                updates.push('rotation');
            }
            if (scale) {
                const normalized = (0, manage_node_transform_helpers_1.normalizeTransformValue)(scale, 'scale', nodeIs2D);
                if (normalized.warning)
                    warnings.push(normalized.warning);
                updatePromises.push(Editor.Message.request('scene', 'set-property', {
                    uuid, path: 'scale', dump: { value: normalized.value }
                }));
                updates.push('scale');
            }
            if (updatePromises.length === 0) {
                return (0, types_1.errorResult)('No transform properties specified');
            }
            await Promise.all(updatePromises);
            const updatedNodeInfo = await this.getNodeInfo(uuid);
            const result = {
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
                result.warning = warnings.join('; ');
            }
            return result;
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to update transform: ${err.message}`);
        }
    }
    async deleteNode(uuid) {
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required for action=delete');
        try {
            await Editor.Message.request('scene', 'remove-node', { uuid });
            return (0, types_1.successResult)(null, 'Node deleted successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async moveNode(nodeUuid, newParentUuid, siblingIndex = -1, keepWorldTransform = false) {
        if (!nodeUuid || !newParentUuid) {
            return (0, types_1.errorResult)('nodeUuid and newParentUuid are required for action=move');
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
                }
                catch (err) {
                    console.warn('Failed to set siblingIndex after move:', err);
                }
            }
            return (0, types_1.successResult)(null, 'Node moved successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async duplicateNode(uuid, includeChildren = true) {
        var _a;
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required for action=duplicate');
        try {
            if (!includeChildren) {
                // Shallow duplicate: create new node with same name/parent but no children
                const nodeInfoResponse = await this.getNodeInfo(uuid);
                if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                    return (0, types_1.errorResult)('Failed to get node info for shallow duplicate');
                }
                const nodeInfo = nodeInfoResponse.data;
                const newNodeUuid = await Editor.Message.request('scene', 'create-node', {
                    name: nodeInfo.name,
                    parent: nodeInfo.parent || undefined
                });
                const newUuid = Array.isArray(newNodeUuid) ? newNodeUuid[0] : newNodeUuid;
                return (0, types_1.successResult)({ newUuid, shallow: true }, 'Node duplicated (without children) successfully');
            }
            const result = await Editor.Message.request('scene', 'duplicate-node', uuid);
            return (0, types_1.successResult)({
                newUuid: (_a = result === null || result === void 0 ? void 0 : result.uuid) !== null && _a !== void 0 ? _a : result,
                message: 'Node duplicated successfully'
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async detectNodeType(uuid) {
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required for action=detect_type');
        try {
            const nodeInfoResponse = await this.getNodeInfo(uuid);
            if (!nodeInfoResponse.success || !nodeInfoResponse.data) {
                return (0, types_1.errorResult)('Failed to get node information');
            }
            const nodeInfo = nodeInfoResponse.data;
            const is2D = (0, manage_node_transform_helpers_1.is2DNode)(nodeInfo);
            const components = nodeInfo.components || [];
            const detectionReasons = [];
            const twoDComponents = components.filter((comp) => comp.type && (comp.type.includes('cc.Sprite') ||
                comp.type.includes('cc.Label') ||
                comp.type.includes('cc.Button') ||
                comp.type.includes('cc.Layout') ||
                comp.type.includes('cc.Widget') ||
                comp.type.includes('cc.Mask') ||
                comp.type.includes('cc.Graphics')));
            const threeDComponents = components.filter((comp) => comp.type && (comp.type.includes('cc.MeshRenderer') ||
                comp.type.includes('cc.Camera') ||
                comp.type.includes('cc.Light') ||
                comp.type.includes('cc.DirectionalLight') ||
                comp.type.includes('cc.PointLight') ||
                comp.type.includes('cc.SpotLight')));
            if (twoDComponents.length > 0) {
                detectionReasons.push(`Has 2D components: ${twoDComponents.map((c) => c.type).join(', ')}`);
            }
            if (threeDComponents.length > 0) {
                detectionReasons.push(`Has 3D components: ${threeDComponents.map((c) => c.type).join(', ')}`);
            }
            const position = nodeInfo.position;
            if (position && Math.abs(position.z) < 0.001) {
                detectionReasons.push('Z position is ~0 (likely 2D)');
            }
            else if (position && Math.abs(position.z) > 0.001) {
                detectionReasons.push(`Z position is ${position.z} (likely 3D)`);
            }
            if (detectionReasons.length === 0) {
                detectionReasons.push('No specific indicators found, defaulting based on heuristics');
            }
            return (0, types_1.successResult)({
                nodeUuid: uuid,
                nodeName: nodeInfo.name,
                nodeType: is2D ? '2D' : '3D',
                detectionReasons,
                components: components.map((comp) => ({
                    type: comp.type,
                    category: (0, manage_node_transform_helpers_1.getComponentCategory)(comp.type)
                })),
                position: nodeInfo.position,
                transformConstraints: {
                    position: is2D ? 'x, y only (z ignored)' : 'x, y, z all used',
                    rotation: is2D ? 'z only (x, y ignored)' : 'x, y, z all used',
                    scale: is2D ? 'x, y main, z typically 1' : 'x, y, z all used'
                }
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to detect node type: ${err.message}`);
        }
    }
}
exports.ManageNode = ManageNode;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLW5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUFrRjtBQUNsRixrREFBMEU7QUFDMUUsbUZBQXlJO0FBRXpJLE1BQWEsVUFBVyxTQUFRLGlDQUFjO0lBQTlDOztRQUVhLFNBQUksR0FBRyxhQUFhLENBQUM7UUFDckIsZ0JBQVcsR0FBRyw2WEFBNlgsQ0FBQztRQUM1WSxZQUFPLEdBQUcsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDbkosZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQztvQkFDOUksV0FBVyxFQUFFLHVZQUF1WTtpQkFDdlo7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtRkFBbUY7aUJBQ25HO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsNERBQTREO2lCQUM1RTtnQkFDRCxVQUFVLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLCtIQUErSDtpQkFDL0k7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLElB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UUFBUSxDQUFDLE1BQU0sMENBQUUsS0FBSyxNQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUk7Z0JBQzNFLFFBQVEsRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLFFBQVEsMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQzFELFFBQVEsRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLFFBQVEsMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQzFELEtBQUssRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLEtBQUssMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ3BELE1BQU0sRUFBRSxDQUFBLE1BQUEsTUFBQSxRQUFRLENBQUMsTUFBTSwwQ0FBRSxLQUFLLDBDQUFFLElBQUksS0FBSSxJQUFJO2dCQUM1QyxRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVEsSUFBSSxFQUFFO2dCQUNqQyxVQUFVLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDdkQsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksU0FBUztvQkFDaEMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO2lCQUM1RCxDQUFDLENBQUM7Z0JBQ0gsS0FBSyxFQUFFLENBQUEsTUFBQSxRQUFRLENBQUMsS0FBSywwQ0FBRSxLQUFLLEtBQUksVUFBVTtnQkFD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a0JBQWtCO29CQUM3RCxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsa0JBQWtCO29CQUM3RCxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsa0JBQWtCO2lCQUNoRTthQUNKLENBQUMsQ0FBQztRQUVQLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtCQUErQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBN3BCRCxnQ0E2cEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgTm9kZUluZm8sIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29lcmNlQm9vbCwgY29lcmNlSW50LCBub3JtYWxpemVWZWMzIH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcbmltcG9ydCB7IGlzMkROb2RlLCBub3JtYWxpemVUcmFuc2Zvcm1WYWx1ZSwgZ2V0Q29tcG9uZW50Q2F0ZWdvcnksIGdldE5vZGVQYXRoLCBzZWFyY2hOb2RlSW5UcmVlIH0gZnJvbSAnLi9tYW5hZ2Utbm9kZS10cmFuc2Zvcm0taGVscGVycyc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VOb2RlIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2Vfbm9kZSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIG5vZGVzIGluIHRoZSBjdXJyZW50IHNjZW5lLiBBY3Rpb25zOiBjcmVhdGUsIGdldF9pbmZvLCBmaW5kLCBmaW5kX2J5X25hbWUsIGdldF9hbGwsIHNldF9wcm9wZXJ0eSwgc2V0X3RyYW5zZm9ybSwgZGVsZXRlLCBtb3ZlLCBkdXBsaWNhdGUsIGRldGVjdF90eXBlLiBOT1QgZm9yIGNvbXBvbmVudHMg4oCUIHVzZSBtYW5hZ2VfY29tcG9uZW50LiBOT1QgZm9yIHByZWZhYnMg4oCUIHVzZSBtYW5hZ2VfcHJlZmFiLiBQcmVyZXF1aXNpdGVzOiBzY2VuZSBtdXN0IGJlIG9wZW4gKHZlcmlmeSB3aXRoIG1hbmFnZV9zY2VuZSBhY3Rpb249Z2V0X2N1cnJlbnQpLiBUbyBmaW5kIG5vZGUgVVVJRHM6IHVzZSBhY3Rpb249ZmluZCBvciBhY3Rpb249Z2V0X2FsbCBmaXJzdC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2NyZWF0ZScsICdnZXRfaW5mbycsICdmaW5kJywgJ2ZpbmRfYnlfbmFtZScsICdnZXRfYWxsJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfdHJhbnNmb3JtJywgJ2RlbGV0ZScsICdtb3ZlJywgJ2R1cGxpY2F0ZScsICdkZXRlY3RfdHlwZSddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydjcmVhdGUnLCAnZ2V0X2luZm8nLCAnZmluZCcsICdmaW5kX2J5X25hbWUnLCAnZ2V0X2FsbCcsICdzZXRfcHJvcGVydHknLCAnc2V0X3RyYW5zZm9ybScsICdkZWxldGUnLCAnbW92ZScsICdkdXBsaWNhdGUnLCAnZGV0ZWN0X3R5cGUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBjcmVhdGU9Y3JlYXRlIG5ldyBub2RlIGluIHNjZW5lLCBnZXRfaW5mbz1nZXQgbm9kZSBkZXRhaWxzIGJ5IFVVSUQsIGZpbmQ9c2VhcmNoIG5vZGVzIGJ5IG5hbWUgcGF0dGVybiwgZmluZF9ieV9uYW1lPWZpbmQgZmlyc3Qgbm9kZSBieSBleGFjdCBuYW1lLCBnZXRfYWxsPWxpc3QgYWxsIG5vZGVzIHdpdGggVVVJRHMsIHNldF9wcm9wZXJ0eT1zZXQgYSBub2RlIHByb3BlcnR5LCBzZXRfdHJhbnNmb3JtPXNldCBwb3NpdGlvbi9yb3RhdGlvbi9zY2FsZSwgZGVsZXRlPXJlbW92ZSBub2RlIGZyb20gc2NlbmUsIG1vdmU9cmVwYXJlbnQgbm9kZSwgZHVwbGljYXRlPWNsb25lIG5vZGUsIGRldGVjdF90eXBlPWRldGVjdCBpZiBub2RlIGlzIDJEIG9yIDNEJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCBzZXRfdHJhbnNmb3JtLCBkZWxldGUsIGR1cGxpY2F0ZSwgZGV0ZWN0X3R5cGVdIE5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBOb2RlIG5hbWUuIFtmaW5kX2J5X25hbWVdIEV4YWN0IG5vZGUgbmFtZSB0byBmaW5kJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIFBhcmVudCBub2RlIFVVSUQuIFNUUk9OR0xZIFJFQ09NTUVOREVELiBVc2UgZ2V0X2FsbCB0byBmaW5kIHBhcmVudCBVVUlEcy4gSWYgb21pdHRlZCwgbm9kZSBpcyBjcmVhdGVkIGF0IHNjZW5lIHJvb3QuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydOb2RlJywgJzJETm9kZScsICczRE5vZGUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIE5vZGUgdHlwZTogTm9kZSwgMkROb2RlLCAzRE5vZGUnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdOb2RlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNpYmxpbmdJbmRleDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZSwgbW92ZV0gU2libGluZyBpbmRleCBmb3Igb3JkZXJpbmcgKC0xIG1lYW5zIGFwcGVuZCBhdCBlbmQpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAtMVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzc2V0VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gQXNzZXQgVVVJRCB0byBpbnN0YW50aWF0ZSBmcm9tIChlLmcuLCBwcmVmYWIgVVVJRCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXNzZXRQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBBc3NldCBwYXRoIHRvIGluc3RhbnRpYXRlIGZyb20gKGUuZy4sIFwiZGI6Ly9hc3NldHMvcHJlZmFicy9NeVByZWZhYi5wcmVmYWJcIikuIEFsdGVybmF0aXZlIHRvIGFzc2V0VXVpZC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29tcG9uZW50czoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEFycmF5IG9mIGNvbXBvbmVudCB0eXBlIG5hbWVzIHRvIGFkZCAoZS5nLiwgW1wiY2MuU3ByaXRlXCIsIFwiY2MuQnV0dG9uXCJdKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1bmxpbmtQcmVmYWI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBJZiB0cnVlIGFuZCBjcmVhdGluZyBmcm9tIHByZWZhYiwgdW5saW5rIGZyb20gcHJlZmFiIHRvIGNyZWF0ZSBhIHJlZ3VsYXIgbm9kZScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlLCBtb3ZlXSBXaGV0aGVyIHRvIGtlZXAgd29ybGQgdHJhbnNmb3JtJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWxUcmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHg6IHsgdHlwZTogJ251bWJlcicgfSwgeTogeyB0eXBlOiAnbnVtYmVyJyB9LCB6OiB7IHR5cGU6ICdudW1iZXInIH0gfSB9LFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB4OiB7IHR5cGU6ICdudW1iZXInIH0sIHk6IHsgdHlwZTogJ251bWJlcicgfSwgejogeyB0eXBlOiAnbnVtYmVyJyB9IH0gfSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgeDogeyB0eXBlOiAnbnVtYmVyJyB9LCB5OiB7IHR5cGU6ICdudW1iZXInIH0sIHo6IHsgdHlwZTogJ251bWJlcicgfSB9IH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gSW5pdGlhbCB0cmFuc2Zvcm0gdG8gYXBwbHkgYWZ0ZXIgY3JlYXRpb24nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2ZpbmRdIE5hbWUgcGF0dGVybiB0byBzZWFyY2ggZm9yJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4YWN0TWF0Y2g6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZmluZF0gVXNlIGV4YWN0IG1hdGNoIGluc3RlYWQgb2YgcGFydGlhbCBtYXRjaCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZSAoZS5nLiwgYWN0aXZlLCBuYW1lLCBsYXllciknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IHZhbHVlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdaIGNvb3JkaW5hdGUgKGlnbm9yZWQgZm9yIDJEIG5vZGVzKScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RyYW5zZm9ybV0gTm9kZSBwb3NpdGlvbi4gRm9yIDJEIG5vZGVzLCBvbmx5IHgseSBhcmUgdXNlZC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm90YXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnSWdub3JlZCBmb3IgMkQgbm9kZXMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnSWdub3JlZCBmb3IgMkQgbm9kZXMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnTWFpbiByb3RhdGlvbiBheGlzIGZvciAyRCBub2RlcycgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RyYW5zZm9ybV0gTm9kZSByb3RhdGlvbiBpbiBldWxlciBhbmdsZXMuIEZvciAyRCBub2Rlcywgb25seSB6IGlzIHVzZWQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdVc3VhbGx5IDEgZm9yIDJEIG5vZGVzJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfdHJhbnNmb3JtXSBOb2RlIHNjYWxlLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW21vdmVdIE5vZGUgVVVJRCB0byBtb3ZlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5ld1BhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ttb3ZlXSBOZXcgcGFyZW50IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZHVwbGljYXRlXSBJbmNsdWRlIGNoaWxkcmVuIG5vZGVzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmNyZWF0ZU5vZGUoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXROb2RlSW5mbyhhcmdzLnV1aWQpLFxuICAgICAgICBmaW5kOiAoYXJncykgPT4gdGhpcy5maW5kTm9kZXMoYXJncy5wYXR0ZXJuLCBjb2VyY2VCb29sKGFyZ3MuZXhhY3RNYXRjaCkgPz8gZmFsc2UpLFxuICAgICAgICBmaW5kX2J5X25hbWU6IChhcmdzKSA9PiB0aGlzLmZpbmROb2RlQnlOYW1lKGFyZ3MubmFtZSksXG4gICAgICAgIGdldF9hbGw6ICgpID0+IHRoaXMuZ2V0QWxsTm9kZXMoKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXROb2RlUHJvcGVydHkoYXJncy51dWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlKSxcbiAgICAgICAgc2V0X3RyYW5zZm9ybTogKGFyZ3MpID0+IHRoaXMuc2V0Tm9kZVRyYW5zZm9ybShhcmdzKSxcbiAgICAgICAgZGVsZXRlOiAoYXJncykgPT4gdGhpcy5kZWxldGVOb2RlKGFyZ3MudXVpZCksXG4gICAgICAgIG1vdmU6IChhcmdzKSA9PiB0aGlzLm1vdmVOb2RlKGFyZ3Mubm9kZVV1aWQsIGFyZ3MubmV3UGFyZW50VXVpZCwgY29lcmNlSW50KGFyZ3Muc2libGluZ0luZGV4KSA/PyAtMSwgY29lcmNlQm9vbChhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybSkgPz8gZmFsc2UpLFxuICAgICAgICBkdXBsaWNhdGU6IChhcmdzKSA9PiB0aGlzLmR1cGxpY2F0ZU5vZGUoYXJncy51dWlkLCBjb2VyY2VCb29sKGFyZ3MuaW5jbHVkZUNoaWxkcmVuKSA/PyB0cnVlKSxcbiAgICAgICAgZGV0ZWN0X3R5cGU6IChhcmdzKSA9PiB0aGlzLmRldGVjdE5vZGVUeXBlKGFyZ3MudXVpZClcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVOb2RlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHRhcmdldFBhcmVudFV1aWQgPSBhcmdzLnBhcmVudFV1aWQ7XG5cbiAgICAgICAgICAgIGlmICghdGFyZ2V0UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2NlbmVJbmZvICYmIHR5cGVvZiBzY2VuZUluZm8gPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHNjZW5lSW5mbykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNjZW5lSW5mbywgJ3V1aWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGFyZW50VXVpZCA9IChzY2VuZUluZm8gYXMgYW55KS51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYE5vIHBhcmVudCBzcGVjaWZpZWQsIHVzaW5nIHNjZW5lIHJvb3Q6ICR7dGFyZ2V0UGFyZW50VXVpZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHNjZW5lSW5mbykgJiYgc2NlbmVJbmZvLmxlbmd0aCA+IDAgJiYgc2NlbmVJbmZvWzBdLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFBhcmVudFV1aWQgPSBzY2VuZUluZm9bMF0udXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBObyBwYXJlbnQgc3BlY2lmaWVkLCB1c2luZyBzY2VuZSByb290OiAke3RhcmdldFBhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50U2NlbmUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jdXJyZW50LXNjZW5lJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNjZW5lICYmIGN1cnJlbnRTY2VuZS51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGFyZW50VXVpZCA9IGN1cnJlbnRTY2VuZS51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGdldCBzY2VuZSByb290LCB3aWxsIHVzZSBkZWZhdWx0IGJlaGF2aW9yJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZmluYWxBc3NldFV1aWQgPSBhcmdzLmFzc2V0VXVpZDtcbiAgICAgICAgICAgIGlmIChhcmdzLmFzc2V0UGF0aCAmJiAhZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy5hc3NldFBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIGFzc2V0SW5mby51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5hbEFzc2V0VXVpZCA9IGFzc2V0SW5mby51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEFzc2V0IHBhdGggJyR7YXJncy5hc3NldFBhdGh9JyByZXNvbHZlZCB0byBVVUlEOiAke2ZpbmFsQXNzZXRVdWlkfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBBc3NldCBub3QgZm91bmQgYXQgcGF0aDogJHthcmdzLmFzc2V0UGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZXNvbHZlIGFzc2V0IHBhdGggJyR7YXJncy5hc3NldFBhdGh9JzogJHtlcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOb2RlT3B0aW9uczogYW55ID0geyBuYW1lOiBhcmdzLm5hbWUgfTtcblxuICAgICAgICAgICAgaWYgKHRhcmdldFBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSB0YXJnZXRQYXJlbnRVdWlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5hc3NldFV1aWQgPSBmaW5hbEFzc2V0VXVpZDtcbiAgICAgICAgICAgICAgICBpZiAoY29lcmNlQm9vbChhcmdzLnVubGlua1ByZWZhYikpIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMudW5saW5rUHJlZmFiID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhcmdzLmNvbXBvbmVudHMgJiYgYXJncy5jb21wb25lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5jb21wb25lbnRzID0gYXJncy5jb21wb25lbnRzO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcmdzLm5vZGVUeXBlICYmIGFyZ3Mubm9kZVR5cGUgIT09ICdOb2RlJyAmJiAhZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5jb21wb25lbnRzID0gW2FyZ3Mubm9kZVR5cGVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY29lcmNlQm9vbChhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybSkpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5rZWVwV29ybGRUcmFuc2Zvcm0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzaWJsaW5nSW5kZXggPSBjb2VyY2VJbnQoYXJncy5zaWJsaW5nSW5kZXgpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgbm9kZSB3aXRoIG9wdGlvbnM6JywgY3JlYXRlTm9kZU9wdGlvbnMpO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgY3JlYXRlTm9kZU9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IEFycmF5LmlzQXJyYXkobm9kZVV1aWQpID8gbm9kZVV1aWRbMF0gOiBub2RlVXVpZDtcblxuICAgICAgICAgICAgaWYgKHNpYmxpbmdJbmRleCAhPT0gdW5kZWZpbmVkICYmIHNpYmxpbmdJbmRleCA+PSAwICYmIHV1aWQgJiYgdGFyZ2V0UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDApKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXBhcmVudCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudDogdGFyZ2V0UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWRzOiBbdXVpZF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IGNvZXJjZUJvb2woYXJncy5rZWVwV29ybGRUcmFuc2Zvcm0pIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBzZXQgc2libGluZyBpbmRleDonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFyZ3MuY29tcG9uZW50cyAmJiBhcmdzLmNvbXBvbmVudHMubGVuZ3RoID4gMCAmJiB1dWlkKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudFR5cGUgb2YgYXJncy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50VHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSBhZGRlZCBzdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGFkZCBjb21wb25lbnQgJHtjb21wb25lbnRUeXBlfTpgLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGFkZCBjb21wb25lbnRzOicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXJncy5pbml0aWFsVHJhbnNmb3JtICYmIHV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTUwKSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvcyA9IG5vcm1hbGl6ZVZlYzMoYXJncy5pbml0aWFsVHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm90ID0gbm9ybWFsaXplVmVjMyhhcmdzLmluaXRpYWxUcmFuc2Zvcm0ucm90YXRpb24pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzY2wgPSBub3JtYWxpemVWZWMzKGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5zY2FsZSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0Tm9kZVRyYW5zZm9ybSh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHBvcyA/PyBhcmdzLmluaXRpYWxUcmFuc2Zvcm0ucG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogcm90ID8/IGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5yb3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlOiBzY2wgPz8gYXJncy5pbml0aWFsVHJhbnNmb3JtLnNjYWxlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW5pdGlhbCB0cmFuc2Zvcm0gYXBwbGllZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gc2V0IGluaXRpYWwgdHJhbnNmb3JtOicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgdmVyaWZpY2F0aW9uRGF0YTogYW55ID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChub2RlSW5mby5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbkRhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlSW5mbzogbm9kZUluZm8uZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0aW9uRGV0YWlsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHRhcmdldFBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVR5cGU6IGFyZ3Mubm9kZVR5cGUgfHwgJ05vZGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21Bc3NldDogISFmaW5hbEFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IGZpbmFsQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0UGF0aDogYXJncy5hc3NldFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBnZXQgdmVyaWZpY2F0aW9uIGRhdGE6JywgZXJyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc3VjY2Vzc01lc3NhZ2UgPSBmaW5hbEFzc2V0VXVpZFxuICAgICAgICAgICAgICAgID8gYE5vZGUgJyR7YXJncy5uYW1lfScgaW5zdGFudGlhdGVkIGZyb20gYXNzZXQgc3VjY2Vzc2Z1bGx5YFxuICAgICAgICAgICAgICAgIDogYE5vZGUgJyR7YXJncy5uYW1lfScgY3JlYXRlZCBzdWNjZXNzZnVsbHlgO1xuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBhcmdzLm5hbWUsXG4gICAgICAgICAgICAgICAgcGFyZW50VXVpZDogdGFyZ2V0UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICBub2RlVHlwZTogYXJncy5ub2RlVHlwZSB8fCAnTm9kZScsXG4gICAgICAgICAgICAgICAgZnJvbUFzc2V0OiAhIWZpbmFsQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogZmluYWxBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogc3VjY2Vzc01lc3NhZ2UsXG4gICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uRGF0YVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGNyZWF0ZSBub2RlOiAke2Vyci5tZXNzYWdlfS4gQXJnczogJHtKU09OLnN0cmluZ2lmeShhcmdzKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Tm9kZUluZm8odXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBpbnZhbGlkIHJlc3BvbnNlJyk7XG4gICAgICAgICAgICBjb25zdCBpbmZvOiBOb2RlSW5mbyA9IHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlRGF0YS51dWlkPy52YWx1ZSB8fCB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IG5vZGVEYXRhLm5hbWU/LnZhbHVlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGVEYXRhLmFjdGl2ZT8udmFsdWUgIT09IHVuZGVmaW5lZCA/IG5vZGVEYXRhLmFjdGl2ZS52YWx1ZSA6IHRydWUsXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZSB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgICAgICAgICByb3RhdGlvbjogbm9kZURhdGEucm90YXRpb24/LnZhbHVlIHx8IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICAgICAgICAgIHNjYWxlOiBub2RlRGF0YS5zY2FsZT8udmFsdWUgfHwgeyB4OiAxLCB5OiAxLCB6OiAxIH0sXG4gICAgICAgICAgICAgICAgcGFyZW50OiBub2RlRGF0YS5wYXJlbnQ/LnZhbHVlPy51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IG5vZGVEYXRhLmNoaWxkcmVuIHx8IFtdLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IChub2RlRGF0YS5fX2NvbXBzX18gfHwgW10pLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wLmVuYWJsZWQgOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICAgICAgIGxheWVyOiBub2RlRGF0YS5sYXllcj8udmFsdWUgfHwgMTA3Mzc0MTgyNCxcbiAgICAgICAgICAgICAgICBtb2JpbGl0eTogbm9kZURhdGEubW9iaWxpdHk/LnZhbHVlIHx8IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZpbmROb2RlcyhwYXR0ZXJuOiBzdHJpbmcsIGV4YWN0TWF0Y2g6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXBhdHRlcm4pIHJldHVybiBlcnJvclJlc3VsdCgncGF0dGVybiBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWZpbmQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBzZWFyY2hUcmVlID0gKG5vZGU6IGFueSwgY3VycmVudFBhdGg6IHN0cmluZyA9ICcnKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVBhdGggPSBjdXJyZW50UGF0aCA/IGAke2N1cnJlbnRQYXRofS8ke25vZGUubmFtZX1gIDogbm9kZS5uYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBleGFjdE1hdGNoXG4gICAgICAgICAgICAgICAgICAgID8gbm9kZS5uYW1lID09PSBwYXR0ZXJuXG4gICAgICAgICAgICAgICAgICAgIDogbm9kZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocGF0dGVybi50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCBwYXRoOiBub2RlUGF0aCB9KTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHNlYXJjaFRyZWUoY2hpbGQsIG5vZGVQYXRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHRyZWUpIHNlYXJjaFRyZWUodHJlZSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChub2Rlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZmluZE5vZGVzJywgYXJnczogW3BhdHRlcm4sIGV4YWN0TWF0Y2hdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBUcmVlIHNlYXJjaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZmluZE5vZGVCeU5hbWUobmFtZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCduYW1lIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249ZmluZF9ieV9uYW1lJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kTm9kZSA9IHNlYXJjaE5vZGVJblRyZWUodHJlZSwgbmFtZSk7XG4gICAgICAgICAgICBpZiAoZm91bmROb2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1dWlkOiBmb3VuZE5vZGUudXVpZCwgbmFtZTogZm91bmROb2RlLm5hbWUsIHBhdGg6IGdldE5vZGVQYXRoKGZvdW5kTm9kZSkgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYE5vZGUgJyR7bmFtZX0nIG5vdCBmb3VuZGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2ZpbmROb2RlQnlOYW1lJywgYXJnczogW25hbWVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBbGxOb2RlcygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCB0cmF2ZXJzZVRyZWUgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCB0eXBlOiBub2RlLnR5cGUsIGFjdGl2ZTogbm9kZS5hY3RpdmUsIHBhdGg6IGdldE5vZGVQYXRoKG5vZGUpIH0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikgdHJhdmVyc2VUcmVlKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHRyZWUgJiYgdHJlZS5jaGlsZHJlbikgdHJhdmVyc2VUcmVlKHRyZWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0b3RhbE5vZGVzOiBub2Rlcy5sZW5ndGgsIG5vZGVzIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldEFsbE5vZGVzJywgYXJnczogW11cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldE5vZGVQcm9wZXJ0eSh1dWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1dWlkIHx8ICFwcm9wZXJ0eSB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQsIHByb3BlcnR5LCBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249c2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHsgdXVpZCwgcGF0aDogcHJvcGVydHksIGR1bXA6IHsgdmFsdWUgfSB9KTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsIHByb3BlcnR5LCBuZXdWYWx1ZTogdmFsdWUsIG5vZGVJbmZvOiBub2RlSW5mby5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VEZXRhaWxzOiB7IHByb3BlcnR5LCB2YWx1ZSwgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfVxuICAgICAgICAgICAgICAgIH0sIGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkOiB1dWlkLCBwcm9wZXJ0eSwgbmV3VmFsdWU6IHZhbHVlIH0sIGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5ICh2ZXJpZmljYXRpb24gZmFpbGVkKWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldE5vZGVQcm9wZXJ0eScsIGFyZ3M6IFt1dWlkLCBwcm9wZXJ0eSwgdmFsdWVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXROb2RlVHJhbnNmb3JtKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB1dWlkID0gYXJncy51dWlkO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5wb3NpdGlvbikgPz8gYXJncy5wb3NpdGlvbjtcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3Mucm90YXRpb24pID8/IGFyZ3Mucm90YXRpb247XG4gICAgICAgIGNvbnN0IHNjYWxlID0gbm9ybWFsaXplVmVjMyhhcmdzLnNjYWxlKSA/PyBhcmdzLnNjYWxlO1xuXG4gICAgICAgIGNvbnN0IHVwZGF0ZVByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuICAgICAgICBjb25zdCB1cGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm9SZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8odXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVJbmZvUmVzcG9uc2Uuc3VjY2VzcyB8fCAhbm9kZUluZm9SZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdGYWlsZWQgdG8gZ2V0IG5vZGUgaW5mb3JtYXRpb24nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBub2RlSW5mb1Jlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBjb25zdCBub2RlSXMyRCA9IGlzMkROb2RlKG5vZGVJbmZvKTtcblxuICAgICAgICAgICAgaWYgKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVRyYW5zZm9ybVZhbHVlKHBvc2l0aW9uLCAncG9zaXRpb24nLCBub2RlSXMyRCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vcm1hbGl6ZWQud2FybmluZykgd2FybmluZ3MucHVzaChub3JtYWxpemVkLndhcm5pbmcpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVByb21pc2VzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsIHBhdGg6ICdwb3NpdGlvbicsIGR1bXA6IHsgdmFsdWU6IG5vcm1hbGl6ZWQudmFsdWUgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdwb3NpdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocm90YXRpb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplVHJhbnNmb3JtVmFsdWUocm90YXRpb24sICdyb3RhdGlvbicsIG5vZGVJczJEKTtcbiAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZC53YXJuaW5nKSB3YXJuaW5ncy5wdXNoKG5vcm1hbGl6ZWQud2FybmluZyk7XG4gICAgICAgICAgICAgICAgdXBkYXRlUHJvbWlzZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCwgcGF0aDogJ3JvdGF0aW9uJywgZHVtcDogeyB2YWx1ZTogbm9ybWFsaXplZC52YWx1ZSB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ3JvdGF0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzY2FsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVUcmFuc2Zvcm1WYWx1ZShzY2FsZSwgJ3NjYWxlJywgbm9kZUlzMkQpO1xuICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkLndhcm5pbmcpIHdhcm5pbmdzLnB1c2gobm9ybWFsaXplZC53YXJuaW5nKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVQcm9taXNlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLCBwYXRoOiAnc2NhbGUnLCBkdW1wOiB7IHZhbHVlOiBub3JtYWxpemVkLnZhbHVlIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgnc2NhbGUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVwZGF0ZVByb21pc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnTm8gdHJhbnNmb3JtIHByb3BlcnRpZXMgc3BlY2lmaWVkJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHVwZGF0ZVByb21pc2VzKTtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlZE5vZGVJbmZvID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogQWN0aW9uVG9vbFJlc3VsdCA9IHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBUcmFuc2Zvcm0gcHJvcGVydGllcyB1cGRhdGVkOiAke3VwZGF0ZXMuam9pbignLCAnKX0gJHtub2RlSXMyRCA/ICcoMkQgbm9kZSknIDogJygzRCBub2RlKSd9YCxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBub2RlVHlwZTogbm9kZUlzMkQgPyAnMkQnIDogJzNEJyxcbiAgICAgICAgICAgICAgICAgICAgYXBwbGllZENoYW5nZXM6IHVwZGF0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUNvbnN0cmFpbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZUlzMkQgPyAneCwgeSBvbmx5ICh6IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBub2RlSXMyRCA/ICd6IG9ubHkgKHgsIHkgaWdub3JlZCknIDogJ3gsIHksIHogYWxsIHVzZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGU6IG5vZGVJczJEID8gJ3gsIHkgbWFpbiwgeiB0eXBpY2FsbHkgMScgOiAneCwgeSwgeiBhbGwgdXNlZCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbm9kZUluZm86IHVwZGF0ZWROb2RlSW5mby5kYXRhLFxuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1EZXRhaWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbE5vZGVUeXBlOiBub2RlSXMyRCA/ICcyRCcgOiAnM0QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGllZFRyYW5zZm9ybXM6IHVwZGF0ZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBiZWZvcmVBZnRlckNvbXBhcmlzb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlZm9yZTogbm9kZUluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICBhZnRlcjogdXBkYXRlZE5vZGVJbmZvLmRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgKHJlc3VsdCBhcyBhbnkpLndhcm5pbmcgPSB3YXJuaW5ncy5qb2luKCc7ICcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byB1cGRhdGUgdHJhbnNmb3JtOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkZWxldGVOb2RlKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWRlbGV0ZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7IHV1aWQgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnTm9kZSBkZWxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbW92ZU5vZGUobm9kZVV1aWQ6IHN0cmluZywgbmV3UGFyZW50VXVpZDogc3RyaW5nLCBzaWJsaW5nSW5kZXg6IG51bWJlciA9IC0xLCBrZWVwV29ybGRUcmFuc2Zvcm06IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFuZXdQYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBuZXdQYXJlbnRVdWlkIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPW1vdmUnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXBhcmVudCcsIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IG5ld1BhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgdXVpZHM6IFtub2RlVXVpZF0sXG4gICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nSW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogJ3NpYmxpbmdJbmRleCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBzaWJsaW5nSW5kZXggfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gc2V0IHNpYmxpbmdJbmRleCBhZnRlciBtb3ZlOicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ05vZGUgbW92ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkdXBsaWNhdGVOb2RlKHV1aWQ6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWR1cGxpY2F0ZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFpbmNsdWRlQ2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAvLyBTaGFsbG93IGR1cGxpY2F0ZTogY3JlYXRlIG5ldyBub2RlIHdpdGggc2FtZSBuYW1lL3BhcmVudCBidXQgbm8gY2hpbGRyZW5cbiAgICAgICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVJbmZvUmVzcG9uc2Uuc3VjY2VzcyB8fCAhbm9kZUluZm9SZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCBub2RlIGluZm8gZm9yIHNoYWxsb3cgZHVwbGljYXRlJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gbm9kZUluZm9SZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld05vZGVVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGVJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZUluZm8ucGFyZW50IHx8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1V1aWQgPSBBcnJheS5pc0FycmF5KG5ld05vZGVVdWlkKSA/IG5ld05vZGVVdWlkWzBdIDogbmV3Tm9kZVV1aWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBuZXdVdWlkLCBzaGFsbG93OiB0cnVlIH0sICdOb2RlIGR1cGxpY2F0ZWQgKHdpdGhvdXQgY2hpbGRyZW4pIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdkdXBsaWNhdGUtbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIG5ld1V1aWQ6IHJlc3VsdD8udXVpZCA/PyByZXN1bHQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ05vZGUgZHVwbGljYXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRldGVjdE5vZGVUeXBlKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWRldGVjdF90eXBlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm9SZXNwb25zZS5zdWNjZXNzIHx8ICFub2RlSW5mb1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0ZhaWxlZCB0byBnZXQgbm9kZSBpbmZvcm1hdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IG5vZGVJbmZvUmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IGlzMkQgPSBpczJETm9kZShub2RlSW5mbyk7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gbm9kZUluZm8uY29tcG9uZW50cyB8fCBbXTtcblxuICAgICAgICAgICAgY29uc3QgZGV0ZWN0aW9uUmVhc29uczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICAgICAgY29uc3QgdHdvRENvbXBvbmVudHMgPSBjb21wb25lbnRzLmZpbHRlcigoY29tcDogYW55KSA9PlxuICAgICAgICAgICAgICAgIGNvbXAudHlwZSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIGNvbXAudHlwZS5pbmNsdWRlcygnY2MuU3ByaXRlJykgfHxcbiAgICAgICAgICAgICAgICAgICAgY29tcC50eXBlLmluY2x1ZGVzKCdjYy5MYWJlbCcpIHx8XG4gICAgICAgICAgICAgICAgICAgIGNvbXAudHlwZS5pbmNsdWRlcygnY2MuQnV0dG9uJykgfHxcbiAgICAgICAgICAgICAgICAgICAgY29tcC50eXBlLmluY2x1ZGVzKCdjYy5MYXlvdXQnKSB8fFxuICAgICAgICAgICAgICAgICAgICBjb21wLnR5cGUuaW5jbHVkZXMoJ2NjLldpZGdldCcpIHx8XG4gICAgICAgICAgICAgICAgICAgIGNvbXAudHlwZS5pbmNsdWRlcygnY2MuTWFzaycpIHx8XG4gICAgICAgICAgICAgICAgICAgIGNvbXAudHlwZS5pbmNsdWRlcygnY2MuR3JhcGhpY3MnKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGNvbnN0IHRocmVlRENvbXBvbmVudHMgPSBjb21wb25lbnRzLmZpbHRlcigoY29tcDogYW55KSA9PlxuICAgICAgICAgICAgICAgIGNvbXAudHlwZSAmJiAoXG4gICAgICAgICAgICAgICAgICAgIGNvbXAudHlwZS5pbmNsdWRlcygnY2MuTWVzaFJlbmRlcmVyJykgfHxcbiAgICAgICAgICAgICAgICAgICAgY29tcC50eXBlLmluY2x1ZGVzKCdjYy5DYW1lcmEnKSB8fFxuICAgICAgICAgICAgICAgICAgICBjb21wLnR5cGUuaW5jbHVkZXMoJ2NjLkxpZ2h0JykgfHxcbiAgICAgICAgICAgICAgICAgICAgY29tcC50eXBlLmluY2x1ZGVzKCdjYy5EaXJlY3Rpb25hbExpZ2h0JykgfHxcbiAgICAgICAgICAgICAgICAgICAgY29tcC50eXBlLmluY2x1ZGVzKCdjYy5Qb2ludExpZ2h0JykgfHxcbiAgICAgICAgICAgICAgICAgICAgY29tcC50eXBlLmluY2x1ZGVzKCdjYy5TcG90TGlnaHQnKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmICh0d29EQ29tcG9uZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZGV0ZWN0aW9uUmVhc29ucy5wdXNoKGBIYXMgMkQgY29tcG9uZW50czogJHt0d29EQ29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRocmVlRENvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaChgSGFzIDNEIGNvbXBvbmVudHM6ICR7dGhyZWVEQ29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vZGVJbmZvLnBvc2l0aW9uO1xuICAgICAgICAgICAgaWYgKHBvc2l0aW9uICYmIE1hdGguYWJzKHBvc2l0aW9uLnopIDwgMC4wMDEpIHtcbiAgICAgICAgICAgICAgICBkZXRlY3Rpb25SZWFzb25zLnB1c2goJ1ogcG9zaXRpb24gaXMgfjAgKGxpa2VseSAyRCknKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocG9zaXRpb24gJiYgTWF0aC5hYnMocG9zaXRpb24ueikgPiAwLjAwMSkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaChgWiBwb3NpdGlvbiBpcyAke3Bvc2l0aW9uLnp9IChsaWtlbHkgM0QpYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChkZXRlY3Rpb25SZWFzb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaCgnTm8gc3BlY2lmaWMgaW5kaWNhdG9ycyBmb3VuZCwgZGVmYXVsdGluZyBiYXNlZCBvbiBoZXVyaXN0aWNzJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogdXVpZCxcbiAgICAgICAgICAgICAgICBub2RlTmFtZTogbm9kZUluZm8ubmFtZSxcbiAgICAgICAgICAgICAgICBub2RlVHlwZTogaXMyRCA/ICcyRCcgOiAnM0QnLFxuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogY29tcG9uZW50cy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC50eXBlLFxuICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogZ2V0Q29tcG9uZW50Q2F0ZWdvcnkoY29tcC50eXBlKVxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZUluZm8ucG9zaXRpb24sXG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtQ29uc3RyYWludHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IGlzMkQgPyAneCwgeSBvbmx5ICh6IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IGlzMkQgPyAneiBvbmx5ICh4LCB5IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IGlzMkQgPyAneCwgeSBtYWluLCB6IHR5cGljYWxseSAxJyA6ICd4LCB5LCB6IGFsbCB1c2VkJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBkZXRlY3Qgbm9kZSB0eXBlOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG59XG4iXX0=