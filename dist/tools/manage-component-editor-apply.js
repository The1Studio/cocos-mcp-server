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
    if (manage_component_property_helpers_1.ASSET_REFERENCE_PROPERTY_TYPES.includes(propertyType) ||
        (propertyType === 'string' && NAME_HINTED_ASSET_KEYWORDS.some(k => property.toLowerCase().includes(k)))) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUFrQkQsc0RBc0hDO0FBOUpELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQ3ZDLElBQXVCLEVBQ3ZCLGdCQUF3RjtJQUV4RixNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUs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WUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7U0FDN0ksQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLE1BQU0sSUFBSSxjQUFjLElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDekYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDbEMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7U0FDM0csQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLE1BQU0sSUFBSSxjQUFjLElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDekYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDbEMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxN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UUFDTCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRWRpdG9yIEFQSSBjYWxscyBmb3IgYXBwbHlpbmcgY29tcG9uZW50IHByb3BlcnR5IHZhbHVlcy5cbiAqIEV4dHJhY3RlZCBmcm9tIE1hbmFnZUNvbXBvbmVudC5zZXRDb21wb25lbnRQcm9wZXJ0eSAoU3RlcCA2KS5cbiAqIEVhY2ggcHJvcGVydHkgdHlwZSB1c2VzIGEgZGlmZmVyZW50IGR1bXAgZm9ybWF0IGZvciBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknKS5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTLCBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEUgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5cbi8qKiBQcm9wZXJ0eS1uYW1lIHN1YnN0cmluZ3MgdGhhdCBtYXJrIGEgYmFyZSBgc3RyaW5nYCB2YWx1ZSBhcyBhbiBhc3NldCByZWZlcmVuY2UuICovXG5jb25zdCBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUyA9IFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ107XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgQ29jb3MgYXNzZXQgY2xhc3MgZm9yIHRoZSBFZGl0b3IgYHNldC1wcm9wZXJ0eWAgZHVtcCBgdHlwZWAgZmllbGQuXG4gKlxuICogQW4gZXhwbGljaXQgcHJvcGVydHlUeXBlIChgbWF0ZXJpYWxgLCBgbWVzaGAsIOKApikgd2lucywgYmVjYXVzZSBpdCBpcyBhdXRob3JpdGF0aXZlLlxuICogT25seSB0aGUgZ2VuZXJpYyBgYXNzZXRgIC8gYHN0cmluZ2Agc3BlbGxpbmdzIOKAlCB3aGljaCBjYXJyeSBubyB0eXBlIGluZm9ybWF0aW9uIOKAlCBmYWxsIGJhY2tcbiAqIHRvIHRoZSBwcm9wZXJ0eS1uYW1lIGhldXJpc3RpYywgc28gZXhpc3RpbmcgY2FsbGVycyB1c2luZyB0aG9zZSBrZWVwIHRoZWlyIGV4YWN0IGJlaGF2aW91ci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVBc3NldFR5cGUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGV4cGxpY2l0ID0gQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFW3Byb3BlcnR5VHlwZV07XG4gICAgaWYgKGV4cGxpY2l0KSByZXR1cm4gZXhwbGljaXQ7XG5cbiAgICBjb25zdCBuYW1lID0gcHJvcGVydHkudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAobmFtZS5pbmNsdWRlcygndGV4dHVyZScpKSByZXR1cm4gJ2NjLlRleHR1cmUyRCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ21hdGVyaWFsJykpIHJldHVybiAnY2MuTWF0ZXJpYWwnO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCdmb250JykpIHJldHVybiAnY2MuRm9udCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ2NsaXAnKSkgcmV0dXJuICdjYy5BdWRpb0NsaXAnO1xuICAgIHJldHVybiAnY2MuU3ByaXRlRnJhbWUnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwcGx5UHJvcGVydHlBcmdzIHtcbiAgICBub2RlVXVpZDogc3RyaW5nO1xuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nO1xuICAgIHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXI7XG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nO1xuICAgIHByb3BlcnR5OiBzdHJpbmc7XG4gICAgcHJvcGVydHlUeXBlOiBzdHJpbmc7XG4gICAgdmFsdWU6IGFueTtcbiAgICBwcm9jZXNzZWRWYWx1ZTogYW55O1xufVxuXG4vKipcbiAqIEFwcGx5IGEgcHJvY2Vzc2VkIHByb3BlcnR5IHZhbHVlIHRvIHRoZSBDb2NvcyBDcmVhdG9yIGVkaXRvciBzY2VuZS5cbiAqIFJldHVybnMgdGhlIGFjdHVhbCBleHBlY3RlZCB2YWx1ZSAobWF5IGRpZmZlciBmcm9tIHByb2Nlc3NlZFZhbHVlIGZvciBjb21wb25lbnQgcmVmcykuXG4gKiBUaHJvd3Mgb24gdW5yZWNvdmVyYWJsZSBFZGl0b3IgQVBJIGVycm9yLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXBwbHlQcm9wZXJ0eVRvRWRpdG9yKFxuICAgIGFyZ3M6IEFwcGx5UHJvcGVydHlBcmdzLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgeyBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCByYXdDb21wb25lbnRJbmRleCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUsIHByb2Nlc3NlZFZhbHVlIH0gPSBhcmdzO1xuICAgIGxldCBhY3R1YWxFeHBlY3RlZFZhbHVlID0gcHJvY2Vzc2VkVmFsdWU7XG5cbiAgICAvLyBFVkVSWSBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHlUeXBlIG11c3QgbGFuZCBoZXJlLiBGYWxsaW5nIHRocm91Z2ggdG8gdGhlIHRlcm1pbmFsIGBlbHNlYFxuICAgIC8vIHNlbmRzIGEgZHVtcCB3aXRoIG5vIGB0eXBlYCBmaWVsZCDigJQgdGhlIHNhbWUgc2hhcGUgdGhhdCBtYWtlcyB0aGUgbm9kZUFycmF5IHBhdGggZmFpbFxuICAgIC8vIChpc3N1ZSAjMTgpIOKAlCBzbyBhbiBhY2NlcHRlZC1idXQtdHlwZWxlc3MgcHJvcGVydHlUeXBlIHdvdWxkIHNpbGVudGx5IG5vdCBhcHBseS5cbiAgICBpZiAoKEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocHJvcGVydHlUeXBlKSB8fFxuICAgICAgICAocHJvcGVydHlUeXBlID09PSAnc3RyaW5nJyAmJiBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUy5zb21lKGsgPT4gcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrKSkpKSB7XG5cbiAgICAgICAgY29uc3QgYXNzZXRUeXBlID0gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGUsIHByb3BlcnR5KTtcblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUsIHR5cGU6IGFzc2V0VHlwZSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nICYmIChwcm9wZXJ0eSA9PT0gJ19jb250ZW50U2l6ZScgfHwgcHJvcGVydHkgPT09ICdjb250ZW50U2l6ZScpKSB7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gTnVtYmVyKHZhbHVlLndpZHRoKSB8fCAxMDA7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDEwMDtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0ud2lkdGhgLCBkdW1wOiB7IHZhbHVlOiB3aWR0aCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5oZWlnaHRgLCBkdW1wOiB7IHZhbHVlOiBoZWlnaHQgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyAmJiAocHJvcGVydHkgPT09ICdfYW5jaG9yUG9pbnQnIHx8IHByb3BlcnR5ID09PSAnYW5jaG9yUG9pbnQnKSkge1xuICAgICAgICBjb25zdCBhbmNob3JYID0gTnVtYmVyKHZhbHVlLngpIHx8IDAuNTtcbiAgICAgICAgY29uc3QgYW5jaG9yWSA9IE51bWJlcih2YWx1ZS55KSB8fCAwLjU7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvclhgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JYIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvcllgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JZIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yVmFsdWUgPSB7XG4gICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5yKSB8fCAwKSksXG4gICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5nKSB8fCAwKSksXG4gICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5iKSB8fCAwKSksXG4gICAgICAgICAgICBhOiBwcm9jZXNzZWRWYWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5hKSkpIDogMjU1XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yVmFsdWUsIHR5cGU6ICdjYy5Db2xvcicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMycgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAsIHo6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS56KSB8fCAwIH0sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICd2ZWMyJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS54KSB8fCAwLCB5OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueSkgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnc2l6ZScgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB3aWR0aDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLndpZHRoKSB8fCAwLCBoZWlnaHQ6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS5oZWlnaHQpIHx8IDAgfSwgdHlwZTogJ2NjLlNpemUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ25vZGUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIHByb2Nlc3NlZFZhbHVlKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50JyAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBhd2FpdCBhcHBseUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9jZXNzZWRWYWx1ZSwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICAgICApO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlQXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIC8vIFdpdGhvdXQgYW4gZXhwbGljaXQgdHlwZS9pc0FycmF5L2VsZW1lbnRUeXBlRGF0YSwgdGhlIGVkaXRvcidzIHNldC1wcm9wZXJ0eVxuICAgICAgICAvLyBkdW1wIGhhcyBubyB3YXkgdG8ga25vdyB0aGlzIGlzIGFuIGFycmF5IG9mIGNjLk5vZGUgcmVmZXJlbmNlcyDigJQgaXQgZmFsbHNcbiAgICAgICAgLy8gdGhyb3VnaCBhcyBhIGJhcmUgdmFsdWUgYW5kIHNpbGVudGx5IGRvZXMgbm90IGFwcGx5IChpc3N1ZSAjMTgpLCB0aGUgc2FtZVxuICAgICAgICAvLyBmYWlsdXJlIG1vZGUgYXMgdGhlIGFzc2V0LXJlZmVyZW5jZSB0eXBlcyBiZWZvcmUgdGhleSBnYWluZWQgYW4gZXhwbGljaXRcbiAgICAgICAgLy8gYHR5cGVgIGZpZWxkIChzZWUgdGhlIGFzc2V0LXJlZmVyZW5jZSBicmFuY2ggYWJvdmUpLlxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUsIHR5cGU6ICdjYy5Ob2RlJywgaXNBcnJheTogdHJ1ZSwgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiBudWxsLCB0eXBlOiAnY2MuTm9kZScgfSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnRBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlQXJyYXkoXG4gICAgICAgICAgICBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvY2Vzc2VkVmFsdWUsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29sb3JBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgY29uc3QgY29sb3JBcnJheVZhbHVlID0gcHJvY2Vzc2VkVmFsdWUubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChpdGVtICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0ucikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5iKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGE6IGl0ZW0uYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5hKSkpIDogMjU1XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHI6IDI1NSwgZzogMjU1LCBiOiAyNTUsIGE6IDI1NSB9O1xuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCwgZHVtcDogeyB2YWx1ZTogY29sb3JBcnJheVZhbHVlLCB0eXBlOiAnY2MuQ29sb3InIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBhY3R1YWxFeHBlY3RlZFZhbHVlO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYSB0YXJnZXQgbm9kZSdzIGNvbXBvbmVudCByZWZlcmVuY2UgdG8gaXRzIHNjZW5lIGNvbXBvbmVudCBpZCwgV0lUSE9VVFxuICogcGVyZm9ybWluZyB0aGUgYHNldC1wcm9wZXJ0eWAgd3JpdGUuIFNoYXJlZCBieSB0aGUgc2luZ2xlLWBjb21wb25lbnRgIHByb3BlcnR5VHlwZVxuICogKHdoaWNoIHdyaXRlcyBvbmUgYHsgdXVpZCB9YCB2YWx1ZSkgYW5kIHRoZSBgY29tcG9uZW50QXJyYXlgIHByb3BlcnR5VHlwZSAod2hpY2hcbiAqIHdyaXRlcyBhIHdob2xlIGFycmF5IGluIG9uZSBzZXQtcHJvcGVydHkgY2FsbCwgc28gcGVyLWVsZW1lbnQgd3JpdGVzIG11c3Qgbm90IGhhcHBlblxuICogaGVyZSDigJQgaXNzdWUgIzE4KS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTx7IGNvbXBvbmVudElkOiBzdHJpbmc7IGV4cGVjdGVkQ29tcG9uZW50VHlwZTogc3RyaW5nIH0+IHtcbiAgICBjb25zb2xlLmxvZyhgW01hbmFnZUNvbXBvbmVudF0gU2V0dGluZyBjb21wb25lbnQgcmVmZXJlbmNlIC0gZmluZGluZyBjb21wb25lbnQgb24gbm9kZTogJHt0YXJnZXROb2RlVXVpZH1gKTtcblxuICAgIGxldCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSAnJztcbiAgICBjb25zdCBjdXJyZW50Q29tcG9uZW50SW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgIC8vIFdhbGsgZG90dGVkIHByb3BlcnR5IHBhdGhzIHRocm91Z2ggbmVzdGVkIENDQ2xhc3MgZ3JvdXAgZHVtcHMgdG8gZmluZCB0aGUgbWV0YWRhdGEgZGVzY3JpcHRvci5cbiAgICBsZXQgcHJvcGVydHlNZXRhOiBhbnkgPSBjdXJyZW50Q29tcG9uZW50SW5mby5zdWNjZXNzID8gY3VycmVudENvbXBvbmVudEluZm8uZGF0YT8ucHJvcGVydGllcyA6IHVuZGVmaW5lZDtcbiAgICBpZiAocHJvcGVydHlNZXRhKSB7XG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlNZXRhOyBpKyspIHtcbiAgICAgICAgICAgIHByb3BlcnR5TWV0YSA9IHByb3BlcnR5TWV0YVtzZWdtZW50c1tpXV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlNZXRhID0gcHJvcGVydHlNZXRhLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIFRyZWF0ICdVbmtub3duJyBhcyBtaXNzaW5nIOKAlCBpdCBhcHBlYXJzIHdoZW4gYSBwcmV2aW91cyBhc3NpZ25tZW50IHN0b3JlZFxuICAgIC8vIGEgdmFsdWUgd2hvc2UgcnVudGltZSB0eXBlIGRpZG4ndCBtYXRjaCB0aGUgQHByb3BlcnR5IGRlY2xhcmVkIHR5cGUsIGxlYXZpbmdcbiAgICAvLyB0aGUgZHVtcCdzIHR5cGUgZmllbGQgc3RhbGUuXG4gICAgY29uc3QgaXNVc2FibGVUeXBlID0gKHQ6IGFueSkgPT4gdHlwZW9mIHQgPT09ICdzdHJpbmcnICYmIHQubGVuZ3RoID4gMCAmJiB0ICE9PSAnVW5rbm93bic7XG4gICAgaWYgKHByb3BlcnR5TWV0YSkge1xuICAgICAgICBpZiAocHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS50eXBlKSkge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IHByb3BlcnR5TWV0YS50eXBlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc1VzYWJsZVR5cGUocHJvcGVydHlNZXRhLmN0b3IpKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gcHJvcGVydHlNZXRhLmN0b3I7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TWV0YS5leHRlbmRzICYmIEFycmF5LmlzQXJyYXkocHJvcGVydHlNZXRhLmV4dGVuZHMpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBleHRlbmRUeXBlIG9mIHByb3BlcnR5TWV0YS5leHRlbmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHRlbmRUeXBlLnN0YXJ0c1dpdGgoJ2NjLicpICYmIGV4dGVuZFR5cGUgIT09ICdjYy5Db21wb25lbnQnICYmIGV4dGVuZFR5cGUgIT09ICdjYy5PYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBleHRlbmRUeXBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBgcXVlcnktbm9kZWAgUkVKRUNUUyBvbiBzb21lIGVkaXRvciBidWlsZHMgYW5kIHJlc29sdmVzIGZhbHN5IG9uIG90aGVyczsgYm90aCBtZWFuXG4gICAgLy8gdGhlIHNhbWUgdGhpbmcgaGVyZSDigJQgdGhlIHZhbHVlIGlzIG5vdCBhIG5vZGUgdXVpZC5cbiAgICBsZXQgdGFyZ2V0Tm9kZURhdGE6IGFueSA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgICAgdGFyZ2V0Tm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdGFyZ2V0Tm9kZVV1aWQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICB0YXJnZXROb2RlRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCF0YXJnZXROb2RlRGF0YSB8fCAhdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgIC8vIFRoZSBjYWxsZXIgbWF5IGhhdmUgcGFzc2VkIHRoZSBDT01QT05FTlQncyBvd24gdXVpZCDigJQgdGhlIGB1dWlkYCBmaWVsZCB0aGF0XG4gICAgICAgIC8vIG1hbmFnZV9jb21wb25lbnQgZ2V0X2FsbCAvIGdldF9pbmZvIHJldHVybiwgYW5kIHRoZSBvYnZpb3VzIHRoaW5nIHRvIHJlYWNoIGZvclxuICAgICAgICAvLyB3aGVuIHdpcmluZyBhIEBwcm9wZXJ0eShTb21lQ29tcG9uZW50KSByZWZlcmVuY2UuIEFjY2VwdCB0aGF0IHNwZWxsaW5nIGluc3RlYWRcbiAgICAgICAgLy8gb2YgcmVwb3J0aW5nIGEgY29ycmVjdCB1dWlkIGFzIGEgbWlzc2luZyBub2RlLlxuICAgICAgICAvL1xuICAgICAgICAvLyBSZXNvbHZlLW9ubHksIGV4YWN0bHkgbGlrZSB0aGUgbm9kZSBwYXRoIGJlbG93IOKAlCB0aGlzIGZ1bmN0aW9uIGhhcyBub1xuICAgICAgICAvLyBgcHJvcGVydHlQYXRoYCBhbmQgbXVzdCBuZXZlciB3cml0ZS4gVGhlIGNhbGxlciAoYXBwbHlDb21wb25lbnRSZWZlcmVuY2UgZm9yIGFcbiAgICAgICAgLy8gc2luZ2xlIHJlZmVyZW5jZSwgYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheSBmb3IgYW4gYXJyYXkpIHBlcmZvcm1zIHRoZSBPTkVcbiAgICAgICAgLy8gc2V0LXByb3BlcnR5IHdyaXRlOyBhIHdyaXRlIGhlcmUgd291bGQgZmlyZSBvbmNlIHBlciBlbGVtZW50IG9uIGEgY29tcG9uZW50QXJyYXlcbiAgICAgICAgLy8gKGlzc3VlICMxOCkuXG4gICAgICAgIGNvbnN0IGRpcmVjdCA9IGF3YWl0IHF1ZXJ5Q29tcG9uZW50QnlVdWlkKHRhcmdldE5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFkaXJlY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJyR7dGFyZ2V0Tm9kZVV1aWR9JyBpcyBuZWl0aGVyIGEgbm9kZSB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkLiBgICtcbiAgICAgICAgICAgICAgICBgUGFzcyB0aGUgdXVpZCBvZiB0aGUgTk9ERSB0aGF0IGhvbGRzIHRoZSBjb21wb25lbnQsIG9yIHRoZSBjb21wb25lbnQncyBvd24gYCArXG4gICAgICAgICAgICAgICAgYHV1aWQgZnJvbSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkaXJlY3RUeXBlID0gZXhwZWN0ZWRDb21wb25lbnRUeXBlIHx8IGRpcmVjdC50eXBlO1xuICAgICAgICBpZiAoIWRpcmVjdFR5cGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGRldGVybWluZSByZXF1aXJlZCBjb21wb25lbnQgdHlwZSBmb3IgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBvbiBjb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nLiBQcm9wZXJ0eSBtZXRhZGF0YSBtYXkgbm90IGNvbnRhaW4gdHlwZSBpbmZvcm1hdGlvbi5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBub2RlIHBhdGggYmVsb3cgb25seSBldmVyIHJlc29sdmVzIGEgY29tcG9uZW50IHdob3NlIHR5cGUgRVhBQ1RMWSBtYXRjaGVzXG4gICAgICAgIC8vIGV4cGVjdGVkQ29tcG9uZW50VHlwZSAoaXRzIHNlYXJjaCBsb29wIHJlamVjdHMgYW55dGhpbmcgZWxzZSkuIGBleHBlY3RlZENvbXBvbmVudFR5cGVcbiAgICAgICAgLy8gfHwgZGlyZWN0LnR5cGVgIG9ubHkgZmFsbHMgYmFjayB0byBkaXJlY3QudHlwZSB3aGVuIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBpcyBlbXB0eTtcbiAgICAgICAgLy8gaXQgbmV2ZXIgdmFsaWRhdGVkIHRoZSB0d28gYWdhaW5zdCBlYWNoIG90aGVyIHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIFdBUyBrbm93bixcbiAgICAgICAgLy8gbGV0dGluZyBhIG1pc21hdGNoZWQgY29tcG9uZW50IChlLmcuIGEgY2MuU3ByaXRlIHV1aWQgb24gYSBwcm9wZXJ0eSB0eXBlZFxuICAgICAgICAvLyBIZXJvRHJhZ0NvbnRyb2xsZXIpIHJlc29sdmUgdW5yZWplY3RlZC4gQSBkaXJlY3QudHlwZSB0aGF0IGlzIGl0c2VsZiB1bnVzYWJsZVxuICAgICAgICAvLyAoJ1Vua25vd24nL2JsYW5rKSBjYW5ub3QgZGlzcHJvdmUgYSBtYXRjaCwgc28gaXQgaXMgbGVmdCB0byBmYWxsIHRocm91Z2guXG4gICAgICAgIGlmIChleHBlY3RlZENvbXBvbmVudFR5cGUgJiYgaXNVc2FibGVUeXBlKGRpcmVjdC50eXBlKSAmJiBkaXJlY3QudHlwZSAhPT0gZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYENvbXBvbmVudCB1dWlkICcke3RhcmdldE5vZGVVdWlkfScgaXMgYSAnJHtkaXJlY3QudHlwZX0nLCBidXQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBgICtcbiAgICAgICAgICAgICAgICBgb24gJyR7Y29tcG9uZW50VHlwZX0nIHJlcXVpcmVzIGEgJyR7ZXhwZWN0ZWRDb21wb25lbnRUeXBlfScuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGNvbXBvbmVudElkOiBkaXJlY3QudXVpZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlOiBkaXJlY3RUeXBlIH07XG4gICAgfVxuXG4gICAgLy8gU2luZ2xlLWNjLWNvbXBvbmVudCBmYWxsYmFjazogd2hlbiBleHBlY3RlZENvbXBvbmVudFR5cGUgY291bGQgbm90IGJlIGluZmVycmVkXG4gICAgLy8gKGUuZy4sIHN0YWxlICdVbmtub3duJyBpbiBkdW1wIGFuZCBleHRlbmRzIG9ubHkgbGlzdHMgY2MuQ29tcG9uZW50L2NjLk9iamVjdCksXG4gICAgLy8gYW5kIHRoZSB0YXJnZXQgbm9kZSBoYXMgZXhhY3RseSBvbmUgY2MuKiBjb21wb25lbnQsIHVzZSBpdC4gTWlycm9ycyBDb2NvcydzXG4gICAgLy8gZHJhZy1mcm9tLWhpZXJhcmNoeSBhdXRvLXJlc29sdmUgYmVoYXZpb3IuXG4gICAgaWYgKCFleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgY2NDb21wcyA9ICh0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18gYXMgYW55W10pXG4gICAgICAgICAgICAuZmlsdGVyKGMgPT4gdHlwZW9mIGMudHlwZSA9PT0gJ3N0cmluZycgJiYgYy50eXBlLnN0YXJ0c1dpdGgoJ2NjLicpXG4gICAgICAgICAgICAgICAgJiYgYy50eXBlICE9PSAnY2MuQ29tcG9uZW50JyAmJiBjLnR5cGUgIT09ICdjYy5PYmplY3QnKTtcbiAgICAgICAgaWYgKGNjQ29tcHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBjY0NvbXBzWzBdLnR5cGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgcmVxdWlyZWQgY29tcG9uZW50IHR5cGUgZm9yIHByb3BlcnR5ICcke3Byb3BlcnR5fScgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gUHJvcGVydHkgbWV0YWRhdGEgbWF5IG5vdCBjb250YWluIHR5cGUgaW5mb3JtYXRpb24uYCk7XG4gICAgfVxuXG4gICAgbGV0IGNvbXBvbmVudElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgZm91bmRDb21wb25lbnQgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNvbXAgPSB0YXJnZXROb2RlRGF0YS5fX2NvbXBzX19baV0gYXMgYW55O1xuICAgICAgICBpZiAoY29tcC50eXBlID09PSBleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIGZvdW5kQ29tcG9uZW50ID0gY29tcDtcbiAgICAgICAgICAgIGlmIChjb21wLnZhbHVlICYmIGNvbXAudmFsdWUudXVpZCAmJiBjb21wLnZhbHVlLnV1aWQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRJZCA9IGNvbXAudmFsdWUudXVpZC52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZXh0cmFjdCBjb21wb25lbnQgSUQgZnJvbSBjb21wb25lbnQgc3RydWN0dXJlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZm91bmRDb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZUlkID0gY29tcC52YWx1ZSAmJiBjb21wLnZhbHVlLnV1aWQgJiYgY29tcC52YWx1ZS51dWlkLnZhbHVlID8gY29tcC52YWx1ZS51dWlkLnZhbHVlIDogJ3Vua25vd24nO1xuICAgICAgICAgICAgcmV0dXJuIGAke2NvbXAudHlwZX0oc2NlbmVfaWQ6JHtzY2VuZUlkfSlgO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgdHlwZSAnJHtleHBlY3RlZENvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZSAke3RhcmdldE5vZGVVdWlkfS4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgaWYgKCFjb21wb25lbnRJZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBleHRyYWN0IGNvbXBvbmVudCBJRCBmcm9tIGNvbXBvbmVudCBzdHJ1Y3R1cmVgKTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBjb21wb25lbnRJZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH07XG59XG5cbi8qKiBSZXNvbHZlIGEgY29tcG9uZW50IHJlZmVyZW5jZSBhbmQgd3JpdGUgaXQgYXMgYSBzaW5nbGUgYHsgdXVpZCB9YCB2YWx1ZS4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgdGFyZ2V0Tm9kZVV1aWQ6IHN0cmluZyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHsgY29tcG9uZW50SWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9ID0gYXdhaXQgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB0YXJnZXROb2RlVXVpZCwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICk7XG5cbiAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgdXVpZDogY29tcG9uZW50SWQgfSwgdHlwZTogZXhwZWN0ZWRDb21wb25lbnRUeXBlIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7IHV1aWQ6IGNvbXBvbmVudElkIH07XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBhcnJheSBvZiB0YXJnZXQtbm9kZSBVVUlEcyB0byB0aGVpciBjb21wb25lbnQgcmVmZXJlbmNlcyBhbmQgd3JpdGUgdGhlXG4gKiB3aG9sZSBhcnJheSBpbiBPTkUgc2V0LXByb3BlcnR5IGNhbGwgKG1hdGNoaW5nIHRoZSBub2RlQXJyYXkgZml4IGFib3ZlIOKAlCBhbiBhcnJheVxuICogcHJvcGVydHkgbmVlZHMgYGlzQXJyYXlgL2BlbGVtZW50VHlwZURhdGFgIGluIHRoZSBkdW1wLCBub3QgTiBzZXBhcmF0ZSBzY2FsYXIgd3JpdGVzKS5cbiAqIEFuIGVtcHR5IGlucHV0IGFycmF5IGlzIGd1YXJkZWQgZXhwbGljaXRseTogdGhlcmUgaXMgbm8gZWxlbWVudCB0byByZXNvbHZlIGFcbiAqIGNvbXBvbmVudCB0eXBlIGZyb20sIHNvIGl0IGlzIHdyaXR0ZW4gYXMgYW4gZW1wdHkgYXJyYXkgd2l0aCBhIGdlbmVyaWMgZWxlbWVudCB0eXBlXG4gKiByYXRoZXIgdGhhbiBpbmRleGluZyBpbnRvIGFuIGFycmF5IHRoYXQgaGFzIG5vIGBbMF1gLlxuICovXG5hc3luYyBmdW5jdGlvbiBhcHBseUNvbXBvbmVudFJlZmVyZW5jZUFycmF5KFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgdGFyZ2V0Tm9kZVV1aWRzOiBhbnlbXSxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGlmICh0YXJnZXROb2RlVXVpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBbXSwgaXNBcnJheTogdHJ1ZSwgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiBudWxsLCB0eXBlOiAnY2MuQ29tcG9uZW50JyB9IH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBbXTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNvbHZlZFJlZnM6IEFycmF5PHsgdXVpZDogc3RyaW5nIH0+ID0gW107XG4gICAgbGV0IGVsZW1lbnRUeXBlID0gJyc7XG4gICAgZm9yIChjb25zdCB0YXJnZXROb2RlVXVpZCBvZiB0YXJnZXROb2RlVXVpZHMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXROb2RlVXVpZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY29tcG9uZW50QXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgbm9kZSBVVUlEcyAoZWFjaCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KScpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHsgY29tcG9uZW50SWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9ID0gYXdhaXQgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdGFyZ2V0Tm9kZVV1aWQsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcbiAgICAgICAgcmVzb2x2ZWRSZWZzLnB1c2goeyB1dWlkOiBjb21wb25lbnRJZCB9KTtcbiAgICAgICAgZWxlbWVudFR5cGUgPSBlbGVtZW50VHlwZSB8fCBleHBlY3RlZENvbXBvbmVudFR5cGU7XG4gICAgfVxuXG4gICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICBkdW1wOiB7IHZhbHVlOiByZXNvbHZlZFJlZnMsIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogZWxlbWVudFR5cGUgfSB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzb2x2ZWRSZWZzO1xufVxuXG4vKipcbiAqIExvb2sgYSB1dWlkIHVwIGFzIGEgQ09NUE9ORU5UIHJhdGhlciB0aGFuIGEgbm9kZS5cbiAqXG4gKiBgcXVlcnktY29tcG9uZW50YCBhbnN3ZXJzIGZvciBhIGNvbXBvbmVudCdzIG93biB1dWlkIGFuZCByZXR1cm5zIHRoZSBzYW1lIGR1bXAgc2hhcGUgYXNcbiAqIG9uZSBgX19jb21wc19fYCBlbnRyeSwgc28gYHZhbHVlLnV1aWQudmFsdWVgIGFuZCBgdHlwZWAgcmVhZCBleGFjdGx5IGFzIHRoZXkgZG8gb24gdGhlXG4gKiBub2RlIHBhdGguIFJldHVybnMgbnVsbCBmb3IgYW55dGhpbmcgdGhhdCBpcyBub3QgYSBsaXZlIGNvbXBvbmVudCDigJQgaW5jbHVkaW5nIGEgdXVpZFxuICogdGhhdCBuYW1lcyBub3RoaW5nIGF0IGFsbCDigJQgc28gdGhlIGNhbGxlciBjYW4gcmVwb3J0IGJvdGggYWNjZXB0ZWQgc3BlbGxpbmdzLlxuICovXG5hc3luYyBmdW5jdGlvbiBxdWVyeUNvbXBvbmVudEJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHsgdXVpZDogc3RyaW5nOyB0eXBlOiBzdHJpbmcgfSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21wOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQnLCB1dWlkKTtcbiAgICAgICAgaWYgKCFjb21wKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCByZXNvbHZlZFV1aWQgPSBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCB1dWlkO1xuICAgICAgICBjb25zdCB0eXBlID0gY29tcC50eXBlIHx8IGNvbXAuY2lkIHx8IGNvbXAuX190eXBlX18gfHwgJyc7XG4gICAgICAgIHJldHVybiB7IHV1aWQ6IHJlc29sdmVkVXVpZCwgdHlwZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG4iXX0=