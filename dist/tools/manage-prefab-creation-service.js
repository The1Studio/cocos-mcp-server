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
                if (nodeData.__comps__) {
                    // `properties` carries the live property dump through to serialization.
                    // Reducing each component to type/uuid/enabled discarded every configured
                    // value before it could be written, so `action=create` saved engine
                    // defaults for every component type (#28).
                    node.components = nodeData.__comps__.map((comp) => {
                        var _a;
                        return ({
                            type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                            uuid: ((_a = comp.uuid) === null || _a === void 0 ? void 0 : _a.value) || comp.uuid || null,
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
    createEngineStandardNode(nodeData, parentNodeIndex, nodeName) {
        var _a, _b, _c, _d, _e, _f, _g;
        const name = nodeName || ((_a = nodeData.name) === null || _a === void 0 ? void 0 : _a.value) || nodeData.name || 'Node';
        const lpos = ((_b = nodeData.position) === null || _b === void 0 ? void 0 : _b.value) || ((_c = nodeData.lpos) === null || _c === void 0 ? void 0 : _c.value) || nodeData._lpos || { x: 0, y: 0, z: 0 };
        const lrot = ((_d = nodeData.rotation) === null || _d === void 0 ? void 0 : _d.value) || ((_e = nodeData.lrot) === null || _e === void 0 ? void 0 : _e.value) || nodeData._lrot || { x: 0, y: 0, z: 0, w: 1 };
        const lscale = ((_f = nodeData.scale) === null || _f === void 0 ? void 0 : _f.value) || ((_g = nodeData.lscale) === null || _g === void 0 ? void 0 : _g.value) || nodeData._lscale || { x: 1, y: 1, z: 1 };
        return {
            "__type__": "cc.Node", "_name": name, "_objFlags": 0, "__editorExtras__": {},
            "_parent": parentNodeIndex !== null ? { "__id__": parentNodeIndex } : null,
            "_children": [], "_active": nodeData.active !== false, "_components": [], "_prefab": null,
            "_lpos": { "__type__": "cc.Vec3", "x": lpos.x || 0, "y": lpos.y || 0, "z": lpos.z || 0 },
            "_lrot": { "__type__": "cc.Quat", "x": lrot.x || 0, "y": lrot.y || 0, "z": lrot.z || 0, "w": lrot.w !== undefined ? lrot.w : 1 },
            "_lscale": { "__type__": "cc.Vec3", "x": lscale.x !== undefined ? lscale.x : 1, "y": lscale.y !== undefined ? lscale.y : 1, "z": lscale.z !== undefined ? lscale.z : 1 },
            "_mobility": 0, "_layer": 1073741824, "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 }, "_id": ""
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
        // Asset references
        if ((value === null || value === void 0 ? void 0 : value.uuid) && ['cc.Prefab', 'cc.Texture2D', 'cc.SpriteFrame', 'cc.Material', 'cc.AnimationClip', 'cc.AudioClip', 'cc.Font', 'cc.Asset'].includes(type)) {
            const uuidToUse = type === 'cc.Prefab' ? value.uuid : this.uuidToCompressedId(value.uuid);
            return { "__uuid__": uuidToUse, "__expectedType__": type };
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
        // Array properties
        if (Array.isArray(value)) {
            if (((_c = propData.elementTypeData) === null || _c === void 0 ? void 0 : _c.type) === 'cc.Node') {
                return value.map((item) => {
                    var _a;
                    if ((item === null || item === void 0 ? void 0 : item.uuid) && ((_a = context === null || context === void 0 ? void 0 : context.nodeUuidToIndex) === null || _a === void 0 ? void 0 : _a.has(item.uuid)))
                        return { "__id__": context.nodeUuidToIndex.get(item.uuid) };
                    return null;
                }).filter(Boolean);
            }
            if ((_e = (_d = propData.elementTypeData) === null || _d === void 0 ? void 0 : _d.type) === null || _e === void 0 ? void 0 : _e.startsWith('cc.')) {
                return value.map((item) => (item === null || item === void 0 ? void 0 : item.uuid) ? { "__uuid__": this.uuidToCompressedId(item.uuid), "__expectedType__": propData.elementTypeData.type } : null).filter(Boolean);
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
    /**
     * Convert UUID to Cocos Creator compressed format.
     * First 5 hex chars kept as-is; remaining 27 chars compressed to 18 via base64 encoding.
     */
    uuidToCompressedId(uuid) {
        const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
        if (cleanUuid.length !== 32)
            return uuid;
        let result = cleanUuid.substring(0, 5);
        const remainder = cleanUuid.substring(5);
        for (let i = 0; i < remainder.length; i += 3) {
            const value = parseInt((remainder[i] || '0') + (remainder[i + 1] || '0') + (remainder[i + 2] || '0'), 16);
            result += BASE64_KEYS[(value >> 6) & 63] + BASE64_KEYS[value & 63];
        }
        return result;
    }
}
exports.PrefabCreationService = PrefabCreationService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7O0dBU0c7QUFDSCx1Q0FBeUI7QUFDekIsb0RBQW1EO0FBQ25ELDJGQUFtRjtBQUVuRjs7Ozs7R0FLRztBQUNILFNBQVMsb0JBQW9CLENBQUMsS0FBVTtJQUNwQyxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQzlFLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQztRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3hFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakgsQ0FBQztBQUVELHNGQUFzRjtBQUN0RixNQUFNLHdCQUF3QixHQUFHLElBQUksR0FBRyxDQUFDO0lBQ3JDLE1BQU0sRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsZUFBZTtJQUM5RCxXQUFXLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLGtCQUFrQjtDQUMxRSxDQUFDLENBQUM7QUFFSCx3RkFBd0Y7QUFDeEYsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLEdBQUcs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LENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSTtZQUMxRSxXQUFXLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxhQUFhLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJO1lBQ3pGLE9BQU8sRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDeEYsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNoSSxTQUFTLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQ3hLLFdBQVcsRUFBRSxDQUFD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WUFDckMsSUFBSSxJQUFJLEtBQUssVUFBVTtnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNoVCxJQUFJLElBQUksS0FBSyxTQUFTO2dCQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUksSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFF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LFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN2RCxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssRUFBRTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ3pDLElBQUksTUFBTSxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sU0FBUyxHQUFHLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDekMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzNDLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzFHLE1BQU0sSUFBSSxXQUFXLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUMsQ0FBQztRQUN2RSxDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztDQUNKO0FBcGxCRCxzREFvbEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcmVmYWJDcmVhdGlvblNlcnZpY2U6IGhhbmRsZXMgdGhlIGNvbXBsZXggbG9naWMgb2YgY3JlYXRpbmcgQ29jb3MgQ3JlYXRvciBwcmVmYWIgZmlsZXNcbiAqIHByb2dyYW1tYXRpY2FsbHkuIEV4dHJhY3RlZCBmcm9tIE1hbmFnZVByZWZhYiB0byBrZWVwIG1hbmFnZS1wcmVmYWIudHMgdW5kZXIgMjAwIGxpbmVzLlxuICpcbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAtIEZldGNoaW5nIG5vZGUgZGF0YSB3aXRoIGNvbXBvbmVudCBpbmZvIGZyb20gdGhlIHNjZW5lXG4gKiAtIFNlcmlhbGl6aW5nIG5vZGUgdHJlZXMgaW50byBDb2NvcyBDcmVhdG9yIHByZWZhYiBKU09OIGZvcm1hdFxuICogLSBTYXZpbmcgYW5kIHJlLWltcG9ydGluZyBhc3NldCBmaWxlcyB2aWEgYXNzZXQtZGJcbiAqIC0gTGlua2luZyBzY2VuZSBub2RlcyB0byBuZXdseSBjcmVhdGVkIHByZWZhYiBhc3NldHNcbiAqL1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuXG4vKipcbiAqIEEgZHVtcCBlbnRyeSBpcyBhIHByb3BlcnR5IGRlc2NyaXB0b3Igd2hlbiBpdCB3cmFwcyBhIGB2YWx1ZWAgYW5kIGNhcnJpZXMgYXQgbGVhc3Qgb25lXG4gKiBlZGl0b3IgYW5ub3RhdGlvbi4gRGVsaWJlcmF0ZWx5IGxvb3NlciB0aGFuIHRoZSBpbnNwZWN0b3Itc2lkZVxuICogYGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3JgLCB3aGljaCByZWplY3RzIGRlc2NyaXB0b3JzIHdob3NlIGZpZWxkcyBhcmUgYWxsIHByaW1pdGl2ZXNcbiAqIChgeyBuYW1lLCB2YWx1ZTogNjAsIHR5cGU6ICdOdW1iZXInIH1gKSBiZWNhdXNlIGl0IGlzIGd1YXJkaW5nIGEgZGlmZmVyZW50IGNhc2UuXG4gKi9cbmZ1bmN0aW9uIGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5OiBhbnkpOiBib29sZWFuIHtcbiAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbnRyeSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlbnRyeSwgJ3ZhbHVlJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gWyduYW1lJywgJ3R5cGUnLCAnZGlzcGxheU5hbWUnLCAncmVhZG9ubHknXS5zb21lKGsgPT4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGVudHJ5LCBrKSk7XG59XG5cbi8qKiBFZGl0b3Itb25seSBkdW1wIGVudHJpZXMgdGhhdCBoYXZlIG5vIHNlcmlhbGl6ZWQgY291bnRlcnBhcnQgaW4gYSAucHJlZmFiIGZpbGUuICovXG5jb25zdCBEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQgPSBuZXcgU2V0KFtcbiAgICAnbm9kZScsICdlbmFibGVkJywgJ19fdHlwZV9fJywgJ3V1aWQnLCAnbmFtZScsICdfX3NjcmlwdEFzc2V0JyxcbiAgICAnX29iakZsYWdzJywgJ19uYW1lJywgJ19pZCcsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfX2VkaXRvckV4dHJhc19fJ1xuXSk7XG5cbi8qKiBUaGUgZW52ZWxvcGUgZXZlcnkgc2VyaWFsaXplZCBjb21wb25lbnQgY2FycmllcyBldmVuIHdoZW4gaXQgaG9sZHMgbm8gcHJvcGVydGllcy4gKi9cbmNvbnN0IEJBU0VfQ09NUE9ORU5UX0tFWVMgPSBuZXcgU2V0KFtcbiAgICAnX190eXBlX18nLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19fZWRpdG9yRXh0cmFzX18nLCAnbm9kZScsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfaWQnXG5dKTtcblxuLyoqXG4gKiBEdW1wIGtleXMgd2hvc2Ugc2VyaWFsaXplZCBmaWVsZCBuYW1lIGRpZmZlcnMgKGFjY2Vzc29yLWJhY2tlZCBlbmdpbmUgcHJvcGVydGllcykuXG4gKlxuICogVmVyaWZpZWQgb25seSBmb3IgdGhlc2UgZm91ciB0eXBlcyDigJQgZXZlcnkgb3RoZXIgZW5naW5lIGBjYy4qYC9gc3AuKmAvYGRyYWdvbkJvbmVzLipgXG4gKiBjb21wb25lbnQgZmFsbHMgdGhyb3VnaCB0byB0aGUgZ2VuZXJpYyBicmFuY2ggYmVsb3csIHdoaWNoIGVtaXRzIHRoZSBkdW1wIGtleVxuICogVkVSQkFUSU0uIEZvciBtb3N0IGVuZ2luZSB0eXBlcyB0aGUgZHVtcCBrZXkgYWxyZWFkeSBtYXRjaGVzIHRoZSBzZXJpYWxpemVkIGtleVxuICogKGUuZy4gYGNjLlBhcnRpY2xlU3lzdGVtMkRgJ3MgYGVtaXNzaW9uUmF0ZWApLCBidXQgYW4gYWNjZXNzb3ItYmFja2VkIGZpZWxkIG9uIGEgdHlwZVxuICogbm90IGxpc3RlZCBoZXJlIHdvdWxkIHNlcmlhbGl6ZSB1bmRlciB0aGUgV1JPTkcga2V5IHJhdGhlciB0aGFuIGJlaW5nIGRyb3BwZWQg4oCUIGFcbiAqIGtub3duLCB1bmRldGVjdGFibGUtd2l0aG91dC1hLWxpdmUtZWRpdG9yIGxpbWl0YXRpb24gb2YgdGhpcyBmaXguIEV4dGVuZCB0aGlzIHRhYmxlXG4gKiBhcyBzcGVjaWZpYyBtaXNtYXRjaGVzIGFyZSBjb25maXJtZWQgYWdhaW5zdCBhIHJ1bm5pbmcgQ29jb3MgQ3JlYXRvciAzLjguNyBpbnN0YW5jZS5cbiAqL1xuY29uc3QgRFVNUF9LRVlfUkVOQU1FUzogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgc3RyaW5nPj4gPSB7XG4gICAgJ2NjLlVJVHJhbnNmb3JtJzogeyBjb250ZW50U2l6ZTogJ19jb250ZW50U2l6ZScsIGFuY2hvclBvaW50OiAnX2FuY2hvclBvaW50JyB9LFxuICAgICdjYy5TcHJpdGUnOiB7IHNwcml0ZUZyYW1lOiAnX3Nwcml0ZUZyYW1lJywgdHlwZTogJ190eXBlJywgc2l6ZU1vZGU6ICdfc2l6ZU1vZGUnLCBmaWxsVHlwZTogJ19maWxsVHlwZScgfSxcbiAgICAnY2MuTGFiZWwnOiB7IHN0cmluZzogJ19zdHJpbmcnLCBmb250U2l6ZTogJ19mb250U2l6ZScsIGxpbmVIZWlnaHQ6ICdfbGluZUhlaWdodCcsIG92ZXJmbG93OiAnX292ZXJmbG93JyB9LFxuICAgICdjYy5CdXR0b24nOiB7IHRhcmdldDogJ190YXJnZXQnLCBpbnRlcmFjdGFibGU6ICdfaW50ZXJhY3RhYmxlJywgdHJhbnNpdGlvbjogJ190cmFuc2l0aW9uJyB9LFxufTtcblxuLyoqXG4gKiBHYXAtZmlsbGVycywgYXBwbGllZCBvbmx5IHRvIGtleXMgdGhlIGR1bXAgZGlkIG5vdCBzdXBwbHkuIFRoZXNlIGFyZSBlbmdpbmUgZGVmYXVsdHMg4oCUXG4gKiBuZXZlciBhbiBvdmVycmlkZSBvZiBhIGNhcHR1cmVkIHZhbHVlLlxuICovXG5jb25zdCBDT01QT05FTlRfREVGQVVMVFM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIGFueT4+ID0ge1xuICAgICdjYy5VSVRyYW5zZm9ybSc6IHtcbiAgICAgICAgX2NvbnRlbnRTaXplOiB7IFwiX190eXBlX19cIjogXCJjYy5TaXplXCIsIFwid2lkdGhcIjogMTAwLCBcImhlaWdodFwiOiAxMDAgfSxcbiAgICAgICAgX2FuY2hvclBvaW50OiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiAwLjUsIFwieVwiOiAwLjUgfSxcbiAgICB9LFxuICAgICdjYy5TcHJpdGUnOiB7XG4gICAgICAgIF9zcHJpdGVGcmFtZTogbnVsbCwgX3R5cGU6IDAsIF9maWxsVHlwZTogMCwgX3NpemVNb2RlOiAxLFxuICAgICAgICBfZmlsbENlbnRlcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogMCwgXCJ5XCI6IDAgfSxcbiAgICAgICAgX2ZpbGxTdGFydDogMCwgX2ZpbGxSYW5nZTogMCwgX2lzVHJpbW1lZE1vZGU6IHRydWUsIF91c2VHcmF5c2NhbGU6IGZhbHNlLFxuICAgICAgICBfYXRsYXM6IG51bGwsXG4gICAgfSxcbiAgICAnY2MuQnV0dG9uJzoge1xuICAgICAgICBfaW50ZXJhY3RhYmxlOiB0cnVlLCBfdHJhbnNpdGlvbjogMyxcbiAgICAgICAgX25vcm1hbENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9ob3ZlckNvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjExLCBcImdcIjogMjExLCBcImJcIjogMjExLCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9wcmVzc2VkQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyNTUsIFwiZ1wiOiAyNTUsIFwiYlwiOiAyNTUsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX2Rpc2FibGVkQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAxMjQsIFwiZ1wiOiAxMjQsIFwiYlwiOiAxMjQsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX25vcm1hbFNwcml0ZTogbnVsbCwgX2hvdmVyU3ByaXRlOiBudWxsLCBfcHJlc3NlZFNwcml0ZTogbnVsbCwgX2Rpc2FibGVkU3ByaXRlOiBudWxsLFxuICAgICAgICBfZHVyYXRpb246IDAuMSwgX3pvb21TY2FsZTogMS4yLCBfY2xpY2tFdmVudHM6IFtdLFxuICAgIH0sXG4gICAgJ2NjLkxhYmVsJzoge1xuICAgICAgICBfc3RyaW5nOiBcIkxhYmVsXCIsIF9ob3Jpem9udGFsQWxpZ246IDEsIF92ZXJ0aWNhbEFsaWduOiAxLFxuICAgICAgICBfYWN0dWFsRm9udFNpemU6IDIwLCBfZm9udFNpemU6IDIwLCBfZm9udEZhbWlseTogXCJBcmlhbFwiLFxuICAgICAgICBfbGluZUhlaWdodDogMjUsIF9vdmVyZmxvdzogMCwgX2VuYWJsZVdyYXBUZXh0OiB0cnVlLFxuICAgICAgICBfZm9udDogbnVsbCwgX2lzU3lzdGVtRm9udFVzZWQ6IHRydWUsIF9zcGFjaW5nWDogMCxcbiAgICAgICAgX2lzSXRhbGljOiBmYWxzZSwgX2lzQm9sZDogZmFsc2UsIF9pc1VuZGVybGluZTogZmFsc2UsXG4gICAgICAgIF91bmRlcmxpbmVIZWlnaHQ6IDIsIF9jYWNoZU1vZGU6IDAsXG4gICAgfSxcbn07XG5cbmV4cG9ydCBjbGFzcyBQcmVmYWJDcmVhdGlvblNlcnZpY2Uge1xuXG4gICAgYXN5bmMgY3JlYXRlUHJlZmFiV2l0aEFzc2V0REIobm9kZVV1aWQ6IHN0cmluZywgc2F2ZVBhdGg6IHN0cmluZywgcHJlZmFiTmFtZTogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgdGhpcy5nZXROb2RlRGF0YShub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDYW5ub3QgZ2V0IG5vZGUgZGF0YScgfTtcblxuICAgICAgICAgICAgY29uc3QgdGVtcFByZWZhYkNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShbeyBcIl9fdHlwZV9fXCI6IFwiY2MuUHJlZmFiXCIsIFwiX25hbWVcIjogcHJlZmFiTmFtZSB9XSwgbnVsbCwgMik7XG4gICAgICAgICAgICBjb25zdCBjcmVhdGVSZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0ZUFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgsIHRlbXBQcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGlmICghY3JlYXRlUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBjcmVhdGVSZXN1bHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFByZWZhYlV1aWQgPSBjcmVhdGVSZXN1bHQuZGF0YT8udXVpZDtcbiAgICAgICAgICAgIGlmICghYWN0dWFsUHJlZmFiVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGdldCBlbmdpbmUtYXNzaWduZWQgcHJlZmFiIFVVSUQnIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkNvbnRlbnQgPSBhd2FpdCB0aGlzLmNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YSwgcHJlZmFiTmFtZSwgYWN0dWFsUHJlZmFiVXVpZCwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cyk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZUFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgsIEpTT04uc3RyaW5naWZ5KHByZWZhYkNvbnRlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTWV0YVdpdGhBc3NldERCKHNhdmVQYXRoLCB0aGlzLmNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZSwgYWN0dWFsUHJlZmFiVXVpZCkpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWltcG9ydEFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgpO1xuXG4gICAgICAgICAgICAvLyBSZWFkIHRoZSBhc3NldCBiYWNrIGJlZm9yZSByZXBvcnRpbmcgc3VjY2Vzcy4gQ29tcG9uZW50cyB0aGF0IHdlcmVcbiAgICAgICAgICAgIC8vIGNvbmZpZ3VyZWQgaW4gdGhlIHNjZW5lIGJ1dCBzZXJpYWxpemVkIHRvIGEgYmFyZSBlbnZlbG9wZSBhcmUgYSBzaWxlbnRcbiAgICAgICAgICAgIC8vIGRhdGEgbG9zcyB0aGUgY2FsbGVyIGNhbm5vdCBvdGhlcndpc2UgZGV0ZWN0ICgjMjgpLlxuICAgICAgICAgICAgY29uc3QgcmVhZEJhY2sgPSBhd2FpdCB0aGlzLnJlYWRCYWNrUHJlZmFiKHNhdmVQYXRoLCBwcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGNvbnN0IGxvc3QgPSB0aGlzLmZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHJlYWRCYWNrLmRhdGEsIG5vZGVEYXRhKTtcbiAgICAgICAgICAgIGlmIChsb3N0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHdyaXR0ZW4gdG8gJHtzYXZlUGF0aH0sIGJ1dCB0aGVzZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzOiAke2xvc3Quam9pbignLCAnKX0uIFRoZSBzY2VuZSB2YWx1ZXMgd2VyZSBub3QgY2FwdHVyZWQg4oCUIGRvIG5vdCB1c2UgdGhpcyBwcmVmYWIuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGNvbXBvbmVudHNXaXRob3V0UHJvcGVydGllczogbG9zdCwgdmVyaWZpZWRGcm9tOiByZWFkQmFjay5zb3VyY2UgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZCwgYWN0dWFsUHJlZmFiVXVpZCwgc2F2ZVBhdGgpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbnZlcnRlZFRvUHJlZmFiSW5zdGFuY2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1ZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MgPyAnUHJlZmFiIGNyZWF0ZWQgYW5kIG5vZGUgY29udmVydGVkJyA6ICdQcmVmYWIgY3JlYXRlZCwgbm9kZSBjb252ZXJzaW9uIGZhaWxlZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpOiBhbnkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogJ05hdGl2ZSBwcmVmYWIgY3JlYXRpb24gQVBJIG5vdCBhdmFpbGFibGUnLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdUbyBjcmVhdGUgYSBwcmVmYWIgaW4gQ29jb3MgQ3JlYXRvcjpcXG4xLiBTZWxlY3QgYSBub2RlIGluIHRoZSBzY2VuZVxcbjIuIERyYWcgaXQgdG8gdGhlIEFzc2V0IEJyb3dzZXJcXG4zLiBPciByaWdodC1jbGljayB0aGUgbm9kZSBhbmQgc2VsZWN0IFwiQ3JlYXRlIFByZWZhYlwiJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIGNyZWF0ZVByZWZhYkN1c3RvbShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJQYXRoOiBzdHJpbmcsIHByZWZhYk5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZURhdGEobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSBub3QgZm91bmQ6ICR7bm9kZVV1aWR9YCB9O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJVdWlkID0gdGhpcy5nZW5lcmF0ZVVVSUQoKTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkpzb25EYXRhID0gYXdhaXQgdGhpcy5jcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGEsIHByZWZhYk5hbWUsIHByZWZhYlV1aWQsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgY29uc3Qgc2F2ZVJlc3VsdCA9IGF3YWl0IHRoaXMuc2F2ZVByZWZhYldpdGhNZXRhKHByZWZhYlBhdGgsIHByZWZhYkpzb25EYXRhLCB0aGlzLmNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZSwgcHJlZmFiVXVpZCkpO1xuXG4gICAgICAgICAgICBpZiAoc2F2ZVJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9zdCA9IHRoaXMuZmluZENvbXBvbmVudHNUaGF0TG9zdFByb3BlcnRpZXMocHJlZmFiSnNvbkRhdGEsIG5vZGVEYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBQcmVmYWIgd3JpdHRlbiB0byAke3ByZWZhYlBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIHByZWZhYlBhdGgsIHByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udmVydGVkVG9QcmVmYWJJbnN0YW5jZTogY29udmVydFJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY29udmVydFJlc3VsdC5zdWNjZXNzID8gJ0N1c3RvbSBwcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogc2F2ZVJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHNhdmUgcHJlZmFiIGZpbGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gTm9kZSBkYXRhIHJldHJpZXZhbCA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlRGF0YShub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm8pIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0Tm9kZVdpdGhDaGlsZHJlbihub2RlVXVpZCkgfHwgbm9kZUluZm87XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVXaXRoQ2hpbGRyZW4obm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBpZiAoIXRyZWUpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IHRoaXMuZmluZE5vZGVJblRyZWUodHJlZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHRhcmdldE5vZGUgPyBhd2FpdCB0aGlzLmVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHModGFyZ2V0Tm9kZSkgOiBudWxsO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5oYW5jZSBub2RlIHRyZWUgd2l0aCBhY2N1cmF0ZSBjb21wb25lbnQgaW5mbyB2aWEgZGlyZWN0IEVkaXRvciBBUEkuXG4gICAgICogUmVwbGFjZXMgcHJldmlvdXMgSFRUUCBzZWxmLWNhbGwgdG8gbG9jYWxob3N0Ojg1ODUgd2hpY2ggd2FzIGZyYWdpbGUgYW5kIHBvcnQtZGVwZW5kZW50LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyhub2RlOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBpZiAoIW5vZGUgfHwgIW5vZGUudXVpZCkgcmV0dXJuIG5vZGU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlLnV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2FycnkgdGhlIHRyYW5zZm9ybSBkdW1wIHRocm91Z2ggc28gY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIGNhbiByZWFkXG4gICAgICAgICAgICAgICAgLy8gcG9zaXRpb24vcm90YXRpb24vc2NhbGUgaW5zdGVhZCBvZiBmYWxsaW5nIGJhY2sgdG8gaWRlbnRpdHkgKGlzc3VlICM1MCkuXG4gICAgICAgICAgICAgICAgLy8gVGhlIHF1ZXJ5LW5vZGUgZHVtcCBzaGFwZXMgdGhlc2UgYXMgeyB2YWx1ZTogeyB4LCB5LCB6IH0gfSAoYW5kIHcgZm9yIHF1YXQpLFxuICAgICAgICAgICAgICAgIC8vIHdoaWNoIGlzIGV4YWN0bHkgdGhlIHNoYXBlIGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSByZWFkcyB2aWEgbm9kZURhdGEucG9zaXRpb24/LnZhbHVlLlxuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5wb3NpdGlvbikgbm9kZS5wb3NpdGlvbiA9IG5vZGVEYXRhLnBvc2l0aW9uO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5yb3RhdGlvbikgbm9kZS5yb3RhdGlvbiA9IG5vZGVEYXRhLnJvdGF0aW9uO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5zY2FsZSkgbm9kZS5zY2FsZSA9IG5vZGVEYXRhLnNjYWxlO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gYHByb3BlcnRpZXNgIGNhcnJpZXMgdGhlIGxpdmUgcHJvcGVydHkgZHVtcCB0aHJvdWdoIHRvIHNlcmlhbGl6YXRpb24uXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlZHVjaW5nIGVhY2ggY29tcG9uZW50IHRvIHR5cGUvdXVpZC9lbmFibGVkIGRpc2NhcmRlZCBldmVyeSBjb25maWd1cmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIHZhbHVlIGJlZm9yZSBpdCBjb3VsZCBiZSB3cml0dGVuLCBzbyBgYWN0aW9uPWNyZWF0ZWAgc2F2ZWQgZW5naW5lXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHRzIGZvciBldmVyeSBjb21wb25lbnQgdHlwZSAoIzI4KS5cbiAgICAgICAgICAgICAgICAgICAgbm9kZS5jb21wb25lbnRzID0gbm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogY29tcC51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAoY29tcClcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTm9kZSAke25vZGUudXVpZH0gZW5oYW5jZWQgd2l0aCAke25vZGUuY29tcG9uZW50cy5sZW5ndGh9IGNvbXBvbmVudHMgKGluY2wuIHNjcmlwdCB0eXBlcylgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBnZXQgY29tcG9uZW50IGluZm8gZm9yIG5vZGUgJHtub2RlLnV1aWR9OmAsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuW2ldID0gYXdhaXQgdGhpcy5lbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKG5vZGUuY2hpbGRyZW5baV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIHByaXZhdGUgZmluZE5vZGVJblRyZWUobm9kZTogYW55LCB0YXJnZXRVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBpZiAoIW5vZGUpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAobm9kZS51dWlkID09PSB0YXJnZXRVdWlkIHx8IG5vZGUudmFsdWU/LnV1aWQgPT09IHRhcmdldFV1aWQpIHJldHVybiBub2RlO1xuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZE5vZGVJblRyZWUoY2hpbGQsIHRhcmdldFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGZvdW5kO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGE6IGFueSk6IGFueVtdIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW46IGFueVtdID0gW107XG4gICAgICAgIGlmIChub2RlRGF0YS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlRGF0YS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsaWROb2RlRGF0YShjaGlsZCkpIGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG5cbiAgICBwcml2YXRlIGlzVmFsaWROb2RlRGF0YShub2RlRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghbm9kZURhdGEgfHwgdHlwZW9mIG5vZGVEYXRhICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ3V1aWQnKSB8fCBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpIHx8IG5vZGVEYXRhLmhhc093blByb3BlcnR5KCdfX3R5cGVfXycpIHx8XG4gICAgICAgICAgICAobm9kZURhdGEudmFsdWUgJiYgKG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCd1dWlkJykgfHwgbm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSB8fCBub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgnX190eXBlX18nKSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdE5vZGVVdWlkKG5vZGVEYXRhOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZURhdGEudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBub2RlRGF0YS51dWlkO1xuICAgICAgICBpZiAobm9kZURhdGEudmFsdWUgJiYgdHlwZW9mIG5vZGVEYXRhLnZhbHVlLnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gbm9kZURhdGEudmFsdWUudXVpZDtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gPT09PT0gUHJlZmFiIHNlcmlhbGl6YXRpb24gPT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50KG5vZGVEYXRhOiBhbnksIHByZWZhYk5hbWU6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxhbnlbXT4ge1xuICAgICAgICBjb25zdCBwcmVmYWJEYXRhOiBhbnlbXSA9IFtdO1xuICAgICAgICBwcmVmYWJEYXRhLnB1c2goe1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYlwiLCBcIl9uYW1lXCI6IHByZWZhYk5hbWUgfHwgXCJcIiwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJfbmF0aXZlXCI6IFwiXCIsIFwiZGF0YVwiOiB7IFwiX19pZF9fXCI6IDEgfSwgXCJvcHRpbWl6YXRpb25Qb2xpY3lcIjogMCwgXCJwZXJzaXN0ZW50XCI6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgICAgICAgICBwcmVmYWJEYXRhLCBjdXJyZW50SWQ6IDIsIHByZWZhYkFzc2V0SW5kZXg6IDAsXG4gICAgICAgICAgICBub2RlRmlsZUlkczogbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKSxcbiAgICAgICAgICAgIG5vZGVVdWlkVG9JbmRleDogbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFV1aWRUb0luZGV4OiBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpXG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVDb21wbGV0ZU5vZGVUcmVlKG5vZGVEYXRhLCBudWxsLCAxLCBjb250ZXh0LCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgcmV0dXJuIHByZWZhYkRhdGE7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICBub2RlRGF0YTogYW55LCBwYXJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwsIG5vZGVJbmRleDogbnVtYmVyLFxuICAgICAgICBjb250ZXh0OiB7IHByZWZhYkRhdGE6IGFueVtdOyBjdXJyZW50SWQ6IG51bWJlcjsgcHJlZmFiQXNzZXRJbmRleDogbnVtYmVyOyBub2RlRmlsZUlkczogTWFwPHN0cmluZywgc3RyaW5nPjsgbm9kZVV1aWRUb0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+OyBjb21wb25lbnRVdWlkVG9JbmRleDogTWFwPHN0cmluZywgbnVtYmVyPiB9LFxuICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuLCBub2RlTmFtZT86IHN0cmluZ1xuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByZWZhYkRhdGEgfSA9IGNvbnRleHQ7XG4gICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZShub2RlRGF0YSwgcGFyZW50Tm9kZUluZGV4LCBub2RlTmFtZSk7XG5cbiAgICAgICAgd2hpbGUgKHByZWZhYkRhdGEubGVuZ3RoIDw9IG5vZGVJbmRleCkgcHJlZmFiRGF0YS5wdXNoKG51bGwpO1xuICAgICAgICBwcmVmYWJEYXRhW25vZGVJbmRleF0gPSBub2RlO1xuXG4gICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdGhpcy5leHRyYWN0Tm9kZVV1aWQobm9kZURhdGEpO1xuICAgICAgICBjb25zdCBmaWxlSWQgPSBub2RlVXVpZCB8fCB0aGlzLmdlbmVyYXRlRmlsZUlkKCk7XG4gICAgICAgIGNvbnRleHQubm9kZUZpbGVJZHMuc2V0KG5vZGVJbmRleC50b1N0cmluZygpLCBmaWxlSWQpO1xuICAgICAgICBpZiAobm9kZVV1aWQpIGNvbnRleHQubm9kZVV1aWRUb0luZGV4LnNldChub2RlVXVpZCwgbm9kZUluZGV4KTtcblxuICAgICAgICBjb25zdCBjaGlsZHJlblRvUHJvY2VzcyA9IHRoaXMuZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGEpO1xuICAgICAgICBpZiAoaW5jbHVkZUNoaWxkcmVuICYmIGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kaWNlczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBjaGlsZEluZGljZXMucHVzaChjaGlsZEluZGV4KTtcbiAgICAgICAgICAgICAgICBub2RlLl9jaGlsZHJlbi5wdXNoKHsgXCJfX2lkX19cIjogY2hpbGRJbmRleCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbXBsZXRlTm9kZVRyZWUoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuVG9Qcm9jZXNzW2ldLCBub2RlSW5kZXgsIGNoaWxkSW5kaWNlc1tpXSwgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cywgY2hpbGRyZW5Ub1Byb2Nlc3NbaV0ubmFtZSB8fCBgQ2hpbGQke2kgKyAxfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzICYmIG5vZGVEYXRhLmNvbXBvbmVudHMgJiYgQXJyYXkuaXNBcnJheShub2RlRGF0YS5jb21wb25lbnRzKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wb25lbnQgb2Ygbm9kZURhdGEuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBub2RlLl9jb21wb25lbnRzLnB1c2goeyBcIl9faWRfX1wiOiBjb21wb25lbnRJbmRleCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gY29tcG9uZW50LnV1aWQgfHwgKGNvbXBvbmVudC52YWx1ZSAmJiBjb21wb25lbnQudmFsdWUudXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudFV1aWQpIGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguc2V0KGNvbXBvbmVudFV1aWQsIGNvbXBvbmVudEluZGV4KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRPYmogPSB0aGlzLmNyZWF0ZUNvbXBvbmVudE9iamVjdChjb21wb25lbnQsIG5vZGVJbmRleCwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0gPSBjb21wb25lbnRPYmo7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZm9JbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgcHJlZmFiRGF0YVtjb21wUHJlZmFiSW5mb0luZGV4XSA9IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbXBQcmVmYWJJbmZvXCIsIFwiZmlsZUlkXCI6IHRoaXMuZ2VuZXJhdGVGaWxlSWQoKSB9O1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRPYmogJiYgdHlwZW9mIGNvbXBvbmVudE9iaiA9PT0gJ29iamVjdCcpIGNvbXBvbmVudE9iai5fX3ByZWZhYiA9IHsgXCJfX2lkX19cIjogY29tcFByZWZhYkluZm9JbmRleCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgbm9kZS5fcHJlZmFiID0geyBcIl9faWRfX1wiOiBwcmVmYWJJbmZvSW5kZXggfTtcbiAgICAgICAgcHJlZmFiRGF0YVtwcmVmYWJJbmZvSW5kZXhdID0ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYkluZm9cIiwgXCJyb290XCI6IHsgXCJfX2lkX19cIjogMSB9LCBcImFzc2V0XCI6IHsgXCJfX2lkX19cIjogY29udGV4dC5wcmVmYWJBc3NldEluZGV4IH0sXG4gICAgICAgICAgICBcImZpbGVJZFwiOiBmaWxlSWQsIFwidGFyZ2V0T3ZlcnJpZGVzXCI6IG51bGwsIFwibmVzdGVkUHJlZmFiSW5zdGFuY2VSb290c1wiOiBudWxsLCBcImluc3RhbmNlXCI6IG51bGxcbiAgICAgICAgfTtcbiAgICAgICAgY29udGV4dC5jdXJyZW50SWQgPSBwcmVmYWJJbmZvSW5kZXggKyAxO1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlKG5vZGVEYXRhOiBhbnksIHBhcmVudE5vZGVJbmRleDogbnVtYmVyIHwgbnVsbCwgbm9kZU5hbWU/OiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBjb25zdCBuYW1lID0gbm9kZU5hbWUgfHwgbm9kZURhdGEubmFtZT8udmFsdWUgfHwgbm9kZURhdGEubmFtZSB8fCAnTm9kZSc7XG4gICAgICAgIGNvbnN0IGxwb3MgPSBub2RlRGF0YS5wb3NpdGlvbj8udmFsdWUgfHwgbm9kZURhdGEubHBvcz8udmFsdWUgfHwgbm9kZURhdGEuX2xwb3MgfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH07XG4gICAgICAgIGNvbnN0IGxyb3QgPSBub2RlRGF0YS5yb3RhdGlvbj8udmFsdWUgfHwgbm9kZURhdGEubHJvdD8udmFsdWUgfHwgbm9kZURhdGEuX2xyb3QgfHwgeyB4OiAwLCB5OiAwLCB6OiAwLCB3OiAxIH07XG4gICAgICAgIGNvbnN0IGxzY2FsZSA9IG5vZGVEYXRhLnNjYWxlPy52YWx1ZSB8fCBub2RlRGF0YS5sc2NhbGU/LnZhbHVlIHx8IG5vZGVEYXRhLl9sc2NhbGUgfHwgeyB4OiAxLCB5OiAxLCB6OiAxIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuTm9kZVwiLCBcIl9uYW1lXCI6IG5hbWUsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwiX3BhcmVudFwiOiBwYXJlbnROb2RlSW5kZXggIT09IG51bGwgPyB7IFwiX19pZF9fXCI6IHBhcmVudE5vZGVJbmRleCB9IDogbnVsbCxcbiAgICAgICAgICAgIFwiX2NoaWxkcmVuXCI6IFtdLCBcIl9hY3RpdmVcIjogbm9kZURhdGEuYWN0aXZlICE9PSBmYWxzZSwgXCJfY29tcG9uZW50c1wiOiBbXSwgXCJfcHJlZmFiXCI6IG51bGwsXG4gICAgICAgICAgICBcIl9scG9zXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGxwb3MueCB8fCAwLCBcInlcIjogbHBvcy55IHx8IDAsIFwielwiOiBscG9zLnogfHwgMCB9LFxuICAgICAgICAgICAgXCJfbHJvdFwiOiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBscm90LnggfHwgMCwgXCJ5XCI6IGxyb3QueSB8fCAwLCBcInpcIjogbHJvdC56IHx8IDAsIFwid1wiOiBscm90LncgIT09IHVuZGVmaW5lZCA/IGxyb3QudyA6IDEgfSxcbiAgICAgICAgICAgIFwiX2xzY2FsZVwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBsc2NhbGUueCAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnggOiAxLCBcInlcIjogbHNjYWxlLnkgIT09IHVuZGVmaW5lZCA/IGxzY2FsZS55IDogMSwgXCJ6XCI6IGxzY2FsZS56ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueiA6IDEgfSxcbiAgICAgICAgICAgIFwiX21vYmlsaXR5XCI6IDAsIFwiX2xheWVyXCI6IDEwNzM3NDE4MjQsIFwiX2V1bGVyXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IDAsIFwieVwiOiAwLCBcInpcIjogMCB9LCBcIl9pZFwiOiBcIlwiXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VyaWFsaXplIG9uZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBUaGUgY2FwdHVyZWQgZHVtcCBpcyB0aGUgc291cmNlIG9mIHRydXRoIGZvciBldmVyeSBjb21wb25lbnQgdHlwZS4gVGhlIHBlci10eXBlXG4gICAgICogdGFibGVzIGJlbG93IG9ubHkgZmlsbCBpbiBrZXlzIHRoZSBkdW1wIGRpZCBub3QgY2Fycnkg4oCUIHRoZXkgdXNlZCB0byBydW4gKmluc3RlYWQqXG4gICAgICogb2YgdGhlIGR1bXAsIHdoaWNoIHNpbGVudGx5IHdyb3RlIGVuZ2luZSBkZWZhdWx0cyBmb3IgYGNjLlVJVHJhbnNmb3JtYCxcbiAgICAgKiBgY2MuU3ByaXRlYCwgYGNjLkJ1dHRvbmAgYW5kIGBjYy5MYWJlbGAsIGFuZCB3cm90ZSBub3RoaW5nIGF0IGFsbCBmb3IgZXZlcnkgb3RoZXJcbiAgICAgKiB0eXBlICgjMjgpLlxuICAgICAqL1xuICAgIHByaXZhdGUgY3JlYXRlQ29tcG9uZW50T2JqZWN0KGNvbXBvbmVudERhdGE6IGFueSwgbm9kZUluZGV4OiBudW1iZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gY29tcG9uZW50RGF0YS50eXBlIHx8IGNvbXBvbmVudERhdGEuX190eXBlX18gfHwgJ2NjLkNvbXBvbmVudCc7XG4gICAgICAgIGNvbnN0IGVuYWJsZWQgPSBjb21wb25lbnREYXRhLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXBvbmVudERhdGEuZW5hYmxlZCA6IHRydWU7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudDogYW55ID0ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBjb21wb25lbnRUeXBlLCBcIl9uYW1lXCI6IFwiXCIsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwibm9kZVwiOiB7IFwiX19pZF9fXCI6IG5vZGVJbmRleCB9LCBcIl9lbmFibGVkXCI6IGVuYWJsZWQsIFwiX19wcmVmYWJcIjogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBjb21wb25lbnREYXRhLnByb3BlcnRpZXMgfHwge307XG4gICAgICAgIGNvbnN0IHJlbmFtZXMgPSBEVU1QX0tFWV9SRU5BTUVTW2NvbXBvbmVudFR5cGVdIHx8IHt9O1xuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHByb3BlcnRpZXMpKSB7XG4gICAgICAgICAgICBpZiAoRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrZXkpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IHByb3BWYWx1ZSA9IHRoaXMucHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KHZhbHVlLCBjb250ZXh0KTtcbiAgICAgICAgICAgIGlmIChwcm9wVmFsdWUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50W3JlbmFtZXNba2V5XSB8fCBrZXldID0gcHJvcFZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBmYWxsYmFja10gb2YgT2JqZWN0LmVudHJpZXMoQ09NUE9ORU5UX0RFRkFVTFRTW2NvbXBvbmVudFR5cGVdIHx8IHt9KSkge1xuICAgICAgICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29tcG9uZW50LCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50W2tleV0gPSB0eXBlb2YgZmFsbGJhY2sgPT09ICdvYmplY3QnICYmIGZhbGxiYWNrICE9PSBudWxsID8gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShmYWxsYmFjaykpIDogZmFsbGJhY2s7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQSBidXR0b24gd2l0aCBubyBjYXB0dXJlZCB0YXJnZXQgcG9pbnRzIGF0IGl0cyBvd24gbm9kZSwgbWF0Y2hpbmcgZWRpdG9yIGJlaGF2aW91ci5cbiAgICAgICAgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5CdXR0b24nICYmIGNvbXBvbmVudC5fdGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5fdGFyZ2V0ID0geyBcIl9faWRfX1wiOiBub2RlSW5kZXggfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVuc3VyZSBfaWQgaXMgbGFzdCAobWF0Y2hlcyBlbmdpbmUgc2VyaWFsaXphdGlvbiBvcmRlcilcbiAgICAgICAgY29uc3QgX2lkID0gY29tcG9uZW50Ll9pZCB8fCBcIlwiO1xuICAgICAgICBkZWxldGUgY29tcG9uZW50Ll9pZDtcbiAgICAgICAgY29tcG9uZW50Ll9pZCA9IF9pZDtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3VudCB0aGUgZHVtcCBlbnRyaWVzIHRoYXQgd291bGQgYWN0dWFsbHkgYmUgc2VyaWFsaXplZCwgc28gdGhlIHBvc3Qtd3JpdGUgY2hlY2tcbiAgICAgKiBvbmx5IGRlbWFuZHMgcHJvcGVydGllcyBmb3IgY29tcG9uZW50cyB0aGF0IGhhZCBzb21lLlxuICAgICAqL1xuICAgIHByaXZhdGUgY291bnRTZXJpYWxpemFibGVQcm9wcyhwcm9wZXJ0aWVzOiBhbnkpOiBudW1iZXIge1xuICAgICAgICBpZiAoIXByb3BlcnRpZXMgfHwgdHlwZW9mIHByb3BlcnRpZXMgIT09ICdvYmplY3QnKSByZXR1cm4gMDtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZpbHRlcihrID0+ICFEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQuaGFzKGspKS5sZW5ndGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0IGNvbXBvbmVudCB0eXBlcyB0aGF0IGNhcnJpZWQgbGl2ZSBwcm9wZXJ0aWVzIGluIHRoZSBzY2VuZSBidXQgc2VyaWFsaXplZCB0b1xuICAgICAqIG5vdGhpbmcgYnV0IHRoZSBiYXNlIGVudmVsb3BlLiBgYWN0aW9uPWNyZWF0ZWAgcHJldmlvdXNseSByZXBvcnRlZCBzdWNjZXNzIGluXG4gICAgICogZXhhY3RseSB0aGF0IHN0YXRlICgjMjgpLlxuICAgICAqL1xuICAgIHByaXZhdGUgZmluZENvbXBvbmVudHNUaGF0TG9zdFByb3BlcnRpZXMocHJlZmFiRGF0YTogYW55W10sIG5vZGVEYXRhOiBhbnkpOiBzdHJpbmdbXSB7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcCBvZiAobm9kZS5jb21wb25lbnRzIHx8IFtdKSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvdW50U2VyaWFsaXphYmxlUHJvcHMoY29tcD8ucHJvcGVydGllcykgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkLmFkZChjb21wLnR5cGUgfHwgY29tcC5fX3R5cGVfXyB8fCAnVW5rbm93bicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgKG5vZGUuY2hpbGRyZW4gfHwgW10pKSB3YWxrKGNoaWxkKTtcbiAgICAgICAgfTtcbiAgICAgICAgd2Fsayhub2RlRGF0YSk7XG4gICAgICAgIGlmIChleHBlY3RlZC5zaXplID09PSAwKSByZXR1cm4gW107XG5cbiAgICAgICAgY29uc3QgcG9wdWxhdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcHJlZmFiRGF0YSkge1xuICAgICAgICAgICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkgIT09ICdvYmplY3QnIHx8ICFleHBlY3RlZC5oYXMoZW50cnkuX190eXBlX18pKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhlbnRyeSkuc29tZShrZXkgPT4gIUJBU0VfQ09NUE9ORU5UX0tFWVMuaGFzKGtleSkpKSBwb3B1bGF0ZWQuYWRkKGVudHJ5Ll9fdHlwZV9fKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy4uLmV4cGVjdGVkXS5maWx0ZXIodHlwZSA9PiAhcG9wdWxhdGVkLmhhcyh0eXBlKSk7XG4gICAgfVxuXG4gICAgLyoqIFJlLXJlYWQgdGhlIHdyaXR0ZW4gcHJlZmFiOyBmYWxscyBiYWNrIHRvIHRoZSBpbi1tZW1vcnkgY29udGVudCB3aGVuIHRoZSBwYXRoIGlzIHVucmVzb2x2YWJsZS4gKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlYWRCYWNrUHJlZmFiKHNhdmVQYXRoOiBzdHJpbmcsIGZhbGxiYWNrOiBhbnlbXSk6IFByb21pc2U8eyBkYXRhOiBhbnlbXTsgc291cmNlOiAnZGlzaycgfCAnaW4tbWVtb3J5JyB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldChzYXZlUGF0aCk7XG4gICAgICAgICAgICBpZiAocmVzb2x2ZWQuZmlsZVBhdGgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhcnNlZCkpIHJldHVybiB7IGRhdGE6IHBhcnNlZCwgc291cmNlOiAnZGlzaycgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gdGhlIGluLW1lbW9yeSBjb250ZW50XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgZGF0YTogZmFsbGJhY2ssIHNvdXJjZTogJ2luLW1lbW9yeScgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZXMsIGVuc3VyaW5nIGZvcm1hdCBtYXRjaGVzIG1hbnVhbGx5LWNyZWF0ZWQgcHJlZmFicy5cbiAgICAgKiBIYW5kbGVzIG5vZGUgcmVmcywgYXNzZXQgcmVmcywgY29tcG9uZW50IHJlZnMsIHR5cGVkIG1hdGgvY29sb3Igb2JqZWN0cywgYW5kIGFycmF5cy5cbiAgICAgKi9cbiAgICBwcml2YXRlIHByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShwcm9wRGF0YTogYW55LCBjb250ZXh0Pzoge1xuICAgICAgICBub2RlVXVpZFRvSW5kZXg/OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgICAgICBjb21wb25lbnRVdWlkVG9JbmRleD86IE1hcDxzdHJpbmcsIG51bWJlcj47XG4gICAgfSk6IGFueSB7XG4gICAgICAgIGlmICghcHJvcERhdGEgfHwgdHlwZW9mIHByb3BEYXRhICE9PSAnb2JqZWN0JykgcmV0dXJuIHByb3BEYXRhO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3BEYXRhLnZhbHVlO1xuICAgICAgICBjb25zdCB0eXBlID0gcHJvcERhdGEudHlwZTtcbiAgICAgICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS51dWlkID09PSAnJykgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgLy8gTm9kZSByZWZlcmVuY2VzXG4gICAgICAgIGlmICh0eXBlID09PSAnY2MuTm9kZScgJiYgdmFsdWU/LnV1aWQpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0Py5ub2RlVXVpZFRvSW5kZXg/Lmhhcyh2YWx1ZS51dWlkKSkgcmV0dXJuIHsgXCJfX2lkX19cIjogY29udGV4dC5ub2RlVXVpZFRvSW5kZXguZ2V0KHZhbHVlLnV1aWQpIH07XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYE5vZGUgcmVmIFVVSUQgJHt2YWx1ZS51dWlkfSBub3QgaW4gcHJlZmFiIGNvbnRleHQgKGV4dGVybmFsKSwgc2V0dGluZyBudWxsYCk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzc2V0IHJlZmVyZW5jZXNcbiAgICAgICAgaWYgKHZhbHVlPy51dWlkICYmIFsnY2MuUHJlZmFiJywgJ2NjLlRleHR1cmUyRCcsICdjYy5TcHJpdGVGcmFtZScsICdjYy5NYXRlcmlhbCcsICdjYy5BbmltYXRpb25DbGlwJywgJ2NjLkF1ZGlvQ2xpcCcsICdjYy5Gb250JywgJ2NjLkFzc2V0J10uaW5jbHVkZXModHlwZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IHV1aWRUb1VzZSA9IHR5cGUgPT09ICdjYy5QcmVmYWInID8gdmFsdWUudXVpZCA6IHRoaXMudXVpZFRvQ29tcHJlc3NlZElkKHZhbHVlLnV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgXCJfX3V1aWRfX1wiOiB1dWlkVG9Vc2UsIFwiX19leHBlY3RlZFR5cGVfX1wiOiB0eXBlIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDb21wb25lbnQgcmVmZXJlbmNlc1xuICAgICAgICBpZiAodmFsdWU/LnV1aWQgJiYgKHR5cGUgPT09ICdjYy5Db21wb25lbnQnIHx8IHR5cGUgPT09ICdjYy5MYWJlbCcgfHwgdHlwZSA9PT0gJ2NjLkJ1dHRvbicgfHwgdHlwZSA9PT0gJ2NjLlNwcml0ZScgfHxcbiAgICAgICAgICAgIHR5cGUgPT09ICdjYy5VSVRyYW5zZm9ybScgfHwgdHlwZSA9PT0gJ2NjLlJpZ2lkQm9keTJEJyB8fCB0eXBlID09PSAnY2MuQm94Q29sbGlkZXIyRCcgfHxcbiAgICAgICAgICAgIHR5cGUgPT09ICdjYy5BbmltYXRpb24nIHx8IHR5cGUgPT09ICdjYy5BdWRpb1NvdXJjZScgfHwgKHR5cGU/LnN0YXJ0c1dpdGgoJ2NjLicpICYmICF0eXBlLmluY2x1ZGVzKCdAJykpKSkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQ/LmNvbXBvbmVudFV1aWRUb0luZGV4Py5oYXModmFsdWUudXVpZCkpIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguZ2V0KHZhbHVlLnV1aWQpIH07XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYENvbXBvbmVudCByZWYgJHt0eXBlfSBVVUlEICR7dmFsdWUudXVpZH0gbm90IGluIHByZWZhYiBjb250ZXh0IChleHRlcm5hbCksIHNldHRpbmcgbnVsbGApO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUeXBlZCBtYXRoL2NvbG9yIG9iamVjdHNcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuQ29sb3InKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLnIpIHx8IDApKSwgXCJnXCI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmcpIHx8IDApKSwgXCJiXCI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmIpIHx8IDApKSwgXCJhXCI6IHZhbHVlLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmEpKSkgOiAyNTUgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuVmVjMycpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwLCBcInpcIjogTnVtYmVyKHZhbHVlLnopIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuVmVjMicpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlNpemUnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuU2l6ZVwiLCBcIndpZHRoXCI6IE51bWJlcih2YWx1ZS53aWR0aCkgfHwgMCwgXCJoZWlnaHRcIjogTnVtYmVyKHZhbHVlLmhlaWdodCkgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5RdWF0JykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlF1YXRcIiwgXCJ4XCI6IE51bWJlcih2YWx1ZS54KSB8fCAwLCBcInlcIjogTnVtYmVyKHZhbHVlLnkpIHx8IDAsIFwielwiOiBOdW1iZXIodmFsdWUueikgfHwgMCwgXCJ3XCI6IHZhbHVlLncgIT09IHVuZGVmaW5lZCA/IE51bWJlcih2YWx1ZS53KSA6IDEgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFycmF5IHByb3BlcnRpZXNcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBpZiAocHJvcERhdGEuZWxlbWVudFR5cGVEYXRhPy50eXBlID09PSAnY2MuTm9kZScpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW0/LnV1aWQgJiYgY29udGV4dD8ubm9kZVV1aWRUb0luZGV4Py5oYXMoaXRlbS51dWlkKSkgcmV0dXJuIHsgXCJfX2lkX19cIjogY29udGV4dC5ub2RlVXVpZFRvSW5kZXguZ2V0KGl0ZW0udXVpZCkgfTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfSkuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHByb3BEYXRhLmVsZW1lbnRUeXBlRGF0YT8udHlwZT8uc3RhcnRzV2l0aCgnY2MuJykpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0/LnV1aWQgPyB7IFwiX191dWlkX19cIjogdGhpcy51dWlkVG9Db21wcmVzc2VkSWQoaXRlbS51dWlkKSwgXCJfX2V4cGVjdGVkVHlwZV9fXCI6IHByb3BEYXRhLmVsZW1lbnRUeXBlRGF0YS50eXBlIH0gOiBudWxsKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IGl0ZW0/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBpdGVtLnZhbHVlIDogaXRlbSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOZXN0ZWQgQ0NDbGFzcyBncm91cDogdGhlIGR1bXAgbmVzdHMgYW5vdGhlciBkZXNjcmlwdG9yIG1hcCB1bmRlciBgdmFsdWVgLlxuICAgICAgICAvLyBTZXJpYWxpemluZyBpdCB2ZXJiYXRpbSB3b3VsZCB3cml0ZSBlZGl0b3IgZGVzY3JpcHRvcnMgKHtuYW1lLCB2YWx1ZSwgdHlwZX0pXG4gICAgICAgIC8vIGludG8gdGhlIGFzc2V0IGluc3RlYWQgb2YgdGhlIHZhbHVlcyB0aGVtc2VsdmVzLlxuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdGhpcy5pc05lc3RlZFByb3BlcnR5TWFwKHZhbHVlKSkge1xuICAgICAgICAgICAgY29uc3QgbmVzdGVkOiBhbnkgPSB0eXBlID8geyBcIl9fdHlwZV9fXCI6IHR5cGUgfSA6IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRC5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgbmVzdGVkVmFsdWUgPSB0aGlzLnByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShlbnRyeSwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgaWYgKG5lc3RlZFZhbHVlICE9PSB1bmRlZmluZWQpIG5lc3RlZFtrZXldID0gbmVzdGVkVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3RoZXIgY29tcGxleCB0eXBlZCBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHR5cGU/LnN0YXJ0c1dpdGgoJ2NjLicpKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IHR5cGUsIC4uLnZhbHVlIH07XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGV2ZXJ5IGVudHJ5IGlzIGFuIG9iamVjdCBhbmQgYXQgbGVhc3Qgb25lIGlzIGEgQ29jb3MgcHJvcGVydHkgZGVzY3JpcHRvci4gKi9cbiAgICBwcml2YXRlIGlzTmVzdGVkUHJvcGVydHlNYXAodmFsdWU6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHZhbHVlKTtcbiAgICAgICAgaWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBlbnRyaWVzLmV2ZXJ5KChbLCBlbnRyeV0pID0+IGVudHJ5ICE9PSBudWxsICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcpXG4gICAgICAgICAgICAmJiBlbnRyaWVzLnNvbWUoKFssIGVudHJ5XSkgPT4gaXNQcm9wZXJ0eURlc2NyaXB0b3IoZW50cnkpKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBBc3NldCBEQiBvcGVyYXRpb25zID09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJSZWY6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2Nvbm5lY3QtcHJlZmFiLWluc3RhbmNlJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJlZmFiLWNvbm5lY3Rpb24nLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlJlZiB9KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYi1saW5rJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSlcbiAgICAgICAgXTtcbiAgICAgICAgZm9yIChjb25zdCBtZXRob2Qgb2YgbWV0aG9kcykge1xuICAgICAgICAgICAgdHJ5IHsgYXdhaXQgbWV0aG9kKCk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfSBjYXRjaCB7IC8qIHRyeSBuZXh0ICovIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBbGwgcHJlZmFiIGNvbm5lY3Rpb24gbWV0aG9kcyBmYWlsZWQnIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlUHJlZmFiV2l0aE1ldGEocHJlZmFiUGF0aDogc3RyaW5nLCBwcmVmYWJEYXRhOiBhbnlbXSwgbWV0YURhdGE6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVBc3NldEZpbGUocHJlZmFiUGF0aCwgSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlQXNzZXRGaWxlKGAke3ByZWZhYlBhdGh9Lm1ldGFgLCBKU09OLnN0cmluZ2lmeShtZXRhRGF0YSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBzYXZlIHByZWZhYiBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXRGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBtZXRob2RzID0gW1xuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpLFxuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3dyaXRlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgbWV0aG9kIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIHRyeSB7IGF3YWl0IG1ldGhvZCgpOyByZXR1cm47IH0gY2F0Y2ggeyAvKiB0cnkgbmV4dCAqLyB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgc2F2ZSBtZXRob2RzIGZhaWxlZCcpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgYXNzZXRQYXRoLCBjb250ZW50LCB7IG92ZXJ3cml0ZTogdHJ1ZSwgcmVuYW1lOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGFzc2V0SW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgYXNzZXQgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlTWV0YVdpdGhBc3NldERCKGFzc2V0UGF0aDogc3RyaW5nLCBtZXRhQ29udGVudDogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldC1tZXRhJywgYXNzZXRQYXRoLCBKU09OLnN0cmluZ2lmeShtZXRhQ29udGVudCwgbnVsbCwgMikpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogYXNzZXRJbmZvIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBtZXRhIGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlaW1wb3J0QXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHJlc3VsdCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byByZWltcG9ydCBhc3NldCcgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlQXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIGFzc2V0UGF0aCwgY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gdXBkYXRlIGFzc2V0IGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA9PT09PSBGb3JtYXQgdmFsaWRhdGlvbiA9PT09PVxuXG4gICAgdmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YTogYW55KTogeyBpc1ZhbGlkOiBib29sZWFuOyBpc3N1ZXM6IHN0cmluZ1tdOyBub2RlQ291bnQ6IG51bWJlcjsgY29tcG9uZW50Q291bnQ6IG51bWJlciB9IHtcbiAgICAgICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBsZXQgbm9kZUNvdW50ID0gMDtcbiAgICAgICAgbGV0IGNvbXBvbmVudENvdW50ID0gMDtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcmVmYWJEYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goJ1ByZWZhYiBkYXRhIGlzIGVtcHR5Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBmYWxzZSwgaXNzdWVzLCBub2RlQ291bnQsIGNvbXBvbmVudENvdW50IH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFwcmVmYWJEYXRhWzBdIHx8IHByZWZhYkRhdGFbMF0uX190eXBlX18gIT09ICdjYy5QcmVmYWInKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnRmlyc3QgZWxlbWVudCBtdXN0IGJlIGNjLlByZWZhYiB0eXBlJyk7XG4gICAgICAgIH1cbiAgICAgICAgcHJlZmFiRGF0YS5mb3JFYWNoKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtLl9fdHlwZV9fID09PSAnY2MuTm9kZScpIG5vZGVDb3VudCsrO1xuICAgICAgICAgICAgZWxzZSBpZiAoaXRlbS5fX3R5cGVfXyAmJiBpdGVtLl9fdHlwZV9fLmluY2x1ZGVzKCdjYy4nKSkgY29tcG9uZW50Q291bnQrKztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChub2RlQ291bnQgPT09IDApIGlzc3Vlcy5wdXNoKCdQcmVmYWIgbXVzdCBjb250YWluIGF0IGxlYXN0IG9uZSBub2RlJyk7XG4gICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGlzc3Vlcy5sZW5ndGggPT09IDAsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCB9O1xuICAgIH1cblxuICAgIGNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICByZXR1cm4geyBcInZlclwiOiBcIjEuMS41MFwiLCBcImltcG9ydGVyXCI6IFwicHJlZmFiXCIsIFwiaW1wb3J0ZWRcIjogdHJ1ZSwgXCJ1dWlkXCI6IHByZWZhYlV1aWQsIFwiZmlsZXNcIjogW1wiLmpzb25cIl0sIFwic3ViTWV0YXNcIjoge30sIFwidXNlckRhdGFcIjogeyBcInN5bmNOb2RlTmFtZVwiOiBwcmVmYWJOYW1lIH0gfTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBVVUlEIHV0aWxpdGllcyA9PT09PVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVVVSUQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgY2hhcnMgPSAnMDEyMzQ1Njc4OWFiY2RlZic7XG4gICAgICAgIGxldCB1dWlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDggfHwgaSA9PT0gMTIgfHwgaSA9PT0gMTYgfHwgaSA9PT0gMjApIHV1aWQgKz0gJy0nO1xuICAgICAgICAgICAgdXVpZCArPSBjaGFyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFycy5sZW5ndGgpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlRmlsZUlkKCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNoYXJzID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5Ky8nO1xuICAgICAgICBsZXQgZmlsZUlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjI7IGkrKykgZmlsZUlkICs9IGNoYXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJzLmxlbmd0aCldO1xuICAgICAgICByZXR1cm4gZmlsZUlkO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnQgVVVJRCB0byBDb2NvcyBDcmVhdG9yIGNvbXByZXNzZWQgZm9ybWF0LlxuICAgICAqIEZpcnN0IDUgaGV4IGNoYXJzIGtlcHQgYXMtaXM7IHJlbWFpbmluZyAyNyBjaGFycyBjb21wcmVzc2VkIHRvIDE4IHZpYSBiYXNlNjQgZW5jb2RpbmcuXG4gICAgICovXG4gICAgcHJpdmF0ZSB1dWlkVG9Db21wcmVzc2VkSWQodXVpZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgQkFTRTY0X0tFWVMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuICAgICAgICBjb25zdCBjbGVhblV1aWQgPSB1dWlkLnJlcGxhY2UoLy0vZywgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChjbGVhblV1aWQubGVuZ3RoICE9PSAzMikgcmV0dXJuIHV1aWQ7XG4gICAgICAgIGxldCByZXN1bHQgPSBjbGVhblV1aWQuc3Vic3RyaW5nKDAsIDUpO1xuICAgICAgICBjb25zdCByZW1haW5kZXIgPSBjbGVhblV1aWQuc3Vic3RyaW5nKDUpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbWFpbmRlci5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBwYXJzZUludCgocmVtYWluZGVyW2ldIHx8ICcwJykgKyAocmVtYWluZGVyW2kgKyAxXSB8fCAnMCcpICsgKHJlbWFpbmRlcltpICsgMl0gfHwgJzAnKSwgMTYpO1xuICAgICAgICAgICAgcmVzdWx0ICs9IEJBU0U2NF9LRVlTWyh2YWx1ZSA+PiA2KSAmIDYzXSArIEJBU0U2NF9LRVlTW3ZhbHVlICYgNjNdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxufVxuIl19