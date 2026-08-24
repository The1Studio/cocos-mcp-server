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
    if (exports.ASSET_REFERENCE_PROPERTY_TYPES.includes(propertyType)) {
        if (typeof value === 'string')
            return { uuid: value };
        throw new Error(`${propertyType} value must be a string UUID (received typeof ${typeof value})`);
    }
    switch (propertyType) {
        case 'string':
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
                const actualUuid = actualValue && typeof actualValue === 'object' && 'uuid' in actualValue ? actualValue.uuid : '';
                const expectedUuid = expectedValue.uuid || '';
                verified = actualUuid === expectedUuid && expectedUuid !== '';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFhSCxvRUFZQztBQVVELDhEQTBCQztBQUlELDBDQXVIQztBQUdELDRDQW9CQztBQXlERCxvREFnR0M7QUFHRCxrRUFxQ0M7QUFHRCxnRUF1QkM7QUFHRCxnRUF3QkM7QUFHRCxzRUE4RUM7QUFwaEJELG9DQUEyRDtBQUMzRCxrREFBc0Q7QUFFdEQ7Ozs7Ozs7R0FPRztBQUNILFNBQWdCLDRCQUE0QixDQUFDLFNBQWM7SUFDdkQsSUFBSSxDQUFBLFNBQVMsYUFBVCxTQUFTLHVCQUFULFNBQVMsQ0FBRSxLQUFLLEtBQUksT0FBTyxTQUFTLENBQUMsS0FBSyxLQUFLLFFBQVE7UUFBRSxPQUFPLFNBQVMsQ0FBQyxLQUFLLENBQUM7SUFFcEYsTUFBTSxVQUFVLEdBQXdCLEVBQUUsQ0FBQztJQUMzQyxJQUFJLENBQUMsU0FBUyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVE7UUFBRSxPQUFPLFVBQVUsQ0FBQztJQUNuRSxNQUFNLFdBQVcsR0FBRyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3pMLEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFF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QVMsQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUM3RSxDQUFDO3FCQUFNLENBQUM7b0JBQ0osUUFBUSxHQUFHLFdBQVcsS0FBSyxhQUFhLENBQUM7Z0JBQzdDLENBQUM7WUFDTCxDQUFDO2lCQUFNLENBQUM7Z0JBQ0osUUFBUSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxNQUFNLENBQUMsYUFBYSxDQUFDLElBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUM5RyxDQUFDO1lBRUQsT0FBTztnQkFDSCxRQUFRO2dCQUNSLFdBQVc7Z0JBQ1gsUUFBUSxFQUFFO29CQUNOLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUU7b0JBQ25ILGdCQUFnQixFQUFFLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFBLE1BQUEsYUFBYSxDQUFDLElBQUksMENBQUUsVUFBVSxLQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtpQkFDM0g7YUFDSixDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyw2REFBNkQsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUN4RixDQUFDO0lBQ0QsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHVyZSBoZWxwZXIgZnVuY3Rpb25zIGZvciBjb21wb25lbnQgcHJvcGVydHkgYW5hbHlzaXMsIHZhbGlkYXRpb24sIGFuZCBxdWVyeSB1dGlsaXRpZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgcGFyc2VKc29uUGF5bG9hZCB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5cbi8qKlxuICogUmV0dXJuIGEgY29tcG9uZW50IGR1bXAncyBwcm9wZXJ0eSBtYXAuXG4gKlxuICogYHNjZW5lOnF1ZXJ5LW5vZGVgIHNoYXBlcyBlYWNoIGBfX2NvbXBzX19gIGVudHJ5IGFzXG4gKiBgeyBfX3R5cGVfXywgY2lkLCB0eXBlLCBlbmFibGVkLCB2YWx1ZTogeyA8cHJvcD46IHsgbmFtZSwgdmFsdWUsIHR5cGUgfSB9IH1gIOKAlCB0aGUgbGl2ZVxuICogcHJvcGVydHkgdmFsdWVzIGxpdmUgdW5kZXIgYHZhbHVlYC4gVGhlIGZhbGxiYWNrIGNvdmVycyBkdW1wcyB0aGF0IGlubGluZSB0aGVpclxuICogcHJvcGVydGllcyBpbnN0ZWFkIG9mIG5lc3RpbmcgdGhlbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAoY29tcG9uZW50OiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICBpZiAoY29tcG9uZW50Py52YWx1ZSAmJiB0eXBlb2YgY29tcG9uZW50LnZhbHVlID09PSAnb2JqZWN0JykgcmV0dXJuIGNvbXBvbmVudC52YWx1ZTtcblxuICAgIGNvbnN0IHByb3BlcnRpZXM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICBpZiAoIWNvbXBvbmVudCB8fCB0eXBlb2YgY29tcG9uZW50ICE9PSAnb2JqZWN0JykgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgY29uc3QgZXhjbHVkZUtleXMgPSBbJ19fdHlwZV9fJywgJ2VuYWJsZWQnLCAnbm9kZScsICdfaWQnLCAnX19zY3JpcHRBc3NldCcsICd1dWlkJywgJ25hbWUnLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19lbmFibGVkJywgJ3R5cGUnLCAncmVhZG9ubHknLCAndmlzaWJsZScsICdjaWQnLCAnZWRpdG9yJywgJ2V4dGVuZHMnXTtcbiAgICBmb3IgKGNvbnN0IGtleSBpbiBjb21wb25lbnQpIHtcbiAgICAgICAgaWYgKCFleGNsdWRlS2V5cy5pbmNsdWRlcyhrZXkpICYmICFrZXkuc3RhcnRzV2l0aCgnXycpKSB7XG4gICAgICAgICAgICBwcm9wZXJ0aWVzW2tleV0gPSBjb21wb25lbnRba2V5XTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcHJvcGVydGllcztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQcm9wZXJ0eUFuYWx5c2lzUmVzdWx0IHtcbiAgICBleGlzdHM6IGJvb2xlYW47XG4gICAgdHlwZTogc3RyaW5nO1xuICAgIGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdO1xuICAgIG9yaWdpbmFsVmFsdWU6IGFueTtcbn1cblxuLyoqIFJldHVybnMgdHJ1ZSBpZiBwcm9wRGF0YSBsb29rcyBsaWtlIGEgQ29jb3MgQ3JlYXRvciBwcm9wZXJ0eSBkZXNjcmlwdG9yIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3IocHJvcERhdGE6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmICh0eXBlb2YgcHJvcERhdGEgIT09ICdvYmplY3QnIHx8IHByb3BEYXRhID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhKTtcbiAgICAgICAgLy8gU2tpcCBzaW1wbGUgdmFsdWUgb2JqZWN0cyBsaWtlIHt3aWR0aDogMjAwLCBoZWlnaHQ6IDE1MH1cbiAgICAgICAgY29uc3QgaXNTaW1wbGVWYWx1ZU9iamVjdCA9IGtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHYgPSBwcm9wRGF0YVtrZXldO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHYgPT09ICdib29sZWFuJztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpc1NpbXBsZVZhbHVlT2JqZWN0KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGhhc05hbWUgPSBrZXlzLmluY2x1ZGVzKCduYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1ZhbHVlID0ga2V5cy5pbmNsdWRlcygndmFsdWUnKTtcbiAgICAgICAgY29uc3QgaGFzVHlwZSA9IGtleXMuaW5jbHVkZXMoJ3R5cGUnKTtcbiAgICAgICAgY29uc3QgaGFzRGlzcGxheU5hbWUgPSBrZXlzLmluY2x1ZGVzKCdkaXNwbGF5TmFtZScpO1xuICAgICAgICBjb25zdCBoYXNSZWFkb25seSA9IGtleXMuaW5jbHVkZXMoJ3JlYWRvbmx5Jyk7XG4gICAgICAgIGNvbnN0IGhhc1ZhbGlkU3RydWN0dXJlID0gKGhhc05hbWUgfHwgaGFzVmFsdWUpICYmIChoYXNUeXBlIHx8IGhhc0Rpc3BsYXlOYW1lIHx8IGhhc1JlYWRvbmx5KTtcbiAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ2RlZmF1bHQnKSAmJiBwcm9wRGF0YS5kZWZhdWx0ICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgY29uc3QgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhwcm9wRGF0YS5kZWZhdWx0KTtcbiAgICAgICAgICAgIGlmIChkZWZhdWx0S2V5cy5pbmNsdWRlcygndmFsdWUnKSAmJiB0eXBlb2YgcHJvcERhdGEuZGVmYXVsdC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhc1ZhbGlkU3RydWN0dXJlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKiogQW5hbHl6ZSBhIGNvbXBvbmVudCdzIHByb3BlcnR5IHRvIGRldGVybWluZSBpdHMgdHlwZSBhbmQgY3VycmVudCB2YWx1ZS5cbiAqICBTdXBwb3J0cyBkb3R0ZWQgcHJvcGVydHlOYW1lIGZvciBuZXN0ZWQgQ0NDbGFzcyBncm91cHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVQcm9wZXJ0eShjb21wb25lbnQ6IGFueSwgcHJvcGVydHlOYW1lOiBzdHJpbmcpOiBQcm9wZXJ0eUFuYWx5c2lzUmVzdWx0IHtcbiAgICBjb25zdCBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxldCBwcm9wZXJ0eVZhbHVlOiBhbnkgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHByb3BlcnR5RXhpc3RzID0gZmFsc2U7XG5cbiAgICAvLyBNZXRob2QgMTogZGlyZWN0IHByb3BlcnR5IGFjY2VzcyAoZmxhdCBwYXRoIG9ubHkpXG4gICAgaWYgKCFwcm9wZXJ0eU5hbWUuaW5jbHVkZXMoJy4nKSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29tcG9uZW50LCBwcm9wZXJ0eU5hbWUpKSB7XG4gICAgICAgIHByb3BlcnR5VmFsdWUgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIE1ldGhvZCAyOiBzZWFyY2ggbmVzdGVkIHByb3BlcnRpZXMgc3RydWN0dXJlIChDb2NvcyBDcmVhdG9yIGNvbXBvbmVudCBkdW1wIGZvcm1hdCkuXG4gICAgLy8gIEZvciBkb3R0ZWQgbmFtZXMgbGlrZSBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiLCB3YWxrIHNlZ21lbnRzIHRocm91Z2ggbmVzdGVkIGAudmFsdWVgIGR1bXBzLlxuICAgIGlmICghcHJvcGVydHlFeGlzdHMgJiYgY29tcG9uZW50LnByb3BlcnRpZXMgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCByb290VmFsdWVPYmogPSBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSAmJiB0eXBlb2YgY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWUgPT09ICdvYmplY3QnXG4gICAgICAgICAgICA/IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlXG4gICAgICAgICAgICA6IGNvbXBvbmVudC5wcm9wZXJ0aWVzO1xuXG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHlOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBjdXJzb3I6IGFueSA9IHJvb3RWYWx1ZU9iajtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50ID0gc2VnbWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAvLyBQb3B1bGF0ZSBhdmFpbGFibGVQcm9wZXJ0aWVzIGF0IHRoZSByZWxldmFudCBsZXZlbCAocm9vdCBvciBmaW5hbCBjb250YWluZXIpXG4gICAgICAgICAgICBpZiAoaSA9PT0gMCB8fCAoaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhjdXJzb3IgfHwge30pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2ICYmIHR5cGVvZiB2ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gaSA9PT0gMCA/ICcnIDogYCR7c2VnbWVudHMuc2xpY2UoMCwgaSkuam9pbignLicpfS5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGAke3ByZWZpeH0ke2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBjdXJzb3IgPyBjdXJzb3Jbc2VnbWVudF0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaXNMZWFmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3IoZGVzY3JpcHRvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZEtleXMgPSBPYmplY3Qua2V5cyhkZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpID8gZGVzY3JpcHRvci52YWx1ZSA6IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHByb3BlcnR5RXhpc3RzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRGVzY2VuZCBpbnRvIHRoZSBuZXN0ZWQgQ0NDbGFzcyBncm91cDogZGVzY3JpcHRvci52YWx1ZSBob2xkcyB0aGUgaW5uZXIgZHVtcC5cbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gZGVzY3JpcHRvci52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNZXRob2QgMzogY29sbGVjdCBzaW1wbGUgcHJvcGVydHkgbmFtZXMgZnJvbSBkaXJlY3Qga2V5cyBhcyBmYWxsYmFja1xuICAgIGlmIChhdmFpbGFibGVQcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhjb21wb25lbnQpKSB7XG4gICAgICAgICAgICBpZiAoIWtleS5zdGFydHNXaXRoKCdfJykgJiYgIVsnX190eXBlX18nLCAnY2lkJywgJ25vZGUnLCAndXVpZCcsICduYW1lJywgJ2VuYWJsZWQnLCAndHlwZScsICdyZWFkb25seScsICd2aXNpYmxlJ10uaW5jbHVkZXMoa2V5KSkge1xuICAgICAgICAgICAgICAgIGF2YWlsYWJsZVByb3BlcnRpZXMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFwcm9wZXJ0eUV4aXN0cykge1xuICAgICAgICByZXR1cm4geyBleGlzdHM6IGZhbHNlLCB0eXBlOiAndW5rbm93bicsIGF2YWlsYWJsZVByb3BlcnRpZXMsIG9yaWdpbmFsVmFsdWU6IHVuZGVmaW5lZCB9O1xuICAgIH1cblxuICAgIC8vIEluZmVyIHR5cGUgZnJvbSB2YWx1ZSBzdHJ1Y3R1cmVcbiAgICBsZXQgdHlwZSA9ICd1bmtub3duJztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eVZhbHVlKSkge1xuICAgICAgICBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSkgdHlwZSA9ICdub2RlQXJyYXknO1xuICAgICAgICBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29sb3InKSkgdHlwZSA9ICdjb2xvckFycmF5JztcbiAgICAgICAgZWxzZSB0eXBlID0gJ2FycmF5JztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICB0eXBlID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkgPyAnYXNzZXQnIDogJ3N0cmluZyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdHlwZSA9ICdudW1iZXInO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICB0eXBlID0gJ2Jvb2xlYW4nO1xuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSAmJiB0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wZXJ0eVZhbHVlKTtcbiAgICAgICAgICAgIGlmIChrZXlzLmluY2x1ZGVzKCdyJykgJiYga2V5cy5pbmNsdWRlcygnZycpICYmIGtleXMuaW5jbHVkZXMoJ2InKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnY29sb3InO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd4JykgJiYga2V5cy5pbmNsdWRlcygneScpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IHByb3BlcnR5VmFsdWUueiAhPT0gdW5kZWZpbmVkID8gJ3ZlYzMnIDogJ3ZlYzInO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd3aWR0aCcpICYmIGtleXMuaW5jbHVkZXMoJ2hlaWdodCcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdzaXplJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygndXVpZCcpIHx8IGtleXMuaW5jbHVkZXMoJ19fdXVpZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpIHx8IGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSA/ICdub2RlJyA6ICdhc3NldCc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSA9PT0gbnVsbCB8fCBwcm9wZXJ0eVZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2Fzc2V0JztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29tcG9uZW50JykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29tcG9uZW50JztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGV4aXN0czogdHJ1ZSwgdHlwZSwgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogcHJvcGVydHlWYWx1ZSB9O1xufVxuXG4vKiogUGFyc2UgYSBoZXggY29sb3Igc3RyaW5nICgjUkdCIG9yICNSR0JBKSB0byBhbiBSR0JBIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29sb3JTdHJpbmcoY29sb3JTdHI6IHN0cmluZyk6IHsgcjogbnVtYmVyOyBnOiBudW1iZXI7IGI6IG51bWJlcjsgYTogbnVtYmVyIH0ge1xuICAgIGNvbnN0IHN0ciA9IGNvbG9yU3RyLnRyaW0oKTtcbiAgICBpZiAoc3RyLnN0YXJ0c1dpdGgoJyMnKSkge1xuICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gNykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiAyNTVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAoc3RyLmxlbmd0aCA9PT0gOSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDcsIDkpLCAxNilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNvbG9yIGZvcm1hdDogXCIke2NvbG9yU3RyfVwiLiBPbmx5IGhleGFkZWNpbWFsIGZvcm1hdCBpcyBzdXBwb3J0ZWQgKGUuZy4sIFwiI0ZGMDAwMFwiIG9yIFwiI0ZGMDAwMEZGXCIpYCk7XG59XG5cbi8qKlxuICogQ29jb3MgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5IHR5cGVzLiBFdmVyeSBvbmUgb2YgdGhlc2Ugc2VyaWFsaXplcyBpZGVudGljYWxseSBhc1xuICogYHsgdXVpZCB9YCAoaXNzdWUgIzI2IOKAlCBwcm9wZXJ0eVR5cGU9XCJtYXRlcmlhbFwiIGFuZCBmcmllbmRzIHByZXZpb3VzbHkgZmVsbCB0aHJvdWdoIHRvXG4gKiBgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZWAsIGV2ZW4gdGhvdWdoIHRoZSBleGlzdGluZyBzcHJpdGVGcmFtZS9wcmVmYWIvYXNzZXQgY29lcmNpb25cbiAqIGFscmVhZHkgcHJvZHVjZXMgdGhlIGNvcnJlY3Qgc2hhcGUgZm9yIHRoZW0pLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICdtYXRlcmlhbCcsICd0ZXh0dXJlJywgJ3Nwcml0ZUF0bGFzJywgJ2F1ZGlvQ2xpcCcsICdmb250JywgJ2FuaW1hdGlvbkNsaXAnLFxuICAgICdtZXNoJywgJ3NrZWxldG9uJywgJ3BoeXNpY3NNYXRlcmlhbCcsICdyZW5kZXJUZXh0dXJlJywgJ3RleHRBc3NldCcsICdqc29uQXNzZXQnLFxuICAgICdwYXJ0aWNsZUFzc2V0JywgJ3NjZW5lQXNzZXQnXG5dIGFzIGNvbnN0O1xuXG4vKipcbiAqIEV4cGxpY2l0IHByb3BlcnR5VHlwZSAtPiBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBSZXNvbHZlZCBmcm9tIHRoZSBwcm9wZXJ0eVR5cGUgaXRzZWxmLCBOT1QgZnJvbSB0aGUgcHJvcGVydHkgbmFtZS4gVGhlIGxlZ2FjeSBuYW1lLWJhc2VkXG4gKiBoZXVyaXN0aWMgaW4gYGFwcGx5UHJvcGVydHlUb0VkaXRvcmAgbWlzLXJlc29sdmVzIGFueSBhc3NldCBwcm9wZXJ0eSB3aG9zZSBuYW1lIGxhY2tzIHRoZVxuICogbWF0Y2hpbmcga2V5d29yZCDigJQgYSBgY2MuTWF0ZXJpYWxgIHByb3BlcnR5IGNhbGxlZCBgc2tpbmAgcmVzb2x2ZWQgdG8gYGNjLlNwcml0ZUZyYW1lYC5cbiAqXG4gKiBUaGUgZ2VuZXJpYyBgYXNzZXRgIGFuZCBgc3RyaW5nYCBzcGVsbGluZ3MgY2Fycnkgbm8gdHlwZSBpbmZvcm1hdGlvbiwgc28gdGhleSBkZWxpYmVyYXRlbHlcbiAqIGhhdmUgTk8gZW50cnkgaGVyZSBhbmQga2VlcCB1c2luZyB0aGUgbmFtZSBoZXVyaXN0aWMgKHVuY2hhbmdlZCBiZWhhdmlvdXIgZm9yIGV4aXN0aW5nIGNhbGxlcnMpLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFOiBSZWFkb25seTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHtcbiAgICBtYXRlcmlhbDogJ2NjLk1hdGVyaWFsJyxcbiAgICB0ZXh0dXJlOiAnY2MuVGV4dHVyZTJEJyxcbiAgICBzcHJpdGVGcmFtZTogJ2NjLlNwcml0ZUZyYW1lJyxcbiAgICBzcHJpdGVBdGxhczogJ2NjLlNwcml0ZUF0bGFzJyxcbiAgICBwcmVmYWI6ICdjYy5QcmVmYWInLFxuICAgIGF1ZGlvQ2xpcDogJ2NjLkF1ZGlvQ2xpcCcsXG4gICAgZm9udDogJ2NjLkZvbnQnLFxuICAgIGFuaW1hdGlvbkNsaXA6ICdjYy5BbmltYXRpb25DbGlwJyxcbiAgICBtZXNoOiAnY2MuTWVzaCcsXG4gICAgc2tlbGV0b246ICdjYy5Ta2VsZXRvbicsXG4gICAgcGh5c2ljc01hdGVyaWFsOiAnY2MuUGh5c2ljc01hdGVyaWFsJyxcbiAgICByZW5kZXJUZXh0dXJlOiAnY2MuUmVuZGVyVGV4dHVyZScsXG4gICAgdGV4dEFzc2V0OiAnY2MuVGV4dEFzc2V0JyxcbiAgICBqc29uQXNzZXQ6ICdjYy5Kc29uQXNzZXQnLFxuICAgIHBhcnRpY2xlQXNzZXQ6ICdjYy5QYXJ0aWNsZUFzc2V0JyxcbiAgICBzY2VuZUFzc2V0OiAnY2MuU2NlbmVBc3NldCdcbn07XG5cbi8qKiBFdmVyeSBwcm9wZXJ0eVR5cGUgY29udmVydFByb3BlcnR5VmFsdWUgYWNjZXB0cyDigJQgdXNlZCB0byBidWlsZCBhbiBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2UuICovXG5leHBvcnQgY29uc3QgU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2ludGVnZXInLCAnZmxvYXQnLCAnYm9vbGVhbicsXG4gICAgJ2NvbG9yJywgJ3ZlYzInLCAndmVjMycsICdzaXplJyxcbiAgICAnbm9kZScsICdjb21wb25lbnQnLFxuICAgIC4uLkFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyxcbiAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknLCAnY29tcG9uZW50QXJyYXknXG5dIGFzIGNvbnN0O1xuXG4vKipcbiAqIENvbnZlcnQgYSByYXcgTExNLXN1cHBsaWVkIHZhbHVlIHRvIHRoZSBjb3JyZWN0IGZvcm1hdCBmb3IgYSBnaXZlbiBwcm9wZXJ0eVR5cGUuXG4gKiBUaHJvd3MgaWYgdGhlIHZhbHVlIGZvcm1hdCBpcyBpbnZhbGlkIGZvciB0aGUgZ2l2ZW4gdHlwZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRQcm9wZXJ0eVZhbHVlKHByb3BlcnR5VHlwZTogc3RyaW5nLCB2YWx1ZTogYW55KTogYW55IHtcbiAgICBpZiAoKEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocHJvcGVydHlUeXBlKSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BlcnR5VHlwZX0gdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgIH1cbiAgICBzd2l0Y2ggKHByb3BlcnR5VHlwZSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gICAgICAgIGNhc2UgJ251bWJlcic6IGNhc2UgJ2ludGVnZXInOiBjYXNlICdmbG9hdCc6XG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICByZXR1cm4gQm9vbGVhbih2YWx1ZSk7XG4gICAgICAgIGNhc2UgJ2NvbG9yJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAvLyBJc3N1ZSAjNTI6IGEgSlNPTi1zdHJpbmcgdmFsdWUgKGUuZy4gJ3tcInJcIjoyNTUsXCJnXCI6MCxcImJcIjowfScpIHJlYWNoZXNcbiAgICAgICAgICAgICAgICAvLyB0aGlzIHBvaW50IGFzIGEgc3RyaW5nLiBBIGhleCBjb2xvciBzdHJpbmcgKGUuZy4gXCIjRkYwMDAwXCIpIGlzIE5PVFxuICAgICAgICAgICAgICAgIC8vIHZhbGlkIEpTT04sIHNvIHBhcnNlSnNvblBheWxvYWQgcmV0dXJucyBpdCB1bmNoYW5nZWQ7IG9ubHkgYSBKU09OIG9iamVjdFxuICAgICAgICAgICAgICAgIC8vIHN0cmluZyBjb2VyY2VzIHRvIGFuIG9iamVjdC4gVHJ5IHRoZSBKU09OIHBhdGggZmlyc3Qgc28gYm90aCBhIGhleFxuICAgICAgICAgICAgICAgIC8vIHN0cmluZyBhbmQgYSBKU09OLXN0cmluZyBvYmplY3QgbGFuZCBpbiB0aGUgcmlnaHQgYnJhbmNoLlxuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdzdHJpbmcnKSByZXR1cm4gcGFyc2VDb2xvclN0cmluZyhjb2VyY2VkKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQucikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5nKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGE6IGNvZXJjZWQuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5hKSkpIDogMjU1XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb2xvciB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHIsIGcsIGIgcHJvcGVydGllcyBvciBhIGhleGFkZWNpbWFsIHN0cmluZyAoZS5nLiwgXCIjRkYwMDAwXCIpIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICd2ZWMyJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSByZXR1cm4geyB4OiBOdW1iZXIoY29lcmNlZC54KSB8fCAwLCB5OiBOdW1iZXIoY29lcmNlZC55KSB8fCAwIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFZlYzIgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB4LCB5IHByb3BlcnRpZXMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3ZlYzMnOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcihjb2VyY2VkLngpIHx8IDAsIHk6IE51bWJlcihjb2VyY2VkLnkpIHx8IDAsIHo6IE51bWJlcihjb2VyY2VkLnopIHx8IDAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVjMyB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHksIHogcHJvcGVydGllcyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnc2l6ZSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkgcmV0dXJuIHsgd2lkdGg6IE51bWJlcihjb2VyY2VkLndpZHRoKSB8fCAwLCBoZWlnaHQ6IE51bWJlcihjb2VyY2VkLmhlaWdodCkgfHwgMCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTaXplIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggd2lkdGgsIGhlaWdodCBwcm9wZXJ0aWVzIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdub2RlJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlIHJlZmVyZW5jZSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIFVVSUQgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHZhbHVlOyAvLyByZXNvbHZlZCB0byBfX2lkX18gbGF0ZXJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50IHJlZmVyZW5jZSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIChub2RlIFVVSUQgY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudEFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHJldHVybiBpdGVtOyAvLyBlYWNoIHJlc29sdmVkIHRvIGEgY29tcG9uZW50IF9faWRfXyBsYXRlclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudEFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIG5vZGUgVVVJRHMgKGVhY2ggY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCkgKHJlY2VpdmVkIGl0ZW0gdHlwZW9mICR7dHlwZW9mIGl0ZW19KWApO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnRBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdub2RlQXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IHsgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogaXRlbSB9OyB0aHJvdyBuZXcgRXJyb3IoYE5vZGVBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBVVUlEcyAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7IH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29sb3JBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmIGl0ZW0gIT09IG51bGwgJiYgJ3InIGluIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0ucikgfHwgMCkpLCBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmcpIHx8IDApKSwgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5iKSB8fCAwKSksIGE6IGl0ZW0uYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5hKSkpIDogMjU1IH07XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcjogMjU1LCBnOiAyNTUsIGI6IDI1NSwgYTogMjU1IH07XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbG9yQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyQXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IE51bWJlcihpdGVtKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE51bWJlckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3N0cmluZ0FycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiBTdHJpbmcoaXRlbSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTdHJpbmdBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBwcm9wZXJ0eSB0eXBlOiAke3Byb3BlcnR5VHlwZX0uIFN1cHBvcnRlZCB0eXBlczogJHtTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMuam9pbignLCAnKX1gKTtcbiAgICB9XG59XG5cbi8qKiBHZW5lcmF0ZSBhbiBMTE0tZnJpZW5kbHkgc3VnZ2VzdGlvbiB3aGVuIHJlcXVlc3RlZCBjb21wb25lbnQgdHlwZSBpcyBub3QgZm91bmQgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24ocmVxdWVzdGVkVHlwZTogc3RyaW5nLCBhdmFpbGFibGVUeXBlczogc3RyaW5nW10sIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHNpbWlsYXJUeXBlcyA9IGF2YWlsYWJsZVR5cGVzLmZpbHRlcih0eXBlID0+XG4gICAgICAgIHR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhyZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkpIHx8XG4gICAgICAgIHJlcXVlc3RlZFR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0eXBlLnRvTG93ZXJDYXNlKCkpXG4gICAgKTtcblxuICAgIGxldCBpbnN0cnVjdGlvbiA9ICcnO1xuICAgIGlmIChzaW1pbGFyVHlwZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuRm91bmQgc2ltaWxhciBjb21wb25lbnRzOiAke3NpbWlsYXJUeXBlcy5qb2luKCcsICcpfWA7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0aW9uOiBQZXJoYXBzIHlvdSBtZWFudCAnJHtzaW1pbGFyVHlwZXNbMF19Jz9gO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3BlcnR5VG9Db21wb25lbnRNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICAgICAgJ3N0cmluZyc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnLCAnY2MuRWRpdEJveCddLFxuICAgICAgICAndGV4dCc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcbiAgICAgICAgJ2ZvbnRTaXplJzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCddLFxuICAgICAgICAnc3ByaXRlRnJhbWUnOiBbJ2NjLlNwcml0ZSddLFxuICAgICAgICAnY29sb3InOiBbJ2NjLkxhYmVsJywgJ2NjLlNwcml0ZScsICdjYy5HcmFwaGljcyddLFxuICAgICAgICAnbm9ybWFsQ29sb3InOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAncHJlc3NlZENvbG9yJzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ3RhcmdldCc6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICdjb250ZW50U2l6ZSc6IFsnY2MuVUlUcmFuc2Zvcm0nXSxcbiAgICAgICAgJ2FuY2hvclBvaW50JzogWydjYy5VSVRyYW5zZm9ybSddXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29tbWVuZGVkQ29tcG9uZW50cyA9IHByb3BlcnR5VG9Db21wb25lbnRNYXBbcHJvcGVydHldIHx8IFtdO1xuICAgIGNvbnN0IGF2YWlsYWJsZVJlY29tbWVuZGVkID0gcmVjb21tZW5kZWRDb21wb25lbnRzLmZpbHRlcihjb21wID0+IGF2YWlsYWJsZVR5cGVzLmluY2x1ZGVzKGNvbXApKTtcbiAgICBpZiAoYXZhaWxhYmxlUmVjb21tZW5kZWQubGVuZ3RoID4gMCkge1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuQmFzZWQgb24gcHJvcGVydHkgJyR7cHJvcGVydHl9JywgcmVjb21tZW5kZWQgY29tcG9uZW50czogJHthdmFpbGFibGVSZWNvbW1lbmRlZC5qb2luKCcsICcpfWA7XG4gICAgfVxuXG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3RlZCBBY3Rpb25zOmA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjEuIFVzZSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsIG5vZGVVdWlkPVwiLi4uXCIgdG8gdmlldyBhbGwgY29tcG9uZW50cyBvbiB0aGUgbm9kZWA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjIuIElmIHlvdSBuZWVkIHRvIGFkZCBhIGNvbXBvbmVudCwgdXNlIGFjdGlvbj1hZGQgd2l0aCBjb21wb25lbnRUeXBlPVwiJHtyZXF1ZXN0ZWRUeXBlfVwiYDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMy4gVmVyaWZ5IHRoYXQgdGhlIGNvbXBvbmVudCB0eXBlIG5hbWUgaXMgY29ycmVjdCAoY2FzZS1zZW5zaXRpdmUpYDtcblxuICAgIHJldHVybiBpbnN0cnVjdGlvbjtcbn1cblxuLyoqIFJldHVybiBhdmFpbGFibGUgQ29jb3MgQ3JlYXRvciBidWlsdC1pbiBjb21wb25lbnQgdHlwZXMgYnkgY2F0ZWdvcnkgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdChjYXRlZ29yeTogc3RyaW5nID0gJ2FsbCcpOiBBY3Rpb25Ub29sUmVzdWx0IHtcbiAgICBjb25zdCBjb21wb25lbnRDYXRlZ29yaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgIHJlbmRlcmVyOiBbJ2NjLlNwcml0ZScsICdjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCcsICdjYy5NYXNrJywgJ2NjLkdyYXBoaWNzJ10sXG4gICAgICAgIHVpOiBbJ2NjLkJ1dHRvbicsICdjYy5Ub2dnbGUnLCAnY2MuU2xpZGVyJywgJ2NjLlNjcm9sbFZpZXcnLCAnY2MuRWRpdEJveCcsICdjYy5Qcm9ncmVzc0JhciddLFxuICAgICAgICBwaHlzaWNzOiBbJ2NjLlJpZ2lkQm9keTJEJywgJ2NjLkJveENvbGxpZGVyMkQnLCAnY2MuQ2lyY2xlQ29sbGlkZXIyRCcsICdjYy5Qb2x5Z29uQ29sbGlkZXIyRCddLFxuICAgICAgICBhbmltYXRpb246IFsnY2MuQW5pbWF0aW9uJywgJ2NjLkFuaW1hdGlvbkNsaXAnLCAnY2MuU2tlbGV0YWxBbmltYXRpb24nXSxcbiAgICAgICAgYXVkaW86IFsnY2MuQXVkaW9Tb3VyY2UnXSxcbiAgICAgICAgbGF5b3V0OiBbJ2NjLkxheW91dCcsICdjYy5XaWRnZXQnLCAnY2MuUGFnZVZpZXcnLCAnY2MuUGFnZVZpZXdJbmRpY2F0b3InXSxcbiAgICAgICAgZWZmZWN0czogWydjYy5Nb3Rpb25TdHJlYWsnLCAnY2MuUGFydGljbGVTeXN0ZW0yRCddLFxuICAgICAgICBjYW1lcmE6IFsnY2MuQ2FtZXJhJ10sXG4gICAgICAgIGxpZ2h0OiBbJ2NjLkxpZ2h0JywgJ2NjLkRpcmVjdGlvbmFsTGlnaHQnLCAnY2MuUG9pbnRMaWdodCcsICdjYy5TcG90TGlnaHQnXVxuICAgIH07XG5cbiAgICBsZXQgY29tcG9uZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoY2F0ZWdvcnkgPT09ICdhbGwnKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2F0IGluIGNvbXBvbmVudENhdGVnb3JpZXMpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRzLmNvbmNhdChjb21wb25lbnRDYXRlZ29yaWVzW2NhdF0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRDYXRlZ29yaWVzW2NhdGVnb3J5XSkge1xuICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29tcG9uZW50cyB9KTtcbn1cblxuLyoqIFJlZGlyZWN0IHNldF9wcm9wZXJ0eSBjYWxscyB0aGF0IHRhcmdldCBub2RlLWxldmVsIHByb3BlcnRpZXMgdG8gdGhlIGNvcnJlY3QgbWFuYWdlX25vZGUgYWN0aW9uICovXG5leHBvcnQgZnVuY3Rpb24gcmVkaXJlY3ROb2RlUHJvcGVydHlBY2Nlc3MoYXJnczoge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7IGNvbXBvbmVudFR5cGU6IHN0cmluZzsgcHJvcGVydHk6IHN0cmluZzsgdmFsdWU6IGFueTtcbn0pOiBBY3Rpb25Ub29sUmVzdWx0IHwgbnVsbCB7XG4gICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHZhbHVlIH0gPSBhcmdzO1xuICAgIGNvbnN0IG5vZGVCYXNpY1Byb3BlcnRpZXMgPSBbJ25hbWUnLCAnYWN0aXZlJywgJ2xheWVyJywgJ21vYmlsaXR5JywgJ3BhcmVudCcsICdjaGlsZHJlbicsICdoaWRlRmxhZ3MnXTtcbiAgICBjb25zdCBub2RlVHJhbnNmb3JtUHJvcGVydGllcyA9IFsncG9zaXRpb24nLCAncm90YXRpb24nLCAnc2NhbGUnLCAnZXVsZXJBbmdsZXMnLCAnYW5nbGUnXTtcblxuICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuTm9kZScgfHwgY29tcG9uZW50VHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGlmIChub2RlQmFzaWNQcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIGJhc2ljIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfcHJvcGVydHkgd2l0aCB1dWlkPVwiJHtub2RlVXVpZH1cIiwgcHJvcGVydHk9XCIke3Byb3BlcnR5fVwiLCB2YWx1ZT0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIHRyYW5zZm9ybSBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogYFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3RyYW5zZm9ybSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCAke3Byb3BlcnR5fT0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKiBWZXJpZnkgYSBwcm9wZXJ0eSBjaGFuZ2Ugd2FzIGFwcGxpZWQ7IHVzZXMgZ2V0Q29tcG9uZW50SW5mbyBjYWxsYmFjayB0byBhdm9pZCBjaXJjdWxhciBkZXBzICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICBvcmlnaW5hbFZhbHVlOiBhbnksXG4gICAgZXhwZWN0ZWRWYWx1ZTogYW55LFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8eyB2ZXJpZmllZDogYm9vbGVhbjsgYWN0dWFsVmFsdWU6IGFueTsgZnVsbERhdGE6IGFueSB9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50SW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgICAgICBpZiAoY29tcG9uZW50SW5mby5zdWNjZXNzICYmIGNvbXBvbmVudEluZm8uZGF0YSkge1xuICAgICAgICAgICAgLy8gV2FsayBkb3R0ZWQgcHJvcGVydHkgcGF0aHMgdGhyb3VnaCBuZXN0ZWQgQ0NDbGFzcyBncm91cCBkdW1wcy5cbiAgICAgICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eURhdGE6IGFueSA9IGNvbXBvbmVudEluZm8uZGF0YS5wcm9wZXJ0aWVzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlEYXRhOyBpKyspIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBwcm9wZXJ0eURhdGFbc2VnbWVudHNbaV1dO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YS52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGE7XG4gICAgICAgICAgICBpZiAocHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhKSB7XG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGEudmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEV4dHJhY3RzIGEgcmVmZXJlbmNlJ3MgdXVpZCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIGVkaXRvcidzIGR1bXAgd3JhcHMgaXRcbiAgICAgICAgICAgIC8vIGFzIGEgcGxhaW4gc3RyaW5nICh7IHV1aWQ6ICd4JyB9KSBvciBhcyBhIG5lc3RlZCBsZWFmIGRlc2NyaXB0b3JcbiAgICAgICAgICAgIC8vICh7IHV1aWQ6IHsgdmFsdWU6ICd4JyB9IH0pIOKAlCB0aGUgc2FtZSBhbWJpZ3VpdHkgdGhlIHNpbmdsZS1yZWZlcmVuY2UgYnJhbmNoXG4gICAgICAgICAgICAvLyBiZWxvdyBhbHJlYWR5IHRvbGVyYXRlcy5cbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RVdWlkID0gKHJlZjogYW55KTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlZiB8fCB0eXBlb2YgcmVmICE9PSAnb2JqZWN0JyB8fCAhKCd1dWlkJyBpbiByZWYpKSByZXR1cm4gJyc7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gcmVmLnV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKHJhdyAmJiB0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHJhdykgcmV0dXJuIHJhdy52YWx1ZSB8fCAnJztcbiAgICAgICAgICAgICAgICByZXR1cm4gcmF3IHx8ICcnO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgbGV0IHZlcmlmaWVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShleHBlY3RlZFZhbHVlKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vZGVBcnJheSAvIGNvbXBvbmVudEFycmF5OiBldmVyeSBlbGVtZW50IGlzIGl0c2VsZiBhIHsgdXVpZCB9IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICAvLyBDb21wYXJlIGJ5IHBlci1lbGVtZW50IHV1aWQgKG9yZGVyLXByZXNlcnZpbmcpLCBuZXZlciBieSBkZWVwLWVxdWFsaW5nIHRoZVxuICAgICAgICAgICAgICAgIC8vIHdob2xlIGFycmF5IOKAlCB0aGUgZWRpdG9yJ3MgcmVhZC1iYWNrIGR1bXAgbWF5IGNhcnJ5IGV4dHJhIHBlci1lbGVtZW50XG4gICAgICAgICAgICAgICAgLy8gbWV0YWRhdGEgKGUuZy4gYW4gaW50ZXJuYWwgb2JqZWN0IGlkKSB0aGF0IGEgcGxhaW4gY29tcG9uZW50L25vZGUgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgLy8gd3JpdGUgbmV2ZXIgaW5jbHVkZWQsIHdoaWNoIHdvdWxkIGZhaWwgYSBKU09OLnN0cmluZ2lmeSBjb21wYXJpc29uIGV2ZW5cbiAgICAgICAgICAgICAgICAvLyB0aG91Z2ggZXZlcnkgcmVmZXJlbmNlIHJlc29sdmVkIGNvcnJlY3RseS5cbiAgICAgICAgICAgICAgICBjb25zdCBhY3R1YWxBcnIgPSBBcnJheS5pc0FycmF5KGFjdHVhbFZhbHVlKSA/IGFjdHVhbFZhbHVlIDogW107XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxBcnIubGVuZ3RoID09PSBleHBlY3RlZFZhbHVlLmxlbmd0aCAmJlxuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZFZhbHVlLmV2ZXJ5KChleHA6IGFueSwgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4cFV1aWQgPSBleHRyYWN0VXVpZChleHApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cFV1aWQgIT09ICcnICYmIGV4cFV1aWQgPT09IGV4dHJhY3RVdWlkKGFjdHVhbEFycltpZHhdKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlID09PSAnb2JqZWN0JyAmJiBleHBlY3RlZFZhbHVlICE9PSBudWxsICYmICd1dWlkJyBpbiBleHBlY3RlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWN0dWFsVXVpZCA9IGFjdHVhbFZhbHVlICYmIHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIGFjdHVhbFZhbHVlID8gYWN0dWFsVmFsdWUudXVpZCA6ICcnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVXVpZCA9IGV4cGVjdGVkVmFsdWUudXVpZCB8fCAnJztcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFV1aWQgPT09IGV4cGVjdGVkVXVpZCAmJiBleHBlY3RlZFV1aWQgIT09ICcnO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsVmFsdWUgPT09IHR5cGVvZiBleHBlY3RlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gJ29iamVjdCcgJiYgYWN0dWFsVmFsdWUgIT09IG51bGwgJiYgZXhwZWN0ZWRWYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IEpTT04uc3RyaW5naWZ5KGFjdHVhbFZhbHVlKSA9PT0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxWYWx1ZSA9PT0gZXhwZWN0ZWRWYWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gU3RyaW5nKGFjdHVhbFZhbHVlKSA9PT0gU3RyaW5nKGV4cGVjdGVkVmFsdWUpIHx8IE51bWJlcihhY3R1YWxWYWx1ZSkgPT09IE51bWJlcihleHBlY3RlZFZhbHVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCxcbiAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZSxcbiAgICAgICAgICAgICAgICBmdWxsRGF0YToge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZFByb3BlcnR5OiB7IG5hbWU6IHByb3BlcnR5LCBiZWZvcmU6IG9yaWdpbmFsVmFsdWUsIGV4cGVjdGVkOiBleHBlY3RlZFZhbHVlLCBhY3R1YWw6IGFjdHVhbFZhbHVlLCB2ZXJpZmllZCB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRTdW1tYXJ5OiB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCB0b3RhbFByb3BlcnRpZXM6IE9iamVjdC5rZXlzKGNvbXBvbmVudEluZm8uZGF0YT8ucHJvcGVydGllcyB8fCB7fSkubGVuZ3RoIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hbmFnZUNvbXBvbmVudC52ZXJpZnlQcm9wZXJ0eUNoYW5nZV0gVmVyaWZpY2F0aW9uIGZhaWxlZDonLCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB7IHZlcmlmaWVkOiBmYWxzZSwgYWN0dWFsVmFsdWU6IHVuZGVmaW5lZCwgZnVsbERhdGE6IG51bGwgfTtcbn1cbiJdfQ==