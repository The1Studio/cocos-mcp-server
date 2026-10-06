"use strict";
/**
 * Pure helper functions for component property analysis, validation, and query utilities.
 * Extracted from ManageComponent to keep manage-component.ts under 200 lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_PROPERTY_TYPES = exports.ASSET_TYPE_BY_PROPERTY_TYPE = exports.ASSET_REFERENCE_PROPERTY_TYPES = void 0;
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
            `have no supported propertyType yet — no value was written (issue #66).`);
    }
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
    'nodeArray', 'colorArray', 'numberArray', 'stringArray', 'componentArray', 'assetArray'
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
            if (Array.isArray(expectedValue)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFnQ0gsb0VBWUM7QUFrQkQsOERBMEJDO0FBSUQsMENBcUlDO0FBR0QsNENBb0JDO0FBeURELG9EQWdMQztBQUdELGtFQXFDQztBQUdELGdFQXVCQztBQUdELGdFQXdCQztBQWFELGdGQVNDO0FBR0Qsc0VBeUZDO0FBOXFCRCxvQ0FBMkQ7QUFDM0Qsa0RBQWtFO0FBRWxFOzs7Ozs7OztHQVFHO0FBQ0gsU0FBUywwQkFBMEIsQ0FBQyxZQUFvQixFQUFFLElBQVM7SUFDL0QsSUFBSSxJQUFJLEtBQUssSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVDLE1BQU0sSUFBSSxLQUFLLENBQ1gsR0FBRyxZQUFZLHVDQUF1QyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsS0FBSztZQUNuRyw2RkFBNkY7WUFDN0Ysd0VBQXdFLENBQzNFLENBQUM7SUFDTixDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7O0dBT0c7QUFDSCxTQUFnQiw0QkFBNEIsQ0FBQyxTQUFjO0lBQ3ZELElBQUksQ0FBQSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsS0FBSyxLQUFJLE9BQU8sU0FBUyxDQUFDLEtBQUssS0FBSyxRQUFRO1FBQUUsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFDO0lBRXBGLE1BQU0sVUFBVSxHQUF3QixFQUFFLENBQUM7SUFDM0MsSUFBSSxDQUFDLFNBQVMsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRO1FBQUUsT0FBTyxVQUFVLENBQUM7SUFDbkUsTUFBTSxXQUFXLEdB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QWEsQ0FBQyxDQUFDO2dCQUM3RSxDQUFDO3FCQUFNLENBQUM7b0JBQ0osUUFBUSxHQUFHLFdBQVcsS0FBSyxhQUFhLENBQUM7Z0JBQzdDLENBQUM7WUFDTCxDQUFDO2lCQUFNLENBQUM7Z0JBQ0osUUFBUSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUM5RyxDQUFDO1lBRUQsT0FBTztnQkFDSCxRQUFRO2dCQUNSLFdBQVc7Z0JBQ1gsUUFBUSxFQUFFO29CQUNOLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUU7b0JBQ25ILGdCQUFnQixFQUFFLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBLE1BQUEsYUFBYSxDQUFDLElBQUksMENBQUUsVUFBVSxLQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtpQkFDM0g7YUFDSixDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyw2REFBNkQsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBQ0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHVyZSBoZWxwZXIgZnVuY3Rpb25zIGZvciBjb21wb25lbnQgcHJvcGVydHkgYW5hbHlzaXMsIHZhbGlkYXRpb24sIGFuZCBxdWVyeSB1dGlsaXRpZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29lcmNlQm9vbCwgcGFyc2VKc29uUGF5bG9hZCB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5cbi8qKlxuICogUmVqZWN0IGEgbm9uLXByaW1pdGl2ZSBlbGVtZW50IGluIGEgcHJpbWl0aXZlIGFycmF5LCBuYW1pbmcgd2hhdCBhcnJpdmVkIChpc3N1ZSAjNjYpLlxuICpcbiAqIGBudW1iZXJBcnJheWAgYW5kIGBzdHJpbmdBcnJheWAgYXJlIHRoZSBvbmx5IHR3byBwcm9wZXJ0eVR5cGVzIHdob3NlIGNvbnZlcnNpb24gY29lcmNlc1xuICogc2lsZW50bHksIHNvIGEgY2FsbGVyIHJlYWNoaW5nIGZvciBvbmUgb2YgdGhlbSB3aXRoIE9CSkVDVCBlbGVtZW50cyDigJQgY2MuUmVhbEN1cnZlXG4gKiBrZXlmcmFtZXMsIGNjLkdyYWRpZW50IGFscGhhIGtleXMsIG9yIGFueSBvdGhlciBhcnJheS1vZi1wbGFpbi1vYmplY3QgZmllbGQg4oCUIGhhZCBldmVyeVxuICogZWxlbWVudCB0dXJuZWQgaW50byBgTmFOYCAvIGBcIltvYmplY3QgT2JqZWN0XVwiYCBhbmQgd3JpdHRlbiB0byB0aGUgc2NlbmUgb24gYSBgc3VjY2Vzc2BcbiAqIHJlc3BvbnNlLiBOZWl0aGVyIGlzIGEgdmFsdWUgYW55b25lIG1lYW50IHRvIHdyaXRlLCBzbyByZWZ1c2luZyBiZWF0cyBjb2VyY2luZy5cbiAqL1xuZnVuY3Rpb24gYXNzZXJ0QXJyYXlJdGVtSXNQcmltaXRpdmUocHJvcGVydHlUeXBlOiBzdHJpbmcsIGl0ZW06IGFueSk6IHZvaWQge1xuICAgIGlmIChpdGVtICE9PSBudWxsICYmIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgJHtwcm9wZXJ0eVR5cGV9IGl0ZW1zIG11c3QgYmUgcHJpbWl0aXZlcyAocmVjZWl2ZWQgJHtBcnJheS5pc0FycmF5KGl0ZW0pID8gJ2FycmF5JyA6ICdvYmplY3QnfSkuIGAgK1xuICAgICAgICAgICAgYEFycmF5LW9mLU9CSkVDVCBmaWVsZHMgKGUuZy4gYSBjYy5SZWFsQ3VydmUgc3BsaW5lJ3Mga2V5RnJhbWVzLCBhIGNjLkdyYWRpZW50J3MgYWxwaGFLZXlzKSBgICtcbiAgICAgICAgICAgIGBoYXZlIG5vIHN1cHBvcnRlZCBwcm9wZXJ0eVR5cGUgeWV0IOKAlCBubyB2YWx1ZSB3YXMgd3JpdHRlbiAoaXNzdWUgIzY2KS5gXG4gICAgICAgICk7XG4gICAgfVxufVxuXG4vKipcbiAqIFJldHVybiBhIGNvbXBvbmVudCBkdW1wJ3MgcHJvcGVydHkgbWFwLlxuICpcbiAqIGBzY2VuZTpxdWVyeS1ub2RlYCBzaGFwZXMgZWFjaCBgX19jb21wc19fYCBlbnRyeSBhc1xuICogYHsgX190eXBlX18sIGNpZCwgdHlwZSwgZW5hYmxlZCwgdmFsdWU6IHsgPHByb3A+OiB7IG5hbWUsIHZhbHVlLCB0eXBlIH0gfSB9YCDigJQgdGhlIGxpdmVcbiAqIHByb3BlcnR5IHZhbHVlcyBsaXZlIHVuZGVyIGB2YWx1ZWAuIFRoZSBmYWxsYmFjayBjb3ZlcnMgZHVtcHMgdGhhdCBpbmxpbmUgdGhlaXJcbiAqIHByb3BlcnRpZXMgaW5zdGVhZCBvZiBuZXN0aW5nIHRoZW0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wKGNvbXBvbmVudDogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgaWYgKGNvbXBvbmVudD8udmFsdWUgJiYgdHlwZW9mIGNvbXBvbmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHJldHVybiBjb21wb25lbnQudmFsdWU7XG5cbiAgICBjb25zdCBwcm9wZXJ0aWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgaWYgKCFjb21wb25lbnQgfHwgdHlwZW9mIGNvbXBvbmVudCAhPT0gJ29iamVjdCcpIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgIGNvbnN0IGV4Y2x1ZGVLZXlzID0gWydfX3R5cGVfXycsICdlbmFibGVkJywgJ25vZGUnLCAnX2lkJywgJ19fc2NyaXB0QXNzZXQnLCAndXVpZCcsICduYW1lJywgJ19uYW1lJywgJ19vYmpGbGFncycsICdfZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnLCAnY2lkJywgJ2VkaXRvcicsICdleHRlbmRzJ107XG4gICAgZm9yIChjb25zdCBrZXkgaW4gY29tcG9uZW50KSB7XG4gICAgICAgIGlmICghZXhjbHVkZUtleXMuaW5jbHVkZXMoa2V5KSAmJiAha2V5LnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgICAgICAgcHJvcGVydGllc1trZXldID0gY29tcG9uZW50W2tleV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByb3BlcnRpZXM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvcGVydHlBbmFseXNpc1Jlc3VsdCB7XG4gICAgZXhpc3RzOiBib29sZWFuO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXTtcbiAgICBvcmlnaW5hbFZhbHVlOiBhbnk7XG4gICAgLyoqXG4gICAgICogU2V0IHdoZW4gdGhlIHJlcXVlc3RlZCBkb3R0ZWQgcGF0aCBpbmRleGVzIE9ORSBQQVNUIHRoZSBlbmQgb2YgYW4gZXhpc3RpbmcgYXJyYXlcbiAgICAgKiAoYHByaWNlTGFiZWxzLjBgIG9uIGFuIGVtcHR5IGFycmF5LCBgc2xvdHMuM2Agb24gYSAzLWVsZW1lbnQgb25lIOKAlCBpc3N1ZSAjNjgpLiBUaGVcbiAgICAgKiBlbGVtZW50IGRvZXMgbm90IGV4aXN0IHlldCwgc28gdGhlIGVkaXRvciBtdXN0IGdyb3cgdGhlIGFycmF5IGJlZm9yZSBpdCBjYW4gYmUgd3JpdHRlbi5cbiAgICAgKi9cbiAgICBhcHBlbmRUbz86IHsgYXJyYXlQcm9wZXJ0eTogc3RyaW5nOyBjdXJyZW50TGVuZ3RoOiBudW1iZXIgfTtcbiAgICAvKiogV2h5IGEgbm90LWZvdW5kIGxvb2t1cCBmYWlsZWQgd2hlbiB0aGUgY2F1c2UgaXMgbW9yZSBzcGVjaWZpYyB0aGFuIFwibm8gc3VjaCBuYW1lXCIuICovXG4gICAgbm90Rm91bmRIaW50Pzogc3RyaW5nO1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHByb3BEYXRhIGxvb2tzIGxpa2UgYSBDb2NvcyBDcmVhdG9yIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihwcm9wRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcgfHwgcHJvcERhdGEgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcERhdGEpO1xuICAgICAgICAvLyBTa2lwIHNpbXBsZSB2YWx1ZSBvYmplY3RzIGxpa2Uge3dpZHRoOiAyMDAsIGhlaWdodDogMTUwfVxuICAgICAgICBjb25zdCBpc1NpbXBsZVZhbHVlT2JqZWN0ID0ga2V5cy5ldmVyeShrZXkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdiA9IHByb3BEYXRhW2tleV07XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGlzU2ltcGxlVmFsdWVPYmplY3QpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgaGFzTmFtZSA9IGtleXMuaW5jbHVkZXMoJ25hbWUnKTtcbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSBrZXlzLmluY2x1ZGVzKCd2YWx1ZScpO1xuICAgICAgICBjb25zdCBoYXNUeXBlID0ga2V5cy5pbmNsdWRlcygndHlwZScpO1xuICAgICAgICBjb25zdCBoYXNEaXNwbGF5TmFtZSA9IGtleXMuaW5jbHVkZXMoJ2Rpc3BsYXlOYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1JlYWRvbmx5ID0ga2V5cy5pbmNsdWRlcygncmVhZG9ubHknKTtcbiAgICAgICAgY29uc3QgaGFzVmFsaWRTdHJ1Y3R1cmUgPSAoaGFzTmFtZSB8fCBoYXNWYWx1ZSkgJiYgKGhhc1R5cGUgfHwgaGFzRGlzcGxheU5hbWUgfHwgaGFzUmVhZG9ubHkpO1xuICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygnZGVmYXVsdCcpICYmIHByb3BEYXRhLmRlZmF1bHQgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhLmRlZmF1bHQpO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0LnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiBoYXNWYWxpZFN0cnVjdHVyZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qKiBBbmFseXplIGEgY29tcG9uZW50J3MgcHJvcGVydHkgdG8gZGV0ZXJtaW5lIGl0cyB0eXBlIGFuZCBjdXJyZW50IHZhbHVlLlxuICogIFN1cHBvcnRzIGRvdHRlZCBwcm9wZXJ0eU5hbWUgZm9yIG5lc3RlZCBDQ0NsYXNzIGdyb3VwcyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuICovXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVByb3BlcnR5KGNvbXBvbmVudDogYW55LCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGNvbnN0IGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcbiAgICBsZXQgcHJvcGVydHlFeGlzdHMgPSBmYWxzZTtcbiAgICBsZXQgbm90Rm91bmRIaW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgICAvLyBNZXRob2QgMTogZGlyZWN0IHByb3BlcnR5IGFjY2VzcyAoZmxhdCBwYXRoIG9ubHkpXG4gICAgaWYgKCFwcm9wZXJ0eU5hbWUuaW5jbHVkZXMoJy4nKSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29tcG9uZW50LCBwcm9wZXJ0eU5hbWUpKSB7XG4gICAgICAgIHByb3BlcnR5VmFsdWUgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIE1ldGhvZCAyOiBzZWFyY2ggbmVzdGVkIHByb3BlcnRpZXMgc3RydWN0dXJlIChDb2NvcyBDcmVhdG9yIGNvbXBvbmVudCBkdW1wIGZvcm1hdCkuXG4gICAgLy8gIEZvciBkb3R0ZWQgbmFtZXMgbGlrZSBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiLCB3YWxrIHNlZ21lbnRzIHRocm91Z2ggbmVzdGVkIGAudmFsdWVgIGR1bXBzLlxuICAgIGlmICghcHJvcGVydHlFeGlzdHMgJiYgY29tcG9uZW50LnByb3BlcnRpZXMgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCByb290VmFsdWVPYmogPSBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSAmJiB0eXBlb2YgY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWUgPT09ICdvYmplY3QnXG4gICAgICAgICAgICA/IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlXG4gICAgICAgICAgICA6IGNvbXBvbmVudC5wcm9wZXJ0aWVzO1xuXG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHlOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBjdXJzb3I6IGFueSA9IHJvb3RWYWx1ZU9iajtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50ID0gc2VnbWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAvLyBQb3B1bGF0ZSBhdmFpbGFibGVQcm9wZXJ0aWVzIGF0IHRoZSByZWxldmFudCBsZXZlbCAocm9vdCBvciBmaW5hbCBjb250YWluZXIpXG4gICAgICAgICAgICBpZiAoaSA9PT0gMCB8fCAoaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhjdXJzb3IgfHwge30pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2ICYmIHR5cGVvZiB2ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gaSA9PT0gMCA/ICcnIDogYCR7c2VnbWVudHMuc2xpY2UoMCwgaSkuam9pbignLicpfS5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGAke3ByZWZpeH0ke2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBjdXJzb3IgPyBjdXJzb3Jbc2VnbWVudF0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzY4OiBhbiBpbmRleCBwYXN0IHRoZSBlbmQgb2YgYW4gYXJyYXkuIGBsZW5ndGhgIGl0c2VsZiBpcyB0aGUgYXBwZW5kXG4gICAgICAgICAgICAgICAgLy8gc2xvdDsgYW55dGhpbmcgZnVydGhlciBvdXQgaXMgYSBnZW51aW5lIGdhcCB0aGUgY2FsbGVyIG11c3QgZmlsbCBpbiBvcmRlci5cbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjdXJzb3IpICYmIC9eXFxkKyQvLnRlc3Qoc2VnbWVudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXJyYXlQcm9wZXJ0eSA9IHNlZ21lbnRzLnNsaWNlKDAsIGkpLmpvaW4oJy4nKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzTGVhZiAmJiBOdW1iZXIoc2VnbWVudCkgPT09IGN1cnNvci5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZXhpc3RzOiB0cnVlLCB0eXBlOiAndW5rbm93bicsIGF2YWlsYWJsZVByb3BlcnRpZXMsIG9yaWdpbmFsVmFsdWU6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhcHBlbmRUbzogeyBhcnJheVByb3BlcnR5LCBjdXJyZW50TGVuZ3RoOiBjdXJzb3IubGVuZ3RoIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbm90Rm91bmRIaW50ID0gYCcke2FycmF5UHJvcGVydHl9JyBpcyBhbiBhcnJheSB3aXRoICR7Y3Vyc29yLmxlbmd0aH0gZWxlbWVudChzKTsgaW5kZXggJHtzZWdtZW50fSBpcyBvdXQgb2YgcmFuZ2UuIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYFdyaXRlIGluZGV4ICR7Y3Vyc29yLmxlbmd0aH0gZmlyc3QgKGl0IGFwcGVuZHMpLCBvciBzZXQgdGhlIHdob2xlIGFycmF5IHdpdGggYW4gYXJyYXkgcHJvcGVydHlUeXBlLmA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGN1cnNvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzTGVhZikge1xuICAgICAgICAgICAgICAgIGlmIChpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yKGRlc2NyaXB0b3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRLZXlzID0gT2JqZWN0LmtleXMoZGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBkS2V5cy5pbmNsdWRlcygndmFsdWUnKSA/IGRlc2NyaXB0b3IudmFsdWUgOiBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlc2NlbmQgaW50byB0aGUgbmVzdGVkIENDQ2xhc3MgZ3JvdXA6IGRlc2NyaXB0b3IudmFsdWUgaG9sZHMgdGhlIGlubmVyIGR1bXAuXG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3IudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWV0aG9kIDM6IGNvbGxlY3Qgc2ltcGxlIHByb3BlcnR5IG5hbWVzIGZyb20gZGlyZWN0IGtleXMgYXMgZmFsbGJhY2tcbiAgICBpZiAoYXZhaWxhYmxlUHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoY29tcG9uZW50KSkge1xuICAgICAgICAgICAgaWYgKCFrZXkuc3RhcnRzV2l0aCgnXycpICYmICFbJ19fdHlwZV9fJywgJ2NpZCcsICdub2RlJywgJ3V1aWQnLCAnbmFtZScsICdlbmFibGVkJywgJ3R5cGUnLCAncmVhZG9ubHknLCAndmlzaWJsZSddLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVQcm9wZXJ0aWVzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcHJvcGVydHlFeGlzdHMpIHtcbiAgICAgICAgcmV0dXJuIHsgZXhpc3RzOiBmYWxzZSwgdHlwZTogJ3Vua25vd24nLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiB1bmRlZmluZWQsIG5vdEZvdW5kSGludCB9O1xuICAgIH1cblxuICAgIC8vIEluZmVyIHR5cGUgZnJvbSB2YWx1ZSBzdHJ1Y3R1cmVcbiAgICBsZXQgdHlwZSA9ICd1bmtub3duJztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eVZhbHVlKSkge1xuICAgICAgICBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSkgdHlwZSA9ICdub2RlQXJyYXknO1xuICAgICAgICBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29sb3InKSkgdHlwZSA9ICdjb2xvckFycmF5JztcbiAgICAgICAgZWxzZSB0eXBlID0gJ2FycmF5JztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICB0eXBlID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkgPyAnYXNzZXQnIDogJ3N0cmluZyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdHlwZSA9ICdudW1iZXInO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICB0eXBlID0gJ2Jvb2xlYW4nO1xuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSAmJiB0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wZXJ0eVZhbHVlKTtcbiAgICAgICAgICAgIGlmIChrZXlzLmluY2x1ZGVzKCdyJykgJiYga2V5cy5pbmNsdWRlcygnZycpICYmIGtleXMuaW5jbHVkZXMoJ2InKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnY29sb3InO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd4JykgJiYga2V5cy5pbmNsdWRlcygneScpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IHByb3BlcnR5VmFsdWUueiAhPT0gdW5kZWZpbmVkID8gJ3ZlYzMnIDogJ3ZlYzInO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd3aWR0aCcpICYmIGtleXMuaW5jbHVkZXMoJ2hlaWdodCcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdzaXplJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygndXVpZCcpIHx8IGtleXMuaW5jbHVkZXMoJ19fdXVpZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpIHx8IGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSA/ICdub2RlJyA6ICdhc3NldCc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSA9PT0gbnVsbCB8fCBwcm9wZXJ0eVZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2Fzc2V0JztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29tcG9uZW50JykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29tcG9uZW50JztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGV4aXN0czogdHJ1ZSwgdHlwZSwgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogcHJvcGVydHlWYWx1ZSB9O1xufVxuXG4vKiogUGFyc2UgYSBoZXggY29sb3Igc3RyaW5nICgjUkdCIG9yICNSR0JBKSB0byBhbiBSR0JBIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29sb3JTdHJpbmcoY29sb3JTdHI6IHN0cmluZyk6IHsgcjogbnVtYmVyOyBnOiBudW1iZXI7IGI6IG51bWJlcjsgYTogbnVtYmVyIH0ge1xuICAgIGNvbnN0IHN0ciA9IGNvbG9yU3RyLnRyaW0oKTtcbiAgICBpZiAoc3RyLnN0YXJ0c1dpdGgoJyMnKSkge1xuICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gNykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiAyNTVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAoc3RyLmxlbmd0aCA9PT0gOSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDcsIDkpLCAxNilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNvbG9yIGZvcm1hdDogXCIke2NvbG9yU3RyfVwiLiBPbmx5IGhleGFkZWNpbWFsIGZvcm1hdCBpcyBzdXBwb3J0ZWQgKGUuZy4sIFwiI0ZGMDAwMFwiIG9yIFwiI0ZGMDAwMEZGXCIpYCk7XG59XG5cbi8qKlxuICogQ29jb3MgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5IHR5cGVzLiBFdmVyeSBvbmUgb2YgdGhlc2Ugc2VyaWFsaXplcyBpZGVudGljYWxseSBhc1xuICogYHsgdXVpZCB9YCAoaXNzdWUgIzI2IOKAlCBwcm9wZXJ0eVR5cGU9XCJtYXRlcmlhbFwiIGFuZCBmcmllbmRzIHByZXZpb3VzbHkgZmVsbCB0aHJvdWdoIHRvXG4gKiBgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZWAsIGV2ZW4gdGhvdWdoIHRoZSBleGlzdGluZyBzcHJpdGVGcmFtZS9wcmVmYWIvYXNzZXQgY29lcmNpb25cbiAqIGFscmVhZHkgcHJvZHVjZXMgdGhlIGNvcnJlY3Qgc2hhcGUgZm9yIHRoZW0pLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICdtYXRlcmlhbCcsICd0ZXh0dXJlJywgJ3Nwcml0ZUF0bGFzJywgJ2F1ZGlvQ2xpcCcsICdmb250JywgJ2FuaW1hdGlvbkNsaXAnLFxuICAgICdtZXNoJywgJ3NrZWxldG9uJywgJ3BoeXNpY3NNYXRlcmlhbCcsICdyZW5kZXJUZXh0dXJlJywgJ3RleHRBc3NldCcsICdqc29uQXNzZXQnLFxuICAgICdwYXJ0aWNsZUFzc2V0JywgJ3NjZW5lQXNzZXQnXG5dIGFzIGNvbnN0O1xuXG4vKipcbiAqIEV4cGxpY2l0IHByb3BlcnR5VHlwZSAtPiBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBSZXNvbHZlZCBmcm9tIHRoZSBwcm9wZXJ0eVR5cGUgaXRzZWxmLCBOT1QgZnJvbSB0aGUgcHJvcGVydHkgbmFtZS4gVGhlIGxlZ2FjeSBuYW1lLWJhc2VkXG4gKiBoZXVyaXN0aWMgaW4gYGFwcGx5UHJvcGVydHlUb0VkaXRvcmAgbWlzLXJlc29sdmVzIGFueSBhc3NldCBwcm9wZXJ0eSB3aG9zZSBuYW1lIGxhY2tzIHRoZVxuICogbWF0Y2hpbmcga2V5d29yZCDigJQgYSBgY2MuTWF0ZXJpYWxgIHByb3BlcnR5IGNhbGxlZCBgc2tpbmAgcmVzb2x2ZWQgdG8gYGNjLlNwcml0ZUZyYW1lYC5cbiAqXG4gKiBUaGUgZ2VuZXJpYyBgYXNzZXRgIGFuZCBgc3RyaW5nYCBzcGVsbGluZ3MgY2Fycnkgbm8gdHlwZSBpbmZvcm1hdGlvbiwgc28gdGhleSBkZWxpYmVyYXRlbHlcbiAqIGhhdmUgTk8gZW50cnkgaGVyZSBhbmQga2VlcCB1c2luZyB0aGUgbmFtZSBoZXVyaXN0aWMgKHVuY2hhbmdlZCBiZWhhdmlvdXIgZm9yIGV4aXN0aW5nIGNhbGxlcnMpLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFOiBSZWFkb25seTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHtcbiAgICBtYXRlcmlhbDogJ2NjLk1hdGVyaWFsJyxcbiAgICB0ZXh0dXJlOiAnY2MuVGV4dHVyZTJEJyxcbiAgICBzcHJpdGVGcmFtZTogJ2NjLlNwcml0ZUZyYW1lJyxcbiAgICBzcHJpdGVBdGxhczogJ2NjLlNwcml0ZUF0bGFzJyxcbiAgICBwcmVmYWI6ICdjYy5QcmVmYWInLFxuICAgIGF1ZGlvQ2xpcDogJ2NjLkF1ZGlvQ2xpcCcsXG4gICAgZm9udDogJ2NjLkZvbnQnLFxuICAgIGFuaW1hdGlvbkNsaXA6ICdjYy5BbmltYXRpb25DbGlwJyxcbiAgICBtZXNoOiAnY2MuTWVzaCcsXG4gICAgc2tlbGV0b246ICdjYy5Ta2VsZXRvbicsXG4gICAgcGh5c2ljc01hdGVyaWFsOiAnY2MuUGh5c2ljc01hdGVyaWFsJyxcbiAgICByZW5kZXJUZXh0dXJlOiAnY2MuUmVuZGVyVGV4dHVyZScsXG4gICAgdGV4dEFzc2V0OiAnY2MuVGV4dEFzc2V0JyxcbiAgICBqc29uQXNzZXQ6ICdjYy5Kc29uQXNzZXQnLFxuICAgIHBhcnRpY2xlQXNzZXQ6ICdjYy5QYXJ0aWNsZUFzc2V0JyxcbiAgICBzY2VuZUFzc2V0OiAnY2MuU2NlbmVBc3NldCdcbn07XG5cbi8qKiBFdmVyeSBwcm9wZXJ0eVR5cGUgY29udmVydFByb3BlcnR5VmFsdWUgYWNjZXB0cyDigJQgdXNlZCB0byBidWlsZCBhbiBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2UuICovXG5leHBvcnQgY29uc3QgU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2ludGVnZXInLCAnZmxvYXQnLCAnYm9vbGVhbicsXG4gICAgJ2NvbG9yJywgJ3ZlYzInLCAndmVjMycsICdzaXplJyxcbiAgICAnbm9kZScsICdjb21wb25lbnQnLFxuICAgIC4uLkFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyxcbiAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknLCAnY29tcG9uZW50QXJyYXknLCAnYXNzZXRBcnJheSdcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogQ29udmVydCBhIHJhdyBMTE0tc3VwcGxpZWQgdmFsdWUgdG8gdGhlIGNvcnJlY3QgZm9ybWF0IGZvciBhIGdpdmVuIHByb3BlcnR5VHlwZS5cbiAqIFRocm93cyBpZiB0aGUgdmFsdWUgZm9ybWF0IGlzIGludmFsaWQgZm9yIHRoZSBnaXZlbiB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIC8vIElzc3VlICM3NTogbmVpdGhlciBgbnVsbGAgbm9yIGBcIlwiYCBjb3VsZCBjbGVhciBhIG5vZGUvY29tcG9uZW50L2Fzc2V0IHJlZmVyZW5jZS5cbiAgICAvLyBgbm9kZWAgYW5kIGV2ZXJ5IGFzc2V0LXJlZmVyZW5jZSB0eXBlIGFscmVhZHkgZm9yd2FyZGVkIGBcIlwiYCB1bnJlamVjdGVkIChpdCBoYXBwZW5zXG4gICAgLy8gdG8gc2F0aXNmeSB0aGUgYHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZydgIGNoZWNrIGJlbG93IGFuZCBiZWNvbWUgYHsgdXVpZDogJycgfWApLFxuICAgIC8vIGJ1dCByZWplY3RlZCBgbnVsbGAgb3V0cmlnaHQuIGBjb21wb25lbnRgL2Bjb21wb25lbnRBcnJheWAgYWRkaXRpb25hbGx5IGZvcndhcmRlZCBhXG4gICAgLy8gYFwiXCJgIHZhbHVlIFVOUkVTT0xWRUQgaW5zdGVhZCBvZiB0cmVhdGluZyBpdCBhcyBcImNsZWFyIHRoaXMgcmVmZXJlbmNlXCIsIHdoaWNoIHRoZW5cbiAgICAvLyBmYWlsZWQgZG93bnN0cmVhbSB3aXRoIGEgY29uZnVzaW5nIFwibmVpdGhlciBhIG5vZGUgdXVpZCBub3IgYSBjb21wb25lbnQgdXVpZFwiIGVycm9yLlxuICAgIC8vIEEgY2xlYXJlZCBzaW5nbGUgcmVmZXJlbmNlIGFsd2F5cyBzZXJpYWxpemVzIGFzIGB7IHV1aWQ6ICcnIH1gIOKAlCB0aGUgc2FtZSBzaGFwZSBhXG4gICAgLy8gc2V0IHJlZmVyZW5jZSB1c2VzIOKAlCBzbyBpdCBuZWVkcyBubyBzcGVjaWFsIGhhbmRsaW5nIGFueXdoZXJlIHNldC1wcm9wZXJ0eSBhbHJlYWR5XG4gICAgLy8gaGFuZGxlcyBhIHJlZmVyZW5jZSBkdW1wLlxuICAgIGNvbnN0IGlzQ2xlYXJSZXF1ZXN0ID0gdmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09ICcnO1xuICAgIGlmIChpc0NsZWFyUmVxdWVzdCAmJiAocHJvcGVydHlUeXBlID09PSAnbm9kZScgfHwgcHJvcGVydHlUeXBlID09PSAnY29tcG9uZW50JyB8fFxuICAgICAgICAoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSkge1xuICAgICAgICByZXR1cm4geyB1dWlkOiAnJyB9O1xuICAgIH1cbiAgICBpZiAoaXNDbGVhclJlcXVlc3QgJiYgKHByb3BlcnR5VHlwZSA9PT0gJ2NvbXBvbmVudEFycmF5JyB8fCBwcm9wZXJ0eVR5cGUgPT09ICdhc3NldEFycmF5JykpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICAvLyBJc3N1ZSAjNzI6IGEgd2hvbGUtYXJyYXkgd3JpdGUgKGBzaGFyZWRNYXRlcmlhbHM6IFt1dWlkLCAuLi5dYCkgaXMgdGhlIGZvcm0gY2FsbGVyc1xuICAgICAgICAvLyByZWFjaCBmb3IgZmlyc3Q7IG5hbWUgdGhlIHByb3BlcnR5VHlwZSB0aGF0IGNhcnJpZXMgaXQgaW5zdGVhZCBvZiBhIGJhcmUgdHlwZSBlcnJvci5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc2luZ2xlIHN0cmluZyBVVUlELCBidXQgYW4gYXJyYXkgd2FzIHJlY2VpdmVkLiBgICtcbiAgICAgICAgICAgICAgICBgVG8gd3JpdGUgYW4gYXJyYXkgb2YgYXNzZXRzIChlLmcuIGNjLk1lc2hSZW5kZXJlci5zaGFyZWRNYXRlcmlhbHMpIHVzZSBwcm9wZXJ0eVR5cGUgJ2Fzc2V0QXJyYXknLCBgICtcbiAgICAgICAgICAgICAgICBgb3Igd3JpdGUgb25lIGVsZW1lbnQgYXQgYSB0aW1lIHdpdGggYSBkb3R0ZWQgaW5kZXggKCdzaGFyZWRNYXRlcmlhbHMuMCcsIHdoaWNoIGFwcGVuZHMgYXQgdGhlIGVuZCBvZiB0aGUgYXJyYXkpLmBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BlcnR5VHlwZX0gdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgIH1cbiAgICBzd2l0Y2ggKHByb3BlcnR5VHlwZSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgLy8gSXNzdWUgIzExNjogYFN0cmluZyh2YWx1ZSlgIHR1cm5zIGFueSBvYmplY3QgaW50byB0aGUgbGl0ZXJhbCB0ZXh0XG4gICAgICAgICAgICAvLyBcIltvYmplY3QgT2JqZWN0XVwiIChhbmQgYW55IGFycmF5IGludG8gYSBjb21tYS1qb2luZWQgbGlzdCksIHdoaWNoIHdhcyB0aGVuXG4gICAgICAgICAgICAvLyB3cml0dGVuIHRvIHRoZSBzY2VuZSB3aXRoIHN1Y2Nlc3M6dHJ1ZSDigJQgc2lsZW50IGRhdGEgbG9zcyBvbiBhIHBsYWluIHN0cmluZ1xuICAgICAgICAgICAgLy8gZmllbGQuIFJlamVjdCBhbnl0aGluZyBub24tcHJpbWl0aXZlLCBuYW1pbmcgdGhlIHJlY2VpdmVkIHR5cGUsIGluc3RlYWQgb2ZcbiAgICAgICAgICAgIC8vIHdyaXRpbmcgYSBsb3NzeSBwbGFjZWhvbGRlci4gTWlycm9ycyB0aGUgYXNzZXQtcmVmZXJlbmNlIGJyYW5jaCBhYm92ZS5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICBgc3RyaW5nIHZhbHVlIG11c3QgYmUgYSBwcmltaXRpdmUgKHJlY2VpdmVkICR7QXJyYXkuaXNBcnJheSh2YWx1ZSkgPyAnYXJyYXknIDogJ29iamVjdCd9KTsgYCArXG4gICAgICAgICAgICAgICAgICAgICdwYXNzIEpTT04tZW5jb2RlZCB0ZXh0IGlmIGEgc3RydWN0dXJlZCBwYXlsb2FkIHdhcyBpbnRlbmRlZCdcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgdmFsdWUgPT09ICdzeW1ib2wnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBzdHJpbmcgdmFsdWUgbXVzdCBiZSBhIHByaW1pdGl2ZSAocmVjZWl2ZWQgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gICAgICAgIGNhc2UgJ251bWJlcic6IGNhc2UgJ2ludGVnZXInOiBjYXNlICdmbG9hdCc6XG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzc2OiBgQm9vbGVhbihcImZhbHNlXCIpYCBpcyBgdHJ1ZWAuIEEgdHJhbnNwb3J0IHRoYXQgc3RyaW5naWZpZXNcbiAgICAgICAgICAgICAgICAvLyBhcmd1bWVudHMgZGVsaXZlcnMgdGhlIHRleHQgXCJmYWxzZVwiLCB3aGljaCBiZWNhbWUgYSB3cml0ZSBvZiBgdHJ1ZWA7IGFnYWluc3RcbiAgICAgICAgICAgICAgICAvLyBhIHByb3BlcnR5IGFscmVhZHkgaG9sZGluZyBgdHJ1ZWAgdGhlIHJlYWQtYmFjayBtYXRjaGVkIGFuZCB0aGUgdG9vbCByZXBvcnRlZFxuICAgICAgICAgICAgICAgIC8vIGBjaGFuZ2VWZXJpZmllZDogdHJ1ZWAgZm9yIGEgdmFsdWUgdGhlIGNhbGxlciBuZXZlciBhc2tlZCBmb3IuIFBhcnNlIHRoZVxuICAgICAgICAgICAgICAgIC8vIHNwZWxsZWQtb3V0IGZvcm1zIGFuZCByZWZ1c2UgYW55dGhpbmcgdGhhdCBpcyBub3Qgb25lLCByYXRoZXIgdGhhbiBjb2VyY2luZ1xuICAgICAgICAgICAgICAgIC8vIGJ5IHRydXRoaW5lc3MuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IGNvZXJjZUJvb2wodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChjb2VyY2VkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgICAgICAgICAgYGJvb2xlYW4gdmFsdWUgbXVzdCBiZSB0cnVlL2ZhbHNlIChyZWNlaXZlZCAke3R5cGVvZiB2YWx1ZX0ke3R5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyBgIFwiJHt2YWx1ZX1cImAgOiAnJ30pYFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gY29lcmNlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM1MjogYSBKU09OLXN0cmluZyB2YWx1ZSAoZS5nLiAne1wiclwiOjI1NSxcImdcIjowLFwiYlwiOjB9JykgcmVhY2hlc1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgcG9pbnQgYXMgYSBzdHJpbmcuIEEgaGV4IGNvbG9yIHN0cmluZyAoZS5nLiBcIiNGRjAwMDBcIikgaXMgTk9UXG4gICAgICAgICAgICAgICAgLy8gdmFsaWQgSlNPTiwgc28gcGFyc2VKc29uUGF5bG9hZCByZXR1cm5zIGl0IHVuY2hhbmdlZDsgb25seSBhIEpTT04gb2JqZWN0XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGNvZXJjZXMgdG8gYW4gb2JqZWN0LiBUcnkgdGhlIEpTT04gcGF0aCBmaXJzdCBzbyBib3RoIGEgaGV4XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGFuZCBhIEpTT04tc3RyaW5nIG9iamVjdCBsYW5kIGluIHRoZSByaWdodCBicmFuY2guXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ3N0cmluZycpIHJldHVybiBwYXJzZUNvbG9yU3RyaW5nKGNvZXJjZWQpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQuYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYTogY29lcmNlZC5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmEpKSkgOiAyNTVcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbG9yIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggciwgZywgYiBwcm9wZXJ0aWVzIG9yIGEgaGV4YWRlY2ltYWwgc3RyaW5nIChlLmcuLCBcIiNGRjAwMDBcIikgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3ZlYzInOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcihjb2VyY2VkLngpIHx8IDAsIHk6IE51bWJlcihjb2VyY2VkLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVjMiB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHkgcHJvcGVydGllcyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAndmVjMyc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKGNvZXJjZWQueCkgfHwgMCwgeTogTnVtYmVyKGNvZXJjZWQueSkgfHwgMCwgejogTnVtYmVyKGNvZXJjZWQueikgfHwgMCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWZWMzIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSwgeiBwcm9wZXJ0aWVzIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdzaXplJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSByZXR1cm4geyB3aWR0aDogTnVtYmVyKGNvZXJjZWQud2lkdGgpIHx8IDAsIGhlaWdodDogTnVtYmVyKGNvZXJjZWQuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNpemUgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB3aWR0aCwgaGVpZ2h0IHByb3BlcnRpZXMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGUnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IHZhbHVlIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRCAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50JzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4gdmFsdWU7IC8vIHJlc29sdmVkIHRvIF9faWRfXyBsYXRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgKG5vZGUgVVVJRCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIGl0ZW07IC8vIGVhY2ggcmVzb2x2ZWQgdG8gYSBjb21wb25lbnQgX19pZF9fIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50QXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgbm9kZSBVVUlEcyAoZWFjaCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudEFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ2Fzc2V0QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIEFuIGFycmF5IG9mIGFzc2V0IHJlZmVyZW5jZXMgKGUuZy4gYEBwcm9wZXJ0eSh7IHR5cGU6IFtBdWRpb0NsaXBdIH0pYCkuXG4gICAgICAgICAgICAgICAgLy8gRXZlcnkgc2luZ2xlLWFzc2V0IHByb3BlcnR5VHlwZSByZWplY3RzIGFuIGFycmF5LCBzbyB3aXRob3V0IHRoaXMgY2FzZSBzdWNoIGFcbiAgICAgICAgICAgICAgICAvLyBmaWVsZCB3YXMgdW53cml0YWJsZS4gRWxlbWVudHMgc2VyaWFsaXplIGFzIGB7IHV1aWQgfWAsIGxpa2UgYSBzaW5nbGUgYXNzZXQuXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgYXNzZXRBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBhc3NldCBVVUlEcyAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGFzc2V0QXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSBvZiBhc3NldCBVVUlEIHN0cmluZ3MgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGVBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4geyBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07IHRocm93IG5ldyBFcnJvcihgTm9kZUFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIFVVSURzIChyZWNlaXZlZCBpdGVtIHR5cGVvZiAke3R5cGVvZiBpdGVtfSlgKTsgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGVBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdjb2xvckFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5yKSB8fCAwKSksIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uZykgfHwgMCkpLCBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmIpIHx8IDApKSwgYTogaXRlbS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmEpKSkgOiAyNTUgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29sb3JBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdudW1iZXJBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNjY6IGBOdW1iZXIoaXRlbSlgIG9uIGFuIG9iamVjdCB5aWVsZHMgTmFOLCB3aGljaCB0aGUgZWRpdG9yXG4gICAgICAgICAgICAgICAgICAgIC8vIGFjY2VwdHMgYXMgYSB3cml0dGVuIHZhbHVlIOKAlCBhIGNhbGxlciBwYXNzaW5nIGtleWZyYW1lL2FscGhhLWtleSBPQkpFQ1RTXG4gICAgICAgICAgICAgICAgICAgIC8vIGhlcmUgKHRoZSBzaGFwZSB0aGUgYXJyYXktb2Ytb2JqZWN0IGZpZWxkcyBhY3R1YWxseSBob2xkKSBnb3QgYSBzdWNjZXNzXG4gICAgICAgICAgICAgICAgICAgIC8vIHJlc3BvbnNlIG92ZXIgYSBOYU4tZmlsbGVkIGZpZWxkLiBOYW1lIHRoZSByZWNlaXZlZCBpdGVtIGluc3RlYWQuXG4gICAgICAgICAgICAgICAgICAgIGFzc2VydEFycmF5SXRlbUlzUHJpbWl0aXZlKCdudW1iZXJBcnJheScsIGl0ZW0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyKGl0ZW0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOdW1iZXJBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdzdHJpbmdBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAvLyBTYW1lIGFzIG51bWJlckFycmF5IGFib3ZlOiBgU3RyaW5nKGl0ZW0pYCByZW5kZXJzIGFueSBvYmplY3QgYXMgdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIGxpdGVyYWwgdGV4dCBcIltvYmplY3QgT2JqZWN0XVwiIChpc3N1ZSAjMTE2J3MgZmFpbHVyZSBzaGFwZSwgcGVyIGVsZW1lbnQpLlxuICAgICAgICAgICAgICAgICAgICBhc3NlcnRBcnJheUl0ZW1Jc1ByaW1pdGl2ZSgnc3RyaW5nQXJyYXknLCBpdGVtKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZyhpdGVtKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3RyaW5nQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZTogJHtwcm9wZXJ0eVR5cGV9LiBTdXBwb3J0ZWQgdHlwZXM6ICR7U1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTLmpvaW4oJywgJyl9YCk7XG4gICAgfVxufVxuXG4vKiogR2VuZXJhdGUgYW4gTExNLWZyaWVuZGx5IHN1Z2dlc3Rpb24gd2hlbiByZXF1ZXN0ZWQgY29tcG9uZW50IHR5cGUgaXMgbm90IGZvdW5kICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uKHJlcXVlc3RlZFR5cGU6IHN0cmluZywgYXZhaWxhYmxlVHlwZXM6IHN0cmluZ1tdLCBwcm9wZXJ0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBzaW1pbGFyVHlwZXMgPSBhdmFpbGFibGVUeXBlcy5maWx0ZXIodHlwZSA9PlxuICAgICAgICB0eXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpKSB8fFxuICAgICAgICByZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModHlwZS50b0xvd2VyQ2FzZSgpKVxuICAgICk7XG5cbiAgICBsZXQgaW5zdHJ1Y3Rpb24gPSAnJztcbiAgICBpZiAoc2ltaWxhclR5cGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkZvdW5kIHNpbWlsYXIgY29tcG9uZW50czogJHtzaW1pbGFyVHlwZXMuam9pbignLCAnKX1gO1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuU3VnZ2VzdGlvbjogUGVyaGFwcyB5b3UgbWVhbnQgJyR7c2ltaWxhclR5cGVzWzBdfSc/YDtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgICdzdHJpbmcnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLkVkaXRCb3gnXSxcbiAgICAgICAgJ3RleHQnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXG4gICAgICAgICdmb250U2l6ZSc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcbiAgICAgICAgJ3Nwcml0ZUZyYW1lJzogWydjYy5TcHJpdGUnXSxcbiAgICAgICAgJ2NvbG9yJzogWydjYy5MYWJlbCcsICdjYy5TcHJpdGUnLCAnY2MuR3JhcGhpY3MnXSxcbiAgICAgICAgJ25vcm1hbENvbG9yJzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ3ByZXNzZWRDb2xvcic6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICd0YXJnZXQnOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAnY29udGVudFNpemUnOiBbJ2NjLlVJVHJhbnNmb3JtJ10sXG4gICAgICAgICdhbmNob3JQb2ludCc6IFsnY2MuVUlUcmFuc2Zvcm0nXVxuICAgIH07XG5cbiAgICBjb25zdCByZWNvbW1lbmRlZENvbXBvbmVudHMgPSBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwW3Byb3BlcnR5XSB8fCBbXTtcbiAgICBjb25zdCBhdmFpbGFibGVSZWNvbW1lbmRlZCA9IHJlY29tbWVuZGVkQ29tcG9uZW50cy5maWx0ZXIoY29tcCA9PiBhdmFpbGFibGVUeXBlcy5pbmNsdWRlcyhjb21wKSk7XG4gICAgaWYgKGF2YWlsYWJsZVJlY29tbWVuZGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkJhc2VkIG9uIHByb3BlcnR5ICcke3Byb3BlcnR5fScsIHJlY29tbWVuZGVkIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlUmVjb21tZW5kZWQuam9pbignLCAnKX1gO1xuICAgIH1cblxuICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0ZWQgQWN0aW9uczpgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4xLiBVc2UgbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249Z2V0X2FsbCBub2RlVXVpZD1cIi4uLlwiIHRvIHZpZXcgYWxsIGNvbXBvbmVudHMgb24gdGhlIG5vZGVgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4yLiBJZiB5b3UgbmVlZCB0byBhZGQgYSBjb21wb25lbnQsIHVzZSBhY3Rpb249YWRkIHdpdGggY29tcG9uZW50VHlwZT1cIiR7cmVxdWVzdGVkVHlwZX1cImA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjMuIFZlcmlmeSB0aGF0IHRoZSBjb21wb25lbnQgdHlwZSBuYW1lIGlzIGNvcnJlY3QgKGNhc2Utc2Vuc2l0aXZlKWA7XG5cbiAgICByZXR1cm4gaW5zdHJ1Y3Rpb247XG59XG5cbi8qKiBSZXR1cm4gYXZhaWxhYmxlIENvY29zIENyZWF0b3IgYnVpbHQtaW4gY29tcG9uZW50IHR5cGVzIGJ5IGNhdGVnb3J5ICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QoY2F0ZWdvcnk6IHN0cmluZyA9ICdhbGwnKTogQWN0aW9uVG9vbFJlc3VsdCB7XG4gICAgY29uc3QgY29tcG9uZW50Q2F0ZWdvcmllczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICByZW5kZXJlcjogWydjYy5TcHJpdGUnLCAnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnLCAnY2MuTWFzaycsICdjYy5HcmFwaGljcyddLFxuICAgICAgICB1aTogWydjYy5CdXR0b24nLCAnY2MuVG9nZ2xlJywgJ2NjLlNsaWRlcicsICdjYy5TY3JvbGxWaWV3JywgJ2NjLkVkaXRCb3gnLCAnY2MuUHJvZ3Jlc3NCYXInXSxcbiAgICAgICAgcGh5c2ljczogWydjYy5SaWdpZEJvZHkyRCcsICdjYy5Cb3hDb2xsaWRlcjJEJywgJ2NjLkNpcmNsZUNvbGxpZGVyMkQnLCAnY2MuUG9seWdvbkNvbGxpZGVyMkQnXSxcbiAgICAgICAgYW5pbWF0aW9uOiBbJ2NjLkFuaW1hdGlvbicsICdjYy5BbmltYXRpb25DbGlwJywgJ2NjLlNrZWxldGFsQW5pbWF0aW9uJ10sXG4gICAgICAgIGF1ZGlvOiBbJ2NjLkF1ZGlvU291cmNlJ10sXG4gICAgICAgIGxheW91dDogWydjYy5MYXlvdXQnLCAnY2MuV2lkZ2V0JywgJ2NjLlBhZ2VWaWV3JywgJ2NjLlBhZ2VWaWV3SW5kaWNhdG9yJ10sXG4gICAgICAgIGVmZmVjdHM6IFsnY2MuTW90aW9uU3RyZWFrJywgJ2NjLlBhcnRpY2xlU3lzdGVtMkQnXSxcbiAgICAgICAgY2FtZXJhOiBbJ2NjLkNhbWVyYSddLFxuICAgICAgICBsaWdodDogWydjYy5MaWdodCcsICdjYy5EaXJlY3Rpb25hbExpZ2h0JywgJ2NjLlBvaW50TGlnaHQnLCAnY2MuU3BvdExpZ2h0J11cbiAgICB9O1xuXG4gICAgbGV0IGNvbXBvbmVudHM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGNhdGVnb3J5ID09PSAnYWxsJykge1xuICAgICAgICBmb3IgKGNvbnN0IGNhdCBpbiBjb21wb25lbnRDYXRlZ29yaWVzKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50cy5jb25jYXQoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRdKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV0pIHtcbiAgICAgICAgY29tcG9uZW50cyA9IGNvbXBvbmVudENhdGVnb3JpZXNbY2F0ZWdvcnldO1xuICAgIH1cblxuICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY2F0ZWdvcnksIGNvbXBvbmVudHMgfSk7XG59XG5cbi8qKiBSZWRpcmVjdCBzZXRfcHJvcGVydHkgY2FsbHMgdGhhdCB0YXJnZXQgbm9kZS1sZXZlbCBwcm9wZXJ0aWVzIHRvIHRoZSBjb3JyZWN0IG1hbmFnZV9ub2RlIGFjdGlvbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzKGFyZ3M6IHtcbiAgICBub2RlVXVpZDogc3RyaW5nOyBjb21wb25lbnRUeXBlOiBzdHJpbmc7IHByb3BlcnR5OiBzdHJpbmc7IHZhbHVlOiBhbnk7XG59KTogQWN0aW9uVG9vbFJlc3VsdCB8IG51bGwge1xuICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB2YWx1ZSB9ID0gYXJncztcbiAgICBjb25zdCBub2RlQmFzaWNQcm9wZXJ0aWVzID0gWyduYW1lJywgJ2FjdGl2ZScsICdsYXllcicsICdtb2JpbGl0eScsICdwYXJlbnQnLCAnY2hpbGRyZW4nLCAnaGlkZUZsYWdzJ107XG4gICAgY29uc3Qgbm9kZVRyYW5zZm9ybVByb3BlcnRpZXMgPSBbJ3Bvc2l0aW9uJywgJ3JvdGF0aW9uJywgJ3NjYWxlJywgJ2V1bGVyQW5nbGVzJywgJ2FuZ2xlJ107XG5cbiAgICBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLk5vZGUnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBpZiAobm9kZUJhc2ljUHJvcGVydGllcy5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGEgbm9kZSBiYXNpYyBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogYFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3Byb3BlcnR5IHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsIHByb3BlcnR5PVwiJHtwcm9wZXJ0eX1cIiwgdmFsdWU9JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlVHJhbnNmb3JtUHJvcGVydGllcy5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGEgbm9kZSB0cmFuc2Zvcm0gcHJvcGVydHksIG5vdCBhIGNvbXBvbmVudCBwcm9wZXJ0eWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF90cmFuc2Zvcm0gd2l0aCB1dWlkPVwiJHtub2RlVXVpZH1cIiwgJHtwcm9wZXJ0eX09JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIFJlZnVzZSBhIHNjYWxhciBwcm9wZXJ0eVR5cGUgYWltZWQgYXQgYSBwcm9wZXJ0eSB0aGF0IGN1cnJlbnRseSBob2xkcyBhbiBBUlJBWSAoaXNzdWUgIzExNSkuXG4gKlxuICogQSBzaW5nbGUtdmFsdWUgd3JpdGUgKGBhc3NldGAsIGBub2RlYCwgYHN0cmluZ2AsIC4uLikgYWdhaW5zdCBhbiBhcnJheS10eXBlZCBgQHByb3BlcnR5YFxuICogZG9lcyBub3QgZmFpbCBjbGVhbmx5OiB0aGUgZWRpdG9yIGFjY2VwdHMgdGhlIGR1bXAsIHRoZSBmaWVsZCBzdG9wcyBkZWNvZGluZywgYW5kIGl0IHZhbmlzaGVzXG4gKiBmcm9tIHRoZSBjb21wb25lbnQncyBvd24gYGdldF9pbmZvYCB1bnRpbCB0aGUgY29tcG9uZW50IGlzIHJlbW92ZWQgYW5kIHJlLWFkZGVkLiBUaGUgY2FsbGVyXG4gKiBoYXMgbm8gd2F5IHRvIHJlY292ZXIsIHNvIHRoZSB3cml0ZSBpcyByZWZ1c2VkIGJlZm9yZSBpdCBpcyBzZW50LCBuYW1pbmcgdGhlIHN1cHBvcnRlZFxuICogd2hvbGUtYXJyYXkgcHJvcGVydHlUeXBlcyBhbmQgdGhlIGVsZW1lbnQtd2lzZSBkb3R0ZWQgZm9ybS5cbiAqXG4gKiBSZXR1cm5zIHRoZSByZWZ1c2FsIG1lc3NhZ2UsIG9yIGBudWxsYCB3aGVuIHRoZSB3cml0ZSBpcyBub3QgYSBzY2FsYXItb3Zlci1hcnJheS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlc2NyaWJlU2NhbGFyV3JpdGVUb0FycmF5UHJvcGVydHkocHJvcGVydHlUeXBlOiBzdHJpbmcsIG9yaWdpbmFsVmFsdWU6IGFueSwgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShvcmlnaW5hbFZhbHVlKSB8fCBwcm9wZXJ0eVR5cGUuZW5kc1dpdGgoJ0FycmF5JykpIHJldHVybiBudWxsO1xuICAgIHJldHVybiAoXG4gICAgICAgIGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGFuIEFSUkFZLCBidXQgcHJvcGVydHlUeXBlICcke3Byb3BlcnR5VHlwZX0nIHdyaXRlcyBhIHNpbmdsZSB2YWx1ZTsgYCArXG4gICAgICAgIGB0aGUgZWRpdG9yIHdvdWxkIGRyb3AgdGhlIGZpZWxkIGZyb20gdGhlIGNvbXBvbmVudCBhbmQgaXQgY291bGQgbm90IGJlIHJlc3RvcmVkIGJ5IGEgbGF0ZXIgd3JpdGUgKGlzc3VlICMxMTUpLiBgICtcbiAgICAgICAgYFNldCB0aGUgd2hvbGUgYXJyYXkgd2l0aCAnYXNzZXRBcnJheScsICdub2RlQXJyYXknLCAnY29tcG9uZW50QXJyYXknLCAnY29sb3JBcnJheScsICdudW1iZXJBcnJheScgb3IgYCArXG4gICAgICAgIGAnc3RyaW5nQXJyYXknLCBvciB3cml0ZSBvbmUgZWxlbWVudCB3aXRoIGEgZG90dGVkIGluZGV4ICgnJHtwcm9wZXJ0eX0uMCcsICcke3Byb3BlcnR5fS48bGVuZ3RoPicgYXBwZW5kcykuIGAgK1xuICAgICAgICBgTm90aGluZyB3YXMgd3JpdHRlbi5gXG4gICAgKTtcbn1cblxuLyoqIFZlcmlmeSBhIHByb3BlcnR5IGNoYW5nZSB3YXMgYXBwbGllZDsgdXNlcyBnZXRDb21wb25lbnRJbmZvIGNhbGxiYWNrIHRvIGF2b2lkIGNpcmN1bGFyIGRlcHMgKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIG9yaWdpbmFsVmFsdWU6IGFueSxcbiAgICBleHBlY3RlZFZhbHVlOiBhbnksXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBib29sZWFuOyBhY3R1YWxWYWx1ZTogYW55OyBmdWxsRGF0YTogYW55IH0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRJbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgICAgIGlmIChjb21wb25lbnRJbmZvLnN1Y2Nlc3MgJiYgY29tcG9uZW50SW5mby5kYXRhKSB7XG4gICAgICAgICAgICAvLyBXYWxrIGRvdHRlZCBwcm9wZXJ0eSBwYXRocyB0aHJvdWdoIG5lc3RlZCBDQ0NsYXNzIGdyb3VwIGR1bXBzLlxuICAgICAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgbGV0IHByb3BlcnR5RGF0YTogYW55ID0gY29tcG9uZW50SW5mby5kYXRhLnByb3BlcnRpZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aCAmJiBwcm9wZXJ0eURhdGE7IGkrKykge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YVtzZWdtZW50c1tpXV07XG4gICAgICAgICAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTGVhZiAmJiBwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YS52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gcHJvcGVydHlEYXRhLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eURhdGEpIHtcbiAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YS52YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXh0cmFjdHMgYSByZWZlcmVuY2UncyB1dWlkIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgZWRpdG9yJ3MgZHVtcCB3cmFwcyBpdFxuICAgICAgICAgICAgLy8gYXMgYSBwbGFpbiBzdHJpbmcgKHsgdXVpZDogJ3gnIH0pIG9yIGFzIGEgbmVzdGVkIGxlYWYgZGVzY3JpcHRvclxuICAgICAgICAgICAgLy8gKHsgdXVpZDogeyB2YWx1ZTogJ3gnIH0gfSkg4oCUIHRoZSBzYW1lIGFtYmlndWl0eSB0aGUgc2luZ2xlLXJlZmVyZW5jZSBicmFuY2hcbiAgICAgICAgICAgIC8vIGJlbG93IGFscmVhZHkgdG9sZXJhdGVzLlxuICAgICAgICAgICAgY29uc3QgZXh0cmFjdFV1aWQgPSAocmVmOiBhbnkpOiBzdHJpbmcgPT4ge1xuICAgICAgICAgICAgICAgIC8vIEFuIGFzc2V0LWFycmF5IGVsZW1lbnQgcmVhZHMgYmFjayBhcyBhIGZ1bGwgZWxlbWVudCBkdW1wXG4gICAgICAgICAgICAgICAgLy8gKHsgdmFsdWU6IHsgdXVpZCB9LCB0eXBlLCAuLi4gfSksIG5vdCBhIGJhcmUgeyB1dWlkIH0gcmVmIOKAlCB1bndyYXAgaXQuXG4gICAgICAgICAgICAgICAgaWYgKHJlZiAmJiB0eXBlb2YgcmVmID09PSAnb2JqZWN0JyAmJiAhKCd1dWlkJyBpbiByZWYpICYmIHJlZi52YWx1ZSAmJiB0eXBlb2YgcmVmLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICByZWYgPSByZWYudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICghcmVmIHx8IHR5cGVvZiByZWYgIT09ICdvYmplY3QnIHx8ICEoJ3V1aWQnIGluIHJlZikpIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCByYXcgPSByZWYudXVpZDtcbiAgICAgICAgICAgICAgICBpZiAocmF3ICYmIHR5cGVvZiByYXcgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcmF3KSByZXR1cm4gcmF3LnZhbHVlIHx8ICcnO1xuICAgICAgICAgICAgICAgIHJldHVybiByYXcgfHwgJyc7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBsZXQgdmVyaWZpZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9kZUFycmF5IC8gY29tcG9uZW50QXJyYXk6IGV2ZXJ5IGVsZW1lbnQgaXMgaXRzZWxmIGEgeyB1dWlkIH0gcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgIC8vIENvbXBhcmUgYnkgcGVyLWVsZW1lbnQgdXVpZCAob3JkZXItcHJlc2VydmluZyksIG5ldmVyIGJ5IGRlZXAtZXF1YWxpbmcgdGhlXG4gICAgICAgICAgICAgICAgLy8gd2hvbGUgYXJyYXkg4oCUIHRoZSBlZGl0b3IncyByZWFkLWJhY2sgZHVtcCBtYXkgY2FycnkgZXh0cmEgcGVyLWVsZW1lbnRcbiAgICAgICAgICAgICAgICAvLyBtZXRhZGF0YSAoZS5nLiBhbiBpbnRlcm5hbCBvYmplY3QgaWQpIHRoYXQgYSBwbGFpbiBjb21wb25lbnQvbm9kZSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICAvLyB3cml0ZSBuZXZlciBpbmNsdWRlZCwgd2hpY2ggd291bGQgZmFpbCBhIEpTT04uc3RyaW5naWZ5IGNvbXBhcmlzb24gZXZlblxuICAgICAgICAgICAgICAgIC8vIHRob3VnaCBldmVyeSByZWZlcmVuY2UgcmVzb2x2ZWQgY29ycmVjdGx5LlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbEFyciA9IEFycmF5LmlzQXJyYXkoYWN0dWFsVmFsdWUpID8gYWN0dWFsVmFsdWUgOiBbXTtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbEFyci5sZW5ndGggPT09IGV4cGVjdGVkVmFsdWUubGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWUuZXZlcnkoKGV4cDogYW55LCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhwVXVpZCA9IGV4dHJhY3RVdWlkKGV4cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwVXVpZCAhPT0gJycgJiYgZXhwVXVpZCA9PT0gZXh0cmFjdFV1aWQoYWN0dWFsQXJyW2lkeF0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWUgPT09ICdvYmplY3QnICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwgJiYgJ3V1aWQnIGluIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNzMgKHNlY29uZGFyeSBmaW5kaW5nKTogdGhlIHRyYWlsaW5nIGAmJiBleHBlY3RlZFV1aWQgIT09ICcnYCBtYWRlXG4gICAgICAgICAgICAgICAgLy8gYHZlcmlmaWVkYCBBTFdBWVMgZmFsc2Ugd2hlbiBjbGVhcmluZyBhIHJlZmVyZW5jZSB0byBhbiBlbXB0eSB1dWlkIOKAlCBldmVuXG4gICAgICAgICAgICAgICAgLy8gd2hlbiBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQgPT09ICcnIGFuZCB0aGUgY2xlYXIgZ2VudWluZWx5IHN1Y2NlZWRlZFxuICAgICAgICAgICAgICAgIC8vIChpc3N1ZSAjNzUpLiBEcm9wcGluZyBpdCBkb2VzIG5vdCB3ZWFrZW4gdGhlIG5vbi1lbXB0eSBjYXNlOiBhIG1pc3NpbmcvXG4gICAgICAgICAgICAgICAgLy8gdW5kZWZpbmVkIGFjdHVhbFZhbHVlIGFscmVhZHkgY29tcHV0ZXMgYWN0dWFsVXVpZCA9PT0gJycsIHdoaWNoIGNhbiBuZXZlclxuICAgICAgICAgICAgICAgIC8vIGVxdWFsIGEgbm9uLWVtcHR5IGV4cGVjdGVkVXVpZCwgc28gdGhhdCBjb21wYXJpc29uIGFsb25lIHN0aWxsIGZhaWxzIGl0LlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbFV1aWQgPSBhY3R1YWxWYWx1ZSAmJiB0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBhY3R1YWxWYWx1ZSA/IGFjdHVhbFZhbHVlLnV1aWQgOiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCBleHBlY3RlZFV1aWQgPSBleHBlY3RlZFZhbHVlLnV1aWQgfHwgJyc7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gdHlwZW9mIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSAnb2JqZWN0JyAmJiBhY3R1YWxWYWx1ZSAhPT0gbnVsbCAmJiBleHBlY3RlZFZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gSlNPTi5zdHJpbmdpZnkoYWN0dWFsVmFsdWUpID09PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZFZhbHVlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFZhbHVlID09PSBleHBlY3RlZFZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBTdHJpbmcoYWN0dWFsVmFsdWUpID09PSBTdHJpbmcoZXhwZWN0ZWRWYWx1ZSkgfHwgTnVtYmVyKGFjdHVhbFZhbHVlKSA9PT0gTnVtYmVyKGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkLFxuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgIGZ1bGxEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkUHJvcGVydHk6IHsgbmFtZTogcHJvcGVydHksIGJlZm9yZTogb3JpZ2luYWxWYWx1ZSwgZXhwZWN0ZWQ6IGV4cGVjdGVkVmFsdWUsIGFjdHVhbDogYWN0dWFsVmFsdWUsIHZlcmlmaWVkIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFN1bW1hcnk6IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHRvdGFsUHJvcGVydGllczogT2JqZWN0LmtleXMoY29tcG9uZW50SW5mby5kYXRhPy5wcm9wZXJ0aWVzIHx8IHt9KS5sZW5ndGggfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFuYWdlQ29tcG9uZW50LnZlcmlmeVByb3BlcnR5Q2hhbmdlXSBWZXJpZmljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBhY3R1YWxWYWx1ZTogdW5kZWZpbmVkLCBmdWxsRGF0YTogbnVsbCB9O1xufVxuIl19