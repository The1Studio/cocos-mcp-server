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
        var _a;
        if (!nodeUuid || !componentType) {
            return (0, types_1.errorResult)('nodeUuid and componentType are required for action=get_info');
        }
        // Route through getComponents + matchesComponent so a custom @ccclass class name
        // resolves the same way action=add does (issue #44): query-node lists project
        // scripts under their compressed cid, while the readable name lives only in
        // `value.name` as `${nodeName}<${className}>`, which matchesComponent checks.
        const componentsResponse = await this.getComponents(nodeUuid);
        if (!componentsResponse.success || !((_a = componentsResponse.data) === null || _a === void 0 ? void 0 : _a.components)) {
            return (0, types_1.errorResult)(componentsResponse.error || 'Node not found or no components data');
        }
        const component = componentsResponse.data.components.find((comp) => ManageComponent.matchesComponent(comp, componentType));
        if (component) {
            return (0, types_1.successResult)({
                nodeUuid, componentType,
                enabled: component.enabled !== undefined ? component.enabled : true,
                properties: component.properties
            });
        }
        return (0, types_1.errorResult)(`Component '${componentType}' not found on node. Available components: ${componentsResponse.data.components.map((c) => c.type).join(', ')}`);
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
            if (ManageComponent.matchesComponent(comp, componentType)) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQTBPO0FBQzFPLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLG14QkFBbXhCLENBQUM7UUFDbHlCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTdILGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDeEgsV0FBVyxFQUFFLDJXQUEyVztpQkFDM1g7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsME9BQTBPO2lCQUMxUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdPQUF3TztpQkFDeFA7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEdBQUcsNERBQXdCLENB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QUNOLENBQUM7WUFFRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsWUFBWSxDQUFDLFdBQVcsRUFBRSxjQUFjLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDMUYsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyw2Q0FBNkMsUUFBUSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDaEYsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLDJCQUEyQixRQUFRLE1BQU0sS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7UUFDL0YsQ0FBQztJQUNMLENBQUM7Q0FFSjtBQW5qQkQsMENBbWpCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgYW5hbHl6ZVByb3BlcnR5LCBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24sIGNvbnZlcnRQcm9wZXJ0eVZhbHVlLCBnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdCwgcmVkaXJlY3ROb2RlUHJvcGVydHlBY2Nlc3MsIHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlLCBTVVBQT1JURURfUFJPUEVSVFlfVFlQRVMgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtcHJvcGVydHktaGVscGVycyc7XG5pbXBvcnQgeyBhcHBseVByb3BlcnR5VG9FZGl0b3IgfSBmcm9tICcuL21hbmFnZS1jb21wb25lbnQtZWRpdG9yLWFwcGx5JztcbmltcG9ydCB7IGF0dGFjaFNjcmlwdFRvTm9kZSB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1zY3JpcHQtYXR0YWNoJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZUNvbXBvbmVudCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9jb21wb25lbnQnO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBjb21wb25lbnRzIG9uIHNjZW5lIG5vZGVzLiBBY3Rpb25zOiBhZGQ9YWRkIGNvbXBvbmVudCB0byBub2RlLCByZW1vdmU9cmVtb3ZlIGNvbXBvbmVudCAodXNlIHRoZSBjaWQgb3IgdXVpZCBmcm9tIGdldF9hbGwpLCBnZXRfYWxsPWxpc3QgYWxsIGNvbXBvbmVudHMgb24gbm9kZSwgZ2V0X2luZm89Z2V0IHNwZWNpZmljIGNvbXBvbmVudCBkZXRhaWxzIGFuZCBwcm9wZXJ0aWVzLCBzZXRfcHJvcGVydHk9c2V0IGEgc2luZ2xlIGNvbXBvbmVudCBwcm9wZXJ0eSB2YWx1ZSAoc3VwcG9ydHMgZG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIGxpa2UgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIiksIHNldF9wcm9wZXJ0aWVzX2JhdGNoPXNldCBtYW55IHByb3BlcnRpZXMgb24gb25lIGNvbXBvbmVudCBpbiBhIHNpbmdsZSBjYWxsIChlYWNoIGZpZWxkIHNldCBpbmRlcGVuZGVudGx5IOKAlCBvbmUgYmFkIGZpZWxkIGRvZXMgbm90IGFib3J0IHRoZSByZXN0KSwgYXR0YWNoX3NjcmlwdD1hdHRhY2ggYSBUeXBlU2NyaXB0L0phdmFTY3JpcHQgc2NyaXB0IGNvbXBvbmVudCwgZ2V0X2F2YWlsYWJsZT1saXN0IGF2YWlsYWJsZSBjb21wb25lbnQgdHlwZXMgYnkgY2F0ZWdvcnkuIE5PVEU6IEZvciBub2RlIGJhc2ljIHByb3BlcnRpZXMgKG5hbWUsIGFjdGl2ZSwgbGF5ZXIpIHVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3Byb3BlcnR5LiBGb3IgdHJhbnNmb3JtcyAocG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSkgdXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfdHJhbnNmb3JtLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnYWRkJywgJ3JlbW92ZScsICdnZXRfYWxsJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfcHJvcGVydGllc19iYXRjaCcsICdhdHRhY2hfc2NyaXB0JywgJ2dldF9hdmFpbGFibGUnXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydhZGQnLCAncmVtb3ZlJywgJ2dldF9hbGwnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9wcm9wZXJ0aWVzX2JhdGNoJywgJ2F0dGFjaF9zY3JpcHQnLCAnZ2V0X2F2YWlsYWJsZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGFkZD1hZGQgY29tcG9uZW50IHRvIG5vZGUsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50ICh1c2UgdGhlIGNpZCBvciB1dWlkIGZyb20gZ2V0X2FsbCksIGdldF9hbGw9bGlzdCBhbGwgY29tcG9uZW50cywgZ2V0X2luZm89Z2V0IGNvbXBvbmVudCBkZXRhaWxzLCBzZXRfcHJvcGVydHk9c2V0IGEgc2luZ2xlIHByb3BlcnR5IHZhbHVlIChkb3R0ZWQgbmVzdGVkIHBhdGhzIHN1cHBvcnRlZCksIHNldF9wcm9wZXJ0aWVzX2JhdGNoPXNldCBtYW55IHByb3BlcnRpZXMgYXQgb25jZSwgYXR0YWNoX3NjcmlwdD1hdHRhY2ggYSBzY3JpcHQgZmlsZSwgZ2V0X2F2YWlsYWJsZT1saXN0IGF2YWlsYWJsZSB0eXBlcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZCwgcmVtb3ZlLCBnZXRfYWxsLCBnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCBhdHRhY2hfc2NyaXB0XSBUYXJnZXQgbm9kZSBVVUlELiBVc2UgbWFuYWdlX25vZGUgYWN0aW9uPWdldF9hbGwgdG8gZmluZCBub2RlIFVVSURzLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkXSBDb21wb25lbnQgdHlwZSB0byBhZGQgKGUuZy4sIGNjLlNwcml0ZSwgY2MuTGFiZWwsIGNjLkJ1dHRvbikuIFtyZW1vdmVdIENvbXBvbmVudCBjaWQgKHRoZSB0eXBlIGZpZWxkIGZyb20gZ2V0X2FsbCDigJQgTk9UIHNjcmlwdCBuYW1lKSwgb3IgdGhlIGNvbXBvbmVudCB1dWlkIGZpZWxkIGZyb20gZ2V0X2FsbC4gW2dldF9pbmZvLCBzZXRfcHJvcGVydHldIENvbXBvbmVudCB0eXBlIHRvIHRhcmdldC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFeGFtcGxlczogY2MuTGFiZWwg4oaSIHN0cmluZywgZm9udFNpemUsIGNvbG9yOyBjYy5TcHJpdGUg4oaSIHNwcml0ZUZyYW1lLCBjb2xvcjsgY2MuVUlUcmFuc2Zvcm0g4oaSIGNvbnRlbnRTaXplLCBhbmNob3JQb2ludC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHlUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWy4uLlNVUFBPUlRFRF9QUk9QRVJUWV9UWVBFU10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBkYXRhIHR5cGUgZm9yIGNvcnJlY3QgdmFsdWUgY29udmVyc2lvbi4gTXVzdCBtYXRjaCB0aGUgYWN0dWFsIHByb3BlcnR5IHR5cGUuIFVzZSBcImFzc2V0XCIgYXMgdGhlIGdlbmVyaWMgZmFsbGJhY2sgZm9yIGFueSBDb2NvcyBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHkgKHNwcml0ZUZyYW1lL21hdGVyaWFsL3RleHR1cmUvZXRjLiBhcmUgYWxzbyBhY2NlcHRlZCBkaXJlY3RseSBhbmQgYmVoYXZlIGlkZW50aWNhbGx5KS4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IHZhbHVlLiBGb3JtYXQgZGVwZW5kcyBvbiBwcm9wZXJ0eVR5cGU6IHN0cmluZz1cInRleHRcIiwgbnVtYmVyPTQyLCBib29sZWFuPXRydWUsIGNvbG9yPXtcInJcIjoyNTUsXCJnXCI6MCxcImJcIjowLFwiYVwiOjI1NX0gb3IgXCIjRkYwMDAwXCIsIHZlYzI9e1wieFwiOjEwMCxcInlcIjo1MH0sIHZlYzM9e1wieFwiOjEsXCJ5XCI6MixcInpcIjozfSwgc2l6ZT17XCJ3aWR0aFwiOjEwMCxcImhlaWdodFwiOjUwfSwgbm9kZS9jb21wb25lbnQvYXNzZXQgKG9yIGFueSBzcGVjaWZpYyBhc3NldCB0eXBlOiBzcHJpdGVGcmFtZS9wcmVmYWIvbWF0ZXJpYWwvdGV4dHVyZS9zcHJpdGVBdGxhcy9hdWRpb0NsaXAvZm9udC9hbmltYXRpb25DbGlwL21lc2gvc2tlbGV0b24vcGh5c2ljc01hdGVyaWFsL3JlbmRlclRleHR1cmUvdGV4dEFzc2V0L2pzb25Bc3NldC9wYXJ0aWNsZUFzc2V0L3NjZW5lQXNzZXQpPVwidXVpZC1zdHJpbmdcIiwgbm9kZUFycmF5PVtcInV1aWQxXCIsXCJ1dWlkMlwiXSwgY29tcG9uZW50QXJyYXk9W1wibm9kZS11dWlkMVwiLFwibm9kZS11dWlkMlwiXSAoZWFjaCBhIG5vZGUgVVVJRCBjb250YWluaW5nIHRoZSB0YXJnZXQgY29tcG9uZW50LCBzYW1lIGFzIFwiY29tcG9uZW50XCIpLCBjb2xvckFycmF5PVt7XCJyXCI6MjU1LC4uLn1dLCBudW1iZXJBcnJheT1bMSwyLDNdLCBzdHJpbmdBcnJheT1bXCJhXCIsXCJiXCJdJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0aWVzX2JhdGNoXSBBcnJheSBvZiBwcm9wZXJ0eSBlbnRyaWVzIHRvIHNldCBvbiB0aGUgU0FNRSBjb21wb25lbnQgaW4gb25lIGNhbGwuIEVhY2ggZW50cnk6IHtwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZX0gd2l0aCB0aGUgc2FtZSBzZW1hbnRpY3MgYXMgc2V0X3Byb3BlcnR5LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgcGVyIGVudHJ5IChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKS4gRWFjaCBlbnRyeSBpcyBhcHBsaWVkIGluZGVwZW5kZW50bHkg4oCUIGEgZmFpbHVyZSBvbiBvbmUgZmllbGQgZG9lcyBub3QgYWJvcnQgdGhlIG90aGVyczsgdGhlIHJlc3VsdCByZXBvcnRzIHBlci1maWVsZCBzdWNjZXNzL2Vycm9yLicsXG4gICAgICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnR5OiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcm9wZXJ0eSBuYW1lIHRvIHNldC4gU3VwcG9ydHMgZG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlUeXBlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bTogWy4uLlNVUFBPUlRFRF9QUk9QRVJUWV9UWVBFU10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcm9wZXJ0eSBkYXRhIHR5cGUgZm9yIGNvcnJlY3QgdmFsdWUgY29udmVyc2lvbi4gTXVzdCBtYXRjaCB0aGUgYWN0dWFsIHByb3BlcnR5IHR5cGUuIFVzZSBcImFzc2V0XCIgYXMgdGhlIGdlbmVyaWMgZmFsbGJhY2sgZm9yIGFueSBDb2NvcyBhc3NldC1yZWZlcmVuY2UgcHJvcGVydHkgKHNwcml0ZUZyYW1lL21hdGVyaWFsL3RleHR1cmUvZXRjLiBhcmUgYWxzbyBhY2NlcHRlZCBkaXJlY3RseSBhbmQgYmVoYXZlIGlkZW50aWNhbGx5KS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IHZhbHVlLiBTYW1lIGZvcm1hdCBydWxlcyBhcyBzZXRfcHJvcGVydHkgdmFsdWUgKGRlcGVuZHMgb24gcHJvcGVydHlUeXBlKS4nXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Byb3BlcnR5JywgJ3Byb3BlcnR5VHlwZScsICd2YWx1ZSddXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjcmlwdFBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thdHRhY2hfc2NyaXB0XSBTY3JpcHQgYXNzZXQgcGF0aCAoZS5nLiwgZGI6Ly9hc3NldHMvc2NyaXB0cy9NeVNjcmlwdC50cyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2F0ZWdvcnk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FsbCcsICdyZW5kZXJlcicsICd1aScsICdwaHlzaWNzJywgJ2FuaW1hdGlvbicsICdhdWRpbyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9hdmFpbGFibGVdIENvbXBvbmVudCBjYXRlZ29yeSBmaWx0ZXIuIERlZmF1bHQ6IGFsbCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2FsbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGFkZDogKGFyZ3MpID0+IHRoaXMuYWRkQ29tcG9uZW50KGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIHJlbW92ZTogKGFyZ3MpID0+IHRoaXMucmVtb3ZlQ29tcG9uZW50KGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIGdldF9hbGw6IChhcmdzKSA9PiB0aGlzLmdldENvbXBvbmVudHMoYXJncy5ub2RlVXVpZCksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKGFyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tcG9uZW50VHlwZSksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0Q29tcG9uZW50UHJvcGVydHkoYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0aWVzX2JhdGNoOiAoYXJncykgPT4gdGhpcy5zZXRDb21wb25lbnRQcm9wZXJ0aWVzQmF0Y2goYXJncyksXG4gICAgICAgIGF0dGFjaF9zY3JpcHQ6IChhcmdzKSA9PiBhdHRhY2hTY3JpcHRUb05vZGUoYXJncy5ub2RlVXVpZCwgYXJncy5zY3JpcHRQYXRoLCAodXVpZCkgPT4gdGhpcy5nZXRDb21wb25lbnRzKHV1aWQpKSxcbiAgICAgICAgZ2V0X2F2YWlsYWJsZTogKGFyZ3MpID0+IFByb21pc2UucmVzb2x2ZShnZXRBdmFpbGFibGVDb21wb25lbnRzTGlzdChhcmdzLmNhdGVnb3J5KSlcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogTWF0Y2ggYSBkdW1wIGNvbXBvbmVudCBhZ2FpbnN0IHdoYXRldmVyIHNwZWxsaW5nIHRoZSBjYWxsZXIgdXNlZC5cbiAgICAgKlxuICAgICAqIGBjcmVhdGUtY29tcG9uZW50YCBhY2NlcHRzIGEgcmVhZGFibGUgY2xhc3MgbmFtZSwgYnV0IGBxdWVyeS1ub2RlYCBsaXN0cyBhIGN1c3RvbVxuICAgICAqIGBAY2NjbGFzc2Agc2NyaXB0IHVuZGVyIGl0cyBDT01QUkVTU0VEIENJRCAodGhlIGZpcnN0IGZpdmUgaGV4IGNoYXJhY3RlcnMgb2YgdGhlXG4gICAgICogc2NyaXB0IGFzc2V0IHV1aWQgcGx1cyBhIGJhc2U2NCB0YWlsKSwgc28gYGNvbXAudHlwZSA9PT0gJ015Q29udHJvbGxlcidgIGlzIG5ldmVyXG4gICAgICogdHJ1ZSBmb3IgYSBwcm9qZWN0IHNjcmlwdC4gVGhlIHJlYWRhYmxlIG5hbWUgc3Vydml2ZXMgaW4gZXhhY3RseSBvbmUgcGxhY2UgaW4gdGhlXG4gICAgICogZHVtcCDigJQgYHZhbHVlLm5hbWVgLCBmb3JtYXR0ZWQgYCR7bm9kZU5hbWV9PCR7Y2xhc3NOYW1lfT5gLlxuICAgICAqXG4gICAgICogQnVpbHQtaW4gY29tcG9uZW50cyBhcmUgdW5hZmZlY3RlZDogYGNjLlNwcml0ZWAgbWF0Y2hlcyBvbiBgdHlwZWAgYXMgYmVmb3JlLlxuICAgICAqL1xuICAgIHByaXZhdGUgc3RhdGljIG1hdGNoZXNDb21wb25lbnQoY29tcDogYW55LCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgaWYgKGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSkgcmV0dXJuIHRydWU7XG4gICAgICAgIGlmIChjb21wLnV1aWQgJiYgY29tcC51dWlkID09PSBjb21wb25lbnRUeXBlKSByZXR1cm4gdHJ1ZTtcblxuICAgICAgICBjb25zdCBkdW1wTmFtZSA9IGNvbXAucHJvcGVydGllcz8ubmFtZT8udmFsdWU7XG4gICAgICAgIHJldHVybiB0eXBlb2YgZHVtcE5hbWUgPT09ICdzdHJpbmcnICYmIGR1bXBOYW1lLmVuZHNXaXRoKGA8JHtjb21wb25lbnRUeXBlfT5gKTtcbiAgICB9XG5cbiAgICAvKiogVGhlIGlkZW50aXR5IGEgY2FsbGVyIG5lZWRzIGZvciBldmVyeSBGT0xMT1ctVVAgY2FsbDogZ2V0X2luZm8sIHNldF9wcm9wZXJ0eSwgcmVtb3ZlLiAqL1xuICAgIHByaXZhdGUgc3RhdGljIGNvbXBvbmVudElkZW50aXR5KG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZywgY29tcDogYW55KSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBub2RlVXVpZCxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICAvLyBUaGUgY2lkLCB3aGljaCBpcyB3aGF0IGV2ZXJ5IG90aGVyIGFjdGlvbiBvbiB0aGlzIHRvb2wgZXhwZWN0cy4gUmV0dXJuaW5nIGl0XG4gICAgICAgICAgICAvLyBzYXZlcyB0aGUgY2FsbGVyIGEgZ2V0X2FsbCByb3VuZC10cmlwIGp1c3QgdG8gdHJhbnNsYXRlIHRoZWlyIG93biBjbGFzcyBuYW1lLlxuICAgICAgICAgICAgcmVzb2x2ZWRUeXBlOiBjb21wPy50eXBlID8/IGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICBjb21wb25lbnRVdWlkOiBjb21wPy51dWlkID8/IG51bGwsXG4gICAgICAgICAgICBjb21wb25lbnRWZXJpZmllZDogdHJ1ZVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYWRkQ29tcG9uZW50KG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGFuZCBjb21wb25lbnRUeXBlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPWFkZCcpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENoZWNrIGlmIGNvbXBvbmVudCBhbHJlYWR5IGV4aXN0cyBvbiBub2RlXG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHNJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKGFsbENvbXBvbmVudHNJbmZvLnN1Y2Nlc3MgJiYgYWxsQ29tcG9uZW50c0luZm8uZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdDb21wb25lbnQgPSBhbGxDb21wb25lbnRzSW5mby5kYXRhLmNvbXBvbmVudHMuZmluZChcbiAgICAgICAgICAgICAgICAoY29tcDogYW55KSA9PiBNYW5hZ2VDb21wb25lbnQubWF0Y2hlc0NvbXBvbmVudChjb21wLCBjb21wb25lbnRUeXBlKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChleGlzdGluZ0NvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IC4uLk1hbmFnZUNvbXBvbmVudC5jb21wb25lbnRJZGVudGl0eShub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgZXhpc3RpbmdDb21wb25lbnQpLCBleGlzdGluZzogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBhbHJlYWR5IGV4aXN0cyBvbiBub2RlYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gVHJ5IGFkZGluZyBjb21wb25lbnQgdmlhIEVkaXRvciBBUEkgZGlyZWN0bHlcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgY29tcG9uZW50OiBjb21wb25lbnRUeXBlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGVkaXRvciB0byBmaW5pc2ggYWRkaW5nIHRoZSBjb21wb25lbnRcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDApKTtcbiAgICAgICAgICAgIC8vIFJlLXF1ZXJ5IHRvIHZlcmlmeSB0aGUgY29tcG9uZW50IHdhcyBhY3R1YWxseSBhZGRlZFxuICAgICAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8yID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChhbGxDb21wb25lbnRzSW5mbzIuc3VjY2VzcyAmJiBhbGxDb21wb25lbnRzSW5mbzIuZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFkZGVkQ29tcG9uZW50ID0gYWxsQ29tcG9uZW50c0luZm8yLmRhdGEuY29tcG9uZW50cy5maW5kKFxuICAgICAgICAgICAgICAgICAgICAoY29tcDogYW55KSA9PiBNYW5hZ2VDb21wb25lbnQubWF0Y2hlc0NvbXBvbmVudChjb21wLCBjb21wb25lbnRUeXBlKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKGFkZGVkQ29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgeyAuLi5NYW5hZ2VDb21wb25lbnQuY29tcG9uZW50SWRlbnRpdHkobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIGFkZGVkQ29tcG9uZW50KSwgZXhpc3Rpbmc6IGZhbHNlIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBhZGRlZCBzdWNjZXNzZnVsbHlgXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIHdhcyBub3QgZm91bmQgb24gbm9kZSBhZnRlciBhZGRpdGlvbi4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YWxsQ29tcG9uZW50c0luZm8yLmRhdGEuY29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpfWApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gdmVyaWZ5IGNvbXBvbmVudCBhZGRpdGlvbjogJHthbGxDb21wb25lbnRzSW5mbzIuZXJyb3IgfHwgJ1VuYWJsZSB0byBnZXQgbm9kZSBjb21wb25lbnRzJ31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrOiB1c2Ugc2NlbmUgc2NyaXB0XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnYWRkQ29tcG9uZW50VG9Ob2RlJyxcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW25vZGVVdWlkLCBjb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCBgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyMjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmVDb21wb25lbnQobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249cmVtb3ZlJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gR2V0IGFsbCBjb21wb25lbnRzIHNvIHdlIGNhbiByZXNvbHZlIGNvbXBvbmVudFR5cGUgdG8gdGhlIGNvbXBvbmVudCdzIE9XTiB1dWlkLlxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmICghYWxsQ29tcG9uZW50c0luZm8uc3VjY2VzcyB8fCAhYWxsQ29tcG9uZW50c0luZm8uZGF0YT8uY29tcG9uZW50cykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZ2V0IGNvbXBvbmVudHMgZm9yIG5vZGUgJyR7bm9kZVV1aWR9JzogJHthbGxDb21wb25lbnRzSW5mby5lcnJvcn1gKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzOiBhbnlbXSA9IGFsbENvbXBvbmVudHNJbmZvLmRhdGEuY29tcG9uZW50cztcblxuICAgICAgICAvLyBBY2NlcHQgZWl0aGVyIHRoZSB0eXBlIGZpZWxkIChjaWQsIGUuZy4gXCJjYy5TcHJpdGVcIiBvciBhIHNjcmlwdCBjaWQpIOKAlCB0aGVcbiAgICAgICAgLy8gZXJnb25vbWljIGZvcm0g4oCUIG9yIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCwgZm9yIGNhbGxlcnMgdGhhdCBhbHJlYWR5IGhhdmUgaXQuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGFsbENvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IGNvbXBvbmVudFR5cGUpXG4gICAgICAgICAgICB8fCBhbGxDb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC51dWlkICYmIGNvbXAudXVpZCA9PT0gY29tcG9uZW50VHlwZSk7XG4gICAgICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICAgICAgICBjb25zdCBhdmFpbGFibGVUeXBlcyA9IGFsbENvbXBvbmVudHMubWFwKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSkuam9pbignLCAnKTtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZSAnJHtub2RlVXVpZH0nLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGVUeXBlc30uIFVzZSBhY3Rpb249Z2V0X2FsbCB0byBnZXQgdGhlIHR5cGUgZmllbGQgKGNpZCkgb3IgdXVpZCBmb3IgY29tcG9uZW50VHlwZS5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRoZSBlZGl0b3IncyAncmVtb3ZlLWNvbXBvbmVudCcgdGFrZXMgdGhlIENPTVBPTkVOVCdzIHV1aWQgKFJlbW92ZUNvbXBvbmVudE9wdGlvbnNcbiAgICAgICAgLy8gaXMgeyB1dWlkOiBzdHJpbmcgfSDigJQgaXRzIGBjb21wb25lbnRgIGZpZWxkIGlzIGFuIHVudXNlZCBwYXJhbWV0ZXIpLiBQYXNzaW5nIHRoZVxuICAgICAgICAvLyBub2RlIHV1aWQgaGVyZSBpcyB3aGF0IG1hZGUgcmVtb3ZhbCBzaWxlbnRseSBmYWlsLlxuICAgICAgICBjb25zdCBjb21wb25lbnRVdWlkID0gdGFyZ2V0LnV1aWQ7XG4gICAgICAgIGlmICghY29tcG9uZW50VXVpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb3VsZCBub3QgcmVzb2x2ZSB0aGUgY29tcG9uZW50IHV1aWQgZm9yICcke2NvbXBvbmVudFR5cGV9JyBvbiBub2RlICcke25vZGVVdWlkfScuIFRoZSBlZGl0b3IgcmVxdWlyZXMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIHRvIHJlbW92ZSBpdC5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZW1vdmUtY29tcG9uZW50Jywge1xuICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXBvbmVudFV1aWRcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgdGhlIGVkaXRvciB0byBmaW5pc2ggcmVtb3ZpbmcgdGhlIGNvbXBvbmVudFxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuICAgICAgICAgICAgLy8gUmUtcXVlcnkgdG8gY29uZmlybSByZW1vdmFsIOKAlCBtYXRjaCBvbiB0aGUgcmVzb2x2ZWQgY29tcG9uZW50IHV1aWQgc28gYSBub2RlXG4gICAgICAgICAgICAvLyBjYXJyeWluZyB0d28gY29tcG9uZW50cyBvZiB0aGUgc2FtZSB0eXBlIHJlcG9ydHMgYWNjdXJhdGVseS5cbiAgICAgICAgICAgIGNvbnN0IGFmdGVyUmVtb3ZlSW5mbyA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgICAgICBjb25zdCBzdGlsbEV4aXN0cyA9IGFmdGVyUmVtb3ZlSW5mby5zdWNjZXNzICYmIGFmdGVyUmVtb3ZlSW5mby5kYXRhPy5jb21wb25lbnRzPy5zb21lKChjb21wOiBhbnkpID0+IGNvbXAudXVpZCA9PT0gY29tcG9uZW50VXVpZCk7XG4gICAgICAgICAgICBpZiAoc3RpbGxFeGlzdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgKHV1aWQgJHtjb21wb25lbnRVdWlkfSkgd2FzIG5vdCByZW1vdmVkIGZyb20gbm9kZSAnJHtub2RlVXVpZH0nLmApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgY29tcG9uZW50VXVpZCB9LFxuICAgICAgICAgICAgICAgICAgICBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyAodXVpZCAke2NvbXBvbmVudFV1aWR9KSByZW1vdmVkIHN1Y2Nlc3NmdWxseSBmcm9tIG5vZGUgJyR7bm9kZVV1aWR9J2BcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVtb3ZlIGNvbXBvbmVudDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29tcG9uZW50cyhub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1nZXRfYWxsJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmIChub2RlRGF0YSAmJiBub2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gbm9kZURhdGEuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8IGNvbXAuY2lkIHx8IGNvbXAudHlwZSB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZSBkdW1wIG5lc3RzIHRoZSBjb21wb25lbnQncyBvd24gdXVpZCB1bmRlciB2YWx1ZS51dWlkLnZhbHVlOyB0aGVcbiAgICAgICAgICAgICAgICAgICAgLy8gdG9wLWxldmVsIGNvbXAudXVpZCBkb2VzIG5vdCBleGlzdCwgc28gcmVhZCB0aGUgZHVtcCBmb3JtIGZpcnN0LlxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBjb21wLnZhbHVlPy51dWlkPy52YWx1ZSB8fCBjb21wLnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZCB8fCBudWxsLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHRoaXMuZXh0cmFjdENvbXBvbmVudFByb3BlcnRpZXMoY29tcClcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCwgY29tcG9uZW50cyB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3Igbm8gY29tcG9uZW50cyBkYXRhJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0Tm9kZUluZm8nLCBhcmdzOiBbbm9kZVV1aWRdXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YS5jb21wb25lbnRzKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvbXBvbmVudEluZm8obm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249Z2V0X2luZm8nKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBSb3V0ZSB0aHJvdWdoIGdldENvbXBvbmVudHMgKyBtYXRjaGVzQ29tcG9uZW50IHNvIGEgY3VzdG9tIEBjY2NsYXNzIGNsYXNzIG5hbWVcbiAgICAgICAgLy8gcmVzb2x2ZXMgdGhlIHNhbWUgd2F5IGFjdGlvbj1hZGQgZG9lcyAoaXNzdWUgIzQ0KTogcXVlcnktbm9kZSBsaXN0cyBwcm9qZWN0XG4gICAgICAgIC8vIHNjcmlwdHMgdW5kZXIgdGhlaXIgY29tcHJlc3NlZCBjaWQsIHdoaWxlIHRoZSByZWFkYWJsZSBuYW1lIGxpdmVzIG9ubHkgaW5cbiAgICAgICAgLy8gYHZhbHVlLm5hbWVgIGFzIGAke25vZGVOYW1lfTwke2NsYXNzTmFtZX0+YCwgd2hpY2ggbWF0Y2hlc0NvbXBvbmVudCBjaGVja3MuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHNSZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmICghY29tcG9uZW50c1Jlc3BvbnNlLnN1Y2Nlc3MgfHwgIWNvbXBvbmVudHNSZXNwb25zZS5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoY29tcG9uZW50c1Jlc3BvbnNlLmVycm9yIHx8ICdOb2RlIG5vdCBmb3VuZCBvciBubyBjb21wb25lbnRzIGRhdGEnKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb21wb25lbnQgPSBjb21wb25lbnRzUmVzcG9uc2UuZGF0YS5jb21wb25lbnRzLmZpbmQoXG4gICAgICAgICAgICAoY29tcDogYW55KSA9PiBNYW5hZ2VDb21wb25lbnQubWF0Y2hlc0NvbXBvbmVudChjb21wLCBjb21wb25lbnRUeXBlKVxuICAgICAgICApO1xuICAgICAgICBpZiAoY29tcG9uZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcG9uZW50LmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXBvbmVudC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiBjb21wb25lbnQucHJvcGVydGllc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlLiBBdmFpbGFibGUgY29tcG9uZW50czogJHtjb21wb25lbnRzUmVzcG9uc2UuZGF0YS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PiBjLnR5cGUpLmpvaW4oJywgJyl9YCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wb25lbnQ6IGFueSk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuICAgICAgICAvLyBJZiB0aGUgY29tcG9uZW50IGhhcyBhIHZhbHVlIHByb3BlcnR5LCBpdCBjb250YWlucyBhbGwgYWN0dWFsIGNvbXBvbmVudCBwcm9wZXJ0aWVzXG4gICAgICAgIGlmIChjb21wb25lbnQudmFsdWUgJiYgdHlwZW9mIGNvbXBvbmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBjb21wb25lbnQudmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gRmFsbGJhY2s6IGV4dHJhY3QgcHJvcGVydGllcyBkaXJlY3RseSBmcm9tIHRoZSBjb21wb25lbnQgb2JqZWN0XG4gICAgICAgIGNvbnN0IHByb3BlcnRpZXM6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgY29uc3QgZXhjbHVkZUtleXMgPSBbJ19fdHlwZV9fJywgJ2VuYWJsZWQnLCAnbm9kZScsICdfaWQnLCAnX19zY3JpcHRBc3NldCcsICd1dWlkJywgJ25hbWUnLCAnX25hbWUnLCAnX29iakZsYWdzJywgJ19lbmFibGVkJywgJ3R5cGUnLCAncmVhZG9ubHknLCAndmlzaWJsZScsICdjaWQnLCAnZWRpdG9yJywgJ2V4dGVuZHMnXTtcbiAgICAgICAgZm9yIChjb25zdCBrZXkgaW4gY29tcG9uZW50KSB7XG4gICAgICAgICAgICBpZiAoIWV4Y2x1ZGVLZXlzLmluY2x1ZGVzKGtleSkgJiYgIWtleS5zdGFydHNXaXRoKCdfJykpIHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzW2tleV0gPSBjb21wb25lbnRba2V5XTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcHJvcGVydGllcztcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldENvbXBvbmVudFByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9ID0gYXJncztcblxuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFjb21wb25lbnRUeXBlIHx8ICFwcm9wZXJ0eSB8fCBwcm9wZXJ0eVR5cGUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249c2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDA6IERldGVjdCBpZiB1c2VyIGlzIHRyeWluZyB0byBzZXQgYSBub2RlIHByb3BlcnR5OyByZWRpcmVjdCB3aXRoIGd1aWRhbmNlXG4gICAgICAgIGNvbnN0IG5vZGVSZWRpcmVjdFJlc3VsdCA9IHJlZGlyZWN0Tm9kZVByb3BlcnR5QWNjZXNzKGFyZ3MpO1xuICAgICAgICBpZiAobm9kZVJlZGlyZWN0UmVzdWx0KSB7XG4gICAgICAgICAgICByZXR1cm4gbm9kZVJlZGlyZWN0UmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAxOiBSZXNvbHZlIHRoZSB0YXJnZXQgY29tcG9uZW50IChhbmQgaXRzIHJhdyBfX2NvbXBzX18gaW5kZXgpIG9uY2UuXG4gICAgICAgIGNvbnN0IHJlc29sdXRpb24gPSBhd2FpdCB0aGlzLnJlc29sdmVUYXJnZXRDb21wb25lbnQobm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5KTtcbiAgICAgICAgaWYgKCFyZXNvbHV0aW9uLm9rKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x1dGlvbi5yZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTdGVwIDI6IEFwcGx5IHRoZSBzaW5nbGUgcHJvcGVydHkgdXNpbmcgdGhlIHNoYXJlZCBwZXItZmllbGQgbG9naWMuXG4gICAgICAgIGNvbnN0IGZpZWxkUmVzdWx0ID0gYXdhaXQgdGhpcy5hcHBseVNpbmdsZVByb3BlcnR5KFxuICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHJlc29sdXRpb24udGFyZ2V0Q29tcG9uZW50LCByZXNvbHV0aW9uLnJhd0NvbXBvbmVudEluZGV4LFxuICAgICAgICAgICAgeyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9XG4gICAgICAgICk7XG5cbiAgICAgICAgaWYgKCFmaWVsZFJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZmllbGRSZXN1bHQuZXJyb3IgfHwgYEZhaWxlZCB0byBzZXQgcHJvcGVydHkgJyR7cHJvcGVydHl9J2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgcHJvcGVydHksXG4gICAgICAgICAgICBhY3R1YWxWYWx1ZTogZmllbGRSZXN1bHQuYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICBjaGFuZ2VWZXJpZmllZDogZmllbGRSZXN1bHQuY2hhbmdlVmVyaWZpZWRcbiAgICAgICAgfSwgYFN1Y2Nlc3NmdWxseSBzZXQgJHtjb21wb25lbnRUeXBlfS4ke3Byb3BlcnR5fWApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCBtdWx0aXBsZSBwcm9wZXJ0aWVzIG9uIGEgU0lOR0xFIGNvbXBvbmVudCBpbiBvbmUgY2FsbC5cbiAgICAgKiBUaGUgdGFyZ2V0IGNvbXBvbmVudCBpcyByZXNvbHZlZCBvbmNlOyBlYWNoIHByb3BlcnR5IGVudHJ5IGlzIHRoZW4gYXBwbGllZFxuICAgICAqIGluZGVwZW5kZW50bHkgdmlhIHRoZSBzYW1lIHBlci1maWVsZCBsb2dpYyB1c2VkIGJ5IHNldF9wcm9wZXJ0eSDigJQgc28gYSBmYWlsdXJlXG4gICAgICogb24gb25lIGZpZWxkIGRvZXMgbm90IGFib3J0IHRoZSByZXN0LiBEb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgd29yayBwZXIgZW50cnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb21wb25lbnRQcm9wZXJ0aWVzQmF0Y2goYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHByb3BlcnRpZXMgfSA9IGFyZ3M7XG5cbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1zZXRfcHJvcGVydGllc19iYXRjaCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcm9wZXJ0aWVzKSB8fCBwcm9wZXJ0aWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0aWVzIG11c3QgYmUgYSBub24tZW1wdHkgYXJyYXkgb2Yge3Byb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlfSBlbnRyaWVzIGZvciBhY3Rpb249c2V0X3Byb3BlcnRpZXNfYmF0Y2gnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlc29sdmUgdGhlIHRhcmdldCBjb21wb25lbnQgb25jZSBmb3IgdGhlIHdob2xlIGJhdGNoLlxuICAgICAgICBjb25zdCByZXNvbHV0aW9uID0gYXdhaXQgdGhpcy5yZXNvbHZlVGFyZ2V0Q29tcG9uZW50KG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCB1bmRlZmluZWQpO1xuICAgICAgICBpZiAoIXJlc29sdXRpb24ub2spIHtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHV0aW9uLnJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdHM6IEFycmF5PHsgcHJvcGVydHk6IHN0cmluZzsgc3VjY2VzczogYm9vbGVhbjsgYWN0dWFsVmFsdWU/OiBhbnk7IGNoYW5nZVZlcmlmaWVkPzogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4gPSBbXTtcblxuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHByb3BlcnRpZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5ID0gZW50cnk/LnByb3BlcnR5O1xuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlUeXBlID0gZW50cnk/LnByb3BlcnR5VHlwZTtcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gZW50cnk/LnZhbHVlO1xuXG4gICAgICAgICAgICBpZiAoIXByb3BlcnR5IHx8IHByb3BlcnR5VHlwZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eTogcHJvcGVydHkgfHwgJyhtaXNzaW5nKScsXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0VhY2ggZW50cnkgcmVxdWlyZXMgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgYW5kIHZhbHVlJ1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZpZWxkUmVzdWx0ID0gYXdhaXQgdGhpcy5hcHBseVNpbmdsZVByb3BlcnR5KFxuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcmVzb2x1dGlvbi50YXJnZXRDb21wb25lbnQsIHJlc29sdXRpb24ucmF3Q29tcG9uZW50SW5kZXgsXG4gICAgICAgICAgICAgICAgICAgIHsgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHksXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZpZWxkUmVzdWx0LnN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlOiBmaWVsZFJlc3VsdC5hY3R1YWxWYWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgY2hhbmdlVmVyaWZpZWQ6IGZpZWxkUmVzdWx0LmNoYW5nZVZlcmlmaWVkLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogZmllbGRSZXN1bHQuZXJyb3JcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgLy8gRGVmZW5zaXZlOiBvbmUgYmFkIGZpZWxkIG11c3QgbmV2ZXIgYWJvcnQgdGhlIGJhdGNoLlxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7IHByb3BlcnR5LCBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycj8ubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1Y2NlZWRlZCA9IHJlc3VsdHMuZmlsdGVyKHIgPT4gci5zdWNjZXNzKS5sZW5ndGg7XG4gICAgICAgIGNvbnN0IGZhaWxlZCA9IHJlc3VsdHMubGVuZ3RoIC0gc3VjY2VlZGVkO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gYHNldF9wcm9wZXJ0aWVzX2JhdGNoIG9uICR7Y29tcG9uZW50VHlwZX06ICR7c3VjY2VlZGVkfS8ke3Jlc3VsdHMubGVuZ3RofSBmaWVsZChzKSBzZXQke2ZhaWxlZCA+IDAgPyBgLCAke2ZhaWxlZH0gZmFpbGVkYCA6ICcnfWA7XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgbm9kZVV1aWQsXG4gICAgICAgICAgICBjb21wb25lbnRUeXBlLFxuICAgICAgICAgICAgdG90YWw6IHJlc3VsdHMubGVuZ3RoLFxuICAgICAgICAgICAgc3VjY2VlZGVkLFxuICAgICAgICAgICAgZmFpbGVkLFxuICAgICAgICAgICAgcmVzdWx0c1xuICAgICAgICB9LCBtZXNzYWdlKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIGEgY29tcG9uZW50IG9uIGEgbm9kZSBpbnRvIGl0cyBkdW1wICh0YXJnZXRDb21wb25lbnQpIGFuZCBpdHMgcmF3IF9fY29tcHNfXyBpbmRleC5cbiAgICAgKiBXaGVuIGBwcm9wZXJ0eWAgaXMgcHJvdmlkZWQsIGEgbWlzc2luZyBjb21wb25lbnQgeWllbGRzIGFuIExMTS1mcmllbmRseSBzdWdnZXN0aW9uLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVRhcmdldENvbXBvbmVudChcbiAgICAgICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICAgICAgY29tcG9uZW50VHlwZTogc3RyaW5nLFxuICAgICAgICBwcm9wZXJ0eTogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgKTogUHJvbWlzZTxcbiAgICAgICAgfCB7IG9rOiB0cnVlOyB0YXJnZXRDb21wb25lbnQ6IGFueTsgcmF3Q29tcG9uZW50SW5kZXg6IG51bWJlciB9XG4gICAgICAgIHwgeyBvazogZmFsc2U7IHJlc3VsdDogQWN0aW9uVG9vbFJlc3VsdCB9XG4gICAgPiB7XG4gICAgICAgIC8vIEdldCBhbGwgY29tcG9uZW50cyAoZHVtcCBmb3JtKSBvbiB0aGUgbm9kZS5cbiAgICAgICAgY29uc3QgY29tcG9uZW50c1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFjb21wb25lbnRzUmVzcG9uc2Uuc3VjY2VzcyB8fCAhY29tcG9uZW50c1Jlc3BvbnNlLmRhdGEpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBjb21wb25lbnRzIGZvciBub2RlICcke25vZGVVdWlkfSc6ICR7Y29tcG9uZW50c1Jlc3BvbnNlLmVycm9yfWApIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzID0gY29tcG9uZW50c1Jlc3BvbnNlLmRhdGEuY29tcG9uZW50cztcbiAgICAgICAgbGV0IHRhcmdldENvbXBvbmVudCA9IG51bGw7XG4gICAgICAgIGxldCByZXNvbHZlZEluZGV4ID0gLTE7XG4gICAgICAgIGNvbnN0IGF2YWlsYWJsZVR5cGVzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFsbENvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBhbGxDb21wb25lbnRzW2ldO1xuICAgICAgICAgICAgYXZhaWxhYmxlVHlwZXMucHVzaChjb21wLnR5cGUpO1xuICAgICAgICAgICAgaWYgKE1hbmFnZUNvbXBvbmVudC5tYXRjaGVzQ29tcG9uZW50KGNvbXAsIGNvbXBvbmVudFR5cGUpKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q29tcG9uZW50ID0gY29tcDtcbiAgICAgICAgICAgICAgICByZXNvbHZlZEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEZhbGxiYWNrOiBjb21wb25lbnRUeXBlIG1heSBiZSBhIHJlYWRhYmxlIGNsYXNzIG5hbWUgKGUuZy4gXCJNeUNvbnRyb2xsZXJcIilcbiAgICAgICAgLy8gd2hpbGUgdGhlIGR1bXAgb25seSBleHBvc2VzIHRoZSBzY3JpcHQncyBjaWQuIFJlc29sdmUgdmlhIHRoZSBzY2VuZSBzY3JpcHQsXG4gICAgICAgIC8vIHdoaWNoIGhhcyB0aGUgbGl2ZSBjYy5qcyBjbGFzcyByZWdpc3RyeSwgdGhlbiBtYXAgYmFjayB0byB0aGUgZHVtcCBjb21wb25lbnRcbiAgICAgICAgLy8gYXQgdGhlIHNhbWUgaW5kZXggKHF1ZXJ5LW5vZGUgX19jb21wc19fIG9yZGVyIG1hdGNoZXMgbm9kZS5jb21wb25lbnRzIG9yZGVyKS5cbiAgICAgICAgaWYgKCF0YXJnZXRDb21wb25lbnQpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYnlOYW1lOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdyZXNvbHZlQ29tcG9uZW50QnlOYW1lJywgYXJnczogW25vZGVVdWlkLCBjb21wb25lbnRUeXBlXVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gYnlOYW1lPy5zdWNjZXNzID8gYnlOYW1lLmRhdGE/LmluZGV4IDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaW5kZXggPT09ICdudW1iZXInICYmIGluZGV4ID49IDAgJiYgaW5kZXggPCBhbGxDb21wb25lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlZEluZGV4ID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldENvbXBvbmVudCA9IGFsbENvbXBvbmVudHNbaW5kZXhdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIC8vIFNjZW5lIHNjcmlwdCB1bmF2YWlsYWJsZSDigJQgZmFsbCB0aHJvdWdoIHRvIHRoZSBub3QtZm91bmQgZXJyb3IgYmVsb3cuXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRhcmdldENvbXBvbmVudCkge1xuICAgICAgICAgICAgY29uc3QgaW5zdHJ1Y3Rpb24gPSBnZW5lcmF0ZUNvbXBvbmVudFN1Z2dlc3Rpb24oY29tcG9uZW50VHlwZSwgYXZhaWxhYmxlVHlwZXMsIHByb3BlcnR5IHx8ICcnKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHJlc3VsdDoge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthdmFpbGFibGVUeXBlcy5qb2luKCcsICcpfWAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEdldCByYXcgbm9kZSBkYXRhIHRvIGJ1aWxkIHRoZSBjb3JyZWN0IF9fY29tcHNfXyBwYXRoLlxuICAgICAgICBjb25zdCByYXdOb2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgIGlmICghcmF3Tm9kZURhdGEgfHwgIXJhd05vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgcmV0dXJuIHsgb2s6IGZhbHNlLCByZXN1bHQ6IGVycm9yUmVzdWx0KCdGYWlsZWQgdG8gZ2V0IHJhdyBub2RlIGRhdGEgZm9yIHByb3BlcnR5IHNldHRpbmcnKSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHJhd0NvbXBvbmVudEluZGV4ID0gLTE7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmF3Tm9kZURhdGEuX19jb21wc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wID0gcmF3Tm9kZURhdGEuX19jb21wc19fW2ldIGFzIGFueTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBUeXBlID0gY29tcC5fX3R5cGVfXyB8fCBjb21wLmNpZCB8fCBjb21wLnR5cGUgfHwgJ1Vua25vd24nO1xuICAgICAgICAgICAgaWYgKGNvbXBUeXBlID09PSBjb21wb25lbnRUeXBlKSB7XG4gICAgICAgICAgICAgICAgcmF3Q29tcG9uZW50SW5kZXggPSBpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIENsYXNzLW5hbWUgcmVzb2x1dGlvbiBwYXRoOiB0aGUgY2lkIHdvbid0IGVxdWFsIGNvbXBvbmVudFR5cGUsIHNvIHJldXNlIHRoZVxuICAgICAgICAvLyBpbmRleCByZXNvbHZlZCBhYm92ZSAoZHVtcCBvcmRlciA9PSByYXcgX19jb21wc19fIG9yZGVyKS5cbiAgICAgICAgaWYgKHJhd0NvbXBvbmVudEluZGV4ID09PSAtMSAmJiByZXNvbHZlZEluZGV4ID49IDAgJiYgcmVzb2x2ZWRJbmRleCA8IHJhd05vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHJhd0NvbXBvbmVudEluZGV4ID0gcmVzb2x2ZWRJbmRleDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChyYXdDb21wb25lbnRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdCgnQ291bGQgbm90IGZpbmQgY29tcG9uZW50IGluZGV4IGZvciBzZXR0aW5nIHByb3BlcnR5JykgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCB0YXJnZXRDb21wb25lbnQsIHJhd0NvbXBvbmVudEluZGV4IH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQXBwbHkgT05FIHByb3BlcnR5IHZhbHVlIHRvIGFuIGFscmVhZHktcmVzb2x2ZWQgY29tcG9uZW50LlxuICAgICAqIFNoYXJlZCBieSBzZXRfcHJvcGVydHkgKHNpbmdsZSkgYW5kIHNldF9wcm9wZXJ0aWVzX2JhdGNoIChwZXIgZW50cnkpLlxuICAgICAqIFJldHVybnMgYSBwZXItZmllbGQgcmVzdWx0IHJhdGhlciB0aGFuIHRocm93aW5nLCBzbyBjYWxsZXJzIGNhbiBhZ2dyZWdhdGUuXG4gICAgICogRG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIChlLmcuLCBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKSBhcmUgc3VwcG9ydGVkXG4gICAgICogYmVjYXVzZSBhbmFseXplUHJvcGVydHkgLyBhcHBseVByb3BlcnR5VG9FZGl0b3IgLyB2ZXJpZnlDb21wb25lbnRQcm9wZXJ0eUNoYW5nZVxuICAgICAqIGFsbCB3YWxrIGRvdHRlZCBzZWdtZW50cy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGFwcGx5U2luZ2xlUHJvcGVydHkoXG4gICAgICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICAgICAgdGFyZ2V0Q29tcG9uZW50OiBhbnksXG4gICAgICAgIHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXIsXG4gICAgICAgIGZpZWxkOiB7IHByb3BlcnR5OiBzdHJpbmc7IHByb3BlcnR5VHlwZTogc3RyaW5nOyB2YWx1ZTogYW55IH1cbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgYWN0dWFsVmFsdWU/OiBhbnk7IGNoYW5nZVZlcmlmaWVkPzogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBjb25zdCB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH0gPSBmaWVsZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTWFuYWdlQ29tcG9uZW50XSBTZXR0aW5nICR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX0gKHR5cGU6ICR7cHJvcGVydHlUeXBlfSkgPSAke0pTT04uc3RyaW5naWZ5KHZhbHVlKX0gb24gbm9kZSAke25vZGVVdWlkfWApO1xuXG4gICAgICAgICAgICAvLyBBbmFseXplIHRoZSBwcm9wZXJ0eSB0byBnZXQgb3JpZ2luYWwgdmFsdWUgYW5kIHR5cGUgaW5mbyAoc3VwcG9ydHMgZG90dGVkIHBhdGhzKS5cbiAgICAgICAgICAgIGxldCBwcm9wZXJ0eUluZm87XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5SW5mbyA9IGFuYWx5emVQcm9wZXJ0eSh0YXJnZXRDb21wb25lbnQsIHByb3BlcnR5KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGFuYWx5emVFcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGFuYWx5emUgcHJvcGVydHkgJyR7cHJvcGVydHl9JzogJHthbmFseXplRXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghcHJvcGVydHlJbmZvLmV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGZvdW5kIG9uIGNvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScuIEF2YWlsYWJsZSBwcm9wZXJ0aWVzOiAke3Byb3BlcnR5SW5mby5hdmFpbGFibGVQcm9wZXJ0aWVzLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDb252ZXJ0IHZhbHVlIGJhc2VkIG9uIGV4cGxpY2l0IHByb3BlcnR5VHlwZS5cbiAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVmFsdWUgPSBwcm9wZXJ0eUluZm8ub3JpZ2luYWxWYWx1ZTtcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZFZhbHVlOiBhbnkgPSBjb252ZXJ0UHJvcGVydHlWYWx1ZShwcm9wZXJ0eVR5cGUsIHZhbHVlKTtcblxuICAgICAgICAgICAgLy8gQnVpbGQgdGhlIChwb3NzaWJseSBkb3R0ZWQpIGNvbXBvbmVudCBwcm9wZXJ0eSBwYXRoIGFuZCBhcHBseSB2aWEgdHlwZS1hd2FyZSBFZGl0b3IgQVBJLlxuICAgICAgICAgICAgY29uc3QgcHJvcGVydHlQYXRoID0gYF9fY29tcHNfXy4ke3Jhd0NvbXBvbmVudEluZGV4fS4ke3Byb3BlcnR5fWA7XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxFeHBlY3RlZFZhbHVlID0gYXdhaXQgYXBwbHlQcm9wZXJ0eVRvRWRpdG9yKFxuICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIHByb3BlcnR5UGF0aCwgcmF3Q29tcG9uZW50SW5kZXgsIGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlLCBwcm9jZXNzZWRWYWx1ZSB9LFxuICAgICAgICAgICAgICAgICh1dWlkLCB0eXBlKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8odXVpZCwgdHlwZSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIC8vIFdhaXQgZm9yIGVkaXRvciB0byBjb21wbGV0ZSB0aGUgdXBkYXRlLCB0aGVuIHZlcmlmeS5cbiAgICAgICAgICAgIC8vIExvb2sgdXAgYnkgdGhlIFJFU09MVkVEIGR1bXAgdHlwZSAodGFyZ2V0Q29tcG9uZW50LnR5cGUg4oCUIGEgY2lkIHdoZW5cbiAgICAgICAgICAgIC8vIGNvbXBvbmVudFR5cGUgd2FzIGEgY2xhc3MgbmFtZSByZXNvbHZlZCB2aWEgcmVzb2x2ZUNvbXBvbmVudEJ5TmFtZSksXG4gICAgICAgICAgICAvLyBub3QgdGhlIGNhbGxlci1zdXBwbGllZCBjb21wb25lbnRUeXBlOiBnZXRDb21wb25lbnRJbmZvIG1hdGNoZXMgYWdhaW5zdFxuICAgICAgICAgICAgLy8gdGhlIGR1bXAncyBfX3R5cGVfXy9jaWQsIHdoaWNoIG5ldmVyIGVxdWFscyBhIHJlYWRhYmxlIGNsYXNzIG5hbWUsIHNvXG4gICAgICAgICAgICAvLyB2ZXJpZmljYXRpb24gd291bGQgYWx3YXlzIHJlcG9ydCB1bnZlcmlmaWVkIGZvciB0aGUgY2xhc3MtbmFtZSBwYXRoLlxuICAgICAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uID0gYXdhaXQgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UoXG4gICAgICAgICAgICAgICAgbm9kZVV1aWQsIHRhcmdldENvbXBvbmVudC50eXBlIHx8IGNvbXBvbmVudFR5cGUsIHByb3BlcnR5LCBvcmlnaW5hbFZhbHVlLCBhY3R1YWxFeHBlY3RlZFZhbHVlLFxuICAgICAgICAgICAgICAgICh1dWlkLCB0eXBlKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8odXVpZCwgdHlwZSlcbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGlmICghdmVyaWZpY2F0aW9uLnZlcmlmaWVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGFjdHVhbFZhbHVlOiB2ZXJpZmljYXRpb24uYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBQcm9wZXJ0eSAnJHtjb21wb25lbnRUeXBlfS4ke3Byb3BlcnR5fScgd3JpdGUgZGlkIG5vdCB2ZXJpZnk6IGV4cGVjdGVkICR7SlNPTi5zdHJpbmdpZnkoYWN0dWFsRXhwZWN0ZWRWYWx1ZSl9IGJ1dCB0aGUgZWRpdG9yIHJlYWRzIGJhY2sgJHtKU09OLnN0cmluZ2lmeSh2ZXJpZmljYXRpb24uYWN0dWFsVmFsdWUpfWBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBhY3R1YWxWYWx1ZTogdmVyaWZpY2F0aW9uLmFjdHVhbFZhbHVlLCBjaGFuZ2VWZXJpZmllZDogdHJ1ZSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBbTWFuYWdlQ29tcG9uZW50XSBFcnJvciBzZXR0aW5nIHByb3BlcnR5ICcke3Byb3BlcnR5fSc6YCwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHNldCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG59XG4iXX0=