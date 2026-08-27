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
            let persisted = 'unverified';
            if (prefabPath !== null && mtimeBefore !== null) {
                const mtimeAfter = await this.waitForPrefabWrite(prefabPath, mtimeBefore);
                if (mtimeAfter !== null)
                    persisted = mtimeAfter > mtimeBefore;
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
                message: removedFileIds.length > 0
                    ? `Prefab updated successfully; removed ${removedFileIds.length} child node(s) apply-prefab left behind`
                    : 'Prefab updated successfully',
                data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, removedFileIds }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdXNCQUF1c0IsQ0FBQztRQUN0dEIsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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MkMsUUFBUSxpRUFBaUU7b0JBQzNILElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFO2lCQUM3RCxDQUFDO1lBQ04sQ0FBQztZQUNELE9BQU87Z0JBQ0gsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUU7Z0JBQzFELE9BQU8sRUFBRSxrREFBa0Q7YUFDOUQsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxrQ0FBa0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7UUFDeEYsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQWo0QkQsb0NBaTRCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0LCBQcmVmYWJJbmZvIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgbm9ybWFsaXplVmVjMyB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5pbXBvcnQgeyByZXNvbHZlQXNzZXQgfSBmcm9tICcuLi91dGlscy9hc3NldC1wYXRoJztcbmltcG9ydCB7IFByZWZhYkNyZWF0aW9uU2VydmljZSB9IGZyb20gJy4vbWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVByZWZhYiBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNyZWF0aW9uU2VydmljZSA9IG5ldyBQcmVmYWJDcmVhdGlvblNlcnZpY2UoKTtcblxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3ByZWZhYic7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByZWZhYnMgaW4gdGhlIHByb2plY3QuIEFjdGlvbnM6IGxpc3Q9bGlzdCBhbGwgcHJlZmFicywgbG9hZD1sb2FkIHByZWZhYiBieSBwYXRoLCBpbnN0YW50aWF0ZT1pbnN0YW50aWF0ZSBwcmVmYWIgaW4gc2NlbmUsIGNyZWF0ZT1jcmVhdGUgcHJlZmFiIGZyb20gbm9kZSwgdXBkYXRlPWFwcGx5IG5vZGUgY2hhbmdlcyB0byB0aGUgcHJlZmFiIGFzc2V0ICh2ZXJpZmllcyB0aGUgYXNzZXQgd2FzIHdyaXR0ZW4sIGFuZCByZW1vdmVzIGNoaWxkcmVuIGRlbGV0ZWQgZnJvbSB0aGUgaW5zdGFuY2UgdGhhdCBhcHBseS1wcmVmYWIgbGVhdmVzIGJlaGluZCksIHJldmVydD1yZXZlcnQgcHJlZmFiIGluc3RhbmNlIHRvIHRoZSBhc3NldCBzdGF0ZSAoYWxpYXMgb2YgcmVzdG9yZSksIGdldF9pbmZvPWdldCBwcmVmYWIgZGV0YWlscywgdmFsaWRhdGU9dmFsaWRhdGUgcHJlZmFiIGZpbGUgZm9ybWF0LCBkdXBsaWNhdGU9ZHVwbGljYXRlIGEgcHJlZmFiLCByZXN0b3JlPXJlc3RvcmUgcHJlZmFiIG5vZGUgdXNpbmcgYXNzZXQgKHdpdGggdW5kbykuIEZvciB1cGRhdGUvcmV2ZXJ0L3Jlc3RvcmUsIG5vZGVVdWlkIG1heSBiZSBhbnkgbm9kZSBpbiB0aGUgaW5zdGFuY2Ug4oCUIHRoZSBpbnN0YW5jZSByb290IGlzIHJlc29sdmVkIGF1dG9tYXRpY2FsbHkuIFByZXJlcXVpc2l0ZXM6IHByb2plY3QgbXVzdCBiZSBvcGVuIGluIENvY29zIENyZWF0b3IuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydsaXN0JywgJ2xvYWQnLCAnaW5zdGFudGlhdGUnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdyZXZlcnQnLCAnZ2V0X2luZm8nLCAndmFsaWRhdGUnLCAnZHVwbGljYXRlJywgJ3Jlc3RvcmUnXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydsaXN0JywgJ2xvYWQnLCAnaW5zdGFudGlhdGUnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdyZXZlcnQnLCAnZ2V0X2luZm8nLCAndmFsaWRhdGUnLCAnZHVwbGljYXRlJywgJ3Jlc3RvcmUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBsaXN0PWxpc3QgYWxsIHByZWZhYnMgaW4gcHJvamVjdCwgbG9hZD1sb2FkIHByZWZhYiBieSB1dWlkLCBpbnN0YW50aWF0ZT1pbnN0YW50aWF0ZSBwcmVmYWIgaW4gc2NlbmUsIGNyZWF0ZT1jcmVhdGUgcHJlZmFiIGZyb20gbm9kZSwgdXBkYXRlPWFwcGx5IG5vZGUgY2hhbmdlcyB0byBleGlzdGluZyBwcmVmYWIsIHJldmVydD1yZXZlcnQgcHJlZmFiIGluc3RhbmNlIHRvIHRoZSBhc3NldCBzdGF0ZSAoYWxpYXMgb2YgcmVzdG9yZSksIGdldF9pbmZvPWdldCBkZXRhaWxlZCBwcmVmYWIgaW5mbywgdmFsaWRhdGU9dmFsaWRhdGUgcHJlZmFiIGZpbGUgZm9ybWF0LCBkdXBsaWNhdGU9ZHVwbGljYXRlIGEgcHJlZmFiLCByZXN0b3JlPXJlc3RvcmUgcHJlZmFiIG5vZGUgdXNpbmcgcHJlZmFiIGFzc2V0IChidWlsdC1pbiB1bmRvKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1dWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCAoZm9yIGxvYWQsIGdldF9pbmZvLCB2YWxpZGF0ZSwgZHVwbGljYXRlLCByZXN0b3JlX25vZGUgYWN0aW9ucyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJlZmFiVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKGZvciBpbnN0YW50aWF0ZSBhY3Rpb24pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTY2VuZSBub2RlIFVVSUQgKGZvciBjcmVhdGUsIHVwZGF0ZSwgcmV2ZXJ0LCByZXN0b3JlIGFjdGlvbnMpLiBGb3IgdXBkYXRlL3JldmVydC9yZXN0b3JlIHRoaXMgbWF5IGJlIGFueSBub2RlIGluc2lkZSB0aGUgcHJlZmFiIGluc3RhbmNlOyB0aGUgaW5zdGFuY2Ugcm9vdCBpcyByZXNvbHZlZCBmcm9tIGl0LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzYXZlUGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXNzZXQgREIgcGF0aCB0byBzYXZlIHByZWZhYiAoZm9yIGNyZWF0ZSBhY3Rpb24sIGUuZy4gZGI6Ly9hc3NldHMvcHJlZmFicy9NeVByZWZhYi5wcmVmYWIpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BhcmVudCBub2RlIFVVSUQgZm9yIHRoZSBpbnN0YW50aWF0ZWQgcHJlZmFiIChmb3IgaW5zdGFudGlhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgcG9zaXRpb24ge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb3RhdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCByb3RhdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHNjYWxlIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9sZGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGb2xkZXIgdG8gc2VhcmNoIHByZWZhYnMgaW4gKGZvciBsaXN0IGFjdGlvbiwgZGVmYXVsdDogZGI6Ly9hc3NldHMpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmV3TmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTmV3IHByZWZhYiBuYW1lIChmb3IgZHVwbGljYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRhcmdldERpcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGRpcmVjdG9yeSBmb3IgZHVwbGljYXRlZCBwcmVmYWIgKGZvciBkdXBsaWNhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXNzZXRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCB0byByZXN0b3JlIGZyb20gKGZvciByZXZlcnQgYW5kIHJlc3RvcmUgYWN0aW9ucywgb3B0aW9uYWwg4oCUIHJlc29sdmVkIGZyb20gdGhlIG5vZGUgd2hlbiBvbWl0dGVkKSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxpc3QoYXJncyksXG4gICAgICAgIGxvYWQ6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxvYWQoYXJncyksXG4gICAgICAgIGluc3RhbnRpYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVJbnN0YW50aWF0ZShhcmdzKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVDcmVhdGUoYXJncyksXG4gICAgICAgIHVwZGF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlVXBkYXRlKGFyZ3MpLFxuICAgICAgICByZXZlcnQ6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJldmVydChhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmhhbmRsZUdldEluZm8oYXJncyksXG4gICAgICAgIHZhbGlkYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVWYWxpZGF0ZShhcmdzKSxcbiAgICAgICAgZHVwbGljYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVEdXBsaWNhdGUoYXJncyksXG4gICAgICAgIHJlc3RvcmU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJlc3RvcmVOb2RlKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxpc3QoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdldFByZWZhYkxpc3QoYXJncy5mb2xkZXIpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBsaXN0IHByZWZhYnMnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxvYWQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubG9hZFByZWZhYkJ5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gbG9hZCBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUluc3RhbnRpYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXByZWZhYlV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgncHJlZmFiVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5wb3NpdGlvbik7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnJvdGF0aW9uKTtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBub3JtYWxpemVWZWMzKGFyZ3Muc2NhbGUpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmluc3RhbnRpYXRlUHJlZmFiQnlVdWlkKHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICBjb25zdCBmYWlsdXJlID0gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiJyk7XG4gICAgICAgIGlmIChyZXN1bHQuaW5zdHJ1Y3Rpb24pIGZhaWx1cmUuaW5zdHJ1Y3Rpb24gPSByZXN1bHQuaW5zdHJ1Y3Rpb247XG4gICAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlQ3JlYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgc2F2ZVBhdGggfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgaWYgKCFzYXZlUGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlUGF0aCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBwcmVmYWJOYW1lID0gc2F2ZVBhdGguc3BsaXQoJy8nKS5wb3AoKT8ucmVwbGFjZSgnLnByZWZhYicsICcnKSB8fCAnTmV3UHJlZmFiJztcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVQcmVmYWIoeyBub2RlVXVpZCwgc2F2ZVBhdGgsIHByZWZhYk5hbWUgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVVwZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy51cGRhdGVQcmVmYWIobm9kZVV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byB1cGRhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXZlcnQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBhc3NldFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgLy8gYHJldmVydGAgYW5kIGByZXN0b3JlYCBhcmUgdGhlIHNhbWUgZWRpdG9yIG9wZXJhdGlvbiDigJQgc2VlIHJlc3RvcmVQcmVmYWJOb2RlLlxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byByZXZlcnQgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXRJbmZvKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdldFByZWZhYkluZm9CeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBwcmVmYWIgaW5mbycpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlVmFsaWRhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHZhbGlkYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlRHVwbGljYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkLCBuZXdOYW1lLCB0YXJnZXREaXIgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZHVwbGljYXRlUHJlZmFiQnlVdWlkKHsgdXVpZCwgbmV3TmFtZSwgdGFyZ2V0RGlyIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBkdXBsaWNhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXN0b3JlTm9kZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGFzc2V0VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byByZXN0b3JlIHByZWZhYiBub2RlJyk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUHJpdmF0ZSBpbXBsZW1lbnRhdGlvbiBtZXRob2RzIChwb3J0ZWQgZnJvbSBQcmVmYWJUb29scylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJlZmFiTGlzdChmb2xkZXI6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGZvbGRlci5lbmRzV2l0aCgnLycpID8gYCR7Zm9sZGVyfSoqLyoucHJlZmFiYCA6IGAke2ZvbGRlcn0vKiovKi5wcmVmYWJgO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICBjb25zdCBwcmVmYWJzOiBQcmVmYWJJbmZvW10gPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHBhdGg6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCxcbiAgICAgICAgICAgICAgICBmb2xkZXI6IGFzc2V0LnVybC5zdWJzdHJpbmcoMCwgYXNzZXQudXJsLmxhc3RJbmRleE9mKCcvJykpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBwcmVmYWJzIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxvYWRQcmVmYWJCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkRhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2xvYWQtYXNzZXQnLCB7IHV1aWQgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IHByZWZhYkRhdGEudXVpZCwgbmFtZTogcHJlZmFiRGF0YS5uYW1lLCBtZXNzYWdlOiAnUHJlZmFiIGxvYWRlZCBzdWNjZXNzZnVsbHknIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaW5zdGFudGlhdGVQcmVmYWJCeVV1aWQoYXJnczogeyBwcmVmYWJVdWlkOiBzdHJpbmc7IHBhcmVudFV1aWQ/OiBzdHJpbmc7IHBvc2l0aW9uPzogYW55OyByb3RhdGlvbj86IGFueTsgc2NhbGU/OiBhbnkgfSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUgfSA9IGFyZ3M7XG5cbiAgICAgICAgICAgIC8vIEFuIHVucmVzb2x2YWJsZSB1dWlkIG11c3QgYmUgZmF0YWw6IGNyZWF0ZS1ub2RlIHNpbGVudGx5IHJldHVybnMgbm90aGluZyBmb3IgaXQsXG4gICAgICAgICAgICAvLyB3aGljaCBwcmV2aW91c2x5IHByb2R1Y2VkIGEgc3VjY2VzcyBlbnZlbG9wZSB3aXRoIG5vIG5vZGVVdWlkICgjMTUpLlxuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHByZWZhYlV1aWQpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBQcmVmYWIgdXVpZCAnJHtwcmVmYWJVdWlkfScgbm90IGZvdW5kIGluIHRoZSBhc3NldCBEQmAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnVmVyaWZ5IHRoZSB1dWlkLCBhbmQgcmVmcmVzaCB0aGUgYXNzZXQgREIgKG1hbmFnZV9hc3NldCBhY3Rpb249cmVmcmVzaCkgaWYgdGhlIC5wcmVmYWIgZmlsZSB3YXMgd3JpdHRlbiBvdXRzaWRlIHRoZSBlZGl0b3IuJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNyZWF0ZU5vZGVPcHRpb25zOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiBwcmVmYWJVdWlkLFxuICAgICAgICAgICAgICAgIC8vIGB0eXBlYCBzZWxlY3RzIHRoZSBjcmVhdGVOb2RlRnJvbUFzc2V0KCkgYnJhbmNoIHRoYXQgaW5zdGFudGlhdGVzIGFcbiAgICAgICAgICAgICAgICAvLyBsaW5rZWQgUHJlZmFiSW5zdGFuY2UuIFdpdGhvdXQgaXQsIDMuOC43J3Mgbm9kZSBtYW5hZ2VyIGZhbGxzIGJhY2sgdG9cbiAgICAgICAgICAgICAgICAvLyBidWlsZGluZyBhIHBsYWluIG5vZGUgZnJvbSB0aGUgYXNzZXQncyByYXcgZHVtcCDigJQgYSBmbGF0dGVuZWQsXG4gICAgICAgICAgICAgICAgLy8gdW5saW5rZWQgY29weSB0aGF0IHJlcG9ydHMgc3VjY2VzcyBidXQgY2FycmllcyBubyBjYy5QcmVmYWJJbmZvIChzZWVcbiAgICAgICAgICAgICAgICAvLyBOb2RlTWFuYWdlci5jcmVhdGVOb2RlRnJvbUFzc2V0IGpzZG9jOiBcIm9wdGlvbnMudHlwZTog6LWE5rqQ57G75Z6LXCIpLlxuICAgICAgICAgICAgICAgIHR5cGU6IGFzc2V0SW5mby50eXBlXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAocGFyZW50VXVpZCkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLnBhcmVudCA9IHBhcmVudFV1aWQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5uYW1lID0gYXNzZXRJbmZvLm5hbWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIGBwb3NpdGlvbmAgaXMgYSBkb2N1bWVudGVkIHRvcC1sZXZlbCBDcmVhdGVOb2RlT3B0aW9ucyBmaWVsZDsgYGR1bXBgXG4gICAgICAgICAgICAgICAgLy8gaXMgZXhwbGljaXRseSBjb21tZW50ZWQgb3V0IGFzIHVudXNlZCBpbiBAY29jb3MvY3JlYXRvci10eXBlcyDigJQgaXQgd2FzXG4gICAgICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlZCwgc28gaW5zdGFudGlhdGVkIHByZWZhYnMgbmV2ZXIgcGlja2VkIHVwIHRoaXMgcG9zaXRpb24uXG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIGNyZWF0ZU5vZGVPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBBcnJheS5pc0FycmF5KG5vZGVVdWlkKSA/IG5vZGVVdWlkWzBdIDogbm9kZVV1aWQ7XG5cbiAgICAgICAgICAgIC8vIE5ldmVyIHJlcG9ydCBzdWNjZXNzIHdpdGhvdXQgYSBub2RlIGlkIOKAlCB0aGUgY2FsbGVyIHdvdWxkIGJ1aWxkIG9uIGEgc2NlbmVcbiAgICAgICAgICAgIC8vIHRoYXQgc2lsZW50bHkgbGFja3MgdGhlIG5vZGUgKCMxNSkuXG4gICAgICAgICAgICBpZiAoIXV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBjcmVhdGUtbm9kZSByZXR1cm5lZCBubyBub2RlIHV1aWQgZm9yIHByZWZhYiAnJHtwcmVmYWJVdWlkfScg4oCUIG5vdGhpbmcgd2FzIGluc3RhbnRpYXRlZGAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnRW5zdXJlIGEgc2NlbmUgaXMgb3BlbiBhbmQgdGhlIHByZWZhYiBhc3NldCBpcyB2YWxpZCwgdGhlbiByZXRyeS4nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXBwbHkgcm90YXRpb24gYW5kIHNjYWxlIGlmIHByb3ZpZGVkXG4gICAgICAgICAgICBpZiAocm90YXRpb24pIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6ICdldWxlckFuZ2xlcycsXG4gICAgICAgICAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHJvdGF0aW9uLCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHsvKiBub24tZmF0YWwgKi99KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzY2FsZSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogJ3NjYWxlJyxcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogc2NhbGUsIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gey8qIG5vbi1mYXRhbCAqL30pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZhYiBpbnN0YW50aWF0ZWQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgRmFpbGVkIHRvIGluc3RhbnRpYXRlIHByZWZhYjogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnQ2hlY2sgdGhhdCB0aGUgcHJlZmFiVXVpZCBpcyBjb3JyZWN0IGFuZCB0aGUgYXNzZXQgREIgaXMgcmVhZHkuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlUHJlZmFiKGFyZ3M6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXRoUGFyYW0gPSBhcmdzLnByZWZhYlBhdGggfHwgYXJncy5zYXZlUGF0aDtcbiAgICAgICAgICAgIGlmICghcGF0aFBhcmFtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTWlzc2luZyBwcmVmYWIgcGF0aCBwYXJhbWV0ZXIuIFByb3ZpZGUgc2F2ZVBhdGguJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJOYW1lID0gYXJncy5wcmVmYWJOYW1lIHx8ICdOZXdQcmVmYWInO1xuICAgICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoUGFyYW0uZW5kc1dpdGgoJy5wcmVmYWInKSA/XG4gICAgICAgICAgICAgICAgcGF0aFBhcmFtIDogYCR7cGF0aFBhcmFtfS8ke3ByZWZhYk5hbWV9LnByZWZhYmA7XG5cbiAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVDaGlsZHJlbiA9IGFyZ3MuaW5jbHVkZUNoaWxkcmVuICE9PSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVDb21wb25lbnRzID0gYXJncy5pbmNsdWRlQ29tcG9uZW50cyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RGJSZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJXaXRoQXNzZXREQihcbiAgICAgICAgICAgICAgICBhcmdzLm5vZGVVdWlkLCBmdWxsUGF0aCwgcHJlZmFiTmFtZSwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50c1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChhc3NldERiUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhc3NldERiUmVzdWx0O1xuICAgICAgICAgICAgLy8gQSBkZWZlY3RpdmUgd3JpdGUgaXMgYSByZXN1bHQsIG5vdCBhbiB1bmF2YWlsYWJsZSBwYXRoIOKAlCByZXRyeWluZyB0aHJvdWdoXG4gICAgICAgICAgICAvLyB0aGUgZmFsbGJhY2sgY2hhaW4gd291bGQgcmUtc2VyaWFsaXplIHRoZSBzYW1lIGxvc3MgYW5kIG1hc2sgaXQgKCMyOCkuXG4gICAgICAgICAgICBpZiAoYXNzZXREYlJlc3VsdC5mYXRhbCkgcmV0dXJuIGFzc2V0RGJSZXN1bHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IG5hdGl2ZVJlc3VsdCA9IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYk5hdGl2ZVN0dWIoKTtcbiAgICAgICAgICAgIGlmIChuYXRpdmVSZXN1bHQuc3VjY2VzcykgcmV0dXJuIG5hdGl2ZVJlc3VsdDtcblxuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYkN1c3RvbShhcmdzLm5vZGVVdWlkLCBmdWxsUGF0aCwgcHJlZmFiTmFtZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSB0aGUgcHJlZmFiLWluc3RhbmNlIGNvbnRleHQgZm9yIGEgbm9kZS5cbiAgICAgKlxuICAgICAqIENvY29zIENyZWF0b3IgZHJpdmVzIGJvdGggcHJlZmFiIG1lc3NhZ2VzIGZyb20gdGhlIG5vZGUgZHVtcCdzIGBfX3ByZWZhYl9fYFxuICAgICAqIGJsb2NrIOKAlCBgcm9vdFV1aWRgICh0aGUgcHJlZmFiLWluc3RhbmNlIFJPT1QsIG5vdCB3aGljaGV2ZXIgZGVzY2VuZGFudCB0aGVcbiAgICAgKiBjYWxsZXIgaGFwcGVuZWQgdG8gcGFzcykgYW5kIGB1dWlkYCAodGhlIGJhY2tpbmcgcHJlZmFiIGFzc2V0KS4gU2VlIDMuOC43XG4gICAgICogYHJlc291cmNlcy8zZC9lbmdpbmUvZWRpdG9yL2luc3BlY3Rvci9jb250cmlidXRpb25zL25vZGUuanNgOlxuICAgICAqICAgcmVxdWVzdCgnc2NlbmUnLCAnYXBwbHktcHJlZmFiJywgcHJlZmFiLnJvb3RVdWlkKVxuICAgICAqICAgcmVxdWVzdCgnc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCBwcmVmYWIucm9vdFV1aWQsIHByZWZhYi51dWlkKVxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHF1ZXJ5IG5vZGUgJHtub2RlVXVpZH06ICR7ZXJyLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vZGUgbm90IGZvdW5kJyB9O1xuXG4gICAgICAgIGNvbnN0IHByZWZhYiA9IG5vZGVEYXRhLl9fcHJlZmFiX187XG4gICAgICAgIGlmICghcHJlZmFiKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IGlzIG5vdCBwYXJ0IG9mIGEgcHJlZmFiIGluc3RhbmNlYCB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgcm9vdFV1aWQ6IHByZWZhYi5yb290VXVpZCB8fCBub2RlVXVpZCxcbiAgICAgICAgICAgIGFzc2V0VXVpZDogcHJlZmFiLnV1aWQgfHwgcHJlZmFiLnByZWZhYlN0YXRlSW5mbz8uYXNzZXRVdWlkXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSBhIHByZWZhYiBhc3NldCdzIG9uLWRpc2sgcGF0aCwgb3IgbnVsbCB3aGVuIGl0IGNhbm5vdCBiZSBkZXRlcm1pbmVkLlxuICAgICAqXG4gICAgICogR29lcyB0aHJvdWdoIGBxdWVyeS1hc3NldC1pbmZvYCwgbm90IGBxdWVyeS1hc3NldC1tZXRhYDogdGhlIG1ldGEgcmVjb3JkIGhhcyBub1xuICAgICAqIGB1cmxgIGZpZWxkLCBzbyB0aGUgb2xkIGxvb2t1cCByZXNvbHZlZCB0byBudWxsIGZvciBldmVyeSBhc3NldCBhbmQgbGVmdCB0aGVcbiAgICAgKiBwb3N0LWFwcGx5IHdyaXRlIGNoZWNrIHBlcm1hbmVudGx5IGB1bnZlcmlmaWVkYCAoIzI1KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVQcmVmYWJGaWxlUGF0aChhc3NldFV1aWQ/OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgaWYgKCFhc3NldFV1aWQpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gKGF3YWl0IHJlc29sdmVBc3NldChhc3NldFV1aWQpKS5maWxlUGF0aDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRNdGltZU1zKGZpbGVQYXRoOiBzdHJpbmcgfCBudWxsKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgICAgIGlmICghZmlsZVBhdGgpIHJldHVybiBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5tdGltZU1zO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIFBvbGwgZm9yIHRoZSBwcmVmYWIgZmlsZSB0byBiZSByZXdyaXR0ZW47IGFzc2V0LWRiIG1heSBmbHVzaCBzaG9ydGx5IGFmdGVyIHRoZSBtZXNzYWdlIHJlc29sdmVzLiAqL1xuICAgIHByaXZhdGUgYXN5bmMgd2FpdEZvclByZWZhYldyaXRlKGZpbGVQYXRoOiBzdHJpbmcsIGJhc2VsaW5lTXM6IG51bWJlciwgdGltZW91dE1zID0gMjAwMCk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XG4gICAgICAgIGxldCBtdGltZSA9IHRoaXMuc3RhdE10aW1lTXMoZmlsZVBhdGgpO1xuICAgICAgICB3aGlsZSAobXRpbWUgIT09IG51bGwgJiYgbXRpbWUgPD0gYmFzZWxpbmVNcyAmJiBEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcbiAgICAgICAgICAgIG10aW1lID0gdGhpcy5zdGF0TXRpbWVNcyhmaWxlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG10aW1lO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlUHJlZmFiKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFjb250ZXh0LnN1Y2Nlc3MpIHJldHVybiBjb250ZXh0O1xuICAgICAgICAgICAgY29uc3QgeyByb290VXVpZCwgYXNzZXRVdWlkIH0gPSBjb250ZXh0O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJQYXRoID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiRmlsZVBhdGgoYXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IG10aW1lQmVmb3JlID0gdGhpcy5zdGF0TXRpbWVNcyhwcmVmYWJQYXRoKTtcblxuICAgICAgICAgICAgLy8gYHNjZW5lOmFwcGx5LXByZWZhYmAgdGFrZXMgdGhlIGluc3RhbmNlIHJvb3QgdXVpZCBhcyBhIFBPU0lUSU9OQUwgc3RyaW5nXG4gICAgICAgICAgICAvLyBhbmQgcmVzb2x2ZXMgdG8gYSBib29sZWFuLiBUaGUgb2xkIGB7IG5vZGU6IHV1aWQgfWAgb2JqZWN0IGZvcm0gcmVzb2x2ZWRcbiAgICAgICAgICAgIC8vIHdpdGhvdXQgdGhyb3dpbmcgYnV0IG5ldmVyIHdyb3RlIHRoZSBhc3NldCDigJQgYSBzaWxlbnQgbm8tb3AgcmVwb3J0ZWQgYXNcbiAgICAgICAgICAgIC8vIHN1Y2Nlc3MgKCMxMikuXG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAnYXBwbHktcHJlZmFiJywgcm9vdFV1aWQpO1xuICAgICAgICAgICAgaWYgKGFwcGxpZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgRWRpdG9yIHJlamVjdGVkIGFwcGx5LXByZWZhYiBmb3Igbm9kZSAke3Jvb3RVdWlkfS4gQ29uZmlybSBpdCBpcyBhIHByZWZhYi1pbnN0YW5jZSByb290IHdpdGggYSB2YWxpZCBhc3NldCBsaW5rLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGggfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZlcmlmeSB0aGUgYXNzZXQgd2FzIGFjdHVhbGx5IHdyaXR0ZW4gcmF0aGVyIHRoYW4gdHJ1c3RpbmcgYSBub24tdGhyb3dpbmdcbiAgICAgICAgICAgIC8vIG1lc3NhZ2UuIGB1bnZlcmlmaWVkYCBtZWFucyB0aGUgcGF0aCBjb3VsZCBub3QgYmUgcmVzb2x2ZWQsIG5vdCB0aGF0IHRoZVxuICAgICAgICAgICAgLy8gd3JpdGUgZmFpbGVkLlxuICAgICAgICAgICAgbGV0IHBlcnNpc3RlZDogYm9vbGVhbiB8ICd1bnZlcmlmaWVkJyA9ICd1bnZlcmlmaWVkJztcbiAgICAgICAgICAgIGlmIChwcmVmYWJQYXRoICE9PSBudWxsICYmIG10aW1lQmVmb3JlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbXRpbWVBZnRlciA9IGF3YWl0IHRoaXMud2FpdEZvclByZWZhYldyaXRlKHByZWZhYlBhdGgsIG10aW1lQmVmb3JlKTtcbiAgICAgICAgICAgICAgICBpZiAobXRpbWVBZnRlciAhPT0gbnVsbCkgcGVyc2lzdGVkID0gbXRpbWVBZnRlciA+IG10aW1lQmVmb3JlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocGVyc2lzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYGFwcGx5LXByZWZhYiByZXBvcnRlZCBubyBlcnJvciBidXQgJHtwcmVmYWJQYXRofSB3YXMgbm90IHJld3JpdHRlbi4gVGhlIG5vZGUgbWF5IGhhdmUgbm8gb3ZlcnJpZGVzIHRvIGFwcGx5LCBvciBpdHMgcHJlZmFiIGxpbmsgaXMgc3RhbGUuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBgYXBwbHktcHJlZmFiYCB3cml0ZXMgcHJvcGVydHkgb3ZlcnJpZGVzIGJ1dCBkb2VzIG5vdCByZW1vdmUgYSBjaGlsZCBub2RlXG4gICAgICAgICAgICAvLyBkZWxldGVkIGZyb20gdGhlIGluc3RhbmNlICgjMjEpIOKAlCB0aGUgbXRpbWUgZ3VhcmQgYWJvdmUgY2Fubm90IHNlZSB0aGlzLFxuICAgICAgICAgICAgLy8gYmVjYXVzZSBhIGRlbGV0aW9uIHN0aWxsIHByb2R1Y2VzIG92ZXJyaWRlcyBlbHNld2hlcmUsIHNvIHRoZSBmaWxlIElTXG4gICAgICAgICAgICAvLyByZXdyaXR0ZW4gYW5kIGBwZXJzaXN0ZWRgIGlzIGdlbnVpbmVseSBgdHJ1ZWAuIENvbXBhcmUgdGhlIGxpdmUgaW5zdGFuY2Unc1xuICAgICAgICAgICAgLy8gZmlsZUlkcyBhZ2FpbnN0IHRoZSBmcmVzaGx5LXdyaXR0ZW4gYXNzZXQncyB0byBjYXRjaCB0aGUgc3BlY2lmaWMgZmFpbHVyZVxuICAgICAgICAgICAgLy8gbW9kZSB0aGUgbXRpbWUgY2hlY2sgY2Fubm90OiBhIGNoaWxkIHN0aWxsIHByZXNlbnQgb24gZGlzayB0aGF0IG5vIGxvbmdlclxuICAgICAgICAgICAgLy8gZXhpc3RzIGluIHRoZSBzY2VuZS4gQW55dGhpbmcgZm91bmQgaXMgdGhlbiByZW1vdmVkIGZyb20gdGhlIGFzc2V0LCBzaW5jZVxuICAgICAgICAgICAgLy8gcmVwb3J0aW5nIHRoZSBzdGFsZSBjaGlsZHJlbiBpcyBub3QgdGhlIHNhbWUgYXMgaG9ub3VyaW5nIHRoZSBkZWxldGlvbi5cbiAgICAgICAgICAgIGxldCBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBpZiAocGVyc2lzdGVkID09PSB0cnVlICYmIHByZWZhYlBhdGgpIHtcbiAgICAgICAgICAgICAgICBvcnBoYW5lZEZpbGVJZHMgPSBhd2FpdCB0aGlzLmZpbmRPcnBoYW5lZENoaWxkRmlsZUlkcyhyb290VXVpZCwgcHJlZmFiUGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgcmVtb3ZlZEZpbGVJZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBpZiAob3JwaGFuZWRGaWxlSWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZW1vdmFsID0gYXdhaXQgdGhpcy5yZW1vdmVPcnBoYW5lZENoaWxkcmVuRnJvbUFzc2V0KFxuICAgICAgICAgICAgICAgICAgICBwcmVmYWJQYXRoIGFzIHN0cmluZywgb3JwaGFuZWRGaWxlSWRzLCByb290VXVpZCwgYXNzZXRVdWlkXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICBpZiAoIXJlbW92YWwuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYGFwcGx5LXByZWZhYiB3cm90ZSAke3ByZWZhYlBhdGh9LCBidXQgaXQgc3RpbGwgY29udGFpbnMgJHtvcnBoYW5lZEZpbGVJZHMubGVuZ3RofSBjaGlsZCBub2RlKHMpIChmaWxlSWQ6ICR7b3JwaGFuZWRGaWxlSWRzLmpvaW4oJywgJyl9KSB0aGF0IG5vIGxvbmdlciBleGlzdCBpbiB0aGUgc2NlbmUgaW5zdGFuY2UuIENvY29zIENyZWF0b3IgMy44LjcncyBhcHBseS1wcmVmYWIgZG9lcyBub3QgcmVtb3ZlIGRlbGV0ZWQgY2hpbGRyZW4sIGFuZCByZW1vdmluZyB0aGVtIGhlcmUgd2FzIGRlY2xpbmVkOiAke3JlbW92YWwuZXJyb3J9LiBUaGUgYXNzZXQgaXMgYnl0ZS1mb3ItYnl0ZSB1bmNoYW5nZWQg4oCUIGRlbGV0ZSBhbmQgcmVjcmVhdGUgdGhlIHByZWZhYiwgb3IgcmVtb3ZlIHRoZSBzdGFsZSBlbnRyaWVzIG1hbnVhbGx5LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQsIG9ycGhhbmVkRmlsZUlkcyB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJlbW92ZWRGaWxlSWRzID0gb3JwaGFuZWRGaWxlSWRzO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogcmVtb3ZlZEZpbGVJZHMubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IGBQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHk7IHJlbW92ZWQgJHtyZW1vdmVkRmlsZUlkcy5sZW5ndGh9IGNoaWxkIG5vZGUocykgYXBwbHktcHJlZmFiIGxlZnQgYmVoaW5kYFxuICAgICAgICAgICAgICAgICAgICA6ICdQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCwgcmVtb3ZlZEZpbGVJZHMgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZmlsZUlkcyBvZiBwcmVmYWItdHJhY2tlZCBub2RlcyBwcmVzZW50IGluIHRoZSB3cml0dGVuIGFzc2V0IGJ1dCBhYnNlbnRcbiAgICAgKiBmcm9tIHRoZSBsaXZlIHNjZW5lIGluc3RhbmNlIOKAlCBjaGlsZHJlbiBgYXBwbHktcHJlZmFiYCBmYWlsZWQgdG8gcmVtb3ZlICgjMjEpLlxuICAgICAqIERldGVjdGlvbiBpcyBiZXN0LWVmZm9ydDogYW55IGZhaWx1cmUgcmV0dXJucyBubyBvcnBoYW5zIHJhdGhlciB0aGFuIGEgZmFsc2VcbiAgICAgKiBwb3NpdGl2ZSwgc2luY2UgdGhpcyBjaGVjayBtdXN0IG5ldmVyIG1hc2sgYSBnZW51aW5lIHN1Y2Nlc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZywgcHJlZmFiUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbGl2ZUZpbGVJZHMgPSBhd2FpdCB0aGlzLmNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQpO1xuICAgICAgICAgICAgaWYgKGxpdmVGaWxlSWRzLnNpemUgPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHByZWZhYlBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShhc3NldERhdGEpKSByZXR1cm4gW107XG4gICAgICAgICAgICBjb25zdCBhc3NldEZpbGVJZHMgPSB0aGlzLmNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKGFzc2V0RGF0YSk7XG4gICAgICAgICAgICByZXR1cm4gWy4uLmFzc2V0RmlsZUlkc10uZmlsdGVyKGlkID0+ICFsaXZlRmlsZUlkcy5oYXMoaWQpKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogV2FsayBhIGxpdmUgcHJlZmFiLWluc3RhbmNlIHN1YnRyZWUgYW5kIGNvbGxlY3QgdGhlIGBfX3ByZWZhYl9fLmZpbGVJZGAgb2YgZXZlcnkgbm9kZS4gKi9cbiAgICBwcml2YXRlIGFzeW5jIGNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZyk6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgICAgICAgY29uc3QgZmlsZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB2aXNpdCA9IGFzeW5jICh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVJZCA9IG5vZGVEYXRhLl9fcHJlZmFiX18/LmZpbGVJZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZUlkID09PSAnc3RyaW5nJyAmJiBmaWxlSWQpIGZpbGVJZHMuYWRkKGZpbGVJZCk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbjogc3RyaW5nW10gPSBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSA/IG5vZGVEYXRhLmNoaWxkcmVuIDogW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkVXVpZCBvZiBjaGlsZHJlbikgYXdhaXQgdmlzaXQoY2hpbGRVdWlkKTtcbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgdmlzaXQocm9vdFV1aWQpO1xuICAgICAgICByZXR1cm4gZmlsZUlkcztcbiAgICB9XG5cbiAgICAvKiogRXh0cmFjdCBldmVyeSBgY2MuTm9kZWAgZW50cnkncyBmaWxlSWQgZnJvbSBhIHdyaXR0ZW4gYC5wcmVmYWJgIGFzc2V0J3MgSlNPTiBhcnJheS4gKi9cbiAgICBwcml2YXRlIGNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGE6IGFueVtdKTogU2V0PHN0cmluZz4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCkgZmlsZUlkcy5hZGQoZmlsZUlkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZUlkcztcbiAgICB9XG5cbiAgICAvKiogVGhlIGZpbGVJZCByZWNvcmRlZCBvbiB0aGUgYGNjLk5vZGVgIGF0IGBpbmRleGAsIG9yIG51bGwgd2hlbiBpdCBoYXMgbm9uZS4gKi9cbiAgICBwcml2YXRlIGZpbGVJZE9mTm9kZShwcmVmYWJEYXRhOiBhbnlbXSwgaW5kZXg6IG51bWJlcik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBlbnRyeS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgIGlmICh0eXBlb2YgcHJlZmFiSW5mb0luZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IHByZWZhYkRhdGFbcHJlZmFiSW5mb0luZGV4XT8uZmlsZUlkO1xuICAgICAgICByZXR1cm4gdHlwZW9mIGZpbGVJZCA9PT0gJ3N0cmluZycgJiYgZmlsZUlkID8gZmlsZUlkIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2UgYXJyYXlzIHdob3NlIGVsZW1lbnQgb3JkZXIgaXMgc3RydWN0dXJhbCDigJQgYSByZW1vdmVkIGVudHJ5IG11c3QgYmUgc3BsaWNlZFxuICAgICAqIG91dCBvZiB0aGVtLCBuZXZlciBsZWZ0IGJlaGluZCBhcyBhIG51bGwgaG9sZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0cnVjdHVyYWxSZWZBcnJheXMgPSBbJ19jaGlsZHJlbicsICdfY29tcG9uZW50cycsICduZXN0ZWRQcmVmYWJJbnN0YW5jZVJvb3RzJywgJ3RhcmdldE92ZXJyaWRlcyddO1xuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlcyBgYXBwbHktcHJlZmFiYCBsZWZ0IGJlaGluZCwgdGhlbiBoYW5kIHRoZSByZXN1bHRcbiAgICAgKiB0byB0aGUgZWRpdG9yIGZvciBhY2NlcHRhbmNlICgjMjEpLlxuICAgICAqXG4gICAgICogVGhyZWUgZ2F0ZXMgZ3VhcmQgdGhlIHJld3JpdGUsIGFuZCB0aGUgcHJlLXN1cmdlcnkgYnl0ZXMgYXJlIHJlc3RvcmVkIGF0IGFueSBvZiB0aGVtOlxuICAgICAqIHRoZSBncmFwaCByZXdyaXRlIHJlZnVzZXMgYSBsYXlvdXQgaXQgZG9lcyBub3QgcmVjb2duaXNlLCB0aGUgcmV3cml0dGVuIGdyYXBoIGlzXG4gICAgICogdmFsaWRhdGVkIGJlZm9yZSBpdCBpcyB3cml0dGVuLCBhbmQgYGFzc2V0LWRiOnJlaW1wb3J0LWFzc2V0YCBpcyB0aGUgZW5naW5lJ3Mgb3duXG4gICAgICogdmVyZGljdCBvbiB0aGUgcmVzdWx0IOKAlCBhbiBpbnRlcm5hbGx5IGNvbnNpc3RlbnQgZ3JhcGggY2FuIHN0aWxsIGJlIG9uZSB0aGUgaW1wb3J0ZXJcbiAgICAgKiByZWplY3RzLCBhbmQgb25seSB0aGUgZWRpdG9yIGNhbiBzYXkgc28uIEEgZGVjbGluZWQgcmVtb3ZhbCBsZWF2ZXMgdGhlIGNhbGxlciBleGFjdGx5XG4gICAgICogd2hlcmUgaXQgc3Rvb2QgYmVmb3JlIHRoaXMgbWV0aG9kIGV4aXN0ZWQ6IGEgaGFyZCBmYWlsdXJlIG5hbWluZyB0aGUgc3RhbGUgZmlsZUlkcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZU9ycGhhbmVkQ2hpbGRyZW5Gcm9tQXNzZXQoXG4gICAgICAgIHByZWZhYlBhdGg6IHN0cmluZyxcbiAgICAgICAgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSxcbiAgICAgICAgcm9vdFV1aWQ6IHN0cmluZyxcbiAgICAgICAgYXNzZXRVdWlkOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBsZXQgb3JpZ2luYWxUZXh0OiBzdHJpbmc7XG4gICAgICAgIGxldCBwcmVmYWJEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBvcmlnaW5hbFRleHQgPSBmcy5yZWFkRmlsZVN5bmMocHJlZmFiUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICBwcmVmYWJEYXRhID0gSlNPTi5wYXJzZShvcmlnaW5hbFRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgdGhlIGFzc2V0IGNvdWxkIG5vdCBiZSByZS1yZWFkICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICd0aGUgYXNzZXQgaXMgbm90IGEgc2VyaWFsaXplZCBlbnRyeSBhcnJheScgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpdmVGaWxlSWRzID0gYXdhaXQgdGhpcy5jb2xsZWN0SW5zdGFuY2VGaWxlSWRzKHJvb3RVdWlkKTtcbiAgICAgICAgY29uc3QgZmlsZUlkc0JlZm9yZSA9IHRoaXMuY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMocHJlZmFiRGF0YSk7XG4gICAgICAgIGNvbnN0IHJld3JpdHRlbiA9IHRoaXMucHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGEsIG9ycGhhbmVkRmlsZUlkcywgbGl2ZUZpbGVJZHMpO1xuICAgICAgICBpZiAoIXJld3JpdHRlbikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGFzc2V0IGdyYXBoIGRvZXMgbm90IG1hdGNoIHRoZSBsYXlvdXQgdGhpcyByZW1vdmFsIHVuZGVyc3RhbmRzJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW52YWxpZCA9IHRoaXMudmFsaWRhdGVQcmVmYWJHcmFwaChyZXdyaXR0ZW4sIG9ycGhhbmVkRmlsZUlkcywgZmlsZUlkc0JlZm9yZSk7XG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGdyYXBoIGZhaWxlZCB2YWxpZGF0aW9uICgke2ludmFsaWR9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHJld3JpdHRlbiwgbnVsbCwgb3JpZ2luYWxUZXh0LmluY2x1ZGVzKCdcXG4nKSA/IDIgOiAwKSwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGFzc2V0IGNvdWxkIG5vdCBiZSB3cml0dGVuICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaW1wb3J0ZWQ6IGJvb2xlYW47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IChhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0VXVpZCkpICE9PSBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW1wb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZVByZWZhYkZpbGUocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3RoZSBlZGl0b3IgcmVqZWN0ZWQgdGhlIHJld3JpdHRlbiBhc3NldCBvbiByZWltcG9ydCcgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1cnZpdm9ycyA9IGF3YWl0IHRoaXMuZmluZE9ycGhhbmVkQ2hpbGRGaWxlSWRzKHJvb3RVdWlkLCBwcmVmYWJQYXRoKTtcbiAgICAgICAgaWYgKHN1cnZpdm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVQcmVmYWJGaWxlKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGByZW1vdmFsIHJhbiBidXQgZmlsZUlkKHMpICR7c3Vydml2b3JzLmpvaW4oJywgJyl9IGFyZSBzdGlsbCBvcnBoYW5lZGAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICAvKiogUHV0IHRoZSBwcmUtc3VyZ2VyeSBieXRlcyBiYWNrLCBzbyBhIGRlY2xpbmVkIHJlbW92YWwgbGVhdmVzIHRoZSBhc3NldCB1bnRvdWNoZWQuICovXG4gICAgcHJpdmF0ZSByZXN0b3JlUHJlZmFiRmlsZShwcmVmYWJQYXRoOiBzdHJpbmcsIG9yaWdpbmFsVGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm90aGluZyBmdXJ0aGVyIHRvIGRvIGhlcmUg4oCUIHRoZSBjYWxsZXIgcmVwb3J0cyB0aGUgZmFpbHVyZSBlaXRoZXIgd2F5LlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJvcCBldmVyeSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlIGZyb20gYSBzZXJpYWxpemVkIHByZWZhYiBhcnJheSBhbmQgcmUtaW5kZXggdGhlIHdob2xlXG4gICAgICogZ3JhcGguIFJldHVybnMgbnVsbCDigJQgY2hhbmdpbmcgbm90aGluZyDigJQgd2hlbmV2ZXIgdGhlIGdyYXBoIGRvZXMgbm90IG1hdGNoIHdoYXQgdGhpc1xuICAgICAqIHJld3JpdGUgcmVsaWVzIG9uLCByYXRoZXIgdGhhbiBwcm9kdWNpbmcgYW4gYXNzZXQgbm9ib2R5IGNhbiBsb2FkLlxuICAgICAqL1xuICAgIHByaXZhdGUgcHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGE6IGFueVtdLCBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdLCBsaXZlRmlsZUlkczogU2V0PHN0cmluZz4pOiBhbnlbXSB8IG51bGwge1xuICAgICAgICBjb25zdCBub2RlSW5kZXhCeUZpbGVJZCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCAmJiAhbm9kZUluZGV4QnlGaWxlSWQuaGFzKGZpbGVJZCkpIG5vZGVJbmRleEJ5RmlsZUlkLnNldChmaWxlSWQsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlbW92ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgY29uc3QgcGVuZGluZzogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2Ygb3JwaGFuZWRGaWxlSWRzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IG5vZGVJbmRleEJ5RmlsZUlkLmdldChmaWxlSWQpO1xuICAgICAgICAgICAgLy8gRGV0ZWN0aW9uIGFuZCByZW1vdmFsIGRpc2FncmVlIGFib3V0IHRoZSBhc3NldCDigJQgZG8gbm90IGd1ZXNzIGF0IHRoZSBncmFwaC5cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHBlbmRpbmcucHVzaChpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAocGVuZGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5kZXggPSBwZW5kaW5nLnNoaWZ0KCkgYXMgbnVtYmVyO1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKG5vZGVJbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHByZWZhYkRhdGFbbm9kZUluZGV4XTtcbiAgICAgICAgICAgIGlmICghbm9kZSB8fCBub2RlLl9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmVtb3ZlZC5hZGQobm9kZUluZGV4KTtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gbm9kZS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICBpZiAodHlwZW9mIHByZWZhYkluZm9JbmRleCA9PT0gJ251bWJlcicpIHJlbW92ZWQuYWRkKHByZWZhYkluZm9JbmRleCk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkobm9kZS5fY29tcG9uZW50cykgPyBub2RlLl9jb21wb25lbnRzIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50SW5kZXggIT09ICdudW1iZXInKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICByZW1vdmVkLmFkZChjb21wb25lbnRJbmRleCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZGV4ID0gcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0/Ll9fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wUHJlZmFiSW5kZXggPT09ICdudW1iZXInKSByZW1vdmVkLmFkZChjb21wUHJlZmFiSW5kZXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiBBcnJheS5pc0FycmF5KG5vZGUuX2NoaWxkcmVuKSA/IG5vZGUuX2NoaWxkcmVuIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgLy8gQSBkZXNjZW5kYW50IG9mIGEgZGVsZXRlZCBjaGlsZCBjYW5ub3Qgc3RpbGwgYmUgbGl2ZSBpbiB0aGUgaW5zdGFuY2UuIElmIG9uZVxuICAgICAgICAgICAgICAgIC8vIGlzLCB0aGUgb3JwaGFuIHNldCBpcyBub3Qgd2hhdCB0aGlzIHJld3JpdGUgYXNzdW1lcyBhbmQgaXQgbXVzdCBub3QgcHJvY2VlZC5cbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEZpbGVJZCA9IHRoaXMuZmlsZUlkT2ZOb2RlKHByZWZhYkRhdGEsIGNoaWxkSW5kZXgpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZEZpbGVJZCAhPT0gbnVsbCAmJiBsaXZlRmlsZUlkcy5oYXMoY2hpbGRGaWxlSWQpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICBwZW5kaW5nLnB1c2goY2hpbGRJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlbW92ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJ1bmVkOiBhbnlbXSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSkpO1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJ1bmVkLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKGluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHBydW5lZFtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgdGhpcy5zdHJ1Y3R1cmFsUmVmQXJyYXlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGVudHJ5W2tleV0pKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBlbnRyeVtrZXldID0gZW50cnlba2V5XS5maWx0ZXIoKGVsZW1lbnQ6IGFueSkgPT4gIXRoaXMucmVmZXJlbmNlc1JlbW92ZWQoZWxlbWVudCwgcmVtb3ZlZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2hhdGV2ZXIgc3RpbGwgcG9pbnRzIGF0IGEgcmVtb3ZlZCBlbnRyeSBiZWNvbWVzIG51bGwg4oCUIHRoaXMgaXMgdGhlIGRhbmdsaW5nXG4gICAgICAgIC8vIGNvbXBvbmVudCByZWZlcmVuY2UgdGhlIHJlcG9ydCBjYWxscyBvdXQgKGFuIGBPYmplY3RWaWV3LnRpY2tOb2RlYCBiaW5kaW5nIHRvIGFcbiAgICAgICAgLy8gY2hpbGQgdGhhdCBubyBsb25nZXIgZXhpc3RzKS5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHBydW5lZC5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkLmhhcyhpbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcHJ1bmVkW2luZGV4XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKHBydW5lZFtpbmRleF0sIHJlbW92ZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtYXAgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuICAgICAgICBjb25zdCBzdXJ2aXZvcnM6IGFueVtdID0gW107XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcnVuZWQubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMoaW5kZXgpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHJlbWFwLnNldChpbmRleCwgc3Vydml2b3JzLmxlbmd0aCk7XG4gICAgICAgICAgICBzdXJ2aXZvcnMucHVzaChwcnVuZWRbaW5kZXhdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3Vydml2b3JzLm1hcChlbnRyeSA9PiB0aGlzLnJlbWFwUmVmcyhlbnRyeSwgcmVtYXApKTtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGB2YWx1ZWAgaXMg4oCUIG9yIGNvbnRhaW5zIOKAlCBhbiBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeS4gKi9cbiAgICBwcml2YXRlIHJlZmVyZW5jZXNSZW1vdmVkKHZhbHVlOiBhbnksIHJlbW92ZWQ6IFNldDxudW1iZXI+KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh2YWx1ZSkuc29tZShuZXN0ZWQgPT4gdGhpcy5yZWZlcmVuY2VzUmVtb3ZlZChuZXN0ZWQsIHJlbW92ZWQpKTtcbiAgICB9XG5cbiAgICAvKiogUmVwbGFjZSBldmVyeSBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeSB3aXRoIG51bGwuICovXG4gICAgcHJpdmF0ZSBudWxsaWZ5UmVtb3ZlZFJlZnModmFsdWU6IGFueSwgcmVtb3ZlZDogU2V0PG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLm51bGxpZnlSZW1vdmVkUmVmcyhlbGVtZW50LCByZW1vdmVkKSk7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHZhbHVlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICBjb25zdCByZXdyaXR0ZW46IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIG5lc3RlZF0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSByZXdyaXR0ZW5ba2V5XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKG5lc3RlZCwgcmVtb3ZlZCk7XG4gICAgICAgIHJldHVybiByZXdyaXR0ZW47XG4gICAgfVxuXG4gICAgLyoqIFBvaW50IGV2ZXJ5IHN1cnZpdmluZyBgX19pZF9fYCBhdCBpdHMgZW50cnkncyBzbG90IGluIHRoZSBjb21wYWN0ZWQgYXJyYXkuICovXG4gICAgcHJpdmF0ZSByZW1hcFJlZnModmFsdWU6IGFueSwgcmVtYXA6IE1hcDxudW1iZXIsIG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLnJlbWFwUmVmcyhlbGVtZW50LCByZW1hcCkpO1xuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiB2YWx1ZTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5fX2lkX18gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gcmVtYXAuZ2V0KHZhbHVlLl9faWRfXyk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHsgX19pZF9fOiBuZXh0IH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmV3cml0dGVuOiBhbnkgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBuZXN0ZWRdIG9mIE9iamVjdC5lbnRyaWVzKHZhbHVlKSkgcmV3cml0dGVuW2tleV0gPSB0aGlzLnJlbWFwUmVmcyhuZXN0ZWQsIHJlbWFwKTtcbiAgICAgICAgcmV0dXJuIHJld3JpdHRlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWplY3QgYSByZXdyaXR0ZW4gZ3JhcGggYmVmb3JlIGl0IHJlYWNoZXMgZGlzay4gUmV0dXJucyB0aGUgZmlyc3QgcHJvYmxlbSBmb3VuZCwgb3JcbiAgICAgKiBudWxsIHdoZW4gdGhlIGdyYXBoIGlzIHNvdW5kIOKAlCB0aGlzIGlzIHdoYXQgbWFrZXMgYSBtaXMtaW5kZXhlZCBhc3NldCBpbXBvc3NpYmxlIHRvXG4gICAgICogd3JpdGUgcmF0aGVyIHRoYW4gc29tZXRoaW5nIHRvIG5vdGljZSBhZnRlcndhcmRzLlxuICAgICAqL1xuICAgIHByaXZhdGUgdmFsaWRhdGVQcmVmYWJHcmFwaChwcmVmYWJEYXRhOiBhbnlbXSwgcmVtb3ZlZEZpbGVJZHM6IHN0cmluZ1tdLCBmaWxlSWRzQmVmb3JlOiBTZXQ8c3RyaW5nPik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBkYW5nbGluZyA9IHRoaXMuZmluZERhbmdsaW5nUmVmKHByZWZhYkRhdGEsIHByZWZhYkRhdGEubGVuZ3RoKTtcbiAgICAgICAgaWYgKGRhbmdsaW5nICE9PSBudWxsKSByZXR1cm4gYF9faWRfXyAke2RhbmdsaW5nfSBpcyBvdXQgb2YgcmFuZ2VgO1xuXG4gICAgICAgIC8vIElkZW50aXR5LCBub3QgY291bnQ6IGV4YWN0bHkgdGhlIG9ycGhhbnMgZ28sIGFuZCBub3RoaW5nIGVsc2UgZG9lcy5cbiAgICAgICAgY29uc3QgcmVtYWluaW5nID0gdGhpcy5jb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhwcmVmYWJEYXRhKTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2YgcmVtb3ZlZEZpbGVJZHMpIHtcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmcuaGFzKGZpbGVJZCkpIHJldHVybiBgb3JwaGFuZWQgZmlsZUlkICR7ZmlsZUlkfSBzdXJ2aXZlZCByZW1vdmFsYDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiBmaWxlSWRzQmVmb3JlKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZEZpbGVJZHMuaW5jbHVkZXMoZmlsZUlkKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXMoZmlsZUlkKSkgcmV0dXJuIGBmaWxlSWQgJHtmaWxlSWR9IHdhcyByZW1vdmVkIGJ1dCBzaG91bGQgaGF2ZSBiZWVuIGtlcHRgO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NoaWxkcmVuKSA/IGVudHJ5Ll9jaGlsZHJlbiA6IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NoaWxkcmVuIGVudHJ5YDtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHByZWZhYkRhdGFbY2hpbGRJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZCB8fCBjaGlsZC5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBub24tbm9kZSBjaGlsZCBhdCAke2NoaWxkSW5kZXh9YDtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQuX3BhcmVudCAmJiBjaGlsZC5fcGFyZW50Ll9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBub2RlICR7Y2hpbGRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBwYXJlbnQgJHtpbmRleH1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpID8gZW50cnkuX2NvbXBvbmVudHMgOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NvbXBvbmVudHMgZW50cnlgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50KSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBtaXNzaW5nIGNvbXBvbmVudCBhdCAke2NvbXBvbmVudEluZGV4fWA7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5ub2RlICYmIGNvbXBvbmVudC5ub2RlLl9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBjb21wb25lbnQgJHtjb21wb25lbnRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBub2RlICR7aW5kZXh9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqIFRoZSBmaXJzdCBgX19pZF9fYCBvdXRzaWRlIGBbMCwgbGVuZ3RoKWAgYW55d2hlcmUgaW4gdGhlIGdyYXBoLCBvciBudWxsIHdoZW4gYWxsIHJlc29sdmUuICovXG4gICAgcHJpdmF0ZSBmaW5kRGFuZ2xpbmdSZWYodmFsdWU6IGFueSwgbGVuZ3RoOiBudW1iZXIpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZERhbmdsaW5nUmVmKGVsZW1lbnQsIGxlbmd0aCk7XG4gICAgICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdmFsdWUuX19pZF9fO1xuICAgICAgICAgICAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIoaWQpICYmIGlkID49IDAgJiYgaWQgPCBsZW5ndGggPyBudWxsIDogaWQ7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBuZXN0ZWQgb2YgT2JqZWN0LnZhbHVlcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYobmVzdGVkLCBsZW5ndGgpO1xuICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIGBxdWVyeS1hc3NldC1tZXRhYCBjYXJyaWVzIG5vIGB1cmxgL2BuYW1lYC90aW1lc3RhbXBzIOKAlCByZWFkaW5nIHRoZW0gb2ZmIHRoZVxuICAgICAgICAvLyBtZXRhIHJlY29yZCBwcm9kdWNlZCBhbiBhbGwtZW1wdHkgUHJlZmFiSW5mbyB0aGF0IHN0aWxsIHJlcG9ydGVkIHN1Y2Nlc3MgKCMyNSkuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHV1aWQpO1xuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogcmVzb2x2ZWQuZXJyb3IgfTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5pbmZvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcmVmYWIgbm90IGZvdW5kOiAke3V1aWR9YCB9O1xuXG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IHJlc29sdmVkLmluZm87XG4gICAgICAgIGNvbnN0IHVybDogc3RyaW5nID0gYXNzZXRJbmZvLnVybCB8fCAnJztcbiAgICAgICAgY29uc3Qgc3RhdHMgPSByZXNvbHZlZC5maWxlUGF0aCA/IHRoaXMuc3RhdFRpbWVzKHJlc29sdmVkLmZpbGVQYXRoKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGluZm86IFByZWZhYkluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBhc3NldEluZm8ubmFtZSxcbiAgICAgICAgICAgIHV1aWQ6IGFzc2V0SW5mby51dWlkIHx8IHV1aWQsXG4gICAgICAgICAgICBwYXRoOiB1cmwsXG4gICAgICAgICAgICBmb2xkZXI6IHVybCA/IHVybC5zdWJzdHJpbmcoMCwgdXJsLmxhc3RJbmRleE9mKCcvJykpIDogJycsXG4gICAgICAgICAgICBjcmVhdGVUaW1lOiBzdGF0cz8uY3JlYXRlVGltZSxcbiAgICAgICAgICAgIG1vZGlmeVRpbWU6IHN0YXRzPy5tb2RpZnlUaW1lXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgLi4uaW5mbywgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGggfSB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdFRpbWVzKGZpbGVQYXRoOiBzdHJpbmcpOiB7IGNyZWF0ZVRpbWU6IHN0cmluZzsgbW9kaWZ5VGltZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBjcmVhdGVUaW1lOiBzLmJpcnRodGltZS50b0lTT1N0cmluZygpLCBtb2RpZnlUaW1lOiBzLm10aW1lLnRvSVNPU3RyaW5nKCkgfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gRWFjaCBzdGFnZSByZXBvcnRzIGl0c2VsZi4gVGhlIG9sZCBzaW5nbGUgb3V0ZXIgY2F0Y2ggY29sbGFwc2VkIGV2ZXJ5IGZhaWx1cmVcbiAgICAgICAgLy8gaW50byBgRXJyb3IgdmFsaWRhdGluZyBwcmVmYWI6IEVycm9yOiBwYXJhbWV0ZXIgZXJyb3JgLCB3aGljaCBoaWQgdGhhdCB0aGVcbiAgICAgICAgLy8gcmVqZWN0ZWQgY2FsbCB3YXMgYHF1ZXJ5LXBhdGgoJycpYCDigJQgYHF1ZXJ5LWFzc2V0LW1ldGFgIG5ldmVyIHJldHVybnMgYSBgdXJsYFxuICAgICAgICAvLyB0byByZXNvbHZlLCBzbyB0aGUgcGF0aCBsb29rdXAgd2FzIGFsd2F5cyBoYW5kZWQgYW4gZW1wdHkgc3RyaW5nICgjMjUpLlxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc29sdmVkLmVycm9yKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciB2YWxpZGF0aW5nIHByZWZhYjogJHtyZXNvbHZlZC5lcnJvcn1gIH07XG4gICAgICAgIGlmICghcmVzb2x2ZWQuZmlsZVBhdGgpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NvdWxkIG5vdCByZXNvbHZlIHByZWZhYiBmaWxlIHBhdGggb24gZGlzaycgfTtcblxuICAgICAgICBsZXQgY29udGVudDogc3RyaW5nO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZWFkIHByZWZhYiBmaWxlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZWZhYkRhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByZWZhYkRhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ByZWZhYiBmaWxlIGZvcm1hdCBlcnJvcjogY2Fubm90IHBhcnNlIEpTT04nIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2YWxpZGF0aW9uUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UudmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHZhbGlkYXRpb25SZXN1bHQuaXNWYWxpZCwgaXNzdWVzOiB2YWxpZGF0aW9uUmVzdWx0Lmlzc3VlcyxcbiAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHZhbGlkYXRpb25SZXN1bHQubm9kZUNvdW50LCBjb21wb25lbnRDb3VudDogdmFsaWRhdGlvblJlc3VsdC5jb21wb25lbnRDb3VudCxcbiAgICAgICAgICAgICAgICB1cmw6IHJlc29sdmVkLnVybCwgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkID8gJ1ByZWZhYiBmb3JtYXQgaXMgdmFsaWQnIDogJ1ByZWZhYiBmb3JtYXQgaGFzIGlzc3VlcydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGR1cGxpY2F0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHV1aWQ6IHN0cmluZzsgbmV3TmFtZT86IHN0cmluZzsgdGFyZ2V0RGlyPzogc3RyaW5nIH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBQcmVmYWIgZHVwbGljYXRpb24gcmVxdWlyZXMgY29tcGxleCBzZXJpYWxpemF0aW9uIOKAlCBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdQcmVmYWIgZHVwbGljYXRpb24gaXMgbm90IGF2YWlsYWJsZSBwcm9ncmFtbWF0aWNhbGx5JyxcbiAgICAgICAgICAgIGluc3RydWN0aW9uOiAnVG8gZHVwbGljYXRlIGEgcHJlZmFiLCB1c2UgdGhlIENvY29zIENyZWF0b3IgZWRpdG9yOlxcbjEuIFNlbGVjdCB0aGUgcHJlZmFiIGluIHRoZSBBc3NldCBCcm93c2VyXFxuMi4gUmlnaHQtY2xpY2sgYW5kIHNlbGVjdCBDb3B5XFxuMy4gUGFzdGUgaW4gdGhlIHRhcmdldCBsb2NhdGlvbidcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIChhLmsuYS4gcmV2ZXJ0KSBhIHByZWZhYiBpbnN0YW5jZSB0byBpdHMgYXNzZXQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBCYWNrcyBib3RoIGBhY3Rpb249cmVzdG9yZWAgYW5kIGBhY3Rpb249cmV2ZXJ0YC4gQ29jb3MgQ3JlYXRvciAzLjguNyBleHBvc2VzXG4gICAgICogbm8gYHNjZW5lOnJldmVydC1wcmVmYWJgIG1lc3NhZ2UgYXQgYWxsIOKAlCBgcmVzdG9yZS1wcmVmYWJgIGlzIHdoYXQgdGhlIGVkaXRvclxuICAgICAqIGl0c2VsZiB1c2VzIGZvciB0aGUgaW5zcGVjdG9yJ3MgUmV2ZXJ0IGJ1dHRvbiAoIzEzKS4gSXQgdGFrZXMgcG9zaXRpb25hbFxuICAgICAqIGAocm9vdFV1aWQsIGFzc2V0VXVpZClgLCByZXR1cm5zIGEgYm9vbGVhbiwgYW5kIHJlY29yZHMgaXRzIG93biB1bmRvIGVudHJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQ6IHN0cmluZywgYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnbm9kZVV1aWQgaXMgcmVxdWlyZWQnIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHJvb3RVdWlkID0gY29udGV4dC5yb290VXVpZDtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkQXNzZXRVdWlkID0gYXNzZXRVdWlkIHx8IGNvbnRleHQuYXNzZXRVdWlkO1xuICAgICAgICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvdWxkIG5vdCByZXNvbHZlIHRoZSBwcmVmYWIgYXNzZXQgZm9yIG5vZGUgJHtub2RlVXVpZH0uIFBhc3MgYXNzZXRVdWlkIGV4cGxpY2l0bHkuYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXN0b3JlZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgcm9vdFV1aWQsIHJlc29sdmVkQXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGlmIChyZXN0b3JlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgcmVzdG9yZS1wcmVmYWIgZm9yIG5vZGUgJHtyb290VXVpZH0uIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgaW5zdGFuY2UgcmVzdG9yZWQgZnJvbSBhc3NldCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcmVzdG9yZSBwcmVmYWIgbm9kZTogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==