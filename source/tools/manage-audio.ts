import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageAudio extends BaseActionTool {
    readonly name = 'manage_audio';
    readonly description = 'Manage AudioSource components. Actions: add_source, set_property, play, stop, pause, resume, get_info, list. Add audio sources to nodes and control playback.';
    readonly actions = ['add_source', 'set_property', 'play', 'stop', 'pause', 'resume', 'get_info', 'list'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add_source', 'set_property', 'play', 'stop', 'pause', 'resume', 'get_info', 'list'],
                description: 'Action: add_source=add AudioSource to node, set_property=set clip/volume/loop/playOnAwake, play/stop/pause/resume=control playback, get_info=get properties, list=list all AudioSource nodes'
            },
            nodeUuid: {
                type: 'string',
                description: '[add_source, set_property, play, stop, pause, resume, get_info] Target node UUID'
            },
            clipUuid: {
                type: 'string',
                description: '[add_source] Optional audio clip asset UUID to assign'
            },
            property: {
                type: 'string',
                enum: ['clip', 'volume', 'loop', 'playOnAwake'],
                description: '[set_property] Property to set on AudioSource'
            },
            value: {
                description: '[set_property] Property value (uuid string for clip, number 0-1 for volume, boolean for loop/playOnAwake)'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add_source: (args) => this.addSource(args),
        set_property: (args) => this.setProperty(args),
        play: (args) => this.controlAudio(args, 'play'),
        stop: (args) => this.controlAudio(args, 'stop'),
        pause: (args) => this.controlAudio(args, 'pause'),
        resume: (args) => this.controlAudio(args, 'resume'),
        get_info: (args) => this.getInfo(args),
        list: (_args) => this.listAudioSources(),
    };

    private async addSource(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for add_source');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addAudioSource', args: [args.nodeUuid, args.clipUuid || null]
            });
            return (result as any)?.success ? successResult((result as any).data, 'AudioSource added') : errorResult((result as any)?.error || 'Failed to add AudioSource');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.property) return errorResult('property is required');
        if (args.value === undefined) return errorResult('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setAudioProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return (result as any)?.success ? successResult(null, `AudioSource.${args.property} updated`) : errorResult((result as any)?.error || 'Failed');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async controlAudio(args: any, command: string): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'controlAudio', args: [args.nodeUuid, command]
            });
            return (result as any)?.success ? successResult(null, `Audio ${command} executed`) : errorResult((result as any)?.error || 'Failed');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getAudioInfo', args: [args.nodeUuid]
            });
            return (result as any)?.success ? successResult((result as any).data) : errorResult((result as any)?.error || 'Failed');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listAudioSources(): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listAudioSources', args: []
            });
            return (result as any)?.success ? successResult((result as any).data) : errorResult((result as any)?.error || 'Failed');
        } catch (err: any) { return errorResult(err.message); }
    }
}
