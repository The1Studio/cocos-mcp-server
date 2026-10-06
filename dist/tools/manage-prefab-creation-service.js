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
                data: Object.assign(Object.assign(Object.assign(Object.assign({ prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName, convertedToPrefabInstance: convertResult.success }, this.conversionFailureFields(convertResult)), { propertiesVerifiedFrom: readBack.source }), (this.lastPrunedStaleChildren.length > 0 ? { prunedStaleChildren: [...this.lastPrunedStaleChildren] } : {})), { message: convertResult.success ? 'Prefab created and node converted' : 'Prefab created, node conversion failed' })
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
                const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, prefabUuid, prefabPath);
                return {
                    success: true,
                    data: Object.assign(Object.assign({ prefabUuid, prefabPath, nodeUuid, prefabName, convertedToPrefabInstance: convertResult.success }, this.conversionFailureFields(convertResult)), { message: convertResult.success ? 'Custom prefab created and node converted' : 'Prefab created, node conversion failed' })
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
    /**
     * Link the scene node to the freshly written prefab asset.
     *
     * `scene:link-prefab` (nodeUuid, assetUuid — positional, the editor's own
     * `linkPrefab(nodeUuid, assetUuid)` facade call) is tried first. The three legacy
     * object-form messages never existed in 3.8.7 and are kept only as fallbacks. Every
     * rejection is collected so a failed conversion names its causes instead of the bare
     * "all methods failed" that left #130's callers guessing.
     */
    async convertNodeToPrefabInstance(nodeUuid, prefabUuid, _prefabPath) {
        const methods = [
            ['link-prefab', () => Editor.Message.request('scene', 'link-prefab', nodeUuid, prefabUuid)],
            ['connect-prefab-instance', () => Editor.Message.request('scene', 'connect-prefab-instance', { node: nodeUuid, prefab: prefabUuid })],
            ['set-prefab-connection', () => Editor.Message.request('scene', 'set-prefab-connection', { node: nodeUuid, prefab: prefabUuid })],
            ['apply-prefab-link', () => Editor.Message.request('scene', 'apply-prefab-link', { node: nodeUuid, prefab: prefabUuid })]
        ];
        const failures = [];
        for (const [name, method] of methods) {
            try {
                const result = await method();
                // A message that resolves `false` declined the link; it is not a success.
                if (result === false) {
                    failures.push(`${name}: returned false`);
                    continue;
                }
                return { success: true };
            }
            catch (err) {
                failures.push(`${name}: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            }
        }
        return { success: false, error: `All prefab connection methods failed (${failures.join('; ')})` };
    }
    /** Fields describing a failed node->instance conversion, so the failure is not buried in `message`. */
    conversionFailureFields(convertResult) {
        if (convertResult.success)
            return {};
        return {
            warning: 'The prefab asset was written, but the scene node was NOT converted into a linked prefab instance; it is still a plain node.',
            conversionError: convertResult.error,
            instruction: 'Use the written prefab as-is, or link the node in the editor (right-click node > Link Prefab). Re-running create will not retry the link.'
        };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvRUEsb0RBS0M7QUF6RUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsdUNBQXlCO0FBQ3pCLG9EQUFtRDtBQUNuRCwyRUFBMEQ7QUFDMUQsMkZBQW1GO0FBRW5GOzs7OztHQUtHO0FBQ0gsU0FBUyxvQkFBb0IsQ0FBQyxLQUFVO0lBQ3BDLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDOUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDeEUsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqSCxDQUFDO0FBRUQsc0ZBQXNGO0FBQ3RGLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDckMsTUFBTSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlO0lBQzlELFdBQVcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsa0JBQWtCO0NBQzFFLENBQUMsQ0FBQztBQUVILHdGQUF3RjtBQUN4RixN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QUssUUFBUSxFQUFFLENBQUM7WUFDckMsSUFBSSxJQUFJLEtBQUssVUFBVTtnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNoVCxJQUFJLElBQUksS0FBSyxTQUFTO2dCQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUksSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxP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LEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7SUFFTyxjQUFjO1FBQ2xCLE1BQU0sS0FBSyxHQUFHLGtFQUFrRSxDQUFDO1FBQ2pGLElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNoQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsRUFBRTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDdkYsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQzs7QUE5OEJMLHNEQWc5QkM7QUFobUJHLDJGQUEyRjtBQUNuRSxtQ0FBYSxHQUFHLFVBQVUsQUFBYixDQUFjO0FBb05uRCwyRkFBMkY7QUFDbkUsaUNBQVcsR0FBRyxJQUFJLEdBQUcsQ0FBQztJQUMxQyxXQUFXLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxrQkFBa0I7SUFDaEYsY0FBYyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLGVBQWUsRUFBRSxlQUFlO0lBQ3JGLGdCQUFnQixFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsa0JBQWtCLEVBQUUsU0FBUztJQUMvRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsb0JBQW9CLEVBQUUsZUFBZSxFQUFFLGdCQUFnQjtDQUM3RixDQUFDLEFBTGlDLENBS2hDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQcmVmYWJDcmVhdGlvblNlcnZpY2U6IGhhbmRsZXMgdGhlIGNvbXBsZXggbG9naWMgb2YgY3JlYXRpbmcgQ29jb3MgQ3JlYXRvciBwcmVmYWIgZmlsZXNcbiAqIHByb2dyYW1tYXRpY2FsbHkuIEV4dHJhY3RlZCBmcm9tIE1hbmFnZVByZWZhYiB0byBrZWVwIG1hbmFnZS1wcmVmYWIudHMgdW5kZXIgMjAwIGxpbmVzLlxuICpcbiAqIFJlc3BvbnNpYmlsaXRpZXM6XG4gKiAtIEZldGNoaW5nIG5vZGUgZGF0YSB3aXRoIGNvbXBvbmVudCBpbmZvIGZyb20gdGhlIHNjZW5lXG4gKiAtIFNlcmlhbGl6aW5nIG5vZGUgdHJlZXMgaW50byBDb2NvcyBDcmVhdG9yIHByZWZhYiBKU09OIGZvcm1hdFxuICogLSBTYXZpbmcgYW5kIHJlLWltcG9ydGluZyBhc3NldCBmaWxlcyB2aWEgYXNzZXQtZGJcbiAqIC0gTGlua2luZyBzY2VuZSBub2RlcyB0byBuZXdseSBjcmVhdGVkIHByZWZhYiBhc3NldHNcbiAqL1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBjaGlsZFV1aWRPZiB9IGZyb20gJy4vbWFuYWdlLW5vZGUtc2libGluZy1vcmRlcic7XG5pbXBvcnQgeyBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuXG4vKipcbiAqIEEgZHVtcCBlbnRyeSBpcyBhIHByb3BlcnR5IGRlc2NyaXB0b3Igd2hlbiBpdCB3cmFwcyBhIGB2YWx1ZWAgYW5kIGNhcnJpZXMgYXQgbGVhc3Qgb25lXG4gKiBlZGl0b3IgYW5ub3RhdGlvbi4gRGVsaWJlcmF0ZWx5IGxvb3NlciB0aGFuIHRoZSBpbnNwZWN0b3Itc2lkZVxuICogYGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3JgLCB3aGljaCByZWplY3RzIGRlc2NyaXB0b3JzIHdob3NlIGZpZWxkcyBhcmUgYWxsIHByaW1pdGl2ZXNcbiAqIChgeyBuYW1lLCB2YWx1ZTogNjAsIHR5cGU6ICdOdW1iZXInIH1gKSBiZWNhdXNlIGl0IGlzIGd1YXJkaW5nIGEgZGlmZmVyZW50IGNhc2UuXG4gKi9cbmZ1bmN0aW9uIGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5OiBhbnkpOiBib29sZWFuIHtcbiAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShlbnRyeSkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlbnRyeSwgJ3ZhbHVlJykpIHJldHVybiBmYWxzZTtcbiAgICByZXR1cm4gWyduYW1lJywgJ3R5cGUnLCAnZGlzcGxheU5hbWUnLCAncmVhZG9ubHknXS5zb21lKGsgPT4gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGVudHJ5LCBrKSk7XG59XG5cbi8qKiBFZGl0b3Itb25seSBkdW1wIGVudHJpZXMgdGhhdCBoYXZlIG5vIHNlcmlhbGl6ZWQgY291bnRlcnBhcnQgaW4gYSAucHJlZmFiIGZpbGUuICovXG5jb25zdCBEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQgPSBuZXcgU2V0KFtcbiAgICAnbm9kZScsICdlbmFibGVkJywgJ19fdHlwZV9fJywgJ3V1aWQnLCAnbmFtZScsICdfX3NjcmlwdEFzc2V0JyxcbiAgICAnX29iakZsYWdzJywgJ19uYW1lJywgJ19pZCcsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfX2VkaXRvckV4dHJhc19fJ1xuXSk7XG5cbi8qKiBUaGUgZW52ZWxvcGUgZXZlcnkgc2VyaWFsaXplZCBjb21wb25lbnQgY2FycmllcyBldmVuIHdoZW4gaXQgaG9sZHMgbm8gcHJvcGVydGllcy4gKi9cbmNvbnN0IEJBU0VfQ09NUE9ORU5UX0tFWVMgPSBuZXcgU2V0KFtcbiAgICAnX190eXBlX18nLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19fZWRpdG9yRXh0cmFzX18nLCAnbm9kZScsICdfZW5hYmxlZCcsICdfX3ByZWZhYicsICdfaWQnXG5dKTtcblxuLyoqIFRydWUgd2hlbiBhIHNlcmlhbGl6ZWQgY29tcG9uZW50IGtleSBpcyBhbiBlbmdpbmUgYWNjZXNzb3Igd2l0aCBhIGBfYC1wcmVmaXhlZCB0d2luLiAqL1xuZnVuY3Rpb24gaXNFbmdpbmVUeXBlKGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAvXihjY3xzcHxkcmFnb25Cb25lcylcXC4vLnRlc3QoY29tcG9uZW50VHlwZSk7XG59XG5cbi8qKlxuICogRmluZCB0aGUgYWNjZXNzb3Iga2V5cyBhIGR1bXAgY2FycmllcyBhbG9uZ3NpZGUgdGhlaXIgYF9gLXByZWZpeGVkIHNlcmlhbGl6ZWQgdHdpbi5cbiAqXG4gKiBJc3N1ZSAjMTE0IGRlZmVjdCAyLiBBIGBzY2VuZTpxdWVyeS1ub2RlYCBkdW1wIGNhcnJpZXMgQk9USCBzcGVsbGluZ3Mgb2YgYW5cbiAqIGFjY2Vzc29yLWJhY2tlZCBlbmdpbmUgZmllbGQg4oCUIHRoZSBpbnNwZWN0b3IgYWNjZXNzb3IgKGBjbGlwc2AsIGBkZWZhdWx0Q2xpcGAsXG4gKiBgc2hhcmVkTWF0ZXJpYWxzYCkgYW5kIHRoZSB0cnVlIHNlcmlhbGl6ZWQgZmllbGQgKGBfY2xpcHNgLCBgX2RlZmF1bHRDbGlwYCxcbiAqIGBfbWF0ZXJpYWxzYCkuIGBjcmVhdGVDb21wb25lbnRPYmplY3RgIGVtaXR0ZWQgZXZlcnkgZHVtcCBrZXkgdmVyYmF0aW0gdW5sZXNzIHRoZSB0eXBlXG4gKiB3YXMgaW4gYERVTVBfS0VZX1JFTkFNRVNgLCBzbyBhIGBjYy5BbmltYXRpb25gIGNvbXBvbmVudCAoYWJzZW50IGZyb20gdGhlIHRhYmxlKSB3cm90ZVxuICogYGNsaXBzYCBBTkQgYF9jbGlwc2AgYXMgc2VwYXJhdGUgdG9wLWxldmVsIGtleXMgd2l0aCBkaXZlcmdpbmcgdmFsdWVzLCBhbmQgdGhlIGFzc2V0XG4gKiBpbXBvcnRlciByZWplY3RlZCB0aGUgcHJlZmFiIG91dHJpZ2h0OlxuICpcbiAqICAgICBbQXNzZXRzXSBDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyAnX25hbWUnKSAgVHlwZUVycm9yXG4gKlxuICogVGhlIG9yaWdpbmF0aW5nIHJlcG9ydCBwaW5uZWQgdGhlIHJlcGFpciBlbXBpcmljYWxseTogc3RyaXBwaW5nIGV2ZXJ5IG5vbi11bmRlcnNjb3JlIGtleVxuICogdGhhdCBoYXMgYW4gdW5kZXJzY29yZSB0d2luIHJlcHJvZHVjZWQgdGhlIGtleSBzZXQgb2YgYSBoYW5kLWF1dGhvcmVkIHByZWZhYiwgd2hpY2hcbiAqIGltcG9ydGVkIGNsZWFubHkuXG4gKlxuICogVGhpcyBpcyB0eXBlLUFHTk9TVElDIG9uIHB1cnBvc2UuIEEgdGFibGUgdGhhdCBtdXN0IGJlIGV4dGVuZGVkIHBlciBjb25maXJtZWQgbWlzbWF0Y2hcbiAqIGFsd2F5cyBsYWdzIHRoZSBlbmdpbmU7IHRoZSB0d2luIGludmFyaWFudCBjYW5ub3QsIGFuZCBpdCBpcyBzdGF0aWNhbGx5IGRldGVjdGFibGUg4oCUXG4gKiB3aGljaCB0aGUgdGFibGUncyBvd24gZG9jc3RyaW5nIHByZXZpb3VzbHkgZGVuaWVkLlxuICpcbiAqIFNjb3BlZCB0byBFTkdJTkUgdHlwZXMuIEEgc2NyaXB0IG1heSBsZWdpdGltYXRlbHkgZGVjbGFyZSBib3RoIGBmb29gIGFuZCBgX2Zvb2AgYXNcbiAqIGRpc3RpbmN0IGBAcHJvcGVydHlgIGZpZWxkcywgYW5kIGRyb3BwaW5nIG9uZSB0aGVyZSB3b3VsZCBiZSBkYXRhIGxvc3MgcmF0aGVyIHRoYW4gYVxuICogcmVwYWlyLCBzbyBzY3JpcHQgY29tcG9uZW50cyBhcmUgbmV2ZXIgdG91Y2hlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZpbmRBY2Nlc3NvclR3aW5LZXlzKGNvbXBvbmVudFR5cGU6IHN0cmluZywgcHJvcGVydGllczogUmVjb3JkPHN0cmluZywgYW55Pik6IHN0cmluZ1tdIHtcbiAgICBpZiAoIWlzRW5naW5lVHlwZShjb21wb25lbnRUeXBlKSkgcmV0dXJuIFtdO1xuICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5maWx0ZXIoXG4gICAgICAgIGtleSA9PiAha2V5LnN0YXJ0c1dpdGgoJ18nKSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocHJvcGVydGllcywgYF8ke2tleX1gKVxuICAgICk7XG59XG5cbi8qKlxuICogS2V5cyB3aG9zZSBzZXJpYWxpemVkIGZpZWxkIG5hbWUgZGlmZmVycyAoYWNjZXNzb3ItYmFja2VkIGVuZ2luZSBwcm9wZXJ0aWVzKS5cbiAqXG4gKiBWZXJpZmllZCBvbmx5IGZvciB0aGVzZSBmb3VyIHR5cGVzIOKAlCBldmVyeSBvdGhlciBlbmdpbmUgYGNjLipgL2BzcC4qYC9gZHJhZ29uQm9uZXMuKmBcbiAqIGNvbXBvbmVudCBmYWxscyB0aHJvdWdoIHRvIHRoZSBnZW5lcmljIGJyYW5jaCBiZWxvdywgd2hpY2ggZW1pdHMgdGhlIGR1bXAga2V5XG4gKiBWRVJCQVRJTS4gRm9yIG1vc3QgZW5naW5lIHR5cGVzIHRoZSBkdW1wIGtleSBhbHJlYWR5IG1hdGNoZXMgdGhlIHNlcmlhbGl6ZWQga2V5XG4gKiAoZS5nLiBgY2MuUGFydGljbGVTeXN0ZW0yRGAncyBgZW1pc3Npb25SYXRlYCksIGJ1dCBhbiBhY2Nlc3Nvci1iYWNrZWQgZmllbGQgb24gYSB0eXBlXG4gKiBub3QgbGlzdGVkIGhlcmUgd291bGQgc2VyaWFsaXplIHVuZGVyIHRoZSBXUk9ORyBrZXkgcmF0aGVyIHRoYW4gYmVpbmcgZHJvcHBlZC5cbiAqXG4gKiBFeHRlbmQgdGhpcyB0YWJsZSBhcyBzcGVjaWZpYyBtaXNtYXRjaGVzIGFyZSBjb25maXJtZWQgYWdhaW5zdCBhIHJ1bm5pbmcgQ29jb3MgQ3JlYXRvclxuICogMy44LjcgaW5zdGFuY2Ug4oCUIGJ1dCBub3RlIHRoYXQgYGZpbmRBY2Nlc3NvclR3aW5LZXlzYCBiZWxvdyBpcyB0aGUgdHlwZS1hZ25vc3RpYyBuZXRcbiAqIHVuZGVybmVhdGggaXQ6IHdoZXJlIHRoZSBkdW1wIGNhcnJpZXMgQk9USCBzcGVsbGluZ3MsIHRoZSB0d2luIGlzIGRyb3BwZWQgcmF0aGVyIHRoYW5cbiAqIHJlcXVpcmluZyBhIHRhYmxlIGVudHJ5LCBzbyBhIHR5cGUgdGhpcyB0YWJsZSBoYXMgbmV2ZXIgaGVhcmQgb2Ygc3RpbGwgc2VyaWFsaXplc1xuICogaW1wb3J0YWJsZS4gVGhlIHRhYmxlIHJlbWFpbnMgbmVjZXNzYXJ5IGZvciB0aGUgY2FzZSB0aGUgbmV0IGNhbm5vdCBzZWUg4oCUIGFuXG4gKiBhY2Nlc3Nvci1vbmx5IGtleSB3aXRoIG5vIHNlcmlhbGl6ZWQgdHdpbiBwcmVzZW50IGluIHRoZSBzYW1lIGR1bXAuXG4gKi9cbmNvbnN0IERVTVBfS0VZX1JFTkFNRVM6IFJlY29yZDxzdHJpbmcsIFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xuICAgICdjYy5VSVRyYW5zZm9ybSc6IHsgY29udGVudFNpemU6ICdfY29udGVudFNpemUnLCBhbmNob3JQb2ludDogJ19hbmNob3JQb2ludCcgfSxcbiAgICAnY2MuU3ByaXRlJzogeyBzcHJpdGVGcmFtZTogJ19zcHJpdGVGcmFtZScsIHR5cGU6ICdfdHlwZScsIHNpemVNb2RlOiAnX3NpemVNb2RlJywgZmlsbFR5cGU6ICdfZmlsbFR5cGUnIH0sXG4gICAgJ2NjLkxhYmVsJzogeyBzdHJpbmc6ICdfc3RyaW5nJywgZm9udFNpemU6ICdfZm9udFNpemUnLCBsaW5lSGVpZ2h0OiAnX2xpbmVIZWlnaHQnLCBvdmVyZmxvdzogJ19vdmVyZmxvdycgfSxcbiAgICAnY2MuQnV0dG9uJzogeyB0YXJnZXQ6ICdfdGFyZ2V0JywgaW50ZXJhY3RhYmxlOiAnX2ludGVyYWN0YWJsZScsIHRyYW5zaXRpb246ICdfdHJhbnNpdGlvbicgfSxcbn07XG5cbi8qKlxuICogR2FwLWZpbGxlcnMsIGFwcGxpZWQgb25seSB0byBrZXlzIHRoZSBkdW1wIGRpZCBub3Qgc3VwcGx5LiBUaGVzZSBhcmUgZW5naW5lIGRlZmF1bHRzIOKAlFxuICogbmV2ZXIgYW4gb3ZlcnJpZGUgb2YgYSBjYXB0dXJlZCB2YWx1ZS5cbiAqL1xuY29uc3QgQ09NUE9ORU5UX0RFRkFVTFRTOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBhbnk+PiA9IHtcbiAgICAnY2MuVUlUcmFuc2Zvcm0nOiB7XG4gICAgICAgIF9jb250ZW50U2l6ZTogeyBcIl9fdHlwZV9fXCI6IFwiY2MuU2l6ZVwiLCBcIndpZHRoXCI6IDEwMCwgXCJoZWlnaHRcIjogMTAwIH0sXG4gICAgICAgIF9hbmNob3JQb2ludDogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogMC41LCBcInlcIjogMC41IH0sXG4gICAgfSxcbiAgICAnY2MuU3ByaXRlJzoge1xuICAgICAgICBfc3ByaXRlRnJhbWU6IG51bGwsIF90eXBlOiAwLCBfZmlsbFR5cGU6IDAsIF9zaXplTW9kZTogMSxcbiAgICAgICAgX2ZpbGxDZW50ZXI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzJcIiwgXCJ4XCI6IDAsIFwieVwiOiAwIH0sXG4gICAgICAgIF9maWxsU3RhcnQ6IDAsIF9maWxsUmFuZ2U6IDAsIF9pc1RyaW1tZWRNb2RlOiB0cnVlLCBfdXNlR3JheXNjYWxlOiBmYWxzZSxcbiAgICAgICAgX2F0bGFzOiBudWxsLFxuICAgIH0sXG4gICAgJ2NjLkJ1dHRvbic6IHtcbiAgICAgICAgX2ludGVyYWN0YWJsZTogdHJ1ZSwgX3RyYW5zaXRpb246IDMsXG4gICAgICAgIF9ub3JtYWxDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDI1NSwgXCJnXCI6IDI1NSwgXCJiXCI6IDI1NSwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfaG92ZXJDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDIxMSwgXCJnXCI6IDIxMSwgXCJiXCI6IDIxMSwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfcHJlc3NlZENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjU1LCBcImdcIjogMjU1LCBcImJcIjogMjU1LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9kaXNhYmxlZENvbG9yOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMTI0LCBcImdcIjogMTI0LCBcImJcIjogMTI0LCBcImFcIjogMjU1IH0sXG4gICAgICAgIF9ub3JtYWxTcHJpdGU6IG51bGwsIF9ob3ZlclNwcml0ZTogbnVsbCwgX3ByZXNzZWRTcHJpdGU6IG51bGwsIF9kaXNhYmxlZFNwcml0ZTogbnVsbCxcbiAgICAgICAgX2R1cmF0aW9uOiAwLjEsIF96b29tU2NhbGU6IDEuMiwgX2NsaWNrRXZlbnRzOiBbXSxcbiAgICB9LFxuICAgICdjYy5MYWJlbCc6IHtcbiAgICAgICAgX3N0cmluZzogXCJMYWJlbFwiLCBfaG9yaXpvbnRhbEFsaWduOiAxLCBfdmVydGljYWxBbGlnbjogMSxcbiAgICAgICAgX2FjdHVhbEZvbnRTaXplOiAyMCwgX2ZvbnRTaXplOiAyMCwgX2ZvbnRGYW1pbHk6IFwiQXJpYWxcIixcbiAgICAgICAgX2xpbmVIZWlnaHQ6IDI1LCBfb3ZlcmZsb3c6IDAsIF9lbmFibGVXcmFwVGV4dDogdHJ1ZSxcbiAgICAgICAgX2ZvbnQ6IG51bGwsIF9pc1N5c3RlbUZvbnRVc2VkOiB0cnVlLCBfc3BhY2luZ1g6IDAsXG4gICAgICAgIF9pc0l0YWxpYzogZmFsc2UsIF9pc0JvbGQ6IGZhbHNlLCBfaXNVbmRlcmxpbmU6IGZhbHNlLFxuICAgICAgICBfdW5kZXJsaW5lSGVpZ2h0OiAyLCBfY2FjaGVNb2RlOiAwLFxuICAgIH0sXG59O1xuXG5leHBvcnQgY2xhc3MgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlIHtcblxuICAgIGFzeW5jIGNyZWF0ZVByZWZhYldpdGhBc3NldERCKG5vZGVVdWlkOiBzdHJpbmcsIHNhdmVQYXRoOiBzdHJpbmcsIHByZWZhYk5hbWU6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZURhdGEobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGdldCBub2RlIGRhdGEnIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHRlbXBQcmVmYWJDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoW3sgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYlwiLCBcIl9uYW1lXCI6IHByZWZhYk5hbWUgfV0sIG51bGwsIDIpO1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlUmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCB0ZW1wUHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBpZiAoIWNyZWF0ZVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gY3JlYXRlUmVzdWx0O1xuXG4gICAgICAgICAgICBjb25zdCBhY3R1YWxQcmVmYWJVdWlkID0gY3JlYXRlUmVzdWx0LmRhdGE/LnV1aWQ7XG4gICAgICAgICAgICBpZiAoIWFjdHVhbFByZWZhYlV1aWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0Nhbm5vdCBnZXQgZW5naW5lLWFzc2lnbmVkIHByZWZhYiBVVUlEJyB9O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJDb250ZW50ID0gYXdhaXQgdGhpcy5jcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGEsIHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQsIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgLy8gRGVmZW5zZS1pbi1kZXB0aCBmb3IgIzExNCBkZWZlY3QgMi4gYHZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkNvbnRlbnQpYCBhbG9uZVxuICAgICAgICAgICAgLy8gd291bGQgYmUgYSBzaGFwZSBjaGVjayB0aGF0IGNhbiBuZXZlciBmYWlsOiBpdCBydW5zIGBmaW5kQWNjZXNzb3JUd2luS2V5c2Agb3ZlclxuICAgICAgICAgICAgLy8gb3V0cHV0IHRoYXQgYGNyZWF0ZUNvbXBvbmVudE9iamVjdGAgYWxyZWFkeSByYW4gdGhlIFNBTUUgcHJlZGljYXRlIG92ZXIsIHNvIGFcbiAgICAgICAgICAgIC8vIGR1cGxpY2F0ZSByZWFjaGluZyBoZXJlIGlzIGltcG9zc2libGUgYnkgY29uc3RydWN0aW9uICh2ZXJpZmllZCDigJQgbmV1dGVyaW5nIHRoaXNcbiAgICAgICAgICAgIC8vIGJyYW5jaCBsZWZ0IGV2ZXJ5IHRlc3QgZ3JlZW4pLiBUaGUgZ2VudWluZSBpbnZhcmlhbnQgaXMgYSBESUZGRVJFTkNFIG9uZTogZXZlcnlcbiAgICAgICAgICAgIC8vIGFjY2Vzc29yIHR3aW4gdGhlIENBUFRVUkVEIHNjZW5lIGR1bXAgY2FycmllcyBtdXN0IGJlIGFic2VudCBmcm9tIHdoYXQgd2UgYXJlXG4gICAgICAgICAgICAvLyBhYm91dCB0byB3cml0ZS4gVGhhdCBmaXJlcyBldmVuIGlmIHRoZSBlbWlzc2lvbiBmaWx0ZXIgaXMgcmVtb3ZlZCwgbWlzLXR5cGVkLCBvclxuICAgICAgICAgICAgLy8gdGhlIGR1bXAgc2hhcGUgY2hhbmdlcyB1bmRlciBpdCwgYmVjYXVzZSBpdCBkb2VzIG5vdCByZS1hc2sgdGhlIGZpbHRlcidzIHF1ZXN0aW9uLlxuICAgICAgICAgICAgY29uc3QgY2FwdHVyZWRUd2lucyA9IHRoaXMuZmluZENhcHR1cmVkQWNjZXNzb3JUd2lucyhub2RlRGF0YSwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBpZiAoY2FwdHVyZWRUd2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZWQgPSBjYXB0dXJlZFR3aW5zXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoZCA9PiBgJHtkLnR5cGV9ICgke2Qua2V5cy5tYXAoayA9PiBgJyR7a30nLydfJHtrfSdgKS5qb2luKCcsICcpfSlgKVxuICAgICAgICAgICAgICAgICAgICAuam9pbignOyAnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUmVmdXNpbmcgdG8gd3JpdGUgJHtzYXZlUGF0aH06IHRoZSBzY2VuZSBjYXJyaWVkIGFuIGFjY2Vzc29yIGtleSBhbG9uZ3NpZGUgaXRzIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYHVuZGVyc2NvcmUgdHdpbiBhbmQgaXQgc3Vydml2ZWQgaW50byB0aGUgcHJlZmFiIOKAlCAke25hbWVkfS4gQ29jb3MgQ3JlYXRvcidzIGFzc2V0IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYGltcG9ydGVyIHJlamVjdHMgdGhpcyBzaGFwZSAoXCJDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyAnX25hbWUnKVwiKSwgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgc28gdGhlIHByZWZhYiB3b3VsZCBiZSB1bmxvYWRhYmxlLCB5ZXQgdGhlIGNhbGxlciB3b3VsZCBoYXZlIGJlZW4gdG9sZCBpdCB3YXMgY3JlYXRlZCBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGAoaXNzdWUgIzExNCBkZWZlY3QgMikuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5czogY2FwdHVyZWRUd2lucyB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZUxvc3MgPSB0aGlzLmRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKHRoaXMubGFzdFJlZmVyZW5jZUxvc3Nlcyk7XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlTG9zcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byB3cml0ZSAke3NhdmVQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIHJlZmVyZW5jZUxvc3NlczogdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCBKU09OLnN0cmluZ2lmeShwcmVmYWJDb250ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZU1ldGFXaXRoQXNzZXREQihzYXZlUGF0aCwgdGhpcy5jcmVhdGVTdGFuZGFyZE1ldGFDb250ZW50KHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVpbXBvcnRBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgLy8gUmVhZCB0aGUgYXNzZXQgYmFjayBiZWZvcmUgcmVwb3J0aW5nIHN1Y2Nlc3MuIENvbXBvbmVudHMgdGhhdCB3ZXJlXG4gICAgICAgICAgICAvLyBjb25maWd1cmVkIGluIHRoZSBzY2VuZSBidXQgc2VyaWFsaXplZCB0byBhIGJhcmUgZW52ZWxvcGUgYXJlIGEgc2lsZW50XG4gICAgICAgICAgICAvLyBkYXRhIGxvc3MgdGhlIGNhbGxlciBjYW5ub3Qgb3RoZXJ3aXNlIGRldGVjdCAoIzI4KS5cbiAgICAgICAgICAgIGNvbnN0IHJlYWRCYWNrID0gYXdhaXQgdGhpcy5yZWFkQmFja1ByZWZhYihzYXZlUGF0aCwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhyZWFkQmFjay5kYXRhLCBub2RlRGF0YSk7XG4gICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7c2F2ZVBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QsIHZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIGFjdHVhbFByZWZhYlV1aWQsIHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29udmVyc2lvbkZhaWx1cmVGaWVsZHMoY29udmVydFJlc3VsdCksXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNWZXJpZmllZEZyb206IHJlYWRCYWNrLnNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgLi4uKHRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW4ubGVuZ3RoID4gMCA/IHsgcHJ1bmVkU3RhbGVDaGlsZHJlbjogWy4uLnRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW5dIH0gOiB7fSksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyA/ICdQcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gY3JlYXRlIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVQcmVmYWJOYXRpdmVTdHViKCk6IGFueSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiAnTmF0aXZlIHByZWZhYiBjcmVhdGlvbiBBUEkgbm90IGF2YWlsYWJsZScsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1RvIGNyZWF0ZSBhIHByZWZhYiBpbiBDb2NvcyBDcmVhdG9yOlxcbjEuIFNlbGVjdCBhIG5vZGUgaW4gdGhlIHNjZW5lXFxuMi4gRHJhZyBpdCB0byB0aGUgQXNzZXQgQnJvd3NlclxcbjMuIE9yIHJpZ2h0LWNsaWNrIHRoZSBub2RlIGFuZCBzZWxlY3QgXCJDcmVhdGUgUHJlZmFiXCInXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlUHJlZmFiQ3VzdG9tKG5vZGVVdWlkOiBzdHJpbmcsIHByZWZhYlBhdGg6IHN0cmluZywgcHJlZmFiTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgdGhpcy5nZXROb2RlRGF0YShub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIG5vdCBmb3VuZDogJHtub2RlVXVpZH1gIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlV1aWQgPSB0aGlzLmdlbmVyYXRlVVVJRCgpO1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiSnNvbkRhdGEgPSBhd2FpdCB0aGlzLmNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YSwgcHJlZmFiTmFtZSwgcHJlZmFiVXVpZCwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBjb25zdCByZWZlcmVuY2VMb3NzID0gdGhpcy5kZXNjcmliZVJlZmVyZW5jZUxvc3Nlcyh0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMpO1xuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZUxvc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUmVmdXNpbmcgdG8gd3JpdGUgJHtwcmVmYWJQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkLCBwcmVmYWJQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSwgcmVmZXJlbmNlTG9zc2VzOiB0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgdGhpcy5zYXZlUHJlZmFiV2l0aE1ldGEocHJlZmFiUGF0aCwgcHJlZmFiSnNvbkRhdGEsIHRoaXMuY3JlYXRlU3RhbmRhcmRNZXRhQ29udGVudChwcmVmYWJOYW1lLCBwcmVmYWJVdWlkKSk7XG5cbiAgICAgICAgICAgIGlmIChzYXZlUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhwcmVmYWJKc29uRGF0YSwgbm9kZURhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChsb3N0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7cHJlZmFiUGF0aH0sIGJ1dCB0aGVzZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzOiAke2xvc3Quam9pbignLCAnKX0uIFRoZSBzY2VuZSB2YWx1ZXMgd2VyZSBub3QgY2FwdHVyZWQg4oCUIGRvIG5vdCB1c2UgdGhpcyBwcmVmYWIuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGNvbXBvbmVudHNXaXRob3V0UHJvcGVydGllczogbG9zdCB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZCwgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmNvbnZlcnNpb25GYWlsdXJlRmllbGRzKGNvbnZlcnRSZXN1bHQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY29udmVydFJlc3VsdC5zdWNjZXNzID8gJ0N1c3RvbSBwcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogc2F2ZVJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHNhdmUgcHJlZmFiIGZpbGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gTm9kZSBkYXRhIHJldHJpZXZhbCA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlRGF0YShub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdGhpcy5sYXN0UHJ1bmVkU3RhbGVDaGlsZHJlbiA9IFtdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlSW5mbykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXROb2RlV2l0aENoaWxkcmVuKG5vZGVVdWlkKSB8fCBub2RlSW5mbztcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Tm9kZVdpdGhDaGlsZHJlbihub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGlmICghdHJlZSkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXROb2RlID0gdGhpcy5maW5kTm9kZUluVHJlZSh0cmVlLCBub2RlVXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0Tm9kZSA/IGF3YWl0IHRoaXMuZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyh0YXJnZXROb2RlKSA6IG51bGw7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmhhbmNlIG5vZGUgdHJlZSB3aXRoIGFjY3VyYXRlIGNvbXBvbmVudCBpbmZvIHZpYSBkaXJlY3QgRWRpdG9yIEFQSS5cbiAgICAgKiBSZXBsYWNlcyBwcmV2aW91cyBIVFRQIHNlbGYtY2FsbCB0byBsb2NhbGhvc3Q6ODU4NSB3aGljaCB3YXMgZnJhZ2lsZSBhbmQgcG9ydC1kZXBlbmRlbnQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBlbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKG5vZGU6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGlmICghbm9kZSB8fCAhbm9kZS51dWlkKSByZXR1cm4gbm9kZTtcbiAgICAgICAgbGV0IGxpdmVDaGlsZFV1aWRzOiBTZXQ8c3RyaW5nPiB8IG51bGwgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZS51dWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSkge1xuICAgICAgICAgICAgICAgIGxpdmVDaGlsZFV1aWRzID0gdGhpcy5saXZlQ2hpbGRVdWlkU2V0KG5vZGVEYXRhKTtcbiAgICAgICAgICAgICAgICAvLyBDYXJyeSB0aGUgdHJhbnNmb3JtIGR1bXAgdGhyb3VnaCBzbyBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUgY2FuIHJlYWRcbiAgICAgICAgICAgICAgICAvLyBwb3NpdGlvbi9yb3RhdGlvbi9zY2FsZSBpbnN0ZWFkIG9mIGZhbGxpbmcgYmFjayB0byBpZGVudGl0eSAoaXNzdWUgIzUwKS5cbiAgICAgICAgICAgICAgICAvLyBUaGUgcXVlcnktbm9kZSBkdW1wIHNoYXBlcyB0aGVzZSBhcyB7IHZhbHVlOiB7IHgsIHksIHogfSB9IChhbmQgdyBmb3IgcXVhdCksXG4gICAgICAgICAgICAgICAgLy8gd2hpY2ggaXMgZXhhY3RseSB0aGUgc2hhcGUgY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIHJlYWRzIHZpYSBub2RlRGF0YS5wb3NpdGlvbj8udmFsdWUuXG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLnBvc2l0aW9uKSBub2RlLnBvc2l0aW9uID0gbm9kZURhdGEucG9zaXRpb247XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLnJvdGF0aW9uKSBub2RlLnJvdGF0aW9uID0gbm9kZURhdGEucm90YXRpb247XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLnNjYWxlKSBub2RlLnNjYWxlID0gbm9kZURhdGEuc2NhbGU7XG4gICAgICAgICAgICAgICAgLy8gVGhlIGxheWVyIGlzIGNhcnJpZWQgZm9yIHRoZSBzYW1lIHJlYXNvbjogY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIGhhcmRjb2RlZFxuICAgICAgICAgICAgICAgIC8vIERFRkFVTFQsIHNvIGV2ZXJ5IG5vZGUgb2YgYSBjcmVhdGVkIHByZWZhYiBsYW5kZWQgb24gdGhlIERFRkFVTFQgbGF5ZXIgYW5kIGFcbiAgICAgICAgICAgICAgICAvLyBVSSBwcmVmYWIgKFVJXzJEKSB3YXMgY3VsbGVkIGJ5IHRoZSBVSSBjYW1lcmEg4oCUIGl0IHJlbmRlcmVkIG5vdGhpbmcuXG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLmxheWVyICE9PSB1bmRlZmluZWQpIG5vZGUubGF5ZXIgPSBub2RlRGF0YS5sYXllcjtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGBwcm9wZXJ0aWVzYCBjYXJyaWVzIHRoZSBsaXZlIHByb3BlcnR5IGR1bXAgdGhyb3VnaCB0byBzZXJpYWxpemF0aW9uLlxuICAgICAgICAgICAgICAgICAgICAvLyBSZWR1Y2luZyBlYWNoIGNvbXBvbmVudCB0byB0eXBlL3V1aWQvZW5hYmxlZCBkaXNjYXJkZWQgZXZlcnkgY29uZmlndXJlZFxuICAgICAgICAgICAgICAgICAgICAvLyB2YWx1ZSBiZWZvcmUgaXQgY291bGQgYmUgd3JpdHRlbiwgc28gYGFjdGlvbj1jcmVhdGVgIHNhdmVkIGVuZ2luZVxuICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0cyBmb3IgZXZlcnkgY29tcG9uZW50IHR5cGUgKCMyOCkuXG4gICAgICAgICAgICAgICAgICAgIG5vZGUuY29tcG9uZW50cyA9IG5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBkdW1wIG5lc3RzIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCB1bmRlciB2YWx1ZS51dWlkLnZhbHVlOyB0aGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvcC1sZXZlbCBjb21wLnV1aWQgZG9lcyBub3QgZXhpc3QgKHNhbWUgc2hhcGUgTWFuYWdlQ29tcG9uZW50LmdldENvbXBvbmVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFscmVhZHkgYWNjb3VudHMgZm9yKS4gUmVhZGluZyBvbmx5IGNvbXAudXVpZCBsZWZ0IGNvbXBvbmVudFV1aWRUb0luZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwZXJtYW5lbnRseSBlbXB0eSwgc28gZXZlcnkgY3Jvc3MtY29tcG9uZW50IHJlZmVyZW5jZSBvbiBhIGNyZWF0ZWQgcHJlZmFiXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAoZS5nLiBhIHNjcmlwdCdzIEBwcm9wZXJ0eShNZXNoUmVuZGVyZXIpL0Bwcm9wZXJ0eShMYWJlbCkgZmllbGQgcG9pbnRpbmcgYXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGEgZGVzY2VuZGFudCBub2RlJ3MgY29tcG9uZW50KSBzaWxlbnRseSBzZXJpYWxpemVkIGFzIG51bGwuXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wLmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogZXh0cmFjdENvbXBvbmVudFByb3BlcnR5RHVtcChjb21wKVxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBOb2RlICR7bm9kZS51dWlkfSBlbmhhbmNlZCB3aXRoICR7bm9kZS5jb21wb25lbnRzLmxlbmd0aH0gY29tcG9uZW50cyAoaW5jbC4gc2NyaXB0IHR5cGVzKWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGdldCBjb21wb25lbnQgaW5mbyBmb3Igbm9kZSAke25vZGUudXVpZH06YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmNoaWxkcmVuICYmIEFycmF5LmlzQXJyYXkobm9kZS5jaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGlmIChsaXZlQ2hpbGRVdWlkcykge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM3MzogYHF1ZXJ5LW5vZGUtdHJlZWAgY2FuIHN0aWxsIGxpc3QgYSBjaGlsZCB0aGF0IGBtYW5hZ2Vfbm9kZSBkZWxldGVgXG4gICAgICAgICAgICAgICAgLy8gYWxyZWFkeSByZW1vdmVkIChzZWVuIG9uIGEgbGlua2VkIHByZWZhYiBpbnN0YW5jZSksIHNvIHRoZSBjcmVhdGVkIHByZWZhYlxuICAgICAgICAgICAgICAgIC8vIHJlc3VycmVjdGVkIGl0LiBUaGUgbm9kZSdzIG93biBgcXVlcnktbm9kZWAgZHVtcCBpcyB0aGUgbGl2ZSBjaGlsZCBzZXQ7IGFcbiAgICAgICAgICAgICAgICAvLyB0cmVlIGNoaWxkIGFic2VudCBmcm9tIGl0IGlzIHN0YWxlIGFuZCBpcyBub3Qgc2VyaWFsaXplZC5cbiAgICAgICAgICAgICAgICBjb25zdCBrZXB0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZFV1aWQgPSB0aGlzLmV4dHJhY3ROb2RlVXVpZChjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZFV1aWQgJiYgIWxpdmVDaGlsZFV1aWRzLmhhcyhjaGlsZFV1aWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxhc3RQcnVuZWRTdGFsZUNoaWxkcmVuLnB1c2goY2hpbGRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgRHJvcHBpbmcgY2hpbGQgJHtjaGlsZFV1aWR9IG9mICR7bm9kZS51dWlkfTogbGlzdGVkIGJ5IHF1ZXJ5LW5vZGUtdHJlZSBidXQgYWJzZW50IGZyb20gdGhlIG5vZGUncyBsaXZlIGNoaWxkcmVuYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBrZXB0LnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuID0ga2VwdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW5baV0gPSBhd2FpdCB0aGlzLmVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHMobm9kZS5jaGlsZHJlbltpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHV1aWRzIG9mIGEgbm9kZSdzIGxpdmUgY2hpbGRyZW4gYXMgaXRzIG93biBgcXVlcnktbm9kZWAgZHVtcCByZXBvcnRzIHRoZW0sIG9yIG51bGxcbiAgICAgKiB3aGVuIHRoZSBkdW1wIGRvZXMgbm90IGNhcnJ5IGEgcmVhZGFibGUgY2hpbGQgbGlzdCDigJQgYW4gdW5yZWFkYWJsZSBsaXN0IHByb3ZlcyBub3RoaW5nLFxuICAgICAqIHNvIHRoZSBjYWxsZXIga2VlcHMgZXZlcnkgdHJlZSBjaGlsZCByYXRoZXIgdGhhbiBwcnVuaW5nIG9uIGEgZ3Vlc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBsaXZlQ2hpbGRVdWlkU2V0KG5vZGVEYXRhOiBhbnkpOiBTZXQ8c3RyaW5nPiB8IG51bGwge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobm9kZURhdGE/LmNoaWxkcmVuKSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IHV1aWRzID0gbm9kZURhdGEuY2hpbGRyZW4ubWFwKChjOiBhbnkpID0+IGNoaWxkVXVpZE9mKGMpKTtcbiAgICAgICAgaWYgKHV1aWRzLnNvbWUoKHU6IHN0cmluZykgPT4gIXUpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIG5ldyBTZXQ8c3RyaW5nPih1dWlkcyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBmaW5kTm9kZUluVHJlZShub2RlOiBhbnksIHRhcmdldFV1aWQ6IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGlmICghbm9kZSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmIChub2RlLnV1aWQgPT09IHRhcmdldFV1aWQgfHwgbm9kZS52YWx1ZT8udXVpZCA9PT0gdGFyZ2V0VXVpZCkgcmV0dXJuIG5vZGU7XG4gICAgICAgIGlmIChub2RlLmNoaWxkcmVuICYmIEFycmF5LmlzQXJyYXkobm9kZS5jaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kTm9kZUluVHJlZShjaGlsZCwgdGFyZ2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRDaGlsZHJlblRvUHJvY2Vzcyhub2RlRGF0YTogYW55KTogYW55W10ge1xuICAgICAgICBjb25zdCBjaGlsZHJlbjogYW55W10gPSBbXTtcbiAgICAgICAgaWYgKG5vZGVEYXRhLmNoaWxkcmVuICYmIEFycmF5LmlzQXJyYXkobm9kZURhdGEuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGVEYXRhLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWxpZE5vZGVEYXRhKGNoaWxkKSkgY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNWYWxpZE5vZGVEYXRhKG5vZGVEYXRhOiBhbnkpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCFub2RlRGF0YSB8fCB0eXBlb2Ygbm9kZURhdGEgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgndXVpZCcpIHx8IG5vZGVEYXRhLmhhc093blByb3BlcnR5KCduYW1lJykgfHwgbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ19fdHlwZV9fJykgfHxcbiAgICAgICAgICAgIChub2RlRGF0YS52YWx1ZSAmJiAobm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ3V1aWQnKSB8fCBub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpIHx8IG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCdfX3R5cGVfXycpKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHRyYWN0Tm9kZVV1aWQobm9kZURhdGE6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlRGF0YS51dWlkID09PSAnc3RyaW5nJykgcmV0dXJuIG5vZGVEYXRhLnV1aWQ7XG4gICAgICAgIGlmIChub2RlRGF0YS52YWx1ZSAmJiB0eXBlb2Ygbm9kZURhdGEudmFsdWUudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBub2RlRGF0YS52YWx1ZS51dWlkO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBQcmVmYWIgc2VyaWFsaXphdGlvbiA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGE6IGFueSwgcHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcsIGluY2x1ZGVDaGlsZHJlbjogYm9vbGVhbiwgaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4pOiBQcm9taXNlPGFueVtdPiB7XG4gICAgICAgIGNvbnN0IHByZWZhYkRhdGE6IGFueVtdID0gW107XG4gICAgICAgIHByZWZhYkRhdGEucHVzaCh7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuUHJlZmFiXCIsIFwiX25hbWVcIjogcHJlZmFiTmFtZSB8fCBcIlwiLCBcIl9vYmpGbGFnc1wiOiAwLCBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICBcIl9uYXRpdmVcIjogXCJcIiwgXCJkYXRhXCI6IHsgXCJfX2lkX19cIjogMSB9LCBcIm9wdGltaXphdGlvblBvbGljeVwiOiAwLCBcInBlcnNpc3RlbnRcIjogZmFsc2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IHtcbiAgICAgICAgICAgIHByZWZhYkRhdGEsIGN1cnJlbnRJZDogMiwgcHJlZmFiQXNzZXRJbmRleDogMCxcbiAgICAgICAgICAgIG5vZGVGaWxlSWRzOiBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpLFxuICAgICAgICAgICAgbm9kZVV1aWRUb0luZGV4OiBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpLFxuICAgICAgICAgICAgY29tcG9uZW50VXVpZFRvSW5kZXg6IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCksXG4gICAgICAgICAgICBsb3NzZXM6IFtdIGFzIEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PlxuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tcGxldGVOb2RlVHJlZShub2RlRGF0YSwgbnVsbCwgMSwgY29udGV4dCwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cywgcHJlZmFiTmFtZSk7XG4gICAgICAgIHRoaXMubGFzdFJlZmVyZW5jZUxvc3NlcyA9IGNvbnRleHQubG9zc2VzO1xuICAgICAgICByZXR1cm4gcHJlZmFiRGF0YTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2VzIHRoZSBtb3N0IHJlY2VudCBgY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50YCBjYWxsIGNvdWxkIG5vdCBzZXJpYWxpemUuXG4gICAgICpcbiAgICAgKiBUaGUgY3JlYXRlIHBhdGhzIGFyZSBwbGFpbiBmdW5jdGlvbnMgcmV0dXJuaW5nIHRoZSBwcmVmYWIgSlNPTiwgc28gYSBsb3NzIGNhbm5vdCBiZVxuICAgICAqIHRocm93biBmcm9tIHdoZXJlIGl0IGlzIGRldGVjdGVkIHdpdGhvdXQgYWJhbmRvbmluZyBhIHZhbGlkIGBmYXRhbGAgZmFpbHVyZSByZXBvcnQuXG4gICAgICogQm90aCBjcmVhdGUgcGF0aHMgcmVhZCB0aGlzIGltbWVkaWF0ZWx5IGFmdGVyIHNlcmlhbGl6aW5nIGFuZCBmYWlsIG9uIGEgbm9uLWVtcHR5XG4gICAgICogbGlzdCDigJQgdGhlIHNhbWUgY29udHJhY3QgYXMgdGhlIGV4aXN0aW5nIGBmaW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllc2AgY2hlY2suXG4gICAgICovXG4gICAgcHJpdmF0ZSBsYXN0UmVmZXJlbmNlTG9zc2VzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT4gPSBbXTtcblxuICAgIC8qKiBDaGlsZHJlbiBgcXVlcnktbm9kZS10cmVlYCBsaXN0ZWQgdGhhdCB0aGUgbm9kZSdzIGxpdmUgYHF1ZXJ5LW5vZGVgIGR1bXAgZGlkIG5vdCAoaXNzdWUgIzczKS4gUmVzZXQgcGVyIGNhcHR1cmUuICovXG4gICAgcHJpdmF0ZSBsYXN0UHJ1bmVkU3RhbGVDaGlsZHJlbjogc3RyaW5nW10gPSBbXTtcblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQ29tcGxldGVOb2RlVHJlZShcbiAgICAgICAgbm9kZURhdGE6IGFueSwgcGFyZW50Tm9kZUluZGV4OiBudW1iZXIgfCBudWxsLCBub2RlSW5kZXg6IG51bWJlcixcbiAgICAgICAgY29udGV4dDogeyBwcmVmYWJEYXRhOiBhbnlbXTsgY3VycmVudElkOiBudW1iZXI7IHByZWZhYkFzc2V0SW5kZXg6IG51bWJlcjsgbm9kZUZpbGVJZHM6IE1hcDxzdHJpbmcsIHN0cmluZz47IG5vZGVVdWlkVG9JbmRleDogTWFwPHN0cmluZywgbnVtYmVyPjsgY29tcG9uZW50VXVpZFRvSW5kZXg6IE1hcDxzdHJpbmcsIG51bWJlcj47IGxvc3NlczogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+IH0sXG4gICAgICAgIGluY2x1ZGVDaGlsZHJlbjogYm9vbGVhbiwgaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4sIG5vZGVOYW1lPzogc3RyaW5nXG4gICAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgICAgIGNvbnN0IHsgcHJlZmFiRGF0YSB9ID0gY29udGV4dDtcbiAgICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlKG5vZGVEYXRhLCBwYXJlbnROb2RlSW5kZXgsIG5vZGVOYW1lKTtcblxuICAgICAgICB3aGlsZSAocHJlZmFiRGF0YS5sZW5ndGggPD0gbm9kZUluZGV4KSBwcmVmYWJEYXRhLnB1c2gobnVsbCk7XG4gICAgICAgIHByZWZhYkRhdGFbbm9kZUluZGV4XSA9IG5vZGU7XG5cbiAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSB0aGlzLmV4dHJhY3ROb2RlVXVpZChub2RlRGF0YSk7XG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IG5vZGVVdWlkIHx8IHRoaXMuZ2VuZXJhdGVGaWxlSWQoKTtcbiAgICAgICAgY29udGV4dC5ub2RlRmlsZUlkcy5zZXQobm9kZUluZGV4LnRvU3RyaW5nKCksIGZpbGVJZCk7XG4gICAgICAgIGlmIChub2RlVXVpZCkgY29udGV4dC5ub2RlVXVpZFRvSW5kZXguc2V0KG5vZGVVdWlkLCBub2RlSW5kZXgpO1xuXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuVG9Qcm9jZXNzID0gdGhpcy5nZXRDaGlsZHJlblRvUHJvY2Vzcyhub2RlRGF0YSk7XG4gICAgICAgIGlmIChpbmNsdWRlQ2hpbGRyZW4gJiYgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRpY2VzOiBudW1iZXJbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlblRvUHJvY2Vzcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kZXggPSBjb250ZXh0LmN1cnJlbnRJZCsrO1xuICAgICAgICAgICAgICAgIGNoaWxkSW5kaWNlcy5wdXNoKGNoaWxkSW5kZXgpO1xuICAgICAgICAgICAgICAgIG5vZGUuX2NoaWxkcmVuLnB1c2goeyBcIl9faWRfX1wiOiBjaGlsZEluZGV4IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaGlsZHJlblRvUHJvY2Vzcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tcGxldGVOb2RlVHJlZShcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5Ub1Byb2Nlc3NbaV0sIG5vZGVJbmRleCwgY2hpbGRJbmRpY2VzW2ldLCBjb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzLCBjaGlsZHJlblRvUHJvY2Vzc1tpXS5uYW1lIHx8IGBDaGlsZCR7aSArIDF9YFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW5jbHVkZUNvbXBvbmVudHMgJiYgbm9kZURhdGEuY29tcG9uZW50cyAmJiBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNvbXBvbmVudHMpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBub2RlRGF0YS5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50SW5kZXggPSBjb250ZXh0LmN1cnJlbnRJZCsrO1xuICAgICAgICAgICAgICAgIG5vZGUuX2NvbXBvbmVudHMucHVzaCh7IFwiX19pZF9fXCI6IGNvbXBvbmVudEluZGV4IH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSBjb21wb25lbnQudXVpZCB8fCAoY29tcG9uZW50LnZhbHVlICYmIGNvbXBvbmVudC52YWx1ZS51dWlkKTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50VXVpZCkgY29udGV4dC5jb21wb25lbnRVdWlkVG9JbmRleC5zZXQoY29tcG9uZW50VXVpZCwgY29tcG9uZW50SW5kZXgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudE9iaiA9IHRoaXMuY3JlYXRlQ29tcG9uZW50T2JqZWN0KGNvbXBvbmVudCwgbm9kZUluZGV4LCBjb250ZXh0KTtcbiAgICAgICAgICAgICAgICBwcmVmYWJEYXRhW2NvbXBvbmVudEluZGV4XSA9IGNvbXBvbmVudE9iajtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wUHJlZmFiSW5mb0luZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBwcmVmYWJEYXRhW2NvbXBQcmVmYWJJbmZvSW5kZXhdID0geyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29tcFByZWZhYkluZm9cIiwgXCJmaWxlSWRcIjogdGhpcy5nZW5lcmF0ZUZpbGVJZCgpIH07XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudE9iaiAmJiB0eXBlb2YgY29tcG9uZW50T2JqID09PSAnb2JqZWN0JykgY29tcG9uZW50T2JqLl9fcHJlZmFiID0geyBcIl9faWRfX1wiOiBjb21wUHJlZmFiSW5mb0luZGV4IH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBjb250ZXh0LmN1cnJlbnRJZCsrO1xuICAgICAgICBub2RlLl9wcmVmYWIgPSB7IFwiX19pZF9fXCI6IHByZWZhYkluZm9JbmRleCB9O1xuICAgICAgICBwcmVmYWJEYXRhW3ByZWZhYkluZm9JbmRleF0gPSB7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuUHJlZmFiSW5mb1wiLCBcInJvb3RcIjogeyBcIl9faWRfX1wiOiAxIH0sIFwiYXNzZXRcIjogeyBcIl9faWRfX1wiOiBjb250ZXh0LnByZWZhYkFzc2V0SW5kZXggfSxcbiAgICAgICAgICAgIFwiZmlsZUlkXCI6IGZpbGVJZCwgXCJ0YXJnZXRPdmVycmlkZXNcIjogbnVsbCwgXCJuZXN0ZWRQcmVmYWJJbnN0YW5jZVJvb3RzXCI6IG51bGwsIFwiaW5zdGFuY2VcIjogbnVsbFxuICAgICAgICB9O1xuICAgICAgICBjb250ZXh0LmN1cnJlbnRJZCA9IHByZWZhYkluZm9JbmRleCArIDE7XG4gICAgfVxuXG4gICAgLyoqIGBjYy5MYXllcnMuRW51bS5ERUZBVUxUYCAoMSA8PCAzMCkg4oCUIHRoZSBmYWxsYmFjayB3aGVuIGEgbm9kZSBkdW1wIGNhcnJpZXMgbm8gbGF5ZXIuICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgREVGQVVMVF9MQVlFUiA9IDEwNzM3NDE4MjQ7XG5cbiAgICAvKipcbiAgICAgKiBFdWxlciBhbmdsZXMgaW4gREVHUkVFUyB0byBhIHF1YXRlcm5pb24sIG1hdGNoaW5nIGBjYy5RdWF0LmZyb21FdWxlcmAgZXhhY3RseS5cbiAgICAgKiBWZXJpZmllZCBhZ2FpbnN0IENvY29zIENyZWF0b3IgMy44Ljc6IGV1bGVyICgxMCwgMjAsIDMwKSBzZXJpYWxpemVzIGFzXG4gICAgICogKDAuMTI3Njc5NDQwNjk1NzgwNjMsIDAuMTg5MzA3ODU3NDExOTk5OTksIDAuMjM5Mjk4MzM3NzQ0NzMwMywgMC45NDM3MTQzNjQxNDc0ODkpLlxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIGV1bGVyRGVncmVlc1RvUXVhdChlOiBhbnkpOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyOyB6OiBudW1iZXI7IHc6IG51bWJlciB9IHtcbiAgICAgICAgY29uc3QgaGFsZlRvUmFkID0gMC41ICogTWF0aC5QSSAvIDE4MDtcbiAgICAgICAgY29uc3QgeCA9IChlLnggfHwgMCkgKiBoYWxmVG9SYWQsIHkgPSAoZS55IHx8IDApICogaGFsZlRvUmFkLCB6ID0gKGUueiB8fCAwKSAqIGhhbGZUb1JhZDtcbiAgICAgICAgY29uc3Qgc3ggPSBNYXRoLnNpbih4KSwgY3ggPSBNYXRoLmNvcyh4KTtcbiAgICAgICAgY29uc3Qgc3kgPSBNYXRoLnNpbih5KSwgY3kgPSBNYXRoLmNvcyh5KTtcbiAgICAgICAgY29uc3Qgc3ogPSBNYXRoLnNpbih6KSwgY3ogPSBNYXRoLmNvcyh6KTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHg6IHN4ICogY3kgKiBjeiArIGN4ICogc3kgKiBzeixcbiAgICAgICAgICAgIHk6IGN4ICogc3kgKiBjeiArIHN4ICogY3kgKiBzeixcbiAgICAgICAgICAgIHo6IGN4ICogY3kgKiBzeiAtIHN4ICogc3kgKiBjeixcbiAgICAgICAgICAgIHc6IGN4ICogY3kgKiBjeiAtIHN4ICogc3kgKiBzeixcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZShub2RlRGF0YTogYW55LCBwYXJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwsIG5vZGVOYW1lPzogc3RyaW5nKTogYW55IHtcbiAgICAgICAgY29uc3QgbmFtZSA9IG5vZGVOYW1lIHx8IG5vZGVEYXRhLm5hbWU/LnZhbHVlIHx8IG5vZGVEYXRhLm5hbWUgfHwgJ05vZGUnO1xuICAgICAgICBjb25zdCBscG9zID0gbm9kZURhdGEucG9zaXRpb24/LnZhbHVlIHx8IG5vZGVEYXRhLmxwb3M/LnZhbHVlIHx8IG5vZGVEYXRhLl9scG9zIHx8IHsgeDogMCwgeTogMCwgejogMCB9O1xuICAgICAgICBjb25zdCByb3REdW1wID0gbm9kZURhdGEucm90YXRpb24/LnZhbHVlIHx8IG5vZGVEYXRhLmxyb3Q/LnZhbHVlIHx8IG5vZGVEYXRhLl9scm90IHx8IHsgeDogMCwgeTogMCwgejogMCwgdzogMSB9O1xuICAgICAgICAvLyBgcXVlcnktbm9kZWAgcmVwb3J0cyByb3RhdGlvbiBhcyBFVUxFUiBERUdSRUVTIChjYy5WZWMzLCBubyBgd2ApIOKAlCB0aGUgdmFsdWUgdGhlXG4gICAgICAgIC8vIGluc3BlY3RvcidzIFJvdGF0aW9uIGZpZWxkIHNob3dzLiBgX2xyb3RgIGlzIGEgcXVhdGVybmlvbiwgc28gcGFzc2luZyB0aGUgZHVtcFxuICAgICAgICAvLyBzdHJhaWdodCB0aHJvdWdoIHN0b3JlZCBhIGRlZ3JlZSBpbiBhIHF1YXRlcm5pb24gY29tcG9uZW50OiBhIC0wLjEgZGVncmVlIHRpbHQgd2FzXG4gICAgICAgIC8vIHdyaXR0ZW4gYXMge3o6IC0wLjEsIHc6IDF9LCB3aGljaCB0aGUgZW5naW5lIHJlYWRzIGJhY2sgYXMgcm91Z2hseSAtMTEuNDYgZGVncmVlcy5cbiAgICAgICAgY29uc3QgaXNRdWF0ID0gcm90RHVtcC53ICE9PSB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IGxyb3QgPSBpc1F1YXQgPyByb3REdW1wIDogUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLmV1bGVyRGVncmVlc1RvUXVhdChyb3REdW1wKTtcbiAgICAgICAgY29uc3QgZXVsZXIgPSBpc1F1YXQgPyB7IHg6IDAsIHk6IDAsIHo6IDAgfSA6IHJvdER1bXA7XG4gICAgICAgIGNvbnN0IGxzY2FsZSA9IG5vZGVEYXRhLnNjYWxlPy52YWx1ZSB8fCBub2RlRGF0YS5sc2NhbGU/LnZhbHVlIHx8IG5vZGVEYXRhLl9sc2NhbGUgfHwgeyB4OiAxLCB5OiAxLCB6OiAxIH07XG4gICAgICAgIGNvbnN0IGxheWVyRHVtcCA9IG5vZGVEYXRhLmxheWVyPy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gbm9kZURhdGEubGF5ZXIudmFsdWUgOiBub2RlRGF0YS5sYXllcjtcbiAgICAgICAgY29uc3QgbGF5ZXIgPSB0eXBlb2YgbGF5ZXJEdW1wID09PSAnbnVtYmVyJyA/IGxheWVyRHVtcCA6IFByZWZhYkNyZWF0aW9uU2VydmljZS5ERUZBVUxUX0xBWUVSO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLk5vZGVcIiwgXCJfbmFtZVwiOiBuYW1lLCBcIl9vYmpGbGFnc1wiOiAwLCBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICBcIl9wYXJlbnRcIjogcGFyZW50Tm9kZUluZGV4ICE9PSBudWxsID8geyBcIl9faWRfX1wiOiBwYXJlbnROb2RlSW5kZXggfSA6IG51bGwsXG4gICAgICAgICAgICBcIl9jaGlsZHJlblwiOiBbXSwgXCJfYWN0aXZlXCI6IG5vZGVEYXRhLmFjdGl2ZSAhPT0gZmFsc2UsIFwiX2NvbXBvbmVudHNcIjogW10sIFwiX3ByZWZhYlwiOiBudWxsLFxuICAgICAgICAgICAgXCJfbHBvc1wiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBscG9zLnggfHwgMCwgXCJ5XCI6IGxwb3MueSB8fCAwLCBcInpcIjogbHBvcy56IHx8IDAgfSxcbiAgICAgICAgICAgIFwiX2xyb3RcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuUXVhdFwiLCBcInhcIjogbHJvdC54IHx8IDAsIFwieVwiOiBscm90LnkgfHwgMCwgXCJ6XCI6IGxyb3QueiB8fCAwLCBcIndcIjogbHJvdC53ICE9PSB1bmRlZmluZWQgPyBscm90LncgOiAxIH0sXG4gICAgICAgICAgICBcIl9sc2NhbGVcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogbHNjYWxlLnggIT09IHVuZGVmaW5lZCA/IGxzY2FsZS54IDogMSwgXCJ5XCI6IGxzY2FsZS55ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueSA6IDEsIFwielwiOiBsc2NhbGUueiAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnogOiAxIH0sXG4gICAgICAgICAgICBcIl9tb2JpbGl0eVwiOiAwLCBcIl9sYXllclwiOiBsYXllcixcbiAgICAgICAgICAgIFwiX2V1bGVyXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGV1bGVyLnggfHwgMCwgXCJ5XCI6IGV1bGVyLnkgfHwgMCwgXCJ6XCI6IGV1bGVyLnogfHwgMCB9LCBcIl9pZFwiOiBcIlwiXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2VyaWFsaXplIG9uZSBjb21wb25lbnQuXG4gICAgICpcbiAgICAgKiBUaGUgY2FwdHVyZWQgZHVtcCBpcyB0aGUgc291cmNlIG9mIHRydXRoIGZvciBldmVyeSBjb21wb25lbnQgdHlwZS4gVGhlIHBlci10eXBlXG4gICAgICogdGFibGVzIGJlbG93IG9ubHkgZmlsbCBpbiBrZXlzIHRoZSBkdW1wIGRpZCBub3QgY2Fycnkg4oCUIHRoZXkgdXNlZCB0byBydW4gKmluc3RlYWQqXG4gICAgICogb2YgdGhlIGR1bXAsIHdoaWNoIHNpbGVudGx5IHdyb3RlIGVuZ2luZSBkZWZhdWx0cyBmb3IgYGNjLlVJVHJhbnNmb3JtYCxcbiAgICAgKiBgY2MuU3ByaXRlYCwgYGNjLkJ1dHRvbmAgYW5kIGBjYy5MYWJlbGAsIGFuZCB3cm90ZSBub3RoaW5nIGF0IGFsbCBmb3IgZXZlcnkgb3RoZXJcbiAgICAgKiB0eXBlICgjMjgpLlxuICAgICAqL1xuICAgIHByaXZhdGUgY3JlYXRlQ29tcG9uZW50T2JqZWN0KGNvbXBvbmVudERhdGE6IGFueSwgbm9kZUluZGV4OiBudW1iZXIsIGNvbnRleHQ/OiBhbnkpOiBhbnkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gY29tcG9uZW50RGF0YS50eXBlIHx8IGNvbXBvbmVudERhdGEuX190eXBlX18gfHwgJ2NjLkNvbXBvbmVudCc7XG4gICAgICAgIGNvbnN0IGVuYWJsZWQgPSBjb21wb25lbnREYXRhLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXBvbmVudERhdGEuZW5hYmxlZCA6IHRydWU7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudDogYW55ID0ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBjb21wb25lbnRUeXBlLCBcIl9uYW1lXCI6IFwiXCIsIFwiX29iakZsYWdzXCI6IDAsIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgIFwibm9kZVwiOiB7IFwiX19pZF9fXCI6IG5vZGVJbmRleCB9LCBcIl9lbmFibGVkXCI6IGVuYWJsZWQsIFwiX19wcmVmYWJcIjogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBjb21wb25lbnREYXRhLnByb3BlcnRpZXMgfHwge307XG4gICAgICAgIGNvbnN0IHJlbmFtZXMgPSBEVU1QX0tFWV9SRU5BTUVTW2NvbXBvbmVudFR5cGVdIHx8IHt9O1xuXG4gICAgICAgIC8vIERyb3AgZXZlcnkgYWNjZXNzb3Iga2V5IHRoYXQgaGFzIGl0cyBzZXJpYWxpemVkIHR3aW4gcmlnaHQgdGhlcmUgaW4gdGhlIHNhbWUgZHVtcFxuICAgICAgICAvLyAoIzExNCBkZWZlY3QgMikuIFRoZSB1bmRlcnNjb3JlIHNwZWxsaW5nIGlzIHRoZSBvbmUgdGhlIGVuZ2luZSByZWFkcyBiYWNrOyBrZWVwaW5nXG4gICAgICAgIC8vIGJvdGggaXMgd2hhdCBtYWRlIHRoZSBpbXBvcnRlciByZWplY3QgdGhlIGZpbGUuIENvbXB1dGVkIG9uY2UsIHVwIGZyb250LCBzbyB0aGVcbiAgICAgICAgLy8gcmVuYW1lLXRhYmxlIGJyYW5jaGVzIGJlbG93IGNhbm5vdCByZWludHJvZHVjZSBhIGtleSB0aGlzIHJlbW92ZWQuXG4gICAgICAgIGNvbnN0IGFjY2Vzc29yVHdpbnMgPSBuZXcgU2V0KGZpbmRBY2Nlc3NvclR3aW5LZXlzKGNvbXBvbmVudFR5cGUsIHByb3BlcnRpZXMpKTtcblxuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhwcm9wZXJ0aWVzKSkge1xuICAgICAgICAgICAgaWYgKERVTVBfS0VZU19OT1RfU0VSSUFMSVpFRC5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoYWNjZXNzb3JUd2lucy5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBwcm9wVmFsdWUgPSB0aGlzLnByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eSh2YWx1ZSwgY29udGV4dCwgYCR7cmVuYW1lc1trZXldIHx8IGtleX1gKTtcbiAgICAgICAgICAgIGlmIChwcm9wVmFsdWUgIT09IHVuZGVmaW5lZCkgY29tcG9uZW50W3JlbmFtZXNba2V5XSB8fCBrZXldID0gcHJvcFZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBmYWxsYmFja10gb2YgT2JqZWN0LmVudHJpZXMoQ09NUE9ORU5UX0RFRkFVTFRTW2NvbXBvbmVudFR5cGVdIHx8IHt9KSkge1xuICAgICAgICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29tcG9uZW50LCBrZXkpKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50W2tleV0gPSB0eXBlb2YgZmFsbGJhY2sgPT09ICdvYmplY3QnICYmIGZhbGxiYWNrICE9PSBudWxsID8gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShmYWxsYmFjaykpIDogZmFsbGJhY2s7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQSBidXR0b24gd2l0aCBubyBjYXB0dXJlZCB0YXJnZXQgcG9pbnRzIGF0IGl0cyBvd24gbm9kZSwgbWF0Y2hpbmcgZWRpdG9yIGJlaGF2aW91ci5cbiAgICAgICAgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5CdXR0b24nICYmIGNvbXBvbmVudC5fdGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudC5fdGFyZ2V0ID0geyBcIl9faWRfX1wiOiBub2RlSW5kZXggfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVuc3VyZSBfaWQgaXMgbGFzdCAobWF0Y2hlcyBlbmdpbmUgc2VyaWFsaXphdGlvbiBvcmRlcilcbiAgICAgICAgY29uc3QgX2lkID0gY29tcG9uZW50Ll9pZCB8fCBcIlwiO1xuICAgICAgICBkZWxldGUgY29tcG9uZW50Ll9pZDtcbiAgICAgICAgY29tcG9uZW50Ll9pZCA9IF9pZDtcbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb3VudCB0aGUgZHVtcCBlbnRyaWVzIHRoYXQgd291bGQgYWN0dWFsbHkgYmUgc2VyaWFsaXplZCwgc28gdGhlIHBvc3Qtd3JpdGUgY2hlY2tcbiAgICAgKiBvbmx5IGRlbWFuZHMgcHJvcGVydGllcyBmb3IgY29tcG9uZW50cyB0aGF0IGhhZCBzb21lLlxuICAgICAqL1xuICAgIHByaXZhdGUgY291bnRTZXJpYWxpemFibGVQcm9wcyhwcm9wZXJ0aWVzOiBhbnkpOiBudW1iZXIge1xuICAgICAgICBpZiAoIXByb3BlcnRpZXMgfHwgdHlwZW9mIHByb3BlcnRpZXMgIT09ICdvYmplY3QnKSByZXR1cm4gMDtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZpbHRlcihrID0+ICFEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQuaGFzKGspKS5sZW5ndGg7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVwb3J0IGNvbXBvbmVudCB0eXBlcyB0aGF0IGNhcnJpZWQgbGl2ZSBwcm9wZXJ0aWVzIGluIHRoZSBzY2VuZSBidXQgc2VyaWFsaXplZCB0b1xuICAgICAqIG5vdGhpbmcgYnV0IHRoZSBiYXNlIGVudmVsb3BlLiBgYWN0aW9uPWNyZWF0ZWAgcHJldmlvdXNseSByZXBvcnRlZCBzdWNjZXNzIGluXG4gICAgICogZXhhY3RseSB0aGF0IHN0YXRlICgjMjgpLlxuICAgICAqL1xuICAgIHByaXZhdGUgZmluZENvbXBvbmVudHNUaGF0TG9zdFByb3BlcnRpZXMocHJlZmFiRGF0YTogYW55W10sIG5vZGVEYXRhOiBhbnkpOiBzdHJpbmdbXSB7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY29tcCBvZiAobm9kZS5jb21wb25lbnRzIHx8IFtdKSkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmNvdW50U2VyaWFsaXphYmxlUHJvcHMoY29tcD8ucHJvcGVydGllcykgPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkLmFkZChjb21wLnR5cGUgfHwgY29tcC5fX3R5cGVfXyB8fCAnVW5rbm93bicpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgKG5vZGUuY2hpbGRyZW4gfHwgW10pKSB3YWxrKGNoaWxkKTtcbiAgICAgICAgfTtcbiAgICAgICAgd2Fsayhub2RlRGF0YSk7XG4gICAgICAgIGlmIChleHBlY3RlZC5zaXplID09PSAwKSByZXR1cm4gW107XG5cbiAgICAgICAgY29uc3QgcG9wdWxhdGVkID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcHJlZmFiRGF0YSkge1xuICAgICAgICAgICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkgIT09ICdvYmplY3QnIHx8ICFleHBlY3RlZC5oYXMoZW50cnkuX190eXBlX18pKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhlbnRyeSkuc29tZShrZXkgPT4gIUJBU0VfQ09NUE9ORU5UX0tFWVMuaGFzKGtleSkpKSBwb3B1bGF0ZWQuYWRkKGVudHJ5Ll9fdHlwZV9fKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gWy4uLmV4cGVjdGVkXS5maWx0ZXIodHlwZSA9PiAhcG9wdWxhdGVkLmhhcyh0eXBlKSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQWNjZXNzb3IgdHdpbnMgdGhlIENBUFRVUkVEIHNjZW5lIGR1bXAgY2FycmllZCB0aGF0IHN1cnZpdmVkIGludG8gdGhlIGVtaXR0ZWQgcHJlZmFiLlxuICAgICAqXG4gICAgICogVGhpcyBpcyB0aGUgcmVhbCAjMTE0LWRlZmVjdC0yIGludmFyaWFudCwgYW5kIGl0IGlzIGRlbGliZXJhdGVseSBhIERJRkZFUkVOQ0UgY2hlY2tcbiAgICAgKiByYXRoZXIgdGhhbiBhIHJlLXJ1biBvZiB0aGUgZW1pc3Npb24gZmlsdGVyJ3Mgb3duIHByZWRpY2F0ZS4gQXNraW5nXG4gICAgICogYGZpbmRBY2Nlc3NvclR3aW5LZXlzYCBhYm91dCBgcHJlZmFiQ29udGVudGAgd291bGQgcmUtYXNrIHRoZSBxdWVzdGlvbiB0aGUgZmlsdGVyIGp1c3RcbiAgICAgKiBhbnN3ZXJlZCBhbmQgc28gY291bGQgbmV2ZXIgZmFpbCAoc2VlIHRoZSBjYWxsIHNpdGUg4oCUIG5ldXRlcmluZyB0aGF0IGJyYW5jaCBsZWF2ZXNcbiAgICAgKiBldmVyeSB0ZXN0IGdyZWVuKTsgY29tcGFyaW5nIGNhcHR1cmUgYWdhaW5zdCBvdXRwdXQgZmFpbHMgd2hlbmV2ZXIgdGhlIGZpbHRlciBpc1xuICAgICAqIHJlbW92ZWQsIG1pcy1zY29wZWQsIG9yIHRoZSBkdW1wIHNoYXBlIGNoYW5nZXMgdW5kZXIgaXQuXG4gICAgICpcbiAgICAgKiBQZXItbm9kZSBjb21wb25lbnQgY291bnRzIGFyZSBjb21wYXJlZCBwb3NpdGlvbmFsbHkgaW5zdGVhZCBvZiBieSB1dWlkLCBiZWNhdXNlIGEgbm9kZVxuICAgICAqIGNhbiBob2xkIHNldmVyYWwgY29tcG9uZW50cyBvZiB0aGUgc2FtZSB0eXBlIHdpdGggbm8gdXVpZCBkaXN0aW5ndWlzaGFibGUgYXQgdGhpc1xuICAgICAqIGxldmVsLiBUaGUgY291bnRzIGNvbWUgZnJvbSB0aGUgc2FtZSB3YWxrcyB0aGUgc2VyaWFsaXplciB1c2VzIChgY29tcG9uZW50c2AgYW5kXG4gICAgICogYHByb3BlcnRpZXNgKSwgc28gdGhleSBhbHdheXMgYWdyZWUgd2l0aCB3aGF0IGBjcmVhdGVDb21wb25lbnRPYmplY3RgIHNhdzsgb25seSB0aGVcbiAgICAgKiBzaGFwZS1kZXBlbmRlbnQgZGV0YWlscyBkaWZmZXIsIGFuZCB0aG9zZSBhcmUgaWdub3JlZCByYXRoZXIgdGhhbiBndWVzc2VkIGF0LlxuICAgICAqXG4gICAgICogUHVyZSBhbmQgZXhwb3J0ZWQgc28gYm90aCBkaXJlY3Rpb25zIGFyZSB1bml0LXRlc3RhYmxlOiBpdCBtdXN0IGZpcmUgd2hlbiBhbiBhY2Nlc3NvclxuICAgICAqIGtleSBpcyB3cml0dGVuIGJlc2lkZSBpdHMgdHdpbiwgYW5kIHN0YXkgc2lsZW50IG9uIHRoZSByZXBhaXJlZCBzaGFwZS5cbiAgICAgKi9cbiAgICBmaW5kQ2FwdHVyZWRBY2Nlc3NvclR3aW5zKG5vZGVEYXRhOiBhbnksIHByZWZhYkRhdGE6IGFueVtdKTogQXJyYXk8eyB0eXBlOiBzdHJpbmc7IGtleXM6IHN0cmluZ1tdIH0+IHtcbiAgICAgICAgY29uc3QgY2FwdHVyZWQ6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiA9IFtdO1xuICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXAgb2YgKG5vZGUuY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gY29tcD8udHlwZSB8fCBjb21wPy5fX3R5cGVfXyB8fCAnVW5rbm93bic7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvcGVydGllcyA9IGNvbXA/LnByb3BlcnRpZXMgfHwge307XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5cyA9IGZpbmRBY2Nlc3NvclR3aW5LZXlzKGNvbXBvbmVudFR5cGUsIHByb3BlcnRpZXMpO1xuICAgICAgICAgICAgICAgIGlmIChrZXlzLmxlbmd0aCA+IDApIGNhcHR1cmVkLnB1c2goeyB0eXBlOiBjb21wb25lbnRUeXBlLCBrZXlzIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiAobm9kZS5jaGlsZHJlbiB8fCBbXSkpIHdhbGsoY2hpbGQpO1xuICAgICAgICB9O1xuICAgICAgICB3YWxrKG5vZGVEYXRhKTtcbiAgICAgICAgaWYgKGNhcHR1cmVkLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gICAgICAgIC8vIFRoZSBwcmVmYWIgZW50cmllcyBmb3Igbm9kZSAwIG9ud2FyZCwgc2tpcHBpbmcgdGhlIGxlYWRpbmcgY2MuUHJlZmFiIGFzc2V0IHJlY29yZFxuICAgICAgICAvLyAoYW5kIGFueSBsZWFkaW5nIG51bGwgc2xvdHMpLCBhcmUgdGhlIHNlcmlhbGl6ZWQgbm9kZXMgaW4gd2FsayBvcmRlci5cbiAgICAgICAgY29uc3Qgbm9kZUVudHJpZXMgPSBwcmVmYWJEYXRhLmZpbHRlcihcbiAgICAgICAgICAgIGVudHJ5ID0+IGVudHJ5ICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcgJiYgZW50cnkuX190eXBlX18gIT09ICdjYy5QcmVmYWInICYmIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpXG4gICAgICAgICk7XG5cbiAgICAgICAgY29uc3Qgc3Vydml2ZWQ6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiA9IFtdO1xuICAgICAgICBsZXQgY3Vyc29yID0gMDtcbiAgICAgICAgY29uc3QgY2hlY2sgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudENvdW50ID0gQXJyYXkuaXNBcnJheShub2RlLmNvbXBvbmVudHMpID8gbm9kZS5jb21wb25lbnRzLmxlbmd0aCA6IDA7XG4gICAgICAgICAgICBjb25zdCBlbnRyeTogYW55ID0gbm9kZUVudHJpZXNbY3Vyc29yKytdO1xuICAgICAgICAgICAgY29uc3QgZW1pdHRlZDogYW55W10gPSAoZW50cnkgJiYgQXJyYXkuaXNBcnJheShlbnRyeS5fY29tcG9uZW50cykpXG4gICAgICAgICAgICAgICAgPyBlbnRyeS5fY29tcG9uZW50cy5tYXAoKHJlZjogYW55KSA9PiBwcmVmYWJEYXRhW3JlZj8uX19pZF9fXSkuZmlsdGVyKEJvb2xlYW4pXG4gICAgICAgICAgICAgICAgOiBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcG9uZW50Q291bnQ7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudFR5cGUgPSBub2RlLmNvbXBvbmVudHNbaV0/LnR5cGUgfHwgbm9kZS5jb21wb25lbnRzW2ldPy5fX3R5cGVfXyB8fCAnVW5rbm93bic7XG4gICAgICAgICAgICAgICAgY29uc3Qga2V5cyA9IGZpbmRBY2Nlc3NvclR3aW5LZXlzKGNvbXBvbmVudFR5cGUsIGVtaXR0ZWRbaV0gJiYgdHlwZW9mIGVtaXR0ZWRbaV0gPT09ICdvYmplY3QnID8gZW1pdHRlZFtpXSA6IHt9KTtcbiAgICAgICAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSBzdXJ2aXZlZC5wdXNoKHsgdHlwZTogY29tcG9uZW50VHlwZSwga2V5cyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgKG5vZGUuY2hpbGRyZW4gfHwgW10pKSBjaGVjayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIGNoZWNrKG5vZGVEYXRhKTtcblxuICAgICAgICAvLyBSZXBvcnQgdGhlIGNhcHR1cmVkIHNldCwgbmFycm93ZWQgdG8gdGhlIHR3aW4gbmFtZXMgYWN0dWFsbHkgb2JzZXJ2ZWQgc3Vydml2aW5nIHNvXG4gICAgICAgIC8vIHRoZSBtZXNzYWdlIG5hbWVzIHRoZSByZWFsIGxlYWsgcmF0aGVyIHRoYW4gcmVzdGF0aW5nIHdoYXQgdGhlIGR1bXAgaGVsZC5cbiAgICAgICAgcmV0dXJuIGNhcHR1cmVkLmZpbHRlcihjYXAgPT5cbiAgICAgICAgICAgIHN1cnZpdmVkLnNvbWUoc3VydiA9PiBzdXJ2LnR5cGUgPT09IGNhcC50eXBlICYmIHN1cnYua2V5cy5zb21lKGsgPT4gY2FwLmtleXMuaW5jbHVkZXMoaykpKVxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKiBSZS1yZWFkIHRoZSB3cml0dGVuIHByZWZhYjsgZmFsbHMgYmFjayB0byB0aGUgaW4tbWVtb3J5IGNvbnRlbnQgd2hlbiB0aGUgcGF0aCBpcyB1bnJlc29sdmFibGUuICovXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkQmFja1ByZWZhYihzYXZlUGF0aDogc3RyaW5nLCBmYWxsYmFjazogYW55W10pOiBQcm9taXNlPHsgZGF0YTogYW55W107IHNvdXJjZTogJ2Rpc2snIHwgJ2luLW1lbW9yeScgfT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlQXNzZXQoc2F2ZVBhdGgpO1xuICAgICAgICAgICAgaWYgKHJlc29sdmVkLmZpbGVQYXRoKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQuZmlsZVBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSByZXR1cm4geyBkYXRhOiBwYXJzZWQsIHNvdXJjZTogJ2Rpc2snIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gZmFsbCB0aHJvdWdoIHRvIHRoZSBpbi1tZW1vcnkgY29udGVudFxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IGRhdGE6IGZhbGxiYWNrLCBzb3VyY2U6ICdpbi1tZW1vcnknIH07XG4gICAgfVxuXG4gICAgLyoqIFR5cGUgbmFtZXMgd2hvc2UgZHVtcCB2YWx1ZSBpcyBhbiBBU1NFVCByZWZlcmVuY2UgcmF0aGVyIHRoYW4gYSBjb21wb25lbnQgcmVmZXJlbmNlLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEFTU0VUX1RZUEVTID0gbmV3IFNldChbXG4gICAgICAgICdjYy5QcmVmYWInLCAnY2MuVGV4dHVyZTJEJywgJ2NjLlNwcml0ZUZyYW1lJywgJ2NjLk1hdGVyaWFsJywgJ2NjLkFuaW1hdGlvbkNsaXAnLFxuICAgICAgICAnY2MuQXVkaW9DbGlwJywgJ2NjLkZvbnQnLCAnY2MuQXNzZXQnLCAnY2MuVFRGRm9udCcsICdjYy5CaXRtYXBGb250JywgJ2NjLkxhYmVsQXRsYXMnLFxuICAgICAgICAnY2MuU3ByaXRlQXRsYXMnLCAnY2MuSnNvbkFzc2V0JywgJ2NjLlRleHRBc3NldCcsICdjYy5QYXJ0aWNsZUFzc2V0JywgJ2NjLk1lc2gnLFxuICAgICAgICAnY2MuU2tlbGV0b24nLCAnY2MuUmVuZGVyVGV4dHVyZScsICdjYy5QaHlzaWNzTWF0ZXJpYWwnLCAnY2MuU2NlbmVBc3NldCcsICdjYy5FZmZlY3RBc3NldCcsXG4gICAgXSk7XG5cbiAgICAvKipcbiAgICAgKiBBbiBhc3NldCBpcyBlaXRoZXIgZXhwbGljaXRseSBsaXN0ZWQgb3IgbmFtZWQgYnkgYSBzdWZmaXggbm8gY29tcG9uZW50IHR5cGUgdXNlcy5cbiAgICAgKiBUaGUgc3VmZml4IGFybSBpcyB3aGF0IGtlZXBzIGEgZnV0dXJlIGNvbmNyZXRlIGFzc2V0IHN1YmNsYXNzIGZyb20gc2lsZW50bHkgcmVncmVzc2luZ1xuICAgICAqIGludG8gdGhlIGNvbXBvbmVudC1yZWZlcmVuY2UgYnJhbmNoIHRoZSB3YXkgY2MuVFRGRm9udCBkaWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgaXNBc3NldFR5cGUodHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdHlwZSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkFTU0VUX1RZUEVTLmhhcyh0eXBlKSkgcmV0dXJuIHRydWU7XG4gICAgICAgIHJldHVybiAvKD86Rm9udHxBc3NldHxBdGxhc3xDbGlwKSQvLnRlc3QodHlwZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUHJvY2VzcyBjb21wb25lbnQgcHJvcGVydHkgdmFsdWVzLCBlbnN1cmluZyBmb3JtYXQgbWF0Y2hlcyBtYW51YWxseS1jcmVhdGVkIHByZWZhYnMuXG4gICAgICogSGFuZGxlcyBub2RlIHJlZnMsIGFzc2V0IHJlZnMsIGNvbXBvbmVudCByZWZzLCB0eXBlZCBtYXRoL2NvbG9yIG9iamVjdHMsIGFuZCBhcnJheXMuXG4gICAgICpcbiAgICAgKiBUaHJvd3Mgb24gYSByZWZlcmVuY2UgaXQgY2Fubm90IHNlcmlhbGl6ZSBmYWl0aGZ1bGx5LiBFdmVyeSBicmFuY2ggYmVsb3cgdXNlZCB0b1xuICAgICAqIGFuc3dlciBhbiB1bnJlc29sdmFibGUgcmVmZXJlbmNlIHdpdGggYG51bGxgIChvciBkcm9wIGl0IGZyb20gYW4gYXJyYXkpLCB3aGljaCBpcyBob3dcbiAgICAgKiBhIGNyZWF0ZWQgcHJlZmFiIGNhbWUgb3V0IGhvbGxvdyB3aGlsZSBgYWN0aW9uPWNyZWF0ZWAgcmVwb3J0ZWQgc3VjY2VzcyDigJQgaXNzdWUgIzczJ3NcbiAgICAgKiBgX21lc2g6IG51bGxgLCBgX21hdGVyaWFsczogW11gIGFuZCBgbGFiZWxQZXJjZW50OiBudWxsYCwgZWFjaCBvZiB3aGljaCBoYWQgYmVlblxuICAgICAqIHdyaXR0ZW4gdG8gdGhlIGxpdmUgc2NlbmUgbW9tZW50cyBlYXJsaWVyLiBBIHJlZmVyZW5jZSB0aGF0IGNhbm5vdCBiZSBzZXJpYWxpemVkIGlzIGFcbiAgICAgKiBmYWlsdXJlIG9mIHRoaXMgY2FsbCwgbm90IGEgdmFsdWUgb2YgYG51bGxgOiBzZWVcbiAgICAgKiBgfi8uY2xhdWRlL3J1bGVzL2RldmVsb3BtZW50LXByaW5jaXBsZXMubWRgIMKnIFwiRXJyb3JzIE92ZXIgU2lsZW50IEZhbGxiYWNrc1wiLlxuICAgICAqL1xuICAgIHByaXZhdGUgcHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KHByb3BEYXRhOiBhbnksIGNvbnRleHQ/OiB7XG4gICAgICAgIG5vZGVVdWlkVG9JbmRleD86IE1hcDxzdHJpbmcsIG51bWJlcj47XG4gICAgICAgIGNvbXBvbmVudFV1aWRUb0luZGV4PzogTWFwPHN0cmluZywgbnVtYmVyPjtcbiAgICAgICAgbG9zc2VzPzogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+O1xuICAgIH0sIHByb3BlcnR5UGF0aCA9ICcnKTogYW55IHtcbiAgICAgICAgaWYgKCFwcm9wRGF0YSB8fCB0eXBlb2YgcHJvcERhdGEgIT09ICdvYmplY3QnKSByZXR1cm4gcHJvcERhdGE7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gcHJvcERhdGEudmFsdWU7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBwcm9wRGF0YS50eXBlO1xuICAgICAgICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIC8vIEFuIGV4cGxpY2l0IGVtcHR5LXV1aWQgcmVmZXJlbmNlIGlzIGEgZ2VudWluZSBDTEVBUiAoaXNzdWUgIzc1KSwgbm90IGEgbG9zcy5cbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUudXVpZCA9PT0gJycpIHJldHVybiBudWxsO1xuXG4gICAgICAgIC8vIE5vZGUgcmVmZXJlbmNlc1xuICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLk5vZGUnICYmIHZhbHVlPy51dWlkKSB7XG4gICAgICAgICAgICBpZiAoY29udGV4dD8ubm9kZVV1aWRUb0luZGV4Py5oYXModmFsdWUudXVpZCkpIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQubm9kZVV1aWRUb0luZGV4LmdldCh2YWx1ZS51dWlkKSB9O1xuICAgICAgICAgICAgLy8gQSBub2RlIG91dHNpZGUgdGhlIHN1YnRyZWUgYmVpbmcgc2VyaWFsaXplZCBjYW5ub3QgYmUgZW5jb2RlZCBpbiBhIHByZWZhYiDigJRcbiAgICAgICAgICAgIC8vIHRoZSBmb3JtYXQgaGFzIG5vIGNyb3NzLWZpbGUgbm9kZSByZWZlcmVuY2UuIFRoaXMgb25lIGdlbnVpbmVseSBtdXN0IGJlXG4gICAgICAgICAgICAvLyBkcm9wcGVkLCBidXQgaXQgaXMgc3RpbGwgYSBkYXRhIGxvc3MgYW5kIGlzIHJlY29yZGVkIGFzIHN1Y2guXG4gICAgICAgICAgICB0aGlzLnJlY29yZExvc3MoY29udGV4dCwgcHJvcGVydHlQYXRoLCB2YWx1ZS51dWlkLCAnbm9kZSBpcyBvdXRzaWRlIHRoZSBwcmVmYWIgc3VidHJlZSBiZWluZyBzZXJpYWxpemVkJyk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEFzc2V0IHJlZmVyZW5jZXMuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFRoaXMgYnJhbmNoIGlzIHRoZSBERUZBVUxUIGZvciBhbnkgcmVmZXJlbmNlIGNhcnJ5aW5nIGEgdXVpZCwgYmVjYXVzZSB0aGUgdGVzdHNcbiAgICAgICAgLy8gYmVsb3cgY2Fubm90IGJvdGggYmUgc2F0aXNmaWVkOiBgY2MuTGFiZWxgJ3MgYGZvbnRgIGlzIGEgYGNjLlRURkZvbnRgIEFTU0VUXG4gICAgICAgIC8vICh0aGlzIHRlc3QgZmlsZSdzIG93biBmb250IHJlZ3Jlc3Npb24pLCB3aGlsZSBgY2MuTGFiZWxgIGlzIGFsc28gYSBsZWdpdGltYXRlXG4gICAgICAgIC8vIEBwcm9wZXJ0eSBDT01QT05FTlQgdHlwZS4gUmVhZGluZyB0aGUgdmFsdWUncyB1dWlkIGFzIGFuIGFzc2V0IGlzIHdoYXQgbWFrZXMgdGhlXG4gICAgICAgIC8vIGZvbnQgY2FzZSBjb3JyZWN0OyBldmVyeSBjb25jcmV0ZSBhc3NldCBjbGFzcyBpcyBjYXVnaHQgYmVsb3cgYnkgbmFtZSBvciBzdWZmaXguXG4gICAgICAgIC8vXG4gICAgICAgIC8vIEFzc2V0LWZpcnN0IHdhcyBwcmV2aW91c2x5IGJ5cGFzc2VkIGJ5IGRpc3BhdGNoaW5nIG9uIGBpc0Fzc2V0VHlwZSh0eXBlKWAgRklSU1QsXG4gICAgICAgIC8vIGxldHRpbmcgdGhlIGNvbXBvbmVudCBicmFuY2gncyBgdHlwZS5zdGFydHNXaXRoKCdjYy4nKWAgY2F0Y2gtYWxsIGNsYWltIGFueSB0eXBlXG4gICAgICAgIC8vIHRoZSBhbGxvd2xpc3QgaGFkIG5vdCBiZWVuIHRhdWdodCDigJQgdGhlIGV4YWN0IG1lY2hhbmlzbSBieSB3aGljaCBgY2MuTWVzaGAgYW5kXG4gICAgICAgIC8vIGBjYy5Ta2VsZXRvbmAgYmVjYW1lIG51bGwgZW50cmllcyBpbiBhIGNyZWF0ZWQgcHJlZmFiIChpc3N1ZXMgIzY0LCAjNzAsICM3MykuXG4gICAgICAgIGlmICh2YWx1ZT8udXVpZCkge1xuICAgICAgICAgICAgaWYgKFByZWZhYkNyZWF0aW9uU2VydmljZS5pc0Fzc2V0VHlwZSh0eXBlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IFwiX191dWlkX19cIjogdmFsdWUudXVpZCwgXCJfX2V4cGVjdGVkVHlwZV9fXCI6IHR5cGUgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEluLXRyZWUgY29tcG9uZW50IHJlZmVyZW5jZTogdGhlIHV1aWQgbmFtZXMgYSBjb21wb25lbnQgaW4gdGhlIHN1YnRyZWUgYmVpbmdcbiAgICAgICAgICAgIC8vIHNlcmlhbGl6ZWQsIHNvIGl0IGVuY29kZXMgYXMgYW4gb2JqZWN0IGluZGV4LlxuICAgICAgICAgICAgaWYgKGNvbnRleHQ/LmNvbXBvbmVudFV1aWRUb0luZGV4Py5oYXModmFsdWUudXVpZCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBcIl9faWRfX1wiOiBjb250ZXh0LmNvbXBvbmVudFV1aWRUb0luZGV4LmdldCh2YWx1ZS51dWlkKSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVW5yZXNvbHZlZC4gQSBwcmVmYWIgYXNzZXQgaGFzIG5vIHdheSB0byBleHByZXNzIGEgcmVmZXJlbmNlIHRvIHNvbWV0aGluZ1xuICAgICAgICAgICAgLy8gb3V0c2lkZSB0aGUgc3VidHJlZSwgc28gbnVsbCBpcyB0aGUgb25seSBlbmNvZGFibGUgYW5zd2VyIOKAlCBidXQgdGhlIG51bGwgaXNcbiAgICAgICAgICAgIC8vIG5vdyBSRUNPUkRFRCwgYW5kIHRoZSBjcmVhdGUgcGF0aHMgcmVmdXNlIHRvIHdyaXRlIHdoZW4gYW55dGhpbmcgd2FzIHJlY29yZGVkLlxuICAgICAgICAgICAgLy8gYG51bGxgIGluIHNpbGVuY2UgaXMgaXNzdWUgIzczJ3MgcHJpbWFyeSBzeW1wdG9tIChgX21lc2g6IG51bGxgLFxuICAgICAgICAgICAgLy8gYF9tYXRlcmlhbHM6IFtdYCwgYGxhYmVsUGVyY2VudDogbnVsbGAgb24gYSBjcmVhdGVkIHByZWZhYiwgd2l0aFxuICAgICAgICAgICAgLy8gYHN1Y2Nlc3M6IHRydWVgIGFuZCBgdmFsaWRhdGVgIGdyZWVuKTsgYSByZXBvcnRlZCBsb3NzIHRoYXQgZmFpbHMgdGhlIGNhbGwgaXNcbiAgICAgICAgICAgIC8vIG5vdC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBUd28gY2F1c2VzIHJlYWNoIGhlcmUsIGFuZCB0aGUgbWVzc2FnZSBuYW1lcyBib3RoIGJlY2F1c2UgdGhlIHJlbWVkaWVzIGRpZmZlcjpcbiAgICAgICAgICAgIC8vIGEgcmVmZXJlbmNlIGdlbnVpbmVseSBvdXRzaWRlIHRoZSBzdWJ0cmVlIChsZWdpdGltYXRlIOKAlCBhIGJ1dHRvbiBwb2ludGluZyBhdFxuICAgICAgICAgICAgLy8gYW5vdGhlciBwcmVmYWIpLCBhbmQgYW4gQVNTRVQgY2xhc3MgbWlzc2luZyBmcm9tIEFTU0VUX1RZUEVTLCB3aGljaCBpcyB0aGVcbiAgICAgICAgICAgIC8vIG1lY2hhbmlzbSBiZWhpbmQgaXNzdWVzICM2NC8jNzAvIzczIGFuZCB3YW50cyB0aGUgYWxsb3dsaXN0IGV4dGVuZGVkLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIERlbGliZXJhdGVseSBOT1QgYSB0aHJvdzogYHByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eWAgcnVucyBpbnNpZGVcbiAgICAgICAgICAgIC8vIGBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnRgLCB3aG9zZSBjb250cmFjdCBpcyB0byBSRVRVUk4gdGhlIHByZWZhYiBKU09OLCBhbmRcbiAgICAgICAgICAgIC8vIHRocm93aW5nIGhlcmUgd291bGQgYWxzbyBjYXRjaCBzY3JpcHQgY29tcG9uZW50IHJlZmVyZW5jZXMgKGBCdWNrZXRTY3JpcHRgIGlzXG4gICAgICAgICAgICAvLyBub3QgYSBgY2MuYCBjbGFzcyksIHdoaWNoIGFyZSBhIGxlZ2l0aW1hdGUgZXh0ZXJuYWwgcmVmZXJlbmNlIOKAlCB0dXJuaW5nIGFcbiAgICAgICAgICAgIC8vIHN1cHBvcnRlZCBudWxsIGludG8gYSBmYWlsdXJlLiBUaGUgbG9zcyBsaXN0IGlzIHRoZSBjaGFubmVsIHRoYXQgZGlzdGluZ3Vpc2hlc1xuICAgICAgICAgICAgLy8gdGhlbSBieSBjYWxsIHNpdGUgcmF0aGVyIHRoYW4gYnkgZ3Vlc3NpbmcgZnJvbSB0aGUgdHlwZSBuYW1lLlxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBSZWZlcmVuY2UgJHt0eXBlfSBVVUlEICR7dmFsdWUudXVpZH0gaGFzIG5vIGVuY29kYWJsZSBmb3JtIGluIGEgcHJlZmFiIChwcm9wZXJ0eSAnJHtwcm9wZXJ0eVBhdGggfHwgJyh1bmtub3duKSd9JylgKTtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkTG9zcyhcbiAgICAgICAgICAgICAgICBjb250ZXh0LCBwcm9wZXJ0eVBhdGgsIHZhbHVlLnV1aWQsXG4gICAgICAgICAgICAgICAgYHR5cGUgJyR7dHlwZX0nIGhhcyBubyBlbmNvZGFibGUgZm9ybSDigJQgZWl0aGVyIGl0IGlzIG91dHNpZGUgdGhlIHByZWZhYiBzdWJ0cmVlIChsZWdpdGltYXRlIGZvciBhIGNvbXBvbmVudCByZWZlcmVuY2UpIGAgK1xuICAgICAgICAgICAgICAgIGBvciBpdCBpcyBhbiBhc3NldCBjbGFzcyBtaXNzaW5nIGZyb20gUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkFTU0VUX1RZUEVTIChpc3N1ZXMgIzY0LyM3MC8jNzMpYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHlwZWQgbWF0aC9jb2xvciBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLkNvbG9yJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5yKSB8fCAwKSksIFwiZ1wiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5nKSB8fCAwKSksIFwiYlwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5iKSB8fCAwKSksIFwiYVwiOiB2YWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5hKSkpIDogMjU1IH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzMnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCwgXCJ6XCI6IE51bWJlcih2YWx1ZS56KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzInKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5TaXplJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlNpemVcIiwgXCJ3aWR0aFwiOiBOdW1iZXIodmFsdWUud2lkdGgpIHx8IDAsIFwiaGVpZ2h0XCI6IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuUXVhdCcpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwLCBcInpcIjogTnVtYmVyKHZhbHVlLnopIHx8IDAsIFwid1wiOiB2YWx1ZS53ICE9PSB1bmRlZmluZWQgPyBOdW1iZXIodmFsdWUudykgOiAxIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheSBwcm9wZXJ0aWVzLlxuICAgICAgICAvLyBFYWNoIGVsZW1lbnQgb2YgYW4gYXJyYXktdHlwZWQgZHVtcCAoZS5nLiBjYy5NZXNoUmVuZGVyZXIncyBzaGFyZWRNYXRlcmlhbHMvXG4gICAgICAgIC8vIF9tYXRlcmlhbHMpIGlzIGl0c2VsZiBhIG5lc3RlZCBwcm9wZXJ0eSBkZXNjcmlwdG9yIOKAlCB7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSwgLi4uIH1cbiAgICAgICAgLy8g4oCUIG5vdCBhIGZsYXQgeyB1dWlkIH0uIFJlYWRpbmcgaXRlbS51dWlkIGRpcmVjdGx5IG1hdGNoZWQgbm90aGluZyBmb3IgZXZlcnkgZWxlbWVudCxcbiAgICAgICAgLy8gc28gYSBNZXNoUmVuZGVyZXIncyBhc3NpZ25lZCBtYXRlcmlhbCBzaWxlbnRseSBzZXJpYWxpemVkIGFzIGFuIGVtcHR5IGFycmF5IHdoaWxlXG4gICAgICAgIC8vIHJlcG9ydGluZyBzdWNjZXNzICh2ZXJpZmllZCBsaXZlIGFnYWluc3QgYSBzbWFydC1pbXBvcnRlZCBGQlggbWF0ZXJpYWwpLlxuICAgICAgICAvL1xuICAgICAgICAvLyBFbGVtZW50cyBhcmUgc2VyaWFsaXplZCB0aHJvdWdoIHRoaXMgc2FtZSBmdW5jdGlvbiByYXRoZXIgdGhhbiBhIGxvY2FsXG4gICAgICAgIC8vIGB7IF9fdXVpZF9fIH1gIHNoYXBlLCBzbyBhIGNvbmNyZXRlLWNsYXNzIGFzc2V0IHR5cGUgcmVhY2hlcyB0aGUgYXNzZXQgYnJhbmNoXG4gICAgICAgIC8vIGluc3RlYWQgb2YgYSBoYXJkY29kZWQgY29uc2VxdWVuY2Ugb2YgYGVsZW1lbnRUeXBlRGF0YWAuIFRoZSBvbGQgc2hhcGUgZGVjbGFyZWRcbiAgICAgICAgLy8gYGVsZW1lbnRUeXBlRGF0YS50eXBlYCBmb3IgZXZlcnkgZWxlbWVudCByZWdhcmRsZXNzIG9mIHdoYXQgdGhlIGVsZW1lbnQgYWN0dWFsbHlcbiAgICAgICAgLy8gcmVmZXJlbmNlZCDigJQgYW5kIGAuZmlsdGVyKEJvb2xlYW4pYCB0dXJuZWQgZWFjaCB1bnJlc29sdmVkIGVsZW1lbnQgaW50byBhIHNpbGVudGx5XG4gICAgICAgIC8vIHNob3J0ZXIgYXJyYXksIHdoaWNoIGlzIGlzc3VlICM3MydzIGBfbWF0ZXJpYWxzOiBbXWAgZXhhY3RseTogYW4gYXJyYXkgcHJvcGVydHlcbiAgICAgICAgLy8gdGhhdCBoYWQgY29udGVudHMgb24gdGhlIGxpdmUgbm9kZSBhbmQgY2FtZSBvdXQgb2YgdGhlIGNyZWF0ZWQgcHJlZmFiIGVtcHR5LCB3aXRoXG4gICAgICAgIC8vIGBzdWNjZXNzOiB0cnVlYCBhbmQgYHZhbGlkYXRlYCByZXBvcnRpbmcgYGlzVmFsaWQ6IHRydWVgIG92ZXIgdGhlIHJlc3VsdC5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50VHlwZSA9IHByb3BEYXRhLmVsZW1lbnRUeXBlRGF0YT8udHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZWQgPSB2YWx1ZS5tYXAoKGl0ZW06IGFueSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1VdWlkID0gaXRlbT8udXVpZCB8fCBpdGVtPy52YWx1ZT8udXVpZDtcbiAgICAgICAgICAgICAgICBpZiAoIWl0ZW1VdWlkICYmIGVsZW1lbnRUeXBlICYmICFlbGVtZW50VHlwZS5zdGFydHNXaXRoKCdjYy4nKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBOb3QgYSByZWZlcmVuY2UgYXJyYXkgYXQgYWxsIOKAlCBhbiBhcnJheSBvZiBwbGFpbiB2YWx1ZXMuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtPy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gaXRlbS52YWx1ZSA6IGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFuIGVsZW1lbnQncyBvd24gYHR5cGVgIGlzIGF1dGhvcml0YXRpdmU7IGBlbGVtZW50VHlwZURhdGFgIGlzIG9ubHkgdGhlXG4gICAgICAgICAgICAgICAgLy8gZGVjbGFyZWQgYXJyYXkgZWxlbWVudCBjbGFzcywgYW5kIGZvciBhIHN1YmNsYXNzIGVsZW1lbnQgKGBjYy5UVEZGb250YFxuICAgICAgICAgICAgICAgIC8vIHVuZGVyIGEgYGNjLkZvbnRbXWAsIGEgbmVzdGVkLWRlc2NyaXB0b3IgbWF0ZXJpYWwpIHRoZSBkZWNsYXJlZCBjbGFzcyBpc1xuICAgICAgICAgICAgICAgIC8vIHRoZSB3cm9uZyB0aGluZyB0byB3cml0ZS5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgIHsgdmFsdWU6IGl0ZW0/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBpdGVtLnZhbHVlIDogaXRlbSwgdHlwZTogaXRlbT8udHlwZSB8fCBlbGVtZW50VHlwZSB9LFxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICBgJHtwcm9wZXJ0eVBhdGh9WyR7aW5kZXh9XWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBBIGRyb3BwZWQgZWxlbWVudCBpcyBhIGxvc3MsIG5vdCBhIHNob3J0ZXIgYXJyYXkuIGBtYXBgIG5ldmVyIHByb2R1Y2VzXG4gICAgICAgICAgICAvLyB1bmRlZmluZWQgaGVyZSwgc28gdGhpcyBvbmx5IGZpcmVzIGlmIGEgZnV0dXJlIGJyYW5jaCBzdGFydHMgcmV0dXJuaW5nIGl0LlxuICAgICAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZWQuZmlsdGVyKChlbnRyeTogYW55KSA9PiBlbnRyeSAhPT0gdW5kZWZpbmVkICYmIGVudHJ5ICE9PSBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5lc3RlZCBDQ0NsYXNzIGdyb3VwOiB0aGUgZHVtcCBuZXN0cyBhbm90aGVyIGRlc2NyaXB0b3IgbWFwIHVuZGVyIGB2YWx1ZWAuXG4gICAgICAgIC8vIFNlcmlhbGl6aW5nIGl0IHZlcmJhdGltIHdvdWxkIHdyaXRlIGVkaXRvciBkZXNjcmlwdG9ycyAoe25hbWUsIHZhbHVlLCB0eXBlfSlcbiAgICAgICAgLy8gaW50byB0aGUgYXNzZXQgaW5zdGVhZCBvZiB0aGUgdmFsdWVzIHRoZW1zZWx2ZXMuXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB0aGlzLmlzTmVzdGVkUHJvcGVydHlNYXAodmFsdWUpKSB7XG4gICAgICAgICAgICBjb25zdCBuZXN0ZWQ6IGFueSA9IHR5cGUgPyB7IFwiX190eXBlX19cIjogdHlwZSB9IDoge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrZXkpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXN0ZWRWYWx1ZSA9IHRoaXMucHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICBlbnRyeSwgY29udGV4dCwgcHJvcGVydHlQYXRoID8gYCR7cHJvcGVydHlQYXRofS4ke2tleX1gIDoga2V5XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAobmVzdGVkVmFsdWUgIT09IHVuZGVmaW5lZCkgbmVzdGVkW2tleV0gPSBuZXN0ZWRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXN0ZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPdGhlciBjb21wbGV4IHR5cGVkIG9iamVjdHNcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdHlwZT8uc3RhcnRzV2l0aCgnY2MuJykpIHJldHVybiB7IFwiX190eXBlX19cIjogdHlwZSwgLi4udmFsdWUgfTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY29yZCBhIHJlZmVyZW5jZSB0aGF0IGNvdWxkIG5vdCBiZSBzZXJpYWxpemVkIGZhaXRoZnVsbHkuXG4gICAgICpcbiAgICAgKiBLZXB0IGFzIGEgbGlzdCByYXRoZXIgdGhhbiBhIHRocm93IGZvciB0aGUgdHdvIGNhc2VzIHdoZXJlIHRoZSBwcmVmYWIgZm9ybWF0IGl0c2VsZlxuICAgICAqIGNhbm5vdCBleHByZXNzIHRoZSB2YWx1ZSAoYSBub2RlL2NvbXBvbmVudCBvdXRzaWRlIHRoZSBzdWJ0cmVlKS4gVGhlIGNyZWF0ZSBwYXRocyB0dXJuXG4gICAgICogYSBub24tZW1wdHkgbGlzdCBpbnRvIGEgYGZhdGFsYCBmYWlsdXJlLCBzbyB0aGUgbG9zcyBpcyBuZXZlciBtZXJlbHkgYSB3YXJuaW5nIGluIGFcbiAgICAgKiBsb2cgbm9ib2R5IHJlYWRzIOKAlCB3aGljaCBpcyBob3cgIzczJ3MgZHJvcHBlZCByZWZlcmVuY2VzIHdlbnQgdW5ub3RpY2VkIHRocm91Z2hcbiAgICAgKiBgY3JlYXRlYCBBTkQgYHZhbGlkYXRlYC5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlY29yZExvc3MoXG4gICAgICAgIGNvbnRleHQ6IHsgbG9zc2VzPzogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+IH0gfCB1bmRlZmluZWQsXG4gICAgICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgICAgIHV1aWQ6IHN0cmluZyxcbiAgICAgICAgcmVhc29uOiBzdHJpbmdcbiAgICApOiB2b2lkIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Py5sb3NzZXMpIHJldHVybjtcbiAgICAgICAgY29udGV4dC5sb3NzZXMucHVzaCh7IHByb3BlcnR5OiBwcm9wZXJ0eSB8fCAnKHVua25vd24pJywgdXVpZCwgcmVhc29uIH0pO1xuICAgIH1cblxuICAgIC8qKiBSZW5kZXIgcmVjb3JkZWQgbG9zc2VzIGFzIHRoZSBmYXRhbCBmYWlsdXJlIG1lc3NhZ2UsIG9yIG51bGwgd2hlbiB0aGVyZSBhcmUgbm9uZS4gKi9cbiAgICBwcml2YXRlIGRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKGxvc3NlczogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmIChsb3NzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgbmFtZWQgPSBsb3NzZXMubWFwKGwgPT4gYCcke2wucHJvcGVydHl9JyAtPiAke2wudXVpZH0gKCR7bC5yZWFzb259KWApO1xuICAgICAgICByZXR1cm4gYCR7bG9zc2VzLmxlbmd0aH0gcmVmZXJlbmNlKHMpIGNvdWxkIG5vdCBiZSBzZXJpYWxpemVkOiAke25hbWVkLmpvaW4oJzsgJyl9LmA7XG4gICAgfVxuXG4gICAgLyoqIFRydWUgd2hlbiBldmVyeSBlbnRyeSBpcyBhbiBvYmplY3QgYW5kIGF0IGxlYXN0IG9uZSBpcyBhIENvY29zIHByb3BlcnR5IGRlc2NyaXB0b3IuICovXG4gICAgcHJpdmF0ZSBpc05lc3RlZFByb3BlcnR5TWFwKHZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyh2YWx1ZSk7XG4gICAgICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gZW50cmllcy5ldmVyeSgoWywgZW50cnldKSA9PiBlbnRyeSAhPT0gbnVsbCAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKVxuICAgICAgICAgICAgJiYgZW50cmllcy5zb21lKChbLCBlbnRyeV0pID0+IGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5KSk7XG4gICAgfVxuXG4gICAgLy8gPT09PT0gQXNzZXQgREIgb3BlcmF0aW9ucyA9PT09PVxuXG4gICAgLyoqXG4gICAgICogTGluayB0aGUgc2NlbmUgbm9kZSB0byB0aGUgZnJlc2hseSB3cml0dGVuIHByZWZhYiBhc3NldC5cbiAgICAgKlxuICAgICAqIGBzY2VuZTpsaW5rLXByZWZhYmAgKG5vZGVVdWlkLCBhc3NldFV1aWQg4oCUIHBvc2l0aW9uYWwsIHRoZSBlZGl0b3IncyBvd25cbiAgICAgKiBgbGlua1ByZWZhYihub2RlVXVpZCwgYXNzZXRVdWlkKWAgZmFjYWRlIGNhbGwpIGlzIHRyaWVkIGZpcnN0LiBUaGUgdGhyZWUgbGVnYWN5XG4gICAgICogb2JqZWN0LWZvcm0gbWVzc2FnZXMgbmV2ZXIgZXhpc3RlZCBpbiAzLjguNyBhbmQgYXJlIGtlcHQgb25seSBhcyBmYWxsYmFja3MuIEV2ZXJ5XG4gICAgICogcmVqZWN0aW9uIGlzIGNvbGxlY3RlZCBzbyBhIGZhaWxlZCBjb252ZXJzaW9uIG5hbWVzIGl0cyBjYXVzZXMgaW5zdGVhZCBvZiB0aGUgYmFyZVxuICAgICAqIFwiYWxsIG1ldGhvZHMgZmFpbGVkXCIgdGhhdCBsZWZ0ICMxMzAncyBjYWxsZXJzIGd1ZXNzaW5nLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY29udmVydE5vZGVUb1ByZWZhYkluc3RhbmNlKG5vZGVVdWlkOiBzdHJpbmcsIHByZWZhYlV1aWQ6IHN0cmluZywgX3ByZWZhYlBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IG1ldGhvZHM6IEFycmF5PFtzdHJpbmcsICgpID0+IFByb21pc2U8YW55Pl0+ID0gW1xuICAgICAgICAgICAgWydsaW5rLXByZWZhYicsICgpID0+IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ2xpbmstcHJlZmFiJywgbm9kZVV1aWQsIHByZWZhYlV1aWQpXSxcbiAgICAgICAgICAgIFsnY29ubmVjdC1wcmVmYWItaW5zdGFuY2UnLCAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjb25uZWN0LXByZWZhYi1pbnN0YW5jZScsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiVXVpZCB9KV0sXG4gICAgICAgICAgICBbJ3NldC1wcmVmYWItY29ubmVjdGlvbicsICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcmVmYWItY29ubmVjdGlvbicsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiVXVpZCB9KV0sXG4gICAgICAgICAgICBbJ2FwcGx5LXByZWZhYi1saW5rJywgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnYXBwbHktcHJlZmFiLWxpbmsnLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlV1aWQgfSldXG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IGZhaWx1cmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IFtuYW1lLCBtZXRob2RdIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBtZXRob2QoKTtcbiAgICAgICAgICAgICAgICAvLyBBIG1lc3NhZ2UgdGhhdCByZXNvbHZlcyBgZmFsc2VgIGRlY2xpbmVkIHRoZSBsaW5rOyBpdCBpcyBub3QgYSBzdWNjZXNzLlxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7IGZhaWx1cmVzLnB1c2goYCR7bmFtZX06IHJldHVybmVkIGZhbHNlYCk7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICBmYWlsdXJlcy5wdXNoKGAke25hbWV9OiAke2Vycj8ubWVzc2FnZSB8fCBlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQWxsIHByZWZhYiBjb25uZWN0aW9uIG1ldGhvZHMgZmFpbGVkICgke2ZhaWx1cmVzLmpvaW4oJzsgJyl9KWAgfTtcbiAgICB9XG5cbiAgICAvKiogRmllbGRzIGRlc2NyaWJpbmcgYSBmYWlsZWQgbm9kZS0+aW5zdGFuY2UgY29udmVyc2lvbiwgc28gdGhlIGZhaWx1cmUgaXMgbm90IGJ1cmllZCBpbiBgbWVzc2FnZWAuICovXG4gICAgcHJpdmF0ZSBjb252ZXJzaW9uRmFpbHVyZUZpZWxkcyhjb252ZXJ0UmVzdWx0OiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICAgICAgaWYgKGNvbnZlcnRSZXN1bHQuc3VjY2VzcykgcmV0dXJuIHt9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgd2FybmluZzogJ1RoZSBwcmVmYWIgYXNzZXQgd2FzIHdyaXR0ZW4sIGJ1dCB0aGUgc2NlbmUgbm9kZSB3YXMgTk9UIGNvbnZlcnRlZCBpbnRvIGEgbGlua2VkIHByZWZhYiBpbnN0YW5jZTsgaXQgaXMgc3RpbGwgYSBwbGFpbiBub2RlLicsXG4gICAgICAgICAgICBjb252ZXJzaW9uRXJyb3I6IGNvbnZlcnRSZXN1bHQuZXJyb3IsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1VzZSB0aGUgd3JpdHRlbiBwcmVmYWIgYXMtaXMsIG9yIGxpbmsgdGhlIG5vZGUgaW4gdGhlIGVkaXRvciAocmlnaHQtY2xpY2sgbm9kZSA+IExpbmsgUHJlZmFiKS4gUmUtcnVubmluZyBjcmVhdGUgd2lsbCBub3QgcmV0cnkgdGhlIGxpbmsuJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZVByZWZhYldpdGhNZXRhKHByZWZhYlBhdGg6IHN0cmluZywgcHJlZmFiRGF0YTogYW55W10sIG1ldGFEYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlQXNzZXRGaWxlKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHByZWZhYkRhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZUFzc2V0RmlsZShgJHtwcmVmYWJQYXRofS5tZXRhYCwgSlNPTi5zdHJpbmdpZnkobWV0YURhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gc2F2ZSBwcmVmYWIgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZUFzc2V0RmlsZShmaWxlUGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBmaWxlUGF0aCwgY29udGVudCksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICd3cml0ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KVxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiBtZXRob2RzKSB7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCBtZXRob2QoKTsgcmV0dXJuOyB9IGNhdGNoIHsgLyogdHJ5IG5leHQgKi8gfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWxsIHNhdmUgbWV0aG9kcyBmYWlsZWQnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFzc2V0UGF0aCwgY29udGVudCwgeyBvdmVyd3JpdGU6IHRydWUsIHJlbmFtZTogZmFsc2UgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBhc3NldEluZm8gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gY3JlYXRlIGFzc2V0IGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZU1ldGFXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgbWV0YUNvbnRlbnQ6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIGFzc2V0UGF0aCwgSlNPTi5zdHJpbmdpZnkobWV0YUNvbnRlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGFzc2V0SW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgbWV0YSBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWltcG9ydEFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0UGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gcmVpbXBvcnQgYXNzZXQnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZUFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBhc3NldFBhdGgsIGNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcmVzdWx0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIHVwZGF0ZSBhc3NldCBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gRm9ybWF0IHZhbGlkYXRpb24gPT09PT1cblxuICAgIC8qKlxuICAgICAqIFN0cnVjdHVyYWwgdmFsaWRhdGlvbiBvZiBhIHNlcmlhbGl6ZWQgcHJlZmFiLlxuICAgICAqXG4gICAgICogU3RydWN0dXJhbCBhbG9uZSBpcyBub3QgXCJ2YWxpZFwiOiBhIHByZWZhYiB3aG9zZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgdG8gdGhlaXIgYmFyZVxuICAgICAqIGVudmVsb3BlIHBhc3NlcyBldmVyeSBjaGVjayBoZXJlIHdoaWxlIGNhcnJ5aW5nIG5vbmUgb2YgdGhlIHNjZW5lIHZhbHVlcywgd2hpY2ggaXMgd2h5XG4gICAgICogYG1hbmFnZV9wcmVmYWIgYWN0aW9uPXZhbGlkYXRlYCByZXR1cm5lZCBgaXNWYWxpZDogdHJ1ZWAgb3ZlciB0aGUgaG9sbG93IG91dHB1dCBvZlxuICAgICAqIGlzc3VlICM3MydzIG93biByZXByby4gYGhvbGxvd0NvbXBvbmVudHNgIHJlcG9ydHMgdGhlIGNvbXBvbmVudHMgdGhhdCBob2xkIG5vdGhpbmdcbiAgICAgKiBiZXlvbmQgYEJBU0VfQ09NUE9ORU5UX0tFWVNgLCBzbyBcInZhbGlkXCIgYW5kIFwiZW1wdHlcIiBhcmUgZGlzdGluZ3Vpc2hhYmxlLlxuICAgICAqL1xuICAgIHZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkRhdGE6IGFueSk6IHsgaXNWYWxpZDogYm9vbGVhbjsgaXNzdWVzOiBzdHJpbmdbXTsgbm9kZUNvdW50OiBudW1iZXI7IGNvbXBvbmVudENvdW50OiBudW1iZXI7IGhvbGxvd0NvbXBvbmVudHM6IHN0cmluZ1tdOyBkdXBsaWNhdGVBY2Nlc3NvcktleXM6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiB9IHtcbiAgICAgICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBob2xsb3dDb21wb25lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBkdXBsaWNhdGVBY2Nlc3NvcktleXM6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiA9IFtdO1xuICAgICAgICBsZXQgbm9kZUNvdW50ID0gMDtcbiAgICAgICAgbGV0IGNvbXBvbmVudENvdW50ID0gMDtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCwgaG9sbG93Q29tcG9uZW50cywgZHVwbGljYXRlQWNjZXNzb3JLZXlzIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByZWZhYkRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgaXMgZW1wdHknKTtcbiAgICAgICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGZhbHNlLCBpc3N1ZXMsIG5vZGVDb3VudCwgY29tcG9uZW50Q291bnQsIGhvbGxvd0NvbXBvbmVudHMsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghcHJlZmFiRGF0YVswXSB8fCBwcmVmYWJEYXRhWzBdLl9fdHlwZV9fICE9PSAnY2MuUHJlZmFiJykge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goJ0ZpcnN0IGVsZW1lbnQgbXVzdCBiZSBjYy5QcmVmYWIgdHlwZScpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGVzV2l0aENvbXBvbmVudHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgcHJlZmFiRGF0YS5mb3JFYWNoKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtLl9fdHlwZV9fID09PSAnY2MuTm9kZScpIHtcbiAgICAgICAgICAgICAgICBub2RlQ291bnQrKztcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiAoaXRlbS5fY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZiAmJiB0eXBlb2YgcmVmLl9faWRfXyA9PT0gJ251bWJlcicpIG5vZGVzV2l0aENvbXBvbmVudHMuYWRkKHJlZi5fX2lkX18pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXRlbS5fX3R5cGVfXyA9PT0gJ2NjLkNvbXBQcmVmYWJJbmZvJyB8fCAhaXRlbS5fX3R5cGVfXykge1xuICAgICAgICAgICAgICAgIC8vIFNlcmlhbGl6YXRpb24gYm9va2tlZXBpbmcsIG5ldmVyIGEgY29tcG9uZW50IGluc3RhbmNlLlxuICAgICAgICAgICAgfSBlbHNlIGlmIChTdHJpbmcoaXRlbS5fX3R5cGVfXykuc3RhcnRzV2l0aCgnY2MuJykgfHwgaXRlbS5fX3R5cGVfXykge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudENvdW50Kys7XG4gICAgICAgICAgICAgICAgLy8gQSBjb21wb25lbnQgdGhhdCBpcyByZWZlcmVuY2VkIGZyb20gYSBub2RlIGJ1dCBjYXJyaWVzIG5vdGhpbmcgYnV0IHRoZVxuICAgICAgICAgICAgICAgIC8vIGVudmVsb3BlIGhhcyBsb3N0IGV2ZXJ5IHByb3BlcnR5IGl0IGhlbGQgaW4gdGhlIHNjZW5lICgjMjgvIzczKS5cbiAgICAgICAgICAgICAgICBjb25zdCBob2xkc05vdGhpbmdCdXRFbnZlbG9wZSA9IE9iamVjdC5rZXlzKGl0ZW0pLmV2ZXJ5KGtleSA9PiBCQVNFX0NPTVBPTkVOVF9LRVlTLmhhcyhrZXkpKTtcbiAgICAgICAgICAgICAgICBpZiAoaG9sZHNOb3RoaW5nQnV0RW52ZWxvcGUgJiYgdHlwZW9mIGl0ZW0ubm9kZT8uX19pZF9fID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICBob2xsb3dDb21wb25lbnRzLnB1c2goU3RyaW5nKGl0ZW0uX190eXBlX18pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQW4gYWNjZXNzb3Iga2V5IHNpdHRpbmcgYmVzaWRlIGl0cyBzZXJpYWxpemVkIGBfYC10d2luIGlzIGEgcHJlZmFiIHRoZVxuICAgICAgICAgICAgICAgIC8vIGltcG9ydGVyIHJlamVjdHMgKCMxMTQgZGVmZWN0IDIpLiBDaGVja2VkIGhlcmUgYmVjYXVzZSBgYWN0aW9uPXZhbGlkYXRlYFxuICAgICAgICAgICAgICAgIC8vIHJlcG9ydGVkIGBpc1ZhbGlkOiB0cnVlYCBvbiB0aGUgYnJva2VuIGZpbGUgYm90aCBiZWZvcmUgQU5EIGFmdGVyIHRoZVxuICAgICAgICAgICAgICAgIC8vIHJlcG9ydCdzIG1hbnVhbCByZXBhaXIsIHNvIGl0IGNhdWdodCBub3RoaW5nIGFib3V0IHRoaXMgY2xhc3MuXG4gICAgICAgICAgICAgICAgY29uc3QgdHdpbnMgPSBmaW5kQWNjZXNzb3JUd2luS2V5cyhTdHJpbmcoaXRlbS5fX3R5cGVfXyksIGl0ZW0pO1xuICAgICAgICAgICAgICAgIGlmICh0d2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cy5wdXNoKHsgdHlwZTogU3RyaW5nKGl0ZW0uX190eXBlX18pLCBrZXlzOiB0d2lucyB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobm9kZUNvdW50ID09PSAwKSBpc3N1ZXMucHVzaCgnUHJlZmFiIG11c3QgY29udGFpbiBhdCBsZWFzdCBvbmUgbm9kZScpO1xuICAgICAgICBmb3IgKGNvbnN0IGhvbGxvdyBvZiBbLi4ubmV3IFNldChob2xsb3dDb21wb25lbnRzKV0pIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKGBDb21wb25lbnQgJyR7aG9sbG93fScgc2VyaWFsaXplZCB3aXRoIG5vIHByb3BlcnRpZXMg4oCUIGl0IGNhcnJpZXMgbm9uZSBvZiB0aGUgc2NlbmUgdmFsdWVzIGl0IGhhZCAoaXNzdWVzICMyOC8jNzMpYCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBkdXAgb2YgZHVwbGljYXRlQWNjZXNzb3JLZXlzKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaChcbiAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2R1cC50eXBlfScgc2VyaWFsaXplcyBib3RoIGFuIGFjY2Vzc29yIGtleSBhbmQgaXRzIHVuZGVyc2NvcmUgdHdpbiBgICtcbiAgICAgICAgICAgICAgICBgKCR7ZHVwLmtleXMubWFwKGsgPT4gYCcke2t9Jy8nXyR7a30nYCkuam9pbignLCAnKX0pIOKAlCB0aGUgYXNzZXQgaW1wb3J0ZXIgcmVqZWN0cyB0aGlzIGAgK1xuICAgICAgICAgICAgICAgIGBzaGFwZSB3aXRoIFwiQ2Fubm90IHJlYWQgcHJvcGVydGllcyBvZiB1bmRlZmluZWQgKHJlYWRpbmcgJ19uYW1lJylcIiAoaXNzdWUgIzExNCkuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBpc3N1ZXMubGVuZ3RoID09PSAwLCBpc3N1ZXMsIG5vZGVDb3VudCwgY29tcG9uZW50Q291bnQsIGhvbGxvd0NvbXBvbmVudHMsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cyB9O1xuICAgIH1cblxuICAgIGNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICByZXR1cm4geyBcInZlclwiOiBcIjEuMS41MFwiLCBcImltcG9ydGVyXCI6IFwicHJlZmFiXCIsIFwiaW1wb3J0ZWRcIjogdHJ1ZSwgXCJ1dWlkXCI6IHByZWZhYlV1aWQsIFwiZmlsZXNcIjogW1wiLmpzb25cIl0sIFwic3ViTWV0YXNcIjoge30sIFwidXNlckRhdGFcIjogeyBcInN5bmNOb2RlTmFtZVwiOiBwcmVmYWJOYW1lIH0gfTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBVVUlEIHV0aWxpdGllcyA9PT09PVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVVVSUQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgY2hhcnMgPSAnMDEyMzQ1Njc4OWFiY2RlZic7XG4gICAgICAgIGxldCB1dWlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDggfHwgaSA9PT0gMTIgfHwgaSA9PT0gMTYgfHwgaSA9PT0gMjApIHV1aWQgKz0gJy0nO1xuICAgICAgICAgICAgdXVpZCArPSBjaGFyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFycy5sZW5ndGgpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlRmlsZUlkKCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNoYXJzID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5Ky8nO1xuICAgICAgICBsZXQgZmlsZUlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjI7IGkrKykgZmlsZUlkICs9IGNoYXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJzLmxlbmd0aCldO1xuICAgICAgICByZXR1cm4gZmlsZUlkO1xuICAgIH1cblxufVxuIl19