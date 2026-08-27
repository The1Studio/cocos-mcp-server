import * as fs from 'fs';
import { ActionToolResult, successResult, errorResult, PrefabInfo } from '../types';
import { BaseActionTool } from './base-action-tool';
import { normalizeVec3 } from '../utils/normalize';
import { resolveAsset } from '../utils/asset-path';
import { PrefabCreationService } from './manage-prefab-creation-service';

export class ManagePrefab extends BaseActionTool {
    private readonly creationService = new PrefabCreationService();

    readonly name = 'manage_prefab';
    readonly description = 'Manage prefabs in the project. Actions: list=list all prefabs, load=load prefab by path, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to the prefab asset (verifies the asset was written, and removes children deleted from the instance that apply-prefab leaves behind), revert=revert prefab instance to the asset state (alias of restore), get_info=get prefab details, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using asset (with undo). For update/revert/restore, nodeUuid may be any node in the instance — the instance root is resolved automatically. Prerequisites: project must be open in Cocos Creator.';
    readonly actions = ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'],
                description: 'Action to perform: list=list all prefabs in project, load=load prefab by uuid, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to existing prefab, revert=revert prefab instance to the asset state (alias of restore), get_info=get detailed prefab info, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using prefab asset (built-in undo)'
            },
            uuid: {
                type: 'string',
                description: 'Prefab asset UUID (for load, get_info, validate, duplicate, restore_node actions)'
            },
            prefabUuid: {
                type: 'string',
                description: 'Prefab asset UUID (for instantiate action)'
            },
            nodeUuid: {
                type: 'string',
                description: 'Scene node UUID (for create, update, revert, restore actions). For update/revert/restore this may be any node inside the prefab instance; the instance root is resolved from it.'
            },
            savePath: {
                type: 'string',
                description: 'Asset DB path to save prefab (for create action, e.g. db://assets/prefabs/MyPrefab.prefab)'
            },
            parentUuid: {
                type: 'string',
                description: 'Parent node UUID for the instantiated prefab (for instantiate action, optional)'
            },
            position: {
                type: 'object',
                description: 'Initial position {x, y, z} for instantiated prefab (optional)',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' }
                }
            },
            rotation: {
                type: 'object',
                description: 'Initial rotation {x, y, z} for instantiated prefab (optional)',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' }
                }
            },
            scale: {
                type: 'object',
                description: 'Initial scale {x, y, z} for instantiated prefab (optional)',
                properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    z: { type: 'number' }
                }
            },
            folder: {
                type: 'string',
                description: 'Folder to search prefabs in (for list action, default: db://assets)',
                default: 'db://assets'
            },
            newName: {
                type: 'string',
                description: 'New prefab name (for duplicate action, optional)'
            },
            targetDir: {
                type: 'string',
                description: 'Target directory for duplicated prefab (for duplicate action, optional)'
            },
            assetUuid: {
                type: 'string',
                description: 'Prefab asset UUID to restore from (for revert and restore actions, optional — resolved from the node when omitted)'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        list: (args) => this.handleList(args),
        load: (args) => this.handleLoad(args),
        instantiate: (args) => this.handleInstantiate(args),
        create: (args) => this.handleCreate(args),
        update: (args) => this.handleUpdate(args),
        revert: (args) => this.handleRevert(args),
        get_info: (args) => this.handleGetInfo(args),
        validate: (args) => this.handleValidate(args),
        duplicate: (args) => this.handleDuplicate(args),
        restore: (args) => this.handleRestoreNode(args),
    };

    private async handleList(args: Record<string, any>): Promise<ActionToolResult> {
        const result = await this.getPrefabList(args.folder);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to list prefabs');
    }

    private async handleLoad(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.loadPrefabByUuid(uuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to load prefab');
    }

    private async handleInstantiate(args: Record<string, any>): Promise<ActionToolResult> {
        const { prefabUuid, parentUuid } = args;
        if (!prefabUuid) return errorResult('prefabUuid is required');
        const position = normalizeVec3(args.position);
        const rotation = normalizeVec3(args.rotation);
        const scale = normalizeVec3(args.scale);
        const result = await this.instantiatePrefabByUuid({ prefabUuid, parentUuid, position, rotation, scale });
        if (result.success) return successResult(result.data, result.message);
        const failure = errorResult(result.error || 'Failed to instantiate prefab');
        if (result.instruction) failure.instruction = result.instruction;
        return failure;
    }

    private async handleCreate(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid, savePath } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        if (!savePath) return errorResult('savePath is required');
        const prefabName = savePath.split('/').pop()?.replace('.prefab', '') || 'NewPrefab';
        const result = await this.createPrefab({ nodeUuid, savePath, prefabName });
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to create prefab');
    }

    private async handleUpdate(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        const result = await this.updatePrefab(nodeUuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to update prefab');
    }

    private async handleRevert(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid, assetUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        // `revert` and `restore` are the same editor operation — see restorePrefabNode.
        const result = await this.restorePrefabNode(nodeUuid, assetUuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to revert prefab');
    }

    private async handleGetInfo(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.getPrefabInfoByUuid(uuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to get prefab info');
    }

    private async handleValidate(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.validatePrefabByUuid(uuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to validate prefab');
    }

    private async handleDuplicate(args: Record<string, any>): Promise<ActionToolResult> {
        const { uuid, newName, targetDir } = args;
        if (!uuid) return errorResult('uuid is required');
        const result = await this.duplicatePrefabByUuid({ uuid, newName, targetDir });
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to duplicate prefab');
    }

    private async handleRestoreNode(args: Record<string, any>): Promise<ActionToolResult> {
        const { nodeUuid, assetUuid } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required');
        const result = await this.restorePrefabNode(nodeUuid, assetUuid);
        if (result.success) return successResult(result.data, result.message);
        return errorResult(result.error || 'Failed to restore prefab node');
    }

    // ============================================================
    // Private implementation methods (ported from PrefabTools)
    // ============================================================

    private async getPrefabList(folder: string = 'db://assets'): Promise<any> {
        try {
            const pattern = folder.endsWith('/') ? `${folder}**/*.prefab` : `${folder}/**/*.prefab`;
            const results: any[] = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            const prefabs: PrefabInfo[] = results.map(asset => ({
                name: asset.name, path: asset.url, uuid: asset.uuid,
                folder: asset.url.substring(0, asset.url.lastIndexOf('/'))
            }));
            return { success: true, data: prefabs };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async loadPrefabByUuid(uuid: string): Promise<any> {
        try {
            const prefabData: any = await Editor.Message.request('scene', 'load-asset', { uuid });
            return { success: true, data: { uuid: prefabData.uuid, name: prefabData.name, message: 'Prefab loaded successfully' } };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    private async instantiatePrefabByUuid(args: { prefabUuid: string; parentUuid?: string; position?: any; rotation?: any; scale?: any }): Promise<any> {
        try {
            const { prefabUuid, parentUuid, position, rotation, scale } = args;

            // An unresolvable uuid must be fatal: create-node silently returns nothing for it,
            // which previously produced a success envelope with no nodeUuid (#15).
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', prefabUuid).catch(() => null);
            if (!assetInfo) {
                return {
                    success: false,
                    error: `Prefab uuid '${prefabUuid}' not found in the asset DB`,
                    instruction: 'Verify the uuid, and refresh the asset DB (manage_asset action=refresh) if the .prefab file was written outside the editor.'
                };
            }

            const createNodeOptions: any = {
                assetUuid: prefabUuid,
                // `type` selects the createNodeFromAsset() branch that instantiates a
                // linked PrefabInstance. Without it, 3.8.7's node manager falls back to
                // building a plain node from the asset's raw dump — a flattened,
                // unlinked copy that reports success but carries no cc.PrefabInfo (see
                // NodeManager.createNodeFromAsset jsdoc: "options.type: 资源类型").
                type: assetInfo.type
            };

            if (parentUuid) {
                createNodeOptions.parent = parentUuid;
            }

            if (assetInfo && assetInfo.name) {
                createNodeOptions.name = assetInfo.name;
            }

            if (position) {
                // `position` is a documented top-level CreateNodeOptions field; `dump`
                // is explicitly commented out as unused in @cocos/creator-types — it was
                // silently ignored, so instantiated prefabs never picked up this position.
                createNodeOptions.position = position;
            }

            const nodeUuid = await Editor.Message.request('scene', 'create-node', createNodeOptions);
            const uuid = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;

            // Never report success without a node id — the caller would build on a scene
            // that silently lacks the node (#15).
            if (!uuid) {
                return {
                    success: false,
                    error: `create-node returned no node uuid for prefab '${prefabUuid}' — nothing was instantiated`,
                    instruction: 'Ensure a scene is open and the prefab asset is valid, then retry.'
                };
            }

            // Apply rotation and scale if provided
            if (rotation) {
                await Editor.Message.request('scene', 'set-property', {
                    uuid,
                    path: 'eulerAngles',
                    dump: { value: rotation, type: 'cc.Vec3' }
                }).catch(() => {/* non-fatal */});
            }
            if (scale) {
                await Editor.Message.request('scene', 'set-property', {
                    uuid,
                    path: 'scale',
                    dump: { value: scale, type: 'cc.Vec3' }
                }).catch(() => {/* non-fatal */});
            }

            return {
                success: true,
                data: {
                    nodeUuid: uuid,
                    prefabUuid,
                    parentUuid,
                    position,
                    rotation,
                    scale,
                    message: 'Prefab instantiated successfully'
                }
            };
        } catch (err: any) {
            return {
                success: false,
                error: `Failed to instantiate prefab: ${err.message}`,
                instruction: 'Check that the prefabUuid is correct and the asset DB is ready.'
            };
        }
    }

    private async createPrefab(args: any): Promise<any> {
        try {
            const pathParam = args.prefabPath || args.savePath;
            if (!pathParam) {
                return { success: false, error: 'Missing prefab path parameter. Provide savePath.' };
            }

            const prefabName = args.prefabName || 'NewPrefab';
            const fullPath = pathParam.endsWith('.prefab') ?
                pathParam : `${pathParam}/${prefabName}.prefab`;

            const includeChildren = args.includeChildren !== false;
            const includeComponents = args.includeComponents !== false;

            const assetDbResult = await this.creationService.createPrefabWithAssetDB(
                args.nodeUuid, fullPath, prefabName, includeChildren, includeComponents
            );
            if (assetDbResult.success) return assetDbResult;
            // A defective write is a result, not an unavailable path — retrying through
            // the fallback chain would re-serialize the same loss and mask it (#28).
            if (assetDbResult.fatal) return assetDbResult;

            const nativeResult = this.creationService.createPrefabNativeStub();
            if (nativeResult.success) return nativeResult;

            return await this.creationService.createPrefabCustom(args.nodeUuid, fullPath, prefabName);
        } catch (error) {
            return { success: false, error: `Error creating prefab: ${error}` };
        }
    }

    /**
     * Resolve the prefab-instance context for a node.
     *
     * Cocos Creator drives both prefab messages from the node dump's `__prefab__`
     * block — `rootUuid` (the prefab-instance ROOT, not whichever descendant the
     * caller happened to pass) and `uuid` (the backing prefab asset). See 3.8.7
     * `resources/3d/engine/editor/inspector/contributions/node.js`:
     *   request('scene', 'apply-prefab', prefab.rootUuid)
     *   request('scene', 'restore-prefab', prefab.rootUuid, prefab.uuid)
     */
    private async resolvePrefabContext(nodeUuid: string): Promise<any> {
        let nodeData: any;
        try {
            nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
        } catch (err: any) {
            return { success: false, error: `Failed to query node ${nodeUuid}: ${err.message}` };
        }
        if (!nodeData) return { success: false, error: 'Node not found' };

        const prefab = nodeData.__prefab__;
        if (!prefab) {
            return { success: false, error: `Node ${nodeUuid} is not part of a prefab instance` };
        }
        return {
            success: true,
            rootUuid: prefab.rootUuid || nodeUuid,
            assetUuid: prefab.uuid || prefab.prefabStateInfo?.assetUuid
        };
    }

    /**
     * Resolve a prefab asset's on-disk path, or null when it cannot be determined.
     *
     * Goes through `query-asset-info`, not `query-asset-meta`: the meta record has no
     * `url` field, so the old lookup resolved to null for every asset and left the
     * post-apply write check permanently `unverified` (#25).
     */
    private async resolvePrefabFilePath(assetUuid?: string): Promise<string | null> {
        if (!assetUuid) return null;
        return (await resolveAsset(assetUuid)).filePath;
    }

    private statMtimeMs(filePath: string | null): number | null {
        if (!filePath) return null;
        try {
            return fs.statSync(filePath).mtimeMs;
        } catch {
            return null;
        }
    }

    /** Poll for the prefab file to be rewritten; asset-db may flush shortly after the message resolves. */
    private async waitForPrefabWrite(filePath: string, baselineMs: number, timeoutMs = 2000): Promise<number | null> {
        const deadline = Date.now() + timeoutMs;
        let mtime = this.statMtimeMs(filePath);
        while (mtime !== null && mtime <= baselineMs && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
            mtime = this.statMtimeMs(filePath);
        }
        return mtime;
    }

    private async updatePrefab(nodeUuid: string): Promise<any> {
        try {
            const context = await this.resolvePrefabContext(nodeUuid);
            if (!context.success) return context;
            const { rootUuid, assetUuid } = context;

            const prefabPath = await this.resolvePrefabFilePath(assetUuid);
            const mtimeBefore = this.statMtimeMs(prefabPath);

            // `scene:apply-prefab` takes the instance root uuid as a POSITIONAL string
            // and resolves to a boolean. The old `{ node: uuid }` object form resolved
            // without throwing but never wrote the asset — a silent no-op reported as
            // success (#12).
            const applied = await (Editor.Message.request as any)('scene', 'apply-prefab', rootUuid);
            if (applied === false) {
                return {
                    success: false,
                    error: `Editor rejected apply-prefab for node ${rootUuid}. Confirm it is a prefab-instance root with a valid asset link.`,
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath }
                };
            }

            // Verify the asset was actually written rather than trusting a non-throwing
            // message. `unverified` means the path could not be resolved, not that the
            // write failed.
            let persisted: boolean | 'unverified' = 'unverified';
            if (prefabPath !== null && mtimeBefore !== null) {
                const mtimeAfter = await this.waitForPrefabWrite(prefabPath, mtimeBefore);
                if (mtimeAfter !== null) persisted = mtimeAfter > mtimeBefore;
            }

            if (persisted === false) {
                return {
                    success: false,
                    error: `apply-prefab reported no error but ${prefabPath} was not rewritten. The node may have no overrides to apply, or its prefab link is stale.`,
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted }
                };
            }

            // `apply-prefab` writes property overrides but does not remove a child node
            // deleted from the instance (#21) — the mtime guard above cannot see this,
            // because a deletion still produces overrides elsewhere, so the file IS
            // rewritten and `persisted` is genuinely `true`. Compare the live instance's
            // fileIds against the freshly-written asset's to catch the specific failure
            // mode the mtime check cannot: a child still present on disk that no longer
            // exists in the scene. Anything found is then removed from the asset, since
            // reporting the stale children is not the same as honouring the deletion.
            let orphanedFileIds: string[] = [];
            if (persisted === true && prefabPath) {
                orphanedFileIds = await this.findOrphanedChildFileIds(rootUuid, prefabPath);
            }
            let removedFileIds: string[] = [];
            if (orphanedFileIds.length > 0) {
                const removal = await this.removeOrphanedChildrenFromAsset(
                    prefabPath as string, orphanedFileIds, rootUuid, assetUuid
                );
                if (!removal.success) {
                    return {
                        success: false,
                        error: `apply-prefab wrote ${prefabPath}, but it still contains ${orphanedFileIds.length} child node(s) (fileId: ${orphanedFileIds.join(', ')}) that no longer exist in the scene instance. Cocos Creator 3.8.7's apply-prefab does not remove deleted children, and removing them here was declined: ${removal.error}. The asset is byte-for-byte unchanged — delete and recreate the prefab, or remove the stale entries manually.`,
                        data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, orphanedFileIds }
                    };
                }
                removedFileIds = orphanedFileIds;
            }

            return {
                success: true,
                message: removedFileIds.length > 0
                    ? `Prefab updated successfully; removed ${removedFileIds.length} child node(s) apply-prefab left behind`
                    : 'Prefab updated successfully',
                data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, removedFileIds }
            };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Return the fileIds of prefab-tracked nodes present in the written asset but absent
     * from the live scene instance — children `apply-prefab` failed to remove (#21).
     * Detection is best-effort: any failure returns no orphans rather than a false
     * positive, since this check must never mask a genuine success.
     */
    private async findOrphanedChildFileIds(rootUuid: string, prefabPath: string): Promise<string[]> {
        try {
            const liveFileIds = await this.collectInstanceFileIds(rootUuid);
            if (liveFileIds.size === 0) return [];
            const assetData = JSON.parse(fs.readFileSync(prefabPath, 'utf-8'));
            if (!Array.isArray(assetData)) return [];
            const assetFileIds = this.collectAssetNodeFileIds(assetData);
            return [...assetFileIds].filter(id => !liveFileIds.has(id));
        } catch {
            return [];
        }
    }

    /** Walk a live prefab-instance subtree and collect the `__prefab__.fileId` of every node. */
    private async collectInstanceFileIds(rootUuid: string): Promise<Set<string>> {
        const fileIds = new Set<string>();
        const visit = async (uuid: string): Promise<void> => {
            let nodeData: any;
            try {
                nodeData = await Editor.Message.request('scene', 'query-node', uuid);
            } catch {
                return;
            }
            if (!nodeData) return;
            const fileId = nodeData.__prefab__?.fileId;
            if (typeof fileId === 'string' && fileId) fileIds.add(fileId);
            const children: string[] = Array.isArray(nodeData.children) ? nodeData.children : [];
            for (const childUuid of children) await visit(childUuid);
        };
        await visit(rootUuid);
        return fileIds;
    }

    /** Extract every `cc.Node` entry's fileId from a written `.prefab` asset's JSON array. */
    private collectAssetNodeFileIds(prefabData: any[]): Set<string> {
        const fileIds = new Set<string>();
        for (let index = 0; index < prefabData.length; index++) {
            const fileId = this.fileIdOfNode(prefabData, index);
            if (fileId !== null) fileIds.add(fileId);
        }
        return fileIds;
    }

    /** The fileId recorded on the `cc.Node` at `index`, or null when it has none. */
    private fileIdOfNode(prefabData: any[], index: number): string | null {
        const entry = prefabData[index];
        if (!entry || entry.__type__ !== 'cc.Node') return null;
        const prefabInfoIndex = entry._prefab?.__id__;
        if (typeof prefabInfoIndex !== 'number') return null;
        const fileId = prefabData[prefabInfoIndex]?.fileId;
        return typeof fileId === 'string' && fileId ? fileId : null;
    }

    /**
     * Reference arrays whose element order is structural — a removed entry must be spliced
     * out of them, never left behind as a null hole.
     */
    private readonly structuralRefArrays = ['_children', '_components', 'nestedPrefabInstanceRoots', 'targetOverrides'];

    /**
     * Remove the orphaned child subtrees `apply-prefab` left behind, then hand the result
     * to the editor for acceptance (#21).
     *
     * Three gates guard the rewrite, and the pre-surgery bytes are restored at any of them:
     * the graph rewrite refuses a layout it does not recognise, the rewritten graph is
     * validated before it is written, and `asset-db:reimport-asset` is the engine's own
     * verdict on the result — an internally consistent graph can still be one the importer
     * rejects, and only the editor can say so. A declined removal leaves the caller exactly
     * where it stood before this method existed: a hard failure naming the stale fileIds.
     */
    private async removeOrphanedChildrenFromAsset(
        prefabPath: string,
        orphanedFileIds: string[],
        rootUuid: string,
        assetUuid: string
    ): Promise<{ success: boolean; error?: string }> {
        let originalText: string;
        let prefabData: any;
        try {
            originalText = fs.readFileSync(prefabPath, 'utf-8');
            prefabData = JSON.parse(originalText);
        } catch (err: any) {
            return { success: false, error: `the asset could not be re-read (${err.message})` };
        }
        if (!Array.isArray(prefabData)) {
            return { success: false, error: 'the asset is not a serialized entry array' };
        }

        const liveFileIds = await this.collectInstanceFileIds(rootUuid);
        const fileIdsBefore = this.collectAssetNodeFileIds(prefabData);
        const rewritten = this.pruneOrphanedNodes(prefabData, orphanedFileIds, liveFileIds);
        if (!rewritten) {
            return { success: false, error: 'the asset graph does not match the layout this removal understands' };
        }

        const invalid = this.validatePrefabGraph(rewritten, orphanedFileIds, fileIdsBefore);
        if (invalid) {
            return { success: false, error: `the rewritten graph failed validation (${invalid})` };
        }

        try {
            fs.writeFileSync(prefabPath, JSON.stringify(rewritten, null, originalText.includes('\n') ? 2 : 0), 'utf-8');
        } catch (err: any) {
            return { success: false, error: `the rewritten asset could not be written (${err.message})` };
        }

        let imported: boolean;
        try {
            imported = (await Editor.Message.request('asset-db', 'reimport-asset', assetUuid)) !== false;
        } catch {
            imported = false;
        }
        if (!imported) {
            this.restorePrefabFile(prefabPath, originalText);
            return { success: false, error: 'the editor rejected the rewritten asset on reimport' };
        }

        const survivors = await this.findOrphanedChildFileIds(rootUuid, prefabPath);
        if (survivors.length > 0) {
            this.restorePrefabFile(prefabPath, originalText);
            return { success: false, error: `removal ran but fileId(s) ${survivors.join(', ')} are still orphaned` };
        }

        return { success: true };
    }

    /** Put the pre-surgery bytes back, so a declined removal leaves the asset untouched. */
    private restorePrefabFile(prefabPath: string, originalText: string): void {
        try {
            fs.writeFileSync(prefabPath, originalText, 'utf-8');
        } catch {
            // Nothing further to do here — the caller reports the failure either way.
        }
    }

    /**
     * Drop every orphaned child subtree from a serialized prefab array and re-index the whole
     * graph. Returns null — changing nothing — whenever the graph does not match what this
     * rewrite relies on, rather than producing an asset nobody can load.
     */
    private pruneOrphanedNodes(prefabData: any[], orphanedFileIds: string[], liveFileIds: Set<string>): any[] | null {
        const nodeIndexByFileId = new Map<string, number>();
        for (let index = 0; index < prefabData.length; index++) {
            const fileId = this.fileIdOfNode(prefabData, index);
            if (fileId !== null && !nodeIndexByFileId.has(fileId)) nodeIndexByFileId.set(fileId, index);
        }

        const removed = new Set<number>();
        const pending: number[] = [];
        for (const fileId of orphanedFileIds) {
            const index = nodeIndexByFileId.get(fileId);
            // Detection and removal disagree about the asset — do not guess at the graph.
            if (index === undefined) return null;
            pending.push(index);
        }

        while (pending.length > 0) {
            const nodeIndex = pending.shift() as number;
            if (removed.has(nodeIndex)) continue;
            const node = prefabData[nodeIndex];
            if (!node || node.__type__ !== 'cc.Node') return null;
            removed.add(nodeIndex);

            const prefabInfoIndex = node._prefab?.__id__;
            if (typeof prefabInfoIndex === 'number') removed.add(prefabInfoIndex);

            for (const ref of Array.isArray(node._components) ? node._components : []) {
                const componentIndex = ref?.__id__;
                if (typeof componentIndex !== 'number') continue;
                removed.add(componentIndex);
                const compPrefabIndex = prefabData[componentIndex]?.__prefab?.__id__;
                if (typeof compPrefabIndex === 'number') removed.add(compPrefabIndex);
            }

            for (const ref of Array.isArray(node._children) ? node._children : []) {
                const childIndex = ref?.__id__;
                if (typeof childIndex !== 'number') return null;
                // A descendant of a deleted child cannot still be live in the instance. If one
                // is, the orphan set is not what this rewrite assumes and it must not proceed.
                const childFileId = this.fileIdOfNode(prefabData, childIndex);
                if (childFileId !== null && liveFileIds.has(childFileId)) return null;
                pending.push(childIndex);
            }
        }
        if (removed.size === 0) return null;

        const pruned: any[] = JSON.parse(JSON.stringify(prefabData));
        for (let index = 0; index < pruned.length; index++) {
            if (removed.has(index)) continue;
            const entry = pruned[index];
            if (!entry || typeof entry !== 'object') continue;
            for (const key of this.structuralRefArrays) {
                if (!Array.isArray(entry[key])) continue;
                entry[key] = entry[key].filter((element: any) => !this.referencesRemoved(element, removed));
            }
        }

        // Whatever still points at a removed entry becomes null — this is the dangling
        // component reference the report calls out (an `ObjectView.tickNode` binding to a
        // child that no longer exists).
        for (let index = 0; index < pruned.length; index++) {
            if (removed.has(index)) continue;
            pruned[index] = this.nullifyRemovedRefs(pruned[index], removed);
        }

        const remap = new Map<number, number>();
        const survivors: any[] = [];
        for (let index = 0; index < pruned.length; index++) {
            if (removed.has(index)) continue;
            remap.set(index, survivors.length);
            survivors.push(pruned[index]);
        }
        return survivors.map(entry => this.remapRefs(entry, remap));
    }

    /** True when `value` is — or contains — an `{ __id__ }` reference to a removed entry. */
    private referencesRemoved(value: any, removed: Set<number>): boolean {
        if (!value || typeof value !== 'object') return false;
        if (typeof value.__id__ === 'number') return removed.has(value.__id__);
        return Object.values(value).some(nested => this.referencesRemoved(nested, removed));
    }

    /** Replace every `{ __id__ }` reference to a removed entry with null. */
    private nullifyRemovedRefs(value: any, removed: Set<number>): any {
        if (Array.isArray(value)) return value.map(element => this.nullifyRemovedRefs(element, removed));
        if (!value || typeof value !== 'object') return value;
        if (typeof value.__id__ === 'number') return removed.has(value.__id__) ? null : value;
        const rewritten: any = {};
        for (const [key, nested] of Object.entries(value)) rewritten[key] = this.nullifyRemovedRefs(nested, removed);
        return rewritten;
    }

    /** Point every surviving `__id__` at its entry's slot in the compacted array. */
    private remapRefs(value: any, remap: Map<number, number>): any {
        if (Array.isArray(value)) return value.map(element => this.remapRefs(element, remap));
        if (!value || typeof value !== 'object') return value;
        if (typeof value.__id__ === 'number') {
            const next = remap.get(value.__id__);
            return next === undefined ? null : { __id__: next };
        }
        const rewritten: any = {};
        for (const [key, nested] of Object.entries(value)) rewritten[key] = this.remapRefs(nested, remap);
        return rewritten;
    }

    /**
     * Reject a rewritten graph before it reaches disk. Returns the first problem found, or
     * null when the graph is sound — this is what makes a mis-indexed asset impossible to
     * write rather than something to notice afterwards.
     */
    private validatePrefabGraph(prefabData: any[], removedFileIds: string[], fileIdsBefore: Set<string>): string | null {
        const dangling = this.findDanglingRef(prefabData, prefabData.length);
        if (dangling !== null) return `__id__ ${dangling} is out of range`;

        // Identity, not count: exactly the orphans go, and nothing else does.
        const remaining = this.collectAssetNodeFileIds(prefabData);
        for (const fileId of removedFileIds) {
            if (remaining.has(fileId)) return `orphaned fileId ${fileId} survived removal`;
        }
        for (const fileId of fileIdsBefore) {
            if (removedFileIds.includes(fileId)) continue;
            if (!remaining.has(fileId)) return `fileId ${fileId} was removed but should have been kept`;
        }

        for (let index = 0; index < prefabData.length; index++) {
            const entry = prefabData[index];
            if (!entry || entry.__type__ !== 'cc.Node') continue;
            for (const ref of Array.isArray(entry._children) ? entry._children : []) {
                const childIndex = ref?.__id__;
                if (typeof childIndex !== 'number') return `node ${index} has a malformed _children entry`;
                const child = prefabData[childIndex];
                if (!child || child.__type__ !== 'cc.Node') return `node ${index} lists a non-node child at ${childIndex}`;
                if (child._parent && child._parent.__id__ !== index) {
                    return `node ${childIndex} does not point back at parent ${index}`;
                }
            }
            for (const ref of Array.isArray(entry._components) ? entry._components : []) {
                const componentIndex = ref?.__id__;
                if (typeof componentIndex !== 'number') return `node ${index} has a malformed _components entry`;
                const component = prefabData[componentIndex];
                if (!component) return `node ${index} lists a missing component at ${componentIndex}`;
                if (component.node && component.node.__id__ !== index) {
                    return `component ${componentIndex} does not point back at node ${index}`;
                }
            }
        }
        return null;
    }

    /** The first `__id__` outside `[0, length)` anywhere in the graph, or null when all resolve. */
    private findDanglingRef(value: any, length: number): number | null {
        if (Array.isArray(value)) {
            for (const element of value) {
                const found = this.findDanglingRef(element, length);
                if (found !== null) return found;
            }
            return null;
        }
        if (!value || typeof value !== 'object') return null;
        if (typeof value.__id__ === 'number') {
            const id = value.__id__;
            return Number.isInteger(id) && id >= 0 && id < length ? null : id;
        }
        for (const nested of Object.values(value)) {
            const found = this.findDanglingRef(nested, length);
            if (found !== null) return found;
        }
        return null;
    }

    private async getPrefabInfoByUuid(uuid: string): Promise<any> {
        // `query-asset-meta` carries no `url`/`name`/timestamps — reading them off the
        // meta record produced an all-empty PrefabInfo that still reported success (#25).
        const resolved = await resolveAsset(uuid);
        if (resolved.error) return { success: false, error: resolved.error };
        if (!resolved.info) return { success: false, error: `Prefab not found: ${uuid}` };

        const assetInfo = resolved.info;
        const url: string = assetInfo.url || '';
        const stats = resolved.filePath ? this.statTimes(resolved.filePath) : null;
        const info: PrefabInfo = {
            name: assetInfo.name,
            uuid: assetInfo.uuid || uuid,
            path: url,
            folder: url ? url.substring(0, url.lastIndexOf('/')) : '',
            createTime: stats?.createTime,
            modifyTime: stats?.modifyTime
        };
        return { success: true, data: { ...info, file: resolved.filePath } };
    }

    private statTimes(filePath: string): { createTime: string; modifyTime: string } | null {
        try {
            const s = fs.statSync(filePath);
            return { createTime: s.birthtime.toISOString(), modifyTime: s.mtime.toISOString() };
        } catch {
            return null;
        }
    }

    private async validatePrefabByUuid(uuid: string): Promise<any> {
        // Each stage reports itself. The old single outer catch collapsed every failure
        // into `Error validating prefab: Error: parameter error`, which hid that the
        // rejected call was `query-path('')` — `query-asset-meta` never returns a `url`
        // to resolve, so the path lookup was always handed an empty string (#25).
        const resolved = await resolveAsset(uuid);
        if (resolved.error) return { success: false, error: `Error validating prefab: ${resolved.error}` };
        if (!resolved.filePath) return { success: false, error: 'Could not resolve prefab file path on disk' };

        let content: string;
        try {
            content = fs.readFileSync(resolved.filePath, 'utf-8');
        } catch (error: any) {
            return { success: false, error: `Failed to read prefab file: ${error.message}` };
        }

        let prefabData: any;
        try {
            prefabData = JSON.parse(content);
        } catch {
            return { success: false, error: 'Prefab file format error: cannot parse JSON' };
        }

        const validationResult = this.creationService.validatePrefabFormat(prefabData);
        return {
            success: true,
            data: {
                isValid: validationResult.isValid, issues: validationResult.issues,
                nodeCount: validationResult.nodeCount, componentCount: validationResult.componentCount,
                url: resolved.url, file: resolved.filePath,
                message: validationResult.isValid ? 'Prefab format is valid' : 'Prefab format has issues'
            }
        };
    }

    private async duplicatePrefabByUuid(args: { uuid: string; newName?: string; targetDir?: string }): Promise<any> {
        // Prefab duplication requires complex serialization — not available programmatically
        return {
            success: false,
            error: 'Prefab duplication is not available programmatically',
            instruction: 'To duplicate a prefab, use the Cocos Creator editor:\n1. Select the prefab in the Asset Browser\n2. Right-click and select Copy\n3. Paste in the target location'
        };
    }

    /**
     * Restore (a.k.a. revert) a prefab instance to its asset state.
     *
     * Backs both `action=restore` and `action=revert`. Cocos Creator 3.8.7 exposes
     * no `scene:revert-prefab` message at all — `restore-prefab` is what the editor
     * itself uses for the inspector's Revert button (#13). It takes positional
     * `(rootUuid, assetUuid)`, returns a boolean, and records its own undo entry.
     */
    private async restorePrefabNode(nodeUuid: string, assetUuid?: string): Promise<any> {
        if (!nodeUuid) return { success: false, error: 'nodeUuid is required' };
        try {
            const context = await this.resolvePrefabContext(nodeUuid);
            if (!context.success) return context;

            const rootUuid = context.rootUuid;
            const resolvedAssetUuid = assetUuid || context.assetUuid;
            if (!resolvedAssetUuid) {
                return { success: false, error: `Could not resolve the prefab asset for node ${nodeUuid}. Pass assetUuid explicitly.` };
            }

            const restored = await (Editor.Message.request as any)('scene', 'restore-prefab', rootUuid, resolvedAssetUuid);
            if (restored === false) {
                return {
                    success: false,
                    error: `Editor rejected restore-prefab for node ${rootUuid}. Confirm it is a prefab-instance root with a valid asset link.`,
                    data: { nodeUuid, rootUuid, assetUuid: resolvedAssetUuid }
                };
            }
            return {
                success: true,
                data: { nodeUuid, rootUuid, assetUuid: resolvedAssetUuid },
                message: 'Prefab instance restored from asset successfully'
            };
        } catch (error: any) {
            return { success: false, error: `Failed to restore prefab node: ${error.message}` };
        }
    }
}
