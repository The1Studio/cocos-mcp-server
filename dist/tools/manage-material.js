"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageMaterial = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
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
        this.description = 'Manage material assets. Actions: create, get_info, set_property, list. Materials control visual appearance of meshes. Use get_info to inspect current properties before modifying.';
        this.actions = ['create', 'get_info', 'set_property', 'list'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['create', 'get_info', 'set_property', 'list'],
                    description: 'Action to perform: create=create new .mtl asset, get_info=query asset info and meta, set_property=modify a material property in meta, list=list all material assets'
                },
                url: {
                    type: 'string',
                    description: '[create, get_info, set_property] Asset DB URL (e.g., db://assets/materials/MyMaterial.mtl)'
                },
                property: {
                    type: 'string',
                    description: '[set_property] Property name to set on the material'
                },
                value: {
                    description: '[set_property] Value to assign to the property'
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
    async setMaterialProperty(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for set_property');
            if (!args.property)
                return (0, types_1.errorResult)('property is required for set_property');
            if (args.value === undefined)
                return (0, types_1.errorResult)('value is required for set_property');
            let meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            if (!meta)
                meta = {};
            if (!meta.userData)
                meta.userData = {};
            meta.userData[args.property] = args.value;
            const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta);
            await Editor.Message.request('asset-db', 'save-asset-meta', args.url, metaStr);
            return (0, types_1.successResult)({ url: args.url, property: args.property, value: args.value }, `Property '${args.property}' set on material ${args.url}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW1hdGVyaWFsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1tYXRlcmlhbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN6QyxVQUFVLEVBQUUsYUFBYTtJQUN6QixPQUFPLEVBQUUsRUFBRTtJQUNYLFdBQVcsRUFBRSxDQUFDO0lBQ2Qsa0JBQWtCLEVBQUUsRUFBRTtJQUN0QixTQUFTLEVBQUUsRUFBRTtJQUNiLGNBQWMsRUFBRSxJQUFJO0lBQ3BCLFVBQVUsRUFBRSxDQUFDO0lBQ2IsVUFBVSxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ2hCLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztJQUNmLFFBQVEsRUFBRSxDQUFDLEVBQUUsQ0FBQztDQUNqQixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztBQUVaLE1BQWEsY0FBZSxTQUFRLGlDQUFjO0lBQWxEOztRQUNhLFNBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUN6QixnQkFBVyxHQUFHLG9MQUFvTCxDQUFDO1FBQ25NLFlBQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3pELGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sQ0FBQztvQkFDcEQsV0FBVyxFQUFFLHFLQUFxSztpQkFDckw7Z0JBQ0QsR0FBRyxFQUFFO29CQUNELElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0RkFBNEY7aUJBQzVHO2dCQUNELFFBQVEsRUFBRTtvQkFD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QztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQVM7UUFDakMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxzQkFBc0IsQ0FBQztZQUN2RCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQ3JGLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUcsTUFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQ2pGLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBbkdELHdDQW1HQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5jb25zdCBERUZBVUxUX01BVEVSSUFMX0pTT04gPSBKU09OLnN0cmluZ2lmeSh7XG4gICAgXCJfX3R5cGVfX1wiOiBcImNjLk1hdGVyaWFsXCIsXG4gICAgXCJfbmFtZVwiOiBcIlwiLFxuICAgIFwiX29iakZsYWdzXCI6IDAsXG4gICAgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgIFwiX25hdGl2ZVwiOiBcIlwiLFxuICAgIFwiX2VmZmVjdEFzc2V0XCI6IG51bGwsXG4gICAgXCJfdGVjaElkeFwiOiAwLFxuICAgIFwiX2RlZmluZXNcIjogW3t9XSxcbiAgICBcIl9zdGF0ZXNcIjogW3t9XSxcbiAgICBcIl9wcm9wc1wiOiBbe31dXG59LCBudWxsLCAyKTtcblxuZXhwb3J0IGNsYXNzIE1hbmFnZU1hdGVyaWFsIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX21hdGVyaWFsJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgbWF0ZXJpYWwgYXNzZXRzLiBBY3Rpb25zOiBjcmVhdGUsIGdldF9pbmZvLCBzZXRfcHJvcGVydHksIGxpc3QuIE1hdGVyaWFscyBjb250cm9sIHZpc3VhbCBhcHBlYXJhbmNlIG9mIG1lc2hlcy4gVXNlIGdldF9pbmZvIHRvIGluc3BlY3QgY3VycmVudCBwcm9wZXJ0aWVzIGJlZm9yZSBtb2RpZnlpbmcuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjcmVhdGUnLCAnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ2xpc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdsaXN0J10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogY3JlYXRlPWNyZWF0ZSBuZXcgLm10bCBhc3NldCwgZ2V0X2luZm89cXVlcnkgYXNzZXQgaW5mbyBhbmQgbWV0YSwgc2V0X3Byb3BlcnR5PW1vZGlmeSBhIG1hdGVyaWFsIHByb3BlcnR5IGluIG1ldGEsIGxpc3Q9bGlzdCBhbGwgbWF0ZXJpYWwgYXNzZXRzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHVybDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZSwgZ2V0X2luZm8sIHNldF9wcm9wZXJ0eV0gQXNzZXQgREIgVVJMIChlLmcuLCBkYjovL2Fzc2V0cy9tYXRlcmlhbHMvTXlNYXRlcmlhbC5tdGwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lIHRvIHNldCBvbiB0aGUgbWF0ZXJpYWwnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfcHJvcGVydHldIFZhbHVlIHRvIGFzc2lnbiB0byB0aGUgcHJvcGVydHknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0dGVybjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiB0byBmaWx0ZXIgbWF0ZXJpYWxzIChkZWZhdWx0OiBkYjovL2Fzc2V0cy8qKi8qLm10bCknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qLm10bCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlTWF0ZXJpYWwoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRNYXRlcmlhbEluZm8oYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TWF0ZXJpYWxQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdE1hdGVyaWFscyhhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVNYXRlcmlhbChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBjcmVhdGUnKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGFyZ3MudXJsLCBERUZBVUxUX01BVEVSSUFMX0pTT04pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgeyB1cmw6IGFyZ3MudXJsLCB1dWlkOiAocmVzdWx0IGFzIGFueSk/LnV1aWQgfSxcbiAgICAgICAgICAgICAgICBgTWF0ZXJpYWwgY3JlYXRlZCBhdCAke2FyZ3MudXJsfWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRNYXRlcmlhbEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy51cmwpO1xuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG1ldGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgYXJncy51cmwpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgLy8gbWV0YSBtYXkgbm90IGJlIGF2YWlsYWJsZSBmb3IgYWxsIGFzc2V0c1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBpbmZvLCBtZXRhIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0TWF0ZXJpYWxQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcbiAgICAgICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcblxuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCBhcmdzLnVybCk7XG4gICAgICAgICAgICBpZiAoIW1ldGEpIG1ldGEgPSB7fTtcbiAgICAgICAgICAgIGlmICghbWV0YS51c2VyRGF0YSkgbWV0YS51c2VyRGF0YSA9IHt9O1xuICAgICAgICAgICAgbWV0YS51c2VyRGF0YVthcmdzLnByb3BlcnR5XSA9IGFyZ3MudmFsdWU7XG5cbiAgICAgICAgICAgIGNvbnN0IG1ldGFTdHIgPSB0eXBlb2YgbWV0YSA9PT0gJ3N0cmluZycgPyBtZXRhIDogSlNPTi5zdHJpbmdpZnkobWV0YSk7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0LW1ldGEnLCBhcmdzLnVybCwgbWV0YVN0cik7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICB7IHVybDogYXJncy51cmwsIHByb3BlcnR5OiBhcmdzLnByb3BlcnR5LCB2YWx1ZTogYXJncy52YWx1ZSB9LFxuICAgICAgICAgICAgICAgIGBQcm9wZXJ0eSAnJHthcmdzLnByb3BlcnR5fScgc2V0IG9uIG1hdGVyaWFsICR7YXJncy51cmx9YFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxpc3RNYXRlcmlhbHMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gYXJncy5wYXR0ZXJuIHx8ICdkYjovL2Fzc2V0cy8qKi8qLm10bCc7XG4gICAgICAgICAgICBjb25zdCBhc3NldHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1hdGVyaWFsczogYXNzZXRzLCBjb3VudDogKGFzc2V0cyBhcyBhbnlbXSkubGVuZ3RoIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==