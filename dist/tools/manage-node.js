"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageNode = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
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
        var _a, _b;
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
            if (args.assetPath && !finalAssetUuid) {
                try {
                    const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetPath);
                    if (assetInfo && assetInfo.uuid) {
                        finalAssetUuid = assetInfo.uuid;
                        assetType = assetInfo.type;
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
            if (siblingIndex !== undefined && siblingIndex >= 0 && uuid && targetParentUuid) {
                try {
                    await this.awaitNodeCommit(uuid);
                    await Editor.Message.request('scene', 'set-parent', {
                        parent: targetParentUuid,
                        uuids: [uuid],
                        keepWorldTransform: (0, normalize_1.coerceBool)(args.keepWorldTransform) || false
                    });
                    // Best-effort verification: this re-parent is a secondary ordering step
                    // after node creation already succeeded, so a mismatch is logged rather
                    // than failing the whole create — the verificationData read-back below
                    // still reports the node's true final parent either way.
                    const verifyInfo = await this.getNodeInfo(uuid);
                    if (!verifyInfo.success || ((_a = verifyInfo.data) === null || _a === void 0 ? void 0 : _a.parent) !== targetParentUuid) {
                        console.warn(`Sibling-index reparent did not verify: expected parent '${targetParentUuid}', got '${(_b = verifyInfo.data) === null || _b === void 0 ? void 0 : _b.parent}'`);
                    }
                }
                catch (err) {
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
            return (0, types_1.successResult)({ nodeUuid, newParentUuid, nodeInfo: verifyInfo.data }, 'Node moved successfully');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLW5vZGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUFrRjtBQUNsRixrREFBdUY7QUFDdkYsbUZBQStLO0FBRS9LLHNGQUFzRjtBQUN0RixNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQztBQUNwQywwRUFBMEU7QUFDMUUsTUFBTSxtQkFBbUIsR0FBRyxFQUFFLENBQUM7QUFFL0IsTUFBYSxVQUFXLFNBQVEsaUNBQWM7SUFBOUM7O1FBRWEsU0FBSSxHQUFHLGFBQWEsQ0FBQztRQUNyQixnQkFBVyxHQUFHLDZYQUE2WCxDQUFDO1FBQzVZLFlBQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxTQUFTLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLENBQUMsQ0FBQztRQUNuSixnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxjQUFjLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsYUFBYSxDQUFDO29CQUM5SSxXQUFXLEVBQUUsdVlBQXVZO2lCQUN2WjtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0REFBNEQ7aUJBQzVFO2dCQUNELFVBQVUsRUFBRTtvQkFDUixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsK0hBQStIO2lCQUMvSTtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUM7b0JBQ2xDLFdBQVcsRUFBRSwwQ0FBMEM7b0JBQ3ZELE9BQU8sRUFBRSxNQUFNO2lCQUNsQjtnQkFDRCxZQUFZLEVBQUU7b0JBQ1YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG9FQUFvRTtvQkFDakYsT0FBTyxFQUFFLENBQUMsQ0FBQztpQkFDZDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDZEQUE2RDtpQkFDN0U7Z0JBQ0QsU0FBUyxFQUFFO29CQUNQLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxrSEFBa0g7aUJBQ2xJO2dCQUNELFVBQVUsRUFBRTtvQkFDUixJQUFJLEVBQUUsT0FBTztvQkFDYixLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO29CQUN6QixXQUFXLEVBQUUsa0ZBQWtGO2lCQUNsRztnQkFDRCxZQUFZLEVBQUU7b0JBQ1YsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsV0FBVyxFQUFFLHdGQUF3RjtvQkFDckcsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dCQUNELGtCQUFrQixFQUFFO29CQUNoQixJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVBQUUsZ0RBQWdEO29CQUM3RCxPQUFPLEVBQUUsS0FBSztpQkFDakI7Z0JBQ0QsZ0JBQWdCLEVBQUU7b0JBQ2QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRTt3QkFDakgsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFO3dCQUNqSCxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUU7cUJBQ2pIO29CQUNELFdBQVcsRUFBRSxvREFBb0Q7aUJBQ3BFO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUNBQW1DO2lCQUNuRDtnQkFDRCxVQUFVLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsV0FBVyxFQUFFLGlEQUFpRDtvQkFDOUQsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMERBQTBEO2lCQUMxRTtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLCtCQUErQjtpQkFDL0M7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDO29CQUNyQyxXQUFXLEVBQUUsZ1VBQWdVO2lCQUNoVjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7d0JBQ3JCLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7d0JBQ3JCLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLHFDQUFxQyxFQUFFO3FCQUM1RTtvQkFDRCxXQUFXLEVBQUUsaUVBQWlFO2lCQUNqRjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsVUFBVSxFQUFFO3dCQUNSLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLHNCQUFzQixFQUFFO3dCQUMxRCxDQUFDLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxzQkFBc0IsRUFBRTt3QkFDMUQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsaUNBQWlDLEVBQUU7cUJBQ3hFO29CQUNELFdBQVcsRUFBRSw4RUFBOEU7aUJBQzlGO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1IsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTt3QkFDckIsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTt3QkFDckIsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsd0JBQXdCLEVBQUU7cUJBQy9EO29CQUNELFdBQVcsRUFBRSw2QkFBNkI7aUJBQzdDO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMEJBQTBCO2lCQUMxQztnQkFDRCxhQUFhLEVBQUU7b0JBQ1gsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDZCQUE2QjtpQkFDN0M7Z0JBQ0QsZUFBZSxFQUFFO29CQUNiLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSxvQ0FBb0M7b0JBQ2pELE9BQU8sRUFBRSxJQUFJO2lCQUNoQjthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ3ZDLFFBQVEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQy9DLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLFdBQUMsT0FBQSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsTUFBQSxJQUFBLHNCQUFVLEVBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxtQ0FBSSxLQUFLLENBQUMsQ0FBQSxFQUFBO1lBQ2xGLFlBQVksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3RELE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2pDLFlBQVksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ3JHLGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQztZQUNwRCxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUM1QyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxlQUFDLE9BQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsTUFBQSxJQUFBLHFCQUFTLEVBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxtQ0FBSSxDQUFDLENBQUMsRUFBRSxNQUFBLElBQUEsc0JBQVUsRUFBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsbUNBQUksS0FBSyxDQUFDLENBQUEsRUFBQTtZQUNsSixTQUFTLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFDLE9BQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQUEsSUFBQSxzQkFBVSxFQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsbUNBQUksSUFBSSxDQUFDLENBQUEsRUFBQTtZQUM1RixXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztTQUN4RCxDQUFDO0lBOHBCTixDQUFDO0lBNXBCVyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQVM7O1FBQzlCLElBQUksQ0FBQztZQUNELElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUV2QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztnQkFDcEIsSUFBSSxDQUFDO29CQUNELE1BQU0sU0FBUyxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7b0JBQzNFLElBQUksU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDO3dCQUNySSxnQkFBZ0IsR0FBSSxTQUFpQixDQUFDLElBQUksQ0FBQzt3QkFDM0MsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDO29CQUM5RSxDQUFDO3lCQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQy9FLGdCQUFnQixHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7d0JBQ3JDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMENBQTBDLGdCQUFnQixFQUFFLENBQUMsQ0FBQztvQkFDOUUsQ0FBQzt5QkFBTSxDQUFDO3dCQUNKLE1BQU0sWUFBWSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHFCQUFxQixDQUFDLENBQUM7d0JBQ2xGLElBQUksWUFBWSxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQzs0QkFDcEMsZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQzt3QkFDekMsQ0FBQztvQkFDTCxDQUFDO2dCQUNMLENBQUM7Z0JBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztvQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLHFEQUFxRCxDQUFDLENBQUM7Z0JBQ3hFLENBQUM7WUFDTCxDQUFDO1lBRUQsSUFBSSxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztZQUNwQyxJQUFJLFNBQTZCLENBQUM7WUFDbEMsSUFBSSxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7Z0JBQ3BDLElBQUksQ0FBQztvQkFDRCxNQUFNLFNBQVMsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7b0JBQy9GLElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDOUIsY0FBYyxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUM7d0JBQ2hDLFNBQVMsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO3dCQUMzQixPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsSUFBSSxDQUFDLFNBQVMsdUJBQXVCLGNBQWMsRUFBRSxDQUFDLENBQUM7b0JBQ3RGLENBQUM7eUJBQU0sQ0FBQzt3QkFDSixPQUFPLElBQUEsbUJBQVcsRUFBQyw0QkFBNEIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUM7b0JBQ3JFLENBQUM7Z0JBQ0wsQ0FBQztnQkFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO29CQUNYLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGlDQUFpQyxJQUFJLENBQUMsU0FBUyxNQUFNLEdBQUcsRUFBRSxDQUFDLENBQUM7Z0JBQ25GLENBQUM7WUFDTCxDQUFDO1lBRUQsTUFBTSxpQkFBaUIsR0FBUSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFFbkQsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDO2dCQUNuQixpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsZ0JBQWdCLENBQUM7WUFDaEQsQ0FBQztZQUVELElBQUksY0FBYyxFQUFFLENBQUM7Z0JBQ2pCLGlCQUFpQixDQUFDLFNBQVMsR0FBRyxjQUFjLENBQUM7Z0JBRTdDLHNFQUFzRTtnQkFDdEUsMEVBQTBFO2dCQUMxRSxxRUFBcUU7Z0JBQ3JFLHFFQUFxRTtnQkFDckUseUVBQXlFO2dCQUN6RSwwQkFBMEI7Z0JBQzFCLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDYixJQUFJLENBQUM7d0JBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsY0FBYyxDQUFDLENBQUM7d0JBQzFGLFNBQVMsR0FBRyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsSUFBSSxDQUFDO29CQUMzQixDQUFDO29CQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7d0JBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQyxxQ0FBcUMsY0FBYyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7b0JBQy9FLENBQUM7Z0JBQ0wsQ0FBQztnQkFDRCxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNaLGlCQUFpQixDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7Z0JBQ3ZDLENBQUM7Z0JBRUQsSUFBSSxJQUFBLHNCQUFVLEVBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxFQUFFLENBQUM7b0JBQ2hDLGlCQUFpQixDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7Z0JBQzFDLENBQUM7WUFDTCxDQUFDO1lBRUQsSUFBSSxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNoRCxpQkFBaUIsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUNuRCxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLE1BQU0sSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUN0RSxpQkFBaUIsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbkQsQ0FBQztZQUVELElBQUksSUFBQSxzQkFBVSxFQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7Z0JBQ3RDLGlCQUFpQixDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQztZQUNoRCxDQUFDO1lBRUQsTUFBTSxZQUFZLEdBQUcsSUFBQSxxQkFBUyxFQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVsRCxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFFOUQsTUFBTSxRQUFRLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsYUFBYSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDekYsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFFOUQsSUFBSSxZQUFZLEtBQUssU0FBUyxJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLGdCQUFnQixFQUFFLENBQUM7Z0JBQzlFLElBQUksQ0FBQztvQkFDRCxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pDLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRTt3QkFDaEQsTUFBTSxFQUFFLGdCQUFnQjt3QkFDeEIsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDO3dCQUNiLGtCQUFrQixFQUFFLElBQUEsc0JBQVUsRUFBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxLQUFLO3FCQUNuRSxDQUFDLENBQUM7b0JBQ0gsd0VBQXdFO29CQUN4RSx3RUFBd0U7b0JBQ3hFLHVFQUF1RTtvQkFDdkUseURBQXlEO29CQUN6RCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2hELElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUEsTUFBQSxVQUFVLENBQUMsSUFBSSwwQ0FBRSxNQUFNLE1BQUssZ0JBQWdCLEVBQUUsQ0FBQzt3QkFDdEUsT0FBTyxDQUFDLElBQUksQ0FBQywyREFBMkQsZ0JBQWdCLFdBQVcsTUFBQSxVQUFVLENBQUMsSUFBSSwwQ0FBRSxNQUFNLEdBQUcsQ0FBQyxDQUFDO29CQUNuSSxDQUFDO2dCQUNMLENBQUM7Z0JBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztvQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLDhCQUE4QixFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUN0RCxDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQ3hELElBQUksQ0FBQztvQkFDRCxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pDLEtBQUssTUFBTSxhQUFhLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO3dCQUMxQyxJQUFJLENBQUM7NEJBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUU7Z0NBQ3RELElBQUk7Z0NBQ0osU0FBUyxFQUFFLGFBQWE7NkJBQzNCLENBQUMsQ0FBQzs0QkFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsYUFBYSxxQkFBcUIsQ0FBQyxDQUFDO3dCQUNqRSxDQUFDO3dCQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7NEJBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQywyQkFBMkIsYUFBYSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7d0JBQ25FLENBQUM7b0JBQ0wsQ0FBQztnQkFDTCxDQUFDO2dCQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7b0JBQ1gsT0FBTyxDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDbkQsQ0FBQztZQUNMLENBQUM7WUFFRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDaEMsSUFBSSxDQUFDO29CQUNELE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDakMsTUFBTSxHQUFHLEdBQUcsSUFBQSx5QkFBYSxFQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDMUQsTUFBTSxHQUFHLEdBQUcsSUFBQSx5QkFBYSxFQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDMUQsTUFBTSxHQUFHLEdBQUcsSUFBQSx5QkFBYSxFQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztvQkFDdkQsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUM7d0JBQ3hCLElBQUk7d0JBQ0osUUFBUSxFQUFFLEdBQUcsYUFBSCxHQUFHLGNBQUgsR0FBRyxHQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRO3dCQUMvQyxRQUFRLEVBQUUsR0FBRyxhQUFILEdBQUcsY0FBSCxHQUFHLEdBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVE7d0JBQy9DLEtBQUssRUFBRSxHQUFHLGFBQUgsR0FBRyxjQUFILEdBQUcsR0FBSSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSztxQkFDNUMsQ0FBQyxDQUFDO29CQUNILE9BQU8sQ0FBQyxHQUFHLENBQUMsd0NBQXdDLENBQUMsQ0FBQztnQkFDMUQsQ0FBQztnQkFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO29CQUNYLE9BQU8sQ0FBQyxJQUFJLENBQUMsa0NBQWtDLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQzFELENBQUM7WUFDTCxDQUFDO1lBRUQsSUFBSSxnQkFBZ0IsR0FBUSxJQUFJLENBQUM7WUFDakMsSUFBSSxDQUFDO2dCQUNELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDOUMsSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ25CLGdCQUFnQixHQUFHO3dCQUNmLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSTt3QkFDdkIsZUFBZSxFQUFFOzRCQUNiLFVBQVUsRUFBRSxnQkFBZ0I7NEJBQzVCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLE1BQU07NEJBQ2pDLFNBQVMsRUFBRSxDQUFDLENBQUMsY0FBYzs0QkFDM0IsU0FBUyxFQUFFLGNBQWM7NEJBQ3pCLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUzs0QkFDekIsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO3lCQUN0QztxQkFDSixDQUFDO2dCQUNOLENBQUM7WUFDTCxDQUFDO1lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztnQkFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzFELENBQUM7WUFFRCxNQUFNLGNBQWMsR0FBRyxjQUFjO2dCQUNqQyxDQUFDLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSx3Q0FBd0M7Z0JBQzVELENBQUMsQ0FBQyxTQUFTLElBQUksQ0FBQyxJQUFJLHdCQUF3QixDQUFDO1lBRWpELE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixJQUFJO2dCQUNKLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixVQUFVLEVBQUUsZ0JBQWdCO2dCQUM1QixRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxNQUFNO2dCQUNqQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLGNBQWM7Z0JBQzNCLFNBQVMsRUFBRSxjQUFjO2dCQUN6QixPQUFPLEVBQUUsY0FBYztnQkFDdkIsZ0JBQWdCO2FBQ25CLENBQUMsQ0FBQztRQUVQLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLDBCQUEwQixHQUFHLENBQUMsT0FBTyxXQUFXLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQy9GLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQVk7UUFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLHNCQUFzQixDQUFDO1FBQ3JELFNBQVMsQ0FBQztZQUNOLElBQUksQ0FBQztnQkFDRCxNQUFNLFFBQVEsR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2hGLElBQUksUUFBUTtvQkFBRSxPQUFPO1lBQ3pCLENBQUM7WUFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO2dCQUNYLDRFQUE0RTtZQUNoRixDQUFDO1lBQ0QsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ3pCLE1BQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLDhCQUE4QixzQkFBc0IsZ0JBQWdCLENBQUMsQ0FBQztZQUN2RyxDQUFDO1lBQ0QsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyxDQUFDO1FBQy9ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFZOztRQUNsQyxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDbEQsSUFBSSxDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hGLElBQUksQ0FBQyxRQUFRO2dCQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLG9DQUFvQyxDQUFDLENBQUM7WUFDeEUsTUFBTSxJQUFJLEdBQWE7Z0JBQ25CLElBQUksRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLElBQUksMENBQUUsS0FBSyxLQUFJLElBQUk7Z0JBQ2xDLElBQUksRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLElBQUksMENBQUUsS0FBSyxLQUFJLFNBQVM7Z0JBQ3ZDLE1BQU0sRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLE1BQU0sMENBQUUsS0FBSyxNQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUk7Z0JBQzNFLFFBQVEsRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLFFBQVEsMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQzFELFFBQVEsRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLFFBQVEsMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQzFELEtBQUssRUFBRSxDQUFBLE1BQUEsUUFBUSxDQUFDLEtBQUssMENBQUUsS0FBSyxLQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ3BELE1BQU0sRUFBRSxDQUFBLE1BQUEsTUFBQSxRQUFRLENBQUMsTUFBTSwwQ0FBRSxLQUFLLDBDQUFFLElBQUksS0FBSSxJQUFJO2dCQUM1QyxRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVEsSUFBSSxFQUFFO2dCQUNqQyxVQUFVLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztvQkFDdkQsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksU0FBUztvQkFDaEMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO2lCQUM1RCxDQUFDLENBQUM7Z0JBQ0gsS0FBSyxFQUFFLENBQUEsTUFBQSxRQUFRLENBQUMsS0FBSywwQ0FBRSxLQUFLLEtBQUksVUFBVTtnQkFDMUMsUUFBUSxFQUFFLENBQUEsTUFBQSxRQUFRLENBQUMsUUFBUSwwQ0FBRSxLQUFLLEtBQUksQ0FBQzthQUMxQyxDQUFDO1lBQ0YsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFlLEVBQUUsYUFBc0IsS0FBSztRQUNoRSxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHFDQUFxQyxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDO1lBQ0QsTUFBTSxJQUFJLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUMzRSxNQUFNLEtBQUssR0FBVSxFQUFFLENBQUM7WUFDeEIsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFTLEVBQUUsY0FBc0IsRUFBRSxFQUFFLEVBQUU7Z0JBQ3ZELE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUN6RSxNQUFNLE9BQU8sR0FBRyxVQUFVO29CQUN0QixDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxPQUFPO29CQUN2QixDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7Z0JBQzlELElBQUksT0FBTztvQkFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7Z0JBQzlFLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUNoQixLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxRQUFRO3dCQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ25FLENBQUM7WUFDTCxDQUFDLENBQUM7WUFDRixJQUFJLElBQUk7Z0JBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzNCLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hDLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQztnQkFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtvQkFDOUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQztpQkFDN0UsQ0FBQyxDQUFDO2dCQUNILElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPO29CQUFFLE9BQU8sSUFBQSxxQkFBYSxFQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUNoRixPQUFPLElBQUEsbUJBQVcsRUFBQyxDQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxLQUFLLEtBQUksZUFBZSxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUFDLE9BQU8sSUFBUyxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHVCQUF1QixHQUFHLENBQUMsT0FBTywwQkFBMEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDbkcsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFZO1FBQ3JDLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsMENBQTBDLENBQUMsQ0FBQztRQUMxRSxJQUFJLENBQUM7WUFDRCxNQUFNLElBQUksR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQzNFLE1BQU0sU0FBUyxHQUFHLElBQUEsZ0RBQWdCLEVBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQy9DLElBQUksU0FBUyxFQUFFLENBQUM7Z0JBQ1osT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBQSwyQ0FBVyxFQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUN2RyxDQUFDO1lBQ0QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsU0FBUyxJQUFJLGFBQWEsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQztnQkFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtvQkFDOUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUM7aUJBQ25FLENBQUMsQ0FBQztnQkFDSCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsT0FBTztvQkFBRSxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDaEYsT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsS0FBSyxLQUFJLGVBQWUsQ0FBQyxDQUFDO1lBQ3pELENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXO1FBQ3JCLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDM0UsTUFBTSxLQUFLLEdBQVUsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sWUFBWSxHQUFHLENBQUMsSUFBUyxFQUFFLEVBQUU7Z0JBQy9CLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBQSwyQ0FBVyxFQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDaEgsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7b0JBQ2hCLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLFFBQVE7d0JBQUUsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMzRCxDQUFDO1lBQ0wsQ0FBQyxDQUFDO1lBQ0YsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLFFBQVE7Z0JBQUUsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzlDLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUM7Z0JBQ0QsTUFBTSxNQUFNLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUU7b0JBQzlFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxFQUFFO2lCQUM1RCxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU87b0JBQUUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ2hGLE9BQU8sSUFBQSxtQkFBVyxFQUFDLENBQUEsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUssS0FBSSxlQUFlLENBQUMsQ0FBQztZQUN6RCxDQUFDO1lBQUMsT0FBTyxJQUFTLEVBQUUsQ0FBQztnQkFDakIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsc0JBQXNCLEdBQUcsQ0FBQyxPQUFPLDBCQUEwQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUNsRyxDQUFDO1FBQ0wsQ0FBQztJQUNMLENBQUM7SUFLRDs7OztPQUlHO0lBQ0ssdUJBQXVCLENBQUMsUUFBZ0IsRUFBRSxLQUFVLEVBQUUsWUFBcUI7UUFDL0UsTUFBTSxhQUFhLEdBQUcsWUFBWTtlQUMzQixDQUFDLFVBQVUsQ0FBQyw2QkFBNkIsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFeEYsSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDOUIsTUFBTSxPQUFPLEdBQUcsSUFBQSxzQkFBVSxFQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ2xDLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsUUFBUSx3RUFBd0UsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDMUksQ0FBQztZQUNELE9BQU8sT0FBTyxDQUFDO1FBQ25CLENBQUM7UUFDRCxJQUFJLGFBQWEsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM3QixNQUFNLE9BQU8sR0FBRyxJQUFBLHVCQUFXLEVBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkMsSUFBSSxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7Z0JBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxRQUFRLHdDQUF3QyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMxRyxDQUFDO1lBQ0QsT0FBTyxPQUFPLENBQUM7UUFDbkIsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNLLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFZLEVBQUUsUUFBZ0I7UUFDekQsSUFBSSxDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hGLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFDeEQsSUFBSSxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDekQsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUMvQyxDQUFDO1lBQ0QsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDO1FBQzlDLENBQUM7UUFBQyxXQUFNLENBQUM7WUFDTCxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLENBQUM7UUFDOUMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQVksRUFBRSxRQUFnQixFQUFFLEtBQVUsRUFBRSxZQUFxQjtRQUMzRixJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUM1QyxPQUFPLElBQUEsbUJBQVcsRUFBQyxnRUFBZ0UsQ0FBQyxDQUFDO1FBQ3pGLENBQUM7UUFFRCw4RUFBOEU7UUFDOUUsb0VBQW9FO1FBQ3BFLGlGQUFpRjtRQUNqRix5RUFBeUU7UUFDekUsNEVBQTRFO1FBQzVFLElBQUksWUFBaUIsQ0FBQztRQUN0QixJQUFJLENBQUM7WUFDRCxZQUFZLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUFDLE9BQU8sU0FBYyxFQUFFLENBQUM7WUFDdEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzFDLENBQUM7UUFFRCxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBRS9HLHlFQUF5RTtZQUN6RSxtRUFBbUU7WUFDbkUsdUVBQXVFO1lBQ3ZFLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMzRCxJQUFJLE1BQU0sQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxZQUFZLEVBQUUsQ0FBQztnQkFDaEQsT0FBTyxJQUFBLG1CQUFXLEVBQ2QsYUFBYSxRQUFRLDBDQUEwQyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJO29CQUMvRixtQkFBbUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FDckQsQ0FBQztZQUNOLENBQUM7WUFDRCxNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLCtFQUErRSxDQUFDO1lBRTNILElBQUksQ0FBQztnQkFDRCxNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzlDLE9BQU8sSUFBQSxxQkFBYSxFQUFDO29CQUNqQixRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSTtvQkFDekUsYUFBYSxFQUFFLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLEVBQUU7aUJBQ3hGLEVBQUUsYUFBYSxRQUFRLHlCQUF5QixjQUFjLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7WUFBQyxXQUFNLENBQUM7Z0JBQ0wsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLEVBQUUsYUFBYSxRQUFRLHlCQUF5QixjQUFjLEVBQUUsQ0FBQyxDQUFDO1lBQy9JLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixJQUFJLENBQUM7Z0JBQ0QsTUFBTSxNQUFNLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUU7b0JBQzlFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLFFBQVEsRUFBRSxZQUFZLENBQUM7aUJBQzVGLENBQUMsQ0FBQztnQkFDSCxJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsT0FBTztvQkFBRSxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDaEYsT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsS0FBSyxLQUFJLGVBQWUsQ0FBQyxDQUFDO1lBQ3pELENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFTOztRQUNwQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3ZCLE1BQU0sUUFBUSxHQUFHLE1BQUEsSUFBQSx5QkFBYSxFQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsbUNBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUMvRCxNQUFNLFFBQVEsR0FBRyxNQUFBLElBQUEseUJBQWEsRUFBQyxJQUFJLENBQUMsUUFBUSxDQUFDLG1DQUFJLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDL0QsTUFBTSxLQUFLLEdBQUcsTUFBQSxJQUFBLHlCQUFhLEVBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxtQ0FBSSxJQUFJLENBQUMsS0FBSyxDQUFDO1FBRXRELE1BQU0sY0FBYyxHQUFtQixFQUFFLENBQUM7UUFDMUMsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO1FBQzdCLE1BQU0sUUFBUSxHQUFhLEVBQUUsQ0FBQztRQUU5QixJQUFJLENBQUM7WUFDRCxNQUFNLGdCQUFnQixHQUFHLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3RELE9BQU8sSUFBQSxtQkFBVyxFQUFDLGdDQUFnQyxDQUFDLENBQUM7WUFDekQsQ0FBQztZQUVELE1BQU0sUUFBUSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQztZQUN2QyxNQUFNLFFBQVEsR0FBRyxJQUFBLHdDQUFRLEVBQUMsUUFBUSxDQUFDLENBQUM7WUFFcEMsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDWCxNQUFNLFVBQVUsR0FBRyxJQUFBLHVEQUF1QixFQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQzNFLElBQUksVUFBVSxDQUFDLE9BQU87b0JBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzFELGNBQWMsQ0FBQyxJQUFJLENBQ2YsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtvQkFDNUMsSUFBSSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxLQUFLLEVBQUU7aUJBQzVELENBQUMsQ0FDTCxDQUFDO2dCQUNGLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDN0IsQ0FBQztZQUVELElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ1gsTUFBTSxVQUFVLEdBQUcsSUFBQSx1REFBdUIsRUFBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUMzRSxJQUFJLFVBQVUsQ0FBQyxPQUFPO29CQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUMxRCxjQUFjLENBQUMsSUFBSSxDQUNmLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7b0JBQzVDLElBQUksRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSyxFQUFFO2lCQUM1RCxDQUFDLENBQ0wsQ0FBQztnQkFDRixPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQzdCLENBQUM7WUFFRCxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNSLE1BQU0sVUFBVSxHQUFHLElBQUEsdURBQXVCLEVBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztnQkFDckUsSUFBSSxVQUFVLENBQUMsT0FBTztvQkFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDMUQsY0FBYyxDQUFDLElBQUksQ0FDZixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO29CQUM1QyxJQUFJLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUssRUFBRTtpQkFDekQsQ0FBQyxDQUNMLENBQUM7Z0JBQ0YsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMxQixDQUFDO1lBRUQsSUFBSSxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUM5QixPQUFPLElBQUEsbUJBQVcsRUFBQyxtQ0FBbUMsQ0FBQyxDQUFDO1lBQzVELENBQUM7WUFFRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7WUFFbEMsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JELE1BQU0sTUFBTSxHQUFxQjtnQkFDN0IsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsT0FBTyxFQUFFLGlDQUFpQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUU7Z0JBQ3RHLElBQUksRUFBRTtvQkFDRixRQUFRLEVBQUUsSUFBSTtvQkFDZCxRQUFRLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUk7b0JBQ2hDLGNBQWMsRUFBRSxPQUFPO29CQUN2QixvQkFBb0IsRUFBRTt3QkFDbEIsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLGtCQUFrQjt3QkFDakUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLGtCQUFrQjt3QkFDakUsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLGtCQUFrQjtxQkFDcEU7b0JBQ0QsUUFBUSxFQUFFLGVBQWUsQ0FBQyxJQUFJO29CQUM5QixnQkFBZ0IsRUFBRTt3QkFDZCxnQkFBZ0IsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSTt3QkFDeEMsaUJBQWlCLEVBQUUsT0FBTzt3QkFDMUIsU0FBUyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO3FCQUN0QztvQkFDRCxxQkFBcUIsRUFBRTt3QkFDbkIsTUFBTSxFQUFFLFFBQVE7d0JBQ2hCLEtBQUssRUFBRSxlQUFlLENBQUMsSUFBSTtxQkFDOUI7aUJBQ0o7YUFDSixDQUFDO1lBRUYsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNyQixNQUFjLENBQUMsT0FBTyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEQsQ0FBQztZQUVELE9BQU8sTUFBTSxDQUFDO1FBRWxCLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtCQUErQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBWTtRQUNqQyxJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLG9DQUFvQyxDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsYUFBYSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztZQUUvRCw2RUFBNkU7WUFDN0UsOEVBQThFO1lBQzlFLDZFQUE2RTtZQUM3RSw4RUFBOEU7WUFDOUUsMEVBQTBFO1lBQzFFLDRFQUE0RTtZQUM1RSwrRUFBK0U7WUFDL0UsSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLElBQUksQ0FBQztnQkFDRCxNQUFNLFFBQVEsR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2hGLFdBQVcsR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDO1lBQzdCLENBQUM7WUFBQyxXQUFNLENBQUM7Z0JBQ0wsV0FBVyxHQUFHLEtBQUssQ0FBQztZQUN4QixDQUFDO1lBQ0QsSUFBSSxXQUFXLEVBQUUsQ0FBQztnQkFDZCxPQUFPLElBQUEsbUJBQVcsRUFDZCxTQUFTLElBQUksK0RBQStEO29CQUM1RSx1SkFBdUosQ0FDMUosQ0FBQztZQUNOLENBQUM7WUFFRCxPQUFPLElBQUEscUJBQWEsRUFBQyxJQUFJLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsUUFBUSxDQUFDLFFBQWdCLEVBQUUsYUFBcUIsRUFBRSxlQUF1QixDQUFDLENBQUMsRUFBRSxxQkFBOEIsS0FBSztRQUMxSCxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDOUIsT0FBTyxJQUFBLG1CQUFXLEVBQUMseURBQXlELENBQUMsQ0FBQztRQUNsRixDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFO2dCQUNoRCxNQUFNLEVBQUUsYUFBYTtnQkFDckIsS0FBSyxFQUFFLENBQUMsUUFBUSxDQUFDO2dCQUNqQixrQkFBa0I7YUFDckIsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxZQUFZLElBQUksQ0FBQyxFQUFFLENBQUM7Z0JBQ3BCLElBQUksQ0FBQztvQkFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7d0JBQ2xELElBQUksRUFBRSxRQUFRO3dCQUNkLElBQUksRUFBRSxjQUFjO3dCQUNwQixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFO3FCQUNoQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztnQkFBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO29CQUNYLE9BQU8sQ0FBQyxJQUFJLENBQUMsd0NBQXdDLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2hFLENBQUM7WUFDTCxDQUFDO1lBRUQsNkVBQTZFO1lBQzdFLGdGQUFnRjtZQUNoRiwwRUFBMEU7WUFDMUUsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3BELElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUMxQyxPQUFPLElBQUEsbUJBQVcsRUFBQyw4REFBOEQsUUFBUSxtQkFBbUIsQ0FBQyxDQUFDO1lBQ2xILENBQUM7WUFDRCxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLGFBQWEsRUFBRSxDQUFDO2dCQUMzQyxPQUFPLElBQUEsbUJBQVcsRUFDZCxtREFBbUQsYUFBYSx3Q0FBd0MsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUs7b0JBQ25JLDBHQUEwRyxDQUM3RyxDQUFDO1lBQ04sQ0FBQztZQUVELE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLElBQUksRUFBRSxFQUFFLHlCQUF5QixDQUFDLENBQUM7UUFDNUcsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxJQUFZLEVBQUUsa0JBQTJCLElBQUk7O1FBQ3JFLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsdUNBQXVDLENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ25CLDJFQUEyRTtnQkFDM0UsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3RELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDdEQsT0FBTyxJQUFBLG1CQUFXLEVBQUMsK0NBQStDLENBQUMsQ0FBQztnQkFDeEUsQ0FBQztnQkFDRCxNQUFNLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7Z0JBQ3ZDLE1BQU0sV0FBVyxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGFBQWEsRUFBRTtvQkFDckUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJO29CQUNuQixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sSUFBSSxTQUFTO2lCQUN2QyxDQUFDLENBQUM7Z0JBQ0gsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUM7Z0JBQzFFLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxpREFBaUQsQ0FBQyxDQUFDO1lBQ3hHLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNsRixPQUFPLElBQUEscUJBQWEsRUFBQztnQkFDakIsT0FBTyxFQUFFLE1BQUEsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLElBQUksbUNBQUksTUFBTTtnQkFDL0IsT0FBTyxFQUFFLDhCQUE4QjthQUMxQyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQVk7UUFDckMsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyx5Q0FBeUMsQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQztZQUNELE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDdEQsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0NBQWdDLENBQUMsQ0FBQztZQUN6RCxDQUFDO1lBRUQsTUFBTSxRQUFRLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO1lBQ3ZDLE1BQU0sSUFBSSxHQUFHLElBQUEsd0NBQVEsRUFBQyxRQUFRLENBQUMsQ0FBQztZQUNoQyxNQUFNLFVBQVUsR0FBRyxRQUFRLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztZQUU3QyxNQUFNLGdCQUFnQixHQUFhLEVBQUUsQ0FBQztZQUV0QyxNQUFNLGNBQWMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFBLGlEQUFpQixFQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRXRGLE1BQU0sZ0JBQWdCLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBQSxpREFBaUIsRUFBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUV4RixJQUFJLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQzVCLGdCQUFnQixDQUFDLElBQUksQ0FBQyxzQkFBc0IsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDckcsQ0FBQztZQUNELElBQUksZ0JBQWdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUM5QixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdkcsQ0FBQztZQUVELDBFQUEwRTtZQUMxRSw4RUFBOEU7WUFDOUUsSUFBSSxjQUFjLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUM5QixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsa0VBQWtFLENBQUMsQ0FBQztZQUM5RixDQUFDO1lBRUQsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLFFBQVEsRUFBRSxJQUFJO2dCQUNkLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSTtnQkFDdkIsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUM1QixnQkFBZ0I7Z0JBQ2hCLFVBQVUsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUN2QyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7b0JBQ2YsUUFBUSxFQUFFLElBQUEsb0RBQW9CLEVBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztpQkFDNUMsQ0FBQyxDQUFDO2dCQUNILFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtnQkFDM0Isb0JBQW9CLEVBQUU7b0JBQ2xCLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxrQkFBa0I7b0JBQzdELFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxrQkFBa0I7b0JBQzdELEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxrQkFBa0I7aUJBQ2hFO2FBQ0osQ0FBQyxDQUFDO1FBRVAsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsK0JBQStCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDTCxDQUFDOztBQTd5QkwsZ0NBK3lCQztBQS9WRyx5RkFBeUY7QUFDakUsd0NBQTZCLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxBQUF0QixDQUF1QiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIE5vZGVJbmZvLCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wsIGNvZXJjZUludCwgY29lcmNlRmxvYXQsIG5vcm1hbGl6ZVZlYzMgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgaXMyRE5vZGUsIGlzMkRDb21wb25lbnRUeXBlLCBpczNEQ29tcG9uZW50VHlwZSwgbm9ybWFsaXplVHJhbnNmb3JtVmFsdWUsIGdldENvbXBvbmVudENhdGVnb3J5LCBnZXROb2RlUGF0aCwgc2VhcmNoTm9kZUluVHJlZSB9IGZyb20gJy4vbWFuYWdlLW5vZGUtdHJhbnNmb3JtLWhlbHBlcnMnO1xuXG4vKiogTG9uZ2VzdCBgYXdhaXROb2RlQ29tbWl0YCB3YWl0cyBmb3IgYSBmcmVzaGx5IGNyZWF0ZWQgbm9kZSB0byBiZWNvbWUgcXVlcnlhYmxlLiAqL1xuY29uc3QgTk9ERV9DT01NSVRfVElNRU9VVF9NUyA9IDIwMDA7XG4vKiogR2FwIGJldHdlZW4gYHNjZW5lOnF1ZXJ5LW5vZGVgIHBvbGxzIHdoaWxlIHdhaXRpbmcgZm9yIHRoYXQgY29tbWl0LiAqL1xuY29uc3QgTk9ERV9DT01NSVRfUE9MTF9NUyA9IDIwO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlTm9kZSBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcblxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX25vZGUnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBub2RlcyBpbiB0aGUgY3VycmVudCBzY2VuZS4gQWN0aW9uczogY3JlYXRlLCBnZXRfaW5mbywgZmluZCwgZmluZF9ieV9uYW1lLCBnZXRfYWxsLCBzZXRfcHJvcGVydHksIHNldF90cmFuc2Zvcm0sIGRlbGV0ZSwgbW92ZSwgZHVwbGljYXRlLCBkZXRlY3RfdHlwZS4gTk9UIGZvciBjb21wb25lbnRzIOKAlCB1c2UgbWFuYWdlX2NvbXBvbmVudC4gTk9UIGZvciBwcmVmYWJzIOKAlCB1c2UgbWFuYWdlX3ByZWZhYi4gUHJlcmVxdWlzaXRlczogc2NlbmUgbXVzdCBiZSBvcGVuICh2ZXJpZnkgd2l0aCBtYW5hZ2Vfc2NlbmUgYWN0aW9uPWdldF9jdXJyZW50KS4gVG8gZmluZCBub2RlIFVVSURzOiB1c2UgYWN0aW9uPWZpbmQgb3IgYWN0aW9uPWdldF9hbGwgZmlyc3QuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjcmVhdGUnLCAnZ2V0X2luZm8nLCAnZmluZCcsICdmaW5kX2J5X25hbWUnLCAnZ2V0X2FsbCcsICdzZXRfcHJvcGVydHknLCAnc2V0X3RyYW5zZm9ybScsICdkZWxldGUnLCAnbW92ZScsICdkdXBsaWNhdGUnLCAnZGV0ZWN0X3R5cGUnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ2ZpbmQnLCAnZmluZF9ieV9uYW1lJywgJ2dldF9hbGwnLCAnc2V0X3Byb3BlcnR5JywgJ3NldF90cmFuc2Zvcm0nLCAnZGVsZXRlJywgJ21vdmUnLCAnZHVwbGljYXRlJywgJ2RldGVjdF90eXBlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlPWNyZWF0ZSBuZXcgbm9kZSBpbiBzY2VuZSwgZ2V0X2luZm89Z2V0IG5vZGUgZGV0YWlscyBieSBVVUlELCBmaW5kPXNlYXJjaCBub2RlcyBieSBuYW1lIHBhdHRlcm4sIGZpbmRfYnlfbmFtZT1maW5kIGZpcnN0IG5vZGUgYnkgZXhhY3QgbmFtZSwgZ2V0X2FsbD1saXN0IGFsbCBub2RlcyB3aXRoIFVVSURzLCBzZXRfcHJvcGVydHk9c2V0IGEgbm9kZSBwcm9wZXJ0eSwgc2V0X3RyYW5zZm9ybT1zZXQgcG9zaXRpb24vcm90YXRpb24vc2NhbGUsIGRlbGV0ZT1yZW1vdmUgbm9kZSBmcm9tIHNjZW5lLCBtb3ZlPXJlcGFyZW50IG5vZGUsIGR1cGxpY2F0ZT1jbG9uZSBub2RlLCBkZXRlY3RfdHlwZT1kZXRlY3QgaWYgbm9kZSBpcyAyRCBvciAzRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1dWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2luZm8sIHNldF9wcm9wZXJ0eSwgc2V0X3RyYW5zZm9ybSwgZGVsZXRlLCBkdXBsaWNhdGUsIGRldGVjdF90eXBlXSBOb2RlIFVVSUQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gTm9kZSBuYW1lLiBbZmluZF9ieV9uYW1lXSBFeGFjdCBub2RlIG5hbWUgdG8gZmluZCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXJlbnRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBQYXJlbnQgbm9kZSBVVUlELiBTVFJPTkdMWSBSRUNPTU1FTkRFRC4gVXNlIGdldF9hbGwgdG8gZmluZCBwYXJlbnQgVVVJRHMuIElmIG9taXR0ZWQsIG5vZGUgaXMgY3JlYXRlZCBhdCBzY2VuZSByb290LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnTm9kZScsICcyRE5vZGUnLCAnM0ROb2RlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBOb2RlIHR5cGU6IE5vZGUsIDJETm9kZSwgM0ROb2RlJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnTm9kZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzaWJsaW5nSW5kZXg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGUsIG1vdmVdIFNpYmxpbmcgaW5kZXggZm9yIG9yZGVyaW5nICgtMSBtZWFucyBhcHBlbmQgYXQgZW5kKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogLTFcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEFzc2V0IFVVSUQgdG8gaW5zdGFudGlhdGUgZnJvbSAoZS5nLiwgcHJlZmFiIFVVSUQpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzc2V0UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gQXNzZXQgcGF0aCB0byBpbnN0YW50aWF0ZSBmcm9tIChlLmcuLCBcImRiOi8vYXNzZXRzL3ByZWZhYnMvTXlQcmVmYWIucHJlZmFiXCIpLiBBbHRlcm5hdGl2ZSB0byBhc3NldFV1aWQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbXBvbmVudHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBBcnJheSBvZiBjb21wb25lbnQgdHlwZSBuYW1lcyB0byBhZGQgKGUuZy4sIFtcImNjLlNwcml0ZVwiLCBcImNjLkJ1dHRvblwiXSknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdW5saW5rUHJlZmFiOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gSWYgdHJ1ZSBhbmQgY3JlYXRpbmcgZnJvbSBwcmVmYWIsIHVubGluayBmcm9tIHByZWZhYiB0byBjcmVhdGUgYSByZWd1bGFyIG5vZGUnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZSwgbW92ZV0gV2hldGhlciB0byBrZWVwIHdvcmxkIHRyYW5zZm9ybScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsVHJhbnNmb3JtOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbjogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB4OiB7IHR5cGU6ICdudW1iZXInIH0sIHk6IHsgdHlwZTogJ251bWJlcicgfSwgejogeyB0eXBlOiAnbnVtYmVyJyB9IH0gfSxcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb246IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgeDogeyB0eXBlOiAnbnVtYmVyJyB9LCB5OiB7IHR5cGU6ICdudW1iZXInIH0sIHo6IHsgdHlwZTogJ251bWJlcicgfSB9IH0sXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHg6IHsgdHlwZTogJ251bWJlcicgfSwgeTogeyB0eXBlOiAnbnVtYmVyJyB9LCB6OiB7IHR5cGU6ICdudW1iZXInIH0gfSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIEluaXRpYWwgdHJhbnNmb3JtIHRvIGFwcGx5IGFmdGVyIGNyZWF0aW9uJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdHRlcm46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tmaW5kXSBOYW1lIHBhdHRlcm4gdG8gc2VhcmNoIGZvcidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBleGFjdE1hdGNoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2ZpbmRdIFVzZSBleGFjdCBtYXRjaCBpbnN0ZWFkIG9mIHBhcnRpYWwgbWF0Y2gnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IG5hbWUgKGUuZy4sIGFjdGl2ZSwgbmFtZSwgbGF5ZXIpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB2YWx1ZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2Jvb2xlYW4nLCAnbnVtYmVyJywgJ3N0cmluZyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIltzZXRfcHJvcGVydHldIE9wdGlvbmFsIHZhbHVlLXR5cGUgaGludCwgaG9ub3VyZWQgdGhlIHNhbWUgd2F5IG1hbmFnZV9jb21wb25lbnQgc2V0X3Byb3BlcnR5IGRvZXMuICdhY3RpdmUnIGlzIGNvZXJjZWQgYXMgYm9vbGVhbiBhdXRvbWF0aWNhbGx5IGV2ZW4gd2hlbiBvbWl0dGVkOyBwYXNzICdib29sZWFuJyBleHBsaWNpdGx5IGZvciBhbnkgb3RoZXIgYm9vbGVhbiBub2RlIHByb3BlcnR5IHRvIGF2b2lkIGEgdHJ1dGh5LXN0cmluZyBuby1vcCAoZS5nLiB2YWx1ZT1cXFwiZmFsc2VcXFwiIG92ZXIgYSB0cmFuc3BvcnQgdGhhdCBzdHJpbmdpZmllcyBhcmdzKS5cIlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdaIGNvb3JkaW5hdGUgKGlnbm9yZWQgZm9yIDJEIG5vZGVzKScgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RyYW5zZm9ybV0gTm9kZSBwb3NpdGlvbi4gRm9yIDJEIG5vZGVzLCBvbmx5IHgseSBhcmUgdXNlZC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm90YXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnSWdub3JlZCBmb3IgMkQgbm9kZXMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnSWdub3JlZCBmb3IgMkQgbm9kZXMnIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnTWFpbiByb3RhdGlvbiBheGlzIGZvciAyRCBub2RlcycgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RyYW5zZm9ybV0gTm9kZSByb3RhdGlvbiBpbiBldWxlciBhbmdsZXMuIEZvciAyRCBub2Rlcywgb25seSB6IGlzIHVzZWQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdVc3VhbGx5IDEgZm9yIDJEIG5vZGVzJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfdHJhbnNmb3JtXSBOb2RlIHNjYWxlLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW21vdmVdIE5vZGUgVVVJRCB0byBtb3ZlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5ld1BhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ttb3ZlXSBOZXcgcGFyZW50IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZHVwbGljYXRlXSBJbmNsdWRlIGNoaWxkcmVuIG5vZGVzJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmNyZWF0ZU5vZGUoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXROb2RlSW5mbyhhcmdzLnV1aWQpLFxuICAgICAgICBmaW5kOiAoYXJncykgPT4gdGhpcy5maW5kTm9kZXMoYXJncy5wYXR0ZXJuLCBjb2VyY2VCb29sKGFyZ3MuZXhhY3RNYXRjaCkgPz8gZmFsc2UpLFxuICAgICAgICBmaW5kX2J5X25hbWU6IChhcmdzKSA9PiB0aGlzLmZpbmROb2RlQnlOYW1lKGFyZ3MubmFtZSksXG4gICAgICAgIGdldF9hbGw6ICgpID0+IHRoaXMuZ2V0QWxsTm9kZXMoKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXROb2RlUHJvcGVydHkoYXJncy51dWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlLCBhcmdzLnByb3BlcnR5VHlwZSksXG4gICAgICAgIHNldF90cmFuc2Zvcm06IChhcmdzKSA9PiB0aGlzLnNldE5vZGVUcmFuc2Zvcm0oYXJncyksXG4gICAgICAgIGRlbGV0ZTogKGFyZ3MpID0+IHRoaXMuZGVsZXRlTm9kZShhcmdzLnV1aWQpLFxuICAgICAgICBtb3ZlOiAoYXJncykgPT4gdGhpcy5tb3ZlTm9kZShhcmdzLm5vZGVVdWlkLCBhcmdzLm5ld1BhcmVudFV1aWQsIGNvZXJjZUludChhcmdzLnNpYmxpbmdJbmRleCkgPz8gLTEsIGNvZXJjZUJvb2woYXJncy5rZWVwV29ybGRUcmFuc2Zvcm0pID8/IGZhbHNlKSxcbiAgICAgICAgZHVwbGljYXRlOiAoYXJncykgPT4gdGhpcy5kdXBsaWNhdGVOb2RlKGFyZ3MudXVpZCwgY29lcmNlQm9vbChhcmdzLmluY2x1ZGVDaGlsZHJlbikgPz8gdHJ1ZSksXG4gICAgICAgIGRldGVjdF90eXBlOiAoYXJncykgPT4gdGhpcy5kZXRlY3ROb2RlVHlwZShhcmdzLnV1aWQpXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlTm9kZShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCB0YXJnZXRQYXJlbnRVdWlkID0gYXJncy5wYXJlbnRVdWlkO1xuXG4gICAgICAgICAgICBpZiAoIXRhcmdldFBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzY2VuZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNjZW5lSW5mbyAmJiB0eXBlb2Ygc2NlbmVJbmZvID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShzY2VuZUluZm8pICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzY2VuZUluZm8sICd1dWlkJykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFBhcmVudFV1aWQgPSAoc2NlbmVJbmZvIGFzIGFueSkudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBObyBwYXJlbnQgc3BlY2lmaWVkLCB1c2luZyBzY2VuZSByb290OiAke3RhcmdldFBhcmVudFV1aWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShzY2VuZUluZm8pICYmIHNjZW5lSW5mby5sZW5ndGggPiAwICYmIHNjZW5lSW5mb1swXS51dWlkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRQYXJlbnRVdWlkID0gc2NlbmVJbmZvWzBdLnV1aWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTm8gcGFyZW50IHNwZWNpZmllZCwgdXNpbmcgc2NlbmUgcm9vdDogJHt0YXJnZXRQYXJlbnRVdWlkfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY3VycmVudFNjZW5lID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktY3VycmVudC1zY2VuZScpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnRTY2VuZSAmJiBjdXJyZW50U2NlbmUudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFBhcmVudFV1aWQgPSBjdXJyZW50U2NlbmUudXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBnZXQgc2NlbmUgcm9vdCwgd2lsbCB1c2UgZGVmYXVsdCBiZWhhdmlvcicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IGZpbmFsQXNzZXRVdWlkID0gYXJncy5hc3NldFV1aWQ7XG4gICAgICAgICAgICBsZXQgYXNzZXRUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoYXJncy5hc3NldFBhdGggJiYgIWZpbmFsQXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFyZ3MuYXNzZXRQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFzc2V0SW5mbyAmJiBhc3NldEluZm8udXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZmluYWxBc3NldFV1aWQgPSBhc3NldEluZm8udXVpZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0VHlwZSA9IGFzc2V0SW5mby50eXBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYEFzc2V0IHBhdGggJyR7YXJncy5hc3NldFBhdGh9JyByZXNvbHZlZCB0byBVVUlEOiAke2ZpbmFsQXNzZXRVdWlkfWApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBBc3NldCBub3QgZm91bmQgYXQgcGF0aDogJHthcmdzLmFzc2V0UGF0aH1gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZXNvbHZlIGFzc2V0IHBhdGggJyR7YXJncy5hc3NldFBhdGh9JzogJHtlcnJ9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOb2RlT3B0aW9uczogYW55ID0geyBuYW1lOiBhcmdzLm5hbWUgfTtcblxuICAgICAgICAgICAgaWYgKHRhcmdldFBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSB0YXJnZXRQYXJlbnRVdWlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZmluYWxBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5hc3NldFV1aWQgPSBmaW5hbEFzc2V0VXVpZDtcblxuICAgICAgICAgICAgICAgIC8vIGB0eXBlYCBzZWxlY3RzIHRoZSBjcmVhdGVOb2RlRnJvbUFzc2V0KCkgYnJhbmNoIHRoYXQgaW5zdGFudGlhdGVzIGFcbiAgICAgICAgICAgICAgICAvLyBsaW5rZWQgaW5zdGFuY2UgKGUuZy4gYSBwcmVmYWIncyBjYy5QcmVmYWJJbmZvL1ByZWZhYkluc3RhbmNlKS4gV2l0aG91dFxuICAgICAgICAgICAgICAgIC8vIGl0LCAzLjguNydzIG5vZGUgbWFuYWdlciBmYWxscyBiYWNrIHRvIGEgcGxhaW4gbm9kZSBidWlsdCBmcm9tIHRoZVxuICAgICAgICAgICAgICAgIC8vIGFzc2V0J3MgcmF3IGR1bXAg4oCUIGEgZmxhdHRlbmVkLCB1bmxpbmtlZCBjb3B5IHRoYXQgcmVwb3J0cyBzdWNjZXNzXG4gICAgICAgICAgICAgICAgLy8gYnV0IGNhcnJpZXMgbm8gcHJlZmFiIGxpbmsuIFJlc29sdmUgaXQgd2hlbiBub3QgYWxyZWFkeSBrbm93biBmcm9tIHRoZVxuICAgICAgICAgICAgICAgIC8vIGFzc2V0UGF0aCBsb29rdXAgYWJvdmUuXG4gICAgICAgICAgICAgICAgaWYgKCFhc3NldFR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgZmluYWxBc3NldFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXNzZXRUeXBlID0gaW5mbz8udHlwZTtcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byByZXNvbHZlIGFzc2V0IHR5cGUgZm9yICcke2ZpbmFsQXNzZXRVdWlkfSc6YCwgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoYXNzZXRUeXBlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLnR5cGUgPSBhc3NldFR5cGU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGNvZXJjZUJvb2woYXJncy51bmxpbmtQcmVmYWIpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLnVubGlua1ByZWZhYiA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXJncy5jb21wb25lbnRzICYmIGFyZ3MuY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMuY29tcG9uZW50cyA9IGFyZ3MuY29tcG9uZW50cztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYXJncy5ub2RlVHlwZSAmJiBhcmdzLm5vZGVUeXBlICE9PSAnTm9kZScgJiYgIWZpbmFsQXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMuY29tcG9uZW50cyA9IFthcmdzLm5vZGVUeXBlXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGNvZXJjZUJvb2woYXJncy5rZWVwV29ybGRUcmFuc2Zvcm0pKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMua2VlcFdvcmxkVHJhbnNmb3JtID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc2libGluZ0luZGV4ID0gY29lcmNlSW50KGFyZ3Muc2libGluZ0luZGV4KTtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coJ0NyZWF0aW5nIG5vZGUgd2l0aCBvcHRpb25zOicsIGNyZWF0ZU5vZGVPcHRpb25zKTtcblxuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIGNyZWF0ZU5vZGVPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBBcnJheS5pc0FycmF5KG5vZGVVdWlkKSA/IG5vZGVVdWlkWzBdIDogbm9kZVV1aWQ7XG5cbiAgICAgICAgICAgIGlmIChzaWJsaW5nSW5kZXggIT09IHVuZGVmaW5lZCAmJiBzaWJsaW5nSW5kZXggPj0gMCAmJiB1dWlkICYmIHRhcmdldFBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmF3YWl0Tm9kZUNvbW1pdCh1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXBhcmVudCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudDogdGFyZ2V0UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWRzOiBbdXVpZF0sXG4gICAgICAgICAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm06IGNvZXJjZUJvb2woYXJncy5rZWVwV29ybGRUcmFuc2Zvcm0pIHx8IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAvLyBCZXN0LWVmZm9ydCB2ZXJpZmljYXRpb246IHRoaXMgcmUtcGFyZW50IGlzIGEgc2Vjb25kYXJ5IG9yZGVyaW5nIHN0ZXBcbiAgICAgICAgICAgICAgICAgICAgLy8gYWZ0ZXIgbm9kZSBjcmVhdGlvbiBhbHJlYWR5IHN1Y2NlZWRlZCwgc28gYSBtaXNtYXRjaCBpcyBsb2dnZWQgcmF0aGVyXG4gICAgICAgICAgICAgICAgICAgIC8vIHRoYW4gZmFpbGluZyB0aGUgd2hvbGUgY3JlYXRlIOKAlCB0aGUgdmVyaWZpY2F0aW9uRGF0YSByZWFkLWJhY2sgYmVsb3dcbiAgICAgICAgICAgICAgICAgICAgLy8gc3RpbGwgcmVwb3J0cyB0aGUgbm9kZSdzIHRydWUgZmluYWwgcGFyZW50IGVpdGhlciB3YXkuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcmlmeUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXZlcmlmeUluZm8uc3VjY2VzcyB8fCB2ZXJpZnlJbmZvLmRhdGE/LnBhcmVudCAhPT0gdGFyZ2V0UGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBTaWJsaW5nLWluZGV4IHJlcGFyZW50IGRpZCBub3QgdmVyaWZ5OiBleHBlY3RlZCBwYXJlbnQgJyR7dGFyZ2V0UGFyZW50VXVpZH0nLCBnb3QgJyR7dmVyaWZ5SW5mby5kYXRhPy5wYXJlbnR9J2ApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignRmFpbGVkIHRvIHNldCBzaWJsaW5nIGluZGV4OicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXJncy5jb21wb25lbnRzICYmIGFyZ3MuY29tcG9uZW50cy5sZW5ndGggPiAwICYmIHV1aWQpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmF3YWl0Tm9kZUNvbW1pdCh1dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjb21wb25lbnRUeXBlIG9mIGFyZ3MuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtY29tcG9uZW50Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQ6IGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gYWRkZWQgc3VjY2Vzc2Z1bGx5YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBhZGQgY29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX06YCwgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBhZGQgY29tcG9uZW50czonLCBlcnIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFyZ3MuaW5pdGlhbFRyYW5zZm9ybSAmJiB1dWlkKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hd2FpdE5vZGVDb21taXQodXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHBvcyA9IG5vcm1hbGl6ZVZlYzMoYXJncy5pbml0aWFsVHJhbnNmb3JtLnBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgcm90ID0gbm9ybWFsaXplVmVjMyhhcmdzLmluaXRpYWxUcmFuc2Zvcm0ucm90YXRpb24pO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzY2wgPSBub3JtYWxpemVWZWMzKGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5zY2FsZSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0Tm9kZVRyYW5zZm9ybSh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHBvcyA/PyBhcmdzLmluaXRpYWxUcmFuc2Zvcm0ucG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogcm90ID8/IGFyZ3MuaW5pdGlhbFRyYW5zZm9ybS5yb3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlOiBzY2wgPz8gYXJncy5pbml0aWFsVHJhbnNmb3JtLnNjYWxlXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnSW5pdGlhbCB0cmFuc2Zvcm0gYXBwbGllZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gc2V0IGluaXRpYWwgdHJhbnNmb3JtOicsIGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgdmVyaWZpY2F0aW9uRGF0YTogYW55ID0gbnVsbDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChub2RlSW5mby5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWNhdGlvbkRhdGEgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlSW5mbzogbm9kZUluZm8uZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0aW9uRGV0YWlsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQ6IHRhcmdldFBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVR5cGU6IGFyZ3Mubm9kZVR5cGUgfHwgJ05vZGUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21Bc3NldDogISFmaW5hbEFzc2V0VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IGZpbmFsQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0UGF0aDogYXJncy5hc3NldFBhdGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBnZXQgdmVyaWZpY2F0aW9uIGRhdGE6JywgZXJyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgc3VjY2Vzc01lc3NhZ2UgPSBmaW5hbEFzc2V0VXVpZFxuICAgICAgICAgICAgICAgID8gYE5vZGUgJyR7YXJncy5uYW1lfScgaW5zdGFudGlhdGVkIGZyb20gYXNzZXQgc3VjY2Vzc2Z1bGx5YFxuICAgICAgICAgICAgICAgIDogYE5vZGUgJyR7YXJncy5uYW1lfScgY3JlYXRlZCBzdWNjZXNzZnVsbHlgO1xuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBhcmdzLm5hbWUsXG4gICAgICAgICAgICAgICAgcGFyZW50VXVpZDogdGFyZ2V0UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICBub2RlVHlwZTogYXJncy5ub2RlVHlwZSB8fCAnTm9kZScsXG4gICAgICAgICAgICAgICAgZnJvbUFzc2V0OiAhIWZpbmFsQXNzZXRVdWlkLFxuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogZmluYWxBc3NldFV1aWQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogc3VjY2Vzc01lc3NhZ2UsXG4gICAgICAgICAgICAgICAgdmVyaWZpY2F0aW9uRGF0YVxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGNyZWF0ZSBub2RlOiAke2Vyci5tZXNzYWdlfS4gQXJnczogJHtKU09OLnN0cmluZ2lmeShhcmdzKX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBzY2VuZTpjcmVhdGUtbm9kZWAgcmVzb2x2ZXMgYmVmb3JlIHRoZSBuZXcgbm9kZSBpcyBxdWVyeWFibGUsIHNvIHRoZSBmb2xsb3ctdXBcbiAgICAgKiBzZXQtcGFyZW50IC8gY3JlYXRlLWNvbXBvbmVudCAvIGluaXRpYWwtdHJhbnNmb3JtIHN0ZXBzIHVzZWQgdG8gd2FpdCBvdXQgYSBmaXhlZFxuICAgICAqIDEwMC0xNTBtcyBzbGVlcCBhbmQgdGhlbiBwcm9jZWVkIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgY29tbWl0IGhhZCBsYW5kZWQuIE9uIGFcbiAgICAgKiBidXN5IGVkaXRvciBpdCBoYWQgbm90LCBhbmQgdGhvc2UgZWRpdHMgd2VyZSBzaWxlbnRseSBkcm9wcGVkIGZyb20gdGhlIGNyZWF0ZWQgbm9kZVxuICAgICAqICgjNikuIFBvbGwgYHNjZW5lOnF1ZXJ5LW5vZGVgIGluc3RlYWQ6IGNvbnRpbnVlIGFzIHNvb24gYXMgdGhlIG5vZGUgaXMgYWN0dWFsbHlcbiAgICAgKiB2aXNpYmxlLCBhbmQgdGhyb3cgd2hlbiBpdCBuZXZlciBiZWNvbWVzIHZpc2libGUgc28gdGhlIGNhbGxlcidzIGV4aXN0aW5nIGNhdGNoXG4gICAgICogcmVwb3J0cyBhIHJlYWwgcmVhc29uIHJhdGhlciB0aGFuIGEgYmxpbmQgZmFpbHVyZSBmdXJ0aGVyIGRvd24uXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBhd2FpdE5vZGVDb21taXQodXVpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIE5PREVfQ09NTUlUX1RJTUVPVVRfTVM7XG4gICAgICAgIGZvciAoOzspIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEpIHJldHVybjtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIC8vIHF1ZXJ5LW5vZGUgcmVqZWN0cyB3aGlsZSB0aGUgbm9kZSBpcyBub3QgeWV0IGluIHRoZSBncmFwaCDigJQga2VlcCBwb2xsaW5nLlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKERhdGUubm93KCkgPj0gZGVhZGxpbmUpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJyR7dXVpZH0nIHdhcyBub3QgcXVlcnlhYmxlIHdpdGhpbiAke05PREVfQ09NTUlUX1RJTUVPVVRfTVN9bXMgb2YgY3JlYXRpb25gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCBOT0RFX0NPTU1JVF9QT0xMX01TKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVJbmZvKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3IgaW52YWxpZCByZXNwb25zZScpO1xuICAgICAgICAgICAgY29uc3QgaW5mbzogTm9kZUluZm8gPSB7XG4gICAgICAgICAgICAgICAgdXVpZDogbm9kZURhdGEudXVpZD8udmFsdWUgfHwgdXVpZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBub2RlRGF0YS5uYW1lPy52YWx1ZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgYWN0aXZlOiBub2RlRGF0YS5hY3RpdmU/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBub2RlRGF0YS5hY3RpdmUudmFsdWUgOiB0cnVlLFxuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBub2RlRGF0YS5wb3NpdGlvbj8udmFsdWUgfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH0sXG4gICAgICAgICAgICAgICAgcm90YXRpb246IG5vZGVEYXRhLnJvdGF0aW9uPy52YWx1ZSB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfSxcbiAgICAgICAgICAgICAgICBzY2FsZTogbm9kZURhdGEuc2NhbGU/LnZhbHVlIHx8IHsgeDogMSwgeTogMSwgejogMSB9LFxuICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZURhdGEucGFyZW50Py52YWx1ZT8udXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBub2RlRGF0YS5jaGlsZHJlbiB8fCBbXSxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiAobm9kZURhdGEuX19jb21wc19fIHx8IFtdKS5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKSxcbiAgICAgICAgICAgICAgICBsYXllcjogbm9kZURhdGEubGF5ZXI/LnZhbHVlIHx8IDEwNzM3NDE4MjQsXG4gICAgICAgICAgICAgICAgbW9iaWxpdHk6IG5vZGVEYXRhLm1vYmlsaXR5Py52YWx1ZSB8fCAwXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kTm9kZXMocGF0dGVybjogc3RyaW5nLCBleGFjdE1hdGNoOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFwYXR0ZXJuKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3BhdHRlcm4gaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1maW5kJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgc2VhcmNoVHJlZSA9IChub2RlOiBhbnksIGN1cnJlbnRQYXRoOiBzdHJpbmcgPSAnJykgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVQYXRoID0gY3VycmVudFBhdGggPyBgJHtjdXJyZW50UGF0aH0vJHtub2RlLm5hbWV9YCA6IG5vZGUubmFtZTtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVzID0gZXhhY3RNYXRjaFxuICAgICAgICAgICAgICAgICAgICA/IG5vZGUubmFtZSA9PT0gcGF0dGVyblxuICAgICAgICAgICAgICAgICAgICA6IG5vZGUubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHBhdHRlcm4udG9Mb3dlckNhc2UoKSk7XG4gICAgICAgICAgICAgICAgaWYgKG1hdGNoZXMpIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgcGF0aDogbm9kZVBhdGggfSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSBzZWFyY2hUcmVlKGNoaWxkLCBub2RlUGF0aCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICh0cmVlKSBzZWFyY2hUcmVlKHRyZWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobm9kZXMpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2ZpbmROb2RlcycsIGFyZ3M6IFtwYXR0ZXJuLCBleGFjdE1hdGNoXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgVHJlZSBzZWFyY2ggZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZpbmROb2RlQnlOYW1lKG5hbWU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5hbWUpIHJldHVybiBlcnJvclJlc3VsdCgnbmFtZSBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWZpbmRfYnlfbmFtZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHJlZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBjb25zdCBmb3VuZE5vZGUgPSBzZWFyY2hOb2RlSW5UcmVlKHRyZWUsIG5hbWUpO1xuICAgICAgICAgICAgaWYgKGZvdW5kTm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXVpZDogZm91bmROb2RlLnV1aWQsIG5hbWU6IGZvdW5kTm9kZS5uYW1lLCBwYXRoOiBnZXROb2RlUGF0aChmb3VuZE5vZGUpIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBOb2RlICcke25hbWV9JyBub3QgZm91bmRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdmaW5kTm9kZUJ5TmFtZScsIGFyZ3M6IFtuYW1lXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QWxsTm9kZXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3QgdHJhdmVyc2VUcmVlID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgdHlwZTogbm9kZS50eXBlLCBhY3RpdmU6IG5vZGUuYWN0aXZlLCBwYXRoOiBnZXROb2RlUGF0aChub2RlKSB9KTtcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHRyYXZlcnNlVHJlZShjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICh0cmVlICYmIHRyZWUuY2hpbGRyZW4pIHRyYXZlcnNlVHJlZSh0cmVlKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdG90YWxOb2Rlczogbm9kZXMubGVuZ3RoLCBub2RlcyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRBbGxOb2RlcycsIGFyZ3M6IFtdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIE5vZGUgcHJvcGVydGllcyB0aGF0IG11c3QgYmUgdHJlYXRlZCBhcyBib29sZWFuIGV2ZW4gd2hlbiBwcm9wZXJ0eVR5cGUgaXMgb21pdHRlZC4gKi9cbiAgICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBLTk9XTl9CT09MRUFOX05PREVfUFJPUEVSVElFUyA9IG5ldyBTZXQoWydhY3RpdmUnXSk7XG5cbiAgICAvKipcbiAgICAgKiBDb2VyY2UgYSBzZXRfcHJvcGVydHkgdmFsdWUgYnkgdGhlIHJlcXVlc3RlZCAob3IgaW5mZXJyZWQpIHByb3BlcnR5VHlwZS5cbiAgICAgKiBUaHJvd3Mgb24gYSB2YWx1ZSB0aGF0IGNhbm5vdCBiZSBjb2VyY2VkLCBzbyB0aGUgY2FsbGVyIHJldHVybnMgZXJyb3JSZXN1bHRcbiAgICAgKiBpbnN0ZWFkIG9mIHNpbGVudGx5IGZvcndhcmRpbmcgYSB2YWx1ZSB0aGUgZW5naW5lIHdpbGwgbWlzaW50ZXJwcmV0LlxuICAgICAqL1xuICAgIHByaXZhdGUgY29lcmNlTm9kZVByb3BlcnR5VmFsdWUocHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSwgcHJvcGVydHlUeXBlPzogc3RyaW5nKTogYW55IHtcbiAgICAgICAgY29uc3QgZWZmZWN0aXZlVHlwZSA9IHByb3BlcnR5VHlwZVxuICAgICAgICAgICAgfHwgKE1hbmFnZU5vZGUuS05PV05fQk9PTEVBTl9OT0RFX1BST1BFUlRJRVMuaGFzKHByb3BlcnR5KSA/ICdib29sZWFuJyA6IHVuZGVmaW5lZCk7XG5cbiAgICAgICAgaWYgKGVmZmVjdGl2ZVR5cGUgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IGNvZXJjZUJvb2wodmFsdWUpO1xuICAgICAgICAgICAgaWYgKGNvZXJjZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBleHBlY3RzIGEgYm9vbGVhbiB2YWx1ZSAodHJ1ZS9mYWxzZS8xLzAvXCJ0cnVlXCIvXCJmYWxzZVwiKSwgcmVjZWl2ZWQ6ICR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNvZXJjZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVmZmVjdGl2ZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gY29lcmNlRmxvYXQodmFsdWUpO1xuICAgICAgICAgICAgaWYgKGNvZXJjZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBleHBlY3RzIGEgbnVtZXJpYyB2YWx1ZSwgcmVjZWl2ZWQ6ICR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGNvZXJjZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlYWQgYSBub2RlIHByb3BlcnR5IGJhY2sgZnJvbSB0aGUgbGl2ZSBzY2VuZSBmb3Igc2V0X3Byb3BlcnR5IHZlcmlmaWNhdGlvbi5cbiAgICAgKiBPbmx5IHJlc29sdmVzIHRvcC1sZXZlbCBkdW1wIGVudHJpZXMgKGFjdGl2ZSwgbmFtZSwgbGF5ZXIsIG1vYmlsaXR5LCAuLi4pIOKAlCB0aGVcbiAgICAgKiBwcm9wZXJ0aWVzIHNldF9wcm9wZXJ0eSBhY3R1YWxseSBkb2N1bWVudHMuIGBmb3VuZDogZmFsc2VgIG1lYW5zIHRoZSBwYXRoIGNvdWxkXG4gICAgICogbm90IGJlIHJlc29sdmVkIHRoaXMgd2F5IChlLmcuIGEgbmVzdGVkIHByb3BlcnR5KSwgTk9UIHRoYXQgdGhlIHdyaXRlIGZhaWxlZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlYWROb2RlUHJvcGVydHkodXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nKTogUHJvbWlzZTx7IGZvdW5kOiBib29sZWFuOyB2YWx1ZTogYW55IH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IG5vZGVEYXRhID8gbm9kZURhdGFbcHJvcGVydHldIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKGVudHJ5ICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBlbnRyeSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IGZvdW5kOiB0cnVlLCB2YWx1ZTogZW50cnkudmFsdWUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmFsdWU6IHVuZGVmaW5lZCB9O1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB7IGZvdW5kOiBmYWxzZSwgdmFsdWU6IHVuZGVmaW5lZCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXROb2RlUHJvcGVydHkodXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55LCBwcm9wZXJ0eVR5cGU/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1dWlkIHx8ICFwcm9wZXJ0eSB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQsIHByb3BlcnR5LCBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249c2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJc3N1ZSAjNDc6IGEgYm9vbGVhbiBub2RlIHByb3BlcnR5IChhY3RpdmUsIC4uLikgc2VudCB0aHJvdWdoIGFueSB0cmFuc3BvcnRcbiAgICAgICAgLy8gdGhhdCBzdHJpbmdpZmllcyBhcmdzIGFycml2ZXMgYXMgYFwiZmFsc2VcImAg4oCUIGEgVFJVVEhZIHN0cmluZyDigJQgc29cbiAgICAgICAgLy8gYG5vZGUuYWN0aXZlID0gXCJmYWxzZVwiYCBzaWxlbnRseSBsZWF2ZXMgdGhlIG5vZGUgYWN0aXZlLiBDb2VyY2UgYnkgYW4gZXhwbGljaXRcbiAgICAgICAgLy8gcHJvcGVydHlUeXBlLCBvciBieSBhIGtub3duIGJvb2xlYW4gcHJvcGVydHkgbmFtZSB3aGVuIHByb3BlcnR5VHlwZSBpc1xuICAgICAgICAvLyBvbWl0dGVkLCB0aGUgc2FtZSB3YXkgbWFuYWdlX2NvbXBvbmVudCBzZXRfcHJvcGVydHkgaG9ub3VycyBwcm9wZXJ0eVR5cGUuXG4gICAgICAgIGxldCBjb2VyY2VkVmFsdWU6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvZXJjZWRWYWx1ZSA9IHRoaXMuY29lcmNlTm9kZVByb3BlcnR5VmFsdWUocHJvcGVydHksIHZhbHVlLCBwcm9wZXJ0eVR5cGUpO1xuICAgICAgICB9IGNhdGNoIChjb2VyY2VFcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGNvZXJjZUVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7IHV1aWQsIHBhdGg6IHByb3BlcnR5LCBkdW1wOiB7IHZhbHVlOiBjb2VyY2VkVmFsdWUgfSB9KTtcblxuICAgICAgICAgICAgLy8gSXNzdWUgIzQ3OiBgc2V0LXByb3BlcnR5YCByZXNvbHZpbmcgd2l0aG91dCB0aHJvd2luZyBkb2VzIE5PVCBtZWFuIHRoZVxuICAgICAgICAgICAgLy8gd3JpdGUgdG9vayBlZmZlY3Qg4oCUIHJlYWQgdGhlIHByb3BlcnR5IGJhY2sgYW5kIGNvbXBhcmUsIHRoZSBzYW1lXG4gICAgICAgICAgICAvLyB2ZXJpZnktZG9uJ3QtYXNzdW1lIGZpeCAjMzQvIzQyIGFscmVhZHkgYXBwbGllZCB0byBtYW5hZ2VfY29tcG9uZW50LlxuICAgICAgICAgICAgY29uc3QgdmVyaWZ5ID0gYXdhaXQgdGhpcy5yZWFkTm9kZVByb3BlcnR5KHV1aWQsIHByb3BlcnR5KTtcbiAgICAgICAgICAgIGlmICh2ZXJpZnkuZm91bmQgJiYgdmVyaWZ5LnZhbHVlICE9PSBjb2VyY2VkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHdyaXRlIGRpZCBub3QgdGFrZSBlZmZlY3Q6IHJlcXVlc3RlZCAke0pTT04uc3RyaW5naWZ5KGNvZXJjZWRWYWx1ZSl9LCBgICtcbiAgICAgICAgICAgICAgICAgICAgYGFjdHVhbCB2YWx1ZSBpcyAke0pTT04uc3RyaW5naWZ5KHZlcmlmeS52YWx1ZSl9LmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdmVyaWZpZWRTdWZmaXggPSB2ZXJpZnkuZm91bmQgPyAnJyA6ICcgKHVuYWJsZSB0byB2ZXJpZnkg4oCUIHJlYWQtYmFjayBkaWQgbm90IHJlc29sdmUgYSB2YWx1ZSBhdCB0aGlzIHByb3BlcnR5IHBhdGgpJztcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8odXVpZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogdXVpZCwgcHJvcGVydHksIG5ld1ZhbHVlOiBjb2VyY2VkVmFsdWUsIG5vZGVJbmZvOiBub2RlSW5mby5kYXRhLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VEZXRhaWxzOiB7IHByb3BlcnR5LCB2YWx1ZTogY29lcmNlZFZhbHVlLCB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSB9XG4gICAgICAgICAgICAgICAgfSwgYFByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHkke3ZlcmlmaWVkU3VmZml4fWApO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZDogdXVpZCwgcHJvcGVydHksIG5ld1ZhbHVlOiBjb2VyY2VkVmFsdWUgfSwgYFByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHkke3ZlcmlmaWVkU3VmZml4fWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldE5vZGVQcm9wZXJ0eScsIGFyZ3M6IFt1dWlkLCBwcm9wZXJ0eSwgY29lcmNlZFZhbHVlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Tm9kZVRyYW5zZm9ybShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgdXVpZCA9IGFyZ3MudXVpZDtcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3MucG9zaXRpb24pID8/IGFyZ3MucG9zaXRpb247XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnJvdGF0aW9uKSA/PyBhcmdzLnJvdGF0aW9uO1xuICAgICAgICBjb25zdCBzY2FsZSA9IG5vcm1hbGl6ZVZlYzMoYXJncy5zY2FsZSkgPz8gYXJncy5zY2FsZTtcblxuICAgICAgICBjb25zdCB1cGRhdGVQcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBbXTtcbiAgICAgICAgY29uc3QgdXBkYXRlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgd2FybmluZ3M6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKHV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlSW5mb1Jlc3BvbnNlLnN1Y2Nlc3MgfHwgIW5vZGVJbmZvUmVzcG9uc2UuZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCBub2RlIGluZm9ybWF0aW9uJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gbm9kZUluZm9SZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgY29uc3Qgbm9kZUlzMkQgPSBpczJETm9kZShub2RlSW5mbyk7XG5cbiAgICAgICAgICAgIGlmIChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVUcmFuc2Zvcm1WYWx1ZShwb3NpdGlvbiwgJ3Bvc2l0aW9uJywgbm9kZUlzMkQpO1xuICAgICAgICAgICAgICAgIGlmIChub3JtYWxpemVkLndhcm5pbmcpIHdhcm5pbmdzLnB1c2gobm9ybWFsaXplZC53YXJuaW5nKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVQcm9taXNlcy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLCBwYXRoOiAncG9zaXRpb24nLCBkdW1wOiB7IHZhbHVlOiBub3JtYWxpemVkLnZhbHVlIH1cbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHVwZGF0ZXMucHVzaCgncG9zaXRpb24nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHJvdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZCA9IG5vcm1hbGl6ZVRyYW5zZm9ybVZhbHVlKHJvdGF0aW9uLCAncm90YXRpb24nLCBub2RlSXMyRCk7XG4gICAgICAgICAgICAgICAgaWYgKG5vcm1hbGl6ZWQud2FybmluZykgd2FybmluZ3MucHVzaChub3JtYWxpemVkLndhcm5pbmcpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVByb21pc2VzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQsIHBhdGg6ICdyb3RhdGlvbicsIGR1bXA6IHsgdmFsdWU6IG5vcm1hbGl6ZWQudmFsdWUgfVxuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgdXBkYXRlcy5wdXNoKCdyb3RhdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2NhbGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplVHJhbnNmb3JtVmFsdWUoc2NhbGUsICdzY2FsZScsIG5vZGVJczJEKTtcbiAgICAgICAgICAgICAgICBpZiAobm9ybWFsaXplZC53YXJuaW5nKSB3YXJuaW5ncy5wdXNoKG5vcm1hbGl6ZWQud2FybmluZyk7XG4gICAgICAgICAgICAgICAgdXBkYXRlUHJvbWlzZXMucHVzaChcbiAgICAgICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCwgcGF0aDogJ3NjYWxlJywgZHVtcDogeyB2YWx1ZTogbm9ybWFsaXplZC52YWx1ZSB9XG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVzLnB1c2goJ3NjYWxlJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh1cGRhdGVQcm9taXNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ05vIHRyYW5zZm9ybSBwcm9wZXJ0aWVzIHNwZWNpZmllZCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbCh1cGRhdGVQcm9taXNlcyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZWROb2RlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Tm9kZUluZm8odXVpZCk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IEFjdGlvblRvb2xSZXN1bHQgPSB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgVHJhbnNmb3JtIHByb3BlcnRpZXMgdXBkYXRlZDogJHt1cGRhdGVzLmpvaW4oJywgJyl9ICR7bm9kZUlzMkQgPyAnKDJEIG5vZGUpJyA6ICcoM0Qgbm9kZSknfWAsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZVR5cGU6IG5vZGVJczJEID8gJzJEJyA6ICczRCcsXG4gICAgICAgICAgICAgICAgICAgIGFwcGxpZWRDaGFuZ2VzOiB1cGRhdGVzLFxuICAgICAgICAgICAgICAgICAgICB0cmFuc2Zvcm1Db25zdHJhaW50czoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGVJczJEID8gJ3gsIHkgb25seSAoeiBpZ25vcmVkKScgOiAneCwgeSwgeiBhbGwgdXNlZCcsXG4gICAgICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogbm9kZUlzMkQgPyAneiBvbmx5ICh4LCB5IGlnbm9yZWQpJyA6ICd4LCB5LCB6IGFsbCB1c2VkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjYWxlOiBub2RlSXMyRCA/ICd4LCB5IG1haW4sIHogdHlwaWNhbGx5IDEnIDogJ3gsIHksIHogYWxsIHVzZWQnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIG5vZGVJbmZvOiB1cGRhdGVkTm9kZUluZm8uZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgdHJhbnNmb3JtRGV0YWlsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxOb2RlVHlwZTogbm9kZUlzMkQgPyAnMkQnIDogJzNEJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFwcGxpZWRUcmFuc2Zvcm1zOiB1cGRhdGVzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgYmVmb3JlQWZ0ZXJDb21wYXJpc29uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBiZWZvcmU6IG5vZGVJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWZ0ZXI6IHVwZGF0ZWROb2RlSW5mby5kYXRhXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAod2FybmluZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIChyZXN1bHQgYXMgYW55KS53YXJuaW5nID0gd2FybmluZ3Muam9pbignOyAnKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gdXBkYXRlIHRyYW5zZm9ybTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZGVsZXRlTm9kZSh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1kZWxldGUnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1ub2RlJywgeyB1dWlkIH0pO1xuXG4gICAgICAgICAgICAvLyBJc3N1ZSAjNzQ6IGByZW1vdmUtbm9kZWAgcmVzb2x2aW5nIHdpdGhvdXQgdGhyb3dpbmcgZG9lcyBOT1QgbWVhbiB0aGUgbm9kZVxuICAgICAgICAgICAgLy8gYWN0dWFsbHkgbGVmdCB0aGUgZ3JhcGgg4oCUIGl0IHNpbGVudGx5IG5vLW9wcyBmb3IgYSBwcmVmYWItaW5zdGFuY2UgY2hpbGQgaW5cbiAgICAgICAgICAgIC8vIHNjZW5lLWVkaXQgY29udGV4dCAodGhlIHNhbWUgY2xhc3Mgb2YgY29uc3RyYWludCBtb3ZlTm9kZSBhbHJlYWR5IHZlcmlmaWVzXG4gICAgICAgICAgICAvLyBhZ2FpbnN0IGZvciAjMzMpLiBSZWFkIHRoZSBub2RlIGJhY2s6IGEgcmVqZWN0ZWQvZW1wdHkgcXVlcnktbm9kZSBtZWFucyB0aGVcbiAgICAgICAgICAgIC8vIG5vZGUgaXMgZ29uZSAoc3VjY2Vzcyk7IGEgbm9kZSB0aGF0IHN0aWxsIHJlc29sdmVzIG1lYW5zIHRoZSBkZWxldGUgd2FzXG4gICAgICAgICAgICAvLyBibG9ja2VkLiBUaGlzIGFsc28gZXhwbGFpbnMgaXNzdWUgIzczLCB3aGVyZSBcImRlbGV0ZWRcIiBub2RlcyByZWFwcGVhcmVkIOKAlFxuICAgICAgICAgICAgLy8gdGhlIGRlbGV0ZSBuZXZlciB0b29rIGVmZmVjdCwgc28gYSBsYXRlciBjcmVhdGUgbGVnaXRpbWF0ZWx5IHN0aWxsIHNhdyB0aGVtLlxuICAgICAgICAgICAgbGV0IHN0aWxsRXhpc3RzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICAgICAgc3RpbGxFeGlzdHMgPSAhIW5vZGVEYXRhO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgc3RpbGxFeGlzdHMgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzdGlsbEV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgYE5vZGUgJyR7dXVpZH0nIHN0aWxsIGV4aXN0cyBhZnRlciBkZWxldGU6IHRoZSBkZWxldGUgZGlkIG5vdCB0YWtlIGVmZmVjdC4gYCArXG4gICAgICAgICAgICAgICAgICAgIGBUaGlzIGNhbiBoYXBwZW4gd2hlbiB0aGUgbm9kZSBpcyBhIHByZWZhYiBpbnN0YW5jZSdzIGNoaWxkIGFuZCByZW1vdmFsIGlzIGJsb2NrZWQgYnkgdGhlIHByZWZhYiBsaW5rIOKAlCB0cnkgZGVsZXRpbmcgaXQgZnJvbSBwcmVmYWIgZWRpdCBtb2RlIGluc3RlYWQuYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdOb2RlIGRlbGV0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBtb3ZlTm9kZShub2RlVXVpZDogc3RyaW5nLCBuZXdQYXJlbnRVdWlkOiBzdHJpbmcsIHNpYmxpbmdJbmRleDogbnVtYmVyID0gLTEsIGtlZXBXb3JsZFRyYW5zZm9ybTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIW5ld1BhcmVudFV1aWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIG5ld1BhcmVudFV1aWQgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249bW92ZScpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcGFyZW50Jywge1xuICAgICAgICAgICAgICAgIHBhcmVudDogbmV3UGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICB1dWlkczogW25vZGVVdWlkXSxcbiAgICAgICAgICAgICAgICBrZWVwV29ybGRUcmFuc2Zvcm1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHNpYmxpbmdJbmRleCA+PSAwKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiAnc2libGluZ0luZGV4JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHNpYmxpbmdJbmRleCB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oJ0ZhaWxlZCB0byBzZXQgc2libGluZ0luZGV4IGFmdGVyIG1vdmU6JywgZXJyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFJlYWQgYmFjayB0aGUgYWN0dWFsIHBhcmVudC4gYHNldC1wYXJlbnRgIHNpbGVudGx5IG5vLW9wcyBmb3Igc29tZSBwcmVmYWItXG4gICAgICAgICAgICAvLyBpbnN0YW5jZSBjb25zdHJhaW50cyAoZS5nLiBtb3ZpbmcgYSBwcmVmYWIgcm9vdCBvdXQgZnJvbSB1bmRlciBpdHMgaW5zdGFuY2UpLFxuICAgICAgICAgICAgLy8gc28gYSByZXNvbHZlZCBwcm9taXNlIGhlcmUgZG9lcyBub3QgZ3VhcmFudGVlIHRoZSByZXBhcmVudCB0b29rIGVmZmVjdC5cbiAgICAgICAgICAgIGNvbnN0IHZlcmlmeUluZm8gPSBhd2FpdCB0aGlzLmdldE5vZGVJbmZvKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghdmVyaWZ5SW5mby5zdWNjZXNzIHx8ICF2ZXJpZnlJbmZvLmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYE5vZGUgbW92ZSBjb3VsZCBub3QgYmUgdmVyaWZpZWQ6IGZhaWxlZCB0byByZWFkIGJhY2sgbm9kZSAnJHtub2RlVXVpZH0nIGFmdGVyIHRoZSBtb3ZlLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHZlcmlmeUluZm8uZGF0YS5wYXJlbnQgIT09IG5ld1BhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIGBOb2RlIG1vdmUgZGlkIG5vdCB0YWtlIGVmZmVjdDogZXhwZWN0ZWQgcGFyZW50ICcke25ld1BhcmVudFV1aWR9JyBidXQgdGhlIG5vZGUgc3RpbGwgcmVwb3J0cyBwYXJlbnQgJyR7dmVyaWZ5SW5mby5kYXRhLnBhcmVudH0nLiBgICtcbiAgICAgICAgICAgICAgICAgICAgYFRoaXMgY2FuIGhhcHBlbiB3aGVuIHRoZSBub2RlIGlzIGEgcHJlZmFiIGluc3RhbmNlJ3Mgcm9vdCBhbmQgcmVwYXJlbnRpbmcgaXMgYmxvY2tlZCBieSB0aGUgcHJlZmFiIGxpbmsuYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbm9kZVV1aWQsIG5ld1BhcmVudFV1aWQsIG5vZGVJbmZvOiB2ZXJpZnlJbmZvLmRhdGEgfSwgJ05vZGUgbW92ZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkdXBsaWNhdGVOb2RlKHV1aWQ6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWR1cGxpY2F0ZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFpbmNsdWRlQ2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAvLyBTaGFsbG93IGR1cGxpY2F0ZTogY3JlYXRlIG5ldyBub2RlIHdpdGggc2FtZSBuYW1lL3BhcmVudCBidXQgbm8gY2hpbGRyZW5cbiAgICAgICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoIW5vZGVJbmZvUmVzcG9uc2Uuc3VjY2VzcyB8fCAhbm9kZUluZm9SZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCBub2RlIGluZm8gZm9yIHNoYWxsb3cgZHVwbGljYXRlJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gbm9kZUluZm9SZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld05vZGVVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGVJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZUluZm8ucGFyZW50IHx8IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5ld1V1aWQgPSBBcnJheS5pc0FycmF5KG5ld05vZGVVdWlkKSA/IG5ld05vZGVVdWlkWzBdIDogbmV3Tm9kZVV1aWQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBuZXdVdWlkLCBzaGFsbG93OiB0cnVlIH0sICdOb2RlIGR1cGxpY2F0ZWQgKHdpdGhvdXQgY2hpbGRyZW4pIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdkdXBsaWNhdGUtbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIG5ld1V1aWQ6IHJlc3VsdD8udXVpZCA/PyByZXN1bHQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ05vZGUgZHVwbGljYXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRldGVjdE5vZGVUeXBlKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWRldGVjdF90eXBlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5mb1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXROb2RlSW5mbyh1dWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm9SZXNwb25zZS5zdWNjZXNzIHx8ICFub2RlSW5mb1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0ZhaWxlZCB0byBnZXQgbm9kZSBpbmZvcm1hdGlvbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IG5vZGVJbmZvUmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIGNvbnN0IGlzMkQgPSBpczJETm9kZShub2RlSW5mbyk7XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gbm9kZUluZm8uY29tcG9uZW50cyB8fCBbXTtcblxuICAgICAgICAgICAgY29uc3QgZGV0ZWN0aW9uUmVhc29uczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICAgICAgY29uc3QgdHdvRENvbXBvbmVudHMgPSBjb21wb25lbnRzLmZpbHRlcigoY29tcDogYW55KSA9PiBpczJEQ29tcG9uZW50VHlwZShjb21wLnR5cGUpKTtcblxuICAgICAgICAgICAgY29uc3QgdGhyZWVEQ29tcG9uZW50cyA9IGNvbXBvbmVudHMuZmlsdGVyKChjb21wOiBhbnkpID0+IGlzM0RDb21wb25lbnRUeXBlKGNvbXAudHlwZSkpO1xuXG4gICAgICAgICAgICBpZiAodHdvRENvbXBvbmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaChgSGFzIDJEIGNvbXBvbmVudHM6ICR7dHdvRENvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aHJlZURDb21wb25lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBkZXRlY3Rpb25SZWFzb25zLnB1c2goYEhhcyAzRCBjb21wb25lbnRzOiAke3RocmVlRENvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTm9kZSBwb3NpdGlvbiBpcyBOT1QgdXNlZCB0byBpbmZlciAyRC1uZXNzOiBhIDNEIG5vZGUgbGVnaXRpbWF0ZWx5IHNpdHNcbiAgICAgICAgICAgIC8vIGF0IHRoZSBvcmlnaW4gKHogPSAwKS4gQWJzZW50IGEgMkQvVUkgY29tcG9uZW50LCB0aGUgbm9kZSBpcyB0cmVhdGVkIGFzIDNELlxuICAgICAgICAgICAgaWYgKHR3b0RDb21wb25lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRldGVjdGlvblJlYXNvbnMucHVzaCgnTm8gMkQvVUkgY29tcG9uZW50IGZvdW5kOyB0cmVhdGVkIGFzIDNEIChmdWxsIHgsIHksIHogdHJhbnNmb3JtKScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsXG4gICAgICAgICAgICAgICAgbm9kZU5hbWU6IG5vZGVJbmZvLm5hbWUsXG4gICAgICAgICAgICAgICAgbm9kZVR5cGU6IGlzMkQgPyAnMkQnIDogJzNEJyxcbiAgICAgICAgICAgICAgICBkZXRlY3Rpb25SZWFzb25zLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IGNvbXBvbmVudHMubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAudHlwZSxcbiAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnk6IGdldENvbXBvbmVudENhdGVnb3J5KGNvbXAudHlwZSlcbiAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGVJbmZvLnBvc2l0aW9uLFxuICAgICAgICAgICAgICAgIHRyYW5zZm9ybUNvbnN0cmFpbnRzOiB7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBpczJEID8gJ3gsIHkgb25seSAoeiBpZ25vcmVkKScgOiAneCwgeSwgeiBhbGwgdXNlZCcsXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uOiBpczJEID8gJ3ogb25seSAoeCwgeSBpZ25vcmVkKScgOiAneCwgeSwgeiBhbGwgdXNlZCcsXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlOiBpczJEID8gJ3gsIHkgbWFpbiwgeiB0eXBpY2FsbHkgMScgOiAneCwgeSwgeiBhbGwgdXNlZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZGV0ZWN0IG5vZGUgdHlwZTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19