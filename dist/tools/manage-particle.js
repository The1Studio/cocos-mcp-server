"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageParticle = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageParticle extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_particle';
        this.description = 'Manage ParticleSystem components (3D and 2D). Actions: add, set_property, set_emission, set_shape, set_renderer, get_info, list, remove.';
        this.actions = ['add', 'set_property', 'set_emission', 'set_shape', 'set_renderer', 'get_info', 'list', 'remove'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'set_property', 'set_emission', 'set_shape', 'set_renderer', 'get_info', 'list', 'remove'],
                    description: 'Action: add=add ParticleSystem, set_property=set particle props, set_emission=emission rate/bursts, set_shape=emitter shape, set_renderer=render mode/material, get_info=get all props, list=list particle nodes, remove=remove component'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[add, set_property, set_emission, set_shape, set_renderer, get_info, remove] Target node UUID'
                },
                is2d: {
                    type: 'boolean',
                    description: '[add] Use ParticleSystem2D instead of 3D ParticleSystem (default: false)',
                    default: false
                },
                property: {
                    type: 'string',
                    enum: ['duration', 'startLifetime', 'startSpeed', 'startSize', 'startColor', 'loop', 'playOnAwake', 'maxParticles'],
                    description: '[set_property] Property name to set'
                },
                value: {
                    description: '[set_property] Property value'
                },
                rateOverTime: {
                    type: 'number',
                    description: '[set_emission] Emission rate per second'
                },
                bursts: {
                    type: 'array',
                    description: '[set_emission] Array of burst configs [{time, count}]',
                    items: { type: 'object', properties: { time: { type: 'number' }, count: { type: 'number' } } }
                },
                shapeType: {
                    type: 'string',
                    enum: ['cone', 'sphere', 'box'],
                    description: '[set_shape] Emitter shape type'
                },
                radius: {
                    type: 'number',
                    description: '[set_shape] Shape radius'
                },
                angle: {
                    type: 'number',
                    description: '[set_shape] Cone angle in degrees'
                },
                renderMode: {
                    type: 'number',
                    description: '[set_renderer] Render mode (0=billboard, 1=stretchedBillboard, 2=horizontalBillboard, 3=verticalBillboard, 4=mesh)'
                },
                materialUuid: {
                    type: 'string',
                    description: '[set_renderer] Material asset UUID'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            add: (args) => { var _a; return this.sceneCall('addParticleSystem', [args.nodeUuid, (_a = args.is2d) !== null && _a !== void 0 ? _a : false], 'nodeUuid'); },
            set_property: (args) => this.sceneCall('setParticleProperty', [args.nodeUuid, args.property, args.value], 'nodeUuid', 'property', 'value'),
            set_emission: (args) => this.sceneCall('setParticleEmission', [args.nodeUuid, args.rateOverTime, args.bursts], 'nodeUuid'),
            set_shape: (args) => this.sceneCall('setParticleShape', [args.nodeUuid, args.shapeType, args.radius, args.angle], 'nodeUuid'),
            set_renderer: (args) => this.sceneCall('setParticleRenderer', [args.nodeUuid, args.renderMode, args.materialUuid], 'nodeUuid'),
            get_info: (args) => this.sceneCall('getParticleInfo', [args.nodeUuid], 'nodeUuid'),
            list: (_args) => this.sceneCall('listParticleSystems', []),
            remove: (args) => this.sceneCall('removeParticleSystem', [args.nodeUuid], 'nodeUuid'),
        };
    }
    async sceneCall(method, methodArgs, ...required) {
        if (required.includes('nodeUuid') && !methodArgs[0])
            return (0, types_1.errorResult)('nodeUuid is required');
        if (required.includes('property') && !methodArgs[1])
            return (0, types_1.errorResult)('property is required');
        if (required.includes('value') && methodArgs[2] === undefined)
            return (0, types_1.errorResult)('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method, args: methodArgs
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(result.data, result.message) : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || `${method} failed`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageParticle = ManageParticle;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXBhcnRpY2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wYXJ0aWNsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsY0FBZSxTQUFRLGlDQUFjO0lBQWxEOztRQUNhLFNBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUN6QixnQkFBVyxHQUFHLDBJQUEwSSxDQUFDO1FBQ3pKLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM3RyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDO29CQUN4RyxXQUFXLEVBQUUsMk9BQTJPO2lCQUMzUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLCtGQUErRjtpQkFDL0c7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSwwRUFBMEU7b0JBQ3ZGLE9BQU8sRUFBRSxLQUFLO2lCQUNqQjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLGNBQWMsQ0FBQztvQkFDbkgsV0FBVyxFQUFFLHFDQUFxQztpQkFD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UyxDQUFDLENBQUM7UUFDL0osQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQXJGRCx3Q0FxRkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVBhcnRpY2xlIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3BhcnRpY2xlJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgUGFydGljbGVTeXN0ZW0gY29tcG9uZW50cyAoM0QgYW5kIDJEKS4gQWN0aW9uczogYWRkLCBzZXRfcHJvcGVydHksIHNldF9lbWlzc2lvbiwgc2V0X3NoYXBlLCBzZXRfcmVuZGVyZXIsIGdldF9pbmZvLCBsaXN0LCByZW1vdmUuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydhZGQnLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9lbWlzc2lvbicsICdzZXRfc2hhcGUnLCAnc2V0X3JlbmRlcmVyJywgJ2dldF9pbmZvJywgJ2xpc3QnLCAncmVtb3ZlJ107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FkZCcsICdzZXRfcHJvcGVydHknLCAnc2V0X2VtaXNzaW9uJywgJ3NldF9zaGFwZScsICdzZXRfcmVuZGVyZXInLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZW1vdmUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogYWRkPWFkZCBQYXJ0aWNsZVN5c3RlbSwgc2V0X3Byb3BlcnR5PXNldCBwYXJ0aWNsZSBwcm9wcywgc2V0X2VtaXNzaW9uPWVtaXNzaW9uIHJhdGUvYnVyc3RzLCBzZXRfc2hhcGU9ZW1pdHRlciBzaGFwZSwgc2V0X3JlbmRlcmVyPXJlbmRlciBtb2RlL21hdGVyaWFsLCBnZXRfaW5mbz1nZXQgYWxsIHByb3BzLCBsaXN0PWxpc3QgcGFydGljbGUgbm9kZXMsIHJlbW92ZT1yZW1vdmUgY29tcG9uZW50J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkLCBzZXRfcHJvcGVydHksIHNldF9lbWlzc2lvbiwgc2V0X3NoYXBlLCBzZXRfcmVuZGVyZXIsIGdldF9pbmZvLCByZW1vdmVdIFRhcmdldCBub2RlIFVVSUQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaXMyZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRdIFVzZSBQYXJ0aWNsZVN5c3RlbTJEIGluc3RlYWQgb2YgM0QgUGFydGljbGVTeXN0ZW0gKGRlZmF1bHQ6IGZhbHNlKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZHVyYXRpb24nLCAnc3RhcnRMaWZldGltZScsICdzdGFydFNwZWVkJywgJ3N0YXJ0U2l6ZScsICdzdGFydENvbG9yJywgJ2xvb3AnLCAncGxheU9uQXdha2UnLCAnbWF4UGFydGljbGVzJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lIHRvIHNldCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgdmFsdWUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmF0ZU92ZXJUaW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2VtaXNzaW9uXSBFbWlzc2lvbiByYXRlIHBlciBzZWNvbmQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYnVyc3RzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfZW1pc3Npb25dIEFycmF5IG9mIGJ1cnN0IGNvbmZpZ3MgW3t0aW1lLCBjb3VudH1dJyxcbiAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB0aW1lOiB7IHR5cGU6ICdudW1iZXInIH0sIGNvdW50OiB7IHR5cGU6ICdudW1iZXInIH0gfSB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2hhcGVUeXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydjb25lJywgJ3NwaGVyZScsICdib3gnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfc2hhcGVdIEVtaXR0ZXIgc2hhcGUgdHlwZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByYWRpdXM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfc2hhcGVdIFNoYXBlIHJhZGl1cydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhbmdsZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9zaGFwZV0gQ29uZSBhbmdsZSBpbiBkZWdyZWVzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlbmRlck1vZGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcmVuZGVyZXJdIFJlbmRlciBtb2RlICgwPWJpbGxib2FyZCwgMT1zdHJldGNoZWRCaWxsYm9hcmQsIDI9aG9yaXpvbnRhbEJpbGxib2FyZCwgMz12ZXJ0aWNhbEJpbGxib2FyZCwgND1tZXNoKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtYXRlcmlhbFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcmVuZGVyZXJdIE1hdGVyaWFsIGFzc2V0IFVVSUQnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBhZGQ6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnYWRkUGFydGljbGVTeXN0ZW0nLCBbYXJncy5ub2RlVXVpZCwgYXJncy5pczJkID8/IGZhbHNlXSwgJ25vZGVVdWlkJyksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2NlbmVDYWxsKCdzZXRQYXJ0aWNsZVByb3BlcnR5JywgW2FyZ3Mubm9kZVV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWVdLCAnbm9kZVV1aWQnLCAncHJvcGVydHknLCAndmFsdWUnKSxcbiAgICAgICAgc2V0X2VtaXNzaW9uOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ3NldFBhcnRpY2xlRW1pc3Npb24nLCBbYXJncy5ub2RlVXVpZCwgYXJncy5yYXRlT3ZlclRpbWUsIGFyZ3MuYnVyc3RzXSwgJ25vZGVVdWlkJyksXG4gICAgICAgIHNldF9zaGFwZTogKGFyZ3MpID0+IHRoaXMuc2NlbmVDYWxsKCdzZXRQYXJ0aWNsZVNoYXBlJywgW2FyZ3Mubm9kZVV1aWQsIGFyZ3Muc2hhcGVUeXBlLCBhcmdzLnJhZGl1cywgYXJncy5hbmdsZV0sICdub2RlVXVpZCcpLFxuICAgICAgICBzZXRfcmVuZGVyZXI6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnc2V0UGFydGljbGVSZW5kZXJlcicsIFthcmdzLm5vZGVVdWlkLCBhcmdzLnJlbmRlck1vZGUsIGFyZ3MubWF0ZXJpYWxVdWlkXSwgJ25vZGVVdWlkJyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ2dldFBhcnRpY2xlSW5mbycsIFthcmdzLm5vZGVVdWlkXSwgJ25vZGVVdWlkJyksXG4gICAgICAgIGxpc3Q6IChfYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ2xpc3RQYXJ0aWNsZVN5c3RlbXMnLCBbXSksXG4gICAgICAgIHJlbW92ZTogKGFyZ3MpID0+IHRoaXMuc2NlbmVDYWxsKCdyZW1vdmVQYXJ0aWNsZVN5c3RlbScsIFthcmdzLm5vZGVVdWlkXSwgJ25vZGVVdWlkJyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgc2NlbmVDYWxsKG1ldGhvZDogc3RyaW5nLCBtZXRob2RBcmdzOiBhbnlbXSwgLi4ucmVxdWlyZWQ6IHN0cmluZ1tdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmIChyZXF1aXJlZC5pbmNsdWRlcygnbm9kZVV1aWQnKSAmJiAhbWV0aG9kQXJnc1swXSkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBpZiAocmVxdWlyZWQuaW5jbHVkZXMoJ3Byb3BlcnR5JykgJiYgIW1ldGhvZEFyZ3NbMV0pIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgaWYgKHJlcXVpcmVkLmluY2x1ZGVzKCd2YWx1ZScpICYmIG1ldGhvZEFyZ3NbMl0gPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2QsIGFyZ3M6IG1ldGhvZEFyZ3NcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KT8uc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIChyZXN1bHQgYXMgYW55KS5tZXNzYWdlKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgYCR7bWV0aG9kfSBmYWlsZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cbn1cbiJdfQ==