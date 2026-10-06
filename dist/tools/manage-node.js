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
            return (0, types_1.successResult)(Object.assign(Object.assign(Object.assign(Object.assign({ uuid, name: args.name, parentUuid: targetParentUuid, nodeType: args.nodeType || 'Node', fromAsset: !!finalAssetUuid, assetUuid: finalAssetUuid }, (resolvedFromModel ? { resolvedFromModelUuid: resolvedFromModel } : {})), (siblingOrder ? { siblingOrder } : {})), (siblingOrder && !siblingOrder.applied
                ? { warning: `siblingIndex ${siblingOrder.requested} was NOT applied (${siblingOrder.reason}); the node is the last child.` }
                : {})), { message: successMessage, verificationData }));
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to create node: ${err.message}. Args: ${JSON.stringify(args)}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLW5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUFrRjtBQUNsRixrREFBdUY7QUFDdkYsMkVBQW9GO0FBQ3BGLDJFQUEyRTtBQUMzRSxtRkFBK0s7QUFFL0ssc0ZBQXNGO0FBQ3RGLE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxDQUFDO0FBQ3BDLDBFQUEwRTtBQUMxRSxNQUFNLG1CQUFtQixHQUFHLEVBQUUsQ0FBQztBQUUvQixNQUFhLFVBQVcsU0FBUSxpQ0FBYztJQUE5Qzs7UUFFYSxTQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3JCLGdCQUFXLEdBQUcsNlhBQTZYLENBQUM7UUFDNVksWUFBTyxHQUFHLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ25KLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLENBQUM7b0JBQzlJLFdBQVcsRUFBRSx1WUFBdVk7aUJBQ3ZaO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUZBQW1GO2lCQUNuRztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDREQUE0RDtp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cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgTm9kZUluZm8sIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29lcmNlQm9vbCwgY29lcmNlSW50LCBjb2VyY2VGbG9hdCwgbm9ybWFsaXplVmVjMyB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5pbXBvcnQgeyBhcHBseVNpYmxpbmdJbmRleCwgU2libGluZ09yZGVyUmVzdWx0IH0gZnJvbSAnLi9tYW5hZ2Utbm9kZS1zaWJsaW5nLW9yZGVyJztcbmltcG9ydCB7IHJlc29sdmVJbnN0YW50aWFibGVBc3NldFV1aWQgfSBmcm9tICcuL21hbmFnZS1ub2RlLWFzc2V0LXJlc29sdmUnO1xuaW1wb3J0IHsgaXMyRE5vZGUsIGlzMkRDb21wb25lbnRUeXBlLCBpczNEQ29tcG9uZW50VHlwZSwgbm9ybWFsaXplVHJhbnNmb3JtVmFsdWUsIGdldENvbXBvbmVudENhdGVnb3J5LCBnZXROb2RlUGF0aCwgc2VhcmNoTm9kZUluVHJlZSB9IGZyb20gJy4vbWFuYWdlLW5vZGUtdHJhbnNmb3JtLWhlbHBlcnMnO1xuXG4vKiogTG9uZ2VzdCBgYXdhaXROb2RlQ29tbWl0YCB3YWl0cyBmb3IgYSBmcmVzaGx5IGNyZWF0ZWQgbm9kZSB0byBiZWNvbWUgcXVlcnlhYmxlLiAqL1xuY29uc3QgTk9ERV9DT01NSVRfVElNRU9VVF9NUyA9IDIwMDA7XG4vKiogR2FwIGJldHdlZW4gYHNjZW5lOnF1ZXJ5LW5vZGVgIHBvbGxzIHdoaWxlIHdhaXRpbmcgZm9yIHRoYXQgY29tbWl0LiAqL1xuY29uc3QgTk9ERV9DT01NSVRfUE9MTF9NUyA9IDIwO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlTm9kZSBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcblxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX25vZGUnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBub2RlcyBpbiB0aGUgY3VycmVudCBzY2VuZS4gQWN0aW9uczogY3JlYXRlLCBnZXRfaW5mbywgZmluZCwgZmluZF9ieV9uYW1lLCBnZXRfYWxsLCBzZXRfcHJvcGVydHksIHNldF90cmFuc2Zvcm0sIGRlbGV0ZSwgbW92ZSwgZHVwbGljYXRlLCBkZXRlY3RfdHlwZS4gTk9UIGZvciBjb21wb25lbnRzIOKAlCB1c2UgbWFuYWdlX2NvbXBvbmVudC4gTk9UIGZvciBwcmVmYWJzIOKAlCB1c2UgbWFuYWdlX3ByZWZhYi4gUHJlcmVxdWlzaXRlczogc2NlbmUgbXVzdCBiZSBvcGVuICh2ZXJpZnkgd2l0aCBtYW5hZ2Vfc2NlbmUgYWN0aW9uPWdldF9jdXJyZW50KS4gVG8gZmluZCBub2RlIFVVSURzOiB1c2UgYWN0aW9uPWZpbmQgb3IgYWN0aW9uPWdldF9hbGwgZmlyc3QuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjcmVhdGUnLCAnZ2V0X2luZm8nLCAnZmluZCcsICdmaW5kX2J5X25hbWUnLCAnZ2V0X2FsbCcsICdzZXRfcHJvcGVydHknLCAnc2V0X3RyYW5zZm9ybScsICdkZWxldGUnLCAnbW92ZScsICdkdXBsaWNhdGUnLCAnZGV0ZWN0X3R5cGUnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ2ZpbmQnLCAnZmluZF9ieV9uYW1lJywgJ2dldF9hbGwnLCAnc2V0X3Byb3BlcnR5JywgJ3NldF90cmFuc2Zvcm0nLCAnZGVsZXRlJywgJ21vdmUnLCAnZHVwbGljYXRlJywgJ2RldGVjdF90eXBlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlPWNyZWF0ZSBuZXcgbm9kZSBpbiBzY2VuZSwgZ2V0X2luZm89Z2V0IG5vZGUgZGV0YWlscyBieSBVVUlELCBmaW5kPXNlYXJjaCBub2RlcyBieSBuYW1lIHBhdHRlcm4sIGZpbmRfYnlfbmFtZT1maW5kIGZpcnN0IG5vZGUgYnkgZXhhY3QgbmFtZSwgZ2V0X2FsbD1saXN0IGFsbCBub2RlcyB3aXRoIFVVSURzLCBzZXRfcHJvcGVydHk9c2V0IGEgbm9kZSBwcm9wZXJ0eSwgc2V0X3RyYW5zZm9ybT1zZXQgcG9zaXRpb24vcm90YXRpb24vc2NhbGUsIGRlbGV0ZT1yZW1vdmUgbm9kZSBmcm9tIHNjZW5lLCBtb3ZlPXJlcGFyZW50IG5vZGUsIGR1cGxpY2F0ZT1jbG9uZSBub2RlLCBkZXRlY3RfdHlwZT1kZXRlY3QgaWYgbm9kZSBpcyAyRCBvciAzRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1dWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2luZm8sIHNldF9wcm9wZXJ0eSwgc2V0X3RyYW5zZm9ybSwgZGVsZXRlLCBkdXBsaWNhdGUsIGRldGVjdF90eXBlXSBOb2RlIFVVSUQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gTm9kZSBuYW1lLiBbZmluZF9ieV9uYW1lXSBFeGFjdCBub2RlIG5hbWUgdG8gZmluZCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXJlbnRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBQYXJlbnQgbm9kZSBVVUlELiBTVFJPTkdMWSBSRUNPTU1FTkRFRC4gVXNlIGdldF9hbGwgdG8gZmluZCBwYXJlbnQgVVVJRHMuIElmIG9taXR0ZWQsIG5vZGUgaXMgY3JlYXRlZCBhdCBzY2VuZSByb290LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnTm9kZScsICcyRE5vZGUnLCAnM0ROb2RlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBOb2RlIHR5cGU6IE5vZGUsIDJETm9kZSwgM0ROb2RlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnTm9kZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzaWJsaW5nSW5kZXg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGUsIG1vdmVdIFNpYmxpbmcgaW5kZXggZm9yIG9yZGVyaW5nICgtMSBtZWFucyBhcHBlbmQgYXQgZW5kKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogLTFcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEFzc2V0IFVVSUQgdG8gaW5zdGFudGlhdGUgZnJvbSAoZS5nLiwgcHJlZmFiIFVVSUQpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzc2V0UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gQXNzZXQgcGF0aCB0byBpbnN0YW50aWF0ZSBmcm9tIChlLmcuLCBcImRiOi8vYXNzZXRzL3ByZWZhYnMvTXlQcmVmYWIucHJlZmFiXCIpLiBBbHRlcm5hdGl2ZSB0byBhc3NldFV1aWQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbXBvbmVudHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBBcnJheSBvZiBjb21wb25lbnQgdHlwZSBuYW1lcyB0byBhZGQgKGUuZy4sIFtcImNjLlNwcml0ZVwiLCBcImNjLkJ1dHRvblwiXSknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5saW5rUHJlZmFiOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gSWYgdHJ1ZSBhbmQgY3JlYXRpbmcgZnJvbSBwcmVmYWIsIHVubGluayBmcm9tIHByZWZhYiB0byBjcmVhdGUgYSByZWd1bGFyIG5vZGUnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZSwgbW92ZV0gV2hldGhlciB0byBrZWVwIHdvcmxkIHRyYW5zZm9ybScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsVHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB4OiB7IHR5cGU6ICdudW1iZXInIH0sIHk6IHsgdHlwZTogJ251bWJlcicgfSwgejogeyB0eXBlOiAnbnVtYmVyJyB9IH0gfSxcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgeDogeyB0eXBlOiAnbnVtYmVyJyB9LCB5OiB7IHR5cGU6ICdudW1iZXInIH0sIHo6IHsgdHlwZTogJ251bWJlcicgfSB9IH0sXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHg6IHsgdHlwZTogJ251bWJlcicgfSwgeTogeyB0eXBlOiAnbnVtYmVyJyB9LCB6OiB7IHR5cGU6ICdudW1iZXInIH0gfSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEluaXRpYWwgdHJhbnNmb3JtIHRvIGFwcGx5IGFmdGVyIGNyZWF0aW9uJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdHRlcm46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tmaW5kXSBOYW1lIHBhdHRlcm4gdG8gc2VhcmNoIGZvcidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBleGFjdE1hdGNoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2ZpbmRdIFVzZSBleGFjdCBtYXRjaCBpbnN0ZWFkIG9mIHBhcnRpYWwgbWF0Y2gnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IG5hbWUgKGUuZy4sIGFjdGl2ZSwgbmFtZSwgbGF5ZXIpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB2YWx1ZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2Jvb2xlYW4nLCAnbnVtYmVyJywgJ3N0cmluZyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIltzZXRfcHJvcGVydHldIE9wdGlvbmFsIHZhbHVlLXR5cGUgaGludCwgaG9ub3VyZWQgdGhlIHNhbWUgd2F5IG1hbmFnZV9jb21wb25lbnQgc2V0X3Byb3BlcnR5IGRvZXMuICdhY3RpdmUnIGlzIGNvZXJjZWQgYXMgYm9vbGVhbiBhdXRvbWF0aWNhbGx5IGV2ZW4gd2hlbiBvbWl0dGVkOyBwYXNzICdib29sZWFuJyBleHBsaWNpdGx5IGZvciBhbnkgb3RoZXIgYm9vbGVhbiBub2RlIHByb3BlcnR5IHRvIGF2b2lkIGEgdHJ1dGh5LXN0cmluZyBuby1vcCAoZS5nLiB2YWx1ZT1cXFwiZmFsc2VcXFwiIG92ZXIgYSB0cmFuc3BvcnQgdGhhdCBzdHJpbmdpZmllcyBhcmdzKS5cIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdaIGNvb3JkaW5hdGUgKGlnbm9yZWQgZm9yIDJEIG5vZGVzKScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RyYW5zZm9ybV0gTm9kZSBwb3NpdGlvbi4gRm9yIDJEIG5vZGVzLCBvbmx5IHgseSBhcmUgdXNlZC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm90YXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnSWdub3JlZCBmb3IgMkQgbm9kZXMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnSWdub3JlZCBmb3IgMkQgbm9kZXMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnTWFpbiByb3RhdGlvbiBheGlzIGZvciAyRCBub2RlcycgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RyYW5zZm9ybV0gTm9kZSByb3RhdGlvbiBpbiBldWxlciBhbmdsZXMuIEZvciAyRCBub2Rlcywgb25seSB6IGlzIHVzZWQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdVc3VhbGx5IDEgZm9yIDJEIG5vZGVzJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfdHJhbnNmb3JtXSBOb2RlIHNjYWxlLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW21vdmVdIE5vZGUgVVVJRCB0byBtb3ZlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5ld1BhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ttb3ZlXSBOZXcgcGFyZW50IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZHVwbGljYXRlXSBJbmNsdWRlIGNoaWxkcmVuIG5vZGVzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmNyZWF0ZU5vZGUoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXROb2RlSW5mbyhhcmdzLnV1aWQpLFxuICAgICAgICBmaW5kOiAoYXJncykgPT4gdGhpcy5maW5kTm9kZXMoYXJncy5wYXR0ZXJuLCBjb2VyY2VCb29sKGFyZ3MuZXhhY3RNYXRjaCkgPz8gZmFsc2UpLFxuICAgICAgICBmaW5kX2J5X25hbWU6IChhcmdzKSA9PiB0aGlzLmZpbmROb2RlQnlOYW1lKGFyZ3MubmFtZSksXG4gICAgICAgIGdldF9hbGw6ICgpID0+IHRoaXMuZ2V0QWxsTm9kZXMoKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXROb2RlUHJvcGVydHkoYXJncy51dWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlLCBhcmdzLnByb3BlcnR5VHlwZSksXG4gICAgICAgIHNldF90cmFuc2Zvcm06IChhcmdzKSA9PiB0aGlzLnNldE5vZGVUcmFuc2Zvcm0oYXJncyksXG4gICAgICAgIGRlbGV0ZTogKGFyZ3MpID0+IHRoaXMuZGVsZXRlTm9kZShhcmdzLnV1aWQpLFxuICAgICAgICBtb3ZlOiAoYXJncykgPT4gdGhpcy5tb3ZlTm9kZShhcmdzLm5vZGVVdWlkLCBhcmdzLm5ld1BhcmVudFV1aWQsIGNvZXJjZUludChhcmdzLnNpYmxpbmdJbmRleCkgPz8gLTEsIGNvZXJjZUJvb2woYXJncy5rZWVwV29ybGRUcmFuc2Zvcm0pID8/IGZhbHNlKSxcbiAgICAgICAgZHVwbGljYXRlOiAoYXJncykgPT4gdGhpcy5kdXBsaWNhdGVOb2RlKGFyZ3MudXVpZCwgY29lcmNlQm9vbChhcmdzLmluY2x1ZGVDaGlsZHJlbikgPz8gdHJ1ZSksXG4gICAgICAgIGRldGVjdF90eXBlOiAoYXJncykgPT4gdGhpcy5kZXRlY3ROb2RlVHlwZShhcmdzLnV1aWQpXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlTm9kZShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCB0YXJnZXRQYXJlbnRVdWlkID0gYXJncy5wYXJlbnRVdWlkO1xuXG4gICAgICAgICAgICBpZiAoIXRhcmdldFBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzY2VuZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjZW5lSW5mbyAmJiB0eXBlb2Ygc2NlbmVJbmZvID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShzY2VuZUluZm8pICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzY2VuZUluZm8sICd1dWlkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFBhcmVudFV1aWQgPSAoc2NlbmVJbmZvIGFzIGFueSkudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBObyBwYXJlbnQgc3BlY2lmaWVkLCB1c2luZyBzY2VuZSByb290OiAke3RhcmdldFBhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShzY2VuZUluZm8pICYmIHNjZW5lSW5mby5sZW5ndGggPiAwICYmIHNjZW5lSW5mb1swXS51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRQYXJlbnRVdWlkID0gc2NlbmVJbmZvWzBdLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTm8gcGFyZW50IHNwZWNpZmllZCwgdXNpbmcgc2NlbmUgcm9vdDogJHt0YXJnZXRQYXJlbnRVdWlkfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFNjZW5lID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktY3VycmVudC1zY2VuZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRTY2VuZSAmJiBjdXJyZW50U2NlbmUudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFBhcmVudFV1aWQgPSBjdXJyZW50U2NlbmUudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBnZXQgc2NlbmUgcm9vdCwgd2lsbCB1c2UgZGVmYXVsdCBiZWhhdmlvcicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGZpbmFsQXNzZXRVdWlkID0gYXJncy5hc3NldFV1aWQ7XG4gICAgICAgICAgICBsZXQgYXNzZXRUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICBsZXQgcGF0aEluZm86IGFueTtcbiAgICAgICAgICAgIGlmIChhcmdzLmFzc2V0UGF0aCAmJiAhZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy5hc3NldFBhdGgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIGFzc2V0SW5mby51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5hbEFzc2V0VXVpZCA9IGFzc2V0SW5mby51dWlkO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRUeXBlID0gYXNzZXRJbmZvLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoSW5mbyA9IGFzc2V0SW5mbztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBBc3NldCBwYXRoICcke2FyZ3MuYXNzZXRQYXRofScgcmVzb2x2ZWQgdG8gVVVJRDogJHtmaW5hbEFzc2V0VXVpZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQXNzZXQgbm90IGZvdW5kIGF0IHBhdGg6ICR7YXJncy5hc3NldFBhdGh9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVzb2x2ZSBhc3NldCBwYXRoICcke2FyZ3MuYXNzZXRQYXRofSc6ICR7ZXJyfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQSByYXcgbW9kZWwgYXNzZXQgKC5mYngvLmdsdGYpIGlzIG5vdCBpbnN0YW50aWFibGU7IHJlZGlyZWN0IGl0IHRvIGl0c1xuICAgICAgICAgICAgLy8gYGdsdGYtc2NlbmVgIHN1Yi1hc3NldCBpbnN0ZWFkIG9mIGNyZWF0aW5nIGFuIGVtcHR5IG5vZGUgKGlzc3VlICMxMTcpLlxuICAgICAgICAgICAgbGV0IHJlc29sdmVkRnJvbU1vZGVsOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVJbnN0YW50aWFibGVBc3NldFV1aWQoZmluYWxBc3NldFV1aWQsIHBhdGhJbmZvKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzb2x2ZWQucmVzb2x2ZWRGcm9tKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVkRnJvbU1vZGVsID0gcmVzb2x2ZWQucmVzb2x2ZWRGcm9tO1xuICAgICAgICAgICAgICAgICAgICBmaW5hbEFzc2V0VXVpZCA9IHJlc29sdmVkLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSA9IHVuZGVmaW5lZDsgLy8gcmUtcmVzb2x2ZWQgYmVsb3cgZm9yIHRoZSBzdWItYXNzZXRcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFhc3NldFR5cGUgJiYgcmVzb2x2ZWQuaW5mbz8udHlwZSkge1xuICAgICAgICAgICAgICAgICAgICBhc3NldFR5cGUgPSByZXNvbHZlZC5pbmZvLnR5cGU7IC8vIHJldXNlIHRoZSBsb29rdXAgaW5zdGVhZCBvZiByZXBlYXRpbmcgaXRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZU5vZGVPcHRpb25zOiBhbnkgPSB7IG5hbWU6IGFyZ3MubmFtZSB9O1xuXG4gICAgICAgICAgICBpZiAodGFyZ2V0UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLnBhcmVudCA9IHRhcmdldFBhcmVudFV1aWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChmaW5hbEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLmFzc2V0VXVpZCA9IGZpbmFsQXNzZXRVdWlkO1xuXG4gICAgICAgICAgICAgICAgLy8gYHR5cGVgIHNlbGVjdHMgdGhlIGNyZWF0ZU5vZGVGcm9tQXNzZXQoKSBicmFuY2ggdGhhdCBpbnN0YW50aWF0ZXMgYVxuICAgICAgICAgICAgICAgIC8vIGxpbmtlZCBpbnN0YW5jZSAoZS5nLiBhIHByZWZhYidzIGNjLlByZWZhYkluZm8vUHJlZmFiSW5zdGFuY2UpLiBXaXRob3V0XG4gICAgICAgICAgICAgICAgLy8gaXQsIDMuOC43J3Mgbm9kZSBtYW5hZ2VyIGZhbGxzIGJhY2sgdG8gYSBwbGFpbiBub2RlIGJ1aWx0IGZyb20gdGhlXG4gICAgICAgICAgICAgICAgLy8gYXNzZXQncyByYXcgZHVtcCDigJQgYSBmbGF0dGVuZWQsIHVubGlua2VkIGNvcHkgdGhhdCByZXBvcnRzIHN1Y2Nlc3NcbiAgICAgICAgICAgICAgICAvLyBidXQgY2FycmllcyBubyBwcmVmYWIgbGluay4gUmVzb2x2ZSBpdCB3aGVuIG5vdCBhbHJlYWR5IGtub3duIGZyb20gdGhlXG4gICAgICAgICAgICAgICAgLy8gYXNzZXRQYXRoIGxvb2t1cCBhYm92ZS5cbiAgICAgICAgICAgICAgICBpZiAoIWFzc2V0VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBmaW5hbEFzc2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFR5cGUgPSBpbmZvPy50eXBlO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIHJlc29sdmUgYXNzZXQgdHlwZSBmb3IgJyR7ZmluYWxBc3NldFV1aWR9JzpgLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChhc3NldFR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMudHlwZSA9IGFzc2V0VHlwZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoY29lcmNlQm9vbChhcmdzLnVubGlua1ByZWZhYikpIHtcbiAgICAgICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMudW5saW5rUHJlZmFiID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhcmdzLmNvbXBvbmVudHMgJiYgYXJncy5jb21wb25lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5jb21wb25lbnRzID0gYXJncy5jb21wb25lbnRzO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhcmdzLm5vZGVUeXBlICYmIGFyZ3Mubm9kZVR5cGUgIT09ICdOb2RlJyAmJiAhZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5jb21wb25lbnRzID0gW2FyZ3Mubm9kZVR5cGVdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY29lcmNlQm9vbChhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybSkpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5rZWVwV29ybGRUcmFuc2Zvcm0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzaWJsaW5nSW5kZXggPSBjb2VyY2VJbnQoYXJncy5zaWJsaW5nSW5kZXgpO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ3JlYXRpbmcgbm9kZSB3aXRoIG9wdGlvbnM6JywgY3JlYXRlTm9kZU9wdGlvbnMpO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgY3JlYXRlTm9kZU9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IEFycmF5LmlzQXJyYXkobm9kZVV1aWQpID8gbm9kZVV1aWRbMF0gOiBub2RlVXVpZDtcblxuICAgICAgICAgICAgLy8gYHNldC1wYXJlbnRgIGFwcGVuZHMsIHNvIGhvbm91cmluZyBzaWJsaW5nSW5kZXggbmVlZHMgYW4gZXhwbGljaXQgcmVvcmRlciwgYW5kXG4gICAgICAgICAgICAvLyB0aGUgb3V0Y29tZSBpcyByZXBvcnRlZCByYXRoZXIgdGhhbiBhc3N1bWVkIChpc3N1ZSAjOTkgaXRlbSAyKS5cbiAgICAgICAgICAgIGxldCBzaWJsaW5nT3JkZXI6IChTaWJsaW5nT3JkZXJSZXN1bHQgJiB7IHJlcXVlc3RlZDogbnVtYmVyIH0pIHwgdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKHNpYmxpbmdJbmRleCAhPT0gdW5kZWZpbmVkICYmIHNpYmxpbmdJbmRleCA+PSAwICYmIHV1aWQgJiYgdGFyZ2V0UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXdhaXROb2RlQ29tbWl0KHV1aWQpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBhd2FpdCBub2RlIGNvbW1pdCBiZWZvcmUgc2libGluZyBvcmRlcmluZzonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBzaWJsaW5nT3JkZXIgPSB7IHJlcXVlc3RlZDogc2libGluZ0luZGV4LCAuLi4oYXdhaXQgYXBwbHlTaWJsaW5nSW5kZXgodGFyZ2V0UGFyZW50VXVpZCwgdXVpZCwgc2libGluZ0luZGV4KSkgfTtcbiAgICAgICAgICAgICAgICBpZiAoIXNpYmxpbmdPcmRlci5hcHBsaWVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybihgc2libGluZ0luZGV4ICR7c2libGluZ0luZGV4fSB3YXMgbm90IGFwcGxpZWQ6ICR7c2libGluZ09yZGVyLnJlYXNvbn1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhcmdzLmNvbXBvbmVudHMgJiYgYXJncy5jb21wb25lbnRzLmxlbmd0aCA+IDAgJiYgdXVpZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXdhaXROb2RlQ29tbWl0KHV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudFR5cGUgb2YgYXJncy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50VHlwZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSBhZGRlZCBzdWNjZXNzZnVsbHlgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGFkZCBjb21wb25lbnQgJHtjb21wb25lbnRUeXBlfTpgLCBlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGFkZCBjb21wb25lbnRzOicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXJncy5pbml0aWFsVHJhbnNmb3JtICYmIHV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmF3YWl0Tm9kZUNvbW1pdCh1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zID0gbm9ybWFsaXplVmVjMyhhcmdzLmluaXRpYWxUcmFuc2Zvcm0ucG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCByb3QgPSBub3JtYWxpemVWZWMzKGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5yb3RhdGlvbik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNjbCA9IG5vcm1hbGl6ZVZlYzMoYXJncy5pbml0aWFsVHJhbnNmb3JtLnNjYWxlKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXROb2RlVHJhbnNmb3JtKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogcG9zID8/IGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5wb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiByb3QgPz8gYXJncy5pbml0aWFsVHJhbnNmb3JtLnJvdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGU6IHNjbCA/PyBhcmdzLmluaXRpYWxUcmFuc2Zvcm0uc2NhbGVcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJbml0aWFsIHRyYW5zZm9ybSBhcHBsaWVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBzZXQgaW5pdGlhbCB0cmFuc2Zvcm06JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB2ZXJpZmljYXRpb25EYXRhOiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8odXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVJbmZvLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uRGF0YSA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVJbmZvOiBub2RlSW5mby5kYXRhLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRpb25EZXRhaWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZDogdGFyZ2V0UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBub2RlVHlwZTogYXJncy5ub2RlVHlwZSB8fCAnTm9kZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbUFzc2V0OiAhIWZpbmFsQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogZmluYWxBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRQYXRoOiBhcmdzLmFzc2V0UGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIGdldCB2ZXJpZmljYXRpb24gZGF0YTonLCBlcnIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzTWVzc2FnZSA9IGZpbmFsQXNzZXRVdWlkXG4gICAgICAgICAgICAgICAgPyBgTm9kZSAnJHthcmdzLm5hbWV9JyBpbnN0YW50aWF0ZWQgZnJvbSBhc3NldCBzdWNjZXNzZnVsbHlgXG4gICAgICAgICAgICAgICAgOiBgTm9kZSAnJHthcmdzLm5hbWV9JyBjcmVhdGVkIHN1Y2Nlc3NmdWxseWA7XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IGFyZ3MubmFtZSxcbiAgICAgICAgICAgICAgICBwYXJlbnRVdWlkOiB0YXJnZXRQYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgIG5vZGVUeXBlOiBhcmdzLm5vZGVUeXBlIHx8ICdOb2RlJyxcbiAgICAgICAgICAgICAgICBmcm9tQXNzZXQ6ICEhZmluYWxBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiBmaW5hbEFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAuLi4ocmVzb2x2ZWRGcm9tTW9kZWwgPyB7IHJlc29sdmVkRnJvbU1vZGVsVXVpZDogcmVzb2x2ZWRGcm9tTW9kZWwgfSA6IHt9KSxcbiAgICAgICAgICAgICAgICAuLi4oc2libGluZ09yZGVyID8geyBzaWJsaW5nT3JkZXIgfSA6IHt9KSxcbiAgICAgICAgICAgICAgICAuLi4oc2libGluZ09yZGVyICYmICFzaWJsaW5nT3JkZXIuYXBwbGllZFxuICAgICAgICAgICAgICAgICAgICA/IHsgd2FybmluZzogYHNpYmxpbmdJbmRleCAke3NpYmxpbmdPcmRlci5yZXF1ZXN0ZWR9IHdhcyBOT1QgYXBwbGllZCAoJHtzaWJsaW5nT3JkZXIucmVhc29ufSk7IHRoZSBub2RlIGlzIHRoZSBsYXN0IGNoaWxkLmAgfVxuICAgICAgICAgICAgICAgICAgICA6IHt9KSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBzdWNjZXNzTWVzc2FnZSxcbiAgICAgICAgICAgICAgICB2ZXJpZmljYXRpb25EYXRhXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gY3JlYXRlIG5vZGU6ICR7ZXJyLm1lc3NhZ2V9LiBBcmdzOiAke0pTT04uc3RyaW5naWZ5KGFyZ3MpfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYHNjZW5lOmNyZWF0ZS1ub2RlYCByZXNvbHZlcyBiZWZvcmUgdGhlIG5ldyBub2RlIGlzIHF1ZXJ5YWJsZSwgc28gdGhlIGZvbGxvdy11cFxuICAgICAqIHNldC1wYXJlbnQgLyBjcmVhdGUtY29tcG9uZW50IC8gaW5pdGlhbC10cmFuc2Zvcm0gc3RlcHMgdXNlZCB0byB3YWl0IG91dCBhIGZpeGVkXG4gICAgICogMTAwLTE1MG1zIHNsZWVwIGFuZCB0aGVuIHByb2NlZWQgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBjb21taXQgaGFkIGxhbmRlZC4gT24gYVxuICAgICAqIGJ1c3kgZWRpdG9yIGl0IGhhZCBub3QsIGFuZCB0aG9zZSBlZGl0cyB3ZXJlIHNpbGVudGx5IGRyb3BwZWQgZnJvbSB0aGUgY3JlYXRlZCBub2RlXG4gICAgICogKCM2KS4gUG9sbCBgc2NlbmU6cXVlcnktbm9kZWAgaW5zdGVhZDogY29udGludWUgYXMgc29vbiBhcyB0aGUgbm9kZSBpcyBhY3R1YWxseVxuICAgICAqIHZpc2libGUsIGFuZCB0aHJvdyB3aGVuIGl0IG5ldmVyIGJlY29tZXMgdmlzaWJsZSBzbyB0aGUgY2FsbGVyJ3MgZXhpc3RpbmcgY2F0Y2hcbiAgICAgKiByZXBvcnRzIGEgcmVhbCByZWFzb24gcmF0aGVyIHRoYW4gYSBibGluZCBmYWlsdXJlIGZ1cnRoZXIgZG93bi5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGF3YWl0Tm9kZUNvbW1pdCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgTk9ERV9DT01NSVRfVElNRU9VVF9NUztcbiAgICAgICAgZm9yICg7Oykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YSkgcmV0dXJuO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgLy8gcXVlcnktbm9kZSByZWplY3RzIHdoaWxlIHRoZSBub2RlIGlzIG5vdCB5ZXQgaW4gdGhlIGdyYXBoIOKAlCBrZWVwIHBvbGxpbmcuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoRGF0ZS5ub3coKSA+PSBkZWFkbGluZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSAnJHt1dWlkfScgd2FzIG5vdCBxdWVyeWFibGUgd2l0aGluICR7Tk9ERV9DT01NSVRfVElNRU9VVF9NU31tcyBvZiBjcmVhdGlvbmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIE5PREVfQ09NTUlUX1BPTExfTVMpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Tm9kZUluZm8odXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBpbnZhbGlkIHJlc3BvbnNlJyk7XG4gICAgICAgICAgICBjb25zdCBpbmZvOiBOb2RlSW5mbyA9IHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlRGF0YS51dWlkPy52YWx1ZSB8fCB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IG5vZGVEYXRhLm5hbWU/LnZhbHVlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGVEYXRhLmFjdGl2ZT8udmFsdWUgIT09IHVuZGVmaW5lZCA/IG5vZGVEYXRhLmFjdGl2ZS52YWx1ZSA6IHRydWUsXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZSB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgICAgICAgICByb3RhdGlvbjogbm9kZURhdGEucm90YXRpb24/LnZhbHVlIHx8IHsgeDogMCwgeTogMCwgejogMCB9LFxuICAgICAgICAgICAgICAgIHNjYWxlOiBub2RlRGF0YS5zY2FsZT8udmFsdWUgfHwgeyB4OiAxLCB5OiAxLCB6OiAxIH0sXG4gICAgICAgICAgICAgICAgcGFyZW50OiBub2RlRGF0YS5wYXJlbnQ/LnZhbHVlPy51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgY2hpbGRyZW46IG5vZGVEYXRhLmNoaWxkcmVuIHx8IFtdLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IChub2RlRGF0YS5fX2NvbXBzX18gfHwgW10pLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wLmVuYWJsZWQgOiB0cnVlXG4gICAgICAgICAgICAgICAgfSkpLFxuICAgICAgICAgICAgICAgIGxheWVyOiBub2RlRGF0YS5sYXllcj8udmFsdWUgfHwgMTA3Mzc0MTgyNCxcbiAgICAgICAgICAgICAgICBtb2JpbGl0eTogbm9kZURhdGEubW9iaWxpdHk/LnZhbHVlIHx8IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZpbmROb2RlcyhwYXR0ZXJuOiBzdHJpbmcsIGV4YWN0TWF0Y2g6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXBhdHRlcm4pIHJldHVybiBlcnJvclJlc3VsdCgncGF0dGVybiBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWZpbmQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBzZWFyY2hUcmVlID0gKG5vZGU6IGFueSwgY3VycmVudFBhdGg6IHN0cmluZyA9ICcnKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZVBhdGggPSBjdXJyZW50UGF0aCA/IGAke2N1cnJlbnRQYXRofS8ke25vZGUubmFtZX1gIDogbm9kZS5uYW1lO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZXMgPSBleGFjdE1hdGNoXG4gICAgICAgICAgICAgICAgICAgID8gbm9kZS5uYW1lID09PSBwYXR0ZXJuXG4gICAgICAgICAgICAgICAgICAgIDogbm9kZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocGF0dGVybi50b0xvd2VyQ2FzZSgpKTtcbiAgICAgICAgICAgICAgICBpZiAobWF0Y2hlcykgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCBwYXRoOiBub2RlUGF0aCB9KTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHNlYXJjaFRyZWUoY2hpbGQsIG5vZGVQYXRoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHRyZWUpIHNlYXJjaFRyZWUodHJlZSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChub2Rlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZmluZE5vZGVzJywgYXJnczogW3BhdHRlcm4sIGV4YWN0TWF0Y2hdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBUcmVlIHNlYXJjaCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZmluZE5vZGVCeU5hbWUobmFtZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCduYW1lIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249ZmluZF9ieV9uYW1lJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kTm9kZSA9IHNlYXJjaE5vZGVJblRyZWUodHJlZSwgbmFtZSk7XG4gICAgICAgICAgICBpZiAoZm91bmROb2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1dWlkOiBmb3VuZE5vZGUudXVpZCwgbmFtZTogZm91bmROb2RlLm5hbWUsIHBhdGg6IGdldE5vZGVQYXRoKGZvdW5kTm9kZSkgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYE5vZGUgJyR7bmFtZX0nIG5vdCBmb3VuZGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2ZpbmROb2RlQnlOYW1lJywgYXJnczogW25hbWVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBbGxOb2RlcygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCB0cmF2ZXJzZVRyZWUgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCB0eXBlOiBub2RlLnR5cGUsIGFjdGl2ZTogbm9kZS5hY3RpdmUsIHBhdGg6IGdldE5vZGVQYXRoKG5vZGUpIH0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikgdHJhdmVyc2VUcmVlKGNoaWxkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgaWYgKHRyZWUgJiYgdHJlZS5jaGlsZHJlbikgdHJhdmVyc2VUcmVlKHRyZWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0b3RhbE5vZGVzOiBub2Rlcy5sZW5ndGgsIG5vZGVzIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldEFsbE5vZGVzJywgYXJnczogW11cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogTm9kZSBwcm9wZXJ0aWVzIHRoYXQgbXVzdCBiZSB0cmVhdGVkIGFzIGJvb2xlYW4gZXZlbiB3aGVuIHByb3BlcnR5VHlwZSBpcyBvbWl0dGVkLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEtOT1dOX0JPT0xFQU5fTk9ERV9QUk9QRVJUSUVTID0gbmV3IFNldChbJ2FjdGl2ZSddKTtcblxuICAgIC8qKlxuICAgICAqIENvZXJjZSBhIHNldF9wcm9wZXJ0eSB2YWx1ZSBieSB0aGUgcmVxdWVzdGVkIChvciBpbmZlcnJlZCkgcHJvcGVydHlUeXBlLlxuICAgICAqIFRocm93cyBvbiBhIHZhbHVlIHRoYXQgY2Fubm90IGJlIGNvZXJjZWQsIHNvIHRoZSBjYWxsZXIgcmV0dXJucyBlcnJvclJlc3VsdFxuICAgICAqIGluc3RlYWQgb2Ygc2lsZW50bHkgZm9yd2FyZGluZyBhIHZhbHVlIHRoZSBlbmdpbmUgd2lsbCBtaXNpbnRlcnByZXQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBjb2VyY2VOb2RlUHJvcGVydHlWYWx1ZShwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55LCBwcm9wZXJ0eVR5cGU/OiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBjb25zdCBlZmZlY3RpdmVUeXBlID0gcHJvcGVydHlUeXBlXG4gICAgICAgICAgICB8fCAoTWFuYWdlTm9kZS5LTk9XTl9CT09MRUFOX05PREVfUFJPUEVSVElFUy5oYXMocHJvcGVydHkpID8gJ2Jvb2xlYW4nIDogdW5kZWZpbmVkKTtcblxuICAgICAgICBpZiAoZWZmZWN0aXZlVHlwZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gY29lcmNlQm9vbCh2YWx1ZSk7XG4gICAgICAgICAgICBpZiAoY29lcmNlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGV4cGVjdHMgYSBib29sZWFuIHZhbHVlICh0cnVlL2ZhbHNlLzEvMC9cInRydWVcIi9cImZhbHNlXCIpLCByZWNlaXZlZDogJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY29lcmNlZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZWZmZWN0aXZlVHlwZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBjb2VyY2VGbG9hdCh2YWx1ZSk7XG4gICAgICAgICAgICBpZiAoY29lcmNlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGV4cGVjdHMgYSBudW1lcmljIHZhbHVlLCByZWNlaXZlZDogJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gY29lcmNlZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVhZCBhIG5vZGUgcHJvcGVydHkgYmFjayBmcm9tIHRoZSBsaXZlIHNjZW5lIGZvciBzZXRfcHJvcGVydHkgdmVyaWZpY2F0aW9uLlxuICAgICAqIE9ubHkgcmVzb2x2ZXMgdG9wLWxldmVsIGR1bXAgZW50cmllcyAoYWN0aXZlLCBuYW1lLCBsYXllciwgbW9iaWxpdHksIC4uLikg4oCUIHRoZVxuICAgICAqIHByb3BlcnRpZXMgc2V0X3Byb3BlcnR5IGFjdHVhbGx5IGRvY3VtZW50cy4gYGZvdW5kOiBmYWxzZWAgbWVhbnMgdGhlIHBhdGggY291bGRcbiAgICAgKiBub3QgYmUgcmVzb2x2ZWQgdGhpcyB3YXkgKGUuZy4gYSBuZXN0ZWQgcHJvcGVydHkpLCBOT1QgdGhhdCB0aGUgd3JpdGUgZmFpbGVkLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVhZE5vZGVQcm9wZXJ0eSh1dWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcpOiBQcm9taXNlPHsgZm91bmQ6IGJvb2xlYW47IHZhbHVlOiBhbnkgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gbm9kZURhdGEgPyBub2RlRGF0YVtwcm9wZXJ0eV0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZW50cnkgJiYgdHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIGVudHJ5KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgZm91bmQ6IHRydWUsIHZhbHVlOiBlbnRyeS52YWx1ZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2YWx1ZTogdW5kZWZpbmVkIH07XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIHsgZm91bmQ6IGZhbHNlLCB2YWx1ZTogdW5kZWZpbmVkIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldE5vZGVQcm9wZXJ0eSh1dWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnksIHByb3BlcnR5VHlwZT86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQgfHwgIXByb3BlcnR5IHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCwgcHJvcGVydHksIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1zZXRfcHJvcGVydHknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElzc3VlICM0NzogYSBib29sZWFuIG5vZGUgcHJvcGVydHkgKGFjdGl2ZSwgLi4uKSBzZW50IHRocm91Z2ggYW55IHRyYW5zcG9ydFxuICAgICAgICAvLyB0aGF0IHN0cmluZ2lmaWVzIGFyZ3MgYXJyaXZlcyBhcyBgXCJmYWxzZVwiYCDigJQgYSBUUlVUSFkgc3RyaW5nIOKAlCBzb1xuICAgICAgICAvLyBgbm9kZS5hY3RpdmUgPSBcImZhbHNlXCJgIHNpbGVudGx5IGxlYXZlcyB0aGUgbm9kZSBhY3RpdmUuIENvZXJjZSBieSBhbiBleHBsaWNpdFxuICAgICAgICAvLyBwcm9wZXJ0eVR5cGUsIG9yIGJ5IGEga25vd24gYm9vbGVhbiBwcm9wZXJ0eSBuYW1lIHdoZW4gcHJvcGVydHlUeXBlIGlzXG4gICAgICAgIC8vIG9taXR0ZWQsIHRoZSBzYW1lIHdheSBtYW5hZ2VfY29tcG9uZW50IHNldF9wcm9wZXJ0eSBob25vdXJzIHByb3BlcnR5VHlwZS5cbiAgICAgICAgbGV0IGNvZXJjZWRWYWx1ZTogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29lcmNlZFZhbHVlID0gdGhpcy5jb2VyY2VOb2RlUHJvcGVydHlWYWx1ZShwcm9wZXJ0eSwgdmFsdWUsIHByb3BlcnR5VHlwZSk7XG4gICAgICAgIH0gY2F0Y2ggKGNvZXJjZUVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoY29lcmNlRXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHsgdXVpZCwgcGF0aDogcHJvcGVydHksIGR1bXA6IHsgdmFsdWU6IGNvZXJjZWRWYWx1ZSB9IH0pO1xuXG4gICAgICAgICAgICAvLyBJc3N1ZSAjNDc6IGBzZXQtcHJvcGVydHlgIHJlc29sdmluZyB3aXRob3V0IHRocm93aW5nIGRvZXMgTk9UIG1lYW4gdGhlXG4gICAgICAgICAgICAvLyB3cml0ZSB0b29rIGVmZmVjdCDigJQgcmVhZCB0aGUgcHJvcGVydHkgYmFjayBhbmQgY29tcGFyZSwgdGhlIHNhbWVcbiAgICAgICAgICAgIC8vIHZlcmlmeS1kb24ndC1hc3N1bWUgZml4ICMzNC8jNDIgYWxyZWFkeSBhcHBsaWVkIHRvIG1hbmFnZV9jb21wb25lbnQuXG4gICAgICAgICAgICBjb25zdCB2ZXJpZnkgPSBhd2FpdCB0aGlzLnJlYWROb2RlUHJvcGVydHkodXVpZCwgcHJvcGVydHkpO1xuICAgICAgICAgICAgaWYgKHZlcmlmeS5mb3VuZCAmJiB2ZXJpZnkudmFsdWUgIT09IGNvZXJjZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYFByb3BlcnR5ICcke3Byb3BlcnR5fScgd3JpdGUgZGlkIG5vdCB0YWtlIGVmZmVjdDogcmVxdWVzdGVkICR7SlNPTi5zdHJpbmdpZnkoY29lcmNlZFZhbHVlKX0sIGAgK1xuICAgICAgICAgICAgICAgICAgICBgYWN0dWFsIHZhbHVlIGlzICR7SlNPTi5zdHJpbmdpZnkodmVyaWZ5LnZhbHVlKX0uYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB2ZXJpZmllZFN1ZmZpeCA9IHZlcmlmeS5mb3VuZCA/ICcnIDogJyAodW5hYmxlIHRvIHZlcmlmeSDigJQgcmVhZC1iYWNrIGRpZCBub3QgcmVzb2x2ZSBhIHZhbHVlIGF0IHRoaXMgcHJvcGVydHkgcGF0aCknO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLCBwcm9wZXJ0eSwgbmV3VmFsdWU6IGNvZXJjZWRWYWx1ZSwgbm9kZUluZm86IG5vZGVJbmZvLmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZURldGFpbHM6IHsgcHJvcGVydHksIHZhbHVlOiBjb2VyY2VkVmFsdWUsIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpIH1cbiAgICAgICAgICAgICAgICB9LCBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseSR7dmVyaWZpZWRTdWZmaXh9YCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkOiB1dWlkLCBwcm9wZXJ0eSwgbmV3VmFsdWU6IGNvZXJjZWRWYWx1ZSB9LCBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseSR7dmVyaWZpZWRTdWZmaXh9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0Tm9kZVByb3BlcnR5JywgYXJnczogW3V1aWQsIHByb3BlcnR5LCBjb2VyY2VkVmFsdWVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXROb2RlVHJhbnNmb3JtKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB1dWlkID0gYXJncy51dWlkO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5wb3NpdGlvbikgPz8gYXJncy5wb3NpdGlvbjtcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3Mucm90YXRpb24pID8/IGFyZ3Mucm90YXRpb247XG4gICAgICAgIGNvbnN0IHNjYWxlID0gbm9ybWFsaXplVmVjMyhhcmdzLnNjYWxlKSA/PyBhcmdzLnNjYWxlO1xuXG4gICAgICAgIGNvbnN0IHVwZGF0ZVByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IFtdO1xuICAgICAgICBjb25zdCB1cGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCB3YXJuaW5nczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm9SZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8odXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVJbmZvUmVzcG9uc2Uuc3VjY2VzcyB8fCAhbm9kZUluZm9SZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdGYWlsZWQgdG8gZ2V0IG5vZGUgaW5mb3JtYXRpb24nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBub2RlSW5mb1Jlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBjb25zdCBub2RlSXMyRCA9IGlzMkROb2RlKG5vZGVJbmZvKTtcblxuICAgICAgICAgICAgaWYgKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVRyYW5zZm9ybVZhbHVlKHBvc2l0aW9uLCAncG9zaXRpb24nLCBub2RlSXMyRCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vcm1hbGl6ZWQud2FybmluZykgd2FybmluZ3MucHVzaChub3JtYWxpemVkLndhcm5pbmcpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVByb21pc2VzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsIHBhdGg6ICdwb3NpdGlvbicsIGR1bXA6IHsgdmFsdWU6IG5vcm1hbGl6ZWQudmFsdWUgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdwb3NpdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocm90YXRpb24pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplVHJhbnNmb3JtVmFsdWUocm90YXRpb24sICdyb3RhdGlvbicsIG5vZGVJczJEKTtcbiAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZC53YXJuaW5nKSB3YXJuaW5ncy5wdXNoKG5vcm1hbGl6ZWQud2FybmluZyk7XG4gICAgICAgICAgICAgICAgdXBkYXRlUHJvbWlzZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCwgcGF0aDogJ3JvdGF0aW9uJywgZHVtcDogeyB2YWx1ZTogbm9ybWFsaXplZC52YWx1ZSB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ3JvdGF0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzY2FsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVUcmFuc2Zvcm1WYWx1ZShzY2FsZSwgJ3NjYWxlJywgbm9kZUlzMkQpO1xuICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkLndhcm5pbmcpIHdhcm5pbmdzLnB1c2gobm9ybWFsaXplZC53YXJuaW5nKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVQcm9taXNlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLCBwYXRoOiAnc2NhbGUnLCBkdW1wOiB7IHZhbHVlOiBub3JtYWxpemVkLnZhbHVlIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgnc2NhbGUnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVwZGF0ZVByb21pc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnTm8gdHJhbnNmb3JtIHByb3BlcnRpZXMgc3BlY2lmaWVkJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHVwZGF0ZVByb21pc2VzKTtcblxuICAgICAgICAgICAgY29uc3QgdXBkYXRlZE5vZGVJbmZvID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogQWN0aW9uVG9vbFJlc3VsdCA9IHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBUcmFuc2Zvcm0gcHJvcGVydGllcyB1cGRhdGVkOiAke3VwZGF0ZXMuam9pbignLCAnKX0gJHtub2RlSXMyRCA/ICcoMkQgbm9kZSknIDogJygzRCBub2RlKSd9YCxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBub2RlVHlwZTogbm9kZUlzMkQgPyAnMkQnIDogJzNEJyxcbiAgICAgICAgICAgICAgICAgICAgYXBwbGllZENoYW5nZXM6IHVwZGF0ZXMsXG4gICAgICAgICAgICAgICAgICAgIHRyYW5zZm9ybUNvbnN0cmFpbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogbm9kZUlzMkQgPyAneCwgeSBvbmx5ICh6IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBub2RlSXMyRCA/ICd6IG9ubHkgKHgsIHkgaWdub3JlZCknIDogJ3gsIHksIHogYWxsIHVzZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NhbGU6IG5vZGVJczJEID8gJ3gsIHkgbWFpbiwgeiB0eXBpY2FsbHkgMScgOiAneCwgeSwgeiBhbGwgdXNlZCdcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgbm9kZUluZm86IHVwZGF0ZWROb2RlSW5mby5kYXRhLFxuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1EZXRhaWxzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbE5vZGVUeXBlOiBub2RlSXMyRCA/ICcyRCcgOiAnM0QnLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXBwbGllZFRyYW5zZm9ybXM6IHVwZGF0ZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBiZWZvcmVBZnRlckNvbXBhcmlzb246IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJlZm9yZTogbm9kZUluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICBhZnRlcjogdXBkYXRlZE5vZGVJbmZvLmRhdGFcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmICh3YXJuaW5ncy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgKHJlc3VsdCBhcyBhbnkpLndhcm5pbmcgPSB3YXJuaW5ncy5qb2luKCc7ICcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byB1cGRhdGUgdHJhbnNmb3JtOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkZWxldGVOb2RlKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWRlbGV0ZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVtb3ZlLW5vZGUnLCB7IHV1aWQgfSk7XG5cbiAgICAgICAgICAgIC8vIElzc3VlICM3NDogYHJlbW92ZS1ub2RlYCByZXNvbHZpbmcgd2l0aG91dCB0aHJvd2luZyBkb2VzIE5PVCBtZWFuIHRoZSBub2RlXG4gICAgICAgICAgICAvLyBhY3R1YWxseSBsZWZ0IHRoZSBncmFwaCDigJQgaXQgc2lsZW50bHkgbm8tb3BzIGZvciBhIHByZWZhYi1pbnN0YW5jZSBjaGlsZCBpblxuICAgICAgICAgICAgLy8gc2NlbmUtZWRpdCBjb250ZXh0ICh0aGUgc2FtZSBjbGFzcyBvZiBjb25zdHJhaW50IG1vdmVOb2RlIGFscmVhZHkgdmVyaWZpZXNcbiAgICAgICAgICAgIC8vIGFnYWluc3QgZm9yICMzMykuIFJlYWQgdGhlIG5vZGUgYmFjazogYSByZWplY3RlZC9lbXB0eSBxdWVyeS1ub2RlIG1lYW5zIHRoZVxuICAgICAgICAgICAgLy8gbm9kZSBpcyBnb25lIChzdWNjZXNzKTsgYSBub2RlIHRoYXQgc3RpbGwgcmVzb2x2ZXMgbWVhbnMgdGhlIGRlbGV0ZSB3YXNcbiAgICAgICAgICAgIC8vIGJsb2NrZWQuIFRoaXMgYWxzbyBleHBsYWlucyBpc3N1ZSAjNzMsIHdoZXJlIFwiZGVsZXRlZFwiIG5vZGVzIHJlYXBwZWFyZWQg4oCUXG4gICAgICAgICAgICAvLyB0aGUgZGVsZXRlIG5ldmVyIHRvb2sgZWZmZWN0LCBzbyBhIGxhdGVyIGNyZWF0ZSBsZWdpdGltYXRlbHkgc3RpbGwgc2F3IHRoZW0uXG4gICAgICAgICAgICBsZXQgc3RpbGxFeGlzdHMgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgICAgICBzdGlsbEV4aXN0cyA9ICEhbm9kZURhdGE7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBzdGlsbEV4aXN0cyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0aWxsRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICBgTm9kZSAnJHt1dWlkfScgc3RpbGwgZXhpc3RzIGFmdGVyIGRlbGV0ZTogdGhlIGRlbGV0ZSBkaWQgbm90IHRha2UgZWZmZWN0LiBgICtcbiAgICAgICAgICAgICAgICAgICAgYFRoaXMgY2FuIGhhcHBlbiB3aGVuIHRoZSBub2RlIGlzIGEgcHJlZmFiIGluc3RhbmNlJ3MgY2hpbGQgYW5kIHJlbW92YWwgaXMgYmxvY2tlZCBieSB0aGUgcHJlZmFiIGxpbmsg4oCUIHRyeSBkZWxldGluZyBpdCBmcm9tIHByZWZhYiBlZGl0IG1vZGUgaW5zdGVhZC5gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ05vZGUgZGVsZXRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIG1vdmVOb2RlKG5vZGVVdWlkOiBzdHJpbmcsIG5ld1BhcmVudFV1aWQ6IHN0cmluZywgc2libGluZ0luZGV4OiBudW1iZXIgPSAtMSwga2VlcFdvcmxkVHJhbnNmb3JtOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhbmV3UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgbmV3UGFyZW50VXVpZCBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1tb3ZlJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wYXJlbnQnLCB7XG4gICAgICAgICAgICAgICAgcGFyZW50OiBuZXdQYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgIHV1aWRzOiBbbm9kZVV1aWRdLFxuICAgICAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBsZXQgc2libGluZ09yZGVyOiBTaWJsaW5nT3JkZXJSZXN1bHQgfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoc2libGluZ0luZGV4ID49IDApIHtcbiAgICAgICAgICAgICAgICBzaWJsaW5nT3JkZXIgPSBhd2FpdCBhcHBseVNpYmxpbmdJbmRleChuZXdQYXJlbnRVdWlkLCBub2RlVXVpZCwgc2libGluZ0luZGV4KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gUmVhZCBiYWNrIHRoZSBhY3R1YWwgcGFyZW50LiBgc2V0LXBhcmVudGAgc2lsZW50bHkgbm8tb3BzIGZvciBzb21lIHByZWZhYi1cbiAgICAgICAgICAgIC8vIGluc3RhbmNlIGNvbnN0cmFpbnRzIChlLmcuIG1vdmluZyBhIHByZWZhYiByb290IG91dCBmcm9tIHVuZGVyIGl0cyBpbnN0YW5jZSksXG4gICAgICAgICAgICAvLyBzbyBhIHJlc29sdmVkIHByb21pc2UgaGVyZSBkb2VzIG5vdCBndWFyYW50ZWUgdGhlIHJlcGFyZW50IHRvb2sgZWZmZWN0LlxuICAgICAgICAgICAgY29uc3QgdmVyaWZ5SW5mbyA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8obm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCF2ZXJpZnlJbmZvLnN1Y2Nlc3MgfHwgIXZlcmlmeUluZm8uZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgTm9kZSBtb3ZlIGNvdWxkIG5vdCBiZSB2ZXJpZmllZDogZmFpbGVkIHRvIHJlYWQgYmFjayBub2RlICcke25vZGVVdWlkfScgYWZ0ZXIgdGhlIG1vdmUuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodmVyaWZ5SW5mby5kYXRhLnBhcmVudCAhPT0gbmV3UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYE5vZGUgbW92ZSBkaWQgbm90IHRha2UgZWZmZWN0OiBleHBlY3RlZCBwYXJlbnQgJyR7bmV3UGFyZW50VXVpZH0nIGJ1dCB0aGUgbm9kZSBzdGlsbCByZXBvcnRzIHBhcmVudCAnJHt2ZXJpZnlJbmZvLmRhdGEucGFyZW50fScuIGAgK1xuICAgICAgICAgICAgICAgICAgICBgVGhpcyBjYW4gaGFwcGVuIHdoZW4gdGhlIG5vZGUgaXMgYSBwcmVmYWIgaW5zdGFuY2UncyByb290IGFuZCByZXBhcmVudGluZyBpcyBibG9ja2VkIGJ5IHRoZSBwcmVmYWIgbGluay5gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHNpYmxpbmdPcmRlciAmJiAhc2libGluZ09yZGVyLmFwcGxpZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGBOb2RlIHdhcyBtb3ZlZCB1bmRlciAnJHtuZXdQYXJlbnRVdWlkfScgYnV0IHNpYmxpbmdJbmRleCAke3NpYmxpbmdJbmRleH0gd2FzIE5PVCBhcHBsaWVkOiAke3NpYmxpbmdPcmRlci5yZWFzb259LmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBuZXdQYXJlbnRVdWlkLCBzaWJsaW5nT3JkZXIsIG5vZGVJbmZvOiB2ZXJpZnlJbmZvLmRhdGEgfSwgJ05vZGUgbW92ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkdXBsaWNhdGVOb2RlKHV1aWQ6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWR1cGxpY2F0ZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFpbmNsdWRlQ2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAvLyBTaGFsbG93IGR1cGxpY2F0ZTogY3JlYXRlIG5ldyBub2RlIHdpdGggc2FtZSBuYW1lL3BhcmVudCBidXQgbm8gY2hpbGRyZW5cbiAgICAgICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVJbmZvUmVzcG9uc2Uuc3VjY2VzcyB8fCAhbm9kZUluZm9SZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCBub2RlIGluZm8gZm9yIHNoYWxsb3cgZHVwbGljYXRlJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gbm9kZUluZm9SZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld05vZGVVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGVJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZUluZm8ucGFyZW50IHx8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1V1aWQgPSBBcnJheS5pc0FycmF5KG5ld05vZGVVdWlkKSA/IG5ld05vZGVVdWlkWzBdIDogbmV3Tm9kZVV1aWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBuZXdVdWlkLCBzaGFsbG93OiB0cnVlIH0sICdOb2RlIGR1cGxpY2F0ZWQgKHdpdGhvdXQgY2hpbGRyZW4pIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdkdXBsaWNhdGUtbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIG5ld1V1aWQ6IHJlc3VsdD8udXVpZCA/PyByZXN1bHQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ05vZGUgZHVwbGljYXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRldGVjdE5vZGVUeXBlKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWRldGVjdF90eXBlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm9SZXNwb25zZS5zdWNjZXNzIHx8ICFub2RlSW5mb1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0ZhaWxlZCB0byBnZXQgbm9kZSBpbmZvcm1hdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IG5vZGVJbmZvUmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IGlzMkQgPSBpczJETm9kZShub2RlSW5mbyk7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gbm9kZUluZm8uY29tcG9uZW50cyB8fCBbXTtcblxuICAgICAgICAgICAgY29uc3QgZGV0ZWN0aW9uUmVhc29uczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICAgICAgY29uc3QgdHdvRENvbXBvbmVudHMgPSBjb21wb25lbnRzLmZpbHRlcigoY29tcDogYW55KSA9PiBpczJEQ29tcG9uZW50VHlwZShjb21wLnR5cGUpKTtcblxuICAgICAgICAgICAgY29uc3QgdGhyZWVEQ29tcG9uZW50cyA9IGNvbXBvbmVudHMuZmlsdGVyKChjb21wOiBhbnkpID0+IGlzM0RDb21wb25lbnRUeXBlKGNvbXAudHlwZSkpO1xuXG4gICAgICAgICAgICBpZiAodHdvRENvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaChgSGFzIDJEIGNvbXBvbmVudHM6ICR7dHdvRENvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aHJlZURDb21wb25lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBkZXRlY3Rpb25SZWFzb25zLnB1c2goYEhhcyAzRCBjb21wb25lbnRzOiAke3RocmVlRENvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTm9kZSBwb3NpdGlvbiBpcyBOT1QgdXNlZCB0byBpbmZlciAyRC1uZXNzOiBhIDNEIG5vZGUgbGVnaXRpbWF0ZWx5IHNpdHNcbiAgICAgICAgICAgIC8vIGF0IHRoZSBvcmlnaW4gKHogPSAwKS4gQWJzZW50IGEgMkQvVUkgY29tcG9uZW50LCB0aGUgbm9kZSBpcyB0cmVhdGVkIGFzIDNELlxuICAgICAgICAgICAgaWYgKHR3b0RDb21wb25lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaCgnTm8gMkQvVUkgY29tcG9uZW50IGZvdW5kOyB0cmVhdGVkIGFzIDNEIChmdWxsIHgsIHksIHogdHJhbnNmb3JtKScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsXG4gICAgICAgICAgICAgICAgbm9kZU5hbWU6IG5vZGVJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgbm9kZVR5cGU6IGlzMkQgPyAnMkQnIDogJzNEJyxcbiAgICAgICAgICAgICAgICBkZXRlY3Rpb25SZWFzb25zLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGNvbXBvbmVudHMubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6IGdldENvbXBvbmVudENhdGVnb3J5KGNvbXAudHlwZSlcbiAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGVJbmZvLnBvc2l0aW9uLFxuICAgICAgICAgICAgICAgIHRyYW5zZm9ybUNvbnN0cmFpbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBpczJEID8gJ3gsIHkgb25seSAoeiBpZ25vcmVkKScgOiAneCwgeSwgeiBhbGwgdXNlZCcsXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBpczJEID8gJ3ogb25seSAoeCwgeSBpZ25vcmVkKScgOiAneCwgeSwgeiBhbGwgdXNlZCcsXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiBpczJEID8gJ3gsIHkgbWFpbiwgeiB0eXBpY2FsbHkgMScgOiAneCwgeSwgeiBhbGwgdXNlZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZGV0ZWN0IG5vZGUgdHlwZTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19