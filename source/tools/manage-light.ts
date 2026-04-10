import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageLight extends BaseActionTool {
    readonly name = 'manage_light';
    readonly description = 'Manage light components in scene. Actions: add=add light to node, set_property=set light property, get_info=get light info on node, list=list all lights in scene, remove=remove light from node.';
    readonly actions = ['add', 'set_property', 'get_info', 'list', 'remove'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add', 'set_property', 'get_info', 'list', 'remove'],
                description: 'Action: add=add light component, set_property=set light property, get_info=get light info, list=list all lights, remove=remove light component'
            },
            nodeUuid: {
                type: 'string',
                description: '[add, set_property, get_info, remove] Target node UUID'
            },
            type: {
                type: 'string',
                enum: ['directional', 'sphere', 'spot'],
                description: '[add] Light type: directional=DirectionalLight, sphere=SphereLight, spot=SpotLight'
            },
            color: {
                description: '[add, set_property] Light color as hex string "#RRGGBB" or object {r,g,b,a} (0-255)'
            },
            intensity: {
                type: 'number',
                description: '[add, set_property] Light intensity value'
            },
            property: {
                type: 'string',
                enum: ['color', 'intensity', 'range', 'spotAngle', 'shadowEnabled', 'shadowBias'],
                description: '[set_property] Light property to set'
            },
            value: {
                description: '[set_property] Value to set for the property'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add: (args) => this.addLight(args),
        set_property: (args) => this.setLightProperty(args),
        get_info: (args) => this.getLightInfo(args),
        list: (args) => this.listLights(args),
        remove: (args) => this.removeLightComponent(args),
    };

    private async addLight(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for add');
        if (!args.type) return errorResult('type is required for add (directional/sphere/spot)');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addLightComponent',
                args: [args.nodeUuid, args.type, args.color, args.intensity]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to add light');
            return successResult((result as any).data, `${args.type} light added to node`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setLightProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.property) return errorResult('property is required');
        if (args.value === undefined) return errorResult('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setLightProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set property');
            return successResult(null, `Light property '${args.property}' updated`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getLightInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getLightInfo',
                args: [args.nodeUuid]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to get light info');
            return successResult((result as any).data);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listLights(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listLights',
                args: []
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to list lights');
            return successResult((result as any).data);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async removeLightComponent(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'removeLightComponent',
                args: [args.nodeUuid]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to remove light');
            return successResult(null, 'Light component removed');
        } catch (err: any) { return errorResult(err.message); }
    }
}
