"use strict";
/**
 * Pure helper functions for component property analysis, validation, and query utilities.
 * Extracted from ManageComponent to keep manage-component.ts under 200 lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_PROPERTY_TYPES = exports.ASSET_TYPE_BY_PROPERTY_TYPE = exports.ASSET_REFERENCE_PROPERTY_TYPES = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFhSCw4REEwQkM7QUFJRCwwQ0F1SEM7QUFHRCw0Q0FvQkM7QUF5REQsb0RBZ0dDO0FBR0Qsa0VBcUNDO0FBR0QsZ0VBdUJDO0FBR0QsZ0VBd0JDO0FBR0Qsc0VBOEVDO0FBOWZELG9DQUEyRDtBQUMzRCxrREFBc0Q7QUFTdEQscUZBQXFGO0FBQ3JGLFNBQWdCLHlCQUF5QixDQUFDLFFBQWE7SUFDbkQsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksUUFBUSxLQUFLLElBQUk7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUNwRSxJQUFJLENBQUM7UUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25DLDJEQUEyRDtRQUMzRCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDekMsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hCLE9BQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDcEYsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLG1CQUFtQjtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxD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LE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFB1cmUgaGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tcG9uZW50IHByb3BlcnR5IGFuYWx5c2lzLCB2YWxpZGF0aW9uLCBhbmQgcXVlcnkgdXRpbGl0aWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50IHRvIGtlZXAgbWFuYWdlLWNvbXBvbmVudC50cyB1bmRlciAyMDAgbGluZXMuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHBhcnNlSnNvblBheWxvYWQgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGV4aXN0czogYm9vbGVhbjtcbiAgICB0eXBlOiBzdHJpbmc7XG4gICAgYXZhaWxhYmxlUHJvcGVydGllczogc3RyaW5nW107XG4gICAgb3JpZ2luYWxWYWx1ZTogYW55O1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHByb3BEYXRhIGxvb2tzIGxpa2UgYSBDb2NvcyBDcmVhdG9yIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihwcm9wRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcgfHwgcHJvcERhdGEgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcERhdGEpO1xuICAgICAgICAvLyBTa2lwIHNpbXBsZSB2YWx1ZSBvYmplY3RzIGxpa2Uge3dpZHRoOiAyMDAsIGhlaWdodDogMTUwfVxuICAgICAgICBjb25zdCBpc1NpbXBsZVZhbHVlT2JqZWN0ID0ga2V5cy5ldmVyeShrZXkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdiA9IHByb3BEYXRhW2tleV07XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGlzU2ltcGxlVmFsdWVPYmplY3QpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgaGFzTmFtZSA9IGtleXMuaW5jbHVkZXMoJ25hbWUnKTtcbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSBrZXlzLmluY2x1ZGVzKCd2YWx1ZScpO1xuICAgICAgICBjb25zdCBoYXNUeXBlID0ga2V5cy5pbmNsdWRlcygndHlwZScpO1xuICAgICAgICBjb25zdCBoYXNEaXNwbGF5TmFtZSA9IGtleXMuaW5jbHVkZXMoJ2Rpc3BsYXlOYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1JlYWRvbmx5ID0ga2V5cy5pbmNsdWRlcygncmVhZG9ubHknKTtcbiAgICAgICAgY29uc3QgaGFzVmFsaWRTdHJ1Y3R1cmUgPSAoaGFzTmFtZSB8fCBoYXNWYWx1ZSkgJiYgKGhhc1R5cGUgfHwgaGFzRGlzcGxheU5hbWUgfHwgaGFzUmVhZG9ubHkpO1xuICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygnZGVmYXVsdCcpICYmIHByb3BEYXRhLmRlZmF1bHQgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhLmRlZmF1bHQpO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0LnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiBoYXNWYWxpZFN0cnVjdHVyZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qKiBBbmFseXplIGEgY29tcG9uZW50J3MgcHJvcGVydHkgdG8gZGV0ZXJtaW5lIGl0cyB0eXBlIGFuZCBjdXJyZW50IHZhbHVlLlxuICogIFN1cHBvcnRzIGRvdHRlZCBwcm9wZXJ0eU5hbWUgZm9yIG5lc3RlZCBDQ0NsYXNzIGdyb3VwcyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuICovXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVByb3BlcnR5KGNvbXBvbmVudDogYW55LCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGNvbnN0IGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcbiAgICBsZXQgcHJvcGVydHlFeGlzdHMgPSBmYWxzZTtcblxuICAgIC8vIE1ldGhvZCAxOiBkaXJlY3QgcHJvcGVydHkgYWNjZXNzIChmbGF0IHBhdGggb25seSlcbiAgICBpZiAoIXByb3BlcnR5TmFtZS5pbmNsdWRlcygnLicpICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb21wb25lbnQsIHByb3BlcnR5TmFtZSkpIHtcbiAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGNvbXBvbmVudFtwcm9wZXJ0eU5hbWVdO1xuICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gTWV0aG9kIDI6IHNlYXJjaCBuZXN0ZWQgcHJvcGVydGllcyBzdHJ1Y3R1cmUgKENvY29zIENyZWF0b3IgY29tcG9uZW50IGR1bXAgZm9ybWF0KS5cbiAgICAvLyAgRm9yIGRvdHRlZCBuYW1lcyBsaWtlIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIsIHdhbGsgc2VnbWVudHMgdGhyb3VnaCBuZXN0ZWQgYC52YWx1ZWAgZHVtcHMuXG4gICAgaWYgKCFwcm9wZXJ0eUV4aXN0cyAmJiBjb21wb25lbnQucHJvcGVydGllcyAmJiB0eXBlb2YgY29tcG9uZW50LnByb3BlcnRpZXMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IHJvb3RWYWx1ZU9iaiA9IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSA9PT0gJ29iamVjdCdcbiAgICAgICAgICAgID8gY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWVcbiAgICAgICAgICAgIDogY29tcG9uZW50LnByb3BlcnRpZXM7XG5cbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eU5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbGV0IGN1cnNvcjogYW55ID0gcm9vdFZhbHVlT2JqO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNlZ21lbnQgPSBzZWdtZW50c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgICAgIC8vIFBvcHVsYXRlIGF2YWlsYWJsZVByb3BlcnRpZXMgYXQgdGhlIHJlbGV2YW50IGxldmVsIChyb290IG9yIGZpbmFsIGNvbnRhaW5lcilcbiAgICAgICAgICAgIGlmIChpID09PSAwIHx8IChpID09PSBzZWdtZW50cy5sZW5ndGggLSAxKSkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGN1cnNvciB8fCB7fSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHYgJiYgdHlwZW9mIHYgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBpID09PSAwID8gJycgOiBgJHtzZWdtZW50cy5zbGljZSgwLCBpKS5qb2luKCcuJyl9LmA7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVQcm9wZXJ0aWVzLnB1c2goYCR7cHJlZml4fSR7a31gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IGN1cnNvciA/IGN1cnNvcltzZWdtZW50XSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc0xlYWYpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihkZXNjcmlwdG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkS2V5cyA9IE9iamVjdC5rZXlzKGRlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZEtleXMuaW5jbHVkZXMoJ3ZhbHVlJykgPyBkZXNjcmlwdG9yLnZhbHVlIDogZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEZXNjZW5kIGludG8gdGhlIG5lc3RlZCBDQ0NsYXNzIGdyb3VwOiBkZXNjcmlwdG9yLnZhbHVlIGhvbGRzIHRoZSBpbm5lciBkdW1wLlxuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvci52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSBkZXNjcmlwdG9yLnZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ldGhvZCAzOiBjb2xsZWN0IHNpbXBsZSBwcm9wZXJ0eSBuYW1lcyBmcm9tIGRpcmVjdCBrZXlzIGFzIGZhbGxiYWNrXG4gICAgaWYgKGF2YWlsYWJsZVByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGNvbXBvbmVudCkpIHtcbiAgICAgICAgICAgIGlmICgha2V5LnN0YXJ0c1dpdGgoJ18nKSAmJiAhWydfX3R5cGVfXycsICdjaWQnLCAnbm9kZScsICd1dWlkJywgJ25hbWUnLCAnZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnXS5pbmNsdWRlcyhrZXkpKSB7XG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByb3BlcnR5RXhpc3RzKSB7XG4gICAgICAgIHJldHVybiB7IGV4aXN0czogZmFsc2UsIHR5cGU6ICd1bmtub3duJywgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogdW5kZWZpbmVkIH07XG4gICAgfVxuXG4gICAgLy8gSW5mZXIgdHlwZSBmcm9tIHZhbHVlIHN0cnVjdHVyZVxuICAgIGxldCB0eXBlID0gJ3Vua25vd24nO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5VmFsdWUpKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpKSB0eXBlID0gJ25vZGVBcnJheSc7XG4gICAgICAgIGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb2xvcicpKSB0eXBlID0gJ2NvbG9yQXJyYXknO1xuICAgICAgICBlbHNlIHR5cGUgPSAnYXJyYXknO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHR5cGUgPSBbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddLmluY2x1ZGVzKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpKSA/ICdhc3NldCcgOiAnc3RyaW5nJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICB0eXBlID0gJ251bWJlcic7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHR5cGUgPSAnYm9vbGVhbic7XG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlICYmIHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb3BlcnR5VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ3InKSAmJiBrZXlzLmluY2x1ZGVzKCdnJykgJiYga2V5cy5pbmNsdWRlcygnYicpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdjb2xvcic7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3gnKSAmJiBrZXlzLmluY2x1ZGVzKCd5JykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gcHJvcGVydHlWYWx1ZS56ICE9PSB1bmRlZmluZWQgPyAndmVjMycgOiAndmVjMic7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3dpZHRoJykgJiYga2V5cy5pbmNsdWRlcygnaGVpZ2h0JykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ3NpemUnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd1dWlkJykgfHwga2V5cy5pbmNsdWRlcygnX191dWlkX18nKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSB8fCBwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGFyZ2V0JykgfHwga2V5cy5pbmNsdWRlcygnX19pZF9fJykpID8gJ25vZGUnIDogJ2Fzc2V0JztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygnX19pZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ29iamVjdCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlID09PSBudWxsIHx8IHByb3BlcnR5VmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnYXNzZXQnO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb21wb25lbnQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdjb21wb25lbnQnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgZXhpc3RzOiB0cnVlLCB0eXBlLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiBwcm9wZXJ0eVZhbHVlIH07XG59XG5cbi8qKiBQYXJzZSBhIGhleCBjb2xvciBzdHJpbmcgKCNSR0Igb3IgI1JHQkEpIHRvIGFuIFJHQkEgb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb2xvclN0cmluZyhjb2xvclN0cjogc3RyaW5nKTogeyByOiBudW1iZXI7IGc6IG51bWJlcjsgYjogbnVtYmVyOyBhOiBudW1iZXIgfSB7XG4gICAgY29uc3Qgc3RyID0gY29sb3JTdHIudHJpbSgpO1xuICAgIGlmIChzdHIuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICAgIGlmIChzdHIubGVuZ3RoID09PSA3KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXG4gICAgICAgICAgICAgICAgYjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg1LCA3KSwgMTYpLFxuICAgICAgICAgICAgICAgIGE6IDI1NVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChzdHIubGVuZ3RoID09PSA5KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXG4gICAgICAgICAgICAgICAgYjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg1LCA3KSwgMTYpLFxuICAgICAgICAgICAgICAgIGE6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNywgOSksIDE2KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY29sb3IgZm9ybWF0OiBcIiR7Y29sb3JTdHJ9XCIuIE9ubHkgaGV4YWRlY2ltYWwgZm9ybWF0IGlzIHN1cHBvcnRlZCAoZS5nLiwgXCIjRkYwMDAwXCIgb3IgXCIjRkYwMDAwRkZcIilgKTtcbn1cblxuLyoqXG4gKiBDb2NvcyBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHkgdHlwZXMuIEV2ZXJ5IG9uZSBvZiB0aGVzZSBzZXJpYWxpemVzIGlkZW50aWNhbGx5IGFzXG4gKiBgeyB1dWlkIH1gIChpc3N1ZSAjMjYg4oCUIHByb3BlcnR5VHlwZT1cIm1hdGVyaWFsXCIgYW5kIGZyaWVuZHMgcHJldmlvdXNseSBmZWxsIHRocm91Z2ggdG9cbiAqIGBVbnN1cHBvcnRlZCBwcm9wZXJ0eSB0eXBlYCwgZXZlbiB0aG91Z2ggdGhlIGV4aXN0aW5nIHNwcml0ZUZyYW1lL3ByZWZhYi9hc3NldCBjb2VyY2lvblxuICogYWxyZWFkeSBwcm9kdWNlcyB0aGUgY29ycmVjdCBzaGFwZSBmb3IgdGhlbSkuXG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgPSBbXG4gICAgJ3Nwcml0ZUZyYW1lJywgJ3ByZWZhYicsICdhc3NldCcsXG4gICAgJ21hdGVyaWFsJywgJ3RleHR1cmUnLCAnc3ByaXRlQXRsYXMnLCAnYXVkaW9DbGlwJywgJ2ZvbnQnLCAnYW5pbWF0aW9uQ2xpcCcsXG4gICAgJ21lc2gnLCAnc2tlbGV0b24nLCAncGh5c2ljc01hdGVyaWFsJywgJ3JlbmRlclRleHR1cmUnLCAndGV4dEFzc2V0JywgJ2pzb25Bc3NldCcsXG4gICAgJ3BhcnRpY2xlQXNzZXQnLCAnc2NlbmVBc3NldCdcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogRXhwbGljaXQgcHJvcGVydHlUeXBlIC0+IENvY29zIGFzc2V0IGNsYXNzIGZvciB0aGUgRWRpdG9yIGBzZXQtcHJvcGVydHlgIGR1bXAgYHR5cGVgIGZpZWxkLlxuICpcbiAqIFJlc29sdmVkIGZyb20gdGhlIHByb3BlcnR5VHlwZSBpdHNlbGYsIE5PVCBmcm9tIHRoZSBwcm9wZXJ0eSBuYW1lLiBUaGUgbGVnYWN5IG5hbWUtYmFzZWRcbiAqIGhldXJpc3RpYyBpbiBgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yYCBtaXMtcmVzb2x2ZXMgYW55IGFzc2V0IHByb3BlcnR5IHdob3NlIG5hbWUgbGFja3MgdGhlXG4gKiBtYXRjaGluZyBrZXl3b3JkIOKAlCBhIGBjYy5NYXRlcmlhbGAgcHJvcGVydHkgY2FsbGVkIGBza2luYCByZXNvbHZlZCB0byBgY2MuU3ByaXRlRnJhbWVgLlxuICpcbiAqIFRoZSBnZW5lcmljIGBhc3NldGAgYW5kIGBzdHJpbmdgIHNwZWxsaW5ncyBjYXJyeSBubyB0eXBlIGluZm9ybWF0aW9uLCBzbyB0aGV5IGRlbGliZXJhdGVseVxuICogaGF2ZSBOTyBlbnRyeSBoZXJlIGFuZCBrZWVwIHVzaW5nIHRoZSBuYW1lIGhldXJpc3RpYyAodW5jaGFuZ2VkIGJlaGF2aW91ciBmb3IgZXhpc3RpbmcgY2FsbGVycykuXG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEU6IFJlYWRvbmx5PFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xuICAgIG1hdGVyaWFsOiAnY2MuTWF0ZXJpYWwnLFxuICAgIHRleHR1cmU6ICdjYy5UZXh0dXJlMkQnLFxuICAgIHNwcml0ZUZyYW1lOiAnY2MuU3ByaXRlRnJhbWUnLFxuICAgIHNwcml0ZUF0bGFzOiAnY2MuU3ByaXRlQXRsYXMnLFxuICAgIHByZWZhYjogJ2NjLlByZWZhYicsXG4gICAgYXVkaW9DbGlwOiAnY2MuQXVkaW9DbGlwJyxcbiAgICBmb250OiAnY2MuRm9udCcsXG4gICAgYW5pbWF0aW9uQ2xpcDogJ2NjLkFuaW1hdGlvbkNsaXAnLFxuICAgIG1lc2g6ICdjYy5NZXNoJyxcbiAgICBza2VsZXRvbjogJ2NjLlNrZWxldG9uJyxcbiAgICBwaHlzaWNzTWF0ZXJpYWw6ICdjYy5QaHlzaWNzTWF0ZXJpYWwnLFxuICAgIHJlbmRlclRleHR1cmU6ICdjYy5SZW5kZXJUZXh0dXJlJyxcbiAgICB0ZXh0QXNzZXQ6ICdjYy5UZXh0QXNzZXQnLFxuICAgIGpzb25Bc3NldDogJ2NjLkpzb25Bc3NldCcsXG4gICAgcGFydGljbGVBc3NldDogJ2NjLlBhcnRpY2xlQXNzZXQnLFxuICAgIHNjZW5lQXNzZXQ6ICdjYy5TY2VuZUFzc2V0J1xufTtcblxuLyoqIEV2ZXJ5IHByb3BlcnR5VHlwZSBjb252ZXJ0UHJvcGVydHlWYWx1ZSBhY2NlcHRzIOKAlCB1c2VkIHRvIGJ1aWxkIGFuIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZS4gKi9cbmV4cG9ydCBjb25zdCBTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMgPSBbXG4gICAgJ3N0cmluZycsICdudW1iZXInLCAnaW50ZWdlcicsICdmbG9hdCcsICdib29sZWFuJyxcbiAgICAnY29sb3InLCAndmVjMicsICd2ZWMzJywgJ3NpemUnLFxuICAgICdub2RlJywgJ2NvbXBvbmVudCcsXG4gICAgLi4uQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTLFxuICAgICdub2RlQXJyYXknLCAnY29sb3JBcnJheScsICdudW1iZXJBcnJheScsICdzdHJpbmdBcnJheScsICdjb21wb25lbnRBcnJheSdcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogQ29udmVydCBhIHJhdyBMTE0tc3VwcGxpZWQgdmFsdWUgdG8gdGhlIGNvcnJlY3QgZm9ybWF0IGZvciBhIGdpdmVuIHByb3BlcnR5VHlwZS5cbiAqIFRocm93cyBpZiB0aGUgdmFsdWUgZm9ybWF0IGlzIGludmFsaWQgZm9yIHRoZSBnaXZlbiB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIFVVSUQgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgfVxuICAgIHN3aXRjaCAocHJvcGVydHlUeXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzogY2FzZSAnaW50ZWdlcic6IGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIHJldHVybiBOdW1iZXIodmFsdWUpO1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgIHJldHVybiBCb29sZWFuKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIC8vIElzc3VlICM1MjogYSBKU09OLXN0cmluZyB2YWx1ZSAoZS5nLiAne1wiclwiOjI1NSxcImdcIjowLFwiYlwiOjB9JykgcmVhY2hlc1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgcG9pbnQgYXMgYSBzdHJpbmcuIEEgaGV4IGNvbG9yIHN0cmluZyAoZS5nLiBcIiNGRjAwMDBcIikgaXMgTk9UXG4gICAgICAgICAgICAgICAgLy8gdmFsaWQgSlNPTiwgc28gcGFyc2VKc29uUGF5bG9hZCByZXR1cm5zIGl0IHVuY2hhbmdlZDsgb25seSBhIEpTT04gb2JqZWN0XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGNvZXJjZXMgdG8gYW4gb2JqZWN0LiBUcnkgdGhlIEpTT04gcGF0aCBmaXJzdCBzbyBib3RoIGEgaGV4XG4gICAgICAgICAgICAgICAgLy8gc3RyaW5nIGFuZCBhIEpTT04tc3RyaW5nIG9iamVjdCBsYW5kIGluIHRoZSByaWdodCBicmFuY2guXG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ3N0cmluZycpIHJldHVybiBwYXJzZUNvbG9yU3RyaW5nKGNvZXJjZWQpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoY29lcmNlZC5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGNvZXJjZWQuYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYTogY29lcmNlZC5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihjb2VyY2VkLmEpKSkgOiAyNTVcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbG9yIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggciwgZywgYiBwcm9wZXJ0aWVzIG9yIGEgaGV4YWRlY2ltYWwgc3RyaW5nIChlLmcuLCBcIiNGRjAwMDBcIikgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ3ZlYzInOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvZXJjZWQgPT09ICdvYmplY3QnICYmIGNvZXJjZWQgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcihjb2VyY2VkLngpIHx8IDAsIHk6IE51bWJlcihjb2VyY2VkLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVmVjMiB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHkgcHJvcGVydGllcyAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAndmVjMyc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29lcmNlZCA9PT0gJ29iamVjdCcgJiYgY29lcmNlZCAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKGNvZXJjZWQueCkgfHwgMCwgeTogTnVtYmVyKGNvZXJjZWQueSkgfHwgMCwgejogTnVtYmVyKGNvZXJjZWQueikgfHwgMCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBWZWMzIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSwgeiBwcm9wZXJ0aWVzIChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdzaXplJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb2VyY2VkID09PSAnb2JqZWN0JyAmJiBjb2VyY2VkICE9PSBudWxsKSByZXR1cm4geyB3aWR0aDogTnVtYmVyKGNvZXJjZWQud2lkdGgpIHx8IDAsIGhlaWdodDogTnVtYmVyKGNvZXJjZWQuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFNpemUgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB3aWR0aCwgaGVpZ2h0IHByb3BlcnRpZXMgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGUnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IHZhbHVlIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRCAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50JzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4gdmFsdWU7IC8vIHJlc29sdmVkIHRvIF9faWRfXyBsYXRlclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21wb25lbnQgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgKG5vZGUgVVVJRCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50QXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIGl0ZW07IC8vIGVhY2ggcmVzb2x2ZWQgdG8gYSBjb21wb25lbnQgX19pZF9fIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29tcG9uZW50QXJyYXkgaXRlbXMgbXVzdCBiZSBzdHJpbmcgbm9kZSBVVUlEcyAoZWFjaCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50KSAocmVjZWl2ZWQgaXRlbSB0eXBlb2YgJHt0eXBlb2YgaXRlbX0pYCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBvbmVudEFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGNhc2UgJ25vZGVBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4geyBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07IHRocm93IG5ldyBFcnJvcihgTm9kZUFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIFVVSURzIChyZWNlaXZlZCBpdGVtIHR5cGVvZiAke3R5cGVvZiBpdGVtfSlgKTsgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGVBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdjb2xvckFycmF5JzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb2VyY2VkID0gcGFyc2VKc29uUGF5bG9hZCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29lcmNlZCkpIHJldHVybiBjb2VyY2VkLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHsgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5yKSB8fCAwKSksIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uZykgfHwgMCkpLCBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmIpIHx8IDApKSwgYTogaXRlbS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmEpKSkgOiAyNTUgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ29sb3JBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5IChyZWNlaXZlZCB0eXBlb2YgJHt0eXBlb2YgdmFsdWV9KWApO1xuICAgICAgICBjYXNlICdudW1iZXJBcnJheSc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29lcmNlZCA9IHBhcnNlSnNvblBheWxvYWQodmFsdWUpO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvZXJjZWQpKSByZXR1cm4gY29lcmNlZC5tYXAoKGl0ZW06IGFueSkgPT4gTnVtYmVyKGl0ZW0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTnVtYmVyQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheSAocmVjZWl2ZWQgdHlwZW9mICR7dHlwZW9mIHZhbHVlfSlgKTtcbiAgICAgICAgY2FzZSAnc3RyaW5nQXJyYXknOlxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvZXJjZWQgPSBwYXJzZUpzb25QYXlsb2FkKHZhbHVlKTtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShjb2VyY2VkKSkgcmV0dXJuIGNvZXJjZWQubWFwKChpdGVtOiBhbnkpID0+IFN0cmluZyhpdGVtKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFN0cmluZ0FycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXkgKHJlY2VpdmVkIHR5cGVvZiAke3R5cGVvZiB2YWx1ZX0pYCk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIHByb3BlcnR5IHR5cGU6ICR7cHJvcGVydHlUeXBlfS4gU3VwcG9ydGVkIHR5cGVzOiAke1NVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUy5qb2luKCcsICcpfWApO1xuICAgIH1cbn1cblxuLyoqIEdlbmVyYXRlIGFuIExMTS1mcmllbmRseSBzdWdnZXN0aW9uIHdoZW4gcmVxdWVzdGVkIGNvbXBvbmVudCB0eXBlIGlzIG5vdCBmb3VuZCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbihyZXF1ZXN0ZWRUeXBlOiBzdHJpbmcsIGF2YWlsYWJsZVR5cGVzOiBzdHJpbmdbXSwgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgY29uc3Qgc2ltaWxhclR5cGVzID0gYXZhaWxhYmxlVHlwZXMuZmlsdGVyKHR5cGUgPT5cbiAgICAgICAgdHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHJlcXVlc3RlZFR5cGUudG9Mb3dlckNhc2UoKSkgfHxcbiAgICAgICAgcmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHR5cGUudG9Mb3dlckNhc2UoKSlcbiAgICApO1xuXG4gICAgbGV0IGluc3RydWN0aW9uID0gJyc7XG4gICAgaWYgKHNpbWlsYXJUeXBlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5Gb3VuZCBzaW1pbGFyIGNvbXBvbmVudHM6ICR7c2ltaWxhclR5cGVzLmpvaW4oJywgJyl9YDtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3Rpb246IFBlcmhhcHMgeW91IG1lYW50ICcke3NpbWlsYXJUeXBlc1swXX0nP2A7XG4gICAgfVxuXG4gICAgY29uc3QgcHJvcGVydHlUb0NvbXBvbmVudE1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICAnc3RyaW5nJzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCcsICdjYy5FZGl0Qm94J10sXG4gICAgICAgICd0ZXh0JzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCddLFxuICAgICAgICAnZm9udFNpemUnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXG4gICAgICAgICdzcHJpdGVGcmFtZSc6IFsnY2MuU3ByaXRlJ10sXG4gICAgICAgICdjb2xvcic6IFsnY2MuTGFiZWwnLCAnY2MuU3ByaXRlJywgJ2NjLkdyYXBoaWNzJ10sXG4gICAgICAgICdub3JtYWxDb2xvcic6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICdwcmVzc2VkQ29sb3InOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAndGFyZ2V0JzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ2NvbnRlbnRTaXplJzogWydjYy5VSVRyYW5zZm9ybSddLFxuICAgICAgICAnYW5jaG9yUG9pbnQnOiBbJ2NjLlVJVHJhbnNmb3JtJ11cbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb21tZW5kZWRDb21wb25lbnRzID0gcHJvcGVydHlUb0NvbXBvbmVudE1hcFtwcm9wZXJ0eV0gfHwgW107XG4gICAgY29uc3QgYXZhaWxhYmxlUmVjb21tZW5kZWQgPSByZWNvbW1lbmRlZENvbXBvbmVudHMuZmlsdGVyKGNvbXAgPT4gYXZhaWxhYmxlVHlwZXMuaW5jbHVkZXMoY29tcCkpO1xuICAgIGlmIChhdmFpbGFibGVSZWNvbW1lbmRlZC5sZW5ndGggPiAwKSB7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5CYXNlZCBvbiBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nLCByZWNvbW1lbmRlZCBjb21wb25lbnRzOiAke2F2YWlsYWJsZVJlY29tbWVuZGVkLmpvaW4oJywgJyl9YDtcbiAgICB9XG5cbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuU3VnZ2VzdGVkIEFjdGlvbnM6YDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMS4gVXNlIG1hbmFnZV9jb21wb25lbnQgYWN0aW9uPWdldF9hbGwgbm9kZVV1aWQ9XCIuLi5cIiB0byB2aWV3IGFsbCBjb21wb25lbnRzIG9uIHRoZSBub2RlYDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMi4gSWYgeW91IG5lZWQgdG8gYWRkIGEgY29tcG9uZW50LCB1c2UgYWN0aW9uPWFkZCB3aXRoIGNvbXBvbmVudFR5cGU9XCIke3JlcXVlc3RlZFR5cGV9XCJgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4zLiBWZXJpZnkgdGhhdCB0aGUgY29tcG9uZW50IHR5cGUgbmFtZSBpcyBjb3JyZWN0IChjYXNlLXNlbnNpdGl2ZSlgO1xuXG4gICAgcmV0dXJuIGluc3RydWN0aW9uO1xufVxuXG4vKiogUmV0dXJuIGF2YWlsYWJsZSBDb2NvcyBDcmVhdG9yIGJ1aWx0LWluIGNvbXBvbmVudCB0eXBlcyBieSBjYXRlZ29yeSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0KGNhdGVnb3J5OiBzdHJpbmcgPSAnYWxsJyk6IEFjdGlvblRvb2xSZXN1bHQge1xuICAgIGNvbnN0IGNvbXBvbmVudENhdGVnb3JpZXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICAgICAgcmVuZGVyZXI6IFsnY2MuU3ByaXRlJywgJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLk1hc2snLCAnY2MuR3JhcGhpY3MnXSxcbiAgICAgICAgdWk6IFsnY2MuQnV0dG9uJywgJ2NjLlRvZ2dsZScsICdjYy5TbGlkZXInLCAnY2MuU2Nyb2xsVmlldycsICdjYy5FZGl0Qm94JywgJ2NjLlByb2dyZXNzQmFyJ10sXG4gICAgICAgIHBoeXNpY3M6IFsnY2MuUmlnaWRCb2R5MkQnLCAnY2MuQm94Q29sbGlkZXIyRCcsICdjYy5DaXJjbGVDb2xsaWRlcjJEJywgJ2NjLlBvbHlnb25Db2xsaWRlcjJEJ10sXG4gICAgICAgIGFuaW1hdGlvbjogWydjYy5BbmltYXRpb24nLCAnY2MuQW5pbWF0aW9uQ2xpcCcsICdjYy5Ta2VsZXRhbEFuaW1hdGlvbiddLFxuICAgICAgICBhdWRpbzogWydjYy5BdWRpb1NvdXJjZSddLFxuICAgICAgICBsYXlvdXQ6IFsnY2MuTGF5b3V0JywgJ2NjLldpZGdldCcsICdjYy5QYWdlVmlldycsICdjYy5QYWdlVmlld0luZGljYXRvciddLFxuICAgICAgICBlZmZlY3RzOiBbJ2NjLk1vdGlvblN0cmVhaycsICdjYy5QYXJ0aWNsZVN5c3RlbTJEJ10sXG4gICAgICAgIGNhbWVyYTogWydjYy5DYW1lcmEnXSxcbiAgICAgICAgbGlnaHQ6IFsnY2MuTGlnaHQnLCAnY2MuRGlyZWN0aW9uYWxMaWdodCcsICdjYy5Qb2ludExpZ2h0JywgJ2NjLlNwb3RMaWdodCddXG4gICAgfTtcblxuICAgIGxldCBjb21wb25lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmIChjYXRlZ29yeSA9PT0gJ2FsbCcpIHtcbiAgICAgICAgZm9yIChjb25zdCBjYXQgaW4gY29tcG9uZW50Q2F0ZWdvcmllcykge1xuICAgICAgICAgICAgY29tcG9uZW50cyA9IGNvbXBvbmVudHMuY29uY2F0KGNvbXBvbmVudENhdGVnb3JpZXNbY2F0XSk7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNvbXBvbmVudENhdGVnb3JpZXNbY2F0ZWdvcnldKSB7XG4gICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRDYXRlZ29yaWVzW2NhdGVnb3J5XTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGNhdGVnb3J5LCBjb21wb25lbnRzIH0pO1xufVxuXG4vKiogUmVkaXJlY3Qgc2V0X3Byb3BlcnR5IGNhbGxzIHRoYXQgdGFyZ2V0IG5vZGUtbGV2ZWwgcHJvcGVydGllcyB0byB0aGUgY29ycmVjdCBtYW5hZ2Vfbm9kZSBhY3Rpb24gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzOiB7XG4gICAgbm9kZVV1aWQ6IHN0cmluZzsgY29tcG9uZW50VHlwZTogc3RyaW5nOyBwcm9wZXJ0eTogc3RyaW5nOyB2YWx1ZTogYW55O1xufSk6IEFjdGlvblRvb2xSZXN1bHQgfCBudWxsIHtcbiAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdmFsdWUgfSA9IGFyZ3M7XG4gICAgY29uc3Qgbm9kZUJhc2ljUHJvcGVydGllcyA9IFsnbmFtZScsICdhY3RpdmUnLCAnbGF5ZXInLCAnbW9iaWxpdHknLCAncGFyZW50JywgJ2NoaWxkcmVuJywgJ2hpZGVGbGFncyddO1xuICAgIGNvbnN0IG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzID0gWydwb3NpdGlvbicsICdyb3RhdGlvbicsICdzY2FsZScsICdldWxlckFuZ2xlcycsICdhbmdsZSddO1xuXG4gICAgaWYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5Ob2RlJyB8fCBjb21wb25lbnRUeXBlID09PSAnTm9kZScpIHtcbiAgICAgICAgaWYgKG5vZGVCYXNpY1Byb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhIG5vZGUgYmFzaWMgcHJvcGVydHksIG5vdCBhIGNvbXBvbmVudCBwcm9wZXJ0eWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF9wcm9wZXJ0eSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCBwcm9wZXJ0eT1cIiR7cHJvcGVydHl9XCIsIHZhbHVlPSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAobm9kZVRyYW5zZm9ybVByb3BlcnRpZXMuaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBhIG5vZGUgdHJhbnNmb3JtIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtIHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsICR7cHJvcGVydHl9PSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbn1cblxuLyoqIFZlcmlmeSBhIHByb3BlcnR5IGNoYW5nZSB3YXMgYXBwbGllZDsgdXNlcyBnZXRDb21wb25lbnRJbmZvIGNhbGxiYWNrIHRvIGF2b2lkIGNpcmN1bGFyIGRlcHMgKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZShcbiAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxuICAgIG9yaWdpbmFsVmFsdWU6IGFueSxcbiAgICBleHBlY3RlZFZhbHVlOiBhbnksXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuKTogUHJvbWlzZTx7IHZlcmlmaWVkOiBib29sZWFuOyBhY3R1YWxWYWx1ZTogYW55OyBmdWxsRGF0YTogYW55IH0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjb21wb25lbnRJbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XG4gICAgICAgIGlmIChjb21wb25lbnRJbmZvLnN1Y2Nlc3MgJiYgY29tcG9uZW50SW5mby5kYXRhKSB7XG4gICAgICAgICAgICAvLyBXYWxrIGRvdHRlZCBwcm9wZXJ0eSBwYXRocyB0aHJvdWdoIG5lc3RlZCBDQ0NsYXNzIGdyb3VwIGR1bXBzLlxuICAgICAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xuICAgICAgICAgICAgbGV0IHByb3BlcnR5RGF0YTogYW55ID0gY29tcG9uZW50SW5mby5kYXRhLnByb3BlcnRpZXM7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aCAmJiBwcm9wZXJ0eURhdGE7IGkrKykge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YVtzZWdtZW50c1tpXV07XG4gICAgICAgICAgICAgICAgY29uc3QgaXNMZWFmID0gaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTGVhZiAmJiBwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YS52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gcHJvcGVydHlEYXRhLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eURhdGEgJiYgdHlwZW9mIHByb3BlcnR5RGF0YSA9PT0gJ29iamVjdCcgJiYgJ3ZhbHVlJyBpbiBwcm9wZXJ0eURhdGEpIHtcbiAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YS52YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRXh0cmFjdHMgYSByZWZlcmVuY2UncyB1dWlkIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgZWRpdG9yJ3MgZHVtcCB3cmFwcyBpdFxuICAgICAgICAgICAgLy8gYXMgYSBwbGFpbiBzdHJpbmcgKHsgdXVpZDogJ3gnIH0pIG9yIGFzIGEgbmVzdGVkIGxlYWYgZGVzY3JpcHRvclxuICAgICAgICAgICAgLy8gKHsgdXVpZDogeyB2YWx1ZTogJ3gnIH0gfSkg4oCUIHRoZSBzYW1lIGFtYmlndWl0eSB0aGUgc2luZ2xlLXJlZmVyZW5jZSBicmFuY2hcbiAgICAgICAgICAgIC8vIGJlbG93IGFscmVhZHkgdG9sZXJhdGVzLlxuICAgICAgICAgICAgY29uc3QgZXh0cmFjdFV1aWQgPSAocmVmOiBhbnkpOiBzdHJpbmcgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghcmVmIHx8IHR5cGVvZiByZWYgIT09ICdvYmplY3QnIHx8ICEoJ3V1aWQnIGluIHJlZikpIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCByYXcgPSByZWYudXVpZDtcbiAgICAgICAgICAgICAgICBpZiAocmF3ICYmIHR5cGVvZiByYXcgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcmF3KSByZXR1cm4gcmF3LnZhbHVlIHx8ICcnO1xuICAgICAgICAgICAgICAgIHJldHVybiByYXcgfHwgJyc7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBsZXQgdmVyaWZpZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGV4cGVjdGVkVmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgLy8gbm9kZUFycmF5IC8gY29tcG9uZW50QXJyYXk6IGV2ZXJ5IGVsZW1lbnQgaXMgaXRzZWxmIGEgeyB1dWlkIH0gcmVmZXJlbmNlLlxuICAgICAgICAgICAgICAgIC8vIENvbXBhcmUgYnkgcGVyLWVsZW1lbnQgdXVpZCAob3JkZXItcHJlc2VydmluZyksIG5ldmVyIGJ5IGRlZXAtZXF1YWxpbmcgdGhlXG4gICAgICAgICAgICAgICAgLy8gd2hvbGUgYXJyYXkg4oCUIHRoZSBlZGl0b3IncyByZWFkLWJhY2sgZHVtcCBtYXkgY2FycnkgZXh0cmEgcGVyLWVsZW1lbnRcbiAgICAgICAgICAgICAgICAvLyBtZXRhZGF0YSAoZS5nLiBhbiBpbnRlcm5hbCBvYmplY3QgaWQpIHRoYXQgYSBwbGFpbiBjb21wb25lbnQvbm9kZSByZWZlcmVuY2VcbiAgICAgICAgICAgICAgICAvLyB3cml0ZSBuZXZlciBpbmNsdWRlZCwgd2hpY2ggd291bGQgZmFpbCBhIEpTT04uc3RyaW5naWZ5IGNvbXBhcmlzb24gZXZlblxuICAgICAgICAgICAgICAgIC8vIHRob3VnaCBldmVyeSByZWZlcmVuY2UgcmVzb2x2ZWQgY29ycmVjdGx5LlxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbEFyciA9IEFycmF5LmlzQXJyYXkoYWN0dWFsVmFsdWUpID8gYWN0dWFsVmFsdWUgOiBbXTtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbEFyci5sZW5ndGggPT09IGV4cGVjdGVkVmFsdWUubGVuZ3RoICYmXG4gICAgICAgICAgICAgICAgICAgIGV4cGVjdGVkVmFsdWUuZXZlcnkoKGV4cDogYW55LCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZXhwVXVpZCA9IGV4dHJhY3RVdWlkKGV4cCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXhwVXVpZCAhPT0gJycgJiYgZXhwVXVpZCA9PT0gZXh0cmFjdFV1aWQoYWN0dWFsQXJyW2lkeF0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWUgPT09ICdvYmplY3QnICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwgJiYgJ3V1aWQnIGluIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhY3R1YWxVdWlkID0gYWN0dWFsVmFsdWUgJiYgdHlwZW9mIGFjdHVhbFZhbHVlID09PSAnb2JqZWN0JyAmJiAndXVpZCcgaW4gYWN0dWFsVmFsdWUgPyBhY3R1YWxWYWx1ZS51dWlkIDogJyc7XG4gICAgICAgICAgICAgICAgY29uc3QgZXhwZWN0ZWRVdWlkID0gZXhwZWN0ZWRWYWx1ZS51dWlkIHx8ICcnO1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gYWN0dWFsVXVpZCA9PT0gZXhwZWN0ZWRVdWlkICYmIGV4cGVjdGVkVXVpZCAhPT0gJyc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gdHlwZW9mIGV4cGVjdGVkVmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSAnb2JqZWN0JyAmJiBhY3R1YWxWYWx1ZSAhPT0gbnVsbCAmJiBleHBlY3RlZFZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gSlNPTi5zdHJpbmdpZnkoYWN0dWFsVmFsdWUpID09PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZFZhbHVlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFZhbHVlID09PSBleHBlY3RlZFZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBTdHJpbmcoYWN0dWFsVmFsdWUpID09PSBTdHJpbmcoZXhwZWN0ZWRWYWx1ZSkgfHwgTnVtYmVyKGFjdHVhbFZhbHVlKSA9PT0gTnVtYmVyKGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkLFxuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgIGZ1bGxEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkUHJvcGVydHk6IHsgbmFtZTogcHJvcGVydHksIGJlZm9yZTogb3JpZ2luYWxWYWx1ZSwgZXhwZWN0ZWQ6IGV4cGVjdGVkVmFsdWUsIGFjdHVhbDogYWN0dWFsVmFsdWUsIHZlcmlmaWVkIH0sXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudFN1bW1hcnk6IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHRvdGFsUHJvcGVydGllczogT2JqZWN0LmtleXMoY29tcG9uZW50SW5mby5kYXRhPy5wcm9wZXJ0aWVzIHx8IHt9KS5sZW5ndGggfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFuYWdlQ29tcG9uZW50LnZlcmlmeVByb3BlcnR5Q2hhbmdlXSBWZXJpZmljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBhY3R1YWxWYWx1ZTogdW5kZWZpbmVkLCBmdWxsRGF0YTogbnVsbCB9O1xufVxuIl19