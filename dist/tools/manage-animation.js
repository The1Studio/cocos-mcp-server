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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWFuaW1hdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtYW5pbWF0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsdUNBQXlCO0FBRXpCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUNyQyxVQUFVLEVBQUUsa0JBQWtCO0lBQzlCLE9BQU8sRUFBRSxFQUFFO0lBQ1gsV0FBVyxFQUFFLENBQUM7SUFDZCxrQkFBa0IsRUFBRSxFQUFFO0lBQ3RCLFNBQVMsRUFBRSxFQUFFO0lBQ2IsUUFBUSxFQUFFLEVBQUU7SUFDWixPQUFPLEVBQUUsQ0FBQztJQUNWLFVBQVUsRUFBRSxDQUFDO0lBQ2IsV0FBVyxFQUFFLEtBQUs7SUFDbEIsVUFBVSxFQUFFLENBQUM7SUFDYixNQUFNLEVBQUUsRUFBRTtJQUNWLFFBQVEsRUFBRSxFQUFFO0lBQ1osUUFBUSxFQUFFLEVBQUU7Q0FDZixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVaLE1BQWEsZUFBZ0IsU0FBUSxpQ0FBYztJQUFuRDs7UUFDYSxTQUFJLEdBQUcsa0JBQWtCLENBQUM7UUFDMUIsZ0JBQVcsR0FBRyxrT0FBa08sQ0FBQztRQUNqUCxZQUFPLEdBQUcsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxjQUFjLENBQUMsQ0FBQztRQUM5RCxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxjQUFjLENBQUM7b0JBQ3pELFdBQVcsRUFBRSxnTEFBZ0w7aUJBQ2hNO2dCQUNELEdB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QUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUNoRyx5QkFBeUIsSUFBSSxDQUFDLEtBQUssT0FBTyxJQUFJLFdBQVcsSUFBSSxDQUFDLFFBQVEsY0FBYyxRQUFRLEdBQUcsQ0FDbEcsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBN0tELDBDQTZLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuXHJcbmNvbnN0IERFRkFVTFRfQU5JTV9DTElQID0gSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgXCJfX3R5cGVfX1wiOiBcImNjLkFuaW1hdGlvbkNsaXBcIixcclxuICAgIFwiX25hbWVcIjogXCJcIixcclxuICAgIFwiX29iakZsYWdzXCI6IDAsXHJcbiAgICBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXHJcbiAgICBcIl9uYXRpdmVcIjogXCJcIixcclxuICAgIFwic2FtcGxlXCI6IDYwLFxyXG4gICAgXCJzcGVlZFwiOiAxLFxyXG4gICAgXCJ3cmFwTW9kZVwiOiAxLFxyXG4gICAgXCJlbmFibGVUUlNcIjogZmFsc2UsXHJcbiAgICBcImR1cmF0aW9uXCI6IDAsXHJcbiAgICBcImtleXNcIjogW10sXHJcbiAgICBcImN1cnZlc1wiOiBbXSxcclxuICAgIFwiZXZlbnRzXCI6IFtdXHJcbn0sIG51bGwsIDIpO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZUFuaW1hdGlvbiBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2FuaW1hdGlvbic7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgYW5pbWF0aW9uIGNsaXBzLiBBY3Rpb25zOiBjcmVhdGVfY2xpcCwgZ2V0X2luZm8sIGxpc3QsIHNldF9rZXlmcmFtZS4gQ3JlYXRlIGFuaW1hdGlvbiBjbGlwcyBhbmQgc2V0IGtleWZyYW1lcyBmb3Igbm9kZSBwcm9wZXJ0aWVzLiBBbmltYXRpb24gY2xpcHMgYXJlIGFzc2V0cyAoLmFuaW0gZmlsZXMpIHRoYXQgY2FuIGJlIGFzc2lnbmVkIHRvIEFuaW1hdGlvbiBjb21wb25lbnRzLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjcmVhdGVfY2xpcCcsICdnZXRfaW5mbycsICdsaXN0JywgJ3NldF9rZXlmcmFtZSddO1xyXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XHJcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydjcmVhdGVfY2xpcCcsICdnZXRfaW5mbycsICdsaXN0JywgJ3NldF9rZXlmcmFtZSddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlX2NsaXA9Y3JlYXRlIG5ldyAuYW5pbSBjbGlwIGFzc2V0LCBnZXRfaW5mbz1xdWVyeSBhc3NldCBpbmZvIGFuZCBtZXRhLCBsaXN0PWxpc3QgYWxsIC5hbmltIGFzc2V0cywgc2V0X2tleWZyYW1lPWFkZC91cGRhdGUgYSBrZXlmcmFtZSBpbiBhIGNsaXAgdHJhY2snXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHVybDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfY2xpcCwgZ2V0X2luZm8sIHNldF9rZXlmcmFtZV0gQXNzZXQgREIgVVJMIChlLmcuLCBkYjovL2Fzc2V0cy9hbmltYXRpb25zL1dhbGsuYW5pbSknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNhbXBsZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfY2xpcF0gU2FtcGxlIHJhdGUgaW4gZnJhbWVzIHBlciBzZWNvbmQgKGRlZmF1bHQ6IDYwKScsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiA2MFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBkdXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfY2xpcF0gQ2xpcCBkdXJhdGlvbiBpbiBzZWNvbmRzIChkZWZhdWx0OiAxKScsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAxXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHBhdGg6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2tleWZyYW1lXSBOb2RlIHBhdGggd2l0aGluIHRoZSBjbGlwIChlLmcuLCBcIlwiIGZvciByb290LCBcIkFybVwiIGZvciBjaGlsZCBuYW1lZCBBcm0pJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfa2V5ZnJhbWVdIFByb3BlcnR5IHRvIGFuaW1hdGUgKGUuZy4sIFwicG9zaXRpb24ueFwiLCBcInJvdGF0aW9uXCIsIFwic2NhbGVcIiknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGZyYW1lOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9rZXlmcmFtZV0gRnJhbWUgaW5kZXggYXQgd2hpY2ggdG8gc2V0IHRoZSBrZXlmcmFtZSB2YWx1ZSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9rZXlmcmFtZV0gS2V5ZnJhbWUgdmFsdWUgdG8gc2V0J1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwYXR0ZXJuOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiB0byBmaWx0ZXIgY2xpcHMgKGRlZmF1bHQ6IGRiOi8vYXNzZXRzLyoqLyouYW5pbSknLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2RiOi8vYXNzZXRzLyoqLyouYW5pbSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcblxyXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XHJcbiAgICAgICAgY3JlYXRlX2NsaXA6IChhcmdzKSA9PiB0aGlzLmNyZWF0ZUNsaXAoYXJncyksXHJcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldENsaXBJbmZvKGFyZ3MpLFxyXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmxpc3RDbGlwcyhhcmdzKSxcclxuICAgICAgICBzZXRfa2V5ZnJhbWU6IChhcmdzKSA9PiB0aGlzLnNldEtleWZyYW1lKGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZUNsaXAoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIGNyZWF0ZV9jbGlwJyk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBjbGlwRGF0YSA9IHtcclxuICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5BbmltYXRpb25DbGlwXCIsXHJcbiAgICAgICAgICAgICAgICBcIl9uYW1lXCI6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICBcIl9vYmpGbGFnc1wiOiAwLFxyXG4gICAgICAgICAgICAgICAgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxyXG4gICAgICAgICAgICAgICAgXCJfbmF0aXZlXCI6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICBcInNhbXBsZVwiOiB0eXBlb2YgYXJncy5zYW1wbGUgPT09ICdudW1iZXInID8gYXJncy5zYW1wbGUgOiA2MCxcclxuICAgICAgICAgICAgICAgIFwic3BlZWRcIjogMSxcclxuICAgICAgICAgICAgICAgIFwid3JhcE1vZGVcIjogMSxcclxuICAgICAgICAgICAgICAgIFwiZW5hYmxlVFJTXCI6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgXCJkdXJhdGlvblwiOiB0eXBlb2YgYXJncy5kdXJhdGlvbiA9PT0gJ251bWJlcicgPyBhcmdzLmR1cmF0aW9uIDogMSxcclxuICAgICAgICAgICAgICAgIFwia2V5c1wiOiBbXSxcclxuICAgICAgICAgICAgICAgIFwiY3VydmVzXCI6IFtdLFxyXG4gICAgICAgICAgICAgICAgXCJldmVudHNcIjogW11cclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFyZ3MudXJsLCBKU09OLnN0cmluZ2lmeShjbGlwRGF0YSwgbnVsbCwgMikpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcclxuICAgICAgICAgICAgICAgIHsgdXJsOiBhcmdzLnVybCwgdXVpZDogKHJlc3VsdCBhcyBhbnkpPy51dWlkLCBzYW1wbGU6IGNsaXBEYXRhLnNhbXBsZSwgZHVyYXRpb246IGNsaXBEYXRhLmR1cmF0aW9uIH0sXHJcbiAgICAgICAgICAgICAgICBgQW5pbWF0aW9uIGNsaXAgY3JlYXRlZCBhdCAke2FyZ3MudXJsfWBcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldENsaXBJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBtZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtbWV0YScsIGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgICAgICAvLyBtZXRhIG1heSBub3QgYmUgYXZhaWxhYmxlIGZvciBhbGwgYXNzZXRzXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBpbmZvLCBtZXRhIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgbGlzdENsaXBzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBhcmdzLnBhdHRlcm4gfHwgJ2RiOi8vYXNzZXRzLyoqLyouYW5pbSc7XHJcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjbGlwczogYXNzZXRzLCBjb3VudDogKGFzc2V0cyBhcyBhbnlbXSkubGVuZ3RoIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0S2V5ZnJhbWUoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIHNldF9rZXlmcmFtZScpO1xyXG4gICAgICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQgZm9yIHNldF9rZXlmcmFtZScpO1xyXG4gICAgICAgICAgICBpZiAoYXJncy5mcmFtZSA9PT0gdW5kZWZpbmVkIHx8IGFyZ3MuZnJhbWUgPT09IG51bGwpIHJldHVybiBlcnJvclJlc3VsdCgnZnJhbWUgaXMgcmVxdWlyZWQgZm9yIHNldF9rZXlmcmFtZScpO1xyXG4gICAgICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfa2V5ZnJhbWUnKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1wYXRoJywgYXJncy51cmwpIGFzIHN0cmluZztcclxuICAgICAgICAgICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KGBDb3VsZCBub3QgcmVzb2x2ZSBwYXRoIGZvciAke2FyZ3MudXJsfWApO1xyXG5cclxuICAgICAgICAgICAgbGV0IGNsaXBEYXRhOiBhbnk7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByYXcgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGYtOCcpO1xyXG4gICAgICAgICAgICAgICAgY2xpcERhdGEgPSBKU09OLnBhcnNlKHJhdyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHJlYWQgY2xpcCBmaWxlOiAke3BhcnNlRXJyLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjbGlwRGF0YS5jdXJ2ZXMpKSBjbGlwRGF0YS5jdXJ2ZXMgPSBbXTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG5vZGVQYXRoID0gYXJncy5wYXRoIHx8ICcnO1xyXG4gICAgICAgICAgICBjb25zdCBzYW1wbGU6IG51bWJlciA9IGNsaXBEYXRhLnNhbXBsZSB8fCA2MDtcclxuICAgICAgICAgICAgY29uc3QgdGltZTogbnVtYmVyID0gYXJncy5mcmFtZSAvIHNhbXBsZTtcclxuXHJcbiAgICAgICAgICAgIC8vIEZpbmQgb3IgY3JlYXRlIHRoZSBjdXJ2ZSBmb3IgdGhpcyBub2RlIHBhdGggKyBwcm9wZXJ0eVxyXG4gICAgICAgICAgICBsZXQgY3VydmUgPSBjbGlwRGF0YS5jdXJ2ZXMuZmluZChcclxuICAgICAgICAgICAgICAgIChjOiBhbnkpID0+IGMubW9kaWZpZXJzICYmIGMubW9kaWZpZXJzWzBdID09PSBub2RlUGF0aCAmJiBjLm1vZGlmaWVyc1sxXSA9PT0gYXJncy5wcm9wZXJ0eVxyXG4gICAgICAgICAgICApO1xyXG5cclxuICAgICAgICAgICAgaWYgKCFjdXJ2ZSkge1xyXG4gICAgICAgICAgICAgICAgY3VydmUgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW9kaWZpZXJzOiBbbm9kZVBhdGgsIGFyZ3MucHJvcGVydHldLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsga2V5czogMCwgdmFsdWVzOiBbXSB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgY2xpcERhdGEuY3VydmVzLnB1c2goY3VydmUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoY2xpcERhdGEua2V5cykgfHwgY2xpcERhdGEua2V5cy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIGNsaXBEYXRhLmtleXMgPSBbW11dO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBrZXlJbmRleCA9IGNsaXBEYXRhLmtleXNbMF0ubGVuZ3RoO1xyXG4gICAgICAgICAgICBjbGlwRGF0YS5rZXlzWzBdLnB1c2godGltZSk7XHJcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjdXJ2ZS5kYXRhLnZhbHVlcykpIGN1cnZlLmRhdGEudmFsdWVzID0gW107XHJcbiAgICAgICAgICAgIGN1cnZlLmRhdGEudmFsdWVzLnB1c2goYXJncy52YWx1ZSk7XHJcblxyXG4gICAgICAgICAgICAvLyBVcGRhdGUgZHVyYXRpb24gaWYgdGhpcyBrZXlmcmFtZSBleHRlbmRzIGl0XHJcbiAgICAgICAgICAgIGlmICh0aW1lID4gKGNsaXBEYXRhLmR1cmF0aW9uIHx8IDApKSB7XHJcbiAgICAgICAgICAgICAgICBjbGlwRGF0YS5kdXJhdGlvbiA9IHRpbWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBhcmdzLnVybCwgSlNPTi5zdHJpbmdpZnkoY2xpcERhdGEsIG51bGwsIDIpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXHJcbiAgICAgICAgICAgICAgICB7IHVybDogYXJncy51cmwsIG5vZGVQYXRoLCBwcm9wZXJ0eTogYXJncy5wcm9wZXJ0eSwgZnJhbWU6IGFyZ3MuZnJhbWUsIHRpbWUsIHZhbHVlOiBhcmdzLnZhbHVlIH0sXHJcbiAgICAgICAgICAgICAgICBgS2V5ZnJhbWUgc2V0IGF0IGZyYW1lICR7YXJncy5mcmFtZX0gKHQ9JHt0aW1lfXMpIGZvciAnJHthcmdzLnByb3BlcnR5fScgb24gcGF0aCAnJHtub2RlUGF0aH0nYFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==