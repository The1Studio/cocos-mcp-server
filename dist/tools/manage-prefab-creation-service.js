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
            losses: [],
            deferredComponents: []
        };
        await this.createCompleteNodeTree(nodeData, null, 1, context, includeChildren, includeComponents, prefabName);
        // Pass 2 (#147): every node and component index is registered now, so a property that
        // references something visited LATER in the walk (a child pointing at its parent's
        // component, a later sibling, a later component on the same node) resolves to a
        // `{__id__}` instead of an unresolved loss.
        for (const deferred of context.deferredComponents) {
            const componentObj = this.createComponentObject(deferred.component, deferred.nodeIndex, context);
            prefabData[deferred.componentIndex] = componentObj;
            if (componentObj && typeof componentObj === 'object')
                componentObj.__prefab = { "__id__": deferred.compPrefabInfoIndex };
        }
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
                const compPrefabInfoIndex = context.currentId++;
                prefabData[compPrefabInfoIndex] = { "__type__": "cc.CompPrefabInfo", "fileId": this.generateFileId() };
                // The slot is reserved here; the component body (and so its reference
                // properties) is serialized in pass 2 — see createStandardPrefabContent.
                prefabData[componentIndex] = null;
                context.deferredComponents.push({ component, nodeIndex, componentIndex, compPrefabInfoIndex });
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
            // In-tree component reference: the uuid names a component in the subtree being
            // serialized, so it encodes as an object index. Checked BEFORE the asset test:
            // a uuid in the component index IS a component whatever its class is called, and
            // a custom component named like `TileAsset`/`GameAtlas` matches the asset suffix
            // arm below — which wrote it as `{__uuid__}` (#147). An asset's uuid can never be
            // in this index, so the Label-font case the asset branch exists for is unaffected.
            if ((_b = context === null || context === void 0 ? void 0 : context.componentUuidToIndex) === null || _b === void 0 ? void 0 : _b.has(value.uuid)) {
                return { "__id__": context.componentUuidToIndex.get(value.uuid) };
            }
            if (PrefabCreationService.isAssetType(type)) {
                return { "__uuid__": value.uuid, "__expectedType__": type };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFvRUEsb0RBS0M7QUF6RUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsdUNBQXlCO0FBQ3pCLG9EQUFtRDtBQUNuRCwyRUFBMEQ7QUFDMUQsMkZBQW1GO0FBRW5GOzs7OztHQUtHO0FBQ0gsU0FBUyxvQkFBb0IsQ0FBQyxLQUFVO0lBQ3BDLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDOUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsT0FBTyxDQUFDO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDeEUsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNqSCxDQUFDO0FBRUQsc0ZBQXNGO0FBQ3RGLE1BQU0sd0JBQXdCLEdBQUcsSUFBSSxHQUFHLENBQUM7SUFDckMsTUFBTSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxlQUFlO0lBQzlELFdBQVcsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsa0JBQWtCO0NBQzFFLENBQUMsQ0FBQztBQUVILHdGQUF3RjtBQUN4RixN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QUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDaFQsSUFBSSxJQUFJLEtBQUssU0FBUztnQkFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzFJLElBQUksSUFBSSxLQUFLLFNBQVM7Z0JBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQy9HLElBQUksSUFBSSxLQUFLLFNBQVM7Z0JBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2pJLElBQUksSUFBSSxLQUFLLFNBQVM7Z0JBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsTUFB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a0JBQWtCO0lBQ2hGLGNBQWMsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxlQUFlLEVBQUUsZUFBZTtJQUNyRixnQkFBZ0IsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixFQUFFLFNBQVM7SUFDL0UsYUFBYSxFQUFFLGtCQUFrQixFQUFFLG9CQUFvQixFQUFFLGVBQWUsRUFBRSxnQkFBZ0I7Q0FDN0YsQ0FBQyxBQUxpQyxDQUtoQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHJlZmFiQ3JlYXRpb25TZXJ2aWNlOiBoYW5kbGVzIHRoZSBjb21wbGV4IGxvZ2ljIG9mIGNyZWF0aW5nIENvY29zIENyZWF0b3IgcHJlZmFiIGZpbGVzXG4gKiBwcm9ncmFtbWF0aWNhbGx5LiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VQcmVmYWIgdG8ga2VlcCBtYW5hZ2UtcHJlZmFiLnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqXG4gKiBSZXNwb25zaWJpbGl0aWVzOlxuICogLSBGZXRjaGluZyBub2RlIGRhdGEgd2l0aCBjb21wb25lbnQgaW5mbyBmcm9tIHRoZSBzY2VuZVxuICogLSBTZXJpYWxpemluZyBub2RlIHRyZWVzIGludG8gQ29jb3MgQ3JlYXRvciBwcmVmYWIgSlNPTiBmb3JtYXRcbiAqIC0gU2F2aW5nIGFuZCByZS1pbXBvcnRpbmcgYXNzZXQgZmlsZXMgdmlhIGFzc2V0LWRiXG4gKiAtIExpbmtpbmcgc2NlbmUgbm9kZXMgdG8gbmV3bHkgY3JlYXRlZCBwcmVmYWIgYXNzZXRzXG4gKi9cbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IHJlc29sdmVBc3NldCB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LXBhdGgnO1xuaW1wb3J0IHsgY2hpbGRVdWlkT2YgfSBmcm9tICcuL21hbmFnZS1ub2RlLXNpYmxpbmctb3JkZXInO1xuaW1wb3J0IHsgZXh0cmFjdENvbXBvbmVudFByb3BlcnR5RHVtcCB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcblxuLyoqXG4gKiBBIGR1bXAgZW50cnkgaXMgYSBwcm9wZXJ0eSBkZXNjcmlwdG9yIHdoZW4gaXQgd3JhcHMgYSBgdmFsdWVgIGFuZCBjYXJyaWVzIGF0IGxlYXN0IG9uZVxuICogZWRpdG9yIGFubm90YXRpb24uIERlbGliZXJhdGVseSBsb29zZXIgdGhhbiB0aGUgaW5zcGVjdG9yLXNpZGVcbiAqIGBpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yYCwgd2hpY2ggcmVqZWN0cyBkZXNjcmlwdG9ycyB3aG9zZSBmaWVsZHMgYXJlIGFsbCBwcmltaXRpdmVzXG4gKiAoYHsgbmFtZSwgdmFsdWU6IDYwLCB0eXBlOiAnTnVtYmVyJyB9YCkgYmVjYXVzZSBpdCBpcyBndWFyZGluZyBhIGRpZmZlcmVudCBjYXNlLlxuICovXG5mdW5jdGlvbiBpc1Byb3BlcnR5RGVzY3JpcHRvcihlbnRyeTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkoZW50cnkpKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZW50cnksICd2YWx1ZScpKSByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIFsnbmFtZScsICd0eXBlJywgJ2Rpc3BsYXlOYW1lJywgJ3JlYWRvbmx5J10uc29tZShrID0+IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChlbnRyeSwgaykpO1xufVxuXG4vKiogRWRpdG9yLW9ubHkgZHVtcCBlbnRyaWVzIHRoYXQgaGF2ZSBubyBzZXJpYWxpemVkIGNvdW50ZXJwYXJ0IGluIGEgLnByZWZhYiBmaWxlLiAqL1xuY29uc3QgRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVEID0gbmV3IFNldChbXG4gICAgJ25vZGUnLCAnZW5hYmxlZCcsICdfX3R5cGVfXycsICd1dWlkJywgJ25hbWUnLCAnX19zY3JpcHRBc3NldCcsXG4gICAgJ19vYmpGbGFncycsICdfbmFtZScsICdfaWQnLCAnX2VuYWJsZWQnLCAnX19wcmVmYWInLCAnX19lZGl0b3JFeHRyYXNfXydcbl0pO1xuXG4vKiogVGhlIGVudmVsb3BlIGV2ZXJ5IHNlcmlhbGl6ZWQgY29tcG9uZW50IGNhcnJpZXMgZXZlbiB3aGVuIGl0IGhvbGRzIG5vIHByb3BlcnRpZXMuICovXG5jb25zdCBCQVNFX0NPTVBPTkVOVF9LRVlTID0gbmV3IFNldChbXG4gICAgJ19fdHlwZV9fJywgJ19uYW1lJywgJ19vYmpGbGFncycsICdfX2VkaXRvckV4dHJhc19fJywgJ25vZGUnLCAnX2VuYWJsZWQnLCAnX19wcmVmYWInLCAnX2lkJ1xuXSk7XG5cbi8qKiBUcnVlIHdoZW4gYSBzZXJpYWxpemVkIGNvbXBvbmVudCBrZXkgaXMgYW4gZW5naW5lIGFjY2Vzc29yIHdpdGggYSBgX2AtcHJlZml4ZWQgdHdpbi4gKi9cbmZ1bmN0aW9uIGlzRW5naW5lVHlwZShjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gL14oY2N8c3B8ZHJhZ29uQm9uZXMpXFwuLy50ZXN0KGNvbXBvbmVudFR5cGUpO1xufVxuXG4vKipcbiAqIEZpbmQgdGhlIGFjY2Vzc29yIGtleXMgYSBkdW1wIGNhcnJpZXMgYWxvbmdzaWRlIHRoZWlyIGBfYC1wcmVmaXhlZCBzZXJpYWxpemVkIHR3aW4uXG4gKlxuICogSXNzdWUgIzExNCBkZWZlY3QgMi4gQSBgc2NlbmU6cXVlcnktbm9kZWAgZHVtcCBjYXJyaWVzIEJPVEggc3BlbGxpbmdzIG9mIGFuXG4gKiBhY2Nlc3Nvci1iYWNrZWQgZW5naW5lIGZpZWxkIOKAlCB0aGUgaW5zcGVjdG9yIGFjY2Vzc29yIChgY2xpcHNgLCBgZGVmYXVsdENsaXBgLFxuICogYHNoYXJlZE1hdGVyaWFsc2ApIGFuZCB0aGUgdHJ1ZSBzZXJpYWxpemVkIGZpZWxkIChgX2NsaXBzYCwgYF9kZWZhdWx0Q2xpcGAsXG4gKiBgX21hdGVyaWFsc2ApLiBgY3JlYXRlQ29tcG9uZW50T2JqZWN0YCBlbWl0dGVkIGV2ZXJ5IGR1bXAga2V5IHZlcmJhdGltIHVubGVzcyB0aGUgdHlwZVxuICogd2FzIGluIGBEVU1QX0tFWV9SRU5BTUVTYCwgc28gYSBgY2MuQW5pbWF0aW9uYCBjb21wb25lbnQgKGFic2VudCBmcm9tIHRoZSB0YWJsZSkgd3JvdGVcbiAqIGBjbGlwc2AgQU5EIGBfY2xpcHNgIGFzIHNlcGFyYXRlIHRvcC1sZXZlbCBrZXlzIHdpdGggZGl2ZXJnaW5nIHZhbHVlcywgYW5kIHRoZSBhc3NldFxuICogaW1wb3J0ZXIgcmVqZWN0ZWQgdGhlIHByZWZhYiBvdXRyaWdodDpcbiAqXG4gKiAgICAgW0Fzc2V0c10gQ2Fubm90IHJlYWQgcHJvcGVydGllcyBvZiB1bmRlZmluZWQgKHJlYWRpbmcgJ19uYW1lJykgIFR5cGVFcnJvclxuICpcbiAqIFRoZSBvcmlnaW5hdGluZyByZXBvcnQgcGlubmVkIHRoZSByZXBhaXIgZW1waXJpY2FsbHk6IHN0cmlwcGluZyBldmVyeSBub24tdW5kZXJzY29yZSBrZXlcbiAqIHRoYXQgaGFzIGFuIHVuZGVyc2NvcmUgdHdpbiByZXByb2R1Y2VkIHRoZSBrZXkgc2V0IG9mIGEgaGFuZC1hdXRob3JlZCBwcmVmYWIsIHdoaWNoXG4gKiBpbXBvcnRlZCBjbGVhbmx5LlxuICpcbiAqIFRoaXMgaXMgdHlwZS1BR05PU1RJQyBvbiBwdXJwb3NlLiBBIHRhYmxlIHRoYXQgbXVzdCBiZSBleHRlbmRlZCBwZXIgY29uZmlybWVkIG1pc21hdGNoXG4gKiBhbHdheXMgbGFncyB0aGUgZW5naW5lOyB0aGUgdHdpbiBpbnZhcmlhbnQgY2Fubm90LCBhbmQgaXQgaXMgc3RhdGljYWxseSBkZXRlY3RhYmxlIOKAlFxuICogd2hpY2ggdGhlIHRhYmxlJ3Mgb3duIGRvY3N0cmluZyBwcmV2aW91c2x5IGRlbmllZC5cbiAqXG4gKiBTY29wZWQgdG8gRU5HSU5FIHR5cGVzLiBBIHNjcmlwdCBtYXkgbGVnaXRpbWF0ZWx5IGRlY2xhcmUgYm90aCBgZm9vYCBhbmQgYF9mb29gIGFzXG4gKiBkaXN0aW5jdCBgQHByb3BlcnR5YCBmaWVsZHMsIGFuZCBkcm9wcGluZyBvbmUgdGhlcmUgd291bGQgYmUgZGF0YSBsb3NzIHJhdGhlciB0aGFuIGFcbiAqIHJlcGFpciwgc28gc2NyaXB0IGNvbXBvbmVudHMgYXJlIG5ldmVyIHRvdWNoZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlOiBzdHJpbmcsIHByb3BlcnRpZXM6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBzdHJpbmdbXSB7XG4gICAgaWYgKCFpc0VuZ2luZVR5cGUoY29tcG9uZW50VHlwZSkpIHJldHVybiBbXTtcbiAgICByZXR1cm4gT2JqZWN0LmtleXMocHJvcGVydGllcykuZmlsdGVyKFxuICAgICAgICBrZXkgPT4gIWtleS5zdGFydHNXaXRoKCdfJykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHByb3BlcnRpZXMsIGBfJHtrZXl9YClcbiAgICApO1xufVxuXG4vKipcbiAqIEtleXMgd2hvc2Ugc2VyaWFsaXplZCBmaWVsZCBuYW1lIGRpZmZlcnMgKGFjY2Vzc29yLWJhY2tlZCBlbmdpbmUgcHJvcGVydGllcykuXG4gKlxuICogVmVyaWZpZWQgb25seSBmb3IgdGhlc2UgZm91ciB0eXBlcyDigJQgZXZlcnkgb3RoZXIgZW5naW5lIGBjYy4qYC9gc3AuKmAvYGRyYWdvbkJvbmVzLipgXG4gKiBjb21wb25lbnQgZmFsbHMgdGhyb3VnaCB0byB0aGUgZ2VuZXJpYyBicmFuY2ggYmVsb3csIHdoaWNoIGVtaXRzIHRoZSBkdW1wIGtleVxuICogVkVSQkFUSU0uIEZvciBtb3N0IGVuZ2luZSB0eXBlcyB0aGUgZHVtcCBrZXkgYWxyZWFkeSBtYXRjaGVzIHRoZSBzZXJpYWxpemVkIGtleVxuICogKGUuZy4gYGNjLlBhcnRpY2xlU3lzdGVtMkRgJ3MgYGVtaXNzaW9uUmF0ZWApLCBidXQgYW4gYWNjZXNzb3ItYmFja2VkIGZpZWxkIG9uIGEgdHlwZVxuICogbm90IGxpc3RlZCBoZXJlIHdvdWxkIHNlcmlhbGl6ZSB1bmRlciB0aGUgV1JPTkcga2V5IHJhdGhlciB0aGFuIGJlaW5nIGRyb3BwZWQuXG4gKlxuICogRXh0ZW5kIHRoaXMgdGFibGUgYXMgc3BlY2lmaWMgbWlzbWF0Y2hlcyBhcmUgY29uZmlybWVkIGFnYWluc3QgYSBydW5uaW5nIENvY29zIENyZWF0b3JcbiAqIDMuOC43IGluc3RhbmNlIOKAlCBidXQgbm90ZSB0aGF0IGBmaW5kQWNjZXNzb3JUd2luS2V5c2AgYmVsb3cgaXMgdGhlIHR5cGUtYWdub3N0aWMgbmV0XG4gKiB1bmRlcm5lYXRoIGl0OiB3aGVyZSB0aGUgZHVtcCBjYXJyaWVzIEJPVEggc3BlbGxpbmdzLCB0aGUgdHdpbiBpcyBkcm9wcGVkIHJhdGhlciB0aGFuXG4gKiByZXF1aXJpbmcgYSB0YWJsZSBlbnRyeSwgc28gYSB0eXBlIHRoaXMgdGFibGUgaGFzIG5ldmVyIGhlYXJkIG9mIHN0aWxsIHNlcmlhbGl6ZXNcbiAqIGltcG9ydGFibGUuIFRoZSB0YWJsZSByZW1haW5zIG5lY2Vzc2FyeSBmb3IgdGhlIGNhc2UgdGhlIG5ldCBjYW5ub3Qgc2VlIOKAlCBhblxuICogYWNjZXNzb3Itb25seSBrZXkgd2l0aCBubyBzZXJpYWxpemVkIHR3aW4gcHJlc2VudCBpbiB0aGUgc2FtZSBkdW1wLlxuICovXG5jb25zdCBEVU1QX0tFWV9SRU5BTUVTOiBSZWNvcmQ8c3RyaW5nLCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHtcbiAgICAnY2MuVUlUcmFuc2Zvcm0nOiB7IGNvbnRlbnRTaXplOiAnX2NvbnRlbnRTaXplJywgYW5jaG9yUG9pbnQ6ICdfYW5jaG9yUG9pbnQnIH0sXG4gICAgJ2NjLlNwcml0ZSc6IHsgc3ByaXRlRnJhbWU6ICdfc3ByaXRlRnJhbWUnLCB0eXBlOiAnX3R5cGUnLCBzaXplTW9kZTogJ19zaXplTW9kZScsIGZpbGxUeXBlOiAnX2ZpbGxUeXBlJyB9LFxuICAgICdjYy5MYWJlbCc6IHsgc3RyaW5nOiAnX3N0cmluZycsIGZvbnRTaXplOiAnX2ZvbnRTaXplJywgbGluZUhlaWdodDogJ19saW5lSGVpZ2h0Jywgb3ZlcmZsb3c6ICdfb3ZlcmZsb3cnIH0sXG4gICAgJ2NjLkJ1dHRvbic6IHsgdGFyZ2V0OiAnX3RhcmdldCcsIGludGVyYWN0YWJsZTogJ19pbnRlcmFjdGFibGUnLCB0cmFuc2l0aW9uOiAnX3RyYW5zaXRpb24nIH0sXG59O1xuXG4vKipcbiAqIEdhcC1maWxsZXJzLCBhcHBsaWVkIG9ubHkgdG8ga2V5cyB0aGUgZHVtcCBkaWQgbm90IHN1cHBseS4gVGhlc2UgYXJlIGVuZ2luZSBkZWZhdWx0cyDigJRcbiAqIG5ldmVyIGFuIG92ZXJyaWRlIG9mIGEgY2FwdHVyZWQgdmFsdWUuXG4gKi9cbmNvbnN0IENPTVBPTkVOVF9ERUZBVUxUUzogUmVjb3JkPHN0cmluZywgUmVjb3JkPHN0cmluZywgYW55Pj4gPSB7XG4gICAgJ2NjLlVJVHJhbnNmb3JtJzoge1xuICAgICAgICBfY29udGVudFNpemU6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlNpemVcIiwgXCJ3aWR0aFwiOiAxMDAsIFwiaGVpZ2h0XCI6IDEwMCB9LFxuICAgICAgICBfYW5jaG9yUG9pbnQ6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzJcIiwgXCJ4XCI6IDAuNSwgXCJ5XCI6IDAuNSB9LFxuICAgIH0sXG4gICAgJ2NjLlNwcml0ZSc6IHtcbiAgICAgICAgX3Nwcml0ZUZyYW1lOiBudWxsLCBfdHlwZTogMCwgX2ZpbGxUeXBlOiAwLCBfc2l6ZU1vZGU6IDEsXG4gICAgICAgIF9maWxsQ2VudGVyOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMyXCIsIFwieFwiOiAwLCBcInlcIjogMCB9LFxuICAgICAgICBfZmlsbFN0YXJ0OiAwLCBfZmlsbFJhbmdlOiAwLCBfaXNUcmltbWVkTW9kZTogdHJ1ZSwgX3VzZUdyYXlzY2FsZTogZmFsc2UsXG4gICAgICAgIF9hdGxhczogbnVsbCxcbiAgICB9LFxuICAgICdjYy5CdXR0b24nOiB7XG4gICAgICAgIF9pbnRlcmFjdGFibGU6IHRydWUsIF90cmFuc2l0aW9uOiAzLFxuICAgICAgICBfbm9ybWFsQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyNTUsIFwiZ1wiOiAyNTUsIFwiYlwiOiAyNTUsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX2hvdmVyQ29sb3I6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyMTEsIFwiZ1wiOiAyMTEsIFwiYlwiOiAyMTEsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgX3ByZXNzZWRDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDI1NSwgXCJnXCI6IDI1NSwgXCJiXCI6IDI1NSwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfZGlzYWJsZWRDb2xvcjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDEyNCwgXCJnXCI6IDEyNCwgXCJiXCI6IDEyNCwgXCJhXCI6IDI1NSB9LFxuICAgICAgICBfbm9ybWFsU3ByaXRlOiBudWxsLCBfaG92ZXJTcHJpdGU6IG51bGwsIF9wcmVzc2VkU3ByaXRlOiBudWxsLCBfZGlzYWJsZWRTcHJpdGU6IG51bGwsXG4gICAgICAgIF9kdXJhdGlvbjogMC4xLCBfem9vbVNjYWxlOiAxLjIsIF9jbGlja0V2ZW50czogW10sXG4gICAgfSxcbiAgICAnY2MuTGFiZWwnOiB7XG4gICAgICAgIF9zdHJpbmc6IFwiTGFiZWxcIiwgX2hvcml6b250YWxBbGlnbjogMSwgX3ZlcnRpY2FsQWxpZ246IDEsXG4gICAgICAgIF9hY3R1YWxGb250U2l6ZTogMjAsIF9mb250U2l6ZTogMjAsIF9mb250RmFtaWx5OiBcIkFyaWFsXCIsXG4gICAgICAgIF9saW5lSGVpZ2h0OiAyNSwgX292ZXJmbG93OiAwLCBfZW5hYmxlV3JhcFRleHQ6IHRydWUsXG4gICAgICAgIF9mb250OiBudWxsLCBfaXNTeXN0ZW1Gb250VXNlZDogdHJ1ZSwgX3NwYWNpbmdYOiAwLFxuICAgICAgICBfaXNJdGFsaWM6IGZhbHNlLCBfaXNCb2xkOiBmYWxzZSwgX2lzVW5kZXJsaW5lOiBmYWxzZSxcbiAgICAgICAgX3VuZGVybGluZUhlaWdodDogMiwgX2NhY2hlTW9kZTogMCxcbiAgICB9LFxufTtcblxuLyoqIEEgY29tcG9uZW50IHdob3NlIGluZGV4IGlzIHJlc2VydmVkIGJ1dCB3aG9zZSBib2R5IGlzIHNlcmlhbGl6ZWQgYWZ0ZXIgdGhlIHdob2xlIHRyZWUgaXMgaW5kZXhlZCAoIzE0NykuICovXG5pbnRlcmZhY2UgRGVmZXJyZWRDb21wb25lbnQge1xuICAgIGNvbXBvbmVudDogYW55O1xuICAgIG5vZGVJbmRleDogbnVtYmVyO1xuICAgIGNvbXBvbmVudEluZGV4OiBudW1iZXI7XG4gICAgY29tcFByZWZhYkluZm9JbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlIHtcblxuICAgIGFzeW5jIGNyZWF0ZVByZWZhYldpdGhBc3NldERCKG5vZGVVdWlkOiBzdHJpbmcsIHNhdmVQYXRoOiBzdHJpbmcsIHByZWZhYk5hbWU6IHN0cmluZywgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuLCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YSA9IGF3YWl0IHRoaXMuZ2V0Tm9kZURhdGEobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ2Fubm90IGdldCBub2RlIGRhdGEnIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHRlbXBQcmVmYWJDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoW3sgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYlwiLCBcIl9uYW1lXCI6IHByZWZhYk5hbWUgfV0sIG51bGwsIDIpO1xuICAgICAgICAgICAgY29uc3QgY3JlYXRlUmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCB0ZW1wUHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBpZiAoIWNyZWF0ZVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gY3JlYXRlUmVzdWx0O1xuXG4gICAgICAgICAgICBjb25zdCBhY3R1YWxQcmVmYWJVdWlkID0gY3JlYXRlUmVzdWx0LmRhdGE/LnV1aWQ7XG4gICAgICAgICAgICBpZiAoIWFjdHVhbFByZWZhYlV1aWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0Nhbm5vdCBnZXQgZW5naW5lLWFzc2lnbmVkIHByZWZhYiBVVUlEJyB9O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJDb250ZW50ID0gYXdhaXQgdGhpcy5jcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGEsIHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQsIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgLy8gRGVmZW5zZS1pbi1kZXB0aCBmb3IgIzExNCBkZWZlY3QgMi4gYHZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkNvbnRlbnQpYCBhbG9uZVxuICAgICAgICAgICAgLy8gd291bGQgYmUgYSBzaGFwZSBjaGVjayB0aGF0IGNhbiBuZXZlciBmYWlsOiBpdCBydW5zIGBmaW5kQWNjZXNzb3JUd2luS2V5c2Agb3ZlclxuICAgICAgICAgICAgLy8gb3V0cHV0IHRoYXQgYGNyZWF0ZUNvbXBvbmVudE9iamVjdGAgYWxyZWFkeSByYW4gdGhlIFNBTUUgcHJlZGljYXRlIG92ZXIsIHNvIGFcbiAgICAgICAgICAgIC8vIGR1cGxpY2F0ZSByZWFjaGluZyBoZXJlIGlzIGltcG9zc2libGUgYnkgY29uc3RydWN0aW9uICh2ZXJpZmllZCDigJQgbmV1dGVyaW5nIHRoaXNcbiAgICAgICAgICAgIC8vIGJyYW5jaCBsZWZ0IGV2ZXJ5IHRlc3QgZ3JlZW4pLiBUaGUgZ2VudWluZSBpbnZhcmlhbnQgaXMgYSBESUZGRVJFTkNFIG9uZTogZXZlcnlcbiAgICAgICAgICAgIC8vIGFjY2Vzc29yIHR3aW4gdGhlIENBUFRVUkVEIHNjZW5lIGR1bXAgY2FycmllcyBtdXN0IGJlIGFic2VudCBmcm9tIHdoYXQgd2UgYXJlXG4gICAgICAgICAgICAvLyBhYm91dCB0byB3cml0ZS4gVGhhdCBmaXJlcyBldmVuIGlmIHRoZSBlbWlzc2lvbiBmaWx0ZXIgaXMgcmVtb3ZlZCwgbWlzLXR5cGVkLCBvclxuICAgICAgICAgICAgLy8gdGhlIGR1bXAgc2hhcGUgY2hhbmdlcyB1bmRlciBpdCwgYmVjYXVzZSBpdCBkb2VzIG5vdCByZS1hc2sgdGhlIGZpbHRlcidzIHF1ZXN0aW9uLlxuICAgICAgICAgICAgY29uc3QgY2FwdHVyZWRUd2lucyA9IHRoaXMuZmluZENhcHR1cmVkQWNjZXNzb3JUd2lucyhub2RlRGF0YSwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBpZiAoY2FwdHVyZWRUd2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZWQgPSBjYXB0dXJlZFR3aW5zXG4gICAgICAgICAgICAgICAgICAgIC5tYXAoZCA9PiBgJHtkLnR5cGV9ICgke2Qua2V5cy5tYXAoayA9PiBgJyR7a30nLydfJHtrfSdgKS5qb2luKCcsICcpfSlgKVxuICAgICAgICAgICAgICAgICAgICAuam9pbignOyAnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUmVmdXNpbmcgdG8gd3JpdGUgJHtzYXZlUGF0aH06IHRoZSBzY2VuZSBjYXJyaWVkIGFuIGFjY2Vzc29yIGtleSBhbG9uZ3NpZGUgaXRzIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYHVuZGVyc2NvcmUgdHdpbiBhbmQgaXQgc3Vydml2ZWQgaW50byB0aGUgcHJlZmFiIOKAlCAke25hbWVkfS4gQ29jb3MgQ3JlYXRvcidzIGFzc2V0IGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYGltcG9ydGVyIHJlamVjdHMgdGhpcyBzaGFwZSAoXCJDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyAnX25hbWUnKVwiKSwgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICBgc28gdGhlIHByZWZhYiB3b3VsZCBiZSB1bmxvYWRhYmxlLCB5ZXQgdGhlIGNhbGxlciB3b3VsZCBoYXZlIGJlZW4gdG9sZCBpdCB3YXMgY3JlYXRlZCBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGAoaXNzdWUgIzExNCBkZWZlY3QgMikuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5czogY2FwdHVyZWRUd2lucyB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHJlZmVyZW5jZUxvc3MgPSB0aGlzLmRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKHRoaXMubGFzdFJlZmVyZW5jZUxvc3Nlcyk7XG4gICAgICAgICAgICBpZiAocmVmZXJlbmNlTG9zcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBmYXRhbDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byB3cml0ZSAke3NhdmVQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkOiBhY3R1YWxQcmVmYWJVdWlkLCBwcmVmYWJQYXRoOiBzYXZlUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIHJlZmVyZW5jZUxvc3NlczogdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgdGhpcy51cGRhdGVBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoLCBKU09OLnN0cmluZ2lmeShwcmVmYWJDb250ZW50LCBudWxsLCAyKSk7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZU1ldGFXaXRoQXNzZXREQihzYXZlUGF0aCwgdGhpcy5jcmVhdGVTdGFuZGFyZE1ldGFDb250ZW50KHByZWZhYk5hbWUsIGFjdHVhbFByZWZhYlV1aWQpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucmVpbXBvcnRBc3NldFdpdGhBc3NldERCKHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgLy8gUmVhZCB0aGUgYXNzZXQgYmFjayBiZWZvcmUgcmVwb3J0aW5nIHN1Y2Nlc3MuIENvbXBvbmVudHMgdGhhdCB3ZXJlXG4gICAgICAgICAgICAvLyBjb25maWd1cmVkIGluIHRoZSBzY2VuZSBidXQgc2VyaWFsaXplZCB0byBhIGJhcmUgZW52ZWxvcGUgYXJlIGEgc2lsZW50XG4gICAgICAgICAgICAvLyBkYXRhIGxvc3MgdGhlIGNhbGxlciBjYW5ub3Qgb3RoZXJ3aXNlIGRldGVjdCAoIzI4KS5cbiAgICAgICAgICAgIGNvbnN0IHJlYWRCYWNrID0gYXdhaXQgdGhpcy5yZWFkQmFja1ByZWZhYihzYXZlUGF0aCwgcHJlZmFiQ29udGVudCk7XG4gICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhyZWFkQmFjay5kYXRhLCBub2RlRGF0YSk7XG4gICAgICAgICAgICBpZiAobG9zdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGZhdGFsOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7c2F2ZVBhdGh9LCBidXQgdGhlc2UgY29tcG9uZW50cyBzZXJpYWxpemVkIHdpdGggbm8gcHJvcGVydGllczogJHtsb3N0LmpvaW4oJywgJyl9LiBUaGUgc2NlbmUgdmFsdWVzIHdlcmUgbm90IGNhcHR1cmVkIOKAlCBkbyBub3QgdXNlIHRoaXMgcHJlZmFiLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLCBjb21wb25lbnRzV2l0aG91dFByb3BlcnRpZXM6IGxvc3QsIHZlcmlmaWVkRnJvbTogcmVhZEJhY2suc291cmNlIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb252ZXJ0UmVzdWx0ID0gYXdhaXQgdGhpcy5jb252ZXJ0Tm9kZVRvUHJlZmFiSW5zdGFuY2Uobm9kZVV1aWQsIGFjdHVhbFByZWZhYlV1aWQsIHNhdmVQYXRoKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZDogYWN0dWFsUHJlZmFiVXVpZCwgcHJlZmFiUGF0aDogc2F2ZVBhdGgsIG5vZGVVdWlkLCBwcmVmYWJOYW1lLFxuICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIC4uLnRoaXMuY29udmVyc2lvbkZhaWx1cmVGaWVsZHMoY29udmVydFJlc3VsdCksXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXNWZXJpZmllZEZyb206IHJlYWRCYWNrLnNvdXJjZSxcbiAgICAgICAgICAgICAgICAgICAgLi4uKHRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW4ubGVuZ3RoID4gMCA/IHsgcHJ1bmVkU3RhbGVDaGlsZHJlbjogWy4uLnRoaXMubGFzdFBydW5lZFN0YWxlQ2hpbGRyZW5dIH0gOiB7fSksXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGNvbnZlcnRSZXN1bHQuc3VjY2VzcyA/ICdQcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gY3JlYXRlIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBjcmVhdGVQcmVmYWJOYXRpdmVTdHViKCk6IGFueSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiAnTmF0aXZlIHByZWZhYiBjcmVhdGlvbiBBUEkgbm90IGF2YWlsYWJsZScsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1RvIGNyZWF0ZSBhIHByZWZhYiBpbiBDb2NvcyBDcmVhdG9yOlxcbjEuIFNlbGVjdCBhIG5vZGUgaW4gdGhlIHNjZW5lXFxuMi4gRHJhZyBpdCB0byB0aGUgQXNzZXQgQnJvd3NlclxcbjMuIE9yIHJpZ2h0LWNsaWNrIHRoZSBub2RlIGFuZCBzZWxlY3QgXCJDcmVhdGUgUHJlZmFiXCInXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgYXN5bmMgY3JlYXRlUHJlZmFiQ3VzdG9tKG5vZGVVdWlkOiBzdHJpbmcsIHByZWZhYlBhdGg6IHN0cmluZywgcHJlZmFiTmFtZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhID0gYXdhaXQgdGhpcy5nZXROb2RlRGF0YShub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIG5vdCBmb3VuZDogJHtub2RlVXVpZH1gIH07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlV1aWQgPSB0aGlzLmdlbmVyYXRlVVVJRCgpO1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiSnNvbkRhdGEgPSBhd2FpdCB0aGlzLmNyZWF0ZVN0YW5kYXJkUHJlZmFiQ29udGVudChub2RlRGF0YSwgcHJlZmFiTmFtZSwgcHJlZmFiVXVpZCwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgICAgICBjb25zdCByZWZlcmVuY2VMb3NzID0gdGhpcy5kZXNjcmliZVJlZmVyZW5jZUxvc3Nlcyh0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMpO1xuICAgICAgICAgICAgaWYgKHJlZmVyZW5jZUxvc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUmVmdXNpbmcgdG8gd3JpdGUgJHtwcmVmYWJQYXRofTogJHtyZWZlcmVuY2VMb3NzfSBUaGUgd3JpdHRlbiBwcmVmYWIgd291bGQgbm90IGJlIGVxdWl2YWxlbnQgdG8gdGhlIHNjZW5lIHN1YnRyZWUg4oCUIHRoaXMgaXMgaXNzdWUgIzczJ3MgYXNzZXQtcmVmZXJlbmNlIGxvc3MuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBwcmVmYWJVdWlkLCBwcmVmYWJQYXRoLCBub2RlVXVpZCwgcHJlZmFiTmFtZSwgcmVmZXJlbmNlTG9zc2VzOiB0aGlzLmxhc3RSZWZlcmVuY2VMb3NzZXMgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBzYXZlUmVzdWx0ID0gYXdhaXQgdGhpcy5zYXZlUHJlZmFiV2l0aE1ldGEocHJlZmFiUGF0aCwgcHJlZmFiSnNvbkRhdGEsIHRoaXMuY3JlYXRlU3RhbmRhcmRNZXRhQ29udGVudChwcmVmYWJOYW1lLCBwcmVmYWJVdWlkKSk7XG5cbiAgICAgICAgICAgIGlmIChzYXZlUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBsb3N0ID0gdGhpcy5maW5kQ29tcG9uZW50c1RoYXRMb3N0UHJvcGVydGllcyhwcmVmYWJKc29uRGF0YSwgbm9kZURhdGEpO1xuICAgICAgICAgICAgICAgIGlmIChsb3N0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZmF0YWw6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB3cml0dGVuIHRvICR7cHJlZmFiUGF0aH0sIGJ1dCB0aGVzZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgd2l0aCBubyBwcm9wZXJ0aWVzOiAke2xvc3Quam9pbignLCAnKX0uIFRoZSBzY2VuZSB2YWx1ZXMgd2VyZSBub3QgY2FwdHVyZWQg4oCUIGRvIG5vdCB1c2UgdGhpcyBwcmVmYWIuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsIGNvbXBvbmVudHNXaXRob3V0UHJvcGVydGllczogbG9zdCB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbnZlcnRSZXN1bHQgPSBhd2FpdCB0aGlzLmNvbnZlcnROb2RlVG9QcmVmYWJJbnN0YW5jZShub2RlVXVpZCwgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZCwgcHJlZmFiUGF0aCwgbm9kZVV1aWQsIHByZWZhYk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBjb252ZXJ0ZWRUb1ByZWZhYkluc3RhbmNlOiBjb252ZXJ0UmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgICAgICAuLi50aGlzLmNvbnZlcnNpb25GYWlsdXJlRmllbGRzKGNvbnZlcnRSZXN1bHQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogY29udmVydFJlc3VsdC5zdWNjZXNzID8gJ0N1c3RvbSBwcmVmYWIgY3JlYXRlZCBhbmQgbm9kZSBjb252ZXJ0ZWQnIDogJ1ByZWZhYiBjcmVhdGVkLCBub2RlIGNvbnZlcnNpb24gZmFpbGVkJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogc2F2ZVJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHNhdmUgcHJlZmFiIGZpbGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gTm9kZSBkYXRhIHJldHJpZXZhbCA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXROb2RlRGF0YShub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdGhpcy5sYXN0UHJ1bmVkU3RhbGVDaGlsZHJlbiA9IFtdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlSW5mbykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5nZXROb2RlV2l0aENoaWxkcmVuKG5vZGVVdWlkKSB8fCBub2RlSW5mbztcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Tm9kZVdpdGhDaGlsZHJlbihub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGlmICghdHJlZSkgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICBjb25zdCB0YXJnZXROb2RlID0gdGhpcy5maW5kTm9kZUluVHJlZSh0cmVlLCBub2RlVXVpZCk7XG4gICAgICAgICAgICByZXR1cm4gdGFyZ2V0Tm9kZSA/IGF3YWl0IHRoaXMuZW5oYW5jZVRyZWVXaXRoTUNQQ29tcG9uZW50cyh0YXJnZXROb2RlKSA6IG51bGw7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmhhbmNlIG5vZGUgdHJlZSB3aXRoIGFjY3VyYXRlIGNvbXBvbmVudCBpbmZvIHZpYSBkaXJlY3QgRWRpdG9yIEFQSS5cbiAgICAgKiBSZXBsYWNlcyBwcmV2aW91cyBIVFRQIHNlbGYtY2FsbCB0byBsb2NhbGhvc3Q6ODU4NSB3aGljaCB3YXMgZnJhZ2lsZSBhbmQgcG9ydC1kZXBlbmRlbnQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBlbmhhbmNlVHJlZVdpdGhNQ1BDb21wb25lbnRzKG5vZGU6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGlmICghbm9kZSB8fCAhbm9kZS51dWlkKSByZXR1cm4gbm9kZTtcbiAgICAgICAgbGV0IGxpdmVDaGlsZFV1aWRzOiBTZXQ8c3RyaW5nPiB8IG51bGwgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZS51dWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSkge1xuICAgICAgICAgICAgICAgIGxpdmVDaGlsZFV1aWRzID0gdGhpcy5saXZlQ2hpbGRVdWlkU2V0KG5vZGVEYXRhKTtcbiAgICAgICAgICAgICAgICAvLyBDYXJyeSB0aGUgdHJhbnNmb3JtIGR1bXAgdGhyb3VnaCBzbyBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUgY2FuIHJlYWRcbiAgICAgICAgICAgICAgICAvLyBwb3NpdGlvbi9yb3RhdGlvbi9zY2FsZSBpbnN0ZWFkIG9mIGZhbGxpbmcgYmFjayB0byBpZGVudGl0eSAoaXNzdWUgIzUwKS5cbiAgICAgICAgICAgICAgICAvLyBUaGUgcXVlcnktbm9kZSBkdW1wIHNoYXBlcyB0aGVzZSBhcyB7IHZhbHVlOiB7IHgsIHksIHogfSB9IChhbmQgdyBmb3IgcXVhdCksXG4gICAgICAgICAgICAgICAgLy8gd2hpY2ggaXMgZXhhY3RseSB0aGUgc2hhcGUgY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIHJlYWRzIHZpYSBub2RlRGF0YS5wb3NpdGlvbj8udmFsdWUuXG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLnBvc2l0aW9uKSBub2RlLnBvc2l0aW9uID0gbm9kZURhdGEucG9zaXRpb247XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLnJvdGF0aW9uKSBub2RlLnJvdGF0aW9uID0gbm9kZURhdGEucm90YXRpb247XG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLnNjYWxlKSBub2RlLnNjYWxlID0gbm9kZURhdGEuc2NhbGU7XG4gICAgICAgICAgICAgICAgLy8gVGhlIGxheWVyIGlzIGNhcnJpZWQgZm9yIHRoZSBzYW1lIHJlYXNvbjogY3JlYXRlRW5naW5lU3RhbmRhcmROb2RlIGhhcmRjb2RlZFxuICAgICAgICAgICAgICAgIC8vIERFRkFVTFQsIHNvIGV2ZXJ5IG5vZGUgb2YgYSBjcmVhdGVkIHByZWZhYiBsYW5kZWQgb24gdGhlIERFRkFVTFQgbGF5ZXIgYW5kIGFcbiAgICAgICAgICAgICAgICAvLyBVSSBwcmVmYWIgKFVJXzJEKSB3YXMgY3VsbGVkIGJ5IHRoZSBVSSBjYW1lcmEg4oCUIGl0IHJlbmRlcmVkIG5vdGhpbmcuXG4gICAgICAgICAgICAgICAgaWYgKG5vZGVEYXRhLmxheWVyICE9PSB1bmRlZmluZWQpIG5vZGUubGF5ZXIgPSBub2RlRGF0YS5sYXllcjtcbiAgICAgICAgICAgICAgICBpZiAobm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGBwcm9wZXJ0aWVzYCBjYXJyaWVzIHRoZSBsaXZlIHByb3BlcnR5IGR1bXAgdGhyb3VnaCB0byBzZXJpYWxpemF0aW9uLlxuICAgICAgICAgICAgICAgICAgICAvLyBSZWR1Y2luZyBlYWNoIGNvbXBvbmVudCB0byB0eXBlL3V1aWQvZW5hYmxlZCBkaXNjYXJkZWQgZXZlcnkgY29uZmlndXJlZFxuICAgICAgICAgICAgICAgICAgICAvLyB2YWx1ZSBiZWZvcmUgaXQgY291bGQgYmUgd3JpdHRlbiwgc28gYGFjdGlvbj1jcmVhdGVgIHNhdmVkIGVuZ2luZVxuICAgICAgICAgICAgICAgICAgICAvLyBkZWZhdWx0cyBmb3IgZXZlcnkgY29tcG9uZW50IHR5cGUgKCMyOCkuXG4gICAgICAgICAgICAgICAgICAgIG5vZGUuY29tcG9uZW50cyA9IG5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRoZSBkdW1wIG5lc3RzIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCB1bmRlciB2YWx1ZS51dWlkLnZhbHVlOyB0aGVcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvcC1sZXZlbCBjb21wLnV1aWQgZG9lcyBub3QgZXhpc3QgKHNhbWUgc2hhcGUgTWFuYWdlQ29tcG9uZW50LmdldENvbXBvbmVudHNcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFscmVhZHkgYWNjb3VudHMgZm9yKS4gUmVhZGluZyBvbmx5IGNvbXAudXVpZCBsZWZ0IGNvbXBvbmVudFV1aWRUb0luZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBwZXJtYW5lbnRseSBlbXB0eSwgc28gZXZlcnkgY3Jvc3MtY29tcG9uZW50IHJlZmVyZW5jZSBvbiBhIGNyZWF0ZWQgcHJlZmFiXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAoZS5nLiBhIHNjcmlwdCdzIEBwcm9wZXJ0eShNZXNoUmVuZGVyZXIpL0Bwcm9wZXJ0eShMYWJlbCkgZmllbGQgcG9pbnRpbmcgYXRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGEgZGVzY2VuZGFudCBub2RlJ3MgY29tcG9uZW50KSBzaWxlbnRseSBzZXJpYWxpemVkIGFzIG51bGwuXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wLmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogZXh0cmFjdENvbXBvbmVudFByb3BlcnR5RHVtcChjb21wKVxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBOb2RlICR7bm9kZS51dWlkfSBlbmhhbmNlZCB3aXRoICR7bm9kZS5jb21wb25lbnRzLmxlbmd0aH0gY29tcG9uZW50cyAoaW5jbC4gc2NyaXB0IHR5cGVzKWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgRmFpbGVkIHRvIGdldCBjb21wb25lbnQgaW5mbyBmb3Igbm9kZSAke25vZGUudXVpZH06YCwgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmNoaWxkcmVuICYmIEFycmF5LmlzQXJyYXkobm9kZS5jaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGlmIChsaXZlQ2hpbGRVdWlkcykge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM3MzogYHF1ZXJ5LW5vZGUtdHJlZWAgY2FuIHN0aWxsIGxpc3QgYSBjaGlsZCB0aGF0IGBtYW5hZ2Vfbm9kZSBkZWxldGVgXG4gICAgICAgICAgICAgICAgLy8gYWxyZWFkeSByZW1vdmVkIChzZWVuIG9uIGEgbGlua2VkIHByZWZhYiBpbnN0YW5jZSksIHNvIHRoZSBjcmVhdGVkIHByZWZhYlxuICAgICAgICAgICAgICAgIC8vIHJlc3VycmVjdGVkIGl0LiBUaGUgbm9kZSdzIG93biBgcXVlcnktbm9kZWAgZHVtcCBpcyB0aGUgbGl2ZSBjaGlsZCBzZXQ7IGFcbiAgICAgICAgICAgICAgICAvLyB0cmVlIGNoaWxkIGFic2VudCBmcm9tIGl0IGlzIHN0YWxlIGFuZCBpcyBub3Qgc2VyaWFsaXplZC5cbiAgICAgICAgICAgICAgICBjb25zdCBrZXB0OiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjaGlsZFV1aWQgPSB0aGlzLmV4dHJhY3ROb2RlVXVpZChjaGlsZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGlsZFV1aWQgJiYgIWxpdmVDaGlsZFV1aWRzLmhhcyhjaGlsZFV1aWQpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmxhc3RQcnVuZWRTdGFsZUNoaWxkcmVuLnB1c2goY2hpbGRVdWlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgRHJvcHBpbmcgY2hpbGQgJHtjaGlsZFV1aWR9IG9mICR7bm9kZS51dWlkfTogbGlzdGVkIGJ5IHF1ZXJ5LW5vZGUtdHJlZSBidXQgYWJzZW50IGZyb20gdGhlIG5vZGUncyBsaXZlIGNoaWxkcmVuYCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBrZXB0LnB1c2goY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuID0ga2VwdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZS5jaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW5baV0gPSBhd2FpdCB0aGlzLmVuaGFuY2VUcmVlV2l0aE1DUENvbXBvbmVudHMobm9kZS5jaGlsZHJlbltpXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIHV1aWRzIG9mIGEgbm9kZSdzIGxpdmUgY2hpbGRyZW4gYXMgaXRzIG93biBgcXVlcnktbm9kZWAgZHVtcCByZXBvcnRzIHRoZW0sIG9yIG51bGxcbiAgICAgKiB3aGVuIHRoZSBkdW1wIGRvZXMgbm90IGNhcnJ5IGEgcmVhZGFibGUgY2hpbGQgbGlzdCDigJQgYW4gdW5yZWFkYWJsZSBsaXN0IHByb3ZlcyBub3RoaW5nLFxuICAgICAqIHNvIHRoZSBjYWxsZXIga2VlcHMgZXZlcnkgdHJlZSBjaGlsZCByYXRoZXIgdGhhbiBwcnVuaW5nIG9uIGEgZ3Vlc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBsaXZlQ2hpbGRVdWlkU2V0KG5vZGVEYXRhOiBhbnkpOiBTZXQ8c3RyaW5nPiB8IG51bGwge1xuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkobm9kZURhdGE/LmNoaWxkcmVuKSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IHV1aWRzID0gbm9kZURhdGEuY2hpbGRyZW4ubWFwKChjOiBhbnkpID0+IGNoaWxkVXVpZE9mKGMpKTtcbiAgICAgICAgaWYgKHV1aWRzLnNvbWUoKHU6IHN0cmluZykgPT4gIXUpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIG5ldyBTZXQ8c3RyaW5nPih1dWlkcyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBmaW5kTm9kZUluVHJlZShub2RlOiBhbnksIHRhcmdldFV1aWQ6IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGlmICghbm9kZSkgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmIChub2RlLnV1aWQgPT09IHRhcmdldFV1aWQgfHwgbm9kZS52YWx1ZT8udXVpZCA9PT0gdGFyZ2V0VXVpZCkgcmV0dXJuIG5vZGU7XG4gICAgICAgIGlmIChub2RlLmNoaWxkcmVuICYmIEFycmF5LmlzQXJyYXkobm9kZS5jaGlsZHJlbikpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kTm9kZUluVHJlZShjaGlsZCwgdGFyZ2V0VXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRDaGlsZHJlblRvUHJvY2Vzcyhub2RlRGF0YTogYW55KTogYW55W10ge1xuICAgICAgICBjb25zdCBjaGlsZHJlbjogYW55W10gPSBbXTtcbiAgICAgICAgaWYgKG5vZGVEYXRhLmNoaWxkcmVuICYmIEFycmF5LmlzQXJyYXkobm9kZURhdGEuY2hpbGRyZW4pKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGVEYXRhLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuaXNWYWxpZE5vZGVEYXRhKGNoaWxkKSkgY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNWYWxpZE5vZGVEYXRhKG5vZGVEYXRhOiBhbnkpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCFub2RlRGF0YSB8fCB0eXBlb2Ygbm9kZURhdGEgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBub2RlRGF0YS5oYXNPd25Qcm9wZXJ0eSgndXVpZCcpIHx8IG5vZGVEYXRhLmhhc093blByb3BlcnR5KCduYW1lJykgfHwgbm9kZURhdGEuaGFzT3duUHJvcGVydHkoJ19fdHlwZV9fJykgfHxcbiAgICAgICAgICAgIChub2RlRGF0YS52YWx1ZSAmJiAobm9kZURhdGEudmFsdWUuaGFzT3duUHJvcGVydHkoJ3V1aWQnKSB8fCBub2RlRGF0YS52YWx1ZS5oYXNPd25Qcm9wZXJ0eSgnbmFtZScpIHx8IG5vZGVEYXRhLnZhbHVlLmhhc093blByb3BlcnR5KCdfX3R5cGVfXycpKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHRyYWN0Tm9kZVV1aWQobm9kZURhdGE6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlRGF0YS51dWlkID09PSAnc3RyaW5nJykgcmV0dXJuIG5vZGVEYXRhLnV1aWQ7XG4gICAgICAgIGlmIChub2RlRGF0YS52YWx1ZSAmJiB0eXBlb2Ygbm9kZURhdGEudmFsdWUudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBub2RlRGF0YS52YWx1ZS51dWlkO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBQcmVmYWIgc2VyaWFsaXphdGlvbiA9PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnQobm9kZURhdGE6IGFueSwgcHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcsIGluY2x1ZGVDaGlsZHJlbjogYm9vbGVhbiwgaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4pOiBQcm9taXNlPGFueVtdPiB7XG4gICAgICAgIGNvbnN0IHByZWZhYkRhdGE6IGFueVtdID0gW107XG4gICAgICAgIHByZWZhYkRhdGEucHVzaCh7XG4gICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuUHJlZmFiXCIsIFwiX25hbWVcIjogcHJlZmFiTmFtZSB8fCBcIlwiLCBcIl9vYmpGbGFnc1wiOiAwLCBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICBcIl9uYXRpdmVcIjogXCJcIiwgXCJkYXRhXCI6IHsgXCJfX2lkX19cIjogMSB9LCBcIm9wdGltaXphdGlvblBvbGljeVwiOiAwLCBcInBlcnNpc3RlbnRcIjogZmFsc2VcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY29udGV4dCA9IHtcbiAgICAgICAgICAgIHByZWZhYkRhdGEsIGN1cnJlbnRJZDogMiwgcHJlZmFiQXNzZXRJbmRleDogMCxcbiAgICAgICAgICAgIG5vZGVGaWxlSWRzOiBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpLFxuICAgICAgICAgICAgbm9kZVV1aWRUb0luZGV4OiBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpLFxuICAgICAgICAgICAgY29tcG9uZW50VXVpZFRvSW5kZXg6IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCksXG4gICAgICAgICAgICBsb3NzZXM6IFtdIGFzIEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PixcbiAgICAgICAgICAgIGRlZmVycmVkQ29tcG9uZW50czogW10gYXMgRGVmZXJyZWRDb21wb25lbnRbXVxuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IHRoaXMuY3JlYXRlQ29tcGxldGVOb2RlVHJlZShub2RlRGF0YSwgbnVsbCwgMSwgY29udGV4dCwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cywgcHJlZmFiTmFtZSk7XG4gICAgICAgIC8vIFBhc3MgMiAoIzE0Nyk6IGV2ZXJ5IG5vZGUgYW5kIGNvbXBvbmVudCBpbmRleCBpcyByZWdpc3RlcmVkIG5vdywgc28gYSBwcm9wZXJ0eSB0aGF0XG4gICAgICAgIC8vIHJlZmVyZW5jZXMgc29tZXRoaW5nIHZpc2l0ZWQgTEFURVIgaW4gdGhlIHdhbGsgKGEgY2hpbGQgcG9pbnRpbmcgYXQgaXRzIHBhcmVudCdzXG4gICAgICAgIC8vIGNvbXBvbmVudCwgYSBsYXRlciBzaWJsaW5nLCBhIGxhdGVyIGNvbXBvbmVudCBvbiB0aGUgc2FtZSBub2RlKSByZXNvbHZlcyB0byBhXG4gICAgICAgIC8vIGB7X19pZF9ffWAgaW5zdGVhZCBvZiBhbiB1bnJlc29sdmVkIGxvc3MuXG4gICAgICAgIGZvciAoY29uc3QgZGVmZXJyZWQgb2YgY29udGV4dC5kZWZlcnJlZENvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudE9iaiA9IHRoaXMuY3JlYXRlQ29tcG9uZW50T2JqZWN0KGRlZmVycmVkLmNvbXBvbmVudCwgZGVmZXJyZWQubm9kZUluZGV4LCBjb250ZXh0KTtcbiAgICAgICAgICAgIHByZWZhYkRhdGFbZGVmZXJyZWQuY29tcG9uZW50SW5kZXhdID0gY29tcG9uZW50T2JqO1xuICAgICAgICAgICAgaWYgKGNvbXBvbmVudE9iaiAmJiB0eXBlb2YgY29tcG9uZW50T2JqID09PSAnb2JqZWN0JykgY29tcG9uZW50T2JqLl9fcHJlZmFiID0geyBcIl9faWRfX1wiOiBkZWZlcnJlZC5jb21wUHJlZmFiSW5mb0luZGV4IH07XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5sYXN0UmVmZXJlbmNlTG9zc2VzID0gY29udGV4dC5sb3NzZXM7XG4gICAgICAgIHJldHVybiBwcmVmYWJEYXRhO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZmVyZW5jZXMgdGhlIG1vc3QgcmVjZW50IGBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnRgIGNhbGwgY291bGQgbm90IHNlcmlhbGl6ZS5cbiAgICAgKlxuICAgICAqIFRoZSBjcmVhdGUgcGF0aHMgYXJlIHBsYWluIGZ1bmN0aW9ucyByZXR1cm5pbmcgdGhlIHByZWZhYiBKU09OLCBzbyBhIGxvc3MgY2Fubm90IGJlXG4gICAgICogdGhyb3duIGZyb20gd2hlcmUgaXQgaXMgZGV0ZWN0ZWQgd2l0aG91dCBhYmFuZG9uaW5nIGEgdmFsaWQgYGZhdGFsYCBmYWlsdXJlIHJlcG9ydC5cbiAgICAgKiBCb3RoIGNyZWF0ZSBwYXRocyByZWFkIHRoaXMgaW1tZWRpYXRlbHkgYWZ0ZXIgc2VyaWFsaXppbmcgYW5kIGZhaWwgb24gYSBub24tZW1wdHlcbiAgICAgKiBsaXN0IOKAlCB0aGUgc2FtZSBjb250cmFjdCBhcyB0aGUgZXhpc3RpbmcgYGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzYCBjaGVjay5cbiAgICAgKi9cbiAgICBwcml2YXRlIGxhc3RSZWZlcmVuY2VMb3NzZXM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgLyoqIENoaWxkcmVuIGBxdWVyeS1ub2RlLXRyZWVgIGxpc3RlZCB0aGF0IHRoZSBub2RlJ3MgbGl2ZSBgcXVlcnktbm9kZWAgZHVtcCBkaWQgbm90IChpc3N1ZSAjNzMpLiBSZXNldCBwZXIgY2FwdHVyZS4gKi9cbiAgICBwcml2YXRlIGxhc3RQcnVuZWRTdGFsZUNoaWxkcmVuOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVDb21wbGV0ZU5vZGVUcmVlKFxuICAgICAgICBub2RlRGF0YTogYW55LCBwYXJlbnROb2RlSW5kZXg6IG51bWJlciB8IG51bGwsIG5vZGVJbmRleDogbnVtYmVyLFxuICAgICAgICBjb250ZXh0OiB7IHByZWZhYkRhdGE6IGFueVtdOyBjdXJyZW50SWQ6IG51bWJlcjsgcHJlZmFiQXNzZXRJbmRleDogbnVtYmVyOyBub2RlRmlsZUlkczogTWFwPHN0cmluZywgc3RyaW5nPjsgbm9kZVV1aWRUb0luZGV4OiBNYXA8c3RyaW5nLCBudW1iZXI+OyBjb21wb25lbnRVdWlkVG9JbmRleDogTWFwPHN0cmluZywgbnVtYmVyPjsgbG9zc2VzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHV1aWQ6IHN0cmluZzsgcmVhc29uOiBzdHJpbmcgfT47IGRlZmVycmVkQ29tcG9uZW50czogRGVmZXJyZWRDb21wb25lbnRbXSB9LFxuICAgICAgICBpbmNsdWRlQ2hpbGRyZW46IGJvb2xlYW4sIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuLCBub2RlTmFtZT86IHN0cmluZ1xuICAgICk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCB7IHByZWZhYkRhdGEgfSA9IGNvbnRleHQ7XG4gICAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmNyZWF0ZUVuZ2luZVN0YW5kYXJkTm9kZShub2RlRGF0YSwgcGFyZW50Tm9kZUluZGV4LCBub2RlTmFtZSk7XG5cbiAgICAgICAgd2hpbGUgKHByZWZhYkRhdGEubGVuZ3RoIDw9IG5vZGVJbmRleCkgcHJlZmFiRGF0YS5wdXNoKG51bGwpO1xuICAgICAgICBwcmVmYWJEYXRhW25vZGVJbmRleF0gPSBub2RlO1xuXG4gICAgICAgIGNvbnN0IG5vZGVVdWlkID0gdGhpcy5leHRyYWN0Tm9kZVV1aWQobm9kZURhdGEpO1xuICAgICAgICBjb25zdCBmaWxlSWQgPSBub2RlVXVpZCB8fCB0aGlzLmdlbmVyYXRlRmlsZUlkKCk7XG4gICAgICAgIGNvbnRleHQubm9kZUZpbGVJZHMuc2V0KG5vZGVJbmRleC50b1N0cmluZygpLCBmaWxlSWQpO1xuICAgICAgICBpZiAobm9kZVV1aWQpIGNvbnRleHQubm9kZVV1aWRUb0luZGV4LnNldChub2RlVXVpZCwgbm9kZUluZGV4KTtcblxuICAgICAgICBjb25zdCBjaGlsZHJlblRvUHJvY2VzcyA9IHRoaXMuZ2V0Q2hpbGRyZW5Ub1Byb2Nlc3Mobm9kZURhdGEpO1xuICAgICAgICBpZiAoaW5jbHVkZUNoaWxkcmVuICYmIGNoaWxkcmVuVG9Qcm9jZXNzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kaWNlczogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBjaGlsZEluZGljZXMucHVzaChjaGlsZEluZGV4KTtcbiAgICAgICAgICAgICAgICBub2RlLl9jaGlsZHJlbi5wdXNoKHsgXCJfX2lkX19cIjogY2hpbGRJbmRleCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2hpbGRyZW5Ub1Byb2Nlc3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmNyZWF0ZUNvbXBsZXRlTm9kZVRyZWUoXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuVG9Qcm9jZXNzW2ldLCBub2RlSW5kZXgsIGNoaWxkSW5kaWNlc1tpXSwgY29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50cywgY2hpbGRyZW5Ub1Byb2Nlc3NbaV0ubmFtZSB8fCBgQ2hpbGQke2kgKyAxfWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzICYmIG5vZGVEYXRhLmNvbXBvbmVudHMgJiYgQXJyYXkuaXNBcnJheShub2RlRGF0YS5jb21wb25lbnRzKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wb25lbnQgb2Ygbm9kZURhdGEuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBub2RlLl9jb21wb25lbnRzLnB1c2goeyBcIl9faWRfX1wiOiBjb21wb25lbnRJbmRleCB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gY29tcG9uZW50LnV1aWQgfHwgKGNvbXBvbmVudC52YWx1ZSAmJiBjb21wb25lbnQudmFsdWUudXVpZCk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudFV1aWQpIGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguc2V0KGNvbXBvbmVudFV1aWQsIGNvbXBvbmVudEluZGV4KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wUHJlZmFiSW5mb0luZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgICAgICAgICBwcmVmYWJEYXRhW2NvbXBQcmVmYWJJbmZvSW5kZXhdID0geyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29tcFByZWZhYkluZm9cIiwgXCJmaWxlSWRcIjogdGhpcy5nZW5lcmF0ZUZpbGVJZCgpIH07XG4gICAgICAgICAgICAgICAgLy8gVGhlIHNsb3QgaXMgcmVzZXJ2ZWQgaGVyZTsgdGhlIGNvbXBvbmVudCBib2R5IChhbmQgc28gaXRzIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIC8vIHByb3BlcnRpZXMpIGlzIHNlcmlhbGl6ZWQgaW4gcGFzcyAyIOKAlCBzZWUgY3JlYXRlU3RhbmRhcmRQcmVmYWJDb250ZW50LlxuICAgICAgICAgICAgICAgIHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdID0gbnVsbDtcbiAgICAgICAgICAgICAgICBjb250ZXh0LmRlZmVycmVkQ29tcG9uZW50cy5wdXNoKHsgY29tcG9uZW50LCBub2RlSW5kZXgsIGNvbXBvbmVudEluZGV4LCBjb21wUHJlZmFiSW5mb0luZGV4IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gY29udGV4dC5jdXJyZW50SWQrKztcbiAgICAgICAgbm9kZS5fcHJlZmFiID0geyBcIl9faWRfX1wiOiBwcmVmYWJJbmZvSW5kZXggfTtcbiAgICAgICAgcHJlZmFiRGF0YVtwcmVmYWJJbmZvSW5kZXhdID0ge1xuICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlByZWZhYkluZm9cIiwgXCJyb290XCI6IHsgXCJfX2lkX19cIjogMSB9LCBcImFzc2V0XCI6IHsgXCJfX2lkX19cIjogY29udGV4dC5wcmVmYWJBc3NldEluZGV4IH0sXG4gICAgICAgICAgICBcImZpbGVJZFwiOiBmaWxlSWQsIFwidGFyZ2V0T3ZlcnJpZGVzXCI6IG51bGwsIFwibmVzdGVkUHJlZmFiSW5zdGFuY2VSb290c1wiOiBudWxsLCBcImluc3RhbmNlXCI6IG51bGxcbiAgICAgICAgfTtcbiAgICAgICAgY29udGV4dC5jdXJyZW50SWQgPSBwcmVmYWJJbmZvSW5kZXggKyAxO1xuICAgIH1cblxuICAgIC8qKiBgY2MuTGF5ZXJzLkVudW0uREVGQVVMVGAgKDEgPDwgMzApIOKAlCB0aGUgZmFsbGJhY2sgd2hlbiBhIG5vZGUgZHVtcCBjYXJyaWVzIG5vIGxheWVyLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERFRkFVTFRfTEFZRVIgPSAxMDczNzQxODI0O1xuXG4gICAgLyoqXG4gICAgICogRXVsZXIgYW5nbGVzIGluIERFR1JFRVMgdG8gYSBxdWF0ZXJuaW9uLCBtYXRjaGluZyBgY2MuUXVhdC5mcm9tRXVsZXJgIGV4YWN0bHkuXG4gICAgICogVmVyaWZpZWQgYWdhaW5zdCBDb2NvcyBDcmVhdG9yIDMuOC43OiBldWxlciAoMTAsIDIwLCAzMCkgc2VyaWFsaXplcyBhc1xuICAgICAqICgwLjEyNzY3OTQ0MDY5NTc4MDYzLCAwLjE4OTMwNzg1NzQxMTk5OTk5LCAwLjIzOTI5ODMzNzc0NDczMDMsIDAuOTQzNzE0MzY0MTQ3NDg5KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBldWxlckRlZ3JlZXNUb1F1YXQoZTogYW55KTogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyB3OiBudW1iZXIgfSB7XG4gICAgICAgIGNvbnN0IGhhbGZUb1JhZCA9IDAuNSAqIE1hdGguUEkgLyAxODA7XG4gICAgICAgIGNvbnN0IHggPSAoZS54IHx8IDApICogaGFsZlRvUmFkLCB5ID0gKGUueSB8fCAwKSAqIGhhbGZUb1JhZCwgeiA9IChlLnogfHwgMCkgKiBoYWxmVG9SYWQ7XG4gICAgICAgIGNvbnN0IHN4ID0gTWF0aC5zaW4oeCksIGN4ID0gTWF0aC5jb3MoeCk7XG4gICAgICAgIGNvbnN0IHN5ID0gTWF0aC5zaW4oeSksIGN5ID0gTWF0aC5jb3MoeSk7XG4gICAgICAgIGNvbnN0IHN6ID0gTWF0aC5zaW4oeiksIGN6ID0gTWF0aC5jb3Moeik7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiBzeCAqIGN5ICogY3ogKyBjeCAqIHN5ICogc3osXG4gICAgICAgICAgICB5OiBjeCAqIHN5ICogY3ogKyBzeCAqIGN5ICogc3osXG4gICAgICAgICAgICB6OiBjeCAqIGN5ICogc3ogLSBzeCAqIHN5ICogY3osXG4gICAgICAgICAgICB3OiBjeCAqIGN5ICogY3ogLSBzeCAqIHN5ICogc3osXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVFbmdpbmVTdGFuZGFyZE5vZGUobm9kZURhdGE6IGFueSwgcGFyZW50Tm9kZUluZGV4OiBudW1iZXIgfCBudWxsLCBub2RlTmFtZT86IHN0cmluZyk6IGFueSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBub2RlTmFtZSB8fCBub2RlRGF0YS5uYW1lPy52YWx1ZSB8fCBub2RlRGF0YS5uYW1lIHx8ICdOb2RlJztcbiAgICAgICAgY29uc3QgbHBvcyA9IG5vZGVEYXRhLnBvc2l0aW9uPy52YWx1ZSB8fCBub2RlRGF0YS5scG9zPy52YWx1ZSB8fCBub2RlRGF0YS5fbHBvcyB8fCB7IHg6IDAsIHk6IDAsIHo6IDAgfTtcbiAgICAgICAgY29uc3Qgcm90RHVtcCA9IG5vZGVEYXRhLnJvdGF0aW9uPy52YWx1ZSB8fCBub2RlRGF0YS5scm90Py52YWx1ZSB8fCBub2RlRGF0YS5fbHJvdCB8fCB7IHg6IDAsIHk6IDAsIHo6IDAsIHc6IDEgfTtcbiAgICAgICAgLy8gYHF1ZXJ5LW5vZGVgIHJlcG9ydHMgcm90YXRpb24gYXMgRVVMRVIgREVHUkVFUyAoY2MuVmVjMywgbm8gYHdgKSDigJQgdGhlIHZhbHVlIHRoZVxuICAgICAgICAvLyBpbnNwZWN0b3IncyBSb3RhdGlvbiBmaWVsZCBzaG93cy4gYF9scm90YCBpcyBhIHF1YXRlcm5pb24sIHNvIHBhc3NpbmcgdGhlIGR1bXBcbiAgICAgICAgLy8gc3RyYWlnaHQgdGhyb3VnaCBzdG9yZWQgYSBkZWdyZWUgaW4gYSBxdWF0ZXJuaW9uIGNvbXBvbmVudDogYSAtMC4xIGRlZ3JlZSB0aWx0IHdhc1xuICAgICAgICAvLyB3cml0dGVuIGFzIHt6OiAtMC4xLCB3OiAxfSwgd2hpY2ggdGhlIGVuZ2luZSByZWFkcyBiYWNrIGFzIHJvdWdobHkgLTExLjQ2IGRlZ3JlZXMuXG4gICAgICAgIGNvbnN0IGlzUXVhdCA9IHJvdER1bXAudyAhPT0gdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBscm90ID0gaXNRdWF0ID8gcm90RHVtcCA6IFByZWZhYkNyZWF0aW9uU2VydmljZS5ldWxlckRlZ3JlZXNUb1F1YXQocm90RHVtcCk7XG4gICAgICAgIGNvbnN0IGV1bGVyID0gaXNRdWF0ID8geyB4OiAwLCB5OiAwLCB6OiAwIH0gOiByb3REdW1wO1xuICAgICAgICBjb25zdCBsc2NhbGUgPSBub2RlRGF0YS5zY2FsZT8udmFsdWUgfHwgbm9kZURhdGEubHNjYWxlPy52YWx1ZSB8fCBub2RlRGF0YS5fbHNjYWxlIHx8IHsgeDogMSwgeTogMSwgejogMSB9O1xuICAgICAgICBjb25zdCBsYXllckR1bXAgPSBub2RlRGF0YS5sYXllcj8udmFsdWUgIT09IHVuZGVmaW5lZCA/IG5vZGVEYXRhLmxheWVyLnZhbHVlIDogbm9kZURhdGEubGF5ZXI7XG4gICAgICAgIGNvbnN0IGxheWVyID0gdHlwZW9mIGxheWVyRHVtcCA9PT0gJ251bWJlcicgPyBsYXllckR1bXAgOiBQcmVmYWJDcmVhdGlvblNlcnZpY2UuREVGQVVMVF9MQVlFUjtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5Ob2RlXCIsIFwiX25hbWVcIjogbmFtZSwgXCJfb2JqRmxhZ3NcIjogMCwgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgXCJfcGFyZW50XCI6IHBhcmVudE5vZGVJbmRleCAhPT0gbnVsbCA/IHsgXCJfX2lkX19cIjogcGFyZW50Tm9kZUluZGV4IH0gOiBudWxsLFxuICAgICAgICAgICAgXCJfY2hpbGRyZW5cIjogW10sIFwiX2FjdGl2ZVwiOiBub2RlRGF0YS5hY3RpdmUgIT09IGZhbHNlLCBcIl9jb21wb25lbnRzXCI6IFtdLCBcIl9wcmVmYWJcIjogbnVsbCxcbiAgICAgICAgICAgIFwiX2xwb3NcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogbHBvcy54IHx8IDAsIFwieVwiOiBscG9zLnkgfHwgMCwgXCJ6XCI6IGxwb3MueiB8fCAwIH0sXG4gICAgICAgICAgICBcIl9scm90XCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlF1YXRcIiwgXCJ4XCI6IGxyb3QueCB8fCAwLCBcInlcIjogbHJvdC55IHx8IDAsIFwielwiOiBscm90LnogfHwgMCwgXCJ3XCI6IGxyb3QudyAhPT0gdW5kZWZpbmVkID8gbHJvdC53IDogMSB9LFxuICAgICAgICAgICAgXCJfbHNjYWxlXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IGxzY2FsZS54ICE9PSB1bmRlZmluZWQgPyBsc2NhbGUueCA6IDEsIFwieVwiOiBsc2NhbGUueSAhPT0gdW5kZWZpbmVkID8gbHNjYWxlLnkgOiAxLCBcInpcIjogbHNjYWxlLnogIT09IHVuZGVmaW5lZCA/IGxzY2FsZS56IDogMSB9LFxuICAgICAgICAgICAgXCJfbW9iaWxpdHlcIjogMCwgXCJfbGF5ZXJcIjogbGF5ZXIsXG4gICAgICAgICAgICBcIl9ldWxlclwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiBldWxlci54IHx8IDAsIFwieVwiOiBldWxlci55IHx8IDAsIFwielwiOiBldWxlci56IHx8IDAgfSwgXCJfaWRcIjogXCJcIlxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNlcmlhbGl6ZSBvbmUgY29tcG9uZW50LlxuICAgICAqXG4gICAgICogVGhlIGNhcHR1cmVkIGR1bXAgaXMgdGhlIHNvdXJjZSBvZiB0cnV0aCBmb3IgZXZlcnkgY29tcG9uZW50IHR5cGUuIFRoZSBwZXItdHlwZVxuICAgICAqIHRhYmxlcyBiZWxvdyBvbmx5IGZpbGwgaW4ga2V5cyB0aGUgZHVtcCBkaWQgbm90IGNhcnJ5IOKAlCB0aGV5IHVzZWQgdG8gcnVuICppbnN0ZWFkKlxuICAgICAqIG9mIHRoZSBkdW1wLCB3aGljaCBzaWxlbnRseSB3cm90ZSBlbmdpbmUgZGVmYXVsdHMgZm9yIGBjYy5VSVRyYW5zZm9ybWAsXG4gICAgICogYGNjLlNwcml0ZWAsIGBjYy5CdXR0b25gIGFuZCBgY2MuTGFiZWxgLCBhbmQgd3JvdGUgbm90aGluZyBhdCBhbGwgZm9yIGV2ZXJ5IG90aGVyXG4gICAgICogdHlwZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNyZWF0ZUNvbXBvbmVudE9iamVjdChjb21wb25lbnREYXRhOiBhbnksIG5vZGVJbmRleDogbnVtYmVyLCBjb250ZXh0PzogYW55KTogYW55IHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGNvbXBvbmVudERhdGEudHlwZSB8fCBjb21wb25lbnREYXRhLl9fdHlwZV9fIHx8ICdjYy5Db21wb25lbnQnO1xuICAgICAgICBjb25zdCBlbmFibGVkID0gY29tcG9uZW50RGF0YS5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wb25lbnREYXRhLmVuYWJsZWQgOiB0cnVlO1xuICAgICAgICBjb25zdCBjb21wb25lbnQ6IGFueSA9IHtcbiAgICAgICAgICAgIFwiX190eXBlX19cIjogY29tcG9uZW50VHlwZSwgXCJfbmFtZVwiOiBcIlwiLCBcIl9vYmpGbGFnc1wiOiAwLCBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICBcIm5vZGVcIjogeyBcIl9faWRfX1wiOiBub2RlSW5kZXggfSwgXCJfZW5hYmxlZFwiOiBlbmFibGVkLCBcIl9fcHJlZmFiXCI6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICBjb25zdCBwcm9wZXJ0aWVzID0gY29tcG9uZW50RGF0YS5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICBjb25zdCByZW5hbWVzID0gRFVNUF9LRVlfUkVOQU1FU1tjb21wb25lbnRUeXBlXSB8fCB7fTtcblxuICAgICAgICAvLyBEcm9wIGV2ZXJ5IGFjY2Vzc29yIGtleSB0aGF0IGhhcyBpdHMgc2VyaWFsaXplZCB0d2luIHJpZ2h0IHRoZXJlIGluIHRoZSBzYW1lIGR1bXBcbiAgICAgICAgLy8gKCMxMTQgZGVmZWN0IDIpLiBUaGUgdW5kZXJzY29yZSBzcGVsbGluZyBpcyB0aGUgb25lIHRoZSBlbmdpbmUgcmVhZHMgYmFjazsga2VlcGluZ1xuICAgICAgICAvLyBib3RoIGlzIHdoYXQgbWFkZSB0aGUgaW1wb3J0ZXIgcmVqZWN0IHRoZSBmaWxlLiBDb21wdXRlZCBvbmNlLCB1cCBmcm9udCwgc28gdGhlXG4gICAgICAgIC8vIHJlbmFtZS10YWJsZSBicmFuY2hlcyBiZWxvdyBjYW5ub3QgcmVpbnRyb2R1Y2UgYSBrZXkgdGhpcyByZW1vdmVkLlxuICAgICAgICBjb25zdCBhY2Nlc3NvclR3aW5zID0gbmV3IFNldChmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlLCBwcm9wZXJ0aWVzKSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMocHJvcGVydGllcykpIHtcbiAgICAgICAgICAgIGlmIChEVU1QX0tFWVNfTk9UX1NFUklBTElaRUQuaGFzKGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGFjY2Vzc29yVHdpbnMuaGFzKGtleSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgcHJvcFZhbHVlID0gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkodmFsdWUsIGNvbnRleHQsIGAke3JlbmFtZXNba2V5XSB8fCBrZXl9YCk7XG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlICE9PSB1bmRlZmluZWQpIGNvbXBvbmVudFtyZW5hbWVzW2tleV0gfHwga2V5XSA9IHByb3BWYWx1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgZmFsbGJhY2tdIG9mIE9iamVjdC5lbnRyaWVzKENPTVBPTkVOVF9ERUZBVUxUU1tjb21wb25lbnRUeXBlXSB8fCB7fSkpIHtcbiAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwga2V5KSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudFtrZXldID0gdHlwZW9mIGZhbGxiYWNrID09PSAnb2JqZWN0JyAmJiBmYWxsYmFjayAhPT0gbnVsbCA/IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZmFsbGJhY2spKSA6IGZhbGxiYWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIEEgYnV0dG9uIHdpdGggbm8gY2FwdHVyZWQgdGFyZ2V0IHBvaW50cyBhdCBpdHMgb3duIG5vZGUsIG1hdGNoaW5nIGVkaXRvciBiZWhhdmlvdXIuXG4gICAgICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuQnV0dG9uJyAmJiBjb21wb25lbnQuX3RhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb21wb25lbnQuX3RhcmdldCA9IHsgXCJfX2lkX19cIjogbm9kZUluZGV4IH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBFbnN1cmUgX2lkIGlzIGxhc3QgKG1hdGNoZXMgZW5naW5lIHNlcmlhbGl6YXRpb24gb3JkZXIpXG4gICAgICAgIGNvbnN0IF9pZCA9IGNvbXBvbmVudC5faWQgfHwgXCJcIjtcbiAgICAgICAgZGVsZXRlIGNvbXBvbmVudC5faWQ7XG4gICAgICAgIGNvbXBvbmVudC5faWQgPSBfaWQ7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ291bnQgdGhlIGR1bXAgZW50cmllcyB0aGF0IHdvdWxkIGFjdHVhbGx5IGJlIHNlcmlhbGl6ZWQsIHNvIHRoZSBwb3N0LXdyaXRlIGNoZWNrXG4gICAgICogb25seSBkZW1hbmRzIHByb3BlcnRpZXMgZm9yIGNvbXBvbmVudHMgdGhhdCBoYWQgc29tZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGNvdW50U2VyaWFsaXphYmxlUHJvcHMocHJvcGVydGllczogYW55KTogbnVtYmVyIHtcbiAgICAgICAgaWYgKCFwcm9wZXJ0aWVzIHx8IHR5cGVvZiBwcm9wZXJ0aWVzICE9PSAnb2JqZWN0JykgcmV0dXJuIDA7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5maWx0ZXIoayA9PiAhRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrKSkubGVuZ3RoO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlcG9ydCBjb21wb25lbnQgdHlwZXMgdGhhdCBjYXJyaWVkIGxpdmUgcHJvcGVydGllcyBpbiB0aGUgc2NlbmUgYnV0IHNlcmlhbGl6ZWQgdG9cbiAgICAgKiBub3RoaW5nIGJ1dCB0aGUgYmFzZSBlbnZlbG9wZS4gYGFjdGlvbj1jcmVhdGVgIHByZXZpb3VzbHkgcmVwb3J0ZWQgc3VjY2VzcyBpblxuICAgICAqIGV4YWN0bHkgdGhhdCBzdGF0ZSAoIzI4KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGZpbmRDb21wb25lbnRzVGhhdExvc3RQcm9wZXJ0aWVzKHByZWZhYkRhdGE6IGFueVtdLCBub2RlRGF0YTogYW55KTogc3RyaW5nW10ge1xuICAgICAgICBjb25zdCBleHBlY3RlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNvbXAgb2YgKG5vZGUuY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jb3VudFNlcmlhbGl6YWJsZVByb3BzKGNvbXA/LnByb3BlcnRpZXMpID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZC5hZGQoY29tcC50eXBlIHx8IGNvbXAuX190eXBlX18gfHwgJ1Vua25vd24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgd2FsayhjaGlsZCk7XG4gICAgICAgIH07XG4gICAgICAgIHdhbGsobm9kZURhdGEpO1xuICAgICAgICBpZiAoZXhwZWN0ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIFtdO1xuXG4gICAgICAgIGNvbnN0IHBvcHVsYXRlZCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHByZWZhYkRhdGEpIHtcbiAgICAgICAgICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JyB8fCAhZXhwZWN0ZWQuaGFzKGVudHJ5Ll9fdHlwZV9fKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZW50cnkpLnNvbWUoa2V5ID0+ICFCQVNFX0NPTVBPTkVOVF9LRVlTLmhhcyhrZXkpKSkgcG9wdWxhdGVkLmFkZChlbnRyeS5fX3R5cGVfXyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFsuLi5leHBlY3RlZF0uZmlsdGVyKHR5cGUgPT4gIXBvcHVsYXRlZC5oYXModHlwZSkpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFjY2Vzc29yIHR3aW5zIHRoZSBDQVBUVVJFRCBzY2VuZSBkdW1wIGNhcnJpZWQgdGhhdCBzdXJ2aXZlZCBpbnRvIHRoZSBlbWl0dGVkIHByZWZhYi5cbiAgICAgKlxuICAgICAqIFRoaXMgaXMgdGhlIHJlYWwgIzExNC1kZWZlY3QtMiBpbnZhcmlhbnQsIGFuZCBpdCBpcyBkZWxpYmVyYXRlbHkgYSBESUZGRVJFTkNFIGNoZWNrXG4gICAgICogcmF0aGVyIHRoYW4gYSByZS1ydW4gb2YgdGhlIGVtaXNzaW9uIGZpbHRlcidzIG93biBwcmVkaWNhdGUuIEFza2luZ1xuICAgICAqIGBmaW5kQWNjZXNzb3JUd2luS2V5c2AgYWJvdXQgYHByZWZhYkNvbnRlbnRgIHdvdWxkIHJlLWFzayB0aGUgcXVlc3Rpb24gdGhlIGZpbHRlciBqdXN0XG4gICAgICogYW5zd2VyZWQgYW5kIHNvIGNvdWxkIG5ldmVyIGZhaWwgKHNlZSB0aGUgY2FsbCBzaXRlIOKAlCBuZXV0ZXJpbmcgdGhhdCBicmFuY2ggbGVhdmVzXG4gICAgICogZXZlcnkgdGVzdCBncmVlbik7IGNvbXBhcmluZyBjYXB0dXJlIGFnYWluc3Qgb3V0cHV0IGZhaWxzIHdoZW5ldmVyIHRoZSBmaWx0ZXIgaXNcbiAgICAgKiByZW1vdmVkLCBtaXMtc2NvcGVkLCBvciB0aGUgZHVtcCBzaGFwZSBjaGFuZ2VzIHVuZGVyIGl0LlxuICAgICAqXG4gICAgICogUGVyLW5vZGUgY29tcG9uZW50IGNvdW50cyBhcmUgY29tcGFyZWQgcG9zaXRpb25hbGx5IGluc3RlYWQgb2YgYnkgdXVpZCwgYmVjYXVzZSBhIG5vZGVcbiAgICAgKiBjYW4gaG9sZCBzZXZlcmFsIGNvbXBvbmVudHMgb2YgdGhlIHNhbWUgdHlwZSB3aXRoIG5vIHV1aWQgZGlzdGluZ3Vpc2hhYmxlIGF0IHRoaXNcbiAgICAgKiBsZXZlbC4gVGhlIGNvdW50cyBjb21lIGZyb20gdGhlIHNhbWUgd2Fsa3MgdGhlIHNlcmlhbGl6ZXIgdXNlcyAoYGNvbXBvbmVudHNgIGFuZFxuICAgICAqIGBwcm9wZXJ0aWVzYCksIHNvIHRoZXkgYWx3YXlzIGFncmVlIHdpdGggd2hhdCBgY3JlYXRlQ29tcG9uZW50T2JqZWN0YCBzYXc7IG9ubHkgdGhlXG4gICAgICogc2hhcGUtZGVwZW5kZW50IGRldGFpbHMgZGlmZmVyLCBhbmQgdGhvc2UgYXJlIGlnbm9yZWQgcmF0aGVyIHRoYW4gZ3Vlc3NlZCBhdC5cbiAgICAgKlxuICAgICAqIFB1cmUgYW5kIGV4cG9ydGVkIHNvIGJvdGggZGlyZWN0aW9ucyBhcmUgdW5pdC10ZXN0YWJsZTogaXQgbXVzdCBmaXJlIHdoZW4gYW4gYWNjZXNzb3JcbiAgICAgKiBrZXkgaXMgd3JpdHRlbiBiZXNpZGUgaXRzIHR3aW4sIGFuZCBzdGF5IHNpbGVudCBvbiB0aGUgcmVwYWlyZWQgc2hhcGUuXG4gICAgICovXG4gICAgZmluZENhcHR1cmVkQWNjZXNzb3JUd2lucyhub2RlRGF0YTogYW55LCBwcmVmYWJEYXRhOiBhbnlbXSk6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiB7XG4gICAgICAgIGNvbnN0IGNhcHR1cmVkOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4gPSBbXTtcbiAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb21wIG9mIChub2RlLmNvbXBvbmVudHMgfHwgW10pKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGNvbXA/LnR5cGUgfHwgY29tcD8uX190eXBlX18gfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnRpZXMgPSBjb21wPy5wcm9wZXJ0aWVzIHx8IHt9O1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleXMgPSBmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSBjYXB0dXJlZC5wdXNoKHsgdHlwZTogY29tcG9uZW50VHlwZSwga2V5cyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgKG5vZGUuY2hpbGRyZW4gfHwgW10pKSB3YWxrKGNoaWxkKTtcbiAgICAgICAgfTtcbiAgICAgICAgd2Fsayhub2RlRGF0YSk7XG4gICAgICAgIGlmIChjYXB0dXJlZC5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICAgICAgICAvLyBUaGUgcHJlZmFiIGVudHJpZXMgZm9yIG5vZGUgMCBvbndhcmQsIHNraXBwaW5nIHRoZSBsZWFkaW5nIGNjLlByZWZhYiBhc3NldCByZWNvcmRcbiAgICAgICAgLy8gKGFuZCBhbnkgbGVhZGluZyBudWxsIHNsb3RzKSwgYXJlIHRoZSBzZXJpYWxpemVkIG5vZGVzIGluIHdhbGsgb3JkZXIuXG4gICAgICAgIGNvbnN0IG5vZGVFbnRyaWVzID0gcHJlZmFiRGF0YS5maWx0ZXIoXG4gICAgICAgICAgICBlbnRyeSA9PiBlbnRyeSAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnICYmIGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuUHJlZmFiJyAmJiBBcnJheS5pc0FycmF5KGVudHJ5Ll9jb21wb25lbnRzKVxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IHN1cnZpdmVkOiBBcnJheTx7IHR5cGU6IHN0cmluZzsga2V5czogc3RyaW5nW10gfT4gPSBbXTtcbiAgICAgICAgbGV0IGN1cnNvciA9IDA7XG4gICAgICAgIGNvbnN0IGNoZWNrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRDb3VudCA9IEFycmF5LmlzQXJyYXkobm9kZS5jb21wb25lbnRzKSA/IG5vZGUuY29tcG9uZW50cy5sZW5ndGggOiAwO1xuICAgICAgICAgICAgY29uc3QgZW50cnk6IGFueSA9IG5vZGVFbnRyaWVzW2N1cnNvcisrXTtcbiAgICAgICAgICAgIGNvbnN0IGVtaXR0ZWQ6IGFueVtdID0gKGVudHJ5ICYmIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpKVxuICAgICAgICAgICAgICAgID8gZW50cnkuX2NvbXBvbmVudHMubWFwKChyZWY6IGFueSkgPT4gcHJlZmFiRGF0YVtyZWY/Ll9faWRfX10pLmZpbHRlcihCb29sZWFuKVxuICAgICAgICAgICAgICAgIDogW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbXBvbmVudENvdW50OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gbm9kZS5jb21wb25lbnRzW2ldPy50eXBlIHx8IG5vZGUuY29tcG9uZW50c1tpXT8uX190eXBlX18gfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgICAgIGNvbnN0IGtleXMgPSBmaW5kQWNjZXNzb3JUd2luS2V5cyhjb21wb25lbnRUeXBlLCBlbWl0dGVkW2ldICYmIHR5cGVvZiBlbWl0dGVkW2ldID09PSAnb2JqZWN0JyA/IGVtaXR0ZWRbaV0gOiB7fSk7XG4gICAgICAgICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkgc3Vydml2ZWQucHVzaCh7IHR5cGU6IGNvbXBvbmVudFR5cGUsIGtleXMgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIChub2RlLmNoaWxkcmVuIHx8IFtdKSkgY2hlY2soY2hpbGQpO1xuICAgICAgICB9O1xuICAgICAgICBjaGVjayhub2RlRGF0YSk7XG5cbiAgICAgICAgLy8gUmVwb3J0IHRoZSBjYXB0dXJlZCBzZXQsIG5hcnJvd2VkIHRvIHRoZSB0d2luIG5hbWVzIGFjdHVhbGx5IG9ic2VydmVkIHN1cnZpdmluZyBzb1xuICAgICAgICAvLyB0aGUgbWVzc2FnZSBuYW1lcyB0aGUgcmVhbCBsZWFrIHJhdGhlciB0aGFuIHJlc3RhdGluZyB3aGF0IHRoZSBkdW1wIGhlbGQuXG4gICAgICAgIHJldHVybiBjYXB0dXJlZC5maWx0ZXIoY2FwID0+XG4gICAgICAgICAgICBzdXJ2aXZlZC5zb21lKHN1cnYgPT4gc3Vydi50eXBlID09PSBjYXAudHlwZSAmJiBzdXJ2LmtleXMuc29tZShrID0+IGNhcC5rZXlzLmluY2x1ZGVzKGspKSlcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKiogUmUtcmVhZCB0aGUgd3JpdHRlbiBwcmVmYWI7IGZhbGxzIGJhY2sgdG8gdGhlIGluLW1lbW9yeSBjb250ZW50IHdoZW4gdGhlIHBhdGggaXMgdW5yZXNvbHZhYmxlLiAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVhZEJhY2tQcmVmYWIoc2F2ZVBhdGg6IHN0cmluZywgZmFsbGJhY2s6IGFueVtdKTogUHJvbWlzZTx7IGRhdGE6IGFueVtdOyBzb3VyY2U6ICdkaXNrJyB8ICdpbi1tZW1vcnknIH0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHNhdmVQYXRoKTtcbiAgICAgICAgICAgIGlmIChyZXNvbHZlZC5maWxlUGF0aCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHJlc29sdmVkLmZpbGVQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgcmV0dXJuIHsgZGF0YTogcGFyc2VkLCBzb3VyY2U6ICdkaXNrJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIGZhbGwgdGhyb3VnaCB0byB0aGUgaW4tbWVtb3J5IGNvbnRlbnRcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBkYXRhOiBmYWxsYmFjaywgc291cmNlOiAnaW4tbWVtb3J5JyB9O1xuICAgIH1cblxuICAgIC8qKiBUeXBlIG5hbWVzIHdob3NlIGR1bXAgdmFsdWUgaXMgYW4gQVNTRVQgcmVmZXJlbmNlIHJhdGhlciB0aGFuIGEgY29tcG9uZW50IHJlZmVyZW5jZS4gKi9cbiAgICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBBU1NFVF9UWVBFUyA9IG5ldyBTZXQoW1xuICAgICAgICAnY2MuUHJlZmFiJywgJ2NjLlRleHR1cmUyRCcsICdjYy5TcHJpdGVGcmFtZScsICdjYy5NYXRlcmlhbCcsICdjYy5BbmltYXRpb25DbGlwJyxcbiAgICAgICAgJ2NjLkF1ZGlvQ2xpcCcsICdjYy5Gb250JywgJ2NjLkFzc2V0JywgJ2NjLlRURkZvbnQnLCAnY2MuQml0bWFwRm9udCcsICdjYy5MYWJlbEF0bGFzJyxcbiAgICAgICAgJ2NjLlNwcml0ZUF0bGFzJywgJ2NjLkpzb25Bc3NldCcsICdjYy5UZXh0QXNzZXQnLCAnY2MuUGFydGljbGVBc3NldCcsICdjYy5NZXNoJyxcbiAgICAgICAgJ2NjLlNrZWxldG9uJywgJ2NjLlJlbmRlclRleHR1cmUnLCAnY2MuUGh5c2ljc01hdGVyaWFsJywgJ2NjLlNjZW5lQXNzZXQnLCAnY2MuRWZmZWN0QXNzZXQnLFxuICAgIF0pO1xuXG4gICAgLyoqXG4gICAgICogQW4gYXNzZXQgaXMgZWl0aGVyIGV4cGxpY2l0bHkgbGlzdGVkIG9yIG5hbWVkIGJ5IGEgc3VmZml4IG5vIGNvbXBvbmVudCB0eXBlIHVzZXMuXG4gICAgICogVGhlIHN1ZmZpeCBhcm0gaXMgd2hhdCBrZWVwcyBhIGZ1dHVyZSBjb25jcmV0ZSBhc3NldCBzdWJjbGFzcyBmcm9tIHNpbGVudGx5IHJlZ3Jlc3NpbmdcbiAgICAgKiBpbnRvIHRoZSBjb21wb25lbnQtcmVmZXJlbmNlIGJyYW5jaCB0aGUgd2F5IGNjLlRURkZvbnQgZGlkLlxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIGlzQXNzZXRUeXBlKHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoIXR5cGUpIHJldHVybiBmYWxzZTtcbiAgICAgICAgaWYgKFByZWZhYkNyZWF0aW9uU2VydmljZS5BU1NFVF9UWVBFUy5oYXModHlwZSkpIHJldHVybiB0cnVlO1xuICAgICAgICByZXR1cm4gLyg/OkZvbnR8QXNzZXR8QXRsYXN8Q2xpcCkkLy50ZXN0KHR5cGUpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByb2Nlc3MgY29tcG9uZW50IHByb3BlcnR5IHZhbHVlcywgZW5zdXJpbmcgZm9ybWF0IG1hdGNoZXMgbWFudWFsbHktY3JlYXRlZCBwcmVmYWJzLlxuICAgICAqIEhhbmRsZXMgbm9kZSByZWZzLCBhc3NldCByZWZzLCBjb21wb25lbnQgcmVmcywgdHlwZWQgbWF0aC9jb2xvciBvYmplY3RzLCBhbmQgYXJyYXlzLlxuICAgICAqXG4gICAgICogVGhyb3dzIG9uIGEgcmVmZXJlbmNlIGl0IGNhbm5vdCBzZXJpYWxpemUgZmFpdGhmdWxseS4gRXZlcnkgYnJhbmNoIGJlbG93IHVzZWQgdG9cbiAgICAgKiBhbnN3ZXIgYW4gdW5yZXNvbHZhYmxlIHJlZmVyZW5jZSB3aXRoIGBudWxsYCAob3IgZHJvcCBpdCBmcm9tIGFuIGFycmF5KSwgd2hpY2ggaXMgaG93XG4gICAgICogYSBjcmVhdGVkIHByZWZhYiBjYW1lIG91dCBob2xsb3cgd2hpbGUgYGFjdGlvbj1jcmVhdGVgIHJlcG9ydGVkIHN1Y2Nlc3Mg4oCUIGlzc3VlICM3MydzXG4gICAgICogYF9tZXNoOiBudWxsYCwgYF9tYXRlcmlhbHM6IFtdYCBhbmQgYGxhYmVsUGVyY2VudDogbnVsbGAsIGVhY2ggb2Ygd2hpY2ggaGFkIGJlZW5cbiAgICAgKiB3cml0dGVuIHRvIHRoZSBsaXZlIHNjZW5lIG1vbWVudHMgZWFybGllci4gQSByZWZlcmVuY2UgdGhhdCBjYW5ub3QgYmUgc2VyaWFsaXplZCBpcyBhXG4gICAgICogZmFpbHVyZSBvZiB0aGlzIGNhbGwsIG5vdCBhIHZhbHVlIG9mIGBudWxsYDogc2VlXG4gICAgICogYH4vLmNsYXVkZS9ydWxlcy9kZXZlbG9wbWVudC1wcmluY2lwbGVzLm1kYCDCpyBcIkVycm9ycyBPdmVyIFNpbGVudCBGYWxsYmFja3NcIi5cbiAgICAgKi9cbiAgICBwcml2YXRlIHByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eShwcm9wRGF0YTogYW55LCBjb250ZXh0Pzoge1xuICAgICAgICBub2RlVXVpZFRvSW5kZXg/OiBNYXA8c3RyaW5nLCBudW1iZXI+O1xuICAgICAgICBjb21wb25lbnRVdWlkVG9JbmRleD86IE1hcDxzdHJpbmcsIG51bWJlcj47XG4gICAgICAgIGxvc3Nlcz86IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgdXVpZDogc3RyaW5nOyByZWFzb246IHN0cmluZyB9PjtcbiAgICB9LCBwcm9wZXJ0eVBhdGggPSAnJyk6IGFueSB7XG4gICAgICAgIGlmICghcHJvcERhdGEgfHwgdHlwZW9mIHByb3BEYXRhICE9PSAnb2JqZWN0JykgcmV0dXJuIHByb3BEYXRhO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHByb3BEYXRhLnZhbHVlO1xuICAgICAgICBjb25zdCB0eXBlID0gcHJvcERhdGEudHlwZTtcbiAgICAgICAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICAvLyBBbiBleHBsaWNpdCBlbXB0eS11dWlkIHJlZmVyZW5jZSBpcyBhIGdlbnVpbmUgQ0xFQVIgKGlzc3VlICM3NSksIG5vdCBhIGxvc3MuXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLnV1aWQgPT09ICcnKSByZXR1cm4gbnVsbDtcblxuICAgICAgICAvLyBOb2RlIHJlZmVyZW5jZXNcbiAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5Ob2RlJyAmJiB2YWx1ZT8udXVpZCkge1xuICAgICAgICAgICAgaWYgKGNvbnRleHQ/Lm5vZGVVdWlkVG9JbmRleD8uaGFzKHZhbHVlLnV1aWQpKSByZXR1cm4geyBcIl9faWRfX1wiOiBjb250ZXh0Lm5vZGVVdWlkVG9JbmRleC5nZXQodmFsdWUudXVpZCkgfTtcbiAgICAgICAgICAgIC8vIEEgbm9kZSBvdXRzaWRlIHRoZSBzdWJ0cmVlIGJlaW5nIHNlcmlhbGl6ZWQgY2Fubm90IGJlIGVuY29kZWQgaW4gYSBwcmVmYWIg4oCUXG4gICAgICAgICAgICAvLyB0aGUgZm9ybWF0IGhhcyBubyBjcm9zcy1maWxlIG5vZGUgcmVmZXJlbmNlLiBUaGlzIG9uZSBnZW51aW5lbHkgbXVzdCBiZVxuICAgICAgICAgICAgLy8gZHJvcHBlZCwgYnV0IGl0IGlzIHN0aWxsIGEgZGF0YSBsb3NzIGFuZCBpcyByZWNvcmRlZCBhcyBzdWNoLlxuICAgICAgICAgICAgdGhpcy5yZWNvcmRMb3NzKGNvbnRleHQsIHByb3BlcnR5UGF0aCwgdmFsdWUudXVpZCwgJ25vZGUgaXMgb3V0c2lkZSB0aGUgcHJlZmFiIHN1YnRyZWUgYmVpbmcgc2VyaWFsaXplZCcpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBc3NldCByZWZlcmVuY2VzLlxuICAgICAgICAvL1xuICAgICAgICAvLyBUaGlzIGJyYW5jaCBpcyB0aGUgREVGQVVMVCBmb3IgYW55IHJlZmVyZW5jZSBjYXJyeWluZyBhIHV1aWQsIGJlY2F1c2UgdGhlIHRlc3RzXG4gICAgICAgIC8vIGJlbG93IGNhbm5vdCBib3RoIGJlIHNhdGlzZmllZDogYGNjLkxhYmVsYCdzIGBmb250YCBpcyBhIGBjYy5UVEZGb250YCBBU1NFVFxuICAgICAgICAvLyAodGhpcyB0ZXN0IGZpbGUncyBvd24gZm9udCByZWdyZXNzaW9uKSwgd2hpbGUgYGNjLkxhYmVsYCBpcyBhbHNvIGEgbGVnaXRpbWF0ZVxuICAgICAgICAvLyBAcHJvcGVydHkgQ09NUE9ORU5UIHR5cGUuIFJlYWRpbmcgdGhlIHZhbHVlJ3MgdXVpZCBhcyBhbiBhc3NldCBpcyB3aGF0IG1ha2VzIHRoZVxuICAgICAgICAvLyBmb250IGNhc2UgY29ycmVjdDsgZXZlcnkgY29uY3JldGUgYXNzZXQgY2xhc3MgaXMgY2F1Z2h0IGJlbG93IGJ5IG5hbWUgb3Igc3VmZml4LlxuICAgICAgICAvL1xuICAgICAgICAvLyBBc3NldC1maXJzdCB3YXMgcHJldmlvdXNseSBieXBhc3NlZCBieSBkaXNwYXRjaGluZyBvbiBgaXNBc3NldFR5cGUodHlwZSlgIEZJUlNULFxuICAgICAgICAvLyBsZXR0aW5nIHRoZSBjb21wb25lbnQgYnJhbmNoJ3MgYHR5cGUuc3RhcnRzV2l0aCgnY2MuJylgIGNhdGNoLWFsbCBjbGFpbSBhbnkgdHlwZVxuICAgICAgICAvLyB0aGUgYWxsb3dsaXN0IGhhZCBub3QgYmVlbiB0YXVnaHQg4oCUIHRoZSBleGFjdCBtZWNoYW5pc20gYnkgd2hpY2ggYGNjLk1lc2hgIGFuZFxuICAgICAgICAvLyBgY2MuU2tlbGV0b25gIGJlY2FtZSBudWxsIGVudHJpZXMgaW4gYSBjcmVhdGVkIHByZWZhYiAoaXNzdWVzICM2NCwgIzcwLCAjNzMpLlxuICAgICAgICBpZiAodmFsdWU/LnV1aWQpIHtcbiAgICAgICAgICAgIC8vIEluLXRyZWUgY29tcG9uZW50IHJlZmVyZW5jZTogdGhlIHV1aWQgbmFtZXMgYSBjb21wb25lbnQgaW4gdGhlIHN1YnRyZWUgYmVpbmdcbiAgICAgICAgICAgIC8vIHNlcmlhbGl6ZWQsIHNvIGl0IGVuY29kZXMgYXMgYW4gb2JqZWN0IGluZGV4LiBDaGVja2VkIEJFRk9SRSB0aGUgYXNzZXQgdGVzdDpcbiAgICAgICAgICAgIC8vIGEgdXVpZCBpbiB0aGUgY29tcG9uZW50IGluZGV4IElTIGEgY29tcG9uZW50IHdoYXRldmVyIGl0cyBjbGFzcyBpcyBjYWxsZWQsIGFuZFxuICAgICAgICAgICAgLy8gYSBjdXN0b20gY29tcG9uZW50IG5hbWVkIGxpa2UgYFRpbGVBc3NldGAvYEdhbWVBdGxhc2AgbWF0Y2hlcyB0aGUgYXNzZXQgc3VmZml4XG4gICAgICAgICAgICAvLyBhcm0gYmVsb3cg4oCUIHdoaWNoIHdyb3RlIGl0IGFzIGB7X191dWlkX199YCAoIzE0NykuIEFuIGFzc2V0J3MgdXVpZCBjYW4gbmV2ZXIgYmVcbiAgICAgICAgICAgIC8vIGluIHRoaXMgaW5kZXgsIHNvIHRoZSBMYWJlbC1mb250IGNhc2UgdGhlIGFzc2V0IGJyYW5jaCBleGlzdHMgZm9yIGlzIHVuYWZmZWN0ZWQuXG4gICAgICAgICAgICBpZiAoY29udGV4dD8uY29tcG9uZW50VXVpZFRvSW5kZXg/Lmhhcyh2YWx1ZS51dWlkKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IFwiX19pZF9fXCI6IGNvbnRleHQuY29tcG9uZW50VXVpZFRvSW5kZXguZ2V0KHZhbHVlLnV1aWQpIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLmlzQXNzZXRUeXBlKHR5cGUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgXCJfX3V1aWRfX1wiOiB2YWx1ZS51dWlkLCBcIl9fZXhwZWN0ZWRUeXBlX19cIjogdHlwZSB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gVW5yZXNvbHZlZC4gQSBwcmVmYWIgYXNzZXQgaGFzIG5vIHdheSB0byBleHByZXNzIGEgcmVmZXJlbmNlIHRvIHNvbWV0aGluZ1xuICAgICAgICAgICAgLy8gb3V0c2lkZSB0aGUgc3VidHJlZSwgc28gbnVsbCBpcyB0aGUgb25seSBlbmNvZGFibGUgYW5zd2VyIOKAlCBidXQgdGhlIG51bGwgaXNcbiAgICAgICAgICAgIC8vIG5vdyBSRUNPUkRFRCwgYW5kIHRoZSBjcmVhdGUgcGF0aHMgcmVmdXNlIHRvIHdyaXRlIHdoZW4gYW55dGhpbmcgd2FzIHJlY29yZGVkLlxuICAgICAgICAgICAgLy8gYG51bGxgIGluIHNpbGVuY2UgaXMgaXNzdWUgIzczJ3MgcHJpbWFyeSBzeW1wdG9tIChgX21lc2g6IG51bGxgLFxuICAgICAgICAgICAgLy8gYF9tYXRlcmlhbHM6IFtdYCwgYGxhYmVsUGVyY2VudDogbnVsbGAgb24gYSBjcmVhdGVkIHByZWZhYiwgd2l0aFxuICAgICAgICAgICAgLy8gYHN1Y2Nlc3M6IHRydWVgIGFuZCBgdmFsaWRhdGVgIGdyZWVuKTsgYSByZXBvcnRlZCBsb3NzIHRoYXQgZmFpbHMgdGhlIGNhbGwgaXNcbiAgICAgICAgICAgIC8vIG5vdC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBUd28gY2F1c2VzIHJlYWNoIGhlcmUsIGFuZCB0aGUgbWVzc2FnZSBuYW1lcyBib3RoIGJlY2F1c2UgdGhlIHJlbWVkaWVzIGRpZmZlcjpcbiAgICAgICAgICAgIC8vIGEgcmVmZXJlbmNlIGdlbnVpbmVseSBvdXRzaWRlIHRoZSBzdWJ0cmVlIChsZWdpdGltYXRlIOKAlCBhIGJ1dHRvbiBwb2ludGluZyBhdFxuICAgICAgICAgICAgLy8gYW5vdGhlciBwcmVmYWIpLCBhbmQgYW4gQVNTRVQgY2xhc3MgbWlzc2luZyBmcm9tIEFTU0VUX1RZUEVTLCB3aGljaCBpcyB0aGVcbiAgICAgICAgICAgIC8vIG1lY2hhbmlzbSBiZWhpbmQgaXNzdWVzICM2NC8jNzAvIzczIGFuZCB3YW50cyB0aGUgYWxsb3dsaXN0IGV4dGVuZGVkLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIERlbGliZXJhdGVseSBOT1QgYSB0aHJvdzogYHByb2Nlc3NDb21wb25lbnRQcm9wZXJ0eWAgcnVucyBpbnNpZGVcbiAgICAgICAgICAgIC8vIGBjcmVhdGVTdGFuZGFyZFByZWZhYkNvbnRlbnRgLCB3aG9zZSBjb250cmFjdCBpcyB0byBSRVRVUk4gdGhlIHByZWZhYiBKU09OLCBhbmRcbiAgICAgICAgICAgIC8vIHRocm93aW5nIGhlcmUgd291bGQgYWxzbyBjYXRjaCBzY3JpcHQgY29tcG9uZW50IHJlZmVyZW5jZXMgKGBCdWNrZXRTY3JpcHRgIGlzXG4gICAgICAgICAgICAvLyBub3QgYSBgY2MuYCBjbGFzcyksIHdoaWNoIGFyZSBhIGxlZ2l0aW1hdGUgZXh0ZXJuYWwgcmVmZXJlbmNlIOKAlCB0dXJuaW5nIGFcbiAgICAgICAgICAgIC8vIHN1cHBvcnRlZCBudWxsIGludG8gYSBmYWlsdXJlLiBUaGUgbG9zcyBsaXN0IGlzIHRoZSBjaGFubmVsIHRoYXQgZGlzdGluZ3Vpc2hlc1xuICAgICAgICAgICAgLy8gdGhlbSBieSBjYWxsIHNpdGUgcmF0aGVyIHRoYW4gYnkgZ3Vlc3NpbmcgZnJvbSB0aGUgdHlwZSBuYW1lLlxuICAgICAgICAgICAgY29uc29sZS53YXJuKGBSZWZlcmVuY2UgJHt0eXBlfSBVVUlEICR7dmFsdWUudXVpZH0gaGFzIG5vIGVuY29kYWJsZSBmb3JtIGluIGEgcHJlZmFiIChwcm9wZXJ0eSAnJHtwcm9wZXJ0eVBhdGggfHwgJyh1bmtub3duKSd9JylgKTtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkTG9zcyhcbiAgICAgICAgICAgICAgICBjb250ZXh0LCBwcm9wZXJ0eVBhdGgsIHZhbHVlLnV1aWQsXG4gICAgICAgICAgICAgICAgYHR5cGUgJyR7dHlwZX0nIGhhcyBubyBlbmNvZGFibGUgZm9ybSDigJQgZWl0aGVyIGl0IGlzIG91dHNpZGUgdGhlIHByZWZhYiBzdWJ0cmVlIChsZWdpdGltYXRlIGZvciBhIGNvbXBvbmVudCByZWZlcmVuY2UpIGAgK1xuICAgICAgICAgICAgICAgIGBvciBpdCBpcyBhbiBhc3NldCBjbGFzcyBtaXNzaW5nIGZyb20gUHJlZmFiQ3JlYXRpb25TZXJ2aWNlLkFTU0VUX1RZUEVTIChpc3N1ZXMgIzY0LyM3MC8jNzMpYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHlwZWQgbWF0aC9jb2xvciBvYmplY3RzXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLkNvbG9yJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5yKSB8fCAwKSksIFwiZ1wiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5nKSB8fCAwKSksIFwiYlwiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5iKSB8fCAwKSksIFwiYVwiOiB2YWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5hKSkpIDogMjU1IH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzMnKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCwgXCJ6XCI6IE51bWJlcih2YWx1ZS56KSB8fCAwIH07XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NjLlZlYzInKSByZXR1cm4geyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjMlwiLCBcInhcIjogTnVtYmVyKHZhbHVlLngpIHx8IDAsIFwieVwiOiBOdW1iZXIodmFsdWUueSkgfHwgMCB9O1xuICAgICAgICAgICAgaWYgKHR5cGUgPT09ICdjYy5TaXplJykgcmV0dXJuIHsgXCJfX3R5cGVfX1wiOiBcImNjLlNpemVcIiwgXCJ3aWR0aFwiOiBOdW1iZXIodmFsdWUud2lkdGgpIHx8IDAsIFwiaGVpZ2h0XCI6IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDAgfTtcbiAgICAgICAgICAgIGlmICh0eXBlID09PSAnY2MuUXVhdCcpIHJldHVybiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiBOdW1iZXIodmFsdWUueCkgfHwgMCwgXCJ5XCI6IE51bWJlcih2YWx1ZS55KSB8fCAwLCBcInpcIjogTnVtYmVyKHZhbHVlLnopIHx8IDAsIFwid1wiOiB2YWx1ZS53ICE9PSB1bmRlZmluZWQgPyBOdW1iZXIodmFsdWUudykgOiAxIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBcnJheSBwcm9wZXJ0aWVzLlxuICAgICAgICAvLyBFYWNoIGVsZW1lbnQgb2YgYW4gYXJyYXktdHlwZWQgZHVtcCAoZS5nLiBjYy5NZXNoUmVuZGVyZXIncyBzaGFyZWRNYXRlcmlhbHMvXG4gICAgICAgIC8vIF9tYXRlcmlhbHMpIGlzIGl0c2VsZiBhIG5lc3RlZCBwcm9wZXJ0eSBkZXNjcmlwdG9yIOKAlCB7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSwgLi4uIH1cbiAgICAgICAgLy8g4oCUIG5vdCBhIGZsYXQgeyB1dWlkIH0uIFJlYWRpbmcgaXRlbS51dWlkIGRpcmVjdGx5IG1hdGNoZWQgbm90aGluZyBmb3IgZXZlcnkgZWxlbWVudCxcbiAgICAgICAgLy8gc28gYSBNZXNoUmVuZGVyZXIncyBhc3NpZ25lZCBtYXRlcmlhbCBzaWxlbnRseSBzZXJpYWxpemVkIGFzIGFuIGVtcHR5IGFycmF5IHdoaWxlXG4gICAgICAgIC8vIHJlcG9ydGluZyBzdWNjZXNzICh2ZXJpZmllZCBsaXZlIGFnYWluc3QgYSBzbWFydC1pbXBvcnRlZCBGQlggbWF0ZXJpYWwpLlxuICAgICAgICAvL1xuICAgICAgICAvLyBFbGVtZW50cyBhcmUgc2VyaWFsaXplZCB0aHJvdWdoIHRoaXMgc2FtZSBmdW5jdGlvbiByYXRoZXIgdGhhbiBhIGxvY2FsXG4gICAgICAgIC8vIGB7IF9fdXVpZF9fIH1gIHNoYXBlLCBzbyBhIGNvbmNyZXRlLWNsYXNzIGFzc2V0IHR5cGUgcmVhY2hlcyB0aGUgYXNzZXQgYnJhbmNoXG4gICAgICAgIC8vIGluc3RlYWQgb2YgYSBoYXJkY29kZWQgY29uc2VxdWVuY2Ugb2YgYGVsZW1lbnRUeXBlRGF0YWAuIFRoZSBvbGQgc2hhcGUgZGVjbGFyZWRcbiAgICAgICAgLy8gYGVsZW1lbnRUeXBlRGF0YS50eXBlYCBmb3IgZXZlcnkgZWxlbWVudCByZWdhcmRsZXNzIG9mIHdoYXQgdGhlIGVsZW1lbnQgYWN0dWFsbHlcbiAgICAgICAgLy8gcmVmZXJlbmNlZCDigJQgYW5kIGAuZmlsdGVyKEJvb2xlYW4pYCB0dXJuZWQgZWFjaCB1bnJlc29sdmVkIGVsZW1lbnQgaW50byBhIHNpbGVudGx5XG4gICAgICAgIC8vIHNob3J0ZXIgYXJyYXksIHdoaWNoIGlzIGlzc3VlICM3MydzIGBfbWF0ZXJpYWxzOiBbXWAgZXhhY3RseTogYW4gYXJyYXkgcHJvcGVydHlcbiAgICAgICAgLy8gdGhhdCBoYWQgY29udGVudHMgb24gdGhlIGxpdmUgbm9kZSBhbmQgY2FtZSBvdXQgb2YgdGhlIGNyZWF0ZWQgcHJlZmFiIGVtcHR5LCB3aXRoXG4gICAgICAgIC8vIGBzdWNjZXNzOiB0cnVlYCBhbmQgYHZhbGlkYXRlYCByZXBvcnRpbmcgYGlzVmFsaWQ6IHRydWVgIG92ZXIgdGhlIHJlc3VsdC5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBjb25zdCBlbGVtZW50VHlwZSA9IHByb3BEYXRhLmVsZW1lbnRUeXBlRGF0YT8udHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZWQgPSB2YWx1ZS5tYXAoKGl0ZW06IGFueSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1VdWlkID0gaXRlbT8udXVpZCB8fCBpdGVtPy52YWx1ZT8udXVpZDtcbiAgICAgICAgICAgICAgICBpZiAoIWl0ZW1VdWlkICYmIGVsZW1lbnRUeXBlICYmICFlbGVtZW50VHlwZS5zdGFydHNXaXRoKCdjYy4nKSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBOb3QgYSByZWZlcmVuY2UgYXJyYXkgYXQgYWxsIOKAlCBhbiBhcnJheSBvZiBwbGFpbiB2YWx1ZXMuXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpdGVtPy52YWx1ZSAhPT0gdW5kZWZpbmVkID8gaXRlbS52YWx1ZSA6IGl0ZW07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIEFuIGVsZW1lbnQncyBvd24gYHR5cGVgIGlzIGF1dGhvcml0YXRpdmU7IGBlbGVtZW50VHlwZURhdGFgIGlzIG9ubHkgdGhlXG4gICAgICAgICAgICAgICAgLy8gZGVjbGFyZWQgYXJyYXkgZWxlbWVudCBjbGFzcywgYW5kIGZvciBhIHN1YmNsYXNzIGVsZW1lbnQgKGBjYy5UVEZGb250YFxuICAgICAgICAgICAgICAgIC8vIHVuZGVyIGEgYGNjLkZvbnRbXWAsIGEgbmVzdGVkLWRlc2NyaXB0b3IgbWF0ZXJpYWwpIHRoZSBkZWNsYXJlZCBjbGFzcyBpc1xuICAgICAgICAgICAgICAgIC8vIHRoZSB3cm9uZyB0aGluZyB0byB3cml0ZS5cbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9jZXNzQ29tcG9uZW50UHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgIHsgdmFsdWU6IGl0ZW0/LnZhbHVlICE9PSB1bmRlZmluZWQgPyBpdGVtLnZhbHVlIDogaXRlbSwgdHlwZTogaXRlbT8udHlwZSB8fCBlbGVtZW50VHlwZSB9LFxuICAgICAgICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICAgICAgICBgJHtwcm9wZXJ0eVBhdGh9WyR7aW5kZXh9XWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBBIGRyb3BwZWQgZWxlbWVudCBpcyBhIGxvc3MsIG5vdCBhIHNob3J0ZXIgYXJyYXkuIGBtYXBgIG5ldmVyIHByb2R1Y2VzXG4gICAgICAgICAgICAvLyB1bmRlZmluZWQgaGVyZSwgc28gdGhpcyBvbmx5IGZpcmVzIGlmIGEgZnV0dXJlIGJyYW5jaCBzdGFydHMgcmV0dXJuaW5nIGl0LlxuICAgICAgICAgICAgcmV0dXJuIHNlcmlhbGl6ZWQuZmlsdGVyKChlbnRyeTogYW55KSA9PiBlbnRyeSAhPT0gdW5kZWZpbmVkICYmIGVudHJ5ICE9PSBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE5lc3RlZCBDQ0NsYXNzIGdyb3VwOiB0aGUgZHVtcCBuZXN0cyBhbm90aGVyIGRlc2NyaXB0b3IgbWFwIHVuZGVyIGB2YWx1ZWAuXG4gICAgICAgIC8vIFNlcmlhbGl6aW5nIGl0IHZlcmJhdGltIHdvdWxkIHdyaXRlIGVkaXRvciBkZXNjcmlwdG9ycyAoe25hbWUsIHZhbHVlLCB0eXBlfSlcbiAgICAgICAgLy8gaW50byB0aGUgYXNzZXQgaW5zdGVhZCBvZiB0aGUgdmFsdWVzIHRoZW1zZWx2ZXMuXG4gICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB0aGlzLmlzTmVzdGVkUHJvcGVydHlNYXAodmFsdWUpKSB7XG4gICAgICAgICAgICBjb25zdCBuZXN0ZWQ6IGFueSA9IHR5cGUgPyB7IFwiX190eXBlX19cIjogdHlwZSB9IDoge307XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtrZXksIGVudHJ5XSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoRFVNUF9LRVlTX05PVF9TRVJJQUxJWkVELmhhcyhrZXkpKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBuZXN0ZWRWYWx1ZSA9IHRoaXMucHJvY2Vzc0NvbXBvbmVudFByb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICBlbnRyeSwgY29udGV4dCwgcHJvcGVydHlQYXRoID8gYCR7cHJvcGVydHlQYXRofS4ke2tleX1gIDoga2V5XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAobmVzdGVkVmFsdWUgIT09IHVuZGVmaW5lZCkgbmVzdGVkW2tleV0gPSBuZXN0ZWRWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXN0ZWQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBPdGhlciBjb21wbGV4IHR5cGVkIG9iamVjdHNcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdHlwZT8uc3RhcnRzV2l0aCgnY2MuJykpIHJldHVybiB7IFwiX190eXBlX19cIjogdHlwZSwgLi4udmFsdWUgfTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlY29yZCBhIHJlZmVyZW5jZSB0aGF0IGNvdWxkIG5vdCBiZSBzZXJpYWxpemVkIGZhaXRoZnVsbHkuXG4gICAgICpcbiAgICAgKiBLZXB0IGFzIGEgbGlzdCByYXRoZXIgdGhhbiBhIHRocm93IGZvciB0aGUgdHdvIGNhc2VzIHdoZXJlIHRoZSBwcmVmYWIgZm9ybWF0IGl0c2VsZlxuICAgICAqIGNhbm5vdCBleHByZXNzIHRoZSB2YWx1ZSAoYSBub2RlL2NvbXBvbmVudCBvdXRzaWRlIHRoZSBzdWJ0cmVlKS4gVGhlIGNyZWF0ZSBwYXRocyB0dXJuXG4gICAgICogYSBub24tZW1wdHkgbGlzdCBpbnRvIGEgYGZhdGFsYCBmYWlsdXJlLCBzbyB0aGUgbG9zcyBpcyBuZXZlciBtZXJlbHkgYSB3YXJuaW5nIGluIGFcbiAgICAgKiBsb2cgbm9ib2R5IHJlYWRzIOKAlCB3aGljaCBpcyBob3cgIzczJ3MgZHJvcHBlZCByZWZlcmVuY2VzIHdlbnQgdW5ub3RpY2VkIHRocm91Z2hcbiAgICAgKiBgY3JlYXRlYCBBTkQgYHZhbGlkYXRlYC5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlY29yZExvc3MoXG4gICAgICAgIGNvbnRleHQ6IHsgbG9zc2VzPzogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+IH0gfCB1bmRlZmluZWQsXG4gICAgICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgICAgIHV1aWQ6IHN0cmluZyxcbiAgICAgICAgcmVhc29uOiBzdHJpbmdcbiAgICApOiB2b2lkIHtcbiAgICAgICAgaWYgKCFjb250ZXh0Py5sb3NzZXMpIHJldHVybjtcbiAgICAgICAgY29udGV4dC5sb3NzZXMucHVzaCh7IHByb3BlcnR5OiBwcm9wZXJ0eSB8fCAnKHVua25vd24pJywgdXVpZCwgcmVhc29uIH0pO1xuICAgIH1cblxuICAgIC8qKiBSZW5kZXIgcmVjb3JkZWQgbG9zc2VzIGFzIHRoZSBmYXRhbCBmYWlsdXJlIG1lc3NhZ2UsIG9yIG51bGwgd2hlbiB0aGVyZSBhcmUgbm9uZS4gKi9cbiAgICBwcml2YXRlIGRlc2NyaWJlUmVmZXJlbmNlTG9zc2VzKGxvc3NlczogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyB1dWlkOiBzdHJpbmc7IHJlYXNvbjogc3RyaW5nIH0+KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGlmIChsb3NzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgbmFtZWQgPSBsb3NzZXMubWFwKGwgPT4gYCcke2wucHJvcGVydHl9JyAtPiAke2wudXVpZH0gKCR7bC5yZWFzb259KWApO1xuICAgICAgICByZXR1cm4gYCR7bG9zc2VzLmxlbmd0aH0gcmVmZXJlbmNlKHMpIGNvdWxkIG5vdCBiZSBzZXJpYWxpemVkOiAke25hbWVkLmpvaW4oJzsgJyl9LmA7XG4gICAgfVxuXG4gICAgLyoqIFRydWUgd2hlbiBldmVyeSBlbnRyeSBpcyBhbiBvYmplY3QgYW5kIGF0IGxlYXN0IG9uZSBpcyBhIENvY29zIHByb3BlcnR5IGRlc2NyaXB0b3IuICovXG4gICAgcHJpdmF0ZSBpc05lc3RlZFByb3BlcnR5TWFwKHZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyh2YWx1ZSk7XG4gICAgICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gZW50cmllcy5ldmVyeSgoWywgZW50cnldKSA9PiBlbnRyeSAhPT0gbnVsbCAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKVxuICAgICAgICAgICAgJiYgZW50cmllcy5zb21lKChbLCBlbnRyeV0pID0+IGlzUHJvcGVydHlEZXNjcmlwdG9yKGVudHJ5KSk7XG4gICAgfVxuXG4gICAgLy8gPT09PT0gQXNzZXQgREIgb3BlcmF0aW9ucyA9PT09PVxuXG4gICAgLyoqXG4gICAgICogTGluayB0aGUgc2NlbmUgbm9kZSB0byB0aGUgZnJlc2hseSB3cml0dGVuIHByZWZhYiBhc3NldC5cbiAgICAgKlxuICAgICAqIGBzY2VuZTpsaW5rLXByZWZhYmAgKG5vZGVVdWlkLCBhc3NldFV1aWQg4oCUIHBvc2l0aW9uYWwsIHRoZSBlZGl0b3IncyBvd25cbiAgICAgKiBgbGlua1ByZWZhYihub2RlVXVpZCwgYXNzZXRVdWlkKWAgZmFjYWRlIGNhbGwpIGlzIHRyaWVkIGZpcnN0LiBUaGUgdGhyZWUgbGVnYWN5XG4gICAgICogb2JqZWN0LWZvcm0gbWVzc2FnZXMgbmV2ZXIgZXhpc3RlZCBpbiAzLjguNyBhbmQgYXJlIGtlcHQgb25seSBhcyBmYWxsYmFja3MuIEV2ZXJ5XG4gICAgICogcmVqZWN0aW9uIGlzIGNvbGxlY3RlZCBzbyBhIGZhaWxlZCBjb252ZXJzaW9uIG5hbWVzIGl0cyBjYXVzZXMgaW5zdGVhZCBvZiB0aGUgYmFyZVxuICAgICAqIFwiYWxsIG1ldGhvZHMgZmFpbGVkXCIgdGhhdCBsZWZ0ICMxMzAncyBjYWxsZXJzIGd1ZXNzaW5nLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY29udmVydE5vZGVUb1ByZWZhYkluc3RhbmNlKG5vZGVVdWlkOiBzdHJpbmcsIHByZWZhYlV1aWQ6IHN0cmluZywgX3ByZWZhYlBhdGg6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IG1ldGhvZHM6IEFycmF5PFtzdHJpbmcsICgpID0+IFByb21pc2U8YW55Pl0+ID0gW1xuICAgICAgICAgICAgWydsaW5rLXByZWZhYicsICgpID0+IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ2xpbmstcHJlZmFiJywgbm9kZVV1aWQsIHByZWZhYlV1aWQpXSxcbiAgICAgICAgICAgIFsnY29ubmVjdC1wcmVmYWItaW5zdGFuY2UnLCAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjb25uZWN0LXByZWZhYi1pbnN0YW5jZScsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiVXVpZCB9KV0sXG4gICAgICAgICAgICBbJ3NldC1wcmVmYWItY29ubmVjdGlvbicsICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcmVmYWItY29ubmVjdGlvbicsIHsgbm9kZTogbm9kZVV1aWQsIHByZWZhYjogcHJlZmFiVXVpZCB9KV0sXG4gICAgICAgICAgICBbJ2FwcGx5LXByZWZhYi1saW5rJywgKCkgPT4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnYXBwbHktcHJlZmFiLWxpbmsnLCB7IG5vZGU6IG5vZGVVdWlkLCBwcmVmYWI6IHByZWZhYlV1aWQgfSldXG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IGZhaWx1cmVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IFtuYW1lLCBtZXRob2RdIG9mIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBtZXRob2QoKTtcbiAgICAgICAgICAgICAgICAvLyBBIG1lc3NhZ2UgdGhhdCByZXNvbHZlcyBgZmFsc2VgIGRlY2xpbmVkIHRoZSBsaW5rOyBpdCBpcyBub3QgYSBzdWNjZXNzLlxuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7IGZhaWx1cmVzLnB1c2goYCR7bmFtZX06IHJldHVybmVkIGZhbHNlYCk7IGNvbnRpbnVlOyB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICBmYWlsdXJlcy5wdXNoKGAke25hbWV9OiAke2Vycj8ubWVzc2FnZSB8fCBlcnJ9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQWxsIHByZWZhYiBjb25uZWN0aW9uIG1ldGhvZHMgZmFpbGVkICgke2ZhaWx1cmVzLmpvaW4oJzsgJyl9KWAgfTtcbiAgICB9XG5cbiAgICAvKiogRmllbGRzIGRlc2NyaWJpbmcgYSBmYWlsZWQgbm9kZS0+aW5zdGFuY2UgY29udmVyc2lvbiwgc28gdGhlIGZhaWx1cmUgaXMgbm90IGJ1cmllZCBpbiBgbWVzc2FnZWAuICovXG4gICAgcHJpdmF0ZSBjb252ZXJzaW9uRmFpbHVyZUZpZWxkcyhjb252ZXJ0UmVzdWx0OiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICAgICAgaWYgKGNvbnZlcnRSZXN1bHQuc3VjY2VzcykgcmV0dXJuIHt9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgd2FybmluZzogJ1RoZSBwcmVmYWIgYXNzZXQgd2FzIHdyaXR0ZW4sIGJ1dCB0aGUgc2NlbmUgbm9kZSB3YXMgTk9UIGNvbnZlcnRlZCBpbnRvIGEgbGlua2VkIHByZWZhYiBpbnN0YW5jZTsgaXQgaXMgc3RpbGwgYSBwbGFpbiBub2RlLicsXG4gICAgICAgICAgICBjb252ZXJzaW9uRXJyb3I6IGNvbnZlcnRSZXN1bHQuZXJyb3IsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1VzZSB0aGUgd3JpdHRlbiBwcmVmYWIgYXMtaXMsIG9yIGxpbmsgdGhlIG5vZGUgaW4gdGhlIGVkaXRvciAocmlnaHQtY2xpY2sgbm9kZSA+IExpbmsgUHJlZmFiKS4gUmUtcnVubmluZyBjcmVhdGUgd2lsbCBub3QgcmV0cnkgdGhlIGxpbmsuJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZVByZWZhYldpdGhNZXRhKHByZWZhYlBhdGg6IHN0cmluZywgcHJlZmFiRGF0YTogYW55W10sIG1ldGFEYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zYXZlQXNzZXRGaWxlKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHByZWZhYkRhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMuc2F2ZUFzc2V0RmlsZShgJHtwcmVmYWJQYXRofS5tZXRhYCwgSlNPTi5zdHJpbmdpZnkobWV0YURhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gc2F2ZSBwcmVmYWIgZmlsZScgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZUFzc2V0RmlsZShmaWxlUGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3QgbWV0aG9kcyA9IFtcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KSxcbiAgICAgICAgICAgICgpID0+IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBmaWxlUGF0aCwgY29udGVudCksXG4gICAgICAgICAgICAoKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICd3cml0ZS1hc3NldCcsIGZpbGVQYXRoLCBjb250ZW50KVxuICAgICAgICBdO1xuICAgICAgICBmb3IgKGNvbnN0IG1ldGhvZCBvZiBtZXRob2RzKSB7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCBtZXRob2QoKTsgcmV0dXJuOyB9IGNhdGNoIHsgLyogdHJ5IG5leHQgKi8gfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQWxsIHNhdmUgbWV0aG9kcyBmYWlsZWQnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFzc2V0UGF0aCwgY29udGVudCwgeyBvdmVyd3JpdGU6IHRydWUsIHJlbmFtZTogZmFsc2UgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBhc3NldEluZm8gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gY3JlYXRlIGFzc2V0IGZpbGUnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZU1ldGFXaXRoQXNzZXREQihhc3NldFBhdGg6IHN0cmluZywgbWV0YUNvbnRlbnQ6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIGFzc2V0UGF0aCwgSlNPTi5zdHJpbmdpZnkobWV0YUNvbnRlbnQsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGFzc2V0SW5mbyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgbWV0YSBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWltcG9ydEFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0UGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiByZXN1bHQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICdGYWlsZWQgdG8gcmVpbXBvcnQgYXNzZXQnIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZUFzc2V0V2l0aEFzc2V0REIoYXNzZXRQYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBhc3NldFBhdGgsIGNvbnRlbnQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcmVzdWx0IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB8fCAnRmFpbGVkIHRvIHVwZGF0ZSBhc3NldCBmaWxlJyB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gPT09PT0gRm9ybWF0IHZhbGlkYXRpb24gPT09PT1cblxuICAgIC8qKlxuICAgICAqIFN0cnVjdHVyYWwgdmFsaWRhdGlvbiBvZiBhIHNlcmlhbGl6ZWQgcHJlZmFiLlxuICAgICAqXG4gICAgICogU3RydWN0dXJhbCBhbG9uZSBpcyBub3QgXCJ2YWxpZFwiOiBhIHByZWZhYiB3aG9zZSBjb21wb25lbnRzIHNlcmlhbGl6ZWQgdG8gdGhlaXIgYmFyZVxuICAgICAqIGVudmVsb3BlIHBhc3NlcyBldmVyeSBjaGVjayBoZXJlIHdoaWxlIGNhcnJ5aW5nIG5vbmUgb2YgdGhlIHNjZW5lIHZhbHVlcywgd2hpY2ggaXMgd2h5XG4gICAgICogYG1hbmFnZV9wcmVmYWIgYWN0aW9uPXZhbGlkYXRlYCByZXR1cm5lZCBgaXNWYWxpZDogdHJ1ZWAgb3ZlciB0aGUgaG9sbG93IG91dHB1dCBvZlxuICAgICAqIGlzc3VlICM3MydzIG93biByZXByby4gYGhvbGxvd0NvbXBvbmVudHNgIHJlcG9ydHMgdGhlIGNvbXBvbmVudHMgdGhhdCBob2xkIG5vdGhpbmdcbiAgICAgKiBiZXlvbmQgYEJBU0VfQ09NUE9ORU5UX0tFWVNgLCBzbyBcInZhbGlkXCIgYW5kIFwiZW1wdHlcIiBhcmUgZGlzdGluZ3Vpc2hhYmxlLlxuICAgICAqL1xuICAgIHZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkRhdGE6IGFueSk6IHsgaXNWYWxpZDogYm9vbGVhbjsgaXNzdWVzOiBzdHJpbmdbXTsgbm9kZUNvdW50OiBudW1iZXI7IGNvbXBvbmVudENvdW50OiBudW1iZXI7IGhvbGxvd0NvbXBvbmVudHM6IHN0cmluZ1tdOyBkdXBsaWNhdGVBY2Nlc3NvcktleXM6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiB9IHtcbiAgICAgICAgY29uc3QgaXNzdWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBob2xsb3dDb21wb25lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBkdXBsaWNhdGVBY2Nlc3NvcktleXM6IEFycmF5PHsgdHlwZTogc3RyaW5nOyBrZXlzOiBzdHJpbmdbXSB9PiA9IFtdO1xuICAgICAgICBsZXQgbm9kZUNvdW50ID0gMDtcbiAgICAgICAgbGV0IGNvbXBvbmVudENvdW50ID0gMDtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogZmFsc2UsIGlzc3Vlcywgbm9kZUNvdW50LCBjb21wb25lbnRDb3VudCwgaG9sbG93Q29tcG9uZW50cywgZHVwbGljYXRlQWNjZXNzb3JLZXlzIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByZWZhYkRhdGEubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaCgnUHJlZmFiIGRhdGEgaXMgZW1wdHknKTtcbiAgICAgICAgICAgIHJldHVybiB7IGlzVmFsaWQ6IGZhbHNlLCBpc3N1ZXMsIG5vZGVDb3VudCwgY29tcG9uZW50Q291bnQsIGhvbGxvd0NvbXBvbmVudHMsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cyB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghcHJlZmFiRGF0YVswXSB8fCBwcmVmYWJEYXRhWzBdLl9fdHlwZV9fICE9PSAnY2MuUHJlZmFiJykge1xuICAgICAgICAgICAgaXNzdWVzLnB1c2goJ0ZpcnN0IGVsZW1lbnQgbXVzdCBiZSBjYy5QcmVmYWIgdHlwZScpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5vZGVzV2l0aENvbXBvbmVudHMgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgcHJlZmFiRGF0YS5mb3JFYWNoKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtLl9fdHlwZV9fID09PSAnY2MuTm9kZScpIHtcbiAgICAgICAgICAgICAgICBub2RlQ291bnQrKztcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiAoaXRlbS5fY29tcG9uZW50cyB8fCBbXSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZiAmJiB0eXBlb2YgcmVmLl9faWRfXyA9PT0gJ251bWJlcicpIG5vZGVzV2l0aENvbXBvbmVudHMuYWRkKHJlZi5fX2lkX18pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXRlbS5fX3R5cGVfXyA9PT0gJ2NjLkNvbXBQcmVmYWJJbmZvJyB8fCAhaXRlbS5fX3R5cGVfXykge1xuICAgICAgICAgICAgICAgIC8vIFNlcmlhbGl6YXRpb24gYm9va2tlZXBpbmcsIG5ldmVyIGEgY29tcG9uZW50IGluc3RhbmNlLlxuICAgICAgICAgICAgfSBlbHNlIGlmIChTdHJpbmcoaXRlbS5fX3R5cGVfXykuc3RhcnRzV2l0aCgnY2MuJykgfHwgaXRlbS5fX3R5cGVfXykge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudENvdW50Kys7XG4gICAgICAgICAgICAgICAgLy8gQSBjb21wb25lbnQgdGhhdCBpcyByZWZlcmVuY2VkIGZyb20gYSBub2RlIGJ1dCBjYXJyaWVzIG5vdGhpbmcgYnV0IHRoZVxuICAgICAgICAgICAgICAgIC8vIGVudmVsb3BlIGhhcyBsb3N0IGV2ZXJ5IHByb3BlcnR5IGl0IGhlbGQgaW4gdGhlIHNjZW5lICgjMjgvIzczKS5cbiAgICAgICAgICAgICAgICBjb25zdCBob2xkc05vdGhpbmdCdXRFbnZlbG9wZSA9IE9iamVjdC5rZXlzKGl0ZW0pLmV2ZXJ5KGtleSA9PiBCQVNFX0NPTVBPTkVOVF9LRVlTLmhhcyhrZXkpKTtcbiAgICAgICAgICAgICAgICBpZiAoaG9sZHNOb3RoaW5nQnV0RW52ZWxvcGUgJiYgdHlwZW9mIGl0ZW0ubm9kZT8uX19pZF9fID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgICAgICAgICBob2xsb3dDb21wb25lbnRzLnB1c2goU3RyaW5nKGl0ZW0uX190eXBlX18pKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gQW4gYWNjZXNzb3Iga2V5IHNpdHRpbmcgYmVzaWRlIGl0cyBzZXJpYWxpemVkIGBfYC10d2luIGlzIGEgcHJlZmFiIHRoZVxuICAgICAgICAgICAgICAgIC8vIGltcG9ydGVyIHJlamVjdHMgKCMxMTQgZGVmZWN0IDIpLiBDaGVja2VkIGhlcmUgYmVjYXVzZSBgYWN0aW9uPXZhbGlkYXRlYFxuICAgICAgICAgICAgICAgIC8vIHJlcG9ydGVkIGBpc1ZhbGlkOiB0cnVlYCBvbiB0aGUgYnJva2VuIGZpbGUgYm90aCBiZWZvcmUgQU5EIGFmdGVyIHRoZVxuICAgICAgICAgICAgICAgIC8vIHJlcG9ydCdzIG1hbnVhbCByZXBhaXIsIHNvIGl0IGNhdWdodCBub3RoaW5nIGFib3V0IHRoaXMgY2xhc3MuXG4gICAgICAgICAgICAgICAgY29uc3QgdHdpbnMgPSBmaW5kQWNjZXNzb3JUd2luS2V5cyhTdHJpbmcoaXRlbS5fX3R5cGVfXyksIGl0ZW0pO1xuICAgICAgICAgICAgICAgIGlmICh0d2lucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cy5wdXNoKHsgdHlwZTogU3RyaW5nKGl0ZW0uX190eXBlX18pLCBrZXlzOiB0d2lucyB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobm9kZUNvdW50ID09PSAwKSBpc3N1ZXMucHVzaCgnUHJlZmFiIG11c3QgY29udGFpbiBhdCBsZWFzdCBvbmUgbm9kZScpO1xuICAgICAgICBmb3IgKGNvbnN0IGhvbGxvdyBvZiBbLi4ubmV3IFNldChob2xsb3dDb21wb25lbnRzKV0pIHtcbiAgICAgICAgICAgIGlzc3Vlcy5wdXNoKGBDb21wb25lbnQgJyR7aG9sbG93fScgc2VyaWFsaXplZCB3aXRoIG5vIHByb3BlcnRpZXMg4oCUIGl0IGNhcnJpZXMgbm9uZSBvZiB0aGUgc2NlbmUgdmFsdWVzIGl0IGhhZCAoaXNzdWVzICMyOC8jNzMpYCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBkdXAgb2YgZHVwbGljYXRlQWNjZXNzb3JLZXlzKSB7XG4gICAgICAgICAgICBpc3N1ZXMucHVzaChcbiAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2R1cC50eXBlfScgc2VyaWFsaXplcyBib3RoIGFuIGFjY2Vzc29yIGtleSBhbmQgaXRzIHVuZGVyc2NvcmUgdHdpbiBgICtcbiAgICAgICAgICAgICAgICBgKCR7ZHVwLmtleXMubWFwKGsgPT4gYCcke2t9Jy8nXyR7a30nYCkuam9pbignLCAnKX0pIOKAlCB0aGUgYXNzZXQgaW1wb3J0ZXIgcmVqZWN0cyB0aGlzIGAgK1xuICAgICAgICAgICAgICAgIGBzaGFwZSB3aXRoIFwiQ2Fubm90IHJlYWQgcHJvcGVydGllcyBvZiB1bmRlZmluZWQgKHJlYWRpbmcgJ19uYW1lJylcIiAoaXNzdWUgIzExNCkuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBpc3N1ZXMubGVuZ3RoID09PSAwLCBpc3N1ZXMsIG5vZGVDb3VudCwgY29tcG9uZW50Q291bnQsIGhvbGxvd0NvbXBvbmVudHMsIGR1cGxpY2F0ZUFjY2Vzc29yS2V5cyB9O1xuICAgIH1cblxuICAgIGNyZWF0ZVN0YW5kYXJkTWV0YUNvbnRlbnQocHJlZmFiTmFtZTogc3RyaW5nLCBwcmVmYWJVdWlkOiBzdHJpbmcpOiBhbnkge1xuICAgICAgICByZXR1cm4geyBcInZlclwiOiBcIjEuMS41MFwiLCBcImltcG9ydGVyXCI6IFwicHJlZmFiXCIsIFwiaW1wb3J0ZWRcIjogdHJ1ZSwgXCJ1dWlkXCI6IHByZWZhYlV1aWQsIFwiZmlsZXNcIjogW1wiLmpzb25cIl0sIFwic3ViTWV0YXNcIjoge30sIFwidXNlckRhdGFcIjogeyBcInN5bmNOb2RlTmFtZVwiOiBwcmVmYWJOYW1lIH0gfTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSBVVUlEIHV0aWxpdGllcyA9PT09PVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVVVSUQoKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgY2hhcnMgPSAnMDEyMzQ1Njc4OWFiY2RlZic7XG4gICAgICAgIGxldCB1dWlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDggfHwgaSA9PT0gMTIgfHwgaSA9PT0gMTYgfHwgaSA9PT0gMjApIHV1aWQgKz0gJy0nO1xuICAgICAgICAgICAgdXVpZCArPSBjaGFyc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBjaGFycy5sZW5ndGgpXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdXVpZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlRmlsZUlkKCk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGNoYXJzID0gJ2FiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5Ky8nO1xuICAgICAgICBsZXQgZmlsZUlkID0gJyc7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMjI7IGkrKykgZmlsZUlkICs9IGNoYXJzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGNoYXJzLmxlbmd0aCldO1xuICAgICAgICByZXR1cm4gZmlsZUlkO1xuICAgIH1cblxufVxuIl19