"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageSpine = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageSpine extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_spine';
        this.description = 'Manage Spine skeletal animation (sp.Skeleton). Actions: get_info, set_animation, set_skin, set_property, list, add_to_node. Requires Spine runtime in project.';
        this.actions = ['get_info', 'set_animation', 'set_skin', 'set_property', 'list', 'add_to_node'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'set_animation', 'set_skin', 'set_property', 'list', 'add_to_node'],
                    description: 'Action: get_info=get skeleton info, set_animation=play animation, set_skin=set skin, set_property=set property, list=list Spine nodes, add_to_node=add Spine component'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[get_info, set_animation, set_skin, set_property, add_to_node] UUID of the node'
                },
                animationName: {
                    type: 'string',
                    description: '[set_animation] Animation name to play'
                },
                loop: {
                    type: 'boolean',
                    description: '[set_animation] Whether to loop the animation (default: true)',
                    default: true
                },
                trackIndex: {
                    type: 'number',
                    description: '[set_animation] Track index (default: 0)',
                    default: 0
                },
                skinName: {
                    type: 'string',
                    description: '[set_skin] Skin name to set'
                },
                property: {
                    type: 'string',
                    enum: ['timeScale', 'premultipliedAlpha', 'debugBones', 'debugSlots'],
                    description: '[set_property] Property name to set'
                },
                value: {
                    description: '[set_property] Value to set for the property'
                },
                skeletonDataUuid: {
                    type: 'string',
                    description: '[add_to_node] UUID of the SkeletonData asset to assign'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getSpineInfo(args),
            set_animation: (args) => this.setSpineAnimation(args),
            set_skin: (args) => this.setSpineSkin(args),
            set_property: (args) => this.setSpineProperty(args),
            list: (args) => this.listSpineNodes(args),
            add_to_node: (args) => this.addSpineToNode(args),
        };
    }
    async getSpineInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getSpineInfo', args: [args.nodeUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setSpineAnimation(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_animation');
        if (!args.animationName)
            return (0, types_1.errorResult)('animationName is required for set_animation');
        try {
            const loop = args.loop !== false;
            const trackIndex = typeof args.trackIndex === 'number' ? args.trackIndex : 0;
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSpineAnimation', args: [args.nodeUuid, args.animationName, loop, trackIndex]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Animation '${args.animationName}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setSpineSkin(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_skin');
        if (!args.skinName)
            return (0, types_1.errorResult)('skinName is required for set_skin');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSpineSkin', args: [args.nodeUuid, args.skinName]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Skin '${args.skinName}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setSpineProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_property');
        if (!args.property)
            return (0, types_1.errorResult)('property is required for set_property');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required for set_property');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSpineProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Property '${args.property}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listSpineNodes(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listSpineNodes', args: []
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async addSpineToNode(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for add_to_node');
        if (!args.skeletonDataUuid)
            return (0, types_1.errorResult)('skeletonDataUuid is required for add_to_node');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addSpineToNode', args: [args.nodeUuid, args.skeletonDataUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data, 'Spine component added') : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageSpine = ManageSpine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNwaW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1zcGluZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRyxnS0FBZ0ssQ0FBQztRQUMvSyxZQUFPLEdBQUcsQ0FBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzNGLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLGNBQWMsRUFBRSxNQUFNLEVBQUUsYUFBYSxDQUFDO29CQUN0RixXQUFXLEVBQUUsd0tBQXdLO2lCQUN4TDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGlGQUFpRjtpQkFDakc7Z0JBQ0QsYUFBYSxFQUFFO29CQUNYLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx3Q0FBd0M7aUJBQ3hEO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVBQUUsK0RBQStEO29CQUM1RSxPQUFPLEVBQUUsSUFBSTtpQkFDaEI7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwwQ0FBMEM7b0JBQ3ZELE9BQU8sRUFBRSxDQUFDO2lCQUNiO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsNkJBQTZC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QUFDLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQVcsRUFBRSxNQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdkksQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQTVIRCxrQ0E0SEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVNwaW5lIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NwaW5lJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgU3BpbmUgc2tlbGV0YWwgYW5pbWF0aW9uIChzcC5Ta2VsZXRvbikuIEFjdGlvbnM6IGdldF9pbmZvLCBzZXRfYW5pbWF0aW9uLCBzZXRfc2tpbiwgc2V0X3Byb3BlcnR5LCBsaXN0LCBhZGRfdG9fbm9kZS4gUmVxdWlyZXMgU3BpbmUgcnVudGltZSBpbiBwcm9qZWN0Lic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0X2luZm8nLCAnc2V0X2FuaW1hdGlvbicsICdzZXRfc2tpbicsICdzZXRfcHJvcGVydHknLCAnbGlzdCcsICdhZGRfdG9fbm9kZSddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZXRfaW5mbycsICdzZXRfYW5pbWF0aW9uJywgJ3NldF9za2luJywgJ3NldF9wcm9wZXJ0eScsICdsaXN0JywgJ2FkZF90b19ub2RlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IGdldF9pbmZvPWdldCBza2VsZXRvbiBpbmZvLCBzZXRfYW5pbWF0aW9uPXBsYXkgYW5pbWF0aW9uLCBzZXRfc2tpbj1zZXQgc2tpbiwgc2V0X3Byb3BlcnR5PXNldCBwcm9wZXJ0eSwgbGlzdD1saXN0IFNwaW5lIG5vZGVzLCBhZGRfdG9fbm9kZT1hZGQgU3BpbmUgY29tcG9uZW50J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2luZm8sIHNldF9hbmltYXRpb24sIHNldF9za2luLCBzZXRfcHJvcGVydHksIGFkZF90b19ub2RlXSBVVUlEIG9mIHRoZSBub2RlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFuaW1hdGlvbk5hbWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfYW5pbWF0aW9uXSBBbmltYXRpb24gbmFtZSB0byBwbGF5J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGxvb3A6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2FuaW1hdGlvbl0gV2hldGhlciB0byBsb29wIHRoZSBhbmltYXRpb24gKGRlZmF1bHQ6IHRydWUpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHJhY2tJbmRleDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9hbmltYXRpb25dIFRyYWNrIGluZGV4IChkZWZhdWx0OiAwKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNraW5OYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3NraW5dIFNraW4gbmFtZSB0byBzZXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3RpbWVTY2FsZScsICdwcmVtdWx0aXBsaWVkQWxwaGEnLCAnZGVidWdCb25lcycsICdkZWJ1Z1Nsb3RzJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lIHRvIHNldCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gVmFsdWUgdG8gc2V0IGZvciB0aGUgcHJvcGVydHknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2tlbGV0b25EYXRhVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF90b19ub2RlXSBVVUlEIG9mIHRoZSBTa2VsZXRvbkRhdGEgYXNzZXQgdG8gYXNzaWduJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldFNwaW5lSW5mbyhhcmdzKSxcbiAgICAgICAgc2V0X2FuaW1hdGlvbjogKGFyZ3MpID0+IHRoaXMuc2V0U3BpbmVBbmltYXRpb24oYXJncyksXG4gICAgICAgIHNldF9za2luOiAoYXJncykgPT4gdGhpcy5zZXRTcGluZVNraW4oYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0U3BpbmVQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdFNwaW5lTm9kZXMoYXJncyksXG4gICAgICAgIGFkZF90b19ub2RlOiAoYXJncykgPT4gdGhpcy5hZGRTcGluZVRvTm9kZShhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRTcGluZUluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0U3BpbmVJbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0U3BpbmVBbmltYXRpb24oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3Igc2V0X2FuaW1hdGlvbicpO1xuICAgICAgICBpZiAoIWFyZ3MuYW5pbWF0aW9uTmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCdhbmltYXRpb25OYW1lIGlzIHJlcXVpcmVkIGZvciBzZXRfYW5pbWF0aW9uJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsb29wID0gYXJncy5sb29wICE9PSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IHRyYWNrSW5kZXggPSB0eXBlb2YgYXJncy50cmFja0luZGV4ID09PSAnbnVtYmVyJyA/IGFyZ3MudHJhY2tJbmRleCA6IDA7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFNwaW5lQW5pbWF0aW9uJywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MuYW5pbWF0aW9uTmFtZSwgbG9vcCwgdHJhY2tJbmRleF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KS5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSwgYEFuaW1hdGlvbiAnJHthcmdzLmFuaW1hdGlvbk5hbWV9JyBzZXRgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFNwaW5lU2tpbihhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBzZXRfc2tpbicpO1xuICAgICAgICBpZiAoIWFyZ3Muc2tpbk5hbWUpIHJldHVybiBlcnJvclJlc3VsdCgnc2tpbk5hbWUgaXMgcmVxdWlyZWQgZm9yIHNldF9za2luJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFNwaW5lU2tpbicsIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnNraW5OYW1lXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCBgU2tpbiAnJHthcmdzLnNraW5OYW1lfScgc2V0YCkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTcGluZVByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xuICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xuICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0U3BpbmVQcm9wZXJ0eScsIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCBgUHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIHNldGApIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbGlzdFNwaW5lTm9kZXMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdsaXN0U3BpbmVOb2RlcycsIGFyZ3M6IFtdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYWRkU3BpbmVUb05vZGUoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgYWRkX3RvX25vZGUnKTtcbiAgICAgICAgaWYgKCFhcmdzLnNrZWxldG9uRGF0YVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnc2tlbGV0b25EYXRhVXVpZCBpcyByZXF1aXJlZCBmb3IgYWRkX3RvX25vZGUnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnYWRkU3BpbmVUb05vZGUnLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5za2VsZXRvbkRhdGFVdWlkXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCAnU3BpbmUgY29tcG9uZW50IGFkZGVkJykgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxufVxuIl19