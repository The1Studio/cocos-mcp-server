"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageRenderPipeline = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageRenderPipeline extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_render_pipeline';
        this.description = 'Manage render pipeline settings (3D only). Actions: get_info, set_shadow, set_fog, set_skybox, set_post_process. Controls shadows, fog, skybox, ambient light, and post-processing effects.';
        this.actions = ['get_info', 'set_shadow', 'set_fog', 'set_skybox', 'set_post_process'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'set_shadow', 'set_fog', 'set_skybox', 'set_post_process'],
                    description: 'Action: get_info=get pipeline settings, set_shadow=configure shadows, set_fog=configure fog, set_skybox=configure skybox, set_post_process=set post-processing'
                },
                enabled: { type: 'boolean', description: '[set_shadow/set_fog/set_skybox/set_post_process] Enable or disable the feature' },
                type: { type: 'string', description: '[set_shadow] Shadow type (ShadowType.Planar or ShadowType.ShadowMap). [set_fog] Fog type (FogType.LINEAR/EXP/EXP_SQUARED/LAYERED)' },
                shadowMapSize: { type: 'number', description: '[set_shadow] Shadow map size (e.g. 512, 1024, 2048)' },
                fogColor: { type: 'string', description: '[set_fog] Fog color as hex string (e.g. #CCCCCC)' },
                fogStart: { type: 'number', description: '[set_fog] Linear fog start distance' },
                fogEnd: { type: 'number', description: '[set_fog] Linear fog end distance' },
                fogDensity: { type: 'number', description: '[set_fog] Exponential fog density (0-1)' },
                useHDR: { type: 'boolean', description: '[set_skybox] Enable HDR skybox' },
                rotationAngle: { type: 'number', description: '[set_skybox] Skybox rotation angle in degrees' },
                bloom: { type: 'object', description: '[set_post_process] Bloom settings { enabled: bool, intensity: number }' },
                tonemap: { type: 'string', description: '[set_post_process] Tonemap mode (none/aces/filmic)' }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getInfo(args),
            set_shadow: (args) => this.setShadow(args),
            set_fog: (args) => this.setFog(args),
            set_skybox: (args) => this.setSkybox(args),
            set_post_process: (args) => this.setPostProcess(args),
        };
    }
    async getInfo(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getRenderPipelineInfo', args: []
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setShadow(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setShadowSettings',
                args: [args.enabled, args.type, args.shadowMapSize]
            });
            return (0, types_1.successResult)(result, 'Shadow settings updated');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setFog(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setFogSettings',
                args: [args.enabled, args.fogColor, args.type, args.fogStart, args.fogEnd, args.fogDensity]
            });
            return (0, types_1.successResult)(result, 'Fog settings updated');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setSkybox(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSkyboxSettings',
                args: [args.enabled, args.useHDR, args.rotationAngle]
            });
            return (0, types_1.successResult)(result, 'Skybox settings updated');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setPostProcess(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setPostProcessSettings',
                args: [args.bloom, args.tonemap]
            });
            return (0, types_1.successResult)(result, 'Post-process settings updated');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageRenderPipeline = ManageRenderPipeline;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXJlbmRlci1waXBlbGluZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcmVuZGVyLXBpcGVsaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBYSxvQkFBcUIsU0FBUSxpQ0FBYztJQUF4RDs7UUFDYSxTQUFJLEdBQUcsd0JBQXdCLENBQUM7UUFDaEMsZ0JBQVcsR0FBRyw2TEFBNkwsQ0FBQztRQUM1TSxZQUFPLEdBQUcsQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUNsRixnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsa0JBQWtCLENBQUM7b0JBQzdFLFdBQVcsRUFBRSxnS0FBZ0s7aUJBQ2hMO2dCQUNELE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLGdGQUFnRixFQUFFO2dCQUMzSCxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxtSUFBbUksRUFBRTtnQkFDMUssYUFBYSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUscURBQXFELEVBQUU7Z0JBQ3JHLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtEQUFrRCxFQUFFO2dCQUM3RixRQUFRLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxxQ0FBcUMsRUFBRTtnQkFDaEYsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxX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QUFDLE9BQU8sQ0FBQzthQUNuQyxDQUFDLENBQUM7WUFDSCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLEVBQUUsK0JBQStCLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBbkZELG9EQW1GQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlUmVuZGVyUGlwZWxpbmUgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcmVuZGVyX3BpcGVsaW5lJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgcmVuZGVyIHBpcGVsaW5lIHNldHRpbmdzICgzRCBvbmx5KS4gQWN0aW9uczogZ2V0X2luZm8sIHNldF9zaGFkb3csIHNldF9mb2csIHNldF9za3lib3gsIHNldF9wb3N0X3Byb2Nlc3MuIENvbnRyb2xzIHNoYWRvd3MsIGZvZywgc2t5Ym94LCBhbWJpZW50IGxpZ2h0LCBhbmQgcG9zdC1wcm9jZXNzaW5nIGVmZmVjdHMuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydnZXRfaW5mbycsICdzZXRfc2hhZG93JywgJ3NldF9mb2cnLCAnc2V0X3NreWJveCcsICdzZXRfcG9zdF9wcm9jZXNzJ107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2dldF9pbmZvJywgJ3NldF9zaGFkb3cnLCAnc2V0X2ZvZycsICdzZXRfc2t5Ym94JywgJ3NldF9wb3N0X3Byb2Nlc3MnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogZ2V0X2luZm89Z2V0IHBpcGVsaW5lIHNldHRpbmdzLCBzZXRfc2hhZG93PWNvbmZpZ3VyZSBzaGFkb3dzLCBzZXRfZm9nPWNvbmZpZ3VyZSBmb2csIHNldF9za3lib3g9Y29uZmlndXJlIHNreWJveCwgc2V0X3Bvc3RfcHJvY2Vzcz1zZXQgcG9zdC1wcm9jZXNzaW5nJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVuYWJsZWQ6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ1tzZXRfc2hhZG93L3NldF9mb2cvc2V0X3NreWJveC9zZXRfcG9zdF9wcm9jZXNzXSBFbmFibGUgb3IgZGlzYWJsZSB0aGUgZmVhdHVyZScgfSxcbiAgICAgICAgICAgIHR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW3NldF9zaGFkb3ddIFNoYWRvdyB0eXBlIChTaGFkb3dUeXBlLlBsYW5hciBvciBTaGFkb3dUeXBlLlNoYWRvd01hcCkuIFtzZXRfZm9nXSBGb2cgdHlwZSAoRm9nVHlwZS5MSU5FQVIvRVhQL0VYUF9TUVVBUkVEL0xBWUVSRUQpJyB9LFxuICAgICAgICAgICAgc2hhZG93TWFwU2l6ZTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3NoYWRvd10gU2hhZG93IG1hcCBzaXplIChlLmcuIDUxMiwgMTAyNCwgMjA0OCknIH0sXG4gICAgICAgICAgICBmb2dDb2xvcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X2ZvZ10gRm9nIGNvbG9yIGFzIGhleCBzdHJpbmcgKGUuZy4gI0NDQ0NDQyknIH0sXG4gICAgICAgICAgICBmb2dTdGFydDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X2ZvZ10gTGluZWFyIGZvZyBzdGFydCBkaXN0YW5jZScgfSxcbiAgICAgICAgICAgIGZvZ0VuZDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X2ZvZ10gTGluZWFyIGZvZyBlbmQgZGlzdGFuY2UnIH0sXG4gICAgICAgICAgICBmb2dEZW5zaXR5OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfZm9nXSBFeHBvbmVudGlhbCBmb2cgZGVuc2l0eSAoMC0xKScgfSxcbiAgICAgICAgICAgIHVzZUhEUjogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3NldF9za3lib3hdIEVuYWJsZSBIRFIgc2t5Ym94JyB9LFxuICAgICAgICAgICAgcm90YXRpb25BbmdsZTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3NreWJveF0gU2t5Ym94IHJvdGF0aW9uIGFuZ2xlIGluIGRlZ3JlZXMnIH0sXG4gICAgICAgICAgICBibG9vbTogeyB0eXBlOiAnb2JqZWN0JywgZGVzY3JpcHRpb246ICdbc2V0X3Bvc3RfcHJvY2Vzc10gQmxvb20gc2V0dGluZ3MgeyBlbmFibGVkOiBib29sLCBpbnRlbnNpdHk6IG51bWJlciB9JyB9LFxuICAgICAgICAgICAgdG9uZW1hcDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X3Bvc3RfcHJvY2Vzc10gVG9uZW1hcCBtb2RlIChub25lL2FjZXMvZmlsbWljKScgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldEluZm8oYXJncyksXG4gICAgICAgIHNldF9zaGFkb3c6IChhcmdzKSA9PiB0aGlzLnNldFNoYWRvdyhhcmdzKSxcbiAgICAgICAgc2V0X2ZvZzogKGFyZ3MpID0+IHRoaXMuc2V0Rm9nKGFyZ3MpLFxuICAgICAgICBzZXRfc2t5Ym94OiAoYXJncykgPT4gdGhpcy5zZXRTa3lib3goYXJncyksXG4gICAgICAgIHNldF9wb3N0X3Byb2Nlc3M6IChhcmdzKSA9PiB0aGlzLnNldFBvc3RQcm9jZXNzKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEluZm8oX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRSZW5kZXJQaXBlbGluZUluZm8nLCBhcmdzOiBbXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTaGFkb3coYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFNoYWRvd1NldHRpbmdzJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5lbmFibGVkLCBhcmdzLnR5cGUsIGFyZ3Muc2hhZG93TWFwU2l6ZV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCAnU2hhZG93IHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Rm9nKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRGb2dTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuZW5hYmxlZCwgYXJncy5mb2dDb2xvciwgYXJncy50eXBlLCBhcmdzLmZvZ1N0YXJ0LCBhcmdzLmZvZ0VuZCwgYXJncy5mb2dEZW5zaXR5XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsICdGb2cgc2V0dGluZ3MgdXBkYXRlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTa3lib3goYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFNreWJveFNldHRpbmdzJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5lbmFibGVkLCBhcmdzLnVzZUhEUiwgYXJncy5yb3RhdGlvbkFuZ2xlXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsICdTa3lib3ggc2V0dGluZ3MgdXBkYXRlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQb3N0UHJvY2VzcyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0UG9zdFByb2Nlc3NTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuYmxvb20sIGFyZ3MudG9uZW1hcF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCAnUG9zdC1wcm9jZXNzIHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cbn1cbiJdfQ==