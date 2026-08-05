"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageVideo = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageVideo extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_video';
        this.description = 'Manage VideoPlayer components on nodes. Actions: add, set_property, play, get_info, list. Add VideoPlayer components, configure clip/URL/loop/volume, and control playback.';
        this.actions = ['add', 'set_property', 'play', 'get_info', 'list'];
        this.inputSchema = {
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
        this.actionHandlers = {
            add: (args) => this.addVideoPlayer(args),
            set_property: (args) => this.setProperty(args),
            play: (args) => this.controlVideo(args),
            get_info: (args) => this.getInfo(args),
            list: (args) => this.listVideoPlayers(args),
        };
    }
    async addVideoPlayer(args) {
        try {
            if (!args.nodeUuid)
                return (0, types_1.errorResult)('nodeUuid is required for add');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addVideoPlayer',
                args: [args.nodeUuid, args.clipUrl]
            });
            return (0, types_1.successResult)(result, 'VideoPlayer added');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setProperty(args) {
        try {
            if (!args.nodeUuid)
                return (0, types_1.errorResult)('nodeUuid is required for set_property');
            if (!args.property)
                return (0, types_1.errorResult)('property is required for set_property');
            if (args.value === undefined)
                return (0, types_1.errorResult)('value is required for set_property');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setVideoProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            return (0, types_1.successResult)(result, `VideoPlayer.${args.property} updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async controlVideo(args) {
        try {
            if (!args.nodeUuid)
                return (0, types_1.errorResult)('nodeUuid is required for play');
            if (!args.command)
                return (0, types_1.errorResult)('command is required for play (play/pause/stop/resume)');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'controlVideo',
                args: [args.nodeUuid, args.command]
            });
            return (0, types_1.successResult)(result, `VideoPlayer command '${args.command}' sent`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getInfo(args) {
        try {
            if (!args.nodeUuid)
                return (0, types_1.errorResult)('nodeUuid is required for get_info');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getVideoInfo', args: [args.nodeUuid]
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listVideoPlayers(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listVideoPlayers', args: []
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageVideo = ManageVideo;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXZpZGVvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS12aWRlby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRyw2S0FBNkssQ0FBQztRQUM1TCxZQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDOUQsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQztvQkFDekQsV0FBVyxFQUFFLCtKQUErSjtpQkFDL0s7Z0JBQ0QsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsbURBQW1ELEVBQUU7Z0JBQzlGLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG9GQUFvRixFQUFFO2dCQUM5SCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsY0FBYyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxRQUFRLENBQUM7b0JBQzdFLFdBQVcsRUFBRSxtSkFBbUo7aUJBQ25LO2dCQUNELEtBQUssRUFBRSxFQUFFLFdBQVcsRUFBRSx1Q0FBdUMsRUFBRTtnQkFDL0QsT0FBTyxFQUFFO29CQUNMLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxP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Z0JBQWdCLENBQUMsS0FBVTtRQUNyQyxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsRUFBRTthQUNqRSxDQUFDLENBQUM7WUFDSCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBM0ZELGtDQTJGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlVmlkZW8gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XHJcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV92aWRlbyc7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgVmlkZW9QbGF5ZXIgY29tcG9uZW50cyBvbiBub2Rlcy4gQWN0aW9uczogYWRkLCBzZXRfcHJvcGVydHksIHBsYXksIGdldF9pbmZvLCBsaXN0LiBBZGQgVmlkZW9QbGF5ZXIgY29tcG9uZW50cywgY29uZmlndXJlIGNsaXAvVVJML2xvb3Avdm9sdW1lLCBhbmQgY29udHJvbCBwbGF5YmFjay4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnYWRkJywgJ3NldF9wcm9wZXJ0eScsICdwbGF5JywgJ2dldF9pbmZvJywgJ2xpc3QnXTtcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnYWRkJywgJ3NldF9wcm9wZXJ0eScsICdwbGF5JywgJ2dldF9pbmZvJywgJ2xpc3QnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBhZGQ9YWRkIFZpZGVvUGxheWVyIHRvIG5vZGUsIHNldF9wcm9wZXJ0eT1zZXQgVmlkZW9QbGF5ZXIgcHJvcGVydHksIHBsYXk9Y29udHJvbCBwbGF5YmFjaywgZ2V0X2luZm89Z2V0IFZpZGVvUGxheWVyIGluZm8sIGxpc3Q9bGlzdCBWaWRlb1BsYXllciBub2RlcydcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW2FkZC9zZXRfcHJvcGVydHkvcGxheS9nZXRfaW5mb10gVGFyZ2V0IG5vZGUgVVVJRCcgfSxcclxuICAgICAgICAgICAgY2xpcFVybDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbYWRkXSBBc3NldCBEQiBVUkwgb2YgdGhlIHZpZGVvIGNsaXAgdG8gYXNzaWduIChlLmcuLCBkYjovL2Fzc2V0cy92aWRlby9pbnRyby5tcDQpJyB9LFxyXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3Jlc291cmNlVHlwZScsICdyZW1vdGVVUkwnLCAnY2xpcCcsICdsb29wJywgJ3BsYXliYWNrUmF0ZScsICd2b2x1bWUnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgdG8gc2V0OiByZXNvdXJjZVR5cGUoMD1sb2NhbCwxPXJlbW90ZSksIHJlbW90ZVVSTChzdHJpbmcpLCBjbGlwKGFzc2V0IHVybCksIGxvb3AoYm9vbCksIHBsYXliYWNrUmF0ZShudW1iZXIpLCB2b2x1bWUoMC0xKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHsgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBWYWx1ZSBmb3IgdGhlIHByb3BlcnR5JyB9LFxyXG4gICAgICAgICAgICBjb21tYW5kOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsncGxheScsICdwYXVzZScsICdzdG9wJywgJ3Jlc3VtZSddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcGxheV0gUGxheWJhY2sgY29tbWFuZDogcGxheSwgcGF1c2UsIHN0b3AsIG9yIHJlc3VtZSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcblxyXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XHJcbiAgICAgICAgYWRkOiAoYXJncykgPT4gdGhpcy5hZGRWaWRlb1BsYXllcihhcmdzKSxcclxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldFByb3BlcnR5KGFyZ3MpLFxyXG4gICAgICAgIHBsYXk6IChhcmdzKSA9PiB0aGlzLmNvbnRyb2xWaWRlbyhhcmdzKSxcclxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0SW5mbyhhcmdzKSxcclxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0VmlkZW9QbGF5ZXJzKGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGFkZFZpZGVvUGxheWVyKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgYWRkJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdhZGRWaWRlb1BsYXllcicsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5jbGlwVXJsXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCAnVmlkZW9QbGF5ZXIgYWRkZWQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xyXG4gICAgICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xyXG4gICAgICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFZpZGVvUHJvcGVydHknLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWVdXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsIGBWaWRlb1BsYXllci4ke2FyZ3MucHJvcGVydHl9IHVwZGF0ZWRgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjb250cm9sVmlkZW8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBwbGF5Jyk7XHJcbiAgICAgICAgICAgIGlmICghYXJncy5jb21tYW5kKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2NvbW1hbmQgaXMgcmVxdWlyZWQgZm9yIHBsYXkgKHBsYXkvcGF1c2Uvc3RvcC9yZXN1bWUpJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdjb250cm9sVmlkZW8nLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MuY29tbWFuZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgYFZpZGVvUGxheWVyIGNvbW1hbmQgJyR7YXJncy5jb21tYW5kfScgc2VudGApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0VmlkZW9JbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGxpc3RWaWRlb1BsYXllcnMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdsaXN0VmlkZW9QbGF5ZXJzJywgYXJnczogW11cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==