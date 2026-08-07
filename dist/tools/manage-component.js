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
        this.description = 'Manage components on scene nodes. Actions: add=add component to node, remove=remove component (use cid from get_all), get_all=list all components on node, get_info=get specific component details and properties, set_property=set a single component property value (supports dotted nested CCClass paths like "cameraSection.mainCamera"), set_properties_batch=set many properties on one component in a single call (each field set independently — one bad field does not abort the rest), attach_script=attach a TypeScript/JavaScript script component, get_available=list available component types by category. NOTE: For node basic properties (name, active, layer) use manage_node action=set_property. For transforms (position, rotation, scale) use manage_node action=set_transform.';
        this.actions = ['add', 'remove', 'get_all', 'get_info', 'set_property', 'set_properties_batch', 'attach_script', 'get_available'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'remove', 'get_all', 'get_info', 'set_property', 'set_properties_batch', 'attach_script', 'get_available'],
                    description: 'Action to perform: add=add component to node, remove=remove component (use cid from get_all), get_all=list all components, get_info=get component details, set_property=set a single property value (dotted nested paths supported), set_properties_batch=set many properties at once, attach_script=attach a script file, get_available=list available types'
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
                    description: '[set_property] Property name to set. Supports dotted nested CCClass paths (e.g., "cameraSection.mainCamera"). Examples: cc.Label → string, fontSize, color; cc.Sprite → spriteFrame, color; cc.UITransform → contentSize, anchorPoint.'
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
                properties: {
                    type: 'array',
                    description: '[set_properties_batch] Array of property entries to set on the SAME component in one call. Each entry: {property, propertyType, value} with the same semantics as set_property. Supports dotted nested CCClass paths per entry (e.g., "cameraSection.mainCamera"). Each entry is applied independently — a failure on one field does not abort the others; the result reports per-field success/error.',
                    items: {
                        type: 'object',
                        properties: {
                            property: {
                                type: 'string',
                                description: 'Property name to set. Supports dotted nested CCClass paths (e.g., "cameraSection.mainCamera").'
                            },
                            propertyType: {
                                type: 'string',
                                enum: [
                                    'string', 'number', 'boolean', 'integer', 'float',
                                    'color', 'vec2', 'vec3', 'size',
                                    'node', 'component', 'spriteFrame', 'prefab', 'asset',
                                    'nodeArray', 'colorArray', 'numberArray', 'stringArray'
                                ],
                                description: 'Property data type for correct value conversion. Must match the actual property type.'
                            },
                            value: {
                                description: 'Property value. Same format rules as set_property value (depends on propertyType).'
                            }
                        },
                        required: ['property', 'propertyType', 'value']
                    }
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
            set_properties_batch: (args) => this.setComponentPropertiesBatch(args),
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
        return (0, manage_component_property_helpers_1.extractComponentPropertyDump)(component);
    }
    async setComponentProperty(args) {
        const { nodeUuid, componentType, property, propertyType, value } = args;
        if (!nodeUuid || !componentType || !property || propertyType === undefined || value === undefined) {
            return (0, types_1.errorResult)('nodeUuid, componentType, property, propertyType, and value are required for action=set_property');
        }
        // Step 0: Detect if user is trying to set a node property; redirect with guidance
        const nodeRedirectResult = (0, manage_component_property_helpers_1.redirectNodePropertyAccess)(args);
        if (nodeRedirectResult) {
            return nodeRedirectResult;
        }
        // Step 1: Resolve the target component (and its raw __comps__ index) once.
        const resolution = await this.resolveTargetComponent(nodeUuid, componentType, property);
        if (!resolution.ok) {
            return resolution.result;
        }
        // Step 2: Apply the single property using the shared per-field logic.
        const fieldResult = await this.applySingleProperty(nodeUuid, componentType, resolution.targetComponent, resolution.rawComponentIndex, { property, propertyType, value });
        if (!fieldResult.success) {
            return (0, types_1.errorResult)(fieldResult.error || `Failed to set property '${property}'`);
        }
        return (0, types_1.successResult)({
            nodeUuid,
            componentType,
            property,
            actualValue: fieldResult.actualValue,
            changeVerified: fieldResult.changeVerified
        }, `Successfully set ${componentType}.${property}`);
    }
    /**
     * Set multiple properties on a SINGLE component in one call.
     * The target component is resolved once; each property entry is then applied
     * independently via the same per-field logic used by set_property — so a failure
     * on one field does not abort the rest. Dotted nested CCClass paths work per entry.
     */
    async setComponentPropertiesBatch(args) {
        const { nodeUuid, componentType, properties } = args;
        if (!nodeUuid || !componentType) {
            return (0, types_1.errorResult)('nodeUuid and componentType are required for action=set_properties_batch');
        }
        if (!Array.isArray(properties) || properties.length === 0) {
            return (0, types_1.errorResult)('properties must be a non-empty array of {property, propertyType, value} entries for action=set_properties_batch');
        }
        // Resolve the target component once for the whole batch.
        const resolution = await this.resolveTargetComponent(nodeUuid, componentType, undefined);
        if (!resolution.ok) {
            return resolution.result;
        }
        const results = [];
        for (const entry of properties) {
            const property = entry === null || entry === void 0 ? void 0 : entry.property;
            const propertyType = entry === null || entry === void 0 ? void 0 : entry.propertyType;
            const value = entry === null || entry === void 0 ? void 0 : entry.value;
            if (!property || propertyType === undefined || value === undefined) {
                results.push({
                    property: property || '(missing)',
                    success: false,
                    error: 'Each entry requires property, propertyType, and value'
                });
                continue;
            }
            try {
                const fieldResult = await this.applySingleProperty(nodeUuid, componentType, resolution.targetComponent, resolution.rawComponentIndex, { property, propertyType, value });
                results.push({
                    property,
                    success: fieldResult.success,
                    actualValue: fieldResult.actualValue,
                    changeVerified: fieldResult.changeVerified,
                    error: fieldResult.error
                });
            }
            catch (err) {
                // Defensive: one bad field must never abort the batch.
                results.push({ property, success: false, error: (err === null || err === void 0 ? void 0 : err.message) || String(err) });
            }
        }
        const succeeded = results.filter(r => r.success).length;
        const failed = results.length - succeeded;
        const message = `set_properties_batch on ${componentType}: ${succeeded}/${results.length} field(s) set${failed > 0 ? `, ${failed} failed` : ''}`;
        return (0, types_1.successResult)({
            nodeUuid,
            componentType,
            total: results.length,
            succeeded,
            failed,
            results
        }, message);
    }
    /**
     * Resolve a component on a node into its dump (targetComponent) and its raw __comps__ index.
     * When `property` is provided, a missing component yields an LLM-friendly suggestion.
     */
    async resolveTargetComponent(nodeUuid, componentType, property) {
        var _a;
        // Get all components (dump form) on the node.
        const componentsResponse = await this.getComponents(nodeUuid);
        if (!componentsResponse.success || !componentsResponse.data) {
            return { ok: false, result: (0, types_1.errorResult)(`Failed to get components for node '${nodeUuid}': ${componentsResponse.error}`) };
        }
        const allComponents = componentsResponse.data.components;
        let targetComponent = null;
        let resolvedIndex = -1;
        const availableTypes = [];
        for (let i = 0; i < allComponents.length; i++) {
            const comp = allComponents[i];
            availableTypes.push(comp.type);
            if (comp.type === componentType) {
                targetComponent = comp;
                resolvedIndex = i;
                break;
            }
        }
        // Fallback: componentType may be a readable class name (e.g. "MyController")
        // while the dump only exposes the script's cid. Resolve via the scene script,
        // which has the live cc.js class registry, then map back to the dump component
        // at the same index (query-node __comps__ order matches node.components order).
        if (!targetComponent) {
            try {
                const byName = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'resolveComponentByName', args: [nodeUuid, componentType]
                });
                const index = (byName === null || byName === void 0 ? void 0 : byName.success) ? (_a = byName.data) === null || _a === void 0 ? void 0 : _a.index : undefined;
                if (typeof index === 'number' && index >= 0 && index < allComponents.length) {
                    resolvedIndex = index;
                    targetComponent = allComponents[index];
                }
            }
            catch (_b) {
                // Scene script unavailable — fall through to the not-found error below.
            }
        }
        if (!targetComponent) {
            const instruction = (0, manage_component_property_helpers_1.generateComponentSuggestion)(componentType, availableTypes, property || '');
            return {
                ok: false,
                result: {
                    success: false,
                    error: `Component '${componentType}' not found on node. Available components: ${availableTypes.join(', ')}`,
                    instruction
                }
            };
        }
        // Get raw node data to build the correct __comps__ path.
        const rawNodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
        if (!rawNodeData || !rawNodeData.__comps__) {
            return { ok: false, result: (0, types_1.errorResult)('Failed to get raw node data for property setting') };
        }
        let rawComponentIndex = -1;
        for (let i = 0; i < rawNodeData.__comps__.length; i++) {
            const comp = rawNodeData.__comps__[i];
            const compType = comp.__type__ || comp.cid || comp.type || 'Unknown';
            if (compType === componentType) {
                rawComponentIndex = i;
                break;
            }
        }
        // Class-name resolution path: the cid won't equal componentType, so reuse the
        // index resolved above (dump order == raw __comps__ order).
        if (rawComponentIndex === -1 && resolvedIndex >= 0 && resolvedIndex < rawNodeData.__comps__.length) {
            rawComponentIndex = resolvedIndex;
        }
        if (rawComponentIndex === -1) {
            return { ok: false, result: (0, types_1.errorResult)('Could not find component index for setting property') };
        }
        return { ok: true, targetComponent, rawComponentIndex };
    }
    /**
     * Apply ONE property value to an already-resolved component.
     * Shared by set_property (single) and set_properties_batch (per entry).
     * Returns a per-field result rather than throwing, so callers can aggregate.
     * Dotted nested CCClass paths (e.g., "cameraSection.mainCamera") are supported
     * because analyzeProperty / applyPropertyToEditor / verifyComponentPropertyChange
     * all walk dotted segments.
     */
    async applySingleProperty(nodeUuid, componentType, targetComponent, rawComponentIndex, field) {
        const { property, propertyType, value } = field;
        try {
            console.log(`[ManageComponent] Setting ${componentType}.${property} (type: ${propertyType}) = ${JSON.stringify(value)} on node ${nodeUuid}`);
            // Analyze the property to get original value and type info (supports dotted paths).
            let propertyInfo;
            try {
                propertyInfo = (0, manage_component_property_helpers_1.analyzeProperty)(targetComponent, property);
            }
            catch (analyzeError) {
                return { success: false, error: `Failed to analyze property '${property}': ${analyzeError.message}` };
            }
            if (!propertyInfo.exists) {
                return { success: false, error: `Property '${property}' not found on component '${componentType}'. Available properties: ${propertyInfo.availableProperties.join(', ')}` };
            }
            // Convert value based on explicit propertyType.
            const originalValue = propertyInfo.originalValue;
            const processedValue = (0, manage_component_property_helpers_1.convertPropertyValue)(propertyType, value);
            // Build the (possibly dotted) component property path and apply via type-aware Editor API.
            const propertyPath = `__comps__.${rawComponentIndex}.${property}`;
            const actualExpectedValue = await (0, manage_component_editor_apply_1.applyPropertyToEditor)({ nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue }, (uuid, type) => this.getComponentInfo(uuid, type));
            // Wait for editor to complete the update, then verify.
            await new Promise(r => setTimeout(r, 200));
            const verification = await (0, manage_component_property_helpers_1.verifyComponentPropertyChange)(nodeUuid, componentType, property, originalValue, actualExpectedValue, (uuid, type) => this.getComponentInfo(uuid, type));
            return { success: true, actualValue: verification.actualValue, changeVerified: verification.verified };
        }
        catch (error) {
            console.error(`[ManageComponent] Error setting property '${property}':`, error);
            return { success: false, error: `Failed to set property '${property}': ${error.message}` };
        }
    }
}
exports.ManageComponent = ManageComponent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQThPO0FBQzlPLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLHV3QkFBdXdCLENBQUM7UUFDdHhCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTdILGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDeEgsV0FBVyxFQUFFLCtWQUErVjtpQkFDL1c7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsZ01BQWdNO2lCQUNoTjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdPQUF3TztpQkFDeFA7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRTt3QkFDRixRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsT0FBTzt3QkFDakQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTTt3QkFDL0IsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLE9BQU87d0JBQ3JELFdBQVcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGFBQWE7cUJBQzFEO29CQUNELFdBQVcsRUFBRSxzR0FBc0c7aUJBQ3RIO2dCQUNELEtBQUssRUFBRTtvQkFDSCxXQUFXLEVBQUUsc1lBQXNZO2lCQUN0WjtnQkFDRCxVQUFVLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLE9BQU87b0JBQ2IsV0FBVyxFQUFFLHdZQUF3WTtvQkFDclosS0FBSyxFQUFFO3dCQUNILElBQUksRUFBRSxRQUFRO3dCQUNkLFVBQVUsRUFBRTs0QkFDUixRQUFRLEVBQUU7Z0NBQ04sSUFBSSxFQUFFLFFBQVE7Z0NBQ2QsV0FBVyxFQUFFLGdHQUFnRzs2QkFDaEg7NEJBQ0QsWUFBWSxFQUFFO2dDQUNWLElBQUksRUFBRSxRQUFRO2dDQUNkLElBQUksRUFBRTtvQ0FDRixRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsT0FBTztvQ0FDakQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTTtvQ0FDL0IsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLE9BQU87b0NBQ3JELFdBQVcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGFBQWE7aUNBQzFEO2dDQUNELFdBQVcsRUFBRSx1RkFBdUY7NkJBQ3ZHOzRCQUNELEtBQUssRUFBRTtnQ0FDSCxXQUFXLEVBQUUsb0ZBQW9GOzZCQUNwRzt5QkFDSjt3QkFDRCxRQUFRLEVBQUUsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLE9BQU8sQ0FBQztxQkFDbEQ7aUJBQ0o7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwyRUFBMkU7aUJBQzNGO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQztvQkFDaEUsV0FBVyxFQUFFLHlEQUF5RDtvQkFDdEUsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDbkUsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUN6RSxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUNwRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDNUUsWUFBWSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDO1lBQ3ZELG9CQUFvQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDO1lBQ3RFLGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBQSxtREFBa0IsRUFBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0csYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUEsOERBQTBCLEVBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3RGLENBQUM7SUFtYU4sQ0FBQztJQWphVyxLQUFLLENBQUMsWUFBWSxDQUFDLFFBQWdCLEVBQUUsYUFBcUI7O1FBQzlELElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUEsbUJBQVcsRUFBQyx3REFBd0QsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFDRCw0Q0FBNEM7UUFDNUMsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0QsSUFBSSxpQkFBaUIsQ0FBQyxPQUFPLEtBQUksTUFBQSxpQkFBaUIsQ0FBQyxJQUFJLDBDQUFFLFVBQVUsQ0FBQSxFQUFFLENBQUM7WUFDbEUsTUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQztZQUM3RyxJQUFJLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFDcEUsY0FBYyxhQUFhLDBCQUEwQixDQUN4RCxDQUFDO1lBQ04sQ0FBQztRQUNMLENBQUM7UUFDRCwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3RELElBQUksRUFBRSxRQUFRO2dCQUNkLFNBQVMsRUFBRSxhQUFhO2FBQzNCLENBQUMsQ0FBQztZQUNILGlEQUFpRDtZQUNqRCxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNDLHNEQUFzRDtZQUN0RCxNQUFNLGtCQUFrQixHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM5RCxJQUFJLGtCQUFrQixDQUFDLE9BQU8sS0FBSSxNQUFBLGtCQUFrQixDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLEVBQUUsQ0FBQztnQkFDcEUsTUFBTSxjQUFjLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLENBQUM7Z0JBQzNHLElBQUksY0FBYyxFQUFFLENBQUM7b0JBQ2pCLE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsRUFDckUsY0FBYyxhQUFhLHNCQUFzQixDQUNwRCxDQUFDO2dCQUNOLENBQUM7cUJBQU0sQ0FBQztvQkFDSixPQUFPLElBQUEsbUJBQVcsRUFBQyxjQUFjLGFBQWEsaUVBQWlFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDNUwsQ0FBQztZQUNMLENBQUM7aUJBQU0sQ0FBQztnQkFDSixPQUFPLElBQUEsbUJBQVcsRUFBQyx3Q0FBd0Msa0JBQWtCLENBQUMsS0FBSyxJQUFJLCtCQUErQixFQUFFLENBQUMsQ0FBQztZQUM5SCxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsNkJBQTZCO1lBQzdCLElBQUksQ0FBQztnQkFDRCxNQUFNLE9BQU8sR0FBRztvQkFDWixJQUFJLEVBQUUsa0JBQWtCO29CQUN4QixNQUFNLEVBQUUsb0JBQW9CO29CQUM1QixJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDO2lCQUNsQyxDQUFDO2dCQUNGLE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUMzRixJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQzNCLE9BQU8sSUFBQSxxQkFBYSxFQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN0RCxDQUFDO3FCQUFNLENBQUM7b0JBQ0osT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsS0FBSyxLQUFJLHNCQUFzQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDN0UsQ0FBQztZQUNMLENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlLENBQUMsUUFBZ0IsRUFBRSxhQUFxQjs7UUFDakUsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzlCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLDJEQUEyRCxDQUFDLENBQUM7UUFDcEYsQ0FBQztRQUNELDhDQUE4QztRQUM5QyxNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQSxNQUFBLGlCQUFpQixDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLEVBQUUsQ0FBQztZQUNwRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxzQ0FBc0MsUUFBUSxNQUFNLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDdEcsQ0FBQztRQUNELGlDQUFpQztRQUNqQyxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQztRQUNsRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDVixPQUFPLElBQUEsbUJBQVcsRUFBQyxrQkFBa0IsYUFBYSx3QkFBd0IsUUFBUSxzRUFBc0UsQ0FBQyxDQUFDO1FBQzlKLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRTtnQkFDdEQsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsU0FBUyxFQUFFLGFBQWE7YUFDM0IsQ0FBQyxDQUFDO1lBQ0gsOEJBQThCO1lBQzlCLE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzRCxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsT0FBTyxLQUFJLE1BQUEsTUFBQSxlQUFlLENBQUMsSUFBSSwwQ0FBRSxVQUFVLDBDQUFFLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQSxDQUFDO1lBQ2xJLElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ2QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsa0JBQWtCLGFBQWEsZ0NBQWdDLFFBQVEsSUFBSSxDQUFDLENBQUM7WUFDcEcsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsRUFDM0Isa0JBQWtCLGFBQWEscUNBQXFDLFFBQVEsR0FBRyxDQUNsRixDQUFDO1lBQ04sQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtCQUErQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsUUFBZ0I7UUFDeEMsSUFBSSxDQUFDLFFBQVE7WUFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyx5Q0FBeUMsQ0FBQyxDQUFDO1FBQzdFLElBQUksQ0FBQztZQUNELE1BQU0sUUFBUSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNwRixJQUFJLFFBQVEsSUFBSSxRQUFRLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ2pDLE1BQU0sVUFBVSxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUU7O29CQUFDLE9BQUEsQ0FBQzt3QkFDdEQsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLFNBQVM7d0JBQ3pELElBQUksRUFBRSxDQUFBLE1BQUEsSUFBSSxDQUFDLElBQUksMENBQUUsS0FBSyxLQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSTt3QkFDM0MsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUN6RCxVQUFVLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQztxQkFDcEQsQ0FBQyxDQUFBO2lCQUFBLENBQUMsQ0FBQztnQkFDSixPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ25ELENBQUM7WUFDRCxPQUFPLElBQUEsbUJBQVcsRUFBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQztnQkFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtvQkFDOUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDO2lCQUNwRSxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxNQUFNLENBQUMsT0FBTztvQkFBRSxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNqRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxDQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxLQUFLLEtBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JELENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFnQixFQUFFLGFBQXFCO1FBQ2xFLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUEsbUJBQVcsRUFBQyw2REFBNkQsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDRCxNQUFNLFFBQVEsR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDcEYsSUFBSSxRQUFRLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNqQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO29CQUNwRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQztvQkFDeEQsT0FBTyxRQUFRLEtBQUssYUFBYSxDQUFDO2dCQUN0QyxDQUFDLENBQUMsQ0FBQztnQkFDSCxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNaLE9BQU8sSUFBQSxxQkFBYSxFQUFDO3dCQUNqQixRQUFRLEVBQUUsYUFBYTt3QkFDdkIsT0FBTyxFQUFFLFNBQVMsQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUNuRSxVQUFVLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsQ0FBQztxQkFDekQsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQ0QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsY0FBYyxhQUFhLHFCQUFxQixDQUFDLENBQUM7WUFDekUsQ0FBQztZQUNELE9BQU8sSUFBQSxtQkFBVyxFQUFDLHNDQUFzQyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDO2dCQUNELE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO29CQUM5RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUM7aUJBQ3BFLENBQUMsQ0FBQztnQkFDSCxJQUFJLE1BQU0sQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDM0MsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxDQUFDO29CQUMxRixJQUFJLFNBQVM7d0JBQUUsT0FBTyxJQUFBLHFCQUFhLGtCQUFHLFFBQVEsRUFBRSxhQUFhLElBQUssU0FBUyxFQUFHLENBQUM7b0JBQy9FLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGNBQWMsYUFBYSxxQkFBcUIsQ0FBQyxDQUFDO2dCQUN6RSxDQUFDO2dCQUNELE9BQU8sSUFBQSxtQkFBVyxFQUFDLENBQUEsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUssS0FBSSw4QkFBOEIsQ0FBQyxDQUFDO1lBQ3hFLENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLDBCQUEwQixDQUFDLFNBQWM7UUFDN0MsT0FBTyxJQUFBLGdFQUE0QixFQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBUztRQUN4QyxNQUFNLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQztRQUV4RSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsUUFBUSxJQUFJLFlBQVksS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO1lBQ2hHLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGlHQUFpRyxDQUFDLENBQUM7UUFDMUgsQ0FBQztRQUVELGtGQUFrRjtRQUNsRixNQUFNLGtCQUFrQixHQUFHLElBQUEsOERBQTBCLEVBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUQsSUFBSSxrQkFBa0IsRUFBRSxDQUFDO1lBQ3JCLE9BQU8sa0JBQWtCLENBQUM7UUFDOUIsQ0FBQztRQUVELDJFQUEyRTtRQUMzRSxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsYUFBYSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3hGLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDakIsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDO1FBQzdCLENBQUM7UUFFRCxzRUFBc0U7UUFDdEUsTUFBTSxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQzlDLFFBQVEsRUFBRSxhQUFhLEVBQUUsVUFBVSxDQUFDLGVBQWUsRUFBRSxVQUFVLENBQUMsaUJBQWlCLEVBQ2pGLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsQ0FDcEMsQ0FBQztRQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDdkIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsV0FBVyxDQUFDLEtBQUssSUFBSSwyQkFBMkIsUUFBUSxHQUFHLENBQUMsQ0FBQztRQUNwRixDQUFDO1FBRUQsT0FBTyxJQUFBLHFCQUFhLEVBQUM7WUFDakIsUUFBUTtZQUNSLGFBQWE7WUFDYixRQUFRO1lBQ1IsV0FBVyxFQUFFLFdBQVcsQ0FBQyxXQUFXO1lBQ3BDLGNBQWMsRUFBRSxXQUFXLENBQUMsY0FBYztTQUM3QyxFQUFFLG9CQUFvQixhQUFhLElBQUksUUFBUSxFQUFFLENBQUMsQ0FBQztJQUN4RCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSyxLQUFLLENBQUMsMkJBQTJCLENBQUMsSUFBUztRQUMvQyxNQUFNLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxVQUFVLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFFckQsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzlCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHlFQUF5RSxDQUFDLENBQUM7UUFDbEcsQ0FBQztRQUNELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDeEQsT0FBTyxJQUFBLG1CQUFXLEVBQUMsaUhBQWlILENBQUMsQ0FBQztRQUMxSSxDQUFDO1FBRUQseURBQXlEO1FBQ3pELE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFFBQVEsRUFBRSxhQUFhLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDekYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNqQixPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUM7UUFDN0IsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUErRyxFQUFFLENBQUM7UUFFL0gsS0FBSyxNQUFNLEtBQUssSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUM3QixNQUFNLFFBQVEsR0FBRyxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsUUFBUSxDQUFDO1lBQ2pDLE1BQU0sWUFBWSxHQUFHLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxZQUFZLENBQUM7WUFDekMsTUFBTSxLQUFLLEdBQUcsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLEtBQUssQ0FBQztZQUUzQixJQUFJLENBQUMsUUFBUSxJQUFJLFlBQVksS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUNqRSxPQUFPLENBQUMsSUFBSSxDQUFDO29CQUNULFFBQVEsRUFBRSxRQUFRLElBQUksV0FBVztvQkFDakMsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsS0FBSyxFQUFFLHVEQUF1RDtpQkFDakUsQ0FBQyxDQUFDO2dCQUNILFNBQVM7WUFDYixDQUFDO1lBRUQsSUFBSSxDQUFDO2dCQUNELE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUM5QyxRQUFRLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixFQUNqRixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQ3BDLENBQUM7Z0JBQ0YsT0FBTyxDQUFDLElBQUksQ0FBQztvQkFDVCxRQUFRO29CQUNSLE9BQU8sRUFBRSxXQUFXLENBQUMsT0FBTztvQkFDNUIsV0FBVyxFQUFFLFdBQVcsQ0FBQyxXQUFXO29CQUNwQyxjQUFjLEVBQUUsV0FBVyxDQUFDLGNBQWM7b0JBQzFDLEtBQUssRUFBRSxXQUFXLENBQUMsS0FBSztpQkFDM0IsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztZQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7Z0JBQ2hCLHVEQUF1RDtnQkFDdkQsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxPQUFPLEtBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuRixDQUFDO1FBQ0wsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQ3hELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDO1FBQzFDLE1BQU0sT0FBTyxHQUFHLDJCQUEyQixhQUFhLEtBQUssU0FBUyxJQUFJLE9BQU8sQ0FBQyxNQUFNLGdCQUFnQixNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQU0sU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUVqSixPQUFPLElBQUEscUJBQWEsRUFBQztZQUNqQixRQUFRO1lBQ1IsYUFBYTtZQUNiLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTTtZQUNyQixTQUFTO1lBQ1QsTUFBTTtZQUNOLE9BQU87U0FDVixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7O09BR0c7SUFDSyxLQUFLLENBQUMsc0JBQXNCLENBQ2hDLFFBQWdCLEVBQ2hCLGFBQXFCLEVBQ3JCLFFBQTRCOztRQUs1Qiw4Q0FBOEM7UUFDOUMsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksRUFBRSxDQUFDO1lBQzFELE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFBLG1CQUFXLEVBQUMsc0NBQXNDLFFBQVEsTUFBTSxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDOUgsQ0FBQztRQUVELE1BQU0sYUFBYSxHQUFHLGtCQUFrQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDekQsSUFBSSxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQzNCLElBQUksYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sY0FBYyxHQUFhLEVBQUUsQ0FBQztRQUNwQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzVDLE1BQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMvQixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssYUFBYSxFQUFFLENBQUM7Z0JBQzlCLGVBQWUsR0FBRyxJQUFJLENBQUM7Z0JBQ3ZCLGFBQWEsR0FBRyxDQUFDLENBQUM7Z0JBQ2xCLE1BQU07WUFDVixDQUFDO1FBQ0wsQ0FBQztRQUVELDZFQUE2RTtRQUM3RSw4RUFBOEU7UUFDOUUsK0VBQStFO1FBQy9FLGdGQUFnRjtRQUNoRixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDbkIsSUFBSSxDQUFDO2dCQUNELE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO29CQUM5RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLHdCQUF3QixFQUFFLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxhQUFhLENBQUM7aUJBQzlGLENBQUMsQ0FBQztnQkFDSCxNQUFNLEtBQUssR0FBRyxDQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxPQUFPLEVBQUMsQ0FBQyxDQUFDLE1BQUEsTUFBTSxDQUFDLElBQUksMENBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7Z0JBQy9ELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksS0FBSyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztvQkFDMUUsYUFBYSxHQUFHLEtBQUssQ0FBQztvQkFDdEIsZUFBZSxHQUFHLGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDM0MsQ0FBQztZQUNMLENBQUM7WUFBQyxXQUFNLENBQUM7Z0JBQ0wsd0VBQXdFO1lBQzVFLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ25CLE1BQU0sV0FBVyxHQUFHLElBQUEsK0RBQTJCLEVBQUMsYUFBYSxFQUFFLGNBQWMsRUFBRSxRQUFRLElBQUksRUFBRSxDQUFDLENBQUM7WUFDL0YsT0FBTztnQkFDSCxFQUFFLEVBQUUsS0FBSztnQkFDVCxNQUFNLEVBQUU7b0JBQ0osT0FBTyxFQUFFLEtBQUs7b0JBQ2QsS0FBSyxFQUFFLGNBQWMsYUFBYSw4Q0FBOEMsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDM0csV0FBVztpQkFDZDthQUNKLENBQUM7UUFDTixDQUFDO1FBRUQseURBQXlEO1FBQ3pELE1BQU0sV0FBVyxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNsRixJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3pDLE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFBLG1CQUFXLEVBQUMsa0RBQWtELENBQUMsRUFBRSxDQUFDO1FBQ2xHLENBQUM7UUFFRCxJQUFJLGlCQUFpQixHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzNCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3BELE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFRLENBQUM7WUFDN0MsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO1lBQ3JFLElBQUksUUFBUSxLQUFLLGFBQWEsRUFBRSxDQUFDO2dCQUM3QixpQkFBaUIsR0FBRyxDQUFDLENBQUM7Z0JBQ3RCLE1BQU07WUFDVixDQUFDO1FBQ0wsQ0FBQztRQUNELDhFQUE4RTtRQUM5RSw0REFBNEQ7UUFDNUQsSUFBSSxpQkFBaUIsS0FBSyxDQUFDLENBQUMsSUFBSSxhQUFhLElBQUksQ0FBQyxJQUFJLGFBQWEsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2pHLGlCQUFpQixHQUFHLGFBQWEsQ0FBQztRQUN0QyxDQUFDO1FBRUQsSUFBSSxpQkFBaUIsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQzNCLE9BQU8sRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFBLG1CQUFXLEVBQUMscURBQXFELENBQUMsRUFBRSxDQUFDO1FBQ3JHLENBQUM7UUFFRCxPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztJQUM1RCxDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNLLEtBQUssQ0FBQyxtQkFBbUIsQ0FDN0IsUUFBZ0IsRUFDaEIsYUFBcUIsRUFDckIsZUFBb0IsRUFDcEIsaUJBQXlCLEVBQ3pCLEtBQTZEO1FBRTdELE1BQU0sRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxHQUFHLEtBQUssQ0FBQztRQUNoRCxJQUFJLENBQUM7WUFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLDZCQUE2QixhQUFhLElBQUksUUFBUSxXQUFXLFlBQVksT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxZQUFZLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFFN0ksb0ZBQW9GO1lBQ3BGLElBQUksWUFBWSxDQUFDO1lBQ2pCLElBQUksQ0FBQztnQkFDRCxZQUFZLEdBQUcsSUFBQSxtREFBZSxFQUFDLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUM5RCxDQUFDO1lBQUMsT0FBTyxZQUFpQixFQUFFLENBQUM7Z0JBQ3pCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSwrQkFBK0IsUUFBUSxNQUFNLFlBQVksQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQzFHLENBQUM7WUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUN2QixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsYUFBYSxRQUFRLDZCQUE2QixhQUFhLDRCQUE0QixZQUFZLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMvSyxDQUFDO1lBRUQsZ0RBQWdEO1lBQ2hELE1BQU0sYUFBYSxHQUFHLFlBQVksQ0FBQyxhQUFhLENBQUM7WUFDakQsTUFBTSxjQUFjLEdBQVEsSUFBQSx3REFBb0IsRUFBQyxZQUFZLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFdEUsMkZBQTJGO1lBQzNGLE1BQU0sWUFBWSxHQUFHLGFBQWEsaUJBQWlCLElBQUksUUFBUSxFQUFFLENBQUM7WUFDbEUsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLElBQUEscURBQXFCLEVBQ25ELEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxpQkFBaUIsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsY0FBYyxFQUFFLEVBQzNHLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FDcEQsQ0FBQztZQUVGLHVEQUF1RDtZQUN2RCxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNDLE1BQU0sWUFBWSxHQUFHLE1BQU0sSUFBQSxpRUFBNkIsRUFDcEQsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLG1CQUFtQixFQUNyRSxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQ3BELENBQUM7WUFFRixPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxDQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsWUFBWSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzNHLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sQ0FBQyxLQUFLLENBQUMsNkNBQTZDLFFBQVEsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2hGLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSwyQkFBMkIsUUFBUSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1FBQy9GLENBQUM7SUFDTCxDQUFDO0NBRUo7QUEzZkQsMENBMmZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBhbmFseXplUHJvcGVydHksIGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAsIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbiwgY29udmVydFByb3BlcnR5VmFsdWUsIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0LCByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcywgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5pbXBvcnQgeyBhcHBseVByb3BlcnR5VG9FZGl0b3IgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtZWRpdG9yLWFwcGx5JztcbmltcG9ydCB7IGF0dGFjaFNjcmlwdFRvTm9kZSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1zY3JpcHQtYXR0YWNoJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZUNvbXBvbmVudCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9jb21wb25lbnQnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBjb21wb25lbnRzIG9uIHNjZW5lIG5vZGVzLiBBY3Rpb25zOiBhZGQ9YWRkIGNvbXBvbmVudCB0byBub2RlLCByZW1vdmU9cmVtb3ZlIGNvbXBvbmVudCAodXNlIGNpZCBmcm9tIGdldF9hbGwpLCBnZXRfYWxsPWxpc3QgYWxsIGNvbXBvbmVudHMgb24gbm9kZSwgZ2V0X2luZm89Z2V0IHNwZWNpZmljIGNvbXBvbmVudCBkZXRhaWxzIGFuZCBwcm9wZXJ0aWVzLCBzZXRfcHJvcGVydHk9c2V0IGEgc2luZ2xlIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZSAoc3VwcG9ydHMgZG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIGxpa2UgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIiksIHNldF9wcm9wZXJ0aWVzX2JhdGNoPXNldCBtYW55IHByb3BlcnRpZXMgb24gb25lIGNvbXBvbmVudCBpbiBhIHNpbmdsZSBjYWxsIChlYWNoIGZpZWxkIHNldCBpbmRlcGVuZGVudGx5IOKAlCBvbmUgYmFkIGZpZWxkIGRvZXMgbm90IGFib3J0IHRoZSByZXN0KSwgYXR0YWNoX3NjcmlwdD1hdHRhY2ggYSBUeXBlU2NyaXB0L0phdmFTY3JpcHQgc2NyaXB0IGNvbXBvbmVudCwgZ2V0X2F2YWlsYWJsZT1saXN0IGF2YWlsYWJsZSBjb21wb25lbnQgdHlwZXMgYnkgY2F0ZWdvcnkuIE5PVEU6IEZvciBub2RlIGJhc2ljIHByb3BlcnRpZXMgKG5hbWUsIGFjdGl2ZSwgbGF5ZXIpIHVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3Byb3BlcnR5LiBGb3IgdHJhbnNmb3JtcyAocG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSkgdXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnYWRkJywgJ3JlbW92ZScsICdnZXRfYWxsJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfcHJvcGVydGllc19iYXRjaCcsICdhdHRhY2hfc2NyaXB0JywgJ2dldF9hdmFpbGFibGUnXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydhZGQnLCAncmVtb3ZlJywgJ2dldF9hbGwnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9wcm9wZXJ0aWVzX2JhdGNoJywgJ2F0dGFjaF9zY3JpcHQnLCAnZ2V0X2F2YWlsYWJsZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGFkZD1hZGQgY29tcG9uZW50IHRvIG5vZGUsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50ICh1c2UgY2lkIGZyb20gZ2V0X2FsbCksIGdldF9hbGw9bGlzdCBhbGwgY29tcG9uZW50cywgZ2V0X2luZm89Z2V0IGNvbXBvbmVudCBkZXRhaWxzLCBzZXRfcHJvcGVydHk9c2V0IGEgc2luZ2xlIHByb3BlcnR5IHZhbHVlIChkb3R0ZWQgbmVzdGVkIHBhdGhzIHN1cHBvcnRlZCksIHNldF9wcm9wZXJ0aWVzX2JhdGNoPXNldCBtYW55IHByb3BlcnRpZXMgYXQgb25jZSwgYXR0YWNoX3NjcmlwdD1hdHRhY2ggYSBzY3JpcHQgZmlsZSwgZ2V0X2F2YWlsYWJsZT1saXN0IGF2YWlsYWJsZSB0eXBlcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZCwgcmVtb3ZlLCBnZXRfYWxsLCBnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCBhdHRhY2hfc2NyaXB0XSBUYXJnZXQgbm9kZSBVVUlELiBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPWdldF9hbGwgdG8gZmluZCBub2RlIFVVSURzLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkXSBDb21wb25lbnQgdHlwZSB0byBhZGQgKGUuZy4sIGNjLlNwcml0ZSwgY2MuTGFiZWwsIGNjLkJ1dHRvbikuIFtyZW1vdmVdIENvbXBvbmVudCBjaWQgKHRoZSB0eXBlIGZpZWxkIGZyb20gZ2V0X2FsbCDigJQgTk9UIHNjcmlwdCBuYW1lKS4gW2dldF9pbmZvLCBzZXRfcHJvcGVydHldIENvbXBvbmVudCB0eXBlIHRvIHRhcmdldC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFeGFtcGxlczogY2MuTGFiZWwg4oaSIHN0cmluZywgZm9udFNpemUsIGNvbG9yOyBjYy5TcHJpdGUg4oaSIHNwcml0ZUZyYW1lLCBjb2xvcjsgY2MuVUlUcmFuc2Zvcm0g4oaSIGNvbnRlbnRTaXplLCBhbmNob3JQb2ludC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHlUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogW1xuICAgICAgICAgICAgICAgICAgICAnc3RyaW5nJywgJ251bWJlcicsICdib29sZWFuJywgJ2ludGVnZXInLCAnZmxvYXQnLFxuICAgICAgICAgICAgICAgICAgICAnY29sb3InLCAndmVjMicsICd2ZWMzJywgJ3NpemUnLFxuICAgICAgICAgICAgICAgICAgICAnbm9kZScsICdjb21wb25lbnQnLCAnc3ByaXRlRnJhbWUnLCAncHJlZmFiJywgJ2Fzc2V0JyxcbiAgICAgICAgICAgICAgICAgICAgJ25vZGVBcnJheScsICdjb2xvckFycmF5JywgJ251bWJlckFycmF5JywgJ3N0cmluZ0FycmF5J1xuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBkYXRhIHR5cGUgZm9yIGNvcnJlY3QgdmFsdWUgY29udmVyc2lvbi4gTXVzdCBtYXRjaCB0aGUgYWN0dWFsIHByb3BlcnR5IHR5cGUuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB2YWx1ZS4gRm9ybWF0IGRlcGVuZHMgb24gcHJvcGVydHlUeXBlOiBzdHJpbmc9XCJ0ZXh0XCIsIG51bWJlcj00MiwgYm9vbGVhbj10cnVlLCBjb2xvcj17XCJyXCI6MjU1LFwiZ1wiOjAsXCJiXCI6MCxcImFcIjoyNTV9IG9yIFwiI0ZGMDAwMFwiLCB2ZWMyPXtcInhcIjoxMDAsXCJ5XCI6NTB9LCB2ZWMzPXtcInhcIjoxLFwieVwiOjIsXCJ6XCI6M30sIHNpemU9e1wid2lkdGhcIjoxMDAsXCJoZWlnaHRcIjo1MH0sIG5vZGUvY29tcG9uZW50L3Nwcml0ZUZyYW1lL3ByZWZhYi9hc3NldD1cInV1aWQtc3RyaW5nXCIsIG5vZGVBcnJheT1bXCJ1dWlkMVwiLFwidXVpZDJcIl0sIGNvbG9yQXJyYXk9W3tcInJcIjoyNTUsLi4ufV0sIG51bWJlckFycmF5PVsxLDIsM10sIHN0cmluZ0FycmF5PVtcImFcIixcImJcIl0nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnRpZXNfYmF0Y2hdIEFycmF5IG9mIHByb3BlcnR5IGVudHJpZXMgdG8gc2V0IG9uIHRoZSBTQU1FIGNvbXBvbmVudCBpbiBvbmUgY2FsbC4gRWFjaCBlbnRyeToge3Byb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlfSB3aXRoIHRoZSBzYW1lIHNlbWFudGljcyBhcyBzZXRfcHJvcGVydHkuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyBwZXIgZW50cnkgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFYWNoIGVudHJ5IGlzIGFwcGxpZWQgaW5kZXBlbmRlbnRseSDigJQgYSBmYWlsdXJlIG9uIG9uZSBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgb3RoZXJzOyB0aGUgcmVzdWx0IHJlcG9ydHMgcGVyLWZpZWxkIHN1Y2Nlc3MvZXJyb3IuJyxcbiAgICAgICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2Jvb2xlYW4nLCAnaW50ZWdlcicsICdmbG9hdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjb2xvcicsICd2ZWMyJywgJ3ZlYzMnLCAnc2l6ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdub2RlJywgJ2NvbXBvbmVudCcsICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IHZhbHVlLiBTYW1lIGZvcm1hdCBydWxlcyBhcyBzZXRfcHJvcGVydHkgdmFsdWUgKGRlcGVuZHMgb24gcHJvcGVydHlUeXBlKS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Byb3BlcnR5JywgJ3Byb3BlcnR5VHlwZScsICd2YWx1ZSddXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thdHRhY2hfc2NyaXB0XSBTY3JpcHQgYXNzZXQgcGF0aCAoZS5nLiwgZGI6Ly9hc3NldHMvc2NyaXB0cy9NeVNjcmlwdC50cyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2F0ZWdvcnk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdyZW5kZXJlcicsICd1aScsICdwaHlzaWNzJywgJ2FuaW1hdGlvbicsICdhdWRpbyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9hdmFpbGFibGVdIENvbXBvbmVudCBjYXRlZ29yeSBmaWx0ZXIuIERlZmF1bHQ6IGFsbCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGFkZDogKGFyZ3MpID0+IHRoaXMuYWRkQ29tcG9uZW50KGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIHJlbW92ZTogKGFyZ3MpID0+IHRoaXMucmVtb3ZlQ29tcG9uZW50KGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIGdldF9hbGw6IChhcmdzKSA9PiB0aGlzLmdldENvbXBvbmVudHMoYXJncy5ub2RlVXVpZCksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0Q29tcG9uZW50UHJvcGVydHkoYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0aWVzX2JhdGNoOiAoYXJncykgPT4gdGhpcy5zZXRDb21wb25lbnRQcm9wZXJ0aWVzQmF0Y2goYXJncyksXG4gICAgICAgIGF0dGFjaF9zY3JpcHQ6IChhcmdzKSA9PiBhdHRhY2hTY3JpcHRUb05vZGUoYXJncy5ub2RlVXVpZCwgYXJncy5zY3JpcHRQYXRoLCAodXVpZCkgPT4gdGhpcy5nZXRDb21wb25lbnRzKHV1aWQpKSxcbiAgICAgICAgZ2V0X2F2YWlsYWJsZTogKGFyZ3MpID0+IFByb21pc2UucmVzb2x2ZShnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdChhcmdzLmNhdGVnb3J5KSlcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRDb21wb25lbnQobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249YWRkJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hlY2sgaWYgY29tcG9uZW50IGFscmVhZHkgZXhpc3RzIG9uIG5vZGVcbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoYWxsQ29tcG9uZW50c0luZm8uc3VjY2VzcyAmJiBhbGxDb21wb25lbnRzSW5mby5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ0NvbXBvbmVudCA9IGFsbENvbXBvbmVudHNJbmZvLmRhdGEuY29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgY29tcG9uZW50VmVyaWZpZWQ6IHRydWUsIGV4aXN0aW5nOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIGFscmVhZHkgZXhpc3RzIG9uIG5vZGVgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBUcnkgYWRkaW5nIGNvbXBvbmVudCB2aWEgRWRpdG9yIEFQSSBkaXJlY3RseVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6IGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZWRpdG9yIHRvIGZpbmlzaCBhZGRpbmcgdGhlIGNvbXBvbmVudFxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuICAgICAgICAgICAgLy8gUmUtcXVlcnkgdG8gdmVyaWZ5IHRoZSBjb21wb25lbnQgd2FzIGFjdHVhbGx5IGFkZGVkXG4gICAgICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbzIgPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKGFsbENvbXBvbmVudHNJbmZvMi5zdWNjZXNzICYmIGFsbENvbXBvbmVudHNJbmZvMi5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRkZWRDb21wb25lbnQgPSBhbGxDb21wb25lbnRzSW5mbzIuZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoYWRkZWRDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBjb21wb25lbnRWZXJpZmllZDogdHJ1ZSwgZXhpc3Rpbmc6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBhZGRlZCBzdWNjZXNzZnVsbHlgXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIHdhcyBub3QgZm91bmQgb24gbm9kZSBhZnRlciBhZGRpdGlvbi4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YWxsQ29tcG9uZW50c0luZm8yLmRhdGEuY29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gdmVyaWZ5IGNvbXBvbmVudCBhZGRpdGlvbjogJHthbGxDb21wb25lbnRzSW5mbzIuZXJyb3IgfHwgJ1VuYWJsZSB0byBnZXQgbm9kZSBjb21wb25lbnRzJ31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2Ugc2NlbmUgc2NyaXB0XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnYWRkQ29tcG9uZW50VG9Ob2RlJyxcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW25vZGVVdWlkLCBjb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCBgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmVDb21wb25lbnQobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249cmVtb3ZlJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gR2V0IGFsbCBjb21wb25lbnRzIHRvIHZlcmlmeSB0aGUgY2lkIGV4aXN0c1xuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmICghYWxsQ29tcG9uZW50c0luZm8uc3VjY2VzcyB8fCAhYWxsQ29tcG9uZW50c0luZm8uZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudHMgZm9yIG5vZGUgJyR7bm9kZVV1aWR9JzogJHthbGxDb21wb25lbnRzSW5mby5lcnJvcn1gKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBNYXRjaCBieSB0eXBlIGZpZWxkIChjaWQpIG9ubHlcbiAgICAgICAgY29uc3QgZXhpc3RzID0gYWxsQ29tcG9uZW50c0luZm8uZGF0YS5jb21wb25lbnRzLnNvbWUoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKCFleGlzdHMpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50IGNpZCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGUgJyR7bm9kZVV1aWR9Jy4gVXNlIGFjdGlvbj1nZXRfYWxsIHRvIGdldCB0aGUgdHlwZSBmaWVsZCAoY2lkKSBmb3IgY29tcG9uZW50VHlwZS5gKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVtb3ZlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6IGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gUmUtcXVlcnkgdG8gY29uZmlybSByZW1vdmFsXG4gICAgICAgICAgICBjb25zdCBhZnRlclJlbW92ZUluZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICAgICAgY29uc3Qgc3RpbGxFeGlzdHMgPSBhZnRlclJlbW92ZUluZm8uc3VjY2VzcyAmJiBhZnRlclJlbW92ZUluZm8uZGF0YT8uY29tcG9uZW50cz8uc29tZSgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgaWYgKHN0aWxsRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgY2lkICcke2NvbXBvbmVudFR5cGV9JyB3YXMgbm90IHJlbW92ZWQgZnJvbSBub2RlICcke25vZGVVdWlkfScuYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlIH0sXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgY2lkICcke2NvbXBvbmVudFR5cGV9JyByZW1vdmVkIHN1Y2Nlc3NmdWxseSBmcm9tIG5vZGUgJyR7bm9kZVV1aWR9J2BcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVtb3ZlIGNvbXBvbmVudDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29tcG9uZW50cyhub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1nZXRfYWxsJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSAmJiBub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gbm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogdGhpcy5leHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wKVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBjb21wb25lbnRzIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBubyBjb21wb25lbnRzIGRhdGEnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXROb2RlSW5mbycsIGFyZ3M6IFtub2RlVXVpZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLmNvbXBvbmVudHMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8IGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1nZXRfaW5mbycpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSAmJiBub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlRGF0YS5fX2NvbXBzX18uZmluZCgoY29tcDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb21wVHlwZSA9PT0gY29tcG9uZW50VHlwZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcG9uZW50LmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXBvbmVudC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHRoaXMuZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcG9uZW50KVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ05vZGUgbm90IGZvdW5kIG9yIG5vIGNvbXBvbmVudHMgZGF0YScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldE5vZGVJbmZvJywgYXJnczogW25vZGVVdWlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQuZGF0YS5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHJlc3VsdC5kYXRhLmNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50KSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCAuLi5jb21wb25lbnQgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBjb21wb25lbnQgaW5mbycpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wb25lbnQ6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgICAgICByZXR1cm4gZXh0cmFjdENvbXBvbmVudFByb3BlcnR5RHVtcChjb21wb25lbnQpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Q29tcG9uZW50UHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH0gPSBhcmdzO1xuXG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUgfHwgIXByb3BlcnR5IHx8IHByb3BlcnR5VHlwZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1zZXRfcHJvcGVydHknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMDogRGV0ZWN0IGlmIHVzZXIgaXMgdHJ5aW5nIHRvIHNldCBhIG5vZGUgcHJvcGVydHk7IHJlZGlyZWN0IHdpdGggZ3VpZGFuY2VcbiAgICAgICAgY29uc3Qgbm9kZVJlZGlyZWN0UmVzdWx0ID0gcmVkaXJlY3ROb2RlUHJvcGVydHlBY2Nlc3MoYXJncyk7XG4gICAgICAgIGlmIChub2RlUmVkaXJlY3RSZXN1bHQpIHtcbiAgICAgICAgICAgIHJldHVybiBub2RlUmVkaXJlY3RSZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDE6IFJlc29sdmUgdGhlIHRhcmdldCBjb21wb25lbnQgKGFuZCBpdHMgcmF3IF9fY29tcHNfXyBpbmRleCkgb25jZS5cbiAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IGF3YWl0IHRoaXMucmVzb2x2ZVRhcmdldENvbXBvbmVudChub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHkpO1xuICAgICAgICBpZiAoIXJlc29sdXRpb24ub2spIHtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHV0aW9uLnJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMjogQXBwbHkgdGhlIHNpbmdsZSBwcm9wZXJ0eSB1c2luZyB0aGUgc2hhcmVkIHBlci1maWVsZCBsb2dpYy5cbiAgICAgICAgY29uc3QgZmllbGRSZXN1bHQgPSBhd2FpdCB0aGlzLmFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcmVzb2x1dGlvbi50YXJnZXRDb21wb25lbnQsIHJlc29sdXRpb24ucmF3Q29tcG9uZW50SW5kZXgsXG4gICAgICAgICAgICB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH1cbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoIWZpZWxkUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChmaWVsZFJlc3VsdC5lcnJvciB8fCBgRmFpbGVkIHRvIHNldCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nYCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICBwcm9wZXJ0eSxcbiAgICAgICAgICAgIGFjdHVhbFZhbHVlOiBmaWVsZFJlc3VsdC5hY3R1YWxWYWx1ZSxcbiAgICAgICAgICAgIGNoYW5nZVZlcmlmaWVkOiBmaWVsZFJlc3VsdC5jaGFuZ2VWZXJpZmllZFxuICAgICAgICB9LCBgU3VjY2Vzc2Z1bGx5IHNldCAke2NvbXBvbmVudFR5cGV9LiR7cHJvcGVydHl9YCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IG11bHRpcGxlIHByb3BlcnRpZXMgb24gYSBTSU5HTEUgY29tcG9uZW50IGluIG9uZSBjYWxsLlxuICAgICAqIFRoZSB0YXJnZXQgY29tcG9uZW50IGlzIHJlc29sdmVkIG9uY2U7IGVhY2ggcHJvcGVydHkgZW50cnkgaXMgdGhlbiBhcHBsaWVkXG4gICAgICogaW5kZXBlbmRlbnRseSB2aWEgdGhlIHNhbWUgcGVyLWZpZWxkIGxvZ2ljIHVzZWQgYnkgc2V0X3Byb3BlcnR5IOKAlCBzbyBhIGZhaWx1cmVcbiAgICAgKiBvbiBvbmUgZmllbGQgZG9lcyBub3QgYWJvcnQgdGhlIHJlc3QuIERvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyB3b3JrIHBlciBlbnRyeS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHNldENvbXBvbmVudFByb3BlcnRpZXNCYXRjaChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydGllcyB9ID0gYXJncztcblxuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0aWVzX2JhdGNoJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3BlcnRpZXMpIHx8IHByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnRpZXMgbXVzdCBiZSBhIG5vbi1lbXB0eSBhcnJheSBvZiB7cHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWV9IGVudHJpZXMgZm9yIGFjdGlvbj1zZXRfcHJvcGVydGllc19iYXRjaCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSB0aGUgdGFyZ2V0IGNvbXBvbmVudCBvbmNlIGZvciB0aGUgd2hvbGUgYmF0Y2guXG4gICAgICAgIGNvbnN0IHJlc29sdXRpb24gPSBhd2FpdCB0aGlzLnJlc29sdmVUYXJnZXRDb21wb25lbnQobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHVuZGVmaW5lZCk7XG4gICAgICAgIGlmICghcmVzb2x1dGlvbi5vaykge1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdXRpb24ucmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0czogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyBzdWNjZXNzOiBib29sZWFuOyBhY3R1YWxWYWx1ZT86IGFueTsgY2hhbmdlVmVyaWZpZWQ/OiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcHJvcGVydGllcykge1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBlbnRyeT8ucHJvcGVydHk7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVR5cGUgPSBlbnRyeT8ucHJvcGVydHlUeXBlO1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBlbnRyeT8udmFsdWU7XG5cbiAgICAgICAgICAgIGlmICghcHJvcGVydHkgfHwgcHJvcGVydHlUeXBlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiBwcm9wZXJ0eSB8fCAnKG1pc3NpbmcpJyxcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiAnRWFjaCBlbnRyeSByZXF1aXJlcyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCBhbmQgdmFsdWUnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmllbGRSZXN1bHQgPSBhd2FpdCB0aGlzLmFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCByZXNvbHV0aW9uLnRhcmdldENvbXBvbmVudCwgcmVzb2x1dGlvbi5yYXdDb21wb25lbnRJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgeyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmllbGRSZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICAgICAgYWN0dWFsVmFsdWU6IGZpZWxkUmVzdWx0LmFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VWZXJpZmllZDogZmllbGRSZXN1bHQuY2hhbmdlVmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBmaWVsZFJlc3VsdC5lcnJvclxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAvLyBEZWZlbnNpdmU6IG9uZSBiYWQgZmllbGQgbXVzdCBuZXZlciBhYm9ydCB0aGUgYmF0Y2guXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvcGVydHksIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyPy5tZXNzYWdlIHx8IFN0cmluZyhlcnIpIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VjY2VlZGVkID0gcmVzdWx0cy5maWx0ZXIociA9PiByLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICAgICAgY29uc3QgZmFpbGVkID0gcmVzdWx0cy5sZW5ndGggLSBzdWNjZWVkZWQ7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgc2V0X3Byb3BlcnRpZXNfYmF0Y2ggb24gJHtjb21wb25lbnRUeXBlfTogJHtzdWNjZWVkZWR9LyR7cmVzdWx0cy5sZW5ndGh9IGZpZWxkKHMpIHNldCR7ZmFpbGVkID4gMCA/IGAsICR7ZmFpbGVkfSBmYWlsZWRgIDogJyd9YDtcblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICB0b3RhbDogcmVzdWx0cy5sZW5ndGgsXG4gICAgICAgICAgICBzdWNjZWVkZWQsXG4gICAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgICByZXN1bHRzXG4gICAgICAgIH0sIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYSBjb21wb25lbnQgb24gYSBub2RlIGludG8gaXRzIGR1bXAgKHRhcmdldENvbXBvbmVudCkgYW5kIGl0cyByYXcgX19jb21wc19fIGluZGV4LlxuICAgICAqIFdoZW4gYHByb3BlcnR5YCBpcyBwcm92aWRlZCwgYSBtaXNzaW5nIGNvbXBvbmVudCB5aWVsZHMgYW4gTExNLWZyaWVuZGx5IHN1Z2dlc3Rpb24uXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlVGFyZ2V0Q29tcG9uZW50KFxuICAgICAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgICAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgIHByb3BlcnR5OiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICApOiBQcm9taXNlPFxuICAgICAgICB8IHsgb2s6IHRydWU7IHRhcmdldENvbXBvbmVudDogYW55OyByYXdDb21wb25lbnRJbmRleDogbnVtYmVyIH1cbiAgICAgICAgfCB7IG9rOiBmYWxzZTsgcmVzdWx0OiBBY3Rpb25Ub29sUmVzdWx0IH1cbiAgICA+IHtcbiAgICAgICAgLy8gR2V0IGFsbCBjb21wb25lbnRzIChkdW1wIGZvcm0pIG9uIHRoZSBub2RlLlxuICAgICAgICBjb25zdCBjb21wb25lbnRzUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoIWNvbXBvbmVudHNSZXNwb25zZS5zdWNjZXNzIHx8ICFjb21wb25lbnRzUmVzcG9uc2UuZGF0YSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN1bHQ6IGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudHMgZm9yIG5vZGUgJyR7bm9kZVV1aWR9JzogJHtjb21wb25lbnRzUmVzcG9uc2UuZXJyb3J9YCkgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHMgPSBjb21wb25lbnRzUmVzcG9uc2UuZGF0YS5jb21wb25lbnRzO1xuICAgICAgICBsZXQgdGFyZ2V0Q29tcG9uZW50ID0gbnVsbDtcbiAgICAgICAgbGV0IHJlc29sdmVkSW5kZXggPSAtMTtcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlVHlwZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IGFsbENvbXBvbmVudHNbaV07XG4gICAgICAgICAgICBhdmFpbGFibGVUeXBlcy5wdXNoKGNvbXAudHlwZSk7XG4gICAgICAgICAgICBpZiAoY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29tcG9uZW50ID0gY29tcDtcbiAgICAgICAgICAgICAgICByZXNvbHZlZEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZhbGxiYWNrOiBjb21wb25lbnRUeXBlIG1heSBiZSBhIHJlYWRhYmxlIGNsYXNzIG5hbWUgKGUuZy4gXCJNeUNvbnRyb2xsZXJcIilcbiAgICAgICAgLy8gd2hpbGUgdGhlIGR1bXAgb25seSBleHBvc2VzIHRoZSBzY3JpcHQncyBjaWQuIFJlc29sdmUgdmlhIHRoZSBzY2VuZSBzY3JpcHQsXG4gICAgICAgIC8vIHdoaWNoIGhhcyB0aGUgbGl2ZSBjYy5qcyBjbGFzcyByZWdpc3RyeSwgdGhlbiBtYXAgYmFjayB0byB0aGUgZHVtcCBjb21wb25lbnRcbiAgICAgICAgLy8gYXQgdGhlIHNhbWUgaW5kZXggKHF1ZXJ5LW5vZGUgX19jb21wc19fIG9yZGVyIG1hdGNoZXMgbm9kZS5jb21wb25lbnRzIG9yZGVyKS5cbiAgICAgICAgaWYgKCF0YXJnZXRDb21wb25lbnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnlOYW1lOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdyZXNvbHZlQ29tcG9uZW50QnlOYW1lJywgYXJnczogW25vZGVVdWlkLCBjb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gYnlOYW1lPy5zdWNjZXNzID8gYnlOYW1lLmRhdGE/LmluZGV4IDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaW5kZXggPT09ICdudW1iZXInICYmIGluZGV4ID49IDAgJiYgaW5kZXggPCBhbGxDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlZEluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbXBvbmVudCA9IGFsbENvbXBvbmVudHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIFNjZW5lIHNjcmlwdCB1bmF2YWlsYWJsZSDigJQgZmFsbCB0aHJvdWdoIHRvIHRoZSBub3QtZm91bmQgZXJyb3IgYmVsb3cuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldENvbXBvbmVudCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24oY29tcG9uZW50VHlwZSwgYXZhaWxhYmxlVHlwZXMsIHByb3BlcnR5IHx8ICcnKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGVUeXBlcy5qb2luKCcsICcpfWAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdldCByYXcgbm9kZSBkYXRhIHRvIGJ1aWxkIHRoZSBjb3JyZWN0IF9fY29tcHNfXyBwYXRoLlxuICAgICAgICBjb25zdCByYXdOb2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgIGlmICghcmF3Tm9kZURhdGEgfHwgIXJhd05vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN1bHQ6IGVycm9yUmVzdWx0KCdGYWlsZWQgdG8gZ2V0IHJhdyBub2RlIGRhdGEgZm9yIHByb3BlcnR5IHNldHRpbmcnKSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJhd0NvbXBvbmVudEluZGV4ID0gLTE7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmF3Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wID0gcmF3Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgaWYgKGNvbXBUeXBlID09PSBjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmF3Q29tcG9uZW50SW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIENsYXNzLW5hbWUgcmVzb2x1dGlvbiBwYXRoOiB0aGUgY2lkIHdvbid0IGVxdWFsIGNvbXBvbmVudFR5cGUsIHNvIHJldXNlIHRoZVxuICAgICAgICAvLyBpbmRleCByZXNvbHZlZCBhYm92ZSAoZHVtcCBvcmRlciA9PSByYXcgX19jb21wc19fIG9yZGVyKS5cbiAgICAgICAgaWYgKHJhd0NvbXBvbmVudEluZGV4ID09PSAtMSAmJiByZXNvbHZlZEluZGV4ID49IDAgJiYgcmVzb2x2ZWRJbmRleCA8IHJhd05vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJhd0NvbXBvbmVudEluZGV4ID0gcmVzb2x2ZWRJbmRleDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyYXdDb21wb25lbnRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdCgnQ291bGQgbm90IGZpbmQgY29tcG9uZW50IGluZGV4IGZvciBzZXR0aW5nIHByb3BlcnR5JykgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCB0YXJnZXRDb21wb25lbnQsIHJhd0NvbXBvbmVudEluZGV4IH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgT05FIHByb3BlcnR5IHZhbHVlIHRvIGFuIGFscmVhZHktcmVzb2x2ZWQgY29tcG9uZW50LlxuICAgICAqIFNoYXJlZCBieSBzZXRfcHJvcGVydHkgKHNpbmdsZSkgYW5kIHNldF9wcm9wZXJ0aWVzX2JhdGNoIChwZXIgZW50cnkpLlxuICAgICAqIFJldHVybnMgYSBwZXItZmllbGQgcmVzdWx0IHJhdGhlciB0aGFuIHRocm93aW5nLCBzbyBjYWxsZXJzIGNhbiBhZ2dyZWdhdGUuXG4gICAgICogRG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKSBhcmUgc3VwcG9ydGVkXG4gICAgICogYmVjYXVzZSBhbmFseXplUHJvcGVydHkgLyBhcHBseVByb3BlcnR5VG9FZGl0b3IgLyB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZVxuICAgICAqIGFsbCB3YWxrIGRvdHRlZCBzZWdtZW50cy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICAgICAgdGFyZ2V0Q29tcG9uZW50OiBhbnksXG4gICAgICAgIHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXIsXG4gICAgICAgIGZpZWxkOiB7IHByb3BlcnR5OiBzdHJpbmc7IHByb3BlcnR5VHlwZTogc3RyaW5nOyB2YWx1ZTogYW55IH1cbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgYWN0dWFsVmFsdWU/OiBhbnk7IGNoYW5nZVZlcmlmaWVkPzogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBjb25zdCB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH0gPSBmaWVsZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTWFuYWdlQ29tcG9uZW50XSBTZXR0aW5nICR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX0gKHR5cGU6ICR7cHJvcGVydHlUeXBlfSkgPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX0gb24gbm9kZSAke25vZGVVdWlkfWApO1xuXG4gICAgICAgICAgICAvLyBBbmFseXplIHRoZSBwcm9wZXJ0eSB0byBnZXQgb3JpZ2luYWwgdmFsdWUgYW5kIHR5cGUgaW5mbyAoc3VwcG9ydHMgZG90dGVkIHBhdGhzKS5cbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eUluZm87XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SW5mbyA9IGFuYWx5emVQcm9wZXJ0eSh0YXJnZXRDb21wb25lbnQsIHByb3BlcnR5KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGFuYWx5emVFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGFuYWx5emUgcHJvcGVydHkgJyR7cHJvcGVydHl9JzogJHthbmFseXplRXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJvcGVydHlJbmZvLmV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGZvdW5kIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIEF2YWlsYWJsZSBwcm9wZXJ0aWVzOiAke3Byb3BlcnR5SW5mby5hdmFpbGFibGVQcm9wZXJ0aWVzLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHZhbHVlIGJhc2VkIG9uIGV4cGxpY2l0IHByb3BlcnR5VHlwZS5cbiAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVmFsdWUgPSBwcm9wZXJ0eUluZm8ub3JpZ2luYWxWYWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZFZhbHVlOiBhbnkgPSBjb252ZXJ0UHJvcGVydHlWYWx1ZShwcm9wZXJ0eVR5cGUsIHZhbHVlKTtcblxuICAgICAgICAgICAgLy8gQnVpbGQgdGhlIChwb3NzaWJseSBkb3R0ZWQpIGNvbXBvbmVudCBwcm9wZXJ0eSBwYXRoIGFuZCBhcHBseSB2aWEgdHlwZS1hd2FyZSBFZGl0b3IgQVBJLlxuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlQYXRoID0gYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS4ke3Byb3BlcnR5fWA7XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yKFxuICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgcmF3Q29tcG9uZW50SW5kZXgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlLCBwcm9jZXNzZWRWYWx1ZSB9LFxuICAgICAgICAgICAgICAgICh1dWlkLCB0eXBlKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8odXVpZCwgdHlwZSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGVkaXRvciB0byBjb21wbGV0ZSB0aGUgdXBkYXRlLCB0aGVuIHZlcmlmeS5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAyMDApKTtcbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbiA9IGF3YWl0IHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlKFxuICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgb3JpZ2luYWxWYWx1ZSwgYWN0dWFsRXhwZWN0ZWRWYWx1ZSxcbiAgICAgICAgICAgICAgICAodXVpZCwgdHlwZSkgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKHV1aWQsIHR5cGUpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBhY3R1YWxWYWx1ZTogdmVyaWZpY2F0aW9uLmFjdHVhbFZhbHVlLCBjaGFuZ2VWZXJpZmllZDogdmVyaWZpY2F0aW9uLnZlcmlmaWVkIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNYW5hZ2VDb21wb25lbnRdIEVycm9yIHNldHRpbmcgcHJvcGVydHkgJyR7cHJvcGVydHl9JzpgLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gc2V0IHByb3BlcnR5ICcke3Byb3BlcnR5fSc6ICR7ZXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbn1cbiJdfQ==