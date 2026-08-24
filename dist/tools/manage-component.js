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
                    description: '[set_property] Property value. Format depends on propertyType: string="text", number=42, boolean=true, color={"r":255,"g":0,"b":0,"a":255} or "#FF0000", vec2={"x":100,"y":50}, vec3={"x":1,"y":2,"z":3}, size={"width":100,"height":50}, node/component/asset (or any specific asset type: spriteFrame/prefab/material/texture/spriteAtlas/audioClip/font/animationClip/mesh/skeleton/physicsMaterial/renderTexture/textAsset/jsonAsset/particleAsset/sceneAsset)="uuid-string", nodeArray=["uuid1","uuid2"], componentArray=["node-uuid1","node-uuid2"] (each a node UUID containing the target component, same as "component"), colorArray=[{"r":255,...}], numberArray=[1,2,3], stringArray=["a","b"]. For any object/array-shaped propertyType (size, vec2, vec3, color, and the *Array types), a JSON-encoded string of the same shape (e.g. \'{"width":94,"height":94}\') is also accepted and parsed automatically — a transport that stringifies structured args does not need special-casing.'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUF3RTtBQUN4RSx5REFBb0Q7QUFDcEQsMkZBQXdRO0FBQ3hRLG1GQUF3RTtBQUN4RSxxRkFBc0U7QUFFdEUsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxrQkFBa0IsQ0FBQztRQUMxQixnQkFBVyxHQUFHLG14QkFBbXhCLENBQUM7UUFDbHlCLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRTdILGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsc0JBQXNCLEVBQUUsZUFBZSxFQUFFLGVBQWUsQ0FBQztvQkFDeEgsV0FBVyxFQUFFLDJXQUEyVztpQkFDM1g7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvSUFBb0k7aUJBQ3BKO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsME9BQTBPO2lCQUMxUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHdPQUF3TztpQkFDeFA7Z0JBQ0QsWUFBWSxFQUFFO29CQUNWLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLEdBQUcsNERBQXdCLENB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SSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FDcEQsQ0FBQztZQUVGLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ3pCLE9BQU87b0JBQ0gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsV0FBVyxFQUFFLFlBQVksQ0FBQyxXQUFXO29CQUNyQyxjQUFjLEVBQUUsS0FBSztvQkFDckIsS0FBSyxFQUFFLGFBQWEsYUFBYSxJQUFJLFFBQVEsb0NBQW9DLElBQUksQ0FBQyxTQUFTLENBQUMsbUJBQW1CLENBQUMsOEJBQThCLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2lCQUMvTCxDQUFDO1lBQ04sQ0FBQztZQUVELE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsV0FBVyxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUMxRixDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLDZDQUE2QyxRQUFRLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoRixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsMkJBQTJCLFFBQVEsTUFBTSxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztRQUMvRixDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBdmlCRCwwQ0F1aUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBhbmFseXplUHJvcGVydHksIGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0eUR1bXAsIGdlbmVyYXRlQ29tcG9uZW50U3VnZ2VzdGlvbiwgY29udmVydFByb3BlcnR5VmFsdWUsIGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0LCByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcywgdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2UsIFNVUFBPUlRFRF9QUk9QRVJUWV9UWVBFUyB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1wcm9wZXJ0eS1oZWxwZXJzJztcbmltcG9ydCB7IGFwcGx5UHJvcGVydHlUb0VkaXRvciB9IGZyb20gJy4vbWFuYWdlLWNvbXBvbmVudC1lZGl0b3ItYXBwbHknO1xuaW1wb3J0IHsgYXR0YWNoU2NyaXB0VG9Ob2RlIH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXNjcmlwdC1hdHRhY2gnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlQ29tcG9uZW50IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2NvbXBvbmVudCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGNvbXBvbmVudHMgb24gc2NlbmUgbm9kZXMuIEFjdGlvbnM6IGFkZD1hZGQgY29tcG9uZW50IHRvIG5vZGUsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50ICh1c2UgdGhlIGNpZCBvciB1dWlkIGZyb20gZ2V0X2FsbCksIGdldF9hbGw9bGlzdCBhbGwgY29tcG9uZW50cyBvbiBub2RlLCBnZXRfaW5mbz1nZXQgc3BlY2lmaWMgY29tcG9uZW50IGRldGFpbHMgYW5kIHByb3BlcnRpZXMsIHNldF9wcm9wZXJ0eT1zZXQgYSBzaW5nbGUgY29tcG9uZW50IHByb3BlcnR5IHZhbHVlIChzdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgbGlrZSBcImNhbWVyYVNlY3Rpb24ubWFpbkNhbWVyYVwiKSwgc2V0X3Byb3BlcnRpZXNfYmF0Y2g9c2V0IG1hbnkgcHJvcGVydGllcyBvbiBvbmUgY29tcG9uZW50IGluIGEgc2luZ2xlIGNhbGwgKGVhY2ggZmllbGQgc2V0IGluZGVwZW5kZW50bHkg4oCUIG9uZSBiYWQgZmllbGQgZG9lcyBub3QgYWJvcnQgdGhlIHJlc3QpLCBhdHRhY2hfc2NyaXB0PWF0dGFjaCBhIFR5cGVTY3JpcHQvSmF2YVNjcmlwdCBzY3JpcHQgY29tcG9uZW50LCBnZXRfYXZhaWxhYmxlPWxpc3QgYXZhaWxhYmxlIGNvbXBvbmVudCB0eXBlcyBieSBjYXRlZ29yeS4gTk9URTogRm9yIG5vZGUgYmFzaWMgcHJvcGVydGllcyAobmFtZSwgYWN0aXZlLCBsYXllcikgdXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1zZXRfcHJvcGVydHkuIEZvciB0cmFuc2Zvcm1zIChwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlKSB1c2UgbWFuYWdlX25vZGUgYWN0aW9uPXNldF90cmFuc2Zvcm0uJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydhZGQnLCAncmVtb3ZlJywgJ2dldF9hbGwnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9wcm9wZXJ0aWVzX2JhdGNoJywgJ2F0dGFjaF9zY3JpcHQnLCAnZ2V0X2F2YWlsYWJsZSddO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FkZCcsICdyZW1vdmUnLCAnZ2V0X2FsbCcsICdnZXRfaW5mbycsICdzZXRfcHJvcGVydHknLCAnc2V0X3Byb3BlcnRpZXNfYmF0Y2gnLCAnYXR0YWNoX3NjcmlwdCcsICdnZXRfYXZhaWxhYmxlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogYWRkPWFkZCBjb21wb25lbnQgdG8gbm9kZSwgcmVtb3ZlPXJlbW92ZSBjb21wb25lbnQgKHVzZSB0aGUgY2lkIG9yIHV1aWQgZnJvbSBnZXRfYWxsKSwgZ2V0X2FsbD1saXN0IGFsbCBjb21wb25lbnRzLCBnZXRfaW5mbz1nZXQgY29tcG9uZW50IGRldGFpbHMsIHNldF9wcm9wZXJ0eT1zZXQgYSBzaW5nbGUgcHJvcGVydHkgdmFsdWUgKGRvdHRlZCBuZXN0ZWQgcGF0aHMgc3VwcG9ydGVkKSwgc2V0X3Byb3BlcnRpZXNfYmF0Y2g9c2V0IG1hbnkgcHJvcGVydGllcyBhdCBvbmNlLCBhdHRhY2hfc2NyaXB0PWF0dGFjaCBhIHNjcmlwdCBmaWxlLCBnZXRfYXZhaWxhYmxlPWxpc3QgYXZhaWxhYmxlIHR5cGVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCByZW1vdmUsIGdldF9hbGwsIGdldF9pbmZvLCBzZXRfcHJvcGVydHksIGF0dGFjaF9zY3JpcHRdIFRhcmdldCBub2RlIFVVSUQuIFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249Z2V0X2FsbCB0byBmaW5kIG5vZGUgVVVJRHMuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbXBvbmVudFR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRdIENvbXBvbmVudCB0eXBlIHRvIGFkZCAoZS5nLiwgY2MuU3ByaXRlLCBjYy5MYWJlbCwgY2MuQnV0dG9uKS4gW3JlbW92ZV0gQ29tcG9uZW50IGNpZCAodGhlIHR5cGUgZmllbGQgZnJvbSBnZXRfYWxsIOKAlCBOT1Qgc2NyaXB0IG5hbWUpLCBvciB0aGUgY29tcG9uZW50IHV1aWQgZmllbGQgZnJvbSBnZXRfYWxsLiBbZ2V0X2luZm8sIHNldF9wcm9wZXJ0eV0gQ29tcG9uZW50IHR5cGUgdG8gdGFyZ2V0LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZSB0byBzZXQuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikuIEV4YW1wbGVzOiBjYy5MYWJlbCDihpIgc3RyaW5nLCBmb250U2l6ZSwgY29sb3I7IGNjLlNwcml0ZSDihpIgc3ByaXRlRnJhbWUsIGNvbG9yOyBjYy5VSVRyYW5zZm9ybSDihpIgY29udGVudFNpemUsIGFuY2hvclBvaW50LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbLi4uU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4gVXNlIFwiYXNzZXRcIiBhcyB0aGUgZ2VuZXJpYyBmYWxsYmFjayBmb3IgYW55IENvY29zIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eSAoc3ByaXRlRnJhbWUvbWF0ZXJpYWwvdGV4dHVyZS9ldGMuIGFyZSBhbHNvIGFjY2VwdGVkIGRpcmVjdGx5IGFuZCBiZWhhdmUgaWRlbnRpY2FsbHkpLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgdmFsdWUuIEZvcm1hdCBkZXBlbmRzIG9uIHByb3BlcnR5VHlwZTogc3RyaW5nPVwidGV4dFwiLCBudW1iZXI9NDIsIGJvb2xlYW49dHJ1ZSwgY29sb3I9e1wiclwiOjI1NSxcImdcIjowLFwiYlwiOjAsXCJhXCI6MjU1fSBvciBcIiNGRjAwMDBcIiwgdmVjMj17XCJ4XCI6MTAwLFwieVwiOjUwfSwgdmVjMz17XCJ4XCI6MSxcInlcIjoyLFwielwiOjN9LCBzaXplPXtcIndpZHRoXCI6MTAwLFwiaGVpZ2h0XCI6NTB9LCBub2RlL2NvbXBvbmVudC9hc3NldCAob3IgYW55IHNwZWNpZmljIGFzc2V0IHR5cGU6IHNwcml0ZUZyYW1lL3ByZWZhYi9tYXRlcmlhbC90ZXh0dXJlL3Nwcml0ZUF0bGFzL2F1ZGlvQ2xpcC9mb250L2FuaW1hdGlvbkNsaXAvbWVzaC9za2VsZXRvbi9waHlzaWNzTWF0ZXJpYWwvcmVuZGVyVGV4dHVyZS90ZXh0QXNzZXQvanNvbkFzc2V0L3BhcnRpY2xlQXNzZXQvc2NlbmVBc3NldCk9XCJ1dWlkLXN0cmluZ1wiLCBub2RlQXJyYXk9W1widXVpZDFcIixcInV1aWQyXCJdLCBjb21wb25lbnRBcnJheT1bXCJub2RlLXV1aWQxXCIsXCJub2RlLXV1aWQyXCJdIChlYWNoIGEgbm9kZSBVVUlEIGNvbnRhaW5pbmcgdGhlIHRhcmdldCBjb21wb25lbnQsIHNhbWUgYXMgXCJjb21wb25lbnRcIiksIGNvbG9yQXJyYXk9W3tcInJcIjoyNTUsLi4ufV0sIG51bWJlckFycmF5PVsxLDIsM10sIHN0cmluZ0FycmF5PVtcImFcIixcImJcIl0uIEZvciBhbnkgb2JqZWN0L2FycmF5LXNoYXBlZCBwcm9wZXJ0eVR5cGUgKHNpemUsIHZlYzIsIHZlYzMsIGNvbG9yLCBhbmQgdGhlICpBcnJheSB0eXBlcyksIGEgSlNPTi1lbmNvZGVkIHN0cmluZyBvZiB0aGUgc2FtZSBzaGFwZSAoZS5nLiBcXCd7XCJ3aWR0aFwiOjk0LFwiaGVpZ2h0XCI6OTR9XFwnKSBpcyBhbHNvIGFjY2VwdGVkIGFuZCBwYXJzZWQgYXV0b21hdGljYWxseSDigJQgYSB0cmFuc3BvcnQgdGhhdCBzdHJpbmdpZmllcyBzdHJ1Y3R1cmVkIGFyZ3MgZG9lcyBub3QgbmVlZCBzcGVjaWFsLWNhc2luZy4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnRpZXNfYmF0Y2hdIEFycmF5IG9mIHByb3BlcnR5IGVudHJpZXMgdG8gc2V0IG9uIHRoZSBTQU1FIGNvbXBvbmVudCBpbiBvbmUgY2FsbC4gRWFjaCBlbnRyeToge3Byb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlfSB3aXRoIHRoZSBzYW1lIHNlbWFudGljcyBhcyBzZXRfcHJvcGVydHkuIFN1cHBvcnRzIGRvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyBwZXIgZW50cnkgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLiBFYWNoIGVudHJ5IGlzIGFwcGxpZWQgaW5kZXBlbmRlbnRseSDigJQgYSBmYWlsdXJlIG9uIG9uZSBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgb3RoZXJzOyB0aGUgcmVzdWx0IHJlcG9ydHMgcGVyLWZpZWxkIHN1Y2Nlc3MvZXJyb3IuJyxcbiAgICAgICAgICAgICAgICBpdGVtczoge1xuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IG5hbWUgdG8gc2V0LiBTdXBwb3J0cyBkb3R0ZWQgbmVzdGVkIENDQ2xhc3MgcGF0aHMgKGUuZy4sIFwiY2FtZXJhU2VjdGlvbi5tYWluQ2FtZXJhXCIpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eVR5cGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtOiBbLi4uU1VQUE9SVEVEX1BST1BFUlRZX1RZUEVTXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb3BlcnR5IGRhdGEgdHlwZSBmb3IgY29ycmVjdCB2YWx1ZSBjb252ZXJzaW9uLiBNdXN0IG1hdGNoIHRoZSBhY3R1YWwgcHJvcGVydHkgdHlwZS4gVXNlIFwiYXNzZXRcIiBhcyB0aGUgZ2VuZXJpYyBmYWxsYmFjayBmb3IgYW55IENvY29zIGFzc2V0LXJlZmVyZW5jZSBwcm9wZXJ0eSAoc3ByaXRlRnJhbWUvbWF0ZXJpYWwvdGV4dHVyZS9ldGMuIGFyZSBhbHNvIGFjY2VwdGVkIGRpcmVjdGx5IGFuZCBiZWhhdmUgaWRlbnRpY2FsbHkpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJvcGVydHkgdmFsdWUuIFNhbWUgZm9ybWF0IHJ1bGVzIGFzIHNldF9wcm9wZXJ0eSB2YWx1ZSAoZGVwZW5kcyBvbiBwcm9wZXJ0eVR5cGUpLidcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsncHJvcGVydHknLCAncHJvcGVydHlUeXBlJywgJ3ZhbHVlJ11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NyaXB0UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2F0dGFjaF9zY3JpcHRdIFNjcmlwdCBhc3NldCBwYXRoIChlLmcuLCBkYjovL2Fzc2V0cy9zY3JpcHRzL015U2NyaXB0LnRzKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYXRlZ29yeToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWxsJywgJ3JlbmRlcmVyJywgJ3VpJywgJ3BoeXNpY3MnLCAnYW5pbWF0aW9uJywgJ2F1ZGlvJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2F2YWlsYWJsZV0gQ29tcG9uZW50IGNhdGVnb3J5IGZpbHRlci4gRGVmYXVsdDogYWxsJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnYWxsJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgYWRkOiAoYXJncykgPT4gdGhpcy5hZGRDb21wb25lbnQoYXJncy5ub2RlVXVpZCwgYXJncy5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgcmVtb3ZlOiAoYXJncykgPT4gdGhpcy5yZW1vdmVDb21wb25lbnQoYXJncy5ub2RlVXVpZCwgYXJncy5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgZ2V0X2FsbDogKGFyZ3MpID0+IHRoaXMuZ2V0Q29tcG9uZW50cyhhcmdzLm5vZGVVdWlkKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldENvbXBvbmVudEluZm8oYXJncy5ub2RlVXVpZCwgYXJncy5jb21wb25lbnRUeXBlKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRDb21wb25lbnRQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgc2V0X3Byb3BlcnRpZXNfYmF0Y2g6IChhcmdzKSA9PiB0aGlzLnNldENvbXBvbmVudFByb3BlcnRpZXNCYXRjaChhcmdzKSxcbiAgICAgICAgYXR0YWNoX3NjcmlwdDogKGFyZ3MpID0+IGF0dGFjaFNjcmlwdFRvTm9kZShhcmdzLm5vZGVVdWlkLCBhcmdzLnNjcmlwdFBhdGgsICh1dWlkKSA9PiB0aGlzLmdldENvbXBvbmVudHModXVpZCkpLFxuICAgICAgICBnZXRfYXZhaWxhYmxlOiAoYXJncykgPT4gUHJvbWlzZS5yZXNvbHZlKGdldEF2YWlsYWJsZUNvbXBvbmVudHNMaXN0KGFyZ3MuY2F0ZWdvcnkpKVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBNYXRjaCBhIGR1bXAgY29tcG9uZW50IGFnYWluc3Qgd2hhdGV2ZXIgc3BlbGxpbmcgdGhlIGNhbGxlciB1c2VkLlxuICAgICAqXG4gICAgICogYGNyZWF0ZS1jb21wb25lbnRgIGFjY2VwdHMgYSByZWFkYWJsZSBjbGFzcyBuYW1lLCBidXQgYHF1ZXJ5LW5vZGVgIGxpc3RzIGEgY3VzdG9tXG4gICAgICogYEBjY2NsYXNzYCBzY3JpcHQgdW5kZXIgaXRzIENPTVBSRVNTRUQgQ0lEICh0aGUgZmlyc3QgZml2ZSBoZXggY2hhcmFjdGVycyBvZiB0aGVcbiAgICAgKiBzY3JpcHQgYXNzZXQgdXVpZCBwbHVzIGEgYmFzZTY0IHRhaWwpLCBzbyBgY29tcC50eXBlID09PSAnTXlDb250cm9sbGVyJ2AgaXMgbmV2ZXJcbiAgICAgKiB0cnVlIGZvciBhIHByb2plY3Qgc2NyaXB0LiBUaGUgcmVhZGFibGUgbmFtZSBzdXJ2aXZlcyBpbiBleGFjdGx5IG9uZSBwbGFjZSBpbiB0aGVcbiAgICAgKiBkdW1wIOKAlCBgdmFsdWUubmFtZWAsIGZvcm1hdHRlZCBgJHtub2RlTmFtZX08JHtjbGFzc05hbWV9PmAuXG4gICAgICpcbiAgICAgKiBCdWlsdC1pbiBjb21wb25lbnRzIGFyZSB1bmFmZmVjdGVkOiBgY2MuU3ByaXRlYCBtYXRjaGVzIG9uIGB0eXBlYCBhcyBiZWZvcmUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgbWF0Y2hlc0NvbXBvbmVudChjb21wOiBhbnksIGNvbXBvbmVudFR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgICAgICBpZiAoY29tcC50eXBlID09PSBjb21wb25lbnRUeXBlKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgaWYgKGNvbXAudXVpZCAmJiBjb21wLnV1aWQgPT09IGNvbXBvbmVudFR5cGUpIHJldHVybiB0cnVlO1xuXG4gICAgICAgIGNvbnN0IGR1bXBOYW1lID0gY29tcC5wcm9wZXJ0aWVzPy5uYW1lPy52YWx1ZTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBkdW1wTmFtZSA9PT0gJ3N0cmluZycgJiYgZHVtcE5hbWUuZW5kc1dpdGgoYDwke2NvbXBvbmVudFR5cGV9PmApO1xuICAgIH1cblxuICAgIC8qKiBUaGUgaWRlbnRpdHkgYSBjYWxsZXIgbmVlZHMgZm9yIGV2ZXJ5IEZPTExPVy1VUCBjYWxsOiBnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCByZW1vdmUuICovXG4gICAgcHJpdmF0ZSBzdGF0aWMgY29tcG9uZW50SWRlbnRpdHkobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nLCBjb21wOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgIC8vIFRoZSBjaWQsIHdoaWNoIGlzIHdoYXQgZXZlcnkgb3RoZXIgYWN0aW9uIG9uIHRoaXMgdG9vbCBleHBlY3RzLiBSZXR1cm5pbmcgaXRcbiAgICAgICAgICAgIC8vIHNhdmVzIHRoZSBjYWxsZXIgYSBnZXRfYWxsIHJvdW5kLXRyaXAganVzdCB0byB0cmFuc2xhdGUgdGhlaXIgb3duIGNsYXNzIG5hbWUuXG4gICAgICAgICAgICByZXNvbHZlZFR5cGU6IGNvbXA/LnR5cGUgPz8gY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgIGNvbXBvbmVudFV1aWQ6IGNvbXA/LnV1aWQgPz8gbnVsbCxcbiAgICAgICAgICAgIGNvbXBvbmVudFZlcmlmaWVkOiB0cnVlXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRDb21wb25lbnQobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249YWRkJyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hlY2sgaWYgY29tcG9uZW50IGFscmVhZHkgZXhpc3RzIG9uIG5vZGVcbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50c0luZm8gPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICBpZiAoYWxsQ29tcG9uZW50c0luZm8uc3VjY2VzcyAmJiBhbGxDb21wb25lbnRzSW5mby5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBleGlzdGluZ0NvbXBvbmVudCA9IGFsbENvbXBvbmVudHNJbmZvLmRhdGEuY29tcG9uZW50cy5maW5kKFxuICAgICAgICAgICAgICAgIChjb21wOiBhbnkpID0+IE1hbmFnZUNvbXBvbmVudC5tYXRjaGVzQ29tcG9uZW50KGNvbXAsIGNvbXBvbmVudFR5cGUpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nQ29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgLi4uTWFuYWdlQ29tcG9uZW50LmNvbXBvbmVudElkZW50aXR5KG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBleGlzdGluZ0NvbXBvbmVudCksIGV4aXN0aW5nOiB0cnVlIH0sXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIGFscmVhZHkgZXhpc3RzIG9uIG5vZGVgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBUcnkgYWRkaW5nIGNvbXBvbmVudCB2aWEgRWRpdG9yIEFQSSBkaXJlY3RseVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBjb21wb25lbnQ6IGNvbXBvbmVudFR5cGVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gV2FpdCBmb3IgZWRpdG9yIHRvIGZpbmlzaCBhZGRpbmcgdGhlIGNvbXBvbmVudFxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuICAgICAgICAgICAgLy8gUmUtcXVlcnkgdG8gdmVyaWZ5IHRoZSBjb21wb25lbnQgd2FzIGFjdHVhbGx5IGFkZGVkXG4gICAgICAgICAgICBjb25zdCBhbGxDb21wb25lbnRzSW5mbzIgPSBhd2FpdCB0aGlzLmdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKGFsbENvbXBvbmVudHNJbmZvMi5zdWNjZXNzICYmIGFsbENvbXBvbmVudHNJbmZvMi5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYWRkZWRDb21wb25lbnQgPSBhbGxDb21wb25lbnRzSW5mbzIuZGF0YS5jb21wb25lbnRzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgIChjb21wOiBhbnkpID0+IE1hbmFnZUNvbXBvbmVudC5tYXRjaGVzQ29tcG9uZW50KGNvbXAsIGNvbXBvbmVudFR5cGUpXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoYWRkZWRDb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7IC4uLk1hbmFnZUNvbXBvbmVudC5jb21wb25lbnRJZGVudGl0eShub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgYWRkZWRDb21wb25lbnQpLCBleGlzdGluZzogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIGFkZGVkIHN1Y2Nlc3NmdWxseWBcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgd2FzIG5vdCBmb3VuZCBvbiBub2RlIGFmdGVyIGFkZGl0aW9uLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthbGxDb21wb25lbnRzSW5mbzIuZGF0YS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PiBjLnR5cGUpLmpvaW4oJywgJyl9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byB2ZXJpZnkgY29tcG9uZW50IGFkZGl0aW9uOiAke2FsbENvbXBvbmVudHNJbmZvMi5lcnJvciB8fCAnVW5hYmxlIHRvIGdldCBub2RlIGNvbXBvbmVudHMnfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHVzZSBzY2VuZSBzY3JpcHRcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdhZGRDb21wb25lbnRUb05vZGUnLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbbm9kZVV1aWQsIGNvbXBvbmVudFR5cGVdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywgb3B0aW9ucyk7XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8IGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIChlcnIyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZUNvbXBvbmVudChub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1yZW1vdmUnKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBHZXQgYWxsIGNvbXBvbmVudHMgc28gd2UgY2FuIHJlc29sdmUgY29tcG9uZW50VHlwZSB0byB0aGUgY29tcG9uZW50J3MgT1dOIHV1aWQuXG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHNJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFhbGxDb21wb25lbnRzSW5mby5zdWNjZXNzIHx8ICFhbGxDb21wb25lbnRzSW5mby5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgY29tcG9uZW50cyBmb3Igbm9kZSAnJHtub2RlVXVpZH0nOiAke2FsbENvbXBvbmVudHNJbmZvLmVycm9yfWApO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFsbENvbXBvbmVudHM6IGFueVtdID0gYWxsQ29tcG9uZW50c0luZm8uZGF0YS5jb21wb25lbnRzO1xuXG4gICAgICAgIC8vIEFjY2VwdCBlaXRoZXIgdGhlIHR5cGUgZmllbGQgKGNpZCwgZS5nLiBcImNjLlNwcml0ZVwiIG9yIGEgc2NyaXB0IGNpZCkg4oCUIHRoZVxuICAgICAgICAvLyBlcmdvbm9taWMgZm9ybSDigJQgb3IgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkLCBmb3IgY2FsbGVycyB0aGF0IGFscmVhZHkgaGF2ZSBpdC5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gYWxsQ29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gY29tcG9uZW50VHlwZSlcbiAgICAgICAgICAgIHx8IGFsbENvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnV1aWQgJiYgY29tcC51dWlkID09PSBjb21wb25lbnRUeXBlKTtcbiAgICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgICAgIGNvbnN0IGF2YWlsYWJsZVR5cGVzID0gYWxsQ29tcG9uZW50cy5tYXAoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlKS5qb2luKCcsICcpO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nIG5vdCBmb3VuZCBvbiBub2RlICcke25vZGVVdWlkfScuIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2F2YWlsYWJsZVR5cGVzfS4gVXNlIGFjdGlvbj1nZXRfYWxsIHRvIGdldCB0aGUgdHlwZSBmaWVsZCAoY2lkKSBvciB1dWlkIGZvciBjb21wb25lbnRUeXBlLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGhlIGVkaXRvcidzICdyZW1vdmUtY29tcG9uZW50JyB0YWtlcyB0aGUgQ09NUE9ORU5UJ3MgdXVpZCAoUmVtb3ZlQ29tcG9uZW50T3B0aW9uc1xuICAgICAgICAvLyBpcyB7IHV1aWQ6IHN0cmluZyB9IOKAlCBpdHMgYGNvbXBvbmVudGAgZmllbGQgaXMgYW4gdW51c2VkIHBhcmFtZXRlcikuIFBhc3NpbmcgdGhlXG4gICAgICAgIC8vIG5vZGUgdXVpZCBoZXJlIGlzIHdoYXQgbWFkZSByZW1vdmFsIHNpbGVudGx5IGZhaWwuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudFV1aWQgPSB0YXJnZXQudXVpZDtcbiAgICAgICAgaWYgKCFjb21wb25lbnRVdWlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvdWxkIG5vdCByZXNvbHZlIHRoZSBjb21wb25lbnQgdXVpZCBmb3IgJyR7Y29tcG9uZW50VHlwZX0nIG9uIG5vZGUgJyR7bm9kZVV1aWR9Jy4gVGhlIGVkaXRvciByZXF1aXJlcyB0aGUgY29tcG9uZW50J3Mgb3duIHV1aWQgdG8gcmVtb3ZlIGl0LmApO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3JlbW92ZS1jb21wb25lbnQnLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogY29tcG9uZW50VXVpZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBXYWl0IGZvciB0aGUgZWRpdG9yIHRvIGZpbmlzaCByZW1vdmluZyB0aGUgY29tcG9uZW50XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSk7XG4gICAgICAgICAgICAvLyBSZS1xdWVyeSB0byBjb25maXJtIHJlbW92YWwg4oCUIG1hdGNoIG9uIHRoZSByZXNvbHZlZCBjb21wb25lbnQgdXVpZCBzbyBhIG5vZGVcbiAgICAgICAgICAgIC8vIGNhcnJ5aW5nIHR3byBjb21wb25lbnRzIG9mIHRoZSBzYW1lIHR5cGUgcmVwb3J0cyBhY2N1cmF0ZWx5LlxuICAgICAgICAgICAgY29uc3QgYWZ0ZXJSZW1vdmVJbmZvID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHN0aWxsRXhpc3RzID0gYWZ0ZXJSZW1vdmVJbmZvLnN1Y2Nlc3MgJiYgYWZ0ZXJSZW1vdmVJbmZvLmRhdGE/LmNvbXBvbmVudHM/LnNvbWUoKGNvbXA6IGFueSkgPT4gY29tcC51dWlkID09PSBjb21wb25lbnRVdWlkKTtcbiAgICAgICAgICAgIGlmIChzdGlsbEV4aXN0cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyAodXVpZCAke2NvbXBvbmVudFV1aWR9KSB3YXMgbm90IHJlbW92ZWQgZnJvbSBub2RlICcke25vZGVVdWlkfScuYCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBjb21wb25lbnRVdWlkIH0sXG4gICAgICAgICAgICAgICAgICAgIGBDb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nICh1dWlkICR7Y29tcG9uZW50VXVpZH0pIHJlbW92ZWQgc3VjY2Vzc2Z1bGx5IGZyb20gbm9kZSAnJHtub2RlVXVpZH0nYFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZW1vdmUgY29tcG9uZW50OiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRDb21wb25lbnRzKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPWdldF9hbGwnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKG5vZGVEYXRhICYmIG5vZGVEYXRhLl9fY29tcHNfXykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHMgPSBub2RlRGF0YS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhlIGR1bXAgbmVzdHMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIHVuZGVyIHZhbHVlLnV1aWQudmFsdWU7IHRoZVxuICAgICAgICAgICAgICAgICAgICAvLyB0b3AtbGV2ZWwgY29tcC51dWlkIGRvZXMgbm90IGV4aXN0LCBzbyByZWFkIHRoZSBkdW1wIGZvcm0gZmlyc3QuXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IGNvbXAudmFsdWU/LnV1aWQ/LnZhbHVlIHx8IGNvbXAudXVpZD8udmFsdWUgfHwgY29tcC51dWlkIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogdGhpcy5leHRyYWN0Q29tcG9uZW50UHJvcGVydGllcyhjb21wKVxuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBjb21wb25lbnRzIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBubyBjb21wb25lbnRzIGRhdGEnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXROb2RlSW5mbycsIGFyZ3M6IFtub2RlVXVpZF1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLmNvbXBvbmVudHMpO1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8IGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29tcG9uZW50SW5mbyhub2RlVXVpZDogc3RyaW5nLCBjb21wb25lbnRUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgY29tcG9uZW50VHlwZSBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1nZXRfaW5mbycpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJvdXRlIHRocm91Z2ggZ2V0Q29tcG9uZW50cyArIG1hdGNoZXNDb21wb25lbnQgc28gYSBjdXN0b20gQGNjY2xhc3MgY2xhc3MgbmFtZVxuICAgICAgICAvLyByZXNvbHZlcyB0aGUgc2FtZSB3YXkgYWN0aW9uPWFkZCBkb2VzIChpc3N1ZSAjNDQpOiBxdWVyeS1ub2RlIGxpc3RzIHByb2plY3RcbiAgICAgICAgLy8gc2NyaXB0cyB1bmRlciB0aGVpciBjb21wcmVzc2VkIGNpZCwgd2hpbGUgdGhlIHJlYWRhYmxlIG5hbWUgbGl2ZXMgb25seSBpblxuICAgICAgICAvLyBgdmFsdWUubmFtZWAgYXMgYCR7bm9kZU5hbWV9PCR7Y2xhc3NOYW1lfT5gLCB3aGljaCBtYXRjaGVzQ29tcG9uZW50IGNoZWNrcy5cbiAgICAgICAgY29uc3QgY29tcG9uZW50c1Jlc3BvbnNlID0gYXdhaXQgdGhpcy5nZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKCFjb21wb25lbnRzUmVzcG9uc2Uuc3VjY2VzcyB8fCAhY29tcG9uZW50c1Jlc3BvbnNlLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChjb21wb25lbnRzUmVzcG9uc2UuZXJyb3IgfHwgJ05vZGUgbm90IGZvdW5kIG9yIG5vIGNvbXBvbmVudHMgZGF0YScpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IGNvbXBvbmVudHNSZXNwb25zZS5kYXRhLmNvbXBvbmVudHMuZmluZChcbiAgICAgICAgICAgIChjb21wOiBhbnkpID0+IE1hbmFnZUNvbXBvbmVudC5tYXRjaGVzQ29tcG9uZW50KGNvbXAsIGNvbXBvbmVudFR5cGUpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChjb21wb25lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICBub2RlVXVpZCwgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wb25lbnQuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcG9uZW50LmVuYWJsZWQgOiB0cnVlLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IGNvbXBvbmVudC5wcm9wZXJ0aWVzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvbXBvbmVudCAnJHtjb21wb25lbnRUeXBlfScgbm90IGZvdW5kIG9uIG5vZGUuIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2NvbXBvbmVudHNSZXNwb25zZS5kYXRhLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGV4dHJhY3RDb21wb25lbnRQcm9wZXJ0aWVzKGNvbXBvbmVudDogYW55KTogUmVjb3JkPHN0cmluZywgYW55PiB7XG4gICAgICAgIHJldHVybiBleHRyYWN0Q29tcG9uZW50UHJvcGVydHlEdW1wKGNvbXBvbmVudCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb21wb25lbnRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfSA9IGFyZ3M7XG5cbiAgICAgICAgaWYgKCFub2RlVXVpZCB8fCAhY29tcG9uZW50VHlwZSB8fCAhcHJvcGVydHkgfHwgcHJvcGVydHlUeXBlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgYW5kIHZhbHVlIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0eScpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAwOiBEZXRlY3QgaWYgdXNlciBpcyB0cnlpbmcgdG8gc2V0IGEgbm9kZSBwcm9wZXJ0eTsgcmVkaXJlY3Qgd2l0aCBndWlkYW5jZVxuICAgICAgICBjb25zdCBub2RlUmVkaXJlY3RSZXN1bHQgPSByZWRpcmVjdE5vZGVQcm9wZXJ0eUFjY2VzcyhhcmdzKTtcbiAgICAgICAgaWYgKG5vZGVSZWRpcmVjdFJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIG5vZGVSZWRpcmVjdFJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFN0ZXAgMTogUmVzb2x2ZSB0aGUgdGFyZ2V0IGNvbXBvbmVudCAoYW5kIGl0cyByYXcgX19jb21wc19fIGluZGV4KSBvbmNlLlxuICAgICAgICBjb25zdCByZXNvbHV0aW9uID0gYXdhaXQgdGhpcy5yZXNvbHZlVGFyZ2V0Q29tcG9uZW50KG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSk7XG4gICAgICAgIGlmICghcmVzb2x1dGlvbi5vaykge1xuICAgICAgICAgICAgcmV0dXJuIHJlc29sdXRpb24ucmVzdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU3RlcCAyOiBBcHBseSB0aGUgc2luZ2xlIHByb3BlcnR5IHVzaW5nIHRoZSBzaGFyZWQgcGVyLWZpZWxkIGxvZ2ljLlxuICAgICAgICBjb25zdCBmaWVsZFJlc3VsdCA9IGF3YWl0IHRoaXMuYXBwbHlTaW5nbGVQcm9wZXJ0eShcbiAgICAgICAgICAgIG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCByZXNvbHV0aW9uLnRhcmdldENvbXBvbmVudCwgcmVzb2x1dGlvbi5yYXdDb21wb25lbnRJbmRleCxcbiAgICAgICAgICAgIHsgcHJvcGVydHksIHByb3BlcnR5VHlwZSwgdmFsdWUgfVxuICAgICAgICApO1xuXG4gICAgICAgIGlmICghZmllbGRSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGZpZWxkUmVzdWx0LmVycm9yIHx8IGBGYWlsZWQgdG8gc2V0IHByb3BlcnR5ICcke3Byb3BlcnR5fSdgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgIHByb3BlcnR5LFxuICAgICAgICAgICAgYWN0dWFsVmFsdWU6IGZpZWxkUmVzdWx0LmFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgY2hhbmdlVmVyaWZpZWQ6IGZpZWxkUmVzdWx0LmNoYW5nZVZlcmlmaWVkXG4gICAgICAgIH0sIGBTdWNjZXNzZnVsbHkgc2V0ICR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX1gKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgbXVsdGlwbGUgcHJvcGVydGllcyBvbiBhIFNJTkdMRSBjb21wb25lbnQgaW4gb25lIGNhbGwuXG4gICAgICogVGhlIHRhcmdldCBjb21wb25lbnQgaXMgcmVzb2x2ZWQgb25jZTsgZWFjaCBwcm9wZXJ0eSBlbnRyeSBpcyB0aGVuIGFwcGxpZWRcbiAgICAgKiBpbmRlcGVuZGVudGx5IHZpYSB0aGUgc2FtZSBwZXItZmllbGQgbG9naWMgdXNlZCBieSBzZXRfcHJvcGVydHkg4oCUIHNvIGEgZmFpbHVyZVxuICAgICAqIG9uIG9uZSBmaWVsZCBkb2VzIG5vdCBhYm9ydCB0aGUgcmVzdC4gRG90dGVkIG5lc3RlZCBDQ0NsYXNzIHBhdGhzIHdvcmsgcGVyIGVudHJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2V0Q29tcG9uZW50UHJvcGVydGllc0JhdGNoKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0aWVzIH0gPSBhcmdzO1xuXG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIWNvbXBvbmVudFR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIGNvbXBvbmVudFR5cGUgYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249c2V0X3Byb3BlcnRpZXNfYmF0Y2gnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJvcGVydGllcykgfHwgcHJvcGVydGllcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydGllcyBtdXN0IGJlIGEgbm9uLWVtcHR5IGFycmF5IG9mIHtwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZX0gZW50cmllcyBmb3IgYWN0aW9uPXNldF9wcm9wZXJ0aWVzX2JhdGNoJyk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXNvbHZlIHRoZSB0YXJnZXQgY29tcG9uZW50IG9uY2UgZm9yIHRoZSB3aG9sZSBiYXRjaC5cbiAgICAgICAgY29uc3QgcmVzb2x1dGlvbiA9IGF3YWl0IHRoaXMucmVzb2x2ZVRhcmdldENvbXBvbmVudChub2RlVXVpZCwgY29tcG9uZW50VHlwZSwgdW5kZWZpbmVkKTtcbiAgICAgICAgaWYgKCFyZXNvbHV0aW9uLm9rKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x1dGlvbi5yZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHRzOiBBcnJheTx7IHByb3BlcnR5OiBzdHJpbmc7IHN1Y2Nlc3M6IGJvb2xlYW47IGFjdHVhbFZhbHVlPzogYW55OyBjaGFuZ2VWZXJpZmllZD86IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+ID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IGVudHJ5Py5wcm9wZXJ0eTtcbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5VHlwZSA9IGVudHJ5Py5wcm9wZXJ0eVR5cGU7XG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGVudHJ5Py52YWx1ZTtcblxuICAgICAgICAgICAgaWYgKCFwcm9wZXJ0eSB8fCBwcm9wZXJ0eVR5cGUgPT09IHVuZGVmaW5lZCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydHk6IHByb3BlcnR5IHx8ICcobWlzc2luZyknLFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6ICdFYWNoIGVudHJ5IHJlcXVpcmVzIHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIGFuZCB2YWx1ZSdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaWVsZFJlc3VsdCA9IGF3YWl0IHRoaXMuYXBwbHlTaW5nbGVQcm9wZXJ0eShcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsIGNvbXBvbmVudFR5cGUsIHJlc29sdXRpb24udGFyZ2V0Q29tcG9uZW50LCByZXNvbHV0aW9uLnJhd0NvbXBvbmVudEluZGV4LFxuICAgICAgICAgICAgICAgICAgICB7IHByb3BlcnR5LCBwcm9wZXJ0eVR5cGUsIHZhbHVlIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnR5LFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmaWVsZFJlc3VsdC5zdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZTogZmllbGRSZXN1bHQuYWN0dWFsVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGNoYW5nZVZlcmlmaWVkOiBmaWVsZFJlc3VsdC5jaGFuZ2VWZXJpZmllZCxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGZpZWxkUmVzdWx0LmVycm9yXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIC8vIERlZmVuc2l2ZTogb25lIGJhZCBmaWVsZCBtdXN0IG5ldmVyIGFib3J0IHRoZSBiYXRjaC5cbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goeyBwcm9wZXJ0eSwgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnI/Lm1lc3NhZ2UgfHwgU3RyaW5nKGVycikgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzdWNjZWVkZWQgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuc3VjY2VzcykubGVuZ3RoO1xuICAgICAgICBjb25zdCBmYWlsZWQgPSByZXN1bHRzLmxlbmd0aCAtIHN1Y2NlZWRlZDtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBzZXRfcHJvcGVydGllc19iYXRjaCBvbiAke2NvbXBvbmVudFR5cGV9OiAke3N1Y2NlZWRlZH0vJHtyZXN1bHRzLmxlbmd0aH0gZmllbGQocykgc2V0JHtmYWlsZWQgPiAwID8gYCwgJHtmYWlsZWR9IGZhaWxlZGAgOiAnJ31gO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgY29tcG9uZW50VHlwZSxcbiAgICAgICAgICAgIHRvdGFsOiByZXN1bHRzLmxlbmd0aCxcbiAgICAgICAgICAgIHN1Y2NlZWRlZCxcbiAgICAgICAgICAgIGZhaWxlZCxcbiAgICAgICAgICAgIHJlc3VsdHNcbiAgICAgICAgfSwgbWVzc2FnZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSBhIGNvbXBvbmVudCBvbiBhIG5vZGUgaW50byBpdHMgZHVtcCAodGFyZ2V0Q29tcG9uZW50KSBhbmQgaXRzIHJhdyBfX2NvbXBzX18gaW5kZXguXG4gICAgICogV2hlbiBgcHJvcGVydHlgIGlzIHByb3ZpZGVkLCBhIG1pc3NpbmcgY29tcG9uZW50IHlpZWxkcyBhbiBMTE0tZnJpZW5kbHkgc3VnZ2VzdGlvbi5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVUYXJnZXRDb21wb25lbnQoXG4gICAgICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgICAgIGNvbXBvbmVudFR5cGU6IHN0cmluZyxcbiAgICAgICAgcHJvcGVydHk6IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICk6IFByb21pc2U8XG4gICAgICAgIHwgeyBvazogdHJ1ZTsgdGFyZ2V0Q29tcG9uZW50OiBhbnk7IHJhd0NvbXBvbmVudEluZGV4OiBudW1iZXIgfVxuICAgICAgICB8IHsgb2s6IGZhbHNlOyByZXN1bHQ6IEFjdGlvblRvb2xSZXN1bHQgfVxuICAgID4ge1xuICAgICAgICAvLyBHZXQgYWxsIGNvbXBvbmVudHMgKGR1bXAgZm9ybSkgb24gdGhlIG5vZGUuXG4gICAgICAgIGNvbnN0IGNvbXBvbmVudHNSZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmICghY29tcG9uZW50c1Jlc3BvbnNlLnN1Y2Nlc3MgfHwgIWNvbXBvbmVudHNSZXNwb25zZS5kYXRhKSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHJlc3VsdDogZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgY29tcG9uZW50cyBmb3Igbm9kZSAnJHtub2RlVXVpZH0nOiAke2NvbXBvbmVudHNSZXNwb25zZS5lcnJvcn1gKSB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsQ29tcG9uZW50cyA9IGNvbXBvbmVudHNSZXNwb25zZS5kYXRhLmNvbXBvbmVudHM7XG4gICAgICAgIGxldCB0YXJnZXRDb21wb25lbnQgPSBudWxsO1xuICAgICAgICBsZXQgcmVzb2x2ZWRJbmRleCA9IC0xO1xuICAgICAgICBjb25zdCBhdmFpbGFibGVUeXBlczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbGxDb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb21wID0gYWxsQ29tcG9uZW50c1tpXTtcbiAgICAgICAgICAgIGF2YWlsYWJsZVR5cGVzLnB1c2goY29tcC50eXBlKTtcbiAgICAgICAgICAgIGlmIChNYW5hZ2VDb21wb25lbnQubWF0Y2hlc0NvbXBvbmVudChjb21wLCBjb21wb25lbnRUeXBlKSkge1xuICAgICAgICAgICAgICAgIHRhcmdldENvbXBvbmVudCA9IGNvbXA7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZWRJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGYWxsYmFjazogY29tcG9uZW50VHlwZSBtYXkgYmUgYSByZWFkYWJsZSBjbGFzcyBuYW1lIChlLmcuIFwiTXlDb250cm9sbGVyXCIpXG4gICAgICAgIC8vIHdoaWxlIHRoZSBkdW1wIG9ubHkgZXhwb3NlcyB0aGUgc2NyaXB0J3MgY2lkLiBSZXNvbHZlIHZpYSB0aGUgc2NlbmUgc2NyaXB0LFxuICAgICAgICAvLyB3aGljaCBoYXMgdGhlIGxpdmUgY2MuanMgY2xhc3MgcmVnaXN0cnksIHRoZW4gbWFwIGJhY2sgdG8gdGhlIGR1bXAgY29tcG9uZW50XG4gICAgICAgIC8vIGF0IHRoZSBzYW1lIGluZGV4IChxdWVyeS1ub2RlIF9fY29tcHNfXyBvcmRlciBtYXRjaGVzIG5vZGUuY29tcG9uZW50cyBvcmRlcikuXG4gICAgICAgIGlmICghdGFyZ2V0Q29tcG9uZW50KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGJ5TmFtZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAncmVzb2x2ZUNvbXBvbmVudEJ5TmFtZScsIGFyZ3M6IFtub2RlVXVpZCwgY29tcG9uZW50VHlwZV1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCBpbmRleCA9IGJ5TmFtZT8uc3VjY2VzcyA/IGJ5TmFtZS5kYXRhPy5pbmRleCA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGluZGV4ID09PSAnbnVtYmVyJyAmJiBpbmRleCA+PSAwICYmIGluZGV4IDwgYWxsQ29tcG9uZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZWRJbmRleCA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRDb21wb25lbnQgPSBhbGxDb21wb25lbnRzW2luZGV4XTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAvLyBTY2VuZSBzY3JpcHQgdW5hdmFpbGFibGUg4oCUIGZhbGwgdGhyb3VnaCB0byB0aGUgbm90LWZvdW5kIGVycm9yIGJlbG93LlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCF0YXJnZXRDb21wb25lbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IGluc3RydWN0aW9uID0gZ2VuZXJhdGVDb21wb25lbnRTdWdnZXN0aW9uKGNvbXBvbmVudFR5cGUsIGF2YWlsYWJsZVR5cGVzLCBwcm9wZXJ0eSB8fCAnJyk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgICAgICAgICByZXN1bHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgQ29tcG9uZW50ICcke2NvbXBvbmVudFR5cGV9JyBub3QgZm91bmQgb24gbm9kZS4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7YXZhaWxhYmxlVHlwZXMuam9pbignLCAnKX1gLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBHZXQgcmF3IG5vZGUgZGF0YSB0byBidWlsZCB0aGUgY29ycmVjdCBfX2NvbXBzX18gcGF0aC5cbiAgICAgICAgY29uc3QgcmF3Tm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICBpZiAoIXJhd05vZGVEYXRhIHx8ICFyYXdOb2RlRGF0YS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVzdWx0OiBlcnJvclJlc3VsdCgnRmFpbGVkIHRvIGdldCByYXcgbm9kZSBkYXRhIGZvciBwcm9wZXJ0eSBzZXR0aW5nJykgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCByYXdDb21wb25lbnRJbmRleCA9IC0xO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJhd05vZGVEYXRhLl9fY29tcHNfXy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IHJhd05vZGVEYXRhLl9fY29tcHNfX1tpXSBhcyBhbnk7XG4gICAgICAgICAgICBjb25zdCBjb21wVHlwZSA9IGNvbXAuX190eXBlX18gfHwgY29tcC5jaWQgfHwgY29tcC50eXBlIHx8ICdVbmtub3duJztcbiAgICAgICAgICAgIGlmIChjb21wVHlwZSA9PT0gY29tcG9uZW50VHlwZSkge1xuICAgICAgICAgICAgICAgIHJhd0NvbXBvbmVudEluZGV4ID0gaTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBDbGFzcy1uYW1lIHJlc29sdXRpb24gcGF0aDogdGhlIGNpZCB3b24ndCBlcXVhbCBjb21wb25lbnRUeXBlLCBzbyByZXVzZSB0aGVcbiAgICAgICAgLy8gaW5kZXggcmVzb2x2ZWQgYWJvdmUgKGR1bXAgb3JkZXIgPT0gcmF3IF9fY29tcHNfXyBvcmRlcikuXG4gICAgICAgIGlmIChyYXdDb21wb25lbnRJbmRleCA9PT0gLTEgJiYgcmVzb2x2ZWRJbmRleCA+PSAwICYmIHJlc29sdmVkSW5kZXggPCByYXdOb2RlRGF0YS5fX2NvbXBzX18ubGVuZ3RoKSB7XG4gICAgICAgICAgICByYXdDb21wb25lbnRJbmRleCA9IHJlc29sdmVkSW5kZXg7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmF3Q29tcG9uZW50SW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4geyBvazogZmFsc2UsIHJlc3VsdDogZXJyb3JSZXN1bHQoJ0NvdWxkIG5vdCBmaW5kIGNvbXBvbmVudCBpbmRleCBmb3Igc2V0dGluZyBwcm9wZXJ0eScpIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4geyBvazogdHJ1ZSwgdGFyZ2V0Q29tcG9uZW50LCByYXdDb21wb25lbnRJbmRleCB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEFwcGx5IE9ORSBwcm9wZXJ0eSB2YWx1ZSB0byBhbiBhbHJlYWR5LXJlc29sdmVkIGNvbXBvbmVudC5cbiAgICAgKiBTaGFyZWQgYnkgc2V0X3Byb3BlcnR5IChzaW5nbGUpIGFuZCBzZXRfcHJvcGVydGllc19iYXRjaCAocGVyIGVudHJ5KS5cbiAgICAgKiBSZXR1cm5zIGEgcGVyLWZpZWxkIHJlc3VsdCByYXRoZXIgdGhhbiB0aHJvd2luZywgc28gY2FsbGVycyBjYW4gYWdncmVnYXRlLlxuICAgICAqIERvdHRlZCBuZXN0ZWQgQ0NDbGFzcyBwYXRocyAoZS5nLiwgXCJjYW1lcmFTZWN0aW9uLm1haW5DYW1lcmFcIikgYXJlIHN1cHBvcnRlZFxuICAgICAqIGJlY2F1c2UgYW5hbHl6ZVByb3BlcnR5IC8gYXBwbHlQcm9wZXJ0eVRvRWRpdG9yIC8gdmVyaWZ5Q29tcG9uZW50UHJvcGVydHlDaGFuZ2VcbiAgICAgKiBhbGwgd2FsayBkb3R0ZWQgc2VnbWVudHMuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBhcHBseVNpbmdsZVByb3BlcnR5KFxuICAgICAgICBub2RlVXVpZDogc3RyaW5nLFxuICAgICAgICBjb21wb25lbnRUeXBlOiBzdHJpbmcsXG4gICAgICAgIHRhcmdldENvbXBvbmVudDogYW55LFxuICAgICAgICByYXdDb21wb25lbnRJbmRleDogbnVtYmVyLFxuICAgICAgICBmaWVsZDogeyBwcm9wZXJ0eTogc3RyaW5nOyBwcm9wZXJ0eVR5cGU6IHN0cmluZzsgdmFsdWU6IGFueSB9XG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGFjdHVhbFZhbHVlPzogYW55OyBjaGFuZ2VWZXJpZmllZD86IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+IHtcbiAgICAgICAgY29uc3QgeyBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSB9ID0gZmllbGQ7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW01hbmFnZUNvbXBvbmVudF0gU2V0dGluZyAke2NvbXBvbmVudFR5cGV9LiR7cHJvcGVydHl9ICh0eXBlOiAke3Byb3BlcnR5VHlwZX0pID0gJHtKU09OLnN0cmluZ2lmeSh2YWx1ZSl9IG9uIG5vZGUgJHtub2RlVXVpZH1gKTtcblxuICAgICAgICAgICAgLy8gQW5hbHl6ZSB0aGUgcHJvcGVydHkgdG8gZ2V0IG9yaWdpbmFsIHZhbHVlIGFuZCB0eXBlIGluZm8gKHN1cHBvcnRzIGRvdHRlZCBwYXRocykuXG4gICAgICAgICAgICBsZXQgcHJvcGVydHlJbmZvO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eUluZm8gPSBhbmFseXplUHJvcGVydHkodGFyZ2V0Q29tcG9uZW50LCBwcm9wZXJ0eSk7XG4gICAgICAgICAgICB9IGNhdGNoIChhbmFseXplRXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBhbmFseXplIHByb3BlcnR5ICcke3Byb3BlcnR5fSc6ICR7YW5hbHl6ZUVycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXByb3BlcnR5SW5mby5leGlzdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBmb3VuZCBvbiBjb21wb25lbnQgJyR7Y29tcG9uZW50VHlwZX0nLiBBdmFpbGFibGUgcHJvcGVydGllczogJHtwcm9wZXJ0eUluZm8uYXZhaWxhYmxlUHJvcGVydGllcy5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ29udmVydCB2YWx1ZSBiYXNlZCBvbiBleHBsaWNpdCBwcm9wZXJ0eVR5cGUuXG4gICAgICAgICAgICBjb25zdCBvcmlnaW5hbFZhbHVlID0gcHJvcGVydHlJbmZvLm9yaWdpbmFsVmFsdWU7XG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzZWRWYWx1ZTogYW55ID0gY29udmVydFByb3BlcnR5VmFsdWUocHJvcGVydHlUeXBlLCB2YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIEJ1aWxkIHRoZSAocG9zc2libHkgZG90dGVkKSBjb21wb25lbnQgcHJvcGVydHkgcGF0aCBhbmQgYXBwbHkgdmlhIHR5cGUtYXdhcmUgRWRpdG9yIEFQSS5cbiAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5UGF0aCA9IGBfX2NvbXBzX18uJHtyYXdDb21wb25lbnRJbmRleH0uJHtwcm9wZXJ0eX1gO1xuICAgICAgICAgICAgY29uc3QgYWN0dWFsRXhwZWN0ZWRWYWx1ZSA9IGF3YWl0IGFwcGx5UHJvcGVydHlUb0VkaXRvcihcbiAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBwcm9wZXJ0eVBhdGgsIHJhd0NvbXBvbmVudEluZGV4LCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgcHJvcGVydHlUeXBlLCB2YWx1ZSwgcHJvY2Vzc2VkVmFsdWUgfSxcbiAgICAgICAgICAgICAgICAodXVpZCwgdHlwZSkgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKHV1aWQsIHR5cGUpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICAvLyBXYWl0IGZvciBlZGl0b3IgdG8gY29tcGxldGUgdGhlIHVwZGF0ZSwgdGhlbiB2ZXJpZnkuXG4gICAgICAgICAgICAvLyBMb29rIHVwIGJ5IHRoZSBSRVNPTFZFRCBkdW1wIHR5cGUgKHRhcmdldENvbXBvbmVudC50eXBlIOKAlCBhIGNpZCB3aGVuXG4gICAgICAgICAgICAvLyBjb21wb25lbnRUeXBlIHdhcyBhIGNsYXNzIG5hbWUgcmVzb2x2ZWQgdmlhIHJlc29sdmVDb21wb25lbnRCeU5hbWUpLFxuICAgICAgICAgICAgLy8gbm90IHRoZSBjYWxsZXItc3VwcGxpZWQgY29tcG9uZW50VHlwZTogZ2V0Q29tcG9uZW50SW5mbyBtYXRjaGVzIGFnYWluc3RcbiAgICAgICAgICAgIC8vIHRoZSBkdW1wJ3MgX190eXBlX18vY2lkLCB3aGljaCBuZXZlciBlcXVhbHMgYSByZWFkYWJsZSBjbGFzcyBuYW1lLCBzb1xuICAgICAgICAgICAgLy8gdmVyaWZpY2F0aW9uIHdvdWxkIGFsd2F5cyByZXBvcnQgdW52ZXJpZmllZCBmb3IgdGhlIGNsYXNzLW5hbWUgcGF0aC5cbiAgICAgICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbiA9IGF3YWl0IHZlcmlmeUNvbXBvbmVudFByb3BlcnR5Q2hhbmdlKFxuICAgICAgICAgICAgICAgIG5vZGVVdWlkLCB0YXJnZXRDb21wb25lbnQudHlwZSB8fCBjb21wb25lbnRUeXBlLCBwcm9wZXJ0eSwgb3JpZ2luYWxWYWx1ZSwgYWN0dWFsRXhwZWN0ZWRWYWx1ZSxcbiAgICAgICAgICAgICAgICAodXVpZCwgdHlwZSkgPT4gdGhpcy5nZXRDb21wb25lbnRJbmZvKHV1aWQsIHR5cGUpXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoIXZlcmlmaWNhdGlvbi52ZXJpZmllZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBhY3R1YWxWYWx1ZTogdmVyaWZpY2F0aW9uLmFjdHVhbFZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBjaGFuZ2VWZXJpZmllZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJvcGVydHkgJyR7Y29tcG9uZW50VHlwZX0uJHtwcm9wZXJ0eX0nIHdyaXRlIGRpZCBub3QgdmVyaWZ5OiBleHBlY3RlZCAke0pTT04uc3RyaW5naWZ5KGFjdHVhbEV4cGVjdGVkVmFsdWUpfSBidXQgdGhlIGVkaXRvciByZWFkcyBiYWNrICR7SlNPTi5zdHJpbmdpZnkodmVyaWZpY2F0aW9uLmFjdHVhbFZhbHVlKX1gXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgYWN0dWFsVmFsdWU6IHZlcmlmaWNhdGlvbi5hY3R1YWxWYWx1ZSwgY2hhbmdlVmVyaWZpZWQ6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW01hbmFnZUNvbXBvbmVudF0gRXJyb3Igc2V0dGluZyBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nOmAsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBzZXQgcHJvcGVydHkgJyR7cHJvcGVydHl9JzogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19