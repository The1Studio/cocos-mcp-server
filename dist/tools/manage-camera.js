"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageCamera = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageCamera extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_camera';
        this.description = 'Manage Camera components in scene. Actions: get_info=get camera properties, set_property=set camera property, set_clear_flags=set clear flags, set_projection=set projection type, set_viewport=set viewport rect, list=list all cameras.';
        this.actions = ['get_info', 'set_property', 'set_clear_flags', 'set_projection', 'set_viewport', 'list'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'set_property', 'set_clear_flags', 'set_projection', 'set_viewport', 'list'],
                    description: 'Action: get_info=get camera properties, set_property=set property, set_clear_flags=set clear mode, set_projection=ORTHO or PERSPECTIVE, set_viewport=set normalized viewport rect, list=list all cameras'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[get_info, set_property, set_clear_flags, set_projection, set_viewport] Target node UUID'
                },
                property: {
                    type: 'string',
                    enum: ['fov', 'orthoHeight', 'near', 'far', 'priority', 'visibility'],
                    description: '[set_property] Camera property to set'
                },
                value: {
                    description: '[set_property] Value to set for the property'
                },
                clearFlags: {
                    type: 'string',
                    enum: ['SOLID_COLOR', 'DEPTH_ONLY', 'DONT_CLEAR', 'SKYBOX'],
                    description: '[set_clear_flags] Camera clear flags mode'
                },
                projection: {
                    type: 'string',
                    enum: ['ORTHO', 'PERSPECTIVE'],
                    description: '[set_projection] Camera projection type'
                },
                x: { type: 'number', description: '[set_viewport] Viewport x (0-1 normalized)', default: 0 },
                y: { type: 'number', description: '[set_viewport] Viewport y (0-1 normalized)', default: 0 },
                width: { type: 'number', description: '[set_viewport] Viewport width (0-1 normalized)', default: 1 },
                height: { type: 'number', description: '[set_viewport] Viewport height (0-1 normalized)', default: 1 }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getCameraInfo(args),
            set_property: (args) => this.setCameraProperty(args),
            set_clear_flags: (args) => this.setClearFlags(args),
            set_projection: (args) => this.setProjection(args),
            set_viewport: (args) => this.setViewport(args),
            list: (args) => this.listCameras(args),
        };
    }
    async getCameraInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getCameraInfo',
                args: [args.nodeUuid]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to get camera info');
            return (0, types_1.successResult)(result.data);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setCameraProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.property)
            return (0, types_1.errorResult)('property is required');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set camera property');
            return (0, types_1.successResult)(null, `Camera property '${args.property}' updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setClearFlags(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.clearFlags)
            return (0, types_1.errorResult)('clearFlags is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, 'clearFlags', args.clearFlags]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set clear flags');
            return (0, types_1.successResult)(null, `Camera clearFlags set to '${args.clearFlags}'`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setProjection(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.projection)
            return (0, types_1.errorResult)('projection is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, 'projection', args.projection]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set projection');
            return (0, types_1.successResult)(null, `Camera projection set to '${args.projection}'`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setViewport(args) {
        var _a, _b, _c, _d;
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        const x = (_a = args.x) !== null && _a !== void 0 ? _a : 0, y = (_b = args.y) !== null && _b !== void 0 ? _b : 0, width = (_c = args.width) !== null && _c !== void 0 ? _c : 1, height = (_d = args.height) !== null && _d !== void 0 ? _d : 1;
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setCameraProperty',
                args: [args.nodeUuid, 'viewport', { x, y, width, height }]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set viewport');
            return (0, types_1.successResult)(null, `Camera viewport set to (${x}, ${y}, ${width}, ${height})`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listCameras(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listCameras',
                args: []
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to list cameras');
            return (0, types_1.successResult)(result.data);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageCamera = ManageCamera;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNhbWVyYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtY2FtZXJhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBYSxZQUFhLFNBQVEsaUNBQWM7SUFBaEQ7O1FBQ2EsU0FBSSxHQUFHLGVBQWUsQ0FBQztRQUN2QixnQkFBVyxHQUFHLDJPQUEyTyxDQUFDO1FBQzFQLFlBQU8sR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BHLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQztvQkFDL0YsV0FBVyxFQUFFLDBNQUEwTTtpQkFDMU47Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwwRkFBMEY7aUJBQzFHO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLFlBQVksQ0FBQztvQkFDckUsV0FBVyxFQUFFLHVDQUF1QztpQkFDdkQ7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILFdBQVcsRUFBRSw4Q0FBOEM7aUJBQzlEO2dCQUNELFVBQVUsRUFBRTtvQkFDUixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUM7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Li9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlQ2FtZXJhIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2NhbWVyYSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIENhbWVyYSBjb21wb25lbnRzIGluIHNjZW5lLiBBY3Rpb25zOiBnZXRfaW5mbz1nZXQgY2FtZXJhIHByb3BlcnRpZXMsIHNldF9wcm9wZXJ0eT1zZXQgY2FtZXJhIHByb3BlcnR5LCBzZXRfY2xlYXJfZmxhZ3M9c2V0IGNsZWFyIGZsYWdzLCBzZXRfcHJvamVjdGlvbj1zZXQgcHJvamVjdGlvbiB0eXBlLCBzZXRfdmlld3BvcnQ9c2V0IHZpZXdwb3J0IHJlY3QsIGxpc3Q9bGlzdCBhbGwgY2FtZXJhcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdzZXRfY2xlYXJfZmxhZ3MnLCAnc2V0X3Byb2plY3Rpb24nLCAnc2V0X3ZpZXdwb3J0JywgJ2xpc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9jbGVhcl9mbGFncycsICdzZXRfcHJvamVjdGlvbicsICdzZXRfdmlld3BvcnQnLCAnbGlzdCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBnZXRfaW5mbz1nZXQgY2FtZXJhIHByb3BlcnRpZXMsIHNldF9wcm9wZXJ0eT1zZXQgcHJvcGVydHksIHNldF9jbGVhcl9mbGFncz1zZXQgY2xlYXIgbW9kZSwgc2V0X3Byb2plY3Rpb249T1JUSE8gb3IgUEVSU1BFQ1RJVkUsIHNldF92aWV3cG9ydD1zZXQgbm9ybWFsaXplZCB2aWV3cG9ydCByZWN0LCBsaXN0PWxpc3QgYWxsIGNhbWVyYXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCBzZXRfY2xlYXJfZmxhZ3MsIHNldF9wcm9qZWN0aW9uLCBzZXRfdmlld3BvcnRdIFRhcmdldCBub2RlIFVVSUQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2ZvdicsICdvcnRob0hlaWdodCcsICduZWFyJywgJ2ZhcicsICdwcmlvcml0eScsICd2aXNpYmlsaXR5J10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBDYW1lcmEgcHJvcGVydHkgdG8gc2V0J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBWYWx1ZSB0byBzZXQgZm9yIHRoZSBwcm9wZXJ0eSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjbGVhckZsYWdzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydTT0xJRF9DT0xPUicsICdERVBUSF9PTkxZJywgJ0RPTlRfQ0xFQVInLCAnU0tZQk9YJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2NsZWFyX2ZsYWdzXSBDYW1lcmEgY2xlYXIgZmxhZ3MgbW9kZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9qZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydPUlRITycsICdQRVJTUEVDVElWRSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9qZWN0aW9uXSBDYW1lcmEgcHJvamVjdGlvbiB0eXBlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF92aWV3cG9ydF0gVmlld3BvcnQgeCAoMC0xIG5vcm1hbGl6ZWQpJywgZGVmYXVsdDogMCB9LFxuICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3ZpZXdwb3J0XSBWaWV3cG9ydCB5ICgwLTEgbm9ybWFsaXplZCknLCBkZWZhdWx0OiAwIH0sXG4gICAgICAgICAgICB3aWR0aDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3ZpZXdwb3J0XSBWaWV3cG9ydCB3aWR0aCAoMC0xIG5vcm1hbGl6ZWQpJywgZGVmYXVsdDogMSB9LFxuICAgICAgICAgICAgaGVpZ2h0OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfdmlld3BvcnRdIFZpZXdwb3J0IGhlaWdodCAoMC0xIG5vcm1hbGl6ZWQpJywgZGVmYXVsdDogMSB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0Q2FtZXJhSW5mbyhhcmdzKSxcbiAgICAgICAgc2V0X3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRDYW1lcmFQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgc2V0X2NsZWFyX2ZsYWdzOiAoYXJncykgPT4gdGhpcy5zZXRDbGVhckZsYWdzKGFyZ3MpLFxuICAgICAgICBzZXRfcHJvamVjdGlvbjogKGFyZ3MpID0+IHRoaXMuc2V0UHJvamVjdGlvbihhcmdzKSxcbiAgICAgICAgc2V0X3ZpZXdwb3J0OiAoYXJncykgPT4gdGhpcy5zZXRWaWV3cG9ydChhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdENhbWVyYXMoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q2FtZXJhSW5mbyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldENhbWVyYUluZm8nLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBnZXQgY2FtZXJhIGluZm8nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Q2FtZXJhUHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgaWYgKGFyZ3MudmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRDYW1lcmFQcm9wZXJ0eScsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHNldCBjYW1lcmEgcHJvcGVydHknKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBDYW1lcmEgcHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIHVwZGF0ZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Q2xlYXJGbGFncyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghYXJncy5jbGVhckZsYWdzKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2NsZWFyRmxhZ3MgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0Q2FtZXJhUHJvcGVydHknLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCAnY2xlYXJGbGFncycsIGFyZ3MuY2xlYXJGbGFnc11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKCEocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gc2V0IGNsZWFyIGZsYWdzJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCBgQ2FtZXJhIGNsZWFyRmxhZ3Mgc2V0IHRvICcke2FyZ3MuY2xlYXJGbGFnc30nYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFByb2plY3Rpb24oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBpZiAoIWFyZ3MucHJvamVjdGlvbikgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9qZWN0aW9uIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldENhbWVyYVByb3BlcnR5JyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgJ3Byb2plY3Rpb24nLCBhcmdzLnByb2plY3Rpb25dXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHNldCBwcm9qZWN0aW9uJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCBgQ2FtZXJhIHByb2plY3Rpb24gc2V0IHRvICcke2FyZ3MucHJvamVjdGlvbn0nYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFZpZXdwb3J0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgeCA9IGFyZ3MueCA/PyAwLCB5ID0gYXJncy55ID8/IDAsIHdpZHRoID0gYXJncy53aWR0aCA/PyAxLCBoZWlnaHQgPSBhcmdzLmhlaWdodCA/PyAxO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRDYW1lcmFQcm9wZXJ0eScsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsICd2aWV3cG9ydCcsIHsgeCwgeSwgd2lkdGgsIGhlaWdodCB9XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBzZXQgdmlld3BvcnQnKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBDYW1lcmEgdmlld3BvcnQgc2V0IHRvICgke3h9LCAke3l9LCAke3dpZHRofSwgJHtoZWlnaHR9KWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0Q2FtZXJhcyhfYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2xpc3RDYW1lcmFzJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBsaXN0IGNhbWVyYXMnKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cbn1cbiJdfQ==