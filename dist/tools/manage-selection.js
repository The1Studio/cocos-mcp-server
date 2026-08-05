"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageSelection = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
class ManageSelection extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_selection';
        this.description = 'Manage editor selection state. Actions: get, set, clear, hover, get_last. Type param: "node" for scene nodes, "asset" for project assets. Use get to discover what the user has selected before operating on nodes.';
        this.actions = ['get', 'set', 'clear', 'hover', 'get_last'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get', 'set', 'clear', 'hover', 'get_last'],
                    description: 'Selection operation: get=get current selection, set=set selection to given UUIDs, clear=clear all selection, hover=set hover highlight, get_last=get last selected item'
                },
                type: {
                    type: 'string',
                    enum: ['node', 'asset'],
                    description: 'Selection type (default: node). Use "node" for scene nodes, "asset" for project assets.'
                },
                uuids: {
                    description: '[set] UUID(s) to select — accepts a single string or an array of strings'
                },
                uuid: {
                    type: 'string',
                    description: '[hover] Single UUID to set as hovered'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get: (args) => this.getSelection(args),
            set: (args) => this.setSelection(args),
            clear: (args) => this.clearSelection(args),
            hover: (args) => this.hoverNode(args),
            get_last: (args) => this.getLastSelected(args),
        };
    }
    async getSelection(args) {
        try {
            const type = args.type || 'node';
            const selected = Editor.Selection.getSelected(type);
            return (0, types_1.successResult)({ type, selected, count: selected.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setSelection(args) {
        try {
            const type = args.type || 'node';
            const uuids = (0, normalize_1.normalizeStringArray)(args.uuids) || [];
            Editor.Selection.select(type, uuids);
            return (0, types_1.successResult)({ type, selected: uuids }, `Selected ${uuids.length} items`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async clearSelection(args) {
        try {
            const type = args.type || 'node';
            Editor.Selection.clear(type);
            return (0, types_1.successResult)({ type }, 'Selection cleared');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async hoverNode(args) {
        try {
            const type = args.type || 'node';
            if (!args.uuid)
                return (0, types_1.errorResult)('uuid is required for hover');
            Editor.Selection.hover(type, args.uuid);
            return (0, types_1.successResult)({ type, uuid: args.uuid }, 'Hover set');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getLastSelected(args) {
        try {
            const type = args.type || 'node';
            const last = Editor.Selection.getLastSelected(type);
            return (0, types_1.successResult)({ type, lastSelected: last });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageSelection = ManageSelection;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNlbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2Utc2VsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsa0RBQTBEO0FBRTFELE1BQWEsZUFBZ0IsU0FBUSxpQ0FBYztJQUFuRDs7UUFDYSxTQUFJLEdBQUcsa0JBQWtCLENBQUM7UUFDMUIsZ0JBQVcsR0FBRyxxTkFBcU4sQ0FBQztRQUNwTyxZQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdkQsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQztvQkFDbEQsV0FBVyxFQUFFLHlLQUF5SztpQkFDekw7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7b0JBQ3ZCLFdBQVcsRUFBRSx5RkFBeUY7aUJBQ3pHO2dCQUNELEtBQUssRUFBRTtvQkFDSCxXQUFXLEVBQUUsMEVBQTBFO2lCQUMxRjtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHVDQUF1QztpQkFDdkQ7YUFDSjtZQUNELFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO1FBRVEsbUJBQWMsR0FBNkU7WUFDakcsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQztZQUN0QyxHQUFH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TyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFTO1FBQ25DLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDO1lBQ2pDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BELE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBdkZELDBDQXVGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IG5vcm1hbGl6ZVN0cmluZ0FycmF5IH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VTZWxlY3Rpb24gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XHJcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9zZWxlY3Rpb24nO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGVkaXRvciBzZWxlY3Rpb24gc3RhdGUuIEFjdGlvbnM6IGdldCwgc2V0LCBjbGVhciwgaG92ZXIsIGdldF9sYXN0LiBUeXBlIHBhcmFtOiBcIm5vZGVcIiBmb3Igc2NlbmUgbm9kZXMsIFwiYXNzZXRcIiBmb3IgcHJvamVjdCBhc3NldHMuIFVzZSBnZXQgdG8gZGlzY292ZXIgd2hhdCB0aGUgdXNlciBoYXMgc2VsZWN0ZWQgYmVmb3JlIG9wZXJhdGluZyBvbiBub2Rlcy4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0JywgJ3NldCcsICdjbGVhcicsICdob3ZlcicsICdnZXRfbGFzdCddO1xyXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XHJcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydnZXQnLCAnc2V0JywgJ2NsZWFyJywgJ2hvdmVyJywgJ2dldF9sYXN0J10sXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NlbGVjdGlvbiBvcGVyYXRpb246IGdldD1nZXQgY3VycmVudCBzZWxlY3Rpb24sIHNldD1zZXQgc2VsZWN0aW9uIHRvIGdpdmVuIFVVSURzLCBjbGVhcj1jbGVhciBhbGwgc2VsZWN0aW9uLCBob3Zlcj1zZXQgaG92ZXIgaGlnaGxpZ2h0LCBnZXRfbGFzdD1nZXQgbGFzdCBzZWxlY3RlZCBpdGVtJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB0eXBlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnbm9kZScsICdhc3NldCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTZWxlY3Rpb24gdHlwZSAoZGVmYXVsdDogbm9kZSkuIFVzZSBcIm5vZGVcIiBmb3Igc2NlbmUgbm9kZXMsIFwiYXNzZXRcIiBmb3IgcHJvamVjdCBhc3NldHMuJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB1dWlkczoge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0XSBVVUlEKHMpIHRvIHNlbGVjdCDigJQgYWNjZXB0cyBhIHNpbmdsZSBzdHJpbmcgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncydcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdXVpZDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tob3Zlcl0gU2luZ2xlIFVVSUQgdG8gc2V0IGFzIGhvdmVyZWQnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGdldDogKGFyZ3MpID0+IHRoaXMuZ2V0U2VsZWN0aW9uKGFyZ3MpLFxyXG4gICAgICAgIHNldDogKGFyZ3MpID0+IHRoaXMuc2V0U2VsZWN0aW9uKGFyZ3MpLFxyXG4gICAgICAgIGNsZWFyOiAoYXJncykgPT4gdGhpcy5jbGVhclNlbGVjdGlvbihhcmdzKSxcclxuICAgICAgICBob3ZlcjogKGFyZ3MpID0+IHRoaXMuaG92ZXJOb2RlKGFyZ3MpLFxyXG4gICAgICAgIGdldF9sYXN0OiAoYXJncykgPT4gdGhpcy5nZXRMYXN0U2VsZWN0ZWQoYXJncyksXHJcbiAgICB9O1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U2VsZWN0aW9uKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBhcmdzLnR5cGUgfHwgJ25vZGUnO1xyXG4gICAgICAgICAgICBjb25zdCBzZWxlY3RlZCA9IEVkaXRvci5TZWxlY3Rpb24uZ2V0U2VsZWN0ZWQodHlwZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdHlwZSwgc2VsZWN0ZWQsIGNvdW50OiBzZWxlY3RlZC5sZW5ndGggfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTZWxlY3Rpb24oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFyZ3MudHlwZSB8fCAnbm9kZSc7XHJcbiAgICAgICAgICAgIGNvbnN0IHV1aWRzID0gbm9ybWFsaXplU3RyaW5nQXJyYXkoYXJncy51dWlkcykgfHwgW107XHJcbiAgICAgICAgICAgIEVkaXRvci5TZWxlY3Rpb24uc2VsZWN0KHR5cGUsIHV1aWRzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlLCBzZWxlY3RlZDogdXVpZHMgfSwgYFNlbGVjdGVkICR7dXVpZHMubGVuZ3RofSBpdGVtc2ApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgY2xlYXJTZWxlY3Rpb24oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFyZ3MudHlwZSB8fCAnbm9kZSc7XHJcbiAgICAgICAgICAgIEVkaXRvci5TZWxlY3Rpb24uY2xlYXIodHlwZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdHlwZSB9LCAnU2VsZWN0aW9uIGNsZWFyZWQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhvdmVyTm9kZShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB0eXBlID0gYXJncy50eXBlIHx8ICdub2RlJztcclxuICAgICAgICAgICAgaWYgKCFhcmdzLnV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCBmb3IgaG92ZXInKTtcclxuICAgICAgICAgICAgRWRpdG9yLlNlbGVjdGlvbi5ob3Zlcih0eXBlLCBhcmdzLnV1aWQpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHR5cGUsIHV1aWQ6IGFyZ3MudXVpZCB9LCAnSG92ZXIgc2V0Jyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRMYXN0U2VsZWN0ZWQoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFyZ3MudHlwZSB8fCAnbm9kZSc7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhc3QgPSBFZGl0b3IuU2VsZWN0aW9uLmdldExhc3RTZWxlY3RlZCh0eXBlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlLCBsYXN0U2VsZWN0ZWQ6IGxhc3QgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl19