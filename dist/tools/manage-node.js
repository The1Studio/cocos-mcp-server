"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageNode = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
const manage_node_sibling_order_1 = require("./manage-node-sibling-order");
const manage_node_asset_resolve_1 = require("./manage-node-asset-resolve");
const manage_node_transform_helpers_1 = require("./manage-node-transform-helpers");
/** Longest `awaitNodeCommit` waits for a freshly created node to become queryable. */
const NODE_COMMIT_TIMEOUT_MS = 2000;
/** Gap between `scene:query-node` polls while waiting for that commit. */
const NODE_COMMIT_POLL_MS = 20;
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
                layer: {
                    type: 'number',
                    description: '[create] Node layer bitmask applied after creation (e.g. 33554432 = UI_2D, 1073741824 = DEFAULT). A new node is created on DEFAULT, so a UI node under a UI camera needs its layer set; omit to leave the editor default. The result reports whether it took effect.'
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
        this.actionHandlers = {
            create: (args) => this.createNode(args),
            get_info: (args) => this.getNodeInfo(args.uuid),
            find: (args) => { var _a; return this.findNodes(args.pattern, (_a = (0, normalize_1.coerceBool)(args.exactMatch)) !== null && _a !== void 0 ? _a : false); },
            find_by_name: (args) => this.findNodeByName(args.name),
            get_all: () => this.getAllNodes(),
            set_property: (args) => this.setNodeProperty(args.uuid, args.property, args.value, args.propertyType),
            set_transform: (args) => this.setNodeTransform(args),
            delete: (args) => this.deleteNode(args.uuid),
            move: (args) => { var _a, _b; return this.moveNode(args.nodeUuid, args.newParentUuid, (_a = (0, normalize_1.coerceInt)(args.siblingIndex)) !== null && _a !== void 0 ? _a : -1, (_b = (0, normalize_1.coerceBool)(args.keepWorldTransform)) !== null && _b !== void 0 ? _b : false); },
            duplicate: (args) => { var _a; return this.duplicateNode(args.uuid, (_a = (0, normalize_1.coerceBool)(args.includeChildren)) !== null && _a !== void 0 ? _a : true); },
            detect_type: (args) => this.detectNodeType(args.uuid)
        };
    }
    async createNode(args) {
        var _a;
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
            let assetType;
            let pathInfo;
            if (args.assetPath && !finalAssetUuid) {
                try {
                    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetPath);
                    if (assetInfo && assetInfo.uuid) {
                        finalAssetUuid = assetInfo.uuid;
                        assetType = assetInfo.type;
                        pathInfo = assetInfo;
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
            // A raw model asset (.fbx/.gltf) is not instantiable; redirect it to its
            // `gltf-scene` sub-asset instead of creating an empty node (issue #117).
            let resolvedFromModel;
            if (finalAssetUuid) {
                const resolved = await (0, manage_node_asset_resolve_1.resolveInstantiableAssetUuid)(finalAssetUuid, pathInfo);
                if (resolved.resolvedFrom) {
                    resolvedFromModel = resolved.resolvedFrom;
                    finalAssetUuid = resolved.uuid;
                    assetType = undefined; // re-resolved below for the sub-asset
                }
                else if (!assetType && ((_a = resolved.info) === null || _a === void 0 ? void 0 : _a.type)) {
                    assetType = resolved.info.type; // reuse the lookup instead of repeating it
                }
            }
            const createNodeOptions = { name: args.name };
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
                        assetType = info === null || info === void 0 ? void 0 : info.type;
                    }
                    catch (err) {
                        console.warn(`Failed to resolve asset type for '${finalAssetUuid}':`, err);
                    }
                }
                if (assetType) {
                    createNodeOptions.type = assetType;
                }
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
            // Refuse a layer we cannot apply BEFORE creating anything, so a bad argument does
            // not leave an orphan node behind (#153).
            const requestedLayer = args.layer === undefined || args.layer === null ? undefined : (0, normalize_1.coerceInt)(args.layer);
            if (args.layer !== undefined && args.layer !== null && requestedLayer === undefined) {
                return (0, types_1.errorResult)(`layer must be an integer layer bitmask (e.g. 33554432 for UI_2D); received ${JSON.stringify(args.layer)}. No node was created.`);
            }
            console.log('Creating node with options:', createNodeOptions);
            const nodeUuid = await Editor.Message.request('scene', 'create-node', createNodeOptions);
            const uuid = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;
            // `set-parent` appends, so honouring siblingIndex needs an explicit reorder, and
            // the outcome is reported rather than assumed (issue #99 item 2).
            let siblingOrder;
            if (siblingIndex !== undefined && siblingIndex >= 0 && uuid && targetParentUuid) {
                try {
                    await this.awaitNodeCommit(uuid);
                }
                catch (err) {
                    console.warn('Failed to await node commit before sibling ordering:', err);
                }
                siblingOrder = Object.assign({ requested: siblingIndex }, (await (0, manage_node_sibling_order_1.applySiblingIndex)(targetParentUuid, uuid, siblingIndex)));
                if (!siblingOrder.applied) {
                    console.warn(`siblingIndex ${siblingIndex} was not applied: ${siblingOrder.reason}`);
                }
            }
            if (args.components && args.components.length > 0 && uuid) {
                try {
                    await this.awaitNodeCommit(uuid);
                    // `create-node` was already handed `components`, and the editor auto-adds
                    // some on creation (UITransform on a UI-layer node), so re-adding blindly
                    // logs "already contains <Component>" for a correct create (#136). Skip
                    // what the node already carries; an unreadable node falls back to adding all.
                    const present = await this.queryComponentTypes(uuid);
                    for (const componentType of args.components) {
                        if (present.has(componentType)) {
                            console.log(`Component ${componentType} already present, skipping duplicate add`);
                            continue;
                        }
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
                    await this.awaitNodeCommit(uuid);
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
            // `create-node` leaves a new node on the DEFAULT layer, so a node meant for a UI
            // camera is culled until its layer is fixed by hand (#153). Applied through the same
            // verified write as set_property; a failure is reported, not hidden, and does not
            // undo the creation.
            let layerResult;
            if (requestedLayer !== undefined && uuid) {
                try {
                    await this.awaitNodeCommit(uuid);
                    const layerWrite = await this.setNodeProperty(uuid, 'layer', requestedLayer, 'number');
                    layerResult = layerWrite.success
                        ? { requested: requestedLayer, applied: true }
                        : { requested: requestedLayer, applied: false, error: layerWrite.error };
                }
                catch (err) {
                    layerResult = { requested: requestedLayer, applied: false, error: (err === null || err === void 0 ? void 0 : err.message) || String(err) };
                }
                if (!layerResult.applied)
                    console.warn(`layer ${requestedLayer} was not applied: ${layerResult.error}`);
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
            return (0, types_1.successResult)(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ uuid, name: args.name, parentUuid: targetParentUuid, nodeType: args.nodeType || 'Node', fromAsset: !!finalAssetUuid, assetUuid: finalAssetUuid }, (resolvedFromModel ? { resolvedFromModelUuid: resolvedFromModel } : {})), (siblingOrder ? { siblingOrder } : {})), (layerResult ? { layer: layerResult } : {})), (layerResult && !layerResult.applied
                ? { layerWarning: `layer ${layerResult.requested} was NOT applied (${layerResult.error}); the node keeps the editor default layer.` }
                : {})), (siblingOrder && !siblingOrder.applied
                ? { warning: `siblingIndex ${siblingOrder.requested} was NOT applied (${siblingOrder.reason}); the node is the last child.` }
                : {})), { message: successMessage, verificationData }));
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to create node: ${err.message}. Args: ${JSON.stringify(args)}`);
        }
    }
    /** Component type names currently on a node, or an empty set when the node cannot be read. */
    async queryComponentTypes(uuid) {
        var _a;
        const types = new Set();
        try {
            const dump = await Editor.Message.request('scene', 'query-node', uuid);
            for (const comp of ((dump === null || dump === void 0 ? void 0 : dump.__comps__) || [])) {
                const type = (_a = comp === null || comp === void 0 ? void 0 : comp.type) !== null && _a !== void 0 ? _a : comp === null || comp === void 0 ? void 0 : comp.__type__;
                if (typeof type === 'string')
                    types.add(type);
            }
        }
        catch (_b) {
            // fall through: caller adds every requested component, as before
        }
        return types;
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
    async awaitNodeCommit(uuid) {
        const deadline = Date.now() + NODE_COMMIT_TIMEOUT_MS;
        for (;;) {
            try {
                const nodeData = await Editor.Message.request('scene', 'query-node', uuid);
                if (nodeData)
                    return;
            }
            catch (err) {
                // query-node rejects while the node is not yet in the graph — keep polling.
            }
            if (Date.now() >= deadline) {
                throw new Error(`Node '${uuid}' was not queryable within ${NODE_COMMIT_TIMEOUT_MS}ms of creation`);
            }
            await new Promise(r => setTimeout(r, NODE_COMMIT_POLL_MS));
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
    /**
     * Coerce a set_property value by the requested (or inferred) propertyType.
     * Throws on a value that cannot be coerced, so the caller returns errorResult
     * instead of silently forwarding a value the engine will misinterpret.
     */
    coerceNodePropertyValue(property, value, propertyType) {
        const effectiveType = propertyType
            || (ManageNode.KNOWN_BOOLEAN_NODE_PROPERTIES.has(property) ? 'boolean' : undefined);
        if (effectiveType === 'boolean') {
            const coerced = (0, normalize_1.coerceBool)(value);
            if (coerced === undefined) {
                throw new Error(`Property '${property}' expects a boolean value (true/false/1/0/"true"/"false"), received: ${JSON.stringify(value)}`);
            }
            return coerced;
        }
        if (effectiveType === 'number') {
            const coerced = (0, normalize_1.coerceFloat)(value);
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
    async readNodeProperty(uuid, property) {
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', uuid);
            const entry = nodeData ? nodeData[property] : undefined;
            if (entry && typeof entry === 'object' && 'value' in entry) {
                return { found: true, value: entry.value };
            }
            return { found: false, value: undefined };
        }
        catch (_a) {
            return { found: false, value: undefined };
        }
    }
    async setNodeProperty(uuid, property, value, propertyType) {
        if (!uuid || !property || value === undefined) {
            return (0, types_1.errorResult)('uuid, property, and value are required for action=set_property');
        }
        // Issue #47: a boolean node property (active, ...) sent through any transport
        // that stringifies args arrives as `"false"` — a TRUTHY string — so
        // `node.active = "false"` silently leaves the node active. Coerce by an explicit
        // propertyType, or by a known boolean property name when propertyType is
        // omitted, the same way manage_component set_property honours propertyType.
        let coercedValue;
        try {
            coercedValue = this.coerceNodePropertyValue(property, value, propertyType);
        }
        catch (coerceErr) {
            return (0, types_1.errorResult)(coerceErr.message);
        }
        try {
            await Editor.Message.request('scene', 'set-property', { uuid, path: property, dump: { value: coercedValue } });
            // Issue #47: `set-property` resolving without throwing does NOT mean the
            // write took effect — read the property back and compare, the same
            // verify-don't-assume fix #34/#42 already applied to manage_component.
            const verify = await this.readNodeProperty(uuid, property);
            if (verify.found && verify.value !== coercedValue) {
                return (0, types_1.errorResult)(`Property '${property}' write did not take effect: requested ${JSON.stringify(coercedValue)}, ` +
                    `actual value is ${JSON.stringify(verify.value)}.`);
            }
            const verifiedSuffix = verify.found ? '' : ' (unable to verify — read-back did not resolve a value at this property path)';
            try {
                const nodeInfo = await this.getNodeInfo(uuid);
                return (0, types_1.successResult)({
                    nodeUuid: uuid, property, newValue: coercedValue, nodeInfo: nodeInfo.data,
                    changeDetails: { property, value: coercedValue, timestamp: new Date().toISOString() }
                }, `Property '${property}' updated successfully${verifiedSuffix}`);
            }
            catch (_a) {
                return (0, types_1.successResult)({ nodeUuid: uuid, property, newValue: coercedValue }, `Property '${property}' updated successfully${verifiedSuffix}`);
            }
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'setNodeProperty', args: [uuid, property, coercedValue]
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
            // Issue #74: `remove-node` resolving without throwing does NOT mean the node
            // actually left the graph — it silently no-ops for a prefab-instance child in
            // scene-edit context (the same class of constraint moveNode already verifies
            // against for #33). Read the node back: a rejected/empty query-node means the
            // node is gone (success); a node that still resolves means the delete was
            // blocked. This also explains issue #73, where "deleted" nodes reappeared —
            // the delete never took effect, so a later create legitimately still saw them.
            let stillExists = false;
            try {
                const nodeData = await Editor.Message.request('scene', 'query-node', uuid);
                stillExists = !!nodeData;
            }
            catch (_a) {
                stillExists = false;
            }
            if (stillExists) {
                return (0, types_1.errorResult)(`Node '${uuid}' still exists after delete: the delete did not take effect. ` +
                    `This can happen when the node is a prefab instance's child and removal is blocked by the prefab link — try deleting it from prefab edit mode instead.`);
            }
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
            let siblingOrder;
            if (siblingIndex >= 0) {
                siblingOrder = await (0, manage_node_sibling_order_1.applySiblingIndex)(newParentUuid, nodeUuid, siblingIndex);
            }
            // Read back the actual parent. `set-parent` silently no-ops for some prefab-
            // instance constraints (e.g. moving a prefab root out from under its instance),
            // so a resolved promise here does not guarantee the reparent took effect.
            const verifyInfo = await this.getNodeInfo(nodeUuid);
            if (!verifyInfo.success || !verifyInfo.data) {
                return (0, types_1.errorResult)(`Node move could not be verified: failed to read back node '${nodeUuid}' after the move.`);
            }
            if (verifyInfo.data.parent !== newParentUuid) {
                return (0, types_1.errorResult)(`Node move did not take effect: expected parent '${newParentUuid}' but the node still reports parent '${verifyInfo.data.parent}'. ` +
                    `This can happen when the node is a prefab instance's root and reparenting is blocked by the prefab link.`);
            }
            if (siblingOrder && !siblingOrder.applied) {
                return (0, types_1.errorResult)(`Node was moved under '${newParentUuid}' but siblingIndex ${siblingIndex} was NOT applied: ${siblingOrder.reason}.`);
            }
            return (0, types_1.successResult)({ nodeUuid, newParentUuid, siblingOrder, nodeInfo: verifyInfo.data }, 'Node moved successfully');
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
            const twoDComponents = components.filter((comp) => (0, manage_node_transform_helpers_1.is2DComponentType)(comp.type));
            const threeDComponents = components.filter((comp) => (0, manage_node_transform_helpers_1.is3DComponentType)(comp.type));
            if (twoDComponents.length > 0) {
                detectionReasons.push(`Has 2D components: ${twoDComponents.map((c) => c.type).join(', ')}`);
            }
            if (threeDComponents.length > 0) {
                detectionReasons.push(`Has 3D components: ${threeDComponents.map((c) => c.type).join(', ')}`);
            }
            // Node position is NOT used to infer 2D-ness: a 3D node legitimately sits
            // at the origin (z = 0). Absent a 2D/UI component, the node is treated as 3D.
            if (twoDComponents.length === 0) {
                detectionReasons.push('No 2D/UI component found; treated as 3D (full x, y, z transform)');
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
/** Node properties that must be treated as boolean even when propertyType is omitted. */
ManageNode.KNOWN_BOOLEAN_NODE_PROPERTIES = new Set(['active']);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLW5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUFrRjtBQUNsRixrREFBdUY7QUFDdkYsMkVBQW9GO0FBQ3BGLDJFQUEyRTtBQUMzRSxtRkFBK0s7QUFFL0ssc0ZBQXNGO0FBQ3RGLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDO0FBQ3BDLDBFQUEwRTtBQUMxRSxNQUFNLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztBQUUvQixNQUFhLFVBQVcsU0FBUSxpQ0FBYztJQUE5Qzs7UUFFYSxTQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3JCLGdCQUFXLEdBQUcsNlhBQTZYLENBQUM7UUFDNVksWUFBTyxHQUFHLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ25KLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLENBQUM7b0JBQzlJLFdBQVcsRUFBRSx1WUFBdVk7aUJBQ3ZaO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUZBQW1GO2lCQUNuRztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDREQUE0RDtp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QUMsUUFBUTtnQkFDM0Isb0JBQW9CLEVBQUU7b0JBQ2xCLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxrQkFBa0I7b0JBQzdELFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxrQkFBa0I7b0JBQzdELEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxrQkFBa0I7aUJBQ2hFO2FBQ0osQ0FBQyxDQUFDO1FBRVAsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsK0JBQStCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDTCxDQUFDOztBQXAzQkwsZ0NBczNCQztBQTlWRyx5RkFBeUY7QUFDakUsd0NBQTZCLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxBQUF0QixDQUF1QiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIE5vZGVJbmZvLCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wsIGNvZXJjZUludCwgY29lcmNlRmxvYXQsIG5vcm1hbGl6ZVZlYzMgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgYXBwbHlTaWJsaW5nSW5kZXgsIFNpYmxpbmdPcmRlclJlc3VsdCB9IGZyb20gJy4vbWFuYWdlLW5vZGUtc2libGluZy1vcmRlcic7XG5pbXBvcnQgeyByZXNvbHZlSW5zdGFudGlhYmxlQXNzZXRVdWlkIH0gZnJvbSAnLi9tYW5hZ2Utbm9kZS1hc3NldC1yZXNvbHZlJztcbmltcG9ydCB7IGlzMkROb2RlLCBpczJEQ29tcG9uZW50VHlwZSwgaXMzRENvbXBvbmVudFR5cGUsIG5vcm1hbGl6ZVRyYW5zZm9ybVZhbHVlLCBnZXRDb21wb25lbnRDYXRlZ29yeSwgZ2V0Tm9kZVBhdGgsIHNlYXJjaE5vZGVJblRyZWUgfSBmcm9tICcuL21hbmFnZS1ub2RlLXRyYW5zZm9ybS1oZWxwZXJzJztcblxuLyoqIExvbmdlc3QgYGF3YWl0Tm9kZUNvbW1pdGAgd2FpdHMgZm9yIGEgZnJlc2hseSBjcmVhdGVkIG5vZGUgdG8gYmVjb21lIHF1ZXJ5YWJsZS4gKi9cbmNvbnN0IE5PREVfQ09NTUlUX1RJTUVPVVRfTVMgPSAyMDAwO1xuLyoqIEdhcCBiZXR3ZWVuIGBzY2VuZTpxdWVyeS1ub2RlYCBwb2xscyB3aGlsZSB3YWl0aW5nIGZvciB0aGF0IGNvbW1pdC4gKi9cbmNvbnN0IE5PREVfQ09NTUlUX1BPTExfTVMgPSAyMDtcblxuZXhwb3J0IGNsYXNzIE1hbmFnZU5vZGUgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG5cbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9ub2RlJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2Ugbm9kZXMgaW4gdGhlIGN1cnJlbnQgc2NlbmUuIEFjdGlvbnM6IGNyZWF0ZSwgZ2V0X2luZm8sIGZpbmQsIGZpbmRfYnlfbmFtZSwgZ2V0X2FsbCwgc2V0X3Byb3BlcnR5LCBzZXRfdHJhbnNmb3JtLCBkZWxldGUsIG1vdmUsIGR1cGxpY2F0ZSwgZGV0ZWN0X3R5cGUuIE5PVCBmb3IgY29tcG9uZW50cyDigJQgdXNlIG1hbmFnZV9jb21wb25lbnQuIE5PVCBmb3IgcHJlZmFicyDigJQgdXNlIG1hbmFnZV9wcmVmYWIuIFByZXJlcXVpc2l0ZXM6IHNjZW5lIG11c3QgYmUgb3BlbiAodmVyaWZ5IHdpdGggbWFuYWdlX3NjZW5lIGFjdGlvbj1nZXRfY3VycmVudCkuIFRvIGZpbmQgbm9kZSBVVUlEczogdXNlIGFjdGlvbj1maW5kIG9yIGFjdGlvbj1nZXRfYWxsIGZpcnN0Lic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ2ZpbmQnLCAnZmluZF9ieV9uYW1lJywgJ2dldF9hbGwnLCAnc2V0X3Byb3BlcnR5JywgJ3NldF90cmFuc2Zvcm0nLCAnZGVsZXRlJywgJ21vdmUnLCAnZHVwbGljYXRlJywgJ2RldGVjdF90eXBlJ107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NyZWF0ZScsICdnZXRfaW5mbycsICdmaW5kJywgJ2ZpbmRfYnlfbmFtZScsICdnZXRfYWxsJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfdHJhbnNmb3JtJywgJ2RlbGV0ZScsICdtb3ZlJywgJ2R1cGxpY2F0ZScsICdkZXRlY3RfdHlwZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGNyZWF0ZT1jcmVhdGUgbmV3IG5vZGUgaW4gc2NlbmUsIGdldF9pbmZvPWdldCBub2RlIGRldGFpbHMgYnkgVVVJRCwgZmluZD1zZWFyY2ggbm9kZXMgYnkgbmFtZSBwYXR0ZXJuLCBmaW5kX2J5X25hbWU9ZmluZCBmaXJzdCBub2RlIGJ5IGV4YWN0IG5hbWUsIGdldF9hbGw9bGlzdCBhbGwgbm9kZXMgd2l0aCBVVUlEcywgc2V0X3Byb3BlcnR5PXNldCBhIG5vZGUgcHJvcGVydHksIHNldF90cmFuc2Zvcm09c2V0IHBvc2l0aW9uL3JvdGF0aW9uL3NjYWxlLCBkZWxldGU9cmVtb3ZlIG5vZGUgZnJvbSBzY2VuZSwgbW92ZT1yZXBhcmVudCBub2RlLCBkdXBsaWNhdGU9Y2xvbmUgbm9kZSwgZGV0ZWN0X3R5cGU9ZGV0ZWN0IGlmIG5vZGUgaXMgMkQgb3IgM0QnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9pbmZvLCBzZXRfcHJvcGVydHksIHNldF90cmFuc2Zvcm0sIGRlbGV0ZSwgZHVwbGljYXRlLCBkZXRlY3RfdHlwZV0gTm9kZSBVVUlEJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5hbWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIE5vZGUgbmFtZS4gW2ZpbmRfYnlfbmFtZV0gRXhhY3Qgbm9kZSBuYW1lIHRvIGZpbmQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFyZW50VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gUGFyZW50IG5vZGUgVVVJRC4gU1RST05HTFkgUkVDT01NRU5ERUQuIFVzZSBnZXRfYWxsIHRvIGZpbmQgcGFyZW50IFVVSURzLiBJZiBvbWl0dGVkLCBub2RlIGlzIGNyZWF0ZWQgYXQgc2NlbmUgcm9vdC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ05vZGUnLCAnMkROb2RlJywgJzNETm9kZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gTm9kZSB0eXBlOiBOb2RlLCAyRE5vZGUsIDNETm9kZScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ05vZGUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2libGluZ0luZGV4OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlLCBtb3ZlXSBTaWJsaW5nIGluZGV4IGZvciBvcmRlcmluZyAoLTEgbWVhbnMgYXBwZW5kIGF0IGVuZCknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IC0xXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXNzZXRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBBc3NldCBVVUlEIHRvIGluc3RhbnRpYXRlIGZyb20gKGUuZy4sIHByZWZhYiBVVUlEKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3NldFBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEFzc2V0IHBhdGggdG8gaW5zdGFudGlhdGUgZnJvbSAoZS5nLiwgXCJkYjovL2Fzc2V0cy9wcmVmYWJzL015UHJlZmFiLnByZWZhYlwiKS4gQWx0ZXJuYXRpdmUgdG8gYXNzZXRVdWlkLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21wb25lbnRzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gQXJyYXkgb2YgY29tcG9uZW50IHR5cGUgbmFtZXMgdG8gYWRkIChlLmcuLCBbXCJjYy5TcHJpdGVcIiwgXCJjYy5CdXR0b25cIl0pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVubGlua1ByZWZhYjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIElmIHRydWUgYW5kIGNyZWF0aW5nIGZyb20gcHJlZmFiLCB1bmxpbmsgZnJvbSBwcmVmYWIgdG8gY3JlYXRlIGEgcmVndWxhciBub2RlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGUsIG1vdmVdIFdoZXRoZXIgdG8ga2VlcCB3b3JsZCB0cmFuc2Zvcm0nLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGF5ZXI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIE5vZGUgbGF5ZXIgYml0bWFzayBhcHBsaWVkIGFmdGVyIGNyZWF0aW9uIChlLmcuIDMzNTU0NDMyID0gVUlfMkQsIDEwNzM3NDE4MjQgPSBERUZBVUxUKS4gQSBuZXcgbm9kZSBpcyBjcmVhdGVkIG9uIERFRkFVTFQsIHNvIGEgVUkgbm9kZSB1bmRlciBhIFVJIGNhbWVyYSBuZWVkcyBpdHMgbGF5ZXIgc2V0OyBvbWl0IHRvIGxlYXZlIHRoZSBlZGl0b3IgZGVmYXVsdC4gVGhlIHJlc3VsdCByZXBvcnRzIHdoZXRoZXIgaXQgdG9vayBlZmZlY3QuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluaXRpYWxUcmFuc2Zvcm06IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHg6IHsgdHlwZTogJ251bWJlcicgfSwgeTogeyB0eXBlOiAnbnVtYmVyJyB9LCB6OiB7IHR5cGU6ICdudW1iZXInIH0gfSB9LFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB4OiB7IHR5cGU6ICdudW1iZXInIH0sIHk6IHsgdHlwZTogJ251bWJlcicgfSwgejogeyB0eXBlOiAnbnVtYmVyJyB9IH0gfSxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgeDogeyB0eXBlOiAnbnVtYmVyJyB9LCB5OiB7IHR5cGU6ICdudW1iZXInIH0sIHo6IHsgdHlwZTogJ251bWJlcicgfSB9IH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gSW5pdGlhbCB0cmFuc2Zvcm0gdG8gYXBwbHkgYWZ0ZXIgY3JlYXRpb24nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2ZpbmRdIE5hbWUgcGF0dGVybiB0byBzZWFyY2ggZm9yJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGV4YWN0TWF0Y2g6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZmluZF0gVXNlIGV4YWN0IG1hdGNoIGluc3RlYWQgb2YgcGFydGlhbCBtYXRjaCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZSAoZS5nLiwgYWN0aXZlLCBuYW1lLCBsYXllciknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IHZhbHVlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnR5VHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYm9vbGVhbicsICdudW1iZXInLCAnc3RyaW5nJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiW3NldF9wcm9wZXJ0eV0gT3B0aW9uYWwgdmFsdWUtdHlwZSBoaW50LCBob25vdXJlZCB0aGUgc2FtZSB3YXkgbWFuYWdlX2NvbXBvbmVudCBzZXRfcHJvcGVydHkgZG9lcy4gJ2FjdGl2ZScgaXMgY29lcmNlZCBhcyBib29sZWFuIGF1dG9tYXRpY2FsbHkgZXZlbiB3aGVuIG9taXR0ZWQ7IHBhc3MgJ2Jvb2xlYW4nIGV4cGxpY2l0bHkgZm9yIGFueSBvdGhlciBib29sZWFuIG5vZGUgcHJvcGVydHkgdG8gYXZvaWQgYSB0cnV0aHktc3RyaW5nIG5vLW9wIChlLmcuIHZhbHVlPVxcXCJmYWxzZVxcXCIgb3ZlciBhIHRyYW5zcG9ydCB0aGF0IHN0cmluZ2lmaWVzIGFyZ3MpLlwiXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1ogY29vcmRpbmF0ZSAoaWdub3JlZCBmb3IgMkQgbm9kZXMpJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfdHJhbnNmb3JtXSBOb2RlIHBvc2l0aW9uLiBGb3IgMkQgbm9kZXMsIG9ubHkgeCx5IGFyZSB1c2VkLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb3RhdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdJZ25vcmVkIGZvciAyRCBub2RlcycgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdJZ25vcmVkIGZvciAyRCBub2RlcycgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdNYWluIHJvdGF0aW9uIGF4aXMgZm9yIDJEIG5vZGVzJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfdHJhbnNmb3JtXSBOb2RlIHJvdGF0aW9uIGluIGV1bGVyIGFuZ2xlcy4gRm9yIDJEIG5vZGVzLCBvbmx5IHogaXMgdXNlZC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NhbGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1VzdWFsbHkgMSBmb3IgMkQgbm9kZXMnIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF90cmFuc2Zvcm1dIE5vZGUgc2NhbGUuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbbW92ZV0gTm9kZSBVVUlEIHRvIG1vdmUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmV3UGFyZW50VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW21vdmVdIE5ldyBwYXJlbnQgbm9kZSBVVUlEJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluY2x1ZGVDaGlsZHJlbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tkdXBsaWNhdGVdIEluY2x1ZGUgY2hpbGRyZW4gbm9kZXMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlTm9kZShhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldE5vZGVJbmZvKGFyZ3MudXVpZCksXG4gICAgICAgIGZpbmQ6IChhcmdzKSA9PiB0aGlzLmZpbmROb2RlcyhhcmdzLnBhdHRlcm4sIGNvZXJjZUJvb2woYXJncy5leGFjdE1hdGNoKSA/PyBmYWxzZSksXG4gICAgICAgIGZpbmRfYnlfbmFtZTogKGFyZ3MpID0+IHRoaXMuZmluZE5vZGVCeU5hbWUoYXJncy5uYW1lKSxcbiAgICAgICAgZ2V0X2FsbDogKCkgPT4gdGhpcy5nZXRBbGxOb2RlcygpLFxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldE5vZGVQcm9wZXJ0eShhcmdzLnV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWUsIGFyZ3MucHJvcGVydHlUeXBlKSxcbiAgICAgICAgc2V0X3RyYW5zZm9ybTogKGFyZ3MpID0+IHRoaXMuc2V0Tm9kZVRyYW5zZm9ybShhcmdzKSxcbiAgICAgICAgZGVsZXRlOiAoYXJncykgPT4gdGhpcy5kZWxldGVOb2RlKGFyZ3MudXVpZCksXG4gICAgICAgIG1vdmU6IChhcmdzKSA9PiB0aGlzLm1vdmVOb2RlKGFyZ3Mubm9kZVV1aWQsIGFyZ3MubmV3UGFyZW50VXVpZCwgY29lcmNlSW50KGFyZ3Muc2libGluZ0luZGV4KSA/PyAtMSwgY29lcmNlQm9vbChhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybSkgPz8gZmFsc2UpLFxuICAgICAgICBkdXBsaWNhdGU6IChhcmdzKSA9PiB0aGlzLmR1cGxpY2F0ZU5vZGUoYXJncy51dWlkLCBjb2VyY2VCb29sKGFyZ3MuaW5jbHVkZUNoaWxkcmVuKSA/PyB0cnVlKSxcbiAgICAgICAgZGV0ZWN0X3R5cGU6IChhcmdzKSA9PiB0aGlzLmRldGVjdE5vZGVUeXBlKGFyZ3MudXVpZClcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVOb2RlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHRhcmdldFBhcmVudFV1aWQgPSBhcmdzLnBhcmVudFV1aWQ7XG5cbiAgICAgICAgICAgIGlmICghdGFyZ2V0UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoc2NlbmVJbmZvICYmIHR5cGVvZiBzY2VuZUluZm8gPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHNjZW5lSW5mbykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNjZW5lSW5mbywgJ3V1aWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGFyZW50VXVpZCA9IChzY2VuZUluZm8gYXMgYW55KS51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYE5vIHBhcmVudCBzcGVjaWZpZWQsIHVzaW5nIHNjZW5lIHJvb3Q6ICR7dGFyZ2V0UGFyZW50VXVpZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHNjZW5lSW5mbykgJiYgc2NlbmVJbmZvLmxlbmd0aCA+IDAgJiYgc2NlbmVJbmZvWzBdLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFBhcmVudFV1aWQgPSBzY2VuZUluZm9bMF0udXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBObyBwYXJlbnQgc3BlY2lmaWVkLCB1c2luZyBzY2VuZSByb290OiAke3RhcmdldFBhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50U2NlbmUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jdXJyZW50LXNjZW5lJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudFNjZW5lICYmIGN1cnJlbnRTY2VuZS51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGFyZW50VXVpZCA9IGN1cnJlbnRTY2VuZS51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGdldCBzY2VuZSByb290LCB3aWxsIHVzZSBkZWZhdWx0IGJlaGF2aW9yJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgZmluYWxBc3NldFV1aWQgPSBhcmdzLmFzc2V0VXVpZDtcbiAgICAgICAgICAgIGxldCBhc3NldFR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGxldCBwYXRoSW5mbzogYW55O1xuICAgICAgICAgICAgaWYgKGFyZ3MuYXNzZXRQYXRoICYmICFmaW5hbEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhcmdzLmFzc2V0UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbmFsQXNzZXRVdWlkID0gYXNzZXRJbmZvLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFR5cGUgPSBhc3NldEluZm8udHlwZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhdGhJbmZvID0gYXNzZXRJbmZvO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEFzc2V0IHBhdGggJyR7YXJncy5hc3NldFBhdGh9JyByZXNvbHZlZCB0byBVVUlEOiAke2ZpbmFsQXNzZXRVdWlkfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBBc3NldCBub3QgZm91bmQgYXQgcGF0aDogJHthcmdzLmFzc2V0UGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZXNvbHZlIGFzc2V0IHBhdGggJyR7YXJncy5hc3NldFBhdGh9JzogJHtlcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBIHJhdyBtb2RlbCBhc3NldCAoLmZieC8uZ2x0ZikgaXMgbm90IGluc3RhbnRpYWJsZTsgcmVkaXJlY3QgaXQgdG8gaXRzXG4gICAgICAgICAgICAvLyBgZ2x0Zi1zY2VuZWAgc3ViLWFzc2V0IGluc3RlYWQgb2YgY3JlYXRpbmcgYW4gZW1wdHkgbm9kZSAoaXNzdWUgIzExNykuXG4gICAgICAgICAgICBsZXQgcmVzb2x2ZWRGcm9tTW9kZWw6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChmaW5hbEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUluc3RhbnRpYWJsZUFzc2V0VXVpZChmaW5hbEFzc2V0VXVpZCwgcGF0aEluZm8pO1xuICAgICAgICAgICAgICAgIGlmIChyZXNvbHZlZC5yZXNvbHZlZEZyb20pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWRGcm9tTW9kZWwgPSByZXNvbHZlZC5yZXNvbHZlZEZyb207XG4gICAgICAgICAgICAgICAgICAgIGZpbmFsQXNzZXRVdWlkID0gcmVzb2x2ZWQudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgYXNzZXRUeXBlID0gdW5kZWZpbmVkOyAvLyByZS1yZXNvbHZlZCBiZWxvdyBmb3IgdGhlIHN1Yi1hc3NldFxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWFzc2V0VHlwZSAmJiByZXNvbHZlZC5pbmZvPy50eXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSA9IHJlc29sdmVkLmluZm8udHlwZTsgLy8gcmV1c2UgdGhlIGxvb2t1cCBpbnN0ZWFkIG9mIHJlcGVhdGluZyBpdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY3JlYXRlTm9kZU9wdGlvbnM6IGFueSA9IHsgbmFtZTogYXJncy5uYW1lIH07XG5cbiAgICAgICAgICAgIGlmICh0YXJnZXRQYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucGFyZW50ID0gdGFyZ2V0UGFyZW50VXVpZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGZpbmFsQXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMuYXNzZXRVdWlkID0gZmluYWxBc3NldFV1aWQ7XG5cbiAgICAgICAgICAgICAgICAvLyBgdHlwZWAgc2VsZWN0cyB0aGUgY3JlYXRlTm9kZUZyb21Bc3NldCgpIGJyYW5jaCB0aGF0IGluc3RhbnRpYXRlcyBhXG4gICAgICAgICAgICAgICAgLy8gbGlua2VkIGluc3RhbmNlIChlLmcuIGEgcHJlZmFiJ3MgY2MuUHJlZmFiSW5mby9QcmVmYWJJbnN0YW5jZSkuIFdpdGhvdXRcbiAgICAgICAgICAgICAgICAvLyBpdCwgMy44LjcncyBub2RlIG1hbmFnZXIgZmFsbHMgYmFjayB0byBhIHBsYWluIG5vZGUgYnVpbHQgZnJvbSB0aGVcbiAgICAgICAgICAgICAgICAvLyBhc3NldCdzIHJhdyBkdW1wIOKAlCBhIGZsYXR0ZW5lZCwgdW5saW5rZWQgY29weSB0aGF0IHJlcG9ydHMgc3VjY2Vzc1xuICAgICAgICAgICAgICAgIC8vIGJ1dCBjYXJyaWVzIG5vIHByZWZhYiBsaW5rLiBSZXNvbHZlIGl0IHdoZW4gbm90IGFscmVhZHkga25vd24gZnJvbSB0aGVcbiAgICAgICAgICAgICAgICAvLyBhc3NldFBhdGggbG9va3VwIGFib3ZlLlxuICAgICAgICAgICAgICAgIGlmICghYXNzZXRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGZpbmFsQXNzZXRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSA9IGluZm8/LnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBGYWlsZWQgdG8gcmVzb2x2ZSBhc3NldCB0eXBlIGZvciAnJHtmaW5hbEFzc2V0VXVpZH0nOmAsIGVycik7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGFzc2V0VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy50eXBlID0gYXNzZXRUeXBlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChjb2VyY2VCb29sKGFyZ3MudW5saW5rUHJlZmFiKSkge1xuICAgICAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy51bmxpbmtQcmVmYWIgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFyZ3MuY29tcG9uZW50cyAmJiBhcmdzLmNvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLmNvbXBvbmVudHMgPSBhcmdzLmNvbXBvbmVudHM7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFyZ3Mubm9kZVR5cGUgJiYgYXJncy5ub2RlVHlwZSAhPT0gJ05vZGUnICYmICFmaW5hbEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLmNvbXBvbmVudHMgPSBbYXJncy5ub2RlVHlwZV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChjb2VyY2VCb29sKGFyZ3Mua2VlcFdvcmxkVHJhbnNmb3JtKSkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLmtlZXBXb3JsZFRyYW5zZm9ybSA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHNpYmxpbmdJbmRleCA9IGNvZXJjZUludChhcmdzLnNpYmxpbmdJbmRleCk7XG5cbiAgICAgICAgICAgIC8vIFJlZnVzZSBhIGxheWVyIHdlIGNhbm5vdCBhcHBseSBCRUZPUkUgY3JlYXRpbmcgYW55dGhpbmcsIHNvIGEgYmFkIGFyZ3VtZW50IGRvZXNcbiAgICAgICAgICAgIC8vIG5vdCBsZWF2ZSBhbiBvcnBoYW4gbm9kZSBiZWhpbmQgKCMxNTMpLlxuICAgICAgICAgICAgY29uc3QgcmVxdWVzdGVkTGF5ZXIgPSBhcmdzLmxheWVyID09PSB1bmRlZmluZWQgfHwgYXJncy5sYXllciA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IGNvZXJjZUludChhcmdzLmxheWVyKTtcbiAgICAgICAgICAgIGlmIChhcmdzLmxheWVyICE9PSB1bmRlZmluZWQgJiYgYXJncy5sYXllciAhPT0gbnVsbCAmJiByZXF1ZXN0ZWRMYXllciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBsYXllciBtdXN0IGJlIGFuIGludGVnZXIgbGF5ZXIgYml0bWFzayAoZS5nLiAzMzU1NDQzMiBmb3IgVUlfMkQpOyByZWNlaXZlZCAke0pTT04uc3RyaW5naWZ5KGFyZ3MubGF5ZXIpfS4gTm8gbm9kZSB3YXMgY3JlYXRlZC5gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIG5vZGUgd2l0aCBvcHRpb25zOicsIGNyZWF0ZU5vZGVPcHRpb25zKTtcblxuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIGNyZWF0ZU5vZGVPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBBcnJheS5pc0FycmF5KG5vZGVVdWlkKSA/IG5vZGVVdWlkWzBdIDogbm9kZVV1aWQ7XG5cbiAgICAgICAgICAgIC8vIGBzZXQtcGFyZW50YCBhcHBlbmRzLCBzbyBob25vdXJpbmcgc2libGluZ0luZGV4IG5lZWRzIGFuIGV4cGxpY2l0IHJlb3JkZXIsIGFuZFxuICAgICAgICAgICAgLy8gdGhlIG91dGNvbWUgaXMgcmVwb3J0ZWQgcmF0aGVyIHRoYW4gYXNzdW1lZCAoaXNzdWUgIzk5IGl0ZW0gMikuXG4gICAgICAgICAgICBsZXQgc2libGluZ09yZGVyOiAoU2libGluZ09yZGVyUmVzdWx0ICYgeyByZXF1ZXN0ZWQ6IG51bWJlciB9KSB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nSW5kZXggIT09IHVuZGVmaW5lZCAmJiBzaWJsaW5nSW5kZXggPj0gMCAmJiB1dWlkICYmIHRhcmdldFBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmF3YWl0Tm9kZUNvbW1pdCh1dWlkKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gYXdhaXQgbm9kZSBjb21taXQgYmVmb3JlIHNpYmxpbmcgb3JkZXJpbmc6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2libGluZ09yZGVyID0geyByZXF1ZXN0ZWQ6IHNpYmxpbmdJbmRleCwgLi4uKGF3YWl0IGFwcGx5U2libGluZ0luZGV4KHRhcmdldFBhcmVudFV1aWQsIHV1aWQsIHNpYmxpbmdJbmRleCkpIH07XG4gICAgICAgICAgICAgICAgaWYgKCFzaWJsaW5nT3JkZXIuYXBwbGllZCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYHNpYmxpbmdJbmRleCAke3NpYmxpbmdJbmRleH0gd2FzIG5vdCBhcHBsaWVkOiAke3NpYmxpbmdPcmRlci5yZWFzb259YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXJncy5jb21wb25lbnRzICYmIGFyZ3MuY29tcG9uZW50cy5sZW5ndGggPiAwICYmIHV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmF3YWl0Tm9kZUNvbW1pdCh1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgLy8gYGNyZWF0ZS1ub2RlYCB3YXMgYWxyZWFkeSBoYW5kZWQgYGNvbXBvbmVudHNgLCBhbmQgdGhlIGVkaXRvciBhdXRvLWFkZHNcbiAgICAgICAgICAgICAgICAgICAgLy8gc29tZSBvbiBjcmVhdGlvbiAoVUlUcmFuc2Zvcm0gb24gYSBVSS1sYXllciBub2RlKSwgc28gcmUtYWRkaW5nIGJsaW5kbHlcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9ncyBcImFscmVhZHkgY29udGFpbnMgPENvbXBvbmVudD5cIiBmb3IgYSBjb3JyZWN0IGNyZWF0ZSAoIzEzNikuIFNraXBcbiAgICAgICAgICAgICAgICAgICAgLy8gd2hhdCB0aGUgbm9kZSBhbHJlYWR5IGNhcnJpZXM7IGFuIHVucmVhZGFibGUgbm9kZSBmYWxscyBiYWNrIHRvIGFkZGluZyBhbGwuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZXNlbnQgPSBhd2FpdCB0aGlzLnF1ZXJ5Q29tcG9uZW50VHlwZXModXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY29tcG9uZW50VHlwZSBvZiBhcmdzLmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwcmVzZW50Lmhhcyhjb21wb25lbnRUeXBlKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSBhbHJlYWR5IHByZXNlbnQsIHNraXBwaW5nIGR1cGxpY2F0ZSBhZGRgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYENvbXBvbmVudCAke2NvbXBvbmVudFR5cGV9IGFkZGVkIHN1Y2Nlc3NmdWxseWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBGYWlsZWQgdG8gYWRkIGNvbXBvbmVudCAke2NvbXBvbmVudFR5cGV9OmAsIGVycik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gYWRkIGNvbXBvbmVudHM6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhcmdzLmluaXRpYWxUcmFuc2Zvcm0gJiYgdXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXdhaXROb2RlQ29tbWl0KHV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwb3MgPSBub3JtYWxpemVWZWMzKGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5wb3NpdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJvdCA9IG5vcm1hbGl6ZVZlYzMoYXJncy5pbml0aWFsVHJhbnNmb3JtLnJvdGF0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2NsID0gbm9ybWFsaXplVmVjMyhhcmdzLmluaXRpYWxUcmFuc2Zvcm0uc2NhbGUpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnNldE5vZGVUcmFuc2Zvcm0oe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBwb3MgPz8gYXJncy5pbml0aWFsVHJhbnNmb3JtLnBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IHJvdCA/PyBhcmdzLmluaXRpYWxUcmFuc2Zvcm0ucm90YXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZTogc2NsID8/IGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5zY2FsZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0luaXRpYWwgdHJhbnNmb3JtIGFwcGxpZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHNldCBpbml0aWFsIHRyYW5zZm9ybTonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYGNyZWF0ZS1ub2RlYCBsZWF2ZXMgYSBuZXcgbm9kZSBvbiB0aGUgREVGQVVMVCBsYXllciwgc28gYSBub2RlIG1lYW50IGZvciBhIFVJXG4gICAgICAgICAgICAvLyBjYW1lcmEgaXMgY3VsbGVkIHVudGlsIGl0cyBsYXllciBpcyBmaXhlZCBieSBoYW5kICgjMTUzKS4gQXBwbGllZCB0aHJvdWdoIHRoZSBzYW1lXG4gICAgICAgICAgICAvLyB2ZXJpZmllZCB3cml0ZSBhcyBzZXRfcHJvcGVydHk7IGEgZmFpbHVyZSBpcyByZXBvcnRlZCwgbm90IGhpZGRlbiwgYW5kIGRvZXMgbm90XG4gICAgICAgICAgICAvLyB1bmRvIHRoZSBjcmVhdGlvbi5cbiAgICAgICAgICAgIGxldCBsYXllclJlc3VsdDogeyByZXF1ZXN0ZWQ6IG51bWJlcjsgYXBwbGllZDogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChyZXF1ZXN0ZWRMYXllciAhPT0gdW5kZWZpbmVkICYmIHV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmF3YWl0Tm9kZUNvbW1pdCh1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGF5ZXJXcml0ZSA9IGF3YWl0IHRoaXMuc2V0Tm9kZVByb3BlcnR5KHV1aWQsICdsYXllcicsIHJlcXVlc3RlZExheWVyLCAnbnVtYmVyJyk7XG4gICAgICAgICAgICAgICAgICAgIGxheWVyUmVzdWx0ID0gbGF5ZXJXcml0ZS5zdWNjZXNzXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHsgcmVxdWVzdGVkOiByZXF1ZXN0ZWRMYXllciwgYXBwbGllZDogdHJ1ZSB9XG4gICAgICAgICAgICAgICAgICAgICAgICA6IHsgcmVxdWVzdGVkOiByZXF1ZXN0ZWRMYXllciwgYXBwbGllZDogZmFsc2UsIGVycm9yOiBsYXllcldyaXRlLmVycm9yIH07XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgbGF5ZXJSZXN1bHQgPSB7IHJlcXVlc3RlZDogcmVxdWVzdGVkTGF5ZXIsIGFwcGxpZWQ6IGZhbHNlLCBlcnJvcjogZXJyPy5tZXNzYWdlIHx8IFN0cmluZyhlcnIpIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghbGF5ZXJSZXN1bHQuYXBwbGllZCkgY29uc29sZS53YXJuKGBsYXllciAke3JlcXVlc3RlZExheWVyfSB3YXMgbm90IGFwcGxpZWQ6ICR7bGF5ZXJSZXN1bHQuZXJyb3J9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB2ZXJpZmljYXRpb25EYXRhOiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8odXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVJbmZvLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVJbmZvOiBub2RlSW5mby5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRpb25EZXRhaWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogdGFyZ2V0UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVHlwZTogYXJncy5ub2RlVHlwZSB8fCAnTm9kZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbUFzc2V0OiAhIWZpbmFsQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogZmluYWxBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRQYXRoOiBhcmdzLmFzc2V0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGdldCB2ZXJpZmljYXRpb24gZGF0YTonLCBlcnIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzTWVzc2FnZSA9IGZpbmFsQXNzZXRVdWlkXG4gICAgICAgICAgICAgICAgPyBgTm9kZSAnJHthcmdzLm5hbWV9JyBpbnN0YW50aWF0ZWQgZnJvbSBhc3NldCBzdWNjZXNzZnVsbHlgXG4gICAgICAgICAgICAgICAgOiBgTm9kZSAnJHthcmdzLm5hbWV9JyBjcmVhdGVkIHN1Y2Nlc3NmdWxseWA7XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IGFyZ3MubmFtZSxcbiAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiB0YXJnZXRQYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgIG5vZGVUeXBlOiBhcmdzLm5vZGVUeXBlIHx8ICdOb2RlJyxcbiAgICAgICAgICAgICAgICBmcm9tQXNzZXQ6ICEhZmluYWxBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiBmaW5hbEFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAuLi4ocmVzb2x2ZWRGcm9tTW9kZWwgPyB7IHJlc29sdmVkRnJvbU1vZGVsVXVpZDogcmVzb2x2ZWRGcm9tTW9kZWwgfSA6IHt9KSxcbiAgICAgICAgICAgICAgICAuLi4oc2libGluZ09yZGVyID8geyBzaWJsaW5nT3JkZXIgfSA6IHt9KSxcbiAgICAgICAgICAgICAgICAuLi4obGF5ZXJSZXN1bHQgPyB7IGxheWVyOiBsYXllclJlc3VsdCB9IDoge30pLFxuICAgICAgICAgICAgICAgIC4uLihsYXllclJlc3VsdCAmJiAhbGF5ZXJSZXN1bHQuYXBwbGllZFxuICAgICAgICAgICAgICAgICAgICA/IHsgbGF5ZXJXYXJuaW5nOiBgbGF5ZXIgJHtsYXllclJlc3VsdC5yZXF1ZXN0ZWR9IHdhcyBOT1QgYXBwbGllZCAoJHtsYXllclJlc3VsdC5lcnJvcn0pOyB0aGUgbm9kZSBrZWVwcyB0aGUgZWRpdG9yIGRlZmF1bHQgbGF5ZXIuYCB9XG4gICAgICAgICAgICAgICAgICAgIDoge30pLFxuICAgICAgICAgICAgICAgIC4uLihzaWJsaW5nT3JkZXIgJiYgIXNpYmxpbmdPcmRlci5hcHBsaWVkXG4gICAgICAgICAgICAgICAgICAgID8geyB3YXJuaW5nOiBgc2libGluZ0luZGV4ICR7c2libGluZ09yZGVyLnJlcXVlc3RlZH0gd2FzIE5PVCBhcHBsaWVkICgke3NpYmxpbmdPcmRlci5yZWFzb259KTsgdGhlIG5vZGUgaXMgdGhlIGxhc3QgY2hpbGQuYCB9XG4gICAgICAgICAgICAgICAgICAgIDoge30pLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHN1Y2Nlc3NNZXNzYWdlLFxuICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbkRhdGFcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBjcmVhdGUgbm9kZTogJHtlcnIubWVzc2FnZX0uIEFyZ3M6ICR7SlNPTi5zdHJpbmdpZnkoYXJncyl9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQ29tcG9uZW50IHR5cGUgbmFtZXMgY3VycmVudGx5IG9uIGEgbm9kZSwgb3IgYW4gZW1wdHkgc2V0IHdoZW4gdGhlIG5vZGUgY2Fubm90IGJlIHJlYWQuICovXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUNvbXBvbmVudFR5cGVzKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgICAgICAgY29uc3QgdHlwZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGR1bXA6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcCBvZiAoZHVtcD8uX19jb21wc19fIHx8IFtdKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBjb21wPy50eXBlID8/IGNvbXA/Ll9fdHlwZV9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycpIHR5cGVzLmFkZCh0eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2g6IGNhbGxlciBhZGRzIGV2ZXJ5IHJlcXVlc3RlZCBjb21wb25lbnQsIGFzIGJlZm9yZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0eXBlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgc2NlbmU6Y3JlYXRlLW5vZGVgIHJlc29sdmVzIGJlZm9yZSB0aGUgbmV3IG5vZGUgaXMgcXVlcnlhYmxlLCBzbyB0aGUgZm9sbG93LXVwXG4gICAgICogc2V0LXBhcmVudCAvIGNyZWF0ZS1jb21wb25lbnQgLyBpbml0aWFsLXRyYW5zZm9ybSBzdGVwcyB1c2VkIHRvIHdhaXQgb3V0IGEgZml4ZWRcbiAgICAgKiAxMDAtMTUwbXMgc2xlZXAgYW5kIHRoZW4gcHJvY2VlZCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIGNvbW1pdCBoYWQgbGFuZGVkLiBPbiBhXG4gICAgICogYnVzeSBlZGl0b3IgaXQgaGFkIG5vdCwgYW5kIHRob3NlIGVkaXRzIHdlcmUgc2lsZW50bHkgZHJvcHBlZCBmcm9tIHRoZSBjcmVhdGVkIG5vZGVcbiAgICAgKiAoIzYpLiBQb2xsIGBzY2VuZTpxdWVyeS1ub2RlYCBpbnN0ZWFkOiBjb250aW51ZSBhcyBzb29uIGFzIHRoZSBub2RlIGlzIGFjdHVhbGx5XG4gICAgICogdmlzaWJsZSwgYW5kIHRocm93IHdoZW4gaXQgbmV2ZXIgYmVjb21lcyB2aXNpYmxlIHNvIHRoZSBjYWxsZXIncyBleGlzdGluZyBjYXRjaFxuICAgICAqIHJlcG9ydHMgYSByZWFsIHJlYXNvbiByYXRoZXIgdGhhbiBhIGJsaW5kIGZhaWx1cmUgZnVydGhlciBkb3duLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgYXdhaXROb2RlQ29tbWl0KHV1aWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyBOT0RFX0NPTU1JVF9USU1FT1VUX01TO1xuICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhKSByZXR1cm47XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAvLyBxdWVyeS1ub2RlIHJlamVjdHMgd2hpbGUgdGhlIG5vZGUgaXMgbm90IHlldCBpbiB0aGUgZ3JhcGgg4oCUIGtlZXAgcG9sbGluZy5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChEYXRlLm5vdygpID49IGRlYWRsaW5lKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICcke3V1aWR9JyB3YXMgbm90IHF1ZXJ5YWJsZSB3aXRoaW4gJHtOT0RFX0NPTU1JVF9USU1FT1VUX01TfW1zIG9mIGNyZWF0aW9uYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgTk9ERV9DT01NSVRfUE9MTF9NUykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlSW5mbyh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4gZXJyb3JSZXN1bHQoJ05vZGUgbm90IGZvdW5kIG9yIGludmFsaWQgcmVzcG9uc2UnKTtcbiAgICAgICAgICAgIGNvbnN0IGluZm86IE5vZGVJbmZvID0ge1xuICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVEYXRhLnV1aWQ/LnZhbHVlIHx8IHV1aWQsXG4gICAgICAgICAgICAgICAgbmFtZTogbm9kZURhdGEubmFtZT8udmFsdWUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZURhdGEuYWN0aXZlPy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gbm9kZURhdGEuYWN0aXZlLnZhbHVlIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZURhdGEucG9zaXRpb24/LnZhbHVlIHx8IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBub2RlRGF0YS5yb3RhdGlvbj8udmFsdWUgfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH0sXG4gICAgICAgICAgICAgICAgc2NhbGU6IG5vZGVEYXRhLnNjYWxlPy52YWx1ZSB8fCB7IHg6IDEsIHk6IDEsIHo6IDEgfSxcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IG5vZGVEYXRhLnBhcmVudD8udmFsdWU/LnV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICBjaGlsZHJlbjogbm9kZURhdGEuY2hpbGRyZW4gfHwgW10sXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogKG5vZGVEYXRhLl9fY29tcHNfXyB8fCBbXSkubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuX190eXBlX18gfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWVcbiAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgbGF5ZXI6IG5vZGVEYXRhLmxheWVyPy52YWx1ZSB8fCAxMDczNzQxODI0LFxuICAgICAgICAgICAgICAgIG1vYmlsaXR5OiBub2RlRGF0YS5tb2JpbGl0eT8udmFsdWUgfHwgMFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGluZm8pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZmluZE5vZGVzKHBhdHRlcm46IHN0cmluZywgZXhhY3RNYXRjaDogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghcGF0dGVybikgcmV0dXJuIGVycm9yUmVzdWx0KCdwYXR0ZXJuIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249ZmluZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHJlZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHNlYXJjaFRyZWUgPSAobm9kZTogYW55LCBjdXJyZW50UGF0aDogc3RyaW5nID0gJycpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlUGF0aCA9IGN1cnJlbnRQYXRoID8gYCR7Y3VycmVudFBhdGh9LyR7bm9kZS5uYW1lfWAgOiBub2RlLm5hbWU7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlcyA9IGV4YWN0TWF0Y2hcbiAgICAgICAgICAgICAgICAgICAgPyBub2RlLm5hbWUgPT09IHBhdHRlcm5cbiAgICAgICAgICAgICAgICAgICAgOiBub2RlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpO1xuICAgICAgICAgICAgICAgIGlmIChtYXRjaGVzKSBub2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIHBhdGg6IG5vZGVQYXRoIH0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikgc2VhcmNoVHJlZShjaGlsZCwgbm9kZVBhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAodHJlZSkgc2VhcmNoVHJlZSh0cmVlKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG5vZGVzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdmaW5kTm9kZXMnLCBhcmdzOiBbcGF0dGVybiwgZXhhY3RNYXRjaF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYFRyZWUgc2VhcmNoIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kTm9kZUJ5TmFtZShuYW1lOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFuYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25hbWUgaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1maW5kX2J5X25hbWUnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3QgZm91bmROb2RlID0gc2VhcmNoTm9kZUluVHJlZSh0cmVlLCBuYW1lKTtcbiAgICAgICAgICAgIGlmIChmb3VuZE5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHV1aWQ6IGZvdW5kTm9kZS51dWlkLCBuYW1lOiBmb3VuZE5vZGUubmFtZSwgcGF0aDogZ2V0Tm9kZVBhdGgoZm91bmROb2RlKSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgTm9kZSAnJHtuYW1lfScgbm90IGZvdW5kYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZmluZE5vZGVCeU5hbWUnLCBhcmdzOiBbbmFtZV1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFsbE5vZGVzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHJlZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHRyYXZlcnNlVHJlZSA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBub2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIHR5cGU6IG5vZGUudHlwZSwgYWN0aXZlOiBub2RlLmFjdGl2ZSwgcGF0aDogZ2V0Tm9kZVBhdGgobm9kZSkgfSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB0cmF2ZXJzZVRyZWUoY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAodHJlZSAmJiB0cmVlLmNoaWxkcmVuKSB0cmF2ZXJzZVRyZWUodHJlZSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHRvdGFsTm9kZXM6IG5vZGVzLmxlbmd0aCwgbm9kZXMgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0QWxsTm9kZXMnLCBhcmdzOiBbXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBOb2RlIHByb3BlcnRpZXMgdGhhdCBtdXN0IGJlIHRyZWF0ZWQgYXMgYm9vbGVhbiBldmVuIHdoZW4gcHJvcGVydHlUeXBlIGlzIG9taXR0ZWQuICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgS05PV05fQk9PTEVBTl9OT0RFX1BST1BFUlRJRVMgPSBuZXcgU2V0KFsnYWN0aXZlJ10pO1xuXG4gICAgLyoqXG4gICAgICogQ29lcmNlIGEgc2V0X3Byb3BlcnR5IHZhbHVlIGJ5IHRoZSByZXF1ZXN0ZWQgKG9yIGluZmVycmVkKSBwcm9wZXJ0eVR5cGUuXG4gICAgICogVGhyb3dzIG9uIGEgdmFsdWUgdGhhdCBjYW5ub3QgYmUgY29lcmNlZCwgc28gdGhlIGNhbGxlciByZXR1cm5zIGVycm9yUmVzdWx0XG4gICAgICogaW5zdGVhZCBvZiBzaWxlbnRseSBmb3J3YXJkaW5nIGEgdmFsdWUgdGhlIGVuZ2luZSB3aWxsIG1pc2ludGVycHJldC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNvZXJjZU5vZGVQcm9wZXJ0eVZhbHVlKHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnksIHByb3BlcnR5VHlwZT86IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGNvbnN0IGVmZmVjdGl2ZVR5cGUgPSBwcm9wZXJ0eVR5cGVcbiAgICAgICAgICAgIHx8IChNYW5hZ2VOb2RlLktOT1dOX0JPT0xFQU5fTk9ERV9QUk9QRVJUSUVTLmhhcyhwcm9wZXJ0eSkgPyAnYm9vbGVhbicgOiB1bmRlZmluZWQpO1xuXG4gICAgICAgIGlmIChlZmZlY3RpdmVUeXBlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBjb2VyY2VCb29sKHZhbHVlKTtcbiAgICAgICAgICAgIGlmIChjb2VyY2VkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5ICcke3Byb3BlcnR5fScgZXhwZWN0cyBhIGJvb2xlYW4gdmFsdWUgKHRydWUvZmFsc2UvMS8wL1widHJ1ZVwiL1wiZmFsc2VcIiksIHJlY2VpdmVkOiAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjb2VyY2VkO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlZmZlY3RpdmVUeXBlID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IGNvZXJjZUZsb2F0KHZhbHVlKTtcbiAgICAgICAgICAgIGlmIChjb2VyY2VkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5ICcke3Byb3BlcnR5fScgZXhwZWN0cyBhIG51bWVyaWMgdmFsdWUsIHJlY2VpdmVkOiAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjb2VyY2VkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWFkIGEgbm9kZSBwcm9wZXJ0eSBiYWNrIGZyb20gdGhlIGxpdmUgc2NlbmUgZm9yIHNldF9wcm9wZXJ0eSB2ZXJpZmljYXRpb24uXG4gICAgICogT25seSByZXNvbHZlcyB0b3AtbGV2ZWwgZHVtcCBlbnRyaWVzIChhY3RpdmUsIG5hbWUsIGxheWVyLCBtb2JpbGl0eSwgLi4uKSDigJQgdGhlXG4gICAgICogcHJvcGVydGllcyBzZXRfcHJvcGVydHkgYWN0dWFsbHkgZG9jdW1lbnRzLiBgZm91bmQ6IGZhbHNlYCBtZWFucyB0aGUgcGF0aCBjb3VsZFxuICAgICAqIG5vdCBiZSByZXNvbHZlZCB0aGlzIHdheSAoZS5nLiBhIG5lc3RlZCBwcm9wZXJ0eSksIE5PVCB0aGF0IHRoZSB3cml0ZSBmYWlsZWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkTm9kZVByb3BlcnR5KHV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZyk6IFByb21pc2U8eyBmb3VuZDogYm9vbGVhbjsgdmFsdWU6IGFueSB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgY29uc3QgZW50cnkgPSBub2RlRGF0YSA/IG5vZGVEYXRhW3Byb3BlcnR5XSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChlbnRyeSAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gZW50cnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBmb3VuZDogdHJ1ZSwgdmFsdWU6IGVudHJ5LnZhbHVlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZhbHVlOiB1bmRlZmluZWQgfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4geyBmb3VuZDogZmFsc2UsIHZhbHVlOiB1bmRlZmluZWQgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Tm9kZVByb3BlcnR5KHV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSwgcHJvcGVydHlUeXBlPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXVpZCB8fCAhcHJvcGVydHkgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkLCBwcm9wZXJ0eSwgYW5kIHZhbHVlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0eScpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSXNzdWUgIzQ3OiBhIGJvb2xlYW4gbm9kZSBwcm9wZXJ0eSAoYWN0aXZlLCAuLi4pIHNlbnQgdGhyb3VnaCBhbnkgdHJhbnNwb3J0XG4gICAgICAgIC8vIHRoYXQgc3RyaW5naWZpZXMgYXJncyBhcnJpdmVzIGFzIGBcImZhbHNlXCJgIOKAlCBhIFRSVVRIWSBzdHJpbmcg4oCUIHNvXG4gICAgICAgIC8vIGBub2RlLmFjdGl2ZSA9IFwiZmFsc2VcImAgc2lsZW50bHkgbGVhdmVzIHRoZSBub2RlIGFjdGl2ZS4gQ29lcmNlIGJ5IGFuIGV4cGxpY2l0XG4gICAgICAgIC8vIHByb3BlcnR5VHlwZSwgb3IgYnkgYSBrbm93biBib29sZWFuIHByb3BlcnR5IG5hbWUgd2hlbiBwcm9wZXJ0eVR5cGUgaXNcbiAgICAgICAgLy8gb21pdHRlZCwgdGhlIHNhbWUgd2F5IG1hbmFnZV9jb21wb25lbnQgc2V0X3Byb3BlcnR5IGhvbm91cnMgcHJvcGVydHlUeXBlLlxuICAgICAgICBsZXQgY29lcmNlZFZhbHVlOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb2VyY2VkVmFsdWUgPSB0aGlzLmNvZXJjZU5vZGVQcm9wZXJ0eVZhbHVlKHByb3BlcnR5LCB2YWx1ZSwgcHJvcGVydHlUeXBlKTtcbiAgICAgICAgfSBjYXRjaCAoY29lcmNlRXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChjb2VyY2VFcnIubWVzc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5JywgeyB1dWlkLCBwYXRoOiBwcm9wZXJ0eSwgZHVtcDogeyB2YWx1ZTogY29lcmNlZFZhbHVlIH0gfSk7XG5cbiAgICAgICAgICAgIC8vIElzc3VlICM0NzogYHNldC1wcm9wZXJ0eWAgcmVzb2x2aW5nIHdpdGhvdXQgdGhyb3dpbmcgZG9lcyBOT1QgbWVhbiB0aGVcbiAgICAgICAgICAgIC8vIHdyaXRlIHRvb2sgZWZmZWN0IOKAlCByZWFkIHRoZSBwcm9wZXJ0eSBiYWNrIGFuZCBjb21wYXJlLCB0aGUgc2FtZVxuICAgICAgICAgICAgLy8gdmVyaWZ5LWRvbid0LWFzc3VtZSBmaXggIzM0LyM0MiBhbHJlYWR5IGFwcGxpZWQgdG8gbWFuYWdlX2NvbXBvbmVudC5cbiAgICAgICAgICAgIGNvbnN0IHZlcmlmeSA9IGF3YWl0IHRoaXMucmVhZE5vZGVQcm9wZXJ0eSh1dWlkLCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICBpZiAodmVyaWZ5LmZvdW5kICYmIHZlcmlmeS52YWx1ZSAhPT0gY29lcmNlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyB3cml0ZSBkaWQgbm90IHRha2UgZWZmZWN0OiByZXF1ZXN0ZWQgJHtKU09OLnN0cmluZ2lmeShjb2VyY2VkVmFsdWUpfSwgYCArXG4gICAgICAgICAgICAgICAgICAgIGBhY3R1YWwgdmFsdWUgaXMgJHtKU09OLnN0cmluZ2lmeSh2ZXJpZnkudmFsdWUpfS5gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWVkU3VmZml4ID0gdmVyaWZ5LmZvdW5kID8gJycgOiAnICh1bmFibGUgdG8gdmVyaWZ5IOKAlCByZWFkLWJhY2sgZGlkIG5vdCByZXNvbHZlIGEgdmFsdWUgYXQgdGhpcyBwcm9wZXJ0eSBwYXRoKSc7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsIHByb3BlcnR5LCBuZXdWYWx1ZTogY29lcmNlZFZhbHVlLCBub2RlSW5mbzogbm9kZUluZm8uZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlRGV0YWlsczogeyBwcm9wZXJ0eSwgdmFsdWU6IGNvZXJjZWRWYWx1ZSwgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfVxuICAgICAgICAgICAgICAgIH0sIGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JHt2ZXJpZmllZFN1ZmZpeH1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbm9kZVV1aWQ6IHV1aWQsIHByb3BlcnR5LCBuZXdWYWx1ZTogY29lcmNlZFZhbHVlIH0sIGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JHt2ZXJpZmllZFN1ZmZpeH1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXROb2RlUHJvcGVydHknLCBhcmdzOiBbdXVpZCwgcHJvcGVydHksIGNvZXJjZWRWYWx1ZV1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldE5vZGVUcmFuc2Zvcm0oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHV1aWQgPSBhcmdzLnV1aWQ7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnBvc2l0aW9uKSA/PyBhcmdzLnBvc2l0aW9uO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5yb3RhdGlvbikgPz8gYXJncy5yb3RhdGlvbjtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBub3JtYWxpemVWZWMzKGFyZ3Muc2NhbGUpID8/IGFyZ3Muc2NhbGU7XG5cbiAgICAgICAgY29uc3QgdXBkYXRlUHJvbWlzZXM6IFByb21pc2U8YW55PltdID0gW107XG4gICAgICAgIGNvbnN0IHVwZGF0ZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IHdhcm5pbmdzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm9SZXNwb25zZS5zdWNjZXNzIHx8ICFub2RlSW5mb1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0ZhaWxlZCB0byBnZXQgbm9kZSBpbmZvcm1hdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IG5vZGVJbmZvUmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJczJEID0gaXMyRE5vZGUobm9kZUluZm8pO1xuXG4gICAgICAgICAgICBpZiAocG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplVHJhbnNmb3JtVmFsdWUocG9zaXRpb24sICdwb3NpdGlvbicsIG5vZGVJczJEKTtcbiAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZC53YXJuaW5nKSB3YXJuaW5ncy5wdXNoKG5vcm1hbGl6ZWQud2FybmluZyk7XG4gICAgICAgICAgICAgICAgdXBkYXRlUHJvbWlzZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCwgcGF0aDogJ3Bvc2l0aW9uJywgZHVtcDogeyB2YWx1ZTogbm9ybWFsaXplZC52YWx1ZSB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ3Bvc2l0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyb3RhdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVUcmFuc2Zvcm1WYWx1ZShyb3RhdGlvbiwgJ3JvdGF0aW9uJywgbm9kZUlzMkQpO1xuICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkLndhcm5pbmcpIHdhcm5pbmdzLnB1c2gobm9ybWFsaXplZC53YXJuaW5nKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVQcm9taXNlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLCBwYXRoOiAncm90YXRpb24nLCBkdW1wOiB7IHZhbHVlOiBub3JtYWxpemVkLnZhbHVlIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgncm90YXRpb24nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNjYWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVRyYW5zZm9ybVZhbHVlKHNjYWxlLCAnc2NhbGUnLCBub2RlSXMyRCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vcm1hbGl6ZWQud2FybmluZykgd2FybmluZ3MucHVzaChub3JtYWxpemVkLndhcm5pbmcpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVByb21pc2VzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsIHBhdGg6ICdzY2FsZScsIGR1bXA6IHsgdmFsdWU6IG5vcm1hbGl6ZWQudmFsdWUgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdzY2FsZScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodXBkYXRlUHJvbWlzZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdObyB0cmFuc2Zvcm0gcHJvcGVydGllcyBzcGVjaWZpZWQnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwodXBkYXRlUHJvbWlzZXMpO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkTm9kZUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBBY3Rpb25Ub29sUmVzdWx0ID0ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFRyYW5zZm9ybSBwcm9wZXJ0aWVzIHVwZGF0ZWQ6ICR7dXBkYXRlcy5qb2luKCcsICcpfSAke25vZGVJczJEID8gJygyRCBub2RlKScgOiAnKDNEIG5vZGUpJ31gLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG5vZGVUeXBlOiBub2RlSXMyRCA/ICcyRCcgOiAnM0QnLFxuICAgICAgICAgICAgICAgICAgICBhcHBsaWVkQ2hhbmdlczogdXBkYXRlcyxcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtQ29uc3RyYWludHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBub2RlSXMyRCA/ICd4LCB5IG9ubHkgKHogaWdub3JlZCknIDogJ3gsIHksIHogYWxsIHVzZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IG5vZGVJczJEID8gJ3ogb25seSAoeCwgeSBpZ25vcmVkKScgOiAneCwgeSwgeiBhbGwgdXNlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBzY2FsZTogbm9kZUlzMkQgPyAneCwgeSBtYWluLCB6IHR5cGljYWxseSAxJyA6ICd4LCB5LCB6IGFsbCB1c2VkJ1xuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBub2RlSW5mbzogdXBkYXRlZE5vZGVJbmZvLmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybURldGFpbHM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsTm9kZVR5cGU6IG5vZGVJczJEID8gJzJEJyA6ICczRCcsXG4gICAgICAgICAgICAgICAgICAgICAgICBhcHBsaWVkVHJhbnNmb3JtczogdXBkYXRlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGJlZm9yZUFmdGVyQ29tcGFyaXNvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgYmVmb3JlOiBub2RlSW5mbyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFmdGVyOiB1cGRhdGVkTm9kZUluZm8uZGF0YVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHdhcm5pbmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAocmVzdWx0IGFzIGFueSkud2FybmluZyA9IHdhcm5pbmdzLmpvaW4oJzsgJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG5cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHVwZGF0ZSB0cmFuc2Zvcm06ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRlbGV0ZU5vZGUodXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249ZGVsZXRlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZW1vdmUtbm9kZScsIHsgdXVpZCB9KTtcblxuICAgICAgICAgICAgLy8gSXNzdWUgIzc0OiBgcmVtb3ZlLW5vZGVgIHJlc29sdmluZyB3aXRob3V0IHRocm93aW5nIGRvZXMgTk9UIG1lYW4gdGhlIG5vZGVcbiAgICAgICAgICAgIC8vIGFjdHVhbGx5IGxlZnQgdGhlIGdyYXBoIOKAlCBpdCBzaWxlbnRseSBuby1vcHMgZm9yIGEgcHJlZmFiLWluc3RhbmNlIGNoaWxkIGluXG4gICAgICAgICAgICAvLyBzY2VuZS1lZGl0IGNvbnRleHQgKHRoZSBzYW1lIGNsYXNzIG9mIGNvbnN0cmFpbnQgbW92ZU5vZGUgYWxyZWFkeSB2ZXJpZmllc1xuICAgICAgICAgICAgLy8gYWdhaW5zdCBmb3IgIzMzKS4gUmVhZCB0aGUgbm9kZSBiYWNrOiBhIHJlamVjdGVkL2VtcHR5IHF1ZXJ5LW5vZGUgbWVhbnMgdGhlXG4gICAgICAgICAgICAvLyBub2RlIGlzIGdvbmUgKHN1Y2Nlc3MpOyBhIG5vZGUgdGhhdCBzdGlsbCByZXNvbHZlcyBtZWFucyB0aGUgZGVsZXRlIHdhc1xuICAgICAgICAgICAgLy8gYmxvY2tlZC4gVGhpcyBhbHNvIGV4cGxhaW5zIGlzc3VlICM3Mywgd2hlcmUgXCJkZWxldGVkXCIgbm9kZXMgcmVhcHBlYXJlZCDigJRcbiAgICAgICAgICAgIC8vIHRoZSBkZWxldGUgbmV2ZXIgdG9vayBlZmZlY3QsIHNvIGEgbGF0ZXIgY3JlYXRlIGxlZ2l0aW1hdGVseSBzdGlsbCBzYXcgdGhlbS5cbiAgICAgICAgICAgIGxldCBzdGlsbEV4aXN0cyA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgICAgIHN0aWxsRXhpc3RzID0gISFub2RlRGF0YTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHN0aWxsRXhpc3RzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RpbGxFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGBOb2RlICcke3V1aWR9JyBzdGlsbCBleGlzdHMgYWZ0ZXIgZGVsZXRlOiB0aGUgZGVsZXRlIGRpZCBub3QgdGFrZSBlZmZlY3QuIGAgK1xuICAgICAgICAgICAgICAgICAgICBgVGhpcyBjYW4gaGFwcGVuIHdoZW4gdGhlIG5vZGUgaXMgYSBwcmVmYWIgaW5zdGFuY2UncyBjaGlsZCBhbmQgcmVtb3ZhbCBpcyBibG9ja2VkIGJ5IHRoZSBwcmVmYWIgbGluayDigJQgdHJ5IGRlbGV0aW5nIGl0IGZyb20gcHJlZmFiIGVkaXQgbW9kZSBpbnN0ZWFkLmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnTm9kZSBkZWxldGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbW92ZU5vZGUobm9kZVV1aWQ6IHN0cmluZywgbmV3UGFyZW50VXVpZDogc3RyaW5nLCBzaWJsaW5nSW5kZXg6IG51bWJlciA9IC0xLCBrZWVwV29ybGRUcmFuc2Zvcm06IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFuZXdQYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBuZXdQYXJlbnRVdWlkIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPW1vdmUnKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXBhcmVudCcsIHtcbiAgICAgICAgICAgICAgICBwYXJlbnQ6IG5ld1BhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgdXVpZHM6IFtub2RlVXVpZF0sXG4gICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGxldCBzaWJsaW5nT3JkZXI6IFNpYmxpbmdPcmRlclJlc3VsdCB8IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChzaWJsaW5nSW5kZXggPj0gMCkge1xuICAgICAgICAgICAgICAgIHNpYmxpbmdPcmRlciA9IGF3YWl0IGFwcGx5U2libGluZ0luZGV4KG5ld1BhcmVudFV1aWQsIG5vZGVVdWlkLCBzaWJsaW5nSW5kZXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZWFkIGJhY2sgdGhlIGFjdHVhbCBwYXJlbnQuIGBzZXQtcGFyZW50YCBzaWxlbnRseSBuby1vcHMgZm9yIHNvbWUgcHJlZmFiLVxuICAgICAgICAgICAgLy8gaW5zdGFuY2UgY29uc3RyYWludHMgKGUuZy4gbW92aW5nIGEgcHJlZmFiIHJvb3Qgb3V0IGZyb20gdW5kZXIgaXRzIGluc3RhbmNlKSxcbiAgICAgICAgICAgIC8vIHNvIGEgcmVzb2x2ZWQgcHJvbWlzZSBoZXJlIGRvZXMgbm90IGd1YXJhbnRlZSB0aGUgcmVwYXJlbnQgdG9vayBlZmZlY3QuXG4gICAgICAgICAgICBjb25zdCB2ZXJpZnlJbmZvID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyhub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIXZlcmlmeUluZm8uc3VjY2VzcyB8fCAhdmVyaWZ5SW5mby5kYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBOb2RlIG1vdmUgY291bGQgbm90IGJlIHZlcmlmaWVkOiBmYWlsZWQgdG8gcmVhZCBiYWNrIG5vZGUgJyR7bm9kZVV1aWR9JyBhZnRlciB0aGUgbW92ZS5gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh2ZXJpZnlJbmZvLmRhdGEucGFyZW50ICE9PSBuZXdQYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBgTm9kZSBtb3ZlIGRpZCBub3QgdGFrZSBlZmZlY3Q6IGV4cGVjdGVkIHBhcmVudCAnJHtuZXdQYXJlbnRVdWlkfScgYnV0IHRoZSBub2RlIHN0aWxsIHJlcG9ydHMgcGFyZW50ICcke3ZlcmlmeUluZm8uZGF0YS5wYXJlbnR9Jy4gYCArXG4gICAgICAgICAgICAgICAgICAgIGBUaGlzIGNhbiBoYXBwZW4gd2hlbiB0aGUgbm9kZSBpcyBhIHByZWZhYiBpbnN0YW5jZSdzIHJvb3QgYW5kIHJlcGFyZW50aW5nIGlzIGJsb2NrZWQgYnkgdGhlIHByZWZhYiBsaW5rLmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2libGluZ09yZGVyICYmICFzaWJsaW5nT3JkZXIuYXBwbGllZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYE5vZGUgd2FzIG1vdmVkIHVuZGVyICcke25ld1BhcmVudFV1aWR9JyBidXQgc2libGluZ0luZGV4ICR7c2libGluZ0luZGV4fSB3YXMgTk9UIGFwcGxpZWQ6ICR7c2libGluZ09yZGVyLnJlYXNvbn0uYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbm9kZVV1aWQsIG5ld1BhcmVudFV1aWQsIHNpYmxpbmdPcmRlciwgbm9kZUluZm86IHZlcmlmeUluZm8uZGF0YSB9LCAnTm9kZSBtb3ZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGR1cGxpY2F0ZU5vZGUodXVpZDogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4gPSB0cnVlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249ZHVwbGljYXRlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWluY2x1ZGVDaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIC8vIFNoYWxsb3cgZHVwbGljYXRlOiBjcmVhdGUgbmV3IG5vZGUgd2l0aCBzYW1lIG5hbWUvcGFyZW50IGJ1dCBubyBjaGlsZHJlblxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZUluZm9SZXNwb25zZS5zdWNjZXNzIHx8ICFub2RlSW5mb1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdGYWlsZWQgdG8gZ2V0IG5vZGUgaW5mbyBmb3Igc2hhbGxvdyBkdXBsaWNhdGUnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBub2RlSW5mb1Jlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Tm9kZVV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbm9kZUluZm8ubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBub2RlSW5mby5wYXJlbnQgfHwgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3VXVpZCA9IEFycmF5LmlzQXJyYXkobmV3Tm9kZVV1aWQpID8gbmV3Tm9kZVV1aWRbMF0gOiBuZXdOb2RlVXVpZDtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5ld1V1aWQsIHNoYWxsb3c6IHRydWUgfSwgJ05vZGUgZHVwbGljYXRlZCAod2l0aG91dCBjaGlsZHJlbikgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2R1cGxpY2F0ZS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgbmV3VXVpZDogcmVzdWx0Py51dWlkID8/IHJlc3VsdCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnTm9kZSBkdXBsaWNhdGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZGV0ZWN0Tm9kZVR5cGUodXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249ZGV0ZWN0X3R5cGUnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlSW5mb1Jlc3BvbnNlLnN1Y2Nlc3MgfHwgIW5vZGVJbmZvUmVzcG9uc2UuZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCBub2RlIGluZm9ybWF0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gbm9kZUluZm9SZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgY29uc3QgaXMyRCA9IGlzMkROb2RlKG5vZGVJbmZvKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBub2RlSW5mby5jb21wb25lbnRzIHx8IFtdO1xuXG4gICAgICAgICAgICBjb25zdCBkZXRlY3Rpb25SZWFzb25zOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICAgICAgICBjb25zdCB0d29EQ29tcG9uZW50cyA9IGNvbXBvbmVudHMuZmlsdGVyKChjb21wOiBhbnkpID0+IGlzMkRDb21wb25lbnRUeXBlKGNvbXAudHlwZSkpO1xuXG4gICAgICAgICAgICBjb25zdCB0aHJlZURDb21wb25lbnRzID0gY29tcG9uZW50cy5maWx0ZXIoKGNvbXA6IGFueSkgPT4gaXMzRENvbXBvbmVudFR5cGUoY29tcC50eXBlKSk7XG5cbiAgICAgICAgICAgIGlmICh0d29EQ29tcG9uZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgZGV0ZWN0aW9uUmVhc29ucy5wdXNoKGBIYXMgMkQgY29tcG9uZW50czogJHt0d29EQ29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRocmVlRENvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaChgSGFzIDNEIGNvbXBvbmVudHM6ICR7dGhyZWVEQ29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBOb2RlIHBvc2l0aW9uIGlzIE5PVCB1c2VkIHRvIGluZmVyIDJELW5lc3M6IGEgM0Qgbm9kZSBsZWdpdGltYXRlbHkgc2l0c1xuICAgICAgICAgICAgLy8gYXQgdGhlIG9yaWdpbiAoeiA9IDApLiBBYnNlbnQgYSAyRC9VSSBjb21wb25lbnQsIHRoZSBub2RlIGlzIHRyZWF0ZWQgYXMgM0QuXG4gICAgICAgICAgICBpZiAodHdvRENvbXBvbmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgZGV0ZWN0aW9uUmVhc29ucy5wdXNoKCdObyAyRC9VSSBjb21wb25lbnQgZm91bmQ7IHRyZWF0ZWQgYXMgM0QgKGZ1bGwgeCwgeSwgeiB0cmFuc2Zvcm0pJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZDogdXVpZCxcbiAgICAgICAgICAgICAgICBub2RlTmFtZTogbm9kZUluZm8ubmFtZSxcbiAgICAgICAgICAgICAgICBub2RlVHlwZTogaXMyRCA/ICcyRCcgOiAnM0QnLFxuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogY29tcG9uZW50cy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC50eXBlLFxuICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogZ2V0Q29tcG9uZW50Q2F0ZWdvcnkoY29tcC50eXBlKVxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZUluZm8ucG9zaXRpb24sXG4gICAgICAgICAgICAgICAgdHJhbnNmb3JtQ29uc3RyYWludHM6IHtcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IGlzMkQgPyAneCwgeSBvbmx5ICh6IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IGlzMkQgPyAneiBvbmx5ICh4LCB5IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IGlzMkQgPyAneCwgeSBtYWluLCB6IHR5cGljYWxseSAxJyA6ICd4LCB5LCB6IGFsbCB1c2VkJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBkZXRlY3Qgbm9kZSB0eXBlOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG59XG4iXX0=