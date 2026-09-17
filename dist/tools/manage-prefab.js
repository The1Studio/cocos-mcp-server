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
            const appliedRejected = applied === false;
            if (appliedRejected && persisted !== true) {
                return {
                    success: false,
                    error: `Editor rejected apply-prefab for node ${rootUuid}. Confirm it is a prefab-instance root with a valid asset link.`,
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted }
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
            return {
                success: true,
                message: appliedRejected
                    ? (removedFileIds.length > 0
                        ? `Prefab updated successfully despite apply-prefab reporting rejection; removed ${removedFileIds.length} child node(s) apply-prefab left behind`
                        : `Prefab updated successfully; apply-prefab reported rejection but ${prefabPath} was rewritten`)
                    : (removedFileIds.length > 0
                        ? `Prefab updated successfully; removed ${removedFileIds.length} child node(s) apply-prefab left behind`
                        : 'Prefab updated successfully'),
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
    /** Walk a live prefab-instance subtree and collect the `__prefab__.fileId` of every node. */
    async collectInstanceFileIds(rootUuid) {
        const fileIds = new Set();
        const visit = async (uuid) => {
            var _a;
            let nodeData;
            try {
                nodeData = await Editor.Message.request('scene', 'query-node', uuid);
            }
            catch (_b) {
                return;
            }
            if (!nodeData)
                return;
            const fileId = (_a = nodeData.__prefab__) === null || _a === void 0 ? void 0 : _a.fileId;
            if (typeof fileId === 'string' && fileId)
                fileIds.add(fileId);
            const children = Array.isArray(nodeData.children) ? nodeData.children : [];
            for (const childUuid of children)
                await visit(childUuid);
        };
        await visit(rootUuid);
        return fileIds;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdXNCQUF1c0IsQ0FBQztRQUN0dEIsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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QUFFLENBQUM7Z0JBQ3JCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSwrQ0FBK0MsUUFBUSw4QkFBOEIsRUFBRSxDQUFDO1lBQzVILENBQUM7WUFFRCxNQUFNLFFBQVEsR0FBRyxNQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBZSxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUMvRyxJQUFJLFFBQVEsS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDckIsT0FBTztvQkFDSCxPQUFPLEVBQUUsS0FBSztvQkFDZCxLQUFLLEVBQUUsMkNBQTJDLFFBQVEsaUVBQWlFO29CQUMzSCxJQUFJLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsRUFBRTtpQkFDN0QsQ0FBQztZQUNOLENBQUM7WUFDRCxPQUFPO2dCQUNILE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFO2dCQUMxRCxPQUFPLEVBQUUsa0RBQWtEO2FBQzlELENBQUM7UUFDTixDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsa0NBQWtDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1FBQ3hGLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUE1NEJELG9DQTQ0QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCwgUHJlZmFiSW5mbyB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IG5vcm1hbGl6ZVZlYzMgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBQcmVmYWJDcmVhdGlvblNlcnZpY2UgfSBmcm9tICcuL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZSc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VQcmVmYWIgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBjcmVhdGlvblNlcnZpY2UgPSBuZXcgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlKCk7XG5cbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9wcmVmYWInO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBwcmVmYWJzIGluIHRoZSBwcm9qZWN0LiBBY3Rpb25zOiBsaXN0PWxpc3QgYWxsIHByZWZhYnMsIGxvYWQ9bG9hZCBwcmVmYWIgYnkgcGF0aCwgaW5zdGFudGlhdGU9aW5zdGFudGlhdGUgcHJlZmFiIGluIHNjZW5lLCBjcmVhdGU9Y3JlYXRlIHByZWZhYiBmcm9tIG5vZGUsIHVwZGF0ZT1hcHBseSBub2RlIGNoYW5nZXMgdG8gdGhlIHByZWZhYiBhc3NldCAodmVyaWZpZXMgdGhlIGFzc2V0IHdhcyB3cml0dGVuLCBhbmQgcmVtb3ZlcyBjaGlsZHJlbiBkZWxldGVkIGZyb20gdGhlIGluc3RhbmNlIHRoYXQgYXBwbHktcHJlZmFiIGxlYXZlcyBiZWhpbmQpLCByZXZlcnQ9cmV2ZXJ0IHByZWZhYiBpbnN0YW5jZSB0byB0aGUgYXNzZXQgc3RhdGUgKGFsaWFzIG9mIHJlc3RvcmUpLCBnZXRfaW5mbz1nZXQgcHJlZmFiIGRldGFpbHMsIHZhbGlkYXRlPXZhbGlkYXRlIHByZWZhYiBmaWxlIGZvcm1hdCwgZHVwbGljYXRlPWR1cGxpY2F0ZSBhIHByZWZhYiwgcmVzdG9yZT1yZXN0b3JlIHByZWZhYiBub2RlIHVzaW5nIGFzc2V0ICh3aXRoIHVuZG8pLiBGb3IgdXBkYXRlL3JldmVydC9yZXN0b3JlLCBub2RlVXVpZCBtYXkgYmUgYW55IG5vZGUgaW4gdGhlIGluc3RhbmNlIOKAlCB0aGUgaW5zdGFuY2Ugcm9vdCBpcyByZXNvbHZlZCBhdXRvbWF0aWNhbGx5LiBQcmVyZXF1aXNpdGVzOiBwcm9qZWN0IG11c3QgYmUgb3BlbiBpbiBDb2NvcyBDcmVhdG9yLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnbGlzdCcsICdsb2FkJywgJ2luc3RhbnRpYXRlJywgJ2NyZWF0ZScsICd1cGRhdGUnLCAncmV2ZXJ0JywgJ2dldF9pbmZvJywgJ3ZhbGlkYXRlJywgJ2R1cGxpY2F0ZScsICdyZXN0b3JlJ107XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnbGlzdCcsICdsb2FkJywgJ2luc3RhbnRpYXRlJywgJ2NyZWF0ZScsICd1cGRhdGUnLCAncmV2ZXJ0JywgJ2dldF9pbmZvJywgJ3ZhbGlkYXRlJywgJ2R1cGxpY2F0ZScsICdyZXN0b3JlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogbGlzdD1saXN0IGFsbCBwcmVmYWJzIGluIHByb2plY3QsIGxvYWQ9bG9hZCBwcmVmYWIgYnkgdXVpZCwgaW5zdGFudGlhdGU9aW5zdGFudGlhdGUgcHJlZmFiIGluIHNjZW5lLCBjcmVhdGU9Y3JlYXRlIHByZWZhYiBmcm9tIG5vZGUsIHVwZGF0ZT1hcHBseSBub2RlIGNoYW5nZXMgdG8gZXhpc3RpbmcgcHJlZmFiLCByZXZlcnQ9cmV2ZXJ0IHByZWZhYiBpbnN0YW5jZSB0byB0aGUgYXNzZXQgc3RhdGUgKGFsaWFzIG9mIHJlc3RvcmUpLCBnZXRfaW5mbz1nZXQgZGV0YWlsZWQgcHJlZmFiIGluZm8sIHZhbGlkYXRlPXZhbGlkYXRlIHByZWZhYiBmaWxlIGZvcm1hdCwgZHVwbGljYXRlPWR1cGxpY2F0ZSBhIHByZWZhYiwgcmVzdG9yZT1yZXN0b3JlIHByZWZhYiBub2RlIHVzaW5nIHByZWZhYiBhc3NldCAoYnVpbHQtaW4gdW5kbyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKGZvciBsb2FkLCBnZXRfaW5mbywgdmFsaWRhdGUsIGR1cGxpY2F0ZSwgcmVzdG9yZV9ub2RlIGFjdGlvbnMpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByZWZhYlV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIChmb3IgaW5zdGFudGlhdGUgYWN0aW9uKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2NlbmUgbm9kZSBVVUlEIChmb3IgY3JlYXRlLCB1cGRhdGUsIHJldmVydCwgcmVzdG9yZSBhY3Rpb25zKS4gRm9yIHVwZGF0ZS9yZXZlcnQvcmVzdG9yZSB0aGlzIG1heSBiZSBhbnkgbm9kZSBpbnNpZGUgdGhlIHByZWZhYiBpbnN0YW5jZTsgdGhlIGluc3RhbmNlIHJvb3QgaXMgcmVzb2x2ZWQgZnJvbSBpdC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2F2ZVBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IERCIHBhdGggdG8gc2F2ZSBwcmVmYWIgKGZvciBjcmVhdGUgYWN0aW9uLCBlLmcuIGRiOi8vYXNzZXRzL3ByZWZhYnMvTXlQcmVmYWIucHJlZmFiKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXJlbnRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgbm9kZSBVVUlEIGZvciB0aGUgaW5zdGFudGlhdGVkIHByZWZhYiAoZm9yIGluc3RhbnRpYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHBvc2l0aW9uIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm90YXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgcm90YXRpb24ge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY2FsZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCBzY2FsZSB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvbGRlcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRm9sZGVyIHRvIHNlYXJjaCBwcmVmYWJzIGluIChmb3IgbGlzdCBhY3Rpb24sIGRlZmF1bHQ6IGRiOi8vYXNzZXRzKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5ld05hbWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ05ldyBwcmVmYWIgbmFtZSAoZm9yIGR1cGxpY2F0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0YXJnZXREaXI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RhcmdldCBkaXJlY3RvcnkgZm9yIGR1cGxpY2F0ZWQgcHJlZmFiIChmb3IgZHVwbGljYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzc2V0VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgdG8gcmVzdG9yZSBmcm9tIChmb3IgcmV2ZXJ0IGFuZCByZXN0b3JlIGFjdGlvbnMsIG9wdGlvbmFsIOKAlCByZXNvbHZlZCBmcm9tIHRoZSBub2RlIHdoZW4gb21pdHRlZCknXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5oYW5kbGVMaXN0KGFyZ3MpLFxuICAgICAgICBsb2FkOiAoYXJncykgPT4gdGhpcy5oYW5kbGVMb2FkKGFyZ3MpLFxuICAgICAgICBpbnN0YW50aWF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlSW5zdGFudGlhdGUoYXJncyksXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlQ3JlYXRlKGFyZ3MpLFxuICAgICAgICB1cGRhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVVwZGF0ZShhcmdzKSxcbiAgICAgICAgcmV2ZXJ0OiAoYXJncykgPT4gdGhpcy5oYW5kbGVSZXZlcnQoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5oYW5kbGVHZXRJbmZvKGFyZ3MpLFxuICAgICAgICB2YWxpZGF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlVmFsaWRhdGUoYXJncyksXG4gICAgICAgIGR1cGxpY2F0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlRHVwbGljYXRlKGFyZ3MpLFxuICAgICAgICByZXN0b3JlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVSZXN0b3JlTm9kZShhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVMaXN0KGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRQcmVmYWJMaXN0KGFyZ3MuZm9sZGVyKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gbGlzdCBwcmVmYWJzJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVMb2FkKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmxvYWRQcmVmYWJCeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGxvYWQgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVJbnN0YW50aWF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFwcmVmYWJVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ByZWZhYlV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3MucG9zaXRpb24pO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5yb3RhdGlvbik7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gbm9ybWFsaXplVmVjMyhhcmdzLnNjYWxlKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0ZVByZWZhYkJ5VXVpZCh7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgY29uc3QgZmFpbHVyZSA9IGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGluc3RhbnRpYXRlIHByZWZhYicpO1xuICAgICAgICBpZiAocmVzdWx0Lmluc3RydWN0aW9uKSBmYWlsdXJlLmluc3RydWN0aW9uID0gcmVzdWx0Lmluc3RydWN0aW9uO1xuICAgICAgICByZXR1cm4gZmFpbHVyZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUNyZWF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIHNhdmVQYXRoIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghc2F2ZVBhdGgpIHJldHVybiBlcnJvclJlc3VsdCgnc2F2ZVBhdGggaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcHJlZmFiTmFtZSA9IHNhdmVQYXRoLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy5wcmVmYWInLCAnJykgfHwgJ05ld1ByZWZhYic7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRlUHJlZmFiKHsgbm9kZVV1aWQsIHNhdmVQYXRoLCBwcmVmYWJOYW1lIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVVcGRhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudXBkYXRlUHJlZmFiKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gdXBkYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUmV2ZXJ0KGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgYXNzZXRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIC8vIGByZXZlcnRgIGFuZCBgcmVzdG9yZWAgYXJlIHRoZSBzYW1lIGVkaXRvciBvcGVyYXRpb24g4oCUIHNlZSByZXN0b3JlUHJlZmFiTm9kZS5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZCwgYXNzZXRVdWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gcmV2ZXJ0IHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0SW5mbyhhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBnZXQgcHJlZmFiIGluZm8nKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVZhbGlkYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnZhbGlkYXRlUHJlZmFiQnlVdWlkKHV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byB2YWxpZGF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUR1cGxpY2F0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCwgbmV3TmFtZSwgdGFyZ2V0RGlyIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmR1cGxpY2F0ZVByZWZhYkJ5VXVpZCh7IHV1aWQsIG5ld05hbWUsIHRhcmdldERpciB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gZHVwbGljYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVzdG9yZU5vZGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBhc3NldFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZCwgYXNzZXRVdWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gcmVzdG9yZSBwcmVmYWIgbm9kZScpO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFByaXZhdGUgaW1wbGVtZW50YXRpb24gbWV0aG9kcyAocG9ydGVkIGZyb20gUHJlZmFiVG9vbHMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByZWZhYkxpc3QoZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBmb2xkZXIuZW5kc1dpdGgoJy8nKSA/IGAke2ZvbGRlcn0qKi8qLnByZWZhYmAgOiBgJHtmb2xkZXJ9LyoqLyoucHJlZmFiYDtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiczogUHJlZmFiSW5mb1tdID0gcmVzdWx0cy5tYXAoYXNzZXQgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLCBwYXRoOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsXG4gICAgICAgICAgICAgICAgZm9sZGVyOiBhc3NldC51cmwuc3Vic3RyaW5nKDAsIGFzc2V0LnVybC5sYXN0SW5kZXhPZignLycpKVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcHJlZmFicyB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsb2FkUHJlZmFiQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwcmVmYWJEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdsb2FkLWFzc2V0JywgeyB1dWlkIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB1dWlkOiBwcmVmYWJEYXRhLnV1aWQsIG5hbWU6IHByZWZhYkRhdGEubmFtZSwgbWVzc2FnZTogJ1ByZWZhYiBsb2FkZWQgc3VjY2Vzc2Z1bGx5JyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGluc3RhbnRpYXRlUHJlZmFiQnlVdWlkKGFyZ3M6IHsgcHJlZmFiVXVpZDogc3RyaW5nOyBwYXJlbnRVdWlkPzogc3RyaW5nOyBwb3NpdGlvbj86IGFueTsgcm90YXRpb24/OiBhbnk7IHNjYWxlPzogYW55IH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkLCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlIH0gPSBhcmdzO1xuXG4gICAgICAgICAgICAvLyBBbiB1bnJlc29sdmFibGUgdXVpZCBtdXN0IGJlIGZhdGFsOiBjcmVhdGUtbm9kZSBzaWxlbnRseSByZXR1cm5zIG5vdGhpbmcgZm9yIGl0LFxuICAgICAgICAgICAgLy8gd2hpY2ggcHJldmlvdXNseSBwcm9kdWNlZCBhIHN1Y2Nlc3MgZW52ZWxvcGUgd2l0aCBubyBub2RlVXVpZCAoIzE1KS5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBwcmVmYWJVdWlkKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHV1aWQgJyR7cHJlZmFiVXVpZH0nIG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREJgLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1ZlcmlmeSB0aGUgdXVpZCwgYW5kIHJlZnJlc2ggdGhlIGFzc2V0IERCIChtYW5hZ2VfYXNzZXQgYWN0aW9uPXJlZnJlc2gpIGlmIHRoZSAucHJlZmFiIGZpbGUgd2FzIHdyaXR0ZW4gb3V0c2lkZSB0aGUgZWRpdG9yLidcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOb2RlT3B0aW9uczogYW55ID0ge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogcHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAvLyBgdHlwZWAgc2VsZWN0cyB0aGUgY3JlYXRlTm9kZUZyb21Bc3NldCgpIGJyYW5jaCB0aGF0IGluc3RhbnRpYXRlcyBhXG4gICAgICAgICAgICAgICAgLy8gbGlua2VkIFByZWZhYkluc3RhbmNlLiBXaXRob3V0IGl0LCAzLjguNydzIG5vZGUgbWFuYWdlciBmYWxscyBiYWNrIHRvXG4gICAgICAgICAgICAgICAgLy8gYnVpbGRpbmcgYSBwbGFpbiBub2RlIGZyb20gdGhlIGFzc2V0J3MgcmF3IGR1bXAg4oCUIGEgZmxhdHRlbmVkLFxuICAgICAgICAgICAgICAgIC8vIHVubGlua2VkIGNvcHkgdGhhdCByZXBvcnRzIHN1Y2Nlc3MgYnV0IGNhcnJpZXMgbm8gY2MuUHJlZmFiSW5mbyAoc2VlXG4gICAgICAgICAgICAgICAgLy8gTm9kZU1hbmFnZXIuY3JlYXRlTm9kZUZyb21Bc3NldCBqc2RvYzogXCJvcHRpb25zLnR5cGU6IOi1hOa6kOexu+Wei1wiKS5cbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldEluZm8udHlwZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSBwYXJlbnRVdWlkO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIGFzc2V0SW5mby5uYW1lKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMubmFtZSA9IGFzc2V0SW5mby5uYW1lO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAvLyBgcG9zaXRpb25gIGlzIGEgZG9jdW1lbnRlZCB0b3AtbGV2ZWwgQ3JlYXRlTm9kZU9wdGlvbnMgZmllbGQ7IGBkdW1wYFxuICAgICAgICAgICAgICAgIC8vIGlzIGV4cGxpY2l0bHkgY29tbWVudGVkIG91dCBhcyB1bnVzZWQgaW4gQGNvY29zL2NyZWF0b3ItdHlwZXMg4oCUIGl0IHdhc1xuICAgICAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZWQsIHNvIGluc3RhbnRpYXRlZCBwcmVmYWJzIG5ldmVyIHBpY2tlZCB1cCB0aGlzIHBvc2l0aW9uLlxuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBjcmVhdGVOb2RlT3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCB1dWlkID0gQXJyYXkuaXNBcnJheShub2RlVXVpZCkgPyBub2RlVXVpZFswXSA6IG5vZGVVdWlkO1xuXG4gICAgICAgICAgICAvLyBOZXZlciByZXBvcnQgc3VjY2VzcyB3aXRob3V0IGEgbm9kZSBpZCDigJQgdGhlIGNhbGxlciB3b3VsZCBidWlsZCBvbiBhIHNjZW5lXG4gICAgICAgICAgICAvLyB0aGF0IHNpbGVudGx5IGxhY2tzIHRoZSBub2RlICgjMTUpLlxuICAgICAgICAgICAgaWYgKCF1dWlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgY3JlYXRlLW5vZGUgcmV0dXJuZWQgbm8gbm9kZSB1dWlkIGZvciBwcmVmYWIgJyR7cHJlZmFiVXVpZH0nIOKAlCBub3RoaW5nIHdhcyBpbnN0YW50aWF0ZWRgLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ0Vuc3VyZSBhIHNjZW5lIGlzIG9wZW4gYW5kIHRoZSBwcmVmYWIgYXNzZXQgaXMgdmFsaWQsIHRoZW4gcmV0cnkuJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFwcGx5IHJvdGF0aW9uIGFuZCBzY2FsZSBpZiBwcm92aWRlZFxuICAgICAgICAgICAgaWYgKHJvdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnZXVsZXJBbmdsZXMnLFxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiByb3RhdGlvbiwgdHlwZTogJ2NjLlZlYzMnIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7Lyogbm9uLWZhdGFsICovfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2NhbGUpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6ICdzY2FsZScsXG4gICAgICAgICAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHNjYWxlLCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHsvKiBub24tZmF0YWwgKi99KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgc2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgaW5zdGFudGlhdGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBpbnN0YW50aWF0ZSBwcmVmYWI6ICR7ZXJyLm1lc3NhZ2V9YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ0NoZWNrIHRoYXQgdGhlIHByZWZhYlV1aWQgaXMgY29ycmVjdCBhbmQgdGhlIGFzc2V0IERCIGlzIHJlYWR5LidcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVByZWZhYihhcmdzOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0aFBhcmFtID0gYXJncy5wcmVmYWJQYXRoIHx8IGFyZ3Muc2F2ZVBhdGg7XG4gICAgICAgICAgICBpZiAoIXBhdGhQYXJhbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ01pc3NpbmcgcHJlZmFiIHBhdGggcGFyYW1ldGVyLiBQcm92aWRlIHNhdmVQYXRoLicgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiTmFtZSA9IGFyZ3MucHJlZmFiTmFtZSB8fCAnTmV3UHJlZmFiJztcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aFBhcmFtLmVuZHNXaXRoKCcucHJlZmFiJykgP1xuICAgICAgICAgICAgICAgIHBhdGhQYXJhbSA6IGAke3BhdGhQYXJhbX0vJHtwcmVmYWJOYW1lfS5wcmVmYWJgO1xuXG4gICAgICAgICAgICBjb25zdCBpbmNsdWRlQ2hpbGRyZW4gPSBhcmdzLmluY2x1ZGVDaGlsZHJlbiAhPT0gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCBpbmNsdWRlQ29tcG9uZW50cyA9IGFyZ3MuaW5jbHVkZUNvbXBvbmVudHMgIT09IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBhc3NldERiUmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiV2l0aEFzc2V0REIoXG4gICAgICAgICAgICAgICAgYXJncy5ub2RlVXVpZCwgZnVsbFBhdGgsIHByZWZhYk5hbWUsIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHNcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoYXNzZXREYlJlc3VsdC5zdWNjZXNzKSByZXR1cm4gYXNzZXREYlJlc3VsdDtcbiAgICAgICAgICAgIC8vIEEgZGVmZWN0aXZlIHdyaXRlIGlzIGEgcmVzdWx0LCBub3QgYW4gdW5hdmFpbGFibGUgcGF0aCDigJQgcmV0cnlpbmcgdGhyb3VnaFxuICAgICAgICAgICAgLy8gdGhlIGZhbGxiYWNrIGNoYWluIHdvdWxkIHJlLXNlcmlhbGl6ZSB0aGUgc2FtZSBsb3NzIGFuZCBtYXNrIGl0ICgjMjgpLlxuICAgICAgICAgICAgaWYgKGFzc2V0RGJSZXN1bHQuZmF0YWwpIHJldHVybiBhc3NldERiUmVzdWx0O1xuXG4gICAgICAgICAgICBjb25zdCBuYXRpdmVSZXN1bHQgPSB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJOYXRpdmVTdHViKCk7XG4gICAgICAgICAgICBpZiAobmF0aXZlUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBuYXRpdmVSZXN1bHQ7XG5cbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJDdXN0b20oYXJncy5ub2RlVXVpZCwgZnVsbFBhdGgsIHByZWZhYk5hbWUpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRXJyb3IgY3JlYXRpbmcgcHJlZmFiOiAke2Vycm9yfWAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgdGhlIHByZWZhYi1pbnN0YW5jZSBjb250ZXh0IGZvciBhIG5vZGUuXG4gICAgICpcbiAgICAgKiBDb2NvcyBDcmVhdG9yIGRyaXZlcyBib3RoIHByZWZhYiBtZXNzYWdlcyBmcm9tIHRoZSBub2RlIGR1bXAncyBgX19wcmVmYWJfX2BcbiAgICAgKiBibG9jayDigJQgYHJvb3RVdWlkYCAodGhlIHByZWZhYi1pbnN0YW5jZSBST09ULCBub3Qgd2hpY2hldmVyIGRlc2NlbmRhbnQgdGhlXG4gICAgICogY2FsbGVyIGhhcHBlbmVkIHRvIHBhc3MpIGFuZCBgdXVpZGAgKHRoZSBiYWNraW5nIHByZWZhYiBhc3NldCkuIFNlZSAzLjguN1xuICAgICAqIGByZXNvdXJjZXMvM2QvZW5naW5lL2VkaXRvci9pbnNwZWN0b3IvY29udHJpYnV0aW9ucy9ub2RlLmpzYDpcbiAgICAgKiAgIHJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYicsIHByZWZhYi5yb290VXVpZClcbiAgICAgKiAgIHJlcXVlc3QoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgcHJlZmFiLnJvb3RVdWlkLCBwcmVmYWIudXVpZClcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBsZXQgbm9kZURhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBxdWVyeSBub2RlICR7bm9kZVV1aWR9OiAke2Vyci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdOb2RlIG5vdCBmb3VuZCcgfTtcblxuICAgICAgICBjb25zdCBwcmVmYWIgPSBub2RlRGF0YS5fX3ByZWZhYl9fO1xuICAgICAgICBpZiAoIXByZWZhYikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBpcyBub3QgcGFydCBvZiBhIHByZWZhYiBpbnN0YW5jZWAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIHJvb3RVdWlkOiBwcmVmYWIucm9vdFV1aWQgfHwgbm9kZVV1aWQsXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHByZWZhYi51dWlkIHx8IHByZWZhYi5wcmVmYWJTdGF0ZUluZm8/LmFzc2V0VXVpZFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYSBwcmVmYWIgYXNzZXQncyBvbi1kaXNrIHBhdGgsIG9yIG51bGwgd2hlbiBpdCBjYW5ub3QgYmUgZGV0ZXJtaW5lZC5cbiAgICAgKlxuICAgICAqIEdvZXMgdGhyb3VnaCBgcXVlcnktYXNzZXQtaW5mb2AsIG5vdCBgcXVlcnktYXNzZXQtbWV0YWA6IHRoZSBtZXRhIHJlY29yZCBoYXMgbm9cbiAgICAgKiBgdXJsYCBmaWVsZCwgc28gdGhlIG9sZCBsb29rdXAgcmVzb2x2ZWQgdG8gbnVsbCBmb3IgZXZlcnkgYXNzZXQgYW5kIGxlZnQgdGhlXG4gICAgICogcG9zdC1hcHBseSB3cml0ZSBjaGVjayBwZXJtYW5lbnRseSBgdW52ZXJpZmllZGAgKCMyNSkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlUHJlZmFiRmlsZVBhdGgoYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgICAgIGlmICghYXNzZXRVdWlkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIChhd2FpdCByZXNvbHZlQXNzZXQoYXNzZXRVdWlkKSkuZmlsZVBhdGg7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0TXRpbWVNcyhmaWxlUGF0aDogc3RyaW5nIHwgbnVsbCk6IG51bWJlciB8IG51bGwge1xuICAgICAgICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBmcy5zdGF0U3luYyhmaWxlUGF0aCkubXRpbWVNcztcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBQb2xsIGZvciB0aGUgcHJlZmFiIGZpbGUgdG8gYmUgcmV3cml0dGVuOyBhc3NldC1kYiBtYXkgZmx1c2ggc2hvcnRseSBhZnRlciB0aGUgbWVzc2FnZSByZXNvbHZlcy4gKi9cbiAgICBwcml2YXRlIGFzeW5jIHdhaXRGb3JQcmVmYWJXcml0ZShmaWxlUGF0aDogc3RyaW5nLCBiYXNlbGluZU1zOiBudW1iZXIsIHRpbWVvdXRNcyA9IDIwMDApOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICAgICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgdGltZW91dE1zO1xuICAgICAgICBsZXQgbXRpbWUgPSB0aGlzLnN0YXRNdGltZU1zKGZpbGVQYXRoKTtcbiAgICAgICAgd2hpbGUgKG10aW1lICE9PSBudWxsICYmIG10aW1lIDw9IGJhc2VsaW5lTXMgJiYgRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwKSk7XG4gICAgICAgICAgICBtdGltZSA9IHRoaXMuc3RhdE10aW1lTXMoZmlsZVBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtdGltZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZVByZWZhYihub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghY29udGV4dC5zdWNjZXNzKSByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgIGNvbnN0IHsgcm9vdFV1aWQsIGFzc2V0VXVpZCB9ID0gY29udGV4dDtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiUGF0aCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkZpbGVQYXRoKGFzc2V0VXVpZCk7XG4gICAgICAgICAgICBjb25zdCBtdGltZUJlZm9yZSA9IHRoaXMuc3RhdE10aW1lTXMocHJlZmFiUGF0aCk7XG5cbiAgICAgICAgICAgIC8vIGBzY2VuZTphcHBseS1wcmVmYWJgIHRha2VzIHRoZSBpbnN0YW5jZSByb290IHV1aWQgYXMgYSBQT1NJVElPTkFMIHN0cmluZ1xuICAgICAgICAgICAgLy8gYW5kIHJlc29sdmVzIHRvIGEgYm9vbGVhbi4gVGhlIG9sZCBgeyBub2RlOiB1dWlkIH1gIG9iamVjdCBmb3JtIHJlc29sdmVkXG4gICAgICAgICAgICAvLyB3aXRob3V0IHRocm93aW5nIGJ1dCBuZXZlciB3cm90ZSB0aGUgYXNzZXQg4oCUIGEgc2lsZW50IG5vLW9wIHJlcG9ydGVkIGFzXG4gICAgICAgICAgICAvLyBzdWNjZXNzICgjMTIpLlxuICAgICAgICAgICAgY29uc3QgYXBwbGllZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYicsIHJvb3RVdWlkKTtcblxuICAgICAgICAgICAgLy8gVmVyaWZ5IHRoZSBhc3NldCB3YXMgYWN0dWFsbHkgd3JpdHRlbiByYXRoZXIgdGhhbiB0cnVzdGluZyB0aGUgYm9vbGVhbiB0aGVcbiAgICAgICAgICAgIC8vIG1lc3NhZ2UgcmVzb2x2ZXMgdG8gZWl0aGVyIHdheS4gYHVudmVyaWZpZWRgIG1lYW5zIHRoZSBwYXRoIGNvdWxkIG5vdCBiZVxuICAgICAgICAgICAgLy8gcmVzb2x2ZWQsIG5vdCB0aGF0IHRoZSB3cml0ZSBmYWlsZWQuIFRoaXMgcnVucyBldmVuIHdoZW4gYGFwcGxpZWQgPT09IGZhbHNlYDpcbiAgICAgICAgICAgIC8vIHRoZSBlZGl0b3IgaGFzIGJlZW4gb2JzZXJ2ZWQgcmVzb2x2aW5nIGBmYWxzZWAgb24gc2F2ZXMgdGhhdCBESUQgcmV3cml0ZSB0aGVcbiAgICAgICAgICAgIC8vIGZpbGUgKCM2Mykg4oCUIHRydXN0aW5nIHRoYXQgc2lnbmFsIGFsb25lIHR1cm5zIGEgc3VjY2Vzc2Z1bCB1cGRhdGUgaW50byBhXG4gICAgICAgICAgICAvLyByZXBvcnRlZCBmYWlsdXJlLiBUaGUgbXRpbWUgY2hlY2sgaXMgdGhlIHNvdXJjZSBvZiB0cnV0aDsgYGFwcGxpZWRgIGlzIG9ubHlcbiAgICAgICAgICAgIC8vIGNvbnN1bHRlZCB3aGVuIHRoZSBtdGltZSBjYW5ub3QgY29uZmlybSBvbmUgd2F5IG9yIHRoZSBvdGhlci5cbiAgICAgICAgICAgIGxldCBwZXJzaXN0ZWQ6IGJvb2xlYW4gfCAndW52ZXJpZmllZCcgPSAndW52ZXJpZmllZCc7XG4gICAgICAgICAgICBpZiAocHJlZmFiUGF0aCAhPT0gbnVsbCAmJiBtdGltZUJlZm9yZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG10aW1lQWZ0ZXIgPSBhd2FpdCB0aGlzLndhaXRGb3JQcmVmYWJXcml0ZShwcmVmYWJQYXRoLCBtdGltZUJlZm9yZSk7XG4gICAgICAgICAgICAgICAgaWYgKG10aW1lQWZ0ZXIgIT09IG51bGwpIHBlcnNpc3RlZCA9IG10aW1lQWZ0ZXIgPiBtdGltZUJlZm9yZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgYXBwbGllZFJlamVjdGVkID0gYXBwbGllZCA9PT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGlmIChhcHBsaWVkUmVqZWN0ZWQgJiYgcGVyc2lzdGVkICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgRWRpdG9yIHJlamVjdGVkIGFwcGx5LXByZWZhYiBmb3Igbm9kZSAke3Jvb3RVdWlkfS4gQ29uZmlybSBpdCBpcyBhIHByZWZhYi1pbnN0YW5jZSByb290IHdpdGggYSB2YWxpZCBhc3NldCBsaW5rLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBhcHBseS1wcmVmYWIgcmVwb3J0ZWQgbm8gZXJyb3IgYnV0ICR7cHJlZmFiUGF0aH0gd2FzIG5vdCByZXdyaXR0ZW4uIFRoZSBub2RlIG1heSBoYXZlIG5vIG92ZXJyaWRlcyB0byBhcHBseSwgb3IgaXRzIHByZWZhYiBsaW5rIGlzIHN0YWxlLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYGFwcGx5LXByZWZhYmAgd3JpdGVzIHByb3BlcnR5IG92ZXJyaWRlcyBidXQgZG9lcyBub3QgcmVtb3ZlIGEgY2hpbGQgbm9kZVxuICAgICAgICAgICAgLy8gZGVsZXRlZCBmcm9tIHRoZSBpbnN0YW5jZSAoIzIxKSDigJQgdGhlIG10aW1lIGd1YXJkIGFib3ZlIGNhbm5vdCBzZWUgdGhpcyxcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgYSBkZWxldGlvbiBzdGlsbCBwcm9kdWNlcyBvdmVycmlkZXMgZWxzZXdoZXJlLCBzbyB0aGUgZmlsZSBJU1xuICAgICAgICAgICAgLy8gcmV3cml0dGVuIGFuZCBgcGVyc2lzdGVkYCBpcyBnZW51aW5lbHkgYHRydWVgLiBDb21wYXJlIHRoZSBsaXZlIGluc3RhbmNlJ3NcbiAgICAgICAgICAgIC8vIGZpbGVJZHMgYWdhaW5zdCB0aGUgZnJlc2hseS13cml0dGVuIGFzc2V0J3MgdG8gY2F0Y2ggdGhlIHNwZWNpZmljIGZhaWx1cmVcbiAgICAgICAgICAgIC8vIG1vZGUgdGhlIG10aW1lIGNoZWNrIGNhbm5vdDogYSBjaGlsZCBzdGlsbCBwcmVzZW50IG9uIGRpc2sgdGhhdCBubyBsb25nZXJcbiAgICAgICAgICAgIC8vIGV4aXN0cyBpbiB0aGUgc2NlbmUuIEFueXRoaW5nIGZvdW5kIGlzIHRoZW4gcmVtb3ZlZCBmcm9tIHRoZSBhc3NldCwgc2luY2VcbiAgICAgICAgICAgIC8vIHJlcG9ydGluZyB0aGUgc3RhbGUgY2hpbGRyZW4gaXMgbm90IHRoZSBzYW1lIGFzIGhvbm91cmluZyB0aGUgZGVsZXRpb24uXG4gICAgICAgICAgICBsZXQgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gdHJ1ZSAmJiBwcmVmYWJQYXRoKSB7XG4gICAgICAgICAgICAgICAgb3JwaGFuZWRGaWxlSWRzID0gYXdhaXQgdGhpcy5maW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQsIHByZWZhYlBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlbW92ZWRGaWxlSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKG9ycGhhbmVkRmlsZUlkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZhbCA9IGF3YWl0IHRoaXMucmVtb3ZlT3JwaGFuZWRDaGlsZHJlbkZyb21Bc3NldChcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aCBhcyBzdHJpbmcsIG9ycGhhbmVkRmlsZUlkcywgcm9vdFV1aWQsIGFzc2V0VXVpZFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdmFsLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBhcHBseS1wcmVmYWIgd3JvdGUgJHtwcmVmYWJQYXRofSwgYnV0IGl0IHN0aWxsIGNvbnRhaW5zICR7b3JwaGFuZWRGaWxlSWRzLmxlbmd0aH0gY2hpbGQgbm9kZShzKSAoZmlsZUlkOiAke29ycGhhbmVkRmlsZUlkcy5qb2luKCcsICcpfSkgdGhhdCBubyBsb25nZXIgZXhpc3QgaW4gdGhlIHNjZW5lIGluc3RhbmNlLiBDb2NvcyBDcmVhdG9yIDMuOC43J3MgYXBwbHktcHJlZmFiIGRvZXMgbm90IHJlbW92ZSBkZWxldGVkIGNoaWxkcmVuLCBhbmQgcmVtb3ZpbmcgdGhlbSBoZXJlIHdhcyBkZWNsaW5lZDogJHtyZW1vdmFsLmVycm9yfS4gVGhlIGFzc2V0IGlzIGJ5dGUtZm9yLWJ5dGUgdW5jaGFuZ2VkIOKAlCBkZWxldGUgYW5kIHJlY3JlYXRlIHRoZSBwcmVmYWIsIG9yIHJlbW92ZSB0aGUgc3RhbGUgZW50cmllcyBtYW51YWxseS5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkLCBvcnBoYW5lZEZpbGVJZHMgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZW1vdmVkRmlsZUlkcyA9IG9ycGhhbmVkRmlsZUlkcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGFwcGxpZWRSZWplY3RlZFxuICAgICAgICAgICAgICAgICAgICA/IChyZW1vdmVkRmlsZUlkcy5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGBQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHkgZGVzcGl0ZSBhcHBseS1wcmVmYWIgcmVwb3J0aW5nIHJlamVjdGlvbjsgcmVtb3ZlZCAke3JlbW92ZWRGaWxlSWRzLmxlbmd0aH0gY2hpbGQgbm9kZShzKSBhcHBseS1wcmVmYWIgbGVmdCBiZWhpbmRgXG4gICAgICAgICAgICAgICAgICAgICAgICA6IGBQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHk7IGFwcGx5LXByZWZhYiByZXBvcnRlZCByZWplY3Rpb24gYnV0ICR7cHJlZmFiUGF0aH0gd2FzIHJld3JpdHRlbmApXG4gICAgICAgICAgICAgICAgICAgIDogKHJlbW92ZWRGaWxlSWRzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgICAgID8gYFByZWZhYiB1cGRhdGVkIHN1Y2Nlc3NmdWxseTsgcmVtb3ZlZCAke3JlbW92ZWRGaWxlSWRzLmxlbmd0aH0gY2hpbGQgbm9kZShzKSBhcHBseS1wcmVmYWIgbGVmdCBiZWhpbmRgXG4gICAgICAgICAgICAgICAgICAgICAgICA6ICdQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHknKSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQsIGFwcGxpZWRSZWplY3RlZCwgcmVtb3ZlZEZpbGVJZHMgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZmlsZUlkcyBvZiBwcmVmYWItdHJhY2tlZCBub2RlcyBwcmVzZW50IGluIHRoZSB3cml0dGVuIGFzc2V0IGJ1dCBhYnNlbnRcbiAgICAgKiBmcm9tIHRoZSBsaXZlIHNjZW5lIGluc3RhbmNlIOKAlCBjaGlsZHJlbiBgYXBwbHktcHJlZmFiYCBmYWlsZWQgdG8gcmVtb3ZlICgjMjEpLlxuICAgICAqIERldGVjdGlvbiBpcyBiZXN0LWVmZm9ydDogYW55IGZhaWx1cmUgcmV0dXJucyBubyBvcnBoYW5zIHJhdGhlciB0aGFuIGEgZmFsc2VcbiAgICAgKiBwb3NpdGl2ZSwgc2luY2UgdGhpcyBjaGVjayBtdXN0IG5ldmVyIG1hc2sgYSBnZW51aW5lIHN1Y2Nlc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZywgcHJlZmFiUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbGl2ZUZpbGVJZHMgPSBhd2FpdCB0aGlzLmNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQpO1xuICAgICAgICAgICAgaWYgKGxpdmVGaWxlSWRzLnNpemUgPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHByZWZhYlBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShhc3NldERhdGEpKSByZXR1cm4gW107XG4gICAgICAgICAgICBjb25zdCBhc3NldEZpbGVJZHMgPSB0aGlzLmNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKGFzc2V0RGF0YSk7XG4gICAgICAgICAgICByZXR1cm4gWy4uLmFzc2V0RmlsZUlkc10uZmlsdGVyKGlkID0+ICFsaXZlRmlsZUlkcy5oYXMoaWQpKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogV2FsayBhIGxpdmUgcHJlZmFiLWluc3RhbmNlIHN1YnRyZWUgYW5kIGNvbGxlY3QgdGhlIGBfX3ByZWZhYl9fLmZpbGVJZGAgb2YgZXZlcnkgbm9kZS4gKi9cbiAgICBwcml2YXRlIGFzeW5jIGNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZyk6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgICAgICAgY29uc3QgZmlsZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB2aXNpdCA9IGFzeW5jICh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVJZCA9IG5vZGVEYXRhLl9fcHJlZmFiX18/LmZpbGVJZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZUlkID09PSAnc3RyaW5nJyAmJiBmaWxlSWQpIGZpbGVJZHMuYWRkKGZpbGVJZCk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbjogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSA/IG5vZGVEYXRhLmNoaWxkcmVuIDogW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkVXVpZCBvZiBjaGlsZHJlbikgYXdhaXQgdmlzaXQoY2hpbGRVdWlkKTtcbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgdmlzaXQocm9vdFV1aWQpO1xuICAgICAgICByZXR1cm4gZmlsZUlkcztcbiAgICB9XG5cbiAgICAvKiogRXh0cmFjdCBldmVyeSBgY2MuTm9kZWAgZW50cnkncyBmaWxlSWQgZnJvbSBhIHdyaXR0ZW4gYC5wcmVmYWJgIGFzc2V0J3MgSlNPTiBhcnJheS4gKi9cbiAgICBwcml2YXRlIGNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGE6IGFueVtdKTogU2V0PHN0cmluZz4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCkgZmlsZUlkcy5hZGQoZmlsZUlkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZUlkcztcbiAgICB9XG5cbiAgICAvKiogVGhlIGZpbGVJZCByZWNvcmRlZCBvbiB0aGUgYGNjLk5vZGVgIGF0IGBpbmRleGAsIG9yIG51bGwgd2hlbiBpdCBoYXMgbm9uZS4gKi9cbiAgICBwcml2YXRlIGZpbGVJZE9mTm9kZShwcmVmYWJEYXRhOiBhbnlbXSwgaW5kZXg6IG51bWJlcik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBlbnRyeS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgIGlmICh0eXBlb2YgcHJlZmFiSW5mb0luZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IHByZWZhYkRhdGFbcHJlZmFiSW5mb0luZGV4XT8uZmlsZUlkO1xuICAgICAgICByZXR1cm4gdHlwZW9mIGZpbGVJZCA9PT0gJ3N0cmluZycgJiYgZmlsZUlkID8gZmlsZUlkIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2UgYXJyYXlzIHdob3NlIGVsZW1lbnQgb3JkZXIgaXMgc3RydWN0dXJhbCDigJQgYSByZW1vdmVkIGVudHJ5IG11c3QgYmUgc3BsaWNlZFxuICAgICAqIG91dCBvZiB0aGVtLCBuZXZlciBsZWZ0IGJlaGluZCBhcyBhIG51bGwgaG9sZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0cnVjdHVyYWxSZWZBcnJheXMgPSBbJ19jaGlsZHJlbicsICdfY29tcG9uZW50cycsICduZXN0ZWRQcmVmYWJJbnN0YW5jZVJvb3RzJywgJ3RhcmdldE92ZXJyaWRlcyddO1xuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlcyBgYXBwbHktcHJlZmFiYCBsZWZ0IGJlaGluZCwgdGhlbiBoYW5kIHRoZSByZXN1bHRcbiAgICAgKiB0byB0aGUgZWRpdG9yIGZvciBhY2NlcHRhbmNlICgjMjEpLlxuICAgICAqXG4gICAgICogVGhyZWUgZ2F0ZXMgZ3VhcmQgdGhlIHJld3JpdGUsIGFuZCB0aGUgcHJlLXN1cmdlcnkgYnl0ZXMgYXJlIHJlc3RvcmVkIGF0IGFueSBvZiB0aGVtOlxuICAgICAqIHRoZSBncmFwaCByZXdyaXRlIHJlZnVzZXMgYSBsYXlvdXQgaXQgZG9lcyBub3QgcmVjb2duaXNlLCB0aGUgcmV3cml0dGVuIGdyYXBoIGlzXG4gICAgICogdmFsaWRhdGVkIGJlZm9yZSBpdCBpcyB3cml0dGVuLCBhbmQgYGFzc2V0LWRiOnJlaW1wb3J0LWFzc2V0YCBpcyB0aGUgZW5naW5lJ3Mgb3duXG4gICAgICogdmVyZGljdCBvbiB0aGUgcmVzdWx0IOKAlCBhbiBpbnRlcm5hbGx5IGNvbnNpc3RlbnQgZ3JhcGggY2FuIHN0aWxsIGJlIG9uZSB0aGUgaW1wb3J0ZXJcbiAgICAgKiByZWplY3RzLCBhbmQgb25seSB0aGUgZWRpdG9yIGNhbiBzYXkgc28uIEEgZGVjbGluZWQgcmVtb3ZhbCBsZWF2ZXMgdGhlIGNhbGxlciBleGFjdGx5XG4gICAgICogd2hlcmUgaXQgc3Rvb2QgYmVmb3JlIHRoaXMgbWV0aG9kIGV4aXN0ZWQ6IGEgaGFyZCBmYWlsdXJlIG5hbWluZyB0aGUgc3RhbGUgZmlsZUlkcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZU9ycGhhbmVkQ2hpbGRyZW5Gcm9tQXNzZXQoXG4gICAgICAgIHByZWZhYlBhdGg6IHN0cmluZyxcbiAgICAgICAgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSxcbiAgICAgICAgcm9vdFV1aWQ6IHN0cmluZyxcbiAgICAgICAgYXNzZXRVdWlkOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBsZXQgb3JpZ2luYWxUZXh0OiBzdHJpbmc7XG4gICAgICAgIGxldCBwcmVmYWJEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBvcmlnaW5hbFRleHQgPSBmcy5yZWFkRmlsZVN5bmMocHJlZmFiUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICBwcmVmYWJEYXRhID0gSlNPTi5wYXJzZShvcmlnaW5hbFRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgdGhlIGFzc2V0IGNvdWxkIG5vdCBiZSByZS1yZWFkICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICd0aGUgYXNzZXQgaXMgbm90IGEgc2VyaWFsaXplZCBlbnRyeSBhcnJheScgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpdmVGaWxlSWRzID0gYXdhaXQgdGhpcy5jb2xsZWN0SW5zdGFuY2VGaWxlSWRzKHJvb3RVdWlkKTtcbiAgICAgICAgY29uc3QgZmlsZUlkc0JlZm9yZSA9IHRoaXMuY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMocHJlZmFiRGF0YSk7XG4gICAgICAgIGNvbnN0IHJld3JpdHRlbiA9IHRoaXMucHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGEsIG9ycGhhbmVkRmlsZUlkcywgbGl2ZUZpbGVJZHMpO1xuICAgICAgICBpZiAoIXJld3JpdHRlbikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGFzc2V0IGdyYXBoIGRvZXMgbm90IG1hdGNoIHRoZSBsYXlvdXQgdGhpcyByZW1vdmFsIHVuZGVyc3RhbmRzJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW52YWxpZCA9IHRoaXMudmFsaWRhdGVQcmVmYWJHcmFwaChyZXdyaXR0ZW4sIG9ycGhhbmVkRmlsZUlkcywgZmlsZUlkc0JlZm9yZSk7XG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGdyYXBoIGZhaWxlZCB2YWxpZGF0aW9uICgke2ludmFsaWR9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHJld3JpdHRlbiwgbnVsbCwgb3JpZ2luYWxUZXh0LmluY2x1ZGVzKCdcXG4nKSA/IDIgOiAwKSwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGFzc2V0IGNvdWxkIG5vdCBiZSB3cml0dGVuICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaW1wb3J0ZWQ6IGJvb2xlYW47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IChhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0VXVpZCkpICE9PSBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW1wb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZVByZWZhYkZpbGUocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3RoZSBlZGl0b3IgcmVqZWN0ZWQgdGhlIHJld3JpdHRlbiBhc3NldCBvbiByZWltcG9ydCcgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1cnZpdm9ycyA9IGF3YWl0IHRoaXMuZmluZE9ycGhhbmVkQ2hpbGRGaWxlSWRzKHJvb3RVdWlkLCBwcmVmYWJQYXRoKTtcbiAgICAgICAgaWYgKHN1cnZpdm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVQcmVmYWJGaWxlKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGByZW1vdmFsIHJhbiBidXQgZmlsZUlkKHMpICR7c3Vydml2b3JzLmpvaW4oJywgJyl9IGFyZSBzdGlsbCBvcnBoYW5lZGAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICAvKiogUHV0IHRoZSBwcmUtc3VyZ2VyeSBieXRlcyBiYWNrLCBzbyBhIGRlY2xpbmVkIHJlbW92YWwgbGVhdmVzIHRoZSBhc3NldCB1bnRvdWNoZWQuICovXG4gICAgcHJpdmF0ZSByZXN0b3JlUHJlZmFiRmlsZShwcmVmYWJQYXRoOiBzdHJpbmcsIG9yaWdpbmFsVGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm90aGluZyBmdXJ0aGVyIHRvIGRvIGhlcmUg4oCUIHRoZSBjYWxsZXIgcmVwb3J0cyB0aGUgZmFpbHVyZSBlaXRoZXIgd2F5LlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJvcCBldmVyeSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlIGZyb20gYSBzZXJpYWxpemVkIHByZWZhYiBhcnJheSBhbmQgcmUtaW5kZXggdGhlIHdob2xlXG4gICAgICogZ3JhcGguIFJldHVybnMgbnVsbCDigJQgY2hhbmdpbmcgbm90aGluZyDigJQgd2hlbmV2ZXIgdGhlIGdyYXBoIGRvZXMgbm90IG1hdGNoIHdoYXQgdGhpc1xuICAgICAqIHJld3JpdGUgcmVsaWVzIG9uLCByYXRoZXIgdGhhbiBwcm9kdWNpbmcgYW4gYXNzZXQgbm9ib2R5IGNhbiBsb2FkLlxuICAgICAqL1xuICAgIHByaXZhdGUgcHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGE6IGFueVtdLCBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdLCBsaXZlRmlsZUlkczogU2V0PHN0cmluZz4pOiBhbnlbXSB8IG51bGwge1xuICAgICAgICBjb25zdCBub2RlSW5kZXhCeUZpbGVJZCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCAmJiAhbm9kZUluZGV4QnlGaWxlSWQuaGFzKGZpbGVJZCkpIG5vZGVJbmRleEJ5RmlsZUlkLnNldChmaWxlSWQsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlbW92ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgY29uc3QgcGVuZGluZzogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2Ygb3JwaGFuZWRGaWxlSWRzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IG5vZGVJbmRleEJ5RmlsZUlkLmdldChmaWxlSWQpO1xuICAgICAgICAgICAgLy8gRGV0ZWN0aW9uIGFuZCByZW1vdmFsIGRpc2FncmVlIGFib3V0IHRoZSBhc3NldCDigJQgZG8gbm90IGd1ZXNzIGF0IHRoZSBncmFwaC5cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHBlbmRpbmcucHVzaChpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAocGVuZGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5kZXggPSBwZW5kaW5nLnNoaWZ0KCkgYXMgbnVtYmVyO1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKG5vZGVJbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHByZWZhYkRhdGFbbm9kZUluZGV4XTtcbiAgICAgICAgICAgIGlmICghbm9kZSB8fCBub2RlLl9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmVtb3ZlZC5hZGQobm9kZUluZGV4KTtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gbm9kZS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICBpZiAodHlwZW9mIHByZWZhYkluZm9JbmRleCA9PT0gJ251bWJlcicpIHJlbW92ZWQuYWRkKHByZWZhYkluZm9JbmRleCk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkobm9kZS5fY29tcG9uZW50cykgPyBub2RlLl9jb21wb25lbnRzIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50SW5kZXggIT09ICdudW1iZXInKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICByZW1vdmVkLmFkZChjb21wb25lbnRJbmRleCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZGV4ID0gcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0/Ll9fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wUHJlZmFiSW5kZXggPT09ICdudW1iZXInKSByZW1vdmVkLmFkZChjb21wUHJlZmFiSW5kZXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiBBcnJheS5pc0FycmF5KG5vZGUuX2NoaWxkcmVuKSA/IG5vZGUuX2NoaWxkcmVuIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgLy8gQSBkZXNjZW5kYW50IG9mIGEgZGVsZXRlZCBjaGlsZCBjYW5ub3Qgc3RpbGwgYmUgbGl2ZSBpbiB0aGUgaW5zdGFuY2UuIElmIG9uZVxuICAgICAgICAgICAgICAgIC8vIGlzLCB0aGUgb3JwaGFuIHNldCBpcyBub3Qgd2hhdCB0aGlzIHJld3JpdGUgYXNzdW1lcyBhbmQgaXQgbXVzdCBub3QgcHJvY2VlZC5cbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEZpbGVJZCA9IHRoaXMuZmlsZUlkT2ZOb2RlKHByZWZhYkRhdGEsIGNoaWxkSW5kZXgpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZEZpbGVJZCAhPT0gbnVsbCAmJiBsaXZlRmlsZUlkcy5oYXMoY2hpbGRGaWxlSWQpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICBwZW5kaW5nLnB1c2goY2hpbGRJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlbW92ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJ1bmVkOiBhbnlbXSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSkpO1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJ1bmVkLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKGluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHBydW5lZFtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgdGhpcy5zdHJ1Y3R1cmFsUmVmQXJyYXlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGVudHJ5W2tleV0pKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBlbnRyeVtrZXldID0gZW50cnlba2V5XS5maWx0ZXIoKGVsZW1lbnQ6IGFueSkgPT4gIXRoaXMucmVmZXJlbmNlc1JlbW92ZWQoZWxlbWVudCwgcmVtb3ZlZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2hhdGV2ZXIgc3RpbGwgcG9pbnRzIGF0IGEgcmVtb3ZlZCBlbnRyeSBiZWNvbWVzIG51bGwg4oCUIHRoaXMgaXMgdGhlIGRhbmdsaW5nXG4gICAgICAgIC8vIGNvbXBvbmVudCByZWZlcmVuY2UgdGhlIHJlcG9ydCBjYWxscyBvdXQgKGFuIGBPYmplY3RWaWV3LnRpY2tOb2RlYCBiaW5kaW5nIHRvIGFcbiAgICAgICAgLy8gY2hpbGQgdGhhdCBubyBsb25nZXIgZXhpc3RzKS5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHBydW5lZC5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkLmhhcyhpbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcHJ1bmVkW2luZGV4XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKHBydW5lZFtpbmRleF0sIHJlbW92ZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtYXAgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuICAgICAgICBjb25zdCBzdXJ2aXZvcnM6IGFueVtdID0gW107XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcnVuZWQubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMoaW5kZXgpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHJlbWFwLnNldChpbmRleCwgc3Vydml2b3JzLmxlbmd0aCk7XG4gICAgICAgICAgICBzdXJ2aXZvcnMucHVzaChwcnVuZWRbaW5kZXhdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3Vydml2b3JzLm1hcChlbnRyeSA9PiB0aGlzLnJlbWFwUmVmcyhlbnRyeSwgcmVtYXApKTtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGB2YWx1ZWAgaXMg4oCUIG9yIGNvbnRhaW5zIOKAlCBhbiBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeS4gKi9cbiAgICBwcml2YXRlIHJlZmVyZW5jZXNSZW1vdmVkKHZhbHVlOiBhbnksIHJlbW92ZWQ6IFNldDxudW1iZXI+KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh2YWx1ZSkuc29tZShuZXN0ZWQgPT4gdGhpcy5yZWZlcmVuY2VzUmVtb3ZlZChuZXN0ZWQsIHJlbW92ZWQpKTtcbiAgICB9XG5cbiAgICAvKiogUmVwbGFjZSBldmVyeSBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeSB3aXRoIG51bGwuICovXG4gICAgcHJpdmF0ZSBudWxsaWZ5UmVtb3ZlZFJlZnModmFsdWU6IGFueSwgcmVtb3ZlZDogU2V0PG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLm51bGxpZnlSZW1vdmVkUmVmcyhlbGVtZW50LCByZW1vdmVkKSk7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHZhbHVlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICBjb25zdCByZXdyaXR0ZW46IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIG5lc3RlZF0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSByZXdyaXR0ZW5ba2V5XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKG5lc3RlZCwgcmVtb3ZlZCk7XG4gICAgICAgIHJldHVybiByZXdyaXR0ZW47XG4gICAgfVxuXG4gICAgLyoqIFBvaW50IGV2ZXJ5IHN1cnZpdmluZyBgX19pZF9fYCBhdCBpdHMgZW50cnkncyBzbG90IGluIHRoZSBjb21wYWN0ZWQgYXJyYXkuICovXG4gICAgcHJpdmF0ZSByZW1hcFJlZnModmFsdWU6IGFueSwgcmVtYXA6IE1hcDxudW1iZXIsIG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLnJlbWFwUmVmcyhlbGVtZW50LCByZW1hcCkpO1xuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiB2YWx1ZTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5fX2lkX18gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gcmVtYXAuZ2V0KHZhbHVlLl9faWRfXyk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHsgX19pZF9fOiBuZXh0IH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmV3cml0dGVuOiBhbnkgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBuZXN0ZWRdIG9mIE9iamVjdC5lbnRyaWVzKHZhbHVlKSkgcmV3cml0dGVuW2tleV0gPSB0aGlzLnJlbWFwUmVmcyhuZXN0ZWQsIHJlbWFwKTtcbiAgICAgICAgcmV0dXJuIHJld3JpdHRlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWplY3QgYSByZXdyaXR0ZW4gZ3JhcGggYmVmb3JlIGl0IHJlYWNoZXMgZGlzay4gUmV0dXJucyB0aGUgZmlyc3QgcHJvYmxlbSBmb3VuZCwgb3JcbiAgICAgKiBudWxsIHdoZW4gdGhlIGdyYXBoIGlzIHNvdW5kIOKAlCB0aGlzIGlzIHdoYXQgbWFrZXMgYSBtaXMtaW5kZXhlZCBhc3NldCBpbXBvc3NpYmxlIHRvXG4gICAgICogd3JpdGUgcmF0aGVyIHRoYW4gc29tZXRoaW5nIHRvIG5vdGljZSBhZnRlcndhcmRzLlxuICAgICAqL1xuICAgIHByaXZhdGUgdmFsaWRhdGVQcmVmYWJHcmFwaChwcmVmYWJEYXRhOiBhbnlbXSwgcmVtb3ZlZEZpbGVJZHM6IHN0cmluZ1tdLCBmaWxlSWRzQmVmb3JlOiBTZXQ8c3RyaW5nPik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBkYW5nbGluZyA9IHRoaXMuZmluZERhbmdsaW5nUmVmKHByZWZhYkRhdGEsIHByZWZhYkRhdGEubGVuZ3RoKTtcbiAgICAgICAgaWYgKGRhbmdsaW5nICE9PSBudWxsKSByZXR1cm4gYF9faWRfXyAke2RhbmdsaW5nfSBpcyBvdXQgb2YgcmFuZ2VgO1xuXG4gICAgICAgIC8vIElkZW50aXR5LCBub3QgY291bnQ6IGV4YWN0bHkgdGhlIG9ycGhhbnMgZ28sIGFuZCBub3RoaW5nIGVsc2UgZG9lcy5cbiAgICAgICAgY29uc3QgcmVtYWluaW5nID0gdGhpcy5jb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhwcmVmYWJEYXRhKTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2YgcmVtb3ZlZEZpbGVJZHMpIHtcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmcuaGFzKGZpbGVJZCkpIHJldHVybiBgb3JwaGFuZWQgZmlsZUlkICR7ZmlsZUlkfSBzdXJ2aXZlZCByZW1vdmFsYDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiBmaWxlSWRzQmVmb3JlKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZEZpbGVJZHMuaW5jbHVkZXMoZmlsZUlkKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXMoZmlsZUlkKSkgcmV0dXJuIGBmaWxlSWQgJHtmaWxlSWR9IHdhcyByZW1vdmVkIGJ1dCBzaG91bGQgaGF2ZSBiZWVuIGtlcHRgO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NoaWxkcmVuKSA/IGVudHJ5Ll9jaGlsZHJlbiA6IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NoaWxkcmVuIGVudHJ5YDtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHByZWZhYkRhdGFbY2hpbGRJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZCB8fCBjaGlsZC5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBub24tbm9kZSBjaGlsZCBhdCAke2NoaWxkSW5kZXh9YDtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQuX3BhcmVudCAmJiBjaGlsZC5fcGFyZW50Ll9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBub2RlICR7Y2hpbGRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBwYXJlbnQgJHtpbmRleH1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpID8gZW50cnkuX2NvbXBvbmVudHMgOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NvbXBvbmVudHMgZW50cnlgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50KSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBtaXNzaW5nIGNvbXBvbmVudCBhdCAke2NvbXBvbmVudEluZGV4fWA7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5ub2RlICYmIGNvbXBvbmVudC5ub2RlLl9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBjb21wb25lbnQgJHtjb21wb25lbnRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBub2RlICR7aW5kZXh9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqIFRoZSBmaXJzdCBgX19pZF9fYCBvdXRzaWRlIGBbMCwgbGVuZ3RoKWAgYW55d2hlcmUgaW4gdGhlIGdyYXBoLCBvciBudWxsIHdoZW4gYWxsIHJlc29sdmUuICovXG4gICAgcHJpdmF0ZSBmaW5kRGFuZ2xpbmdSZWYodmFsdWU6IGFueSwgbGVuZ3RoOiBudW1iZXIpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZERhbmdsaW5nUmVmKGVsZW1lbnQsIGxlbmd0aCk7XG4gICAgICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdmFsdWUuX19pZF9fO1xuICAgICAgICAgICAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIoaWQpICYmIGlkID49IDAgJiYgaWQgPCBsZW5ndGggPyBudWxsIDogaWQ7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBuZXN0ZWQgb2YgT2JqZWN0LnZhbHVlcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYobmVzdGVkLCBsZW5ndGgpO1xuICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIGBxdWVyeS1hc3NldC1tZXRhYCBjYXJyaWVzIG5vIGB1cmxgL2BuYW1lYC90aW1lc3RhbXBzIOKAlCByZWFkaW5nIHRoZW0gb2ZmIHRoZVxuICAgICAgICAvLyBtZXRhIHJlY29yZCBwcm9kdWNlZCBhbiBhbGwtZW1wdHkgUHJlZmFiSW5mbyB0aGF0IHN0aWxsIHJlcG9ydGVkIHN1Y2Nlc3MgKCMyNSkuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHV1aWQpO1xuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogcmVzb2x2ZWQuZXJyb3IgfTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5pbmZvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcmVmYWIgbm90IGZvdW5kOiAke3V1aWR9YCB9O1xuXG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IHJlc29sdmVkLmluZm87XG4gICAgICAgIGNvbnN0IHVybDogc3RyaW5nID0gYXNzZXRJbmZvLnVybCB8fCAnJztcbiAgICAgICAgY29uc3Qgc3RhdHMgPSByZXNvbHZlZC5maWxlUGF0aCA/IHRoaXMuc3RhdFRpbWVzKHJlc29sdmVkLmZpbGVQYXRoKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGluZm86IFByZWZhYkluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBhc3NldEluZm8ubmFtZSxcbiAgICAgICAgICAgIHV1aWQ6IGFzc2V0SW5mby51dWlkIHx8IHV1aWQsXG4gICAgICAgICAgICBwYXRoOiB1cmwsXG4gICAgICAgICAgICBmb2xkZXI6IHVybCA/IHVybC5zdWJzdHJpbmcoMCwgdXJsLmxhc3RJbmRleE9mKCcvJykpIDogJycsXG4gICAgICAgICAgICBjcmVhdGVUaW1lOiBzdGF0cz8uY3JlYXRlVGltZSxcbiAgICAgICAgICAgIG1vZGlmeVRpbWU6IHN0YXRzPy5tb2RpZnlUaW1lXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgLi4uaW5mbywgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGggfSB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdFRpbWVzKGZpbGVQYXRoOiBzdHJpbmcpOiB7IGNyZWF0ZVRpbWU6IHN0cmluZzsgbW9kaWZ5VGltZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBjcmVhdGVUaW1lOiBzLmJpcnRodGltZS50b0lTT1N0cmluZygpLCBtb2RpZnlUaW1lOiBzLm10aW1lLnRvSVNPU3RyaW5nKCkgfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gRWFjaCBzdGFnZSByZXBvcnRzIGl0c2VsZi4gVGhlIG9sZCBzaW5nbGUgb3V0ZXIgY2F0Y2ggY29sbGFwc2VkIGV2ZXJ5IGZhaWx1cmVcbiAgICAgICAgLy8gaW50byBgRXJyb3IgdmFsaWRhdGluZyBwcmVmYWI6IEVycm9yOiBwYXJhbWV0ZXIgZXJyb3JgLCB3aGljaCBoaWQgdGhhdCB0aGVcbiAgICAgICAgLy8gcmVqZWN0ZWQgY2FsbCB3YXMgYHF1ZXJ5LXBhdGgoJycpYCDigJQgYHF1ZXJ5LWFzc2V0LW1ldGFgIG5ldmVyIHJldHVybnMgYSBgdXJsYFxuICAgICAgICAvLyB0byByZXNvbHZlLCBzbyB0aGUgcGF0aCBsb29rdXAgd2FzIGFsd2F5cyBoYW5kZWQgYW4gZW1wdHkgc3RyaW5nICgjMjUpLlxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc29sdmVkLmVycm9yKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciB2YWxpZGF0aW5nIHByZWZhYjogJHtyZXNvbHZlZC5lcnJvcn1gIH07XG4gICAgICAgIGlmICghcmVzb2x2ZWQuZmlsZVBhdGgpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NvdWxkIG5vdCByZXNvbHZlIHByZWZhYiBmaWxlIHBhdGggb24gZGlzaycgfTtcblxuICAgICAgICBsZXQgY29udGVudDogc3RyaW5nO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZWFkIHByZWZhYiBmaWxlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZWZhYkRhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByZWZhYkRhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ByZWZhYiBmaWxlIGZvcm1hdCBlcnJvcjogY2Fubm90IHBhcnNlIEpTT04nIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2YWxpZGF0aW9uUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UudmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHZhbGlkYXRpb25SZXN1bHQuaXNWYWxpZCwgaXNzdWVzOiB2YWxpZGF0aW9uUmVzdWx0Lmlzc3VlcyxcbiAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHZhbGlkYXRpb25SZXN1bHQubm9kZUNvdW50LCBjb21wb25lbnRDb3VudDogdmFsaWRhdGlvblJlc3VsdC5jb21wb25lbnRDb3VudCxcbiAgICAgICAgICAgICAgICB1cmw6IHJlc29sdmVkLnVybCwgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkID8gJ1ByZWZhYiBmb3JtYXQgaXMgdmFsaWQnIDogJ1ByZWZhYiBmb3JtYXQgaGFzIGlzc3VlcydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGR1cGxpY2F0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHV1aWQ6IHN0cmluZzsgbmV3TmFtZT86IHN0cmluZzsgdGFyZ2V0RGlyPzogc3RyaW5nIH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBQcmVmYWIgZHVwbGljYXRpb24gcmVxdWlyZXMgY29tcGxleCBzZXJpYWxpemF0aW9uIOKAlCBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdQcmVmYWIgZHVwbGljYXRpb24gaXMgbm90IGF2YWlsYWJsZSBwcm9ncmFtbWF0aWNhbGx5JyxcbiAgICAgICAgICAgIGluc3RydWN0aW9uOiAnVG8gZHVwbGljYXRlIGEgcHJlZmFiLCB1c2UgdGhlIENvY29zIENyZWF0b3IgZWRpdG9yOlxcbjEuIFNlbGVjdCB0aGUgcHJlZmFiIGluIHRoZSBBc3NldCBCcm93c2VyXFxuMi4gUmlnaHQtY2xpY2sgYW5kIHNlbGVjdCBDb3B5XFxuMy4gUGFzdGUgaW4gdGhlIHRhcmdldCBsb2NhdGlvbidcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIChhLmsuYS4gcmV2ZXJ0KSBhIHByZWZhYiBpbnN0YW5jZSB0byBpdHMgYXNzZXQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBCYWNrcyBib3RoIGBhY3Rpb249cmVzdG9yZWAgYW5kIGBhY3Rpb249cmV2ZXJ0YC4gQ29jb3MgQ3JlYXRvciAzLjguNyBleHBvc2VzXG4gICAgICogbm8gYHNjZW5lOnJldmVydC1wcmVmYWJgIG1lc3NhZ2UgYXQgYWxsIOKAlCBgcmVzdG9yZS1wcmVmYWJgIGlzIHdoYXQgdGhlIGVkaXRvclxuICAgICAqIGl0c2VsZiB1c2VzIGZvciB0aGUgaW5zcGVjdG9yJ3MgUmV2ZXJ0IGJ1dHRvbiAoIzEzKS4gSXQgdGFrZXMgcG9zaXRpb25hbFxuICAgICAqIGAocm9vdFV1aWQsIGFzc2V0VXVpZClgLCByZXR1cm5zIGEgYm9vbGVhbiwgYW5kIHJlY29yZHMgaXRzIG93biB1bmRvIGVudHJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQ6IHN0cmluZywgYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnbm9kZVV1aWQgaXMgcmVxdWlyZWQnIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHJvb3RVdWlkID0gY29udGV4dC5yb290VXVpZDtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkQXNzZXRVdWlkID0gYXNzZXRVdWlkIHx8IGNvbnRleHQuYXNzZXRVdWlkO1xuICAgICAgICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvdWxkIG5vdCByZXNvbHZlIHRoZSBwcmVmYWIgYXNzZXQgZm9yIG5vZGUgJHtub2RlVXVpZH0uIFBhc3MgYXNzZXRVdWlkIGV4cGxpY2l0bHkuYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXN0b3JlZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgcm9vdFV1aWQsIHJlc29sdmVkQXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGlmIChyZXN0b3JlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgcmVzdG9yZS1wcmVmYWIgZm9yIG5vZGUgJHtyb290VXVpZH0uIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgaW5zdGFuY2UgcmVzdG9yZWQgZnJvbSBhc3NldCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcmVzdG9yZSBwcmVmYWIgbm9kZTogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==