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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1saWdodC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsV0FBWSxTQUFRLGlDQUFjO0lBQS9DOztRQUNhLFNBQUksR0FBRyxjQUFjLENBQUM7UUFDdEIsZ0JBQVcsR0FBRyxtTUFBbU0sQ0FBQztRQUNsTixZQUFPLEdBQUcsQ0FBQyxLQUFLLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDaEUsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsS0FBSyxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztvQkFDM0QsV0FBVyxFQUFFLGdKQUFnSjtpQkFDaEs7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx3REFBd0Q7aUJBQ3hFO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQztvQkFDdkMsV0FBVyxFQUFFLG9GQUFvRjtpQkFDcEc7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILFdBQVcsRUFBRSxxRkFBcUY7aUJBQ3JHO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMkNBQTJDO2lCQUMzRDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FB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QUFDLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxPQUFPLENBQUE7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQyxNQUFjLGFBQWQsTUFBTSx1QkFBTixNQUFNLENBQVUsS0FBSyxLQUFJLHdCQUF3QixDQUFDLENBQUM7WUFDdEcsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLHlCQUF5QixDQUFDLENBQUM7UUFDMUQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQTdHRCxrQ0E2R0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZUxpZ2h0IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2xpZ2h0JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgbGlnaHQgY29tcG9uZW50cyBpbiBzY2VuZS4gQWN0aW9uczogYWRkPWFkZCBsaWdodCB0byBub2RlLCBzZXRfcHJvcGVydHk9c2V0IGxpZ2h0IHByb3BlcnR5LCBnZXRfaW5mbz1nZXQgbGlnaHQgaW5mbyBvbiBub2RlLCBsaXN0PWxpc3QgYWxsIGxpZ2h0cyBpbiBzY2VuZSwgcmVtb3ZlPXJlbW92ZSBsaWdodCBmcm9tIG5vZGUuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydhZGQnLCAnc2V0X3Byb3BlcnR5JywgJ2dldF9pbmZvJywgJ2xpc3QnLCAncmVtb3ZlJ107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FkZCcsICdzZXRfcHJvcGVydHknLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZW1vdmUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogYWRkPWFkZCBsaWdodCBjb21wb25lbnQsIHNldF9wcm9wZXJ0eT1zZXQgbGlnaHQgcHJvcGVydHksIGdldF9pbmZvPWdldCBsaWdodCBpbmZvLCBsaXN0PWxpc3QgYWxsIGxpZ2h0cywgcmVtb3ZlPXJlbW92ZSBsaWdodCBjb21wb25lbnQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGQsIHNldF9wcm9wZXJ0eSwgZ2V0X2luZm8sIHJlbW92ZV0gVGFyZ2V0IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydkaXJlY3Rpb25hbCcsICdzcGhlcmUnLCAnc3BvdCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF0gTGlnaHQgdHlwZTogZGlyZWN0aW9uYWw9RGlyZWN0aW9uYWxMaWdodCwgc3BoZXJlPVNwaGVyZUxpZ2h0LCBzcG90PVNwb3RMaWdodCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb2xvcjoge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZCwgc2V0X3Byb3BlcnR5XSBMaWdodCBjb2xvciBhcyBoZXggc3RyaW5nIFwiI1JSR0dCQlwiIG9yIG9iamVjdCB7cixnLGIsYX0gKDAtMjU1KSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbnRlbnNpdHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGQsIHNldF9wcm9wZXJ0eV0gTGlnaHQgaW50ZW5zaXR5IHZhbHVlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydjb2xvcicsICdpbnRlbnNpdHknLCAncmFuZ2UnLCAnc3BvdEFuZ2xlJywgJ3NoYWRvd0VuYWJsZWQnLCAnc2hhZG93QmlhcyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gTGlnaHQgcHJvcGVydHkgdG8gc2V0J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBWYWx1ZSB0byBzZXQgZm9yIHRoZSBwcm9wZXJ0eSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGFkZDogKGFyZ3MpID0+IHRoaXMuYWRkTGlnaHQoYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TGlnaHRQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldExpZ2h0SW5mbyhhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdExpZ2h0cyhhcmdzKSxcbiAgICAgICAgcmVtb3ZlOiAoYXJncykgPT4gdGhpcy5yZW1vdmVMaWdodENvbXBvbmVudChhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRMaWdodChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBhZGQnKTtcbiAgICAgICAgaWYgKCFhcmdzLnR5cGUpIHJldHVybiBlcnJvclJlc3VsdCgndHlwZSBpcyByZXF1aXJlZCBmb3IgYWRkIChkaXJlY3Rpb25hbC9zcGhlcmUvc3BvdCknKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnYWRkTGlnaHRDb21wb25lbnQnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnR5cGUsIGFyZ3MuY29sb3IsIGFyZ3MuaW50ZW5zaXR5XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBhZGQgbGlnaHQnKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCBgJHthcmdzLnR5cGV9IGxpZ2h0IGFkZGVkIHRvIG5vZGVgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0TGlnaHRQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCcpO1xuICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldExpZ2h0UHJvcGVydHknLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBzZXQgcHJvcGVydHknKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBMaWdodCBwcm9wZXJ0eSAnJHthcmdzLnByb3BlcnR5fScgdXBkYXRlZGApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRMaWdodEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRMaWdodEluZm8nLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBnZXQgbGlnaHQgaW5mbycpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0TGlnaHRzKF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnbGlzdExpZ2h0cycsXG4gICAgICAgICAgICAgICAgYXJnczogW11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKCEocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gbGlzdCBsaWdodHMnKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVtb3ZlTGlnaHRDb21wb25lbnQoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdyZW1vdmVMaWdodENvbXBvbmVudCcsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHJlbW92ZSBsaWdodCcpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ0xpZ2h0IGNvbXBvbmVudCByZW1vdmVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG59XG4iXX0=