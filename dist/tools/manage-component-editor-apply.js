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
 * Resolve a target node's component reference to its scene component id, WITHOUT
 * performing the `set-property` write. Shared by the single-`component` propertyType
 * (which writes one `{ uuid }` value) and the `componentArray` propertyType (which
 * writes a whole array in one set-property call, so per-element writes must not happen
 * here — issue #18).
 */
async function resolveComponentReference(nodeUuid, componentType, property, targetNodeUuid, getComponentInfo) {
    var _a;
    console.log(`[ManageComponent] Setting component reference - finding component on node: ${targetNodeUuid}`);
    let expectedComponentType = '';
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
    // Treat 'Unknown' as missing — it appears when a previous assignment stored
    // a value whose runtime type didn't match the @property declared type, leaving
    // the dump's type field stale.
    const isUsableType = (t) => typeof t === 'string' && t.length > 0 && t !== 'Unknown';
    if (propertyMeta) {
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
    }
    // `query-node` REJECTS on some editor builds and resolves falsy on others; both mean
    // the same thing here — the value is not a node uuid.
    let targetNodeData = null;
    try {
        targetNodeData = await Editor.Message.request('scene', 'query-node', targetNodeUuid);
    }
    catch (_b) {
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
            throw new Error(`Component uuid '${targetNodeUuid}' is a '${direct.type}', but property '${property}' ` +
                `on '${componentType}' requires a '${expectedComponentType}'.`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUFrQkQsc0RBMkhDO0FBbktELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQ3ZDLElBQXVCLEVBQ3ZCLGdCQUF3RjtJQUV4RixNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUs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QUFPLENBQUMsT0FBTyxFQUFFLGNBQWMsRUFBRTtZQUNsRCxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZO1lBQ2xDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUM3SSxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN6RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtTQUMzRyxDQUFDLENBQUM7SUFFUCxDQUFDO1NBQU0sSUFBSSxZQUFZLEtBQUssTUFBTSxJQUFJLGNBQWMsSUFBSSxPQUFPLGNBQWMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN6RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUU7WUFDbEQsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxL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QUFFLElBQUksRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDeEMsQ0FBQztJQUFDLFdBQU0sQ0FBQztRQUNMLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFZGl0b3IgQVBJIGNhbGxzIGZvciBhcHBseWluZyBjb21wb25lbnQgcHJvcGVydHkgdmFsdWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50LnNldENvbXBvbmVudFByb3BlcnR5IChTdGVwIDYpLlxuICogRWFjaCBwcm9wZXJ0eSB0eXBlIHVzZXMgYSBkaWZmZXJlbnQgZHVtcCBmb3JtYXQgZm9yIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScpLlxuICovXG5cbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMsIEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcblxuLyoqIFByb3BlcnR5LW5hbWUgc3Vic3RyaW5ncyB0aGF0IG1hcmsgYSBiYXJlIGBzdHJpbmdgIHZhbHVlIGFzIGFuIGFzc2V0IHJlZmVyZW5jZS4gKi9cbmNvbnN0IE5BTUVfSElOVEVEX0FTU0VUX0tFWVdPUkRTID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXTtcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBBbiBleHBsaWNpdCBwcm9wZXJ0eVR5cGUgKGBtYXRlcmlhbGAsIGBtZXNoYCwg4oCmKSB3aW5zLCBiZWNhdXNlIGl0IGlzIGF1dGhvcml0YXRpdmUuXG4gKiBPbmx5IHRoZSBnZW5lcmljIGBhc3NldGAgLyBgc3RyaW5nYCBzcGVsbGluZ3Mg4oCUIHdoaWNoIGNhcnJ5IG5vIHR5cGUgaW5mb3JtYXRpb24g4oCUIGZhbGwgYmFja1xuICogdG8gdGhlIHByb3BlcnR5LW5hbWUgaGV1cmlzdGljLCBzbyBleGlzdGluZyBjYWxsZXJzIHVzaW5nIHRob3NlIGtlZXAgdGhlaXIgZXhhY3QgYmVoYXZpb3VyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZXhwbGljaXQgPSBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEVbcHJvcGVydHlUeXBlXTtcbiAgICBpZiAoZXhwbGljaXQpIHJldHVybiBleHBsaWNpdDtcblxuICAgIGNvbnN0IG5hbWUgPSBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCd0ZXh0dXJlJykpIHJldHVybiAnY2MuVGV4dHVyZTJEJztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnbWF0ZXJpYWwnKSkgcmV0dXJuICdjYy5NYXRlcmlhbCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ2ZvbnQnKSkgcmV0dXJuICdjYy5Gb250JztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnY2xpcCcpKSByZXR1cm4gJ2NjLkF1ZGlvQ2xpcCc7XG4gICAgcmV0dXJuICdjYy5TcHJpdGVGcmFtZSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbHlQcm9wZXJ0eUFyZ3Mge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7XG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmc7XG4gICAgcmF3Q29tcG9uZW50SW5kZXg6IG51bWJlcjtcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmc7XG4gICAgcHJvcGVydHk6IHN0cmluZztcbiAgICBwcm9wZXJ0eVR5cGU6IHN0cmluZztcbiAgICB2YWx1ZTogYW55O1xuICAgIHByb2Nlc3NlZFZhbHVlOiBhbnk7XG59XG5cbi8qKlxuICogQXBwbHkgYSBwcm9jZXNzZWQgcHJvcGVydHkgdmFsdWUgdG8gdGhlIENvY29zIENyZWF0b3IgZWRpdG9yIHNjZW5lLlxuICogUmV0dXJucyB0aGUgYWN0dWFsIGV4cGVjdGVkIHZhbHVlIChtYXkgZGlmZmVyIGZyb20gcHJvY2Vzc2VkVmFsdWUgZm9yIGNvbXBvbmVudCByZWZzKS5cbiAqIFRocm93cyBvbiB1bnJlY292ZXJhYmxlIEVkaXRvciBBUEkgZXJyb3IuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhcHBseVByb3BlcnR5VG9FZGl0b3IoXG4gICAgYXJnczogQXBwbHlQcm9wZXJ0eUFyZ3MsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB7IG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIHJhd0NvbXBvbmVudEluZGV4LCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSwgcHJvY2Vzc2VkVmFsdWUgfSA9IGFyZ3M7XG4gICAgbGV0IGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBwcm9jZXNzZWRWYWx1ZTtcblxuICAgIC8vIEVWRVJZIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eVR5cGUgbXVzdCBsYW5kIGhlcmUuIEZhbGxpbmcgdGhyb3VnaCB0byB0aGUgdGVybWluYWwgYGVsc2VgXG4gICAgLy8gc2VuZHMgYSBkdW1wIHdpdGggbm8gYHR5cGVgIGZpZWxkIOKAlCB0aGUgc2FtZSBzaGFwZSB0aGF0IG1ha2VzIHRoZSBub2RlQXJyYXkgcGF0aCBmYWlsXG4gICAgLy8gKGlzc3VlICMxOCkg4oCUIHNvIGFuIGFjY2VwdGVkLWJ1dC10eXBlbGVzcyBwcm9wZXJ0eVR5cGUgd291bGQgc2lsZW50bHkgbm90IGFwcGx5LlxuICAgIC8vIEFuIGV4cGxpY2l0IGBwcm9wZXJ0eVR5cGU6ICdzdHJpbmcnYCBpcyBhdXRob3JpdGF0aXZlIOKAlCBhIHByb3BlcnR5LW5hbWUgc3Vic3RyaW5nXG4gICAgLy8gbXVzdCBuZXZlciByZS1yb3V0ZSBpdCB0byB0aGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCAoaXNzdWUgIzQ2OiBgZmlyZUNsaXBOYW1lYCB3YXNcbiAgICAvLyBjb2VyY2VkIHRvIGBjYy5BdWRpb0NsaXBgLCBudWxsaW5nIHRoZSBmaWVsZCBhbmQgZHJvcHBpbmcgaXQgZnJvbSB0aGUgY29tcG9uZW50IGR1bXApLlxuICAgIC8vIFRoZSBuYW1lLWhpbnQgaGV1cmlzdGljIGFwcGxpZXMgT05MWSB0byB0aGUgZ2VuZXJpYyBgYXNzZXRgIHNwZWxsaW5nLCB3aGljaCBjYXJyaWVzXG4gICAgLy8gbm8gdHlwZSBpbmZvcm1hdGlvbiBvZiBpdHMgb3duLlxuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpIHx8XG4gICAgICAgIChwcm9wZXJ0eVR5cGUgPT09ICdhc3NldCcgJiYgTkFNRV9ISU5URURfQVNTRVRfS0VZV09SRFMuc29tZShrID0+IHByb3BlcnR5LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoaykpKSkge1xuXG4gICAgICAgIGNvbnN0IGFzc2V0VHlwZSA9IHJlc29sdmVBc3NldFR5cGUocHJvcGVydHlUeXBlLCBwcm9wZXJ0eSk7XG5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiBhc3NldFR5cGUgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyAmJiAocHJvcGVydHkgPT09ICdfY29udGVudFNpemUnIHx8IHByb3BlcnR5ID09PSAnY29udGVudFNpemUnKSkge1xuICAgICAgICBjb25zdCB3aWR0aCA9IE51bWJlcih2YWx1ZS53aWR0aCkgfHwgMTAwO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBOdW1iZXIodmFsdWUuaGVpZ2h0KSB8fCAxMDA7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LndpZHRoYCwgZHVtcDogeyB2YWx1ZTogd2lkdGggfVxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0uaGVpZ2h0YCwgZHVtcDogeyB2YWx1ZTogaGVpZ2h0IH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5VSVRyYW5zZm9ybScgJiYgKHByb3BlcnR5ID09PSAnX2FuY2hvclBvaW50JyB8fCBwcm9wZXJ0eSA9PT0gJ2FuY2hvclBvaW50JykpIHtcbiAgICAgICAgY29uc3QgYW5jaG9yWCA9IE51bWJlcih2YWx1ZS54KSB8fCAwLjU7XG4gICAgICAgIGNvbnN0IGFuY2hvclkgPSBOdW1iZXIodmFsdWUueSkgfHwgMC41O1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5hbmNob3JYYCwgZHVtcDogeyB2YWx1ZTogYW5jaG9yWCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5hbmNob3JZYCwgZHVtcDogeyB2YWx1ZTogYW5jaG9yWSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb2xvcicgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCBjb2xvclZhbHVlID0ge1xuICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUucikgfHwgMCkpLFxuICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuZykgfHwgMCkpLFxuICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuYikgfHwgMCkpLFxuICAgICAgICAgICAgYTogcHJvY2Vzc2VkVmFsdWUuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuYSkpKSA6IDI1NVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBjb2xvclZhbHVlLCB0eXBlOiAnY2MuQ29sb3InIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ3ZlYzMnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgeDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLngpIHx8IDAsIHk6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS55KSB8fCAwLCB6OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueikgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMicgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAgfSwgdHlwZTogJ2NjLlZlYzInIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ3NpemUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgd2lkdGg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS53aWR0aCkgfHwgMCwgaGVpZ2h0OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuaGVpZ2h0KSB8fCAwIH0sIHR5cGU6ICdjYy5TaXplJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBwcm9jZXNzZWRWYWx1ZSkge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSwgdHlwZTogJ2NjLk5vZGUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudCcgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgICAgICBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvY2Vzc2VkVmFsdWUsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnbm9kZUFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICAvLyBXaXRob3V0IGFuIGV4cGxpY2l0IHR5cGUvaXNBcnJheS9lbGVtZW50VHlwZURhdGEsIHRoZSBlZGl0b3IncyBzZXQtcHJvcGVydHlcbiAgICAgICAgLy8gZHVtcCBoYXMgbm8gd2F5IHRvIGtub3cgdGhpcyBpcyBhbiBhcnJheSBvZiBjYy5Ob2RlIHJlZmVyZW5jZXMg4oCUIGl0IGZhbGxzXG4gICAgICAgIC8vIHRocm91Z2ggYXMgYSBiYXJlIHZhbHVlIGFuZCBzaWxlbnRseSBkb2VzIG5vdCBhcHBseSAoaXNzdWUgIzE4KSwgdGhlIHNhbWVcbiAgICAgICAgLy8gZmFpbHVyZSBtb2RlIGFzIHRoZSBhc3NldC1yZWZlcmVuY2UgdHlwZXMgYmVmb3JlIHRoZXkgZ2FpbmVkIGFuIGV4cGxpY2l0XG4gICAgICAgIC8vIGB0eXBlYCBmaWVsZCAoc2VlIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIGFib3ZlKS5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScsIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogJ2NjLk5vZGUnIH0gfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50QXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBhd2FpdCBhcHBseUNvbXBvbmVudFJlZmVyZW5jZUFycmF5KFxuICAgICAgICAgICAgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb2Nlc3NlZFZhbHVlLCBnZXRDb21wb25lbnRJbmZvXG4gICAgICAgICk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yQXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yQXJyYXlWYWx1ZSA9IHByb2Nlc3NlZFZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ3InIGluIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yQXJyYXlWYWx1ZSwgdHlwZTogJ2NjLkNvbG9yJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCwgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWN0dWFsRXhwZWN0ZWRWYWx1ZTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGEgdGFyZ2V0IG5vZGUncyBjb21wb25lbnQgcmVmZXJlbmNlIHRvIGl0cyBzY2VuZSBjb21wb25lbnQgaWQsIFdJVEhPVVRcbiAqIHBlcmZvcm1pbmcgdGhlIGBzZXQtcHJvcGVydHlgIHdyaXRlLiBTaGFyZWQgYnkgdGhlIHNpbmdsZS1gY29tcG9uZW50YCBwcm9wZXJ0eVR5cGVcbiAqICh3aGljaCB3cml0ZXMgb25lIGB7IHV1aWQgfWAgdmFsdWUpIGFuZCB0aGUgYGNvbXBvbmVudEFycmF5YCBwcm9wZXJ0eVR5cGUgKHdoaWNoXG4gKiB3cml0ZXMgYSB3aG9sZSBhcnJheSBpbiBvbmUgc2V0LXByb3BlcnR5IGNhbGwsIHNvIHBlci1lbGVtZW50IHdyaXRlcyBtdXN0IG5vdCBoYXBwZW5cbiAqIGhlcmUg4oCUIGlzc3VlICMxOCkuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICB0YXJnZXROb2RlVXVpZDogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8eyBjb21wb25lbnRJZDogc3RyaW5nOyBleHBlY3RlZENvbXBvbmVudFR5cGU6IHN0cmluZyB9PiB7XG4gICAgY29uc29sZS5sb2coYFtNYW5hZ2VDb21wb25lbnRdIFNldHRpbmcgY29tcG9uZW50IHJlZmVyZW5jZSAtIGZpbmRpbmcgY29tcG9uZW50IG9uIG5vZGU6ICR7dGFyZ2V0Tm9kZVV1aWR9YCk7XG5cbiAgICBsZXQgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gJyc7XG4gICAgY29uc3QgY3VycmVudENvbXBvbmVudEluZm8gPSBhd2FpdCBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICAvLyBXYWxrIGRvdHRlZCBwcm9wZXJ0eSBwYXRocyB0aHJvdWdoIG5lc3RlZCBDQ0NsYXNzIGdyb3VwIGR1bXBzIHRvIGZpbmQgdGhlIG1ldGFkYXRhIGRlc2NyaXB0b3IuXG4gICAgbGV0IHByb3BlcnR5TWV0YTogYW55ID0gY3VycmVudENvbXBvbmVudEluZm8uc3VjY2VzcyA/IGN1cnJlbnRDb21wb25lbnRJbmZvLmRhdGE/LnByb3BlcnRpZXMgOiB1bmRlZmluZWQ7XG4gICAgaWYgKHByb3BlcnR5TWV0YSkge1xuICAgICAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5LnNwbGl0KCcuJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoICYmIHByb3BlcnR5TWV0YTsgaSsrKSB7XG4gICAgICAgICAgICBwcm9wZXJ0eU1ldGEgPSBwcm9wZXJ0eU1ldGFbc2VnbWVudHNbaV1dO1xuICAgICAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIGlmICghaXNMZWFmICYmIHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5TWV0YSA9IHByb3BlcnR5TWV0YS52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBUcmVhdCAnVW5rbm93bicgYXMgbWlzc2luZyDigJQgaXQgYXBwZWFycyB3aGVuIGEgcHJldmlvdXMgYXNzaWdubWVudCBzdG9yZWRcbiAgICAvLyBhIHZhbHVlIHdob3NlIHJ1bnRpbWUgdHlwZSBkaWRuJ3QgbWF0Y2ggdGhlIEBwcm9wZXJ0eSBkZWNsYXJlZCB0eXBlLCBsZWF2aW5nXG4gICAgLy8gdGhlIGR1bXAncyB0eXBlIGZpZWxkIHN0YWxlLlxuICAgIGNvbnN0IGlzVXNhYmxlVHlwZSA9ICh0OiBhbnkpID0+IHR5cGVvZiB0ID09PSAnc3RyaW5nJyAmJiB0Lmxlbmd0aCA+IDAgJiYgdCAhPT0gJ1Vua25vd24nO1xuICAgIGlmIChwcm9wZXJ0eU1ldGEpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaWYgKGlzVXNhYmxlVHlwZShwcm9wZXJ0eU1ldGEudHlwZSkpIHtcbiAgICAgICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBwcm9wZXJ0eU1ldGEudHlwZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS5jdG9yKSkge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IHByb3BlcnR5TWV0YS5jdG9yO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU1ldGEuZXh0ZW5kcyAmJiBBcnJheS5pc0FycmF5KHByb3BlcnR5TWV0YS5leHRlbmRzKSkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXh0ZW5kVHlwZSBvZiBwcm9wZXJ0eU1ldGEuZXh0ZW5kcykge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXh0ZW5kVHlwZS5zdGFydHNXaXRoKCdjYy4nKSAmJiBleHRlbmRUeXBlICE9PSAnY2MuQ29tcG9uZW50JyAmJiBleHRlbmRUeXBlICE9PSAnY2MuT2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gZXh0ZW5kVHlwZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gYHF1ZXJ5LW5vZGVgIFJFSkVDVFMgb24gc29tZSBlZGl0b3IgYnVpbGRzIGFuZCByZXNvbHZlcyBmYWxzeSBvbiBvdGhlcnM7IGJvdGggbWVhblxuICAgIC8vIHRoZSBzYW1lIHRoaW5nIGhlcmUg4oCUIHRoZSB2YWx1ZSBpcyBub3QgYSBub2RlIHV1aWQuXG4gICAgbGV0IHRhcmdldE5vZGVEYXRhOiBhbnkgPSBudWxsO1xuICAgIHRyeSB7XG4gICAgICAgIHRhcmdldE5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHRhcmdldE5vZGVVdWlkKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgdGFyZ2V0Tm9kZURhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghdGFyZ2V0Tm9kZURhdGEgfHwgIXRhcmdldE5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAvLyBUaGUgY2FsbGVyIG1heSBoYXZlIHBhc3NlZCB0aGUgQ09NUE9ORU5UJ3Mgb3duIHV1aWQg4oCUIHRoZSBgdXVpZGAgZmllbGQgdGhhdFxuICAgICAgICAvLyBtYW5hZ2VfY29tcG9uZW50IGdldF9hbGwgLyBnZXRfaW5mbyByZXR1cm4sIGFuZCB0aGUgb2J2aW91cyB0aGluZyB0byByZWFjaCBmb3JcbiAgICAgICAgLy8gd2hlbiB3aXJpbmcgYSBAcHJvcGVydHkoU29tZUNvbXBvbmVudCkgcmVmZXJlbmNlLiBBY2NlcHQgdGhhdCBzcGVsbGluZyBpbnN0ZWFkXG4gICAgICAgIC8vIG9mIHJlcG9ydGluZyBhIGNvcnJlY3QgdXVpZCBhcyBhIG1pc3Npbmcgbm9kZS5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gUmVzb2x2ZS1vbmx5LCBleGFjdGx5IGxpa2UgdGhlIG5vZGUgcGF0aCBiZWxvdyDigJQgdGhpcyBmdW5jdGlvbiBoYXMgbm9cbiAgICAgICAgLy8gYHByb3BlcnR5UGF0aGAgYW5kIG11c3QgbmV2ZXIgd3JpdGUuIFRoZSBjYWxsZXIgKGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlIGZvciBhXG4gICAgICAgIC8vIHNpbmdsZSByZWZlcmVuY2UsIGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlQXJyYXkgZm9yIGFuIGFycmF5KSBwZXJmb3JtcyB0aGUgT05FXG4gICAgICAgIC8vIHNldC1wcm9wZXJ0eSB3cml0ZTsgYSB3cml0ZSBoZXJlIHdvdWxkIGZpcmUgb25jZSBwZXIgZWxlbWVudCBvbiBhIGNvbXBvbmVudEFycmF5XG4gICAgICAgIC8vIChpc3N1ZSAjMTgpLlxuICAgICAgICBjb25zdCBkaXJlY3QgPSBhd2FpdCBxdWVyeUNvbXBvbmVudEJ5VXVpZCh0YXJnZXROb2RlVXVpZCk7XG4gICAgICAgIGlmICghZGlyZWN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke3RhcmdldE5vZGVVdWlkfScgaXMgbmVpdGhlciBhIG5vZGUgdXVpZCBub3IgYSBjb21wb25lbnQgdXVpZC4gYCArXG4gICAgICAgICAgICAgICAgYFBhc3MgdGhlIHV1aWQgb2YgdGhlIE5PREUgdGhhdCBob2xkcyB0aGUgY29tcG9uZW50LCBvciB0aGUgY29tcG9uZW50J3Mgb3duIGAgK1xuICAgICAgICAgICAgICAgIGB1dWlkIGZyb20gbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249Z2V0X2FsbC5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlyZWN0VHlwZSA9IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB8fCBkaXJlY3QudHlwZTtcbiAgICAgICAgaWYgKCFkaXJlY3RUeXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgcmVxdWlyZWQgY29tcG9uZW50IHR5cGUgZm9yIHByb3BlcnR5ICcke3Byb3BlcnR5fScgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gUHJvcGVydHkgbWV0YWRhdGEgbWF5IG5vdCBjb250YWluIHR5cGUgaW5mb3JtYXRpb24uYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgbm9kZSBwYXRoIGJlbG93IG9ubHkgZXZlciByZXNvbHZlcyBhIGNvbXBvbmVudCB3aG9zZSB0eXBlIEVYQUNUTFkgbWF0Y2hlc1xuICAgICAgICAvLyBleHBlY3RlZENvbXBvbmVudFR5cGUgKGl0cyBzZWFyY2ggbG9vcCByZWplY3RzIGFueXRoaW5nIGVsc2UpLiBgZXhwZWN0ZWRDb21wb25lbnRUeXBlXG4gICAgICAgIC8vIHx8IGRpcmVjdC50eXBlYCBvbmx5IGZhbGxzIGJhY2sgdG8gZGlyZWN0LnR5cGUgd2hlbiBleHBlY3RlZENvbXBvbmVudFR5cGUgaXMgZW1wdHk7XG4gICAgICAgIC8vIGl0IG5ldmVyIHZhbGlkYXRlZCB0aGUgdHdvIGFnYWluc3QgZWFjaCBvdGhlciB3aGVuIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBXQVMga25vd24sXG4gICAgICAgIC8vIGxldHRpbmcgYSBtaXNtYXRjaGVkIGNvbXBvbmVudCAoZS5nLiBhIGNjLlNwcml0ZSB1dWlkIG9uIGEgcHJvcGVydHkgdHlwZWRcbiAgICAgICAgLy8gSGVyb0RyYWdDb250cm9sbGVyKSByZXNvbHZlIHVucmVqZWN0ZWQuIEEgZGlyZWN0LnR5cGUgdGhhdCBpcyBpdHNlbGYgdW51c2FibGVcbiAgICAgICAgLy8gKCdVbmtub3duJy9ibGFuaykgY2Fubm90IGRpc3Byb3ZlIGEgbWF0Y2gsIHNvIGl0IGlzIGxlZnQgdG8gZmFsbCB0aHJvdWdoLlxuICAgICAgICBpZiAoZXhwZWN0ZWRDb21wb25lbnRUeXBlICYmIGlzVXNhYmxlVHlwZShkaXJlY3QudHlwZSkgJiYgZGlyZWN0LnR5cGUgIT09IGV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGBDb21wb25lbnQgdXVpZCAnJHt0YXJnZXROb2RlVXVpZH0nIGlzIGEgJyR7ZGlyZWN0LnR5cGV9JywgYnV0IHByb3BlcnR5ICcke3Byb3BlcnR5fScgYCArXG4gICAgICAgICAgICAgICAgYG9uICcke2NvbXBvbmVudFR5cGV9JyByZXF1aXJlcyBhICcke2V4cGVjdGVkQ29tcG9uZW50VHlwZX0nLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBjb21wb25lbnRJZDogZGlyZWN0LnV1aWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZTogZGlyZWN0VHlwZSB9O1xuICAgIH1cblxuICAgIC8vIFNpbmdsZS1jYy1jb21wb25lbnQgZmFsbGJhY2s6IHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIGNvdWxkIG5vdCBiZSBpbmZlcnJlZFxuICAgIC8vIChlLmcuLCBzdGFsZSAnVW5rbm93bicgaW4gZHVtcCBhbmQgZXh0ZW5kcyBvbmx5IGxpc3RzIGNjLkNvbXBvbmVudC9jYy5PYmplY3QpLFxuICAgIC8vIGFuZCB0aGUgdGFyZ2V0IG5vZGUgaGFzIGV4YWN0bHkgb25lIGNjLiogY29tcG9uZW50LCB1c2UgaXQuIE1pcnJvcnMgQ29jb3Mnc1xuICAgIC8vIGRyYWctZnJvbS1oaWVyYXJjaHkgYXV0by1yZXNvbHZlIGJlaGF2aW9yLlxuICAgIGlmICghZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGNjQ29tcHMgPSAodGFyZ2V0Tm9kZURhdGEuX19jb21wc19fIGFzIGFueVtdKVxuICAgICAgICAgICAgLmZpbHRlcihjID0+IHR5cGVvZiBjLnR5cGUgPT09ICdzdHJpbmcnICYmIGMudHlwZS5zdGFydHNXaXRoKCdjYy4nKVxuICAgICAgICAgICAgICAgICYmIGMudHlwZSAhPT0gJ2NjLkNvbXBvbmVudCcgJiYgYy50eXBlICE9PSAnY2MuT2JqZWN0Jyk7XG4gICAgICAgIGlmIChjY0NvbXBzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gY2NDb21wc1swXS50eXBlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZGV0ZXJtaW5lIHJlcXVpcmVkIGNvbXBvbmVudCB0eXBlIGZvciBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIFByb3BlcnR5IG1ldGFkYXRhIG1heSBub3QgY29udGFpbiB0eXBlIGluZm9ybWF0aW9uLmApO1xuICAgIH1cblxuICAgIGxldCBjb21wb25lbnRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGZvdW5kQ29tcG9uZW50ID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldE5vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb21wID0gdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgaWYgKGNvbXAudHlwZSA9PT0gZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICBmb3VuZENvbXBvbmVudCA9IGNvbXA7XG4gICAgICAgICAgICBpZiAoY29tcC52YWx1ZSAmJiBjb21wLnZhbHVlLnV1aWQgJiYgY29tcC52YWx1ZS51dWlkLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50SWQgPSBjb21wLnZhbHVlLnV1aWQudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGV4dHJhY3QgY29tcG9uZW50IElEIGZyb20gY29tcG9uZW50IHN0cnVjdHVyZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZvdW5kQ29tcG9uZW50KSB7XG4gICAgICAgIGNvbnN0IGF2YWlsYWJsZSA9IHRhcmdldE5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmVJZCA9IGNvbXAudmFsdWUgJiYgY29tcC52YWx1ZS51dWlkICYmIGNvbXAudmFsdWUudXVpZC52YWx1ZSA/IGNvbXAudmFsdWUudXVpZC52YWx1ZSA6ICd1bmtub3duJztcbiAgICAgICAgICAgIHJldHVybiBgJHtjb21wLnR5cGV9KHNjZW5lX2lkOiR7c2NlbmVJZH0pYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50IHR5cGUgJyR7ZXhwZWN0ZWRDb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGUgJHt0YXJnZXROb2RlVXVpZH0uIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2F2YWlsYWJsZS5qb2luKCcsICcpfWApO1xuICAgIH1cblxuICAgIGlmICghY29tcG9uZW50SWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZXh0cmFjdCBjb21wb25lbnQgSUQgZnJvbSBjb21wb25lbnQgc3RydWN0dXJlYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29tcG9uZW50SWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9O1xufVxuXG4vKiogUmVzb2x2ZSBhIGNvbXBvbmVudCByZWZlcmVuY2UgYW5kIHdyaXRlIGl0IGFzIGEgc2luZ2xlIGB7IHV1aWQgfWAgdmFsdWUuICovXG5hc3luYyBmdW5jdGlvbiBhcHBseUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB7IGNvbXBvbmVudElkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfSA9IGF3YWl0IHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdGFyZ2V0Tm9kZVV1aWQsIGdldENvbXBvbmVudEluZm9cbiAgICApO1xuXG4gICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHV1aWQ6IGNvbXBvbmVudElkIH0sIHR5cGU6IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyB1dWlkOiBjb21wb25lbnRJZCB9O1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW4gYXJyYXkgb2YgdGFyZ2V0LW5vZGUgVVVJRHMgdG8gdGhlaXIgY29tcG9uZW50IHJlZmVyZW5jZXMgYW5kIHdyaXRlIHRoZVxuICogd2hvbGUgYXJyYXkgaW4gT05FIHNldC1wcm9wZXJ0eSBjYWxsIChtYXRjaGluZyB0aGUgbm9kZUFycmF5IGZpeCBhYm92ZSDigJQgYW4gYXJyYXlcbiAqIHByb3BlcnR5IG5lZWRzIGBpc0FycmF5YC9gZWxlbWVudFR5cGVEYXRhYCBpbiB0aGUgZHVtcCwgbm90IE4gc2VwYXJhdGUgc2NhbGFyIHdyaXRlcykuXG4gKiBBbiBlbXB0eSBpbnB1dCBhcnJheSBpcyBndWFyZGVkIGV4cGxpY2l0bHk6IHRoZXJlIGlzIG5vIGVsZW1lbnQgdG8gcmVzb2x2ZSBhXG4gKiBjb21wb25lbnQgdHlwZSBmcm9tLCBzbyBpdCBpcyB3cml0dGVuIGFzIGFuIGVtcHR5IGFycmF5IHdpdGggYSBnZW5lcmljIGVsZW1lbnQgdHlwZVxuICogcmF0aGVyIHRoYW4gaW5kZXhpbmcgaW50byBhbiBhcnJheSB0aGF0IGhhcyBubyBgWzBdYC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkczogYW55W10sXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBpZiAodGFyZ2V0Tm9kZVV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogW10sIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogJ2NjLkNvbXBvbmVudCcgfSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb2x2ZWRSZWZzOiBBcnJheTx7IHV1aWQ6IHN0cmluZyB9PiA9IFtdO1xuICAgIGxldCBlbGVtZW50VHlwZSA9ICcnO1xuICAgIGZvciAoY29uc3QgdGFyZ2V0Tm9kZVV1aWQgb2YgdGFyZ2V0Tm9kZVV1aWRzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0Tm9kZVV1aWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbXBvbmVudEFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIG5vZGUgVVVJRHMgKGVhY2ggY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCknKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7IGNvbXBvbmVudElkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfSA9IGF3YWl0IHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHRhcmdldE5vZGVVdWlkLCBnZXRDb21wb25lbnRJbmZvXG4gICAgICAgICk7XG4gICAgICAgIHJlc29sdmVkUmVmcy5wdXNoKHsgdXVpZDogY29tcG9uZW50SWQgfSk7XG4gICAgICAgIGVsZW1lbnRUeXBlID0gZWxlbWVudFR5cGUgfHwgZXhwZWN0ZWRDb21wb25lbnRUeXBlO1xuICAgIH1cblxuICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgZHVtcDogeyB2YWx1ZTogcmVzb2x2ZWRSZWZzLCBpc0FycmF5OiB0cnVlLCBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IG51bGwsIHR5cGU6IGVsZW1lbnRUeXBlIH0gfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc29sdmVkUmVmcztcbn1cblxuLyoqXG4gKiBMb29rIGEgdXVpZCB1cCBhcyBhIENPTVBPTkVOVCByYXRoZXIgdGhhbiBhIG5vZGUuXG4gKlxuICogYHF1ZXJ5LWNvbXBvbmVudGAgYW5zd2VycyBmb3IgYSBjb21wb25lbnQncyBvd24gdXVpZCBhbmQgcmV0dXJucyB0aGUgc2FtZSBkdW1wIHNoYXBlIGFzXG4gKiBvbmUgYF9fY29tcHNfX2AgZW50cnksIHNvIGB2YWx1ZS51dWlkLnZhbHVlYCBhbmQgYHR5cGVgIHJlYWQgZXhhY3RseSBhcyB0aGV5IGRvIG9uIHRoZVxuICogbm9kZSBwYXRoLiBSZXR1cm5zIG51bGwgZm9yIGFueXRoaW5nIHRoYXQgaXMgbm90IGEgbGl2ZSBjb21wb25lbnQg4oCUIGluY2x1ZGluZyBhIHV1aWRcbiAqIHRoYXQgbmFtZXMgbm90aGluZyBhdCBhbGwg4oCUIHNvIHRoZSBjYWxsZXIgY2FuIHJlcG9ydCBib3RoIGFjY2VwdGVkIHNwZWxsaW5ncy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcXVlcnlDb21wb25lbnRCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTx7IHV1aWQ6IHN0cmluZzsgdHlwZTogc3RyaW5nIH0gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tcDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktY29tcG9uZW50JywgdXVpZCk7XG4gICAgICAgIGlmICghY29tcCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcmVzb2x2ZWRVdWlkID0gY29tcC52YWx1ZT8udXVpZD8udmFsdWUgfHwgY29tcC51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQgfHwgdXVpZDtcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbXAudHlwZSB8fCBjb21wLmNpZCB8fCBjb21wLl9fdHlwZV9fIHx8ICcnO1xuICAgICAgICByZXR1cm4geyB1dWlkOiByZXNvbHZlZFV1aWQsIHR5cGUgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuIl19