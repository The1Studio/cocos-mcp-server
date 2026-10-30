"use strict";
/**
 * Pure helper functions for component property analysis, validation, and query utilities.
 * Extracted from ManageComponent to keep manage-component.ts under 200 lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_PROPERTY_TYPES = exports.ASSET_TYPE_BY_PROPERTY_TYPE = exports.ASSET_REFERENCE_PROPERTY_TYPES = void 0;
exports.isPlainObject = isPlainObject;
exports.matchesRequestedStructure = matchesRequestedStructure;
exports.extractComponentPropertyDump = extractComponentPropertyDump;
exports.isValidPropertyDescriptor = isValidPropertyDescriptor;
exports.analyzeProperty = analyzeProperty;
exports.parseColorString = parseColorString;
exports.convertPropertyValue = convertPropertyValue;
exports.generateComponentSuggestion = generateComponentSuggestion;
exports.getAvailableComponentsList = getAvailableComponentsList;
exports.redirectNodePropertyAccess = redirectNodePropertyAccess;
exports.describeScalarWriteToArrayProperty = describeScalarWriteToArrayProperty;
exports.verifyComponentPropertyChange = verifyComponentPropertyChange;
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
/**
 * Reject a non-primitive element in a primitive array, naming what arrived (issue #66).
 *
 * `numberArray` and `stringArray` are the only two propertyTypes whose conversion coerces
 * silently, so a caller reaching for one of them with OBJECT elements — cc.RealCurve
 * keyframes, cc.Gradient alpha keys, or any other array-of-plain-object field — had every
 * element turned into `NaN` / `"[object Object]"` and written to the scene on a `success`
 * response. Neither is a value anyone meant to write, so refusing beats coercing.
 */
function assertArrayItemIsPrimitive(propertyType, item) {
    if (item !== null && typeof item === 'object') {
        throw new Error(`${propertyType} items must be primitives (received ${Array.isArray(item) ? 'array' : 'object'}). ` +
            `Array-of-OBJECT fields (e.g. a cc.RealCurve spline's keyFrames, a cc.Gradient's alphaKeys) ` +
            `are written with propertyType 'objectArray' — no value was written (issue #66).`);
    }
}
function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}
/**
 * Compare an `objectArray` request against the editor's read-back (issue #66).
 *
 * The read-back wraps every node of the tree as a dump (`{ value, type, ... }`), so the
 * comparison walks the REQUESTED structure and unwraps the dump alongside it. Extra keys the
 * editor reports (internal ids, defaults for fields the caller never named) are ignored; a
 * requested leaf that is missing or different fails the match.
 */
function matchesRequestedStructure(expected, dump) {
    if (Array.isArray(expected)) {
        const actual = Array.isArray(dump) ? dump : dump === null || dump === void 0 ? void 0 : dump.value;
        return Array.isArray(actual) && actual.length === expected.length &&
            expected.every((e, i) => matchesRequestedStructure(e, actual[i]));
    }
    if (isPlainObject(expected)) {
        if (!isPlainObject(dump))
            return false;
        const fields = isPlainObject(dump.value) ? dump.value : dump;
        return Object.keys(expected).every(k => matchesRequestedStructure(expected[k], fields[k]));
    }
    const actual = isPlainObject(dump) && 'value' in dump ? dump.value : dump;
    if (typeof expected === 'number' || typeof actual === 'number')
        return Number(actual) === Number(expected);
    return actual === expected;
}
/**
 * Return a component dump's property map.
 *
 * `scene:query-node` shapes each `__comps__` entry as
 * `{ __type__, cid, type, enabled, value: { <prop>: { name, value, type } } }` — the live
 * property values live under `value`. The fallback covers dumps that inline their
 * properties instead of nesting them.
 */
function extractComponentPropertyDump(component) {
    if ((component === null || component === void 0 ? void 0 : component.value) && typeof component.value === 'object')
        return component.value;
    const properties = {};
    if (!component || typeof component !== 'object')
        return properties;
    const excludeKeys = ['__type__', 'enabled', 'node', '_id', '__scriptAsset', 'uuid', 'name', '_name', '_objFlags', '_enabled', 'type', 'readonly', 'visible', 'cid', 'editor', 'extends'];
    for (const key in component) {
        if (!excludeKeys.includes(key) && !key.startsWith('_')) {
            properties[key] = component[key];
        }
    }
    return properties;
}
/** Returns true if propData looks like a Cocos Creator property descriptor object */
function isValidPropertyDescriptor(propData) {
    if (typeof propData !== 'object' || propData === null)
        return false;
    try {
        const keys = Object.keys(propData);
        // Skip simple value objects like {width: 200, height: 150}
        const isSimpleValueObject = keys.every(key => {
            const v = propData[key];
            return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
        });
        if (isSimpleValueObject)
            return false;
        const hasName = keys.includes('name');
        const hasValue = keys.includes('value');
        const hasType = keys.includes('type');
        const hasDisplayName = keys.includes('displayName');
        const hasReadonly = keys.includes('readonly');
        const hasValidStructure = (hasName || hasValue) && (hasType || hasDisplayName || hasReadonly);
        if (keys.includes('default') && propData.default && typeof propData.default === 'object') {
            const defaultKeys = Object.keys(propData.default);
            if (defaultKeys.includes('value') && typeof propData.default.value === 'object') {
                return hasValidStructure;
            }
        }
        return hasValidStructure;
    }
    catch (_a) {
        return false;
    }
}
/** Analyze a component's property to determine its type and current value.
 *  Supports dotted propertyName for nested CCClass groups (e.g., "cameraSection.mainCamera"). */
function analyzeProperty(component, propertyName) {
    const availableProperties = [];
    let propertyValue = undefined;
    let propertyExists = false;
    let notFoundHint;
    // Method 1: direct property access (flat path only)
    if (!propertyName.includes('.') && Object.prototype.hasOwnProperty.call(component, propertyName)) {
        propertyValue = component[propertyName];
        propertyExists = true;
    }
    // Method 2: search nested properties structure (Cocos Creator component dump format).
    //  For dotted names like "cameraSection.mainCamera", walk segments through nested `.value` dumps.
    if (!propertyExists && component.properties && typeof component.properties === 'object') {
        const valueEntry = component.properties.value;
        // `getComponents` has already unwrapped the query-node component envelope, so a
        // property map may itself contain a user property named `value`. Only unwrap that
        // key when it is a container, not when it is the property's descriptor.
        const valueEntryIsDescriptor = isValidPropertyDescriptor(valueEntry) && (typeof valueEntry.name === 'string' ||
            typeof valueEntry.displayName === 'string' ||
            typeof valueEntry.type === 'string' ||
            typeof valueEntry.readonly === 'boolean');
        const rootValueObj = valueEntry && typeof valueEntry === 'object' && !valueEntryIsDescriptor
            ? valueEntry
            : component.properties;
        const segments = propertyName.split('.');
        let cursor = rootValueObj;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const isLeaf = i === segments.length - 1;
            // Populate availableProperties at the relevant level (root or final container)
            if (i === 0 || (i === segments.length - 1)) {
                for (const [k, v] of Object.entries(cursor || {})) {
                    if (k !== 'uuid' && v && typeof v === 'object') {
                        const prefix = i === 0 ? '' : `${segments.slice(0, i).join('.')}.`;
                        availableProperties.push(`${prefix}${k}`);
                    }
                }
            }
            const descriptor = cursor ? cursor[segment] : undefined;
            if (descriptor === undefined) {
                // Issue #68: an index past the end of an array. `length` itself is the append
                // slot; anything further out is a genuine gap the caller must fill in order.
                if (Array.isArray(cursor) && /^\d+$/.test(segment)) {
                    const arrayProperty = segments.slice(0, i).join('.');
                    if (isLeaf && Number(segment) === cursor.length) {
                        return {
                            exists: true, type: 'unknown', availableProperties, originalValue: undefined,
                            appendTo: { arrayProperty, currentLength: cursor.length }
                        };
                    }
                    notFoundHint = `'${arrayProperty}' is an array with ${cursor.length} element(s); index ${segment} is out of range. ` +
                        `Write index ${cursor.length} first (it appends), or set the whole array with an array propertyType.`;
                }
                cursor = undefined;
                break;
            }
            if (isLeaf) {
                if (isValidPropertyDescriptor(descriptor)) {
                    const dKeys = Object.keys(descriptor);
                    propertyValue = dKeys.includes('value') ? descriptor.value : descriptor;
                }
                else {
                    propertyValue = descriptor;
                }
                propertyExists = true;
                break;
            }
            // Descend into the nested CCClass group: descriptor.value holds the inner dump.
            if (descriptor && typeof descriptor === 'object' && 'value' in descriptor && typeof descriptor.value === 'object') {
                cursor = descriptor.value;
            }
            else if (descriptor && typeof descriptor === 'object') {
                cursor = descriptor;
            }
            else {
                cursor = undefined;
                break;
            }
        }
    }
    // Method 3: collect simple property names from direct keys as fallback
    if (availableProperties.length === 0) {
        for (const key of Object.keys(component)) {
            if (!key.startsWith('_') && !['__type__', 'cid', 'node', 'uuid', 'name', 'enabled', 'type', 'readonly', 'visible'].includes(key)) {
                availableProperties.push(key);
            }
        }
    }
    if (!propertyExists) {
        return { exists: false, type: 'unknown', availableProperties, originalValue: undefined, notFoundHint };
    }
    // Infer type from value structure
    let type = 'unknown';
    if (Array.isArray(propertyValue)) {
        if (propertyName.toLowerCase().includes('node'))
            type = 'nodeArray';
        else if (propertyName.toLowerCase().includes('color'))
            type = 'colorArray';
        else
            type = 'array';
    }
    else if (typeof propertyValue === 'string') {
        type = ['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'].includes(propertyName.toLowerCase()) ? 'asset' : 'string';
    }
    else if (typeof propertyValue === 'number') {
        type = 'number';
    }
    else if (typeof propertyValue === 'boolean') {
        type = 'boolean';
    }
    else if (propertyValue && typeof propertyValue === 'object') {
        try {
            const keys = Object.keys(propertyValue);
            if (keys.includes('r') && keys.includes('g') && keys.includes('b')) {
                type = 'color';
            }
            else if (keys.includes('x') && keys.includes('y')) {
                type = propertyValue.z !== undefined ? 'vec3' : 'vec2';
            }
            else if (keys.includes('width') && keys.includes('height')) {
                type = 'size';
            }
            else if (keys.includes('uuid') || keys.includes('__uuid__')) {
                type = (propertyName.toLowerCase().includes('node') || propertyName.toLowerCase().includes('target') || keys.includes('__id__')) ? 'node' : 'asset';
            }
            else if (keys.includes('__id__')) {
                type = 'node';
            }
            else {
                type = 'object';
            }
        }
        catch (_a) {
            type = 'object';
        }
    }
    else if (propertyValue === null || propertyValue === undefined) {
        if (['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'].includes(propertyName.toLowerCase())) {
            type = 'asset';
        }
        else if (propertyName.toLowerCase().includes('node') || propertyName.toLowerCase().includes('target')) {
            type = 'node';
        }
        else if (propertyName.toLowerCase().includes('component')) {
            type = 'component';
        }
    }
    return { exists: true, type, availableProperties, originalValue: propertyValue };
}
/** Parse a hex color string (#RGB or #RGBA) to an RGBA object */
function parseColorString(colorStr) {
    const str = colorStr.trim();
    if (str.startsWith('#')) {
        if (str.length === 7) {
            return {
                r: parseInt(str.substring(1, 3), 16),
                g: parseInt(str.substring(3, 5), 16),
                b: parseInt(str.substring(5, 7), 16),
                a: 255
            };
        }
        else if (str.length === 9) {
            return {
                r: parseInt(str.substring(1, 3), 16),
                g: parseInt(str.substring(3, 5), 16),
                b: parseInt(str.substring(5, 7), 16),
                a: parseInt(str.substring(7, 9), 16)
            };
        }
    }
    throw new Error(`Invalid color format: "${colorStr}". Only hexadecimal format is supported (e.g., "#FF0000" or "#FF0000FF")`);
}
/**
 * Cocos asset-reference property types. Every one of these serializes identically as
 * `{ uuid }` (issue #26 — propertyType="material" and friends previously fell through to
 * `Unsupported property type`, even though the existing spriteFrame/prefab/asset coercion
 * already produces the correct shape for them).
 */
exports.ASSET_REFERENCE_PROPERTY_TYPES = [
    'spriteFrame', 'prefab', 'asset',
    'material', 'texture', 'spriteAtlas', 'audioClip', 'font', 'animationClip',
    'mesh', 'skeleton', 'physicsMaterial', 'renderTexture', 'textAsset', 'jsonAsset',
    'particleAsset', 'sceneAsset'
];
/**
 * Explicit propertyType -> Cocos asset class for the Editor `set-property` dump `type` field.
 *
 * Resolved from the propertyType itself, NOT from the property name. The legacy name-based
 * heuristic in `applyPropertyToEditor` mis-resolves any asset property whose name lacks the
 * matching keyword — a `cc.Material` property called `skin` resolved to `cc.SpriteFrame`.
 *
 * The generic `asset` and `string` spellings carry no type information, so they deliberately
 * have NO entry here and keep using the name heuristic (unchanged behaviour for existing callers).
 */
exports.ASSET_TYPE_BY_PROPERTY_TYPE = {
    material: 'cc.Material',
    texture: 'cc.Texture2D',
    spriteFrame: 'cc.SpriteFrame',
    spriteAtlas: 'cc.SpriteAtlas',
    prefab: 'cc.Prefab',
    audioClip: 'cc.AudioClip',
    font: 'cc.Font',
    animationClip: 'cc.AnimationClip',
    mesh: 'cc.Mesh',
    skeleton: 'cc.Skeleton',
    physicsMaterial: 'cc.PhysicsMaterial',
    renderTexture: 'cc.RenderTexture',
    textAsset: 'cc.TextAsset',
    jsonAsset: 'cc.JsonAsset',
    particleAsset: 'cc.ParticleAsset',
    sceneAsset: 'cc.SceneAsset'
};
/** Every propertyType convertPropertyValue accepts — used to build an actionable error message. */
exports.SUPPORTED_PROPERTY_TYPES = [
    'string', 'number', 'integer', 'float', 'boolean',
    'color', 'vec2', 'vec3', 'size',
    'node', 'component',
    ...exports.ASSET_REFERENCE_PROPERTY_TYPES,
    'nodeArray', 'colorArray', 'numberArray', 'stringArray', 'componentArray', 'assetArray',
    'objectArray'
];
/**
 * Convert a raw LLM-supplied value to the correct format for a given propertyType.
 * Throws if the value format is invalid for the given type.
 */
function convertPropertyValue(propertyType, value) {
    // Issue #75: neither `null` nor `""` could clear a node/component/asset reference.
    // `node` and every asset-reference type already forwarded `""` unrejected (it happens
    // to satisfy the `typeof value === 'string'` check below and become `{ uuid: '' }`),
    // but rejected `null` outright. `component`/`componentArray` additionally forwarded a
    // `""` value UNRESOLVED instead of treating it as "clear this reference", which then
    // failed downstream with a confusing "neither a Node uuid nor a component uuid" error.
    // A cleared single reference always serializes as `{ uuid: '' }` — the same shape a
    // set reference uses — so it needs no special handling anywhere set-property already
    // handles a reference dump.
    const isClearRequest = value === null || value === '';
    if (isClearRequest && (propertyType === 'node' || propertyType === 'component' ||
        exports.ASSET_REFERENCE_PROPERTY_TYPES.includes(propertyType))) {
        return { uuid: '' };
    }
    if (isClearRequest && (propertyType === 'componentArray' || propertyType === 'assetArray')) {
        return [];
    }
    if (exports.ASSET_REFERENCE_PROPERTY_TYPES.includes(propertyType)) {
        if (typeof value === 'string')
            return { uuid: value };
        // Issue #72: a whole-array write (`sharedMaterials: [uuid, ...]`) is the form callers
        // reach for first; name the propertyType that carries it instead of a bare type error.
        if (Array.isArray(value)) {
            throw new Error(`${propertyType} value must be a single string UUID, but an array was received. ` +
                `To write an array of assets (e.g. cc.MeshRenderer.sharedMaterials) use propertyType 'assetArray', ` +
                `or write one element at a time with a dotted index ('sharedMaterials.0', which appends at the end of the array).`);
        }
        throw new Error(`${propertyType} value must be a string UUID (received typeof ${typeof value})`);
    }
    switch (propertyType) {
        case 'string':
            // Issue #116: `String(value)` turns any object into the literal text
            // "[object Object]" (and any array into a comma-joined list), which was then
            // written to the scene with success:true — silent data loss on a plain string
            // field. Reject anything non-primitive, naming the received type, instead of
            // writing a lossy placeholder. Mirrors the asset-reference branch above.
            if (typeof value === 'object' && value !== null) {
                throw new Error(`string value must be a primitive (received ${Array.isArray(value) ? 'array' : 'object'}); ` +
                    'pass JSON-encoded text if a structured payload was intended');
            }
            if (typeof value === 'function' || typeof value === 'symbol') {
                throw new Error(`string value must be a primitive (received ${typeof value})`);
            }
            return String(value);
        case 'number':
        case 'integer':
        case 'float':
            return Number(value);
        case 'boolean':
            {
                // Issue #76: `Boolean("false")` is `true`. A transport that stringifies
                // arguments delivers the text "false", which became a write of `true`; against
                // a property already holding `true` the read-back matched and the tool reported
                // `changeVerified: true` for a value the caller never asked for. Parse the
                // spelled-out forms and refuse anything that is not one, rather than coercing
                // by truthiness.
                if (value === null)
                    return false;
                const coerced = (0, normalize_1.coerceBool)(value);
                if (coerced === undefined) {
                    throw new Error(`boolean value must be true/false (received ${typeof value}${typeof value === 'string' ? ` "${value}"` : ''})`);
                }
                return coerced;
            }
        case 'color':
            {
                // Issue #52: a JSON-string value (e.g. '{"r":255,"g":0,"b":0}') reaches
                // this point as a string. A hex color string (e.g. "#FF0000") is NOT
                // valid JSON, so parseJsonPayload returns it unchanged; only a JSON object
                // string coerces to an object. Try the JSON path first so both a hex
                // string and a JSON-string object land in the right branch.
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (typeof coerced === 'string')
                    return parseColorString(coerced);
                if (typeof coerced === 'object' && coerced !== null) {
                    return {
                        r: Math.min(255, Math.max(0, Number(coerced.r) || 0)),
                        g: Math.min(255, Math.max(0, Number(coerced.g) || 0)),
                        b: Math.min(255, Math.max(0, Number(coerced.b) || 0)),
                        a: coerced.a !== undefined ? Math.min(255, Math.max(0, Number(coerced.a))) : 255
                    };
                }
            }
            throw new Error(`Color value must be an object with r, g, b properties or a hexadecimal string (e.g., "#FF0000") (received typeof ${typeof value})`);
        case 'vec2':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (typeof coerced === 'object' && coerced !== null)
                    return { x: Number(coerced.x) || 0, y: Number(coerced.y) || 0 };
            }
            throw new Error(`Vec2 value must be an object with x, y properties (received typeof ${typeof value})`);
        case 'vec3':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (typeof coerced === 'object' && coerced !== null)
                    return { x: Number(coerced.x) || 0, y: Number(coerced.y) || 0, z: Number(coerced.z) || 0 };
            }
            throw new Error(`Vec3 value must be an object with x, y, z properties (received typeof ${typeof value})`);
        case 'size':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (typeof coerced === 'object' && coerced !== null)
                    return { width: Number(coerced.width) || 0, height: Number(coerced.height) || 0 };
            }
            throw new Error(`Size value must be an object with width, height properties (received typeof ${typeof value})`);
        case 'node':
            if (typeof value === 'string')
                return { uuid: value };
            throw new Error(`Node reference value must be a string UUID (received typeof ${typeof value})`);
        case 'component':
            if (typeof value === 'string')
                return value; // resolved to __id__ later
            throw new Error(`Component reference value must be a string (Node UUID containing the target component) (received typeof ${typeof value})`);
        case 'componentArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => {
                        if (typeof item === 'string')
                            return item; // each resolved to a component __id__ later
                        throw new Error(`ComponentArray items must be string Node UUIDs (each containing the target component) (received item typeof ${typeof item})`);
                    });
            }
            throw new Error(`ComponentArray value must be an array (received typeof ${typeof value})`);
        case 'assetArray':
            {
                // An array of asset references (e.g. `@property({ type: [AudioClip] })`).
                // Every single-asset propertyType rejects an array, so without this case such a
                // field was unwritable. Elements serialize as `{ uuid }`, like a single asset.
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => {
                        if (typeof item === 'string')
                            return { uuid: item };
                        throw new Error(`assetArray items must be string asset UUIDs (received item typeof ${typeof item})`);
                    });
            }
            throw new Error(`assetArray value must be an array of asset UUID strings (received typeof ${typeof value})`);
        case 'nodeArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => { if (typeof item === 'string')
                        return { uuid: item }; throw new Error(`NodeArray items must be string UUIDs (received item typeof ${typeof item})`); });
            }
            throw new Error(`NodeArray value must be an array (received typeof ${typeof value})`);
        case 'colorArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => {
                        if (typeof item === 'object' && item !== null && 'r' in item) {
                            return { r: Math.min(255, Math.max(0, Number(item.r) || 0)), g: Math.min(255, Math.max(0, Number(item.g) || 0)), b: Math.min(255, Math.max(0, Number(item.b) || 0)), a: item.a !== undefined ? Math.min(255, Math.max(0, Number(item.a))) : 255 };
                        }
                        return { r: 255, g: 255, b: 255, a: 255 };
                    });
            }
            throw new Error(`ColorArray value must be an array (received typeof ${typeof value})`);
        case 'numberArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => {
                        // Issue #66: `Number(item)` on an object yields NaN, which the editor
                        // accepts as a written value — a caller passing keyframe/alpha-key OBJECTS
                        // here (the shape the array-of-object fields actually hold) got a success
                        // response over a NaN-filled field. Name the received item instead.
                        assertArrayItemIsPrimitive('numberArray', item);
                        return Number(item);
                    });
            }
            throw new Error(`NumberArray value must be an array (received typeof ${typeof value})`);
        case 'stringArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => {
                        // Same as numberArray above: `String(item)` renders any object as the
                        // literal text "[object Object]" (issue #116's failure shape, per element).
                        assertArrayItemIsPrimitive('stringArray', item);
                        return String(item);
                    });
            }
            throw new Error(`StringArray value must be an array (received typeof ${typeof value})`);
        case 'objectArray':
            {
                // Issue #66: array of plain value objects (cc.RealCurve keyFrames, cc.Gradient
                // alphaKeys). Elements are written leaf by leaf, so they must be objects whose
                // keys are the CCClass field names; a `uuid` key means a reference, which has
                // its own propertyTypes and a different dump shape.
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (!Array.isArray(coerced)) {
                    throw new Error(`objectArray value must be an array of plain objects (received typeof ${typeof value})`);
                }
                coerced.forEach((item, idx) => {
                    if (!isPlainObject(item)) {
                        throw new Error(`objectArray items must be plain objects (item ${idx} is ${Array.isArray(item) ? 'an array' : item === null ? 'null' : typeof item}). Primitive arrays use numberArray/stringArray.`);
                    }
                    if ('uuid' in item) {
                        throw new Error(`objectArray item ${idx} has a 'uuid' key, so it is a reference — use nodeArray, componentArray or assetArray for reference arrays.`);
                    }
                });
                return coerced;
            }
        default:
            throw new Error(`Unsupported property type: ${propertyType}. Supported types: ${exports.SUPPORTED_PROPERTY_TYPES.join(', ')}`);
    }
}
/**
 * Whether an array element is shaped like a `{ uuid }` REFERENCE.
 *
 * `verifyComponentPropertyChange` uses this to decide whether an expected array is a
 * reference array (nodeArray / componentArray / assetArray) or a primitive one
 * (numberArray / stringArray). Sending a primitive array down the reference branch made
 * every such write fail verification (#1650).
 */
function isReferenceShaped(item) {
    return item !== null && typeof item === 'object' && 'uuid' in item;
}
/** Generate an LLM-friendly suggestion when requested component type is not found */
function generateComponentSuggestion(requestedType, availableTypes, property) {
    const similarTypes = availableTypes.filter(type => type.toLowerCase().includes(requestedType.toLowerCase()) ||
        requestedType.toLowerCase().includes(type.toLowerCase()));
    let instruction = '';
    if (similarTypes.length > 0) {
        instruction += `\nFound similar components: ${similarTypes.join(', ')}`;
        instruction += `\nSuggestion: Perhaps you meant '${similarTypes[0]}'?`;
    }
    const propertyToComponentMap = {
        'string': ['cc.Label', 'cc.RichText', 'cc.EditBox'],
        'text': ['cc.Label', 'cc.RichText'],
        'fontSize': ['cc.Label', 'cc.RichText'],
        'spriteFrame': ['cc.Sprite'],
        'color': ['cc.Label', 'cc.Sprite', 'cc.Graphics'],
        'normalColor': ['cc.Button'],
        'pressedColor': ['cc.Button'],
        'target': ['cc.Button'],
        'contentSize': ['cc.UITransform'],
        'anchorPoint': ['cc.UITransform']
    };
    const recommendedComponents = propertyToComponentMap[property] || [];
    const availableRecommended = recommendedComponents.filter(comp => availableTypes.includes(comp));
    if (availableRecommended.length > 0) {
        instruction += `\nBased on property '${property}', recommended components: ${availableRecommended.join(', ')}`;
    }
    instruction += `\nSuggested Actions:`;
    instruction += `\n1. Use manage_component action=get_all nodeUuid="..." to view all components on the node`;
    instruction += `\n2. If you need to add a component, use action=add with componentType="${requestedType}"`;
    instruction += `\n3. Verify that the component type name is correct (case-sensitive)`;
    return instruction;
}
/** Return available Cocos Creator built-in component types by category */
function getAvailableComponentsList(category = 'all') {
    const componentCategories = {
        renderer: ['cc.Sprite', 'cc.Label', 'cc.RichText', 'cc.Mask', 'cc.Graphics'],
        ui: ['cc.Button', 'cc.Toggle', 'cc.Slider', 'cc.ScrollView', 'cc.EditBox', 'cc.ProgressBar'],
        physics: ['cc.RigidBody2D', 'cc.BoxCollider2D', 'cc.CircleCollider2D', 'cc.PolygonCollider2D'],
        animation: ['cc.Animation', 'cc.AnimationClip', 'cc.SkeletalAnimation'],
        audio: ['cc.AudioSource'],
        layout: ['cc.Layout', 'cc.Widget', 'cc.PageView', 'cc.PageViewIndicator'],
        effects: ['cc.MotionStreak', 'cc.ParticleSystem2D'],
        camera: ['cc.Camera'],
        light: ['cc.Light', 'cc.DirectionalLight', 'cc.PointLight', 'cc.SpotLight']
    };
    let components = [];
    if (category === 'all') {
        for (const cat in componentCategories) {
            components = components.concat(componentCategories[cat]);
        }
    }
    else if (componentCategories[category]) {
        components = componentCategories[category];
    }
    return (0, types_1.successResult)({ category, components });
}
/** Redirect set_property calls that target node-level properties to the correct manage_node action */
function redirectNodePropertyAccess(args) {
    const { nodeUuid, componentType, property, value } = args;
    const nodeBasicProperties = ['name', 'active', 'layer', 'mobility', 'parent', 'children', 'hideFlags'];
    const nodeTransformProperties = ['position', 'rotation', 'scale', 'eulerAngles', 'angle'];
    if (componentType === 'cc.Node' || componentType === 'Node') {
        if (nodeBasicProperties.includes(property)) {
            return {
                success: false,
                error: `Property '${property}' is a node basic property, not a component property`,
                instruction: `Use manage_node action=set_property with uuid="${nodeUuid}", property="${property}", value=${JSON.stringify(value)}`
            };
        }
        else if (nodeTransformProperties.includes(property)) {
            return {
                success: false,
                error: `Property '${property}' is a node transform property, not a component property`,
                instruction: `Use manage_node action=set_transform with uuid="${nodeUuid}", ${property}=${JSON.stringify(value)}`
            };
        }
    }
    return null;
}
/**
 * Refuse a scalar propertyType aimed at a property that currently holds an ARRAY (issue #115).
 *
 * A single-value write (`asset`, `node`, `string`, ...) against an array-typed `@property`
 * does not fail cleanly: the editor accepts the dump, the field stops decoding, and it vanishes
 * from the component's own `get_info` until the component is removed and re-added. The caller
 * has no way to recover, so the write is refused before it is sent, naming the supported
 * whole-array propertyTypes and the element-wise dotted form.
 *
 * Returns the refusal message, or `null` when the write is not a scalar-over-array.
 */
function describeScalarWriteToArrayProperty(propertyType, originalValue, property) {
    if (!Array.isArray(originalValue) || propertyType.endsWith('Array'))
        return null;
    return (`Property '${property}' is an ARRAY, but propertyType '${propertyType}' writes a single value; ` +
        `the editor would drop the field from the component and it could not be restored by a later write (issue #115). ` +
        `Set the whole array with 'assetArray', 'nodeArray', 'componentArray', 'colorArray', 'numberArray' or ` +
        `'stringArray', or write one element with a dotted index ('${property}.0', '${property}.<length>' appends). ` +
        `Nothing was written.`);
}
/** Verify a property change was applied; uses getComponentInfo callback to avoid circular deps */
async function verifyComponentPropertyChange(nodeUuid, componentType, property, originalValue, expectedValue, getComponentInfo) {
    var _a;
    try {
        const componentInfo = await getComponentInfo(nodeUuid, componentType);
        if (componentInfo.success && componentInfo.data) {
            // Walk dotted property paths through nested CCClass group dumps.
            const segments = property.split('.');
            let propertyData = componentInfo.data.properties;
            for (let i = 0; i < segments.length && propertyData; i++) {
                propertyData = propertyData[segments[i]];
                const isLeaf = i === segments.length - 1;
                if (!isLeaf && propertyData && typeof propertyData === 'object' && 'value' in propertyData && typeof propertyData.value === 'object') {
                    propertyData = propertyData.value;
                }
            }
            let actualValue = propertyData;
            if (propertyData && typeof propertyData === 'object' && 'value' in propertyData) {
                actualValue = propertyData.value;
            }
            // Extracts a reference's uuid regardless of whether the editor's dump wraps it
            // as a plain string ({ uuid: 'x' }) or as a nested leaf descriptor
            // ({ uuid: { value: 'x' } }) — the same ambiguity the single-reference branch
            // below already tolerates.
            const extractUuid = (ref) => {
                // An asset-array element reads back as a full element dump
                // ({ value: { uuid }, type, ... }), not a bare { uuid } ref — unwrap it.
                if (ref && typeof ref === 'object' && !('uuid' in ref) && ref.value && typeof ref.value === 'object') {
                    ref = ref.value;
                }
                if (!ref || typeof ref !== 'object' || !('uuid' in ref))
                    return '';
                const raw = ref.uuid;
                if (raw && typeof raw === 'object' && 'value' in raw)
                    return raw.value || '';
                return raw || '';
            };
            let verified = false;
            if (Array.isArray(expectedValue) && expectedValue.some(e => isPlainObject(e) && !('uuid' in e))) {
                // objectArray (issue #66): elements are plain value objects, not references.
                verified = matchesRequestedStructure(expectedValue, propertyData);
            }
            else if (Array.isArray(expectedValue) && expectedValue.some(isReferenceShaped)) {
                // nodeArray / componentArray / assetArray: elements are `{ uuid }` references.
                // Compare by per-element uuid (order-preserving), never by deep-equaling the
                // whole array — the editor's read-back dump may carry extra per-element
                // metadata (e.g. an internal object id) that a plain component/node reference
                // write never included, which would fail a JSON.stringify comparison even
                // though every reference resolved correctly.
                //
                // The `some(isReferenceShaped)` gate is load-bearing (#1650): an EMPTY
                // reference array has no element to inspect, and a `numberArray` /
                // `stringArray` has only primitives. Sending those here made `extractUuid`
                // return '' for every element, so `expUuid !== ''` was always false and a
                // correct primitive-array write could never verify — the caller saw
                // "expected [4,3,3,2] but the editor reads back [4,3,3,2]".
                const actualArr = Array.isArray(actualValue) ? actualValue : [];
                verified = actualArr.length === expectedValue.length &&
                    expectedValue.every((exp, idx) => {
                        const expUuid = extractUuid(exp);
                        return expUuid !== '' && expUuid === extractUuid(actualArr[idx]);
                    });
            }
            else if (typeof expectedValue === 'object' && expectedValue !== null && 'uuid' in expectedValue) {
                // Issue #73 (secondary finding): the trailing `&& expectedUuid !== ''` made
                // `verified` ALWAYS false when clearing a reference to an empty uuid — even
                // when actualUuid === expectedUuid === '' and the clear genuinely succeeded
                // (issue #75). Dropping it does not weaken the non-empty case: a missing/
                // undefined actualValue already computes actualUuid === '', which can never
                // equal a non-empty expectedUuid, so that comparison alone still fails it.
                const actualUuid = actualValue && typeof actualValue === 'object' && 'uuid' in actualValue ? actualValue.uuid : '';
                const expectedUuid = expectedValue.uuid || '';
                verified = actualUuid === expectedUuid;
            }
            else if (typeof actualValue === typeof expectedValue) {
                if (typeof actualValue === 'object' && actualValue !== null && expectedValue !== null) {
                    verified = JSON.stringify(actualValue) === JSON.stringify(expectedValue);
                }
                else {
                    verified = actualValue === expectedValue;
                }
            }
            else {
                verified = String(actualValue) === String(expectedValue) || Number(actualValue) === Number(expectedValue);
            }
            return {
                verified,
                actualValue,
                fullData: {
                    modifiedProperty: { name: property, before: originalValue, expected: expectedValue, actual: actualValue, verified },
                    componentSummary: { nodeUuid, componentType, totalProperties: Object.keys(((_a = componentInfo.data) === null || _a === void 0 ? void 0 : _a.properties) || {}).length }
                }
            };
        }
    }
    catch (error) {
        console.error('[ManageComponent.verifyPropertyChange] Verification failed:', error);
    }
    return { verified: false, actualValue: undefined, fullData: null };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUF3Qkgsc0NBRUM7QUFVRCw4REFjQztBQVVELG9FQVlDO0FBa0JELDhEQTBCQztBQUlELDBDQStJQztBQUdELDRDQW9CQztBQTBERCxvREFvTUM7QUFlRCxrRUFxQ0M7QUFHRCxnRUF1QkM7QUFHRCxnRUF3QkM7QUFhRCxnRkFTQztBQUdELHNFQW1HQztBQS92QkQsb0NBQTJEO0FBQzNELGtEQUFrRTtBQUVsRTs7Ozs7Ozs7R0FRRztBQUNILFNBQVMsMEJBQTBCLENBQUMsWUFBb0IsRUFBRSxJQUFTO0lBQy9ELElBQUksSUFBSSxLQUFLLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM1QyxNQUFNLElBQUksS0FBSyxDQUNYLEdBQUcsWUFBWSx1Q0FBdUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLEtBQUs7WUFDbkcsNkZBQTZGO1lBQzdGLGlGQUFpRixDQUNwRixDQUFDO0lBQ04sQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFnQixhQUFhLENBQUMsQ0FBTTtJQUNoQyxPQUFPLENBQUMsS0FBSyxJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLHlCQUF5QixDQUFDLFFBQWEsRUFBRSxJQUFTO0lBQzlELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1FBQzFCLE1BQU0sTUFBTSxH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LEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDN0UsQ0FBQztxQkFBTSxDQUFDO29CQUNKLFFBQVEsR0FBRyxXQUFXLEtBQUssYUFBYSxDQUFDO2dCQUM3QyxDQUFDO1lBQ0wsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDOUcsQ0FBQztZQUVELE9BQU87Z0JBQ0gsUUFBUTtnQkFDUixXQUFXO2dCQUNYLFFBQVEsRUFBRTtvQkFDTixnQkFBZ0IsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFO29CQUNuSCxnQkFBZ0IsRUFBRSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQSxNQUFBLGFBQWEsQ0FBQyxJQUFJLDBDQUFFLFVBQVUsS0FBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7aUJBQzNIO2FBQ0osQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkRBQTZELEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUNELE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFB1cmUgaGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tcG9uZW50IHByb3BlcnR5IGFuYWx5c2lzLCB2YWxpZGF0aW9uLCBhbmQgcXVlcnkgdXRpbGl0aWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50IHRvIGtlZXAgbWFuYWdlLWNvbXBvbmVudC50cyB1bmRlciAyMDAgbGluZXMuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wsIHBhcnNlSnNvblBheWxvYWQgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuXG4vKipcbiAqIFJlamVjdCBhIG5vbi1wcmltaXRpdmUgZWxlbWVudCBpbiBhIHByaW1pdGl2ZSBhcnJheSwgbmFtaW5nIHdoYXQgYXJyaXZlZCAoaXNzdWUgIzY2KS5cbiAqXG4gKiBgbnVtYmVyQXJyYXlgIGFuZCBgc3RyaW5nQXJyYXlgIGFyZSB0aGUgb25seSB0d28gcHJvcGVydHlUeXBlcyB3aG9zZSBjb252ZXJzaW9uIGNvZXJjZXNcbiAqIHNpbGVudGx5LCBzbyBhIGNhbGxlciByZWFjaGluZyBmb3Igb25lIG9mIHRoZW0gd2l0aCBPQkpFQ1QgZWxlbWVudHMg4oCUIGNjLlJlYWxDdXJ2ZVxuICoga2V5ZnJhbWVzLCBjYy5HcmFkaWVudCBhbHBoYSBrZXlzLCBvciBhbnkgb3RoZXIgYXJyYXktb2YtcGxhaW4tb2JqZWN0IGZpZWxkIOKAlCBoYWQgZXZlcnlcbiAqIGVsZW1lbnQgdHVybmVkIGludG8gYE5hTmAgLyBgXCJbb2JqZWN0IE9iamVjdF1cImAgYW5kIHdyaXR0ZW4gdG8gdGhlIHNjZW5lIG9uIGEgYHN1Y2Nlc3NgXG4gKiByZXNwb25zZS4gTmVpdGhlciBpcyBhIHZhbHVlIGFueW9uZSBtZWFudCB0byB3cml0ZSwgc28gcmVmdXNpbmcgYmVhdHMgY29lcmNpbmcuXG4gKi9cbmZ1bmN0aW9uIGFzc2VydEFycmF5SXRlbUlzUHJpbWl0aXZlKHByb3BlcnR5VHlwZTogc3RyaW5nLCBpdGVtOiBhbnkpOiB2b2lkIHtcbiAgICBpZiAoaXRlbSAhPT0gbnVsbCAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYCR7cHJvcGVydHlUeXBlfSBpdGVtcyBtdXN0IGJlIHByaW1pdGl2ZXMgKHJlY2VpdmVkICR7QXJyYXkuaXNBcnJheShpdGVtKSA/ICdhcnJheScgOiAnb2JqZWN0J30pLiBgICtcbiAgICAgICAgICAgIGBBcnJheS1vZi1PQkpFQ1QgZmllbGRzIChlLmcuIGEgY2MuUmVhbEN1cnZlIHNwbGluZSdzIGtleUZyYW1lcywgYSBjYy5HcmFkaWVudCdzIGFscGhhS2V5cykgYCArXG4gICAgICAgICAgICBgYXJlIHdyaXR0ZW4gd2l0aCBwcm9wZXJ0eVR5cGUgJ29iamVjdEFycmF5JyDigJQgbm8gdmFsdWUgd2FzIHdyaXR0ZW4gKGlzc3VlICM2NikuYFxuICAgICAgICApO1xuICAgIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUGxhaW5PYmplY3QodjogYW55KTogdiBpcyBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICByZXR1cm4gdiAhPT0gbnVsbCAmJiB0eXBlb2YgdiA9PT0gJ29iamVjdCcgJiYgIUFycmF5LmlzQXJyYXkodik7XG59XG5cbi8qKlxuICogQ29tcGFyZSBhbiBgb2JqZWN0QXJyYXlgIHJlcXVlc3QgYWdhaW5zdCB0aGUgZWRpdG9yJ3MgcmVhZC1iYWNrIChpc3N1ZSAjNjYpLlxuICpcbiAqIFRoZSByZWFkLWJhY2sgd3JhcHMgZXZlcnkgbm9kZSBvZiB0aGUgdHJlZSBhcyBhIGR1bXAgKGB7IHZhbHVlLCB0eXBlLCAuLi4gfWApLCBzbyB0aGVcbiAqIGNvbXBhcmlzb24gd2Fsa3MgdGhlIFJFUVVFU1RFRCBzdHJ1Y3R1cmUgYW5kIHVud3JhcHMgdGhlIGR1bXAgYWxvbmdzaWRlIGl0LiBFeHRyYSBrZXlzIHRoZVxuICogZWRpdG9yIHJlcG9ydHMgKGludGVybmFsIGlkcywgZGVmYXVsdHMgZm9yIGZpZWxkcyB0aGUgY2FsbGVyIG5ldmVyIG5hbWVkKSBhcmUgaWdub3JlZDsgYVxuICogcmVxdWVzdGVkIGxlYWYgdGhhdCBpcyBtaXNzaW5nIG9yIGRpZmZlcmVudCBmYWlscyB0aGUgbWF0Y2guXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXRjaGVzUmVxdWVzdGVkU3RydWN0dXJlKGV4cGVjdGVkOiBhbnksIGR1bXA6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkKSkge1xuICAgICAgICBjb25zdCBhY3R1YWwgPSBBcnJheS5pc0FycmF5KGR1bXApID8gZHVtcCA6IGR1bXA/LnZhbHVlO1xuICAgICAgICByZXR1cm4gQXJyYXkuaXNBcnJheShhY3R1YWwpICYmIGFjdHVhbC5sZW5ndGggPT09IGV4cGVjdGVkLmxlbmd0aCAmJlxuICAgICAgICAgICAgZXhwZWN0ZWQuZXZlcnkoKGUsIGkpID0+IG1hdGNoZXNSZXF1ZXN0ZWRTdHJ1Y3R1cmUoZSwgYWN0dWFsW2ldKSk7XG4gICAgfVxuICAgIGlmIChpc1BsYWluT2JqZWN0KGV4cGVjdGVkKSkge1xuICAgICAgICBpZiAoIWlzUGxhaW5PYmplY3QoZHVtcCkpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgZmllbGRzID0gaXNQbGFpbk9iamVjdChkdW1wLnZhbHVlKSA/IGR1bXAudmFsdWUgOiBkdW1wO1xuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMoZXhwZWN0ZWQpLmV2ZXJ5KGsgPT4gbWF0Y2hlc1JlcXVlc3RlZFN0cnVjdHVyZShleHBlY3RlZFtrXSwgZmllbGRzW2tdKSk7XG4gICAgfVxuICAgIGNvbnN0IGFjdHVhbCA9IGlzUGxhaW5PYmplY3QoZHVtcCkgJiYgJ3ZhbHVlJyBpbiBkdW1wID8gZHVtcC52YWx1ZSA6IGR1bXA7XG4gICAgaWYgKHR5cGVvZiBleHBlY3RlZCA9PT0gJ251bWJlcicgfHwgdHlwZW9mIGFjdHVhbCA9PT0gJ251bWJlcicpIHJldHVybiBOdW1iZXIoYWN0dWFsKSA9PT0gTnVtYmVyKGV4cGVjdGVkKTtcbiAgICByZXR1cm4gYWN0dWFsID09PSBleHBlY3RlZDtcbn1cblxuLyoqXG4gKiBSZXR1cm4gYSBjb21wb25lbnQgZHVtcCdzIHByb3BlcnR5IG1hcC5cbiAqXG4gKiBgc2NlbmU6cXVlcnktbm9kZWAgc2hhcGVzIGVhY2ggYF9fY29tcHNfX2AgZW50cnkgYXNcbiAqIGB7IF9fdHlwZV9fLCBjaWQsIHR5cGUsIGVuYWJsZWQsIHZhbHVlOiB7IDxwcm9wPjogeyBuYW1lLCB2YWx1ZSwgdHlwZSB9IH0gfWAg4oCUIHRoZSBsaXZlXG4gKiBwcm9wZXJ0eSB2YWx1ZXMgbGl2ZSB1bmRlciBgdmFsdWVgLiBUaGUgZmFsbGJhY2sgY292ZXJzIGR1bXBzIHRoYXQgaW5saW5lIHRoZWlyXG4gKiBwcm9wZXJ0aWVzIGluc3RlYWQgb2YgbmVzdGluZyB0aGVtLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdENvbXBvbmVudFByb3BlcnR5RHVtcChjb21wb25lbnQ6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIGlmIChjb21wb25lbnQ/LnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQudmFsdWUgPT09ICdvYmplY3QnKSByZXR1cm4gY29tcG9uZW50LnZhbHVlO1xuXG4gICAgY29uc3QgcHJvcGVydGllczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgIGlmICghY29tcG9uZW50IHx8IHR5cGVvZiBjb21wb25lbnQgIT09ICdvYmplY3QnKSByZXR1cm4gcHJvcGVydGllcztcbiAgICBjb25zdCBleGNsdWRlS2V5cyA9IFsnX190eXBlX18nLCAnZW5hYmxlZCcsICdub2RlJywgJ19pZCcsICdfX3NjcmlwdEFzc2V0JywgJ3V1aWQnLCAnbmFtZScsICdfbmFtZScsICdfb2JqRmxhZ3MnLCAnX2VuYWJsZWQnLCAndHlwZScsICdyZWFkb25seScsICd2aXNpYmxlJywgJ2NpZCcsICdlZGl0b3InLCAnZXh0ZW5kcyddO1xuICAgIGZvciAoY29uc3Qga2V5IGluIGNvbXBvbmVudCkge1xuICAgICAgICBpZiAoIWV4Y2x1ZGVLZXlzLmluY2x1ZGVzKGtleSkgJiYgIWtleS5zdGFydHNXaXRoKCdfJykpIHtcbiAgICAgICAgICAgIHByb3BlcnRpZXNba2V5XSA9IGNvbXBvbmVudFtrZXldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBwcm9wZXJ0aWVzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGV4aXN0czogYm9vbGVhbjtcbiAgICB0eXBlOiBzdHJpbmc7XG4gICAgYXZhaWxhYmxlUHJvcGVydGllczogc3RyaW5nW107XG4gICAgb3JpZ2luYWxWYWx1ZTogYW55O1xuICAgIC8qKlxuICAgICAqIFNldCB3aGVuIHRoZSByZXF1ZXN0ZWQgZG90dGVkIHBhdGggaW5kZXhlcyBPTkUgUEFTVCB0aGUgZW5kIG9mIGFuIGV4aXN0aW5nIGFycmF5XG4gICAgICogKGBwcmljZUxhYmVscy4wYCBvbiBhbiBlbXB0eSBhcnJheSwgYHNsb3RzLjNgIG9uIGEgMy1lbGVtZW50IG9uZSDigJQgaXNzdWUgIzY4KS4gVGhlXG4gICAgICogZWxlbWVudCBkb2VzIG5vdCBleGlzdCB5ZXQsIHNvIHRoZSBlZGl0b3IgbXVzdCBncm93IHRoZSBhcnJheSBiZWZvcmUgaXQgY2FuIGJlIHdyaXR0ZW4uXG4gICAgICovXG4gICAgYXBwZW5kVG8/OiB7IGFycmF5UHJvcGVydHk6IHN0cmluZzsgY3VycmVudExlbmd0aDogbnVtYmVyIH07XG4gICAgLyoqIFdoeSBhIG5vdC1mb3VuZCBsb29rdXAgZmFpbGVkIHdoZW4gdGhlIGNhdXNlIGlzIG1vcmUgc3BlY2lmaWMgdGhhbiBcIm5vIHN1Y2ggbmFtZVwiLiAqL1xuICAgIG5vdEZvdW5kSGludD86IHN0cmluZztcbn1cblxuLyoqIFJldHVybnMgdHJ1ZSBpZiBwcm9wRGF0YSBsb29rcyBsaWtlIGEgQ29jb3MgQ3JlYXRvciBwcm9wZXJ0eSBkZXNjcmlwdG9yIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3IocHJvcERhdGE6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmICh0eXBlb2YgcHJvcERhdGEgIT09ICdvYmplY3QnIHx8IHByb3BEYXRhID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhKTtcbiAgICAgICAgLy8gU2tpcCBzaW1wbGUgdmFsdWUgb2JqZWN0cyBsaWtlIHt3aWR0aDogMjAwLCBoZWlnaHQ6IDE1MH1cbiAgICAgICAgY29uc3QgaXNTaW1wbGVWYWx1ZU9iamVjdCA9IGtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHYgPSBwcm9wRGF0YVtrZXldO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHYgPT09ICdib29sZWFuJztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpc1NpbXBsZVZhbHVlT2JqZWN0KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGhhc05hbWUgPSBrZXlzLmluY2x1ZGVzKCduYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1ZhbHVlID0ga2V5cy5pbmNsdWRlcygndmFsdWUnKTtcbiAgICAgICAgY29uc3QgaGFzVHlwZSA9IGtleXMuaW5jbHVkZXMoJ3R5cGUnKTtcbiAgICAgICAgY29uc3QgaGFzRGlzcGxheU5hbWUgPSBrZXlzLmluY2x1ZGVzKCdkaXNwbGF5TmFtZScpO1xuICAgICAgICBjb25zdCBoYXNSZWFkb25seSA9IGtleXMuaW5jbHVkZXMoJ3JlYWRvbmx5Jyk7XG4gICAgICAgIGNvbnN0IGhhc1ZhbGlkU3RydWN0dXJlID0gKGhhc05hbWUgfHwgaGFzVmFsdWUpICYmIChoYXNUeXBlIHx8IGhhc0Rpc3BsYXlOYW1lIHx8IGhhc1JlYWRvbmx5KTtcbiAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ2RlZmF1bHQnKSAmJiBwcm9wRGF0YS5kZWZhdWx0ICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgY29uc3QgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhwcm9wRGF0YS5kZWZhdWx0KTtcbiAgICAgICAgICAgIGlmIChkZWZhdWx0S2V5cy5pbmNsdWRlcygndmFsdWUnKSAmJiB0eXBlb2YgcHJvcERhdGEuZGVmYXVsdC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhc1ZhbGlkU3RydWN0dXJlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKiogQW5hbHl6ZSBhIGNvbXBvbmVudCdzIHByb3BlcnR5IHRvIGRldGVybWluZSBpdHMgdHlwZSBhbmQgY3VycmVudCB2YWx1ZS5cbiAqICBTdXBwb3J0cyBkb3R0ZWQgcHJvcGVydHlOYW1lIGZvciBuZXN0ZWQgQ0NDbGFzcyBncm91cHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVQcm9wZXJ0eShjb21wb25lbnQ6IGFueSwgcHJvcGVydHlOYW1lOiBzdHJpbmcpOiBQcm9wZXJ0eUFuYWx5c2lzUmVzdWx0IHtcbiAgICBjb25zdCBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxldCBwcm9wZXJ0eVZhbHVlOiBhbnkgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHByb3BlcnR5RXhpc3RzID0gZmFsc2U7XG4gICAgbGV0IG5vdEZvdW5kSGludDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG4gICAgLy8gTWV0aG9kIDE6IGRpcmVjdCBwcm9wZXJ0eSBhY2Nlc3MgKGZsYXQgcGF0aCBvbmx5KVxuICAgIGlmICghcHJvcGVydHlOYW1lLmluY2x1ZGVzKCcuJykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwgcHJvcGVydHlOYW1lKSkge1xuICAgICAgICBwcm9wZXJ0eVZhbHVlID0gY29tcG9uZW50W3Byb3BlcnR5TmFtZV07XG4gICAgICAgIHByb3BlcnR5RXhpc3RzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBNZXRob2QgMjogc2VhcmNoIG5lc3RlZCBwcm9wZXJ0aWVzIHN0cnVjdHVyZSAoQ29jb3MgQ3JlYXRvciBjb21wb25lbnQgZHVtcCBmb3JtYXQpLlxuICAgIC8vICBGb3IgZG90dGVkIG5hbWVzIGxpa2UgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIiwgd2FsayBzZWdtZW50cyB0aHJvdWdoIG5lc3RlZCBgLnZhbHVlYCBkdW1wcy5cbiAgICBpZiAoIXByb3BlcnR5RXhpc3RzICYmIGNvbXBvbmVudC5wcm9wZXJ0aWVzICYmIHR5cGVvZiBjb21wb25lbnQucHJvcGVydGllcyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgY29uc3QgdmFsdWVFbnRyeSA9IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlO1xuICAgICAgICAvLyBgZ2V0Q29tcG9uZW50c2AgaGFzIGFscmVhZHkgdW53cmFwcGVkIHRoZSBxdWVyeS1ub2RlIGNvbXBvbmVudCBlbnZlbG9wZSwgc28gYVxuICAgICAgICAvLyBwcm9wZXJ0eSBtYXAgbWF5IGl0c2VsZiBjb250YWluIGEgdXNlciBwcm9wZXJ0eSBuYW1lZCBgdmFsdWVgLiBPbmx5IHVud3JhcCB0aGF0XG4gICAgICAgIC8vIGtleSB3aGVuIGl0IGlzIGEgY29udGFpbmVyLCBub3Qgd2hlbiBpdCBpcyB0aGUgcHJvcGVydHkncyBkZXNjcmlwdG9yLlxuICAgICAgICBjb25zdCB2YWx1ZUVudHJ5SXNEZXNjcmlwdG9yID0gaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZUVudHJ5KSAmJiAoXG4gICAgICAgICAgICB0eXBlb2YgdmFsdWVFbnRyeS5uYW1lID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlRW50cnkuZGlzcGxheU5hbWUgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICB0eXBlb2YgdmFsdWVFbnRyeS50eXBlID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgdHlwZW9mIHZhbHVlRW50cnkucmVhZG9ubHkgPT09ICdib29sZWFuJ1xuICAgICAgICApO1xuICAgICAgICBjb25zdCByb290VmFsdWVPYmogPSB2YWx1ZUVudHJ5ICYmIHR5cGVvZiB2YWx1ZUVudHJ5ID09PSAnb2JqZWN0JyAmJiAhdmFsdWVFbnRyeUlzRGVzY3JpcHRvclxuICAgICAgICAgICAgPyB2YWx1ZUVudHJ5XG4gICAgICAgICAgICA6IGNvbXBvbmVudC5wcm9wZXJ0aWVzO1xuXG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHlOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBjdXJzb3I6IGFueSA9IHJvb3RWYWx1ZU9iajtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50ID0gc2VnbWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAvLyBQb3B1bGF0ZSBhdmFpbGFibGVQcm9wZXJ0aWVzIGF0IHRoZSByZWxldmFudCBsZXZlbCAocm9vdCBvciBmaW5hbCBjb250YWluZXIpXG4gICAgICAgICAgICBpZiAoaSA9PT0gMCB8fCAoaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhjdXJzb3IgfHwge30pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChrICE9PSAndXVpZCcgJiYgdiAmJiB0eXBlb2YgdiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGkgPT09IDAgPyAnJyA6IGAke3NlZ21lbnRzLnNsaWNlKDAsIGkpLmpvaW4oJy4nKX0uYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZVByb3BlcnRpZXMucHVzaChgJHtwcmVmaXh9JHtrfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkZXNjcmlwdG9yID0gY3Vyc29yID8gY3Vyc29yW3NlZ21lbnRdIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM2ODogYW4gaW5kZXggcGFzdCB0aGUgZW5kIG9mIGFuIGFycmF5LiBgbGVuZ3RoYCBpdHNlbGYgaXMgdGhlIGFwcGVuZFxuICAgICAgICAgICAgICAgIC8vIHNsb3Q7IGFueXRoaW5nIGZ1cnRoZXIgb3V0IGlzIGEgZ2VudWluZSBnYXAgdGhlIGNhbGxlciBtdXN0IGZpbGwgaW4gb3JkZXIuXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY3Vyc29yKSAmJiAvXlxcZCskLy50ZXN0KHNlZ21lbnQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFycmF5UHJvcGVydHkgPSBzZWdtZW50cy5zbGljZSgwLCBpKS5qb2luKCcuJyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0xlYWYgJiYgTnVtYmVyKHNlZ21lbnQpID09PSBjdXJzb3IubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4aXN0czogdHJ1ZSwgdHlwZTogJ3Vua25vd24nLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXBwZW5kVG86IHsgYXJyYXlQcm9wZXJ0eSwgY3VycmVudExlbmd0aDogY3Vyc29yLmxlbmd0aCB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIG5vdEZvdW5kSGludCA9IGAnJHthcnJheVByb3BlcnR5fScgaXMgYW4gYXJyYXkgd2l0aCAke2N1cnNvci5sZW5ndGh9IGVsZW1lbnQocyk7IGluZGV4ICR7c2VnbWVudH0gaXMgb3V0IG9mIHJhbmdlLiBgICtcbiAgICAgICAgICAgICAgICAgICAgICAgIGBXcml0ZSBpbmRleCAke2N1cnNvci5sZW5ndGh9IGZpcnN0IChpdCBhcHBlbmRzKSwgb3Igc2V0IHRoZSB3aG9sZSBhcnJheSB3aXRoIGFuIGFycmF5IHByb3BlcnR5VHlwZS5gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjdXJzb3IgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc0xlYWYpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihkZXNjcmlwdG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkS2V5cyA9IE9iamVjdC5rZXlzKGRlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZEtleXMuaW5jbHVkZXMoJ3ZhbHVlJykgPyBkZXNjcmlwdG9yLnZhbHVlIDogZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEZXNjZW5kIGludG8gdGhlIG5lc3RlZCBDQ0NsYXNzIGdyb3VwOiBkZXNjcmlwdG9yLnZhbHVlIGhvbGRzIHRoZSBpbm5lciBkdW1wLlxuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvci52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSBkZXNjcmlwdG9yLnZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ldGhvZCAzOiBjb2xsZWN0IHNpbXBsZSBwcm9wZXJ0eSBuYW1lcyBmcm9tIGRpcmVjdCBrZXlzIGFzIGZhbGxiYWNrXG4gICAgaWYgKGF2YWlsYWJsZVByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGNvbXBvbmVudCkpIHtcbiAgICAgICAgICAgIGlmICgha2V5LnN0YXJ0c1dpdGgoJ18nKSAmJiAhWydfX3R5cGVfXycsICdjaWQnLCAnbm9kZScsICd1dWlkJywgJ25hbWUnLCAnZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnXS5pbmNsdWRlcyhrZXkpKSB7XG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByb3BlcnR5RXhpc3RzKSB7XG4gICAgICAgIHJldHVybiB7IGV4aXN0czogZmFsc2UsIHR5cGU6ICd1bmtub3duJywgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogdW5kZWZpbmVkLCBub3RGb3VuZEhpbnQgfTtcbiAgICB9XG5cbiAgICAvLyBJbmZlciB0eXBlIGZyb20gdmFsdWUgc3RydWN0dXJlXG4gICAgbGV0IHR5cGUgPSAndW5rbm93bic7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcGVydHlWYWx1ZSkpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykpIHR5cGUgPSAnbm9kZUFycmF5JztcbiAgICAgICAgZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NvbG9yJykpIHR5cGUgPSAnY29sb3JBcnJheSc7XG4gICAgICAgIGVsc2UgdHlwZSA9ICdhcnJheSc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdHlwZSA9IFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpID8gJ2Fzc2V0JyA6ICdzdHJpbmcnO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHR5cGUgPSAnbnVtYmVyJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdHlwZSA9ICdib29sZWFuJztcbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VmFsdWUgJiYgdHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcGVydHlWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygncicpICYmIGtleXMuaW5jbHVkZXMoJ2cnKSAmJiBrZXlzLmluY2x1ZGVzKCdiJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ2NvbG9yJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygneCcpICYmIGtleXMuaW5jbHVkZXMoJ3knKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSBwcm9wZXJ0eVZhbHVlLnogIT09IHVuZGVmaW5lZCA/ICd2ZWMzJyA6ICd2ZWMyJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygnd2lkdGgnKSAmJiBrZXlzLmluY2x1ZGVzKCdoZWlnaHQnKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnc2l6ZSc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3V1aWQnKSB8fCBrZXlzLmluY2x1ZGVzKCdfX3V1aWRfXycpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSB8fCBrZXlzLmluY2x1ZGVzKCdfX2lkX18nKSkgPyAnbm9kZScgOiAnYXNzZXQnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCdfX2lkX18nKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnbm9kZSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICB0eXBlID0gJ29iamVjdCc7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VmFsdWUgPT09IG51bGwgfHwgcHJvcGVydHlWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddLmluY2x1ZGVzKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdhc3NldCc7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSB8fCBwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGFyZ2V0JykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbm9kZSc7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NvbXBvbmVudCcpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2NvbXBvbmVudCc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBleGlzdHM6IHRydWUsIHR5cGUsIGF2YWlsYWJsZVByb3BlcnRpZXMsIG9yaWdpbmFsVmFsdWU6IHByb3BlcnR5VmFsdWUgfTtcbn1cblxuLyoqIFBhcnNlIGEgaGV4IGNvbG9yIHN0cmluZyAoI1JHQiBvciAjUkdCQSkgdG8gYW4gUkdCQSBvYmplY3QgKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvbG9yU3RyaW5nKGNvbG9yU3RyOiBzdHJpbmcpOiB7IHI6IG51bWJlcjsgZzogbnVtYmVyOyBiOiBudW1iZXI7IGE6IG51bWJlciB9IHtcbiAgICBjb25zdCBzdHIgPSBjb2xvclN0ci50cmltKCk7XG4gICAgaWYgKHN0ci5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygxLCAzKSwgMTYpLFxuICAgICAgICAgICAgICAgIGc6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMywgNSksIDE2KSxcbiAgICAgICAgICAgICAgICBiOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDUsIDcpLCAxNiksXG4gICAgICAgICAgICAgICAgYTogMjU1XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHN0ci5sZW5ndGggPT09IDkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygxLCAzKSwgMTYpLFxuICAgICAgICAgICAgICAgIGc6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMywgNSksIDE2KSxcbiAgICAgICAgICAgICAgICBiOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDUsIDcpLCAxNiksXG4gICAgICAgICAgICAgICAgYTogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg3LCA5KSwgMTYpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjb2xvciBmb3JtYXQ6IFwiJHtjb2xvclN0cn1cIi4gT25seSBoZXhhZGVjaW1hbCBmb3JtYXQgaXMgc3VwcG9ydGVkIChlLmcuLCBcIiNGRjAwMDBcIiBvciBcIiNGRjAwMDBGRlwiKWApO1xufVxuXG4vKipcbiAqIENvY29zIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eSB0eXBlcy4gRXZlcnkgb25lIG9mIHRoZXNlIHNlcmlhbGl6ZXMgaWRlbnRpY2FsbHkgYXNcbiAqIGB7IHV1aWQgfWAgKGlzc3VlICMyNiDigJQgcHJvcGVydHlUeXBlPVwibWF0ZXJpYWxcIiBhbmQgZnJpZW5kcyBwcmV2aW91c2x5IGZlbGwgdGhyb3VnaCB0b1xuICogYFVuc3VwcG9ydGVkIHByb3BlcnR5IHR5cGVgLCBldmVuIHRob3VnaCB0aGUgZXhpc3Rpbmcgc3ByaXRlRnJhbWUvcHJlZmFiL2Fzc2V0IGNvZXJjaW9uXG4gKiBhbHJlYWR5IHByb2R1Y2VzIHRoZSBjb3JyZWN0IHNoYXBlIGZvciB0aGVtKS5cbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyA9IFtcbiAgICAnc3ByaXRlRnJhbWUnLCAncHJlZmFiJywgJ2Fzc2V0JyxcbiAgICAnbWF0ZXJpYWwnLCAndGV4dHVyZScsICdzcHJpdGVBdGxhcycsICdhdWRpb0NsaXAnLCAnZm9udCcsICdhbmltYXRpb25DbGlwJyxcbiAgICAnbWVzaCcsICdza2VsZXRvbicsICdwaHlzaWNzTWF0ZXJpYWwnLCAncmVuZGVyVGV4dHVyZScsICd0ZXh0QXNzZXQnLCAnanNvbkFzc2V0JyxcbiAgICAncGFydGljbGVBc3NldCcsICdzY2VuZUFzc2V0J1xuXSBhcyBjb25zdDtcblxuLyoqXG4gKiBFeHBsaWNpdCBwcm9wZXJ0eVR5cGUgLT4gQ29jb3MgYXNzZXQgY2xhc3MgZm9yIHRoZSBFZGl0b3IgYHNldC1wcm9wZXJ0eWAgZHVtcCBgdHlwZWAgZmllbGQuXG4gKlxuICogUmVzb2x2ZWQgZnJvbSB0aGUgcHJvcGVydHlUeXBlIGl0c2VsZiwgTk9UIGZyb20gdGhlIHByb3BlcnR5IG5hbWUuIFRoZSBsZWdhY3kgbmFtZS1iYXNlZFxuICogaGV1cmlzdGljIGluIGBhcHBseVByb3BlcnR5VG9FZGl0b3JgIG1pcy1yZXNvbHZlcyBhbnkgYXNzZXQgcHJvcGVydHkgd2hvc2UgbmFtZSBsYWNrcyB0aGVcbiAqIG1hdGNoaW5nIGtleXdvcmQg4oCUIGEgYGNjLk1hdGVyaWFsYCBwcm9wZXJ0eSBjYWxsZWQgYHNraW5gIHJlc29sdmVkIHRvIGBjYy5TcHJpdGVGcmFtZWAuXG4gKlxuICogVGhlIGdlbmVyaWMgYGFzc2V0YCBhbmQgYHN0cmluZ2Agc3BlbGxpbmdzIGNhcnJ5IG5vIHR5cGUgaW5mb3JtYXRpb24sIHNvIHRoZXkgZGVsaWJlcmF0ZWx5XG4gKiBoYXZlIE5PIGVudHJ5IGhlcmUgYW5kIGtlZXAgdXNpbmcgdGhlIG5hbWUgaGV1cmlzdGljICh1bmNoYW5nZWQgYmVoYXZpb3VyIGZvciBleGlzdGluZyBjYWxsZXJzKS5cbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRTogUmVhZG9ubHk8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4gPSB7XG4gICAgbWF0ZXJpYWw6ICdjYy5NYXRlcmlhbCcsXG4gICAgdGV4dHVyZTogJ2NjLlRleHR1cmUyRCcsXG4gICAgc3ByaXRlRnJhbWU6ICdjYy5TcHJpdGVGcmFtZScsXG4gICAgc3ByaXRlQXRsYXM6ICdjYy5TcHJpdGVBdGxhcycsXG4gICAgcHJlZmFiOiAnY2MuUHJlZmFiJyxcbiAgICBhdWRpb0NsaXA6ICdjYy5BdWRpb0NsaXAnLFxuICAgIGZvbnQ6ICdjYy5Gb250JyxcbiAgICBhbmltYXRpb25DbGlwOiAnY2MuQW5pbWF0aW9uQ2xpcCcsXG4gICAgbWVzaDogJ2NjLk1lc2gnLFxuICAgIHNrZWxldG9uOiAnY2MuU2tlbGV0b24nLFxuICAgIHBoeXNpY3NNYXRlcmlhbDogJ2NjLlBoeXNpY3NNYXRlcmlhbCcsXG4gICAgcmVuZGVyVGV4dHVyZTogJ2NjLlJlbmRlclRleHR1cmUnLFxuICAgIHRleHRBc3NldDogJ2NjLlRleHRBc3NldCcsXG4gICAganNvbkFzc2V0OiAnY2MuSnNvbkFzc2V0JyxcbiAgICBwYXJ0aWNsZUFzc2V0OiAnY2MuUGFydGljbGVBc3NldCcsXG4gICAgc2NlbmVBc3NldDogJ2NjLlNjZW5lQXNzZXQnXG59O1xuXG4vKiogRXZlcnkgcHJvcGVydHlUeXBlIGNvbnZlcnRQcm9wZXJ0eVZhbHVlIGFjY2VwdHMg4oCUIHVzZWQgdG8gYnVpbGQgYW4gYWN0aW9uYWJsZSBlcnJvciBtZXNzYWdlLiAqL1xuZXhwb3J0IGNvbnN0IFNVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUyA9IFtcbiAgICAnc3RyaW5nJywgJ251bWJlcicsICdpbnRlZ2VyJywgJ2Zsb2F0JywgJ2Jvb2xlYW4nLFxuICAgICdjb2xvcicsICd2ZWMyJywgJ3ZlYzMnLCAnc2l6ZScsXG4gICAgJ25vZGUnLCAnY29tcG9uZW50JyxcbiAgICAuLi5BU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMsXG4gICAgJ25vZGVBcnJheScsICdjb2xvckFycmF5JywgJ251bWJlckFycmF5JywgJ3N0cmluZ0FycmF5JywgJ2NvbXBvbmVudEFycmF5JywgJ2Fzc2V0QXJyYXknLFxuICAgICdvYmplY3RBcnJheSdcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogQ29udmVydCBhIHJhdyBMTE0tc3VwcGxpZWQgdmFsdWUgdG8gdGhlIGNvcnJlY3QgZm9ybWF0IGZvciBhIGdpdmVuIHByb3BlcnR5VHlwZS5cbiAqIFRocm93cyBpZiB0aGUgdmFsdWUgZm9ybWF0IGlzIGludmFsaWQgZm9yIHRoZSBnaXZlbiB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIC8vIElzc3VlICM3NTogbmVpdGhlciBgbnVsbGAgbm9yIGBcIlwiYCBjb3VsZCBjbGVhciBhIG5vZGUvY29tcG9uZW50L2Fzc2V0IHJlZmVyZW5jZS5cbiAgICAvLyBgbm9kZWAgYW5kIGV2ZXJ5IGFzc2V0LXJlZmVyZW5jZSB0eXBlIGFscmVhZHkgZm9yd2FyZGVkIGBcIlwiYCB1bnJlamVjdGVkIChpdCBoYXBwZW5zXG4gICAgLy8gdG8gc2F0aXNmeSB0aGUgYHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZydgIGNoZWNrIGJlbG93IGFuZCBiZWNvbWUgYHsgdXVpZDogJycgfWApLFxuICAgIC8vIGJ1dCByZWplY3RlZCBgbnVsbGAgb3V0cmlnaHQuIGBjb21wb25lbnRgL2Bjb21wb25lbnRBcnJheWAgYWRkaXRpb25hbGx5IGZvcndhcmRlZCBhXG4gICAgLy8gYFwiXCJgIHZhbHVlIFVOUkVTT0xWRUQgaW5zdGVhZCBvZiB0cmVhdGluZyBpdCBhcyBcImNsZWFyIHRoaXMgcmVmZXJlbmNlXCIsIHdoaWNoIHRoZW5cbiAgICAvLyBmYWlsZWQgZG93bnN0cmVhbSB3aXRoIGEgY29uZnVzaW5nIFwibmVpdGhlciBhIE5vZGUgdXVpZCBub3IgYSBjb21wb25lbnQgdXVpZFwiIGVycm9yLlxuICAgIC8vIEEgY2xlYXJlZCBzaW5nbGUgcmVmZXJlbmNlIGFsd2F5cyBzZXJpYWxpemVzIGFzIGB7IHV1aWQ6ICcnIH1gIOKAlCB0aGUgc2FtZSBzaGFwZSBhXG4gICAgLy8gc2V0IHJlZmVyZW5jZSB1c2VzIOKAlCBzbyBpdCBuZWVkcyBubyBzcGVjaWFsIGhhbmRsaW5nIGFueXdoZXJlIHNldC1wcm9wZXJ0eSBhbHJlYWR5XG4gICAgLy8gaGFuZGxlcyBhIHJlZmVyZW5jZSBkdW1wLlxuICAgIGNvbnN0IGlzQ2xlYXJSZXF1ZXN0ID0gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09ICcnO1xuICAgIGlmIChpc0NsZWFyUmVxdWVzdCAmJiAocHJvcGVydHlUeXBlID09PSAnbm9kZScgfHwgcHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50JyB8fFxuICAgICAgICAoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSkge1xuICAgICAgICByZXR1cm4geyB1dWlkOiAnJyB9O1xuICAgIH1cbiAgICBpZiAoaXNDbGVhclJlcXVlc3QgJiYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudEFycmF5JyB8fCBwcm9wZXJ0eVR5cGUgPT09ICdhc3NldEFycmF5JykpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICAvLyBJc3N1ZSAjNzI6IGEgd2hvbGUtYXJyYXkgd3JpdGUgKGBzaGFyZWRNYXRlcmlhbHM6IFt1dWlkLCAuLi5dYCkgaXMgdGhlIGZvcm0gY2FsbGVyc1xuICAgICAgICAvLyByZWFjaCBmb3IgZmlyc3Q7IG5hbWUgdGhlIHByb3BlcnR5VHlwZSB0aGF0IGNhcnJpZXMgaXQgaW5zdGVhZCBvZiBhIGJhcmUgdHlwZSBlcnJvci5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc2luZ2xlIHN0cmluZyBVVUlELCBidXQgYW4gYXJyYXkgd2FzIHJlY2VpdmVkLiBgICtcbiAgICAgICAgICAgICAgICBgVG8gd3JpdGUgYW4gYXJyYXkgb2YgYXNzZXRzIChlLmcuIGNjLk1lc2hSZW5kZXJlci5zaGFyZWRNYXRlcmlhbHMpIHVzZSBwcm9wZXJ0eVR5cGUgJ2Fzc2V0QXJyYXknLCBgICtcbiAgICAgICAgICAgICAgICBgb3Igd3JpdGUgb25lIGVsZW1lbnQgYXQgYSB0aW1lIHdpdGggYSBkb3R0ZWQgaW5kZXggKCdzaGFyZWRNYXRlcmlhbHMuMCcsIHdoaWNoIGFwcGVuZHMgYXQgdGhlIGVuZCBvZiB0aGUgYXJyYXkpLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BlcnR5VHlwZX0gdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgIH1cbiAgICBzd2l0Y2ggKHByb3BlcnR5VHlwZSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgLy8gSXNzdWUgIzExNjogYFN0cmluZyh2YWx1ZSlgIHR1cm5zIGFueSBvYmplY3QgaW50byB0aGUgbGl0ZXJhbCB0ZXh0XG4gICAgICAgICAgICAvLyBcIltvYmplY3QgT2JqZWN0XVwiIChhbmQgYW55IGFycmF5IGludG8gYSBjb21tYS1qb2luZWQgbGlzdCksIHdoaWNoIHdhcyB0aGVuXG4gICAgICAgICAgICAvLyB3cml0dGVuIHRvIHRoZSBzY2VuZSB3aXRoIHN1Y2Nlc3M6dHJ1ZSDigJQgc2lsZW50IGRhdGEgbG9zcyBvbiBhIHBsYWluIHN0cmluZ1xuICAgICAgICAgICAgLy8gZmllbGQuIFJlamVjdCBhbnl0aGluZyBub24tcHJpbWl0aXZlLCBuYW1pbmcgdGhlIHJlY2VpdmVkIHR5cGUsIGluc3RlYWQgb2ZcbiAgICAgICAgICAgIC8vIHdyaXRpbmcgYSBsb3NzeSBwbGFjZWhvbGRlci4gTWlycm9ycyB0aGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCBhYm92ZS5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICBgc3RyaW5nIHZhbHVlIG11c3QgYmUgYSBwcmltaXRpdmUgKHJlY2VpdmVkICR7QXJyYXkuaXNBcnJheSh2YWx1ZSkgPyAnYXJyYXknIDogJ29iamVjdCd9KTsgYCArXG4gICAgICAgICAgICAgICAgICAgICdwYXNzIEpTT04tZW5jb2RlZCB0ZXh0IGlmIGEgc3RydWN0dXJlZCBwYXlsb2FkIHdhcyBpbnRlbmRlZCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzdHJpbmcgdmFsdWUgbXVzdCBiZSBhIHByaW1pdGl2ZSAocmVjZWl2ZWQgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gICAgICAgIGNhc2UgJ251bWJlcic6IGNhc2UgJ2ludGVnZXInOiBjYXNlICdmbG9hdCc6XG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzc2OiBgQm9vbGVhbihcImZhbHNlXCIpYCBpcyBgdHJ1ZWAuIEEgdHJhbnNwb3J0IHRoYXQgc3RyaW5naWZpZXNcbiAgICAgICAgICAgICAgICAvLyBhcmd1bWVudHMgZGVsaXZlcnMgdGhlIHRleHQgXCJmYWxzZVwiLCB3aGljaCBiZWNhbWUgYSB3cml0ZSBvZiBgdHJ1ZWA7IGFnYWluc3RcbiAgICAgICAgICAgICAgICAvLyBhIHByb3BlcnR5IGFscmVhZHkgaG9sZGluZyBgdHJ1ZWAgdGhlIHJlYWQtYmFjayBtYXRjaGVkIGFuZCB0aGUgdG9vbCByZXBvcnRlZFxuICAgICAgICAgICAgICAgIC8vIGBjaGFuZ2VWZXJpZmllZDogdHJ1ZWAgZm9yIGEgdmFsdWUgdGhlIGNhbGxlciBuZXZlciBhc2tlZCBmb3IuIFBhcnNlIHRoZVxuICAgICAgICAgICAgICAgIC8vIHNwZWxsZWQtb3V0IGZvcm1zIGFuZCByZWZ1c2UgYW55dGhpbmcgdGhhdCBpcyBub3Qgb25lLCByYXRoZXIgdGhhbiBjb2VyY2luZ1xuICAgICAgICAgICAgICAgIC8vIGJ5IHRydXRoaW5lc3MuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IGNvZXJjZUJvb2wodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChjb2VyY2VkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYGJvb2xlYW4gdmFsdWUgbXVzdCBiZSB0cnVlL2ZhbHNlIChyZWNlaXZlZCAke3R5cGVvZiB2YWx1ZX0ke3R5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyBgIFwiJHt2YWx1ZX1cImAgOiAnJ30pYFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gY29lcmNlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM1MjogYSBKU09OLXN0cmluZyB2YWx1ZSAoZS5nLiAne1wiclwiOjI1NSxcImdcIjowLFwiYlwiOjB9JykgcmVhY2hlc1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgcG9pbnQgYXMgYSBzdHJpbmcuIEEgaGV4IGNvbG9yIHN0cmluZyAoZS5nLiBcIiNGRjAwMDBcIikgaXMgTk9UXG4gICAgICAgICAgICAgICAgLy8gdmFsaWQgSlNPTiwgc28gcGFyc2VKc29uUGF5bG9hZCByZXR1cm5zIGl0IHVuY2hhbmdlZDsgb25seSBhIEpTT04gb2JqZWN0XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGNvZXJjZXMgdG8gYW4gb2JqZWN0LiBUcnkgdGhlIEpTT04gcGF0aCBmaXJzdCBzbyBib3RoIGEgaGV4XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGFuZCBhIEpTT04tc3RyaW5nIG9iamVjdCBsYW5kIGluIHRoZSByaWdodCBicmFuY2guXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ3N0cmluZycpIHJldHVybiBwYXJzZUNvbG9yU3RyaW5nKGNvZXJjZWQpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQuYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYTogY29lcmNlZC5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmEpKSkgOiAyNTVcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbG9yIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggciwgZywgYiBwcm9wZXJ0aWVzIG9yIGEgaGV4YWRlY2ltYWwgc3RyaW5nIChlLmcuLCBcIiNGRjAwMDBcIikgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3ZlYzInOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcihjb2VyY2VkLngpIHx8IDAsIHk6IE51bWJlcihjb2VyY2VkLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVjMiB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHkgcHJvcGVydGllcyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAndmVjMyc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKGNvZXJjZWQueCkgfHwgMCwgeTogTnVtYmVyKGNvZXJjZWQueSkgfHwgMCwgejogTnVtYmVyKGNvZXJjZWQueikgfHwgMCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWZWMzIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSwgeiBwcm9wZXJ0aWVzIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdzaXplJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSByZXR1cm4geyB3aWR0aDogTnVtYmVyKGNvZXJjZWQud2lkdGgpIHx8IDAsIGhlaWdodDogTnVtYmVyKGNvZXJjZWQuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNpemUgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB3aWR0aCwgaGVpZ2h0IHByb3BlcnRpZXMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGUnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IHZhbHVlIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRCAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50JzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4gdmFsdWU7IC8vIHJlc29sdmVkIHRvIF9faWRfXyBsYXRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgKE5vZGUgVVVJRCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIGl0ZW07IC8vIGVhY2ggcmVzb2x2ZWQgdG8gYSBjb21wb25lbnQgX19pZF9fIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50QXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgTm9kZSBVVUlEcyAoZWFjaCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudEFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ2Fzc2V0QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIEFuIGFycmF5IG9mIGFzc2V0IHJlZmVyZW5jZXMgKGUuZy4gYEBwcm9wZXJ0eSh7IHR5cGU6IFtBdWRpb0NsaXBdIH0pYCkuXG4gICAgICAgICAgICAgICAgLy8gRXZlcnkgc2luZ2xlLWFzc2V0IHByb3BlcnR5VHlwZSByZWplY3RzIGFuIGFycmF5LCBzbyB3aXRob3V0IHRoaXMgY2FzZSBzdWNoIGFcbiAgICAgICAgICAgICAgICAvLyBmaWVsZCB3YXMgdW53cml0YWJsZS4gRWxlbWVudHMgc2VyaWFsaXplIGFzIGB7IHV1aWQgfWAsIGxpa2UgYSBzaW5nbGUgYXNzZXQuXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgYXNzZXRBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBhc3NldCBVVUlEcyAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGFzc2V0QXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSBvZiBhc3NldCBVVUlEIHN0cmluZ3MgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGVBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4geyBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07IHRocm93IG5ldyBFcnJvcihgTm9kZUFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIFVVSURzIChyZWNlaXZlZCBpdGVtIHR5cGVvZiAke3R5cGVvZiBpdGVtfSlgKTsgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGVBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdjb2xvckFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5yKSB8fCAwKSksIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uZykgfHwgMCkpLCBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmIpIHx8IDApKSwgYTogaXRlbS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmEpKSkgOiAyNTUgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29sb3JBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdudW1iZXJBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNjY6IGBOdW1iZXIoaXRlbSlgIG9uIGFuIG9iamVjdCB5aWVsZHMgTmFOLCB3aGljaCB0aGUgZWRpdG9yXG4gICAgICAgICAgICAgICAgICAgIC8vIGFjY2VwdHMgYXMgYSB3cml0dGVuIHZhbHVlIOKAlCBhIGNhbGxlciBwYXNzaW5nIGtleWZyYW1lL2FscGhhLWtleSBPQkpFQ1RTXG4gICAgICAgICAgICAgICAgICAgIC8vIGhlcmUgKHRoZSBzaGFwZSB0aGUgYXJyYXktb2Ytb2JqZWN0IGZpZWxkcyBhY3R1YWxseSBob2xkKSBnb3QgYSBzdWNjZXNzXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlc3BvbnNlIG92ZXIgYSBOYU4tZmlsbGVkIGZpZWxkLiBOYW1lIHRoZSByZWNlaXZlZCBpdGVtIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydEFycmF5SXRlbUlzUHJpbWl0aXZlKCdudW1iZXJBcnJheScsIGl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKGl0ZW0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOdW1iZXJBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdzdHJpbmdBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBTYW1lIGFzIG51bWJlckFycmF5IGFib3ZlOiBgU3RyaW5nKGl0ZW0pYCByZW5kZXJzIGFueSBvYmplY3QgYXMgdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIGxpdGVyYWwgdGV4dCBcIltvYmplY3QgT2JqZWN0XVwiIChpc3N1ZSAjMTE2J3MgZmFpbHVyZSBzaGFwZSwgcGVyIGVsZW1lbnQpLlxuICAgICAgICAgICAgICAgICAgICBhc3NlcnRBcnJheUl0ZW1Jc1ByaW1pdGl2ZSgnc3RyaW5nQXJyYXknLCBpdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyhpdGVtKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3RyaW5nQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnb2JqZWN0QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM2NjogYXJyYXkgb2YgcGxhaW4gdmFsdWUgb2JqZWN0cyAoY2MuUmVhbEN1cnZlIGtleUZyYW1lcywgY2MuR3JhZGllbnRcbiAgICAgICAgICAgICAgICAvLyBhbHBoYUtleXMpLiBFbGVtZW50cyBhcmUgd3JpdHRlbiBsZWFmIGJ5IGxlYWYsIHNvIHRoZXkgbXVzdCBiZSBvYmplY3RzIHdob3NlXG4gICAgICAgICAgICAgICAgLy8ga2V5cyBhcmUgdGhlIENDQ2xhc3MgZmllbGQgbmFtZXM7IGEgYHV1aWRgIGtleSBtZWFucyBhIHJlZmVyZW5jZSwgd2hpY2ggaGFzXG4gICAgICAgICAgICAgICAgLy8gaXRzIG93biBwcm9wZXJ0eVR5cGVzIGFuZCBhIGRpZmZlcmVudCBkdW1wIHNoYXBlLlxuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvYmplY3RBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IG9mIHBsYWluIG9iamVjdHMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvZXJjZWQuZm9yRWFjaCgoaXRlbTogYW55LCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzUGxhaW5PYmplY3QoaXRlbSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgb2JqZWN0QXJyYXkgaXRlbXMgbXVzdCBiZSBwbGFpbiBvYmplY3RzIChpdGVtICR7aWR4fSBpcyAke0FycmF5LmlzQXJyYXkoaXRlbSkgPyAnYW4gYXJyYXknIDogaXRlbSA9PT0gbnVsbCA/ICdudWxsJyA6IHR5cGVvZiBpdGVtfSkuIFByaW1pdGl2ZSBhcnJheXMgdXNlIG51bWJlckFycmF5L3N0cmluZ0FycmF5LmApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICgndXVpZCcgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvYmplY3RBcnJheSBpdGVtICR7aWR4fSBoYXMgYSAndXVpZCcga2V5LCBzbyBpdCBpcyBhIHJlZmVyZW5jZSDigJQgdXNlIG5vZGVBcnJheSwgY29tcG9uZW50QXJyYXkgb3IgYXNzZXRBcnJheSBmb3IgcmVmZXJlbmNlIGFycmF5cy5gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBjb2VyY2VkO1xuICAgICAgICAgICAgfVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBwcm9wZXJ0eSB0eXBlOiAke3Byb3BlcnR5VHlwZX0uIFN1cHBvcnRlZCB0eXBlczogJHtTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMuam9pbignLCAnKX1gKTtcbiAgICB9XG59XG5cbi8qKlxuICogV2hldGhlciBhbiBhcnJheSBlbGVtZW50IGlzIHNoYXBlZCBsaWtlIGEgYHsgdXVpZCB9YCBSRUZFUkVOQ0UuXG4gKlxuICogYHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlYCB1c2VzIHRoaXMgdG8gZGVjaWRlIHdoZXRoZXIgYW4gZXhwZWN0ZWQgYXJyYXkgaXMgYVxuICogcmVmZXJlbmNlIGFycmF5IChub2RlQXJyYXkgLyBjb21wb25lbnRBcnJheSAvIGFzc2V0QXJyYXkpIG9yIGEgcHJpbWl0aXZlIG9uZVxuICogKG51bWJlckFycmF5IC8gc3RyaW5nQXJyYXkpLiBTZW5kaW5nIGEgcHJpbWl0aXZlIGFycmF5IGRvd24gdGhlIHJlZmVyZW5jZSBicmFuY2ggbWFkZVxuICogZXZlcnkgc3VjaCB3cml0ZSBmYWlsIHZlcmlmaWNhdGlvbiAoIzE2NTApLlxuICovXG5mdW5jdGlvbiBpc1JlZmVyZW5jZVNoYXBlZChpdGVtOiBhbnkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gaXRlbSAhPT0gbnVsbCAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIGl0ZW07XG59XG5cbi8qKiBHZW5lcmF0ZSBhbiBMTE0tZnJpZW5kbHkgc3VnZ2VzdGlvbiB3aGVuIHJlcXVlc3RlZCBjb21wb25lbnQgdHlwZSBpcyBub3QgZm91bmQgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24ocmVxdWVzdGVkVHlwZTogc3RyaW5nLCBhdmFpbGFibGVUeXBlczogc3RyaW5nW10sIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHNpbWlsYXJUeXBlcyA9IGF2YWlsYWJsZVR5cGVzLmZpbHRlcih0eXBlID0+XG4gICAgICAgIHR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhyZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkpIHx8XG4gICAgICAgIHJlcXVlc3RlZFR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0eXBlLnRvTG93ZXJDYXNlKCkpXG4gICAgKTtcblxuICAgIGxldCBpbnN0cnVjdGlvbiA9ICcnO1xuICAgIGlmIChzaW1pbGFyVHlwZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuRm91bmQgc2ltaWxhciBjb21wb25lbnRzOiAke3NpbWlsYXJUeXBlcy5qb2luKCcsICcpfWA7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0aW9uOiBQZXJoYXBzIHlvdSBtZWFudCAnJHtzaW1pbGFyVHlwZXNbMF19Jz9gO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3BlcnR5VG9Db21wb25lbnRNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICAgICAgJ3N0cmluZyc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnLCAnY2MuRWRpdEJveCddLFxuICAgICAgICAndGV4dCc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcbiAgICAgICAgJ2ZvbnRTaXplJzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCddLFxuICAgICAgICAnc3ByaXRlRnJhbWUnOiBbJ2NjLlNwcml0ZSddLFxuICAgICAgICAnY29sb3InOiBbJ2NjLkxhYmVsJywgJ2NjLlNwcml0ZScsICdjYy5HcmFwaGljcyddLFxuICAgICAgICAnbm9ybWFsQ29sb3InOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAncHJlc3NlZENvbG9yJzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ3RhcmdldCc6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICdjb250ZW50U2l6ZSc6IFsnY2MuVUlUcmFuc2Zvcm0nXSxcbiAgICAgICAgJ2FuY2hvclBvaW50JzogWydjYy5VSVRyYW5zZm9ybSddXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29tbWVuZGVkQ29tcG9uZW50cyA9IHByb3BlcnR5VG9Db21wb25lbnRNYXBbcHJvcGVydHldIHx8IFtdO1xuICAgIGNvbnN0IGF2YWlsYWJsZVJlY29tbWVuZGVkID0gcmVjb21tZW5kZWRDb21wb25lbnRzLmZpbHRlcihjb21wID0+IGF2YWlsYWJsZVR5cGVzLmluY2x1ZGVzKGNvbXApKTtcbiAgICBpZiAoYXZhaWxhYmxlUmVjb21tZW5kZWQubGVuZ3RoID4gMCkge1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuQmFzZWQgb24gcHJvcGVydHkgJyR7cHJvcGVydHl9JywgcmVjb21tZW5kZWQgY29tcG9uZW50czogJHthdmFpbGFibGVSZWNvbW1lbmRlZC5qb2luKCcsICcpfWA7XG4gICAgfVxuXG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3RlZCBBY3Rpb25zOmA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjEuIFVzZSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsIG5vZGVVdWlkPVwiLi4uXCIgdG8gdmlldyBhbGwgY29tcG9uZW50cyBvbiB0aGUgbm9kZWA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjIuIElmIHlvdSBuZWVkIHRvIGFkZCBhIGNvbXBvbmVudCwgdXNlIGFjdGlvbj1hZGQgd2l0aCBjb21wb25lbnRUeXBlPVwiJHtyZXF1ZXN0ZWRUeXBlfVwiYDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMy4gVmVyaWZ5IHRoYXQgdGhlIGNvbXBvbmVudCB0eXBlIG5hbWUgaXMgY29ycmVjdCAoY2FzZS1zZW5zaXRpdmUpYDtcblxuICAgIHJldHVybiBpbnN0cnVjdGlvbjtcbn1cblxuLyoqIFJldHVybiBhdmFpbGFibGUgQ29jb3MgQ3JlYXRvciBidWlsdC1pbiBjb21wb25lbnQgdHlwZXMgYnkgY2F0ZWdvcnkgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdChjYXRlZ29yeTogc3RyaW5nID0gJ2FsbCcpOiBBY3Rpb25Ub29sUmVzdWx0IHtcbiAgICBjb25zdCBjb21wb25lbnRDYXRlZ29yaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgIHJlbmRlcmVyOiBbJ2NjLlNwcml0ZScsICdjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCcsICdjYy5NYXNrJywgJ2NjLkdyYXBoaWNzJ10sXG4gICAgICAgIHVpOiBbJ2NjLkJ1dHRvbicsICdjYy5Ub2dnbGUnLCAnY2MuU2xpZGVyJywgJ2NjLlNjcm9sbFZpZXcnLCAnY2MuRWRpdEJveCcsICdjYy5Qcm9ncmVzc0JhciddLFxuICAgICAgICBwaHlzaWNzOiBbJ2NjLlJpZ2lkQm9keTJEJywgJ2NjLkJveENvbGxpZGVyMkQnLCAnY2MuQ2lyY2xlQ29sbGlkZXIyRCcsICdjYy5Qb2x5Z29uQ29sbGlkZXIyRCddLFxuICAgICAgICBhbmltYXRpb246IFsnY2MuQW5pbWF0aW9uJywgJ2NjLkFuaW1hdGlvbkNsaXAnLCAnY2MuU2tlbGV0YWxBbmltYXRpb24nXSxcbiAgICAgICAgYXVkaW86IFsnY2MuQXVkaW9Tb3VyY2UnXSxcbiAgICAgICAgbGF5b3V0OiBbJ2NjLkxheW91dCcsICdjYy5XaWRnZXQnLCAnY2MuUGFnZVZpZXcnLCAnY2MuUGFnZVZpZXdJbmRpY2F0b3InXSxcbiAgICAgICAgZWZmZWN0czogWydjYy5Nb3Rpb25TdHJlYWsnLCAnY2MuUGFydGljbGVTeXN0ZW0yRCddLFxuICAgICAgICBjYW1lcmE6IFsnY2MuQ2FtZXJhJ10sXG4gICAgICAgIGxpZ2h0OiBbJ2NjLkxpZ2h0JywgJ2NjLkRpcmVjdGlvbmFsTGlnaHQnLCAnY2MuUG9pbnRMaWdodCcsICdjYy5TcG90TGlnaHQnXVxuICAgIH07XG5cbiAgICBsZXQgY29tcG9uZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoY2F0ZWdvcnkgPT09ICdhbGwnKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2F0IGluIGNvbXBvbmVudENhdGVnb3JpZXMpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRzLmNvbmNhdChjb21wb25lbnRDYXRlZ29yaWVzW2NhdF0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRDYXRlZ29yaWVzW2NhdGVnb3J5XSkge1xuICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29tcG9uZW50cyB9KTtcbn1cblxuLyoqIFJlZGlyZWN0IHNldF9wcm9wZXJ0eSBjYWxscyB0aGF0IHRhcmdldCBub2RlLWxldmVsIHByb3BlcnRpZXMgdG8gdGhlIGNvcnJlY3QgbWFuYWdlX25vZGUgYWN0aW9uICovXG5leHBvcnQgZnVuY3Rpb24gcmVkaXJlY3ROb2RlUHJvcGVydHlBY2Nlc3MoYXJnczoge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7IGNvbXBvbmVudFR5cGU6IHN0cmluZzsgcHJvcGVydHk6IHN0cmluZzsgdmFsdWU6IGFueTtcbn0pOiBBY3Rpb25Ub29sUmVzdWx0IHwgbnVsbCB7XG4gICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHZhbHVlIH0gPSBhcmdzO1xuICAgIGNvbnN0IG5vZGVCYXNpY1Byb3BlcnRpZXMgPSBbJ25hbWUnLCAnYWN0aXZlJywgJ2xheWVyJywgJ21vYmlsaXR5JywgJ3BhcmVudCcsICdjaGlsZHJlbicsICdoaWRlRmxhZ3MnXTtcbiAgICBjb25zdCBub2RlVHJhbnNmb3JtUHJvcGVydGllcyA9IFsncG9zaXRpb24nLCAncm90YXRpb24nLCAnc2NhbGUnLCAnZXVsZXJBbmdsZXMnLCAnYW5nbGUnXTtcblxuICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuTm9kZScgfHwgY29tcG9uZW50VHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGlmIChub2RlQmFzaWNQcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIGJhc2ljIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfcHJvcGVydHkgd2l0aCB1dWlkPVwiJHtub2RlVXVpZH1cIiwgcHJvcGVydHk9XCIke3Byb3BlcnR5fVwiLCB2YWx1ZT0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIHRyYW5zZm9ybSBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogYFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3RyYW5zZm9ybSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCAke3Byb3BlcnR5fT0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogUmVmdXNlIGEgc2NhbGFyIHByb3BlcnR5VHlwZSBhaW1lZCBhdCBhIHByb3BlcnR5IHRoYXQgY3VycmVudGx5IGhvbGRzIGFuIEFSUkFZIChpc3N1ZSAjMTE1KS5cbiAqXG4gKiBBIHNpbmdsZS12YWx1ZSB3cml0ZSAoYGFzc2V0YCwgYG5vZGVgLCBgc3RyaW5nYCwgLi4uKSBhZ2FpbnN0IGFuIGFycmF5LXR5cGVkIGBAcHJvcGVydHlgXG4gKiBkb2VzIG5vdCBmYWlsIGNsZWFubHk6IHRoZSBlZGl0b3IgYWNjZXB0cyB0aGUgZHVtcCwgdGhlIGZpZWxkIHN0b3BzIGRlY29kaW5nLCBhbmQgaXQgdmFuaXNoZXNcbiAqIGZyb20gdGhlIGNvbXBvbmVudCdzIG93biBgZ2V0X2luZm9gIHVudGlsIHRoZSBjb21wb25lbnQgaXMgcmVtb3ZlZCBhbmQgcmUtYWRkZWQuIFRoZSBjYWxsZXJcbiAqIGhhcyBubyB3YXkgdG8gcmVjb3Zlciwgc28gdGhlIHdyaXRlIGlzIHJlZnVzZWQgYmVmb3JlIGl0IGlzIHNlbnQsIG5hbWluZyB0aGUgc3VwcG9ydGVkXG4gKiB3aG9sZS1hcnJheSBwcm9wZXJ0eVR5cGVzIGFuZCB0aGUgZWxlbWVudC13aXNlIGRvdHRlZCBmb3JtLlxuICpcbiAqIFJldHVybnMgdGhlIHJlZnVzYWwgbWVzc2FnZSwgb3IgYG51bGxgIHdoZW4gdGhlIHdyaXRlIGlzIG5vdCBhIHNjYWxhci1vdmVyLWFycmF5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZGVzY3JpYmVTY2FsYXJXcml0ZVRvQXJyYXlQcm9wZXJ0eShwcm9wZXJ0eVR5cGU6IHN0cmluZywgb3JpZ2luYWxWYWx1ZTogYW55LCBwcm9wZXJ0eTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG9yaWdpbmFsVmFsdWUpIHx8IHByb3BlcnR5VHlwZS5lbmRzV2l0aCgnQXJyYXknKSkgcmV0dXJuIG51bGw7XG4gICAgcmV0dXJuIChcbiAgICAgICAgYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYW4gQVJSQVksIGJ1dCBwcm9wZXJ0eVR5cGUgJyR7cHJvcGVydHlUeXBlfScgd3JpdGVzIGEgc2luZ2xlIHZhbHVlOyBgICtcbiAgICAgICAgYHRoZSBlZGl0b3Igd291bGQgZHJvcCB0aGUgZmllbGQgZnJvbSB0aGUgY29tcG9uZW50IGFuZCBpdCBjb3VsZCBub3QgYmUgcmVzdG9yZWQgYnkgYSBsYXRlciB3cml0ZSAoaXNzdWUgIzExNSkuIGAgK1xuICAgICAgICBgU2V0IHRoZSB3aG9sZSBhcnJheSB3aXRoICdhc3NldEFycmF5JywgJ25vZGVBcnJheScsICdjb21wb25lbnRBcnJheScsICdjb2xvckFycmF5JywgJ251bWJlckFycmF5JyBvciBgICtcbiAgICAgICAgYCdzdHJpbmdBcnJheScsIG9yIHdyaXRlIG9uZSBlbGVtZW50IHdpdGggYSBkb3R0ZWQgaW5kZXggKCcke3Byb3BlcnR5fS4wJywgJyR7cHJvcGVydHl9LjxsZW5ndGg+JyBhcHBlbmRzKS4gYCArXG4gICAgICAgIGBOb3RoaW5nIHdhcyB3cml0dGVuLmBcbiAgICApO1xufVxuXG4vKiogVmVyaWZ5IGEgcHJvcGVydHkgY2hhbmdlIHdhcyBhcHBsaWVkOyB1c2VzIGdldENvbXBvbmVudEluZm8gY2FsbGJhY2sgdG8gYXZvaWQgY2lyY3VsYXIgZGVwcyAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgb3JpZ2luYWxWYWx1ZTogYW55LFxuICAgIGV4cGVjdGVkVmFsdWU6IGFueSxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IGJvb2xlYW47IGFjdHVhbFZhbHVlOiBhbnk7IGZ1bGxEYXRhOiBhbnkgfT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudEluZm8gPSBhd2FpdCBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKGNvbXBvbmVudEluZm8uc3VjY2VzcyAmJiBjb21wb25lbnRJbmZvLmRhdGEpIHtcbiAgICAgICAgICAgIC8vIFdhbGsgZG90dGVkIHByb3BlcnR5IHBhdGhzIHRocm91Z2ggbmVzdGVkIENDQ2xhc3MgZ3JvdXAgZHVtcHMuXG4gICAgICAgICAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5LnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBsZXQgcHJvcGVydHlEYXRhOiBhbnkgPSBjb21wb25lbnRJbmZvLmRhdGEucHJvcGVydGllcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoICYmIHByb3BlcnR5RGF0YTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gcHJvcGVydHlEYXRhW3NlZ21lbnRzW2ldXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgICAgIGlmICghaXNMZWFmICYmIHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBwcm9wZXJ0eURhdGEudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGFjdHVhbFZhbHVlID0gcHJvcGVydHlEYXRhO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5RGF0YSkge1xuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlID0gcHJvcGVydHlEYXRhLnZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBFeHRyYWN0cyBhIHJlZmVyZW5jZSdzIHV1aWQgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBlZGl0b3IncyBkdW1wIHdyYXBzIGl0XG4gICAgICAgICAgICAvLyBhcyBhIHBsYWluIHN0cmluZyAoeyB1dWlkOiAneCcgfSkgb3IgYXMgYSBuZXN0ZWQgbGVhZiBkZXNjcmlwdG9yXG4gICAgICAgICAgICAvLyAoeyB1dWlkOiB7IHZhbHVlOiAneCcgfSB9KSDigJQgdGhlIHNhbWUgYW1iaWd1aXR5IHRoZSBzaW5nbGUtcmVmZXJlbmNlIGJyYW5jaFxuICAgICAgICAgICAgLy8gYmVsb3cgYWxyZWFkeSB0b2xlcmF0ZXMuXG4gICAgICAgICAgICBjb25zdCBleHRyYWN0VXVpZCA9IChyZWY6IGFueSk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICAgICAgLy8gQW4gYXNzZXQtYXJyYXkgZWxlbWVudCByZWFkcyBiYWNrIGFzIGEgZnVsbCBlbGVtZW50IGR1bXBcbiAgICAgICAgICAgICAgICAvLyAoeyB2YWx1ZTogeyB1dWlkIH0sIHR5cGUsIC4uLiB9KSwgbm90IGEgYmFyZSB7IHV1aWQgfSByZWYg4oCUIHVud3JhcCBpdC5cbiAgICAgICAgICAgICAgICBpZiAocmVmICYmIHR5cGVvZiByZWYgPT09ICdvYmplY3QnICYmICEoJ3V1aWQnIGluIHJlZikgJiYgcmVmLnZhbHVlICYmIHR5cGVvZiByZWYudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlZiA9IHJlZi52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFyZWYgfHwgdHlwZW9mIHJlZiAhPT0gJ29iamVjdCcgfHwgISgndXVpZCcgaW4gcmVmKSkgcmV0dXJuICcnO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhdyA9IHJlZi51dWlkO1xuICAgICAgICAgICAgICAgIGlmIChyYXcgJiYgdHlwZW9mIHJhdyA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiByYXcpIHJldHVybiByYXcudmFsdWUgfHwgJyc7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJhdyB8fCAnJztcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGxldCB2ZXJpZmllZCA9IGZhbHNlO1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRWYWx1ZSkgJiYgZXhwZWN0ZWRWYWx1ZS5zb21lKGUgPT4gaXNQbGFpbk9iamVjdChlKSAmJiAhKCd1dWlkJyBpbiBlKSkpIHtcbiAgICAgICAgICAgICAgICAvLyBvYmplY3RBcnJheSAoaXNzdWUgIzY2KTogZWxlbWVudHMgYXJlIHBsYWluIHZhbHVlIG9iamVjdHMsIG5vdCByZWZlcmVuY2VzLlxuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gbWF0Y2hlc1JlcXVlc3RlZFN0cnVjdHVyZShleHBlY3RlZFZhbHVlLCBwcm9wZXJ0eURhdGEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkVmFsdWUpICYmIGV4cGVjdGVkVmFsdWUuc29tZShpc1JlZmVyZW5jZVNoYXBlZCkpIHtcbiAgICAgICAgICAgICAgICAvLyBub2RlQXJyYXkgLyBjb21wb25lbnRBcnJheSAvIGFzc2V0QXJyYXk6IGVsZW1lbnRzIGFyZSBgeyB1dWlkIH1gIHJlZmVyZW5jZXMuXG4gICAgICAgICAgICAgICAgLy8gQ29tcGFyZSBieSBwZXItZWxlbWVudCB1dWlkIChvcmRlci1wcmVzZXJ2aW5nKSwgbmV2ZXIgYnkgZGVlcC1lcXVhbGluZyB0aGVcbiAgICAgICAgICAgICAgICAvLyB3aG9sZSBhcnJheSDigJQgdGhlIGVkaXRvcidzIHJlYWQtYmFjayBkdW1wIG1heSBjYXJyeSBleHRyYSBwZXItZWxlbWVudFxuICAgICAgICAgICAgICAgIC8vIG1ldGFkYXRhIChlLmcuIGFuIGludGVybmFsIG9iamVjdCBpZCkgdGhhdCBhIHBsYWluIGNvbXBvbmVudC9ub2RlIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIC8vIHdyaXRlIG5ldmVyIGluY2x1ZGVkLCB3aGljaCB3b3VsZCBmYWlsIGEgSlNPTi5zdHJpbmdpZnkgY29tcGFyaXNvbiBldmVuXG4gICAgICAgICAgICAgICAgLy8gdGhvdWdoIGV2ZXJ5IHJlZmVyZW5jZSByZXNvbHZlZCBjb3JyZWN0bHkuXG4gICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAvLyBUaGUgYHNvbWUoaXNSZWZlcmVuY2VTaGFwZWQpYCBnYXRlIGlzIGxvYWQtYmVhcmluZyAoIzE2NTApOiBhbiBFTVBUWVxuICAgICAgICAgICAgICAgIC8vIHJlZmVyZW5jZSBhcnJheSBoYXMgbm8gZWxlbWVudCB0byBpbnNwZWN0LCBhbmQgYSBgbnVtYmVyQXJyYXlgIC9cbiAgICAgICAgICAgICAgICAvLyBgc3RyaW5nQXJyYXlgIGhhcyBvbmx5IHByaW1pdGl2ZXMuIFNlbmRpbmcgdGhvc2UgaGVyZSBtYWRlIGBleHRyYWN0VXVpZGBcbiAgICAgICAgICAgICAgICAvLyByZXR1cm4gJycgZm9yIGV2ZXJ5IGVsZW1lbnQsIHNvIGBleHBVdWlkICE9PSAnJ2Agd2FzIGFsd2F5cyBmYWxzZSBhbmQgYVxuICAgICAgICAgICAgICAgIC8vIGNvcnJlY3QgcHJpbWl0aXZlLWFycmF5IHdyaXRlIGNvdWxkIG5ldmVyIHZlcmlmeSDigJQgdGhlIGNhbGxlciBzYXdcbiAgICAgICAgICAgICAgICAvLyBcImV4cGVjdGVkIFs0LDMsMywyXSBidXQgdGhlIGVkaXRvciByZWFkcyBiYWNrIFs0LDMsMywyXVwiLlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbEFyciA9IEFycmF5LmlzQXJyYXkoYWN0dWFsVmFsdWUpID8gYWN0dWFsVmFsdWUgOiBbXTtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbEFyci5sZW5ndGggPT09IGV4cGVjdGVkVmFsdWUubGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWUuZXZlcnkoKGV4cDogYW55LCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhwVXVpZCA9IGV4dHJhY3RVdWlkKGV4cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwVXVpZCAhPT0gJycgJiYgZXhwVXVpZCA9PT0gZXh0cmFjdFV1aWQoYWN0dWFsQXJyW2lkeF0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWUgPT09ICdvYmplY3QnICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwgJiYgJ3V1aWQnIGluIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNzMgKHNlY29uZGFyeSBmaW5kaW5nKTogdGhlIHRyYWlsaW5nIGAmJiBleHBlY3RlZFV1aWQgIT09ICcnYCBtYWRlXG4gICAgICAgICAgICAgICAgLy8gYHZlcmlmaWVkYCBBTFdBWVMgZmFsc2Ugd2hlbiBjbGVhcmluZyBhIHJlZmVyZW5jZSB0byBhbiBlbXB0eSB1dWlkIOKAlCBldmVuXG4gICAgICAgICAgICAgICAgLy8gd2hlbiBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQgPT09ICcnIGFuZCB0aGUgY2xlYXIgZ2VudWluZWx5IHN1Y2NlZWRlZFxuICAgICAgICAgICAgICAgIC8vIChpc3N1ZSAjNzUpLiBEcm9wcGluZyBpdCBkb2VzIG5vdCB3ZWFrZW4gdGhlIG5vbi1lbXB0eSBjYXNlOiBhIG1pc3NpbmcvXG4gICAgICAgICAgICAgICAgLy8gdW5kZWZpbmVkIGFjdHVhbFZhbHVlIGFscmVhZHkgY29tcHV0ZXMgYWN0dWFsVXVpZCA9PT0gJycsIHdoaWNoIGNhbiBuZXZlclxuICAgICAgICAgICAgICAgIC8vIGVxdWFsIGEgbm9uLWVtcHR5IGV4cGVjdGVkVXVpZCwgc28gdGhhdCBjb21wYXJpc29uIGFsb25lIHN0aWxsIGZhaWxzIGl0LlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbFV1aWQgPSBhY3R1YWxWYWx1ZSAmJiB0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBhY3R1YWxWYWx1ZSA/IGFjdHVhbFZhbHVlLnV1aWQgOiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCBleHBlY3RlZFV1aWQgPSBleHBlY3RlZFZhbHVlLnV1aWQgfHwgJyc7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gdHlwZW9mIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSAnb2JqZWN0JyAmJiBhY3R1YWxWYWx1ZSAhPT0gbnVsbCAmJiBleHBlY3RlZFZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gSlNPTi5zdHJpbmdpZnkoYWN0dWFsVmFsdWUpID09PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZFZhbHVlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFZhbHVlID09PSBleHBlY3RlZFZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBTdHJpbmcoYWN0dWFsVmFsdWUpID09PSBTdHJpbmcoZXhwZWN0ZWRWYWx1ZSkgfHwgTnVtYmVyKGFjdHVhbFZhbHVlKSA9PT0gTnVtYmVyKGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkLFxuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgIGZ1bGxEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkUHJvcGVydHk6IHsgbmFtZTogcHJvcGVydHksIGJlZm9yZTogb3JpZ2luYWxWYWx1ZSwgZXhwZWN0ZWQ6IGV4cGVjdGVkVmFsdWUsIGFjdHVhbDogYWN0dWFsVmFsdWUsIHZlcmlmaWVkIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFN1bW1hcnk6IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHRvdGFsUHJvcGVydGllczogT2JqZWN0LmtleXMoY29tcG9uZW50SW5mby5kYXRhPy5wcm9wZXJ0aWVzIHx8IHt9KS5sZW5ndGggfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFuYWdlQ29tcG9uZW50LnZlcmlmeVByb3BlcnR5Q2hhbmdlXSBWZXJpZmljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBhY3R1YWxWYWx1ZTogdW5kZWZpbmVkLCBmdWxsRGF0YTogbnVsbCB9O1xufVxuIl19