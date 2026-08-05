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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXBhcnRpY2xlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wYXJ0aWNsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsY0FBZSxTQUFRLGlDQUFjO0lBQWxEOztRQUNhLFNBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUN6QixnQkFBVyxHQUFHLDBJQUEwSSxDQUFDO1FBQ3pKLFlBQU8sR0FBRyxDQUFDLEtBQUssRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM3RyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsY0FBYyxFQUFFLGNBQWMsRUFBRSxXQUFXLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDO29CQUN4RyxXQUFXLEVBQUUsMk9BQTJPO2lCQUMzUDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLCtGQUErRjtpQkFDL0c7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSwwRUFBMEU7b0JBQ3ZGLE9BQU8sRUFBRSxLQUFLO2lCQUNqQjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsYUFBYSxFQUFFLGNBQWMsQ0FBQztvQkFDbkgsV0FBVyxFQUFFLHFDQUFxQztpQkFD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UyxDQUFDLENBQUM7UUFDL0osQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQXJGRCx3Q0FxRkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZVBhcnRpY2xlIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcGFydGljbGUnO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIFBhcnRpY2xlU3lzdGVtIGNvbXBvbmVudHMgKDNEIGFuZCAyRCkuIEFjdGlvbnM6IGFkZCwgc2V0X3Byb3BlcnR5LCBzZXRfZW1pc3Npb24sIHNldF9zaGFwZSwgc2V0X3JlbmRlcmVyLCBnZXRfaW5mbywgbGlzdCwgcmVtb3ZlLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydhZGQnLCAnc2V0X3Byb3BlcnR5JywgJ3NldF9lbWlzc2lvbicsICdzZXRfc2hhcGUnLCAnc2V0X3JlbmRlcmVyJywgJ2dldF9pbmZvJywgJ2xpc3QnLCAncmVtb3ZlJ107XHJcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcclxuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2FkZCcsICdzZXRfcHJvcGVydHknLCAnc2V0X2VtaXNzaW9uJywgJ3NldF9zaGFwZScsICdzZXRfcmVuZGVyZXInLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZW1vdmUnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBhZGQ9YWRkIFBhcnRpY2xlU3lzdGVtLCBzZXRfcHJvcGVydHk9c2V0IHBhcnRpY2xlIHByb3BzLCBzZXRfZW1pc3Npb249ZW1pc3Npb24gcmF0ZS9idXJzdHMsIHNldF9zaGFwZT1lbWl0dGVyIHNoYXBlLCBzZXRfcmVuZGVyZXI9cmVuZGVyIG1vZGUvbWF0ZXJpYWwsIGdldF9pbmZvPWdldCBhbGwgcHJvcHMsIGxpc3Q9bGlzdCBwYXJ0aWNsZSBub2RlcywgcmVtb3ZlPXJlbW92ZSBjb21wb25lbnQnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZCwgc2V0X3Byb3BlcnR5LCBzZXRfZW1pc3Npb24sIHNldF9zaGFwZSwgc2V0X3JlbmRlcmVyLCBnZXRfaW5mbywgcmVtb3ZlXSBUYXJnZXQgbm9kZSBVVUlEJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBpczJkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRdIFVzZSBQYXJ0aWNsZVN5c3RlbTJEIGluc3RlYWQgb2YgM0QgUGFydGljbGVTeXN0ZW0gKGRlZmF1bHQ6IGZhbHNlKScsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2R1cmF0aW9uJywgJ3N0YXJ0TGlmZXRpbWUnLCAnc3RhcnRTcGVlZCcsICdzdGFydFNpemUnLCAnc3RhcnRDb2xvcicsICdsb29wJywgJ3BsYXlPbkF3YWtlJywgJ21heFBhcnRpY2xlcyddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lIHRvIHNldCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gUHJvcGVydHkgdmFsdWUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJhdGVPdmVyVGltZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfZW1pc3Npb25dIEVtaXNzaW9uIHJhdGUgcGVyIHNlY29uZCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYnVyc3RzOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2VtaXNzaW9uXSBBcnJheSBvZiBidXJzdCBjb25maWdzIFt7dGltZSwgY291bnR9XScsXHJcbiAgICAgICAgICAgICAgICBpdGVtczogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyB0aW1lOiB7IHR5cGU6ICdudW1iZXInIH0sIGNvdW50OiB7IHR5cGU6ICdudW1iZXInIH0gfSB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNoYXBlVHlwZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NvbmUnLCAnc3BoZXJlJywgJ2JveCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3NoYXBlXSBFbWl0dGVyIHNoYXBlIHR5cGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJhZGl1czoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfc2hhcGVdIFNoYXBlIHJhZGl1cydcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYW5nbGU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3NoYXBlXSBDb25lIGFuZ2xlIGluIGRlZ3JlZXMnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlbmRlck1vZGU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3JlbmRlcmVyXSBSZW5kZXIgbW9kZSAoMD1iaWxsYm9hcmQsIDE9c3RyZXRjaGVkQmlsbGJvYXJkLCAyPWhvcml6b250YWxCaWxsYm9hcmQsIDM9dmVydGljYWxCaWxsYm9hcmQsIDQ9bWVzaCknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG1hdGVyaWFsVXVpZDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcmVuZGVyZXJdIE1hdGVyaWFsIGFzc2V0IFVVSUQnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGFkZDogKGFyZ3MpID0+IHRoaXMuc2NlbmVDYWxsKCdhZGRQYXJ0aWNsZVN5c3RlbScsIFthcmdzLm5vZGVVdWlkLCBhcmdzLmlzMmQgPz8gZmFsc2VdLCAnbm9kZVV1aWQnKSxcclxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnc2V0UGFydGljbGVQcm9wZXJ0eScsIFthcmdzLm5vZGVVdWlkLCBhcmdzLnByb3BlcnR5LCBhcmdzLnZhbHVlXSwgJ25vZGVVdWlkJywgJ3Byb3BlcnR5JywgJ3ZhbHVlJyksXHJcbiAgICAgICAgc2V0X2VtaXNzaW9uOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ3NldFBhcnRpY2xlRW1pc3Npb24nLCBbYXJncy5ub2RlVXVpZCwgYXJncy5yYXRlT3ZlclRpbWUsIGFyZ3MuYnVyc3RzXSwgJ25vZGVVdWlkJyksXHJcbiAgICAgICAgc2V0X3NoYXBlOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ3NldFBhcnRpY2xlU2hhcGUnLCBbYXJncy5ub2RlVXVpZCwgYXJncy5zaGFwZVR5cGUsIGFyZ3MucmFkaXVzLCBhcmdzLmFuZ2xlXSwgJ25vZGVVdWlkJyksXHJcbiAgICAgICAgc2V0X3JlbmRlcmVyOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ3NldFBhcnRpY2xlUmVuZGVyZXInLCBbYXJncy5ub2RlVXVpZCwgYXJncy5yZW5kZXJNb2RlLCBhcmdzLm1hdGVyaWFsVXVpZF0sICdub2RlVXVpZCcpLFxyXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ2dldFBhcnRpY2xlSW5mbycsIFthcmdzLm5vZGVVdWlkXSwgJ25vZGVVdWlkJyksXHJcbiAgICAgICAgbGlzdDogKF9hcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnbGlzdFBhcnRpY2xlU3lzdGVtcycsIFtdKSxcclxuICAgICAgICByZW1vdmU6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgncmVtb3ZlUGFydGljbGVTeXN0ZW0nLCBbYXJncy5ub2RlVXVpZF0sICdub2RlVXVpZCcpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNjZW5lQ2FsbChtZXRob2Q6IHN0cmluZywgbWV0aG9kQXJnczogYW55W10sIC4uLnJlcXVpcmVkOiBzdHJpbmdbXSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmIChyZXF1aXJlZC5pbmNsdWRlcygnbm9kZVV1aWQnKSAmJiAhbWV0aG9kQXJnc1swXSkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmIChyZXF1aXJlZC5pbmNsdWRlcygncHJvcGVydHknKSAmJiAhbWV0aG9kQXJnc1sxXSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmIChyZXF1aXJlZC5pbmNsdWRlcygndmFsdWUnKSAmJiBtZXRob2RBcmdzWzJdID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kLCBhcmdzOiBtZXRob2RBcmdzXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSwgKHJlc3VsdCBhcyBhbnkpLm1lc3NhZ2UpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCBgJHttZXRob2R9IGZhaWxlZGApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxufVxyXG4iXX0=