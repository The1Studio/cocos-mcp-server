"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageSceneQuery = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const mutation_queue_1 = require("./mutation-queue");
class ManageSceneQuery extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_scene_query';
        this.description = 'Scene introspection and scripting queries. Actions: execute_script, snapshot, snapshot_abort, soft_reload, query_ready, query_dirty, query_classes, query_components, query_has_script, query_by_asset. For node search use manage_node action=find instead.';
        this.actions = [
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
        this.inputSchema = {
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
        this.actionHandlers = {
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
    }
    async executeScript(name, method, args = []) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'execute-scene-script', { name, method, args }).then((result) => {
                resolve((0, types_1.successResult)(result));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async snapshot() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'snapshot').then(() => {
                resolve((0, types_1.successResult)(null, 'Scene snapshot created'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async snapshotAbort() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'snapshot-abort').then(() => {
                resolve((0, types_1.successResult)(null, 'Scene snapshot aborted'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    /**
     * `scene:soft-reload` resets the open scene's in-memory runtime state; it does NOT re-read
     * the `.scene` file (#65 — callers expected a disk re-read and got the cached copy back,
     * then overwrote their own out-of-band edit on the next save). It is reported as exactly
     * that, and a scene that is not ready afterward is a failure. To pick up edits made to
     * the file on disk, use `manage_scene action=open` (it reimports the asset first).
     */
    async softReload() {
        try {
            await Editor.Message.request('scene', 'soft-reload');
            const ready = await Editor.Message.request('scene', 'query-is-ready').catch(() => undefined);
            if (ready === false) {
                return (0, types_1.errorResult)('soft-reload resolved but the scene is not ready afterward — it did not finish reloading.');
            }
            return (0, types_1.successResult)({ rereadFromDisk: false }, 'Scene soft reloaded (in-memory only; the .scene file was NOT re-read — use manage_scene action=open to load out-of-band disk edits)');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async queryReady() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-is-ready').then((ready) => {
                resolve((0, types_1.successResult)({ ready }, ready ? 'Scene is ready' : 'Scene is not ready'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    /**
     * `scene:query-dirty` only describes edits the editor has already committed. Mutating
     * tool calls the client issued but that are still queued behind this query have not
     * reached the editor yet, so proxying the raw flag reported `dirty: false` — "clean" —
     * for a scene that was about to change, and a caller trusting it skipped the save it
     * actually needed (#6). Reconcile the flag against the serialization queue and report
     * both readings so a caller can see *why* the scene is dirty.
     */
    async queryDirty() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-dirty').then((editorDirty) => {
                const pendingMutations = (0, mutation_queue_1.pendingMutationCount)();
                const dirty = editorDirty === true || pendingMutations > 0;
                const message = !dirty
                    ? 'Scene is clean'
                    : pendingMutations > 0
                        ? `Scene has ${pendingMutations} tool call(s) still queued — treat as dirty`
                        : 'Scene has unsaved changes';
                resolve((0, types_1.successResult)({ dirty, editorDirty: editorDirty === true, pendingMutations }, message));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryClasses(extendsClass) {
        return new Promise((resolve) => {
            const options = {};
            if (extendsClass)
                options.extends = extendsClass;
            Editor.Message.request('scene', 'query-classes', options).then((classes) => {
                resolve((0, types_1.successResult)({ classes, count: classes.length, extendsFilter: extendsClass }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryComponents() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-components').then((components) => {
                resolve((0, types_1.successResult)({ components, count: components.length }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryHasScript(className) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-component-has-script', className).then((hasScript) => {
                resolve((0, types_1.successResult)({ className, hasScript }, hasScript ? `Component '${className}' has script` : `Component '${className}' does not have script`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryByAsset(assetUuid) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-nodes-by-asset-uuid', assetUuid).then((nodeUuids) => {
                resolve((0, types_1.successResult)({ assetUuid, nodeUuids, count: nodeUuids.length }, `Found ${nodeUuids.length} nodes using asset`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
}
exports.ManageSceneQuery = ManageSceneQuery;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjZW5lLXF1ZXJ5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1zY2VuZS1xdWVyeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLHFEQUF3RDtBQUV4RCxNQUFhLGdCQUFpQixTQUFRLGlDQUFjO0lBQXBEOztRQUNhLFNBQUksR0FBRyxvQkFBb0IsQ0FBQztRQUM1QixnQkFBVyxHQUFHLDhQQUE4UCxDQUFDO1FBQzdRLFlBQU8sR0FBRztZQUNmLGdCQUFnQjtZQUNoQixVQUFVO1lBQ1YsZ0JBQWdCO1lBQ2hCLGFBQWE7WUFDYixhQUFhO1lBQ2IsYUFBYTtZQUNiLGVBQWU7WUFDZixrQkFBa0I7WUFDbEIsa0JBQWtCO1lBQ2xCLGdCQUFnQjtTQUNuQixDQUFDO1FBQ08sZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNsQixXQUFXLEVBQUUsc0JBQXNCO2lCQUN0QztnQkFDRCxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSw4QkFBOEIsRUFBRTtnQkFDckUsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsOEJBQThCLEVBQUU7Z0JBQ3ZFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLG1DQUFtQyxFQUFFLE9BQU8sRUFBRSxFQUFFLEVBQUU7Z0JBQ3RGLE9BQU8sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLG1EQUFtRCxFQUFFO2dCQUM3RixTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSwrQ0FBK0MsRUFB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S0FBSyxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsRUFDakQsU0FBUyxTQUFTLENBQUMsTUFBTSxvQkFBb0IsQ0FDaEQsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQXJMRCw0Q0FxTEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHBlbmRpbmdNdXRhdGlvbkNvdW50IH0gZnJvbSAnLi9tdXRhdGlvbi1xdWV1ZSc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VTY2VuZVF1ZXJ5IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NjZW5lX3F1ZXJ5JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdTY2VuZSBpbnRyb3NwZWN0aW9uIGFuZCBzY3JpcHRpbmcgcXVlcmllcy4gQWN0aW9uczogZXhlY3V0ZV9zY3JpcHQsIHNuYXBzaG90LCBzbmFwc2hvdF9hYm9ydCwgc29mdF9yZWxvYWQsIHF1ZXJ5X3JlYWR5LCBxdWVyeV9kaXJ0eSwgcXVlcnlfY2xhc3NlcywgcXVlcnlfY29tcG9uZW50cywgcXVlcnlfaGFzX3NjcmlwdCwgcXVlcnlfYnlfYXNzZXQuIEZvciBub2RlIHNlYXJjaCB1c2UgbWFuYWdlX25vZGUgYWN0aW9uPWZpbmQgaW5zdGVhZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdleGVjdXRlX3NjcmlwdCcsXG4gICAgICAgICdzbmFwc2hvdCcsXG4gICAgICAgICdzbmFwc2hvdF9hYm9ydCcsXG4gICAgICAgICdzb2Z0X3JlbG9hZCcsXG4gICAgICAgICdxdWVyeV9yZWFkeScsXG4gICAgICAgICdxdWVyeV9kaXJ0eScsXG4gICAgICAgICdxdWVyeV9jbGFzc2VzJyxcbiAgICAgICAgJ3F1ZXJ5X2NvbXBvbmVudHMnLFxuICAgICAgICAncXVlcnlfaGFzX3NjcmlwdCcsXG4gICAgICAgICdxdWVyeV9ieV9hc3NldCcsXG4gICAgXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ09wZXJhdGlvbiB0byBwZXJmb3JtJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUGx1Z2luIG5hbWUgKGV4ZWN1dGVfc2NyaXB0KScgfSxcbiAgICAgICAgICAgIG1ldGhvZDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdNZXRob2QgbmFtZSAoZXhlY3V0ZV9zY3JpcHQpJyB9LFxuICAgICAgICAgICAgYXJnczogeyB0eXBlOiAnYXJyYXknLCBkZXNjcmlwdGlvbjogJ01ldGhvZCBhcmd1bWVudHMgKGV4ZWN1dGVfc2NyaXB0KScsIGRlZmF1bHQ6IFtdIH0sXG4gICAgICAgICAgICBleHRlbmRzOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZpbHRlciBjbGFzc2VzIGJ5IGJhc2UgY2xhc3MgbmFtZSAocXVlcnlfY2xhc3NlcyknIH0sXG4gICAgICAgICAgICBjbGFzc05hbWU6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnU2NyaXB0IGNsYXNzIG5hbWUgdG8gY2hlY2sgKHF1ZXJ5X2hhc19zY3JpcHQpJyB9LFxuICAgICAgICAgICAgYXNzZXRVdWlkOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0Fzc2V0IFVVSUQgdG8gZmluZCBub2RlcyBmb3IgKHF1ZXJ5X2J5X2Fzc2V0KScgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZXhlY3V0ZV9zY3JpcHQ6IChhcmdzKSA9PiB0aGlzLmV4ZWN1dGVTY3JpcHQoYXJncy5uYW1lLCBhcmdzLm1ldGhvZCwgYXJncy5hcmdzKSxcbiAgICAgICAgc25hcHNob3Q6ICgpID0+IHRoaXMuc25hcHNob3QoKSxcbiAgICAgICAgc25hcHNob3RfYWJvcnQ6ICgpID0+IHRoaXMuc25hcHNob3RBYm9ydCgpLFxuICAgICAgICBzb2Z0X3JlbG9hZDogKCkgPT4gdGhpcy5zb2Z0UmVsb2FkKCksXG4gICAgICAgIHF1ZXJ5X3JlYWR5OiAoKSA9PiB0aGlzLnF1ZXJ5UmVhZHkoKSxcbiAgICAgICAgcXVlcnlfZGlydHk6ICgpID0+IHRoaXMucXVlcnlEaXJ0eSgpLFxuICAgICAgICBxdWVyeV9jbGFzc2VzOiAoYXJncykgPT4gdGhpcy5xdWVyeUNsYXNzZXMoYXJncy5leHRlbmRzKSxcbiAgICAgICAgcXVlcnlfY29tcG9uZW50czogKCkgPT4gdGhpcy5xdWVyeUNvbXBvbmVudHMoKSxcbiAgICAgICAgcXVlcnlfaGFzX3NjcmlwdDogKGFyZ3MpID0+IHRoaXMucXVlcnlIYXNTY3JpcHQoYXJncy5jbGFzc05hbWUpLFxuICAgICAgICBxdWVyeV9ieV9hc3NldDogKGFyZ3MpID0+IHRoaXMucXVlcnlCeUFzc2V0KGFyZ3MuYXNzZXRVdWlkKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlU2NyaXB0KG5hbWU6IHN0cmluZywgbWV0aG9kOiBzdHJpbmcsIGFyZ3M6IGFueVtdID0gW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHsgbmFtZSwgbWV0aG9kLCBhcmdzIH0pLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHJlc3VsdCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzbmFwc2hvdCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCAnU2NlbmUgc25hcHNob3QgY3JlYXRlZCcpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc25hcHNob3RBYm9ydCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdC1hYm9ydCcpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCAnU2NlbmUgc25hcHNob3QgYWJvcnRlZCcpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBzY2VuZTpzb2Z0LXJlbG9hZGAgcmVzZXRzIHRoZSBvcGVuIHNjZW5lJ3MgaW4tbWVtb3J5IHJ1bnRpbWUgc3RhdGU7IGl0IGRvZXMgTk9UIHJlLXJlYWRcbiAgICAgKiB0aGUgYC5zY2VuZWAgZmlsZSAoIzY1IOKAlCBjYWxsZXJzIGV4cGVjdGVkIGEgZGlzayByZS1yZWFkIGFuZCBnb3QgdGhlIGNhY2hlZCBjb3B5IGJhY2ssXG4gICAgICogdGhlbiBvdmVyd3JvdGUgdGhlaXIgb3duIG91dC1vZi1iYW5kIGVkaXQgb24gdGhlIG5leHQgc2F2ZSkuIEl0IGlzIHJlcG9ydGVkIGFzIGV4YWN0bHlcbiAgICAgKiB0aGF0LCBhbmQgYSBzY2VuZSB0aGF0IGlzIG5vdCByZWFkeSBhZnRlcndhcmQgaXMgYSBmYWlsdXJlLiBUbyBwaWNrIHVwIGVkaXRzIG1hZGUgdG9cbiAgICAgKiB0aGUgZmlsZSBvbiBkaXNrLCB1c2UgYG1hbmFnZV9zY2VuZSBhY3Rpb249b3BlbmAgKGl0IHJlaW1wb3J0cyB0aGUgYXNzZXQgZmlyc3QpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc29mdFJlbG9hZCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NvZnQtcmVsb2FkJyk7XG4gICAgICAgICAgICBjb25zdCByZWFkeSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWlzLXJlYWR5JykuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKTtcbiAgICAgICAgICAgIGlmIChyZWFkeSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NvZnQtcmVsb2FkIHJlc29sdmVkIGJ1dCB0aGUgc2NlbmUgaXMgbm90IHJlYWR5IGFmdGVyd2FyZCDigJQgaXQgZGlkIG5vdCBmaW5pc2ggcmVsb2FkaW5nLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgeyByZXJlYWRGcm9tRGlzazogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAnU2NlbmUgc29mdCByZWxvYWRlZCAoaW4tbWVtb3J5IG9ubHk7IHRoZSAuc2NlbmUgZmlsZSB3YXMgTk9UIHJlLXJlYWQg4oCUIHVzZSBtYW5hZ2Vfc2NlbmUgYWN0aW9uPW9wZW4gdG8gbG9hZCBvdXQtb2YtYmFuZCBkaXNrIGVkaXRzKSdcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeVJlYWR5KCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWlzLXJlYWR5JykudGhlbigocmVhZHk6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyByZWFkeSB9LCByZWFkeSA/ICdTY2VuZSBpcyByZWFkeScgOiAnU2NlbmUgaXMgbm90IHJlYWR5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYHNjZW5lOnF1ZXJ5LWRpcnR5YCBvbmx5IGRlc2NyaWJlcyBlZGl0cyB0aGUgZWRpdG9yIGhhcyBhbHJlYWR5IGNvbW1pdHRlZC4gTXV0YXRpbmdcbiAgICAgKiB0b29sIGNhbGxzIHRoZSBjbGllbnQgaXNzdWVkIGJ1dCB0aGF0IGFyZSBzdGlsbCBxdWV1ZWQgYmVoaW5kIHRoaXMgcXVlcnkgaGF2ZSBub3RcbiAgICAgKiByZWFjaGVkIHRoZSBlZGl0b3IgeWV0LCBzbyBwcm94eWluZyB0aGUgcmF3IGZsYWcgcmVwb3J0ZWQgYGRpcnR5OiBmYWxzZWAg4oCUIFwiY2xlYW5cIiDigJRcbiAgICAgKiBmb3IgYSBzY2VuZSB0aGF0IHdhcyBhYm91dCB0byBjaGFuZ2UsIGFuZCBhIGNhbGxlciB0cnVzdGluZyBpdCBza2lwcGVkIHRoZSBzYXZlIGl0XG4gICAgICogYWN0dWFsbHkgbmVlZGVkICgjNikuIFJlY29uY2lsZSB0aGUgZmxhZyBhZ2FpbnN0IHRoZSBzZXJpYWxpemF0aW9uIHF1ZXVlIGFuZCByZXBvcnRcbiAgICAgKiBib3RoIHJlYWRpbmdzIHNvIGEgY2FsbGVyIGNhbiBzZWUgKndoeSogdGhlIHNjZW5lIGlzIGRpcnR5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlEaXJ0eSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1kaXJ0eScpLnRoZW4oKGVkaXRvckRpcnR5OiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGVuZGluZ011dGF0aW9ucyA9IHBlbmRpbmdNdXRhdGlvbkNvdW50KCk7XG4gICAgICAgICAgICAgICAgY29uc3QgZGlydHkgPSBlZGl0b3JEaXJ0eSA9PT0gdHJ1ZSB8fCBwZW5kaW5nTXV0YXRpb25zID4gMDtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gIWRpcnR5XG4gICAgICAgICAgICAgICAgICAgID8gJ1NjZW5lIGlzIGNsZWFuJ1xuICAgICAgICAgICAgICAgICAgICA6IHBlbmRpbmdNdXRhdGlvbnMgPiAwXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGBTY2VuZSBoYXMgJHtwZW5kaW5nTXV0YXRpb25zfSB0b29sIGNhbGwocykgc3RpbGwgcXVldWVkIOKAlCB0cmVhdCBhcyBkaXJ0eWBcbiAgICAgICAgICAgICAgICAgICAgICAgIDogJ1NjZW5lIGhhcyB1bnNhdmVkIGNoYW5nZXMnO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IGRpcnR5LCBlZGl0b3JEaXJ0eTogZWRpdG9yRGlydHkgPT09IHRydWUsIHBlbmRpbmdNdXRhdGlvbnMgfSwgbWVzc2FnZSkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUNsYXNzZXMoZXh0ZW5kc0NsYXNzPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgb3B0aW9uczogYW55ID0ge307XG4gICAgICAgICAgICBpZiAoZXh0ZW5kc0NsYXNzKSBvcHRpb25zLmV4dGVuZHMgPSBleHRlbmRzQ2xhc3M7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jbGFzc2VzJywgb3B0aW9ucykudGhlbigoY2xhc3NlczogYW55W10pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyBjbGFzc2VzLCBjb3VudDogY2xhc3Nlcy5sZW5ndGgsIGV4dGVuZHNGaWx0ZXI6IGV4dGVuZHNDbGFzcyB9KSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5Q29tcG9uZW50cygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1jb21wb25lbnRzJykudGhlbigoY29tcG9uZW50czogYW55W10pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyBjb21wb25lbnRzLCBjb3VudDogY29tcG9uZW50cy5sZW5ndGggfSkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeUhhc1NjcmlwdChjbGFzc05hbWU6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWNvbXBvbmVudC1oYXMtc2NyaXB0JywgY2xhc3NOYW1lKS50aGVuKChoYXNTY3JpcHQ6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgY2xhc3NOYW1lLCBoYXNTY3JpcHQgfSxcbiAgICAgICAgICAgICAgICAgICAgaGFzU2NyaXB0ID8gYENvbXBvbmVudCAnJHtjbGFzc05hbWV9JyBoYXMgc2NyaXB0YCA6IGBDb21wb25lbnQgJyR7Y2xhc3NOYW1lfScgZG9lcyBub3QgaGF2ZSBzY3JpcHRgXG4gICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5QnlBc3NldChhc3NldFV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGVzLWJ5LWFzc2V0LXV1aWQnLCBhc3NldFV1aWQpLnRoZW4oKG5vZGVVdWlkczogc3RyaW5nW10pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgYXNzZXRVdWlkLCBub2RlVXVpZHMsIGNvdW50OiBub2RlVXVpZHMubGVuZ3RoIH0sXG4gICAgICAgICAgICAgICAgICAgIGBGb3VuZCAke25vZGVVdWlkcy5sZW5ndGh9IG5vZGVzIHVzaW5nIGFzc2V0YFxuICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxufVxuIl19