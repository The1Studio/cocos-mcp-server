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
exports.findAccessorTwinKeys = findAccessorTwinKeys;
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
/** True when a serialized component key is an engine accessor with a `_`-prefixed twin. */
function isEngineType(componentType) {
    return /^(cc|sp|dragonBones)\./.test(componentType);
}
/**
 * Find the accessor keys a dump carries alongside their `_`-prefixed serialized twin.
 *
 * Issue #114 defect 2. A `scene:query-node` dump carries BOTH spellings of an
 * accessor-backed engine field — the inspector accessor (`clips`, `defaultClip`,
 * `sharedMaterials`) and the true serialized field (`_clips`, `_defaultClip`,
 * `_materials`). `createComponentObject` emitted every dump key verbatim unless the type
 * was in `DUMP_KEY_RENAMES`, so a `cc.Animation` component (absent from the table) wrote
 * `clips` AND `_clips` as separate top-level keys with diverging values, and the asset
 * importer rejected the prefab outright:
 *
 *     [Assets] Cannot read properties of undefined (reading '_name')  TypeError
 *
 * The originating report pinned the repair empirically: stripping every non-underscore key
 * that has an underscore twin reproduced the key set of a hand-authored prefab, which
 * imported cleanly.
 *
 * This is type-AGNOSTIC on purpose. A table that must be extended per confirmed mismatch
 * always lags the engine; the twin invariant cannot, and it is statically detectable —
 * which the table's own docstring previously denied.
 *
 * Scoped to ENGINE types. A script may legitimately declare both `foo` and `_foo` as
 * distinct `@property` fields, and dropping one there would be data loss rather than a
 * repair, so script components are never touched.
 */
function findAccessorTwinKeys(componentType, properties) {
    if (!isEngineType(componentType))
        return [];
    return Object.keys(properties).filter(key => !key.startsWith('_') && Object.prototype.hasOwnProperty.call(properties, `_${key}`));
}
/**
 * Keys whose serialized field name differs (accessor-backed engine properties).
 *
 * Verified only for these four types — every other engine `cc.*`/`sp.*`/`dragonBones.*`
 * component falls through to the generic branch below, which emits the dump key
 * VERBATIM. For most engine types the dump key already matches the serialized key
 * (e.g. `cc.ParticleSystem2D`'s `emissionRate`), but an accessor-backed field on a type
 * not listed here would serialize under the WRONG key rather than being dropped.
 *
 * Extend this table as specific mismatches are confirmed against a running Cocos Creator
 * 3.8.7 instance — but note that `findAccessorTwinKeys` below is the type-agnostic net
 * underneath it: where the dump carries BOTH spellings, the twin is dropped rather than
 * requiring a table entry, so a type this table has never heard of still serializes
 * importable. The table remains necessary for the case the net cannot see — an
 * accessor-only key with no serialized twin present in the same dump.
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
            // Defense-in-depth for #114 defect 2. `validatePrefabFormat(prefabContent)` alone
            // would be a shape check that can never fail: it runs `findAccessorTwinKeys` over
            // output that `createComponentObject` already ran the SAME predicate over, so a
            // duplicate reaching here is impossible by construction (verified — neutering this
            // branch left every test green). The genuine invariant is a DIFFERENCE one: every
            // accessor twin the CAPTURED scene dump carries must be absent from what we are
            // about to write. That fires even if the emission filter is removed, mis-typed, or
            // the dump shape changes under it, because it does not re-ask the filter's question.
            const capturedTwins = this.findCapturedAccessorTwins(nodeData, prefabContent);
            if (capturedTwins.length > 0) {
                const named = capturedTwins
                    .map(d => `${d.type} (${d.keys.map(k => `'${k}'/'_${k}'`).join(', ')})`)
                    .join('; ');
                return {
                    success: false,
                    fatal: true,
                    error: `Refusing to write ${savePath}: the scene carried an accessor key alongside its ` +
                        `underscore twin and it survived into the prefab — ${named}. Cocos Creator's asset ` +
                        `importer rejects this shape ("Cannot read properties of undefined (reading '_name')"), ` +
                        `so the prefab would be unloadable, yet the caller would have been told it was created ` +
                        `(issue #114 defect 2).`,
                    data: { prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName, duplicateAccessorKeys: capturedTwins }
                };
            }
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
        // Drop every accessor key that has its serialized twin right there in the same dump
        // (#114 defect 2). The underscore spelling is the one the engine reads back; keeping
        // both is what made the importer reject the file. Computed once, up front, so the
        // rename-table branches below cannot reintroduce a key this removed.
        const accessorTwins = new Set(findAccessorTwinKeys(componentType, properties));
        for (const [key, value] of Object.entries(properties)) {
            if (DUMP_KEYS_NOT_SERIALIZED.has(key))
                continue;
            if (accessorTwins.has(key))
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
    /**
     * Accessor twins the CAPTURED scene dump carried that survived into the emitted prefab.
     *
     * This is the real #114-defect-2 invariant, and it is deliberately a DIFFERENCE check
     * rather than a re-run of the emission filter's own predicate. Asking
     * `findAccessorTwinKeys` about `prefabContent` would re-ask the question the filter just
     * answered and so could never fail (see the call site — neutering that branch leaves
     * every test green); comparing capture against output fails whenever the filter is
     * removed, mis-scoped, or the dump shape changes under it.
     *
     * Per-node component counts are compared positionally instead of by uuid, because a node
     * can hold several components of the same type with no uuid distinguishable at this
     * level. The counts come from the same walks the serializer uses (`components` and
     * `properties`), so they always agree with what `createComponentObject` saw; only the
     * shape-dependent details differ, and those are ignored rather than guessed at.
     *
     * Pure and exported so both directions are unit-testable: it must fire when an accessor
     * key is written beside its twin, and stay silent on the repaired shape.
     */
    findCapturedAccessorTwins(nodeData, prefabData) {
        const captured = [];
        const walk = (node) => {
            if (!node)
                return;
            for (const comp of (node.components || [])) {
                const componentType = (comp === null || comp === void 0 ? void 0 : comp.type) || (comp === null || comp === void 0 ? void 0 : comp.__type__) || 'Unknown';
                const properties = (comp === null || comp === void 0 ? void 0 : comp.properties) || {};
                const keys = findAccessorTwinKeys(componentType, properties);
                if (keys.length > 0)
                    captured.push({ type: componentType, keys });
            }
            for (const child of (node.children || []))
                walk(child);
        };
        walk(nodeData);
        if (captured.length === 0)
            return [];
        // The prefab entries for node 0 onward, skipping the leading cc.Prefab asset record
        // (and any leading null slots), are the serialized nodes in walk order.
        const nodeEntries = prefabData.filter(entry => entry && typeof entry === 'object' && entry.__type__ !== 'cc.Prefab' && Array.isArray(entry._components));
        const survived = [];
        let cursor = 0;
        const check = (node) => {
            var _a, _b;
            if (!node)
                return;
            const componentCount = Array.isArray(node.components) ? node.components.length : 0;
            const entry = nodeEntries[cursor++];
            const emitted = (entry && Array.isArray(entry._components))
                ? entry._components.map((ref) => prefabData[ref === null || ref === void 0 ? void 0 : ref.__id__]).filter(Boolean)
                : [];
            for (let i = 0; i < componentCount; i++) {
                const componentType = ((_a = node.components[i]) === null || _a === void 0 ? void 0 : _a.type) || ((_b = node.components[i]) === null || _b === void 0 ? void 0 : _b.__type__) || 'Unknown';
                const keys = findAccessorTwinKeys(componentType, emitted[i] && typeof emitted[i] === 'object' ? emitted[i] : {});
                if (keys.length > 0)
                    survived.push({ type: componentType, keys });
            }
            for (const child of (node.children || []))
                check(child);
        };
        check(nodeData);
        // Report the captured set, narrowed to the twin names actually observed surviving so
        // the message names the real leak rather than restating what the dump held.
        return captured.filter(cap => survived.some(surv => surv.type === cap.type && surv.keys.some(k => cap.keys.includes(k))));
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
        const duplicateAccessorKeys = [];
        let nodeCount = 0;
        let componentCount = 0;
        if (!Array.isArray(prefabData)) {
            issues.push('Prefab data must be an array');
            return { isValid: false, issues, nodeCount, componentCount, hollowComponents, duplicateAccessorKeys };
        }
        if (prefabData.length === 0) {
            issues.push('Prefab data is empty');
            return { isValid: false, issues, nodeCount, componentCount, hollowComponents, duplicateAccessorKeys };
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
                // An accessor key sitting beside its serialized `_`-twin is a prefab the
                // importer rejects (#114 defect 2). Checked here because `action=validate`
                // reported `isValid: true` on the broken file both before AND after the
                // report's manual repair, so it caught nothing about this class.
                const twins = findAccessorTwinKeys(String(item.__type__), item);
                if (twins.length > 0) {
                    duplicateAccessorKeys.push({ type: String(item.__type__), keys: twins });
                }
            }
        });
        if (nodeCount === 0)
            issues.push('Prefab must contain at least one node');
        for (const hollow of [...new Set(hollowComponents)]) {
            issues.push(`Component '${hollow}' serialized with no properties — it carries none of the scene values it had (issues #28/#73)`);
        }
        for (const dup of duplicateAccessorKeys) {
            issues.push(`Component '${dup.type}' serializes both an accessor key and its underscore twin ` +
                `(${dup.keys.map(k => `'${k}'/'_${k}'`).join(', ')}) — the asset importer rejects this ` +
                `shape with "Cannot read properties of undefined (reading '_name')" (issue #114).`);
        }
        return { isValid: issues.length === 0, issues, nodeCount, componentCount, hollowComponents, duplicateAccessorKeys };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFtRUEsb0RBS0M7QUF4RUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsdUNBQXlCO0FBQ3pCLG9EQUFtRDtBQUNuRCwyRkFBbUY7QUFFbkY7Ozs7O0dBS0c7QUFDSCxTQUFTLG9CQUFvQixDQUFDLEtBQVU7SUFDcEMsSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM5RSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUM7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUN4RSxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsVUFBVSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pILENBQUM7QUFFRCxzRkFBc0Y7QUFDdEYsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUNyQyxNQUFNLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGVBQWU7SUFDOUQsV0FBVyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxrQkFBa0I7Q0FDMUUsQ0FBQyxDQUFDO0FBRUgsd0ZBQXdGO0FBQ3hGLE1BQU0sbUJBQW1CLEdB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QyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNoVCxJQUFJLElBQUksS0FBSyxTQUFTO2dCQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUksSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDL0csSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDakksSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUss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QUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUN2RixPQUFPLE1BQU0sQ0FBQztJQUNsQixDQUFDOztBQTU0Qkwsc0RBODRCQztBQXBrQkcsMkZBQTJGO0FBQ25FLG1DQUFhLEdBQUcsVUFBVSxBQUFiLENBQWM7QUFvTm5ELDJGQUEyRjtBQUNuRSxpQ0FBVyxHQUFHLElBQUksR0FBRyxDQUFDO0lBQzFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLGtCQUFrQjtJQUNoRixjQUFjLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZUFBZSxFQUFFLGVBQWU7SUFDckYsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxTQUFTO0lBQy9FLGFBQWEsRUFBRSxrQkFBa0IsRUFBRSxvQkFBb0IsRUFBRSxlQUFlLEVBQUUsZ0JBQWdCO0NBQzdGLENBQUMsQUFMaUMsQ0FLaEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFByZWZhYkNyZWF0aW9uU2VydmljZTogaGFuZGxlcyB0aGUgY29tcGxleCBsb2dpYyBvZiBjcmVhdGluZyBDb2NvcyBDcmVhdG9yIHByZWZhYiBmaWxlc1xuICogcHJvZ3JhbW1hdGljYWxseS4gRXh0cmFjdGVkIGZyb20gTWFuYWdlUHJlZmFiIHRvIGtlZXAgbWFuYWdlLXByZWZhYi50cyB1bmRlciAyMDAgbGluZXMuXG4gKlxuICogUmVzcG9uc2liaWxpdGllczpcbiAqIC0gRmV0Y2hpbmcgbm9kZSBkYXRhIHdpdGggY29tcG9uZW50IGluZm8gZnJvbSB0aGUgc2NlbmVcbiAqIC0gU2VyaWFsaXppbmcgbm9kZSB0cmVlcyBpbnRvIENvY29zIENyZWF0b3IgcHJlZmFiIEpTT04gZm9ybWF0XG4gKiAtIFNhdmluZyBhbmQgcmUtaW1wb3J0aW5nIGFzc2V0IGZpbGVzIHZpYSBhc3NldC1kYlxuICogLSBMaW5raW5nIHNjZW5lIG5vZGVzIHRvIG5ld2x5IGNyZWF0ZWQgcHJlZmFiIGFzc2V0c1xuICovXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyByZXNvbHZlQXNzZXQgfSBmcm9tICcuLi91dGlscy9hc3NldC1wYXRoJztcbmltcG9ydCB7IGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5cbi8qKlxuICogQSBkdW1wIGVudHJ5IGlzIGEgcHJvcGVydHkgZGVzY3JpcHRvciB3aGVuIGl0IHdyYXBzIGEgYHZhbHVlYCBhbmQgY2FycmllcyBhdCBsZWFzdCBvbmVcbiAqIGVkaXRvciBhbm5vdGF0aW9uLiBEZWxpYmVyYXRlbHkgbG9vc2VyIHRoYW4gdGhlIGluc3BlY3Rvci1zaWRlXG4gKiBgaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcmAsIHdoaWNoIHJlamVjdHMgZGVzY3JpcHRvcnMgd2hvc2UgZmllbGRzIGFyZSBhbGwgcHJpbWl0aXZlc1xuICogKGB7IG5hbWUsIHZhbHVlOiA2MCwgdHlwZTogJ051bWJlcicgfWApIGJlY2F1c2UgaXQgaXMgZ3VhcmRpbmcgYSBkaWZmZXJlbnQgY2FzZS5cbiAqL1xuZnVuY3Rpb24gaXNQcm9wZXJ0eURlc2NyaXB0b3IoZW50cnk6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KGVudHJ5KSkgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGVudHJ5LCAndmFsdWUnKSkgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiBbJ25hbWUnLCAndHlwZScsICdkaXNwbGF5TmFtZScsICdyZWFkb25seSddLnNvbWUoayA9PiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZW50cnksIGspKTtcbn1cblxuLyoqIEVkaXRvci1vbmx5IGR1bXAgZW50cmllcyB0aGF0IGhhdmUgbm8gc2VyaWFsaXplZCBjb3VudGVycGFydCBpbiBhIC5wcmVmYWIgZmlsZS4gKi9cbmNvbnN0IERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRCA9IG5ldyBTZXQoW1xuICAgICdub2RlJywgJ2VuYWJsZWQnLCAnX190eXBlX18nLCAndXVpZCcsICduYW1lJywgJ19fc2NyaXB0QXNzZXQnLFxuICAgICdfb2JqRmxhZ3MnLCAnX25hbWUnLCAnX2lkJywgJ19lbmFibGVkJywgJ19fcHJlZmFiJywgJ19fZWRpdG9yRXh0cmFzX18nXG5dKTtcblxuLyoqIFRoZSBlbnZlbG9wZSBldmVyeSBzZXJpYWxpemVkIGNvbXBvbmVudCBjYXJyaWVzIGV2ZW4gd2hlbiBpdCBob2xkcyBubyBwcm9wZXJ0aWVzLiAqL1xuY29uc3QgQkFTRV9DT01QT05FTlRfS0VZUyA9IG5ldyBTZXQoW1xuICAgICdfX3R5cGVfXycsICdfbmFtZScsICdfb2JqRmxhZ3MnLCAnX19lZGl0b3JFeHRyYXNfXycsICdub2RlJywgJ19lbmFibGVkJywgJ19fcHJlZmFiJywgJ19pZCdcbl0pO1xuXG4vKiogVHJ1ZSB3aGVuIGEgc2VyaWFsaXplZCBjb21wb25lbnQga2V5IGlzIGFuIGVuZ2luZSBhY2Nlc3NvciB3aXRoIGEgYF9gLXByZWZpeGVkIHR3aW4uICovXG5mdW5jdGlvbiBpc0VuZ2luZVR5cGUoY29tcG9uZW50VHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIC9eKGNjfHNwfGRyYWdvbkJvbmVzKVxcLi8udGVzdChjb21wb25lbnRUeXBlKTtcbn1cblxuLyoqXG4gKiBGaW5kIHRoZSBhY2Nlc3NvciBrZXlzIGEgZHVtcCBjYXJyaWVzIGFsb25nc2lkZSB0aGVpciBgX2AtcHJlZml4ZWQgc2VyaWFsaXplZCB0d2luLlxuICpcbiAqIElzc3VlICMxMTQgZGVmZWN0IDIuIEEgYHNjZW5lOnF1ZXJ5LW5vZGVgIGR1bXAgY2FycmllcyBCT1RIIHNwZWxsaW5ncyBvZiBhblxuICogYWNjZXNzb3ItYmFja2VkIGVuZ2luZSBmaWVsZCDigJQgdGhlIGluc3BlY3RvciBhY2Nlc3NvciAoYGNsaXBzYCwgYGRlZmF1bHRDbGlwYCxcbiAqIGBzaGFyZWRNYXRlcmlhbHNgKSBhbmQgdGhlIHRydWUgc2VyaWFsaXplZCBmaWVsZCAoYF9jbGlwc2AsIGBfZGVmYXVsdENsaXBgLFxuICogYF9tYXRlcmlhbHNgKS4gYGNyZWF0ZUNvbXBvbmVudE9iamVjdGAgZW1pdHRlZCBldmVyeSBkdW1wIGtleSB2ZXJiYXRpbSB1bmxlc3MgdGhlIHR5cGVcbiAqIHdhcyBpbiBgRFVNUF9LRVlfUkVOQU1FU2AsIHNvIGEgYGNjLkFuaW1hdGlvbmAgY29tcG9uZW50IChhYnNlbnQgZnJvbSB0aGUgdGFibGUpIHdyb3RlXG4gKiBgY2xpcHNgIEFORCBgX2NsaXBzYCBhcyBzZXBhcmF0ZSB0b3AtbGV2ZWwga2V5cyB3aXRoIGRpdmVyZ2luZyB2YWx1ZXMsIGFuZCB0aGUgYXNzZXRcbiAqIGltcG9ydGVyIHJlamVjdGVkIHRoZSBwcmVmYWIgb3V0cmlnaHQ6XG4gKlxuICogICAgIFtBc3NldHNdIENhbm5vdCByZWFkIHByb3BlcnRpZXMgb2YgdW5kZWZpbmVkIChyZWFkaW5nICdfbmFtZScpICBUeXBlRXJyb3JcbiAqXG4gKiBUaGUgb3JpZ2luYXRpbmcgcmVwb3J0IHBpbm5lZCB0aGUgcmVwYWlyIGVtcGlyaWNhbGx5OiBzdHJpcHBpbmcgZXZlcnkgbm9uLXVuZGVyc2NvcmUga2V5XG4gKiB0aGF0IGhhcyBhbiB1bmRlcnNjb3JlIHR3aW4gcmVwcm9kdWNlZCB0aGUga2V5IHNldCBvZiBhIGhhbmQtYXV0aG9yZWQgcHJlZmFiLCB3aGljaFxuICogaW1wb3J0ZWQgY2xlYW5seS5cbiAqXG4gKiBUaGlzIGlzIHR5cGUtQUdOT1NUSUMgb24gcHVycG9zZS4gQSB0YWJsZSB0aGF0IG11c3QgYmUgZXh0ZW5kZWQgcGVyIGNvbmZpcm1lZCBtaXNtYXRjaFxuICogYWx3YXlzIGxhZ3MgdGhlIGVuZ2luZTsgdGhlIHR3aW4gaW52YXJpYW50IGNhbm5vdCwgYW5kIGl0IGlzIHN0YXRpY2FsbHkgZGV0ZWN0YWJsZSDigJRcbiAqIHdoaWNoIHRoZSB0YWJsZSdzIG93biBkb2NzdHJpbmcgcHJldmlvdXNseSBkZW5pZWQuXG4gKlxuICogU2NvcGVkIHRvIEVOR0lORSB0eXBlcy4gQSBzY3JpcHQgbWF5IGxlZ2l0aW1hdGVseSBkZWNsYXJlIGJvdGggYGZvb2AgYW5kIGBfZm9vYCBhc1xuICogZGlzdGluY3QgYEBwcm9wZXJ0eWAgZmllbGRzLCBhbmQgZHJvcHBpbmcgb25lIHRoZXJlIHdvdWxkIGJlIGRhdGEgbG9zcyByYXRoZXIgdGhhbiBhXG4gKiByZXBhaXIsIHNvIHNjcmlwdCBjb21wb25lbnRzIGFyZSBuZXZlciB0b3VjaGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZEFjY2Vzc29yVHdpbktleXMoY29tcG9uZW50VHlwZTogc3RyaW5nLCBwcm9wZXJ0aWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogc3RyaW5nW10ge1xuICAgIGlmICghaXNFbmdpbmVUeXBlKGNvbXBvbmVudFR5cGUpKSByZXR1cm4gW107XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZpbHRlcihcbiAgICAgICAga2V5ID0+ICFrZXkuc3RhcnRzV2l0aCgnXycpICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChwcm9wZXJ0aWVzLCBgXyR7a2V5fWApXG4gICAgKTtcbn1cblxuLyoqXG4gKiBLZXlzIHdob3NlIHNlcmlhbGl6ZWQgZmllbGQgbmFtZSBkaWZmZXJzIChhY2Nlc3Nvci1iYWNrZWQgZW5naW5lIHByb3BlcnRpZXMpLlxuICpcbiAqIFZlcmlmaWVkIG9ubHkgZm9yIHRoZXNlIGZvdXIgdHlwZXMg4oCUIGV2ZXJ5IG90aGVyIGVuZ2luZSBgY2MuKmAvYHNwLipgL2BkcmFnb25Cb25lcy4qYFxuICogY29tcG9uZW50IGZhbGxzIHRocm91Z2ggdG8gdGhlIGdlbmVyaWMgYnJhbmNoIGJlbG93LCB3aGljaCBlbWl0cyB0aGUgZHVtcCBrZXlcbiAqIFZFUkJBVElNLiBGb3IgbW9zdCBlbmdpbmUgdHlwZXMgdGhlIGR1bXAga2V5IGFscmVhZHkgbWF0Y2hlcyB0aGUgc2VyaWFsaXplZCBrZXlcbiAqIChlLmcuIGBjYy5QYXJ0aWNsZVN5c3RlbTJEYCdzIGBlbWlzc2lvblJhdGVgKSwgYnV0IGFuIGFjY2Vzc29yLWJhY2tlZCBmaWVsZCBvbiBhIHR5cGVcbiAqIG5vdCBsaXN0ZWQgaGVyZSB3b3VsZCBzZXJpYWxpemUgdW5kZXIgdGhlIFdST05HIGtleSByYXRoZXIgdGhhbiBiZWluZyBkcm9wcGVkLlxuICpcbiAqIEV4dGVuZCB0aGlzIHRhYmxlIGFzIHNwZWNpZmljIG1pc21hdGNoZXMgYXJlIGNvbmZpcm1lZCBhZ2FpbnN0IGEgcnVubmluZyBDb2NvcyBDcmVhdG9yXG4gKiAzLjguNyBpbnN0YW5jZSDigJQgYnV0IG5vdGUgdGhhdCBgZmluZEFjY2Vzc29yVHdpbktleXNgIGJlbG93IGlzIHRoZSB0eXBlLWFnbm9zdGljIG5ldFxuICogdW5kZXJuZWF0aCBpdDogd2hlcmUgdGhlIGR1bXAgY2FycmllcyBCT1RIIHNwZWxsaW5ncywgdGhlIHR3aW4gaXMgZHJvcHBlZCByYXRoZXIgdGhhblxuICogcmVxdWlyaW5nIGEgdGFibGUgZW50cnksIHNvIGEgdHlwZSB0aGlzIHRhYmxlIGhhcyBuZXZlciBoZWFyZCBvZiBzdGlsbCBzZXJpYWxpemVzXG4gKiBpbXBvcnRhYmxlLiBUaGUgdGFibGUgcmVtYWlucyBuZWNlc3NhcnkgZm9yIHRoZSBjYXNlIHRoZSBuZXQgY2Fubm90IHNlZSDigJQgYW5cbiAqIGFjY2Vzc29yLW9ubHkga2V5IHdpdGggbm8gc2VyaWFsaXplZCB0d2luIHByZXNlbnQgaW4gdGhlIHNhbWUgZHVtcC5cbiAqL1xuY29uc3QgRFVNUF9LRVlfUkVOQU1FUzogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgc3RyaW5nPj4gPSB7XG4gICAgJ2NjLlVJVHJhbnNmb3JtJzogeyBjb250ZW50U2l6ZTogJ19jb250ZW50U2l6ZScsIGFuY2hvclBvaW50OiAnX2FuY2hvclBvaW50JyB9LFxuICAgICdjYy5TcHJpdGUnOiB7IHNwcml0ZUZyYW1lOiAnX3Nwcml0ZUZyYW1lJywgdHlwZTogJ190eXBlJywgc2l6ZU1vZGU6ICdfc2l6ZU1vZGUnLCBmaWxsVHlwZTogJ19maWxsVHlwZScgfSxcbiAgICAnY2MuTGFiZWwnOiB7IHN0cmluZzogJ19zdHJpbmcnLCBmb250U2l6ZTogJ19mb250U2l6ZScsIGxpbmVIZWlnaHQ6ICdfbGluZUhlaWdodCcsIG92ZXJmbG93OiAnX292ZXJmbG93JyB9LFxuICAgICdjYy5CdXR0b24nOiB7IHRhcmdldDogJ190YXJnZXQnLCBpbnRlcmFjdGFibGU6ICdfaW50ZXJhY3RhYmxlJywgdHJhbnNpdGlvbjogJ190cmFuc2l0aW9uJyB9LFxufTtcblxuLyoqXG4gKiBHYXAtZmlsbGVycywgYXBwbGllZCBvbmx5IHRvIGtleXMgdGhlIGR1bXAgZGlkIG5vdCBzdXBwbHkuIFRoZXNlIGFyZSBlbmdpbmUgZGVmYXVsdHMg4oCUXG4gKiBuZXZlciBhbiBvdmVycmlkZSBvZiBhIGNhcHR1cmVkIHZhbHVlLlxuICovXG5jb25zdCBDT01QT05FTlRfREVGQVVMVFM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIGFueT4+ID0ge1xuICAgICdjYy5VSVRyYW5zZm9ybSc6IHtcbiAgICAgICAgX2NvbnRlbnRTaXplOiB7IFwiX190eXBlX19cIjogXCJjYy5TaXplXCIsIFwid2lkdGhcIjogMTAwLCBcImhlaWdodFwiOiAxMDAgfSxcbiAgICAgICAgX2FuY2hvclBvaW50OiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiAwLjUsIFwieVwiOiAwLjUgfSxcbiAgICB9LFxuICAgICdjYy5TcHJpdGUnOiB7XG4gICAgICAgIF9zcHJpdGVGcmFtZTogbnVsbCwgX3R5cGU6IDAsIF9maWxsVHlwZTogMCwgX3NpemVNb2RlOiAxLFxuICAgICAgICBfZmlsbENlbnRlcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogMCwgXCJ5XCI6IDAgfSxcbiAgICAgICAgX2ZpbGxTdGFydDogMCwgX2ZpbGxSYW5nZTogMCwgX2lzVHJpbW1lZE1vZGU6IHRydWUsIF91c2VHcmF5c2NhbGU6IGZhbHNlLFxuICAgICAgICBfYXRsYXM6IG51bGwsXG4gICAgfSxcbiAgICAnY2MuQnV0dG9uJzoge1xuICAgICAgICBfaW50ZXJhY3RhYmxlOiB0cnVlLCBfdHJhbnNpdGlvbjogMyxcbiAgICAgICAgX25vcm1hbENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9ob3ZlckNvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjExLCBcImdcIjogMjExLCBcImJcIjogMjExLCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9wcmVzc2VkQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyNTUsIFwiZ1wiOiAyNTUsIFwiYlwiOiAyNTUsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX2Rpc2FibGVkQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAxMjQsIFwiZ1wiOiAxMjQsIFwiYlwiOiAxMjQsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX25vcm1hbFNwcml0ZTogbnVsbCwgX2hvdmVyU3ByaXRlOiBudWxsLCBfcHJlc3NlZFNwcml0ZTogbnVsbCwgX2Rpc2FibGVkU3ByaXRlOiBudWxsLFxuICAgICAgICBfZHVyYXRpb246IDAuMSwgX3pvb21TY2FsZTogMS4yLCBfY2xpY2tFdmVudHM6IFtdLFxuICAgIH0sXG4gICAgJ2NjLkxhYmVsJzoge1xuICAgICAgICBfc3RyaW5nOiBcIkxhYmVsXCIsIF9ob3Jpem9udGFsQWxpZ246IDEsIF92ZXJ0aWNhbEFsaWduOiAxLFxuICAgICAgICBfYWN0dWFsRm9udFNpemU6IDIwLCBfZm9udFNpemU6IDIwLCBfZm9udEZhbWlseTogXCJBcmlhbFwiLFxuICAgICAgICBfbGluZUhlaWdodDogMjUsIF9vdmVyZmxvdzogMCwgX2VuYWJsZVdyYXBUZXh0OiB0cnVlLFxuICAgICAgICBfZm9udDogbnVsbCwgX2lzU3lzdGVtRm9udFVzZWQ6IHRydWUsIF9zcGFjaW5nWDogMCxcbiAgICAgICAgX2lzSXRhbGljOiBmYWxzZSwgX2lzQm9sZDogZmFsc2UsIF9pc1VuZGVybGluZTogZmFsc2UsXG4gICAgICAgIF91bmRlcmxpbmVIZWlnaHQ6IDIsIF9jYWNoZU1vZGU6IDAsXG4gICAgfSxcbn07XG5cbmV4cG9ydCBjbGFzcyBQcmVmYWJDcmVhdGlvblNlcnZpY2Uge1xuXG4gICAgYXN5bmMgY3JlYXRlUHJlZmFiV2l0aEFzc2V0REIobm9kZVV1aWQ6IHN0cmluZywgc2F2ZVBhdGg6IHN0cmluZywgcHJlZmFiTmFtZTogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgdGhpcy5nZXROb2RlRGF0YShub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDYW5ub3QgZ2V0IG5vZGUgZGF0YScgfTtcblxuICAgICAgICAgICAgY29uc3QgdGVtcFByZWZhYkNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShbeyBcIl9fdHlwZV9fXCI6IFwiY2MuUHJlZmFiXCIsIFwiX25hbWVcIjogcHJlZmFiTmFtZSB9XSwgbnVsbCwgMik7XG4gICAgICAgICAgICBjb25zdCBjcmVhdGVSZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0ZUFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgsIHRlbXBQcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGlmICghY3JlYXRlUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBjcmVhdGVSZXN1bHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFByZWZhYlV1aWQgPSBjcmVhdGVSZXN1bHQuZGF0YT8udXVpZDtcbiAgICAgICAgICAgIGlmICghYWN0dWFsUHJlZmFiVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGdldCBlbmdpbmUtYXNzaWduZWQgcHJlZmFiIFVVSUQnIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkNvbnRlbnQgPSBhd2FpdCB0aGlzLmNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YSwgcHJlZmFiTmFtZSwgYWN0dWFsUHJlZmFiVXVpZCwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cyk7XG4gICAgICAgICAgICAvLyBEZWZlbnNlLWluLWRlcHRoIGZvciAjMTE0IGRlZmVjdCAyLiBgdmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiQ29udGVudClgIGFsb25lXG4gICAgICAgICAgICAvLyB3b3VsZCBiZSBhIHNoYXBlIGNoZWNrIHRoYXQgY2FuIG5ldmVyIGZhaWw6IGl0IHJ1bnMgYGZpbmRBY2Nlc3NvclR3aW5LZXlzYCBvdmVyXG4gICAgICAgICAgICAvLyBvdXRwdXQgdGhhdCBgY3JlYXRlQ29tcG9uZW50T2JqZWN0YCBhbHJlYWR5IHJhbiB0aGUgU0FNRSBwcmVkaWNhdGUgb3Zlciwgc28gYVxuICAgICAgICAgICAgLy8gZHVwbGljYXRlIHJlYWNoaW5nIGhlcmUgaXMgaW1wb3NzaWJsZSBieSBjb25zdHJ1Y3Rpb24gKHZlcmlmaWVkIOKAlCBuZXV0ZXJpbmcgdGhpc1xuICAgICAgICAgICAgLy8gYnJhbmNoIGxlZnQgZXZlcnkgdGVzdCBncmVlbikuIFRoZSBnZW51aW5lIGludmFyaWFudCBpcyBhIERJRkZFUkVOQ0Ugb25lOiBldmVyeVxuICAgICAgICAgICAgLy8gYWNjZXNzb3IgdHdpbiB0aGUgQ0FQVFVSRUQgc2NlbmUgZHVtcCBjYXJyaWVzIG11c3QgYmUgYWJzZW50IGZyb20gd2hhdCB3ZSBhcmVcbiAgICAgICAgICAgIC8vIGFib3V0IHRvIHdyaXRlLiBUaGF0IGZpcmVzIGV2ZW4gaWYgdGhlIGVtaXNzaW9uIGZpbHRlciBpcyByZW1vdmVkLCBtaXMtdHlwZWQsIG9yXG4gICAgICAgICAgICAvLyB0aGUgZHVtcCBzaGFwZSBjaGFuZ2VzIHVuZGVyIGl0LCBiZWNhdXNlIGl0IGRvZXMgbm90IHJlLWFzayB0aGUgZmlsdGVyJ3MgcXVlc3Rpb24uXG4gICAgICAgICAgICBjb25zdCBjYXB0dXJlZFR3aW5zID0gdGhpcy5maW5kQ2FwdHVyZWRBY2Nlc3NvclR3aW5zKG5vZGVEYXRhLCBwcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGlmIChjYXB0dXJlZFR3aW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lZCA9IGNhcHR1cmVkVHdpbnNcbiAgICAgICAgICAgICAgICAgICAgLm1hcChkID0+IGAke2QudHlwZX0gKCR7ZC5rZXlzLm1hcChrID0+IGAnJHtrfScvJ18ke2t9J2ApLmpvaW4oJywgJyl9KWApXG4gICAgICAgICAgICAgICAgICAgIC5qb2luKCc7ICcpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byB3cml0ZSAke3NhdmVQYXRofTogdGhlIHNjZW5lIGNhcnJpZWQgYW4gYWNjZXNzb3Iga2V5IGFsb25nc2lkZSBpdHMgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgdW5kZXJzY29yZSB0d2luIGFuZCBpdCBzdXJ2aXZlZCBpbnRvIHRoZSBwcmVmYWIg4oCUICR7bmFtZWR9LiBDb2NvcyBDcmVhdG9yJ3MgYXNzZXQgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgaW1wb3J0ZXIgcmVqZWN0cyB0aGlzIHNoYXBlIChcIkNhbm5vdCByZWFkIHByb3BlcnRpZXMgb2YgdW5kZWZpbmVkIChyZWFkaW5nICdfbmFtZScpXCIpLCBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGBzbyB0aGUgcHJlZmFiIHdvdWxkIGJlIHVubG9hZGFibGUsIHlldCB0aGUgY2FsbGVyIHdvdWxkIGhhdmUgYmVlbiB0b2xkIGl0IHdhcyBjcmVhdGVkIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYChpc3N1ZSAjMTE0IGRlZmVjdCAyKS5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHByZWZhYlV1aWQ6IGFjdHVhbFByZWZhYlV1aWQsIHByZWZhYlBhdGg6IHNhdmVQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSwgZHVwbGljYXRlQWNjZXNzb3JLZXlzOiBjYXB0dXJlZFR3aW5zIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgcmVmZXJlbmNlTG9zcyA9IHRoaXMuZGVzY3JpYmVSZWZlcmVuY2VMb3NzZXModGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzKTtcbiAgICAgICAgICAgIGlmIChyZWZlcmVuY2VMb3NzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFJlZnVzaW5nIHRvIHdyaXRlICR7c2F2ZVBhdGh9OiAke3JlZmVyZW5jZUxvc3N9IFRoZSB3cml0dGVuIHByZWZhYiB3b3VsZCBub3QgYmUgZXF1aXZhbGVudCB0byB0aGUgc2NlbmUgc3VidHJlZSDigJQgdGhpcyBpcyBpc3N1ZSAjNzMncyBhc3NldC1yZWZlcmVuY2UgbG9zcy5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHByZWZhYlV1aWQ6IGFjdHVhbFByZWZhYlV1aWQsIHByZWZhYlBhdGg6IHNhdmVQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSwgcmVmZXJlbmNlTG9zc2VzOiB0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnVwZGF0ZUFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgsIEpTT04uc3RyaW5naWZ5KHByZWZhYkNvbnRlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTWV0YVdpdGhBc3NldERCKHNhdmVQYXRoLCB0aGlzLmNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZSwgYWN0dWFsUHJlZmFiVXVpZCkpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5yZWltcG9ydEFzc2V0V2l0aEFzc2V0REIoc2F2ZVBhdGgpO1xuXG4gICAgICAgICAgICAvLyBSZWFkIHRoZSBhc3NldCBiYWNrIGJlZm9yZSByZXBvcnRpbmcgc3VjY2Vzcy4gQ29tcG9uZW50cyB0aGF0IHdlcmVcbiAgICAgICAgICAgIC8vIGNvbmZpZ3VyZWQgaW4gdGhlIHNjZW5lIGJ1dCBzZXJpYWxpemVkIHRvIGEgYmFyZSBlbnZlbG9wZSBhcmUgYSBzaWxlbnRcbiAgICAgICAgICAgIC8vIGRhdGEgbG9zcyB0aGUgY2FsbGVyIGNhbm5vdCBvdGhlcndpc2UgZGV0ZWN0ICgjMjgpLlxuICAgICAgICAgICAgY29uc3QgcmVhZEJhY2sgPSBhd2FpdCB0aGlzLnJlYWRCYWNrUHJlZmFiKHNhdmVQYXRoLCBwcmVmYWJDb250ZW50KTtcbiAgICAgICAgICAgIGNvbnN0IGxvc3QgPSB0aGlzLmZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHJlYWRCYWNrLmRhdGEsIG5vZGVEYXRhKTtcbiAgICAgICAgICAgIGlmIChsb3N0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHdyaXR0ZW4gdG8gJHtzYXZlUGF0aH0sIGJ1dCB0aGVzZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzOiAke2xvc3Quam9pbignLCAnKX0uIFRoZSBzY2VuZSB2YWx1ZXMgd2VyZSBub3QgY2FwdHVyZWQg4oCUIGRvIG5vdCB1c2UgdGhpcyBwcmVmYWIuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGNvbXBvbmVudHNXaXRob3V0UHJvcGVydGllczogbG9zdCwgdmVyaWZpZWRGcm9tOiByZWFkQmFjay5zb3VyY2UgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZCwgYWN0dWFsUHJlZmFiVXVpZCwgc2F2ZVBhdGgpO1xuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGNvbnZlcnRlZFRvUHJlZmFiSW5zdGFuY2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllc1ZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MgPyAnUHJlZmFiIGNyZWF0ZWQgYW5kIG5vZGUgY29udmVydGVkJyA6ICdQcmVmYWIgY3JlYXRlZCwgbm9kZSBjb252ZXJzaW9uIGZhaWxlZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpOiBhbnkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogJ05hdGl2ZSBwcmVmYWIgY3JlYXRpb24gQVBJIG5vdCBhdmFpbGFibGUnLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdUbyBjcmVhdGUgYSBwcmVmYWIgaW4gQ29jb3MgQ3JlYXRvcjpcXG4xLiBTZWxlY3QgYSBub2RlIGluIHRoZSBzY2VuZVxcbjIuIERyYWcgaXQgdG8gdGhlIEFzc2V0IEJyb3dzZXJcXG4zLiBPciByaWdodC1jbGljayB0aGUgbm9kZSBhbmQgc2VsZWN0IFwiQ3JlYXRlIFByZWZhYlwiJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGFzeW5jIGNyZWF0ZVByZWZhYkN1c3RvbShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJQYXRoOiBzdHJpbmcsIHByZWZhYk5hbWU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZURhdGEobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSBub3QgZm91bmQ6ICR7bm9kZVV1aWR9YCB9O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJVdWlkID0gdGhpcy5nZW5lcmF0ZVVVSUQoKTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkpzb25EYXRhID0gYXdhaXQgdGhpcy5jcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGEsIHByZWZhYk5hbWUsIHByZWZhYlV1aWQsIHRydWUsIHRydWUpO1xuICAgICAgICAgICAgY29uc3QgcmVmZXJlbmNlTG9zcyA9IHRoaXMuZGVzY3JpYmVSZWZlcmVuY2VMb3NzZXModGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzKTtcbiAgICAgICAgICAgIGlmIChyZWZlcmVuY2VMb3NzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFJlZnVzaW5nIHRvIHdyaXRlICR7cHJlZmFiUGF0aH06ICR7cmVmZXJlbmNlTG9zc30gVGhlIHdyaXR0ZW4gcHJlZmFiIHdvdWxkIG5vdCBiZSBlcXVpdmFsZW50IHRvIHRoZSBzY2VuZSBzdWJ0cmVlIOKAlCB0aGlzIGlzIGlzc3VlICM3MydzIGFzc2V0LXJlZmVyZW5jZSBsb3NzLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIHJlZmVyZW5jZUxvc3NlczogdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3Qgc2F2ZVJlc3VsdCA9IGF3YWl0IHRoaXMuc2F2ZVByZWZhYldpdGhNZXRhKHByZWZhYlBhdGgsIHByZWZhYkpzb25EYXRhLCB0aGlzLmNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZSwgcHJlZmFiVXVpZCkpO1xuXG4gICAgICAgICAgICBpZiAoc2F2ZVJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbG9zdCA9IHRoaXMuZmluZENvbXBvbmVudHNUaGF0TG9zdFByb3BlcnRpZXMocHJlZmFiSnNvbkRhdGEsIG5vZGVEYXRhKTtcbiAgICAgICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBQcmVmYWIgd3JpdHRlbiB0byAke3ByZWZhYlBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIHByZWZhYlBhdGgsIHByZWZhYlV1aWQpO1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsIHByZWZhYlBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29udmVydGVkVG9QcmVmYWJJbnN0YW5jZTogY29udmVydFJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY29udmVydFJlc3VsdC5zdWNjZXNzID8gJ0N1c3RvbSBwcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogc2F2ZVJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHNhdmUgcHJlZmFiIGZpbGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gTm9kZSBkYXRhIHJldHJpZXZhbCA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlRGF0YShub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZUluZm8pIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZ2V0Tm9kZVdpdGhDaGlsZHJlbihub2RlVXVpZCkgfHwgbm9kZUluZm87XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVXaXRoQ2hpbGRyZW4obm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBpZiAoIXRyZWUpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0Tm9kZSA9IHRoaXMuZmluZE5vZGVJblRyZWUodHJlZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHRhcmdldE5vZGUgPyBhd2FpdCB0aGlzLmVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHModGFyZ2V0Tm9kZSkgOiBudWxsO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW5oYW5jZSBub2RlIHRyZWUgd2l0aCBhY2N1cmF0ZSBjb21wb25lbnQgaW5mbyB2aWEgZGlyZWN0IEVkaXRvciBBUEkuXG4gICAgICogUmVwbGFjZXMgcHJldmlvdXMgSFRUUCBzZWxmLWNhbGwgdG8gbG9jYWxob3N0Ojg1ODUgd2hpY2ggd2FzIGZyYWdpbGUgYW5kIHBvcnQtZGVwZW5kZW50LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyhub2RlOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBpZiAoIW5vZGUgfHwgIW5vZGUudXVpZCkgcmV0dXJuIG5vZGU7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlLnV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhKSB7XG4gICAgICAgICAgICAgICAgLy8gQ2FycnkgdGhlIHRyYW5zZm9ybSBkdW1wIHRocm91Z2ggc28gY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIGNhbiByZWFkXG4gICAgICAgICAgICAgICAgLy8gcG9zaXRpb24vcm90YXRpb24vc2NhbGUgaW5zdGVhZCBvZiBmYWxsaW5nIGJhY2sgdG8gaWRlbnRpdHkgKGlzc3VlICM1MCkuXG4gICAgICAgICAgICAgICAgLy8gVGhlIHF1ZXJ5LW5vZGUgZHVtcCBzaGFwZXMgdGhlc2UgYXMgeyB2YWx1ZTogeyB4LCB5LCB6IH0gfSAoYW5kIHcgZm9yIHF1YXQpLFxuICAgICAgICAgICAgICAgIC8vIHdoaWNoIGlzIGV4YWN0bHkgdGhlIHNoYXBlIGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSByZWFkcyB2aWEgbm9kZURhdGEucG9zaXRpb24/LnZhbHVlLlxuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5wb3NpdGlvbikgbm9kZS5wb3NpdGlvbiA9IG5vZGVEYXRhLnBvc2l0aW9uO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5yb3RhdGlvbikgbm9kZS5yb3RhdGlvbiA9IG5vZGVEYXRhLnJvdGF0aW9uO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5zY2FsZSkgbm9kZS5zY2FsZSA9IG5vZGVEYXRhLnNjYWxlO1xuICAgICAgICAgICAgICAgIC8vIFRoZSBsYXllciBpcyBjYXJyaWVkIGZvciB0aGUgc2FtZSByZWFzb246IGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSBoYXJkY29kZWRcbiAgICAgICAgICAgICAgICAvLyBERUZBVUxULCBzbyBldmVyeSBub2RlIG9mIGEgY3JlYXRlZCBwcmVmYWIgbGFuZGVkIG9uIHRoZSBERUZBVUxUIGxheWVyIGFuZCBhXG4gICAgICAgICAgICAgICAgLy8gVUkgcHJlZmFiIChVSV8yRCkgd2FzIGN1bGxlZCBieSB0aGUgVUkgY2FtZXJhIOKAlCBpdCByZW5kZXJlZCBub3RoaW5nLlxuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5sYXllciAhPT0gdW5kZWZpbmVkKSBub2RlLmxheWVyID0gbm9kZURhdGEubGF5ZXI7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgICAgICAgICAvLyBgcHJvcGVydGllc2AgY2FycmllcyB0aGUgbGl2ZSBwcm9wZXJ0eSBkdW1wIHRocm91Z2ggdG8gc2VyaWFsaXphdGlvbi5cbiAgICAgICAgICAgICAgICAgICAgLy8gUmVkdWNpbmcgZWFjaCBjb21wb25lbnQgdG8gdHlwZS91dWlkL2VuYWJsZWQgZGlzY2FyZGVkIGV2ZXJ5IGNvbmZpZ3VyZWRcbiAgICAgICAgICAgICAgICAgICAgLy8gdmFsdWUgYmVmb3JlIGl0IGNvdWxkIGJlIHdyaXR0ZW4sIHNvIGBhY3Rpb249Y3JlYXRlYCBzYXZlZCBlbmdpbmVcbiAgICAgICAgICAgICAgICAgICAgLy8gZGVmYXVsdHMgZm9yIGV2ZXJ5IGNvbXBvbmVudCB0eXBlICgjMjgpLlxuICAgICAgICAgICAgICAgICAgICBub2RlLmNvbXBvbmVudHMgPSBub2RlRGF0YS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGUgZHVtcCBuZXN0cyB0aGUgY29tcG9uZW50J3Mgb3duIHV1aWQgdW5kZXIgdmFsdWUudXVpZC52YWx1ZTsgdGhlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b3AtbGV2ZWwgY29tcC51dWlkIGRvZXMgbm90IGV4aXN0IChzYW1lIHNoYXBlIE1hbmFnZUNvbXBvbmVudC5nZXRDb21wb25lbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhbHJlYWR5IGFjY291bnRzIGZvcikuIFJlYWRpbmcgb25seSBjb21wLnV1aWQgbGVmdCBjb21wb25lbnRVdWlkVG9JbmRleFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcGVybWFuZW50bHkgZW1wdHksIHNvIGV2ZXJ5IGNyb3NzLWNvbXBvbmVudCByZWZlcmVuY2Ugb24gYSBjcmVhdGVkIHByZWZhYlxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gKGUuZy4gYSBzY3JpcHQncyBAcHJvcGVydHkoTWVzaFJlbmRlcmVyKS9AcHJvcGVydHkoTGFiZWwpIGZpZWxkIHBvaW50aW5nIGF0XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBhIGRlc2NlbmRhbnQgbm9kZSdzIGNvbXBvbmVudCkgc2lsZW50bHkgc2VyaWFsaXplZCBhcyBudWxsLlxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogY29tcC52YWx1ZT8udXVpZD8udmFsdWUgfHwgY29tcC51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAoY29tcClcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgTm9kZSAke25vZGUudXVpZH0gZW5oYW5jZWQgd2l0aCAke25vZGUuY29tcG9uZW50cy5sZW5ndGh9IGNvbXBvbmVudHMgKGluY2wuIHNjcmlwdCB0eXBlcylgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEZhaWxlZCB0byBnZXQgY29tcG9uZW50IGluZm8gZm9yIG5vZGUgJHtub2RlLnV1aWR9OmAsIGVycm9yKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuW2ldID0gYXdhaXQgdGhpcy5lbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKG5vZGUuY2hpbGRyZW5baV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBub2RlO1xuICAgIH1cblxuICAgIHByaXZhdGUgZmluZE5vZGVJblRyZWUobm9kZTogYW55LCB0YXJnZXRVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBpZiAoIW5vZGUpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAobm9kZS51dWlkID09PSB0YXJnZXRVdWlkIHx8IG5vZGUudmFsdWU/LnV1aWQgPT09IHRhcmdldFV1aWQpIHJldHVybiBub2RlO1xuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZE5vZGVJblRyZWUoY2hpbGQsIHRhcmdldFV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChmb3VuZCkgcmV0dXJuIGZvdW5kO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGE6IGFueSk6IGFueVtdIHtcbiAgICAgICAgY29uc3QgY2hpbGRyZW46IGFueVtdID0gW107XG4gICAgICAgIGlmIChub2RlRGF0YS5jaGlsZHJlbiAmJiBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlRGF0YS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmlzVmFsaWROb2RlRGF0YShjaGlsZCkpIGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG5cbiAgICBwcml2YXRlIGlzVmFsaWROb2RlRGF0YShub2RlRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghbm9kZURhdGEgfHwgdHlwZW9mIG5vZGVEYXRhICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ3V1aWQnKSB8fCBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpIHx8IG5vZGVEYXRhLmhhc093blByb3BlcnR5KCdfX3R5cGVfXycpIHx8XG4gICAgICAgICAgICAobm9kZURhdGEudmFsdWUgJiYgKG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCd1dWlkJykgfHwgbm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ25hbWUnKSB8fCBub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgnX190eXBlX18nKSkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdE5vZGVVdWlkKG5vZGVEYXRhOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZURhdGEudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBub2RlRGF0YS51dWlkO1xuICAgICAgICBpZiAobm9kZURhdGEudmFsdWUgJiYgdHlwZW9mIG5vZGVEYXRhLnZhbHVlLnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gbm9kZURhdGEudmFsdWUudXVpZDtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gPT09PT0gUHJlZmFiIHNlcmlhbGl6YXRpb24gPT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50KG5vZGVEYXRhOiBhbnksIHByZWZhYk5hbWU6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nLCBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxhbnlbXT4ge1xuICAgICAgICBjb25zdCBwcmVmYWJEYXRhOiBhbnlbXSA9IFtdO1xuICAgICAgICBwcmVmYWJEYXRhLnB1c2goe1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYlwiLCBcIl9uYW1lXCI6IHByZWZhYk5hbWUgfHwgXCJcIiwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJfbmF0aXZlXCI6IFwiXCIsIFwiZGF0YVwiOiB7IFwiX19pZF9fXCI6IDEgfSwgXCJvcHRpbWl6YXRpb25Qb2xpY3lcIjogMCwgXCJwZXJzaXN0ZW50XCI6IGZhbHNlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNvbnRleHQgPSB7XG4gICAgICAgICAgICBwcmVmYWJEYXRhLCBjdXJyZW50SWQ6IDIsIHByZWZhYkFzc2V0SW5kZXg6IDAsXG4gICAgICAgICAgICBub2RlRmlsZUlkczogbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKSxcbiAgICAgICAgICAgIG5vZGVVdWlkVG9JbmRleDogbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKSxcbiAgICAgICAgICAgIGNvbXBvbmVudFV1aWRUb0luZGV4OiBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpLFxuICAgICAgICAgICAgbG9zc2VzOiBbXSBhcyBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT5cbiAgICAgICAgfTtcblxuICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbXBsZXRlTm9kZVRyZWUobm9kZURhdGEsIG51bGwsIDEsIGNvbnRleHQsIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHMsIHByZWZhYk5hbWUpO1xuICAgICAgICB0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMgPSBjb250ZXh0Lmxvc3NlcztcbiAgICAgICAgcmV0dXJuIHByZWZhYkRhdGE7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVmZXJlbmNlcyB0aGUgbW9zdCByZWNlbnQgYGNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudGAgY2FsbCBjb3VsZCBub3Qgc2VyaWFsaXplLlxuICAgICAqXG4gICAgICogVGhlIGNyZWF0ZSBwYXRocyBhcmUgcGxhaW4gZnVuY3Rpb25zIHJldHVybmluZyB0aGUgcHJlZmFiIEpTT04sIHNvIGEgbG9zcyBjYW5ub3QgYmVcbiAgICAgKiB0aHJvd24gZnJvbSB3aGVyZSBpdCBpcyBkZXRlY3RlZCB3aXRob3V0IGFiYW5kb25pbmcgYSB2YWxpZCBgZmF0YWxgIGZhaWx1cmUgcmVwb3J0LlxuICAgICAqIEJvdGggY3JlYXRlIHBhdGhzIHJlYWQgdGhpcyBpbW1lZGlhdGVseSBhZnRlciBzZXJpYWxpemluZyBhbmQgZmFpbCBvbiBhIG5vbi1lbXB0eVxuICAgICAqIGxpc3Qg4oCUIHRoZSBzYW1lIGNvbnRyYWN0IGFzIHRoZSBleGlzdGluZyBgZmluZENvbXBvbmVudHNUaGF0TG9zdFByb3BlcnRpZXNgIGNoZWNrLlxuICAgICAqL1xuICAgIHByaXZhdGUgbGFzdFJlZmVyZW5jZUxvc3NlczogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+ID0gW107XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUNvbXBsZXRlTm9kZVRyZWUoXG4gICAgICAgIG5vZGVEYXRhOiBhbnksIHBhcmVudE5vZGVJbmRleDogbnVtYmVyIHwgbnVsbCwgbm9kZUluZGV4OiBudW1iZXIsXG4gICAgICAgIGNvbnRleHQ6IHsgcHJlZmFiRGF0YTogYW55W107IGN1cnJlbnRJZDogbnVtYmVyOyBwcmVmYWJBc3NldEluZGV4OiBudW1iZXI7IG5vZGVGaWxlSWRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+OyBub2RlVXVpZFRvSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj47IGNvbXBvbmVudFV1aWRUb0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+OyBsb3NzZXM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PiB9LFxuICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuLCBub2RlTmFtZT86IHN0cmluZ1xuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByZWZhYkRhdGEgfSA9IGNvbnRleHQ7XG4gICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZShub2RlRGF0YSwgcGFyZW50Tm9kZUluZGV4LCBub2RlTmFtZSk7XG5cbiAgICAgICAgd2hpbGUgKHByZWZhYkRhdGEubGVuZ3RoIDw9IG5vZGVJbmRleCkgcHJlZmFiRGF0YS5wdXNoKG51bGwpO1xuICAgICAgICBwcmVmYWJEYXRhW25vZGVJbmRleF0gPSBub2RlO1xuXG4gICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdGhpcy5leHRyYWN0Tm9kZVV1aWQobm9kZURhdGEpO1xuICAgICAgICBjb25zdCBmaWxlSWQgPSBub2RlVXVpZCB8fCB0aGlzLmdlbmVyYXRlRmlsZUlkKCk7XG4gICAgICAgIGNvbnRleHQubm9kZUZpbGVJZHMuc2V0KG5vZGVJbmRleC50b1N0cmluZygpLCBmaWxlSWQpO1xuICAgICAgICBpZiAobm9kZVV1aWQpIGNvbnRleHQubm9kZVV1aWRUb0luZGV4LnNldChub2RlVXVpZCwgbm9kZUluZGV4KTtcblxuICAgICAgICBjb25zdCBjaGlsZHJlblRvUHJvY2VzcyA9IHRoaXMuZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGEpO1xuICAgICAgICBpZiAoaW5jbHVkZUNoaWxkcmVuICYmIGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kaWNlczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBjaGlsZEluZGljZXMucHVzaChjaGlsZEluZGV4KTtcbiAgICAgICAgICAgICAgICBub2RlLl9jaGlsZHJlbi5wdXNoKHsgXCJfX2lkX19cIjogY2hpbGRJbmRleCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbXBsZXRlTm9kZVRyZWUoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuVG9Qcm9jZXNzW2ldLCBub2RlSW5kZXgsIGNoaWxkSW5kaWNlc1tpXSwgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cywgY2hpbGRyZW5Ub1Byb2Nlc3NbaV0ubmFtZSB8fCBgQ2hpbGQke2kgKyAxfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzICYmIG5vZGVEYXRhLmNvbXBvbmVudHMgJiYgQXJyYXkuaXNBcnJheShub2RlRGF0YS5jb21wb25lbnRzKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wb25lbnQgb2Ygbm9kZURhdGEuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBub2RlLl9jb21wb25lbnRzLnB1c2goeyBcIl9faWRfX1wiOiBjb21wb25lbnRJbmRleCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gY29tcG9uZW50LnV1aWQgfHwgKGNvbXBvbmVudC52YWx1ZSAmJiBjb21wb25lbnQudmFsdWUudXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudFV1aWQpIGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguc2V0KGNvbXBvbmVudFV1aWQsIGNvbXBvbmVudEluZGV4KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRPYmogPSB0aGlzLmNyZWF0ZUNvbXBvbmVudE9iamVjdChjb21wb25lbnQsIG5vZGVJbmRleCwgY29udGV4dCk7XG4gICAgICAgICAgICAgICAgcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0gPSBjb21wb25lbnRPYmo7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZm9JbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgcHJlZmFiRGF0YVtjb21wUHJlZmFiSW5mb0luZGV4XSA9IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbXBQcmVmYWJJbmZvXCIsIFwiZmlsZUlkXCI6IHRoaXMuZ2VuZXJhdGVGaWxlSWQoKSB9O1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRPYmogJiYgdHlwZW9mIGNvbXBvbmVudE9iaiA9PT0gJ29iamVjdCcpIGNvbXBvbmVudE9iai5fX3ByZWZhYiA9IHsgXCJfX2lkX19cIjogY29tcFByZWZhYkluZm9JbmRleCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgbm9kZS5fcHJlZmFiID0geyBcIl9faWRfX1wiOiBwcmVmYWJJbmZvSW5kZXggfTtcbiAgICAgICAgcHJlZmFiRGF0YVtwcmVmYWJJbmZvSW5kZXhdID0ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYkluZm9cIiwgXCJyb290XCI6IHsgXCJfX2lkX19cIjogMSB9LCBcImFzc2V0XCI6IHsgXCJfX2lkX19cIjogY29udGV4dC5wcmVmYWJBc3NldEluZGV4IH0sXG4gICAgICAgICAgICBcImZpbGVJZFwiOiBmaWxlSWQsIFwidGFyZ2V0T3ZlcnJpZGVzXCI6IG51bGwsIFwibmVzdGVkUHJlZmFiSW5zdGFuY2VSb290c1wiOiBudWxsLCBcImluc3RhbmNlXCI6IG51bGxcbiAgICAgICAgfTtcbiAgICAgICAgY29udGV4dC5jdXJyZW50SWQgPSBwcmVmYWJJbmZvSW5kZXggKyAxO1xuICAgIH1cblxuICAgIC8qKiBgY2MuTGF5ZXJzLkVudW0uREVGQVVMVGAgKDEgPDwgMzApIOKAlCB0aGUgZmFsbGJhY2sgd2hlbiBhIG5vZGUgZHVtcCBjYXJyaWVzIG5vIGxheWVyLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfTEFZRVIgPSAxMDczNzQxODI0O1xuXG4gICAgLyoqXG4gICAgICogRXVsZXIgYW5nbGVzIGluIERFR1JFRVMgdG8gYSBxdWF0ZXJuaW9uLCBtYXRjaGluZyBgY2MuUXVhdC5mcm9tRXVsZXJgIGV4YWN0bHkuXG4gICAgICogVmVyaWZpZWQgYWdhaW5zdCBDb2NvcyBDcmVhdG9yIDMuOC43OiBldWxlciAoMTAsIDIwLCAzMCkgc2VyaWFsaXplcyBhc1xuICAgICAqICgwLjEyNzY3OTQ0MDY5NTc4MDYzLCAwLjE4OTMwNzg1NzQxMTk5OTk5LCAwLjIzOTI5ODMzNzc0NDczMDMsIDAuOTQzNzE0MzY0MTQ3NDg5KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBldWxlckRlZ3JlZXNUb1F1YXQoZTogYW55KTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyB3OiBudW1iZXIgfSB7XG4gICAgICAgIGNvbnN0IGhhbGZUb1JhZCA9IDAuNSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIGNvbnN0IHggPSAoZS54IHx8IDApICogaGFsZlRvUmFkLCB5ID0gKGUueSB8fCAwKSAqIGhhbGZUb1JhZCwgeiA9IChlLnogfHwgMCkgKiBoYWxmVG9SYWQ7XG4gICAgICAgIGNvbnN0IHN4ID0gTWF0aC5zaW4oeCksIGN4ID0gTWF0aC5jb3MoeCk7XG4gICAgICAgIGNvbnN0IHN5ID0gTWF0aC5zaW4oeSksIGN5ID0gTWF0aC5jb3MoeSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oeiksIGN6ID0gTWF0aC5jb3Moeik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBzeCAqIGN5ICogY3ogKyBjeCAqIHN5ICogc3osXG4gICAgICAgICAgICB5OiBjeCAqIHN5ICogY3ogKyBzeCAqIGN5ICogc3osXG4gICAgICAgICAgICB6OiBjeCAqIGN5ICogc3ogLSBzeCAqIHN5ICogY3osXG4gICAgICAgICAgICB3OiBjeCAqIGN5ICogY3ogLSBzeCAqIHN5ICogc3osXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUobm9kZURhdGE6IGFueSwgcGFyZW50Tm9kZUluZGV4OiBudW1iZXIgfCBudWxsLCBub2RlTmFtZT86IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBub2RlTmFtZSB8fCBub2RlRGF0YS5uYW1lPy52YWx1ZSB8fCBub2RlRGF0YS5uYW1lIHx8ICdOb2RlJztcbiAgICAgICAgY29uc3QgbHBvcyA9IG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZSB8fCBub2RlRGF0YS5scG9zPy52YWx1ZSB8fCBub2RlRGF0YS5fbHBvcyB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcbiAgICAgICAgY29uc3Qgcm90RHVtcCA9IG5vZGVEYXRhLnJvdGF0aW9uPy52YWx1ZSB8fCBub2RlRGF0YS5scm90Py52YWx1ZSB8fCBub2RlRGF0YS5fbHJvdCB8fCB7IHg6IDAsIHk6IDAsIHo6IDAsIHc6IDEgfTtcbiAgICAgICAgLy8gYHF1ZXJ5LW5vZGVgIHJlcG9ydHMgcm90YXRpb24gYXMgRVVMRVIgREVHUkVFUyAoY2MuVmVjMywgbm8gYHdgKSDigJQgdGhlIHZhbHVlIHRoZVxuICAgICAgICAvLyBpbnNwZWN0b3IncyBSb3RhdGlvbiBmaWVsZCBzaG93cy4gYF9scm90YCBpcyBhIHF1YXRlcm5pb24sIHNvIHBhc3NpbmcgdGhlIGR1bXBcbiAgICAgICAgLy8gc3RyYWlnaHQgdGhyb3VnaCBzdG9yZWQgYSBkZWdyZWUgaW4gYSBxdWF0ZXJuaW9uIGNvbXBvbmVudDogYSAtMC4xIGRlZ3JlZSB0aWx0IHdhc1xuICAgICAgICAvLyB3cml0dGVuIGFzIHt6OiAtMC4xLCB3OiAxfSwgd2hpY2ggdGhlIGVuZ2luZSByZWFkcyBiYWNrIGFzIHJvdWdobHkgLTExLjQ2IGRlZ3JlZXMuXG4gICAgICAgIGNvbnN0IGlzUXVhdCA9IHJvdER1bXAudyAhPT0gdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBscm90ID0gaXNRdWF0ID8gcm90RHVtcCA6IFByZWZhYkNyZWF0aW9uU2VydmljZS5ldWxlckRlZ3JlZXNUb1F1YXQocm90RHVtcCk7XG4gICAgICAgIGNvbnN0IGV1bGVyID0gaXNRdWF0ID8geyB4OiAwLCB5OiAwLCB6OiAwIH0gOiByb3REdW1wO1xuICAgICAgICBjb25zdCBsc2NhbGUgPSBub2RlRGF0YS5zY2FsZT8udmFsdWUgfHwgbm9kZURhdGEubHNjYWxlPy52YWx1ZSB8fCBub2RlRGF0YS5fbHNjYWxlIHx8IHsgeDogMSwgeTogMSwgejogMSB9O1xuICAgICAgICBjb25zdCBsYXllckR1bXAgPSBub2RlRGF0YS5sYXllcj8udmFsdWUgIT09IHVuZGVmaW5lZCA/IG5vZGVEYXRhLmxheWVyLnZhbHVlIDogbm9kZURhdGEubGF5ZXI7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdHlwZW9mIGxheWVyRHVtcCA9PT0gJ251bWJlcicgPyBsYXllckR1bXAgOiBQcmVmYWJDcmVhdGlvblNlcnZpY2UuREVGQVVMVF9MQVlFUjtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5Ob2RlXCIsIFwiX25hbWVcIjogbmFtZSwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJfcGFyZW50XCI6IHBhcmVudE5vZGVJbmRleCAhPT0gbnVsbCA/IHsgXCJfX2lkX19cIjogcGFyZW50Tm9kZUluZGV4IH0gOiBudWxsLFxuICAgICAgICAgICAgXCJfY2hpbGRyZW5cIjogW10sIFwiX2FjdGl2ZVwiOiBub2RlRGF0YS5hY3RpdmUgIT09IGZhbHNlLCBcIl9jb21wb25lbnRzXCI6IFtdLCBcIl9wcmVmYWJcIjogbnVsbCxcbiAgICAgICAgICAgIFwiX2xwb3NcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogbHBvcy54IHx8IDAsIFwieVwiOiBscG9zLnkgfHwgMCwgXCJ6XCI6IGxwb3MueiB8fCAwIH0sXG4gICAgICAgICAgICBcIl9scm90XCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlF1YXRcIiwgXCJ4XCI6IGxyb3QueCB8fCAwLCBcInlcIjogbHJvdC55IHx8IDAsIFwielwiOiBscm90LnogfHwgMCwgXCJ3XCI6IGxyb3QudyAhPT0gdW5kZWZpbmVkID8gbHJvdC53IDogMSB9LFxuICAgICAgICAgICAgXCJfbHNjYWxlXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGxzY2FsZS54ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueCA6IDEsIFwieVwiOiBsc2NhbGUueSAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnkgOiAxLCBcInpcIjogbHNjYWxlLnogIT09IHVuZGVmaW5lZCA/IGxzY2FsZS56IDogMSB9LFxuICAgICAgICAgICAgXCJfbW9iaWxpdHlcIjogMCwgXCJfbGF5ZXJcIjogbGF5ZXIsXG4gICAgICAgICAgICBcIl9ldWxlclwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBldWxlci54IHx8IDAsIFwieVwiOiBldWxlci55IHx8IDAsIFwielwiOiBldWxlci56IHx8IDAgfSwgXCJfaWRcIjogXCJcIlxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlcmlhbGl6ZSBvbmUgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogVGhlIGNhcHR1cmVkIGR1bXAgaXMgdGhlIHNvdXJjZSBvZiB0cnV0aCBmb3IgZXZlcnkgY29tcG9uZW50IHR5cGUuIFRoZSBwZXItdHlwZVxuICAgICAqIHRhYmxlcyBiZWxvdyBvbmx5IGZpbGwgaW4ga2V5cyB0aGUgZHVtcCBkaWQgbm90IGNhcnJ5IOKAlCB0aGV5IHVzZWQgdG8gcnVuICppbnN0ZWFkKlxuICAgICAqIG9mIHRoZSBkdW1wLCB3aGljaCBzaWxlbnRseSB3cm90ZSBlbmdpbmUgZGVmYXVsdHMgZm9yIGBjYy5VSVRyYW5zZm9ybWAsXG4gICAgICogYGNjLlNwcml0ZWAsIGBjYy5CdXR0b25gIGFuZCBgY2MuTGFiZWxgLCBhbmQgd3JvdGUgbm90aGluZyBhdCBhbGwgZm9yIGV2ZXJ5IG90aGVyXG4gICAgICogdHlwZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNyZWF0ZUNvbXBvbmVudE9iamVjdChjb21wb25lbnREYXRhOiBhbnksIG5vZGVJbmRleDogbnVtYmVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGNvbXBvbmVudERhdGEudHlwZSB8fCBjb21wb25lbnREYXRhLl9fdHlwZV9fIHx8ICdjYy5Db21wb25lbnQnO1xuICAgICAgICBjb25zdCBlbmFibGVkID0gY29tcG9uZW50RGF0YS5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wb25lbnREYXRhLmVuYWJsZWQgOiB0cnVlO1xuICAgICAgICBjb25zdCBjb21wb25lbnQ6IGFueSA9IHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogY29tcG9uZW50VHlwZSwgXCJfbmFtZVwiOiBcIlwiLCBcIl9vYmpGbGFnc1wiOiAwLCBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICBcIm5vZGVcIjogeyBcIl9faWRfX1wiOiBub2RlSW5kZXggfSwgXCJfZW5hYmxlZFwiOiBlbmFibGVkLCBcIl9fcHJlZmFiXCI6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBwcm9wZXJ0aWVzID0gY29tcG9uZW50RGF0YS5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICBjb25zdCByZW5hbWVzID0gRFVNUF9LRVlfUkVOQU1FU1tjb21wb25lbnRUeXBlXSB8fCB7fTtcblxuICAgICAgICAvLyBEcm9wIGV2ZXJ5IGFjY2Vzc29yIGtleSB0aGF0IGhhcyBpdHMgc2VyaWFsaXplZCB0d2luIHJpZ2h0IHRoZXJlIGluIHRoZSBzYW1lIGR1bXBcbiAgICAgICAgLy8gKCMxMTQgZGVmZWN0IDIpLiBUaGUgdW5kZXJzY29yZSBzcGVsbGluZyBpcyB0aGUgb25lIHRoZSBlbmdpbmUgcmVhZHMgYmFjazsga2VlcGluZ1xuICAgICAgICAvLyBib3RoIGlzIHdoYXQgbWFkZSB0aGUgaW1wb3J0ZXIgcmVqZWN0IHRoZSBmaWxlLiBDb21wdXRlZCBvbmNlLCB1cCBmcm9udCwgc28gdGhlXG4gICAgICAgIC8vIHJlbmFtZS10YWJsZSBicmFuY2hlcyBiZWxvdyBjYW5ub3QgcmVpbnRyb2R1Y2UgYSBrZXkgdGhpcyByZW1vdmVkLlxuICAgICAgICBjb25zdCBhY2Nlc3NvclR3aW5zID0gbmV3IFNldChmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlLCBwcm9wZXJ0aWVzKSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocHJvcGVydGllcykpIHtcbiAgICAgICAgICAgIGlmIChEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQuaGFzKGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGFjY2Vzc29yVHdpbnMuaGFzKGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgcHJvcFZhbHVlID0gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkodmFsdWUsIGNvbnRleHQsIGAke3JlbmFtZXNba2V5XSB8fCBrZXl9YCk7XG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudFtyZW5hbWVzW2tleV0gfHwga2V5XSA9IHByb3BWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgZmFsbGJhY2tdIG9mIE9iamVjdC5lbnRyaWVzKENPTVBPTkVOVF9ERUZBVUxUU1tjb21wb25lbnRUeXBlXSB8fCB7fSkpIHtcbiAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwga2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFtrZXldID0gdHlwZW9mIGZhbGxiYWNrID09PSAnb2JqZWN0JyAmJiBmYWxsYmFjayAhPT0gbnVsbCA/IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZmFsbGJhY2spKSA6IGZhbGxiYWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEEgYnV0dG9uIHdpdGggbm8gY2FwdHVyZWQgdGFyZ2V0IHBvaW50cyBhdCBpdHMgb3duIG5vZGUsIG1hdGNoaW5nIGVkaXRvciBiZWhhdmlvdXIuXG4gICAgICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuQnV0dG9uJyAmJiBjb21wb25lbnQuX3RhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX3RhcmdldCA9IHsgXCJfX2lkX19cIjogbm9kZUluZGV4IH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbnN1cmUgX2lkIGlzIGxhc3QgKG1hdGNoZXMgZW5naW5lIHNlcmlhbGl6YXRpb24gb3JkZXIpXG4gICAgICAgIGNvbnN0IF9pZCA9IGNvbXBvbmVudC5faWQgfHwgXCJcIjtcbiAgICAgICAgZGVsZXRlIGNvbXBvbmVudC5faWQ7XG4gICAgICAgIGNvbXBvbmVudC5faWQgPSBfaWQ7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ291bnQgdGhlIGR1bXAgZW50cmllcyB0aGF0IHdvdWxkIGFjdHVhbGx5IGJlIHNlcmlhbGl6ZWQsIHNvIHRoZSBwb3N0LXdyaXRlIGNoZWNrXG4gICAgICogb25seSBkZW1hbmRzIHByb3BlcnRpZXMgZm9yIGNvbXBvbmVudHMgdGhhdCBoYWQgc29tZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNvdW50U2VyaWFsaXphYmxlUHJvcHMocHJvcGVydGllczogYW55KTogbnVtYmVyIHtcbiAgICAgICAgaWYgKCFwcm9wZXJ0aWVzIHx8IHR5cGVvZiBwcm9wZXJ0aWVzICE9PSAnb2JqZWN0JykgcmV0dXJuIDA7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5maWx0ZXIoayA9PiAhRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrKSkubGVuZ3RoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydCBjb21wb25lbnQgdHlwZXMgdGhhdCBjYXJyaWVkIGxpdmUgcHJvcGVydGllcyBpbiB0aGUgc2NlbmUgYnV0IHNlcmlhbGl6ZWQgdG9cbiAgICAgKiBub3RoaW5nIGJ1dCB0aGUgYmFzZSBlbnZlbG9wZS4gYGFjdGlvbj1jcmVhdGVgIHByZXZpb3VzbHkgcmVwb3J0ZWQgc3VjY2VzcyBpblxuICAgICAqIGV4YWN0bHkgdGhhdCBzdGF0ZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHByZWZhYkRhdGE6IGFueVtdLCBub2RlRGF0YTogYW55KTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXAgb2YgKG5vZGUuY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb3VudFNlcmlhbGl6YWJsZVByb3BzKGNvbXA/LnByb3BlcnRpZXMpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5hZGQoY29tcC50eXBlIHx8IGNvbXAuX190eXBlX18gfHwgJ1Vua25vd24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHdhbGsobm9kZURhdGEpO1xuICAgICAgICBpZiAoZXhwZWN0ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gICAgICAgIGNvbnN0IHBvcHVsYXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHByZWZhYkRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCAhZXhwZWN0ZWQuaGFzKGVudHJ5Ll9fdHlwZV9fKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZW50cnkpLnNvbWUoa2V5ID0+ICFCQVNFX0NPTVBPTkVOVF9LRVlTLmhhcyhrZXkpKSkgcG9wdWxhdGVkLmFkZChlbnRyeS5fX3R5cGVfXyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5leHBlY3RlZF0uZmlsdGVyKHR5cGUgPT4gIXBvcHVsYXRlZC5oYXModHlwZSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFjY2Vzc29yIHR3aW5zIHRoZSBDQVBUVVJFRCBzY2VuZSBkdW1wIGNhcnJpZWQgdGhhdCBzdXJ2aXZlZCBpbnRvIHRoZSBlbWl0dGVkIHByZWZhYi5cbiAgICAgKlxuICAgICAqIFRoaXMgaXMgdGhlIHJlYWwgIzExNC1kZWZlY3QtMiBpbnZhcmlhbnQsIGFuZCBpdCBpcyBkZWxpYmVyYXRlbHkgYSBESUZGRVJFTkNFIGNoZWNrXG4gICAgICogcmF0aGVyIHRoYW4gYSByZS1ydW4gb2YgdGhlIGVtaXNzaW9uIGZpbHRlcidzIG93biBwcmVkaWNhdGUuIEFza2luZ1xuICAgICAqIGBmaW5kQWNjZXNzb3JUd2luS2V5c2AgYWJvdXQgYHByZWZhYkNvbnRlbnRgIHdvdWxkIHJlLWFzayB0aGUgcXVlc3Rpb24gdGhlIGZpbHRlciBqdXN0XG4gICAgICogYW5zd2VyZWQgYW5kIHNvIGNvdWxkIG5ldmVyIGZhaWwgKHNlZSB0aGUgY2FsbCBzaXRlIOKAlCBuZXV0ZXJpbmcgdGhhdCBicmFuY2ggbGVhdmVzXG4gICAgICogZXZlcnkgdGVzdCBncmVlbik7IGNvbXBhcmluZyBjYXB0dXJlIGFnYWluc3Qgb3V0cHV0IGZhaWxzIHdoZW5ldmVyIHRoZSBmaWx0ZXIgaXNcbiAgICAgKiByZW1vdmVkLCBtaXMtc2NvcGVkLCBvciB0aGUgZHVtcCBzaGFwZSBjaGFuZ2VzIHVuZGVyIGl0LlxuICAgICAqXG4gICAgICogUGVyLW5vZGUgY29tcG9uZW50IGNvdW50cyBhcmUgY29tcGFyZWQgcG9zaXRpb25hbGx5IGluc3RlYWQgb2YgYnkgdXVpZCwgYmVjYXVzZSBhIG5vZGVcbiAgICAgKiBjYW4gaG9sZCBzZXZlcmFsIGNvbXBvbmVudHMgb2YgdGhlIHNhbWUgdHlwZSB3aXRoIG5vIHV1aWQgZGlzdGluZ3Vpc2hhYmxlIGF0IHRoaXNcbiAgICAgKiBsZXZlbC4gVGhlIGNvdW50cyBjb21lIGZyb20gdGhlIHNhbWUgd2Fsa3MgdGhlIHNlcmlhbGl6ZXIgdXNlcyAoYGNvbXBvbmVudHNgIGFuZFxuICAgICAqIGBwcm9wZXJ0aWVzYCksIHNvIHRoZXkgYWx3YXlzIGFncmVlIHdpdGggd2hhdCBgY3JlYXRlQ29tcG9uZW50T2JqZWN0YCBzYXc7IG9ubHkgdGhlXG4gICAgICogc2hhcGUtZGVwZW5kZW50IGRldGFpbHMgZGlmZmVyLCBhbmQgdGhvc2UgYXJlIGlnbm9yZWQgcmF0aGVyIHRoYW4gZ3Vlc3NlZCBhdC5cbiAgICAgKlxuICAgICAqIFB1cmUgYW5kIGV4cG9ydGVkIHNvIGJvdGggZGlyZWN0aW9ucyBhcmUgdW5pdC10ZXN0YWJsZTogaXQgbXVzdCBmaXJlIHdoZW4gYW4gYWNjZXNzb3JcbiAgICAgKiBrZXkgaXMgd3JpdHRlbiBiZXNpZGUgaXRzIHR3aW4sIGFuZCBzdGF5IHNpbGVudCBvbiB0aGUgcmVwYWlyZWQgc2hhcGUuXG4gICAgICovXG4gICAgZmluZENhcHR1cmVkQWNjZXNzb3JUd2lucyhub2RlRGF0YTogYW55LCBwcmVmYWJEYXRhOiBhbnlbXSk6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiB7XG4gICAgICAgIGNvbnN0IGNhcHR1cmVkOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4gPSBbXTtcbiAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wIG9mIChub2RlLmNvbXBvbmVudHMgfHwgW10pKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGNvbXA/LnR5cGUgfHwgY29tcD8uX190eXBlX18gfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBjb21wPy5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleXMgPSBmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSBjYXB0dXJlZC5wdXNoKHsgdHlwZTogY29tcG9uZW50VHlwZSwga2V5cyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgKG5vZGUuY2hpbGRyZW4gfHwgW10pKSB3YWxrKGNoaWxkKTtcbiAgICAgICAgfTtcbiAgICAgICAgd2Fsayhub2RlRGF0YSk7XG4gICAgICAgIGlmIChjYXB0dXJlZC5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICAgICAgICAvLyBUaGUgcHJlZmFiIGVudHJpZXMgZm9yIG5vZGUgMCBvbndhcmQsIHNraXBwaW5nIHRoZSBsZWFkaW5nIGNjLlByZWZhYiBhc3NldCByZWNvcmRcbiAgICAgICAgLy8gKGFuZCBhbnkgbGVhZGluZyBudWxsIHNsb3RzKSwgYXJlIHRoZSBzZXJpYWxpemVkIG5vZGVzIGluIHdhbGsgb3JkZXIuXG4gICAgICAgIGNvbnN0IG5vZGVFbnRyaWVzID0gcHJlZmFiRGF0YS5maWx0ZXIoXG4gICAgICAgICAgICBlbnRyeSA9PiBlbnRyeSAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnICYmIGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuUHJlZmFiJyAmJiBBcnJheS5pc0FycmF5KGVudHJ5Ll9jb21wb25lbnRzKVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IHN1cnZpdmVkOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4gPSBbXTtcbiAgICAgICAgbGV0IGN1cnNvciA9IDA7XG4gICAgICAgIGNvbnN0IGNoZWNrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRDb3VudCA9IEFycmF5LmlzQXJyYXkobm9kZS5jb21wb25lbnRzKSA/IG5vZGUuY29tcG9uZW50cy5sZW5ndGggOiAwO1xuICAgICAgICAgICAgY29uc3QgZW50cnk6IGFueSA9IG5vZGVFbnRyaWVzW2N1cnNvcisrXTtcbiAgICAgICAgICAgIGNvbnN0IGVtaXR0ZWQ6IGFueVtdID0gKGVudHJ5ICYmIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpKVxuICAgICAgICAgICAgICAgID8gZW50cnkuX2NvbXBvbmVudHMubWFwKChyZWY6IGFueSkgPT4gcHJlZmFiRGF0YVtyZWY/Ll9faWRfX10pLmZpbHRlcihCb29sZWFuKVxuICAgICAgICAgICAgICAgIDogW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbXBvbmVudENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gbm9kZS5jb21wb25lbnRzW2ldPy50eXBlIHx8IG5vZGUuY29tcG9uZW50c1tpXT8uX190eXBlX18gfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleXMgPSBmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlLCBlbWl0dGVkW2ldICYmIHR5cGVvZiBlbWl0dGVkW2ldID09PSAnb2JqZWN0JyA/IGVtaXR0ZWRbaV0gOiB7fSk7XG4gICAgICAgICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkgc3Vydml2ZWQucHVzaCh7IHR5cGU6IGNvbXBvbmVudFR5cGUsIGtleXMgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgY2hlY2soY2hpbGQpO1xuICAgICAgICB9O1xuICAgICAgICBjaGVjayhub2RlRGF0YSk7XG5cbiAgICAgICAgLy8gUmVwb3J0IHRoZSBjYXB0dXJlZCBzZXQsIG5hcnJvd2VkIHRvIHRoZSB0d2luIG5hbWVzIGFjdHVhbGx5IG9ic2VydmVkIHN1cnZpdmluZyBzb1xuICAgICAgICAvLyB0aGUgbWVzc2FnZSBuYW1lcyB0aGUgcmVhbCBsZWFrIHJhdGhlciB0aGFuIHJlc3RhdGluZyB3aGF0IHRoZSBkdW1wIGhlbGQuXG4gICAgICAgIHJldHVybiBjYXB0dXJlZC5maWx0ZXIoY2FwID0+XG4gICAgICAgICAgICBzdXJ2aXZlZC5zb21lKHN1cnYgPT4gc3Vydi50eXBlID09PSBjYXAudHlwZSAmJiBzdXJ2LmtleXMuc29tZShrID0+IGNhcC5rZXlzLmluY2x1ZGVzKGspKSlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKiogUmUtcmVhZCB0aGUgd3JpdHRlbiBwcmVmYWI7IGZhbGxzIGJhY2sgdG8gdGhlIGluLW1lbW9yeSBjb250ZW50IHdoZW4gdGhlIHBhdGggaXMgdW5yZXNvbHZhYmxlLiAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVhZEJhY2tQcmVmYWIoc2F2ZVBhdGg6IHN0cmluZywgZmFsbGJhY2s6IGFueVtdKTogUHJvbWlzZTx7IGRhdGE6IGFueVtdOyBzb3VyY2U6ICdkaXNrJyB8ICdpbi1tZW1vcnknIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHNhdmVQYXRoKTtcbiAgICAgICAgICAgIGlmIChyZXNvbHZlZC5maWxlUGF0aCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHJlc29sdmVkLmZpbGVQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHsgZGF0YTogcGFyc2VkLCBzb3VyY2U6ICdkaXNrJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaCB0byB0aGUgaW4tbWVtb3J5IGNvbnRlbnRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBkYXRhOiBmYWxsYmFjaywgc291cmNlOiAnaW4tbWVtb3J5JyB9O1xuICAgIH1cblxuICAgIC8qKiBUeXBlIG5hbWVzIHdob3NlIGR1bXAgdmFsdWUgaXMgYW4gQVNTRVQgcmVmZXJlbmNlIHJhdGhlciB0aGFuIGEgY29tcG9uZW50IHJlZmVyZW5jZS4gKi9cbiAgICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBBU1NFVF9UWVBFUyA9IG5ldyBTZXQoW1xuICAgICAgICAnY2MuUHJlZmFiJywgJ2NjLlRleHR1cmUyRCcsICdjYy5TcHJpdGVGcmFtZScsICdjYy5NYXRlcmlhbCcsICdjYy5BbmltYXRpb25DbGlwJyxcbiAgICAgICAgJ2NjLkF1ZGlvQ2xpcCcsICdjYy5Gb250JywgJ2NjLkFzc2V0JywgJ2NjLlRURkZvbnQnLCAnY2MuQml0bWFwRm9udCcsICdjYy5MYWJlbEF0bGFzJyxcbiAgICAgICAgJ2NjLlNwcml0ZUF0bGFzJywgJ2NjLkpzb25Bc3NldCcsICdjYy5UZXh0QXNzZXQnLCAnY2MuUGFydGljbGVBc3NldCcsICdjYy5NZXNoJyxcbiAgICAgICAgJ2NjLlNrZWxldG9uJywgJ2NjLlJlbmRlclRleHR1cmUnLCAnY2MuUGh5c2ljc01hdGVyaWFsJywgJ2NjLlNjZW5lQXNzZXQnLCAnY2MuRWZmZWN0QXNzZXQnLFxuICAgIF0pO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXNzZXQgaXMgZWl0aGVyIGV4cGxpY2l0bHkgbGlzdGVkIG9yIG5hbWVkIGJ5IGEgc3VmZml4IG5vIGNvbXBvbmVudCB0eXBlIHVzZXMuXG4gICAgICogVGhlIHN1ZmZpeCBhcm0gaXMgd2hhdCBrZWVwcyBhIGZ1dHVyZSBjb25jcmV0ZSBhc3NldCBzdWJjbGFzcyBmcm9tIHNpbGVudGx5IHJlZ3Jlc3NpbmdcbiAgICAgKiBpbnRvIHRoZSBjb21wb25lbnQtcmVmZXJlbmNlIGJyYW5jaCB0aGUgd2F5IGNjLlRURkZvbnQgZGlkLlxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIGlzQXNzZXRUeXBlKHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXR5cGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKFByZWZhYkNyZWF0aW9uU2VydmljZS5BU1NFVF9UWVBFUy5oYXModHlwZSkpIHJldHVybiB0cnVlO1xuICAgICAgICByZXR1cm4gLyg/OkZvbnR8QXNzZXR8QXRsYXN8Q2xpcCkkLy50ZXN0KHR5cGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgY29tcG9uZW50IHByb3BlcnR5IHZhbHVlcywgZW5zdXJpbmcgZm9ybWF0IG1hdGNoZXMgbWFudWFsbHktY3JlYXRlZCBwcmVmYWJzLlxuICAgICAqIEhhbmRsZXMgbm9kZSByZWZzLCBhc3NldCByZWZzLCBjb21wb25lbnQgcmVmcywgdHlwZWQgbWF0aC9jb2xvciBvYmplY3RzLCBhbmQgYXJyYXlzLlxuICAgICAqXG4gICAgICogVGhyb3dzIG9uIGEgcmVmZXJlbmNlIGl0IGNhbm5vdCBzZXJpYWxpemUgZmFpdGhmdWxseS4gRXZlcnkgYnJhbmNoIGJlbG93IHVzZWQgdG9cbiAgICAgKiBhbnN3ZXIgYW4gdW5yZXNvbHZhYmxlIHJlZmVyZW5jZSB3aXRoIGBudWxsYCAob3IgZHJvcCBpdCBmcm9tIGFuIGFycmF5KSwgd2hpY2ggaXMgaG93XG4gICAgICogYSBjcmVhdGVkIHByZWZhYiBjYW1lIG91dCBob2xsb3cgd2hpbGUgYGFjdGlvbj1jcmVhdGVgIHJlcG9ydGVkIHN1Y2Nlc3Mg4oCUIGlzc3VlICM3MydzXG4gICAgICogYF9tZXNoOiBudWxsYCwgYF9tYXRlcmlhbHM6IFtdYCBhbmQgYGxhYmVsUGVyY2VudDogbnVsbGAsIGVhY2ggb2Ygd2hpY2ggaGFkIGJlZW5cbiAgICAgKiB3cml0dGVuIHRvIHRoZSBsaXZlIHNjZW5lIG1vbWVudHMgZWFybGllci4gQSByZWZlcmVuY2UgdGhhdCBjYW5ub3QgYmUgc2VyaWFsaXplZCBpcyBhXG4gICAgICogZmFpbHVyZSBvZiB0aGlzIGNhbGwsIG5vdCBhIHZhbHVlIG9mIGBudWxsYDogc2VlXG4gICAgICogYH4vLmNsYXVkZS9ydWxlcy9kZXZlbG9wbWVudC1wcmluY2lwbGVzLm1kYCDCpyBcIkVycm9ycyBPdmVyIFNpbGVudCBGYWxsYmFja3NcIi5cbiAgICAgKi9cbiAgICBwcml2YXRlIHByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShwcm9wRGF0YTogYW55LCBjb250ZXh0Pzoge1xuICAgICAgICBub2RlVXVpZFRvSW5kZXg/OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgICAgICBjb21wb25lbnRVdWlkVG9JbmRleD86IE1hcDxzdHJpbmcsIG51bWJlcj47XG4gICAgICAgIGxvc3Nlcz86IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PjtcbiAgICB9LCBwcm9wZXJ0eVBhdGggPSAnJyk6IGFueSB7XG4gICAgICAgIGlmICghcHJvcERhdGEgfHwgdHlwZW9mIHByb3BEYXRhICE9PSAnb2JqZWN0JykgcmV0dXJuIHByb3BEYXRhO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3BEYXRhLnZhbHVlO1xuICAgICAgICBjb25zdCB0eXBlID0gcHJvcERhdGEudHlwZTtcbiAgICAgICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICAvLyBBbiBleHBsaWNpdCBlbXB0eS11dWlkIHJlZmVyZW5jZSBpcyBhIGdlbnVpbmUgQ0xFQVIgKGlzc3VlICM3NSksIG5vdCBhIGxvc3MuXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLnV1aWQgPT09ICcnKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAvLyBOb2RlIHJlZmVyZW5jZXNcbiAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5Ob2RlJyAmJiB2YWx1ZT8udXVpZCkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQ/Lm5vZGVVdWlkVG9JbmRleD8uaGFzKHZhbHVlLnV1aWQpKSByZXR1cm4geyBcIl9faWRfX1wiOiBjb250ZXh0Lm5vZGVVdWlkVG9JbmRleC5nZXQodmFsdWUudXVpZCkgfTtcbiAgICAgICAgICAgIC8vIEEgbm9kZSBvdXRzaWRlIHRoZSBzdWJ0cmVlIGJlaW5nIHNlcmlhbGl6ZWQgY2Fubm90IGJlIGVuY29kZWQgaW4gYSBwcmVmYWIg4oCUXG4gICAgICAgICAgICAvLyB0aGUgZm9ybWF0IGhhcyBubyBjcm9zcy1maWxlIG5vZGUgcmVmZXJlbmNlLiBUaGlzIG9uZSBnZW51aW5lbHkgbXVzdCBiZVxuICAgICAgICAgICAgLy8gZHJvcHBlZCwgYnV0IGl0IGlzIHN0aWxsIGEgZGF0YSBsb3NzIGFuZCBpcyByZWNvcmRlZCBhcyBzdWNoLlxuICAgICAgICAgICAgdGhpcy5yZWNvcmRMb3NzKGNvbnRleHQsIHByb3BlcnR5UGF0aCwgdmFsdWUudXVpZCwgJ25vZGUgaXMgb3V0c2lkZSB0aGUgcHJlZmFiIHN1YnRyZWUgYmVpbmcgc2VyaWFsaXplZCcpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBc3NldCByZWZlcmVuY2VzLlxuICAgICAgICAvL1xuICAgICAgICAvLyBUaGlzIGJyYW5jaCBpcyB0aGUgREVGQVVMVCBmb3IgYW55IHJlZmVyZW5jZSBjYXJyeWluZyBhIHV1aWQsIGJlY2F1c2UgdGhlIHRlc3RzXG4gICAgICAgIC8vIGJlbG93IGNhbm5vdCBib3RoIGJlIHNhdGlzZmllZDogYGNjLkxhYmVsYCdzIGBmb250YCBpcyBhIGBjYy5UVEZGb250YCBBU1NFVFxuICAgICAgICAvLyAodGhpcyB0ZXN0IGZpbGUncyBvd24gZm9udCByZWdyZXNzaW9uKSwgd2hpbGUgYGNjLkxhYmVsYCBpcyBhbHNvIGEgbGVnaXRpbWF0ZVxuICAgICAgICAvLyBAcHJvcGVydHkgQ09NUE9ORU5UIHR5cGUuIFJlYWRpbmcgdGhlIHZhbHVlJ3MgdXVpZCBhcyBhbiBhc3NldCBpcyB3aGF0IG1ha2VzIHRoZVxuICAgICAgICAvLyBmb250IGNhc2UgY29ycmVjdDsgZXZlcnkgY29uY3JldGUgYXNzZXQgY2xhc3MgaXMgY2F1Z2h0IGJlbG93IGJ5IG5hbWUgb3Igc3VmZml4LlxuICAgICAgICAvL1xuICAgICAgICAvLyBBc3NldC1maXJzdCB3YXMgcHJldmlvdXNseSBieXBhc3NlZCBieSBkaXNwYXRjaGluZyBvbiBgaXNBc3NldFR5cGUodHlwZSlgIEZJUlNULFxuICAgICAgICAvLyBsZXR0aW5nIHRoZSBjb21wb25lbnQgYnJhbmNoJ3MgYHR5cGUuc3RhcnRzV2l0aCgnY2MuJylgIGNhdGNoLWFsbCBjbGFpbSBhbnkgdHlwZVxuICAgICAgICAvLyB0aGUgYWxsb3dsaXN0IGhhZCBub3QgYmVlbiB0YXVnaHQg4oCUIHRoZSBleGFjdCBtZWNoYW5pc20gYnkgd2hpY2ggYGNjLk1lc2hgIGFuZFxuICAgICAgICAvLyBgY2MuU2tlbGV0b25gIGJlY2FtZSBudWxsIGVudHJpZXMgaW4gYSBjcmVhdGVkIHByZWZhYiAoaXNzdWVzICM2NCwgIzcwLCAjNzMpLlxuICAgICAgICBpZiAodmFsdWU/LnV1aWQpIHtcbiAgICAgICAgICAgIGlmIChQcmVmYWJDcmVhdGlvblNlcnZpY2UuaXNBc3NldFR5cGUodHlwZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBcIl9fdXVpZF9fXCI6IHZhbHVlLnV1aWQsIFwiX19leHBlY3RlZFR5cGVfX1wiOiB0eXBlIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBJbi10cmVlIGNvbXBvbmVudCByZWZlcmVuY2U6IHRoZSB1dWlkIG5hbWVzIGEgY29tcG9uZW50IGluIHRoZSBzdWJ0cmVlIGJlaW5nXG4gICAgICAgICAgICAvLyBzZXJpYWxpemVkLCBzbyBpdCBlbmNvZGVzIGFzIGFuIG9iamVjdCBpbmRleC5cbiAgICAgICAgICAgIGlmIChjb250ZXh0Py5jb21wb25lbnRVdWlkVG9JbmRleD8uaGFzKHZhbHVlLnV1aWQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgXCJfX2lkX19cIjogY29udGV4dC5jb21wb25lbnRVdWlkVG9JbmRleC5nZXQodmFsdWUudXVpZCkgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFVucmVzb2x2ZWQuIEEgcHJlZmFiIGFzc2V0IGhhcyBubyB3YXkgdG8gZXhwcmVzcyBhIHJlZmVyZW5jZSB0byBzb21ldGhpbmdcbiAgICAgICAgICAgIC8vIG91dHNpZGUgdGhlIHN1YnRyZWUsIHNvIG51bGwgaXMgdGhlIG9ubHkgZW5jb2RhYmxlIGFuc3dlciDigJQgYnV0IHRoZSBudWxsIGlzXG4gICAgICAgICAgICAvLyBub3cgUkVDT1JERUQsIGFuZCB0aGUgY3JlYXRlIHBhdGhzIHJlZnVzZSB0byB3cml0ZSB3aGVuIGFueXRoaW5nIHdhcyByZWNvcmRlZC5cbiAgICAgICAgICAgIC8vIGBudWxsYCBpbiBzaWxlbmNlIGlzIGlzc3VlICM3MydzIHByaW1hcnkgc3ltcHRvbSAoYF9tZXNoOiBudWxsYCxcbiAgICAgICAgICAgIC8vIGBfbWF0ZXJpYWxzOiBbXWAsIGBsYWJlbFBlcmNlbnQ6IG51bGxgIG9uIGEgY3JlYXRlZCBwcmVmYWIsIHdpdGhcbiAgICAgICAgICAgIC8vIGBzdWNjZXNzOiB0cnVlYCBhbmQgYHZhbGlkYXRlYCBncmVlbik7IGEgcmVwb3J0ZWQgbG9zcyB0aGF0IGZhaWxzIHRoZSBjYWxsIGlzXG4gICAgICAgICAgICAvLyBub3QuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gVHdvIGNhdXNlcyByZWFjaCBoZXJlLCBhbmQgdGhlIG1lc3NhZ2UgbmFtZXMgYm90aCBiZWNhdXNlIHRoZSByZW1lZGllcyBkaWZmZXI6XG4gICAgICAgICAgICAvLyBhIHJlZmVyZW5jZSBnZW51aW5lbHkgb3V0c2lkZSB0aGUgc3VidHJlZSAobGVnaXRpbWF0ZSDigJQgYSBidXR0b24gcG9pbnRpbmcgYXRcbiAgICAgICAgICAgIC8vIGFub3RoZXIgcHJlZmFiKSwgYW5kIGFuIEFTU0VUIGNsYXNzIG1pc3NpbmcgZnJvbSBBU1NFVF9UWVBFUywgd2hpY2ggaXMgdGhlXG4gICAgICAgICAgICAvLyBtZWNoYW5pc20gYmVoaW5kIGlzc3VlcyAjNjQvIzcwLyM3MyBhbmQgd2FudHMgdGhlIGFsbG93bGlzdCBleHRlbmRlZC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBEZWxpYmVyYXRlbHkgTk9UIGEgdGhyb3c6IGBwcm9jZXNzQ29tcG9uZW50UHJvcGVydHlgIHJ1bnMgaW5zaWRlXG4gICAgICAgICAgICAvLyBgY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50YCwgd2hvc2UgY29udHJhY3QgaXMgdG8gUkVUVVJOIHRoZSBwcmVmYWIgSlNPTiwgYW5kXG4gICAgICAgICAgICAvLyB0aHJvd2luZyBoZXJlIHdvdWxkIGFsc28gY2F0Y2ggc2NyaXB0IGNvbXBvbmVudCByZWZlcmVuY2VzIChgQnVja2V0U2NyaXB0YCBpc1xuICAgICAgICAgICAgLy8gbm90IGEgYGNjLmAgY2xhc3MpLCB3aGljaCBhcmUgYSBsZWdpdGltYXRlIGV4dGVybmFsIHJlZmVyZW5jZSDigJQgdHVybmluZyBhXG4gICAgICAgICAgICAvLyBzdXBwb3J0ZWQgbnVsbCBpbnRvIGEgZmFpbHVyZS4gVGhlIGxvc3MgbGlzdCBpcyB0aGUgY2hhbm5lbCB0aGF0IGRpc3Rpbmd1aXNoZXNcbiAgICAgICAgICAgIC8vIHRoZW0gYnkgY2FsbCBzaXRlIHJhdGhlciB0aGFuIGJ5IGd1ZXNzaW5nIGZyb20gdGhlIHR5cGUgbmFtZS5cbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgUmVmZXJlbmNlICR7dHlwZX0gVVVJRCAke3ZhbHVlLnV1aWR9IGhhcyBubyBlbmNvZGFibGUgZm9ybSBpbiBhIHByZWZhYiAocHJvcGVydHkgJyR7cHJvcGVydHlQYXRoIHx8ICcodW5rbm93biknfScpYCk7XG4gICAgICAgICAgICB0aGlzLnJlY29yZExvc3MoXG4gICAgICAgICAgICAgICAgY29udGV4dCwgcHJvcGVydHlQYXRoLCB2YWx1ZS51dWlkLFxuICAgICAgICAgICAgICAgIGB0eXBlICcke3R5cGV9JyBoYXMgbm8gZW5jb2RhYmxlIGZvcm0g4oCUIGVpdGhlciBpdCBpcyBvdXRzaWRlIHRoZSBwcmVmYWIgc3VidHJlZSAobGVnaXRpbWF0ZSBmb3IgYSBjb21wb25lbnQgcmVmZXJlbmNlKSBgICtcbiAgICAgICAgICAgICAgICBgb3IgaXQgaXMgYW4gYXNzZXQgY2xhc3MgbWlzc2luZyBmcm9tIFByZWZhYkNyZWF0aW9uU2VydmljZS5BU1NFVF9UWVBFUyAoaXNzdWVzICM2NC8jNzAvIzczKWBcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFR5cGVkIG1hdGgvY29sb3Igb2JqZWN0c1xuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5Db2xvcicpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUucikgfHwgMCkpLCBcImdcIjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuZykgfHwgMCkpLCBcImJcIjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuYikgfHwgMCkpLCBcImFcIjogdmFsdWUuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuYSkpKSA6IDI1NSB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5WZWMzJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IE51bWJlcih2YWx1ZS54KSB8fCAwLCBcInlcIjogTnVtYmVyKHZhbHVlLnkpIHx8IDAsIFwielwiOiBOdW1iZXIodmFsdWUueikgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5WZWMyJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzJcIiwgXCJ4XCI6IE51bWJlcih2YWx1ZS54KSB8fCAwLCBcInlcIjogTnVtYmVyKHZhbHVlLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuU2l6ZScpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5TaXplXCIsIFwid2lkdGhcIjogTnVtYmVyKHZhbHVlLndpZHRoKSB8fCAwLCBcImhlaWdodFwiOiBOdW1iZXIodmFsdWUuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlF1YXQnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuUXVhdFwiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCwgXCJ6XCI6IE51bWJlcih2YWx1ZS56KSB8fCAwLCBcIndcIjogdmFsdWUudyAhPT0gdW5kZWZpbmVkID8gTnVtYmVyKHZhbHVlLncpIDogMSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXJyYXkgcHJvcGVydGllcy5cbiAgICAgICAgLy8gRWFjaCBlbGVtZW50IG9mIGFuIGFycmF5LXR5cGVkIGR1bXAgKGUuZy4gY2MuTWVzaFJlbmRlcmVyJ3Mgc2hhcmVkTWF0ZXJpYWxzL1xuICAgICAgICAvLyBfbWF0ZXJpYWxzKSBpcyBpdHNlbGYgYSBuZXN0ZWQgcHJvcGVydHkgZGVzY3JpcHRvciDigJQgeyB2YWx1ZTogeyB1dWlkIH0sIHR5cGUsIC4uLiB9XG4gICAgICAgIC8vIOKAlCBub3QgYSBmbGF0IHsgdXVpZCB9LiBSZWFkaW5nIGl0ZW0udXVpZCBkaXJlY3RseSBtYXRjaGVkIG5vdGhpbmcgZm9yIGV2ZXJ5IGVsZW1lbnQsXG4gICAgICAgIC8vIHNvIGEgTWVzaFJlbmRlcmVyJ3MgYXNzaWduZWQgbWF0ZXJpYWwgc2lsZW50bHkgc2VyaWFsaXplZCBhcyBhbiBlbXB0eSBhcnJheSB3aGlsZVxuICAgICAgICAvLyByZXBvcnRpbmcgc3VjY2VzcyAodmVyaWZpZWQgbGl2ZSBhZ2FpbnN0IGEgc21hcnQtaW1wb3J0ZWQgRkJYIG1hdGVyaWFsKS5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gRWxlbWVudHMgYXJlIHNlcmlhbGl6ZWQgdGhyb3VnaCB0aGlzIHNhbWUgZnVuY3Rpb24gcmF0aGVyIHRoYW4gYSBsb2NhbFxuICAgICAgICAvLyBgeyBfX3V1aWRfXyB9YCBzaGFwZSwgc28gYSBjb25jcmV0ZS1jbGFzcyBhc3NldCB0eXBlIHJlYWNoZXMgdGhlIGFzc2V0IGJyYW5jaFxuICAgICAgICAvLyBpbnN0ZWFkIG9mIGEgaGFyZGNvZGVkIGNvbnNlcXVlbmNlIG9mIGBlbGVtZW50VHlwZURhdGFgLiBUaGUgb2xkIHNoYXBlIGRlY2xhcmVkXG4gICAgICAgIC8vIGBlbGVtZW50VHlwZURhdGEudHlwZWAgZm9yIGV2ZXJ5IGVsZW1lbnQgcmVnYXJkbGVzcyBvZiB3aGF0IHRoZSBlbGVtZW50IGFjdHVhbGx5XG4gICAgICAgIC8vIHJlZmVyZW5jZWQg4oCUIGFuZCBgLmZpbHRlcihCb29sZWFuKWAgdHVybmVkIGVhY2ggdW5yZXNvbHZlZCBlbGVtZW50IGludG8gYSBzaWxlbnRseVxuICAgICAgICAvLyBzaG9ydGVyIGFycmF5LCB3aGljaCBpcyBpc3N1ZSAjNzMncyBgX21hdGVyaWFsczogW11gIGV4YWN0bHk6IGFuIGFycmF5IHByb3BlcnR5XG4gICAgICAgIC8vIHRoYXQgaGFkIGNvbnRlbnRzIG9uIHRoZSBsaXZlIG5vZGUgYW5kIGNhbWUgb3V0IG9mIHRoZSBjcmVhdGVkIHByZWZhYiBlbXB0eSwgd2l0aFxuICAgICAgICAvLyBgc3VjY2VzczogdHJ1ZWAgYW5kIGB2YWxpZGF0ZWAgcmVwb3J0aW5nIGBpc1ZhbGlkOiB0cnVlYCBvdmVyIHRoZSByZXN1bHQuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgY29uc3QgZWxlbWVudFR5cGUgPSBwcm9wRGF0YS5lbGVtZW50VHlwZURhdGE/LnR5cGU7XG4gICAgICAgICAgICBjb25zdCBzZXJpYWxpemVkID0gdmFsdWUubWFwKChpdGVtOiBhbnksIGluZGV4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpdGVtVXVpZCA9IGl0ZW0/LnV1aWQgfHwgaXRlbT8udmFsdWU/LnV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKCFpdGVtVXVpZCAmJiBlbGVtZW50VHlwZSAmJiAhZWxlbWVudFR5cGUuc3RhcnRzV2l0aCgnY2MuJykpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gTm90IGEgcmVmZXJlbmNlIGFycmF5IGF0IGFsbCDigJQgYW4gYXJyYXkgb2YgcGxhaW4gdmFsdWVzLlxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXRlbT8udmFsdWUgIT09IHVuZGVmaW5lZCA/IGl0ZW0udmFsdWUgOiBpdGVtO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBBbiBlbGVtZW50J3Mgb3duIGB0eXBlYCBpcyBhdXRob3JpdGF0aXZlOyBgZWxlbWVudFR5cGVEYXRhYCBpcyBvbmx5IHRoZVxuICAgICAgICAgICAgICAgIC8vIGRlY2xhcmVkIGFycmF5IGVsZW1lbnQgY2xhc3MsIGFuZCBmb3IgYSBzdWJjbGFzcyBlbGVtZW50IChgY2MuVFRGRm9udGBcbiAgICAgICAgICAgICAgICAvLyB1bmRlciBhIGBjYy5Gb250W11gLCBhIG5lc3RlZC1kZXNjcmlwdG9yIG1hdGVyaWFsKSB0aGUgZGVjbGFyZWQgY2xhc3MgaXNcbiAgICAgICAgICAgICAgICAvLyB0aGUgd3JvbmcgdGhpbmcgdG8gd3JpdGUuXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICB7IHZhbHVlOiBpdGVtPy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gaXRlbS52YWx1ZSA6IGl0ZW0sIHR5cGU6IGl0ZW0/LnR5cGUgfHwgZWxlbWVudFR5cGUgfSxcbiAgICAgICAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgYCR7cHJvcGVydHlQYXRofVske2luZGV4fV1gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gQSBkcm9wcGVkIGVsZW1lbnQgaXMgYSBsb3NzLCBub3QgYSBzaG9ydGVyIGFycmF5LiBgbWFwYCBuZXZlciBwcm9kdWNlc1xuICAgICAgICAgICAgLy8gdW5kZWZpbmVkIGhlcmUsIHNvIHRoaXMgb25seSBmaXJlcyBpZiBhIGZ1dHVyZSBicmFuY2ggc3RhcnRzIHJldHVybmluZyBpdC5cbiAgICAgICAgICAgIHJldHVybiBzZXJpYWxpemVkLmZpbHRlcigoZW50cnk6IGFueSkgPT4gZW50cnkgIT09IHVuZGVmaW5lZCAmJiBlbnRyeSAhPT0gbnVsbCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBOZXN0ZWQgQ0NDbGFzcyBncm91cDogdGhlIGR1bXAgbmVzdHMgYW5vdGhlciBkZXNjcmlwdG9yIG1hcCB1bmRlciBgdmFsdWVgLlxuICAgICAgICAvLyBTZXJpYWxpemluZyBpdCB2ZXJiYXRpbSB3b3VsZCB3cml0ZSBlZGl0b3IgZGVzY3JpcHRvcnMgKHtuYW1lLCB2YWx1ZSwgdHlwZX0pXG4gICAgICAgIC8vIGludG8gdGhlIGFzc2V0IGluc3RlYWQgb2YgdGhlIHZhbHVlcyB0aGVtc2VsdmVzLlxuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdGhpcy5pc05lc3RlZFByb3BlcnR5TWFwKHZhbHVlKSkge1xuICAgICAgICAgICAgY29uc3QgbmVzdGVkOiBhbnkgPSB0eXBlID8geyBcIl9fdHlwZV9fXCI6IHR5cGUgfSA6IHt9O1xuICAgICAgICAgICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgaWYgKERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRC5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgbmVzdGVkVmFsdWUgPSB0aGlzLnByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShcbiAgICAgICAgICAgICAgICAgICAgZW50cnksIGNvbnRleHQsIHByb3BlcnR5UGF0aCA/IGAke3Byb3BlcnR5UGF0aH0uJHtrZXl9YCA6IGtleVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKG5lc3RlZFZhbHVlICE9PSB1bmRlZmluZWQpIG5lc3RlZFtrZXldID0gbmVzdGVkVmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmVzdGVkO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3RoZXIgY29tcGxleCB0eXBlZCBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHR5cGU/LnN0YXJ0c1dpdGgoJ2NjLicpKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IHR5cGUsIC4uLnZhbHVlIH07XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWNvcmQgYSByZWZlcmVuY2UgdGhhdCBjb3VsZCBub3QgYmUgc2VyaWFsaXplZCBmYWl0aGZ1bGx5LlxuICAgICAqXG4gICAgICogS2VwdCBhcyBhIGxpc3QgcmF0aGVyIHRoYW4gYSB0aHJvdyBmb3IgdGhlIHR3byBjYXNlcyB3aGVyZSB0aGUgcHJlZmFiIGZvcm1hdCBpdHNlbGZcbiAgICAgKiBjYW5ub3QgZXhwcmVzcyB0aGUgdmFsdWUgKGEgbm9kZS9jb21wb25lbnQgb3V0c2lkZSB0aGUgc3VidHJlZSkuIFRoZSBjcmVhdGUgcGF0aHMgdHVyblxuICAgICAqIGEgbm9uLWVtcHR5IGxpc3QgaW50byBhIGBmYXRhbGAgZmFpbHVyZSwgc28gdGhlIGxvc3MgaXMgbmV2ZXIgbWVyZWx5IGEgd2FybmluZyBpbiBhXG4gICAgICogbG9nIG5vYm9keSByZWFkcyDigJQgd2hpY2ggaXMgaG93ICM3MydzIGRyb3BwZWQgcmVmZXJlbmNlcyB3ZW50IHVubm90aWNlZCB0aHJvdWdoXG4gICAgICogYGNyZWF0ZWAgQU5EIGB2YWxpZGF0ZWAuXG4gICAgICovXG4gICAgcHJpdmF0ZSByZWNvcmRMb3NzKFxuICAgICAgICBjb250ZXh0OiB7IGxvc3Nlcz86IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PiB9IHwgdW5kZWZpbmVkLFxuICAgICAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgICAgICB1dWlkOiBzdHJpbmcsXG4gICAgICAgIHJlYXNvbjogc3RyaW5nXG4gICAgKTogdm9pZCB7XG4gICAgICAgIGlmICghY29udGV4dD8ubG9zc2VzKSByZXR1cm47XG4gICAgICAgIGNvbnRleHQubG9zc2VzLnB1c2goeyBwcm9wZXJ0eTogcHJvcGVydHkgfHwgJyh1bmtub3duKScsIHV1aWQsIHJlYXNvbiB9KTtcbiAgICB9XG5cbiAgICAvKiogUmVuZGVyIHJlY29yZGVkIGxvc3NlcyBhcyB0aGUgZmF0YWwgZmFpbHVyZSBtZXNzYWdlLCBvciBudWxsIHdoZW4gdGhlcmUgYXJlIG5vbmUuICovXG4gICAgcHJpdmF0ZSBkZXNjcmliZVJlZmVyZW5jZUxvc3Nlcyhsb3NzZXM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9Pik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBpZiAobG9zc2VzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IG5hbWVkID0gbG9zc2VzLm1hcChsID0+IGAnJHtsLnByb3BlcnR5fScgLT4gJHtsLnV1aWR9ICgke2wucmVhc29ufSlgKTtcbiAgICAgICAgcmV0dXJuIGAke2xvc3Nlcy5sZW5ndGh9IHJlZmVyZW5jZShzKSBjb3VsZCBub3QgYmUgc2VyaWFsaXplZDogJHtuYW1lZC5qb2luKCc7ICcpfS5gO1xuICAgIH1cblxuICAgIC8qKiBUcnVlIHdoZW4gZXZlcnkgZW50cnkgaXMgYW4gb2JqZWN0IGFuZCBhdCBsZWFzdCBvbmUgaXMgYSBDb2NvcyBwcm9wZXJ0eSBkZXNjcmlwdG9yLiAqL1xuICAgIHByaXZhdGUgaXNOZXN0ZWRQcm9wZXJ0eU1hcCh2YWx1ZTogUmVjb3JkPHN0cmluZywgYW55Pik6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXModmFsdWUpO1xuICAgICAgICBpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIGVudHJpZXMuZXZlcnkoKFssIGVudHJ5XSkgPT4gZW50cnkgIT09IG51bGwgJiYgdHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0JylcbiAgICAgICAgICAgICYmIGVudHJpZXMuc29tZSgoWywgZW50cnldKSA9PiBpc1Byb3BlcnR5RGVzY3JpcHRvcihlbnRyeSkpO1xuICAgIH1cblxuICAgIC8vID09PT09IEFzc2V0IERCIG9wZXJhdGlvbnMgPT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgY29udmVydE5vZGVUb1ByZWZhYkluc3RhbmNlKG5vZGVVdWlkOiBzdHJpbmcsIHByZWZhYlJlZjogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCBtZXRob2RzID0gW1xuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY29ubmVjdC1wcmVmYWItaW5zdGFuY2UnLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlJlZiB9KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcmVmYWItY29ubmVjdGlvbicsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiUmVmIH0pLFxuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnYXBwbHktcHJlZmFiLWxpbmsnLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlJlZiB9KVxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiBtZXRob2RzKSB7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCBtZXRob2QoKTsgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9OyB9IGNhdGNoIHsgLyogdHJ5IG5leHQgKi8gfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0FsbCBwcmVmYWIgY29ubmVjdGlvbiBtZXRob2RzIGZhaWxlZCcgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVQcmVmYWJXaXRoTWV0YShwcmVmYWJQYXRoOiBzdHJpbmcsIHByZWZhYkRhdGE6IGFueVtdLCBtZXRhRGF0YTogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZUFzc2V0RmlsZShwcmVmYWJQYXRoLCBKU09OLnN0cmluZ2lmeShwcmVmYWJEYXRhLCBudWxsLCAyKSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVBc3NldEZpbGUoYCR7cHJlZmFiUGF0aH0ubWV0YWAsIEpTT04uc3RyaW5naWZ5KG1ldGFEYXRhLCBudWxsLCAyKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIHNhdmUgcHJlZmFiIGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVBc3NldEZpbGUoZmlsZVBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IG1ldGhvZHMgPSBbXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBmaWxlUGF0aCwgY29udGVudCksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpLFxuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnd3JpdGUtYXNzZXQnLCBmaWxlUGF0aCwgY29udGVudClcbiAgICAgICAgXTtcbiAgICAgICAgZm9yIChjb25zdCBtZXRob2Qgb2YgbWV0aG9kcykge1xuICAgICAgICAgICAgdHJ5IHsgYXdhaXQgbWV0aG9kKCk7IHJldHVybjsgfSBjYXRjaCB7IC8qIHRyeSBuZXh0ICovIH1cbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FsbCBzYXZlIG1ldGhvZHMgZmFpbGVkJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVBc3NldFdpdGhBc3NldERCKGFzc2V0UGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBhc3NldFBhdGgsIGNvbnRlbnQsIHsgb3ZlcndyaXRlOiB0cnVlLCByZW5hbWU6IGZhbHNlIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogYXNzZXRJbmZvIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBhc3NldCBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVNZXRhV2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIG1ldGFDb250ZW50OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCBhc3NldFBhdGgsIEpTT04uc3RyaW5naWZ5KG1ldGFDb250ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBhc3NldEluZm8gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gY3JlYXRlIG1ldGEgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVpbXBvcnRBc3NldFdpdGhBc3NldERCKGFzc2V0UGF0aDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVpbXBvcnQtYXNzZXQnLCBhc3NldFBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcmVzdWx0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIHJlaW1wb3J0IGFzc2V0JyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB1cGRhdGVBc3NldFdpdGhBc3NldERCKGFzc2V0UGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgYXNzZXRQYXRoLCBjb250ZW50KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHJlc3VsdCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byB1cGRhdGUgYXNzZXQgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vID09PT09IEZvcm1hdCB2YWxpZGF0aW9uID09PT09XG5cbiAgICAvKipcbiAgICAgKiBTdHJ1Y3R1cmFsIHZhbGlkYXRpb24gb2YgYSBzZXJpYWxpemVkIHByZWZhYi5cbiAgICAgKlxuICAgICAqIFN0cnVjdHVyYWwgYWxvbmUgaXMgbm90IFwidmFsaWRcIjogYSBwcmVmYWIgd2hvc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHRvIHRoZWlyIGJhcmVcbiAgICAgKiBlbnZlbG9wZSBwYXNzZXMgZXZlcnkgY2hlY2sgaGVyZSB3aGlsZSBjYXJyeWluZyBub25lIG9mIHRoZSBzY2VuZSB2YWx1ZXMsIHdoaWNoIGlzIHdoeVxuICAgICAqIGBtYW5hZ2VfcHJlZmFiIGFjdGlvbj12YWxpZGF0ZWAgcmV0dXJuZWQgYGlzVmFsaWQ6IHRydWVgIG92ZXIgdGhlIGhvbGxvdyBvdXRwdXQgb2ZcbiAgICAgKiBpc3N1ZSAjNzMncyBvd24gcmVwcm8uIGBob2xsb3dDb21wb25lbnRzYCByZXBvcnRzIHRoZSBjb21wb25lbnRzIHRoYXQgaG9sZCBub3RoaW5nXG4gICAgICogYmV5b25kIGBCQVNFX0NPTVBPTkVOVF9LRVlTYCwgc28gXCJ2YWxpZFwiIGFuZCBcImVtcHR5XCIgYXJlIGRpc3Rpbmd1aXNoYWJsZS5cbiAgICAgKi9cbiAgICB2YWxpZGF0ZVByZWZhYkZvcm1hdChwcmVmYWJEYXRhOiBhbnkpOiB7IGlzVmFsaWQ6IGJvb2xlYW47IGlzc3Vlczogc3RyaW5nW107IG5vZGVDb3VudDogbnVtYmVyOyBjb21wb25lbnRDb3VudDogbnVtYmVyOyBob2xsb3dDb21wb25lbnRzOiBzdHJpbmdbXTsgZHVwbGljYXRlQWNjZXNzb3JLZXlzOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4gfSB7XG4gICAgICAgIGNvbnN0IGlzc3Vlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgaG9sbG93Q29tcG9uZW50czogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgZHVwbGljYXRlQWNjZXNzb3JLZXlzOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4gPSBbXTtcbiAgICAgICAgbGV0IG5vZGVDb3VudCA9IDA7XG4gICAgICAgIGxldCBjb21wb25lbnRDb3VudCA9IDA7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcmVmYWJEYXRhKSkge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goJ1ByZWZhYiBkYXRhIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGZhbHNlLCBpc3N1ZXMsIG5vZGVDb3VudCwgY29tcG9uZW50Q291bnQsIGhvbGxvd0NvbXBvbmVudHMsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcmVmYWJEYXRhLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goJ1ByZWZhYiBkYXRhIGlzIGVtcHR5Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBmYWxzZSwgaXNzdWVzLCBub2RlQ291bnQsIGNvbXBvbmVudENvdW50LCBob2xsb3dDb21wb25lbnRzLCBkdXBsaWNhdGVBY2Nlc3NvcktleXMgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXByZWZhYkRhdGFbMF0gfHwgcHJlZmFiRGF0YVswXS5fX3R5cGVfXyAhPT0gJ2NjLlByZWZhYicpIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdGaXJzdCBlbGVtZW50IG11c3QgYmUgY2MuUHJlZmFiIHR5cGUnKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBub2Rlc1dpdGhDb21wb25lbnRzID0gbmV3IFNldDxudW1iZXI+KCk7XG4gICAgICAgIHByZWZhYkRhdGEuZm9yRWFjaCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoaXRlbS5fX3R5cGVfXyA9PT0gJ2NjLk5vZGUnKSB7XG4gICAgICAgICAgICAgICAgbm9kZUNvdW50Kys7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgKGl0ZW0uX2NvbXBvbmVudHMgfHwgW10pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWYgJiYgdHlwZW9mIHJlZi5fX2lkX18gPT09ICdudW1iZXInKSBub2Rlc1dpdGhDb21wb25lbnRzLmFkZChyZWYuX19pZF9fKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGl0ZW0uX190eXBlX18gPT09ICdjYy5Db21wUHJlZmFiSW5mbycgfHwgIWl0ZW0uX190eXBlX18pIHtcbiAgICAgICAgICAgICAgICAvLyBTZXJpYWxpemF0aW9uIGJvb2trZWVwaW5nLCBuZXZlciBhIGNvbXBvbmVudCBpbnN0YW5jZS5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoU3RyaW5nKGl0ZW0uX190eXBlX18pLnN0YXJ0c1dpdGgoJ2NjLicpIHx8IGl0ZW0uX190eXBlX18pIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRDb3VudCsrO1xuICAgICAgICAgICAgICAgIC8vIEEgY29tcG9uZW50IHRoYXQgaXMgcmVmZXJlbmNlZCBmcm9tIGEgbm9kZSBidXQgY2FycmllcyBub3RoaW5nIGJ1dCB0aGVcbiAgICAgICAgICAgICAgICAvLyBlbnZlbG9wZSBoYXMgbG9zdCBldmVyeSBwcm9wZXJ0eSBpdCBoZWxkIGluIHRoZSBzY2VuZSAoIzI4LyM3MykuXG4gICAgICAgICAgICAgICAgY29uc3QgaG9sZHNOb3RoaW5nQnV0RW52ZWxvcGUgPSBPYmplY3Qua2V5cyhpdGVtKS5ldmVyeShrZXkgPT4gQkFTRV9DT01QT05FTlRfS0VZUy5oYXMoa2V5KSk7XG4gICAgICAgICAgICAgICAgaWYgKGhvbGRzTm90aGluZ0J1dEVudmVsb3BlICYmIHR5cGVvZiBpdGVtLm5vZGU/Ll9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICAgICAgaG9sbG93Q29tcG9uZW50cy5wdXNoKFN0cmluZyhpdGVtLl9fdHlwZV9fKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFuIGFjY2Vzc29yIGtleSBzaXR0aW5nIGJlc2lkZSBpdHMgc2VyaWFsaXplZCBgX2AtdHdpbiBpcyBhIHByZWZhYiB0aGVcbiAgICAgICAgICAgICAgICAvLyBpbXBvcnRlciByZWplY3RzICgjMTE0IGRlZmVjdCAyKS4gQ2hlY2tlZCBoZXJlIGJlY2F1c2UgYGFjdGlvbj12YWxpZGF0ZWBcbiAgICAgICAgICAgICAgICAvLyByZXBvcnRlZCBgaXNWYWxpZDogdHJ1ZWAgb24gdGhlIGJyb2tlbiBmaWxlIGJvdGggYmVmb3JlIEFORCBhZnRlciB0aGVcbiAgICAgICAgICAgICAgICAvLyByZXBvcnQncyBtYW51YWwgcmVwYWlyLCBzbyBpdCBjYXVnaHQgbm90aGluZyBhYm91dCB0aGlzIGNsYXNzLlxuICAgICAgICAgICAgICAgIGNvbnN0IHR3aW5zID0gZmluZEFjY2Vzc29yVHdpbktleXMoU3RyaW5nKGl0ZW0uX190eXBlX18pLCBpdGVtKTtcbiAgICAgICAgICAgICAgICBpZiAodHdpbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVBY2Nlc3NvcktleXMucHVzaCh7IHR5cGU6IFN0cmluZyhpdGVtLl9fdHlwZV9fKSwga2V5czogdHdpbnMgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKG5vZGVDb3VudCA9PT0gMCkgaXNzdWVzLnB1c2goJ1ByZWZhYiBtdXN0IGNvbnRhaW4gYXQgbGVhc3Qgb25lIG5vZGUnKTtcbiAgICAgICAgZm9yIChjb25zdCBob2xsb3cgb2YgWy4uLm5ldyBTZXQoaG9sbG93Q29tcG9uZW50cyldKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaChgQ29tcG9uZW50ICcke2hvbGxvd30nIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzIOKAlCBpdCBjYXJyaWVzIG5vbmUgb2YgdGhlIHNjZW5lIHZhbHVlcyBpdCBoYWQgKGlzc3VlcyAjMjgvIzczKWApO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZHVwIG9mIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cykge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goXG4gICAgICAgICAgICAgICAgYENvbXBvbmVudCAnJHtkdXAudHlwZX0nIHNlcmlhbGl6ZXMgYm90aCBhbiBhY2Nlc3NvciBrZXkgYW5kIGl0cyB1bmRlcnNjb3JlIHR3aW4gYCArXG4gICAgICAgICAgICAgICAgYCgke2R1cC5rZXlzLm1hcChrID0+IGAnJHtrfScvJ18ke2t9J2ApLmpvaW4oJywgJyl9KSDigJQgdGhlIGFzc2V0IGltcG9ydGVyIHJlamVjdHMgdGhpcyBgICtcbiAgICAgICAgICAgICAgICBgc2hhcGUgd2l0aCBcIkNhbm5vdCByZWFkIHByb3BlcnRpZXMgb2YgdW5kZWZpbmVkIChyZWFkaW5nICdfbmFtZScpXCIgKGlzc3VlICMxMTQpLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogaXNzdWVzLmxlbmd0aCA9PT0gMCwgaXNzdWVzLCBub2RlQ291bnQsIGNvbXBvbmVudENvdW50LCBob2xsb3dDb21wb25lbnRzLCBkdXBsaWNhdGVBY2Nlc3NvcktleXMgfTtcbiAgICB9XG5cbiAgICBjcmVhdGVTdGFuZGFyZE1ldGFDb250ZW50KHByZWZhYk5hbWU6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nKTogYW55IHtcbiAgICAgICAgcmV0dXJuIHsgXCJ2ZXJcIjogXCIxLjEuNTBcIiwgXCJpbXBvcnRlclwiOiBcInByZWZhYlwiLCBcImltcG9ydGVkXCI6IHRydWUsIFwidXVpZFwiOiBwcmVmYWJVdWlkLCBcImZpbGVzXCI6IFtcIi5qc29uXCJdLCBcInN1Yk1ldGFzXCI6IHt9LCBcInVzZXJEYXRhXCI6IHsgXCJzeW5jTm9kZU5hbWVcIjogcHJlZmFiTmFtZSB9IH07XG4gICAgfVxuXG4gICAgLy8gPT09PT0gVVVJRCB1dGlsaXRpZXMgPT09PT1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVVVUlEKCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNoYXJzID0gJzAxMjM0NTY3ODlhYmNkZWYnO1xuICAgICAgICBsZXQgdXVpZCA9ICcnO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDMyOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpID09PSA4IHx8IGkgPT09IDEyIHx8IGkgPT09IDE2IHx8IGkgPT09IDIwKSB1dWlkICs9ICctJztcbiAgICAgICAgICAgIHV1aWQgKz0gY2hhcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcnMubGVuZ3RoKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHV1aWQ7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUZpbGVJZCgpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBjaGFycyA9ICdhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ekFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaMDEyMzQ1Njc4OSsvJztcbiAgICAgICAgbGV0IGZpbGVJZCA9ICcnO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDIyOyBpKyspIGZpbGVJZCArPSBjaGFyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFycy5sZW5ndGgpXTtcbiAgICAgICAgcmV0dXJuIGZpbGVJZDtcbiAgICB9XG5cbn1cbiJdfQ==