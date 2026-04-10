import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageProfiler extends BaseActionTool {
    readonly name = 'manage_profiler';
    readonly description = 'Access runtime performance profiling data. Actions: get_stats, get_memory, toggle_stats_display, get_draw_calls. Reads FPS, draw calls, triangles, node count, and memory usage from the running scene.';
    readonly actions = ['get_stats', 'get_memory', 'toggle_stats_display', 'get_draw_calls'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_stats', 'get_memory', 'toggle_stats_display', 'get_draw_calls'],
                description: 'Action: get_stats=get FPS/drawCalls/triangles/nodeCount, get_memory=get memory usage, toggle_stats_display=show/hide stats overlay, get_draw_calls=get draw call breakdown'
            },
            visible: { type: 'boolean', description: '[toggle_stats_display] Force show (true) or hide (false); omit to toggle' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_stats: (args) => this.getStats(args),
        get_memory: (args) => this.getMemory(args),
        toggle_stats_display: (args) => this.toggleStatsDisplay(args),
        get_draw_calls: (args) => this.getDrawCalls(args),
    };

    private async getStats(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getPerformanceStats', args: []
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getMemory(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getMemoryStats', args: []
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async toggleStatsDisplay(args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'toggleStatsDisplay', args: [args.visible]
            });
            return successResult(result, 'Stats display toggled');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getDrawCalls(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getDrawCallStats', args: []
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }
}
