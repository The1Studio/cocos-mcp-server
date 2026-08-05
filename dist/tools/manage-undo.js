"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageUndo = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageUndo extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_undo';
        this.description = 'Undo/redo recording and execution. Actions: begin_recording, end_recording, cancel_recording, undo, redo. Call begin_recording before multi-step modifications, end_recording after, to group them as one undo entry.';
        this.actions = [
            'begin_recording',
            'end_recording',
            'cancel_recording',
            'undo',
            'redo',
        ];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: this.actions,
                    description: 'Operation to perform'
                },
                nodeUuid: { type: 'string', description: 'Node UUID to record (begin_recording)' },
                undoId: { type: 'string', description: 'Undo recording ID from begin_recording (end_recording, cancel_recording)' }
            },
            required: ['action']
        };
        this.actionHandlers = {
            begin_recording: (args) => this.beginRecording(args.nodeUuid),
            end_recording: (args) => this.endRecording(args.undoId),
            cancel_recording: (args) => this.cancelRecording(args.undoId),
            undo: () => this.undo(),
            redo: () => this.redo(),
        };
    }
    async beginRecording(nodeUuid) {
        try {
            const undoId = await Editor.Message.request('scene', 'begin-recording', nodeUuid);
            return (0, types_1.successResult)({ undoId }, 'Undo recording started');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async endRecording(undoId) {
        try {
            await Editor.Message.request('scene', 'end-recording', undoId);
            return (0, types_1.successResult)(null, 'Undo recording ended');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async cancelRecording(undoId) {
        try {
            await Editor.Message.request('scene', 'cancel-recording', undoId);
            return (0, types_1.successResult)(null, 'Undo recording cancelled');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async undo() {
        try {
            await Editor.Message.request('scene', 'undo');
            return (0, types_1.successResult)(null, 'Undo performed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async redo() {
        try {
            await Editor.Message.request('scene', 'redo');
            return (0, types_1.successResult)(null, 'Redo performed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
}
exports.ManageUndo = ManageUndo;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXVuZG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXVuZG8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLFVBQVcsU0FBUSxpQ0FBYztJQUE5Qzs7UUFDYSxTQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3JCLGdCQUFXLEdBQUcsdU5BQXVOLENBQUM7UUFDdE8sWUFBTyxHQUFHO1lBQ2YsaUJBQWlCO1lBQ2pCLGVBQWU7WUFDZixrQkFBa0I7WUFDbEIsTUFBTTtZQUNOLE1BQU07U0FDVCxDQUFDO1FBQ08sZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNsQixXQUFXLEVBQUUsc0JBQXNCO2lCQUN0QztnQkFDRCxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx1Q0FBdUMsRUFBRTtnQkFDbEYsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsMEVBQTBFLEVBQUU7YUFDdEg7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLGVBQWUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQzdELGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3ZELGdCQUFnQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDN0QsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDdkIsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7U0FDMUIsQ0FBQztJQThDTixDQUFDO0lBNUNXLEtBQUssQ0FBQyxjQUFjLENBQUMsUUFBZ0I7UUFDekMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQVcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxDQUFXLENBQUM7WUFDcEcsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQWM7UUFDckMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQy9ELE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLE1BQWM7UUFDeEMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDbEUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLDBCQUEwQixDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxJQUFJO1FBQ2QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDakQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxJQUFJO1FBQ2QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDakQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBNUVELGdDQTRFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlVW5kbyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3VuZG8nO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnVW5kby9yZWRvIHJlY29yZGluZyBhbmQgZXhlY3V0aW9uLiBBY3Rpb25zOiBiZWdpbl9yZWNvcmRpbmcsIGVuZF9yZWNvcmRpbmcsIGNhbmNlbF9yZWNvcmRpbmcsIHVuZG8sIHJlZG8uIENhbGwgYmVnaW5fcmVjb3JkaW5nIGJlZm9yZSBtdWx0aS1zdGVwIG1vZGlmaWNhdGlvbnMsIGVuZF9yZWNvcmRpbmcgYWZ0ZXIsIHRvIGdyb3VwIHRoZW0gYXMgb25lIHVuZG8gZW50cnkuJztcclxuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXHJcbiAgICAgICAgJ2JlZ2luX3JlY29yZGluZycsXHJcbiAgICAgICAgJ2VuZF9yZWNvcmRpbmcnLFxyXG4gICAgICAgICdjYW5jZWxfcmVjb3JkaW5nJyxcclxuICAgICAgICAndW5kbycsXHJcbiAgICAgICAgJ3JlZG8nLFxyXG4gICAgXTtcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnT3BlcmF0aW9uIHRvIHBlcmZvcm0nXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ05vZGUgVVVJRCB0byByZWNvcmQgKGJlZ2luX3JlY29yZGluZyknIH0sXHJcbiAgICAgICAgICAgIHVuZG9JZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdVbmRvIHJlY29yZGluZyBJRCBmcm9tIGJlZ2luX3JlY29yZGluZyAoZW5kX3JlY29yZGluZywgY2FuY2VsX3JlY29yZGluZyknIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGJlZ2luX3JlY29yZGluZzogKGFyZ3MpID0+IHRoaXMuYmVnaW5SZWNvcmRpbmcoYXJncy5ub2RlVXVpZCksXHJcbiAgICAgICAgZW5kX3JlY29yZGluZzogKGFyZ3MpID0+IHRoaXMuZW5kUmVjb3JkaW5nKGFyZ3MudW5kb0lkKSxcclxuICAgICAgICBjYW5jZWxfcmVjb3JkaW5nOiAoYXJncykgPT4gdGhpcy5jYW5jZWxSZWNvcmRpbmcoYXJncy51bmRvSWQpLFxyXG4gICAgICAgIHVuZG86ICgpID0+IHRoaXMudW5kbygpLFxyXG4gICAgICAgIHJlZG86ICgpID0+IHRoaXMucmVkbygpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGJlZ2luUmVjb3JkaW5nKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB1bmRvSWQ6IHN0cmluZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2JlZ2luLXJlY29yZGluZycsIG5vZGVVdWlkKSBhcyBzdHJpbmc7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdW5kb0lkIH0sICdVbmRvIHJlY29yZGluZyBzdGFydGVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBlbmRSZWNvcmRpbmcodW5kb0lkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdlbmQtcmVjb3JkaW5nJywgdW5kb0lkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1VuZG8gcmVjb3JkaW5nIGVuZGVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjYW5jZWxSZWNvcmRpbmcodW5kb0lkOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjYW5jZWwtcmVjb3JkaW5nJywgdW5kb0lkKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1VuZG8gcmVjb3JkaW5nIGNhbmNlbGxlZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgdW5kbygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICd1bmRvJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdVbmRvIHBlcmZvcm1lZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVkbygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZWRvJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdSZWRvIHBlcmZvcm1lZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==