"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageShaderEffect = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
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
class ManageShaderEffect extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_shader_effect';
        this.description = 'Manage shader effect assets (.effect files). Actions: list, get_info, get_passes, set_pass_property, create. Pure asset-db operations — no scene required.';
        this.actions = ['list', 'get_info', 'get_passes', 'set_pass_property', 'create'];
        this.inputSchema = {
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
        this.actionHandlers = {
            list: (args) => this.listEffects(args),
            get_info: (args) => this.getInfo(args),
            get_passes: (args) => this.getPasses(args),
            set_pass_property: (args) => this.setPassProperty(args),
            create: (args) => this.createEffect(args),
        };
    }
    async listEffects(args) {
        try {
            const pattern = args.pattern || 'db://assets/**/*.effect';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return (0, types_1.successResult)({ effects: assets, count: assets.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getInfo(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            let meta = null;
            try {
                meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            }
            catch ( /* optional */_a) { /* optional */ }
            return (0, types_1.successResult)({ info, meta });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getPasses(args) {
        var _a, _b;
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for get_passes');
            const meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            const techniqueIndex = (_a = args.techniqueIndex) !== null && _a !== void 0 ? _a : 0;
            const techniques = ((_b = meta === null || meta === void 0 ? void 0 : meta.userData) === null || _b === void 0 ? void 0 : _b.techniqueNames) || (meta === null || meta === void 0 ? void 0 : meta.techniques) || [];
            return (0, types_1.successResult)({ url: args.url, techniqueIndex, techniques, raw: meta });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setPassProperty(args) {
        var _a, _b, _c, _d, _e, _f;
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for set_pass_property');
            if (!args.property)
                return (0, types_1.errorResult)('property is required for set_pass_property');
            if (args.value === undefined)
                return (0, types_1.errorResult)('value is required for set_pass_property');
            const meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            const ti = (_a = args.techniqueIndex) !== null && _a !== void 0 ? _a : 0;
            const pi = (_b = args.passIndex) !== null && _b !== void 0 ? _b : 0;
            if ((_f = (_e = (_d = (_c = meta === null || meta === void 0 ? void 0 : meta.userData) === null || _c === void 0 ? void 0 : _c.techniques) === null || _d === void 0 ? void 0 : _d[ti]) === null || _e === void 0 ? void 0 : _e.passes) === null || _f === void 0 ? void 0 : _f[pi]) {
                meta.userData.techniques[ti].passes[pi][args.property] = args.value;
                await Editor.Message.request('asset-db', 'save-asset-meta', args.url, meta);
            }
            return (0, types_1.successResult)({ url: args.url, techniqueIndex: ti, passIndex: pi, property: args.property, value: args.value }, 'Pass property updated');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async createEffect(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for create');
            const template = args.template === 'standard' ? STANDARD_EFFECT_TEMPLATE : UNLIT_EFFECT_TEMPLATE;
            const result = await Editor.Message.request('asset-db', 'create-asset', args.url, template);
            return (0, types_1.successResult)({ url: args.url, uuid: result === null || result === void 0 ? void 0 : result.uuid, template: args.template || 'unlit' }, `Effect created at ${args.url}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageShaderEffect = ManageShaderEffect;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNoYWRlci1lZmZlY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXNoYWRlci1lZmZlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFNLHFCQUFxQixHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EwQzdCLENBQUM7QUFFRixNQUFNLHdCQUF3QixHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXFEaEMsQ0FBQztBQUVGLE1BQWEsa0JBQW1CLFNBQVEsaUNBQWM7SUFBdEQ7O1FBQ2EsU0FBSSxHQUFHLHNCQUFzQixDQUFDO1FBQzlCLGdCQUFXLEdBQUcsNEpBQTRKLENBQUM7UUFDM0ssWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDNUUsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxDQUFDO29CQUN2RSxXQUFXLEVBQUUsZ0tBQWdLO2lCQUNoTDtnQkFDRCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx5R0FBeUcsRUFBRTtnQkFDL0ksT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsd0RBQXdELEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFO2dCQUN0SSxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSw2REFB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QUNoQyxJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNoRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDO1lBQ2pHLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzVGLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFHLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksT0FBTyxFQUFFLEVBQUUscUJBQXFCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzlJLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0o7QUFuRkQsZ0RBbUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmNvbnN0IFVOTElUX0VGRkVDVF9URU1QTEFURSA9IGAvLyBFZmZlY3QgY3JlYXRlZCBieSBDb2NvcyBNQ1AgU2VydmVyXG5DQ0VmZmVjdCAle1xuICB0ZWNobmlxdWVzOlxuICAtIG5hbWU6IG9wYXF1ZVxuICAgIHBhc3NlczpcbiAgICAtIHZlcnQ6IHVubGl0LXZzOnZlcnRcbiAgICAgIGZyYWc6IHVubGl0LWZzOmZyYWdcbiAgICAgIHByb3BlcnRpZXM6ICZwcm9wc1xuICAgICAgICBtYWluVGV4dHVyZTogeyB2YWx1ZTogd2hpdGUgfVxuICAgICAgICBtYWluQ29sb3I6IHsgdmFsdWU6IFsxLCAxLCAxLCAxXSwgZWRpdG9yOiB7IHR5cGU6IGNvbG9yIH0gfVxufSVcblxuQ0NQcm9ncmFtIHVubGl0LXZzICV7XG4gIHByZWNpc2lvbiBoaWdocCBmbG9hdDtcbiAgI2luY2x1ZGUgPGxlZ2FjeS9pbnB1dD5cbiAgI2luY2x1ZGUgPGJ1aWx0aW4vdW5pZm9ybXMvY2MtZ2xvYmFsPlxuICAjaW5jbHVkZSA8bGVnYWN5L2RlY29kZT5cbiAgI2luY2x1ZGUgPGxlZ2FjeS9sb2NhbC1iYXRjaD5cbiAgaW4gdmVjNCBhX3Bvc2l0aW9uO1xuICBpbiB2ZWMyIGFfdGV4Q29vcmQ7XG4gIG91dCB2ZWMyIHZfdXY7XG4gIHZlYzQgdmVydCAoKSB7XG4gICAgdmVjNCBwb3NpdGlvbjtcbiAgICBDQ1ZlcnRJbnB1dChwb3NpdGlvbik7XG4gICAgbWF0NCBtYXRXb3JsZDtcbiAgICBDQ0dldFdvcmxkTWF0cml4KG1hdFdvcmxkKTtcbiAgICB2X3V2ID0gYV90ZXhDb29yZDtcbiAgICByZXR1cm4gY2NfbWF0UHJvaiAqIChjY19tYXRWaWV3ICogbWF0V29ybGQpICogcG9zaXRpb247XG4gIH1cbn0lXG5cbkNDUHJvZ3JhbSB1bmxpdC1mcyAle1xuICBwcmVjaXNpb24gaGlnaHAgZmxvYXQ7XG4gICNpbmNsdWRlIDxsZWdhY3kvb3V0cHV0PlxuICBpbiB2ZWMyIHZfdXY7XG4gIHVuaWZvcm0gc2FtcGxlcjJEIG1haW5UZXh0dXJlO1xuICB1bmlmb3JtIENvbnN0YW50IHsgdmVjNCBtYWluQ29sb3I7IH07XG4gIHZlYzQgZnJhZyAoKSB7XG4gICAgdmVjNCBjb2wgPSBtYWluQ29sb3IgKiB0ZXh0dXJlKG1haW5UZXh0dXJlLCB2X3V2KTtcbiAgICByZXR1cm4gQ0NGcmFnT3V0cHV0KGNvbCk7XG4gIH1cbn0lXG5gO1xuXG5jb25zdCBTVEFOREFSRF9FRkZFQ1RfVEVNUExBVEUgPSBgLy8gRWZmZWN0IGNyZWF0ZWQgYnkgQ29jb3MgTUNQIFNlcnZlclxuQ0NFZmZlY3QgJXtcbiAgdGVjaG5pcXVlczpcbiAgLSBuYW1lOiBvcGFxdWVcbiAgICBwYXNzZXM6XG4gICAgLSB2ZXJ0OiBzdGFuZGFyZC12czp2ZXJ0XG4gICAgICBmcmFnOiBzdGFuZGFyZC1mczpmcmFnXG4gICAgICBwcm9wZXJ0aWVzOiAmcHJvcHNcbiAgICAgICAgbWFpblRleHR1cmU6ICAgeyB2YWx1ZTogd2hpdGUgfVxuICAgICAgICBtYWluQ29sb3I6ICAgICB7IHZhbHVlOiBbMSwgMSwgMSwgMV0sIGVkaXRvcjogeyB0eXBlOiBjb2xvciB9IH1cbiAgICAgICAgcm91Z2huZXNzOiAgICAgeyB2YWx1ZTogMC44IH1cbiAgICAgICAgbWV0YWxsaWM6ICAgICAgeyB2YWx1ZTogMC4wIH1cbn0lXG5cbkNDUHJvZ3JhbSBzdGFuZGFyZC12cyAle1xuICBwcmVjaXNpb24gaGlnaHAgZmxvYXQ7XG4gICNpbmNsdWRlIDxsZWdhY3kvaW5wdXQtc3RhbmRhcmQ+XG4gICNpbmNsdWRlIDxidWlsdGluL3VuaWZvcm1zL2NjLWdsb2JhbD5cbiAgI2luY2x1ZGUgPGxlZ2FjeS9kZWNvZGUtc3RhbmRhcmQ+XG4gICNpbmNsdWRlIDxsZWdhY3kvbG9jYWwtYmF0Y2g+XG4gIGluIHZlYzQgYV9wb3NpdGlvbjtcbiAgaW4gdmVjMyBhX25vcm1hbDtcbiAgaW4gdmVjMiBhX3RleENvb3JkO1xuICBvdXQgdmVjMyB2X25vcm1hbDtcbiAgb3V0IHZlYzIgdl91djtcbiAgdmVjNCB2ZXJ0ICgpIHtcbiAgICB2ZWM0IHBvc2l0aW9uO1xuICAgIENDVmVydElucHV0KHBvc2l0aW9uKTtcbiAgICBtYXQ0IG1hdFdvcmxkOyBtYXQzIG1hdFdvcmxkSVQ7XG4gICAgQ0NHZXRXb3JsZE1hdHJpeEZ1bGwobWF0V29ybGQsIG1hdFdvcmxkSVQpO1xuICAgIHZfbm9ybWFsID0gbm9ybWFsaXplKG1hdFdvcmxkSVQgKiBhX25vcm1hbCk7XG4gICAgdl91diA9IGFfdGV4Q29vcmQ7XG4gICAgcmV0dXJuIGNjX21hdFByb2ogKiAoY2NfbWF0VmlldyAqIG1hdFdvcmxkKSAqIHBvc2l0aW9uO1xuICB9XG59JVxuXG5DQ1Byb2dyYW0gc3RhbmRhcmQtZnMgJXtcbiAgcHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xuICAjaW5jbHVkZSA8bGVnYWN5L291dHB1dC1zdGFuZGFyZD5cbiAgaW4gdmVjMyB2X25vcm1hbDtcbiAgaW4gdmVjMiB2X3V2O1xuICB1bmlmb3JtIHNhbXBsZXIyRCBtYWluVGV4dHVyZTtcbiAgdW5pZm9ybSBQQlJQYXJhbXMgeyB2ZWM0IG1haW5Db2xvcjsgZmxvYXQgcm91Z2huZXNzOyBmbG9hdCBtZXRhbGxpYzsgfTtcbiAgdm9pZCBzdXJmIChvdXQgU3RhbmRhcmRTdXJmYWNlIHMpIHtcbiAgICBzLmFsYmVkbyA9IG1haW5Db2xvciAqIHRleHR1cmUobWFpblRleHR1cmUsIHZfdXYpO1xuICAgIHMubm9ybWFsID0gdl9ub3JtYWw7XG4gICAgcy5yb3VnaG5lc3MgPSByb3VnaG5lc3M7XG4gICAgcy5tZXRhbGxpYyA9IG1ldGFsbGljO1xuICAgIHMuZW1pc3NpdmUgPSB2ZWMzKDAuMCk7XG4gICAgcy5vY2NsdXNpb24gPSAxLjA7XG4gIH1cbiAgdmVjNCBmcmFnICgpIHsgcmV0dXJuIENDU3RhbmRhcmRTaGFkaW5nQmFzZShzdXJmLCBnbF9GcmFnQ29vcmQpOyB9XG59JVxuYDtcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVNoYWRlckVmZmVjdCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9zaGFkZXJfZWZmZWN0JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2Ugc2hhZGVyIGVmZmVjdCBhc3NldHMgKC5lZmZlY3QgZmlsZXMpLiBBY3Rpb25zOiBsaXN0LCBnZXRfaW5mbywgZ2V0X3Bhc3Nlcywgc2V0X3Bhc3NfcHJvcGVydHksIGNyZWF0ZS4gUHVyZSBhc3NldC1kYiBvcGVyYXRpb25zIOKAlCBubyBzY2VuZSByZXF1aXJlZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2xpc3QnLCAnZ2V0X2luZm8nLCAnZ2V0X3Bhc3NlcycsICdzZXRfcGFzc19wcm9wZXJ0eScsICdjcmVhdGUnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnbGlzdCcsICdnZXRfaW5mbycsICdnZXRfcGFzc2VzJywgJ3NldF9wYXNzX3Byb3BlcnR5JywgJ2NyZWF0ZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBsaXN0PWxpc3QgLmVmZmVjdCBmaWxlcywgZ2V0X2luZm89Z2V0IGVmZmVjdCBhc3NldCBpbmZvLCBnZXRfcGFzc2VzPWdldCBwYXNzIGRldGFpbHMsIHNldF9wYXNzX3Byb3BlcnR5PXNldCBwYXNzIHByb3BlcnR5LCBjcmVhdGU9Y3JlYXRlIGZyb20gdGVtcGxhdGUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tnZXRfaW5mby9nZXRfcGFzc2VzL3NldF9wYXNzX3Byb3BlcnR5L2NyZWF0ZV0gQXNzZXQgREIgVVJMIChlLmcuLCBkYjovL2Fzc2V0cy9zaGFkZXJzL015RWZmZWN0LmVmZmVjdCknIH0sXG4gICAgICAgICAgICBwYXR0ZXJuOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tsaXN0XSBHbG9iIHBhdHRlcm4gKGRlZmF1bHQ6IGRiOi8vYXNzZXRzLyoqLyouZWZmZWN0KScsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qLmVmZmVjdCcgfSxcbiAgICAgICAgICAgIHRlY2huaXF1ZUluZGV4OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tnZXRfcGFzc2VzL3NldF9wYXNzX3Byb3BlcnR5XSBUZWNobmlxdWUgaW5kZXggKGRlZmF1bHQ6IDApJywgZGVmYXVsdDogMCB9LFxuICAgICAgICAgICAgcGFzc0luZGV4OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfcGFzc19wcm9wZXJ0eV0gUGFzcyBpbmRleCAoZGVmYXVsdDogMCknLCBkZWZhdWx0OiAwIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eTogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbc2V0X3Bhc3NfcHJvcGVydHldIFByb3BlcnR5IG5hbWUgdG8gc2V0JyB9LFxuICAgICAgICAgICAgdmFsdWU6IHsgZGVzY3JpcHRpb246ICdbc2V0X3Bhc3NfcHJvcGVydHldIFByb3BlcnR5IHZhbHVlIHRvIHNldCcgfSxcbiAgICAgICAgICAgIHRlbXBsYXRlOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ3VubGl0JywgJ3N0YW5kYXJkJ10sIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gRWZmZWN0IHRlbXBsYXRlOiB1bmxpdD1iYXNpYyB1bmxpdCBzaGFkZXIsIHN0YW5kYXJkPVBCUiBzaGFkZXInLCBkZWZhdWx0OiAndW5saXQnIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmxpc3RFZmZlY3RzKGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0SW5mbyhhcmdzKSxcbiAgICAgICAgZ2V0X3Bhc3NlczogKGFyZ3MpID0+IHRoaXMuZ2V0UGFzc2VzKGFyZ3MpLFxuICAgICAgICBzZXRfcGFzc19wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0UGFzc1Byb3BlcnR5KGFyZ3MpLFxuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmNyZWF0ZUVmZmVjdChhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0RWZmZWN0cyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBhcmdzLnBhdHRlcm4gfHwgJ2RiOi8vYXNzZXRzLyoqLyouZWZmZWN0JztcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgZWZmZWN0czogYXNzZXRzLCBjb3VudDogKGFzc2V0cyBhcyBhbnlbXSkubGVuZ3RoIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIGdldF9pbmZvJyk7XG4gICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFyZ3MudXJsKTtcbiAgICAgICAgICAgIGxldCBtZXRhOiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgdHJ5IHsgbWV0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCBhcmdzLnVybCk7IH0gY2F0Y2ggeyAvKiBvcHRpb25hbCAqLyB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGluZm8sIG1ldGEgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFBhc3NlcyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBnZXRfcGFzc2VzJyk7XG4gICAgICAgICAgICBjb25zdCBtZXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgYXJncy51cmwpO1xuICAgICAgICAgICAgY29uc3QgdGVjaG5pcXVlSW5kZXggPSBhcmdzLnRlY2huaXF1ZUluZGV4ID8/IDA7XG4gICAgICAgICAgICBjb25zdCB0ZWNobmlxdWVzID0gbWV0YT8udXNlckRhdGE/LnRlY2huaXF1ZU5hbWVzIHx8IG1ldGE/LnRlY2huaXF1ZXMgfHwgW107XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybDogYXJncy51cmwsIHRlY2huaXF1ZUluZGV4LCB0ZWNobmlxdWVzLCByYXc6IG1ldGEgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFBhc3NQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBzZXRfcGFzc19wcm9wZXJ0eScpO1xuICAgICAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkIGZvciBzZXRfcGFzc19wcm9wZXJ0eScpO1xuICAgICAgICAgICAgaWYgKGFyZ3MudmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCBmb3Igc2V0X3Bhc3NfcHJvcGVydHknKTtcbiAgICAgICAgICAgIGNvbnN0IG1ldGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCBhcmdzLnVybCk7XG4gICAgICAgICAgICBjb25zdCB0aSA9IGFyZ3MudGVjaG5pcXVlSW5kZXggPz8gMDtcbiAgICAgICAgICAgIGNvbnN0IHBpID0gYXJncy5wYXNzSW5kZXggPz8gMDtcbiAgICAgICAgICAgIGlmIChtZXRhPy51c2VyRGF0YT8udGVjaG5pcXVlcz8uW3RpXT8ucGFzc2VzPy5bcGldKSB7XG4gICAgICAgICAgICAgICAgbWV0YS51c2VyRGF0YS50ZWNobmlxdWVzW3RpXS5wYXNzZXNbcGldW2FyZ3MucHJvcGVydHldID0gYXJncy52YWx1ZTtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCBhcmdzLnVybCwgbWV0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybDogYXJncy51cmwsIHRlY2huaXF1ZUluZGV4OiB0aSwgcGFzc0luZGV4OiBwaSwgcHJvcGVydHk6IGFyZ3MucHJvcGVydHksIHZhbHVlOiBhcmdzLnZhbHVlIH0sICdQYXNzIHByb3BlcnR5IHVwZGF0ZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlRWZmZWN0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIGNyZWF0ZScpO1xuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBhcmdzLnRlbXBsYXRlID09PSAnc3RhbmRhcmQnID8gU1RBTkRBUkRfRUZGRUNUX1RFTVBMQVRFIDogVU5MSVRfRUZGRUNUX1RFTVBMQVRFO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgYXJncy51cmwsIHRlbXBsYXRlKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsOiBhcmdzLnVybCwgdXVpZDogKHJlc3VsdCBhcyBhbnkpPy51dWlkLCB0ZW1wbGF0ZTogYXJncy50ZW1wbGF0ZSB8fCAndW5saXQnIH0sIGBFZmZlY3QgY3JlYXRlZCBhdCAke2FyZ3MudXJsfWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxufVxuIl19