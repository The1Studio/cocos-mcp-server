"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageAnimation = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const fs = __importStar(require("fs"));
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
class ManageAnimation extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_animation';
        this.description = 'Manage animation clips. Actions: create_clip, get_info, list, set_keyframe. Create animation clips and set keyframes for node properties. Animation clips are assets (.anim files) that can be assigned to Animation components.';
        this.actions = ['create_clip', 'get_info', 'list', 'set_keyframe'];
        this.inputSchema = {
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
        this.actionHandlers = {
            create_clip: (args) => this.createClip(args),
            get_info: (args) => this.getClipInfo(args),
            list: (args) => this.listClips(args),
            set_keyframe: (args) => this.setKeyframe(args),
        };
    }
    async createClip(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for create_clip');
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
            return (0, types_1.successResult)({ url: args.url, uuid: result === null || result === void 0 ? void 0 : result.uuid, sample: clipData.sample, duration: clipData.duration }, `Animation clip created at ${args.url}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getClipInfo(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            let meta = null;
            try {
                meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            }
            catch (_a) {
                // meta may not be available for all assets
            }
            return (0, types_1.successResult)({ info, meta });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listClips(args) {
        try {
            const pattern = args.pattern || 'db://assets/**/*.anim';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return (0, types_1.successResult)({ clips: assets, count: assets.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setKeyframe(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for set_keyframe');
            if (!args.property)
                return (0, types_1.errorResult)('property is required for set_keyframe');
            if (args.frame === undefined || args.frame === null)
                return (0, types_1.errorResult)('frame is required for set_keyframe');
            if (args.value === undefined)
                return (0, types_1.errorResult)('value is required for set_keyframe');
            const filePath = await Editor.Message.request('asset-db', 'query-path', args.url);
            if (!filePath)
                return (0, types_1.errorResult)(`Could not resolve path for ${args.url}`);
            let clipData;
            try {
                const raw = fs.readFileSync(filePath, 'utf-8');
                clipData = JSON.parse(raw);
            }
            catch (parseErr) {
                return (0, types_1.errorResult)(`Failed to read clip file: ${parseErr.message}`);
            }
            if (!Array.isArray(clipData.curves))
                clipData.curves = [];
            const nodePath = args.path || '';
            const sample = clipData.sample || 60;
            const time = args.frame / sample;
            // Find or create the curve for this node path + property
            let curve = clipData.curves.find((c) => c.modifiers && c.modifiers[0] === nodePath && c.modifiers[1] === args.property);
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
            if (!Array.isArray(curve.data.values))
                curve.data.values = [];
            curve.data.values.push(args.value);
            // Update duration if this keyframe extends it
            if (time > (clipData.duration || 0)) {
                clipData.duration = time;
            }
            await Editor.Message.request('asset-db', 'save-asset', args.url, JSON.stringify(clipData, null, 2));
            return (0, types_1.successResult)({ url: args.url, nodePath, property: args.property, frame: args.frame, time, value: args.value }, `Keyframe set at frame ${args.frame} (t=${time}s) for '${args.property}' on path '${nodePath}'`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageAnimation = ManageAnimation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFuaW1hdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtYW5pbWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsdUNBQXlCO0FBRXpCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUNyQyxVQUFVLEVBQUUsa0JBQWtCO0lBQzlCLE9BQU8sRUFBRSxFQUFFO0lBQ1gsV0FBVyxFQUFFLENBQUM7SUFDZCxrQkFBa0IsRUFBRSxFQUFFO0lBQ3RCLFNBQVMsRUFBRSxFQUFFO0lBQ2IsUUFBUSxFQUFFLEVBQUU7SUFDWixPQUFPLEVBQUUsQ0FBQztJQUNWLFVBQVUsRUFBRSxDQUFDO0lBQ2IsV0FBVyxFQUFFLEtBQUs7SUFDbEIsVUFBVSxFQUFFLENBQUM7SUFDYixNQUFNLEVBQUUsRUFBRTtJQUNWLFFBQVEsRUFBRSxFQUFFO0lBQ1osUUFBUSxFQUFFLEVBQUU7Q0FDZixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVaLE1BQWEsZUFBZ0IsU0FBUSxpQ0FBYztJQUFuRDs7UUFDYSxTQUFJLEdBQUcsa0JBQWtCLENBQUM7UUFDMUIsZ0JBQVcsR0FBRyxrT0FBa08sQ0FBQztRQUNqUCxZQUFPLEdBQUcsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztRQUM5RCxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxjQUFjLENBQUM7b0JBQ3pELFdBQVcsRUFBRSxnTEFBZ0w7aUJBQ2hNO2dCQUNELEdB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QUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUNoRyx5QkFBeUIsSUFBSSxDQUFDLEtBQUssT0FBTyxJQUFJLFdBQVcsSUFBSSxDQUFDLFFBQVEsY0FBYyxRQUFRLEdBQUcsQ0FDbEcsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBN0tELDBDQTZLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuXG5jb25zdCBERUZBVUxUX0FOSU1fQ0xJUCA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICBcIl9fdHlwZV9fXCI6IFwiY2MuQW5pbWF0aW9uQ2xpcFwiLFxuICAgIFwiX25hbWVcIjogXCJcIixcbiAgICBcIl9vYmpGbGFnc1wiOiAwLFxuICAgIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICBcIl9uYXRpdmVcIjogXCJcIixcbiAgICBcInNhbXBsZVwiOiA2MCxcbiAgICBcInNwZWVkXCI6IDEsXG4gICAgXCJ3cmFwTW9kZVwiOiAxLFxuICAgIFwiZW5hYmxlVFJTXCI6IGZhbHNlLFxuICAgIFwiZHVyYXRpb25cIjogMCxcbiAgICBcImtleXNcIjogW10sXG4gICAgXCJjdXJ2ZXNcIjogW10sXG4gICAgXCJldmVudHNcIjogW11cbn0sIG51bGwsIDIpO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlQW5pbWF0aW9uIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2FuaW1hdGlvbic7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGFuaW1hdGlvbiBjbGlwcy4gQWN0aW9uczogY3JlYXRlX2NsaXAsIGdldF9pbmZvLCBsaXN0LCBzZXRfa2V5ZnJhbWUuIENyZWF0ZSBhbmltYXRpb24gY2xpcHMgYW5kIHNldCBrZXlmcmFtZXMgZm9yIG5vZGUgcHJvcGVydGllcy4gQW5pbWF0aW9uIGNsaXBzIGFyZSBhc3NldHMgKC5hbmltIGZpbGVzKSB0aGF0IGNhbiBiZSBhc3NpZ25lZCB0byBBbmltYXRpb24gY29tcG9uZW50cy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2NyZWF0ZV9jbGlwJywgJ2dldF9pbmZvJywgJ2xpc3QnLCAnc2V0X2tleWZyYW1lJ107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NyZWF0ZV9jbGlwJywgJ2dldF9pbmZvJywgJ2xpc3QnLCAnc2V0X2tleWZyYW1lJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlX2NsaXA9Y3JlYXRlIG5ldyAuYW5pbSBjbGlwIGFzc2V0LCBnZXRfaW5mbz1xdWVyeSBhc3NldCBpbmZvIGFuZCBtZXRhLCBsaXN0PWxpc3QgYWxsIC5hbmltIGFzc2V0cywgc2V0X2tleWZyYW1lPWFkZC91cGRhdGUgYSBrZXlmcmFtZSBpbiBhIGNsaXAgdHJhY2snXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXJsOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2NsaXAsIGdldF9pbmZvLCBzZXRfa2V5ZnJhbWVdIEFzc2V0IERCIFVSTCAoZS5nLiwgZGI6Ly9hc3NldHMvYW5pbWF0aW9ucy9XYWxrLmFuaW0pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNhbXBsZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9jbGlwXSBTYW1wbGUgcmF0ZSBpbiBmcmFtZXMgcGVyIHNlY29uZCAoZGVmYXVsdDogNjApJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiA2MFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGR1cmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2NsaXBdIENsaXAgZHVyYXRpb24gaW4gc2Vjb25kcyAoZGVmYXVsdDogMSknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDFcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2tleWZyYW1lXSBOb2RlIHBhdGggd2l0aGluIHRoZSBjbGlwIChlLmcuLCBcIlwiIGZvciByb290LCBcIkFybVwiIGZvciBjaGlsZCBuYW1lZCBBcm0pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2tleWZyYW1lXSBQcm9wZXJ0eSB0byBhbmltYXRlIChlLmcuLCBcInBvc2l0aW9uLnhcIiwgXCJyb3RhdGlvblwiLCBcInNjYWxlXCIpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZyYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2tleWZyYW1lXSBGcmFtZSBpbmRleCBhdCB3aGljaCB0byBzZXQgdGhlIGtleWZyYW1lIHZhbHVlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2tleWZyYW1lXSBLZXlmcmFtZSB2YWx1ZSB0byBzZXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiB0byBmaWx0ZXIgY2xpcHMgKGRlZmF1bHQ6IGRiOi8vYXNzZXRzLyoqLyouYW5pbSknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qLmFuaW0nXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBjcmVhdGVfY2xpcDogKGFyZ3MpID0+IHRoaXMuY3JlYXRlQ2xpcChhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldENsaXBJbmZvKGFyZ3MpLFxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0Q2xpcHMoYXJncyksXG4gICAgICAgIHNldF9rZXlmcmFtZTogKGFyZ3MpID0+IHRoaXMuc2V0S2V5ZnJhbWUoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlQ2xpcChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBjcmVhdGVfY2xpcCcpO1xuXG4gICAgICAgICAgICBjb25zdCBjbGlwRGF0YSA9IHtcbiAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuQW5pbWF0aW9uQ2xpcFwiLFxuICAgICAgICAgICAgICAgIFwiX25hbWVcIjogXCJcIixcbiAgICAgICAgICAgICAgICBcIl9vYmpGbGFnc1wiOiAwLFxuICAgICAgICAgICAgICAgIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgICAgICBcIl9uYXRpdmVcIjogXCJcIixcbiAgICAgICAgICAgICAgICBcInNhbXBsZVwiOiB0eXBlb2YgYXJncy5zYW1wbGUgPT09ICdudW1iZXInID8gYXJncy5zYW1wbGUgOiA2MCxcbiAgICAgICAgICAgICAgICBcInNwZWVkXCI6IDEsXG4gICAgICAgICAgICAgICAgXCJ3cmFwTW9kZVwiOiAxLFxuICAgICAgICAgICAgICAgIFwiZW5hYmxlVFJTXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgIFwiZHVyYXRpb25cIjogdHlwZW9mIGFyZ3MuZHVyYXRpb24gPT09ICdudW1iZXInID8gYXJncy5kdXJhdGlvbiA6IDEsXG4gICAgICAgICAgICAgICAgXCJrZXlzXCI6IFtdLFxuICAgICAgICAgICAgICAgIFwiY3VydmVzXCI6IFtdLFxuICAgICAgICAgICAgICAgIFwiZXZlbnRzXCI6IFtdXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBhcmdzLnVybCwgSlNPTi5zdHJpbmdpZnkoY2xpcERhdGEsIG51bGwsIDIpKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgIHsgdXJsOiBhcmdzLnVybCwgdXVpZDogKHJlc3VsdCBhcyBhbnkpPy51dWlkLCBzYW1wbGU6IGNsaXBEYXRhLnNhbXBsZSwgZHVyYXRpb246IGNsaXBEYXRhLmR1cmF0aW9uIH0sXG4gICAgICAgICAgICAgICAgYEFuaW1hdGlvbiBjbGlwIGNyZWF0ZWQgYXQgJHthcmdzLnVybH1gXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q2xpcEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy51cmwpO1xuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG1ldGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgYXJncy51cmwpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gbWV0YSBtYXkgbm90IGJlIGF2YWlsYWJsZSBmb3IgYWxsIGFzc2V0c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBpbmZvLCBtZXRhIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbGlzdENsaXBzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGFyZ3MucGF0dGVybiB8fCAnZGI6Ly9hc3NldHMvKiovKi5hbmltJztcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY2xpcHM6IGFzc2V0cywgY291bnQ6IChhc3NldHMgYXMgYW55W10pLmxlbmd0aCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldEtleWZyYW1lKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIHNldF9rZXlmcmFtZScpO1xuICAgICAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkIGZvciBzZXRfa2V5ZnJhbWUnKTtcbiAgICAgICAgICAgIGlmIChhcmdzLmZyYW1lID09PSB1bmRlZmluZWQgfHwgYXJncy5mcmFtZSA9PT0gbnVsbCkgcmV0dXJuIGVycm9yUmVzdWx0KCdmcmFtZSBpcyByZXF1aXJlZCBmb3Igc2V0X2tleWZyYW1lJyk7XG4gICAgICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfa2V5ZnJhbWUnKTtcblxuICAgICAgICAgICAgY29uc3QgZmlsZVBhdGg6IHN0cmluZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXBhdGgnLCBhcmdzLnVybCkgYXMgc3RyaW5nO1xuICAgICAgICAgICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KGBDb3VsZCBub3QgcmVzb2x2ZSBwYXRoIGZvciAke2FyZ3MudXJsfWApO1xuXG4gICAgICAgICAgICBsZXQgY2xpcERhdGE6IGFueTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICAgICAgICBjbGlwRGF0YSA9IEpTT04ucGFyc2UocmF3KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZWFkIGNsaXAgZmlsZTogJHtwYXJzZUVyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoY2xpcERhdGEuY3VydmVzKSkgY2xpcERhdGEuY3VydmVzID0gW107XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGVQYXRoID0gYXJncy5wYXRoIHx8ICcnO1xuICAgICAgICAgICAgY29uc3Qgc2FtcGxlOiBudW1iZXIgPSBjbGlwRGF0YS5zYW1wbGUgfHwgNjA7XG4gICAgICAgICAgICBjb25zdCB0aW1lOiBudW1iZXIgPSBhcmdzLmZyYW1lIC8gc2FtcGxlO1xuXG4gICAgICAgICAgICAvLyBGaW5kIG9yIGNyZWF0ZSB0aGUgY3VydmUgZm9yIHRoaXMgbm9kZSBwYXRoICsgcHJvcGVydHlcbiAgICAgICAgICAgIGxldCBjdXJ2ZSA9IGNsaXBEYXRhLmN1cnZlcy5maW5kKFxuICAgICAgICAgICAgICAgIChjOiBhbnkpID0+IGMubW9kaWZpZXJzICYmIGMubW9kaWZpZXJzWzBdID09PSBub2RlUGF0aCAmJiBjLm1vZGlmaWVyc1sxXSA9PT0gYXJncy5wcm9wZXJ0eVxuICAgICAgICAgICAgKTtcblxuICAgICAgICAgICAgaWYgKCFjdXJ2ZSkge1xuICAgICAgICAgICAgICAgIGN1cnZlID0ge1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllcnM6IFtub2RlUGF0aCwgYXJncy5wcm9wZXJ0eV0sXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsga2V5czogMCwgdmFsdWVzOiBbXSB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBjbGlwRGF0YS5jdXJ2ZXMucHVzaChjdXJ2ZSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjbGlwRGF0YS5rZXlzKSB8fCBjbGlwRGF0YS5rZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNsaXBEYXRhLmtleXMgPSBbW11dO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBrZXlJbmRleCA9IGNsaXBEYXRhLmtleXNbMF0ubGVuZ3RoO1xuICAgICAgICAgICAgY2xpcERhdGEua2V5c1swXS5wdXNoKHRpbWUpO1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGN1cnZlLmRhdGEudmFsdWVzKSkgY3VydmUuZGF0YS52YWx1ZXMgPSBbXTtcbiAgICAgICAgICAgIGN1cnZlLmRhdGEudmFsdWVzLnB1c2goYXJncy52YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSBkdXJhdGlvbiBpZiB0aGlzIGtleWZyYW1lIGV4dGVuZHMgaXRcbiAgICAgICAgICAgIGlmICh0aW1lID4gKGNsaXBEYXRhLmR1cmF0aW9uIHx8IDApKSB7XG4gICAgICAgICAgICAgICAgY2xpcERhdGEuZHVyYXRpb24gPSB0aW1lO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgYXJncy51cmwsIEpTT04uc3RyaW5naWZ5KGNsaXBEYXRhLCBudWxsLCAyKSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICB7IHVybDogYXJncy51cmwsIG5vZGVQYXRoLCBwcm9wZXJ0eTogYXJncy5wcm9wZXJ0eSwgZnJhbWU6IGFyZ3MuZnJhbWUsIHRpbWUsIHZhbHVlOiBhcmdzLnZhbHVlIH0sXG4gICAgICAgICAgICAgICAgYEtleWZyYW1lIHNldCBhdCBmcmFtZSAke2FyZ3MuZnJhbWV9ICh0PSR7dGltZX1zKSBmb3IgJyR7YXJncy5wcm9wZXJ0eX0nIG9uIHBhdGggJyR7bm9kZVBhdGh9J2BcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19