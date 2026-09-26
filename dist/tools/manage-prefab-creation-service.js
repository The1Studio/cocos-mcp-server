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
    constructor() {
        /**
         * References the most recent `createStandardPrefabContent` call could not serialize.
         *
         * The create paths are plain functions returning the prefab JSON, so a loss cannot be
         * thrown from where it is detected without abandoning a valid `fatal` failure report.
         * Both create paths read this immediately after serializing and fail on a non-empty
         * list — the same contract as the existing `findComponentsThatLostProperties` check.
         */
        this.lastReferenceLosses = [];
    }
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
            const referenceLoss = this.describeReferenceLosses(this.lastReferenceLosses);
            if (referenceLoss) {
                return {
                    success: false,
                    fatal: true,
                    error: `Refusing to write ${savePath}: ${referenceLoss} The written prefab would not be equivalent to the scene subtree — this is issue #73's asset-reference loss.`,
                    data: { prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName, referenceLosses: this.lastReferenceLosses }
                };
            }
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
            const referenceLoss = this.describeReferenceLosses(this.lastReferenceLosses);
            if (referenceLoss) {
                return {
                    success: false,
                    fatal: true,
                    error: `Refusing to write ${prefabPath}: ${referenceLoss} The written prefab would not be equivalent to the scene subtree — this is issue #73's asset-reference loss.`,
                    data: { prefabUuid, prefabPath, nodeUuid, prefabName, referenceLosses: this.lastReferenceLosses }
                };
            }
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
            componentUuidToIndex: new Map(),
            losses: []
        };
        await this.createCompleteNodeTree(nodeData, null, 1, context, includeChildren, includeComponents, prefabName);
        this.lastReferenceLosses = context.losses;
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
            const propValue = this.processComponentProperty(value, context, `${renames[key] || key}`);
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
     *
     * Throws on a reference it cannot serialize faithfully. Every branch below used to
     * answer an unresolvable reference with `null` (or drop it from an array), which is how
     * a created prefab came out hollow while `action=create` reported success — issue #73's
     * `_mesh: null`, `_materials: []` and `labelPercent: null`, each of which had been
     * written to the live scene moments earlier. A reference that cannot be serialized is a
     * failure of this call, not a value of `null`: see
     * `~/.claude/rules/development-principles.md` § "Errors Over Silent Fallbacks".
     */
    processComponentProperty(propData, context, propertyPath = '') {
        var _a, _b, _c;
        if (!propData || typeof propData !== 'object')
            return propData;
        const value = propData.value;
        const type = propData.type;
        if (value === null || value === undefined)
            return null;
        // An explicit empty-uuid reference is a genuine CLEAR (issue #75), not a loss.
        if (value && typeof value === 'object' && value.uuid === '')
            return null;
        // Node references
        if (type === 'cc.Node' && (value === null || value === void 0 ? void 0 : value.uuid)) {
            if ((_a = context === null || context === void 0 ? void 0 : context.nodeUuidToIndex) === null || _a === void 0 ? void 0 : _a.has(value.uuid))
                return { "__id__": context.nodeUuidToIndex.get(value.uuid) };
            // A node outside the subtree being serialized cannot be encoded in a prefab —
            // the format has no cross-file node reference. This one genuinely must be
            // dropped, but it is still a data loss and is recorded as such.
            this.recordLoss(context, propertyPath, value.uuid, 'node is outside the prefab subtree being serialized');
            return null;
        }
        // Asset references.
        //
        // This branch is the DEFAULT for any reference carrying a uuid, because the tests
        // below cannot both be satisfied: `cc.Label`'s `font` is a `cc.TTFFont` ASSET
        // (this test file's own font regression), while `cc.Label` is also a legitimate
        // @property COMPONENT type. Reading the value's uuid as an asset is what makes the
        // font case correct; every concrete asset class is caught below by name or suffix.
        //
        // Asset-first was previously bypassed by dispatching on `isAssetType(type)` FIRST,
        // letting the component branch's `type.startsWith('cc.')` catch-all claim any type
        // the allowlist had not been taught — the exact mechanism by which `cc.Mesh` and
        // `cc.Skeleton` became null entries in a created prefab (issues #64, #70, #73).
        if (value === null || value === void 0 ? void 0 : value.uuid) {
            if (PrefabCreationService.isAssetType(type)) {
                return { "__uuid__": value.uuid, "__expectedType__": type };
            }
            // In-tree component reference: the uuid names a component in the subtree being
            // serialized, so it encodes as an object index.
            if ((_b = context === null || context === void 0 ? void 0 : context.componentUuidToIndex) === null || _b === void 0 ? void 0 : _b.has(value.uuid)) {
                return { "__id__": context.componentUuidToIndex.get(value.uuid) };
            }
            // Unresolved. A prefab asset has no way to express a reference to something
            // outside the subtree, so null is the only encodable answer — but the null is
            // now RECORDED, and the create paths refuse to write when anything was recorded.
            // `null` in silence is issue #73's primary symptom (`_mesh: null`,
            // `_materials: []`, `labelPercent: null` on a created prefab, with
            // `success: true` and `validate` green); a reported loss that fails the call is
            // not.
            //
            // Two causes reach here, and the message names both because the remedies differ:
            // a reference genuinely outside the subtree (legitimate — a button pointing at
            // another prefab), and an ASSET class missing from ASSET_TYPES, which is the
            // mechanism behind issues #64/#70/#73 and wants the allowlist extended.
            //
            // Deliberately NOT a throw: `processComponentProperty` runs inside
            // `createStandardPrefabContent`, whose contract is to RETURN the prefab JSON, and
            // throwing here would also catch script component references (`BucketScript` is
            // not a `cc.` class), which are a legitimate external reference — turning a
            // supported null into a failure. The loss list is the channel that distinguishes
            // them by call site rather than by guessing from the type name.
            console.warn(`Reference ${type} UUID ${value.uuid} has no encodable form in a prefab (property '${propertyPath || '(unknown)'}')`);
            this.recordLoss(context, propertyPath, value.uuid, `type '${type}' has no encodable form — either it is outside the prefab subtree (legitimate for a component reference) ` +
                `or it is an asset class missing from PrefabCreationService.ASSET_TYPES (issues #64/#70/#73)`);
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
        //
        // Elements are serialized through this same function rather than a local
        // `{ __uuid__ }` shape, so a concrete-class asset type reaches the asset branch
        // instead of a hardcoded consequence of `elementTypeData`. The old shape declared
        // `elementTypeData.type` for every element regardless of what the element actually
        // referenced — and `.filter(Boolean)` turned each unresolved element into a silently
        // shorter array, which is issue #73's `_materials: []` exactly: an array property
        // that had contents on the live node and came out of the created prefab empty, with
        // `success: true` and `validate` reporting `isValid: true` over the result.
        if (Array.isArray(value)) {
            const elementType = (_c = propData.elementTypeData) === null || _c === void 0 ? void 0 : _c.type;
            const serialized = value.map((item, index) => {
                var _a;
                const itemUuid = (item === null || item === void 0 ? void 0 : item.uuid) || ((_a = item === null || item === void 0 ? void 0 : item.value) === null || _a === void 0 ? void 0 : _a.uuid);
                if (!itemUuid && elementType && !elementType.startsWith('cc.')) {
                    // Not a reference array at all — an array of plain values.
                    return (item === null || item === void 0 ? void 0 : item.value) !== undefined ? item.value : item;
                }
                // An element's own `type` is authoritative; `elementTypeData` is only the
                // declared array element class, and for a subclass element (`cc.TTFFont`
                // under a `cc.Font[]`, a nested-descriptor material) the declared class is
                // the wrong thing to write.
                return this.processComponentProperty({ value: (item === null || item === void 0 ? void 0 : item.value) !== undefined ? item.value : item, type: (item === null || item === void 0 ? void 0 : item.type) || elementType }, context, `${propertyPath}[${index}]`);
            });
            // A dropped element is a loss, not a shorter array. `map` never produces
            // undefined here, so this only fires if a future branch starts returning it.
            return serialized.filter((entry) => entry !== undefined && entry !== null);
        }
        // Nested CCClass group: the dump nests another descriptor map under `value`.
        // Serializing it verbatim would write editor descriptors ({name, value, type})
        // into the asset instead of the values themselves.
        if (value && typeof value === 'object' && !Array.isArray(value) && this.isNestedPropertyMap(value)) {
            const nested = type ? { "__type__": type } : {};
            for (const [key, entry] of Object.entries(value)) {
                if (DUMP_KEYS_NOT_SERIALIZED.has(key))
                    continue;
                const nestedValue = this.processComponentProperty(entry, context, propertyPath ? `${propertyPath}.${key}` : key);
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
    /**
     * Record a reference that could not be serialized faithfully.
     *
     * Kept as a list rather than a throw for the two cases where the prefab format itself
     * cannot express the value (a node/component outside the subtree). The create paths turn
     * a non-empty list into a `fatal` failure, so the loss is never merely a warning in a
     * log nobody reads — which is how #73's dropped references went unnoticed through
     * `create` AND `validate`.
     */
    recordLoss(context, property, uuid, reason) {
        if (!(context === null || context === void 0 ? void 0 : context.losses))
            return;
        context.losses.push({ property: property || '(unknown)', uuid, reason });
    }
    /** Render recorded losses as the fatal failure message, or null when there are none. */
    describeReferenceLosses(losses) {
        if (losses.length === 0)
            return null;
        const named = losses.map(l => `'${l.property}' -> ${l.uuid} (${l.reason})`);
        return `${losses.length} reference(s) could not be serialized: ${named.join('; ')}.`;
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
    /**
     * Structural validation of a serialized prefab.
     *
     * Structural alone is not "valid": a prefab whose components serialized to their bare
     * envelope passes every check here while carrying none of the scene values, which is why
     * `manage_prefab action=validate` returned `isValid: true` over the hollow output of
     * issue #73's own repro. `hollowComponents` reports the components that hold nothing
     * beyond `BASE_COMPONENT_KEYS`, so "valid" and "empty" are distinguishable.
     */
    validatePrefabFormat(prefabData) {
        const issues = [];
        const hollowComponents = [];
        let nodeCount = 0;
        let componentCount = 0;
        if (!Array.isArray(prefabData)) {
            issues.push('Prefab data must be an array');
            return { isValid: false, issues, nodeCount, componentCount, hollowComponents };
        }
        if (prefabData.length === 0) {
            issues.push('Prefab data is empty');
            return { isValid: false, issues, nodeCount, componentCount, hollowComponents };
        }
        if (!prefabData[0] || prefabData[0].__type__ !== 'cc.Prefab') {
            issues.push('First element must be cc.Prefab type');
        }
        const nodesWithComponents = new Set();
        prefabData.forEach((item) => {
            var _a;
            if (item.__type__ === 'cc.Node') {
                nodeCount++;
                for (const ref of (item._components || [])) {
                    if (ref && typeof ref.__id__ === 'number')
                        nodesWithComponents.add(ref.__id__);
                }
            }
            else if (item.__type__ === 'cc.CompPrefabInfo' || !item.__type__) {
                // Serialization bookkeeping, never a component instance.
            }
            else if (String(item.__type__).startsWith('cc.') || item.__type__) {
                componentCount++;
                // A component that is referenced from a node but carries nothing but the
                // envelope has lost every property it held in the scene (#28/#73).
                const holdsNothingButEnvelope = Object.keys(item).every(key => BASE_COMPONENT_KEYS.has(key));
                if (holdsNothingButEnvelope && typeof ((_a = item.node) === null || _a === void 0 ? void 0 : _a.__id__) === 'number') {
                    hollowComponents.push(String(item.__type__));
                }
            }
        });
        if (nodeCount === 0)
            issues.push('Prefab must contain at least one node');
        for (const hollow of [...new Set(hollowComponents)]) {
            issues.push(`Component '${hollow}' serialized with no properties — it carries none of the scene values it had (issues #28/#73)`);
        }
        return { isValid: issues.length === 0, issues, nodeCount, componentCount, hollowComponents };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7O0dBU0c7QUFDSCx1Q0FBeUI7QUFDekIsb0RBQW1EO0FBQ25ELDJGQUFtRjtBQUVuRjs7Ozs7R0FLRztBQUNILFNBQVMsb0JBQW9CLENBQUMsS0FBVTtJQUNwQyxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzlFLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3hFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakgsQ0FBQztBQUVELHNGQUFzRjtBQUN0RixNQUFNLHdCQUF3QixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3JDLE1BQU0sRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZTtJQUM5RCxXQUFXLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGtCQUFrQjtDQUMxRSxDQUFDLENBQUM7QUFFSCx3RkFBd0Y7QUFDeEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcs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RUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEYsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNoSSxTQUFTLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3hLLFdBQVcsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLEtBQUs7WUFDL0IsUUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQyxJ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QUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDdkYsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQzs7QUE1eEJMLHNEQTh4QkM7QUE1ZUcsMkZBQTJGO0FBQ25FLG1DQUFhLEdBQUcsVUFBVSxBQUFiLENBQWM7QUE0SW5ELDJGQUEyRjtBQUNuRSxpQ0FBVyxHQUFHLElBQUksR0FBRyxDQUFDO0lBQzFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLGtCQUFrQjtJQUNoRixjQUFjLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLGVBQWU7SUFDckYsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxTQUFTO0lBQy9FLGFBQWEsRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCO0NBQzdGLENBQUMsQUFMaUMsQ0FLaEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFByZWZhYkNyZWF0aW9uU2VydmljZTogaGFuZGxlcyB0aGUgY29tcGxleCBsb2dpYyBvZiBjcmVhdGluZyBDb2NvcyBDcmVhdG9yIHByZWZhYiBmaWxlc1xuICogcHJvZ3JhbW1hdGljYWxseS4gRXh0cmFjdGVkIGZyb20gTWFuYWdlUHJlZmFiIHRvIGtlZXAgbWFuYWdlLXByZWZhYi50cyB1bmRlciAyMDAgbGluZXMuXG4gKlxuICogUmVzcG9uc2liaWxpdGllczpcbiAqIC0gRmV0Y2hpbmcgbm9kZSBkYXRhIHdpdGggY29tcG9uZW50IGluZm8gZnJvbSB0aGUgc2NlbmVcbiAqIC0gU2VyaWFsaXppbmcgbm9kZSB0cmVlcyBpbnRvIENvY29zIENyZWF0b3IgcHJlZmFiIEpTT04gZm9ybWF0XG4gKiAtIFNhdmluZyBhbmQgcmUtaW1wb3J0aW5nIGFzc2V0IGZpbGVzIHZpYSBhc3NldC1kYlxuICogLSBMaW5raW5nIHNjZW5lIG5vZGVzIHRvIG5ld2x5IGNyZWF0ZWQgcHJlZmFiIGFzc2V0c1xuICovXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyByZXNvbHZlQXNzZXQgfSBmcm9tICcuLi91dGlscy9hc3NldC1wYXRoJztcbmltcG9ydCB7IGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5cbi8qKlxuICogQSBkdW1wIGVudHJ5IGlzIGEgcHJvcGVydHkgZGVzY3JpcHRvciB3aGVuIGl0IHdyYXBzIGEgYHZhbHVlYCBhbmQgY2FycmllcyBhdCBsZWFzdCBvbmVcbiAqIGVkaXRvciBhbm5vdGF0aW9uLiBEZWxpYmVyYXRlbHkgbG9vc2VyIHRoYW4gdGhlIGluc3BlY3Rvci1zaWRlXG4gKiBgaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcmAsIHdoaWNoIHJlamVjdHMgZGVzY3JpcHRvcnMgd2hvc2UgZmllbGRzIGFyZSBhbGwgcHJpbWl0aXZlc1xuICogKGB7IG5hbWUsIHZhbHVlOiA2MCwgdHlwZTogJ051bWJlcicgfWApIGJlY2F1c2UgaXQgaXMgZ3VhcmRpbmcgYSBkaWZmZXJlbnQgY2FzZS5cbiAqL1xuZnVuY3Rpb24gaXNQcm9wZXJ0eURlc2NyaXB0b3IoZW50cnk6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGVudHJ5KSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGVudHJ5LCAndmFsdWUnKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBbJ25hbWUnLCAndHlwZScsICdkaXNwbGF5TmFtZScsICdyZWFkb25seSddLnNvbWUoayA9PiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZW50cnksIGspKTtcbn1cblxuLyoqIEVkaXRvci1vbmx5IGR1bXAgZW50cmllcyB0aGF0IGhhdmUgbm8gc2VyaWFsaXplZCBjb3VudGVycGFydCBpbiBhIC5wcmVmYWIgZmlsZS4gKi9cbmNvbnN0IERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRCA9IG5ldyBTZXQoW1xuICAgICdub2RlJywgJ2VuYWJsZWQnLCAnX190eXBlX18nLCAndXVpZCcsICduYW1lJywgJ19fc2NyaXB0QXNzZXQnLFxuICAgICdfb2JqRmxhZ3MnLCAnX25hbWUnLCAnX2lkJywgJ19lbmFibGVkJywgJ19fcHJlZmFiJywgJ19fZWRpdG9yRXh0cmFzX18nXG5dKTtcblxuLyoqIFRoZSBlbnZlbG9wZSBldmVyeSBzZXJpYWxpemVkIGNvbXBvbmVudCBjYXJyaWVzIGV2ZW4gd2hlbiBpdCBob2xkcyBubyBwcm9wZXJ0aWVzLiAqL1xuY29uc3QgQkFTRV9DT01QT05FTlRfS0VZUyA9IG5ldyBTZXQoW1xuICAgICdfX3R5cGVfXycsICdfbmFtZScsICdfb2JqRmxhZ3MnLCAnX19lZGl0b3JFeHRyYXNfXycsICdub2RlJywgJ19lbmFibGVkJywgJ19fcHJlZmFiJywgJ19pZCdcbl0pO1xuXG4vKipcbiAqIER1bXAga2V5cyB3aG9zZSBzZXJpYWxpemVkIGZpZWxkIG5hbWUgZGlmZmVycyAoYWNjZXNzb3ItYmFja2VkIGVuZ2luZSBwcm9wZXJ0aWVzKS5cbiAqXG4gKiBWZXJpZmllZCBvbmx5IGZvciB0aGVzZSBmb3VyIHR5cGVzIOKAlCBldmVyeSBvdGhlciBlbmdpbmUgYGNjLipgL2BzcC4qYC9gZHJhZ29uQm9uZXMuKmBcbiAqIGNvbXBvbmVudCBmYWxscyB0aHJvdWdoIHRvIHRoZSBnZW5lcmljIGJyYW5jaCBiZWxvdywgd2hpY2ggZW1pdHMgdGhlIGR1bXAga2V5XG4gKiBWRVJCQVRJTS4gRm9yIG1vc3QgZW5naW5lIHR5cGVzIHRoZSBkdW1wIGtleSBhbHJlYWR5IG1hdGNoZXMgdGhlIHNlcmlhbGl6ZWQga2V5XG4gKiAoZS5nLiBgY2MuUGFydGljbGVTeXN0ZW0yRGAncyBgZW1pc3Npb25SYXRlYCksIGJ1dCBhbiBhY2Nlc3Nvci1iYWNrZWQgZmllbGQgb24gYSB0eXBlXG4gKiBub3QgbGlzdGVkIGhlcmUgd291bGQgc2VyaWFsaXplIHVuZGVyIHRoZSBXUk9ORyBrZXkgcmF0aGVyIHRoYW4gYmVpbmcgZHJvcHBlZCDigJQgYVxuICoga25vd24sIHVuZGV0ZWN0YWJsZS13aXRob3V0LWEtbGl2ZS1lZGl0b3IgbGltaXRhdGlvbiBvZiB0aGlzIGZpeC4gRXh0ZW5kIHRoaXMgdGFibGVcbiAqIGFzIHNwZWNpZmljIG1pc21hdGNoZXMgYXJlIGNvbmZpcm1lZCBhZ2FpbnN0IGEgcnVubmluZyBDb2NvcyBDcmVhdG9yIDMuOC43IGluc3RhbmNlLlxuICovXG5jb25zdCBEVU1QX0tFWV9SRU5BTUVTOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHtcbiAgICAnY2MuVUlUcmFuc2Zvcm0nOiB7IGNvbnRlbnRTaXplOiAnX2NvbnRlbnRTaXplJywgYW5jaG9yUG9pbnQ6ICdfYW5jaG9yUG9pbnQnIH0sXG4gICAgJ2NjLlNwcml0ZSc6IHsgc3ByaXRlRnJhbWU6ICdfc3ByaXRlRnJhbWUnLCB0eXBlOiAnX3R5cGUnLCBzaXplTW9kZTogJ19zaXplTW9kZScsIGZpbGxUeXBlOiAnX2ZpbGxUeXBlJyB9LFxuICAgICdjYy5MYWJlbCc6IHsgc3RyaW5nOiAnX3N0cmluZycsIGZvbnRTaXplOiAnX2ZvbnRTaXplJywgbGluZUhlaWdodDogJ19saW5lSGVpZ2h0Jywgb3ZlcmZsb3c6ICdfb3ZlcmZsb3cnIH0sXG4gICAgJ2NjLkJ1dHRvbic6IHsgdGFyZ2V0OiAnX3RhcmdldCcsIGludGVyYWN0YWJsZTogJ19pbnRlcmFjdGFibGUnLCB0cmFuc2l0aW9uOiAnX3RyYW5zaXRpb24nIH0sXG59O1xuXG4vKipcbiAqIEdhcC1maWxsZXJzLCBhcHBsaWVkIG9ubHkgdG8ga2V5cyB0aGUgZHVtcCBkaWQgbm90IHN1cHBseS4gVGhlc2UgYXJlIGVuZ2luZSBkZWZhdWx0cyDigJRcbiAqIG5ldmVyIGFuIG92ZXJyaWRlIG9mIGEgY2FwdHVyZWQgdmFsdWUuXG4gKi9cbmNvbnN0IENPTVBPTkVOVF9ERUZBVUxUUzogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgYW55Pj4gPSB7XG4gICAgJ2NjLlVJVHJhbnNmb3JtJzoge1xuICAgICAgICBfY29udGVudFNpemU6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlNpemVcIiwgXCJ3aWR0aFwiOiAxMDAsIFwiaGVpZ2h0XCI6IDEwMCB9LFxuICAgICAgICBfYW5jaG9yUG9pbnQ6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzJcIiwgXCJ4XCI6IDAuNSwgXCJ5XCI6IDAuNSB9LFxuICAgIH0sXG4gICAgJ2NjLlNwcml0ZSc6IHtcbiAgICAgICAgX3Nwcml0ZUZyYW1lOiBudWxsLCBfdHlwZTogMCwgX2ZpbGxUeXBlOiAwLCBfc2l6ZU1vZGU6IDEsXG4gICAgICAgIF9maWxsQ2VudGVyOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiAwLCBcInlcIjogMCB9LFxuICAgICAgICBfZmlsbFN0YXJ0OiAwLCBfZmlsbFJhbmdlOiAwLCBfaXNUcmltbWVkTW9kZTogdHJ1ZSwgX3VzZUdyYXlzY2FsZTogZmFsc2UsXG4gICAgICAgIF9hdGxhczogbnVsbCxcbiAgICB9LFxuICAgICdjYy5CdXR0b24nOiB7XG4gICAgICAgIF9pbnRlcmFjdGFibGU6IHRydWUsIF90cmFuc2l0aW9uOiAzLFxuICAgICAgICBfbm9ybWFsQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyNTUsIFwiZ1wiOiAyNTUsIFwiYlwiOiAyNTUsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX2hvdmVyQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyMTEsIFwiZ1wiOiAyMTEsIFwiYlwiOiAyMTEsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX3ByZXNzZWRDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDI1NSwgXCJnXCI6IDI1NSwgXCJiXCI6IDI1NSwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfZGlzYWJsZWRDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDEyNCwgXCJnXCI6IDEyNCwgXCJiXCI6IDEyNCwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfbm9ybWFsU3ByaXRlOiBudWxsLCBfaG92ZXJTcHJpdGU6IG51bGwsIF9wcmVzc2VkU3ByaXRlOiBudWxsLCBfZGlzYWJsZWRTcHJpdGU6IG51bGwsXG4gICAgICAgIF9kdXJhdGlvbjogMC4xLCBfem9vbVNjYWxlOiAxLjIsIF9jbGlja0V2ZW50czogW10sXG4gICAgfSxcbiAgICAnY2MuTGFiZWwnOiB7XG4gICAgICAgIF9zdHJpbmc6IFwiTGFiZWxcIiwgX2hvcml6b250YWxBbGlnbjogMSwgX3ZlcnRpY2FsQWxpZ246IDEsXG4gICAgICAgIF9hY3R1YWxGb250U2l6ZTogMjAsIF9mb250U2l6ZTogMjAsIF9mb250RmFtaWx5OiBcIkFyaWFsXCIsXG4gICAgICAgIF9saW5lSGVpZ2h0OiAyNSwgX292ZXJmbG93OiAwLCBfZW5hYmxlV3JhcFRleHQ6IHRydWUsXG4gICAgICAgIF9mb250OiBudWxsLCBfaXNTeXN0ZW1Gb250VXNlZDogdHJ1ZSwgX3NwYWNpbmdYOiAwLFxuICAgICAgICBfaXNJdGFsaWM6IGZhbHNlLCBfaXNCb2xkOiBmYWxzZSwgX2lzVW5kZXJsaW5lOiBmYWxzZSxcbiAgICAgICAgX3VuZGVybGluZUhlaWdodDogMiwgX2NhY2hlTW9kZTogMCxcbiAgICB9LFxufTtcblxuZXhwb3J0IGNsYXNzIFByZWZhYkNyZWF0aW9uU2VydmljZSB7XG5cbiAgICBhc3luYyBjcmVhdGVQcmVmYWJXaXRoQXNzZXREQihub2RlVXVpZDogc3RyaW5nLCBzYXZlUGF0aDogc3RyaW5nLCBwcmVmYWJOYW1lOiBzdHJpbmcsIGluY2x1ZGVDaGlsZHJlbjogYm9vbGVhbiwgaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGEgPSBhd2FpdCB0aGlzLmdldE5vZGVEYXRhKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0Nhbm5vdCBnZXQgbm9kZSBkYXRhJyB9O1xuXG4gICAgICAgICAgICBjb25zdCB0ZW1wUHJlZmFiQ29udGVudCA9IEpTT04uc3RyaW5naWZ5KFt7IFwiX190eXBlX19cIjogXCJjYy5QcmVmYWJcIiwgXCJfbmFtZVwiOiBwcmVmYWJOYW1lIH1dLCBudWxsLCAyKTtcbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZVJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRlQXNzZXRXaXRoQXNzZXREQihzYXZlUGF0aCwgdGVtcFByZWZhYkNvbnRlbnQpO1xuICAgICAgICAgICAgaWYgKCFjcmVhdGVSZXN1bHQuc3VjY2VzcykgcmV0dXJuIGNyZWF0ZVJlc3VsdDtcblxuICAgICAgICAgICAgY29uc3QgYWN0dWFsUHJlZmFiVXVpZCA9IGNyZWF0ZVJlc3VsdC5kYXRhPy51dWlkO1xuICAgICAgICAgICAgaWYgKCFhY3R1YWxQcmVmYWJVdWlkKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDYW5ub3QgZ2V0IGVuZ2luZS1hc3NpZ25lZCBwcmVmYWIgVVVJRCcgfTtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiQ29udGVudCA9IGF3YWl0IHRoaXMuY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50KG5vZGVEYXRhLCBwcmVmYWJOYW1lLCBhY3R1YWxQcmVmYWJVdWlkLCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZUxvc3MgPSB0aGlzLmRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKHRoaXMubGFzdFJlZmVyZW5jZUxvc3Nlcyk7XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlTG9zcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byB3cml0ZSAke3NhdmVQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIHJlZmVyZW5jZUxvc3NlczogdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCBKU09OLnN0cmluZ2lmeShwcmVmYWJDb250ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZU1ldGFXaXRoQXNzZXREQihzYXZlUGF0aCwgdGhpcy5jcmVhdGVTdGFuZGFyZE1ldGFDb250ZW50KHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVpbXBvcnRBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgLy8gUmVhZCB0aGUgYXNzZXQgYmFjayBiZWZvcmUgcmVwb3J0aW5nIHN1Y2Nlc3MuIENvbXBvbmVudHMgdGhhdCB3ZXJlXG4gICAgICAgICAgICAvLyBjb25maWd1cmVkIGluIHRoZSBzY2VuZSBidXQgc2VyaWFsaXplZCB0byBhIGJhcmUgZW52ZWxvcGUgYXJlIGEgc2lsZW50XG4gICAgICAgICAgICAvLyBkYXRhIGxvc3MgdGhlIGNhbGxlciBjYW5ub3Qgb3RoZXJ3aXNlIGRldGVjdCAoIzI4KS5cbiAgICAgICAgICAgIGNvbnN0IHJlYWRCYWNrID0gYXdhaXQgdGhpcy5yZWFkQmFja1ByZWZhYihzYXZlUGF0aCwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhyZWFkQmFjay5kYXRhLCBub2RlRGF0YSk7XG4gICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7c2F2ZVBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QsIHZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIGFjdHVhbFByZWZhYlV1aWQsIHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNWZXJpZmllZEZyb206IHJlYWRCYWNrLnNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY29udmVydFJlc3VsdC5zdWNjZXNzID8gJ1ByZWZhYiBjcmVhdGVkIGFuZCBub2RlIGNvbnZlcnRlZCcgOiAnUHJlZmFiIGNyZWF0ZWQsIG5vZGUgY29udmVyc2lvbiBmYWlsZWQnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBjcmVhdGUgcHJlZmFiOiAke2Vycm9yfWAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNyZWF0ZVByZWZhYk5hdGl2ZVN0dWIoKTogYW55IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdOYXRpdmUgcHJlZmFiIGNyZWF0aW9uIEFQSSBub3QgYXZhaWxhYmxlJyxcbiAgICAgICAgICAgIGluc3RydWN0aW9uOiAnVG8gY3JlYXRlIGEgcHJlZmFiIGluIENvY29zIENyZWF0b3I6XFxuMS4gU2VsZWN0IGEgbm9kZSBpbiB0aGUgc2NlbmVcXG4yLiBEcmFnIGl0IHRvIHRoZSBBc3NldCBCcm93c2VyXFxuMy4gT3IgcmlnaHQtY2xpY2sgdGhlIG5vZGUgYW5kIHNlbGVjdCBcIkNyZWF0ZSBQcmVmYWJcIidcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBhc3luYyBjcmVhdGVQcmVmYWJDdXN0b20obm9kZVV1aWQ6IHN0cmluZywgcHJlZmFiUGF0aDogc3RyaW5nLCBwcmVmYWJOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGEgPSBhd2FpdCB0aGlzLmdldE5vZGVEYXRhKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgbm90IGZvdW5kOiAke25vZGVVdWlkfWAgfTtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiVXVpZCA9IHRoaXMuZ2VuZXJhdGVVVUlEKCk7XG4gICAgICAgICAgICBjb25zdCBwcmVmYWJKc29uRGF0YSA9IGF3YWl0IHRoaXMuY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50KG5vZGVEYXRhLCBwcmVmYWJOYW1lLCBwcmVmYWJVdWlkLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZUxvc3MgPSB0aGlzLmRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKHRoaXMubGFzdFJlZmVyZW5jZUxvc3Nlcyk7XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlTG9zcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byB3cml0ZSAke3ByZWZhYlBhdGh9OiAke3JlZmVyZW5jZUxvc3N9IFRoZSB3cml0dGVuIHByZWZhYiB3b3VsZCBub3QgYmUgZXF1aXZhbGVudCB0byB0aGUgc2NlbmUgc3VidHJlZSDigJQgdGhpcyBpcyBpc3N1ZSAjNzMncyBhc3NldC1yZWZlcmVuY2UgbG9zcy5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCByZWZlcmVuY2VMb3NzZXM6IHRoaXMubGFzdFJlZmVyZW5jZUxvc3NlcyB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHNhdmVSZXN1bHQgPSBhd2FpdCB0aGlzLnNhdmVQcmVmYWJXaXRoTWV0YShwcmVmYWJQYXRoLCBwcmVmYWJKc29uRGF0YSwgdGhpcy5jcmVhdGVTdGFuZGFyZE1ldGFDb250ZW50KHByZWZhYk5hbWUsIHByZWZhYlV1aWQpKTtcblxuICAgICAgICAgICAgaWYgKHNhdmVSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxvc3QgPSB0aGlzLmZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHByZWZhYkpzb25EYXRhLCBub2RlRGF0YSk7XG4gICAgICAgICAgICAgICAgaWYgKGxvc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHdyaXR0ZW4gdG8gJHtwcmVmYWJQYXRofSwgYnV0IHRoZXNlIGNvbXBvbmVudHMgc2VyaWFsaXplZCB3aXRoIG5vIHByb3BlcnRpZXM6ICR7bG9zdC5qb2luKCcsICcpfS4gVGhlIHNjZW5lIHZhbHVlcyB3ZXJlIG5vdCBjYXB0dXJlZCDigJQgZG8gbm90IHVzZSB0aGlzIHByZWZhYi5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkLCBwcmVmYWJQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSwgY29tcG9uZW50c1dpdGhvdXRQcm9wZXJ0aWVzOiBsb3N0IH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgY29udmVydFJlc3VsdCA9IGF3YWl0IHRoaXMuY29udmVydE5vZGVUb1ByZWZhYkluc3RhbmNlKG5vZGVVdWlkLCBwcmVmYWJQYXRoLCBwcmVmYWJVdWlkKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkLCBwcmVmYWJQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnZlcnRlZFRvUHJlZmFiSW5zdGFuY2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyA/ICdDdXN0b20gcHJlZmFiIGNyZWF0ZWQgYW5kIG5vZGUgY29udmVydGVkJyA6ICdQcmVmYWIgY3JlYXRlZCwgbm9kZSBjb252ZXJzaW9uIGZhaWxlZCdcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IHNhdmVSZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBzYXZlIHByZWZhYiBmaWxlJyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRXJyb3IgY3JlYXRpbmcgcHJlZmFiOiAke2Vycm9yfWAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vID09PT09IE5vZGUgZGF0YSByZXRyaWV2YWwgPT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Tm9kZURhdGEobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVJbmZvKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldE5vZGVXaXRoQ2hpbGRyZW4obm9kZVV1aWQpIHx8IG5vZGVJbmZvO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlV2l0aENoaWxkcmVuKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHJlZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgaWYgKCF0cmVlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldE5vZGUgPSB0aGlzLmZpbmROb2RlSW5UcmVlKHRyZWUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXROb2RlID8gYXdhaXQgdGhpcy5lbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKHRhcmdldE5vZGUpIDogbnVsbDtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuaGFuY2Ugbm9kZSB0cmVlIHdpdGggYWNjdXJhdGUgY29tcG9uZW50IGluZm8gdmlhIGRpcmVjdCBFZGl0b3IgQVBJLlxuICAgICAqIFJlcGxhY2VzIHByZXZpb3VzIEhUVFAgc2VsZi1jYWxsIHRvIGxvY2FsaG9zdDo4NTg1IHdoaWNoIHdhcyBmcmFnaWxlIGFuZCBwb3J0LWRlcGVuZGVudC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHMobm9kZTogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgaWYgKCFub2RlIHx8ICFub2RlLnV1aWQpIHJldHVybiBub2RlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZS51dWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSkge1xuICAgICAgICAgICAgICAgIC8vIENhcnJ5IHRoZSB0cmFuc2Zvcm0gZHVtcCB0aHJvdWdoIHNvIGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSBjYW4gcmVhZFxuICAgICAgICAgICAgICAgIC8vIHBvc2l0aW9uL3JvdGF0aW9uL3NjYWxlIGluc3RlYWQgb2YgZmFsbGluZyBiYWNrIHRvIGlkZW50aXR5IChpc3N1ZSAjNTApLlxuICAgICAgICAgICAgICAgIC8vIFRoZSBxdWVyeS1ub2RlIGR1bXAgc2hhcGVzIHRoZXNlIGFzIHsgdmFsdWU6IHsgeCwgeSwgeiB9IH0gKGFuZCB3IGZvciBxdWF0KSxcbiAgICAgICAgICAgICAgICAvLyB3aGljaCBpcyBleGFjdGx5IHRoZSBzaGFwZSBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUgcmVhZHMgdmlhIG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZS5cbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEucG9zaXRpb24pIG5vZGUucG9zaXRpb24gPSBub2RlRGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEucm90YXRpb24pIG5vZGUucm90YXRpb24gPSBub2RlRGF0YS5yb3RhdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuc2NhbGUpIG5vZGUuc2NhbGUgPSBub2RlRGF0YS5zY2FsZTtcbiAgICAgICAgICAgICAgICAvLyBUaGUgbGF5ZXIgaXMgY2FycmllZCBmb3IgdGhlIHNhbWUgcmVhc29uOiBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUgaGFyZGNvZGVkXG4gICAgICAgICAgICAgICAgLy8gREVGQVVMVCwgc28gZXZlcnkgbm9kZSBvZiBhIGNyZWF0ZWQgcHJlZmFiIGxhbmRlZCBvbiB0aGUgREVGQVVMVCBsYXllciBhbmQgYVxuICAgICAgICAgICAgICAgIC8vIFVJIHByZWZhYiAoVUlfMkQpIHdhcyBjdWxsZWQgYnkgdGhlIFVJIGNhbWVyYSDigJQgaXQgcmVuZGVyZWQgbm90aGluZy5cbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEubGF5ZXIgIT09IHVuZGVmaW5lZCkgbm9kZS5sYXllciA9IG5vZGVEYXRhLmxheWVyO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gYHByb3BlcnRpZXNgIGNhcnJpZXMgdGhlIGxpdmUgcHJvcGVydHkgZHVtcCB0aHJvdWdoIHRvIHNlcmlhbGl6YXRpb24uXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlZHVjaW5nIGVhY2ggY29tcG9uZW50IHRvIHR5cGUvdXVpZC9lbmFibGVkIGRpc2NhcmRlZCBldmVyeSBjb25maWd1cmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIHZhbHVlIGJlZm9yZSBpdCBjb3VsZCBiZSB3cml0dGVuLCBzbyBgYWN0aW9uPWNyZWF0ZWAgc2F2ZWQgZW5naW5lXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHRzIGZvciBldmVyeSBjb21wb25lbnQgdHlwZSAoIzI4KS5cbiAgICAgICAgICAgICAgICAgICAgbm9kZS5jb21wb25lbnRzID0gbm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGR1bXAgbmVzdHMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIHVuZGVyIHZhbHVlLnV1aWQudmFsdWU7IHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9wLWxldmVsIGNvbXAudXVpZCBkb2VzIG5vdCBleGlzdCAoc2FtZSBzaGFwZSBNYW5hZ2VDb21wb25lbnQuZ2V0Q29tcG9uZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxyZWFkeSBhY2NvdW50cyBmb3IpLiBSZWFkaW5nIG9ubHkgY29tcC51dWlkIGxlZnQgY29tcG9uZW50VXVpZFRvSW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBlcm1hbmVudGx5IGVtcHR5LCBzbyBldmVyeSBjcm9zcy1jb21wb25lbnQgcmVmZXJlbmNlIG9uIGEgY3JlYXRlZCBwcmVmYWJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIChlLmcuIGEgc2NyaXB0J3MgQHByb3BlcnR5KE1lc2hSZW5kZXJlcikvQHByb3BlcnR5KExhYmVsKSBmaWVsZCBwb2ludGluZyBhdFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYSBkZXNjZW5kYW50IG5vZGUncyBjb21wb25lbnQpIHNpbGVudGx5IHNlcmlhbGl6ZWQgYXMgbnVsbC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXAudmFsdWU/LnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wKGNvbXApXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYE5vZGUgJHtub2RlLnV1aWR9IGVuaGFuY2VkIHdpdGggJHtub2RlLmNvbXBvbmVudHMubGVuZ3RofSBjb21wb25lbnRzIChpbmNsLiBzY3JpcHQgdHlwZXMpYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudCBpbmZvIGZvciBub2RlICR7bm9kZS51dWlkfTpgLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4gJiYgQXJyYXkuaXNBcnJheShub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbltpXSA9IGF3YWl0IHRoaXMuZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyhub2RlLmNoaWxkcmVuW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGZpbmROb2RlSW5UcmVlKG5vZGU6IGFueSwgdGFyZ2V0VXVpZDogc3RyaW5nKTogYW55IHtcbiAgICAgICAgaWYgKCFub2RlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKG5vZGUudXVpZCA9PT0gdGFyZ2V0VXVpZCB8fCBub2RlLnZhbHVlPy51dWlkID09PSB0YXJnZXRVdWlkKSByZXR1cm4gbm9kZTtcbiAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4gJiYgQXJyYXkuaXNBcnJheShub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLmZpbmROb2RlSW5UcmVlKGNoaWxkLCB0YXJnZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldENoaWxkcmVuVG9Qcm9jZXNzKG5vZGVEYXRhOiBhbnkpOiBhbnlbXSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuOiBhbnlbXSA9IFtdO1xuICAgICAgICBpZiAobm9kZURhdGEuY2hpbGRyZW4gJiYgQXJyYXkuaXNBcnJheShub2RlRGF0YS5jaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZURhdGEuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pc1ZhbGlkTm9kZURhdGEoY2hpbGQpKSBjaGlsZHJlbi5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpc1ZhbGlkTm9kZURhdGEobm9kZURhdGE6IGFueSk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIW5vZGVEYXRhIHx8IHR5cGVvZiBub2RlRGF0YSAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG5vZGVEYXRhLmhhc093blByb3BlcnR5KCd1dWlkJykgfHwgbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ25hbWUnKSB8fCBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgnX190eXBlX18nKSB8fFxuICAgICAgICAgICAgKG5vZGVEYXRhLnZhbHVlICYmIChub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgndXVpZCcpIHx8IG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCduYW1lJykgfHwgbm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ19fdHlwZV9fJykpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGV4dHJhY3ROb2RlVXVpZChub2RlRGF0YTogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIG5vZGVEYXRhLnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gbm9kZURhdGEudXVpZDtcbiAgICAgICAgaWYgKG5vZGVEYXRhLnZhbHVlICYmIHR5cGVvZiBub2RlRGF0YS52YWx1ZS51dWlkID09PSAnc3RyaW5nJykgcmV0dXJuIG5vZGVEYXRhLnZhbHVlLnV1aWQ7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vID09PT09IFByZWZhYiBzZXJpYWxpemF0aW9uID09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YTogYW55LCBwcmVmYWJOYW1lOiBzdHJpbmcsIHByZWZhYlV1aWQ6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IFByb21pc2U8YW55W10+IHtcbiAgICAgICAgY29uc3QgcHJlZmFiRGF0YTogYW55W10gPSBbXTtcbiAgICAgICAgcHJlZmFiRGF0YS5wdXNoKHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5QcmVmYWJcIiwgXCJfbmFtZVwiOiBwcmVmYWJOYW1lIHx8IFwiXCIsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwiX25hdGl2ZVwiOiBcIlwiLCBcImRhdGFcIjogeyBcIl9faWRfX1wiOiAxIH0sIFwib3B0aW1pemF0aW9uUG9saWN5XCI6IDAsIFwicGVyc2lzdGVudFwiOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjb250ZXh0ID0ge1xuICAgICAgICAgICAgcHJlZmFiRGF0YSwgY3VycmVudElkOiAyLCBwcmVmYWJBc3NldEluZGV4OiAwLFxuICAgICAgICAgICAgbm9kZUZpbGVJZHM6IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCksXG4gICAgICAgICAgICBub2RlVXVpZFRvSW5kZXg6IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCksXG4gICAgICAgICAgICBjb21wb25lbnRVdWlkVG9JbmRleDogbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKSxcbiAgICAgICAgICAgIGxvc3NlczogW10gYXMgQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+XG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVDb21wbGV0ZU5vZGVUcmVlKG5vZGVEYXRhLCBudWxsLCAxLCBjb250ZXh0LCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzID0gY29udGV4dC5sb3NzZXM7XG4gICAgICAgIHJldHVybiBwcmVmYWJEYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZmVyZW5jZXMgdGhlIG1vc3QgcmVjZW50IGBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnRgIGNhbGwgY291bGQgbm90IHNlcmlhbGl6ZS5cbiAgICAgKlxuICAgICAqIFRoZSBjcmVhdGUgcGF0aHMgYXJlIHBsYWluIGZ1bmN0aW9ucyByZXR1cm5pbmcgdGhlIHByZWZhYiBKU09OLCBzbyBhIGxvc3MgY2Fubm90IGJlXG4gICAgICogdGhyb3duIGZyb20gd2hlcmUgaXQgaXMgZGV0ZWN0ZWQgd2l0aG91dCBhYmFuZG9uaW5nIGEgdmFsaWQgYGZhdGFsYCBmYWlsdXJlIHJlcG9ydC5cbiAgICAgKiBCb3RoIGNyZWF0ZSBwYXRocyByZWFkIHRoaXMgaW1tZWRpYXRlbHkgYWZ0ZXIgc2VyaWFsaXppbmcgYW5kIGZhaWwgb24gYSBub24tZW1wdHlcbiAgICAgKiBsaXN0IOKAlCB0aGUgc2FtZSBjb250cmFjdCBhcyB0aGUgZXhpc3RpbmcgYGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzYCBjaGVjay5cbiAgICAgKi9cbiAgICBwcml2YXRlIGxhc3RSZWZlcmVuY2VMb3NzZXM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICBub2RlRGF0YTogYW55LCBwYXJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwsIG5vZGVJbmRleDogbnVtYmVyLFxuICAgICAgICBjb250ZXh0OiB7IHByZWZhYkRhdGE6IGFueVtdOyBjdXJyZW50SWQ6IG51bWJlcjsgcHJlZmFiQXNzZXRJbmRleDogbnVtYmVyOyBub2RlRmlsZUlkczogTWFwPHN0cmluZywgc3RyaW5nPjsgbm9kZVV1aWRUb0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+OyBjb21wb25lbnRVdWlkVG9JbmRleDogTWFwPHN0cmluZywgbnVtYmVyPjsgbG9zc2VzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT4gfSxcbiAgICAgICAgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbiwgbm9kZU5hbWU/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgeyBwcmVmYWJEYXRhIH0gPSBjb250ZXh0O1xuICAgICAgICBjb25zdCBub2RlID0gdGhpcy5jcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUobm9kZURhdGEsIHBhcmVudE5vZGVJbmRleCwgbm9kZU5hbWUpO1xuXG4gICAgICAgIHdoaWxlIChwcmVmYWJEYXRhLmxlbmd0aCA8PSBub2RlSW5kZXgpIHByZWZhYkRhdGEucHVzaChudWxsKTtcbiAgICAgICAgcHJlZmFiRGF0YVtub2RlSW5kZXhdID0gbm9kZTtcblxuICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRoaXMuZXh0cmFjdE5vZGVVdWlkKG5vZGVEYXRhKTtcbiAgICAgICAgY29uc3QgZmlsZUlkID0gbm9kZVV1aWQgfHwgdGhpcy5nZW5lcmF0ZUZpbGVJZCgpO1xuICAgICAgICBjb250ZXh0Lm5vZGVGaWxlSWRzLnNldChub2RlSW5kZXgudG9TdHJpbmcoKSwgZmlsZUlkKTtcbiAgICAgICAgaWYgKG5vZGVVdWlkKSBjb250ZXh0Lm5vZGVVdWlkVG9JbmRleC5zZXQobm9kZVV1aWQsIG5vZGVJbmRleCk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW5Ub1Byb2Nlc3MgPSB0aGlzLmdldENoaWxkcmVuVG9Qcm9jZXNzKG5vZGVEYXRhKTtcbiAgICAgICAgaWYgKGluY2x1ZGVDaGlsZHJlbiAmJiBjaGlsZHJlblRvUHJvY2Vzcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjaGlsZEluZGljZXM6IG51bWJlcltdID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgY2hpbGRJbmRpY2VzLnB1c2goY2hpbGRJbmRleCk7XG4gICAgICAgICAgICAgICAgbm9kZS5fY2hpbGRyZW4ucHVzaCh7IFwiX19pZF9fXCI6IGNoaWxkSW5kZXggfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlblRvUHJvY2Vzc1tpXSwgbm9kZUluZGV4LCBjaGlsZEluZGljZXNbaV0sIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHMsIGNoaWxkcmVuVG9Qcm9jZXNzW2ldLm5hbWUgfHwgYENoaWxkJHtpICsgMX1gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmNsdWRlQ29tcG9uZW50cyAmJiBub2RlRGF0YS5jb21wb25lbnRzICYmIEFycmF5LmlzQXJyYXkobm9kZURhdGEuY29tcG9uZW50cykpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcG9uZW50IG9mIG5vZGVEYXRhLmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgbm9kZS5fY29tcG9uZW50cy5wdXNoKHsgXCJfX2lkX19cIjogY29tcG9uZW50SW5kZXggfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IGNvbXBvbmVudC51dWlkIHx8IChjb21wb25lbnQudmFsdWUgJiYgY29tcG9uZW50LnZhbHVlLnV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRVdWlkKSBjb250ZXh0LmNvbXBvbmVudFV1aWRUb0luZGV4LnNldChjb21wb25lbnRVdWlkLCBjb21wb25lbnRJbmRleCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50T2JqID0gdGhpcy5jcmVhdGVDb21wb25lbnRPYmplY3QoY29tcG9uZW50LCBub2RlSW5kZXgsIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdID0gY29tcG9uZW50T2JqO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBQcmVmYWJJbmZvSW5kZXggPSBjb250ZXh0LmN1cnJlbnRJZCsrO1xuICAgICAgICAgICAgICAgIHByZWZhYkRhdGFbY29tcFByZWZhYkluZm9JbmRleF0gPSB7IFwiX190eXBlX19cIjogXCJjYy5Db21wUHJlZmFiSW5mb1wiLCBcImZpbGVJZFwiOiB0aGlzLmdlbmVyYXRlRmlsZUlkKCkgfTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50T2JqICYmIHR5cGVvZiBjb21wb25lbnRPYmogPT09ICdvYmplY3QnKSBjb21wb25lbnRPYmouX19wcmVmYWIgPSB7IFwiX19pZF9fXCI6IGNvbXBQcmVmYWJJbmZvSW5kZXggfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByZWZhYkluZm9JbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgIG5vZGUuX3ByZWZhYiA9IHsgXCJfX2lkX19cIjogcHJlZmFiSW5mb0luZGV4IH07XG4gICAgICAgIHByZWZhYkRhdGFbcHJlZmFiSW5mb0luZGV4XSA9IHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5QcmVmYWJJbmZvXCIsIFwicm9vdFwiOiB7IFwiX19pZF9fXCI6IDEgfSwgXCJhc3NldFwiOiB7IFwiX19pZF9fXCI6IGNvbnRleHQucHJlZmFiQXNzZXRJbmRleCB9LFxuICAgICAgICAgICAgXCJmaWxlSWRcIjogZmlsZUlkLCBcInRhcmdldE92ZXJyaWRlc1wiOiBudWxsLCBcIm5lc3RlZFByZWZhYkluc3RhbmNlUm9vdHNcIjogbnVsbCwgXCJpbnN0YW5jZVwiOiBudWxsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnRleHQuY3VycmVudElkID0gcHJlZmFiSW5mb0luZGV4ICsgMTtcbiAgICB9XG5cbiAgICAvKiogYGNjLkxheWVycy5FbnVtLkRFRkFVTFRgICgxIDw8IDMwKSDigJQgdGhlIGZhbGxiYWNrIHdoZW4gYSBub2RlIGR1bXAgY2FycmllcyBubyBsYXllci4gKi9cbiAgICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0xBWUVSID0gMTA3Mzc0MTgyNDtcblxuICAgIC8qKlxuICAgICAqIEV1bGVyIGFuZ2xlcyBpbiBERUdSRUVTIHRvIGEgcXVhdGVybmlvbiwgbWF0Y2hpbmcgYGNjLlF1YXQuZnJvbUV1bGVyYCBleGFjdGx5LlxuICAgICAqIFZlcmlmaWVkIGFnYWluc3QgQ29jb3MgQ3JlYXRvciAzLjguNzogZXVsZXIgKDEwLCAyMCwgMzApIHNlcmlhbGl6ZXMgYXNcbiAgICAgKiAoMC4xMjc2Nzk0NDA2OTU3ODA2MywgMC4xODkzMDc4NTc0MTE5OTk5OSwgMC4yMzkyOTgzMzc3NDQ3MzAzLCAwLjk0MzcxNDM2NDE0NzQ4OSkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgZXVsZXJEZWdyZWVzVG9RdWF0KGU6IGFueSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgdzogbnVtYmVyIH0ge1xuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBNYXRoLlBJIC8gMTgwO1xuICAgICAgICBjb25zdCB4ID0gKGUueCB8fCAwKSAqIGhhbGZUb1JhZCwgeSA9IChlLnkgfHwgMCkgKiBoYWxmVG9SYWQsIHogPSAoZS56IHx8IDApICogaGFsZlRvUmFkO1xuICAgICAgICBjb25zdCBzeCA9IE1hdGguc2luKHgpLCBjeCA9IE1hdGguY29zKHgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKHkpLCBjeSA9IE1hdGguY29zKHkpO1xuICAgICAgICBjb25zdCBzeiA9IE1hdGguc2luKHopLCBjeiA9IE1hdGguY29zKHopO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogc3ggKiBjeSAqIGN6ICsgY3ggKiBzeSAqIHN6LFxuICAgICAgICAgICAgeTogY3ggKiBzeSAqIGN6ICsgc3ggKiBjeSAqIHN6LFxuICAgICAgICAgICAgejogY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6LFxuICAgICAgICAgICAgdzogY3ggKiBjeSAqIGN6IC0gc3ggKiBzeSAqIHN6LFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlKG5vZGVEYXRhOiBhbnksIHBhcmVudE5vZGVJbmRleDogbnVtYmVyIHwgbnVsbCwgbm9kZU5hbWU/OiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBjb25zdCBuYW1lID0gbm9kZU5hbWUgfHwgbm9kZURhdGEubmFtZT8udmFsdWUgfHwgbm9kZURhdGEubmFtZSB8fCAnTm9kZSc7XG4gICAgICAgIGNvbnN0IGxwb3MgPSBub2RlRGF0YS5wb3NpdGlvbj8udmFsdWUgfHwgbm9kZURhdGEubHBvcz8udmFsdWUgfHwgbm9kZURhdGEuX2xwb3MgfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH07XG4gICAgICAgIGNvbnN0IHJvdER1bXAgPSBub2RlRGF0YS5yb3RhdGlvbj8udmFsdWUgfHwgbm9kZURhdGEubHJvdD8udmFsdWUgfHwgbm9kZURhdGEuX2xyb3QgfHwgeyB4OiAwLCB5OiAwLCB6OiAwLCB3OiAxIH07XG4gICAgICAgIC8vIGBxdWVyeS1ub2RlYCByZXBvcnRzIHJvdGF0aW9uIGFzIEVVTEVSIERFR1JFRVMgKGNjLlZlYzMsIG5vIGB3YCkg4oCUIHRoZSB2YWx1ZSB0aGVcbiAgICAgICAgLy8gaW5zcGVjdG9yJ3MgUm90YXRpb24gZmllbGQgc2hvd3MuIGBfbHJvdGAgaXMgYSBxdWF0ZXJuaW9uLCBzbyBwYXNzaW5nIHRoZSBkdW1wXG4gICAgICAgIC8vIHN0cmFpZ2h0IHRocm91Z2ggc3RvcmVkIGEgZGVncmVlIGluIGEgcXVhdGVybmlvbiBjb21wb25lbnQ6IGEgLTAuMSBkZWdyZWUgdGlsdCB3YXNcbiAgICAgICAgLy8gd3JpdHRlbiBhcyB7ejogLTAuMSwgdzogMX0sIHdoaWNoIHRoZSBlbmdpbmUgcmVhZHMgYmFjayBhcyByb3VnaGx5IC0xMS40NiBkZWdyZWVzLlxuICAgICAgICBjb25zdCBpc1F1YXQgPSByb3REdW1wLncgIT09IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgbHJvdCA9IGlzUXVhdCA/IHJvdER1bXAgOiBQcmVmYWJDcmVhdGlvblNlcnZpY2UuZXVsZXJEZWdyZWVzVG9RdWF0KHJvdER1bXApO1xuICAgICAgICBjb25zdCBldWxlciA9IGlzUXVhdCA/IHsgeDogMCwgeTogMCwgejogMCB9IDogcm90RHVtcDtcbiAgICAgICAgY29uc3QgbHNjYWxlID0gbm9kZURhdGEuc2NhbGU/LnZhbHVlIHx8IG5vZGVEYXRhLmxzY2FsZT8udmFsdWUgfHwgbm9kZURhdGEuX2xzY2FsZSB8fCB7IHg6IDEsIHk6IDEsIHo6IDEgfTtcbiAgICAgICAgY29uc3QgbGF5ZXJEdW1wID0gbm9kZURhdGEubGF5ZXI/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBub2RlRGF0YS5sYXllci52YWx1ZSA6IG5vZGVEYXRhLmxheWVyO1xuICAgICAgICBjb25zdCBsYXllciA9IHR5cGVvZiBsYXllckR1bXAgPT09ICdudW1iZXInID8gbGF5ZXJEdW1wIDogUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkRFRkFVTFRfTEFZRVI7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuTm9kZVwiLCBcIl9uYW1lXCI6IG5hbWUsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwiX3BhcmVudFwiOiBwYXJlbnROb2RlSW5kZXggIT09IG51bGwgPyB7IFwiX19pZF9fXCI6IHBhcmVudE5vZGVJbmRleCB9IDogbnVsbCxcbiAgICAgICAgICAgIFwiX2NoaWxkcmVuXCI6IFtdLCBcIl9hY3RpdmVcIjogbm9kZURhdGEuYWN0aXZlICE9PSBmYWxzZSwgXCJfY29tcG9uZW50c1wiOiBbXSwgXCJfcHJlZmFiXCI6IG51bGwsXG4gICAgICAgICAgICBcIl9scG9zXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGxwb3MueCB8fCAwLCBcInlcIjogbHBvcy55IHx8IDAsIFwielwiOiBscG9zLnogfHwgMCB9LFxuICAgICAgICAgICAgXCJfbHJvdFwiOiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBscm90LnggfHwgMCwgXCJ5XCI6IGxyb3QueSB8fCAwLCBcInpcIjogbHJvdC56IHx8IDAsIFwid1wiOiBscm90LncgIT09IHVuZGVmaW5lZCA/IGxyb3QudyA6IDEgfSxcbiAgICAgICAgICAgIFwiX2xzY2FsZVwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBsc2NhbGUueCAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnggOiAxLCBcInlcIjogbHNjYWxlLnkgIT09IHVuZGVmaW5lZCA/IGxzY2FsZS55IDogMSwgXCJ6XCI6IGxzY2FsZS56ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueiA6IDEgfSxcbiAgICAgICAgICAgIFwiX21vYmlsaXR5XCI6IDAsIFwiX2xheWVyXCI6IGxheWVyLFxuICAgICAgICAgICAgXCJfZXVsZXJcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogZXVsZXIueCB8fCAwLCBcInlcIjogZXVsZXIueSB8fCAwLCBcInpcIjogZXVsZXIueiB8fCAwIH0sIFwiX2lkXCI6IFwiXCJcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXJpYWxpemUgb25lIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIFRoZSBjYXB0dXJlZCBkdW1wIGlzIHRoZSBzb3VyY2Ugb2YgdHJ1dGggZm9yIGV2ZXJ5IGNvbXBvbmVudCB0eXBlLiBUaGUgcGVyLXR5cGVcbiAgICAgKiB0YWJsZXMgYmVsb3cgb25seSBmaWxsIGluIGtleXMgdGhlIGR1bXAgZGlkIG5vdCBjYXJyeSDigJQgdGhleSB1c2VkIHRvIHJ1biAqaW5zdGVhZCpcbiAgICAgKiBvZiB0aGUgZHVtcCwgd2hpY2ggc2lsZW50bHkgd3JvdGUgZW5naW5lIGRlZmF1bHRzIGZvciBgY2MuVUlUcmFuc2Zvcm1gLFxuICAgICAqIGBjYy5TcHJpdGVgLCBgY2MuQnV0dG9uYCBhbmQgYGNjLkxhYmVsYCwgYW5kIHdyb3RlIG5vdGhpbmcgYXQgYWxsIGZvciBldmVyeSBvdGhlclxuICAgICAqIHR5cGUgKCMyOCkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBjcmVhdGVDb21wb25lbnRPYmplY3QoY29tcG9uZW50RGF0YTogYW55LCBub2RlSW5kZXg6IG51bWJlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSBjb21wb25lbnREYXRhLnR5cGUgfHwgY29tcG9uZW50RGF0YS5fX3R5cGVfXyB8fCAnY2MuQ29tcG9uZW50JztcbiAgICAgICAgY29uc3QgZW5hYmxlZCA9IGNvbXBvbmVudERhdGEuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcG9uZW50RGF0YS5lbmFibGVkIDogdHJ1ZTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50OiBhbnkgPSB7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IGNvbXBvbmVudFR5cGUsIFwiX25hbWVcIjogXCJcIiwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJub2RlXCI6IHsgXCJfX2lkX19cIjogbm9kZUluZGV4IH0sIFwiX2VuYWJsZWRcIjogZW5hYmxlZCwgXCJfX3ByZWZhYlwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcHJvcGVydGllcyA9IGNvbXBvbmVudERhdGEucHJvcGVydGllcyB8fCB7fTtcbiAgICAgICAgY29uc3QgcmVuYW1lcyA9IERVTVBfS0VZX1JFTkFNRVNbY29tcG9uZW50VHlwZV0gfHwge307XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocHJvcGVydGllcykpIHtcbiAgICAgICAgICAgIGlmIChEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQuaGFzKGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgcHJvcFZhbHVlID0gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkodmFsdWUsIGNvbnRleHQsIGAke3JlbmFtZXNba2V5XSB8fCBrZXl9YCk7XG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudFtyZW5hbWVzW2tleV0gfHwga2V5XSA9IHByb3BWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgZmFsbGJhY2tdIG9mIE9iamVjdC5lbnRyaWVzKENPTVBPTkVOVF9ERUZBVUxUU1tjb21wb25lbnRUeXBlXSB8fCB7fSkpIHtcbiAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwga2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFtrZXldID0gdHlwZW9mIGZhbGxiYWNrID09PSAnb2JqZWN0JyAmJiBmYWxsYmFjayAhPT0gbnVsbCA/IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZmFsbGJhY2spKSA6IGZhbGxiYWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEEgYnV0dG9uIHdpdGggbm8gY2FwdHVyZWQgdGFyZ2V0IHBvaW50cyBhdCBpdHMgb3duIG5vZGUsIG1hdGNoaW5nIGVkaXRvciBiZWhhdmlvdXIuXG4gICAgICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuQnV0dG9uJyAmJiBjb21wb25lbnQuX3RhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX3RhcmdldCA9IHsgXCJfX2lkX19cIjogbm9kZUluZGV4IH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbnN1cmUgX2lkIGlzIGxhc3QgKG1hdGNoZXMgZW5naW5lIHNlcmlhbGl6YXRpb24gb3JkZXIpXG4gICAgICAgIGNvbnN0IF9pZCA9IGNvbXBvbmVudC5faWQgfHwgXCJcIjtcbiAgICAgICAgZGVsZXRlIGNvbXBvbmVudC5faWQ7XG4gICAgICAgIGNvbXBvbmVudC5faWQgPSBfaWQ7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ291bnQgdGhlIGR1bXAgZW50cmllcyB0aGF0IHdvdWxkIGFjdHVhbGx5IGJlIHNlcmlhbGl6ZWQsIHNvIHRoZSBwb3N0LXdyaXRlIGNoZWNrXG4gICAgICogb25seSBkZW1hbmRzIHByb3BlcnRpZXMgZm9yIGNvbXBvbmVudHMgdGhhdCBoYWQgc29tZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNvdW50U2VyaWFsaXphYmxlUHJvcHMocHJvcGVydGllczogYW55KTogbnVtYmVyIHtcbiAgICAgICAgaWYgKCFwcm9wZXJ0aWVzIHx8IHR5cGVvZiBwcm9wZXJ0aWVzICE9PSAnb2JqZWN0JykgcmV0dXJuIDA7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5maWx0ZXIoayA9PiAhRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrKSkubGVuZ3RoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydCBjb21wb25lbnQgdHlwZXMgdGhhdCBjYXJyaWVkIGxpdmUgcHJvcGVydGllcyBpbiB0aGUgc2NlbmUgYnV0IHNlcmlhbGl6ZWQgdG9cbiAgICAgKiBub3RoaW5nIGJ1dCB0aGUgYmFzZSBlbnZlbG9wZS4gYGFjdGlvbj1jcmVhdGVgIHByZXZpb3VzbHkgcmVwb3J0ZWQgc3VjY2VzcyBpblxuICAgICAqIGV4YWN0bHkgdGhhdCBzdGF0ZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHByZWZhYkRhdGE6IGFueVtdLCBub2RlRGF0YTogYW55KTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXAgb2YgKG5vZGUuY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb3VudFNlcmlhbGl6YWJsZVByb3BzKGNvbXA/LnByb3BlcnRpZXMpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5hZGQoY29tcC50eXBlIHx8IGNvbXAuX190eXBlX18gfHwgJ1Vua25vd24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHdhbGsobm9kZURhdGEpO1xuICAgICAgICBpZiAoZXhwZWN0ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gICAgICAgIGNvbnN0IHBvcHVsYXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHByZWZhYkRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCAhZXhwZWN0ZWQuaGFzKGVudHJ5Ll9fdHlwZV9fKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZW50cnkpLnNvbWUoa2V5ID0+ICFCQVNFX0NPTVBPTkVOVF9LRVlTLmhhcyhrZXkpKSkgcG9wdWxhdGVkLmFkZChlbnRyeS5fX3R5cGVfXyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5leHBlY3RlZF0uZmlsdGVyKHR5cGUgPT4gIXBvcHVsYXRlZC5oYXModHlwZSkpO1xuICAgIH1cblxuICAgIC8qKiBSZS1yZWFkIHRoZSB3cml0dGVuIHByZWZhYjsgZmFsbHMgYmFjayB0byB0aGUgaW4tbWVtb3J5IGNvbnRlbnQgd2hlbiB0aGUgcGF0aCBpcyB1bnJlc29sdmFibGUuICovXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkQmFja1ByZWZhYihzYXZlUGF0aDogc3RyaW5nLCBmYWxsYmFjazogYW55W10pOiBQcm9taXNlPHsgZGF0YTogYW55W107IHNvdXJjZTogJ2Rpc2snIHwgJ2luLW1lbW9yeScgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlQXNzZXQoc2F2ZVBhdGgpO1xuICAgICAgICAgICAgaWYgKHJlc29sdmVkLmZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQuZmlsZVBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4geyBkYXRhOiBwYXJzZWQsIHNvdXJjZTogJ2Rpc2snIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHRoZSBpbi1tZW1vcnkgY29udGVudFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGRhdGE6IGZhbGxiYWNrLCBzb3VyY2U6ICdpbi1tZW1vcnknIH07XG4gICAgfVxuXG4gICAgLyoqIFR5cGUgbmFtZXMgd2hvc2UgZHVtcCB2YWx1ZSBpcyBhbiBBU1NFVCByZWZlcmVuY2UgcmF0aGVyIHRoYW4gYSBjb21wb25lbnQgcmVmZXJlbmNlLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEFTU0VUX1RZUEVTID0gbmV3IFNldChbXG4gICAgICAgICdjYy5QcmVmYWInLCAnY2MuVGV4dHVyZTJEJywgJ2NjLlNwcml0ZUZyYW1lJywgJ2NjLk1hdGVyaWFsJywgJ2NjLkFuaW1hdGlvbkNsaXAnLFxuICAgICAgICAnY2MuQXVkaW9DbGlwJywgJ2NjLkZvbnQnLCAnY2MuQXNzZXQnLCAnY2MuVFRGRm9udCcsICdjYy5CaXRtYXBGb250JywgJ2NjLkxhYmVsQXRsYXMnLFxuICAgICAgICAnY2MuU3ByaXRlQXRsYXMnLCAnY2MuSnNvbkFzc2V0JywgJ2NjLlRleHRBc3NldCcsICdjYy5QYXJ0aWNsZUFzc2V0JywgJ2NjLk1lc2gnLFxuICAgICAgICAnY2MuU2tlbGV0b24nLCAnY2MuUmVuZGVyVGV4dHVyZScsICdjYy5QaHlzaWNzTWF0ZXJpYWwnLCAnY2MuU2NlbmVBc3NldCcsICdjYy5FZmZlY3RBc3NldCcsXG4gICAgXSk7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhc3NldCBpcyBlaXRoZXIgZXhwbGljaXRseSBsaXN0ZWQgb3IgbmFtZWQgYnkgYSBzdWZmaXggbm8gY29tcG9uZW50IHR5cGUgdXNlcy5cbiAgICAgKiBUaGUgc3VmZml4IGFybSBpcyB3aGF0IGtlZXBzIGEgZnV0dXJlIGNvbmNyZXRlIGFzc2V0IHN1YmNsYXNzIGZyb20gc2lsZW50bHkgcmVncmVzc2luZ1xuICAgICAqIGludG8gdGhlIGNvbXBvbmVudC1yZWZlcmVuY2UgYnJhbmNoIHRoZSB3YXkgY2MuVFRGRm9udCBkaWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgaXNBc3NldFR5cGUodHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkFTU0VUX1RZUEVTLmhhcyh0eXBlKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiAvKD86Rm9udHxBc3NldHxBdGxhc3xDbGlwKSQvLnRlc3QodHlwZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyBjb21wb25lbnQgcHJvcGVydHkgdmFsdWVzLCBlbnN1cmluZyBmb3JtYXQgbWF0Y2hlcyBtYW51YWxseS1jcmVhdGVkIHByZWZhYnMuXG4gICAgICogSGFuZGxlcyBub2RlIHJlZnMsIGFzc2V0IHJlZnMsIGNvbXBvbmVudCByZWZzLCB0eXBlZCBtYXRoL2NvbG9yIG9iamVjdHMsIGFuZCBhcnJheXMuXG4gICAgICpcbiAgICAgKiBUaHJvd3Mgb24gYSByZWZlcmVuY2UgaXQgY2Fubm90IHNlcmlhbGl6ZSBmYWl0aGZ1bGx5LiBFdmVyeSBicmFuY2ggYmVsb3cgdXNlZCB0b1xuICAgICAqIGFuc3dlciBhbiB1bnJlc29sdmFibGUgcmVmZXJlbmNlIHdpdGggYG51bGxgIChvciBkcm9wIGl0IGZyb20gYW4gYXJyYXkpLCB3aGljaCBpcyBob3dcbiAgICAgKiBhIGNyZWF0ZWQgcHJlZmFiIGNhbWUgb3V0IGhvbGxvdyB3aGlsZSBgYWN0aW9uPWNyZWF0ZWAgcmVwb3J0ZWQgc3VjY2VzcyDigJQgaXNzdWUgIzczJ3NcbiAgICAgKiBgX21lc2g6IG51bGxgLCBgX21hdGVyaWFsczogW11gIGFuZCBgbGFiZWxQZXJjZW50OiBudWxsYCwgZWFjaCBvZiB3aGljaCBoYWQgYmVlblxuICAgICAqIHdyaXR0ZW4gdG8gdGhlIGxpdmUgc2NlbmUgbW9tZW50cyBlYXJsaWVyLiBBIHJlZmVyZW5jZSB0aGF0IGNhbm5vdCBiZSBzZXJpYWxpemVkIGlzIGFcbiAgICAgKiBmYWlsdXJlIG9mIHRoaXMgY2FsbCwgbm90IGEgdmFsdWUgb2YgYG51bGxgOiBzZWVcbiAgICAgKiBgfi8uY2xhdWRlL3J1bGVzL2RldmVsb3BtZW50LXByaW5jaXBsZXMubWRgIMKnIFwiRXJyb3JzIE92ZXIgU2lsZW50IEZhbGxiYWNrc1wiLlxuICAgICAqL1xuICAgIHByaXZhdGUgcHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KHByb3BEYXRhOiBhbnksIGNvbnRleHQ/OiB7XG4gICAgICAgIG5vZGVVdWlkVG9JbmRleD86IE1hcDxzdHJpbmcsIG51bWJlcj47XG4gICAgICAgIGNvbXBvbmVudFV1aWRUb0luZGV4PzogTWFwPHN0cmluZywgbnVtYmVyPjtcbiAgICAgICAgbG9zc2VzPzogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+O1xuICAgIH0sIHByb3BlcnR5UGF0aCA9ICcnKTogYW55IHtcbiAgICAgICAgaWYgKCFwcm9wRGF0YSB8fCB0eXBlb2YgcHJvcERhdGEgIT09ICdvYmplY3QnKSByZXR1cm4gcHJvcERhdGE7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcERhdGEudmFsdWU7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBwcm9wRGF0YS50eXBlO1xuICAgICAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIC8vIEFuIGV4cGxpY2l0IGVtcHR5LXV1aWQgcmVmZXJlbmNlIGlzIGEgZ2VudWluZSBDTEVBUiAoaXNzdWUgIzc1KSwgbm90IGEgbG9zcy5cbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUudXVpZCA9PT0gJycpIHJldHVybiBudWxsO1xuXG4gICAgICAgIC8vIE5vZGUgcmVmZXJlbmNlc1xuICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLk5vZGUnICYmIHZhbHVlPy51dWlkKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dD8ubm9kZVV1aWRUb0luZGV4Py5oYXModmFsdWUudXVpZCkpIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQubm9kZVV1aWRUb0luZGV4LmdldCh2YWx1ZS51dWlkKSB9O1xuICAgICAgICAgICAgLy8gQSBub2RlIG91dHNpZGUgdGhlIHN1YnRyZWUgYmVpbmcgc2VyaWFsaXplZCBjYW5ub3QgYmUgZW5jb2RlZCBpbiBhIHByZWZhYiDigJRcbiAgICAgICAgICAgIC8vIHRoZSBmb3JtYXQgaGFzIG5vIGNyb3NzLWZpbGUgbm9kZSByZWZlcmVuY2UuIFRoaXMgb25lIGdlbnVpbmVseSBtdXN0IGJlXG4gICAgICAgICAgICAvLyBkcm9wcGVkLCBidXQgaXQgaXMgc3RpbGwgYSBkYXRhIGxvc3MgYW5kIGlzIHJlY29yZGVkIGFzIHN1Y2guXG4gICAgICAgICAgICB0aGlzLnJlY29yZExvc3MoY29udGV4dCwgcHJvcGVydHlQYXRoLCB2YWx1ZS51dWlkLCAnbm9kZSBpcyBvdXRzaWRlIHRoZSBwcmVmYWIgc3VidHJlZSBiZWluZyBzZXJpYWxpemVkJyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzc2V0IHJlZmVyZW5jZXMuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoaXMgYnJhbmNoIGlzIHRoZSBERUZBVUxUIGZvciBhbnkgcmVmZXJlbmNlIGNhcnJ5aW5nIGEgdXVpZCwgYmVjYXVzZSB0aGUgdGVzdHNcbiAgICAgICAgLy8gYmVsb3cgY2Fubm90IGJvdGggYmUgc2F0aXNmaWVkOiBgY2MuTGFiZWxgJ3MgYGZvbnRgIGlzIGEgYGNjLlRURkZvbnRgIEFTU0VUXG4gICAgICAgIC8vICh0aGlzIHRlc3QgZmlsZSdzIG93biBmb250IHJlZ3Jlc3Npb24pLCB3aGlsZSBgY2MuTGFiZWxgIGlzIGFsc28gYSBsZWdpdGltYXRlXG4gICAgICAgIC8vIEBwcm9wZXJ0eSBDT01QT05FTlQgdHlwZS4gUmVhZGluZyB0aGUgdmFsdWUncyB1dWlkIGFzIGFuIGFzc2V0IGlzIHdoYXQgbWFrZXMgdGhlXG4gICAgICAgIC8vIGZvbnQgY2FzZSBjb3JyZWN0OyBldmVyeSBjb25jcmV0ZSBhc3NldCBjbGFzcyBpcyBjYXVnaHQgYmVsb3cgYnkgbmFtZSBvciBzdWZmaXguXG4gICAgICAgIC8vXG4gICAgICAgIC8vIEFzc2V0LWZpcnN0IHdhcyBwcmV2aW91c2x5IGJ5cGFzc2VkIGJ5IGRpc3BhdGNoaW5nIG9uIGBpc0Fzc2V0VHlwZSh0eXBlKWAgRklSU1QsXG4gICAgICAgIC8vIGxldHRpbmcgdGhlIGNvbXBvbmVudCBicmFuY2gncyBgdHlwZS5zdGFydHNXaXRoKCdjYy4nKWAgY2F0Y2gtYWxsIGNsYWltIGFueSB0eXBlXG4gICAgICAgIC8vIHRoZSBhbGxvd2xpc3QgaGFkIG5vdCBiZWVuIHRhdWdodCDigJQgdGhlIGV4YWN0IG1lY2hhbmlzbSBieSB3aGljaCBgY2MuTWVzaGAgYW5kXG4gICAgICAgIC8vIGBjYy5Ta2VsZXRvbmAgYmVjYW1lIG51bGwgZW50cmllcyBpbiBhIGNyZWF0ZWQgcHJlZmFiIChpc3N1ZXMgIzY0LCAjNzAsICM3MykuXG4gICAgICAgIGlmICh2YWx1ZT8udXVpZCkge1xuICAgICAgICAgICAgaWYgKFByZWZhYkNyZWF0aW9uU2VydmljZS5pc0Fzc2V0VHlwZSh0eXBlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IFwiX191dWlkX19cIjogdmFsdWUudXVpZCwgXCJfX2V4cGVjdGVkVHlwZV9fXCI6IHR5cGUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEluLXRyZWUgY29tcG9uZW50IHJlZmVyZW5jZTogdGhlIHV1aWQgbmFtZXMgYSBjb21wb25lbnQgaW4gdGhlIHN1YnRyZWUgYmVpbmdcbiAgICAgICAgICAgIC8vIHNlcmlhbGl6ZWQsIHNvIGl0IGVuY29kZXMgYXMgYW4gb2JqZWN0IGluZGV4LlxuICAgICAgICAgICAgaWYgKGNvbnRleHQ/LmNvbXBvbmVudFV1aWRUb0luZGV4Py5oYXModmFsdWUudXVpZCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBcIl9faWRfX1wiOiBjb250ZXh0LmNvbXBvbmVudFV1aWRUb0luZGV4LmdldCh2YWx1ZS51dWlkKSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVW5yZXNvbHZlZC4gQSBwcmVmYWIgYXNzZXQgaGFzIG5vIHdheSB0byBleHByZXNzIGEgcmVmZXJlbmNlIHRvIHNvbWV0aGluZ1xuICAgICAgICAgICAgLy8gb3V0c2lkZSB0aGUgc3VidHJlZSwgc28gbnVsbCBpcyB0aGUgb25seSBlbmNvZGFibGUgYW5zd2VyIOKAlCBidXQgdGhlIG51bGwgaXNcbiAgICAgICAgICAgIC8vIG5vdyBSRUNPUkRFRCwgYW5kIHRoZSBjcmVhdGUgcGF0aHMgcmVmdXNlIHRvIHdyaXRlIHdoZW4gYW55dGhpbmcgd2FzIHJlY29yZGVkLlxuICAgICAgICAgICAgLy8gYG51bGxgIGluIHNpbGVuY2UgaXMgaXNzdWUgIzczJ3MgcHJpbWFyeSBzeW1wdG9tIChgX21lc2g6IG51bGxgLFxuICAgICAgICAgICAgLy8gYF9tYXRlcmlhbHM6IFtdYCwgYGxhYmVsUGVyY2VudDogbnVsbGAgb24gYSBjcmVhdGVkIHByZWZhYiwgd2l0aFxuICAgICAgICAgICAgLy8gYHN1Y2Nlc3M6IHRydWVgIGFuZCBgdmFsaWRhdGVgIGdyZWVuKTsgYSByZXBvcnRlZCBsb3NzIHRoYXQgZmFpbHMgdGhlIGNhbGwgaXNcbiAgICAgICAgICAgIC8vIG5vdC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBUd28gY2F1c2VzIHJlYWNoIGhlcmUsIGFuZCB0aGUgbWVzc2FnZSBuYW1lcyBib3RoIGJlY2F1c2UgdGhlIHJlbWVkaWVzIGRpZmZlcjpcbiAgICAgICAgICAgIC8vIGEgcmVmZXJlbmNlIGdlbnVpbmVseSBvdXRzaWRlIHRoZSBzdWJ0cmVlIChsZWdpdGltYXRlIOKAlCBhIGJ1dHRvbiBwb2ludGluZyBhdFxuICAgICAgICAgICAgLy8gYW5vdGhlciBwcmVmYWIpLCBhbmQgYW4gQVNTRVQgY2xhc3MgbWlzc2luZyBmcm9tIEFTU0VUX1RZUEVTLCB3aGljaCBpcyB0aGVcbiAgICAgICAgICAgIC8vIG1lY2hhbmlzbSBiZWhpbmQgaXNzdWVzICM2NC8jNzAvIzczIGFuZCB3YW50cyB0aGUgYWxsb3dsaXN0IGV4dGVuZGVkLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIERlbGliZXJhdGVseSBOT1QgYSB0aHJvdzogYHByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eWAgcnVucyBpbnNpZGVcbiAgICAgICAgICAgIC8vIGBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnRgLCB3aG9zZSBjb250cmFjdCBpcyB0byBSRVRVUk4gdGhlIHByZWZhYiBKU09OLCBhbmRcbiAgICAgICAgICAgIC8vIHRocm93aW5nIGhlcmUgd291bGQgYWxzbyBjYXRjaCBzY3JpcHQgY29tcG9uZW50IHJlZmVyZW5jZXMgKGBCdWNrZXRTY3JpcHRgIGlzXG4gICAgICAgICAgICAvLyBub3QgYSBgY2MuYCBjbGFzcyksIHdoaWNoIGFyZSBhIGxlZ2l0aW1hdGUgZXh0ZXJuYWwgcmVmZXJlbmNlIOKAlCB0dXJuaW5nIGFcbiAgICAgICAgICAgIC8vIHN1cHBvcnRlZCBudWxsIGludG8gYSBmYWlsdXJlLiBUaGUgbG9zcyBsaXN0IGlzIHRoZSBjaGFubmVsIHRoYXQgZGlzdGluZ3Vpc2hlc1xuICAgICAgICAgICAgLy8gdGhlbSBieSBjYWxsIHNpdGUgcmF0aGVyIHRoYW4gYnkgZ3Vlc3NpbmcgZnJvbSB0aGUgdHlwZSBuYW1lLlxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBSZWZlcmVuY2UgJHt0eXBlfSBVVUlEICR7dmFsdWUudXVpZH0gaGFzIG5vIGVuY29kYWJsZSBmb3JtIGluIGEgcHJlZmFiIChwcm9wZXJ0eSAnJHtwcm9wZXJ0eVBhdGggfHwgJyh1bmtub3duKSd9JylgKTtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkTG9zcyhcbiAgICAgICAgICAgICAgICBjb250ZXh0LCBwcm9wZXJ0eVBhdGgsIHZhbHVlLnV1aWQsXG4gICAgICAgICAgICAgICAgYHR5cGUgJyR7dHlwZX0nIGhhcyBubyBlbmNvZGFibGUgZm9ybSDigJQgZWl0aGVyIGl0IGlzIG91dHNpZGUgdGhlIHByZWZhYiBzdWJ0cmVlIChsZWdpdGltYXRlIGZvciBhIGNvbXBvbmVudCByZWZlcmVuY2UpIGAgK1xuICAgICAgICAgICAgICAgIGBvciBpdCBpcyBhbiBhc3NldCBjbGFzcyBtaXNzaW5nIGZyb20gUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkFTU0VUX1RZUEVTIChpc3N1ZXMgIzY0LyM3MC8jNzMpYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHlwZWQgbWF0aC9jb2xvciBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLkNvbG9yJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5yKSB8fCAwKSksIFwiZ1wiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5nKSB8fCAwKSksIFwiYlwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5iKSB8fCAwKSksIFwiYVwiOiB2YWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5hKSkpIDogMjU1IH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzMnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCwgXCJ6XCI6IE51bWJlcih2YWx1ZS56KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzInKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5TaXplJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlNpemVcIiwgXCJ3aWR0aFwiOiBOdW1iZXIodmFsdWUud2lkdGgpIHx8IDAsIFwiaGVpZ2h0XCI6IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuUXVhdCcpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwLCBcInpcIjogTnVtYmVyKHZhbHVlLnopIHx8IDAsIFwid1wiOiB2YWx1ZS53ICE9PSB1bmRlZmluZWQgPyBOdW1iZXIodmFsdWUudykgOiAxIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheSBwcm9wZXJ0aWVzLlxuICAgICAgICAvLyBFYWNoIGVsZW1lbnQgb2YgYW4gYXJyYXktdHlwZWQgZHVtcCAoZS5nLiBjYy5NZXNoUmVuZGVyZXIncyBzaGFyZWRNYXRlcmlhbHMvXG4gICAgICAgIC8vIF9tYXRlcmlhbHMpIGlzIGl0c2VsZiBhIG5lc3RlZCBwcm9wZXJ0eSBkZXNjcmlwdG9yIOKAlCB7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSwgLi4uIH1cbiAgICAgICAgLy8g4oCUIG5vdCBhIGZsYXQgeyB1dWlkIH0uIFJlYWRpbmcgaXRlbS51dWlkIGRpcmVjdGx5IG1hdGNoZWQgbm90aGluZyBmb3IgZXZlcnkgZWxlbWVudCxcbiAgICAgICAgLy8gc28gYSBNZXNoUmVuZGVyZXIncyBhc3NpZ25lZCBtYXRlcmlhbCBzaWxlbnRseSBzZXJpYWxpemVkIGFzIGFuIGVtcHR5IGFycmF5IHdoaWxlXG4gICAgICAgIC8vIHJlcG9ydGluZyBzdWNjZXNzICh2ZXJpZmllZCBsaXZlIGFnYWluc3QgYSBzbWFydC1pbXBvcnRlZCBGQlggbWF0ZXJpYWwpLlxuICAgICAgICAvL1xuICAgICAgICAvLyBFbGVtZW50cyBhcmUgc2VyaWFsaXplZCB0aHJvdWdoIHRoaXMgc2FtZSBmdW5jdGlvbiByYXRoZXIgdGhhbiBhIGxvY2FsXG4gICAgICAgIC8vIGB7IF9fdXVpZF9fIH1gIHNoYXBlLCBzbyBhIGNvbmNyZXRlLWNsYXNzIGFzc2V0IHR5cGUgcmVhY2hlcyB0aGUgYXNzZXQgYnJhbmNoXG4gICAgICAgIC8vIGluc3RlYWQgb2YgYSBoYXJkY29kZWQgY29uc2VxdWVuY2Ugb2YgYGVsZW1lbnRUeXBlRGF0YWAuIFRoZSBvbGQgc2hhcGUgZGVjbGFyZWRcbiAgICAgICAgLy8gYGVsZW1lbnRUeXBlRGF0YS50eXBlYCBmb3IgZXZlcnkgZWxlbWVudCByZWdhcmRsZXNzIG9mIHdoYXQgdGhlIGVsZW1lbnQgYWN0dWFsbHlcbiAgICAgICAgLy8gcmVmZXJlbmNlZCDigJQgYW5kIGAuZmlsdGVyKEJvb2xlYW4pYCB0dXJuZWQgZWFjaCB1bnJlc29sdmVkIGVsZW1lbnQgaW50byBhIHNpbGVudGx5XG4gICAgICAgIC8vIHNob3J0ZXIgYXJyYXksIHdoaWNoIGlzIGlzc3VlICM3MydzIGBfbWF0ZXJpYWxzOiBbXWAgZXhhY3RseTogYW4gYXJyYXkgcHJvcGVydHlcbiAgICAgICAgLy8gdGhhdCBoYWQgY29udGVudHMgb24gdGhlIGxpdmUgbm9kZSBhbmQgY2FtZSBvdXQgb2YgdGhlIGNyZWF0ZWQgcHJlZmFiIGVtcHR5LCB3aXRoXG4gICAgICAgIC8vIGBzdWNjZXNzOiB0cnVlYCBhbmQgYHZhbGlkYXRlYCByZXBvcnRpbmcgYGlzVmFsaWQ6IHRydWVgIG92ZXIgdGhlIHJlc3VsdC5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50VHlwZSA9IHByb3BEYXRhLmVsZW1lbnRUeXBlRGF0YT8udHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZWQgPSB2YWx1ZS5tYXAoKGl0ZW06IGFueSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1VdWlkID0gaXRlbT8udXVpZCB8fCBpdGVtPy52YWx1ZT8udXVpZDtcbiAgICAgICAgICAgICAgICBpZiAoIWl0ZW1VdWlkICYmIGVsZW1lbnRUeXBlICYmICFlbGVtZW50VHlwZS5zdGFydHNXaXRoKCdjYy4nKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBOb3QgYSByZWZlcmVuY2UgYXJyYXkgYXQgYWxsIOKAlCBhbiBhcnJheSBvZiBwbGFpbiB2YWx1ZXMuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtPy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gaXRlbS52YWx1ZSA6IGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFuIGVsZW1lbnQncyBvd24gYHR5cGVgIGlzIGF1dGhvcml0YXRpdmU7IGBlbGVtZW50VHlwZURhdGFgIGlzIG9ubHkgdGhlXG4gICAgICAgICAgICAgICAgLy8gZGVjbGFyZWQgYXJyYXkgZWxlbWVudCBjbGFzcywgYW5kIGZvciBhIHN1YmNsYXNzIGVsZW1lbnQgKGBjYy5UVEZGb250YFxuICAgICAgICAgICAgICAgIC8vIHVuZGVyIGEgYGNjLkZvbnRbXWAsIGEgbmVzdGVkLWRlc2NyaXB0b3IgbWF0ZXJpYWwpIHRoZSBkZWNsYXJlZCBjbGFzcyBpc1xuICAgICAgICAgICAgICAgIC8vIHRoZSB3cm9uZyB0aGluZyB0byB3cml0ZS5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgIHsgdmFsdWU6IGl0ZW0/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBpdGVtLnZhbHVlIDogaXRlbSwgdHlwZTogaXRlbT8udHlwZSB8fCBlbGVtZW50VHlwZSB9LFxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICBgJHtwcm9wZXJ0eVBhdGh9WyR7aW5kZXh9XWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBBIGRyb3BwZWQgZWxlbWVudCBpcyBhIGxvc3MsIG5vdCBhIHNob3J0ZXIgYXJyYXkuIGBtYXBgIG5ldmVyIHByb2R1Y2VzXG4gICAgICAgICAgICAvLyB1bmRlZmluZWQgaGVyZSwgc28gdGhpcyBvbmx5IGZpcmVzIGlmIGEgZnV0dXJlIGJyYW5jaCBzdGFydHMgcmV0dXJuaW5nIGl0LlxuICAgICAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZWQuZmlsdGVyKChlbnRyeTogYW55KSA9PiBlbnRyeSAhPT0gdW5kZWZpbmVkICYmIGVudHJ5ICE9PSBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5lc3RlZCBDQ0NsYXNzIGdyb3VwOiB0aGUgZHVtcCBuZXN0cyBhbm90aGVyIGRlc2NyaXB0b3IgbWFwIHVuZGVyIGB2YWx1ZWAuXG4gICAgICAgIC8vIFNlcmlhbGl6aW5nIGl0IHZlcmJhdGltIHdvdWxkIHdyaXRlIGVkaXRvciBkZXNjcmlwdG9ycyAoe25hbWUsIHZhbHVlLCB0eXBlfSlcbiAgICAgICAgLy8gaW50byB0aGUgYXNzZXQgaW5zdGVhZCBvZiB0aGUgdmFsdWVzIHRoZW1zZWx2ZXMuXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB0aGlzLmlzTmVzdGVkUHJvcGVydHlNYXAodmFsdWUpKSB7XG4gICAgICAgICAgICBjb25zdCBuZXN0ZWQ6IGFueSA9IHR5cGUgPyB7IFwiX190eXBlX19cIjogdHlwZSB9IDoge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrZXkpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXN0ZWRWYWx1ZSA9IHRoaXMucHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICBlbnRyeSwgY29udGV4dCwgcHJvcGVydHlQYXRoID8gYCR7cHJvcGVydHlQYXRofS4ke2tleX1gIDoga2V5XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAobmVzdGVkVmFsdWUgIT09IHVuZGVmaW5lZCkgbmVzdGVkW2tleV0gPSBuZXN0ZWRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXN0ZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPdGhlciBjb21wbGV4IHR5cGVkIG9iamVjdHNcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdHlwZT8uc3RhcnRzV2l0aCgnY2MuJykpIHJldHVybiB7IFwiX190eXBlX19cIjogdHlwZSwgLi4udmFsdWUgfTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY29yZCBhIHJlZmVyZW5jZSB0aGF0IGNvdWxkIG5vdCBiZSBzZXJpYWxpemVkIGZhaXRoZnVsbHkuXG4gICAgICpcbiAgICAgKiBLZXB0IGFzIGEgbGlzdCByYXRoZXIgdGhhbiBhIHRocm93IGZvciB0aGUgdHdvIGNhc2VzIHdoZXJlIHRoZSBwcmVmYWIgZm9ybWF0IGl0c2VsZlxuICAgICAqIGNhbm5vdCBleHByZXNzIHRoZSB2YWx1ZSAoYSBub2RlL2NvbXBvbmVudCBvdXRzaWRlIHRoZSBzdWJ0cmVlKS4gVGhlIGNyZWF0ZSBwYXRocyB0dXJuXG4gICAgICogYSBub24tZW1wdHkgbGlzdCBpbnRvIGEgYGZhdGFsYCBmYWlsdXJlLCBzbyB0aGUgbG9zcyBpcyBuZXZlciBtZXJlbHkgYSB3YXJuaW5nIGluIGFcbiAgICAgKiBsb2cgbm9ib2R5IHJlYWRzIOKAlCB3aGljaCBpcyBob3cgIzczJ3MgZHJvcHBlZCByZWZlcmVuY2VzIHdlbnQgdW5ub3RpY2VkIHRocm91Z2hcbiAgICAgKiBgY3JlYXRlYCBBTkQgYHZhbGlkYXRlYC5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlY29yZExvc3MoXG4gICAgICAgIGNvbnRleHQ6IHsgbG9zc2VzPzogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+IH0gfCB1bmRlZmluZWQsXG4gICAgICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgICAgIHV1aWQ6IHN0cmluZyxcbiAgICAgICAgcmVhc29uOiBzdHJpbmdcbiAgICApOiB2b2lkIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Py5sb3NzZXMpIHJldHVybjtcbiAgICAgICAgY29udGV4dC5sb3NzZXMucHVzaCh7IHByb3BlcnR5OiBwcm9wZXJ0eSB8fCAnKHVua25vd24pJywgdXVpZCwgcmVhc29uIH0pO1xuICAgIH1cblxuICAgIC8qKiBSZW5kZXIgcmVjb3JkZWQgbG9zc2VzIGFzIHRoZSBmYXRhbCBmYWlsdXJlIG1lc3NhZ2UsIG9yIG51bGwgd2hlbiB0aGVyZSBhcmUgbm9uZS4gKi9cbiAgICBwcml2YXRlIGRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKGxvc3NlczogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmIChsb3NzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgbmFtZWQgPSBsb3NzZXMubWFwKGwgPT4gYCcke2wucHJvcGVydHl9JyAtPiAke2wudXVpZH0gKCR7bC5yZWFzb259KWApO1xuICAgICAgICByZXR1cm4gYCR7bG9zc2VzLmxlbmd0aH0gcmVmZXJlbmNlKHMpIGNvdWxkIG5vdCBiZSBzZXJpYWxpemVkOiAke25hbWVkLmpvaW4oJzsgJyl9LmA7XG4gICAgfVxuXG4gICAgLyoqIFRydWUgd2hlbiBldmVyeSBlbnRyeSBpcyBhbiBvYmplY3QgYW5kIGF0IGxlYXN0IG9uZSBpcyBhIENvY29zIHByb3BlcnR5IGRlc2NyaXB0b3IuICovXG4gICAgcHJpdmF0ZSBpc05lc3RlZFByb3BlcnR5TWFwKHZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyh2YWx1ZSk7XG4gICAgICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gZW50cmllcy5ldmVyeSgoWywgZW50cnldKSA9PiBlbnRyeSAhPT0gbnVsbCAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKVxuICAgICAgICAgICAgJiYgZW50cmllcy5zb21lKChbLCBlbnRyeV0pID0+IGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5KSk7XG4gICAgfVxuXG4gICAgLy8gPT09PT0gQXNzZXQgREIgb3BlcmF0aW9ucyA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQ6IHN0cmluZywgcHJlZmFiUmVmOiBzdHJpbmcsIHByZWZhYlV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IG1ldGhvZHMgPSBbXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjb25uZWN0LXByZWZhYi1pbnN0YW5jZScsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiUmVmIH0pLFxuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByZWZhYi1jb25uZWN0aW9uJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdhcHBseS1wcmVmYWItbGluaycsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiUmVmIH0pXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgbWV0aG9kIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIHRyeSB7IGF3YWl0IG1ldGhvZCgpOyByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07IH0gY2F0Y2ggeyAvKiB0cnkgbmV4dCAqLyB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQWxsIHByZWZhYiBjb25uZWN0aW9uIG1ldGhvZHMgZmFpbGVkJyB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZVByZWZhYldpdGhNZXRhKHByZWZhYlBhdGg6IHN0cmluZywgcHJlZmFiRGF0YTogYW55W10sIG1ldGFEYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlQXNzZXRGaWxlKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHByZWZhYkRhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZUFzc2V0RmlsZShgJHtwcmVmYWJQYXRofS5tZXRhYCwgSlNPTi5zdHJpbmdpZnkobWV0YURhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gc2F2ZSBwcmVmYWIgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZUFzc2V0RmlsZShmaWxlUGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBmaWxlUGF0aCwgY29udGVudCksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICd3cml0ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KVxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiBtZXRob2RzKSB7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCBtZXRob2QoKTsgcmV0dXJuOyB9IGNhdGNoIHsgLyogdHJ5IG5leHQgKi8gfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWxsIHNhdmUgbWV0aG9kcyBmYWlsZWQnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFzc2V0UGF0aCwgY29udGVudCwgeyBvdmVyd3JpdGU6IHRydWUsIHJlbmFtZTogZmFsc2UgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBhc3NldEluZm8gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gY3JlYXRlIGFzc2V0IGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZU1ldGFXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgbWV0YUNvbnRlbnQ6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIGFzc2V0UGF0aCwgSlNPTi5zdHJpbmdpZnkobWV0YUNvbnRlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGFzc2V0SW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgbWV0YSBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWltcG9ydEFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0UGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gcmVpbXBvcnQgYXNzZXQnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZUFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBhc3NldFBhdGgsIGNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcmVzdWx0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIHVwZGF0ZSBhc3NldCBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gRm9ybWF0IHZhbGlkYXRpb24gPT09PT1cblxuICAgIC8qKlxuICAgICAqIFN0cnVjdHVyYWwgdmFsaWRhdGlvbiBvZiBhIHNlcmlhbGl6ZWQgcHJlZmFiLlxuICAgICAqXG4gICAgICogU3RydWN0dXJhbCBhbG9uZSBpcyBub3QgXCJ2YWxpZFwiOiBhIHByZWZhYiB3aG9zZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgdG8gdGhlaXIgYmFyZVxuICAgICAqIGVudmVsb3BlIHBhc3NlcyBldmVyeSBjaGVjayBoZXJlIHdoaWxlIGNhcnJ5aW5nIG5vbmUgb2YgdGhlIHNjZW5lIHZhbHVlcywgd2hpY2ggaXMgd2h5XG4gICAgICogYG1hbmFnZV9wcmVmYWIgYWN0aW9uPXZhbGlkYXRlYCByZXR1cm5lZCBgaXNWYWxpZDogdHJ1ZWAgb3ZlciB0aGUgaG9sbG93IG91dHB1dCBvZlxuICAgICAqIGlzc3VlICM3MydzIG93biByZXByby4gYGhvbGxvd0NvbXBvbmVudHNgIHJlcG9ydHMgdGhlIGNvbXBvbmVudHMgdGhhdCBob2xkIG5vdGhpbmdcbiAgICAgKiBiZXlvbmQgYEJBU0VfQ09NUE9ORU5UX0tFWVNgLCBzbyBcInZhbGlkXCIgYW5kIFwiZW1wdHlcIiBhcmUgZGlzdGluZ3Vpc2hhYmxlLlxuICAgICAqL1xuICAgIHZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkRhdGE6IGFueSk6IHsgaXNWYWxpZDogYm9vbGVhbjsgaXNzdWVzOiBzdHJpbmdbXTsgbm9kZUNvdW50OiBudW1iZXI7IGNvbXBvbmVudENvdW50OiBudW1iZXI7IGhvbGxvd0NvbXBvbmVudHM6IHN0cmluZ1tdIH0ge1xuICAgICAgICBjb25zdCBpc3N1ZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IGhvbGxvd0NvbXBvbmVudHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGxldCBub2RlQ291bnQgPSAwO1xuICAgICAgICBsZXQgY29tcG9uZW50Q291bnQgPSAwO1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJlZmFiRGF0YSkpIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdQcmVmYWIgZGF0YSBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBmYWxzZSwgaXNzdWVzLCBub2RlQ291bnQsIGNvbXBvbmVudENvdW50LCBob2xsb3dDb21wb25lbnRzIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByZWZhYkRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgaXMgZW1wdHknKTtcbiAgICAgICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGZhbHNlLCBpc3N1ZXMsIG5vZGVDb3VudCwgY29tcG9uZW50Q291bnQsIGhvbGxvd0NvbXBvbmVudHMgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXByZWZhYkRhdGFbMF0gfHwgcHJlZmFiRGF0YVswXS5fX3R5cGVfXyAhPT0gJ2NjLlByZWZhYicpIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdGaXJzdCBlbGVtZW50IG11c3QgYmUgY2MuUHJlZmFiIHR5cGUnKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBub2Rlc1dpdGhDb21wb25lbnRzID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgICAgIHByZWZhYkRhdGEuZm9yRWFjaCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoaXRlbS5fX3R5cGVfXyA9PT0gJ2NjLk5vZGUnKSB7XG4gICAgICAgICAgICAgICAgbm9kZUNvdW50Kys7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgKGl0ZW0uX2NvbXBvbmVudHMgfHwgW10pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWYgJiYgdHlwZW9mIHJlZi5fX2lkX18gPT09ICdudW1iZXInKSBub2Rlc1dpdGhDb21wb25lbnRzLmFkZChyZWYuX19pZF9fKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0uX190eXBlX18gPT09ICdjYy5Db21wUHJlZmFiSW5mbycgfHwgIWl0ZW0uX190eXBlX18pIHtcbiAgICAgICAgICAgICAgICAvLyBTZXJpYWxpemF0aW9uIGJvb2trZWVwaW5nLCBuZXZlciBhIGNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoU3RyaW5nKGl0ZW0uX190eXBlX18pLnN0YXJ0c1dpdGgoJ2NjLicpIHx8IGl0ZW0uX190eXBlX18pIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRDb3VudCsrO1xuICAgICAgICAgICAgICAgIC8vIEEgY29tcG9uZW50IHRoYXQgaXMgcmVmZXJlbmNlZCBmcm9tIGEgbm9kZSBidXQgY2FycmllcyBub3RoaW5nIGJ1dCB0aGVcbiAgICAgICAgICAgICAgICAvLyBlbnZlbG9wZSBoYXMgbG9zdCBldmVyeSBwcm9wZXJ0eSBpdCBoZWxkIGluIHRoZSBzY2VuZSAoIzI4LyM3MykuXG4gICAgICAgICAgICAgICAgY29uc3QgaG9sZHNOb3RoaW5nQnV0RW52ZWxvcGUgPSBPYmplY3Qua2V5cyhpdGVtKS5ldmVyeShrZXkgPT4gQkFTRV9DT01QT05FTlRfS0VZUy5oYXMoa2V5KSk7XG4gICAgICAgICAgICAgICAgaWYgKGhvbGRzTm90aGluZ0J1dEVudmVsb3BlICYmIHR5cGVvZiBpdGVtLm5vZGU/Ll9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgaG9sbG93Q29tcG9uZW50cy5wdXNoKFN0cmluZyhpdGVtLl9fdHlwZV9fKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKG5vZGVDb3VudCA9PT0gMCkgaXNzdWVzLnB1c2goJ1ByZWZhYiBtdXN0IGNvbnRhaW4gYXQgbGVhc3Qgb25lIG5vZGUnKTtcbiAgICAgICAgZm9yIChjb25zdCBob2xsb3cgb2YgWy4uLm5ldyBTZXQoaG9sbG93Q29tcG9uZW50cyldKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaChgQ29tcG9uZW50ICcke2hvbGxvd30nIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzIOKAlCBpdCBjYXJyaWVzIG5vbmUgb2YgdGhlIHNjZW5lIHZhbHVlcyBpdCBoYWQgKGlzc3VlcyAjMjgvIzczKWApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGlzc3Vlcy5sZW5ndGggPT09IDAsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCwgaG9sbG93Q29tcG9uZW50cyB9O1xuICAgIH1cblxuICAgIGNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICByZXR1cm4geyBcInZlclwiOiBcIjEuMS41MFwiLCBcImltcG9ydGVyXCI6IFwicHJlZmFiXCIsIFwiaW1wb3J0ZWRcIjogdHJ1ZSwgXCJ1dWlkXCI6IHByZWZhYlV1aWQsIFwiZmlsZXNcIjogW1wiLmpzb25cIl0sIFwic3ViTWV0YXNcIjoge30sIFwidXNlckRhdGFcIjogeyBcInN5bmNOb2RlTmFtZVwiOiBwcmVmYWJOYW1lIH0gfTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBVVUlEIHV0aWxpdGllcyA9PT09PVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVVVSUQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgY2hhcnMgPSAnMDEyMzQ1Njc4OWFiY2RlZic7XG4gICAgICAgIGxldCB1dWlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDggfHwgaSA9PT0gMTIgfHwgaSA9PT0gMTYgfHwgaSA9PT0gMjApIHV1aWQgKz0gJy0nO1xuICAgICAgICAgICAgdXVpZCArPSBjaGFyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFycy5sZW5ndGgpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlRmlsZUlkKCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNoYXJzID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5Ky8nO1xuICAgICAgICBsZXQgZmlsZUlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjI7IGkrKykgZmlsZUlkICs9IGNoYXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJzLmxlbmd0aCldO1xuICAgICAgICByZXR1cm4gZmlsZUlkO1xuICAgIH1cblxufVxuIl19