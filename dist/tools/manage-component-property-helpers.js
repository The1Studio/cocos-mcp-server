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
/** Analyze a component's property to determine its type and current value */
function analyzeProperty(component, propertyName) {
    const availableProperties = [];
    let propertyValue = undefined;
    let propertyExists = false;
    // Method 1: direct property access
    if (Object.prototype.hasOwnProperty.call(component, propertyName)) {
        propertyValue = component[propertyName];
        propertyExists = true;
    }
    // Method 2: search nested properties structure (Cocos Creator component dump format)
    if (!propertyExists && component.properties && typeof component.properties === 'object') {
        const valueObj = component.properties.value && typeof component.properties.value === 'object'
            ? component.properties.value
            : component.properties;
        for (const [key, propData] of Object.entries(valueObj)) {
            if (isValidPropertyDescriptor(propData)) {
                const propInfo = propData;
                availableProperties.push(key);
                if (key === propertyName) {
                    try {
                        const propKeys = Object.keys(propInfo);
                        propertyValue = propKeys.includes('value') ? propInfo.value : propInfo;
                    }
                    catch (_a) {
                        propertyValue = propInfo;
                    }
                    propertyExists = true;
                }
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
        catch (_b) {
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
    var _a, _b;
    try {
        const componentInfo = await getComponentInfo(nodeUuid, componentType);
        if (componentInfo.success && componentInfo.data) {
            const propertyData = (_a = componentInfo.data.properties) === null || _a === void 0 ? void 0 : _a[property];
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
                    componentSummary: { nodeUuid, componentType, totalProperties: Object.keys(((_b = componentInfo.data) === null || _b === void 0 ? void 0 : _b.properties) || {}).length }
                }
            };
        }
    }
    catch (error) {
        console.error('[ManageComponent.verifyPropertyChange] Verification failed:', error);
    }
    return { verified: false, actualValue: undefined, fullData: null };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQVlILDhEQTBCQztBQUdELDBDQXlGQztBQUdELDRDQW9CQztBQU1ELG9EQXlEQztBQUdELGtFQXFDQztBQUdELGdFQXVCQztBQUdELGdFQXdCQztBQUdELHNFQTZDQztBQW5XRCxvQ0FBMkQ7QUFTM0QscUZBQXFGO0FBQ3JGLFNBQWdCLHlCQUF5QixDQUFDLFFBQWE7SUFDbkQsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksUUFBUSxLQUFLLElBQUk7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUNwRSxJQUFJLENBQUM7UUFDRCxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ25DLDJEQUEyRDtRQUMzRCxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDekMsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hCLE9BQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDcEYsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLG1CQUFtQjtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxD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IjpbIi8qKlxuICogUHVyZSBoZWxwZXIgZnVuY3Rpb25zIGZvciBjb21wb25lbnQgcHJvcGVydHkgYW5hbHlzaXMsIHZhbGlkYXRpb24sIGFuZCBxdWVyeSB1dGlsaXRpZXMuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGV4aXN0czogYm9vbGVhbjtcbiAgICB0eXBlOiBzdHJpbmc7XG4gICAgYXZhaWxhYmxlUHJvcGVydGllczogc3RyaW5nW107XG4gICAgb3JpZ2luYWxWYWx1ZTogYW55O1xufVxuXG4vKiogUmV0dXJucyB0cnVlIGlmIHByb3BEYXRhIGxvb2tzIGxpa2UgYSBDb2NvcyBDcmVhdG9yIHByb3BlcnR5IGRlc2NyaXB0b3Igb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihwcm9wRGF0YTogYW55KTogYm9vbGVhbiB7XG4gICAgaWYgKHR5cGVvZiBwcm9wRGF0YSAhPT0gJ29iamVjdCcgfHwgcHJvcERhdGEgPT09IG51bGwpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMocHJvcERhdGEpO1xuICAgICAgICAvLyBTa2lwIHNpbXBsZSB2YWx1ZSBvYmplY3RzIGxpa2Uge3dpZHRoOiAyMDAsIGhlaWdodDogMTUwfVxuICAgICAgICBjb25zdCBpc1NpbXBsZVZhbHVlT2JqZWN0ID0ga2V5cy5ldmVyeShrZXkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdiA9IHByb3BEYXRhW2tleV07XG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2ID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKGlzU2ltcGxlVmFsdWVPYmplY3QpIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgaGFzTmFtZSA9IGtleXMuaW5jbHVkZXMoJ25hbWUnKTtcbiAgICAgICAgY29uc3QgaGFzVmFsdWUgPSBrZXlzLmluY2x1ZGVzKCd2YWx1ZScpO1xuICAgICAgICBjb25zdCBoYXNUeXBlID0ga2V5cy5pbmNsdWRlcygndHlwZScpO1xuICAgICAgICBjb25zdCBoYXNEaXNwbGF5TmFtZSA9IGtleXMuaW5jbHVkZXMoJ2Rpc3BsYXlOYW1lJyk7XG4gICAgICAgIGNvbnN0IGhhc1JlYWRvbmx5ID0ga2V5cy5pbmNsdWRlcygncmVhZG9ubHknKTtcbiAgICAgICAgY29uc3QgaGFzVmFsaWRTdHJ1Y3R1cmUgPSAoaGFzTmFtZSB8fCBoYXNWYWx1ZSkgJiYgKGhhc1R5cGUgfHwgaGFzRGlzcGxheU5hbWUgfHwgaGFzUmVhZG9ubHkpO1xuICAgICAgICBpZiAoa2V5cy5pbmNsdWRlcygnZGVmYXVsdCcpICYmIHByb3BEYXRhLmRlZmF1bHQgJiYgdHlwZW9mIHByb3BEYXRhLmRlZmF1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBjb25zdCBkZWZhdWx0S2V5cyA9IE9iamVjdC5rZXlzKHByb3BEYXRhLmRlZmF1bHQpO1xuICAgICAgICAgICAgaWYgKGRlZmF1bHRLZXlzLmluY2x1ZGVzKCd2YWx1ZScpICYmIHR5cGVvZiBwcm9wRGF0YS5kZWZhdWx0LnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIHJldHVybiBoYXNWYWxpZFN0cnVjdHVyZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaGFzVmFsaWRTdHJ1Y3R1cmU7XG4gICAgfSBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG5cbi8qKiBBbmFseXplIGEgY29tcG9uZW50J3MgcHJvcGVydHkgdG8gZGV0ZXJtaW5lIGl0cyB0eXBlIGFuZCBjdXJyZW50IHZhbHVlICovXG5leHBvcnQgZnVuY3Rpb24gYW5hbHl6ZVByb3BlcnR5KGNvbXBvbmVudDogYW55LCBwcm9wZXJ0eU5hbWU6IHN0cmluZyk6IFByb3BlcnR5QW5hbHlzaXNSZXN1bHQge1xuICAgIGNvbnN0IGF2YWlsYWJsZVByb3BlcnRpZXM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IHByb3BlcnR5VmFsdWU6IGFueSA9IHVuZGVmaW5lZDtcbiAgICBsZXQgcHJvcGVydHlFeGlzdHMgPSBmYWxzZTtcblxuICAgIC8vIE1ldGhvZCAxOiBkaXJlY3QgcHJvcGVydHkgYWNjZXNzXG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChjb21wb25lbnQsIHByb3BlcnR5TmFtZSkpIHtcbiAgICAgICAgcHJvcGVydHlWYWx1ZSA9IGNvbXBvbmVudFtwcm9wZXJ0eU5hbWVdO1xuICAgICAgICBwcm9wZXJ0eUV4aXN0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLy8gTWV0aG9kIDI6IHNlYXJjaCBuZXN0ZWQgcHJvcGVydGllcyBzdHJ1Y3R1cmUgKENvY29zIENyZWF0b3IgY29tcG9uZW50IGR1bXAgZm9ybWF0KVxuICAgIGlmICghcHJvcGVydHlFeGlzdHMgJiYgY29tcG9uZW50LnByb3BlcnRpZXMgJiYgdHlwZW9mIGNvbXBvbmVudC5wcm9wZXJ0aWVzID09PSAnb2JqZWN0Jykge1xuICAgICAgICBjb25zdCB2YWx1ZU9iaiA9IGNvbXBvbmVudC5wcm9wZXJ0aWVzLnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQucHJvcGVydGllcy52YWx1ZSA9PT0gJ29iamVjdCdcbiAgICAgICAgICAgID8gY29tcG9uZW50LnByb3BlcnRpZXMudmFsdWVcbiAgICAgICAgICAgIDogY29tcG9uZW50LnByb3BlcnRpZXM7XG5cbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBwcm9wRGF0YV0gb2YgT2JqZWN0LmVudHJpZXModmFsdWVPYmopKSB7XG4gICAgICAgICAgICBpZiAoaXNWYWxpZFByb3BlcnR5RGVzY3JpcHRvcihwcm9wRGF0YSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9wSW5mbyA9IHByb3BEYXRhIGFzIGFueTtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVQcm9wZXJ0aWVzLnB1c2goa2V5KTtcbiAgICAgICAgICAgICAgICBpZiAoa2V5ID09PSBwcm9wZXJ0eU5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3BLZXlzID0gT2JqZWN0LmtleXMocHJvcEluZm8pO1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlWYWx1ZSA9IHByb3BLZXlzLmluY2x1ZGVzKCd2YWx1ZScpID8gcHJvcEluZm8udmFsdWUgOiBwcm9wSW5mbztcbiAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVZhbHVlID0gcHJvcEluZm87XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlFeGlzdHMgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8vIE1ldGhvZCAzOiBjb2xsZWN0IHNpbXBsZSBwcm9wZXJ0eSBuYW1lcyBmcm9tIGRpcmVjdCBrZXlzIGFzIGZhbGxiYWNrXG4gICAgaWYgKGF2YWlsYWJsZVByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGNvbXBvbmVudCkpIHtcbiAgICAgICAgICAgIGlmICgha2V5LnN0YXJ0c1dpdGgoJ18nKSAmJiAhWydfX3R5cGVfXycsICdjaWQnLCAnbm9kZScsICd1dWlkJywgJ25hbWUnLCAnZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnXS5pbmNsdWRlcyhrZXkpKSB7XG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlUHJvcGVydGllcy5wdXNoKGtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIXByb3BlcnR5RXhpc3RzKSB7XG4gICAgICAgIHJldHVybiB7IGV4aXN0czogZmFsc2UsIHR5cGU6ICd1bmtub3duJywgYXZhaWxhYmxlUHJvcGVydGllcywgb3JpZ2luYWxWYWx1ZTogdW5kZWZpbmVkIH07XG4gICAgfVxuXG4gICAgLy8gSW5mZXIgdHlwZSBmcm9tIHZhbHVlIHN0cnVjdHVyZVxuICAgIGxldCB0eXBlID0gJ3Vua25vd24nO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5VmFsdWUpKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygnbm9kZScpKSB0eXBlID0gJ25vZGVBcnJheSc7XG4gICAgICAgIGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb2xvcicpKSB0eXBlID0gJ2NvbG9yQXJyYXknO1xuICAgICAgICBlbHNlIHR5cGUgPSAnYXJyYXknO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb3BlcnR5VmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHR5cGUgPSBbJ3Nwcml0ZUZyYW1lJywgJ3RleHR1cmUnLCAnbWF0ZXJpYWwnLCAnZm9udCcsICdjbGlwJywgJ3ByZWZhYiddLmluY2x1ZGVzKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpKSA/ICdhc3NldCcgOiAnc3RyaW5nJztcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnbnVtYmVyJykge1xuICAgICAgICB0eXBlID0gJ251bWJlcic7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvcGVydHlWYWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHR5cGUgPSAnYm9vbGVhbic7XG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlICYmIHR5cGVvZiBwcm9wZXJ0eVZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHByb3BlcnR5VmFsdWUpO1xuICAgICAgICAgICAgaWYgKGtleXMuaW5jbHVkZXMoJ3InKSAmJiBrZXlzLmluY2x1ZGVzKCdnJykgJiYga2V5cy5pbmNsdWRlcygnYicpKSB7XG4gICAgICAgICAgICAgICAgdHlwZSA9ICdjb2xvcic7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3gnKSAmJiBrZXlzLmluY2x1ZGVzKCd5JykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gcHJvcGVydHlWYWx1ZS56ICE9PSB1bmRlZmluZWQgPyAndmVjMycgOiAndmVjMic7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGtleXMuaW5jbHVkZXMoJ3dpZHRoJykgJiYga2V5cy5pbmNsdWRlcygnaGVpZ2h0JykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ3NpemUnO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChrZXlzLmluY2x1ZGVzKCd1dWlkJykgfHwga2V5cy5pbmNsdWRlcygnX191dWlkX18nKSkge1xuICAgICAgICAgICAgICAgIHR5cGUgPSAocHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ25vZGUnKSB8fCBwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGFyZ2V0JykgfHwga2V5cy5pbmNsdWRlcygnX19pZF9fJykpID8gJ25vZGUnIDogJ2Fzc2V0JztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoa2V5cy5pbmNsdWRlcygnX19pZF9fJykpIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0eXBlID0gJ29iamVjdCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgdHlwZSA9ICdvYmplY3QnO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChwcm9wZXJ0eVZhbHVlID09PSBudWxsIHx8IHByb3BlcnR5VmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoWydzcHJpdGVGcmFtZScsICd0ZXh0dXJlJywgJ21hdGVyaWFsJywgJ2ZvbnQnLCAnY2xpcCcsICdwcmVmYWInXS5pbmNsdWRlcyhwcm9wZXJ0eU5hbWUudG9Mb3dlckNhc2UoKSkpIHtcbiAgICAgICAgICAgIHR5cGUgPSAnYXNzZXQnO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdub2RlJykgfHwgcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RhcmdldCcpKSB7XG4gICAgICAgICAgICB0eXBlID0gJ25vZGUnO1xuICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5TmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdjb21wb25lbnQnKSkge1xuICAgICAgICAgICAgdHlwZSA9ICdjb21wb25lbnQnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgZXhpc3RzOiB0cnVlLCB0eXBlLCBhdmFpbGFibGVQcm9wZXJ0aWVzLCBvcmlnaW5hbFZhbHVlOiBwcm9wZXJ0eVZhbHVlIH07XG59XG5cbi8qKiBQYXJzZSBhIGhleCBjb2xvciBzdHJpbmcgKCNSR0Igb3IgI1JHQkEpIHRvIGFuIFJHQkEgb2JqZWN0ICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb2xvclN0cmluZyhjb2xvclN0cjogc3RyaW5nKTogeyByOiBudW1iZXI7IGc6IG51bWJlcjsgYjogbnVtYmVyOyBhOiBudW1iZXIgfSB7XG4gICAgY29uc3Qgc3RyID0gY29sb3JTdHIudHJpbSgpO1xuICAgIGlmIChzdHIuc3RhcnRzV2l0aCgnIycpKSB7XG4gICAgICAgIGlmIChzdHIubGVuZ3RoID09PSA3KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXG4gICAgICAgICAgICAgICAgYjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg1LCA3KSwgMTYpLFxuICAgICAgICAgICAgICAgIGE6IDI1NVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChzdHIubGVuZ3RoID09PSA5KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHI6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoMSwgMyksIDE2KSxcbiAgICAgICAgICAgICAgICBnOiBwYXJzZUludChzdHIuc3Vic3RyaW5nKDMsIDUpLCAxNiksXG4gICAgICAgICAgICAgICAgYjogcGFyc2VJbnQoc3RyLnN1YnN0cmluZyg1LCA3KSwgMTYpLFxuICAgICAgICAgICAgICAgIGE6IHBhcnNlSW50KHN0ci5zdWJzdHJpbmcoNywgOSksIDE2KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgY29sb3IgZm9ybWF0OiBcIiR7Y29sb3JTdHJ9XCIuIE9ubHkgaGV4YWRlY2ltYWwgZm9ybWF0IGlzIHN1cHBvcnRlZCAoZS5nLiwgXCIjRkYwMDAwXCIgb3IgXCIjRkYwMDAwRkZcIilgKTtcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgcmF3IExMTS1zdXBwbGllZCB2YWx1ZSB0byB0aGUgY29ycmVjdCBmb3JtYXQgZm9yIGEgZ2l2ZW4gcHJvcGVydHlUeXBlLlxuICogVGhyb3dzIGlmIHRoZSB2YWx1ZSBmb3JtYXQgaXMgaW52YWxpZCBmb3IgdGhlIGdpdmVuIHR5cGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJ0UHJvcGVydHlWYWx1ZShwcm9wZXJ0eVR5cGU6IHN0cmluZywgdmFsdWU6IGFueSk6IGFueSB7XG4gICAgc3dpdGNoIChwcm9wZXJ0eVR5cGUpIHtcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICAgICAgICBjYXNlICdudW1iZXInOiBjYXNlICdpbnRlZ2VyJzogY2FzZSAnZmxvYXQnOlxuICAgICAgICAgICAgcmV0dXJuIE51bWJlcih2YWx1ZSk7XG4gICAgICAgIGNhc2UgJ2Jvb2xlYW4nOlxuICAgICAgICAgICAgcmV0dXJuIEJvb2xlYW4odmFsdWUpO1xuICAgICAgICBjYXNlICdjb2xvcic6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHBhcnNlQ29sb3JTdHJpbmcodmFsdWUpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5yKSB8fCAwKSksXG4gICAgICAgICAgICAgICAgICAgIGc6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKHZhbHVlLmcpIHx8IDApKSxcbiAgICAgICAgICAgICAgICAgICAgYjogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIodmFsdWUuYikgfHwgMCkpLFxuICAgICAgICAgICAgICAgICAgICBhOiB2YWx1ZS5hICE9PSB1bmRlZmluZWQgPyBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcih2YWx1ZS5hKSkpIDogMjU1XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29sb3IgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCByLCBnLCBiIHByb3BlcnRpZXMgb3IgYSBoZXhhZGVjaW1hbCBzdHJpbmcgKGUuZy4sIFwiI0ZGMDAwMFwiKScpO1xuICAgICAgICBjYXNlICd2ZWMyJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSByZXR1cm4geyB4OiBOdW1iZXIodmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHZhbHVlLnkpIHx8IDAgfTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVmVjMiB2YWx1ZSBtdXN0IGJlIGFuIG9iamVjdCB3aXRoIHgsIHkgcHJvcGVydGllcycpO1xuICAgICAgICBjYXNlICd2ZWMzJzpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSByZXR1cm4geyB4OiBOdW1iZXIodmFsdWUueCkgfHwgMCwgeTogTnVtYmVyKHZhbHVlLnkpIHx8IDAsIHo6IE51bWJlcih2YWx1ZS56KSB8fCAwIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZlYzMgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB4LCB5LCB6IHByb3BlcnRpZXMnKTtcbiAgICAgICAgY2FzZSAnc2l6ZSc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkgcmV0dXJuIHsgd2lkdGg6IE51bWJlcih2YWx1ZS53aWR0aCkgfHwgMCwgaGVpZ2h0OiBOdW1iZXIodmFsdWUuaGVpZ2h0KSB8fCAwIH07XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NpemUgdmFsdWUgbXVzdCBiZSBhbiBvYmplY3Qgd2l0aCB3aWR0aCwgaGVpZ2h0IHByb3BlcnRpZXMnKTtcbiAgICAgICAgY2FzZSAnbm9kZSc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm9kZSByZWZlcmVuY2UgdmFsdWUgbXVzdCBiZSBhIHN0cmluZyBVVUlEJyk7XG4gICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHZhbHVlOyAvLyByZXNvbHZlZCB0byBfX2lkX18gbGF0ZXJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ29tcG9uZW50IHJlZmVyZW5jZSB2YWx1ZSBtdXN0IGJlIGEgc3RyaW5nIChub2RlIFVVSUQgY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCknKTtcbiAgICAgICAgY2FzZSAnc3ByaXRlRnJhbWUnOiBjYXNlICdwcmVmYWInOiBjYXNlICdhc3NldCc6XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogdmFsdWUgfTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJHtwcm9wZXJ0eVR5cGV9IHZhbHVlIG11c3QgYmUgYSBzdHJpbmcgVVVJRGApO1xuICAgICAgICBjYXNlICdub2RlQXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IHsgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykgcmV0dXJuIHsgdXVpZDogaXRlbSB9OyB0aHJvdyBuZXcgRXJyb3IoJ05vZGVBcnJheSBpdGVtcyBtdXN0IGJlIHN0cmluZyBVVUlEcycpOyB9KTtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignTm9kZUFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgY2FzZSAnY29sb3JBcnJheSc6XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoKGl0ZW06IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiAncicgaW4gaXRlbSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyByOiBNYXRoLm1pbigyNTUsIE1hdGgubWF4KDAsIE51bWJlcihpdGVtLnIpIHx8IDApKSwgZzogTWF0aC5taW4oMjU1LCBNYXRoLm1heCgwLCBOdW1iZXIoaXRlbS5nKSB8fCAwKSksIGI6IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYikgfHwgMCkpLCBhOiBpdGVtLmEgIT09IHVuZGVmaW5lZCA/IE1hdGgubWluKDI1NSwgTWF0aC5tYXgoMCwgTnVtYmVyKGl0ZW0uYSkpKSA6IDI1NSB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4geyByOiAyNTUsIGc6IDI1NSwgYjogMjU1LCBhOiAyNTUgfTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb2xvckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgY2FzZSAnbnVtYmVyQXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IE51bWJlcihpdGVtKSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ051bWJlckFycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgY2FzZSAnc3RyaW5nQXJyYXknOlxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSByZXR1cm4gdmFsdWUubWFwKChpdGVtOiBhbnkpID0+IFN0cmluZyhpdGVtKSk7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0cmluZ0FycmF5IHZhbHVlIG11c3QgYmUgYW4gYXJyYXknKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJvcGVydHkgdHlwZTogJHtwcm9wZXJ0eVR5cGV9YCk7XG4gICAgfVxufVxuXG4vKiogR2VuZXJhdGUgYW4gTExNLWZyaWVuZGx5IHN1Z2dlc3Rpb24gd2hlbiByZXF1ZXN0ZWQgY29tcG9uZW50IHR5cGUgaXMgbm90IGZvdW5kICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uKHJlcXVlc3RlZFR5cGU6IHN0cmluZywgYXZhaWxhYmxlVHlwZXM6IHN0cmluZ1tdLCBwcm9wZXJ0eTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBjb25zdCBzaW1pbGFyVHlwZXMgPSBhdmFpbGFibGVUeXBlcy5maWx0ZXIodHlwZSA9PlxuICAgICAgICB0eXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocmVxdWVzdGVkVHlwZS50b0xvd2VyQ2FzZSgpKSB8fFxuICAgICAgICByZXF1ZXN0ZWRUeXBlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModHlwZS50b0xvd2VyQ2FzZSgpKVxuICAgICk7XG5cbiAgICBsZXQgaW5zdHJ1Y3Rpb24gPSAnJztcbiAgICBpZiAoc2ltaWxhclR5cGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkZvdW5kIHNpbWlsYXIgY29tcG9uZW50czogJHtzaW1pbGFyVHlwZXMuam9pbignLCAnKX1gO1xuICAgICAgICBpbnN0cnVjdGlvbiArPSBgXFxuU3VnZ2VzdGlvbjogUGVyaGFwcyB5b3UgbWVhbnQgJyR7c2ltaWxhclR5cGVzWzBdfSc/YDtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4gPSB7XG4gICAgICAgICdzdHJpbmcnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0JywgJ2NjLkVkaXRCb3gnXSxcbiAgICAgICAgJ3RleHQnOiBbJ2NjLkxhYmVsJywgJ2NjLlJpY2hUZXh0J10sXG4gICAgICAgICdmb250U2l6ZSc6IFsnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnXSxcbiAgICAgICAgJ3Nwcml0ZUZyYW1lJzogWydjYy5TcHJpdGUnXSxcbiAgICAgICAgJ2NvbG9yJzogWydjYy5MYWJlbCcsICdjYy5TcHJpdGUnLCAnY2MuR3JhcGhpY3MnXSxcbiAgICAgICAgJ25vcm1hbENvbG9yJzogWydjYy5CdXR0b24nXSxcbiAgICAgICAgJ3ByZXNzZWRDb2xvcic6IFsnY2MuQnV0dG9uJ10sXG4gICAgICAgICd0YXJnZXQnOiBbJ2NjLkJ1dHRvbiddLFxuICAgICAgICAnY29udGVudFNpemUnOiBbJ2NjLlVJVHJhbnNmb3JtJ10sXG4gICAgICAgICdhbmNob3JQb2ludCc6IFsnY2MuVUlUcmFuc2Zvcm0nXVxuICAgIH07XG5cbiAgICBjb25zdCByZWNvbW1lbmRlZENvbXBvbmVudHMgPSBwcm9wZXJ0eVRvQ29tcG9uZW50TWFwW3Byb3BlcnR5XSB8fCBbXTtcbiAgICBjb25zdCBhdmFpbGFibGVSZWNvbW1lbmRlZCA9IHJlY29tbWVuZGVkQ29tcG9uZW50cy5maWx0ZXIoY29tcCA9PiBhdmFpbGFibGVUeXBlcy5pbmNsdWRlcyhjb21wKSk7XG4gICAgaWYgKGF2YWlsYWJsZVJlY29tbWVuZGVkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbkJhc2VkIG9uIHByb3BlcnR5ICcke3Byb3BlcnR5fScsIHJlY29tbWVuZGVkIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlUmVjb21tZW5kZWQuam9pbignLCAnKX1gO1xuICAgIH1cblxuICAgIGluc3RydWN0aW9uICs9IGBcXG5TdWdnZXN0ZWQgQWN0aW9uczpgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4xLiBVc2UgbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249Z2V0X2FsbCBub2RlVXVpZD1cIi4uLlwiIHRvIHZpZXcgYWxsIGNvbXBvbmVudHMgb24gdGhlIG5vZGVgO1xuICAgIGluc3RydWN0aW9uICs9IGBcXG4yLiBJZiB5b3UgbmVlZCB0byBhZGQgYSBjb21wb25lbnQsIHVzZSBhY3Rpb249YWRkIHdpdGggY29tcG9uZW50VHlwZT1cIiR7cmVxdWVzdGVkVHlwZX1cImA7XG4gICAgaW5zdHJ1Y3Rpb24gKz0gYFxcbjMuIFZlcmlmeSB0aGF0IHRoZSBjb21wb25lbnQgdHlwZSBuYW1lIGlzIGNvcnJlY3QgKGNhc2Utc2Vuc2l0aXZlKWA7XG5cbiAgICByZXR1cm4gaW5zdHJ1Y3Rpb247XG59XG5cbi8qKiBSZXR1cm4gYXZhaWxhYmxlIENvY29zIENyZWF0b3IgYnVpbHQtaW4gY29tcG9uZW50IHR5cGVzIGJ5IGNhdGVnb3J5ICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QoY2F0ZWdvcnk6IHN0cmluZyA9ICdhbGwnKTogQWN0aW9uVG9vbFJlc3VsdCB7XG4gICAgY29uc3QgY29tcG9uZW50Q2F0ZWdvcmllczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICByZW5kZXJlcjogWydjYy5TcHJpdGUnLCAnY2MuTGFiZWwnLCAnY2MuUmljaFRleHQnLCAnY2MuTWFzaycsICdjYy5HcmFwaGljcyddLFxuICAgICAgICB1aTogWydjYy5CdXR0b24nLCAnY2MuVG9nZ2xlJywgJ2NjLlNsaWRlcicsICdjYy5TY3JvbGxWaWV3JywgJ2NjLkVkaXRCb3gnLCAnY2MuUHJvZ3Jlc3NCYXInXSxcbiAgICAgICAgcGh5c2ljczogWydjYy5SaWdpZEJvZHkyRCcsICdjYy5Cb3hDb2xsaWRlcjJEJywgJ2NjLkNpcmNsZUNvbGxpZGVyMkQnLCAnY2MuUG9seWdvbkNvbGxpZGVyMkQnXSxcbiAgICAgICAgYW5pbWF0aW9uOiBbJ2NjLkFuaW1hdGlvbicsICdjYy5BbmltYXRpb25DbGlwJywgJ2NjLlNrZWxldGFsQW5pbWF0aW9uJ10sXG4gICAgICAgIGF1ZGlvOiBbJ2NjLkF1ZGlvU291cmNlJ10sXG4gICAgICAgIGxheW91dDogWydjYy5MYXlvdXQnLCAnY2MuV2lkZ2V0JywgJ2NjLlBhZ2VWaWV3JywgJ2NjLlBhZ2VWaWV3SW5kaWNhdG9yJ10sXG4gICAgICAgIGVmZmVjdHM6IFsnY2MuTW90aW9uU3RyZWFrJywgJ2NjLlBhcnRpY2xlU3lzdGVtMkQnXSxcbiAgICAgICAgY2FtZXJhOiBbJ2NjLkNhbWVyYSddLFxuICAgICAgICBsaWdodDogWydjYy5MaWdodCcsICdjYy5EaXJlY3Rpb25hbExpZ2h0JywgJ2NjLlBvaW50TGlnaHQnLCAnY2MuU3BvdExpZ2h0J11cbiAgICB9O1xuXG4gICAgbGV0IGNvbXBvbmVudHM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGNhdGVnb3J5ID09PSAnYWxsJykge1xuICAgICAgICBmb3IgKGNvbnN0IGNhdCBpbiBjb21wb25lbnRDYXRlZ29yaWVzKSB7XG4gICAgICAgICAgICBjb21wb25lbnRzID0gY29tcG9uZW50cy5jb25jYXQoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRdKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29tcG9uZW50Q2F0ZWdvcmllc1tjYXRlZ29yeV0pIHtcbiAgICAgICAgY29tcG9uZW50cyA9IGNvbXBvbmVudENhdGVnb3JpZXNbY2F0ZWdvcnldO1xuICAgIH1cblxuICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY2F0ZWdvcnksIGNvbXBvbmVudHMgfSk7XG59XG5cbi8qKiBSZWRpcmVjdCBzZXRfcHJvcGVydHkgY2FsbHMgdGhhdCB0YXJnZXQgbm9kZS1sZXZlbCBwcm9wZXJ0aWVzIHRvIHRoZSBjb3JyZWN0IG1hbmFnZV9ub2RlIGFjdGlvbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzKGFyZ3M6IHtcbiAgICBub2RlVXVpZDogc3RyaW5nOyBjb21wb25lbnRUeXBlOiBzdHJpbmc7IHByb3BlcnR5OiBzdHJpbmc7IHZhbHVlOiBhbnk7XG59KTogQWN0aW9uVG9vbFJlc3VsdCB8IG51bGwge1xuICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCB2YWx1ZSB9ID0gYXJncztcbiAgICBjb25zdCBub2RlQmFzaWNQcm9wZXJ0aWVzID0gWyduYW1lJywgJ2FjdGl2ZScsICdsYXllcicsICdtb2JpbGl0eScsICdwYXJlbnQnLCAnY2hpbGRyZW4nLCAnaGlkZUZsYWdzJ107XG4gICAgY29uc3Qgbm9kZVRyYW5zZm9ybVByb3BlcnRpZXMgPSBbJ3Bvc2l0aW9uJywgJ3JvdGF0aW9uJywgJ3NjYWxlJywgJ2V1bGVyQW5nbGVzJywgJ2FuZ2xlJ107XG5cbiAgICBpZiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLk5vZGUnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdOb2RlJykge1xuICAgICAgICBpZiAobm9kZUJhc2ljUHJvcGVydGllcy5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGEgbm9kZSBiYXNpYyBwcm9wZXJ0eSwgbm90IGEgY29tcG9uZW50IHByb3BlcnR5YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogYFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3Byb3BlcnR5IHdpdGggdXVpZD1cIiR7bm9kZVV1aWR9XCIsIHByb3BlcnR5PVwiJHtwcm9wZXJ0eX1cIiwgdmFsdWU9JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIGlmIChub2RlVHJhbnNmb3JtUHJvcGVydGllcy5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIGlzIGEgbm9kZSB0cmFuc2Zvcm0gcHJvcGVydHksIG5vdCBhIGNvbXBvbmVudCBwcm9wZXJ0eWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF90cmFuc2Zvcm0gd2l0aCB1dWlkPVwiJHtub2RlVXVpZH1cIiwgJHtwcm9wZXJ0eX09JHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9YFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xufVxuXG4vKiogVmVyaWZ5IGEgcHJvcGVydHkgY2hhbmdlIHdhcyBhcHBsaWVkOyB1c2VzIGdldENvbXBvbmVudEluZm8gY2FsbGJhY2sgdG8gYXZvaWQgY2lyY3VsYXIgZGVwcyAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgIHByb3BlcnR5OiBzdHJpbmcsXG4gICAgb3JpZ2luYWxWYWx1ZTogYW55LFxuICAgIGV4cGVjdGVkVmFsdWU6IGFueSxcbiAgICBnZXRDb21wb25lbnRJbmZvOiAobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPHsgdmVyaWZpZWQ6IGJvb2xlYW47IGFjdHVhbFZhbHVlOiBhbnk7IGZ1bGxEYXRhOiBhbnkgfT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudEluZm8gPSBhd2FpdCBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKGNvbXBvbmVudEluZm8uc3VjY2VzcyAmJiBjb21wb25lbnRJbmZvLmRhdGEpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5RGF0YSA9IGNvbXBvbmVudEluZm8uZGF0YS5wcm9wZXJ0aWVzPy5bcHJvcGVydHldO1xuICAgICAgICAgICAgbGV0IGFjdHVhbFZhbHVlID0gcHJvcGVydHlEYXRhO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5RGF0YSAmJiB0eXBlb2YgcHJvcGVydHlEYXRhID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHByb3BlcnR5RGF0YSkge1xuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlID0gcHJvcGVydHlEYXRhLnZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgdmVyaWZpZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZXhwZWN0ZWRWYWx1ZSA9PT0gJ29iamVjdCcgJiYgZXhwZWN0ZWRWYWx1ZSAhPT0gbnVsbCAmJiAndXVpZCcgaW4gZXhwZWN0ZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFjdHVhbFV1aWQgPSBhY3R1YWxWYWx1ZSAmJiB0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiBhY3R1YWxWYWx1ZSA/IGFjdHVhbFZhbHVlLnV1aWQgOiAnJztcbiAgICAgICAgICAgICAgICBjb25zdCBleHBlY3RlZFV1aWQgPSBleHBlY3RlZFZhbHVlLnV1aWQgfHwgJyc7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBhY3R1YWxVdWlkID09PSBleHBlY3RlZFV1aWQgJiYgZXhwZWN0ZWRVdWlkICE9PSAnJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGFjdHVhbFZhbHVlID09PSB0eXBlb2YgZXhwZWN0ZWRWYWx1ZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYWN0dWFsVmFsdWUgPT09ICdvYmplY3QnICYmIGFjdHVhbFZhbHVlICE9PSBudWxsICYmIGV4cGVjdGVkVmFsdWUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgdmVyaWZpZWQgPSBKU09OLnN0cmluZ2lmeShhY3R1YWxWYWx1ZSkgPT09IEpTT04uc3RyaW5naWZ5KGV4cGVjdGVkVmFsdWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcmlmaWVkID0gYWN0dWFsVmFsdWUgPT09IGV4cGVjdGVkVmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2ZXJpZmllZCA9IFN0cmluZyhhY3R1YWxWYWx1ZSkgPT09IFN0cmluZyhleHBlY3RlZFZhbHVlKSB8fCBOdW1iZXIoYWN0dWFsVmFsdWUpID09PSBOdW1iZXIoZXhwZWN0ZWRWYWx1ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgdmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgZnVsbERhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZWRQcm9wZXJ0eTogeyBuYW1lOiBwcm9wZXJ0eSwgYmVmb3JlOiBvcmlnaW5hbFZhbHVlLCBleHBlY3RlZDogZXhwZWN0ZWRWYWx1ZSwgYWN0dWFsOiBhY3R1YWxWYWx1ZSwgdmVyaWZpZWQgfSxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50U3VtbWFyeTogeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgdG90YWxQcm9wZXJ0aWVzOiBPYmplY3Qua2V5cyhjb21wb25lbnRJbmZvLmRhdGE/LnByb3BlcnRpZXMgfHwge30pLmxlbmd0aCB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNYW5hZ2VDb21wb25lbnQudmVyaWZ5UHJvcGVydHlDaGFuZ2VdIFZlcmlmaWNhdGlvbiBmYWlsZWQ6JywgZXJyb3IpO1xuICAgIH1cbiAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIGFjdHVhbFZhbHVlOiB1bmRlZmluZWQsIGZ1bGxEYXRhOiBudWxsIH07XG59XG4iXX0=