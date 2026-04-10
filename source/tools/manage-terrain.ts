import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageTerrain extends BaseActionTool {
    readonly name = 'manage_terrain';
    readonly description = 'Manage Terrain components (3D only). Actions: get_info, set_property, get_layer_info, set_layer, get_height, set_height, list. Control terrain tile size, layers, and heightmap.';
    readonly actions = ['get_info', 'set_property', 'get_layer_info', 'set_layer', 'get_height', 'set_height', 'list'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_info: (args) => this.getTerrainInfo(args),
        set_property: (args) => this.setTerrainProperty(args),
        get_layer_info: (args) => this.getTerrainLayerInfo(args),
        set_layer: (args) => this.setTerrainLayer(args),
        get_height: (args) => this.getTerrainHeight(args),
        set_height: (args) => this.setTerrainHeight(args),
        list: (args) => this.listTerrainNodes(args),
    };

    private async getTerrainInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTerrainInfo', args: [args.nodeUuid]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setTerrainProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_property');
        if (!args.property) return errorResult('property is required for set_property');
        if (args.value === undefined) return errorResult('value is required for set_property');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTerrainProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return (result as any).success ? successResult((result as any).data, `Terrain property '${args.property}' set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getTerrainLayerInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_layer_info');
        if (args.layerIndex === undefined) return errorResult('layerIndex is required for get_layer_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTerrainLayerInfo', args: [args.nodeUuid, args.layerIndex]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setTerrainLayer(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_layer');
        if (args.layerIndex === undefined) return errorResult('layerIndex is required for set_layer');
        if (!args.detailMapUuid) return errorResult('detailMapUuid is required for set_layer');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTerrainLayer',
                args: [args.nodeUuid, args.layerIndex, args.detailMapUuid, args.tileSize]
            });
            return (result as any).success ? successResult((result as any).data, `Terrain layer ${args.layerIndex} set`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getTerrainHeight(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for get_height');
        if (args.x === undefined) return errorResult('x is required for get_height');
        if (args.y === undefined) return errorResult('y is required for get_height');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getTerrainHeight', args: [args.nodeUuid, args.x, args.y]
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setTerrainHeight(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required for set_height');
        if (args.x === undefined) return errorResult('x is required for set_height');
        if (args.y === undefined) return errorResult('y is required for set_height');
        if (args.height === undefined) return errorResult('height is required for set_height');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTerrainHeight', args: [args.nodeUuid, args.x, args.y, args.height]
            });
            return (result as any).success ? successResult((result as any).data, `Height set at (${args.x}, ${args.y})`) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async listTerrainNodes(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listTerrainNodes', args: []
            });
            return (result as any).success ? successResult((result as any).data) : errorResult((result as any).error);
        } catch (err: any) { return errorResult(err.message); }
    }
}
