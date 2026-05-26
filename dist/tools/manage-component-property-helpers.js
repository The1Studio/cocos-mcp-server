"use strict";
/**
 * Pure helper functions for component property analysis, validation, and query utilities.
 * Extracted from ManageComponent to keep manage-component.ts under 200 lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
 * Convert a raw LLM-supplied value to the correct format for a given propertyType.
 * Throws if the value format is invalid for the given type.
 */
function convertPropertyValue(propertyType, value) {
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
        case 'spriteFrame':
        case 'prefab':
        case 'asset':
            if (typeof value === 'string')
                return { uuid: value };
            throw new Error(`${propertyType} value must be a string UUID`);
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
            throw new Error(`Unsupported property type: ${propertyType}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQVlILDhEQTBCQztBQUlELDBDQXVIQztBQUdELDRDQW9CQztBQU1ELG9EQXlEQztBQUdELGtFQXFDQztBQUdELGdFQXVCQztBQUdELGdFQXdCQztBQUdELHNFQXNEQztBQTNZRCxvQ0FBMkQ7QUFTM0QscUZBQXFGO0FBQ3JGLFNBQWdCLHlCQUF5QixDQUFDLFFBQWE7SUFDbkQsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksUUFBUSxLQUFLLElBQUk7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUNwRSxJQUFJLENBQUM7UUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25DLDJEQUEyRDtRQUMzRCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDekMsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hCLE9BQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDcEYsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLG1CQUFtQjtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxD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QztnQkFDSixRQUFRLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxhQUFhLENBQUMsSUFBSSxNQUFNLENBQUMsV0FBVyxDQUFDLEtBQUssTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQzlHLENBQUM7WUFFRCxPQUFPO2dCQUNILFFBQVE7Z0JBQ1IsV0FBVztnQkFDWCxRQUFRLEVBQUU7b0JBQ04sZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRTtvQkFDbkgsZ0JBQWdCLEVBQUUsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLGVBQWUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUEsTUFBQSxhQUFhLENBQUMsSUFBSSwwQ0FBRSxVQUFVLEtBQUksRUFBRSxDQUFDLENBQUMsTUFBTSxFQUFFO2lCQUMzSDthQUNKLENBQUM7UUFDTixDQUFDO0lBQ0wsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLDZEQUE2RCxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3hGLENBQUM7SUFDRCxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQztBQUN2RSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFB1cmUgaGVscGVyIGZ1bmN0aW9ucyBmb3IgY29tcG9uZW50IHByb3BlcnR5IGFuYWx5c2lzLCB2YWxpZGF0aW9uLCBhbmQgcXVlcnkgdXRpbGl0aWVzLlxyXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cclxuICovXHJcblxyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQcm9wZXJ0eUFuYWx5c2lzUmVzdWx0IHtcclxuICAgIGV4aXN0czogYm9vbGVhbjtcclxuICAgIHR5cGU6IHN0cmluZztcclxuICAgIGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdO1xyXG4gICAgb3JpZ2luYWxWYWx1ZTogYW55O1xyXG59XHJcblxyXG4vKiogUmV0dXJucyB0cnVlIGlmIHByb3BEYXRhIGxvb2tzIGxpa2UgYSBDb2NvcyBDcmVhdG9yIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0ICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yKHByb3BEYXRhOiBhbnkpOiBib29sZWFuIHtcclxuICAgIGlmICh0eXBlb2YgcHJvcERhdGEgIT09ICdvYmplY3QnIHx8IHByb3BEYXRhID09PSBudWxsKSByZXR1cm4gZmFsc2U7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wRGF0YSk7XHJcbiAgICAgICAgLy8gU2tpcCBzaW1wbGUgdmFsdWUgb2JqZWN0cyBsaWtlIHt3aWR0aDogMjAwLCBoZWlnaHQ6IDE1MH1cclxuICAgICAgICBjb25zdCBpc1NpbXBsZVZhbHVlT2JqZWN0ID0ga2V5cy5ldmVyeShrZXkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB2ID0gcHJvcERhdGFba2V5XTtcclxuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdiA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHYgPT09ICdib29sZWFuJztcclxuICAgICAgICB9KTtcclxuICAgICAgICBpZiAoaXNTaW1wbGVWYWx1ZU9iamVjdCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGhhc05hbWUgPSBrZXlzLmluY2x1ZGVzKCduYW1lJyk7XHJcbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSBrZXlzLmluY2x1ZGVzKCd2YWx1ZScpO1xyXG4gICAgICAgIGNvbnN0IGhhc1R5cGUgPSBrZXlzLmluY2x1ZGVzKCd0eXBlJyk7XHJcbiAgICAgICAgY29uc3QgaGFzRGlzcGxheU5hbWUgPSBrZXlzLmluY2x1ZGVzKCdkaXNwbGF5TmFtZScpO1xyXG4gICAgICAgIGNvbnN0IGhhc1JlYWRvbmx5ID0ga2V5cy5pbmNsdWRlcygncmVhZG9ubHknKTtcclxuICAgICAgICBjb25zdCBoYXNWYWxpZFN0cnVjdHVyZSA9IChoYXNOYW1lIHx8IGhhc1ZhbHVlKSAmJiAoaGFzVHlwZSB8fCBoYXNEaXNwbGF5TmFtZSB8fCBoYXNSZWFkb25seSk7XHJcbiAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ2RlZmF1bHQnKSAmJiBwcm9wRGF0YS5kZWZhdWx0ICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0ID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhLmRlZmF1bHQpO1xyXG4gICAgICAgICAgICBpZiAoZGVmYXVsdEtleXMuaW5jbHVkZXMoJ3ZhbHVlJykgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQudmFsdWUgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGhhc1ZhbGlkU3RydWN0dXJlO1xyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcblxyXG4vKiogQW5hbHl6ZSBhIGNvbXBvbmVudCdzIHByb3BlcnR5IHRvIGRldGVybWluZSBpdHMgdHlwZSBhbmQgY3VycmVudCB2YWx1ZS5cclxuICogIFN1cHBvcnRzIGRvdHRlZCBwcm9wZXJ0eU5hbWUgZm9yIG5lc3RlZCBDQ0NsYXNzIGdyb3VwcyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhbmFseXplUHJvcGVydHkoY29tcG9uZW50OiBhbnksIHByb3BlcnR5TmFtZTogc3RyaW5nKTogUHJvcGVydHlBbmFseXNpc1Jlc3VsdCB7XHJcbiAgICBjb25zdCBhdmFpbGFibGVQcm9wZXJ0aWVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcclxuICAgIGxldCBwcm9wZXJ0eUV4aXN0cyA9IGZhbHNlO1xyXG5cclxuICAgIC8vIE1ldGhvZCAxOiBkaXJlY3QgcHJvcGVydHkgYWNjZXNzIChmbGF0IHBhdGggb25seSlcclxuICAgIGlmICghcHJvcGVydHlOYW1lLmluY2x1ZGVzKCcuJykgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbXBvbmVudCwgcHJvcGVydHlOYW1lKSkge1xyXG4gICAgICAgIHByb3BlcnR5VmFsdWUgPSBjb21wb25lbnRbcHJvcGVydHlOYW1lXTtcclxuICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gTWV0aG9kIDI6IHNlYXJjaCBuZXN0ZWQgcHJvcGVydGllcyBzdHJ1Y3R1cmUgKENvY29zIENyZWF0b3IgY29tcG9uZW50IGR1bXAgZm9ybWF0KS5cclxuICAgIC8vICBGb3IgZG90dGVkIG5hbWVzIGxpa2UgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIiwgd2FsayBzZWdtZW50cyB0aHJvdWdoIG5lc3RlZCBgLnZhbHVlYCBkdW1wcy5cclxuICAgIGlmICghcHJvcGVydHlFeGlzdHMgJiYgY29tcG9uZW50LnByb3BlcnRpZXMgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIGNvbnN0IHJvb3RWYWx1ZU9iaiA9IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSA9PT0gJ29iamVjdCdcclxuICAgICAgICAgICAgPyBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZVxyXG4gICAgICAgICAgICA6IGNvbXBvbmVudC5wcm9wZXJ0aWVzO1xyXG5cclxuICAgICAgICBjb25zdCBzZWdtZW50cyA9IHByb3BlcnR5TmFtZS5zcGxpdCgnLicpO1xyXG4gICAgICAgIGxldCBjdXJzb3I6IGFueSA9IHJvb3RWYWx1ZU9iajtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBzZWdtZW50ID0gc2VnbWVudHNbaV07XHJcbiAgICAgICAgICAgIGNvbnN0IGlzTGVhZiA9IGkgPT09IHNlZ21lbnRzLmxlbmd0aCAtIDE7XHJcblxyXG4gICAgICAgICAgICAvLyBQb3B1bGF0ZSBhdmFpbGFibGVQcm9wZXJ0aWVzIGF0IHRoZSByZWxldmFudCBsZXZlbCAocm9vdCBvciBmaW5hbCBjb250YWluZXIpXHJcbiAgICAgICAgICAgIGlmIChpID09PSAwIHx8IChpID09PSBzZWdtZW50cy5sZW5ndGggLSAxKSkge1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMoY3Vyc29yIHx8IHt9KSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ICYmIHR5cGVvZiB2ID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBpID09PSAwID8gJycgOiBgJHtzZWdtZW50cy5zbGljZSgwLCBpKS5qb2luKCcuJyl9LmA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZVByb3BlcnRpZXMucHVzaChgJHtwcmVmaXh9JHtrfWApO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRvciA9IGN1cnNvciA/IGN1cnNvcltzZWdtZW50XSA6IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgY3Vyc29yID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChpc0xlYWYpIHtcclxuICAgICAgICAgICAgICAgIGlmIChpc1ZhbGlkUHJvcGVydHlEZXNjcmlwdG9yKGRlc2NyaXB0b3IpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZEtleXMgPSBPYmplY3Qua2V5cyhkZXNjcmlwdG9yKTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gZEtleXMuaW5jbHVkZXMoJ3ZhbHVlJykgPyBkZXNjcmlwdG9yLnZhbHVlIDogZGVzY3JpcHRvcjtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGRlc2NyaXB0b3I7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gRGVzY2VuZCBpbnRvIHRoZSBuZXN0ZWQgQ0NDbGFzcyBncm91cDogZGVzY3JpcHRvci52YWx1ZSBob2xkcyB0aGUgaW5uZXIgZHVtcC5cclxuICAgICAgICAgICAgaWYgKGRlc2NyaXB0b3IgJiYgdHlwZW9mIGRlc2NyaXB0b3IgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvci52YWx1ZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3IudmFsdWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVzY3JpcHRvciAmJiB0eXBlb2YgZGVzY3JpcHRvciA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgIGN1cnNvciA9IGRlc2NyaXB0b3I7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjdXJzb3IgPSB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBNZXRob2QgMzogY29sbGVjdCBzaW1wbGUgcHJvcGVydHkgbmFtZXMgZnJvbSBkaXJlY3Qga2V5cyBhcyBmYWxsYmFja1xyXG4gICAgaWYgKGF2YWlsYWJsZVByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoY29tcG9uZW50KSkge1xyXG4gICAgICAgICAgICBpZiAoIWtleS5zdGFydHNXaXRoKCdfJykgJiYgIVsnX190eXBlX18nLCAnY2lkJywgJ25vZGUnLCAndXVpZCcsICduYW1lJywgJ2VuYWJsZWQnLCAndHlwZScsICdyZWFkb25seScsICd2aXNpYmxlJ10uaW5jbHVkZXMoa2V5KSkge1xyXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGtleSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFwcm9wZXJ0eUV4aXN0cykge1xyXG4gICAgICAgIHJldHVybiB7IGV4aXN0czogZmFsc2UsIHR5cGU6ICd1bmtub3duJywgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogdW5kZWZpbmVkIH07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSW5mZXIgdHlwZSBmcm9tIHZhbHVlIHN0cnVjdHVyZVxyXG4gICAgbGV0IHR5cGUgPSAndW5rbm93bic7XHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwcm9wZXJ0eVZhbHVlKSkge1xyXG4gICAgICAgIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpKSB0eXBlID0gJ25vZGVBcnJheSc7XHJcbiAgICAgICAgZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NvbG9yJykpIHR5cGUgPSAnY29sb3JBcnJheSc7XHJcbiAgICAgICAgZWxzZSB0eXBlID0gJ2FycmF5JztcclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgdHlwZSA9IFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpID8gJ2Fzc2V0JyA6ICdzdHJpbmcnO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICB0eXBlID0gJ251bWJlcic7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnYm9vbGVhbicpIHtcclxuICAgICAgICB0eXBlID0gJ2Jvb2xlYW4nO1xyXG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlICYmIHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhwcm9wZXJ0eVZhbHVlKTtcclxuICAgICAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ3InKSAmJiBrZXlzLmluY2x1ZGVzKCdnJykgJiYga2V5cy5pbmNsdWRlcygnYicpKSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlID0gJ2NvbG9yJztcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd4JykgJiYga2V5cy5pbmNsdWRlcygneScpKSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlID0gcHJvcGVydHlWYWx1ZS56ICE9PSB1bmRlZmluZWQgPyAndmVjMycgOiAndmVjMic7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygnd2lkdGgnKSAmJiBrZXlzLmluY2x1ZGVzKCdoZWlnaHQnKSkge1xyXG4gICAgICAgICAgICAgICAgdHlwZSA9ICdzaXplJztcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd1dWlkJykgfHwga2V5cy5pbmNsdWRlcygnX191dWlkX18nKSkge1xyXG4gICAgICAgICAgICAgICAgdHlwZSA9IChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpIHx8IHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCd0YXJnZXQnKSB8fCBrZXlzLmluY2x1ZGVzKCdfX2lkX18nKSkgPyAnbm9kZScgOiAnYXNzZXQnO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ19faWRfXycpKSB7XHJcbiAgICAgICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHR5cGUgPSAnb2JqZWN0JztcclxuICAgICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKHByb3BlcnR5VmFsdWUgPT09IG51bGwgfHwgcHJvcGVydHlWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgaWYgKFsnc3ByaXRlRnJhbWUnLCAndGV4dHVyZScsICdtYXRlcmlhbCcsICdmb250JywgJ2NsaXAnLCAncHJlZmFiJ10uaW5jbHVkZXMocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgICAgIHR5cGUgPSAnYXNzZXQnO1xyXG4gICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSB8fCBwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGFyZ2V0JykpIHtcclxuICAgICAgICAgICAgdHlwZSA9ICdub2RlJztcclxuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb21wb25lbnQnKSkge1xyXG4gICAgICAgICAgICB0eXBlID0gJ2NvbXBvbmVudCc7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7IGV4aXN0czogdHJ1ZSwgdHlwZSwgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogcHJvcGVydHlWYWx1ZSB9O1xyXG59XHJcblxyXG4vKiogUGFyc2UgYSBoZXggY29sb3Igc3RyaW5nICgjUkdCIG9yICNSR0JBKSB0byBhbiBSR0JBIG9iamVjdCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb2xvclN0cmluZyhjb2xvclN0cjogc3RyaW5nKTogeyByOiBudW1iZXI7IGc6IG51bWJlcjsgYjogbnVtYmVyOyBhOiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBzdHIgPSBjb2xvclN0ci50cmltKCk7XHJcbiAgICBpZiAoc3RyLnN0YXJ0c1dpdGgoJyMnKSkge1xyXG4gICAgICAgIGlmIChzdHIubGVuZ3RoID09PSA3KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICByOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDEsIDMpLCAxNiksXHJcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXHJcbiAgICAgICAgICAgICAgICBiOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDUsIDcpLCAxNiksXHJcbiAgICAgICAgICAgICAgICBhOiAyNTVcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGVsc2UgaWYgKHN0ci5sZW5ndGggPT09IDkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcclxuICAgICAgICAgICAgICAgIGc6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMywgNSksIDE2KSxcclxuICAgICAgICAgICAgICAgIGI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNSwgNyksIDE2KSxcclxuICAgICAgICAgICAgICAgIGE6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNywgOSksIDE2KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBjb2xvciBmb3JtYXQ6IFwiJHtjb2xvclN0cn1cIi4gT25seSBoZXhhZGVjaW1hbCBmb3JtYXQgaXMgc3VwcG9ydGVkIChlLmcuLCBcIiNGRjAwMDBcIiBvciBcIiNGRjAwMDBGRlwiKWApO1xyXG59XHJcblxyXG4vKipcclxuICogQ29udmVydCBhIHJhdyBMTE0tc3VwcGxpZWQgdmFsdWUgdG8gdGhlIGNvcnJlY3QgZm9ybWF0IGZvciBhIGdpdmVuIHByb3BlcnR5VHlwZS5cclxuICogVGhyb3dzIGlmIHRoZSB2YWx1ZSBmb3JtYXQgaXMgaW52YWxpZCBmb3IgdGhlIGdpdmVuIHR5cGUuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBhbnkge1xyXG4gICAgc3dpdGNoIChwcm9wZXJ0eVR5cGUpIHtcclxuICAgICAgICBjYXNlICdzdHJpbmcnOlxyXG4gICAgICAgICAgICByZXR1cm4gU3RyaW5nKHZhbHVlKTtcclxuICAgICAgICBjYXNlICdudW1iZXInOiBjYXNlICdpbnRlZ2VyJzogY2FzZSAnZmxvYXQnOlxyXG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyKHZhbHVlKTtcclxuICAgICAgICBjYXNlICdib29sZWFuJzpcclxuICAgICAgICAgICAgcmV0dXJuIEJvb2xlYW4odmFsdWUpO1xyXG4gICAgICAgIGNhc2UgJ2NvbG9yJzpcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHJldHVybiBwYXJzZUNvbG9yU3RyaW5nKHZhbHVlKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUucikgfHwgMCkpLFxyXG4gICAgICAgICAgICAgICAgICAgIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmcpIHx8IDApKSxcclxuICAgICAgICAgICAgICAgICAgICBiOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5iKSB8fCAwKSksXHJcbiAgICAgICAgICAgICAgICAgICAgYTogdmFsdWUuYSAhPT0gdW5kZWZpbmVkID8gTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuYSkpKSA6IDI1NVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbG9yIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggciwgZywgYiBwcm9wZXJ0aWVzIG9yIGEgaGV4YWRlY2ltYWwgc3RyaW5nIChlLmcuLCBcIiNGRjAwMDBcIiknKTtcclxuICAgICAgICBjYXNlICd2ZWMyJzpcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcih2YWx1ZS54KSB8fCAwLCB5OiBOdW1iZXIodmFsdWUueSkgfHwgMCB9O1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZlYzIgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB4LCB5IHByb3BlcnRpZXMnKTtcclxuICAgICAgICBjYXNlICd2ZWMzJzpcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHJldHVybiB7IHg6IE51bWJlcih2YWx1ZS54KSB8fCAwLCB5OiBOdW1iZXIodmFsdWUueSkgfHwgMCwgejogTnVtYmVyKHZhbHVlLnopIHx8IDAgfTtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdWZWMzIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggeCwgeSwgeiBwcm9wZXJ0aWVzJyk7XHJcbiAgICAgICAgY2FzZSAnc2l6ZSc6XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSByZXR1cm4geyB3aWR0aDogTnVtYmVyKHZhbHVlLndpZHRoKSB8fCAwLCBoZWlnaHQ6IE51bWJlcih2YWx1ZS5oZWlnaHQpIHx8IDAgfTtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTaXplIHZhbHVlIG11c3QgYmUgYW4gb2JqZWN0IHdpdGggd2lkdGgsIGhlaWdodCBwcm9wZXJ0aWVzJyk7XHJcbiAgICAgICAgY2FzZSAnbm9kZSc6XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vZGUgcmVmZXJlbmNlIHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRCcpO1xyXG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4gdmFsdWU7IC8vIHJlc29sdmVkIHRvIF9faWRfXyBsYXRlclxyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbXBvbmVudCByZWZlcmVuY2UgdmFsdWUgbXVzdCBiZSBhIHN0cmluZyAobm9kZSBVVUlEIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQpJyk7XHJcbiAgICAgICAgY2FzZSAnc3ByaXRlRnJhbWUnOiBjYXNlICdwcmVmYWInOiBjYXNlICdhc3NldCc6XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYCR7cHJvcGVydHlUeXBlfSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIFVVSURgKTtcclxuICAgICAgICBjYXNlICdub2RlQXJyYXknOlxyXG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4geyBpZiAodHlwZW9mIGl0ZW0gPT09ICdzdHJpbmcnKSByZXR1cm4geyB1dWlkOiBpdGVtIH07IHRocm93IG5ldyBFcnJvcignTm9kZUFycmF5IGl0ZW1zIG11c3QgYmUgc3RyaW5nIFVVSURzJyk7IH0pO1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vZGVBcnJheSB2YWx1ZSBtdXN0IGJlIGFuIGFycmF5Jyk7XHJcbiAgICAgICAgY2FzZSAnY29sb3JBcnJheSc6XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcCgoaXRlbTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmIGl0ZW0gIT09IG51bGwgJiYgJ3InIGluIGl0ZW0pIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSwgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLCBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NSB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgcjogMjU1LCBnOiAyNTUsIGI6IDI1NSwgYTogMjU1IH07XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvbG9yQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xyXG4gICAgICAgIGNhc2UgJ251bWJlckFycmF5JzpcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IE51bWJlcihpdGVtKSk7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTnVtYmVyQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xyXG4gICAgICAgIGNhc2UgJ3N0cmluZ0FycmF5JzpcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IFN0cmluZyhpdGVtKSk7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignU3RyaW5nQXJyYXkgdmFsdWUgbXVzdCBiZSBhbiBhcnJheScpO1xyXG4gICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZTogJHtwcm9wZXJ0eVR5cGV9YCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8qKiBHZW5lcmF0ZSBhbiBMTE0tZnJpZW5kbHkgc3VnZ2VzdGlvbiB3aGVuIHJlcXVlc3RlZCBjb21wb25lbnQgdHlwZSBpcyBub3QgZm91bmQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbihyZXF1ZXN0ZWRUeXBlOiBzdHJpbmcsIGF2YWlsYWJsZVR5cGVzOiBzdHJpbmdbXSwgcHJvcGVydHk6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCBzaW1pbGFyVHlwZXMgPSBhdmFpbGFibGVUeXBlcy5maWx0ZXIodHlwZSA9PlxyXG4gICAgICAgIHR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhyZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkpIHx8XHJcbiAgICAgICAgcmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHR5cGUudG9Mb3dlckNhc2UoKSlcclxuICAgICk7XHJcblxyXG4gICAgbGV0IGluc3RydWN0aW9uID0gJyc7XHJcbiAgICBpZiAoc2ltaWxhclR5cGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuRm91bmQgc2ltaWxhciBjb21wb25lbnRzOiAke3NpbWlsYXJUeXBlcy5qb2luKCcsICcpfWA7XHJcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcblN1Z2dlc3Rpb246IFBlcmhhcHMgeW91IG1lYW50ICcke3NpbWlsYXJUeXBlc1swXX0nP2A7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgcHJvcGVydHlUb0NvbXBvbmVudE1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xyXG4gICAgICAgICdzdHJpbmcnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLkVkaXRCb3gnXSxcclxuICAgICAgICAndGV4dCc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcclxuICAgICAgICAnZm9udFNpemUnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXHJcbiAgICAgICAgJ3Nwcml0ZUZyYW1lJzogWydjYy5TcHJpdGUnXSxcclxuICAgICAgICAnY29sb3InOiBbJ2NjLkxhYmVsJywgJ2NjLlNwcml0ZScsICdjYy5HcmFwaGljcyddLFxyXG4gICAgICAgICdub3JtYWxDb2xvcic6IFsnY2MuQnV0dG9uJ10sXHJcbiAgICAgICAgJ3ByZXNzZWRDb2xvcic6IFsnY2MuQnV0dG9uJ10sXHJcbiAgICAgICAgJ3RhcmdldCc6IFsnY2MuQnV0dG9uJ10sXHJcbiAgICAgICAgJ2NvbnRlbnRTaXplJzogWydjYy5VSVRyYW5zZm9ybSddLFxyXG4gICAgICAgICdhbmNob3JQb2ludCc6IFsnY2MuVUlUcmFuc2Zvcm0nXVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCByZWNvbW1lbmRlZENvbXBvbmVudHMgPSBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwW3Byb3BlcnR5XSB8fCBbXTtcclxuICAgIGNvbnN0IGF2YWlsYWJsZVJlY29tbWVuZGVkID0gcmVjb21tZW5kZWRDb21wb25lbnRzLmZpbHRlcihjb21wID0+IGF2YWlsYWJsZVR5cGVzLmluY2x1ZGVzKGNvbXApKTtcclxuICAgIGlmIChhdmFpbGFibGVSZWNvbW1lbmRlZC5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkJhc2VkIG9uIHByb3BlcnR5ICcke3Byb3BlcnR5fScsIHJlY29tbWVuZGVkIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlUmVjb21tZW5kZWQuam9pbignLCAnKX1gO1xyXG4gICAgfVxyXG5cclxuICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0ZWQgQWN0aW9uczpgO1xyXG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjEuIFVzZSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1nZXRfYWxsIG5vZGVVdWlkPVwiLi4uXCIgdG8gdmlldyBhbGwgY29tcG9uZW50cyBvbiB0aGUgbm9kZWA7XHJcbiAgICBpbnN0cnVjdGlvbiArPSBgXFxuMi4gSWYgeW91IG5lZWQgdG8gYWRkIGEgY29tcG9uZW50LCB1c2UgYWN0aW9uPWFkZCB3aXRoIGNvbXBvbmVudFR5cGU9XCIke3JlcXVlc3RlZFR5cGV9XCJgO1xyXG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjMuIFZlcmlmeSB0aGF0IHRoZSBjb21wb25lbnQgdHlwZSBuYW1lIGlzIGNvcnJlY3QgKGNhc2Utc2Vuc2l0aXZlKWA7XHJcblxyXG4gICAgcmV0dXJuIGluc3RydWN0aW9uO1xyXG59XHJcblxyXG4vKiogUmV0dXJuIGF2YWlsYWJsZSBDb2NvcyBDcmVhdG9yIGJ1aWx0LWluIGNvbXBvbmVudCB0eXBlcyBieSBjYXRlZ29yeSAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QoY2F0ZWdvcnk6IHN0cmluZyA9ICdhbGwnKTogQWN0aW9uVG9vbFJlc3VsdCB7XHJcbiAgICBjb25zdCBjb21wb25lbnRDYXRlZ29yaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XHJcbiAgICAgICAgcmVuZGVyZXI6IFsnY2MuU3ByaXRlJywgJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLk1hc2snLCAnY2MuR3JhcGhpY3MnXSxcclxuICAgICAgICB1aTogWydjYy5CdXR0b24nLCAnY2MuVG9nZ2xlJywgJ2NjLlNsaWRlcicsICdjYy5TY3JvbGxWaWV3JywgJ2NjLkVkaXRCb3gnLCAnY2MuUHJvZ3Jlc3NCYXInXSxcclxuICAgICAgICBwaHlzaWNzOiBbJ2NjLlJpZ2lkQm9keTJEJywgJ2NjLkJveENvbGxpZGVyMkQnLCAnY2MuQ2lyY2xlQ29sbGlkZXIyRCcsICdjYy5Qb2x5Z29uQ29sbGlkZXIyRCddLFxyXG4gICAgICAgIGFuaW1hdGlvbjogWydjYy5BbmltYXRpb24nLCAnY2MuQW5pbWF0aW9uQ2xpcCcsICdjYy5Ta2VsZXRhbEFuaW1hdGlvbiddLFxyXG4gICAgICAgIGF1ZGlvOiBbJ2NjLkF1ZGlvU291cmNlJ10sXHJcbiAgICAgICAgbGF5b3V0OiBbJ2NjLkxheW91dCcsICdjYy5XaWRnZXQnLCAnY2MuUGFnZVZpZXcnLCAnY2MuUGFnZVZpZXdJbmRpY2F0b3InXSxcclxuICAgICAgICBlZmZlY3RzOiBbJ2NjLk1vdGlvblN0cmVhaycsICdjYy5QYXJ0aWNsZVN5c3RlbTJEJ10sXHJcbiAgICAgICAgY2FtZXJhOiBbJ2NjLkNhbWVyYSddLFxyXG4gICAgICAgIGxpZ2h0OiBbJ2NjLkxpZ2h0JywgJ2NjLkRpcmVjdGlvbmFsTGlnaHQnLCAnY2MuUG9pbnRMaWdodCcsICdjYy5TcG90TGlnaHQnXVxyXG4gICAgfTtcclxuXHJcbiAgICBsZXQgY29tcG9uZW50czogc3RyaW5nW10gPSBbXTtcclxuICAgIGlmIChjYXRlZ29yeSA9PT0gJ2FsbCcpIHtcclxuICAgICAgICBmb3IgKGNvbnN0IGNhdCBpbiBjb21wb25lbnRDYXRlZ29yaWVzKSB7XHJcbiAgICAgICAgICAgIGNvbXBvbmVudHMgPSBjb21wb25lbnRzLmNvbmNhdChjb21wb25lbnRDYXRlZ29yaWVzW2NhdF0pO1xyXG4gICAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV0pIHtcclxuICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV07XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29tcG9uZW50cyB9KTtcclxufVxyXG5cclxuLyoqIFJlZGlyZWN0IHNldF9wcm9wZXJ0eSBjYWxscyB0aGF0IHRhcmdldCBub2RlLWxldmVsIHByb3BlcnRpZXMgdG8gdGhlIGNvcnJlY3QgbWFuYWdlX25vZGUgYWN0aW9uICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzOiB7XHJcbiAgICBub2RlVXVpZDogc3RyaW5nOyBjb21wb25lbnRUeXBlOiBzdHJpbmc7IHByb3BlcnR5OiBzdHJpbmc7IHZhbHVlOiBhbnk7XHJcbn0pOiBBY3Rpb25Ub29sUmVzdWx0IHwgbnVsbCB7XHJcbiAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgdmFsdWUgfSA9IGFyZ3M7XHJcbiAgICBjb25zdCBub2RlQmFzaWNQcm9wZXJ0aWVzID0gWyduYW1lJywgJ2FjdGl2ZScsICdsYXllcicsICdtb2JpbGl0eScsICdwYXJlbnQnLCAnY2hpbGRyZW4nLCAnaGlkZUZsYWdzJ107XHJcbiAgICBjb25zdCBub2RlVHJhbnNmb3JtUHJvcGVydGllcyA9IFsncG9zaXRpb24nLCAncm90YXRpb24nLCAnc2NhbGUnLCAnZXVsZXJBbmdsZXMnLCAnYW5nbGUnXTtcclxuXHJcbiAgICBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLk5vZGUnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdOb2RlJykge1xyXG4gICAgICAgIGlmIChub2RlQmFzaWNQcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIGJhc2ljIHByb3BlcnR5LCBub3QgYSBjb21wb25lbnQgcHJvcGVydHlgLFxyXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF9wcm9wZXJ0eSB3aXRoIHV1aWQ9XCIke25vZGVVdWlkfVwiLCBwcm9wZXJ0eT1cIiR7cHJvcGVydHl9XCIsIHZhbHVlPSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGVsc2UgaWYgKG5vZGVUcmFuc2Zvcm1Qcm9wZXJ0aWVzLmluY2x1ZGVzKHByb3BlcnR5KSkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgYSBub2RlIHRyYW5zZm9ybSBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcclxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtIHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsICR7cHJvcGVydHl9PSR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfWBcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbn1cclxuXHJcbi8qKiBWZXJpZnkgYSBwcm9wZXJ0eSBjaGFuZ2Ugd2FzIGFwcGxpZWQ7IHVzZXMgZ2V0Q29tcG9uZW50SW5mbyBjYWxsYmFjayB0byBhdm9pZCBjaXJjdWxhciBkZXBzICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZShcclxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXHJcbiAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXHJcbiAgICBwcm9wZXJ0eTogc3RyaW5nLFxyXG4gICAgb3JpZ2luYWxWYWx1ZTogYW55LFxyXG4gICAgZXhwZWN0ZWRWYWx1ZTogYW55LFxyXG4gICAgZ2V0Q29tcG9uZW50SW5mbzogKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxyXG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IGJvb2xlYW47IGFjdHVhbFZhbHVlOiBhbnk7IGZ1bGxEYXRhOiBhbnkgfT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBjb21wb25lbnRJbmZvID0gYXdhaXQgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZCwgY29tcG9uZW50VHlwZSk7XHJcbiAgICAgICAgaWYgKGNvbXBvbmVudEluZm8uc3VjY2VzcyAmJiBjb21wb25lbnRJbmZvLmRhdGEpIHtcclxuICAgICAgICAgICAgLy8gV2FsayBkb3R0ZWQgcHJvcGVydHkgcGF0aHMgdGhyb3VnaCBuZXN0ZWQgQ0NDbGFzcyBncm91cCBkdW1wcy5cclxuICAgICAgICAgICAgY29uc3Qgc2VnbWVudHMgPSBwcm9wZXJ0eS5zcGxpdCgnLicpO1xyXG4gICAgICAgICAgICBsZXQgcHJvcGVydHlEYXRhOiBhbnkgPSBjb21wb25lbnRJbmZvLmRhdGEucHJvcGVydGllcztcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWdtZW50cy5sZW5ndGggJiYgcHJvcGVydHlEYXRhOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIHByb3BlcnR5RGF0YSA9IHByb3BlcnR5RGF0YVtzZWdtZW50c1tpXV07XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc0xlYWYgPSBpID09PSBzZWdtZW50cy5sZW5ndGggLSAxO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpc0xlYWYgJiYgcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEgPT09ICdvYmplY3QnICYmICd2YWx1ZScgaW4gcHJvcGVydHlEYXRhICYmIHR5cGVvZiBwcm9wZXJ0eURhdGEudmFsdWUgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlEYXRhID0gcHJvcGVydHlEYXRhLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxldCBhY3R1YWxWYWx1ZSA9IHByb3BlcnR5RGF0YTtcclxuICAgICAgICAgICAgaWYgKHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5RGF0YSkge1xyXG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUgPSBwcm9wZXJ0eURhdGEudmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGxldCB2ZXJpZmllZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGV4cGVjdGVkVmFsdWUgPT09ICdvYmplY3QnICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwgJiYgJ3V1aWQnIGluIGV4cGVjdGVkVmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbFV1aWQgPSBhY3R1YWxWYWx1ZSAmJiB0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBhY3R1YWxWYWx1ZSA/IGFjdHVhbFZhbHVlLnV1aWQgOiAnJztcclxuICAgICAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVXVpZCA9IGV4cGVjdGVkVmFsdWUudXVpZCB8fCAnJztcclxuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gYWN0dWFsVXVpZCA9PT0gZXhwZWN0ZWRVdWlkICYmIGV4cGVjdGVkVXVpZCAhPT0gJyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSB0eXBlb2YgZXhwZWN0ZWRWYWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhY3R1YWxWYWx1ZSA9PT0gJ29iamVjdCcgJiYgYWN0dWFsVmFsdWUgIT09IG51bGwgJiYgZXhwZWN0ZWRWYWx1ZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gSlNPTi5zdHJpbmdpZnkoYWN0dWFsVmFsdWUpID09PSBKU09OLnN0cmluZ2lmeShleHBlY3RlZFZhbHVlKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxWYWx1ZSA9PT0gZXhwZWN0ZWRWYWx1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gU3RyaW5nKGFjdHVhbFZhbHVlKSA9PT0gU3RyaW5nKGV4cGVjdGVkVmFsdWUpIHx8IE51bWJlcihhY3R1YWxWYWx1ZSkgPT09IE51bWJlcihleHBlY3RlZFZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHZlcmlmaWVkLFxyXG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUsXHJcbiAgICAgICAgICAgICAgICBmdWxsRGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVkUHJvcGVydHk6IHsgbmFtZTogcHJvcGVydHksIGJlZm9yZTogb3JpZ2luYWxWYWx1ZSwgZXhwZWN0ZWQ6IGV4cGVjdGVkVmFsdWUsIGFjdHVhbDogYWN0dWFsVmFsdWUsIHZlcmlmaWVkIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3VtbWFyeTogeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgdG90YWxQcm9wZXJ0aWVzOiBPYmplY3Qua2V5cyhjb21wb25lbnRJbmZvLmRhdGE/LnByb3BlcnRpZXMgfHwge30pLmxlbmd0aCB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbTWFuYWdlQ29tcG9uZW50LnZlcmlmeVByb3BlcnR5Q2hhbmdlXSBWZXJpZmljYXRpb24gZmFpbGVkOicsIGVycm9yKTtcclxuICAgIH1cclxuICAgIHJldHVybiB7IHZlcmlmaWVkOiBmYWxzZSwgYWN0dWFsVmFsdWU6IHVuZGVmaW5lZCwgZnVsbERhdGE6IG51bGwgfTtcclxufVxyXG4iXX0=