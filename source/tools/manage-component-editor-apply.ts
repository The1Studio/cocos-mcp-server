/**
 * Editor API calls for applying component property values.
 * Extracted from ManageComponent.setComponentProperty (Step 6).
 * Each property type uses a different dump format for Editor.Message.request('scene', 'set-property').
 */

import { ActionToolResult } from '../types';
import { ASSET_REFERENCE_PROPERTY_TYPES, ASSET_TYPE_BY_PROPERTY_TYPE } from './manage-component-property-helpers';

/** Property-name substrings that mark a bare `string` value as an asset reference. */
const NAME_HINTED_ASSET_KEYWORDS = ['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'];

/**
 * Resolve the Cocos asset class for the Editor `set-property` dump `type` field.
 *
 * An explicit propertyType (`material`, `mesh`, …) wins, because it is authoritative.
 * Only the generic `asset` / `string` spellings — which carry no type information — fall back
 * to the property-name heuristic, so existing callers using those keep their exact behaviour.
 */
export function resolveAssetType(propertyType: string, property: string): string {
    const explicit = ASSET_TYPE_BY_PROPERTY_TYPE[propertyType];
    if (explicit) return explicit;

    const name = property.toLowerCase();
    if (name.includes('texture')) return 'cc.Texture2D';
    if (name.includes('material')) return 'cc.Material';
    if (name.includes('font')) return 'cc.Font';
    if (name.includes('clip')) return 'cc.AudioClip';
    return 'cc.SpriteFrame';
}

export interface ApplyPropertyArgs {
    nodeUuid: string;
    propertyPath: string;
    rawComponentIndex: number;
    componentType: string;
    property: string;
    propertyType: string;
    value: any;
    processedValue: any;
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
function numberComponent(value: any, fallback: number): number {
    if (value === undefined || value === null || value === '') return fallback;
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
const HANDLED_SCALAR_TYPES = new Set<string>([
    // The asset-reference branch is gated on ASSET_REFERENCE_PROPERTY_TYPES plus the
    // generic `asset` spelling; `string` is deliberately included because it is the
    // branch's explicit escape for a plain-string property (issue #46).
    ...ASSET_REFERENCE_PROPERTY_TYPES, 'asset', 'string',
    // The typed math/shape branches, plus the reference types that own a branch of their own.
    'color', 'vec3', 'vec2', 'size', 'node', 'component',
    // The terminal `else` is the correct home for a plain scalar dump — it writes
    // `{ value }` with no `type`, which is exactly what a number/boolean needs. `integer`
    // and `float` are spelled as `number` aliases by `convertPropertyValue` and take the
    // same path, so they belong here too; refusing them would break working calls.
    'number', 'integer', 'float', 'boolean'
]);

const HANDLED_ARRAY_TYPES = new Set<string>([
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
export function describeUnhandledPropertyType(propertyType: string, processedValue: any): string | null {
    if (HANDLED_SCALAR_TYPES.has(propertyType) || HANDLED_ARRAY_TYPES.has(propertyType)) return null;

    if (Array.isArray(processedValue)) {
        return (
            `propertyType '${propertyType}' is an ARRAY value, but no array branch handles it — so the ` +
            `set-property dump would carry no 'type' field, the editor would decode nothing, and this ` +
            `call would report a write it did not perform (issue #66). An array of assets/uuids/colors ` +
            `wants propertyType 'assetArray', 'nodeArray', 'componentArray' or 'colorArray'; an array of ` +
            `plain value objects with NO uuid semantics (cc.RealCurve keyFrames, cc.Gradient alphaKeys) ` +
            `has no supported propertyType yet. Nothing was written.`
        );
    }

    return (
        `propertyType '${propertyType}' is not handled by applyPropertyToEditor, so the set-property ` +
        `dump would carry no 'type' field and the write would silently not apply (issue #66). ` +
        `Nothing was written.`
    );
}

/**
 * Apply a processed property value to the Cocos Creator editor scene.
 * Returns the actual expected value (may differ from processedValue for component refs).
 * Throws on unrecoverable Editor API error.
 */
export async function applyPropertyToEditor(
    args: ApplyPropertyArgs,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<any> {
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
    if ((ASSET_REFERENCE_PROPERTY_TYPES as readonly string[]).includes(propertyType) ||
        (propertyType === 'asset' && NAME_HINTED_ASSET_KEYWORDS.some(k => property.toLowerCase().includes(k)))) {

        const assetType = resolveAssetType(propertyType, property);

        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: processedValue, type: assetType }
        });

    } else if (componentType === 'cc.UITransform' && (property === '_contentSize' || property === 'contentSize')) {
        const width = numberComponent(value.width, 100);
        const height = numberComponent(value.height, 100);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.width`, dump: { value: width }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.height`, dump: { value: height }
        });

    } else if (componentType === 'cc.UITransform' && (property === '_anchorPoint' || property === 'anchorPoint')) {
        const anchorX = numberComponent(value.x, 0.5);
        const anchorY = numberComponent(value.y, 0.5);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.anchorX`, dump: { value: anchorX }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.anchorY`, dump: { value: anchorY }
        });

    } else if (propertyType === 'color' && processedValue && typeof processedValue === 'object') {
        const colorValue = {
            r: Math.min(255, Math.max(0, Number(processedValue.r) || 0)),
            g: Math.min(255, Math.max(0, Number(processedValue.g) || 0)),
            b: Math.min(255, Math.max(0, Number(processedValue.b) || 0)),
            a: processedValue.a !== undefined ? Math.min(255, Math.max(0, Number(processedValue.a))) : 255
        };
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: colorValue, type: 'cc.Color' }
        });

    } else if (propertyType === 'vec3' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0, z: Number(processedValue.z) || 0 }, type: 'cc.Vec3' }
        });

    } else if (propertyType === 'vec2' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0 }, type: 'cc.Vec2' }
        });

    } else if (propertyType === 'size' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { width: Number(processedValue.width) || 0, height: Number(processedValue.height) || 0 }, type: 'cc.Size' }
        });

    } else if (propertyType === 'node' && processedValue && typeof processedValue === 'object' && 'uuid' in processedValue) {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue, type: 'cc.Node' }
        });

    } else if (propertyType === 'component' && processedValue && typeof processedValue === 'object' && 'uuid' in processedValue) {
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

    } else if (propertyType === 'component' && typeof processedValue === 'string') {
        actualExpectedValue = await applyComponentReference(
            nodeUuid, propertyPath, componentType, property, processedValue, getComponentInfo
        );

    } else if (propertyType === 'nodeArray' && Array.isArray(processedValue)) {
        // Without an explicit type/isArray/elementTypeData, the editor's set-property
        // dump has no way to know this is an array of cc.Node references — it falls
        // through as a bare value and silently does not apply (issue #18), the same
        // failure mode as the asset-reference types before they gained an explicit
        // `type` field (see the asset-reference branch above).
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: processedValue, type: 'cc.Node', isArray: true, elementTypeData: { value: null, type: 'cc.Node' } }
        });

    } else if (propertyType === 'assetArray' && Array.isArray(processedValue)) {
        // Explicit array dump typed with the property's DECLARED element class. Each element
        // must itself be a full dump `{ value: { uuid }, type }` (the shape query-node returns):
        // a bare `{ uuid }` element makes the editor throw "Cannot read properties of
        // undefined (reading 'hasOwnProperty')" while decoding the array.
        const elementType = await resolveDeclaredAssetElementType(nodeUuid, componentType, property, getComponentInfo);
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: {
                value: processedValue.map((ref: any) => ({ value: ref, type: elementType })),
                type: elementType, isArray: true,
                elementTypeData: { value: { uuid: '' }, type: elementType }
            }
        });

    } else if (propertyType === 'componentArray' && Array.isArray(processedValue)) {
        actualExpectedValue = await applyComponentReferenceArray(
            nodeUuid, propertyPath, componentType, property, processedValue, getComponentInfo
        );

    } else if (propertyType === 'colorArray' && Array.isArray(processedValue)) {
        const colorArrayValue = processedValue.map((item: any) => {
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

    } else if (unhandledWarning) {
        // Issue #66: the propertyType is in SUPPORTED_PROPERTY_TYPES, so `convertPropertyValue`
        // accepted it, but NO branch above handles it — so the dump would go out with no `type`,
        // the editor decodes nothing, and the write is a silent no-op. `changeVerified` reading
        // false is not a rescue: a caller that trusts a `success:true` response ships an
        // unauthored value, which is exactly how a `cc.RealCurve` spline came back as the
        // untouched 2-point default (issue #66). Refuse the write instead of performing one
        // that cannot work, and name where the array-of-object cases belong.
        throw new Error(unhandledWarning);

    } else {
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
function isUsableType(t: any): boolean {
    return typeof t === 'string' && t.length > 0 && t !== 'Unknown';
}

/**
 * Resolve the DECLARED element class of an asset-array @property (e.g. `cc.AudioClip` for
 * `@property({ type: [AudioClip] })`) from the holder component's dump. Prefers
 * `elementTypeData.type`, then the array dump's own `type`; falls back to `cc.Asset` when
 * neither is readable.
 */
async function resolveDeclaredAssetElementType(
    nodeUuid: string,
    componentType: string,
    property: string,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<string> {
    const info = await getComponentInfo(nodeUuid, componentType);
    let meta: any = info.success ? info.data?.properties : undefined;
    const segments = property.split('.');
    for (let i = 0; i < segments.length && meta; i++) {
        meta = meta[segments[i]];
        const isLeaf = i === segments.length - 1;
        if (!isLeaf && meta && typeof meta === 'object' && 'value' in meta && typeof meta.value === 'object') {
            meta = meta.value;
        }
    }
    if (meta && typeof meta === 'object') {
        if (isUsableType(meta.elementTypeData?.type)) return meta.elementTypeData.type;
        if (isUsableType(meta.type)) return meta.type;
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
async function resolveExpectedComponentType(
    nodeUuid: string,
    componentType: string,
    property: string,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<string> {
    const currentComponentInfo = await getComponentInfo(nodeUuid, componentType);
    // Walk dotted property paths through nested CCClass group dumps to find the metadata descriptor.
    let propertyMeta: any = currentComponentInfo.success ? currentComponentInfo.data?.properties : undefined;
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
        } else if (isUsableType(propertyMeta.ctor)) {
            expectedComponentType = propertyMeta.ctor;
        } else if (propertyMeta.extends && Array.isArray(propertyMeta.extends)) {
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
async function resolveComponentReference(
    nodeUuid: string,
    componentType: string,
    property: string,
    targetNodeUuid: string,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<{ componentId: string; expectedComponentType: string }> {
    console.log(`[ManageComponent] Setting component reference - finding component on node: ${targetNodeUuid}`);

    let expectedComponentType = await resolveExpectedComponentType(nodeUuid, componentType, property, getComponentInfo);

    // `query-node` REJECTS on some editor builds and resolves falsy on others; both mean
    // the same thing here — the value is not a node uuid.
    let targetNodeData: any = null;
    try {
        targetNodeData = await Editor.Message.request('scene', 'query-node', targetNodeUuid);
    } catch {
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
            throw new Error(
                `'${targetNodeUuid}' is neither a node uuid nor a component uuid. ` +
                `Pass the uuid of the NODE that holds the component, or the component's own ` +
                `uuid from manage_component action=get_all.`
            );
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
                const subclassResult: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'isComponentTypeSubclassOf', args: [direct.type, expectedComponentType]
                });
                isSubclass = !!(subclassResult && subclassResult.success && subclassResult.data && subclassResult.data.isSubclass);
            } catch {
                isSubclass = false;
            }

            if (!isSubclass) {
                throw new Error(
                    `Component uuid '${targetNodeUuid}' is a '${direct.type}', but property '${property}' ` +
                    `on '${componentType}' requires a '${expectedComponentType}'.`
                );
            }
        }

        return { componentId: direct.uuid, expectedComponentType: directType };
    }

    // Single-cc-component fallback: when expectedComponentType could not be inferred
    // (e.g., stale 'Unknown' in dump and extends only lists cc.Component/cc.Object),
    // and the target node has exactly one cc.* component, use it. Mirrors Cocos's
    // drag-from-hierarchy auto-resolve behavior.
    if (!expectedComponentType) {
        const ccComps = (targetNodeData.__comps__ as any[])
            .filter(c => typeof c.type === 'string' && c.type.startsWith('cc.')
                && c.type !== 'cc.Component' && c.type !== 'cc.Object');
        if (ccComps.length === 1) {
            expectedComponentType = ccComps[0].type;
        }
    }

    if (!expectedComponentType) {
        throw new Error(`Unable to determine required component type for property '${property}' on component '${componentType}'. Property metadata may not contain type information.`);
    }

    let componentId: string | null = null;
    let foundComponent = null;
    for (let i = 0; i < targetNodeData.__comps__.length; i++) {
        const comp = targetNodeData.__comps__[i] as any;
        if (comp.type === expectedComponentType) {
            foundComponent = comp;
            if (comp.value && comp.value.uuid && comp.value.uuid.value) {
                componentId = comp.value.uuid.value;
            } else {
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
        let baseClassResult: any = null;
        try {
            baseClassResult = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'findComponentByBaseClass', args: [targetNodeUuid, expectedComponentType]
            });
        } catch {
            baseClassResult = null;
        }
        if (baseClassResult && baseClassResult.success && baseClassResult.data && baseClassResult.data.componentUuid) {
            return { componentId: baseClassResult.data.componentUuid, expectedComponentType };
        }

        const available = targetNodeData.__comps__.map((comp: any) => {
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
async function applyComponentReference(
    nodeUuid: string,
    propertyPath: string,
    componentType: string,
    property: string,
    targetNodeUuid: string,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<any> {
    const { componentId, expectedComponentType } = await resolveComponentReference(
        nodeUuid, componentType, property, targetNodeUuid, getComponentInfo
    );

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
async function applyComponentReferenceArray(
    nodeUuid: string,
    propertyPath: string,
    componentType: string,
    property: string,
    targetNodeUuids: any[],
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<any> {
    if (targetNodeUuids.length === 0) {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: [], isArray: true, elementTypeData: { value: null, type: 'cc.Component' } }
        });
        return [];
    }

    const resolvedRefs: Array<{ uuid: string }> = [];
    let elementType = '';
    for (const targetNodeUuid of targetNodeUuids) {
        if (typeof targetNodeUuid !== 'string') {
            throw new Error('componentArray items must be string node UUIDs (each containing the target component)');
        }
        const { componentId, expectedComponentType } = await resolveComponentReference(
            nodeUuid, componentType, property, targetNodeUuid, getComponentInfo
        );
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
async function queryComponentByUuid(uuid: string): Promise<{ uuid: string; type: string } | null> {
    try {
        const comp: any = await Editor.Message.request('scene', 'query-component', uuid);
        if (!comp) return null;

        const resolvedUuid = comp.value?.uuid?.value || comp.uuid?.value || comp.uuid || uuid;
        const type = comp.type || comp.cid || comp.__type__ || '';
        return { uuid: resolvedUuid, type };
    } catch {
        return null;
    }
}
