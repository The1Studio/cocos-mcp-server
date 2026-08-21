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
    /**
     * Match a dump component against whatever spelling the caller used.
     *
     * `create-component` accepts a readable class name, but `query-node` lists a custom
     * `@ccclass` script under its COMPRESSED CID (the first five hex characters of the
     * script asset uuid plus a base64 tail), so `comp.type === 'MyController'` is never
     * true for a project script. The readable name survives in exactly one place in the
     * dump — `value.name`, formatted `${nodeName}<${className}>`.
     *
     * Built-in components are unaffected: `cc.Sprite` matches on `type` as before.
     */
    static matchesComponent(comp, componentType) {
        var _a, _b;
        if (comp.type === componentType)
            return true;
        if (comp.uuid && comp.uuid === componentType)
            return true;
        const dumpName = (_b = (_a = comp.properties) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.value;
        return typeof dumpName === 'string' && dumpName.endsWith(`<${componentType}>`);
    }
    /** The identity a caller needs for every FOLLOW-UP call: get_info, set_property, remove. */
    static componentIdentity(nodeUuid, componentType, comp) {
        var _a, _b;
        return {
            nodeUuid,
            componentType,
            // The cid, which is what every other action on this tool expects. Returning it
            // saves the caller a get_all round-trip just to translate their own class name.
            resolvedType: (_a = comp === null || comp === void 0 ? void 0 : comp.type) !== null && _a !== void 0 ? _a : componentType,
            componentUuid: (_b = comp === null || comp === void 0 ? void 0 : comp.uuid) !== null && _b !== void 0 ? _b : null,
            componentVerified: true
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
            const existingComponent = allComponentsInfo.data.components.find((comp) => ManageComponent.matchesComponent(comp, componentType));
            if (existingComponent) {
                return (0, types_1.successResult)(Object.assign(Object.assign({}, ManageComponent.componentIdentity(nodeUuid, componentType, existingComponent)), { existing: true }), `Component '${componentType}' already exists on node`);
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
                const addedComponent = allComponentsInfo2.data.components.find((comp) => ManageComponent.matchesComponent(comp, componentType));
                if (addedComponent) {
                    return (0, types_1.successResult)(Object.assign(Object.assign({}, ManageComponent.componentIdentity(nodeUuid, componentType, addedComponent)), { existing: false }), `Component '${componentType}' added successfully`);
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
            // Look up by the RESOLVED dump type (targetComponent.type — a cid when
            // componentType was a class name resolved via resolveComponentByName),
            // not the caller-supplied componentType: getComponentInfo matches against
            // the dump's __type__/cid, which never equals a readable class name, so
            // verification would always report unverified for the class-name path.
            const verification = await (0, manage_component_property_helpers_1.verifyComponentPropertyChange)(nodeUuid, targetComponent.type || componentType, property, originalValue, actualExpectedValue, (uuid, type) => this.getComponentInfo(uuid, type));
            if (!verification.verified) {
                return {
                    success: false,
                    actualValue: verification.actualValue,
                    changeVerified: false,
                    error: `Property '${componentType}.${property}' write did not verify: expected ${JSON.stringify(actualExpectedValue)} but the editor reads back ${JSON.stringify(verification.actualValue)}`
                };
            }
            return { success: true, actualValue: verification.actualValue, changeVerified: true };
        }
        catch (error) {
            console.error(`[ManageComponent] Error setting property '${property}':`, error);
            return { success: false, error: `Failed to set property '${property}': ${error.message}` };
        }
    }
}
exports.ManageComponent = ManageComponent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQTBPO0FBQzFPLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLG14QkFBbXhCLENBQUM7UUFDbHlCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTdILGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDeEgsV0FBVyxFQUFFLDJXQUEyVztpQkFDM1g7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsME9BQTBPO2lCQUMxUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdPQUF3TztpQkFDeFA7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEdBQUcsNERBQXdCLENB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RUFBRSwyQkFBMkIsUUFBUSxNQUFNLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1FBQy9GLENBQUM7SUFDTCxDQUFDO0NBRUo7QUFoa0JELDBDQWdrQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IGFuYWx5emVQcm9wZXJ0eSwgZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uLCBjb252ZXJ0UHJvcGVydHlWYWx1ZSwgZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QsIHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzLCB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZSwgU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByb3BlcnR5LWhlbHBlcnMnO1xuaW1wb3J0IHsgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LWVkaXRvci1hcHBseSc7XG5pbXBvcnQgeyBhdHRhY2hTY3JpcHRUb05vZGUgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtc2NyaXB0LWF0dGFjaCc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VDb21wb25lbnQgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfY29tcG9uZW50JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgY29tcG9uZW50cyBvbiBzY2VuZSBub2Rlcy4gQWN0aW9uczogYWRkPWFkZCBjb21wb25lbnQgdG8gbm9kZSwgcmVtb3ZlPXJlbW92ZSBjb21wb25lbnQgKHVzZSB0aGUgY2lkIG9yIHV1aWQgZnJvbSBnZXRfYWxsKSwgZ2V0X2FsbD1saXN0IGFsbCBjb21wb25lbnRzIG9uIG5vZGUsIGdldF9pbmZvPWdldCBzcGVjaWZpYyBjb21wb25lbnQgZGV0YWlscyBhbmQgcHJvcGVydGllcywgc2V0X3Byb3BlcnR5PXNldCBhIHNpbmdsZSBjb21wb25lbnQgcHJvcGVydHkgdmFsdWUgKHN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyBsaWtlIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLCBzZXRfcHJvcGVydGllc19iYXRjaD1zZXQgbWFueSBwcm9wZXJ0aWVzIG9uIG9uZSBjb21wb25lbnQgaW4gYSBzaW5nbGUgY2FsbCAoZWFjaCBmaWVsZCBzZXQgaW5kZXBlbmRlbnRseSDigJQgb25lIGJhZCBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgcmVzdCksIGF0dGFjaF9zY3JpcHQ9YXR0YWNoIGEgVHlwZVNjcmlwdC9KYXZhU2NyaXB0IHNjcmlwdCBjb21wb25lbnQsIGdldF9hdmFpbGFibGU9bGlzdCBhdmFpbGFibGUgY29tcG9uZW50IHR5cGVzIGJ5IGNhdGVnb3J5LiBOT1RFOiBGb3Igbm9kZSBiYXNpYyBwcm9wZXJ0aWVzIChuYW1lLCBhY3RpdmUsIGxheWVyKSB1c2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF9wcm9wZXJ0eS4gRm9yIHRyYW5zZm9ybXMgKHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUpIHVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3RyYW5zZm9ybS4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2FkZCcsICdyZW1vdmUnLCAnZ2V0X2FsbCcsICdnZXRfaW5mbycsICdzZXRfcHJvcGVydHknLCAnc2V0X3Byb3BlcnRpZXNfYmF0Y2gnLCAnYXR0YWNoX3NjcmlwdCcsICdnZXRfYXZhaWxhYmxlJ107XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWRkJywgJ3JlbW92ZScsICdnZXRfYWxsJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfcHJvcGVydGllc19iYXRjaCcsICdhdHRhY2hfc2NyaXB0JywgJ2dldF9hdmFpbGFibGUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBhZGQ9YWRkIGNvbXBvbmVudCB0byBub2RlLCByZW1vdmU9cmVtb3ZlIGNvbXBvbmVudCAodXNlIHRoZSBjaWQgb3IgdXVpZCBmcm9tIGdldF9hbGwpLCBnZXRfYWxsPWxpc3QgYWxsIGNvbXBvbmVudHMsIGdldF9pbmZvPWdldCBjb21wb25lbnQgZGV0YWlscywgc2V0X3Byb3BlcnR5PXNldCBhIHNpbmdsZSBwcm9wZXJ0eSB2YWx1ZSAoZG90dGVkIG5lc3RlZCBwYXRocyBzdXBwb3J0ZWQpLCBzZXRfcHJvcGVydGllc19iYXRjaD1zZXQgbWFueSBwcm9wZXJ0aWVzIGF0IG9uY2UsIGF0dGFjaF9zY3JpcHQ9YXR0YWNoIGEgc2NyaXB0IGZpbGUsIGdldF9hdmFpbGFibGU9bGlzdCBhdmFpbGFibGUgdHlwZXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGQsIHJlbW92ZSwgZ2V0X2FsbCwgZ2V0X2luZm8sIHNldF9wcm9wZXJ0eSwgYXR0YWNoX3NjcmlwdF0gVGFyZ2V0IG5vZGUgVVVJRC4gVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1nZXRfYWxsIHRvIGZpbmQgbm9kZSBVVUlEcy4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF0gQ29tcG9uZW50IHR5cGUgdG8gYWRkIChlLmcuLCBjYy5TcHJpdGUsIGNjLkxhYmVsLCBjYy5CdXR0b24pLiBbcmVtb3ZlXSBDb21wb25lbnQgY2lkICh0aGUgdHlwZSBmaWVsZCBmcm9tIGdldF9hbGwg4oCUIE5PVCBzY3JpcHQgbmFtZSksIG9yIHRoZSBjb21wb25lbnQgdXVpZCBmaWVsZCBmcm9tIGdldF9hbGwuIFtnZXRfaW5mbywgc2V0X3Byb3BlcnR5XSBDb21wb25lbnQgdHlwZSB0byB0YXJnZXQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lIHRvIHNldC4gU3VwcG9ydHMgZG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKS4gRXhhbXBsZXM6IGNjLkxhYmVsIOKGkiBzdHJpbmcsIGZvbnRTaXplLCBjb2xvcjsgY2MuU3ByaXRlIOKGkiBzcHJpdGVGcmFtZSwgY29sb3I7IGNjLlVJVHJhbnNmb3JtIOKGkiBjb250ZW50U2l6ZSwgYW5jaG9yUG9pbnQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnR5VHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsuLi5TVVBQT1JURURfUFJPUEVSVFlfVFlQRVNdLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgZGF0YSB0eXBlIGZvciBjb3JyZWN0IHZhbHVlIGNvbnZlcnNpb24uIE11c3QgbWF0Y2ggdGhlIGFjdHVhbCBwcm9wZXJ0eSB0eXBlLiBVc2UgXCJhc3NldFwiIGFzIHRoZSBnZW5lcmljIGZhbGxiYWNrIGZvciBhbnkgQ29jb3MgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5IChzcHJpdGVGcmFtZS9tYXRlcmlhbC90ZXh0dXJlL2V0Yy4gYXJlIGFsc28gYWNjZXB0ZWQgZGlyZWN0bHkgYW5kIGJlaGF2ZSBpZGVudGljYWxseSkuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB2YWx1ZS4gRm9ybWF0IGRlcGVuZHMgb24gcHJvcGVydHlUeXBlOiBzdHJpbmc9XCJ0ZXh0XCIsIG51bWJlcj00MiwgYm9vbGVhbj10cnVlLCBjb2xvcj17XCJyXCI6MjU1LFwiZ1wiOjAsXCJiXCI6MCxcImFcIjoyNTV9IG9yIFwiI0ZGMDAwMFwiLCB2ZWMyPXtcInhcIjoxMDAsXCJ5XCI6NTB9LCB2ZWMzPXtcInhcIjoxLFwieVwiOjIsXCJ6XCI6M30sIHNpemU9e1wid2lkdGhcIjoxMDAsXCJoZWlnaHRcIjo1MH0sIG5vZGUvY29tcG9uZW50L2Fzc2V0IChvciBhbnkgc3BlY2lmaWMgYXNzZXQgdHlwZTogc3ByaXRlRnJhbWUvcHJlZmFiL21hdGVyaWFsL3RleHR1cmUvc3ByaXRlQXRsYXMvYXVkaW9DbGlwL2ZvbnQvYW5pbWF0aW9uQ2xpcC9tZXNoL3NrZWxldG9uL3BoeXNpY3NNYXRlcmlhbC9yZW5kZXJUZXh0dXJlL3RleHRBc3NldC9qc29uQXNzZXQvcGFydGljbGVBc3NldC9zY2VuZUFzc2V0KT1cInV1aWQtc3RyaW5nXCIsIG5vZGVBcnJheT1bXCJ1dWlkMVwiLFwidXVpZDJcIl0sIGNvbXBvbmVudEFycmF5PVtcIm5vZGUtdXVpZDFcIixcIm5vZGUtdXVpZDJcIl0gKGVhY2ggYSBub2RlIFVVSUQgY29udGFpbmluZyB0aGUgdGFyZ2V0IGNvbXBvbmVudCwgc2FtZSBhcyBcImNvbXBvbmVudFwiKSwgY29sb3JBcnJheT1be1wiclwiOjI1NSwuLi59XSwgbnVtYmVyQXJyYXk9WzEsMiwzXSwgc3RyaW5nQXJyYXk9W1wiYVwiLFwiYlwiXSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydGllc19iYXRjaF0gQXJyYXkgb2YgcHJvcGVydHkgZW50cmllcyB0byBzZXQgb24gdGhlIFNBTUUgY29tcG9uZW50IGluIG9uZSBjYWxsLiBFYWNoIGVudHJ5OiB7cHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWV9IHdpdGggdGhlIHNhbWUgc2VtYW50aWNzIGFzIHNldF9wcm9wZXJ0eS4gU3VwcG9ydHMgZG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIHBlciBlbnRyeSAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuIEVhY2ggZW50cnkgaXMgYXBwbGllZCBpbmRlcGVuZGVudGx5IOKAlCBhIGZhaWx1cmUgb24gb25lIGZpZWxkIGRvZXMgbm90IGFib3J0IHRoZSBvdGhlcnM7IHRoZSByZXN1bHQgcmVwb3J0cyBwZXItZmllbGQgc3VjY2Vzcy9lcnJvci4nLFxuICAgICAgICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkgbmFtZSB0byBzZXQuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5VHlwZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW06IFsuLi5TVVBQT1JURURfUFJPUEVSVFlfVFlQRVNdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkgZGF0YSB0eXBlIGZvciBjb3JyZWN0IHZhbHVlIGNvbnZlcnNpb24uIE11c3QgbWF0Y2ggdGhlIGFjdHVhbCBwcm9wZXJ0eSB0eXBlLiBVc2UgXCJhc3NldFwiIGFzIHRoZSBnZW5lcmljIGZhbGxiYWNrIGZvciBhbnkgQ29jb3MgYXNzZXQtcmVmZXJlbmNlIHByb3BlcnR5IChzcHJpdGVGcmFtZS9tYXRlcmlhbC90ZXh0dXJlL2V0Yy4gYXJlIGFsc28gYWNjZXB0ZWQgZGlyZWN0bHkgYW5kIGJlaGF2ZSBpZGVudGljYWxseSkuJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcm9wZXJ0eSB2YWx1ZS4gU2FtZSBmb3JtYXQgcnVsZXMgYXMgc2V0X3Byb3BlcnR5IHZhbHVlIChkZXBlbmRzIG9uIHByb3BlcnR5VHlwZSkuJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlZDogWydwcm9wZXJ0eScsICdwcm9wZXJ0eVR5cGUnLCAndmFsdWUnXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY3JpcHRQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYXR0YWNoX3NjcmlwdF0gU2NyaXB0IGFzc2V0IHBhdGggKGUuZy4sIGRiOi8vYXNzZXRzL3NjcmlwdHMvTXlTY3JpcHQudHMpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNhdGVnb3J5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydhbGwnLCAncmVuZGVyZXInLCAndWknLCAncGh5c2ljcycsICdhbmltYXRpb24nLCAnYXVkaW8nXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfYXZhaWxhYmxlXSBDb21wb25lbnQgY2F0ZWdvcnkgZmlsdGVyLiBEZWZhdWx0OiBhbGwnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdhbGwnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBhZGQ6IChhcmdzKSA9PiB0aGlzLmFkZENvbXBvbmVudChhcmdzLm5vZGVVdWlkLCBhcmdzLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICByZW1vdmU6IChhcmdzKSA9PiB0aGlzLnJlbW92ZUNvbXBvbmVudChhcmdzLm5vZGVVdWlkLCBhcmdzLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICBnZXRfYWxsOiAoYXJncykgPT4gdGhpcy5nZXRDb21wb25lbnRzKGFyZ3Mubm9kZVV1aWQpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0Q29tcG9uZW50SW5mbyhhcmdzLm5vZGVVdWlkLCBhcmdzLmNvbXBvbmVudFR5cGUpLFxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldENvbXBvbmVudFByb3BlcnR5KGFyZ3MpLFxuICAgICAgICBzZXRfcHJvcGVydGllc19iYXRjaDogKGFyZ3MpID0+IHRoaXMuc2V0Q29tcG9uZW50UHJvcGVydGllc0JhdGNoKGFyZ3MpLFxuICAgICAgICBhdHRhY2hfc2NyaXB0OiAoYXJncykgPT4gYXR0YWNoU2NyaXB0VG9Ob2RlKGFyZ3Mubm9kZVV1aWQsIGFyZ3Muc2NyaXB0UGF0aCwgKHV1aWQpID0+IHRoaXMuZ2V0Q29tcG9uZW50cyh1dWlkKSksXG4gICAgICAgIGdldF9hdmFpbGFibGU6IChhcmdzKSA9PiBQcm9taXNlLnJlc29sdmUoZ2V0QXZhaWxhYmxlQ29tcG9uZW50c0xpc3QoYXJncy5jYXRlZ29yeSkpXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE1hdGNoIGEgZHVtcCBjb21wb25lbnQgYWdhaW5zdCB3aGF0ZXZlciBzcGVsbGluZyB0aGUgY2FsbGVyIHVzZWQuXG4gICAgICpcbiAgICAgKiBgY3JlYXRlLWNvbXBvbmVudGAgYWNjZXB0cyBhIHJlYWRhYmxlIGNsYXNzIG5hbWUsIGJ1dCBgcXVlcnktbm9kZWAgbGlzdHMgYSBjdXN0b21cbiAgICAgKiBgQGNjY2xhc3NgIHNjcmlwdCB1bmRlciBpdHMgQ09NUFJFU1NFRCBDSUQgKHRoZSBmaXJzdCBmaXZlIGhleCBjaGFyYWN0ZXJzIG9mIHRoZVxuICAgICAqIHNjcmlwdCBhc3NldCB1dWlkIHBsdXMgYSBiYXNlNjQgdGFpbCksIHNvIGBjb21wLnR5cGUgPT09ICdNeUNvbnRyb2xsZXInYCBpcyBuZXZlclxuICAgICAqIHRydWUgZm9yIGEgcHJvamVjdCBzY3JpcHQuIFRoZSByZWFkYWJsZSBuYW1lIHN1cnZpdmVzIGluIGV4YWN0bHkgb25lIHBsYWNlIGluIHRoZVxuICAgICAqIGR1bXAg4oCUIGB2YWx1ZS5uYW1lYCwgZm9ybWF0dGVkIGAke25vZGVOYW1lfTwke2NsYXNzTmFtZX0+YC5cbiAgICAgKlxuICAgICAqIEJ1aWx0LWluIGNvbXBvbmVudHMgYXJlIHVuYWZmZWN0ZWQ6IGBjYy5TcHJpdGVgIG1hdGNoZXMgb24gYHR5cGVgIGFzIGJlZm9yZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHN0YXRpYyBtYXRjaGVzQ29tcG9uZW50KGNvbXA6IGFueSwgY29tcG9uZW50VHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIGlmIChjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpIHJldHVybiB0cnVlO1xuICAgICAgICBpZiAoY29tcC51dWlkICYmIGNvbXAudXVpZCA9PT0gY29tcG9uZW50VHlwZSkgcmV0dXJuIHRydWU7XG5cbiAgICAgICAgY29uc3QgZHVtcE5hbWUgPSBjb21wLnByb3BlcnRpZXM/Lm5hbWU/LnZhbHVlO1xuICAgICAgICByZXR1cm4gdHlwZW9mIGR1bXBOYW1lID09PSAnc3RyaW5nJyAmJiBkdW1wTmFtZS5lbmRzV2l0aChgPCR7Y29tcG9uZW50VHlwZX0+YCk7XG4gICAgfVxuXG4gICAgLyoqIFRoZSBpZGVudGl0eSBhIGNhbGxlciBuZWVkcyBmb3IgZXZlcnkgRk9MTE9XLVVQIGNhbGw6IGdldF9pbmZvLCBzZXRfcHJvcGVydHksIHJlbW92ZS4gKi9cbiAgICBwcml2YXRlIHN0YXRpYyBjb21wb25lbnRJZGVudGl0eShub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcsIGNvbXA6IGFueSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgLy8gVGhlIGNpZCwgd2hpY2ggaXMgd2hhdCBldmVyeSBvdGhlciBhY3Rpb24gb24gdGhpcyB0b29sIGV4cGVjdHMuIFJldHVybmluZyBpdFxuICAgICAgICAgICAgLy8gc2F2ZXMgdGhlIGNhbGxlciBhIGdldF9hbGwgcm91bmQtdHJpcCBqdXN0IHRvIHRyYW5zbGF0ZSB0aGVpciBvd24gY2xhc3MgbmFtZS5cbiAgICAgICAgICAgIHJlc29sdmVkVHlwZTogY29tcD8udHlwZSA/PyBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgY29tcG9uZW50VXVpZDogY29tcD8udXVpZCA/PyBudWxsLFxuICAgICAgICAgICAgY29tcG9uZW50VmVyaWZpZWQ6IHRydWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGFkZENvbXBvbmVudChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1hZGQnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBDaGVjayBpZiBjb21wb25lbnQgYWxyZWFkeSBleGlzdHMgb24gbm9kZVxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmIChhbGxDb21wb25lbnRzSW5mby5zdWNjZXNzICYmIGFsbENvbXBvbmVudHNJbmZvLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGV4aXN0aW5nQ29tcG9uZW50ID0gYWxsQ29tcG9uZW50c0luZm8uZGF0YS5jb21wb25lbnRzLmZpbmQoXG4gICAgICAgICAgICAgICAgKGNvbXA6IGFueSkgPT4gTWFuYWdlQ29tcG9uZW50Lm1hdGNoZXNDb21wb25lbnQoY29tcCwgY29tcG9uZW50VHlwZSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoZXhpc3RpbmdDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyAuLi5NYW5hZ2VDb21wb25lbnQuY29tcG9uZW50SWRlbnRpdHkobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIGV4aXN0aW5nQ29tcG9uZW50KSwgZXhpc3Rpbmc6IHRydWUgfSxcbiAgICAgICAgICAgICAgICAgICAgYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgYWxyZWFkeSBleGlzdHMgb24gbm9kZWBcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFRyeSBhZGRpbmcgY29tcG9uZW50IHZpYSBFZGl0b3IgQVBJIGRpcmVjdGx5XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtY29tcG9uZW50Jywge1xuICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50VHlwZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBXYWl0IGZvciBlZGl0b3IgdG8gZmluaXNoIGFkZGluZyB0aGUgY29tcG9uZW50XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSk7XG4gICAgICAgICAgICAvLyBSZS1xdWVyeSB0byB2ZXJpZnkgdGhlIGNvbXBvbmVudCB3YXMgYWN0dWFsbHkgYWRkZWRcbiAgICAgICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHNJbmZvMiA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoYWxsQ29tcG9uZW50c0luZm8yLnN1Y2Nlc3MgJiYgYWxsQ29tcG9uZW50c0luZm8yLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhZGRlZENvbXBvbmVudCA9IGFsbENvbXBvbmVudHNJbmZvMi5kYXRhLmNvbXBvbmVudHMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgKGNvbXA6IGFueSkgPT4gTWFuYWdlQ29tcG9uZW50Lm1hdGNoZXNDb21wb25lbnQoY29tcCwgY29tcG9uZW50VHlwZSlcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmIChhZGRlZENvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgLi4uTWFuYWdlQ29tcG9uZW50LmNvbXBvbmVudElkZW50aXR5KG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBhZGRlZENvbXBvbmVudCksIGV4aXN0aW5nOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgYWRkZWQgc3VjY2Vzc2Z1bGx5YFxuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyB3YXMgbm90IGZvdW5kIG9uIG5vZGUgYWZ0ZXIgYWRkaXRpb24uIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2FsbENvbXBvbmVudHNJbmZvMi5kYXRhLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHZlcmlmeSBjb21wb25lbnQgYWRkaXRpb246ICR7YWxsQ29tcG9uZW50c0luZm8yLmVycm9yIHx8ICdVbmFibGUgdG8gZ2V0IG5vZGUgY29tcG9uZW50cyd9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjazogdXNlIHNjZW5lIHNjcmlwdFxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ2FkZENvbXBvbmVudFRvTm9kZScsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFtub2RlVXVpZCwgY29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVtb3ZlQ29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXJlbW92ZScpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEdldCBhbGwgY29tcG9uZW50cyBzbyB3ZSBjYW4gcmVzb2x2ZSBjb21wb25lbnRUeXBlIHRvIHRoZSBjb21wb25lbnQncyBPV04gdXVpZC5cbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoIWFsbENvbXBvbmVudHNJbmZvLnN1Y2Nlc3MgfHwgIWFsbENvbXBvbmVudHNJbmZvLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBjb21wb25lbnRzIGZvciBub2RlICcke25vZGVVdWlkfSc6ICR7YWxsQ29tcG9uZW50c0luZm8uZXJyb3J9YCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50czogYW55W10gPSBhbGxDb21wb25lbnRzSW5mby5kYXRhLmNvbXBvbmVudHM7XG5cbiAgICAgICAgLy8gQWNjZXB0IGVpdGhlciB0aGUgdHlwZSBmaWVsZCAoY2lkLCBlLmcuIFwiY2MuU3ByaXRlXCIgb3IgYSBzY3JpcHQgY2lkKSDigJQgdGhlXG4gICAgICAgIC8vIGVyZ29ub21pYyBmb3JtIOKAlCBvciB0aGUgY29tcG9uZW50J3Mgb3duIHV1aWQsIGZvciBjYWxsZXJzIHRoYXQgYWxyZWFkeSBoYXZlIGl0LlxuICAgICAgICBjb25zdCB0YXJnZXQgPSBhbGxDb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKVxuICAgICAgICAgICAgfHwgYWxsQ29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudXVpZCAmJiBjb21wLnV1aWQgPT09IGNvbXBvbmVudFR5cGUpO1xuICAgICAgICBpZiAoIXRhcmdldCkge1xuICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVHlwZXMgPSBhbGxDb21wb25lbnRzLm1hcCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUpLmpvaW4oJywgJyk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGUgJyR7bm9kZVV1aWR9Jy4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlVHlwZXN9LiBVc2UgYWN0aW9uPWdldF9hbGwgdG8gZ2V0IHRoZSB0eXBlIGZpZWxkIChjaWQpIG9yIHV1aWQgZm9yIGNvbXBvbmVudFR5cGUuYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUaGUgZWRpdG9yJ3MgJ3JlbW92ZS1jb21wb25lbnQnIHRha2VzIHRoZSBDT01QT05FTlQncyB1dWlkIChSZW1vdmVDb21wb25lbnRPcHRpb25zXG4gICAgICAgIC8vIGlzIHsgdXVpZDogc3RyaW5nIH0g4oCUIGl0cyBgY29tcG9uZW50YCBmaWVsZCBpcyBhbiB1bnVzZWQgcGFyYW1ldGVyKS4gUGFzc2luZyB0aGVcbiAgICAgICAgLy8gbm9kZSB1dWlkIGhlcmUgaXMgd2hhdCBtYWRlIHJlbW92YWwgc2lsZW50bHkgZmFpbC5cbiAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IHRhcmdldC51dWlkO1xuICAgICAgICBpZiAoIWNvbXBvbmVudFV1aWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ291bGQgbm90IHJlc29sdmUgdGhlIGNvbXBvbmVudCB1dWlkIGZvciAnJHtjb21wb25lbnRUeXBlfScgb24gbm9kZSAnJHtub2RlVXVpZH0nLiBUaGUgZWRpdG9yIHJlcXVpcmVzIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCB0byByZW1vdmUgaXQuYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVtb3ZlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBjb21wb25lbnRVdWlkXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIHRoZSBlZGl0b3IgdG8gZmluaXNoIHJlbW92aW5nIHRoZSBjb21wb25lbnRcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDApKTtcbiAgICAgICAgICAgIC8vIFJlLXF1ZXJ5IHRvIGNvbmZpcm0gcmVtb3ZhbCDigJQgbWF0Y2ggb24gdGhlIHJlc29sdmVkIGNvbXBvbmVudCB1dWlkIHNvIGEgbm9kZVxuICAgICAgICAgICAgLy8gY2FycnlpbmcgdHdvIGNvbXBvbmVudHMgb2YgdGhlIHNhbWUgdHlwZSByZXBvcnRzIGFjY3VyYXRlbHkuXG4gICAgICAgICAgICBjb25zdCBhZnRlclJlbW92ZUluZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICAgICAgY29uc3Qgc3RpbGxFeGlzdHMgPSBhZnRlclJlbW92ZUluZm8uc3VjY2VzcyAmJiBhZnRlclJlbW92ZUluZm8uZGF0YT8uY29tcG9uZW50cz8uc29tZSgoY29tcDogYW55KSA9PiBjb21wLnV1aWQgPT09IGNvbXBvbmVudFV1aWQpO1xuICAgICAgICAgICAgaWYgKHN0aWxsRXhpc3RzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nICh1dWlkICR7Y29tcG9uZW50VXVpZH0pIHdhcyBub3QgcmVtb3ZlZCBmcm9tIG5vZGUgJyR7bm9kZVV1aWR9Jy5gKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIGNvbXBvbmVudFV1aWQgfSxcbiAgICAgICAgICAgICAgICAgICAgYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgKHV1aWQgJHtjb21wb25lbnRVdWlkfSkgcmVtb3ZlZCBzdWNjZXNzZnVsbHkgZnJvbSBub2RlICcke25vZGVVdWlkfSdgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHJlbW92ZSBjb21wb25lbnQ6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvbXBvbmVudHMobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249Z2V0X2FsbCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAobm9kZURhdGEgJiYgbm9kZURhdGEuX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IG5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgICAgICAvLyBUaGUgZHVtcCBuZXN0cyB0aGUgY29tcG9uZW50J3Mgb3duIHV1aWQgdW5kZXIgdmFsdWUudXVpZC52YWx1ZTsgdGhlXG4gICAgICAgICAgICAgICAgICAgIC8vIHRvcC1sZXZlbCBjb21wLnV1aWQgZG9lcyBub3QgZXhpc3QsIHNvIHJlYWQgdGhlIGR1bXAgZm9ybSBmaXJzdC5cbiAgICAgICAgICAgICAgICAgICAgdXVpZDogY29tcC52YWx1ZT8udXVpZD8udmFsdWUgfHwgY29tcC51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQgfHwgbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wLmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB0aGlzLmV4dHJhY3RDb21wb25lbnRQcm9wZXJ0aWVzKGNvbXApXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbm9kZVV1aWQsIGNvbXBvbmVudHMgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ05vZGUgbm90IGZvdW5kIG9yIG5vIGNvbXBvbmVudHMgZGF0YScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldE5vZGVJbmZvJywgYXJnczogW25vZGVVdWlkXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEuY29tcG9uZW50cyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRDb21wb25lbnRJbmZvKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPWdldF9pbmZvJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhICYmIG5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGVEYXRhLl9fY29tcHNfXy5maW5kKChjb21wOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcFR5cGUgPSBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbXBUeXBlID09PSBjb21wb25lbnRUeXBlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wb25lbnQuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcG9uZW50LmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogdGhpcy5leHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wb25lbnQpXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGVgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3Igbm8gY29tcG9uZW50cyBkYXRhJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0Tm9kZUluZm8nLCBhcmdzOiBbbm9kZVV1aWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzICYmIHJlc3VsdC5kYXRhLmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gcmVzdWx0LmRhdGEuY29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21wb25lbnQpIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIC4uLmNvbXBvbmVudCB9KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudCBpbmZvJyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0aWVzKGNvbXBvbmVudDogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgICAgIC8vIElmIHRoZSBjb21wb25lbnQgaGFzIGEgdmFsdWUgcHJvcGVydHksIGl0IGNvbnRhaW5zIGFsbCBhY3R1YWwgY29tcG9uZW50IHByb3BlcnRpZXNcbiAgICAgICAgaWYgKGNvbXBvbmVudC52YWx1ZSAmJiB0eXBlb2YgY29tcG9uZW50LnZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgcmV0dXJuIGNvbXBvbmVudC52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBGYWxsYmFjazogZXh0cmFjdCBwcm9wZXJ0aWVzIGRpcmVjdGx5IGZyb20gdGhlIGNvbXBvbmVudCBvYmplY3RcbiAgICAgICAgY29uc3QgcHJvcGVydGllczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgICAgICBjb25zdCBleGNsdWRlS2V5cyA9IFsnX190eXBlX18nLCAnZW5hYmxlZCcsICdub2RlJywgJ19pZCcsICdfX3NjcmlwdEFzc2V0JywgJ3V1aWQnLCAnbmFtZScsICdfbmFtZScsICdfb2JqRmxhZ3MnLCAnX2VuYWJsZWQnLCAndHlwZScsICdyZWFkb25seScsICd2aXNpYmxlJywgJ2NpZCcsICdlZGl0b3InLCAnZXh0ZW5kcyddO1xuICAgICAgICBmb3IgKGNvbnN0IGtleSBpbiBjb21wb25lbnQpIHtcbiAgICAgICAgICAgIGlmICghZXhjbHVkZUtleXMuaW5jbHVkZXMoa2V5KSAmJiAha2V5LnN0YXJ0c1dpdGgoJ18nKSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnRpZXNba2V5XSA9IGNvbXBvbmVudFtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm9wZXJ0aWVzO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Q29tcG9uZW50UHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH0gPSBhcmdzO1xuXG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUgfHwgIXByb3BlcnR5IHx8IHByb3BlcnR5VHlwZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1zZXRfcHJvcGVydHknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMDogRGV0ZWN0IGlmIHVzZXIgaXMgdHJ5aW5nIHRvIHNldCBhIG5vZGUgcHJvcGVydHk7IHJlZGlyZWN0IHdpdGggZ3VpZGFuY2VcbiAgICAgICAgY29uc3Qgbm9kZVJlZGlyZWN0UmVzdWx0ID0gcmVkaXJlY3ROb2RlUHJvcGVydHlBY2Nlc3MoYXJncyk7XG4gICAgICAgIGlmIChub2RlUmVkaXJlY3RSZXN1bHQpIHtcbiAgICAgICAgICAgIHJldHVybiBub2RlUmVkaXJlY3RSZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDE6IFJlc29sdmUgdGhlIHRhcmdldCBjb21wb25lbnQgKGFuZCBpdHMgcmF3IF9fY29tcHNfXyBpbmRleCkgb25jZS5cbiAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IGF3YWl0IHRoaXMucmVzb2x2ZVRhcmdldENvbXBvbmVudChub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHkpO1xuICAgICAgICBpZiAoIXJlc29sdXRpb24ub2spIHtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHV0aW9uLnJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMjogQXBwbHkgdGhlIHNpbmdsZSBwcm9wZXJ0eSB1c2luZyB0aGUgc2hhcmVkIHBlci1maWVsZCBsb2dpYy5cbiAgICAgICAgY29uc3QgZmllbGRSZXN1bHQgPSBhd2FpdCB0aGlzLmFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcmVzb2x1dGlvbi50YXJnZXRDb21wb25lbnQsIHJlc29sdXRpb24ucmF3Q29tcG9uZW50SW5kZXgsXG4gICAgICAgICAgICB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH1cbiAgICAgICAgKTtcblxuICAgICAgICBpZiAoIWZpZWxkUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChmaWVsZFJlc3VsdC5lcnJvciB8fCBgRmFpbGVkIHRvIHNldCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nYCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICBwcm9wZXJ0eSxcbiAgICAgICAgICAgIGFjdHVhbFZhbHVlOiBmaWVsZFJlc3VsdC5hY3R1YWxWYWx1ZSxcbiAgICAgICAgICAgIGNoYW5nZVZlcmlmaWVkOiBmaWVsZFJlc3VsdC5jaGFuZ2VWZXJpZmllZFxuICAgICAgICB9LCBgU3VjY2Vzc2Z1bGx5IHNldCAke2NvbXBvbmVudFR5cGV9LiR7cHJvcGVydHl9YCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IG11bHRpcGxlIHByb3BlcnRpZXMgb24gYSBTSU5HTEUgY29tcG9uZW50IGluIG9uZSBjYWxsLlxuICAgICAqIFRoZSB0YXJnZXQgY29tcG9uZW50IGlzIHJlc29sdmVkIG9uY2U7IGVhY2ggcHJvcGVydHkgZW50cnkgaXMgdGhlbiBhcHBsaWVkXG4gICAgICogaW5kZXBlbmRlbnRseSB2aWEgdGhlIHNhbWUgcGVyLWZpZWxkIGxvZ2ljIHVzZWQgYnkgc2V0X3Byb3BlcnR5IOKAlCBzbyBhIGZhaWx1cmVcbiAgICAgKiBvbiBvbmUgZmllbGQgZG9lcyBub3QgYWJvcnQgdGhlIHJlc3QuIERvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyB3b3JrIHBlciBlbnRyeS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHNldENvbXBvbmVudFByb3BlcnRpZXNCYXRjaChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydGllcyB9ID0gYXJncztcblxuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0aWVzX2JhdGNoJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByb3BlcnRpZXMpIHx8IHByb3BlcnRpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnRpZXMgbXVzdCBiZSBhIG5vbi1lbXB0eSBhcnJheSBvZiB7cHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWV9IGVudHJpZXMgZm9yIGFjdGlvbj1zZXRfcHJvcGVydGllc19iYXRjaCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSB0aGUgdGFyZ2V0IGNvbXBvbmVudCBvbmNlIGZvciB0aGUgd2hvbGUgYmF0Y2guXG4gICAgICAgIGNvbnN0IHJlc29sdXRpb24gPSBhd2FpdCB0aGlzLnJlc29sdmVUYXJnZXRDb21wb25lbnQobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHVuZGVmaW5lZCk7XG4gICAgICAgIGlmICghcmVzb2x1dGlvbi5vaykge1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdXRpb24ucmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0czogQXJyYXk8eyBwcm9wZXJ0eTogc3RyaW5nOyBzdWNjZXNzOiBib29sZWFuOyBhY3R1YWxWYWx1ZT86IGFueTsgY2hhbmdlVmVyaWZpZWQ/OiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PiA9IFtdO1xuXG4gICAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgcHJvcGVydGllcykge1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHkgPSBlbnRyeT8ucHJvcGVydHk7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eVR5cGUgPSBlbnRyeT8ucHJvcGVydHlUeXBlO1xuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBlbnRyeT8udmFsdWU7XG5cbiAgICAgICAgICAgIGlmICghcHJvcGVydHkgfHwgcHJvcGVydHlUeXBlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiBwcm9wZXJ0eSB8fCAnKG1pc3NpbmcpJyxcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiAnRWFjaCBlbnRyeSByZXF1aXJlcyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCBhbmQgdmFsdWUnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmllbGRSZXN1bHQgPSBhd2FpdCB0aGlzLmFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCByZXNvbHV0aW9uLnRhcmdldENvbXBvbmVudCwgcmVzb2x1dGlvbi5yYXdDb21wb25lbnRJbmRleCxcbiAgICAgICAgICAgICAgICAgICAgeyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eSxcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmllbGRSZXN1bHQuc3VjY2VzcyxcbiAgICAgICAgICAgICAgICAgICAgYWN0dWFsVmFsdWU6IGZpZWxkUmVzdWx0LmFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VWZXJpZmllZDogZmllbGRSZXN1bHQuY2hhbmdlVmVyaWZpZWQsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBmaWVsZFJlc3VsdC5lcnJvclxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAvLyBEZWZlbnNpdmU6IG9uZSBiYWQgZmllbGQgbXVzdCBuZXZlciBhYm9ydCB0aGUgYmF0Y2guXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHsgcHJvcGVydHksIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyPy5tZXNzYWdlIHx8IFN0cmluZyhlcnIpIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3VjY2VlZGVkID0gcmVzdWx0cy5maWx0ZXIociA9PiByLnN1Y2Nlc3MpLmxlbmd0aDtcbiAgICAgICAgY29uc3QgZmFpbGVkID0gcmVzdWx0cy5sZW5ndGggLSBzdWNjZWVkZWQ7XG4gICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgc2V0X3Byb3BlcnRpZXNfYmF0Y2ggb24gJHtjb21wb25lbnRUeXBlfTogJHtzdWNjZWVkZWR9LyR7cmVzdWx0cy5sZW5ndGh9IGZpZWxkKHMpIHNldCR7ZmFpbGVkID4gMCA/IGAsICR7ZmFpbGVkfSBmYWlsZWRgIDogJyd9YDtcblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICB0b3RhbDogcmVzdWx0cy5sZW5ndGgsXG4gICAgICAgICAgICBzdWNjZWVkZWQsXG4gICAgICAgICAgICBmYWlsZWQsXG4gICAgICAgICAgICByZXN1bHRzXG4gICAgICAgIH0sIG1lc3NhZ2UpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYSBjb21wb25lbnQgb24gYSBub2RlIGludG8gaXRzIGR1bXAgKHRhcmdldENvbXBvbmVudCkgYW5kIGl0cyByYXcgX19jb21wc19fIGluZGV4LlxuICAgICAqIFdoZW4gYHByb3BlcnR5YCBpcyBwcm92aWRlZCwgYSBtaXNzaW5nIGNvbXBvbmVudCB5aWVsZHMgYW4gTExNLWZyaWVuZGx5IHN1Z2dlc3Rpb24uXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlVGFyZ2V0Q29tcG9uZW50KFxuICAgICAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgICAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgIHByb3BlcnR5OiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICApOiBQcm9taXNlPFxuICAgICAgICB8IHsgb2s6IHRydWU7IHRhcmdldENvbXBvbmVudDogYW55OyByYXdDb21wb25lbnRJbmRleDogbnVtYmVyIH1cbiAgICAgICAgfCB7IG9rOiBmYWxzZTsgcmVzdWx0OiBBY3Rpb25Ub29sUmVzdWx0IH1cbiAgICA+IHtcbiAgICAgICAgLy8gR2V0IGFsbCBjb21wb25lbnRzIChkdW1wIGZvcm0pIG9uIHRoZSBub2RlLlxuICAgICAgICBjb25zdCBjb21wb25lbnRzUmVzcG9uc2UgPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoIWNvbXBvbmVudHNSZXNwb25zZS5zdWNjZXNzIHx8ICFjb21wb25lbnRzUmVzcG9uc2UuZGF0YSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN1bHQ6IGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudHMgZm9yIG5vZGUgJyR7bm9kZVV1aWR9JzogJHtjb21wb25lbnRzUmVzcG9uc2UuZXJyb3J9YCkgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHMgPSBjb21wb25lbnRzUmVzcG9uc2UuZGF0YS5jb21wb25lbnRzO1xuICAgICAgICBsZXQgdGFyZ2V0Q29tcG9uZW50ID0gbnVsbDtcbiAgICAgICAgbGV0IHJlc29sdmVkSW5kZXggPSAtMTtcbiAgICAgICAgY29uc3QgYXZhaWxhYmxlVHlwZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYWxsQ29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IGFsbENvbXBvbmVudHNbaV07XG4gICAgICAgICAgICBhdmFpbGFibGVUeXBlcy5wdXNoKGNvbXAudHlwZSk7XG4gICAgICAgICAgICBpZiAoY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29tcG9uZW50ID0gY29tcDtcbiAgICAgICAgICAgICAgICByZXNvbHZlZEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZhbGxiYWNrOiBjb21wb25lbnRUeXBlIG1heSBiZSBhIHJlYWRhYmxlIGNsYXNzIG5hbWUgKGUuZy4gXCJNeUNvbnRyb2xsZXJcIilcbiAgICAgICAgLy8gd2hpbGUgdGhlIGR1bXAgb25seSBleHBvc2VzIHRoZSBzY3JpcHQncyBjaWQuIFJlc29sdmUgdmlhIHRoZSBzY2VuZSBzY3JpcHQsXG4gICAgICAgIC8vIHdoaWNoIGhhcyB0aGUgbGl2ZSBjYy5qcyBjbGFzcyByZWdpc3RyeSwgdGhlbiBtYXAgYmFjayB0byB0aGUgZHVtcCBjb21wb25lbnRcbiAgICAgICAgLy8gYXQgdGhlIHNhbWUgaW5kZXggKHF1ZXJ5LW5vZGUgX19jb21wc19fIG9yZGVyIG1hdGNoZXMgbm9kZS5jb21wb25lbnRzIG9yZGVyKS5cbiAgICAgICAgaWYgKCF0YXJnZXRDb21wb25lbnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnlOYW1lOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdyZXNvbHZlQ29tcG9uZW50QnlOYW1lJywgYXJnczogW25vZGVVdWlkLCBjb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gYnlOYW1lPy5zdWNjZXNzID8gYnlOYW1lLmRhdGE/LmluZGV4IDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaW5kZXggPT09ICdudW1iZXInICYmIGluZGV4ID49IDAgJiYgaW5kZXggPCBhbGxDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlZEluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbXBvbmVudCA9IGFsbENvbXBvbmVudHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIFNjZW5lIHNjcmlwdCB1bmF2YWlsYWJsZSDigJQgZmFsbCB0aHJvdWdoIHRvIHRoZSBub3QtZm91bmQgZXJyb3IgYmVsb3cuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldENvbXBvbmVudCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24oY29tcG9uZW50VHlwZSwgYXZhaWxhYmxlVHlwZXMsIHByb3BlcnR5IHx8ICcnKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGVUeXBlcy5qb2luKCcsICcpfWAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdldCByYXcgbm9kZSBkYXRhIHRvIGJ1aWxkIHRoZSBjb3JyZWN0IF9fY29tcHNfXyBwYXRoLlxuICAgICAgICBjb25zdCByYXdOb2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgIGlmICghcmF3Tm9kZURhdGEgfHwgIXJhd05vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN1bHQ6IGVycm9yUmVzdWx0KCdGYWlsZWQgdG8gZ2V0IHJhdyBub2RlIGRhdGEgZm9yIHByb3BlcnR5IHNldHRpbmcnKSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJhd0NvbXBvbmVudEluZGV4ID0gLTE7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmF3Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wID0gcmF3Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgaWYgKGNvbXBUeXBlID09PSBjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmF3Q29tcG9uZW50SW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIENsYXNzLW5hbWUgcmVzb2x1dGlvbiBwYXRoOiB0aGUgY2lkIHdvbid0IGVxdWFsIGNvbXBvbmVudFR5cGUsIHNvIHJldXNlIHRoZVxuICAgICAgICAvLyBpbmRleCByZXNvbHZlZCBhYm92ZSAoZHVtcCBvcmRlciA9PSByYXcgX19jb21wc19fIG9yZGVyKS5cbiAgICAgICAgaWYgKHJhd0NvbXBvbmVudEluZGV4ID09PSAtMSAmJiByZXNvbHZlZEluZGV4ID49IDAgJiYgcmVzb2x2ZWRJbmRleCA8IHJhd05vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJhd0NvbXBvbmVudEluZGV4ID0gcmVzb2x2ZWRJbmRleDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyYXdDb21wb25lbnRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdCgnQ291bGQgbm90IGZpbmQgY29tcG9uZW50IGluZGV4IGZvciBzZXR0aW5nIHByb3BlcnR5JykgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCB0YXJnZXRDb21wb25lbnQsIHJhd0NvbXBvbmVudEluZGV4IH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgT05FIHByb3BlcnR5IHZhbHVlIHRvIGFuIGFscmVhZHktcmVzb2x2ZWQgY29tcG9uZW50LlxuICAgICAqIFNoYXJlZCBieSBzZXRfcHJvcGVydHkgKHNpbmdsZSkgYW5kIHNldF9wcm9wZXJ0aWVzX2JhdGNoIChwZXIgZW50cnkpLlxuICAgICAqIFJldHVybnMgYSBwZXItZmllbGQgcmVzdWx0IHJhdGhlciB0aGFuIHRocm93aW5nLCBzbyBjYWxsZXJzIGNhbiBhZ2dyZWdhdGUuXG4gICAgICogRG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKSBhcmUgc3VwcG9ydGVkXG4gICAgICogYmVjYXVzZSBhbmFseXplUHJvcGVydHkgLyBhcHBseVByb3BlcnR5VG9FZGl0b3IgLyB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZVxuICAgICAqIGFsbCB3YWxrIGRvdHRlZCBzZWdtZW50cy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICAgICAgdGFyZ2V0Q29tcG9uZW50OiBhbnksXG4gICAgICAgIHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXIsXG4gICAgICAgIGZpZWxkOiB7IHByb3BlcnR5OiBzdHJpbmc7IHByb3BlcnR5VHlwZTogc3RyaW5nOyB2YWx1ZTogYW55IH1cbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgYWN0dWFsVmFsdWU/OiBhbnk7IGNoYW5nZVZlcmlmaWVkPzogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBjb25zdCB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH0gPSBmaWVsZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTWFuYWdlQ29tcG9uZW50XSBTZXR0aW5nICR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX0gKHR5cGU6ICR7cHJvcGVydHlUeXBlfSkgPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX0gb24gbm9kZSAke25vZGVVdWlkfWApO1xuXG4gICAgICAgICAgICAvLyBBbmFseXplIHRoZSBwcm9wZXJ0eSB0byBnZXQgb3JpZ2luYWwgdmFsdWUgYW5kIHR5cGUgaW5mbyAoc3VwcG9ydHMgZG90dGVkIHBhdGhzKS5cbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eUluZm87XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SW5mbyA9IGFuYWx5emVQcm9wZXJ0eSh0YXJnZXRDb21wb25lbnQsIHByb3BlcnR5KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGFuYWx5emVFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGFuYWx5emUgcHJvcGVydHkgJyR7cHJvcGVydHl9JzogJHthbmFseXplRXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJvcGVydHlJbmZvLmV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGZvdW5kIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIEF2YWlsYWJsZSBwcm9wZXJ0aWVzOiAke3Byb3BlcnR5SW5mby5hdmFpbGFibGVQcm9wZXJ0aWVzLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHZhbHVlIGJhc2VkIG9uIGV4cGxpY2l0IHByb3BlcnR5VHlwZS5cbiAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVmFsdWUgPSBwcm9wZXJ0eUluZm8ub3JpZ2luYWxWYWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZFZhbHVlOiBhbnkgPSBjb252ZXJ0UHJvcGVydHlWYWx1ZShwcm9wZXJ0eVR5cGUsIHZhbHVlKTtcblxuICAgICAgICAgICAgLy8gQnVpbGQgdGhlIChwb3NzaWJseSBkb3R0ZWQpIGNvbXBvbmVudCBwcm9wZXJ0eSBwYXRoIGFuZCBhcHBseSB2aWEgdHlwZS1hd2FyZSBFZGl0b3IgQVBJLlxuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlQYXRoID0gYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS4ke3Byb3BlcnR5fWA7XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yKFxuICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgcmF3Q29tcG9uZW50SW5kZXgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlLCBwcm9jZXNzZWRWYWx1ZSB9LFxuICAgICAgICAgICAgICAgICh1dWlkLCB0eXBlKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8odXVpZCwgdHlwZSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGVkaXRvciB0byBjb21wbGV0ZSB0aGUgdXBkYXRlLCB0aGVuIHZlcmlmeS5cbiAgICAgICAgICAgIC8vIExvb2sgdXAgYnkgdGhlIFJFU09MVkVEIGR1bXAgdHlwZSAodGFyZ2V0Q29tcG9uZW50LnR5cGUg4oCUIGEgY2lkIHdoZW5cbiAgICAgICAgICAgIC8vIGNvbXBvbmVudFR5cGUgd2FzIGEgY2xhc3MgbmFtZSByZXNvbHZlZCB2aWEgcmVzb2x2ZUNvbXBvbmVudEJ5TmFtZSksXG4gICAgICAgICAgICAvLyBub3QgdGhlIGNhbGxlci1zdXBwbGllZCBjb21wb25lbnRUeXBlOiBnZXRDb21wb25lbnRJbmZvIG1hdGNoZXMgYWdhaW5zdFxuICAgICAgICAgICAgLy8gdGhlIGR1bXAncyBfX3R5cGVfXy9jaWQsIHdoaWNoIG5ldmVyIGVxdWFscyBhIHJlYWRhYmxlIGNsYXNzIG5hbWUsIHNvXG4gICAgICAgICAgICAvLyB2ZXJpZmljYXRpb24gd291bGQgYWx3YXlzIHJlcG9ydCB1bnZlcmlmaWVkIGZvciB0aGUgY2xhc3MtbmFtZSBwYXRoLlxuICAgICAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uID0gYXdhaXQgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UoXG4gICAgICAgICAgICAgICAgbm9kZVV1aWQsIHRhcmdldENvbXBvbmVudC50eXBlIHx8IGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBvcmlnaW5hbFZhbHVlLCBhY3R1YWxFeHBlY3RlZFZhbHVlLFxuICAgICAgICAgICAgICAgICh1dWlkLCB0eXBlKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8odXVpZCwgdHlwZSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmICghdmVyaWZpY2F0aW9uLnZlcmlmaWVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlOiB2ZXJpZmljYXRpb24uYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtjb21wb25lbnRUeXBlfS4ke3Byb3BlcnR5fScgd3JpdGUgZGlkIG5vdCB2ZXJpZnk6IGV4cGVjdGVkICR7SlNPTi5zdHJpbmdpZnkoYWN0dWFsRXhwZWN0ZWRWYWx1ZSl9IGJ1dCB0aGUgZWRpdG9yIHJlYWRzIGJhY2sgJHtKU09OLnN0cmluZ2lmeSh2ZXJpZmljYXRpb24uYWN0dWFsVmFsdWUpfWBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBhY3R1YWxWYWx1ZTogdmVyaWZpY2F0aW9uLmFjdHVhbFZhbHVlLCBjaGFuZ2VWZXJpZmllZDogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFuYWdlQ29tcG9uZW50XSBFcnJvciBzZXR0aW5nIHByb3BlcnR5ICcke3Byb3BlcnR5fSc6YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHNldCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG59XG4iXX0=