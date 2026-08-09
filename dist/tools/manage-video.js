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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXZpZGVvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS12aWRlby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRyw2S0FBNkssQ0FBQztRQUM1TCxZQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDOUQsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQztvQkFDekQsV0FBVyxFQUFFLCtKQUErSjtpQkFDL0s7Z0JBQ0QsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsbURBQW1ELEVBQUU7Z0JBQzlGLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG9GQUFvRixFQUFFO2dCQUM5SCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsY0FBYyxFQUFFLFdBQVcsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLGNBQWMsRUFBRSxRQUFRLENBQUM7b0JBQzdFLFdBQVcsRUFBRSxtSkFBbUo7aUJBQ25LO2dCQUNELEtBQUssRUFBRSxFQUFFLFdBQVcsRUFBRSx1Q0FBdUMsRUFBRTtnQkFDL0QsT0FBTyxFQUFFO29CQUNMLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxP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Z0JBQWdCLENBQUMsS0FBVTtRQUNyQyxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsRUFBRTthQUNqRSxDQUFDLENBQUM7WUFDSCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBM0ZELGtDQTJGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlVmlkZW8gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfdmlkZW8nO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBWaWRlb1BsYXllciBjb21wb25lbnRzIG9uIG5vZGVzLiBBY3Rpb25zOiBhZGQsIHNldF9wcm9wZXJ0eSwgcGxheSwgZ2V0X2luZm8sIGxpc3QuIEFkZCBWaWRlb1BsYXllciBjb21wb25lbnRzLCBjb25maWd1cmUgY2xpcC9VUkwvbG9vcC92b2x1bWUsIGFuZCBjb250cm9sIHBsYXliYWNrLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnYWRkJywgJ3NldF9wcm9wZXJ0eScsICdwbGF5JywgJ2dldF9pbmZvJywgJ2xpc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYWRkJywgJ3NldF9wcm9wZXJ0eScsICdwbGF5JywgJ2dldF9pbmZvJywgJ2xpc3QnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogYWRkPWFkZCBWaWRlb1BsYXllciB0byBub2RlLCBzZXRfcHJvcGVydHk9c2V0IFZpZGVvUGxheWVyIHByb3BlcnR5LCBwbGF5PWNvbnRyb2wgcGxheWJhY2ssIGdldF9pbmZvPWdldCBWaWRlb1BsYXllciBpbmZvLCBsaXN0PWxpc3QgVmlkZW9QbGF5ZXIgbm9kZXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW2FkZC9zZXRfcHJvcGVydHkvcGxheS9nZXRfaW5mb10gVGFyZ2V0IG5vZGUgVVVJRCcgfSxcbiAgICAgICAgICAgIGNsaXBVcmw6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW2FkZF0gQXNzZXQgREIgVVJMIG9mIHRoZSB2aWRlbyBjbGlwIHRvIGFzc2lnbiAoZS5nLiwgZGI6Ly9hc3NldHMvdmlkZW8vaW50cm8ubXA0KScgfSxcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydyZXNvdXJjZVR5cGUnLCAncmVtb3RlVVJMJywgJ2NsaXAnLCAnbG9vcCcsICdwbGF5YmFja1JhdGUnLCAndm9sdW1lJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB0byBzZXQ6IHJlc291cmNlVHlwZSgwPWxvY2FsLDE9cmVtb3RlKSwgcmVtb3RlVVJMKHN0cmluZyksIGNsaXAoYXNzZXQgdXJsKSwgbG9vcChib29sKSwgcGxheWJhY2tSYXRlKG51bWJlciksIHZvbHVtZSgwLTEpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gVmFsdWUgZm9yIHRoZSBwcm9wZXJ0eScgfSxcbiAgICAgICAgICAgIGNvbW1hbmQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3BsYXknLCAncGF1c2UnLCAnc3RvcCcsICdyZXN1bWUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1twbGF5XSBQbGF5YmFjayBjb21tYW5kOiBwbGF5LCBwYXVzZSwgc3RvcCwgb3IgcmVzdW1lJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgYWRkOiAoYXJncykgPT4gdGhpcy5hZGRWaWRlb1BsYXllcihhcmdzKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgcGxheTogKGFyZ3MpID0+IHRoaXMuY29udHJvbFZpZGVvKGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0SW5mbyhhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdFZpZGVvUGxheWVycyhhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRWaWRlb1BsYXllcihhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgYWRkJyk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2FkZFZpZGVvUGxheWVyJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5jbGlwVXJsXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsICdWaWRlb1BsYXllciBhZGRlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xuICAgICAgICAgICAgaWYgKGFyZ3MudmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFZpZGVvUHJvcGVydHknLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsIGBWaWRlb1BsYXllci4ke2FyZ3MucHJvcGVydHl9IHVwZGF0ZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY29udHJvbFZpZGVvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBwbGF5Jyk7XG4gICAgICAgICAgICBpZiAoIWFyZ3MuY29tbWFuZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdjb21tYW5kIGlzIHJlcXVpcmVkIGZvciBwbGF5IChwbGF5L3BhdXNlL3N0b3AvcmVzdW1lKScpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdjb250cm9sVmlkZW8nLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLmNvbW1hbmRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgYFZpZGVvUGxheWVyIGNvbW1hbmQgJyR7YXJncy5jb21tYW5kfScgc2VudGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRWaWRlb0luZm8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbGlzdFZpZGVvUGxheWVycyhfYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2xpc3RWaWRlb1BsYXllcnMnLCBhcmdzOiBbXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxufVxuIl19