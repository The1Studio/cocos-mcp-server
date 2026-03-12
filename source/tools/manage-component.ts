import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';

export class ManageComponent extends BaseActionTool {
    readonly name = 'manage_component';
    readonly description = 'Manage components on scene nodes. Actions: add=add component to node, remove=remove component (use cid from get_all), get_all=list all components on node, get_info=get specific component details and properties, set_property=set a component property value, attach_script=attach a TypeScript/JavaScript script component, get_available=list available component types by category. NOTE: For node basic properties (name, active, layer) use manage_node action=set_property. For transforms (position, rotation, scale) use manage_node action=set_transform.';
    readonly actions = ['add', 'remove', 'get_all', 'get_info', 'set_property', 'attach_script', 'get_available'];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add', 'remove', 'get_all', 'get_info', 'set_property', 'attach_script', 'get_available'],
                description: 'Action to perform: add=add component to node, remove=remove component (use cid from get_all), get_all=list all components, get_info=get component details, set_property=set a property value, attach_script=attach a script file, get_available=list available types'
            },
            nodeUuid: {
                type: 'string',
                description: '[add, remove, get_all, get_info, set_property, attach_script] Target node UUID. Use manage_node action=get_all to find node UUIDs.'
            },
            componentType: {
                type: 'string',
                description: '[add] Component type to add (e.g., cc.Sprite, cc.Label, cc.Button). [remove] Component cid (the type field from get_all — NOT script name). [get_info, set_property] Component type to target.'
            },
            property: {
                type: 'string',
                description: '[set_property] Property name to set. Examples: cc.Label → string, fontSize, color; cc.Sprite → spriteFrame, color; cc.UITransform → contentSize, anchorPoint.'
            },
            propertyType: {
                type: 'string',
                enum: [
                    'string', 'number', 'boolean', 'integer', 'float',
                    'color', 'vec2', 'vec3', 'size',
                    'node', 'component', 'spriteFrame', 'prefab', 'asset',
                    'nodeArray', 'colorArray', 'numberArray', 'stringArray'
                ],
                description: '[set_property] Property data type for correct value conversion. Must match the actual property type.'
            },
            value: {
                description: '[set_property] Property value. Format depends on propertyType: string="text", number=42, boolean=true, color={"r":255,"g":0,"b":0,"a":255} or "#FF0000", vec2={"x":100,"y":50}, vec3={"x":1,"y":2,"z":3}, size={"width":100,"height":50}, node/component/spriteFrame/prefab/asset="uuid-string", nodeArray=["uuid1","uuid2"], colorArray=[{"r":255,...}], numberArray=[1,2,3], stringArray=["a","b"]'
            },
            scriptPath: {
                type: 'string',
                description: '[attach_script] Script asset path (e.g., db://assets/scripts/MyScript.ts)'
            },
            category: {
                type: 'string',
                enum: ['all', 'renderer', 'ui', 'physics', 'animation', 'audio'],
                description: '[get_available] Component category filter. Default: all',
                default: 'all'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add: (args) => this.addComponent(args.nodeUuid, args.componentType),
        remove: (args) => this.removeComponent(args.nodeUuid, args.componentType),
        get_all: (args) => this.getComponents(args.nodeUuid),
        get_info: (args) => this.getComponentInfo(args.nodeUuid, args.componentType),
        set_property: (args) => this.setComponentProperty(args),
        attach_script: (args) => this.attachScript(args.nodeUuid, args.scriptPath),
        get_available: (args) => this.getAvailableComponents(args.category)
    };

    private async addComponent(nodeUuid: string, componentType: string): Promise<ActionToolResult> {
        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=add');
        }
        return new Promise(async (resolve) => {
            // Check if component already exists on node
            const allComponentsInfo = await this.getComponents(nodeUuid);
            if (allComponentsInfo.success && allComponentsInfo.data?.components) {
                const existingComponent = allComponentsInfo.data.components.find((comp: any) => comp.type === componentType);
                if (existingComponent) {
                    resolve(successResult(
                        { nodeUuid, componentType, componentVerified: true, existing: true },
                        `Component '${componentType}' already exists on node`
                    ));
                    return;
                }
            }
            // Try adding component via Editor API directly
            Editor.Message.request('scene', 'create-component', {
                uuid: nodeUuid,
                component: componentType
            }).then(async (_result: any) => {
                // Wait for editor to finish adding the component
                await new Promise(r => setTimeout(r, 100));
                // Re-query to verify the component was actually added
                try {
                    const allComponentsInfo2 = await this.getComponents(nodeUuid);
                    if (allComponentsInfo2.success && allComponentsInfo2.data?.components) {
                        const addedComponent = allComponentsInfo2.data.components.find((comp: any) => comp.type === componentType);
                        if (addedComponent) {
                            resolve(successResult(
                                { nodeUuid, componentType, componentVerified: true, existing: false },
                                `Component '${componentType}' added successfully`
                            ));
                        } else {
                            resolve(errorResult(`Component '${componentType}' was not found on node after addition. Available components: ${allComponentsInfo2.data.components.map((c: any) => c.type).join(', ')}`));
                        }
                    } else {
                        resolve(errorResult(`Failed to verify component addition: ${allComponentsInfo2.error || 'Unable to get node components'}`));
                    }
                } catch (verifyError: any) {
                    resolve(errorResult(`Failed to verify component addition: ${verifyError.message}`));
                }
            }).catch((err: Error) => {
                // Fallback: use scene script
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'addComponentToNode',
                    args: [nodeUuid, componentType]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve(errorResult(result?.error || `Direct API failed: ${err.message}`));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private async removeComponent(nodeUuid: string, componentType: string): Promise<ActionToolResult> {
        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=remove');
        }
        return new Promise(async (resolve) => {
            // Get all components to verify the cid exists
            const allComponentsInfo = await this.getComponents(nodeUuid);
            if (!allComponentsInfo.success || !allComponentsInfo.data?.components) {
                resolve(errorResult(`Failed to get components for node '${nodeUuid}': ${allComponentsInfo.error}`));
                return;
            }
            // Match by type field (cid) only
            const exists = allComponentsInfo.data.components.some((comp: any) => comp.type === componentType);
            if (!exists) {
                resolve(errorResult(`Component cid '${componentType}' not found on node '${nodeUuid}'. Use action=get_all to get the type field (cid) for componentType.`));
                return;
            }
            try {
                await Editor.Message.request('scene', 'remove-component', {
                    uuid: nodeUuid,
                    component: componentType
                });
                // Re-query to confirm removal
                const afterRemoveInfo = await this.getComponents(nodeUuid);
                const stillExists = afterRemoveInfo.success && afterRemoveInfo.data?.components?.some((comp: any) => comp.type === componentType);
                if (stillExists) {
                    resolve(errorResult(`Component cid '${componentType}' was not removed from node '${nodeUuid}'.`));
                } else {
                    resolve(successResult(
                        { nodeUuid, componentType },
                        `Component cid '${componentType}' removed successfully from node '${nodeUuid}'`
                    ));
                }
            } catch (err: any) {
                resolve(errorResult(`Failed to remove component: ${err.message}`));
            }
        });
    }

    private async getComponents(nodeUuid: string): Promise<ActionToolResult> {
        if (!nodeUuid) return errorResult('nodeUuid is required for action=get_all');
        return new Promise((resolve) => {
            // Try direct Editor API first
            Editor.Message.request('scene', 'query-node', nodeUuid).then((nodeData: any) => {
                if (nodeData && nodeData.__comps__) {
                    const components = nodeData.__comps__.map((comp: any) => ({
                        type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                        uuid: comp.uuid?.value || comp.uuid || null,
                        enabled: comp.enabled !== undefined ? comp.enabled : true,
                        properties: this.extractComponentProperties(comp)
                    }));
                    resolve(successResult({ nodeUuid, components }));
                } else {
                    resolve(errorResult('Node not found or no components data'));
                }
            }).catch((err: Error) => {
                // Fallback: use scene script
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getNodeInfo',
                    args: [nodeUuid]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result.success) {
                        resolve(successResult(result.data.components));
                    } else {
                        resolve(errorResult(result?.error || err.message));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private async getComponentInfo(nodeUuid: string, componentType: string): Promise<ActionToolResult> {
        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=get_info');
        }
        return new Promise((resolve) => {
            // Try direct Editor API first
            Editor.Message.request('scene', 'query-node', nodeUuid).then((nodeData: any) => {
                if (nodeData && nodeData.__comps__) {
                    const component = nodeData.__comps__.find((comp: any) => {
                        const compType = comp.__type__ || comp.cid || comp.type;
                        return compType === componentType;
                    });
                    if (component) {
                        resolve(successResult({
                            nodeUuid,
                            componentType,
                            enabled: component.enabled !== undefined ? component.enabled : true,
                            properties: this.extractComponentProperties(component)
                        }));
                    } else {
                        resolve(errorResult(`Component '${componentType}' not found on node`));
                    }
                } else {
                    resolve(errorResult('Node not found or no components data'));
                }
            }).catch((err: Error) => {
                // Fallback: use scene script
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getNodeInfo',
                    args: [nodeUuid]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result.success && result.data.components) {
                        const component = result.data.components.find((comp: any) => comp.type === componentType);
                        if (component) {
                            resolve(successResult({ nodeUuid, componentType, ...component }));
                        } else {
                            resolve(errorResult(`Component '${componentType}' not found on node`));
                        }
                    } else {
                        resolve(errorResult(result?.error || 'Failed to get component info'));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private extractComponentProperties(component: any): Record<string, any> {
        // If the component has a value property, it contains all actual component properties
        if (component.value && typeof component.value === 'object') {
            return component.value;
        }
        // Fallback: extract properties directly from the component object
        const properties: Record<string, any> = {};
        const excludeKeys = ['__type__', 'enabled', 'node', '_id', '__scriptAsset', 'uuid', 'name', '_name', '_objFlags', '_enabled', 'type', 'readonly', 'visible', 'cid', 'editor', 'extends'];
        for (const key in component) {
            if (!excludeKeys.includes(key) && !key.startsWith('_')) {
                properties[key] = component[key];
            }
        }
        return properties;
    }

    private async setComponentProperty(args: any): Promise<ActionToolResult> {
        const { nodeUuid, componentType, property, propertyType, value } = args;

        if (!nodeUuid || !componentType || !property || propertyType === undefined || value === undefined) {
            return errorResult('nodeUuid, componentType, property, propertyType, and value are required for action=set_property');
        }

        return new Promise(async (resolve) => {
            try {
                console.log(`[ManageComponent] Setting ${componentType}.${property} (type: ${propertyType}) = ${JSON.stringify(value)} on node ${nodeUuid}`);

                // Step 0: Detect if user is trying to set a node property; redirect with guidance
                const nodeRedirectResult = await this.checkAndRedirectNodeProperties(args);
                if (nodeRedirectResult) {
                    resolve(nodeRedirectResult);
                    return;
                }

                // Step 1: Get all components on the node
                const componentsResponse = await this.getComponents(nodeUuid);
                if (!componentsResponse.success || !componentsResponse.data) {
                    resolve(errorResult(`Failed to get components for node '${nodeUuid}': ${componentsResponse.error}`));
                    return;
                }

                const allComponents = componentsResponse.data.components;

                // Step 2: Find the target component
                let targetComponent = null;
                const availableTypes: string[] = [];
                for (let i = 0; i < allComponents.length; i++) {
                    const comp = allComponents[i];
                    availableTypes.push(comp.type);
                    if (comp.type === componentType) {
                        targetComponent = comp;
                        break;
                    }
                }

                if (!targetComponent) {
                    const instruction = this.generateComponentSuggestion(componentType, availableTypes, property);
                    resolve({
                        success: false,
                        error: `Component '${componentType}' not found on node. Available components: ${availableTypes.join(', ')}`,
                        instruction
                    });
                    return;
                }

                // Step 3: Analyze the property to get original value and type info
                let propertyInfo;
                try {
                    propertyInfo = this.analyzeProperty(targetComponent, property);
                } catch (analyzeError: any) {
                    resolve(errorResult(`Failed to analyze property '${property}': ${analyzeError.message}`));
                    return;
                }

                if (!propertyInfo.exists) {
                    resolve(errorResult(`Property '${property}' not found on component '${componentType}'. Available properties: ${propertyInfo.availableProperties.join(', ')}`));
                    return;
                }

                // Step 4: Convert value based on explicit propertyType
                const originalValue = propertyInfo.originalValue;
                let processedValue: any;

                switch (propertyType) {
                    case 'string':
                        processedValue = String(value);
                        break;
                    case 'number':
                    case 'integer':
                    case 'float':
                        processedValue = Number(value);
                        break;
                    case 'boolean':
                        processedValue = Boolean(value);
                        break;
                    case 'color':
                        if (typeof value === 'string') {
                            processedValue = this.parseColorString(value);
                        } else if (typeof value === 'object' && value !== null) {
                            processedValue = {
                                r: Math.min(255, Math.max(0, Number(value.r) || 0)),
                                g: Math.min(255, Math.max(0, Number(value.g) || 0)),
                                b: Math.min(255, Math.max(0, Number(value.b) || 0)),
                                a: value.a !== undefined ? Math.min(255, Math.max(0, Number(value.a))) : 255
                            };
                        } else {
                            throw new Error('Color value must be an object with r, g, b properties or a hexadecimal string (e.g., "#FF0000")');
                        }
                        break;
                    case 'vec2':
                        if (typeof value === 'object' && value !== null) {
                            processedValue = { x: Number(value.x) || 0, y: Number(value.y) || 0 };
                        } else {
                            throw new Error('Vec2 value must be an object with x, y properties');
                        }
                        break;
                    case 'vec3':
                        if (typeof value === 'object' && value !== null) {
                            processedValue = { x: Number(value.x) || 0, y: Number(value.y) || 0, z: Number(value.z) || 0 };
                        } else {
                            throw new Error('Vec3 value must be an object with x, y, z properties');
                        }
                        break;
                    case 'size':
                        if (typeof value === 'object' && value !== null) {
                            processedValue = { width: Number(value.width) || 0, height: Number(value.height) || 0 };
                        } else {
                            throw new Error('Size value must be an object with width, height properties');
                        }
                        break;
                    case 'node':
                        if (typeof value === 'string') {
                            processedValue = { uuid: value };
                        } else {
                            throw new Error('Node reference value must be a string UUID');
                        }
                        break;
                    case 'component':
                        if (typeof value === 'string') {
                            // Component reference: store node UUID temporarily, resolve to __id__ below
                            processedValue = value;
                        } else {
                            throw new Error('Component reference value must be a string (node UUID containing the target component)');
                        }
                        break;
                    case 'spriteFrame':
                    case 'prefab':
                    case 'asset':
                        if (typeof value === 'string') {
                            processedValue = { uuid: value };
                        } else {
                            throw new Error(`${propertyType} value must be a string UUID`);
                        }
                        break;
                    case 'nodeArray':
                        if (Array.isArray(value)) {
                            processedValue = value.map((item: any) => {
                                if (typeof item === 'string') return { uuid: item };
                                throw new Error('NodeArray items must be string UUIDs');
                            });
                        } else {
                            throw new Error('NodeArray value must be an array');
                        }
                        break;
                    case 'colorArray':
                        if (Array.isArray(value)) {
                            processedValue = value.map((item: any) => {
                                if (typeof item === 'object' && item !== null && 'r' in item) {
                                    return {
                                        r: Math.min(255, Math.max(0, Number(item.r) || 0)),
                                        g: Math.min(255, Math.max(0, Number(item.g) || 0)),
                                        b: Math.min(255, Math.max(0, Number(item.b) || 0)),
                                        a: item.a !== undefined ? Math.min(255, Math.max(0, Number(item.a))) : 255
                                    };
                                }
                                return { r: 255, g: 255, b: 255, a: 255 };
                            });
                        } else {
                            throw new Error('ColorArray value must be an array');
                        }
                        break;
                    case 'numberArray':
                        if (Array.isArray(value)) {
                            processedValue = value.map((item: any) => Number(item));
                        } else {
                            throw new Error('NumberArray value must be an array');
                        }
                        break;
                    case 'stringArray':
                        if (Array.isArray(value)) {
                            processedValue = value.map((item: any) => String(item));
                        } else {
                            throw new Error('StringArray value must be an array');
                        }
                        break;
                    default:
                        throw new Error(`Unsupported property type: ${propertyType}`);
                }

                // Step 5: Get raw node data to build the correct __comps__ path
                const rawNodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
                if (!rawNodeData || !rawNodeData.__comps__) {
                    resolve(errorResult('Failed to get raw node data for property setting'));
                    return;
                }

                // Find the component index in the raw __comps__ array
                let rawComponentIndex = -1;
                for (let i = 0; i < rawNodeData.__comps__.length; i++) {
                    const comp = rawNodeData.__comps__[i] as any;
                    const compType = comp.__type__ || comp.cid || comp.type || 'Unknown';
                    if (compType === componentType) {
                        rawComponentIndex = i;
                        break;
                    }
                }

                if (rawComponentIndex === -1) {
                    resolve(errorResult('Could not find component index for setting property'));
                    return;
                }

                const propertyPath = `__comps__.${rawComponentIndex}.${property}`;

                // Track actual expected value for verification (component refs need special handling)
                let actualExpectedValue = processedValue;

                // Step 6: Apply the property using the appropriate method per type
                if (propertyType === 'asset' || propertyType === 'spriteFrame' || propertyType === 'prefab' ||
                    (propertyInfo.type === 'asset' && propertyType === 'string')) {

                    // Determine asset type from property name
                    let assetType = 'cc.SpriteFrame';
                    if (property.toLowerCase().includes('texture')) assetType = 'cc.Texture2D';
                    else if (property.toLowerCase().includes('material')) assetType = 'cc.Material';
                    else if (property.toLowerCase().includes('font')) assetType = 'cc.Font';
                    else if (property.toLowerCase().includes('clip')) assetType = 'cc.AudioClip';
                    else if (propertyType === 'prefab') assetType = 'cc.Prefab';

                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: processedValue, type: assetType }
                    });

                } else if (componentType === 'cc.UITransform' && (property === '_contentSize' || property === 'contentSize')) {
                    // UITransform contentSize: set width and height separately
                    const width = Number(value.width) || 100;
                    const height = Number(value.height) || 100;
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: `__comps__.${rawComponentIndex}.width`,
                        dump: { value: width }
                    });
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: `__comps__.${rawComponentIndex}.height`,
                        dump: { value: height }
                    });

                } else if (componentType === 'cc.UITransform' && (property === '_anchorPoint' || property === 'anchorPoint')) {
                    // UITransform anchorPoint: set anchorX and anchorY separately
                    const anchorX = Number(value.x) || 0.5;
                    const anchorY = Number(value.y) || 0.5;
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: `__comps__.${rawComponentIndex}.anchorX`,
                        dump: { value: anchorX }
                    });
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: `__comps__.${rawComponentIndex}.anchorY`,
                        dump: { value: anchorY }
                    });

                } else if (propertyType === 'color' && processedValue && typeof processedValue === 'object') {
                    // Color: clamp all RGBA channels to 0-255 range
                    const colorValue = {
                        r: Math.min(255, Math.max(0, Number(processedValue.r) || 0)),
                        g: Math.min(255, Math.max(0, Number(processedValue.g) || 0)),
                        b: Math.min(255, Math.max(0, Number(processedValue.b) || 0)),
                        a: processedValue.a !== undefined ? Math.min(255, Math.max(0, Number(processedValue.a))) : 255
                    };
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: colorValue, type: 'cc.Color' }
                    });

                } else if (propertyType === 'vec3' && processedValue && typeof processedValue === 'object') {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: {
                            value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0, z: Number(processedValue.z) || 0 },
                            type: 'cc.Vec3'
                        }
                    });

                } else if (propertyType === 'vec2' && processedValue && typeof processedValue === 'object') {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: {
                            value: { x: Number(processedValue.x) || 0, y: Number(processedValue.y) || 0 },
                            type: 'cc.Vec2'
                        }
                    });

                } else if (propertyType === 'size' && processedValue && typeof processedValue === 'object') {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: {
                            value: { width: Number(processedValue.width) || 0, height: Number(processedValue.height) || 0 },
                            type: 'cc.Size'
                        }
                    });

                } else if (propertyType === 'node' && processedValue && typeof processedValue === 'object' && 'uuid' in processedValue) {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: processedValue, type: 'cc.Node' }
                    });

                } else if (propertyType === 'component' && typeof processedValue === 'string') {
                    // Component reference: resolve node UUID to component's scene __id__
                    const targetNodeUuid = processedValue;
                    console.log(`[ManageComponent] Setting component reference - finding component on node: ${targetNodeUuid}`);

                    // Determine expected component type from property metadata
                    let expectedComponentType = '';
                    const currentComponentInfo = await this.getComponentInfo(nodeUuid, componentType);
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
                            // Get the component's scene UUID from value.uuid.value
                            if (comp.value && comp.value.uuid && comp.value.uuid.value) {
                                componentId = comp.value.uuid.value;
                            } else {
                                throw new Error(`Unable to extract component ID from component structure`);
                            }
                            break;
                        }
                    }

                    if (!foundComponent) {
                        const availableComponents = targetNodeData.__comps__.map((comp: any) => {
                            const sceneId = comp.value && comp.value.uuid && comp.value.uuid.value ? comp.value.uuid.value : 'unknown';
                            return `${comp.type}(scene_id:${sceneId})`;
                        });
                        throw new Error(`Component type '${expectedComponentType}' not found on node ${targetNodeUuid}. Available components: ${availableComponents.join(', ')}`);
                    }

                    if (componentId) {
                        actualExpectedValue = { uuid: componentId };
                    }

                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: { uuid: componentId }, type: expectedComponentType }
                    });

                } else if (propertyType === 'nodeArray' && Array.isArray(processedValue)) {
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: processedValue }
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
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: colorArrayValue, type: 'cc.Color' }
                    });

                } else {
                    // Default: simple value set
                    await Editor.Message.request('scene', 'set-property', {
                        uuid: nodeUuid,
                        path: propertyPath,
                        dump: { value: processedValue }
                    });
                }

                // Wait for editor to complete the update, then verify
                await new Promise(r => setTimeout(r, 200));
                const verification = await this.verifyPropertyChange(nodeUuid, componentType, property, originalValue, actualExpectedValue);

                resolve(successResult({
                    nodeUuid,
                    componentType,
                    property,
                    actualValue: verification.actualValue,
                    changeVerified: verification.verified
                }, `Successfully set ${componentType}.${property}`));

            } catch (error: any) {
                console.error(`[ManageComponent] Error setting property:`, error);
                resolve(errorResult(`Failed to set property: ${error.message}`));
            }
        });
    }

    private async attachScript(nodeUuid: string, scriptPath: string): Promise<ActionToolResult> {
        if (!nodeUuid || !scriptPath) {
            return errorResult('nodeUuid and scriptPath are required for action=attach_script');
        }
        return new Promise(async (resolve) => {
            // Extract component class name from script path
            const scriptName = scriptPath.split('/').pop()?.replace('.ts', '').replace('.js', '');
            if (!scriptName) {
                resolve(errorResult('Invalid script path'));
                return;
            }
            // Check if the script component already exists
            const allComponentsInfo = await this.getComponents(nodeUuid);
            if (allComponentsInfo.success && allComponentsInfo.data?.components) {
                const existingScript = allComponentsInfo.data.components.find((comp: any) => comp.type === scriptName);
                if (existingScript) {
                    resolve(successResult(
                        { nodeUuid, componentName: scriptName, existing: true },
                        `Script '${scriptName}' already exists on node`
                    ));
                    return;
                }
            }
            // Try using the script name as a component type directly
            Editor.Message.request('scene', 'create-component', {
                uuid: nodeUuid,
                component: scriptName
            }).then(async (_result: any) => {
                await new Promise(r => setTimeout(r, 100));
                const allComponentsInfo2 = await this.getComponents(nodeUuid);
                if (allComponentsInfo2.success && allComponentsInfo2.data?.components) {
                    const addedScript = allComponentsInfo2.data.components.find((comp: any) => comp.type === scriptName);
                    if (addedScript) {
                        resolve(successResult(
                            { nodeUuid, componentName: scriptName, existing: false },
                            `Script '${scriptName}' attached successfully`
                        ));
                    } else {
                        resolve(errorResult(`Script '${scriptName}' was not found on node after addition. Available components: ${allComponentsInfo2.data.components.map((c: any) => c.type).join(', ')}`));
                    }
                } else {
                    resolve(errorResult(`Failed to verify script addition: ${allComponentsInfo2.error || 'Unable to get node components'}`));
                }
            }).catch((err: Error) => {
                // Fallback: use scene script
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'attachScript',
                    args: [nodeUuid, scriptPath]
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve({
                            success: false,
                            error: `Failed to attach script '${scriptName}': ${err.message}`,
                            instruction: 'Please ensure the script is properly compiled and exported as a Component class. You can also manually attach the script through the Properties panel in the editor.'
                        });
                    }
                }).catch(() => {
                    resolve({
                        success: false,
                        error: `Failed to attach script '${scriptName}': ${err.message}`,
                        instruction: 'Please ensure the script is properly compiled and exported as a Component class. You can also manually attach the script through the Properties panel in the editor.'
                    });
                });
            });
        });
    }

    private async getAvailableComponents(category: string = 'all'): Promise<ActionToolResult> {
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

    // --- Private helpers ---

    private isValidPropertyDescriptor(propData: any): boolean {
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

    private analyzeProperty(component: any, propertyName: string): { exists: boolean; type: string; availableProperties: string[]; originalValue: any } {
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
                if (this.isValidPropertyDescriptor(propData)) {
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

    private parseColorString(colorStr: string): { r: number; g: number; b: number; a: number } {
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

    private async verifyPropertyChange(
        nodeUuid: string,
        componentType: string,
        property: string,
        originalValue: any,
        expectedValue: any
    ): Promise<{ verified: boolean; actualValue: any; fullData: any }> {
        try {
            const componentInfo = await this.getComponentInfo(nodeUuid, componentType);
            if (componentInfo.success && componentInfo.data) {
                const propertyData = componentInfo.data.properties?.[property];
                let actualValue = propertyData;
                if (propertyData && typeof propertyData === 'object' && 'value' in propertyData) {
                    actualValue = propertyData.value;
                }

                let verified = false;
                if (typeof expectedValue === 'object' && expectedValue !== null && 'uuid' in expectedValue) {
                    // Reference comparison: check UUIDs
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
                    // Type mismatch: try string and number coercion
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

    private async checkAndRedirectNodeProperties(args: any): Promise<ActionToolResult | null> {
        const { nodeUuid, componentType, property, value } = args;

        const nodeBasicProperties = ['name', 'active', 'layer', 'mobility', 'parent', 'children', 'hideFlags'];
        const nodeTransformProperties = ['position', 'rotation', 'scale', 'eulerAngles', 'angle'];

        // User mistakenly targets cc.Node as a component type
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

        // Also catch common mistakes regardless of componentType
        if (nodeBasicProperties.includes(property) || nodeTransformProperties.includes(property)) {
            const methodAction = nodeTransformProperties.includes(property) ? 'set_transform' : 'set_property';
            return {
                success: false,
                error: `Property '${property}' is a node property, not a component property`,
                instruction: `Property '${property}' should be set using manage_node action=${methodAction}, not manage_component action=set_property.`
            };
        }

        return null;
    }

    private generateComponentSuggestion(requestedType: string, availableTypes: string[], property: string): string {
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
}
