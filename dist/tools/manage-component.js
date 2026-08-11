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
                    enum: [...manage_component_property_helpers_1.SUPPORTED_PROPERTY_TYPES],
                    description: '[set_property] Property data type for correct value conversion. Must match the actual property type. Use "asset" as the generic fallback for any Cocos asset-reference property (spriteFrame/material/texture/etc. are also accepted directly and behave identically).'
                },
                value: {
                    description: '[set_property] Property value. Format depends on propertyType: string="text", number=42, boolean=true, color={"r":255,"g":0,"b":0,"a":255} or "#FF0000", vec2={"x":100,"y":50}, vec3={"x":1,"y":2,"z":3}, size={"width":100,"height":50}, node/component/asset (or any specific asset type: spriteFrame/prefab/material/texture/spriteAtlas/audioClip/font/animationClip/mesh/skeleton/physicsMaterial/renderTexture/textAsset/jsonAsset/particleAsset/sceneAsset)="uuid-string", nodeArray=["uuid1","uuid2"], componentArray=["node-uuid1","node-uuid2"] (each a node UUID containing the target component, same as "component"), colorArray=[{"r":255,...}], numberArray=[1,2,3], stringArray=["a","b"]'
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
                                enum: [...manage_component_property_helpers_1.SUPPORTED_PROPERTY_TYPES],
                                description: 'Property data type for correct value conversion. Must match the actual property type. Use "asset" as the generic fallback for any Cocos asset-reference property (spriteFrame/material/texture/etc. are also accepted directly and behave identically).'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQTBPO0FBQzFPLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLG14QkFBbXhCLENBQUM7UUFDbHlCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTdILGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDeEgsV0FBVyxFQUFFLDJXQUEyVztpQkFDM1g7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsME9BQTBPO2lCQUMxUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdPQUF3TztpQkFDeFA7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEdBQUcsNERBQXdCLENB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O0FBL2dCRCwwQ0ErZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBhbmFseXplUHJvcGVydHksIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbiwgY29udmVydFByb3BlcnR5VmFsdWUsIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0LCByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcywgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UsIFNVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUyB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcbmltcG9ydCB7IGFwcGx5UHJvcGVydHlUb0VkaXRvciB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHknO1xuaW1wb3J0IHsgYXR0YWNoU2NyaXB0VG9Ob2RlIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXNjcmlwdC1hdHRhY2gnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlQ29tcG9uZW50IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2NvbXBvbmVudCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGNvbXBvbmVudHMgb24gc2NlbmUgbm9kZXMuIEFjdGlvbnM6IGFkZD1hZGQgY29tcG9uZW50IHRvIG5vZGUsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50ICh1c2UgdGhlIGNpZCBvciB1dWlkIGZyb20gZ2V0X2FsbCksIGdldF9hbGw9bGlzdCBhbGwgY29tcG9uZW50cyBvbiBub2RlLCBnZXRfaW5mbz1nZXQgc3BlY2lmaWMgY29tcG9uZW50IGRldGFpbHMgYW5kIHByb3BlcnRpZXMsIHNldF9wcm9wZXJ0eT1zZXQgYSBzaW5nbGUgY29tcG9uZW50IHByb3BlcnR5IHZhbHVlIChzdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgbGlrZSBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKSwgc2V0X3Byb3BlcnRpZXNfYmF0Y2g9c2V0IG1hbnkgcHJvcGVydGllcyBvbiBvbmUgY29tcG9uZW50IGluIGEgc2luZ2xlIGNhbGwgKGVhY2ggZmllbGQgc2V0IGluZGVwZW5kZW50bHkg4oCUIG9uZSBiYWQgZmllbGQgZG9lcyBub3QgYWJvcnQgdGhlIHJlc3QpLCBhdHRhY2hfc2NyaXB0PWF0dGFjaCBhIFR5cGVTY3JpcHQvSmF2YVNjcmlwdCBzY3JpcHQgY29tcG9uZW50LCBnZXRfYXZhaWxhYmxlPWxpc3QgYXZhaWxhYmxlIGNvbXBvbmVudCB0eXBlcyBieSBjYXRlZ29yeS4gTk9URTogRm9yIG5vZGUgYmFzaWMgcHJvcGVydGllcyAobmFtZSwgYWN0aXZlLCBsYXllcikgdXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfcHJvcGVydHkuIEZvciB0cmFuc2Zvcm1zIChwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB1c2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF90cmFuc2Zvcm0uJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydhZGQnLCAncmVtb3ZlJywgJ2dldF9hbGwnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9wcm9wZXJ0aWVzX2JhdGNoJywgJ2F0dGFjaF9zY3JpcHQnLCAnZ2V0X2F2YWlsYWJsZSddO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FkZCcsICdyZW1vdmUnLCAnZ2V0X2FsbCcsICdnZXRfaW5mbycsICdzZXRfcHJvcGVydHknLCAnc2V0X3Byb3BlcnRpZXNfYmF0Y2gnLCAnYXR0YWNoX3NjcmlwdCcsICdnZXRfYXZhaWxhYmxlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogYWRkPWFkZCBjb21wb25lbnQgdG8gbm9kZSwgcmVtb3ZlPXJlbW92ZSBjb21wb25lbnQgKHVzZSB0aGUgY2lkIG9yIHV1aWQgZnJvbSBnZXRfYWxsKSwgZ2V0X2FsbD1saXN0IGFsbCBjb21wb25lbnRzLCBnZXRfaW5mbz1nZXQgY29tcG9uZW50IGRldGFpbHMsIHNldF9wcm9wZXJ0eT1zZXQgYSBzaW5nbGUgcHJvcGVydHkgdmFsdWUgKGRvdHRlZCBuZXN0ZWQgcGF0aHMgc3VwcG9ydGVkKSwgc2V0X3Byb3BlcnRpZXNfYmF0Y2g9c2V0IG1hbnkgcHJvcGVydGllcyBhdCBvbmNlLCBhdHRhY2hfc2NyaXB0PWF0dGFjaCBhIHNjcmlwdCBmaWxlLCBnZXRfYXZhaWxhYmxlPWxpc3QgYXZhaWxhYmxlIHR5cGVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCByZW1vdmUsIGdldF9hbGwsIGdldF9pbmZvLCBzZXRfcHJvcGVydHksIGF0dGFjaF9zY3JpcHRdIFRhcmdldCBub2RlIFVVSUQuIFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249Z2V0X2FsbCB0byBmaW5kIG5vZGUgVVVJRHMuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRdIENvbXBvbmVudCB0eXBlIHRvIGFkZCAoZS5nLiwgY2MuU3ByaXRlLCBjYy5MYWJlbCwgY2MuQnV0dG9uKS4gW3JlbW92ZV0gQ29tcG9uZW50IGNpZCAodGhlIHR5cGUgZmllbGQgZnJvbSBnZXRfYWxsIOKAlCBOT1Qgc2NyaXB0IG5hbWUpLCBvciB0aGUgY29tcG9uZW50IHV1aWQgZmllbGQgZnJvbSBnZXRfYWxsLiBbZ2V0X2luZm8sIHNldF9wcm9wZXJ0eV0gQ29tcG9uZW50IHR5cGUgdG8gdGFyZ2V0LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZSB0byBzZXQuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuIEV4YW1wbGVzOiBjYy5MYWJlbCDihpIgc3RyaW5nLCBmb250U2l6ZSwgY29sb3I7IGNjLlNwcml0ZSDihpIgc3ByaXRlRnJhbWUsIGNvbG9yOyBjYy5VSVRyYW5zZm9ybSDihpIgY29udGVudFNpemUsIGFuY2hvclBvaW50LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbLi4uU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4gVXNlIFwiYXNzZXRcIiBhcyB0aGUgZ2VuZXJpYyBmYWxsYmFjayBmb3IgYW55IENvY29zIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eSAoc3ByaXRlRnJhbWUvbWF0ZXJpYWwvdGV4dHVyZS9ldGMuIGFyZSBhbHNvIGFjY2VwdGVkIGRpcmVjdGx5IGFuZCBiZWhhdmUgaWRlbnRpY2FsbHkpLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgdmFsdWUuIEZvcm1hdCBkZXBlbmRzIG9uIHByb3BlcnR5VHlwZTogc3RyaW5nPVwidGV4dFwiLCBudW1iZXI9NDIsIGJvb2xlYW49dHJ1ZSwgY29sb3I9e1wiclwiOjI1NSxcImdcIjowLFwiYlwiOjAsXCJhXCI6MjU1fSBvciBcIiNGRjAwMDBcIiwgdmVjMj17XCJ4XCI6MTAwLFwieVwiOjUwfSwgdmVjMz17XCJ4XCI6MSxcInlcIjoyLFwielwiOjN9LCBzaXplPXtcIndpZHRoXCI6MTAwLFwiaGVpZ2h0XCI6NTB9LCBub2RlL2NvbXBvbmVudC9hc3NldCAob3IgYW55IHNwZWNpZmljIGFzc2V0IHR5cGU6IHNwcml0ZUZyYW1lL3ByZWZhYi9tYXRlcmlhbC90ZXh0dXJlL3Nwcml0ZUF0bGFzL2F1ZGlvQ2xpcC9mb250L2FuaW1hdGlvbkNsaXAvbWVzaC9za2VsZXRvbi9waHlzaWNzTWF0ZXJpYWwvcmVuZGVyVGV4dHVyZS90ZXh0QXNzZXQvanNvbkFzc2V0L3BhcnRpY2xlQXNzZXQvc2NlbmVBc3NldCk9XCJ1dWlkLXN0cmluZ1wiLCBub2RlQXJyYXk9W1widXVpZDFcIixcInV1aWQyXCJdLCBjb21wb25lbnRBcnJheT1bXCJub2RlLXV1aWQxXCIsXCJub2RlLXV1aWQyXCJdIChlYWNoIGEgbm9kZSBVVUlEIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQsIHNhbWUgYXMgXCJjb21wb25lbnRcIiksIGNvbG9yQXJyYXk9W3tcInJcIjoyNTUsLi4ufV0sIG51bWJlckFycmF5PVsxLDIsM10sIHN0cmluZ0FycmF5PVtcImFcIixcImJcIl0nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnRpZXNfYmF0Y2hdIEFycmF5IG9mIHByb3BlcnR5IGVudHJpZXMgdG8gc2V0IG9uIHRoZSBTQU1FIGNvbXBvbmVudCBpbiBvbmUgY2FsbC4gRWFjaCBlbnRyeToge3Byb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlfSB3aXRoIHRoZSBzYW1lIHNlbWFudGljcyBhcyBzZXRfcHJvcGVydHkuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyBwZXIgZW50cnkgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFYWNoIGVudHJ5IGlzIGFwcGxpZWQgaW5kZXBlbmRlbnRseSDigJQgYSBmYWlsdXJlIG9uIG9uZSBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgb3RoZXJzOyB0aGUgcmVzdWx0IHJlcG9ydHMgcGVyLWZpZWxkIHN1Y2Nlc3MvZXJyb3IuJyxcbiAgICAgICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbLi4uU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4gVXNlIFwiYXNzZXRcIiBhcyB0aGUgZ2VuZXJpYyBmYWxsYmFjayBmb3IgYW55IENvY29zIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eSAoc3ByaXRlRnJhbWUvbWF0ZXJpYWwvdGV4dHVyZS9ldGMuIGFyZSBhbHNvIGFjY2VwdGVkIGRpcmVjdGx5IGFuZCBiZWhhdmUgaWRlbnRpY2FsbHkpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkgdmFsdWUuIFNhbWUgZm9ybWF0IHJ1bGVzIGFzIHNldF9wcm9wZXJ0eSB2YWx1ZSAoZGVwZW5kcyBvbiBwcm9wZXJ0eVR5cGUpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncHJvcGVydHknLCAncHJvcGVydHlUeXBlJywgJ3ZhbHVlJ11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NyaXB0UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2F0dGFjaF9zY3JpcHRdIFNjcmlwdCBhc3NldCBwYXRoIChlLmcuLCBkYjovL2Fzc2V0cy9zY3JpcHRzL015U2NyaXB0LnRzKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYXRlZ29yeToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWxsJywgJ3JlbmRlcmVyJywgJ3VpJywgJ3BoeXNpY3MnLCAnYW5pbWF0aW9uJywgJ2F1ZGlvJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2F2YWlsYWJsZV0gQ29tcG9uZW50IGNhdGVnb3J5IGZpbHRlci4gRGVmYXVsdDogYWxsJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgYWRkOiAoYXJncykgPT4gdGhpcy5hZGRDb21wb25lbnQoYXJncy5ub2RlVXVpZCwgYXJncy5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgcmVtb3ZlOiAoYXJncykgPT4gdGhpcy5yZW1vdmVDb21wb25lbnQoYXJncy5ub2RlVXVpZCwgYXJncy5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgZ2V0X2FsbDogKGFyZ3MpID0+IHRoaXMuZ2V0Q29tcG9uZW50cyhhcmdzLm5vZGVVdWlkKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8oYXJncy5ub2RlVXVpZCwgYXJncy5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRDb21wb25lbnRQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgc2V0X3Byb3BlcnRpZXNfYmF0Y2g6IChhcmdzKSA9PiB0aGlzLnNldENvbXBvbmVudFByb3BlcnRpZXNCYXRjaChhcmdzKSxcbiAgICAgICAgYXR0YWNoX3NjcmlwdDogKGFyZ3MpID0+IGF0dGFjaFNjcmlwdFRvTm9kZShhcmdzLm5vZGVVdWlkLCBhcmdzLnNjcmlwdFBhdGgsICh1dWlkKSA9PiB0aGlzLmdldENvbXBvbmVudHModXVpZCkpLFxuICAgICAgICBnZXRfYXZhaWxhYmxlOiAoYXJncykgPT4gUHJvbWlzZS5yZXNvbHZlKGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0KGFyZ3MuY2F0ZWdvcnkpKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGFkZENvbXBvbmVudChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1hZGQnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDaGVjayBpZiBjb21wb25lbnQgYWxyZWFkeSBleGlzdHMgb24gbm9kZVxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmIChhbGxDb21wb25lbnRzSW5mby5zdWNjZXNzICYmIGFsbENvbXBvbmVudHNJbmZvLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nQ29tcG9uZW50ID0gYWxsQ29tcG9uZW50c0luZm8uZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBjb21wb25lbnRWZXJpZmllZDogdHJ1ZSwgZXhpc3Rpbmc6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgYWxyZWFkeSBleGlzdHMgb24gbm9kZWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFRyeSBhZGRpbmcgY29tcG9uZW50IHZpYSBFZGl0b3IgQVBJIGRpcmVjdGx5XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtY29tcG9uZW50Jywge1xuICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50VHlwZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBXYWl0IGZvciBlZGl0b3IgdG8gZmluaXNoIGFkZGluZyB0aGUgY29tcG9uZW50XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSk7XG4gICAgICAgICAgICAvLyBSZS1xdWVyeSB0byB2ZXJpZnkgdGhlIGNvbXBvbmVudCB3YXMgYWN0dWFsbHkgYWRkZWRcbiAgICAgICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHNJbmZvMiA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoYWxsQ29tcG9uZW50c0luZm8yLnN1Y2Nlc3MgJiYgYWxsQ29tcG9uZW50c0luZm8yLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRlZENvbXBvbmVudCA9IGFsbENvbXBvbmVudHNJbmZvMi5kYXRhLmNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgICAgIGlmIChhZGRlZENvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIGNvbXBvbmVudFZlcmlmaWVkOiB0cnVlLCBleGlzdGluZzogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIGFkZGVkIHN1Y2Nlc3NmdWxseWBcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgd2FzIG5vdCBmb3VuZCBvbiBub2RlIGFmdGVyIGFkZGl0aW9uLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthbGxDb21wb25lbnRzSW5mbzIuZGF0YS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PiBjLnR5cGUpLmpvaW4oJywgJyl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byB2ZXJpZnkgY29tcG9uZW50IGFkZGl0aW9uOiAke2FsbENvbXBvbmVudHNJbmZvMi5lcnJvciB8fCAnVW5hYmxlIHRvIGdldCBub2RlIGNvbXBvbmVudHMnfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBzY2VuZSBzY3JpcHRcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdhZGRDb21wb25lbnRUb05vZGUnLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbbm9kZVV1aWQsIGNvbXBvbmVudFR5cGVdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8IGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZUNvbXBvbmVudChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1yZW1vdmUnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBHZXQgYWxsIGNvbXBvbmVudHMgc28gd2UgY2FuIHJlc29sdmUgY29tcG9uZW50VHlwZSB0byB0aGUgY29tcG9uZW50J3MgT1dOIHV1aWQuXG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHNJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFhbGxDb21wb25lbnRzSW5mby5zdWNjZXNzIHx8ICFhbGxDb21wb25lbnRzSW5mby5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgY29tcG9uZW50cyBmb3Igbm9kZSAnJHtub2RlVXVpZH0nOiAke2FsbENvbXBvbmVudHNJbmZvLmVycm9yfWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHM6IGFueVtdID0gYWxsQ29tcG9uZW50c0luZm8uZGF0YS5jb21wb25lbnRzO1xuXG4gICAgICAgIC8vIEFjY2VwdCBlaXRoZXIgdGhlIHR5cGUgZmllbGQgKGNpZCwgZS5nLiBcImNjLlNwcml0ZVwiIG9yIGEgc2NyaXB0IGNpZCkg4oCUIHRoZVxuICAgICAgICAvLyBlcmdvbm9taWMgZm9ybSDigJQgb3IgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkLCBmb3IgY2FsbGVycyB0aGF0IGFscmVhZHkgaGF2ZSBpdC5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gYWxsQ29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSlcbiAgICAgICAgICAgIHx8IGFsbENvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnV1aWQgJiYgY29tcC51dWlkID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGF2YWlsYWJsZVR5cGVzID0gYWxsQ29tcG9uZW50cy5tYXAoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlKS5qb2luKCcsICcpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlICcke25vZGVVdWlkfScuIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2F2YWlsYWJsZVR5cGVzfS4gVXNlIGFjdGlvbj1nZXRfYWxsIHRvIGdldCB0aGUgdHlwZSBmaWVsZCAoY2lkKSBvciB1dWlkIGZvciBjb21wb25lbnRUeXBlLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGVkaXRvcidzICdyZW1vdmUtY29tcG9uZW50JyB0YWtlcyB0aGUgQ09NUE9ORU5UJ3MgdXVpZCAoUmVtb3ZlQ29tcG9uZW50T3B0aW9uc1xuICAgICAgICAvLyBpcyB7IHV1aWQ6IHN0cmluZyB9IOKAlCBpdHMgYGNvbXBvbmVudGAgZmllbGQgaXMgYW4gdW51c2VkIHBhcmFtZXRlcikuIFBhc3NpbmcgdGhlXG4gICAgICAgIC8vIG5vZGUgdXVpZCBoZXJlIGlzIHdoYXQgbWFkZSByZW1vdmFsIHNpbGVudGx5IGZhaWwuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0YXJnZXQudXVpZDtcbiAgICAgICAgaWYgKCFjb21wb25lbnRVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvdWxkIG5vdCByZXNvbHZlIHRoZSBjb21wb25lbnQgdXVpZCBmb3IgJyR7Y29tcG9uZW50VHlwZX0nIG9uIG5vZGUgJyR7bm9kZVV1aWR9Jy4gVGhlIGVkaXRvciByZXF1aXJlcyB0aGUgY29tcG9uZW50J3Mgb3duIHV1aWQgdG8gcmVtb3ZlIGl0LmApO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogY29tcG9uZW50VXVpZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBXYWl0IGZvciB0aGUgZWRpdG9yIHRvIGZpbmlzaCByZW1vdmluZyB0aGUgY29tcG9uZW50XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSk7XG4gICAgICAgICAgICAvLyBSZS1xdWVyeSB0byBjb25maXJtIHJlbW92YWwg4oCUIG1hdGNoIG9uIHRoZSByZXNvbHZlZCBjb21wb25lbnQgdXVpZCBzbyBhIG5vZGVcbiAgICAgICAgICAgIC8vIGNhcnJ5aW5nIHR3byBjb21wb25lbnRzIG9mIHRoZSBzYW1lIHR5cGUgcmVwb3J0cyBhY2N1cmF0ZWx5LlxuICAgICAgICAgICAgY29uc3QgYWZ0ZXJSZW1vdmVJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHN0aWxsRXhpc3RzID0gYWZ0ZXJSZW1vdmVJbmZvLnN1Y2Nlc3MgJiYgYWZ0ZXJSZW1vdmVJbmZvLmRhdGE/LmNvbXBvbmVudHM/LnNvbWUoKGNvbXA6IGFueSkgPT4gY29tcC51dWlkID09PSBjb21wb25lbnRVdWlkKTtcbiAgICAgICAgICAgIGlmIChzdGlsbEV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyAodXVpZCAke2NvbXBvbmVudFV1aWR9KSB3YXMgbm90IHJlbW92ZWQgZnJvbSBub2RlICcke25vZGVVdWlkfScuYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBjb21wb25lbnRVdWlkIH0sXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nICh1dWlkICR7Y29tcG9uZW50VXVpZH0pIHJlbW92ZWQgc3VjY2Vzc2Z1bGx5IGZyb20gbm9kZSAnJHtub2RlVXVpZH0nYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZW1vdmUgY29tcG9uZW50OiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRDb21wb25lbnRzKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWdldF9hbGwnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhICYmIG5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBub2RlRGF0YS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGR1bXAgbmVzdHMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIHVuZGVyIHZhbHVlLnV1aWQudmFsdWU7IHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyB0b3AtbGV2ZWwgY29tcC51dWlkIGRvZXMgbm90IGV4aXN0LCBzbyByZWFkIHRoZSBkdW1wIGZvcm0gZmlyc3QuXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXAudmFsdWU/LnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogdGhpcy5leHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wKVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBjb21wb25lbnRzIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBubyBjb21wb25lbnRzIGRhdGEnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXROb2RlSW5mbycsIGFyZ3M6IFtub2RlVXVpZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLmNvbXBvbmVudHMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8IGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1nZXRfaW5mbycpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSAmJiBub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlRGF0YS5fX2NvbXBzX18uZmluZCgoY29tcDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb21wVHlwZSA9PT0gY29tcG9uZW50VHlwZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcG9uZW50LmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXBvbmVudC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHRoaXMuZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcG9uZW50KVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ05vZGUgbm90IGZvdW5kIG9yIG5vIGNvbXBvbmVudHMgZGF0YScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldE5vZGVJbmZvJywgYXJnczogW25vZGVVdWlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcyAmJiByZXN1bHQuZGF0YS5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHJlc3VsdC5kYXRhLmNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50KSByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCAuLi5jb21wb25lbnQgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBjb21wb25lbnQgaW5mbycpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wb25lbnQ6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgICAgICAvLyBJZiB0aGUgY29tcG9uZW50IGhhcyBhIHZhbHVlIHByb3BlcnR5LCBpdCBjb250YWlucyBhbGwgYWN0dWFsIGNvbXBvbmVudCBwcm9wZXJ0aWVzXG4gICAgICAgIGlmIChjb21wb25lbnQudmFsdWUgJiYgdHlwZW9mIGNvbXBvbmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnQudmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRmFsbGJhY2s6IGV4dHJhY3QgcHJvcGVydGllcyBkaXJlY3RseSBmcm9tIHRoZSBjb21wb25lbnQgb2JqZWN0XG4gICAgICAgIGNvbnN0IHByb3BlcnRpZXM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgY29uc3QgZXhjbHVkZUtleXMgPSBbJ19fdHlwZV9fJywgJ2VuYWJsZWQnLCAnbm9kZScsICdfaWQnLCAnX19zY3JpcHRBc3NldCcsICd1dWlkJywgJ25hbWUnLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19lbmFibGVkJywgJ3R5cGUnLCAncmVhZG9ubHknLCAndmlzaWJsZScsICdjaWQnLCAnZWRpdG9yJywgJ2V4dGVuZHMnXTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gY29tcG9uZW50KSB7XG4gICAgICAgICAgICBpZiAoIWV4Y2x1ZGVLZXlzLmluY2x1ZGVzKGtleSkgJiYgIWtleS5zdGFydHNXaXRoKCdfJykpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW2tleV0gPSBjb21wb25lbnRba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJvcGVydGllcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldENvbXBvbmVudFByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9ID0gYXJncztcblxuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlIHx8ICFwcm9wZXJ0eSB8fCBwcm9wZXJ0eVR5cGUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249c2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDA6IERldGVjdCBpZiB1c2VyIGlzIHRyeWluZyB0byBzZXQgYSBub2RlIHByb3BlcnR5OyByZWRpcmVjdCB3aXRoIGd1aWRhbmNlXG4gICAgICAgIGNvbnN0IG5vZGVSZWRpcmVjdFJlc3VsdCA9IHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzKGFyZ3MpO1xuICAgICAgICBpZiAobm9kZVJlZGlyZWN0UmVzdWx0KSB7XG4gICAgICAgICAgICByZXR1cm4gbm9kZVJlZGlyZWN0UmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAxOiBSZXNvbHZlIHRoZSB0YXJnZXQgY29tcG9uZW50IChhbmQgaXRzIHJhdyBfX2NvbXBzX18gaW5kZXgpIG9uY2UuXG4gICAgICAgIGNvbnN0IHJlc29sdXRpb24gPSBhd2FpdCB0aGlzLnJlc29sdmVUYXJnZXRDb21wb25lbnQobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5KTtcbiAgICAgICAgaWYgKCFyZXNvbHV0aW9uLm9rKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x1dGlvbi5yZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDI6IEFwcGx5IHRoZSBzaW5nbGUgcHJvcGVydHkgdXNpbmcgdGhlIHNoYXJlZCBwZXItZmllbGQgbG9naWMuXG4gICAgICAgIGNvbnN0IGZpZWxkUmVzdWx0ID0gYXdhaXQgdGhpcy5hcHBseVNpbmdsZVByb3BlcnR5KFxuICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHJlc29sdXRpb24udGFyZ2V0Q29tcG9uZW50LCByZXNvbHV0aW9uLnJhd0NvbXBvbmVudEluZGV4LFxuICAgICAgICAgICAgeyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9XG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKCFmaWVsZFJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZmllbGRSZXN1bHQuZXJyb3IgfHwgYEZhaWxlZCB0byBzZXQgcHJvcGVydHkgJyR7cHJvcGVydHl9J2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgcHJvcGVydHksXG4gICAgICAgICAgICBhY3R1YWxWYWx1ZTogZmllbGRSZXN1bHQuYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICBjaGFuZ2VWZXJpZmllZDogZmllbGRSZXN1bHQuY2hhbmdlVmVyaWZpZWRcbiAgICAgICAgfSwgYFN1Y2Nlc3NmdWxseSBzZXQgJHtjb21wb25lbnRUeXBlfS4ke3Byb3BlcnR5fWApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBtdWx0aXBsZSBwcm9wZXJ0aWVzIG9uIGEgU0lOR0xFIGNvbXBvbmVudCBpbiBvbmUgY2FsbC5cbiAgICAgKiBUaGUgdGFyZ2V0IGNvbXBvbmVudCBpcyByZXNvbHZlZCBvbmNlOyBlYWNoIHByb3BlcnR5IGVudHJ5IGlzIHRoZW4gYXBwbGllZFxuICAgICAqIGluZGVwZW5kZW50bHkgdmlhIHRoZSBzYW1lIHBlci1maWVsZCBsb2dpYyB1c2VkIGJ5IHNldF9wcm9wZXJ0eSDigJQgc28gYSBmYWlsdXJlXG4gICAgICogb24gb25lIGZpZWxkIGRvZXMgbm90IGFib3J0IHRoZSByZXN0LiBEb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgd29yayBwZXIgZW50cnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb21wb25lbnRQcm9wZXJ0aWVzQmF0Y2goYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnRpZXMgfSA9IGFyZ3M7XG5cbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1zZXRfcHJvcGVydGllc19iYXRjaCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcm9wZXJ0aWVzKSB8fCBwcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0aWVzIG11c3QgYmUgYSBub24tZW1wdHkgYXJyYXkgb2Yge3Byb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlfSBlbnRyaWVzIGZvciBhY3Rpb249c2V0X3Byb3BlcnRpZXNfYmF0Y2gnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgdGhlIHRhcmdldCBjb21wb25lbnQgb25jZSBmb3IgdGhlIHdob2xlIGJhdGNoLlxuICAgICAgICBjb25zdCByZXNvbHV0aW9uID0gYXdhaXQgdGhpcy5yZXNvbHZlVGFyZ2V0Q29tcG9uZW50KG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCB1bmRlZmluZWQpO1xuICAgICAgICBpZiAoIXJlc29sdXRpb24ub2spIHtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHV0aW9uLnJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdHM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgc3VjY2VzczogYm9vbGVhbjsgYWN0dWFsVmFsdWU/OiBhbnk7IGNoYW5nZVZlcmlmaWVkPzogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4gPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5ID0gZW50cnk/LnByb3BlcnR5O1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlUeXBlID0gZW50cnk/LnByb3BlcnR5VHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gZW50cnk/LnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoIXByb3BlcnR5IHx8IHByb3BlcnR5VHlwZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHkgfHwgJyhtaXNzaW5nKScsXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0VhY2ggZW50cnkgcmVxdWlyZXMgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgYW5kIHZhbHVlJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpZWxkUmVzdWx0ID0gYXdhaXQgdGhpcy5hcHBseVNpbmdsZVByb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcmVzb2x1dGlvbi50YXJnZXRDb21wb25lbnQsIHJlc29sdXRpb24ucmF3Q29tcG9uZW50SW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIHsgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZpZWxkUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlOiBmaWVsZFJlc3VsdC5hY3R1YWxWYWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlVmVyaWZpZWQ6IGZpZWxkUmVzdWx0LmNoYW5nZVZlcmlmaWVkLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogZmllbGRSZXN1bHQuZXJyb3JcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgLy8gRGVmZW5zaXZlOiBvbmUgYmFkIGZpZWxkIG11c3QgbmV2ZXIgYWJvcnQgdGhlIGJhdGNoLlxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb3BlcnR5LCBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycj8ubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1Y2NlZWRlZCA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGZhaWxlZCA9IHJlc3VsdHMubGVuZ3RoIC0gc3VjY2VlZGVkO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gYHNldF9wcm9wZXJ0aWVzX2JhdGNoIG9uICR7Y29tcG9uZW50VHlwZX06ICR7c3VjY2VlZGVkfS8ke3Jlc3VsdHMubGVuZ3RofSBmaWVsZChzKSBzZXQke2ZhaWxlZCA+IDAgPyBgLCAke2ZhaWxlZH0gZmFpbGVkYCA6ICcnfWA7XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgdG90YWw6IHJlc3VsdHMubGVuZ3RoLFxuICAgICAgICAgICAgc3VjY2VlZGVkLFxuICAgICAgICAgICAgZmFpbGVkLFxuICAgICAgICAgICAgcmVzdWx0c1xuICAgICAgICB9LCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIGEgY29tcG9uZW50IG9uIGEgbm9kZSBpbnRvIGl0cyBkdW1wICh0YXJnZXRDb21wb25lbnQpIGFuZCBpdHMgcmF3IF9fY29tcHNfXyBpbmRleC5cbiAgICAgKiBXaGVuIGBwcm9wZXJ0eWAgaXMgcHJvdmlkZWQsIGEgbWlzc2luZyBjb21wb25lbnQgeWllbGRzIGFuIExMTS1mcmllbmRseSBzdWdnZXN0aW9uLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVRhcmdldENvbXBvbmVudChcbiAgICAgICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICAgICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgICAgICBwcm9wZXJ0eTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgKTogUHJvbWlzZTxcbiAgICAgICAgfCB7IG9rOiB0cnVlOyB0YXJnZXRDb21wb25lbnQ6IGFueTsgcmF3Q29tcG9uZW50SW5kZXg6IG51bWJlciB9XG4gICAgICAgIHwgeyBvazogZmFsc2U7IHJlc3VsdDogQWN0aW9uVG9vbFJlc3VsdCB9XG4gICAgPiB7XG4gICAgICAgIC8vIEdldCBhbGwgY29tcG9uZW50cyAoZHVtcCBmb3JtKSBvbiB0aGUgbm9kZS5cbiAgICAgICAgY29uc3QgY29tcG9uZW50c1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFjb21wb25lbnRzUmVzcG9uc2Uuc3VjY2VzcyB8fCAhY29tcG9uZW50c1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBjb21wb25lbnRzIGZvciBub2RlICcke25vZGVVdWlkfSc6ICR7Y29tcG9uZW50c1Jlc3BvbnNlLmVycm9yfWApIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzID0gY29tcG9uZW50c1Jlc3BvbnNlLmRhdGEuY29tcG9uZW50cztcbiAgICAgICAgbGV0IHRhcmdldENvbXBvbmVudCA9IG51bGw7XG4gICAgICAgIGxldCByZXNvbHZlZEluZGV4ID0gLTE7XG4gICAgICAgIGNvbnN0IGF2YWlsYWJsZVR5cGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBhbGxDb21wb25lbnRzW2ldO1xuICAgICAgICAgICAgYXZhaWxhYmxlVHlwZXMucHVzaChjb21wLnR5cGUpO1xuICAgICAgICAgICAgaWYgKGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbXBvbmVudCA9IGNvbXA7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZWRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGYWxsYmFjazogY29tcG9uZW50VHlwZSBtYXkgYmUgYSByZWFkYWJsZSBjbGFzcyBuYW1lIChlLmcuIFwiTXlDb250cm9sbGVyXCIpXG4gICAgICAgIC8vIHdoaWxlIHRoZSBkdW1wIG9ubHkgZXhwb3NlcyB0aGUgc2NyaXB0J3MgY2lkLiBSZXNvbHZlIHZpYSB0aGUgc2NlbmUgc2NyaXB0LFxuICAgICAgICAvLyB3aGljaCBoYXMgdGhlIGxpdmUgY2MuanMgY2xhc3MgcmVnaXN0cnksIHRoZW4gbWFwIGJhY2sgdG8gdGhlIGR1bXAgY29tcG9uZW50XG4gICAgICAgIC8vIGF0IHRoZSBzYW1lIGluZGV4IChxdWVyeS1ub2RlIF9fY29tcHNfXyBvcmRlciBtYXRjaGVzIG5vZGUuY29tcG9uZW50cyBvcmRlcikuXG4gICAgICAgIGlmICghdGFyZ2V0Q29tcG9uZW50KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ5TmFtZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAncmVzb2x2ZUNvbXBvbmVudEJ5TmFtZScsIGFyZ3M6IFtub2RlVXVpZCwgY29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IGJ5TmFtZT8uc3VjY2VzcyA/IGJ5TmFtZS5kYXRhPy5pbmRleCA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJyAmJiBpbmRleCA+PSAwICYmIGluZGV4IDwgYWxsQ29tcG9uZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWRJbmRleCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb21wb25lbnQgPSBhbGxDb21wb25lbnRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAvLyBTY2VuZSBzY3JpcHQgdW5hdmFpbGFibGUg4oCUIGZhbGwgdGhyb3VnaCB0byB0aGUgbm90LWZvdW5kIGVycm9yIGJlbG93LlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0YXJnZXRDb21wb25lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uKGNvbXBvbmVudFR5cGUsIGF2YWlsYWJsZVR5cGVzLCBwcm9wZXJ0eSB8fCAnJyk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICByZXN1bHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZS4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlVHlwZXMuam9pbignLCAnKX1gLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZXQgcmF3IG5vZGUgZGF0YSB0byBidWlsZCB0aGUgY29ycmVjdCBfX2NvbXBzX18gcGF0aC5cbiAgICAgICAgY29uc3QgcmF3Tm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICBpZiAoIXJhd05vZGVEYXRhIHx8ICFyYXdOb2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCByYXcgbm9kZSBkYXRhIGZvciBwcm9wZXJ0eSBzZXR0aW5nJykgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByYXdDb21wb25lbnRJbmRleCA9IC0xO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJhd05vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IHJhd05vZGVEYXRhLl9fY29tcHNfX1tpXSBhcyBhbnk7XG4gICAgICAgICAgICBjb25zdCBjb21wVHlwZSA9IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJztcbiAgICAgICAgICAgIGlmIChjb21wVHlwZSA9PT0gY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgICAgIHJhd0NvbXBvbmVudEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBDbGFzcy1uYW1lIHJlc29sdXRpb24gcGF0aDogdGhlIGNpZCB3b24ndCBlcXVhbCBjb21wb25lbnRUeXBlLCBzbyByZXVzZSB0aGVcbiAgICAgICAgLy8gaW5kZXggcmVzb2x2ZWQgYWJvdmUgKGR1bXAgb3JkZXIgPT0gcmF3IF9fY29tcHNfXyBvcmRlcikuXG4gICAgICAgIGlmIChyYXdDb21wb25lbnRJbmRleCA9PT0gLTEgJiYgcmVzb2x2ZWRJbmRleCA+PSAwICYmIHJlc29sdmVkSW5kZXggPCByYXdOb2RlRGF0YS5fX2NvbXBzX18ubGVuZ3RoKSB7XG4gICAgICAgICAgICByYXdDb21wb25lbnRJbmRleCA9IHJlc29sdmVkSW5kZXg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmF3Q29tcG9uZW50SW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHJlc3VsdDogZXJyb3JSZXN1bHQoJ0NvdWxkIG5vdCBmaW5kIGNvbXBvbmVudCBpbmRleCBmb3Igc2V0dGluZyBwcm9wZXJ0eScpIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBvazogdHJ1ZSwgdGFyZ2V0Q29tcG9uZW50LCByYXdDb21wb25lbnRJbmRleCB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IE9ORSBwcm9wZXJ0eSB2YWx1ZSB0byBhbiBhbHJlYWR5LXJlc29sdmVkIGNvbXBvbmVudC5cbiAgICAgKiBTaGFyZWQgYnkgc2V0X3Byb3BlcnR5IChzaW5nbGUpIGFuZCBzZXRfcHJvcGVydGllc19iYXRjaCAocGVyIGVudHJ5KS5cbiAgICAgKiBSZXR1cm5zIGEgcGVyLWZpZWxkIHJlc3VsdCByYXRoZXIgdGhhbiB0aHJvd2luZywgc28gY2FsbGVycyBjYW4gYWdncmVnYXRlLlxuICAgICAqIERvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikgYXJlIHN1cHBvcnRlZFxuICAgICAqIGJlY2F1c2UgYW5hbHl6ZVByb3BlcnR5IC8gYXBwbHlQcm9wZXJ0eVRvRWRpdG9yIC8gdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2VcbiAgICAgKiBhbGwgd2FsayBkb3R0ZWQgc2VnbWVudHMuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBhcHBseVNpbmdsZVByb3BlcnR5KFxuICAgICAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgICAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgIHRhcmdldENvbXBvbmVudDogYW55LFxuICAgICAgICByYXdDb21wb25lbnRJbmRleDogbnVtYmVyLFxuICAgICAgICBmaWVsZDogeyBwcm9wZXJ0eTogc3RyaW5nOyBwcm9wZXJ0eVR5cGU6IHN0cmluZzsgdmFsdWU6IGFueSB9XG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGFjdHVhbFZhbHVlPzogYW55OyBjaGFuZ2VWZXJpZmllZD86IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+IHtcbiAgICAgICAgY29uc3QgeyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9ID0gZmllbGQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW01hbmFnZUNvbXBvbmVudF0gU2V0dGluZyAke2NvbXBvbmVudFR5cGV9LiR7cHJvcGVydHl9ICh0eXBlOiAke3Byb3BlcnR5VHlwZX0pID0gJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9IG9uIG5vZGUgJHtub2RlVXVpZH1gKTtcblxuICAgICAgICAgICAgLy8gQW5hbHl6ZSB0aGUgcHJvcGVydHkgdG8gZ2V0IG9yaWdpbmFsIHZhbHVlIGFuZCB0eXBlIGluZm8gKHN1cHBvcnRzIGRvdHRlZCBwYXRocykuXG4gICAgICAgICAgICBsZXQgcHJvcGVydHlJbmZvO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUluZm8gPSBhbmFseXplUHJvcGVydHkodGFyZ2V0Q29tcG9uZW50LCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICB9IGNhdGNoIChhbmFseXplRXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBhbmFseXplIHByb3BlcnR5ICcke3Byb3BlcnR5fSc6ICR7YW5hbHl6ZUVycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXByb3BlcnR5SW5mby5leGlzdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBmb3VuZCBvbiBjb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nLiBBdmFpbGFibGUgcHJvcGVydGllczogJHtwcm9wZXJ0eUluZm8uYXZhaWxhYmxlUHJvcGVydGllcy5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ29udmVydCB2YWx1ZSBiYXNlZCBvbiBleHBsaWNpdCBwcm9wZXJ0eVR5cGUuXG4gICAgICAgICAgICBjb25zdCBvcmlnaW5hbFZhbHVlID0gcHJvcGVydHlJbmZvLm9yaWdpbmFsVmFsdWU7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzZWRWYWx1ZTogYW55ID0gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlLCB2YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIEJ1aWxkIHRoZSAocG9zc2libHkgZG90dGVkKSBjb21wb25lbnQgcHJvcGVydHkgcGF0aCBhbmQgYXBwbHkgdmlhIHR5cGUtYXdhcmUgRWRpdG9yIEFQSS5cbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5UGF0aCA9IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0uJHtwcm9wZXJ0eX1gO1xuICAgICAgICAgICAgY29uc3QgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5UHJvcGVydHlUb0VkaXRvcihcbiAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIHJhd0NvbXBvbmVudEluZGV4LCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSwgcHJvY2Vzc2VkVmFsdWUgfSxcbiAgICAgICAgICAgICAgICAodXVpZCwgdHlwZSkgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKHV1aWQsIHR5cGUpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBlZGl0b3IgdG8gY29tcGxldGUgdGhlIHVwZGF0ZSwgdGhlbiB2ZXJpZnkuXG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMjAwKSk7XG4gICAgICAgICAgICBjb25zdCB2ZXJpZmljYXRpb24gPSBhd2FpdCB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZShcbiAgICAgICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIG9yaWdpbmFsVmFsdWUsIGFjdHVhbEV4cGVjdGVkVmFsdWUsXG4gICAgICAgICAgICAgICAgKHV1aWQsIHR5cGUpID0+IHRoaXMuZ2V0Q29tcG9uZW50SW5mbyh1dWlkLCB0eXBlKVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgYWN0dWFsVmFsdWU6IHZlcmlmaWNhdGlvbi5hY3R1YWxWYWx1ZSwgY2hhbmdlVmVyaWZpZWQ6IHZlcmlmaWNhdGlvbi52ZXJpZmllZCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFuYWdlQ29tcG9uZW50XSBFcnJvciBzZXR0aW5nIHByb3BlcnR5ICcke3Byb3BlcnR5fSc6YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHNldCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG59XG4iXX0=