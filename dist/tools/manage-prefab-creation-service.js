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
const manage_node_sibling_order_1 = require("./manage-node-sibling-order");
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
        /** Children `query-node-tree` listed that the node's live `query-node` dump did not (issue #73). Reset per capture. */
        this.lastPrunedStaleChildren = [];
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
                data: Object.assign(Object.assign({ prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName, convertedToPrefabInstance: convertResult.success, propertiesVerifiedFrom: readBack.source }, (this.lastPrunedStaleChildren.length > 0 ? { prunedStaleChildren: [...this.lastPrunedStaleChildren] } : {})), { message: convertResult.success ? 'Prefab created and node converted' : 'Prefab created, node conversion failed' })
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
        this.lastPrunedStaleChildren = [];
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
        let liveChildUuids = null;
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', node.uuid);
            if (nodeData) {
                liveChildUuids = this.liveChildUuidSet(nodeData);
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
            if (liveChildUuids) {
                // Issue #73: `query-node-tree` can still list a child that `manage_node delete`
                // already removed (seen on a linked prefab instance), so the created prefab
                // resurrected it. The node's own `query-node` dump is the live child set; a
                // tree child absent from it is stale and is not serialized.
                const kept = [];
                for (const child of node.children) {
                    const childUuid = this.extractNodeUuid(child);
                    if (childUuid && !liveChildUuids.has(childUuid)) {
                        this.lastPrunedStaleChildren.push(childUuid);
                        console.warn(`Dropping child ${childUuid} of ${node.uuid}: listed by query-node-tree but absent from the node's live children`);
                        continue;
                    }
                    kept.push(child);
                }
                node.children = kept;
            }
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = await this.enhanceTreeWithMCPComponents(node.children[i]);
            }
        }
        return node;
    }
    /**
     * The uuids of a node's live children as its own `query-node` dump reports them, or null
     * when the dump does not carry a readable child list — an unreadable list proves nothing,
     * so the caller keeps every tree child rather than pruning on a guess.
     */
    liveChildUuidSet(nodeData) {
        if (!Array.isArray(nodeData === null || nodeData === void 0 ? void 0 : nodeData.children))
            return null;
        const uuids = nodeData.children.map((c) => (0, manage_node_sibling_order_1.childUuidOf)(c));
        if (uuids.some((u) => !u))
            return null;
        return new Set(uuids);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvRUEsb0RBS0M7QUF6RUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsdUNBQXlCO0FBQ3pCLG9EQUFtRDtBQUNuRCwyRUFBMEQ7QUFDMUQsMkZBQW1GO0FBRW5GOzs7OztHQUtHO0FBQ0gsU0FBUyxvQkFBb0IsQ0FBQyxLQUFVO0lBQ3BDLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDOUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDeEUsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqSCxDQUFDO0FBRUQsc0ZBQXNGO0FBQ3RGLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDckMsTUFBTSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlO0lBQzlELFdBQVcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsa0JBQWtCO0NBQzFFLENBQUMsQ0FBQztBQUVILHdGQUF3RjtBQUN4RixN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RSxVQUFVLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDaFQsSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzFJLElBQUksSUFBSSxLQUFLLFNBQVM7Z0JBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFD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QUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtnQkFBRSxJQUFJLElBQUksR0FBRyxDQUFDO1lBQzdELElBQUksSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFTyxjQUFjO1FBQ2xCLE1BQU0sS0FBSyxHQUFHLGtFQUFrRSxDQUFDO1FBQ2pGLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNoQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDdkYsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQzs7QUFoN0JMLHNEQWs3QkM7QUFwa0JHLDJGQUEyRjtBQUNuRSxtQ0FBYSxHQUFHLFVBQVUsQUFBYixDQUFjO0FBb05uRCwyRkFBMkY7QUFDbkUsaUNBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUMxQyxXQUFXLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxrQkFBa0I7SUFDaEYsY0FBYyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxlQUFlO0lBQ3JGLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsU0FBUztJQUMvRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLGdCQUFnQjtDQUM3RixDQUFDLEFBTGlDLENBS2hDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcmVmYWJDcmVhdGlvblNlcnZpY2U6IGhhbmRsZXMgdGhlIGNvbXBsZXggbG9naWMgb2YgY3JlYXRpbmcgQ29jb3MgQ3JlYXRvciBwcmVmYWIgZmlsZXNcbiAqIHByb2dyYW1tYXRpY2FsbHkuIEV4dHJhY3RlZCBmcm9tIE1hbmFnZVByZWZhYiB0byBrZWVwIG1hbmFnZS1wcmVmYWIudHMgdW5kZXIgMjAwIGxpbmVzLlxuICpcbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAtIEZldGNoaW5nIG5vZGUgZGF0YSB3aXRoIGNvbXBvbmVudCBpbmZvIGZyb20gdGhlIHNjZW5lXG4gKiAtIFNlcmlhbGl6aW5nIG5vZGUgdHJlZXMgaW50byBDb2NvcyBDcmVhdG9yIHByZWZhYiBKU09OIGZvcm1hdFxuICogLSBTYXZpbmcgYW5kIHJlLWltcG9ydGluZyBhc3NldCBmaWxlcyB2aWEgYXNzZXQtZGJcbiAqIC0gTGlua2luZyBzY2VuZSBub2RlcyB0byBuZXdseSBjcmVhdGVkIHByZWZhYiBhc3NldHNcbiAqL1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBjaGlsZFV1aWRPZiB9IGZyb20gJy4vbWFuYWdlLW5vZGUtc2libGluZy1vcmRlcic7XG5pbXBvcnQgeyBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuXG4vKipcbiAqIEEgZHVtcCBlbnRyeSBpcyBhIHByb3BlcnR5IGRlc2NyaXB0b3Igd2hlbiBpdCB3cmFwcyBhIGB2YWx1ZWAgYW5kIGNhcnJpZXMgYXQgbGVhc3Qgb25lXG4gKiBlZGl0b3IgYW5ub3RhdGlvbi4gRGVsaWJlcmF0ZWx5IGxvb3NlciB0aGFuIHRoZSBpbnNwZWN0b3Itc2lkZVxuICogYGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3JgLCB3aGljaCByZWplY3RzIGRlc2NyaXB0b3JzIHdob3NlIGZpZWxkcyBhcmUgYWxsIHByaW1pdGl2ZXNcbiAqIChgeyBuYW1lLCB2YWx1ZTogNjAsIHR5cGU6ICdOdW1iZXInIH1gKSBiZWNhdXNlIGl0IGlzIGd1YXJkaW5nIGEgZGlmZmVyZW50IGNhc2UuXG4gKi9cbmZ1bmN0aW9uIGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5OiBhbnkpOiBib29sZWFuIHtcbiAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbnRyeSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlbnRyeSwgJ3ZhbHVlJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gWyduYW1lJywgJ3R5cGUnLCAnZGlzcGxheU5hbWUnLCAncmVhZG9ubHknXS5zb21lKGsgPT4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGVudHJ5LCBrKSk7XG59XG5cbi8qKiBFZGl0b3Itb25seSBkdW1wIGVudHJpZXMgdGhhdCBoYXZlIG5vIHNlcmlhbGl6ZWQgY291bnRlcnBhcnQgaW4gYSAucHJlZmFiIGZpbGUuICovXG5jb25zdCBEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQgPSBuZXcgU2V0KFtcbiAgICAnbm9kZScsICdlbmFibGVkJywgJ19fdHlwZV9fJywgJ3V1aWQnLCAnbmFtZScsICdfX3NjcmlwdEFzc2V0JyxcbiAgICAnX29iakZsYWdzJywgJ19uYW1lJywgJ19pZCcsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfX2VkaXRvckV4dHJhc19fJ1xuXSk7XG5cbi8qKiBUaGUgZW52ZWxvcGUgZXZlcnkgc2VyaWFsaXplZCBjb21wb25lbnQgY2FycmllcyBldmVuIHdoZW4gaXQgaG9sZHMgbm8gcHJvcGVydGllcy4gKi9cbmNvbnN0IEJBU0VfQ09NUE9ORU5UX0tFWVMgPSBuZXcgU2V0KFtcbiAgICAnX190eXBlX18nLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19fZWRpdG9yRXh0cmFzX18nLCAnbm9kZScsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfaWQnXG5dKTtcblxuLyoqIFRydWUgd2hlbiBhIHNlcmlhbGl6ZWQgY29tcG9uZW50IGtleSBpcyBhbiBlbmdpbmUgYWNjZXNzb3Igd2l0aCBhIGBfYC1wcmVmaXhlZCB0d2luLiAqL1xuZnVuY3Rpb24gaXNFbmdpbmVUeXBlKGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAvXihjY3xzcHxkcmFnb25Cb25lcylcXC4vLnRlc3QoY29tcG9uZW50VHlwZSk7XG59XG5cbi8qKlxuICogRmluZCB0aGUgYWNjZXNzb3Iga2V5cyBhIGR1bXAgY2FycmllcyBhbG9uZ3NpZGUgdGhlaXIgYF9gLXByZWZpeGVkIHNlcmlhbGl6ZWQgdHdpbi5cbiAqXG4gKiBJc3N1ZSAjMTE0IGRlZmVjdCAyLiBBIGBzY2VuZTpxdWVyeS1ub2RlYCBkdW1wIGNhcnJpZXMgQk9USCBzcGVsbGluZ3Mgb2YgYW5cbiAqIGFjY2Vzc29yLWJhY2tlZCBlbmdpbmUgZmllbGQg4oCUIHRoZSBpbnNwZWN0b3IgYWNjZXNzb3IgKGBjbGlwc2AsIGBkZWZhdWx0Q2xpcGAsXG4gKiBgc2hhcmVkTWF0ZXJpYWxzYCkgYW5kIHRoZSB0cnVlIHNlcmlhbGl6ZWQgZmllbGQgKGBfY2xpcHNgLCBgX2RlZmF1bHRDbGlwYCxcbiAqIGBfbWF0ZXJpYWxzYCkuIGBjcmVhdGVDb21wb25lbnRPYmplY3RgIGVtaXR0ZWQgZXZlcnkgZHVtcCBrZXkgdmVyYmF0aW0gdW5sZXNzIHRoZSB0eXBlXG4gKiB3YXMgaW4gYERVTVBfS0VZX1JFTkFNRVNgLCBzbyBhIGBjYy5BbmltYXRpb25gIGNvbXBvbmVudCAoYWJzZW50IGZyb20gdGhlIHRhYmxlKSB3cm90ZVxuICogYGNsaXBzYCBBTkQgYF9jbGlwc2AgYXMgc2VwYXJhdGUgdG9wLWxldmVsIGtleXMgd2l0aCBkaXZlcmdpbmcgdmFsdWVzLCBhbmQgdGhlIGFzc2V0XG4gKiBpbXBvcnRlciByZWplY3RlZCB0aGUgcHJlZmFiIG91dHJpZ2h0OlxuICpcbiAqICAgICBbQXNzZXRzXSBDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyAnX25hbWUnKSAgVHlwZUVycm9yXG4gKlxuICogVGhlIG9yaWdpbmF0aW5nIHJlcG9ydCBwaW5uZWQgdGhlIHJlcGFpciBlbXBpcmljYWxseTogc3RyaXBwaW5nIGV2ZXJ5IG5vbi11bmRlcnNjb3JlIGtleVxuICogdGhhdCBoYXMgYW4gdW5kZXJzY29yZSB0d2luIHJlcHJvZHVjZWQgdGhlIGtleSBzZXQgb2YgYSBoYW5kLWF1dGhvcmVkIHByZWZhYiwgd2hpY2hcbiAqIGltcG9ydGVkIGNsZWFubHkuXG4gKlxuICogVGhpcyBpcyB0eXBlLUFHTk9TVElDIG9uIHB1cnBvc2UuIEEgdGFibGUgdGhhdCBtdXN0IGJlIGV4dGVuZGVkIHBlciBjb25maXJtZWQgbWlzbWF0Y2hcbiAqIGFsd2F5cyBsYWdzIHRoZSBlbmdpbmU7IHRoZSB0d2luIGludmFyaWFudCBjYW5ub3QsIGFuZCBpdCBpcyBzdGF0aWNhbGx5IGRldGVjdGFibGUg4oCUXG4gKiB3aGljaCB0aGUgdGFibGUncyBvd24gZG9jc3RyaW5nIHByZXZpb3VzbHkgZGVuaWVkLlxuICpcbiAqIFNjb3BlZCB0byBFTkdJTkUgdHlwZXMuIEEgc2NyaXB0IG1heSBsZWdpdGltYXRlbHkgZGVjbGFyZSBib3RoIGBmb29gIGFuZCBgX2Zvb2AgYXNcbiAqIGRpc3RpbmN0IGBAcHJvcGVydHlgIGZpZWxkcywgYW5kIGRyb3BwaW5nIG9uZSB0aGVyZSB3b3VsZCBiZSBkYXRhIGxvc3MgcmF0aGVyIHRoYW4gYVxuICogcmVwYWlyLCBzbyBzY3JpcHQgY29tcG9uZW50cyBhcmUgbmV2ZXIgdG91Y2hlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRBY2Nlc3NvclR3aW5LZXlzKGNvbXBvbmVudFR5cGU6IHN0cmluZywgcHJvcGVydGllczogUmVjb3JkPHN0cmluZywgYW55Pik6IHN0cmluZ1tdIHtcbiAgICBpZiAoIWlzRW5naW5lVHlwZShjb21wb25lbnRUeXBlKSkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5maWx0ZXIoXG4gICAgICAgIGtleSA9PiAha2V5LnN0YXJ0c1dpdGgoJ18nKSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocHJvcGVydGllcywgYF8ke2tleX1gKVxuICAgICk7XG59XG5cbi8qKlxuICogS2V5cyB3aG9zZSBzZXJpYWxpemVkIGZpZWxkIG5hbWUgZGlmZmVycyAoYWNjZXNzb3ItYmFja2VkIGVuZ2luZSBwcm9wZXJ0aWVzKS5cbiAqXG4gKiBWZXJpZmllZCBvbmx5IGZvciB0aGVzZSBmb3VyIHR5cGVzIOKAlCBldmVyeSBvdGhlciBlbmdpbmUgYGNjLipgL2BzcC4qYC9gZHJhZ29uQm9uZXMuKmBcbiAqIGNvbXBvbmVudCBmYWxscyB0aHJvdWdoIHRvIHRoZSBnZW5lcmljIGJyYW5jaCBiZWxvdywgd2hpY2ggZW1pdHMgdGhlIGR1bXAga2V5XG4gKiBWRVJCQVRJTS4gRm9yIG1vc3QgZW5naW5lIHR5cGVzIHRoZSBkdW1wIGtleSBhbHJlYWR5IG1hdGNoZXMgdGhlIHNlcmlhbGl6ZWQga2V5XG4gKiAoZS5nLiBgY2MuUGFydGljbGVTeXN0ZW0yRGAncyBgZW1pc3Npb25SYXRlYCksIGJ1dCBhbiBhY2Nlc3Nvci1iYWNrZWQgZmllbGQgb24gYSB0eXBlXG4gKiBub3QgbGlzdGVkIGhlcmUgd291bGQgc2VyaWFsaXplIHVuZGVyIHRoZSBXUk9ORyBrZXkgcmF0aGVyIHRoYW4gYmVpbmcgZHJvcHBlZC5cbiAqXG4gKiBFeHRlbmQgdGhpcyB0YWJsZSBhcyBzcGVjaWZpYyBtaXNtYXRjaGVzIGFyZSBjb25maXJtZWQgYWdhaW5zdCBhIHJ1bm5pbmcgQ29jb3MgQ3JlYXRvclxuICogMy44LjcgaW5zdGFuY2Ug4oCUIGJ1dCBub3RlIHRoYXQgYGZpbmRBY2Nlc3NvclR3aW5LZXlzYCBiZWxvdyBpcyB0aGUgdHlwZS1hZ25vc3RpYyBuZXRcbiAqIHVuZGVybmVhdGggaXQ6IHdoZXJlIHRoZSBkdW1wIGNhcnJpZXMgQk9USCBzcGVsbGluZ3MsIHRoZSB0d2luIGlzIGRyb3BwZWQgcmF0aGVyIHRoYW5cbiAqIHJlcXVpcmluZyBhIHRhYmxlIGVudHJ5LCBzbyBhIHR5cGUgdGhpcyB0YWJsZSBoYXMgbmV2ZXIgaGVhcmQgb2Ygc3RpbGwgc2VyaWFsaXplc1xuICogaW1wb3J0YWJsZS4gVGhlIHRhYmxlIHJlbWFpbnMgbmVjZXNzYXJ5IGZvciB0aGUgY2FzZSB0aGUgbmV0IGNhbm5vdCBzZWUg4oCUIGFuXG4gKiBhY2Nlc3Nvci1vbmx5IGtleSB3aXRoIG5vIHNlcmlhbGl6ZWQgdHdpbiBwcmVzZW50IGluIHRoZSBzYW1lIGR1bXAuXG4gKi9cbmNvbnN0IERVTVBfS0VZX1JFTkFNRVM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xuICAgICdjYy5VSVRyYW5zZm9ybSc6IHsgY29udGVudFNpemU6ICdfY29udGVudFNpemUnLCBhbmNob3JQb2ludDogJ19hbmNob3JQb2ludCcgfSxcbiAgICAnY2MuU3ByaXRlJzogeyBzcHJpdGVGcmFtZTogJ19zcHJpdGVGcmFtZScsIHR5cGU6ICdfdHlwZScsIHNpemVNb2RlOiAnX3NpemVNb2RlJywgZmlsbFR5cGU6ICdfZmlsbFR5cGUnIH0sXG4gICAgJ2NjLkxhYmVsJzogeyBzdHJpbmc6ICdfc3RyaW5nJywgZm9udFNpemU6ICdfZm9udFNpemUnLCBsaW5lSGVpZ2h0OiAnX2xpbmVIZWlnaHQnLCBvdmVyZmxvdzogJ19vdmVyZmxvdycgfSxcbiAgICAnY2MuQnV0dG9uJzogeyB0YXJnZXQ6ICdfdGFyZ2V0JywgaW50ZXJhY3RhYmxlOiAnX2ludGVyYWN0YWJsZScsIHRyYW5zaXRpb246ICdfdHJhbnNpdGlvbicgfSxcbn07XG5cbi8qKlxuICogR2FwLWZpbGxlcnMsIGFwcGxpZWQgb25seSB0byBrZXlzIHRoZSBkdW1wIGRpZCBub3Qgc3VwcGx5LiBUaGVzZSBhcmUgZW5naW5lIGRlZmF1bHRzIOKAlFxuICogbmV2ZXIgYW4gb3ZlcnJpZGUgb2YgYSBjYXB0dXJlZCB2YWx1ZS5cbiAqL1xuY29uc3QgQ09NUE9ORU5UX0RFRkFVTFRTOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+PiA9IHtcbiAgICAnY2MuVUlUcmFuc2Zvcm0nOiB7XG4gICAgICAgIF9jb250ZW50U2l6ZTogeyBcIl9fdHlwZV9fXCI6IFwiY2MuU2l6ZVwiLCBcIndpZHRoXCI6IDEwMCwgXCJoZWlnaHRcIjogMTAwIH0sXG4gICAgICAgIF9hbmNob3JQb2ludDogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogMC41LCBcInlcIjogMC41IH0sXG4gICAgfSxcbiAgICAnY2MuU3ByaXRlJzoge1xuICAgICAgICBfc3ByaXRlRnJhbWU6IG51bGwsIF90eXBlOiAwLCBfZmlsbFR5cGU6IDAsIF9zaXplTW9kZTogMSxcbiAgICAgICAgX2ZpbGxDZW50ZXI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzJcIiwgXCJ4XCI6IDAsIFwieVwiOiAwIH0sXG4gICAgICAgIF9maWxsU3RhcnQ6IDAsIF9maWxsUmFuZ2U6IDAsIF9pc1RyaW1tZWRNb2RlOiB0cnVlLCBfdXNlR3JheXNjYWxlOiBmYWxzZSxcbiAgICAgICAgX2F0bGFzOiBudWxsLFxuICAgIH0sXG4gICAgJ2NjLkJ1dHRvbic6IHtcbiAgICAgICAgX2ludGVyYWN0YWJsZTogdHJ1ZSwgX3RyYW5zaXRpb246IDMsXG4gICAgICAgIF9ub3JtYWxDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDI1NSwgXCJnXCI6IDI1NSwgXCJiXCI6IDI1NSwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfaG92ZXJDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDIxMSwgXCJnXCI6IDIxMSwgXCJiXCI6IDIxMSwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfcHJlc3NlZENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9kaXNhYmxlZENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMTI0LCBcImdcIjogMTI0LCBcImJcIjogMTI0LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9ub3JtYWxTcHJpdGU6IG51bGwsIF9ob3ZlclNwcml0ZTogbnVsbCwgX3ByZXNzZWRTcHJpdGU6IG51bGwsIF9kaXNhYmxlZFNwcml0ZTogbnVsbCxcbiAgICAgICAgX2R1cmF0aW9uOiAwLjEsIF96b29tU2NhbGU6IDEuMiwgX2NsaWNrRXZlbnRzOiBbXSxcbiAgICB9LFxuICAgICdjYy5MYWJlbCc6IHtcbiAgICAgICAgX3N0cmluZzogXCJMYWJlbFwiLCBfaG9yaXpvbnRhbEFsaWduOiAxLCBfdmVydGljYWxBbGlnbjogMSxcbiAgICAgICAgX2FjdHVhbEZvbnRTaXplOiAyMCwgX2ZvbnRTaXplOiAyMCwgX2ZvbnRGYW1pbHk6IFwiQXJpYWxcIixcbiAgICAgICAgX2xpbmVIZWlnaHQ6IDI1LCBfb3ZlcmZsb3c6IDAsIF9lbmFibGVXcmFwVGV4dDogdHJ1ZSxcbiAgICAgICAgX2ZvbnQ6IG51bGwsIF9pc1N5c3RlbUZvbnRVc2VkOiB0cnVlLCBfc3BhY2luZ1g6IDAsXG4gICAgICAgIF9pc0l0YWxpYzogZmFsc2UsIF9pc0JvbGQ6IGZhbHNlLCBfaXNVbmRlcmxpbmU6IGZhbHNlLFxuICAgICAgICBfdW5kZXJsaW5lSGVpZ2h0OiAyLCBfY2FjaGVNb2RlOiAwLFxuICAgIH0sXG59O1xuXG5leHBvcnQgY2xhc3MgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlIHtcblxuICAgIGFzeW5jIGNyZWF0ZVByZWZhYldpdGhBc3NldERCKG5vZGVVdWlkOiBzdHJpbmcsIHNhdmVQYXRoOiBzdHJpbmcsIHByZWZhYk5hbWU6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZURhdGEobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGdldCBub2RlIGRhdGEnIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHRlbXBQcmVmYWJDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoW3sgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYlwiLCBcIl9uYW1lXCI6IHByZWZhYk5hbWUgfV0sIG51bGwsIDIpO1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlUmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCB0ZW1wUHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBpZiAoIWNyZWF0ZVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gY3JlYXRlUmVzdWx0O1xuXG4gICAgICAgICAgICBjb25zdCBhY3R1YWxQcmVmYWJVdWlkID0gY3JlYXRlUmVzdWx0LmRhdGE/LnV1aWQ7XG4gICAgICAgICAgICBpZiAoIWFjdHVhbFByZWZhYlV1aWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0Nhbm5vdCBnZXQgZW5naW5lLWFzc2lnbmVkIHByZWZhYiBVVUlEJyB9O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJDb250ZW50ID0gYXdhaXQgdGhpcy5jcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGEsIHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQsIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgLy8gRGVmZW5zZS1pbi1kZXB0aCBmb3IgIzExNCBkZWZlY3QgMi4gYHZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkNvbnRlbnQpYCBhbG9uZVxuICAgICAgICAgICAgLy8gd291bGQgYmUgYSBzaGFwZSBjaGVjayB0aGF0IGNhbiBuZXZlciBmYWlsOiBpdCBydW5zIGBmaW5kQWNjZXNzb3JUd2luS2V5c2Agb3ZlclxuICAgICAgICAgICAgLy8gb3V0cHV0IHRoYXQgYGNyZWF0ZUNvbXBvbmVudE9iamVjdGAgYWxyZWFkeSByYW4gdGhlIFNBTUUgcHJlZGljYXRlIG92ZXIsIHNvIGFcbiAgICAgICAgICAgIC8vIGR1cGxpY2F0ZSByZWFjaGluZyBoZXJlIGlzIGltcG9zc2libGUgYnkgY29uc3RydWN0aW9uICh2ZXJpZmllZCDigJQgbmV1dGVyaW5nIHRoaXNcbiAgICAgICAgICAgIC8vIGJyYW5jaCBsZWZ0IGV2ZXJ5IHRlc3QgZ3JlZW4pLiBUaGUgZ2VudWluZSBpbnZhcmlhbnQgaXMgYSBESUZGRVJFTkNFIG9uZTogZXZlcnlcbiAgICAgICAgICAgIC8vIGFjY2Vzc29yIHR3aW4gdGhlIENBUFRVUkVEIHNjZW5lIGR1bXAgY2FycmllcyBtdXN0IGJlIGFic2VudCBmcm9tIHdoYXQgd2UgYXJlXG4gICAgICAgICAgICAvLyBhYm91dCB0byB3cml0ZS4gVGhhdCBmaXJlcyBldmVuIGlmIHRoZSBlbWlzc2lvbiBmaWx0ZXIgaXMgcmVtb3ZlZCwgbWlzLXR5cGVkLCBvclxuICAgICAgICAgICAgLy8gdGhlIGR1bXAgc2hhcGUgY2hhbmdlcyB1bmRlciBpdCwgYmVjYXVzZSBpdCBkb2VzIG5vdCByZS1hc2sgdGhlIGZpbHRlcidzIHF1ZXN0aW9uLlxuICAgICAgICAgICAgY29uc3QgY2FwdHVyZWRUd2lucyA9IHRoaXMuZmluZENhcHR1cmVkQWNjZXNzb3JUd2lucyhub2RlRGF0YSwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBpZiAoY2FwdHVyZWRUd2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZWQgPSBjYXB0dXJlZFR3aW5zXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoZCA9PiBgJHtkLnR5cGV9ICgke2Qua2V5cy5tYXAoayA9PiBgJyR7a30nLydfJHtrfSdgKS5qb2luKCcsICcpfSlgKVxuICAgICAgICAgICAgICAgICAgICAuam9pbignOyAnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUmVmdXNpbmcgdG8gd3JpdGUgJHtzYXZlUGF0aH06IHRoZSBzY2VuZSBjYXJyaWVkIGFuIGFjY2Vzc29yIGtleSBhbG9uZ3NpZGUgaXRzIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYHVuZGVyc2NvcmUgdHdpbiBhbmQgaXQgc3Vydml2ZWQgaW50byB0aGUgcHJlZmFiIOKAlCAke25hbWVkfS4gQ29jb3MgQ3JlYXRvcidzIGFzc2V0IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYGltcG9ydGVyIHJlamVjdHMgdGhpcyBzaGFwZSAoXCJDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyAnX25hbWUnKVwiKSwgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgc28gdGhlIHByZWZhYiB3b3VsZCBiZSB1bmxvYWRhYmxlLCB5ZXQgdGhlIGNhbGxlciB3b3VsZCBoYXZlIGJlZW4gdG9sZCBpdCB3YXMgY3JlYXRlZCBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGAoaXNzdWUgIzExNCBkZWZlY3QgMikuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5czogY2FwdHVyZWRUd2lucyB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZUxvc3MgPSB0aGlzLmRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKHRoaXMubGFzdFJlZmVyZW5jZUxvc3Nlcyk7XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlTG9zcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byB3cml0ZSAke3NhdmVQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIHJlZmVyZW5jZUxvc3NlczogdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCBKU09OLnN0cmluZ2lmeShwcmVmYWJDb250ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZU1ldGFXaXRoQXNzZXREQihzYXZlUGF0aCwgdGhpcy5jcmVhdGVTdGFuZGFyZE1ldGFDb250ZW50KHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVpbXBvcnRBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgLy8gUmVhZCB0aGUgYXNzZXQgYmFjayBiZWZvcmUgcmVwb3J0aW5nIHN1Y2Nlc3MuIENvbXBvbmVudHMgdGhhdCB3ZXJlXG4gICAgICAgICAgICAvLyBjb25maWd1cmVkIGluIHRoZSBzY2VuZSBidXQgc2VyaWFsaXplZCB0byBhIGJhcmUgZW52ZWxvcGUgYXJlIGEgc2lsZW50XG4gICAgICAgICAgICAvLyBkYXRhIGxvc3MgdGhlIGNhbGxlciBjYW5ub3Qgb3RoZXJ3aXNlIGRldGVjdCAoIzI4KS5cbiAgICAgICAgICAgIGNvbnN0IHJlYWRCYWNrID0gYXdhaXQgdGhpcy5yZWFkQmFja1ByZWZhYihzYXZlUGF0aCwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhyZWFkQmFjay5kYXRhLCBub2RlRGF0YSk7XG4gICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7c2F2ZVBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QsIHZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIGFjdHVhbFByZWZhYlV1aWQsIHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNWZXJpZmllZEZyb206IHJlYWRCYWNrLnNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgLi4uKHRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW4ubGVuZ3RoID4gMCA/IHsgcHJ1bmVkU3RhbGVDaGlsZHJlbjogWy4uLnRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW5dIH0gOiB7fSksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyA/ICdQcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gY3JlYXRlIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVQcmVmYWJOYXRpdmVTdHViKCk6IGFueSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiAnTmF0aXZlIHByZWZhYiBjcmVhdGlvbiBBUEkgbm90IGF2YWlsYWJsZScsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1RvIGNyZWF0ZSBhIHByZWZhYiBpbiBDb2NvcyBDcmVhdG9yOlxcbjEuIFNlbGVjdCBhIG5vZGUgaW4gdGhlIHNjZW5lXFxuMi4gRHJhZyBpdCB0byB0aGUgQXNzZXQgQnJvd3NlclxcbjMuIE9yIHJpZ2h0LWNsaWNrIHRoZSBub2RlIGFuZCBzZWxlY3QgXCJDcmVhdGUgUHJlZmFiXCInXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlUHJlZmFiQ3VzdG9tKG5vZGVVdWlkOiBzdHJpbmcsIHByZWZhYlBhdGg6IHN0cmluZywgcHJlZmFiTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgdGhpcy5nZXROb2RlRGF0YShub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIG5vdCBmb3VuZDogJHtub2RlVXVpZH1gIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlV1aWQgPSB0aGlzLmdlbmVyYXRlVVVJRCgpO1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiSnNvbkRhdGEgPSBhd2FpdCB0aGlzLmNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YSwgcHJlZmFiTmFtZSwgcHJlZmFiVXVpZCwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBjb25zdCByZWZlcmVuY2VMb3NzID0gdGhpcy5kZXNjcmliZVJlZmVyZW5jZUxvc3Nlcyh0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMpO1xuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZUxvc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUmVmdXNpbmcgdG8gd3JpdGUgJHtwcmVmYWJQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkLCBwcmVmYWJQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSwgcmVmZXJlbmNlTG9zc2VzOiB0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgdGhpcy5zYXZlUHJlZmFiV2l0aE1ldGEocHJlZmFiUGF0aCwgcHJlZmFiSnNvbkRhdGEsIHRoaXMuY3JlYXRlU3RhbmRhcmRNZXRhQ29udGVudChwcmVmYWJOYW1lLCBwcmVmYWJVdWlkKSk7XG5cbiAgICAgICAgICAgIGlmIChzYXZlUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhwcmVmYWJKc29uRGF0YSwgbm9kZURhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChsb3N0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7cHJlZmFiUGF0aH0sIGJ1dCB0aGVzZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzOiAke2xvc3Quam9pbignLCAnKX0uIFRoZSBzY2VuZSB2YWx1ZXMgd2VyZSBub3QgY2FwdHVyZWQg4oCUIGRvIG5vdCB1c2UgdGhpcyBwcmVmYWIuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGNvbXBvbmVudHNXaXRob3V0UHJvcGVydGllczogbG9zdCB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZCwgcHJlZmFiUGF0aCwgcHJlZmFiVXVpZCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MgPyAnQ3VzdG9tIHByZWZhYiBjcmVhdGVkIGFuZCBub2RlIGNvbnZlcnRlZCcgOiAnUHJlZmFiIGNyZWF0ZWQsIG5vZGUgY29udmVyc2lvbiBmYWlsZWQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBzYXZlUmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gc2F2ZSBwcmVmYWIgZmlsZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIGNyZWF0aW5nIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA9PT09PSBOb2RlIGRhdGEgcmV0cmlldmFsID09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldE5vZGVEYXRhKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0aGlzLmxhc3RQcnVuZWRTdGFsZUNoaWxkcmVuID0gW107XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVJbmZvKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmdldE5vZGVXaXRoQ2hpbGRyZW4obm9kZVV1aWQpIHx8IG5vZGVJbmZvO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlV2l0aENoaWxkcmVuKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHJlZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgaWYgKCF0cmVlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIGNvbnN0IHRhcmdldE5vZGUgPSB0aGlzLmZpbmROb2RlSW5UcmVlKHRyZWUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIHJldHVybiB0YXJnZXROb2RlID8gYXdhaXQgdGhpcy5lbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKHRhcmdldE5vZGUpIDogbnVsbDtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVuaGFuY2Ugbm9kZSB0cmVlIHdpdGggYWNjdXJhdGUgY29tcG9uZW50IGluZm8gdmlhIGRpcmVjdCBFZGl0b3IgQVBJLlxuICAgICAqIFJlcGxhY2VzIHByZXZpb3VzIEhUVFAgc2VsZi1jYWxsIHRvIGxvY2FsaG9zdDo4NTg1IHdoaWNoIHdhcyBmcmFnaWxlIGFuZCBwb3J0LWRlcGVuZGVudC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHMobm9kZTogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgaWYgKCFub2RlIHx8ICFub2RlLnV1aWQpIHJldHVybiBub2RlO1xuICAgICAgICBsZXQgbGl2ZUNoaWxkVXVpZHM6IFNldDxzdHJpbmc+IHwgbnVsbCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlLnV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhKSB7XG4gICAgICAgICAgICAgICAgbGl2ZUNoaWxkVXVpZHMgPSB0aGlzLmxpdmVDaGlsZFV1aWRTZXQobm9kZURhdGEpO1xuICAgICAgICAgICAgICAgIC8vIENhcnJ5IHRoZSB0cmFuc2Zvcm0gZHVtcCB0aHJvdWdoIHNvIGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZSBjYW4gcmVhZFxuICAgICAgICAgICAgICAgIC8vIHBvc2l0aW9uL3JvdGF0aW9uL3NjYWxlIGluc3RlYWQgb2YgZmFsbGluZyBiYWNrIHRvIGlkZW50aXR5IChpc3N1ZSAjNTApLlxuICAgICAgICAgICAgICAgIC8vIFRoZSBxdWVyeS1ub2RlIGR1bXAgc2hhcGVzIHRoZXNlIGFzIHsgdmFsdWU6IHsgeCwgeSwgeiB9IH0gKGFuZCB3IGZvciBxdWF0KSxcbiAgICAgICAgICAgICAgICAvLyB3aGljaCBpcyBleGFjdGx5IHRoZSBzaGFwZSBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUgcmVhZHMgdmlhIG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZS5cbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEucG9zaXRpb24pIG5vZGUucG9zaXRpb24gPSBub2RlRGF0YS5wb3NpdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEucm90YXRpb24pIG5vZGUucm90YXRpb24gPSBub2RlRGF0YS5yb3RhdGlvbjtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuc2NhbGUpIG5vZGUuc2NhbGUgPSBub2RlRGF0YS5zY2FsZTtcbiAgICAgICAgICAgICAgICAvLyBUaGUgbGF5ZXIgaXMgY2FycmllZCBmb3IgdGhlIHNhbWUgcmVhc29uOiBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUgaGFyZGNvZGVkXG4gICAgICAgICAgICAgICAgLy8gREVGQVVMVCwgc28gZXZlcnkgbm9kZSBvZiBhIGNyZWF0ZWQgcHJlZmFiIGxhbmRlZCBvbiB0aGUgREVGQVVMVCBsYXllciBhbmQgYVxuICAgICAgICAgICAgICAgIC8vIFVJIHByZWZhYiAoVUlfMkQpIHdhcyBjdWxsZWQgYnkgdGhlIFVJIGNhbWVyYSDigJQgaXQgcmVuZGVyZWQgbm90aGluZy5cbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEubGF5ZXIgIT09IHVuZGVmaW5lZCkgbm9kZS5sYXllciA9IG5vZGVEYXRhLmxheWVyO1xuICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gYHByb3BlcnRpZXNgIGNhcnJpZXMgdGhlIGxpdmUgcHJvcGVydHkgZHVtcCB0aHJvdWdoIHRvIHNlcmlhbGl6YXRpb24uXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlZHVjaW5nIGVhY2ggY29tcG9uZW50IHRvIHR5cGUvdXVpZC9lbmFibGVkIGRpc2NhcmRlZCBldmVyeSBjb25maWd1cmVkXG4gICAgICAgICAgICAgICAgICAgIC8vIHZhbHVlIGJlZm9yZSBpdCBjb3VsZCBiZSB3cml0dGVuLCBzbyBgYWN0aW9uPWNyZWF0ZWAgc2F2ZWQgZW5naW5lXG4gICAgICAgICAgICAgICAgICAgIC8vIGRlZmF1bHRzIGZvciBldmVyeSBjb21wb25lbnQgdHlwZSAoIzI4KS5cbiAgICAgICAgICAgICAgICAgICAgbm9kZS5jb21wb25lbnRzID0gbm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGR1bXAgbmVzdHMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIHVuZGVyIHZhbHVlLnV1aWQudmFsdWU7IHRoZVxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gdG9wLWxldmVsIGNvbXAudXVpZCBkb2VzIG5vdCBleGlzdCAoc2FtZSBzaGFwZSBNYW5hZ2VDb21wb25lbnQuZ2V0Q29tcG9uZW50c1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYWxyZWFkeSBhY2NvdW50cyBmb3IpLiBSZWFkaW5nIG9ubHkgY29tcC51dWlkIGxlZnQgY29tcG9uZW50VXVpZFRvSW5kZXhcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHBlcm1hbmVudGx5IGVtcHR5LCBzbyBldmVyeSBjcm9zcy1jb21wb25lbnQgcmVmZXJlbmNlIG9uIGEgY3JlYXRlZCBwcmVmYWJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIChlLmcuIGEgc2NyaXB0J3MgQHByb3BlcnR5KE1lc2hSZW5kZXJlcikvQHByb3BlcnR5KExhYmVsKSBmaWVsZCBwb2ludGluZyBhdFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYSBkZXNjZW5kYW50IG5vZGUncyBjb21wb25lbnQpIHNpbGVudGx5IHNlcmlhbGl6ZWQgYXMgbnVsbC5cbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXAudmFsdWU/LnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wKGNvbXApXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYE5vZGUgJHtub2RlLnV1aWR9IGVuaGFuY2VkIHdpdGggJHtub2RlLmNvbXBvbmVudHMubGVuZ3RofSBjb21wb25lbnRzIChpbmNsLiBzY3JpcHQgdHlwZXMpYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudCBpbmZvIGZvciBub2RlICR7bm9kZS51dWlkfTpgLCBlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4gJiYgQXJyYXkuaXNBcnJheShub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgaWYgKGxpdmVDaGlsZFV1aWRzKSB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzczOiBgcXVlcnktbm9kZS10cmVlYCBjYW4gc3RpbGwgbGlzdCBhIGNoaWxkIHRoYXQgYG1hbmFnZV9ub2RlIGRlbGV0ZWBcbiAgICAgICAgICAgICAgICAvLyBhbHJlYWR5IHJlbW92ZWQgKHNlZW4gb24gYSBsaW5rZWQgcHJlZmFiIGluc3RhbmNlKSwgc28gdGhlIGNyZWF0ZWQgcHJlZmFiXG4gICAgICAgICAgICAgICAgLy8gcmVzdXJyZWN0ZWQgaXQuIFRoZSBub2RlJ3Mgb3duIGBxdWVyeS1ub2RlYCBkdW1wIGlzIHRoZSBsaXZlIGNoaWxkIHNldDsgYVxuICAgICAgICAgICAgICAgIC8vIHRyZWUgY2hpbGQgYWJzZW50IGZyb20gaXQgaXMgc3RhbGUgYW5kIGlzIG5vdCBzZXJpYWxpemVkLlxuICAgICAgICAgICAgICAgIGNvbnN0IGtlcHQ6IGFueVtdID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkVXVpZCA9IHRoaXMuZXh0cmFjdE5vZGVVdWlkKGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoaWxkVXVpZCAmJiAhbGl2ZUNoaWxkVXVpZHMuaGFzKGNoaWxkVXVpZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW4ucHVzaChjaGlsZFV1aWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBEcm9wcGluZyBjaGlsZCAke2NoaWxkVXVpZH0gb2YgJHtub2RlLnV1aWR9OiBsaXN0ZWQgYnkgcXVlcnktbm9kZS10cmVlIGJ1dCBhYnNlbnQgZnJvbSB0aGUgbm9kZSdzIGxpdmUgY2hpbGRyZW5gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGtlcHQucHVzaChjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4gPSBrZXB0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2RlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbltpXSA9IGF3YWl0IHRoaXMuZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyhub2RlLmNoaWxkcmVuW2ldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbm9kZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUaGUgdXVpZHMgb2YgYSBub2RlJ3MgbGl2ZSBjaGlsZHJlbiBhcyBpdHMgb3duIGBxdWVyeS1ub2RlYCBkdW1wIHJlcG9ydHMgdGhlbSwgb3IgbnVsbFxuICAgICAqIHdoZW4gdGhlIGR1bXAgZG9lcyBub3QgY2FycnkgYSByZWFkYWJsZSBjaGlsZCBsaXN0IOKAlCBhbiB1bnJlYWRhYmxlIGxpc3QgcHJvdmVzIG5vdGhpbmcsXG4gICAgICogc28gdGhlIGNhbGxlciBrZWVwcyBldmVyeSB0cmVlIGNoaWxkIHJhdGhlciB0aGFuIHBydW5pbmcgb24gYSBndWVzcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGxpdmVDaGlsZFV1aWRTZXQobm9kZURhdGE6IGFueSk6IFNldDxzdHJpbmc+IHwgbnVsbCB7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShub2RlRGF0YT8uY2hpbGRyZW4pKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgdXVpZHMgPSBub2RlRGF0YS5jaGlsZHJlbi5tYXAoKGM6IGFueSkgPT4gY2hpbGRVdWlkT2YoYykpO1xuICAgICAgICBpZiAodXVpZHMuc29tZSgodTogc3RyaW5nKSA9PiAhdSkpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gbmV3IFNldDxzdHJpbmc+KHV1aWRzKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGZpbmROb2RlSW5UcmVlKG5vZGU6IGFueSwgdGFyZ2V0VXVpZDogc3RyaW5nKTogYW55IHtcbiAgICAgICAgaWYgKCFub2RlKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKG5vZGUudXVpZCA9PT0gdGFyZ2V0VXVpZCB8fCBub2RlLnZhbHVlPy51dWlkID09PSB0YXJnZXRVdWlkKSByZXR1cm4gbm9kZTtcbiAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4gJiYgQXJyYXkuaXNBcnJheShub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLmZpbmROb2RlSW5UcmVlKGNoaWxkLCB0YXJnZXRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoZm91bmQpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldENoaWxkcmVuVG9Qcm9jZXNzKG5vZGVEYXRhOiBhbnkpOiBhbnlbXSB7XG4gICAgICAgIGNvbnN0IGNoaWxkcmVuOiBhbnlbXSA9IFtdO1xuICAgICAgICBpZiAobm9kZURhdGEuY2hpbGRyZW4gJiYgQXJyYXkuaXNBcnJheShub2RlRGF0YS5jaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZURhdGEuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5pc1ZhbGlkTm9kZURhdGEoY2hpbGQpKSBjaGlsZHJlbi5wdXNoKGNoaWxkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBpc1ZhbGlkTm9kZURhdGEobm9kZURhdGE6IGFueSk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIW5vZGVEYXRhIHx8IHR5cGVvZiBub2RlRGF0YSAhPT0gJ29iamVjdCcpIHJldHVybiBmYWxzZTtcbiAgICAgICAgcmV0dXJuIG5vZGVEYXRhLmhhc093blByb3BlcnR5KCd1dWlkJykgfHwgbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ25hbWUnKSB8fCBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgnX190eXBlX18nKSB8fFxuICAgICAgICAgICAgKG5vZGVEYXRhLnZhbHVlICYmIChub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgndXVpZCcpIHx8IG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCduYW1lJykgfHwgbm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ19fdHlwZV9fJykpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGV4dHJhY3ROb2RlVXVpZChub2RlRGF0YTogYW55KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIG5vZGVEYXRhLnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gbm9kZURhdGEudXVpZDtcbiAgICAgICAgaWYgKG5vZGVEYXRhLnZhbHVlICYmIHR5cGVvZiBub2RlRGF0YS52YWx1ZS51dWlkID09PSAnc3RyaW5nJykgcmV0dXJuIG5vZGVEYXRhLnZhbHVlLnV1aWQ7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vID09PT09IFByZWZhYiBzZXJpYWxpemF0aW9uID09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YTogYW55LCBwcmVmYWJOYW1lOiBzdHJpbmcsIHByZWZhYlV1aWQ6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IFByb21pc2U8YW55W10+IHtcbiAgICAgICAgY29uc3QgcHJlZmFiRGF0YTogYW55W10gPSBbXTtcbiAgICAgICAgcHJlZmFiRGF0YS5wdXNoKHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5QcmVmYWJcIiwgXCJfbmFtZVwiOiBwcmVmYWJOYW1lIHx8IFwiXCIsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwiX25hdGl2ZVwiOiBcIlwiLCBcImRhdGFcIjogeyBcIl9faWRfX1wiOiAxIH0sIFwib3B0aW1pemF0aW9uUG9saWN5XCI6IDAsIFwicGVyc2lzdGVudFwiOiBmYWxzZVxuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBjb250ZXh0ID0ge1xuICAgICAgICAgICAgcHJlZmFiRGF0YSwgY3VycmVudElkOiAyLCBwcmVmYWJBc3NldEluZGV4OiAwLFxuICAgICAgICAgICAgbm9kZUZpbGVJZHM6IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCksXG4gICAgICAgICAgICBub2RlVXVpZFRvSW5kZXg6IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCksXG4gICAgICAgICAgICBjb21wb25lbnRVdWlkVG9JbmRleDogbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKSxcbiAgICAgICAgICAgIGxvc3NlczogW10gYXMgQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+XG4gICAgICAgIH07XG5cbiAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVDb21wbGV0ZU5vZGVUcmVlKG5vZGVEYXRhLCBudWxsLCAxLCBjb250ZXh0LCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzID0gY29udGV4dC5sb3NzZXM7XG4gICAgICAgIHJldHVybiBwcmVmYWJEYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZmVyZW5jZXMgdGhlIG1vc3QgcmVjZW50IGBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnRgIGNhbGwgY291bGQgbm90IHNlcmlhbGl6ZS5cbiAgICAgKlxuICAgICAqIFRoZSBjcmVhdGUgcGF0aHMgYXJlIHBsYWluIGZ1bmN0aW9ucyByZXR1cm5pbmcgdGhlIHByZWZhYiBKU09OLCBzbyBhIGxvc3MgY2Fubm90IGJlXG4gICAgICogdGhyb3duIGZyb20gd2hlcmUgaXQgaXMgZGV0ZWN0ZWQgd2l0aG91dCBhYmFuZG9uaW5nIGEgdmFsaWQgYGZhdGFsYCBmYWlsdXJlIHJlcG9ydC5cbiAgICAgKiBCb3RoIGNyZWF0ZSBwYXRocyByZWFkIHRoaXMgaW1tZWRpYXRlbHkgYWZ0ZXIgc2VyaWFsaXppbmcgYW5kIGZhaWwgb24gYSBub24tZW1wdHlcbiAgICAgKiBsaXN0IOKAlCB0aGUgc2FtZSBjb250cmFjdCBhcyB0aGUgZXhpc3RpbmcgYGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzYCBjaGVjay5cbiAgICAgKi9cbiAgICBwcml2YXRlIGxhc3RSZWZlcmVuY2VMb3NzZXM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgLyoqIENoaWxkcmVuIGBxdWVyeS1ub2RlLXRyZWVgIGxpc3RlZCB0aGF0IHRoZSBub2RlJ3MgbGl2ZSBgcXVlcnktbm9kZWAgZHVtcCBkaWQgbm90IChpc3N1ZSAjNzMpLiBSZXNldCBwZXIgY2FwdHVyZS4gKi9cbiAgICBwcml2YXRlIGxhc3RQcnVuZWRTdGFsZUNoaWxkcmVuOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICBub2RlRGF0YTogYW55LCBwYXJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwsIG5vZGVJbmRleDogbnVtYmVyLFxuICAgICAgICBjb250ZXh0OiB7IHByZWZhYkRhdGE6IGFueVtdOyBjdXJyZW50SWQ6IG51bWJlcjsgcHJlZmFiQXNzZXRJbmRleDogbnVtYmVyOyBub2RlRmlsZUlkczogTWFwPHN0cmluZywgc3RyaW5nPjsgbm9kZVV1aWRUb0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+OyBjb21wb25lbnRVdWlkVG9JbmRleDogTWFwPHN0cmluZywgbnVtYmVyPjsgbG9zc2VzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT4gfSxcbiAgICAgICAgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbiwgbm9kZU5hbWU/OiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgeyBwcmVmYWJEYXRhIH0gPSBjb250ZXh0O1xuICAgICAgICBjb25zdCBub2RlID0gdGhpcy5jcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUobm9kZURhdGEsIHBhcmVudE5vZGVJbmRleCwgbm9kZU5hbWUpO1xuXG4gICAgICAgIHdoaWxlIChwcmVmYWJEYXRhLmxlbmd0aCA8PSBub2RlSW5kZXgpIHByZWZhYkRhdGEucHVzaChudWxsKTtcbiAgICAgICAgcHJlZmFiRGF0YVtub2RlSW5kZXhdID0gbm9kZTtcblxuICAgICAgICBjb25zdCBub2RlVXVpZCA9IHRoaXMuZXh0cmFjdE5vZGVVdWlkKG5vZGVEYXRhKTtcbiAgICAgICAgY29uc3QgZmlsZUlkID0gbm9kZVV1aWQgfHwgdGhpcy5nZW5lcmF0ZUZpbGVJZCgpO1xuICAgICAgICBjb250ZXh0Lm5vZGVGaWxlSWRzLnNldChub2RlSW5kZXgudG9TdHJpbmcoKSwgZmlsZUlkKTtcbiAgICAgICAgaWYgKG5vZGVVdWlkKSBjb250ZXh0Lm5vZGVVdWlkVG9JbmRleC5zZXQobm9kZVV1aWQsIG5vZGVJbmRleCk7XG5cbiAgICAgICAgY29uc3QgY2hpbGRyZW5Ub1Byb2Nlc3MgPSB0aGlzLmdldENoaWxkcmVuVG9Qcm9jZXNzKG5vZGVEYXRhKTtcbiAgICAgICAgaWYgKGluY2x1ZGVDaGlsZHJlbiAmJiBjaGlsZHJlblRvUHJvY2Vzcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBjaGlsZEluZGljZXM6IG51bWJlcltdID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgY2hpbGRJbmRpY2VzLnB1c2goY2hpbGRJbmRleCk7XG4gICAgICAgICAgICAgICAgbm9kZS5fY2hpbGRyZW4ucHVzaCh7IFwiX19pZF9fXCI6IGNoaWxkSW5kZXggfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5jcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlblRvUHJvY2Vzc1tpXSwgbm9kZUluZGV4LCBjaGlsZEluZGljZXNbaV0sIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHMsIGNoaWxkcmVuVG9Qcm9jZXNzW2ldLm5hbWUgfHwgYENoaWxkJHtpICsgMX1gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpbmNsdWRlQ29tcG9uZW50cyAmJiBub2RlRGF0YS5jb21wb25lbnRzICYmIEFycmF5LmlzQXJyYXkobm9kZURhdGEuY29tcG9uZW50cykpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcG9uZW50IG9mIG5vZGVEYXRhLmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgICAgICAgICAgbm9kZS5fY29tcG9uZW50cy5wdXNoKHsgXCJfX2lkX19cIjogY29tcG9uZW50SW5kZXggfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IGNvbXBvbmVudC51dWlkIHx8IChjb21wb25lbnQudmFsdWUgJiYgY29tcG9uZW50LnZhbHVlLnV1aWQpO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnRVdWlkKSBjb250ZXh0LmNvbXBvbmVudFV1aWRUb0luZGV4LnNldChjb21wb25lbnRVdWlkLCBjb21wb25lbnRJbmRleCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50T2JqID0gdGhpcy5jcmVhdGVDb21wb25lbnRPYmplY3QoY29tcG9uZW50LCBub2RlSW5kZXgsIGNvbnRleHQpO1xuICAgICAgICAgICAgICAgIHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdID0gY29tcG9uZW50T2JqO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBQcmVmYWJJbmZvSW5kZXggPSBjb250ZXh0LmN1cnJlbnRJZCsrO1xuICAgICAgICAgICAgICAgIHByZWZhYkRhdGFbY29tcFByZWZhYkluZm9JbmRleF0gPSB7IFwiX190eXBlX19cIjogXCJjYy5Db21wUHJlZmFiSW5mb1wiLCBcImZpbGVJZFwiOiB0aGlzLmdlbmVyYXRlRmlsZUlkKCkgfTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50T2JqICYmIHR5cGVvZiBjb21wb25lbnRPYmogPT09ICdvYmplY3QnKSBjb21wb25lbnRPYmouX19wcmVmYWIgPSB7IFwiX19pZF9fXCI6IGNvbXBQcmVmYWJJbmZvSW5kZXggfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHByZWZhYkluZm9JbmRleCA9IGNvbnRleHQuY3VycmVudElkKys7XG4gICAgICAgIG5vZGUuX3ByZWZhYiA9IHsgXCJfX2lkX19cIjogcHJlZmFiSW5mb0luZGV4IH07XG4gICAgICAgIHByZWZhYkRhdGFbcHJlZmFiSW5mb0luZGV4XSA9IHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5QcmVmYWJJbmZvXCIsIFwicm9vdFwiOiB7IFwiX19pZF9fXCI6IDEgfSwgXCJhc3NldFwiOiB7IFwiX19pZF9fXCI6IGNvbnRleHQucHJlZmFiQXNzZXRJbmRleCB9LFxuICAgICAgICAgICAgXCJmaWxlSWRcIjogZmlsZUlkLCBcInRhcmdldE92ZXJyaWRlc1wiOiBudWxsLCBcIm5lc3RlZFByZWZhYkluc3RhbmNlUm9vdHNcIjogbnVsbCwgXCJpbnN0YW5jZVwiOiBudWxsXG4gICAgICAgIH07XG4gICAgICAgIGNvbnRleHQuY3VycmVudElkID0gcHJlZmFiSW5mb0luZGV4ICsgMTtcbiAgICB9XG5cbiAgICAvKiogYGNjLkxheWVycy5FbnVtLkRFRkFVTFRgICgxIDw8IDMwKSDigJQgdGhlIGZhbGxiYWNrIHdoZW4gYSBub2RlIGR1bXAgY2FycmllcyBubyBsYXllci4gKi9cbiAgICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBERUZBVUxUX0xBWUVSID0gMTA3Mzc0MTgyNDtcblxuICAgIC8qKlxuICAgICAqIEV1bGVyIGFuZ2xlcyBpbiBERUdSRUVTIHRvIGEgcXVhdGVybmlvbiwgbWF0Y2hpbmcgYGNjLlF1YXQuZnJvbUV1bGVyYCBleGFjdGx5LlxuICAgICAqIFZlcmlmaWVkIGFnYWluc3QgQ29jb3MgQ3JlYXRvciAzLjguNzogZXVsZXIgKDEwLCAyMCwgMzApIHNlcmlhbGl6ZXMgYXNcbiAgICAgKiAoMC4xMjc2Nzk0NDA2OTU3ODA2MywgMC4xODkzMDc4NTc0MTE5OTk5OSwgMC4yMzkyOTgzMzc3NDQ3MzAzLCAwLjk0MzcxNDM2NDE0NzQ4OSkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgZXVsZXJEZWdyZWVzVG9RdWF0KGU6IGFueSk6IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgdzogbnVtYmVyIH0ge1xuICAgICAgICBjb25zdCBoYWxmVG9SYWQgPSAwLjUgKiBNYXRoLlBJIC8gMTgwO1xuICAgICAgICBjb25zdCB4ID0gKGUueCB8fCAwKSAqIGhhbGZUb1JhZCwgeSA9IChlLnkgfHwgMCkgKiBoYWxmVG9SYWQsIHogPSAoZS56IHx8IDApICogaGFsZlRvUmFkO1xuICAgICAgICBjb25zdCBzeCA9IE1hdGguc2luKHgpLCBjeCA9IE1hdGguY29zKHgpO1xuICAgICAgICBjb25zdCBzeSA9IE1hdGguc2luKHkpLCBjeSA9IE1hdGguY29zKHkpO1xuICAgICAgICBjb25zdCBzeiA9IE1hdGguc2luKHopLCBjeiA9IE1hdGguY29zKHopO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogc3ggKiBjeSAqIGN6ICsgY3ggKiBzeSAqIHN6LFxuICAgICAgICAgICAgeTogY3ggKiBzeSAqIGN6ICsgc3ggKiBjeSAqIHN6LFxuICAgICAgICAgICAgejogY3ggKiBjeSAqIHN6IC0gc3ggKiBzeSAqIGN6LFxuICAgICAgICAgICAgdzogY3ggKiBjeSAqIGN6IC0gc3ggKiBzeSAqIHN6LFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlKG5vZGVEYXRhOiBhbnksIHBhcmVudE5vZGVJbmRleDogbnVtYmVyIHwgbnVsbCwgbm9kZU5hbWU/OiBzdHJpbmcpOiBhbnkge1xuICAgICAgICBjb25zdCBuYW1lID0gbm9kZU5hbWUgfHwgbm9kZURhdGEubmFtZT8udmFsdWUgfHwgbm9kZURhdGEubmFtZSB8fCAnTm9kZSc7XG4gICAgICAgIGNvbnN0IGxwb3MgPSBub2RlRGF0YS5wb3NpdGlvbj8udmFsdWUgfHwgbm9kZURhdGEubHBvcz8udmFsdWUgfHwgbm9kZURhdGEuX2xwb3MgfHwgeyB4OiAwLCB5OiAwLCB6OiAwIH07XG4gICAgICAgIGNvbnN0IHJvdER1bXAgPSBub2RlRGF0YS5yb3RhdGlvbj8udmFsdWUgfHwgbm9kZURhdGEubHJvdD8udmFsdWUgfHwgbm9kZURhdGEuX2xyb3QgfHwgeyB4OiAwLCB5OiAwLCB6OiAwLCB3OiAxIH07XG4gICAgICAgIC8vIGBxdWVyeS1ub2RlYCByZXBvcnRzIHJvdGF0aW9uIGFzIEVVTEVSIERFR1JFRVMgKGNjLlZlYzMsIG5vIGB3YCkg4oCUIHRoZSB2YWx1ZSB0aGVcbiAgICAgICAgLy8gaW5zcGVjdG9yJ3MgUm90YXRpb24gZmllbGQgc2hvd3MuIGBfbHJvdGAgaXMgYSBxdWF0ZXJuaW9uLCBzbyBwYXNzaW5nIHRoZSBkdW1wXG4gICAgICAgIC8vIHN0cmFpZ2h0IHRocm91Z2ggc3RvcmVkIGEgZGVncmVlIGluIGEgcXVhdGVybmlvbiBjb21wb25lbnQ6IGEgLTAuMSBkZWdyZWUgdGlsdCB3YXNcbiAgICAgICAgLy8gd3JpdHRlbiBhcyB7ejogLTAuMSwgdzogMX0sIHdoaWNoIHRoZSBlbmdpbmUgcmVhZHMgYmFjayBhcyByb3VnaGx5IC0xMS40NiBkZWdyZWVzLlxuICAgICAgICBjb25zdCBpc1F1YXQgPSByb3REdW1wLncgIT09IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgbHJvdCA9IGlzUXVhdCA/IHJvdER1bXAgOiBQcmVmYWJDcmVhdGlvblNlcnZpY2UuZXVsZXJEZWdyZWVzVG9RdWF0KHJvdER1bXApO1xuICAgICAgICBjb25zdCBldWxlciA9IGlzUXVhdCA/IHsgeDogMCwgeTogMCwgejogMCB9IDogcm90RHVtcDtcbiAgICAgICAgY29uc3QgbHNjYWxlID0gbm9kZURhdGEuc2NhbGU/LnZhbHVlIHx8IG5vZGVEYXRhLmxzY2FsZT8udmFsdWUgfHwgbm9kZURhdGEuX2xzY2FsZSB8fCB7IHg6IDEsIHk6IDEsIHo6IDEgfTtcbiAgICAgICAgY29uc3QgbGF5ZXJEdW1wID0gbm9kZURhdGEubGF5ZXI/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBub2RlRGF0YS5sYXllci52YWx1ZSA6IG5vZGVEYXRhLmxheWVyO1xuICAgICAgICBjb25zdCBsYXllciA9IHR5cGVvZiBsYXllckR1bXAgPT09ICdudW1iZXInID8gbGF5ZXJEdW1wIDogUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkRFRkFVTFRfTEFZRVI7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuTm9kZVwiLCBcIl9uYW1lXCI6IG5hbWUsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwiX3BhcmVudFwiOiBwYXJlbnROb2RlSW5kZXggIT09IG51bGwgPyB7IFwiX19pZF9fXCI6IHBhcmVudE5vZGVJbmRleCB9IDogbnVsbCxcbiAgICAgICAgICAgIFwiX2NoaWxkcmVuXCI6IFtdLCBcIl9hY3RpdmVcIjogbm9kZURhdGEuYWN0aXZlICE9PSBmYWxzZSwgXCJfY29tcG9uZW50c1wiOiBbXSwgXCJfcHJlZmFiXCI6IG51bGwsXG4gICAgICAgICAgICBcIl9scG9zXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGxwb3MueCB8fCAwLCBcInlcIjogbHBvcy55IHx8IDAsIFwielwiOiBscG9zLnogfHwgMCB9LFxuICAgICAgICAgICAgXCJfbHJvdFwiOiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBscm90LnggfHwgMCwgXCJ5XCI6IGxyb3QueSB8fCAwLCBcInpcIjogbHJvdC56IHx8IDAsIFwid1wiOiBscm90LncgIT09IHVuZGVmaW5lZCA/IGxyb3QudyA6IDEgfSxcbiAgICAgICAgICAgIFwiX2xzY2FsZVwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBsc2NhbGUueCAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnggOiAxLCBcInlcIjogbHNjYWxlLnkgIT09IHVuZGVmaW5lZCA/IGxzY2FsZS55IDogMSwgXCJ6XCI6IGxzY2FsZS56ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueiA6IDEgfSxcbiAgICAgICAgICAgIFwiX21vYmlsaXR5XCI6IDAsIFwiX2xheWVyXCI6IGxheWVyLFxuICAgICAgICAgICAgXCJfZXVsZXJcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogZXVsZXIueCB8fCAwLCBcInlcIjogZXVsZXIueSB8fCAwLCBcInpcIjogZXVsZXIueiB8fCAwIH0sIFwiX2lkXCI6IFwiXCJcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXJpYWxpemUgb25lIGNvbXBvbmVudC5cbiAgICAgKlxuICAgICAqIFRoZSBjYXB0dXJlZCBkdW1wIGlzIHRoZSBzb3VyY2Ugb2YgdHJ1dGggZm9yIGV2ZXJ5IGNvbXBvbmVudCB0eXBlLiBUaGUgcGVyLXR5cGVcbiAgICAgKiB0YWJsZXMgYmVsb3cgb25seSBmaWxsIGluIGtleXMgdGhlIGR1bXAgZGlkIG5vdCBjYXJyeSDigJQgdGhleSB1c2VkIHRvIHJ1biAqaW5zdGVhZCpcbiAgICAgKiBvZiB0aGUgZHVtcCwgd2hpY2ggc2lsZW50bHkgd3JvdGUgZW5naW5lIGRlZmF1bHRzIGZvciBgY2MuVUlUcmFuc2Zvcm1gLFxuICAgICAqIGBjYy5TcHJpdGVgLCBgY2MuQnV0dG9uYCBhbmQgYGNjLkxhYmVsYCwgYW5kIHdyb3RlIG5vdGhpbmcgYXQgYWxsIGZvciBldmVyeSBvdGhlclxuICAgICAqIHR5cGUgKCMyOCkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBjcmVhdGVDb21wb25lbnRPYmplY3QoY29tcG9uZW50RGF0YTogYW55LCBub2RlSW5kZXg6IG51bWJlciwgY29udGV4dD86IGFueSk6IGFueSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSBjb21wb25lbnREYXRhLnR5cGUgfHwgY29tcG9uZW50RGF0YS5fX3R5cGVfXyB8fCAnY2MuQ29tcG9uZW50JztcbiAgICAgICAgY29uc3QgZW5hYmxlZCA9IGNvbXBvbmVudERhdGEuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcG9uZW50RGF0YS5lbmFibGVkIDogdHJ1ZTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50OiBhbnkgPSB7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IGNvbXBvbmVudFR5cGUsIFwiX25hbWVcIjogXCJcIiwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJub2RlXCI6IHsgXCJfX2lkX19cIjogbm9kZUluZGV4IH0sIFwiX2VuYWJsZWRcIjogZW5hYmxlZCwgXCJfX3ByZWZhYlwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgY29uc3QgcHJvcGVydGllcyA9IGNvbXBvbmVudERhdGEucHJvcGVydGllcyB8fCB7fTtcbiAgICAgICAgY29uc3QgcmVuYW1lcyA9IERVTVBfS0VZX1JFTkFNRVNbY29tcG9uZW50VHlwZV0gfHwge307XG5cbiAgICAgICAgLy8gRHJvcCBldmVyeSBhY2Nlc3NvciBrZXkgdGhhdCBoYXMgaXRzIHNlcmlhbGl6ZWQgdHdpbiByaWdodCB0aGVyZSBpbiB0aGUgc2FtZSBkdW1wXG4gICAgICAgIC8vICgjMTE0IGRlZmVjdCAyKS4gVGhlIHVuZGVyc2NvcmUgc3BlbGxpbmcgaXMgdGhlIG9uZSB0aGUgZW5naW5lIHJlYWRzIGJhY2s7IGtlZXBpbmdcbiAgICAgICAgLy8gYm90aCBpcyB3aGF0IG1hZGUgdGhlIGltcG9ydGVyIHJlamVjdCB0aGUgZmlsZS4gQ29tcHV0ZWQgb25jZSwgdXAgZnJvbnQsIHNvIHRoZVxuICAgICAgICAvLyByZW5hbWUtdGFibGUgYnJhbmNoZXMgYmVsb3cgY2Fubm90IHJlaW50cm9kdWNlIGEga2V5IHRoaXMgcmVtb3ZlZC5cbiAgICAgICAgY29uc3QgYWNjZXNzb3JUd2lucyA9IG5ldyBTZXQoZmluZEFjY2Vzc29yVHdpbktleXMoY29tcG9uZW50VHlwZSwgcHJvcGVydGllcykpO1xuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHByb3BlcnRpZXMpKSB7XG4gICAgICAgICAgICBpZiAoRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrZXkpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChhY2Nlc3NvclR3aW5zLmhhcyhrZXkpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IHByb3BWYWx1ZSA9IHRoaXMucHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KHZhbHVlLCBjb250ZXh0LCBgJHtyZW5hbWVzW2tleV0gfHwga2V5fWApO1xuICAgICAgICAgICAgaWYgKHByb3BWYWx1ZSAhPT0gdW5kZWZpbmVkKSBjb21wb25lbnRbcmVuYW1lc1trZXldIHx8IGtleV0gPSBwcm9wVmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGZhbGxiYWNrXSBvZiBPYmplY3QuZW50cmllcyhDT01QT05FTlRfREVGQVVMVFNbY29tcG9uZW50VHlwZV0gfHwge30pKSB7XG4gICAgICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb21wb25lbnQsIGtleSkpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRba2V5XSA9IHR5cGVvZiBmYWxsYmFjayA9PT0gJ29iamVjdCcgJiYgZmFsbGJhY2sgIT09IG51bGwgPyBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGZhbGxiYWNrKSkgOiBmYWxsYmFjaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBBIGJ1dHRvbiB3aXRoIG5vIGNhcHR1cmVkIHRhcmdldCBwb2ludHMgYXQgaXRzIG93biBub2RlLCBtYXRjaGluZyBlZGl0b3IgYmVoYXZpb3VyLlxuICAgICAgICBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLkJ1dHRvbicgJiYgY29tcG9uZW50Ll90YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29tcG9uZW50Ll90YXJnZXQgPSB7IFwiX19pZF9fXCI6IG5vZGVJbmRleCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5zdXJlIF9pZCBpcyBsYXN0IChtYXRjaGVzIGVuZ2luZSBzZXJpYWxpemF0aW9uIG9yZGVyKVxuICAgICAgICBjb25zdCBfaWQgPSBjb21wb25lbnQuX2lkIHx8IFwiXCI7XG4gICAgICAgIGRlbGV0ZSBjb21wb25lbnQuX2lkO1xuICAgICAgICBjb21wb25lbnQuX2lkID0gX2lkO1xuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvdW50IHRoZSBkdW1wIGVudHJpZXMgdGhhdCB3b3VsZCBhY3R1YWxseSBiZSBzZXJpYWxpemVkLCBzbyB0aGUgcG9zdC13cml0ZSBjaGVja1xuICAgICAqIG9ubHkgZGVtYW5kcyBwcm9wZXJ0aWVzIGZvciBjb21wb25lbnRzIHRoYXQgaGFkIHNvbWUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBjb3VudFNlcmlhbGl6YWJsZVByb3BzKHByb3BlcnRpZXM6IGFueSk6IG51bWJlciB7XG4gICAgICAgIGlmICghcHJvcGVydGllcyB8fCB0eXBlb2YgcHJvcGVydGllcyAhPT0gJ29iamVjdCcpIHJldHVybiAwO1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMocHJvcGVydGllcykuZmlsdGVyKGsgPT4gIURVTVBfS0VZU19OT1RfU0VSSUFMSVpFRC5oYXMoaykpLmxlbmd0aDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXBvcnQgY29tcG9uZW50IHR5cGVzIHRoYXQgY2FycmllZCBsaXZlIHByb3BlcnRpZXMgaW4gdGhlIHNjZW5lIGJ1dCBzZXJpYWxpemVkIHRvXG4gICAgICogbm90aGluZyBidXQgdGhlIGJhc2UgZW52ZWxvcGUuIGBhY3Rpb249Y3JlYXRlYCBwcmV2aW91c2x5IHJlcG9ydGVkIHN1Y2Nlc3MgaW5cbiAgICAgKiBleGFjdGx5IHRoYXQgc3RhdGUgKCMyOCkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBmaW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhwcmVmYWJEYXRhOiBhbnlbXSwgbm9kZURhdGE6IGFueSk6IHN0cmluZ1tdIHtcbiAgICAgICAgY29uc3QgZXhwZWN0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wIG9mIChub2RlLmNvbXBvbmVudHMgfHwgW10pKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY291bnRTZXJpYWxpemFibGVQcm9wcyhjb21wPy5wcm9wZXJ0aWVzKSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWQuYWRkKGNvbXAudHlwZSB8fCBjb21wLl9fdHlwZV9fIHx8ICdVbmtub3duJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiAobm9kZS5jaGlsZHJlbiB8fCBbXSkpIHdhbGsoY2hpbGQpO1xuICAgICAgICB9O1xuICAgICAgICB3YWxrKG5vZGVEYXRhKTtcbiAgICAgICAgaWYgKGV4cGVjdGVkLnNpemUgPT09IDApIHJldHVybiBbXTtcblxuICAgICAgICBjb25zdCBwb3B1bGF0ZWQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBwcmVmYWJEYXRhKSB7XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcgfHwgIWV4cGVjdGVkLmhhcyhlbnRyeS5fX3R5cGVfXykpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGVudHJ5KS5zb21lKGtleSA9PiAhQkFTRV9DT01QT05FTlRfS0VZUy5oYXMoa2V5KSkpIHBvcHVsYXRlZC5hZGQoZW50cnkuX190eXBlX18pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBbLi4uZXhwZWN0ZWRdLmZpbHRlcih0eXBlID0+ICFwb3B1bGF0ZWQuaGFzKHR5cGUpKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBY2Nlc3NvciB0d2lucyB0aGUgQ0FQVFVSRUQgc2NlbmUgZHVtcCBjYXJyaWVkIHRoYXQgc3Vydml2ZWQgaW50byB0aGUgZW1pdHRlZCBwcmVmYWIuXG4gICAgICpcbiAgICAgKiBUaGlzIGlzIHRoZSByZWFsICMxMTQtZGVmZWN0LTIgaW52YXJpYW50LCBhbmQgaXQgaXMgZGVsaWJlcmF0ZWx5IGEgRElGRkVSRU5DRSBjaGVja1xuICAgICAqIHJhdGhlciB0aGFuIGEgcmUtcnVuIG9mIHRoZSBlbWlzc2lvbiBmaWx0ZXIncyBvd24gcHJlZGljYXRlLiBBc2tpbmdcbiAgICAgKiBgZmluZEFjY2Vzc29yVHdpbktleXNgIGFib3V0IGBwcmVmYWJDb250ZW50YCB3b3VsZCByZS1hc2sgdGhlIHF1ZXN0aW9uIHRoZSBmaWx0ZXIganVzdFxuICAgICAqIGFuc3dlcmVkIGFuZCBzbyBjb3VsZCBuZXZlciBmYWlsIChzZWUgdGhlIGNhbGwgc2l0ZSDigJQgbmV1dGVyaW5nIHRoYXQgYnJhbmNoIGxlYXZlc1xuICAgICAqIGV2ZXJ5IHRlc3QgZ3JlZW4pOyBjb21wYXJpbmcgY2FwdHVyZSBhZ2FpbnN0IG91dHB1dCBmYWlscyB3aGVuZXZlciB0aGUgZmlsdGVyIGlzXG4gICAgICogcmVtb3ZlZCwgbWlzLXNjb3BlZCwgb3IgdGhlIGR1bXAgc2hhcGUgY2hhbmdlcyB1bmRlciBpdC5cbiAgICAgKlxuICAgICAqIFBlci1ub2RlIGNvbXBvbmVudCBjb3VudHMgYXJlIGNvbXBhcmVkIHBvc2l0aW9uYWxseSBpbnN0ZWFkIG9mIGJ5IHV1aWQsIGJlY2F1c2UgYSBub2RlXG4gICAgICogY2FuIGhvbGQgc2V2ZXJhbCBjb21wb25lbnRzIG9mIHRoZSBzYW1lIHR5cGUgd2l0aCBubyB1dWlkIGRpc3Rpbmd1aXNoYWJsZSBhdCB0aGlzXG4gICAgICogbGV2ZWwuIFRoZSBjb3VudHMgY29tZSBmcm9tIHRoZSBzYW1lIHdhbGtzIHRoZSBzZXJpYWxpemVyIHVzZXMgKGBjb21wb25lbnRzYCBhbmRcbiAgICAgKiBgcHJvcGVydGllc2ApLCBzbyB0aGV5IGFsd2F5cyBhZ3JlZSB3aXRoIHdoYXQgYGNyZWF0ZUNvbXBvbmVudE9iamVjdGAgc2F3OyBvbmx5IHRoZVxuICAgICAqIHNoYXBlLWRlcGVuZGVudCBkZXRhaWxzIGRpZmZlciwgYW5kIHRob3NlIGFyZSBpZ25vcmVkIHJhdGhlciB0aGFuIGd1ZXNzZWQgYXQuXG4gICAgICpcbiAgICAgKiBQdXJlIGFuZCBleHBvcnRlZCBzbyBib3RoIGRpcmVjdGlvbnMgYXJlIHVuaXQtdGVzdGFibGU6IGl0IG11c3QgZmlyZSB3aGVuIGFuIGFjY2Vzc29yXG4gICAgICoga2V5IGlzIHdyaXR0ZW4gYmVzaWRlIGl0cyB0d2luLCBhbmQgc3RheSBzaWxlbnQgb24gdGhlIHJlcGFpcmVkIHNoYXBlLlxuICAgICAqL1xuICAgIGZpbmRDYXB0dXJlZEFjY2Vzc29yVHdpbnMobm9kZURhdGE6IGFueSwgcHJlZmFiRGF0YTogYW55W10pOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4ge1xuICAgICAgICBjb25zdCBjYXB0dXJlZDogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IGtleXM6IHN0cmluZ1tdIH0+ID0gW107XG4gICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcCBvZiAobm9kZS5jb21wb25lbnRzIHx8IFtdKSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSBjb21wPy50eXBlIHx8IGNvbXA/Ll9fdHlwZV9fIHx8ICdVbmtub3duJztcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9wZXJ0aWVzID0gY29tcD8ucHJvcGVydGllcyB8fCB7fTtcbiAgICAgICAgICAgICAgICBjb25zdCBrZXlzID0gZmluZEFjY2Vzc29yVHdpbktleXMoY29tcG9uZW50VHlwZSwgcHJvcGVydGllcyk7XG4gICAgICAgICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkgY2FwdHVyZWQucHVzaCh7IHR5cGU6IGNvbXBvbmVudFR5cGUsIGtleXMgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHdhbGsobm9kZURhdGEpO1xuICAgICAgICBpZiAoY2FwdHVyZWQubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgICAgICAgLy8gVGhlIHByZWZhYiBlbnRyaWVzIGZvciBub2RlIDAgb253YXJkLCBza2lwcGluZyB0aGUgbGVhZGluZyBjYy5QcmVmYWIgYXNzZXQgcmVjb3JkXG4gICAgICAgIC8vIChhbmQgYW55IGxlYWRpbmcgbnVsbCBzbG90cyksIGFyZSB0aGUgc2VyaWFsaXplZCBub2RlcyBpbiB3YWxrIG9yZGVyLlxuICAgICAgICBjb25zdCBub2RlRW50cmllcyA9IHByZWZhYkRhdGEuZmlsdGVyKFxuICAgICAgICAgICAgZW50cnkgPT4gZW50cnkgJiYgdHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0JyAmJiBlbnRyeS5fX3R5cGVfXyAhPT0gJ2NjLlByZWZhYicgJiYgQXJyYXkuaXNBcnJheShlbnRyeS5fY29tcG9uZW50cylcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBzdXJ2aXZlZDogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IGtleXM6IHN0cmluZ1tdIH0+ID0gW107XG4gICAgICAgIGxldCBjdXJzb3IgPSAwO1xuICAgICAgICBjb25zdCBjaGVjayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50Q291bnQgPSBBcnJheS5pc0FycmF5KG5vZGUuY29tcG9uZW50cykgPyBub2RlLmNvbXBvbmVudHMubGVuZ3RoIDogMDtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5OiBhbnkgPSBub2RlRW50cmllc1tjdXJzb3IrK107XG4gICAgICAgICAgICBjb25zdCBlbWl0dGVkOiBhbnlbXSA9IChlbnRyeSAmJiBBcnJheS5pc0FycmF5KGVudHJ5Ll9jb21wb25lbnRzKSlcbiAgICAgICAgICAgICAgICA/IGVudHJ5Ll9jb21wb25lbnRzLm1hcCgocmVmOiBhbnkpID0+IHByZWZhYkRhdGFbcmVmPy5fX2lkX19dKS5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgICAgICAgICA6IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb21wb25lbnRDb3VudDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IG5vZGUuY29tcG9uZW50c1tpXT8udHlwZSB8fCBub2RlLmNvbXBvbmVudHNbaV0/Ll9fdHlwZV9fIHx8ICdVbmtub3duJztcbiAgICAgICAgICAgICAgICBjb25zdCBrZXlzID0gZmluZEFjY2Vzc29yVHdpbktleXMoY29tcG9uZW50VHlwZSwgZW1pdHRlZFtpXSAmJiB0eXBlb2YgZW1pdHRlZFtpXSA9PT0gJ29iamVjdCcgPyBlbWl0dGVkW2ldIDoge30pO1xuICAgICAgICAgICAgICAgIGlmIChrZXlzLmxlbmd0aCA+IDApIHN1cnZpdmVkLnB1c2goeyB0eXBlOiBjb21wb25lbnRUeXBlLCBrZXlzIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiAobm9kZS5jaGlsZHJlbiB8fCBbXSkpIGNoZWNrKGNoaWxkKTtcbiAgICAgICAgfTtcbiAgICAgICAgY2hlY2sobm9kZURhdGEpO1xuXG4gICAgICAgIC8vIFJlcG9ydCB0aGUgY2FwdHVyZWQgc2V0LCBuYXJyb3dlZCB0byB0aGUgdHdpbiBuYW1lcyBhY3R1YWxseSBvYnNlcnZlZCBzdXJ2aXZpbmcgc29cbiAgICAgICAgLy8gdGhlIG1lc3NhZ2UgbmFtZXMgdGhlIHJlYWwgbGVhayByYXRoZXIgdGhhbiByZXN0YXRpbmcgd2hhdCB0aGUgZHVtcCBoZWxkLlxuICAgICAgICByZXR1cm4gY2FwdHVyZWQuZmlsdGVyKGNhcCA9PlxuICAgICAgICAgICAgc3Vydml2ZWQuc29tZShzdXJ2ID0+IHN1cnYudHlwZSA9PT0gY2FwLnR5cGUgJiYgc3Vydi5rZXlzLnNvbWUoayA9PiBjYXAua2V5cy5pbmNsdWRlcyhrKSkpXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLyoqIFJlLXJlYWQgdGhlIHdyaXR0ZW4gcHJlZmFiOyBmYWxscyBiYWNrIHRvIHRoZSBpbi1tZW1vcnkgY29udGVudCB3aGVuIHRoZSBwYXRoIGlzIHVucmVzb2x2YWJsZS4gKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlYWRCYWNrUHJlZmFiKHNhdmVQYXRoOiBzdHJpbmcsIGZhbGxiYWNrOiBhbnlbXSk6IFByb21pc2U8eyBkYXRhOiBhbnlbXTsgc291cmNlOiAnZGlzaycgfCAnaW4tbWVtb3J5JyB9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldChzYXZlUGF0aCk7XG4gICAgICAgICAgICBpZiAocmVzb2x2ZWQuZmlsZVBhdGgpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHBhcnNlZCkpIHJldHVybiB7IGRhdGE6IHBhcnNlZCwgc291cmNlOiAnZGlzaycgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBmYWxsIHRocm91Z2ggdG8gdGhlIGluLW1lbW9yeSBjb250ZW50XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgZGF0YTogZmFsbGJhY2ssIHNvdXJjZTogJ2luLW1lbW9yeScgfTtcbiAgICB9XG5cbiAgICAvKiogVHlwZSBuYW1lcyB3aG9zZSBkdW1wIHZhbHVlIGlzIGFuIEFTU0VUIHJlZmVyZW5jZSByYXRoZXIgdGhhbiBhIGNvbXBvbmVudCByZWZlcmVuY2UuICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQVNTRVRfVFlQRVMgPSBuZXcgU2V0KFtcbiAgICAgICAgJ2NjLlByZWZhYicsICdjYy5UZXh0dXJlMkQnLCAnY2MuU3ByaXRlRnJhbWUnLCAnY2MuTWF0ZXJpYWwnLCAnY2MuQW5pbWF0aW9uQ2xpcCcsXG4gICAgICAgICdjYy5BdWRpb0NsaXAnLCAnY2MuRm9udCcsICdjYy5Bc3NldCcsICdjYy5UVEZGb250JywgJ2NjLkJpdG1hcEZvbnQnLCAnY2MuTGFiZWxBdGxhcycsXG4gICAgICAgICdjYy5TcHJpdGVBdGxhcycsICdjYy5Kc29uQXNzZXQnLCAnY2MuVGV4dEFzc2V0JywgJ2NjLlBhcnRpY2xlQXNzZXQnLCAnY2MuTWVzaCcsXG4gICAgICAgICdjYy5Ta2VsZXRvbicsICdjYy5SZW5kZXJUZXh0dXJlJywgJ2NjLlBoeXNpY3NNYXRlcmlhbCcsICdjYy5TY2VuZUFzc2V0JywgJ2NjLkVmZmVjdEFzc2V0JyxcbiAgICBdKTtcblxuICAgIC8qKlxuICAgICAqIEFuIGFzc2V0IGlzIGVpdGhlciBleHBsaWNpdGx5IGxpc3RlZCBvciBuYW1lZCBieSBhIHN1ZmZpeCBubyBjb21wb25lbnQgdHlwZSB1c2VzLlxuICAgICAqIFRoZSBzdWZmaXggYXJtIGlzIHdoYXQga2VlcHMgYSBmdXR1cmUgY29uY3JldGUgYXNzZXQgc3ViY2xhc3MgZnJvbSBzaWxlbnRseSByZWdyZXNzaW5nXG4gICAgICogaW50byB0aGUgY29tcG9uZW50LXJlZmVyZW5jZSBicmFuY2ggdGhlIHdheSBjYy5UVEZGb250IGRpZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBpc0Fzc2V0VHlwZSh0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF0eXBlKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChQcmVmYWJDcmVhdGlvblNlcnZpY2UuQVNTRVRfVFlQRVMuaGFzKHR5cGUpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIC8oPzpGb250fEFzc2V0fEF0bGFzfENsaXApJC8udGVzdCh0eXBlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcm9jZXNzIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZXMsIGVuc3VyaW5nIGZvcm1hdCBtYXRjaGVzIG1hbnVhbGx5LWNyZWF0ZWQgcHJlZmFicy5cbiAgICAgKiBIYW5kbGVzIG5vZGUgcmVmcywgYXNzZXQgcmVmcywgY29tcG9uZW50IHJlZnMsIHR5cGVkIG1hdGgvY29sb3Igb2JqZWN0cywgYW5kIGFycmF5cy5cbiAgICAgKlxuICAgICAqIFRocm93cyBvbiBhIHJlZmVyZW5jZSBpdCBjYW5ub3Qgc2VyaWFsaXplIGZhaXRoZnVsbHkuIEV2ZXJ5IGJyYW5jaCBiZWxvdyB1c2VkIHRvXG4gICAgICogYW5zd2VyIGFuIHVucmVzb2x2YWJsZSByZWZlcmVuY2Ugd2l0aCBgbnVsbGAgKG9yIGRyb3AgaXQgZnJvbSBhbiBhcnJheSksIHdoaWNoIGlzIGhvd1xuICAgICAqIGEgY3JlYXRlZCBwcmVmYWIgY2FtZSBvdXQgaG9sbG93IHdoaWxlIGBhY3Rpb249Y3JlYXRlYCByZXBvcnRlZCBzdWNjZXNzIOKAlCBpc3N1ZSAjNzMnc1xuICAgICAqIGBfbWVzaDogbnVsbGAsIGBfbWF0ZXJpYWxzOiBbXWAgYW5kIGBsYWJlbFBlcmNlbnQ6IG51bGxgLCBlYWNoIG9mIHdoaWNoIGhhZCBiZWVuXG4gICAgICogd3JpdHRlbiB0byB0aGUgbGl2ZSBzY2VuZSBtb21lbnRzIGVhcmxpZXIuIEEgcmVmZXJlbmNlIHRoYXQgY2Fubm90IGJlIHNlcmlhbGl6ZWQgaXMgYVxuICAgICAqIGZhaWx1cmUgb2YgdGhpcyBjYWxsLCBub3QgYSB2YWx1ZSBvZiBgbnVsbGA6IHNlZVxuICAgICAqIGB+Ly5jbGF1ZGUvcnVsZXMvZGV2ZWxvcG1lbnQtcHJpbmNpcGxlcy5tZGAgwqcgXCJFcnJvcnMgT3ZlciBTaWxlbnQgRmFsbGJhY2tzXCIuXG4gICAgICovXG4gICAgcHJpdmF0ZSBwcm9jZXNzQ29tcG9uZW50UHJvcGVydHkocHJvcERhdGE6IGFueSwgY29udGV4dD86IHtcbiAgICAgICAgbm9kZVV1aWRUb0luZGV4PzogTWFwPHN0cmluZywgbnVtYmVyPjtcbiAgICAgICAgY29tcG9uZW50VXVpZFRvSW5kZXg/OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgICAgICBsb3NzZXM/OiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT47XG4gICAgfSwgcHJvcGVydHlQYXRoID0gJycpOiBhbnkge1xuICAgICAgICBpZiAoIXByb3BEYXRhIHx8IHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcpIHJldHVybiBwcm9wRGF0YTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBwcm9wRGF0YS52YWx1ZTtcbiAgICAgICAgY29uc3QgdHlwZSA9IHByb3BEYXRhLnR5cGU7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgLy8gQW4gZXhwbGljaXQgZW1wdHktdXVpZCByZWZlcmVuY2UgaXMgYSBnZW51aW5lIENMRUFSIChpc3N1ZSAjNzUpLCBub3QgYSBsb3NzLlxuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS51dWlkID09PSAnJykgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgLy8gTm9kZSByZWZlcmVuY2VzXG4gICAgICAgIGlmICh0eXBlID09PSAnY2MuTm9kZScgJiYgdmFsdWU/LnV1aWQpIHtcbiAgICAgICAgICAgIGlmIChjb250ZXh0Py5ub2RlVXVpZFRvSW5kZXg/Lmhhcyh2YWx1ZS51dWlkKSkgcmV0dXJuIHsgXCJfX2lkX19cIjogY29udGV4dC5ub2RlVXVpZFRvSW5kZXguZ2V0KHZhbHVlLnV1aWQpIH07XG4gICAgICAgICAgICAvLyBBIG5vZGUgb3V0c2lkZSB0aGUgc3VidHJlZSBiZWluZyBzZXJpYWxpemVkIGNhbm5vdCBiZSBlbmNvZGVkIGluIGEgcHJlZmFiIOKAlFxuICAgICAgICAgICAgLy8gdGhlIGZvcm1hdCBoYXMgbm8gY3Jvc3MtZmlsZSBub2RlIHJlZmVyZW5jZS4gVGhpcyBvbmUgZ2VudWluZWx5IG11c3QgYmVcbiAgICAgICAgICAgIC8vIGRyb3BwZWQsIGJ1dCBpdCBpcyBzdGlsbCBhIGRhdGEgbG9zcyBhbmQgaXMgcmVjb3JkZWQgYXMgc3VjaC5cbiAgICAgICAgICAgIHRoaXMucmVjb3JkTG9zcyhjb250ZXh0LCBwcm9wZXJ0eVBhdGgsIHZhbHVlLnV1aWQsICdub2RlIGlzIG91dHNpZGUgdGhlIHByZWZhYiBzdWJ0cmVlIGJlaW5nIHNlcmlhbGl6ZWQnKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXNzZXQgcmVmZXJlbmNlcy5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gVGhpcyBicmFuY2ggaXMgdGhlIERFRkFVTFQgZm9yIGFueSByZWZlcmVuY2UgY2FycnlpbmcgYSB1dWlkLCBiZWNhdXNlIHRoZSB0ZXN0c1xuICAgICAgICAvLyBiZWxvdyBjYW5ub3QgYm90aCBiZSBzYXRpc2ZpZWQ6IGBjYy5MYWJlbGAncyBgZm9udGAgaXMgYSBgY2MuVFRGRm9udGAgQVNTRVRcbiAgICAgICAgLy8gKHRoaXMgdGVzdCBmaWxlJ3Mgb3duIGZvbnQgcmVncmVzc2lvbiksIHdoaWxlIGBjYy5MYWJlbGAgaXMgYWxzbyBhIGxlZ2l0aW1hdGVcbiAgICAgICAgLy8gQHByb3BlcnR5IENPTVBPTkVOVCB0eXBlLiBSZWFkaW5nIHRoZSB2YWx1ZSdzIHV1aWQgYXMgYW4gYXNzZXQgaXMgd2hhdCBtYWtlcyB0aGVcbiAgICAgICAgLy8gZm9udCBjYXNlIGNvcnJlY3Q7IGV2ZXJ5IGNvbmNyZXRlIGFzc2V0IGNsYXNzIGlzIGNhdWdodCBiZWxvdyBieSBuYW1lIG9yIHN1ZmZpeC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gQXNzZXQtZmlyc3Qgd2FzIHByZXZpb3VzbHkgYnlwYXNzZWQgYnkgZGlzcGF0Y2hpbmcgb24gYGlzQXNzZXRUeXBlKHR5cGUpYCBGSVJTVCxcbiAgICAgICAgLy8gbGV0dGluZyB0aGUgY29tcG9uZW50IGJyYW5jaCdzIGB0eXBlLnN0YXJ0c1dpdGgoJ2NjLicpYCBjYXRjaC1hbGwgY2xhaW0gYW55IHR5cGVcbiAgICAgICAgLy8gdGhlIGFsbG93bGlzdCBoYWQgbm90IGJlZW4gdGF1Z2h0IOKAlCB0aGUgZXhhY3QgbWVjaGFuaXNtIGJ5IHdoaWNoIGBjYy5NZXNoYCBhbmRcbiAgICAgICAgLy8gYGNjLlNrZWxldG9uYCBiZWNhbWUgbnVsbCBlbnRyaWVzIGluIGEgY3JlYXRlZCBwcmVmYWIgKGlzc3VlcyAjNjQsICM3MCwgIzczKS5cbiAgICAgICAgaWYgKHZhbHVlPy51dWlkKSB7XG4gICAgICAgICAgICBpZiAoUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLmlzQXNzZXRUeXBlKHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgXCJfX3V1aWRfX1wiOiB2YWx1ZS51dWlkLCBcIl9fZXhwZWN0ZWRUeXBlX19cIjogdHlwZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gSW4tdHJlZSBjb21wb25lbnQgcmVmZXJlbmNlOiB0aGUgdXVpZCBuYW1lcyBhIGNvbXBvbmVudCBpbiB0aGUgc3VidHJlZSBiZWluZ1xuICAgICAgICAgICAgLy8gc2VyaWFsaXplZCwgc28gaXQgZW5jb2RlcyBhcyBhbiBvYmplY3QgaW5kZXguXG4gICAgICAgICAgICBpZiAoY29udGV4dD8uY29tcG9uZW50VXVpZFRvSW5kZXg/Lmhhcyh2YWx1ZS51dWlkKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguZ2V0KHZhbHVlLnV1aWQpIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBVbnJlc29sdmVkLiBBIHByZWZhYiBhc3NldCBoYXMgbm8gd2F5IHRvIGV4cHJlc3MgYSByZWZlcmVuY2UgdG8gc29tZXRoaW5nXG4gICAgICAgICAgICAvLyBvdXRzaWRlIHRoZSBzdWJ0cmVlLCBzbyBudWxsIGlzIHRoZSBvbmx5IGVuY29kYWJsZSBhbnN3ZXIg4oCUIGJ1dCB0aGUgbnVsbCBpc1xuICAgICAgICAgICAgLy8gbm93IFJFQ09SREVELCBhbmQgdGhlIGNyZWF0ZSBwYXRocyByZWZ1c2UgdG8gd3JpdGUgd2hlbiBhbnl0aGluZyB3YXMgcmVjb3JkZWQuXG4gICAgICAgICAgICAvLyBgbnVsbGAgaW4gc2lsZW5jZSBpcyBpc3N1ZSAjNzMncyBwcmltYXJ5IHN5bXB0b20gKGBfbWVzaDogbnVsbGAsXG4gICAgICAgICAgICAvLyBgX21hdGVyaWFsczogW11gLCBgbGFiZWxQZXJjZW50OiBudWxsYCBvbiBhIGNyZWF0ZWQgcHJlZmFiLCB3aXRoXG4gICAgICAgICAgICAvLyBgc3VjY2VzczogdHJ1ZWAgYW5kIGB2YWxpZGF0ZWAgZ3JlZW4pOyBhIHJlcG9ydGVkIGxvc3MgdGhhdCBmYWlscyB0aGUgY2FsbCBpc1xuICAgICAgICAgICAgLy8gbm90LlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIFR3byBjYXVzZXMgcmVhY2ggaGVyZSwgYW5kIHRoZSBtZXNzYWdlIG5hbWVzIGJvdGggYmVjYXVzZSB0aGUgcmVtZWRpZXMgZGlmZmVyOlxuICAgICAgICAgICAgLy8gYSByZWZlcmVuY2UgZ2VudWluZWx5IG91dHNpZGUgdGhlIHN1YnRyZWUgKGxlZ2l0aW1hdGUg4oCUIGEgYnV0dG9uIHBvaW50aW5nIGF0XG4gICAgICAgICAgICAvLyBhbm90aGVyIHByZWZhYiksIGFuZCBhbiBBU1NFVCBjbGFzcyBtaXNzaW5nIGZyb20gQVNTRVRfVFlQRVMsIHdoaWNoIGlzIHRoZVxuICAgICAgICAgICAgLy8gbWVjaGFuaXNtIGJlaGluZCBpc3N1ZXMgIzY0LyM3MC8jNzMgYW5kIHdhbnRzIHRoZSBhbGxvd2xpc3QgZXh0ZW5kZWQuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gRGVsaWJlcmF0ZWx5IE5PVCBhIHRocm93OiBgcHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5YCBydW5zIGluc2lkZVxuICAgICAgICAgICAgLy8gYGNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudGAsIHdob3NlIGNvbnRyYWN0IGlzIHRvIFJFVFVSTiB0aGUgcHJlZmFiIEpTT04sIGFuZFxuICAgICAgICAgICAgLy8gdGhyb3dpbmcgaGVyZSB3b3VsZCBhbHNvIGNhdGNoIHNjcmlwdCBjb21wb25lbnQgcmVmZXJlbmNlcyAoYEJ1Y2tldFNjcmlwdGAgaXNcbiAgICAgICAgICAgIC8vIG5vdCBhIGBjYy5gIGNsYXNzKSwgd2hpY2ggYXJlIGEgbGVnaXRpbWF0ZSBleHRlcm5hbCByZWZlcmVuY2Ug4oCUIHR1cm5pbmcgYVxuICAgICAgICAgICAgLy8gc3VwcG9ydGVkIG51bGwgaW50byBhIGZhaWx1cmUuIFRoZSBsb3NzIGxpc3QgaXMgdGhlIGNoYW5uZWwgdGhhdCBkaXN0aW5ndWlzaGVzXG4gICAgICAgICAgICAvLyB0aGVtIGJ5IGNhbGwgc2l0ZSByYXRoZXIgdGhhbiBieSBndWVzc2luZyBmcm9tIHRoZSB0eXBlIG5hbWUuXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFJlZmVyZW5jZSAke3R5cGV9IFVVSUQgJHt2YWx1ZS51dWlkfSBoYXMgbm8gZW5jb2RhYmxlIGZvcm0gaW4gYSBwcmVmYWIgKHByb3BlcnR5ICcke3Byb3BlcnR5UGF0aCB8fCAnKHVua25vd24pJ30nKWApO1xuICAgICAgICAgICAgdGhpcy5yZWNvcmRMb3NzKFxuICAgICAgICAgICAgICAgIGNvbnRleHQsIHByb3BlcnR5UGF0aCwgdmFsdWUudXVpZCxcbiAgICAgICAgICAgICAgICBgdHlwZSAnJHt0eXBlfScgaGFzIG5vIGVuY29kYWJsZSBmb3JtIOKAlCBlaXRoZXIgaXQgaXMgb3V0c2lkZSB0aGUgcHJlZmFiIHN1YnRyZWUgKGxlZ2l0aW1hdGUgZm9yIGEgY29tcG9uZW50IHJlZmVyZW5jZSkgYCArXG4gICAgICAgICAgICAgICAgYG9yIGl0IGlzIGFuIGFzc2V0IGNsYXNzIG1pc3NpbmcgZnJvbSBQcmVmYWJDcmVhdGlvblNlcnZpY2UuQVNTRVRfVFlQRVMgKGlzc3VlcyAjNjQvIzcwLyM3MylgXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUeXBlZCBtYXRoL2NvbG9yIG9iamVjdHNcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuQ29sb3InKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLnIpIHx8IDApKSwgXCJnXCI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmcpIHx8IDApKSwgXCJiXCI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmIpIHx8IDApKSwgXCJhXCI6IHZhbHVlLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmEpKSkgOiAyNTUgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuVmVjMycpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwLCBcInpcIjogTnVtYmVyKHZhbHVlLnopIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuVmVjMicpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlNpemUnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuU2l6ZVwiLCBcIndpZHRoXCI6IE51bWJlcih2YWx1ZS53aWR0aCkgfHwgMCwgXCJoZWlnaHRcIjogTnVtYmVyKHZhbHVlLmhlaWdodCkgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5RdWF0JykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlF1YXRcIiwgXCJ4XCI6IE51bWJlcih2YWx1ZS54KSB8fCAwLCBcInlcIjogTnVtYmVyKHZhbHVlLnkpIHx8IDAsIFwielwiOiBOdW1iZXIodmFsdWUueikgfHwgMCwgXCJ3XCI6IHZhbHVlLncgIT09IHVuZGVmaW5lZCA/IE51bWJlcih2YWx1ZS53KSA6IDEgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFycmF5IHByb3BlcnRpZXMuXG4gICAgICAgIC8vIEVhY2ggZWxlbWVudCBvZiBhbiBhcnJheS10eXBlZCBkdW1wIChlLmcuIGNjLk1lc2hSZW5kZXJlcidzIHNoYXJlZE1hdGVyaWFscy9cbiAgICAgICAgLy8gX21hdGVyaWFscykgaXMgaXRzZWxmIGEgbmVzdGVkIHByb3BlcnR5IGRlc2NyaXB0b3Ig4oCUIHsgdmFsdWU6IHsgdXVpZCB9LCB0eXBlLCAuLi4gfVxuICAgICAgICAvLyDigJQgbm90IGEgZmxhdCB7IHV1aWQgfS4gUmVhZGluZyBpdGVtLnV1aWQgZGlyZWN0bHkgbWF0Y2hlZCBub3RoaW5nIGZvciBldmVyeSBlbGVtZW50LFxuICAgICAgICAvLyBzbyBhIE1lc2hSZW5kZXJlcidzIGFzc2lnbmVkIG1hdGVyaWFsIHNpbGVudGx5IHNlcmlhbGl6ZWQgYXMgYW4gZW1wdHkgYXJyYXkgd2hpbGVcbiAgICAgICAgLy8gcmVwb3J0aW5nIHN1Y2Nlc3MgKHZlcmlmaWVkIGxpdmUgYWdhaW5zdCBhIHNtYXJ0LWltcG9ydGVkIEZCWCBtYXRlcmlhbCkuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIEVsZW1lbnRzIGFyZSBzZXJpYWxpemVkIHRocm91Z2ggdGhpcyBzYW1lIGZ1bmN0aW9uIHJhdGhlciB0aGFuIGEgbG9jYWxcbiAgICAgICAgLy8gYHsgX191dWlkX18gfWAgc2hhcGUsIHNvIGEgY29uY3JldGUtY2xhc3MgYXNzZXQgdHlwZSByZWFjaGVzIHRoZSBhc3NldCBicmFuY2hcbiAgICAgICAgLy8gaW5zdGVhZCBvZiBhIGhhcmRjb2RlZCBjb25zZXF1ZW5jZSBvZiBgZWxlbWVudFR5cGVEYXRhYC4gVGhlIG9sZCBzaGFwZSBkZWNsYXJlZFxuICAgICAgICAvLyBgZWxlbWVudFR5cGVEYXRhLnR5cGVgIGZvciBldmVyeSBlbGVtZW50IHJlZ2FyZGxlc3Mgb2Ygd2hhdCB0aGUgZWxlbWVudCBhY3R1YWxseVxuICAgICAgICAvLyByZWZlcmVuY2VkIOKAlCBhbmQgYC5maWx0ZXIoQm9vbGVhbilgIHR1cm5lZCBlYWNoIHVucmVzb2x2ZWQgZWxlbWVudCBpbnRvIGEgc2lsZW50bHlcbiAgICAgICAgLy8gc2hvcnRlciBhcnJheSwgd2hpY2ggaXMgaXNzdWUgIzczJ3MgYF9tYXRlcmlhbHM6IFtdYCBleGFjdGx5OiBhbiBhcnJheSBwcm9wZXJ0eVxuICAgICAgICAvLyB0aGF0IGhhZCBjb250ZW50cyBvbiB0aGUgbGl2ZSBub2RlIGFuZCBjYW1lIG91dCBvZiB0aGUgY3JlYXRlZCBwcmVmYWIgZW1wdHksIHdpdGhcbiAgICAgICAgLy8gYHN1Y2Nlc3M6IHRydWVgIGFuZCBgdmFsaWRhdGVgIHJlcG9ydGluZyBgaXNWYWxpZDogdHJ1ZWAgb3ZlciB0aGUgcmVzdWx0LlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRUeXBlID0gcHJvcERhdGEuZWxlbWVudFR5cGVEYXRhPy50eXBlO1xuICAgICAgICAgICAgY29uc3Qgc2VyaWFsaXplZCA9IHZhbHVlLm1hcCgoaXRlbTogYW55LCBpbmRleDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgaXRlbVV1aWQgPSBpdGVtPy51dWlkIHx8IGl0ZW0/LnZhbHVlPy51dWlkO1xuICAgICAgICAgICAgICAgIGlmICghaXRlbVV1aWQgJiYgZWxlbWVudFR5cGUgJiYgIWVsZW1lbnRUeXBlLnN0YXJ0c1dpdGgoJ2NjLicpKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIE5vdCBhIHJlZmVyZW5jZSBhcnJheSBhdCBhbGwg4oCUIGFuIGFycmF5IG9mIHBsYWluIHZhbHVlcy5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBpdGVtLnZhbHVlIDogaXRlbTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQW4gZWxlbWVudCdzIG93biBgdHlwZWAgaXMgYXV0aG9yaXRhdGl2ZTsgYGVsZW1lbnRUeXBlRGF0YWAgaXMgb25seSB0aGVcbiAgICAgICAgICAgICAgICAvLyBkZWNsYXJlZCBhcnJheSBlbGVtZW50IGNsYXNzLCBhbmQgZm9yIGEgc3ViY2xhc3MgZWxlbWVudCAoYGNjLlRURkZvbnRgXG4gICAgICAgICAgICAgICAgLy8gdW5kZXIgYSBgY2MuRm9udFtdYCwgYSBuZXN0ZWQtZGVzY3JpcHRvciBtYXRlcmlhbCkgdGhlIGRlY2xhcmVkIGNsYXNzIGlzXG4gICAgICAgICAgICAgICAgLy8gdGhlIHdyb25nIHRoaW5nIHRvIHdyaXRlLlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShcbiAgICAgICAgICAgICAgICAgICAgeyB2YWx1ZTogaXRlbT8udmFsdWUgIT09IHVuZGVmaW5lZCA/IGl0ZW0udmFsdWUgOiBpdGVtLCB0eXBlOiBpdGVtPy50eXBlIHx8IGVsZW1lbnRUeXBlIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICAgICAgICAgIGAke3Byb3BlcnR5UGF0aH1bJHtpbmRleH1dYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIEEgZHJvcHBlZCBlbGVtZW50IGlzIGEgbG9zcywgbm90IGEgc2hvcnRlciBhcnJheS4gYG1hcGAgbmV2ZXIgcHJvZHVjZXNcbiAgICAgICAgICAgIC8vIHVuZGVmaW5lZCBoZXJlLCBzbyB0aGlzIG9ubHkgZmlyZXMgaWYgYSBmdXR1cmUgYnJhbmNoIHN0YXJ0cyByZXR1cm5pbmcgaXQuXG4gICAgICAgICAgICByZXR1cm4gc2VyaWFsaXplZC5maWx0ZXIoKGVudHJ5OiBhbnkpID0+IGVudHJ5ICE9PSB1bmRlZmluZWQgJiYgZW50cnkgIT09IG51bGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTmVzdGVkIENDQ2xhc3MgZ3JvdXA6IHRoZSBkdW1wIG5lc3RzIGFub3RoZXIgZGVzY3JpcHRvciBtYXAgdW5kZXIgYHZhbHVlYC5cbiAgICAgICAgLy8gU2VyaWFsaXppbmcgaXQgdmVyYmF0aW0gd291bGQgd3JpdGUgZWRpdG9yIGRlc2NyaXB0b3JzICh7bmFtZSwgdmFsdWUsIHR5cGV9KVxuICAgICAgICAvLyBpbnRvIHRoZSBhc3NldCBpbnN0ZWFkIG9mIHRoZSB2YWx1ZXMgdGhlbXNlbHZlcy5cbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodmFsdWUpICYmIHRoaXMuaXNOZXN0ZWRQcm9wZXJ0eU1hcCh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5lc3RlZDogYW55ID0gdHlwZSA/IHsgXCJfX3R5cGVfX1wiOiB0eXBlIH0gOiB7fTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgW2tleSwgZW50cnldIG9mIE9iamVjdC5lbnRyaWVzKHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGlmIChEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQuaGFzKGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IG5lc3RlZFZhbHVlID0gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgIGVudHJ5LCBjb250ZXh0LCBwcm9wZXJ0eVBhdGggPyBgJHtwcm9wZXJ0eVBhdGh9LiR7a2V5fWAgOiBrZXlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmIChuZXN0ZWRWYWx1ZSAhPT0gdW5kZWZpbmVkKSBuZXN0ZWRba2V5XSA9IG5lc3RlZFZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5lc3RlZDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE90aGVyIGNvbXBsZXggdHlwZWQgb2JqZWN0c1xuICAgICAgICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB0eXBlPy5zdGFydHNXaXRoKCdjYy4nKSkgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiB0eXBlLCAuLi52YWx1ZSB9O1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVjb3JkIGEgcmVmZXJlbmNlIHRoYXQgY291bGQgbm90IGJlIHNlcmlhbGl6ZWQgZmFpdGhmdWxseS5cbiAgICAgKlxuICAgICAqIEtlcHQgYXMgYSBsaXN0IHJhdGhlciB0aGFuIGEgdGhyb3cgZm9yIHRoZSB0d28gY2FzZXMgd2hlcmUgdGhlIHByZWZhYiBmb3JtYXQgaXRzZWxmXG4gICAgICogY2Fubm90IGV4cHJlc3MgdGhlIHZhbHVlIChhIG5vZGUvY29tcG9uZW50IG91dHNpZGUgdGhlIHN1YnRyZWUpLiBUaGUgY3JlYXRlIHBhdGhzIHR1cm5cbiAgICAgKiBhIG5vbi1lbXB0eSBsaXN0IGludG8gYSBgZmF0YWxgIGZhaWx1cmUsIHNvIHRoZSBsb3NzIGlzIG5ldmVyIG1lcmVseSBhIHdhcm5pbmcgaW4gYVxuICAgICAqIGxvZyBub2JvZHkgcmVhZHMg4oCUIHdoaWNoIGlzIGhvdyAjNzMncyBkcm9wcGVkIHJlZmVyZW5jZXMgd2VudCB1bm5vdGljZWQgdGhyb3VnaFxuICAgICAqIGBjcmVhdGVgIEFORCBgdmFsaWRhdGVgLlxuICAgICAqL1xuICAgIHByaXZhdGUgcmVjb3JkTG9zcyhcbiAgICAgICAgY29udGV4dDogeyBsb3NzZXM/OiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT4gfSB8IHVuZGVmaW5lZCxcbiAgICAgICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICAgICAgdXVpZDogc3RyaW5nLFxuICAgICAgICByZWFzb246IHN0cmluZ1xuICAgICk6IHZvaWQge1xuICAgICAgICBpZiAoIWNvbnRleHQ/Lmxvc3NlcykgcmV0dXJuO1xuICAgICAgICBjb250ZXh0Lmxvc3Nlcy5wdXNoKHsgcHJvcGVydHk6IHByb3BlcnR5IHx8ICcodW5rbm93biknLCB1dWlkLCByZWFzb24gfSk7XG4gICAgfVxuXG4gICAgLyoqIFJlbmRlciByZWNvcmRlZCBsb3NzZXMgYXMgdGhlIGZhdGFsIGZhaWx1cmUgbWVzc2FnZSwgb3IgbnVsbCB3aGVuIHRoZXJlIGFyZSBub25lLiAqL1xuICAgIHByaXZhdGUgZGVzY3JpYmVSZWZlcmVuY2VMb3NzZXMobG9zc2VzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT4pOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgaWYgKGxvc3Nlcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBuYW1lZCA9IGxvc3Nlcy5tYXAobCA9PiBgJyR7bC5wcm9wZXJ0eX0nIC0+ICR7bC51dWlkfSAoJHtsLnJlYXNvbn0pYCk7XG4gICAgICAgIHJldHVybiBgJHtsb3NzZXMubGVuZ3RofSByZWZlcmVuY2UocykgY291bGQgbm90IGJlIHNlcmlhbGl6ZWQ6ICR7bmFtZWQuam9pbignOyAnKX0uYDtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGV2ZXJ5IGVudHJ5IGlzIGFuIG9iamVjdCBhbmQgYXQgbGVhc3Qgb25lIGlzIGEgQ29jb3MgcHJvcGVydHkgZGVzY3JpcHRvci4gKi9cbiAgICBwcml2YXRlIGlzTmVzdGVkUHJvcGVydHlNYXAodmFsdWU6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKHZhbHVlKTtcbiAgICAgICAgaWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBlbnRyaWVzLmV2ZXJ5KChbLCBlbnRyeV0pID0+IGVudHJ5ICE9PSBudWxsICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcpXG4gICAgICAgICAgICAmJiBlbnRyaWVzLnNvbWUoKFssIGVudHJ5XSkgPT4gaXNQcm9wZXJ0eURlc2NyaXB0b3IoZW50cnkpKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBBc3NldCBEQiBvcGVyYXRpb25zID09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZDogc3RyaW5nLCBwcmVmYWJSZWY6IHN0cmluZywgcHJlZmFiVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2Nvbm5lY3QtcHJlZmFiLWluc3RhbmNlJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJlZmFiLWNvbm5lY3Rpb24nLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlJlZiB9KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYi1saW5rJywgeyBub2RlOiBub2RlVXVpZCwgcHJlZmFiOiBwcmVmYWJSZWYgfSlcbiAgICAgICAgXTtcbiAgICAgICAgZm9yIChjb25zdCBtZXRob2Qgb2YgbWV0aG9kcykge1xuICAgICAgICAgICAgdHJ5IHsgYXdhaXQgbWV0aG9kKCk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfSBjYXRjaCB7IC8qIHRyeSBuZXh0ICovIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBbGwgcHJlZmFiIGNvbm5lY3Rpb24gbWV0aG9kcyBmYWlsZWQnIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlUHJlZmFiV2l0aE1ldGEocHJlZmFiUGF0aDogc3RyaW5nLCBwcmVmYWJEYXRhOiBhbnlbXSwgbWV0YURhdGE6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnNhdmVBc3NldEZpbGUocHJlZmFiUGF0aCwgSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlQXNzZXRGaWxlKGAke3ByZWZhYlBhdGh9Lm1ldGFgLCBKU09OLnN0cmluZ2lmeShtZXRhRGF0YSwgbnVsbCwgMikpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBzYXZlIHByZWZhYiBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlQXNzZXRGaWxlKGZpbGVQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBtZXRob2RzID0gW1xuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpLFxuICAgICAgICAgICAgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3dyaXRlLWFzc2V0JywgZmlsZVBhdGgsIGNvbnRlbnQpXG4gICAgICAgIF07XG4gICAgICAgIGZvciAoY29uc3QgbWV0aG9kIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIHRyeSB7IGF3YWl0IG1ldGhvZCgpOyByZXR1cm47IH0gY2F0Y2ggeyAvKiB0cnkgbmV4dCAqLyB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBbGwgc2F2ZSBtZXRob2RzIGZhaWxlZCcpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgYXNzZXRQYXRoLCBjb250ZW50LCB7IG92ZXJ3cml0ZTogdHJ1ZSwgcmVuYW1lOiBmYWxzZSB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGFzc2V0SW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgYXNzZXQgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlTWV0YVdpdGhBc3NldERCKGFzc2V0UGF0aDogc3RyaW5nLCBtZXRhQ29udGVudDogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldC1tZXRhJywgYXNzZXRQYXRoLCBKU09OLnN0cmluZ2lmeShtZXRhQ29udGVudCwgbnVsbCwgMikpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogYXNzZXRJbmZvIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBtZXRhIGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlaW1wb3J0QXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgYXNzZXRQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHJlc3VsdCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byByZWltcG9ydCBhc3NldCcgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlQXNzZXRXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnc2F2ZS1hc3NldCcsIGFzc2V0UGF0aCwgY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gdXBkYXRlIGFzc2V0IGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA9PT09PSBGb3JtYXQgdmFsaWRhdGlvbiA9PT09PVxuXG4gICAgLyoqXG4gICAgICogU3RydWN0dXJhbCB2YWxpZGF0aW9uIG9mIGEgc2VyaWFsaXplZCBwcmVmYWIuXG4gICAgICpcbiAgICAgKiBTdHJ1Y3R1cmFsIGFsb25lIGlzIG5vdCBcInZhbGlkXCI6IGEgcHJlZmFiIHdob3NlIGNvbXBvbmVudHMgc2VyaWFsaXplZCB0byB0aGVpciBiYXJlXG4gICAgICogZW52ZWxvcGUgcGFzc2VzIGV2ZXJ5IGNoZWNrIGhlcmUgd2hpbGUgY2Fycnlpbmcgbm9uZSBvZiB0aGUgc2NlbmUgdmFsdWVzLCB3aGljaCBpcyB3aHlcbiAgICAgKiBgbWFuYWdlX3ByZWZhYiBhY3Rpb249dmFsaWRhdGVgIHJldHVybmVkIGBpc1ZhbGlkOiB0cnVlYCBvdmVyIHRoZSBob2xsb3cgb3V0cHV0IG9mXG4gICAgICogaXNzdWUgIzczJ3Mgb3duIHJlcHJvLiBgaG9sbG93Q29tcG9uZW50c2AgcmVwb3J0cyB0aGUgY29tcG9uZW50cyB0aGF0IGhvbGQgbm90aGluZ1xuICAgICAqIGJleW9uZCBgQkFTRV9DT01QT05FTlRfS0VZU2AsIHNvIFwidmFsaWRcIiBhbmQgXCJlbXB0eVwiIGFyZSBkaXN0aW5ndWlzaGFibGUuXG4gICAgICovXG4gICAgdmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YTogYW55KTogeyBpc1ZhbGlkOiBib29sZWFuOyBpc3N1ZXM6IHN0cmluZ1tdOyBub2RlQ291bnQ6IG51bWJlcjsgY29tcG9uZW50Q291bnQ6IG51bWJlcjsgaG9sbG93Q29tcG9uZW50czogc3RyaW5nW107IGR1cGxpY2F0ZUFjY2Vzc29yS2V5czogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IGtleXM6IHN0cmluZ1tdIH0+IH0ge1xuICAgICAgICBjb25zdCBpc3N1ZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IGhvbGxvd0NvbXBvbmVudHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGNvbnN0IGR1cGxpY2F0ZUFjY2Vzc29yS2V5czogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IGtleXM6IHN0cmluZ1tdIH0+ID0gW107XG4gICAgICAgIGxldCBub2RlQ291bnQgPSAwO1xuICAgICAgICBsZXQgY29tcG9uZW50Q291bnQgPSAwO1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJlZmFiRGF0YSkpIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdQcmVmYWIgZGF0YSBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBmYWxzZSwgaXNzdWVzLCBub2RlQ291bnQsIGNvbXBvbmVudENvdW50LCBob2xsb3dDb21wb25lbnRzLCBkdXBsaWNhdGVBY2Nlc3NvcktleXMgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocHJlZmFiRGF0YS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKCdQcmVmYWIgZGF0YSBpcyBlbXB0eScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCwgaG9sbG93Q29tcG9uZW50cywgZHVwbGljYXRlQWNjZXNzb3JLZXlzIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFwcmVmYWJEYXRhWzBdIHx8IHByZWZhYkRhdGFbMF0uX190eXBlX18gIT09ICdjYy5QcmVmYWInKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnRmlyc3QgZWxlbWVudCBtdXN0IGJlIGNjLlByZWZhYiB0eXBlJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgbm9kZXNXaXRoQ29tcG9uZW50cyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICAgICAgICBwcmVmYWJEYXRhLmZvckVhY2goKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGl0ZW0uX190eXBlX18gPT09ICdjYy5Ob2RlJykge1xuICAgICAgICAgICAgICAgIG5vZGVDb3VudCsrO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIChpdGVtLl9jb21wb25lbnRzIHx8IFtdKSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVmICYmIHR5cGVvZiByZWYuX19pZF9fID09PSAnbnVtYmVyJykgbm9kZXNXaXRoQ29tcG9uZW50cy5hZGQocmVmLl9faWRfXyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpdGVtLl9fdHlwZV9fID09PSAnY2MuQ29tcFByZWZhYkluZm8nIHx8ICFpdGVtLl9fdHlwZV9fKSB7XG4gICAgICAgICAgICAgICAgLy8gU2VyaWFsaXphdGlvbiBib29ra2VlcGluZywgbmV2ZXIgYSBjb21wb25lbnQgaW5zdGFuY2UuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKFN0cmluZyhpdGVtLl9fdHlwZV9fKS5zdGFydHNXaXRoKCdjYy4nKSB8fCBpdGVtLl9fdHlwZV9fKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Q291bnQrKztcbiAgICAgICAgICAgICAgICAvLyBBIGNvbXBvbmVudCB0aGF0IGlzIHJlZmVyZW5jZWQgZnJvbSBhIG5vZGUgYnV0IGNhcnJpZXMgbm90aGluZyBidXQgdGhlXG4gICAgICAgICAgICAgICAgLy8gZW52ZWxvcGUgaGFzIGxvc3QgZXZlcnkgcHJvcGVydHkgaXQgaGVsZCBpbiB0aGUgc2NlbmUgKCMyOC8jNzMpLlxuICAgICAgICAgICAgICAgIGNvbnN0IGhvbGRzTm90aGluZ0J1dEVudmVsb3BlID0gT2JqZWN0LmtleXMoaXRlbSkuZXZlcnkoa2V5ID0+IEJBU0VfQ09NUE9ORU5UX0tFWVMuaGFzKGtleSkpO1xuICAgICAgICAgICAgICAgIGlmIChob2xkc05vdGhpbmdCdXRFbnZlbG9wZSAmJiB0eXBlb2YgaXRlbS5ub2RlPy5fX2lkX18gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvbGxvd0NvbXBvbmVudHMucHVzaChTdHJpbmcoaXRlbS5fX3R5cGVfXykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAvLyBBbiBhY2Nlc3NvciBrZXkgc2l0dGluZyBiZXNpZGUgaXRzIHNlcmlhbGl6ZWQgYF9gLXR3aW4gaXMgYSBwcmVmYWIgdGhlXG4gICAgICAgICAgICAgICAgLy8gaW1wb3J0ZXIgcmVqZWN0cyAoIzExNCBkZWZlY3QgMikuIENoZWNrZWQgaGVyZSBiZWNhdXNlIGBhY3Rpb249dmFsaWRhdGVgXG4gICAgICAgICAgICAgICAgLy8gcmVwb3J0ZWQgYGlzVmFsaWQ6IHRydWVgIG9uIHRoZSBicm9rZW4gZmlsZSBib3RoIGJlZm9yZSBBTkQgYWZ0ZXIgdGhlXG4gICAgICAgICAgICAgICAgLy8gcmVwb3J0J3MgbWFudWFsIHJlcGFpciwgc28gaXQgY2F1Z2h0IG5vdGhpbmcgYWJvdXQgdGhpcyBjbGFzcy5cbiAgICAgICAgICAgICAgICBjb25zdCB0d2lucyA9IGZpbmRBY2Nlc3NvclR3aW5LZXlzKFN0cmluZyhpdGVtLl9fdHlwZV9fKSwgaXRlbSk7XG4gICAgICAgICAgICAgICAgaWYgKHR3aW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZHVwbGljYXRlQWNjZXNzb3JLZXlzLnB1c2goeyB0eXBlOiBTdHJpbmcoaXRlbS5fX3R5cGVfXyksIGtleXM6IHR3aW5zIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChub2RlQ291bnQgPT09IDApIGlzc3Vlcy5wdXNoKCdQcmVmYWIgbXVzdCBjb250YWluIGF0IGxlYXN0IG9uZSBub2RlJyk7XG4gICAgICAgIGZvciAoY29uc3QgaG9sbG93IG9mIFsuLi5uZXcgU2V0KGhvbGxvd0NvbXBvbmVudHMpXSkge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goYENvbXBvbmVudCAnJHtob2xsb3d9JyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllcyDigJQgaXQgY2FycmllcyBub25lIG9mIHRoZSBzY2VuZSB2YWx1ZXMgaXQgaGFkIChpc3N1ZXMgIzI4LyM3MylgKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGR1cCBvZiBkdXBsaWNhdGVBY2Nlc3NvcktleXMpIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKFxuICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7ZHVwLnR5cGV9JyBzZXJpYWxpemVzIGJvdGggYW4gYWNjZXNzb3Iga2V5IGFuZCBpdHMgdW5kZXJzY29yZSB0d2luIGAgK1xuICAgICAgICAgICAgICAgIGAoJHtkdXAua2V5cy5tYXAoayA9PiBgJyR7a30nLydfJHtrfSdgKS5qb2luKCcsICcpfSkg4oCUIHRoZSBhc3NldCBpbXBvcnRlciByZWplY3RzIHRoaXMgYCArXG4gICAgICAgICAgICAgICAgYHNoYXBlIHdpdGggXCJDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyAnX25hbWUnKVwiIChpc3N1ZSAjMTE0KS5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGlzc3Vlcy5sZW5ndGggPT09IDAsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCwgaG9sbG93Q29tcG9uZW50cywgZHVwbGljYXRlQWNjZXNzb3JLZXlzIH07XG4gICAgfVxuXG4gICAgY3JlYXRlU3RhbmRhcmRNZXRhQ29udGVudChwcmVmYWJOYW1lOiBzdHJpbmcsIHByZWZhYlV1aWQ6IHN0cmluZyk6IGFueSB7XG4gICAgICAgIHJldHVybiB7IFwidmVyXCI6IFwiMS4xLjUwXCIsIFwiaW1wb3J0ZXJcIjogXCJwcmVmYWJcIiwgXCJpbXBvcnRlZFwiOiB0cnVlLCBcInV1aWRcIjogcHJlZmFiVXVpZCwgXCJmaWxlc1wiOiBbXCIuanNvblwiXSwgXCJzdWJNZXRhc1wiOiB7fSwgXCJ1c2VyRGF0YVwiOiB7IFwic3luY05vZGVOYW1lXCI6IHByZWZhYk5hbWUgfSB9O1xuICAgIH1cblxuICAgIC8vID09PT09IFVVSUQgdXRpbGl0aWVzID09PT09XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlVVVJRCgpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBjaGFycyA9ICcwMTIzNDU2Nzg5YWJjZGVmJztcbiAgICAgICAgbGV0IHV1aWQgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzMjsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaSA9PT0gOCB8fCBpID09PSAxMiB8fCBpID09PSAxNiB8fCBpID09PSAyMCkgdXVpZCArPSAnLSc7XG4gICAgICAgICAgICB1dWlkICs9IGNoYXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJzLmxlbmd0aCldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1dWlkO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2VuZXJhdGVGaWxlSWQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgY2hhcnMgPSAnYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWjAxMjM0NTY3ODkrLyc7XG4gICAgICAgIGxldCBmaWxlSWQgPSAnJztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyMjsgaSsrKSBmaWxlSWQgKz0gY2hhcnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY2hhcnMubGVuZ3RoKV07XG4gICAgICAgIHJldHVybiBmaWxlSWQ7XG4gICAgfVxuXG59XG4iXX0=