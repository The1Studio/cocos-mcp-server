"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageNodeHierarchy = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
const manage_component_prefab_guard_1 = require("./manage-component-prefab-guard");
class ManageNodeHierarchy extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_node_hierarchy';
        this.description = 'Advanced node hierarchy operations. Actions: reset_property, move_array_element, remove_array_element, copy, paste, cut, reset_transform, reset_component, restore_prefab, execute_method. reset_property and reset_component restore CLASS DEFAULTS, not the values a prefab instance carries. For basic node CRUD use manage_node instead.';
        this.actions = [
            'reset_property',
            'move_array_element',
            'remove_array_element',
            'copy',
            'paste',
            'cut',
            'reset_transform',
            'reset_component',
            'restore_prefab',
            'execute_method',
        ];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: this.actions,
                    description: 'Operation to perform'
                },
                uuid: { type: 'string', description: 'Node or component UUID' },
                path: { type: 'string', description: 'Property or array path (e.g., position, __comps__)' },
                target: {
                    oneOf: [{ type: 'number' }, { type: 'string' }],
                    description: 'Target item original index as a number (move_array_element) or target parent node UUID as a string (paste)'
                },
                offset: { type: 'number', description: 'Offset amount, positive or negative (move_array_element)' },
                index: { type: 'number', description: 'Index to remove (remove_array_element)' },
                uuids: {
                    oneOf: [
                        { type: 'string' },
                        { type: 'array', items: { type: 'string' } }
                    ],
                    description: 'Node UUID or array of UUIDs (copy, paste, cut)'
                },
                keepWorldTransform: { type: 'boolean', description: 'Keep world transform when pasting (paste)', default: false },
                nodeUuid: { type: 'string', description: 'Node UUID (restore_prefab)' },
                assetUuid: { type: 'string', description: 'Prefab asset UUID (restore_prefab)' },
                name: { type: 'string', description: 'Method name (execute_method)' },
                args: { type: 'array', description: 'Method arguments (execute_method)', default: [] }
            },
            required: ['action']
        };
        this.actionHandlers = {
            reset_property: (args) => this.resetProperty(args.uuid, args.path),
            move_array_element: (args) => this.moveArrayElement(args.uuid, args.path, (0, normalize_1.coerceInt)(args.target), (0, normalize_1.coerceInt)(args.offset)),
            remove_array_element: (args) => {
                const index = (0, normalize_1.coerceInt)(args.index);
                if (index === undefined) {
                    return Promise.resolve((0, types_1.errorResult)('remove_array_element requires a numeric index'));
                }
                return this.removeArrayElement(args.uuid, args.path, index);
            },
            copy: (args) => this.withUuids('copy', args, (uuids) => this.copyNode(uuids)),
            paste: (args) => this.withUuids('paste', args, (uuids) => { var _a; return this.pasteNode(args.target, uuids, (_a = (0, normalize_1.coerceBool)(args.keepWorldTransform)) !== null && _a !== void 0 ? _a : false); }),
            cut: (args) => this.withUuids('cut', args, (uuids) => this.cutNode(uuids)),
            reset_transform: (args) => this.resetTransform(args.uuid),
            reset_component: (args) => this.resetComponent(args.uuid),
            restore_prefab: (args) => this.restorePrefab(args.nodeUuid, args.assetUuid),
            execute_method: (args) => this.executeMethod(args.uuid, args.name, args.args),
        };
    }
    /** Reject missing/empty `uuids` up front: forwarding it makes the editor act on nothing (#149). */
    withUuids(action, args, run) {
        const uuids = (0, normalize_1.normalizeStringArray)(args.uuids);
        if (!uuids || uuids.length === 0) {
            return Promise.resolve((0, types_1.errorResult)(`${action} requires 'uuids': a node UUID or a non-empty array of node UUIDs`));
        }
        return run(uuids);
    }
    async resetProperty(uuid, path) {
        try {
            const result = await Editor.Message.request('scene', 'reset-property', {
                uuid,
                path,
                dump: { value: null }
            });
            if (result === false) {
                return (0, types_1.errorResult)(`Editor rejected reset-property for '${path}' on node ${uuid}.`);
            }
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
        // #1649: `reset-property` takes no "revert to the prefab's value" parameter
        // (`SetPropertyOptions` is `{ uuid, path, dump, record? }`), so on an instance node it
        // writes the CLASS DEFAULT and the prefab's own value is lost. Report that honestly
        // instead of a bare success the caller reads as a faithful reset.
        if (await this.isInsidePrefabInstance(uuid)) {
            return (0, types_1.successResult)({ persistenceVerified: false }, `Property '${path}' reset to its class default. This node sits inside a prefab ` +
                `instance, so the class default is NOT the value the prefab carries — the ` +
                `prefab's value for '${path}' has been replaced. To restore the prefab's value, ` +
                `revert the instance (manage_prefab action=revert) instead of resetting.`);
        }
        return (0, types_1.successResult)({ persistenceVerified: true }, `Property '${path}' reset to default value (the class default; this node is not inside a prefab instance)`);
    }
    /**
     * Whether `uuid` belongs to a prefab instance. Advisory only: a query failure or an
     * unresolvable uuid reports `false` so the reset is never broken by this check
     * (the issue #48 contract for `detectPrefabOverrideRisk`).
     */
    async isInsidePrefabInstance(uuid) {
        const queryNode = (target) => Editor.Message.request('scene', 'query-node', target);
        if (await (0, manage_component_prefab_guard_1.prefabInstanceRoot)(uuid, queryNode))
            return true;
        // `reset_component` is given a COMPONENT uuid. An editor dump carries `__prefab__` on
        // both nodes and components, so testing the uuid directly covers that case too; when
        // it does not resolve, ask the component which instance mounted it.
        try {
            const component = await Editor.Message.request('scene', 'query-component', uuid);
            const mountedRoot = component === null || component === void 0 ? void 0 : component.mountedRoot;
            return Boolean(mountedRoot && await (0, manage_component_prefab_guard_1.prefabInstanceRoot)(mountedRoot, queryNode));
        }
        catch (_a) {
            return false;
        }
    }
    async moveArrayElement(uuid, path, target, offset) {
        return new Promise((resolve) => {
            // The @cocos/creator-types declaration claims `result: void`, but the editor
            // actually resolves a boolean success flag here (mirrors 'restore-prefab' in
            // manage-prefab.ts, whose declared `void` return is equally stale) — cast past
            // the wrong type rather than silently discarding the real result.
            Editor.Message.request('scene', 'move-array-element', { uuid, path, target, offset }).then((result) => {
                if (result === false) {
                    resolve((0, types_1.errorResult)(`Editor rejected move-array-element at index ${target} on '${path}' for node ${uuid}.`));
                    return;
                }
                resolve((0, types_1.successResult)(null, `Array element at index ${target} moved by ${offset}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async removeArrayElement(uuid, path, index) {
        return new Promise((resolve) => {
            // See moveArrayElement above — 'remove-array-element' has the same stale
            // `result: void` declaration despite resolving a real boolean at runtime.
            Editor.Message.request('scene', 'remove-array-element', { uuid, path, index }).then((result) => {
                if (result === false) {
                    resolve((0, types_1.errorResult)(`Editor rejected remove-array-element at index ${index} on '${path}' for node ${uuid}.`));
                    return;
                }
                resolve((0, types_1.successResult)(null, `Array element at index ${index} removed`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async copyNode(uuids) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'copy-node', uuids).then((result) => {
                resolve((0, types_1.successResult)({ copiedUuids: result }, 'Node(s) copied successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async pasteNode(target, uuids, keepWorldTransform) {
        var _a;
        try {
            const result = await Editor.Message.request('scene', 'paste-node', { target, uuids, keepWorldTransform });
            const newUuids = (_a = (0, normalize_1.normalizeStringArray)(result)) !== null && _a !== void 0 ? _a : [];
            if (newUuids.length === 0) {
                return (0, types_1.errorResult)('Editor reported success for paste-node but created no nodes.');
            }
            for (const newUuid of newUuids) {
                const node = await Editor.Message.request('scene', 'query-node', newUuid);
                if (!node) {
                    return (0, types_1.errorResult)(`paste-node returned ${newUuid}, but no such node exists in the scene.`);
                }
            }
            return (0, types_1.successResult)({ newUuids }, 'Node(s) pasted successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async cutNode(uuids) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'cut-node', uuids).then((result) => {
                resolve((0, types_1.successResult)({ cutUuids: result }, 'Node(s) cut successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async resetTransform(uuid) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'reset-node', { uuid }).then(() => {
                resolve((0, types_1.successResult)(null, 'Node transform reset to default'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async resetComponent(uuid) {
        try {
            await Editor.Message.request('scene', 'reset-component', { uuid });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
        // #1649: same limitation as resetProperty — `ResetComponentOptions` is `{ uuid }`,
        // so there is no way to ask the editor for the prefab's values instead of the
        // class defaults. Say so rather than reporting a reset that lost them.
        if (await this.isInsidePrefabInstance(uuid)) {
            return (0, types_1.successResult)({ persistenceVerified: false }, `Component reset to its CLASS DEFAULT values. This component sits inside a ` +
                `prefab instance, so the class defaults are NOT the values the prefab carries ` +
                `— every property the prefab had set has been replaced. To restore the prefab's ` +
                `values, revert the instance (manage_prefab action=revert) instead of resetting.`);
        }
        return (0, types_1.successResult)({ persistenceVerified: true }, 'Component reset to default values (the class defaults; this component is not inside a prefab instance)');
    }
    async restorePrefab(nodeUuid, assetUuid) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'restore-prefab', nodeUuid, assetUuid).then(() => {
                resolve((0, types_1.successResult)(null, 'Prefab restored successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async executeMethod(uuid, name, args = []) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-component-method', { uuid, name, args }).then((result) => {
                resolve((0, types_1.successResult)({ result }, `Method '${name}' executed successfully`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
}
exports.ManageNodeHierarchy = ManageNodeHierarchy;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUtaGllcmFyY2h5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1ub2RlLWhpZXJhcmNoeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLGtEQUFpRjtBQUNqRixtRkFBcUU7QUFFckUsTUFBYSxtQkFBb0IsU0FBUSxpQ0FBYztJQUF2RDs7UUFDYSxTQUFJLEdBQUcsdUJBQXVCLENBQUM7UUFDL0IsZ0JBQVcsR0FBRyw4VUFBOFUsQ0FBQztRQUM3VixZQUFPLEdBQUc7WUFDZixnQkFBZ0I7WUFDaEIsb0JBQW9CO1lBQ3BCLHNCQUFzQjtZQUN0QixNQUFNO1lBQ04sT0FBTztZQUNQLEtBQUs7WUFDTCxpQkFBaUI7WUFDakIsaUJBQWlCO1lBQ2pCLGdCQUFnQjtZQUNoQixnQkFBZ0I7U0FDbkIsQ0FBQztRQUNPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTztvQkFDbEIsV0FBVyxFQUFFLHNCQUFzQjtpQkFDdEM7Z0JBQ0QsSUFBSSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsd0JBQXdCLEVBQUU7Z0JBQy9ELElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG9EQUFvRCxFQUFFO2dCQUMzRixNQUFNLEVBQUU7b0JBQ0osS0FBSyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLENBQUM7b0JBQy9DLFdBQVcsRUFBRSw0R0FBNEc7aUJBQzVIO2dCQUNELE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLDBEQUEw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QyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBWSxFQUFFLElBQVksRUFBRSxPQUFjLEVBQUU7UUFDcEUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzNCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFXLEVBQUUsRUFBRTtnQkFDbkcsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQyxFQUFFLE1BQU0sRUFBRSxFQUFFLFdBQVcsSUFBSSx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7WUFDakYsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQXBRRCxrREFvUUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wsIGNvZXJjZUludCwgbm9ybWFsaXplU3RyaW5nQXJyYXkgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgcHJlZmFiSW5zdGFuY2VSb290IH0gZnJvbSAnLi9tYW5hZ2UtY29tcG9uZW50LXByZWZhYi1ndWFyZCc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VOb2RlSGllcmFyY2h5IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX25vZGVfaGllcmFyY2h5JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdBZHZhbmNlZCBub2RlIGhpZXJhcmNoeSBvcGVyYXRpb25zLiBBY3Rpb25zOiByZXNldF9wcm9wZXJ0eSwgbW92ZV9hcnJheV9lbGVtZW50LCByZW1vdmVfYXJyYXlfZWxlbWVudCwgY29weSwgcGFzdGUsIGN1dCwgcmVzZXRfdHJhbnNmb3JtLCByZXNldF9jb21wb25lbnQsIHJlc3RvcmVfcHJlZmFiLCBleGVjdXRlX21ldGhvZC4gcmVzZXRfcHJvcGVydHkgYW5kIHJlc2V0X2NvbXBvbmVudCByZXN0b3JlIENMQVNTIERFRkFVTFRTLCBub3QgdGhlIHZhbHVlcyBhIHByZWZhYiBpbnN0YW5jZSBjYXJyaWVzLiBGb3IgYmFzaWMgbm9kZSBDUlVEIHVzZSBtYW5hZ2Vfbm9kZSBpbnN0ZWFkLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFtcbiAgICAgICAgJ3Jlc2V0X3Byb3BlcnR5JyxcbiAgICAgICAgJ21vdmVfYXJyYXlfZWxlbWVudCcsXG4gICAgICAgICdyZW1vdmVfYXJyYXlfZWxlbWVudCcsXG4gICAgICAgICdjb3B5JyxcbiAgICAgICAgJ3Bhc3RlJyxcbiAgICAgICAgJ2N1dCcsXG4gICAgICAgICdyZXNldF90cmFuc2Zvcm0nLFxuICAgICAgICAncmVzZXRfY29tcG9uZW50JyxcbiAgICAgICAgJ3Jlc3RvcmVfcHJlZmFiJyxcbiAgICAgICAgJ2V4ZWN1dGVfbWV0aG9kJyxcbiAgICBdO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnT3BlcmF0aW9uIHRvIHBlcmZvcm0nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXVpZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdOb2RlIG9yIGNvbXBvbmVudCBVVUlEJyB9LFxuICAgICAgICAgICAgcGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQcm9wZXJ0eSBvciBhcnJheSBwYXRoIChlLmcuLCBwb3NpdGlvbiwgX19jb21wc19fKScgfSxcbiAgICAgICAgICAgIHRhcmdldDoge1xuICAgICAgICAgICAgICAgIG9uZU9mOiBbeyB0eXBlOiAnbnVtYmVyJyB9LCB7IHR5cGU6ICdzdHJpbmcnIH1dLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGl0ZW0gb3JpZ2luYWwgaW5kZXggYXMgYSBudW1iZXIgKG1vdmVfYXJyYXlfZWxlbWVudCkgb3IgdGFyZ2V0IHBhcmVudCBub2RlIFVVSUQgYXMgYSBzdHJpbmcgKHBhc3RlKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBvZmZzZXQ6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnT2Zmc2V0IGFtb3VudCwgcG9zaXRpdmUgb3IgbmVnYXRpdmUgKG1vdmVfYXJyYXlfZWxlbWVudCknIH0sXG4gICAgICAgICAgICBpbmRleDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdJbmRleCB0byByZW1vdmUgKHJlbW92ZV9hcnJheV9lbGVtZW50KScgfSxcbiAgICAgICAgICAgIHV1aWRzOiB7XG4gICAgICAgICAgICAgICAgb25lT2Y6IFtcbiAgICAgICAgICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJyB9LFxuICAgICAgICAgICAgICAgICAgICB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdOb2RlIFVVSUQgb3IgYXJyYXkgb2YgVVVJRHMgKGNvcHksIHBhc3RlLCBjdXQpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGtlZXBXb3JsZFRyYW5zZm9ybTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnS2VlcCB3b3JsZCB0cmFuc2Zvcm0gd2hlbiBwYXN0aW5nIChwYXN0ZSknLCBkZWZhdWx0OiBmYWxzZSB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnTm9kZSBVVUlEIChyZXN0b3JlX3ByZWZhYiknIH0sXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKHJlc3RvcmVfcHJlZmFiKScgfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnTWV0aG9kIG5hbWUgKGV4ZWN1dGVfbWV0aG9kKScgfSxcbiAgICAgICAgICAgIGFyZ3M6IHsgdHlwZTogJ2FycmF5JywgZGVzY3JpcHRpb246ICdNZXRob2QgYXJndW1lbnRzIChleGVjdXRlX21ldGhvZCknLCBkZWZhdWx0OiBbXSB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICByZXNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMucmVzZXRQcm9wZXJ0eShhcmdzLnV1aWQsIGFyZ3MucGF0aCksXG4gICAgICAgIG1vdmVfYXJyYXlfZWxlbWVudDogKGFyZ3MpID0+IHRoaXMubW92ZUFycmF5RWxlbWVudChhcmdzLnV1aWQsIGFyZ3MucGF0aCwgY29lcmNlSW50KGFyZ3MudGFyZ2V0KSEsIGNvZXJjZUludChhcmdzLm9mZnNldCkhKSxcbiAgICAgICAgcmVtb3ZlX2FycmF5X2VsZW1lbnQ6IChhcmdzKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IGNvZXJjZUludChhcmdzLmluZGV4KTtcbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShlcnJvclJlc3VsdCgncmVtb3ZlX2FycmF5X2VsZW1lbnQgcmVxdWlyZXMgYSBudW1lcmljIGluZGV4JykpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVtb3ZlQXJyYXlFbGVtZW50KGFyZ3MudXVpZCwgYXJncy5wYXRoLCBpbmRleCk7XG4gICAgICAgIH0sXG4gICAgICAgIGNvcHk6IChhcmdzKSA9PiB0aGlzLndpdGhVdWlkcygnY29weScsIGFyZ3MsICh1dWlkcykgPT4gdGhpcy5jb3B5Tm9kZSh1dWlkcykpLFxuICAgICAgICBwYXN0ZTogKGFyZ3MpID0+IHRoaXMud2l0aFV1aWRzKCdwYXN0ZScsIGFyZ3MsICh1dWlkcykgPT5cbiAgICAgICAgICAgIHRoaXMucGFzdGVOb2RlKGFyZ3MudGFyZ2V0LCB1dWlkcywgY29lcmNlQm9vbChhcmdzLmtlZXBXb3JsZFRyYW5zZm9ybSkgPz8gZmFsc2UpKSxcbiAgICAgICAgY3V0OiAoYXJncykgPT4gdGhpcy53aXRoVXVpZHMoJ2N1dCcsIGFyZ3MsICh1dWlkcykgPT4gdGhpcy5jdXROb2RlKHV1aWRzKSksXG4gICAgICAgIHJlc2V0X3RyYW5zZm9ybTogKGFyZ3MpID0+IHRoaXMucmVzZXRUcmFuc2Zvcm0oYXJncy51dWlkKSxcbiAgICAgICAgcmVzZXRfY29tcG9uZW50OiAoYXJncykgPT4gdGhpcy5yZXNldENvbXBvbmVudChhcmdzLnV1aWQpLFxuICAgICAgICByZXN0b3JlX3ByZWZhYjogKGFyZ3MpID0+IHRoaXMucmVzdG9yZVByZWZhYihhcmdzLm5vZGVVdWlkLCBhcmdzLmFzc2V0VXVpZCksXG4gICAgICAgIGV4ZWN1dGVfbWV0aG9kOiAoYXJncykgPT4gdGhpcy5leGVjdXRlTWV0aG9kKGFyZ3MudXVpZCwgYXJncy5uYW1lLCBhcmdzLmFyZ3MpLFxuICAgIH07XG5cbiAgICAvKiogUmVqZWN0IG1pc3NpbmcvZW1wdHkgYHV1aWRzYCB1cCBmcm9udDogZm9yd2FyZGluZyBpdCBtYWtlcyB0aGUgZWRpdG9yIGFjdCBvbiBub3RoaW5nICgjMTQ5KS4gKi9cbiAgICBwcml2YXRlIHdpdGhVdWlkcyhcbiAgICAgICAgYWN0aW9uOiBzdHJpbmcsXG4gICAgICAgIGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4sXG4gICAgICAgIHJ1bjogKHV1aWRzOiBzdHJpbmdbXSkgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PlxuICAgICk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB1dWlkcyA9IG5vcm1hbGl6ZVN0cmluZ0FycmF5KGFyZ3MudXVpZHMpO1xuICAgICAgICBpZiAoIXV1aWRzIHx8IHV1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShlcnJvclJlc3VsdChgJHthY3Rpb259IHJlcXVpcmVzICd1dWlkcyc6IGEgbm9kZSBVVUlEIG9yIGEgbm9uLWVtcHR5IGFycmF5IG9mIG5vZGUgVVVJRHNgKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJ1bih1dWlkcyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZXNldFByb3BlcnR5KHV1aWQ6IHN0cmluZywgcGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IGJvb2xlYW4gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZXNldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgIHBhdGgsXG4gICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogbnVsbCB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBFZGl0b3IgcmVqZWN0ZWQgcmVzZXQtcHJvcGVydHkgZm9yICcke3BhdGh9JyBvbiBub2RlICR7dXVpZH0uYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gIzE2NDk6IGByZXNldC1wcm9wZXJ0eWAgdGFrZXMgbm8gXCJyZXZlcnQgdG8gdGhlIHByZWZhYidzIHZhbHVlXCIgcGFyYW1ldGVyXG4gICAgICAgIC8vIChgU2V0UHJvcGVydHlPcHRpb25zYCBpcyBgeyB1dWlkLCBwYXRoLCBkdW1wLCByZWNvcmQ/IH1gKSwgc28gb24gYW4gaW5zdGFuY2Ugbm9kZSBpdFxuICAgICAgICAvLyB3cml0ZXMgdGhlIENMQVNTIERFRkFVTFQgYW5kIHRoZSBwcmVmYWIncyBvd24gdmFsdWUgaXMgbG9zdC4gUmVwb3J0IHRoYXQgaG9uZXN0bHlcbiAgICAgICAgLy8gaW5zdGVhZCBvZiBhIGJhcmUgc3VjY2VzcyB0aGUgY2FsbGVyIHJlYWRzIGFzIGEgZmFpdGhmdWwgcmVzZXQuXG4gICAgICAgIGlmIChhd2FpdCB0aGlzLmlzSW5zaWRlUHJlZmFiSW5zdGFuY2UodXVpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgIHsgcGVyc2lzdGVuY2VWZXJpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICBgUHJvcGVydHkgJyR7cGF0aH0nIHJlc2V0IHRvIGl0cyBjbGFzcyBkZWZhdWx0LiBUaGlzIG5vZGUgc2l0cyBpbnNpZGUgYSBwcmVmYWIgYCArXG4gICAgICAgICAgICAgICAgYGluc3RhbmNlLCBzbyB0aGUgY2xhc3MgZGVmYXVsdCBpcyBOT1QgdGhlIHZhbHVlIHRoZSBwcmVmYWIgY2FycmllcyDigJQgdGhlIGAgK1xuICAgICAgICAgICAgICAgIGBwcmVmYWIncyB2YWx1ZSBmb3IgJyR7cGF0aH0nIGhhcyBiZWVuIHJlcGxhY2VkLiBUbyByZXN0b3JlIHRoZSBwcmVmYWIncyB2YWx1ZSwgYCArXG4gICAgICAgICAgICAgICAgYHJldmVydCB0aGUgaW5zdGFuY2UgKG1hbmFnZV9wcmVmYWIgYWN0aW9uPXJldmVydCkgaW5zdGVhZCBvZiByZXNldHRpbmcuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgIHsgcGVyc2lzdGVuY2VWZXJpZmllZDogdHJ1ZSB9LFxuICAgICAgICAgICAgYFByb3BlcnR5ICcke3BhdGh9JyByZXNldCB0byBkZWZhdWx0IHZhbHVlICh0aGUgY2xhc3MgZGVmYXVsdDsgdGhpcyBub2RlIGlzIG5vdCBpbnNpZGUgYSBwcmVmYWIgaW5zdGFuY2UpYFxuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdoZXRoZXIgYHV1aWRgIGJlbG9uZ3MgdG8gYSBwcmVmYWIgaW5zdGFuY2UuIEFkdmlzb3J5IG9ubHk6IGEgcXVlcnkgZmFpbHVyZSBvciBhblxuICAgICAqIHVucmVzb2x2YWJsZSB1dWlkIHJlcG9ydHMgYGZhbHNlYCBzbyB0aGUgcmVzZXQgaXMgbmV2ZXIgYnJva2VuIGJ5IHRoaXMgY2hlY2tcbiAgICAgKiAodGhlIGlzc3VlICM0OCBjb250cmFjdCBmb3IgYGRldGVjdFByZWZhYk92ZXJyaWRlUmlza2ApLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgaXNJbnNpZGVQcmVmYWJJbnN0YW5jZSh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICAgICAgY29uc3QgcXVlcnlOb2RlID0gKHRhcmdldDogc3RyaW5nKSA9PiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdGFyZ2V0KTtcbiAgICAgICAgaWYgKGF3YWl0IHByZWZhYkluc3RhbmNlUm9vdCh1dWlkLCBxdWVyeU5vZGUpKSByZXR1cm4gdHJ1ZTtcbiAgICAgICAgLy8gYHJlc2V0X2NvbXBvbmVudGAgaXMgZ2l2ZW4gYSBDT01QT05FTlQgdXVpZC4gQW4gZWRpdG9yIGR1bXAgY2FycmllcyBgX19wcmVmYWJfX2Agb25cbiAgICAgICAgLy8gYm90aCBub2RlcyBhbmQgY29tcG9uZW50cywgc28gdGVzdGluZyB0aGUgdXVpZCBkaXJlY3RseSBjb3ZlcnMgdGhhdCBjYXNlIHRvbzsgd2hlblxuICAgICAgICAvLyBpdCBkb2VzIG5vdCByZXNvbHZlLCBhc2sgdGhlIGNvbXBvbmVudCB3aGljaCBpbnN0YW5jZSBtb3VudGVkIGl0LlxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnQnLCB1dWlkKTtcbiAgICAgICAgICAgIGNvbnN0IG1vdW50ZWRSb290ID0gY29tcG9uZW50Py5tb3VudGVkUm9vdDtcbiAgICAgICAgICAgIHJldHVybiBCb29sZWFuKG1vdW50ZWRSb290ICYmIGF3YWl0IHByZWZhYkluc3RhbmNlUm9vdChtb3VudGVkUm9vdCwgcXVlcnlOb2RlKSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBtb3ZlQXJyYXlFbGVtZW50KHV1aWQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCB0YXJnZXQ6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAvLyBUaGUgQGNvY29zL2NyZWF0b3ItdHlwZXMgZGVjbGFyYXRpb24gY2xhaW1zIGByZXN1bHQ6IHZvaWRgLCBidXQgdGhlIGVkaXRvclxuICAgICAgICAgICAgLy8gYWN0dWFsbHkgcmVzb2x2ZXMgYSBib29sZWFuIHN1Y2Nlc3MgZmxhZyBoZXJlIChtaXJyb3JzICdyZXN0b3JlLXByZWZhYicgaW5cbiAgICAgICAgICAgIC8vIG1hbmFnZS1wcmVmYWIudHMsIHdob3NlIGRlY2xhcmVkIGB2b2lkYCByZXR1cm4gaXMgZXF1YWxseSBzdGFsZSkg4oCUIGNhc3QgcGFzdFxuICAgICAgICAgICAgLy8gdGhlIHdyb25nIHR5cGUgcmF0aGVyIHRoYW4gc2lsZW50bHkgZGlzY2FyZGluZyB0aGUgcmVhbCByZXN1bHQuXG4gICAgICAgICAgICAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdtb3ZlLWFycmF5LWVsZW1lbnQnLCB7IHV1aWQsIHBhdGgsIHRhcmdldCwgb2Zmc2V0IH0pLnRoZW4oKHJlc3VsdDogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoYEVkaXRvciByZWplY3RlZCBtb3ZlLWFycmF5LWVsZW1lbnQgYXQgaW5kZXggJHt0YXJnZXR9IG9uICcke3BhdGh9JyBmb3Igbm9kZSAke3V1aWR9LmApKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgYEFycmF5IGVsZW1lbnQgYXQgaW5kZXggJHt0YXJnZXR9IG1vdmVkIGJ5ICR7b2Zmc2V0fWApKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVtb3ZlQXJyYXlFbGVtZW50KHV1aWQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBpbmRleDogbnVtYmVyKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgLy8gU2VlIG1vdmVBcnJheUVsZW1lbnQgYWJvdmUg4oCUICdyZW1vdmUtYXJyYXktZWxlbWVudCcgaGFzIHRoZSBzYW1lIHN0YWxlXG4gICAgICAgICAgICAvLyBgcmVzdWx0OiB2b2lkYCBkZWNsYXJhdGlvbiBkZXNwaXRlIHJlc29sdmluZyBhIHJlYWwgYm9vbGVhbiBhdCBydW50aW1lLlxuICAgICAgICAgICAgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAncmVtb3ZlLWFycmF5LWVsZW1lbnQnLCB7IHV1aWQsIHBhdGgsIGluZGV4IH0pLnRoZW4oKHJlc3VsdDogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoYEVkaXRvciByZWplY3RlZCByZW1vdmUtYXJyYXktZWxlbWVudCBhdCBpbmRleCAke2luZGV4fSBvbiAnJHtwYXRofScgZm9yIG5vZGUgJHt1dWlkfS5gKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBBcnJheSBlbGVtZW50IGF0IGluZGV4ICR7aW5kZXh9IHJlbW92ZWRgKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNvcHlOb2RlKHV1aWRzOiBzdHJpbmdbXSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NvcHktbm9kZScsIHV1aWRzKS50aGVuKChyZXN1bHQ6IHN0cmluZyB8IHN0cmluZ1tdKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgY29waWVkVXVpZHM6IHJlc3VsdCB9LCAnTm9kZShzKSBjb3BpZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBwYXN0ZU5vZGUodGFyZ2V0OiBzdHJpbmcsIHV1aWRzOiBzdHJpbmdbXSwga2VlcFdvcmxkVHJhbnNmb3JtOiBib29sZWFuKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IHN0cmluZyB8IHN0cmluZ1tdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncGFzdGUtbm9kZScsIHsgdGFyZ2V0LCB1dWlkcywga2VlcFdvcmxkVHJhbnNmb3JtIH0pO1xuICAgICAgICAgICAgY29uc3QgbmV3VXVpZHMgPSBub3JtYWxpemVTdHJpbmdBcnJheShyZXN1bHQpID8/IFtdO1xuICAgICAgICAgICAgaWYgKG5ld1V1aWRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnRWRpdG9yIHJlcG9ydGVkIHN1Y2Nlc3MgZm9yIHBhc3RlLW5vZGUgYnV0IGNyZWF0ZWQgbm8gbm9kZXMuJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG5ld1V1aWQgb2YgbmV3VXVpZHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5ld1V1aWQpO1xuICAgICAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYHBhc3RlLW5vZGUgcmV0dXJuZWQgJHtuZXdVdWlkfSwgYnV0IG5vIHN1Y2ggbm9kZSBleGlzdHMgaW4gdGhlIHNjZW5lLmApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbmV3VXVpZHMgfSwgJ05vZGUocykgcGFzdGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3V0Tm9kZSh1dWlkczogc3RyaW5nW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjdXQtbm9kZScsIHV1aWRzKS50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IGN1dFV1aWRzOiByZXN1bHQgfSwgJ05vZGUocykgY3V0IHN1Y2Nlc3NmdWxseScpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVzZXRUcmFuc2Zvcm0odXVpZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVzZXQtbm9kZScsIHsgdXVpZCB9KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ05vZGUgdHJhbnNmb3JtIHJlc2V0IHRvIGRlZmF1bHQnKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlc2V0Q29tcG9uZW50KHV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncmVzZXQtY29tcG9uZW50JywgeyB1dWlkIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vICMxNjQ5OiBzYW1lIGxpbWl0YXRpb24gYXMgcmVzZXRQcm9wZXJ0eSDigJQgYFJlc2V0Q29tcG9uZW50T3B0aW9uc2AgaXMgYHsgdXVpZCB9YCxcbiAgICAgICAgLy8gc28gdGhlcmUgaXMgbm8gd2F5IHRvIGFzayB0aGUgZWRpdG9yIGZvciB0aGUgcHJlZmFiJ3MgdmFsdWVzIGluc3RlYWQgb2YgdGhlXG4gICAgICAgIC8vIGNsYXNzIGRlZmF1bHRzLiBTYXkgc28gcmF0aGVyIHRoYW4gcmVwb3J0aW5nIGEgcmVzZXQgdGhhdCBsb3N0IHRoZW0uXG4gICAgICAgIGlmIChhd2FpdCB0aGlzLmlzSW5zaWRlUHJlZmFiSW5zdGFuY2UodXVpZCkpIHtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgIHsgcGVyc2lzdGVuY2VWZXJpZmllZDogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICBgQ29tcG9uZW50IHJlc2V0IHRvIGl0cyBDTEFTUyBERUZBVUxUIHZhbHVlcy4gVGhpcyBjb21wb25lbnQgc2l0cyBpbnNpZGUgYSBgICtcbiAgICAgICAgICAgICAgICBgcHJlZmFiIGluc3RhbmNlLCBzbyB0aGUgY2xhc3MgZGVmYXVsdHMgYXJlIE5PVCB0aGUgdmFsdWVzIHRoZSBwcmVmYWIgY2FycmllcyBgICtcbiAgICAgICAgICAgICAgICBg4oCUIGV2ZXJ5IHByb3BlcnR5IHRoZSBwcmVmYWIgaGFkIHNldCBoYXMgYmVlbiByZXBsYWNlZC4gVG8gcmVzdG9yZSB0aGUgcHJlZmFiJ3MgYCArXG4gICAgICAgICAgICAgICAgYHZhbHVlcywgcmV2ZXJ0IHRoZSBpbnN0YW5jZSAobWFuYWdlX3ByZWZhYiBhY3Rpb249cmV2ZXJ0KSBpbnN0ZWFkIG9mIHJlc2V0dGluZy5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgeyBwZXJzaXN0ZW5jZVZlcmlmaWVkOiB0cnVlIH0sXG4gICAgICAgICAgICAnQ29tcG9uZW50IHJlc2V0IHRvIGRlZmF1bHQgdmFsdWVzICh0aGUgY2xhc3MgZGVmYXVsdHM7IHRoaXMgY29tcG9uZW50IGlzIG5vdCBpbnNpZGUgYSBwcmVmYWIgaW5zdGFuY2UpJ1xuICAgICAgICApO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcmVzdG9yZVByZWZhYihub2RlVXVpZDogc3RyaW5nLCBhc3NldFV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgbm9kZVV1aWQsIGFzc2V0VXVpZCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsICdQcmVmYWIgcmVzdG9yZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlTWV0aG9kKHV1aWQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBhcmdzOiBhbnlbXSA9IFtdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1jb21wb25lbnQtbWV0aG9kJywgeyB1dWlkLCBuYW1lLCBhcmdzIH0pLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgcmVzdWx0IH0sIGBNZXRob2QgJyR7bmFtZX0nIGV4ZWN1dGVkIHN1Y2Nlc3NmdWxseWApKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdfQ==