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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXVuZG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXVuZG8udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLFVBQVcsU0FBUSxpQ0FBYztJQUE5Qzs7UUFDYSxTQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3JCLGdCQUFXLEdBQUcsdU5BQXVOLENBQUM7UUFDdE8sWUFBTyxHQUFHO1lBQ2YsaUJBQWlCO1lBQ2pCLGVBQWU7WUFDZixrQkFBa0I7WUFDbEIsTUFBTTtZQUNOLE1BQU07U0FDVCxDQUFDO1FBQ08sZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNsQixXQUFXLEVBQUUsc0JBQXNCO2lCQUN0QztnQkFDRCxRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx1Q0FBdUMsRUFBRTtnQkFDbEYsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsMEVBQTBFLEVBQUU7YUFDdEg7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLGVBQWUsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQzdELGFBQWEsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQ3ZELGdCQUFnQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7WUFDN0QsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDdkIsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUU7U0FDMUIsQ0FBQztJQThDTixDQUFDO0lBNUNXLEtBQUssQ0FBQyxjQUFjLENBQUMsUUFBZ0I7UUFDekMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQVcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxDQUFXLENBQUM7WUFDcEcsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWSxDQUFDLE1BQWM7UUFDckMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQy9ELE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZUFBZSxDQUFDLE1BQWM7UUFDeEMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDbEUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLDBCQUEwQixDQUFDLENBQUM7UUFDM0QsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxJQUFJO1FBQ2QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDakQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxJQUFJO1FBQ2QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDOUMsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDakQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBNUVELGdDQTRFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlVW5kbyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV91bmRvJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdVbmRvL3JlZG8gcmVjb3JkaW5nIGFuZCBleGVjdXRpb24uIEFjdGlvbnM6IGJlZ2luX3JlY29yZGluZywgZW5kX3JlY29yZGluZywgY2FuY2VsX3JlY29yZGluZywgdW5kbywgcmVkby4gQ2FsbCBiZWdpbl9yZWNvcmRpbmcgYmVmb3JlIG11bHRpLXN0ZXAgbW9kaWZpY2F0aW9ucywgZW5kX3JlY29yZGluZyBhZnRlciwgdG8gZ3JvdXAgdGhlbSBhcyBvbmUgdW5kbyBlbnRyeS4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdiZWdpbl9yZWNvcmRpbmcnLFxuICAgICAgICAnZW5kX3JlY29yZGluZycsXG4gICAgICAgICdjYW5jZWxfcmVjb3JkaW5nJyxcbiAgICAgICAgJ3VuZG8nLFxuICAgICAgICAncmVkbycsXG4gICAgXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ09wZXJhdGlvbiB0byBwZXJmb3JtJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ05vZGUgVVVJRCB0byByZWNvcmQgKGJlZ2luX3JlY29yZGluZyknIH0sXG4gICAgICAgICAgICB1bmRvSWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnVW5kbyByZWNvcmRpbmcgSUQgZnJvbSBiZWdpbl9yZWNvcmRpbmcgKGVuZF9yZWNvcmRpbmcsIGNhbmNlbF9yZWNvcmRpbmcpJyB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBiZWdpbl9yZWNvcmRpbmc6IChhcmdzKSA9PiB0aGlzLmJlZ2luUmVjb3JkaW5nKGFyZ3Mubm9kZVV1aWQpLFxuICAgICAgICBlbmRfcmVjb3JkaW5nOiAoYXJncykgPT4gdGhpcy5lbmRSZWNvcmRpbmcoYXJncy51bmRvSWQpLFxuICAgICAgICBjYW5jZWxfcmVjb3JkaW5nOiAoYXJncykgPT4gdGhpcy5jYW5jZWxSZWNvcmRpbmcoYXJncy51bmRvSWQpLFxuICAgICAgICB1bmRvOiAoKSA9PiB0aGlzLnVuZG8oKSxcbiAgICAgICAgcmVkbzogKCkgPT4gdGhpcy5yZWRvKCksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgYmVnaW5SZWNvcmRpbmcobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdW5kb0lkOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdiZWdpbi1yZWNvcmRpbmcnLCBub2RlVXVpZCkgYXMgc3RyaW5nO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1bmRvSWQgfSwgJ1VuZG8gcmVjb3JkaW5nIHN0YXJ0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGVuZFJlY29yZGluZyh1bmRvSWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZW5kLXJlY29yZGluZycsIHVuZG9JZCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnVW5kbyByZWNvcmRpbmcgZW5kZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNhbmNlbFJlY29yZGluZyh1bmRvSWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY2FuY2VsLXJlY29yZGluZycsIHVuZG9JZCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnVW5kbyByZWNvcmRpbmcgY2FuY2VsbGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB1bmRvKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAndW5kbycpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1VuZG8gcGVyZm9ybWVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWRvKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVkbycpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1JlZG8gcGVyZm9ybWVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxufVxuIl19