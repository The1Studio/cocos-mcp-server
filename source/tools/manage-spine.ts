import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageSpine extends BaseActionTool {
    readonly name = 'manage_spine';
    readonly description = 'Manage Spine skeletal animation (sp.Skeleton). Actions: get_info, set_animation, set_skin, set_property, list, add_to_node. Requires Spine runtime in project.';
    readonly actions = ['get_info', 'set_animation', 'set_skin', 'set_property', 'list', 'add_to_node'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_info', 'set_animation', 'set_skin', 'set_property', 'list', 'add_to_node'],
                description: 'Action: get_info=get skeleton info, set_animation=play animation, set_skin=set skin, set_property=set property, list=list Spine nodes, add_to_node=add Spine component'
            },
            nodeUuid: {
                type: 'string',
                description: '[get_info, set_animation, set_skin, set_property, add_to_node] UUID of the node'
            },
            animationName: {
                type: 'string',
                description: '[set_animation] Animation name to play'
            },
            loop: {
                type: 'boolean',
                description: '[set_animation] Whether to loop the animation (default: true)',
                default: true
            },
            trackIndex: {
                type: 'number',
                description: '[set_animation] Track index (default: 0)',
                default: 0
            },
            skinName: {
                type: 'string',
                description: '[set_skin] Skin name to set'
            },
            property: {
                type: 'string',
                enum: ['timeScale', 'premultipliedAlpha', 'debugBones', 'debugSlots'],
                description: '[set_property] Property name to set'
            },
            value: {
                description: '[set_property] Value to set for the property'
            },
            skeletonDataUuid: {
                type: 'string',
                description: '[add_to_node] UUID of the SkeletonData asset to assign'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getSpineInfo(args),
        set_animation: (args) => this.setSpineAnimation(args),
        set_skin: (args) => this.setSpineSkin(args),
        set_property: (args) => this.setSpineProperty(args),
        list: (args) => this.listSpineNodes(args),
        add_to_node: (args) => this.addSpineToNode(args),
    };

    private async getSpineInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getSpineInfo', args: [args.nodeUuid]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setSpineAnimation(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_animation');
        if (!args.animationName) return errorResult('animationName is required for set_animation');
        try {
            const loop = args.loop !== false;
            const trackIndex = typeof args.trackIndex === 'number' ? args.trackIndex : 0;
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSpineAnimation', args: [args.nodeUuid, args.animationName, loop, trackIndex]
            });
            return (result as any).success ? successResult((result as any).data, `Animation '${args.animationName}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setSpineSkin(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_skin');
        if (!args.skinName) return errorResult('skinName is required for set_skin');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSpineSkin', args: [args.nodeUuid, args.skinName]
            });
            return (result as any).success ? successResult((result as any).data, `Skin '${args.skinName}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setSpineProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_property');
        if (!args.property) return errorResult('property is required for set_property');
        if (args.value === undefined) return errorResult('value is required for set_property');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSpineProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return (result as any).success ? successResult((result as any).data, `Property '${args.property}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listSpineNodes(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listSpineNodes', args: []
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async addSpineToNode(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for add_to_node');
        if (!args.skeletonDataUuid) return errorResult('skeletonDataUuid is required for add_to_node');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addSpineToNode', args: [args.nodeUuid, args.skeletonDataUuid]
            });
            return (result as any).success ? successResult((result as any).data, 'Spine component added') : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }
}
