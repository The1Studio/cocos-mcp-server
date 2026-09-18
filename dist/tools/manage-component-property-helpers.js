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
exports.verifyComponentPropertyChange = verifyComponentPropertyChange;
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
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
        return { exists: false, type: 'unknown', availableProperties, originalValue: undefined };
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
    'nodeArray', 'colorArray', 'numberArray', 'stringArray', 'componentArray'
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
    if (isClearRequest && propertyType === 'componentArray') {
        return [];
    }
    if (exports.ASSET_REFERENCE_PROPERTY_TYPES.includes(propertyType)) {
        if (typeof value === 'string')
            return { uuid: value };
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
            return Boolean(value);
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
                    return coerced.map((item) => Number(item));
            }
            throw new Error(`NumberArray value must be an array (received typeof ${typeof value})`);
        case 'stringArray':
            {
                const coerced = (0, normalize_1.parseJsonPayload)(value);
                if (Array.isArray(coerced))
                    return coerced.map((item) => String(item));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFhSCxvRUFZQztBQVVELDhEQTBCQztBQUlELDBDQXVIQztBQUdELDRDQW9CQztBQXlERCxvREFnSUM7QUFHRCxrRUFxQ0M7QUFHRCxnRUF1QkM7QUFHRCxnRUF3QkM7QUFHRCxzRUFvRkM7QUExakJELG9DQUEyRDtBQUMzRCxrREFBc0Q7QUFFdEQ7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLDRCQUE0QixDQUFDLFNBQWM7SUFDdkQsSUFBSSxDQUFBLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxLQUFLLEtBQUksT0FBTyxTQUFTLENBQUMsS0FBSyxLQUFLLFFBQVE7UUFBRSxPQUFPLFNBQVMsQ0FBQyxLQUFLLENBQUM7SUFFcEYsTUFBTSxVQUFVLEdBQXdCLEVBQUUsQ0FBQztJQUMzQyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFBRSxPQUFPLFVBQVUsQ0FBQztJQUNuRSxNQUFNLFdBQVcsR0FBRyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3pMLEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFF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VyxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDN0UsQ0FBQztxQkFBTSxDQUFDO29CQUNKLFFBQVEsR0FBRyxXQUFXLEtBQUssYUFBYSxDQUFDO2dCQUM3QyxDQUFDO1lBQ0wsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDOUcsQ0FBQztZQUVELE9BQU87Z0JBQ0gsUUFBUTtnQkFDUixXQUFXO2dCQUNYLFFBQVEsRUFBRTtvQkFDTixnQkFBZ0IsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFO29CQUNuSCxnQkFBZ0IsRUFBRSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQSxNQUFBLGFBQWEsQ0FBQyxJQUFJLDBDQUFFLFVBQVUsS0FBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7aUJBQzNIO2FBQ0osQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkRBQTZELEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUNELE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFB1cmUgaGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tcG9uZW50IHByb3BlcnR5IGFuYWx5c2lzLCB2YWxpZGF0aW9uLCBhbmQgcXVlcnkgdXRpbGl0aWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50IHRvIGtlZXAgbWFuYWdlLWNvbXBvbmVudC50cyB1bmRlciAyMDAgbGluZXMuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHBhcnNlSnNvblBheWxvYWQgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuXG4vKipcbiAqIFJldHVybiBhIGNvbXBvbmVudCBkdW1wJ3MgcHJvcGVydHkgbWFwLlxuICpcbiAqIGBzY2VuZTpxdWVyeS1ub2RlYCBzaGFwZXMgZWFjaCBgX19jb21wc19fYCBlbnRyeSBhc1xuICogYHsgX190eXBlX18sIGNpZCwgdHlwZSwgZW5hYmxlZCwgdmFsdWU6IHsgPHByb3A+OiB7IG5hbWUsIHZhbHVlLCB0eXBlIH0gfSB9YCDigJQgdGhlIGxpdmVcbiAqIHByb3BlcnR5IHZhbHVlcyBsaXZlIHVuZGVyIGB2YWx1ZWAuIFRoZSBmYWxsYmFjayBjb3ZlcnMgZHVtcHMgdGhhdCBpbmxpbmUgdGhlaXJcbiAqIHByb3BlcnRpZXMgaW5zdGVhZCBvZiBuZXN0aW5nIHRoZW0uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wKGNvbXBvbmVudDogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgaWYgKGNvbXBvbmVudD8udmFsdWUgJiYgdHlwZW9mIGNvbXBvbmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHJldHVybiBjb21wb25lbnQudmFsdWU7XG5cbiAgICBjb25zdCBwcm9wZXJ0aWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgaWYgKCFjb21wb25lbnQgfHwgdHlwZW9mIGNvbXBvbmVudCAhPT0gJ29iamVjdCcpIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgIGNvbnN0IGV4Y2x1ZGVLZXlzID0gWydfX3R5cGVfXycsICdlbmFibGVkJywgJ25vZGUnLCAnX2lkJywgJ19fc2NyaXB0QXNzZXQnLCAndXVpZCcsICduYW1lJywgJ19uYW1lJywgJ19vYmpGbGFncycsICdfZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnLCAnY2lkJywgJ2VkaXRvcicsICdleHRlbmRzJ107XG4gICAgZm9yIChjb25zdCBrZXkgaW4gY29tcG9uZW50KSB7XG4gICAgICAgIGlmICghZXhjbHVkZUtleXMuaW5jbHVkZXMoa2V5KSAmJiAha2V5LnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgICAgICAgcHJvcGVydGllc1trZXldID0gY29tcG9uZW50W2tleV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHByb3BlcnRpZXM7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvcGVydHlBbmFseXNpc1Jlc3VsdCB7XG4gICAgZXhpc3RzOiBib29sZWFuO1xuICAgIHR5cGU6IHN0cmluZztcbiAgICBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXTtcbiAgICBvcmlnaW5hbFZhbHVlOiBhbnk7XG59XG5cbi8qKiBSZXR1cm5zIHRydWUgaWYgcHJvcERhdGEgbG9va3MgbGlrZSBhIENvY29zIENyZWF0b3IgcHJvcGVydHkgZGVzY3JpcHRvciBvYmplY3QgKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yKHByb3BEYXRhOiBhbnkpOiBib29sZWFuIHtcbiAgICBpZiAodHlwZW9mIHByb3BEYXRhICE9PSAnb2JqZWN0JyB8fCBwcm9wRGF0YSA9PT0gbnVsbCkgcmV0dXJuIGZhbHNlO1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wRGF0YSk7XG4gICAgICAgIC8vIFNraXAgc2ltcGxlIHZhbHVlIG9iamVjdHMgbGlrZSB7d2lkdGg6IDIwMCwgaGVpZ2h0OiAxNTB9XG4gICAgICAgIGNvbnN0IGlzU2ltcGxlVmFsdWVPYmplY3QgPSBrZXlzLmV2ZXJ5KGtleSA9PiB7XG4gICAgICAgICAgICBjb25zdCB2ID0gcHJvcERhdGFba2V5XTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlb2YgdiA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHYgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiB2ID09PSAnYm9vbGVhbic7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoaXNTaW1wbGVWYWx1ZU9iamVjdCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBoYXNOYW1lID0ga2V5cy5pbmNsdWRlcygnbmFtZScpO1xuICAgICAgICBjb25zdCBoYXNWYWx1ZSA9IGtleXMuaW5jbHVkZXMoJ3ZhbHVlJyk7XG4gICAgICAgIGNvbnN0IGhhc1R5cGUgPSBrZXlzLmluY2x1ZGVzKCd0eXBlJyk7XG4gICAgICAgIGNvbnN0IGhhc0Rpc3BsYXlOYW1lID0ga2V5cy5pbmNsdWRlcygnZGlzcGxheU5hbWUnKTtcbiAgICAgICAgY29uc3QgaGFzUmVhZG9ubHkgPSBrZXlzLmluY2x1ZGVzKCdyZWFkb25seScpO1xuICAgICAgICBjb25zdCBoYXNWYWxpZFN0cnVjdHVyZSA9IChoYXNOYW1lIHx8IGhhc1ZhbHVlKSAmJiAoaGFzVHlwZSB8fCBoYXNEaXNwbGF5TmFtZSB8fCBoYXNSZWFkb25seSk7XG4gICAgICAgIGlmIChrZXlzLmluY2x1ZGVzKCdkZWZhdWx0JykgJiYgcHJvcERhdGEuZGVmYXVsdCAmJiB0eXBlb2YgcHJvcERhdGEuZGVmYXVsdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRLZXlzID0gT2JqZWN0LmtleXMocHJvcERhdGEuZGVmYXVsdCk7XG4gICAgICAgICAgICBpZiAoZGVmYXVsdEtleXMuaW5jbHVkZXMoJ3ZhbHVlJykgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhhc1ZhbGlkU3RydWN0dXJlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBoYXNWYWxpZFN0cnVjdHVyZTtcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn1cblxuLyoqIEFuYWx5emUgYSBjb21wb25lbnQncyBwcm9wZXJ0eSB0byBkZXRlcm1pbmUgaXRzIHR5cGUgYW5kIGN1cnJlbnQgdmFsdWUuXG4gKiAgU3VwcG9ydHMgZG90dGVkIHByb3BlcnR5TmFtZSBmb3IgbmVzdGVkIENDQ2xhc3MgZ3JvdXBzIChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhbmFseXplUHJvcGVydHkoY29tcG9uZW50OiBhbnksIHByb3BlcnR5TmFtZTogc3RyaW5nKTogUHJvcGVydHlBbmFseXNpc1Jlc3VsdCB7XG4gICAgY29uc3QgYXZhaWxhYmxlUHJvcGVydGllczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgcHJvcGVydHlWYWx1ZTogYW55ID0gdW5kZWZpbmVkO1xuICAgIGxldCBwcm9wZXJ0eUV4aXN0cyA9IGZhbHNlO1xuXG4gICAgLy8gTWV0aG9kIDE6IGRpcmVjdCBwcm9wZXJ0eSBhY2Nlc3MgKGZsYXQgcGF0aCBvbmx5KVxuICAgIGlmICghcHJvcGVydHlOYW1lLmluY2x1ZGVzKCcuJykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwgcHJvcGVydHlOYW1lKSkge1xuICAgICAgICBwcm9wZXJ0eVZhbHVlID0gY29tcG9uZW50W3Byb3BlcnR5TmFtZV07XG4gICAgICAgIHByb3BlcnR5RXhpc3RzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBNZXRob2QgMjogc2VhcmNoIG5lc3RlZCBwcm9wZXJ0aWVzIHN0cnVjdHVyZSAoQ29jb3MgQ3JlYXRvciBjb21wb25lbnQgZHVtcCBmb3JtYXQpLlxuICAgIC8vICBGb3IgZG90dGVkIG5hbWVzIGxpa2UgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIiwgd2FsayBzZWdtZW50cyB0aHJvdWdoIG5lc3RlZCBgLnZhbHVlYCBkdW1wcy5cbiAgICBpZiAoIXByb3BlcnR5RXhpc3RzICYmIGNvbXBvbmVudC5wcm9wZXJ0aWVzICYmIHR5cGVvZiBjb21wb25lbnQucHJvcGVydGllcyA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgY29uc3Qgcm9vdFZhbHVlT2JqID0gY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWUgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlID09PSAnb2JqZWN0J1xuICAgICAgICAgICAgPyBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZVxuICAgICAgICAgICAgOiBjb21wb25lbnQucHJvcGVydGllcztcblxuICAgICAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5TmFtZS5zcGxpdCgnLicpO1xuICAgICAgICBsZXQgY3Vyc29yOiBhbnkgPSByb290VmFsdWVPYmo7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2VnbWVudCA9IHNlZ21lbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcblxuICAgICAgICAgICAgLy8gUG9wdWxhdGUgYXZhaWxhYmxlUHJvcGVydGllcyBhdCB0aGUgcmVsZXZhbnQgbGV2ZWwgKHJvb3Qgb3IgZmluYWwgY29udGFpbmVyKVxuICAgICAgICAgICAgaWYgKGkgPT09IDAgfHwgKGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDEpKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMoY3Vyc29yIHx8IHt9KSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodiAmJiB0eXBlb2YgdiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByZWZpeCA9IGkgPT09IDAgPyAnJyA6IGAke3NlZ21lbnRzLnNsaWNlKDAsIGkpLmpvaW4oJy4nKX0uYDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZVByb3BlcnRpZXMucHVzaChgJHtwcmVmaXh9JHtrfWApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBkZXNjcmlwdG9yID0gY3Vyc29yID8gY3Vyc29yW3NlZ21lbnRdIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGlzTGVhZikge1xuICAgICAgICAgICAgICAgIGlmIChpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yKGRlc2NyaXB0b3IpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRLZXlzID0gT2JqZWN0LmtleXMoZGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBkS2V5cy5pbmNsdWRlcygndmFsdWUnKSA/IGRlc2NyaXB0b3IudmFsdWUgOiBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VmFsdWUgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIERlc2NlbmQgaW50byB0aGUgbmVzdGVkIENDQ2xhc3MgZ3JvdXA6IGRlc2NyaXB0b3IudmFsdWUgaG9sZHMgdGhlIGlubmVyIGR1bXAuXG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3IudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTWV0aG9kIDM6IGNvbGxlY3Qgc2ltcGxlIHByb3BlcnR5IG5hbWVzIGZyb20gZGlyZWN0IGtleXMgYXMgZmFsbGJhY2tcbiAgICBpZiAoYXZhaWxhYmxlUHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoY29tcG9uZW50KSkge1xuICAgICAgICAgICAgaWYgKCFrZXkuc3RhcnRzV2l0aCgnXycpICYmICFbJ19fdHlwZV9fJywgJ2NpZCcsICdub2RlJywgJ3V1aWQnLCAnbmFtZScsICdlbmFibGVkJywgJ3R5cGUnLCAncmVhZG9ubHknLCAndmlzaWJsZSddLmluY2x1ZGVzKGtleSkpIHtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVQcm9wZXJ0aWVzLnB1c2goa2V5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmICghcHJvcGVydHlFeGlzdHMpIHtcbiAgICAgICAgcmV0dXJuIHsgZXhpc3RzOiBmYWxzZSwgdHlwZTogJ3Vua25vd24nLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiB1bmRlZmluZWQgfTtcbiAgICB9XG5cbiAgICAvLyBJbmZlciB0eXBlIGZyb20gdmFsdWUgc3RydWN0dXJlXG4gICAgbGV0IHR5cGUgPSAndW5rbm93bic7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcGVydHlWYWx1ZSkpIHtcbiAgICAgICAgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykpIHR5cGUgPSAnbm9kZUFycmF5JztcbiAgICAgICAgZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NvbG9yJykpIHR5cGUgPSAnY29sb3JBcnJheSc7XG4gICAgICAgIGVsc2UgdHlwZSA9ICdhcnJheSc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdHlwZSA9IFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpID8gJ2Fzc2V0JyA6ICdzdHJpbmcnO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIHR5cGUgPSAnbnVtYmVyJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICAgICAgdHlwZSA9ICdib29sZWFuJztcbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VmFsdWUgJiYgdHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcGVydHlWYWx1ZSk7XG4gICAgICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygncicpICYmIGtleXMuaW5jbHVkZXMoJ2cnKSAmJiBrZXlzLmluY2x1ZGVzKCdiJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ2NvbG9yJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygneCcpICYmIGtleXMuaW5jbHVkZXMoJ3knKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSBwcm9wZXJ0eVZhbHVlLnogIT09IHVuZGVmaW5lZCA/ICd2ZWMzJyA6ICd2ZWMyJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygnd2lkdGgnKSAmJiBrZXlzLmluY2x1ZGVzKCdoZWlnaHQnKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnc2l6ZSc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3V1aWQnKSB8fCBrZXlzLmluY2x1ZGVzKCdfX3V1aWRfXycpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSB8fCBrZXlzLmluY2x1ZGVzKCdfX2lkX18nKSkgPyAnbm9kZScgOiAnYXNzZXQnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCdfX2lkX18nKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnbm9kZSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICB0eXBlID0gJ29iamVjdCc7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VmFsdWUgPT09IG51bGwgfHwgcHJvcGVydHlWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGlmIChbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddLmluY2x1ZGVzKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdhc3NldCc7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSB8fCBwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGFyZ2V0JykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnbm9kZSc7XG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NvbXBvbmVudCcpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2NvbXBvbmVudCc7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBleGlzdHM6IHRydWUsIHR5cGUsIGF2YWlsYWJsZVByb3BlcnRpZXMsIG9yaWdpbmFsVmFsdWU6IHByb3BlcnR5VmFsdWUgfTtcbn1cblxuLyoqIFBhcnNlIGEgaGV4IGNvbG9yIHN0cmluZyAoI1JHQiBvciAjUkdCQSkgdG8gYW4gUkdCQSBvYmplY3QgKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUNvbG9yU3RyaW5nKGNvbG9yU3RyOiBzdHJpbmcpOiB7IHI6IG51bWJlcjsgZzogbnVtYmVyOyBiOiBudW1iZXI7IGE6IG51bWJlciB9IHtcbiAgICBjb25zdCBzdHIgPSBjb2xvclN0ci50cmltKCk7XG4gICAgaWYgKHN0ci5zdGFydHNXaXRoKCcjJykpIHtcbiAgICAgICAgaWYgKHN0ci5sZW5ndGggPT09IDcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygxLCAzKSwgMTYpLFxuICAgICAgICAgICAgICAgIGc6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMywgNSksIDE2KSxcbiAgICAgICAgICAgICAgICBiOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDUsIDcpLCAxNiksXG4gICAgICAgICAgICAgICAgYTogMjU1XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKHN0ci5sZW5ndGggPT09IDkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygxLCAzKSwgMTYpLFxuICAgICAgICAgICAgICAgIGc6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMywgNSksIDE2KSxcbiAgICAgICAgICAgICAgICBiOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDUsIDcpLCAxNiksXG4gICAgICAgICAgICAgICAgYTogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg3LCA5KSwgMTYpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjb2xvciBmb3JtYXQ6IFwiJHtjb2xvclN0cn1cIi4gT25seSBoZXhhZGVjaW1hbCBmb3JtYXQgaXMgc3VwcG9ydGVkIChlLmcuLCBcIiNGRjAwMDBcIiBvciBcIiNGRjAwMDBGRlwiKWApO1xufVxuXG4vKipcbiAqIENvY29zIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eSB0eXBlcy4gRXZlcnkgb25lIG9mIHRoZXNlIHNlcmlhbGl6ZXMgaWRlbnRpY2FsbHkgYXNcbiAqIGB7IHV1aWQgfWAgKGlzc3VlICMyNiDigJQgcHJvcGVydHlUeXBlPVwibWF0ZXJpYWxcIiBhbmQgZnJpZW5kcyBwcmV2aW91c2x5IGZlbGwgdGhyb3VnaCB0b1xuICogYFVuc3VwcG9ydGVkIHByb3BlcnR5IHR5cGVgLCBldmVuIHRob3VnaCB0aGUgZXhpc3Rpbmcgc3ByaXRlRnJhbWUvcHJlZmFiL2Fzc2V0IGNvZXJjaW9uXG4gKiBhbHJlYWR5IHByb2R1Y2VzIHRoZSBjb3JyZWN0IHNoYXBlIGZvciB0aGVtKS5cbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyA9IFtcbiAgICAnc3ByaXRlRnJhbWUnLCAncHJlZmFiJywgJ2Fzc2V0JyxcbiAgICAnbWF0ZXJpYWwnLCAndGV4dHVyZScsICdzcHJpdGVBdGxhcycsICdhdWRpb0NsaXAnLCAnZm9udCcsICdhbmltYXRpb25DbGlwJyxcbiAgICAnbWVzaCcsICdza2VsZXRvbicsICdwaHlzaWNzTWF0ZXJpYWwnLCAncmVuZGVyVGV4dHVyZScsICd0ZXh0QXNzZXQnLCAnanNvbkFzc2V0JyxcbiAgICAncGFydGljbGVBc3NldCcsICdzY2VuZUFzc2V0J1xuXSBhcyBjb25zdDtcblxuLyoqXG4gKiBFeHBsaWNpdCBwcm9wZXJ0eVR5cGUgLT4gQ29jb3MgYXNzZXQgY2xhc3MgZm9yIHRoZSBFZGl0b3IgYHNldC1wcm9wZXJ0eWAgZHVtcCBgdHlwZWAgZmllbGQuXG4gKlxuICogUmVzb2x2ZWQgZnJvbSB0aGUgcHJvcGVydHlUeXBlIGl0c2VsZiwgTk9UIGZyb20gdGhlIHByb3BlcnR5IG5hbWUuIFRoZSBsZWdhY3kgbmFtZS1iYXNlZFxuICogaGV1cmlzdGljIGluIGBhcHBseVByb3BlcnR5VG9FZGl0b3JgIG1pcy1yZXNvbHZlcyBhbnkgYXNzZXQgcHJvcGVydHkgd2hvc2UgbmFtZSBsYWNrcyB0aGVcbiAqIG1hdGNoaW5nIGtleXdvcmQg4oCUIGEgYGNjLk1hdGVyaWFsYCBwcm9wZXJ0eSBjYWxsZWQgYHNraW5gIHJlc29sdmVkIHRvIGBjYy5TcHJpdGVGcmFtZWAuXG4gKlxuICogVGhlIGdlbmVyaWMgYGFzc2V0YCBhbmQgYHN0cmluZ2Agc3BlbGxpbmdzIGNhcnJ5IG5vIHR5cGUgaW5mb3JtYXRpb24sIHNvIHRoZXkgZGVsaWJlcmF0ZWx5XG4gKiBoYXZlIE5PIGVudHJ5IGhlcmUgYW5kIGtlZXAgdXNpbmcgdGhlIG5hbWUgaGV1cmlzdGljICh1bmNoYW5nZWQgYmVoYXZpb3VyIGZvciBleGlzdGluZyBjYWxsZXJzKS5cbiAqL1xuZXhwb3J0IGNvbnN0IEFTU0VUX1RZUEVfQllfUFJPUEVSVFlfVFlQRTogUmVhZG9ubHk8UmVjb3JkPHN0cmluZywgc3RyaW5nPj4gPSB7XG4gICAgbWF0ZXJpYWw6ICdjYy5NYXRlcmlhbCcsXG4gICAgdGV4dHVyZTogJ2NjLlRleHR1cmUyRCcsXG4gICAgc3ByaXRlRnJhbWU6ICdjYy5TcHJpdGVGcmFtZScsXG4gICAgc3ByaXRlQXRsYXM6ICdjYy5TcHJpdGVBdGxhcycsXG4gICAgcHJlZmFiOiAnY2MuUHJlZmFiJyxcbiAgICBhdWRpb0NsaXA6ICdjYy5BdWRpb0NsaXAnLFxuICAgIGZvbnQ6ICdjYy5Gb250JyxcbiAgICBhbmltYXRpb25DbGlwOiAnY2MuQW5pbWF0aW9uQ2xpcCcsXG4gICAgbWVzaDogJ2NjLk1lc2gnLFxuICAgIHNrZWxldG9uOiAnY2MuU2tlbGV0b24nLFxuICAgIHBoeXNpY3NNYXRlcmlhbDogJ2NjLlBoeXNpY3NNYXRlcmlhbCcsXG4gICAgcmVuZGVyVGV4dHVyZTogJ2NjLlJlbmRlclRleHR1cmUnLFxuICAgIHRleHRBc3NldDogJ2NjLlRleHRBc3NldCcsXG4gICAganNvbkFzc2V0OiAnY2MuSnNvbkFzc2V0JyxcbiAgICBwYXJ0aWNsZUFzc2V0OiAnY2MuUGFydGljbGVBc3NldCcsXG4gICAgc2NlbmVBc3NldDogJ2NjLlNjZW5lQXNzZXQnXG59O1xuXG4vKiogRXZlcnkgcHJvcGVydHlUeXBlIGNvbnZlcnRQcm9wZXJ0eVZhbHVlIGFjY2VwdHMg4oCUIHVzZWQgdG8gYnVpbGQgYW4gYWN0aW9uYWJsZSBlcnJvciBtZXNzYWdlLiAqL1xuZXhwb3J0IGNvbnN0IFNVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUyA9IFtcbiAgICAnc3RyaW5nJywgJ251bWJlcicsICdpbnRlZ2VyJywgJ2Zsb2F0JywgJ2Jvb2xlYW4nLFxuICAgICdjb2xvcicsICd2ZWMyJywgJ3ZlYzMnLCAnc2l6ZScsXG4gICAgJ25vZGUnLCAnY29tcG9uZW50JyxcbiAgICAuLi5BU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMsXG4gICAgJ25vZGVBcnJheScsICdjb2xvckFycmF5JywgJ251bWJlckFycmF5JywgJ3N0cmluZ0FycmF5JywgJ2NvbXBvbmVudEFycmF5J1xuXSBhcyBjb25zdDtcblxuLyoqXG4gKiBDb252ZXJ0IGEgcmF3IExMTS1zdXBwbGllZCB2YWx1ZSB0byB0aGUgY29ycmVjdCBmb3JtYXQgZm9yIGEgZ2l2ZW4gcHJvcGVydHlUeXBlLlxuICogVGhyb3dzIGlmIHRoZSB2YWx1ZSBmb3JtYXQgaXMgaW52YWxpZCBmb3IgdGhlIGdpdmVuIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlWYWx1ZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgLy8gSXNzdWUgIzc1OiBuZWl0aGVyIGBudWxsYCBub3IgYFwiXCJgIGNvdWxkIGNsZWFyIGEgbm9kZS9jb21wb25lbnQvYXNzZXQgcmVmZXJlbmNlLlxuICAgIC8vIGBub2RlYCBhbmQgZXZlcnkgYXNzZXQtcmVmZXJlbmNlIHR5cGUgYWxyZWFkeSBmb3J3YXJkZWQgYFwiXCJgIHVucmVqZWN0ZWQgKGl0IGhhcHBlbnNcbiAgICAvLyB0byBzYXRpc2Z5IHRoZSBgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJ2AgY2hlY2sgYmVsb3cgYW5kIGJlY29tZSBgeyB1dWlkOiAnJyB9YCksXG4gICAgLy8gYnV0IHJlamVjdGVkIGBudWxsYCBvdXRyaWdodC4gYGNvbXBvbmVudGAvYGNvbXBvbmVudEFycmF5YCBhZGRpdGlvbmFsbHkgZm9yd2FyZGVkIGFcbiAgICAvLyBgXCJcImAgdmFsdWUgVU5SRVNPTFZFRCBpbnN0ZWFkIG9mIHRyZWF0aW5nIGl0IGFzIFwiY2xlYXIgdGhpcyByZWZlcmVuY2VcIiwgd2hpY2ggdGhlblxuICAgIC8vIGZhaWxlZCBkb3duc3RyZWFtIHdpdGggYSBjb25mdXNpbmcgXCJuZWl0aGVyIGEgbm9kZSB1dWlkIG5vciBhIGNvbXBvbmVudCB1dWlkXCIgZXJyb3IuXG4gICAgLy8gQSBjbGVhcmVkIHNpbmdsZSByZWZlcmVuY2UgYWx3YXlzIHNlcmlhbGl6ZXMgYXMgYHsgdXVpZDogJycgfWAg4oCUIHRoZSBzYW1lIHNoYXBlIGFcbiAgICAvLyBzZXQgcmVmZXJlbmNlIHVzZXMg4oCUIHNvIGl0IG5lZWRzIG5vIHNwZWNpYWwgaGFuZGxpbmcgYW55d2hlcmUgc2V0LXByb3BlcnR5IGFscmVhZHlcbiAgICAvLyBoYW5kbGVzIGEgcmVmZXJlbmNlIGR1bXAuXG4gICAgY29uc3QgaXNDbGVhclJlcXVlc3QgPSB2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gJyc7XG4gICAgaWYgKGlzQ2xlYXJSZXF1ZXN0ICYmIChwcm9wZXJ0eVR5cGUgPT09ICdub2RlJyB8fCBwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnQnIHx8XG4gICAgICAgIChBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgYXMgcmVhZG9ubHkgc3RyaW5nW10pLmluY2x1ZGVzKHByb3BlcnR5VHlwZSkpKSB7XG4gICAgICAgIHJldHVybiB7IHV1aWQ6ICcnIH07XG4gICAgfVxuICAgIGlmIChpc0NsZWFyUmVxdWVzdCAmJiBwcm9wZXJ0eVR5cGUgPT09ICdjb21wb25lbnRBcnJheScpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIFVVSUQgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgfVxuICAgIHN3aXRjaCAocHJvcGVydHlUeXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICAvLyBJc3N1ZSAjMTE2OiBgU3RyaW5nKHZhbHVlKWAgdHVybnMgYW55IG9iamVjdCBpbnRvIHRoZSBsaXRlcmFsIHRleHRcbiAgICAgICAgICAgIC8vIFwiW29iamVjdCBPYmplY3RdXCIgKGFuZCBhbnkgYXJyYXkgaW50byBhIGNvbW1hLWpvaW5lZCBsaXN0KSwgd2hpY2ggd2FzIHRoZW5cbiAgICAgICAgICAgIC8vIHdyaXR0ZW4gdG8gdGhlIHNjZW5lIHdpdGggc3VjY2Vzczp0cnVlIOKAlCBzaWxlbnQgZGF0YSBsb3NzIG9uIGEgcGxhaW4gc3RyaW5nXG4gICAgICAgICAgICAvLyBmaWVsZC4gUmVqZWN0IGFueXRoaW5nIG5vbi1wcmltaXRpdmUsIG5hbWluZyB0aGUgcmVjZWl2ZWQgdHlwZSwgaW5zdGVhZCBvZlxuICAgICAgICAgICAgLy8gd3JpdGluZyBhIGxvc3N5IHBsYWNlaG9sZGVyLiBNaXJyb3JzIHRoZSBhc3NldC1yZWZlcmVuY2UgYnJhbmNoIGFib3ZlLlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIGBzdHJpbmcgdmFsdWUgbXVzdCBiZSBhIHByaW1pdGl2ZSAocmVjZWl2ZWQgJHtBcnJheS5pc0FycmF5KHZhbHVlKSA/ICdhcnJheScgOiAnb2JqZWN0J30pOyBgICtcbiAgICAgICAgICAgICAgICAgICAgJ3Bhc3MgSlNPTi1lbmNvZGVkIHRleHQgaWYgYSBzdHJ1Y3R1cmVkIHBheWxvYWQgd2FzIGludGVuZGVkJ1xuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3N5bWJvbCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHN0cmluZyB2YWx1ZSBtdXN0IGJlIGEgcHJpbWl0aXZlIChyZWNlaXZlZCAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzogY2FzZSAnaW50ZWdlcic6IGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIHJldHVybiBOdW1iZXIodmFsdWUpO1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgIHJldHVybiBCb29sZWFuKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM1MjogYSBKU09OLXN0cmluZyB2YWx1ZSAoZS5nLiAne1wiclwiOjI1NSxcImdcIjowLFwiYlwiOjB9JykgcmVhY2hlc1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgcG9pbnQgYXMgYSBzdHJpbmcuIEEgaGV4IGNvbG9yIHN0cmluZyAoZS5nLiBcIiNGRjAwMDBcIikgaXMgTk9UXG4gICAgICAgICAgICAgICAgLy8gdmFsaWQgSlNPTiwgc28gcGFyc2VKc29uUGF5bG9hZCByZXR1cm5zIGl0IHVuY2hhbmdlZDsgb25seSBhIEpTT04gb2JqZWN0XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGNvZXJjZXMgdG8gYW4gb2JqZWN0LiBUcnkgdGhlIEpTT04gcGF0aCBmaXJzdCBzbyBib3RoIGEgaGV4XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGFuZCBhIEpTT04tc3RyaW5nIG9iamVjdCBsYW5kIGluIHRoZSByaWdodCBicmFuY2guXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ3N0cmluZycpIHJldHVybiBwYXJzZUNvbG9yU3RyaW5nKGNvZXJjZWQpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQuYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYTogY29lcmNlZC5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmEpKSkgOiAyNTVcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbG9yIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggciwgZywgYiBwcm9wZXJ0aWVzIG9yIGEgaGV4YWRlY2ltYWwgc3RyaW5nIChlLmcuLCBcIiNGRjAwMDBcIikgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3ZlYzInOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcihjb2VyY2VkLngpIHx8IDAsIHk6IE51bWJlcihjb2VyY2VkLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVjMiB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHkgcHJvcGVydGllcyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAndmVjMyc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKGNvZXJjZWQueCkgfHwgMCwgeTogTnVtYmVyKGNvZXJjZWQueSkgfHwgMCwgejogTnVtYmVyKGNvZXJjZWQueikgfHwgMCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWZWMzIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSwgeiBwcm9wZXJ0aWVzIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdzaXplJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSByZXR1cm4geyB3aWR0aDogTnVtYmVyKGNvZXJjZWQud2lkdGgpIHx8IDAsIGhlaWdodDogTnVtYmVyKGNvZXJjZWQuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNpemUgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB3aWR0aCwgaGVpZ2h0IHByb3BlcnRpZXMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGUnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IHZhbHVlIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRCAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50JzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4gdmFsdWU7IC8vIHJlc29sdmVkIHRvIF9faWRfXyBsYXRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgKG5vZGUgVVVJRCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIGl0ZW07IC8vIGVhY2ggcmVzb2x2ZWQgdG8gYSBjb21wb25lbnQgX19pZF9fIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50QXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgbm9kZSBVVUlEcyAoZWFjaCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudEFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGVBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4geyBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07IHRocm93IG5ldyBFcnJvcihgTm9kZUFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIFVVSURzIChyZWNlaXZlZCBpdGVtIHR5cGVvZiAke3R5cGVvZiBpdGVtfSlgKTsgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGVBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdjb2xvckFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5yKSB8fCAwKSksIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uZykgfHwgMCkpLCBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmIpIHx8IDApKSwgYTogaXRlbS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmEpKSkgOiAyNTUgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29sb3JBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdudW1iZXJBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4gTnVtYmVyKGl0ZW0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTnVtYmVyQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnc3RyaW5nQXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IFN0cmluZyhpdGVtKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0cmluZ0FycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHByb3BlcnR5IHR5cGU6ICR7cHJvcGVydHlUeXBlfS4gU3VwcG9ydGVkIHR5cGVzOiAke1NVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUy5qb2luKCcsICcpfWApO1xuICAgIH1cbn1cblxuLyoqIEdlbmVyYXRlIGFuIExMTS1mcmllbmRseSBzdWdnZXN0aW9uIHdoZW4gcmVxdWVzdGVkIGNvbXBvbmVudCB0eXBlIGlzIG5vdCBmb3VuZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbihyZXF1ZXN0ZWRUeXBlOiBzdHJpbmcsIGF2YWlsYWJsZVR5cGVzOiBzdHJpbmdbXSwgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2ltaWxhclR5cGVzID0gYXZhaWxhYmxlVHlwZXMuZmlsdGVyKHR5cGUgPT5cbiAgICAgICAgdHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHJlcXVlc3RlZFR5cGUudG9Mb3dlckNhc2UoKSkgfHxcbiAgICAgICAgcmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHR5cGUudG9Mb3dlckNhc2UoKSlcbiAgICApO1xuXG4gICAgbGV0IGluc3RydWN0aW9uID0gJyc7XG4gICAgaWYgKHNpbWlsYXJUeXBlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5Gb3VuZCBzaW1pbGFyIGNvbXBvbmVudHM6ICR7c2ltaWxhclR5cGVzLmpvaW4oJywgJyl9YDtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3Rpb246IFBlcmhhcHMgeW91IG1lYW50ICcke3NpbWlsYXJUeXBlc1swXX0nP2A7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvcGVydHlUb0NvbXBvbmVudE1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICAnc3RyaW5nJzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCcsICdjYy5FZGl0Qm94J10sXG4gICAgICAgICd0ZXh0JzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCddLFxuICAgICAgICAnZm9udFNpemUnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXG4gICAgICAgICdzcHJpdGVGcmFtZSc6IFsnY2MuU3ByaXRlJ10sXG4gICAgICAgICdjb2xvcic6IFsnY2MuTGFiZWwnLCAnY2MuU3ByaXRlJywgJ2NjLkdyYXBoaWNzJ10sXG4gICAgICAgICdub3JtYWxDb2xvcic6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICdwcmVzc2VkQ29sb3InOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAndGFyZ2V0JzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ2NvbnRlbnRTaXplJzogWydjYy5VSVRyYW5zZm9ybSddLFxuICAgICAgICAnYW5jaG9yUG9pbnQnOiBbJ2NjLlVJVHJhbnNmb3JtJ11cbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb21tZW5kZWRDb21wb25lbnRzID0gcHJvcGVydHlUb0NvbXBvbmVudE1hcFtwcm9wZXJ0eV0gfHwgW107XG4gICAgY29uc3QgYXZhaWxhYmxlUmVjb21tZW5kZWQgPSByZWNvbW1lbmRlZENvbXBvbmVudHMuZmlsdGVyKGNvbXAgPT4gYXZhaWxhYmxlVHlwZXMuaW5jbHVkZXMoY29tcCkpO1xuICAgIGlmIChhdmFpbGFibGVSZWNvbW1lbmRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5CYXNlZCBvbiBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nLCByZWNvbW1lbmRlZCBjb21wb25lbnRzOiAke2F2YWlsYWJsZVJlY29tbWVuZGVkLmpvaW4oJywgJyl9YDtcbiAgICB9XG5cbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuU3VnZ2VzdGVkIEFjdGlvbnM6YDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMS4gVXNlIG1hbmFnZV9jb21wb25lbnQgYWN0aW9uPWdldF9hbGwgbm9kZVV1aWQ9XCIuLi5cIiB0byB2aWV3IGFsbCBjb21wb25lbnRzIG9uIHRoZSBub2RlYDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMi4gSWYgeW91IG5lZWQgdG8gYWRkIGEgY29tcG9uZW50LCB1c2UgYWN0aW9uPWFkZCB3aXRoIGNvbXBvbmVudFR5cGU9XCIke3JlcXVlc3RlZFR5cGV9XCJgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4zLiBWZXJpZnkgdGhhdCB0aGUgY29tcG9uZW50IHR5cGUgbmFtZSBpcyBjb3JyZWN0IChjYXNlLXNlbnNpdGl2ZSlgO1xuXG4gICAgcmV0dXJuIGluc3RydWN0aW9uO1xufVxuXG4vKiogUmV0dXJuIGF2YWlsYWJsZSBDb2NvcyBDcmVhdG9yIGJ1aWx0LWluIGNvbXBvbmVudCB0eXBlcyBieSBjYXRlZ29yeSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0KGNhdGVnb3J5OiBzdHJpbmcgPSAnYWxsJyk6IEFjdGlvblRvb2xSZXN1bHQge1xuICAgIGNvbnN0IGNvbXBvbmVudENhdGVnb3JpZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICAgICAgcmVuZGVyZXI6IFsnY2MuU3ByaXRlJywgJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLk1hc2snLCAnY2MuR3JhcGhpY3MnXSxcbiAgICAgICAgdWk6IFsnY2MuQnV0dG9uJywgJ2NjLlRvZ2dsZScsICdjYy5TbGlkZXInLCAnY2MuU2Nyb2xsVmlldycsICdjYy5FZGl0Qm94JywgJ2NjLlByb2dyZXNzQmFyJ10sXG4gICAgICAgIHBoeXNpY3M6IFsnY2MuUmlnaWRCb2R5MkQnLCAnY2MuQm94Q29sbGlkZXIyRCcsICdjYy5DaXJjbGVDb2xsaWRlcjJEJywgJ2NjLlBvbHlnb25Db2xsaWRlcjJEJ10sXG4gICAgICAgIGFuaW1hdGlvbjogWydjYy5BbmltYXRpb24nLCAnY2MuQW5pbWF0aW9uQ2xpcCcsICdjYy5Ta2VsZXRhbEFuaW1hdGlvbiddLFxuICAgICAgICBhdWRpbzogWydjYy5BdWRpb1NvdXJjZSddLFxuICAgICAgICBsYXlvdXQ6IFsnY2MuTGF5b3V0JywgJ2NjLldpZGdldCcsICdjYy5QYWdlVmlldycsICdjYy5QYWdlVmlld0luZGljYXRvciddLFxuICAgICAgICBlZmZlY3RzOiBbJ2NjLk1vdGlvblN0cmVhaycsICdjYy5QYXJ0aWNsZVN5c3RlbTJEJ10sXG4gICAgICAgIGNhbWVyYTogWydjYy5DYW1lcmEnXSxcbiAgICAgICAgbGlnaHQ6IFsnY2MuTGlnaHQnLCAnY2MuRGlyZWN0aW9uYWxMaWdodCcsICdjYy5Qb2ludExpZ2h0JywgJ2NjLlNwb3RMaWdodCddXG4gICAgfTtcblxuICAgIGxldCBjb21wb25lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChjYXRlZ29yeSA9PT0gJ2FsbCcpIHtcbiAgICAgICAgZm9yIChjb25zdCBjYXQgaW4gY29tcG9uZW50Q2F0ZWdvcmllcykge1xuICAgICAgICAgICAgY29tcG9uZW50cyA9IGNvbXBvbmVudHMuY29uY2F0KGNvbXBvbmVudENhdGVnb3JpZXNbY2F0XSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNvbXBvbmVudENhdGVnb3JpZXNbY2F0ZWdvcnldKSB7XG4gICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRDYXRlZ29yaWVzW2NhdGVnb3J5XTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGNhdGVnb3J5LCBjb21wb25lbnRzIH0pO1xufVxuXG4vKiogUmVkaXJlY3Qgc2V0X3Byb3BlcnR5IGNhbGxzIHRoYXQgdGFyZ2V0IG5vZGUtbGV2ZWwgcHJvcGVydGllcyB0byB0aGUgY29ycmVjdCBtYW5hZ2Vfbm9kZSBhY3Rpb24gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzOiB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZzsgY29tcG9uZW50VHlwZTogc3RyaW5nOyBwcm9wZXJ0eTogc3RyaW5nOyB2YWx1ZTogYW55O1xufSk6IEFjdGlvblRvb2xSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdmFsdWUgfSA9IGFyZ3M7XG4gICAgY29uc3Qgbm9kZUJhc2ljUHJvcGVydGllcyA9IFsnbmFtZScsICdhY3RpdmUnLCAnbGF5ZXInLCAnbW9iaWxpdHknLCAncGFyZW50JywgJ2NoaWxkcmVuJywgJ2hpZGVGbGFncyddO1xuICAgIGNvbnN0IG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzID0gWydwb3NpdGlvbicsICdyb3RhdGlvbicsICdzY2FsZScsICdldWxlckFuZ2xlcycsICdhbmdsZSddO1xuXG4gICAgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5Ob2RlJyB8fCBjb21wb25lbnRUeXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgaWYgKG5vZGVCYXNpY1Byb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhIG5vZGUgYmFzaWMgcHJvcGVydHksIG5vdCBhIGNvbXBvbmVudCBwcm9wZXJ0eWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF9wcm9wZXJ0eSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCBwcm9wZXJ0eT1cIiR7cHJvcGVydHl9XCIsIHZhbHVlPSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZVRyYW5zZm9ybVByb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhIG5vZGUgdHJhbnNmb3JtIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtIHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsICR7cHJvcGVydHl9PSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqIFZlcmlmeSBhIHByb3BlcnR5IGNoYW5nZSB3YXMgYXBwbGllZDsgdXNlcyBnZXRDb21wb25lbnRJbmZvIGNhbGxiYWNrIHRvIGF2b2lkIGNpcmN1bGFyIGRlcHMgKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIG9yaWdpbmFsVmFsdWU6IGFueSxcbiAgICBleHBlY3RlZFZhbHVlOiBhbnksXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBib29sZWFuOyBhY3R1YWxWYWx1ZTogYW55OyBmdWxsRGF0YTogYW55IH0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRJbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgICAgIGlmIChjb21wb25lbnRJbmZvLnN1Y2Nlc3MgJiYgY29tcG9uZW50SW5mby5kYXRhKSB7XG4gICAgICAgICAgICAvLyBXYWxrIGRvdHRlZCBwcm9wZXJ0eSBwYXRocyB0aHJvdWdoIG5lc3RlZCBDQ0NsYXNzIGdyb3VwIGR1bXBzLlxuICAgICAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgbGV0IHByb3BlcnR5RGF0YTogYW55ID0gY29tcG9uZW50SW5mby5kYXRhLnByb3BlcnRpZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aCAmJiBwcm9wZXJ0eURhdGE7IGkrKykge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YVtzZWdtZW50c1tpXV07XG4gICAgICAgICAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTGVhZiAmJiBwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YS52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gcHJvcGVydHlEYXRhLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eURhdGEpIHtcbiAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YS52YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXh0cmFjdHMgYSByZWZlcmVuY2UncyB1dWlkIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgZWRpdG9yJ3MgZHVtcCB3cmFwcyBpdFxuICAgICAgICAgICAgLy8gYXMgYSBwbGFpbiBzdHJpbmcgKHsgdXVpZDogJ3gnIH0pIG9yIGFzIGEgbmVzdGVkIGxlYWYgZGVzY3JpcHRvclxuICAgICAgICAgICAgLy8gKHsgdXVpZDogeyB2YWx1ZTogJ3gnIH0gfSkg4oCUIHRoZSBzYW1lIGFtYmlndWl0eSB0aGUgc2luZ2xlLXJlZmVyZW5jZSBicmFuY2hcbiAgICAgICAgICAgIC8vIGJlbG93IGFscmVhZHkgdG9sZXJhdGVzLlxuICAgICAgICAgICAgY29uc3QgZXh0cmFjdFV1aWQgPSAocmVmOiBhbnkpOiBzdHJpbmcgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVmIHx8IHR5cGVvZiByZWYgIT09ICdvYmplY3QnIHx8ICEoJ3V1aWQnIGluIHJlZikpIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCByYXcgPSByZWYudXVpZDtcbiAgICAgICAgICAgICAgICBpZiAocmF3ICYmIHR5cGVvZiByYXcgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcmF3KSByZXR1cm4gcmF3LnZhbHVlIHx8ICcnO1xuICAgICAgICAgICAgICAgIHJldHVybiByYXcgfHwgJyc7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBsZXQgdmVyaWZpZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9kZUFycmF5IC8gY29tcG9uZW50QXJyYXk6IGV2ZXJ5IGVsZW1lbnQgaXMgaXRzZWxmIGEgeyB1dWlkIH0gcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgIC8vIENvbXBhcmUgYnkgcGVyLWVsZW1lbnQgdXVpZCAob3JkZXItcHJlc2VydmluZyksIG5ldmVyIGJ5IGRlZXAtZXF1YWxpbmcgdGhlXG4gICAgICAgICAgICAgICAgLy8gd2hvbGUgYXJyYXkg4oCUIHRoZSBlZGl0b3IncyByZWFkLWJhY2sgZHVtcCBtYXkgY2FycnkgZXh0cmEgcGVyLWVsZW1lbnRcbiAgICAgICAgICAgICAgICAvLyBtZXRhZGF0YSAoZS5nLiBhbiBpbnRlcm5hbCBvYmplY3QgaWQpIHRoYXQgYSBwbGFpbiBjb21wb25lbnQvbm9kZSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICAvLyB3cml0ZSBuZXZlciBpbmNsdWRlZCwgd2hpY2ggd291bGQgZmFpbCBhIEpTT04uc3RyaW5naWZ5IGNvbXBhcmlzb24gZXZlblxuICAgICAgICAgICAgICAgIC8vIHRob3VnaCBldmVyeSByZWZlcmVuY2UgcmVzb2x2ZWQgY29ycmVjdGx5LlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbEFyciA9IEFycmF5LmlzQXJyYXkoYWN0dWFsVmFsdWUpID8gYWN0dWFsVmFsdWUgOiBbXTtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbEFyci5sZW5ndGggPT09IGV4cGVjdGVkVmFsdWUubGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWUuZXZlcnkoKGV4cDogYW55LCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhwVXVpZCA9IGV4dHJhY3RVdWlkKGV4cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwVXVpZCAhPT0gJycgJiYgZXhwVXVpZCA9PT0gZXh0cmFjdFV1aWQoYWN0dWFsQXJyW2lkeF0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWUgPT09ICdvYmplY3QnICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwgJiYgJ3V1aWQnIGluIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNzMgKHNlY29uZGFyeSBmaW5kaW5nKTogdGhlIHRyYWlsaW5nIGAmJiBleHBlY3RlZFV1aWQgIT09ICcnYCBtYWRlXG4gICAgICAgICAgICAgICAgLy8gYHZlcmlmaWVkYCBBTFdBWVMgZmFsc2Ugd2hlbiBjbGVhcmluZyBhIHJlZmVyZW5jZSB0byBhbiBlbXB0eSB1dWlkIOKAlCBldmVuXG4gICAgICAgICAgICAgICAgLy8gd2hlbiBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQgPT09ICcnIGFuZCB0aGUgY2xlYXIgZ2VudWluZWx5IHN1Y2NlZWRlZFxuICAgICAgICAgICAgICAgIC8vIChpc3N1ZSAjNzUpLiBEcm9wcGluZyBpdCBkb2VzIG5vdCB3ZWFrZW4gdGhlIG5vbi1lbXB0eSBjYXNlOiBhIG1pc3NpbmcvXG4gICAgICAgICAgICAgICAgLy8gdW5kZWZpbmVkIGFjdHVhbFZhbHVlIGFscmVhZHkgY29tcHV0ZXMgYWN0dWFsVXVpZCA9PT0gJycsIHdoaWNoIGNhbiBuZXZlclxuICAgICAgICAgICAgICAgIC8vIGVxdWFsIGEgbm9uLWVtcHR5IGV4cGVjdGVkVXVpZCwgc28gdGhhdCBjb21wYXJpc29uIGFsb25lIHN0aWxsIGZhaWxzIGl0LlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbFV1aWQgPSBhY3R1YWxWYWx1ZSAmJiB0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBhY3R1YWxWYWx1ZSA/IGFjdHVhbFZhbHVlLnV1aWQgOiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCBleHBlY3RlZFV1aWQgPSBleHBlY3RlZFZhbHVlLnV1aWQgfHwgJyc7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gdHlwZW9mIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSAnb2JqZWN0JyAmJiBhY3R1YWxWYWx1ZSAhPT0gbnVsbCAmJiBleHBlY3RlZFZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gSlNPTi5zdHJpbmdpZnkoYWN0dWFsVmFsdWUpID09PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZFZhbHVlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFZhbHVlID09PSBleHBlY3RlZFZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBTdHJpbmcoYWN0dWFsVmFsdWUpID09PSBTdHJpbmcoZXhwZWN0ZWRWYWx1ZSkgfHwgTnVtYmVyKGFjdHVhbFZhbHVlKSA9PT0gTnVtYmVyKGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkLFxuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgIGZ1bGxEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkUHJvcGVydHk6IHsgbmFtZTogcHJvcGVydHksIGJlZm9yZTogb3JpZ2luYWxWYWx1ZSwgZXhwZWN0ZWQ6IGV4cGVjdGVkVmFsdWUsIGFjdHVhbDogYWN0dWFsVmFsdWUsIHZlcmlmaWVkIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFN1bW1hcnk6IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHRvdGFsUHJvcGVydGllczogT2JqZWN0LmtleXMoY29tcG9uZW50SW5mby5kYXRhPy5wcm9wZXJ0aWVzIHx8IHt9KS5sZW5ndGggfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFuYWdlQ29tcG9uZW50LnZlcmlmeVByb3BlcnR5Q2hhbmdlXSBWZXJpZmljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBhY3R1YWxWYWx1ZTogdW5kZWZpbmVkLCBmdWxsRGF0YTogbnVsbCB9O1xufVxuIl19