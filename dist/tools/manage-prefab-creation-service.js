"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrefabCreationService = void 0;
/**
 * PrefabCreationService: handles the complex logic of creating Cocos Creator prefab files
 * programmatically. Extracted from ManagePrefab to keep manage-prefab.ts under 200 lines.
 *
 * Responsibilities:
 * - Fetching node data with component info from the scene
 * - Serializing node trees into Cocos Creator prefab JSON format
 * - Saving and re-importing asset files via asset-db
 * - Linking scene nodes to newly created prefab assets
 */
const fs = __importStar(require("fs"));
const asset_path_1 = require("../utils/asset-path");
const manage_component_property_helpers_1 = require("./manage-component-property-helpers");
/**
 * A dump entry is a property descriptor when it wraps a `value` and carries at least one
 * editor annotation. Deliberately looser than the inspector-side
 * `isValidPropertyDescriptor`, which rejects descriptors whose fields are all primitives
 * (`{ name, value: 60, type: 'Number' }`) because it is guarding a different case.
 */
function isPropertyDescriptor(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        return false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'value'))
        return false;
    return ['name', 'type', 'displayName', 'readonly'].some(k => Object.prototype.hasOwnProperty.call(entry, k));
}
/** Editor-only dump entries that have no serialized counterpart in a .prefab file. */
const DUMP_KEYS_NOT_SERIALIZED = new Set([
    'node', 'enabled', '__type__', 'uuid', 'name', '__scriptAsset',
    '_objFlags', '_name', '_id', '_enabled', '__prefab', '__editorExtras__'
]);
/** The envelope every serialized component carries even when it holds no properties. */
const BASE_COMPONENT_KEYS = new Set([
    '__type__', '_name', '_objFlags', '__editorExtras__', 'node', '_enabled', '__prefab', '_id'
]);
/**
 * Dump keys whose serialized field name differs (accessor-backed engine properties).
 *
 * Verified only for these four types — every other engine `cc.*`/`sp.*`/`dragonBones.*`
 * component falls through to the generic branch below, which emits the dump key
 * VERBATIM. For most engine types the dump key already matches the serialized key
 * (e.g. `cc.ParticleSystem2D`'s `emissionRate`), but an accessor-backed field on a type
 * not listed here would serialize under the WRONG key rather than being dropped — a
 * known, undetectable-without-a-live-editor limitation of this fix. Extend this table
 * as specific mismatches are confirmed against a running Cocos Creator 3.8.7 instance.
 */
const DUMP_KEY_RENAMES = {
    'cc.UITransform': { contentSize: '_contentSize', anchorPoint: '_anchorPoint' },
    'cc.Sprite': { spriteFrame: '_spriteFrame', type: '_type', sizeMode: '_sizeMode', fillType: '_fillType' },
    'cc.Label': { string: '_string', fontSize: '_fontSize', lineHeight: '_lineHeight', overflow: '_overflow' },
    'cc.Button': { target: '_target', interactable: '_interactable', transition: '_transition' },
};
/**
 * Gap-fillers, applied only to keys the dump did not supply. These are engine defaults —
 * never an override of a captured value.
 */
const COMPONENT_DEFAULTS = {
    'cc.UITransform': {
        _contentSize: { "__type__": "cc.Size", "width": 100, "height": 100 },
        _anchorPoint: { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 },
    },
    'cc.Sprite': {
        _spriteFrame: null, _type: 0, _fillType: 0, _sizeMode: 1,
        _fillCenter: { "__type__": "cc.Vec2", "x": 0, "y": 0 },
        _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false,
        _atlas: null,
    },
    'cc.Button': {
        _interactable: true, _transition: 3,
        _normalColor: { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
        _hoverColor: { "__type__": "cc.Color", "r": 211, "g": 211, "b": 211, "a": 255 },
        _pressedColor: { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
        _disabledColor: { "__type__": "cc.Color", "r": 124, "g": 124, "b": 124, "a": 255 },
        _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null,
        _duration: 0.1, _zoomScale: 1.2, _clickEvents: [],
    },
    'cc.Label': {
        _string: "Label", _horizontalAlign: 1, _verticalAlign: 1,
        _actualFontSize: 20, _fontSize: 20, _fontFamily: "Arial",
        _lineHeight: 25, _overflow: 0, _enableWrapText: true,
        _font: null, _isSystemFontUsed: true, _spacingX: 0,
        _isItalic: false, _isBold: false, _isUnderline: false,
        _underlineHeight: 2, _cacheMode: 0,
    },
};
class PrefabCreationService {
    async createPrefabWithAssetDB(nodeUuid, savePath, prefabName, includeChildren, includeComponents) {
        var _a;
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData)
                return { success: false, error: 'Cannot get node data' };
            const tempPrefabContent = JSON.stringify([{ "__type__": "cc.Prefab", "_name": prefabName }], null, 2);
            const createResult = await this.createAssetWithAssetDB(savePath, tempPrefabContent);
            if (!createResult.success)
                return createResult;
            const actualPrefabUuid = (_a = createResult.data) === null || _a === void 0 ? void 0 : _a.uuid;
            if (!actualPrefabUuid)
                return { success: false, error: 'Cannot get engine-assigned prefab UUID' };
            const prefabContent = await this.createStandardPrefabContent(nodeData, prefabName, actualPrefabUuid, includeChildren, includeComponents);
            await this.updateAssetWithAssetDB(savePath, JSON.stringify(prefabContent, null, 2));
            await this.createMetaWithAssetDB(savePath, this.createStandardMetaContent(prefabName, actualPrefabUuid));
            await this.reimportAssetWithAssetDB(savePath);
            // Read the asset back before reporting success. Components that were
            // configured in the scene but serialized to a bare envelope are a silent
            // data loss the caller cannot otherwise detect (#28).
            const readBack = await this.readBackPrefab(savePath, prefabContent);
            const lost = this.findComponentsThatLostProperties(readBack.data, nodeData);
            if (lost.length > 0) {
                return {
                    success: false,
                    fatal: true,
                    error: `Prefab written to ${savePath}, but these components serialized with no properties: ${lost.join(', ')}. The scene values were not captured — do not use this prefab.`,
                    data: { prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName, componentsWithoutProperties: lost, verifiedFrom: readBack.source }
                };
            }
            const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, actualPrefabUuid, savePath);
            return {
                success: true,
                data: {
                    prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName,
                    convertedToPrefabInstance: convertResult.success,
                    propertiesVerifiedFrom: readBack.source,
                    message: convertResult.success ? 'Prefab created and node converted' : 'Prefab created, node conversion failed'
                }
            };
        }
        catch (error) {
            return { success: false, error: `Failed to create prefab: ${error}` };
        }
    }
    createPrefabNativeStub() {
        return {
            success: false,
            error: 'Native prefab creation API not available',
            instruction: 'To create a prefab in Cocos Creator:\n1. Select a node in the scene\n2. Drag it to the Asset Browser\n3. Or right-click the node and select "Create Prefab"'
        };
    }
    async createPrefabCustom(nodeUuid, prefabPath, prefabName) {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData)
                return { success: false, error: `Node not found: ${nodeUuid}` };
            const prefabUuid = this.generateUUID();
            const prefabJsonData = await this.createStandardPrefabContent(nodeData, prefabName, prefabUuid, true, true);
            const saveResult = await this.savePrefabWithMeta(prefabPath, prefabJsonData, this.createStandardMetaContent(prefabName, prefabUuid));
            if (saveResult.success) {
                const lost = this.findComponentsThatLostProperties(prefabJsonData, nodeData);
                if (lost.length > 0) {
                    return {
                        success: false,
                        fatal: true,
                        error: `Prefab written to ${prefabPath}, but these components serialized with no properties: ${lost.join(', ')}. The scene values were not captured — do not use this prefab.`,
                        data: { prefabUuid, prefabPath, nodeUuid, prefabName, componentsWithoutProperties: lost }
                    };
                }
                const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, prefabPath, prefabUuid);
                return {
                    success: true,
                    data: {
                        prefabUuid, prefabPath, nodeUuid, prefabName,
                        convertedToPrefabInstance: convertResult.success,
                        message: convertResult.success ? 'Custom prefab created and node converted' : 'Prefab created, node conversion failed'
                    }
                };
            }
            return { success: false, error: saveResult.error || 'Failed to save prefab file' };
        }
        catch (error) {
            return { success: false, error: `Error creating prefab: ${error}` };
        }
    }
    // ===== Node data retrieval =====
    async getNodeData(nodeUuid) {
        try {
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo)
                return null;
            return await this.getNodeWithChildren(nodeUuid) || nodeInfo;
        }
        catch (_a) {
            return null;
        }
    }
    async getNodeWithChildren(nodeUuid) {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (!tree)
                return null;
            const targetNode = this.findNodeInTree(tree, nodeUuid);
            return targetNode ? await this.enhanceTreeWithMCPComponents(targetNode) : null;
        }
        catch (_a) {
            return null;
        }
    }
    /**
     * Enhance node tree with accurate component info via direct Editor API.
     * Replaces previous HTTP self-call to localhost:8585 which was fragile and port-dependent.
     */
    async enhanceTreeWithMCPComponents(node) {
        if (!node || !node.uuid)
            return node;
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', node.uuid);
            if (nodeData) {
                // Carry the transform dump through so createEngineStandardNode can read
                // position/rotation/scale instead of falling back to identity (issue #50).
                // The query-node dump shapes these as { value: { x, y, z } } (and w for quat),
                // which is exactly the shape createEngineStandardNode reads via nodeData.position?.value.
                if (nodeData.position)
                    node.position = nodeData.position;
                if (nodeData.rotation)
                    node.rotation = nodeData.rotation;
                if (nodeData.scale)
                    node.scale = nodeData.scale;
                // The layer is carried for the same reason: createEngineStandardNode hardcoded
                // DEFAULT, so every node of a created prefab landed on the DEFAULT layer and a
                // UI prefab (UI_2D) was culled by the UI camera — it rendered nothing.
                if (nodeData.layer !== undefined)
                    node.layer = nodeData.layer;
                if (nodeData.__comps__) {
                    // `properties` carries the live property dump through to serialization.
                    // Reducing each component to type/uuid/enabled discarded every configured
                    // value before it could be written, so `action=create` saved engine
                    // defaults for every component type (#28).
                    node.components = nodeData.__comps__.map((comp) => {
                        var _a, _b, _c;
                        return ({
                            type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                            // The dump nests the component's own uuid under value.uuid.value; the
                            // top-level comp.uuid does not exist (same shape ManageComponent.getComponents
                            // already accounts for). Reading only comp.uuid left componentUuidToIndex
                            // permanently empty, so every cross-component reference on a created prefab
                            // (e.g. a script's @property(MeshRenderer)/@property(Label) field pointing at
                            // a descendant node's component) silently serialized as null.
                            uuid: ((_b = (_a = comp.value) === null || _a === void 0 ? void 0 : _a.uuid) === null || _b === void 0 ? void 0 : _b.value) || ((_c = comp.uuid) === null || _c === void 0 ? void 0 : _c.value) || comp.uuid || null,
                            enabled: comp.enabled !== undefined ? comp.enabled : true,
                            properties: (0, manage_component_property_helpers_1.extractComponentPropertyDump)(comp)
                        });
                    });
                    console.log(`Node ${node.uuid} enhanced with ${node.components.length} components (incl. script types)`);
                }
            }
        }
        catch (error) {
            console.warn(`Failed to get component info for node ${node.uuid}:`, error);
        }
        if (node.children && Array.isArray(node.children)) {
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = await this.enhanceTreeWithMCPComponents(node.children[i]);
            }
        }
        return node;
    }
    findNodeInTree(node, targetUuid) {
        var _a;
        if (!node)
            return null;
        if (node.uuid === targetUuid || ((_a = node.value) === null || _a === void 0 ? void 0 : _a.uuid) === targetUuid)
            return node;
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                const found = this.findNodeInTree(child, targetUuid);
                if (found)
                    return found;
            }
        }
        return null;
    }
    getChildrenToProcess(nodeData) {
        const children = [];
        if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const child of nodeData.children) {
                if (this.isValidNodeData(child))
                    children.push(child);
            }
        }
        return children;
    }
    isValidNodeData(nodeData) {
        if (!nodeData || typeof nodeData !== 'object')
            return false;
        return nodeData.hasOwnProperty('uuid') || nodeData.hasOwnProperty('name') || nodeData.hasOwnProperty('__type__') ||
            (nodeData.value && (nodeData.value.hasOwnProperty('uuid') || nodeData.value.hasOwnProperty('name') || nodeData.value.hasOwnProperty('__type__')));
    }
    extractNodeUuid(nodeData) {
        if (!nodeData)
            return null;
        if (typeof nodeData.uuid === 'string')
            return nodeData.uuid;
        if (nodeData.value && typeof nodeData.value.uuid === 'string')
            return nodeData.value.uuid;
        return null;
    }
    // ===== Prefab serialization =====
    async createStandardPrefabContent(nodeData, prefabName, prefabUuid, includeChildren, includeComponents) {
        const prefabData = [];
        prefabData.push({
            "__type__": "cc.Prefab", "_name": prefabName || "", "_objFlags": 0, "__editorExtras__": {},
            "_native": "", "data": { "__id__": 1 }, "optimizationPolicy": 0, "persistent": false
        });
        const context = {
            prefabData, currentId: 2, prefabAssetIndex: 0,
            nodeFileIds: new Map(),
            nodeUuidToIndex: new Map(),
            componentUuidToIndex: new Map()
        };
        await this.createCompleteNodeTree(nodeData, null, 1, context, includeChildren, includeComponents, prefabName);
        return prefabData;
    }
    async createCompleteNodeTree(nodeData, parentNodeIndex, nodeIndex, context, includeChildren, includeComponents, nodeName) {
        const { prefabData } = context;
        const node = this.createEngineStandardNode(nodeData, parentNodeIndex, nodeName);
        while (prefabData.length <= nodeIndex)
            prefabData.push(null);
        prefabData[nodeIndex] = node;
        const nodeUuid = this.extractNodeUuid(nodeData);
        const fileId = nodeUuid || this.generateFileId();
        context.nodeFileIds.set(nodeIndex.toString(), fileId);
        if (nodeUuid)
            context.nodeUuidToIndex.set(nodeUuid, nodeIndex);
        const childrenToProcess = this.getChildrenToProcess(nodeData);
        if (includeChildren && childrenToProcess.length > 0) {
            const childIndices = [];
            for (let i = 0; i < childrenToProcess.length; i++) {
                const childIndex = context.currentId++;
                childIndices.push(childIndex);
                node._children.push({ "__id__": childIndex });
            }
            for (let i = 0; i < childrenToProcess.length; i++) {
                await this.createCompleteNodeTree(childrenToProcess[i], nodeIndex, childIndices[i], context, includeChildren, includeComponents, childrenToProcess[i].name || `Child${i + 1}`);
            }
        }
        if (includeComponents && nodeData.components && Array.isArray(nodeData.components)) {
            for (const component of nodeData.components) {
                const componentIndex = context.currentId++;
                node._components.push({ "__id__": componentIndex });
                const componentUuid = component.uuid || (component.value && component.value.uuid);
                if (componentUuid)
                    context.componentUuidToIndex.set(componentUuid, componentIndex);
                const componentObj = this.createComponentObject(component, nodeIndex, context);
                prefabData[componentIndex] = componentObj;
                const compPrefabInfoIndex = context.currentId++;
                prefabData[compPrefabInfoIndex] = { "__type__": "cc.CompPrefabInfo", "fileId": this.generateFileId() };
                if (componentObj && typeof componentObj === 'object')
                    componentObj.__prefab = { "__id__": compPrefabInfoIndex };
            }
        }
        const prefabInfoIndex = context.currentId++;
        node._prefab = { "__id__": prefabInfoIndex };
        prefabData[prefabInfoIndex] = {
            "__type__": "cc.PrefabInfo", "root": { "__id__": 1 }, "asset": { "__id__": context.prefabAssetIndex },
            "fileId": fileId, "targetOverrides": null, "nestedPrefabInstanceRoots": null, "instance": null
        };
        context.currentId = prefabInfoIndex + 1;
    }
    /**
     * Euler angles in DEGREES to a quaternion, matching `cc.Quat.fromEuler` exactly.
     * Verified against Cocos Creator 3.8.7: euler (10, 20, 30) serializes as
     * (0.12767944069578063, 0.18930785741199999, 0.2392983377447303, 0.943714364147489).
     */
    static eulerDegreesToQuat(e) {
        const halfToRad = 0.5 * Math.PI / 180;
        const x = (e.x || 0) * halfToRad, y = (e.y || 0) * halfToRad, z = (e.z || 0) * halfToRad;
        const sx = Math.sin(x), cx = Math.cos(x);
        const sy = Math.sin(y), cy = Math.cos(y);
        const sz = Math.sin(z), cz = Math.cos(z);
        return {
            x: sx * cy * cz + cx * sy * sz,
            y: cx * sy * cz + sx * cy * sz,
            z: cx * cy * sz - sx * sy * cz,
            w: cx * cy * cz - sx * sy * sz,
        };
    }
    createEngineStandardNode(nodeData, parentNodeIndex, nodeName) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const name = nodeName || ((_a = nodeData.name) === null || _a === void 0 ? void 0 : _a.value) || nodeData.name || 'Node';
        const lpos = ((_b = nodeData.position) === null || _b === void 0 ? void 0 : _b.value) || ((_c = nodeData.lpos) === null || _c === void 0 ? void 0 : _c.value) || nodeData._lpos || { x: 0, y: 0, z: 0 };
        const rotDump = ((_d = nodeData.rotation) === null || _d === void 0 ? void 0 : _d.value) || ((_e = nodeData.lrot) === null || _e === void 0 ? void 0 : _e.value) || nodeData._lrot || { x: 0, y: 0, z: 0, w: 1 };
        // `query-node` reports rotation as EULER DEGREES (cc.Vec3, no `w`) — the value the
        // inspector's Rotation field shows. `_lrot` is a quaternion, so passing the dump
        // straight through stored a degree in a quaternion component: a -0.1 degree tilt was
        // written as {z: -0.1, w: 1}, which the engine reads back as roughly -11.46 degrees.
        const isQuat = rotDump.w !== undefined;
        const lrot = isQuat ? rotDump : PrefabCreationService.eulerDegreesToQuat(rotDump);
        const euler = isQuat ? { x: 0, y: 0, z: 0 } : rotDump;
        const lscale = ((_f = nodeData.scale) === null || _f === void 0 ? void 0 : _f.value) || ((_g = nodeData.lscale) === null || _g === void 0 ? void 0 : _g.value) || nodeData._lscale || { x: 1, y: 1, z: 1 };
        const layerDump = ((_h = nodeData.layer) === null || _h === void 0 ? void 0 : _h.value) !== undefined ? nodeData.layer.value : nodeData.layer;
        const layer = typeof layerDump === 'number' ? layerDump : PrefabCreationService.DEFAULT_LAYER;
        return {
            "__type__": "cc.Node", "_name": name, "_objFlags": 0, "__editorExtras__": {},
            "_parent": parentNodeIndex !== null ? { "__id__": parentNodeIndex } : null,
            "_children": [], "_active": nodeData.active !== false, "_components": [], "_prefab": null,
            "_lpos": { "__type__": "cc.Vec3", "x": lpos.x || 0, "y": lpos.y || 0, "z": lpos.z || 0 },
            "_lrot": { "__type__": "cc.Quat", "x": lrot.x || 0, "y": lrot.y || 0, "z": lrot.z || 0, "w": lrot.w !== undefined ? lrot.w : 1 },
            "_lscale": { "__type__": "cc.Vec3", "x": lscale.x !== undefined ? lscale.x : 1, "y": lscale.y !== undefined ? lscale.y : 1, "z": lscale.z !== undefined ? lscale.z : 1 },
            "_mobility": 0, "_layer": layer,
            "_euler": { "__type__": "cc.Vec3", "x": euler.x || 0, "y": euler.y || 0, "z": euler.z || 0 }, "_id": ""
        };
    }
    /**
     * Serialize one component.
     *
     * The captured dump is the source of truth for every component type. The per-type
     * tables below only fill in keys the dump did not carry — they used to run *instead*
     * of the dump, which silently wrote engine defaults for `cc.UITransform`,
     * `cc.Sprite`, `cc.Button` and `cc.Label`, and wrote nothing at all for every other
     * type (#28).
     */
    createComponentObject(componentData, nodeIndex, context) {
        const componentType = componentData.type || componentData.__type__ || 'cc.Component';
        const enabled = componentData.enabled !== undefined ? componentData.enabled : true;
        const component = {
            "__type__": componentType, "_name": "", "_objFlags": 0, "__editorExtras__": {},
            "node": { "__id__": nodeIndex }, "_enabled": enabled, "__prefab": null
        };
        const properties = componentData.properties || {};
        const renames = DUMP_KEY_RENAMES[componentType] || {};
        for (const [key, value] of Object.entries(properties)) {
            if (DUMP_KEYS_NOT_SERIALIZED.has(key))
                continue;
            const propValue = this.processComponentProperty(value, context);
            if (propValue !== undefined)
                component[renames[key] || key] = propValue;
        }
        for (const [key, fallback] of Object.entries(COMPONENT_DEFAULTS[componentType] || {})) {
            if (!Object.prototype.hasOwnProperty.call(component, key)) {
                component[key] = typeof fallback === 'object' && fallback !== null ? JSON.parse(JSON.stringify(fallback)) : fallback;
            }
        }
        // A button with no captured target points at its own node, matching editor behaviour.
        if (componentType === 'cc.Button' && component._target === undefined) {
            component._target = { "__id__": nodeIndex };
        }
        // Ensure _id is last (matches engine serialization order)
        const _id = component._id || "";
        delete component._id;
        component._id = _id;
        return component;
    }
    /**
     * Count the dump entries that would actually be serialized, so the post-write check
     * only demands properties for components that had some.
     */
    countSerializableProps(properties) {
        if (!properties || typeof properties !== 'object')
            return 0;
        return Object.keys(properties).filter(k => !DUMP_KEYS_NOT_SERIALIZED.has(k)).length;
    }
    /**
     * Report component types that carried live properties in the scene but serialized to
     * nothing but the base envelope. `action=create` previously reported success in
     * exactly that state (#28).
     */
    findComponentsThatLostProperties(prefabData, nodeData) {
        const expected = new Set();
        const walk = (node) => {
            if (!node)
                return;
            for (const comp of (node.components || [])) {
                if (this.countSerializableProps(comp === null || comp === void 0 ? void 0 : comp.properties) > 0) {
                    expected.add(comp.type || comp.__type__ || 'Unknown');
                }
            }
            for (const child of (node.children || []))
                walk(child);
        };
        walk(nodeData);
        if (expected.size === 0)
            return [];
        const populated = new Set();
        for (const entry of prefabData) {
            if (!entry || typeof entry !== 'object' || !expected.has(entry.__type__))
                continue;
            if (Object.keys(entry).some(key => !BASE_COMPONENT_KEYS.has(key)))
                populated.add(entry.__type__);
        }
        return [...expected].filter(type => !populated.has(type));
    }
    /** Re-read the written prefab; falls back to the in-memory content when the path is unresolvable. */
    async readBackPrefab(savePath, fallback) {
        try {
            const resolved = await (0, asset_path_1.resolveAsset)(savePath);
            if (resolved.filePath) {
                const parsed = JSON.parse(fs.readFileSync(resolved.filePath, 'utf-8'));
                if (Array.isArray(parsed))
                    return { data: parsed, source: 'disk' };
            }
        }
        catch (_a) {
            // fall through to the in-memory content
        }
        return { data: fallback, source: 'in-memory' };
    }
    /**
     * An asset is either explicitly listed or named by a suffix no component type uses.
     * The suffix arm is what keeps a future concrete asset subclass from silently regressing
     * into the component-reference branch the way cc.TTFFont did.
     */
    static isAssetType(type) {
        if (!type)
            return false;
        if (PrefabCreationService.ASSET_TYPES.has(type))
            return true;
        return /(?:Font|Asset|Atlas|Clip)$/.test(type);
    }
    /**
     * Process component property values, ensuring format matches manually-created prefabs.
     * Handles node refs, asset refs, component refs, typed math/color objects, and arrays.
     */
    processComponentProperty(propData, context) {
        var _a, _b, _c, _d, _e;
        if (!propData || typeof propData !== 'object')
            return propData;
        const value = propData.value;
        const type = propData.type;
        if (value === null || value === undefined)
            return null;
        if (value && typeof value === 'object' && value.uuid === '')
            return null;
        // Node references
        if (type === 'cc.Node' && (value === null || value === void 0 ? void 0 : value.uuid)) {
            if ((_a = context === null || context === void 0 ? void 0 : context.nodeUuidToIndex) === null || _a === void 0 ? void 0 : _a.has(value.uuid))
                return { "__id__": context.nodeUuidToIndex.get(value.uuid) };
            console.warn(`Node ref UUID ${value.uuid} not in prefab context (external), setting null`);
            return null;
        }
        // Asset references.
        // The list must name CONCRETE types, not just base classes: a cc.Label's font dump reports
        // `cc.TTFFont`, never `cc.Font`. Missing here, it fell through to the component-reference
        // branch below, whose `type.startsWith('cc.')` catch-all matched it, found no entry in the
        // component index, and returned null — so every label in a created prefab lost its font.
        // The uuid is written verbatim. The editor's own serializer never compresses an asset
        // `__uuid__` in a .prefab/.scene; compressing one produced a reference that resolved to
        // nothing. This went unseen because a sprite-frame sub-asset uuid ('<uuid>@f9941') is 37
        // chars and failed the old compressor's 32-char guard, so sprites passed through intact
        // while every plain-uuid asset — fonts first — was mangled.
        if ((value === null || value === void 0 ? void 0 : value.uuid) && PrefabCreationService.isAssetType(type)) {
            return { "__uuid__": value.uuid, "__expectedType__": type };
        }
        // Component references
        if ((value === null || value === void 0 ? void 0 : value.uuid) && (type === 'cc.Component' || type === 'cc.Label' || type === 'cc.Button' || type === 'cc.Sprite' ||
            type === 'cc.UITransform' || type === 'cc.RigidBody2D' || type === 'cc.BoxCollider2D' ||
            type === 'cc.Animation' || type === 'cc.AudioSource' || ((type === null || type === void 0 ? void 0 : type.startsWith('cc.')) && !type.includes('@')))) {
            if ((_b = context === null || context === void 0 ? void 0 : context.componentUuidToIndex) === null || _b === void 0 ? void 0 : _b.has(value.uuid))
                return { "__id__": context.componentUuidToIndex.get(value.uuid) };
            console.warn(`Component ref ${type} UUID ${value.uuid} not in prefab context (external), setting null`);
            return null;
        }
        // Typed math/color objects
        if (value && typeof value === 'object') {
            if (type === 'cc.Color')
                return { "__type__": "cc.Color", "r": Math.min(255, Math.max(0, Number(value.r) || 0)), "g": Math.min(255, Math.max(0, Number(value.g) || 0)), "b": Math.min(255, Math.max(0, Number(value.b) || 0)), "a": value.a !== undefined ? Math.min(255, Math.max(0, Number(value.a))) : 255 };
            if (type === 'cc.Vec3')
                return { "__type__": "cc.Vec3", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0 };
            if (type === 'cc.Vec2')
                return { "__type__": "cc.Vec2", "x": Number(value.x) || 0, "y": Number(value.y) || 0 };
            if (type === 'cc.Size')
                return { "__type__": "cc.Size", "width": Number(value.width) || 0, "height": Number(value.height) || 0 };
            if (type === 'cc.Quat')
                return { "__type__": "cc.Quat", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0, "w": value.w !== undefined ? Number(value.w) : 1 };
        }
        // Array properties.
        // Each element of an array-typed dump (e.g. cc.MeshRenderer's sharedMaterials/
        // _materials) is itself a nested property descriptor — { value: { uuid }, type, ... }
        // — not a flat { uuid }. Reading item.uuid directly matched nothing for every element,
        // so a MeshRenderer's assigned material silently serialized as an empty array while
        // reporting success (verified live against a smart-imported FBX material).
        if (Array.isArray(value)) {
            const itemUuid = (item) => { var _a; return (item === null || item === void 0 ? void 0 : item.uuid) || ((_a = item === null || item === void 0 ? void 0 : item.value) === null || _a === void 0 ? void 0 : _a.uuid); };
            if (((_c = propData.elementTypeData) === null || _c === void 0 ? void 0 : _c.type) === 'cc.Node') {
                return value.map((item) => {
                    var _a;
                    const uuid = itemUuid(item);
                    if (uuid && ((_a = context === null || context === void 0 ? void 0 : context.nodeUuidToIndex) === null || _a === void 0 ? void 0 : _a.has(uuid)))
                        return { "__id__": context.nodeUuidToIndex.get(uuid) };
                    return null;
                }).filter(Boolean);
            }
            if ((_e = (_d = propData.elementTypeData) === null || _d === void 0 ? void 0 : _d.type) === null || _e === void 0 ? void 0 : _e.startsWith('cc.')) {
                return value.map((item) => {
                    const uuid = itemUuid(item);
                    return uuid ? { "__uuid__": uuid, "__expectedType__": propData.elementTypeData.type } : null;
                }).filter(Boolean);
            }
            return value.map((item) => (item === null || item === void 0 ? void 0 : item.value) !== undefined ? item.value : item);
        }
        // Nested CCClass group: the dump nests another descriptor map under `value`.
        // Serializing it verbatim would write editor descriptors ({name, value, type})
        // into the asset instead of the values themselves.
        if (value && typeof value === 'object' && !Array.isArray(value) && this.isNestedPropertyMap(value)) {
            const nested = type ? { "__type__": type } : {};
            for (const [key, entry] of Object.entries(value)) {
                if (DUMP_KEYS_NOT_SERIALIZED.has(key))
                    continue;
                const nestedValue = this.processComponentProperty(entry, context);
                if (nestedValue !== undefined)
                    nested[key] = nestedValue;
            }
            return nested;
        }
        // Other complex typed objects
        if (value && typeof value === 'object' && (type === null || type === void 0 ? void 0 : type.startsWith('cc.')))
            return Object.assign({ "__type__": type }, value);
        return value;
    }
    /** True when every entry is an object and at least one is a Cocos property descriptor. */
    isNestedPropertyMap(value) {
        const entries = Object.entries(value);
        if (entries.length === 0)
            return false;
        return entries.every(([, entry]) => entry !== null && typeof entry === 'object')
            && entries.some(([, entry]) => isPropertyDescriptor(entry));
    }
    // ===== Asset DB operations =====
    async convertNodeToPrefabInstance(nodeUuid, prefabRef, prefabUuid) {
        const methods = [
            () => Editor.Message.request('scene', 'connect-prefab-instance', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'set-prefab-connection', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'apply-prefab-link', { node: nodeUuid, prefab: prefabRef })
        ];
        for (const method of methods) {
            try {
                await method();
                return { success: true };
            }
            catch ( /* try next */_a) { /* try next */ }
        }
        return { success: false, error: 'All prefab connection methods failed' };
    }
    async savePrefabWithMeta(prefabPath, prefabData, metaData) {
        try {
            await this.saveAssetFile(prefabPath, JSON.stringify(prefabData, null, 2));
            await this.saveAssetFile(`${prefabPath}.meta`, JSON.stringify(metaData, null, 2));
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message || 'Failed to save prefab file' };
        }
    }
    async saveAssetFile(filePath, content) {
        const methods = [
            () => Editor.Message.request('asset-db', 'create-asset', filePath, content),
            () => Editor.Message.request('asset-db', 'save-asset', filePath, content),
            () => Editor.Message.request('asset-db', 'write-asset', filePath, content)
        ];
        for (const method of methods) {
            try {
                await method();
                return;
            }
            catch ( /* try next */_a) { /* try next */ }
        }
        throw new Error('All save methods failed');
    }
    async createAssetWithAssetDB(assetPath, content) {
        try {
            const assetInfo = await Editor.Message.request('asset-db', 'create-asset', assetPath, content, { overwrite: true, rename: false });
            return { success: true, data: assetInfo };
        }
        catch (error) {
            return { success: false, error: error.message || 'Failed to create asset file' };
        }
    }
    async createMetaWithAssetDB(assetPath, metaContent) {
        try {
            const assetInfo = await Editor.Message.request('asset-db', 'save-asset-meta', assetPath, JSON.stringify(metaContent, null, 2));
            return { success: true, data: assetInfo };
        }
        catch (error) {
            return { success: false, error: error.message || 'Failed to create meta file' };
        }
    }
    async reimportAssetWithAssetDB(assetPath) {
        try {
            const result = await Editor.Message.request('asset-db', 'reimport-asset', assetPath);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message || 'Failed to reimport asset' };
        }
    }
    async updateAssetWithAssetDB(assetPath, content) {
        try {
            const result = await Editor.Message.request('asset-db', 'save-asset', assetPath, content);
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error.message || 'Failed to update asset file' };
        }
    }
    // ===== Format validation =====
    validatePrefabFormat(prefabData) {
        const issues = [];
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
        if (!prefabData[0] || prefabData[0].__type__ !== 'cc.Prefab') {
            issues.push('First element must be cc.Prefab type');
        }
        prefabData.forEach((item) => {
            if (item.__type__ === 'cc.Node')
                nodeCount++;
            else if (item.__type__ && item.__type__.includes('cc.'))
                componentCount++;
        });
        if (nodeCount === 0)
            issues.push('Prefab must contain at least one node');
        return { isValid: issues.length === 0, issues, nodeCount, componentCount };
    }
    createStandardMetaContent(prefabName, prefabUuid) {
        return { "ver": "1.1.50", "importer": "prefab", "imported": true, "uuid": prefabUuid, "files": [".json"], "subMetas": {}, "userData": { "syncNodeName": prefabName } };
    }
    // ===== UUID utilities =====
    generateUUID() {
        const chars = '0123456789abcdef';
        let uuid = '';
        for (let i = 0; i < 32; i++) {
            if (i === 8 || i === 12 || i === 16 || i === 20)
                uuid += '-';
            uuid += chars[Math.floor(Math.random() * chars.length)];
        }
        return uuid;
    }
    generateFileId() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
        let fileId = '';
        for (let i = 0; i < 22; i++)
            fileId += chars[Math.floor(Math.random() * chars.length)];
        return fileId;
    }
}
exports.PrefabCreationService = PrefabCreationService;
/** `cc.Layers.Enum.DEFAULT` (1 << 30) — the fallback when a node dump carries no layer. */
PrefabCreationService.DEFAULT_LAYER = 1073741824;
/** Type names whose dump value is an ASSET reference rather than a component reference. */
PrefabCreationService.ASSET_TYPES = new Set([
    'cc.Prefab', 'cc.Texture2D', 'cc.SpriteFrame', 'cc.Material', 'cc.AnimationClip',
    'cc.AudioClip', 'cc.Font', 'cc.Asset', 'cc.TTFFont', 'cc.BitmapFont', 'cc.LabelAtlas',
    'cc.SpriteAtlas', 'cc.JsonAsset', 'cc.TextAsset', 'cc.ParticleAsset', 'cc.Mesh',
    'cc.Skeleton', 'cc.RenderTexture', 'cc.PhysicsMaterial', 'cc.SceneAsset', 'cc.EffectAsset',
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7O0dBU0c7QUFDSCx1Q0FBeUI7QUFDekIsb0RBQW1EO0FBQ25ELDJGQUFtRjtBQUVuRjs7Ozs7R0FLRztBQUNILFNBQVMsb0JBQW9CLENBQUMsS0FBVTtJQUNwQyxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzlFLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3hFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakgsQ0FBQztBQUVELHNGQUFzRjtBQUN0RixNQUFNLHdCQUF3QixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3JDLE1BQU0sRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZTtJQUM5RCxXQUFXLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGtCQUFrQjtDQUMxRSxDQUFDLENBQUM7QUFFSCx3RkFBd0Y7QUFDeEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcs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QUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRU8sY0FBYztRQUNsQixNQUFNLEtBQUssR0FBRyxrRUFBa0UsQ0FBQztRQUNqRixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFDaEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEVBQUU7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3ZGLE9BQU8sTUFBTSxDQUFDO0lBQ2xCLENBQUM7O0FBanBCTCxzREFtcEJDO0FBL1hHLDJGQUEyRjtBQUNuRSxtQ0FBYSxHQUFHLFVBQVUsQ0FBQztBQTRJbkQsMkZBQTJGO0FBQ25FLGlDQUFXLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDMUMsV0FBVyxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUsa0JBQWtCO0lBQ2hGLGNBQWMsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsZUFBZTtJQUNyRixnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLFNBQVM7SUFDL0UsYUFBYSxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLGVBQWUsRUFBRSxnQkFBZ0I7Q0FDN0YsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcmVmYWJDcmVhdGlvblNlcnZpY2U6IGhhbmRsZXMgdGhlIGNvbXBsZXggbG9naWMgb2YgY3JlYXRpbmcgQ29jb3MgQ3JlYXRvciBwcmVmYWIgZmlsZXNcbiAqIHByb2dyYW1tYXRpY2FsbHkuIEV4dHJhY3RlZCBmcm9tIE1hbmFnZVByZWZhYiB0byBrZWVwIG1hbmFnZS1wcmVmYWIudHMgdW5kZXIgMjAwIGxpbmVzLlxuICpcbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAtIEZldGNoaW5nIG5vZGUgZGF0YSB3aXRoIGNvbXBvbmVudCBpbmZvIGZyb20gdGhlIHNjZW5lXG4gKiAtIFNlcmlhbGl6aW5nIG5vZGUgdHJlZXMgaW50byBDb2NvcyBDcmVhdG9yIHByZWZhYiBKU09OIGZvcm1hdFxuICogLSBTYXZpbmcgYW5kIHJlLWltcG9ydGluZyBhc3NldCBmaWxlcyB2aWEgYXNzZXQtZGJcbiAqIC0gTGlua2luZyBzY2VuZSBub2RlcyB0byBuZXdseSBjcmVhdGVkIHByZWZhYiBhc3NldHNcbiAqL1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuXG4vKipcbiAqIEEgZHVtcCBlbnRyeSBpcyBhIHByb3BlcnR5IGRlc2NyaXB0b3Igd2hlbiBpdCB3cmFwcyBhIGB2YWx1ZWAgYW5kIGNhcnJpZXMgYXQgbGVhc3Qgb25lXG4gKiBlZGl0b3IgYW5ub3RhdGlvbi4gRGVsaWJlcmF0ZWx5IGxvb3NlciB0aGFuIHRoZSBpbnNwZWN0b3Itc2lkZVxuICogYGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3JgLCB3aGljaCByZWplY3RzIGRlc2NyaXB0b3JzIHdob3NlIGZpZWxkcyBhcmUgYWxsIHByaW1pdGl2ZXNcbiAqIChgeyBuYW1lLCB2YWx1ZTogNjAsIHR5cGU6ICdOdW1iZXInIH1gKSBiZWNhdXNlIGl0IGlzIGd1YXJkaW5nIGEgZGlmZmVyZW50IGNhc2UuXG4gKi9cbmZ1bmN0aW9uIGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5OiBhbnkpOiBib29sZWFuIHtcbiAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbnRyeSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlbnRyeSwgJ3ZhbHVlJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gWyduYW1lJywgJ3R5cGUnLCAnZGlzcGxheU5hbWUnLCAncmVhZG9ubHknXS5zb21lKGsgPT4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGVudHJ5LCBrKSk7XG59XG5cbi8qKiBFZGl0b3Itb25seSBkdW1wIGVudHJpZXMgdGhhdCBoYXZlIG5vIHNlcmlhbGl6ZWQgY291bnRlcnBhcnQgaW4gYSAucHJlZmFiIGZpbGUuICovXG5jb25zdCBEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQgPSBuZXcgU2V0KFtcbiAgICAnbm9kZScsICdlbmFibGVkJywgJ19fdHlwZV9fJywgJ3V1aWQnLCAnbmFtZScsICdfX3NjcmlwdEFzc2V0JyxcbiAgICAnX29iakZsYWdzJywgJ19uYW1lJywgJ19pZCcsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfX2VkaXRvckV4dHJhc19fJ1xuXSk7XG5cbi8qKiBUaGUgZW52ZWxvcGUgZXZlcnkgc2VyaWFsaXplZCBjb21wb25lbnQgY2FycmllcyBldmVuIHdoZW4gaXQgaG9sZHMgbm8gcHJvcGVydGllcy4gKi9cbmNvbnN0IEJBU0VfQ09NUE9ORU5UX0tFWVMgPSBuZXcgU2V0KFtcbiAgICAnX190eXBlX18nLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19fZWRpdG9yRXh0cmFzX18nLCAnbm9kZScsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfaWQnXG5dKTtcblxuLyoqXG4gKiBEdW1wIGtleXMgd2hvc2Ugc2VyaWFsaXplZCBmaWVsZCBuYW1lIGRpZmZlcnMgKGFjY2Vzc29yLWJhY2tlZCBlbmdpbmUgcHJvcGVydGllcykuXG4gKlxuICogVmVyaWZpZWQgb25seSBmb3IgdGhlc2UgZm91ciB0eXBlcyDigJQgZXZlcnkgb3RoZXIgZW5naW5lIGBjYy4qYC9gc3AuKmAvYGRyYWdvbkJvbmVzLipgXG4gKiBjb21wb25lbnQgZmFsbHMgdGhyb3VnaCB0byB0aGUgZ2VuZXJpYyBicmFuY2ggYmVsb3csIHdoaWNoIGVtaXRzIHRoZSBkdW1wIGtleVxuICogVkVSQkFUSU0uIEZvciBtb3N0IGVuZ2luZSB0eXBlcyB0aGUgZHVtcCBrZXkgYWxyZWFkeSBtYXRjaGVzIHRoZSBzZXJpYWxpemVkIGtleVxuICogKGUuZy4gYGNjLlBhcnRpY2xlU3lzdGVtMkRgJ3MgYGVtaXNzaW9uUmF0ZWApLCBidXQgYW4gYWNjZXNzb3ItYmFja2VkIGZpZWxkIG9uIGEgdHlwZVxuICogbm90IGxpc3RlZCBoZXJlIHdvdWxkIHNlcmlhbGl6ZSB1bmRlciB0aGUgV1JPTkcga2V5IHJhdGhlciB0aGFuIGJlaW5nIGRyb3BwZWQg4oCUIGFcbiAqIGtub3duLCB1bmRldGVjdGFibGUtd2l0aG91dC1hLWxpdmUtZWRpdG9yIGxpbWl0YXRpb24gb2YgdGhpcyBmaXguIEV4dGVuZCB0aGlzIHRhYmxlXG4gKiBhcyBzcGVjaWZpYyBtaXNtYXRjaGVzIGFyZSBjb25maXJtZWQgYWdhaW5zdCBhIHJ1bm5pbmcgQ29jb3MgQ3JlYXRvciAzLjguNyBpbnN0YW5jZS5cbiAqL1xuY29uc3QgRFVNUF9LRVlfUkVOQU1FUzogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgc3RyaW5nPj4gPSB7XG4gICAgJ2NjLlVJVHJhbnNmb3JtJzogeyBjb250ZW50U2l6ZTogJ19jb250ZW50U2l6ZScsIGFuY2hvclBvaW50OiAnX2FuY2hvclBvaW50JyB9LFxuICAgICdjYy5TcHJpdGUnOiB7IHNwcml0ZUZyYW1lOiAnX3Nwcml0ZUZyYW1lJywgdHlwZTogJ190eXBlJywgc2l6ZU1vZGU6ICdfc2l6ZU1vZGUnLCBmaWxsVHlwZTogJ19maWxsVHlwZScgfSxcbiAgICAnY2MuTGFiZWwnOiB7IHN0cmluZzogJ19zdHJpbmcnLCBmb250U2l6ZTogJ19mb250U2l6ZScsIGxpbmVIZWlnaHQ6ICdfbGluZUhlaWdodCcsIG92ZXJmbG93OiAnX292ZXJmbG93JyB9LFxuICAgICdjYy5CdXR0b24nOiB7IHRhcmdldDogJ190YXJnZXQnLCBpbnRlcmFjdGFibGU6ICdfaW50ZXJhY3RhYmxlJywgdHJhbnNpdGlvbjogJ190cmFuc2l0aW9uJyB9LFxufTtcblxuLyoqXG4gKiBHYXAtZmlsbGVycywgYXBwbGllZCBvbmx5IHRvIGtleXMgdGhlIGR1bXAgZGlkIG5vdCBzdXBwbHkuIFRoZXNlIGFyZSBlbmdpbmUgZGVmYXVsdHMg4oCUXG4gKiBuZXZlciBhbiBvdmVycmlkZSBvZiBhIGNhcHR1cmVkIHZhbHVlLlxuICovXG5jb25zdCBDT01QT05FTlRfREVGQVVMVFM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIGFueT4+ID0ge1xuICAgICdjYy5VSVRyYW5zZm9ybSc6IHtcbiAgICAgICAgX2NvbnRlbnRTaXplOiB7IFwiX190eXBlX19cIjogXCJjYy5TaXplXCIsIFwid2lkdGhcIjogMTAwLCBcImhlaWdodFwiOiAxMDAgfSxcbiAgICAgICAgX2FuY2hvclBvaW50OiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiAwLjUsIFwieVwiOiAwLjUgfSxcbiAgICB9LFxuICAgICdjYy5TcHJpdGUnOiB7XG4gICAgICAgIF9zcHJpdGVGcmFtZTogbnVsbCwgX3R5cGU6IDAsIF9maWxsVHlwZTogMCwgX3NpemVNb2RlOiAxLFxuICAgICAgICBfZmlsbENlbnRlcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogMCwgXCJ5XCI6IDAgfSxcbiAgICAgICAgX2ZpbGxTdGFydDogMCwgX2ZpbGxSYW5nZTogMCwgX2lzVHJpbW1lZE1vZGU6IHRydWUsIF91c2VHcmF5c2NhbGU6IGZhbHNlLFxuICAgICAgICBfYXRsYXM6IG51bGwsXG4gICAgfSxcbiAgICAnY2MuQnV0dG9uJzoge1xuICAgICAgICBfaW50ZXJhY3RhYmxlOiB0cnVlLCBfdHJhbnNpdGlvbjogMyxcbiAgICAgICAgX25vcm1hbENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9ob3ZlckNvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjExLCBcImdcIjogMjExLCBcImJcIjogMjExLCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9wcmVzc2VkQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyNTUsIFwiZ1wiOiAyNTUsIFwiYlwiOiAyNTUsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX2Rpc2FibGVkQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAxMjQsIFwiZ1wiOiAxMjQsIFwiYlwiOiAxMjQsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX25vcm1hbFNwcml0ZTogbnVsbCwgX2hvdmVyU3ByaXRlOiBudWxsLCBfcHJlc3NlZFNwcml0ZTogbnVsbCwgX2Rpc2FibGVkU3ByaXRlOiBudWxsLFxuICAgICAgICBfZHVyYXRpb246IDAuMSwgX3pvb21TY2FsZTogMS4yLCBfY2xpY2tFdmVudHM6IFtdLFxuICAgIH0sXG4gICAgJ2NjLkxhYmVsJzoge1xuICAgICAgICBfc3RyaW5nOiBcIkxhYmVsXCIsIF9ob3Jpem9udGFsQWxpZ246IDEsIF92ZXJ0aWNhbEFsaWduOiAxLFxuICAgICAgICBfYWN0dWFsRm9udFNpemU6IDIwLCBfZm9udFNpemU6IDIwLCBfZm9udEZhbWlseTogXCJBcmlhbFwiLFxuICAgICAgICBfbGluZUhlaWdodDogMjUsIF9vdmVyZmxvdzogMCwgX2VuYWJsZVdyYXBUZXh0OiB0cnVlLFxuICAgICAgICBfZm9udDogbnVsbCwgX2lzU3lzdGVtRm9udFVzZWQ6IHRydWUsIF9zcGFjaW5nWDogMCxcbiAgICAgICAgX2lzSXRhbGljOiBmYWxzZSwgX2lzQm9sZDogZmFsc2UsIF9pc1VuZGVybGluZTogZmFsc2UsXG4gICAgICAgIF91bmRlcmxpbmVIZWlnaHQ6IDIsIF9jYWNoZU1vZGU6IDAsXG4gICAgfSxcbn07XG5cbmV4cG9ydCBjbGFzcyBQcmVmYWJDcmVhdGlvblNlcnZpY2Uge1xuXG4gICAgYXN5bmMgY3JlYXRlUHJlZmFiV2l0aEFzc2V0REIobm9kZVV1aWQ6IHN0cmluZywgc2F2ZVBhdGg6IHN0cmluZywgcHJlZmFiTmFtZTogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgdGhpcy5nZXROb2RlRGF0YShub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDYW5ub3QgZ2V0IG5vZGUgZGF0YScgfTtcblxuICAgICAgICAgICAgY29uc3QgdGVtcFByZWZhYkNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShbeyBcIl9fdHlwZV9fXCI6IFwiY2MuUHJlZmFiXCIsIFwiX25hbWVcIjogcHJlZmFiTmFtZSB9XSwgbnVsbCwgMik7XG4gICAgICAgICAgICBjb25zdCBjcmVhdGVSZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0ZUFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgsIHRlbXBQcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGlmICghY3JlYXRlUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBjcmVhdGVSZXN1bHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFByZWZhYlV1aWQgPSBjcmVhdGVSZXN1bHQuZGF0YT8udXVpZDtcbiAgICAgICAgICAgIGlmICghYWN0dWFsUHJlZmFiVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGdldCBlbmdpbmUtYXNzaWduZWQgcHJlZmFiIFVVSUQnIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkNvbnRlbnQgPSBhd2FpdCB0aGlzLmNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YSwgcHJlZmFiTmFtZSwgYWN0dWFsUHJlZmFiVXVpZCwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cyk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZUFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgsIEpTT04uc3RyaW5naWZ5KHByZWZhYkNvbnRlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTWV0YVdpdGhBc3NldERCKHNhdmVQYXRoLCB0aGlzLmNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZSwgYWN0dWFsUHJlZmFiVXVpZCkpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWltcG9ydEFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgpO1xuXG4gICAgICAgICAgICAvLyBSZWFkIHRoZSBhc3NldCBiYWNrIGJlZm9yZSByZXBvcnRpbmcgc3VjY2Vzcy4gQ29tcG9uZW50cyB0aGF0IHdlcmVcbiAgICAgICAgICAgIC8vIGNvbmZpZ3VyZWQgaW4gdGhlIHNjZW5lIGJ1dCBzZXJpYWxpemVkIHRvIGEgYmFyZSBlbnZlbG9wZSBhcmUgYSBzaWxlbnRcbiAgICAgICAgICAgIC8vIGRhdGEgbG9zcyB0aGUgY2FsbGVyIGNhbm5vdCBvdGhlcndpc2UgZGV0ZWN0ICgjMjgpLlxuICAgICAgICAgICAgY29uc3QgcmVhZEJhY2sgPSBhd2FpdCB0aGlzLnJlYWRCYWNrUHJlZmFiKHNhdmVQYXRoLCBwcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGNvbnN0IGxvc3QgPSB0aGlzLmZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHJlYWRCYWNrLmRhdGEsIG5vZGVEYXRhKTtcbiAgICAgICAgICAgIGlmIChsb3N0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHdyaXR0ZW4gdG8gJHtzYXZlUGF0aH0sIGJ1dCB0aGVzZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzOiAke2xvc3Quam9pbignLCAnKX0uIFRoZSBzY2VuZSB2YWx1ZXMgd2VyZSBub3QgY2FwdHVyZWQg4oCUIGRvIG5vdCB1c2UgdGhpcyBwcmVmYWIuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGNvbXBvbmVudHNXaXRob3V0UHJvcGVydGllczogbG9zdCwgdmVyaWZpZWRGcm9tOiByZWFkQmFjay5zb3VyY2UgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZCwgYWN0dWFsUHJlZmFiVXVpZCwgc2F2ZVBhdGgpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbnZlcnRlZFRvUHJlZmFiSW5zdGFuY2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1ZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MgPyAnUHJlZmFiIGNyZWF0ZWQgYW5kIG5vZGUgY29udmVydGVkJyA6ICdQcmVmYWIgY3JlYXRlZCwgbm9kZSBjb252ZXJzaW9uIGZhaWxlZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpOiBhbnkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogJ05hdGl2ZSBwcmVmYWIgY3JlYXRpb24gQVBJIG5vdCBhdmFpbGFibGUnLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdUbyBjcmVhdGUgYSBwcmVmYWIgaW4gQ29jb3MgQ3JlYXRvcjpcXG4xLiBTZWxlY3QgYSBub2RlIGluIHRoZSBzY2VuZVxcbjIuIERyYWcgaXQgdG8gdGhlIEFzc2V0IEJyb3dzZXJcXG4zLiBPciByaWdodC1jbGljayB0aGUgbm9kZSBhbmQgc2VsZWN0IFwiQ3JlYXRlIFByZWZhYlwiJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIGNyZWF0ZVByZWZhYkN1c3RvbShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJQYXRoOiBzdHJpbmcsIHByZWZhYk5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZURhdGEobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSBub3QgZm91bmQ6ICR7bm9kZVV1aWR9YCB9O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJVdWlkID0gdGhpcy5nZW5lcmF0ZVVVSUQoKTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkpzb25EYXRhID0gYXdhaXQgdGhpcy5jcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGEsIHByZWZhYk5hbWUsIHByZWZhYlV1aWQsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgY29uc3Qgc2F2ZVJlc3VsdCA9IGF3YWl0IHRoaXMuc2F2ZVByZWZhYldpdGhNZXRhKHByZWZhYlBhdGgsIHByZWZhYkpzb25EYXRhLCB0aGlzLmNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZSwgcHJlZmFiVXVpZCkpO1xuXG4gICAgICAgICAgICBpZiAoc2F2ZVJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9zdCA9IHRoaXMuZmluZENvbXBvbmVudHNUaGF0TG9zdFByb3BlcnRpZXMocHJlZmFiSnNvbkRhdGEsIG5vZGVEYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBQcmVmYWIgd3JpdHRlbiB0byAke3ByZWZhYlBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIHByZWZhYlBhdGgsIHByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udmVydGVkVG9QcmVmYWJJbnN0YW5jZTogY29udmVydFJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY29udmVydFJlc3VsdC5zdWNjZXNzID8gJ0N1c3RvbSBwcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogc2F2ZVJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHNhdmUgcHJlZmFiIGZpbGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gTm9kZSBkYXRhIHJldHJpZXZhbCA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlRGF0YShub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm8pIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0Tm9kZVdpdGhDaGlsZHJlbihub2RlVXVpZCkgfHwgbm9kZUluZm87XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVXaXRoQ2hpbGRyZW4obm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBpZiAoIXRyZWUpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IHRoaXMuZmluZE5vZGVJblRyZWUodHJlZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHRhcmdldE5vZGUgPyBhd2FpdCB0aGlzLmVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHModGFyZ2V0Tm9kZSkgOiBudWxsO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5oYW5jZSBub2RlIHRyZWUgd2l0aCBhY2N1cmF0ZSBjb21wb25lbnQgaW5mbyB2aWEgZGlyZWN0IEVkaXRvciBBUEkuXG4gICAgICogUmVwbGFjZXMgcHJldmlvdXMgSFRUUCBzZWxmLWNhbGwgdG8gbG9jYWxob3N0Ojg1ODUgd2hpY2ggd2FzIGZyYWdpbGUgYW5kIHBvcnQtZGVwZW5kZW50LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyhub2RlOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBpZiAoIW5vZGUgfHwgIW5vZGUudXVpZCkgcmV0dXJuIG5vZGU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlLnV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2FycnkgdGhlIHRyYW5zZm9ybSBkdW1wIHRocm91Z2ggc28gY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIGNhbiByZWFkXG4gICAgICAgICAgICAgICAgLy8gcG9zaXRpb24vcm90YXRpb24vc2NhbGUgaW5zdGVhZCBvZiBmYWxsaW5nIGJhY2sgdG8gaWRlbnRpdHkgKGlzc3VlICM1MCkuXG4gICAgICAgICAgICAgICAgLy8gVGhlIHF1ZXJ5LW5vZGUgZHVtcCBzaGFwZXMgdGhlc2UgYXMgeyB2YWx1ZTogeyB4LCB5LCB6IH0gfSAoYW5kIHcgZm9yIHF1YXQpLFxuICAgICAgICAgICAgICAgIC8vIHdoaWNoIGlzIGV4YWN0bHkgdGhlIHNoYXBlIGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSByZWFkcyB2aWEgbm9kZURhdGEucG9zaXRpb24/LnZhbHVlLlxuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5wb3NpdGlvbikgbm9kZS5wb3NpdGlvbiA9IG5vZGVEYXRhLnBvc2l0aW9uO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5yb3RhdGlvbikgbm9kZS5yb3RhdGlvbiA9IG5vZGVEYXRhLnJvdGF0aW9uO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5zY2FsZSkgbm9kZS5zY2FsZSA9IG5vZGVEYXRhLnNjYWxlO1xuICAgICAgICAgICAgICAgIC8vIFRoZSBsYXllciBpcyBjYXJyaWVkIGZvciB0aGUgc2FtZSByZWFzb246IGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSBoYXJkY29kZWRcbiAgICAgICAgICAgICAgICAvLyBERUZBVUxULCBzbyBldmVyeSBub2RlIG9mIGEgY3JlYXRlZCBwcmVmYWIgbGFuZGVkIG9uIHRoZSBERUZBVUxUIGxheWVyIGFuZCBhXG4gICAgICAgICAgICAgICAgLy8gVUkgcHJlZmFiIChVSV8yRCkgd2FzIGN1bGxlZCBieSB0aGUgVUkgY2FtZXJhIOKAlCBpdCByZW5kZXJlZCBub3RoaW5nLlxuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5sYXllciAhPT0gdW5kZWZpbmVkKSBub2RlLmxheWVyID0gbm9kZURhdGEubGF5ZXI7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgICAgICAgICAvLyBgcHJvcGVydGllc2AgY2FycmllcyB0aGUgbGl2ZSBwcm9wZXJ0eSBkdW1wIHRocm91Z2ggdG8gc2VyaWFsaXphdGlvbi5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmVkdWNpbmcgZWFjaCBjb21wb25lbnQgdG8gdHlwZS91dWlkL2VuYWJsZWQgZGlzY2FyZGVkIGV2ZXJ5IGNvbmZpZ3VyZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gdmFsdWUgYmVmb3JlIGl0IGNvdWxkIGJlIHdyaXR0ZW4sIHNvIGBhY3Rpb249Y3JlYXRlYCBzYXZlZCBlbmdpbmVcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdHMgZm9yIGV2ZXJ5IGNvbXBvbmVudCB0eXBlICgjMjgpLlxuICAgICAgICAgICAgICAgICAgICBub2RlLmNvbXBvbmVudHMgPSBub2RlRGF0YS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgZHVtcCBuZXN0cyB0aGUgY29tcG9uZW50J3Mgb3duIHV1aWQgdW5kZXIgdmFsdWUudXVpZC52YWx1ZTsgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b3AtbGV2ZWwgY29tcC51dWlkIGRvZXMgbm90IGV4aXN0IChzYW1lIHNoYXBlIE1hbmFnZUNvbXBvbmVudC5nZXRDb21wb25lbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbHJlYWR5IGFjY291bnRzIGZvcikuIFJlYWRpbmcgb25seSBjb21wLnV1aWQgbGVmdCBjb21wb25lbnRVdWlkVG9JbmRleFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGVybWFuZW50bHkgZW1wdHksIHNvIGV2ZXJ5IGNyb3NzLWNvbXBvbmVudCByZWZlcmVuY2Ugb24gYSBjcmVhdGVkIHByZWZhYlxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gKGUuZy4gYSBzY3JpcHQncyBAcHJvcGVydHkoTWVzaFJlbmRlcmVyKS9AcHJvcGVydHkoTGFiZWwpIGZpZWxkIHBvaW50aW5nIGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhIGRlc2NlbmRhbnQgbm9kZSdzIGNvbXBvbmVudCkgc2lsZW50bHkgc2VyaWFsaXplZCBhcyBudWxsLlxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogY29tcC52YWx1ZT8udXVpZD8udmFsdWUgfHwgY29tcC51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAoY29tcClcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTm9kZSAke25vZGUudXVpZH0gZW5oYW5jZWQgd2l0aCAke25vZGUuY29tcG9uZW50cy5sZW5ndGh9IGNvbXBvbmVudHMgKGluY2wuIHNjcmlwdCB0eXBlcylgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBnZXQgY29tcG9uZW50IGluZm8gZm9yIG5vZGUgJHtub2RlLnV1aWR9OmAsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuW2ldID0gYXdhaXQgdGhpcy5lbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKG5vZGUuY2hpbGRyZW5baV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIHByaXZhdGUgZmluZE5vZGVJblRyZWUobm9kZTogYW55LCB0YXJnZXRVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBpZiAoIW5vZGUpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAobm9kZS51dWlkID09PSB0YXJnZXRVdWlkIHx8IG5vZGUudmFsdWU/LnV1aWQgPT09IHRhcmdldFV1aWQpIHJldHVybiBub2RlO1xuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZE5vZGVJblRyZWUoY2hpbGQsIHRhcmdldFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGZvdW5kO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGE6IGFueSk6IGFueVtdIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW46IGFueVtdID0gW107XG4gICAgICAgIGlmIChub2RlRGF0YS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlRGF0YS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsaWROb2RlRGF0YShjaGlsZCkpIGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG5cbiAgICBwcml2YXRlIGlzVmFsaWROb2RlRGF0YShub2RlRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghbm9kZURhdGEgfHwgdHlwZW9mIG5vZGVEYXRhICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ3V1aWQnKSB8fCBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpIHx8IG5vZGVEYXRhLmhhc093blByb3BlcnR5KCdfX3R5cGVfXycpIHx8XG4gICAgICAgICAgICAobm9kZURhdGEudmFsdWUgJiYgKG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCd1dWlkJykgfHwgbm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSB8fCBub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgnX190eXBlX18nKSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdE5vZGVVdWlkKG5vZGVEYXRhOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZURhdGEudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBub2RlRGF0YS51dWlkO1xuICAgICAgICBpZiAobm9kZURhdGEudmFsdWUgJiYgdHlwZW9mIG5vZGVEYXRhLnZhbHVlLnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gbm9kZURhdGEudmFsdWUudXVpZDtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gPT09PT0gUHJlZmFiIHNlcmlhbGl6YXRpb24gPT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50KG5vZGVEYXRhOiBhbnksIHByZWZhYk5hbWU6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxhbnlbXT4ge1xuICAgICAgICBjb25zdCBwcmVmYWJEYXRhOiBhbnlbXSA9IFtdO1xuICAgICAgICBwcmVmYWJEYXRhLnB1c2goe1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYlwiLCBcIl9uYW1lXCI6IHByZWZhYk5hbWUgfHwgXCJcIiwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJfbmF0aXZlXCI6IFwiXCIsIFwiZGF0YVwiOiB7IFwiX19pZF9fXCI6IDEgfSwgXCJvcHRpbWl6YXRpb25Qb2xpY3lcIjogMCwgXCJwZXJzaXN0ZW50XCI6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgICAgICAgICBwcmVmYWJEYXRhLCBjdXJyZW50SWQ6IDIsIHByZWZhYkFzc2V0SW5kZXg6IDAsXG4gICAgICAgICAgICBub2RlRmlsZUlkczogbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKSxcbiAgICAgICAgICAgIG5vZGVVdWlkVG9JbmRleDogbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFV1aWRUb0luZGV4OiBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpXG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVDb21wbGV0ZU5vZGVUcmVlKG5vZGVEYXRhLCBudWxsLCAxLCBjb250ZXh0LCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgcmV0dXJuIHByZWZhYkRhdGE7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICBub2RlRGF0YTogYW55LCBwYXJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwsIG5vZGVJbmRleDogbnVtYmVyLFxuICAgICAgICBjb250ZXh0OiB7IHByZWZhYkRhdGE6IGFueVtdOyBjdXJyZW50SWQ6IG51bWJlcjsgcHJlZmFiQXNzZXRJbmRleDogbnVtYmVyOyBub2RlRmlsZUlkczogTWFwPHN0cmluZywgc3RyaW5nPjsgbm9kZVV1aWRUb0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+OyBjb21wb25lbnRVdWlkVG9JbmRleDogTWFwPHN0cmluZywgbnVtYmVyPiB9LFxuICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuLCBub2RlTmFtZT86IHN0cmluZ1xuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByZWZhYkRhdGEgfSA9IGNvbnRleHQ7XG4gICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZShub2RlRGF0YSwgcGFyZW50Tm9kZUluZGV4LCBub2RlTmFtZSk7XG5cbiAgICAgICAgd2hpbGUgKHByZWZhYkRhdGEubGVuZ3RoIDw9IG5vZGVJbmRleCkgcHJlZmFiRGF0YS5wdXNoKG51bGwpO1xuICAgICAgICBwcmVmYWJEYXRhW25vZGVJbmRleF0gPSBub2RlO1xuXG4gICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdGhpcy5leHRyYWN0Tm9kZVV1aWQobm9kZURhdGEpO1xuICAgICAgICBjb25zdCBmaWxlSWQgPSBub2RlVXVpZCB8fCB0aGlzLmdlbmVyYXRlRmlsZUlkKCk7XG4gICAgICAgIGNvbnRleHQubm9kZUZpbGVJZHMuc2V0KG5vZGVJbmRleC50b1N0cmluZygpLCBmaWxlSWQpO1xuICAgICAgICBpZiAobm9kZVV1aWQpIGNvbnRleHQubm9kZVV1aWRUb0luZGV4LnNldChub2RlVXVpZCwgbm9kZUluZGV4KTtcblxuICAgICAgICBjb25zdCBjaGlsZHJlblRvUHJvY2VzcyA9IHRoaXMuZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGEpO1xuICAgICAgICBpZiAoaW5jbHVkZUNoaWxkcmVuICYmIGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kaWNlczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBjaGlsZEluZGljZXMucHVzaChjaGlsZEluZGV4KTtcbiAgICAgICAgICAgICAgICBub2RlLl9jaGlsZHJlbi5wdXNoKHsgXCJfX2lkX19cIjogY2hpbGRJbmRleCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbXBsZXRlTm9kZVRyZWUoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuVG9Qcm9jZXNzW2ldLCBub2RlSW5kZXgsIGNoaWxkSW5kaWNlc1tpXSwgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cywgY2hpbGRyZW5Ub1Byb2Nlc3NbaV0ubmFtZSB8fCBgQ2hpbGQke2kgKyAxfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzICYmIG5vZGVEYXRhLmNvbXBvbmVudHMgJiYgQXJyYXkuaXNBcnJheShub2RlRGF0YS5jb21wb25lbnRzKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wb25lbnQgb2Ygbm9kZURhdGEuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBub2RlLl9jb21wb25lbnRzLnB1c2goeyBcIl9faWRfX1wiOiBjb21wb25lbnRJbmRleCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gY29tcG9uZW50LnV1aWQgfHwgKGNvbXBvbmVudC52YWx1ZSAmJiBjb21wb25lbnQudmFsdWUudXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudFV1aWQpIGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguc2V0KGNvbXBvbmVudFV1aWQsIGNvbXBvbmVudEluZGV4KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRPYmogPSB0aGlzLmNyZWF0ZUNvbXBvbmVudE9iamVjdChjb21wb25lbnQsIG5vZGVJbmRleCwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0gPSBjb21wb25lbnRPYmo7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZm9JbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgcHJlZmFiRGF0YVtjb21wUHJlZmFiSW5mb0luZGV4XSA9IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbXBQcmVmYWJJbmZvXCIsIFwiZmlsZUlkXCI6IHRoaXMuZ2VuZXJhdGVGaWxlSWQoKSB9O1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRPYmogJiYgdHlwZW9mIGNvbXBvbmVudE9iaiA9PT0gJ29iamVjdCcpIGNvbXBvbmVudE9iai5fX3ByZWZhYiA9IHsgXCJfX2lkX19cIjogY29tcFByZWZhYkluZm9JbmRleCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgbm9kZS5fcHJlZmFiID0geyBcIl9faWRfX1wiOiBwcmVmYWJJbmZvSW5kZXggfTtcbiAgICAgICAgcHJlZmFiRGF0YVtwcmVmYWJJbmZvSW5kZXhdID0ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYkluZm9cIiwgXCJyb290XCI6IHsgXCJfX2lkX19cIjogMSB9LCBcImFzc2V0XCI6IHsgXCJfX2lkX19cIjogY29udGV4dC5wcmVmYWJBc3NldEluZGV4IH0sXG4gICAgICAgICAgICBcImZpbGVJZFwiOiBmaWxlSWQsIFwidGFyZ2V0T3ZlcnJpZGVzXCI6IG51bGwsIFwibmVzdGVkUHJlZmFiSW5zdGFuY2VSb290c1wiOiBudWxsLCBcImluc3RhbmNlXCI6IG51bGxcbiAgICAgICAgfTtcbiAgICAgICAgY29udGV4dC5jdXJyZW50SWQgPSBwcmVmYWJJbmZvSW5kZXggKyAxO1xuICAgIH1cblxuICAgIC8qKiBgY2MuTGF5ZXJzLkVudW0uREVGQVVMVGAgKDEgPDwgMzApIOKAlCB0aGUgZmFsbGJhY2sgd2hlbiBhIG5vZGUgZHVtcCBjYXJyaWVzIG5vIGxheWVyLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfTEFZRVIgPSAxMDczNzQxODI0O1xuXG4gICAgLyoqXG4gICAgICogRXVsZXIgYW5nbGVzIGluIERFR1JFRVMgdG8gYSBxdWF0ZXJuaW9uLCBtYXRjaGluZyBgY2MuUXVhdC5mcm9tRXVsZXJgIGV4YWN0bHkuXG4gICAgICogVmVyaWZpZWQgYWdhaW5zdCBDb2NvcyBDcmVhdG9yIDMuOC43OiBldWxlciAoMTAsIDIwLCAzMCkgc2VyaWFsaXplcyBhc1xuICAgICAqICgwLjEyNzY3OTQ0MDY5NTc4MDYzLCAwLjE4OTMwNzg1NzQxMTk5OTk5LCAwLjIzOTI5ODMzNzc0NDczMDMsIDAuOTQzNzE0MzY0MTQ3NDg5KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBldWxlckRlZ3JlZXNUb1F1YXQoZTogYW55KTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyB3OiBudW1iZXIgfSB7XG4gICAgICAgIGNvbnN0IGhhbGZUb1JhZCA9IDAuNSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIGNvbnN0IHggPSAoZS54IHx8IDApICogaGFsZlRvUmFkLCB5ID0gKGUueSB8fCAwKSAqIGhhbGZUb1JhZCwgeiA9IChlLnogfHwgMCkgKiBoYWxmVG9SYWQ7XG4gICAgICAgIGNvbnN0IHN4ID0gTWF0aC5zaW4oeCksIGN4ID0gTWF0aC5jb3MoeCk7XG4gICAgICAgIGNvbnN0IHN5ID0gTWF0aC5zaW4oeSksIGN5ID0gTWF0aC5jb3MoeSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oeiksIGN6ID0gTWF0aC5jb3Moeik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBzeCAqIGN5ICogY3ogKyBjeCAqIHN5ICogc3osXG4gICAgICAgICAgICB5OiBjeCAqIHN5ICogY3ogKyBzeCAqIGN5ICogc3osXG4gICAgICAgICAgICB6OiBjeCAqIGN5ICogc3ogLSBzeCAqIHN5ICogY3osXG4gICAgICAgICAgICB3OiBjeCAqIGN5ICogY3ogLSBzeCAqIHN5ICogc3osXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUobm9kZURhdGE6IGFueSwgcGFyZW50Tm9kZUluZGV4OiBudW1iZXIgfCBudWxsLCBub2RlTmFtZT86IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBub2RlTmFtZSB8fCBub2RlRGF0YS5uYW1lPy52YWx1ZSB8fCBub2RlRGF0YS5uYW1lIHx8ICdOb2RlJztcbiAgICAgICAgY29uc3QgbHBvcyA9IG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZSB8fCBub2RlRGF0YS5scG9zPy52YWx1ZSB8fCBub2RlRGF0YS5fbHBvcyB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcbiAgICAgICAgY29uc3Qgcm90RHVtcCA9IG5vZGVEYXRhLnJvdGF0aW9uPy52YWx1ZSB8fCBub2RlRGF0YS5scm90Py52YWx1ZSB8fCBub2RlRGF0YS5fbHJvdCB8fCB7IHg6IDAsIHk6IDAsIHo6IDAsIHc6IDEgfTtcbiAgICAgICAgLy8gYHF1ZXJ5LW5vZGVgIHJlcG9ydHMgcm90YXRpb24gYXMgRVVMRVIgREVHUkVFUyAoY2MuVmVjMywgbm8gYHdgKSDigJQgdGhlIHZhbHVlIHRoZVxuICAgICAgICAvLyBpbnNwZWN0b3IncyBSb3RhdGlvbiBmaWVsZCBzaG93cy4gYF9scm90YCBpcyBhIHF1YXRlcm5pb24sIHNvIHBhc3NpbmcgdGhlIGR1bXBcbiAgICAgICAgLy8gc3RyYWlnaHQgdGhyb3VnaCBzdG9yZWQgYSBkZWdyZWUgaW4gYSBxdWF0ZXJuaW9uIGNvbXBvbmVudDogYSAtMC4xIGRlZ3JlZSB0aWx0IHdhc1xuICAgICAgICAvLyB3cml0dGVuIGFzIHt6OiAtMC4xLCB3OiAxfSwgd2hpY2ggdGhlIGVuZ2luZSByZWFkcyBiYWNrIGFzIHJvdWdobHkgLTExLjQ2IGRlZ3JlZXMuXG4gICAgICAgIGNvbnN0IGlzUXVhdCA9IHJvdER1bXAudyAhPT0gdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBscm90ID0gaXNRdWF0ID8gcm90RHVtcCA6IFByZWZhYkNyZWF0aW9uU2VydmljZS5ldWxlckRlZ3JlZXNUb1F1YXQocm90RHVtcCk7XG4gICAgICAgIGNvbnN0IGV1bGVyID0gaXNRdWF0ID8geyB4OiAwLCB5OiAwLCB6OiAwIH0gOiByb3REdW1wO1xuICAgICAgICBjb25zdCBsc2NhbGUgPSBub2RlRGF0YS5zY2FsZT8udmFsdWUgfHwgbm9kZURhdGEubHNjYWxlPy52YWx1ZSB8fCBub2RlRGF0YS5fbHNjYWxlIHx8IHsgeDogMSwgeTogMSwgejogMSB9O1xuICAgICAgICBjb25zdCBsYXllckR1bXAgPSBub2RlRGF0YS5sYXllcj8udmFsdWUgIT09IHVuZGVmaW5lZCA/IG5vZGVEYXRhLmxheWVyLnZhbHVlIDogbm9kZURhdGEubGF5ZXI7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdHlwZW9mIGxheWVyRHVtcCA9PT0gJ251bWJlcicgPyBsYXllckR1bXAgOiBQcmVmYWJDcmVhdGlvblNlcnZpY2UuREVGQVVMVF9MQVlFUjtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5Ob2RlXCIsIFwiX25hbWVcIjogbmFtZSwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJfcGFyZW50XCI6IHBhcmVudE5vZGVJbmRleCAhPT0gbnVsbCA/IHsgXCJfX2lkX19cIjogcGFyZW50Tm9kZUluZGV4IH0gOiBudWxsLFxuICAgICAgICAgICAgXCJfY2hpbGRyZW5cIjogW10sIFwiX2FjdGl2ZVwiOiBub2RlRGF0YS5hY3RpdmUgIT09IGZhbHNlLCBcIl9jb21wb25lbnRzXCI6IFtdLCBcIl9wcmVmYWJcIjogbnVsbCxcbiAgICAgICAgICAgIFwiX2xwb3NcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogbHBvcy54IHx8IDAsIFwieVwiOiBscG9zLnkgfHwgMCwgXCJ6XCI6IGxwb3MueiB8fCAwIH0sXG4gICAgICAgICAgICBcIl9scm90XCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlF1YXRcIiwgXCJ4XCI6IGxyb3QueCB8fCAwLCBcInlcIjogbHJvdC55IHx8IDAsIFwielwiOiBscm90LnogfHwgMCwgXCJ3XCI6IGxyb3QudyAhPT0gdW5kZWZpbmVkID8gbHJvdC53IDogMSB9LFxuICAgICAgICAgICAgXCJfbHNjYWxlXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGxzY2FsZS54ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueCA6IDEsIFwieVwiOiBsc2NhbGUueSAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnkgOiAxLCBcInpcIjogbHNjYWxlLnogIT09IHVuZGVmaW5lZCA/IGxzY2FsZS56IDogMSB9LFxuICAgICAgICAgICAgXCJfbW9iaWxpdHlcIjogMCwgXCJfbGF5ZXJcIjogbGF5ZXIsXG4gICAgICAgICAgICBcIl9ldWxlclwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBldWxlci54IHx8IDAsIFwieVwiOiBldWxlci55IHx8IDAsIFwielwiOiBldWxlci56IHx8IDAgfSwgXCJfaWRcIjogXCJcIlxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlcmlhbGl6ZSBvbmUgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogVGhlIGNhcHR1cmVkIGR1bXAgaXMgdGhlIHNvdXJjZSBvZiB0cnV0aCBmb3IgZXZlcnkgY29tcG9uZW50IHR5cGUuIFRoZSBwZXItdHlwZVxuICAgICAqIHRhYmxlcyBiZWxvdyBvbmx5IGZpbGwgaW4ga2V5cyB0aGUgZHVtcCBkaWQgbm90IGNhcnJ5IOKAlCB0aGV5IHVzZWQgdG8gcnVuICppbnN0ZWFkKlxuICAgICAqIG9mIHRoZSBkdW1wLCB3aGljaCBzaWxlbnRseSB3cm90ZSBlbmdpbmUgZGVmYXVsdHMgZm9yIGBjYy5VSVRyYW5zZm9ybWAsXG4gICAgICogYGNjLlNwcml0ZWAsIGBjYy5CdXR0b25gIGFuZCBgY2MuTGFiZWxgLCBhbmQgd3JvdGUgbm90aGluZyBhdCBhbGwgZm9yIGV2ZXJ5IG90aGVyXG4gICAgICogdHlwZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNyZWF0ZUNvbXBvbmVudE9iamVjdChjb21wb25lbnREYXRhOiBhbnksIG5vZGVJbmRleDogbnVtYmVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGNvbXBvbmVudERhdGEudHlwZSB8fCBjb21wb25lbnREYXRhLl9fdHlwZV9fIHx8ICdjYy5Db21wb25lbnQnO1xuICAgICAgICBjb25zdCBlbmFibGVkID0gY29tcG9uZW50RGF0YS5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wb25lbnREYXRhLmVuYWJsZWQgOiB0cnVlO1xuICAgICAgICBjb25zdCBjb21wb25lbnQ6IGFueSA9IHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogY29tcG9uZW50VHlwZSwgXCJfbmFtZVwiOiBcIlwiLCBcIl9vYmpGbGFnc1wiOiAwLCBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICBcIm5vZGVcIjogeyBcIl9faWRfX1wiOiBub2RlSW5kZXggfSwgXCJfZW5hYmxlZFwiOiBlbmFibGVkLCBcIl9fcHJlZmFiXCI6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBwcm9wZXJ0aWVzID0gY29tcG9uZW50RGF0YS5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICBjb25zdCByZW5hbWVzID0gRFVNUF9LRVlfUkVOQU1FU1tjb21wb25lbnRUeXBlXSB8fCB7fTtcblxuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwcm9wZXJ0aWVzKSkge1xuICAgICAgICAgICAgaWYgKERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRC5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBwcm9wVmFsdWUgPSB0aGlzLnByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eSh2YWx1ZSwgY29udGV4dCk7XG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudFtyZW5hbWVzW2tleV0gfHwga2V5XSA9IHByb3BWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgZmFsbGJhY2tdIG9mIE9iamVjdC5lbnRyaWVzKENPTVBPTkVOVF9ERUZBVUxUU1tjb21wb25lbnRUeXBlXSB8fCB7fSkpIHtcbiAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwga2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFtrZXldID0gdHlwZW9mIGZhbGxiYWNrID09PSAnb2JqZWN0JyAmJiBmYWxsYmFjayAhPT0gbnVsbCA/IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZmFsbGJhY2spKSA6IGZhbGxiYWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEEgYnV0dG9uIHdpdGggbm8gY2FwdHVyZWQgdGFyZ2V0IHBvaW50cyBhdCBpdHMgb3duIG5vZGUsIG1hdGNoaW5nIGVkaXRvciBiZWhhdmlvdXIuXG4gICAgICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuQnV0dG9uJyAmJiBjb21wb25lbnQuX3RhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX3RhcmdldCA9IHsgXCJfX2lkX19cIjogbm9kZUluZGV4IH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbnN1cmUgX2lkIGlzIGxhc3QgKG1hdGNoZXMgZW5naW5lIHNlcmlhbGl6YXRpb24gb3JkZXIpXG4gICAgICAgIGNvbnN0IF9pZCA9IGNvbXBvbmVudC5faWQgfHwgXCJcIjtcbiAgICAgICAgZGVsZXRlIGNvbXBvbmVudC5faWQ7XG4gICAgICAgIGNvbXBvbmVudC5faWQgPSBfaWQ7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ291bnQgdGhlIGR1bXAgZW50cmllcyB0aGF0IHdvdWxkIGFjdHVhbGx5IGJlIHNlcmlhbGl6ZWQsIHNvIHRoZSBwb3N0LXdyaXRlIGNoZWNrXG4gICAgICogb25seSBkZW1hbmRzIHByb3BlcnRpZXMgZm9yIGNvbXBvbmVudHMgdGhhdCBoYWQgc29tZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNvdW50U2VyaWFsaXphYmxlUHJvcHMocHJvcGVydGllczogYW55KTogbnVtYmVyIHtcbiAgICAgICAgaWYgKCFwcm9wZXJ0aWVzIHx8IHR5cGVvZiBwcm9wZXJ0aWVzICE9PSAnb2JqZWN0JykgcmV0dXJuIDA7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5maWx0ZXIoayA9PiAhRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrKSkubGVuZ3RoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydCBjb21wb25lbnQgdHlwZXMgdGhhdCBjYXJyaWVkIGxpdmUgcHJvcGVydGllcyBpbiB0aGUgc2NlbmUgYnV0IHNlcmlhbGl6ZWQgdG9cbiAgICAgKiBub3RoaW5nIGJ1dCB0aGUgYmFzZSBlbnZlbG9wZS4gYGFjdGlvbj1jcmVhdGVgIHByZXZpb3VzbHkgcmVwb3J0ZWQgc3VjY2VzcyBpblxuICAgICAqIGV4YWN0bHkgdGhhdCBzdGF0ZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHByZWZhYkRhdGE6IGFueVtdLCBub2RlRGF0YTogYW55KTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXAgb2YgKG5vZGUuY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb3VudFNlcmlhbGl6YWJsZVByb3BzKGNvbXA/LnByb3BlcnRpZXMpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5hZGQoY29tcC50eXBlIHx8IGNvbXAuX190eXBlX18gfHwgJ1Vua25vd24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHdhbGsobm9kZURhdGEpO1xuICAgICAgICBpZiAoZXhwZWN0ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gICAgICAgIGNvbnN0IHBvcHVsYXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHByZWZhYkRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCAhZXhwZWN0ZWQuaGFzKGVudHJ5Ll9fdHlwZV9fKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZW50cnkpLnNvbWUoa2V5ID0+ICFCQVNFX0NPTVBPTkVOVF9LRVlTLmhhcyhrZXkpKSkgcG9wdWxhdGVkLmFkZChlbnRyeS5fX3R5cGVfXyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5leHBlY3RlZF0uZmlsdGVyKHR5cGUgPT4gIXBvcHVsYXRlZC5oYXModHlwZSkpO1xuICAgIH1cblxuICAgIC8qKiBSZS1yZWFkIHRoZSB3cml0dGVuIHByZWZhYjsgZmFsbHMgYmFjayB0byB0aGUgaW4tbWVtb3J5IGNvbnRlbnQgd2hlbiB0aGUgcGF0aCBpcyB1bnJlc29sdmFibGUuICovXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkQmFja1ByZWZhYihzYXZlUGF0aDogc3RyaW5nLCBmYWxsYmFjazogYW55W10pOiBQcm9taXNlPHsgZGF0YTogYW55W107IHNvdXJjZTogJ2Rpc2snIHwgJ2luLW1lbW9yeScgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlQXNzZXQoc2F2ZVBhdGgpO1xuICAgICAgICAgICAgaWYgKHJlc29sdmVkLmZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQuZmlsZVBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4geyBkYXRhOiBwYXJzZWQsIHNvdXJjZTogJ2Rpc2snIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHRoZSBpbi1tZW1vcnkgY29udGVudFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGRhdGE6IGZhbGxiYWNrLCBzb3VyY2U6ICdpbi1tZW1vcnknIH07XG4gICAgfVxuXG4gICAgLyoqIFR5cGUgbmFtZXMgd2hvc2UgZHVtcCB2YWx1ZSBpcyBhbiBBU1NFVCByZWZlcmVuY2UgcmF0aGVyIHRoYW4gYSBjb21wb25lbnQgcmVmZXJlbmNlLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEFTU0VUX1RZUEVTID0gbmV3IFNldChbXG4gICAgICAgICdjYy5QcmVmYWInLCAnY2MuVGV4dHVyZTJEJywgJ2NjLlNwcml0ZUZyYW1lJywgJ2NjLk1hdGVyaWFsJywgJ2NjLkFuaW1hdGlvbkNsaXAnLFxuICAgICAgICAnY2MuQXVkaW9DbGlwJywgJ2NjLkZvbnQnLCAnY2MuQXNzZXQnLCAnY2MuVFRGRm9udCcsICdjYy5CaXRtYXBGb250JywgJ2NjLkxhYmVsQXRsYXMnLFxuICAgICAgICAnY2MuU3ByaXRlQXRsYXMnLCAnY2MuSnNvbkFzc2V0JywgJ2NjLlRleHRBc3NldCcsICdjYy5QYXJ0aWNsZUFzc2V0JywgJ2NjLk1lc2gnLFxuICAgICAgICAnY2MuU2tlbGV0b24nLCAnY2MuUmVuZGVyVGV4dHVyZScsICdjYy5QaHlzaWNzTWF0ZXJpYWwnLCAnY2MuU2NlbmVBc3NldCcsICdjYy5FZmZlY3RBc3NldCcsXG4gICAgXSk7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhc3NldCBpcyBlaXRoZXIgZXhwbGljaXRseSBsaXN0ZWQgb3IgbmFtZWQgYnkgYSBzdWZmaXggbm8gY29tcG9uZW50IHR5cGUgdXNlcy5cbiAgICAgKiBUaGUgc3VmZml4IGFybSBpcyB3aGF0IGtlZXBzIGEgZnV0dXJlIGNvbmNyZXRlIGFzc2V0IHN1YmNsYXNzIGZyb20gc2lsZW50bHkgcmVncmVzc2luZ1xuICAgICAqIGludG8gdGhlIGNvbXBvbmVudC1yZWZlcmVuY2UgYnJhbmNoIHRoZSB3YXkgY2MuVFRGRm9udCBkaWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgaXNBc3NldFR5cGUodHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkFTU0VUX1RZUEVTLmhhcyh0eXBlKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiAvKD86Rm9udHxBc3NldHxBdGxhc3xDbGlwKSQvLnRlc3QodHlwZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyBjb21wb25lbnQgcHJvcGVydHkgdmFsdWVzLCBlbnN1cmluZyBmb3JtYXQgbWF0Y2hlcyBtYW51YWxseS1jcmVhdGVkIHByZWZhYnMuXG4gICAgICogSGFuZGxlcyBub2RlIHJlZnMsIGFzc2V0IHJlZnMsIGNvbXBvbmVudCByZWZzLCB0eXBlZCBtYXRoL2NvbG9yIG9iamVjdHMsIGFuZCBhcnJheXMuXG4gICAgICovXG4gICAgcHJpdmF0ZSBwcm9jZXNzQ29tcG9uZW50UHJvcGVydHkocHJvcERhdGE6IGFueSwgY29udGV4dD86IHtcbiAgICAgICAgbm9kZVV1aWRUb0luZGV4PzogTWFwPHN0cmluZywgbnVtYmVyPjtcbiAgICAgICAgY29tcG9uZW50VXVpZFRvSW5kZXg/OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgIH0pOiBhbnkge1xuICAgICAgICBpZiAoIXByb3BEYXRhIHx8IHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcpIHJldHVybiBwcm9wRGF0YTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wRGF0YS52YWx1ZTtcbiAgICAgICAgY29uc3QgdHlwZSA9IHByb3BEYXRhLnR5cGU7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUudXVpZCA9PT0gJycpIHJldHVybiBudWxsO1xuXG4gICAgICAgIC8vIE5vZGUgcmVmZXJlbmNlc1xuICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLk5vZGUnICYmIHZhbHVlPy51dWlkKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dD8ubm9kZVV1aWRUb0luZGV4Py5oYXModmFsdWUudXVpZCkpIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQubm9kZVV1aWRUb0luZGV4LmdldCh2YWx1ZS51dWlkKSB9O1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBOb2RlIHJlZiBVVUlEICR7dmFsdWUudXVpZH0gbm90IGluIHByZWZhYiBjb250ZXh0IChleHRlcm5hbCksIHNldHRpbmcgbnVsbGApO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBc3NldCByZWZlcmVuY2VzLlxuICAgICAgICAvLyBUaGUgbGlzdCBtdXN0IG5hbWUgQ09OQ1JFVEUgdHlwZXMsIG5vdCBqdXN0IGJhc2UgY2xhc3NlczogYSBjYy5MYWJlbCdzIGZvbnQgZHVtcCByZXBvcnRzXG4gICAgICAgIC8vIGBjYy5UVEZGb250YCwgbmV2ZXIgYGNjLkZvbnRgLiBNaXNzaW5nIGhlcmUsIGl0IGZlbGwgdGhyb3VnaCB0byB0aGUgY29tcG9uZW50LXJlZmVyZW5jZVxuICAgICAgICAvLyBicmFuY2ggYmVsb3csIHdob3NlIGB0eXBlLnN0YXJ0c1dpdGgoJ2NjLicpYCBjYXRjaC1hbGwgbWF0Y2hlZCBpdCwgZm91bmQgbm8gZW50cnkgaW4gdGhlXG4gICAgICAgIC8vIGNvbXBvbmVudCBpbmRleCwgYW5kIHJldHVybmVkIG51bGwg4oCUIHNvIGV2ZXJ5IGxhYmVsIGluIGEgY3JlYXRlZCBwcmVmYWIgbG9zdCBpdHMgZm9udC5cbiAgICAgICAgLy8gVGhlIHV1aWQgaXMgd3JpdHRlbiB2ZXJiYXRpbS4gVGhlIGVkaXRvcidzIG93biBzZXJpYWxpemVyIG5ldmVyIGNvbXByZXNzZXMgYW4gYXNzZXRcbiAgICAgICAgLy8gYF9fdXVpZF9fYCBpbiBhIC5wcmVmYWIvLnNjZW5lOyBjb21wcmVzc2luZyBvbmUgcHJvZHVjZWQgYSByZWZlcmVuY2UgdGhhdCByZXNvbHZlZCB0b1xuICAgICAgICAvLyBub3RoaW5nLiBUaGlzIHdlbnQgdW5zZWVuIGJlY2F1c2UgYSBzcHJpdGUtZnJhbWUgc3ViLWFzc2V0IHV1aWQgKCc8dXVpZD5AZjk5NDEnKSBpcyAzN1xuICAgICAgICAvLyBjaGFycyBhbmQgZmFpbGVkIHRoZSBvbGQgY29tcHJlc3NvcidzIDMyLWNoYXIgZ3VhcmQsIHNvIHNwcml0ZXMgcGFzc2VkIHRocm91Z2ggaW50YWN0XG4gICAgICAgIC8vIHdoaWxlIGV2ZXJ5IHBsYWluLXV1aWQgYXNzZXQg4oCUIGZvbnRzIGZpcnN0IOKAlCB3YXMgbWFuZ2xlZC5cbiAgICAgICAgaWYgKHZhbHVlPy51dWlkICYmIFByZWZhYkNyZWF0aW9uU2VydmljZS5pc0Fzc2V0VHlwZSh0eXBlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgXCJfX3V1aWRfX1wiOiB2YWx1ZS51dWlkLCBcIl9fZXhwZWN0ZWRUeXBlX19cIjogdHlwZSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ29tcG9uZW50IHJlZmVyZW5jZXNcbiAgICAgICAgaWYgKHZhbHVlPy51dWlkICYmICh0eXBlID09PSAnY2MuQ29tcG9uZW50JyB8fCB0eXBlID09PSAnY2MuTGFiZWwnIHx8IHR5cGUgPT09ICdjYy5CdXR0b24nIHx8IHR5cGUgPT09ICdjYy5TcHJpdGUnIHx8XG4gICAgICAgICAgICB0eXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nIHx8IHR5cGUgPT09ICdjYy5SaWdpZEJvZHkyRCcgfHwgdHlwZSA9PT0gJ2NjLkJveENvbGxpZGVyMkQnIHx8XG4gICAgICAgICAgICB0eXBlID09PSAnY2MuQW5pbWF0aW9uJyB8fCB0eXBlID09PSAnY2MuQXVkaW9Tb3VyY2UnIHx8ICh0eXBlPy5zdGFydHNXaXRoKCdjYy4nKSAmJiAhdHlwZS5pbmNsdWRlcygnQCcpKSkpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0Py5jb21wb25lbnRVdWlkVG9JbmRleD8uaGFzKHZhbHVlLnV1aWQpKSByZXR1cm4geyBcIl9faWRfX1wiOiBjb250ZXh0LmNvbXBvbmVudFV1aWRUb0luZGV4LmdldCh2YWx1ZS51dWlkKSB9O1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBDb21wb25lbnQgcmVmICR7dHlwZX0gVVVJRCAke3ZhbHVlLnV1aWR9IG5vdCBpbiBwcmVmYWIgY29udGV4dCAoZXh0ZXJuYWwpLCBzZXR0aW5nIG51bGxgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHlwZWQgbWF0aC9jb2xvciBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLkNvbG9yJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5yKSB8fCAwKSksIFwiZ1wiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5nKSB8fCAwKSksIFwiYlwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5iKSB8fCAwKSksIFwiYVwiOiB2YWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5hKSkpIDogMjU1IH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzMnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCwgXCJ6XCI6IE51bWJlcih2YWx1ZS56KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzInKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5TaXplJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlNpemVcIiwgXCJ3aWR0aFwiOiBOdW1iZXIodmFsdWUud2lkdGgpIHx8IDAsIFwiaGVpZ2h0XCI6IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuUXVhdCcpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwLCBcInpcIjogTnVtYmVyKHZhbHVlLnopIHx8IDAsIFwid1wiOiB2YWx1ZS53ICE9PSB1bmRlZmluZWQgPyBOdW1iZXIodmFsdWUudykgOiAxIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheSBwcm9wZXJ0aWVzLlxuICAgICAgICAvLyBFYWNoIGVsZW1lbnQgb2YgYW4gYXJyYXktdHlwZWQgZHVtcCAoZS5nLiBjYy5NZXNoUmVuZGVyZXIncyBzaGFyZWRNYXRlcmlhbHMvXG4gICAgICAgIC8vIF9tYXRlcmlhbHMpIGlzIGl0c2VsZiBhIG5lc3RlZCBwcm9wZXJ0eSBkZXNjcmlwdG9yIOKAlCB7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSwgLi4uIH1cbiAgICAgICAgLy8g4oCUIG5vdCBhIGZsYXQgeyB1dWlkIH0uIFJlYWRpbmcgaXRlbS51dWlkIGRpcmVjdGx5IG1hdGNoZWQgbm90aGluZyBmb3IgZXZlcnkgZWxlbWVudCxcbiAgICAgICAgLy8gc28gYSBNZXNoUmVuZGVyZXIncyBhc3NpZ25lZCBtYXRlcmlhbCBzaWxlbnRseSBzZXJpYWxpemVkIGFzIGFuIGVtcHR5IGFycmF5IHdoaWxlXG4gICAgICAgIC8vIHJlcG9ydGluZyBzdWNjZXNzICh2ZXJpZmllZCBsaXZlIGFnYWluc3QgYSBzbWFydC1pbXBvcnRlZCBGQlggbWF0ZXJpYWwpLlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1VdWlkID0gKGl0ZW06IGFueSk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiBpdGVtPy51dWlkIHx8IGl0ZW0/LnZhbHVlPy51dWlkO1xuICAgICAgICAgICAgaWYgKHByb3BEYXRhLmVsZW1lbnRUeXBlRGF0YT8udHlwZSA9PT0gJ2NjLk5vZGUnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBpdGVtVXVpZChpdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHV1aWQgJiYgY29udGV4dD8ubm9kZVV1aWRUb0luZGV4Py5oYXModXVpZCkpIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQubm9kZVV1aWRUb0luZGV4LmdldCh1dWlkKSB9O1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9KS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocHJvcERhdGEuZWxlbWVudFR5cGVEYXRhPy50eXBlPy5zdGFydHNXaXRoKCdjYy4nKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1dWlkID0gaXRlbVV1aWQoaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB1dWlkID8geyBcIl9fdXVpZF9fXCI6IHV1aWQsIFwiX19leHBlY3RlZFR5cGVfX1wiOiBwcm9wRGF0YS5lbGVtZW50VHlwZURhdGEudHlwZSB9IDogbnVsbDtcbiAgICAgICAgICAgICAgICB9KS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBpdGVtLnZhbHVlIDogaXRlbSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOZXN0ZWQgQ0NDbGFzcyBncm91cDogdGhlIGR1bXAgbmVzdHMgYW5vdGhlciBkZXNjcmlwdG9yIG1hcCB1bmRlciBgdmFsdWVgLlxuICAgICAgICAvLyBTZXJpYWxpemluZyBpdCB2ZXJiYXRpbSB3b3VsZCB3cml0ZSBlZGl0b3IgZGVzY3JpcHRvcnMgKHtuYW1lLCB2YWx1ZSwgdHlwZX0pXG4gICAgICAgIC8vIGludG8gdGhlIGFzc2V0IGluc3RlYWQgb2YgdGhlIHZhbHVlcyB0aGVtc2VsdmVzLlxuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdGhpcy5pc05lc3RlZFByb3BlcnR5TWFwKHZhbHVlKSkge1xuICAgICAgICAgICAgY29uc3QgbmVzdGVkOiBhbnkgPSB0eXBlID8geyBcIl9fdHlwZV9fXCI6IHR5cGUgfSA6IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRC5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgbmVzdGVkVmFsdWUgPSB0aGlzLnByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShlbnRyeSwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgaWYgKG5lc3RlZFZhbHVlICE9PSB1bmRlZmluZWQpIG5lc3RlZFtrZXldID0gbmVzdGVkVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3RoZXIgY29tcGxleCB0eXBlZCBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHR5cGU/LnN0YXJ0c1dpdGgoJ2NjLicpKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IHR5cGUsIC4uLnZhbHVlIH07XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGV2ZXJ5IGVudHJ5IGlzIGFuIG9iamVjdCBhbmQgYXQgbGVhc3Qgb25lIGlzIGEgQ29jb3MgcHJvcGVydHkgZGVzY3JpcHRvci4gKi9cbiAgICBwcml2YXRlIGlzTmVzdGVkUHJvcGVydHlNYXAodmFsdWU6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHZhbHVlKTtcbiAgICAgICAgaWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBlbnRyaWVzLmV2ZXJ5KChbLCBlbnRyeV0pID0+IGVudHJ5ICE9PSBudWxsICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcpXG4gICAgICAgICAgICAmJiBlbnRyaWVzLnNvbWUoKFssIGVudHJ5XSkgPT4gaXNQcm9wZXJ0eURlc2NyaXB0b3IoZW50cnkpKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBBc3NldCBEQiBvcGVyYXRpb25zID09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJSZWY6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2Nvbm5lY3QtcHJlZmFiLWluc3RhbmNlJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJlZmFiLWNvbm5lY3Rpb24nLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlJlZiB9KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYi1saW5rJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSlcbiAgICAgICAgXTtcbiAgICAgICAgZm9yIChjb25zdCBtZXRob2Qgb2YgbWV0aG9kcykge1xuICAgICAgICAgICAgdHJ5IHsgYXdhaXQgbWV0aG9kKCk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfSBjYXRjaCB7IC8qIHRyeSBuZXh0ICovIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBbGwgcHJlZmFiIGNvbm5lY3Rpb24gbWV0aG9kcyBmYWlsZWQnIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlUHJlZmFiV2l0aE1ldGEocHJlZmFiUGF0aDogc3RyaW5nLCBwcmVmYWJEYXRhOiBhbnlbXSwgbWV0YURhdGE6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVBc3NldEZpbGUocHJlZmFiUGF0aCwgSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlQXNzZXRGaWxlKGAke3ByZWZhYlBhdGh9Lm1ldGFgLCBKU09OLnN0cmluZ2lmeShtZXRhRGF0YSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBzYXZlIHByZWZhYiBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXRGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBtZXRob2RzID0gW1xuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpLFxuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3dyaXRlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgbWV0aG9kIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIHRyeSB7IGF3YWl0IG1ldGhvZCgpOyByZXR1cm47IH0gY2F0Y2ggeyAvKiB0cnkgbmV4dCAqLyB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgc2F2ZSBtZXRob2RzIGZhaWxlZCcpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgYXNzZXRQYXRoLCBjb250ZW50LCB7IG92ZXJ3cml0ZTogdHJ1ZSwgcmVuYW1lOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGFzc2V0SW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgYXNzZXQgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlTWV0YVdpdGhBc3NldERCKGFzc2V0UGF0aDogc3RyaW5nLCBtZXRhQ29udGVudDogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldC1tZXRhJywgYXNzZXRQYXRoLCBKU09OLnN0cmluZ2lmeShtZXRhQ29udGVudCwgbnVsbCwgMikpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogYXNzZXRJbmZvIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBtZXRhIGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlaW1wb3J0QXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHJlc3VsdCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byByZWltcG9ydCBhc3NldCcgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlQXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIGFzc2V0UGF0aCwgY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gdXBkYXRlIGFzc2V0IGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA9PT09PSBGb3JtYXQgdmFsaWRhdGlvbiA9PT09PVxuXG4gICAgdmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YTogYW55KTogeyBpc1ZhbGlkOiBib29sZWFuOyBpc3N1ZXM6IHN0cmluZ1tdOyBub2RlQ291bnQ6IG51bWJlcjsgY29tcG9uZW50Q291bnQ6IG51bWJlciB9IHtcbiAgICAgICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBsZXQgbm9kZUNvdW50ID0gMDtcbiAgICAgICAgbGV0IGNvbXBvbmVudENvdW50ID0gMDtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcmVmYWJEYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goJ1ByZWZhYiBkYXRhIGlzIGVtcHR5Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBmYWxzZSwgaXNzdWVzLCBub2RlQ291bnQsIGNvbXBvbmVudENvdW50IH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFwcmVmYWJEYXRhWzBdIHx8IHByZWZhYkRhdGFbMF0uX190eXBlX18gIT09ICdjYy5QcmVmYWInKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnRmlyc3QgZWxlbWVudCBtdXN0IGJlIGNjLlByZWZhYiB0eXBlJyk7XG4gICAgICAgIH1cbiAgICAgICAgcHJlZmFiRGF0YS5mb3JFYWNoKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtLl9fdHlwZV9fID09PSAnY2MuTm9kZScpIG5vZGVDb3VudCsrO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXRlbS5fX3R5cGVfXyAmJiBpdGVtLl9fdHlwZV9fLmluY2x1ZGVzKCdjYy4nKSkgY29tcG9uZW50Q291bnQrKztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChub2RlQ291bnQgPT09IDApIGlzc3Vlcy5wdXNoKCdQcmVmYWIgbXVzdCBjb250YWluIGF0IGxlYXN0IG9uZSBub2RlJyk7XG4gICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGlzc3Vlcy5sZW5ndGggPT09IDAsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCB9O1xuICAgIH1cblxuICAgIGNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICByZXR1cm4geyBcInZlclwiOiBcIjEuMS41MFwiLCBcImltcG9ydGVyXCI6IFwicHJlZmFiXCIsIFwiaW1wb3J0ZWRcIjogdHJ1ZSwgXCJ1dWlkXCI6IHByZWZhYlV1aWQsIFwiZmlsZXNcIjogW1wiLmpzb25cIl0sIFwic3ViTWV0YXNcIjoge30sIFwidXNlckRhdGFcIjogeyBcInN5bmNOb2RlTmFtZVwiOiBwcmVmYWJOYW1lIH0gfTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBVVUlEIHV0aWxpdGllcyA9PT09PVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVVVSUQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgY2hhcnMgPSAnMDEyMzQ1Njc4OWFiY2RlZic7XG4gICAgICAgIGxldCB1dWlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDggfHwgaSA9PT0gMTIgfHwgaSA9PT0gMTYgfHwgaSA9PT0gMjApIHV1aWQgKz0gJy0nO1xuICAgICAgICAgICAgdXVpZCArPSBjaGFyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFycy5sZW5ndGgpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlRmlsZUlkKCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNoYXJzID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5Ky8nO1xuICAgICAgICBsZXQgZmlsZUlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjI7IGkrKykgZmlsZUlkICs9IGNoYXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJzLmxlbmd0aCldO1xuICAgICAgICByZXR1cm4gZmlsZUlkO1xuICAgIH1cblxufVxuIl19