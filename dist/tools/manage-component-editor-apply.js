"use strict";
/**
 * Editor API calls for applying component property values.
 * Extracted from ManageComponent.setComponentProperty (Step 6).
 * Each property type uses a different dump format for Editor.Message.request('scene', 'set-property').
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssetType = resolveAssetType;
exports.applyPropertyToEditor = applyPropertyToEditor;
const manage_component_property_helpers_1 = require("./manage-component-property-helpers");
/** Property-name substrings that mark a bare `string` value as an asset reference. */
const NAME_HINTED_ASSET_KEYWORDS = ['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'];
/**
 * Resolve the Cocos asset class for the Editor `set-property` dump `type` field.
 *
 * An explicit propertyType (`material`, `mesh`, …) wins, because it is authoritative.
 * Only the generic `asset` / `string` spellings — which carry no type information — fall back
 * to the property-name heuristic, so existing callers using those keep their exact behaviour.
 */
function resolveAssetType(propertyType, property) {
    const explicit = manage_component_property_helpers_1.ASSET_TYPE_BY_PROPERTY_TYPE[propertyType];
    if (explicit)
        return explicit;
    const name = property.toLowerCase();
    if (name.includes('texture'))
        return 'cc.Texture2D';
    if (name.includes('material'))
        return 'cc.Material';
    if (name.includes('font'))
        return 'cc.Font';
    if (name.includes('clip'))
        return 'cc.AudioClip';
    return 'cc.SpriteFrame';
}
/**
 * Apply a processed property value to the Cocos Creator editor scene.
 * Returns the actual expected value (may differ from processedValue for component refs).
 * Throws on unrecoverable Editor API error.
 */
async function applyPropertyToEditor(args, getComponentInfo) {
    const { nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue } = args;
    let actualExpectedValue = processedValue;
    // EVERY asset-reference propertyType must land here. Falling through to the terminal `else`
    // sends a dump with no `type` field — the same shape that makes the nodeArray path fail
    // (issue #18) — so an accepted-but-typeless propertyType would silently not apply.
    // An explicit `propertyType: 'string'` is authoritative — a property-name substring
    // must never re-route it to the asset-reference branch (issue #46: `fireClipName` was
    // coerced to `cc.AudioClip`, nulling the field and dropping it from the component dump).
    // The name-hint heuristic applies ONLY to the generic `asset` spelling, which carries
    // no type information of its own.
    if (manage_component_property_helpers_1.ASSET_REFERENCE_PROPERTY_TYPES.includes(propertyType) ||
        (propertyType === 'asset' && NAME_HINTED_ASSET_KEYWORDS.some(k => property.toLowerCase().includes(k)))) {
        const assetType = resolveAssetType(propertyType, property);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: processedValue, type: assetType }
        });
    }
    else if (componentType === 'cc.UITransform' && (property === '_contentSize' || property === 'contentSize')) {
        const width = Number(value.width) || 100;
        const height = Number(value.height) || 100;
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.width`, dump: { value: width }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.height`, dump: { value: height }
        });
    }
    else if (componentType === 'cc.UITransform' && (property === '_anchorPoint' || property === 'anchorPoint')) {
        const anchorX = Number(value.x) || 0.5;
        const anchorY = Number(value.y) || 0.5;
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.anchorX`, dump: { value: anchorX }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.anchorY`, dump: { value: anchorY }
        });
    }
    else if (propertyType === 'color' && processedValue && typeof processedValue === 'object') {
        const colorValue = {
            r: Math.min(255, Math.max(0, Number(processedValue.r) || 0)),
            g: Math.min(255, Math.max(0, Number(processedValue.g) || 0)),
            b: Math.min(255, Math.max(0, Number(processedValue.b) || 0)),
            a: processedValue.a !== undefined ? Math.min(255, Math.max(0, Number(processedValue.a))) : 255
        };
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: colorValue, type: 'cc.Color' }
        });
    }
    else if (propertyType === 'vec3' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0, z: Number(processedValue.z) || 0 }, type: 'cc.Vec3' }
        });
    }
    else if (propertyType === 'vec2' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0 }, type: 'cc.Vec2' }
        });
    }
    else if (propertyType === 'size' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { width: Number(processedValue.width) || 0, height: Number(processedValue.height) || 0 }, type: 'cc.Size' }
        });
    }
    else if (propertyType === 'node' && processedValue && typeof processedValue === 'object' && 'uuid' in processedValue) {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue, type: 'cc.Node' }
        });
    }
    else if (propertyType === 'component' && processedValue && typeof processedValue === 'object' && 'uuid' in processedValue) {
        // Issue #75: clearing a component reference (`convertPropertyValue` returns
        // `{ uuid: '' }` for a null/'' input) — write it DIRECTLY. There is no target to
        // resolve, and resolveComponentReference would only report '' as neither a node
        // uuid nor a component uuid.
        const expectedComponentType = await resolveExpectedComponentType(nodeUuid, componentType, property, getComponentInfo);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { uuid: '' }, type: expectedComponentType || 'cc.Component' }
        });
        actualExpectedValue = { uuid: '' };
    }
    else if (propertyType === 'component' && typeof processedValue === 'string') {
        actualExpectedValue = await applyComponentReference(nodeUuid, propertyPath, componentType, property, processedValue, getComponentInfo);
    }
    else if (propertyType === 'nodeArray' && Array.isArray(processedValue)) {
        // Without an explicit type/isArray/elementTypeData, the editor's set-property
        // dump has no way to know this is an array of cc.Node references — it falls
        // through as a bare value and silently does not apply (issue #18), the same
        // failure mode as the asset-reference types before they gained an explicit
        // `type` field (see the asset-reference branch above).
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: processedValue, type: 'cc.Node', isArray: true, elementTypeData: { value: null, type: 'cc.Node' } }
        });
    }
    else if (propertyType === 'assetArray' && Array.isArray(processedValue)) {
        // Same explicit array dump as nodeArray (issue #18), typed with the property's
        // DECLARED element class — the editor needs it to deserialize each `{ uuid }`.
        const elementType = await resolveDeclaredAssetElementType(nodeUuid, componentType, property, getComponentInfo);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: processedValue, type: elementType, isArray: true, elementTypeData: { value: null, type: elementType } }
        });
    }
    else if (propertyType === 'componentArray' && Array.isArray(processedValue)) {
        actualExpectedValue = await applyComponentReferenceArray(nodeUuid, propertyPath, componentType, property, processedValue, getComponentInfo);
    }
    else if (propertyType === 'colorArray' && Array.isArray(processedValue)) {
        const colorArrayValue = processedValue.map((item) => {
            if (item && typeof item === 'object' && 'r' in item) {
                return {
                    r: Math.min(255, Math.max(0, Number(item.r) || 0)),
                    g: Math.min(255, Math.max(0, Number(item.g) || 0)),
                    b: Math.min(255, Math.max(0, Number(item.b) || 0)),
                    a: item.a !== undefined ? Math.min(255, Math.max(0, Number(item.a))) : 255
                };
            }
            return { r: 255, g: 255, b: 255, a: 255 };
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: colorArrayValue, type: 'cc.Color' }
        });
    }
    else {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue }
        });
    }
    return actualExpectedValue;
}
/**
 * Treat 'Unknown' as missing — it appears when a previous assignment stored a value
 * whose runtime type didn't match the @property declared type, leaving the dump's
 * type field stale.
 */
function isUsableType(t) {
    return typeof t === 'string' && t.length > 0 && t !== 'Unknown';
}
/**
 * Resolve the DECLARED element class of an asset-array @property (e.g. `cc.AudioClip` for
 * `@property({ type: [AudioClip] })`) from the holder component's dump. Prefers
 * `elementTypeData.type`, then the array dump's own `type`; falls back to `cc.Asset` when
 * neither is readable.
 */
async function resolveDeclaredAssetElementType(nodeUuid, componentType, property, getComponentInfo) {
    var _a, _b;
    const info = await getComponentInfo(nodeUuid, componentType);
    let meta = info.success ? (_a = info.data) === null || _a === void 0 ? void 0 : _a.properties : undefined;
    const segments = property.split('.');
    for (let i = 0; i < segments.length && meta; i++) {
        meta = meta[segments[i]];
        const isLeaf = i === segments.length - 1;
        if (!isLeaf && meta && typeof meta === 'object' && 'value' in meta && typeof meta.value === 'object') {
            meta = meta.value;
        }
    }
    if (meta && typeof meta === 'object') {
        if (isUsableType((_b = meta.elementTypeData) === null || _b === void 0 ? void 0 : _b.type))
            return meta.elementTypeData.type;
        if (isUsableType(meta.type))
            return meta.type;
    }
    return 'cc.Asset';
}
/**
 * Resolve the DECLARED type of a `component`/`componentArray` @property from the holder
 * component's own dump. Extracted from `resolveComponentReference` so a reference CLEAR
 * (issue #75, `{ uuid: '' }`) can get the type it needs for the `set-property` dump
 * without going through that function's TARGET resolution — there is nothing to resolve
 * for an empty target, and it would only fail trying.
 */
async function resolveExpectedComponentType(nodeUuid, componentType, property, getComponentInfo) {
    var _a;
    const currentComponentInfo = await getComponentInfo(nodeUuid, componentType);
    // Walk dotted property paths through nested CCClass group dumps to find the metadata descriptor.
    let propertyMeta = currentComponentInfo.success ? (_a = currentComponentInfo.data) === null || _a === void 0 ? void 0 : _a.properties : undefined;
    if (propertyMeta) {
        const segments = property.split('.');
        for (let i = 0; i < segments.length && propertyMeta; i++) {
            propertyMeta = propertyMeta[segments[i]];
            const isLeaf = i === segments.length - 1;
            if (!isLeaf && propertyMeta && typeof propertyMeta === 'object' && 'value' in propertyMeta && typeof propertyMeta.value === 'object') {
                propertyMeta = propertyMeta.value;
            }
        }
    }
    let expectedComponentType = '';
    if (propertyMeta && typeof propertyMeta === 'object') {
        if (isUsableType(propertyMeta.type)) {
            expectedComponentType = propertyMeta.type;
        }
        else if (isUsableType(propertyMeta.ctor)) {
            expectedComponentType = propertyMeta.ctor;
        }
        else if (propertyMeta.extends && Array.isArray(propertyMeta.extends)) {
            for (const extendType of propertyMeta.extends) {
                if (extendType.startsWith('cc.') && extendType !== 'cc.Component' && extendType !== 'cc.Object') {
                    expectedComponentType = extendType;
                    break;
                }
            }
        }
    }
    return expectedComponentType;
}
/**
 * Resolve a target node's component reference to its scene component id, WITHOUT
 * performing the `set-property` write. Shared by the single-`component` propertyType
 * (which writes one `{ uuid }` value) and the `componentArray` propertyType (which
 * writes a whole array in one set-property call, so per-element writes must not happen
 * here — issue #18).
 */
async function resolveComponentReference(nodeUuid, componentType, property, targetNodeUuid, getComponentInfo) {
    console.log(`[ManageComponent] Setting component reference - finding component on node: ${targetNodeUuid}`);
    let expectedComponentType = await resolveExpectedComponentType(nodeUuid, componentType, property, getComponentInfo);
    // `query-node` REJECTS on some editor builds and resolves falsy on others; both mean
    // the same thing here — the value is not a node uuid.
    let targetNodeData = null;
    try {
        targetNodeData = await Editor.Message.request('scene', 'query-node', targetNodeUuid);
    }
    catch (_a) {
        targetNodeData = null;
    }
    if (!targetNodeData || !targetNodeData.__comps__) {
        // The caller may have passed the COMPONENT's own uuid — the `uuid` field that
        // manage_component get_all / get_info return, and the obvious thing to reach for
        // when wiring a @property(SomeComponent) reference. Accept that spelling instead
        // of reporting a correct uuid as a missing node.
        //
        // Resolve-only, exactly like the node path below — this function has no
        // `propertyPath` and must never write. The caller (applyComponentReference for a
        // single reference, applyComponentReferenceArray for an array) performs the ONE
        // set-property write; a write here would fire once per element on a componentArray
        // (issue #18).
        const direct = await queryComponentByUuid(targetNodeUuid);
        if (!direct) {
            throw new Error(`'${targetNodeUuid}' is neither a node uuid nor a component uuid. ` +
                `Pass the uuid of the NODE that holds the component, or the component's own ` +
                `uuid from manage_component action=get_all.`);
        }
        const directType = expectedComponentType || direct.type;
        if (!directType) {
            throw new Error(`Unable to determine required component type for property '${property}' on component '${componentType}'. Property metadata may not contain type information.`);
        }
        // The node path below only ever resolves a component whose type EXACTLY matches
        // expectedComponentType (its search loop rejects anything else). `expectedComponentType
        // || direct.type` only falls back to direct.type when expectedComponentType is empty;
        // it never validated the two against each other when expectedComponentType WAS known,
        // letting a mismatched component (e.g. a cc.Sprite uuid on a property typed
        // HeroDragController) resolve unrejected. A direct.type that is itself unusable
        // ('Unknown'/blank) cannot disprove a match, so it is left to fall through.
        if (expectedComponentType && isUsableType(direct.type) && direct.type !== expectedComponentType) {
            // Issue #81: the same polymorphic gap issue #45 fixed on the node-uuid path
            // below — expectedComponentType may be a BASE class while direct.type is a
            // SUBCLASS. A literal string mismatch can't disprove that; ask the live
            // class registry before rejecting a component that would actually satisfy
            // the declared property type.
            let isSubclass = false;
            try {
                const subclassResult = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'isComponentTypeSubclassOf', args: [direct.type, expectedComponentType]
                });
                isSubclass = !!(subclassResult && subclassResult.success && subclassResult.data && subclassResult.data.isSubclass);
            }
            catch (_b) {
                isSubclass = false;
            }
            if (!isSubclass) {
                throw new Error(`Component uuid '${targetNodeUuid}' is a '${direct.type}', but property '${property}' ` +
                    `on '${componentType}' requires a '${expectedComponentType}'.`);
            }
        }
        return { componentId: direct.uuid, expectedComponentType: directType };
    }
    // Single-cc-component fallback: when expectedComponentType could not be inferred
    // (e.g., stale 'Unknown' in dump and extends only lists cc.Component/cc.Object),
    // and the target node has exactly one cc.* component, use it. Mirrors Cocos's
    // drag-from-hierarchy auto-resolve behavior.
    if (!expectedComponentType) {
        const ccComps = targetNodeData.__comps__
            .filter(c => typeof c.type === 'string' && c.type.startsWith('cc.')
            && c.type !== 'cc.Component' && c.type !== 'cc.Object');
        if (ccComps.length === 1) {
            expectedComponentType = ccComps[0].type;
        }
    }
    if (!expectedComponentType) {
        throw new Error(`Unable to determine required component type for property '${property}' on component '${componentType}'. Property metadata may not contain type information.`);
    }
    let componentId = null;
    let foundComponent = null;
    for (let i = 0; i < targetNodeData.__comps__.length; i++) {
        const comp = targetNodeData.__comps__[i];
        if (comp.type === expectedComponentType) {
            foundComponent = comp;
            if (comp.value && comp.value.uuid && comp.value.uuid.value) {
                componentId = comp.value.uuid.value;
            }
            else {
                throw new Error(`Unable to extract component ID from component structure`);
            }
            break;
        }
    }
    if (!foundComponent) {
        // Issue #45: expectedComponentType may be a BASE class (declared on the
        // @property) while every component actually on the node is a SUBCLASS — an
        // exact string match against comp.type can never succeed for a polymorphic
        // reference, even though the engine's own node.getComponent(BaseClass) already
        // resolves subclass instances. Fall back to that live-scene, inheritance-aware
        // lookup before giving up.
        let baseClassResult = null;
        try {
            baseClassResult = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'findComponentByBaseClass', args: [targetNodeUuid, expectedComponentType]
            });
        }
        catch (_c) {
            baseClassResult = null;
        }
        if (baseClassResult && baseClassResult.success && baseClassResult.data && baseClassResult.data.componentUuid) {
            return { componentId: baseClassResult.data.componentUuid, expectedComponentType };
        }
        const available = targetNodeData.__comps__.map((comp) => {
            const sceneId = comp.value && comp.value.uuid && comp.value.uuid.value ? comp.value.uuid.value : 'unknown';
            return `${comp.type}(scene_id:${sceneId})`;
        });
        throw new Error(`Component type '${expectedComponentType}' not found on node ${targetNodeUuid}. Available components: ${available.join(', ')}`);
    }
    if (!componentId) {
        throw new Error(`Unable to extract component ID from component structure`);
    }
    return { componentId, expectedComponentType };
}
/** Resolve a component reference and write it as a single `{ uuid }` value. */
async function applyComponentReference(nodeUuid, propertyPath, componentType, property, targetNodeUuid, getComponentInfo) {
    const { componentId, expectedComponentType } = await resolveComponentReference(nodeUuid, componentType, property, targetNodeUuid, getComponentInfo);
    await Editor.Message.request('scene', 'set-property', {
        uuid: nodeUuid, path: propertyPath,
        dump: { value: { uuid: componentId }, type: expectedComponentType }
    });
    return { uuid: componentId };
}
/**
 * Resolve an array of target-node UUIDs to their component references and write the
 * whole array in ONE set-property call (matching the nodeArray fix above — an array
 * property needs `isArray`/`elementTypeData` in the dump, not N separate scalar writes).
 * An empty input array is guarded explicitly: there is no element to resolve a
 * component type from, so it is written as an empty array with a generic element type
 * rather than indexing into an array that has no `[0]`.
 */
async function applyComponentReferenceArray(nodeUuid, propertyPath, componentType, property, targetNodeUuids, getComponentInfo) {
    if (targetNodeUuids.length === 0) {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: [], isArray: true, elementTypeData: { value: null, type: 'cc.Component' } }
        });
        return [];
    }
    const resolvedRefs = [];
    let elementType = '';
    for (const targetNodeUuid of targetNodeUuids) {
        if (typeof targetNodeUuid !== 'string') {
            throw new Error('componentArray items must be string node UUIDs (each containing the target component)');
        }
        const { componentId, expectedComponentType } = await resolveComponentReference(nodeUuid, componentType, property, targetNodeUuid, getComponentInfo);
        resolvedRefs.push({ uuid: componentId });
        elementType = elementType || expectedComponentType;
    }
    await Editor.Message.request('scene', 'set-property', {
        uuid: nodeUuid, path: propertyPath,
        dump: { value: resolvedRefs, isArray: true, elementTypeData: { value: null, type: elementType } }
    });
    return resolvedRefs;
}
/**
 * Look a uuid up as a COMPONENT rather than a node.
 *
 * `query-component` answers for a component's own uuid and returns the same dump shape as
 * one `__comps__` entry, so `value.uuid.value` and `type` read exactly as they do on the
 * node path. Returns null for anything that is not a live component — including a uuid
 * that names nothing at all — so the caller can report both accepted spellings.
 */
async function queryComponentByUuid(uuid) {
    var _a, _b, _c;
    try {
        const comp = await Editor.Message.request('scene', 'query-component', uuid);
        if (!comp)
            return null;
        const resolvedUuid = ((_b = (_a = comp.value) === null || _a === void 0 ? void 0 : _a.uuid) === null || _b === void 0 ? void 0 : _b.value) || ((_c = comp.uuid) === null || _c === void 0 ? void 0 : _c.value) || comp.uuid || uuid;
        const type = comp.type || comp.cid || comp.__type__ || '';
        return { uuid: resolvedUuid, type };
    }
    catch (_d) {
        return null;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUFrQkQsc0RBZ0pDO0FBeExELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQ3ZDLElBQXVCLEVBQ3ZCLGdCQUF3RjtJQUV4RixNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUs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QUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtZQUNsRCxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZO1lBQ2xDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUM3SSxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN6RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUMzRyxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN6RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUM3SCxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLElBQUksTUFBTSxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ3JILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtZQUNsRCxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFO1NBQ3ZGLENBQUMsQ0FBQztJQUVQLENBQUM7U0FBTSxJQUFJLFlBQVksS0FBSyxXQUFXLElBQUksY0FBYyxJQUFJLE9BQU8sY0FBYyxLQUFLLFFBQVEsSUFBSSxNQUFNLElBQUksY0FBYyxFQUFFLENBQUM7UUFDMUgsNEVBQTRFO1FBQzVFLGlGQUFpRjtRQUNqRixnRkFBZ0Y7UUFDaEYsNkJBQTZCO1FBQzdCLE1BQU0scUJBQXFCLEdBQUcsTUFBTSw0QkFBNEIsQ0FBQyxRQUFRLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3RILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtZQUNsRCxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZO1lBQ2xDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUscUJBQXFCLElBQUksY0FBYyxFQUFFO1NBQy9FLENBQUMsQ0FBQztRQUNILG1CQUFtQixHQUFHLEVBQUUsSUFBSSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBRXZDLENBQUM7U0FBTSxJQUFJLFlBQVksS0FBSyxXQUFXLElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDNUUsbUJBQW1CLEdBQUcsTUFBTSx1QkFBdUIsQ0FDL0MsUUFBUSxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FDcEYsQ0FBQztJQUVOLENBQUM7U0FBTSxJQUFJLFlBQVksS0FBSyxXQUFXLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsRUFBRSxDQUFDO1FBQ3ZFLDhFQUE4RTtRQUM5RSw0RUFBNEU7UUFDNUUsNEVBQTRFO1FBQzVFLDJFQUEyRTtRQUMzRSx1REFBdUQ7UUFDdkQsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDbEMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUU7U0FDckgsQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLFlBQVksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7UUFDeEUsK0VBQStFO1FBQy9FLCtFQUErRTtRQUMvRSxNQUFNLFdBQVcsR0FBRyxNQUFNLCtCQUErQixDQUFDLFFBQVEsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDL0csTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDbEMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUU7U0FDekgsQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLGdCQUFnQixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLEVBQUUsQ0FBQztRQUM1RSxtQkFBbUIsR0FBRyxNQUFNLDRCQUE0QixDQUNwRCxRQUFRLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixDQUNwRixDQUFDO0lBRU4sQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLFlBQVksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7UUFDeEUsTUFBTSxlQUFlLEdBQUcsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO1lBQ3JELElBQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUM7Z0JBQ2xELE9BQU87b0JBQ0gsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ2xELENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNsRCxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDbEQsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztpQkFDN0UsQ0FBQztZQUNOLENBQUM7WUFDRCxPQUFPLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQzlDLENBQUMsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUU7U0FDekYsQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLENBQUM7UUFDSixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUU7U0FDdEUsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELE9BQU8sbUJBQW1CLENBQUM7QUFDL0IsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxTQUFTLFlBQVksQ0FBQyxDQUFNO0lBQ3hCLE9BQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7QUFDcEUsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsS0FBSyxVQUFVLCtCQUErQixDQUMxQyxRQUFnQixFQUNoQixhQUFxQixFQUNyQixRQUFnQixFQUNoQixnQkFBd0Y7O0lBRXhGLE1BQU0sSUFBSSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzdELElBQUksSUFBSSxHQUFRLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQUEsSUFBSSxDQUFDLElBQUksMENBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7SUFDakUsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNyQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sSUFBSSxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUMvQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDbkcsSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDdEIsQ0FBQztJQUNMLENBQUM7SUFDRCxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNuQyxJQUFJLFlBQVksQ0FBQyxNQUFBLElBQUksQ0FBQyxlQUFlLDBDQUFFLElBQUksQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7UUFDL0UsSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNsRCxDQUFDO0lBQ0QsT0FBTyxVQUFVLENBQUM7QUFDdEIsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILEtBQUssVUFBVSw0QkFBNEIsQ0FDdkMsUUFBZ0IsRUFDaEIsYUFBcUIsRUFDckIsUUFBZ0IsRUFDaEIsZ0JBQXdGOztJQUV4RixNQUFNLG9CQUFvQixHQUFHLE1BQU0sZ0JBQWdCLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzdFLGlHQUFpRztJQUNqRyxJQUFJLFlBQVksR0FBUSxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQUEsb0JBQW9CLENBQUMsSUFBSSwwQ0FBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN6RyxJQUFJLFlBQVksRUFBRSxDQUFDO1FBQ2YsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNyQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sSUFBSSxZQUFZLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUN2RCxZQUFZLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUN6QyxJQUFJLENBQUMsTUFBTSxJQUFJLFlBQVksSUFBSSxPQUFPLFlBQVksS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLFlBQVksSUFBSSxPQUFPLFlBQVksQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ25JLFlBQVksR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDO1lBQ3RDLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVELElBQUkscUJBQXFCLEdBQUcsRUFBRSxDQUFDO0lBQy9CLElBQUksWUFBWSxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ25ELElBQUksWUFBWSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ2xDLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7UUFDOUMsQ0FBQzthQUFNLElBQUksWUFBWSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3pDLHFCQUFxQixHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7UUFDOUMsQ0FBQzthQUFNLElBQUksWUFBWSxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ3JFLEtBQUssTUFBTSxVQUFVLElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUM1QyxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksVUFBVSxLQUFLLGNBQWMsSUFBSSxVQUFVLEtBQUssV0FBVyxFQUFFLENBQUM7b0JBQzlGLHFCQUFxQixHQUFHLFVBQVUsQ0FBQztvQkFDbkMsTUFBTTtnQkFDVixDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBQ0QsT0FBTyxxQkFBcUIsQ0FBQztBQUNqQyxDQUFDO0FBRUQ7Ozs7OztHQU1HO0FBQ0gsS0FBSyxVQUFVLHlCQUF5QixDQUNwQyxRQUFnQixFQUNoQixhQUFxQixFQUNyQixRQUFnQixFQUNoQixjQUFzQixFQUN0QixnQkFBd0Y7SUFFeEYsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4RUFBOEUsY0FBYyxFQUFFLENBQUMsQ0FBQztJQUU1RyxJQUFJLHFCQUFxQixHQUFHLE1BQU0sNEJBQTRCLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUVwSCxxRkFBcUY7SUFDckYsc0RBQXNEO0lBQ3RELElBQUksY0FBYyxHQUFRLElBQUksQ0FBQztJQUMvQixJQUFJLENBQUM7UUFDRCxjQUFjLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBQ3pGLENBQUM7SUFBQyxXQUFNLENBQUM7UUFDTCxjQUFjLEdBQUcsSUFBSSxDQUFDO0lBQzFCLENBQUM7SUFFRCxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQy9DLDhFQUE4RTtRQUM5RSxpRkFBaUY7UUFDakYsaUZBQWlGO1FBQ2pGLGlEQUFpRDtRQUNqRCxFQUFFO1FBQ0Ysd0VBQXdFO1FBQ3hFLGlGQUFpRjtRQUNqRixnRkFBZ0Y7UUFDaEYsbUZBQW1GO1FBQ25GLGVBQWU7UUFDZixNQUFNLE1BQU0sR0FBRyxNQUFNLG9CQUFvQixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNWLE1BQU0sSUFBSSxLQUFLLENBQ1gsSUFBSSxjQUFjLGlEQUFpRDtnQkFDbkUsNkVBQTZFO2dCQUM3RSw0Q0FBNEMsQ0FDL0MsQ0FBQztRQUNOLENBQUM7UUFFRCxNQUFNLFVBQVUsR0FBRyxxQkFBcUIsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDO1FBQ3hELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsNkRBQTZELFFBQVEsbUJBQW1CLGFBQWEsd0RBQXdELENBQUMsQ0FBQztRQUNuTCxDQUFDO1FBRUQsZ0ZBQWdGO1FBQ2hGLHdGQUF3RjtRQUN4RixzRkFBc0Y7UUFDdEYsc0ZBQXNGO1FBQ3RGLDRFQUE0RTtRQUM1RSxnRkFBZ0Y7UUFDaEYsNEVBQTRFO1FBQzVFLElBQUkscUJBQXFCLElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLHFCQUFxQixFQUFFLENBQUM7WUFDOUYsNEVBQTRFO1lBQzVFLDJFQUEyRTtZQUMzRSx3RUFBd0U7WUFDeEUsMEVBQTBFO1lBQzFFLDhCQUE4QjtZQUM5QixJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7WUFDdkIsSUFBSSxDQUFDO2dCQUNELE1BQU0sY0FBYyxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO29CQUN0RixJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLDJCQUEyQixFQUFFLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUscUJBQXFCLENBQUM7aUJBQzVHLENBQUMsQ0FBQztnQkFDSCxVQUFVLEdBQUcsQ0FBQyxDQUFDLENBQUMsY0FBYyxJQUFJLGNBQWMsQ0FBQyxPQUFPLElBQUksY0FBYyxDQUFDLElBQUksSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZILENBQUM7WUFBQyxXQUFNLENBQUM7Z0JBQ0wsVUFBVSxHQUFHLEtBQUssQ0FBQztZQUN2QixDQUFDO1lBRUQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dCQUNkLE1BQU0sSUFBSSxLQUFLLENBQ1gsbUJBQW1CLGNBQWMsV0FBVyxNQUFNLENBQUMsSUFBSSxvQkFBb0IsUUFBUSxJQUFJO29CQUN2RixPQUFPLGFBQWEsaUJBQWlCLHFCQUFxQixJQUFJLENBQ2pFLENBQUM7WUFDTixDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRSxVQUFVLEVBQUUsQ0FBQztJQUMzRSxDQUFDO0lBRUQsaUZBQWlGO0lBQ2pGLGlGQUFpRjtJQUNqRiw4RUFBOEU7SUFDOUUsNkNBQTZDO0lBQzdDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQ3pCLE1BQU0sT0FBTyxHQUFJLGNBQWMsQ0FBQyxTQUFtQjthQUM5QyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztlQUM1RCxDQUFDLENBQUMsSUFBSSxLQUFLLGNBQWMsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDO1FBQ2hFLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2QixxQkFBcUIsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQzVDLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDekIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2REFBNkQsUUFBUSxtQkFBbUIsYUFBYSx3REFBd0QsQ0FBQyxDQUFDO0lBQ25MLENBQUM7SUFFRCxJQUFJLFdBQVcsR0FBa0IsSUFBSSxDQUFDO0lBQ3RDLElBQUksY0FBYyxHQUFHLElBQUksQ0FBQztJQUMxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsY0FBYyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUN2RCxNQUFNLElBQUksR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBUSxDQUFDO1FBQ2hELElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxxQkFBcUIsRUFBRSxDQUFDO1lBQ3RDLGNBQWMsR0FBRyxJQUFJLENBQUM7WUFDdEIsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUN6RCxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1lBQ3hDLENBQUM7aUJBQU0sQ0FBQztnQkFDSixNQUFNLElBQUksS0FBSyxDQUFDLHlEQUF5RCxDQUFDLENBQUM7WUFDL0UsQ0FBQztZQUNELE1BQU07UUFDVixDQUFDO0lBQ0wsQ0FBQztJQUVELElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUNsQix3RUFBd0U7UUFDeEUsMkVBQTJFO1FBQzNFLDJFQUEyRTtRQUMzRSwrRUFBK0U7UUFDL0UsK0VBQStFO1FBQy9FLDJCQUEyQjtRQUMzQixJQUFJLGVBQWUsR0FBUSxJQUFJLENBQUM7UUFDaEMsSUFBSSxDQUFDO1lBQ0QsZUFBZSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO2dCQUM1RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLDBCQUEwQixFQUFFLElBQUksRUFBRSxDQUFDLGNBQWMsRUFBRSxxQkFBcUIsQ0FBQzthQUM5RyxDQUFDLENBQUM7UUFDUCxDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ0wsZUFBZSxHQUFHLElBQUksQ0FBQztRQUMzQixDQUFDO1FBQ0QsSUFBSSxlQUFlLElBQUksZUFBZSxDQUFDLE9BQU8sSUFBSSxlQUFlLENBQUMsSUFBSSxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDM0csT0FBTyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxxQkFBcUIsRUFBRSxDQUFDO1FBQ3RGLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxjQUFjLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO1lBQ3pELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUMzRyxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksYUFBYSxPQUFPLEdBQUcsQ0FBQztRQUMvQyxDQUFDLENBQUMsQ0FBQztRQUNILE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLHFCQUFxQix1QkFBdUIsY0FBYywyQkFBMkIsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEosQ0FBQztJQUVELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMseURBQXlELENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRUQsT0FBTyxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxDQUFDO0FBQ2xELENBQUM7QUFFRCwrRUFBK0U7QUFDL0UsS0FBSyxVQUFVLHVCQUF1QixDQUNsQyxRQUFnQixFQUNoQixZQUFvQixFQUNwQixhQUFxQixFQUNyQixRQUFnQixFQUNoQixjQUFzQixFQUN0QixnQkFBd0Y7SUFFeEYsTUFBTSxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxHQUFHLE1BQU0seUJBQXlCLENBQzFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FDdEUsQ0FBQztJQUVGLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtRQUNsRCxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZO1FBQ2xDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUU7S0FDdEUsQ0FBQyxDQUFDO0lBRUgsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILEtBQUssVUFBVSw0QkFBNEIsQ0FDdkMsUUFBZ0IsRUFDaEIsWUFBb0IsRUFDcEIsYUFBcUIsRUFDckIsUUFBZ0IsRUFDaEIsZUFBc0IsRUFDdEIsZ0JBQXdGO0lBRXhGLElBQUksZUFBZSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUMvQixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLEVBQUU7U0FDN0YsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxFQUFFLENBQUM7SUFDZCxDQUFDO0lBRUQsTUFBTSxZQUFZLEdBQTRCLEVBQUUsQ0FBQztJQUNqRCxJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUM7SUFDckIsS0FBSyxNQUFNLGNBQWMsSUFBSSxlQUFlLEVBQUUsQ0FBQztRQUMzQyxJQUFJLE9BQU8sY0FBYyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMsdUZBQXVGLENBQUMsQ0FBQztRQUM3RyxDQUFDO1FBQ0QsTUFBTSxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsRUFBRSxHQUFHLE1BQU0seUJBQXlCLENBQzFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FDdEUsQ0FBQztRQUNGLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUN6QyxXQUFXLEdBQUcsV0FBVyxJQUFJLHFCQUFxQixDQUFDO0lBQ3ZELENBQUM7SUFFRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7UUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtRQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUU7S0FDcEcsQ0FBQyxDQUFDO0lBRUgsT0FBTyxZQUFZLENBQUM7QUFDeEIsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxLQUFLLFVBQVUsb0JBQW9CLENBQUMsSUFBWTs7SUFDNUMsSUFBSSxDQUFDO1FBQ0QsTUFBTSxJQUFJLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDakYsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLElBQUksQ0FBQztRQUV2QixNQUFNLFlBQVksR0FBRyxDQUFBLE1BQUEsTUFBQSxJQUFJLENBQUMsS0FBSywwQ0FBRSxJQUFJLDBDQUFFLEtBQUssTUFBSSxNQUFBLElBQUksQ0FBQyxJQUFJLDBDQUFFLEtBQUssQ0FBQSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDO1FBQ3RGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQztRQUMxRCxPQUFPLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBQUMsV0FBTSxDQUFDO1FBQ0wsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVkaXRvciBBUEkgY2FsbHMgZm9yIGFwcGx5aW5nIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQuc2V0Q29tcG9uZW50UHJvcGVydHkgKFN0ZXAgNikuXG4gKiBFYWNoIHByb3BlcnR5IHR5cGUgdXNlcyBhIGRpZmZlcmVudCBkdW1wIGZvcm1hdCBmb3IgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5JykuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUywgQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuXG4vKiogUHJvcGVydHktbmFtZSBzdWJzdHJpbmdzIHRoYXQgbWFyayBhIGJhcmUgYHN0cmluZ2AgdmFsdWUgYXMgYW4gYXNzZXQgcmVmZXJlbmNlLiAqL1xuY29uc3QgTkFNRV9ISU5URURfQVNTRVRfS0VZV09SRFMgPSBbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIENvY29zIGFzc2V0IGNsYXNzIGZvciB0aGUgRWRpdG9yIGBzZXQtcHJvcGVydHlgIGR1bXAgYHR5cGVgIGZpZWxkLlxuICpcbiAqIEFuIGV4cGxpY2l0IHByb3BlcnR5VHlwZSAoYG1hdGVyaWFsYCwgYG1lc2hgLCDigKYpIHdpbnMsIGJlY2F1c2UgaXQgaXMgYXV0aG9yaXRhdGl2ZS5cbiAqIE9ubHkgdGhlIGdlbmVyaWMgYGFzc2V0YCAvIGBzdHJpbmdgIHNwZWxsaW5ncyDigJQgd2hpY2ggY2Fycnkgbm8gdHlwZSBpbmZvcm1hdGlvbiDigJQgZmFsbCBiYWNrXG4gKiB0byB0aGUgcHJvcGVydHktbmFtZSBoZXVyaXN0aWMsIHNvIGV4aXN0aW5nIGNhbGxlcnMgdXNpbmcgdGhvc2Uga2VlcCB0aGVpciBleGFjdCBiZWhhdmlvdXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQXNzZXRUeXBlKHByb3BlcnR5VHlwZTogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBleHBsaWNpdCA9IEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRVtwcm9wZXJ0eVR5cGVdO1xuICAgIGlmIChleHBsaWNpdCkgcmV0dXJuIGV4cGxpY2l0O1xuXG4gICAgY29uc3QgbmFtZSA9IHByb3BlcnR5LnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ3RleHR1cmUnKSkgcmV0dXJuICdjYy5UZXh0dXJlMkQnO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCdtYXRlcmlhbCcpKSByZXR1cm4gJ2NjLk1hdGVyaWFsJztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnZm9udCcpKSByZXR1cm4gJ2NjLkZvbnQnO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCdjbGlwJykpIHJldHVybiAnY2MuQXVkaW9DbGlwJztcbiAgICByZXR1cm4gJ2NjLlNwcml0ZUZyYW1lJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBcHBseVByb3BlcnR5QXJncyB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZztcbiAgICBwcm9wZXJ0eVBhdGg6IHN0cmluZztcbiAgICByYXdDb21wb25lbnRJbmRleDogbnVtYmVyO1xuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZztcbiAgICBwcm9wZXJ0eTogc3RyaW5nO1xuICAgIHByb3BlcnR5VHlwZTogc3RyaW5nO1xuICAgIHZhbHVlOiBhbnk7XG4gICAgcHJvY2Vzc2VkVmFsdWU6IGFueTtcbn1cblxuLyoqXG4gKiBBcHBseSBhIHByb2Nlc3NlZCBwcm9wZXJ0eSB2YWx1ZSB0byB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3Igc2NlbmUuXG4gKiBSZXR1cm5zIHRoZSBhY3R1YWwgZXhwZWN0ZWQgdmFsdWUgKG1heSBkaWZmZXIgZnJvbSBwcm9jZXNzZWRWYWx1ZSBmb3IgY29tcG9uZW50IHJlZnMpLlxuICogVGhyb3dzIG9uIHVucmVjb3ZlcmFibGUgRWRpdG9yIEFQSSBlcnJvci5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJvcGVydHlUb0VkaXRvcihcbiAgICBhcmdzOiBBcHBseVByb3BlcnR5QXJncyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHsgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgcmF3Q29tcG9uZW50SW5kZXgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlLCBwcm9jZXNzZWRWYWx1ZSB9ID0gYXJncztcbiAgICBsZXQgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IHByb2Nlc3NlZFZhbHVlO1xuXG4gICAgLy8gRVZFUlkgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5VHlwZSBtdXN0IGxhbmQgaGVyZS4gRmFsbGluZyB0aHJvdWdoIHRvIHRoZSB0ZXJtaW5hbCBgZWxzZWBcbiAgICAvLyBzZW5kcyBhIGR1bXAgd2l0aCBubyBgdHlwZWAgZmllbGQg4oCUIHRoZSBzYW1lIHNoYXBlIHRoYXQgbWFrZXMgdGhlIG5vZGVBcnJheSBwYXRoIGZhaWxcbiAgICAvLyAoaXNzdWUgIzE4KSDigJQgc28gYW4gYWNjZXB0ZWQtYnV0LXR5cGVsZXNzIHByb3BlcnR5VHlwZSB3b3VsZCBzaWxlbnRseSBub3QgYXBwbHkuXG4gICAgLy8gQW4gZXhwbGljaXQgYHByb3BlcnR5VHlwZTogJ3N0cmluZydgIGlzIGF1dGhvcml0YXRpdmUg4oCUIGEgcHJvcGVydHktbmFtZSBzdWJzdHJpbmdcbiAgICAvLyBtdXN0IG5ldmVyIHJlLXJvdXRlIGl0IHRvIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIChpc3N1ZSAjNDY6IGBmaXJlQ2xpcE5hbWVgIHdhc1xuICAgIC8vIGNvZXJjZWQgdG8gYGNjLkF1ZGlvQ2xpcGAsIG51bGxpbmcgdGhlIGZpZWxkIGFuZCBkcm9wcGluZyBpdCBmcm9tIHRoZSBjb21wb25lbnQgZHVtcCkuXG4gICAgLy8gVGhlIG5hbWUtaGludCBoZXVyaXN0aWMgYXBwbGllcyBPTkxZIHRvIHRoZSBnZW5lcmljIGBhc3NldGAgc3BlbGxpbmcsIHdoaWNoIGNhcnJpZXNcbiAgICAvLyBubyB0eXBlIGluZm9ybWF0aW9uIG9mIGl0cyBvd24uXG4gICAgaWYgKChBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHByb3BlcnR5VHlwZSkgfHxcbiAgICAgICAgKHByb3BlcnR5VHlwZSA9PT0gJ2Fzc2V0JyAmJiBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUy5zb21lKGsgPT4gcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrKSkpKSB7XG5cbiAgICAgICAgY29uc3QgYXNzZXRUeXBlID0gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGUsIHByb3BlcnR5KTtcblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUsIHR5cGU6IGFzc2V0VHlwZSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nICYmIChwcm9wZXJ0eSA9PT0gJ19jb250ZW50U2l6ZScgfHwgcHJvcGVydHkgPT09ICdjb250ZW50U2l6ZScpKSB7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gTnVtYmVyKHZhbHVlLndpZHRoKSB8fCAxMDA7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDEwMDtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0ud2lkdGhgLCBkdW1wOiB7IHZhbHVlOiB3aWR0aCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5oZWlnaHRgLCBkdW1wOiB7IHZhbHVlOiBoZWlnaHQgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyAmJiAocHJvcGVydHkgPT09ICdfYW5jaG9yUG9pbnQnIHx8IHByb3BlcnR5ID09PSAnYW5jaG9yUG9pbnQnKSkge1xuICAgICAgICBjb25zdCBhbmNob3JYID0gTnVtYmVyKHZhbHVlLngpIHx8IDAuNTtcbiAgICAgICAgY29uc3QgYW5jaG9yWSA9IE51bWJlcih2YWx1ZS55KSB8fCAwLjU7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvclhgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JYIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvcllgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JZIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yVmFsdWUgPSB7XG4gICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5yKSB8fCAwKSksXG4gICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5nKSB8fCAwKSksXG4gICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5iKSB8fCAwKSksXG4gICAgICAgICAgICBhOiBwcm9jZXNzZWRWYWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5hKSkpIDogMjU1XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yVmFsdWUsIHR5cGU6ICdjYy5Db2xvcicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMycgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAsIHo6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS56KSB8fCAwIH0sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICd2ZWMyJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS54KSB8fCAwLCB5OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueSkgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnc2l6ZScgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB3aWR0aDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLndpZHRoKSB8fCAwLCBoZWlnaHQ6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS5oZWlnaHQpIHx8IDAgfSwgdHlwZTogJ2NjLlNpemUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ25vZGUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIHByb2Nlc3NlZFZhbHVlKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50JyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBwcm9jZXNzZWRWYWx1ZSkge1xuICAgICAgICAvLyBJc3N1ZSAjNzU6IGNsZWFyaW5nIGEgY29tcG9uZW50IHJlZmVyZW5jZSAoYGNvbnZlcnRQcm9wZXJ0eVZhbHVlYCByZXR1cm5zXG4gICAgICAgIC8vIGB7IHV1aWQ6ICcnIH1gIGZvciBhIG51bGwvJycgaW5wdXQpIOKAlCB3cml0ZSBpdCBESVJFQ1RMWS4gVGhlcmUgaXMgbm8gdGFyZ2V0IHRvXG4gICAgICAgIC8vIHJlc29sdmUsIGFuZCByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlIHdvdWxkIG9ubHkgcmVwb3J0ICcnIGFzIG5laXRoZXIgYSBub2RlXG4gICAgICAgIC8vIHV1aWQgbm9yIGEgY29tcG9uZW50IHV1aWQuXG4gICAgICAgIGNvbnN0IGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IGF3YWl0IHJlc29sdmVFeHBlY3RlZENvbXBvbmVudFR5cGUobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBnZXRDb21wb25lbnRJbmZvKTtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgdXVpZDogJycgfSwgdHlwZTogZXhwZWN0ZWRDb21wb25lbnRUeXBlIHx8ICdjYy5Db21wb25lbnQnIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFjdHVhbEV4cGVjdGVkVmFsdWUgPSB7IHV1aWQ6ICcnIH07XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudCcgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgICAgICBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvY2Vzc2VkVmFsdWUsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnbm9kZUFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICAvLyBXaXRob3V0IGFuIGV4cGxpY2l0IHR5cGUvaXNBcnJheS9lbGVtZW50VHlwZURhdGEsIHRoZSBlZGl0b3IncyBzZXQtcHJvcGVydHlcbiAgICAgICAgLy8gZHVtcCBoYXMgbm8gd2F5IHRvIGtub3cgdGhpcyBpcyBhbiBhcnJheSBvZiBjYy5Ob2RlIHJlZmVyZW5jZXMg4oCUIGl0IGZhbGxzXG4gICAgICAgIC8vIHRocm91Z2ggYXMgYSBiYXJlIHZhbHVlIGFuZCBzaWxlbnRseSBkb2VzIG5vdCBhcHBseSAoaXNzdWUgIzE4KSwgdGhlIHNhbWVcbiAgICAgICAgLy8gZmFpbHVyZSBtb2RlIGFzIHRoZSBhc3NldC1yZWZlcmVuY2UgdHlwZXMgYmVmb3JlIHRoZXkgZ2FpbmVkIGFuIGV4cGxpY2l0XG4gICAgICAgIC8vIGB0eXBlYCBmaWVsZCAoc2VlIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIGFib3ZlKS5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScsIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogJ2NjLk5vZGUnIH0gfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnYXNzZXRBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgLy8gU2FtZSBleHBsaWNpdCBhcnJheSBkdW1wIGFzIG5vZGVBcnJheSAoaXNzdWUgIzE4KSwgdHlwZWQgd2l0aCB0aGUgcHJvcGVydHknc1xuICAgICAgICAvLyBERUNMQVJFRCBlbGVtZW50IGNsYXNzIOKAlCB0aGUgZWRpdG9yIG5lZWRzIGl0IHRvIGRlc2VyaWFsaXplIGVhY2ggYHsgdXVpZCB9YC5cbiAgICAgICAgY29uc3QgZWxlbWVudFR5cGUgPSBhd2FpdCByZXNvbHZlRGVjbGFyZWRBc3NldEVsZW1lbnRUeXBlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgZ2V0Q29tcG9uZW50SW5mbyk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSwgdHlwZTogZWxlbWVudFR5cGUsIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogZWxlbWVudFR5cGUgfSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnRBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlQXJyYXkoXG4gICAgICAgICAgICBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvY2Vzc2VkVmFsdWUsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29sb3JBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgY29uc3QgY29sb3JBcnJheVZhbHVlID0gcHJvY2Vzc2VkVmFsdWUubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0ucikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5iKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGE6IGl0ZW0uYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5hKSkpIDogMjU1XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHI6IDI1NSwgZzogMjU1LCBiOiAyNTUsIGE6IDI1NSB9O1xuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCwgZHVtcDogeyB2YWx1ZTogY29sb3JBcnJheVZhbHVlLCB0eXBlOiAnY2MuQ29sb3InIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBhY3R1YWxFeHBlY3RlZFZhbHVlO1xufVxuXG4vKipcbiAqIFRyZWF0ICdVbmtub3duJyBhcyBtaXNzaW5nIOKAlCBpdCBhcHBlYXJzIHdoZW4gYSBwcmV2aW91cyBhc3NpZ25tZW50IHN0b3JlZCBhIHZhbHVlXG4gKiB3aG9zZSBydW50aW1lIHR5cGUgZGlkbid0IG1hdGNoIHRoZSBAcHJvcGVydHkgZGVjbGFyZWQgdHlwZSwgbGVhdmluZyB0aGUgZHVtcCdzXG4gKiB0eXBlIGZpZWxkIHN0YWxlLlxuICovXG5mdW5jdGlvbiBpc1VzYWJsZVR5cGUodDogYW55KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHR5cGVvZiB0ID09PSAnc3RyaW5nJyAmJiB0Lmxlbmd0aCA+IDAgJiYgdCAhPT0gJ1Vua25vd24nO1xufVxuXG4vKipcbiAqIFJlc29sdmUgdGhlIERFQ0xBUkVEIGVsZW1lbnQgY2xhc3Mgb2YgYW4gYXNzZXQtYXJyYXkgQHByb3BlcnR5IChlLmcuIGBjYy5BdWRpb0NsaXBgIGZvclxuICogYEBwcm9wZXJ0eSh7IHR5cGU6IFtBdWRpb0NsaXBdIH0pYCkgZnJvbSB0aGUgaG9sZGVyIGNvbXBvbmVudCdzIGR1bXAuIFByZWZlcnNcbiAqIGBlbGVtZW50VHlwZURhdGEudHlwZWAsIHRoZW4gdGhlIGFycmF5IGR1bXAncyBvd24gYHR5cGVgOyBmYWxscyBiYWNrIHRvIGBjYy5Bc3NldGAgd2hlblxuICogbmVpdGhlciBpcyByZWFkYWJsZS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZURlY2xhcmVkQXNzZXRFbGVtZW50VHlwZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgaW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgIGxldCBtZXRhOiBhbnkgPSBpbmZvLnN1Y2Nlc3MgPyBpbmZvLmRhdGE/LnByb3BlcnRpZXMgOiB1bmRlZmluZWQ7XG4gICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoICYmIG1ldGE7IGkrKykge1xuICAgICAgICBtZXRhID0gbWV0YVtzZWdtZW50c1tpXV07XG4gICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG4gICAgICAgIGlmICghaXNMZWFmICYmIG1ldGEgJiYgdHlwZW9mIG1ldGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gbWV0YSAmJiB0eXBlb2YgbWV0YS52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIG1ldGEgPSBtZXRhLnZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChtZXRhICYmIHR5cGVvZiBtZXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoaXNVc2FibGVUeXBlKG1ldGEuZWxlbWVudFR5cGVEYXRhPy50eXBlKSkgcmV0dXJuIG1ldGEuZWxlbWVudFR5cGVEYXRhLnR5cGU7XG4gICAgICAgIGlmIChpc1VzYWJsZVR5cGUobWV0YS50eXBlKSkgcmV0dXJuIG1ldGEudHlwZTtcbiAgICB9XG4gICAgcmV0dXJuICdjYy5Bc3NldCc7XG59XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgREVDTEFSRUQgdHlwZSBvZiBhIGBjb21wb25lbnRgL2Bjb21wb25lbnRBcnJheWAgQHByb3BlcnR5IGZyb20gdGhlIGhvbGRlclxuICogY29tcG9uZW50J3Mgb3duIGR1bXAuIEV4dHJhY3RlZCBmcm9tIGByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlYCBzbyBhIHJlZmVyZW5jZSBDTEVBUlxuICogKGlzc3VlICM3NSwgYHsgdXVpZDogJycgfWApIGNhbiBnZXQgdGhlIHR5cGUgaXQgbmVlZHMgZm9yIHRoZSBgc2V0LXByb3BlcnR5YCBkdW1wXG4gKiB3aXRob3V0IGdvaW5nIHRocm91Z2ggdGhhdCBmdW5jdGlvbidzIFRBUkdFVCByZXNvbHV0aW9uIOKAlCB0aGVyZSBpcyBub3RoaW5nIHRvIHJlc29sdmVcbiAqIGZvciBhbiBlbXB0eSB0YXJnZXQsIGFuZCBpdCB3b3VsZCBvbmx5IGZhaWwgdHJ5aW5nLlxuICovXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlRXhwZWN0ZWRDb21wb25lbnRUeXBlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBjdXJyZW50Q29tcG9uZW50SW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgIC8vIFdhbGsgZG90dGVkIHByb3BlcnR5IHBhdGhzIHRocm91Z2ggbmVzdGVkIENDQ2xhc3MgZ3JvdXAgZHVtcHMgdG8gZmluZCB0aGUgbWV0YWRhdGEgZGVzY3JpcHRvci5cbiAgICBsZXQgcHJvcGVydHlNZXRhOiBhbnkgPSBjdXJyZW50Q29tcG9uZW50SW5mby5zdWNjZXNzID8gY3VycmVudENvbXBvbmVudEluZm8uZGF0YT8ucHJvcGVydGllcyA6IHVuZGVmaW5lZDtcbiAgICBpZiAocHJvcGVydHlNZXRhKSB7XG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlNZXRhOyBpKyspIHtcbiAgICAgICAgICAgIHByb3BlcnR5TWV0YSA9IHByb3BlcnR5TWV0YVtzZWdtZW50c1tpXV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlNZXRhID0gcHJvcGVydHlNZXRhLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9ICcnO1xuICAgIGlmIChwcm9wZXJ0eU1ldGEgJiYgdHlwZW9mIHByb3BlcnR5TWV0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKGlzVXNhYmxlVHlwZShwcm9wZXJ0eU1ldGEudHlwZSkpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IHByb3BlcnR5TWV0YS50eXBlO1xuICAgICAgICB9IGVsc2UgaWYgKGlzVXNhYmxlVHlwZShwcm9wZXJ0eU1ldGEuY3RvcikpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IHByb3BlcnR5TWV0YS5jdG9yO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TWV0YS5leHRlbmRzICYmIEFycmF5LmlzQXJyYXkocHJvcGVydHlNZXRhLmV4dGVuZHMpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGV4dGVuZFR5cGUgb2YgcHJvcGVydHlNZXRhLmV4dGVuZHMpIHtcbiAgICAgICAgICAgICAgICBpZiAoZXh0ZW5kVHlwZS5zdGFydHNXaXRoKCdjYy4nKSAmJiBleHRlbmRUeXBlICE9PSAnY2MuQ29tcG9uZW50JyAmJiBleHRlbmRUeXBlICE9PSAnY2MuT2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBleHRlbmRUeXBlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGV4cGVjdGVkQ29tcG9uZW50VHlwZTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGEgdGFyZ2V0IG5vZGUncyBjb21wb25lbnQgcmVmZXJlbmNlIHRvIGl0cyBzY2VuZSBjb21wb25lbnQgaWQsIFdJVEhPVVRcbiAqIHBlcmZvcm1pbmcgdGhlIGBzZXQtcHJvcGVydHlgIHdyaXRlLiBTaGFyZWQgYnkgdGhlIHNpbmdsZS1gY29tcG9uZW50YCBwcm9wZXJ0eVR5cGVcbiAqICh3aGljaCB3cml0ZXMgb25lIGB7IHV1aWQgfWAgdmFsdWUpIGFuZCB0aGUgYGNvbXBvbmVudEFycmF5YCBwcm9wZXJ0eVR5cGUgKHdoaWNoXG4gKiB3cml0ZXMgYSB3aG9sZSBhcnJheSBpbiBvbmUgc2V0LXByb3BlcnR5IGNhbGwsIHNvIHBlci1lbGVtZW50IHdyaXRlcyBtdXN0IG5vdCBoYXBwZW5cbiAqIGhlcmUg4oCUIGlzc3VlICMxOCkuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICB0YXJnZXROb2RlVXVpZDogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8eyBjb21wb25lbnRJZDogc3RyaW5nOyBleHBlY3RlZENvbXBvbmVudFR5cGU6IHN0cmluZyB9PiB7XG4gICAgY29uc29sZS5sb2coYFtNYW5hZ2VDb21wb25lbnRdIFNldHRpbmcgY29tcG9uZW50IHJlZmVyZW5jZSAtIGZpbmRpbmcgY29tcG9uZW50IG9uIG5vZGU6ICR7dGFyZ2V0Tm9kZVV1aWR9YCk7XG5cbiAgICBsZXQgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gYXdhaXQgcmVzb2x2ZUV4cGVjdGVkQ29tcG9uZW50VHlwZShub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIGdldENvbXBvbmVudEluZm8pO1xuXG4gICAgLy8gYHF1ZXJ5LW5vZGVgIFJFSkVDVFMgb24gc29tZSBlZGl0b3IgYnVpbGRzIGFuZCByZXNvbHZlcyBmYWxzeSBvbiBvdGhlcnM7IGJvdGggbWVhblxuICAgIC8vIHRoZSBzYW1lIHRoaW5nIGhlcmUg4oCUIHRoZSB2YWx1ZSBpcyBub3QgYSBub2RlIHV1aWQuXG4gICAgbGV0IHRhcmdldE5vZGVEYXRhOiBhbnkgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICAgIHRhcmdldE5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHRhcmdldE5vZGVVdWlkKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgdGFyZ2V0Tm9kZURhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghdGFyZ2V0Tm9kZURhdGEgfHwgIXRhcmdldE5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAvLyBUaGUgY2FsbGVyIG1heSBoYXZlIHBhc3NlZCB0aGUgQ09NUE9ORU5UJ3Mgb3duIHV1aWQg4oCUIHRoZSBgdXVpZGAgZmllbGQgdGhhdFxuICAgICAgICAvLyBtYW5hZ2VfY29tcG9uZW50IGdldF9hbGwgLyBnZXRfaW5mbyByZXR1cm4sIGFuZCB0aGUgb2J2aW91cyB0aGluZyB0byByZWFjaCBmb3JcbiAgICAgICAgLy8gd2hlbiB3aXJpbmcgYSBAcHJvcGVydHkoU29tZUNvbXBvbmVudCkgcmVmZXJlbmNlLiBBY2NlcHQgdGhhdCBzcGVsbGluZyBpbnN0ZWFkXG4gICAgICAgIC8vIG9mIHJlcG9ydGluZyBhIGNvcnJlY3QgdXVpZCBhcyBhIG1pc3Npbmcgbm9kZS5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gUmVzb2x2ZS1vbmx5LCBleGFjdGx5IGxpa2UgdGhlIG5vZGUgcGF0aCBiZWxvdyDigJQgdGhpcyBmdW5jdGlvbiBoYXMgbm9cbiAgICAgICAgLy8gYHByb3BlcnR5UGF0aGAgYW5kIG11c3QgbmV2ZXIgd3JpdGUuIFRoZSBjYWxsZXIgKGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlIGZvciBhXG4gICAgICAgIC8vIHNpbmdsZSByZWZlcmVuY2UsIGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlQXJyYXkgZm9yIGFuIGFycmF5KSBwZXJmb3JtcyB0aGUgT05FXG4gICAgICAgIC8vIHNldC1wcm9wZXJ0eSB3cml0ZTsgYSB3cml0ZSBoZXJlIHdvdWxkIGZpcmUgb25jZSBwZXIgZWxlbWVudCBvbiBhIGNvbXBvbmVudEFycmF5XG4gICAgICAgIC8vIChpc3N1ZSAjMTgpLlxuICAgICAgICBjb25zdCBkaXJlY3QgPSBhd2FpdCBxdWVyeUNvbXBvbmVudEJ5VXVpZCh0YXJnZXROb2RlVXVpZCk7XG4gICAgICAgIGlmICghZGlyZWN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke3RhcmdldE5vZGVVdWlkfScgaXMgbmVpdGhlciBhIG5vZGUgdXVpZCBub3IgYSBjb21wb25lbnQgdXVpZC4gYCArXG4gICAgICAgICAgICAgICAgYFBhc3MgdGhlIHV1aWQgb2YgdGhlIE5PREUgdGhhdCBob2xkcyB0aGUgY29tcG9uZW50LCBvciB0aGUgY29tcG9uZW50J3Mgb3duIGAgK1xuICAgICAgICAgICAgICAgIGB1dWlkIGZyb20gbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249Z2V0X2FsbC5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlyZWN0VHlwZSA9IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB8fCBkaXJlY3QudHlwZTtcbiAgICAgICAgaWYgKCFkaXJlY3RUeXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgcmVxdWlyZWQgY29tcG9uZW50IHR5cGUgZm9yIHByb3BlcnR5ICcke3Byb3BlcnR5fScgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gUHJvcGVydHkgbWV0YWRhdGEgbWF5IG5vdCBjb250YWluIHR5cGUgaW5mb3JtYXRpb24uYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgbm9kZSBwYXRoIGJlbG93IG9ubHkgZXZlciByZXNvbHZlcyBhIGNvbXBvbmVudCB3aG9zZSB0eXBlIEVYQUNUTFkgbWF0Y2hlc1xuICAgICAgICAvLyBleHBlY3RlZENvbXBvbmVudFR5cGUgKGl0cyBzZWFyY2ggbG9vcCByZWplY3RzIGFueXRoaW5nIGVsc2UpLiBgZXhwZWN0ZWRDb21wb25lbnRUeXBlXG4gICAgICAgIC8vIHx8IGRpcmVjdC50eXBlYCBvbmx5IGZhbGxzIGJhY2sgdG8gZGlyZWN0LnR5cGUgd2hlbiBleHBlY3RlZENvbXBvbmVudFR5cGUgaXMgZW1wdHk7XG4gICAgICAgIC8vIGl0IG5ldmVyIHZhbGlkYXRlZCB0aGUgdHdvIGFnYWluc3QgZWFjaCBvdGhlciB3aGVuIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBXQVMga25vd24sXG4gICAgICAgIC8vIGxldHRpbmcgYSBtaXNtYXRjaGVkIGNvbXBvbmVudCAoZS5nLiBhIGNjLlNwcml0ZSB1dWlkIG9uIGEgcHJvcGVydHkgdHlwZWRcbiAgICAgICAgLy8gSGVyb0RyYWdDb250cm9sbGVyKSByZXNvbHZlIHVucmVqZWN0ZWQuIEEgZGlyZWN0LnR5cGUgdGhhdCBpcyBpdHNlbGYgdW51c2FibGVcbiAgICAgICAgLy8gKCdVbmtub3duJy9ibGFuaykgY2Fubm90IGRpc3Byb3ZlIGEgbWF0Y2gsIHNvIGl0IGlzIGxlZnQgdG8gZmFsbCB0aHJvdWdoLlxuICAgICAgICBpZiAoZXhwZWN0ZWRDb21wb25lbnRUeXBlICYmIGlzVXNhYmxlVHlwZShkaXJlY3QudHlwZSkgJiYgZGlyZWN0LnR5cGUgIT09IGV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgLy8gSXNzdWUgIzgxOiB0aGUgc2FtZSBwb2x5bW9ycGhpYyBnYXAgaXNzdWUgIzQ1IGZpeGVkIG9uIHRoZSBub2RlLXV1aWQgcGF0aFxuICAgICAgICAgICAgLy8gYmVsb3cg4oCUIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBtYXkgYmUgYSBCQVNFIGNsYXNzIHdoaWxlIGRpcmVjdC50eXBlIGlzIGFcbiAgICAgICAgICAgIC8vIFNVQkNMQVNTLiBBIGxpdGVyYWwgc3RyaW5nIG1pc21hdGNoIGNhbid0IGRpc3Byb3ZlIHRoYXQ7IGFzayB0aGUgbGl2ZVxuICAgICAgICAgICAgLy8gY2xhc3MgcmVnaXN0cnkgYmVmb3JlIHJlamVjdGluZyBhIGNvbXBvbmVudCB0aGF0IHdvdWxkIGFjdHVhbGx5IHNhdGlzZnlcbiAgICAgICAgICAgIC8vIHRoZSBkZWNsYXJlZCBwcm9wZXJ0eSB0eXBlLlxuICAgICAgICAgICAgbGV0IGlzU3ViY2xhc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3ViY2xhc3NSZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2lzQ29tcG9uZW50VHlwZVN1YmNsYXNzT2YnLCBhcmdzOiBbZGlyZWN0LnR5cGUsIGV4cGVjdGVkQ29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpc1N1YmNsYXNzID0gISEoc3ViY2xhc3NSZXN1bHQgJiYgc3ViY2xhc3NSZXN1bHQuc3VjY2VzcyAmJiBzdWJjbGFzc1Jlc3VsdC5kYXRhICYmIHN1YmNsYXNzUmVzdWx0LmRhdGEuaXNTdWJjbGFzcyk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBpc1N1YmNsYXNzID0gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaXNTdWJjbGFzcykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICAgICAgYENvbXBvbmVudCB1dWlkICcke3RhcmdldE5vZGVVdWlkfScgaXMgYSAnJHtkaXJlY3QudHlwZX0nLCBidXQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBgICtcbiAgICAgICAgICAgICAgICAgICAgYG9uICcke2NvbXBvbmVudFR5cGV9JyByZXF1aXJlcyBhICcke2V4cGVjdGVkQ29tcG9uZW50VHlwZX0nLmBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgY29tcG9uZW50SWQ6IGRpcmVjdC51dWlkLCBleHBlY3RlZENvbXBvbmVudFR5cGU6IGRpcmVjdFR5cGUgfTtcbiAgICB9XG5cbiAgICAvLyBTaW5nbGUtY2MtY29tcG9uZW50IGZhbGxiYWNrOiB3aGVuIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBjb3VsZCBub3QgYmUgaW5mZXJyZWRcbiAgICAvLyAoZS5nLiwgc3RhbGUgJ1Vua25vd24nIGluIGR1bXAgYW5kIGV4dGVuZHMgb25seSBsaXN0cyBjYy5Db21wb25lbnQvY2MuT2JqZWN0KSxcbiAgICAvLyBhbmQgdGhlIHRhcmdldCBub2RlIGhhcyBleGFjdGx5IG9uZSBjYy4qIGNvbXBvbmVudCwgdXNlIGl0LiBNaXJyb3JzIENvY29zJ3NcbiAgICAvLyBkcmFnLWZyb20taGllcmFyY2h5IGF1dG8tcmVzb2x2ZSBiZWhhdmlvci5cbiAgICBpZiAoIWV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICBjb25zdCBjY0NvbXBzID0gKHRhcmdldE5vZGVEYXRhLl9fY29tcHNfXyBhcyBhbnlbXSlcbiAgICAgICAgICAgIC5maWx0ZXIoYyA9PiB0eXBlb2YgYy50eXBlID09PSAnc3RyaW5nJyAmJiBjLnR5cGUuc3RhcnRzV2l0aCgnY2MuJylcbiAgICAgICAgICAgICAgICAmJiBjLnR5cGUgIT09ICdjYy5Db21wb25lbnQnICYmIGMudHlwZSAhPT0gJ2NjLk9iamVjdCcpO1xuICAgICAgICBpZiAoY2NDb21wcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IGNjQ29tcHNbMF0udHlwZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGRldGVybWluZSByZXF1aXJlZCBjb21wb25lbnQgdHlwZSBmb3IgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBvbiBjb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nLiBQcm9wZXJ0eSBtZXRhZGF0YSBtYXkgbm90IGNvbnRhaW4gdHlwZSBpbmZvcm1hdGlvbi5gKTtcbiAgICB9XG5cbiAgICBsZXQgY29tcG9uZW50SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgIGxldCBmb3VuZENvbXBvbmVudCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY29tcCA9IHRhcmdldE5vZGVEYXRhLl9fY29tcHNfX1tpXSBhcyBhbnk7XG4gICAgICAgIGlmIChjb21wLnR5cGUgPT09IGV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgZm91bmRDb21wb25lbnQgPSBjb21wO1xuICAgICAgICAgICAgaWYgKGNvbXAudmFsdWUgJiYgY29tcC52YWx1ZS51dWlkICYmIGNvbXAudmFsdWUudXVpZC52YWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudElkID0gY29tcC52YWx1ZS51dWlkLnZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBleHRyYWN0IGNvbXBvbmVudCBJRCBmcm9tIGNvbXBvbmVudCBzdHJ1Y3R1cmVgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFmb3VuZENvbXBvbmVudCkge1xuICAgICAgICAvLyBJc3N1ZSAjNDU6IGV4cGVjdGVkQ29tcG9uZW50VHlwZSBtYXkgYmUgYSBCQVNFIGNsYXNzIChkZWNsYXJlZCBvbiB0aGVcbiAgICAgICAgLy8gQHByb3BlcnR5KSB3aGlsZSBldmVyeSBjb21wb25lbnQgYWN0dWFsbHkgb24gdGhlIG5vZGUgaXMgYSBTVUJDTEFTUyDigJQgYW5cbiAgICAgICAgLy8gZXhhY3Qgc3RyaW5nIG1hdGNoIGFnYWluc3QgY29tcC50eXBlIGNhbiBuZXZlciBzdWNjZWVkIGZvciBhIHBvbHltb3JwaGljXG4gICAgICAgIC8vIHJlZmVyZW5jZSwgZXZlbiB0aG91Z2ggdGhlIGVuZ2luZSdzIG93biBub2RlLmdldENvbXBvbmVudChCYXNlQ2xhc3MpIGFscmVhZHlcbiAgICAgICAgLy8gcmVzb2x2ZXMgc3ViY2xhc3MgaW5zdGFuY2VzLiBGYWxsIGJhY2sgdG8gdGhhdCBsaXZlLXNjZW5lLCBpbmhlcml0YW5jZS1hd2FyZVxuICAgICAgICAvLyBsb29rdXAgYmVmb3JlIGdpdmluZyB1cC5cbiAgICAgICAgbGV0IGJhc2VDbGFzc1Jlc3VsdDogYW55ID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGJhc2VDbGFzc1Jlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZmluZENvbXBvbmVudEJ5QmFzZUNsYXNzJywgYXJnczogW3RhcmdldE5vZGVVdWlkLCBleHBlY3RlZENvbXBvbmVudFR5cGVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBiYXNlQ2xhc3NSZXN1bHQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmIChiYXNlQ2xhc3NSZXN1bHQgJiYgYmFzZUNsYXNzUmVzdWx0LnN1Y2Nlc3MgJiYgYmFzZUNsYXNzUmVzdWx0LmRhdGEgJiYgYmFzZUNsYXNzUmVzdWx0LmRhdGEuY29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgY29tcG9uZW50SWQ6IGJhc2VDbGFzc1Jlc3VsdC5kYXRhLmNvbXBvbmVudFV1aWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZUlkID0gY29tcC52YWx1ZSAmJiBjb21wLnZhbHVlLnV1aWQgJiYgY29tcC52YWx1ZS51dWlkLnZhbHVlID8gY29tcC52YWx1ZS51dWlkLnZhbHVlIDogJ3Vua25vd24nO1xuICAgICAgICAgICAgcmV0dXJuIGAke2NvbXAudHlwZX0oc2NlbmVfaWQ6JHtzY2VuZUlkfSlgO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgdHlwZSAnJHtleHBlY3RlZENvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZSAke3RhcmdldE5vZGVVdWlkfS4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgaWYgKCFjb21wb25lbnRJZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBleHRyYWN0IGNvbXBvbmVudCBJRCBmcm9tIGNvbXBvbmVudCBzdHJ1Y3R1cmVgKTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb21wb25lbnRJZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH07XG59XG5cbi8qKiBSZXNvbHZlIGEgY29tcG9uZW50IHJlZmVyZW5jZSBhbmQgd3JpdGUgaXQgYXMgYSBzaW5nbGUgYHsgdXVpZCB9YCB2YWx1ZS4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgdGFyZ2V0Tm9kZVV1aWQ6IHN0cmluZyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHsgY29tcG9uZW50SWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9ID0gYXdhaXQgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB0YXJnZXROb2RlVXVpZCwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICk7XG5cbiAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgdXVpZDogY29tcG9uZW50SWQgfSwgdHlwZTogZXhwZWN0ZWRDb21wb25lbnRUeXBlIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7IHV1aWQ6IGNvbXBvbmVudElkIH07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBhcnJheSBvZiB0YXJnZXQtbm9kZSBVVUlEcyB0byB0aGVpciBjb21wb25lbnQgcmVmZXJlbmNlcyBhbmQgd3JpdGUgdGhlXG4gKiB3aG9sZSBhcnJheSBpbiBPTkUgc2V0LXByb3BlcnR5IGNhbGwgKG1hdGNoaW5nIHRoZSBub2RlQXJyYXkgZml4IGFib3ZlIOKAlCBhbiBhcnJheVxuICogcHJvcGVydHkgbmVlZHMgYGlzQXJyYXlgL2BlbGVtZW50VHlwZURhdGFgIGluIHRoZSBkdW1wLCBub3QgTiBzZXBhcmF0ZSBzY2FsYXIgd3JpdGVzKS5cbiAqIEFuIGVtcHR5IGlucHV0IGFycmF5IGlzIGd1YXJkZWQgZXhwbGljaXRseTogdGhlcmUgaXMgbm8gZWxlbWVudCB0byByZXNvbHZlIGFcbiAqIGNvbXBvbmVudCB0eXBlIGZyb20sIHNvIGl0IGlzIHdyaXR0ZW4gYXMgYW4gZW1wdHkgYXJyYXkgd2l0aCBhIGdlbmVyaWMgZWxlbWVudCB0eXBlXG4gKiByYXRoZXIgdGhhbiBpbmRleGluZyBpbnRvIGFuIGFycmF5IHRoYXQgaGFzIG5vIGBbMF1gLlxuICovXG5hc3luYyBmdW5jdGlvbiBhcHBseUNvbXBvbmVudFJlZmVyZW5jZUFycmF5KFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgdGFyZ2V0Tm9kZVV1aWRzOiBhbnlbXSxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGlmICh0YXJnZXROb2RlVXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBbXSwgaXNBcnJheTogdHJ1ZSwgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiBudWxsLCB0eXBlOiAnY2MuQ29tcG9uZW50JyB9IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvbHZlZFJlZnM6IEFycmF5PHsgdXVpZDogc3RyaW5nIH0+ID0gW107XG4gICAgbGV0IGVsZW1lbnRUeXBlID0gJyc7XG4gICAgZm9yIChjb25zdCB0YXJnZXROb2RlVXVpZCBvZiB0YXJnZXROb2RlVXVpZHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXROb2RlVXVpZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY29tcG9uZW50QXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgbm9kZSBVVUlEcyAoZWFjaCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KScpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHsgY29tcG9uZW50SWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9ID0gYXdhaXQgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdGFyZ2V0Tm9kZVV1aWQsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcbiAgICAgICAgcmVzb2x2ZWRSZWZzLnB1c2goeyB1dWlkOiBjb21wb25lbnRJZCB9KTtcbiAgICAgICAgZWxlbWVudFR5cGUgPSBlbGVtZW50VHlwZSB8fCBleHBlY3RlZENvbXBvbmVudFR5cGU7XG4gICAgfVxuXG4gICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICBkdW1wOiB7IHZhbHVlOiByZXNvbHZlZFJlZnMsIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogZWxlbWVudFR5cGUgfSB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzb2x2ZWRSZWZzO1xufVxuXG4vKipcbiAqIExvb2sgYSB1dWlkIHVwIGFzIGEgQ09NUE9ORU5UIHJhdGhlciB0aGFuIGEgbm9kZS5cbiAqXG4gKiBgcXVlcnktY29tcG9uZW50YCBhbnN3ZXJzIGZvciBhIGNvbXBvbmVudCdzIG93biB1dWlkIGFuZCByZXR1cm5zIHRoZSBzYW1lIGR1bXAgc2hhcGUgYXNcbiAqIG9uZSBgX19jb21wc19fYCBlbnRyeSwgc28gYHZhbHVlLnV1aWQudmFsdWVgIGFuZCBgdHlwZWAgcmVhZCBleGFjdGx5IGFzIHRoZXkgZG8gb24gdGhlXG4gKiBub2RlIHBhdGguIFJldHVybnMgbnVsbCBmb3IgYW55dGhpbmcgdGhhdCBpcyBub3QgYSBsaXZlIGNvbXBvbmVudCDigJQgaW5jbHVkaW5nIGEgdXVpZFxuICogdGhhdCBuYW1lcyBub3RoaW5nIGF0IGFsbCDigJQgc28gdGhlIGNhbGxlciBjYW4gcmVwb3J0IGJvdGggYWNjZXB0ZWQgc3BlbGxpbmdzLlxuICovXG5hc3luYyBmdW5jdGlvbiBxdWVyeUNvbXBvbmVudEJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHsgdXVpZDogc3RyaW5nOyB0eXBlOiBzdHJpbmcgfSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21wOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQnLCB1dWlkKTtcbiAgICAgICAgaWYgKCFjb21wKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCByZXNvbHZlZFV1aWQgPSBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCB1dWlkO1xuICAgICAgICBjb25zdCB0eXBlID0gY29tcC50eXBlIHx8IGNvbXAuY2lkIHx8IGNvbXAuX190eXBlX18gfHwgJyc7XG4gICAgICAgIHJldHVybiB7IHV1aWQ6IHJlc29sdmVkVXVpZCwgdHlwZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG4iXX0=