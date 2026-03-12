import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { normalizeStringArray } from '../utils/normalize';

export class ManageSelection extends BaseActionTool {
    readonly name = 'manage_selection';
    readonly description = 'Manage editor selection state. Actions: get, set, clear, hover, get_last. Type param: "node" for scene nodes, "asset" for project assets. Use get to discover what the user has selected before operating on nodes.';
    readonly actions = ['get', 'set', 'clear', 'hover', 'get_last'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get', 'set', 'clear', 'hover', 'get_last'],
                description: 'Selection operation: get=get current selection, set=set selection to given UUIDs, clear=clear all selection, hover=set hover highlight, get_last=get last selected item'
            },
            type: {
                type: 'string',
                enum: ['node', 'asset'],
                description: 'Selection type (default: node). Use "node" for scene nodes, "asset" for project assets.'
            },
            uuids: {
                description: '[set] UUID(s) to select — accepts a single string or an array of strings'
            },
            uuid: {
                type: 'string',
                description: '[hover] Single UUID to set as hovered'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get: (args) => this.getSelection(args),
        set: (args) => this.setSelection(args),
        clear: (args) => this.clearSelection(args),
        hover: (args) => this.hoverNode(args),
        get_last: (args) => this.getLastSelected(args),
    };

    private async getSelection(args: any): Promise<ActionToolResult> {
        try {
            const type = args.type || 'node';
            const selected = Editor.Selection.getSelected(type);
            return successResult({ type, selected, count: selected.length });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async setSelection(args: any): Promise<ActionToolResult> {
        try {
            const type = args.type || 'node';
            const uuids = normalizeStringArray(args.uuids) || [];
            Editor.Selection.select(type, uuids);
            return successResult({ type, selected: uuids }, `Selected ${uuids.length} items`);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async clearSelection(args: any): Promise<ActionToolResult> {
        try {
            const type = args.type || 'node';
            Editor.Selection.clear(type);
            return successResult({ type }, 'Selection cleared');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async hoverNode(args: any): Promise<ActionToolResult> {
        try {
            const type = args.type || 'node';
            if (!args.uuid) return errorResult('uuid is required for hover');
            Editor.Selection.hover(type, args.uuid);
            return successResult({ type, uuid: args.uuid }, 'Hover set');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async getLastSelected(args: any): Promise<ActionToolResult> {
        try {
            const type = args.type || 'node';
            const last = Editor.Selection.getLastSelected(type);
            return successResult({ type, lastSelected: last });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }
}
