import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';
import { analyzeProperty, generateComponentSuggestion, convertPropertyValue, getAvailableComponentsList, redirectNodePropertyAccess, verifyComponentPropertyChange, SUPPORTED_PROPERTY_TYPES } from './manage-component-property-helpers';
import { applyPropertyToEditor } from './manage-component-editor-apply';
import { attachScriptToNode } from './manage-component-script-attach';

export class ManageComponent extends BaseActionTool {
    readonly name = 'manage_component';
    readonly description = 'Manage components on scene nodes. Actions: add=add component to node, remove=remove component (use the cid or uuid from get_all), get_all=list all components on node, get_info=get specific component details and properties, set_property=set a single component property value (supports dotted nested CCClass paths like "cameraSection.mainCamera"), set_properties_batch=set many properties on one component in a single call (each field set independently — one bad field does not abort the rest), attach_script=attach a TypeScript/JavaScript script component, get_available=list available component types by category. NOTE: For node basic properties (name, active, layer) use manage_node action=set_property. For transforms (position, rotation, scale) use manage_node action=set_transform.';
    readonly actions = ['add', 'remove', 'get_all', 'get_info', 'set_property', 'set_properties_batch', 'attach_script', 'get_available'];

    readonly inputSchema = {
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
                enum: [...SUPPORTED_PROPERTY_TYPES],
                description: '[set_property] Property data type for correct value conversion. Must match the actual property type. Use "asset" as the generic fallback for any Cocos asset-reference property (spriteFrame/material/texture/etc. are also accepted directly and behave identically).'
            },
            value: {
                description: '[set_property] Property value. Format depends on propertyType: string="text", number=42, boolean=true, color={"r":255,"g":0,"b":0,"a":255} or "#FF0000", vec2={"x":100,"y":50}, vec3={"x":1,"y":2,"z":3}, size={"width":100,"height":50}, node/component/asset (or any specific asset type: spriteFrame/prefab/material/texture/spriteAtlas/audioClip/font/animationClip/mesh/skeleton/physicsMaterial/renderTexture/textAsset/jsonAsset/particleAsset/sceneAsset)="uuid-string", nodeArray=["uuid1","uuid2"], colorArray=[{"r":255,...}], numberArray=[1,2,3], stringArray=["a","b"]'
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
                            enum: [...SUPPORTED_PROPERTY_TYPES],
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add: (args) => this.addComponent(args.nodeUuid, args.componentType),
        remove: (args) => this.removeComponent(args.nodeUuid, args.componentType),
        get_all: (args) => this.getComponents(args.nodeUuid),
        get_info: (args) => this.getComponentInfo(args.nodeUuid, args.componentType),
        set_property: (args) => this.setComponentProperty(args),
        set_properties_batch: (args) => this.setComponentPropertiesBatch(args),
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
        // Get all components so we can resolve componentType to the component's OWN uuid.
        const allComponentsInfo = await this.getComponents(nodeUuid);
        if (!allComponentsInfo.success || !allComponentsInfo.data?.components) {
            return errorResult(`Failed to get components for node '${nodeUuid}': ${allComponentsInfo.error}`);
        }
        const allComponents: any[] = allComponentsInfo.data.components;

        // Accept either the type field (cid, e.g. "cc.Sprite" or a script cid) — the
        // ergonomic form — or the component's own uuid, for callers that already have it.
        const target = allComponents.find((comp: any) => comp.type === componentType)
            || allComponents.find((comp: any) => comp.uuid && comp.uuid === componentType);
        if (!target) {
            const availableTypes = allComponents.map((comp: any) => comp.type).join(', ');
            return errorResult(`Component '${componentType}' not found on node '${nodeUuid}'. Available components: ${availableTypes}. Use action=get_all to get the type field (cid) or uuid for componentType.`);
        }

        // The editor's 'remove-component' takes the COMPONENT's uuid (RemoveComponentOptions
        // is { uuid: string } — its `component` field is an unused parameter). Passing the
        // node uuid here is what made removal silently fail.
        const componentUuid = target.uuid;
        if (!componentUuid) {
            return errorResult(`Could not resolve the component uuid for '${componentType}' on node '${nodeUuid}'. The editor requires the component's own uuid to remove it.`);
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
            const stillExists = afterRemoveInfo.success && afterRemoveInfo.data?.components?.some((comp: any) => comp.uuid === componentUuid);
            if (stillExists) {
                return errorResult(`Component '${componentType}' (uuid ${componentUuid}) was not removed from node '${nodeUuid}'.`);
            } else {
                return successResult(
                    { nodeUuid, componentType, componentUuid },
                    `Component '${componentType}' (uuid ${componentUuid}) removed successfully from node '${nodeUuid}'`
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
                    // The dump nests the component's own uuid under value.uuid.value; the
                    // top-level comp.uuid does not exist, so read the dump form first.
                    uuid: comp.value?.uuid?.value || comp.uuid?.value || comp.uuid || null,
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

        // Step 0: Detect if user is trying to set a node property; redirect with guidance
        const nodeRedirectResult = redirectNodePropertyAccess(args);
        if (nodeRedirectResult) {
            return nodeRedirectResult;
        }

        // Step 1: Resolve the target component (and its raw __comps__ index) once.
        const resolution = await this.resolveTargetComponent(nodeUuid, componentType, property);
        if (!resolution.ok) {
            return resolution.result;
        }

        // Step 2: Apply the single property using the shared per-field logic.
        const fieldResult = await this.applySingleProperty(
            nodeUuid, componentType, resolution.targetComponent, resolution.rawComponentIndex,
            { property, propertyType, value }
        );

        if (!fieldResult.success) {
            return errorResult(fieldResult.error || `Failed to set property '${property}'`);
        }

        return successResult({
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
    private async setComponentPropertiesBatch(args: any): Promise<ActionToolResult> {
        const { nodeUuid, componentType, properties } = args;

        if (!nodeUuid || !componentType) {
            return errorResult('nodeUuid and componentType are required for action=set_properties_batch');
        }
        if (!Array.isArray(properties) || properties.length === 0) {
            return errorResult('properties must be a non-empty array of {property, propertyType, value} entries for action=set_properties_batch');
        }

        // Resolve the target component once for the whole batch.
        const resolution = await this.resolveTargetComponent(nodeUuid, componentType, undefined);
        if (!resolution.ok) {
            return resolution.result;
        }

        const results: Array<{ property: string; success: boolean; actualValue?: any; changeVerified?: boolean; error?: string }> = [];

        for (const entry of properties) {
            const property = entry?.property;
            const propertyType = entry?.propertyType;
            const value = entry?.value;

            if (!property || propertyType === undefined || value === undefined) {
                results.push({
                    property: property || '(missing)',
                    success: false,
                    error: 'Each entry requires property, propertyType, and value'
                });
                continue;
            }

            try {
                const fieldResult = await this.applySingleProperty(
                    nodeUuid, componentType, resolution.targetComponent, resolution.rawComponentIndex,
                    { property, propertyType, value }
                );
                results.push({
                    property,
                    success: fieldResult.success,
                    actualValue: fieldResult.actualValue,
                    changeVerified: fieldResult.changeVerified,
                    error: fieldResult.error
                });
            } catch (err: any) {
                // Defensive: one bad field must never abort the batch.
                results.push({ property, success: false, error: err?.message || String(err) });
            }
        }

        const succeeded = results.filter(r => r.success).length;
        const failed = results.length - succeeded;
        const message = `set_properties_batch on ${componentType}: ${succeeded}/${results.length} field(s) set${failed > 0 ? `, ${failed} failed` : ''}`;

        return successResult({
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
    private async resolveTargetComponent(
        nodeUuid: string,
        componentType: string,
        property: string | undefined
    ): Promise<
        | { ok: true; targetComponent: any; rawComponentIndex: number }
        | { ok: false; result: ActionToolResult }
    > {
        // Get all components (dump form) on the node.
        const componentsResponse = await this.getComponents(nodeUuid);
        if (!componentsResponse.success || !componentsResponse.data) {
            return { ok: false, result: errorResult(`Failed to get components for node '${nodeUuid}': ${componentsResponse.error}`) };
        }

        const allComponents = componentsResponse.data.components;
        let targetComponent = null;
        let resolvedIndex = -1;
        const availableTypes: string[] = [];
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
                const byName: any = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: 'cocos-mcp-server', method: 'resolveComponentByName', args: [nodeUuid, componentType]
                });
                const index = byName?.success ? byName.data?.index : undefined;
                if (typeof index === 'number' && index >= 0 && index < allComponents.length) {
                    resolvedIndex = index;
                    targetComponent = allComponents[index];
                }
            } catch {
                // Scene script unavailable — fall through to the not-found error below.
            }
        }

        if (!targetComponent) {
            const instruction = generateComponentSuggestion(componentType, availableTypes, property || '');
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
            return { ok: false, result: errorResult('Failed to get raw node data for property setting') };
        }

        let rawComponentIndex = -1;
        for (let i = 0; i < rawNodeData.__comps__.length; i++) {
            const comp = rawNodeData.__comps__[i] as any;
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
            return { ok: false, result: errorResult('Could not find component index for setting property') };
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
    private async applySingleProperty(
        nodeUuid: string,
        componentType: string,
        targetComponent: any,
        rawComponentIndex: number,
        field: { property: string; propertyType: string; value: any }
    ): Promise<{ success: boolean; actualValue?: any; changeVerified?: boolean; error?: string }> {
        const { property, propertyType, value } = field;
        try {
            console.log(`[ManageComponent] Setting ${componentType}.${property} (type: ${propertyType}) = ${JSON.stringify(value)} on node ${nodeUuid}`);

            // Analyze the property to get original value and type info (supports dotted paths).
            let propertyInfo;
            try {
                propertyInfo = analyzeProperty(targetComponent, property);
            } catch (analyzeError: any) {
                return { success: false, error: `Failed to analyze property '${property}': ${analyzeError.message}` };
            }

            if (!propertyInfo.exists) {
                return { success: false, error: `Property '${property}' not found on component '${componentType}'. Available properties: ${propertyInfo.availableProperties.join(', ')}` };
            }

            // Convert value based on explicit propertyType.
            const originalValue = propertyInfo.originalValue;
            const processedValue: any = convertPropertyValue(propertyType, value);

            // Build the (possibly dotted) component property path and apply via type-aware Editor API.
            const propertyPath = `__comps__.${rawComponentIndex}.${property}`;
            const actualExpectedValue = await applyPropertyToEditor(
                { nodeUuid, propertyPath, rawComponentIndex, componentType, property, propertyType, value, processedValue },
                (uuid, type) => this.getComponentInfo(uuid, type)
            );

            // Wait for editor to complete the update, then verify.
            // Look up by the RESOLVED dump type (targetComponent.type — a cid when
            // componentType was a class name resolved via resolveComponentByName),
            // not the caller-supplied componentType: getComponentInfo matches against
            // the dump's __type__/cid, which never equals a readable class name, so
            // verification would always report unverified for the class-name path.
            const verification = await verifyComponentPropertyChange(
                nodeUuid, targetComponent.type || componentType, property, originalValue, actualExpectedValue,
                (uuid, type) => this.getComponentInfo(uuid, type)
            );

            if (!verification.verified) {
                return {
                    success: false,
                    actualValue: verification.actualValue,
                    changeVerified: false,
                    error: `Property '${componentType}.${property}' write did not verify: expected ${JSON.stringify(actualExpectedValue)} but the editor reads back ${JSON.stringify(verification.actualValue)}`
                };
            }

            return { success: true, actualValue: verification.actualValue, changeVerified: true };
        } catch (error: any) {
            console.error(`[ManageComponent] Error setting property '${property}':`, error);
            return { success: false, error: `Failed to set property '${property}': ${error.message}` };
        }
    }

}
