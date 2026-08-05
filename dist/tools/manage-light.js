"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageLight = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageLight extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_light';
        this.description = 'Manage light components in scene. Actions: add=add light to node, set_property=set light property, get_info=get light info on node, list=list all lights in scene, remove=remove light from node.';
        this.actions = ['add', 'set_property', 'get_info', 'list', 'remove'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'set_property', 'get_info', 'list', 'remove'],
                    description: 'Action: add=add light component, set_property=set light property, get_info=get light info, list=list all lights, remove=remove light component'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[add, set_property, get_info, remove] Target node UUID'
                },
                type: {
                    type: 'string',
                    enum: ['directional', 'sphere', 'spot'],
                    description: '[add] Light type: directional=DirectionalLight, sphere=SphereLight, spot=SpotLight'
                },
                color: {
                    description: '[add, set_property] Light color as hex string "#RRGGBB" or object {r,g,b,a} (0-255)'
                },
                intensity: {
                    type: 'number',
                    description: '[add, set_property] Light intensity value'
                },
                property: {
                    type: 'string',
                    enum: ['color', 'intensity', 'range', 'spotAngle', 'shadowEnabled', 'shadowBias'],
                    description: '[set_property] Light property to set'
                },
                value: {
                    description: '[set_property] Value to set for the property'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            add: (args) => this.addLight(args),
            set_property: (args) => this.setLightProperty(args),
            get_info: (args) => this.getLightInfo(args),
            list: (args) => this.listLights(args),
            remove: (args) => this.removeLightComponent(args),
        };
    }
    async addLight(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for add');
        if (!args.type)
            return (0, types_1.errorResult)('type is required for add (directional/sphere/spot)');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addLightComponent',
                args: [args.nodeUuid, args.type, args.color, args.intensity]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to add light');
            return (0, types_1.successResult)(result.data, `${args.type} light added to node`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setLightProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.property)
            return (0, types_1.errorResult)('property is required');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setLightProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set property');
            return (0, types_1.successResult)(null, `Light property '${args.property}' updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getLightInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getLightInfo',
                args: [args.nodeUuid]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to get light info');
            return (0, types_1.successResult)(result.data);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listLights(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listLights',
                args: []
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to list lights');
            return (0, types_1.successResult)(result.data);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async removeLightComponent(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'removeLightComponent',
                args: [args.nodeUuid]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to remove light');
            return (0, types_1.successResult)(null, 'Light component removed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageLight = ManageLight;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1saWdodC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRyxtTUFBbU0sQ0FBQztRQUNsTixZQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDaEUsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztvQkFDM0QsV0FBVyxFQUFFLGdKQUFnSjtpQkFDaEs7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx3REFBd0Q7aUJBQ3hFO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztvQkFDdkMsV0FBVyxFQUFFLG9GQUFvRjtpQkFDcEc7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILFdBQVcsRUFBRSxxRkFBcUY7aUJBQ3JHO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMkNBQTJDO2lCQUMzRDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FB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QUFDLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxPQUFPLENBQUE7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQyxNQUFjLGFBQWQsTUFBTSx1QkFBTixNQUFNLENBQVUsS0FBSyxLQUFJLHdCQUF3QixDQUFDLENBQUM7WUFDdEcsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLHlCQUF5QixDQUFDLENBQUM7UUFDMUQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQTdHRCxrQ0E2R0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZUxpZ2h0IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfbGlnaHQnO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGxpZ2h0IGNvbXBvbmVudHMgaW4gc2NlbmUuIEFjdGlvbnM6IGFkZD1hZGQgbGlnaHQgdG8gbm9kZSwgc2V0X3Byb3BlcnR5PXNldCBsaWdodCBwcm9wZXJ0eSwgZ2V0X2luZm89Z2V0IGxpZ2h0IGluZm8gb24gbm9kZSwgbGlzdD1saXN0IGFsbCBsaWdodHMgaW4gc2NlbmUsIHJlbW92ZT1yZW1vdmUgbGlnaHQgZnJvbSBub2RlLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydhZGQnLCAnc2V0X3Byb3BlcnR5JywgJ2dldF9pbmZvJywgJ2xpc3QnLCAncmVtb3ZlJ107XHJcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcclxuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FkZCcsICdzZXRfcHJvcGVydHknLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZW1vdmUnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBhZGQ9YWRkIGxpZ2h0IGNvbXBvbmVudCwgc2V0X3Byb3BlcnR5PXNldCBsaWdodCBwcm9wZXJ0eSwgZ2V0X2luZm89Z2V0IGxpZ2h0IGluZm8sIGxpc3Q9bGlzdCBhbGwgbGlnaHRzLCByZW1vdmU9cmVtb3ZlIGxpZ2h0IGNvbXBvbmVudCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCBzZXRfcHJvcGVydHksIGdldF9pbmZvLCByZW1vdmVdIFRhcmdldCBub2RlIFVVSUQnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHR5cGU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydkaXJlY3Rpb25hbCcsICdzcGhlcmUnLCAnc3BvdCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkXSBMaWdodCB0eXBlOiBkaXJlY3Rpb25hbD1EaXJlY3Rpb25hbExpZ2h0LCBzcGhlcmU9U3BoZXJlTGlnaHQsIHNwb3Q9U3BvdExpZ2h0J1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBjb2xvcjoge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCBzZXRfcHJvcGVydHldIExpZ2h0IGNvbG9yIGFzIGhleCBzdHJpbmcgXCIjUlJHR0JCXCIgb3Igb2JqZWN0IHtyLGcsYixhfSAoMC0yNTUpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBpbnRlbnNpdHk6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCBzZXRfcHJvcGVydHldIExpZ2h0IGludGVuc2l0eSB2YWx1ZSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcHJvcGVydHk6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydjb2xvcicsICdpbnRlbnNpdHknLCAncmFuZ2UnLCAnc3BvdEFuZ2xlJywgJ3NoYWRvd0VuYWJsZWQnLCAnc2hhZG93QmlhcyddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBMaWdodCBwcm9wZXJ0eSB0byBzZXQnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFZhbHVlIHRvIHNldCBmb3IgdGhlIHByb3BlcnR5J1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgfTtcclxuXHJcbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcclxuICAgICAgICBhZGQ6IChhcmdzKSA9PiB0aGlzLmFkZExpZ2h0KGFyZ3MpLFxyXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TGlnaHRQcm9wZXJ0eShhcmdzKSxcclxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0TGlnaHRJbmZvKGFyZ3MpLFxyXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmxpc3RMaWdodHMoYXJncyksXHJcbiAgICAgICAgcmVtb3ZlOiAoYXJncykgPT4gdGhpcy5yZW1vdmVMaWdodENvbXBvbmVudChhcmdzKSxcclxuICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRMaWdodChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGFkZCcpO1xyXG4gICAgICAgIGlmICghYXJncy50eXBlKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3R5cGUgaXMgcmVxdWlyZWQgZm9yIGFkZCAoZGlyZWN0aW9uYWwvc3BoZXJlL3Nwb3QpJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2FkZExpZ2h0Q29tcG9uZW50JyxcclxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnR5cGUsIGFyZ3MuY29sb3IsIGFyZ3MuaW50ZW5zaXR5XVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYgKCEocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gYWRkIGxpZ2h0Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCBgJHthcmdzLnR5cGV9IGxpZ2h0IGFkZGVkIHRvIG5vZGVgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRMaWdodFByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmIChhcmdzLnZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0TGlnaHRQcm9wZXJ0eScsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5wcm9wZXJ0eSwgYXJncy52YWx1ZV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHNldCBwcm9wZXJ0eScpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCBgTGlnaHQgcHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIHVwZGF0ZWRgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRMaWdodEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldExpZ2h0SW5mbycsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBsaWdodCBpbmZvJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0TGlnaHRzKF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnbGlzdExpZ2h0cycsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYgKCEocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gbGlzdCBsaWdodHMnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZUxpZ2h0Q29tcG9uZW50KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdyZW1vdmVMaWdodENvbXBvbmVudCcsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHJlbW92ZSBsaWdodCcpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnTGlnaHQgY29tcG9uZW50IHJlbW92ZWQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcbn1cclxuIl19