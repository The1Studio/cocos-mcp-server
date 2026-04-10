import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageVideo extends BaseActionTool {
    readonly name = 'manage_video';
    readonly description = 'Manage VideoPlayer components on nodes. Actions: add, set_property, play, get_info, list. Add VideoPlayer components, configure clip/URL/loop/volume, and control playback.';
    readonly actions = ['add', 'set_property', 'play', 'get_info', 'list'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add', 'set_property', 'play', 'get_info', 'list'],
                description: 'Action: add=add VideoPlayer to node, set_property=set VideoPlayer property, play=control playback, get_info=get VideoPlayer info, list=list VideoPlayer nodes'
            },
            nodeUuid: { type: 'string', description: '[add/set_property/play/get_info] Target node UUID' },
            clipUrl: { type: 'string', description: '[add] Asset DB URL of the video clip to assign (e.g., db://assets/video/intro.mp4)' },
            property: {
                type: 'string',
                enum: ['resourceType', 'remoteURL', 'clip', 'loop', 'playbackRate', 'volume'],
                description: '[set_property] Property to set: resourceType(0=local,1=remote), remoteURL(string), clip(asset url), loop(bool), playbackRate(number), volume(0-1)'
            },
            value: { description: '[set_property] Value for the property' },
            command: {
                type: 'string',
                enum: ['play', 'pause', 'stop', 'resume'],
                description: '[play] Playback command: play, pause, stop, or resume'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add: (args) => this.addVideoPlayer(args),
        set_property: (args) => this.setProperty(args),
        play: (args) => this.controlVideo(args),
        get_info: (args) => this.getInfo(args),
        list: (args) => this.listVideoPlayers(args),
    };

    private async addVideoPlayer(args: any): Promise<ActionToolResult> {
        try {
            if (!args.nodeUuid) return errorResult('nodeUuid is required for add');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addVideoPlayer',
                args: [args.nodeUuid, args.clipUrl]
            });
            return successResult(result, 'VideoPlayer added');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setProperty(args: any): Promise<ActionToolResult> {
        try {
            if (!args.nodeUuid) return errorResult('nodeUuid is required for set_property');
            if (!args.property) return errorResult('property is required for set_property');
            if (args.value === undefined) return errorResult('value is required for set_property');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setVideoProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            return successResult(result, `VideoPlayer.${args.property} updated`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async controlVideo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.nodeUuid) return errorResult('nodeUuid is required for play');
            if (!args.command) return errorResult('command is required for play (play/pause/stop/resume)');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'controlVideo',
                args: [args.nodeUuid, args.command]
            });
            return successResult(result, `VideoPlayer command '${args.command}' sent`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.nodeUuid) return errorResult('nodeUuid is required for get_info');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getVideoInfo', args: [args.nodeUuid]
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listVideoPlayers(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listVideoPlayers', args: []
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }
}
