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
        const rootValueObj = component.properties.value && typeof component.properties.value === 'object'
            ? component.properties.value
            : component.properties;
        const segments = propertyName.split('.');
        let cursor = rootValueObj;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const isLeaf = i === segments.length - 1;
            // Populate availableProperties at the relevant level (root or final container)
            if (i === 0 || (i === segments.length - 1)) {
                for (const [k, v] of Object.entries(cursor || {})) {
                    if (v && typeof v === 'object') {
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
    // failed downstream with a confusing "neither a node uuid nor a component uuid" error.
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
            throw new Error(`Component reference value must be a string (node UUID containing the target component) (received typeof ${typeof value})`);
        case 'componentArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => {
                        if (typeof item === 'string')
                            return item; // each resolved to a component __id__ later
                        throw new Error(`ComponentArray items must be string node UUIDs (each containing the target component) (received item typeof ${typeof item})`);
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
            else if (Array.isArray(expectedValue)) {
                // nodeArray / componentArray: every element is itself a { uuid } reference.
                // Compare by per-element uuid (order-preserving), never by deep-equaling the
                // whole array — the editor's read-back dump may carry extra per-element
                // metadata (e.g. an internal object id) that a plain component/node reference
                // write never included, which would fail a JSON.stringify comparison even
                // though every reference resolved correctly.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUF3Qkgsc0NBRUM7QUFVRCw4REFjQztBQVVELG9FQVlDO0FBa0JELDhEQTBCQztBQUlELDBDQXFJQztBQUdELDRDQW9CQztBQTBERCxvREFvTUM7QUFHRCxrRUFxQ0M7QUFHRCxnRUF1QkM7QUFHRCxnRUF3QkM7QUFhRCxnRkFTQztBQUdELHNFQTRGQztBQWx1QkQsb0NBQTJEO0FBQzNELGtEQUFrRTtBQUVsRTs7Ozs7Ozs7R0FRRztBQUNILFNBQVMsMEJBQTBCLENBQUMsWUFBb0IsRUFBRSxJQUFTO0lBQy9ELElBQUksSUFBSSxLQUFLLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUM1QyxNQUFNLElBQUksS0FBSyxDQUNYLEdBQUcsWUFBWSx1Q0FBdUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLEtBQUs7WUFDbkcsNkZBQTZGO1lBQzdGLGlGQUFpRixDQUNwRixDQUFDO0lBQ04sQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFnQixhQUFhLENBQUMsQ0FBTTtJQUNoQyxPQUFPLENBQUMsS0FBSyxJQUFJLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQ7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLHlCQUF5QixDQUFDLFFBQWEsRUFBRSxJQUFTO0lBQzlELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1FBQzFCLE1BQU0sTUFBTSxH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QUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtpQkFDM0g7YUFDSixDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyw2REFBNkQsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBQ0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHVyZSBoZWxwZXIgZnVuY3Rpb25zIGZvciBjb21wb25lbnQgcHJvcGVydHkgYW5hbHlzaXMsIHZhbGlkYXRpb24sIGFuZCBxdWVyeSB1dGlsaXRpZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29lcmNlQm9vbCwgcGFyc2VKc29uUGF5bG9hZCB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5cbi8qKlxuICogUmVqZWN0IGEgbm9uLXByaW1pdGl2ZSBlbGVtZW50IGluIGEgcHJpbWl0aXZlIGFycmF5LCBuYW1pbmcgd2hhdCBhcnJpdmVkIChpc3N1ZSAjNjYpLlxuICpcbiAqIGBudW1iZXJBcnJheWAgYW5kIGBzdHJpbmdBcnJheWAgYXJlIHRoZSBvbmx5IHR3byBwcm9wZXJ0eVR5cGVzIHdob3NlIGNvbnZlcnNpb24gY29lcmNlc1xuICogc2lsZW50bHksIHNvIGEgY2FsbGVyIHJlYWNoaW5nIGZvciBvbmUgb2YgdGhlbSB3aXRoIE9CSkVDVCBlbGVtZW50cyDigJQgY2MuUmVhbEN1cnZlXG4gKiBrZXlmcmFtZXMsIGNjLkdyYWRpZW50IGFscGhhIGtleXMsIG9yIGFueSBvdGhlciBhcnJheS1vZi1wbGFpbi1vYmplY3QgZmllbGQg4oCUIGhhZCBldmVyeVxuICogZWxlbWVudCB0dXJuZWQgaW50byBgTmFOYCAvIGBcIltvYmplY3QgT2JqZWN0XVwiYCBhbmQgd3JpdHRlbiB0byB0aGUgc2NlbmUgb24gYSBgc3VjY2Vzc2BcbiAqIHJlc3BvbnNlLiBOZWl0aGVyIGlzIGEgdmFsdWUgYW55b25lIG1lYW50IHRvIHdyaXRlLCBzbyByZWZ1c2luZyBiZWF0cyBjb2VyY2luZy5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0QXJyYXlJdGVtSXNQcmltaXRpdmUocHJvcGVydHlUeXBlOiBzdHJpbmcsIGl0ZW06IGFueSk6IHZvaWQge1xuICAgIGlmIChpdGVtICE9PSBudWxsICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgJHtwcm9wZXJ0eVR5cGV9IGl0ZW1zIG11c3QgYmUgcHJpbWl0aXZlcyAocmVjZWl2ZWQgJHtBcnJheS5pc0FycmF5KGl0ZW0pID8gJ2FycmF5JyA6ICdvYmplY3QnfSkuIGAgK1xuICAgICAgICAgICAgYEFycmF5LW9mLU9CSkVDVCBmaWVsZHMgKGUuZy4gYSBjYy5SZWFsQ3VydmUgc3BsaW5lJ3Mga2V5RnJhbWVzLCBhIGNjLkdyYWRpZW50J3MgYWxwaGFLZXlzKSBgICtcbiAgICAgICAgICAgIGBhcmUgd3JpdHRlbiB3aXRoIHByb3BlcnR5VHlwZSAnb2JqZWN0QXJyYXknIOKAlCBubyB2YWx1ZSB3YXMgd3JpdHRlbiAoaXNzdWUgIzY2KS5gXG4gICAgICAgICk7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQbGFpbk9iamVjdCh2OiBhbnkpOiB2IGlzIFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgIHJldHVybiB2ICE9PSBudWxsICYmIHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2KTtcbn1cblxuLyoqXG4gKiBDb21wYXJlIGFuIGBvYmplY3RBcnJheWAgcmVxdWVzdCBhZ2FpbnN0IHRoZSBlZGl0b3IncyByZWFkLWJhY2sgKGlzc3VlICM2NikuXG4gKlxuICogVGhlIHJlYWQtYmFjayB3cmFwcyBldmVyeSBub2RlIG9mIHRoZSB0cmVlIGFzIGEgZHVtcCAoYHsgdmFsdWUsIHR5cGUsIC4uLiB9YCksIHNvIHRoZVxuICogY29tcGFyaXNvbiB3YWxrcyB0aGUgUkVRVUVTVEVEIHN0cnVjdHVyZSBhbmQgdW53cmFwcyB0aGUgZHVtcCBhbG9uZ3NpZGUgaXQuIEV4dHJhIGtleXMgdGhlXG4gKiBlZGl0b3IgcmVwb3J0cyAoaW50ZXJuYWwgaWRzLCBkZWZhdWx0cyBmb3IgZmllbGRzIHRoZSBjYWxsZXIgbmV2ZXIgbmFtZWQpIGFyZSBpZ25vcmVkOyBhXG4gKiByZXF1ZXN0ZWQgbGVhZiB0aGF0IGlzIG1pc3Npbmcgb3IgZGlmZmVyZW50IGZhaWxzIHRoZSBtYXRjaC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdGNoZXNSZXF1ZXN0ZWRTdHJ1Y3R1cmUoZXhwZWN0ZWQ6IGFueSwgZHVtcDogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZXhwZWN0ZWQpKSB7XG4gICAgICAgIGNvbnN0IGFjdHVhbCA9IEFycmF5LmlzQXJyYXkoZHVtcCkgPyBkdW1wIDogZHVtcD8udmFsdWU7XG4gICAgICAgIHJldHVybiBBcnJheS5pc0FycmF5KGFjdHVhbCkgJiYgYWN0dWFsLmxlbmd0aCA9PT0gZXhwZWN0ZWQubGVuZ3RoICYmXG4gICAgICAgICAgICBleHBlY3RlZC5ldmVyeSgoZSwgaSkgPT4gbWF0Y2hlc1JlcXVlc3RlZFN0cnVjdHVyZShlLCBhY3R1YWxbaV0pKTtcbiAgICB9XG4gICAgaWYgKGlzUGxhaW5PYmplY3QoZXhwZWN0ZWQpKSB7XG4gICAgICAgIGlmICghaXNQbGFpbk9iamVjdChkdW1wKSkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBmaWVsZHMgPSBpc1BsYWluT2JqZWN0KGR1bXAudmFsdWUpID8gZHVtcC52YWx1ZSA6IGR1bXA7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhleHBlY3RlZCkuZXZlcnkoayA9PiBtYXRjaGVzUmVxdWVzdGVkU3RydWN0dXJlKGV4cGVjdGVkW2tdLCBmaWVsZHNba10pKTtcbiAgICB9XG4gICAgY29uc3QgYWN0dWFsID0gaXNQbGFpbk9iamVjdChkdW1wKSAmJiAndmFsdWUnIGluIGR1bXAgPyBkdW1wLnZhbHVlIDogZHVtcDtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgYWN0dWFsID09PSAnbnVtYmVyJykgcmV0dXJuIE51bWJlcihhY3R1YWwpID09PSBOdW1iZXIoZXhwZWN0ZWQpO1xuICAgIHJldHVybiBhY3R1YWwgPT09IGV4cGVjdGVkO1xufVxuXG4vKipcbiAqIFJldHVybiBhIGNvbXBvbmVudCBkdW1wJ3MgcHJvcGVydHkgbWFwLlxuICpcbiAqIGBzY2VuZTpxdWVyeS1ub2RlYCBzaGFwZXMgZWFjaCBgX19jb21wc19fYCBlbnRyeSBhc1xuICogYHsgX190eXBlX18sIGNpZCwgdHlwZSwgZW5hYmxlZCwgdmFsdWU6IHsgPHByb3A+OiB7IG5hbWUsIHZhbHVlLCB0eXBlIH0gfSB9YCDigJQgdGhlIGxpdmVcbiAqIHByb3BlcnR5IHZhbHVlcyBsaXZlIHVuZGVyIGB2YWx1ZWAuIFRoZSBmYWxsYmFjayBjb3ZlcnMgZHVtcHMgdGhhdCBpbmxpbmUgdGhlaXJcbiAqIHByb3BlcnRpZXMgaW5zdGVhZCBvZiBuZXN0aW5nIHRoZW0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wKGNvbXBvbmVudDogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgaWYgKGNvbXBvbmVudD8udmFsdWUgJiYgdHlwZW9mIGNvbXBvbmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHJldHVybiBjb21wb25lbnQudmFsdWU7XG5cbiAgICBjb25zdCBwcm9wZXJ0aWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgaWYgKCFjb21wb25lbnQgfHwgdHlwZW9mIGNvbXBvbmVudCAhPT0gJ29iamVjdCcpIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgIGNvbnN0IGV4Y2x1ZGVLZXlzID0gWydfX3R5cGVfXycsICdlbmFibGVkJywgJ25vZGUnLCAnX2lkJywgJ19fc2NyaXB0QXNzZXQnLCAndXVpZCcsICduYW1lJywgJ19uYW1lJywgJ19vYmpGbGFncycsICdfZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnLCAnY2lkJywgJ2VkaXRvcicsICdleHRlbmRzJ107XG4gICAgZm9yIChjb25zdCBrZXkgaW4gY29tcG9uZW50KSB7XG4gICAgICAgIGlmICghZXhjbHVkZUtleXMuaW5jbHVkZXMoa2V5KSAmJiAha2V5LnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgICAgICAgcHJvcGVydGllc1trZXldID0gY29tcG9uZW50W2tleV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByb3BlcnRpZXM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvcGVydHlBbmFseXNpc1Jlc3VsdCB7XG4gICAgZXhpc3RzOiBib29sZWFuO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXTtcbiAgICBvcmlnaW5hbFZhbHVlOiBhbnk7XG4gICAgLyoqXG4gICAgICogU2V0IHdoZW4gdGhlIHJlcXVlc3RlZCBkb3R0ZWQgcGF0aCBpbmRleGVzIE9ORSBQQVNUIHRoZSBlbmQgb2YgYW4gZXhpc3RpbmcgYXJyYXlcbiAgICAgKiAoYHByaWNlTGFiZWxzLjBgIG9uIGFuIGVtcHR5IGFycmF5LCBgc2xvdHMuM2Agb24gYSAzLWVsZW1lbnQgb25lIOKAlCBpc3N1ZSAjNjgpLiBUaGVcbiAgICAgKiBlbGVtZW50IGRvZXMgbm90IGV4aXN0IHlldCwgc28gdGhlIGVkaXRvciBtdXN0IGdyb3cgdGhlIGFycmF5IGJlZm9yZSBpdCBjYW4gYmUgd3JpdHRlbi5cbiAgICAgKi9cbiAgICBhcHBlbmRUbz86IHsgYXJyYXlQcm9wZXJ0eTogc3RyaW5nOyBjdXJyZW50TGVuZ3RoOiBudW1iZXIgfTtcbiAgICAvKiogV2h5IGEgbm90LWZvdW5kIGxvb2t1cCBmYWlsZWQgd2hlbiB0aGUgY2F1c2UgaXMgbW9yZSBzcGVjaWZpYyB0aGFuIFwibm8gc3VjaCBuYW1lXCIuICovXG4gICAgbm90Rm91bmRIaW50Pzogc3RyaW5nO1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHByb3BEYXRhIGxvb2tzIGxpa2UgYSBDb2NvcyBDcmVhdG9yIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihwcm9wRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcgfHwgcHJvcERhdGEgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcERhdGEpO1xuICAgICAgICAvLyBTa2lwIHNpbXBsZSB2YWx1ZSBvYmplY3RzIGxpa2Uge3dpZHRoOiAyMDAsIGhlaWdodDogMTUwfVxuICAgICAgICBjb25zdCBpc1NpbXBsZVZhbHVlT2JqZWN0ID0ga2V5cy5ldmVyeShrZXkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdiA9IHByb3BEYXRhW2tleV07XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGlzU2ltcGxlVmFsdWVPYmplY3QpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgaGFzTmFtZSA9IGtleXMuaW5jbHVkZXMoJ25hbWUnKTtcbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSBrZXlzLmluY2x1ZGVzKCd2YWx1ZScpO1xuICAgICAgICBjb25zdCBoYXNUeXBlID0ga2V5cy5pbmNsdWRlcygndHlwZScpO1xuICAgICAgICBjb25zdCBoYXNEaXNwbGF5TmFtZSA9IGtleXMuaW5jbHVkZXMoJ2Rpc3BsYXlOYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1JlYWRvbmx5ID0ga2V5cy5pbmNsdWRlcygncmVhZG9ubHknKTtcbiAgICAgICAgY29uc3QgaGFzVmFsaWRTdHJ1Y3R1cmUgPSAoaGFzTmFtZSB8fCBoYXNWYWx1ZSkgJiYgKGhhc1R5cGUgfHwgaGFzRGlzcGxheU5hbWUgfHwgaGFzUmVhZG9ubHkpO1xuICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygnZGVmYXVsdCcpICYmIHByb3BEYXRhLmRlZmF1bHQgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhLmRlZmF1bHQpO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0LnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiBoYXNWYWxpZFN0cnVjdHVyZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qKiBBbmFseXplIGEgY29tcG9uZW50J3MgcHJvcGVydHkgdG8gZGV0ZXJtaW5lIGl0cyB0eXBlIGFuZCBjdXJyZW50IHZhbHVlLlxuICogIFN1cHBvcnRzIGRvdHRlZCBwcm9wZXJ0eU5hbWUgZm9yIG5lc3RlZCBDQ0NsYXNzIGdyb3VwcyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuICovXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVByb3BlcnR5KGNvbXBvbmVudDogYW55LCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGNvbnN0IGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcbiAgICBsZXQgcHJvcGVydHlFeGlzdHMgPSBmYWxzZTtcbiAgICBsZXQgbm90Rm91bmRIaW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBNZXRob2QgMTogZGlyZWN0IHByb3BlcnR5IGFjY2VzcyAoZmxhdCBwYXRoIG9ubHkpXG4gICAgaWYgKCFwcm9wZXJ0eU5hbWUuaW5jbHVkZXMoJy4nKSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29tcG9uZW50LCBwcm9wZXJ0eU5hbWUpKSB7XG4gICAgICAgIHByb3BlcnR5VmFsdWUgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIE1ldGhvZCAyOiBzZWFyY2ggbmVzdGVkIHByb3BlcnRpZXMgc3RydWN0dXJlIChDb2NvcyBDcmVhdG9yIGNvbXBvbmVudCBkdW1wIGZvcm1hdCkuXG4gICAgLy8gIEZvciBkb3R0ZWQgbmFtZXMgbGlrZSBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiLCB3YWxrIHNlZ21lbnRzIHRocm91Z2ggbmVzdGVkIGAudmFsdWVgIGR1bXBzLlxuICAgIGlmICghcHJvcGVydHlFeGlzdHMgJiYgY29tcG9uZW50LnByb3BlcnRpZXMgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCByb290VmFsdWVPYmogPSBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSAmJiB0eXBlb2YgY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWUgPT09ICdvYmplY3QnXG4gICAgICAgICAgICA/IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlXG4gICAgICAgICAgICA6IGNvbXBvbmVudC5wcm9wZXJ0aWVzO1xuXG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHlOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBjdXJzb3I6IGFueSA9IHJvb3RWYWx1ZU9iajtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50ID0gc2VnbWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAvLyBQb3B1bGF0ZSBhdmFpbGFibGVQcm9wZXJ0aWVzIGF0IHRoZSByZWxldmFudCBsZXZlbCAocm9vdCBvciBmaW5hbCBjb250YWluZXIpXG4gICAgICAgICAgICBpZiAoaSA9PT0gMCB8fCAoaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhjdXJzb3IgfHwge30pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2ICYmIHR5cGVvZiB2ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gaSA9PT0gMCA/ICcnIDogYCR7c2VnbWVudHMuc2xpY2UoMCwgaSkuam9pbignLicpfS5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGAke3ByZWZpeH0ke2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBjdXJzb3IgPyBjdXJzb3Jbc2VnbWVudF0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzY4OiBhbiBpbmRleCBwYXN0IHRoZSBlbmQgb2YgYW4gYXJyYXkuIGBsZW5ndGhgIGl0c2VsZiBpcyB0aGUgYXBwZW5kXG4gICAgICAgICAgICAgICAgLy8gc2xvdDsgYW55dGhpbmcgZnVydGhlciBvdXQgaXMgYSBnZW51aW5lIGdhcCB0aGUgY2FsbGVyIG11c3QgZmlsbCBpbiBvcmRlci5cbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjdXJzb3IpICYmIC9eXFxkKyQvLnRlc3Qoc2VnbWVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXJyYXlQcm9wZXJ0eSA9IHNlZ21lbnRzLnNsaWNlKDAsIGkpLmpvaW4oJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVhZiAmJiBOdW1iZXIoc2VnbWVudCkgPT09IGN1cnNvci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhpc3RzOiB0cnVlLCB0eXBlOiAndW5rbm93bicsIGF2YWlsYWJsZVByb3BlcnRpZXMsIG9yaWdpbmFsVmFsdWU6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBlbmRUbzogeyBhcnJheVByb3BlcnR5LCBjdXJyZW50TGVuZ3RoOiBjdXJzb3IubGVuZ3RoIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbm90Rm91bmRIaW50ID0gYCcke2FycmF5UHJvcGVydHl9JyBpcyBhbiBhcnJheSB3aXRoICR7Y3Vyc29yLmxlbmd0aH0gZWxlbWVudChzKTsgaW5kZXggJHtzZWdtZW50fSBpcyBvdXQgb2YgcmFuZ2UuIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYFdyaXRlIGluZGV4ICR7Y3Vyc29yLmxlbmd0aH0gZmlyc3QgKGl0IGFwcGVuZHMpLCBvciBzZXQgdGhlIHdob2xlIGFycmF5IHdpdGggYW4gYXJyYXkgcHJvcGVydHlUeXBlLmA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnNvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzTGVhZikge1xuICAgICAgICAgICAgICAgIGlmIChpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yKGRlc2NyaXB0b3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRLZXlzID0gT2JqZWN0LmtleXMoZGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBkS2V5cy5pbmNsdWRlcygndmFsdWUnKSA/IGRlc2NyaXB0b3IudmFsdWUgOiBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlc2NlbmQgaW50byB0aGUgbmVzdGVkIENDQ2xhc3MgZ3JvdXA6IGRlc2NyaXB0b3IudmFsdWUgaG9sZHMgdGhlIGlubmVyIGR1bXAuXG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3IudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWV0aG9kIDM6IGNvbGxlY3Qgc2ltcGxlIHByb3BlcnR5IG5hbWVzIGZyb20gZGlyZWN0IGtleXMgYXMgZmFsbGJhY2tcbiAgICBpZiAoYXZhaWxhYmxlUHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoY29tcG9uZW50KSkge1xuICAgICAgICAgICAgaWYgKCFrZXkuc3RhcnRzV2l0aCgnXycpICYmICFbJ19fdHlwZV9fJywgJ2NpZCcsICdub2RlJywgJ3V1aWQnLCAnbmFtZScsICdlbmFibGVkJywgJ3R5cGUnLCAncmVhZG9ubHknLCAndmlzaWJsZSddLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVQcm9wZXJ0aWVzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcHJvcGVydHlFeGlzdHMpIHtcbiAgICAgICAgcmV0dXJuIHsgZXhpc3RzOiBmYWxzZSwgdHlwZTogJ3Vua25vd24nLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiB1bmRlZmluZWQsIG5vdEZvdW5kSGludCB9O1xuICAgIH1cblxuICAgIC8vIEluZmVyIHR5cGUgZnJvbSB2YWx1ZSBzdHJ1Y3R1cmVcbiAgICBsZXQgdHlwZSA9ICd1bmtub3duJztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eVZhbHVlKSkge1xuICAgICAgICBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSkgdHlwZSA9ICdub2RlQXJyYXknO1xuICAgICAgICBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29sb3InKSkgdHlwZSA9ICdjb2xvckFycmF5JztcbiAgICAgICAgZWxzZSB0eXBlID0gJ2FycmF5JztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICB0eXBlID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkgPyAnYXNzZXQnIDogJ3N0cmluZyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdHlwZSA9ICdudW1iZXInO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICB0eXBlID0gJ2Jvb2xlYW4nO1xuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSAmJiB0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wZXJ0eVZhbHVlKTtcbiAgICAgICAgICAgIGlmIChrZXlzLmluY2x1ZGVzKCdyJykgJiYga2V5cy5pbmNsdWRlcygnZycpICYmIGtleXMuaW5jbHVkZXMoJ2InKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnY29sb3InO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd4JykgJiYga2V5cy5pbmNsdWRlcygneScpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IHByb3BlcnR5VmFsdWUueiAhPT0gdW5kZWZpbmVkID8gJ3ZlYzMnIDogJ3ZlYzInO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd3aWR0aCcpICYmIGtleXMuaW5jbHVkZXMoJ2hlaWdodCcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdzaXplJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygndXVpZCcpIHx8IGtleXMuaW5jbHVkZXMoJ19fdXVpZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpIHx8IGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSA/ICdub2RlJyA6ICdhc3NldCc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSA9PT0gbnVsbCB8fCBwcm9wZXJ0eVZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2Fzc2V0JztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29tcG9uZW50JykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29tcG9uZW50JztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGV4aXN0czogdHJ1ZSwgdHlwZSwgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogcHJvcGVydHlWYWx1ZSB9O1xufVxuXG4vKiogUGFyc2UgYSBoZXggY29sb3Igc3RyaW5nICgjUkdCIG9yICNSR0JBKSB0byBhbiBSR0JBIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29sb3JTdHJpbmcoY29sb3JTdHI6IHN0cmluZyk6IHsgcjogbnVtYmVyOyBnOiBudW1iZXI7IGI6IG51bWJlcjsgYTogbnVtYmVyIH0ge1xuICAgIGNvbnN0IHN0ciA9IGNvbG9yU3RyLnRyaW0oKTtcbiAgICBpZiAoc3RyLnN0YXJ0c1dpdGgoJyMnKSkge1xuICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gNykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiAyNTVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAoc3RyLmxlbmd0aCA9PT0gOSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDcsIDkpLCAxNilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNvbG9yIGZvcm1hdDogXCIke2NvbG9yU3RyfVwiLiBPbmx5IGhleGFkZWNpbWFsIGZvcm1hdCBpcyBzdXBwb3J0ZWQgKGUuZy4sIFwiI0ZGMDAwMFwiIG9yIFwiI0ZGMDAwMEZGXCIpYCk7XG59XG5cbi8qKlxuICogQ29jb3MgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5IHR5cGVzLiBFdmVyeSBvbmUgb2YgdGhlc2Ugc2VyaWFsaXplcyBpZGVudGljYWxseSBhc1xuICogYHsgdXVpZCB9YCAoaXNzdWUgIzI2IOKAlCBwcm9wZXJ0eVR5cGU9XCJtYXRlcmlhbFwiIGFuZCBmcmllbmRzIHByZXZpb3VzbHkgZmVsbCB0aHJvdWdoIHRvXG4gKiBgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZWAsIGV2ZW4gdGhvdWdoIHRoZSBleGlzdGluZyBzcHJpdGVGcmFtZS9wcmVmYWIvYXNzZXQgY29lcmNpb25cbiAqIGFscmVhZHkgcHJvZHVjZXMgdGhlIGNvcnJlY3Qgc2hhcGUgZm9yIHRoZW0pLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICdtYXRlcmlhbCcsICd0ZXh0dXJlJywgJ3Nwcml0ZUF0bGFzJywgJ2F1ZGlvQ2xpcCcsICdmb250JywgJ2FuaW1hdGlvbkNsaXAnLFxuICAgICdtZXNoJywgJ3NrZWxldG9uJywgJ3BoeXNpY3NNYXRlcmlhbCcsICdyZW5kZXJUZXh0dXJlJywgJ3RleHRBc3NldCcsICdqc29uQXNzZXQnLFxuICAgICdwYXJ0aWNsZUFzc2V0JywgJ3NjZW5lQXNzZXQnXG5dIGFzIGNvbnN0O1xuXG4vKipcbiAqIEV4cGxpY2l0IHByb3BlcnR5VHlwZSAtPiBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBSZXNvbHZlZCBmcm9tIHRoZSBwcm9wZXJ0eVR5cGUgaXRzZWxmLCBOT1QgZnJvbSB0aGUgcHJvcGVydHkgbmFtZS4gVGhlIGxlZ2FjeSBuYW1lLWJhc2VkXG4gKiBoZXVyaXN0aWMgaW4gYGFwcGx5UHJvcGVydHlUb0VkaXRvcmAgbWlzLXJlc29sdmVzIGFueSBhc3NldCBwcm9wZXJ0eSB3aG9zZSBuYW1lIGxhY2tzIHRoZVxuICogbWF0Y2hpbmcga2V5d29yZCDigJQgYSBgY2MuTWF0ZXJpYWxgIHByb3BlcnR5IGNhbGxlZCBgc2tpbmAgcmVzb2x2ZWQgdG8gYGNjLlNwcml0ZUZyYW1lYC5cbiAqXG4gKiBUaGUgZ2VuZXJpYyBgYXNzZXRgIGFuZCBgc3RyaW5nYCBzcGVsbGluZ3MgY2Fycnkgbm8gdHlwZSBpbmZvcm1hdGlvbiwgc28gdGhleSBkZWxpYmVyYXRlbHlcbiAqIGhhdmUgTk8gZW50cnkgaGVyZSBhbmQga2VlcCB1c2luZyB0aGUgbmFtZSBoZXVyaXN0aWMgKHVuY2hhbmdlZCBiZWhhdmlvdXIgZm9yIGV4aXN0aW5nIGNhbGxlcnMpLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFOiBSZWFkb25seTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHtcbiAgICBtYXRlcmlhbDogJ2NjLk1hdGVyaWFsJyxcbiAgICB0ZXh0dXJlOiAnY2MuVGV4dHVyZTJEJyxcbiAgICBzcHJpdGVGcmFtZTogJ2NjLlNwcml0ZUZyYW1lJyxcbiAgICBzcHJpdGVBdGxhczogJ2NjLlNwcml0ZUF0bGFzJyxcbiAgICBwcmVmYWI6ICdjYy5QcmVmYWInLFxuICAgIGF1ZGlvQ2xpcDogJ2NjLkF1ZGlvQ2xpcCcsXG4gICAgZm9udDogJ2NjLkZvbnQnLFxuICAgIGFuaW1hdGlvbkNsaXA6ICdjYy5BbmltYXRpb25DbGlwJyxcbiAgICBtZXNoOiAnY2MuTWVzaCcsXG4gICAgc2tlbGV0b246ICdjYy5Ta2VsZXRvbicsXG4gICAgcGh5c2ljc01hdGVyaWFsOiAnY2MuUGh5c2ljc01hdGVyaWFsJyxcbiAgICByZW5kZXJUZXh0dXJlOiAnY2MuUmVuZGVyVGV4dHVyZScsXG4gICAgdGV4dEFzc2V0OiAnY2MuVGV4dEFzc2V0JyxcbiAgICBqc29uQXNzZXQ6ICdjYy5Kc29uQXNzZXQnLFxuICAgIHBhcnRpY2xlQXNzZXQ6ICdjYy5QYXJ0aWNsZUFzc2V0JyxcbiAgICBzY2VuZUFzc2V0OiAnY2MuU2NlbmVBc3NldCdcbn07XG5cbi8qKiBFdmVyeSBwcm9wZXJ0eVR5cGUgY29udmVydFByb3BlcnR5VmFsdWUgYWNjZXB0cyDigJQgdXNlZCB0byBidWlsZCBhbiBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2UuICovXG5leHBvcnQgY29uc3QgU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2ludGVnZXInLCAnZmxvYXQnLCAnYm9vbGVhbicsXG4gICAgJ2NvbG9yJywgJ3ZlYzInLCAndmVjMycsICdzaXplJyxcbiAgICAnbm9kZScsICdjb21wb25lbnQnLFxuICAgIC4uLkFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyxcbiAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknLCAnY29tcG9uZW50QXJyYXknLCAnYXNzZXRBcnJheScsXG4gICAgJ29iamVjdEFycmF5J1xuXSBhcyBjb25zdDtcblxuLyoqXG4gKiBDb252ZXJ0IGEgcmF3IExMTS1zdXBwbGllZCB2YWx1ZSB0byB0aGUgY29ycmVjdCBmb3JtYXQgZm9yIGEgZ2l2ZW4gcHJvcGVydHlUeXBlLlxuICogVGhyb3dzIGlmIHRoZSB2YWx1ZSBmb3JtYXQgaXMgaW52YWxpZCBmb3IgdGhlIGdpdmVuIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlWYWx1ZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgLy8gSXNzdWUgIzc1OiBuZWl0aGVyIGBudWxsYCBub3IgYFwiXCJgIGNvdWxkIGNsZWFyIGEgbm9kZS9jb21wb25lbnQvYXNzZXQgcmVmZXJlbmNlLlxuICAgIC8vIGBub2RlYCBhbmQgZXZlcnkgYXNzZXQtcmVmZXJlbmNlIHR5cGUgYWxyZWFkeSBmb3J3YXJkZWQgYFwiXCJgIHVucmVqZWN0ZWQgKGl0IGhhcHBlbnNcbiAgICAvLyB0byBzYXRpc2Z5IHRoZSBgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJ2AgY2hlY2sgYmVsb3cgYW5kIGJlY29tZSBgeyB1dWlkOiAnJyB9YCksXG4gICAgLy8gYnV0IHJlamVjdGVkIGBudWxsYCBvdXRyaWdodC4gYGNvbXBvbmVudGAvYGNvbXBvbmVudEFycmF5YCBhZGRpdGlvbmFsbHkgZm9yd2FyZGVkIGFcbiAgICAvLyBgXCJcImAgdmFsdWUgVU5SRVNPTFZFRCBpbnN0ZWFkIG9mIHRyZWF0aW5nIGl0IGFzIFwiY2xlYXIgdGhpcyByZWZlcmVuY2VcIiwgd2hpY2ggdGhlblxuICAgIC8vIGZhaWxlZCBkb3duc3RyZWFtIHdpdGggYSBjb25mdXNpbmcgXCJuZWl0aGVyIGEgbm9kZSB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkXCIgZXJyb3IuXG4gICAgLy8gQSBjbGVhcmVkIHNpbmdsZSByZWZlcmVuY2UgYWx3YXlzIHNlcmlhbGl6ZXMgYXMgYHsgdXVpZDogJycgfWAg4oCUIHRoZSBzYW1lIHNoYXBlIGFcbiAgICAvLyBzZXQgcmVmZXJlbmNlIHVzZXMg4oCUIHNvIGl0IG5lZWRzIG5vIHNwZWNpYWwgaGFuZGxpbmcgYW55d2hlcmUgc2V0LXByb3BlcnR5IGFscmVhZHlcbiAgICAvLyBoYW5kbGVzIGEgcmVmZXJlbmNlIGR1bXAuXG4gICAgY29uc3QgaXNDbGVhclJlcXVlc3QgPSB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gJyc7XG4gICAgaWYgKGlzQ2xlYXJSZXF1ZXN0ICYmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlJyB8fCBwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnQnIHx8XG4gICAgICAgIChBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHByb3BlcnR5VHlwZSkpKSB7XG4gICAgICAgIHJldHVybiB7IHV1aWQ6ICcnIH07XG4gICAgfVxuICAgIGlmIChpc0NsZWFyUmVxdWVzdCAmJiAocHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50QXJyYXknIHx8IHByb3BlcnR5VHlwZSA9PT0gJ2Fzc2V0QXJyYXknKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgaWYgKChBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHByb3BlcnR5VHlwZSkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IHZhbHVlIH07XG4gICAgICAgIC8vIElzc3VlICM3MjogYSB3aG9sZS1hcnJheSB3cml0ZSAoYHNoYXJlZE1hdGVyaWFsczogW3V1aWQsIC4uLl1gKSBpcyB0aGUgZm9ybSBjYWxsZXJzXG4gICAgICAgIC8vIHJlYWNoIGZvciBmaXJzdDsgbmFtZSB0aGUgcHJvcGVydHlUeXBlIHRoYXQgY2FycmllcyBpdCBpbnN0ZWFkIG9mIGEgYmFyZSB0eXBlIGVycm9yLlxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgJHtwcm9wZXJ0eVR5cGV9IHZhbHVlIG11c3QgYmUgYSBzaW5nbGUgc3RyaW5nIFVVSUQsIGJ1dCBhbiBhcnJheSB3YXMgcmVjZWl2ZWQuIGAgK1xuICAgICAgICAgICAgICAgIGBUbyB3cml0ZSBhbiBhcnJheSBvZiBhc3NldHMgKGUuZy4gY2MuTWVzaFJlbmRlcmVyLnNoYXJlZE1hdGVyaWFscykgdXNlIHByb3BlcnR5VHlwZSAnYXNzZXRBcnJheScsIGAgK1xuICAgICAgICAgICAgICAgIGBvciB3cml0ZSBvbmUgZWxlbWVudCBhdCBhIHRpbWUgd2l0aCBhIGRvdHRlZCBpbmRleCAoJ3NoYXJlZE1hdGVyaWFscy4wJywgd2hpY2ggYXBwZW5kcyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheSkuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIFVVSUQgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgfVxuICAgIHN3aXRjaCAocHJvcGVydHlUeXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAvLyBJc3N1ZSAjMTE2OiBgU3RyaW5nKHZhbHVlKWAgdHVybnMgYW55IG9iamVjdCBpbnRvIHRoZSBsaXRlcmFsIHRleHRcbiAgICAgICAgICAgIC8vIFwiW29iamVjdCBPYmplY3RdXCIgKGFuZCBhbnkgYXJyYXkgaW50byBhIGNvbW1hLWpvaW5lZCBsaXN0KSwgd2hpY2ggd2FzIHRoZW5cbiAgICAgICAgICAgIC8vIHdyaXR0ZW4gdG8gdGhlIHNjZW5lIHdpdGggc3VjY2Vzczp0cnVlIOKAlCBzaWxlbnQgZGF0YSBsb3NzIG9uIGEgcGxhaW4gc3RyaW5nXG4gICAgICAgICAgICAvLyBmaWVsZC4gUmVqZWN0IGFueXRoaW5nIG5vbi1wcmltaXRpdmUsIG5hbWluZyB0aGUgcmVjZWl2ZWQgdHlwZSwgaW5zdGVhZCBvZlxuICAgICAgICAgICAgLy8gd3JpdGluZyBhIGxvc3N5IHBsYWNlaG9sZGVyLiBNaXJyb3JzIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIGFib3ZlLlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIGBzdHJpbmcgdmFsdWUgbXVzdCBiZSBhIHByaW1pdGl2ZSAocmVjZWl2ZWQgJHtBcnJheS5pc0FycmF5KHZhbHVlKSA/ICdhcnJheScgOiAnb2JqZWN0J30pOyBgICtcbiAgICAgICAgICAgICAgICAgICAgJ3Bhc3MgSlNPTi1lbmNvZGVkIHRleHQgaWYgYSBzdHJ1Y3R1cmVkIHBheWxvYWQgd2FzIGludGVuZGVkJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHN0cmluZyB2YWx1ZSBtdXN0IGJlIGEgcHJpbWl0aXZlIChyZWNlaXZlZCAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzogY2FzZSAnaW50ZWdlcic6IGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIHJldHVybiBOdW1iZXIodmFsdWUpO1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNzY6IGBCb29sZWFuKFwiZmFsc2VcIilgIGlzIGB0cnVlYC4gQSB0cmFuc3BvcnQgdGhhdCBzdHJpbmdpZmllc1xuICAgICAgICAgICAgICAgIC8vIGFyZ3VtZW50cyBkZWxpdmVycyB0aGUgdGV4dCBcImZhbHNlXCIsIHdoaWNoIGJlY2FtZSBhIHdyaXRlIG9mIGB0cnVlYDsgYWdhaW5zdFxuICAgICAgICAgICAgICAgIC8vIGEgcHJvcGVydHkgYWxyZWFkeSBob2xkaW5nIGB0cnVlYCB0aGUgcmVhZC1iYWNrIG1hdGNoZWQgYW5kIHRoZSB0b29sIHJlcG9ydGVkXG4gICAgICAgICAgICAgICAgLy8gYGNoYW5nZVZlcmlmaWVkOiB0cnVlYCBmb3IgYSB2YWx1ZSB0aGUgY2FsbGVyIG5ldmVyIGFza2VkIGZvci4gUGFyc2UgdGhlXG4gICAgICAgICAgICAgICAgLy8gc3BlbGxlZC1vdXQgZm9ybXMgYW5kIHJlZnVzZSBhbnl0aGluZyB0aGF0IGlzIG5vdCBvbmUsIHJhdGhlciB0aGFuIGNvZXJjaW5nXG4gICAgICAgICAgICAgICAgLy8gYnkgdHJ1dGhpbmVzcy5cbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gY29lcmNlQm9vbCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvZXJjZWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICBgYm9vbGVhbiB2YWx1ZSBtdXN0IGJlIHRydWUvZmFsc2UgKHJlY2VpdmVkICR7dHlwZW9mIHZhbHVlfSR7dHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyA/IGAgXCIke3ZhbHVlfVwiYCA6ICcnfSlgXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjb2VyY2VkO1xuICAgICAgICAgICAgfVxuICAgICAgICBjYXNlICdjb2xvcic6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzUyOiBhIEpTT04tc3RyaW5nIHZhbHVlIChlLmcuICd7XCJyXCI6MjU1LFwiZ1wiOjAsXCJiXCI6MH0nKSByZWFjaGVzXG4gICAgICAgICAgICAgICAgLy8gdGhpcyBwb2ludCBhcyBhIHN0cmluZy4gQSBoZXggY29sb3Igc3RyaW5nIChlLmcuIFwiI0ZGMDAwMFwiKSBpcyBOT1RcbiAgICAgICAgICAgICAgICAvLyB2YWxpZCBKU09OLCBzbyBwYXJzZUpzb25QYXlsb2FkIHJldHVybnMgaXQgdW5jaGFuZ2VkOyBvbmx5IGEgSlNPTiBvYmplY3RcbiAgICAgICAgICAgICAgICAvLyBzdHJpbmcgY29lcmNlcyB0byBhbiBvYmplY3QuIFRyeSB0aGUgSlNPTiBwYXRoIGZpcnN0IHNvIGJvdGggYSBoZXhcbiAgICAgICAgICAgICAgICAvLyBzdHJpbmcgYW5kIGEgSlNPTi1zdHJpbmcgb2JqZWN0IGxhbmQgaW4gdGhlIHJpZ2h0IGJyYW5jaC5cbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnc3RyaW5nJykgcmV0dXJuIHBhcnNlQ29sb3JTdHJpbmcoY29lcmNlZCk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLnIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQuZykgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5iKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBhOiBjb2VyY2VkLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQuYSkpKSA6IDI1NVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29sb3IgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCByLCBnLCBiIHByb3BlcnRpZXMgb3IgYSBoZXhhZGVjaW1hbCBzdHJpbmcgKGUuZy4sIFwiI0ZGMDAwMFwiKSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAndmVjMic6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKGNvZXJjZWQueCkgfHwgMCwgeTogTnVtYmVyKGNvZXJjZWQueSkgfHwgMCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWZWMyIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSBwcm9wZXJ0aWVzIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICd2ZWMzJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSByZXR1cm4geyB4OiBOdW1iZXIoY29lcmNlZC54KSB8fCAwLCB5OiBOdW1iZXIoY29lcmNlZC55KSB8fCAwLCB6OiBOdW1iZXIoY29lcmNlZC56KSB8fCAwIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZlYzMgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB4LCB5LCB6IHByb3BlcnRpZXMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3NpemUnOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHJldHVybiB7IHdpZHRoOiBOdW1iZXIoY29lcmNlZC53aWR0aCkgfHwgMCwgaGVpZ2h0OiBOdW1iZXIoY29lcmNlZC5oZWlnaHQpIHx8IDAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2l6ZSB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHdpZHRoLCBoZWlnaHQgcHJvcGVydGllcyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnbm9kZSc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSByZWZlcmVuY2UgdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdjb21wb25lbnQnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB2YWx1ZTsgLy8gcmVzb2x2ZWQgdG8gX19pZF9fIGxhdGVyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudCByZWZlcmVuY2UgdmFsdWUgbXVzdCBiZSBhIHN0cmluZyAobm9kZSBVVUlEIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdjb21wb25lbnRBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4gaXRlbTsgLy8gZWFjaCByZXNvbHZlZCB0byBhIGNvbXBvbmVudCBfX2lkX18gbGF0ZXJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnRBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBub2RlIFVVSURzIChlYWNoIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpIChyZWNlaXZlZCBpdGVtIHR5cGVvZiAke3R5cGVvZiBpdGVtfSlgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50QXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnYXNzZXRBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gQW4gYXJyYXkgb2YgYXNzZXQgcmVmZXJlbmNlcyAoZS5nLiBgQHByb3BlcnR5KHsgdHlwZTogW0F1ZGlvQ2xpcF0gfSlgKS5cbiAgICAgICAgICAgICAgICAvLyBFdmVyeSBzaW5nbGUtYXNzZXQgcHJvcGVydHlUeXBlIHJlamVjdHMgYW4gYXJyYXksIHNvIHdpdGhvdXQgdGhpcyBjYXNlIHN1Y2ggYVxuICAgICAgICAgICAgICAgIC8vIGZpZWxkIHdhcyB1bndyaXRhYmxlLiBFbGVtZW50cyBzZXJpYWxpemUgYXMgYHsgdXVpZCB9YCwgbGlrZSBhIHNpbmdsZSBhc3NldC5cbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IGl0ZW0gfTtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBhc3NldEFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIGFzc2V0IFVVSURzIChyZWNlaXZlZCBpdGVtIHR5cGVvZiAke3R5cGVvZiBpdGVtfSlgKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgYXNzZXRBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IG9mIGFzc2V0IFVVSUQgc3RyaW5ncyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnbm9kZUFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7IGlmICh0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IGl0ZW0gfTsgdGhyb3cgbmV3IEVycm9yKGBOb2RlQXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgVVVJRHMgKHJlY2VpdmVkIGl0ZW0gdHlwZW9mICR7dHlwZW9mIGl0ZW19KWApOyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZUFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ2NvbG9yQXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiBpdGVtICE9PSBudWxsICYmICdyJyBpbiBpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSwgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLCBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NSB9O1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHI6IDI1NSwgZzogMjU1LCBiOiAyNTUsIGE6IDI1NSB9O1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb2xvckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ251bWJlckFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIElzc3VlICM2NjogYE51bWJlcihpdGVtKWAgb24gYW4gb2JqZWN0IHlpZWxkcyBOYU4sIHdoaWNoIHRoZSBlZGl0b3JcbiAgICAgICAgICAgICAgICAgICAgLy8gYWNjZXB0cyBhcyBhIHdyaXR0ZW4gdmFsdWUg4oCUIGEgY2FsbGVyIHBhc3Npbmcga2V5ZnJhbWUvYWxwaGEta2V5IE9CSkVDVFNcbiAgICAgICAgICAgICAgICAgICAgLy8gaGVyZSAodGhlIHNoYXBlIHRoZSBhcnJheS1vZi1vYmplY3QgZmllbGRzIGFjdHVhbGx5IGhvbGQpIGdvdCBhIHN1Y2Nlc3NcbiAgICAgICAgICAgICAgICAgICAgLy8gcmVzcG9uc2Ugb3ZlciBhIE5hTi1maWxsZWQgZmllbGQuIE5hbWUgdGhlIHJlY2VpdmVkIGl0ZW0gaW5zdGVhZC5cbiAgICAgICAgICAgICAgICAgICAgYXNzZXJ0QXJyYXlJdGVtSXNQcmltaXRpdmUoJ251bWJlckFycmF5JywgaXRlbSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIoaXRlbSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE51bWJlckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3N0cmluZ0FycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFNhbWUgYXMgbnVtYmVyQXJyYXkgYWJvdmU6IGBTdHJpbmcoaXRlbSlgIHJlbmRlcnMgYW55IG9iamVjdCBhcyB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gbGl0ZXJhbCB0ZXh0IFwiW29iamVjdCBPYmplY3RdXCIgKGlzc3VlICMxMTYncyBmYWlsdXJlIHNoYXBlLCBwZXIgZWxlbWVudCkuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydEFycmF5SXRlbUlzUHJpbWl0aXZlKCdzdHJpbmdBcnJheScsIGl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nKGl0ZW0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHJpbmdBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdvYmplY3RBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzY2OiBhcnJheSBvZiBwbGFpbiB2YWx1ZSBvYmplY3RzIChjYy5SZWFsQ3VydmUga2V5RnJhbWVzLCBjYy5HcmFkaWVudFxuICAgICAgICAgICAgICAgIC8vIGFscGhhS2V5cykuIEVsZW1lbnRzIGFyZSB3cml0dGVuIGxlYWYgYnkgbGVhZiwgc28gdGhleSBtdXN0IGJlIG9iamVjdHMgd2hvc2VcbiAgICAgICAgICAgICAgICAvLyBrZXlzIGFyZSB0aGUgQ0NDbGFzcyBmaWVsZCBuYW1lczsgYSBgdXVpZGAga2V5IG1lYW5zIGEgcmVmZXJlbmNlLCB3aGljaCBoYXNcbiAgICAgICAgICAgICAgICAvLyBpdHMgb3duIHByb3BlcnR5VHlwZXMgYW5kIGEgZGlmZmVyZW50IGR1bXAgc2hhcGUuXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjb2VyY2VkKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9iamVjdEFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgb2YgcGxhaW4gb2JqZWN0cyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29lcmNlZC5mb3JFYWNoKChpdGVtOiBhbnksIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNQbGFpbk9iamVjdChpdGVtKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBvYmplY3RBcnJheSBpdGVtcyBtdXN0IGJlIHBsYWluIG9iamVjdHMgKGl0ZW0gJHtpZHh9IGlzICR7QXJyYXkuaXNBcnJheShpdGVtKSA/ICdhbiBhcnJheScgOiBpdGVtID09PSBudWxsID8gJ251bGwnIDogdHlwZW9mIGl0ZW19KS4gUHJpbWl0aXZlIGFycmF5cyB1c2UgbnVtYmVyQXJyYXkvc3RyaW5nQXJyYXkuYCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKCd1dWlkJyBpbiBpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYG9iamVjdEFycmF5IGl0ZW0gJHtpZHh9IGhhcyBhICd1dWlkJyBrZXksIHNvIGl0IGlzIGEgcmVmZXJlbmNlIOKAlCB1c2Ugbm9kZUFycmF5LCBjb21wb25lbnRBcnJheSBvciBhc3NldEFycmF5IGZvciByZWZlcmVuY2UgYXJyYXlzLmApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvZXJjZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHByb3BlcnR5IHR5cGU6ICR7cHJvcGVydHlUeXBlfS4gU3VwcG9ydGVkIHR5cGVzOiAke1NVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUy5qb2luKCcsICcpfWApO1xuICAgIH1cbn1cblxuLyoqIEdlbmVyYXRlIGFuIExMTS1mcmllbmRseSBzdWdnZXN0aW9uIHdoZW4gcmVxdWVzdGVkIGNvbXBvbmVudCB0eXBlIGlzIG5vdCBmb3VuZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbihyZXF1ZXN0ZWRUeXBlOiBzdHJpbmcsIGF2YWlsYWJsZVR5cGVzOiBzdHJpbmdbXSwgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2ltaWxhclR5cGVzID0gYXZhaWxhYmxlVHlwZXMuZmlsdGVyKHR5cGUgPT5cbiAgICAgICAgdHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHJlcXVlc3RlZFR5cGUudG9Mb3dlckNhc2UoKSkgfHxcbiAgICAgICAgcmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHR5cGUudG9Mb3dlckNhc2UoKSlcbiAgICApO1xuXG4gICAgbGV0IGluc3RydWN0aW9uID0gJyc7XG4gICAgaWYgKHNpbWlsYXJUeXBlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5Gb3VuZCBzaW1pbGFyIGNvbXBvbmVudHM6ICR7c2ltaWxhclR5cGVzLmpvaW4oJywgJyl9YDtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3Rpb246IFBlcmhhcHMgeW91IG1lYW50ICcke3NpbWlsYXJUeXBlc1swXX0nP2A7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvcGVydHlUb0NvbXBvbmVudE1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICAnc3RyaW5nJzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCcsICdjYy5FZGl0Qm94J10sXG4gICAgICAgICd0ZXh0JzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCddLFxuICAgICAgICAnZm9udFNpemUnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXG4gICAgICAgICdzcHJpdGVGcmFtZSc6IFsnY2MuU3ByaXRlJ10sXG4gICAgICAgICdjb2xvcic6IFsnY2MuTGFiZWwnLCAnY2MuU3ByaXRlJywgJ2NjLkdyYXBoaWNzJ10sXG4gICAgICAgICdub3JtYWxDb2xvcic6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICdwcmVzc2VkQ29sb3InOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAndGFyZ2V0JzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ2NvbnRlbnRTaXplJzogWydjYy5VSVRyYW5zZm9ybSddLFxuICAgICAgICAnYW5jaG9yUG9pbnQnOiBbJ2NjLlVJVHJhbnNmb3JtJ11cbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb21tZW5kZWRDb21wb25lbnRzID0gcHJvcGVydHlUb0NvbXBvbmVudE1hcFtwcm9wZXJ0eV0gfHwgW107XG4gICAgY29uc3QgYXZhaWxhYmxlUmVjb21tZW5kZWQgPSByZWNvbW1lbmRlZENvbXBvbmVudHMuZmlsdGVyKGNvbXAgPT4gYXZhaWxhYmxlVHlwZXMuaW5jbHVkZXMoY29tcCkpO1xuICAgIGlmIChhdmFpbGFibGVSZWNvbW1lbmRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5CYXNlZCBvbiBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nLCByZWNvbW1lbmRlZCBjb21wb25lbnRzOiAke2F2YWlsYWJsZVJlY29tbWVuZGVkLmpvaW4oJywgJyl9YDtcbiAgICB9XG5cbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuU3VnZ2VzdGVkIEFjdGlvbnM6YDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMS4gVXNlIG1hbmFnZV9jb21wb25lbnQgYWN0aW9uPWdldF9hbGwgbm9kZVV1aWQ9XCIuLi5cIiB0byB2aWV3IGFsbCBjb21wb25lbnRzIG9uIHRoZSBub2RlYDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMi4gSWYgeW91IG5lZWQgdG8gYWRkIGEgY29tcG9uZW50LCB1c2UgYWN0aW9uPWFkZCB3aXRoIGNvbXBvbmVudFR5cGU9XCIke3JlcXVlc3RlZFR5cGV9XCJgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4zLiBWZXJpZnkgdGhhdCB0aGUgY29tcG9uZW50IHR5cGUgbmFtZSBpcyBjb3JyZWN0IChjYXNlLXNlbnNpdGl2ZSlgO1xuXG4gICAgcmV0dXJuIGluc3RydWN0aW9uO1xufVxuXG4vKiogUmV0dXJuIGF2YWlsYWJsZSBDb2NvcyBDcmVhdG9yIGJ1aWx0LWluIGNvbXBvbmVudCB0eXBlcyBieSBjYXRlZ29yeSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0KGNhdGVnb3J5OiBzdHJpbmcgPSAnYWxsJyk6IEFjdGlvblRvb2xSZXN1bHQge1xuICAgIGNvbnN0IGNvbXBvbmVudENhdGVnb3JpZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICAgICAgcmVuZGVyZXI6IFsnY2MuU3ByaXRlJywgJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLk1hc2snLCAnY2MuR3JhcGhpY3MnXSxcbiAgICAgICAgdWk6IFsnY2MuQnV0dG9uJywgJ2NjLlRvZ2dsZScsICdjYy5TbGlkZXInLCAnY2MuU2Nyb2xsVmlldycsICdjYy5FZGl0Qm94JywgJ2NjLlByb2dyZXNzQmFyJ10sXG4gICAgICAgIHBoeXNpY3M6IFsnY2MuUmlnaWRCb2R5MkQnLCAnY2MuQm94Q29sbGlkZXIyRCcsICdjYy5DaXJjbGVDb2xsaWRlcjJEJywgJ2NjLlBvbHlnb25Db2xsaWRlcjJEJ10sXG4gICAgICAgIGFuaW1hdGlvbjogWydjYy5BbmltYXRpb24nLCAnY2MuQW5pbWF0aW9uQ2xpcCcsICdjYy5Ta2VsZXRhbEFuaW1hdGlvbiddLFxuICAgICAgICBhdWRpbzogWydjYy5BdWRpb1NvdXJjZSddLFxuICAgICAgICBsYXlvdXQ6IFsnY2MuTGF5b3V0JywgJ2NjLldpZGdldCcsICdjYy5QYWdlVmlldycsICdjYy5QYWdlVmlld0luZGljYXRvciddLFxuICAgICAgICBlZmZlY3RzOiBbJ2NjLk1vdGlvblN0cmVhaycsICdjYy5QYXJ0aWNsZVN5c3RlbTJEJ10sXG4gICAgICAgIGNhbWVyYTogWydjYy5DYW1lcmEnXSxcbiAgICAgICAgbGlnaHQ6IFsnY2MuTGlnaHQnLCAnY2MuRGlyZWN0aW9uYWxMaWdodCcsICdjYy5Qb2ludExpZ2h0JywgJ2NjLlNwb3RMaWdodCddXG4gICAgfTtcblxuICAgIGxldCBjb21wb25lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChjYXRlZ29yeSA9PT0gJ2FsbCcpIHtcbiAgICAgICAgZm9yIChjb25zdCBjYXQgaW4gY29tcG9uZW50Q2F0ZWdvcmllcykge1xuICAgICAgICAgICAgY29tcG9uZW50cyA9IGNvbXBvbmVudHMuY29uY2F0KGNvbXBvbmVudENhdGVnb3JpZXNbY2F0XSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNvbXBvbmVudENhdGVnb3JpZXNbY2F0ZWdvcnldKSB7XG4gICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRDYXRlZ29yaWVzW2NhdGVnb3J5XTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGNhdGVnb3J5LCBjb21wb25lbnRzIH0pO1xufVxuXG4vKiogUmVkaXJlY3Qgc2V0X3Byb3BlcnR5IGNhbGxzIHRoYXQgdGFyZ2V0IG5vZGUtbGV2ZWwgcHJvcGVydGllcyB0byB0aGUgY29ycmVjdCBtYW5hZ2Vfbm9kZSBhY3Rpb24gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzOiB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZzsgY29tcG9uZW50VHlwZTogc3RyaW5nOyBwcm9wZXJ0eTogc3RyaW5nOyB2YWx1ZTogYW55O1xufSk6IEFjdGlvblRvb2xSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdmFsdWUgfSA9IGFyZ3M7XG4gICAgY29uc3Qgbm9kZUJhc2ljUHJvcGVydGllcyA9IFsnbmFtZScsICdhY3RpdmUnLCAnbGF5ZXInLCAnbW9iaWxpdHknLCAncGFyZW50JywgJ2NoaWxkcmVuJywgJ2hpZGVGbGFncyddO1xuICAgIGNvbnN0IG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzID0gWydwb3NpdGlvbicsICdyb3RhdGlvbicsICdzY2FsZScsICdldWxlckFuZ2xlcycsICdhbmdsZSddO1xuXG4gICAgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5Ob2RlJyB8fCBjb21wb25lbnRUeXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgaWYgKG5vZGVCYXNpY1Byb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhIG5vZGUgYmFzaWMgcHJvcGVydHksIG5vdCBhIGNvbXBvbmVudCBwcm9wZXJ0eWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF9wcm9wZXJ0eSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCBwcm9wZXJ0eT1cIiR7cHJvcGVydHl9XCIsIHZhbHVlPSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZVRyYW5zZm9ybVByb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhIG5vZGUgdHJhbnNmb3JtIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtIHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsICR7cHJvcGVydHl9PSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBSZWZ1c2UgYSBzY2FsYXIgcHJvcGVydHlUeXBlIGFpbWVkIGF0IGEgcHJvcGVydHkgdGhhdCBjdXJyZW50bHkgaG9sZHMgYW4gQVJSQVkgKGlzc3VlICMxMTUpLlxuICpcbiAqIEEgc2luZ2xlLXZhbHVlIHdyaXRlIChgYXNzZXRgLCBgbm9kZWAsIGBzdHJpbmdgLCAuLi4pIGFnYWluc3QgYW4gYXJyYXktdHlwZWQgYEBwcm9wZXJ0eWBcbiAqIGRvZXMgbm90IGZhaWwgY2xlYW5seTogdGhlIGVkaXRvciBhY2NlcHRzIHRoZSBkdW1wLCB0aGUgZmllbGQgc3RvcHMgZGVjb2RpbmcsIGFuZCBpdCB2YW5pc2hlc1xuICogZnJvbSB0aGUgY29tcG9uZW50J3Mgb3duIGBnZXRfaW5mb2AgdW50aWwgdGhlIGNvbXBvbmVudCBpcyByZW1vdmVkIGFuZCByZS1hZGRlZC4gVGhlIGNhbGxlclxuICogaGFzIG5vIHdheSB0byByZWNvdmVyLCBzbyB0aGUgd3JpdGUgaXMgcmVmdXNlZCBiZWZvcmUgaXQgaXMgc2VudCwgbmFtaW5nIHRoZSBzdXBwb3J0ZWRcbiAqIHdob2xlLWFycmF5IHByb3BlcnR5VHlwZXMgYW5kIHRoZSBlbGVtZW50LXdpc2UgZG90dGVkIGZvcm0uXG4gKlxuICogUmV0dXJucyB0aGUgcmVmdXNhbCBtZXNzYWdlLCBvciBgbnVsbGAgd2hlbiB0aGUgd3JpdGUgaXMgbm90IGEgc2NhbGFyLW92ZXItYXJyYXkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZXNjcmliZVNjYWxhcldyaXRlVG9BcnJheVByb3BlcnR5KHByb3BlcnR5VHlwZTogc3RyaW5nLCBvcmlnaW5hbFZhbHVlOiBhbnksIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkob3JpZ2luYWxWYWx1ZSkgfHwgcHJvcGVydHlUeXBlLmVuZHNXaXRoKCdBcnJheScpKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gKFxuICAgICAgICBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhbiBBUlJBWSwgYnV0IHByb3BlcnR5VHlwZSAnJHtwcm9wZXJ0eVR5cGV9JyB3cml0ZXMgYSBzaW5nbGUgdmFsdWU7IGAgK1xuICAgICAgICBgdGhlIGVkaXRvciB3b3VsZCBkcm9wIHRoZSBmaWVsZCBmcm9tIHRoZSBjb21wb25lbnQgYW5kIGl0IGNvdWxkIG5vdCBiZSByZXN0b3JlZCBieSBhIGxhdGVyIHdyaXRlIChpc3N1ZSAjMTE1KS4gYCArXG4gICAgICAgIGBTZXQgdGhlIHdob2xlIGFycmF5IHdpdGggJ2Fzc2V0QXJyYXknLCAnbm9kZUFycmF5JywgJ2NvbXBvbmVudEFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknIG9yIGAgK1xuICAgICAgICBgJ3N0cmluZ0FycmF5Jywgb3Igd3JpdGUgb25lIGVsZW1lbnQgd2l0aCBhIGRvdHRlZCBpbmRleCAoJyR7cHJvcGVydHl9LjAnLCAnJHtwcm9wZXJ0eX0uPGxlbmd0aD4nIGFwcGVuZHMpLiBgICtcbiAgICAgICAgYE5vdGhpbmcgd2FzIHdyaXR0ZW4uYFxuICAgICk7XG59XG5cbi8qKiBWZXJpZnkgYSBwcm9wZXJ0eSBjaGFuZ2Ugd2FzIGFwcGxpZWQ7IHVzZXMgZ2V0Q29tcG9uZW50SW5mbyBjYWxsYmFjayB0byBhdm9pZCBjaXJjdWxhciBkZXBzICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICBvcmlnaW5hbFZhbHVlOiBhbnksXG4gICAgZXhwZWN0ZWRWYWx1ZTogYW55LFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8eyB2ZXJpZmllZDogYm9vbGVhbjsgYWN0dWFsVmFsdWU6IGFueTsgZnVsbERhdGE6IGFueSB9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50SW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgICAgICBpZiAoY29tcG9uZW50SW5mby5zdWNjZXNzICYmIGNvbXBvbmVudEluZm8uZGF0YSkge1xuICAgICAgICAgICAgLy8gV2FsayBkb3R0ZWQgcHJvcGVydHkgcGF0aHMgdGhyb3VnaCBuZXN0ZWQgQ0NDbGFzcyBncm91cCBkdW1wcy5cbiAgICAgICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eURhdGE6IGFueSA9IGNvbXBvbmVudEluZm8uZGF0YS5wcm9wZXJ0aWVzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlEYXRhOyBpKyspIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBwcm9wZXJ0eURhdGFbc2VnbWVudHNbaV1dO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YS52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGE7XG4gICAgICAgICAgICBpZiAocHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhKSB7XG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGEudmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEV4dHJhY3RzIGEgcmVmZXJlbmNlJ3MgdXVpZCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIGVkaXRvcidzIGR1bXAgd3JhcHMgaXRcbiAgICAgICAgICAgIC8vIGFzIGEgcGxhaW4gc3RyaW5nICh7IHV1aWQ6ICd4JyB9KSBvciBhcyBhIG5lc3RlZCBsZWFmIGRlc2NyaXB0b3JcbiAgICAgICAgICAgIC8vICh7IHV1aWQ6IHsgdmFsdWU6ICd4JyB9IH0pIOKAlCB0aGUgc2FtZSBhbWJpZ3VpdHkgdGhlIHNpbmdsZS1yZWZlcmVuY2UgYnJhbmNoXG4gICAgICAgICAgICAvLyBiZWxvdyBhbHJlYWR5IHRvbGVyYXRlcy5cbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RVdWlkID0gKHJlZjogYW55KTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgICAgICAvLyBBbiBhc3NldC1hcnJheSBlbGVtZW50IHJlYWRzIGJhY2sgYXMgYSBmdWxsIGVsZW1lbnQgZHVtcFxuICAgICAgICAgICAgICAgIC8vICh7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSwgLi4uIH0pLCBub3QgYSBiYXJlIHsgdXVpZCB9IHJlZiDigJQgdW53cmFwIGl0LlxuICAgICAgICAgICAgICAgIGlmIChyZWYgJiYgdHlwZW9mIHJlZiA9PT0gJ29iamVjdCcgJiYgISgndXVpZCcgaW4gcmVmKSAmJiByZWYudmFsdWUgJiYgdHlwZW9mIHJlZi52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVmID0gcmVmLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlZiB8fCB0eXBlb2YgcmVmICE9PSAnb2JqZWN0JyB8fCAhKCd1dWlkJyBpbiByZWYpKSByZXR1cm4gJyc7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gcmVmLnV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKHJhdyAmJiB0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHJhdykgcmV0dXJuIHJhdy52YWx1ZSB8fCAnJztcbiAgICAgICAgICAgICAgICByZXR1cm4gcmF3IHx8ICcnO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgbGV0IHZlcmlmaWVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShleHBlY3RlZFZhbHVlKSAmJiBleHBlY3RlZFZhbHVlLnNvbWUoZSA9PiBpc1BsYWluT2JqZWN0KGUpICYmICEoJ3V1aWQnIGluIGUpKSkge1xuICAgICAgICAgICAgICAgIC8vIG9iamVjdEFycmF5IChpc3N1ZSAjNjYpOiBlbGVtZW50cyBhcmUgcGxhaW4gdmFsdWUgb2JqZWN0cywgbm90IHJlZmVyZW5jZXMuXG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBtYXRjaGVzUmVxdWVzdGVkU3RydWN0dXJlKGV4cGVjdGVkVmFsdWUsIHByb3BlcnR5RGF0YSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZXhwZWN0ZWRWYWx1ZSkpIHtcbiAgICAgICAgICAgICAgICAvLyBub2RlQXJyYXkgLyBjb21wb25lbnRBcnJheTogZXZlcnkgZWxlbWVudCBpcyBpdHNlbGYgYSB7IHV1aWQgfSByZWZlcmVuY2UuXG4gICAgICAgICAgICAgICAgLy8gQ29tcGFyZSBieSBwZXItZWxlbWVudCB1dWlkIChvcmRlci1wcmVzZXJ2aW5nKSwgbmV2ZXIgYnkgZGVlcC1lcXVhbGluZyB0aGVcbiAgICAgICAgICAgICAgICAvLyB3aG9sZSBhcnJheSDigJQgdGhlIGVkaXRvcidzIHJlYWQtYmFjayBkdW1wIG1heSBjYXJyeSBleHRyYSBwZXItZWxlbWVudFxuICAgICAgICAgICAgICAgIC8vIG1ldGFkYXRhIChlLmcuIGFuIGludGVybmFsIG9iamVjdCBpZCkgdGhhdCBhIHBsYWluIGNvbXBvbmVudC9ub2RlIHJlZmVyZW5jZVxuICAgICAgICAgICAgICAgIC8vIHdyaXRlIG5ldmVyIGluY2x1ZGVkLCB3aGljaCB3b3VsZCBmYWlsIGEgSlNPTi5zdHJpbmdpZnkgY29tcGFyaXNvbiBldmVuXG4gICAgICAgICAgICAgICAgLy8gdGhvdWdoIGV2ZXJ5IHJlZmVyZW5jZSByZXNvbHZlZCBjb3JyZWN0bHkuXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0dWFsQXJyID0gQXJyYXkuaXNBcnJheShhY3R1YWxWYWx1ZSkgPyBhY3R1YWxWYWx1ZSA6IFtdO1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gYWN0dWFsQXJyLmxlbmd0aCA9PT0gZXhwZWN0ZWRWYWx1ZS5sZW5ndGggJiZcbiAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWRWYWx1ZS5ldmVyeSgoZXhwOiBhbnksIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHBVdWlkID0gZXh0cmFjdFV1aWQoZXhwKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBleHBVdWlkICE9PSAnJyAmJiBleHBVdWlkID09PSBleHRyYWN0VXVpZChhY3R1YWxBcnJbaWR4XSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZXhwZWN0ZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgZXhwZWN0ZWRWYWx1ZSAhPT0gbnVsbCAmJiAndXVpZCcgaW4gZXhwZWN0ZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM3MyAoc2Vjb25kYXJ5IGZpbmRpbmcpOiB0aGUgdHJhaWxpbmcgYCYmIGV4cGVjdGVkVXVpZCAhPT0gJydgIG1hZGVcbiAgICAgICAgICAgICAgICAvLyBgdmVyaWZpZWRgIEFMV0FZUyBmYWxzZSB3aGVuIGNsZWFyaW5nIGEgcmVmZXJlbmNlIHRvIGFuIGVtcHR5IHV1aWQg4oCUIGV2ZW5cbiAgICAgICAgICAgICAgICAvLyB3aGVuIGFjdHVhbFV1aWQgPT09IGV4cGVjdGVkVXVpZCA9PT0gJycgYW5kIHRoZSBjbGVhciBnZW51aW5lbHkgc3VjY2VlZGVkXG4gICAgICAgICAgICAgICAgLy8gKGlzc3VlICM3NSkuIERyb3BwaW5nIGl0IGRvZXMgbm90IHdlYWtlbiB0aGUgbm9uLWVtcHR5IGNhc2U6IGEgbWlzc2luZy9cbiAgICAgICAgICAgICAgICAvLyB1bmRlZmluZWQgYWN0dWFsVmFsdWUgYWxyZWFkeSBjb21wdXRlcyBhY3R1YWxVdWlkID09PSAnJywgd2hpY2ggY2FuIG5ldmVyXG4gICAgICAgICAgICAgICAgLy8gZXF1YWwgYSBub24tZW1wdHkgZXhwZWN0ZWRVdWlkLCBzbyB0aGF0IGNvbXBhcmlzb24gYWxvbmUgc3RpbGwgZmFpbHMgaXQuXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0dWFsVXVpZCA9IGFjdHVhbFZhbHVlICYmIHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIGFjdHVhbFZhbHVlID8gYWN0dWFsVmFsdWUudXVpZCA6ICcnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVXVpZCA9IGV4cGVjdGVkVmFsdWUudXVpZCB8fCAnJztcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFV1aWQgPT09IGV4cGVjdGVkVXVpZDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSB0eXBlb2YgZXhwZWN0ZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmIGFjdHVhbFZhbHVlICE9PSBudWxsICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBKU09OLnN0cmluZ2lmeShhY3R1YWxWYWx1ZSkgPT09IEpTT04uc3RyaW5naWZ5KGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gYWN0dWFsVmFsdWUgPT09IGV4cGVjdGVkVmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IFN0cmluZyhhY3R1YWxWYWx1ZSkgPT09IFN0cmluZyhleHBlY3RlZFZhbHVlKSB8fCBOdW1iZXIoYWN0dWFsVmFsdWUpID09PSBOdW1iZXIoZXhwZWN0ZWRWYWx1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgZnVsbERhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWRQcm9wZXJ0eTogeyBuYW1lOiBwcm9wZXJ0eSwgYmVmb3JlOiBvcmlnaW5hbFZhbHVlLCBleHBlY3RlZDogZXhwZWN0ZWRWYWx1ZSwgYWN0dWFsOiBhY3R1YWxWYWx1ZSwgdmVyaWZpZWQgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3VtbWFyeTogeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgdG90YWxQcm9wZXJ0aWVzOiBPYmplY3Qua2V5cyhjb21wb25lbnRJbmZvLmRhdGE/LnByb3BlcnRpZXMgfHwge30pLmxlbmd0aCB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYW5hZ2VDb21wb25lbnQudmVyaWZ5UHJvcGVydHlDaGFuZ2VdIFZlcmlmaWNhdGlvbiBmYWlsZWQ6JywgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIGFjdHVhbFZhbHVlOiB1bmRlZmluZWQsIGZ1bGxEYXRhOiBudWxsIH07XG59XG4iXX0=