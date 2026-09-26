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
import * as fs from 'fs';
import { resolveAsset } from '../utils/asset-path';
import { extractComponentPropertyDump } from './manage-component-property-helpers';

/**
 * A dump entry is a property descriptor when it wraps a `value` and carries at least one
 * editor annotation. Deliberately looser than the inspector-side
 * `isValidPropertyDescriptor`, which rejects descriptors whose fields are all primitives
 * (`{ name, value: 60, type: 'Number' }`) because it is guarding a different case.
 */
function isPropertyDescriptor(entry: any): boolean {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if (!Object.prototype.hasOwnProperty.call(entry, 'value')) return false;
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
const DUMP_KEY_RENAMES: Record<string, Record<string, string>> = {
    'cc.UITransform': { contentSize: '_contentSize', anchorPoint: '_anchorPoint' },
    'cc.Sprite': { spriteFrame: '_spriteFrame', type: '_type', sizeMode: '_sizeMode', fillType: '_fillType' },
    'cc.Label': { string: '_string', fontSize: '_fontSize', lineHeight: '_lineHeight', overflow: '_overflow' },
    'cc.Button': { target: '_target', interactable: '_interactable', transition: '_transition' },
};

/**
 * Gap-fillers, applied only to keys the dump did not supply. These are engine defaults —
 * never an override of a captured value.
 */
const COMPONENT_DEFAULTS: Record<string, Record<string, any>> = {
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

export class PrefabCreationService {

    async createPrefabWithAssetDB(nodeUuid: string, savePath: string, prefabName: string, includeChildren: boolean, includeComponents: boolean): Promise<any> {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData) return { success: false, error: 'Cannot get node data' };

            const tempPrefabContent = JSON.stringify([{ "__type__": "cc.Prefab", "_name": prefabName }], null, 2);
            const createResult = await this.createAssetWithAssetDB(savePath, tempPrefabContent);
            if (!createResult.success) return createResult;

            const actualPrefabUuid = createResult.data?.uuid;
            if (!actualPrefabUuid) return { success: false, error: 'Cannot get engine-assigned prefab UUID' };

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
        } catch (error) {
            return { success: false, error: `Failed to create prefab: ${error}` };
        }
    }

    createPrefabNativeStub(): any {
        return {
            success: false,
            error: 'Native prefab creation API not available',
            instruction: 'To create a prefab in Cocos Creator:\n1. Select a node in the scene\n2. Drag it to the Asset Browser\n3. Or right-click the node and select "Create Prefab"'
        };
    }

    async createPrefabCustom(nodeUuid: string, prefabPath: string, prefabName: string): Promise<any> {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData) return { success: false, error: `Node not found: ${nodeUuid}` };

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
        } catch (error) {
            return { success: false, error: `Error creating prefab: ${error}` };
        }
    }

    // ===== Node data retrieval =====

    private async getNodeData(nodeUuid: string): Promise<any> {
        try {
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo) return null;
            return await this.getNodeWithChildren(nodeUuid) || nodeInfo;
        } catch {
            return null;
        }
    }

    private async getNodeWithChildren(nodeUuid: string): Promise<any> {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (!tree) return null;
            const targetNode = this.findNodeInTree(tree, nodeUuid);
            return targetNode ? await this.enhanceTreeWithMCPComponents(targetNode) : null;
        } catch {
            return null;
        }
    }

    /**
     * Enhance node tree with accurate component info via direct Editor API.
     * Replaces previous HTTP self-call to localhost:8585 which was fragile and port-dependent.
     */
    private async enhanceTreeWithMCPComponents(node: any): Promise<any> {
        if (!node || !node.uuid) return node;
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', node.uuid);
            if (nodeData) {
                // Carry the transform dump through so createEngineStandardNode can read
                // position/rotation/scale instead of falling back to identity (issue #50).
                // The query-node dump shapes these as { value: { x, y, z } } (and w for quat),
                // which is exactly the shape createEngineStandardNode reads via nodeData.position?.value.
                if (nodeData.position) node.position = nodeData.position;
                if (nodeData.rotation) node.rotation = nodeData.rotation;
                if (nodeData.scale) node.scale = nodeData.scale;
                // The layer is carried for the same reason: createEngineStandardNode hardcoded
                // DEFAULT, so every node of a created prefab landed on the DEFAULT layer and a
                // UI prefab (UI_2D) was culled by the UI camera — it rendered nothing.
                if (nodeData.layer !== undefined) node.layer = nodeData.layer;
                if (nodeData.__comps__) {
                    // `properties` carries the live property dump through to serialization.
                    // Reducing each component to type/uuid/enabled discarded every configured
                    // value before it could be written, so `action=create` saved engine
                    // defaults for every component type (#28).
                    node.components = nodeData.__comps__.map((comp: any) => ({
                        type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                        // The dump nests the component's own uuid under value.uuid.value; the
                        // top-level comp.uuid does not exist (same shape ManageComponent.getComponents
                        // already accounts for). Reading only comp.uuid left componentUuidToIndex
                        // permanently empty, so every cross-component reference on a created prefab
                        // (e.g. a script's @property(MeshRenderer)/@property(Label) field pointing at
                        // a descendant node's component) silently serialized as null.
                        uuid: comp.value?.uuid?.value || comp.uuid?.value || comp.uuid || null,
                        enabled: comp.enabled !== undefined ? comp.enabled : true,
                        properties: extractComponentPropertyDump(comp)
                    }));
                    console.log(`Node ${node.uuid} enhanced with ${node.components.length} components (incl. script types)`);
                }
            }
        } catch (error) {
            console.warn(`Failed to get component info for node ${node.uuid}:`, error);
        }
        if (node.children && Array.isArray(node.children)) {
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = await this.enhanceTreeWithMCPComponents(node.children[i]);
            }
        }
        return node;
    }

    private findNodeInTree(node: any, targetUuid: string): any {
        if (!node) return null;
        if (node.uuid === targetUuid || node.value?.uuid === targetUuid) return node;
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                const found = this.findNodeInTree(child, targetUuid);
                if (found) return found;
            }
        }
        return null;
    }

    private getChildrenToProcess(nodeData: any): any[] {
        const children: any[] = [];
        if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const child of nodeData.children) {
                if (this.isValidNodeData(child)) children.push(child);
            }
        }
        return children;
    }

    private isValidNodeData(nodeData: any): boolean {
        if (!nodeData || typeof nodeData !== 'object') return false;
        return nodeData.hasOwnProperty('uuid') || nodeData.hasOwnProperty('name') || nodeData.hasOwnProperty('__type__') ||
            (nodeData.value && (nodeData.value.hasOwnProperty('uuid') || nodeData.value.hasOwnProperty('name') || nodeData.value.hasOwnProperty('__type__')));
    }

    private extractNodeUuid(nodeData: any): string | null {
        if (!nodeData) return null;
        if (typeof nodeData.uuid === 'string') return nodeData.uuid;
        if (nodeData.value && typeof nodeData.value.uuid === 'string') return nodeData.value.uuid;
        return null;
    }

    // ===== Prefab serialization =====

    private async createStandardPrefabContent(nodeData: any, prefabName: string, prefabUuid: string, includeChildren: boolean, includeComponents: boolean): Promise<any[]> {
        const prefabData: any[] = [];
        prefabData.push({
            "__type__": "cc.Prefab", "_name": prefabName || "", "_objFlags": 0, "__editorExtras__": {},
            "_native": "", "data": { "__id__": 1 }, "optimizationPolicy": 0, "persistent": false
        });

        const context = {
            prefabData, currentId: 2, prefabAssetIndex: 0,
            nodeFileIds: new Map<string, string>(),
            nodeUuidToIndex: new Map<string, number>(),
            componentUuidToIndex: new Map<string, number>(),
            losses: [] as Array<{ property: string; uuid: string; reason: string }>
        };

        await this.createCompleteNodeTree(nodeData, null, 1, context, includeChildren, includeComponents, prefabName);
        this.lastReferenceLosses = context.losses;
        return prefabData;
    }

    /**
     * References the most recent `createStandardPrefabContent` call could not serialize.
     *
     * The create paths are plain functions returning the prefab JSON, so a loss cannot be
     * thrown from where it is detected without abandoning a valid `fatal` failure report.
     * Both create paths read this immediately after serializing and fail on a non-empty
     * list — the same contract as the existing `findComponentsThatLostProperties` check.
     */
    private lastReferenceLosses: Array<{ property: string; uuid: string; reason: string }> = [];

    private async createCompleteNodeTree(
        nodeData: any, parentNodeIndex: number | null, nodeIndex: number,
        context: { prefabData: any[]; currentId: number; prefabAssetIndex: number; nodeFileIds: Map<string, string>; nodeUuidToIndex: Map<string, number>; componentUuidToIndex: Map<string, number>; losses: Array<{ property: string; uuid: string; reason: string }> },
        includeChildren: boolean, includeComponents: boolean, nodeName?: string
    ): Promise<void> {
        const { prefabData } = context;
        const node = this.createEngineStandardNode(nodeData, parentNodeIndex, nodeName);

        while (prefabData.length <= nodeIndex) prefabData.push(null);
        prefabData[nodeIndex] = node;

        const nodeUuid = this.extractNodeUuid(nodeData);
        const fileId = nodeUuid || this.generateFileId();
        context.nodeFileIds.set(nodeIndex.toString(), fileId);
        if (nodeUuid) context.nodeUuidToIndex.set(nodeUuid, nodeIndex);

        const childrenToProcess = this.getChildrenToProcess(nodeData);
        if (includeChildren && childrenToProcess.length > 0) {
            const childIndices: number[] = [];
            for (let i = 0; i < childrenToProcess.length; i++) {
                const childIndex = context.currentId++;
                childIndices.push(childIndex);
                node._children.push({ "__id__": childIndex });
            }
            for (let i = 0; i < childrenToProcess.length; i++) {
                await this.createCompleteNodeTree(
                    childrenToProcess[i], nodeIndex, childIndices[i], context,
                    includeChildren, includeComponents, childrenToProcess[i].name || `Child${i + 1}`
                );
            }
        }

        if (includeComponents && nodeData.components && Array.isArray(nodeData.components)) {
            for (const component of nodeData.components) {
                const componentIndex = context.currentId++;
                node._components.push({ "__id__": componentIndex });
                const componentUuid = component.uuid || (component.value && component.value.uuid);
                if (componentUuid) context.componentUuidToIndex.set(componentUuid, componentIndex);
                const componentObj = this.createComponentObject(component, nodeIndex, context);
                prefabData[componentIndex] = componentObj;
                const compPrefabInfoIndex = context.currentId++;
                prefabData[compPrefabInfoIndex] = { "__type__": "cc.CompPrefabInfo", "fileId": this.generateFileId() };
                if (componentObj && typeof componentObj === 'object') componentObj.__prefab = { "__id__": compPrefabInfoIndex };
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

    /** `cc.Layers.Enum.DEFAULT` (1 << 30) — the fallback when a node dump carries no layer. */
    private static readonly DEFAULT_LAYER = 1073741824;

    /**
     * Euler angles in DEGREES to a quaternion, matching `cc.Quat.fromEuler` exactly.
     * Verified against Cocos Creator 3.8.7: euler (10, 20, 30) serializes as
     * (0.12767944069578063, 0.18930785741199999, 0.2392983377447303, 0.943714364147489).
     */
    private static eulerDegreesToQuat(e: any): { x: number; y: number; z: number; w: number } {
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

    private createEngineStandardNode(nodeData: any, parentNodeIndex: number | null, nodeName?: string): any {
        const name = nodeName || nodeData.name?.value || nodeData.name || 'Node';
        const lpos = nodeData.position?.value || nodeData.lpos?.value || nodeData._lpos || { x: 0, y: 0, z: 0 };
        const rotDump = nodeData.rotation?.value || nodeData.lrot?.value || nodeData._lrot || { x: 0, y: 0, z: 0, w: 1 };
        // `query-node` reports rotation as EULER DEGREES (cc.Vec3, no `w`) — the value the
        // inspector's Rotation field shows. `_lrot` is a quaternion, so passing the dump
        // straight through stored a degree in a quaternion component: a -0.1 degree tilt was
        // written as {z: -0.1, w: 1}, which the engine reads back as roughly -11.46 degrees.
        const isQuat = rotDump.w !== undefined;
        const lrot = isQuat ? rotDump : PrefabCreationService.eulerDegreesToQuat(rotDump);
        const euler = isQuat ? { x: 0, y: 0, z: 0 } : rotDump;
        const lscale = nodeData.scale?.value || nodeData.lscale?.value || nodeData._lscale || { x: 1, y: 1, z: 1 };
        const layerDump = nodeData.layer?.value !== undefined ? nodeData.layer.value : nodeData.layer;
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
    private createComponentObject(componentData: any, nodeIndex: number, context?: any): any {
        const componentType = componentData.type || componentData.__type__ || 'cc.Component';
        const enabled = componentData.enabled !== undefined ? componentData.enabled : true;
        const component: any = {
            "__type__": componentType, "_name": "", "_objFlags": 0, "__editorExtras__": {},
            "node": { "__id__": nodeIndex }, "_enabled": enabled, "__prefab": null
        };

        const properties = componentData.properties || {};
        const renames = DUMP_KEY_RENAMES[componentType] || {};

        for (const [key, value] of Object.entries(properties)) {
            if (DUMP_KEYS_NOT_SERIALIZED.has(key)) continue;
            const propValue = this.processComponentProperty(value, context, `${renames[key] || key}`);
            if (propValue !== undefined) component[renames[key] || key] = propValue;
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
    private countSerializableProps(properties: any): number {
        if (!properties || typeof properties !== 'object') return 0;
        return Object.keys(properties).filter(k => !DUMP_KEYS_NOT_SERIALIZED.has(k)).length;
    }

    /**
     * Report component types that carried live properties in the scene but serialized to
     * nothing but the base envelope. `action=create` previously reported success in
     * exactly that state (#28).
     */
    private findComponentsThatLostProperties(prefabData: any[], nodeData: any): string[] {
        const expected = new Set<string>();
        const walk = (node: any) => {
            if (!node) return;
            for (const comp of (node.components || [])) {
                if (this.countSerializableProps(comp?.properties) > 0) {
                    expected.add(comp.type || comp.__type__ || 'Unknown');
                }
            }
            for (const child of (node.children || [])) walk(child);
        };
        walk(nodeData);
        if (expected.size === 0) return [];

        const populated = new Set<string>();
        for (const entry of prefabData) {
            if (!entry || typeof entry !== 'object' || !expected.has(entry.__type__)) continue;
            if (Object.keys(entry).some(key => !BASE_COMPONENT_KEYS.has(key))) populated.add(entry.__type__);
        }
        return [...expected].filter(type => !populated.has(type));
    }

    /** Re-read the written prefab; falls back to the in-memory content when the path is unresolvable. */
    private async readBackPrefab(savePath: string, fallback: any[]): Promise<{ data: any[]; source: 'disk' | 'in-memory' }> {
        try {
            const resolved = await resolveAsset(savePath);
            if (resolved.filePath) {
                const parsed = JSON.parse(fs.readFileSync(resolved.filePath, 'utf-8'));
                if (Array.isArray(parsed)) return { data: parsed, source: 'disk' };
            }
        } catch {
            // fall through to the in-memory content
        }
        return { data: fallback, source: 'in-memory' };
    }

    /** Type names whose dump value is an ASSET reference rather than a component reference. */
    private static readonly ASSET_TYPES = new Set([
        'cc.Prefab', 'cc.Texture2D', 'cc.SpriteFrame', 'cc.Material', 'cc.AnimationClip',
        'cc.AudioClip', 'cc.Font', 'cc.Asset', 'cc.TTFFont', 'cc.BitmapFont', 'cc.LabelAtlas',
        'cc.SpriteAtlas', 'cc.JsonAsset', 'cc.TextAsset', 'cc.ParticleAsset', 'cc.Mesh',
        'cc.Skeleton', 'cc.RenderTexture', 'cc.PhysicsMaterial', 'cc.SceneAsset', 'cc.EffectAsset',
    ]);

    /**
     * An asset is either explicitly listed or named by a suffix no component type uses.
     * The suffix arm is what keeps a future concrete asset subclass from silently regressing
     * into the component-reference branch the way cc.TTFFont did.
     */
    private static isAssetType(type: string | undefined): boolean {
        if (!type) return false;
        if (PrefabCreationService.ASSET_TYPES.has(type)) return true;
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
    private processComponentProperty(propData: any, context?: {
        nodeUuidToIndex?: Map<string, number>;
        componentUuidToIndex?: Map<string, number>;
        losses?: Array<{ property: string; uuid: string; reason: string }>;
    }, propertyPath = ''): any {
        if (!propData || typeof propData !== 'object') return propData;
        const value = propData.value;
        const type = propData.type;
        if (value === null || value === undefined) return null;
        // An explicit empty-uuid reference is a genuine CLEAR (issue #75), not a loss.
        if (value && typeof value === 'object' && value.uuid === '') return null;

        // Node references
        if (type === 'cc.Node' && value?.uuid) {
            if (context?.nodeUuidToIndex?.has(value.uuid)) return { "__id__": context.nodeUuidToIndex.get(value.uuid) };
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
        if (value?.uuid) {
            if (PrefabCreationService.isAssetType(type)) {
                return { "__uuid__": value.uuid, "__expectedType__": type };
            }
            // In-tree component reference: the uuid names a component in the subtree being
            // serialized, so it encodes as an object index.
            if (context?.componentUuidToIndex?.has(value.uuid)) {
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
            this.recordLoss(
                context, propertyPath, value.uuid,
                `type '${type}' has no encodable form — either it is outside the prefab subtree (legitimate for a component reference) ` +
                `or it is an asset class missing from PrefabCreationService.ASSET_TYPES (issues #64/#70/#73)`
            );
            return null;
        }

        // Typed math/color objects
        if (value && typeof value === 'object') {
            if (type === 'cc.Color') return { "__type__": "cc.Color", "r": Math.min(255, Math.max(0, Number(value.r) || 0)), "g": Math.min(255, Math.max(0, Number(value.g) || 0)), "b": Math.min(255, Math.max(0, Number(value.b) || 0)), "a": value.a !== undefined ? Math.min(255, Math.max(0, Number(value.a))) : 255 };
            if (type === 'cc.Vec3') return { "__type__": "cc.Vec3", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0 };
            if (type === 'cc.Vec2') return { "__type__": "cc.Vec2", "x": Number(value.x) || 0, "y": Number(value.y) || 0 };
            if (type === 'cc.Size') return { "__type__": "cc.Size", "width": Number(value.width) || 0, "height": Number(value.height) || 0 };
            if (type === 'cc.Quat') return { "__type__": "cc.Quat", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0, "w": value.w !== undefined ? Number(value.w) : 1 };
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
            const elementType = propData.elementTypeData?.type;
            const serialized = value.map((item: any, index: number) => {
                const itemUuid = item?.uuid || item?.value?.uuid;
                if (!itemUuid && elementType && !elementType.startsWith('cc.')) {
                    // Not a reference array at all — an array of plain values.
                    return item?.value !== undefined ? item.value : item;
                }
                // An element's own `type` is authoritative; `elementTypeData` is only the
                // declared array element class, and for a subclass element (`cc.TTFFont`
                // under a `cc.Font[]`, a nested-descriptor material) the declared class is
                // the wrong thing to write.
                return this.processComponentProperty(
                    { value: item?.value !== undefined ? item.value : item, type: item?.type || elementType },
                    context,
                    `${propertyPath}[${index}]`
                );
            });
            // A dropped element is a loss, not a shorter array. `map` never produces
            // undefined here, so this only fires if a future branch starts returning it.
            return serialized.filter((entry: any) => entry !== undefined && entry !== null);
        }

        // Nested CCClass group: the dump nests another descriptor map under `value`.
        // Serializing it verbatim would write editor descriptors ({name, value, type})
        // into the asset instead of the values themselves.
        if (value && typeof value === 'object' && !Array.isArray(value) && this.isNestedPropertyMap(value)) {
            const nested: any = type ? { "__type__": type } : {};
            for (const [key, entry] of Object.entries(value)) {
                if (DUMP_KEYS_NOT_SERIALIZED.has(key)) continue;
                const nestedValue = this.processComponentProperty(
                    entry, context, propertyPath ? `${propertyPath}.${key}` : key
                );
                if (nestedValue !== undefined) nested[key] = nestedValue;
            }
            return nested;
        }

        // Other complex typed objects
        if (value && typeof value === 'object' && type?.startsWith('cc.')) return { "__type__": type, ...value };
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
    private recordLoss(
        context: { losses?: Array<{ property: string; uuid: string; reason: string }> } | undefined,
        property: string,
        uuid: string,
        reason: string
    ): void {
        if (!context?.losses) return;
        context.losses.push({ property: property || '(unknown)', uuid, reason });
    }

    /** Render recorded losses as the fatal failure message, or null when there are none. */
    private describeReferenceLosses(losses: Array<{ property: string; uuid: string; reason: string }>): string | null {
        if (losses.length === 0) return null;
        const named = losses.map(l => `'${l.property}' -> ${l.uuid} (${l.reason})`);
        return `${losses.length} reference(s) could not be serialized: ${named.join('; ')}.`;
    }

    /** True when every entry is an object and at least one is a Cocos property descriptor. */
    private isNestedPropertyMap(value: Record<string, any>): boolean {
        const entries = Object.entries(value);
        if (entries.length === 0) return false;
        return entries.every(([, entry]) => entry !== null && typeof entry === 'object')
            && entries.some(([, entry]) => isPropertyDescriptor(entry));
    }

    // ===== Asset DB operations =====

    private async convertNodeToPrefabInstance(nodeUuid: string, prefabRef: string, prefabUuid: string): Promise<any> {
        const methods = [
            () => Editor.Message.request('scene', 'connect-prefab-instance', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'set-prefab-connection', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'apply-prefab-link', { node: nodeUuid, prefab: prefabRef })
        ];
        for (const method of methods) {
            try { await method(); return { success: true }; } catch { /* try next */ }
        }
        return { success: false, error: 'All prefab connection methods failed' };
    }

    private async savePrefabWithMeta(prefabPath: string, prefabData: any[], metaData: any): Promise<any> {
        try {
            await this.saveAssetFile(prefabPath, JSON.stringify(prefabData, null, 2));
            await this.saveAssetFile(`${prefabPath}.meta`, JSON.stringify(metaData, null, 2));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to save prefab file' };
        }
    }

    private async saveAssetFile(filePath: string, content: string): Promise<void> {
        const methods = [
            () => Editor.Message.request('asset-db', 'create-asset', filePath, content),
            () => Editor.Message.request('asset-db', 'save-asset', filePath, content),
            () => Editor.Message.request('asset-db', 'write-asset', filePath, content)
        ];
        for (const method of methods) {
            try { await method(); return; } catch { /* try next */ }
        }
        throw new Error('All save methods failed');
    }

    private async createAssetWithAssetDB(assetPath: string, content: string): Promise<any> {
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'create-asset', assetPath, content, { overwrite: true, rename: false });
            return { success: true, data: assetInfo };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create asset file' };
        }
    }

    private async createMetaWithAssetDB(assetPath: string, metaContent: any): Promise<any> {
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'save-asset-meta', assetPath, JSON.stringify(metaContent, null, 2));
            return { success: true, data: assetInfo };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create meta file' };
        }
    }

    private async reimportAssetWithAssetDB(assetPath: string): Promise<any> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'reimport-asset', assetPath);
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to reimport asset' };
        }
    }

    private async updateAssetWithAssetDB(assetPath: string, content: string): Promise<any> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'save-asset', assetPath, content);
            return { success: true, data: result };
        } catch (error: any) {
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
    validatePrefabFormat(prefabData: any): { isValid: boolean; issues: string[]; nodeCount: number; componentCount: number; hollowComponents: string[] } {
        const issues: string[] = [];
        const hollowComponents: string[] = [];
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
        const nodesWithComponents = new Set<number>();
        prefabData.forEach((item: any) => {
            if (item.__type__ === 'cc.Node') {
                nodeCount++;
                for (const ref of (item._components || [])) {
                    if (ref && typeof ref.__id__ === 'number') nodesWithComponents.add(ref.__id__);
                }
            } else if (item.__type__ === 'cc.CompPrefabInfo' || !item.__type__) {
                // Serialization bookkeeping, never a component instance.
            } else if (String(item.__type__).startsWith('cc.') || item.__type__) {
                componentCount++;
                // A component that is referenced from a node but carries nothing but the
                // envelope has lost every property it held in the scene (#28/#73).
                const holdsNothingButEnvelope = Object.keys(item).every(key => BASE_COMPONENT_KEYS.has(key));
                if (holdsNothingButEnvelope && typeof item.node?.__id__ === 'number') {
                    hollowComponents.push(String(item.__type__));
                }
            }
        });
        if (nodeCount === 0) issues.push('Prefab must contain at least one node');
        for (const hollow of [...new Set(hollowComponents)]) {
            issues.push(`Component '${hollow}' serialized with no properties — it carries none of the scene values it had (issues #28/#73)`);
        }
        return { isValid: issues.length === 0, issues, nodeCount, componentCount, hollowComponents };
    }

    createStandardMetaContent(prefabName: string, prefabUuid: string): any {
        return { "ver": "1.1.50", "importer": "prefab", "imported": true, "uuid": prefabUuid, "files": [".json"], "subMetas": {}, "userData": { "syncNodeName": prefabName } };
    }

    // ===== UUID utilities =====

    private generateUUID(): string {
        const chars = '0123456789abcdef';
        let uuid = '';
        for (let i = 0; i < 32; i++) {
            if (i === 8 || i === 12 || i === 16 || i === 20) uuid += '-';
            uuid += chars[Math.floor(Math.random() * chars.length)];
        }
        return uuid;
    }

    private generateFileId(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
        let fileId = '';
        for (let i = 0; i < 22; i++) fileId += chars[Math.floor(Math.random() * chars.length)];
        return fileId;
    }

}
