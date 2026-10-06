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
            return this.wrapSceneResult(result, 'Shadow settings updated');
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
            return this.wrapSceneResult(result, 'Fog settings updated');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    /**
     * `setShadowSettings`/`setFogSettings` now reject an invalid enum with
     * `{ success: false, error }` instead of writing it. Wrapping that in
     * `successResult` would hide the rejection behind a top-level
     * `success: true`, so unwrap a scene-reported failure into `errorResult`
     * instead of blindly forwarding it as data.
     */
    wrapSceneResult(result, successMessage) {
        if (result && result.success === false) {
            return (0, types_1.errorResult)(result.error || 'Scene operation failed');
        }
        return (0, types_1.successResult)(result, successMessage);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXJlbmRlci1waXBlbGluZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcmVuZGVyLXBpcGVsaW5lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBYSxvQkFBcUIsU0FBUSxpQ0FBYztJQUF4RDs7UUFDYSxTQUFJLEdBQUcsd0JBQXdCLENBQUM7UUFDaEMsZ0JBQVcsR0FBRywwTUFBME0sQ0FBQztRQUN6TixZQUFPLEdBQUcsQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLGtCQUFrQixDQUFDLENBQUM7UUFDakcsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxrQkFBa0IsQ0FBQztvQkFDNUYsV0FBVyxFQUFFLHFNQUFxTTtpQkFDck47Z0JBQ0QsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsZ0ZBQWdGLEVBQUU7Z0JBQzNILElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG1JQUFtSSxFQUFFO2dCQUMxSyxhQUFhLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxxREFBcUQsRUFBRTtnQkFDckcsUUFBUSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsa0RBQWtELEVBQUU7Z0JBQzdGLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLHFDQUFxQyxFQUFFO2dCQUNoRixNQUFNLEVBQUUsRUFBRSxJ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QUUsd0JBQXdCO2dCQUMxRCxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUM7YUFDbkMsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxFQUFFLCtCQUErQixDQUFDLENBQUM7UUFDbEUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQS9HRCxvREErR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVJlbmRlclBpcGVsaW5lIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3JlbmRlcl9waXBlbGluZSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHJlbmRlciBwaXBlbGluZSBzZXR0aW5ncyAoM0Qgb25seSkuIEFjdGlvbnM6IGdldF9pbmZvLCBzZXRfc2hhZG93LCBzZXRfZm9nLCBzZXRfc2t5Ym94LCBzZXRfYW1iaWVudCwgc2V0X3Bvc3RfcHJvY2Vzcy4gQ29udHJvbHMgc2hhZG93cywgZm9nLCBza3lib3gsIGFtYmllbnQgbGlnaHQsIGFuZCBwb3N0LXByb2Nlc3NpbmcgZWZmZWN0cy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2dldF9pbmZvJywgJ3NldF9zaGFkb3cnLCAnc2V0X2ZvZycsICdzZXRfc2t5Ym94JywgJ3NldF9hbWJpZW50JywgJ3NldF9wb3N0X3Byb2Nlc3MnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnc2V0X3NoYWRvdycsICdzZXRfZm9nJywgJ3NldF9za3lib3gnLCAnc2V0X2FtYmllbnQnLCAnc2V0X3Bvc3RfcHJvY2VzcyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBnZXRfaW5mbz1nZXQgcGlwZWxpbmUgc2V0dGluZ3MsIHNldF9zaGFkb3c9Y29uZmlndXJlIHNoYWRvd3MsIHNldF9mb2c9Y29uZmlndXJlIGZvZywgc2V0X3NreWJveD1jb25maWd1cmUgc2t5Ym94LCBzZXRfYW1iaWVudD1jb25maWd1cmUgYW1iaWVudCBsaWdodCwgc2V0X3Bvc3RfcHJvY2Vzcz1zZXQgcG9zdC1wcm9jZXNzaW5nJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVuYWJsZWQ6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ1tzZXRfc2hhZG93L3NldF9mb2cvc2V0X3NreWJveC9zZXRfcG9zdF9wcm9jZXNzXSBFbmFibGUgb3IgZGlzYWJsZSB0aGUgZmVhdHVyZScgfSxcbiAgICAgICAgICAgIHR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW3NldF9zaGFkb3ddIFNoYWRvdyB0eXBlIChTaGFkb3dUeXBlLlBsYW5hciBvciBTaGFkb3dUeXBlLlNoYWRvd01hcCkuIFtzZXRfZm9nXSBGb2cgdHlwZSAoRm9nVHlwZS5MSU5FQVIvRVhQL0VYUF9TUVVBUkVEL0xBWUVSRUQpJyB9LFxuICAgICAgICAgICAgc2hhZG93TWFwU2l6ZTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3NoYWRvd10gU2hhZG93IG1hcCBzaXplIChlLmcuIDUxMiwgMTAyNCwgMjA0OCknIH0sXG4gICAgICAgICAgICBmb2dDb2xvcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X2ZvZ10gRm9nIGNvbG9yIGFzIGhleCBzdHJpbmcgKGUuZy4gI0NDQ0NDQyknIH0sXG4gICAgICAgICAgICBmb2dTdGFydDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X2ZvZ10gTGluZWFyIGZvZyBzdGFydCBkaXN0YW5jZScgfSxcbiAgICAgICAgICAgIGZvZ0VuZDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X2ZvZ10gTGluZWFyIGZvZyBlbmQgZGlzdGFuY2UnIH0sXG4gICAgICAgICAgICBmb2dEZW5zaXR5OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfZm9nXSBFeHBvbmVudGlhbCBmb2cgZGVuc2l0eSAoMC0xKScgfSxcbiAgICAgICAgICAgIHVzZUhEUjogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3NldF9za3lib3hdIEVuYWJsZSBIRFIgc2t5Ym94JyB9LFxuICAgICAgICAgICAgcm90YXRpb25BbmdsZTogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3NreWJveF0gU2t5Ym94IHJvdGF0aW9uIGFuZ2xlIGluIGRlZ3JlZXMnIH0sXG4gICAgICAgICAgICBza3lDb2xvcjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X2FtYmllbnRdIFNreSAoYW1iaWVudCkgY29sb3IgYXMgaGV4IHN0cmluZyAoZS5nLiAjQ0NDQ0NDKScgfSxcbiAgICAgICAgICAgIGdyb3VuZEFsYmVkbzogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X2FtYmllbnRdIEdyb3VuZCBhbGJlZG8gY29sb3IgYXMgaGV4IHN0cmluZyAoZS5nLiAjNjY2NjY2KScgfSxcbiAgICAgICAgICAgIHNreUlsbHVtOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfYW1iaWVudF0gU2t5IGlsbHVtaW5hbmNlJyB9LFxuICAgICAgICAgICAgYmxvb206IHsgdHlwZTogJ29iamVjdCcsIGRlc2NyaXB0aW9uOiAnW3NldF9wb3N0X3Byb2Nlc3NdIEJsb29tIHNldHRpbmdzIHsgZW5hYmxlZDogYm9vbCwgaW50ZW5zaXR5OiBudW1iZXIgfScgfSxcbiAgICAgICAgICAgIHRvbmVtYXA6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW3NldF9wb3N0X3Byb2Nlc3NdIFRvbmVtYXAgbW9kZSAobm9uZS9hY2VzL2ZpbG1pYyknIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRJbmZvKGFyZ3MpLFxuICAgICAgICBzZXRfc2hhZG93OiAoYXJncykgPT4gdGhpcy5zZXRTaGFkb3coYXJncyksXG4gICAgICAgIHNldF9mb2c6IChhcmdzKSA9PiB0aGlzLnNldEZvZyhhcmdzKSxcbiAgICAgICAgc2V0X3NreWJveDogKGFyZ3MpID0+IHRoaXMuc2V0U2t5Ym94KGFyZ3MpLFxuICAgICAgICBzZXRfYW1iaWVudDogKGFyZ3MpID0+IHRoaXMuc2V0QW1iaWVudChhcmdzKSxcbiAgICAgICAgc2V0X3Bvc3RfcHJvY2VzczogKGFyZ3MpID0+IHRoaXMuc2V0UG9zdFByb2Nlc3MoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0SW5mbyhfYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldFJlbmRlclBpcGVsaW5lSW5mbycsIGFyZ3M6IFtdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFNoYWRvdyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0U2hhZG93U2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLmVuYWJsZWQsIGFyZ3MudHlwZSwgYXJncy5zaGFkb3dNYXBTaXplXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53cmFwU2NlbmVSZXN1bHQocmVzdWx0LCAnU2hhZG93IHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0Rm9nKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRGb2dTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuZW5hYmxlZCwgYXJncy5mb2dDb2xvciwgYXJncy50eXBlLCBhcmdzLmZvZ1N0YXJ0LCBhcmdzLmZvZ0VuZCwgYXJncy5mb2dEZW5zaXR5XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53cmFwU2NlbmVSZXN1bHQocmVzdWx0LCAnRm9nIHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBzZXRTaGFkb3dTZXR0aW5nc2AvYHNldEZvZ1NldHRpbmdzYCBub3cgcmVqZWN0IGFuIGludmFsaWQgZW51bSB3aXRoXG4gICAgICogYHsgc3VjY2VzczogZmFsc2UsIGVycm9yIH1gIGluc3RlYWQgb2Ygd3JpdGluZyBpdC4gV3JhcHBpbmcgdGhhdCBpblxuICAgICAqIGBzdWNjZXNzUmVzdWx0YCB3b3VsZCBoaWRlIHRoZSByZWplY3Rpb24gYmVoaW5kIGEgdG9wLWxldmVsXG4gICAgICogYHN1Y2Nlc3M6IHRydWVgLCBzbyB1bndyYXAgYSBzY2VuZS1yZXBvcnRlZCBmYWlsdXJlIGludG8gYGVycm9yUmVzdWx0YFxuICAgICAqIGluc3RlYWQgb2YgYmxpbmRseSBmb3J3YXJkaW5nIGl0IGFzIGRhdGEuXG4gICAgICovXG4gICAgcHJpdmF0ZSB3cmFwU2NlbmVSZXN1bHQocmVzdWx0OiBhbnksIHN1Y2Nlc3NNZXNzYWdlOiBzdHJpbmcpOiBBY3Rpb25Ub29sUmVzdWx0IHtcbiAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2VzcyA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ1NjZW5lIG9wZXJhdGlvbiBmYWlsZWQnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsIHN1Y2Nlc3NNZXNzYWdlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFNreWJveChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0U2t5Ym94U2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLmVuYWJsZWQsIGFyZ3MudXNlSERSLCBhcmdzLnJvdGF0aW9uQW5nbGVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgJ1NreWJveCBzZXR0aW5ncyB1cGRhdGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldEFtYmllbnQoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldEFtYmllbnRTZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Muc2t5Q29sb3IsIGFyZ3MuZ3JvdW5kQWxiZWRvLCBhcmdzLnNreUlsbHVtXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQsICdBbWJpZW50IHNldHRpbmdzIHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0UG9zdFByb2Nlc3MoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFBvc3RQcm9jZXNzU2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLmJsb29tLCBhcmdzLnRvbmVtYXBdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgJ1Bvc3QtcHJvY2VzcyBzZXR0aW5ncyB1cGRhdGVkJyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG59XG4iXX0=