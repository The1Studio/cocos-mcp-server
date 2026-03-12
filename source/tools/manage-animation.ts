import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import * as fs from 'fs';

const DEFAULT_ANIM_CLIP = JSON.stringify({
    "__type__": "cc.AnimationClip",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_native": "",
    "sample": 60,
    "speed": 1,
    "wrapMode": 1,
    "enableTRS": false,
    "duration": 0,
    "keys": [],
    "curves": [],
    "events": []
}, null, 2);

export class ManageAnimation extends BaseActionTool {
    readonly name = 'manage_animation';
    readonly description = 'Manage animation clips. Actions: create_clip, get_info, list, set_keyframe. Create animation clips and set keyframes for node properties. Animation clips are assets (.anim files) that can be assigned to Animation components.';
    readonly actions = ['create_clip', 'get_info', 'list', 'set_keyframe'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create_clip', 'get_info', 'list', 'set_keyframe'],
                description: 'Action to perform: create_clip=create new .anim clip asset, get_info=query asset info and meta, list=list all .anim assets, set_keyframe=add/update a keyframe in a clip track'
            },
            url: {
                type: 'string',
                description: '[create_clip, get_info, set_keyframe] Asset DB URL (e.g., db://assets/animations/Walk.anim)'
            },
            sample: {
                type: 'number',
                description: '[create_clip] Sample rate in frames per second (default: 60)',
                default: 60
            },
            duration: {
                type: 'number',
                description: '[create_clip] Clip duration in seconds (default: 1)',
                default: 1
            },
            path: {
                type: 'string',
                description: '[set_keyframe] Node path within the clip (e.g., "" for root, "Arm" for child named Arm)'
            },
            property: {
                type: 'string',
                description: '[set_keyframe] Property to animate (e.g., "position.x", "rotation", "scale")'
            },
            frame: {
                type: 'number',
                description: '[set_keyframe] Frame index at which to set the keyframe value'
            },
            value: {
                description: '[set_keyframe] Keyframe value to set'
            },
            pattern: {
                type: 'string',
                description: '[list] Glob pattern to filter clips (default: db://assets/**/*.anim)',
                default: 'db://assets/**/*.anim'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        create_clip: (args) => this.createClip(args),
        get_info: (args) => this.getClipInfo(args),
        list: (args) => this.listClips(args),
        set_keyframe: (args) => this.setKeyframe(args),
    };

    private async createClip(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for create_clip');

            const clipData = {
                "__type__": "cc.AnimationClip",
                "_name": "",
                "_objFlags": 0,
                "__editorExtras__": {},
                "_native": "",
                "sample": typeof args.sample === 'number' ? args.sample : 60,
                "speed": 1,
                "wrapMode": 1,
                "enableTRS": false,
                "duration": typeof args.duration === 'number' ? args.duration : 1,
                "keys": [],
                "curves": [],
                "events": []
            };

            const result = await Editor.Message.request('asset-db', 'create-asset', args.url, JSON.stringify(clipData, null, 2));
            return successResult(
                { url: args.url, uuid: (result as any)?.uuid, sample: clipData.sample, duration: clipData.duration },
                `Animation clip created at ${args.url}`
            );
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async getClipInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            let meta: any = null;
            try {
                meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            } catch {
                // meta may not be available for all assets
            }
            return successResult({ info, meta });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async listClips(args: any): Promise<ActionToolResult> {
        try {
            const pattern = args.pattern || 'db://assets/**/*.anim';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return successResult({ clips: assets, count: (assets as any[]).length });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async setKeyframe(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for set_keyframe');
            if (!args.property) return errorResult('property is required for set_keyframe');
            if (args.frame === undefined || args.frame === null) return errorResult('frame is required for set_keyframe');
            if (args.value === undefined) return errorResult('value is required for set_keyframe');

            const filePath: string = await Editor.Message.request('asset-db', 'query-path', args.url) as string;
            if (!filePath) return errorResult(`Could not resolve path for ${args.url}`);

            let clipData: any;
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                clipData = JSON.parse(raw);
            } catch (parseErr: any) {
                return errorResult(`Failed to read clip file: ${parseErr.message}`);
            }

            if (!Array.isArray(clipData.curves)) clipData.curves = [];

            const nodePath = args.path || '';
            const sample: number = clipData.sample || 60;
            const time: number = args.frame / sample;

            // Find or create the curve for this node path + property
            let curve = clipData.curves.find(
                (c: any) => c.modifiers && c.modifiers[0] === nodePath && c.modifiers[1] === args.property
            );

            if (!curve) {
                curve = {
                    modifiers: [nodePath, args.property],
                    data: { keys: 0, values: [] }
                };
                clipData.curves.push(curve);
            }

            if (!Array.isArray(clipData.keys) || clipData.keys.length === 0) {
                clipData.keys = [[]];
            }

            const keyIndex = clipData.keys[0].length;
            clipData.keys[0].push(time);
            if (!Array.isArray(curve.data.values)) curve.data.values = [];
            curve.data.values.push(args.value);

            // Update duration if this keyframe extends it
            if (time > (clipData.duration || 0)) {
                clipData.duration = time;
            }

            await Editor.Message.request('asset-db', 'save-asset', args.url, JSON.stringify(clipData, null, 2));
            return successResult(
                { url: args.url, nodePath, property: args.property, frame: args.frame, time, value: args.value },
                `Keyframe set at frame ${args.frame} (t=${time}s) for '${args.property}' on path '${nodePath}'`
            );
        } catch (err: any) {
            return errorResult(err.message);
        }
    }
}
