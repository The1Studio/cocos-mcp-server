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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjZW5lLXZpZXcuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXNjZW5lLXZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUN4RSxrREFBbUY7QUFFbkYsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxtQkFBbUIsQ0FBQztRQUMzQixnQkFBVyxHQUFHLDJaQUEyWixDQUFDO1FBQzFhLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtQkFBbUI7b0JBQ2hDLElBQUksRUFBRTt3QkFDRixnQkFBZ0IsRUFBRSxnQkFBZ0I7d0JBQ2xDLGlCQUFpQixFQUFFLGlCQUFpQjt3QkFDcEMsZUFBZTt3QkFDZixnQkFBZ0IsRUFBRSxnQkFBZ0I7d0JBQ2xDLFdBQVcsRUFBRSxXQUFXO3dCQUN4QixVQUFVLEVBQUUsVUFBVTt3QkFDdEIsbUJBQW1CLEVBQUUsbUJBQW1CO3dCQUN4QyxxQkFBcUIsRUFBRSxxQkFBcUI7d0JBQzVDLGNBQWMsRUFBRSxjQUFjLEVBQUUsWUFBWTt3QkFDNUMsWUFBWSxFQUFFLE9BQU87cUJBQ3hCO2lCQUNKO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUdBQW1HO2lCQUNuSDtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHVEQUF1RDtpQkFDdkU7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVB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LEdBQVEsRUFBRSxTQUFTLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBRTVELElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDOUQsTUFBTSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDeEQsQ0FBQztZQUNELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDaEUsTUFBTSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDM0QsQ0FBQztZQUNELElBQUksZUFBZSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksZUFBZSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDMUUsTUFBTSxDQUFDLFVBQVUsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDOUQsQ0FBQztZQUNELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxXQUFXLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDcEUsTUFBTSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQzNDLE1BQU0sQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ3ZELENBQUM7WUFDRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ3hELENBQUM7WUFDRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3JELENBQUM7WUFDRCxJQUFJLGFBQWEsQ0FBQyxNQUFNLEtBQUssV0FBVyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3RFLE1BQU0sQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3pELENBQUM7WUFFRCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxvQ0FBb0MsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDMUUsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsS0FBSztRQUNmLElBQUksQ0FBQztZQUNELE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQztnQkFDZCxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7Z0JBQzNCLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDO2dCQUMzQixJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztnQkFDbkIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO2dCQUN6QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO2FBQzVCLENBQUMsQ0FBQztZQUNILE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtCQUErQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBcldELDBDQXFXQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgY29lcmNlQm9vbCwgY29lcmNlRmxvYXQsIG5vcm1hbGl6ZVN0cmluZ0FycmF5IH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVNjZW5lVmlldyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9zY2VuZV92aWV3JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdDb250cm9sIHNjZW5lIHZpZXcgc2V0dGluZ3M6IGdpem1vcywgY2FtZXJhLCBncmlkLCB2aWV3IG1vZGUuIEFjdGlvbnM6IHNldF9naXptb190b29sLCBnZXRfZ2l6bW9fdG9vbCwgc2V0X2dpem1vX3Bpdm90LCBnZXRfZ2l6bW9fcGl2b3QsIGdldF92aWV3X21vZGUsIHNldF9jb29yZGluYXRlLCBnZXRfY29vcmRpbmF0ZSwgc2V0XzJkXzNkLCBnZXRfMmRfM2QsIHNldF9ncmlkLCBnZXRfZ3JpZCwgc2V0X2ljb25fZ2l6bW9fM2QsIGdldF9pY29uX2dpem1vXzNkLCBzZXRfaWNvbl9naXptb19zaXplLCBnZXRfaWNvbl9naXptb19zaXplLCBmb2N1c19jYW1lcmEsIGFsaWduX2NhbWVyYSwgYWxpZ25fdmlldywgZ2V0X3N0YXR1cywgcmVzZXQuIEZvciBub2RlIHRyYW5zZm9ybXMgdXNlIG1hbmFnZV9ub2RlIGluc3RlYWQuJztcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IFtcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9naXptb190b29sJywgJ2dldF9naXptb190b29sJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9naXptb19waXZvdCcsICdnZXRfZ2l6bW9fcGl2b3QnLFxuICAgICAgICAgICAgICAgICAgICAnZ2V0X3ZpZXdfbW9kZScsXG4gICAgICAgICAgICAgICAgICAgICdzZXRfY29vcmRpbmF0ZScsICdnZXRfY29vcmRpbmF0ZScsXG4gICAgICAgICAgICAgICAgICAgICdzZXRfMmRfM2QnLCAnZ2V0XzJkXzNkJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9ncmlkJywgJ2dldF9ncmlkJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9pY29uX2dpem1vXzNkJywgJ2dldF9pY29uX2dpem1vXzNkJyxcbiAgICAgICAgICAgICAgICAgICAgJ3NldF9pY29uX2dpem1vX3NpemUnLCAnZ2V0X2ljb25fZ2l6bW9fc2l6ZScsXG4gICAgICAgICAgICAgICAgICAgICdmb2N1c19jYW1lcmEnLCAnYWxpZ25fY2FtZXJhJywgJ2FsaWduX3ZpZXcnLFxuICAgICAgICAgICAgICAgICAgICAnZ2V0X3N0YXR1cycsICdyZXNldCdcbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVG9vbCBuYW1lIChzZXRfZ2l6bW9fdG9vbDogcG9zaXRpb24vcm90YXRpb24vc2NhbGUvcmVjdCkgb3IgcGl2b3QgKHNldF9naXptb19waXZvdDogcGl2b3QvY2VudGVyKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0eXBlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdDb29yZGluYXRlIHN5c3RlbSB0eXBlIChzZXRfY29vcmRpbmF0ZTogbG9jYWwvZ2xvYmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpczJEOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVHJ1ZSBmb3IgMkQgbW9kZSwgZmFsc2UgZm9yIDNEIChzZXRfMmRfM2QpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZpc2libGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdHcmlkIHZpc2liaWxpdHkgKHNldF9ncmlkKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpczNEOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVHJ1ZSBmb3IgM0QgSWNvbkdpem1vIG1vZGUgKHNldF9pY29uX2dpem1vXzNkKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzaXplOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJY29uR2l6bW8gc2l6ZSAxMC0xMDAgKHNldF9pY29uX2dpem1vX3NpemUpJyxcbiAgICAgICAgICAgICAgICBtaW5pbXVtOiAxMCxcbiAgICAgICAgICAgICAgICBtYXhpbXVtOiAxMDBcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1dWlkczoge1xuICAgICAgICAgICAgICAgIG9uZU9mOiBbXG4gICAgICAgICAgICAgICAgICAgIHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9LFxuICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdudWxsJyB9XG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ05vZGUgVVVJRHMgdG8gZm9jdXMgb24gKGZvY3VzX2NhbWVyYSwgbnVsbCBmb3IgYWxsKSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdzZXRfZ2l6bW9fdG9vbCcsICdnZXRfZ2l6bW9fdG9vbCcsXG4gICAgICAgICdzZXRfZ2l6bW9fcGl2b3QnLCAnZ2V0X2dpem1vX3Bpdm90JyxcbiAgICAgICAgJ2dldF92aWV3X21vZGUnLFxuICAgICAgICAnc2V0X2Nvb3JkaW5hdGUnLCAnZ2V0X2Nvb3JkaW5hdGUnLFxuICAgICAgICAnc2V0XzJkXzNkJywgJ2dldF8yZF8zZCcsXG4gICAgICAgICdzZXRfZ3JpZCcsICdnZXRfZ3JpZCcsXG4gICAgICAgICdzZXRfaWNvbl9naXptb18zZCcsICdnZXRfaWNvbl9naXptb18zZCcsXG4gICAgICAgICdzZXRfaWNvbl9naXptb19zaXplJywgJ2dldF9pY29uX2dpem1vX3NpemUnLFxuICAgICAgICAnZm9jdXNfY2FtZXJhJywgJ2FsaWduX2NhbWVyYScsICdhbGlnbl92aWV3JyxcbiAgICAgICAgJ2dldF9zdGF0dXMnLCAncmVzZXQnXG4gICAgXTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBzZXRfZ2l6bW9fdG9vbDogKGFyZ3MpID0+IHRoaXMuc2V0R2l6bW9Ub29sKGFyZ3MubmFtZSksXG4gICAgICAgIGdldF9naXptb190b29sOiAoKSA9PiB0aGlzLmdldEdpem1vVG9vbCgpLFxuICAgICAgICBzZXRfZ2l6bW9fcGl2b3Q6IChhcmdzKSA9PiB0aGlzLnNldEdpem1vUGl2b3QoYXJncy5uYW1lKSxcbiAgICAgICAgZ2V0X2dpem1vX3Bpdm90OiAoKSA9PiB0aGlzLmdldEdpem1vUGl2b3QoKSxcbiAgICAgICAgZ2V0X3ZpZXdfbW9kZTogKCkgPT4gdGhpcy5nZXRWaWV3TW9kZSgpLFxuICAgICAgICBzZXRfY29vcmRpbmF0ZTogKGFyZ3MpID0+IHRoaXMuc2V0Q29vcmRpbmF0ZShhcmdzLnR5cGUpLFxuICAgICAgICBnZXRfY29vcmRpbmF0ZTogKCkgPT4gdGhpcy5nZXRDb29yZGluYXRlKCksXG4gICAgICAgIHNldF8yZF8zZDogKGFyZ3MpID0+IHRoaXMuc2V0MkQzRChjb2VyY2VCb29sKGFyZ3MuaXMyRCkpLFxuICAgICAgICBnZXRfMmRfM2Q6ICgpID0+IHRoaXMuZ2V0MkQzRCgpLFxuICAgICAgICBzZXRfZ3JpZDogKGFyZ3MpID0+IHRoaXMuc2V0R3JpZChjb2VyY2VCb29sKGFyZ3MudmlzaWJsZSkpLFxuICAgICAgICBnZXRfZ3JpZDogKCkgPT4gdGhpcy5nZXRHcmlkKCksXG4gICAgICAgIHNldF9pY29uX2dpem1vXzNkOiAoYXJncykgPT4gdGhpcy5zZXRJY29uR2l6bW8zRChjb2VyY2VCb29sKGFyZ3MuaXMzRCkpLFxuICAgICAgICBnZXRfaWNvbl9naXptb18zZDogKCkgPT4gdGhpcy5nZXRJY29uR2l6bW8zRCgpLFxuICAgICAgICBzZXRfaWNvbl9naXptb19zaXplOiAoYXJncykgPT4gdGhpcy5zZXRJY29uR2l6bW9TaXplKGNvZXJjZUZsb2F0KGFyZ3Muc2l6ZSkpLFxuICAgICAgICBnZXRfaWNvbl9naXptb19zaXplOiAoKSA9PiB0aGlzLmdldEljb25HaXptb1NpemUoKSxcbiAgICAgICAgZm9jdXNfY2FtZXJhOiAoYXJncykgPT4gdGhpcy5mb2N1c0NhbWVyYShhcmdzLnV1aWRzICE9PSBudWxsID8gbm9ybWFsaXplU3RyaW5nQXJyYXkoYXJncy51dWlkcykgOiBudWxsKSxcbiAgICAgICAgYWxpZ25fY2FtZXJhOiAoKSA9PiB0aGlzLmFsaWduQ2FtZXJhKCksXG4gICAgICAgIGFsaWduX3ZpZXc6ICgpID0+IHRoaXMuYWxpZ25WaWV3KCksXG4gICAgICAgIGdldF9zdGF0dXM6ICgpID0+IHRoaXMuZ2V0U3RhdHVzKCksXG4gICAgICAgIHJlc2V0OiAoKSA9PiB0aGlzLnJlc2V0KClcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRHaXptb1Rvb2wobmFtZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCduYW1lIGlzIHJlcXVpcmVkIGZvciBzZXRfZ2l6bW9fdG9vbCcpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NoYW5nZS1naXptby10b29sJywgbmFtZSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBHaXptbyB0b29sIGNoYW5nZWQgdG8gJyR7bmFtZX0nYCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRHaXptb1Rvb2woKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tdG9vbC1uYW1lJykudGhlbigodG9vbE5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IGN1cnJlbnRUb29sOiB0b29sTmFtZSB9LCBgQ3VycmVudCBHaXptbyB0b29sOiAke3Rvb2xOYW1lfWApKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0R2l6bW9QaXZvdChuYW1lOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFuYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25hbWUgaXMgcmVxdWlyZWQgZm9yIHNldF9naXptb19waXZvdCcpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NoYW5nZS1naXptby1waXZvdCcsIG5hbWUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgR2l6bW8gcGl2b3QgY2hhbmdlZCB0byAnJHtuYW1lfSdgKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEdpem1vUGl2b3QoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tcGl2b3QnKS50aGVuKChwaXZvdE5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IGN1cnJlbnRQaXZvdDogcGl2b3ROYW1lIH0sIGBDdXJyZW50IEdpem1vIHBpdm90OiAke3Bpdm90TmFtZX1gKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFZpZXdNb2RlKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWdpem1vLXZpZXctbW9kZScpLnRoZW4oKHZpZXdNb2RlOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyB2aWV3TW9kZSB9LCBgQ3VycmVudCB2aWV3IG1vZGU6ICR7dmlld01vZGV9YCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb29yZGluYXRlKHR5cGU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXR5cGUpIHJldHVybiBlcnJvclJlc3VsdCgndHlwZSBpcyByZXF1aXJlZCBmb3Igc2V0X2Nvb3JkaW5hdGUnKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjaGFuZ2UtZ2l6bW8tY29vcmRpbmF0ZScsIHR5cGUpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgQ29vcmRpbmF0ZSBzeXN0ZW0gY2hhbmdlZCB0byAnJHt0eXBlfSdgKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldENvb3JkaW5hdGUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZ2l6bW8tY29vcmRpbmF0ZScpLnRoZW4oKGNvb3JkaW5hdGU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IGNvb3JkaW5hdGUgfSwgYEN1cnJlbnQgY29vcmRpbmF0ZSBzeXN0ZW06ICR7Y29vcmRpbmF0ZX1gKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldDJEM0QoaXMyRDogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoaXMyRCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2lzMkQgaXMgcmVxdWlyZWQgZm9yIHNldF8yZF8zZCcpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NoYW5nZS1pczJEJywgaXMyRCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBWaWV3IG1vZGUgY2hhbmdlZCB0byAke2lzMkQgPyAnMkQnIDogJzNEJ31gKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldDJEM0QoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaXMyRCcpLnRoZW4oKGlzMkQ6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgaXMyRCwgdmlld01vZGU6IGlzMkQgPyAnMkQnIDogJzNEJyB9LFxuICAgICAgICAgICAgICAgICAgICBgQ3VycmVudCB2aWV3IG1vZGU6ICR7aXMyRCA/ICcyRCcgOiAnM0QnfWBcbiAgICAgICAgICAgICAgICApKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0R3JpZCh2aXNpYmxlOiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICh2aXNpYmxlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmlzaWJsZSBpcyByZXF1aXJlZCBmb3Igc2V0X2dyaWQnKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtZ3JpZC12aXNpYmxlJywgdmlzaWJsZSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBHcmlkICR7dmlzaWJsZSA/ICdzaG93bicgOiAnaGlkZGVuJ31gKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEdyaWQoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaXMtZ3JpZC12aXNpYmxlJykudGhlbigodmlzaWJsZTogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IHZpc2libGUgfSwgYEdyaWQgaXMgJHt2aXNpYmxlID8gJ3Zpc2libGUnIDogJ2hpZGRlbid9YCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRJY29uR2l6bW8zRChpczNEOiBib29sZWFuIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmIChpczNEID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgnaXMzRCBpcyByZXF1aXJlZCBmb3Igc2V0X2ljb25fZ2l6bW9fM2QnKTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtaWNvbi1naXptby0zZCcsIGlzM0QpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgSWNvbkdpem1vIHNldCB0byAke2lzM0QgPyAnM0QnIDogJzJEJ30gbW9kZWApKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0SWNvbkdpem1vM0QoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaXMtaWNvbi1naXptby0zZCcpLnRoZW4oKGlzM0Q6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgaXMzRCwgbW9kZTogaXMzRCA/ICczRCcgOiAnMkQnIH0sXG4gICAgICAgICAgICAgICAgICAgIGBJY29uR2l6bW8gaXMgaW4gJHtpczNEID8gJzNEJyA6ICcyRCd9IG1vZGVgXG4gICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldEljb25HaXptb1NpemUoc2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmIChzaXplID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgnc2l6ZSBpcyByZXF1aXJlZCBmb3Igc2V0X2ljb25fZ2l6bW9fc2l6ZScpO1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1pY29uLWdpem1vLXNpemUnLCBzaXplKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgYEljb25HaXptbyBzaXplIHNldCB0byAke3NpemV9YCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRJY29uR2l6bW9TaXplKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWljb24tZ2l6bW8tc2l6ZScpLnRoZW4oKHNpemU6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IHNpemUgfSwgYEljb25HaXptbyBzaXplOiAke3NpemV9YCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmb2N1c0NhbWVyYSh1dWlkczogc3RyaW5nW10gfCBudWxsIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZm9jdXMtY2FtZXJhJywgdXVpZHMgfHwgW10pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSB1dWlkcyA9PT0gbnVsbCB8fCB1dWlkcyA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgID8gJ0NhbWVyYSBmb2N1c2VkIG9uIGFsbCBub2RlcydcbiAgICAgICAgICAgICAgICAgICAgOiBgQ2FtZXJhIGZvY3VzZWQgb24gJHt1dWlkcy5sZW5ndGh9IG5vZGUocylgO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBtZXNzYWdlKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGFsaWduQ2FtZXJhKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2FsaWduLXdpdGgtdmlldycpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCAnU2NlbmUgY2FtZXJhIGFsaWduZWQgd2l0aCBjdXJyZW50IHZpZXcnKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGFsaWduVmlldygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdhbGlnbi13aXRoLXZpZXctbm9kZScpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCAnVmlldyBhbGlnbmVkIHdpdGggc2VsZWN0ZWQgbm9kZScpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U3RhdHVzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgW1xuICAgICAgICAgICAgICAgIGdpem1vVG9vbCxcbiAgICAgICAgICAgICAgICBnaXptb1Bpdm90LFxuICAgICAgICAgICAgICAgIGdpem1vQ29vcmRpbmF0ZSxcbiAgICAgICAgICAgICAgICB2aWV3TW9kZTJEM0QsXG4gICAgICAgICAgICAgICAgZ3JpZFZpc2libGUsXG4gICAgICAgICAgICAgICAgaWNvbkdpem1vM0QsXG4gICAgICAgICAgICAgICAgaWNvbkdpem1vU2l6ZVxuICAgICAgICAgICAgXSA9IGF3YWl0IFByb21pc2UuYWxsU2V0dGxlZChbXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRHaXptb1Rvb2woKSxcbiAgICAgICAgICAgICAgICB0aGlzLmdldEdpem1vUGl2b3QoKSxcbiAgICAgICAgICAgICAgICB0aGlzLmdldENvb3JkaW5hdGUoKSxcbiAgICAgICAgICAgICAgICB0aGlzLmdldDJEM0QoKSxcbiAgICAgICAgICAgICAgICB0aGlzLmdldEdyaWQoKSxcbiAgICAgICAgICAgICAgICB0aGlzLmdldEljb25HaXptbzNEKCksXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRJY29uR2l6bW9TaXplKClcbiAgICAgICAgICAgIF0pO1xuXG4gICAgICAgICAgICBjb25zdCBzdGF0dXM6IGFueSA9IHsgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkgfTtcblxuICAgICAgICAgICAgaWYgKGdpem1vVG9vbC5zdGF0dXMgPT09ICdmdWxmaWxsZWQnICYmIGdpem1vVG9vbC52YWx1ZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmdpem1vVG9vbCA9IGdpem1vVG9vbC52YWx1ZS5kYXRhLmN1cnJlbnRUb29sO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGdpem1vUGl2b3Quc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiBnaXptb1Bpdm90LnZhbHVlLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMuZ2l6bW9QaXZvdCA9IGdpem1vUGl2b3QudmFsdWUuZGF0YS5jdXJyZW50UGl2b3Q7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZ2l6bW9Db29yZGluYXRlLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgZ2l6bW9Db29yZGluYXRlLnZhbHVlLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMuY29vcmRpbmF0ZSA9IGdpem1vQ29vcmRpbmF0ZS52YWx1ZS5kYXRhLmNvb3JkaW5hdGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodmlld01vZGUyRDNELnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgdmlld01vZGUyRDNELnZhbHVlLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICBzdGF0dXMuaXMyRCA9IHZpZXdNb2RlMkQzRC52YWx1ZS5kYXRhLmlzMkQ7XG4gICAgICAgICAgICAgICAgc3RhdHVzLnZpZXdNb2RlID0gdmlld01vZGUyRDNELnZhbHVlLmRhdGEudmlld01vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZ3JpZFZpc2libGUuc3RhdHVzID09PSAnZnVsZmlsbGVkJyAmJiBncmlkVmlzaWJsZS52YWx1ZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmdyaWRWaXNpYmxlID0gZ3JpZFZpc2libGUudmFsdWUuZGF0YS52aXNpYmxlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGljb25HaXptbzNELnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgaWNvbkdpem1vM0QudmFsdWUuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHN0YXR1cy5pY29uR2l6bW8zRCA9IGljb25HaXptbzNELnZhbHVlLmRhdGEuaXMzRDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChpY29uR2l6bW9TaXplLnN0YXR1cyA9PT0gJ2Z1bGZpbGxlZCcgJiYgaWNvbkdpem1vU2l6ZS52YWx1ZS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgc3RhdHVzLmljb25HaXptb1NpemUgPSBpY29uR2l6bW9TaXplLnZhbHVlLmRhdGEuc2l6ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoc3RhdHVzKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGdldCBzY2VuZSB2aWV3IHN0YXR1czogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVzZXQoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRHaXptb1Rvb2woJ3Bvc2l0aW9uJyksXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRHaXptb1Bpdm90KCdwaXZvdCcpLFxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q29vcmRpbmF0ZSgnbG9jYWwnKSxcbiAgICAgICAgICAgICAgICB0aGlzLnNldDJEM0QoZmFsc2UpLFxuICAgICAgICAgICAgICAgIHRoaXMuc2V0R3JpZCh0cnVlKSxcbiAgICAgICAgICAgICAgICB0aGlzLnNldEljb25HaXptbzNEKHRydWUpLFxuICAgICAgICAgICAgICAgIHRoaXMuc2V0SWNvbkdpem1vU2l6ZSg2MClcbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1NjZW5lIHZpZXcgcmVzZXQgdG8gZGVmYXVsdCBzZXR0aW5ncycpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVzZXQgc2NlbmUgdmlldzogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==