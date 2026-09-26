"use strict";
/**
 * Editor API calls for applying component property values.
 * Extracted from ManageComponent.setComponentProperty (Step 6).
 * Each property type uses a different dump format for Editor.Message.request('scene', 'set-property').
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAssetType = resolveAssetType;
exports.describeUnhandledPropertyType = describeUnhandledPropertyType;
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
 * Resolve one numeric component of a compound value (vec2/size) for the editor dump.
 *
 * `Number(v) || fallback` treats an explicit, entirely legal `0` exactly like
 * `undefined`/`NaN` and substitutes the type default instead of the caller's value —
 * issue #114's defect 1, where `anchorPoint {x: 0, y: 0.5094}` came back
 * `{x: 0.5, y: 0.5094}`. The originating report pinned it with a `{x: 0.0001}`
 * control that verified fine, which rules out an editor-side clamp.
 *
 * Only genuinely ABSENT input falls back: `undefined`, `null`, an empty string, and a
 * non-numeric value. A number is always returned as-is, `0` included. The fallback is a
 * parameter because the callers below disagree on it (0.5 for an anchor, 100 for a
 * content size), so a helper assuming one would be wrong for the other.
 */
function numberComponent(value, fallback) {
    if (value === undefined || value === null || value === '')
        return fallback;
    const num = Number(value);
    return Number.isNaN(num) ? fallback : num;
}
/**
 * Every propertyType the branches below actually handle, in one place.
 *
 * Built by composition so a new asset-reference propertyType (added to
 * `ASSET_REFERENCE_PROPERTY_TYPES`) is covered automatically rather than having to be
 * remembered here — the duplication this list would otherwise introduce is exactly how
 * an accepted-but-unhandled type slips through unnoticed (issue #66).
 */
const HANDLED_SCALAR_TYPES = new Set([
    // The asset-reference branch is gated on ASSET_REFERENCE_PROPERTY_TYPES plus the
    // generic `asset` spelling; `string` is deliberately included because it is the
    // branch's explicit escape for a plain-string property (issue #46).
    ...manage_component_property_helpers_1.ASSET_REFERENCE_PROPERTY_TYPES, 'asset', 'string',
    // The typed math/shape branches, plus the reference types that own a branch of their own.
    'color', 'vec3', 'vec2', 'size', 'node', 'component',
    // The terminal `else` is the correct home for a plain scalar dump — it writes
    // `{ value }` with no `type`, which is exactly what a number/boolean needs. `integer`
    // and `float` are spelled as `number` aliases by `convertPropertyValue` and take the
    // same path, so they belong here too; refusing them would break working calls.
    'number', 'integer', 'float', 'boolean'
]);
const HANDLED_ARRAY_TYPES = new Set([
    'nodeArray', 'assetArray', 'componentArray', 'colorArray',
    // These two ARE advertised and DO work: their conversion rejects a non-array and
    // flattens primitives, and the terminal `else` writes the resulting plain array
    // correctly. They are named here so the guard below cannot refuse a supported
    // propertyType — a regression this guard narrowly avoided, since refusing them would
    // have broken calls that succeed today (issue #66's own report lists scalar and array
    // writes on the same components as working).
    'numberArray', 'stringArray'
]);
/**
 * Explain why this propertyType cannot be applied, or return `null` when a branch owns it.
 *
 * The message is split by CAUSE, because the remedy differs: an array shape has a supported
 * propertyType the caller should be using instead, while a gap in the scalar list is a bug
 * in this file's branch set. A single "unsupported" message for both would send the caller
 * hunting for the wrong fix.
 */
function describeUnhandledPropertyType(propertyType, processedValue) {
    if (HANDLED_SCALAR_TYPES.has(propertyType) || HANDLED_ARRAY_TYPES.has(propertyType))
        return null;
    if (Array.isArray(processedValue)) {
        return (`propertyType '${propertyType}' is an ARRAY value, but no array branch handles it — so the ` +
            `set-property dump would carry no 'type' field, the editor would decode nothing, and this ` +
            `call would report a write it did not perform (issue #66). An array of assets/uuids/colors ` +
            `wants propertyType 'assetArray', 'nodeArray', 'componentArray' or 'colorArray'; an array of ` +
            `plain value objects with NO uuid semantics (cc.RealCurve keyFrames, cc.Gradient alphaKeys) ` +
            `has no supported propertyType yet. Nothing was written.`);
    }
    return (`propertyType '${propertyType}' is not handled by applyPropertyToEditor, so the set-property ` +
        `dump would carry no 'type' field and the write would silently not apply (issue #66). ` +
        `Nothing was written.`);
}
/**
 * Apply a processed property value to the Cocos Creator editor scene.
 * Returns the actual expected value (may differ from processedValue for component refs).
 * Throws on unrecoverable Editor API error.
 */
async function applyPropertyToEditor(args, getComponentInfo) {
    const { nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue } = args;
    let actualExpectedValue = processedValue;
    // A propertyType `convertPropertyValue` accepted but no branch below applies must not
    // fall through to the terminal `else`: there it produces a dump with no `type`, the
    // editor decodes nothing, and the caller is told the write succeeded (issue #66).
    const unhandledWarning = describeUnhandledPropertyType(propertyType, processedValue);
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
        const width = numberComponent(value.width, 100);
        const height = numberComponent(value.height, 100);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.width`, dump: { value: width }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.height`, dump: { value: height }
        });
    }
    else if (componentType === 'cc.UITransform' && (property === '_anchorPoint' || property === 'anchorPoint')) {
        const anchorX = numberComponent(value.x, 0.5);
        const anchorY = numberComponent(value.y, 0.5);
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
    else if (unhandledWarning) {
        // Issue #66: the propertyType is in SUPPORTED_PROPERTY_TYPES, so `convertPropertyValue`
        // accepted it, but NO branch above handles it — so the dump would go out with no `type`,
        // the editor decodes nothing, and the write is a silent no-op. `changeVerified` reading
        // false is not a rescue: a caller that trusts a `success:true` response ships an
        // unauthored value, which is exactly how a `cc.RealCurve` spline came back as the
        // untouched 2-point default (issue #66). Refuse the write instead of performing one
        // that cannot work, and name where the array-of-object cases belong.
        throw new Error(unhandledWarning);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUEwRUQsc0VBbUJDO0FBT0Qsc0RBcUtDO0FBL1JELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7Ozs7Ozs7Ozs7O0dBYUc7QUFDSCxTQUFTLGVBQWUsQ0FBQyxLQUFVLEVBQUUsUUFBZ0I7SUFDakQsSUFBSSxLQUFLLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxJQUFJLElB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QztRQUV2QixNQUFNLFlBQVksR0FBRyxDQUFBLE1BQUEsTUFBQSxJQUFJLENBQUMsS0FBSywwQ0FBRSxJQUFJLDBDQUFFLEtBQUssTUFBSSxNQUFBLElBQUksQ0FBQyxJQUFJLDBDQUFFLEtBQUssQ0FBQSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDO1FBQ3RGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQztRQUMxRCxPQUFPLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUN4QyxDQUFDO0lBQUMsV0FBTSxDQUFDO1FBQ0wsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEVkaXRvciBBUEkgY2FsbHMgZm9yIGFwcGx5aW5nIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQuc2V0Q29tcG9uZW50UHJvcGVydHkgKFN0ZXAgNikuXG4gKiBFYWNoIHByb3BlcnR5IHR5cGUgdXNlcyBhIGRpZmZlcmVudCBkdW1wIGZvcm1hdCBmb3IgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5JykuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUywgQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuXG4vKiogUHJvcGVydHktbmFtZSBzdWJzdHJpbmdzIHRoYXQgbWFyayBhIGJhcmUgYHN0cmluZ2AgdmFsdWUgYXMgYW4gYXNzZXQgcmVmZXJlbmNlLiAqL1xuY29uc3QgTkFNRV9ISU5URURfQVNTRVRfS0VZV09SRFMgPSBbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddO1xuXG4vKipcbiAqIFJlc29sdmUgdGhlIENvY29zIGFzc2V0IGNsYXNzIGZvciB0aGUgRWRpdG9yIGBzZXQtcHJvcGVydHlgIGR1bXAgYHR5cGVgIGZpZWxkLlxuICpcbiAqIEFuIGV4cGxpY2l0IHByb3BlcnR5VHlwZSAoYG1hdGVyaWFsYCwgYG1lc2hgLCDigKYpIHdpbnMsIGJlY2F1c2UgaXQgaXMgYXV0aG9yaXRhdGl2ZS5cbiAqIE9ubHkgdGhlIGdlbmVyaWMgYGFzc2V0YCAvIGBzdHJpbmdgIHNwZWxsaW5ncyDigJQgd2hpY2ggY2Fycnkgbm8gdHlwZSBpbmZvcm1hdGlvbiDigJQgZmFsbCBiYWNrXG4gKiB0byB0aGUgcHJvcGVydHktbmFtZSBoZXVyaXN0aWMsIHNvIGV4aXN0aW5nIGNhbGxlcnMgdXNpbmcgdGhvc2Uga2VlcCB0aGVpciBleGFjdCBiZWhhdmlvdXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlQXNzZXRUeXBlKHByb3BlcnR5VHlwZTogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBleHBsaWNpdCA9IEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRVtwcm9wZXJ0eVR5cGVdO1xuICAgIGlmIChleHBsaWNpdCkgcmV0dXJuIGV4cGxpY2l0O1xuXG4gICAgY29uc3QgbmFtZSA9IHByb3BlcnR5LnRvTG93ZXJDYXNlKCk7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ3RleHR1cmUnKSkgcmV0dXJuICdjYy5UZXh0dXJlMkQnO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCdtYXRlcmlhbCcpKSByZXR1cm4gJ2NjLk1hdGVyaWFsJztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnZm9udCcpKSByZXR1cm4gJ2NjLkZvbnQnO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCdjbGlwJykpIHJldHVybiAnY2MuQXVkaW9DbGlwJztcbiAgICByZXR1cm4gJ2NjLlNwcml0ZUZyYW1lJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBcHBseVByb3BlcnR5QXJncyB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZztcbiAgICBwcm9wZXJ0eVBhdGg6IHN0cmluZztcbiAgICByYXdDb21wb25lbnRJbmRleDogbnVtYmVyO1xuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZztcbiAgICBwcm9wZXJ0eTogc3RyaW5nO1xuICAgIHByb3BlcnR5VHlwZTogc3RyaW5nO1xuICAgIHZhbHVlOiBhbnk7XG4gICAgcHJvY2Vzc2VkVmFsdWU6IGFueTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIG9uZSBudW1lcmljIGNvbXBvbmVudCBvZiBhIGNvbXBvdW5kIHZhbHVlICh2ZWMyL3NpemUpIGZvciB0aGUgZWRpdG9yIGR1bXAuXG4gKlxuICogYE51bWJlcih2KSB8fCBmYWxsYmFja2AgdHJlYXRzIGFuIGV4cGxpY2l0LCBlbnRpcmVseSBsZWdhbCBgMGAgZXhhY3RseSBsaWtlXG4gKiBgdW5kZWZpbmVkYC9gTmFOYCBhbmQgc3Vic3RpdHV0ZXMgdGhlIHR5cGUgZGVmYXVsdCBpbnN0ZWFkIG9mIHRoZSBjYWxsZXIncyB2YWx1ZSDigJRcbiAqIGlzc3VlICMxMTQncyBkZWZlY3QgMSwgd2hlcmUgYGFuY2hvclBvaW50IHt4OiAwLCB5OiAwLjUwOTR9YCBjYW1lIGJhY2tcbiAqIGB7eDogMC41LCB5OiAwLjUwOTR9YC4gVGhlIG9yaWdpbmF0aW5nIHJlcG9ydCBwaW5uZWQgaXQgd2l0aCBhIGB7eDogMC4wMDAxfWBcbiAqIGNvbnRyb2wgdGhhdCB2ZXJpZmllZCBmaW5lLCB3aGljaCBydWxlcyBvdXQgYW4gZWRpdG9yLXNpZGUgY2xhbXAuXG4gKlxuICogT25seSBnZW51aW5lbHkgQUJTRU5UIGlucHV0IGZhbGxzIGJhY2s6IGB1bmRlZmluZWRgLCBgbnVsbGAsIGFuIGVtcHR5IHN0cmluZywgYW5kIGFcbiAqIG5vbi1udW1lcmljIHZhbHVlLiBBIG51bWJlciBpcyBhbHdheXMgcmV0dXJuZWQgYXMtaXMsIGAwYCBpbmNsdWRlZC4gVGhlIGZhbGxiYWNrIGlzIGFcbiAqIHBhcmFtZXRlciBiZWNhdXNlIHRoZSBjYWxsZXJzIGJlbG93IGRpc2FncmVlIG9uIGl0ICgwLjUgZm9yIGFuIGFuY2hvciwgMTAwIGZvciBhXG4gKiBjb250ZW50IHNpemUpLCBzbyBhIGhlbHBlciBhc3N1bWluZyBvbmUgd291bGQgYmUgd3JvbmcgZm9yIHRoZSBvdGhlci5cbiAqL1xuZnVuY3Rpb24gbnVtYmVyQ29tcG9uZW50KHZhbHVlOiBhbnksIGZhbGxiYWNrOiBudW1iZXIpOiBudW1iZXIge1xuICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSAnJykgcmV0dXJuIGZhbGxiYWNrO1xuICAgIGNvbnN0IG51bSA9IE51bWJlcih2YWx1ZSk7XG4gICAgcmV0dXJuIE51bWJlci5pc05hTihudW0pID8gZmFsbGJhY2sgOiBudW07XG59XG5cbi8qKlxuICogRXZlcnkgcHJvcGVydHlUeXBlIHRoZSBicmFuY2hlcyBiZWxvdyBhY3R1YWxseSBoYW5kbGUsIGluIG9uZSBwbGFjZS5cbiAqXG4gKiBCdWlsdCBieSBjb21wb3NpdGlvbiBzbyBhIG5ldyBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHlUeXBlIChhZGRlZCB0b1xuICogYEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFU2ApIGlzIGNvdmVyZWQgYXV0b21hdGljYWxseSByYXRoZXIgdGhhbiBoYXZpbmcgdG8gYmVcbiAqIHJlbWVtYmVyZWQgaGVyZSDigJQgdGhlIGR1cGxpY2F0aW9uIHRoaXMgbGlzdCB3b3VsZCBvdGhlcndpc2UgaW50cm9kdWNlIGlzIGV4YWN0bHkgaG93XG4gKiBhbiBhY2NlcHRlZC1idXQtdW5oYW5kbGVkIHR5cGUgc2xpcHMgdGhyb3VnaCB1bm5vdGljZWQgKGlzc3VlICM2NikuXG4gKi9cbmNvbnN0IEhBTkRMRURfU0NBTEFSX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAvLyBUaGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCBpcyBnYXRlZCBvbiBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgcGx1cyB0aGVcbiAgICAvLyBnZW5lcmljIGBhc3NldGAgc3BlbGxpbmc7IGBzdHJpbmdgIGlzIGRlbGliZXJhdGVseSBpbmNsdWRlZCBiZWNhdXNlIGl0IGlzIHRoZVxuICAgIC8vIGJyYW5jaCdzIGV4cGxpY2l0IGVzY2FwZSBmb3IgYSBwbGFpbi1zdHJpbmcgcHJvcGVydHkgKGlzc3VlICM0NikuXG4gICAgLi4uQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTLCAnYXNzZXQnLCAnc3RyaW5nJyxcbiAgICAvLyBUaGUgdHlwZWQgbWF0aC9zaGFwZSBicmFuY2hlcywgcGx1cyB0aGUgcmVmZXJlbmNlIHR5cGVzIHRoYXQgb3duIGEgYnJhbmNoIG9mIHRoZWlyIG93bi5cbiAgICAnY29sb3InLCAndmVjMycsICd2ZWMyJywgJ3NpemUnLCAnbm9kZScsICdjb21wb25lbnQnLFxuICAgIC8vIFRoZSB0ZXJtaW5hbCBgZWxzZWAgaXMgdGhlIGNvcnJlY3QgaG9tZSBmb3IgYSBwbGFpbiBzY2FsYXIgZHVtcCDigJQgaXQgd3JpdGVzXG4gICAgLy8gYHsgdmFsdWUgfWAgd2l0aCBubyBgdHlwZWAsIHdoaWNoIGlzIGV4YWN0bHkgd2hhdCBhIG51bWJlci9ib29sZWFuIG5lZWRzLiBgaW50ZWdlcmBcbiAgICAvLyBhbmQgYGZsb2F0YCBhcmUgc3BlbGxlZCBhcyBgbnVtYmVyYCBhbGlhc2VzIGJ5IGBjb252ZXJ0UHJvcGVydHlWYWx1ZWAgYW5kIHRha2UgdGhlXG4gICAgLy8gc2FtZSBwYXRoLCBzbyB0aGV5IGJlbG9uZyBoZXJlIHRvbzsgcmVmdXNpbmcgdGhlbSB3b3VsZCBicmVhayB3b3JraW5nIGNhbGxzLlxuICAgICdudW1iZXInLCAnaW50ZWdlcicsICdmbG9hdCcsICdib29sZWFuJ1xuXSk7XG5cbmNvbnN0IEhBTkRMRURfQVJSQVlfVFlQRVMgPSBuZXcgU2V0PHN0cmluZz4oW1xuICAgICdub2RlQXJyYXknLCAnYXNzZXRBcnJheScsICdjb21wb25lbnRBcnJheScsICdjb2xvckFycmF5JyxcbiAgICAvLyBUaGVzZSB0d28gQVJFIGFkdmVydGlzZWQgYW5kIERPIHdvcms6IHRoZWlyIGNvbnZlcnNpb24gcmVqZWN0cyBhIG5vbi1hcnJheSBhbmRcbiAgICAvLyBmbGF0dGVucyBwcmltaXRpdmVzLCBhbmQgdGhlIHRlcm1pbmFsIGBlbHNlYCB3cml0ZXMgdGhlIHJlc3VsdGluZyBwbGFpbiBhcnJheVxuICAgIC8vIGNvcnJlY3RseS4gVGhleSBhcmUgbmFtZWQgaGVyZSBzbyB0aGUgZ3VhcmQgYmVsb3cgY2Fubm90IHJlZnVzZSBhIHN1cHBvcnRlZFxuICAgIC8vIHByb3BlcnR5VHlwZSDigJQgYSByZWdyZXNzaW9uIHRoaXMgZ3VhcmQgbmFycm93bHkgYXZvaWRlZCwgc2luY2UgcmVmdXNpbmcgdGhlbSB3b3VsZFxuICAgIC8vIGhhdmUgYnJva2VuIGNhbGxzIHRoYXQgc3VjY2VlZCB0b2RheSAoaXNzdWUgIzY2J3Mgb3duIHJlcG9ydCBsaXN0cyBzY2FsYXIgYW5kIGFycmF5XG4gICAgLy8gd3JpdGVzIG9uIHRoZSBzYW1lIGNvbXBvbmVudHMgYXMgd29ya2luZykuXG4gICAgJ251bWJlckFycmF5JywgJ3N0cmluZ0FycmF5J1xuXSk7XG5cbi8qKlxuICogRXhwbGFpbiB3aHkgdGhpcyBwcm9wZXJ0eVR5cGUgY2Fubm90IGJlIGFwcGxpZWQsIG9yIHJldHVybiBgbnVsbGAgd2hlbiBhIGJyYW5jaCBvd25zIGl0LlxuICpcbiAqIFRoZSBtZXNzYWdlIGlzIHNwbGl0IGJ5IENBVVNFLCBiZWNhdXNlIHRoZSByZW1lZHkgZGlmZmVyczogYW4gYXJyYXkgc2hhcGUgaGFzIGEgc3VwcG9ydGVkXG4gKiBwcm9wZXJ0eVR5cGUgdGhlIGNhbGxlciBzaG91bGQgYmUgdXNpbmcgaW5zdGVhZCwgd2hpbGUgYSBnYXAgaW4gdGhlIHNjYWxhciBsaXN0IGlzIGEgYnVnXG4gKiBpbiB0aGlzIGZpbGUncyBicmFuY2ggc2V0LiBBIHNpbmdsZSBcInVuc3VwcG9ydGVkXCIgbWVzc2FnZSBmb3IgYm90aCB3b3VsZCBzZW5kIHRoZSBjYWxsZXJcbiAqIGh1bnRpbmcgZm9yIHRoZSB3cm9uZyBmaXguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXNjcmliZVVuaGFuZGxlZFByb3BlcnR5VHlwZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgcHJvY2Vzc2VkVmFsdWU6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmIChIQU5ETEVEX1NDQUxBUl9UWVBFUy5oYXMocHJvcGVydHlUeXBlKSB8fCBIQU5ETEVEX0FSUkFZX1RZUEVTLmhhcyhwcm9wZXJ0eVR5cGUpKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgYHByb3BlcnR5VHlwZSAnJHtwcm9wZXJ0eVR5cGV9JyBpcyBhbiBBUlJBWSB2YWx1ZSwgYnV0IG5vIGFycmF5IGJyYW5jaCBoYW5kbGVzIGl0IOKAlCBzbyB0aGUgYCArXG4gICAgICAgICAgICBgc2V0LXByb3BlcnR5IGR1bXAgd291bGQgY2Fycnkgbm8gJ3R5cGUnIGZpZWxkLCB0aGUgZWRpdG9yIHdvdWxkIGRlY29kZSBub3RoaW5nLCBhbmQgdGhpcyBgICtcbiAgICAgICAgICAgIGBjYWxsIHdvdWxkIHJlcG9ydCBhIHdyaXRlIGl0IGRpZCBub3QgcGVyZm9ybSAoaXNzdWUgIzY2KS4gQW4gYXJyYXkgb2YgYXNzZXRzL3V1aWRzL2NvbG9ycyBgICtcbiAgICAgICAgICAgIGB3YW50cyBwcm9wZXJ0eVR5cGUgJ2Fzc2V0QXJyYXknLCAnbm9kZUFycmF5JywgJ2NvbXBvbmVudEFycmF5JyBvciAnY29sb3JBcnJheSc7IGFuIGFycmF5IG9mIGAgK1xuICAgICAgICAgICAgYHBsYWluIHZhbHVlIG9iamVjdHMgd2l0aCBOTyB1dWlkIHNlbWFudGljcyAoY2MuUmVhbEN1cnZlIGtleUZyYW1lcywgY2MuR3JhZGllbnQgYWxwaGFLZXlzKSBgICtcbiAgICAgICAgICAgIGBoYXMgbm8gc3VwcG9ydGVkIHByb3BlcnR5VHlwZSB5ZXQuIE5vdGhpbmcgd2FzIHdyaXR0ZW4uYFxuICAgICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICAgIGBwcm9wZXJ0eVR5cGUgJyR7cHJvcGVydHlUeXBlfScgaXMgbm90IGhhbmRsZWQgYnkgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yLCBzbyB0aGUgc2V0LXByb3BlcnR5IGAgK1xuICAgICAgICBgZHVtcCB3b3VsZCBjYXJyeSBubyAndHlwZScgZmllbGQgYW5kIHRoZSB3cml0ZSB3b3VsZCBzaWxlbnRseSBub3QgYXBwbHkgKGlzc3VlICM2NikuIGAgK1xuICAgICAgICBgTm90aGluZyB3YXMgd3JpdHRlbi5gXG4gICAgKTtcbn1cblxuLyoqXG4gKiBBcHBseSBhIHByb2Nlc3NlZCBwcm9wZXJ0eSB2YWx1ZSB0byB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3Igc2NlbmUuXG4gKiBSZXR1cm5zIHRoZSBhY3R1YWwgZXhwZWN0ZWQgdmFsdWUgKG1heSBkaWZmZXIgZnJvbSBwcm9jZXNzZWRWYWx1ZSBmb3IgY29tcG9uZW50IHJlZnMpLlxuICogVGhyb3dzIG9uIHVucmVjb3ZlcmFibGUgRWRpdG9yIEFQSSBlcnJvci5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJvcGVydHlUb0VkaXRvcihcbiAgICBhcmdzOiBBcHBseVByb3BlcnR5QXJncyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHsgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgcmF3Q29tcG9uZW50SW5kZXgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlLCBwcm9jZXNzZWRWYWx1ZSB9ID0gYXJncztcbiAgICBsZXQgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IHByb2Nlc3NlZFZhbHVlO1xuXG4gICAgLy8gQSBwcm9wZXJ0eVR5cGUgYGNvbnZlcnRQcm9wZXJ0eVZhbHVlYCBhY2NlcHRlZCBidXQgbm8gYnJhbmNoIGJlbG93IGFwcGxpZXMgbXVzdCBub3RcbiAgICAvLyBmYWxsIHRocm91Z2ggdG8gdGhlIHRlcm1pbmFsIGBlbHNlYDogdGhlcmUgaXQgcHJvZHVjZXMgYSBkdW1wIHdpdGggbm8gYHR5cGVgLCB0aGVcbiAgICAvLyBlZGl0b3IgZGVjb2RlcyBub3RoaW5nLCBhbmQgdGhlIGNhbGxlciBpcyB0b2xkIHRoZSB3cml0ZSBzdWNjZWVkZWQgKGlzc3VlICM2NikuXG4gICAgY29uc3QgdW5oYW5kbGVkV2FybmluZyA9IGRlc2NyaWJlVW5oYW5kbGVkUHJvcGVydHlUeXBlKHByb3BlcnR5VHlwZSwgcHJvY2Vzc2VkVmFsdWUpO1xuXG4gICAgLy8gRVZFUlkgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5VHlwZSBtdXN0IGxhbmQgaGVyZS4gRmFsbGluZyB0aHJvdWdoIHRvIHRoZSB0ZXJtaW5hbCBgZWxzZWBcbiAgICAvLyBzZW5kcyBhIGR1bXAgd2l0aCBubyBgdHlwZWAgZmllbGQg4oCUIHRoZSBzYW1lIHNoYXBlIHRoYXQgbWFrZXMgdGhlIG5vZGVBcnJheSBwYXRoIGZhaWxcbiAgICAvLyAoaXNzdWUgIzE4KSDigJQgc28gYW4gYWNjZXB0ZWQtYnV0LXR5cGVsZXNzIHByb3BlcnR5VHlwZSB3b3VsZCBzaWxlbnRseSBub3QgYXBwbHkuXG4gICAgLy8gQW4gZXhwbGljaXQgYHByb3BlcnR5VHlwZTogJ3N0cmluZydgIGlzIGF1dGhvcml0YXRpdmUg4oCUIGEgcHJvcGVydHktbmFtZSBzdWJzdHJpbmdcbiAgICAvLyBtdXN0IG5ldmVyIHJlLXJvdXRlIGl0IHRvIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIChpc3N1ZSAjNDY6IGBmaXJlQ2xpcE5hbWVgIHdhc1xuICAgIC8vIGNvZXJjZWQgdG8gYGNjLkF1ZGlvQ2xpcGAsIG51bGxpbmcgdGhlIGZpZWxkIGFuZCBkcm9wcGluZyBpdCBmcm9tIHRoZSBjb21wb25lbnQgZHVtcCkuXG4gICAgLy8gVGhlIG5hbWUtaGludCBoZXVyaXN0aWMgYXBwbGllcyBPTkxZIHRvIHRoZSBnZW5lcmljIGBhc3NldGAgc3BlbGxpbmcsIHdoaWNoIGNhcnJpZXNcbiAgICAvLyBubyB0eXBlIGluZm9ybWF0aW9uIG9mIGl0cyBvd24uXG4gICAgaWYgKChBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHByb3BlcnR5VHlwZSkgfHxcbiAgICAgICAgKHByb3BlcnR5VHlwZSA9PT0gJ2Fzc2V0JyAmJiBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUy5zb21lKGsgPT4gcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrKSkpKSB7XG5cbiAgICAgICAgY29uc3QgYXNzZXRUeXBlID0gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGUsIHByb3BlcnR5KTtcblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUsIHR5cGU6IGFzc2V0VHlwZSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nICYmIChwcm9wZXJ0eSA9PT0gJ19jb250ZW50U2l6ZScgfHwgcHJvcGVydHkgPT09ICdjb250ZW50U2l6ZScpKSB7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gbnVtYmVyQ29tcG9uZW50KHZhbHVlLndpZHRoLCAxMDApO1xuICAgICAgICBjb25zdCBoZWlnaHQgPSBudW1iZXJDb21wb25lbnQodmFsdWUuaGVpZ2h0LCAxMDApO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS53aWR0aGAsIGR1bXA6IHsgdmFsdWU6IHdpZHRoIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmhlaWdodGAsIGR1bXA6IHsgdmFsdWU6IGhlaWdodCB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nICYmIChwcm9wZXJ0eSA9PT0gJ19hbmNob3JQb2ludCcgfHwgcHJvcGVydHkgPT09ICdhbmNob3JQb2ludCcpKSB7XG4gICAgICAgIGNvbnN0IGFuY2hvclggPSBudW1iZXJDb21wb25lbnQodmFsdWUueCwgMC41KTtcbiAgICAgICAgY29uc3QgYW5jaG9yWSA9IG51bWJlckNvbXBvbmVudCh2YWx1ZS55LCAwLjUpO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5hbmNob3JYYCwgZHVtcDogeyB2YWx1ZTogYW5jaG9yWCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5hbmNob3JZYCwgZHVtcDogeyB2YWx1ZTogYW5jaG9yWSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb2xvcicgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCBjb2xvclZhbHVlID0ge1xuICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUucikgfHwgMCkpLFxuICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuZykgfHwgMCkpLFxuICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuYikgfHwgMCkpLFxuICAgICAgICAgICAgYTogcHJvY2Vzc2VkVmFsdWUuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuYSkpKSA6IDI1NVxuICAgICAgICB9O1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBjb2xvclZhbHVlLCB0eXBlOiAnY2MuQ29sb3InIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ3ZlYzMnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgeDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLngpIHx8IDAsIHk6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS55KSB8fCAwLCB6OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueikgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMicgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAgfSwgdHlwZTogJ2NjLlZlYzInIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ3NpemUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgd2lkdGg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS53aWR0aCkgfHwgMCwgaGVpZ2h0OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUuaGVpZ2h0KSB8fCAwIH0sIHR5cGU6ICdjYy5TaXplJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBwcm9jZXNzZWRWYWx1ZSkge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSwgdHlwZTogJ2NjLk5vZGUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudCcgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0JyAmJiAndXVpZCcgaW4gcHJvY2Vzc2VkVmFsdWUpIHtcbiAgICAgICAgLy8gSXNzdWUgIzc1OiBjbGVhcmluZyBhIGNvbXBvbmVudCByZWZlcmVuY2UgKGBjb252ZXJ0UHJvcGVydHlWYWx1ZWAgcmV0dXJuc1xuICAgICAgICAvLyBgeyB1dWlkOiAnJyB9YCBmb3IgYSBudWxsLycnIGlucHV0KSDigJQgd3JpdGUgaXQgRElSRUNUTFkuIFRoZXJlIGlzIG5vIHRhcmdldCB0b1xuICAgICAgICAvLyByZXNvbHZlLCBhbmQgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZSB3b3VsZCBvbmx5IHJlcG9ydCAnJyBhcyBuZWl0aGVyIGEgbm9kZVxuICAgICAgICAvLyB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkLlxuICAgICAgICBjb25zdCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBhd2FpdCByZXNvbHZlRXhwZWN0ZWRDb21wb25lbnRUeXBlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgZ2V0Q29tcG9uZW50SW5mbyk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHV1aWQ6ICcnIH0sIHR5cGU6IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB8fCAnY2MuQ29tcG9uZW50JyB9XG4gICAgICAgIH0pO1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0geyB1dWlkOiAnJyB9O1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnQnICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlKFxuICAgICAgICAgICAgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb2Nlc3NlZFZhbHVlLCBnZXRDb21wb25lbnRJbmZvXG4gICAgICAgICk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ25vZGVBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgLy8gV2l0aG91dCBhbiBleHBsaWNpdCB0eXBlL2lzQXJyYXkvZWxlbWVudFR5cGVEYXRhLCB0aGUgZWRpdG9yJ3Mgc2V0LXByb3BlcnR5XG4gICAgICAgIC8vIGR1bXAgaGFzIG5vIHdheSB0byBrbm93IHRoaXMgaXMgYW4gYXJyYXkgb2YgY2MuTm9kZSByZWZlcmVuY2VzIOKAlCBpdCBmYWxsc1xuICAgICAgICAvLyB0aHJvdWdoIGFzIGEgYmFyZSB2YWx1ZSBhbmQgc2lsZW50bHkgZG9lcyBub3QgYXBwbHkgKGlzc3VlICMxOCksIHRoZSBzYW1lXG4gICAgICAgIC8vIGZhaWx1cmUgbW9kZSBhcyB0aGUgYXNzZXQtcmVmZXJlbmNlIHR5cGVzIGJlZm9yZSB0aGV5IGdhaW5lZCBhbiBleHBsaWNpdFxuICAgICAgICAvLyBgdHlwZWAgZmllbGQgKHNlZSB0aGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCBhYm92ZSkuXG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBwcm9jZXNzZWRWYWx1ZSwgdHlwZTogJ2NjLk5vZGUnLCBpc0FycmF5OiB0cnVlLCBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IG51bGwsIHR5cGU6ICdjYy5Ob2RlJyB9IH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2Fzc2V0QXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIC8vIEV4cGxpY2l0IGFycmF5IGR1bXAgdHlwZWQgd2l0aCB0aGUgcHJvcGVydHkncyBERUNMQVJFRCBlbGVtZW50IGNsYXNzLiBFYWNoIGVsZW1lbnRcbiAgICAgICAgLy8gbXVzdCBpdHNlbGYgYmUgYSBmdWxsIGR1bXAgYHsgdmFsdWU6IHsgdXVpZCB9LCB0eXBlIH1gICh0aGUgc2hhcGUgcXVlcnktbm9kZSByZXR1cm5zKTpcbiAgICAgICAgLy8gYSBiYXJlIGB7IHV1aWQgfWAgZWxlbWVudCBtYWtlcyB0aGUgZWRpdG9yIHRocm93IFwiQ2Fubm90IHJlYWQgcHJvcGVydGllcyBvZlxuICAgICAgICAvLyB1bmRlZmluZWQgKHJlYWRpbmcgJ2hhc093blByb3BlcnR5JylcIiB3aGlsZSBkZWNvZGluZyB0aGUgYXJyYXkuXG4gICAgICAgIGNvbnN0IGVsZW1lbnRUeXBlID0gYXdhaXQgcmVzb2x2ZURlY2xhcmVkQXNzZXRFbGVtZW50VHlwZShub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIGdldENvbXBvbmVudEluZm8pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDoge1xuICAgICAgICAgICAgICAgIHZhbHVlOiBwcm9jZXNzZWRWYWx1ZS5tYXAoKHJlZjogYW55KSA9PiAoeyB2YWx1ZTogcmVmLCB0eXBlOiBlbGVtZW50VHlwZSB9KSksXG4gICAgICAgICAgICAgICAgdHlwZTogZWxlbWVudFR5cGUsIGlzQXJyYXk6IHRydWUsXG4gICAgICAgICAgICAgICAgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiB7IHV1aWQ6ICcnIH0sIHR5cGU6IGVsZW1lbnRUeXBlIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudEFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9jZXNzZWRWYWx1ZSwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICAgICApO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICdjb2xvckFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICBjb25zdCBjb2xvckFycmF5VmFsdWUgPSBwcm9jZXNzZWRWYWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKGl0ZW0gJiYgdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmICdyJyBpbiBpdGVtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uZykgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYTogaXRlbS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmEpKSkgOiAyNTVcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgcjogMjU1LCBnOiAyNTUsIGI6IDI1NSwgYTogMjU1IH07XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLCBkdW1wOiB7IHZhbHVlOiBjb2xvckFycmF5VmFsdWUsIHR5cGU6ICdjYy5Db2xvcicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAodW5oYW5kbGVkV2FybmluZykge1xuICAgICAgICAvLyBJc3N1ZSAjNjY6IHRoZSBwcm9wZXJ0eVR5cGUgaXMgaW4gU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTLCBzbyBgY29udmVydFByb3BlcnR5VmFsdWVgXG4gICAgICAgIC8vIGFjY2VwdGVkIGl0LCBidXQgTk8gYnJhbmNoIGFib3ZlIGhhbmRsZXMgaXQg4oCUIHNvIHRoZSBkdW1wIHdvdWxkIGdvIG91dCB3aXRoIG5vIGB0eXBlYCxcbiAgICAgICAgLy8gdGhlIGVkaXRvciBkZWNvZGVzIG5vdGhpbmcsIGFuZCB0aGUgd3JpdGUgaXMgYSBzaWxlbnQgbm8tb3AuIGBjaGFuZ2VWZXJpZmllZGAgcmVhZGluZ1xuICAgICAgICAvLyBmYWxzZSBpcyBub3QgYSByZXNjdWU6IGEgY2FsbGVyIHRoYXQgdHJ1c3RzIGEgYHN1Y2Nlc3M6dHJ1ZWAgcmVzcG9uc2Ugc2hpcHMgYW5cbiAgICAgICAgLy8gdW5hdXRob3JlZCB2YWx1ZSwgd2hpY2ggaXMgZXhhY3RseSBob3cgYSBgY2MuUmVhbEN1cnZlYCBzcGxpbmUgY2FtZSBiYWNrIGFzIHRoZVxuICAgICAgICAvLyB1bnRvdWNoZWQgMi1wb2ludCBkZWZhdWx0IChpc3N1ZSAjNjYpLiBSZWZ1c2UgdGhlIHdyaXRlIGluc3RlYWQgb2YgcGVyZm9ybWluZyBvbmVcbiAgICAgICAgLy8gdGhhdCBjYW5ub3Qgd29yaywgYW5kIG5hbWUgd2hlcmUgdGhlIGFycmF5LW9mLW9iamVjdCBjYXNlcyBiZWxvbmcuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcih1bmhhbmRsZWRXYXJuaW5nKTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFjdHVhbEV4cGVjdGVkVmFsdWU7XG59XG5cbi8qKlxuICogVHJlYXQgJ1Vua25vd24nIGFzIG1pc3Npbmcg4oCUIGl0IGFwcGVhcnMgd2hlbiBhIHByZXZpb3VzIGFzc2lnbm1lbnQgc3RvcmVkIGEgdmFsdWVcbiAqIHdob3NlIHJ1bnRpbWUgdHlwZSBkaWRuJ3QgbWF0Y2ggdGhlIEBwcm9wZXJ0eSBkZWNsYXJlZCB0eXBlLCBsZWF2aW5nIHRoZSBkdW1wJ3NcbiAqIHR5cGUgZmllbGQgc3RhbGUuXG4gKi9cbmZ1bmN0aW9uIGlzVXNhYmxlVHlwZSh0OiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHlwZW9mIHQgPT09ICdzdHJpbmcnICYmIHQubGVuZ3RoID4gMCAmJiB0ICE9PSAnVW5rbm93bic7XG59XG5cbi8qKlxuICogUmVzb2x2ZSB0aGUgREVDTEFSRUQgZWxlbWVudCBjbGFzcyBvZiBhbiBhc3NldC1hcnJheSBAcHJvcGVydHkgKGUuZy4gYGNjLkF1ZGlvQ2xpcGAgZm9yXG4gKiBgQHByb3BlcnR5KHsgdHlwZTogW0F1ZGlvQ2xpcF0gfSlgKSBmcm9tIHRoZSBob2xkZXIgY29tcG9uZW50J3MgZHVtcC4gUHJlZmVyc1xuICogYGVsZW1lbnRUeXBlRGF0YS50eXBlYCwgdGhlbiB0aGUgYXJyYXkgZHVtcCdzIG93biBgdHlwZWA7IGZhbGxzIGJhY2sgdG8gYGNjLkFzc2V0YCB3aGVuXG4gKiBuZWl0aGVyIGlzIHJlYWRhYmxlLlxuICovXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlRGVjbGFyZWRBc3NldEVsZW1lbnRUeXBlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBpbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgbGV0IG1ldGE6IGFueSA9IGluZm8uc3VjY2VzcyA/IGluZm8uZGF0YT8ucHJvcGVydGllcyA6IHVuZGVmaW5lZDtcbiAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5LnNwbGl0KCcuJyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgbWV0YTsgaSsrKSB7XG4gICAgICAgIG1ldGEgPSBtZXRhW3NlZ21lbnRzW2ldXTtcbiAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgaWYgKCFpc0xlYWYgJiYgbWV0YSAmJiB0eXBlb2YgbWV0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBtZXRhICYmIHR5cGVvZiBtZXRhLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgbWV0YSA9IG1ldGEudmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKG1ldGEgJiYgdHlwZW9mIG1ldGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChpc1VzYWJsZVR5cGUobWV0YS5lbGVtZW50VHlwZURhdGE/LnR5cGUpKSByZXR1cm4gbWV0YS5lbGVtZW50VHlwZURhdGEudHlwZTtcbiAgICAgICAgaWYgKGlzVXNhYmxlVHlwZShtZXRhLnR5cGUpKSByZXR1cm4gbWV0YS50eXBlO1xuICAgIH1cbiAgICByZXR1cm4gJ2NjLkFzc2V0Jztcbn1cblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBERUNMQVJFRCB0eXBlIG9mIGEgYGNvbXBvbmVudGAvYGNvbXBvbmVudEFycmF5YCBAcHJvcGVydHkgZnJvbSB0aGUgaG9sZGVyXG4gKiBjb21wb25lbnQncyBvd24gZHVtcC4gRXh0cmFjdGVkIGZyb20gYHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2VgIHNvIGEgcmVmZXJlbmNlIENMRUFSXG4gKiAoaXNzdWUgIzc1LCBgeyB1dWlkOiAnJyB9YCkgY2FuIGdldCB0aGUgdHlwZSBpdCBuZWVkcyBmb3IgdGhlIGBzZXQtcHJvcGVydHlgIGR1bXBcbiAqIHdpdGhvdXQgZ29pbmcgdGhyb3VnaCB0aGF0IGZ1bmN0aW9uJ3MgVEFSR0VUIHJlc29sdXRpb24g4oCUIHRoZXJlIGlzIG5vdGhpbmcgdG8gcmVzb2x2ZVxuICogZm9yIGFuIGVtcHR5IHRhcmdldCwgYW5kIGl0IHdvdWxkIG9ubHkgZmFpbCB0cnlpbmcuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVFeHBlY3RlZENvbXBvbmVudFR5cGUoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGN1cnJlbnRDb21wb25lbnRJbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgLy8gV2FsayBkb3R0ZWQgcHJvcGVydHkgcGF0aHMgdGhyb3VnaCBuZXN0ZWQgQ0NDbGFzcyBncm91cCBkdW1wcyB0byBmaW5kIHRoZSBtZXRhZGF0YSBkZXNjcmlwdG9yLlxuICAgIGxldCBwcm9wZXJ0eU1ldGE6IGFueSA9IGN1cnJlbnRDb21wb25lbnRJbmZvLnN1Y2Nlc3MgPyBjdXJyZW50Q29tcG9uZW50SW5mby5kYXRhPy5wcm9wZXJ0aWVzIDogdW5kZWZpbmVkO1xuICAgIGlmIChwcm9wZXJ0eU1ldGEpIHtcbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aCAmJiBwcm9wZXJ0eU1ldGE7IGkrKykge1xuICAgICAgICAgICAgcHJvcGVydHlNZXRhID0gcHJvcGVydHlNZXRhW3NlZ21lbnRzW2ldXTtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICBpZiAoIWlzTGVhZiAmJiBwcm9wZXJ0eU1ldGEgJiYgdHlwZW9mIHByb3BlcnR5TWV0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eU1ldGEgJiYgdHlwZW9mIHByb3BlcnR5TWV0YS52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eU1ldGEgPSBwcm9wZXJ0eU1ldGEudmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gJyc7XG4gICAgaWYgKHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgICBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS50eXBlKSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gcHJvcGVydHlNZXRhLnR5cGU7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNVc2FibGVUeXBlKHByb3BlcnR5TWV0YS5jdG9yKSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gcHJvcGVydHlNZXRhLmN0b3I7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlNZXRhLmV4dGVuZHMgJiYgQXJyYXkuaXNBcnJheShwcm9wZXJ0eU1ldGEuZXh0ZW5kcykpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZXh0ZW5kVHlwZSBvZiBwcm9wZXJ0eU1ldGEuZXh0ZW5kcykge1xuICAgICAgICAgICAgICAgIGlmIChleHRlbmRUeXBlLnN0YXJ0c1dpdGgoJ2NjLicpICYmIGV4dGVuZFR5cGUgIT09ICdjYy5Db21wb25lbnQnICYmIGV4dGVuZFR5cGUgIT09ICdjYy5PYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IGV4dGVuZFR5cGU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZXhwZWN0ZWRDb21wb25lbnRUeXBlO1xufVxuXG4vKipcbiAqIFJlc29sdmUgYSB0YXJnZXQgbm9kZSdzIGNvbXBvbmVudCByZWZlcmVuY2UgdG8gaXRzIHNjZW5lIGNvbXBvbmVudCBpZCwgV0lUSE9VVFxuICogcGVyZm9ybWluZyB0aGUgYHNldC1wcm9wZXJ0eWAgd3JpdGUuIFNoYXJlZCBieSB0aGUgc2luZ2xlLWBjb21wb25lbnRgIHByb3BlcnR5VHlwZVxuICogKHdoaWNoIHdyaXRlcyBvbmUgYHsgdXVpZCB9YCB2YWx1ZSkgYW5kIHRoZSBgY29tcG9uZW50QXJyYXlgIHByb3BlcnR5VHlwZSAod2hpY2hcbiAqIHdyaXRlcyBhIHdob2xlIGFycmF5IGluIG9uZSBzZXQtcHJvcGVydHkgY2FsbCwgc28gcGVyLWVsZW1lbnQgd3JpdGVzIG11c3Qgbm90IGhhcHBlblxuICogaGVyZSDigJQgaXNzdWUgIzE4KS5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTx7IGNvbXBvbmVudElkOiBzdHJpbmc7IGV4cGVjdGVkQ29tcG9uZW50VHlwZTogc3RyaW5nIH0+IHtcbiAgICBjb25zb2xlLmxvZyhgW01hbmFnZUNvbXBvbmVudF0gU2V0dGluZyBjb21wb25lbnQgcmVmZXJlbmNlIC0gZmluZGluZyBjb21wb25lbnQgb24gbm9kZTogJHt0YXJnZXROb2RlVXVpZH1gKTtcblxuICAgIGxldCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBhd2FpdCByZXNvbHZlRXhwZWN0ZWRDb21wb25lbnRUeXBlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgZ2V0Q29tcG9uZW50SW5mbyk7XG5cbiAgICAvLyBgcXVlcnktbm9kZWAgUkVKRUNUUyBvbiBzb21lIGVkaXRvciBidWlsZHMgYW5kIHJlc29sdmVzIGZhbHN5IG9uIG90aGVyczsgYm90aCBtZWFuXG4gICAgLy8gdGhlIHNhbWUgdGhpbmcgaGVyZSDigJQgdGhlIHZhbHVlIGlzIG5vdCBhIG5vZGUgdXVpZC5cbiAgICBsZXQgdGFyZ2V0Tm9kZURhdGE6IGFueSA9IG51bGw7XG4gICAgdHJ5IHtcbiAgICAgICAgdGFyZ2V0Tm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdGFyZ2V0Tm9kZVV1aWQpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICB0YXJnZXROb2RlRGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCF0YXJnZXROb2RlRGF0YSB8fCAhdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgIC8vIFRoZSBjYWxsZXIgbWF5IGhhdmUgcGFzc2VkIHRoZSBDT01QT05FTlQncyBvd24gdXVpZCDigJQgdGhlIGB1dWlkYCBmaWVsZCB0aGF0XG4gICAgICAgIC8vIG1hbmFnZV9jb21wb25lbnQgZ2V0X2FsbCAvIGdldF9pbmZvIHJldHVybiwgYW5kIHRoZSBvYnZpb3VzIHRoaW5nIHRvIHJlYWNoIGZvclxuICAgICAgICAvLyB3aGVuIHdpcmluZyBhIEBwcm9wZXJ0eShTb21lQ29tcG9uZW50KSByZWZlcmVuY2UuIEFjY2VwdCB0aGF0IHNwZWxsaW5nIGluc3RlYWRcbiAgICAgICAgLy8gb2YgcmVwb3J0aW5nIGEgY29ycmVjdCB1dWlkIGFzIGEgbWlzc2luZyBub2RlLlxuICAgICAgICAvL1xuICAgICAgICAvLyBSZXNvbHZlLW9ubHksIGV4YWN0bHkgbGlrZSB0aGUgbm9kZSBwYXRoIGJlbG93IOKAlCB0aGlzIGZ1bmN0aW9uIGhhcyBub1xuICAgICAgICAvLyBgcHJvcGVydHlQYXRoYCBhbmQgbXVzdCBuZXZlciB3cml0ZS4gVGhlIGNhbGxlciAoYXBwbHlDb21wb25lbnRSZWZlcmVuY2UgZm9yIGFcbiAgICAgICAgLy8gc2luZ2xlIHJlZmVyZW5jZSwgYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheSBmb3IgYW4gYXJyYXkpIHBlcmZvcm1zIHRoZSBPTkVcbiAgICAgICAgLy8gc2V0LXByb3BlcnR5IHdyaXRlOyBhIHdyaXRlIGhlcmUgd291bGQgZmlyZSBvbmNlIHBlciBlbGVtZW50IG9uIGEgY29tcG9uZW50QXJyYXlcbiAgICAgICAgLy8gKGlzc3VlICMxOCkuXG4gICAgICAgIGNvbnN0IGRpcmVjdCA9IGF3YWl0IHF1ZXJ5Q29tcG9uZW50QnlVdWlkKHRhcmdldE5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFkaXJlY3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJyR7dGFyZ2V0Tm9kZVV1aWR9JyBpcyBuZWl0aGVyIGEgbm9kZSB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkLiBgICtcbiAgICAgICAgICAgICAgICBgUGFzcyB0aGUgdXVpZCBvZiB0aGUgTk9ERSB0aGF0IGhvbGRzIHRoZSBjb21wb25lbnQsIG9yIHRoZSBjb21wb25lbnQncyBvd24gYCArXG4gICAgICAgICAgICAgICAgYHV1aWQgZnJvbSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkaXJlY3RUeXBlID0gZXhwZWN0ZWRDb21wb25lbnRUeXBlIHx8IGRpcmVjdC50eXBlO1xuICAgICAgICBpZiAoIWRpcmVjdFR5cGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGRldGVybWluZSByZXF1aXJlZCBjb21wb25lbnQgdHlwZSBmb3IgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBvbiBjb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nLiBQcm9wZXJ0eSBtZXRhZGF0YSBtYXkgbm90IGNvbnRhaW4gdHlwZSBpbmZvcm1hdGlvbi5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBub2RlIHBhdGggYmVsb3cgb25seSBldmVyIHJlc29sdmVzIGEgY29tcG9uZW50IHdob3NlIHR5cGUgRVhBQ1RMWSBtYXRjaGVzXG4gICAgICAgIC8vIGV4cGVjdGVkQ29tcG9uZW50VHlwZSAoaXRzIHNlYXJjaCBsb29wIHJlamVjdHMgYW55dGhpbmcgZWxzZSkuIGBleHBlY3RlZENvbXBvbmVudFR5cGVcbiAgICAgICAgLy8gfHwgZGlyZWN0LnR5cGVgIG9ubHkgZmFsbHMgYmFjayB0byBkaXJlY3QudHlwZSB3aGVuIGV4cGVjdGVkQ29tcG9uZW50VHlwZSBpcyBlbXB0eTtcbiAgICAgICAgLy8gaXQgbmV2ZXIgdmFsaWRhdGVkIHRoZSB0d28gYWdhaW5zdCBlYWNoIG90aGVyIHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIFdBUyBrbm93bixcbiAgICAgICAgLy8gbGV0dGluZyBhIG1pc21hdGNoZWQgY29tcG9uZW50IChlLmcuIGEgY2MuU3ByaXRlIHV1aWQgb24gYSBwcm9wZXJ0eSB0eXBlZFxuICAgICAgICAvLyBIZXJvRHJhZ0NvbnRyb2xsZXIpIHJlc29sdmUgdW5yZWplY3RlZC4gQSBkaXJlY3QudHlwZSB0aGF0IGlzIGl0c2VsZiB1bnVzYWJsZVxuICAgICAgICAvLyAoJ1Vua25vd24nL2JsYW5rKSBjYW5ub3QgZGlzcHJvdmUgYSBtYXRjaCwgc28gaXQgaXMgbGVmdCB0byBmYWxsIHRocm91Z2guXG4gICAgICAgIGlmIChleHBlY3RlZENvbXBvbmVudFR5cGUgJiYgaXNVc2FibGVUeXBlKGRpcmVjdC50eXBlKSAmJiBkaXJlY3QudHlwZSAhPT0gZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAvLyBJc3N1ZSAjODE6IHRoZSBzYW1lIHBvbHltb3JwaGljIGdhcCBpc3N1ZSAjNDUgZml4ZWQgb24gdGhlIG5vZGUtdXVpZCBwYXRoXG4gICAgICAgICAgICAvLyBiZWxvdyDigJQgZXhwZWN0ZWRDb21wb25lbnRUeXBlIG1heSBiZSBhIEJBU0UgY2xhc3Mgd2hpbGUgZGlyZWN0LnR5cGUgaXMgYVxuICAgICAgICAgICAgLy8gU1VCQ0xBU1MuIEEgbGl0ZXJhbCBzdHJpbmcgbWlzbWF0Y2ggY2FuJ3QgZGlzcHJvdmUgdGhhdDsgYXNrIHRoZSBsaXZlXG4gICAgICAgICAgICAvLyBjbGFzcyByZWdpc3RyeSBiZWZvcmUgcmVqZWN0aW5nIGEgY29tcG9uZW50IHRoYXQgd291bGQgYWN0dWFsbHkgc2F0aXNmeVxuICAgICAgICAgICAgLy8gdGhlIGRlY2xhcmVkIHByb3BlcnR5IHR5cGUuXG4gICAgICAgICAgICBsZXQgaXNTdWJjbGFzcyA9IGZhbHNlO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWJjbGFzc1Jlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnaXNDb21wb25lbnRUeXBlU3ViY2xhc3NPZicsIGFyZ3M6IFtkaXJlY3QudHlwZSwgZXhwZWN0ZWRDb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlzU3ViY2xhc3MgPSAhIShzdWJjbGFzc1Jlc3VsdCAmJiBzdWJjbGFzc1Jlc3VsdC5zdWNjZXNzICYmIHN1YmNsYXNzUmVzdWx0LmRhdGEgJiYgc3ViY2xhc3NSZXN1bHQuZGF0YS5pc1N1YmNsYXNzKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIGlzU3ViY2xhc3MgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFpc1N1YmNsYXNzKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50IHV1aWQgJyR7dGFyZ2V0Tm9kZVV1aWR9JyBpcyBhICcke2RpcmVjdC50eXBlfScsIGJ1dCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGAgK1xuICAgICAgICAgICAgICAgICAgICBgb24gJyR7Y29tcG9uZW50VHlwZX0nIHJlcXVpcmVzIGEgJyR7ZXhwZWN0ZWRDb21wb25lbnRUeXBlfScuYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBjb21wb25lbnRJZDogZGlyZWN0LnV1aWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZTogZGlyZWN0VHlwZSB9O1xuICAgIH1cblxuICAgIC8vIFNpbmdsZS1jYy1jb21wb25lbnQgZmFsbGJhY2s6IHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIGNvdWxkIG5vdCBiZSBpbmZlcnJlZFxuICAgIC8vIChlLmcuLCBzdGFsZSAnVW5rbm93bicgaW4gZHVtcCBhbmQgZXh0ZW5kcyBvbmx5IGxpc3RzIGNjLkNvbXBvbmVudC9jYy5PYmplY3QpLFxuICAgIC8vIGFuZCB0aGUgdGFyZ2V0IG5vZGUgaGFzIGV4YWN0bHkgb25lIGNjLiogY29tcG9uZW50LCB1c2UgaXQuIE1pcnJvcnMgQ29jb3Mnc1xuICAgIC8vIGRyYWctZnJvbS1oaWVyYXJjaHkgYXV0by1yZXNvbHZlIGJlaGF2aW9yLlxuICAgIGlmICghZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgIGNvbnN0IGNjQ29tcHMgPSAodGFyZ2V0Tm9kZURhdGEuX19jb21wc19fIGFzIGFueVtdKVxuICAgICAgICAgICAgLmZpbHRlcihjID0+IHR5cGVvZiBjLnR5cGUgPT09ICdzdHJpbmcnICYmIGMudHlwZS5zdGFydHNXaXRoKCdjYy4nKVxuICAgICAgICAgICAgICAgICYmIGMudHlwZSAhPT0gJ2NjLkNvbXBvbmVudCcgJiYgYy50eXBlICE9PSAnY2MuT2JqZWN0Jyk7XG4gICAgICAgIGlmIChjY0NvbXBzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gY2NDb21wc1swXS50eXBlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZGV0ZXJtaW5lIHJlcXVpcmVkIGNvbXBvbmVudCB0eXBlIGZvciBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIFByb3BlcnR5IG1ldGFkYXRhIG1heSBub3QgY29udGFpbiB0eXBlIGluZm9ybWF0aW9uLmApO1xuICAgIH1cblxuICAgIGxldCBjb21wb25lbnRJZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IGZvdW5kQ29tcG9uZW50ID0gbnVsbDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRhcmdldE5vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb21wID0gdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgaWYgKGNvbXAudHlwZSA9PT0gZXhwZWN0ZWRDb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICBmb3VuZENvbXBvbmVudCA9IGNvbXA7XG4gICAgICAgICAgICBpZiAoY29tcC52YWx1ZSAmJiBjb21wLnZhbHVlLnV1aWQgJiYgY29tcC52YWx1ZS51dWlkLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50SWQgPSBjb21wLnZhbHVlLnV1aWQudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGV4dHJhY3QgY29tcG9uZW50IElEIGZyb20gY29tcG9uZW50IHN0cnVjdHVyZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWZvdW5kQ29tcG9uZW50KSB7XG4gICAgICAgIC8vIElzc3VlICM0NTogZXhwZWN0ZWRDb21wb25lbnRUeXBlIG1heSBiZSBhIEJBU0UgY2xhc3MgKGRlY2xhcmVkIG9uIHRoZVxuICAgICAgICAvLyBAcHJvcGVydHkpIHdoaWxlIGV2ZXJ5IGNvbXBvbmVudCBhY3R1YWxseSBvbiB0aGUgbm9kZSBpcyBhIFNVQkNMQVNTIOKAlCBhblxuICAgICAgICAvLyBleGFjdCBzdHJpbmcgbWF0Y2ggYWdhaW5zdCBjb21wLnR5cGUgY2FuIG5ldmVyIHN1Y2NlZWQgZm9yIGEgcG9seW1vcnBoaWNcbiAgICAgICAgLy8gcmVmZXJlbmNlLCBldmVuIHRob3VnaCB0aGUgZW5naW5lJ3Mgb3duIG5vZGUuZ2V0Q29tcG9uZW50KEJhc2VDbGFzcykgYWxyZWFkeVxuICAgICAgICAvLyByZXNvbHZlcyBzdWJjbGFzcyBpbnN0YW5jZXMuIEZhbGwgYmFjayB0byB0aGF0IGxpdmUtc2NlbmUsIGluaGVyaXRhbmNlLWF3YXJlXG4gICAgICAgIC8vIGxvb2t1cCBiZWZvcmUgZ2l2aW5nIHVwLlxuICAgICAgICBsZXQgYmFzZUNsYXNzUmVzdWx0OiBhbnkgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYmFzZUNsYXNzUmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdmaW5kQ29tcG9uZW50QnlCYXNlQ2xhc3MnLCBhcmdzOiBbdGFyZ2V0Tm9kZVV1aWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGJhc2VDbGFzc1Jlc3VsdCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJhc2VDbGFzc1Jlc3VsdCAmJiBiYXNlQ2xhc3NSZXN1bHQuc3VjY2VzcyAmJiBiYXNlQ2xhc3NSZXN1bHQuZGF0YSAmJiBiYXNlQ2xhc3NSZXN1bHQuZGF0YS5jb21wb25lbnRVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBjb21wb25lbnRJZDogYmFzZUNsYXNzUmVzdWx0LmRhdGEuY29tcG9uZW50VXVpZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhdmFpbGFibGUgPSB0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lSWQgPSBjb21wLnZhbHVlICYmIGNvbXAudmFsdWUudXVpZCAmJiBjb21wLnZhbHVlLnV1aWQudmFsdWUgPyBjb21wLnZhbHVlLnV1aWQudmFsdWUgOiAndW5rbm93bic7XG4gICAgICAgICAgICByZXR1cm4gYCR7Y29tcC50eXBlfShzY2VuZV9pZDoke3NjZW5lSWR9KWA7XG4gICAgICAgIH0pO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudCB0eXBlICcke2V4cGVjdGVkQ29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlICR7dGFyZ2V0Tm9kZVV1aWR9LiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGUuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICBpZiAoIWNvbXBvbmVudElkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5hYmxlIHRvIGV4dHJhY3QgY29tcG9uZW50IElEIGZyb20gY29tcG9uZW50IHN0cnVjdHVyZWApO1xuICAgIH1cblxuICAgIHJldHVybiB7IGNvbXBvbmVudElkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfTtcbn1cblxuLyoqIFJlc29sdmUgYSBjb21wb25lbnQgcmVmZXJlbmNlIGFuZCB3cml0ZSBpdCBhcyBhIHNpbmdsZSBgeyB1dWlkIH1gIHZhbHVlLiAqL1xuYXN5bmMgZnVuY3Rpb24gYXBwbHlDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBwcm9wZXJ0eVBhdGg6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICB0YXJnZXROb2RlVXVpZDogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgeyBjb21wb25lbnRJZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH0gPSBhd2FpdCByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlKFxuICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHRhcmdldE5vZGVVdWlkLCBnZXRDb21wb25lbnRJbmZvXG4gICAgKTtcblxuICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB1dWlkOiBjb21wb25lbnRJZCB9LCB0eXBlOiBleHBlY3RlZENvbXBvbmVudFR5cGUgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgdXVpZDogY29tcG9uZW50SWQgfTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlIGFuIGFycmF5IG9mIHRhcmdldC1ub2RlIFVVSURzIHRvIHRoZWlyIGNvbXBvbmVudCByZWZlcmVuY2VzIGFuZCB3cml0ZSB0aGVcbiAqIHdob2xlIGFycmF5IGluIE9ORSBzZXQtcHJvcGVydHkgY2FsbCAobWF0Y2hpbmcgdGhlIG5vZGVBcnJheSBmaXggYWJvdmUg4oCUIGFuIGFycmF5XG4gKiBwcm9wZXJ0eSBuZWVkcyBgaXNBcnJheWAvYGVsZW1lbnRUeXBlRGF0YWAgaW4gdGhlIGR1bXAsIG5vdCBOIHNlcGFyYXRlIHNjYWxhciB3cml0ZXMpLlxuICogQW4gZW1wdHkgaW5wdXQgYXJyYXkgaXMgZ3VhcmRlZCBleHBsaWNpdGx5OiB0aGVyZSBpcyBubyBlbGVtZW50IHRvIHJlc29sdmUgYVxuICogY29tcG9uZW50IHR5cGUgZnJvbSwgc28gaXQgaXMgd3JpdHRlbiBhcyBhbiBlbXB0eSBhcnJheSB3aXRoIGEgZ2VuZXJpYyBlbGVtZW50IHR5cGVcbiAqIHJhdGhlciB0aGFuIGluZGV4aW5nIGludG8gYW4gYXJyYXkgdGhhdCBoYXMgbm8gYFswXWAuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGFwcGx5Q29tcG9uZW50UmVmZXJlbmNlQXJyYXkoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBwcm9wZXJ0eVBhdGg6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICB0YXJnZXROb2RlVXVpZHM6IGFueVtdLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8YW55PiB7XG4gICAgaWYgKHRhcmdldE5vZGVVdWlkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IFtdLCBpc0FycmF5OiB0cnVlLCBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IG51bGwsIHR5cGU6ICdjYy5Db21wb25lbnQnIH0gfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc29sdmVkUmVmczogQXJyYXk8eyB1dWlkOiBzdHJpbmcgfT4gPSBbXTtcbiAgICBsZXQgZWxlbWVudFR5cGUgPSAnJztcbiAgICBmb3IgKGNvbnN0IHRhcmdldE5vZGVVdWlkIG9mIHRhcmdldE5vZGVVdWlkcykge1xuICAgICAgICBpZiAodHlwZW9mIHRhcmdldE5vZGVVdWlkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb21wb25lbnRBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBub2RlIFVVSURzIChlYWNoIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpJyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgeyBjb21wb25lbnRJZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlIH0gPSBhd2FpdCByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlKFxuICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB0YXJnZXROb2RlVXVpZCwgZ2V0Q29tcG9uZW50SW5mb1xuICAgICAgICApO1xuICAgICAgICByZXNvbHZlZFJlZnMucHVzaCh7IHV1aWQ6IGNvbXBvbmVudElkIH0pO1xuICAgICAgICBlbGVtZW50VHlwZSA9IGVsZW1lbnRUeXBlIHx8IGV4cGVjdGVkQ29tcG9uZW50VHlwZTtcbiAgICB9XG5cbiAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgIGR1bXA6IHsgdmFsdWU6IHJlc29sdmVkUmVmcywgaXNBcnJheTogdHJ1ZSwgZWxlbWVudFR5cGVEYXRhOiB7IHZhbHVlOiBudWxsLCB0eXBlOiBlbGVtZW50VHlwZSB9IH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXNvbHZlZFJlZnM7XG59XG5cbi8qKlxuICogTG9vayBhIHV1aWQgdXAgYXMgYSBDT01QT05FTlQgcmF0aGVyIHRoYW4gYSBub2RlLlxuICpcbiAqIGBxdWVyeS1jb21wb25lbnRgIGFuc3dlcnMgZm9yIGEgY29tcG9uZW50J3Mgb3duIHV1aWQgYW5kIHJldHVybnMgdGhlIHNhbWUgZHVtcCBzaGFwZSBhc1xuICogb25lIGBfX2NvbXBzX19gIGVudHJ5LCBzbyBgdmFsdWUudXVpZC52YWx1ZWAgYW5kIGB0eXBlYCByZWFkIGV4YWN0bHkgYXMgdGhleSBkbyBvbiB0aGVcbiAqIG5vZGUgcGF0aC4gUmV0dXJucyBudWxsIGZvciBhbnl0aGluZyB0aGF0IGlzIG5vdCBhIGxpdmUgY29tcG9uZW50IOKAlCBpbmNsdWRpbmcgYSB1dWlkXG4gKiB0aGF0IG5hbWVzIG5vdGhpbmcgYXQgYWxsIOKAlCBzbyB0aGUgY2FsbGVyIGNhbiByZXBvcnQgYm90aCBhY2NlcHRlZCBzcGVsbGluZ3MuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHF1ZXJ5Q29tcG9uZW50QnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8eyB1dWlkOiBzdHJpbmc7IHR5cGU6IHN0cmluZyB9IHwgbnVsbD4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbXA6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudCcsIHV1aWQpO1xuICAgICAgICBpZiAoIWNvbXApIHJldHVybiBudWxsO1xuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkVXVpZCA9IGNvbXAudmFsdWU/LnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IHV1aWQ7XG4gICAgICAgIGNvbnN0IHR5cGUgPSBjb21wLnR5cGUgfHwgY29tcC5jaWQgfHwgY29tcC5fX3R5cGVfXyB8fCAnJztcbiAgICAgICAgcmV0dXJuIHsgdXVpZDogcmVzb2x2ZWRVdWlkLCB0eXBlIH07XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbn1cbiJdfQ==