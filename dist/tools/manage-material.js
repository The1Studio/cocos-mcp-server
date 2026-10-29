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
                passIndex: {
                    type: 'number',
                    description: '[set_property] Pass index within the selected technique whose `_props` entry is written (default 0). This is a pass index, not the technique index (`_techIdx`).',
                    default: 0
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
        // `_props` is indexed by PASS of the selected technique, not by technique: a
        // technique-1 material with one pass keeps its values in `_props[0]` (#1640).
        const techIdx = typeof material._techIdx === 'number' ? material._techIdx : 0;
        const passIdx = args.passIndex === undefined ? 0 : args.passIndex;
        if (!Number.isInteger(passIdx) || passIdx < 0) {
            return (0, types_1.errorResult)(`passIndex must be a non-negative integer (got ${JSON.stringify(args.passIndex)})`);
        }
        if (!Array.isArray(material._props))
            material._props = [];
        while (material._props.length <= passIdx)
            material._props.push({});
        const props = material._props[passIdx] || (material._props[passIdx] = {});
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
        const verification = this.verifySavedProperty(resolved.filePath, passIdx, args.property, args.value, clearing);
        if (!verification.verified)
            return (0, types_1.errorResult)(verification.error);
        return (0, types_1.successResult)({ url: args.url, file: resolved.filePath, property: args.property, value: args.value, techniqueIndex: techIdx, passIndex: passIdx, cleared: clearing }, clearing
            ? `Property '${args.property}' cleared from material ${args.url} (verified on disk)`
            : `Property '${args.property}' set on material ${args.url} (verified on disk)`);
    }
    verifySavedProperty(filePath, passIdx, property, value, clearing) {
        let saved;
        try {
            saved = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        catch (err) {
            return { verified: false, error: `Could not re-read ${filePath} to verify the write: ${err.message}` };
        }
        const savedProps = Array.isArray(saved === null || saved === void 0 ? void 0 : saved._props) ? saved._props[passIdx] : undefined;
        if (clearing) {
            if (savedProps && Object.prototype.hasOwnProperty.call(savedProps, property)) {
                return { verified: false, error: `Wrote the material but '${property}' is still present in _props[${passIdx}] after reimport.` };
            }
            return { verified: true };
        }
        if (!savedProps || JSON.stringify(savedProps[property]) !== JSON.stringify(value)) {
            return { verified: false, error: `Wrote the material but '${property}' did not persist in _props[${passIdx}] after reimport.` };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW1hdGVyaWFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1tYXRlcmlhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsb0RBQW1EO0FBRW5ELE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN6QyxVQUFVLEVBQUUsYUFBYTtJQUN6QixPQUFPLEVBQUUsRUFBRTtJQUNYLFdBQVcsRUFBRSxDQUFDO0lBQ2Qsa0JBQWtCLEVBQUUsRUFBRTtJQUN0QixTQUFTLEVBQUUsRUFBRTtJQUNiLGNBQWMsRUFBRSxJQUFJO0lBQ3BCLFVBQVUsRUFBRSxDQUFDO0lBQ2IsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ2hCLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUNmLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQztDQUNqQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVaLE1BQWEsY0FBZSxTQUFRLGlDQUFjO0lBQWxEOztRQUNhLFNBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUN6QixnQkFBVyxHQUFHLDJXQUEyVyxDQUFDO1FBQzFYLFlBQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3pELGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQztvQkFDcEQsV0FBVyxFQUFFLDJMQUEyTDtpQkFDM007Z0JBQ0QsR0FBRyxFQUFF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TSxFQUFFLEtBQUssRUFBRyxNQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDakYsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUF6TEQsd0NBeUxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyByZXNvbHZlQXNzZXQgfSBmcm9tICcuLi91dGlscy9hc3NldC1wYXRoJztcclxuXHJcbmNvbnN0IERFRkFVTFRfTUFURVJJQUxfSlNPTiA9IEpTT04uc3RyaW5naWZ5KHtcclxuICAgIFwiX190eXBlX19cIjogXCJjYy5NYXRlcmlhbFwiLFxyXG4gICAgXCJfbmFtZVwiOiBcIlwiLFxyXG4gICAgXCJfb2JqRmxhZ3NcIjogMCxcclxuICAgIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcclxuICAgIFwiX25hdGl2ZVwiOiBcIlwiLFxyXG4gICAgXCJfZWZmZWN0QXNzZXRcIjogbnVsbCxcclxuICAgIFwiX3RlY2hJZHhcIjogMCxcclxuICAgIFwiX2RlZmluZXNcIjogW3t9XSxcclxuICAgIFwiX3N0YXRlc1wiOiBbe31dLFxyXG4gICAgXCJfcHJvcHNcIjogW3t9XVxyXG59LCBudWxsLCAyKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VNYXRlcmlhbCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX21hdGVyaWFsJztcclxuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBtYXRlcmlhbCBhc3NldHMuIEFjdGlvbnM6IGNyZWF0ZSwgZ2V0X2luZm8sIHNldF9wcm9wZXJ0eSwgbGlzdC4gTWF0ZXJpYWxzIGNvbnRyb2wgdmlzdWFsIGFwcGVhcmFuY2Ugb2YgbWVzaGVzLiBVc2UgZ2V0X2luZm8gdG8gaW5zcGVjdCBjdXJyZW50IHByb3BlcnRpZXMgYmVmb3JlIG1vZGlmeWluZy4gc2V0X3Byb3BlcnR5IHdyaXRlcyB0aGUgc2VyaWFsaXplZCBgX3Byb3BzYCBlbnRyeSBvZiBhIHN0YW5kYWxvbmUgLm10bCBhc3NldCBhbmQgdmVyaWZpZXMgaXQgb24gZGlzazsgbWF0ZXJpYWxzIGVtYmVkZGVkIGluIGFuIGltcG9ydGVkIG1vZGVsIChGQlgvZ2xURiBzdWJhc3NldHMpIGFyZSByZWFkLW9ubHkgaGVyZS4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdsaXN0J107XHJcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcclxuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NyZWF0ZScsICdnZXRfaW5mbycsICdzZXRfcHJvcGVydHknLCAnbGlzdCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlPWNyZWF0ZSBuZXcgLm10bCBhc3NldCwgZ2V0X2luZm89cXVlcnkgYXNzZXQgaW5mbyBhbmQgbWV0YSwgc2V0X3Byb3BlcnR5PXdyaXRlIGEgc2VyaWFsaXplZCBtYXRlcmlhbCBwcm9wZXJ0eSBpbnRvIHRoZSAubXRsIGFzc2V0LCBsaXN0PWxpc3QgYWxsIG1hdGVyaWFsIGFzc2V0cydcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdXJsOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZSwgZ2V0X2luZm8sIHNldF9wcm9wZXJ0eV0gQXNzZXQgREIgVVJMIG9yIFVVSUQgKGUuZy4sIGRiOi8vYXNzZXRzL21hdGVyaWFscy9NeU1hdGVyaWFsLm10bCkuIHNldF9wcm9wZXJ0eSByZXF1aXJlcyBhIHN0YW5kYWxvbmUgLm10bCBhc3NldCDigJQgbWF0ZXJpYWxzIGVtYmVkZGVkIGluIGFuIGltcG9ydGVkIG1vZGVsIChGQlgvZ2xURiBzdWJhc3NldHMpIGFyZSBub3Qgd3JpdGFibGUgdGhyb3VnaCB0aGlzIHRvb2wuJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFNlcmlhbGl6ZWQgbWF0ZXJpYWwgcHJvcGVydHkgbmFtZSwgYXMgaXQgYXBwZWFycyBpbiB0aGUgLm10bCBgX3Byb3BzYCBibG9jayAoZS5nLiwgbWFpblRleHR1cmUsIGFsYmVkbywgb2NjbHVzaW9uTWFwKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gVmFsdWUgd3JpdHRlbiB2ZXJiYXRpbSBpbnRvIGBfcHJvcHNgLiBVc2UgdGhlIHNlcmlhbGl6ZWQgZm9ybTogbnVtYmVycy9ib29sZWFucyBhcy1pcywgY29sb3JzIGFzIHtcIl9fdHlwZV9fXCI6XCJjYy5Db2xvclwiLFwiclwiOjI1NSxcImdcIjowLFwiYlwiOjAsXCJhXCI6MjU1fSwgYXNzZXQgcmVmZXJlbmNlcyBhcyB7XCJfX3V1aWRfX1wiOlwiPHV1aWQ+XCIsXCJfX2V4cGVjdGVkVHlwZV9fXCI6XCJjYy5UZXh0dXJlMkRcIn0uIFBhc3MgbnVsbCB0byBjbGVhciB0aGUgcHJvcGVydHkgKHRoZSBrZXkgaXMgcmVtb3ZlZCBzbyB0aGUgZWZmZWN0IGRlZmF1bHQgYXBwbGllcykuJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwYXNzSW5kZXg6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQYXNzIGluZGV4IHdpdGhpbiB0aGUgc2VsZWN0ZWQgdGVjaG5pcXVlIHdob3NlIGBfcHJvcHNgIGVudHJ5IGlzIHdyaXR0ZW4gKGRlZmF1bHQgMCkuIFRoaXMgaXMgYSBwYXNzIGluZGV4LCBub3QgdGhlIHRlY2huaXF1ZSBpbmRleCAoYF90ZWNoSWR4YCkuJyxcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcGF0dGVybjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tsaXN0XSBHbG9iIHBhdHRlcm4gdG8gZmlsdGVyIG1hdGVyaWFscyAoZGVmYXVsdDogZGI6Ly9hc3NldHMvKiovKi5tdGwpJyxcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qLm10bCdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcblxyXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XHJcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVNYXRlcmlhbChhcmdzKSxcclxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0TWF0ZXJpYWxJbmZvKGFyZ3MpLFxyXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TWF0ZXJpYWxQcm9wZXJ0eShhcmdzKSxcclxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0TWF0ZXJpYWxzKGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZU1hdGVyaWFsKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBjcmVhdGUnKTtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgYXJncy51cmwsIERFRkFVTFRfTUFURVJJQUxfSlNPTik7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxyXG4gICAgICAgICAgICAgICAgeyB1cmw6IGFyZ3MudXJsLCB1dWlkOiAocmVzdWx0IGFzIGFueSk/LnV1aWQgfSxcclxuICAgICAgICAgICAgICAgIGBNYXRlcmlhbCBjcmVhdGVkIGF0ICR7YXJncy51cmx9YFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TWF0ZXJpYWxJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBtZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtbWV0YScsIGFyZ3MudXJsKTtcclxuICAgICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgICAgICAvLyBtZXRhIG1heSBub3QgYmUgYXZhaWxhYmxlIGZvciBhbGwgYXNzZXRzXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBpbmZvLCBtZXRhIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV3JpdGUgYSBwcm9wZXJ0eSBpbnRvIHRoZSBtYXRlcmlhbCdzIHNlcmlhbGl6ZWQgYF9wcm9wc2AgYmxvY2suXHJcbiAgICAgKlxyXG4gICAgICogVGhlIHByZXZpb3VzIGltcGxlbWVudGF0aW9uIHdyb3RlIGBtZXRhLnVzZXJEYXRhW3Byb3BlcnR5XWAgYW5kIHJlcG9ydGVkIHN1Y2Nlc3MuXHJcbiAgICAgKiBgdXNlckRhdGFgIGlzIGltcG9ydGVyIGNvbmZpZ3VyYXRpb24g4oCUIGl0IGlzIG5vdCB0aGUgbWF0ZXJpYWwncyBwcm9wZXJ0eSB0YWJsZSwgc29cclxuICAgICAqIHRoZSBzZXJpYWxpemVkIHZhbHVlIG5ldmVyIGNoYW5nZWQsIHN1cnZpdmVkIHJlaW1wb3J0LCBhbmQgdGhlIHJ1bnRpbWUga2VwdFxyXG4gICAgICogcmVzb2x2aW5nIHRoZSBvbGQgcmVmZXJlbmNlLiBBIG1ldGEtb25seSB3cml0ZSBjYW5ub3QgYWZmZWN0IGEgbWF0ZXJpYWwsIHNvIGl0IG11c3RcclxuICAgICAqIG5ldmVyIGJlIHJlcG9ydGVkIGFzIG9uZSAoIzI0KS5cclxuICAgICAqXHJcbiAgICAgKiBPbmx5IHN0YW5kYWxvbmUgYC5tdGxgIGFzc2V0cyBhcmUgd3JpdGFibGUgaGVyZS4gQSBtYXRlcmlhbCBlbWJlZGRlZCBpbiBhbiBpbXBvcnRlZFxyXG4gICAgICogbW9kZWwgKEZCWC9nbFRGIHN1YmFzc2V0KSBpcyByZWdlbmVyYXRlZCBieSB0aGF0IG1vZGVsJ3MgaW1wb3J0ZXIgYW5kIGhhcyBub1xyXG4gICAgICogYC5tdGxgIGZpbGUgb2YgaXRzIG93bjsgdGhhdCBjYXNlIHJldHVybnMgYW4gZXhwbGljaXQgdW5zdXBwb3J0ZWQgZXJyb3IgcmF0aGVyIHRoYW5cclxuICAgICAqIGEgc3VjY2VzcyB0aGUgY2FsbGVyIGNhbm5vdCB2ZXJpZnkuXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0TWF0ZXJpYWxQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XHJcbiAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcclxuICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHkgKHBhc3MgbnVsbCB0byBjbGVhciB0aGUgcHJvcGVydHkpJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KGFyZ3MudXJsKTtcclxuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiBlcnJvclJlc3VsdChyZXNvbHZlZC5lcnJvcik7XHJcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5maWxlUGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYENvdWxkIG5vdCByZXNvbHZlIGFuIG9uLWRpc2sgZmlsZSBmb3IgJHthcmdzLnVybH0uIHNldF9wcm9wZXJ0eSBuZWVkcyBhIHN0YW5kYWxvbmUgLm10bCBhc3NldC5gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHBhdGguZXh0bmFtZShyZXNvbHZlZC5maWxlUGF0aCkudG9Mb3dlckNhc2UoKSAhPT0gJy5tdGwnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcclxuICAgICAgICAgICAgICAgIGBzZXRfcHJvcGVydHkgY2Fubm90IGVkaXQgJyR7YXJncy51cmx9JzogaXQgcmVzb2x2ZXMgdG8gJHtwYXRoLmJhc2VuYW1lKHJlc29sdmVkLmZpbGVQYXRoKX0sIG5vdCBhIHN0YW5kYWxvbmUgLm10bCBhc3NldC4gYCArXHJcbiAgICAgICAgICAgICAgICAnTWF0ZXJpYWxzIGVtYmVkZGVkIGluIGFuIGltcG9ydGVkIG1vZGVsIGFyZSByZWdlbmVyYXRlZCBieSB0aGF0IG1vZGVsXFwncyBpbXBvcnRlciDigJQgJyArXHJcbiAgICAgICAgICAgICAgICAnZWRpdCB0aGVtIGluIHRoZSBJbnNwZWN0b3IsIG9yIGV4dHJhY3QgdGhlIG1hdGVyaWFsIHRvIGEgLm10bCBhc3NldCBmaXJzdC4nXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgbWF0ZXJpYWw6IGFueTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBtYXRlcmlhbCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHJlc29sdmVkLmZpbGVQYXRoLCAndXRmLTgnKSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVhZCBtYXRlcmlhbCBhc3NldCAke3Jlc29sdmVkLmZpbGVQYXRofTogJHtlcnIubWVzc2FnZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFtYXRlcmlhbCB8fCBtYXRlcmlhbC5fX3R5cGVfXyAhPT0gJ2NjLk1hdGVyaWFsJykge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYCR7YXJncy51cmx9IGlzIG5vdCBhIGNjLk1hdGVyaWFsIGFzc2V0IChmb3VuZCBfX3R5cGVfXz0ke21hdGVyaWFsPy5fX3R5cGVfXyA/PyAnbm9uZSd9KWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gYF9wcm9wc2AgaXMgaW5kZXhlZCBieSBQQVNTIG9mIHRoZSBzZWxlY3RlZCB0ZWNobmlxdWUsIG5vdCBieSB0ZWNobmlxdWU6IGFcclxuICAgICAgICAvLyB0ZWNobmlxdWUtMSBtYXRlcmlhbCB3aXRoIG9uZSBwYXNzIGtlZXBzIGl0cyB2YWx1ZXMgaW4gYF9wcm9wc1swXWAgKCMxNjQwKS5cclxuICAgICAgICBjb25zdCB0ZWNoSWR4OiBudW1iZXIgPSB0eXBlb2YgbWF0ZXJpYWwuX3RlY2hJZHggPT09ICdudW1iZXInID8gbWF0ZXJpYWwuX3RlY2hJZHggOiAwO1xyXG4gICAgICAgIGNvbnN0IHBhc3NJZHggPSBhcmdzLnBhc3NJbmRleCA9PT0gdW5kZWZpbmVkID8gMCA6IGFyZ3MucGFzc0luZGV4O1xyXG4gICAgICAgIGlmICghTnVtYmVyLmlzSW50ZWdlcihwYXNzSWR4KSB8fCBwYXNzSWR4IDwgMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYHBhc3NJbmRleCBtdXN0IGJlIGEgbm9uLW5lZ2F0aXZlIGludGVnZXIgKGdvdCAke0pTT04uc3RyaW5naWZ5KGFyZ3MucGFzc0luZGV4KX0pYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShtYXRlcmlhbC5fcHJvcHMpKSBtYXRlcmlhbC5fcHJvcHMgPSBbXTtcclxuICAgICAgICB3aGlsZSAobWF0ZXJpYWwuX3Byb3BzLmxlbmd0aCA8PSBwYXNzSWR4KSBtYXRlcmlhbC5fcHJvcHMucHVzaCh7fSk7XHJcbiAgICAgICAgY29uc3QgcHJvcHMgPSBtYXRlcmlhbC5fcHJvcHNbcGFzc0lkeF0gfHwgKG1hdGVyaWFsLl9wcm9wc1twYXNzSWR4XSA9IHt9KTtcclxuXHJcbiAgICAgICAgY29uc3QgY2xlYXJpbmcgPSBhcmdzLnZhbHVlID09PSBudWxsO1xyXG4gICAgICAgIGlmIChjbGVhcmluZykgZGVsZXRlIHByb3BzW2FyZ3MucHJvcGVydHldO1xyXG4gICAgICAgIGVsc2UgcHJvcHNbYXJncy5wcm9wZXJ0eV0gPSBhcmdzLnZhbHVlO1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgYXJncy51cmwsIEpTT04uc3RyaW5naWZ5KG1hdGVyaWFsLCBudWxsLCAyKSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBzYXZlLWFzc2V0IHJlamVjdGVkICR7YXJncy51cmx9OiAke2Vyci5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFyZ3MudXJsKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYE1hdGVyaWFsIHdyaXR0ZW4gYnV0IHJlaW1wb3J0LWFzc2V0IGZhaWxlZCBmb3IgJHthcmdzLnVybH06ICR7ZXJyLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBSZWFkIHRoZSBhc3NldCBiYWNrLiBBIHN1Y2Nlc3MgZW52ZWxvcGUgaGVyZSBtZWFucyB0aGUgc2VyaWFsaXplZCBwcm9wZXJ0eVxyXG4gICAgICAgIC8vIGFjdHVhbGx5IGNoYW5nZWQgb24gZGlzayDigJQgbmV2ZXIgdGhhdCBhIG1lc3NhZ2UgcmVzb2x2ZWQgd2l0aG91dCB0aHJvd2luZy5cclxuICAgICAgICBjb25zdCB2ZXJpZmljYXRpb24gPSB0aGlzLnZlcmlmeVNhdmVkUHJvcGVydHkocmVzb2x2ZWQuZmlsZVBhdGgsIHBhc3NJZHgsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWUsIGNsZWFyaW5nKTtcclxuICAgICAgICBpZiAoIXZlcmlmaWNhdGlvbi52ZXJpZmllZCkgcmV0dXJuIGVycm9yUmVzdWx0KHZlcmlmaWNhdGlvbi5lcnJvciEpO1xyXG5cclxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcclxuICAgICAgICAgICAgeyB1cmw6IGFyZ3MudXJsLCBmaWxlOiByZXNvbHZlZC5maWxlUGF0aCwgcHJvcGVydHk6IGFyZ3MucHJvcGVydHksIHZhbHVlOiBhcmdzLnZhbHVlLCB0ZWNobmlxdWVJbmRleDogdGVjaElkeCwgcGFzc0luZGV4OiBwYXNzSWR4LCBjbGVhcmVkOiBjbGVhcmluZyB9LFxyXG4gICAgICAgICAgICBjbGVhcmluZ1xyXG4gICAgICAgICAgICAgICAgPyBgUHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIGNsZWFyZWQgZnJvbSBtYXRlcmlhbCAke2FyZ3MudXJsfSAodmVyaWZpZWQgb24gZGlzaylgXHJcbiAgICAgICAgICAgICAgICA6IGBQcm9wZXJ0eSAnJHthcmdzLnByb3BlcnR5fScgc2V0IG9uIG1hdGVyaWFsICR7YXJncy51cmx9ICh2ZXJpZmllZCBvbiBkaXNrKWBcclxuICAgICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdmVyaWZ5U2F2ZWRQcm9wZXJ0eShcclxuICAgICAgICBmaWxlUGF0aDogc3RyaW5nLCBwYXNzSWR4OiBudW1iZXIsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnksIGNsZWFyaW5nOiBib29sZWFuXHJcbiAgICApOiB7IHZlcmlmaWVkOiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9IHtcclxuICAgICAgICBsZXQgc2F2ZWQ6IGFueTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBzYXZlZCA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmLTgnKSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBlcnJvcjogYENvdWxkIG5vdCByZS1yZWFkICR7ZmlsZVBhdGh9IHRvIHZlcmlmeSB0aGUgd3JpdGU6ICR7ZXJyLm1lc3NhZ2V9YCB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBzYXZlZFByb3BzID0gQXJyYXkuaXNBcnJheShzYXZlZD8uX3Byb3BzKSA/IHNhdmVkLl9wcm9wc1twYXNzSWR4XSA6IHVuZGVmaW5lZDtcclxuICAgICAgICBpZiAoY2xlYXJpbmcpIHtcclxuICAgICAgICAgICAgaWYgKHNhdmVkUHJvcHMgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNhdmVkUHJvcHMsIHByb3BlcnR5KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCBlcnJvcjogYFdyb3RlIHRoZSBtYXRlcmlhbCBidXQgJyR7cHJvcGVydHl9JyBpcyBzdGlsbCBwcmVzZW50IGluIF9wcm9wc1ske3Bhc3NJZHh9XSBhZnRlciByZWltcG9ydC5gIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHsgdmVyaWZpZWQ6IHRydWUgfTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFzYXZlZFByb3BzIHx8IEpTT04uc3RyaW5naWZ5KHNhdmVkUHJvcHNbcHJvcGVydHldKSAhPT0gSlNPTi5zdHJpbmdpZnkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZlcmlmaWVkOiBmYWxzZSwgZXJyb3I6IGBXcm90ZSB0aGUgbWF0ZXJpYWwgYnV0ICcke3Byb3BlcnR5fScgZGlkIG5vdCBwZXJzaXN0IGluIF9wcm9wc1ske3Bhc3NJZHh9XSBhZnRlciByZWltcG9ydC5gIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB7IHZlcmlmaWVkOiB0cnVlIH07XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0TWF0ZXJpYWxzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBhcmdzLnBhdHRlcm4gfHwgJ2RiOi8vYXNzZXRzLyoqLyoubXRsJztcclxuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1hdGVyaWFsczogYXNzZXRzLCBjb3VudDogKGFzc2V0cyBhcyBhbnlbXSkubGVuZ3RoIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==