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
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue }
        });
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
/** Resolve a component reference UUID to scene __id__ and call set-property. Returns { uuid } object. */
async function applyComponentReference(nodeUuid, propertyPath, componentType, property, targetNodeUuid, getComponentInfo) {
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
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { uuid: direct.uuid }, type: directType }
        });
        return { uuid: direct.uuid };
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
    await Editor.Message.request('scene', 'set-property', {
        uuid: nodeUuid, path: propertyPath,
        dump: { value: { uuid: componentId }, type: expectedComponentType }
    });
    return { uuid: componentId };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUFrQkQsc0RBMkdDO0FBbkpELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7O0dBSUc7QUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQ3ZDLElBQXVCLEVBQ3ZCLGdCQUF3RjtJQUV4RixNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUs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WUFBWTtZQUNsQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7U0FDN0ksQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLE1BQU0sSUFBSSxjQUFjLElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDekYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDbEMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUU7U0FDM0csQ0FBQyxDQUFDO0lBRVAsQ0FBQztTQUFNLElBQUksWUFBWSxLQUFLLE1BQU0sSUFBSSxjQUFjLElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDekYsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVk7WUFDbEMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxN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RSxZQUFZO1FBQ2xDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUU7S0FDdEUsQ0FBQyxDQUFDO0lBRUgsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQztBQUNqQyxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILEtBQUssVUFBVSxvQkFBb0IsQ0FBQyxJQUFZOztJQUM1QyxJQUFJLENBQUM7UUFDRCxNQUFNLElBQUksR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqRixJQUFJLENBQUMsSUFBSTtZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRXZCLE1BQU0sWUFBWSxHQUFHLENBQUEsTUFBQSxNQUFBLElBQUksQ0FBQyxLQUFLLDBDQUFFLElBQUksMENBQUUsS0FBSyxNQUFJLE1BQUEsSUFBSSxDQUFDLElBQUksMENBQUUsS0FBSyxDQUFBLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUM7UUFDdEYsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQzFELE9BQU8sRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3hDLENBQUM7SUFBQyxXQUFNLENBQUM7UUFDTCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogRWRpdG9yIEFQSSBjYWxscyBmb3IgYXBwbHlpbmcgY29tcG9uZW50IHByb3BlcnR5IHZhbHVlcy5cbiAqIEV4dHJhY3RlZCBmcm9tIE1hbmFnZUNvbXBvbmVudC5zZXRDb21wb25lbnRQcm9wZXJ0eSAoU3RlcCA2KS5cbiAqIEVhY2ggcHJvcGVydHkgdHlwZSB1c2VzIGEgZGlmZmVyZW50IGR1bXAgZm9ybWF0IGZvciBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknKS5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTLCBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEUgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5cbi8qKiBQcm9wZXJ0eS1uYW1lIHN1YnN0cmluZ3MgdGhhdCBtYXJrIGEgYmFyZSBgc3RyaW5nYCB2YWx1ZSBhcyBhbiBhc3NldCByZWZlcmVuY2UuICovXG5jb25zdCBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUyA9IFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ107XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgQ29jb3MgYXNzZXQgY2xhc3MgZm9yIHRoZSBFZGl0b3IgYHNldC1wcm9wZXJ0eWAgZHVtcCBgdHlwZWAgZmllbGQuXG4gKlxuICogQW4gZXhwbGljaXQgcHJvcGVydHlUeXBlIChgbWF0ZXJpYWxgLCBgbWVzaGAsIOKApikgd2lucywgYmVjYXVzZSBpdCBpcyBhdXRob3JpdGF0aXZlLlxuICogT25seSB0aGUgZ2VuZXJpYyBgYXNzZXRgIC8gYHN0cmluZ2Agc3BlbGxpbmdzIOKAlCB3aGljaCBjYXJyeSBubyB0eXBlIGluZm9ybWF0aW9uIOKAlCBmYWxsIGJhY2tcbiAqIHRvIHRoZSBwcm9wZXJ0eS1uYW1lIGhldXJpc3RpYywgc28gZXhpc3RpbmcgY2FsbGVycyB1c2luZyB0aG9zZSBrZWVwIHRoZWlyIGV4YWN0IGJlaGF2aW91ci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlc29sdmVBc3NldFR5cGUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IGV4cGxpY2l0ID0gQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFW3Byb3BlcnR5VHlwZV07XG4gICAgaWYgKGV4cGxpY2l0KSByZXR1cm4gZXhwbGljaXQ7XG5cbiAgICBjb25zdCBuYW1lID0gcHJvcGVydHkudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAobmFtZS5pbmNsdWRlcygndGV4dHVyZScpKSByZXR1cm4gJ2NjLlRleHR1cmUyRCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ21hdGVyaWFsJykpIHJldHVybiAnY2MuTWF0ZXJpYWwnO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCdmb250JykpIHJldHVybiAnY2MuRm9udCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ2NsaXAnKSkgcmV0dXJuICdjYy5BdWRpb0NsaXAnO1xuICAgIHJldHVybiAnY2MuU3ByaXRlRnJhbWUnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFwcGx5UHJvcGVydHlBcmdzIHtcbiAgICBub2RlVXVpZDogc3RyaW5nO1xuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nO1xuICAgIHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXI7XG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nO1xuICAgIHByb3BlcnR5OiBzdHJpbmc7XG4gICAgcHJvcGVydHlUeXBlOiBzdHJpbmc7XG4gICAgdmFsdWU6IGFueTtcbiAgICBwcm9jZXNzZWRWYWx1ZTogYW55O1xufVxuXG4vKipcbiAqIEFwcGx5IGEgcHJvY2Vzc2VkIHByb3BlcnR5IHZhbHVlIHRvIHRoZSBDb2NvcyBDcmVhdG9yIGVkaXRvciBzY2VuZS5cbiAqIFJldHVybnMgdGhlIGFjdHVhbCBleHBlY3RlZCB2YWx1ZSAobWF5IGRpZmZlciBmcm9tIHByb2Nlc3NlZFZhbHVlIGZvciBjb21wb25lbnQgcmVmcykuXG4gKiBUaHJvd3Mgb24gdW5yZWNvdmVyYWJsZSBFZGl0b3IgQVBJIGVycm9yLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXBwbHlQcm9wZXJ0eVRvRWRpdG9yKFxuICAgIGFyZ3M6IEFwcGx5UHJvcGVydHlBcmdzLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgeyBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCByYXdDb21wb25lbnRJbmRleCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUsIHByb2Nlc3NlZFZhbHVlIH0gPSBhcmdzO1xuICAgIGxldCBhY3R1YWxFeHBlY3RlZFZhbHVlID0gcHJvY2Vzc2VkVmFsdWU7XG5cbiAgICAvLyBFVkVSWSBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHlUeXBlIG11c3QgbGFuZCBoZXJlLiBGYWxsaW5nIHRocm91Z2ggdG8gdGhlIHRlcm1pbmFsIGBlbHNlYFxuICAgIC8vIHNlbmRzIGEgZHVtcCB3aXRoIG5vIGB0eXBlYCBmaWVsZCDigJQgdGhlIHNhbWUgc2hhcGUgdGhhdCBtYWtlcyB0aGUgbm9kZUFycmF5IHBhdGggZmFpbFxuICAgIC8vIChpc3N1ZSAjMTgpIOKAlCBzbyBhbiBhY2NlcHRlZC1idXQtdHlwZWxlc3MgcHJvcGVydHlUeXBlIHdvdWxkIHNpbGVudGx5IG5vdCBhcHBseS5cbiAgICBpZiAoKEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocHJvcGVydHlUeXBlKSB8fFxuICAgICAgICAocHJvcGVydHlUeXBlID09PSAnc3RyaW5nJyAmJiBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUy5zb21lKGsgPT4gcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrKSkpKSB7XG5cbiAgICAgICAgY29uc3QgYXNzZXRUeXBlID0gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGUsIHByb3BlcnR5KTtcblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUsIHR5cGU6IGFzc2V0VHlwZSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nICYmIChwcm9wZXJ0eSA9PT0gJ19jb250ZW50U2l6ZScgfHwgcHJvcGVydHkgPT09ICdjb250ZW50U2l6ZScpKSB7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gTnVtYmVyKHZhbHVlLndpZHRoKSB8fCAxMDA7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDEwMDtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0ud2lkdGhgLCBkdW1wOiB7IHZhbHVlOiB3aWR0aCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5oZWlnaHRgLCBkdW1wOiB7IHZhbHVlOiBoZWlnaHQgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyAmJiAocHJvcGVydHkgPT09ICdfYW5jaG9yUG9pbnQnIHx8IHByb3BlcnR5ID09PSAnYW5jaG9yUG9pbnQnKSkge1xuICAgICAgICBjb25zdCBhbmNob3JYID0gTnVtYmVyKHZhbHVlLngpIHx8IDAuNTtcbiAgICAgICAgY29uc3QgYW5jaG9yWSA9IE51bWJlcih2YWx1ZS55KSB8fCAwLjU7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvclhgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JYIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvcllgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JZIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yVmFsdWUgPSB7XG4gICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5yKSB8fCAwKSksXG4gICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5nKSB8fCAwKSksXG4gICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5iKSB8fCAwKSksXG4gICAgICAgICAgICBhOiBwcm9jZXNzZWRWYWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5hKSkpIDogMjU1XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yVmFsdWUsIHR5cGU6ICdjYy5Db2xvcicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMycgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAsIHo6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS56KSB8fCAwIH0sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICd2ZWMyJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS54KSB8fCAwLCB5OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueSkgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnc2l6ZScgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB3aWR0aDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLndpZHRoKSB8fCAwLCBoZWlnaHQ6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS5oZWlnaHQpIHx8IDAgfSwgdHlwZTogJ2NjLlNpemUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ25vZGUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIHByb2Nlc3NlZFZhbHVlKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50JyAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBhd2FpdCBhcHBseUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9jZXNzZWRWYWx1ZSwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICAgICApO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlQXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yQXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yQXJyYXlWYWx1ZSA9IHByb2Nlc3NlZFZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ3InIGluIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yQXJyYXlWYWx1ZSwgdHlwZTogJ2NjLkNvbG9yJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCwgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWN0dWFsRXhwZWN0ZWRWYWx1ZTtcbn1cblxuLyoqIFJlc29sdmUgYSBjb21wb25lbnQgcmVmZXJlbmNlIFVVSUQgdG8gc2NlbmUgX19pZF9fIGFuZCBjYWxsIHNldC1wcm9wZXJ0eS4gUmV0dXJucyB7IHV1aWQgfSBvYmplY3QuICovXG5hc3luYyBmdW5jdGlvbiBhcHBseUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zb2xlLmxvZyhgW01hbmFnZUNvbXBvbmVudF0gU2V0dGluZyBjb21wb25lbnQgcmVmZXJlbmNlIC0gZmluZGluZyBjb21wb25lbnQgb24gbm9kZTogJHt0YXJnZXROb2RlVXVpZH1gKTtcblxuICAgIGxldCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSAnJztcbiAgICBjb25zdCBjdXJyZW50Q29tcG9uZW50SW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgIC8vIFdhbGsgZG90dGVkIHByb3BlcnR5IHBhdGhzIHRocm91Z2ggbmVzdGVkIENDQ2xhc3MgZ3JvdXAgZHVtcHMgdG8gZmluZCB0aGUgbWV0YWRhdGEgZGVzY3JpcHRvci5cbiAgICBsZXQgcHJvcGVydHlNZXRhOiBhbnkgPSBjdXJyZW50Q29tcG9uZW50SW5mby5zdWNjZXNzID8gY3VycmVudENvbXBvbmVudEluZm8uZGF0YT8ucHJvcGVydGllcyA6IHVuZGVmaW5lZDtcbiAgICBpZiAocHJvcGVydHlNZXRhKSB7XG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlNZXRhOyBpKyspIHtcbiAgICAgICAgICAgIHByb3BlcnR5TWV0YSA9IHByb3BlcnR5TWV0YVtzZWdtZW50c1tpXV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlNZXRhID0gcHJvcGVydHlNZXRhLnZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIC8vIFRyZWF0ICdVbmtub3duJyBhcyBtaXNzaW5nIOKAlCBpdCBhcHBlYXJzIHdoZW4gYSBwcmV2aW91cyBhc3NpZ25tZW50IHN0b3JlZFxuICAgIC8vIGEgdmFsdWUgd2hvc2UgcnVudGltZSB0eXBlIGRpZG4ndCBtYXRjaCB0aGUgQHByb3BlcnR5IGRlY2xhcmVkIHR5cGUsIGxlYXZpbmdcbiAgICAvLyB0aGUgZHVtcCdzIHR5cGUgZmllbGQgc3RhbGUuXG4gICAgY29uc3QgaXNVc2FibGVUeXBlID0gKHQ6IGFueSkgPT4gdHlwZW9mIHQgPT09ICdzdHJpbmcnICYmIHQubGVuZ3RoID4gMCAmJiB0ICE9PSAnVW5rbm93bic7XG4gICAgaWYgKHByb3BlcnR5TWV0YSkge1xuICAgICAgICBpZiAocHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS50eXBlKSkge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IHByb3BlcnR5TWV0YS50eXBlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChpc1VzYWJsZVR5cGUocHJvcGVydHlNZXRhLmN0b3IpKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gcHJvcGVydHlNZXRhLmN0b3I7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TWV0YS5leHRlbmRzICYmIEFycmF5LmlzQXJyYXkocHJvcGVydHlNZXRhLmV4dGVuZHMpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBleHRlbmRUeXBlIG9mIHByb3BlcnR5TWV0YS5leHRlbmRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChleHRlbmRUeXBlLnN0YXJ0c1dpdGgoJ2NjLicpICYmIGV4dGVuZFR5cGUgIT09ICdjYy5Db21wb25lbnQnICYmIGV4dGVuZFR5cGUgIT09ICdjYy5PYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBleHRlbmRUeXBlO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBgcXVlcnktbm9kZWAgUkVKRUNUUyBvbiBzb21lIGVkaXRvciBidWlsZHMgYW5kIHJlc29sdmVzIGZhbHN5IG9uIG90aGVyczsgYm90aCBtZWFuXG4gICAgLy8gdGhlIHNhbWUgdGhpbmcgaGVyZSDigJQgdGhlIHZhbHVlIGlzIG5vdCBhIG5vZGUgdXVpZC5cbiAgICBsZXQgdGFyZ2V0Tm9kZURhdGE6IGFueSA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgICAgdGFyZ2V0Tm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdGFyZ2V0Tm9kZVV1aWQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICB0YXJnZXROb2RlRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCF0YXJnZXROb2RlRGF0YSB8fCAhdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgIC8vIFRoZSBjYWxsZXIgbWF5IGhhdmUgcGFzc2VkIHRoZSBDT01QT05FTlQncyBvd24gdXVpZCDigJQgdGhlIGB1dWlkYCBmaWVsZCB0aGF0XG4gICAgICAgIC8vIG1hbmFnZV9jb21wb25lbnQgZ2V0X2FsbCAvIGdldF9pbmZvIHJldHVybiwgYW5kIHRoZSBvYnZpb3VzIHRoaW5nIHRvIHJlYWNoIGZvclxuICAgICAgICAvLyB3aGVuIHdpcmluZyBhIEBwcm9wZXJ0eShTb21lQ29tcG9uZW50KSByZWZlcmVuY2UuIEFjY2VwdCB0aGF0IHNwZWxsaW5nIGluc3RlYWRcbiAgICAgICAgLy8gb2YgcmVwb3J0aW5nIGEgY29ycmVjdCB1dWlkIGFzIGEgbWlzc2luZyBub2RlLlxuICAgICAgICBjb25zdCBkaXJlY3QgPSBhd2FpdCBxdWVyeUNvbXBvbmVudEJ5VXVpZCh0YXJnZXROb2RlVXVpZCk7XG4gICAgICAgIGlmICghZGlyZWN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCcke3RhcmdldE5vZGVVdWlkfScgaXMgbmVpdGhlciBhIG5vZGUgdXVpZCBub3IgYSBjb21wb25lbnQgdXVpZC4gYCArXG4gICAgICAgICAgICAgICAgYFBhc3MgdGhlIHV1aWQgb2YgdGhlIE5PREUgdGhhdCBob2xkcyB0aGUgY29tcG9uZW50LCBvciB0aGUgY29tcG9uZW50J3Mgb3duIGAgK1xuICAgICAgICAgICAgICAgIGB1dWlkIGZyb20gbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249Z2V0X2FsbC5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZGlyZWN0VHlwZSA9IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB8fCBkaXJlY3QudHlwZTtcbiAgICAgICAgaWYgKCFkaXJlY3RUeXBlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgcmVxdWlyZWQgY29tcG9uZW50IHR5cGUgZm9yIHByb3BlcnR5ICcke3Byb3BlcnR5fScgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gUHJvcGVydHkgbWV0YWRhdGEgbWF5IG5vdCBjb250YWluIHR5cGUgaW5mb3JtYXRpb24uYCk7XG4gICAgICAgIH1cblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB1dWlkOiBkaXJlY3QudXVpZCB9LCB0eXBlOiBkaXJlY3RUeXBlIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7IHV1aWQ6IGRpcmVjdC51dWlkIH07XG4gICAgfVxuXG4gICAgLy8gU2luZ2xlLWNjLWNvbXBvbmVudCBmYWxsYmFjazogd2hlbiBleHBlY3RlZENvbXBvbmVudFR5cGUgY291bGQgbm90IGJlIGluZmVycmVkXG4gICAgLy8gKGUuZy4sIHN0YWxlICdVbmtub3duJyBpbiBkdW1wIGFuZCBleHRlbmRzIG9ubHkgbGlzdHMgY2MuQ29tcG9uZW50L2NjLk9iamVjdCksXG4gICAgLy8gYW5kIHRoZSB0YXJnZXQgbm9kZSBoYXMgZXhhY3RseSBvbmUgY2MuKiBjb21wb25lbnQsIHVzZSBpdC4gTWlycm9ycyBDb2NvcydzXG4gICAgLy8gZHJhZy1mcm9tLWhpZXJhcmNoeSBhdXRvLXJlc29sdmUgYmVoYXZpb3IuXG4gICAgaWYgKCFleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgY2NDb21wcyA9ICh0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18gYXMgYW55W10pXG4gICAgICAgICAgICAuZmlsdGVyKGMgPT4gdHlwZW9mIGMudHlwZSA9PT0gJ3N0cmluZycgJiYgYy50eXBlLnN0YXJ0c1dpdGgoJ2NjLicpXG4gICAgICAgICAgICAgICAgJiYgYy50eXBlICE9PSAnY2MuQ29tcG9uZW50JyAmJiBjLnR5cGUgIT09ICdjYy5PYmplY3QnKTtcbiAgICAgICAgaWYgKGNjQ29tcHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBjY0NvbXBzWzBdLnR5cGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgcmVxdWlyZWQgY29tcG9uZW50IHR5cGUgZm9yIHByb3BlcnR5ICcke3Byb3BlcnR5fScgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gUHJvcGVydHkgbWV0YWRhdGEgbWF5IG5vdCBjb250YWluIHR5cGUgaW5mb3JtYXRpb24uYCk7XG4gICAgfVxuXG4gICAgbGV0IGNvbXBvbmVudElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgZm91bmRDb21wb25lbnQgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNvbXAgPSB0YXJnZXROb2RlRGF0YS5fX2NvbXBzX19baV0gYXMgYW55O1xuICAgICAgICBpZiAoY29tcC50eXBlID09PSBleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIGZvdW5kQ29tcG9uZW50ID0gY29tcDtcbiAgICAgICAgICAgIGlmIChjb21wLnZhbHVlICYmIGNvbXAudmFsdWUudXVpZCAmJiBjb21wLnZhbHVlLnV1aWQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRJZCA9IGNvbXAudmFsdWUudXVpZC52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZXh0cmFjdCBjb21wb25lbnQgSUQgZnJvbSBjb21wb25lbnQgc3RydWN0dXJlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZm91bmRDb21wb25lbnQpIHtcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlID0gdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY2VuZUlkID0gY29tcC52YWx1ZSAmJiBjb21wLnZhbHVlLnV1aWQgJiYgY29tcC52YWx1ZS51dWlkLnZhbHVlID8gY29tcC52YWx1ZS51dWlkLnZhbHVlIDogJ3Vua25vd24nO1xuICAgICAgICAgICAgcmV0dXJuIGAke2NvbXAudHlwZX0oc2NlbmVfaWQ6JHtzY2VuZUlkfSlgO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgdHlwZSAnJHtleHBlY3RlZENvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZSAke3RhcmdldE5vZGVVdWlkfS4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHV1aWQ6IGNvbXBvbmVudElkIH0sIHR5cGU6IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyB1dWlkOiBjb21wb25lbnRJZCB9O1xufVxuXG4vKipcbiAqIExvb2sgYSB1dWlkIHVwIGFzIGEgQ09NUE9ORU5UIHJhdGhlciB0aGFuIGEgbm9kZS5cbiAqXG4gKiBgcXVlcnktY29tcG9uZW50YCBhbnN3ZXJzIGZvciBhIGNvbXBvbmVudCdzIG93biB1dWlkIGFuZCByZXR1cm5zIHRoZSBzYW1lIGR1bXAgc2hhcGUgYXNcbiAqIG9uZSBgX19jb21wc19fYCBlbnRyeSwgc28gYHZhbHVlLnV1aWQudmFsdWVgIGFuZCBgdHlwZWAgcmVhZCBleGFjdGx5IGFzIHRoZXkgZG8gb24gdGhlXG4gKiBub2RlIHBhdGguIFJldHVybnMgbnVsbCBmb3IgYW55dGhpbmcgdGhhdCBpcyBub3QgYSBsaXZlIGNvbXBvbmVudCDigJQgaW5jbHVkaW5nIGEgdXVpZFxuICogdGhhdCBuYW1lcyBub3RoaW5nIGF0IGFsbCDigJQgc28gdGhlIGNhbGxlciBjYW4gcmVwb3J0IGJvdGggYWNjZXB0ZWQgc3BlbGxpbmdzLlxuICovXG5hc3luYyBmdW5jdGlvbiBxdWVyeUNvbXBvbmVudEJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHsgdXVpZDogc3RyaW5nOyB0eXBlOiBzdHJpbmcgfSB8IG51bGw+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21wOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQnLCB1dWlkKTtcbiAgICAgICAgaWYgKCFjb21wKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCByZXNvbHZlZFV1aWQgPSBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCB1dWlkO1xuICAgICAgICBjb25zdCB0eXBlID0gY29tcC50eXBlIHx8IGNvbXAuY2lkIHx8IGNvbXAuX190eXBlX18gfHwgJyc7XG4gICAgICAgIHJldHVybiB7IHV1aWQ6IHJlc29sdmVkVXVpZCwgdHlwZSB9O1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG4iXX0=