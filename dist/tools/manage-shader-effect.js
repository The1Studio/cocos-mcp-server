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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNoYWRlci1lZmZlY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXNoYWRlci1lZmZlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFNLHFCQUFxQixHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Q0EwQzdCLENBQUM7QUFFRixNQUFNLHdCQUF3QixHQUFHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztDQXFEaEMsQ0FBQztBQUVGLE1BQWEsa0JBQW1CLFNBQVEsaUNBQWM7SUFBdEQ7O1FBQ2EsU0FBSSxHQUFHLHNCQUFzQixDQUFDO1FBQzlCLGdCQUFXLEdBQUcsNEpBQTRKLENBQUM7UUFDM0ssWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDNUUsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsUUFBUSxDQUFDO29CQUN2RSxXQUFXLEVBQUUsZ0tBQWdLO2lCQUNoTDtnQkFDRCxHQUFHLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx5R0FBeUcsRUFBRTtnQkFDL0ksT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsd0RBQXdELEVBQUUsT0FBTyxFQUFFLHlCQUF5QixFQUFFO2dCQUN0SSxjQUFjLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSw2REFB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QUNoQyxJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUc7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsNEJBQTRCLENBQUMsQ0FBQztZQUNoRSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDO1lBQ2pHLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQzVGLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFHLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksT0FBTyxFQUFFLEVBQUUscUJBQXFCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzlJLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0o7QUFuRkQsZ0RBbUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmNvbnN0IFVOTElUX0VGRkVDVF9URU1QTEFURSA9IGAvLyBFZmZlY3QgY3JlYXRlZCBieSBDb2NvcyBNQ1AgU2VydmVyXHJcbkNDRWZmZWN0ICV7XHJcbiAgdGVjaG5pcXVlczpcclxuICAtIG5hbWU6IG9wYXF1ZVxyXG4gICAgcGFzc2VzOlxyXG4gICAgLSB2ZXJ0OiB1bmxpdC12czp2ZXJ0XHJcbiAgICAgIGZyYWc6IHVubGl0LWZzOmZyYWdcclxuICAgICAgcHJvcGVydGllczogJnByb3BzXHJcbiAgICAgICAgbWFpblRleHR1cmU6IHsgdmFsdWU6IHdoaXRlIH1cclxuICAgICAgICBtYWluQ29sb3I6IHsgdmFsdWU6IFsxLCAxLCAxLCAxXSwgZWRpdG9yOiB7IHR5cGU6IGNvbG9yIH0gfVxyXG59JVxyXG5cclxuQ0NQcm9ncmFtIHVubGl0LXZzICV7XHJcbiAgcHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xyXG4gICNpbmNsdWRlIDxsZWdhY3kvaW5wdXQ+XHJcbiAgI2luY2x1ZGUgPGJ1aWx0aW4vdW5pZm9ybXMvY2MtZ2xvYmFsPlxyXG4gICNpbmNsdWRlIDxsZWdhY3kvZGVjb2RlPlxyXG4gICNpbmNsdWRlIDxsZWdhY3kvbG9jYWwtYmF0Y2g+XHJcbiAgaW4gdmVjNCBhX3Bvc2l0aW9uO1xyXG4gIGluIHZlYzIgYV90ZXhDb29yZDtcclxuICBvdXQgdmVjMiB2X3V2O1xyXG4gIHZlYzQgdmVydCAoKSB7XHJcbiAgICB2ZWM0IHBvc2l0aW9uO1xyXG4gICAgQ0NWZXJ0SW5wdXQocG9zaXRpb24pO1xyXG4gICAgbWF0NCBtYXRXb3JsZDtcclxuICAgIENDR2V0V29ybGRNYXRyaXgobWF0V29ybGQpO1xyXG4gICAgdl91diA9IGFfdGV4Q29vcmQ7XHJcbiAgICByZXR1cm4gY2NfbWF0UHJvaiAqIChjY19tYXRWaWV3ICogbWF0V29ybGQpICogcG9zaXRpb247XHJcbiAgfVxyXG59JVxyXG5cclxuQ0NQcm9ncmFtIHVubGl0LWZzICV7XHJcbiAgcHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xyXG4gICNpbmNsdWRlIDxsZWdhY3kvb3V0cHV0PlxyXG4gIGluIHZlYzIgdl91djtcclxuICB1bmlmb3JtIHNhbXBsZXIyRCBtYWluVGV4dHVyZTtcclxuICB1bmlmb3JtIENvbnN0YW50IHsgdmVjNCBtYWluQ29sb3I7IH07XHJcbiAgdmVjNCBmcmFnICgpIHtcclxuICAgIHZlYzQgY29sID0gbWFpbkNvbG9yICogdGV4dHVyZShtYWluVGV4dHVyZSwgdl91dik7XHJcbiAgICByZXR1cm4gQ0NGcmFnT3V0cHV0KGNvbCk7XHJcbiAgfVxyXG59JVxyXG5gO1xyXG5cclxuY29uc3QgU1RBTkRBUkRfRUZGRUNUX1RFTVBMQVRFID0gYC8vIEVmZmVjdCBjcmVhdGVkIGJ5IENvY29zIE1DUCBTZXJ2ZXJcclxuQ0NFZmZlY3QgJXtcclxuICB0ZWNobmlxdWVzOlxyXG4gIC0gbmFtZTogb3BhcXVlXHJcbiAgICBwYXNzZXM6XHJcbiAgICAtIHZlcnQ6IHN0YW5kYXJkLXZzOnZlcnRcclxuICAgICAgZnJhZzogc3RhbmRhcmQtZnM6ZnJhZ1xyXG4gICAgICBwcm9wZXJ0aWVzOiAmcHJvcHNcclxuICAgICAgICBtYWluVGV4dHVyZTogICB7IHZhbHVlOiB3aGl0ZSB9XHJcbiAgICAgICAgbWFpbkNvbG9yOiAgICAgeyB2YWx1ZTogWzEsIDEsIDEsIDFdLCBlZGl0b3I6IHsgdHlwZTogY29sb3IgfSB9XHJcbiAgICAgICAgcm91Z2huZXNzOiAgICAgeyB2YWx1ZTogMC44IH1cclxuICAgICAgICBtZXRhbGxpYzogICAgICB7IHZhbHVlOiAwLjAgfVxyXG59JVxyXG5cclxuQ0NQcm9ncmFtIHN0YW5kYXJkLXZzICV7XHJcbiAgcHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xyXG4gICNpbmNsdWRlIDxsZWdhY3kvaW5wdXQtc3RhbmRhcmQ+XHJcbiAgI2luY2x1ZGUgPGJ1aWx0aW4vdW5pZm9ybXMvY2MtZ2xvYmFsPlxyXG4gICNpbmNsdWRlIDxsZWdhY3kvZGVjb2RlLXN0YW5kYXJkPlxyXG4gICNpbmNsdWRlIDxsZWdhY3kvbG9jYWwtYmF0Y2g+XHJcbiAgaW4gdmVjNCBhX3Bvc2l0aW9uO1xyXG4gIGluIHZlYzMgYV9ub3JtYWw7XHJcbiAgaW4gdmVjMiBhX3RleENvb3JkO1xyXG4gIG91dCB2ZWMzIHZfbm9ybWFsO1xyXG4gIG91dCB2ZWMyIHZfdXY7XHJcbiAgdmVjNCB2ZXJ0ICgpIHtcclxuICAgIHZlYzQgcG9zaXRpb247XHJcbiAgICBDQ1ZlcnRJbnB1dChwb3NpdGlvbik7XHJcbiAgICBtYXQ0IG1hdFdvcmxkOyBtYXQzIG1hdFdvcmxkSVQ7XHJcbiAgICBDQ0dldFdvcmxkTWF0cml4RnVsbChtYXRXb3JsZCwgbWF0V29ybGRJVCk7XHJcbiAgICB2X25vcm1hbCA9IG5vcm1hbGl6ZShtYXRXb3JsZElUICogYV9ub3JtYWwpO1xyXG4gICAgdl91diA9IGFfdGV4Q29vcmQ7XHJcbiAgICByZXR1cm4gY2NfbWF0UHJvaiAqIChjY19tYXRWaWV3ICogbWF0V29ybGQpICogcG9zaXRpb247XHJcbiAgfVxyXG59JVxyXG5cclxuQ0NQcm9ncmFtIHN0YW5kYXJkLWZzICV7XHJcbiAgcHJlY2lzaW9uIGhpZ2hwIGZsb2F0O1xyXG4gICNpbmNsdWRlIDxsZWdhY3kvb3V0cHV0LXN0YW5kYXJkPlxyXG4gIGluIHZlYzMgdl9ub3JtYWw7XHJcbiAgaW4gdmVjMiB2X3V2O1xyXG4gIHVuaWZvcm0gc2FtcGxlcjJEIG1haW5UZXh0dXJlO1xyXG4gIHVuaWZvcm0gUEJSUGFyYW1zIHsgdmVjNCBtYWluQ29sb3I7IGZsb2F0IHJvdWdobmVzczsgZmxvYXQgbWV0YWxsaWM7IH07XHJcbiAgdm9pZCBzdXJmIChvdXQgU3RhbmRhcmRTdXJmYWNlIHMpIHtcclxuICAgIHMuYWxiZWRvID0gbWFpbkNvbG9yICogdGV4dHVyZShtYWluVGV4dHVyZSwgdl91dik7XHJcbiAgICBzLm5vcm1hbCA9IHZfbm9ybWFsO1xyXG4gICAgcy5yb3VnaG5lc3MgPSByb3VnaG5lc3M7XHJcbiAgICBzLm1ldGFsbGljID0gbWV0YWxsaWM7XHJcbiAgICBzLmVtaXNzaXZlID0gdmVjMygwLjApO1xyXG4gICAgcy5vY2NsdXNpb24gPSAxLjA7XHJcbiAgfVxyXG4gIHZlYzQgZnJhZyAoKSB7IHJldHVybiBDQ1N0YW5kYXJkU2hhZGluZ0Jhc2Uoc3VyZiwgZ2xfRnJhZ0Nvb3JkKTsgfVxyXG59JVxyXG5gO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZVNoYWRlckVmZmVjdCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NoYWRlcl9lZmZlY3QnO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHNoYWRlciBlZmZlY3QgYXNzZXRzICguZWZmZWN0IGZpbGVzKS4gQWN0aW9uczogbGlzdCwgZ2V0X2luZm8sIGdldF9wYXNzZXMsIHNldF9wYXNzX3Byb3BlcnR5LCBjcmVhdGUuIFB1cmUgYXNzZXQtZGIgb3BlcmF0aW9ucyDigJQgbm8gc2NlbmUgcmVxdWlyZWQuJztcclxuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2xpc3QnLCAnZ2V0X2luZm8nLCAnZ2V0X3Bhc3NlcycsICdzZXRfcGFzc19wcm9wZXJ0eScsICdjcmVhdGUnXTtcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnbGlzdCcsICdnZXRfaW5mbycsICdnZXRfcGFzc2VzJywgJ3NldF9wYXNzX3Byb3BlcnR5JywgJ2NyZWF0ZSddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IGxpc3Q9bGlzdCAuZWZmZWN0IGZpbGVzLCBnZXRfaW5mbz1nZXQgZWZmZWN0IGFzc2V0IGluZm8sIGdldF9wYXNzZXM9Z2V0IHBhc3MgZGV0YWlscywgc2V0X3Bhc3NfcHJvcGVydHk9c2V0IHBhc3MgcHJvcGVydHksIGNyZWF0ZT1jcmVhdGUgZnJvbSB0ZW1wbGF0ZSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdXJsOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tnZXRfaW5mby9nZXRfcGFzc2VzL3NldF9wYXNzX3Byb3BlcnR5L2NyZWF0ZV0gQXNzZXQgREIgVVJMIChlLmcuLCBkYjovL2Fzc2V0cy9zaGFkZXJzL015RWZmZWN0LmVmZmVjdCknIH0sXHJcbiAgICAgICAgICAgIHBhdHRlcm46IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiAoZGVmYXVsdDogZGI6Ly9hc3NldHMvKiovKi5lZmZlY3QpJywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzLyoqLyouZWZmZWN0JyB9LFxyXG4gICAgICAgICAgICB0ZWNobmlxdWVJbmRleDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbZ2V0X3Bhc3Nlcy9zZXRfcGFzc19wcm9wZXJ0eV0gVGVjaG5pcXVlIGluZGV4IChkZWZhdWx0OiAwKScsIGRlZmF1bHQ6IDAgfSxcclxuICAgICAgICAgICAgcGFzc0luZGV4OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfcGFzc19wcm9wZXJ0eV0gUGFzcyBpbmRleCAoZGVmYXVsdDogMCknLCBkZWZhdWx0OiAwIH0sXHJcbiAgICAgICAgICAgIHByb3BlcnR5OiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1tzZXRfcGFzc19wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZSB0byBzZXQnIH0sXHJcbiAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAnW3NldF9wYXNzX3Byb3BlcnR5XSBQcm9wZXJ0eSB2YWx1ZSB0byBzZXQnIH0sXHJcbiAgICAgICAgICAgIHRlbXBsYXRlOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ3VubGl0JywgJ3N0YW5kYXJkJ10sIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gRWZmZWN0IHRlbXBsYXRlOiB1bmxpdD1iYXNpYyB1bmxpdCBzaGFkZXIsIHN0YW5kYXJkPVBCUiBzaGFkZXInLCBkZWZhdWx0OiAndW5saXQnIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmxpc3RFZmZlY3RzKGFyZ3MpLFxyXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRJbmZvKGFyZ3MpLFxyXG4gICAgICAgIGdldF9wYXNzZXM6IChhcmdzKSA9PiB0aGlzLmdldFBhc3NlcyhhcmdzKSxcclxuICAgICAgICBzZXRfcGFzc19wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0UGFzc1Byb3BlcnR5KGFyZ3MpLFxyXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlRWZmZWN0KGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGxpc3RFZmZlY3RzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBhcmdzLnBhdHRlcm4gfHwgJ2RiOi8vYXNzZXRzLyoqLyouZWZmZWN0JztcclxuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGVmZmVjdHM6IGFzc2V0cywgY291bnQ6IChhc3NldHMgYXMgYW55W10pLmxlbmd0aCB9KTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRyeSB7IG1ldGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgYXJncy51cmwpOyB9IGNhdGNoIHsgLyogb3B0aW9uYWwgKi8gfVxyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGluZm8sIG1ldGEgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGFzc2VzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBnZXRfcGFzc2VzJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1ldGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCBhcmdzLnVybCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlY2huaXF1ZUluZGV4ID0gYXJncy50ZWNobmlxdWVJbmRleCA/PyAwO1xyXG4gICAgICAgICAgICBjb25zdCB0ZWNobmlxdWVzID0gbWV0YT8udXNlckRhdGE/LnRlY2huaXF1ZU5hbWVzIHx8IG1ldGE/LnRlY2huaXF1ZXMgfHwgW107XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgdXJsOiBhcmdzLnVybCwgdGVjaG5pcXVlSW5kZXgsIHRlY2huaXF1ZXMsIHJhdzogbWV0YSB9KTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQYXNzUHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIHNldF9wYXNzX3Byb3BlcnR5Jyk7XHJcbiAgICAgICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCBmb3Igc2V0X3Bhc3NfcHJvcGVydHknKTtcclxuICAgICAgICAgICAgaWYgKGFyZ3MudmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCBmb3Igc2V0X3Bhc3NfcHJvcGVydHknKTtcclxuICAgICAgICAgICAgY29uc3QgbWV0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtbWV0YScsIGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgY29uc3QgdGkgPSBhcmdzLnRlY2huaXF1ZUluZGV4ID8/IDA7XHJcbiAgICAgICAgICAgIGNvbnN0IHBpID0gYXJncy5wYXNzSW5kZXggPz8gMDtcclxuICAgICAgICAgICAgaWYgKG1ldGE/LnVzZXJEYXRhPy50ZWNobmlxdWVzPy5bdGldPy5wYXNzZXM/LltwaV0pIHtcclxuICAgICAgICAgICAgICAgIG1ldGEudXNlckRhdGEudGVjaG5pcXVlc1t0aV0ucGFzc2VzW3BpXVthcmdzLnByb3BlcnR5XSA9IGFyZ3MudmFsdWU7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCBhcmdzLnVybCwgbWV0YSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmw6IGFyZ3MudXJsLCB0ZWNobmlxdWVJbmRleDogdGksIHBhc3NJbmRleDogcGksIHByb3BlcnR5OiBhcmdzLnByb3BlcnR5LCB2YWx1ZTogYXJncy52YWx1ZSB9LCAnUGFzcyBwcm9wZXJ0eSB1cGRhdGVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlRWZmZWN0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBjcmVhdGUnKTtcclxuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBhcmdzLnRlbXBsYXRlID09PSAnc3RhbmRhcmQnID8gU1RBTkRBUkRfRUZGRUNUX1RFTVBMQVRFIDogVU5MSVRfRUZGRUNUX1RFTVBMQVRFO1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBhcmdzLnVybCwgdGVtcGxhdGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybDogYXJncy51cmwsIHV1aWQ6IChyZXN1bHQgYXMgYW55KT8udXVpZCwgdGVtcGxhdGU6IGFyZ3MudGVtcGxhdGUgfHwgJ3VubGl0JyB9LCBgRWZmZWN0IGNyZWF0ZWQgYXQgJHthcmdzLnVybH1gKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcbn1cclxuIl19