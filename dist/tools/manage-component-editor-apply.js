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
        // Explicit array dump typed with the property's DECLARED element class. Each element
        // must itself be a full dump `{ value: { uuid }, type }` (the shape query-node returns):
        // a bare `{ uuid }` element makes the editor throw "Cannot read properties of
        // undefined (reading 'hasOwnProperty')" while decoding the array.
        const elementType = await resolveDeclaredAssetElementType(nodeUuid, componentType, property, getComponentInfo);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: {
                value: processedValue.map((ref) => ({ value: ref, type: elementType })),
                type: elementType, isArray: true,
                elementTypeData: { value: { uuid: '' }, type: elementType }
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUFrQkQsc0RBc0pDO0FBOUxELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQ3ZDLElBQXVCLEVBQ3ZCLGdCQUF3RjtJQUV4RixNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUs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QUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtZQUNsRCxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZO1lBQ2xDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUM3SSxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN6RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUMzRyxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN6RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxL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SUFBSSxFQUFFLGVBQWUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxFQUFFO0tBQ3BHLENBQUMsQ0FBQztJQUVILE9BQU8sWUFBWSxDQUFDO0FBQ3hCLENBQUM7QUFFRDs7Ozs7OztHQU9HO0FBQ0gsS0FBSyxVQUFVLG9CQUFvQixDQUFDLElBQVk7O0lBQzVDLElBQUksQ0FBQztRQUNELE1BQU0sSUFBSSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2pGLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFdkIsTUFBTSxZQUFZLEdBQUcsQ0FBQSxNQUFBLE1BQUEsSUFBSSxDQUFDLEtBQUssMENBQUUsSUFBSSwwQ0FBRSxLQUFLLE1BQUksTUFBQSxJQUFJLENBQUMsSUFBSSwwQ0FBRSxLQUFLLENBQUEsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztRQUN0RixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDMUQsT0FBTyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDeEMsQ0FBQztJQUFDLFdBQU0sQ0FBQztRQUNMLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFZGl0b3IgQVBJIGNhbGxzIGZvciBhcHBseWluZyBjb21wb25lbnQgcHJvcGVydHkgdmFsdWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50LnNldENvbXBvbmVudFByb3BlcnR5IChTdGVwIDYpLlxuICogRWFjaCBwcm9wZXJ0eSB0eXBlIHVzZXMgYSBkaWZmZXJlbnQgZHVtcCBmb3JtYXQgZm9yIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScpLlxuICovXG5cbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMsIEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcblxuLyoqIFByb3BlcnR5LW5hbWUgc3Vic3RyaW5ncyB0aGF0IG1hcmsgYSBiYXJlIGBzdHJpbmdgIHZhbHVlIGFzIGFuIGFzc2V0IHJlZmVyZW5jZS4gKi9cbmNvbnN0IE5BTUVfSElOVEVEX0FTU0VUX0tFWVdPUkRTID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXTtcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBBbiBleHBsaWNpdCBwcm9wZXJ0eVR5cGUgKGBtYXRlcmlhbGAsIGBtZXNoYCwg4oCmKSB3aW5zLCBiZWNhdXNlIGl0IGlzIGF1dGhvcml0YXRpdmUuXG4gKiBPbmx5IHRoZSBnZW5lcmljIGBhc3NldGAgLyBgc3RyaW5nYCBzcGVsbGluZ3Mg4oCUIHdoaWNoIGNhcnJ5IG5vIHR5cGUgaW5mb3JtYXRpb24g4oCUIGZhbGwgYmFja1xuICogdG8gdGhlIHByb3BlcnR5LW5hbWUgaGV1cmlzdGljLCBzbyBleGlzdGluZyBjYWxsZXJzIHVzaW5nIHRob3NlIGtlZXAgdGhlaXIgZXhhY3QgYmVoYXZpb3VyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZXhwbGljaXQgPSBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEVbcHJvcGVydHlUeXBlXTtcbiAgICBpZiAoZXhwbGljaXQpIHJldHVybiBleHBsaWNpdDtcblxuICAgIGNvbnN0IG5hbWUgPSBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCd0ZXh0dXJlJykpIHJldHVybiAnY2MuVGV4dHVyZTJEJztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnbWF0ZXJpYWwnKSkgcmV0dXJuICdjYy5NYXRlcmlhbCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ2ZvbnQnKSkgcmV0dXJuICdjYy5Gb250JztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnY2xpcCcpKSByZXR1cm4gJ2NjLkF1ZGlvQ2xpcCc7XG4gICAgcmV0dXJuICdjYy5TcHJpdGVGcmFtZSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbHlQcm9wZXJ0eUFyZ3Mge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7XG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmc7XG4gICAgcmF3Q29tcG9uZW50SW5kZXg6IG51bWJlcjtcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmc7XG4gICAgcHJvcGVydHk6IHN0cmluZztcbiAgICBwcm9wZXJ0eVR5cGU6IHN0cmluZztcbiAgICB2YWx1ZTogYW55O1xuICAgIHByb2Nlc3NlZFZhbHVlOiBhbnk7XG59XG5cbi8qKlxuICogQXBwbHkgYSBwcm9jZXNzZWQgcHJvcGVydHkgdmFsdWUgdG8gdGhlIENvY29zIENyZWF0b3IgZWRpdG9yIHNjZW5lLlxuICogUmV0dXJucyB0aGUgYWN0dWFsIGV4cGVjdGVkIHZhbHVlIChtYXkgZGlmZmVyIGZyb20gcHJvY2Vzc2VkVmFsdWUgZm9yIGNvbXBvbmVudCByZWZzKS5cbiAqIFRocm93cyBvbiB1bnJlY292ZXJhYmxlIEVkaXRvciBBUEkgZXJyb3IuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhcHBseVByb3BlcnR5VG9FZGl0b3IoXG4gICAgYXJnczogQXBwbHlQcm9wZXJ0eUFyZ3MsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB7IG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIHJhd0NvbXBvbmVudEluZGV4LCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSwgcHJvY2Vzc2VkVmFsdWUgfSA9IGFyZ3M7XG4gICAgbGV0IGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBwcm9jZXNzZWRWYWx1ZTtcblxuICAgIC8vIEVWRVJZIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eVR5cGUgbXVzdCBsYW5kIGhlcmUuIEZhbGxpbmcgdGhyb3VnaCB0byB0aGUgdGVybWluYWwgYGVsc2VgXG4gICAgLy8gc2VuZHMgYSBkdW1wIHdpdGggbm8gYHR5cGVgIGZpZWxkIOKAlCB0aGUgc2FtZSBzaGFwZSB0aGF0IG1ha2VzIHRoZSBub2RlQXJyYXkgcGF0aCBmYWlsXG4gICAgLy8gKGlzc3VlICMxOCkg4oCUIHNvIGFuIGFjY2VwdGVkLWJ1dC10eXBlbGVzcyBwcm9wZXJ0eVR5cGUgd291bGQgc2lsZW50bHkgbm90IGFwcGx5LlxuICAgIC8vIEFuIGV4cGxpY2l0IGBwcm9wZXJ0eVR5cGU6ICdzdHJpbmcnYCBpcyBhdXRob3JpdGF0aXZlIOKAlCBhIHByb3BlcnR5LW5hbWUgc3Vic3RyaW5nXG4gICAgLy8gbXVzdCBuZXZlciByZS1yb3V0ZSBpdCB0byB0aGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCAoaXNzdWUgIzQ2OiBgZmlyZUNsaXBOYW1lYCB3YXNcbiAgICAvLyBjb2VyY2VkIHRvIGBjYy5BdWRpb0NsaXBgLCBudWxsaW5nIHRoZSBmaWVsZCBhbmQgZHJvcHBpbmcgaXQgZnJvbSB0aGUgY29tcG9uZW50IGR1bXApLlxuICAgIC8vIFRoZSBuYW1lLWhpbnQgaGV1cmlzdGljIGFwcGxpZXMgT05MWSB0byB0aGUgZ2VuZXJpYyBgYXNzZXRgIHNwZWxsaW5nLCB3aGljaCBjYXJyaWVzXG4gICAgLy8gbm8gdHlwZSBpbmZvcm1hdGlvbiBvZiBpdHMgb3duLlxuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpIHx8XG4gICAgICAgIChwcm9wZXJ0eVR5cGUgPT09ICdhc3NldCcgJiYgTkFNRV9ISU5URURfQVNTRVRfS0VZV09SRFMuc29tZShrID0+IHByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoaykpKSkge1xuXG4gICAgICAgIGNvbnN0IGFzc2V0VHlwZSA9IHJlc29sdmVBc3NldFR5cGUocHJvcGVydHlUeXBlLCBwcm9wZXJ0eSk7XG5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiBhc3NldFR5cGUgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyAmJiAocHJvcGVydHkgPT09ICdfY29udGVudFNpemUnIHx8IHByb3BlcnR5ID09PSAnY29udGVudFNpemUnKSkge1xuICAgICAgICBjb25zdCB3aWR0aCA9IE51bWJlcih2YWx1ZS53aWR0aCkgfHwgMTAwO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBOdW1iZXIodmFsdWUuaGVpZ2h0KSB8fCAxMDA7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LndpZHRoYCwgZHVtcDogeyB2YWx1ZTogd2lkdGggfVxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0uaGVpZ2h0YCwgZHVtcDogeyB2YWx1ZTogaGVpZ2h0IH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5VSVRyYW5zZm9ybScgJiYgKHByb3BlcnR5ID09PSAnX2FuY2hvclBvaW50JyB8fCBwcm9wZXJ0eSA9PT0gJ2FuY2hvclBvaW50JykpIHtcbiAgICAgICAgY29uc3QgYW5jaG9yWCA9IE51bWJlcih2YWx1ZS54KSB8fCAwLjU7XG4gICAgICAgIGNvbnN0IGFuY2hvclkgPSBOdW1iZXIodmFsdWUueSkgfHwgMC41O1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5hbmNob3JYYCwgZHVtcDogeyB2YWx1ZTogYW5jaG9yWCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5hbmNob3JZYCwgZHVtcDogeyB2YWx1ZTogYW5jaG9yWSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb2xvcicgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCBjb2xvclZhbHVlID0ge1xuICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUucikgfHwgMCkpLFxuICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuZykgfHwgMCkpLFxuICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuYikgfHwgMCkpLFxuICAgICAgICAgICAgYTogcHJvY2Vzc2VkVmFsdWUuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuYSkpKSA6IDI1NVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBjb2xvclZhbHVlLCB0eXBlOiAnY2MuQ29sb3InIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ3ZlYzMnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgeDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLngpIHx8IDAsIHk6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS55KSB8fCAwLCB6OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueikgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMicgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAgfSwgdHlwZTogJ2NjLlZlYzInIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ3NpemUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgd2lkdGg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS53aWR0aCkgfHwgMCwgaGVpZ2h0OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuaGVpZ2h0KSB8fCAwIH0sIHR5cGU6ICdjYy5TaXplJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBwcm9jZXNzZWRWYWx1ZSkge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSwgdHlwZTogJ2NjLk5vZGUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudCcgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0JyAmJiAndXVpZCcgaW4gcHJvY2Vzc2VkVmFsdWUpIHtcbiAgICAgICAgLy8gSXNzdWUgIzc1OiBjbGVhcmluZyBhIGNvbXBvbmVudCByZWZlcmVuY2UgKGBjb252ZXJ0UHJvcGVydHlWYWx1ZWAgcmV0dXJuc1xuICAgICAgICAvLyBgeyB1dWlkOiAnJyB9YCBmb3IgYSBudWxsLycnIGlucHV0KSDigJQgd3JpdGUgaXQgRElSRUNUTFkuIFRoZXJlIGlzIG5vIHRhcmdldCB0b1xuICAgICAgICAvLyByZXNvbHZlLCBhbmQgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZSB3b3VsZCBvbmx5IHJlcG9ydCAnJyBhcyBuZWl0aGVyIGEgbm9kZVxuICAgICAgICAvLyB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkLlxuICAgICAgICBjb25zdCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBhd2FpdCByZXNvbHZlRXhwZWN0ZWRDb21wb25lbnRUeXBlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgZ2V0Q29tcG9uZW50SW5mbyk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHV1aWQ6ICcnIH0sIHR5cGU6IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB8fCAnY2MuQ29tcG9uZW50JyB9XG4gICAgICAgIH0pO1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0geyB1dWlkOiAnJyB9O1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnQnICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlKFxuICAgICAgICAgICAgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb2Nlc3NlZFZhbHVlLCBnZXRDb21wb25lbnRJbmZvXG4gICAgICAgICk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ25vZGVBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgLy8gV2l0aG91dCBhbiBleHBsaWNpdCB0eXBlL2lzQXJyYXkvZWxlbWVudFR5cGVEYXRhLCB0aGUgZWRpdG9yJ3Mgc2V0LXByb3BlcnR5XG4gICAgICAgIC8vIGR1bXAgaGFzIG5vIHdheSB0byBrbm93IHRoaXMgaXMgYW4gYXJyYXkgb2YgY2MuTm9kZSByZWZlcmVuY2VzIOKAlCBpdCBmYWxsc1xuICAgICAgICAvLyB0aHJvdWdoIGFzIGEgYmFyZSB2YWx1ZSBhbmQgc2lsZW50bHkgZG9lcyBub3QgYXBwbHkgKGlzc3VlICMxOCksIHRoZSBzYW1lXG4gICAgICAgIC8vIGZhaWx1cmUgbW9kZSBhcyB0aGUgYXNzZXQtcmVmZXJlbmNlIHR5cGVzIGJlZm9yZSB0aGV5IGdhaW5lZCBhbiBleHBsaWNpdFxuICAgICAgICAvLyBgdHlwZWAgZmllbGQgKHNlZSB0aGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCBhYm92ZSkuXG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSwgdHlwZTogJ2NjLk5vZGUnLCBpc0FycmF5OiB0cnVlLCBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IG51bGwsIHR5cGU6ICdjYy5Ob2RlJyB9IH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2Fzc2V0QXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIC8vIEV4cGxpY2l0IGFycmF5IGR1bXAgdHlwZWQgd2l0aCB0aGUgcHJvcGVydHkncyBERUNMQVJFRCBlbGVtZW50IGNsYXNzLiBFYWNoIGVsZW1lbnRcbiAgICAgICAgLy8gbXVzdCBpdHNlbGYgYmUgYSBmdWxsIGR1bXAgYHsgdmFsdWU6IHsgdXVpZCB9LCB0eXBlIH1gICh0aGUgc2hhcGUgcXVlcnktbm9kZSByZXR1cm5zKTpcbiAgICAgICAgLy8gYSBiYXJlIGB7IHV1aWQgfWAgZWxlbWVudCBtYWtlcyB0aGUgZWRpdG9yIHRocm93IFwiQ2Fubm90IHJlYWQgcHJvcGVydGllcyBvZlxuICAgICAgICAvLyB1bmRlZmluZWQgKHJlYWRpbmcgJ2hhc093blByb3BlcnR5JylcIiB3aGlsZSBkZWNvZGluZyB0aGUgYXJyYXkuXG4gICAgICAgIGNvbnN0IGVsZW1lbnRUeXBlID0gYXdhaXQgcmVzb2x2ZURlY2xhcmVkQXNzZXRFbGVtZW50VHlwZShub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIGdldENvbXBvbmVudEluZm8pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDoge1xuICAgICAgICAgICAgICAgIHZhbHVlOiBwcm9jZXNzZWRWYWx1ZS5tYXAoKHJlZjogYW55KSA9PiAoeyB2YWx1ZTogcmVmLCB0eXBlOiBlbGVtZW50VHlwZSB9KSksXG4gICAgICAgICAgICAgICAgdHlwZTogZWxlbWVudFR5cGUsIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgICAgICAgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiB7IHV1aWQ6ICcnIH0sIHR5cGU6IGVsZW1lbnRUeXBlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudEFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9jZXNzZWRWYWx1ZSwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICAgICApO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb2xvckFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICBjb25zdCBjb2xvckFycmF5VmFsdWUgPSBwcm9jZXNzZWRWYWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGl0ZW0gJiYgdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmICdyJyBpbiBpdGVtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uZykgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYTogaXRlbS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmEpKSkgOiAyNTVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgcjogMjU1LCBnOiAyNTUsIGI6IDI1NSwgYTogMjU1IH07XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBjb2xvckFycmF5VmFsdWUsIHR5cGU6ICdjYy5Db2xvcicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFjdHVhbEV4cGVjdGVkVmFsdWU7XG59XG5cbi8qKlxuICogVHJlYXQgJ1Vua25vd24nIGFzIG1pc3Npbmcg4oCUIGl0IGFwcGVhcnMgd2hlbiBhIHByZXZpb3VzIGFzc2lnbm1lbnQgc3RvcmVkIGEgdmFsdWVcbiAqIHdob3NlIHJ1bnRpbWUgdHlwZSBkaWRuJ3QgbWF0Y2ggdGhlIEBwcm9wZXJ0eSBkZWNsYXJlZCB0eXBlLCBsZWF2aW5nIHRoZSBkdW1wJ3NcbiAqIHR5cGUgZmllbGQgc3RhbGUuXG4gKi9cbmZ1bmN0aW9uIGlzVXNhYmxlVHlwZSh0OiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHlwZW9mIHQgPT09ICdzdHJpbmcnICYmIHQubGVuZ3RoID4gMCAmJiB0ICE9PSAnVW5rbm93bic7XG59XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgREVDTEFSRUQgZWxlbWVudCBjbGFzcyBvZiBhbiBhc3NldC1hcnJheSBAcHJvcGVydHkgKGUuZy4gYGNjLkF1ZGlvQ2xpcGAgZm9yXG4gKiBgQHByb3BlcnR5KHsgdHlwZTogW0F1ZGlvQ2xpcF0gfSlgKSBmcm9tIHRoZSBob2xkZXIgY29tcG9uZW50J3MgZHVtcC4gUHJlZmVyc1xuICogYGVsZW1lbnRUeXBlRGF0YS50eXBlYCwgdGhlbiB0aGUgYXJyYXkgZHVtcCdzIG93biBgdHlwZWA7IGZhbGxzIGJhY2sgdG8gYGNjLkFzc2V0YCB3aGVuXG4gKiBuZWl0aGVyIGlzIHJlYWRhYmxlLlxuICovXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlRGVjbGFyZWRBc3NldEVsZW1lbnRUeXBlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBpbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgbGV0IG1ldGE6IGFueSA9IGluZm8uc3VjY2VzcyA/IGluZm8uZGF0YT8ucHJvcGVydGllcyA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5LnNwbGl0KCcuJyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgbWV0YTsgaSsrKSB7XG4gICAgICAgIG1ldGEgPSBtZXRhW3NlZ21lbnRzW2ldXTtcbiAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgaWYgKCFpc0xlYWYgJiYgbWV0YSAmJiB0eXBlb2YgbWV0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBtZXRhICYmIHR5cGVvZiBtZXRhLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgbWV0YSA9IG1ldGEudmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1ldGEgJiYgdHlwZW9mIG1ldGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChpc1VzYWJsZVR5cGUobWV0YS5lbGVtZW50VHlwZURhdGE/LnR5cGUpKSByZXR1cm4gbWV0YS5lbGVtZW50VHlwZURhdGEudHlwZTtcbiAgICAgICAgaWYgKGlzVXNhYmxlVHlwZShtZXRhLnR5cGUpKSByZXR1cm4gbWV0YS50eXBlO1xuICAgIH1cbiAgICByZXR1cm4gJ2NjLkFzc2V0Jztcbn1cblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBERUNMQVJFRCB0eXBlIG9mIGEgYGNvbXBvbmVudGAvYGNvbXBvbmVudEFycmF5YCBAcHJvcGVydHkgZnJvbSB0aGUgaG9sZGVyXG4gKiBjb21wb25lbnQncyBvd24gZHVtcC4gRXh0cmFjdGVkIGZyb20gYHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2VgIHNvIGEgcmVmZXJlbmNlIENMRUFSXG4gKiAoaXNzdWUgIzc1LCBgeyB1dWlkOiAnJyB9YCkgY2FuIGdldCB0aGUgdHlwZSBpdCBuZWVkcyBmb3IgdGhlIGBzZXQtcHJvcGVydHlgIGR1bXBcbiAqIHdpdGhvdXQgZ29pbmcgdGhyb3VnaCB0aGF0IGZ1bmN0aW9uJ3MgVEFSR0VUIHJlc29sdXRpb24g4oCUIHRoZXJlIGlzIG5vdGhpbmcgdG8gcmVzb2x2ZVxuICogZm9yIGFuIGVtcHR5IHRhcmdldCwgYW5kIGl0IHdvdWxkIG9ubHkgZmFpbCB0cnlpbmcuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVFeHBlY3RlZENvbXBvbmVudFR5cGUoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGN1cnJlbnRDb21wb25lbnRJbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgLy8gV2FsayBkb3R0ZWQgcHJvcGVydHkgcGF0aHMgdGhyb3VnaCBuZXN0ZWQgQ0NDbGFzcyBncm91cCBkdW1wcyB0byBmaW5kIHRoZSBtZXRhZGF0YSBkZXNjcmlwdG9yLlxuICAgIGxldCBwcm9wZXJ0eU1ldGE6IGFueSA9IGN1cnJlbnRDb21wb25lbnRJbmZvLnN1Y2Nlc3MgPyBjdXJyZW50Q29tcG9uZW50SW5mby5kYXRhPy5wcm9wZXJ0aWVzIDogdW5kZWZpbmVkO1xuICAgIGlmIChwcm9wZXJ0eU1ldGEpIHtcbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aCAmJiBwcm9wZXJ0eU1ldGE7IGkrKykge1xuICAgICAgICAgICAgcHJvcGVydHlNZXRhID0gcHJvcGVydHlNZXRhW3NlZ21lbnRzW2ldXTtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICBpZiAoIWlzTGVhZiAmJiBwcm9wZXJ0eU1ldGEgJiYgdHlwZW9mIHByb3BlcnR5TWV0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eU1ldGEgJiYgdHlwZW9mIHByb3BlcnR5TWV0YS52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eU1ldGEgPSBwcm9wZXJ0eU1ldGEudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gJyc7XG4gICAgaWYgKHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS50eXBlKSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gcHJvcGVydHlNZXRhLnR5cGU7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS5jdG9yKSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gcHJvcGVydHlNZXRhLmN0b3I7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlNZXRhLmV4dGVuZHMgJiYgQXJyYXkuaXNBcnJheShwcm9wZXJ0eU1ldGEuZXh0ZW5kcykpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZXh0ZW5kVHlwZSBvZiBwcm9wZXJ0eU1ldGEuZXh0ZW5kcykge1xuICAgICAgICAgICAgICAgIGlmIChleHRlbmRUeXBlLnN0YXJ0c1dpdGgoJ2NjLicpICYmIGV4dGVuZFR5cGUgIT09ICdjYy5Db21wb25lbnQnICYmIGV4dGVuZFR5cGUgIT09ICdjYy5PYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IGV4dGVuZFR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZXhwZWN0ZWRDb21wb25lbnRUeXBlO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYSB0YXJnZXQgbm9kZSdzIGNvbXBvbmVudCByZWZlcmVuY2UgdG8gaXRzIHNjZW5lIGNvbXBvbmVudCBpZCwgV0lUSE9VVFxuICogcGVyZm9ybWluZyB0aGUgYHNldC1wcm9wZXJ0eWAgd3JpdGUuIFNoYXJlZCBieSB0aGUgc2luZ2xlLWBjb21wb25lbnRgIHByb3BlcnR5VHlwZVxuICogKHdoaWNoIHdyaXRlcyBvbmUgYHsgdXVpZCB9YCB2YWx1ZSkgYW5kIHRoZSBgY29tcG9uZW50QXJyYXlgIHByb3BlcnR5VHlwZSAod2hpY2hcbiAqIHdyaXRlcyBhIHdob2xlIGFycmF5IGluIG9uZSBzZXQtcHJvcGVydHkgY2FsbCwgc28gcGVyLWVsZW1lbnQgd3JpdGVzIG11c3Qgbm90IGhhcHBlblxuICogaGVyZSDigJQgaXNzdWUgIzE4KS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTx7IGNvbXBvbmVudElkOiBzdHJpbmc7IGV4cGVjdGVkQ29tcG9uZW50VHlwZTogc3RyaW5nIH0+IHtcbiAgICBjb25zb2xlLmxvZyhgW01hbmFnZUNvbXBvbmVudF0gU2V0dGluZyBjb21wb25lbnQgcmVmZXJlbmNlIC0gZmluZGluZyBjb21wb25lbnQgb24gbm9kZTogJHt0YXJnZXROb2RlVXVpZH1gKTtcblxuICAgIGxldCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBhd2FpdCByZXNvbHZlRXhwZWN0ZWRDb21wb25lbnRUeXBlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgZ2V0Q29tcG9uZW50SW5mbyk7XG5cbiAgICAvLyBgcXVlcnktbm9kZWAgUkVKRUNUUyBvbiBzb21lIGVkaXRvciBidWlsZHMgYW5kIHJlc29sdmVzIGZhbHN5IG9uIG90aGVyczsgYm90aCBtZWFuXG4gICAgLy8gdGhlIHNhbWUgdGhpbmcgaGVyZSDigJQgdGhlIHZhbHVlIGlzIG5vdCBhIG5vZGUgdXVpZC5cbiAgICBsZXQgdGFyZ2V0Tm9kZURhdGE6IGFueSA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgICAgdGFyZ2V0Tm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdGFyZ2V0Tm9kZVV1aWQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICB0YXJnZXROb2RlRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCF0YXJnZXROb2RlRGF0YSB8fCAhdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgIC8vIFRoZSBjYWxsZXIgbWF5IGhhdmUgcGFzc2VkIHRoZSBDT01QT05FTlQncyBvd24gdXVpZCDigJQgdGhlIGB1dWlkYCBmaWVsZCB0aGF0XG4gICAgICAgIC8vIG1hbmFnZV9jb21wb25lbnQgZ2V0X2FsbCAvIGdldF9pbmZvIHJldHVybiwgYW5kIHRoZSBvYnZpb3VzIHRoaW5nIHRvIHJlYWNoIGZvclxuICAgICAgICAvLyB3aGVuIHdpcmluZyBhIEBwcm9wZXJ0eShTb21lQ29tcG9uZW50KSByZWZlcmVuY2UuIEFjY2VwdCB0aGF0IHNwZWxsaW5nIGluc3RlYWRcbiAgICAgICAgLy8gb2YgcmVwb3J0aW5nIGEgY29ycmVjdCB1dWlkIGFzIGEgbWlzc2luZyBub2RlLlxuICAgICAgICAvL1xuICAgICAgICAvLyBSZXNvbHZlLW9ubHksIGV4YWN0bHkgbGlrZSB0aGUgbm9kZSBwYXRoIGJlbG93IOKAlCB0aGlzIGZ1bmN0aW9uIGhhcyBub1xuICAgICAgICAvLyBgcHJvcGVydHlQYXRoYCBhbmQgbXVzdCBuZXZlciB3cml0ZS4gVGhlIGNhbGxlciAoYXBwbHlDb21wb25lbnRSZWZlcmVuY2UgZm9yIGFcbiAgICAgICAgLy8gc2luZ2xlIHJlZmVyZW5jZSwgYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheSBmb3IgYW4gYXJyYXkpIHBlcmZvcm1zIHRoZSBPTkVcbiAgICAgICAgLy8gc2V0LXByb3BlcnR5IHdyaXRlOyBhIHdyaXRlIGhlcmUgd291bGQgZmlyZSBvbmNlIHBlciBlbGVtZW50IG9uIGEgY29tcG9uZW50QXJyYXlcbiAgICAgICAgLy8gKGlzc3VlICMxOCkuXG4gICAgICAgIGNvbnN0IGRpcmVjdCA9IGF3YWl0IHF1ZXJ5Q29tcG9uZW50QnlVdWlkKHRhcmdldE5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFkaXJlY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJyR7dGFyZ2V0Tm9kZVV1aWR9JyBpcyBuZWl0aGVyIGEgbm9kZSB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkLiBgICtcbiAgICAgICAgICAgICAgICBgUGFzcyB0aGUgdXVpZCBvZiB0aGUgTk9ERSB0aGF0IGhvbGRzIHRoZSBjb21wb25lbnQsIG9yIHRoZSBjb21wb25lbnQncyBvd24gYCArXG4gICAgICAgICAgICAgICAgYHV1aWQgZnJvbSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkaXJlY3RUeXBlID0gZXhwZWN0ZWRDb21wb25lbnRUeXBlIHx8IGRpcmVjdC50eXBlO1xuICAgICAgICBpZiAoIWRpcmVjdFR5cGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGRldGVybWluZSByZXF1aXJlZCBjb21wb25lbnQgdHlwZSBmb3IgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBvbiBjb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nLiBQcm9wZXJ0eSBtZXRhZGF0YSBtYXkgbm90IGNvbnRhaW4gdHlwZSBpbmZvcm1hdGlvbi5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBub2RlIHBhdGggYmVsb3cgb25seSBldmVyIHJlc29sdmVzIGEgY29tcG9uZW50IHdob3NlIHR5cGUgRVhBQ1RMWSBtYXRjaGVzXG4gICAgICAgIC8vIGV4cGVjdGVkQ29tcG9uZW50VHlwZSAoaXRzIHNlYXJjaCBsb29wIHJlamVjdHMgYW55dGhpbmcgZWxzZSkuIGBleHBlY3RlZENvbXBvbmVudFR5cGVcbiAgICAgICAgLy8gfHwgZGlyZWN0LnR5cGVgIG9ubHkgZmFsbHMgYmFjayB0byBkaXJlY3QudHlwZSB3aGVuIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBpcyBlbXB0eTtcbiAgICAgICAgLy8gaXQgbmV2ZXIgdmFsaWRhdGVkIHRoZSB0d28gYWdhaW5zdCBlYWNoIG90aGVyIHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIFdBUyBrbm93bixcbiAgICAgICAgLy8gbGV0dGluZyBhIG1pc21hdGNoZWQgY29tcG9uZW50IChlLmcuIGEgY2MuU3ByaXRlIHV1aWQgb24gYSBwcm9wZXJ0eSB0eXBlZFxuICAgICAgICAvLyBIZXJvRHJhZ0NvbnRyb2xsZXIpIHJlc29sdmUgdW5yZWplY3RlZC4gQSBkaXJlY3QudHlwZSB0aGF0IGlzIGl0c2VsZiB1bnVzYWJsZVxuICAgICAgICAvLyAoJ1Vua25vd24nL2JsYW5rKSBjYW5ub3QgZGlzcHJvdmUgYSBtYXRjaCwgc28gaXQgaXMgbGVmdCB0byBmYWxsIHRocm91Z2guXG4gICAgICAgIGlmIChleHBlY3RlZENvbXBvbmVudFR5cGUgJiYgaXNVc2FibGVUeXBlKGRpcmVjdC50eXBlKSAmJiBkaXJlY3QudHlwZSAhPT0gZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAvLyBJc3N1ZSAjODE6IHRoZSBzYW1lIHBvbHltb3JwaGljIGdhcCBpc3N1ZSAjNDUgZml4ZWQgb24gdGhlIG5vZGUtdXVpZCBwYXRoXG4gICAgICAgICAgICAvLyBiZWxvdyDigJQgZXhwZWN0ZWRDb21wb25lbnRUeXBlIG1heSBiZSBhIEJBU0UgY2xhc3Mgd2hpbGUgZGlyZWN0LnR5cGUgaXMgYVxuICAgICAgICAgICAgLy8gU1VCQ0xBU1MuIEEgbGl0ZXJhbCBzdHJpbmcgbWlzbWF0Y2ggY2FuJ3QgZGlzcHJvdmUgdGhhdDsgYXNrIHRoZSBsaXZlXG4gICAgICAgICAgICAvLyBjbGFzcyByZWdpc3RyeSBiZWZvcmUgcmVqZWN0aW5nIGEgY29tcG9uZW50IHRoYXQgd291bGQgYWN0dWFsbHkgc2F0aXNmeVxuICAgICAgICAgICAgLy8gdGhlIGRlY2xhcmVkIHByb3BlcnR5IHR5cGUuXG4gICAgICAgICAgICBsZXQgaXNTdWJjbGFzcyA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJjbGFzc1Jlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnaXNDb21wb25lbnRUeXBlU3ViY2xhc3NPZicsIGFyZ3M6IFtkaXJlY3QudHlwZSwgZXhwZWN0ZWRDb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlzU3ViY2xhc3MgPSAhIShzdWJjbGFzc1Jlc3VsdCAmJiBzdWJjbGFzc1Jlc3VsdC5zdWNjZXNzICYmIHN1YmNsYXNzUmVzdWx0LmRhdGEgJiYgc3ViY2xhc3NSZXN1bHQuZGF0YS5pc1N1YmNsYXNzKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIGlzU3ViY2xhc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpc1N1YmNsYXNzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50IHV1aWQgJyR7dGFyZ2V0Tm9kZVV1aWR9JyBpcyBhICcke2RpcmVjdC50eXBlfScsIGJ1dCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGAgK1xuICAgICAgICAgICAgICAgICAgICBgb24gJyR7Y29tcG9uZW50VHlwZX0nIHJlcXVpcmVzIGEgJyR7ZXhwZWN0ZWRDb21wb25lbnRUeXBlfScuYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBjb21wb25lbnRJZDogZGlyZWN0LnV1aWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZTogZGlyZWN0VHlwZSB9O1xuICAgIH1cblxuICAgIC8vIFNpbmdsZS1jYy1jb21wb25lbnQgZmFsbGJhY2s6IHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIGNvdWxkIG5vdCBiZSBpbmZlcnJlZFxuICAgIC8vIChlLmcuLCBzdGFsZSAnVW5rbm93bicgaW4gZHVtcCBhbmQgZXh0ZW5kcyBvbmx5IGxpc3RzIGNjLkNvbXBvbmVudC9jYy5PYmplY3QpLFxuICAgIC8vIGFuZCB0aGUgdGFyZ2V0IG5vZGUgaGFzIGV4YWN0bHkgb25lIGNjLiogY29tcG9uZW50LCB1c2UgaXQuIE1pcnJvcnMgQ29jb3Mnc1xuICAgIC8vIGRyYWctZnJvbS1oaWVyYXJjaHkgYXV0by1yZXNvbHZlIGJlaGF2aW9yLlxuICAgIGlmICghZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGNjQ29tcHMgPSAodGFyZ2V0Tm9kZURhdGEuX19jb21wc19fIGFzIGFueVtdKVxuICAgICAgICAgICAgLmZpbHRlcihjID0+IHR5cGVvZiBjLnR5cGUgPT09ICdzdHJpbmcnICYmIGMudHlwZS5zdGFydHNXaXRoKCdjYy4nKVxuICAgICAgICAgICAgICAgICYmIGMudHlwZSAhPT0gJ2NjLkNvbXBvbmVudCcgJiYgYy50eXBlICE9PSAnY2MuT2JqZWN0Jyk7XG4gICAgICAgIGlmIChjY0NvbXBzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gY2NDb21wc1swXS50eXBlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZGV0ZXJtaW5lIHJlcXVpcmVkIGNvbXBvbmVudCB0eXBlIGZvciBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIFByb3BlcnR5IG1ldGFkYXRhIG1heSBub3QgY29udGFpbiB0eXBlIGluZm9ybWF0aW9uLmApO1xuICAgIH1cblxuICAgIGxldCBjb21wb25lbnRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGZvdW5kQ29tcG9uZW50ID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldE5vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb21wID0gdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgaWYgKGNvbXAudHlwZSA9PT0gZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICBmb3VuZENvbXBvbmVudCA9IGNvbXA7XG4gICAgICAgICAgICBpZiAoY29tcC52YWx1ZSAmJiBjb21wLnZhbHVlLnV1aWQgJiYgY29tcC52YWx1ZS51dWlkLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50SWQgPSBjb21wLnZhbHVlLnV1aWQudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGV4dHJhY3QgY29tcG9uZW50IElEIGZyb20gY29tcG9uZW50IHN0cnVjdHVyZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZvdW5kQ29tcG9uZW50KSB7XG4gICAgICAgIC8vIElzc3VlICM0NTogZXhwZWN0ZWRDb21wb25lbnRUeXBlIG1heSBiZSBhIEJBU0UgY2xhc3MgKGRlY2xhcmVkIG9uIHRoZVxuICAgICAgICAvLyBAcHJvcGVydHkpIHdoaWxlIGV2ZXJ5IGNvbXBvbmVudCBhY3R1YWxseSBvbiB0aGUgbm9kZSBpcyBhIFNVQkNMQVNTIOKAlCBhblxuICAgICAgICAvLyBleGFjdCBzdHJpbmcgbWF0Y2ggYWdhaW5zdCBjb21wLnR5cGUgY2FuIG5ldmVyIHN1Y2NlZWQgZm9yIGEgcG9seW1vcnBoaWNcbiAgICAgICAgLy8gcmVmZXJlbmNlLCBldmVuIHRob3VnaCB0aGUgZW5naW5lJ3Mgb3duIG5vZGUuZ2V0Q29tcG9uZW50KEJhc2VDbGFzcykgYWxyZWFkeVxuICAgICAgICAvLyByZXNvbHZlcyBzdWJjbGFzcyBpbnN0YW5jZXMuIEZhbGwgYmFjayB0byB0aGF0IGxpdmUtc2NlbmUsIGluaGVyaXRhbmNlLWF3YXJlXG4gICAgICAgIC8vIGxvb2t1cCBiZWZvcmUgZ2l2aW5nIHVwLlxuICAgICAgICBsZXQgYmFzZUNsYXNzUmVzdWx0OiBhbnkgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYmFzZUNsYXNzUmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdmaW5kQ29tcG9uZW50QnlCYXNlQ2xhc3MnLCBhcmdzOiBbdGFyZ2V0Tm9kZVV1aWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGJhc2VDbGFzc1Jlc3VsdCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJhc2VDbGFzc1Jlc3VsdCAmJiBiYXNlQ2xhc3NSZXN1bHQuc3VjY2VzcyAmJiBiYXNlQ2xhc3NSZXN1bHQuZGF0YSAmJiBiYXNlQ2xhc3NSZXN1bHQuZGF0YS5jb21wb25lbnRVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBjb21wb25lbnRJZDogYmFzZUNsYXNzUmVzdWx0LmRhdGEuY29tcG9uZW50VXVpZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhdmFpbGFibGUgPSB0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lSWQgPSBjb21wLnZhbHVlICYmIGNvbXAudmFsdWUudXVpZCAmJiBjb21wLnZhbHVlLnV1aWQudmFsdWUgPyBjb21wLnZhbHVlLnV1aWQudmFsdWUgOiAndW5rbm93bic7XG4gICAgICAgICAgICByZXR1cm4gYCR7Y29tcC50eXBlfShzY2VuZV9pZDoke3NjZW5lSWR9KWA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudCB0eXBlICcke2V4cGVjdGVkQ29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlICR7dGFyZ2V0Tm9kZVV1aWR9LiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGUuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbXBvbmVudElkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGV4dHJhY3QgY29tcG9uZW50IElEIGZyb20gY29tcG9uZW50IHN0cnVjdHVyZWApO1xuICAgIH1cblxuICAgIHJldHVybiB7IGNvbXBvbmVudElkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfTtcbn1cblxuLyoqIFJlc29sdmUgYSBjb21wb25lbnQgcmVmZXJlbmNlIGFuZCB3cml0ZSBpdCBhcyBhIHNpbmdsZSBgeyB1dWlkIH1gIHZhbHVlLiAqL1xuYXN5bmMgZnVuY3Rpb24gYXBwbHlDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBwcm9wZXJ0eVBhdGg6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICB0YXJnZXROb2RlVXVpZDogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgeyBjb21wb25lbnRJZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH0gPSBhd2FpdCByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlKFxuICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHRhcmdldE5vZGVVdWlkLCBnZXRDb21wb25lbnRJbmZvXG4gICAgKTtcblxuICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB1dWlkOiBjb21wb25lbnRJZCB9LCB0eXBlOiBleHBlY3RlZENvbXBvbmVudFR5cGUgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgdXVpZDogY29tcG9uZW50SWQgfTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIGFycmF5IG9mIHRhcmdldC1ub2RlIFVVSURzIHRvIHRoZWlyIGNvbXBvbmVudCByZWZlcmVuY2VzIGFuZCB3cml0ZSB0aGVcbiAqIHdob2xlIGFycmF5IGluIE9ORSBzZXQtcHJvcGVydHkgY2FsbCAobWF0Y2hpbmcgdGhlIG5vZGVBcnJheSBmaXggYWJvdmUg4oCUIGFuIGFycmF5XG4gKiBwcm9wZXJ0eSBuZWVkcyBgaXNBcnJheWAvYGVsZW1lbnRUeXBlRGF0YWAgaW4gdGhlIGR1bXAsIG5vdCBOIHNlcGFyYXRlIHNjYWxhciB3cml0ZXMpLlxuICogQW4gZW1wdHkgaW5wdXQgYXJyYXkgaXMgZ3VhcmRlZCBleHBsaWNpdGx5OiB0aGVyZSBpcyBubyBlbGVtZW50IHRvIHJlc29sdmUgYVxuICogY29tcG9uZW50IHR5cGUgZnJvbSwgc28gaXQgaXMgd3JpdHRlbiBhcyBhbiBlbXB0eSBhcnJheSB3aXRoIGEgZ2VuZXJpYyBlbGVtZW50IHR5cGVcbiAqIHJhdGhlciB0aGFuIGluZGV4aW5nIGludG8gYW4gYXJyYXkgdGhhdCBoYXMgbm8gYFswXWAuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlQXJyYXkoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBwcm9wZXJ0eVBhdGg6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICB0YXJnZXROb2RlVXVpZHM6IGFueVtdLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8YW55PiB7XG4gICAgaWYgKHRhcmdldE5vZGVVdWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IFtdLCBpc0FycmF5OiB0cnVlLCBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IG51bGwsIHR5cGU6ICdjYy5Db21wb25lbnQnIH0gfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc29sdmVkUmVmczogQXJyYXk8eyB1dWlkOiBzdHJpbmcgfT4gPSBbXTtcbiAgICBsZXQgZWxlbWVudFR5cGUgPSAnJztcbiAgICBmb3IgKGNvbnN0IHRhcmdldE5vZGVVdWlkIG9mIHRhcmdldE5vZGVVdWlkcykge1xuICAgICAgICBpZiAodHlwZW9mIHRhcmdldE5vZGVVdWlkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21wb25lbnRBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBub2RlIFVVSURzIChlYWNoIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgeyBjb21wb25lbnRJZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH0gPSBhd2FpdCByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlKFxuICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB0YXJnZXROb2RlVXVpZCwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICAgICApO1xuICAgICAgICByZXNvbHZlZFJlZnMucHVzaCh7IHV1aWQ6IGNvbXBvbmVudElkIH0pO1xuICAgICAgICBlbGVtZW50VHlwZSA9IGVsZW1lbnRUeXBlIHx8IGV4cGVjdGVkQ29tcG9uZW50VHlwZTtcbiAgICB9XG5cbiAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgIGR1bXA6IHsgdmFsdWU6IHJlc29sdmVkUmVmcywgaXNBcnJheTogdHJ1ZSwgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiBudWxsLCB0eXBlOiBlbGVtZW50VHlwZSB9IH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXNvbHZlZFJlZnM7XG59XG5cbi8qKlxuICogTG9vayBhIHV1aWQgdXAgYXMgYSBDT01QT05FTlQgcmF0aGVyIHRoYW4gYSBub2RlLlxuICpcbiAqIGBxdWVyeS1jb21wb25lbnRgIGFuc3dlcnMgZm9yIGEgY29tcG9uZW50J3Mgb3duIHV1aWQgYW5kIHJldHVybnMgdGhlIHNhbWUgZHVtcCBzaGFwZSBhc1xuICogb25lIGBfX2NvbXBzX19gIGVudHJ5LCBzbyBgdmFsdWUudXVpZC52YWx1ZWAgYW5kIGB0eXBlYCByZWFkIGV4YWN0bHkgYXMgdGhleSBkbyBvbiB0aGVcbiAqIG5vZGUgcGF0aC4gUmV0dXJucyBudWxsIGZvciBhbnl0aGluZyB0aGF0IGlzIG5vdCBhIGxpdmUgY29tcG9uZW50IOKAlCBpbmNsdWRpbmcgYSB1dWlkXG4gKiB0aGF0IG5hbWVzIG5vdGhpbmcgYXQgYWxsIOKAlCBzbyB0aGUgY2FsbGVyIGNhbiByZXBvcnQgYm90aCBhY2NlcHRlZCBzcGVsbGluZ3MuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHF1ZXJ5Q29tcG9uZW50QnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8eyB1dWlkOiBzdHJpbmc7IHR5cGU6IHN0cmluZyB9IHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbXA6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudCcsIHV1aWQpO1xuICAgICAgICBpZiAoIWNvbXApIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkVXVpZCA9IGNvbXAudmFsdWU/LnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IHV1aWQ7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBjb21wLnR5cGUgfHwgY29tcC5jaWQgfHwgY29tcC5fX3R5cGVfXyB8fCAnJztcbiAgICAgICAgcmV0dXJuIHsgdXVpZDogcmVzb2x2ZWRVdWlkLCB0eXBlIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cbiJdfQ==