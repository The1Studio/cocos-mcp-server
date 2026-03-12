import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceBool, coerceFloat, normalizeStringArray } from '../utils/normalize';

export class ManageSceneView extends BaseActionTool {
    readonly name = 'manage_scene_view';
    readonly description = 'Control scene view settings: gizmos, camera, grid, view mode. Actions: set_gizmo_tool, get_gizmo_tool, set_gizmo_pivot, get_gizmo_pivot, get_view_mode, set_coordinate, get_coordinate, set_2d_3d, get_2d_3d, set_grid, get_grid, set_icon_gizmo_3d, get_icon_gizmo_3d, set_icon_gizmo_size, get_icon_gizmo_size, focus_camera, align_camera, align_view, get_status, reset. For node transforms use manage_node instead.';
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                description: 'Action to perform',
                enum: [
                    'set_gizmo_tool', 'get_gizmo_tool',
                    'set_gizmo_pivot', 'get_gizmo_pivot',
                    'get_view_mode',
                    'set_coordinate', 'get_coordinate',
                    'set_2d_3d', 'get_2d_3d',
                    'set_grid', 'get_grid',
                    'set_icon_gizmo_3d', 'get_icon_gizmo_3d',
                    'set_icon_gizmo_size', 'get_icon_gizmo_size',
                    'focus_camera', 'align_camera', 'align_view',
                    'get_status', 'reset'
                ]
            },
            name: {
                type: 'string',
                description: 'Tool name (set_gizmo_tool: position/rotation/scale/rect) or pivot (set_gizmo_pivot: pivot/center)'
            },
            type: {
                type: 'string',
                description: 'Coordinate system type (set_coordinate: local/global)'
            },
            is2D: {
                type: 'boolean',
                description: 'True for 2D mode, false for 3D (set_2d_3d)'
            },
            visible: {
                type: 'boolean',
                description: 'Grid visibility (set_grid)'
            },
            is3D: {
                type: 'boolean',
                description: 'True for 3D IconGizmo mode (set_icon_gizmo_3d)'
            },
            size: {
                type: 'number',
                description: 'IconGizmo size 10-100 (set_icon_gizmo_size)',
                minimum: 10,
                maximum: 100
            },
            uuids: {
                oneOf: [
                    { type: 'array', items: { type: 'string' } },
                    { type: 'null' }
                ],
                description: 'Node UUIDs to focus on (focus_camera, null for all)'
            }
        },
        required: ['action']
    };
    readonly actions = [
        'set_gizmo_tool', 'get_gizmo_tool',
        'set_gizmo_pivot', 'get_gizmo_pivot',
        'get_view_mode',
        'set_coordinate', 'get_coordinate',
        'set_2d_3d', 'get_2d_3d',
        'set_grid', 'get_grid',
        'set_icon_gizmo_3d', 'get_icon_gizmo_3d',
        'set_icon_gizmo_size', 'get_icon_gizmo_size',
        'focus_camera', 'align_camera', 'align_view',
        'get_status', 'reset'
    ];

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        set_gizmo_tool: (args) => this.setGizmoTool(args.name),
        get_gizmo_tool: () => this.getGizmoTool(),
        set_gizmo_pivot: (args) => this.setGizmoPivot(args.name),
        get_gizmo_pivot: () => this.getGizmoPivot(),
        get_view_mode: () => this.getViewMode(),
        set_coordinate: (args) => this.setCoordinate(args.type),
        get_coordinate: () => this.getCoordinate(),
        set_2d_3d: (args) => this.set2D3D(coerceBool(args.is2D)),
        get_2d_3d: () => this.get2D3D(),
        set_grid: (args) => this.setGrid(coerceBool(args.visible)),
        get_grid: () => this.getGrid(),
        set_icon_gizmo_3d: (args) => this.setIconGizmo3D(coerceBool(args.is3D)),
        get_icon_gizmo_3d: () => this.getIconGizmo3D(),
        set_icon_gizmo_size: (args) => this.setIconGizmoSize(coerceFloat(args.size)),
        get_icon_gizmo_size: () => this.getIconGizmoSize(),
        focus_camera: (args) => this.focusCamera(args.uuids !== null ? normalizeStringArray(args.uuids) : null),
        align_camera: () => this.alignCamera(),
        align_view: () => this.alignView(),
        get_status: () => this.getStatus(),
        reset: () => this.reset()
    };

    private async setGizmoTool(name: string): Promise<ActionToolResult> {
        if (!name) return errorResult('name is required for set_gizmo_tool');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-gizmo-tool', name).then(() => {
                resolve(successResult(null, `Gizmo tool changed to '${name}'`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getGizmoTool(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-tool-name').then((toolName: string) => {
                resolve(successResult({ currentTool: toolName }, `Current Gizmo tool: ${toolName}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async setGizmoPivot(name: string): Promise<ActionToolResult> {
        if (!name) return errorResult('name is required for set_gizmo_pivot');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-gizmo-pivot', name).then(() => {
                resolve(successResult(null, `Gizmo pivot changed to '${name}'`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getGizmoPivot(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-pivot').then((pivotName: string) => {
                resolve(successResult({ currentPivot: pivotName }, `Current Gizmo pivot: ${pivotName}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getViewMode(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-view-mode').then((viewMode: string) => {
                resolve(successResult({ viewMode }, `Current view mode: ${viewMode}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async setCoordinate(type: string): Promise<ActionToolResult> {
        if (!type) return errorResult('type is required for set_coordinate');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-gizmo-coordinate', type).then(() => {
                resolve(successResult(null, `Coordinate system changed to '${type}'`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getCoordinate(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-coordinate').then((coordinate: string) => {
                resolve(successResult({ coordinate }, `Current coordinate system: ${coordinate}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async set2D3D(is2D: boolean | undefined): Promise<ActionToolResult> {
        if (is2D === undefined) return errorResult('is2D is required for set_2d_3d');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-is2D', is2D).then(() => {
                resolve(successResult(null, `View mode changed to ${is2D ? '2D' : '3D'}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async get2D3D(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is2D').then((is2D: boolean) => {
                resolve(successResult(
                    { is2D, viewMode: is2D ? '2D' : '3D' },
                    `Current view mode: ${is2D ? '2D' : '3D'}`
                ));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async setGrid(visible: boolean | undefined): Promise<ActionToolResult> {
        if (visible === undefined) return errorResult('visible is required for set_grid');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-grid-visible', visible).then(() => {
                resolve(successResult(null, `Grid ${visible ? 'shown' : 'hidden'}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getGrid(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is-grid-visible').then((visible: boolean) => {
                resolve(successResult({ visible }, `Grid is ${visible ? 'visible' : 'hidden'}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async setIconGizmo3D(is3D: boolean | undefined): Promise<ActionToolResult> {
        if (is3D === undefined) return errorResult('is3D is required for set_icon_gizmo_3d');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-icon-gizmo-3d', is3D).then(() => {
                resolve(successResult(null, `IconGizmo set to ${is3D ? '3D' : '2D'} mode`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getIconGizmo3D(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is-icon-gizmo-3d').then((is3D: boolean) => {
                resolve(successResult(
                    { is3D, mode: is3D ? '3D' : '2D' },
                    `IconGizmo is in ${is3D ? '3D' : '2D'} mode`
                ));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async setIconGizmoSize(size: number | undefined): Promise<ActionToolResult> {
        if (size === undefined) return errorResult('size is required for set_icon_gizmo_size');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-icon-gizmo-size', size).then(() => {
                resolve(successResult(null, `IconGizmo size set to ${size}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getIconGizmoSize(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-icon-gizmo-size').then((size: number) => {
                resolve(successResult({ size }, `IconGizmo size: ${size}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async focusCamera(uuids: string[] | null | undefined): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'focus-camera', uuids || []).then(() => {
                const message = uuids === null || uuids === undefined
                    ? 'Camera focused on all nodes'
                    : `Camera focused on ${uuids.length} node(s)`;
                resolve(successResult(null, message));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async alignCamera(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'align-with-view').then(() => {
                resolve(successResult(null, 'Scene camera aligned with current view'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async alignView(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'align-with-view-node').then(() => {
                resolve(successResult(null, 'View aligned with selected node'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getStatus(): Promise<ActionToolResult> {
        try {
            const [
                gizmoTool,
                gizmoPivot,
                gizmoCoordinate,
                viewMode2D3D,
                gridVisible,
                iconGizmo3D,
                iconGizmoSize
            ] = await Promise.allSettled([
                this.getGizmoTool(),
                this.getGizmoPivot(),
                this.getCoordinate(),
                this.get2D3D(),
                this.getGrid(),
                this.getIconGizmo3D(),
                this.getIconGizmoSize()
            ]);

            const status: any = { timestamp: new Date().toISOString() };

            if (gizmoTool.status === 'fulfilled' && gizmoTool.value.success) {
                status.gizmoTool = gizmoTool.value.data.currentTool;
            }
            if (gizmoPivot.status === 'fulfilled' && gizmoPivot.value.success) {
                status.gizmoPivot = gizmoPivot.value.data.currentPivot;
            }
            if (gizmoCoordinate.status === 'fulfilled' && gizmoCoordinate.value.success) {
                status.coordinate = gizmoCoordinate.value.data.coordinate;
            }
            if (viewMode2D3D.status === 'fulfilled' && viewMode2D3D.value.success) {
                status.is2D = viewMode2D3D.value.data.is2D;
                status.viewMode = viewMode2D3D.value.data.viewMode;
            }
            if (gridVisible.status === 'fulfilled' && gridVisible.value.success) {
                status.gridVisible = gridVisible.value.data.visible;
            }
            if (iconGizmo3D.status === 'fulfilled' && iconGizmo3D.value.success) {
                status.iconGizmo3D = iconGizmo3D.value.data.is3D;
            }
            if (iconGizmoSize.status === 'fulfilled' && iconGizmoSize.value.success) {
                status.iconGizmoSize = iconGizmoSize.value.data.size;
            }

            return successResult(status);
        } catch (err: any) {
            return errorResult(`Failed to get scene view status: ${err.message}`);
        }
    }

    private async reset(): Promise<ActionToolResult> {
        try {
            await Promise.all([
                this.setGizmoTool('position'),
                this.setGizmoPivot('pivot'),
                this.setCoordinate('local'),
                this.set2D3D(false),
                this.setGrid(true),
                this.setIconGizmo3D(true),
                this.setIconGizmoSize(60)
            ]);
            return successResult(null, 'Scene view reset to default settings');
        } catch (err: any) {
            return errorResult(`Failed to reset scene view: ${err.message}`);
        }
    }
}
