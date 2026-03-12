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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNlbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2Utc2VsZWN0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsa0RBQTBEO0FBRTFELE1BQWEsZUFBZ0IsU0FBUSxpQ0FBYztJQUFuRDs7UUFDYSxTQUFJLEdBQUcsa0JBQWtCLENBQUM7UUFDMUIsZ0JBQVcsR0FBRyxxTkFBcU4sQ0FBQztRQUNwTyxZQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDdkQsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFVBQVUsQ0FBQztvQkFDbEQsV0FBVyxFQUFFLHlLQUF5SztpQkFDekw7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUM7b0JBQ3ZCLFdBQVcsRUFBRSx5RkFBeUY7aUJBQ3pHO2dCQUNELEtBQUssRUFBRTtvQkFDSCxXQUFXLEVBQUUsMEVBQTBFO2lCQUMxRjtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHVDQUF1QztpQkFDdkQ7YUFDSjtZQUNELFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO1FBRVEsbUJBQWMsR0FBNkU7WUFDakcsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQztZQUN0QyxHQUFH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TyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFTO1FBQ25DLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDO1lBQ2pDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3BELE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBdkZELDBDQXVGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgbm9ybWFsaXplU3RyaW5nQXJyYXkgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlU2VsZWN0aW9uIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NlbGVjdGlvbic7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGVkaXRvciBzZWxlY3Rpb24gc3RhdGUuIEFjdGlvbnM6IGdldCwgc2V0LCBjbGVhciwgaG92ZXIsIGdldF9sYXN0LiBUeXBlIHBhcmFtOiBcIm5vZGVcIiBmb3Igc2NlbmUgbm9kZXMsIFwiYXNzZXRcIiBmb3IgcHJvamVjdCBhc3NldHMuIFVzZSBnZXQgdG8gZGlzY292ZXIgd2hhdCB0aGUgdXNlciBoYXMgc2VsZWN0ZWQgYmVmb3JlIG9wZXJhdGluZyBvbiBub2Rlcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2dldCcsICdzZXQnLCAnY2xlYXInLCAnaG92ZXInLCAnZ2V0X2xhc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0JywgJ3NldCcsICdjbGVhcicsICdob3ZlcicsICdnZXRfbGFzdCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2VsZWN0aW9uIG9wZXJhdGlvbjogZ2V0PWdldCBjdXJyZW50IHNlbGVjdGlvbiwgc2V0PXNldCBzZWxlY3Rpb24gdG8gZ2l2ZW4gVVVJRHMsIGNsZWFyPWNsZWFyIGFsbCBzZWxlY3Rpb24sIGhvdmVyPXNldCBob3ZlciBoaWdobGlnaHQsIGdldF9sYXN0PWdldCBsYXN0IHNlbGVjdGVkIGl0ZW0nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnbm9kZScsICdhc3NldCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2VsZWN0aW9uIHR5cGUgKGRlZmF1bHQ6IG5vZGUpLiBVc2UgXCJub2RlXCIgZm9yIHNjZW5lIG5vZGVzLCBcImFzc2V0XCIgZm9yIHByb2plY3QgYXNzZXRzLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF0gVVVJRChzKSB0byBzZWxlY3Qg4oCUIGFjY2VwdHMgYSBzaW5nbGUgc3RyaW5nIG9yIGFuIGFycmF5IG9mIHN0cmluZ3MnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2hvdmVyXSBTaW5nbGUgVVVJRCB0byBzZXQgYXMgaG92ZXJlZCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGdldDogKGFyZ3MpID0+IHRoaXMuZ2V0U2VsZWN0aW9uKGFyZ3MpLFxuICAgICAgICBzZXQ6IChhcmdzKSA9PiB0aGlzLnNldFNlbGVjdGlvbihhcmdzKSxcbiAgICAgICAgY2xlYXI6IChhcmdzKSA9PiB0aGlzLmNsZWFyU2VsZWN0aW9uKGFyZ3MpLFxuICAgICAgICBob3ZlcjogKGFyZ3MpID0+IHRoaXMuaG92ZXJOb2RlKGFyZ3MpLFxuICAgICAgICBnZXRfbGFzdDogKGFyZ3MpID0+IHRoaXMuZ2V0TGFzdFNlbGVjdGVkKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFNlbGVjdGlvbihhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBhcmdzLnR5cGUgfHwgJ25vZGUnO1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0ZWQgPSBFZGl0b3IuU2VsZWN0aW9uLmdldFNlbGVjdGVkKHR5cGUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlLCBzZWxlY3RlZCwgY291bnQ6IHNlbGVjdGVkLmxlbmd0aCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFNlbGVjdGlvbihhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBhcmdzLnR5cGUgfHwgJ25vZGUnO1xuICAgICAgICAgICAgY29uc3QgdXVpZHMgPSBub3JtYWxpemVTdHJpbmdBcnJheShhcmdzLnV1aWRzKSB8fCBbXTtcbiAgICAgICAgICAgIEVkaXRvci5TZWxlY3Rpb24uc2VsZWN0KHR5cGUsIHV1aWRzKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdHlwZSwgc2VsZWN0ZWQ6IHV1aWRzIH0sIGBTZWxlY3RlZCAke3V1aWRzLmxlbmd0aH0gaXRlbXNgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNsZWFyU2VsZWN0aW9uKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFyZ3MudHlwZSB8fCAnbm9kZSc7XG4gICAgICAgICAgICBFZGl0b3IuU2VsZWN0aW9uLmNsZWFyKHR5cGUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlIH0sICdTZWxlY3Rpb24gY2xlYXJlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaG92ZXJOb2RlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFyZ3MudHlwZSB8fCAnbm9kZSc7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkIGZvciBob3ZlcicpO1xuICAgICAgICAgICAgRWRpdG9yLlNlbGVjdGlvbi5ob3Zlcih0eXBlLCBhcmdzLnV1aWQpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB0eXBlLCB1dWlkOiBhcmdzLnV1aWQgfSwgJ0hvdmVyIHNldCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TGFzdFNlbGVjdGVkKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHlwZSA9IGFyZ3MudHlwZSB8fCAnbm9kZSc7XG4gICAgICAgICAgICBjb25zdCBsYXN0ID0gRWRpdG9yLlNlbGVjdGlvbi5nZXRMYXN0U2VsZWN0ZWQodHlwZSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHR5cGUsIGxhc3RTZWxlY3RlZDogbGFzdCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iXX0=