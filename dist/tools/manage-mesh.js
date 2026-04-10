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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW1lc2guanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLW1lc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLFVBQVcsU0FBUSxpQ0FBYztJQUE5Qzs7UUFDYSxTQUFJLEdBQUcsYUFBYSxDQUFDO1FBQ3JCLGdCQUFXLEdBQUcsb01BQW9NLENBQUM7UUFDbk4sWUFBTyxHQUFHLENBQUMsVUFBVSxFQUFFLE1BQU0sRUFBRSxtQkFBbUIsRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBQzdFLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUUsbUJBQW1CLEVBQUUsdUJBQXVCLENBQUM7b0JBQ3hFLFdBQVcsRUFBRSxrS0FBa0s7aUJBQ2xMO2dCQUNELElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLDRCQUE0QixFQUFFO2dCQUNuRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxzREFBc0QsRUFBRSxPQUFPLEVBQUUsdUJBQXVCLEVBQUU7Z0JBQ2xJLFFBQVEsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGlGQUFpRixFQUFFO2dCQUM1SCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsbUJBQW1CLEVBQUUsZUFBZSxFQUFFLFlBQVksQ0FBQztvQkFDMUQsV0FBVyxFQUFFLDRIQUE0SDtpQkFDNUk7Z0JBQ0QsS0FBSyxFQUFFLEVBQUUsV0FBVyxFQUFFLHVEQUF1RCxFQUFFO2FBQ2xGO1lBQ0QsUUFBUSxFQUFFLENBQUMs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QUFLLENBQUMsbUJBQW1CLENBQUMsSUFBUztRQUN2QyxJQUFJLENBQUM7WUFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0RBQWdELENBQUMsQ0FBQztZQUN6RixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0RBQWdELENBQUMsQ0FBQztZQUN6RixJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztnQkFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyw2Q0FBNkMsQ0FBQyxDQUFDO1lBQ2hHLE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO2dCQUN6RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLHlCQUF5QjtnQkFDM0QsSUFBSSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUM7YUFDbkQsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxFQUFFLGdCQUFnQixJQUFJLENBQUMsUUFBUSxVQUFVLENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNKO0FBeEVELGdDQXdFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlTWVzaCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9tZXNoJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgbWVzaCBhc3NldHMgYW5kIE1lc2hSZW5kZXJlciBjb21wb25lbnRzLiBBY3Rpb25zOiBnZXRfaW5mbywgbGlzdCwgZ2V0X3JlbmRlcmVyX2luZm8sIHNldF9yZW5kZXJlcl9wcm9wZXJ0eS4gUXVlcnkgbWVzaCBhc3NldHMgYW5kIGNvbnRyb2wgTWVzaFJlbmRlcmVyIHNoYWRvdy92aXNpYmlsaXR5IHNldHRpbmdzIG9uIG5vZGVzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0X2luZm8nLCAnbGlzdCcsICdnZXRfcmVuZGVyZXJfaW5mbycsICdzZXRfcmVuZGVyZXJfcHJvcGVydHknXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnbGlzdCcsICdnZXRfcmVuZGVyZXJfaW5mbycsICdzZXRfcmVuZGVyZXJfcHJvcGVydHknXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogZ2V0X2luZm89Z2V0IG1lc2ggYXNzZXQgaW5mbyBieSB1dWlkLCBsaXN0PWxpc3QgbWVzaCBhc3NldHMsIGdldF9yZW5kZXJlcl9pbmZvPWdldCBNZXNoUmVuZGVyZXIgb24gbm9kZSwgc2V0X3JlbmRlcmVyX3Byb3BlcnR5PXNldCBNZXNoUmVuZGVyZXIgcHJvcGVydHknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbZ2V0X2luZm9dIE1lc2ggYXNzZXQgVVVJRCcgfSxcbiAgICAgICAgICAgIHBhdHRlcm46IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiAoZGVmYXVsdDogZGI6Ly9hc3NldHMvKiovKi5tZXNoKScsIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cy8qKi8qLm1lc2gnIH0sXG4gICAgICAgICAgICBub2RlVXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdbZ2V0X3JlbmRlcmVyX2luZm8vc2V0X3JlbmRlcmVyX3Byb3BlcnR5XSBOb2RlIFVVSUQgd2l0aCBNZXNoUmVuZGVyZXIgY29tcG9uZW50JyB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3NoYWRvd0Nhc3RpbmdNb2RlJywgJ3JlY2VpdmVTaGFkb3cnLCAndmlzaWJpbGl0eSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9yZW5kZXJlcl9wcm9wZXJ0eV0gUHJvcGVydHkgdG8gc2V0OiBzaGFkb3dDYXN0aW5nTW9kZSAoMD1PRkYsMT1PTiksIHJlY2VpdmVTaGFkb3cgKGJvb2wpLCB2aXNpYmlsaXR5IChudW1iZXIgYml0bWFzayknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHsgZGVzY3JpcHRpb246ICdbc2V0X3JlbmRlcmVyX3Byb3BlcnR5XSBWYWx1ZSB0byBzZXQgZm9yIHRoZSBwcm9wZXJ0eScgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldE1lc2hJbmZvKGFyZ3MpLFxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0TWVzaGVzKGFyZ3MpLFxuICAgICAgICBnZXRfcmVuZGVyZXJfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0UmVuZGVyZXJJbmZvKGFyZ3MpLFxuICAgICAgICBzZXRfcmVuZGVyZXJfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldFJlbmRlcmVyUHJvcGVydHkoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TWVzaEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xuICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhcmdzLnV1aWQpO1xuICAgICAgICAgICAgbGV0IG1ldGE6IGFueSA9IG51bGw7XG4gICAgICAgICAgICB0cnkgeyBtZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtbWV0YScsIGFyZ3MudXVpZCk7IH0gY2F0Y2ggeyAvKiBvcHRpb25hbCAqLyB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGluZm8sIG1ldGEgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxpc3RNZXNoZXMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gYXJncy5wYXR0ZXJuIHx8ICdkYjovL2Fzc2V0cy8qKi8qLm1lc2gnO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBtZXNoZXM6IGFzc2V0cywgY291bnQ6IChhc3NldHMgYXMgYW55W10pLmxlbmd0aCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UmVuZGVyZXJJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBnZXRfcmVuZGVyZXJfaW5mbycpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRNZXNoUmVuZGVyZXJJbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFJlbmRlcmVyUHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIHNldF9yZW5kZXJlcl9wcm9wZXJ0eScpO1xuICAgICAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkIGZvciBzZXRfcmVuZGVyZXJfcHJvcGVydHknKTtcbiAgICAgICAgICAgIGlmIChhcmdzLnZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQgZm9yIHNldF9yZW5kZXJlcl9wcm9wZXJ0eScpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRNZXNoUmVuZGVyZXJQcm9wZXJ0eScsXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgYE1lc2hSZW5kZXJlci4ke2FyZ3MucHJvcGVydHl9IHVwZGF0ZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cbn1cbiJdfQ==