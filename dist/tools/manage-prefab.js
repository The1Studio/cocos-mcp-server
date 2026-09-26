"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagePrefab = void 0;
const fs = __importStar(require("fs"));
const types_1 = require("../types");
const base_action_tool_1 = require("./base-action-tool");
const normalize_1 = require("../utils/normalize");
const asset_path_1 = require("../utils/asset-path");
const manage_prefab_creation_service_1 = require("./manage-prefab-creation-service");
class ManagePrefab extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.creationService = new manage_prefab_creation_service_1.PrefabCreationService();
        this.name = 'manage_prefab';
        this.description = 'Manage prefabs in the project. Actions: list=list all prefabs, load=load prefab by path, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to the prefab asset (verifies the asset was written, and removes children deleted from the instance that apply-prefab leaves behind), revert=revert prefab instance to the asset state (alias of restore), get_info=get prefab details, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using asset (with undo). For update/revert/restore, nodeUuid may be any node in the instance — the instance root is resolved automatically. Prerequisites: project must be open in Cocos Creator.';
        this.actions = ['list', 'load', 'instantiate', 'create', 'update', 'revert', 'get_info', 'validate', 'duplicate', 'restore'];
        this.inputSchema = {
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
        this.actionHandlers = {
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
        /**
         * Reference arrays whose element order is structural — a removed entry must be spliced
         * out of them, never left behind as a null hole.
         */
        this.structuralRefArrays = ['_children', '_components', 'nestedPrefabInstanceRoots', 'targetOverrides'];
    }
    async handleList(args) {
        const result = await this.getPrefabList(args.folder);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to list prefabs');
    }
    async handleLoad(args) {
        const { uuid } = args;
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required');
        const result = await this.loadPrefabByUuid(uuid);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to load prefab');
    }
    async handleInstantiate(args) {
        const { prefabUuid, parentUuid } = args;
        if (!prefabUuid)
            return (0, types_1.errorResult)('prefabUuid is required');
        const position = (0, normalize_1.normalizeVec3)(args.position);
        const rotation = (0, normalize_1.normalizeVec3)(args.rotation);
        const scale = (0, normalize_1.normalizeVec3)(args.scale);
        const result = await this.instantiatePrefabByUuid({ prefabUuid, parentUuid, position, rotation, scale });
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        const failure = (0, types_1.errorResult)(result.error || 'Failed to instantiate prefab');
        if (result.instruction)
            failure.instruction = result.instruction;
        return failure;
    }
    async handleCreate(args) {
        var _a;
        const { nodeUuid, savePath } = args;
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!savePath)
            return (0, types_1.errorResult)('savePath is required');
        const prefabName = ((_a = savePath.split('/').pop()) === null || _a === void 0 ? void 0 : _a.replace('.prefab', '')) || 'NewPrefab';
        const result = await this.createPrefab({ nodeUuid, savePath, prefabName });
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to create prefab');
    }
    async handleUpdate(args) {
        const { nodeUuid } = args;
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        const result = await this.updatePrefab(nodeUuid);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to update prefab');
    }
    async handleRevert(args) {
        const { nodeUuid, assetUuid } = args;
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        // `revert` and `restore` are the same editor operation — see restorePrefabNode.
        const result = await this.restorePrefabNode(nodeUuid, assetUuid);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to revert prefab');
    }
    async handleGetInfo(args) {
        const { uuid } = args;
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required');
        const result = await this.getPrefabInfoByUuid(uuid);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to get prefab info');
    }
    async handleValidate(args) {
        const { uuid } = args;
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required');
        const result = await this.validatePrefabByUuid(uuid);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to validate prefab');
    }
    async handleDuplicate(args) {
        const { uuid, newName, targetDir } = args;
        if (!uuid)
            return (0, types_1.errorResult)('uuid is required');
        const result = await this.duplicatePrefabByUuid({ uuid, newName, targetDir });
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to duplicate prefab');
    }
    async handleRestoreNode(args) {
        const { nodeUuid, assetUuid } = args;
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        const result = await this.restorePrefabNode(nodeUuid, assetUuid);
        if (result.success)
            return (0, types_1.successResult)(result.data, result.message);
        return (0, types_1.errorResult)(result.error || 'Failed to restore prefab node');
    }
    // ============================================================
    // Private implementation methods (ported from PrefabTools)
    // ============================================================
    async getPrefabList(folder = 'db://assets') {
        try {
            const pattern = folder.endsWith('/') ? `${folder}**/*.prefab` : `${folder}/**/*.prefab`;
            const results = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            const prefabs = results.map(asset => ({
                name: asset.name, path: asset.url, uuid: asset.uuid,
                folder: asset.url.substring(0, asset.url.lastIndexOf('/'))
            }));
            return { success: true, data: prefabs };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async loadPrefabByUuid(uuid) {
        try {
            const prefabData = await Editor.Message.request('scene', 'load-asset', { uuid });
            return { success: true, data: { uuid: prefabData.uuid, name: prefabData.name, message: 'Prefab loaded successfully' } };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async instantiatePrefabByUuid(args) {
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
            const createNodeOptions = {
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
                }).catch(() => { });
            }
            if (scale) {
                await Editor.Message.request('scene', 'set-property', {
                    uuid,
                    path: 'scale',
                    dump: { value: scale, type: 'cc.Vec3' }
                }).catch(() => { });
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
        }
        catch (err) {
            return {
                success: false,
                error: `Failed to instantiate prefab: ${err.message}`,
                instruction: 'Check that the prefabUuid is correct and the asset DB is ready.'
            };
        }
    }
    async createPrefab(args) {
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
            const assetDbResult = await this.creationService.createPrefabWithAssetDB(args.nodeUuid, fullPath, prefabName, includeChildren, includeComponents);
            if (assetDbResult.success)
                return assetDbResult;
            // A defective write is a result, not an unavailable path — retrying through
            // the fallback chain would re-serialize the same loss and mask it (#28).
            if (assetDbResult.fatal)
                return assetDbResult;
            const nativeResult = this.creationService.createPrefabNativeStub();
            if (nativeResult.success)
                return nativeResult;
            return await this.creationService.createPrefabCustom(args.nodeUuid, fullPath, prefabName);
        }
        catch (error) {
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
    async resolvePrefabContext(nodeUuid) {
        var _a;
        let nodeData;
        try {
            nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
        }
        catch (err) {
            return { success: false, error: `Failed to query node ${nodeUuid}: ${err.message}` };
        }
        if (!nodeData)
            return { success: false, error: 'Node not found' };
        const prefab = nodeData.__prefab__;
        if (!prefab) {
            return { success: false, error: `Node ${nodeUuid} is not part of a prefab instance` };
        }
        return {
            success: true,
            rootUuid: prefab.rootUuid || nodeUuid,
            assetUuid: prefab.uuid || ((_a = prefab.prefabStateInfo) === null || _a === void 0 ? void 0 : _a.assetUuid)
        };
    }
    /**
     * Resolve a prefab asset's on-disk path, or null when it cannot be determined.
     *
     * Goes through `query-asset-info`, not `query-asset-meta`: the meta record has no
     * `url` field, so the old lookup resolved to null for every asset and left the
     * post-apply write check permanently `unverified` (#25).
     */
    async resolvePrefabFilePath(assetUuid) {
        if (!assetUuid)
            return null;
        return (await (0, asset_path_1.resolveAsset)(assetUuid)).filePath;
    }
    statMtimeMs(filePath) {
        if (!filePath)
            return null;
        try {
            return fs.statSync(filePath).mtimeMs;
        }
        catch (_a) {
            return null;
        }
    }
    /** Poll for the prefab file to be rewritten; asset-db may flush shortly after the message resolves. */
    async waitForPrefabWrite(filePath, baselineMs, timeoutMs = 2000) {
        const deadline = Date.now() + timeoutMs;
        let mtime = this.statMtimeMs(filePath);
        while (mtime !== null && mtime <= baselineMs && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100));
            mtime = this.statMtimeMs(filePath);
        }
        return mtime;
    }
    async updatePrefab(nodeUuid) {
        try {
            const context = await this.resolvePrefabContext(nodeUuid);
            if (!context.success)
                return context;
            const { rootUuid, assetUuid } = context;
            const prefabPath = await this.resolvePrefabFilePath(assetUuid);
            const mtimeBefore = this.statMtimeMs(prefabPath);
            // `scene:apply-prefab` takes the instance root uuid as a POSITIONAL string
            // and resolves to a boolean. The old `{ node: uuid }` object form resolved
            // without throwing but never wrote the asset — a silent no-op reported as
            // success (#12).
            const applied = await Editor.Message.request('scene', 'apply-prefab', rootUuid);
            // Verify the asset was actually written rather than trusting the boolean the
            // message resolves to either way. `unverified` means the path could not be
            // resolved, not that the write failed. This runs even when `applied === false`:
            // the editor has been observed resolving `false` on saves that DID rewrite the
            // file (#63) — trusting that signal alone turns a successful update into a
            // reported failure. The mtime check is the source of truth; `applied` is only
            // consulted when the mtime cannot confirm one way or the other.
            let persisted = 'unverified';
            if (prefabPath !== null && mtimeBefore !== null) {
                const mtimeAfter = await this.waitForPrefabWrite(prefabPath, mtimeBefore);
                if (mtimeAfter !== null)
                    persisted = mtimeAfter > mtimeBefore;
            }
            // A rejected apply is a HARD STOP, whatever the mtime guard says (#128, #127).
            //
            // #63 established that `false` alone does not mean the write failed — the file can
            // be rewritten anyway — so rejection was demoted from "failure" to "unconfirmed"
            // and the mtime check was made the source of truth. That is right about the WRITE
            // and wrong about everything downstream of it: the orphan pass below treats the
            // live `query-node` walk as ground truth for what may legitimately be deleted, and
            // a rejected apply is precisely the signal that its view of the instance cannot be
            // trusted. Running the pass anyway let `update` delete a prefab's ENTIRE child set
            // while reporting `success: true` — 8 children to 0 on disk in #128, a nested
            // instance's whole local node mirror in #127.
            //
            // Never touch the asset again on a write we were told not to trust: no orphan
            // detection, no removal, no success envelope.
            const appliedRejected = applied === false;
            if (appliedRejected) {
                return {
                    success: false,
                    error: `Editor rejected apply-prefab for node ${rootUuid}, so its result is not trustworthy and no child nodes were removed. Confirm it is a prefab-instance root with a valid asset link.` +
                        (persisted === true
                            ? ` The rejected apply did rewrite ${prefabPath} — diff it against git before retrying.`
                            : ''),
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, appliedRejected }
                };
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
            let orphanedFileIds = [];
            if (persisted === true && prefabPath) {
                orphanedFileIds = await this.findOrphanedChildFileIds(rootUuid, prefabPath);
            }
            let removedFileIds = [];
            if (orphanedFileIds.length > 0) {
                const removal = await this.removeOrphanedChildrenFromAsset(prefabPath, orphanedFileIds, rootUuid, assetUuid);
                if (!removal.success) {
                    return {
                        success: false,
                        error: `apply-prefab wrote ${prefabPath}, but it still contains ${orphanedFileIds.length} child node(s) (fileId: ${orphanedFileIds.join(', ')}) that no longer exist in the scene instance. Cocos Creator 3.8.7's apply-prefab does not remove deleted children, and removing them here was declined: ${removal.error}. The asset is byte-for-byte unchanged — delete and recreate the prefab, or remove the stale entries manually.`,
                        data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, orphanedFileIds }
                    };
                }
                removedFileIds = orphanedFileIds;
            }
            // Only ever reached on a NON-rejected apply: a rejection returns above. Keeping
            // `appliedRejected` in the payload (now always false) rather than dropping it, so
            // existing callers that branch on the field keep working unchanged.
            return {
                success: true,
                message: removedFileIds.length > 0
                    ? `Prefab updated successfully; removed ${removedFileIds.length} child node(s) apply-prefab left behind`
                    : 'Prefab updated successfully',
                data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, appliedRejected, removedFileIds }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    /**
     * Return the fileIds of prefab-tracked nodes present in the written asset but absent
     * from the live scene instance — children `apply-prefab` failed to remove (#21).
     * Detection is best-effort: any failure returns no orphans rather than a false
     * positive, since this check must never mask a genuine success.
     */
    async findOrphanedChildFileIds(rootUuid, prefabPath) {
        try {
            const liveFileIds = await this.collectInstanceFileIds(rootUuid);
            if (liveFileIds.size === 0)
                return [];
            const assetData = JSON.parse(fs.readFileSync(prefabPath, 'utf-8'));
            if (!Array.isArray(assetData))
                return [];
            const assetFileIds = this.collectAssetNodeFileIds(assetData);
            return [...assetFileIds].filter(id => !liveFileIds.has(id));
        }
        catch (_a) {
            return [];
        }
    }
    /**
     * Walk a live prefab-instance subtree and collect the `__prefab__.fileId` of every node.
     *
     * `query-node` returns `children` as property dumps (`{ value: { uuid }, type }`), not
     * uuid strings; passing the dump on as a uuid reached no child, so every live child
     * looked orphaned and was deleted from the asset. Any node that cannot be resolved or
     * carries no fileId makes the walk incomplete, and an incomplete walk returns an EMPTY
     * set — the caller then removes nothing rather than deleting a child it failed to see.
     */
    async collectInstanceFileIds(rootUuid) {
        const fileIds = new Set();
        let complete = true;
        const childUuidOf = (entry) => {
            if (typeof entry === 'string')
                return entry;
            if (entry && typeof entry === 'object') {
                if (typeof entry.uuid === 'string')
                    return entry.uuid;
                if (entry.value && typeof entry.value.uuid === 'string')
                    return entry.value.uuid;
            }
            return '';
        };
        const visit = async (uuid) => {
            var _a;
            if (!complete)
                return;
            if (!uuid) {
                complete = false;
                return;
            }
            let nodeData;
            try {
                nodeData = await Editor.Message.request('scene', 'query-node', uuid);
            }
            catch (_b) {
                complete = false;
                return;
            }
            const fileId = (_a = nodeData === null || nodeData === void 0 ? void 0 : nodeData.__prefab__) === null || _a === void 0 ? void 0 : _a.fileId;
            if (typeof fileId !== 'string' || !fileId) {
                complete = false;
                return;
            }
            fileIds.add(fileId);
            const children = Array.isArray(nodeData.children) ? nodeData.children : [];
            for (const child of children)
                await visit(childUuidOf(child));
        };
        await visit(rootUuid);
        return complete ? fileIds : new Set();
    }
    /** Extract every `cc.Node` entry's fileId from a written `.prefab` asset's JSON array. */
    collectAssetNodeFileIds(prefabData) {
        const fileIds = new Set();
        for (let index = 0; index < prefabData.length; index++) {
            const fileId = this.fileIdOfNode(prefabData, index);
            if (fileId !== null)
                fileIds.add(fileId);
        }
        return fileIds;
    }
    /** The fileId recorded on the `cc.Node` at `index`, or null when it has none. */
    fileIdOfNode(prefabData, index) {
        var _a, _b;
        const entry = prefabData[index];
        if (!entry || entry.__type__ !== 'cc.Node')
            return null;
        const prefabInfoIndex = (_a = entry._prefab) === null || _a === void 0 ? void 0 : _a.__id__;
        if (typeof prefabInfoIndex !== 'number')
            return null;
        const fileId = (_b = prefabData[prefabInfoIndex]) === null || _b === void 0 ? void 0 : _b.fileId;
        return typeof fileId === 'string' && fileId ? fileId : null;
    }
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
    async removeOrphanedChildrenFromAsset(prefabPath, orphanedFileIds, rootUuid, assetUuid) {
        let originalText;
        let prefabData;
        try {
            originalText = fs.readFileSync(prefabPath, 'utf-8');
            prefabData = JSON.parse(originalText);
        }
        catch (err) {
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
        }
        catch (err) {
            return { success: false, error: `the rewritten asset could not be written (${err.message})` };
        }
        let imported;
        try {
            imported = (await Editor.Message.request('asset-db', 'reimport-asset', assetUuid)) !== false;
        }
        catch (_a) {
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
    restorePrefabFile(prefabPath, originalText) {
        try {
            fs.writeFileSync(prefabPath, originalText, 'utf-8');
        }
        catch (_a) {
            // Nothing further to do here — the caller reports the failure either way.
        }
    }
    /**
     * Drop every orphaned child subtree from a serialized prefab array and re-index the whole
     * graph. Returns null — changing nothing — whenever the graph does not match what this
     * rewrite relies on, rather than producing an asset nobody can load.
     */
    pruneOrphanedNodes(prefabData, orphanedFileIds, liveFileIds) {
        var _a, _b, _c;
        const nodeIndexByFileId = new Map();
        for (let index = 0; index < prefabData.length; index++) {
            const fileId = this.fileIdOfNode(prefabData, index);
            if (fileId !== null && !nodeIndexByFileId.has(fileId))
                nodeIndexByFileId.set(fileId, index);
        }
        const removed = new Set();
        const pending = [];
        for (const fileId of orphanedFileIds) {
            const index = nodeIndexByFileId.get(fileId);
            // Detection and removal disagree about the asset — do not guess at the graph.
            if (index === undefined)
                return null;
            pending.push(index);
        }
        while (pending.length > 0) {
            const nodeIndex = pending.shift();
            if (removed.has(nodeIndex))
                continue;
            const node = prefabData[nodeIndex];
            if (!node || node.__type__ !== 'cc.Node')
                return null;
            removed.add(nodeIndex);
            const prefabInfoIndex = (_a = node._prefab) === null || _a === void 0 ? void 0 : _a.__id__;
            if (typeof prefabInfoIndex === 'number')
                removed.add(prefabInfoIndex);
            for (const ref of Array.isArray(node._components) ? node._components : []) {
                const componentIndex = ref === null || ref === void 0 ? void 0 : ref.__id__;
                if (typeof componentIndex !== 'number')
                    continue;
                removed.add(componentIndex);
                const compPrefabIndex = (_c = (_b = prefabData[componentIndex]) === null || _b === void 0 ? void 0 : _b.__prefab) === null || _c === void 0 ? void 0 : _c.__id__;
                if (typeof compPrefabIndex === 'number')
                    removed.add(compPrefabIndex);
            }
            for (const ref of Array.isArray(node._children) ? node._children : []) {
                const childIndex = ref === null || ref === void 0 ? void 0 : ref.__id__;
                if (typeof childIndex !== 'number')
                    return null;
                // A descendant of a deleted child cannot still be live in the instance. If one
                // is, the orphan set is not what this rewrite assumes and it must not proceed.
                const childFileId = this.fileIdOfNode(prefabData, childIndex);
                if (childFileId !== null && liveFileIds.has(childFileId))
                    return null;
                pending.push(childIndex);
            }
        }
        if (removed.size === 0)
            return null;
        const pruned = JSON.parse(JSON.stringify(prefabData));
        for (let index = 0; index < pruned.length; index++) {
            if (removed.has(index))
                continue;
            const entry = pruned[index];
            if (!entry || typeof entry !== 'object')
                continue;
            for (const key of this.structuralRefArrays) {
                if (!Array.isArray(entry[key]))
                    continue;
                entry[key] = entry[key].filter((element) => !this.referencesRemoved(element, removed));
            }
        }
        // Whatever still points at a removed entry becomes null — this is the dangling
        // component reference the report calls out (an `ObjectView.tickNode` binding to a
        // child that no longer exists).
        for (let index = 0; index < pruned.length; index++) {
            if (removed.has(index))
                continue;
            pruned[index] = this.nullifyRemovedRefs(pruned[index], removed);
        }
        const remap = new Map();
        const survivors = [];
        for (let index = 0; index < pruned.length; index++) {
            if (removed.has(index))
                continue;
            remap.set(index, survivors.length);
            survivors.push(pruned[index]);
        }
        return survivors.map(entry => this.remapRefs(entry, remap));
    }
    /** True when `value` is — or contains — an `{ __id__ }` reference to a removed entry. */
    referencesRemoved(value, removed) {
        if (!value || typeof value !== 'object')
            return false;
        if (typeof value.__id__ === 'number')
            return removed.has(value.__id__);
        return Object.values(value).some(nested => this.referencesRemoved(nested, removed));
    }
    /** Replace every `{ __id__ }` reference to a removed entry with null. */
    nullifyRemovedRefs(value, removed) {
        if (Array.isArray(value))
            return value.map(element => this.nullifyRemovedRefs(element, removed));
        if (!value || typeof value !== 'object')
            return value;
        if (typeof value.__id__ === 'number')
            return removed.has(value.__id__) ? null : value;
        const rewritten = {};
        for (const [key, nested] of Object.entries(value))
            rewritten[key] = this.nullifyRemovedRefs(nested, removed);
        return rewritten;
    }
    /** Point every surviving `__id__` at its entry's slot in the compacted array. */
    remapRefs(value, remap) {
        if (Array.isArray(value))
            return value.map(element => this.remapRefs(element, remap));
        if (!value || typeof value !== 'object')
            return value;
        if (typeof value.__id__ === 'number') {
            const next = remap.get(value.__id__);
            return next === undefined ? null : { __id__: next };
        }
        const rewritten = {};
        for (const [key, nested] of Object.entries(value))
            rewritten[key] = this.remapRefs(nested, remap);
        return rewritten;
    }
    /**
     * Reject a rewritten graph before it reaches disk. Returns the first problem found, or
     * null when the graph is sound — this is what makes a mis-indexed asset impossible to
     * write rather than something to notice afterwards.
     */
    validatePrefabGraph(prefabData, removedFileIds, fileIdsBefore) {
        const dangling = this.findDanglingRef(prefabData, prefabData.length);
        if (dangling !== null)
            return `__id__ ${dangling} is out of range`;
        // Identity, not count: exactly the orphans go, and nothing else does.
        const remaining = this.collectAssetNodeFileIds(prefabData);
        for (const fileId of removedFileIds) {
            if (remaining.has(fileId))
                return `orphaned fileId ${fileId} survived removal`;
        }
        for (const fileId of fileIdsBefore) {
            if (removedFileIds.includes(fileId))
                continue;
            if (!remaining.has(fileId))
                return `fileId ${fileId} was removed but should have been kept`;
        }
        for (let index = 0; index < prefabData.length; index++) {
            const entry = prefabData[index];
            if (!entry || entry.__type__ !== 'cc.Node')
                continue;
            for (const ref of Array.isArray(entry._children) ? entry._children : []) {
                const childIndex = ref === null || ref === void 0 ? void 0 : ref.__id__;
                if (typeof childIndex !== 'number')
                    return `node ${index} has a malformed _children entry`;
                const child = prefabData[childIndex];
                if (!child || child.__type__ !== 'cc.Node')
                    return `node ${index} lists a non-node child at ${childIndex}`;
                if (child._parent && child._parent.__id__ !== index) {
                    return `node ${childIndex} does not point back at parent ${index}`;
                }
            }
            for (const ref of Array.isArray(entry._components) ? entry._components : []) {
                const componentIndex = ref === null || ref === void 0 ? void 0 : ref.__id__;
                if (typeof componentIndex !== 'number')
                    return `node ${index} has a malformed _components entry`;
                const component = prefabData[componentIndex];
                if (!component)
                    return `node ${index} lists a missing component at ${componentIndex}`;
                if (component.node && component.node.__id__ !== index) {
                    return `component ${componentIndex} does not point back at node ${index}`;
                }
            }
        }
        return null;
    }
    /** The first `__id__` outside `[0, length)` anywhere in the graph, or null when all resolve. */
    findDanglingRef(value, length) {
        if (Array.isArray(value)) {
            for (const element of value) {
                const found = this.findDanglingRef(element, length);
                if (found !== null)
                    return found;
            }
            return null;
        }
        if (!value || typeof value !== 'object')
            return null;
        if (typeof value.__id__ === 'number') {
            const id = value.__id__;
            return Number.isInteger(id) && id >= 0 && id < length ? null : id;
        }
        for (const nested of Object.values(value)) {
            const found = this.findDanglingRef(nested, length);
            if (found !== null)
                return found;
        }
        return null;
    }
    async getPrefabInfoByUuid(uuid) {
        // `query-asset-meta` carries no `url`/`name`/timestamps — reading them off the
        // meta record produced an all-empty PrefabInfo that still reported success (#25).
        const resolved = await (0, asset_path_1.resolveAsset)(uuid);
        if (resolved.error)
            return { success: false, error: resolved.error };
        if (!resolved.info)
            return { success: false, error: `Prefab not found: ${uuid}` };
        const assetInfo = resolved.info;
        const url = assetInfo.url || '';
        const stats = resolved.filePath ? this.statTimes(resolved.filePath) : null;
        const info = {
            name: assetInfo.name,
            uuid: assetInfo.uuid || uuid,
            path: url,
            folder: url ? url.substring(0, url.lastIndexOf('/')) : '',
            createTime: stats === null || stats === void 0 ? void 0 : stats.createTime,
            modifyTime: stats === null || stats === void 0 ? void 0 : stats.modifyTime
        };
        return { success: true, data: Object.assign(Object.assign({}, info), { file: resolved.filePath }) };
    }
    statTimes(filePath) {
        try {
            const s = fs.statSync(filePath);
            return { createTime: s.birthtime.toISOString(), modifyTime: s.mtime.toISOString() };
        }
        catch (_a) {
            return null;
        }
    }
    async validatePrefabByUuid(uuid) {
        // Each stage reports itself. The old single outer catch collapsed every failure
        // into `Error validating prefab: Error: parameter error`, which hid that the
        // rejected call was `query-path('')` — `query-asset-meta` never returns a `url`
        // to resolve, so the path lookup was always handed an empty string (#25).
        const resolved = await (0, asset_path_1.resolveAsset)(uuid);
        if (resolved.error)
            return { success: false, error: `Error validating prefab: ${resolved.error}` };
        if (!resolved.filePath)
            return { success: false, error: 'Could not resolve prefab file path on disk' };
        let content;
        try {
            content = fs.readFileSync(resolved.filePath, 'utf-8');
        }
        catch (error) {
            return { success: false, error: `Failed to read prefab file: ${error.message}` };
        }
        let prefabData;
        try {
            prefabData = JSON.parse(content);
        }
        catch (_a) {
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
    async duplicatePrefabByUuid(args) {
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
    async restorePrefabNode(nodeUuid, assetUuid) {
        if (!nodeUuid)
            return { success: false, error: 'nodeUuid is required' };
        try {
            const context = await this.resolvePrefabContext(nodeUuid);
            if (!context.success)
                return context;
            const rootUuid = context.rootUuid;
            const resolvedAssetUuid = assetUuid || context.assetUuid;
            if (!resolvedAssetUuid) {
                return { success: false, error: `Could not resolve the prefab asset for node ${nodeUuid}. Pass assetUuid explicitly.` };
            }
            const restored = await Editor.Message.request('scene', 'restore-prefab', rootUuid, resolvedAssetUuid);
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
        }
        catch (error) {
            return { success: false, error: `Failed to restore prefab node: ${error.message}` };
        }
    }
}
exports.ManagePrefab = ManagePrefab;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdXNCQUF1c0IsQ0FBQztRQUN0dEIsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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LEdBQUcsTUFBTyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQWUsQ0FBQyxPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDL0csSUFBSSxRQUFRLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ3JCLE9BQU87b0JBQ0gsT0FBTyxFQUFFLEtBQUs7b0JBQ2QsS0FBSyxFQUFFLDJDQUEyQyxRQUFRLGlFQUFpRTtvQkFDM0gsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUU7aUJBQzdELENBQUM7WUFDTixDQUFDO1lBQ0QsT0FBTztnQkFDSCxPQUFPLEVBQUUsSUFBSTtnQkFDYixJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRTtnQkFDMUQsT0FBTyxFQUFFLGtEQUFrRDthQUM5RCxDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLGtDQUFrQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztRQUN4RixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBaDdCRCxvQ0FnN0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQsIFByZWZhYkluZm8gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBub3JtYWxpemVWZWMzIH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcbmltcG9ydCB7IHJlc29sdmVBc3NldCB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LXBhdGgnO1xuaW1wb3J0IHsgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9tYW5hZ2UtcHJlZmFiLWNyZWF0aW9uLXNlcnZpY2UnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlUHJlZmFiIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHByaXZhdGUgcmVhZG9ubHkgY3JlYXRpb25TZXJ2aWNlID0gbmV3IFByZWZhYkNyZWF0aW9uU2VydmljZSgpO1xuXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJlZmFiJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgcHJlZmFicyBpbiB0aGUgcHJvamVjdC4gQWN0aW9uczogbGlzdD1saXN0IGFsbCBwcmVmYWJzLCBsb2FkPWxvYWQgcHJlZmFiIGJ5IHBhdGgsIGluc3RhbnRpYXRlPWluc3RhbnRpYXRlIHByZWZhYiBpbiBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBwcmVmYWIgZnJvbSBub2RlLCB1cGRhdGU9YXBwbHkgbm9kZSBjaGFuZ2VzIHRvIHRoZSBwcmVmYWIgYXNzZXQgKHZlcmlmaWVzIHRoZSBhc3NldCB3YXMgd3JpdHRlbiwgYW5kIHJlbW92ZXMgY2hpbGRyZW4gZGVsZXRlZCBmcm9tIHRoZSBpbnN0YW5jZSB0aGF0IGFwcGx5LXByZWZhYiBsZWF2ZXMgYmVoaW5kKSwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IHByZWZhYiBkZXRhaWxzLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBhc3NldCAod2l0aCB1bmRvKS4gRm9yIHVwZGF0ZS9yZXZlcnQvcmVzdG9yZSwgbm9kZVV1aWQgbWF5IGJlIGFueSBub2RlIGluIHRoZSBpbnN0YW5jZSDigJQgdGhlIGluc3RhbmNlIHJvb3QgaXMgcmVzb2x2ZWQgYXV0b21hdGljYWxseS4gUHJlcmVxdWlzaXRlczogcHJvamVjdCBtdXN0IGJlIG9wZW4gaW4gQ29jb3MgQ3JlYXRvci4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2xpc3QnLCAnbG9hZCcsICdpbnN0YW50aWF0ZScsICdjcmVhdGUnLCAndXBkYXRlJywgJ3JldmVydCcsICdnZXRfaW5mbycsICd2YWxpZGF0ZScsICdkdXBsaWNhdGUnLCAncmVzdG9yZSddO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2xpc3QnLCAnbG9hZCcsICdpbnN0YW50aWF0ZScsICdjcmVhdGUnLCAndXBkYXRlJywgJ3JldmVydCcsICdnZXRfaW5mbycsICd2YWxpZGF0ZScsICdkdXBsaWNhdGUnLCAncmVzdG9yZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGxpc3Q9bGlzdCBhbGwgcHJlZmFicyBpbiBwcm9qZWN0LCBsb2FkPWxvYWQgcHJlZmFiIGJ5IHV1aWQsIGluc3RhbnRpYXRlPWluc3RhbnRpYXRlIHByZWZhYiBpbiBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBwcmVmYWIgZnJvbSBub2RlLCB1cGRhdGU9YXBwbHkgbm9kZSBjaGFuZ2VzIHRvIGV4aXN0aW5nIHByZWZhYiwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IGRldGFpbGVkIHByZWZhYiBpbmZvLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBwcmVmYWIgYXNzZXQgKGJ1aWx0LWluIHVuZG8pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIChmb3IgbG9hZCwgZ2V0X2luZm8sIHZhbGlkYXRlLCBkdXBsaWNhdGUsIHJlc3RvcmVfbm9kZSBhY3Rpb25zKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcmVmYWJVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCAoZm9yIGluc3RhbnRpYXRlIGFjdGlvbiknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NjZW5lIG5vZGUgVVVJRCAoZm9yIGNyZWF0ZSwgdXBkYXRlLCByZXZlcnQsIHJlc3RvcmUgYWN0aW9ucykuIEZvciB1cGRhdGUvcmV2ZXJ0L3Jlc3RvcmUgdGhpcyBtYXkgYmUgYW55IG5vZGUgaW5zaWRlIHRoZSBwcmVmYWIgaW5zdGFuY2U7IHRoZSBpbnN0YW5jZSByb290IGlzIHJlc29sdmVkIGZyb20gaXQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNhdmVQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCBEQiBwYXRoIHRvIHNhdmUgcHJlZmFiIChmb3IgY3JlYXRlIGFjdGlvbiwgZS5nLiBkYjovL2Fzc2V0cy9wcmVmYWJzL015UHJlZmFiLnByZWZhYiknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFyZW50VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IG5vZGUgVVVJRCBmb3IgdGhlIGluc3RhbnRpYXRlZCBwcmVmYWIgKGZvciBpbnN0YW50aWF0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCBwb3NpdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJvdGF0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHJvdGF0aW9uIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NhbGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgc2NhbGUge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmb2xkZXI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZvbGRlciB0byBzZWFyY2ggcHJlZmFicyBpbiAoZm9yIGxpc3QgYWN0aW9uLCBkZWZhdWx0OiBkYjovL2Fzc2V0cyknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuZXdOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdOZXcgcHJlZmFiIG5hbWUgKGZvciBkdXBsaWNhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGFyZ2V0RGlyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgZGlyZWN0b3J5IGZvciBkdXBsaWNhdGVkIHByZWZhYiAoZm9yIGR1cGxpY2F0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIHRvIHJlc3RvcmUgZnJvbSAoZm9yIHJldmVydCBhbmQgcmVzdG9yZSBhY3Rpb25zLCBvcHRpb25hbCDigJQgcmVzb2x2ZWQgZnJvbSB0aGUgbm9kZSB3aGVuIG9taXR0ZWQpJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlTGlzdChhcmdzKSxcbiAgICAgICAgbG9hZDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlTG9hZChhcmdzKSxcbiAgICAgICAgaW5zdGFudGlhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUluc3RhbnRpYXRlKGFyZ3MpLFxuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUNyZWF0ZShhcmdzKSxcbiAgICAgICAgdXBkYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVVcGRhdGUoYXJncyksXG4gICAgICAgIHJldmVydDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlUmV2ZXJ0KGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuaGFuZGxlR2V0SW5mbyhhcmdzKSxcbiAgICAgICAgdmFsaWRhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVZhbGlkYXRlKGFyZ3MpLFxuICAgICAgICBkdXBsaWNhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUR1cGxpY2F0ZShhcmdzKSxcbiAgICAgICAgcmVzdG9yZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlUmVzdG9yZU5vZGUoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTGlzdChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0UHJlZmFiTGlzdChhcmdzLmZvbGRlcik7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGxpc3QgcHJlZmFicycpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTG9hZChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5sb2FkUHJlZmFiQnlVdWlkKHV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBsb2FkIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW5zdGFudGlhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghcHJlZmFiVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcmVmYWJVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnBvc2l0aW9uKTtcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3Mucm90YXRpb24pO1xuICAgICAgICBjb25zdCBzY2FsZSA9IG5vcm1hbGl6ZVZlYzMoYXJncy5zY2FsZSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGVQcmVmYWJCeVV1aWQoeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkLCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IGZhaWx1cmUgPSBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBpbnN0YW50aWF0ZSBwcmVmYWInKTtcbiAgICAgICAgaWYgKHJlc3VsdC5pbnN0cnVjdGlvbikgZmFpbHVyZS5pbnN0cnVjdGlvbiA9IHJlc3VsdC5pbnN0cnVjdGlvbjtcbiAgICAgICAgcmV0dXJuIGZhaWx1cmU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVDcmVhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBzYXZlUGF0aCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBpZiAoIXNhdmVQYXRoKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmVQYXRoIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHByZWZhYk5hbWUgPSBzYXZlUGF0aC5zcGxpdCgnLycpLnBvcCgpPy5yZXBsYWNlKCcucHJlZmFiJywgJycpIHx8ICdOZXdQcmVmYWInO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0ZVByZWZhYih7IG5vZGVVdWlkLCBzYXZlUGF0aCwgcHJlZmFiTmFtZSB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gY3JlYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlVXBkYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnVwZGF0ZVByZWZhYihub2RlVXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHVwZGF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJldmVydChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGFzc2V0VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICAvLyBgcmV2ZXJ0YCBhbmQgYHJlc3RvcmVgIGFyZSB0aGUgc2FtZSBlZGl0b3Igb3BlcmF0aW9uIOKAlCBzZWUgcmVzdG9yZVByZWZhYk5vZGUuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQsIGFzc2V0VXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHJldmVydCBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEluZm8oYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0UHJlZmFiSW5mb0J5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gZ2V0IHByZWZhYiBpbmZvJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVWYWxpZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy52YWxpZGF0ZVByZWZhYkJ5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gdmFsaWRhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVEdXBsaWNhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQsIG5ld05hbWUsIHRhcmdldERpciB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kdXBsaWNhdGVQcmVmYWJCeVV1aWQoeyB1dWlkLCBuZXdOYW1lLCB0YXJnZXREaXIgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGR1cGxpY2F0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlc3RvcmVOb2RlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgYXNzZXRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQsIGFzc2V0VXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHJlc3RvcmUgcHJlZmFiIG5vZGUnKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBQcml2YXRlIGltcGxlbWVudGF0aW9uIG1ldGhvZHMgKHBvcnRlZCBmcm9tIFByZWZhYlRvb2xzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcmVmYWJMaXN0KGZvbGRlcjogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gZm9sZGVyLmVuZHNXaXRoKCcvJykgPyBgJHtmb2xkZXJ9KiovKi5wcmVmYWJgIDogYCR7Zm9sZGVyfS8qKi8qLnByZWZhYmA7XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzOiBhbnlbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYnM6IFByZWZhYkluZm9bXSA9IHJlc3VsdHMubWFwKGFzc2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSwgcGF0aDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLFxuICAgICAgICAgICAgICAgIGZvbGRlcjogYXNzZXQudXJsLnN1YnN0cmluZygwLCBhc3NldC51cmwubGFzdEluZGV4T2YoJy8nKSlcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHByZWZhYnMgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbG9hZFByZWZhYkJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnbG9hZC1hc3NldCcsIHsgdXVpZCB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogcHJlZmFiRGF0YS51dWlkLCBuYW1lOiBwcmVmYWJEYXRhLm5hbWUsIG1lc3NhZ2U6ICdQcmVmYWIgbG9hZGVkIHN1Y2Nlc3NmdWxseScgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbnN0YW50aWF0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHByZWZhYlV1aWQ6IHN0cmluZzsgcGFyZW50VXVpZD86IHN0cmluZzsgcG9zaXRpb24/OiBhbnk7IHJvdGF0aW9uPzogYW55OyBzY2FsZT86IGFueSB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSB9ID0gYXJncztcblxuICAgICAgICAgICAgLy8gQW4gdW5yZXNvbHZhYmxlIHV1aWQgbXVzdCBiZSBmYXRhbDogY3JlYXRlLW5vZGUgc2lsZW50bHkgcmV0dXJucyBub3RoaW5nIGZvciBpdCxcbiAgICAgICAgICAgIC8vIHdoaWNoIHByZXZpb3VzbHkgcHJvZHVjZWQgYSBzdWNjZXNzIGVudmVsb3BlIHdpdGggbm8gbm9kZVV1aWQgKCMxNSkuXG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgcHJlZmFiVXVpZCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB1dWlkICcke3ByZWZhYlV1aWR9JyBub3QgZm91bmQgaW4gdGhlIGFzc2V0IERCYCxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdWZXJpZnkgdGhlIHV1aWQsIGFuZCByZWZyZXNoIHRoZSBhc3NldCBEQiAobWFuYWdlX2Fzc2V0IGFjdGlvbj1yZWZyZXNoKSBpZiB0aGUgLnByZWZhYiBmaWxlIHdhcyB3cml0dGVuIG91dHNpZGUgdGhlIGVkaXRvci4nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY3JlYXRlTm9kZU9wdGlvbnM6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgLy8gYHR5cGVgIHNlbGVjdHMgdGhlIGNyZWF0ZU5vZGVGcm9tQXNzZXQoKSBicmFuY2ggdGhhdCBpbnN0YW50aWF0ZXMgYVxuICAgICAgICAgICAgICAgIC8vIGxpbmtlZCBQcmVmYWJJbnN0YW5jZS4gV2l0aG91dCBpdCwgMy44LjcncyBub2RlIG1hbmFnZXIgZmFsbHMgYmFjayB0b1xuICAgICAgICAgICAgICAgIC8vIGJ1aWxkaW5nIGEgcGxhaW4gbm9kZSBmcm9tIHRoZSBhc3NldCdzIHJhdyBkdW1wIOKAlCBhIGZsYXR0ZW5lZCxcbiAgICAgICAgICAgICAgICAvLyB1bmxpbmtlZCBjb3B5IHRoYXQgcmVwb3J0cyBzdWNjZXNzIGJ1dCBjYXJyaWVzIG5vIGNjLlByZWZhYkluZm8gKHNlZVxuICAgICAgICAgICAgICAgIC8vIE5vZGVNYW5hZ2VyLmNyZWF0ZU5vZGVGcm9tQXNzZXQganNkb2M6IFwib3B0aW9ucy50eXBlOiDotYTmupDnsbvlnotcIikuXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXRJbmZvLnR5cGVcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucGFyZW50ID0gcGFyZW50VXVpZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFzc2V0SW5mbyAmJiBhc3NldEluZm8ubmFtZSkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLm5hbWUgPSBhc3NldEluZm8ubmFtZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgLy8gYHBvc2l0aW9uYCBpcyBhIGRvY3VtZW50ZWQgdG9wLWxldmVsIENyZWF0ZU5vZGVPcHRpb25zIGZpZWxkOyBgZHVtcGBcbiAgICAgICAgICAgICAgICAvLyBpcyBleHBsaWNpdGx5IGNvbW1lbnRlZCBvdXQgYXMgdW51c2VkIGluIEBjb2Nvcy9jcmVhdG9yLXR5cGVzIOKAlCBpdCB3YXNcbiAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmVkLCBzbyBpbnN0YW50aWF0ZWQgcHJlZmFicyBuZXZlciBwaWNrZWQgdXAgdGhpcyBwb3NpdGlvbi5cbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgY3JlYXRlTm9kZU9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IEFycmF5LmlzQXJyYXkobm9kZVV1aWQpID8gbm9kZVV1aWRbMF0gOiBub2RlVXVpZDtcblxuICAgICAgICAgICAgLy8gTmV2ZXIgcmVwb3J0IHN1Y2Nlc3Mgd2l0aG91dCBhIG5vZGUgaWQg4oCUIHRoZSBjYWxsZXIgd291bGQgYnVpbGQgb24gYSBzY2VuZVxuICAgICAgICAgICAgLy8gdGhhdCBzaWxlbnRseSBsYWNrcyB0aGUgbm9kZSAoIzE1KS5cbiAgICAgICAgICAgIGlmICghdXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYGNyZWF0ZS1ub2RlIHJldHVybmVkIG5vIG5vZGUgdXVpZCBmb3IgcHJlZmFiICcke3ByZWZhYlV1aWR9JyDigJQgbm90aGluZyB3YXMgaW5zdGFudGlhdGVkYCxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdFbnN1cmUgYSBzY2VuZSBpcyBvcGVuIGFuZCB0aGUgcHJlZmFiIGFzc2V0IGlzIHZhbGlkLCB0aGVuIHJldHJ5LidcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcHBseSByb3RhdGlvbiBhbmQgc2NhbGUgaWYgcHJvdmlkZWRcbiAgICAgICAgICAgIGlmIChyb3RhdGlvbikge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogJ2V1bGVyQW5nbGVzJyxcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcm90YXRpb24sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gey8qIG5vbi1mYXRhbCAqL30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNjYWxlKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnc2NhbGUnLFxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBzY2FsZSwgdHlwZTogJ2NjLlZlYzMnIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7Lyogbm9uLWZhdGFsICovfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIGluc3RhbnRpYXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiOiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdDaGVjayB0aGF0IHRoZSBwcmVmYWJVdWlkIGlzIGNvcnJlY3QgYW5kIHRoZSBhc3NldCBEQiBpcyByZWFkeS4nXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVQcmVmYWIoYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGhQYXJhbSA9IGFyZ3MucHJlZmFiUGF0aCB8fCBhcmdzLnNhdmVQYXRoO1xuICAgICAgICAgICAgaWYgKCFwYXRoUGFyYW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdNaXNzaW5nIHByZWZhYiBwYXRoIHBhcmFtZXRlci4gUHJvdmlkZSBzYXZlUGF0aC4nIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYk5hbWUgPSBhcmdzLnByZWZhYk5hbWUgfHwgJ05ld1ByZWZhYic7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGhQYXJhbS5lbmRzV2l0aCgnLnByZWZhYicpID9cbiAgICAgICAgICAgICAgICBwYXRoUGFyYW0gOiBgJHtwYXRoUGFyYW19LyR7cHJlZmFiTmFtZX0ucHJlZmFiYDtcblxuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNoaWxkcmVuID0gYXJncy5pbmNsdWRlQ2hpbGRyZW4gIT09IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNvbXBvbmVudHMgPSBhcmdzLmluY2x1ZGVDb21wb25lbnRzICE9PSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgYXNzZXREYlJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYldpdGhBc3NldERCKFxuICAgICAgICAgICAgICAgIGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lLCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGFzc2V0RGJSZXN1bHQuc3VjY2VzcykgcmV0dXJuIGFzc2V0RGJSZXN1bHQ7XG4gICAgICAgICAgICAvLyBBIGRlZmVjdGl2ZSB3cml0ZSBpcyBhIHJlc3VsdCwgbm90IGFuIHVuYXZhaWxhYmxlIHBhdGgg4oCUIHJldHJ5aW5nIHRocm91Z2hcbiAgICAgICAgICAgIC8vIHRoZSBmYWxsYmFjayBjaGFpbiB3b3VsZCByZS1zZXJpYWxpemUgdGhlIHNhbWUgbG9zcyBhbmQgbWFzayBpdCAoIzI4KS5cbiAgICAgICAgICAgIGlmIChhc3NldERiUmVzdWx0LmZhdGFsKSByZXR1cm4gYXNzZXREYlJlc3VsdDtcblxuICAgICAgICAgICAgY29uc3QgbmF0aXZlUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpO1xuICAgICAgICAgICAgaWYgKG5hdGl2ZVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gbmF0aXZlUmVzdWx0O1xuXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiQ3VzdG9tKGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIGNyZWF0aW5nIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIHRoZSBwcmVmYWItaW5zdGFuY2UgY29udGV4dCBmb3IgYSBub2RlLlxuICAgICAqXG4gICAgICogQ29jb3MgQ3JlYXRvciBkcml2ZXMgYm90aCBwcmVmYWIgbWVzc2FnZXMgZnJvbSB0aGUgbm9kZSBkdW1wJ3MgYF9fcHJlZmFiX19gXG4gICAgICogYmxvY2sg4oCUIGByb290VXVpZGAgKHRoZSBwcmVmYWItaW5zdGFuY2UgUk9PVCwgbm90IHdoaWNoZXZlciBkZXNjZW5kYW50IHRoZVxuICAgICAqIGNhbGxlciBoYXBwZW5lZCB0byBwYXNzKSBhbmQgYHV1aWRgICh0aGUgYmFja2luZyBwcmVmYWIgYXNzZXQpLiBTZWUgMy44LjdcbiAgICAgKiBgcmVzb3VyY2VzLzNkL2VuZ2luZS9lZGl0b3IvaW5zcGVjdG9yL2NvbnRyaWJ1dGlvbnMvbm9kZS5qc2A6XG4gICAgICogICByZXF1ZXN0KCdzY2VuZScsICdhcHBseS1wcmVmYWInLCBwcmVmYWIucm9vdFV1aWQpXG4gICAgICogICByZXF1ZXN0KCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHByZWZhYi5yb290VXVpZCwgcHJlZmFiLnV1aWQpXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgbGV0IG5vZGVEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcXVlcnkgbm9kZSAke25vZGVVdWlkfTogJHtlcnIubWVzc2FnZX1gIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm9kZSBub3QgZm91bmQnIH07XG5cbiAgICAgICAgY29uc3QgcHJlZmFiID0gbm9kZURhdGEuX19wcmVmYWJfXztcbiAgICAgICAgaWYgKCFwcmVmYWIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gaXMgbm90IHBhcnQgb2YgYSBwcmVmYWIgaW5zdGFuY2VgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICByb290VXVpZDogcHJlZmFiLnJvb3RVdWlkIHx8IG5vZGVVdWlkLFxuICAgICAgICAgICAgYXNzZXRVdWlkOiBwcmVmYWIudXVpZCB8fCBwcmVmYWIucHJlZmFiU3RhdGVJbmZvPy5hc3NldFV1aWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIGEgcHJlZmFiIGFzc2V0J3Mgb24tZGlzayBwYXRoLCBvciBudWxsIHdoZW4gaXQgY2Fubm90IGJlIGRldGVybWluZWQuXG4gICAgICpcbiAgICAgKiBHb2VzIHRocm91Z2ggYHF1ZXJ5LWFzc2V0LWluZm9gLCBub3QgYHF1ZXJ5LWFzc2V0LW1ldGFgOiB0aGUgbWV0YSByZWNvcmQgaGFzIG5vXG4gICAgICogYHVybGAgZmllbGQsIHNvIHRoZSBvbGQgbG9va3VwIHJlc29sdmVkIHRvIG51bGwgZm9yIGV2ZXJ5IGFzc2V0IGFuZCBsZWZ0IHRoZVxuICAgICAqIHBvc3QtYXBwbHkgd3JpdGUgY2hlY2sgcGVybWFuZW50bHkgYHVudmVyaWZpZWRgICgjMjUpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVByZWZhYkZpbGVQYXRoKGFzc2V0VXVpZD86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIWFzc2V0VXVpZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiAoYXdhaXQgcmVzb2x2ZUFzc2V0KGFzc2V0VXVpZCkpLmZpbGVQYXRoO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdE10aW1lTXMoZmlsZVBhdGg6IHN0cmluZyB8IG51bGwpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZnMuc3RhdFN5bmMoZmlsZVBhdGgpLm10aW1lTXM7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogUG9sbCBmb3IgdGhlIHByZWZhYiBmaWxlIHRvIGJlIHJld3JpdHRlbjsgYXNzZXQtZGIgbWF5IGZsdXNoIHNob3J0bHkgYWZ0ZXIgdGhlIG1lc3NhZ2UgcmVzb2x2ZXMuICovXG4gICAgcHJpdmF0ZSBhc3luYyB3YWl0Rm9yUHJlZmFiV3JpdGUoZmlsZVBhdGg6IHN0cmluZywgYmFzZWxpbmVNczogbnVtYmVyLCB0aW1lb3V0TXMgPSAyMDAwKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIHRpbWVvdXRNcztcbiAgICAgICAgbGV0IG10aW1lID0gdGhpcy5zdGF0TXRpbWVNcyhmaWxlUGF0aCk7XG4gICAgICAgIHdoaWxlIChtdGltZSAhPT0gbnVsbCAmJiBtdGltZSA8PSBiYXNlbGluZU1zICYmIERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMCkpO1xuICAgICAgICAgICAgbXRpbWUgPSB0aGlzLnN0YXRNdGltZU1zKGZpbGVQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbXRpbWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB1cGRhdGVQcmVmYWIobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICBjb25zdCB7IHJvb3RVdWlkLCBhc3NldFV1aWQgfSA9IGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJGaWxlUGF0aChhc3NldFV1aWQpO1xuICAgICAgICAgICAgY29uc3QgbXRpbWVCZWZvcmUgPSB0aGlzLnN0YXRNdGltZU1zKHByZWZhYlBhdGgpO1xuXG4gICAgICAgICAgICAvLyBgc2NlbmU6YXBwbHktcHJlZmFiYCB0YWtlcyB0aGUgaW5zdGFuY2Ugcm9vdCB1dWlkIGFzIGEgUE9TSVRJT05BTCBzdHJpbmdcbiAgICAgICAgICAgIC8vIGFuZCByZXNvbHZlcyB0byBhIGJvb2xlYW4uIFRoZSBvbGQgYHsgbm9kZTogdXVpZCB9YCBvYmplY3QgZm9ybSByZXNvbHZlZFxuICAgICAgICAgICAgLy8gd2l0aG91dCB0aHJvd2luZyBidXQgbmV2ZXIgd3JvdGUgdGhlIGFzc2V0IOKAlCBhIHNpbGVudCBuby1vcCByZXBvcnRlZCBhc1xuICAgICAgICAgICAgLy8gc3VjY2VzcyAoIzEyKS5cbiAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdhcHBseS1wcmVmYWInLCByb290VXVpZCk7XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSB0aGUgYXNzZXQgd2FzIGFjdHVhbGx5IHdyaXR0ZW4gcmF0aGVyIHRoYW4gdHJ1c3RpbmcgdGhlIGJvb2xlYW4gdGhlXG4gICAgICAgICAgICAvLyBtZXNzYWdlIHJlc29sdmVzIHRvIGVpdGhlciB3YXkuIGB1bnZlcmlmaWVkYCBtZWFucyB0aGUgcGF0aCBjb3VsZCBub3QgYmVcbiAgICAgICAgICAgIC8vIHJlc29sdmVkLCBub3QgdGhhdCB0aGUgd3JpdGUgZmFpbGVkLiBUaGlzIHJ1bnMgZXZlbiB3aGVuIGBhcHBsaWVkID09PSBmYWxzZWA6XG4gICAgICAgICAgICAvLyB0aGUgZWRpdG9yIGhhcyBiZWVuIG9ic2VydmVkIHJlc29sdmluZyBgZmFsc2VgIG9uIHNhdmVzIHRoYXQgRElEIHJld3JpdGUgdGhlXG4gICAgICAgICAgICAvLyBmaWxlICgjNjMpIOKAlCB0cnVzdGluZyB0aGF0IHNpZ25hbCBhbG9uZSB0dXJucyBhIHN1Y2Nlc3NmdWwgdXBkYXRlIGludG8gYVxuICAgICAgICAgICAgLy8gcmVwb3J0ZWQgZmFpbHVyZS4gVGhlIG10aW1lIGNoZWNrIGlzIHRoZSBzb3VyY2Ugb2YgdHJ1dGg7IGBhcHBsaWVkYCBpcyBvbmx5XG4gICAgICAgICAgICAvLyBjb25zdWx0ZWQgd2hlbiB0aGUgbXRpbWUgY2Fubm90IGNvbmZpcm0gb25lIHdheSBvciB0aGUgb3RoZXIuXG4gICAgICAgICAgICBsZXQgcGVyc2lzdGVkOiBib29sZWFuIHwgJ3VudmVyaWZpZWQnID0gJ3VudmVyaWZpZWQnO1xuICAgICAgICAgICAgaWYgKHByZWZhYlBhdGggIT09IG51bGwgJiYgbXRpbWVCZWZvcmUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtdGltZUFmdGVyID0gYXdhaXQgdGhpcy53YWl0Rm9yUHJlZmFiV3JpdGUocHJlZmFiUGF0aCwgbXRpbWVCZWZvcmUpO1xuICAgICAgICAgICAgICAgIGlmIChtdGltZUFmdGVyICE9PSBudWxsKSBwZXJzaXN0ZWQgPSBtdGltZUFmdGVyID4gbXRpbWVCZWZvcmU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEEgcmVqZWN0ZWQgYXBwbHkgaXMgYSBIQVJEIFNUT1AsIHdoYXRldmVyIHRoZSBtdGltZSBndWFyZCBzYXlzICgjMTI4LCAjMTI3KS5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyAjNjMgZXN0YWJsaXNoZWQgdGhhdCBgZmFsc2VgIGFsb25lIGRvZXMgbm90IG1lYW4gdGhlIHdyaXRlIGZhaWxlZCDigJQgdGhlIGZpbGUgY2FuXG4gICAgICAgICAgICAvLyBiZSByZXdyaXR0ZW4gYW55d2F5IOKAlCBzbyByZWplY3Rpb24gd2FzIGRlbW90ZWQgZnJvbSBcImZhaWx1cmVcIiB0byBcInVuY29uZmlybWVkXCJcbiAgICAgICAgICAgIC8vIGFuZCB0aGUgbXRpbWUgY2hlY2sgd2FzIG1hZGUgdGhlIHNvdXJjZSBvZiB0cnV0aC4gVGhhdCBpcyByaWdodCBhYm91dCB0aGUgV1JJVEVcbiAgICAgICAgICAgIC8vIGFuZCB3cm9uZyBhYm91dCBldmVyeXRoaW5nIGRvd25zdHJlYW0gb2YgaXQ6IHRoZSBvcnBoYW4gcGFzcyBiZWxvdyB0cmVhdHMgdGhlXG4gICAgICAgICAgICAvLyBsaXZlIGBxdWVyeS1ub2RlYCB3YWxrIGFzIGdyb3VuZCB0cnV0aCBmb3Igd2hhdCBtYXkgbGVnaXRpbWF0ZWx5IGJlIGRlbGV0ZWQsIGFuZFxuICAgICAgICAgICAgLy8gYSByZWplY3RlZCBhcHBseSBpcyBwcmVjaXNlbHkgdGhlIHNpZ25hbCB0aGF0IGl0cyB2aWV3IG9mIHRoZSBpbnN0YW5jZSBjYW5ub3QgYmVcbiAgICAgICAgICAgIC8vIHRydXN0ZWQuIFJ1bm5pbmcgdGhlIHBhc3MgYW55d2F5IGxldCBgdXBkYXRlYCBkZWxldGUgYSBwcmVmYWIncyBFTlRJUkUgY2hpbGQgc2V0XG4gICAgICAgICAgICAvLyB3aGlsZSByZXBvcnRpbmcgYHN1Y2Nlc3M6IHRydWVgIOKAlCA4IGNoaWxkcmVuIHRvIDAgb24gZGlzayBpbiAjMTI4LCBhIG5lc3RlZFxuICAgICAgICAgICAgLy8gaW5zdGFuY2UncyB3aG9sZSBsb2NhbCBub2RlIG1pcnJvciBpbiAjMTI3LlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIE5ldmVyIHRvdWNoIHRoZSBhc3NldCBhZ2FpbiBvbiBhIHdyaXRlIHdlIHdlcmUgdG9sZCBub3QgdG8gdHJ1c3Q6IG5vIG9ycGhhblxuICAgICAgICAgICAgLy8gZGV0ZWN0aW9uLCBubyByZW1vdmFsLCBubyBzdWNjZXNzIGVudmVsb3BlLlxuICAgICAgICAgICAgY29uc3QgYXBwbGllZFJlamVjdGVkID0gYXBwbGllZCA9PT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChhcHBsaWVkUmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgYXBwbHktcHJlZmFiIGZvciBub2RlICR7cm9vdFV1aWR9LCBzbyBpdHMgcmVzdWx0IGlzIG5vdCB0cnVzdHdvcnRoeSBhbmQgbm8gY2hpbGQgbm9kZXMgd2VyZSByZW1vdmVkLiBDb25maXJtIGl0IGlzIGEgcHJlZmFiLWluc3RhbmNlIHJvb3Qgd2l0aCBhIHZhbGlkIGFzc2V0IGxpbmsuYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAocGVyc2lzdGVkID09PSB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgIFRoZSByZWplY3RlZCBhcHBseSBkaWQgcmV3cml0ZSAke3ByZWZhYlBhdGh9IOKAlCBkaWZmIGl0IGFnYWluc3QgZ2l0IGJlZm9yZSByZXRyeWluZy5gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnJyksXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCwgYXBwbGllZFJlamVjdGVkIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocGVyc2lzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYGFwcGx5LXByZWZhYiByZXBvcnRlZCBubyBlcnJvciBidXQgJHtwcmVmYWJQYXRofSB3YXMgbm90IHJld3JpdHRlbi4gVGhlIG5vZGUgbWF5IGhhdmUgbm8gb3ZlcnJpZGVzIHRvIGFwcGx5LCBvciBpdHMgcHJlZmFiIGxpbmsgaXMgc3RhbGUuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBgYXBwbHktcHJlZmFiYCB3cml0ZXMgcHJvcGVydHkgb3ZlcnJpZGVzIGJ1dCBkb2VzIG5vdCByZW1vdmUgYSBjaGlsZCBub2RlXG4gICAgICAgICAgICAvLyBkZWxldGVkIGZyb20gdGhlIGluc3RhbmNlICgjMjEpIOKAlCB0aGUgbXRpbWUgZ3VhcmQgYWJvdmUgY2Fubm90IHNlZSB0aGlzLFxuICAgICAgICAgICAgLy8gYmVjYXVzZSBhIGRlbGV0aW9uIHN0aWxsIHByb2R1Y2VzIG92ZXJyaWRlcyBlbHNld2hlcmUsIHNvIHRoZSBmaWxlIElTXG4gICAgICAgICAgICAvLyByZXdyaXR0ZW4gYW5kIGBwZXJzaXN0ZWRgIGlzIGdlbnVpbmVseSBgdHJ1ZWAuIENvbXBhcmUgdGhlIGxpdmUgaW5zdGFuY2Unc1xuICAgICAgICAgICAgLy8gZmlsZUlkcyBhZ2FpbnN0IHRoZSBmcmVzaGx5LXdyaXR0ZW4gYXNzZXQncyB0byBjYXRjaCB0aGUgc3BlY2lmaWMgZmFpbHVyZVxuICAgICAgICAgICAgLy8gbW9kZSB0aGUgbXRpbWUgY2hlY2sgY2Fubm90OiBhIGNoaWxkIHN0aWxsIHByZXNlbnQgb24gZGlzayB0aGF0IG5vIGxvbmdlclxuICAgICAgICAgICAgLy8gZXhpc3RzIGluIHRoZSBzY2VuZS4gQW55dGhpbmcgZm91bmQgaXMgdGhlbiByZW1vdmVkIGZyb20gdGhlIGFzc2V0LCBzaW5jZVxuICAgICAgICAgICAgLy8gcmVwb3J0aW5nIHRoZSBzdGFsZSBjaGlsZHJlbiBpcyBub3QgdGhlIHNhbWUgYXMgaG9ub3VyaW5nIHRoZSBkZWxldGlvbi5cbiAgICAgICAgICAgIGxldCBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBpZiAocGVyc2lzdGVkID09PSB0cnVlICYmIHByZWZhYlBhdGgpIHtcbiAgICAgICAgICAgICAgICBvcnBoYW5lZEZpbGVJZHMgPSBhd2FpdCB0aGlzLmZpbmRPcnBoYW5lZENoaWxkRmlsZUlkcyhyb290VXVpZCwgcHJlZmFiUGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmVtb3ZlZEZpbGVJZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBpZiAob3JwaGFuZWRGaWxlSWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZW1vdmFsID0gYXdhaXQgdGhpcy5yZW1vdmVPcnBoYW5lZENoaWxkcmVuRnJvbUFzc2V0KFxuICAgICAgICAgICAgICAgICAgICBwcmVmYWJQYXRoIGFzIHN0cmluZywgb3JwaGFuZWRGaWxlSWRzLCByb290VXVpZCwgYXNzZXRVdWlkXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoIXJlbW92YWwuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYGFwcGx5LXByZWZhYiB3cm90ZSAke3ByZWZhYlBhdGh9LCBidXQgaXQgc3RpbGwgY29udGFpbnMgJHtvcnBoYW5lZEZpbGVJZHMubGVuZ3RofSBjaGlsZCBub2RlKHMpIChmaWxlSWQ6ICR7b3JwaGFuZWRGaWxlSWRzLmpvaW4oJywgJyl9KSB0aGF0IG5vIGxvbmdlciBleGlzdCBpbiB0aGUgc2NlbmUgaW5zdGFuY2UuIENvY29zIENyZWF0b3IgMy44LjcncyBhcHBseS1wcmVmYWIgZG9lcyBub3QgcmVtb3ZlIGRlbGV0ZWQgY2hpbGRyZW4sIGFuZCByZW1vdmluZyB0aGVtIGhlcmUgd2FzIGRlY2xpbmVkOiAke3JlbW92YWwuZXJyb3J9LiBUaGUgYXNzZXQgaXMgYnl0ZS1mb3ItYnl0ZSB1bmNoYW5nZWQg4oCUIGRlbGV0ZSBhbmQgcmVjcmVhdGUgdGhlIHByZWZhYiwgb3IgcmVtb3ZlIHRoZSBzdGFsZSBlbnRyaWVzIG1hbnVhbGx5LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQsIG9ycGhhbmVkRmlsZUlkcyB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlbW92ZWRGaWxlSWRzID0gb3JwaGFuZWRGaWxlSWRzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBPbmx5IGV2ZXIgcmVhY2hlZCBvbiBhIE5PTi1yZWplY3RlZCBhcHBseTogYSByZWplY3Rpb24gcmV0dXJucyBhYm92ZS4gS2VlcGluZ1xuICAgICAgICAgICAgLy8gYGFwcGxpZWRSZWplY3RlZGAgaW4gdGhlIHBheWxvYWQgKG5vdyBhbHdheXMgZmFsc2UpIHJhdGhlciB0aGFuIGRyb3BwaW5nIGl0LCBzb1xuICAgICAgICAgICAgLy8gZXhpc3RpbmcgY2FsbGVycyB0aGF0IGJyYW5jaCBvbiB0aGUgZmllbGQga2VlcCB3b3JraW5nIHVuY2hhbmdlZC5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiByZW1vdmVkRmlsZUlkcy5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgID8gYFByZWZhYiB1cGRhdGVkIHN1Y2Nlc3NmdWxseTsgcmVtb3ZlZCAke3JlbW92ZWRGaWxlSWRzLmxlbmd0aH0gY2hpbGQgbm9kZShzKSBhcHBseS1wcmVmYWIgbGVmdCBiZWhpbmRgXG4gICAgICAgICAgICAgICAgICAgIDogJ1ByZWZhYiB1cGRhdGVkIHN1Y2Nlc3NmdWxseScsXG4gICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkLCBhcHBsaWVkUmVqZWN0ZWQsIHJlbW92ZWRGaWxlSWRzIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGZpbGVJZHMgb2YgcHJlZmFiLXRyYWNrZWQgbm9kZXMgcHJlc2VudCBpbiB0aGUgd3JpdHRlbiBhc3NldCBidXQgYWJzZW50XG4gICAgICogZnJvbSB0aGUgbGl2ZSBzY2VuZSBpbnN0YW5jZSDigJQgY2hpbGRyZW4gYGFwcGx5LXByZWZhYmAgZmFpbGVkIHRvIHJlbW92ZSAoIzIxKS5cbiAgICAgKiBEZXRlY3Rpb24gaXMgYmVzdC1lZmZvcnQ6IGFueSBmYWlsdXJlIHJldHVybnMgbm8gb3JwaGFucyByYXRoZXIgdGhhbiBhIGZhbHNlXG4gICAgICogcG9zaXRpdmUsIHNpbmNlIHRoaXMgY2hlY2sgbXVzdCBuZXZlciBtYXNrIGEgZ2VudWluZSBzdWNjZXNzLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZmluZE9ycGhhbmVkQ2hpbGRGaWxlSWRzKHJvb3RVdWlkOiBzdHJpbmcsIHByZWZhYlBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGxpdmVGaWxlSWRzID0gYXdhaXQgdGhpcy5jb2xsZWN0SW5zdGFuY2VGaWxlSWRzKHJvb3RVdWlkKTtcbiAgICAgICAgICAgIGlmIChsaXZlRmlsZUlkcy5zaXplID09PSAwKSByZXR1cm4gW107XG4gICAgICAgICAgICBjb25zdCBhc3NldERhdGEgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhwcmVmYWJQYXRoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXNzZXREYXRhKSkgcmV0dXJuIFtdO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRGaWxlSWRzID0gdGhpcy5jb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhhc3NldERhdGEpO1xuICAgICAgICAgICAgcmV0dXJuIFsuLi5hc3NldEZpbGVJZHNdLmZpbHRlcihpZCA9PiAhbGl2ZUZpbGVJZHMuaGFzKGlkKSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2FsayBhIGxpdmUgcHJlZmFiLWluc3RhbmNlIHN1YnRyZWUgYW5kIGNvbGxlY3QgdGhlIGBfX3ByZWZhYl9fLmZpbGVJZGAgb2YgZXZlcnkgbm9kZS5cbiAgICAgKlxuICAgICAqIGBxdWVyeS1ub2RlYCByZXR1cm5zIGBjaGlsZHJlbmAgYXMgcHJvcGVydHkgZHVtcHMgKGB7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSB9YCksIG5vdFxuICAgICAqIHV1aWQgc3RyaW5nczsgcGFzc2luZyB0aGUgZHVtcCBvbiBhcyBhIHV1aWQgcmVhY2hlZCBubyBjaGlsZCwgc28gZXZlcnkgbGl2ZSBjaGlsZFxuICAgICAqIGxvb2tlZCBvcnBoYW5lZCBhbmQgd2FzIGRlbGV0ZWQgZnJvbSB0aGUgYXNzZXQuIEFueSBub2RlIHRoYXQgY2Fubm90IGJlIHJlc29sdmVkIG9yXG4gICAgICogY2FycmllcyBubyBmaWxlSWQgbWFrZXMgdGhlIHdhbGsgaW5jb21wbGV0ZSwgYW5kIGFuIGluY29tcGxldGUgd2FsayByZXR1cm5zIGFuIEVNUFRZXG4gICAgICogc2V0IOKAlCB0aGUgY2FsbGVyIHRoZW4gcmVtb3ZlcyBub3RoaW5nIHJhdGhlciB0aGFuIGRlbGV0aW5nIGEgY2hpbGQgaXQgZmFpbGVkIHRvIHNlZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZyk6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgICAgICAgY29uc3QgZmlsZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBsZXQgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICBjb25zdCBjaGlsZFV1aWRPZiA9IChlbnRyeTogYW55KTogc3RyaW5nID0+IHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSByZXR1cm4gZW50cnk7XG4gICAgICAgICAgICBpZiAoZW50cnkgJiYgdHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgZW50cnkudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBlbnRyeS51dWlkO1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeS52YWx1ZSAmJiB0eXBlb2YgZW50cnkudmFsdWUudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBlbnRyeS52YWx1ZS51dWlkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCB2aXNpdCA9IGFzeW5jICh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIGlmICghY29tcGxldGUpIHJldHVybjtcbiAgICAgICAgICAgIGlmICghdXVpZCkgeyBjb21wbGV0ZSA9IGZhbHNlOyByZXR1cm47IH1cbiAgICAgICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIGNvbXBsZXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gbm9kZURhdGE/Ll9fcHJlZmFiX18/LmZpbGVJZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZUlkICE9PSAnc3RyaW5nJyB8fCAhZmlsZUlkKSB7IGNvbXBsZXRlID0gZmFsc2U7IHJldHVybjsgfVxuICAgICAgICAgICAgZmlsZUlkcy5hZGQoZmlsZUlkKTtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuOiBhbnlbXSA9IEFycmF5LmlzQXJyYXkobm9kZURhdGEuY2hpbGRyZW4pID8gbm9kZURhdGEuY2hpbGRyZW4gOiBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIGF3YWl0IHZpc2l0KGNoaWxkVXVpZE9mKGNoaWxkKSk7XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IHZpc2l0KHJvb3RVdWlkKTtcbiAgICAgICAgcmV0dXJuIGNvbXBsZXRlID8gZmlsZUlkcyA6IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIH1cblxuICAgIC8qKiBFeHRyYWN0IGV2ZXJ5IGBjYy5Ob2RlYCBlbnRyeSdzIGZpbGVJZCBmcm9tIGEgd3JpdHRlbiBgLnByZWZhYmAgYXNzZXQncyBKU09OIGFycmF5LiAqL1xuICAgIHByaXZhdGUgY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMocHJlZmFiRGF0YTogYW55W10pOiBTZXQ8c3RyaW5nPiB7XG4gICAgICAgIGNvbnN0IGZpbGVJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmZpbGVJZE9mTm9kZShwcmVmYWJEYXRhLCBpbmRleCk7XG4gICAgICAgICAgICBpZiAoZmlsZUlkICE9PSBudWxsKSBmaWxlSWRzLmFkZChmaWxlSWQpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmaWxlSWRzO1xuICAgIH1cblxuICAgIC8qKiBUaGUgZmlsZUlkIHJlY29yZGVkIG9uIHRoZSBgY2MuTm9kZWAgYXQgYGluZGV4YCwgb3IgbnVsbCB3aGVuIGl0IGhhcyBub25lLiAqL1xuICAgIHByaXZhdGUgZmlsZUlkT2ZOb2RlKHByZWZhYkRhdGE6IGFueVtdLCBpbmRleDogbnVtYmVyKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IGVudHJ5ID0gcHJlZmFiRGF0YVtpbmRleF07XG4gICAgICAgIGlmICghZW50cnkgfHwgZW50cnkuX190eXBlX18gIT09ICdjYy5Ob2RlJykgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IHByZWZhYkluZm9JbmRleCA9IGVudHJ5Ll9wcmVmYWI/Ll9faWRfXztcbiAgICAgICAgaWYgKHR5cGVvZiBwcmVmYWJJbmZvSW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgZmlsZUlkID0gcHJlZmFiRGF0YVtwcmVmYWJJbmZvSW5kZXhdPy5maWxlSWQ7XG4gICAgICAgIHJldHVybiB0eXBlb2YgZmlsZUlkID09PSAnc3RyaW5nJyAmJiBmaWxlSWQgPyBmaWxlSWQgOiBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZmVyZW5jZSBhcnJheXMgd2hvc2UgZWxlbWVudCBvcmRlciBpcyBzdHJ1Y3R1cmFsIOKAlCBhIHJlbW92ZWQgZW50cnkgbXVzdCBiZSBzcGxpY2VkXG4gICAgICogb3V0IG9mIHRoZW0sIG5ldmVyIGxlZnQgYmVoaW5kIGFzIGEgbnVsbCBob2xlLlxuICAgICAqL1xuICAgIHByaXZhdGUgcmVhZG9ubHkgc3RydWN0dXJhbFJlZkFycmF5cyA9IFsnX2NoaWxkcmVuJywgJ19jb21wb25lbnRzJywgJ25lc3RlZFByZWZhYkluc3RhbmNlUm9vdHMnLCAndGFyZ2V0T3ZlcnJpZGVzJ107XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgdGhlIG9ycGhhbmVkIGNoaWxkIHN1YnRyZWVzIGBhcHBseS1wcmVmYWJgIGxlZnQgYmVoaW5kLCB0aGVuIGhhbmQgdGhlIHJlc3VsdFxuICAgICAqIHRvIHRoZSBlZGl0b3IgZm9yIGFjY2VwdGFuY2UgKCMyMSkuXG4gICAgICpcbiAgICAgKiBUaHJlZSBnYXRlcyBndWFyZCB0aGUgcmV3cml0ZSwgYW5kIHRoZSBwcmUtc3VyZ2VyeSBieXRlcyBhcmUgcmVzdG9yZWQgYXQgYW55IG9mIHRoZW06XG4gICAgICogdGhlIGdyYXBoIHJld3JpdGUgcmVmdXNlcyBhIGxheW91dCBpdCBkb2VzIG5vdCByZWNvZ25pc2UsIHRoZSByZXdyaXR0ZW4gZ3JhcGggaXNcbiAgICAgKiB2YWxpZGF0ZWQgYmVmb3JlIGl0IGlzIHdyaXR0ZW4sIGFuZCBgYXNzZXQtZGI6cmVpbXBvcnQtYXNzZXRgIGlzIHRoZSBlbmdpbmUncyBvd25cbiAgICAgKiB2ZXJkaWN0IG9uIHRoZSByZXN1bHQg4oCUIGFuIGludGVybmFsbHkgY29uc2lzdGVudCBncmFwaCBjYW4gc3RpbGwgYmUgb25lIHRoZSBpbXBvcnRlclxuICAgICAqIHJlamVjdHMsIGFuZCBvbmx5IHRoZSBlZGl0b3IgY2FuIHNheSBzby4gQSBkZWNsaW5lZCByZW1vdmFsIGxlYXZlcyB0aGUgY2FsbGVyIGV4YWN0bHlcbiAgICAgKiB3aGVyZSBpdCBzdG9vZCBiZWZvcmUgdGhpcyBtZXRob2QgZXhpc3RlZDogYSBoYXJkIGZhaWx1cmUgbmFtaW5nIHRoZSBzdGFsZSBmaWxlSWRzLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVtb3ZlT3JwaGFuZWRDaGlsZHJlbkZyb21Bc3NldChcbiAgICAgICAgcHJlZmFiUGF0aDogc3RyaW5nLFxuICAgICAgICBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdLFxuICAgICAgICByb290VXVpZDogc3RyaW5nLFxuICAgICAgICBhc3NldFV1aWQ6IHN0cmluZ1xuICAgICk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PiB7XG4gICAgICAgIGxldCBvcmlnaW5hbFRleHQ6IHN0cmluZztcbiAgICAgICAgbGV0IHByZWZhYkRhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG9yaWdpbmFsVGV4dCA9IGZzLnJlYWRGaWxlU3luYyhwcmVmYWJQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgICAgIHByZWZhYkRhdGEgPSBKU09OLnBhcnNlKG9yaWdpbmFsVGV4dCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgYXNzZXQgY291bGQgbm90IGJlIHJlLXJlYWQgKCR7ZXJyLm1lc3NhZ2V9KWAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJlZmFiRGF0YSkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3RoZSBhc3NldCBpcyBub3QgYSBzZXJpYWxpemVkIGVudHJ5IGFycmF5JyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGl2ZUZpbGVJZHMgPSBhd2FpdCB0aGlzLmNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQpO1xuICAgICAgICBjb25zdCBmaWxlSWRzQmVmb3JlID0gdGhpcy5jb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhwcmVmYWJEYXRhKTtcbiAgICAgICAgY29uc3QgcmV3cml0dGVuID0gdGhpcy5wcnVuZU9ycGhhbmVkTm9kZXMocHJlZmFiRGF0YSwgb3JwaGFuZWRGaWxlSWRzLCBsaXZlRmlsZUlkcyk7XG4gICAgICAgIGlmICghcmV3cml0dGVuKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICd0aGUgYXNzZXQgZ3JhcGggZG9lcyBub3QgbWF0Y2ggdGhlIGxheW91dCB0aGlzIHJlbW92YWwgdW5kZXJzdGFuZHMnIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbnZhbGlkID0gdGhpcy52YWxpZGF0ZVByZWZhYkdyYXBoKHJld3JpdHRlbiwgb3JwaGFuZWRGaWxlSWRzLCBmaWxlSWRzQmVmb3JlKTtcbiAgICAgICAgaWYgKGludmFsaWQpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYHRoZSByZXdyaXR0ZW4gZ3JhcGggZmFpbGVkIHZhbGlkYXRpb24gKCR7aW52YWxpZH0pYCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocHJlZmFiUGF0aCwgSlNPTi5zdHJpbmdpZnkocmV3cml0dGVuLCBudWxsLCBvcmlnaW5hbFRleHQuaW5jbHVkZXMoJ1xcbicpID8gMiA6IDApLCAndXRmLTgnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYHRoZSByZXdyaXR0ZW4gYXNzZXQgY291bGQgbm90IGJlIHdyaXR0ZW4gKCR7ZXJyLm1lc3NhZ2V9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBpbXBvcnRlZDogYm9vbGVhbjtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGltcG9ydGVkID0gKGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgYXNzZXRVdWlkKSkgIT09IGZhbHNlO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGltcG9ydGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbXBvcnRlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXN0b3JlUHJlZmFiRmlsZShwcmVmYWJQYXRoLCBvcmlnaW5hbFRleHQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGVkaXRvciByZWplY3RlZCB0aGUgcmV3cml0dGVuIGFzc2V0IG9uIHJlaW1wb3J0JyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3Vydml2b3JzID0gYXdhaXQgdGhpcy5maW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQsIHByZWZhYlBhdGgpO1xuICAgICAgICBpZiAoc3Vydml2b3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZVByZWZhYkZpbGUocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYHJlbW92YWwgcmFuIGJ1dCBmaWxlSWQocykgJHtzdXJ2aXZvcnMuam9pbignLCAnKX0gYXJlIHN0aWxsIG9ycGhhbmVkYCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgIH1cblxuICAgIC8qKiBQdXQgdGhlIHByZS1zdXJnZXJ5IGJ5dGVzIGJhY2ssIHNvIGEgZGVjbGluZWQgcmVtb3ZhbCBsZWF2ZXMgdGhlIGFzc2V0IHVudG91Y2hlZC4gKi9cbiAgICBwcml2YXRlIHJlc3RvcmVQcmVmYWJGaWxlKHByZWZhYlBhdGg6IHN0cmluZywgb3JpZ2luYWxUZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0LCAndXRmLTgnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBOb3RoaW5nIGZ1cnRoZXIgdG8gZG8gaGVyZSDigJQgdGhlIGNhbGxlciByZXBvcnRzIHRoZSBmYWlsdXJlIGVpdGhlciB3YXkuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcm9wIGV2ZXJ5IG9ycGhhbmVkIGNoaWxkIHN1YnRyZWUgZnJvbSBhIHNlcmlhbGl6ZWQgcHJlZmFiIGFycmF5IGFuZCByZS1pbmRleCB0aGUgd2hvbGVcbiAgICAgKiBncmFwaC4gUmV0dXJucyBudWxsIOKAlCBjaGFuZ2luZyBub3RoaW5nIOKAlCB3aGVuZXZlciB0aGUgZ3JhcGggZG9lcyBub3QgbWF0Y2ggd2hhdCB0aGlzXG4gICAgICogcmV3cml0ZSByZWxpZXMgb24sIHJhdGhlciB0aGFuIHByb2R1Y2luZyBhbiBhc3NldCBub2JvZHkgY2FuIGxvYWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBwcnVuZU9ycGhhbmVkTm9kZXMocHJlZmFiRGF0YTogYW55W10sIG9ycGhhbmVkRmlsZUlkczogc3RyaW5nW10sIGxpdmVGaWxlSWRzOiBTZXQ8c3RyaW5nPik6IGFueVtdIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleEJ5RmlsZUlkID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmZpbGVJZE9mTm9kZShwcmVmYWJEYXRhLCBpbmRleCk7XG4gICAgICAgICAgICBpZiAoZmlsZUlkICE9PSBudWxsICYmICFub2RlSW5kZXhCeUZpbGVJZC5oYXMoZmlsZUlkKSkgbm9kZUluZGV4QnlGaWxlSWQuc2V0KGZpbGVJZCwgaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtb3ZlZCA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICAgICAgICBjb25zdCBwZW5kaW5nOiBudW1iZXJbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiBvcnBoYW5lZEZpbGVJZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gbm9kZUluZGV4QnlGaWxlSWQuZ2V0KGZpbGVJZCk7XG4gICAgICAgICAgICAvLyBEZXRlY3Rpb24gYW5kIHJlbW92YWwgZGlzYWdyZWUgYWJvdXQgdGhlIGFzc2V0IOKAlCBkbyBub3QgZ3Vlc3MgYXQgdGhlIGdyYXBoLlxuICAgICAgICAgICAgaWYgKGluZGV4ID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcGVuZGluZy5wdXNoKGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChwZW5kaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IHBlbmRpbmcuc2hpZnQoKSBhcyBudW1iZXI7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMobm9kZUluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gcHJlZmFiRGF0YVtub2RlSW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFub2RlIHx8IG5vZGUuX190eXBlX18gIT09ICdjYy5Ob2RlJykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZW1vdmVkLmFkZChub2RlSW5kZXgpO1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBub2RlLl9wcmVmYWI/Ll9faWRfXztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcHJlZmFiSW5mb0luZGV4ID09PSAnbnVtYmVyJykgcmVtb3ZlZC5hZGQocHJlZmFiSW5mb0luZGV4KTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgQXJyYXkuaXNBcnJheShub2RlLl9jb21wb25lbnRzKSA/IG5vZGUuX2NvbXBvbmVudHMgOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnRJbmRleCAhPT0gJ251bWJlcicpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHJlbW92ZWQuYWRkKGNvbXBvbmVudEluZGV4KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wUHJlZmFiSW5kZXggPSBwcmVmYWJEYXRhW2NvbXBvbmVudEluZGV4XT8uX19wcmVmYWI/Ll9faWRfXztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbXBQcmVmYWJJbmRleCA9PT0gJ251bWJlcicpIHJlbW92ZWQuYWRkKGNvbXBQcmVmYWJJbmRleCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkobm9kZS5fY2hpbGRyZW4pID8gbm9kZS5fY2hpbGRyZW4gOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kZXggPSByZWY/Ll9faWRfXztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkSW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICAvLyBBIGRlc2NlbmRhbnQgb2YgYSBkZWxldGVkIGNoaWxkIGNhbm5vdCBzdGlsbCBiZSBsaXZlIGluIHRoZSBpbnN0YW5jZS4gSWYgb25lXG4gICAgICAgICAgICAgICAgLy8gaXMsIHRoZSBvcnBoYW4gc2V0IGlzIG5vdCB3aGF0IHRoaXMgcmV3cml0ZSBhc3N1bWVzIGFuZCBpdCBtdXN0IG5vdCBwcm9jZWVkLlxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkRmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgY2hpbGRJbmRleCk7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkRmlsZUlkICE9PSBudWxsICYmIGxpdmVGaWxlSWRzLmhhcyhjaGlsZEZpbGVJZCkpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIHBlbmRpbmcucHVzaChjaGlsZEluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocmVtb3ZlZC5zaXplID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBwcnVuZWQ6IGFueVtdID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShwcmVmYWJEYXRhKSk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcnVuZWQubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMoaW5kZXgpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJ1bmVkW2luZGV4XTtcbiAgICAgICAgICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JykgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiB0aGlzLnN0cnVjdHVyYWxSZWZBcnJheXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZW50cnlba2V5XSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGVudHJ5W2tleV0gPSBlbnRyeVtrZXldLmZpbHRlcigoZWxlbWVudDogYW55KSA9PiAhdGhpcy5yZWZlcmVuY2VzUmVtb3ZlZChlbGVtZW50LCByZW1vdmVkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaGF0ZXZlciBzdGlsbCBwb2ludHMgYXQgYSByZW1vdmVkIGVudHJ5IGJlY29tZXMgbnVsbCDigJQgdGhpcyBpcyB0aGUgZGFuZ2xpbmdcbiAgICAgICAgLy8gY29tcG9uZW50IHJlZmVyZW5jZSB0aGUgcmVwb3J0IGNhbGxzIG91dCAoYW4gYE9iamVjdFZpZXcudGlja05vZGVgIGJpbmRpbmcgdG8gYVxuICAgICAgICAvLyBjaGlsZCB0aGF0IG5vIGxvbmdlciBleGlzdHMpLlxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJ1bmVkLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKGluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBwcnVuZWRbaW5kZXhdID0gdGhpcy5udWxsaWZ5UmVtb3ZlZFJlZnMocHJ1bmVkW2luZGV4XSwgcmVtb3ZlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZW1hcCA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXI+KCk7XG4gICAgICAgIGNvbnN0IHN1cnZpdm9yczogYW55W10gPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHBydW5lZC5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkLmhhcyhpbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcmVtYXAuc2V0KGluZGV4LCBzdXJ2aXZvcnMubGVuZ3RoKTtcbiAgICAgICAgICAgIHN1cnZpdm9ycy5wdXNoKHBydW5lZFtpbmRleF0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdXJ2aXZvcnMubWFwKGVudHJ5ID0+IHRoaXMucmVtYXBSZWZzKGVudHJ5LCByZW1hcCkpO1xuICAgIH1cblxuICAgIC8qKiBUcnVlIHdoZW4gYHZhbHVlYCBpcyDigJQgb3IgY29udGFpbnMg4oCUIGFuIGB7IF9faWRfXyB9YCByZWZlcmVuY2UgdG8gYSByZW1vdmVkIGVudHJ5LiAqL1xuICAgIHByaXZhdGUgcmVmZXJlbmNlc1JlbW92ZWQodmFsdWU6IGFueSwgcmVtb3ZlZDogU2V0PG51bWJlcj4pOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUuX19pZF9fID09PSAnbnVtYmVyJykgcmV0dXJuIHJlbW92ZWQuaGFzKHZhbHVlLl9faWRfXyk7XG4gICAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKHZhbHVlKS5zb21lKG5lc3RlZCA9PiB0aGlzLnJlZmVyZW5jZXNSZW1vdmVkKG5lc3RlZCwgcmVtb3ZlZCkpO1xuICAgIH1cblxuICAgIC8qKiBSZXBsYWNlIGV2ZXJ5IGB7IF9faWRfXyB9YCByZWZlcmVuY2UgdG8gYSByZW1vdmVkIGVudHJ5IHdpdGggbnVsbC4gKi9cbiAgICBwcml2YXRlIG51bGxpZnlSZW1vdmVkUmVmcyh2YWx1ZTogYW55LCByZW1vdmVkOiBTZXQ8bnVtYmVyPik6IGFueSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcChlbGVtZW50ID0+IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKGVsZW1lbnQsIHJlbW92ZWQpKTtcbiAgICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gdmFsdWU7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUuX19pZF9fID09PSAnbnVtYmVyJykgcmV0dXJuIHJlbW92ZWQuaGFzKHZhbHVlLl9faWRfXykgPyBudWxsIDogdmFsdWU7XG4gICAgICAgIGNvbnN0IHJld3JpdHRlbjogYW55ID0ge307XG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgbmVzdGVkXSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZSkpIHJld3JpdHRlbltrZXldID0gdGhpcy5udWxsaWZ5UmVtb3ZlZFJlZnMobmVzdGVkLCByZW1vdmVkKTtcbiAgICAgICAgcmV0dXJuIHJld3JpdHRlbjtcbiAgICB9XG5cbiAgICAvKiogUG9pbnQgZXZlcnkgc3Vydml2aW5nIGBfX2lkX19gIGF0IGl0cyBlbnRyeSdzIHNsb3QgaW4gdGhlIGNvbXBhY3RlZCBhcnJheS4gKi9cbiAgICBwcml2YXRlIHJlbWFwUmVmcyh2YWx1ZTogYW55LCByZW1hcDogTWFwPG51bWJlciwgbnVtYmVyPik6IGFueSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcChlbGVtZW50ID0+IHRoaXMucmVtYXBSZWZzKGVsZW1lbnQsIHJlbWFwKSk7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHZhbHVlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSByZW1hcC5nZXQodmFsdWUuX19pZF9fKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0ID09PSB1bmRlZmluZWQgPyBudWxsIDogeyBfX2lkX186IG5leHQgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXdyaXR0ZW46IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIG5lc3RlZF0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSByZXdyaXR0ZW5ba2V5XSA9IHRoaXMucmVtYXBSZWZzKG5lc3RlZCwgcmVtYXApO1xuICAgICAgICByZXR1cm4gcmV3cml0dGVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlamVjdCBhIHJld3JpdHRlbiBncmFwaCBiZWZvcmUgaXQgcmVhY2hlcyBkaXNrLiBSZXR1cm5zIHRoZSBmaXJzdCBwcm9ibGVtIGZvdW5kLCBvclxuICAgICAqIG51bGwgd2hlbiB0aGUgZ3JhcGggaXMgc291bmQg4oCUIHRoaXMgaXMgd2hhdCBtYWtlcyBhIG1pcy1pbmRleGVkIGFzc2V0IGltcG9zc2libGUgdG9cbiAgICAgKiB3cml0ZSByYXRoZXIgdGhhbiBzb21ldGhpbmcgdG8gbm90aWNlIGFmdGVyd2FyZHMuXG4gICAgICovXG4gICAgcHJpdmF0ZSB2YWxpZGF0ZVByZWZhYkdyYXBoKHByZWZhYkRhdGE6IGFueVtdLCByZW1vdmVkRmlsZUlkczogc3RyaW5nW10sIGZpbGVJZHNCZWZvcmU6IFNldDxzdHJpbmc+KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IGRhbmdsaW5nID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYocHJlZmFiRGF0YSwgcHJlZmFiRGF0YS5sZW5ndGgpO1xuICAgICAgICBpZiAoZGFuZ2xpbmcgIT09IG51bGwpIHJldHVybiBgX19pZF9fICR7ZGFuZ2xpbmd9IGlzIG91dCBvZiByYW5nZWA7XG5cbiAgICAgICAgLy8gSWRlbnRpdHksIG5vdCBjb3VudDogZXhhY3RseSB0aGUgb3JwaGFucyBnbywgYW5kIG5vdGhpbmcgZWxzZSBkb2VzLlxuICAgICAgICBjb25zdCByZW1haW5pbmcgPSB0aGlzLmNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGEpO1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiByZW1vdmVkRmlsZUlkcykge1xuICAgICAgICAgICAgaWYgKHJlbWFpbmluZy5oYXMoZmlsZUlkKSkgcmV0dXJuIGBvcnBoYW5lZCBmaWxlSWQgJHtmaWxlSWR9IHN1cnZpdmVkIHJlbW92YWxgO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZmlsZUlkIG9mIGZpbGVJZHNCZWZvcmUpIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkRmlsZUlkcy5pbmNsdWRlcyhmaWxlSWQpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmICghcmVtYWluaW5nLmhhcyhmaWxlSWQpKSByZXR1cm4gYGZpbGVJZCAke2ZpbGVJZH0gd2FzIHJlbW92ZWQgYnV0IHNob3VsZCBoYXZlIGJlZW4ga2VwdGA7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJlZmFiRGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJlZmFiRGF0YVtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuTm9kZScpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgQXJyYXkuaXNBcnJheShlbnRyeS5fY2hpbGRyZW4pID8gZW50cnkuX2NoaWxkcmVuIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGBub2RlICR7aW5kZXh9IGhhcyBhIG1hbGZvcm1lZCBfY2hpbGRyZW4gZW50cnlgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gcHJlZmFiRGF0YVtjaGlsZEluZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAoIWNoaWxkIHx8IGNoaWxkLl9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBgbm9kZSAke2luZGV4fSBsaXN0cyBhIG5vbi1ub2RlIGNoaWxkIGF0ICR7Y2hpbGRJbmRleH1gO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZC5fcGFyZW50ICYmIGNoaWxkLl9wYXJlbnQuX19pZF9fICE9PSBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYG5vZGUgJHtjaGlsZEluZGV4fSBkb2VzIG5vdCBwb2ludCBiYWNrIGF0IHBhcmVudCAke2luZGV4fWA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgQXJyYXkuaXNBcnJheShlbnRyeS5fY29tcG9uZW50cykgPyBlbnRyeS5fY29tcG9uZW50cyA6IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50SW5kZXggPSByZWY/Ll9faWRfXztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbXBvbmVudEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGBub2RlICR7aW5kZXh9IGhhcyBhIG1hbGZvcm1lZCBfY29tcG9uZW50cyBlbnRyeWA7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnQpIHJldHVybiBgbm9kZSAke2luZGV4fSBsaXN0cyBhIG1pc3NpbmcgY29tcG9uZW50IGF0ICR7Y29tcG9uZW50SW5kZXh9YDtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Lm5vZGUgJiYgY29tcG9uZW50Lm5vZGUuX19pZF9fICE9PSBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYGNvbXBvbmVudCAke2NvbXBvbmVudEluZGV4fSBkb2VzIG5vdCBwb2ludCBiYWNrIGF0IG5vZGUgJHtpbmRleH1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogVGhlIGZpcnN0IGBfX2lkX19gIG91dHNpZGUgYFswLCBsZW5ndGgpYCBhbnl3aGVyZSBpbiB0aGUgZ3JhcGgsIG9yIG51bGwgd2hlbiBhbGwgcmVzb2x2ZS4gKi9cbiAgICBwcml2YXRlIGZpbmREYW5nbGluZ1JlZih2YWx1ZTogYW55LCBsZW5ndGg6IG51bWJlcik6IG51bWJlciB8IG51bGwge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYoZWxlbWVudCwgbGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBpZiAoZm91bmQgIT09IG51bGwpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUuX19pZF9fID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSB2YWx1ZS5fX2lkX187XG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyLmlzSW50ZWdlcihpZCkgJiYgaWQgPj0gMCAmJiBpZCA8IGxlbmd0aCA/IG51bGwgOiBpZDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IG5lc3RlZCBvZiBPYmplY3QudmFsdWVzKHZhbHVlKSkge1xuICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLmZpbmREYW5nbGluZ1JlZihuZXN0ZWQsIGxlbmd0aCk7XG4gICAgICAgICAgICBpZiAoZm91bmQgIT09IG51bGwpIHJldHVybiBmb3VuZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByZWZhYkluZm9CeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gYHF1ZXJ5LWFzc2V0LW1ldGFgIGNhcnJpZXMgbm8gYHVybGAvYG5hbWVgL3RpbWVzdGFtcHMg4oCUIHJlYWRpbmcgdGhlbSBvZmYgdGhlXG4gICAgICAgIC8vIG1ldGEgcmVjb3JkIHByb2R1Y2VkIGFuIGFsbC1lbXB0eSBQcmVmYWJJbmZvIHRoYXQgc3RpbGwgcmVwb3J0ZWQgc3VjY2VzcyAoIzI1KS5cbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlQXNzZXQodXVpZCk7XG4gICAgICAgIGlmIChyZXNvbHZlZC5lcnJvcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiByZXNvbHZlZC5lcnJvciB9O1xuICAgICAgICBpZiAoIXJlc29sdmVkLmluZm8pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByZWZhYiBub3QgZm91bmQ6ICR7dXVpZH1gIH07XG5cbiAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gcmVzb2x2ZWQuaW5mbztcbiAgICAgICAgY29uc3QgdXJsOiBzdHJpbmcgPSBhc3NldEluZm8udXJsIHx8ICcnO1xuICAgICAgICBjb25zdCBzdGF0cyA9IHJlc29sdmVkLmZpbGVQYXRoID8gdGhpcy5zdGF0VGltZXMocmVzb2x2ZWQuZmlsZVBhdGgpIDogbnVsbDtcbiAgICAgICAgY29uc3QgaW5mbzogUHJlZmFiSW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgdXVpZDogYXNzZXRJbmZvLnV1aWQgfHwgdXVpZCxcbiAgICAgICAgICAgIHBhdGg6IHVybCxcbiAgICAgICAgICAgIGZvbGRlcjogdXJsID8gdXJsLnN1YnN0cmluZygwLCB1cmwubGFzdEluZGV4T2YoJy8nKSkgOiAnJyxcbiAgICAgICAgICAgIGNyZWF0ZVRpbWU6IHN0YXRzPy5jcmVhdGVUaW1lLFxuICAgICAgICAgICAgbW9kaWZ5VGltZTogc3RhdHM/Lm1vZGlmeVRpbWVcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyAuLi5pbmZvLCBmaWxlOiByZXNvbHZlZC5maWxlUGF0aCB9IH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0VGltZXMoZmlsZVBhdGg6IHN0cmluZyk6IHsgY3JlYXRlVGltZTogc3RyaW5nOyBtb2RpZnlUaW1lOiBzdHJpbmcgfSB8IG51bGwge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcyA9IGZzLnN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiB7IGNyZWF0ZVRpbWU6IHMuYmlydGh0aW1lLnRvSVNPU3RyaW5nKCksIG1vZGlmeVRpbWU6IHMubXRpbWUudG9JU09TdHJpbmcoKSB9O1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVByZWZhYkJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBFYWNoIHN0YWdlIHJlcG9ydHMgaXRzZWxmLiBUaGUgb2xkIHNpbmdsZSBvdXRlciBjYXRjaCBjb2xsYXBzZWQgZXZlcnkgZmFpbHVyZVxuICAgICAgICAvLyBpbnRvIGBFcnJvciB2YWxpZGF0aW5nIHByZWZhYjogRXJyb3I6IHBhcmFtZXRlciBlcnJvcmAsIHdoaWNoIGhpZCB0aGF0IHRoZVxuICAgICAgICAvLyByZWplY3RlZCBjYWxsIHdhcyBgcXVlcnktcGF0aCgnJylgIOKAlCBgcXVlcnktYXNzZXQtbWV0YWAgbmV2ZXIgcmV0dXJucyBhIGB1cmxgXG4gICAgICAgIC8vIHRvIHJlc29sdmUsIHNvIHRoZSBwYXRoIGxvb2t1cCB3YXMgYWx3YXlzIGhhbmRlZCBhbiBlbXB0eSBzdHJpbmcgKCMyNSkuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHV1aWQpO1xuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIHZhbGlkYXRpbmcgcHJlZmFiOiAke3Jlc29sdmVkLmVycm9yfWAgfTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5maWxlUGF0aCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ291bGQgbm90IHJlc29sdmUgcHJlZmFiIGZpbGUgcGF0aCBvbiBkaXNrJyB9O1xuXG4gICAgICAgIGxldCBjb250ZW50OiBzdHJpbmc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHJlc29sdmVkLmZpbGVQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHJlYWQgcHJlZmFiIGZpbGU6ICR7ZXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJlZmFiRGF0YTogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJlZmFiRGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnUHJlZmFiIGZpbGUgZm9ybWF0IGVycm9yOiBjYW5ub3QgcGFyc2UgSlNPTicgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSB0aGlzLmNyZWF0aW9uU2VydmljZS52YWxpZGF0ZVByZWZhYkZvcm1hdChwcmVmYWJEYXRhKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgaXNWYWxpZDogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkLCBpc3N1ZXM6IHZhbGlkYXRpb25SZXN1bHQuaXNzdWVzLFxuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogdmFsaWRhdGlvblJlc3VsdC5ub2RlQ291bnQsIGNvbXBvbmVudENvdW50OiB2YWxpZGF0aW9uUmVzdWx0LmNvbXBvbmVudENvdW50LFxuICAgICAgICAgICAgICAgIHVybDogcmVzb2x2ZWQudXJsLCBmaWxlOiByZXNvbHZlZC5maWxlUGF0aCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiB2YWxpZGF0aW9uUmVzdWx0LmlzVmFsaWQgPyAnUHJlZmFiIGZvcm1hdCBpcyB2YWxpZCcgOiAnUHJlZmFiIGZvcm1hdCBoYXMgaXNzdWVzJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZHVwbGljYXRlUHJlZmFiQnlVdWlkKGFyZ3M6IHsgdXVpZDogc3RyaW5nOyBuZXdOYW1lPzogc3RyaW5nOyB0YXJnZXREaXI/OiBzdHJpbmcgfSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIFByZWZhYiBkdXBsaWNhdGlvbiByZXF1aXJlcyBjb21wbGV4IHNlcmlhbGl6YXRpb24g4oCUIG5vdCBhdmFpbGFibGUgcHJvZ3JhbW1hdGljYWxseVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogJ1ByZWZhYiBkdXBsaWNhdGlvbiBpcyBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHknLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdUbyBkdXBsaWNhdGUgYSBwcmVmYWIsIHVzZSB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3I6XFxuMS4gU2VsZWN0IHRoZSBwcmVmYWIgaW4gdGhlIEFzc2V0IEJyb3dzZXJcXG4yLiBSaWdodC1jbGljayBhbmQgc2VsZWN0IENvcHlcXG4zLiBQYXN0ZSBpbiB0aGUgdGFyZ2V0IGxvY2F0aW9uJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3RvcmUgKGEuay5hLiByZXZlcnQpIGEgcHJlZmFiIGluc3RhbmNlIHRvIGl0cyBhc3NldCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEJhY2tzIGJvdGggYGFjdGlvbj1yZXN0b3JlYCBhbmQgYGFjdGlvbj1yZXZlcnRgLiBDb2NvcyBDcmVhdG9yIDMuOC43IGV4cG9zZXNcbiAgICAgKiBubyBgc2NlbmU6cmV2ZXJ0LXByZWZhYmAgbWVzc2FnZSBhdCBhbGwg4oCUIGByZXN0b3JlLXByZWZhYmAgaXMgd2hhdCB0aGUgZWRpdG9yXG4gICAgICogaXRzZWxmIHVzZXMgZm9yIHRoZSBpbnNwZWN0b3IncyBSZXZlcnQgYnV0dG9uICgjMTMpLiBJdCB0YWtlcyBwb3NpdGlvbmFsXG4gICAgICogYChyb290VXVpZCwgYXNzZXRVdWlkKWAsIHJldHVybnMgYSBib29sZWFuLCBhbmQgcmVjb3JkcyBpdHMgb3duIHVuZG8gZW50cnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZDogc3RyaW5nLCBhc3NldFV1aWQ/OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdub2RlVXVpZCBpcyByZXF1aXJlZCcgfTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghY29udGV4dC5zdWNjZXNzKSByZXR1cm4gY29udGV4dDtcblxuICAgICAgICAgICAgY29uc3Qgcm9vdFV1aWQgPSBjb250ZXh0LnJvb3RVdWlkO1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRBc3NldFV1aWQgPSBhc3NldFV1aWQgfHwgY29udGV4dC5hc3NldFV1aWQ7XG4gICAgICAgICAgICBpZiAoIXJlc29sdmVkQXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ291bGQgbm90IHJlc29sdmUgdGhlIHByZWZhYiBhc3NldCBmb3Igbm9kZSAke25vZGVVdWlkfS4gUGFzcyBhc3NldFV1aWQgZXhwbGljaXRseS5gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3RvcmVkID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCByb290VXVpZCwgcmVzb2x2ZWRBc3NldFV1aWQpO1xuICAgICAgICAgICAgaWYgKHJlc3RvcmVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYEVkaXRvciByZWplY3RlZCByZXN0b3JlLXByZWZhYiBmb3Igbm9kZSAke3Jvb3RVdWlkfS4gQ29uZmlybSBpdCBpcyBhIHByZWZhYi1pbnN0YW5jZSByb290IHdpdGggYSB2YWxpZCBhc3NldCBsaW5rLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQ6IHJlc29sdmVkQXNzZXRVdWlkIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQ6IHJlc29sdmVkQXNzZXRVdWlkIH0sXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZhYiBpbnN0YW5jZSByZXN0b3JlZCBmcm9tIGFzc2V0IHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZXN0b3JlIHByZWZhYiBub2RlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgfVxufVxuIl19