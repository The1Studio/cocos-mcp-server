"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageComponent = void 0;
const types_1 = require("../types");
const base_action_tool_1 = require("./base-action-tool");
const manage_component_property_helpers_1 = require("./manage-component-property-helpers");
const manage_component_editor_apply_1 = require("./manage-component-editor-apply");
const manage_component_script_attach_1 = require("./manage-component-script-attach");
class ManageComponent extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_component';
        this.description = 'Manage components on scene nodes. Actions: add=add component to node, remove=remove component (use cid from get_all), get_all=list all components on node, get_info=get specific component details and properties, set_property=set a component property value, attach_script=attach a TypeScript/JavaScript script component, get_available=list available component types by category. NOTE: For node basic properties (name, active, layer) use manage_node action=set_property. For transforms (position, rotation, scale) use manage_node action=set_transform.';
        this.actions = ['add', 'remove', 'get_all', 'get_info', 'set_property', 'attach_script', 'get_available'];
        this.inputSchema = {
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
        this.actionHandlers = {
            add: (args) => this.addComponent(args.nodeUuid, args.componentType),
            remove: (args) => this.removeComponent(args.nodeUuid, args.componentType),
            get_all: (args) => this.getComponents(args.nodeUuid),
            get_info: (args) => this.getComponentInfo(args.nodeUuid, args.componentType),
            set_property: (args) => this.setComponentProperty(args),
            attach_script: (args) => (0, manage_component_script_attach_1.attachScriptToNode)(args.nodeUuid, args.scriptPath, (uuid) => this.getComponents(uuid)),
            get_available: (args) => Promise.resolve((0, manage_component_property_helpers_1.getAvailableComponentsList)(args.category))
        };
    }
    async addComponent(nodeUuid, componentType) {
        var _a, _b;
        if (!nodeUuid || !componentType) {
            return (0, types_1.errorResult)('nodeUuid and componentType are required for action=add');
        }
        // Check if component already exists on node
        const allComponentsInfo = await this.getComponents(nodeUuid);
        if (allComponentsInfo.success && ((_a = allComponentsInfo.data) === null || _a === void 0 ? void 0 : _a.components)) {
            const existingComponent = allComponentsInfo.data.components.find((comp) => comp.type === componentType);
            if (existingComponent) {
                return (0, types_1.successResult)({ nodeUuid, componentType, componentVerified: true, existing: true }, `Component '${componentType}' already exists on node`);
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
            if (allComponentsInfo2.success && ((_b = allComponentsInfo2.data) === null || _b === void 0 ? void 0 : _b.components)) {
                const addedComponent = allComponentsInfo2.data.components.find((comp) => comp.type === componentType);
                if (addedComponent) {
                    return (0, types_1.successResult)({ nodeUuid, componentType, componentVerified: true, existing: false }, `Component '${componentType}' added successfully`);
                }
                else {
                    return (0, types_1.errorResult)(`Component '${componentType}' was not found on node after addition. Available components: ${allComponentsInfo2.data.components.map((c) => c.type).join(', ')}`);
                }
            }
            else {
                return (0, types_1.errorResult)(`Failed to verify component addition: ${allComponentsInfo2.error || 'Unable to get node components'}`);
            }
        }
        catch (err) {
            // Fallback: use scene script
            try {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'addComponentToNode',
                    args: [nodeUuid, componentType]
                };
                const result = await Editor.Message.request('scene', 'execute-scene-script', options);
                if (result && result.success) {
                    return (0, types_1.successResult)(result.data, result.message);
                }
                else {
                    return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || `Direct API failed: ${err.message}`);
                }
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    async removeComponent(nodeUuid, componentType) {
        var _a, _b, _c;
        if (!nodeUuid || !componentType) {
            return (0, types_1.errorResult)('nodeUuid and componentType are required for action=remove');
        }
        // Get all components to verify the cid exists
        const allComponentsInfo = await this.getComponents(nodeUuid);
        if (!allComponentsInfo.success || !((_a = allComponentsInfo.data) === null || _a === void 0 ? void 0 : _a.components)) {
            return (0, types_1.errorResult)(`Failed to get components for node '${nodeUuid}': ${allComponentsInfo.error}`);
        }
        // Match by type field (cid) only
        const exists = allComponentsInfo.data.components.some((comp) => comp.type === componentType);
        if (!exists) {
            return (0, types_1.errorResult)(`Component cid '${componentType}' not found on node '${nodeUuid}'. Use action=get_all to get the type field (cid) for componentType.`);
        }
        try {
            await Editor.Message.request('scene', 'remove-component', {
                uuid: nodeUuid,
                component: componentType
            });
            // Re-query to confirm removal
            const afterRemoveInfo = await this.getComponents(nodeUuid);
            const stillExists = afterRemoveInfo.success && ((_c = (_b = afterRemoveInfo.data) === null || _b === void 0 ? void 0 : _b.components) === null || _c === void 0 ? void 0 : _c.some((comp) => comp.type === componentType));
            if (stillExists) {
                return (0, types_1.errorResult)(`Component cid '${componentType}' was not removed from node '${nodeUuid}'.`);
            }
            else {
                return (0, types_1.successResult)({ nodeUuid, componentType }, `Component cid '${componentType}' removed successfully from node '${nodeUuid}'`);
            }
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to remove component: ${err.message}`);
        }
    }
    async getComponents(nodeUuid) {
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for action=get_all');
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (nodeData && nodeData.__comps__) {
                const components = nodeData.__comps__.map((comp) => {
                    var _a;
                    return ({
                        type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                        uuid: ((_a = comp.uuid) === null || _a === void 0 ? void 0 : _a.value) || comp.uuid || null,
                        enabled: comp.enabled !== undefined ? comp.enabled : true,
                        properties: this.extractComponentProperties(comp)
                    });
                });
                return (0, types_1.successResult)({ nodeUuid, components });
            }
            return (0, types_1.errorResult)('Node not found or no components data');
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'getNodeInfo', args: [nodeUuid]
                });
                if (result.success)
                    return (0, types_1.successResult)(result.data.components);
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || err.message);
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    async getComponentInfo(nodeUuid, componentType) {
        if (!nodeUuid || !componentType) {
            return (0, types_1.errorResult)('nodeUuid and componentType are required for action=get_info');
        }
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (nodeData && nodeData.__comps__) {
                const component = nodeData.__comps__.find((comp) => {
                    const compType = comp.__type__ || comp.cid || comp.type;
                    return compType === componentType;
                });
                if (component) {
                    return (0, types_1.successResult)({
                        nodeUuid, componentType,
                        enabled: component.enabled !== undefined ? component.enabled : true,
                        properties: this.extractComponentProperties(component)
                    });
                }
                return (0, types_1.errorResult)(`Component '${componentType}' not found on node`);
            }
            return (0, types_1.errorResult)('Node not found or no components data');
        }
        catch (err) {
            try {
                const result = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'getNodeInfo', args: [nodeUuid]
                });
                if (result.success && result.data.components) {
                    const component = result.data.components.find((comp) => comp.type === componentType);
                    if (component)
                        return (0, types_1.successResult)(Object.assign({ nodeUuid, componentType }, component));
                    return (0, types_1.errorResult)(`Component '${componentType}' not found on node`);
                }
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to get component info');
            }
            catch (err2) {
                return (0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`);
            }
        }
    }
    extractComponentProperties(component) {
        // If the component has a value property, it contains all actual component properties
        if (component.value && typeof component.value === 'object') {
            return component.value;
        }
        // Fallback: extract properties directly from the component object
        const properties = {};
        const excludeKeys = ['__type__', 'enabled', 'node', '_id', '__scriptAsset', 'uuid', 'name', '_name', '_objFlags', '_enabled', 'type', 'readonly', 'visible', 'cid', 'editor', 'extends'];
        for (const key in component) {
            if (!excludeKeys.includes(key) && !key.startsWith('_')) {
                properties[key] = component[key];
            }
        }
        return properties;
    }
    async setComponentProperty(args) {
        const { nodeUuid, componentType, property, propertyType, value } = args;
        if (!nodeUuid || !componentType || !property || propertyType === undefined || value === undefined) {
            return (0, types_1.errorResult)('nodeUuid, componentType, property, propertyType, and value are required for action=set_property');
        }
        try {
            console.log(`[ManageComponent] Setting ${componentType}.${property} (type: ${propertyType}) = ${JSON.stringify(value)} on node ${nodeUuid}`);
            // Step 0: Detect if user is trying to set a node property; redirect with guidance
            const nodeRedirectResult = (0, manage_component_property_helpers_1.redirectNodePropertyAccess)(args);
            if (nodeRedirectResult) {
                return nodeRedirectResult;
            }
            // Step 1: Get all components on the node
            const componentsResponse = await this.getComponents(nodeUuid);
            if (!componentsResponse.success || !componentsResponse.data) {
                return (0, types_1.errorResult)(`Failed to get components for node '${nodeUuid}': ${componentsResponse.error}`);
            }
            const allComponents = componentsResponse.data.components;
            // Step 2: Find the target component
            let targetComponent = null;
            const availableTypes = [];
            for (let i = 0; i < allComponents.length; i++) {
                const comp = allComponents[i];
                availableTypes.push(comp.type);
                if (comp.type === componentType) {
                    targetComponent = comp;
                    break;
                }
            }
            if (!targetComponent) {
                const instruction = (0, manage_component_property_helpers_1.generateComponentSuggestion)(componentType, availableTypes, property);
                return {
                    success: false,
                    error: `Component '${componentType}' not found on node. Available components: ${availableTypes.join(', ')}`,
                    instruction
                };
            }
            // Step 3: Analyze the property to get original value and type info
            let propertyInfo;
            try {
                propertyInfo = (0, manage_component_property_helpers_1.analyzeProperty)(targetComponent, property);
            }
            catch (analyzeError) {
                return (0, types_1.errorResult)(`Failed to analyze property '${property}': ${analyzeError.message}`);
            }
            if (!propertyInfo.exists) {
                return (0, types_1.errorResult)(`Property '${property}' not found on component '${componentType}'. Available properties: ${propertyInfo.availableProperties.join(', ')}`);
            }
            // Step 4: Convert value based on explicit propertyType
            const originalValue = propertyInfo.originalValue;
            const processedValue = (0, manage_component_property_helpers_1.convertPropertyValue)(propertyType, value);
            // Step 5: Get raw node data to build the correct __comps__ path
            const rawNodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!rawNodeData || !rawNodeData.__comps__) {
                return (0, types_1.errorResult)('Failed to get raw node data for property setting');
            }
            // Find the component index in the raw __comps__ array
            let rawComponentIndex = -1;
            for (let i = 0; i < rawNodeData.__comps__.length; i++) {
                const comp = rawNodeData.__comps__[i];
                const compType = comp.__type__ || comp.cid || comp.type || 'Unknown';
                if (compType === componentType) {
                    rawComponentIndex = i;
                    break;
                }
            }
            if (rawComponentIndex === -1) {
                return (0, types_1.errorResult)('Could not find component index for setting property');
            }
            const propertyPath = `__comps__.${rawComponentIndex}.${property}`;
            // Step 6: Apply the property via type-aware Editor API calls
            const actualExpectedValue = await (0, manage_component_editor_apply_1.applyPropertyToEditor)({ nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue }, (uuid, type) => this.getComponentInfo(uuid, type));
            // Wait for editor to complete the update, then verify
            await new Promise(r => setTimeout(r, 200));
            const verification = await (0, manage_component_property_helpers_1.verifyComponentPropertyChange)(nodeUuid, componentType, property, originalValue, actualExpectedValue, (uuid, type) => this.getComponentInfo(uuid, type));
            return (0, types_1.successResult)({
                nodeUuid,
                componentType,
                property,
                actualValue: verification.actualValue,
                changeVerified: verification.verified
            }, `Successfully set ${componentType}.${property}`);
        }
        catch (error) {
            console.error(`[ManageComponent] Error setting property:`, error);
            return (0, types_1.errorResult)(`Failed to set property: ${error.message}`);
        }
    }
}
exports.ManageComponent = ManageComponent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQWdOO0FBQ2hOLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLHNpQkFBc2lCLENBQUM7UUFDcmpCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRXJHLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDaEcsV0FBVyxFQUFFLHNRQUFzUTtpQkFDdFI7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsZ01BQWdNO2lCQUNoTjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLCtKQUErSjtpQkFDL0s7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRTt3QkFDRixRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVB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RUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUVuTCxPQUFPLElBQUEscUJBQWEsRUFBQztnQkFDakIsUUFBUTtnQkFDUixhQUFhO2dCQUNiLFFBQVE7Z0JBQ1IsV0FBVyxFQUFFLFlBQVksQ0FBQyxXQUFXO2dCQUNyQyxjQUFjLEVBQUUsWUFBWSxDQUFDLFFBQVE7YUFDeEMsRUFBRSxvQkFBb0IsYUFBYSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFFeEQsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQywyQ0FBMkMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNsRSxPQUFPLElBQUEsbUJBQVcsRUFBQywyQkFBMkIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDbkUsQ0FBQztJQUNMLENBQUM7Q0FFSjtBQXhWRCwwQ0F3VkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IGFuYWx5emVQcm9wZXJ0eSwgZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uLCBjb252ZXJ0UHJvcGVydHlWYWx1ZSwgZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QsIHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzLCB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcbmltcG9ydCB7IGFwcGx5UHJvcGVydHlUb0VkaXRvciB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHknO1xuaW1wb3J0IHsgYXR0YWNoU2NyaXB0VG9Ob2RlIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXNjcmlwdC1hdHRhY2gnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlQ29tcG9uZW50IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2NvbXBvbmVudCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGNvbXBvbmVudHMgb24gc2NlbmUgbm9kZXMuIEFjdGlvbnM6IGFkZD1hZGQgY29tcG9uZW50IHRvIG5vZGUsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50ICh1c2UgY2lkIGZyb20gZ2V0X2FsbCksIGdldF9hbGw9bGlzdCBhbGwgY29tcG9uZW50cyBvbiBub2RlLCBnZXRfaW5mbz1nZXQgc3BlY2lmaWMgY29tcG9uZW50IGRldGFpbHMgYW5kIHByb3BlcnRpZXMsIHNldF9wcm9wZXJ0eT1zZXQgYSBjb21wb25lbnQgcHJvcGVydHkgdmFsdWUsIGF0dGFjaF9zY3JpcHQ9YXR0YWNoIGEgVHlwZVNjcmlwdC9KYXZhU2NyaXB0IHNjcmlwdCBjb21wb25lbnQsIGdldF9hdmFpbGFibGU9bGlzdCBhdmFpbGFibGUgY29tcG9uZW50IHR5cGVzIGJ5IGNhdGVnb3J5LiBOT1RFOiBGb3Igbm9kZSBiYXNpYyBwcm9wZXJ0aWVzIChuYW1lLCBhY3RpdmUsIGxheWVyKSB1c2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF9wcm9wZXJ0eS4gRm9yIHRyYW5zZm9ybXMgKHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3RyYW5zZm9ybS4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2FkZCcsICdyZW1vdmUnLCAnZ2V0X2FsbCcsICdnZXRfaW5mbycsICdzZXRfcHJvcGVydHknLCAnYXR0YWNoX3NjcmlwdCcsICdnZXRfYXZhaWxhYmxlJ107XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWRkJywgJ3JlbW92ZScsICdnZXRfYWxsJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdhdHRhY2hfc2NyaXB0JywgJ2dldF9hdmFpbGFibGUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBhZGQ9YWRkIGNvbXBvbmVudCB0byBub2RlLCByZW1vdmU9cmVtb3ZlIGNvbXBvbmVudCAodXNlIGNpZCBmcm9tIGdldF9hbGwpLCBnZXRfYWxsPWxpc3QgYWxsIGNvbXBvbmVudHMsIGdldF9pbmZvPWdldCBjb21wb25lbnQgZGV0YWlscywgc2V0X3Byb3BlcnR5PXNldCBhIHByb3BlcnR5IHZhbHVlLCBhdHRhY2hfc2NyaXB0PWF0dGFjaCBhIHNjcmlwdCBmaWxlLCBnZXRfYXZhaWxhYmxlPWxpc3QgYXZhaWxhYmxlIHR5cGVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCByZW1vdmUsIGdldF9hbGwsIGdldF9pbmZvLCBzZXRfcHJvcGVydHksIGF0dGFjaF9zY3JpcHRdIFRhcmdldCBub2RlIFVVSUQuIFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249Z2V0X2FsbCB0byBmaW5kIG5vZGUgVVVJRHMuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRdIENvbXBvbmVudCB0eXBlIHRvIGFkZCAoZS5nLiwgY2MuU3ByaXRlLCBjYy5MYWJlbCwgY2MuQnV0dG9uKS4gW3JlbW92ZV0gQ29tcG9uZW50IGNpZCAodGhlIHR5cGUgZmllbGQgZnJvbSBnZXRfYWxsIOKAlCBOT1Qgc2NyaXB0IG5hbWUpLiBbZ2V0X2luZm8sIHNldF9wcm9wZXJ0eV0gQ29tcG9uZW50IHR5cGUgdG8gdGFyZ2V0LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZSB0byBzZXQuIEV4YW1wbGVzOiBjYy5MYWJlbCDihpIgc3RyaW5nLCBmb250U2l6ZSwgY29sb3I7IGNjLlNwcml0ZSDihpIgc3ByaXRlRnJhbWUsIGNvbG9yOyBjYy5VSVRyYW5zZm9ybSDihpIgY29udGVudFNpemUsIGFuY2hvclBvaW50LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbXG4gICAgICAgICAgICAgICAgICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2Jvb2xlYW4nLCAnaW50ZWdlcicsICdmbG9hdCcsXG4gICAgICAgICAgICAgICAgICAgICdjb2xvcicsICd2ZWMyJywgJ3ZlYzMnLCAnc2l6ZScsXG4gICAgICAgICAgICAgICAgICAgICdub2RlJywgJ2NvbXBvbmVudCcsICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICAgICAgICAgICAgICAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IHZhbHVlLiBGb3JtYXQgZGVwZW5kcyBvbiBwcm9wZXJ0eVR5cGU6IHN0cmluZz1cInRleHRcIiwgbnVtYmVyPTQyLCBib29sZWFuPXRydWUsIGNvbG9yPXtcInJcIjoyNTUsXCJnXCI6MCxcImJcIjowLFwiYVwiOjI1NX0gb3IgXCIjRkYwMDAwXCIsIHZlYzI9e1wieFwiOjEwMCxcInlcIjo1MH0sIHZlYzM9e1wieFwiOjEsXCJ5XCI6MixcInpcIjozfSwgc2l6ZT17XCJ3aWR0aFwiOjEwMCxcImhlaWdodFwiOjUwfSwgbm9kZS9jb21wb25lbnQvc3ByaXRlRnJhbWUvcHJlZmFiL2Fzc2V0PVwidXVpZC1zdHJpbmdcIiwgbm9kZUFycmF5PVtcInV1aWQxXCIsXCJ1dWlkMlwiXSwgY29sb3JBcnJheT1be1wiclwiOjI1NSwuLi59XSwgbnVtYmVyQXJyYXk9WzEsMiwzXSwgc3RyaW5nQXJyYXk9W1wiYVwiLFwiYlwiXSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYXR0YWNoX3NjcmlwdF0gU2NyaXB0IGFzc2V0IHBhdGggKGUuZy4sIGRiOi8vYXNzZXRzL3NjcmlwdHMvTXlTY3JpcHQudHMpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhdGVnb3J5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAncmVuZGVyZXInLCAndWknLCAncGh5c2ljcycsICdhbmltYXRpb24nLCAnYXVkaW8nXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfYXZhaWxhYmxlXSBDb21wb25lbnQgY2F0ZWdvcnkgZmlsdGVyLiBEZWZhdWx0OiBhbGwnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBhZGQ6IChhcmdzKSA9PiB0aGlzLmFkZENvbXBvbmVudChhcmdzLm5vZGVVdWlkLCBhcmdzLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICByZW1vdmU6IChhcmdzKSA9PiB0aGlzLnJlbW92ZUNvbXBvbmVudChhcmdzLm5vZGVVdWlkLCBhcmdzLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICBnZXRfYWxsOiAoYXJncykgPT4gdGhpcy5nZXRDb21wb25lbnRzKGFyZ3Mubm9kZVV1aWQpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0Q29tcG9uZW50SW5mbyhhcmdzLm5vZGVVdWlkLCBhcmdzLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldENvbXBvbmVudFByb3BlcnR5KGFyZ3MpLFxuICAgICAgICBhdHRhY2hfc2NyaXB0OiAoYXJncykgPT4gYXR0YWNoU2NyaXB0VG9Ob2RlKGFyZ3Mubm9kZVV1aWQsIGFyZ3Muc2NyaXB0UGF0aCwgKHV1aWQpID0+IHRoaXMuZ2V0Q29tcG9uZW50cyh1dWlkKSksXG4gICAgICAgIGdldF9hdmFpbGFibGU6IChhcmdzKSA9PiBQcm9taXNlLnJlc29sdmUoZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QoYXJncy5jYXRlZ29yeSkpXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgYWRkQ29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPWFkZCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENoZWNrIGlmIGNvbXBvbmVudCBhbHJlYWR5IGV4aXN0cyBvbiBub2RlXG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHNJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKGFsbENvbXBvbmVudHNJbmZvLnN1Y2Nlc3MgJiYgYWxsQ29tcG9uZW50c0luZm8uZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDb21wb25lbnQgPSBhbGxDb21wb25lbnRzSW5mby5kYXRhLmNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIGNvbXBvbmVudFZlcmlmaWVkOiB0cnVlLCBleGlzdGluZzogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBhbHJlYWR5IGV4aXN0cyBvbiBub2RlYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gVHJ5IGFkZGluZyBjb21wb25lbnQgdmlhIEVkaXRvciBBUEkgZGlyZWN0bHlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGVkaXRvciB0byBmaW5pc2ggYWRkaW5nIHRoZSBjb21wb25lbnRcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDApKTtcbiAgICAgICAgICAgIC8vIFJlLXF1ZXJ5IHRvIHZlcmlmeSB0aGUgY29tcG9uZW50IHdhcyBhY3R1YWxseSBhZGRlZFxuICAgICAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8yID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChhbGxDb21wb25lbnRzSW5mbzIuc3VjY2VzcyAmJiBhbGxDb21wb25lbnRzSW5mbzIuZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFkZGVkQ29tcG9uZW50ID0gYWxsQ29tcG9uZW50c0luZm8yLmRhdGEuY29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKGFkZGVkQ29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgY29tcG9uZW50VmVyaWZpZWQ6IHRydWUsIGV4aXN0aW5nOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgYWRkZWQgc3VjY2Vzc2Z1bGx5YFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyB3YXMgbm90IGZvdW5kIG9uIG5vZGUgYWZ0ZXIgYWRkaXRpb24uIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2FsbENvbXBvbmVudHNJbmZvMi5kYXRhLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHZlcmlmeSBjb21wb25lbnQgYWRkaXRpb246ICR7YWxsQ29tcG9uZW50c0luZm8yLmVycm9yIHx8ICdVbmFibGUgdG8gZ2V0IG5vZGUgY29tcG9uZW50cyd9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjazogdXNlIHNjZW5lIHNjcmlwdFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ2FkZENvbXBvbmVudFRvTm9kZScsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFtub2RlVXVpZCwgY29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVtb3ZlQ29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXJlbW92ZScpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEdldCBhbGwgY29tcG9uZW50cyB0byB2ZXJpZnkgdGhlIGNpZCBleGlzdHNcbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoIWFsbENvbXBvbmVudHNJbmZvLnN1Y2Nlc3MgfHwgIWFsbENvbXBvbmVudHNJbmZvLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBjb21wb25lbnRzIGZvciBub2RlICcke25vZGVVdWlkfSc6ICR7YWxsQ29tcG9uZW50c0luZm8uZXJyb3J9YCk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gTWF0Y2ggYnkgdHlwZSBmaWVsZCAoY2lkKSBvbmx5XG4gICAgICAgIGNvbnN0IGV4aXN0cyA9IGFsbENvbXBvbmVudHNJbmZvLmRhdGEuY29tcG9uZW50cy5zb21lKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgIGlmICghZXhpc3RzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCBjaWQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlICcke25vZGVVdWlkfScuIFVzZSBhY3Rpb249Z2V0X2FsbCB0byBnZXQgdGhlIHR5cGUgZmllbGQgKGNpZCkgZm9yIGNvbXBvbmVudFR5cGUuYCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIFJlLXF1ZXJ5IHRvIGNvbmZpcm0gcmVtb3ZhbFxuICAgICAgICAgICAgY29uc3QgYWZ0ZXJSZW1vdmVJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHN0aWxsRXhpc3RzID0gYWZ0ZXJSZW1vdmVJbmZvLnN1Y2Nlc3MgJiYgYWZ0ZXJSZW1vdmVJbmZvLmRhdGE/LmNvbXBvbmVudHM/LnNvbWUoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGlmIChzdGlsbEV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50IGNpZCAnJHtjb21wb25lbnRUeXBlfScgd2FzIG5vdCByZW1vdmVkIGZyb20gbm9kZSAnJHtub2RlVXVpZH0nLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSB9LFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50IGNpZCAnJHtjb21wb25lbnRUeXBlfScgcmVtb3ZlZCBzdWNjZXNzZnVsbHkgZnJvbSBub2RlICcke25vZGVVdWlkfSdgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHJlbW92ZSBjb21wb25lbnQ6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvbXBvbmVudHMobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249Z2V0X2FsbCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAobm9kZURhdGEgJiYgbm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHRoaXMuZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcClcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCwgY29tcG9uZW50cyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3Igbm8gY29tcG9uZW50cyBkYXRhJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0Tm9kZUluZm8nLCBhcmdzOiBbbm9kZVV1aWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YS5jb21wb25lbnRzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvbXBvbmVudEluZm8obm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249Z2V0X2luZm8nKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAobm9kZURhdGEgJiYgbm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZURhdGEuX19jb21wc19fLmZpbmQoKGNvbXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wVHlwZSA9IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29tcFR5cGUgPT09IGNvbXBvbmVudFR5cGU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXBvbmVudC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wb25lbnQuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB0aGlzLmV4dHJhY3RDb21wb25lbnRQcm9wZXJ0aWVzKGNvbXBvbmVudClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBubyBjb21wb25lbnRzIGRhdGEnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXROb2RlSW5mbycsIGFyZ3M6IFtub2RlVXVpZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0LmRhdGEuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSByZXN1bHQuZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCkgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgLi4uY29tcG9uZW50IH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGVgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBnZXQgY29tcG9uZW50IGluZm8nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcG9uZW50OiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICAgICAgLy8gSWYgdGhlIGNvbXBvbmVudCBoYXMgYSB2YWx1ZSBwcm9wZXJ0eSwgaXQgY29udGFpbnMgYWxsIGFjdHVhbCBjb21wb25lbnQgcHJvcGVydGllc1xuICAgICAgICBpZiAoY29tcG9uZW50LnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50LnZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIEZhbGxiYWNrOiBleHRyYWN0IHByb3BlcnRpZXMgZGlyZWN0bHkgZnJvbSB0aGUgY29tcG9uZW50IG9iamVjdFxuICAgICAgICBjb25zdCBwcm9wZXJ0aWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgIGNvbnN0IGV4Y2x1ZGVLZXlzID0gWydfX3R5cGVfXycsICdlbmFibGVkJywgJ25vZGUnLCAnX2lkJywgJ19fc2NyaXB0QXNzZXQnLCAndXVpZCcsICduYW1lJywgJ19uYW1lJywgJ19vYmpGbGFncycsICdfZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnLCAnY2lkJywgJ2VkaXRvcicsICdleHRlbmRzJ107XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGNvbXBvbmVudCkge1xuICAgICAgICAgICAgaWYgKCFleGNsdWRlS2V5cy5pbmNsdWRlcyhrZXkpICYmICFrZXkuc3RhcnRzV2l0aCgnXycpKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllc1trZXldID0gY29tcG9uZW50W2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb21wb25lbnRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfSA9IGFyZ3M7XG5cbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSB8fCAhcHJvcGVydHkgfHwgcHJvcGVydHlUeXBlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgYW5kIHZhbHVlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0eScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTWFuYWdlQ29tcG9uZW50XSBTZXR0aW5nICR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX0gKHR5cGU6ICR7cHJvcGVydHlUeXBlfSkgPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX0gb24gbm9kZSAke25vZGVVdWlkfWApO1xuXG4gICAgICAgICAgICAvLyBTdGVwIDA6IERldGVjdCBpZiB1c2VyIGlzIHRyeWluZyB0byBzZXQgYSBub2RlIHByb3BlcnR5OyByZWRpcmVjdCB3aXRoIGd1aWRhbmNlXG4gICAgICAgICAgICBjb25zdCBub2RlUmVkaXJlY3RSZXN1bHQgPSByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzKTtcbiAgICAgICAgICAgIGlmIChub2RlUmVkaXJlY3RSZXN1bHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbm9kZVJlZGlyZWN0UmVzdWx0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTdGVwIDE6IEdldCBhbGwgY29tcG9uZW50cyBvbiB0aGUgbm9kZVxuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50c1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghY29tcG9uZW50c1Jlc3BvbnNlLnN1Y2Nlc3MgfHwgIWNvbXBvbmVudHNSZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudHMgZm9yIG5vZGUgJyR7bm9kZVV1aWR9JzogJHtjb21wb25lbnRzUmVzcG9uc2UuZXJyb3J9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHMgPSBjb21wb25lbnRzUmVzcG9uc2UuZGF0YS5jb21wb25lbnRzO1xuXG4gICAgICAgICAgICAvLyBTdGVwIDI6IEZpbmQgdGhlIHRhcmdldCBjb21wb25lbnRcbiAgICAgICAgICAgIGxldCB0YXJnZXRDb21wb25lbnQgPSBudWxsO1xuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVHlwZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wID0gYWxsQ29tcG9uZW50c1tpXTtcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVUeXBlcy5wdXNoKGNvbXAudHlwZSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb21wb25lbnQgPSBjb21wO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghdGFyZ2V0Q29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24oY29tcG9uZW50VHlwZSwgYXZhaWxhYmxlVHlwZXMsIHByb3BlcnR5KTtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGVUeXBlcy5qb2luKCcsICcpfWAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU3RlcCAzOiBBbmFseXplIHRoZSBwcm9wZXJ0eSB0byBnZXQgb3JpZ2luYWwgdmFsdWUgYW5kIHR5cGUgaW5mb1xuICAgICAgICAgICAgbGV0IHByb3BlcnR5SW5mbztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlJbmZvID0gYW5hbHl6ZVByb3BlcnR5KHRhcmdldENvbXBvbmVudCwgcHJvcGVydHkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoYW5hbHl6ZUVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBhbmFseXplIHByb3BlcnR5ICcke3Byb3BlcnR5fSc6ICR7YW5hbHl6ZUVycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJvcGVydHlJbmZvLmV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBub3QgZm91bmQgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gQXZhaWxhYmxlIHByb3BlcnRpZXM6ICR7cHJvcGVydHlJbmZvLmF2YWlsYWJsZVByb3BlcnRpZXMuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gU3RlcCA0OiBDb252ZXJ0IHZhbHVlIGJhc2VkIG9uIGV4cGxpY2l0IHByb3BlcnR5VHlwZVxuICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxWYWx1ZSA9IHByb3BlcnR5SW5mby5vcmlnaW5hbFZhbHVlO1xuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc2VkVmFsdWU6IGFueSA9IGNvbnZlcnRQcm9wZXJ0eVZhbHVlKHByb3BlcnR5VHlwZSwgdmFsdWUpO1xuXG4gICAgICAgICAgICAvLyBTdGVwIDU6IEdldCByYXcgbm9kZSBkYXRhIHRvIGJ1aWxkIHRoZSBjb3JyZWN0IF9fY29tcHNfXyBwYXRoXG4gICAgICAgICAgICBjb25zdCByYXdOb2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIXJhd05vZGVEYXRhIHx8ICFyYXdOb2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0ZhaWxlZCB0byBnZXQgcmF3IG5vZGUgZGF0YSBmb3IgcHJvcGVydHkgc2V0dGluZycpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBGaW5kIHRoZSBjb21wb25lbnQgaW5kZXggaW4gdGhlIHJhdyBfX2NvbXBzX18gYXJyYXlcbiAgICAgICAgICAgIGxldCByYXdDb21wb25lbnRJbmRleCA9IC0xO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByYXdOb2RlRGF0YS5fX2NvbXBzX18ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wID0gcmF3Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wVHlwZSA9IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJztcbiAgICAgICAgICAgICAgICBpZiAoY29tcFR5cGUgPT09IGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmF3Q29tcG9uZW50SW5kZXggPSBpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyYXdDb21wb25lbnRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0NvdWxkIG5vdCBmaW5kIGNvbXBvbmVudCBpbmRleCBmb3Igc2V0dGluZyBwcm9wZXJ0eScpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVBhdGggPSBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LiR7cHJvcGVydHl9YDtcblxuICAgICAgICAgICAgLy8gU3RlcCA2OiBBcHBseSB0aGUgcHJvcGVydHkgdmlhIHR5cGUtYXdhcmUgRWRpdG9yIEFQSSBjYWxsc1xuICAgICAgICAgICAgY29uc3QgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5UHJvcGVydHlUb0VkaXRvcihcbiAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIHJhd0NvbXBvbmVudEluZGV4LCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSwgcHJvY2Vzc2VkVmFsdWUgfSxcbiAgICAgICAgICAgICAgICAodXVpZCwgdHlwZSkgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKHV1aWQsIHR5cGUpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBlZGl0b3IgdG8gY29tcGxldGUgdGhlIHVwZGF0ZSwgdGhlbiB2ZXJpZnlcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAyMDApKTtcbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbiA9IGF3YWl0IHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlKG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgb3JpZ2luYWxWYWx1ZSwgYWN0dWFsRXhwZWN0ZWRWYWx1ZSwgKHV1aWQsIHR5cGUpID0+IHRoaXMuZ2V0Q29tcG9uZW50SW5mbyh1dWlkLCB0eXBlKSk7XG5cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5LFxuICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlOiB2ZXJpZmljYXRpb24uYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgY2hhbmdlVmVyaWZpZWQ6IHZlcmlmaWNhdGlvbi52ZXJpZmllZFxuICAgICAgICAgICAgfSwgYFN1Y2Nlc3NmdWxseSBzZXQgJHtjb21wb25lbnRUeXBlfS4ke3Byb3BlcnR5fWApO1xuXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYW5hZ2VDb21wb25lbnRdIEVycm9yIHNldHRpbmcgcHJvcGVydHk6YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gc2V0IHByb3BlcnR5OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbn1cbiJdfQ==