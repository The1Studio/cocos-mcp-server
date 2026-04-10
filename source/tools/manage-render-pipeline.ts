import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageRenderPipeline extends BaseActionTool {
    readonly name = 'manage_render_pipeline';
    readonly description = 'Manage render pipeline settings (3D only). Actions: get_info, set_shadow, set_fog, set_skybox, set_post_process. Controls shadows, fog, skybox, ambient light, and post-processing effects.';
    readonly actions = ['get_info', 'set_shadow', 'set_fog', 'set_skybox', 'set_post_process'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getInfo(args),
        set_shadow: (args) => this.setShadow(args),
        set_fog: (args) => this.setFog(args),
        set_skybox: (args) => this.setSkybox(args),
        set_post_process: (args) => this.setPostProcess(args),
    };

    private async getInfo(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getRenderPipelineInfo', args: []
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setShadow(args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setShadowSettings',
                args: [args.enabled, args.type, args.shadowMapSize]
            });
            return successResult(result, 'Shadow settings updated');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setFog(args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setFogSettings',
                args: [args.enabled, args.fogColor, args.type, args.fogStart, args.fogEnd, args.fogDensity]
            });
            return successResult(result, 'Fog settings updated');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setSkybox(args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setSkyboxSettings',
                args: [args.enabled, args.useHDR, args.rotationAngle]
            });
            return successResult(result, 'Skybox settings updated');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setPostProcess(args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setPostProcessSettings',
                args: [args.bloom, args.tonemap]
            });
            return successResult(result, 'Post-process settings updated');
        } catch (err: any) { return errorResult(err.message); }
    }
}
