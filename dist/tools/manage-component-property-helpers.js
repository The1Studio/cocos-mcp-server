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
            let verified = false;
            if (typeof expectedValue === 'object' && expectedValue !== null && 'uuid' in expectedValue) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFZSCw4REEwQkM7QUFJRCwwQ0F1SEM7QUFHRCw0Q0FvQkM7QUF5REQsb0RBZ0VDO0FBR0Qsa0VBcUNDO0FBR0QsZ0VBdUJDO0FBR0QsZ0VBd0JDO0FBR0Qsc0VBc0RDO0FBcmNELG9DQUEyRDtBQVMzRCxxRkFBcUY7QUFDckYsU0FBZ0IseUJBQXlCLENBQUMsUUFBYTtJQUNuRCxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSTtRQUFFLE9BQU8sS0FBSyxDQUFDO0lBQ3BFLElBQUksQ0FBQztRQUNELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkMsMkRBQTJEO1FBQzNELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUN6QyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDeEIsT0FBTyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFNBQVMsQ0FBQztRQUNwRixDQUFDLENBQUMsQ0FBQztRQUNILElBQUksbUJBQW1CO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDdEMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNwRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzlDLE1BQU0saUJBQWlCLEdBQUcsQ0FBQyxPQUFPLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksY0FBYyxJQUFJLFdBQVcsQ0FBQyxDQUFDO1FBQzlGLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxRQUFRLENBQUMsT0FBTyxJQUFJLE9BQU8sUUFBUSxDQUFDLE9BQU8sS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUN2RixNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNsRCxJQUFJLFdBQVcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksT0FBTyxRQUFRLENBQUMsT0FBTyxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztnQkFDOUUsT0FBTyxpQkFBaUIsQ0FBQztZQUM3QixDQUFDO1FBQ0wsQ0FBQztRQUNELE9BQU8saUJBQWlCLENBQUM7SUFDN0IsQ0FBQztJQUFDLFdBQU0sQ0FBQztRQUNMLE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7QUFDTCxDQUFDO0FBRUQ7aUdBQ2lHO0FBQ2pHLFNBQWdCLGVBQWUsQ0FBQyxTQUFjLEVBQUUsWUFBb0I7SUFDaEUsTUFBTSxtQkFBbUIsR0FBYSxFQUFFLENBQUM7SUFDekMsSUFBSSxhQUFhLEdBQVEsU0FBUyxDQUFDO0lBQ25DLElBQUksY0FBYyxHQUFHLEtBQUssQ0FBQztJQUUzQixvREFBb0Q7SUFDcEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQy9GLGFBQWEsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEMsY0FBYyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRUQsc0ZBQXNGO0lBQ3RGLGtHQUFrRztJQUNsRyxJQUFJLENBQUMsY0FBYyxJQUFJLFNBQVMsQ0FBQyxVQUFVLElBQUksT0FBTyxTQUFTLENBQUMsVUFBVSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ3RGLE1BQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsS0FBSyxJQUFJLE9BQU8sU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEtBQUssUUFBUTtZQUM3RixDQUFDLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxLQUFLO1lBQzVCLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO1FBRTNCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDekMsSUFBSSxNQUFNLEdBQVEsWUFBWSxDQUFDO1FBRS9CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdkMsTUFBTSxPQUFPLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVCLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztZQUV6QywrRUFBK0U7WUFDL0UsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDekMsS0FBSyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUM7b0JBQ2hELElBQUksQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsRUFBRSxDQUFDO3dCQUM3QixNQUFNLE1BQU0sR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUM7d0JBQ25FLG1CQUFtQixDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUM5QyxDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDO1lBRUQsTUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN4RCxJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDM0IsTUFBTSxHQUFHLFNBQVMsQ0FBQztnQkFDbkIsTUFBTTtZQUNWLENBQUM7WUFFRCxJQUFJLE1BQU0sRUFBRSxDQUFDO2dCQUNULElBQUkseUJBQXlCLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztvQkFDeEMsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztvQkFDdEMsYUFBYSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQztnQkFDNUUsQ0FBQztxQkFBTSxDQUFDO29CQUNKLGFBQWEsR0FBRyxVQUFVLENBQUM7Z0JBQy9CLENBQUM7Z0JBQ0QsY0FBYyxHQUFHLElBQUksQ0FBQztnQkFDdEIsTUFBTTtZQUNWLENBQUM7WUFFRCxnRkFBZ0Y7WUFDaEYsSUFBSSxVQUFVLElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxVQUFVLElBQUksT0FBTyxVQUFVLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUNoSCxNQUFNLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUM5QixDQUFDO2lCQUFNLElBQUksVUFBVSxJQUFJLE9BQU8sVUFBVSxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUN0RCxNQUFNLEdBQUcsVUFBVSxDQUFDO1lBQ3hCLENBQUM7aUJBQU0sQ0FBQztnQkFDSixNQUFNLEdBQUcsU0FBUyxDQUFDO2dCQUNuQixNQUFNO1lBQ1YsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBRUQsdUVBQXVFO0lBQ3ZFLElBQUksbUJBQW1CLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ25DLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxVQUFVLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUMvSCxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbEMsQ0FBQztRQUNMLENBQUM7SUFDTCxDQUFDO0lBRUQsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQ2xCLE9BQU8sRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsbUJBQW1CLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxDQUFDO0lBQzdGLENBQUM7SUFFRCxrQ0FBa0M7SUFDbEMsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDO0lBQ3JCLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO1FBQy9CLElBQUksWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFBRSxJQUFJLEdBQUcsV0FBVyxDQUFDO2FBQy9ELElBQUksWUFBWSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7WUFBRSxJQUFJLEdBQUcsWUFBWSxDQUFDOztZQUN0RSxJQUFJLEdBQUcsT0FBTyxDQUFDO0lBQ3hCLENBQUM7U0FBTSxJQUFJLE9BQU8sYUFBYSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzNDLElBQUksR0FBRyxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztJQUN0SSxDQUFDO1NBQU0sSUFBSSxPQUFPLGFBQWEsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMzQyxJQUFJLEdBQUcsUUFBUSxDQUFDO0lBQ3BCLENBQUM7U0FBTSxJQUFJLE9BQU8sYUFBYSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzVDLElBQUksR0FBRyxTQUFTLENBQUM7SUFDckIsQ0FBQztTQUFNLElBQUksYUFBYSxJQUFJLE9BQU8sYUFBYSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzVELElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDeEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO2dCQUNqRSxJQUFJLEdBQUcsT0FBTyxDQUFDO1lBQ25CLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztnQkFDbEQsSUFBSSxHQUFHLGFBQWEsQ0FBQyxDQUFDLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztZQUMzRCxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQzNELElBQUksR0FBRyxNQUFNLENBQUM7WUFDbEIsQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO2dCQUM1RCxJQUFJLEdBQUcsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUN4SixDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNqQyxJQUFJLEdBQUcsTUFBTSxDQUFDO1lBQ2xCLENBQUM7aUJBQU0sQ0FBQztnQkFDSixJQUFJLEdBQUcsUUFBUSxDQUFDO1lBQ3BCLENBQUM7UUFDTCxDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ0wsSUFBSSxHQUFHLFFBQVEsQ0FBQztRQUNwQixDQUFDO0lBQ0wsQ0FBQztTQUFNLElBQUksYUFBYSxLQUFLLElBQUksSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDL0QsSUFBSSxDQUFDLGFBQWEsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxFQUFFLENBQUM7WUFDeEcsSUFBSSxHQUFHLE9BQU8sQ0FBQztRQUNuQixDQUFDO2FBQU0sSUFBSSxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztZQUN0RyxJQUFJLEdBQUcsTUFBTSxDQUFDO1FBQ2xCLENBQUM7YUFBTSxJQUFJLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBQUUsQ0FBQztZQUMxRCxJQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ3ZCLENBQUM7SUFDTCxDQUFDO0lBRUQsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsQ0FBQztBQUNyRixDQUFDO0FBRUQsaUVBQWlFO0FBQ2pFLFNBQWdCLGdCQUFnQixDQUFDLFFBQWdCO0lBQzdDLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUM1QixJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUN0QixJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDbkIsT0FBTztnQkFDSCxDQUFDLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDcEMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3BDLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNwQyxDQUFDLEVBQUUsR0FBRzthQUNULENBQUM7UUFDTixDQUFDO2FBQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzFCLE9BQU87Z0JBQ0gsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3BDLENBQUMsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNwQyxDQUFDLEVBQUUsUUFBUSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDcEMsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7YUFDdkMsQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0lBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsUUFBUSwwRUFBMEUsQ0FBQyxDQUFDO0FBQ2xJLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNVLFFBQUEsOEJBQThCLEdBQUc7SUFDMUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxPQUFPO0lBQ2hDLFVBQVUsRUFBRSxTQUFTLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsZUFBZTtJQUMxRSxNQUFNLEVBQUUsVUFBVSxFQUFFLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsV0FBVztJQUNoRixlQUFlLEVBQUUsWUFBWTtDQUN2QixDQUFDO0FBRVg7Ozs7Ozs7OztHQVNHO0FBQ1UsUUFBQSwyQkFBMkIsR0FBcUM7SUFDekUsUUFBUSxFQUFFLGFBQWE7SUFDdkIsT0FBTyxFQUFFLGNBQWM7SUFDdkIsV0FBVyxFQUFFLGdCQUFnQjtJQUM3QixXQUFXLEVBQUUsZ0JBQWdCO0lBQzdCLE1BQU0sRUFBRSxXQUFXO0lBQ25CLFNBQVMsRUFBRSxjQUFjO0lBQ3pCLElBQUksRUFBRSxTQUFTO0lBQ2YsYUFBYSxFQUFFLGtCQUFrQjtJQUNqQyxJQUFJLEVBQUUsU0FBUztJQUNmLFFBQVEsRUFBRSxhQUFhO0lBQ3ZCLGVBQWUsRUFBRSxvQkFBb0I7SUFDckMsYUFBYSxFQUFFLGtCQUFrQjtJQUNqQyxTQUFTLEVBQUUsY0FBYztJQUN6QixTQUFTLEVBQUUsY0FBYztJQUN6QixhQUFhLEVBQUUsa0JBQWtCO0lBQ2pDLFVBQVUsRUFBRSxlQUFlO0NBQzlCLENBQUM7QUFFRixtR0FBbUc7QUFDdEYsUUFBQSx3QkFBd0IsR0FBRztJQUNwQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsU0FBUztJQUNqRCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNO0lBQy9CLE1BQU0sRUFBRSxXQUFXO0lBQ25CLEdBQUcsc0NBQThCO0lBQ2pDLFdBQVcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxnQkFBZ0I7Q0FDbkUsQ0FBQztBQUVYOzs7R0FHRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLFlBQW9CLEVBQUUsS0FBVTtJQUNqRSxJQUFLLHNDQUFvRCxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1FBQy9FLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtZQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLFlBQVksOEJBQThCLENBQUMsQ0FBQztJQUNuRSxDQUFDO0lBQ0QsUUFBUSxZQUFZLEVBQUUsQ0FBQztRQUNuQixLQUFLLFFBQVE7WUFDVCxPQUFPLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QixLQUFLLFFBQVEsQ0FBQztRQUFDLEtBQUssU0FBUyxDQUFDO1FBQUMsS0FBSyxPQUFPO1lBQ3ZDLE9BQU8sTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3pCLEtBQUssU0FBUztZQUNWLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzFCLEtBQUssT0FBTztZQUNSLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtnQkFBRSxPQUFPLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzlELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUUsQ0FBQztnQkFDOUMsT0FBTztvQkFDSCxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztvQkFDbkQsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ25ELENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO29CQUNuRCxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHO2lCQUMvRSxDQUFDO1lBQ04sQ0FBQztZQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsaUdBQWlHLENBQUMsQ0FBQztRQUN2SCxLQUFLLE1BQU07WUFDUCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSTtnQkFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzdHLE1BQU0sSUFBSSxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztRQUN6RSxLQUFLLE1BQU07WUFDUCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLEtBQUssSUFBSTtnQkFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN0SSxNQUFNLElBQUksS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7UUFDNUUsS0FBSyxNQUFNO1lBQ1AsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLElBQUk7Z0JBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUMvSCxNQUFNLElBQUksS0FBSyxDQUFDLDREQUE0RCxDQUFDLENBQUM7UUFDbEYsS0FBSyxNQUFNO1lBQ1AsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO2dCQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUM7WUFDdEQsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQyxDQUFDO1FBQ2xFLEtBQUssV0FBVztZQUNaLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtnQkFBRSxPQUFPLEtBQUssQ0FBQyxDQUFDLDJCQUEyQjtZQUN4RSxNQUFNLElBQUksS0FBSyxDQUFDLHdGQUF3RixDQUFDLENBQUM7UUFDOUcsS0FBSyxnQkFBZ0I7WUFDakIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtvQkFDckQsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRO3dCQUFFLE9BQU8sSUFBSSxDQUFDLENBQUMsNENBQTRDO29CQUN2RixNQUFNLElBQUksS0FBSyxDQUFDLHVGQUF1RixDQUFDLENBQUM7Z0JBQzdHLENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxJQUFJLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1FBQzdELEtBQUssV0FBVztZQUNaLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsR0FBRyxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVE7b0JBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdLLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztRQUN4RCxLQUFLLFlBQVk7WUFDYixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO29CQUNyRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLEtBQUssSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQzt3QkFDM0QsT0FBTyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO29CQUN0UCxDQUFDO29CQUNELE9BQU8sRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUM7Z0JBQzlDLENBQUMsQ0FBQyxDQUFDO1lBQ0gsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQ0FBbUMsQ0FBQyxDQUFDO1FBQ3pELEtBQUssYUFBYTtZQUNkLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7Z0JBQUUsT0FBTyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN4RSxNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFvQyxDQUFDLENBQUM7UUFDMUQsS0FBSyxhQUFhO1lBQ2QsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztnQkFBRSxPQUFPLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3hFLE1BQU0sSUFBSSxLQUFLLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUMxRDtZQUNJLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLFlBQVksc0JBQXNCLGdDQUF3QixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDL0gsQ0FBQztBQUNMLENBQUM7QUFFRCxxRkFBcUY7QUFDckYsU0FBZ0IsMkJBQTJCLENBQUMsYUFBcUIsRUFBRSxjQUF3QixFQUFFLFFBQWdCO0lBQ3pHLE1BQU0sWUFBWSxHQUFHLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FDOUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsV0FBVyxFQUFFLENBQUM7UUFDeEQsYUFBYSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FDM0QsQ0FBQztJQUVGLElBQUksV0FBVyxHQUFHLEVBQUUsQ0FBQztJQUNyQixJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDMUIsV0FBVyxJQUFJLCtCQUErQixZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDeEUsV0FBVyxJQUFJLG9DQUFvQyxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUMzRSxDQUFDO0lBRUQsTUFBTSxzQkFBc0IsR0FBNkI7UUFDckQsUUFBUSxFQUFFLENBQUMsVUFBVSxFQUFFLGFBQWEsRUFBRSxZQUFZLENBQUM7UUFDbkQsTUFBTSxFQUFFLENBQUMsVUFBVSxFQUFFLGFBQWEsQ0FBQztRQUNuQyxVQUFVLEVBQUUsQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDO1FBQ3ZDLGFBQWEsRUFBRSxDQUFDLFdBQVcsQ0FBQztRQUM1QixPQUFPLEVBQUUsQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQztRQUNqRCxhQUFhLEVBQUUsQ0FBQyxXQUFXLENBQUM7UUFDNUIsY0FBYyxFQUFFLENBQUMsV0FBVyxDQUFDO1FBQzdCLFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQztRQUN2QixhQUFhLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNqQyxhQUFhLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztLQUNwQyxDQUFDO0lBRUYsTUFBTSxxQkFBcUIsR0FBRyxzQkFBc0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDckUsTUFBTSxvQkFBb0IsR0FBRyxxQkFBcUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDakcsSUFBSSxvQkFBb0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDbEMsV0FBVyxJQUFJLHdCQUF3QixRQUFRLDhCQUE4QixvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztJQUNuSCxDQUFDO0lBRUQsV0FBVyxJQUFJLHNCQUFzQixDQUFDO0lBQ3RDLFdBQVcsSUFBSSw0RkFBNEYsQ0FBQztJQUM1RyxXQUFXLElBQUksMkVBQTJFLGFBQWEsR0FBRyxDQUFDO0lBQzNHLFdBQVcsSUFBSSxzRUFBc0UsQ0FBQztJQUV0RixPQUFPLFdBQVcsQ0FBQztBQUN2QixDQUFDO0FBRUQsMEVBQTBFO0FBQzFFLFNBQWdCLDBCQUEwQixDQUFDLFdBQW1CLEtBQUs7SUFDL0QsTUFBTSxtQkFBbUIsR0FBNkI7UUFDbEQsUUFBUSxFQUFFLENBQUMsV0FBVyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsU0FBUyxFQUFFLGFBQWEsQ0FBQztRQUM1RSxFQUFFLEVBQUUsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLGdCQUFnQixDQUFDO1FBQzVGLE9BQU8sRUFBRSxDQUFDLGdCQUFnQixFQUFFLGtCQUFrQixFQUFFLHFCQUFxQixFQUFFLHNCQUFzQixDQUFDO1FBQzlGLFNBQVMsRUFBRSxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxzQkFBc0IsQ0FBQztRQUN2RSxLQUFLLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQztRQUN6QixNQUFNLEVBQUUsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRSxzQkFBc0IsQ0FBQztRQUN6RSxPQUFPLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxxQkFBcUIsQ0FBQztRQUNuRCxNQUFNLEVBQUUsQ0FBQyxXQUFXLENBQUM7UUFDckIsS0FBSyxFQUFFLENBQUMsVUFBVSxFQUFFLHFCQUFxQixFQUFFLGVBQWUsRUFBRSxjQUFjLENBQUM7S0FDOUUsQ0FBQztJQUVGLElBQUksVUFBVSxHQUFhLEVBQUUsQ0FBQztJQUM5QixJQUFJLFFBQVEsS0FBSyxLQUFLLEVBQUUsQ0FBQztRQUNyQixLQUFLLE1BQU0sR0FBRyxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDcEMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUM3RCxDQUFDO0lBQ0wsQ0FBQztTQUFNLElBQUksbUJBQW1CLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztRQUN2QyxVQUFVLEdBQUcsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0MsQ0FBQztJQUVELE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVELHNHQUFzRztBQUN0RyxTQUFnQiwwQkFBMEIsQ0FBQyxJQUUxQztJQUNHLE1BQU0sRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUM7SUFDMUQsTUFBTSxtQkFBbUIsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ3ZHLE1BQU0sdUJBQXVCLEdBQUcsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFMUYsSUFBSSxhQUFhLEtBQUssU0FBUyxJQUFJLGFBQWEsS0FBSyxNQUFNLEVBQUUsQ0FBQztRQUMxRCxJQUFJLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3pDLE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLGFBQWEsUUFBUSxzREFBc0Q7Z0JBQ2xGLFdBQVcsRUFBRSxrREFBa0QsUUFBUSxnQkFBZ0IsUUFBUSxZQUFZLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLEVBQUU7YUFDckksQ0FBQztRQUNOLENBQUM7YUFBTSxJQUFJLHVCQUF1QixDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQ3BELE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLGFBQWEsUUFBUSwwREFBMEQ7Z0JBQ3RGLFdBQVcsRUFBRSxtREFBbUQsUUFBUSxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFO2FBQ3BILENBQUM7UUFDTixDQUFDO0lBQ0wsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUM7QUFFRCxrR0FBa0c7QUFDM0YsS0FBSyxVQUFVLDZCQUE2QixDQUMvQyxRQUFnQixFQUNoQixhQUFxQixFQUNyQixRQUFnQixFQUNoQixhQUFrQixFQUNsQixhQUFrQixFQUNsQixnQkFBd0Y7O0lBRXhGLElBQUksQ0FBQztRQUNELE1BQU0sYUFBYSxHQUFHLE1BQU0sZ0JBQWdCLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3RFLElBQUksYUFBYSxDQUFDLE9BQU8sSUFBSSxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDOUMsaUVBQWlFO1lBQ2pFLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDckMsSUFBSSxZQUFZLEdBQVEsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDdEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLElBQUksWUFBWSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQ3ZELFlBQVksR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLE1BQU0sTUFBTSxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQztnQkFDekMsSUFBSSxDQUFDLE1BQU0sSUFBSSxZQUFZLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxZQUFZLElBQUksT0FBTyxZQUFZLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO29CQUNuSSxZQUFZLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQztnQkFDdEMsQ0FBQztZQUNMLENBQUM7WUFDRCxJQUFJLFdBQVcsR0FBRyxZQUFZLENBQUM7WUFDL0IsSUFBSSxZQUFZLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSSxZQUFZLEVBQUUsQ0FBQztnQkFDOUUsV0FBVyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUM7WUFDckMsQ0FBQztZQUVELElBQUksUUFBUSxHQUFHLEtBQUssQ0FBQztZQUNyQixJQUFJLE9BQU8sYUFBYSxLQUFLLFFBQVEsSUFBSSxhQUFhLEtBQUssSUFBSSxJQUFJLE1BQU0sSUFBSSxhQUFhLEVBQUUsQ0FBQztnQkFDekYsTUFBTSxVQUFVLEdBQUcsV0FBVyxJQUFJLE9BQU8sV0FBVyxLQUFLLFFBQVEsSUFBSSxNQUFNLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ25ILE1BQU0sWUFBWSxHQUFHLGFBQWEsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUM5QyxRQUFRLEdBQUcsVUFBVSxLQUFLLFlBQVksSUFBSSxZQUFZLEtBQUssRUFBRSxDQUFDO1lBQ2xFLENBQUM7aUJBQU0sSUFBSSxPQUFPLFdBQVcsS0FBSyxPQUFPLGFBQWEsRUFBRSxDQUFDO2dCQUNyRCxJQUFJLE9BQU8sV0FBVyxLQUFLLFFBQVEsSUFBSSxXQUFXLEtBQUssSUFBSSxJQUFJLGFBQWEsS0FBSyxJQUFJLEVBQUUsQ0FBQztvQkFDcEYsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDN0UsQ0FBQztxQkFBTSxDQUFDO29CQUNKLFFBQVEsR0FBRyxXQUFXLEtBQUssYUFBYSxDQUFDO2dCQUM3QyxDQUFDO1lBQ0wsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLFFBQVEsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsS0FBSyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDOUcsQ0FBQztZQUVELE9BQU87Z0JBQ0gsUUFBUTtnQkFDUixXQUFXO2dCQUNYLFFBQVEsRUFBRTtvQkFDTixnQkFBZ0IsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFO29CQUNuSCxnQkFBZ0IsRUFBRSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQSxNQUFBLGFBQWEsQ0FBQyxJQUFJLDBDQUFFLFVBQVUsS0FBSSxFQUFFLENBQUMsQ0FBQyxNQUFNLEVBQUU7aUJBQzNIO2FBQ0osQ0FBQztRQUNOLENBQUM7SUFDTCxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkRBQTZELEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUNELE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO0FBQ3ZFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFB1cmUgaGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tcG9uZW50IHByb3BlcnR5IGFuYWx5c2lzLCB2YWxpZGF0aW9uLCBhbmQgcXVlcnkgdXRpbGl0aWVzLlxuICogRXh0cmFjdGVkIGZyb20gTWFuYWdlQ29tcG9uZW50IHRvIGtlZXAgbWFuYWdlLWNvbXBvbmVudC50cyB1bmRlciAyMDAgbGluZXMuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGludGVyZmFjZSBQcm9wZXJ0eUFuYWx5c2lzUmVzdWx0IHtcbiAgICBleGlzdHM6IGJvb2xlYW47XG4gICAgdHlwZTogc3RyaW5nO1xuICAgIGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdO1xuICAgIG9yaWdpbmFsVmFsdWU6IGFueTtcbn1cblxuLyoqIFJldHVybnMgdHJ1ZSBpZiBwcm9wRGF0YSBsb29rcyBsaWtlIGEgQ29jb3MgQ3JlYXRvciBwcm9wZXJ0eSBkZXNjcmlwdG9yIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3IocHJvcERhdGE6IGFueSk6IGJvb2xlYW4ge1xuICAgIGlmICh0eXBlb2YgcHJvcERhdGEgIT09ICdvYmplY3QnIHx8IHByb3BEYXRhID09PSBudWxsKSByZXR1cm4gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhKTtcbiAgICAgICAgLy8gU2tpcCBzaW1wbGUgdmFsdWUgb2JqZWN0cyBsaWtlIHt3aWR0aDogMjAwLCBoZWlnaHQ6IDE1MH1cbiAgICAgICAgY29uc3QgaXNTaW1wbGVWYWx1ZU9iamVjdCA9IGtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHYgPSBwcm9wRGF0YVtrZXldO1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHYgPT09ICdib29sZWFuJztcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChpc1NpbXBsZVZhbHVlT2JqZWN0KSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IGhhc05hbWUgPSBrZXlzLmluY2x1ZGVzKCduYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1ZhbHVlID0ga2V5cy5pbmNsdWRlcygndmFsdWUnKTtcbiAgICAgICAgY29uc3QgaGFzVHlwZSA9IGtleXMuaW5jbHVkZXMoJ3R5cGUnKTtcbiAgICAgICAgY29uc3QgaGFzRGlzcGxheU5hbWUgPSBrZXlzLmluY2x1ZGVzKCdkaXNwbGF5TmFtZScpO1xuICAgICAgICBjb25zdCBoYXNSZWFkb25seSA9IGtleXMuaW5jbHVkZXMoJ3JlYWRvbmx5Jyk7XG4gICAgICAgIGNvbnN0IGhhc1ZhbGlkU3RydWN0dXJlID0gKGhhc05hbWUgfHwgaGFzVmFsdWUpICYmIChoYXNUeXBlIHx8IGhhc0Rpc3BsYXlOYW1lIHx8IGhhc1JlYWRvbmx5KTtcbiAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ2RlZmF1bHQnKSAmJiBwcm9wRGF0YS5kZWZhdWx0ICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgY29uc3QgZGVmYXVsdEtleXMgPSBPYmplY3Qua2V5cyhwcm9wRGF0YS5kZWZhdWx0KTtcbiAgICAgICAgICAgIGlmIChkZWZhdWx0S2V5cy5pbmNsdWRlcygndmFsdWUnKSAmJiB0eXBlb2YgcHJvcERhdGEuZGVmYXVsdC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGhhc1ZhbGlkU3RydWN0dXJlO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxufVxuXG4vKiogQW5hbHl6ZSBhIGNvbXBvbmVudCdzIHByb3BlcnR5IHRvIGRldGVybWluZSBpdHMgdHlwZSBhbmQgY3VycmVudCB2YWx1ZS5cbiAqICBTdXBwb3J0cyBkb3R0ZWQgcHJvcGVydHlOYW1lIGZvciBuZXN0ZWQgQ0NDbGFzcyBncm91cHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFuYWx5emVQcm9wZXJ0eShjb21wb25lbnQ6IGFueSwgcHJvcGVydHlOYW1lOiBzdHJpbmcpOiBQcm9wZXJ0eUFuYWx5c2lzUmVzdWx0IHtcbiAgICBjb25zdCBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxldCBwcm9wZXJ0eVZhbHVlOiBhbnkgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHByb3BlcnR5RXhpc3RzID0gZmFsc2U7XG5cbiAgICAvLyBNZXRob2QgMTogZGlyZWN0IHByb3BlcnR5IGFjY2VzcyAoZmxhdCBwYXRoIG9ubHkpXG4gICAgaWYgKCFwcm9wZXJ0eU5hbWUuaW5jbHVkZXMoJy4nKSAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoY29tcG9uZW50LCBwcm9wZXJ0eU5hbWUpKSB7XG4gICAgICAgIHByb3BlcnR5VmFsdWUgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcbiAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIE1ldGhvZCAyOiBzZWFyY2ggbmVzdGVkIHByb3BlcnRpZXMgc3RydWN0dXJlIChDb2NvcyBDcmVhdG9yIGNvbXBvbmVudCBkdW1wIGZvcm1hdCkuXG4gICAgLy8gIEZvciBkb3R0ZWQgbmFtZXMgbGlrZSBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiLCB3YWxrIHNlZ21lbnRzIHRocm91Z2ggbmVzdGVkIGAudmFsdWVgIGR1bXBzLlxuICAgIGlmICghcHJvcGVydHlFeGlzdHMgJiYgY29tcG9uZW50LnByb3BlcnRpZXMgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCByb290VmFsdWVPYmogPSBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSAmJiB0eXBlb2YgY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWUgPT09ICdvYmplY3QnXG4gICAgICAgICAgICA/IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlXG4gICAgICAgICAgICA6IGNvbXBvbmVudC5wcm9wZXJ0aWVzO1xuXG4gICAgICAgIGNvbnN0IHNlZ21lbnRzID0gcHJvcGVydHlOYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGxldCBjdXJzb3I6IGFueSA9IHJvb3RWYWx1ZU9iajtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlZ21lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBzZWdtZW50ID0gc2VnbWVudHNbaV07XG4gICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuXG4gICAgICAgICAgICAvLyBQb3B1bGF0ZSBhdmFpbGFibGVQcm9wZXJ0aWVzIGF0IHRoZSByZWxldmFudCBsZXZlbCAocm9vdCBvciBmaW5hbCBjb250YWluZXIpXG4gICAgICAgICAgICBpZiAoaSA9PT0gMCB8fCAoaSA9PT0gc2VnbWVudHMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhjdXJzb3IgfHwge30pKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh2ICYmIHR5cGVvZiB2ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZml4ID0gaSA9PT0gMCA/ICcnIDogYCR7c2VnbWVudHMuc2xpY2UoMCwgaSkuam9pbignLicpfS5gO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGAke3ByZWZpeH0ke2t9YCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGRlc2NyaXB0b3IgPSBjdXJzb3IgPyBjdXJzb3Jbc2VnbWVudF0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICBpZiAoZGVzY3JpcHRvciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoaXNMZWFmKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzVmFsaWRQcm9wZXJ0eURlc2NyaXB0b3IoZGVzY3JpcHRvcikpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZEtleXMgPSBPYmplY3Qua2V5cyhkZXNjcmlwdG9yKTtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpID8gZGVzY3JpcHRvci52YWx1ZSA6IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGRlc2NyaXB0b3I7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHByb3BlcnR5RXhpc3RzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gRGVzY2VuZCBpbnRvIHRoZSBuZXN0ZWQgQ0NDbGFzcyBncm91cDogZGVzY3JpcHRvci52YWx1ZSBob2xkcyB0aGUgaW5uZXIgZHVtcC5cbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yICYmIHR5cGVvZiBkZXNjcmlwdG9yID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgY3Vyc29yID0gZGVzY3JpcHRvci52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSBkZXNjcmlwdG9yO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBNZXRob2QgMzogY29sbGVjdCBzaW1wbGUgcHJvcGVydHkgbmFtZXMgZnJvbSBkaXJlY3Qga2V5cyBhcyBmYWxsYmFja1xuICAgIGlmIChhdmFpbGFibGVQcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhjb21wb25lbnQpKSB7XG4gICAgICAgICAgICBpZiAoIWtleS5zdGFydHNXaXRoKCdfJykgJiYgIVsnX190eXBlX18nLCAnY2lkJywgJ25vZGUnLCAndXVpZCcsICduYW1lJywgJ2VuYWJsZWQnLCAndHlwZScsICdyZWFkb25seScsICd2aXNpYmxlJ10uaW5jbHVkZXMoa2V5KSkge1xuICAgICAgICAgICAgICAgIGF2YWlsYWJsZVByb3BlcnRpZXMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFwcm9wZXJ0eUV4aXN0cykge1xuICAgICAgICByZXR1cm4geyBleGlzdHM6IGZhbHNlLCB0eXBlOiAndW5rbm93bicsIGF2YWlsYWJsZVByb3BlcnRpZXMsIG9yaWdpbmFsVmFsdWU6IHVuZGVmaW5lZCB9O1xuICAgIH1cblxuICAgIC8vIEluZmVyIHR5cGUgZnJvbSB2YWx1ZSBzdHJ1Y3R1cmVcbiAgICBsZXQgdHlwZSA9ICd1bmtub3duJztcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eVZhbHVlKSkge1xuICAgICAgICBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSkgdHlwZSA9ICdub2RlQXJyYXknO1xuICAgICAgICBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29sb3InKSkgdHlwZSA9ICdjb2xvckFycmF5JztcbiAgICAgICAgZWxzZSB0eXBlID0gJ2FycmF5JztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICB0eXBlID0gWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkgPyAnYXNzZXQnIDogJ3N0cmluZyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdHlwZSA9ICdudW1iZXInO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgICB0eXBlID0gJ2Jvb2xlYW4nO1xuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSAmJiB0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wZXJ0eVZhbHVlKTtcbiAgICAgICAgICAgIGlmIChrZXlzLmluY2x1ZGVzKCdyJykgJiYga2V5cy5pbmNsdWRlcygnZycpICYmIGtleXMuaW5jbHVkZXMoJ2InKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAnY29sb3InO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd4JykgJiYga2V5cy5pbmNsdWRlcygneScpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9IHByb3BlcnR5VmFsdWUueiAhPT0gdW5kZWZpbmVkID8gJ3ZlYzMnIDogJ3ZlYzInO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd3aWR0aCcpICYmIGtleXMuaW5jbHVkZXMoJ2hlaWdodCcpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdzaXplJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygndXVpZCcpIHx8IGtleXMuaW5jbHVkZXMoJ19fdXVpZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpIHx8IGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSA/ICdub2RlJyA6ICdhc3NldCc7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAocHJvcGVydHlWYWx1ZSA9PT0gbnVsbCB8fCBwcm9wZXJ0eVZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ2Fzc2V0JztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcbiAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnY29tcG9uZW50JykpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnY29tcG9uZW50JztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7IGV4aXN0czogdHJ1ZSwgdHlwZSwgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogcHJvcGVydHlWYWx1ZSB9O1xufVxuXG4vKiogUGFyc2UgYSBoZXggY29sb3Igc3RyaW5nICgjUkdCIG9yICNSR0JBKSB0byBhbiBSR0JBIG9iamVjdCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29sb3JTdHJpbmcoY29sb3JTdHI6IHN0cmluZyk6IHsgcjogbnVtYmVyOyBnOiBudW1iZXI7IGI6IG51bWJlcjsgYTogbnVtYmVyIH0ge1xuICAgIGNvbnN0IHN0ciA9IGNvbG9yU3RyLnRyaW0oKTtcbiAgICBpZiAoc3RyLnN0YXJ0c1dpdGgoJyMnKSkge1xuICAgICAgICBpZiAoc3RyLmxlbmd0aCA9PT0gNykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiAyNTVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSBpZiAoc3RyLmxlbmd0aCA9PT0gOSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXG4gICAgICAgICAgICAgICAgZzogcGFyc2VJbnQoc3RyLnN1YnN0cmluZygzLCA1KSwgMTYpLFxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcbiAgICAgICAgICAgICAgICBhOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDcsIDkpLCAxNilcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGNvbG9yIGZvcm1hdDogXCIke2NvbG9yU3RyfVwiLiBPbmx5IGhleGFkZWNpbWFsIGZvcm1hdCBpcyBzdXBwb3J0ZWQgKGUuZy4sIFwiI0ZGMDAwMFwiIG9yIFwiI0ZGMDAwMEZGXCIpYCk7XG59XG5cbi8qKlxuICogQ29jb3MgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5IHR5cGVzLiBFdmVyeSBvbmUgb2YgdGhlc2Ugc2VyaWFsaXplcyBpZGVudGljYWxseSBhc1xuICogYHsgdXVpZCB9YCAoaXNzdWUgIzI2IOKAlCBwcm9wZXJ0eVR5cGU9XCJtYXRlcmlhbFwiIGFuZCBmcmllbmRzIHByZXZpb3VzbHkgZmVsbCB0aHJvdWdoIHRvXG4gKiBgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZWAsIGV2ZW4gdGhvdWdoIHRoZSBleGlzdGluZyBzcHJpdGVGcmFtZS9wcmVmYWIvYXNzZXQgY29lcmNpb25cbiAqIGFscmVhZHkgcHJvZHVjZXMgdGhlIGNvcnJlY3Qgc2hhcGUgZm9yIHRoZW0pLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfUkVGRVJFTkNFX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICdtYXRlcmlhbCcsICd0ZXh0dXJlJywgJ3Nwcml0ZUF0bGFzJywgJ2F1ZGlvQ2xpcCcsICdmb250JywgJ2FuaW1hdGlvbkNsaXAnLFxuICAgICdtZXNoJywgJ3NrZWxldG9uJywgJ3BoeXNpY3NNYXRlcmlhbCcsICdyZW5kZXJUZXh0dXJlJywgJ3RleHRBc3NldCcsICdqc29uQXNzZXQnLFxuICAgICdwYXJ0aWNsZUFzc2V0JywgJ3NjZW5lQXNzZXQnXG5dIGFzIGNvbnN0O1xuXG4vKipcbiAqIEV4cGxpY2l0IHByb3BlcnR5VHlwZSAtPiBDb2NvcyBhc3NldCBjbGFzcyBmb3IgdGhlIEVkaXRvciBgc2V0LXByb3BlcnR5YCBkdW1wIGB0eXBlYCBmaWVsZC5cbiAqXG4gKiBSZXNvbHZlZCBmcm9tIHRoZSBwcm9wZXJ0eVR5cGUgaXRzZWxmLCBOT1QgZnJvbSB0aGUgcHJvcGVydHkgbmFtZS4gVGhlIGxlZ2FjeSBuYW1lLWJhc2VkXG4gKiBoZXVyaXN0aWMgaW4gYGFwcGx5UHJvcGVydHlUb0VkaXRvcmAgbWlzLXJlc29sdmVzIGFueSBhc3NldCBwcm9wZXJ0eSB3aG9zZSBuYW1lIGxhY2tzIHRoZVxuICogbWF0Y2hpbmcga2V5d29yZCDigJQgYSBgY2MuTWF0ZXJpYWxgIHByb3BlcnR5IGNhbGxlZCBgc2tpbmAgcmVzb2x2ZWQgdG8gYGNjLlNwcml0ZUZyYW1lYC5cbiAqXG4gKiBUaGUgZ2VuZXJpYyBgYXNzZXRgIGFuZCBgc3RyaW5nYCBzcGVsbGluZ3MgY2Fycnkgbm8gdHlwZSBpbmZvcm1hdGlvbiwgc28gdGhleSBkZWxpYmVyYXRlbHlcbiAqIGhhdmUgTk8gZW50cnkgaGVyZSBhbmQga2VlcCB1c2luZyB0aGUgbmFtZSBoZXVyaXN0aWMgKHVuY2hhbmdlZCBiZWhhdmlvdXIgZm9yIGV4aXN0aW5nIGNhbGxlcnMpLlxuICovXG5leHBvcnQgY29uc3QgQVNTRVRfVFlQRV9CWV9QUk9QRVJUWV9UWVBFOiBSZWFkb25seTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PiA9IHtcbiAgICBtYXRlcmlhbDogJ2NjLk1hdGVyaWFsJyxcbiAgICB0ZXh0dXJlOiAnY2MuVGV4dHVyZTJEJyxcbiAgICBzcHJpdGVGcmFtZTogJ2NjLlNwcml0ZUZyYW1lJyxcbiAgICBzcHJpdGVBdGxhczogJ2NjLlNwcml0ZUF0bGFzJyxcbiAgICBwcmVmYWI6ICdjYy5QcmVmYWInLFxuICAgIGF1ZGlvQ2xpcDogJ2NjLkF1ZGlvQ2xpcCcsXG4gICAgZm9udDogJ2NjLkZvbnQnLFxuICAgIGFuaW1hdGlvbkNsaXA6ICdjYy5BbmltYXRpb25DbGlwJyxcbiAgICBtZXNoOiAnY2MuTWVzaCcsXG4gICAgc2tlbGV0b246ICdjYy5Ta2VsZXRvbicsXG4gICAgcGh5c2ljc01hdGVyaWFsOiAnY2MuUGh5c2ljc01hdGVyaWFsJyxcbiAgICByZW5kZXJUZXh0dXJlOiAnY2MuUmVuZGVyVGV4dHVyZScsXG4gICAgdGV4dEFzc2V0OiAnY2MuVGV4dEFzc2V0JyxcbiAgICBqc29uQXNzZXQ6ICdjYy5Kc29uQXNzZXQnLFxuICAgIHBhcnRpY2xlQXNzZXQ6ICdjYy5QYXJ0aWNsZUFzc2V0JyxcbiAgICBzY2VuZUFzc2V0OiAnY2MuU2NlbmVBc3NldCdcbn07XG5cbi8qKiBFdmVyeSBwcm9wZXJ0eVR5cGUgY29udmVydFByb3BlcnR5VmFsdWUgYWNjZXB0cyDigJQgdXNlZCB0byBidWlsZCBhbiBhY3Rpb25hYmxlIGVycm9yIG1lc3NhZ2UuICovXG5leHBvcnQgY29uc3QgU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTID0gW1xuICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2ludGVnZXInLCAnZmxvYXQnLCAnYm9vbGVhbicsXG4gICAgJ2NvbG9yJywgJ3ZlYzInLCAndmVjMycsICdzaXplJyxcbiAgICAnbm9kZScsICdjb21wb25lbnQnLFxuICAgIC4uLkFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyxcbiAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknLCAnY29tcG9uZW50QXJyYXknXG5dIGFzIGNvbnN0O1xuXG4vKipcbiAqIENvbnZlcnQgYSByYXcgTExNLXN1cHBsaWVkIHZhbHVlIHRvIHRoZSBjb3JyZWN0IGZvcm1hdCBmb3IgYSBnaXZlbiBwcm9wZXJ0eVR5cGUuXG4gKiBUaHJvd3MgaWYgdGhlIHZhbHVlIGZvcm1hdCBpcyBpbnZhbGlkIGZvciB0aGUgZ2l2ZW4gdHlwZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnRQcm9wZXJ0eVZhbHVlKHByb3BlcnR5VHlwZTogc3RyaW5nLCB2YWx1ZTogYW55KTogYW55IHtcbiAgICBpZiAoKEFTU0VUX1JFRkVSRU5DRV9QUk9QRVJUWV9UWVBFUyBhcyByZWFkb25seSBzdHJpbmdbXSkuaW5jbHVkZXMocHJvcGVydHlUeXBlKSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGAke3Byb3BlcnR5VHlwZX0gdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEYCk7XG4gICAgfVxuICAgIHN3aXRjaCAocHJvcGVydHlUeXBlKSB7XG4gICAgICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyJzogY2FzZSAnaW50ZWdlcic6IGNhc2UgJ2Zsb2F0JzpcbiAgICAgICAgICAgIHJldHVybiBOdW1iZXIodmFsdWUpO1xuICAgICAgICBjYXNlICdib29sZWFuJzpcbiAgICAgICAgICAgIHJldHVybiBCb29sZWFuKHZhbHVlKTtcbiAgICAgICAgY2FzZSAnY29sb3InOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiBwYXJzZUNvbG9yU3RyaW5nKHZhbHVlKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUucikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBnOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5nKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmIpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYTogdmFsdWUuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuYSkpKSA6IDI1NVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbG9yIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggciwgZywgYiBwcm9wZXJ0aWVzIG9yIGEgaGV4YWRlY2ltYWwgc3RyaW5nIChlLmcuLCBcIiNGRjAwMDBcIiknKTtcbiAgICAgICAgY2FzZSAndmVjMic6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKHZhbHVlLngpIHx8IDAsIHk6IE51bWJlcih2YWx1ZS55KSB8fCAwIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZlYzIgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB4LCB5IHByb3BlcnRpZXMnKTtcbiAgICAgICAgY2FzZSAndmVjMyc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkgcmV0dXJuIHsgeDogTnVtYmVyKHZhbHVlLngpIHx8IDAsIHk6IE51bWJlcih2YWx1ZS55KSB8fCAwLCB6OiBOdW1iZXIodmFsdWUueikgfHwgMCB9O1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWZWMzIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSwgeiBwcm9wZXJ0aWVzJyk7XG4gICAgICAgIGNhc2UgJ3NpemUnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHJldHVybiB7IHdpZHRoOiBOdW1iZXIodmFsdWUud2lkdGgpIHx8IDAsIGhlaWdodDogTnVtYmVyKHZhbHVlLmhlaWdodCkgfHwgMCB9O1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTaXplIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggd2lkdGgsIGhlaWdodCBwcm9wZXJ0aWVzJyk7XG4gICAgICAgIGNhc2UgJ25vZGUnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB7IHV1aWQ6IHZhbHVlIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vZGUgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRCcpO1xuICAgICAgICBjYXNlICdjb21wb25lbnQnOlxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiB2YWx1ZTsgLy8gcmVzb2x2ZWQgdG8gX19pZF9fIGxhdGVyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudCByZWZlcmVuY2UgdmFsdWUgbXVzdCBiZSBhIHN0cmluZyAobm9kZSBVVUlEIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpJyk7XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudEFycmF5JzpcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIGl0ZW07IC8vIGVhY2ggcmVzb2x2ZWQgdG8gYSBjb21wb25lbnQgX19pZF9fIGxhdGVyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb21wb25lbnRBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBub2RlIFVVSURzIChlYWNoIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpJyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50QXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xuICAgICAgICBjYXNlICdub2RlQXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IHsgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogaXRlbSB9OyB0aHJvdyBuZXcgRXJyb3IoJ05vZGVBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBVVUlEcycpOyB9KTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm9kZUFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgY2FzZSAnY29sb3JBcnJheSc6XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSwgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLCBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb2xvckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyQXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IE51bWJlcihpdGVtKSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ051bWJlckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgY2FzZSAnc3RyaW5nQXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IFN0cmluZyhpdGVtKSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0cmluZ0FycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZTogJHtwcm9wZXJ0eVR5cGV9LiBTdXBwb3J0ZWQgdHlwZXM6ICR7U1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTLmpvaW4oJywgJyl9YCk7XG4gICAgfVxufVxuXG4vKiogR2VuZXJhdGUgYW4gTExNLWZyaWVuZGx5IHN1Z2dlc3Rpb24gd2hlbiByZXF1ZXN0ZWQgY29tcG9uZW50IHR5cGUgaXMgbm90IGZvdW5kICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uKHJlcXVlc3RlZFR5cGU6IHN0cmluZywgYXZhaWxhYmxlVHlwZXM6IHN0cmluZ1tdLCBwcm9wZXJ0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBzaW1pbGFyVHlwZXMgPSBhdmFpbGFibGVUeXBlcy5maWx0ZXIodHlwZSA9PlxuICAgICAgICB0eXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpKSB8fFxuICAgICAgICByZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModHlwZS50b0xvd2VyQ2FzZSgpKVxuICAgICk7XG5cbiAgICBsZXQgaW5zdHJ1Y3Rpb24gPSAnJztcbiAgICBpZiAoc2ltaWxhclR5cGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkZvdW5kIHNpbWlsYXIgY29tcG9uZW50czogJHtzaW1pbGFyVHlwZXMuam9pbignLCAnKX1gO1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuU3VnZ2VzdGlvbjogUGVyaGFwcyB5b3UgbWVhbnQgJyR7c2ltaWxhclR5cGVzWzBdfSc/YDtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgICdzdHJpbmcnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLkVkaXRCb3gnXSxcbiAgICAgICAgJ3RleHQnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXG4gICAgICAgICdmb250U2l6ZSc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcbiAgICAgICAgJ3Nwcml0ZUZyYW1lJzogWydjYy5TcHJpdGUnXSxcbiAgICAgICAgJ2NvbG9yJzogWydjYy5MYWJlbCcsICdjYy5TcHJpdGUnLCAnY2MuR3JhcGhpY3MnXSxcbiAgICAgICAgJ25vcm1hbENvbG9yJzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ3ByZXNzZWRDb2xvcic6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICd0YXJnZXQnOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAnY29udGVudFNpemUnOiBbJ2NjLlVJVHJhbnNmb3JtJ10sXG4gICAgICAgICdhbmNob3JQb2ludCc6IFsnY2MuVUlUcmFuc2Zvcm0nXVxuICAgIH07XG5cbiAgICBjb25zdCByZWNvbW1lbmRlZENvbXBvbmVudHMgPSBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwW3Byb3BlcnR5XSB8fCBbXTtcbiAgICBjb25zdCBhdmFpbGFibGVSZWNvbW1lbmRlZCA9IHJlY29tbWVuZGVkQ29tcG9uZW50cy5maWx0ZXIoY29tcCA9PiBhdmFpbGFibGVUeXBlcy5pbmNsdWRlcyhjb21wKSk7XG4gICAgaWYgKGF2YWlsYWJsZVJlY29tbWVuZGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkJhc2VkIG9uIHByb3BlcnR5ICcke3Byb3BlcnR5fScsIHJlY29tbWVuZGVkIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlUmVjb21tZW5kZWQuam9pbignLCAnKX1gO1xuICAgIH1cblxuICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0ZWQgQWN0aW9uczpgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4xLiBVc2UgbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249Z2V0X2FsbCBub2RlVXVpZD1cIi4uLlwiIHRvIHZpZXcgYWxsIGNvbXBvbmVudHMgb24gdGhlIG5vZGVgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4yLiBJZiB5b3UgbmVlZCB0byBhZGQgYSBjb21wb25lbnQsIHVzZSBhY3Rpb249YWRkIHdpdGggY29tcG9uZW50VHlwZT1cIiR7cmVxdWVzdGVkVHlwZX1cImA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjMuIFZlcmlmeSB0aGF0IHRoZSBjb21wb25lbnQgdHlwZSBuYW1lIGlzIGNvcnJlY3QgKGNhc2Utc2Vuc2l0aXZlKWA7XG5cbiAgICByZXR1cm4gaW5zdHJ1Y3Rpb247XG59XG5cbi8qKiBSZXR1cm4gYXZhaWxhYmxlIENvY29zIENyZWF0b3IgYnVpbHQtaW4gY29tcG9uZW50IHR5cGVzIGJ5IGNhdGVnb3J5ICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QoY2F0ZWdvcnk6IHN0cmluZyA9ICdhbGwnKTogQWN0aW9uVG9vbFJlc3VsdCB7XG4gICAgY29uc3QgY29tcG9uZW50Q2F0ZWdvcmllczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICByZW5kZXJlcjogWydjYy5TcHJpdGUnLCAnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnLCAnY2MuTWFzaycsICdjYy5HcmFwaGljcyddLFxuICAgICAgICB1aTogWydjYy5CdXR0b24nLCAnY2MuVG9nZ2xlJywgJ2NjLlNsaWRlcicsICdjYy5TY3JvbGxWaWV3JywgJ2NjLkVkaXRCb3gnLCAnY2MuUHJvZ3Jlc3NCYXInXSxcbiAgICAgICAgcGh5c2ljczogWydjYy5SaWdpZEJvZHkyRCcsICdjYy5Cb3hDb2xsaWRlcjJEJywgJ2NjLkNpcmNsZUNvbGxpZGVyMkQnLCAnY2MuUG9seWdvbkNvbGxpZGVyMkQnXSxcbiAgICAgICAgYW5pbWF0aW9uOiBbJ2NjLkFuaW1hdGlvbicsICdjYy5BbmltYXRpb25DbGlwJywgJ2NjLlNrZWxldGFsQW5pbWF0aW9uJ10sXG4gICAgICAgIGF1ZGlvOiBbJ2NjLkF1ZGlvU291cmNlJ10sXG4gICAgICAgIGxheW91dDogWydjYy5MYXlvdXQnLCAnY2MuV2lkZ2V0JywgJ2NjLlBhZ2VWaWV3JywgJ2NjLlBhZ2VWaWV3SW5kaWNhdG9yJ10sXG4gICAgICAgIGVmZmVjdHM6IFsnY2MuTW90aW9uU3RyZWFrJywgJ2NjLlBhcnRpY2xlU3lzdGVtMkQnXSxcbiAgICAgICAgY2FtZXJhOiBbJ2NjLkNhbWVyYSddLFxuICAgICAgICBsaWdodDogWydjYy5MaWdodCcsICdjYy5EaXJlY3Rpb25hbExpZ2h0JywgJ2NjLlBvaW50TGlnaHQnLCAnY2MuU3BvdExpZ2h0J11cbiAgICB9O1xuXG4gICAgbGV0IGNvbXBvbmVudHM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGNhdGVnb3J5ID09PSAnYWxsJykge1xuICAgICAgICBmb3IgKGNvbnN0IGNhdCBpbiBjb21wb25lbnRDYXRlZ29yaWVzKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50cy5jb25jYXQoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRdKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV0pIHtcbiAgICAgICAgY29tcG9uZW50cyA9IGNvbXBvbmVudENhdGVnb3JpZXNbY2F0ZWdvcnldO1xuICAgIH1cblxuICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY2F0ZWdvcnksIGNvbXBvbmVudHMgfSk7XG59XG5cbi8qKiBSZWRpcmVjdCBzZXRfcHJvcGVydHkgY2FsbHMgdGhhdCB0YXJnZXQgbm9kZS1sZXZlbCBwcm9wZXJ0aWVzIHRvIHRoZSBjb3JyZWN0IG1hbmFnZV9ub2RlIGFjdGlvbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzKGFyZ3M6IHtcbiAgICBub2RlVXVpZDogc3RyaW5nOyBjb21wb25lbnRUeXBlOiBzdHJpbmc7IHByb3BlcnR5OiBzdHJpbmc7IHZhbHVlOiBhbnk7XG59KTogQWN0aW9uVG9vbFJlc3VsdCB8IG51bGwge1xuICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB2YWx1ZSB9ID0gYXJncztcbiAgICBjb25zdCBub2RlQmFzaWNQcm9wZXJ0aWVzID0gWyduYW1lJywgJ2FjdGl2ZScsICdsYXllcicsICdtb2JpbGl0eScsICdwYXJlbnQnLCAnY2hpbGRyZW4nLCAnaGlkZUZsYWdzJ107XG4gICAgY29uc3Qgbm9kZVRyYW5zZm9ybVByb3BlcnRpZXMgPSBbJ3Bvc2l0aW9uJywgJ3JvdGF0aW9uJywgJ3NjYWxlJywgJ2V1bGVyQW5nbGVzJywgJ2FuZ2xlJ107XG5cbiAgICBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLk5vZGUnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBpZiAobm9kZUJhc2ljUHJvcGVydGllcy5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGEgbm9kZSBiYXNpYyBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogYFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3Byb3BlcnR5IHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsIHByb3BlcnR5PVwiJHtwcm9wZXJ0eX1cIiwgdmFsdWU9JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlVHJhbnNmb3JtUHJvcGVydGllcy5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGEgbm9kZSB0cmFuc2Zvcm0gcHJvcGVydHksIG5vdCBhIGNvbXBvbmVudCBwcm9wZXJ0eWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF90cmFuc2Zvcm0gd2l0aCB1dWlkPVwiJHtub2RlVXVpZH1cIiwgJHtwcm9wZXJ0eX09JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKiogVmVyaWZ5IGEgcHJvcGVydHkgY2hhbmdlIHdhcyBhcHBsaWVkOyB1c2VzIGdldENvbXBvbmVudEluZm8gY2FsbGJhY2sgdG8gYXZvaWQgY2lyY3VsYXIgZGVwcyAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgb3JpZ2luYWxWYWx1ZTogYW55LFxuICAgIGV4cGVjdGVkVmFsdWU6IGFueSxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IGJvb2xlYW47IGFjdHVhbFZhbHVlOiBhbnk7IGZ1bGxEYXRhOiBhbnkgfT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudEluZm8gPSBhd2FpdCBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKGNvbXBvbmVudEluZm8uc3VjY2VzcyAmJiBjb21wb25lbnRJbmZvLmRhdGEpIHtcbiAgICAgICAgICAgIC8vIFdhbGsgZG90dGVkIHByb3BlcnR5IHBhdGhzIHRocm91Z2ggbmVzdGVkIENDQ2xhc3MgZ3JvdXAgZHVtcHMuXG4gICAgICAgICAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5LnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBsZXQgcHJvcGVydHlEYXRhOiBhbnkgPSBjb21wb25lbnRJbmZvLmRhdGEucHJvcGVydGllcztcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VnbWVudHMubGVuZ3RoICYmIHByb3BlcnR5RGF0YTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gcHJvcGVydHlEYXRhW3NlZ21lbnRzW2ldXTtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xuICAgICAgICAgICAgICAgIGlmICghaXNMZWFmICYmIHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhLnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eURhdGEgPSBwcm9wZXJ0eURhdGEudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IGFjdHVhbFZhbHVlID0gcHJvcGVydHlEYXRhO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5RGF0YSkge1xuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlID0gcHJvcGVydHlEYXRhLnZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgdmVyaWZpZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgZXhwZWN0ZWRWYWx1ZSAhPT0gbnVsbCAmJiAndXVpZCcgaW4gZXhwZWN0ZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbFV1aWQgPSBhY3R1YWxWYWx1ZSAmJiB0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBhY3R1YWxWYWx1ZSA/IGFjdHVhbFZhbHVlLnV1aWQgOiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCBleHBlY3RlZFV1aWQgPSBleHBlY3RlZFZhbHVlLnV1aWQgfHwgJyc7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQgJiYgZXhwZWN0ZWRVdWlkICE9PSAnJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSB0eXBlb2YgZXhwZWN0ZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmIGFjdHVhbFZhbHVlICE9PSBudWxsICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBKU09OLnN0cmluZ2lmeShhY3R1YWxWYWx1ZSkgPT09IEpTT04uc3RyaW5naWZ5KGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gYWN0dWFsVmFsdWUgPT09IGV4cGVjdGVkVmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IFN0cmluZyhhY3R1YWxWYWx1ZSkgPT09IFN0cmluZyhleHBlY3RlZFZhbHVlKSB8fCBOdW1iZXIoYWN0dWFsVmFsdWUpID09PSBOdW1iZXIoZXhwZWN0ZWRWYWx1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgZnVsbERhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWRQcm9wZXJ0eTogeyBuYW1lOiBwcm9wZXJ0eSwgYmVmb3JlOiBvcmlnaW5hbFZhbHVlLCBleHBlY3RlZDogZXhwZWN0ZWRWYWx1ZSwgYWN0dWFsOiBhY3R1YWxWYWx1ZSwgdmVyaWZpZWQgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3VtbWFyeTogeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgdG90YWxQcm9wZXJ0aWVzOiBPYmplY3Qua2V5cyhjb21wb25lbnRJbmZvLmRhdGE/LnByb3BlcnRpZXMgfHwge30pLmxlbmd0aCB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYW5hZ2VDb21wb25lbnQudmVyaWZ5UHJvcGVydHlDaGFuZ2VdIFZlcmlmaWNhdGlvbiBmYWlsZWQ6JywgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIGFjdHVhbFZhbHVlOiB1bmRlZmluZWQsIGZ1bGxEYXRhOiBudWxsIH07XG59XG4iXX0=