import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageCamera extends BaseActionTool {
    readonly name = 'manage_camera';
    readonly description = 'Manage Camera components in scene. Actions: get_info=get camera properties, set_property=set camera property, set_clear_flags=set clear flags, set_projection=set projection type, set_viewport=set viewport rect, list=list all cameras.';
    readonly actions = ['get_info', 'set_property', 'set_clear_flags', 'set_projection', 'set_viewport', 'list'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_info', 'set_property', 'set_clear_flags', 'set_projection', 'set_viewport', 'list'],
                description: 'Action: get_info=get camera properties, set_property=set property, set_clear_flags=set clear mode, set_projection=ORTHO or PERSPECTIVE, set_viewport=set normalized viewport rect, list=list all cameras'
            },
            nodeUuid: {
                type: 'string',
                description: '[get_info, set_property, set_clear_flags, set_projection, set_viewport] Target node UUID'
            },
            property: {
                type: 'string',
                enum: ['fov', 'orthoHeight', 'near', 'far', 'priority', 'visibility'],
                description: '[set_property] Camera property to set'
            },
            value: {
                description: '[set_property] Value to set for the property'
            },
            clearFlags: {
                type: 'string',
                enum: ['SOLID_COLOR', 'DEPTH_ONLY', 'DONT_CLEAR', 'SKYBOX'],
                description: '[set_clear_flags] Camera clear flags mode'
            },
            projection: {
                type: 'string',
                enum: ['ORTHO', 'PERSPECTIVE'],
                description: '[set_projection] Camera projection type'
            },
            x: { type: 'number', description: '[set_viewport] Viewport x (0-1 normalized)', default: 0 },
            y: { type: 'number', description: '[set_viewport] Viewport y (0-1 normalized)', default: 0 },
            width: { type: 'number', description: '[set_viewport] Viewport width (0-1 normalized)', default: 1 },
            height: { type: 'number', description: '[set_viewport] Viewport height (0-1 normalized)', default: 1 }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getCameraInfo(args),
        set_property: (args) => this.setCameraProperty(args),
        set_clear_flags: (args) => this.setClearFlags(args),
        set_projection: (args) => this.setProjection(args),
        set_viewport: (args) => this.setViewport(args),
        list: (args) => this.listCameras(args),
    };

    private async getCameraInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getCameraInfo',
                args: [args.nodeUuid]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to get camera info');
            return successResult((result as any).data);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setCameraProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.property) return errorResult('property is required');
        if (args.value === undefined) return errorResult('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set camera property');
            return successResult(null, `Camera property '${args.property}' updated`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setClearFlags(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.clearFlags) return errorResult('clearFlags is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, 'clearFlags', args.clearFlags]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set clear flags');
            return successResult(null, `Camera clearFlags set to '${args.clearFlags}'`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setProjection(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.projection) return errorResult('projection is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, 'projection', args.projection]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set projection');
            return successResult(null, `Camera projection set to '${args.projection}'`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setViewport(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        const x = args.x ?? 0, y = args.y ?? 0, width = args.width ?? 1, height = args.height ?? 1;
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, 'viewport', { x, y, width, height }]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set viewport');
            return successResult(null, `Camera viewport set to (${x}, ${y}, ${width}, ${height})`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listCameras(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listCameras',
                args: []
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to list cameras');
            return successResult((result as any).data);
        } catch (err: any) { return errorResult(err.message); }
    }
}
