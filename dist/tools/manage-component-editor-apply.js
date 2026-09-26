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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBZUgsNENBVUM7QUFzREQsc0VBbUJDO0FBT0Qsc0RBcUtDO0FBM1FELDJGQUFrSDtBQUVsSCxzRkFBc0Y7QUFDdEYsTUFBTSwwQkFBMEIsR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFFcEc7Ozs7OztHQU1HO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsWUFBb0IsRUFBRSxRQUFnQjtJQUNuRSxNQUFNLFFBQVEsR0FBRywrREFBMkIsQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUMzRCxJQUFJLFFBQVE7UUFBRSxPQUFPLFFBQVEsQ0FBQztJQUU5QixNQUFNLElBQUksR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDcEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ3BELElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUNwRCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDNUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztRQUFFLE9BQU8sY0FBYyxDQUFDO0lBQ2pELE9BQU8sZ0JBQWdCLENBQUM7QUFDNUIsQ0FBQztBQWFEOzs7Ozs7O0dBT0c7QUFDSCxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFTO0lBQ3pDLGlGQUFpRjtJQUNqRixnRkFBZ0Y7SUFDaEYsb0VBQW9FO0lBQ3BFLEdBQUcsa0VB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LGFBQWEsaUJBQWlCLFVBQVUsRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFO1NBQzNGLENBQUMsQ0FBQztJQUVQLENBQUM7U0FBTSxJQUFJLFlBQVksS0FBSyxPQUFPLElBQUksY0FBYyxJQUFJLE9BQU8sY0FBYyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzFGLE1BQU0sVUFBVSxHQUFHO1lBQ2YsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDNUQsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDNUQsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDNUQsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztTQUNqRyxDQUFDO1FBQ0YsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUksRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUU7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LENBQUM7SUFDeEMsQ0FBQztJQUFDLFdBQU0sQ0FBQztRQUNMLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFZGl0b3IgQVBJIGNhbGxzIGZvciBhcHBseWluZyBjb21wb25lbnQgcHJvcGVydHkgdmFsdWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50LnNldENvbXBvbmVudFByb3BlcnR5IChTdGVwIDYpLlxuICogRWFjaCBwcm9wZXJ0eSB0eXBlIHVzZXMgYSBkaWZmZXJlbnQgZHVtcCBmb3JtYXQgZm9yIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScpLlxuICovXG5cbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMsIEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcblxuLyoqIFByb3BlcnR5LW5hbWUgc3Vic3RyaW5ncyB0aGF0IG1hcmsgYSBiYXJlIGBzdHJpbmdgIHZhbHVlIGFzIGFuIGFzc2V0IHJlZmVyZW5jZS4gKi9cbmNvbnN0IE5BTUVfSElOVEVEX0FTU0VUX0tFWVdPUkRTID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXTtcblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBBbiBleHBsaWNpdCBwcm9wZXJ0eVR5cGUgKGBtYXRlcmlhbGAsIGBtZXNoYCwg4oCmKSB3aW5zLCBiZWNhdXNlIGl0IGlzIGF1dGhvcml0YXRpdmUuXG4gKiBPbmx5IHRoZSBnZW5lcmljIGBhc3NldGAgLyBgc3RyaW5nYCBzcGVsbGluZ3Mg4oCUIHdoaWNoIGNhcnJ5IG5vIHR5cGUgaW5mb3JtYXRpb24g4oCUIGZhbGwgYmFja1xuICogdG8gdGhlIHByb3BlcnR5LW5hbWUgaGV1cmlzdGljLCBzbyBleGlzdGluZyBjYWxsZXJzIHVzaW5nIHRob3NlIGtlZXAgdGhlaXIgZXhhY3QgYmVoYXZpb3VyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3QgZXhwbGljaXQgPSBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEVbcHJvcGVydHlUeXBlXTtcbiAgICBpZiAoZXhwbGljaXQpIHJldHVybiBleHBsaWNpdDtcblxuICAgIGNvbnN0IG5hbWUgPSBwcm9wZXJ0eS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChuYW1lLmluY2x1ZGVzKCd0ZXh0dXJlJykpIHJldHVybiAnY2MuVGV4dHVyZTJEJztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnbWF0ZXJpYWwnKSkgcmV0dXJuICdjYy5NYXRlcmlhbCc7XG4gICAgaWYgKG5hbWUuaW5jbHVkZXMoJ2ZvbnQnKSkgcmV0dXJuICdjYy5Gb250JztcbiAgICBpZiAobmFtZS5pbmNsdWRlcygnY2xpcCcpKSByZXR1cm4gJ2NjLkF1ZGlvQ2xpcCc7XG4gICAgcmV0dXJuICdjYy5TcHJpdGVGcmFtZSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBwbHlQcm9wZXJ0eUFyZ3Mge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7XG4gICAgcHJvcGVydHlQYXRoOiBzdHJpbmc7XG4gICAgcmF3Q29tcG9uZW50SW5kZXg6IG51bWJlcjtcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmc7XG4gICAgcHJvcGVydHk6IHN0cmluZztcbiAgICBwcm9wZXJ0eVR5cGU6IHN0cmluZztcbiAgICB2YWx1ZTogYW55O1xuICAgIHByb2Nlc3NlZFZhbHVlOiBhbnk7XG59XG5cbi8qKlxuICogRXZlcnkgcHJvcGVydHlUeXBlIHRoZSBicmFuY2hlcyBiZWxvdyBhY3R1YWxseSBoYW5kbGUsIGluIG9uZSBwbGFjZS5cbiAqXG4gKiBCdWlsdCBieSBjb21wb3NpdGlvbiBzbyBhIG5ldyBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHlUeXBlIChhZGRlZCB0b1xuICogYEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFU2ApIGlzIGNvdmVyZWQgYXV0b21hdGljYWxseSByYXRoZXIgdGhhbiBoYXZpbmcgdG8gYmVcbiAqIHJlbWVtYmVyZWQgaGVyZSDigJQgdGhlIGR1cGxpY2F0aW9uIHRoaXMgbGlzdCB3b3VsZCBvdGhlcndpc2UgaW50cm9kdWNlIGlzIGV4YWN0bHkgaG93XG4gKiBhbiBhY2NlcHRlZC1idXQtdW5oYW5kbGVkIHR5cGUgc2xpcHMgdGhyb3VnaCB1bm5vdGljZWQgKGlzc3VlICM2NikuXG4gKi9cbmNvbnN0IEhBTkRMRURfU0NBTEFSX1RZUEVTID0gbmV3IFNldDxzdHJpbmc+KFtcbiAgICAvLyBUaGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCBpcyBnYXRlZCBvbiBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgcGx1cyB0aGVcbiAgICAvLyBnZW5lcmljIGBhc3NldGAgc3BlbGxpbmc7IGBzdHJpbmdgIGlzIGRlbGliZXJhdGVseSBpbmNsdWRlZCBiZWNhdXNlIGl0IGlzIHRoZVxuICAgIC8vIGJyYW5jaCdzIGV4cGxpY2l0IGVzY2FwZSBmb3IgYSBwbGFpbi1zdHJpbmcgcHJvcGVydHkgKGlzc3VlICM0NikuXG4gICAgLi4uQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTLCAnYXNzZXQnLCAnc3RyaW5nJyxcbiAgICAvLyBUaGUgdHlwZWQgbWF0aC9zaGFwZSBicmFuY2hlcywgcGx1cyB0aGUgcmVmZXJlbmNlIHR5cGVzIHRoYXQgb3duIGEgYnJhbmNoIG9mIHRoZWlyIG93bi5cbiAgICAnY29sb3InLCAndmVjMycsICd2ZWMyJywgJ3NpemUnLCAnbm9kZScsICdjb21wb25lbnQnLFxuICAgIC8vIFRoZSB0ZXJtaW5hbCBgZWxzZWAgaXMgdGhlIGNvcnJlY3QgaG9tZSBmb3IgYSBwbGFpbiBzY2FsYXIgZHVtcCDigJQgaXQgd3JpdGVzXG4gICAgLy8gYHsgdmFsdWUgfWAgd2l0aCBubyBgdHlwZWAsIHdoaWNoIGlzIGV4YWN0bHkgd2hhdCBhIG51bWJlci9ib29sZWFuIG5lZWRzLiBgaW50ZWdlcmBcbiAgICAvLyBhbmQgYGZsb2F0YCBhcmUgc3BlbGxlZCBhcyBgbnVtYmVyYCBhbGlhc2VzIGJ5IGBjb252ZXJ0UHJvcGVydHlWYWx1ZWAgYW5kIHRha2UgdGhlXG4gICAgLy8gc2FtZSBwYXRoLCBzbyB0aGV5IGJlbG9uZyBoZXJlIHRvbzsgcmVmdXNpbmcgdGhlbSB3b3VsZCBicmVhayB3b3JraW5nIGNhbGxzLlxuICAgICdudW1iZXInLCAnaW50ZWdlcicsICdmbG9hdCcsICdib29sZWFuJ1xuXSk7XG5cbmNvbnN0IEhBTkRMRURfQVJSQVlfVFlQRVMgPSBuZXcgU2V0PHN0cmluZz4oW1xuICAgICdub2RlQXJyYXknLCAnYXNzZXRBcnJheScsICdjb21wb25lbnRBcnJheScsICdjb2xvckFycmF5JyxcbiAgICAvLyBUaGVzZSB0d28gQVJFIGFkdmVydGlzZWQgYW5kIERPIHdvcms6IHRoZWlyIGNvbnZlcnNpb24gcmVqZWN0cyBhIG5vbi1hcnJheSBhbmRcbiAgICAvLyBmbGF0dGVucyBwcmltaXRpdmVzLCBhbmQgdGhlIHRlcm1pbmFsIGBlbHNlYCB3cml0ZXMgdGhlIHJlc3VsdGluZyBwbGFpbiBhcnJheVxuICAgIC8vIGNvcnJlY3RseS4gVGhleSBhcmUgbmFtZWQgaGVyZSBzbyB0aGUgZ3VhcmQgYmVsb3cgY2Fubm90IHJlZnVzZSBhIHN1cHBvcnRlZFxuICAgIC8vIHByb3BlcnR5VHlwZSDigJQgYSByZWdyZXNzaW9uIHRoaXMgZ3VhcmQgbmFycm93bHkgYXZvaWRlZCwgc2luY2UgcmVmdXNpbmcgdGhlbSB3b3VsZFxuICAgIC8vIGhhdmUgYnJva2VuIGNhbGxzIHRoYXQgc3VjY2VlZCB0b2RheSAoaXNzdWUgIzY2J3Mgb3duIHJlcG9ydCBsaXN0cyBzY2FsYXIgYW5kIGFycmF5XG4gICAgLy8gd3JpdGVzIG9uIHRoZSBzYW1lIGNvbXBvbmVudHMgYXMgd29ya2luZykuXG4gICAgJ251bWJlckFycmF5JywgJ3N0cmluZ0FycmF5J1xuXSk7XG5cbi8qKlxuICogRXhwbGFpbiB3aHkgdGhpcyBwcm9wZXJ0eVR5cGUgY2Fubm90IGJlIGFwcGxpZWQsIG9yIHJldHVybiBgbnVsbGAgd2hlbiBhIGJyYW5jaCBvd25zIGl0LlxuICpcbiAqIFRoZSBtZXNzYWdlIGlzIHNwbGl0IGJ5IENBVVNFLCBiZWNhdXNlIHRoZSByZW1lZHkgZGlmZmVyczogYW4gYXJyYXkgc2hhcGUgaGFzIGEgc3VwcG9ydGVkXG4gKiBwcm9wZXJ0eVR5cGUgdGhlIGNhbGxlciBzaG91bGQgYmUgdXNpbmcgaW5zdGVhZCwgd2hpbGUgYSBnYXAgaW4gdGhlIHNjYWxhciBsaXN0IGlzIGEgYnVnXG4gKiBpbiB0aGlzIGZpbGUncyBicmFuY2ggc2V0LiBBIHNpbmdsZSBcInVuc3VwcG9ydGVkXCIgbWVzc2FnZSBmb3IgYm90aCB3b3VsZCBzZW5kIHRoZSBjYWxsZXJcbiAqIGh1bnRpbmcgZm9yIHRoZSB3cm9uZyBmaXguXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXNjcmliZVVuaGFuZGxlZFByb3BlcnR5VHlwZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgcHJvY2Vzc2VkVmFsdWU6IGFueSk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmIChIQU5ETEVEX1NDQUxBUl9UWVBFUy5oYXMocHJvcGVydHlUeXBlKSB8fCBIQU5ETEVEX0FSUkFZX1RZUEVTLmhhcyhwcm9wZXJ0eVR5cGUpKSByZXR1cm4gbnVsbDtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgYHByb3BlcnR5VHlwZSAnJHtwcm9wZXJ0eVR5cGV9JyBpcyBhbiBBUlJBWSB2YWx1ZSwgYnV0IG5vIGFycmF5IGJyYW5jaCBoYW5kbGVzIGl0IOKAlCBzbyB0aGUgYCArXG4gICAgICAgICAgICBgc2V0LXByb3BlcnR5IGR1bXAgd291bGQgY2Fycnkgbm8gJ3R5cGUnIGZpZWxkLCB0aGUgZWRpdG9yIHdvdWxkIGRlY29kZSBub3RoaW5nLCBhbmQgdGhpcyBgICtcbiAgICAgICAgICAgIGBjYWxsIHdvdWxkIHJlcG9ydCBhIHdyaXRlIGl0IGRpZCBub3QgcGVyZm9ybSAoaXNzdWUgIzY2KS4gQW4gYXJyYXkgb2YgYXNzZXRzL3V1aWRzL2NvbG9ycyBgICtcbiAgICAgICAgICAgIGB3YW50cyBwcm9wZXJ0eVR5cGUgJ2Fzc2V0QXJyYXknLCAnbm9kZUFycmF5JywgJ2NvbXBvbmVudEFycmF5JyBvciAnY29sb3JBcnJheSc7IGFuIGFycmF5IG9mIGAgK1xuICAgICAgICAgICAgYHBsYWluIHZhbHVlIG9iamVjdHMgd2l0aCBOTyB1dWlkIHNlbWFudGljcyAoY2MuUmVhbEN1cnZlIGtleUZyYW1lcywgY2MuR3JhZGllbnQgYWxwaGFLZXlzKSBgICtcbiAgICAgICAgICAgIGBoYXMgbm8gc3VwcG9ydGVkIHByb3BlcnR5VHlwZSB5ZXQuIE5vdGhpbmcgd2FzIHdyaXR0ZW4uYFxuICAgICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiAoXG4gICAgICAgIGBwcm9wZXJ0eVR5cGUgJyR7cHJvcGVydHlUeXBlfScgaXMgbm90IGhhbmRsZWQgYnkgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yLCBzbyB0aGUgc2V0LXByb3BlcnR5IGAgK1xuICAgICAgICBgZHVtcCB3b3VsZCBjYXJyeSBubyAndHlwZScgZmllbGQgYW5kIHRoZSB3cml0ZSB3b3VsZCBzaWxlbnRseSBub3QgYXBwbHkgKGlzc3VlICM2NikuIGAgK1xuICAgICAgICBgTm90aGluZyB3YXMgd3JpdHRlbi5gXG4gICAgKTtcbn1cblxuLyoqXG4gKiBBcHBseSBhIHByb2Nlc3NlZCBwcm9wZXJ0eSB2YWx1ZSB0byB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3Igc2NlbmUuXG4gKiBSZXR1cm5zIHRoZSBhY3R1YWwgZXhwZWN0ZWQgdmFsdWUgKG1heSBkaWZmZXIgZnJvbSBwcm9jZXNzZWRWYWx1ZSBmb3IgY29tcG9uZW50IHJlZnMpLlxuICogVGhyb3dzIG9uIHVucmVjb3ZlcmFibGUgRWRpdG9yIEFQSSBlcnJvci5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFwcGx5UHJvcGVydHlUb0VkaXRvcihcbiAgICBhcmdzOiBBcHBseVByb3BlcnR5QXJncyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHsgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgcmF3Q29tcG9uZW50SW5kZXgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlLCBwcm9jZXNzZWRWYWx1ZSB9ID0gYXJncztcbiAgICBsZXQgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IHByb2Nlc3NlZFZhbHVlO1xuXG4gICAgLy8gQSBwcm9wZXJ0eVR5cGUgYGNvbnZlcnRQcm9wZXJ0eVZhbHVlYCBhY2NlcHRlZCBidXQgbm8gYnJhbmNoIGJlbG93IGFwcGxpZXMgbXVzdCBub3RcbiAgICAvLyBmYWxsIHRocm91Z2ggdG8gdGhlIHRlcm1pbmFsIGBlbHNlYDogdGhlcmUgaXQgcHJvZHVjZXMgYSBkdW1wIHdpdGggbm8gYHR5cGVgLCB0aGVcbiAgICAvLyBlZGl0b3IgZGVjb2RlcyBub3RoaW5nLCBhbmQgdGhlIGNhbGxlciBpcyB0b2xkIHRoZSB3cml0ZSBzdWNjZWVkZWQgKGlzc3VlICM2NikuXG4gICAgY29uc3QgdW5oYW5kbGVkV2FybmluZyA9IGRlc2NyaWJlVW5oYW5kbGVkUHJvcGVydHlUeXBlKHByb3BlcnR5VHlwZSwgcHJvY2Vzc2VkVmFsdWUpO1xuXG4gICAgLy8gRVZFUlkgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5VHlwZSBtdXN0IGxhbmQgaGVyZS4gRmFsbGluZyB0aHJvdWdoIHRvIHRoZSB0ZXJtaW5hbCBgZWxzZWBcbiAgICAvLyBzZW5kcyBhIGR1bXAgd2l0aCBubyBgdHlwZWAgZmllbGQg4oCUIHRoZSBzYW1lIHNoYXBlIHRoYXQgbWFrZXMgdGhlIG5vZGVBcnJheSBwYXRoIGZhaWxcbiAgICAvLyAoaXNzdWUgIzE4KSDigJQgc28gYW4gYWNjZXB0ZWQtYnV0LXR5cGVsZXNzIHByb3BlcnR5VHlwZSB3b3VsZCBzaWxlbnRseSBub3QgYXBwbHkuXG4gICAgLy8gQW4gZXhwbGljaXQgYHByb3BlcnR5VHlwZTogJ3N0cmluZydgIGlzIGF1dGhvcml0YXRpdmUg4oCUIGEgcHJvcGVydHktbmFtZSBzdWJzdHJpbmdcbiAgICAvLyBtdXN0IG5ldmVyIHJlLXJvdXRlIGl0IHRvIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIChpc3N1ZSAjNDY6IGBmaXJlQ2xpcE5hbWVgIHdhc1xuICAgIC8vIGNvZXJjZWQgdG8gYGNjLkF1ZGlvQ2xpcGAsIG51bGxpbmcgdGhlIGZpZWxkIGFuZCBkcm9wcGluZyBpdCBmcm9tIHRoZSBjb21wb25lbnQgZHVtcCkuXG4gICAgLy8gVGhlIG5hbWUtaGludCBoZXVyaXN0aWMgYXBwbGllcyBPTkxZIHRvIHRoZSBnZW5lcmljIGBhc3NldGAgc3BlbGxpbmcsIHdoaWNoIGNhcnJpZXNcbiAgICAvLyBubyB0eXBlIGluZm9ybWF0aW9uIG9mIGl0cyBvd24uXG4gICAgaWYgKChBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHByb3BlcnR5VHlwZSkgfHxcbiAgICAgICAgKHByb3BlcnR5VHlwZSA9PT0gJ2Fzc2V0JyAmJiBOQU1FX0hJTlRFRF9BU1NFVF9LRVlXT1JEUy5zb21lKGsgPT4gcHJvcGVydHkudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrKSkpKSB7XG5cbiAgICAgICAgY29uc3QgYXNzZXRUeXBlID0gcmVzb2x2ZUFzc2V0VHlwZShwcm9wZXJ0eVR5cGUsIHByb3BlcnR5KTtcblxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUsIHR5cGU6IGFzc2V0VHlwZSB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuVUlUcmFuc2Zvcm0nICYmIChwcm9wZXJ0eSA9PT0gJ19jb250ZW50U2l6ZScgfHwgcHJvcGVydHkgPT09ICdjb250ZW50U2l6ZScpKSB7XG4gICAgICAgIGNvbnN0IHdpZHRoID0gTnVtYmVyKHZhbHVlLndpZHRoKSB8fCAxMDA7XG4gICAgICAgIGNvbnN0IGhlaWdodCA9IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDEwMDtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0ud2lkdGhgLCBkdW1wOiB7IHZhbHVlOiB3aWR0aCB9XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS5oZWlnaHRgLCBkdW1wOiB7IHZhbHVlOiBoZWlnaHQgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyAmJiAocHJvcGVydHkgPT09ICdfYW5jaG9yUG9pbnQnIHx8IHByb3BlcnR5ID09PSAnYW5jaG9yUG9pbnQnKSkge1xuICAgICAgICBjb25zdCBhbmNob3JYID0gTnVtYmVyKHZhbHVlLngpIHx8IDAuNTtcbiAgICAgICAgY29uc3QgYW5jaG9yWSA9IE51bWJlcih2YWx1ZS55KSB8fCAwLjU7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvclhgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JYIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LmFuY2hvcllgLCBkdW1wOiB7IHZhbHVlOiBhbmNob3JZIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yVmFsdWUgPSB7XG4gICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5yKSB8fCAwKSksXG4gICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5nKSB8fCAwKSksXG4gICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5iKSB8fCAwKSksXG4gICAgICAgICAgICBhOiBwcm9jZXNzZWRWYWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihwcm9jZXNzZWRWYWx1ZS5hKSkpIDogMjU1XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yVmFsdWUsIHR5cGU6ICdjYy5Db2xvcicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAndmVjMycgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB4OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLnkpIHx8IDAsIHo6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS56KSB8fCAwIH0sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVR5cGUgPT09ICd2ZWMyJyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHg6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS54KSB8fCAwLCB5OiBOdW1iZXIocHJvY2Vzc2VkVmFsdWUueSkgfHwgMCB9LCB0eXBlOiAnY2MuVmVjMicgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnc2l6ZScgJiYgcHJvY2Vzc2VkVmFsdWUgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogeyB3aWR0aDogTnVtYmVyKHByb2Nlc3NlZFZhbHVlLndpZHRoKSB8fCAwLCBoZWlnaHQ6IE51bWJlcihwcm9jZXNzZWRWYWx1ZS5oZWlnaHQpIHx8IDAgfSwgdHlwZTogJ2NjLlNpemUnIH1cbiAgICAgICAgfSk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ25vZGUnICYmIHByb2Nlc3NlZFZhbHVlICYmIHR5cGVvZiBwcm9jZXNzZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIHByb2Nlc3NlZFZhbHVlKSB7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50JyAmJiBwcm9jZXNzZWRWYWx1ZSAmJiB0eXBlb2YgcHJvY2Vzc2VkVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBwcm9jZXNzZWRWYWx1ZSkge1xuICAgICAgICAvLyBJc3N1ZSAjNzU6IGNsZWFyaW5nIGEgY29tcG9uZW50IHJlZmVyZW5jZSAoYGNvbnZlcnRQcm9wZXJ0eVZhbHVlYCByZXR1cm5zXG4gICAgICAgIC8vIGB7IHV1aWQ6ICcnIH1gIGZvciBhIG51bGwvJycgaW5wdXQpIOKAlCB3cml0ZSBpdCBESVJFQ1RMWS4gVGhlcmUgaXMgbm8gdGFyZ2V0IHRvXG4gICAgICAgIC8vIHJlc29sdmUsIGFuZCByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlIHdvdWxkIG9ubHkgcmVwb3J0ICcnIGFzIG5laXRoZXIgYSBub2RlXG4gICAgICAgIC8vIHV1aWQgbm9yIGEgY29tcG9uZW50IHV1aWQuXG4gICAgICAgIGNvbnN0IGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IGF3YWl0IHJlc29sdmVFeHBlY3RlZENvbXBvbmVudFR5cGUobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBnZXRDb21wb25lbnRJbmZvKTtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHsgdXVpZDogJycgfSwgdHlwZTogZXhwZWN0ZWRDb21wb25lbnRUeXBlIHx8ICdjYy5Db21wb25lbnQnIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGFjdHVhbEV4cGVjdGVkVmFsdWUgPSB7IHV1aWQ6ICcnIH07XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudCcgJiYgdHlwZW9mIHByb2Nlc3NlZFZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgICAgICBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvY2Vzc2VkVmFsdWUsIGdldENvbXBvbmVudEluZm9cbiAgICAgICAgKTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnbm9kZUFycmF5JyAmJiBBcnJheS5pc0FycmF5KHByb2Nlc3NlZFZhbHVlKSkge1xuICAgICAgICAvLyBXaXRob3V0IGFuIGV4cGxpY2l0IHR5cGUvaXNBcnJheS9lbGVtZW50VHlwZURhdGEsIHRoZSBlZGl0b3IncyBzZXQtcHJvcGVydHlcbiAgICAgICAgLy8gZHVtcCBoYXMgbm8gd2F5IHRvIGtub3cgdGhpcyBpcyBhbiBhcnJheSBvZiBjYy5Ob2RlIHJlZmVyZW5jZXMg4oCUIGl0IGZhbGxzXG4gICAgICAgIC8vIHRocm91Z2ggYXMgYSBiYXJlIHZhbHVlIGFuZCBzaWxlbnRseSBkb2VzIG5vdCBhcHBseSAoaXNzdWUgIzE4KSwgdGhlIHNhbWVcbiAgICAgICAgLy8gZmFpbHVyZSBtb2RlIGFzIHRoZSBhc3NldC1yZWZlcmVuY2UgdHlwZXMgYmVmb3JlIHRoZXkgZ2FpbmVkIGFuIGV4cGxpY2l0XG4gICAgICAgIC8vIGB0eXBlYCBmaWVsZCAoc2VlIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIGFib3ZlKS5cbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLCB0eXBlOiAnY2MuTm9kZScsIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogJ2NjLk5vZGUnIH0gfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnYXNzZXRBcnJheScgJiYgQXJyYXkuaXNBcnJheShwcm9jZXNzZWRWYWx1ZSkpIHtcbiAgICAgICAgLy8gRXhwbGljaXQgYXJyYXkgZHVtcCB0eXBlZCB3aXRoIHRoZSBwcm9wZXJ0eSdzIERFQ0xBUkVEIGVsZW1lbnQgY2xhc3MuIEVhY2ggZWxlbWVudFxuICAgICAgICAvLyBtdXN0IGl0c2VsZiBiZSBhIGZ1bGwgZHVtcCBgeyB2YWx1ZTogeyB1dWlkIH0sIHR5cGUgfWAgKHRoZSBzaGFwZSBxdWVyeS1ub2RlIHJldHVybnMpOlxuICAgICAgICAvLyBhIGJhcmUgYHsgdXVpZCB9YCBlbGVtZW50IG1ha2VzIHRoZSBlZGl0b3IgdGhyb3cgXCJDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mXG4gICAgICAgIC8vIHVuZGVmaW5lZCAocmVhZGluZyAnaGFzT3duUHJvcGVydHknKVwiIHdoaWxlIGRlY29kaW5nIHRoZSBhcnJheS5cbiAgICAgICAgY29uc3QgZWxlbWVudFR5cGUgPSBhd2FpdCByZXNvbHZlRGVjbGFyZWRBc3NldEVsZW1lbnRUeXBlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgZ2V0Q29tcG9uZW50SW5mbyk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsXG4gICAgICAgICAgICBkdW1wOiB7XG4gICAgICAgICAgICAgICAgdmFsdWU6IHByb2Nlc3NlZFZhbHVlLm1hcCgocmVmOiBhbnkpID0+ICh7IHZhbHVlOiByZWYsIHR5cGU6IGVsZW1lbnRUeXBlIH0pKSxcbiAgICAgICAgICAgICAgICB0eXBlOiBlbGVtZW50VHlwZSwgaXNBcnJheTogdHJ1ZSxcbiAgICAgICAgICAgICAgICBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IHsgdXVpZDogJycgfSwgdHlwZTogZWxlbWVudFR5cGUgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50QXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBhd2FpdCBhcHBseUNvbXBvbmVudFJlZmVyZW5jZUFycmF5KFxuICAgICAgICAgICAgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb2Nlc3NlZFZhbHVlLCBnZXRDb21wb25lbnRJbmZvXG4gICAgICAgICk7XG5cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbG9yQXJyYXknICYmIEFycmF5LmlzQXJyYXkocHJvY2Vzc2VkVmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IGNvbG9yQXJyYXlWYWx1ZSA9IHByb2Nlc3NlZFZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAoaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ3InIGluIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgfSk7XG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLCBwYXRoOiBwcm9wZXJ0eVBhdGgsIGR1bXA6IHsgdmFsdWU6IGNvbG9yQXJyYXlWYWx1ZSwgdHlwZTogJ2NjLkNvbG9yJyB9XG4gICAgICAgIH0pO1xuXG4gICAgfSBlbHNlIGlmICh1bmhhbmRsZWRXYXJuaW5nKSB7XG4gICAgICAgIC8vIElzc3VlICM2NjogdGhlIHByb3BlcnR5VHlwZSBpcyBpbiBTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMsIHNvIGBjb252ZXJ0UHJvcGVydHlWYWx1ZWBcbiAgICAgICAgLy8gYWNjZXB0ZWQgaXQsIGJ1dCBOTyBicmFuY2ggYWJvdmUgaGFuZGxlcyBpdCDigJQgc28gdGhlIGR1bXAgd291bGQgZ28gb3V0IHdpdGggbm8gYHR5cGVgLFxuICAgICAgICAvLyB0aGUgZWRpdG9yIGRlY29kZXMgbm90aGluZywgYW5kIHRoZSB3cml0ZSBpcyBhIHNpbGVudCBuby1vcC4gYGNoYW5nZVZlcmlmaWVkYCByZWFkaW5nXG4gICAgICAgIC8vIGZhbHNlIGlzIG5vdCBhIHJlc2N1ZTogYSBjYWxsZXIgdGhhdCB0cnVzdHMgYSBgc3VjY2Vzczp0cnVlYCByZXNwb25zZSBzaGlwcyBhblxuICAgICAgICAvLyB1bmF1dGhvcmVkIHZhbHVlLCB3aGljaCBpcyBleGFjdGx5IGhvdyBhIGBjYy5SZWFsQ3VydmVgIHNwbGluZSBjYW1lIGJhY2sgYXMgdGhlXG4gICAgICAgIC8vIHVudG91Y2hlZCAyLXBvaW50IGRlZmF1bHQgKGlzc3VlICM2NikuIFJlZnVzZSB0aGUgd3JpdGUgaW5zdGVhZCBvZiBwZXJmb3JtaW5nIG9uZVxuICAgICAgICAvLyB0aGF0IGNhbm5vdCB3b3JrLCBhbmQgbmFtZSB3aGVyZSB0aGUgYXJyYXktb2Ytb2JqZWN0IGNhc2VzIGJlbG9uZy5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKHVuaGFuZGxlZFdhcm5pbmcpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCwgZHVtcDogeyB2YWx1ZTogcHJvY2Vzc2VkVmFsdWUgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gYWN0dWFsRXhwZWN0ZWRWYWx1ZTtcbn1cblxuLyoqXG4gKiBUcmVhdCAnVW5rbm93bicgYXMgbWlzc2luZyDigJQgaXQgYXBwZWFycyB3aGVuIGEgcHJldmlvdXMgYXNzaWdubWVudCBzdG9yZWQgYSB2YWx1ZVxuICogd2hvc2UgcnVudGltZSB0eXBlIGRpZG4ndCBtYXRjaCB0aGUgQHByb3BlcnR5IGRlY2xhcmVkIHR5cGUsIGxlYXZpbmcgdGhlIGR1bXAnc1xuICogdHlwZSBmaWVsZCBzdGFsZS5cbiAqL1xuZnVuY3Rpb24gaXNVc2FibGVUeXBlKHQ6IGFueSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0eXBlb2YgdCA9PT0gJ3N0cmluZycgJiYgdC5sZW5ndGggPiAwICYmIHQgIT09ICdVbmtub3duJztcbn1cblxuLyoqXG4gKiBSZXNvbHZlIHRoZSBERUNMQVJFRCBlbGVtZW50IGNsYXNzIG9mIGFuIGFzc2V0LWFycmF5IEBwcm9wZXJ0eSAoZS5nLiBgY2MuQXVkaW9DbGlwYCBmb3JcbiAqIGBAcHJvcGVydHkoeyB0eXBlOiBbQXVkaW9DbGlwXSB9KWApIGZyb20gdGhlIGhvbGRlciBjb21wb25lbnQncyBkdW1wLiBQcmVmZXJzXG4gKiBgZWxlbWVudFR5cGVEYXRhLnR5cGVgLCB0aGVuIHRoZSBhcnJheSBkdW1wJ3Mgb3duIGB0eXBlYDsgZmFsbHMgYmFjayB0byBgY2MuQXNzZXRgIHdoZW5cbiAqIG5laXRoZXIgaXMgcmVhZGFibGUuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVEZWNsYXJlZEFzc2V0RWxlbWVudFR5cGUoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IGluZm8gPSBhd2FpdCBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICBsZXQgbWV0YTogYW55ID0gaW5mby5zdWNjZXNzID8gaW5mby5kYXRhPy5wcm9wZXJ0aWVzIDogdW5kZWZpbmVkO1xuICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aCAmJiBtZXRhOyBpKyspIHtcbiAgICAgICAgbWV0YSA9IG1ldGFbc2VnbWVudHNbaV1dO1xuICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuICAgICAgICBpZiAoIWlzTGVhZiAmJiBtZXRhICYmIHR5cGVvZiBtZXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIG1ldGEgJiYgdHlwZW9mIG1ldGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBtZXRhID0gbWV0YS52YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAobWV0YSAmJiB0eXBlb2YgbWV0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgaWYgKGlzVXNhYmxlVHlwZShtZXRhLmVsZW1lbnRUeXBlRGF0YT8udHlwZSkpIHJldHVybiBtZXRhLmVsZW1lbnRUeXBlRGF0YS50eXBlO1xuICAgICAgICBpZiAoaXNVc2FibGVUeXBlKG1ldGEudHlwZSkpIHJldHVybiBtZXRhLnR5cGU7XG4gICAgfVxuICAgIHJldHVybiAnY2MuQXNzZXQnO1xufVxuXG4vKipcbiAqIFJlc29sdmUgdGhlIERFQ0xBUkVEIHR5cGUgb2YgYSBgY29tcG9uZW50YC9gY29tcG9uZW50QXJyYXlgIEBwcm9wZXJ0eSBmcm9tIHRoZSBob2xkZXJcbiAqIGNvbXBvbmVudCdzIG93biBkdW1wLiBFeHRyYWN0ZWQgZnJvbSBgcmVzb2x2ZUNvbXBvbmVudFJlZmVyZW5jZWAgc28gYSByZWZlcmVuY2UgQ0xFQVJcbiAqIChpc3N1ZSAjNzUsIGB7IHV1aWQ6ICcnIH1gKSBjYW4gZ2V0IHRoZSB0eXBlIGl0IG5lZWRzIGZvciB0aGUgYHNldC1wcm9wZXJ0eWAgZHVtcFxuICogd2l0aG91dCBnb2luZyB0aHJvdWdoIHRoYXQgZnVuY3Rpb24ncyBUQVJHRVQgcmVzb2x1dGlvbiDigJQgdGhlcmUgaXMgbm90aGluZyB0byByZXNvbHZlXG4gKiBmb3IgYW4gZW1wdHkgdGFyZ2V0LCBhbmQgaXQgd291bGQgb25seSBmYWlsIHRyeWluZy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUV4cGVjdGVkQ29tcG9uZW50VHlwZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgY3VycmVudENvbXBvbmVudEluZm8gPSBhd2FpdCBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICAvLyBXYWxrIGRvdHRlZCBwcm9wZXJ0eSBwYXRocyB0aHJvdWdoIG5lc3RlZCBDQ0NsYXNzIGdyb3VwIGR1bXBzIHRvIGZpbmQgdGhlIG1ldGFkYXRhIGRlc2NyaXB0b3IuXG4gICAgbGV0IHByb3BlcnR5TWV0YTogYW55ID0gY3VycmVudENvbXBvbmVudEluZm8uc3VjY2VzcyA/IGN1cnJlbnRDb21wb25lbnRJbmZvLmRhdGE/LnByb3BlcnRpZXMgOiB1bmRlZmluZWQ7XG4gICAgaWYgKHByb3BlcnR5TWV0YSkge1xuICAgICAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5LnNwbGl0KCcuJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoICYmIHByb3BlcnR5TWV0YTsgaSsrKSB7XG4gICAgICAgICAgICBwcm9wZXJ0eU1ldGEgPSBwcm9wZXJ0eU1ldGFbc2VnbWVudHNbaV1dO1xuICAgICAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgIGlmICghaXNMZWFmICYmIHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5TWV0YSAmJiB0eXBlb2YgcHJvcGVydHlNZXRhLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5TWV0YSA9IHByb3BlcnR5TWV0YS52YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxldCBleHBlY3RlZENvbXBvbmVudFR5cGUgPSAnJztcbiAgICBpZiAocHJvcGVydHlNZXRhICYmIHR5cGVvZiBwcm9wZXJ0eU1ldGEgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGlmIChpc1VzYWJsZVR5cGUocHJvcGVydHlNZXRhLnR5cGUpKSB7XG4gICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBwcm9wZXJ0eU1ldGEudHlwZTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1VzYWJsZVR5cGUocHJvcGVydHlNZXRhLmN0b3IpKSB7XG4gICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBwcm9wZXJ0eU1ldGEuY3RvcjtcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU1ldGEuZXh0ZW5kcyAmJiBBcnJheS5pc0FycmF5KHByb3BlcnR5TWV0YS5leHRlbmRzKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBleHRlbmRUeXBlIG9mIHByb3BlcnR5TWV0YS5leHRlbmRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGV4dGVuZFR5cGUuc3RhcnRzV2l0aCgnY2MuJykgJiYgZXh0ZW5kVHlwZSAhPT0gJ2NjLkNvbXBvbmVudCcgJiYgZXh0ZW5kVHlwZSAhPT0gJ2NjLk9iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRDb21wb25lbnRUeXBlID0gZXh0ZW5kVHlwZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBleHBlY3RlZENvbXBvbmVudFR5cGU7XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhIHRhcmdldCBub2RlJ3MgY29tcG9uZW50IHJlZmVyZW5jZSB0byBpdHMgc2NlbmUgY29tcG9uZW50IGlkLCBXSVRIT1VUXG4gKiBwZXJmb3JtaW5nIHRoZSBgc2V0LXByb3BlcnR5YCB3cml0ZS4gU2hhcmVkIGJ5IHRoZSBzaW5nbGUtYGNvbXBvbmVudGAgcHJvcGVydHlUeXBlXG4gKiAod2hpY2ggd3JpdGVzIG9uZSBgeyB1dWlkIH1gIHZhbHVlKSBhbmQgdGhlIGBjb21wb25lbnRBcnJheWAgcHJvcGVydHlUeXBlICh3aGljaFxuICogd3JpdGVzIGEgd2hvbGUgYXJyYXkgaW4gb25lIHNldC1wcm9wZXJ0eSBjYWxsLCBzbyBwZXItZWxlbWVudCB3cml0ZXMgbXVzdCBub3QgaGFwcGVuXG4gKiBoZXJlIOKAlCBpc3N1ZSAjMTgpLlxuICovXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlQ29tcG9uZW50UmVmZXJlbmNlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgdGFyZ2V0Tm9kZVV1aWQ6IHN0cmluZyxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHsgY29tcG9uZW50SWQ6IHN0cmluZzsgZXhwZWN0ZWRDb21wb25lbnRUeXBlOiBzdHJpbmcgfT4ge1xuICAgIGNvbnNvbGUubG9nKGBbTWFuYWdlQ29tcG9uZW50XSBTZXR0aW5nIGNvbXBvbmVudCByZWZlcmVuY2UgLSBmaW5kaW5nIGNvbXBvbmVudCBvbiBub2RlOiAke3RhcmdldE5vZGVVdWlkfWApO1xuXG4gICAgbGV0IGV4cGVjdGVkQ29tcG9uZW50VHlwZSA9IGF3YWl0IHJlc29sdmVFeHBlY3RlZENvbXBvbmVudFR5cGUobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBnZXRDb21wb25lbnRJbmZvKTtcblxuICAgIC8vIGBxdWVyeS1ub2RlYCBSRUpFQ1RTIG9uIHNvbWUgZWRpdG9yIGJ1aWxkcyBhbmQgcmVzb2x2ZXMgZmFsc3kgb24gb3RoZXJzOyBib3RoIG1lYW5cbiAgICAvLyB0aGUgc2FtZSB0aGluZyBoZXJlIOKAlCB0aGUgdmFsdWUgaXMgbm90IGEgbm9kZSB1dWlkLlxuICAgIGxldCB0YXJnZXROb2RlRGF0YTogYW55ID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgICB0YXJnZXROb2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB0YXJnZXROb2RlVXVpZCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHRhcmdldE5vZGVEYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAoIXRhcmdldE5vZGVEYXRhIHx8ICF0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgLy8gVGhlIGNhbGxlciBtYXkgaGF2ZSBwYXNzZWQgdGhlIENPTVBPTkVOVCdzIG93biB1dWlkIOKAlCB0aGUgYHV1aWRgIGZpZWxkIHRoYXRcbiAgICAgICAgLy8gbWFuYWdlX2NvbXBvbmVudCBnZXRfYWxsIC8gZ2V0X2luZm8gcmV0dXJuLCBhbmQgdGhlIG9idmlvdXMgdGhpbmcgdG8gcmVhY2ggZm9yXG4gICAgICAgIC8vIHdoZW4gd2lyaW5nIGEgQHByb3BlcnR5KFNvbWVDb21wb25lbnQpIHJlZmVyZW5jZS4gQWNjZXB0IHRoYXQgc3BlbGxpbmcgaW5zdGVhZFxuICAgICAgICAvLyBvZiByZXBvcnRpbmcgYSBjb3JyZWN0IHV1aWQgYXMgYSBtaXNzaW5nIG5vZGUuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIFJlc29sdmUtb25seSwgZXhhY3RseSBsaWtlIHRoZSBub2RlIHBhdGggYmVsb3cg4oCUIHRoaXMgZnVuY3Rpb24gaGFzIG5vXG4gICAgICAgIC8vIGBwcm9wZXJ0eVBhdGhgIGFuZCBtdXN0IG5ldmVyIHdyaXRlLiBUaGUgY2FsbGVyIChhcHBseUNvbXBvbmVudFJlZmVyZW5jZSBmb3IgYVxuICAgICAgICAvLyBzaW5nbGUgcmVmZXJlbmNlLCBhcHBseUNvbXBvbmVudFJlZmVyZW5jZUFycmF5IGZvciBhbiBhcnJheSkgcGVyZm9ybXMgdGhlIE9ORVxuICAgICAgICAvLyBzZXQtcHJvcGVydHkgd3JpdGU7IGEgd3JpdGUgaGVyZSB3b3VsZCBmaXJlIG9uY2UgcGVyIGVsZW1lbnQgb24gYSBjb21wb25lbnRBcnJheVxuICAgICAgICAvLyAoaXNzdWUgIzE4KS5cbiAgICAgICAgY29uc3QgZGlyZWN0ID0gYXdhaXQgcXVlcnlDb21wb25lbnRCeVV1aWQodGFyZ2V0Tm9kZVV1aWQpO1xuICAgICAgICBpZiAoIWRpcmVjdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIGAnJHt0YXJnZXROb2RlVXVpZH0nIGlzIG5laXRoZXIgYSBub2RlIHV1aWQgbm9yIGEgY29tcG9uZW50IHV1aWQuIGAgK1xuICAgICAgICAgICAgICAgIGBQYXNzIHRoZSB1dWlkIG9mIHRoZSBOT0RFIHRoYXQgaG9sZHMgdGhlIGNvbXBvbmVudCwgb3IgdGhlIGNvbXBvbmVudCdzIG93biBgICtcbiAgICAgICAgICAgICAgICBgdXVpZCBmcm9tIG1hbmFnZV9jb21wb25lbnQgYWN0aW9uPWdldF9hbGwuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRpcmVjdFR5cGUgPSBleHBlY3RlZENvbXBvbmVudFR5cGUgfHwgZGlyZWN0LnR5cGU7XG4gICAgICAgIGlmICghZGlyZWN0VHlwZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZGV0ZXJtaW5lIHJlcXVpcmVkIGNvbXBvbmVudCB0eXBlIGZvciBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIFByb3BlcnR5IG1ldGFkYXRhIG1heSBub3QgY29udGFpbiB0eXBlIGluZm9ybWF0aW9uLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIG5vZGUgcGF0aCBiZWxvdyBvbmx5IGV2ZXIgcmVzb2x2ZXMgYSBjb21wb25lbnQgd2hvc2UgdHlwZSBFWEFDVExZIG1hdGNoZXNcbiAgICAgICAgLy8gZXhwZWN0ZWRDb21wb25lbnRUeXBlIChpdHMgc2VhcmNoIGxvb3AgcmVqZWN0cyBhbnl0aGluZyBlbHNlKS4gYGV4cGVjdGVkQ29tcG9uZW50VHlwZVxuICAgICAgICAvLyB8fCBkaXJlY3QudHlwZWAgb25seSBmYWxscyBiYWNrIHRvIGRpcmVjdC50eXBlIHdoZW4gZXhwZWN0ZWRDb21wb25lbnRUeXBlIGlzIGVtcHR5O1xuICAgICAgICAvLyBpdCBuZXZlciB2YWxpZGF0ZWQgdGhlIHR3byBhZ2FpbnN0IGVhY2ggb3RoZXIgd2hlbiBleHBlY3RlZENvbXBvbmVudFR5cGUgV0FTIGtub3duLFxuICAgICAgICAvLyBsZXR0aW5nIGEgbWlzbWF0Y2hlZCBjb21wb25lbnQgKGUuZy4gYSBjYy5TcHJpdGUgdXVpZCBvbiBhIHByb3BlcnR5IHR5cGVkXG4gICAgICAgIC8vIEhlcm9EcmFnQ29udHJvbGxlcikgcmVzb2x2ZSB1bnJlamVjdGVkLiBBIGRpcmVjdC50eXBlIHRoYXQgaXMgaXRzZWxmIHVudXNhYmxlXG4gICAgICAgIC8vICgnVW5rbm93bicvYmxhbmspIGNhbm5vdCBkaXNwcm92ZSBhIG1hdGNoLCBzbyBpdCBpcyBsZWZ0IHRvIGZhbGwgdGhyb3VnaC5cbiAgICAgICAgaWYgKGV4cGVjdGVkQ29tcG9uZW50VHlwZSAmJiBpc1VzYWJsZVR5cGUoZGlyZWN0LnR5cGUpICYmIGRpcmVjdC50eXBlICE9PSBleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIC8vIElzc3VlICM4MTogdGhlIHNhbWUgcG9seW1vcnBoaWMgZ2FwIGlzc3VlICM0NSBmaXhlZCBvbiB0aGUgbm9kZS11dWlkIHBhdGhcbiAgICAgICAgICAgIC8vIGJlbG93IOKAlCBleHBlY3RlZENvbXBvbmVudFR5cGUgbWF5IGJlIGEgQkFTRSBjbGFzcyB3aGlsZSBkaXJlY3QudHlwZSBpcyBhXG4gICAgICAgICAgICAvLyBTVUJDTEFTUy4gQSBsaXRlcmFsIHN0cmluZyBtaXNtYXRjaCBjYW4ndCBkaXNwcm92ZSB0aGF0OyBhc2sgdGhlIGxpdmVcbiAgICAgICAgICAgIC8vIGNsYXNzIHJlZ2lzdHJ5IGJlZm9yZSByZWplY3RpbmcgYSBjb21wb25lbnQgdGhhdCB3b3VsZCBhY3R1YWxseSBzYXRpc2Z5XG4gICAgICAgICAgICAvLyB0aGUgZGVjbGFyZWQgcHJvcGVydHkgdHlwZS5cbiAgICAgICAgICAgIGxldCBpc1N1YmNsYXNzID0gZmFsc2U7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1YmNsYXNzUmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdpc0NvbXBvbmVudFR5cGVTdWJjbGFzc09mJywgYXJnczogW2RpcmVjdC50eXBlLCBleHBlY3RlZENvbXBvbmVudFR5cGVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaXNTdWJjbGFzcyA9ICEhKHN1YmNsYXNzUmVzdWx0ICYmIHN1YmNsYXNzUmVzdWx0LnN1Y2Nlc3MgJiYgc3ViY2xhc3NSZXN1bHQuZGF0YSAmJiBzdWJjbGFzc1Jlc3VsdC5kYXRhLmlzU3ViY2xhc3MpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgaXNTdWJjbGFzcyA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIWlzU3ViY2xhc3MpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgdXVpZCAnJHt0YXJnZXROb2RlVXVpZH0nIGlzIGEgJyR7ZGlyZWN0LnR5cGV9JywgYnV0IHByb3BlcnR5ICcke3Byb3BlcnR5fScgYCArXG4gICAgICAgICAgICAgICAgICAgIGBvbiAnJHtjb21wb25lbnRUeXBlfScgcmVxdWlyZXMgYSAnJHtleHBlY3RlZENvbXBvbmVudFR5cGV9Jy5gXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGNvbXBvbmVudElkOiBkaXJlY3QudXVpZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlOiBkaXJlY3RUeXBlIH07XG4gICAgfVxuXG4gICAgLy8gU2luZ2xlLWNjLWNvbXBvbmVudCBmYWxsYmFjazogd2hlbiBleHBlY3RlZENvbXBvbmVudFR5cGUgY291bGQgbm90IGJlIGluZmVycmVkXG4gICAgLy8gKGUuZy4sIHN0YWxlICdVbmtub3duJyBpbiBkdW1wIGFuZCBleHRlbmRzIG9ubHkgbGlzdHMgY2MuQ29tcG9uZW50L2NjLk9iamVjdCksXG4gICAgLy8gYW5kIHRoZSB0YXJnZXQgbm9kZSBoYXMgZXhhY3RseSBvbmUgY2MuKiBjb21wb25lbnQsIHVzZSBpdC4gTWlycm9ycyBDb2NvcydzXG4gICAgLy8gZHJhZy1mcm9tLWhpZXJhcmNoeSBhdXRvLXJlc29sdmUgYmVoYXZpb3IuXG4gICAgaWYgKCFleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgY29uc3QgY2NDb21wcyA9ICh0YXJnZXROb2RlRGF0YS5fX2NvbXBzX18gYXMgYW55W10pXG4gICAgICAgICAgICAuZmlsdGVyKGMgPT4gdHlwZW9mIGMudHlwZSA9PT0gJ3N0cmluZycgJiYgYy50eXBlLnN0YXJ0c1dpdGgoJ2NjLicpXG4gICAgICAgICAgICAgICAgJiYgYy50eXBlICE9PSAnY2MuQ29tcG9uZW50JyAmJiBjLnR5cGUgIT09ICdjYy5PYmplY3QnKTtcbiAgICAgICAgaWYgKGNjQ29tcHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICBleHBlY3RlZENvbXBvbmVudFR5cGUgPSBjY0NvbXBzWzBdLnR5cGU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWV4cGVjdGVkQ29tcG9uZW50VHlwZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBkZXRlcm1pbmUgcmVxdWlyZWQgY29tcG9uZW50IHR5cGUgZm9yIHByb3BlcnR5ICcke3Byb3BlcnR5fScgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gUHJvcGVydHkgbWV0YWRhdGEgbWF5IG5vdCBjb250YWluIHR5cGUgaW5mb3JtYXRpb24uYCk7XG4gICAgfVxuXG4gICAgbGV0IGNvbXBvbmVudElkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgZm91bmRDb21wb25lbnQgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFyZ2V0Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNvbXAgPSB0YXJnZXROb2RlRGF0YS5fX2NvbXBzX19baV0gYXMgYW55O1xuICAgICAgICBpZiAoY29tcC50eXBlID09PSBleHBlY3RlZENvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIGZvdW5kQ29tcG9uZW50ID0gY29tcDtcbiAgICAgICAgICAgIGlmIChjb21wLnZhbHVlICYmIGNvbXAudmFsdWUudXVpZCAmJiBjb21wLnZhbHVlLnV1aWQudmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRJZCA9IGNvbXAudmFsdWUudXVpZC52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZXh0cmFjdCBjb21wb25lbnQgSUQgZnJvbSBjb21wb25lbnQgc3RydWN0dXJlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZm91bmRDb21wb25lbnQpIHtcbiAgICAgICAgLy8gSXNzdWUgIzQ1OiBleHBlY3RlZENvbXBvbmVudFR5cGUgbWF5IGJlIGEgQkFTRSBjbGFzcyAoZGVjbGFyZWQgb24gdGhlXG4gICAgICAgIC8vIEBwcm9wZXJ0eSkgd2hpbGUgZXZlcnkgY29tcG9uZW50IGFjdHVhbGx5IG9uIHRoZSBub2RlIGlzIGEgU1VCQ0xBU1Mg4oCUIGFuXG4gICAgICAgIC8vIGV4YWN0IHN0cmluZyBtYXRjaCBhZ2FpbnN0IGNvbXAudHlwZSBjYW4gbmV2ZXIgc3VjY2VlZCBmb3IgYSBwb2x5bW9ycGhpY1xuICAgICAgICAvLyByZWZlcmVuY2UsIGV2ZW4gdGhvdWdoIHRoZSBlbmdpbmUncyBvd24gbm9kZS5nZXRDb21wb25lbnQoQmFzZUNsYXNzKSBhbHJlYWR5XG4gICAgICAgIC8vIHJlc29sdmVzIHN1YmNsYXNzIGluc3RhbmNlcy4gRmFsbCBiYWNrIHRvIHRoYXQgbGl2ZS1zY2VuZSwgaW5oZXJpdGFuY2UtYXdhcmVcbiAgICAgICAgLy8gbG9va3VwIGJlZm9yZSBnaXZpbmcgdXAuXG4gICAgICAgIGxldCBiYXNlQ2xhc3NSZXN1bHQ6IGFueSA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBiYXNlQ2xhc3NSZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2ZpbmRDb21wb25lbnRCeUJhc2VDbGFzcycsIGFyZ3M6IFt0YXJnZXROb2RlVXVpZCwgZXhwZWN0ZWRDb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgYmFzZUNsYXNzUmVzdWx0ID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYmFzZUNsYXNzUmVzdWx0ICYmIGJhc2VDbGFzc1Jlc3VsdC5zdWNjZXNzICYmIGJhc2VDbGFzc1Jlc3VsdC5kYXRhICYmIGJhc2VDbGFzc1Jlc3VsdC5kYXRhLmNvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7IGNvbXBvbmVudElkOiBiYXNlQ2xhc3NSZXN1bHQuZGF0YS5jb21wb25lbnRVdWlkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGF2YWlsYWJsZSA9IHRhcmdldE5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2NlbmVJZCA9IGNvbXAudmFsdWUgJiYgY29tcC52YWx1ZS51dWlkICYmIGNvbXAudmFsdWUudXVpZC52YWx1ZSA/IGNvbXAudmFsdWUudXVpZC52YWx1ZSA6ICd1bmtub3duJztcbiAgICAgICAgICAgIHJldHVybiBgJHtjb21wLnR5cGV9KHNjZW5lX2lkOiR7c2NlbmVJZH0pYDtcbiAgICAgICAgfSk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50IHR5cGUgJyR7ZXhwZWN0ZWRDb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGUgJHt0YXJnZXROb2RlVXVpZH0uIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2F2YWlsYWJsZS5qb2luKCcsICcpfWApO1xuICAgIH1cblxuICAgIGlmICghY29tcG9uZW50SWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmFibGUgdG8gZXh0cmFjdCBjb21wb25lbnQgSUQgZnJvbSBjb21wb25lbnQgc3RydWN0dXJlYCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgY29tcG9uZW50SWQsIGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9O1xufVxuXG4vKiogUmVzb2x2ZSBhIGNvbXBvbmVudCByZWZlcmVuY2UgYW5kIHdyaXRlIGl0IGFzIGEgc2luZ2xlIGB7IHV1aWQgfWAgdmFsdWUuICovXG5hc3luYyBmdW5jdGlvbiBhcHBseUNvbXBvbmVudFJlZmVyZW5jZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB7IGNvbXBvbmVudElkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfSA9IGF3YWl0IHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdGFyZ2V0Tm9kZVV1aWQsIGdldENvbXBvbmVudEluZm9cbiAgICApO1xuXG4gICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICBkdW1wOiB7IHZhbHVlOiB7IHV1aWQ6IGNvbXBvbmVudElkIH0sIHR5cGU6IGV4cGVjdGVkQ29tcG9uZW50VHlwZSB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyB1dWlkOiBjb21wb25lbnRJZCB9O1xufVxuXG4vKipcbiAqIFJlc29sdmUgYW4gYXJyYXkgb2YgdGFyZ2V0LW5vZGUgVVVJRHMgdG8gdGhlaXIgY29tcG9uZW50IHJlZmVyZW5jZXMgYW5kIHdyaXRlIHRoZVxuICogd2hvbGUgYXJyYXkgaW4gT05FIHNldC1wcm9wZXJ0eSBjYWxsIChtYXRjaGluZyB0aGUgbm9kZUFycmF5IGZpeCBhYm92ZSDigJQgYW4gYXJyYXlcbiAqIHByb3BlcnR5IG5lZWRzIGBpc0FycmF5YC9gZWxlbWVudFR5cGVEYXRhYCBpbiB0aGUgZHVtcCwgbm90IE4gc2VwYXJhdGUgc2NhbGFyIHdyaXRlcykuXG4gKiBBbiBlbXB0eSBpbnB1dCBhcnJheSBpcyBndWFyZGVkIGV4cGxpY2l0bHk6IHRoZXJlIGlzIG5vIGVsZW1lbnQgdG8gcmVzb2x2ZSBhXG4gKiBjb21wb25lbnQgdHlwZSBmcm9tLCBzbyBpdCBpcyB3cml0dGVuIGFzIGFuIGVtcHR5IGFycmF5IHdpdGggYSBnZW5lcmljIGVsZW1lbnQgdHlwZVxuICogcmF0aGVyIHRoYW4gaW5kZXhpbmcgaW50byBhbiBhcnJheSB0aGF0IGhhcyBubyBgWzBdYC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gYXBwbHlDb21wb25lbnRSZWZlcmVuY2VBcnJheShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIHByb3BlcnR5UGF0aDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIHRhcmdldE5vZGVVdWlkczogYW55W10sXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTxhbnk+IHtcbiAgICBpZiAodGFyZ2V0Tm9kZVV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICB1dWlkOiBub2RlVXVpZCwgcGF0aDogcHJvcGVydHlQYXRoLFxuICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogW10sIGlzQXJyYXk6IHRydWUsIGVsZW1lbnRUeXBlRGF0YTogeyB2YWx1ZTogbnVsbCwgdHlwZTogJ2NjLkNvbXBvbmVudCcgfSB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgcmVzb2x2ZWRSZWZzOiBBcnJheTx7IHV1aWQ6IHN0cmluZyB9PiA9IFtdO1xuICAgIGxldCBlbGVtZW50VHlwZSA9ICcnO1xuICAgIGZvciAoY29uc3QgdGFyZ2V0Tm9kZVV1aWQgb2YgdGFyZ2V0Tm9kZVV1aWRzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0Tm9kZVV1aWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NvbXBvbmVudEFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIG5vZGUgVVVJRHMgKGVhY2ggY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCknKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB7IGNvbXBvbmVudElkLCBleHBlY3RlZENvbXBvbmVudFR5cGUgfSA9IGF3YWl0IHJlc29sdmVDb21wb25lbnRSZWZlcmVuY2UoXG4gICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHRhcmdldE5vZGVVdWlkLCBnZXRDb21wb25lbnRJbmZvXG4gICAgICAgICk7XG4gICAgICAgIHJlc29sdmVkUmVmcy5wdXNoKHsgdXVpZDogY29tcG9uZW50SWQgfSk7XG4gICAgICAgIGVsZW1lbnRUeXBlID0gZWxlbWVudFR5cGUgfHwgZXhwZWN0ZWRDb21wb25lbnRUeXBlO1xuICAgIH1cblxuICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgdXVpZDogbm9kZVV1aWQsIHBhdGg6IHByb3BlcnR5UGF0aCxcbiAgICAgICAgZHVtcDogeyB2YWx1ZTogcmVzb2x2ZWRSZWZzLCBpc0FycmF5OiB0cnVlLCBlbGVtZW50VHlwZURhdGE6IHsgdmFsdWU6IG51bGwsIHR5cGU6IGVsZW1lbnRUeXBlIH0gfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc29sdmVkUmVmcztcbn1cblxuLyoqXG4gKiBMb29rIGEgdXVpZCB1cCBhcyBhIENPTVBPTkVOVCByYXRoZXIgdGhhbiBhIG5vZGUuXG4gKlxuICogYHF1ZXJ5LWNvbXBvbmVudGAgYW5zd2VycyBmb3IgYSBjb21wb25lbnQncyBvd24gdXVpZCBhbmQgcmV0dXJucyB0aGUgc2FtZSBkdW1wIHNoYXBlIGFzXG4gKiBvbmUgYF9fY29tcHNfX2AgZW50cnksIHNvIGB2YWx1ZS51dWlkLnZhbHVlYCBhbmQgYHR5cGVgIHJlYWQgZXhhY3RseSBhcyB0aGV5IGRvIG9uIHRoZVxuICogbm9kZSBwYXRoLiBSZXR1cm5zIG51bGwgZm9yIGFueXRoaW5nIHRoYXQgaXMgbm90IGEgbGl2ZSBjb21wb25lbnQg4oCUIGluY2x1ZGluZyBhIHV1aWRcbiAqIHRoYXQgbmFtZXMgbm90aGluZyBhdCBhbGwg4oCUIHNvIHRoZSBjYWxsZXIgY2FuIHJlcG9ydCBib3RoIGFjY2VwdGVkIHNwZWxsaW5ncy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcXVlcnlDb21wb25lbnRCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTx7IHV1aWQ6IHN0cmluZzsgdHlwZTogc3RyaW5nIH0gfCBudWxsPiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tcDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktY29tcG9uZW50JywgdXVpZCk7XG4gICAgICAgIGlmICghY29tcCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcmVzb2x2ZWRVdWlkID0gY29tcC52YWx1ZT8udXVpZD8udmFsdWUgfHwgY29tcC51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQgfHwgdXVpZDtcbiAgICAgICAgY29uc3QgdHlwZSA9IGNvbXAudHlwZSB8fCBjb21wLmNpZCB8fCBjb21wLl9fdHlwZV9fIHx8ICcnO1xuICAgICAgICByZXR1cm4geyB1dWlkOiByZXNvbHZlZFV1aWQsIHR5cGUgfTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuIl19