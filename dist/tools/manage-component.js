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
        this.description = 'Manage components on scene nodes. Actions: add=add component to node, remove=remove component (use the cid or uuid from get_all), get_all=list all components on node, get_info=get specific component details and properties, set_property=set a single component property value (supports dotted nested CCClass paths like "cameraSection.mainCamera"), set_properties_batch=set many properties on one component in a single call (each field set independently — one bad field does not abort the rest), attach_script=attach a TypeScript/JavaScript script component, get_available=list available component types by category. NOTE: For node basic properties (name, active, layer) use manage_node action=set_property. For transforms (position, rotation, scale) use manage_node action=set_transform.';
        this.actions = ['add', 'remove', 'get_all', 'get_info', 'set_property', 'set_properties_batch', 'attach_script', 'get_available'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'remove', 'get_all', 'get_info', 'set_property', 'set_properties_batch', 'attach_script', 'get_available'],
                    description: 'Action to perform: add=add component to node, remove=remove component (use the cid or uuid from get_all), get_all=list all components, get_info=get component details, set_property=set a single property value (dotted nested paths supported), set_properties_batch=set many properties at once, attach_script=attach a script file, get_available=list available types'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[add, remove, get_all, get_info, set_property, attach_script] Target node UUID. Use manage_node action=get_all to find node UUIDs.'
                },
                componentType: {
                    type: 'string',
                    description: '[add] Component type to add (e.g., cc.Sprite, cc.Label, cc.Button). [remove] Component cid (the type field from get_all — NOT script name), or the component uuid field from get_all. [get_info, set_property] Component type to target.'
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
        // Get all components so we can resolve componentType to the component's OWN uuid.
        const allComponentsInfo = await this.getComponents(nodeUuid);
        if (!allComponentsInfo.success || !((_a = allComponentsInfo.data) === null || _a === void 0 ? void 0 : _a.components)) {
            return (0, types_1.errorResult)(`Failed to get components for node '${nodeUuid}': ${allComponentsInfo.error}`);
        }
        const allComponents = allComponentsInfo.data.components;
        // Accept either the type field (cid, e.g. "cc.Sprite" or a script cid) — the
        // ergonomic form — or the component's own uuid, for callers that already have it.
        const target = allComponents.find((comp) => comp.type === componentType)
            || allComponents.find((comp) => comp.uuid && comp.uuid === componentType);
        if (!target) {
            const availableTypes = allComponents.map((comp) => comp.type).join(', ');
            return (0, types_1.errorResult)(`Component '${componentType}' not found on node '${nodeUuid}'. Available components: ${availableTypes}. Use action=get_all to get the type field (cid) or uuid for componentType.`);
        }
        // The editor's 'remove-component' takes the COMPONENT's uuid (RemoveComponentOptions
        // is { uuid: string } — its `component` field is an unused parameter). Passing the
        // node uuid here is what made removal silently fail.
        const componentUuid = target.uuid;
        if (!componentUuid) {
            return (0, types_1.errorResult)(`Could not resolve the component uuid for '${componentType}' on node '${nodeUuid}'. The editor requires the component's own uuid to remove it.`);
        }
        try {
            await Editor.Message.request('scene', 'remove-component', {
                uuid: componentUuid
            });
            // Wait for the editor to finish removing the component
            await new Promise(r => setTimeout(r, 100));
            // Re-query to confirm removal — match on the resolved component uuid so a node
            // carrying two components of the same type reports accurately.
            const afterRemoveInfo = await this.getComponents(nodeUuid);
            const stillExists = afterRemoveInfo.success && ((_c = (_b = afterRemoveInfo.data) === null || _b === void 0 ? void 0 : _b.components) === null || _c === void 0 ? void 0 : _c.some((comp) => comp.uuid === componentUuid));
            if (stillExists) {
                return (0, types_1.errorResult)(`Component '${componentType}' (uuid ${componentUuid}) was not removed from node '${nodeUuid}'.`);
            }
            else {
                return (0, types_1.successResult)({ nodeUuid, componentType, componentUuid }, `Component '${componentType}' (uuid ${componentUuid}) removed successfully from node '${nodeUuid}'`);
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
                    var _a, _b, _c;
                    return ({
                        type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                        // The dump nests the component's own uuid under value.uuid.value; the
                        // top-level comp.uuid does not exist, so read the dump form first.
                        uuid: ((_b = (_a = comp.value) === null || _a === void 0 ? void 0 : _a.uuid) === null || _b === void 0 ? void 0 : _b.value) || ((_c = comp.uuid) === null || _c === void 0 ? void 0 : _c.value) || comp.uuid || null,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQWdOO0FBQ2hOLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLG14QkFBbXhCLENBQUM7UUFDbHlCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTdILGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDeEgsV0FBVyxFQUFFLDJXQUEyVztpQkFDM1g7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsME9BQTBPO2lCQUMxUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdPQUF3TztpQkFDeFA7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRTt3QkFDRixRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsT0FBTzt3QkFDakQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTTt3QkFDL0IsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLE9BQU87d0JBQ3JELFdBQVcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGFBQWE7cUJBQzFEO29CQUNELFdBQVcsRUFBRSxzR0FBc0c7aUJBQ3RIO2dCQUNELEtBQUssRUFBRTtvQkFDSCxXQUFXLEVBQUUsc1lBQXNZO2lCQUN0WjtnQkFDRCxVQUFVLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLE9BQU87b0JBQ2IsV0FBVyxFQUFFLHdZQUF3WTtvQkFDclosS0FBSyxFQUFFO3dCQUNILElBQUksRUFBRSxRQUFRO3dCQUNkLFVBQVUsRUFBRTs0QkFDUixRQUFRLEVBQUU7Z0NBQ04sSUFBSSxFQUFFLFFBQVE7Z0NBQ2QsV0FBVyxFQUFFLGdHQUFnRzs2QkFDaEg7NEJBQ0QsWUFBWSxFQUFFO2dDQUNWLElBQUksRUFBRSxRQUFRO2dDQUNkLElBQUksRUFBRTtvQ0FDRixRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsT0FBTztvQ0FDakQsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTTtvQ0FDL0IsTUFBTSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLE9BQU87b0NBQ3JELFdBQVcsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGFBQWE7aUNBQzFEO2dDQUNELFdBQVcsRUFBRSx1RkFBdUY7NkJBQ3ZHOzRCQUNELEtBQUssRUFBRTtnQ0FDSCxXQUFXLEVBQUUsb0ZBQW9GOzZCQUNwRzt5QkFDSjt3QkFDRCxRQUFRLEVBQUUsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLE9BQU8sQ0FBQztxQkFDbEQ7aUJBQ0o7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwyRUFBMkU7aUJBQzNGO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLE9BQU8sQ0FBQztvQkFDaEUsV0FBVyxFQUFFLHlEQUF5RDtvQkFDdEUsT0FBTyxFQUFFLEtBQUs7aUJBQ2pCO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDbkUsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQztZQUN6RSxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUNwRCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDNUUsWUFBWSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDO1lBQ3ZELG9CQUFvQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsSUFBSSxDQUFDO1lBQ3RFLGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBQSxtREFBa0IsRUFBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0csYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUEsOERBQTBCLEVBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3RGLENBQUM7SUFpY04sQ0FBQztJQS9iVyxLQUFLLENBQUMsWUFBWSxDQUFDLFFBQWdCLEVBQUUsYUFBcUI7O1FBQzlELElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUEsbUJBQVcsRUFBQyx3REFBd0QsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFDRCw0Q0FBNEM7UUFDNUMsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDN0QsSUFBSSxpQkFBaUIsQ0FBQyxPQUFPLEtBQUksTUFBQSxpQkFBaUIsQ0FBQyxJQUFJLDBDQUFFLFVBQVUsQ0FBQSxFQUFFLENBQUM7WUFDbEUsTUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQztZQUM3RyxJQUFJLGlCQUFpQixFQUFFLENBQUM7Z0JBQ3BCLE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFDcEUsY0FBYyxhQUFhLDBCQUEwQixDQUN4RCxDQUFDO1lBQ04sQ0FBQztRQUNMLENBQUM7UUFDRCwrQ0FBK0M7UUFDL0MsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUU7Z0JBQ3RELElBQUksRUFBRSxRQUFRO2dCQUNkLFNBQVMsRUFBRSxhQUFhO2FBQzNCLENBQUMsQ0FBQztZQUNILGlEQUFpRDtZQUNqRCxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQzNDLHNEQUFzRDtZQUN0RCxNQUFNLGtCQUFrQixHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM5RCxJQUFJLGtCQUFrQixDQUFDLE9BQU8sS0FBSSxNQUFBLGtCQUFrQixDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLEVBQUUsQ0FBQztnQkFDcEUsTUFBTSxjQUFjLEdBQUcsa0JBQWtCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLENBQUM7Z0JBQzNHLElBQUksY0FBYyxFQUFFLENBQUM7b0JBQ2pCLE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsaUJBQWlCLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsRUFDckUsY0FBYyxhQUFhLHNCQUFzQixDQUNwRCxDQUFDO2dCQUNOLENBQUM7cUJBQU0sQ0FBQztvQkFDSixPQUFPLElBQUEsbUJBQVcsRUFBQyxjQUFjLGFBQWEsaUVBQWlFLGtCQUFrQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDNUwsQ0FBQztZQUNMLENBQUM7aUJBQU0sQ0FBQztnQkFDSixPQUFPLElBQUEsbUJBQVcsRUFBQyx3Q0FBd0Msa0JBQWtCLENBQUMsS0FBSyxJQUFJLCtCQUErQixFQUFFLENBQUMsQ0FBQztZQUM5SCxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsNkJBQTZCO1lBQzdCLElBQUksQ0FBQztnQkFDRCxNQUFNLE9BQU8sR0FBRztvQkFDWixJQUFJLEVBQUUsa0JBQWtCO29CQUN4QixNQUFNLEVBQUUsb0JBQW9CO29CQUM1QixJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDO2lCQUNsQyxDQUFDO2dCQUNGLE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUMzRixJQUFJLE1BQU0sSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQzNCLE9BQU8sSUFBQSxxQkFBYSxFQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN0RCxDQUFDO3FCQUFNLENBQUM7b0JBQ0osT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsS0FBSyxLQUFJLHNCQUFzQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztnQkFDN0UsQ0FBQztZQUNMLENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlLENBQUMsUUFBZ0IsRUFBRSxhQUFxQjs7UUFDakUsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQzlCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLDJEQUEyRCxDQUFDLENBQUM7UUFDcEYsQ0FBQztRQUNELGtGQUFrRjtRQUNsRixNQUFNLGlCQUFpQixHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxJQUFJLENBQUMsQ0FBQSxNQUFBLGlCQUFpQixDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLEVBQUUsQ0FBQztZQUNwRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxzQ0FBc0MsUUFBUSxNQUFNLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDdEcsQ0FBQztRQUNELE1BQU0sYUFBYSxHQUFVLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7UUFFL0QsNkVBQTZFO1FBQzdFLGtGQUFrRjtRQUNsRixNQUFNLE1BQU0sR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQztlQUN0RSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLENBQUM7UUFDbkYsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ1YsTUFBTSxjQUFjLEdBQUcsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM5RSxPQUFPLElBQUEsbUJBQVcsRUFBQyxjQUFjLGFBQWEsd0JBQXdCLFFBQVEsNEJBQTRCLGNBQWMsNkVBQTZFLENBQUMsQ0FBQztRQUMzTSxDQUFDO1FBRUQscUZBQXFGO1FBQ3JGLG1GQUFtRjtRQUNuRixxREFBcUQ7UUFDckQsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNsQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDakIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsNkNBQTZDLGFBQWEsY0FBYyxRQUFRLCtEQUErRCxDQUFDLENBQUM7UUFDeEssQ0FBQztRQUVELElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGtCQUFrQixFQUFFO2dCQUN0RCxJQUFJLEVBQUUsYUFBYTthQUN0QixDQUFDLENBQUM7WUFDSCx1REFBdUQ7WUFDdkQsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMzQywrRUFBK0U7WUFDL0UsK0RBQStEO1lBQy9ELE1BQU0sZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMzRCxNQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsT0FBTyxLQUFJLE1BQUEsTUFBQSxlQUFlLENBQUMsSUFBSSwwQ0FBRSxVQUFVLDBDQUFFLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQSxDQUFDO1lBQ2xJLElBQUksV0FBVyxFQUFFLENBQUM7Z0JBQ2QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsY0FBYyxhQUFhLFdBQVcsYUFBYSxnQ0FBZ0MsUUFBUSxJQUFJLENBQUMsQ0FBQztZQUN4SCxDQUFDO2lCQUFNLENBQUM7Z0JBQ0osT0FBTyxJQUFBLHFCQUFhLEVBQ2hCLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxhQUFhLEVBQUUsRUFDMUMsY0FBYyxhQUFhLFdBQVcsYUFBYSxxQ0FBcUMsUUFBUSxHQUFHLENBQ3RHLENBQUM7WUFDTixDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsK0JBQStCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3JFLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FBQyxRQUFnQjtRQUN4QyxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHlDQUF5QyxDQUFDLENBQUM7UUFDN0UsSUFBSSxDQUFDO1lBQ0QsTUFBTSxRQUFRLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ3BGLElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDakMsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTs7b0JBQUMsT0FBQSxDQUFDO3dCQUN0RCxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksU0FBUzt3QkFDekQsc0VBQXNFO3dCQUN0RSxtRUFBbUU7d0JBQ25FLElBQUksRUFBRSxDQUFBLE1BQUEsTUFBQSxJQUFJLENBQUMsS0FBSywwQ0FBRSxJQUFJLDBDQUFFLEtBQUssTUFBSSxNQUFBLElBQUksQ0FBQyxJQUFJLDBDQUFFLEtBQUssQ0FBQSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSTt3QkFDdEUsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUN6RCxVQUFVLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQztxQkFDcEQsQ0FBQyxDQUFBO2lCQUFBLENBQUMsQ0FBQztnQkFDSixPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ25ELENBQUM7WUFDRCxPQUFPLElBQUEsbUJBQVcsRUFBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLElBQUksQ0FBQztnQkFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtvQkFDOUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDO2lCQUNwRSxDQUFDLENBQUM7Z0JBQ0gsSUFBSSxNQUFNLENBQUMsT0FBTztvQkFBRSxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUNqRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxDQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxLQUFLLEtBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JELENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFnQixFQUFFLGFBQXFCO1FBQ2xFLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUEsbUJBQVcsRUFBQyw2REFBNkQsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDRCxNQUFNLFFBQVEsR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDcEYsSUFBSSxRQUFRLElBQUksUUFBUSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNqQyxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO29CQUNwRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQztvQkFDeEQsT0FBTyxRQUFRLEtBQUssYUFBYSxDQUFDO2dCQUN0QyxDQUFDLENBQUMsQ0FBQztnQkFDSCxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUNaLE9BQU8sSUFBQSxxQkFBYSxFQUFDO3dCQUNqQixRQUFRLEVBQUUsYUFBYTt3QkFDdkIsT0FBTyxFQUFFLFNBQVMsQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUNuRSxVQUFVLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsQ0FBQztxQkFDekQsQ0FBQyxDQUFDO2dCQUNQLENBQUM7Z0JBQ0QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsY0FBYyxhQUFhLHFCQUFxQixDQUFDLENBQUM7WUFDekUsQ0FBQztZQUNELE9BQU8sSUFBQSxtQkFBVyxFQUFDLHNDQUFzQyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDO2dCQUNELE1BQU0sTUFBTSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO29CQUM5RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUM7aUJBQ3BFLENBQUMsQ0FBQztnQkFDSCxJQUFJLE1BQU0sQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztvQkFDM0MsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxDQUFDO29CQUMxRixJQUFJLFNBQVM7d0JBQUUsT0FBTyxJQUFBLHFCQUFhLGtCQUFHLFFBQVEsRUFBRSxhQUFhLElBQUssU0FBUyxFQUFHLENBQUM7b0JBQy9FLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGNBQWMsYUFBYSxxQkFBcUIsQ0FBQyxDQUFDO2dCQUN6RSxDQUFDO2dCQUNELE9BQU8sSUFBQSxtQkFBVyxFQUFDLENBQUEsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUssS0FBSSw4QkFBOEIsQ0FBQyxDQUFDO1lBQ3hFLENBQUM7WUFBQyxPQUFPLElBQVMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ2xHLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztJQUVPLDBCQUEwQixDQUFDLFNBQWM7UUFDN0MscUZBQXFGO1FBQ3JGLElBQUksU0FBUyxDQUFDLEtBQUssSUFBSSxPQUFPLFNBQVMsQ0FBQyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDekQsT0FBTyxTQUFTLENBQUMsS0FBSyxDQUFDO1FBQzNCLENBQUM7UUFDRCxrRUFBa0U7UUFDbEUsTUFBTSxVQUFVLEdBQXdCLEVBQUUsQ0FBQztRQUMzQyxNQUFNLFdBQVcsR0FBRyxDQUFDLFVBQVUsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3pMLEtBQUssTUFBTSxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JELFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDckMsQ0FBQztRQUNMLENBQUM7UUFDRCxPQUFPLFVBQVUsQ0FBQztJQUN0QixDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLElBQVM7UUFDeEMsTUFBTSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFFeEUsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLFFBQVEsSUFBSSxZQUFZLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNoRyxPQUFPLElBQUEsbUJBQVcsRUFBQyxpR0FBaUcsQ0FBQyxDQUFDO1FBQzFILENBQUM7UUFFRCxrRkFBa0Y7UUFDbEYsTUFBTSxrQkFBa0IsR0FBRyxJQUFBLDhEQUEwQixFQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVELElBQUksa0JBQWtCLEVBQUUsQ0FBQztZQUNyQixPQUFPLGtCQUFrQixDQUFDO1FBQzlCLENBQUM7UUFFRCwyRUFBMkU7UUFDM0UsTUFBTSxVQUFVLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN4RixJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2pCLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUM3QixDQUFDO1FBRUQsc0VBQXNFO1FBQ3RFLE1BQU0sV0FBVyxHQUFHLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUM5QyxRQUFRLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLGlCQUFpQixFQUNqRixFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLENBQ3BDLENBQUM7UUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLFdBQVcsQ0FBQyxLQUFLLElBQUksMkJBQTJCLFFBQVEsR0FBRyxDQUFDLENBQUM7UUFDcEYsQ0FBQztRQUVELE9BQU8sSUFBQSxxQkFBYSxFQUFDO1lBQ2pCLFFBQVE7WUFDUixhQUFhO1lBQ2IsUUFBUTtZQUNSLFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVztZQUNwQyxjQUFjLEVBQUUsV0FBVyxDQUFDLGNBQWM7U0FDN0MsRUFBRSxvQkFBb0IsYUFBYSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUM7SUFDeEQsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ssS0FBSyxDQUFDLDJCQUEyQixDQUFDLElBQVM7UUFDL0MsTUFBTSxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRXJELElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUEsbUJBQVcsRUFBQyx5RUFBeUUsQ0FBQyxDQUFDO1FBQ2xHLENBQUM7UUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ3hELE9BQU8sSUFBQSxtQkFBVyxFQUFDLGlIQUFpSCxDQUFDLENBQUM7UUFDMUksQ0FBQztRQUVELHlEQUF5RDtRQUN6RCxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxRQUFRLEVBQUUsYUFBYSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3pGLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDakIsT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDO1FBQzdCLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBK0csRUFBRSxDQUFDO1FBRS9ILEtBQUssTUFBTSxLQUFLLElBQUksVUFBVSxFQUFFLENBQUM7WUFDN0IsTUFBTSxRQUFRLEdBQUcsS0FBSyxhQUFMLEtBQUssdUJBQUwsS0FBSyxDQUFFLFFBQVEsQ0FBQztZQUNqQyxNQUFNLFlBQVksR0FBRyxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsWUFBWSxDQUFDO1lBQ3pDLE1BQU0sS0FBSyxHQUFHLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxLQUFLLENBQUM7WUFFM0IsSUFBSSxDQUFDLFFBQVEsSUFBSSxZQUFZLEtBQUssU0FBUyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDakUsT0FBTyxDQUFDLElBQUksQ0FBQztvQkFDVCxRQUFRLEVBQUUsUUFBUSxJQUFJLFdBQVc7b0JBQ2pDLE9BQU8sRUFBRSxLQUFLO29CQUNkLEtBQUssRUFBRSx1REFBdUQ7aUJBQ2pFLENBQUMsQ0FBQztnQkFDSCxTQUFTO1lBQ2IsQ0FBQztZQUVELElBQUksQ0FBQztnQkFDRCxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FDOUMsUUFBUSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxpQkFBaUIsRUFDakYsRUFBRSxRQUFRLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxDQUNwQyxDQUFDO2dCQUNGLE9BQU8sQ0FBQyxJQUFJLENBQUM7b0JBQ1QsUUFBUTtvQkFDUixPQUFPLEVBQUUsV0FBVyxDQUFDLE9BQU87b0JBQzVCLFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVztvQkFDcEMsY0FBYyxFQUFFLFdBQVcsQ0FBQyxjQUFjO29CQUMxQyxLQUFLLEVBQUUsV0FBVyxDQUFDLEtBQUs7aUJBQzNCLENBQUMsQ0FBQztZQUNQLENBQUM7WUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO2dCQUNoQix1REFBdUQ7Z0JBQ3ZELE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsQ0FBQSxHQUFHLGFBQUgsR0FBRyx1QkFBSCxHQUFHLENBQUUsT0FBTyxLQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkYsQ0FBQztRQUNMLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQztRQUN4RCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLFNBQVMsQ0FBQztRQUMxQyxNQUFNLE9BQU8sR0FBRywyQkFBMkIsYUFBYSxLQUFLLFNBQVMsSUFBSSxPQUFPLENBQUMsTUFBTSxnQkFBZ0IsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxNQUFNLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7UUFFakosT0FBTyxJQUFBLHFCQUFhLEVBQUM7WUFDakIsUUFBUTtZQUNSLGFBQWE7WUFDYixLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU07WUFDckIsU0FBUztZQUNULE1BQU07WUFDTixPQUFPO1NBQ1YsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUNoQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssS0FBSyxDQUFDLHNCQUFzQixDQUNoQyxRQUFnQixFQUNoQixhQUFxQixFQUNyQixRQUE0Qjs7UUFLNUIsOENBQThDO1FBQzlDLE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzlELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMxRCxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBQSxtQkFBVyxFQUFDLHNDQUFzQyxRQUFRLE1BQU0sa0JBQWtCLENBQUMsS0FBSyxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQzlILENBQUM7UUFFRCxNQUFNLGFBQWEsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3pELElBQUksZUFBZSxHQUFHLElBQUksQ0FBQztRQUMzQixJQUFJLGFBQWEsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2QixNQUFNLGNBQWMsR0FBYSxFQUFFLENBQUM7UUFDcEMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM1QyxNQUFNLElBQUksR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDOUIsY0FBYyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDL0IsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLGFBQWEsRUFBRSxDQUFDO2dCQUM5QixlQUFlLEdBQUcsSUFBSSxDQUFDO2dCQUN2QixhQUFhLEdBQUcsQ0FBQyxDQUFDO2dCQUNsQixNQUFNO1lBQ1YsQ0FBQztRQUNMLENBQUM7UUFFRCw2RUFBNkU7UUFDN0UsOEVBQThFO1FBQzlFLCtFQUErRTtRQUMvRSxnRkFBZ0Y7UUFDaEYsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ25CLElBQUksQ0FBQztnQkFDRCxNQUFNLE1BQU0sR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtvQkFDOUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSx3QkFBd0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsYUFBYSxDQUFDO2lCQUM5RixDQUFDLENBQUM7Z0JBQ0gsTUFBTSxLQUFLLEdBQUcsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsT0FBTyxFQUFDLENBQUMsQ0FBQyxNQUFBLE1BQU0sQ0FBQyxJQUFJLDBDQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUMvRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEtBQUssR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQzFFLGFBQWEsR0FBRyxLQUFLLENBQUM7b0JBQ3RCLGVBQWUsR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzNDLENBQUM7WUFDTCxDQUFDO1lBQUMsV0FBTSxDQUFDO2dCQUNMLHdFQUF3RTtZQUM1RSxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUNuQixNQUFNLFdBQVcsR0FBRyxJQUFBLCtEQUEyQixFQUFDLGFBQWEsRUFBRSxjQUFjLEVBQUUsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQy9GLE9BQU87Z0JBQ0gsRUFBRSxFQUFFLEtBQUs7Z0JBQ1QsTUFBTSxFQUFFO29CQUNKLE9BQU8sRUFBRSxLQUFLO29CQUNkLEtBQUssRUFBRSxjQUFjLGFBQWEsOENBQThDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzNHLFdBQVc7aUJBQ2Q7YUFDSixDQUFDO1FBQ04sQ0FBQztRQUVELHlEQUF5RDtRQUN6RCxNQUFNLFdBQVcsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDbEYsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN6QyxPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBQSxtQkFBVyxFQUFDLGtEQUFrRCxDQUFDLEVBQUUsQ0FBQztRQUNsRyxDQUFDO1FBRUQsSUFBSSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMzQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNwRCxNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBUSxDQUFDO1lBQzdDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLFNBQVMsQ0FBQztZQUNyRSxJQUFJLFFBQVEsS0FBSyxhQUFhLEVBQUUsQ0FBQztnQkFDN0IsaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO2dCQUN0QixNQUFNO1lBQ1YsQ0FBQztRQUNMLENBQUM7UUFDRCw4RUFBOEU7UUFDOUUsNERBQTREO1FBQzVELElBQUksaUJBQWlCLEtBQUssQ0FBQyxDQUFDLElBQUksYUFBYSxJQUFJLENBQUMsSUFBSSxhQUFhLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqRyxpQkFBaUIsR0FBRyxhQUFhLENBQUM7UUFDdEMsQ0FBQztRQUVELElBQUksaUJBQWlCLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUMzQixPQUFPLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsSUFBQSxtQkFBVyxFQUFDLHFEQUFxRCxDQUFDLEVBQUUsQ0FBQztRQUNyRyxDQUFDO1FBRUQsT0FBTyxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsZUFBZSxFQUFFLGlCQUFpQixFQUFFLENBQUM7SUFDNUQsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSyxLQUFLLENBQUMsbUJBQW1CLENBQzdCLFFBQWdCLEVBQ2hCLGFBQXFCLEVBQ3JCLGVBQW9CLEVBQ3BCLGlCQUF5QixFQUN6QixLQUE2RDtRQUU3RCxNQUFNLEVBQUUsUUFBUSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDaEQsSUFBSSxDQUFDO1lBQ0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsYUFBYSxJQUFJLFFBQVEsV0FBVyxZQUFZLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsWUFBWSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBRTdJLG9GQUFvRjtZQUNwRixJQUFJLFlBQVksQ0FBQztZQUNqQixJQUFJLENBQUM7Z0JBQ0QsWUFBWSxHQUFHLElBQUEsbURBQWUsRUFBQyxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDOUQsQ0FBQztZQUFDLE9BQU8sWUFBaUIsRUFBRSxDQUFDO2dCQUN6QixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsK0JBQStCLFFBQVEsTUFBTSxZQUFZLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUMxRyxDQUFDO1lBRUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDdkIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLGFBQWEsUUFBUSw2QkFBNkIsYUFBYSw0QkFBNEIsWUFBWSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDL0ssQ0FBQztZQUVELGdEQUFnRDtZQUNoRCxNQUFNLGFBQWEsR0FBRyxZQUFZLENBQUMsYUFBYSxDQUFDO1lBQ2pELE1BQU0sY0FBYyxHQUFRLElBQUEsd0RBQW9CLEVBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBRXRFLDJGQUEyRjtZQUMzRixNQUFNLFlBQVksR0FBRyxhQUFhLGlCQUFpQixJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQ2xFLE1BQU0sbUJBQW1CLEdBQUcsTUFBTSxJQUFBLHFEQUFxQixFQUNuRCxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsaUJBQWlCLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLGNBQWMsRUFBRSxFQUMzRyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQ3BELENBQUM7WUFFRix1REFBdUQ7WUFDdkQsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUMzQyxNQUFNLFlBQVksR0FBRyxNQUFNLElBQUEsaUVBQTZCLEVBQ3BELFFBQVEsRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxtQkFBbUIsRUFDckUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUNwRCxDQUFDO1lBRUYsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLFlBQVksQ0FBQyxXQUFXLEVBQUUsY0FBYyxFQUFFLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMzRyxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLDZDQUE2QyxRQUFRLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsMkJBQTJCLFFBQVEsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztRQUMvRixDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBemhCRCwwQ0F5aEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBhbmFseXplUHJvcGVydHksIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbiwgY29udmVydFByb3BlcnR5VmFsdWUsIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0LCByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcywgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5pbXBvcnQgeyBhcHBseVByb3BlcnR5VG9FZGl0b3IgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtZWRpdG9yLWFwcGx5JztcbmltcG9ydCB7IGF0dGFjaFNjcmlwdFRvTm9kZSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1zY3JpcHQtYXR0YWNoJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZUNvbXBvbmVudCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9jb21wb25lbnQnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBjb21wb25lbnRzIG9uIHNjZW5lIG5vZGVzLiBBY3Rpb25zOiBhZGQ9YWRkIGNvbXBvbmVudCB0byBub2RlLCByZW1vdmU9cmVtb3ZlIGNvbXBvbmVudCAodXNlIHRoZSBjaWQgb3IgdXVpZCBmcm9tIGdldF9hbGwpLCBnZXRfYWxsPWxpc3QgYWxsIGNvbXBvbmVudHMgb24gbm9kZSwgZ2V0X2luZm89Z2V0IHNwZWNpZmljIGNvbXBvbmVudCBkZXRhaWxzIGFuZCBwcm9wZXJ0aWVzLCBzZXRfcHJvcGVydHk9c2V0IGEgc2luZ2xlIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZSAoc3VwcG9ydHMgZG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIGxpa2UgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIiksIHNldF9wcm9wZXJ0aWVzX2JhdGNoPXNldCBtYW55IHByb3BlcnRpZXMgb24gb25lIGNvbXBvbmVudCBpbiBhIHNpbmdsZSBjYWxsIChlYWNoIGZpZWxkIHNldCBpbmRlcGVuZGVudGx5IOKAlCBvbmUgYmFkIGZpZWxkIGRvZXMgbm90IGFib3J0IHRoZSByZXN0KSwgYXR0YWNoX3NjcmlwdD1hdHRhY2ggYSBUeXBlU2NyaXB0L0phdmFTY3JpcHQgc2NyaXB0IGNvbXBvbmVudCwgZ2V0X2F2YWlsYWJsZT1saXN0IGF2YWlsYWJsZSBjb21wb25lbnQgdHlwZXMgYnkgY2F0ZWdvcnkuIE5PVEU6IEZvciBub2RlIGJhc2ljIHByb3BlcnRpZXMgKG5hbWUsIGFjdGl2ZSwgbGF5ZXIpIHVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3Byb3BlcnR5LiBGb3IgdHJhbnNmb3JtcyAocG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSkgdXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnYWRkJywgJ3JlbW92ZScsICdnZXRfYWxsJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfcHJvcGVydGllc19iYXRjaCcsICdhdHRhY2hfc2NyaXB0JywgJ2dldF9hdmFpbGFibGUnXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydhZGQnLCAncmVtb3ZlJywgJ2dldF9hbGwnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9wcm9wZXJ0aWVzX2JhdGNoJywgJ2F0dGFjaF9zY3JpcHQnLCAnZ2V0X2F2YWlsYWJsZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGFkZD1hZGQgY29tcG9uZW50IHRvIG5vZGUsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50ICh1c2UgdGhlIGNpZCBvciB1dWlkIGZyb20gZ2V0X2FsbCksIGdldF9hbGw9bGlzdCBhbGwgY29tcG9uZW50cywgZ2V0X2luZm89Z2V0IGNvbXBvbmVudCBkZXRhaWxzLCBzZXRfcHJvcGVydHk9c2V0IGEgc2luZ2xlIHByb3BlcnR5IHZhbHVlIChkb3R0ZWQgbmVzdGVkIHBhdGhzIHN1cHBvcnRlZCksIHNldF9wcm9wZXJ0aWVzX2JhdGNoPXNldCBtYW55IHByb3BlcnRpZXMgYXQgb25jZSwgYXR0YWNoX3NjcmlwdD1hdHRhY2ggYSBzY3JpcHQgZmlsZSwgZ2V0X2F2YWlsYWJsZT1saXN0IGF2YWlsYWJsZSB0eXBlcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZCwgcmVtb3ZlLCBnZXRfYWxsLCBnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCBhdHRhY2hfc2NyaXB0XSBUYXJnZXQgbm9kZSBVVUlELiBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPWdldF9hbGwgdG8gZmluZCBub2RlIFVVSURzLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkXSBDb21wb25lbnQgdHlwZSB0byBhZGQgKGUuZy4sIGNjLlNwcml0ZSwgY2MuTGFiZWwsIGNjLkJ1dHRvbikuIFtyZW1vdmVdIENvbXBvbmVudCBjaWQgKHRoZSB0eXBlIGZpZWxkIGZyb20gZ2V0X2FsbCDigJQgTk9UIHNjcmlwdCBuYW1lKSwgb3IgdGhlIGNvbXBvbmVudCB1dWlkIGZpZWxkIGZyb20gZ2V0X2FsbC4gW2dldF9pbmZvLCBzZXRfcHJvcGVydHldIENvbXBvbmVudCB0eXBlIHRvIHRhcmdldC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFeGFtcGxlczogY2MuTGFiZWwg4oaSIHN0cmluZywgZm9udFNpemUsIGNvbG9yOyBjYy5TcHJpdGUg4oaSIHNwcml0ZUZyYW1lLCBjb2xvcjsgY2MuVUlUcmFuc2Zvcm0g4oaSIGNvbnRlbnRTaXplLCBhbmNob3JQb2ludC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHlUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogW1xuICAgICAgICAgICAgICAgICAgICAnc3RyaW5nJywgJ251bWJlcicsICdib29sZWFuJywgJ2ludGVnZXInLCAnZmxvYXQnLFxuICAgICAgICAgICAgICAgICAgICAnY29sb3InLCAndmVjMicsICd2ZWMzJywgJ3NpemUnLFxuICAgICAgICAgICAgICAgICAgICAnbm9kZScsICdjb21wb25lbnQnLCAnc3ByaXRlRnJhbWUnLCAncHJlZmFiJywgJ2Fzc2V0JyxcbiAgICAgICAgICAgICAgICAgICAgJ25vZGVBcnJheScsICdjb2xvckFycmF5JywgJ251bWJlckFycmF5JywgJ3N0cmluZ0FycmF5J1xuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBkYXRhIHR5cGUgZm9yIGNvcnJlY3QgdmFsdWUgY29udmVyc2lvbi4gTXVzdCBtYXRjaCB0aGUgYWN0dWFsIHByb3BlcnR5IHR5cGUuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB2YWx1ZS4gRm9ybWF0IGRlcGVuZHMgb24gcHJvcGVydHlUeXBlOiBzdHJpbmc9XCJ0ZXh0XCIsIG51bWJlcj00MiwgYm9vbGVhbj10cnVlLCBjb2xvcj17XCJyXCI6MjU1LFwiZ1wiOjAsXCJiXCI6MCxcImFcIjoyNTV9IG9yIFwiI0ZGMDAwMFwiLCB2ZWMyPXtcInhcIjoxMDAsXCJ5XCI6NTB9LCB2ZWMzPXtcInhcIjoxLFwieVwiOjIsXCJ6XCI6M30sIHNpemU9e1wid2lkdGhcIjoxMDAsXCJoZWlnaHRcIjo1MH0sIG5vZGUvY29tcG9uZW50L3Nwcml0ZUZyYW1lL3ByZWZhYi9hc3NldD1cInV1aWQtc3RyaW5nXCIsIG5vZGVBcnJheT1bXCJ1dWlkMVwiLFwidXVpZDJcIl0sIGNvbG9yQXJyYXk9W3tcInJcIjoyNTUsLi4ufV0sIG51bWJlckFycmF5PVsxLDIsM10sIHN0cmluZ0FycmF5PVtcImFcIixcImJcIl0nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnRpZXNfYmF0Y2hdIEFycmF5IG9mIHByb3BlcnR5IGVudHJpZXMgdG8gc2V0IG9uIHRoZSBTQU1FIGNvbXBvbmVudCBpbiBvbmUgY2FsbC4gRWFjaCBlbnRyeToge3Byb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlfSB3aXRoIHRoZSBzYW1lIHNlbWFudGljcyBhcyBzZXRfcHJvcGVydHkuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyBwZXIgZW50cnkgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFYWNoIGVudHJ5IGlzIGFwcGxpZWQgaW5kZXBlbmRlbnRseSDigJQgYSBmYWlsdXJlIG9uIG9uZSBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgb3RoZXJzOyB0aGUgcmVzdWx0IHJlcG9ydHMgcGVyLWZpZWxkIHN1Y2Nlc3MvZXJyb3IuJyxcbiAgICAgICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdzdHJpbmcnLCAnbnVtYmVyJywgJ2Jvb2xlYW4nLCAnaW50ZWdlcicsICdmbG9hdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjb2xvcicsICd2ZWMyJywgJ3ZlYzMnLCAnc2l6ZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdub2RlJywgJ2NvbXBvbmVudCcsICdzcHJpdGVGcmFtZScsICdwcmVmYWInLCAnYXNzZXQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnbm9kZUFycmF5JywgJ2NvbG9yQXJyYXknLCAnbnVtYmVyQXJyYXknLCAnc3RyaW5nQXJyYXknXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IHZhbHVlLiBTYW1lIGZvcm1hdCBydWxlcyBhcyBzZXRfcHJvcGVydHkgdmFsdWUgKGRlcGVuZHMgb24gcHJvcGVydHlUeXBlKS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Byb3BlcnR5JywgJ3Byb3BlcnR5VHlwZScsICd2YWx1ZSddXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thdHRhY2hfc2NyaXB0XSBTY3JpcHQgYXNzZXQgcGF0aCAoZS5nLiwgZGI6Ly9hc3NldHMvc2NyaXB0cy9NeVNjcmlwdC50cyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2F0ZWdvcnk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdyZW5kZXJlcicsICd1aScsICdwaHlzaWNzJywgJ2FuaW1hdGlvbicsICdhdWRpbyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9hdmFpbGFibGVdIENvbXBvbmVudCBjYXRlZ29yeSBmaWx0ZXIuIERlZmF1bHQ6IGFsbCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGFkZDogKGFyZ3MpID0+IHRoaXMuYWRkQ29tcG9uZW50KGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIHJlbW92ZTogKGFyZ3MpID0+IHRoaXMucmVtb3ZlQ29tcG9uZW50KGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIGdldF9hbGw6IChhcmdzKSA9PiB0aGlzLmdldENvbXBvbmVudHMoYXJncy5ub2RlVXVpZCksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0Q29tcG9uZW50UHJvcGVydHkoYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0aWVzX2JhdGNoOiAoYXJncykgPT4gdGhpcy5zZXRDb21wb25lbnRQcm9wZXJ0aWVzQmF0Y2goYXJncyksXG4gICAgICAgIGF0dGFjaF9zY3JpcHQ6IChhcmdzKSA9PiBhdHRhY2hTY3JpcHRUb05vZGUoYXJncy5ub2RlVXVpZCwgYXJncy5zY3JpcHRQYXRoLCAodXVpZCkgPT4gdGhpcy5nZXRDb21wb25lbnRzKHV1aWQpKSxcbiAgICAgICAgZ2V0X2F2YWlsYWJsZTogKGFyZ3MpID0+IFByb21pc2UucmVzb2x2ZShnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdChhcmdzLmNhdGVnb3J5KSlcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRDb21wb25lbnQobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249YWRkJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hlY2sgaWYgY29tcG9uZW50IGFscmVhZHkgZXhpc3RzIG9uIG5vZGVcbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoYWxsQ29tcG9uZW50c0luZm8uc3VjY2VzcyAmJiBhbGxDb21wb25lbnRzSW5mby5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ0NvbXBvbmVudCA9IGFsbENvbXBvbmVudHNJbmZvLmRhdGEuY29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgY29tcG9uZW50VmVyaWZpZWQ6IHRydWUsIGV4aXN0aW5nOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIGFscmVhZHkgZXhpc3RzIG9uIG5vZGVgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBUcnkgYWRkaW5nIGNvbXBvbmVudCB2aWEgRWRpdG9yIEFQSSBkaXJlY3RseVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6IGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZWRpdG9yIHRvIGZpbmlzaCBhZGRpbmcgdGhlIGNvbXBvbmVudFxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuICAgICAgICAgICAgLy8gUmUtcXVlcnkgdG8gdmVyaWZ5IHRoZSBjb21wb25lbnQgd2FzIGFjdHVhbGx5IGFkZGVkXG4gICAgICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbzIgPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKGFsbENvbXBvbmVudHNJbmZvMi5zdWNjZXNzICYmIGFsbENvbXBvbmVudHNJbmZvMi5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRkZWRDb21wb25lbnQgPSBhbGxDb21wb25lbnRzSW5mbzIuZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICBpZiAoYWRkZWRDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBjb21wb25lbnRWZXJpZmllZDogdHJ1ZSwgZXhpc3Rpbmc6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBhZGRlZCBzdWNjZXNzZnVsbHlgXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIHdhcyBub3QgZm91bmQgb24gbm9kZSBhZnRlciBhZGRpdGlvbi4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YWxsQ29tcG9uZW50c0luZm8yLmRhdGEuY29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gdmVyaWZ5IGNvbXBvbmVudCBhZGRpdGlvbjogJHthbGxDb21wb25lbnRzSW5mbzIuZXJyb3IgfHwgJ1VuYWJsZSB0byBnZXQgbm9kZSBjb21wb25lbnRzJ31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2Ugc2NlbmUgc2NyaXB0XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnYWRkQ29tcG9uZW50VG9Ob2RlJyxcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW25vZGVVdWlkLCBjb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCBgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmVDb21wb25lbnQobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249cmVtb3ZlJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gR2V0IGFsbCBjb21wb25lbnRzIHNvIHdlIGNhbiByZXNvbHZlIGNvbXBvbmVudFR5cGUgdG8gdGhlIGNvbXBvbmVudCdzIE9XTiB1dWlkLlxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmICghYWxsQ29tcG9uZW50c0luZm8uc3VjY2VzcyB8fCAhYWxsQ29tcG9uZW50c0luZm8uZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudHMgZm9yIG5vZGUgJyR7bm9kZVV1aWR9JzogJHthbGxDb21wb25lbnRzSW5mby5lcnJvcn1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzOiBhbnlbXSA9IGFsbENvbXBvbmVudHNJbmZvLmRhdGEuY29tcG9uZW50cztcblxuICAgICAgICAvLyBBY2NlcHQgZWl0aGVyIHRoZSB0eXBlIGZpZWxkIChjaWQsIGUuZy4gXCJjYy5TcHJpdGVcIiBvciBhIHNjcmlwdCBjaWQpIOKAlCB0aGVcbiAgICAgICAgLy8gZXJnb25vbWljIGZvcm0g4oCUIG9yIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCwgZm9yIGNhbGxlcnMgdGhhdCBhbHJlYWR5IGhhdmUgaXQuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGFsbENvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpXG4gICAgICAgICAgICB8fCBhbGxDb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC51dWlkICYmIGNvbXAudXVpZCA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhdmFpbGFibGVUeXBlcyA9IGFsbENvbXBvbmVudHMubWFwKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSkuam9pbignLCAnKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZSAnJHtub2RlVXVpZH0nLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGVUeXBlc30uIFVzZSBhY3Rpb249Z2V0X2FsbCB0byBnZXQgdGhlIHR5cGUgZmllbGQgKGNpZCkgb3IgdXVpZCBmb3IgY29tcG9uZW50VHlwZS5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBlZGl0b3IncyAncmVtb3ZlLWNvbXBvbmVudCcgdGFrZXMgdGhlIENPTVBPTkVOVCdzIHV1aWQgKFJlbW92ZUNvbXBvbmVudE9wdGlvbnNcbiAgICAgICAgLy8gaXMgeyB1dWlkOiBzdHJpbmcgfSDigJQgaXRzIGBjb21wb25lbnRgIGZpZWxkIGlzIGFuIHVudXNlZCBwYXJhbWV0ZXIpLiBQYXNzaW5nIHRoZVxuICAgICAgICAvLyBub2RlIHV1aWQgaGVyZSBpcyB3aGF0IG1hZGUgcmVtb3ZhbCBzaWxlbnRseSBmYWlsLlxuICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gdGFyZ2V0LnV1aWQ7XG4gICAgICAgIGlmICghY29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb3VsZCBub3QgcmVzb2x2ZSB0aGUgY29tcG9uZW50IHV1aWQgZm9yICcke2NvbXBvbmVudFR5cGV9JyBvbiBub2RlICcke25vZGVVdWlkfScuIFRoZSBlZGl0b3IgcmVxdWlyZXMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIHRvIHJlbW92ZSBpdC5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZW1vdmUtY29tcG9uZW50Jywge1xuICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXBvbmVudFV1aWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgdGhlIGVkaXRvciB0byBmaW5pc2ggcmVtb3ZpbmcgdGhlIGNvbXBvbmVudFxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuICAgICAgICAgICAgLy8gUmUtcXVlcnkgdG8gY29uZmlybSByZW1vdmFsIOKAlCBtYXRjaCBvbiB0aGUgcmVzb2x2ZWQgY29tcG9uZW50IHV1aWQgc28gYSBub2RlXG4gICAgICAgICAgICAvLyBjYXJyeWluZyB0d28gY29tcG9uZW50cyBvZiB0aGUgc2FtZSB0eXBlIHJlcG9ydHMgYWNjdXJhdGVseS5cbiAgICAgICAgICAgIGNvbnN0IGFmdGVyUmVtb3ZlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgICAgICBjb25zdCBzdGlsbEV4aXN0cyA9IGFmdGVyUmVtb3ZlSW5mby5zdWNjZXNzICYmIGFmdGVyUmVtb3ZlSW5mby5kYXRhPy5jb21wb25lbnRzPy5zb21lKChjb21wOiBhbnkpID0+IGNvbXAudXVpZCA9PT0gY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICBpZiAoc3RpbGxFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgKHV1aWQgJHtjb21wb25lbnRVdWlkfSkgd2FzIG5vdCByZW1vdmVkIGZyb20gbm9kZSAnJHtub2RlVXVpZH0nLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgY29tcG9uZW50VXVpZCB9LFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyAodXVpZCAke2NvbXBvbmVudFV1aWR9KSByZW1vdmVkIHN1Y2Nlc3NmdWxseSBmcm9tIG5vZGUgJyR7bm9kZVV1aWR9J2BcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVtb3ZlIGNvbXBvbmVudDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29tcG9uZW50cyhub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1nZXRfYWxsJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSAmJiBub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gbm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBkdW1wIG5lc3RzIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCB1bmRlciB2YWx1ZS51dWlkLnZhbHVlOyB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gdG9wLWxldmVsIGNvbXAudXVpZCBkb2VzIG5vdCBleGlzdCwgc28gcmVhZCB0aGUgZHVtcCBmb3JtIGZpcnN0LlxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHRoaXMuZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcClcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCwgY29tcG9uZW50cyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3Igbm8gY29tcG9uZW50cyBkYXRhJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0Tm9kZUluZm8nLCBhcmdzOiBbbm9kZVV1aWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YS5jb21wb25lbnRzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvbXBvbmVudEluZm8obm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249Z2V0X2luZm8nKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAobm9kZURhdGEgJiYgbm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZURhdGEuX19jb21wc19fLmZpbmQoKGNvbXA6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wVHlwZSA9IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY29tcFR5cGUgPT09IGNvbXBvbmVudFR5cGU7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXBvbmVudC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wb25lbnQuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB0aGlzLmV4dHJhY3RDb21wb25lbnRQcm9wZXJ0aWVzKGNvbXBvbmVudClcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBubyBjb21wb25lbnRzIGRhdGEnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXROb2RlSW5mbycsIGFyZ3M6IFtub2RlVXVpZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MgJiYgcmVzdWx0LmRhdGEuY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSByZXN1bHQuZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudCkgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgLi4uY29tcG9uZW50IH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGVgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBnZXQgY29tcG9uZW50IGluZm8nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcG9uZW50OiBhbnkpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcbiAgICAgICAgLy8gSWYgdGhlIGNvbXBvbmVudCBoYXMgYSB2YWx1ZSBwcm9wZXJ0eSwgaXQgY29udGFpbnMgYWxsIGFjdHVhbCBjb21wb25lbnQgcHJvcGVydGllc1xuICAgICAgICBpZiAoY29tcG9uZW50LnZhbHVlICYmIHR5cGVvZiBjb21wb25lbnQudmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50LnZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIC8vIEZhbGxiYWNrOiBleHRyYWN0IHByb3BlcnRpZXMgZGlyZWN0bHkgZnJvbSB0aGUgY29tcG9uZW50IG9iamVjdFxuICAgICAgICBjb25zdCBwcm9wZXJ0aWVzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgIGNvbnN0IGV4Y2x1ZGVLZXlzID0gWydfX3R5cGVfXycsICdlbmFibGVkJywgJ25vZGUnLCAnX2lkJywgJ19fc2NyaXB0QXNzZXQnLCAndXVpZCcsICduYW1lJywgJ19uYW1lJywgJ19vYmpGbGFncycsICdfZW5hYmxlZCcsICd0eXBlJywgJ3JlYWRvbmx5JywgJ3Zpc2libGUnLCAnY2lkJywgJ2VkaXRvcicsICdleHRlbmRzJ107XG4gICAgICAgIGZvciAoY29uc3Qga2V5IGluIGNvbXBvbmVudCkge1xuICAgICAgICAgICAgaWYgKCFleGNsdWRlS2V5cy5pbmNsdWRlcyhrZXkpICYmICFrZXkuc3RhcnRzV2l0aCgnXycpKSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydGllc1trZXldID0gY29tcG9uZW50W2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHByb3BlcnRpZXM7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb21wb25lbnRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfSA9IGFyZ3M7XG5cbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSB8fCAhcHJvcGVydHkgfHwgcHJvcGVydHlUeXBlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgYW5kIHZhbHVlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0eScpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAwOiBEZXRlY3QgaWYgdXNlciBpcyB0cnlpbmcgdG8gc2V0IGEgbm9kZSBwcm9wZXJ0eTsgcmVkaXJlY3Qgd2l0aCBndWlkYW5jZVxuICAgICAgICBjb25zdCBub2RlUmVkaXJlY3RSZXN1bHQgPSByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzKTtcbiAgICAgICAgaWYgKG5vZGVSZWRpcmVjdFJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGVSZWRpcmVjdFJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMTogUmVzb2x2ZSB0aGUgdGFyZ2V0IGNvbXBvbmVudCAoYW5kIGl0cyByYXcgX19jb21wc19fIGluZGV4KSBvbmNlLlxuICAgICAgICBjb25zdCByZXNvbHV0aW9uID0gYXdhaXQgdGhpcy5yZXNvbHZlVGFyZ2V0Q29tcG9uZW50KG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSk7XG4gICAgICAgIGlmICghcmVzb2x1dGlvbi5vaykge1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdXRpb24ucmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAyOiBBcHBseSB0aGUgc2luZ2xlIHByb3BlcnR5IHVzaW5nIHRoZSBzaGFyZWQgcGVyLWZpZWxkIGxvZ2ljLlxuICAgICAgICBjb25zdCBmaWVsZFJlc3VsdCA9IGF3YWl0IHRoaXMuYXBwbHlTaW5nbGVQcm9wZXJ0eShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCByZXNvbHV0aW9uLnRhcmdldENvbXBvbmVudCwgcmVzb2x1dGlvbi5yYXdDb21wb25lbnRJbmRleCxcbiAgICAgICAgICAgIHsgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfVxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghZmllbGRSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGZpZWxkUmVzdWx0LmVycm9yIHx8IGBGYWlsZWQgdG8gc2V0IHByb3BlcnR5ICcke3Byb3BlcnR5fSdgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgIHByb3BlcnR5LFxuICAgICAgICAgICAgYWN0dWFsVmFsdWU6IGZpZWxkUmVzdWx0LmFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgY2hhbmdlVmVyaWZpZWQ6IGZpZWxkUmVzdWx0LmNoYW5nZVZlcmlmaWVkXG4gICAgICAgIH0sIGBTdWNjZXNzZnVsbHkgc2V0ICR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX1gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgbXVsdGlwbGUgcHJvcGVydGllcyBvbiBhIFNJTkdMRSBjb21wb25lbnQgaW4gb25lIGNhbGwuXG4gICAgICogVGhlIHRhcmdldCBjb21wb25lbnQgaXMgcmVzb2x2ZWQgb25jZTsgZWFjaCBwcm9wZXJ0eSBlbnRyeSBpcyB0aGVuIGFwcGxpZWRcbiAgICAgKiBpbmRlcGVuZGVudGx5IHZpYSB0aGUgc2FtZSBwZXItZmllbGQgbG9naWMgdXNlZCBieSBzZXRfcHJvcGVydHkg4oCUIHNvIGEgZmFpbHVyZVxuICAgICAqIG9uIG9uZSBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgcmVzdC4gRG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIHdvcmsgcGVyIGVudHJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2V0Q29tcG9uZW50UHJvcGVydGllc0JhdGNoKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0aWVzIH0gPSBhcmdzO1xuXG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249c2V0X3Byb3BlcnRpZXNfYmF0Y2gnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvcGVydGllcykgfHwgcHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydGllcyBtdXN0IGJlIGEgbm9uLWVtcHR5IGFycmF5IG9mIHtwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZX0gZW50cmllcyBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0aWVzX2JhdGNoJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNvbHZlIHRoZSB0YXJnZXQgY29tcG9uZW50IG9uY2UgZm9yIHRoZSB3aG9sZSBiYXRjaC5cbiAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IGF3YWl0IHRoaXMucmVzb2x2ZVRhcmdldENvbXBvbmVudChub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgdW5kZWZpbmVkKTtcbiAgICAgICAgaWYgKCFyZXNvbHV0aW9uLm9rKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x1dGlvbi5yZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHRzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHN1Y2Nlc3M6IGJvb2xlYW47IGFjdHVhbFZhbHVlPzogYW55OyBjaGFuZ2VWZXJpZmllZD86IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+ID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IGVudHJ5Py5wcm9wZXJ0eTtcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5VHlwZSA9IGVudHJ5Py5wcm9wZXJ0eVR5cGU7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGVudHJ5Py52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKCFwcm9wZXJ0eSB8fCBwcm9wZXJ0eVR5cGUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5IHx8ICcobWlzc2luZyknLFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdFYWNoIGVudHJ5IHJlcXVpcmVzIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIGFuZCB2YWx1ZSdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWVsZFJlc3VsdCA9IGF3YWl0IHRoaXMuYXBwbHlTaW5nbGVQcm9wZXJ0eShcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHJlc29sdXRpb24udGFyZ2V0Q29tcG9uZW50LCByZXNvbHV0aW9uLnJhd0NvbXBvbmVudEluZGV4LFxuICAgICAgICAgICAgICAgICAgICB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmaWVsZFJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZTogZmllbGRSZXN1bHQuYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVZlcmlmaWVkOiBmaWVsZFJlc3VsdC5jaGFuZ2VWZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGZpZWxkUmVzdWx0LmVycm9yXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIC8vIERlZmVuc2l2ZTogb25lIGJhZCBmaWVsZCBtdXN0IG5ldmVyIGFib3J0IHRoZSBiYXRjaC5cbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeyBwcm9wZXJ0eSwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnI/Lm1lc3NhZ2UgfHwgU3RyaW5nKGVycikgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdWNjZWVkZWQgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuc3VjY2VzcykubGVuZ3RoO1xuICAgICAgICBjb25zdCBmYWlsZWQgPSByZXN1bHRzLmxlbmd0aCAtIHN1Y2NlZWRlZDtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBzZXRfcHJvcGVydGllc19iYXRjaCBvbiAke2NvbXBvbmVudFR5cGV9OiAke3N1Y2NlZWRlZH0vJHtyZXN1bHRzLmxlbmd0aH0gZmllbGQocykgc2V0JHtmYWlsZWQgPiAwID8gYCwgJHtmYWlsZWR9IGZhaWxlZGAgOiAnJ31gO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgIHRvdGFsOiByZXN1bHRzLmxlbmd0aCxcbiAgICAgICAgICAgIHN1Y2NlZWRlZCxcbiAgICAgICAgICAgIGZhaWxlZCxcbiAgICAgICAgICAgIHJlc3VsdHNcbiAgICAgICAgfSwgbWVzc2FnZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSBhIGNvbXBvbmVudCBvbiBhIG5vZGUgaW50byBpdHMgZHVtcCAodGFyZ2V0Q29tcG9uZW50KSBhbmQgaXRzIHJhdyBfX2NvbXBzX18gaW5kZXguXG4gICAgICogV2hlbiBgcHJvcGVydHlgIGlzIHByb3ZpZGVkLCBhIG1pc3NpbmcgY29tcG9uZW50IHlpZWxkcyBhbiBMTE0tZnJpZW5kbHkgc3VnZ2VzdGlvbi5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVUYXJnZXRDb21wb25lbnQoXG4gICAgICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICAgICAgcHJvcGVydHk6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICk6IFByb21pc2U8XG4gICAgICAgIHwgeyBvazogdHJ1ZTsgdGFyZ2V0Q29tcG9uZW50OiBhbnk7IHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXIgfVxuICAgICAgICB8IHsgb2s6IGZhbHNlOyByZXN1bHQ6IEFjdGlvblRvb2xSZXN1bHQgfVxuICAgID4ge1xuICAgICAgICAvLyBHZXQgYWxsIGNvbXBvbmVudHMgKGR1bXAgZm9ybSkgb24gdGhlIG5vZGUuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHNSZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmICghY29tcG9uZW50c1Jlc3BvbnNlLnN1Y2Nlc3MgfHwgIWNvbXBvbmVudHNSZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHJlc3VsdDogZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgY29tcG9uZW50cyBmb3Igbm9kZSAnJHtub2RlVXVpZH0nOiAke2NvbXBvbmVudHNSZXNwb25zZS5lcnJvcn1gKSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50cyA9IGNvbXBvbmVudHNSZXNwb25zZS5kYXRhLmNvbXBvbmVudHM7XG4gICAgICAgIGxldCB0YXJnZXRDb21wb25lbnQgPSBudWxsO1xuICAgICAgICBsZXQgcmVzb2x2ZWRJbmRleCA9IC0xO1xuICAgICAgICBjb25zdCBhdmFpbGFibGVUeXBlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wID0gYWxsQ29tcG9uZW50c1tpXTtcbiAgICAgICAgICAgIGF2YWlsYWJsZVR5cGVzLnB1c2goY29tcC50eXBlKTtcbiAgICAgICAgICAgIGlmIChjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRDb21wb25lbnQgPSBjb21wO1xuICAgICAgICAgICAgICAgIHJlc29sdmVkSW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRmFsbGJhY2s6IGNvbXBvbmVudFR5cGUgbWF5IGJlIGEgcmVhZGFibGUgY2xhc3MgbmFtZSAoZS5nLiBcIk15Q29udHJvbGxlclwiKVxuICAgICAgICAvLyB3aGlsZSB0aGUgZHVtcCBvbmx5IGV4cG9zZXMgdGhlIHNjcmlwdCdzIGNpZC4gUmVzb2x2ZSB2aWEgdGhlIHNjZW5lIHNjcmlwdCxcbiAgICAgICAgLy8gd2hpY2ggaGFzIHRoZSBsaXZlIGNjLmpzIGNsYXNzIHJlZ2lzdHJ5LCB0aGVuIG1hcCBiYWNrIHRvIHRoZSBkdW1wIGNvbXBvbmVudFxuICAgICAgICAvLyBhdCB0aGUgc2FtZSBpbmRleCAocXVlcnktbm9kZSBfX2NvbXBzX18gb3JkZXIgbWF0Y2hlcyBub2RlLmNvbXBvbmVudHMgb3JkZXIpLlxuICAgICAgICBpZiAoIXRhcmdldENvbXBvbmVudCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBieU5hbWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3Jlc29sdmVDb21wb25lbnRCeU5hbWUnLCBhcmdzOiBbbm9kZVV1aWQsIGNvbXBvbmVudFR5cGVdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29uc3QgaW5kZXggPSBieU5hbWU/LnN1Y2Nlc3MgPyBieU5hbWUuZGF0YT8uaW5kZXggOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBpbmRleCA9PT0gJ251bWJlcicgJiYgaW5kZXggPj0gMCAmJiBpbmRleCA8IGFsbENvbXBvbmVudHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVkSW5kZXggPSBpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0Q29tcG9uZW50ID0gYWxsQ29tcG9uZW50c1tpbmRleF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gU2NlbmUgc2NyaXB0IHVuYXZhaWxhYmxlIOKAlCBmYWxsIHRocm91Z2ggdG8gdGhlIG5vdC1mb3VuZCBlcnJvciBiZWxvdy5cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghdGFyZ2V0Q29tcG9uZW50KSB7XG4gICAgICAgICAgICBjb25zdCBpbnN0cnVjdGlvbiA9IGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbihjb21wb25lbnRUeXBlLCBhdmFpbGFibGVUeXBlcywgcHJvcGVydHkgfHwgJycpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgICAgICAgcmVzdWx0OiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGUuIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2F2YWlsYWJsZVR5cGVzLmpvaW4oJywgJyl9YCxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gR2V0IHJhdyBub2RlIGRhdGEgdG8gYnVpbGQgdGhlIGNvcnJlY3QgX19jb21wc19fIHBhdGguXG4gICAgICAgIGNvbnN0IHJhd05vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFyYXdOb2RlRGF0YSB8fCAhcmF3Tm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHJlc3VsdDogZXJyb3JSZXN1bHQoJ0ZhaWxlZCB0byBnZXQgcmF3IG5vZGUgZGF0YSBmb3IgcHJvcGVydHkgc2V0dGluZycpIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcmF3Q29tcG9uZW50SW5kZXggPSAtMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByYXdOb2RlRGF0YS5fX2NvbXBzX18ubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSByYXdOb2RlRGF0YS5fX2NvbXBzX19baV0gYXMgYW55O1xuICAgICAgICAgICAgY29uc3QgY29tcFR5cGUgPSBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZSB8fCAnVW5rbm93bic7XG4gICAgICAgICAgICBpZiAoY29tcFR5cGUgPT09IGNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgICAgICByYXdDb21wb25lbnRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2xhc3MtbmFtZSByZXNvbHV0aW9uIHBhdGg6IHRoZSBjaWQgd29uJ3QgZXF1YWwgY29tcG9uZW50VHlwZSwgc28gcmV1c2UgdGhlXG4gICAgICAgIC8vIGluZGV4IHJlc29sdmVkIGFib3ZlIChkdW1wIG9yZGVyID09IHJhdyBfX2NvbXBzX18gb3JkZXIpLlxuICAgICAgICBpZiAocmF3Q29tcG9uZW50SW5kZXggPT09IC0xICYmIHJlc29sdmVkSW5kZXggPj0gMCAmJiByZXNvbHZlZEluZGV4IDwgcmF3Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aCkge1xuICAgICAgICAgICAgcmF3Q29tcG9uZW50SW5kZXggPSByZXNvbHZlZEluZGV4O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJhd0NvbXBvbmVudEluZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN1bHQ6IGVycm9yUmVzdWx0KCdDb3VsZCBub3QgZmluZCBjb21wb25lbnQgaW5kZXggZm9yIHNldHRpbmcgcHJvcGVydHknKSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIHRhcmdldENvbXBvbmVudCwgcmF3Q29tcG9uZW50SW5kZXggfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBcHBseSBPTkUgcHJvcGVydHkgdmFsdWUgdG8gYW4gYWxyZWFkeS1yZXNvbHZlZCBjb21wb25lbnQuXG4gICAgICogU2hhcmVkIGJ5IHNldF9wcm9wZXJ0eSAoc2luZ2xlKSBhbmQgc2V0X3Byb3BlcnRpZXNfYmF0Y2ggKHBlciBlbnRyeSkuXG4gICAgICogUmV0dXJucyBhIHBlci1maWVsZCByZXN1bHQgcmF0aGVyIHRoYW4gdGhyb3dpbmcsIHNvIGNhbGxlcnMgY2FuIGFnZ3JlZ2F0ZS5cbiAgICAgKiBEb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpIGFyZSBzdXBwb3J0ZWRcbiAgICAgKiBiZWNhdXNlIGFuYWx5emVQcm9wZXJ0eSAvIGFwcGx5UHJvcGVydHlUb0VkaXRvciAvIHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlXG4gICAgICogYWxsIHdhbGsgZG90dGVkIHNlZ21lbnRzLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgYXBwbHlTaW5nbGVQcm9wZXJ0eShcbiAgICAgICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICAgICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgICAgICB0YXJnZXRDb21wb25lbnQ6IGFueSxcbiAgICAgICAgcmF3Q29tcG9uZW50SW5kZXg6IG51bWJlcixcbiAgICAgICAgZmllbGQ6IHsgcHJvcGVydHk6IHN0cmluZzsgcHJvcGVydHlUeXBlOiBzdHJpbmc7IHZhbHVlOiBhbnkgfVxuICAgICk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBhY3R1YWxWYWx1ZT86IGFueTsgY2hhbmdlVmVyaWZpZWQ/OiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgICAgIGNvbnN0IHsgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfSA9IGZpZWxkO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtNYW5hZ2VDb21wb25lbnRdIFNldHRpbmcgJHtjb21wb25lbnRUeXBlfS4ke3Byb3BlcnR5fSAodHlwZTogJHtwcm9wZXJ0eVR5cGV9KSA9ICR7SlNPTi5zdHJpbmdpZnkodmFsdWUpfSBvbiBub2RlICR7bm9kZVV1aWR9YCk7XG5cbiAgICAgICAgICAgIC8vIEFuYWx5emUgdGhlIHByb3BlcnR5IHRvIGdldCBvcmlnaW5hbCB2YWx1ZSBhbmQgdHlwZSBpbmZvIChzdXBwb3J0cyBkb3R0ZWQgcGF0aHMpLlxuICAgICAgICAgICAgbGV0IHByb3BlcnR5SW5mbztcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcHJvcGVydHlJbmZvID0gYW5hbHl6ZVByb3BlcnR5KHRhcmdldENvbXBvbmVudCwgcHJvcGVydHkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoYW5hbHl6ZUVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gYW5hbHl6ZSBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nOiAke2FuYWx5emVFcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFwcm9wZXJ0eUluZm8uZXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBub3QgZm91bmQgb24gY29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9Jy4gQXZhaWxhYmxlIHByb3BlcnRpZXM6ICR7cHJvcGVydHlJbmZvLmF2YWlsYWJsZVByb3BlcnRpZXMuam9pbignLCAnKX1gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENvbnZlcnQgdmFsdWUgYmFzZWQgb24gZXhwbGljaXQgcHJvcGVydHlUeXBlLlxuICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxWYWx1ZSA9IHByb3BlcnR5SW5mby5vcmlnaW5hbFZhbHVlO1xuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc2VkVmFsdWU6IGFueSA9IGNvbnZlcnRQcm9wZXJ0eVZhbHVlKHByb3BlcnR5VHlwZSwgdmFsdWUpO1xuXG4gICAgICAgICAgICAvLyBCdWlsZCB0aGUgKHBvc3NpYmx5IGRvdHRlZCkgY29tcG9uZW50IHByb3BlcnR5IHBhdGggYW5kIGFwcGx5IHZpYSB0eXBlLWF3YXJlIEVkaXRvciBBUEkuXG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVBhdGggPSBgX19jb21wc19fLiR7cmF3Q29tcG9uZW50SW5kZXh9LiR7cHJvcGVydHl9YDtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbEV4cGVjdGVkVmFsdWUgPSBhd2FpdCBhcHBseVByb3BlcnR5VG9FZGl0b3IoXG4gICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgcHJvcGVydHlQYXRoLCByYXdDb21wb25lbnRJbmRleCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUsIHByb2Nlc3NlZFZhbHVlIH0sXG4gICAgICAgICAgICAgICAgKHV1aWQsIHR5cGUpID0+IHRoaXMuZ2V0Q29tcG9uZW50SW5mbyh1dWlkLCB0eXBlKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZWRpdG9yIHRvIGNvbXBsZXRlIHRoZSB1cGRhdGUsIHRoZW4gdmVyaWZ5LlxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDIwMCkpO1xuICAgICAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uID0gYXdhaXQgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UoXG4gICAgICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBvcmlnaW5hbFZhbHVlLCBhY3R1YWxFeHBlY3RlZFZhbHVlLFxuICAgICAgICAgICAgICAgICh1dWlkLCB0eXBlKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8odXVpZCwgdHlwZSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGFjdHVhbFZhbHVlOiB2ZXJpZmljYXRpb24uYWN0dWFsVmFsdWUsIGNoYW5nZVZlcmlmaWVkOiB2ZXJpZmljYXRpb24udmVyaWZpZWQgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW01hbmFnZUNvbXBvbmVudF0gRXJyb3Igc2V0dGluZyBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nOmAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBzZXQgcHJvcGVydHkgJyR7cHJvcGVydHl9JzogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19