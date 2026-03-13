/**
 * Pure helper functions for component property analysis, validation, and query utilities.
 * Extracted from ManageComponent to keep manage-component.ts under 200 lines.
 */

import { ActionToolResult, successResult } from '../types';

export interface PropertyAnalysisResult {
    exists: boolean;
    type: string;
    availableProperties: string[];
    originalValue: any;
}

/** Returns true if propData looks like a Cocos Creator property descriptor object */
export function isValidPropertyDescriptor(propData: any): boolean {
    if (typeof propData !== 'object' || propData === null) return false;
    try {
        const keys = Object.keys(propData);
        // Skip simple value objects like {width: 200, height: 150}
        const isSimpleValueObject = keys.every(key => {
            const v = propData[key];
            return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';
        });
        if (isSimpleValueObject) return false;
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
    } catch {
        return false;
    }
}

/** Analyze a component's property to determine its type and current value */
export function analyzeProperty(component: any, propertyName: string): PropertyAnalysisResult {
    const availableProperties: string[] = [];
    let propertyValue: any = undefined;
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
                const propInfo = propData as any;
                availableProperties.push(key);
                if (key === propertyName) {
                    try {
                        const propKeys = Object.keys(propInfo);
                        propertyValue = propKeys.includes('value') ? propInfo.value : propInfo;
                    } catch {
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
        if (propertyName.toLowerCase().includes('node')) type = 'nodeArray';
        else if (propertyName.toLowerCase().includes('color')) type = 'colorArray';
        else type = 'array';
    } else if (typeof propertyValue === 'string') {
        type = ['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'].includes(propertyName.toLowerCase()) ? 'asset' : 'string';
    } else if (typeof propertyValue === 'number') {
        type = 'number';
    } else if (typeof propertyValue === 'boolean') {
        type = 'boolean';
    } else if (propertyValue && typeof propertyValue === 'object') {
        try {
            const keys = Object.keys(propertyValue);
            if (keys.includes('r') && keys.includes('g') && keys.includes('b')) {
                type = 'color';
            } else if (keys.includes('x') && keys.includes('y')) {
                type = propertyValue.z !== undefined ? 'vec3' : 'vec2';
            } else if (keys.includes('width') && keys.includes('height')) {
                type = 'size';
            } else if (keys.includes('uuid') || keys.includes('__uuid__')) {
                type = (propertyName.toLowerCase().includes('node') || propertyName.toLowerCase().includes('target') || keys.includes('__id__')) ? 'node' : 'asset';
            } else if (keys.includes('__id__')) {
                type = 'node';
            } else {
                type = 'object';
            }
        } catch {
            type = 'object';
        }
    } else if (propertyValue === null || propertyValue === undefined) {
        if (['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'].includes(propertyName.toLowerCase())) {
            type = 'asset';
        } else if (propertyName.toLowerCase().includes('node') || propertyName.toLowerCase().includes('target')) {
            type = 'node';
        } else if (propertyName.toLowerCase().includes('component')) {
            type = 'component';
        }
    }

    return { exists: true, type, availableProperties, originalValue: propertyValue };
}

/** Parse a hex color string (#RGB or #RGBA) to an RGBA object */
export function parseColorString(colorStr: string): { r: number; g: number; b: number; a: number } {
    const str = colorStr.trim();
    if (str.startsWith('#')) {
        if (str.length === 7) {
            return {
                r: parseInt(str.substring(1, 3), 16),
                g: parseInt(str.substring(3, 5), 16),
                b: parseInt(str.substring(5, 7), 16),
                a: 255
            };
        } else if (str.length === 9) {
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
export function convertPropertyValue(propertyType: string, value: any): any {
    switch (propertyType) {
        case 'string':
            return String(value);
        case 'number': case 'integer': case 'float':
            return Number(value);
        case 'boolean':
            return Boolean(value);
        case 'color':
            if (typeof value === 'string') return parseColorString(value);
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
            if (typeof value === 'object' && value !== null) return { x: Number(value.x) || 0, y: Number(value.y) || 0 };
            throw new Error('Vec2 value must be an object with x, y properties');
        case 'vec3':
            if (typeof value === 'object' && value !== null) return { x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 };
            throw new Error('Vec3 value must be an object with x, y, z properties');
        case 'size':
            if (typeof value === 'object' && value !== null) return { width: Number(value.width) || 0, height: Number(value.height) || 0 };
            throw new Error('Size value must be an object with width, height properties');
        case 'node':
            if (typeof value === 'string') return { uuid: value };
            throw new Error('Node reference value must be a string UUID');
        case 'component':
            if (typeof value === 'string') return value; // resolved to __id__ later
            throw new Error('Component reference value must be a string (node UUID containing the target component)');
        case 'spriteFrame': case 'prefab': case 'asset':
            if (typeof value === 'string') return { uuid: value };
            throw new Error(`${propertyType} value must be a string UUID`);
        case 'nodeArray':
            if (Array.isArray(value)) return value.map((item: any) => { if (typeof item === 'string') return { uuid: item }; throw new Error('NodeArray items must be string UUIDs'); });
            throw new Error('NodeArray value must be an array');
        case 'colorArray':
            if (Array.isArray(value)) return value.map((item: any) => {
                if (typeof item === 'object' && item !== null && 'r' in item) {
                    return { r: Math.min(255, Math.max(0, Number(item.r) || 0)), g: Math.min(255, Math.max(0, Number(item.g) || 0)), b: Math.min(255, Math.max(0, Number(item.b) || 0)), a: item.a !== undefined ? Math.min(255, Math.max(0, Number(item.a))) : 255 };
                }
                return { r: 255, g: 255, b: 255, a: 255 };
            });
            throw new Error('ColorArray value must be an array');
        case 'numberArray':
            if (Array.isArray(value)) return value.map((item: any) => Number(item));
            throw new Error('NumberArray value must be an array');
        case 'stringArray':
            if (Array.isArray(value)) return value.map((item: any) => String(item));
            throw new Error('StringArray value must be an array');
        default:
            throw new Error(`Unsupported property type: ${propertyType}`);
    }
}

/** Generate an LLM-friendly suggestion when requested component type is not found */
export function generateComponentSuggestion(requestedType: string, availableTypes: string[], property: string): string {
    const similarTypes = availableTypes.filter(type =>
        type.toLowerCase().includes(requestedType.toLowerCase()) ||
        requestedType.toLowerCase().includes(type.toLowerCase())
    );

    let instruction = '';
    if (similarTypes.length > 0) {
        instruction += `\nFound similar components: ${similarTypes.join(', ')}`;
        instruction += `\nSuggestion: Perhaps you meant '${similarTypes[0]}'?`;
    }

    const propertyToComponentMap: Record<string, string[]> = {
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
export function getAvailableComponentsList(category: string = 'all'): ActionToolResult {
    const componentCategories: Record<string, string[]> = {
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

    let components: string[] = [];
    if (category === 'all') {
        for (const cat in componentCategories) {
            components = components.concat(componentCategories[cat]);
        }
    } else if (componentCategories[category]) {
        components = componentCategories[category];
    }

    return successResult({ category, components });
}

/** Redirect set_property calls that target node-level properties to the correct manage_node action */
export function redirectNodePropertyAccess(args: {
    nodeUuid: string; componentType: string; property: string; value: any;
}): ActionToolResult | null {
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
        } else if (nodeTransformProperties.includes(property)) {
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
export async function verifyComponentPropertyChange(
    nodeUuid: string,
    componentType: string,
    property: string,
    originalValue: any,
    expectedValue: any,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<{ verified: boolean; actualValue: any; fullData: any }> {
    try {
        const componentInfo = await getComponentInfo(nodeUuid, componentType);
        if (componentInfo.success && componentInfo.data) {
            const propertyData = componentInfo.data.properties?.[property];
            let actualValue = propertyData;
            if (propertyData && typeof propertyData === 'object' && 'value' in propertyData) {
                actualValue = propertyData.value;
            }

            let verified = false;
            if (typeof expectedValue === 'object' && expectedValue !== null && 'uuid' in expectedValue) {
                const actualUuid = actualValue && typeof actualValue === 'object' && 'uuid' in actualValue ? actualValue.uuid : '';
                const expectedUuid = expectedValue.uuid || '';
                verified = actualUuid === expectedUuid && expectedUuid !== '';
            } else if (typeof actualValue === typeof expectedValue) {
                if (typeof actualValue === 'object' && actualValue !== null && expectedValue !== null) {
                    verified = JSON.stringify(actualValue) === JSON.stringify(expectedValue);
                } else {
                    verified = actualValue === expectedValue;
                }
            } else {
                verified = String(actualValue) === String(expectedValue) || Number(actualValue) === Number(expectedValue);
            }

            return {
                verified,
                actualValue,
                fullData: {
                    modifiedProperty: { name: property, before: originalValue, expected: expectedValue, actual: actualValue, verified },
                    componentSummary: { nodeUuid, componentType, totalProperties: Object.keys(componentInfo.data?.properties || {}).length }
                }
            };
        }
    } catch (error) {
        console.error('[ManageComponent.verifyPropertyChange] Verification failed:', error);
    }
    return { verified: false, actualValue: undefined, fullData: null };
}
