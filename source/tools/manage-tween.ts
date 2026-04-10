import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const EASING_VALUES = ['linear','quadIn','quadOut','quadInOut','cubicIn','cubicOut','cubicInOut',
    'sineIn','sineOut','sineInOut','bounceIn','bounceOut','bounceInOut',
    'elasticIn','elasticOut','elasticInOut','backIn','backOut','backInOut'];

export class ManageTween extends BaseActionTool {
    readonly name = 'manage_tween';
    readonly description = 'Manage Cocos Creator tweens for node animation. Actions: create, add_to, add_by, add_delay, stop_all, get_info. Tweens are runtime-only and control node properties like position, rotation, scale, opacity over time.';
    readonly actions = ['create', 'add_to', 'add_by', 'add_delay', 'stop_all', 'get_info'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'add_to', 'add_by', 'add_delay', 'stop_all', 'get_info'],
                description: 'Action: create=build+start tween from steps, add_to=absolute property tween, add_by=relative property tween, add_delay=delay step, stop_all=stop all tweens on node, get_info=tween system info'
            },
            nodeUuid: {
                type: 'string',
                description: '[create, add_to, add_by, add_delay, stop_all] Target node UUID'
            },
            steps: {
                type: 'array',
                description: '[create] Tween step sequence. Each step: {type:"to"|"by"|"delay"|"call", duration?, properties?, easing?}',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['to', 'by', 'delay', 'call'] },
                        duration: { type: 'number' },
                        properties: { type: 'object', description: 'Node properties to animate: position{x,y,z}, rotation{x,y,z}, scale{x,y,z}, opacity' },
                        easing: { type: 'string', enum: EASING_VALUES }
                    }
                }
            },
            properties: {
                type: 'object',
                description: '[add_to, add_by] Properties to animate. Supports: position{x,y,z}, rotation{x,y,z}, scale{x,y,z}, opacity (0-255)'
            },
            duration: {
                type: 'number',
                description: '[add_to, add_by, add_delay] Duration in seconds'
            },
            easing: {
                type: 'string',
                enum: EASING_VALUES,
                description: '[add_to, add_by] Easing function name'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        create: (args) => this.createTween(args),
        add_to: (args) => this.sceneCall('addTweenTo', args, ['nodeUuid', 'properties', 'duration']),
        add_by: (args) => this.sceneCall('addTweenBy', args, ['nodeUuid', 'properties', 'duration']),
        add_delay: (args) => this.sceneCall('addTweenDelay', args, ['nodeUuid', 'duration']),
        stop_all: (args) => this.sceneCall('stopTweens', args, ['nodeUuid']),
        get_info: async (_args) => successResult({
            note: 'Tweens are runtime-only. No persistent tween state is exposed by Cocos Creator.',
            tip: 'Use create/add_to/add_by to start tweens. Use stop_all to stop by nodeUuid.'
        }),
    };

    private async createTween(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for create');
        if (!Array.isArray(args.steps) || args.steps.length === 0) return errorResult('steps array is required for create');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'createTween', args: [args.nodeUuid, args.steps]
            });
            return (result as any)?.success ? successResult((result as any).data, 'Tween created and started') : errorResult((result as any)?.error || 'Failed to create tween');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async sceneCall(method: string, args: any, required: string[]): Promise<ActionToolResult> {
        for (const r of required) {
            if (args[r] === undefined || args[r] === null) return errorResult(`${r} is required`);
        }
        try {
            const methodArgs = method === 'addTweenTo' || method === 'addTweenBy'
                ? [args.nodeUuid, args.properties, args.duration, args.easing || 'linear']
                : method === 'addTweenDelay'
                ? [args.nodeUuid, args.duration]
                : [args.nodeUuid];
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method, args: methodArgs
            });
            return (result as any)?.success ? successResult((result as any).data, (result as any).message) : errorResult((result as any)?.error || `${method} failed`);
        } catch (err: any) { return errorResult(err.message); }
    }
}
