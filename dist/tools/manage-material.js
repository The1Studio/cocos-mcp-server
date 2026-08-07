"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageMaterial = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const asset_path_1 = require("../utils/asset-path");
const DEFAULT_MATERIAL_JSON = JSON.stringify({
    "__type__": "cc.Material",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_native": "",
    "_effectAsset": null,
    "_techIdx": 0,
    "_defines": [{}],
    "_states": [{}],
    "_props": [{}]
}, null, 2);
class ManageMaterial extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_material';
        this.description = 'Manage material assets. Actions: create, get_info, set_property, list. Materials control visual appearance of meshes. Use get_info to inspect current properties before modifying. set_property writes the serialized `_props` entry of a standalone .mtl asset and verifies it on disk; materials embedded in an imported model (FBX/glTF subassets) are read-only here.';
        this.actions = ['create', 'get_info', 'set_property', 'list'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['create', 'get_info', 'set_property', 'list'],
                    description: 'Action to perform: create=create new .mtl asset, get_info=query asset info and meta, set_property=write a serialized material property into the .mtl asset, list=list all material assets'
                },
                url: {
                    type: 'string',
                    description: '[create, get_info, set_property] Asset DB URL or UUID (e.g., db://assets/materials/MyMaterial.mtl). set_property requires a standalone .mtl asset — materials embedded in an imported model (FBX/glTF subassets) are not writable through this tool.'
                },
                property: {
                    type: 'string',
                    description: '[set_property] Serialized material property name, as it appears in the .mtl `_props` block (e.g., mainTexture, albedo, occlusionMap)'
                },
                value: {
                    description: '[set_property] Value written verbatim into `_props`. Use the serialized form: numbers/booleans as-is, colors as {"__type__":"cc.Color","r":255,"g":0,"b":0,"a":255}, asset references as {"__uuid__":"<uuid>","__expectedType__":"cc.Texture2D"}. Pass null to clear the property (the key is removed so the effect default applies).'
                },
                pattern: {
                    type: 'string',
                    description: '[list] Glob pattern to filter materials (default: db://assets/**/*.mtl)',
                    default: 'db://assets/**/*.mtl'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            create: (args) => this.createMaterial(args),
            get_info: (args) => this.getMaterialInfo(args),
            set_property: (args) => this.setMaterialProperty(args),
            list: (args) => this.listMaterials(args),
        };
    }
    async createMaterial(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for create');
            const result = await Editor.Message.request('asset-db', 'create-asset', args.url, DEFAULT_MATERIAL_JSON);
            return (0, types_1.successResult)({ url: args.url, uuid: result === null || result === void 0 ? void 0 : result.uuid }, `Material created at ${args.url}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getMaterialInfo(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            let meta = null;
            try {
                meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            }
            catch (_a) {
                // meta may not be available for all assets
            }
            return (0, types_1.successResult)({ info, meta });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    /**
     * Write a property into the material's serialized `_props` block.
     *
     * The previous implementation wrote `meta.userData[property]` and reported success.
     * `userData` is importer configuration — it is not the material's property table, so
     * the serialized value never changed, survived reimport, and the runtime kept
     * resolving the old reference. A meta-only write cannot affect a material, so it must
     * never be reported as one (#24).
     *
     * Only standalone `.mtl` assets are writable here. A material embedded in an imported
     * model (FBX/glTF subasset) is regenerated by that model's importer and has no
     * `.mtl` file of its own; that case returns an explicit unsupported error rather than
     * a success the caller cannot verify.
     */
    async setMaterialProperty(args) {
        var _a;
        if (!args.url)
            return (0, types_1.errorResult)('url is required for set_property');
        if (!args.property)
            return (0, types_1.errorResult)('property is required for set_property');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required for set_property (pass null to clear the property)');
        const resolved = await (0, asset_path_1.resolveAsset)(args.url);
        if (resolved.error)
            return (0, types_1.errorResult)(resolved.error);
        if (!resolved.filePath) {
            return (0, types_1.errorResult)(`Could not resolve an on-disk file for ${args.url}. set_property needs a standalone .mtl asset.`);
        }
        if (path.extname(resolved.filePath).toLowerCase() !== '.mtl') {
            return (0, types_1.errorResult)(`set_property cannot edit '${args.url}': it resolves to ${path.basename(resolved.filePath)}, not a standalone .mtl asset. ` +
                'Materials embedded in an imported model are regenerated by that model\'s importer — ' +
                'edit them in the Inspector, or extract the material to a .mtl asset first.');
        }
        let material;
        try {
            material = JSON.parse(fs.readFileSync(resolved.filePath, 'utf-8'));
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to read material asset ${resolved.filePath}: ${err.message}`);
        }
        if (!material || material.__type__ !== 'cc.Material') {
            return (0, types_1.errorResult)(`${args.url} is not a cc.Material asset (found __type__=${(_a = material === null || material === void 0 ? void 0 : material.__type__) !== null && _a !== void 0 ? _a : 'none'})`);
        }
        const techIdx = typeof material._techIdx === 'number' ? material._techIdx : 0;
        if (!Array.isArray(material._props))
            material._props = [];
        while (material._props.length <= techIdx)
            material._props.push({});
        const props = material._props[techIdx] || (material._props[techIdx] = {});
        const clearing = args.value === null;
        if (clearing)
            delete props[args.property];
        else
            props[args.property] = args.value;
        try {
            await Editor.Message.request('asset-db', 'save-asset', args.url, JSON.stringify(material, null, 2));
        }
        catch (err) {
            return (0, types_1.errorResult)(`save-asset rejected ${args.url}: ${err.message}`);
        }
        try {
            await Editor.Message.request('asset-db', 'reimport-asset', args.url);
        }
        catch (err) {
            return (0, types_1.errorResult)(`Material written but reimport-asset failed for ${args.url}: ${err.message}`);
        }
        // Read the asset back. A success envelope here means the serialized property
        // actually changed on disk — never that a message resolved without throwing.
        const verification = this.verifySavedProperty(resolved.filePath, techIdx, args.property, args.value, clearing);
        if (!verification.verified)
            return (0, types_1.errorResult)(verification.error);
        return (0, types_1.successResult)({ url: args.url, file: resolved.filePath, property: args.property, value: args.value, techniqueIndex: techIdx, cleared: clearing }, clearing
            ? `Property '${args.property}' cleared from material ${args.url} (verified on disk)`
            : `Property '${args.property}' set on material ${args.url} (verified on disk)`);
    }
    verifySavedProperty(filePath, techIdx, property, value, clearing) {
        let saved;
        try {
            saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        catch (err) {
            return { verified: false, error: `Could not re-read ${filePath} to verify the write: ${err.message}` };
        }
        const savedProps = Array.isArray(saved === null || saved === void 0 ? void 0 : saved._props) ? saved._props[techIdx] : undefined;
        if (clearing) {
            if (savedProps && Object.prototype.hasOwnProperty.call(savedProps, property)) {
                return { verified: false, error: `Wrote the material but '${property}' is still present in _props[${techIdx}] after reimport.` };
            }
            return { verified: true };
        }
        if (!savedProps || JSON.stringify(savedProps[property]) !== JSON.stringify(value)) {
            return { verified: false, error: `Wrote the material but '${property}' did not persist in _props[${techIdx}] after reimport.` };
        }
        return { verified: true };
    }
    async listMaterials(args) {
        try {
            const pattern = args.pattern || 'db://assets/**/*.mtl';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return (0, types_1.successResult)({ materials: assets, count: assets.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageMaterial = ManageMaterial;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW1hdGVyaWFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1tYXRlcmlhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsb0RBQW1EO0FBRW5ELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN6QyxVQUFVLEVBQUUsYUFBYTtJQUN6QixPQUFPLEVBQUUsRUFBRTtJQUNYLFdBQVcsRUFBRSxDQUFDO0lBQ2Qsa0JBQWtCLEVBQUUsRUFBRTtJQUN0QixTQUFTLEVBQUUsRUFBRTtJQUNiLGNBQWMsRUFBRSxJQUFJO0lBQ3BCLFVBQVUsRUFBRSxDQUFDO0lBQ2IsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ2hCLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUNmLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQztDQUNqQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVaLE1BQWEsY0FBZSxTQUFRLGlDQUFjO0lBQWxEOztRQUNhLFNBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUN6QixnQkFBVyxHQUFHLDJXQUEyVyxDQUFDO1FBQzFYLFlBQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3pELGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQztvQkFDcEQsV0FBVyxFQUFFLDJMQUEyTDtpQkFDM007Z0JBQ0QsR0FBRyxFQUFF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VSxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQ2hGLE9BQU8sRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSwyQkFBMkIsUUFBUSwrQkFBK0IsT0FBTyxtQkFBbUIsRUFBRSxDQUFDO1FBQ3BJLENBQUM7UUFDRCxPQUFPLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO0lBQzlCLENBQUM7SUFFTyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQVM7UUFDakMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxzQkFBc0IsQ0FBQztZQUN2RCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3JGLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUcsTUFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBOUtELHdDQThLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHJlc29sdmVBc3NldCB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LXBhdGgnO1xuXG5jb25zdCBERUZBVUxUX01BVEVSSUFMX0pTT04gPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgXCJfX3R5cGVfX1wiOiBcImNjLk1hdGVyaWFsXCIsXG4gICAgXCJfbmFtZVwiOiBcIlwiLFxuICAgIFwiX29iakZsYWdzXCI6IDAsXG4gICAgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgIFwiX25hdGl2ZVwiOiBcIlwiLFxuICAgIFwiX2VmZmVjdEFzc2V0XCI6IG51bGwsXG4gICAgXCJfdGVjaElkeFwiOiAwLFxuICAgIFwiX2RlZmluZXNcIjogW3t9XSxcbiAgICBcIl9zdGF0ZXNcIjogW3t9XSxcbiAgICBcIl9wcm9wc1wiOiBbe31dXG59LCBudWxsLCAyKTtcblxuZXhwb3J0IGNsYXNzIE1hbmFnZU1hdGVyaWFsIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX21hdGVyaWFsJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgbWF0ZXJpYWwgYXNzZXRzLiBBY3Rpb25zOiBjcmVhdGUsIGdldF9pbmZvLCBzZXRfcHJvcGVydHksIGxpc3QuIE1hdGVyaWFscyBjb250cm9sIHZpc3VhbCBhcHBlYXJhbmNlIG9mIG1lc2hlcy4gVXNlIGdldF9pbmZvIHRvIGluc3BlY3QgY3VycmVudCBwcm9wZXJ0aWVzIGJlZm9yZSBtb2RpZnlpbmcuIHNldF9wcm9wZXJ0eSB3cml0ZXMgdGhlIHNlcmlhbGl6ZWQgYF9wcm9wc2AgZW50cnkgb2YgYSBzdGFuZGFsb25lIC5tdGwgYXNzZXQgYW5kIHZlcmlmaWVzIGl0IG9uIGRpc2s7IG1hdGVyaWFscyBlbWJlZGRlZCBpbiBhbiBpbXBvcnRlZCBtb2RlbCAoRkJYL2dsVEYgc3ViYXNzZXRzKSBhcmUgcmVhZC1vbmx5IGhlcmUuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjcmVhdGUnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ2xpc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdsaXN0J10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlPWNyZWF0ZSBuZXcgLm10bCBhc3NldCwgZ2V0X2luZm89cXVlcnkgYXNzZXQgaW5mbyBhbmQgbWV0YSwgc2V0X3Byb3BlcnR5PXdyaXRlIGEgc2VyaWFsaXplZCBtYXRlcmlhbCBwcm9wZXJ0eSBpbnRvIHRoZSAubXRsIGFzc2V0LCBsaXN0PWxpc3QgYWxsIG1hdGVyaWFsIGFzc2V0cydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1cmw6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGUsIGdldF9pbmZvLCBzZXRfcHJvcGVydHldIEFzc2V0IERCIFVSTCBvciBVVUlEIChlLmcuLCBkYjovL2Fzc2V0cy9tYXRlcmlhbHMvTXlNYXRlcmlhbC5tdGwpLiBzZXRfcHJvcGVydHkgcmVxdWlyZXMgYSBzdGFuZGFsb25lIC5tdGwgYXNzZXQg4oCUIG1hdGVyaWFscyBlbWJlZGRlZCBpbiBhbiBpbXBvcnRlZCBtb2RlbCAoRkJYL2dsVEYgc3ViYXNzZXRzKSBhcmUgbm90IHdyaXRhYmxlIHRocm91Z2ggdGhpcyB0b29sLidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gU2VyaWFsaXplZCBtYXRlcmlhbCBwcm9wZXJ0eSBuYW1lLCBhcyBpdCBhcHBlYXJzIGluIHRoZSAubXRsIGBfcHJvcHNgIGJsb2NrIChlLmcuLCBtYWluVGV4dHVyZSwgYWxiZWRvLCBvY2NsdXNpb25NYXApJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBWYWx1ZSB3cml0dGVuIHZlcmJhdGltIGludG8gYF9wcm9wc2AuIFVzZSB0aGUgc2VyaWFsaXplZCBmb3JtOiBudW1iZXJzL2Jvb2xlYW5zIGFzLWlzLCBjb2xvcnMgYXMge1wiX190eXBlX19cIjpcImNjLkNvbG9yXCIsXCJyXCI6MjU1LFwiZ1wiOjAsXCJiXCI6MCxcImFcIjoyNTV9LCBhc3NldCByZWZlcmVuY2VzIGFzIHtcIl9fdXVpZF9fXCI6XCI8dXVpZD5cIixcIl9fZXhwZWN0ZWRUeXBlX19cIjpcImNjLlRleHR1cmUyRFwifS4gUGFzcyBudWxsIHRvIGNsZWFyIHRoZSBwcm9wZXJ0eSAodGhlIGtleSBpcyByZW1vdmVkIHNvIHRoZSBlZmZlY3QgZGVmYXVsdCBhcHBsaWVzKS4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiB0byBmaWx0ZXIgbWF0ZXJpYWxzIChkZWZhdWx0OiBkYjovL2Fzc2V0cy8qKi8qLm10bCknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qLm10bCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlTWF0ZXJpYWwoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRNYXRlcmlhbEluZm8oYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TWF0ZXJpYWxQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdE1hdGVyaWFscyhhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVNYXRlcmlhbChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBjcmVhdGUnKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFyZ3MudXJsLCBERUZBVUxUX01BVEVSSUFMX0pTT04pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgeyB1cmw6IGFyZ3MudXJsLCB1dWlkOiAocmVzdWx0IGFzIGFueSk/LnV1aWQgfSxcbiAgICAgICAgICAgICAgICBgTWF0ZXJpYWwgY3JlYXRlZCBhdCAke2FyZ3MudXJsfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRNYXRlcmlhbEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy51cmwpO1xuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG1ldGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgYXJncy51cmwpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gbWV0YSBtYXkgbm90IGJlIGF2YWlsYWJsZSBmb3IgYWxsIGFzc2V0c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBpbmZvLCBtZXRhIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdyaXRlIGEgcHJvcGVydHkgaW50byB0aGUgbWF0ZXJpYWwncyBzZXJpYWxpemVkIGBfcHJvcHNgIGJsb2NrLlxuICAgICAqXG4gICAgICogVGhlIHByZXZpb3VzIGltcGxlbWVudGF0aW9uIHdyb3RlIGBtZXRhLnVzZXJEYXRhW3Byb3BlcnR5XWAgYW5kIHJlcG9ydGVkIHN1Y2Nlc3MuXG4gICAgICogYHVzZXJEYXRhYCBpcyBpbXBvcnRlciBjb25maWd1cmF0aW9uIOKAlCBpdCBpcyBub3QgdGhlIG1hdGVyaWFsJ3MgcHJvcGVydHkgdGFibGUsIHNvXG4gICAgICogdGhlIHNlcmlhbGl6ZWQgdmFsdWUgbmV2ZXIgY2hhbmdlZCwgc3Vydml2ZWQgcmVpbXBvcnQsIGFuZCB0aGUgcnVudGltZSBrZXB0XG4gICAgICogcmVzb2x2aW5nIHRoZSBvbGQgcmVmZXJlbmNlLiBBIG1ldGEtb25seSB3cml0ZSBjYW5ub3QgYWZmZWN0IGEgbWF0ZXJpYWwsIHNvIGl0IG11c3RcbiAgICAgKiBuZXZlciBiZSByZXBvcnRlZCBhcyBvbmUgKCMyNCkuXG4gICAgICpcbiAgICAgKiBPbmx5IHN0YW5kYWxvbmUgYC5tdGxgIGFzc2V0cyBhcmUgd3JpdGFibGUgaGVyZS4gQSBtYXRlcmlhbCBlbWJlZGRlZCBpbiBhbiBpbXBvcnRlZFxuICAgICAqIG1vZGVsIChGQlgvZ2xURiBzdWJhc3NldCkgaXMgcmVnZW5lcmF0ZWQgYnkgdGhhdCBtb2RlbCdzIGltcG9ydGVyIGFuZCBoYXMgbm9cbiAgICAgKiBgLm10bGAgZmlsZSBvZiBpdHMgb3duOyB0aGF0IGNhc2UgcmV0dXJucyBhbiBleHBsaWNpdCB1bnN1cHBvcnRlZCBlcnJvciByYXRoZXIgdGhhblxuICAgICAqIGEgc3VjY2VzcyB0aGUgY2FsbGVyIGNhbm5vdCB2ZXJpZnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRNYXRlcmlhbFByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIGlmIChhcmdzLnZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eSAocGFzcyBudWxsIHRvIGNsZWFyIHRoZSBwcm9wZXJ0eSknKTtcblxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldChhcmdzLnVybCk7XG4gICAgICAgIGlmIChyZXNvbHZlZC5lcnJvcikgcmV0dXJuIGVycm9yUmVzdWx0KHJlc29sdmVkLmVycm9yKTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5maWxlUGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDb3VsZCBub3QgcmVzb2x2ZSBhbiBvbi1kaXNrIGZpbGUgZm9yICR7YXJncy51cmx9LiBzZXRfcHJvcGVydHkgbmVlZHMgYSBzdGFuZGFsb25lIC5tdGwgYXNzZXQuYCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhdGguZXh0bmFtZShyZXNvbHZlZC5maWxlUGF0aCkudG9Mb3dlckNhc2UoKSAhPT0gJy5tdGwnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgYHNldF9wcm9wZXJ0eSBjYW5ub3QgZWRpdCAnJHthcmdzLnVybH0nOiBpdCByZXNvbHZlcyB0byAke3BhdGguYmFzZW5hbWUocmVzb2x2ZWQuZmlsZVBhdGgpfSwgbm90IGEgc3RhbmRhbG9uZSAubXRsIGFzc2V0LiBgICtcbiAgICAgICAgICAgICAgICAnTWF0ZXJpYWxzIGVtYmVkZGVkIGluIGFuIGltcG9ydGVkIG1vZGVsIGFyZSByZWdlbmVyYXRlZCBieSB0aGF0IG1vZGVsXFwncyBpbXBvcnRlciDigJQgJyArXG4gICAgICAgICAgICAgICAgJ2VkaXQgdGhlbSBpbiB0aGUgSW5zcGVjdG9yLCBvciBleHRyYWN0IHRoZSBtYXRlcmlhbCB0byBhIC5tdGwgYXNzZXQgZmlyc3QuJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBtYXRlcmlhbDogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbWF0ZXJpYWwgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVhZCBtYXRlcmlhbCBhc3NldCAke3Jlc29sdmVkLmZpbGVQYXRofTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW1hdGVyaWFsIHx8IG1hdGVyaWFsLl9fdHlwZV9fICE9PSAnY2MuTWF0ZXJpYWwnKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYCR7YXJncy51cmx9IGlzIG5vdCBhIGNjLk1hdGVyaWFsIGFzc2V0IChmb3VuZCBfX3R5cGVfXz0ke21hdGVyaWFsPy5fX3R5cGVfXyA/PyAnbm9uZSd9KWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGVjaElkeDogbnVtYmVyID0gdHlwZW9mIG1hdGVyaWFsLl90ZWNoSWR4ID09PSAnbnVtYmVyJyA/IG1hdGVyaWFsLl90ZWNoSWR4IDogMDtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG1hdGVyaWFsLl9wcm9wcykpIG1hdGVyaWFsLl9wcm9wcyA9IFtdO1xuICAgICAgICB3aGlsZSAobWF0ZXJpYWwuX3Byb3BzLmxlbmd0aCA8PSB0ZWNoSWR4KSBtYXRlcmlhbC5fcHJvcHMucHVzaCh7fSk7XG4gICAgICAgIGNvbnN0IHByb3BzID0gbWF0ZXJpYWwuX3Byb3BzW3RlY2hJZHhdIHx8IChtYXRlcmlhbC5fcHJvcHNbdGVjaElkeF0gPSB7fSk7XG5cbiAgICAgICAgY29uc3QgY2xlYXJpbmcgPSBhcmdzLnZhbHVlID09PSBudWxsO1xuICAgICAgICBpZiAoY2xlYXJpbmcpIGRlbGV0ZSBwcm9wc1thcmdzLnByb3BlcnR5XTtcbiAgICAgICAgZWxzZSBwcm9wc1thcmdzLnByb3BlcnR5XSA9IGFyZ3MudmFsdWU7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBhcmdzLnVybCwgSlNPTi5zdHJpbmdpZnkobWF0ZXJpYWwsIG51bGwsIDIpKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgc2F2ZS1hc3NldCByZWplY3RlZCAke2FyZ3MudXJsfTogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVpbXBvcnQtYXNzZXQnLCBhcmdzLnVybCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYE1hdGVyaWFsIHdyaXR0ZW4gYnV0IHJlaW1wb3J0LWFzc2V0IGZhaWxlZCBmb3IgJHthcmdzLnVybH06ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZWFkIHRoZSBhc3NldCBiYWNrLiBBIHN1Y2Nlc3MgZW52ZWxvcGUgaGVyZSBtZWFucyB0aGUgc2VyaWFsaXplZCBwcm9wZXJ0eVxuICAgICAgICAvLyBhY3R1YWxseSBjaGFuZ2VkIG9uIGRpc2sg4oCUIG5ldmVyIHRoYXQgYSBtZXNzYWdlIHJlc29sdmVkIHdpdGhvdXQgdGhyb3dpbmcuXG4gICAgICAgIGNvbnN0IHZlcmlmaWNhdGlvbiA9IHRoaXMudmVyaWZ5U2F2ZWRQcm9wZXJ0eShyZXNvbHZlZC5maWxlUGF0aCwgdGVjaElkeCwgYXJncy5wcm9wZXJ0eSwgYXJncy52YWx1ZSwgY2xlYXJpbmcpO1xuICAgICAgICBpZiAoIXZlcmlmaWNhdGlvbi52ZXJpZmllZCkgcmV0dXJuIGVycm9yUmVzdWx0KHZlcmlmaWNhdGlvbi5lcnJvciEpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgeyB1cmw6IGFyZ3MudXJsLCBmaWxlOiByZXNvbHZlZC5maWxlUGF0aCwgcHJvcGVydHk6IGFyZ3MucHJvcGVydHksIHZhbHVlOiBhcmdzLnZhbHVlLCB0ZWNobmlxdWVJbmRleDogdGVjaElkeCwgY2xlYXJlZDogY2xlYXJpbmcgfSxcbiAgICAgICAgICAgIGNsZWFyaW5nXG4gICAgICAgICAgICAgICAgPyBgUHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIGNsZWFyZWQgZnJvbSBtYXRlcmlhbCAke2FyZ3MudXJsfSAodmVyaWZpZWQgb24gZGlzaylgXG4gICAgICAgICAgICAgICAgOiBgUHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIHNldCBvbiBtYXRlcmlhbCAke2FyZ3MudXJsfSAodmVyaWZpZWQgb24gZGlzaylgXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB2ZXJpZnlTYXZlZFByb3BlcnR5KFxuICAgICAgICBmaWxlUGF0aDogc3RyaW5nLCB0ZWNoSWR4OiBudW1iZXIsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnksIGNsZWFyaW5nOiBib29sZWFuXG4gICAgKTogeyB2ZXJpZmllZDogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfSB7XG4gICAgICAgIGxldCBzYXZlZDogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc2F2ZWQgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBlcnJvcjogYENvdWxkIG5vdCByZS1yZWFkICR7ZmlsZVBhdGh9IHRvIHZlcmlmeSB0aGUgd3JpdGU6ICR7ZXJyLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNhdmVkUHJvcHMgPSBBcnJheS5pc0FycmF5KHNhdmVkPy5fcHJvcHMpID8gc2F2ZWQuX3Byb3BzW3RlY2hJZHhdIDogdW5kZWZpbmVkO1xuICAgICAgICBpZiAoY2xlYXJpbmcpIHtcbiAgICAgICAgICAgIGlmIChzYXZlZFByb3BzICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzYXZlZFByb3BzLCBwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIGVycm9yOiBgV3JvdGUgdGhlIG1hdGVyaWFsIGJ1dCAnJHtwcm9wZXJ0eX0nIGlzIHN0aWxsIHByZXNlbnQgaW4gX3Byb3BzWyR7dGVjaElkeH1dIGFmdGVyIHJlaW1wb3J0LmAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHZlcmlmaWVkOiB0cnVlIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFzYXZlZFByb3BzIHx8IEpTT04uc3RyaW5naWZ5KHNhdmVkUHJvcHNbcHJvcGVydHldKSAhPT0gSlNPTi5zdHJpbmdpZnkodmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIGVycm9yOiBgV3JvdGUgdGhlIG1hdGVyaWFsIGJ1dCAnJHtwcm9wZXJ0eX0nIGRpZCBub3QgcGVyc2lzdCBpbiBfcHJvcHNbJHt0ZWNoSWR4fV0gYWZ0ZXIgcmVpbXBvcnQuYCB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHZlcmlmaWVkOiB0cnVlIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0TWF0ZXJpYWxzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGFyZ3MucGF0dGVybiB8fCAnZGI6Ly9hc3NldHMvKiovKi5tdGwnO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBtYXRlcmlhbHM6IGFzc2V0cywgY291bnQ6IChhc3NldHMgYXMgYW55W10pLmxlbmd0aCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG4iXX0=