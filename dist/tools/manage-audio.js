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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWF1ZGlvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1hdWRpby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRywrSkFBK0osQ0FBQztRQUM5SyxZQUFPLEdBQUcsQ0FBQyxZQUFZLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDaEcsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sQ0FBQztvQkFDM0YsV0FBVyxFQUFFLDhMQUE4TDtpQkFDOU07Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxrRkFBa0Y7aUJBQ2xHO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsdURBQXVEO2lCQUN2RTtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDO29CQUMvQyxXQUFXLEVBQUUsK0NBQStDO2lCQUMvRDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLDJHQUEyRztpQkFDM0g7YUFDSjtZQUNELFFBQVEsRUFBRSxD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RUFBQyxDQUFDLENBQUMsSUFBQSxxQkFBYSxFQUFFLE1BQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBQSxtQkFBVyxFQUFDLENBQUMsTUFBYyxhQUFkLE1BQU0sdUJBQU4sTUFBTSxDQUFVLEtBQUssS0FBSSxRQUFRLENBQUMsQ0FBQztRQUM1SCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBN0ZELGtDQTZGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlQXVkaW8gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfYXVkaW8nO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBBdWRpb1NvdXJjZSBjb21wb25lbnRzLiBBY3Rpb25zOiBhZGRfc291cmNlLCBzZXRfcHJvcGVydHksIHBsYXksIHN0b3AsIHBhdXNlLCByZXN1bWUsIGdldF9pbmZvLCBsaXN0LiBBZGQgYXVkaW8gc291cmNlcyB0byBub2RlcyBhbmQgY29udHJvbCBwbGF5YmFjay4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2FkZF9zb3VyY2UnLCAnc2V0X3Byb3BlcnR5JywgJ3BsYXknLCAnc3RvcCcsICdwYXVzZScsICdyZXN1bWUnLCAnZ2V0X2luZm8nLCAnbGlzdCddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydhZGRfc291cmNlJywgJ3NldF9wcm9wZXJ0eScsICdwbGF5JywgJ3N0b3AnLCAncGF1c2UnLCAncmVzdW1lJywgJ2dldF9pbmZvJywgJ2xpc3QnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogYWRkX3NvdXJjZT1hZGQgQXVkaW9Tb3VyY2UgdG8gbm9kZSwgc2V0X3Byb3BlcnR5PXNldCBjbGlwL3ZvbHVtZS9sb29wL3BsYXlPbkF3YWtlLCBwbGF5L3N0b3AvcGF1c2UvcmVzdW1lPWNvbnRyb2wgcGxheWJhY2ssIGdldF9pbmZvPWdldCBwcm9wZXJ0aWVzLCBsaXN0PWxpc3QgYWxsIEF1ZGlvU291cmNlIG5vZGVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkX3NvdXJjZSwgc2V0X3Byb3BlcnR5LCBwbGF5LCBzdG9wLCBwYXVzZSwgcmVzdW1lLCBnZXRfaW5mb10gVGFyZ2V0IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjbGlwVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF9zb3VyY2VdIE9wdGlvbmFsIGF1ZGlvIGNsaXAgYXNzZXQgVVVJRCB0byBhc3NpZ24nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NsaXAnLCAndm9sdW1lJywgJ2xvb3AnLCAncGxheU9uQXdha2UnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFByb3BlcnR5IHRvIHNldCBvbiBBdWRpb1NvdXJjZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgdmFsdWUgKHV1aWQgc3RyaW5nIGZvciBjbGlwLCBudW1iZXIgMC0xIGZvciB2b2x1bWUsIGJvb2xlYW4gZm9yIGxvb3AvcGxheU9uQXdha2UpJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgYWRkX3NvdXJjZTogKGFyZ3MpID0+IHRoaXMuYWRkU291cmNlKGFyZ3MpLFxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldFByb3BlcnR5KGFyZ3MpLFxuICAgICAgICBwbGF5OiAoYXJncykgPT4gdGhpcy5jb250cm9sQXVkaW8oYXJncywgJ3BsYXknKSxcbiAgICAgICAgc3RvcDogKGFyZ3MpID0+IHRoaXMuY29udHJvbEF1ZGlvKGFyZ3MsICdzdG9wJyksXG4gICAgICAgIHBhdXNlOiAoYXJncykgPT4gdGhpcy5jb250cm9sQXVkaW8oYXJncywgJ3BhdXNlJyksXG4gICAgICAgIHJlc3VtZTogKGFyZ3MpID0+IHRoaXMuY29udHJvbEF1ZGlvKGFyZ3MsICdyZXN1bWUnKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldEluZm8oYXJncyksXG4gICAgICAgIGxpc3Q6IChfYXJncykgPT4gdGhpcy5saXN0QXVkaW9Tb3VyY2VzKCksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgYWRkU291cmNlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGFkZF9zb3VyY2UnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnYWRkQXVkaW9Tb3VyY2UnLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5jbGlwVXVpZCB8fCBudWxsXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSwgJ0F1ZGlvU291cmNlIGFkZGVkJykgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gYWRkIEF1ZGlvU291cmNlJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmIChhcmdzLnZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0QXVkaW9Qcm9wZXJ0eScsIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdChudWxsLCBgQXVkaW9Tb3VyY2UuJHthcmdzLnByb3BlcnR5fSB1cGRhdGVkYCkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY29udHJvbEF1ZGlvKGFyZ3M6IGFueSwgY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdjb250cm9sQXVkaW8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgY29tbWFuZF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KT8uc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQobnVsbCwgYEF1ZGlvICR7Y29tbWFuZH0gZXhlY3V0ZWRgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0QXVkaW9JbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0QXVkaW9Tb3VyY2VzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdsaXN0QXVkaW9Tb3VyY2VzJywgYXJnczogW11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KT8uc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG59XG4iXX0=