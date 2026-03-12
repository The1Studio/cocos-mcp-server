import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceBool, coerceInt, normalizeStringArray } from '../utils/normalize';

export class ManageNodeHierarchy extends BaseActionTool {
    readonly name = 'manage_node_hierarchy';
    readonly description = 'Advanced node hierarchy operations. Actions: reset_property, move_array_element, remove_array_element, copy, paste, cut, reset_transform, reset_component, restore_prefab, execute_method. For basic node CRUD use manage_node instead.';
    readonly actions = [
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
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: this.actions,
                description: 'Operation to perform'
            },
            uuid: { type: 'string', description: 'Node or component UUID' },
            path: { type: 'string', description: 'Property or array path (e.g., position, __comps__)' },
            target: { type: 'number', description: 'Target item original index (move_array_element) or target parent UUID (paste)' },
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        reset_property: (args) => this.resetProperty(args.uuid, args.path),
        move_array_element: (args) => this.moveArrayElement(args.uuid, args.path, coerceInt(args.target)!, coerceInt(args.offset)!),
        remove_array_element: (args) => this.removeArrayElement(args.uuid, args.path, coerceInt(args.index)!),
        copy: (args) => this.copyNode(normalizeStringArray(args.uuids)!),
        paste: (args) => this.pasteNode(args.target, normalizeStringArray(args.uuids)!, coerceBool(args.keepWorldTransform) ?? false),
        cut: (args) => this.cutNode(normalizeStringArray(args.uuids)!),
        reset_transform: (args) => this.resetTransform(args.uuid),
        reset_component: (args) => this.resetComponent(args.uuid),
        restore_prefab: (args) => this.restorePrefab(args.nodeUuid, args.assetUuid),
        execute_method: (args) => this.executeMethod(args.uuid, args.name, args.args),
    };

    private async resetProperty(uuid: string, path: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'reset-property', {
                uuid,
                path,
                dump: { value: null }
            }).then(() => {
                resolve(successResult(null, `Property '${path}' reset to default value`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async moveArrayElement(uuid: string, path: string, target: number, offset: number): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'move-array-element', { uuid, path, target, offset }).then(() => {
                resolve(successResult(null, `Array element at index ${target} moved by ${offset}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async removeArrayElement(uuid: string, path: string, index: number): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'remove-array-element', { uuid, path, index }).then(() => {
                resolve(successResult(null, `Array element at index ${index} removed`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async copyNode(uuids: string[]): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'copy-node', uuids).then((result: string | string[]) => {
                resolve(successResult({ copiedUuids: result }, 'Node(s) copied successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async pasteNode(target: string, uuids: string[], keepWorldTransform: boolean): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'paste-node', { target, uuids, keepWorldTransform }).then((result: string | string[]) => {
                resolve(successResult({ newUuids: result }, 'Node(s) pasted successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async cutNode(uuids: string[]): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'cut-node', uuids).then((result: any) => {
                resolve(successResult({ cutUuids: result }, 'Node(s) cut successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async resetTransform(uuid: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'reset-node', { uuid }).then(() => {
                resolve(successResult(null, 'Node transform reset to default'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async resetComponent(uuid: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'reset-component', { uuid }).then(() => {
                resolve(successResult(null, 'Component reset to default values'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async restorePrefab(nodeUuid: string, assetUuid: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            (Editor.Message.request as any)('scene', 'restore-prefab', nodeUuid, assetUuid).then(() => {
                resolve(successResult(null, 'Prefab restored successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async executeMethod(uuid: string, name: string, args: any[] = []): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-component-method', { uuid, name, args }).then((result: any) => {
                resolve(successResult({ result }, `Method '${name}' executed successfully`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }
}
