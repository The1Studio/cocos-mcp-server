"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageTilemap = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageTilemap extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_tilemap';
        this.description = 'Manage TiledMap components. Actions: get_info, list, get_layer_info, set_tile, get_tile, get_tileset_info. Control tile-based maps created with Tiled editor.';
        this.actions = ['get_info', 'list', 'get_layer_info', 'set_tile', 'get_tile', 'get_tileset_info'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'list', 'get_layer_info', 'set_tile', 'get_tile', 'get_tileset_info'],
                    description: 'Action to perform: get_info=get TiledMap info, list=list all TiledMap nodes, get_layer_info=get layer details, set_tile=set tile GID, get_tile=get tile GID, get_tileset_info=get tileset info'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[get_info, get_layer_info, set_tile, get_tile, get_tileset_info] UUID of the node containing TiledMap component'
                },
                layerName: {
                    type: 'string',
                    description: '[get_layer_info, set_tile, get_tile] Name of the tile layer'
                },
                x: {
                    type: 'number',
                    description: '[set_tile, get_tile] Tile X coordinate'
                },
                y: {
                    type: 'number',
                    description: '[set_tile, get_tile] Tile Y coordinate'
                },
                gid: {
                    type: 'number',
                    description: '[set_tile] Global tile ID to set'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getTiledMapInfo(args),
            list: (args) => this.listTiledMaps(args),
            get_layer_info: (args) => this.getTiledLayerInfo(args),
            set_tile: (args) => this.setTile(args),
            get_tile: (args) => this.getTile(args),
            get_tileset_info: (args) => this.getTilesetInfo(args),
        };
    }
    async getTiledMapInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTiledMapInfo', args: [args.nodeUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listTiledMaps(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listTiledMaps', args: []
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getTiledLayerInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_layer_info');
        if (!args.layerName)
            return (0, types_1.errorResult)('layerName is required for get_layer_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTiledLayerInfo', args: [args.nodeUuid, args.layerName]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setTile(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_tile');
        if (!args.layerName)
            return (0, types_1.errorResult)('layerName is required for set_tile');
        if (args.x === undefined)
            return (0, types_1.errorResult)('x is required for set_tile');
        if (args.y === undefined)
            return (0, types_1.errorResult)('y is required for set_tile');
        if (args.gid === undefined)
            return (0, types_1.errorResult)('gid is required for set_tile');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTile', args: [args.nodeUuid, args.layerName, args.x, args.y, args.gid]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Tile set at (${args.x}, ${args.y})`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getTile(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_tile');
        if (!args.layerName)
            return (0, types_1.errorResult)('layerName is required for get_tile');
        if (args.x === undefined)
            return (0, types_1.errorResult)('x is required for get_tile');
        if (args.y === undefined)
            return (0, types_1.errorResult)('y is required for get_tile');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTile', args: [args.nodeUuid, args.layerName, args.x, args.y]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getTilesetInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_tileset_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTilesetInfo', args: [args.nodeUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageTilemap = ManageTilemap;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXRpbGVtYXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXRpbGVtYXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRywrSkFBK0osQ0FBQztRQUM5SyxZQUFPLEdBQUcsQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztRQUM3RixnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLGdCQUFnQixFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsa0JBQWtCLENBQUM7b0JBQ3hGLFdBQVcsRUFBRSxnTUFBZ007aUJBQ2hOO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsaUhBQWlIO2lCQUNqSTtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDZEQUE2RDtpQkFDN0U7Z0JBQ0QsQ0FBQyxFQUFFO29CQUNDLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx3Q0FBd0M7aUJBQ3hEO2dCQUNELENBQUMsRUFBRTtvQkFDQyxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsd0NBQXdDO2lCQUN4RDtnQkFDRCxHQUFHLEVBQUU7b0JBQ0QsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGtDQUFrQztpQkFDbEQ7YUFDSjtZQUNELFFBQVEsRUFBRSxD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cG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlVGlsZW1hcCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV90aWxlbWFwJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgVGlsZWRNYXAgY29tcG9uZW50cy4gQWN0aW9uczogZ2V0X2luZm8sIGxpc3QsIGdldF9sYXllcl9pbmZvLCBzZXRfdGlsZSwgZ2V0X3RpbGUsIGdldF90aWxlc2V0X2luZm8uIENvbnRyb2wgdGlsZS1iYXNlZCBtYXBzIGNyZWF0ZWQgd2l0aCBUaWxlZCBlZGl0b3IuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydnZXRfaW5mbycsICdsaXN0JywgJ2dldF9sYXllcl9pbmZvJywgJ3NldF90aWxlJywgJ2dldF90aWxlJywgJ2dldF90aWxlc2V0X2luZm8nXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnbGlzdCcsICdnZXRfbGF5ZXJfaW5mbycsICdzZXRfdGlsZScsICdnZXRfdGlsZScsICdnZXRfdGlsZXNldF9pbmZvJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogZ2V0X2luZm89Z2V0IFRpbGVkTWFwIGluZm8sIGxpc3Q9bGlzdCBhbGwgVGlsZWRNYXAgbm9kZXMsIGdldF9sYXllcl9pbmZvPWdldCBsYXllciBkZXRhaWxzLCBzZXRfdGlsZT1zZXQgdGlsZSBHSUQsIGdldF90aWxlPWdldCB0aWxlIEdJRCwgZ2V0X3RpbGVzZXRfaW5mbz1nZXQgdGlsZXNldCBpbmZvJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2luZm8sIGdldF9sYXllcl9pbmZvLCBzZXRfdGlsZSwgZ2V0X3RpbGUsIGdldF90aWxlc2V0X2luZm9dIFVVSUQgb2YgdGhlIG5vZGUgY29udGFpbmluZyBUaWxlZE1hcCBjb21wb25lbnQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbGF5ZXJOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2xheWVyX2luZm8sIHNldF90aWxlLCBnZXRfdGlsZV0gTmFtZSBvZiB0aGUgdGlsZSBsYXllcidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB4OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RpbGUsIGdldF90aWxlXSBUaWxlIFggY29vcmRpbmF0ZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB5OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3RpbGUsIGdldF90aWxlXSBUaWxlIFkgY29vcmRpbmF0ZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnaWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfdGlsZV0gR2xvYmFsIHRpbGUgSUQgdG8gc2V0J1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldFRpbGVkTWFwSW5mbyhhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdFRpbGVkTWFwcyhhcmdzKSxcbiAgICAgICAgZ2V0X2xheWVyX2luZm86IChhcmdzKSA9PiB0aGlzLmdldFRpbGVkTGF5ZXJJbmZvKGFyZ3MpLFxuICAgICAgICBzZXRfdGlsZTogKGFyZ3MpID0+IHRoaXMuc2V0VGlsZShhcmdzKSxcbiAgICAgICAgZ2V0X3RpbGU6IChhcmdzKSA9PiB0aGlzLmdldFRpbGUoYXJncyksXG4gICAgICAgIGdldF90aWxlc2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmdldFRpbGVzZXRJbmZvKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFRpbGVkTWFwSW5mbyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRUaWxlZE1hcEluZm8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KS5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0VGlsZWRNYXBzKF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnbGlzdFRpbGVkTWFwcycsIGFyZ3M6IFtdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0VGlsZWRMYXllckluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgZ2V0X2xheWVyX2luZm8nKTtcbiAgICAgICAgaWYgKCFhcmdzLmxheWVyTmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCdsYXllck5hbWUgaXMgcmVxdWlyZWQgZm9yIGdldF9sYXllcl9pbmZvJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldFRpbGVkTGF5ZXJJbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MubGF5ZXJOYW1lXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFRpbGUoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3Igc2V0X3RpbGUnKTtcbiAgICAgICAgaWYgKCFhcmdzLmxheWVyTmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCdsYXllck5hbWUgaXMgcmVxdWlyZWQgZm9yIHNldF90aWxlJyk7XG4gICAgICAgIGlmIChhcmdzLnggPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd4IGlzIHJlcXVpcmVkIGZvciBzZXRfdGlsZScpO1xuICAgICAgICBpZiAoYXJncy55ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneSBpcyByZXF1aXJlZCBmb3Igc2V0X3RpbGUnKTtcbiAgICAgICAgaWYgKGFyZ3MuZ2lkID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgnZ2lkIGlzIHJlcXVpcmVkIGZvciBzZXRfdGlsZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRUaWxlJywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MubGF5ZXJOYW1lLCBhcmdzLngsIGFyZ3MueSwgYXJncy5naWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIGBUaWxlIHNldCBhdCAoJHthcmdzLnh9LCAke2FyZ3MueX0pYCkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRUaWxlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGdldF90aWxlJyk7XG4gICAgICAgIGlmICghYXJncy5sYXllck5hbWUpIHJldHVybiBlcnJvclJlc3VsdCgnbGF5ZXJOYW1lIGlzIHJlcXVpcmVkIGZvciBnZXRfdGlsZScpO1xuICAgICAgICBpZiAoYXJncy54ID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgneCBpcyByZXF1aXJlZCBmb3IgZ2V0X3RpbGUnKTtcbiAgICAgICAgaWYgKGFyZ3MueSA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3kgaXMgcmVxdWlyZWQgZm9yIGdldF90aWxlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2dldFRpbGUnLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5sYXllck5hbWUsIGFyZ3MueCwgYXJncy55XVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFRpbGVzZXRJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGdldF90aWxlc2V0X2luZm8nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0VGlsZXNldEluZm8nLCBhcmdzOiBbYXJncy5ub2RlVXVpZF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KS5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxufVxuIl19