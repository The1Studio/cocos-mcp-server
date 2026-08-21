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
        throw new Error(`${propertyType} value must be a string UUID`);
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
            if (typeof value === 'string')
                return parseColorString(value);
            if (typeof value === 'object' && value !== null) {
                return {
                    r: Math.min(255, Math.max(0, Number(value.r) || 0)),
                    g: Math.min(255, Math.max(0, Number(value.g) || 0)),
                    b: Math.min(255, Math.max(0, Number(value.b) || 0)),
                    a: value.a !== undefined ? Math.min(255, Math.max(0, Number(value.a))) : 255
                };
            }
            throw new Error('Color value must be an object with r, g, b properties or a hexadecimal string (e.g., "#FF0000")');
        case 'vec2':
            if (typeof value === 'object' && value !== null)
                return { x: Number(value.x) || 0, y: Number(value.y) || 0 };
            throw new Error('Vec2 value must be an object with x, y properties');
        case 'vec3':
            if (typeof value === 'object' && value !== null)
                return { x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 };
            throw new Error('Vec3 value must be an object with x, y, z properties');
        case 'size':
            if (typeof value === 'object' && value !== null)
                return { width: Number(value.width) || 0, height: Number(value.height) || 0 };
            throw new Error('Size value must be an object with width, height properties');
        case 'node':
            if (typeof value === 'string')
                return { uuid: value };
            throw new Error('Node reference value must be a string UUID');
        case 'component':
            if (typeof value === 'string')
                return value; // resolved to __id__ later
            throw new Error('Component reference value must be a string (node UUID containing the target component)');
        case 'componentArray':
            if (Array.isArray(value))
                return value.map((item) => {
                    if (typeof item === 'string')
                        return item; // each resolved to a component __id__ later
                    throw new Error('ComponentArray items must be string node UUIDs (each containing the target component)');
                });
            throw new Error('ComponentArray value must be an array');
        case 'nodeArray':
            if (Array.isArray(value))
                return value.map((item) => { if (typeof item === 'string')
                    return { uuid: item }; throw new Error('NodeArray items must be string UUIDs'); });
            throw new Error('NodeArray value must be an array');
        case 'colorArray':
            if (Array.isArray(value))
                return value.map((item) => {
                    if (typeof item === 'object' && item !== null && 'r' in item) {
                        return { r: Math.min(255, Math.max(0, Number(item.r) || 0)), g: Math.min(255, Math.max(0, Number(item.g) || 0)), b: Math.min(255, Math.max(0, Number(item.b) || 0)), a: item.a !== undefined ? Math.min(255, Math.max(0, Number(item.a))) : 255 };
                    }
                    return { r: 255, g: 255, b: 255, a: 255 };
                });
            throw new Error('ColorArray value must be an array');
        case 'numberArray':
            if (Array.isArray(value))
                return value.map((item) => Number(item));
            throw new Error('NumberArray value must be an array');
        case 'stringArray':
            if (Array.isArray(value))
                return value.map((item) => String(item));
            throw new Error('StringArray value must be an array');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFZSCw4REEwQkM7QUFJRCwwQ0F1SEM7QUFHRCw0Q0FvQkM7QUF5REQsb0RBZ0VDO0FBR0Qsa0VBcUNDO0FBR0QsZ0VBdUJDO0FBR0QsZ0VBd0JDO0FBR0Qsc0VBOEVDO0FBN2RELG9DQUEyRDtBQVMzRCxxRkFBcUY7QUFDckYsU0FBZ0IseUJBQXlCLENBQUMsUUFBYTtJQUNuRCxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3BFLElBQUksQ0FBQztRQUNELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkMsMkRBQTJEO1FBQzNELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN6QyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDeEIsT0FBTyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUNwRixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksbUJBQW1CO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDdEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFD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LENBQUM7QUFDdkUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogUHVyZSBoZWxwZXIgZnVuY3Rpb25zIGZvciBjb21wb25lbnQgcHJvcGVydHkgYW5hbHlzaXMsIHZhbGlkYXRpb24sIGFuZCBxdWVyeSB1dGlsaXRpZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGV4aXN0czogYm9vbGVhbjtcbiAgICB0eXBlOiBzdHJpbmc7XG4gICAgYXZhaWxhYmxlUHJvcGVydGllczogc3RyaW5nW107XG4gICAgb3JpZ2luYWxWYWx1ZTogYW55O1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHByb3BEYXRhIGxvb2tzIGxpa2UgYSBDb2NvcyBDcmVhdG9yIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihwcm9wRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcgfHwgcHJvcERhdGEgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcERhdGEpO1xuICAgICAgICAvLyBTa2lwIHNpbXBsZSB2YWx1ZSBvYmplY3RzIGxpa2Uge3dpZHRoOiAyMDAsIGhlaWdodDogMTUwfVxuICAgICAgICBjb25zdCBpc1NpbXBsZVZhbHVlT2JqZWN0ID0ga2V5cy5ldmVyeShrZXkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdiA9IHByb3BEYXRhW2tleV07XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGlzU2ltcGxlVmFsdWVPYmplY3QpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgaGFzTmFtZSA9IGtleXMuaW5jbHVkZXMoJ25hbWUnKTtcbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSBrZXlzLmluY2x1ZGVzKCd2YWx1ZScpO1xuICAgICAgICBjb25zdCBoYXNUeXBlID0ga2V5cy5pbmNsdWRlcygndHlwZScpO1xuICAgICAgICBjb25zdCBoYXNEaXNwbGF5TmFtZSA9IGtleXMuaW5jbHVkZXMoJ2Rpc3BsYXlOYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1JlYWRvbmx5ID0ga2V5cy5pbmNsdWRlcygncmVhZG9ubHknKTtcbiAgICAgICAgY29uc3QgaGFzVmFsaWRTdHJ1Y3R1cmUgPSAoaGFzTmFtZSB8fCBoYXNWYWx1ZSkgJiYgKGhhc1R5cGUgfHwgaGFzRGlzcGxheU5hbWUgfHwgaGFzUmVhZG9ubHkpO1xuICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygnZGVmYXVsdCcpICYmIHByb3BEYXRhLmRlZmF1bHQgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhLmRlZmF1bHQpO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0LnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiBoYXNWYWxpZFN0cnVjdHVyZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qKiBBbmFseXplIGEgY29tcG9uZW50J3MgcHJvcGVydHkgdG8gZGV0ZXJtaW5lIGl0cyB0eXBlIGFuZCBjdXJyZW50IHZhbHVlLlxuICogIFN1cHBvcnRzIGRvdHRlZCBwcm9wZXJ0eU5hbWUgZm9yIG5lc3RlZCBDQ0NsYXNzIGdyb3VwcyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuICovXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVByb3BlcnR5KGNvbXBvbmVudDogYW55LCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGNvbnN0IGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcbiAgICBsZXQgcHJvcGVydHlFeGlzdHMgPSBmYWxzZTtcblxuICAgIC8vIE1ldGhvZCAxOiBkaXJlY3QgcHJvcGVydHkgYWNjZXNzIChmbGF0IHBhdGggb25seSlcbiAgICBpZiAoIXByb3BlcnR5TmFtZS5pbmNsdWRlcygnLicpICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb21wb25lbnQsIHByb3BlcnR5TmFtZSkpIHtcbiAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGNvbXBvbmVudFtwcm9wZXJ0eU5hbWVdO1xuICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gTWV0aG9kIDI6IHNlYXJjaCBuZXN0ZWQgcHJvcGVydGllcyBzdHJ1Y3R1cmUgKENvY29zIENyZWF0b3IgY29tcG9uZW50IGR1bXAgZm9ybWF0KS5cbiAgICAvLyAgRm9yIGRvdHRlZCBuYW1lcyBsaWtlIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIsIHdhbGsgc2VnbWVudHMgdGhyb3VnaCBuZXN0ZWQgYC52YWx1ZWAgZHVtcHMuXG4gICAgaWYgKCFwcm9wZXJ0eUV4aXN0cyAmJiBjb21wb25lbnQucHJvcGVydGllcyAmJiB0eXBlb2YgY29tcG9uZW50LnByb3BlcnRpZXMgPT09ICdvYmplY3QnKSB7XG4gICAgICAgIGNvbnN0IHJvb3RWYWx1ZU9iaiA9IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSA9PT0gJ29iamVjdCdcbiAgICAgICAgICAgID8gY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWVcbiAgICAgICAgICAgIDogY29tcG9uZW50LnByb3BlcnRpZXM7XG5cbiAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eU5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbGV0IGN1cnNvcjogYW55ID0gcm9vdFZhbHVlT2JqO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNlZ21lbnQgPSBzZWdtZW50c1tpXTtcbiAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG5cbiAgICAgICAgICAgIC8vIFBvcHVsYXRlIGF2YWlsYWJsZVByb3BlcnRpZXMgYXQgdGhlIHJlbGV2YW50IGxldmVsIChyb290IG9yIGZpbmFsIGNvbnRhaW5lcilcbiAgICAgICAgICAgIGlmIChpID09PSAwIHx8IChpID09PSBzZWdtZW50cy5sZW5ndGggLSAxKSkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGN1cnNvciB8fCB7fSkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHYgJiYgdHlwZW9mIHYgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBpID09PSAwID8gJycgOiBgJHtzZWdtZW50cy5zbGljZSgwLCBpKS5qb2luKCcuJyl9LmA7XG4gICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVQcm9wZXJ0aWVzLnB1c2goYCR7cHJlZml4fSR7a31gKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IGN1cnNvciA/IGN1cnNvcltzZWdtZW50XSA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc0xlYWYpIHtcbiAgICAgICAgICAgICAgICBpZiAoaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihkZXNjcmlwdG9yKSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBkS2V5cyA9IE9iamVjdC5rZXlzKGRlc2NyaXB0b3IpO1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZEtleXMuaW5jbHVkZXMoJ3ZhbHVlJykgPyBkZXNjcmlwdG9yLnZhbHVlIDogZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZGVzY3JpcHRvcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBEZXNjZW5kIGludG8gdGhlIG5lc3RlZCBDQ0NsYXNzIGdyb3VwOiBkZXNjcmlwdG9yLnZhbHVlIGhvbGRzIHRoZSBpbm5lciBkdW1wLlxuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvci52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSBkZXNjcmlwdG9yLnZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGN1cnNvciA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ldGhvZCAzOiBjb2xsZWN0IHNpbXBsZSBwcm9wZXJ0eSBuYW1lcyBmcm9tIGRpcmVjdCBrZXlzIGFzIGZhbGxiYWNrXG4gICAgaWYgKGF2YWlsYWJsZVByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGNvbXBvbmVudCkpIHtcbiAgICAgICAgICAgIGlmICgha2V5LnN0YXJ0c1dpdGgoJ18nKSAmJiAhWydfX3R5cGVfXycsICdjaWQnLCAnbm9kZScsICd1dWlkJywgJ25hbWUnLCAnZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnXS5pbmNsdWRlcyhrZXkpKSB7XG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByb3BlcnR5RXhpc3RzKSB7XG4gICAgICAgIHJldHVybiB7IGV4aXN0czogZmFsc2UsIHR5cGU6ICd1bmtub3duJywgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogdW5kZWZpbmVkIH07XG4gICAgfVxuXG4gICAgLy8gSW5mZXIgdHlwZSBmcm9tIHZhbHVlIHN0cnVjdHVyZVxuICAgIGxldCB0eXBlID0gJ3Vua25vd24nO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5VmFsdWUpKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpKSB0eXBlID0gJ25vZGVBcnJheSc7XG4gICAgICAgIGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb2xvcicpKSB0eXBlID0gJ2NvbG9yQXJyYXknO1xuICAgICAgICBlbHNlIHR5cGUgPSAnYXJyYXknO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHR5cGUgPSBbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddLmluY2x1ZGVzKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpKSA/ICdhc3NldCcgOiAnc3RyaW5nJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICB0eXBlID0gJ251bWJlcic7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHR5cGUgPSAnYm9vbGVhbic7XG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlICYmIHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb3BlcnR5VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ3InKSAmJiBrZXlzLmluY2x1ZGVzKCdnJykgJiYga2V5cy5pbmNsdWRlcygnYicpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdjb2xvcic7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3gnKSAmJiBrZXlzLmluY2x1ZGVzKCd5JykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gcHJvcGVydHlWYWx1ZS56ICE9PSB1bmRlZmluZWQgPyAndmVjMycgOiAndmVjMic7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3dpZHRoJykgJiYga2V5cy5pbmNsdWRlcygnaGVpZ2h0JykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ3NpemUnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd1dWlkJykgfHwga2V5cy5pbmNsdWRlcygnX191dWlkX18nKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSB8fCBwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGFyZ2V0JykgfHwga2V5cy5pbmNsdWRlcygnX19pZF9fJykpID8gJ25vZGUnIDogJ2Fzc2V0JztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygnX19pZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ29iamVjdCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlID09PSBudWxsIHx8IHByb3BlcnR5VmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnYXNzZXQnO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb21wb25lbnQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdjb21wb25lbnQnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgZXhpc3RzOiB0cnVlLCB0eXBlLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiBwcm9wZXJ0eVZhbHVlIH07XG59XG5cbi8qKiBQYXJzZSBhIGhleCBjb2xvciBzdHJpbmcgKCNSR0Igb3IgI1JHQkEpIHRvIGFuIFJHQkEgb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb2xvclN0cmluZyhjb2xvclN0cjogc3RyaW5nKTogeyByOiBudW1iZXI7IGc6IG51bWJlcjsgYjogbnVtYmVyOyBhOiBudW1iZXIgfSB7XG4gICAgY29uc3Qgc3RyID0gY29sb3JTdHIudHJpbSgpO1xuICAgIGlmIChzdHIuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICAgIGlmIChzdHIubGVuZ3RoID09PSA3KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXG4gICAgICAgICAgICAgICAgYjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg1LCA3KSwgMTYpLFxuICAgICAgICAgICAgICAgIGE6IDI1NVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChzdHIubGVuZ3RoID09PSA5KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXG4gICAgICAgICAgICAgICAgYjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg1LCA3KSwgMTYpLFxuICAgICAgICAgICAgICAgIGE6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNywgOSksIDE2KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY29sb3IgZm9ybWF0OiBcIiR7Y29sb3JTdHJ9XCIuIE9ubHkgaGV4YWRlY2ltYWwgZm9ybWF0IGlzIHN1cHBvcnRlZCAoZS5nLiwgXCIjRkYwMDAwXCIgb3IgXCIjRkYwMDAwRkZcIilgKTtcbn1cblxuLyoqXG4gKiBDb2NvcyBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHkgdHlwZXMuIEV2ZXJ5IG9uZSBvZiB0aGVzZSBzZXJpYWxpemVzIGlkZW50aWNhbGx5IGFzXG4gKiBgeyB1dWlkIH1gIChpc3N1ZSAjMjYg4oCUIHByb3BlcnR5VHlwZT1cIm1hdGVyaWFsXCIgYW5kIGZyaWVuZHMgcHJldmlvdXNseSBmZWxsIHRocm91Z2ggdG9cbiAqIGBVbnN1cHBvcnRlZCBwcm9wZXJ0eSB0eXBlYCwgZXZlbiB0aG91Z2ggdGhlIGV4aXN0aW5nIHNwcml0ZUZyYW1lL3ByZWZhYi9hc3NldCBjb2VyY2lvblxuICogYWxyZWFkeSBwcm9kdWNlcyB0aGUgY29ycmVjdCBzaGFwZSBmb3IgdGhlbSkuXG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9SRUZFUkVOQ0VfUFJPUEVSVFlfVFlQRVMgPSBbXG4gICAgJ3Nwcml0ZUZyYW1lJywgJ3ByZWZhYicsICdhc3NldCcsXG4gICAgJ21hdGVyaWFsJywgJ3RleHR1cmUnLCAnc3ByaXRlQXRsYXMnLCAnYXVkaW9DbGlwJywgJ2ZvbnQnLCAnYW5pbWF0aW9uQ2xpcCcsXG4gICAgJ21lc2gnLCAnc2tlbGV0b24nLCAncGh5c2ljc01hdGVyaWFsJywgJ3JlbmRlclRleHR1cmUnLCAndGV4dEFzc2V0JywgJ2pzb25Bc3NldCcsXG4gICAgJ3BhcnRpY2xlQXNzZXQnLCAnc2NlbmVBc3NldCdcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogRXhwbGljaXQgcHJvcGVydHlUeXBlIC0+IENvY29zIGFzc2V0IGNsYXNzIGZvciB0aGUgRWRpdG9yIGBzZXQtcHJvcGVydHlgIGR1bXAgYHR5cGVgIGZpZWxkLlxuICpcbiAqIFJlc29sdmVkIGZyb20gdGhlIHByb3BlcnR5VHlwZSBpdHNlbGYsIE5PVCBmcm9tIHRoZSBwcm9wZXJ0eSBuYW1lLiBUaGUgbGVnYWN5IG5hbWUtYmFzZWRcbiAqIGhldXJpc3RpYyBpbiBgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yYCBtaXMtcmVzb2x2ZXMgYW55IGFzc2V0IHByb3BlcnR5IHdob3NlIG5hbWUgbGFja3MgdGhlXG4gKiBtYXRjaGluZyBrZXl3b3JkIOKAlCBhIGBjYy5NYXRlcmlhbGAgcHJvcGVydHkgY2FsbGVkIGBza2luYCByZXNvbHZlZCB0byBgY2MuU3ByaXRlRnJhbWVgLlxuICpcbiAqIFRoZSBnZW5lcmljIGBhc3NldGAgYW5kIGBzdHJpbmdgIHNwZWxsaW5ncyBjYXJyeSBubyB0eXBlIGluZm9ybWF0aW9uLCBzbyB0aGV5IGRlbGliZXJhdGVseVxuICogaGF2ZSBOTyBlbnRyeSBoZXJlIGFuZCBrZWVwIHVzaW5nIHRoZSBuYW1lIGhldXJpc3RpYyAodW5jaGFuZ2VkIGJlaGF2aW91ciBmb3IgZXhpc3RpbmcgY2FsbGVycykuXG4gKi9cbmV4cG9ydCBjb25zdCBBU1NFVF9UWVBFX0JZX1BST1BFUlRZX1RZUEU6IFJlYWRvbmx5PFJlY29yZDxzdHJpbmcsIHN0cmluZz4+ID0ge1xuICAgIG1hdGVyaWFsOiAnY2MuTWF0ZXJpYWwnLFxuICAgIHRleHR1cmU6ICdjYy5UZXh0dXJlMkQnLFxuICAgIHNwcml0ZUZyYW1lOiAnY2MuU3ByaXRlRnJhbWUnLFxuICAgIHNwcml0ZUF0bGFzOiAnY2MuU3ByaXRlQXRsYXMnLFxuICAgIHByZWZhYjogJ2NjLlByZWZhYicsXG4gICAgYXVkaW9DbGlwOiAnY2MuQXVkaW9DbGlwJyxcbiAgICBmb250OiAnY2MuRm9udCcsXG4gICAgYW5pbWF0aW9uQ2xpcDogJ2NjLkFuaW1hdGlvbkNsaXAnLFxuICAgIG1lc2g6ICdjYy5NZXNoJyxcbiAgICBza2VsZXRvbjogJ2NjLlNrZWxldG9uJyxcbiAgICBwaHlzaWNzTWF0ZXJpYWw6ICdjYy5QaHlzaWNzTWF0ZXJpYWwnLFxuICAgIHJlbmRlclRleHR1cmU6ICdjYy5SZW5kZXJUZXh0dXJlJyxcbiAgICB0ZXh0QXNzZXQ6ICdjYy5UZXh0QXNzZXQnLFxuICAgIGpzb25Bc3NldDogJ2NjLkpzb25Bc3NldCcsXG4gICAgcGFydGljbGVBc3NldDogJ2NjLlBhcnRpY2xlQXNzZXQnLFxuICAgIHNjZW5lQXNzZXQ6ICdjYy5TY2VuZUFzc2V0J1xufTtcblxuLyoqIEV2ZXJ5IHByb3BlcnR5VHlwZSBjb252ZXJ0UHJvcGVydHlWYWx1ZSBhY2NlcHRzIOKAlCB1c2VkIHRvIGJ1aWxkIGFuIGFjdGlvbmFibGUgZXJyb3IgbWVzc2FnZS4gKi9cbmV4cG9ydCBjb25zdCBTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMgPSBbXG4gICAgJ3N0cmluZycsICdudW1iZXInLCAnaW50ZWdlcicsICdmbG9hdCcsICdib29sZWFuJyxcbiAgICAnY29sb3InLCAndmVjMicsICd2ZWMzJywgJ3NpemUnLFxuICAgICdub2RlJywgJ2NvbXBvbmVudCcsXG4gICAgLi4uQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTLFxuICAgICdub2RlQXJyYXknLCAnY29sb3JBcnJheScsICdudW1iZXJBcnJheScsICdzdHJpbmdBcnJheScsICdjb21wb25lbnRBcnJheSdcbl0gYXMgY29uc3Q7XG5cbi8qKlxuICogQ29udmVydCBhIHJhdyBMTE0tc3VwcGxpZWQgdmFsdWUgdG8gdGhlIGNvcnJlY3QgZm9ybWF0IGZvciBhIGdpdmVuIHByb3BlcnR5VHlwZS5cbiAqIFRocm93cyBpZiB0aGUgdmFsdWUgZm9ybWF0IGlzIGludmFsaWQgZm9yIHRoZSBnaXZlbiB0eXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBhbnkge1xuICAgIGlmICgoQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTIGFzIHJlYWRvbmx5IHN0cmluZ1tdKS5pbmNsdWRlcyhwcm9wZXJ0eVR5cGUpKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIFVVSURgKTtcbiAgICB9XG4gICAgc3dpdGNoIChwcm9wZXJ0eVR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAgICAgICBjYXNlICdudW1iZXInOiBjYXNlICdpbnRlZ2VyJzogY2FzZSAnZmxvYXQnOlxuICAgICAgICAgICAgcmV0dXJuIE51bWJlcih2YWx1ZSk7XG4gICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgcmV0dXJuIEJvb2xlYW4odmFsdWUpO1xuICAgICAgICBjYXNlICdjb2xvcic6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHBhcnNlQ29sb3JTdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBhOiB2YWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5hKSkpIDogMjU1XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29sb3IgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCByLCBnLCBiIHByb3BlcnRpZXMgb3IgYSBoZXhhZGVjaW1hbCBzdHJpbmcgKGUuZy4sIFwiI0ZGMDAwMFwiKScpO1xuICAgICAgICBjYXNlICd2ZWMyJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSByZXR1cm4geyB4OiBOdW1iZXIodmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHZhbHVlLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVmVjMiB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHkgcHJvcGVydGllcycpO1xuICAgICAgICBjYXNlICd2ZWMzJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSByZXR1cm4geyB4OiBOdW1iZXIodmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHZhbHVlLnkpIHx8IDAsIHo6IE51bWJlcih2YWx1ZS56KSB8fCAwIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZlYzMgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB4LCB5LCB6IHByb3BlcnRpZXMnKTtcbiAgICAgICAgY2FzZSAnc2l6ZSc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkgcmV0dXJuIHsgd2lkdGg6IE51bWJlcih2YWx1ZS53aWR0aCkgfHwgMCwgaGVpZ2h0OiBOdW1iZXIodmFsdWUuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NpemUgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB3aWR0aCwgaGVpZ2h0IHByb3BlcnRpZXMnKTtcbiAgICAgICAgY2FzZSAnbm9kZSc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm9kZSByZWZlcmVuY2UgdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEJyk7XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHZhbHVlOyAvLyByZXNvbHZlZCB0byBfX2lkX18gbGF0ZXJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50IHJlZmVyZW5jZSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIChub2RlIFVVSUQgY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCknKTtcbiAgICAgICAgY2FzZSAnY29tcG9uZW50QXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4gaXRlbTsgLy8gZWFjaCByZXNvbHZlZCB0byBhIGNvbXBvbmVudCBfX2lkX18gbGF0ZXJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudEFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIG5vZGUgVVVJRHMgKGVhY2ggY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCknKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21wb25lbnRBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5Jyk7XG4gICAgICAgIGNhc2UgJ25vZGVBcnJheSc6XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4geyBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07IHRocm93IG5ldyBFcnJvcignTm9kZUFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIFVVSURzJyk7IH0pO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdOb2RlQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICBjYXNlICdjb2xvckFycmF5JzpcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiBpdGVtICE9PSBudWxsICYmICdyJyBpbiBpdGVtKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0ucikgfHwgMCkpLCBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLmcpIHx8IDApKSwgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5iKSB8fCAwKSksIGE6IGl0ZW0uYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5hKSkpIDogMjU1IH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7IHI6IDI1NSwgZzogMjU1LCBiOiAyNTUsIGE6IDI1NSB9O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbG9yQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICBjYXNlICdudW1iZXJBcnJheSc6XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4gTnVtYmVyKGl0ZW0pKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTnVtYmVyQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICBjYXNlICdzdHJpbmdBcnJheSc6XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4gU3RyaW5nKGl0ZW0pKTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignU3RyaW5nQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBwcm9wZXJ0eSB0eXBlOiAke3Byb3BlcnR5VHlwZX0uIFN1cHBvcnRlZCB0eXBlczogJHtTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMuam9pbignLCAnKX1gKTtcbiAgICB9XG59XG5cbi8qKiBHZW5lcmF0ZSBhbiBMTE0tZnJpZW5kbHkgc3VnZ2VzdGlvbiB3aGVuIHJlcXVlc3RlZCBjb21wb25lbnQgdHlwZSBpcyBub3QgZm91bmQgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24ocmVxdWVzdGVkVHlwZTogc3RyaW5nLCBhdmFpbGFibGVUeXBlczogc3RyaW5nW10sIHByb3BlcnR5OiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHNpbWlsYXJUeXBlcyA9IGF2YWlsYWJsZVR5cGVzLmZpbHRlcih0eXBlID0+XG4gICAgICAgIHR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhyZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkpIHx8XG4gICAgICAgIHJlcXVlc3RlZFR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0eXBlLnRvTG93ZXJDYXNlKCkpXG4gICAgKTtcblxuICAgIGxldCBpbnN0cnVjdGlvbiA9ICcnO1xuICAgIGlmIChzaW1pbGFyVHlwZXMubGVuZ3RoID4gMCkge1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuRm91bmQgc2ltaWxhciBjb21wb25lbnRzOiAke3NpbWlsYXJUeXBlcy5qb2luKCcsICcpfWA7XG4gICAgICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0aW9uOiBQZXJoYXBzIHlvdSBtZWFudCAnJHtzaW1pbGFyVHlwZXNbMF19Jz9gO1xuICAgIH1cblxuICAgIGNvbnN0IHByb3BlcnR5VG9Db21wb25lbnRNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZ1tdPiA9IHtcbiAgICAgICAgJ3N0cmluZyc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnLCAnY2MuRWRpdEJveCddLFxuICAgICAgICAndGV4dCc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcbiAgICAgICAgJ2ZvbnRTaXplJzogWydjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCddLFxuICAgICAgICAnc3ByaXRlRnJhbWUnOiBbJ2NjLlNwcml0ZSddLFxuICAgICAgICAnY29sb3InOiBbJ2NjLkxhYmVsJywgJ2NjLlNwcml0ZScsICdjYy5HcmFwaGljcyddLFxuICAgICAgICAnbm9ybWFsQ29sb3InOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAncHJlc3NlZENvbG9yJzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ3RhcmdldCc6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICdjb250ZW50U2l6ZSc6IFsnY2MuVUlUcmFuc2Zvcm0nXSxcbiAgICAgICAgJ2FuY2hvclBvaW50JzogWydjYy5VSVRyYW5zZm9ybSddXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29tbWVuZGVkQ29tcG9uZW50cyA9IHByb3BlcnR5VG9Db21wb25lbnRNYXBbcHJvcGVydHldIHx8IFtdO1xuICAgIGNvbnN0IGF2YWlsYWJsZVJlY29tbWVuZGVkID0gcmVjb21tZW5kZWRDb21wb25lbnRzLmZpbHRlcihjb21wID0+IGF2YWlsYWJsZVR5cGVzLmluY2x1ZGVzKGNvbXApKTtcbiAgICBpZiAoYXZhaWxhYmxlUmVjb21tZW5kZWQubGVuZ3RoID4gMCkge1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuQmFzZWQgb24gcHJvcGVydHkgJyR7cHJvcGVydHl9JywgcmVjb21tZW5kZWQgY29tcG9uZW50czogJHthdmFpbGFibGVSZWNvbW1lbmRlZC5qb2luKCcsICcpfWA7XG4gICAgfVxuXG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3RlZCBBY3Rpb25zOmA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjEuIFVzZSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsIG5vZGVVdWlkPVwiLi4uXCIgdG8gdmlldyBhbGwgY29tcG9uZW50cyBvbiB0aGUgbm9kZWA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjIuIElmIHlvdSBuZWVkIHRvIGFkZCBhIGNvbXBvbmVudCwgdXNlIGFjdGlvbj1hZGQgd2l0aCBjb21wb25lbnRUeXBlPVwiJHtyZXF1ZXN0ZWRUeXBlfVwiYDtcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMy4gVmVyaWZ5IHRoYXQgdGhlIGNvbXBvbmVudCB0eXBlIG5hbWUgaXMgY29ycmVjdCAoY2FzZS1zZW5zaXRpdmUpYDtcblxuICAgIHJldHVybiBpbnN0cnVjdGlvbjtcbn1cblxuLyoqIFJldHVybiBhdmFpbGFibGUgQ29jb3MgQ3JlYXRvciBidWlsdC1pbiBjb21wb25lbnQgdHlwZXMgYnkgY2F0ZWdvcnkgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdChjYXRlZ29yeTogc3RyaW5nID0gJ2FsbCcpOiBBY3Rpb25Ub29sUmVzdWx0IHtcbiAgICBjb25zdCBjb21wb25lbnRDYXRlZ29yaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgIHJlbmRlcmVyOiBbJ2NjLlNwcml0ZScsICdjYy5MYWJlbCcsICdjYy5SaWNoVGV4dCcsICdjYy5NYXNrJywgJ2NjLkdyYXBoaWNzJ10sXG4gICAgICAgIHVpOiBbJ2NjLkJ1dHRvbicsICdjYy5Ub2dnbGUnLCAnY2MuU2xpZGVyJywgJ2NjLlNjcm9sbFZpZXcnLCAnY2MuRWRpdEJveCcsICdjYy5Qcm9ncmVzc0JhciddLFxuICAgICAgICBwaHlzaWNzOiBbJ2NjLlJpZ2lkQm9keTJEJywgJ2NjLkJveENvbGxpZGVyMkQnLCAnY2MuQ2lyY2xlQ29sbGlkZXIyRCcsICdjYy5Qb2x5Z29uQ29sbGlkZXIyRCddLFxuICAgICAgICBhbmltYXRpb246IFsnY2MuQW5pbWF0aW9uJywgJ2NjLkFuaW1hdGlvbkNsaXAnLCAnY2MuU2tlbGV0YWxBbmltYXRpb24nXSxcbiAgICAgICAgYXVkaW86IFsnY2MuQXVkaW9Tb3VyY2UnXSxcbiAgICAgICAgbGF5b3V0OiBbJ2NjLkxheW91dCcsICdjYy5XaWRnZXQnLCAnY2MuUGFnZVZpZXcnLCAnY2MuUGFnZVZpZXdJbmRpY2F0b3InXSxcbiAgICAgICAgZWZmZWN0czogWydjYy5Nb3Rpb25TdHJlYWsnLCAnY2MuUGFydGljbGVTeXN0ZW0yRCddLFxuICAgICAgICBjYW1lcmE6IFsnY2MuQ2FtZXJhJ10sXG4gICAgICAgIGxpZ2h0OiBbJ2NjLkxpZ2h0JywgJ2NjLkRpcmVjdGlvbmFsTGlnaHQnLCAnY2MuUG9pbnRMaWdodCcsICdjYy5TcG90TGlnaHQnXVxuICAgIH07XG5cbiAgICBsZXQgY29tcG9uZW50czogc3RyaW5nW10gPSBbXTtcbiAgICBpZiAoY2F0ZWdvcnkgPT09ICdhbGwnKSB7XG4gICAgICAgIGZvciAoY29uc3QgY2F0IGluIGNvbXBvbmVudENhdGVnb3JpZXMpIHtcbiAgICAgICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRzLmNvbmNhdChjb21wb25lbnRDYXRlZ29yaWVzW2NhdF0pO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChjb21wb25lbnRDYXRlZ29yaWVzW2NhdGVnb3J5XSkge1xuICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29tcG9uZW50cyB9KTtcbn1cblxuLyoqIFJlZGlyZWN0IHNldF9wcm9wZXJ0eSBjYWxscyB0aGF0IHRhcmdldCBub2RlLWxldmVsIHByb3BlcnRpZXMgdG8gdGhlIGNvcnJlY3QgbWFuYWdlX25vZGUgYWN0aW9uICovXG5leHBvcnQgZnVuY3Rpb24gcmVkaXJlY3ROb2RlUHJvcGVydHlBY2Nlc3MoYXJnczoge1xuICAgIG5vZGVVdWlkOiBzdHJpbmc7IGNvbXBvbmVudFR5cGU6IHN0cmluZzsgcHJvcGVydHk6IHN0cmluZzsgdmFsdWU6IGFueTtcbn0pOiBBY3Rpb25Ub29sUmVzdWx0IHwgbnVsbCB7XG4gICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHZhbHVlIH0gPSBhcmdzO1xuICAgIGNvbnN0IG5vZGVCYXNpY1Byb3BlcnRpZXMgPSBbJ25hbWUnLCAnYWN0aXZlJywgJ2xheWVyJywgJ21vYmlsaXR5JywgJ3BhcmVudCcsICdjaGlsZHJlbicsICdoaWRlRmxhZ3MnXTtcbiAgICBjb25zdCBub2RlVHJhbnNmb3JtUHJvcGVydGllcyA9IFsncG9zaXRpb24nLCAncm90YXRpb24nLCAnc2NhbGUnLCAnZXVsZXJBbmdsZXMnLCAnYW5nbGUnXTtcblxuICAgIGlmIChjb21wb25lbnRUeXBlID09PSAnY2MuTm9kZScgfHwgY29tcG9uZW50VHlwZSA9PT0gJ05vZGUnKSB7XG4gICAgICAgIGlmIChub2RlQmFzaWNQcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIGJhc2ljIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfcHJvcGVydHkgd2l0aCB1dWlkPVwiJHtub2RlVXVpZH1cIiwgcHJvcGVydHk9XCIke3Byb3BlcnR5fVwiLCB2YWx1ZT0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIHRyYW5zZm9ybSBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogYFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3RyYW5zZm9ybSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCAke3Byb3BlcnR5fT0ke0pTT04uc3RyaW5naWZ5KHZhbHVlKX1gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG59XG5cbi8qKiBWZXJpZnkgYSBwcm9wZXJ0eSBjaGFuZ2Ugd2FzIGFwcGxpZWQ7IHVzZXMgZ2V0Q29tcG9uZW50SW5mbyBjYWxsYmFjayB0byBhdm9pZCBjaXJjdWxhciBkZXBzICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgcHJvcGVydHk6IHN0cmluZyxcbiAgICBvcmlnaW5hbFZhbHVlOiBhbnksXG4gICAgZXhwZWN0ZWRWYWx1ZTogYW55LFxuICAgIGdldENvbXBvbmVudEluZm86IChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8eyB2ZXJpZmllZDogYm9vbGVhbjsgYWN0dWFsVmFsdWU6IGFueTsgZnVsbERhdGE6IGFueSB9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29tcG9uZW50SW5mbyA9IGF3YWl0IGdldENvbXBvbmVudEluZm8obm9kZVV1aWQsIGNvbXBvbmVudFR5cGUpO1xuICAgICAgICBpZiAoY29tcG9uZW50SW5mby5zdWNjZXNzICYmIGNvbXBvbmVudEluZm8uZGF0YSkge1xuICAgICAgICAgICAgLy8gV2FsayBkb3R0ZWQgcHJvcGVydHkgcGF0aHMgdGhyb3VnaCBuZXN0ZWQgQ0NDbGFzcyBncm91cCBkdW1wcy5cbiAgICAgICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHkuc3BsaXQoJy4nKTtcbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eURhdGE6IGFueSA9IGNvbXBvbmVudEluZm8uZGF0YS5wcm9wZXJ0aWVzO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlEYXRhOyBpKyspIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBwcm9wZXJ0eURhdGFbc2VnbWVudHNbaV1dO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YS52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGE7XG4gICAgICAgICAgICBpZiAocHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhKSB7XG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGEudmFsdWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEV4dHJhY3RzIGEgcmVmZXJlbmNlJ3MgdXVpZCByZWdhcmRsZXNzIG9mIHdoZXRoZXIgdGhlIGVkaXRvcidzIGR1bXAgd3JhcHMgaXRcbiAgICAgICAgICAgIC8vIGFzIGEgcGxhaW4gc3RyaW5nICh7IHV1aWQ6ICd4JyB9KSBvciBhcyBhIG5lc3RlZCBsZWFmIGRlc2NyaXB0b3JcbiAgICAgICAgICAgIC8vICh7IHV1aWQ6IHsgdmFsdWU6ICd4JyB9IH0pIOKAlCB0aGUgc2FtZSBhbWJpZ3VpdHkgdGhlIHNpbmdsZS1yZWZlcmVuY2UgYnJhbmNoXG4gICAgICAgICAgICAvLyBiZWxvdyBhbHJlYWR5IHRvbGVyYXRlcy5cbiAgICAgICAgICAgIGNvbnN0IGV4dHJhY3RVdWlkID0gKHJlZjogYW55KTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlZiB8fCB0eXBlb2YgcmVmICE9PSAnb2JqZWN0JyB8fCAhKCd1dWlkJyBpbiByZWYpKSByZXR1cm4gJyc7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gcmVmLnV1aWQ7XG4gICAgICAgICAgICAgICAgaWYgKHJhdyAmJiB0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHJhdykgcmV0dXJuIHJhdy52YWx1ZSB8fCAnJztcbiAgICAgICAgICAgICAgICByZXR1cm4gcmF3IHx8ICcnO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgbGV0IHZlcmlmaWVkID0gZmFsc2U7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShleHBlY3RlZFZhbHVlKSkge1xuICAgICAgICAgICAgICAgIC8vIG5vZGVBcnJheSAvIGNvbXBvbmVudEFycmF5OiBldmVyeSBlbGVtZW50IGlzIGl0c2VsZiBhIHsgdXVpZCB9IHJlZmVyZW5jZS5cbiAgICAgICAgICAgICAgICAvLyBDb21wYXJlIGJ5IHBlci1lbGVtZW50IHV1aWQgKG9yZGVyLXByZXNlcnZpbmcpLCBuZXZlciBieSBkZWVwLWVxdWFsaW5nIHRoZVxuICAgICAgICAgICAgICAgIC8vIHdob2xlIGFycmF5IOKAlCB0aGUgZWRpdG9yJ3MgcmVhZC1iYWNrIGR1bXAgbWF5IGNhcnJ5IGV4dHJhIHBlci1lbGVtZW50XG4gICAgICAgICAgICAgICAgLy8gbWV0YWRhdGEgKGUuZy4gYW4gaW50ZXJuYWwgb2JqZWN0IGlkKSB0aGF0IGEgcGxhaW4gY29tcG9uZW50L25vZGUgcmVmZXJlbmNlXG4gICAgICAgICAgICAgICAgLy8gd3JpdGUgbmV2ZXIgaW5jbHVkZWQsIHdoaWNoIHdvdWxkIGZhaWwgYSBKU09OLnN0cmluZ2lmeSBjb21wYXJpc29uIGV2ZW5cbiAgICAgICAgICAgICAgICAvLyB0aG91Z2ggZXZlcnkgcmVmZXJlbmNlIHJlc29sdmVkIGNvcnJlY3RseS5cbiAgICAgICAgICAgICAgICBjb25zdCBhY3R1YWxBcnIgPSBBcnJheS5pc0FycmF5KGFjdHVhbFZhbHVlKSA/IGFjdHVhbFZhbHVlIDogW107XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxBcnIubGVuZ3RoID09PSBleHBlY3RlZFZhbHVlLmxlbmd0aCAmJlxuICAgICAgICAgICAgICAgICAgICBleHBlY3RlZFZhbHVlLmV2ZXJ5KChleHA6IGFueSwgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4cFV1aWQgPSBleHRyYWN0VXVpZChleHApO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGV4cFV1aWQgIT09ICcnICYmIGV4cFV1aWQgPT09IGV4dHJhY3RVdWlkKGFjdHVhbEFycltpZHhdKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBlY3RlZFZhbHVlID09PSAnb2JqZWN0JyAmJiBleHBlY3RlZFZhbHVlICE9PSBudWxsICYmICd1dWlkJyBpbiBleHBlY3RlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWN0dWFsVXVpZCA9IGFjdHVhbFZhbHVlICYmIHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3V1aWQnIGluIGFjdHVhbFZhbHVlID8gYWN0dWFsVmFsdWUudXVpZCA6ICcnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVXVpZCA9IGV4cGVjdGVkVmFsdWUudXVpZCB8fCAnJztcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IGFjdHVhbFV1aWQgPT09IGV4cGVjdGVkVXVpZCAmJiBleHBlY3RlZFV1aWQgIT09ICcnO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgYWN0dWFsVmFsdWUgPT09IHR5cGVvZiBleHBlY3RlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gJ29iamVjdCcgJiYgYWN0dWFsVmFsdWUgIT09IG51bGwgJiYgZXhwZWN0ZWRWYWx1ZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IEpTT04uc3RyaW5naWZ5KGFjdHVhbFZhbHVlKSA9PT0gSlNPTi5zdHJpbmdpZnkoZXhwZWN0ZWRWYWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxWYWx1ZSA9PT0gZXhwZWN0ZWRWYWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gU3RyaW5nKGFjdHVhbFZhbHVlKSA9PT0gU3RyaW5nKGV4cGVjdGVkVmFsdWUpIHx8IE51bWJlcihhY3R1YWxWYWx1ZSkgPT09IE51bWJlcihleHBlY3RlZFZhbHVlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCxcbiAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZSxcbiAgICAgICAgICAgICAgICBmdWxsRGF0YToge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllZFByb3BlcnR5OiB7IG5hbWU6IHByb3BlcnR5LCBiZWZvcmU6IG9yaWdpbmFsVmFsdWUsIGV4cGVjdGVkOiBleHBlY3RlZFZhbHVlLCBhY3R1YWw6IGFjdHVhbFZhbHVlLCB2ZXJpZmllZCB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRTdW1tYXJ5OiB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCB0b3RhbFByb3BlcnRpZXM6IE9iamVjdC5rZXlzKGNvbXBvbmVudEluZm8uZGF0YT8ucHJvcGVydGllcyB8fCB7fSkubGVuZ3RoIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW01hbmFnZUNvbXBvbmVudC52ZXJpZnlQcm9wZXJ0eUNoYW5nZV0gVmVyaWZpY2F0aW9uIGZhaWxlZDonLCBlcnJvcik7XG4gICAgfVxuICAgIHJldHVybiB7IHZlcmlmaWVkOiBmYWxzZSwgYWN0dWFsVmFsdWU6IHVuZGVmaW5lZCwgZnVsbERhdGE6IG51bGwgfTtcbn1cbiJdfQ==