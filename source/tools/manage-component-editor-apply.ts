/**
 * Editor API calls for applying component property values.
 * Extracted from ManageComponent.setComponentProperty (Step 6).
 * Each property type uses a different dump format for Editor.Message.request('scene', 'set-property').
 */

import { ActionToolResult } from '../types';

export interface ApplyPropertyArgs {
    nodeUuid: string;
    propertyPath: string;
    rawComponentIndex: number;
    componentType: string;
    property: string;
    propertyType: string;
    value: any;
    processedValue: any;
}

/**
 * Apply a processed property value to the Cocos Creator editor scene.
 * Returns the actual expected value (may differ from processedValue for component refs).
 * Throws on unrecoverable Editor API error.
 */
export async function applyPropertyToEditor(
    args: ApplyPropertyArgs,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<any> {
    const { nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue } = args;
    let actualExpectedValue = processedValue;

    if (propertyType === 'asset' || propertyType === 'spriteFrame' || propertyType === 'prefab' ||
        (propertyType === 'string' && ['spriteFrame', 'texture', 'material', 'font', 'clip', 'prefab'].some(k => property.toLowerCase().includes(k)))) {

        let assetType = 'cc.SpriteFrame';
        if (property.toLowerCase().includes('texture')) assetType = 'cc.Texture2D';
        else if (property.toLowerCase().includes('material')) assetType = 'cc.Material';
        else if (property.toLowerCase().includes('font')) assetType = 'cc.Font';
        else if (property.toLowerCase().includes('clip')) assetType = 'cc.AudioClip';
        else if (propertyType === 'prefab') assetType = 'cc.Prefab';

        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: processedValue, type: assetType }
        });

    } else if (componentType === 'cc.UITransform' && (property === '_contentSize' || property === 'contentSize')) {
        const width = Number(value.width) || 100;
        const height = Number(value.height) || 100;
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.width`, dump: { value: width }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.height`, dump: { value: height }
        });

    } else if (componentType === 'cc.UITransform' && (property === '_anchorPoint' || property === 'anchorPoint')) {
        const anchorX = Number(value.x) || 0.5;
        const anchorY = Number(value.y) || 0.5;
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.anchorX`, dump: { value: anchorX }
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: `__comps__.${rawComponentIndex}.anchorY`, dump: { value: anchorY }
        });

    } else if (propertyType === 'color' && processedValue && typeof processedValue === 'object') {
        const colorValue = {
            r: Math.min(255, Math.max(0, Number(processedValue.r) || 0)),
            g: Math.min(255, Math.max(0, Number(processedValue.g) || 0)),
            b: Math.min(255, Math.max(0, Number(processedValue.b) || 0)),
            a: processedValue.a !== undefined ? Math.min(255, Math.max(0, Number(processedValue.a))) : 255
        };
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: colorValue, type: 'cc.Color' }
        });

    } else if (propertyType === 'vec3' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0, z: Number(processedValue.z) || 0 }, type: 'cc.Vec3' }
        });

    } else if (propertyType === 'vec2' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0 }, type: 'cc.Vec2' }
        });

    } else if (propertyType === 'size' && processedValue && typeof processedValue === 'object') {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath,
            dump: { value: { width: Number(processedValue.width) || 0, height: Number(processedValue.height) || 0 }, type: 'cc.Size' }
        });

    } else if (propertyType === 'node' && processedValue && typeof processedValue === 'object' && 'uuid' in processedValue) {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue, type: 'cc.Node' }
        });

    } else if (propertyType === 'component' && typeof processedValue === 'string') {
        actualExpectedValue = await applyComponentReference(
            nodeUuid, propertyPath, componentType, property, processedValue, getComponentInfo
        );

    } else if (propertyType === 'nodeArray' && Array.isArray(processedValue)) {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue }
        });

    } else if (propertyType === 'colorArray' && Array.isArray(processedValue)) {
        const colorArrayValue = processedValue.map((item: any) => {
            if (item && typeof item === 'object' && 'r' in item) {
                return {
                    r: Math.min(255, Math.max(0, Number(item.r) || 0)),
                    g: Math.min(255, Math.max(0, Number(item.g) || 0)),
                    b: Math.min(255, Math.max(0, Number(item.b) || 0)),
                    a: item.a !== undefined ? Math.min(255, Math.max(0, Number(item.a))) : 255
                };
            }
            return { r: 255, g: 255, b: 255, a: 255 };
        });
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: colorArrayValue, type: 'cc.Color' }
        });

    } else {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid, path: propertyPath, dump: { value: processedValue }
        });
    }

    return actualExpectedValue;
}

/** Resolve a component reference UUID to scene __id__ and call set-property. Returns { uuid } object. */
async function applyComponentReference(
    nodeUuid: string,
    propertyPath: string,
    componentType: string,
    property: string,
    targetNodeUuid: string,
    getComponentInfo: (nodeUuid: string, componentType: string) => Promise<ActionToolResult>
): Promise<any> {
    console.log(`[ManageComponent] Setting component reference - finding component on node: ${targetNodeUuid}`);

    let expectedComponentType = '';
    const currentComponentInfo = await getComponentInfo(nodeUuid, componentType);
    if (currentComponentInfo.success && currentComponentInfo.data?.properties?.[property]) {
        const propertyMeta = currentComponentInfo.data.properties[property];
        if (propertyMeta && typeof propertyMeta === 'object') {
            if (propertyMeta.type) {
                expectedComponentType = propertyMeta.type;
            } else if (propertyMeta.ctor) {
                expectedComponentType = propertyMeta.ctor;
            } else if (propertyMeta.extends && Array.isArray(propertyMeta.extends)) {
                for (const extendType of propertyMeta.extends) {
                    if (extendType.startsWith('cc.') && extendType !== 'cc.Component' && extendType !== 'cc.Object') {
                        expectedComponentType = extendType;
                        break;
                    }
                }
            }
        }
    }

    if (!expectedComponentType) {
        throw new Error(`Unable to determine required component type for property '${property}' on component '${componentType}'. Property metadata may not contain type information.`);
    }

    const targetNodeData = await Editor.Message.request('scene', 'query-node', targetNodeUuid);
    if (!targetNodeData || !targetNodeData.__comps__) {
        throw new Error(`Target node ${targetNodeUuid} not found or has no components`);
    }

    let componentId: string | null = null;
    let foundComponent = null;
    for (let i = 0; i < targetNodeData.__comps__.length; i++) {
        const comp = targetNodeData.__comps__[i] as any;
        if (comp.type === expectedComponentType) {
            foundComponent = comp;
            if (comp.value && comp.value.uuid && comp.value.uuid.value) {
                componentId = comp.value.uuid.value;
            } else {
                throw new Error(`Unable to extract component ID from component structure`);
            }
            break;
        }
    }

    if (!foundComponent) {
        const available = targetNodeData.__comps__.map((comp: any) => {
            const sceneId = comp.value && comp.value.uuid && comp.value.uuid.value ? comp.value.uuid.value : 'unknown';
            return `${comp.type}(scene_id:${sceneId})`;
        });
        throw new Error(`Component type '${expectedComponentType}' not found on node ${targetNodeUuid}. Available components: ${available.join(', ')}`);
    }

    await Editor.Message.request('scene', 'set-property', {
        uuid: nodeUuid, path: propertyPath,
        dump: { value: { uuid: componentId }, type: expectedComponentType }
    });

    return { uuid: componentId };
}
