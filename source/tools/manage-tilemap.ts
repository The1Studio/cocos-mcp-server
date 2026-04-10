import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageTilemap extends BaseActionTool {
    readonly name = 'manage_tilemap';
    readonly description = 'Manage TiledMap components. Actions: get_info, list, get_layer_info, set_tile, get_tile, get_tileset_info. Control tile-based maps created with Tiled editor.';
    readonly actions = ['get_info', 'list', 'get_layer_info', 'set_tile', 'get_tile', 'get_tileset_info'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getTiledMapInfo(args),
        list: (args) => this.listTiledMaps(args),
        get_layer_info: (args) => this.getTiledLayerInfo(args),
        set_tile: (args) => this.setTile(args),
        get_tile: (args) => this.getTile(args),
        get_tileset_info: (args) => this.getTilesetInfo(args),
    };

    private async getTiledMapInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTiledMapInfo', args: [args.nodeUuid]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listTiledMaps(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listTiledMaps', args: []
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getTiledLayerInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_layer_info');
        if (!args.layerName) return errorResult('layerName is required for get_layer_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTiledLayerInfo', args: [args.nodeUuid, args.layerName]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setTile(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_tile');
        if (!args.layerName) return errorResult('layerName is required for set_tile');
        if (args.x === undefined) return errorResult('x is required for set_tile');
        if (args.y === undefined) return errorResult('y is required for set_tile');
        if (args.gid === undefined) return errorResult('gid is required for set_tile');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTile', args: [args.nodeUuid, args.layerName, args.x, args.y, args.gid]
            });
            return (result as any).success ? successResult((result as any).data, `Tile set at (${args.x}, ${args.y})`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getTile(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_tile');
        if (!args.layerName) return errorResult('layerName is required for get_tile');
        if (args.x === undefined) return errorResult('x is required for get_tile');
        if (args.y === undefined) return errorResult('y is required for get_tile');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTile', args: [args.nodeUuid, args.layerName, args.x, args.y]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getTilesetInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_tileset_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTilesetInfo', args: [args.nodeUuid]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }
}
