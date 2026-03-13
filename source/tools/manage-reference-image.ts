import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceFloat, normalizeStringArray } from '../utils/normalize';

export class ManageReferenceImage extends BaseActionTool {
    readonly name = 'manage_reference_image';
    readonly description = 'Manage reference image overlays in the scene view. Actions: add, remove, switch, set_data, get_config, get_current, refresh, set_position, set_scale, set_opacity, list, clear_all.';
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action to perform',
                enum: [
                    'add', 'remove', 'switch', 'set_data',
                    'get_config', 'get_current', 'refresh',
                    'set_position', 'set_scale', 'set_opacity',
                    'list', 'clear_all'
                ]
            },
            paths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of reference image absolute paths (add, remove)'
            },
            path: {
                type: 'string',
                description: 'Reference image absolute path (switch)'
            },
            sceneUUID: {
                type: 'string',
                description: 'Specific scene UUID (switch, optional)'
            },
            key: {
                type: 'string',
                description: 'Property key (set_data: path/x/y/sx/sy/opacity)',
                enum: ['path', 'x', 'y', 'sx', 'sy', 'opacity']
            },
            value: {
                description: 'Property value (set_data: path=string, x/y/sx/sy/opacity=number)'
            },
            x: {
                type: 'number',
                description: 'X offset (set_position)'
            },
            y: {
                type: 'number',
                description: 'Y offset (set_position)'
            },
            sx: {
                type: 'number',
                description: 'X scale 0.1-10 (set_scale)',
                minimum: 0.1,
                maximum: 10
            },
            sy: {
                type: 'number',
                description: 'Y scale 0.1-10 (set_scale)',
                minimum: 0.1,
                maximum: 10
            },
            opacity: {
                type: 'number',
                description: 'Opacity 0.0-1.0 (set_opacity)',
                minimum: 0,
                maximum: 1
            }
        },
        required: ['action']
    };
    readonly actions = [
        'add', 'remove', 'switch', 'set_data',
        'get_config', 'get_current', 'refresh',
        'set_position', 'set_scale', 'set_opacity',
        'list', 'clear_all'
    ];

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add: (args) => this.add(normalizeStringArray(args.paths) || args.paths),
        remove: (args) => this.remove(normalizeStringArray(args.paths)),
        switch: (args) => this.switchImage(args.path, args.sceneUUID),
        set_data: (args) => this.setData(args.key, args.value),
        get_config: () => this.getConfig(),
        get_current: () => this.getCurrent(),
        refresh: () => this.refresh(),
        set_position: (args) => this.setPosition(coerceFloat(args.x), coerceFloat(args.y)),
        set_scale: (args) => this.setScale(coerceFloat(args.sx), coerceFloat(args.sy)),
        set_opacity: (args) => this.setOpacity(coerceFloat(args.opacity)),
        list: () => this.list(),
        clear_all: () => this.clearAll()
    };

    private async add(paths: string[]): Promise<ActionToolResult> {
        if (!paths || paths.length === 0) return errorResult('paths is required for add');
        try {
            await Editor.Message.request('reference-image', 'add-image', paths);
            return successResult({ addedPaths: paths, count: paths.length }, `Added ${paths.length} reference image(s)`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async remove(paths?: string[]): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('reference-image', 'remove-image', paths);
            const message = paths && paths.length > 0
                ? `Removed ${paths.length} reference image(s)`
                : 'Removed current reference image';
            return successResult(null, message);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async switchImage(path: string, sceneUUID?: string): Promise<ActionToolResult> {
        if (!path) return errorResult('path is required for switch');
        try {
            const args = sceneUUID ? [path, sceneUUID] : [path];
            await Editor.Message.request('reference-image', 'switch-image', ...args);
            return successResult({ path, sceneUUID }, `Switched to reference image: ${path}`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async setData(key: string, value: any): Promise<ActionToolResult> {
        if (!key) return errorResult('key is required for set_data');
        if (value === undefined) return errorResult('value is required for set_data');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', key, value);
            return successResult({ key, value }, `Reference image ${key} set to ${value}`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getConfig(): Promise<ActionToolResult> {
        try {
            const config = await Editor.Message.request('reference-image', 'query-config');
            return successResult(config);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getCurrent(): Promise<ActionToolResult> {
        try {
            const current = await Editor.Message.request('reference-image', 'query-current');
            return successResult(current);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async refresh(): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('reference-image', 'refresh');
            return successResult(null, 'Reference image refreshed');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async setPosition(x: number | undefined, y: number | undefined): Promise<ActionToolResult> {
        if (x === undefined) return errorResult('x is required for set_position');
        if (y === undefined) return errorResult('y is required for set_position');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'x', x);
            await Editor.Message.request('reference-image', 'set-image-data', 'y', y);
            return successResult({ x, y }, `Reference image position set to (${x}, ${y})`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async setScale(sx: number | undefined, sy: number | undefined): Promise<ActionToolResult> {
        if (sx === undefined) return errorResult('sx is required for set_scale');
        if (sy === undefined) return errorResult('sy is required for set_scale');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'sx', sx);
            await Editor.Message.request('reference-image', 'set-image-data', 'sy', sy);
            return successResult({ sx, sy }, `Reference image scale set to (${sx}, ${sy})`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async setOpacity(opacity: number | undefined): Promise<ActionToolResult> {
        if (opacity === undefined) return errorResult('opacity is required for set_opacity');
        try {
            await Editor.Message.request('reference-image', 'set-image-data', 'opacity', opacity);
            return successResult({ opacity }, `Reference image opacity set to ${opacity}`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async list(): Promise<ActionToolResult> {
        try {
            const config = await Editor.Message.request('reference-image', 'query-config');
            const current = await Editor.Message.request('reference-image', 'query-current');
            return successResult({ config, current }, 'Reference image information retrieved');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async clearAll(): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('reference-image', 'remove-image');
            return successResult(null, 'All reference images cleared');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }
}
