"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageAudio = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageAudio extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_audio';
        this.description = 'Manage AudioSource components. Actions: add_source, set_property, play, stop, pause, resume, get_info, list. Add audio sources to nodes and control playback.';
        this.actions = ['add_source', 'set_property', 'play', 'stop', 'pause', 'resume', 'get_info', 'list'];
        this.inputSchema = {
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
        this.actionHandlers = {
            add_source: (args) => this.addSource(args),
            set_property: (args) => this.setProperty(args),
            play: (args) => this.controlAudio(args, 'play'),
            stop: (args) => this.controlAudio(args, 'stop'),
            pause: (args) => this.controlAudio(args, 'pause'),
            resume: (args) => this.controlAudio(args, 'resume'),
            get_info: (args) => this.getInfo(args),
            list: (_args) => this.listAudioSources(),
        };
    }
    async addSource(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for add_source');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addAudioSource', args: [args.nodeUuid, args.clipUuid || null]
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(result.data, 'AudioSource added') : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to add AudioSource');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.property)
            return (0, types_1.errorResult)('property is required');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setAudioProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(null, `AudioSource.${args.property} updated`) : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async controlAudio(args, command) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'controlAudio', args: [args.nodeUuid, command]
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(null, `Audio ${command} executed`) : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getAudioInfo', args: [args.nodeUuid]
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listAudioSources() {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listAudioSources', args: []
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageAudio = ManageAudio;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWF1ZGlvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hdWRpby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRywrSkFBK0osQ0FBQztRQUM5SyxZQUFPLEdBQUcsQ0FBQyxZQUFZLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDaEcsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQztvQkFDM0YsV0FBVyxFQUFFLDhMQUE4TDtpQkFDOU07Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxrRkFBa0Y7aUJBQ2xHO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsdURBQXVEO2lCQUN2RTtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDO29CQUMvQyxXQUFXLEVBQUUsK0NBQStDO2lCQUMvRDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLDJHQUEyRztpQkFDM0g7YUFDSjtZQUNELFFBQVEsRUFBRSxD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RUFBQyxDQUFDLENBQUMsSUFBQSxxQkFBYSxFQUFFLE1BQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBQSxtQkFBVyxFQUFDLENBQUMsTUFBYyxhQUFkLE1BQU0sdUJBQU4sTUFBTSxDQUFVLEtBQUssS0FBSSxRQUFRLENBQUMsQ0FBQztRQUM1SCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBN0ZELGtDQTZGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlQXVkaW8gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XHJcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9hdWRpbyc7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgQXVkaW9Tb3VyY2UgY29tcG9uZW50cy4gQWN0aW9uczogYWRkX3NvdXJjZSwgc2V0X3Byb3BlcnR5LCBwbGF5LCBzdG9wLCBwYXVzZSwgcmVzdW1lLCBnZXRfaW5mbywgbGlzdC4gQWRkIGF1ZGlvIHNvdXJjZXMgdG8gbm9kZXMgYW5kIGNvbnRyb2wgcGxheWJhY2suJztcclxuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2FkZF9zb3VyY2UnLCAnc2V0X3Byb3BlcnR5JywgJ3BsYXknLCAnc3RvcCcsICdwYXVzZScsICdyZXN1bWUnLCAnZ2V0X2luZm8nLCAnbGlzdCddO1xyXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XHJcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydhZGRfc291cmNlJywgJ3NldF9wcm9wZXJ0eScsICdwbGF5JywgJ3N0b3AnLCAncGF1c2UnLCAncmVzdW1lJywgJ2dldF9pbmZvJywgJ2xpc3QnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBhZGRfc291cmNlPWFkZCBBdWRpb1NvdXJjZSB0byBub2RlLCBzZXRfcHJvcGVydHk9c2V0IGNsaXAvdm9sdW1lL2xvb3AvcGxheU9uQXdha2UsIHBsYXkvc3RvcC9wYXVzZS9yZXN1bWU9Y29udHJvbCBwbGF5YmFjaywgZ2V0X2luZm89Z2V0IHByb3BlcnRpZXMsIGxpc3Q9bGlzdCBhbGwgQXVkaW9Tb3VyY2Ugbm9kZXMnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF9zb3VyY2UsIHNldF9wcm9wZXJ0eSwgcGxheSwgc3RvcCwgcGF1c2UsIHJlc3VtZSwgZ2V0X2luZm9dIFRhcmdldCBub2RlIFVVSUQnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNsaXBVdWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF9zb3VyY2VdIE9wdGlvbmFsIGF1ZGlvIGNsaXAgYXNzZXQgVVVJRCB0byBhc3NpZ24nXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnY2xpcCcsICd2b2x1bWUnLCAnbG9vcCcsICdwbGF5T25Bd2FrZSddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSB0byBzZXQgb24gQXVkaW9Tb3VyY2UnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IHZhbHVlICh1dWlkIHN0cmluZyBmb3IgY2xpcCwgbnVtYmVyIDAtMSBmb3Igdm9sdW1lLCBib29sZWFuIGZvciBsb29wL3BsYXlPbkF3YWtlKSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcblxyXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XHJcbiAgICAgICAgYWRkX3NvdXJjZTogKGFyZ3MpID0+IHRoaXMuYWRkU291cmNlKGFyZ3MpLFxyXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0UHJvcGVydHkoYXJncyksXHJcbiAgICAgICAgcGxheTogKGFyZ3MpID0+IHRoaXMuY29udHJvbEF1ZGlvKGFyZ3MsICdwbGF5JyksXHJcbiAgICAgICAgc3RvcDogKGFyZ3MpID0+IHRoaXMuY29udHJvbEF1ZGlvKGFyZ3MsICdzdG9wJyksXHJcbiAgICAgICAgcGF1c2U6IChhcmdzKSA9PiB0aGlzLmNvbnRyb2xBdWRpbyhhcmdzLCAncGF1c2UnKSxcclxuICAgICAgICByZXN1bWU6IChhcmdzKSA9PiB0aGlzLmNvbnRyb2xBdWRpbyhhcmdzLCAncmVzdW1lJyksXHJcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldEluZm8oYXJncyksXHJcbiAgICAgICAgbGlzdDogKF9hcmdzKSA9PiB0aGlzLmxpc3RBdWRpb1NvdXJjZXMoKSxcclxuICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRTb3VyY2UoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBhZGRfc291cmNlJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2FkZEF1ZGlvU291cmNlJywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MuY2xpcFV1aWQgfHwgbnVsbF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCAnQXVkaW9Tb3VyY2UgYWRkZWQnKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBhZGQgQXVkaW9Tb3VyY2UnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldEF1ZGlvUHJvcGVydHknLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5wcm9wZXJ0eSwgYXJncy52YWx1ZV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KG51bGwsIGBBdWRpb1NvdXJjZS4ke2FyZ3MucHJvcGVydHl9IHVwZGF0ZWRgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNvbnRyb2xBdWRpbyhhcmdzOiBhbnksIGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdjb250cm9sQXVkaW8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgY29tbWFuZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KG51bGwsIGBBdWRpbyAke2NvbW1hbmR9IGV4ZWN1dGVkYCkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRBdWRpb0luZm8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGxpc3RBdWRpb1NvdXJjZXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2xpc3RBdWRpb1NvdXJjZXMnLCBhcmdzOiBbXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KT8uc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==