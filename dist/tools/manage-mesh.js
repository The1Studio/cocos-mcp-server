"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageMesh = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageMesh extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_mesh';
        this.description = 'Manage mesh assets and MeshRenderer components. Actions: get_info, list, get_renderer_info, set_renderer_property. Query mesh assets and control MeshRenderer shadow/visibility settings on nodes.';
        this.actions = ['get_info', 'list', 'get_renderer_info', 'set_renderer_property'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'list', 'get_renderer_info', 'set_renderer_property'],
                    description: 'Action: get_info=get mesh asset info by uuid, list=list mesh assets, get_renderer_info=get MeshRenderer on node, set_renderer_property=set MeshRenderer property'
                },
                uuid: { type: 'string', description: '[get_info] Mesh asset UUID' },
                pattern: { type: 'string', description: '[list] Glob pattern (default: db://assets/**/*.mesh)', default: 'db://assets/**/*.mesh' },
                nodeUuid: { type: 'string', description: '[get_renderer_info/set_renderer_property] Node UUID with MeshRenderer component' },
                property: {
                    type: 'string',
                    enum: ['shadowCastingMode', 'receiveShadow', 'visibility'],
                    description: '[set_renderer_property] Property to set: shadowCastingMode (0=OFF,1=ON), receiveShadow (bool), visibility (number bitmask)'
                },
                value: { description: '[set_renderer_property] Value to set for the property' }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getMeshInfo(args),
            list: (args) => this.listMeshes(args),
            get_renderer_info: (args) => this.getRendererInfo(args),
            set_renderer_property: (args) => this.setRendererProperty(args),
        };
    }
    async getMeshInfo(args) {
        try {
            if (!args.uuid)
                return (0, types_1.errorResult)('uuid is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.uuid);
            let meta = null;
            try {
                meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.uuid);
            }
            catch ( /* optional */_a) { /* optional */ }
            return (0, types_1.successResult)({ info, meta });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listMeshes(args) {
        try {
            const pattern = args.pattern || 'db://assets/**/*.mesh';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return (0, types_1.successResult)({ meshes: assets, count: assets.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getRendererInfo(args) {
        try {
            if (!args.nodeUuid)
                return (0, types_1.errorResult)('nodeUuid is required for get_renderer_info');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getMeshRendererInfo', args: [args.nodeUuid]
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setRendererProperty(args) {
        try {
            if (!args.nodeUuid)
                return (0, types_1.errorResult)('nodeUuid is required for set_renderer_property');
            if (!args.property)
                return (0, types_1.errorResult)('property is required for set_renderer_property');
            if (args.value === undefined)
                return (0, types_1.errorResult)('value is required for set_renderer_property');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setMeshRendererProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            return (0, types_1.successResult)(result, `MeshRenderer.${args.property} updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageMesh = ManageMesh;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW1lc2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLW1lc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLFVBQVcsU0FBUSxpQ0FBYztJQUE5Qzs7UUFDYSxTQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3JCLGdCQUFXLEdBQUcsb01BQW9NLENBQUM7UUFDbk4sWUFBTyxHQUFHLENBQUMsVUFBVSxFQUFFLE1BQU0sRUFBRSxtQkFBbUIsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBQzdFLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsdUJBQXVCLENBQUM7b0JBQ3hFLFdBQVcsRUFBRSxrS0FBa0s7aUJBQ2xMO2dCQUNELElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLDRCQUE0QixFQUFFO2dCQUNuRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxzREFBc0QsRUFBRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUU7Z0JBQ2xJLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGlGQUFpRixFQUFFO2dCQUM1SCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsbUJBQW1CLEVBQUUsZUFBZSxFQUFFLFlBQVksQ0FBQztvQkFDMUQsV0FBVyxFQUFFLDRIQUE0SDtpQkFDNUk7Z0JBQ0QsS0FBSyxFQUFFLEVBQUUsV0FBVyxFQUFFLHVEQUF1RCxFQUFFO2FBQ2xGO1lBQ0QsUUFBUSxFQUFFLENBQUMs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QUFLLENBQUMsbUJBQW1CLENBQUMsSUFBUztRQUN2QyxJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0RBQWdELENBQUMsQ0FBQztZQUN6RixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0RBQWdELENBQUMsQ0FBQztZQUN6RixJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztnQkFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyw2Q0FBNkMsQ0FBQyxDQUFDO1lBQ2hHLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO2dCQUN6RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLHlCQUF5QjtnQkFDM0QsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7YUFDbkQsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxFQUFFLGdCQUFnQixJQUFJLENBQUMsUUFBUSxVQUFVLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBeEVELGdDQXdFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlTWVzaCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX21lc2gnO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIG1lc2ggYXNzZXRzIGFuZCBNZXNoUmVuZGVyZXIgY29tcG9uZW50cy4gQWN0aW9uczogZ2V0X2luZm8sIGxpc3QsIGdldF9yZW5kZXJlcl9pbmZvLCBzZXRfcmVuZGVyZXJfcHJvcGVydHkuIFF1ZXJ5IG1lc2ggYXNzZXRzIGFuZCBjb250cm9sIE1lc2hSZW5kZXJlciBzaGFkb3cvdmlzaWJpbGl0eSBzZXR0aW5ncyBvbiBub2Rlcy4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0X2luZm8nLCAnbGlzdCcsICdnZXRfcmVuZGVyZXJfaW5mbycsICdzZXRfcmVuZGVyZXJfcHJvcGVydHknXTtcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnbGlzdCcsICdnZXRfcmVuZGVyZXJfaW5mbycsICdzZXRfcmVuZGVyZXJfcHJvcGVydHknXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBnZXRfaW5mbz1nZXQgbWVzaCBhc3NldCBpbmZvIGJ5IHV1aWQsIGxpc3Q9bGlzdCBtZXNoIGFzc2V0cywgZ2V0X3JlbmRlcmVyX2luZm89Z2V0IE1lc2hSZW5kZXJlciBvbiBub2RlLCBzZXRfcmVuZGVyZXJfcHJvcGVydHk9c2V0IE1lc2hSZW5kZXJlciBwcm9wZXJ0eSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbZ2V0X2luZm9dIE1lc2ggYXNzZXQgVVVJRCcgfSxcclxuICAgICAgICAgICAgcGF0dGVybjogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbbGlzdF0gR2xvYiBwYXR0ZXJuIChkZWZhdWx0OiBkYjovL2Fzc2V0cy8qKi8qLm1lc2gpJywgZGVmYXVsdDogJ2RiOi8vYXNzZXRzLyoqLyoubWVzaCcgfSxcclxuICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW2dldF9yZW5kZXJlcl9pbmZvL3NldF9yZW5kZXJlcl9wcm9wZXJ0eV0gTm9kZSBVVUlEIHdpdGggTWVzaFJlbmRlcmVyIGNvbXBvbmVudCcgfSxcclxuICAgICAgICAgICAgcHJvcGVydHk6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydzaGFkb3dDYXN0aW5nTW9kZScsICdyZWNlaXZlU2hhZG93JywgJ3Zpc2liaWxpdHknXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9yZW5kZXJlcl9wcm9wZXJ0eV0gUHJvcGVydHkgdG8gc2V0OiBzaGFkb3dDYXN0aW5nTW9kZSAoMD1PRkYsMT1PTiksIHJlY2VpdmVTaGFkb3cgKGJvb2wpLCB2aXNpYmlsaXR5IChudW1iZXIgYml0bWFzayknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHZhbHVlOiB7IGRlc2NyaXB0aW9uOiAnW3NldF9yZW5kZXJlcl9wcm9wZXJ0eV0gVmFsdWUgdG8gc2V0IGZvciB0aGUgcHJvcGVydHknIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRNZXNoSW5mbyhhcmdzKSxcclxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0TWVzaGVzKGFyZ3MpLFxyXG4gICAgICAgIGdldF9yZW5kZXJlcl9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRSZW5kZXJlckluZm8oYXJncyksXHJcbiAgICAgICAgc2V0X3JlbmRlcmVyX3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRSZW5kZXJlclByb3BlcnR5KGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldE1lc2hJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQgZm9yIGdldF9pbmZvJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy51dWlkKTtcclxuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRyeSB7IG1ldGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgYXJncy51dWlkKTsgfSBjYXRjaCB7IC8qIG9wdGlvbmFsICovIH1cclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBpbmZvLCBtZXRhIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGxpc3RNZXNoZXMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGFyZ3MucGF0dGVybiB8fCAnZGI6Ly9hc3NldHMvKiovKi5tZXNoJztcclxuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1lc2hlczogYXNzZXRzLCBjb3VudDogKGFzc2V0cyBhcyBhbnlbXSkubGVuZ3RoIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFJlbmRlcmVySW5mbyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGdldF9yZW5kZXJlcl9pbmZvJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRNZXNoUmVuZGVyZXJJbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldFJlbmRlcmVyUHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBzZXRfcmVuZGVyZXJfcHJvcGVydHknKTtcclxuICAgICAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkIGZvciBzZXRfcmVuZGVyZXJfcHJvcGVydHknKTtcclxuICAgICAgICAgICAgaWYgKGFyZ3MudmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCBmb3Igc2V0X3JlbmRlcmVyX3Byb3BlcnR5Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRNZXNoUmVuZGVyZXJQcm9wZXJ0eScsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5wcm9wZXJ0eSwgYXJncy52YWx1ZV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgYE1lc2hSZW5kZXJlci4ke2FyZ3MucHJvcGVydHl9IHVwZGF0ZWRgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcbn1cclxuIl19