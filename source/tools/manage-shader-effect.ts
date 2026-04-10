import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const UNLIT_EFFECT_TEMPLATE = `// Effect created by Cocos MCP Server
CCEffect %{
  techniques:
  - name: opaque
    passes:
    - vert: unlit-vs:vert
      frag: unlit-fs:frag
      properties: &props
        mainTexture: { value: white }
        mainColor: { value: [1, 1, 1, 1], editor: { type: color } }
}%

CCProgram unlit-vs %{
  precision highp float;
  #include <legacy/input>
  #include <builtin/uniforms/cc-global>
  #include <legacy/decode>
  #include <legacy/local-batch>
  in vec4 a_position;
  in vec2 a_texCoord;
  out vec2 v_uv;
  vec4 vert () {
    vec4 position;
    CCVertInput(position);
    mat4 matWorld;
    CCGetWorldMatrix(matWorld);
    v_uv = a_texCoord;
    return cc_matProj * (cc_matView * matWorld) * position;
  }
}%

CCProgram unlit-fs %{
  precision highp float;
  #include <legacy/output>
  in vec2 v_uv;
  uniform sampler2D mainTexture;
  uniform Constant { vec4 mainColor; };
  vec4 frag () {
    vec4 col = mainColor * texture(mainTexture, v_uv);
    return CCFragOutput(col);
  }
}%
`;

const STANDARD_EFFECT_TEMPLATE = `// Effect created by Cocos MCP Server
CCEffect %{
  techniques:
  - name: opaque
    passes:
    - vert: standard-vs:vert
      frag: standard-fs:frag
      properties: &props
        mainTexture:   { value: white }
        mainColor:     { value: [1, 1, 1, 1], editor: { type: color } }
        roughness:     { value: 0.8 }
        metallic:      { value: 0.0 }
}%

CCProgram standard-vs %{
  precision highp float;
  #include <legacy/input-standard>
  #include <builtin/uniforms/cc-global>
  #include <legacy/decode-standard>
  #include <legacy/local-batch>
  in vec4 a_position;
  in vec3 a_normal;
  in vec2 a_texCoord;
  out vec3 v_normal;
  out vec2 v_uv;
  vec4 vert () {
    vec4 position;
    CCVertInput(position);
    mat4 matWorld; mat3 matWorldIT;
    CCGetWorldMatrixFull(matWorld, matWorldIT);
    v_normal = normalize(matWorldIT * a_normal);
    v_uv = a_texCoord;
    return cc_matProj * (cc_matView * matWorld) * position;
  }
}%

CCProgram standard-fs %{
  precision highp float;
  #include <legacy/output-standard>
  in vec3 v_normal;
  in vec2 v_uv;
  uniform sampler2D mainTexture;
  uniform PBRParams { vec4 mainColor; float roughness; float metallic; };
  void surf (out StandardSurface s) {
    s.albedo = mainColor * texture(mainTexture, v_uv);
    s.normal = v_normal;
    s.roughness = roughness;
    s.metallic = metallic;
    s.emissive = vec3(0.0);
    s.occlusion = 1.0;
  }
  vec4 frag () { return CCStandardShadingBase(surf, gl_FragCoord); }
}%
`;

export class ManageShaderEffect extends BaseActionTool {
    readonly name = 'manage_shader_effect';
    readonly description = 'Manage shader effect assets (.effect files). Actions: list, get_info, get_passes, set_pass_property, create. Pure asset-db operations — no scene required.';
    readonly actions = ['list', 'get_info', 'get_passes', 'set_pass_property', 'create'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'get_info', 'get_passes', 'set_pass_property', 'create'],
                description: 'Action: list=list .effect files, get_info=get effect asset info, get_passes=get pass details, set_pass_property=set pass property, create=create from template'
            },
            url: { type: 'string', description: '[get_info/get_passes/set_pass_property/create] Asset DB URL (e.g., db://assets/shaders/MyEffect.effect)' },
            pattern: { type: 'string', description: '[list] Glob pattern (default: db://assets/**/*.effect)', default: 'db://assets/**/*.effect' },
            techniqueIndex: { type: 'number', description: '[get_passes/set_pass_property] Technique index (default: 0)', default: 0 },
            passIndex: { type: 'number', description: '[set_pass_property] Pass index (default: 0)', default: 0 },
            property: { type: 'string', description: '[set_pass_property] Property name to set' },
            value: { description: '[set_pass_property] Property value to set' },
            template: { type: 'string', enum: ['unlit', 'standard'], description: '[create] Effect template: unlit=basic unlit shader, standard=PBR shader', default: 'unlit' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        list: (args) => this.listEffects(args),
        get_info: (args) => this.getInfo(args),
        get_passes: (args) => this.getPasses(args),
        set_pass_property: (args) => this.setPassProperty(args),
        create: (args) => this.createEffect(args),
    };

    private async listEffects(args: any): Promise<ActionToolResult> {
        try {
            const pattern = args.pattern || 'db://assets/**/*.effect';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return successResult({ effects: assets, count: (assets as any[]).length });
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            let meta: any = null;
            try { meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url); } catch { /* optional */ }
            return successResult({ info, meta });
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getPasses(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for get_passes');
            const meta: any = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            const techniqueIndex = args.techniqueIndex ?? 0;
            const techniques = meta?.userData?.techniqueNames || meta?.techniques || [];
            return successResult({ url: args.url, techniqueIndex, techniques, raw: meta });
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setPassProperty(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for set_pass_property');
            if (!args.property) return errorResult('property is required for set_pass_property');
            if (args.value === undefined) return errorResult('value is required for set_pass_property');
            const meta: any = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            const ti = args.techniqueIndex ?? 0;
            const pi = args.passIndex ?? 0;
            if (meta?.userData?.techniques?.[ti]?.passes?.[pi]) {
                meta.userData.techniques[ti].passes[pi][args.property] = args.value;
                await Editor.Message.request('asset-db', 'save-asset-meta', args.url, meta);
            }
            return successResult({ url: args.url, techniqueIndex: ti, passIndex: pi, property: args.property, value: args.value }, 'Pass property updated');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async createEffect(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for create');
            const template = args.template === 'standard' ? STANDARD_EFFECT_TEMPLATE : UNLIT_EFFECT_TEMPLATE;
            const result = await Editor.Message.request('asset-db', 'create-asset', args.url, template);
            return successResult({ url: args.url, uuid: (result as any)?.uuid, template: args.template || 'unlit' }, `Effect created at ${args.url}`);
        } catch (err: any) { return errorResult(err.message); }
    }
}
