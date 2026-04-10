import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageDragonBones extends BaseActionTool {
    readonly name = 'manage_dragonbones';
    readonly description = 'Manage DragonBones skeletal animation (ArmatureDisplay). Actions: get_info, set_animation, set_armature, set_property, list, add_to_node. Requires DragonBones runtime in project.';
    readonly actions = ['get_info', 'set_animation', 'set_armature', 'set_property', 'list', 'add_to_node'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_info', 'set_animation', 'set_armature', 'set_property', 'list', 'add_to_node'],
                description: 'Action: get_info=get ArmatureDisplay info, set_animation=play animation, set_armature=set armature, set_property=set property, list=list DragonBones nodes, add_to_node=add component'
            },
            nodeUuid: {
                type: 'string',
                description: '[get_info, set_animation, set_armature, set_property, add_to_node] UUID of the node'
            },
            animationName: {
                type: 'string',
                description: '[set_animation] Animation name to play'
            },
            playTimes: {
                type: 'number',
                description: '[set_animation] Play times: -1=loop, 0=use default, N=play N times (default: -1)',
                default: -1
            },
            armatureName: {
                type: 'string',
                description: '[set_armature] Armature name to set'
            },
            property: {
                type: 'string',
                enum: ['timeScale', 'debugBones', 'playTimes'],
                description: '[set_property] Property name to set'
            },
            value: {
                description: '[set_property] Value to set for the property'
            },
            dragonBonesAssetUuid: {
                type: 'string',
                description: '[add_to_node] UUID of the DragonBones asset'
            },
            dragonBonesAtlasAssetUuid: {
                type: 'string',
                description: '[add_to_node] UUID of the DragonBones atlas asset'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getDragonBonesInfo(args),
        set_animation: (args) => this.setDragonBonesAnimation(args),
        set_armature: (args) => this.setDragonBonesArmature(args),
        set_property: (args) => this.setDragonBonesProperty(args),
        list: (args) => this.listDragonBonesNodes(args),
        add_to_node: (args) => this.addDragonBonesToNode(args),
    };

    private async getDragonBonesInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getDragonBonesInfo', args: [args.nodeUuid]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setDragonBonesAnimation(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_animation');
        if (!args.animationName) return errorResult('animationName is required for set_animation');
        try {
            const playTimes = typeof args.playTimes === 'number' ? args.playTimes : -1;
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setDragonBonesAnimation', args: [args.nodeUuid, args.animationName, playTimes]
            });
            return (result as any).success ? successResult((result as any).data, `Animation '${args.animationName}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setDragonBonesArmature(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_armature');
        if (!args.armatureName) return errorResult('armatureName is required for set_armature');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setDragonBonesArmature', args: [args.nodeUuid, args.armatureName]
            });
            return (result as any).success ? successResult((result as any).data, `Armature '${args.armatureName}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setDragonBonesProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_property');
        if (!args.property) return errorResult('property is required for set_property');
        if (args.value === undefined) return errorResult('value is required for set_property');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setDragonBonesProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return (result as any).success ? successResult((result as any).data, `Property '${args.property}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listDragonBonesNodes(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listDragonBonesNodes', args: []
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async addDragonBonesToNode(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for add_to_node');
        if (!args.dragonBonesAssetUuid) return errorResult('dragonBonesAssetUuid is required for add_to_node');
        if (!args.dragonBonesAtlasAssetUuid) return errorResult('dragonBonesAtlasAssetUuid is required for add_to_node');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addDragonBonesToNode',
                args: [args.nodeUuid, args.dragonBonesAssetUuid, args.dragonBonesAtlasAssetUuid]
            });
            return (result as any).success ? successResult((result as any).data, 'DragonBones component added') : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }
}
