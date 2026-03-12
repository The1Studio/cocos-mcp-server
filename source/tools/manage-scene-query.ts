import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageSceneQuery extends BaseActionTool {
    readonly name = 'manage_scene_query';
    readonly description = 'Scene introspection and scripting queries. Actions: execute_script, snapshot, snapshot_abort, soft_reload, query_ready, query_dirty, query_classes, query_components, query_has_script, query_by_asset. For node search use manage_node action=find instead.';
    readonly actions = [
        'execute_script',
        'snapshot',
        'snapshot_abort',
        'soft_reload',
        'query_ready',
        'query_dirty',
        'query_classes',
        'query_components',
        'query_has_script',
        'query_by_asset',
    ];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: this.actions,
                description: 'Operation to perform'
            },
            name: { type: 'string', description: 'Plugin name (execute_script)' },
            method: { type: 'string', description: 'Method name (execute_script)' },
            args: { type: 'array', description: 'Method arguments (execute_script)', default: [] },
            extends: { type: 'string', description: 'Filter classes by base class name (query_classes)' },
            className: { type: 'string', description: 'Script class name to check (query_has_script)' },
            assetUuid: { type: 'string', description: 'Asset UUID to find nodes for (query_by_asset)' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        execute_script: (args) => this.executeScript(args.name, args.method, args.args),
        snapshot: () => this.snapshot(),
        snapshot_abort: () => this.snapshotAbort(),
        soft_reload: () => this.softReload(),
        query_ready: () => this.queryReady(),
        query_dirty: () => this.queryDirty(),
        query_classes: (args) => this.queryClasses(args.extends),
        query_components: () => this.queryComponents(),
        query_has_script: (args) => this.queryHasScript(args.className),
        query_by_asset: (args) => this.queryByAsset(args.assetUuid),
    };

    private async executeScript(name: string, method: string, args: any[] = []): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-scene-script', { name, method, args }).then((result: any) => {
                resolve(successResult(result));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async snapshot(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'snapshot').then(() => {
                resolve(successResult(null, 'Scene snapshot created'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async snapshotAbort(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'snapshot-abort').then(() => {
                resolve(successResult(null, 'Scene snapshot aborted'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async softReload(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'soft-reload').then(() => {
                resolve(successResult(null, 'Scene soft reloaded successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryReady(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is-ready').then((ready: boolean) => {
                resolve(successResult({ ready }, ready ? 'Scene is ready' : 'Scene is not ready'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryDirty(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-dirty').then((dirty: boolean) => {
                resolve(successResult({ dirty }, dirty ? 'Scene has unsaved changes' : 'Scene is clean'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryClasses(extendsClass?: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const options: any = {};
            if (extendsClass) options.extends = extendsClass;
            Editor.Message.request('scene', 'query-classes', options).then((classes: any[]) => {
                resolve(successResult({ classes, count: classes.length, extendsFilter: extendsClass }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryComponents(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-components').then((components: any[]) => {
                resolve(successResult({ components, count: components.length }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryHasScript(className: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-component-has-script', className).then((hasScript: boolean) => {
                resolve(successResult(
                    { className, hasScript },
                    hasScript ? `Component '${className}' has script` : `Component '${className}' does not have script`
                ));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryByAsset(assetUuid: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-nodes-by-asset-uuid', assetUuid).then((nodeUuids: string[]) => {
                resolve(successResult(
                    { assetUuid, nodeUuids, count: nodeUuids.length },
                    `Found ${nodeUuids.length} nodes using asset`
                ));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }
}
