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
    /**
     * Resolve the current scene's root node uuid.
     *
     * `scene:create-node`'s own default-parent heuristic is NOT the scene root — observed
     * live it parents a new node under whatever was created or selected last, which is how
     * three back-to-back `instantiate` calls with no `parentUuid` ended up nested inside
     * one another instead of as scene-root siblings (#120 item 1). Resolving the root
     * explicitly and passing it makes the placement deterministic.
     *
     * `query-node-tree` with no argument returns the scene's node tree; its root entry may
     * be the scene node itself or an array of top-level nodes depending on the build, so
     * both shapes are accepted. Returns null when the tree cannot be read — the caller then
     * leaves `parent` unset rather than guessing, so a failed lookup degrades to the old
     * behaviour instead of parenting under something arbitrary.
     */
    async resolveSceneRootUuid() {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (Array.isArray(tree)) {
                return tree.length > 0 ? (tree[0].uuid || null) : null;
            }
            return (tree === null || tree === void 0 ? void 0 : tree.uuid) || null;
        }
        catch (_a) {
            return null;
        }
    }
    /**
     * Enter prefab-edit mode for a prefab asset.
     *
     * The previous implementation called `scene:load-asset`, a message that does not exist
     * in Cocos Creator 3.8.7 — every call rejected with `Message does not exist: scene -
     * load-asset`, so `load` could never succeed and the prefab-edit path through this tool
     * was unreachable (#120 item 3).
     *
     * There is no `scene:` message that enters prefab-edit mode; the editor opens the asset
     * itself. The path that works is `asset-db:query-asset-info` to confirm the uuid names a
     * prefab, then `asset-db:open-asset` (a declared message, `asset-db/@types/message.d.ts`)
     * to hand the asset to the editor's own asset-opener, which is what the Asset Browser
     * double-click does. The uuid is resolved to its `url` first because `open-asset` is
     * documented to take a url.
     *
     * Confirmed to a level this repo can reach: the message exists in the editor's own
     * declarations and the resolve-then-open sequence is what the editor UI performs. The
     * behavioural half — that the editor lands in prefab-edit mode — is asserted to be
     * unverifiable without a live editor, and is called out as such on the issue rather
     * than claimed here.
     */
    async loadPrefabByUuid(uuid) {
        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', uuid).catch(() => null);
        if (!assetInfo) {
            return {
                success: false,
                error: `Prefab uuid '${uuid}' not found in the asset DB`,
                instruction: 'Verify the uuid, and refresh the asset DB (manage_asset action=refresh) if the .prefab file was written outside the editor.'
            };
        }
        // `type` is the importer type — 'prefab' for a .prefab asset. Refuse a non-prefab
        // rather than opening, say, a texture and reporting a prefab was loaded.
        if (assetInfo.type && assetInfo.type !== 'prefab') {
            return {
                success: false,
                error: `Asset '${assetInfo.url || uuid}' is a '${assetInfo.type}', not a prefab`,
                instruction: 'Pass the uuid of a .prefab asset (manage_prefab action=list returns them).'
            };
        }
        const target = assetInfo.url || uuid;
        try {
            await Editor.Message.request('asset-db', 'open-asset', target);
        }
        catch (err) {
            return {
                success: false,
                error: `Could not open prefab '${target}': ${err.message}`,
                instruction: `Open '${target}' in the Cocos Creator Asset Browser (double-click it) to edit the prefab.`
            };
        }
        return {
            success: true,
            data: {
                uuid: assetInfo.uuid || uuid,
                name: assetInfo.name,
                url: target,
                message: 'Prefab opened for editing',
                // Prefab-edit mode is an editor-side state. This tool can confirm the open
                // request was accepted, not that the editor switched modes, so the caller is
                // told which half was verified rather than given a bare success.
                prefabEditModeVerified: false
            }
        };
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
            else {
                // No caller-supplied parent: pin the placement to the scene root. Leaving
                // `parent` unset hands the decision to `create-node`'s implicit
                // last-created/last-selected heuristic, which nests unrelated instances
                // (#120 item 1). A null resolve leaves it unset — the old behaviour — rather
                // than parenting under a guess.
                const sceneRoot = await this.resolveSceneRootUuid();
                if (sceneRoot)
                    createNodeOptions.parent = sceneRoot;
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
            assetUuid: prefab.uuid || ((_a = prefab.prefabStateInfo) === null || _a === void 0 ? void 0 : _a.assetUuid),
            nodeData
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
            const { rootUuid, assetUuid, nodeData } = context;
            const prefabPath = await this.resolvePrefabFilePath(assetUuid);
            const mtimeBefore = this.statMtimeMs(prefabPath);
            // Refuse BEFORE the write: apply-prefab serializes everything under the resolved
            // root, so a foreign instance nested in it would be absorbed into this asset (#120).
            if (assetUuid) {
                const foreign = await this.findForeignPrefabInstances(rootUuid, assetUuid, prefabPath, rootUuid === nodeUuid ? nodeData : undefined);
                if (foreign.length > 0) {
                    return {
                        success: false,
                        error: `Refusing to apply ${rootUuid} to prefab ${assetUuid}: its subtree contains prefab instance(s) ${foreign.join(', ')} that the asset does not already reference. Applying would write their content into this prefab. Move those instances out from under the root (manage_node action=move) and retry.`,
                        data: { nodeUuid, rootUuid, assetUuid, prefabPath, foreignPrefabAssets: foreign }
                    };
                }
            }
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
    /** A `query-node` `children` entry is a uuid string or a property dump; return its uuid or ''. */
    childUuidOf(entry) {
        if (typeof entry === 'string')
            return entry;
        if (entry && typeof entry === 'object') {
            if (typeof entry.uuid === 'string')
                return entry.uuid;
            if (entry.value && typeof entry.value.uuid === 'string')
                return entry.value.uuid;
        }
        return '';
    }
    /**
     * Prefab asset uuids found in the live subtree under `rootUuid` that are neither the
     * target `assetUuid` nor already referenced by the target asset file (#120 item 2).
     *
     * `apply-prefab` serializes the whole resolved root. When unrelated instances were nested
     * under it (the old `instantiate` parenting bug, or a hand-built hierarchy), applying
     * absorbed THEIR content into the target asset - 35 lines became 646, and a whole scene
     * was written into a leaf prefab. A nested instance the asset already carries is
     * legitimate and has its uuid in the file; an instance the file has never heard of is
     * foreign. The walk fails closed on an unreadable asset file (nothing is "already
     * carried") but not on an unqueryable node (it only sees what the editor will show).
     */
    async findForeignPrefabInstances(rootUuid, assetUuid, prefabPath, rootDump) {
        let assetText = '';
        if (prefabPath) {
            try {
                assetText = fs.readFileSync(prefabPath, 'utf-8');
            }
            catch (_a) {
                assetText = '';
            }
        }
        const foreign = new Set();
        const visit = async (uuid, known) => {
            var _a;
            let nodeData = known;
            if (!nodeData) {
                try {
                    nodeData = await Editor.Message.request('scene', 'query-node', uuid);
                }
                catch (_b) {
                    return;
                }
            }
            if (!nodeData || typeof nodeData !== 'object')
                return;
            const nestedAsset = (_a = nodeData.__prefab__) === null || _a === void 0 ? void 0 : _a.uuid;
            if (typeof nestedAsset === 'string' && nestedAsset && nestedAsset !== assetUuid && !assetText.includes(nestedAsset)) {
                foreign.add(nestedAsset);
            }
            const children = Array.isArray(nodeData.children) ? nodeData.children : [];
            for (const child of children) {
                const childUuid = this.childUuidOf(child);
                if (childUuid)
                    await visit(childUuid);
            }
        };
        await visit(rootUuid, rootDump);
        return [...foreign];
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
                await visit(this.childUuidOf(child));
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
                // Named explicitly so a caller can tell "nothing wrong" from "nothing there":
                // issue #73's hollow prefab passed this action with `isValid: true`.
                hollowComponents: validationResult.hollowComponents,
                // Issue #114 defect 2: an accessor key beside its underscore twin is a prefab
                // the asset importer rejects, and `isValid: true` on that file is the false
                // green this action existed to prevent.
                duplicateAccessorKeys: validationResult.duplicateAccessorKeys,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdXNCQUF1c0IsQ0FBQztRQUN0dEIsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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QUNILE9BQU8sRUFBRSxJQUFJO2dCQUNiLElBQUksRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLGlCQUFpQixFQUFFO2dCQUMxRCxPQUFPLEVBQUUsa0RBQWtEO2FBQzlELENBQUM7UUFDTixDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsa0NBQWtDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1FBQ3hGLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUFqbENELG9DQWlsQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCwgUHJlZmFiSW5mbyB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IG5vcm1hbGl6ZVZlYzMgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBQcmVmYWJDcmVhdGlvblNlcnZpY2UgfSBmcm9tICcuL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZSc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VQcmVmYWIgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBjcmVhdGlvblNlcnZpY2UgPSBuZXcgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlKCk7XG5cbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9wcmVmYWInO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBwcmVmYWJzIGluIHRoZSBwcm9qZWN0LiBBY3Rpb25zOiBsaXN0PWxpc3QgYWxsIHByZWZhYnMsIGxvYWQ9bG9hZCBwcmVmYWIgYnkgcGF0aCwgaW5zdGFudGlhdGU9aW5zdGFudGlhdGUgcHJlZmFiIGluIHNjZW5lLCBjcmVhdGU9Y3JlYXRlIHByZWZhYiBmcm9tIG5vZGUsIHVwZGF0ZT1hcHBseSBub2RlIGNoYW5nZXMgdG8gdGhlIHByZWZhYiBhc3NldCAodmVyaWZpZXMgdGhlIGFzc2V0IHdhcyB3cml0dGVuLCBhbmQgcmVtb3ZlcyBjaGlsZHJlbiBkZWxldGVkIGZyb20gdGhlIGluc3RhbmNlIHRoYXQgYXBwbHktcHJlZmFiIGxlYXZlcyBiZWhpbmQpLCByZXZlcnQ9cmV2ZXJ0IHByZWZhYiBpbnN0YW5jZSB0byB0aGUgYXNzZXQgc3RhdGUgKGFsaWFzIG9mIHJlc3RvcmUpLCBnZXRfaW5mbz1nZXQgcHJlZmFiIGRldGFpbHMsIHZhbGlkYXRlPXZhbGlkYXRlIHByZWZhYiBmaWxlIGZvcm1hdCwgZHVwbGljYXRlPWR1cGxpY2F0ZSBhIHByZWZhYiwgcmVzdG9yZT1yZXN0b3JlIHByZWZhYiBub2RlIHVzaW5nIGFzc2V0ICh3aXRoIHVuZG8pLiBGb3IgdXBkYXRlL3JldmVydC9yZXN0b3JlLCBub2RlVXVpZCBtYXkgYmUgYW55IG5vZGUgaW4gdGhlIGluc3RhbmNlIOKAlCB0aGUgaW5zdGFuY2Ugcm9vdCBpcyByZXNvbHZlZCBhdXRvbWF0aWNhbGx5LiBQcmVyZXF1aXNpdGVzOiBwcm9qZWN0IG11c3QgYmUgb3BlbiBpbiBDb2NvcyBDcmVhdG9yLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnbGlzdCcsICdsb2FkJywgJ2luc3RhbnRpYXRlJywgJ2NyZWF0ZScsICd1cGRhdGUnLCAncmV2ZXJ0JywgJ2dldF9pbmZvJywgJ3ZhbGlkYXRlJywgJ2R1cGxpY2F0ZScsICdyZXN0b3JlJ107XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnbGlzdCcsICdsb2FkJywgJ2luc3RhbnRpYXRlJywgJ2NyZWF0ZScsICd1cGRhdGUnLCAncmV2ZXJ0JywgJ2dldF9pbmZvJywgJ3ZhbGlkYXRlJywgJ2R1cGxpY2F0ZScsICdyZXN0b3JlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogbGlzdD1saXN0IGFsbCBwcmVmYWJzIGluIHByb2plY3QsIGxvYWQ9bG9hZCBwcmVmYWIgYnkgdXVpZCwgaW5zdGFudGlhdGU9aW5zdGFudGlhdGUgcHJlZmFiIGluIHNjZW5lLCBjcmVhdGU9Y3JlYXRlIHByZWZhYiBmcm9tIG5vZGUsIHVwZGF0ZT1hcHBseSBub2RlIGNoYW5nZXMgdG8gZXhpc3RpbmcgcHJlZmFiLCByZXZlcnQ9cmV2ZXJ0IHByZWZhYiBpbnN0YW5jZSB0byB0aGUgYXNzZXQgc3RhdGUgKGFsaWFzIG9mIHJlc3RvcmUpLCBnZXRfaW5mbz1nZXQgZGV0YWlsZWQgcHJlZmFiIGluZm8sIHZhbGlkYXRlPXZhbGlkYXRlIHByZWZhYiBmaWxlIGZvcm1hdCwgZHVwbGljYXRlPWR1cGxpY2F0ZSBhIHByZWZhYiwgcmVzdG9yZT1yZXN0b3JlIHByZWZhYiBub2RlIHVzaW5nIHByZWZhYiBhc3NldCAoYnVpbHQtaW4gdW5kbyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKGZvciBsb2FkLCBnZXRfaW5mbywgdmFsaWRhdGUsIGR1cGxpY2F0ZSwgcmVzdG9yZV9ub2RlIGFjdGlvbnMpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByZWZhYlV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIChmb3IgaW5zdGFudGlhdGUgYWN0aW9uKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBub2RlVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2NlbmUgbm9kZSBVVUlEIChmb3IgY3JlYXRlLCB1cGRhdGUsIHJldmVydCwgcmVzdG9yZSBhY3Rpb25zKS4gRm9yIHVwZGF0ZS9yZXZlcnQvcmVzdG9yZSB0aGlzIG1heSBiZSBhbnkgbm9kZSBpbnNpZGUgdGhlIHByZWZhYiBpbnN0YW5jZTsgdGhlIGluc3RhbmNlIHJvb3QgaXMgcmVzb2x2ZWQgZnJvbSBpdC4nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2F2ZVBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IERCIHBhdGggdG8gc2F2ZSBwcmVmYWIgKGZvciBjcmVhdGUgYWN0aW9uLCBlLmcuIGRiOi8vYXNzZXRzL3ByZWZhYnMvTXlQcmVmYWIucHJlZmFiKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXJlbnRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQYXJlbnQgbm9kZSBVVUlEIGZvciB0aGUgaW5zdGFudGlhdGVkIHByZWZhYiAoZm9yIGluc3RhbnRpYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHBvc2l0aW9uIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcm90YXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgcm90YXRpb24ge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY2FsZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCBzY2FsZSB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZvbGRlcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRm9sZGVyIHRvIHNlYXJjaCBwcmVmYWJzIGluIChmb3IgbGlzdCBhY3Rpb24sIGRlZmF1bHQ6IGRiOi8vYXNzZXRzKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5ld05hbWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ05ldyBwcmVmYWIgbmFtZSAoZm9yIGR1cGxpY2F0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0YXJnZXREaXI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1RhcmdldCBkaXJlY3RvcnkgZm9yIGR1cGxpY2F0ZWQgcHJlZmFiIChmb3IgZHVwbGljYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFzc2V0VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgdG8gcmVzdG9yZSBmcm9tIChmb3IgcmV2ZXJ0IGFuZCByZXN0b3JlIGFjdGlvbnMsIG9wdGlvbmFsIOKAlCByZXNvbHZlZCBmcm9tIHRoZSBub2RlIHdoZW4gb21pdHRlZCknXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5oYW5kbGVMaXN0KGFyZ3MpLFxuICAgICAgICBsb2FkOiAoYXJncykgPT4gdGhpcy5oYW5kbGVMb2FkKGFyZ3MpLFxuICAgICAgICBpbnN0YW50aWF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlSW5zdGFudGlhdGUoYXJncyksXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlQ3JlYXRlKGFyZ3MpLFxuICAgICAgICB1cGRhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVVwZGF0ZShhcmdzKSxcbiAgICAgICAgcmV2ZXJ0OiAoYXJncykgPT4gdGhpcy5oYW5kbGVSZXZlcnQoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5oYW5kbGVHZXRJbmZvKGFyZ3MpLFxuICAgICAgICB2YWxpZGF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlVmFsaWRhdGUoYXJncyksXG4gICAgICAgIGR1cGxpY2F0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlRHVwbGljYXRlKGFyZ3MpLFxuICAgICAgICByZXN0b3JlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVSZXN0b3JlTm9kZShhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVMaXN0KGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRQcmVmYWJMaXN0KGFyZ3MuZm9sZGVyKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gbGlzdCBwcmVmYWJzJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVMb2FkKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmxvYWRQcmVmYWJCeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGxvYWQgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVJbnN0YW50aWF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFwcmVmYWJVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3ByZWZhYlV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3MucG9zaXRpb24pO1xuICAgICAgICBjb25zdCByb3RhdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5yb3RhdGlvbik7XG4gICAgICAgIGNvbnN0IHNjYWxlID0gbm9ybWFsaXplVmVjMyhhcmdzLnNjYWxlKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0ZVByZWZhYkJ5VXVpZCh7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgY29uc3QgZmFpbHVyZSA9IGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGluc3RhbnRpYXRlIHByZWZhYicpO1xuICAgICAgICBpZiAocmVzdWx0Lmluc3RydWN0aW9uKSBmYWlsdXJlLmluc3RydWN0aW9uID0gcmVzdWx0Lmluc3RydWN0aW9uO1xuICAgICAgICByZXR1cm4gZmFpbHVyZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUNyZWF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIHNhdmVQYXRoIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGlmICghc2F2ZVBhdGgpIHJldHVybiBlcnJvclJlc3VsdCgnc2F2ZVBhdGggaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcHJlZmFiTmFtZSA9IHNhdmVQYXRoLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy5wcmVmYWInLCAnJykgfHwgJ05ld1ByZWZhYic7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRlUHJlZmFiKHsgbm9kZVV1aWQsIHNhdmVQYXRoLCBwcmVmYWJOYW1lIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBjcmVhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVVcGRhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudXBkYXRlUHJlZmFiKG5vZGVVdWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gdXBkYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUmV2ZXJ0KGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgYXNzZXRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIC8vIGByZXZlcnRgIGFuZCBgcmVzdG9yZWAgYXJlIHRoZSBzYW1lIGVkaXRvciBvcGVyYXRpb24g4oCUIHNlZSByZXN0b3JlUHJlZmFiTm9kZS5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZCwgYXNzZXRVdWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gcmV2ZXJ0IHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0SW5mbyhhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBnZXQgcHJlZmFiIGluZm8nKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVZhbGlkYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnZhbGlkYXRlUHJlZmFiQnlVdWlkKHV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byB2YWxpZGF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUR1cGxpY2F0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCwgbmV3TmFtZSwgdGFyZ2V0RGlyIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmR1cGxpY2F0ZVByZWZhYkJ5VXVpZCh7IHV1aWQsIG5ld05hbWUsIHRhcmdldERpciB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gZHVwbGljYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVzdG9yZU5vZGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBhc3NldFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZCwgYXNzZXRVdWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gcmVzdG9yZSBwcmVmYWIgbm9kZScpO1xuICAgIH1cblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFByaXZhdGUgaW1wbGVtZW50YXRpb24gbWV0aG9kcyAocG9ydGVkIGZyb20gUHJlZmFiVG9vbHMpXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByZWZhYkxpc3QoZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBmb2xkZXIuZW5kc1dpdGgoJy8nKSA/IGAke2ZvbGRlcn0qKi8qLnByZWZhYmAgOiBgJHtmb2xkZXJ9LyoqLyoucHJlZmFiYDtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiczogUHJlZmFiSW5mb1tdID0gcmVzdWx0cy5tYXAoYXNzZXQgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLCBwYXRoOiBhc3NldC51cmwsIHV1aWQ6IGFzc2V0LnV1aWQsXG4gICAgICAgICAgICAgICAgZm9sZGVyOiBhc3NldC51cmwuc3Vic3RyaW5nKDAsIGFzc2V0LnVybC5sYXN0SW5kZXhPZignLycpKVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogcHJlZmFicyB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSB0aGUgY3VycmVudCBzY2VuZSdzIHJvb3Qgbm9kZSB1dWlkLlxuICAgICAqXG4gICAgICogYHNjZW5lOmNyZWF0ZS1ub2RlYCdzIG93biBkZWZhdWx0LXBhcmVudCBoZXVyaXN0aWMgaXMgTk9UIHRoZSBzY2VuZSByb290IOKAlCBvYnNlcnZlZFxuICAgICAqIGxpdmUgaXQgcGFyZW50cyBhIG5ldyBub2RlIHVuZGVyIHdoYXRldmVyIHdhcyBjcmVhdGVkIG9yIHNlbGVjdGVkIGxhc3QsIHdoaWNoIGlzIGhvd1xuICAgICAqIHRocmVlIGJhY2stdG8tYmFjayBgaW5zdGFudGlhdGVgIGNhbGxzIHdpdGggbm8gYHBhcmVudFV1aWRgIGVuZGVkIHVwIG5lc3RlZCBpbnNpZGVcbiAgICAgKiBvbmUgYW5vdGhlciBpbnN0ZWFkIG9mIGFzIHNjZW5lLXJvb3Qgc2libGluZ3MgKCMxMjAgaXRlbSAxKS4gUmVzb2x2aW5nIHRoZSByb290XG4gICAgICogZXhwbGljaXRseSBhbmQgcGFzc2luZyBpdCBtYWtlcyB0aGUgcGxhY2VtZW50IGRldGVybWluaXN0aWMuXG4gICAgICpcbiAgICAgKiBgcXVlcnktbm9kZS10cmVlYCB3aXRoIG5vIGFyZ3VtZW50IHJldHVybnMgdGhlIHNjZW5lJ3Mgbm9kZSB0cmVlOyBpdHMgcm9vdCBlbnRyeSBtYXlcbiAgICAgKiBiZSB0aGUgc2NlbmUgbm9kZSBpdHNlbGYgb3IgYW4gYXJyYXkgb2YgdG9wLWxldmVsIG5vZGVzIGRlcGVuZGluZyBvbiB0aGUgYnVpbGQsIHNvXG4gICAgICogYm90aCBzaGFwZXMgYXJlIGFjY2VwdGVkLiBSZXR1cm5zIG51bGwgd2hlbiB0aGUgdHJlZSBjYW5ub3QgYmUgcmVhZCDigJQgdGhlIGNhbGxlciB0aGVuXG4gICAgICogbGVhdmVzIGBwYXJlbnRgIHVuc2V0IHJhdGhlciB0aGFuIGd1ZXNzaW5nLCBzbyBhIGZhaWxlZCBsb29rdXAgZGVncmFkZXMgdG8gdGhlIG9sZFxuICAgICAqIGJlaGF2aW91ciBpbnN0ZWFkIG9mIHBhcmVudGluZyB1bmRlciBzb21ldGhpbmcgYXJiaXRyYXJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVNjZW5lUm9vdFV1aWQoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRyZWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRyZWUubGVuZ3RoID4gMCA/ICh0cmVlWzBdLnV1aWQgfHwgbnVsbCkgOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRyZWU/LnV1aWQgfHwgbnVsbDtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEVudGVyIHByZWZhYi1lZGl0IG1vZGUgZm9yIGEgcHJlZmFiIGFzc2V0LlxuICAgICAqXG4gICAgICogVGhlIHByZXZpb3VzIGltcGxlbWVudGF0aW9uIGNhbGxlZCBgc2NlbmU6bG9hZC1hc3NldGAsIGEgbWVzc2FnZSB0aGF0IGRvZXMgbm90IGV4aXN0XG4gICAgICogaW4gQ29jb3MgQ3JlYXRvciAzLjguNyDigJQgZXZlcnkgY2FsbCByZWplY3RlZCB3aXRoIGBNZXNzYWdlIGRvZXMgbm90IGV4aXN0OiBzY2VuZSAtXG4gICAgICogbG9hZC1hc3NldGAsIHNvIGBsb2FkYCBjb3VsZCBuZXZlciBzdWNjZWVkIGFuZCB0aGUgcHJlZmFiLWVkaXQgcGF0aCB0aHJvdWdoIHRoaXMgdG9vbFxuICAgICAqIHdhcyB1bnJlYWNoYWJsZSAoIzEyMCBpdGVtIDMpLlxuICAgICAqXG4gICAgICogVGhlcmUgaXMgbm8gYHNjZW5lOmAgbWVzc2FnZSB0aGF0IGVudGVycyBwcmVmYWItZWRpdCBtb2RlOyB0aGUgZWRpdG9yIG9wZW5zIHRoZSBhc3NldFxuICAgICAqIGl0c2VsZi4gVGhlIHBhdGggdGhhdCB3b3JrcyBpcyBgYXNzZXQtZGI6cXVlcnktYXNzZXQtaW5mb2AgdG8gY29uZmlybSB0aGUgdXVpZCBuYW1lcyBhXG4gICAgICogcHJlZmFiLCB0aGVuIGBhc3NldC1kYjpvcGVuLWFzc2V0YCAoYSBkZWNsYXJlZCBtZXNzYWdlLCBgYXNzZXQtZGIvQHR5cGVzL21lc3NhZ2UuZC50c2ApXG4gICAgICogdG8gaGFuZCB0aGUgYXNzZXQgdG8gdGhlIGVkaXRvcidzIG93biBhc3NldC1vcGVuZXIsIHdoaWNoIGlzIHdoYXQgdGhlIEFzc2V0IEJyb3dzZXJcbiAgICAgKiBkb3VibGUtY2xpY2sgZG9lcy4gVGhlIHV1aWQgaXMgcmVzb2x2ZWQgdG8gaXRzIGB1cmxgIGZpcnN0IGJlY2F1c2UgYG9wZW4tYXNzZXRgIGlzXG4gICAgICogZG9jdW1lbnRlZCB0byB0YWtlIGEgdXJsLlxuICAgICAqXG4gICAgICogQ29uZmlybWVkIHRvIGEgbGV2ZWwgdGhpcyByZXBvIGNhbiByZWFjaDogdGhlIG1lc3NhZ2UgZXhpc3RzIGluIHRoZSBlZGl0b3IncyBvd25cbiAgICAgKiBkZWNsYXJhdGlvbnMgYW5kIHRoZSByZXNvbHZlLXRoZW4tb3BlbiBzZXF1ZW5jZSBpcyB3aGF0IHRoZSBlZGl0b3IgVUkgcGVyZm9ybXMuIFRoZVxuICAgICAqIGJlaGF2aW91cmFsIGhhbGYg4oCUIHRoYXQgdGhlIGVkaXRvciBsYW5kcyBpbiBwcmVmYWItZWRpdCBtb2RlIOKAlCBpcyBhc3NlcnRlZCB0byBiZVxuICAgICAqIHVudmVyaWZpYWJsZSB3aXRob3V0IGEgbGl2ZSBlZGl0b3IsIGFuZCBpcyBjYWxsZWQgb3V0IGFzIHN1Y2ggb24gdGhlIGlzc3VlIHJhdGhlclxuICAgICAqIHRoYW4gY2xhaW1lZCBoZXJlLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgbG9hZFByZWZhYkJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB1dWlkKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBQcmVmYWIgdXVpZCAnJHt1dWlkfScgbm90IGZvdW5kIGluIHRoZSBhc3NldCBEQmAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdWZXJpZnkgdGhlIHV1aWQsIGFuZCByZWZyZXNoIHRoZSBhc3NldCBEQiAobWFuYWdlX2Fzc2V0IGFjdGlvbj1yZWZyZXNoKSBpZiB0aGUgLnByZWZhYiBmaWxlIHdhcyB3cml0dGVuIG91dHNpZGUgdGhlIGVkaXRvci4nXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gYHR5cGVgIGlzIHRoZSBpbXBvcnRlciB0eXBlIOKAlCAncHJlZmFiJyBmb3IgYSAucHJlZmFiIGFzc2V0LiBSZWZ1c2UgYSBub24tcHJlZmFiXG4gICAgICAgIC8vIHJhdGhlciB0aGFuIG9wZW5pbmcsIHNheSwgYSB0ZXh0dXJlIGFuZCByZXBvcnRpbmcgYSBwcmVmYWIgd2FzIGxvYWRlZC5cbiAgICAgICAgaWYgKGFzc2V0SW5mby50eXBlICYmIGFzc2V0SW5mby50eXBlICE9PSAncHJlZmFiJykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYEFzc2V0ICcke2Fzc2V0SW5mby51cmwgfHwgdXVpZH0nIGlzIGEgJyR7YXNzZXRJbmZvLnR5cGV9Jywgbm90IGEgcHJlZmFiYCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1Bhc3MgdGhlIHV1aWQgb2YgYSAucHJlZmFiIGFzc2V0IChtYW5hZ2VfcHJlZmFiIGFjdGlvbj1saXN0IHJldHVybnMgdGhlbSkuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGFzc2V0SW5mby51cmwgfHwgdXVpZDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCB0YXJnZXQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYENvdWxkIG5vdCBvcGVuIHByZWZhYiAnJHt0YXJnZXR9JzogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiBgT3BlbiAnJHt0YXJnZXR9JyBpbiB0aGUgQ29jb3MgQ3JlYXRvciBBc3NldCBCcm93c2VyIChkb3VibGUtY2xpY2sgaXQpIHRvIGVkaXQgdGhlIHByZWZhYi5gXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgdXVpZDogYXNzZXRJbmZvLnV1aWQgfHwgdXVpZCxcbiAgICAgICAgICAgICAgICBuYW1lOiBhc3NldEluZm8ubmFtZSxcbiAgICAgICAgICAgICAgICB1cmw6IHRhcmdldCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIG9wZW5lZCBmb3IgZWRpdGluZycsXG4gICAgICAgICAgICAgICAgLy8gUHJlZmFiLWVkaXQgbW9kZSBpcyBhbiBlZGl0b3Itc2lkZSBzdGF0ZS4gVGhpcyB0b29sIGNhbiBjb25maXJtIHRoZSBvcGVuXG4gICAgICAgICAgICAgICAgLy8gcmVxdWVzdCB3YXMgYWNjZXB0ZWQsIG5vdCB0aGF0IHRoZSBlZGl0b3Igc3dpdGNoZWQgbW9kZXMsIHNvIHRoZSBjYWxsZXIgaXNcbiAgICAgICAgICAgICAgICAvLyB0b2xkIHdoaWNoIGhhbGYgd2FzIHZlcmlmaWVkIHJhdGhlciB0aGFuIGdpdmVuIGEgYmFyZSBzdWNjZXNzLlxuICAgICAgICAgICAgICAgIHByZWZhYkVkaXRNb2RlVmVyaWZpZWQ6IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbnN0YW50aWF0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHByZWZhYlV1aWQ6IHN0cmluZzsgcGFyZW50VXVpZD86IHN0cmluZzsgcG9zaXRpb24/OiBhbnk7IHJvdGF0aW9uPzogYW55OyBzY2FsZT86IGFueSB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSB9ID0gYXJncztcblxuICAgICAgICAgICAgLy8gQW4gdW5yZXNvbHZhYmxlIHV1aWQgbXVzdCBiZSBmYXRhbDogY3JlYXRlLW5vZGUgc2lsZW50bHkgcmV0dXJucyBub3RoaW5nIGZvciBpdCxcbiAgICAgICAgICAgIC8vIHdoaWNoIHByZXZpb3VzbHkgcHJvZHVjZWQgYSBzdWNjZXNzIGVudmVsb3BlIHdpdGggbm8gbm9kZVV1aWQgKCMxNSkuXG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgcHJlZmFiVXVpZCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB1dWlkICcke3ByZWZhYlV1aWR9JyBub3QgZm91bmQgaW4gdGhlIGFzc2V0IERCYCxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdWZXJpZnkgdGhlIHV1aWQsIGFuZCByZWZyZXNoIHRoZSBhc3NldCBEQiAobWFuYWdlX2Fzc2V0IGFjdGlvbj1yZWZyZXNoKSBpZiB0aGUgLnByZWZhYiBmaWxlIHdhcyB3cml0dGVuIG91dHNpZGUgdGhlIGVkaXRvci4nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY3JlYXRlTm9kZU9wdGlvbnM6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgLy8gYHR5cGVgIHNlbGVjdHMgdGhlIGNyZWF0ZU5vZGVGcm9tQXNzZXQoKSBicmFuY2ggdGhhdCBpbnN0YW50aWF0ZXMgYVxuICAgICAgICAgICAgICAgIC8vIGxpbmtlZCBQcmVmYWJJbnN0YW5jZS4gV2l0aG91dCBpdCwgMy44LjcncyBub2RlIG1hbmFnZXIgZmFsbHMgYmFjayB0b1xuICAgICAgICAgICAgICAgIC8vIGJ1aWxkaW5nIGEgcGxhaW4gbm9kZSBmcm9tIHRoZSBhc3NldCdzIHJhdyBkdW1wIOKAlCBhIGZsYXR0ZW5lZCxcbiAgICAgICAgICAgICAgICAvLyB1bmxpbmtlZCBjb3B5IHRoYXQgcmVwb3J0cyBzdWNjZXNzIGJ1dCBjYXJyaWVzIG5vIGNjLlByZWZhYkluZm8gKHNlZVxuICAgICAgICAgICAgICAgIC8vIE5vZGVNYW5hZ2VyLmNyZWF0ZU5vZGVGcm9tQXNzZXQganNkb2M6IFwib3B0aW9ucy50eXBlOiDotYTmupDnsbvlnotcIikuXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXRJbmZvLnR5cGVcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucGFyZW50ID0gcGFyZW50VXVpZDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTm8gY2FsbGVyLXN1cHBsaWVkIHBhcmVudDogcGluIHRoZSBwbGFjZW1lbnQgdG8gdGhlIHNjZW5lIHJvb3QuIExlYXZpbmdcbiAgICAgICAgICAgICAgICAvLyBgcGFyZW50YCB1bnNldCBoYW5kcyB0aGUgZGVjaXNpb24gdG8gYGNyZWF0ZS1ub2RlYCdzIGltcGxpY2l0XG4gICAgICAgICAgICAgICAgLy8gbGFzdC1jcmVhdGVkL2xhc3Qtc2VsZWN0ZWQgaGV1cmlzdGljLCB3aGljaCBuZXN0cyB1bnJlbGF0ZWQgaW5zdGFuY2VzXG4gICAgICAgICAgICAgICAgLy8gKCMxMjAgaXRlbSAxKS4gQSBudWxsIHJlc29sdmUgbGVhdmVzIGl0IHVuc2V0IOKAlCB0aGUgb2xkIGJlaGF2aW91ciDigJQgcmF0aGVyXG4gICAgICAgICAgICAgICAgLy8gdGhhbiBwYXJlbnRpbmcgdW5kZXIgYSBndWVzcy5cbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZVJvb3QgPSBhd2FpdCB0aGlzLnJlc29sdmVTY2VuZVJvb3RVdWlkKCk7XG4gICAgICAgICAgICAgICAgaWYgKHNjZW5lUm9vdCkgY3JlYXRlTm9kZU9wdGlvbnMucGFyZW50ID0gc2NlbmVSb290O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYXNzZXRJbmZvICYmIGFzc2V0SW5mby5uYW1lKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMubmFtZSA9IGFzc2V0SW5mby5uYW1lO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICAvLyBgcG9zaXRpb25gIGlzIGEgZG9jdW1lbnRlZCB0b3AtbGV2ZWwgQ3JlYXRlTm9kZU9wdGlvbnMgZmllbGQ7IGBkdW1wYFxuICAgICAgICAgICAgICAgIC8vIGlzIGV4cGxpY2l0bHkgY29tbWVudGVkIG91dCBhcyB1bnVzZWQgaW4gQGNvY29zL2NyZWF0b3ItdHlwZXMg4oCUIGl0IHdhc1xuICAgICAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZWQsIHNvIGluc3RhbnRpYXRlZCBwcmVmYWJzIG5ldmVyIHBpY2tlZCB1cCB0aGlzIHBvc2l0aW9uLlxuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBjcmVhdGVOb2RlT3B0aW9ucyk7XG4gICAgICAgICAgICBjb25zdCB1dWlkID0gQXJyYXkuaXNBcnJheShub2RlVXVpZCkgPyBub2RlVXVpZFswXSA6IG5vZGVVdWlkO1xuXG4gICAgICAgICAgICAvLyBOZXZlciByZXBvcnQgc3VjY2VzcyB3aXRob3V0IGEgbm9kZSBpZCDigJQgdGhlIGNhbGxlciB3b3VsZCBidWlsZCBvbiBhIHNjZW5lXG4gICAgICAgICAgICAvLyB0aGF0IHNpbGVudGx5IGxhY2tzIHRoZSBub2RlICgjMTUpLlxuICAgICAgICAgICAgaWYgKCF1dWlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgY3JlYXRlLW5vZGUgcmV0dXJuZWQgbm8gbm9kZSB1dWlkIGZvciBwcmVmYWIgJyR7cHJlZmFiVXVpZH0nIOKAlCBub3RoaW5nIHdhcyBpbnN0YW50aWF0ZWRgLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ0Vuc3VyZSBhIHNjZW5lIGlzIG9wZW4gYW5kIHRoZSBwcmVmYWIgYXNzZXQgaXMgdmFsaWQsIHRoZW4gcmV0cnkuJ1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFwcGx5IHJvdGF0aW9uIGFuZCBzY2FsZSBpZiBwcm92aWRlZFxuICAgICAgICAgICAgaWYgKHJvdGF0aW9uKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnZXVsZXJBbmdsZXMnLFxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiByb3RhdGlvbiwgdHlwZTogJ2NjLlZlYzMnIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7Lyogbm9uLWZhdGFsICovfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2NhbGUpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6ICdzY2FsZScsXG4gICAgICAgICAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHNjYWxlLCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHsvKiBub24tZmF0YWwgKi99KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQ6IHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudFV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgc2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgaW5zdGFudGlhdGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBpbnN0YW50aWF0ZSBwcmVmYWI6ICR7ZXJyLm1lc3NhZ2V9YCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ0NoZWNrIHRoYXQgdGhlIHByZWZhYlV1aWQgaXMgY29ycmVjdCBhbmQgdGhlIGFzc2V0IERCIGlzIHJlYWR5LidcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVByZWZhYihhcmdzOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0aFBhcmFtID0gYXJncy5wcmVmYWJQYXRoIHx8IGFyZ3Muc2F2ZVBhdGg7XG4gICAgICAgICAgICBpZiAoIXBhdGhQYXJhbSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ01pc3NpbmcgcHJlZmFiIHBhdGggcGFyYW1ldGVyLiBQcm92aWRlIHNhdmVQYXRoLicgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiTmFtZSA9IGFyZ3MucHJlZmFiTmFtZSB8fCAnTmV3UHJlZmFiJztcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gcGF0aFBhcmFtLmVuZHNXaXRoKCcucHJlZmFiJykgP1xuICAgICAgICAgICAgICAgIHBhdGhQYXJhbSA6IGAke3BhdGhQYXJhbX0vJHtwcmVmYWJOYW1lfS5wcmVmYWJgO1xuXG4gICAgICAgICAgICBjb25zdCBpbmNsdWRlQ2hpbGRyZW4gPSBhcmdzLmluY2x1ZGVDaGlsZHJlbiAhPT0gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCBpbmNsdWRlQ29tcG9uZW50cyA9IGFyZ3MuaW5jbHVkZUNvbXBvbmVudHMgIT09IGZhbHNlO1xuXG4gICAgICAgICAgICBjb25zdCBhc3NldERiUmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiV2l0aEFzc2V0REIoXG4gICAgICAgICAgICAgICAgYXJncy5ub2RlVXVpZCwgZnVsbFBhdGgsIHByZWZhYk5hbWUsIGluY2x1ZGVDaGlsZHJlbiwgaW5jbHVkZUNvbXBvbmVudHNcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBpZiAoYXNzZXREYlJlc3VsdC5zdWNjZXNzKSByZXR1cm4gYXNzZXREYlJlc3VsdDtcbiAgICAgICAgICAgIC8vIEEgZGVmZWN0aXZlIHdyaXRlIGlzIGEgcmVzdWx0LCBub3QgYW4gdW5hdmFpbGFibGUgcGF0aCDigJQgcmV0cnlpbmcgdGhyb3VnaFxuICAgICAgICAgICAgLy8gdGhlIGZhbGxiYWNrIGNoYWluIHdvdWxkIHJlLXNlcmlhbGl6ZSB0aGUgc2FtZSBsb3NzIGFuZCBtYXNrIGl0ICgjMjgpLlxuICAgICAgICAgICAgaWYgKGFzc2V0RGJSZXN1bHQuZmF0YWwpIHJldHVybiBhc3NldERiUmVzdWx0O1xuXG4gICAgICAgICAgICBjb25zdCBuYXRpdmVSZXN1bHQgPSB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJOYXRpdmVTdHViKCk7XG4gICAgICAgICAgICBpZiAobmF0aXZlUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBuYXRpdmVSZXN1bHQ7XG5cbiAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJDdXN0b20oYXJncy5ub2RlVXVpZCwgZnVsbFBhdGgsIHByZWZhYk5hbWUpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRXJyb3IgY3JlYXRpbmcgcHJlZmFiOiAke2Vycm9yfWAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgdGhlIHByZWZhYi1pbnN0YW5jZSBjb250ZXh0IGZvciBhIG5vZGUuXG4gICAgICpcbiAgICAgKiBDb2NvcyBDcmVhdG9yIGRyaXZlcyBib3RoIHByZWZhYiBtZXNzYWdlcyBmcm9tIHRoZSBub2RlIGR1bXAncyBgX19wcmVmYWJfX2BcbiAgICAgKiBibG9jayDigJQgYHJvb3RVdWlkYCAodGhlIHByZWZhYi1pbnN0YW5jZSBST09ULCBub3Qgd2hpY2hldmVyIGRlc2NlbmRhbnQgdGhlXG4gICAgICogY2FsbGVyIGhhcHBlbmVkIHRvIHBhc3MpIGFuZCBgdXVpZGAgKHRoZSBiYWNraW5nIHByZWZhYiBhc3NldCkuIFNlZSAzLjguN1xuICAgICAqIGByZXNvdXJjZXMvM2QvZW5naW5lL2VkaXRvci9pbnNwZWN0b3IvY29udHJpYnV0aW9ucy9ub2RlLmpzYDpcbiAgICAgKiAgIHJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYicsIHByZWZhYi5yb290VXVpZClcbiAgICAgKiAgIHJlcXVlc3QoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgcHJlZmFiLnJvb3RVdWlkLCBwcmVmYWIudXVpZClcbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBsZXQgbm9kZURhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byBxdWVyeSBub2RlICR7bm9kZVV1aWR9OiAke2Vyci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIW5vZGVEYXRhKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdOb2RlIG5vdCBmb3VuZCcgfTtcblxuICAgICAgICBjb25zdCBwcmVmYWIgPSBub2RlRGF0YS5fX3ByZWZhYl9fO1xuICAgICAgICBpZiAoIXByZWZhYikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBpcyBub3QgcGFydCBvZiBhIHByZWZhYiBpbnN0YW5jZWAgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIHJvb3RVdWlkOiBwcmVmYWIucm9vdFV1aWQgfHwgbm9kZVV1aWQsXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHByZWZhYi51dWlkIHx8IHByZWZhYi5wcmVmYWJTdGF0ZUluZm8/LmFzc2V0VXVpZCxcbiAgICAgICAgICAgIG5vZGVEYXRhXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSBhIHByZWZhYiBhc3NldCdzIG9uLWRpc2sgcGF0aCwgb3IgbnVsbCB3aGVuIGl0IGNhbm5vdCBiZSBkZXRlcm1pbmVkLlxuICAgICAqXG4gICAgICogR29lcyB0aHJvdWdoIGBxdWVyeS1hc3NldC1pbmZvYCwgbm90IGBxdWVyeS1hc3NldC1tZXRhYDogdGhlIG1ldGEgcmVjb3JkIGhhcyBub1xuICAgICAqIGB1cmxgIGZpZWxkLCBzbyB0aGUgb2xkIGxvb2t1cCByZXNvbHZlZCB0byBudWxsIGZvciBldmVyeSBhc3NldCBhbmQgbGVmdCB0aGVcbiAgICAgKiBwb3N0LWFwcGx5IHdyaXRlIGNoZWNrIHBlcm1hbmVudGx5IGB1bnZlcmlmaWVkYCAoIzI1KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVQcmVmYWJGaWxlUGF0aChhc3NldFV1aWQ/OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgaWYgKCFhc3NldFV1aWQpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gKGF3YWl0IHJlc29sdmVBc3NldChhc3NldFV1aWQpKS5maWxlUGF0aDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRNdGltZU1zKGZpbGVQYXRoOiBzdHJpbmcgfCBudWxsKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgICAgIGlmICghZmlsZVBhdGgpIHJldHVybiBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5tdGltZU1zO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIFBvbGwgZm9yIHRoZSBwcmVmYWIgZmlsZSB0byBiZSByZXdyaXR0ZW47IGFzc2V0LWRiIG1heSBmbHVzaCBzaG9ydGx5IGFmdGVyIHRoZSBtZXNzYWdlIHJlc29sdmVzLiAqL1xuICAgIHByaXZhdGUgYXN5bmMgd2FpdEZvclByZWZhYldyaXRlKGZpbGVQYXRoOiBzdHJpbmcsIGJhc2VsaW5lTXM6IG51bWJlciwgdGltZW91dE1zID0gMjAwMCk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XG4gICAgICAgIGxldCBtdGltZSA9IHRoaXMuc3RhdE10aW1lTXMoZmlsZVBhdGgpO1xuICAgICAgICB3aGlsZSAobXRpbWUgIT09IG51bGwgJiYgbXRpbWUgPD0gYmFzZWxpbmVNcyAmJiBEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcbiAgICAgICAgICAgIG10aW1lID0gdGhpcy5zdGF0TXRpbWVNcyhmaWxlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG10aW1lO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlUHJlZmFiKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFjb250ZXh0LnN1Y2Nlc3MpIHJldHVybiBjb250ZXh0O1xuICAgICAgICAgICAgY29uc3QgeyByb290VXVpZCwgYXNzZXRVdWlkLCBub2RlRGF0YSB9ID0gY29udGV4dDtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiUGF0aCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkZpbGVQYXRoKGFzc2V0VXVpZCk7XG4gICAgICAgICAgICBjb25zdCBtdGltZUJlZm9yZSA9IHRoaXMuc3RhdE10aW1lTXMocHJlZmFiUGF0aCk7XG5cbiAgICAgICAgICAgIC8vIFJlZnVzZSBCRUZPUkUgdGhlIHdyaXRlOiBhcHBseS1wcmVmYWIgc2VyaWFsaXplcyBldmVyeXRoaW5nIHVuZGVyIHRoZSByZXNvbHZlZFxuICAgICAgICAgICAgLy8gcm9vdCwgc28gYSBmb3JlaWduIGluc3RhbmNlIG5lc3RlZCBpbiBpdCB3b3VsZCBiZSBhYnNvcmJlZCBpbnRvIHRoaXMgYXNzZXQgKCMxMjApLlxuICAgICAgICAgICAgaWYgKGFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvcmVpZ24gPSBhd2FpdCB0aGlzLmZpbmRGb3JlaWduUHJlZmFiSW5zdGFuY2VzKFxuICAgICAgICAgICAgICAgICAgICByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCByb290VXVpZCA9PT0gbm9kZVV1aWQgPyBub2RlRGF0YSA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKGZvcmVpZ24ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFJlZnVzaW5nIHRvIGFwcGx5ICR7cm9vdFV1aWR9IHRvIHByZWZhYiAke2Fzc2V0VXVpZH06IGl0cyBzdWJ0cmVlIGNvbnRhaW5zIHByZWZhYiBpbnN0YW5jZShzKSAke2ZvcmVpZ24uam9pbignLCAnKX0gdGhhdCB0aGUgYXNzZXQgZG9lcyBub3QgYWxyZWFkeSByZWZlcmVuY2UuIEFwcGx5aW5nIHdvdWxkIHdyaXRlIHRoZWlyIGNvbnRlbnQgaW50byB0aGlzIHByZWZhYi4gTW92ZSB0aG9zZSBpbnN0YW5jZXMgb3V0IGZyb20gdW5kZXIgdGhlIHJvb3QgKG1hbmFnZV9ub2RlIGFjdGlvbj1tb3ZlKSBhbmQgcmV0cnkuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIGZvcmVpZ25QcmVmYWJBc3NldHM6IGZvcmVpZ24gfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYHNjZW5lOmFwcGx5LXByZWZhYmAgdGFrZXMgdGhlIGluc3RhbmNlIHJvb3QgdXVpZCBhcyBhIFBPU0lUSU9OQUwgc3RyaW5nXG4gICAgICAgICAgICAvLyBhbmQgcmVzb2x2ZXMgdG8gYSBib29sZWFuLiBUaGUgb2xkIGB7IG5vZGU6IHV1aWQgfWAgb2JqZWN0IGZvcm0gcmVzb2x2ZWRcbiAgICAgICAgICAgIC8vIHdpdGhvdXQgdGhyb3dpbmcgYnV0IG5ldmVyIHdyb3RlIHRoZSBhc3NldCDigJQgYSBzaWxlbnQgbm8tb3AgcmVwb3J0ZWQgYXNcbiAgICAgICAgICAgIC8vIHN1Y2Nlc3MgKCMxMikuXG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAnYXBwbHktcHJlZmFiJywgcm9vdFV1aWQpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgdGhlIGFzc2V0IHdhcyBhY3R1YWxseSB3cml0dGVuIHJhdGhlciB0aGFuIHRydXN0aW5nIHRoZSBib29sZWFuIHRoZVxuICAgICAgICAgICAgLy8gbWVzc2FnZSByZXNvbHZlcyB0byBlaXRoZXIgd2F5LiBgdW52ZXJpZmllZGAgbWVhbnMgdGhlIHBhdGggY291bGQgbm90IGJlXG4gICAgICAgICAgICAvLyByZXNvbHZlZCwgbm90IHRoYXQgdGhlIHdyaXRlIGZhaWxlZC4gVGhpcyBydW5zIGV2ZW4gd2hlbiBgYXBwbGllZCA9PT0gZmFsc2VgOlxuICAgICAgICAgICAgLy8gdGhlIGVkaXRvciBoYXMgYmVlbiBvYnNlcnZlZCByZXNvbHZpbmcgYGZhbHNlYCBvbiBzYXZlcyB0aGF0IERJRCByZXdyaXRlIHRoZVxuICAgICAgICAgICAgLy8gZmlsZSAoIzYzKSDigJQgdHJ1c3RpbmcgdGhhdCBzaWduYWwgYWxvbmUgdHVybnMgYSBzdWNjZXNzZnVsIHVwZGF0ZSBpbnRvIGFcbiAgICAgICAgICAgIC8vIHJlcG9ydGVkIGZhaWx1cmUuIFRoZSBtdGltZSBjaGVjayBpcyB0aGUgc291cmNlIG9mIHRydXRoOyBgYXBwbGllZGAgaXMgb25seVxuICAgICAgICAgICAgLy8gY29uc3VsdGVkIHdoZW4gdGhlIG10aW1lIGNhbm5vdCBjb25maXJtIG9uZSB3YXkgb3IgdGhlIG90aGVyLlxuICAgICAgICAgICAgbGV0IHBlcnNpc3RlZDogYm9vbGVhbiB8ICd1bnZlcmlmaWVkJyA9ICd1bnZlcmlmaWVkJztcbiAgICAgICAgICAgIGlmIChwcmVmYWJQYXRoICE9PSBudWxsICYmIG10aW1lQmVmb3JlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbXRpbWVBZnRlciA9IGF3YWl0IHRoaXMud2FpdEZvclByZWZhYldyaXRlKHByZWZhYlBhdGgsIG10aW1lQmVmb3JlKTtcbiAgICAgICAgICAgICAgICBpZiAobXRpbWVBZnRlciAhPT0gbnVsbCkgcGVyc2lzdGVkID0gbXRpbWVBZnRlciA+IG10aW1lQmVmb3JlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBIHJlamVjdGVkIGFwcGx5IGlzIGEgSEFSRCBTVE9QLCB3aGF0ZXZlciB0aGUgbXRpbWUgZ3VhcmQgc2F5cyAoIzEyOCwgIzEyNykuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gIzYzIGVzdGFibGlzaGVkIHRoYXQgYGZhbHNlYCBhbG9uZSBkb2VzIG5vdCBtZWFuIHRoZSB3cml0ZSBmYWlsZWQg4oCUIHRoZSBmaWxlIGNhblxuICAgICAgICAgICAgLy8gYmUgcmV3cml0dGVuIGFueXdheSDigJQgc28gcmVqZWN0aW9uIHdhcyBkZW1vdGVkIGZyb20gXCJmYWlsdXJlXCIgdG8gXCJ1bmNvbmZpcm1lZFwiXG4gICAgICAgICAgICAvLyBhbmQgdGhlIG10aW1lIGNoZWNrIHdhcyBtYWRlIHRoZSBzb3VyY2Ugb2YgdHJ1dGguIFRoYXQgaXMgcmlnaHQgYWJvdXQgdGhlIFdSSVRFXG4gICAgICAgICAgICAvLyBhbmQgd3JvbmcgYWJvdXQgZXZlcnl0aGluZyBkb3duc3RyZWFtIG9mIGl0OiB0aGUgb3JwaGFuIHBhc3MgYmVsb3cgdHJlYXRzIHRoZVxuICAgICAgICAgICAgLy8gbGl2ZSBgcXVlcnktbm9kZWAgd2FsayBhcyBncm91bmQgdHJ1dGggZm9yIHdoYXQgbWF5IGxlZ2l0aW1hdGVseSBiZSBkZWxldGVkLCBhbmRcbiAgICAgICAgICAgIC8vIGEgcmVqZWN0ZWQgYXBwbHkgaXMgcHJlY2lzZWx5IHRoZSBzaWduYWwgdGhhdCBpdHMgdmlldyBvZiB0aGUgaW5zdGFuY2UgY2Fubm90IGJlXG4gICAgICAgICAgICAvLyB0cnVzdGVkLiBSdW5uaW5nIHRoZSBwYXNzIGFueXdheSBsZXQgYHVwZGF0ZWAgZGVsZXRlIGEgcHJlZmFiJ3MgRU5USVJFIGNoaWxkIHNldFxuICAgICAgICAgICAgLy8gd2hpbGUgcmVwb3J0aW5nIGBzdWNjZXNzOiB0cnVlYCDigJQgOCBjaGlsZHJlbiB0byAwIG9uIGRpc2sgaW4gIzEyOCwgYSBuZXN0ZWRcbiAgICAgICAgICAgIC8vIGluc3RhbmNlJ3Mgd2hvbGUgbG9jYWwgbm9kZSBtaXJyb3IgaW4gIzEyNy5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBOZXZlciB0b3VjaCB0aGUgYXNzZXQgYWdhaW4gb24gYSB3cml0ZSB3ZSB3ZXJlIHRvbGQgbm90IHRvIHRydXN0OiBubyBvcnBoYW5cbiAgICAgICAgICAgIC8vIGRldGVjdGlvbiwgbm8gcmVtb3ZhbCwgbm8gc3VjY2VzcyBlbnZlbG9wZS5cbiAgICAgICAgICAgIGNvbnN0IGFwcGxpZWRSZWplY3RlZCA9IGFwcGxpZWQgPT09IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoYXBwbGllZFJlamVjdGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgRWRpdG9yIHJlamVjdGVkIGFwcGx5LXByZWZhYiBmb3Igbm9kZSAke3Jvb3RVdWlkfSwgc28gaXRzIHJlc3VsdCBpcyBub3QgdHJ1c3R3b3J0aHkgYW5kIG5vIGNoaWxkIG5vZGVzIHdlcmUgcmVtb3ZlZC4gQ29uZmlybSBpdCBpcyBhIHByZWZhYi1pbnN0YW5jZSByb290IHdpdGggYSB2YWxpZCBhc3NldCBsaW5rLmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgKHBlcnNpc3RlZCA9PT0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYCBUaGUgcmVqZWN0ZWQgYXBwbHkgZGlkIHJld3JpdGUgJHtwcmVmYWJQYXRofSDigJQgZGlmZiBpdCBhZ2FpbnN0IGdpdCBiZWZvcmUgcmV0cnlpbmcuYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJycpLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQsIGFwcGxpZWRSZWplY3RlZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBhcHBseS1wcmVmYWIgcmVwb3J0ZWQgbm8gZXJyb3IgYnV0ICR7cHJlZmFiUGF0aH0gd2FzIG5vdCByZXdyaXR0ZW4uIFRoZSBub2RlIG1heSBoYXZlIG5vIG92ZXJyaWRlcyB0byBhcHBseSwgb3IgaXRzIHByZWZhYiBsaW5rIGlzIHN0YWxlLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYGFwcGx5LXByZWZhYmAgd3JpdGVzIHByb3BlcnR5IG92ZXJyaWRlcyBidXQgZG9lcyBub3QgcmVtb3ZlIGEgY2hpbGQgbm9kZVxuICAgICAgICAgICAgLy8gZGVsZXRlZCBmcm9tIHRoZSBpbnN0YW5jZSAoIzIxKSDigJQgdGhlIG10aW1lIGd1YXJkIGFib3ZlIGNhbm5vdCBzZWUgdGhpcyxcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgYSBkZWxldGlvbiBzdGlsbCBwcm9kdWNlcyBvdmVycmlkZXMgZWxzZXdoZXJlLCBzbyB0aGUgZmlsZSBJU1xuICAgICAgICAgICAgLy8gcmV3cml0dGVuIGFuZCBgcGVyc2lzdGVkYCBpcyBnZW51aW5lbHkgYHRydWVgLiBDb21wYXJlIHRoZSBsaXZlIGluc3RhbmNlJ3NcbiAgICAgICAgICAgIC8vIGZpbGVJZHMgYWdhaW5zdCB0aGUgZnJlc2hseS13cml0dGVuIGFzc2V0J3MgdG8gY2F0Y2ggdGhlIHNwZWNpZmljIGZhaWx1cmVcbiAgICAgICAgICAgIC8vIG1vZGUgdGhlIG10aW1lIGNoZWNrIGNhbm5vdDogYSBjaGlsZCBzdGlsbCBwcmVzZW50IG9uIGRpc2sgdGhhdCBubyBsb25nZXJcbiAgICAgICAgICAgIC8vIGV4aXN0cyBpbiB0aGUgc2NlbmUuIEFueXRoaW5nIGZvdW5kIGlzIHRoZW4gcmVtb3ZlZCBmcm9tIHRoZSBhc3NldCwgc2luY2VcbiAgICAgICAgICAgIC8vIHJlcG9ydGluZyB0aGUgc3RhbGUgY2hpbGRyZW4gaXMgbm90IHRoZSBzYW1lIGFzIGhvbm91cmluZyB0aGUgZGVsZXRpb24uXG4gICAgICAgICAgICBsZXQgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gdHJ1ZSAmJiBwcmVmYWJQYXRoKSB7XG4gICAgICAgICAgICAgICAgb3JwaGFuZWRGaWxlSWRzID0gYXdhaXQgdGhpcy5maW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQsIHByZWZhYlBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlbW92ZWRGaWxlSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKG9ycGhhbmVkRmlsZUlkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZhbCA9IGF3YWl0IHRoaXMucmVtb3ZlT3JwaGFuZWRDaGlsZHJlbkZyb21Bc3NldChcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aCBhcyBzdHJpbmcsIG9ycGhhbmVkRmlsZUlkcywgcm9vdFV1aWQsIGFzc2V0VXVpZFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdmFsLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBhcHBseS1wcmVmYWIgd3JvdGUgJHtwcmVmYWJQYXRofSwgYnV0IGl0IHN0aWxsIGNvbnRhaW5zICR7b3JwaGFuZWRGaWxlSWRzLmxlbmd0aH0gY2hpbGQgbm9kZShzKSAoZmlsZUlkOiAke29ycGhhbmVkRmlsZUlkcy5qb2luKCcsICcpfSkgdGhhdCBubyBsb25nZXIgZXhpc3QgaW4gdGhlIHNjZW5lIGluc3RhbmNlLiBDb2NvcyBDcmVhdG9yIDMuOC43J3MgYXBwbHktcHJlZmFiIGRvZXMgbm90IHJlbW92ZSBkZWxldGVkIGNoaWxkcmVuLCBhbmQgcmVtb3ZpbmcgdGhlbSBoZXJlIHdhcyBkZWNsaW5lZDogJHtyZW1vdmFsLmVycm9yfS4gVGhlIGFzc2V0IGlzIGJ5dGUtZm9yLWJ5dGUgdW5jaGFuZ2VkIOKAlCBkZWxldGUgYW5kIHJlY3JlYXRlIHRoZSBwcmVmYWIsIG9yIHJlbW92ZSB0aGUgc3RhbGUgZW50cmllcyBtYW51YWxseS5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkLCBvcnBoYW5lZEZpbGVJZHMgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZW1vdmVkRmlsZUlkcyA9IG9ycGhhbmVkRmlsZUlkcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT25seSBldmVyIHJlYWNoZWQgb24gYSBOT04tcmVqZWN0ZWQgYXBwbHk6IGEgcmVqZWN0aW9uIHJldHVybnMgYWJvdmUuIEtlZXBpbmdcbiAgICAgICAgICAgIC8vIGBhcHBsaWVkUmVqZWN0ZWRgIGluIHRoZSBwYXlsb2FkIChub3cgYWx3YXlzIGZhbHNlKSByYXRoZXIgdGhhbiBkcm9wcGluZyBpdCwgc29cbiAgICAgICAgICAgIC8vIGV4aXN0aW5nIGNhbGxlcnMgdGhhdCBicmFuY2ggb24gdGhlIGZpZWxkIGtlZXAgd29ya2luZyB1bmNoYW5nZWQuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogcmVtb3ZlZEZpbGVJZHMubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IGBQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHk7IHJlbW92ZWQgJHtyZW1vdmVkRmlsZUlkcy5sZW5ndGh9IGNoaWxkIG5vZGUocykgYXBwbHktcHJlZmFiIGxlZnQgYmVoaW5kYFxuICAgICAgICAgICAgICAgICAgICA6ICdQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCwgYXBwbGllZFJlamVjdGVkLCByZW1vdmVkRmlsZUlkcyB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBmaWxlSWRzIG9mIHByZWZhYi10cmFja2VkIG5vZGVzIHByZXNlbnQgaW4gdGhlIHdyaXR0ZW4gYXNzZXQgYnV0IGFic2VudFxuICAgICAqIGZyb20gdGhlIGxpdmUgc2NlbmUgaW5zdGFuY2Ug4oCUIGNoaWxkcmVuIGBhcHBseS1wcmVmYWJgIGZhaWxlZCB0byByZW1vdmUgKCMyMSkuXG4gICAgICogRGV0ZWN0aW9uIGlzIGJlc3QtZWZmb3J0OiBhbnkgZmFpbHVyZSByZXR1cm5zIG5vIG9ycGhhbnMgcmF0aGVyIHRoYW4gYSBmYWxzZVxuICAgICAqIHBvc2l0aXZlLCBzaW5jZSB0aGlzIGNoZWNrIG11c3QgbmV2ZXIgbWFzayBhIGdlbnVpbmUgc3VjY2Vzcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGZpbmRPcnBoYW5lZENoaWxkRmlsZUlkcyhyb290VXVpZDogc3RyaW5nLCBwcmVmYWJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsaXZlRmlsZUlkcyA9IGF3YWl0IHRoaXMuY29sbGVjdEluc3RhbmNlRmlsZUlkcyhyb290VXVpZCk7XG4gICAgICAgICAgICBpZiAobGl2ZUZpbGVJZHMuc2l6ZSA9PT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICAgICAgY29uc3QgYXNzZXREYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocHJlZmFiUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGFzc2V0RGF0YSkpIHJldHVybiBbXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RmlsZUlkcyA9IHRoaXMuY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMoYXNzZXREYXRhKTtcbiAgICAgICAgICAgIHJldHVybiBbLi4uYXNzZXRGaWxlSWRzXS5maWx0ZXIoaWQgPT4gIWxpdmVGaWxlSWRzLmhhcyhpZCkpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBBIGBxdWVyeS1ub2RlYCBgY2hpbGRyZW5gIGVudHJ5IGlzIGEgdXVpZCBzdHJpbmcgb3IgYSBwcm9wZXJ0eSBkdW1wOyByZXR1cm4gaXRzIHV1aWQgb3IgJycuICovXG4gICAgcHJpdmF0ZSBjaGlsZFV1aWRPZihlbnRyeTogYW55KTogc3RyaW5nIHtcbiAgICAgICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHJldHVybiBlbnRyeTtcbiAgICAgICAgaWYgKGVudHJ5ICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZW50cnkudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBlbnRyeS51dWlkO1xuICAgICAgICAgICAgaWYgKGVudHJ5LnZhbHVlICYmIHR5cGVvZiBlbnRyeS52YWx1ZS51dWlkID09PSAnc3RyaW5nJykgcmV0dXJuIGVudHJ5LnZhbHVlLnV1aWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFByZWZhYiBhc3NldCB1dWlkcyBmb3VuZCBpbiB0aGUgbGl2ZSBzdWJ0cmVlIHVuZGVyIGByb290VXVpZGAgdGhhdCBhcmUgbmVpdGhlciB0aGVcbiAgICAgKiB0YXJnZXQgYGFzc2V0VXVpZGAgbm9yIGFscmVhZHkgcmVmZXJlbmNlZCBieSB0aGUgdGFyZ2V0IGFzc2V0IGZpbGUgKCMxMjAgaXRlbSAyKS5cbiAgICAgKlxuICAgICAqIGBhcHBseS1wcmVmYWJgIHNlcmlhbGl6ZXMgdGhlIHdob2xlIHJlc29sdmVkIHJvb3QuIFdoZW4gdW5yZWxhdGVkIGluc3RhbmNlcyB3ZXJlIG5lc3RlZFxuICAgICAqIHVuZGVyIGl0ICh0aGUgb2xkIGBpbnN0YW50aWF0ZWAgcGFyZW50aW5nIGJ1Zywgb3IgYSBoYW5kLWJ1aWx0IGhpZXJhcmNoeSksIGFwcGx5aW5nXG4gICAgICogYWJzb3JiZWQgVEhFSVIgY29udGVudCBpbnRvIHRoZSB0YXJnZXQgYXNzZXQgLSAzNSBsaW5lcyBiZWNhbWUgNjQ2LCBhbmQgYSB3aG9sZSBzY2VuZVxuICAgICAqIHdhcyB3cml0dGVuIGludG8gYSBsZWFmIHByZWZhYi4gQSBuZXN0ZWQgaW5zdGFuY2UgdGhlIGFzc2V0IGFscmVhZHkgY2FycmllcyBpc1xuICAgICAqIGxlZ2l0aW1hdGUgYW5kIGhhcyBpdHMgdXVpZCBpbiB0aGUgZmlsZTsgYW4gaW5zdGFuY2UgdGhlIGZpbGUgaGFzIG5ldmVyIGhlYXJkIG9mIGlzXG4gICAgICogZm9yZWlnbi4gVGhlIHdhbGsgZmFpbHMgY2xvc2VkIG9uIGFuIHVucmVhZGFibGUgYXNzZXQgZmlsZSAobm90aGluZyBpcyBcImFscmVhZHlcbiAgICAgKiBjYXJyaWVkXCIpIGJ1dCBub3Qgb24gYW4gdW5xdWVyeWFibGUgbm9kZSAoaXQgb25seSBzZWVzIHdoYXQgdGhlIGVkaXRvciB3aWxsIHNob3cpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgZmluZEZvcmVpZ25QcmVmYWJJbnN0YW5jZXMoXG4gICAgICAgIHJvb3RVdWlkOiBzdHJpbmcsXG4gICAgICAgIGFzc2V0VXVpZDogc3RyaW5nLFxuICAgICAgICBwcmVmYWJQYXRoOiBzdHJpbmcgfCBudWxsLFxuICAgICAgICByb290RHVtcD86IGFueVxuICAgICk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICAgICAgbGV0IGFzc2V0VGV4dCA9ICcnO1xuICAgICAgICBpZiAocHJlZmFiUGF0aCkge1xuICAgICAgICAgICAgdHJ5IHsgYXNzZXRUZXh0ID0gZnMucmVhZEZpbGVTeW5jKHByZWZhYlBhdGgsICd1dGYtOCcpOyB9IGNhdGNoIHsgYXNzZXRUZXh0ID0gJyc7IH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmb3JlaWduID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGNvbnN0IHZpc2l0ID0gYXN5bmMgKHV1aWQ6IHN0cmluZywga25vd24/OiBhbnkpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIGxldCBub2RlRGF0YSA9IGtub3duO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSkge1xuICAgICAgICAgICAgICAgIHRyeSB7IG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpOyB9IGNhdGNoIHsgcmV0dXJuOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhIHx8IHR5cGVvZiBub2RlRGF0YSAhPT0gJ29iamVjdCcpIHJldHVybjtcbiAgICAgICAgICAgIGNvbnN0IG5lc3RlZEFzc2V0ID0gbm9kZURhdGEuX19wcmVmYWJfXz8udXVpZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbmVzdGVkQXNzZXQgPT09ICdzdHJpbmcnICYmIG5lc3RlZEFzc2V0ICYmIG5lc3RlZEFzc2V0ICE9PSBhc3NldFV1aWQgJiYgIWFzc2V0VGV4dC5pbmNsdWRlcyhuZXN0ZWRBc3NldCkpIHtcbiAgICAgICAgICAgICAgICBmb3JlaWduLmFkZChuZXN0ZWRBc3NldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbjogYW55W10gPSBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSA/IG5vZGVEYXRhLmNoaWxkcmVuIDogW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRVdWlkID0gdGhpcy5jaGlsZFV1aWRPZihjaGlsZCk7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkVXVpZCkgYXdhaXQgdmlzaXQoY2hpbGRVdWlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgdmlzaXQocm9vdFV1aWQsIHJvb3REdW1wKTtcbiAgICAgICAgcmV0dXJuIFsuLi5mb3JlaWduXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBXYWxrIGEgbGl2ZSBwcmVmYWItaW5zdGFuY2Ugc3VidHJlZSBhbmQgY29sbGVjdCB0aGUgYF9fcHJlZmFiX18uZmlsZUlkYCBvZiBldmVyeSBub2RlLlxuICAgICAqXG4gICAgICogYHF1ZXJ5LW5vZGVgIHJldHVybnMgYGNoaWxkcmVuYCBhcyBwcm9wZXJ0eSBkdW1wcyAoYHsgdmFsdWU6IHsgdXVpZCB9LCB0eXBlIH1gKSwgbm90XG4gICAgICogdXVpZCBzdHJpbmdzOyBwYXNzaW5nIHRoZSBkdW1wIG9uIGFzIGEgdXVpZCByZWFjaGVkIG5vIGNoaWxkLCBzbyBldmVyeSBsaXZlIGNoaWxkXG4gICAgICogbG9va2VkIG9ycGhhbmVkIGFuZCB3YXMgZGVsZXRlZCBmcm9tIHRoZSBhc3NldC4gQW55IG5vZGUgdGhhdCBjYW5ub3QgYmUgcmVzb2x2ZWQgb3JcbiAgICAgKiBjYXJyaWVzIG5vIGZpbGVJZCBtYWtlcyB0aGUgd2FsayBpbmNvbXBsZXRlLCBhbmQgYW4gaW5jb21wbGV0ZSB3YWxrIHJldHVybnMgYW4gRU1QVFlcbiAgICAgKiBzZXQg4oCUIHRoZSBjYWxsZXIgdGhlbiByZW1vdmVzIG5vdGhpbmcgcmF0aGVyIHRoYW4gZGVsZXRpbmcgYSBjaGlsZCBpdCBmYWlsZWQgdG8gc2VlLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgY29sbGVjdEluc3RhbmNlRmlsZUlkcyhyb290VXVpZDogc3RyaW5nKTogUHJvbWlzZTxTZXQ8c3RyaW5nPj4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGxldCBjb21wbGV0ZSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHZpc2l0ID0gYXN5bmMgKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgICAgaWYgKCFjb21wbGV0ZSkgcmV0dXJuO1xuICAgICAgICAgICAgaWYgKCF1dWlkKSB7IGNvbXBsZXRlID0gZmFsc2U7IHJldHVybjsgfVxuICAgICAgICAgICAgbGV0IG5vZGVEYXRhOiBhbnk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHV1aWQpO1xuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgY29tcGxldGUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBmaWxlSWQgPSBub2RlRGF0YT8uX19wcmVmYWJfXz8uZmlsZUlkO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBmaWxlSWQgIT09ICdzdHJpbmcnIHx8ICFmaWxlSWQpIHsgY29tcGxldGUgPSBmYWxzZTsgcmV0dXJuOyB9XG4gICAgICAgICAgICBmaWxlSWRzLmFkZChmaWxlSWQpO1xuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW46IGFueVtdID0gQXJyYXkuaXNBcnJheShub2RlRGF0YS5jaGlsZHJlbikgPyBub2RlRGF0YS5jaGlsZHJlbiA6IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikgYXdhaXQgdmlzaXQodGhpcy5jaGlsZFV1aWRPZihjaGlsZCkpO1xuICAgICAgICB9O1xuICAgICAgICBhd2FpdCB2aXNpdChyb290VXVpZCk7XG4gICAgICAgIHJldHVybiBjb21wbGV0ZSA/IGZpbGVJZHMgOiBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICB9XG5cbiAgICAvKiogRXh0cmFjdCBldmVyeSBgY2MuTm9kZWAgZW50cnkncyBmaWxlSWQgZnJvbSBhIHdyaXR0ZW4gYC5wcmVmYWJgIGFzc2V0J3MgSlNPTiBhcnJheS4gKi9cbiAgICBwcml2YXRlIGNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGE6IGFueVtdKTogU2V0PHN0cmluZz4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCkgZmlsZUlkcy5hZGQoZmlsZUlkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZUlkcztcbiAgICB9XG5cbiAgICAvKiogVGhlIGZpbGVJZCByZWNvcmRlZCBvbiB0aGUgYGNjLk5vZGVgIGF0IGBpbmRleGAsIG9yIG51bGwgd2hlbiBpdCBoYXMgbm9uZS4gKi9cbiAgICBwcml2YXRlIGZpbGVJZE9mTm9kZShwcmVmYWJEYXRhOiBhbnlbXSwgaW5kZXg6IG51bWJlcik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBlbnRyeS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgIGlmICh0eXBlb2YgcHJlZmFiSW5mb0luZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IHByZWZhYkRhdGFbcHJlZmFiSW5mb0luZGV4XT8uZmlsZUlkO1xuICAgICAgICByZXR1cm4gdHlwZW9mIGZpbGVJZCA9PT0gJ3N0cmluZycgJiYgZmlsZUlkID8gZmlsZUlkIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2UgYXJyYXlzIHdob3NlIGVsZW1lbnQgb3JkZXIgaXMgc3RydWN0dXJhbCDigJQgYSByZW1vdmVkIGVudHJ5IG11c3QgYmUgc3BsaWNlZFxuICAgICAqIG91dCBvZiB0aGVtLCBuZXZlciBsZWZ0IGJlaGluZCBhcyBhIG51bGwgaG9sZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0cnVjdHVyYWxSZWZBcnJheXMgPSBbJ19jaGlsZHJlbicsICdfY29tcG9uZW50cycsICduZXN0ZWRQcmVmYWJJbnN0YW5jZVJvb3RzJywgJ3RhcmdldE92ZXJyaWRlcyddO1xuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlcyBgYXBwbHktcHJlZmFiYCBsZWZ0IGJlaGluZCwgdGhlbiBoYW5kIHRoZSByZXN1bHRcbiAgICAgKiB0byB0aGUgZWRpdG9yIGZvciBhY2NlcHRhbmNlICgjMjEpLlxuICAgICAqXG4gICAgICogVGhyZWUgZ2F0ZXMgZ3VhcmQgdGhlIHJld3JpdGUsIGFuZCB0aGUgcHJlLXN1cmdlcnkgYnl0ZXMgYXJlIHJlc3RvcmVkIGF0IGFueSBvZiB0aGVtOlxuICAgICAqIHRoZSBncmFwaCByZXdyaXRlIHJlZnVzZXMgYSBsYXlvdXQgaXQgZG9lcyBub3QgcmVjb2duaXNlLCB0aGUgcmV3cml0dGVuIGdyYXBoIGlzXG4gICAgICogdmFsaWRhdGVkIGJlZm9yZSBpdCBpcyB3cml0dGVuLCBhbmQgYGFzc2V0LWRiOnJlaW1wb3J0LWFzc2V0YCBpcyB0aGUgZW5naW5lJ3Mgb3duXG4gICAgICogdmVyZGljdCBvbiB0aGUgcmVzdWx0IOKAlCBhbiBpbnRlcm5hbGx5IGNvbnNpc3RlbnQgZ3JhcGggY2FuIHN0aWxsIGJlIG9uZSB0aGUgaW1wb3J0ZXJcbiAgICAgKiByZWplY3RzLCBhbmQgb25seSB0aGUgZWRpdG9yIGNhbiBzYXkgc28uIEEgZGVjbGluZWQgcmVtb3ZhbCBsZWF2ZXMgdGhlIGNhbGxlciBleGFjdGx5XG4gICAgICogd2hlcmUgaXQgc3Rvb2QgYmVmb3JlIHRoaXMgbWV0aG9kIGV4aXN0ZWQ6IGEgaGFyZCBmYWlsdXJlIG5hbWluZyB0aGUgc3RhbGUgZmlsZUlkcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZU9ycGhhbmVkQ2hpbGRyZW5Gcm9tQXNzZXQoXG4gICAgICAgIHByZWZhYlBhdGg6IHN0cmluZyxcbiAgICAgICAgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSxcbiAgICAgICAgcm9vdFV1aWQ6IHN0cmluZyxcbiAgICAgICAgYXNzZXRVdWlkOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBsZXQgb3JpZ2luYWxUZXh0OiBzdHJpbmc7XG4gICAgICAgIGxldCBwcmVmYWJEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBvcmlnaW5hbFRleHQgPSBmcy5yZWFkRmlsZVN5bmMocHJlZmFiUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICBwcmVmYWJEYXRhID0gSlNPTi5wYXJzZShvcmlnaW5hbFRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgdGhlIGFzc2V0IGNvdWxkIG5vdCBiZSByZS1yZWFkICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICd0aGUgYXNzZXQgaXMgbm90IGEgc2VyaWFsaXplZCBlbnRyeSBhcnJheScgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpdmVGaWxlSWRzID0gYXdhaXQgdGhpcy5jb2xsZWN0SW5zdGFuY2VGaWxlSWRzKHJvb3RVdWlkKTtcbiAgICAgICAgY29uc3QgZmlsZUlkc0JlZm9yZSA9IHRoaXMuY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMocHJlZmFiRGF0YSk7XG4gICAgICAgIGNvbnN0IHJld3JpdHRlbiA9IHRoaXMucHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGEsIG9ycGhhbmVkRmlsZUlkcywgbGl2ZUZpbGVJZHMpO1xuICAgICAgICBpZiAoIXJld3JpdHRlbikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGFzc2V0IGdyYXBoIGRvZXMgbm90IG1hdGNoIHRoZSBsYXlvdXQgdGhpcyByZW1vdmFsIHVuZGVyc3RhbmRzJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW52YWxpZCA9IHRoaXMudmFsaWRhdGVQcmVmYWJHcmFwaChyZXdyaXR0ZW4sIG9ycGhhbmVkRmlsZUlkcywgZmlsZUlkc0JlZm9yZSk7XG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGdyYXBoIGZhaWxlZCB2YWxpZGF0aW9uICgke2ludmFsaWR9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHJld3JpdHRlbiwgbnVsbCwgb3JpZ2luYWxUZXh0LmluY2x1ZGVzKCdcXG4nKSA/IDIgOiAwKSwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGFzc2V0IGNvdWxkIG5vdCBiZSB3cml0dGVuICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaW1wb3J0ZWQ6IGJvb2xlYW47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IChhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0VXVpZCkpICE9PSBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW1wb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZVByZWZhYkZpbGUocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3RoZSBlZGl0b3IgcmVqZWN0ZWQgdGhlIHJld3JpdHRlbiBhc3NldCBvbiByZWltcG9ydCcgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1cnZpdm9ycyA9IGF3YWl0IHRoaXMuZmluZE9ycGhhbmVkQ2hpbGRGaWxlSWRzKHJvb3RVdWlkLCBwcmVmYWJQYXRoKTtcbiAgICAgICAgaWYgKHN1cnZpdm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVQcmVmYWJGaWxlKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGByZW1vdmFsIHJhbiBidXQgZmlsZUlkKHMpICR7c3Vydml2b3JzLmpvaW4oJywgJyl9IGFyZSBzdGlsbCBvcnBoYW5lZGAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICAvKiogUHV0IHRoZSBwcmUtc3VyZ2VyeSBieXRlcyBiYWNrLCBzbyBhIGRlY2xpbmVkIHJlbW92YWwgbGVhdmVzIHRoZSBhc3NldCB1bnRvdWNoZWQuICovXG4gICAgcHJpdmF0ZSByZXN0b3JlUHJlZmFiRmlsZShwcmVmYWJQYXRoOiBzdHJpbmcsIG9yaWdpbmFsVGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm90aGluZyBmdXJ0aGVyIHRvIGRvIGhlcmUg4oCUIHRoZSBjYWxsZXIgcmVwb3J0cyB0aGUgZmFpbHVyZSBlaXRoZXIgd2F5LlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJvcCBldmVyeSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlIGZyb20gYSBzZXJpYWxpemVkIHByZWZhYiBhcnJheSBhbmQgcmUtaW5kZXggdGhlIHdob2xlXG4gICAgICogZ3JhcGguIFJldHVybnMgbnVsbCDigJQgY2hhbmdpbmcgbm90aGluZyDigJQgd2hlbmV2ZXIgdGhlIGdyYXBoIGRvZXMgbm90IG1hdGNoIHdoYXQgdGhpc1xuICAgICAqIHJld3JpdGUgcmVsaWVzIG9uLCByYXRoZXIgdGhhbiBwcm9kdWNpbmcgYW4gYXNzZXQgbm9ib2R5IGNhbiBsb2FkLlxuICAgICAqL1xuICAgIHByaXZhdGUgcHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGE6IGFueVtdLCBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdLCBsaXZlRmlsZUlkczogU2V0PHN0cmluZz4pOiBhbnlbXSB8IG51bGwge1xuICAgICAgICBjb25zdCBub2RlSW5kZXhCeUZpbGVJZCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCAmJiAhbm9kZUluZGV4QnlGaWxlSWQuaGFzKGZpbGVJZCkpIG5vZGVJbmRleEJ5RmlsZUlkLnNldChmaWxlSWQsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlbW92ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgY29uc3QgcGVuZGluZzogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2Ygb3JwaGFuZWRGaWxlSWRzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IG5vZGVJbmRleEJ5RmlsZUlkLmdldChmaWxlSWQpO1xuICAgICAgICAgICAgLy8gRGV0ZWN0aW9uIGFuZCByZW1vdmFsIGRpc2FncmVlIGFib3V0IHRoZSBhc3NldCDigJQgZG8gbm90IGd1ZXNzIGF0IHRoZSBncmFwaC5cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHBlbmRpbmcucHVzaChpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAocGVuZGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5kZXggPSBwZW5kaW5nLnNoaWZ0KCkgYXMgbnVtYmVyO1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKG5vZGVJbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHByZWZhYkRhdGFbbm9kZUluZGV4XTtcbiAgICAgICAgICAgIGlmICghbm9kZSB8fCBub2RlLl9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmVtb3ZlZC5hZGQobm9kZUluZGV4KTtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gbm9kZS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICBpZiAodHlwZW9mIHByZWZhYkluZm9JbmRleCA9PT0gJ251bWJlcicpIHJlbW92ZWQuYWRkKHByZWZhYkluZm9JbmRleCk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkobm9kZS5fY29tcG9uZW50cykgPyBub2RlLl9jb21wb25lbnRzIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50SW5kZXggIT09ICdudW1iZXInKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICByZW1vdmVkLmFkZChjb21wb25lbnRJbmRleCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZGV4ID0gcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0/Ll9fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wUHJlZmFiSW5kZXggPT09ICdudW1iZXInKSByZW1vdmVkLmFkZChjb21wUHJlZmFiSW5kZXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiBBcnJheS5pc0FycmF5KG5vZGUuX2NoaWxkcmVuKSA/IG5vZGUuX2NoaWxkcmVuIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgLy8gQSBkZXNjZW5kYW50IG9mIGEgZGVsZXRlZCBjaGlsZCBjYW5ub3Qgc3RpbGwgYmUgbGl2ZSBpbiB0aGUgaW5zdGFuY2UuIElmIG9uZVxuICAgICAgICAgICAgICAgIC8vIGlzLCB0aGUgb3JwaGFuIHNldCBpcyBub3Qgd2hhdCB0aGlzIHJld3JpdGUgYXNzdW1lcyBhbmQgaXQgbXVzdCBub3QgcHJvY2VlZC5cbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEZpbGVJZCA9IHRoaXMuZmlsZUlkT2ZOb2RlKHByZWZhYkRhdGEsIGNoaWxkSW5kZXgpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZEZpbGVJZCAhPT0gbnVsbCAmJiBsaXZlRmlsZUlkcy5oYXMoY2hpbGRGaWxlSWQpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICBwZW5kaW5nLnB1c2goY2hpbGRJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlbW92ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJ1bmVkOiBhbnlbXSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSkpO1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJ1bmVkLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKGluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHBydW5lZFtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgdGhpcy5zdHJ1Y3R1cmFsUmVmQXJyYXlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGVudHJ5W2tleV0pKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBlbnRyeVtrZXldID0gZW50cnlba2V5XS5maWx0ZXIoKGVsZW1lbnQ6IGFueSkgPT4gIXRoaXMucmVmZXJlbmNlc1JlbW92ZWQoZWxlbWVudCwgcmVtb3ZlZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2hhdGV2ZXIgc3RpbGwgcG9pbnRzIGF0IGEgcmVtb3ZlZCBlbnRyeSBiZWNvbWVzIG51bGwg4oCUIHRoaXMgaXMgdGhlIGRhbmdsaW5nXG4gICAgICAgIC8vIGNvbXBvbmVudCByZWZlcmVuY2UgdGhlIHJlcG9ydCBjYWxscyBvdXQgKGFuIGBPYmplY3RWaWV3LnRpY2tOb2RlYCBiaW5kaW5nIHRvIGFcbiAgICAgICAgLy8gY2hpbGQgdGhhdCBubyBsb25nZXIgZXhpc3RzKS5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHBydW5lZC5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkLmhhcyhpbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcHJ1bmVkW2luZGV4XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKHBydW5lZFtpbmRleF0sIHJlbW92ZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtYXAgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuICAgICAgICBjb25zdCBzdXJ2aXZvcnM6IGFueVtdID0gW107XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcnVuZWQubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMoaW5kZXgpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHJlbWFwLnNldChpbmRleCwgc3Vydml2b3JzLmxlbmd0aCk7XG4gICAgICAgICAgICBzdXJ2aXZvcnMucHVzaChwcnVuZWRbaW5kZXhdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3Vydml2b3JzLm1hcChlbnRyeSA9PiB0aGlzLnJlbWFwUmVmcyhlbnRyeSwgcmVtYXApKTtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGB2YWx1ZWAgaXMg4oCUIG9yIGNvbnRhaW5zIOKAlCBhbiBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeS4gKi9cbiAgICBwcml2YXRlIHJlZmVyZW5jZXNSZW1vdmVkKHZhbHVlOiBhbnksIHJlbW92ZWQ6IFNldDxudW1iZXI+KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh2YWx1ZSkuc29tZShuZXN0ZWQgPT4gdGhpcy5yZWZlcmVuY2VzUmVtb3ZlZChuZXN0ZWQsIHJlbW92ZWQpKTtcbiAgICB9XG5cbiAgICAvKiogUmVwbGFjZSBldmVyeSBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeSB3aXRoIG51bGwuICovXG4gICAgcHJpdmF0ZSBudWxsaWZ5UmVtb3ZlZFJlZnModmFsdWU6IGFueSwgcmVtb3ZlZDogU2V0PG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLm51bGxpZnlSZW1vdmVkUmVmcyhlbGVtZW50LCByZW1vdmVkKSk7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHZhbHVlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICBjb25zdCByZXdyaXR0ZW46IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIG5lc3RlZF0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSByZXdyaXR0ZW5ba2V5XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKG5lc3RlZCwgcmVtb3ZlZCk7XG4gICAgICAgIHJldHVybiByZXdyaXR0ZW47XG4gICAgfVxuXG4gICAgLyoqIFBvaW50IGV2ZXJ5IHN1cnZpdmluZyBgX19pZF9fYCBhdCBpdHMgZW50cnkncyBzbG90IGluIHRoZSBjb21wYWN0ZWQgYXJyYXkuICovXG4gICAgcHJpdmF0ZSByZW1hcFJlZnModmFsdWU6IGFueSwgcmVtYXA6IE1hcDxudW1iZXIsIG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLnJlbWFwUmVmcyhlbGVtZW50LCByZW1hcCkpO1xuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiB2YWx1ZTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5fX2lkX18gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gcmVtYXAuZ2V0KHZhbHVlLl9faWRfXyk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHsgX19pZF9fOiBuZXh0IH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmV3cml0dGVuOiBhbnkgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBuZXN0ZWRdIG9mIE9iamVjdC5lbnRyaWVzKHZhbHVlKSkgcmV3cml0dGVuW2tleV0gPSB0aGlzLnJlbWFwUmVmcyhuZXN0ZWQsIHJlbWFwKTtcbiAgICAgICAgcmV0dXJuIHJld3JpdHRlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWplY3QgYSByZXdyaXR0ZW4gZ3JhcGggYmVmb3JlIGl0IHJlYWNoZXMgZGlzay4gUmV0dXJucyB0aGUgZmlyc3QgcHJvYmxlbSBmb3VuZCwgb3JcbiAgICAgKiBudWxsIHdoZW4gdGhlIGdyYXBoIGlzIHNvdW5kIOKAlCB0aGlzIGlzIHdoYXQgbWFrZXMgYSBtaXMtaW5kZXhlZCBhc3NldCBpbXBvc3NpYmxlIHRvXG4gICAgICogd3JpdGUgcmF0aGVyIHRoYW4gc29tZXRoaW5nIHRvIG5vdGljZSBhZnRlcndhcmRzLlxuICAgICAqL1xuICAgIHByaXZhdGUgdmFsaWRhdGVQcmVmYWJHcmFwaChwcmVmYWJEYXRhOiBhbnlbXSwgcmVtb3ZlZEZpbGVJZHM6IHN0cmluZ1tdLCBmaWxlSWRzQmVmb3JlOiBTZXQ8c3RyaW5nPik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBkYW5nbGluZyA9IHRoaXMuZmluZERhbmdsaW5nUmVmKHByZWZhYkRhdGEsIHByZWZhYkRhdGEubGVuZ3RoKTtcbiAgICAgICAgaWYgKGRhbmdsaW5nICE9PSBudWxsKSByZXR1cm4gYF9faWRfXyAke2RhbmdsaW5nfSBpcyBvdXQgb2YgcmFuZ2VgO1xuXG4gICAgICAgIC8vIElkZW50aXR5LCBub3QgY291bnQ6IGV4YWN0bHkgdGhlIG9ycGhhbnMgZ28sIGFuZCBub3RoaW5nIGVsc2UgZG9lcy5cbiAgICAgICAgY29uc3QgcmVtYWluaW5nID0gdGhpcy5jb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhwcmVmYWJEYXRhKTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2YgcmVtb3ZlZEZpbGVJZHMpIHtcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmcuaGFzKGZpbGVJZCkpIHJldHVybiBgb3JwaGFuZWQgZmlsZUlkICR7ZmlsZUlkfSBzdXJ2aXZlZCByZW1vdmFsYDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiBmaWxlSWRzQmVmb3JlKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZEZpbGVJZHMuaW5jbHVkZXMoZmlsZUlkKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXMoZmlsZUlkKSkgcmV0dXJuIGBmaWxlSWQgJHtmaWxlSWR9IHdhcyByZW1vdmVkIGJ1dCBzaG91bGQgaGF2ZSBiZWVuIGtlcHRgO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NoaWxkcmVuKSA/IGVudHJ5Ll9jaGlsZHJlbiA6IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NoaWxkcmVuIGVudHJ5YDtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHByZWZhYkRhdGFbY2hpbGRJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZCB8fCBjaGlsZC5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBub24tbm9kZSBjaGlsZCBhdCAke2NoaWxkSW5kZXh9YDtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQuX3BhcmVudCAmJiBjaGlsZC5fcGFyZW50Ll9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBub2RlICR7Y2hpbGRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBwYXJlbnQgJHtpbmRleH1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpID8gZW50cnkuX2NvbXBvbmVudHMgOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NvbXBvbmVudHMgZW50cnlgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50KSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBtaXNzaW5nIGNvbXBvbmVudCBhdCAke2NvbXBvbmVudEluZGV4fWA7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5ub2RlICYmIGNvbXBvbmVudC5ub2RlLl9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBjb21wb25lbnQgJHtjb21wb25lbnRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBub2RlICR7aW5kZXh9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqIFRoZSBmaXJzdCBgX19pZF9fYCBvdXRzaWRlIGBbMCwgbGVuZ3RoKWAgYW55d2hlcmUgaW4gdGhlIGdyYXBoLCBvciBudWxsIHdoZW4gYWxsIHJlc29sdmUuICovXG4gICAgcHJpdmF0ZSBmaW5kRGFuZ2xpbmdSZWYodmFsdWU6IGFueSwgbGVuZ3RoOiBudW1iZXIpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZERhbmdsaW5nUmVmKGVsZW1lbnQsIGxlbmd0aCk7XG4gICAgICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdmFsdWUuX19pZF9fO1xuICAgICAgICAgICAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIoaWQpICYmIGlkID49IDAgJiYgaWQgPCBsZW5ndGggPyBudWxsIDogaWQ7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBuZXN0ZWQgb2YgT2JqZWN0LnZhbHVlcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYobmVzdGVkLCBsZW5ndGgpO1xuICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIGBxdWVyeS1hc3NldC1tZXRhYCBjYXJyaWVzIG5vIGB1cmxgL2BuYW1lYC90aW1lc3RhbXBzIOKAlCByZWFkaW5nIHRoZW0gb2ZmIHRoZVxuICAgICAgICAvLyBtZXRhIHJlY29yZCBwcm9kdWNlZCBhbiBhbGwtZW1wdHkgUHJlZmFiSW5mbyB0aGF0IHN0aWxsIHJlcG9ydGVkIHN1Y2Nlc3MgKCMyNSkuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHV1aWQpO1xuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogcmVzb2x2ZWQuZXJyb3IgfTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5pbmZvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcmVmYWIgbm90IGZvdW5kOiAke3V1aWR9YCB9O1xuXG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IHJlc29sdmVkLmluZm87XG4gICAgICAgIGNvbnN0IHVybDogc3RyaW5nID0gYXNzZXRJbmZvLnVybCB8fCAnJztcbiAgICAgICAgY29uc3Qgc3RhdHMgPSByZXNvbHZlZC5maWxlUGF0aCA/IHRoaXMuc3RhdFRpbWVzKHJlc29sdmVkLmZpbGVQYXRoKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGluZm86IFByZWZhYkluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBhc3NldEluZm8ubmFtZSxcbiAgICAgICAgICAgIHV1aWQ6IGFzc2V0SW5mby51dWlkIHx8IHV1aWQsXG4gICAgICAgICAgICBwYXRoOiB1cmwsXG4gICAgICAgICAgICBmb2xkZXI6IHVybCA/IHVybC5zdWJzdHJpbmcoMCwgdXJsLmxhc3RJbmRleE9mKCcvJykpIDogJycsXG4gICAgICAgICAgICBjcmVhdGVUaW1lOiBzdGF0cz8uY3JlYXRlVGltZSxcbiAgICAgICAgICAgIG1vZGlmeVRpbWU6IHN0YXRzPy5tb2RpZnlUaW1lXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgLi4uaW5mbywgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGggfSB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdFRpbWVzKGZpbGVQYXRoOiBzdHJpbmcpOiB7IGNyZWF0ZVRpbWU6IHN0cmluZzsgbW9kaWZ5VGltZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBjcmVhdGVUaW1lOiBzLmJpcnRodGltZS50b0lTT1N0cmluZygpLCBtb2RpZnlUaW1lOiBzLm10aW1lLnRvSVNPU3RyaW5nKCkgfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gRWFjaCBzdGFnZSByZXBvcnRzIGl0c2VsZi4gVGhlIG9sZCBzaW5nbGUgb3V0ZXIgY2F0Y2ggY29sbGFwc2VkIGV2ZXJ5IGZhaWx1cmVcbiAgICAgICAgLy8gaW50byBgRXJyb3IgdmFsaWRhdGluZyBwcmVmYWI6IEVycm9yOiBwYXJhbWV0ZXIgZXJyb3JgLCB3aGljaCBoaWQgdGhhdCB0aGVcbiAgICAgICAgLy8gcmVqZWN0ZWQgY2FsbCB3YXMgYHF1ZXJ5LXBhdGgoJycpYCDigJQgYHF1ZXJ5LWFzc2V0LW1ldGFgIG5ldmVyIHJldHVybnMgYSBgdXJsYFxuICAgICAgICAvLyB0byByZXNvbHZlLCBzbyB0aGUgcGF0aCBsb29rdXAgd2FzIGFsd2F5cyBoYW5kZWQgYW4gZW1wdHkgc3RyaW5nICgjMjUpLlxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc29sdmVkLmVycm9yKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciB2YWxpZGF0aW5nIHByZWZhYjogJHtyZXNvbHZlZC5lcnJvcn1gIH07XG4gICAgICAgIGlmICghcmVzb2x2ZWQuZmlsZVBhdGgpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NvdWxkIG5vdCByZXNvbHZlIHByZWZhYiBmaWxlIHBhdGggb24gZGlzaycgfTtcblxuICAgICAgICBsZXQgY29udGVudDogc3RyaW5nO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZWFkIHByZWZhYiBmaWxlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZWZhYkRhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByZWZhYkRhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ByZWZhYiBmaWxlIGZvcm1hdCBlcnJvcjogY2Fubm90IHBhcnNlIEpTT04nIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2YWxpZGF0aW9uUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UudmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHZhbGlkYXRpb25SZXN1bHQuaXNWYWxpZCwgaXNzdWVzOiB2YWxpZGF0aW9uUmVzdWx0Lmlzc3VlcyxcbiAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHZhbGlkYXRpb25SZXN1bHQubm9kZUNvdW50LCBjb21wb25lbnRDb3VudDogdmFsaWRhdGlvblJlc3VsdC5jb21wb25lbnRDb3VudCxcbiAgICAgICAgICAgICAgICAvLyBOYW1lZCBleHBsaWNpdGx5IHNvIGEgY2FsbGVyIGNhbiB0ZWxsIFwibm90aGluZyB3cm9uZ1wiIGZyb20gXCJub3RoaW5nIHRoZXJlXCI6XG4gICAgICAgICAgICAgICAgLy8gaXNzdWUgIzczJ3MgaG9sbG93IHByZWZhYiBwYXNzZWQgdGhpcyBhY3Rpb24gd2l0aCBgaXNWYWxpZDogdHJ1ZWAuXG4gICAgICAgICAgICAgICAgaG9sbG93Q29tcG9uZW50czogdmFsaWRhdGlvblJlc3VsdC5ob2xsb3dDb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIC8vIElzc3VlICMxMTQgZGVmZWN0IDI6IGFuIGFjY2Vzc29yIGtleSBiZXNpZGUgaXRzIHVuZGVyc2NvcmUgdHdpbiBpcyBhIHByZWZhYlxuICAgICAgICAgICAgICAgIC8vIHRoZSBhc3NldCBpbXBvcnRlciByZWplY3RzLCBhbmQgYGlzVmFsaWQ6IHRydWVgIG9uIHRoYXQgZmlsZSBpcyB0aGUgZmFsc2VcbiAgICAgICAgICAgICAgICAvLyBncmVlbiB0aGlzIGFjdGlvbiBleGlzdGVkIHRvIHByZXZlbnQuXG4gICAgICAgICAgICAgICAgZHVwbGljYXRlQWNjZXNzb3JLZXlzOiB2YWxpZGF0aW9uUmVzdWx0LmR1cGxpY2F0ZUFjY2Vzc29yS2V5cyxcbiAgICAgICAgICAgICAgICB1cmw6IHJlc29sdmVkLnVybCwgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkID8gJ1ByZWZhYiBmb3JtYXQgaXMgdmFsaWQnIDogJ1ByZWZhYiBmb3JtYXQgaGFzIGlzc3VlcydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGR1cGxpY2F0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHV1aWQ6IHN0cmluZzsgbmV3TmFtZT86IHN0cmluZzsgdGFyZ2V0RGlyPzogc3RyaW5nIH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBQcmVmYWIgZHVwbGljYXRpb24gcmVxdWlyZXMgY29tcGxleCBzZXJpYWxpemF0aW9uIOKAlCBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdQcmVmYWIgZHVwbGljYXRpb24gaXMgbm90IGF2YWlsYWJsZSBwcm9ncmFtbWF0aWNhbGx5JyxcbiAgICAgICAgICAgIGluc3RydWN0aW9uOiAnVG8gZHVwbGljYXRlIGEgcHJlZmFiLCB1c2UgdGhlIENvY29zIENyZWF0b3IgZWRpdG9yOlxcbjEuIFNlbGVjdCB0aGUgcHJlZmFiIGluIHRoZSBBc3NldCBCcm93c2VyXFxuMi4gUmlnaHQtY2xpY2sgYW5kIHNlbGVjdCBDb3B5XFxuMy4gUGFzdGUgaW4gdGhlIHRhcmdldCBsb2NhdGlvbidcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIChhLmsuYS4gcmV2ZXJ0KSBhIHByZWZhYiBpbnN0YW5jZSB0byBpdHMgYXNzZXQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBCYWNrcyBib3RoIGBhY3Rpb249cmVzdG9yZWAgYW5kIGBhY3Rpb249cmV2ZXJ0YC4gQ29jb3MgQ3JlYXRvciAzLjguNyBleHBvc2VzXG4gICAgICogbm8gYHNjZW5lOnJldmVydC1wcmVmYWJgIG1lc3NhZ2UgYXQgYWxsIOKAlCBgcmVzdG9yZS1wcmVmYWJgIGlzIHdoYXQgdGhlIGVkaXRvclxuICAgICAqIGl0c2VsZiB1c2VzIGZvciB0aGUgaW5zcGVjdG9yJ3MgUmV2ZXJ0IGJ1dHRvbiAoIzEzKS4gSXQgdGFrZXMgcG9zaXRpb25hbFxuICAgICAqIGAocm9vdFV1aWQsIGFzc2V0VXVpZClgLCByZXR1cm5zIGEgYm9vbGVhbiwgYW5kIHJlY29yZHMgaXRzIG93biB1bmRvIGVudHJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQ6IHN0cmluZywgYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnbm9kZVV1aWQgaXMgcmVxdWlyZWQnIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHJvb3RVdWlkID0gY29udGV4dC5yb290VXVpZDtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkQXNzZXRVdWlkID0gYXNzZXRVdWlkIHx8IGNvbnRleHQuYXNzZXRVdWlkO1xuICAgICAgICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvdWxkIG5vdCByZXNvbHZlIHRoZSBwcmVmYWIgYXNzZXQgZm9yIG5vZGUgJHtub2RlVXVpZH0uIFBhc3MgYXNzZXRVdWlkIGV4cGxpY2l0bHkuYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXN0b3JlZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgcm9vdFV1aWQsIHJlc29sdmVkQXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGlmIChyZXN0b3JlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgcmVzdG9yZS1wcmVmYWIgZm9yIG5vZGUgJHtyb290VXVpZH0uIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgaW5zdGFuY2UgcmVzdG9yZWQgZnJvbSBhc3NldCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcmVzdG9yZSBwcmVmYWIgbm9kZTogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==