"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageTerrain = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageTerrain extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_terrain';
        this.description = 'Manage Terrain components (3D only). Actions: get_info, set_property, get_layer_info, set_layer, get_height, set_height, list. Control terrain tile size, layers, and heightmap.';
        this.actions = ['get_info', 'set_property', 'get_layer_info', 'set_layer', 'get_height', 'set_height', 'list'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'set_property', 'get_layer_info', 'set_layer', 'get_height', 'set_height', 'list'],
                    description: 'Action: get_info=get terrain info, set_property=set terrain property, get_layer_info=get layer, set_layer=set layer texture, get_height=get height at position, set_height=set height, list=list terrain nodes'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[get_info, set_property, get_layer_info, set_layer, get_height, set_height] UUID of the node with Terrain component'
                },
                property: {
                    type: 'string',
                    enum: ['tileSize', 'weightMapSize', 'lightMapSize'],
                    description: '[set_property] Terrain property to set'
                },
                value: {
                    description: '[set_property] Value to set for the property'
                },
                layerIndex: {
                    type: 'number',
                    description: '[get_layer_info, set_layer] Layer index (0-based)'
                },
                detailMapUuid: {
                    type: 'string',
                    description: '[set_layer] UUID of the detail map texture asset'
                },
                tileSize: {
                    type: 'number',
                    description: '[set_layer] Tile size for the layer'
                },
                x: {
                    type: 'number',
                    description: '[get_height, set_height] X position in terrain space'
                },
                y: {
                    type: 'number',
                    description: '[get_height, set_height] Y position in terrain space'
                },
                height: {
                    type: 'number',
                    description: '[set_height] Height value to set'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getTerrainInfo(args),
            set_property: (args) => this.setTerrainProperty(args),
            get_layer_info: (args) => this.getTerrainLayerInfo(args),
            set_layer: (args) => this.setTerrainLayer(args),
            get_height: (args) => this.getTerrainHeight(args),
            set_height: (args) => this.setTerrainHeight(args),
            list: (args) => this.listTerrainNodes(args),
        };
    }
    async getTerrainInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTerrainInfo', args: [args.nodeUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setTerrainProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_property');
        if (!args.property)
            return (0, types_1.errorResult)('property is required for set_property');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required for set_property');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTerrainProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Terrain property '${args.property}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getTerrainLayerInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_layer_info');
        if (args.layerIndex === undefined)
            return (0, types_1.errorResult)('layerIndex is required for get_layer_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTerrainLayerInfo', args: [args.nodeUuid, args.layerIndex]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setTerrainLayer(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_layer');
        if (args.layerIndex === undefined)
            return (0, types_1.errorResult)('layerIndex is required for set_layer');
        if (!args.detailMapUuid)
            return (0, types_1.errorResult)('detailMapUuid is required for set_layer');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTerrainLayer',
                args: [args.nodeUuid, args.layerIndex, args.detailMapUuid, args.tileSize]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Terrain layer ${args.layerIndex} set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getTerrainHeight(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_height');
        if (args.x === undefined)
            return (0, types_1.errorResult)('x is required for get_height');
        if (args.y === undefined)
            return (0, types_1.errorResult)('y is required for get_height');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTerrainHeight', args: [args.nodeUuid, args.x, args.y]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setTerrainHeight(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_height');
        if (args.x === undefined)
            return (0, types_1.errorResult)('x is required for set_height');
        if (args.y === undefined)
            return (0, types_1.errorResult)('y is required for set_height');
        if (args.height === undefined)
            return (0, types_1.errorResult)('height is required for set_height');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTerrainHeight', args: [args.nodeUuid, args.x, args.y, args.height]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Height set at (${args.x}, ${args.y})`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listTerrainNodes(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listTerrainNodes', args: []
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageTerrain = ManageTerrain;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXRlcnJhaW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXRlcnJhaW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRyxrTEFBa0wsQ0FBQztRQUNqTSxZQUFPLEdBQUcsQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzFHLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsTUFBTSxDQUFDO29CQUNyRyxXQUFXLEVBQUUsZ05BQWdOO2lCQUNoTztnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHFIQUFxSDtpQkFDckk7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFVBQVUsRUFBRSxlQUFlLEVBQUUsY0FBYyxDQUFDO29CQUNuRCxXQUFXLEVBQUUsd0NBQXdDO2lCQUN4RDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLDhDQUE4QztpQkFDOUQ7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtREFBbUQ7aUJBQ25FO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFD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LE1BQU0sRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsRUFBRTthQUNqRSxDQUFDLENBQUM7WUFDSCxPQUFRLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUEscUJBQWEsRUFBRSxNQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQVcsRUFBRSxNQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUcsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQTdJRCxzQ0E2SUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVRlcnJhaW4gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfdGVycmFpbic7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIFRlcnJhaW4gY29tcG9uZW50cyAoM0Qgb25seSkuIEFjdGlvbnM6IGdldF9pbmZvLCBzZXRfcHJvcGVydHksIGdldF9sYXllcl9pbmZvLCBzZXRfbGF5ZXIsIGdldF9oZWlnaHQsIHNldF9oZWlnaHQsIGxpc3QuIENvbnRyb2wgdGVycmFpbiB0aWxlIHNpemUsIGxheWVycywgYW5kIGhlaWdodG1hcC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2dldF9pbmZvJywgJ3NldF9wcm9wZXJ0eScsICdnZXRfbGF5ZXJfaW5mbycsICdzZXRfbGF5ZXInLCAnZ2V0X2hlaWdodCcsICdzZXRfaGVpZ2h0JywgJ2xpc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnc2V0X3Byb3BlcnR5JywgJ2dldF9sYXllcl9pbmZvJywgJ3NldF9sYXllcicsICdnZXRfaGVpZ2h0JywgJ3NldF9oZWlnaHQnLCAnbGlzdCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBnZXRfaW5mbz1nZXQgdGVycmFpbiBpbmZvLCBzZXRfcHJvcGVydHk9c2V0IHRlcnJhaW4gcHJvcGVydHksIGdldF9sYXllcl9pbmZvPWdldCBsYXllciwgc2V0X2xheWVyPXNldCBsYXllciB0ZXh0dXJlLCBnZXRfaGVpZ2h0PWdldCBoZWlnaHQgYXQgcG9zaXRpb24sIHNldF9oZWlnaHQ9c2V0IGhlaWdodCwgbGlzdD1saXN0IHRlcnJhaW4gbm9kZXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfaW5mbywgc2V0X3Byb3BlcnR5LCBnZXRfbGF5ZXJfaW5mbywgc2V0X2xheWVyLCBnZXRfaGVpZ2h0LCBzZXRfaGVpZ2h0XSBVVUlEIG9mIHRoZSBub2RlIHdpdGggVGVycmFpbiBjb21wb25lbnQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydHk6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3RpbGVTaXplJywgJ3dlaWdodE1hcFNpemUnLCAnbGlnaHRNYXBTaXplJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBUZXJyYWluIHByb3BlcnR5IHRvIHNldCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gVmFsdWUgdG8gc2V0IGZvciB0aGUgcHJvcGVydHknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGF5ZXJJbmRleDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9sYXllcl9pbmZvLCBzZXRfbGF5ZXJdIExheWVyIGluZGV4ICgwLWJhc2VkKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZXRhaWxNYXBVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2xheWVyXSBVVUlEIG9mIHRoZSBkZXRhaWwgbWFwIHRleHR1cmUgYXNzZXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGlsZVNpemU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfbGF5ZXJdIFRpbGUgc2l6ZSBmb3IgdGhlIGxheWVyJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfaGVpZ2h0LCBzZXRfaGVpZ2h0XSBYIHBvc2l0aW9uIGluIHRlcnJhaW4gc3BhY2UnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgeToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9oZWlnaHQsIHNldF9oZWlnaHRdIFkgcG9zaXRpb24gaW4gdGVycmFpbiBzcGFjZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBoZWlnaHQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfaGVpZ2h0XSBIZWlnaHQgdmFsdWUgdG8gc2V0J1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldFRlcnJhaW5JbmZvKGFyZ3MpLFxuICAgICAgICBzZXRfcHJvcGVydHk6IChhcmdzKSA9PiB0aGlzLnNldFRlcnJhaW5Qcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgZ2V0X2xheWVyX2luZm86IChhcmdzKSA9PiB0aGlzLmdldFRlcnJhaW5MYXllckluZm8oYXJncyksXG4gICAgICAgIHNldF9sYXllcjogKGFyZ3MpID0+IHRoaXMuc2V0VGVycmFpbkxheWVyKGFyZ3MpLFxuICAgICAgICBnZXRfaGVpZ2h0OiAoYXJncykgPT4gdGhpcy5nZXRUZXJyYWluSGVpZ2h0KGFyZ3MpLFxuICAgICAgICBzZXRfaGVpZ2h0OiAoYXJncykgPT4gdGhpcy5zZXRUZXJyYWluSGVpZ2h0KGFyZ3MpLFxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0VGVycmFpbk5vZGVzKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFRlcnJhaW5JbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGdldF9pbmZvJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldFRlcnJhaW5JbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0VGVycmFpblByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xuICAgICAgICBpZiAoIWFyZ3MucHJvcGVydHkpIHJldHVybiBlcnJvclJlc3VsdCgncHJvcGVydHkgaXMgcmVxdWlyZWQgZm9yIHNldF9wcm9wZXJ0eScpO1xuICAgICAgICBpZiAoYXJncy52YWx1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0VGVycmFpblByb3BlcnR5JywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIGBUZXJyYWluIHByb3BlcnR5ICcke2FyZ3MucHJvcGVydHl9JyBzZXRgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFRlcnJhaW5MYXllckluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgZ2V0X2xheWVyX2luZm8nKTtcbiAgICAgICAgaWYgKGFyZ3MubGF5ZXJJbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2xheWVySW5kZXggaXMgcmVxdWlyZWQgZm9yIGdldF9sYXllcl9pbmZvJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldFRlcnJhaW5MYXllckluZm8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5sYXllckluZGV4XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFRlcnJhaW5MYXllcihhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBzZXRfbGF5ZXInKTtcbiAgICAgICAgaWYgKGFyZ3MubGF5ZXJJbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2xheWVySW5kZXggaXMgcmVxdWlyZWQgZm9yIHNldF9sYXllcicpO1xuICAgICAgICBpZiAoIWFyZ3MuZGV0YWlsTWFwVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdkZXRhaWxNYXBVdWlkIGlzIHJlcXVpcmVkIGZvciBzZXRfbGF5ZXInKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0VGVycmFpbkxheWVyJyxcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5sYXllckluZGV4LCBhcmdzLmRldGFpbE1hcFV1aWQsIGFyZ3MudGlsZVNpemVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIGBUZXJyYWluIGxheWVyICR7YXJncy5sYXllckluZGV4fSBzZXRgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFRlcnJhaW5IZWlnaHQoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgZ2V0X2hlaWdodCcpO1xuICAgICAgICBpZiAoYXJncy54ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneCBpcyByZXF1aXJlZCBmb3IgZ2V0X2hlaWdodCcpO1xuICAgICAgICBpZiAoYXJncy55ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneSBpcyByZXF1aXJlZCBmb3IgZ2V0X2hlaWdodCcpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRUZXJyYWluSGVpZ2h0JywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MueCwgYXJncy55XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFRlcnJhaW5IZWlnaHQoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3Igc2V0X2hlaWdodCcpO1xuICAgICAgICBpZiAoYXJncy54ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneCBpcyByZXF1aXJlZCBmb3Igc2V0X2hlaWdodCcpO1xuICAgICAgICBpZiAoYXJncy55ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneSBpcyByZXF1aXJlZCBmb3Igc2V0X2hlaWdodCcpO1xuICAgICAgICBpZiAoYXJncy5oZWlnaHQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdoZWlnaHQgaXMgcmVxdWlyZWQgZm9yIHNldF9oZWlnaHQnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0VGVycmFpbkhlaWdodCcsIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLngsIGFyZ3MueSwgYXJncy5oZWlnaHRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIGBIZWlnaHQgc2V0IGF0ICgke2FyZ3MueH0sICR7YXJncy55fSlgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxpc3RUZXJyYWluTm9kZXMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdsaXN0VGVycmFpbk5vZGVzJywgYXJnczogW11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KS5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxufVxuIl19