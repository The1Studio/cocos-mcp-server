import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageMesh extends BaseActionTool {
    readonly name = 'manage_mesh';
    readonly description = 'Manage mesh assets and MeshRenderer components. Actions: get_info, list, get_renderer_info, set_renderer_property. Query mesh assets and control MeshRenderer shadow/visibility settings on nodes.';
    readonly actions = ['get_info', 'list', 'get_renderer_info', 'set_renderer_property'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_info', 'list', 'get_renderer_info', 'set_renderer_property'],
                description: 'Action: get_info=get mesh asset info by uuid, list=list mesh assets, get_renderer_info=get MeshRenderer on node, set_renderer_property=set MeshRenderer property'
            },
            uuid: { type: 'string', description: '[get_info] Mesh asset UUID' },
            pattern: { type: 'string', description: '[list] Glob pattern (default: db://assets/**/*.mesh)', default: 'db://assets/**/*.mesh' },
            nodeUuid: { type: 'string', description: '[get_renderer_info/set_renderer_property] Node UUID with MeshRenderer component' },
            property: {
                type: 'string',
                enum: ['shadowCastingMode', 'receiveShadow', 'visibility'],
                description: '[set_renderer_property] Property to set: shadowCastingMode (0=OFF,1=ON), receiveShadow (bool), visibility (number bitmask)'
            },
            value: { description: '[set_renderer_property] Value to set for the property' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getMeshInfo(args),
        list: (args) => this.listMeshes(args),
        get_renderer_info: (args) => this.getRendererInfo(args),
        set_renderer_property: (args) => this.setRendererProperty(args),
    };

    private async getMeshInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.uuid) return errorResult('uuid is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.uuid);
            let meta: any = null;
            try { meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.uuid); } catch { /* optional */ }
            return successResult({ info, meta });
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listMeshes(args: any): Promise<ActionToolResult> {
        try {
            const pattern = args.pattern || 'db://assets/**/*.mesh';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return successResult({ meshes: assets, count: (assets as any[]).length });
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getRendererInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.nodeUuid) return errorResult('nodeUuid is required for get_renderer_info');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getMeshRendererInfo', args: [args.nodeUuid]
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setRendererProperty(args: any): Promise<ActionToolResult> {
        try {
            if (!args.nodeUuid) return errorResult('nodeUuid is required for set_renderer_property');
            if (!args.property) return errorResult('property is required for set_renderer_property');
            if (args.value === undefined) return errorResult('value is required for set_renderer_property');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setMeshRendererProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            return successResult(result, `MeshRenderer.${args.property} updated`);
        } catch (err: any) { return errorResult(err.message); }
    }
}
