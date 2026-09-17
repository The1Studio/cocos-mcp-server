"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageRenderPipeline = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageRenderPipeline extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_render_pipeline';
        this.description = 'Manage render pipeline settings (3D only). Actions: get_info, set_shadow, set_fog, set_skybox, set_ambient, set_post_process. Controls shadows, fog, skybox, ambient light, and post-processing effects.';
        this.actions = ['get_info', 'set_shadow', 'set_fog', 'set_skybox', 'set_ambient', 'set_post_process'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'set_shadow', 'set_fog', 'set_skybox', 'set_ambient', 'set_post_process'],
                    description: 'Action: get_info=get pipeline settings, set_shadow=configure shadows, set_fog=configure fog, set_skybox=configure skybox, set_ambient=configure ambient light, set_post_process=set post-processing'
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
                skyColor: { type: 'string', description: '[set_ambient] Sky (ambient) color as hex string (e.g. #CCCCCC)' },
                groundAlbedo: { type: 'string', description: '[set_ambient] Ground albedo color as hex string (e.g. #666666)' },
                skyIllum: { type: 'number', description: '[set_ambient] Sky illuminance' },
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
            set_ambient: (args) => this.setAmbient(args),
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
    async setAmbient(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setAmbientSettings',
                args: [args.skyColor, args.groundAlbedo, args.skyIllum]
            });
            return (0, types_1.successResult)(result, 'Ambient settings updated');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXJlbmRlci1waXBlbGluZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcmVuZGVyLXBpcGVsaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBYSxvQkFBcUIsU0FBUSxpQ0FBYztJQUF4RDs7UUFDYSxTQUFJLEdBQUcsd0JBQXdCLENBQUM7UUFDaEMsZ0JBQVcsR0FBRywwTUFBME0sQ0FBQztRQUN6TixZQUFPLEdBQUcsQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDakcsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxrQkFBa0IsQ0FBQztvQkFDNUYsV0FBVyxFQUFFLHFNQUFxTTtpQkFDck47Z0JBQ0QsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsZ0ZBQWdGLEVBQUU7Z0JBQzNILElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG1JQUFtSSxFQUFFO2dCQUMxSyxhQUFhLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxxREFBcUQsRUFBRTtnQkFDckcsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsa0RBQWtELEVBQUU7Z0JBQzdGLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLHFDQUFxQyxFQUFFO2dCQUNoRixNQUFNLEVBQUUsRUFBRSxJ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QztDQUNKO0FBakdELG9EQWlHQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlUmVuZGVyUGlwZWxpbmUgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcmVuZGVyX3BpcGVsaW5lJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgcmVuZGVyIHBpcGVsaW5lIHNldHRpbmdzICgzRCBvbmx5KS4gQWN0aW9uczogZ2V0X2luZm8sIHNldF9zaGFkb3csIHNldF9mb2csIHNldF9za3lib3gsIHNldF9hbWJpZW50LCBzZXRfcG9zdF9wcm9jZXNzLiBDb250cm9scyBzaGFkb3dzLCBmb2csIHNreWJveCwgYW1iaWVudCBsaWdodCwgYW5kIHBvc3QtcHJvY2Vzc2luZyBlZmZlY3RzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0X2luZm8nLCAnc2V0X3NoYWRvdycsICdzZXRfZm9nJywgJ3NldF9za3lib3gnLCAnc2V0X2FtYmllbnQnLCAnc2V0X3Bvc3RfcHJvY2VzcyddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZXRfaW5mbycsICdzZXRfc2hhZG93JywgJ3NldF9mb2cnLCAnc2V0X3NreWJveCcsICdzZXRfYW1iaWVudCcsICdzZXRfcG9zdF9wcm9jZXNzJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IGdldF9pbmZvPWdldCBwaXBlbGluZSBzZXR0aW5ncywgc2V0X3NoYWRvdz1jb25maWd1cmUgc2hhZG93cywgc2V0X2ZvZz1jb25maWd1cmUgZm9nLCBzZXRfc2t5Ym94PWNvbmZpZ3VyZSBza3lib3gsIHNldF9hbWJpZW50PWNvbmZpZ3VyZSBhbWJpZW50IGxpZ2h0LCBzZXRfcG9zdF9wcm9jZXNzPXNldCBwb3N0LXByb2Nlc3NpbmcnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZW5hYmxlZDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3NldF9zaGFkb3cvc2V0X2ZvZy9zZXRfc2t5Ym94L3NldF9wb3N0X3Byb2Nlc3NdIEVuYWJsZSBvciBkaXNhYmxlIHRoZSBmZWF0dXJlJyB9LFxuICAgICAgICAgICAgdHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X3NoYWRvd10gU2hhZG93IHR5cGUgKFNoYWRvd1R5cGUuUGxhbmFyIG9yIFNoYWRvd1R5cGUuU2hhZG93TWFwKS4gW3NldF9mb2ddIEZvZyB0eXBlIChGb2dUeXBlLkxJTkVBUi9FWFAvRVhQX1NRVUFSRUQvTEFZRVJFRCknIH0sXG4gICAgICAgICAgICBzaGFkb3dNYXBTaXplOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfc2hhZG93XSBTaGFkb3cgbWFwIHNpemUgKGUuZy4gNTEyLCAxMDI0LCAyMDQ4KScgfSxcbiAgICAgICAgICAgIGZvZ0NvbG9yOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tzZXRfZm9nXSBGb2cgY29sb3IgYXMgaGV4IHN0cmluZyAoZS5nLiAjQ0NDQ0NDKScgfSxcbiAgICAgICAgICAgIGZvZ1N0YXJ0OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfZm9nXSBMaW5lYXIgZm9nIHN0YXJ0IGRpc3RhbmNlJyB9LFxuICAgICAgICAgICAgZm9nRW5kOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfZm9nXSBMaW5lYXIgZm9nIGVuZCBkaXN0YW5jZScgfSxcbiAgICAgICAgICAgIGZvZ0RlbnNpdHk6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF9mb2ddIEV4cG9uZW50aWFsIGZvZyBkZW5zaXR5ICgwLTEpJyB9LFxuICAgICAgICAgICAgdXNlSERSOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3NreWJveF0gRW5hYmxlIEhEUiBza3lib3gnIH0sXG4gICAgICAgICAgICByb3RhdGlvbkFuZ2xlOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfc2t5Ym94XSBTa3lib3ggcm90YXRpb24gYW5nbGUgaW4gZGVncmVlcycgfSxcbiAgICAgICAgICAgIHNreUNvbG9yOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tzZXRfYW1iaWVudF0gU2t5IChhbWJpZW50KSBjb2xvciBhcyBoZXggc3RyaW5nIChlLmcuICNDQ0NDQ0MpJyB9LFxuICAgICAgICAgICAgZ3JvdW5kQWxiZWRvOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tzZXRfYW1iaWVudF0gR3JvdW5kIGFsYmVkbyBjb2xvciBhcyBoZXggc3RyaW5nIChlLmcuICM2NjY2NjYpJyB9LFxuICAgICAgICAgICAgc2t5SWxsdW06IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF9hbWJpZW50XSBTa3kgaWxsdW1pbmFuY2UnIH0sXG4gICAgICAgICAgICBibG9vbTogeyB0eXBlOiAnb2JqZWN0JywgZGVzY3JpcHRpb246ICdbc2V0X3Bvc3RfcHJvY2Vzc10gQmxvb20gc2V0dGluZ3MgeyBlbmFibGVkOiBib29sLCBpbnRlbnNpdHk6IG51bWJlciB9JyB9LFxuICAgICAgICAgICAgdG9uZW1hcDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X3Bvc3RfcHJvY2Vzc10gVG9uZW1hcCBtb2RlIChub25lL2FjZXMvZmlsbWljKScgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldEluZm8oYXJncyksXG4gICAgICAgIHNldF9zaGFkb3c6IChhcmdzKSA9PiB0aGlzLnNldFNoYWRvdyhhcmdzKSxcbiAgICAgICAgc2V0X2ZvZzogKGFyZ3MpID0+IHRoaXMuc2V0Rm9nKGFyZ3MpLFxuICAgICAgICBzZXRfc2t5Ym94OiAoYXJncykgPT4gdGhpcy5zZXRTa3lib3goYXJncyksXG4gICAgICAgIHNldF9hbWJpZW50OiAoYXJncykgPT4gdGhpcy5zZXRBbWJpZW50KGFyZ3MpLFxuICAgICAgICBzZXRfcG9zdF9wcm9jZXNzOiAoYXJncykgPT4gdGhpcy5zZXRQb3N0UHJvY2VzcyhhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJbmZvKF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0UmVuZGVyUGlwZWxpbmVJbmZvJywgYXJnczogW11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0U2hhZG93KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRTaGFkb3dTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuZW5hYmxlZCwgYXJncy50eXBlLCBhcmdzLnNoYWRvd01hcFNpemVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgJ1NoYWRvdyBzZXR0aW5ncyB1cGRhdGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldEZvZyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0Rm9nU2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLmVuYWJsZWQsIGFyZ3MuZm9nQ29sb3IsIGFyZ3MudHlwZSwgYXJncy5mb2dTdGFydCwgYXJncy5mb2dFbmQsIGFyZ3MuZm9nRGVuc2l0eV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCAnRm9nIHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0U2t5Ym94KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRTa3lib3hTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuZW5hYmxlZCwgYXJncy51c2VIRFIsIGFyZ3Mucm90YXRpb25BbmdsZV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCAnU2t5Ym94IHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0QW1iaWVudChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0QW1iaWVudFNldHRpbmdzJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5za3lDb2xvciwgYXJncy5ncm91bmRBbGJlZG8sIGFyZ3Muc2t5SWxsdW1dXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgJ0FtYmllbnQgc2V0dGluZ3MgdXBkYXRlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQb3N0UHJvY2VzcyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0UG9zdFByb2Nlc3NTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuYmxvb20sIGFyZ3MudG9uZW1hcF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCAnUG9zdC1wcm9jZXNzIHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cbn1cbiJdfQ==