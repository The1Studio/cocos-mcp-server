import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';
import { analyzeProperty, generateComponentSuggestion, convertPropertyValue, getAvailableComponentsList, redirectNodePropertyAccess, verifyComponentPropertyChange } from './manage-component-property-helpers';
import { applyPropertyToEditor } from './manage-component-editor-apply';
import { attachScriptToNode } from './manage-component-script-attach';

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
        attach_script: (args) => attachScriptToNode(args.nodeUuid, args.scriptPath, (uuid) => this.getComponents(uuid)),
        get_available: (args) => Promise.resolve(getAvailableComponentsList(args.category))
    };

    private async addComponent(nodeUuid: string, componentType: string): Promise<ActionToolResult> {
        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=add');
        }
        // Check if component already exists on node
        const allComponentsInfo = await this.getComponents(nodeUuid);
        if (allComponentsInfo.success && allComponentsInfo.data?.components) {
            const existingComponent = allComponentsInfo.data.components.find((comp: any) => comp.type === componentType);
            if (existingComponent) {
                return successResult(
                    { nodeUuid, componentType, componentVerified: true, existing: true },
                    `Component '${componentType}' already exists on node`
                );
            }
        }
        // Try adding component via Editor API directly
        try {
            await Editor.Message.request('scene', 'create-component', {
                uuid: nodeUuid,
                component: componentType
            });
            // Wait for editor to finish adding the component
            await new Promise(r => setTimeout(r, 100));
            // Re-query to verify the component was actually added
            const allComponentsInfo2 = await this.getComponents(nodeUuid);
            if (allComponentsInfo2.success && allComponentsInfo2.data?.components) {
                const addedComponent = allComponentsInfo2.data.components.find((comp: any) => comp.type === componentType);
                if (addedComponent) {
                    return successResult(
                        { nodeUuid, componentType, componentVerified: true, existing: false },
                        `Component '${componentType}' added successfully`
                    );
                } else {
                    return errorResult(`Component '${componentType}' was not found on node after addition. Available components: ${allComponentsInfo2.data.components.map((c: any) => c.type).join(', ')}`);
                }
            } else {
                return errorResult(`Failed to verify component addition: ${allComponentsInfo2.error || 'Unable to get node components'}`);
            }
        } catch (err: any) {
            // Fallback: use scene script
            try {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'addComponentToNode',
                    args: [nodeUuid, componentType]
                };
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', options);
                if (result && result.success) {
                    return successResult(result.data, result.message);
                } else {
                    return errorResult(result?.error || `Direct API failed: ${err.message}`);
                }
            } catch (err2: any) {
                return errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }

    private async removeComponent(nodeUuid: string, componentType: string): Promise<ActionToolResult> {
        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=remove');
        }
        // Get all components to verify the cid exists
        const allComponentsInfo = await this.getComponents(nodeUuid);
        if (!allComponentsInfo.success || !allComponentsInfo.data?.components) {
            return errorResult(`Failed to get components for node '${nodeUuid}': ${allComponentsInfo.error}`);
        }
        // Match by type field (cid) only
        const exists = allComponentsInfo.data.components.some((comp: any) => comp.type === componentType);
        if (!exists) {
            return errorResult(`Component cid '${componentType}' not found on node '${nodeUuid}'. Use action=get_all to get the type field (cid) for componentType.`);
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
                return errorResult(`Component cid '${componentType}' was not removed from node '${nodeUuid}'.`);
            } else {
                return successResult(
                    { nodeUuid, componentType },
                    `Component cid '${componentType}' removed successfully from node '${nodeUuid}'`
                );
            }
        } catch (err: any) {
            return errorResult(`Failed to remove component: ${err.message}`);
        }
    }

    private async getComponents(nodeUuid: string): Promise<ActionToolResult> {
        if (!nodeUuid) return errorResult('nodeUuid is required for action=get_all');
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (nodeData && nodeData.__comps__) {
                const components = nodeData.__comps__.map((comp: any) => ({
                    type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                    uuid: comp.uuid?.value || comp.uuid || null,
                    enabled: comp.enabled !== undefined ? comp.enabled : true,
                    properties: this.extractComponentProperties(comp)
                }));
                return successResult({ nodeUuid, components });
            }
            return errorResult('Node not found or no components data');
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'getNodeInfo', args: [nodeUuid]
                });
                if (result.success) return successResult(result.data.components);
                return errorResult(result?.error || err.message);
            } catch (err2: any) {
                return errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }

    private async getComponentInfo(nodeUuid: string, componentType: string): Promise<ActionToolResult> {
        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=get_info');
        }
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (nodeData && nodeData.__comps__) {
                const component = nodeData.__comps__.find((comp: any) => {
                    const compType = comp.__type__ || comp.cid || comp.type;
                    return compType === componentType;
                });
                if (component) {
                    return successResult({
                        nodeUuid, componentType,
                        enabled: component.enabled !== undefined ? component.enabled : true,
                        properties: this.extractComponentProperties(component)
                    });
                }
                return errorResult(`Component '${componentType}' not found on node`);
            }
            return errorResult('Node not found or no components data');
        } catch (err: any) {
            try {
                const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'getNodeInfo', args: [nodeUuid]
                });
                if (result.success && result.data.components) {
                    const component = result.data.components.find((comp: any) => comp.type === componentType);
                    if (component) return successResult({ nodeUuid, componentType, ...component });
                    return errorResult(`Component '${componentType}' not found on node`);
                }
                return errorResult(result?.error || 'Failed to get component info');
            } catch (err2: any) {
                return errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
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

        try {
            console.log(`[ManageComponent] Setting ${componentType}.${property} (type: ${propertyType}) = ${JSON.stringify(value)} on node ${nodeUuid}`);

            // Step 0: Detect if user is trying to set a node property; redirect with guidance
            const nodeRedirectResult = redirectNodePropertyAccess(args);
            if (nodeRedirectResult) {
                return nodeRedirectResult;
            }

            // Step 1: Get all components on the node
            const componentsResponse = await this.getComponents(nodeUuid);
            if (!componentsResponse.success || !componentsResponse.data) {
                return errorResult(`Failed to get components for node '${nodeUuid}': ${componentsResponse.error}`);
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
                const instruction = generateComponentSuggestion(componentType, availableTypes, property);
                return {
                    success: false,
                    error: `Component '${componentType}' not found on node. Available components: ${availableTypes.join(', ')}`,
                    instruction
                };
            }

            // Step 3: Analyze the property to get original value and type info
            let propertyInfo;
            try {
                propertyInfo = analyzeProperty(targetComponent, property);
            } catch (analyzeError: any) {
                return errorResult(`Failed to analyze property '${property}': ${analyzeError.message}`);
            }

            if (!propertyInfo.exists) {
                return errorResult(`Property '${property}' not found on component '${componentType}'. Available properties: ${propertyInfo.availableProperties.join(', ')}`);
            }

            // Step 4: Convert value based on explicit propertyType
            const originalValue = propertyInfo.originalValue;
            const processedValue: any = convertPropertyValue(propertyType, value);

            // Step 5: Get raw node data to build the correct __comps__ path
            const rawNodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!rawNodeData || !rawNodeData.__comps__) {
                return errorResult('Failed to get raw node data for property setting');
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
                return errorResult('Could not find component index for setting property');
            }

            const propertyPath = `__comps__.${rawComponentIndex}.${property}`;

            // Step 6: Apply the property via type-aware Editor API calls
            const actualExpectedValue = await applyPropertyToEditor(
                { nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue },
                (uuid, type) => this.getComponentInfo(uuid, type)
            );

            // Wait for editor to complete the update, then verify
            await new Promise(r => setTimeout(r, 200));
            const verification = await verifyComponentPropertyChange(nodeUuid, componentType, property, originalValue, actualExpectedValue, (uuid, type) => this.getComponentInfo(uuid, type));

            return successResult({
                nodeUuid,
                componentType,
                property,
                actualValue: verification.actualValue,
                changeVerified: verification.verified
            }, `Successfully set ${componentType}.${property}`);

        } catch (error: any) {
            console.error(`[ManageComponent] Error setting property:`, error);
            return errorResult(`Failed to set property: ${error.message}`);
        }
    }

}
