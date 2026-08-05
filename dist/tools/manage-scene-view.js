"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageSceneView = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
class ManageSceneView extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_scene_view';
        this.description = 'Control scene view settings: gizmos, camera, grid, view mode. Actions: set_gizmo_tool, get_gizmo_tool, set_gizmo_pivot, get_gizmo_pivot, get_view_mode, set_coordinate, get_coordinate, set_2d_3d, get_2d_3d, set_grid, get_grid, set_icon_gizmo_3d, get_icon_gizmo_3d, set_icon_gizmo_size, get_icon_gizmo_size, focus_camera, align_camera, align_view, get_status, reset. For node transforms use manage_node instead.';
        this.inputSchema = {
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
        this.actions = [
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
        this.actionHandlers = {
            set_gizmo_tool: (args) => this.setGizmoTool(args.name),
            get_gizmo_tool: () => this.getGizmoTool(),
            set_gizmo_pivot: (args) => this.setGizmoPivot(args.name),
            get_gizmo_pivot: () => this.getGizmoPivot(),
            get_view_mode: () => this.getViewMode(),
            set_coordinate: (args) => this.setCoordinate(args.type),
            get_coordinate: () => this.getCoordinate(),
            set_2d_3d: (args) => this.set2D3D((0, normalize_1.coerceBool)(args.is2D)),
            get_2d_3d: () => this.get2D3D(),
            set_grid: (args) => this.setGrid((0, normalize_1.coerceBool)(args.visible)),
            get_grid: () => this.getGrid(),
            set_icon_gizmo_3d: (args) => this.setIconGizmo3D((0, normalize_1.coerceBool)(args.is3D)),
            get_icon_gizmo_3d: () => this.getIconGizmo3D(),
            set_icon_gizmo_size: (args) => this.setIconGizmoSize((0, normalize_1.coerceFloat)(args.size)),
            get_icon_gizmo_size: () => this.getIconGizmoSize(),
            focus_camera: (args) => this.focusCamera(args.uuids !== null ? (0, normalize_1.normalizeStringArray)(args.uuids) : null),
            align_camera: () => this.alignCamera(),
            align_view: () => this.alignView(),
            get_status: () => this.getStatus(),
            reset: () => this.reset()
        };
    }
    async setGizmoTool(name) {
        if (!name)
            return (0, types_1.errorResult)('name is required for set_gizmo_tool');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-gizmo-tool', name).then(() => {
                resolve((0, types_1.successResult)(null, `Gizmo tool changed to '${name}'`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getGizmoTool() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-tool-name').then((toolName) => {
                resolve((0, types_1.successResult)({ currentTool: toolName }, `Current Gizmo tool: ${toolName}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async setGizmoPivot(name) {
        if (!name)
            return (0, types_1.errorResult)('name is required for set_gizmo_pivot');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-gizmo-pivot', name).then(() => {
                resolve((0, types_1.successResult)(null, `Gizmo pivot changed to '${name}'`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getGizmoPivot() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-pivot').then((pivotName) => {
                resolve((0, types_1.successResult)({ currentPivot: pivotName }, `Current Gizmo pivot: ${pivotName}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getViewMode() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-view-mode').then((viewMode) => {
                resolve((0, types_1.successResult)({ viewMode }, `Current view mode: ${viewMode}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async setCoordinate(type) {
        if (!type)
            return (0, types_1.errorResult)('type is required for set_coordinate');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-gizmo-coordinate', type).then(() => {
                resolve((0, types_1.successResult)(null, `Coordinate system changed to '${type}'`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getCoordinate() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-gizmo-coordinate').then((coordinate) => {
                resolve((0, types_1.successResult)({ coordinate }, `Current coordinate system: ${coordinate}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async set2D3D(is2D) {
        if (is2D === undefined)
            return (0, types_1.errorResult)('is2D is required for set_2d_3d');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'change-is2D', is2D).then(() => {
                resolve((0, types_1.successResult)(null, `View mode changed to ${is2D ? '2D' : '3D'}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async get2D3D() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is2D').then((is2D) => {
                resolve((0, types_1.successResult)({ is2D, viewMode: is2D ? '2D' : '3D' }, `Current view mode: ${is2D ? '2D' : '3D'}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async setGrid(visible) {
        if (visible === undefined)
            return (0, types_1.errorResult)('visible is required for set_grid');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-grid-visible', visible).then(() => {
                resolve((0, types_1.successResult)(null, `Grid ${visible ? 'shown' : 'hidden'}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getGrid() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is-grid-visible').then((visible) => {
                resolve((0, types_1.successResult)({ visible }, `Grid is ${visible ? 'visible' : 'hidden'}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async setIconGizmo3D(is3D) {
        if (is3D === undefined)
            return (0, types_1.errorResult)('is3D is required for set_icon_gizmo_3d');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-icon-gizmo-3d', is3D).then(() => {
                resolve((0, types_1.successResult)(null, `IconGizmo set to ${is3D ? '3D' : '2D'} mode`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getIconGizmo3D() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is-icon-gizmo-3d').then((is3D) => {
                resolve((0, types_1.successResult)({ is3D, mode: is3D ? '3D' : '2D' }, `IconGizmo is in ${is3D ? '3D' : '2D'} mode`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async setIconGizmoSize(size) {
        if (size === undefined)
            return (0, types_1.errorResult)('size is required for set_icon_gizmo_size');
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'set-icon-gizmo-size', size).then(() => {
                resolve((0, types_1.successResult)(null, `IconGizmo size set to ${size}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getIconGizmoSize() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-icon-gizmo-size').then((size) => {
                resolve((0, types_1.successResult)({ size }, `IconGizmo size: ${size}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async focusCamera(uuids) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'focus-camera', uuids || []).then(() => {
                const message = uuids === null || uuids === undefined
                    ? 'Camera focused on all nodes'
                    : `Camera focused on ${uuids.length} node(s)`;
                resolve((0, types_1.successResult)(null, message));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async alignCamera() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'align-with-view').then(() => {
                resolve((0, types_1.successResult)(null, 'Scene camera aligned with current view'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async alignView() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'align-with-view-node').then(() => {
                resolve((0, types_1.successResult)(null, 'View aligned with selected node'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getStatus() {
        try {
            const [gizmoTool, gizmoPivot, gizmoCoordinate, viewMode2D3D, gridVisible, iconGizmo3D, iconGizmoSize] = await Promise.allSettled([
                this.getGizmoTool(),
                this.getGizmoPivot(),
                this.getCoordinate(),
                this.get2D3D(),
                this.getGrid(),
                this.getIconGizmo3D(),
                this.getIconGizmoSize()
            ]);
            const status = { timestamp: new Date().toISOString() };
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
            return (0, types_1.successResult)(status);
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to get scene view status: ${err.message}`);
        }
    }
    async reset() {
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
            return (0, types_1.successResult)(null, 'Scene view reset to default settings');
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to reset scene view: ${err.message}`);
        }
    }
}
exports.ManageSceneView = ManageSceneView;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjZW5lLXZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXNjZW5lLXZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUN4RSxrREFBbUY7QUFFbkYsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxtQkFBbUIsQ0FBQztRQUMzQixnQkFBVyxHQUFHLDJaQUEyWixDQUFDO1FBQzFhLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtQkFBbUI7b0JBQ2hDLElBQUksRUFBRTt3QkFDRixnQkFBZ0IsRUFBRSxnQkFBZ0I7d0JBQ2xDLGlCQUFpQixFQUFFLGlCQUFpQjt3QkFDcEMsZUFBZTt3QkFDZixnQkFBZ0IsRUFBRSxnQkFBZ0I7d0JBQ2xDLFdBQVcsRUFBRSxXQUFXO3dCQUN4QixVQUFVLEVBQUUsVUFBVTt3QkFDdEIsbUJBQW1CLEVBQUUsbUJBQW1CO3dCQUN4QyxxQkFBcUIsRUFBRSxxQkFBcUI7d0JBQzVDLGNBQWMsRUFBRSxjQUFjLEVBQUUsWUFBWTt3QkFDNUMsWUFBWSxFQUFFLE9BQU87cUJBQ3hCO2lCQUNKO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUdBQW1HO2lCQUNuSDtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHVEQUF1RDtpQkFDdkU7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVB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LEdBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBRTVELElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDOUQsTUFBTSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDeEQsQ0FBQztZQUNELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDaEUsTUFBTSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDM0QsQ0FBQztZQUNELElBQUksZUFBZSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDMUUsTUFBTSxDQUFDLFVBQVUsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDOUQsQ0FBQztZQUNELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDcEUsTUFBTSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ3ZELENBQUM7WUFDRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ3hELENBQUM7WUFDRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3JELENBQUM7WUFDRCxJQUFJLGFBQWEsQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3RFLE1BQU0sQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3pELENBQUM7WUFFRCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxvQ0FBb0MsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDMUUsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsS0FBSztRQUNmLElBQUksQ0FBQztZQUNELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztnQkFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO2dCQUMzQixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztnQkFDbkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO2dCQUN6QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO2FBQzVCLENBQUMsQ0FBQztZQUNILE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtCQUErQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBcldELDBDQXFXQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IGNvZXJjZUJvb2wsIGNvZXJjZUZsb2F0LCBub3JtYWxpemVTdHJpbmdBcnJheSB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlU2NlbmVWaWV3IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2Vfc2NlbmVfdmlldyc7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdDb250cm9sIHNjZW5lIHZpZXcgc2V0dGluZ3M6IGdpem1vcywgY2FtZXJhLCBncmlkLCB2aWV3IG1vZGUuIEFjdGlvbnM6IHNldF9naXptb190b29sLCBnZXRfZ2l6bW9fdG9vbCwgc2V0X2dpem1vX3Bpdm90LCBnZXRfZ2l6bW9fcGl2b3QsIGdldF92aWV3X21vZGUsIHNldF9jb29yZGluYXRlLCBnZXRfY29vcmRpbmF0ZSwgc2V0XzJkXzNkLCBnZXRfMmRfM2QsIHNldF9ncmlkLCBnZXRfZ3JpZCwgc2V0X2ljb25fZ2l6bW9fM2QsIGdldF9pY29uX2dpem1vXzNkLCBzZXRfaWNvbl9naXptb19zaXplLCBnZXRfaWNvbl9naXptb19zaXplLCBmb2N1c19jYW1lcmEsIGFsaWduX2NhbWVyYSwgYWxpZ25fdmlldywgZ2V0X3N0YXR1cywgcmVzZXQuIEZvciBub2RlIHRyYW5zZm9ybXMgdXNlIG1hbmFnZV9ub2RlIGluc3RlYWQuJztcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxyXG4gICAgICAgICAgICAgICAgZW51bTogW1xyXG4gICAgICAgICAgICAgICAgICAgICdzZXRfZ2l6bW9fdG9vbCcsICdnZXRfZ2l6bW9fdG9vbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9naXptb19waXZvdCcsICdnZXRfZ2l6bW9fcGl2b3QnLFxyXG4gICAgICAgICAgICAgICAgICAgICdnZXRfdmlld19tb2RlJyxcclxuICAgICAgICAgICAgICAgICAgICAnc2V0X2Nvb3JkaW5hdGUnLCAnZ2V0X2Nvb3JkaW5hdGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICdzZXRfMmRfM2QnLCAnZ2V0XzJkXzNkJyxcclxuICAgICAgICAgICAgICAgICAgICAnc2V0X2dyaWQnLCAnZ2V0X2dyaWQnLFxyXG4gICAgICAgICAgICAgICAgICAgICdzZXRfaWNvbl9naXptb18zZCcsICdnZXRfaWNvbl9naXptb18zZCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9pY29uX2dpem1vX3NpemUnLCAnZ2V0X2ljb25fZ2l6bW9fc2l6ZScsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2ZvY3VzX2NhbWVyYScsICdhbGlnbl9jYW1lcmEnLCAnYWxpZ25fdmlldycsXHJcbiAgICAgICAgICAgICAgICAgICAgJ2dldF9zdGF0dXMnLCAncmVzZXQnXHJcbiAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG5hbWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUb29sIG5hbWUgKHNldF9naXptb190b29sOiBwb3NpdGlvbi9yb3RhdGlvbi9zY2FsZS9yZWN0KSBvciBwaXZvdCAoc2V0X2dpem1vX3Bpdm90OiBwaXZvdC9jZW50ZXIpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB0eXBlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ29vcmRpbmF0ZSBzeXN0ZW0gdHlwZSAoc2V0X2Nvb3JkaW5hdGU6IGxvY2FsL2dsb2JhbCknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGlzMkQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVHJ1ZSBmb3IgMkQgbW9kZSwgZmFsc2UgZm9yIDNEIChzZXRfMmRfM2QpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB2aXNpYmxlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0dyaWQgdmlzaWJpbGl0eSAoc2V0X2dyaWQpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBpczNEOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RydWUgZm9yIDNEIEljb25HaXptbyBtb2RlIChzZXRfaWNvbl9naXptb18zZCknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNpemU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJY29uR2l6bW8gc2l6ZSAxMC0xMDAgKHNldF9pY29uX2dpem1vX3NpemUpJyxcclxuICAgICAgICAgICAgICAgIG1pbmltdW06IDEwLFxyXG4gICAgICAgICAgICAgICAgbWF4aW11bTogMTAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHV1aWRzOiB7XHJcbiAgICAgICAgICAgICAgICBvbmVPZjogW1xyXG4gICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ251bGwnIH1cclxuICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ05vZGUgVVVJRHMgdG8gZm9jdXMgb24gKGZvY3VzX2NhbWVyYSwgbnVsbCBmb3IgYWxsKSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xyXG4gICAgICAgICdzZXRfZ2l6bW9fdG9vbCcsICdnZXRfZ2l6bW9fdG9vbCcsXHJcbiAgICAgICAgJ3NldF9naXptb19waXZvdCcsICdnZXRfZ2l6bW9fcGl2b3QnLFxyXG4gICAgICAgICdnZXRfdmlld19tb2RlJyxcclxuICAgICAgICAnc2V0X2Nvb3JkaW5hdGUnLCAnZ2V0X2Nvb3JkaW5hdGUnLFxyXG4gICAgICAgICdzZXRfMmRfM2QnLCAnZ2V0XzJkXzNkJyxcclxuICAgICAgICAnc2V0X2dyaWQnLCAnZ2V0X2dyaWQnLFxyXG4gICAgICAgICdzZXRfaWNvbl9naXptb18zZCcsICdnZXRfaWNvbl9naXptb18zZCcsXHJcbiAgICAgICAgJ3NldF9pY29uX2dpem1vX3NpemUnLCAnZ2V0X2ljb25fZ2l6bW9fc2l6ZScsXHJcbiAgICAgICAgJ2ZvY3VzX2NhbWVyYScsICdhbGlnbl9jYW1lcmEnLCAnYWxpZ25fdmlldycsXHJcbiAgICAgICAgJ2dldF9zdGF0dXMnLCAncmVzZXQnXHJcbiAgICBdO1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIHNldF9naXptb190b29sOiAoYXJncykgPT4gdGhpcy5zZXRHaXptb1Rvb2woYXJncy5uYW1lKSxcclxuICAgICAgICBnZXRfZ2l6bW9fdG9vbDogKCkgPT4gdGhpcy5nZXRHaXptb1Rvb2woKSxcclxuICAgICAgICBzZXRfZ2l6bW9fcGl2b3Q6IChhcmdzKSA9PiB0aGlzLnNldEdpem1vUGl2b3QoYXJncy5uYW1lKSxcclxuICAgICAgICBnZXRfZ2l6bW9fcGl2b3Q6ICgpID0+IHRoaXMuZ2V0R2l6bW9QaXZvdCgpLFxyXG4gICAgICAgIGdldF92aWV3X21vZGU6ICgpID0+IHRoaXMuZ2V0Vmlld01vZGUoKSxcclxuICAgICAgICBzZXRfY29vcmRpbmF0ZTogKGFyZ3MpID0+IHRoaXMuc2V0Q29vcmRpbmF0ZShhcmdzLnR5cGUpLFxyXG4gICAgICAgIGdldF9jb29yZGluYXRlOiAoKSA9PiB0aGlzLmdldENvb3JkaW5hdGUoKSxcclxuICAgICAgICBzZXRfMmRfM2Q6IChhcmdzKSA9PiB0aGlzLnNldDJEM0QoY29lcmNlQm9vbChhcmdzLmlzMkQpKSxcclxuICAgICAgICBnZXRfMmRfM2Q6ICgpID0+IHRoaXMuZ2V0MkQzRCgpLFxyXG4gICAgICAgIHNldF9ncmlkOiAoYXJncykgPT4gdGhpcy5zZXRHcmlkKGNvZXJjZUJvb2woYXJncy52aXNpYmxlKSksXHJcbiAgICAgICAgZ2V0X2dyaWQ6ICgpID0+IHRoaXMuZ2V0R3JpZCgpLFxyXG4gICAgICAgIHNldF9pY29uX2dpem1vXzNkOiAoYXJncykgPT4gdGhpcy5zZXRJY29uR2l6bW8zRChjb2VyY2VCb29sKGFyZ3MuaXMzRCkpLFxyXG4gICAgICAgIGdldF9pY29uX2dpem1vXzNkOiAoKSA9PiB0aGlzLmdldEljb25HaXptbzNEKCksXHJcbiAgICAgICAgc2V0X2ljb25fZ2l6bW9fc2l6ZTogKGFyZ3MpID0+IHRoaXMuc2V0SWNvbkdpem1vU2l6ZShjb2VyY2VGbG9hdChhcmdzLnNpemUpKSxcclxuICAgICAgICBnZXRfaWNvbl9naXptb19zaXplOiAoKSA9PiB0aGlzLmdldEljb25HaXptb1NpemUoKSxcclxuICAgICAgICBmb2N1c19jYW1lcmE6IChhcmdzKSA9PiB0aGlzLmZvY3VzQ2FtZXJhKGFyZ3MudXVpZHMgIT09IG51bGwgPyBub3JtYWxpemVTdHJpbmdBcnJheShhcmdzLnV1aWRzKSA6IG51bGwpLFxyXG4gICAgICAgIGFsaWduX2NhbWVyYTogKCkgPT4gdGhpcy5hbGlnbkNhbWVyYSgpLFxyXG4gICAgICAgIGFsaWduX3ZpZXc6ICgpID0+IHRoaXMuYWxpZ25WaWV3KCksXHJcbiAgICAgICAgZ2V0X3N0YXR1czogKCkgPT4gdGhpcy5nZXRTdGF0dXMoKSxcclxuICAgICAgICByZXNldDogKCkgPT4gdGhpcy5yZXNldCgpXHJcbiAgICB9O1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0R2l6bW9Ub29sKG5hbWU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghbmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCduYW1lIGlzIHJlcXVpcmVkIGZvciBzZXRfZ2l6bW9fdG9vbCcpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tdG9vbCcsIG5hbWUpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBHaXptbyB0b29sIGNoYW5nZWQgdG8gJyR7bmFtZX0nYCkpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEdpem1vVG9vbCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tdG9vbC1uYW1lJykudGhlbigodG9vbE5hbWU6IHN0cmluZykgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgY3VycmVudFRvb2w6IHRvb2xOYW1lIH0sIGBDdXJyZW50IEdpem1vIHRvb2w6ICR7dG9vbE5hbWV9YCkpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldEdpem1vUGl2b3QobmFtZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKCFuYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25hbWUgaXMgcmVxdWlyZWQgZm9yIHNldF9naXptb19waXZvdCcpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tcGl2b3QnLCBuYW1lKS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgR2l6bW8gcGl2b3QgY2hhbmdlZCB0byAnJHtuYW1lfSdgKSk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0R2l6bW9QaXZvdCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tcGl2b3QnKS50aGVuKChwaXZvdE5hbWU6IHN0cmluZykgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgY3VycmVudFBpdm90OiBwaXZvdE5hbWUgfSwgYEN1cnJlbnQgR2l6bW8gcGl2b3Q6ICR7cGl2b3ROYW1lfWApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRWaWV3TW9kZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tdmlldy1tb2RlJykudGhlbigodmlld01vZGU6IHN0cmluZykgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgdmlld01vZGUgfSwgYEN1cnJlbnQgdmlldyBtb2RlOiAke3ZpZXdNb2RlfWApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb29yZGluYXRlKHR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghdHlwZSkgcmV0dXJuIGVycm9yUmVzdWx0KCd0eXBlIGlzIHJlcXVpcmVkIGZvciBzZXRfY29vcmRpbmF0ZScpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tY29vcmRpbmF0ZScsIHR5cGUpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBDb29yZGluYXRlIHN5c3RlbSBjaGFuZ2VkIHRvICcke3R5cGV9J2ApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRDb29yZGluYXRlKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1naXptby1jb29yZGluYXRlJykudGhlbigoY29vcmRpbmF0ZTogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyBjb29yZGluYXRlIH0sIGBDdXJyZW50IGNvb3JkaW5hdGUgc3lzdGVtOiAke2Nvb3JkaW5hdGV9YCkpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldDJEM0QoaXMyRDogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmIChpczJEID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgnaXMyRCBpcyByZXF1aXJlZCBmb3Igc2V0XzJkXzNkJyk7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NoYW5nZS1pczJEJywgaXMyRCkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgYFZpZXcgbW9kZSBjaGFuZ2VkIHRvICR7aXMyRCA/ICcyRCcgOiAnM0QnfWApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXQyRDNEKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1pczJEJykudGhlbigoaXMyRDogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KFxyXG4gICAgICAgICAgICAgICAgICAgIHsgaXMyRCwgdmlld01vZGU6IGlzMkQgPyAnMkQnIDogJzNEJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGBDdXJyZW50IHZpZXcgbW9kZTogJHtpczJEID8gJzJEJyA6ICczRCd9YFxyXG4gICAgICAgICAgICAgICAgKSk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0R3JpZCh2aXNpYmxlOiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKHZpc2libGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2aXNpYmxlIGlzIHJlcXVpcmVkIGZvciBzZXRfZ3JpZCcpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtZ3JpZC12aXNpYmxlJywgdmlzaWJsZSkudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgYEdyaWQgJHt2aXNpYmxlID8gJ3Nob3duJyA6ICdoaWRkZW4nfWApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRHcmlkKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1pcy1ncmlkLXZpc2libGUnKS50aGVuKCh2aXNpYmxlOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyB2aXNpYmxlIH0sIGBHcmlkIGlzICR7dmlzaWJsZSA/ICd2aXNpYmxlJyA6ICdoaWRkZW4nfWApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRJY29uR2l6bW8zRChpczNEOiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKGlzM0QgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdpczNEIGlzIHJlcXVpcmVkIGZvciBzZXRfaWNvbl9naXptb18zZCcpO1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtaWNvbi1naXptby0zZCcsIGlzM0QpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBJY29uR2l6bW8gc2V0IHRvICR7aXMzRCA/ICczRCcgOiAnMkQnfSBtb2RlYCkpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldEljb25HaXptbzNEKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1pcy1pY29uLWdpem1vLTNkJykudGhlbigoaXMzRDogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KFxyXG4gICAgICAgICAgICAgICAgICAgIHsgaXMzRCwgbW9kZTogaXMzRCA/ICczRCcgOiAnMkQnIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgYEljb25HaXptbyBpcyBpbiAke2lzM0QgPyAnM0QnIDogJzJEJ30gbW9kZWBcclxuICAgICAgICAgICAgICAgICkpO1xyXG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldEljb25HaXptb1NpemUoc2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKHNpemUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdzaXplIGlzIHJlcXVpcmVkIGZvciBzZXRfaWNvbl9naXptb19zaXplJyk7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1pY29uLWdpem1vLXNpemUnLCBzaXplKS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgSWNvbkdpem1vIHNpemUgc2V0IHRvICR7c2l6ZX1gKSk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0SWNvbkdpem1vU2l6ZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaWNvbi1naXptby1zaXplJykudGhlbigoc2l6ZTogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyBzaXplIH0sIGBJY29uR2l6bW8gc2l6ZTogJHtzaXplfWApKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBmb2N1c0NhbWVyYSh1dWlkczogc3RyaW5nW10gfCBudWxsIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2ZvY3VzLWNhbWVyYScsIHV1aWRzIHx8IFtdKS50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB1dWlkcyA9PT0gbnVsbCB8fCB1dWlkcyA9PT0gdW5kZWZpbmVkXHJcbiAgICAgICAgICAgICAgICAgICAgPyAnQ2FtZXJhIGZvY3VzZWQgb24gYWxsIG5vZGVzJ1xyXG4gICAgICAgICAgICAgICAgICAgIDogYENhbWVyYSBmb2N1c2VkIG9uICR7dXVpZHMubGVuZ3RofSBub2RlKHMpYDtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBtZXNzYWdlKSk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgYWxpZ25DYW1lcmEoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FsaWduLXdpdGgtdmlldycpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsICdTY2VuZSBjYW1lcmEgYWxpZ25lZCB3aXRoIGN1cnJlbnQgdmlldycpKTtcclxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcclxuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBhbGlnblZpZXcoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FsaWduLXdpdGgtdmlldy1ub2RlJykudGhlbigoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1ZpZXcgYWxpZ25lZCB3aXRoIHNlbGVjdGVkIG5vZGUnKSk7XHJcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XHJcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U3RhdHVzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IFtcclxuICAgICAgICAgICAgICAgIGdpem1vVG9vbCxcclxuICAgICAgICAgICAgICAgIGdpem1vUGl2b3QsXHJcbiAgICAgICAgICAgICAgICBnaXptb0Nvb3JkaW5hdGUsXHJcbiAgICAgICAgICAgICAgICB2aWV3TW9kZTJEM0QsXHJcbiAgICAgICAgICAgICAgICBncmlkVmlzaWJsZSxcclxuICAgICAgICAgICAgICAgIGljb25HaXptbzNELFxyXG4gICAgICAgICAgICAgICAgaWNvbkdpem1vU2l6ZVxyXG4gICAgICAgICAgICBdID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKFtcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0R2l6bW9Ub29sKCksXHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldEdpem1vUGl2b3QoKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0Q29vcmRpbmF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXQyRDNEKCksXHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldEdyaWQoKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0SWNvbkdpem1vM0QoKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0SWNvbkdpem1vU2l6ZSgpXHJcbiAgICAgICAgICAgIF0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgc3RhdHVzOiBhbnkgPSB7IHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpIH07XHJcblxyXG4gICAgICAgICAgICBpZiAoZ2l6bW9Ub29sLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgZ2l6bW9Ub29sLnZhbHVlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5naXptb1Rvb2wgPSBnaXptb1Rvb2wudmFsdWUuZGF0YS5jdXJyZW50VG9vbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZ2l6bW9QaXZvdC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGdpem1vUGl2b3QudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmdpem1vUGl2b3QgPSBnaXptb1Bpdm90LnZhbHVlLmRhdGEuY3VycmVudFBpdm90O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChnaXptb0Nvb3JkaW5hdGUuc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiBnaXptb0Nvb3JkaW5hdGUudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmNvb3JkaW5hdGUgPSBnaXptb0Nvb3JkaW5hdGUudmFsdWUuZGF0YS5jb29yZGluYXRlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh2aWV3TW9kZTJEM0Quc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiB2aWV3TW9kZTJEM0QudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmlzMkQgPSB2aWV3TW9kZTJEM0QudmFsdWUuZGF0YS5pczJEO1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLnZpZXdNb2RlID0gdmlld01vZGUyRDNELnZhbHVlLmRhdGEudmlld01vZGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGdyaWRWaXNpYmxlLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgZ3JpZFZpc2libGUudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmdyaWRWaXNpYmxlID0gZ3JpZFZpc2libGUudmFsdWUuZGF0YS52aXNpYmxlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChpY29uR2l6bW8zRC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGljb25HaXptbzNELnZhbHVlLnN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgICAgIHN0YXR1cy5pY29uR2l6bW8zRCA9IGljb25HaXptbzNELnZhbHVlLmRhdGEuaXMzRDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoaWNvbkdpem1vU2l6ZS5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGljb25HaXptb1NpemUudmFsdWUuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzLmljb25HaXptb1NpemUgPSBpY29uR2l6bW9TaXplLnZhbHVlLmRhdGEuc2l6ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoc3RhdHVzKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBnZXQgc2NlbmUgdmlldyBzdGF0dXM6ICR7ZXJyLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVzZXQoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRHaXptb1Rvb2woJ3Bvc2l0aW9uJyksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldEdpem1vUGl2b3QoJ3Bpdm90JyksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldENvb3JkaW5hdGUoJ2xvY2FsJyksXHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldDJEM0QoZmFsc2UpLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRHcmlkKHRydWUpLFxyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRJY29uR2l6bW8zRCh0cnVlKSxcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWNvbkdpem1vU2l6ZSg2MClcclxuICAgICAgICAgICAgXSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdTY2VuZSB2aWV3IHJlc2V0IHRvIGRlZmF1bHQgc2V0dGluZ3MnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZXNldCBzY2VuZSB2aWV3OiAke2Vyci5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=