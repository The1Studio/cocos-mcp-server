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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdXNCQUF1c0IsQ0FBQztRQUN0dEIsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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O2lCQUM3RCxDQUFDO1lBQ04sQ0FBQztZQUNELE9BQU87Z0JBQ0gsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUU7Z0JBQzFELE9BQU8sRUFBRSxrREFBa0Q7YUFDOUQsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxrQ0FBa0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7UUFDeEYsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQXBoQ0Qsb0NBb2hDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0LCBQcmVmYWJJbmZvIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgbm9ybWFsaXplVmVjMyB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5pbXBvcnQgeyByZXNvbHZlQXNzZXQgfSBmcm9tICcuLi91dGlscy9hc3NldC1wYXRoJztcbmltcG9ydCB7IFByZWZhYkNyZWF0aW9uU2VydmljZSB9IGZyb20gJy4vbWFuYWdlLXByZWZhYi1jcmVhdGlvbi1zZXJ2aWNlJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVByZWZhYiBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICBwcml2YXRlIHJlYWRvbmx5IGNyZWF0aW9uU2VydmljZSA9IG5ldyBQcmVmYWJDcmVhdGlvblNlcnZpY2UoKTtcblxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3ByZWZhYic7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByZWZhYnMgaW4gdGhlIHByb2plY3QuIEFjdGlvbnM6IGxpc3Q9bGlzdCBhbGwgcHJlZmFicywgbG9hZD1sb2FkIHByZWZhYiBieSBwYXRoLCBpbnN0YW50aWF0ZT1pbnN0YW50aWF0ZSBwcmVmYWIgaW4gc2NlbmUsIGNyZWF0ZT1jcmVhdGUgcHJlZmFiIGZyb20gbm9kZSwgdXBkYXRlPWFwcGx5IG5vZGUgY2hhbmdlcyB0byB0aGUgcHJlZmFiIGFzc2V0ICh2ZXJpZmllcyB0aGUgYXNzZXQgd2FzIHdyaXR0ZW4sIGFuZCByZW1vdmVzIGNoaWxkcmVuIGRlbGV0ZWQgZnJvbSB0aGUgaW5zdGFuY2UgdGhhdCBhcHBseS1wcmVmYWIgbGVhdmVzIGJlaGluZCksIHJldmVydD1yZXZlcnQgcHJlZmFiIGluc3RhbmNlIHRvIHRoZSBhc3NldCBzdGF0ZSAoYWxpYXMgb2YgcmVzdG9yZSksIGdldF9pbmZvPWdldCBwcmVmYWIgZGV0YWlscywgdmFsaWRhdGU9dmFsaWRhdGUgcHJlZmFiIGZpbGUgZm9ybWF0LCBkdXBsaWNhdGU9ZHVwbGljYXRlIGEgcHJlZmFiLCByZXN0b3JlPXJlc3RvcmUgcHJlZmFiIG5vZGUgdXNpbmcgYXNzZXQgKHdpdGggdW5kbykuIEZvciB1cGRhdGUvcmV2ZXJ0L3Jlc3RvcmUsIG5vZGVVdWlkIG1heSBiZSBhbnkgbm9kZSBpbiB0aGUgaW5zdGFuY2Ug4oCUIHRoZSBpbnN0YW5jZSByb290IGlzIHJlc29sdmVkIGF1dG9tYXRpY2FsbHkuIFByZXJlcXVpc2l0ZXM6IHByb2plY3QgbXVzdCBiZSBvcGVuIGluIENvY29zIENyZWF0b3IuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydsaXN0JywgJ2xvYWQnLCAnaW5zdGFudGlhdGUnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdyZXZlcnQnLCAnZ2V0X2luZm8nLCAndmFsaWRhdGUnLCAnZHVwbGljYXRlJywgJ3Jlc3RvcmUnXTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydsaXN0JywgJ2xvYWQnLCAnaW5zdGFudGlhdGUnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdyZXZlcnQnLCAnZ2V0X2luZm8nLCAndmFsaWRhdGUnLCAnZHVwbGljYXRlJywgJ3Jlc3RvcmUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBsaXN0PWxpc3QgYWxsIHByZWZhYnMgaW4gcHJvamVjdCwgbG9hZD1sb2FkIHByZWZhYiBieSB1dWlkLCBpbnN0YW50aWF0ZT1pbnN0YW50aWF0ZSBwcmVmYWIgaW4gc2NlbmUsIGNyZWF0ZT1jcmVhdGUgcHJlZmFiIGZyb20gbm9kZSwgdXBkYXRlPWFwcGx5IG5vZGUgY2hhbmdlcyB0byBleGlzdGluZyBwcmVmYWIsIHJldmVydD1yZXZlcnQgcHJlZmFiIGluc3RhbmNlIHRvIHRoZSBhc3NldCBzdGF0ZSAoYWxpYXMgb2YgcmVzdG9yZSksIGdldF9pbmZvPWdldCBkZXRhaWxlZCBwcmVmYWIgaW5mbywgdmFsaWRhdGU9dmFsaWRhdGUgcHJlZmFiIGZpbGUgZm9ybWF0LCBkdXBsaWNhdGU9ZHVwbGljYXRlIGEgcHJlZmFiLCByZXN0b3JlPXJlc3RvcmUgcHJlZmFiIG5vZGUgdXNpbmcgcHJlZmFiIGFzc2V0IChidWlsdC1pbiB1bmRvKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1dWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCAoZm9yIGxvYWQsIGdldF9pbmZvLCB2YWxpZGF0ZSwgZHVwbGljYXRlLCByZXN0b3JlX25vZGUgYWN0aW9ucyknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJlZmFiVXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKGZvciBpbnN0YW50aWF0ZSBhY3Rpb24pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTY2VuZSBub2RlIFVVSUQgKGZvciBjcmVhdGUsIHVwZGF0ZSwgcmV2ZXJ0LCByZXN0b3JlIGFjdGlvbnMpLiBGb3IgdXBkYXRlL3JldmVydC9yZXN0b3JlIHRoaXMgbWF5IGJlIGFueSBub2RlIGluc2lkZSB0aGUgcHJlZmFiIGluc3RhbmNlOyB0aGUgaW5zdGFuY2Ugcm9vdCBpcyByZXNvbHZlZCBmcm9tIGl0LidcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzYXZlUGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQXNzZXQgREIgcGF0aCB0byBzYXZlIHByZWZhYiAoZm9yIGNyZWF0ZSBhY3Rpb24sIGUuZy4gZGI6Ly9hc3NldHMvcHJlZmFicy9NeVByZWZhYi5wcmVmYWIpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BhcmVudCBub2RlIFVVSUQgZm9yIHRoZSBpbnN0YW50aWF0ZWQgcHJlZmFiIChmb3IgaW5zdGFudGlhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgcG9zaXRpb24ge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb3RhdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCByb3RhdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHNjYWxlIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9sZGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGb2xkZXIgdG8gc2VhcmNoIHByZWZhYnMgaW4gKGZvciBsaXN0IGFjdGlvbiwgZGVmYXVsdDogZGI6Ly9hc3NldHMpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmV3TmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTmV3IHByZWZhYiBuYW1lIChmb3IgZHVwbGljYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRhcmdldERpcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGRpcmVjdG9yeSBmb3IgZHVwbGljYXRlZCBwcmVmYWIgKGZvciBkdXBsaWNhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXNzZXRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCB0byByZXN0b3JlIGZyb20gKGZvciByZXZlcnQgYW5kIHJlc3RvcmUgYWN0aW9ucywgb3B0aW9uYWwg4oCUIHJlc29sdmVkIGZyb20gdGhlIG5vZGUgd2hlbiBvbWl0dGVkKSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxpc3QoYXJncyksXG4gICAgICAgIGxvYWQ6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxvYWQoYXJncyksXG4gICAgICAgIGluc3RhbnRpYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVJbnN0YW50aWF0ZShhcmdzKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVDcmVhdGUoYXJncyksXG4gICAgICAgIHVwZGF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlVXBkYXRlKGFyZ3MpLFxuICAgICAgICByZXZlcnQ6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJldmVydChhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmhhbmRsZUdldEluZm8oYXJncyksXG4gICAgICAgIHZhbGlkYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVWYWxpZGF0ZShhcmdzKSxcbiAgICAgICAgZHVwbGljYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVEdXBsaWNhdGUoYXJncyksXG4gICAgICAgIHJlc3RvcmU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJlc3RvcmVOb2RlKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxpc3QoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdldFByZWZhYkxpc3QoYXJncy5mb2xkZXIpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBsaXN0IHByZWZhYnMnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxvYWQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubG9hZFByZWZhYkJ5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gbG9hZCBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUluc3RhbnRpYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXByZWZhYlV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgncHJlZmFiVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5wb3NpdGlvbik7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnJvdGF0aW9uKTtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBub3JtYWxpemVWZWMzKGFyZ3Muc2NhbGUpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmluc3RhbnRpYXRlUHJlZmFiQnlVdWlkKHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICBjb25zdCBmYWlsdXJlID0gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiJyk7XG4gICAgICAgIGlmIChyZXN1bHQuaW5zdHJ1Y3Rpb24pIGZhaWx1cmUuaW5zdHJ1Y3Rpb24gPSByZXN1bHQuaW5zdHJ1Y3Rpb247XG4gICAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlQ3JlYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgc2F2ZVBhdGggfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgaWYgKCFzYXZlUGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlUGF0aCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBwcmVmYWJOYW1lID0gc2F2ZVBhdGguc3BsaXQoJy8nKS5wb3AoKT8ucmVwbGFjZSgnLnByZWZhYicsICcnKSB8fCAnTmV3UHJlZmFiJztcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVQcmVmYWIoeyBub2RlVXVpZCwgc2F2ZVBhdGgsIHByZWZhYk5hbWUgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVVwZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy51cGRhdGVQcmVmYWIobm9kZVV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byB1cGRhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXZlcnQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBhc3NldFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgLy8gYHJldmVydGAgYW5kIGByZXN0b3JlYCBhcmUgdGhlIHNhbWUgZWRpdG9yIG9wZXJhdGlvbiDigJQgc2VlIHJlc3RvcmVQcmVmYWJOb2RlLlxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byByZXZlcnQgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXRJbmZvKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdldFByZWZhYkluZm9CeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBwcmVmYWIgaW5mbycpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlVmFsaWRhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHZhbGlkYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlRHVwbGljYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkLCBuZXdOYW1lLCB0YXJnZXREaXIgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZHVwbGljYXRlUHJlZmFiQnlVdWlkKHsgdXVpZCwgbmV3TmFtZSwgdGFyZ2V0RGlyIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBkdXBsaWNhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXN0b3JlTm9kZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGFzc2V0VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byByZXN0b3JlIHByZWZhYiBub2RlJyk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUHJpdmF0ZSBpbXBsZW1lbnRhdGlvbiBtZXRob2RzIChwb3J0ZWQgZnJvbSBQcmVmYWJUb29scylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJlZmFiTGlzdChmb2xkZXI6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGZvbGRlci5lbmRzV2l0aCgnLycpID8gYCR7Zm9sZGVyfSoqLyoucHJlZmFiYCA6IGAke2ZvbGRlcn0vKiovKi5wcmVmYWJgO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICBjb25zdCBwcmVmYWJzOiBQcmVmYWJJbmZvW10gPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHBhdGg6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCxcbiAgICAgICAgICAgICAgICBmb2xkZXI6IGFzc2V0LnVybC5zdWJzdHJpbmcoMCwgYXNzZXQudXJsLmxhc3RJbmRleE9mKCcvJykpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBwcmVmYWJzIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIHRoZSBjdXJyZW50IHNjZW5lJ3Mgcm9vdCBub2RlIHV1aWQuXG4gICAgICpcbiAgICAgKiBgc2NlbmU6Y3JlYXRlLW5vZGVgJ3Mgb3duIGRlZmF1bHQtcGFyZW50IGhldXJpc3RpYyBpcyBOT1QgdGhlIHNjZW5lIHJvb3Qg4oCUIG9ic2VydmVkXG4gICAgICogbGl2ZSBpdCBwYXJlbnRzIGEgbmV3IG5vZGUgdW5kZXIgd2hhdGV2ZXIgd2FzIGNyZWF0ZWQgb3Igc2VsZWN0ZWQgbGFzdCwgd2hpY2ggaXMgaG93XG4gICAgICogdGhyZWUgYmFjay10by1iYWNrIGBpbnN0YW50aWF0ZWAgY2FsbHMgd2l0aCBubyBgcGFyZW50VXVpZGAgZW5kZWQgdXAgbmVzdGVkIGluc2lkZVxuICAgICAqIG9uZSBhbm90aGVyIGluc3RlYWQgb2YgYXMgc2NlbmUtcm9vdCBzaWJsaW5ncyAoIzEyMCBpdGVtIDEpLiBSZXNvbHZpbmcgdGhlIHJvb3RcbiAgICAgKiBleHBsaWNpdGx5IGFuZCBwYXNzaW5nIGl0IG1ha2VzIHRoZSBwbGFjZW1lbnQgZGV0ZXJtaW5pc3RpYy5cbiAgICAgKlxuICAgICAqIGBxdWVyeS1ub2RlLXRyZWVgIHdpdGggbm8gYXJndW1lbnQgcmV0dXJucyB0aGUgc2NlbmUncyBub2RlIHRyZWU7IGl0cyByb290IGVudHJ5IG1heVxuICAgICAqIGJlIHRoZSBzY2VuZSBub2RlIGl0c2VsZiBvciBhbiBhcnJheSBvZiB0b3AtbGV2ZWwgbm9kZXMgZGVwZW5kaW5nIG9uIHRoZSBidWlsZCwgc29cbiAgICAgKiBib3RoIHNoYXBlcyBhcmUgYWNjZXB0ZWQuIFJldHVybnMgbnVsbCB3aGVuIHRoZSB0cmVlIGNhbm5vdCBiZSByZWFkIOKAlCB0aGUgY2FsbGVyIHRoZW5cbiAgICAgKiBsZWF2ZXMgYHBhcmVudGAgdW5zZXQgcmF0aGVyIHRoYW4gZ3Vlc3NpbmcsIHNvIGEgZmFpbGVkIGxvb2t1cCBkZWdyYWRlcyB0byB0aGUgb2xkXG4gICAgICogYmVoYXZpb3VyIGluc3RlYWQgb2YgcGFyZW50aW5nIHVuZGVyIHNvbWV0aGluZyBhcmJpdHJhcnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlU2NlbmVSb290VXVpZCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodHJlZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJlZS5sZW5ndGggPiAwID8gKHRyZWVbMF0udXVpZCB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJlZT8udXVpZCB8fCBudWxsO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW50ZXIgcHJlZmFiLWVkaXQgbW9kZSBmb3IgYSBwcmVmYWIgYXNzZXQuXG4gICAgICpcbiAgICAgKiBUaGUgcHJldmlvdXMgaW1wbGVtZW50YXRpb24gY2FsbGVkIGBzY2VuZTpsb2FkLWFzc2V0YCwgYSBtZXNzYWdlIHRoYXQgZG9lcyBub3QgZXhpc3RcbiAgICAgKiBpbiBDb2NvcyBDcmVhdG9yIDMuOC43IOKAlCBldmVyeSBjYWxsIHJlamVjdGVkIHdpdGggYE1lc3NhZ2UgZG9lcyBub3QgZXhpc3Q6IHNjZW5lIC1cbiAgICAgKiBsb2FkLWFzc2V0YCwgc28gYGxvYWRgIGNvdWxkIG5ldmVyIHN1Y2NlZWQgYW5kIHRoZSBwcmVmYWItZWRpdCBwYXRoIHRocm91Z2ggdGhpcyB0b29sXG4gICAgICogd2FzIHVucmVhY2hhYmxlICgjMTIwIGl0ZW0gMykuXG4gICAgICpcbiAgICAgKiBUaGVyZSBpcyBubyBgc2NlbmU6YCBtZXNzYWdlIHRoYXQgZW50ZXJzIHByZWZhYi1lZGl0IG1vZGU7IHRoZSBlZGl0b3Igb3BlbnMgdGhlIGFzc2V0XG4gICAgICogaXRzZWxmLiBUaGUgcGF0aCB0aGF0IHdvcmtzIGlzIGBhc3NldC1kYjpxdWVyeS1hc3NldC1pbmZvYCB0byBjb25maXJtIHRoZSB1dWlkIG5hbWVzIGFcbiAgICAgKiBwcmVmYWIsIHRoZW4gYGFzc2V0LWRiOm9wZW4tYXNzZXRgIChhIGRlY2xhcmVkIG1lc3NhZ2UsIGBhc3NldC1kYi9AdHlwZXMvbWVzc2FnZS5kLnRzYClcbiAgICAgKiB0byBoYW5kIHRoZSBhc3NldCB0byB0aGUgZWRpdG9yJ3Mgb3duIGFzc2V0LW9wZW5lciwgd2hpY2ggaXMgd2hhdCB0aGUgQXNzZXQgQnJvd3NlclxuICAgICAqIGRvdWJsZS1jbGljayBkb2VzLiBUaGUgdXVpZCBpcyByZXNvbHZlZCB0byBpdHMgYHVybGAgZmlyc3QgYmVjYXVzZSBgb3Blbi1hc3NldGAgaXNcbiAgICAgKiBkb2N1bWVudGVkIHRvIHRha2UgYSB1cmwuXG4gICAgICpcbiAgICAgKiBDb25maXJtZWQgdG8gYSBsZXZlbCB0aGlzIHJlcG8gY2FuIHJlYWNoOiB0aGUgbWVzc2FnZSBleGlzdHMgaW4gdGhlIGVkaXRvcidzIG93blxuICAgICAqIGRlY2xhcmF0aW9ucyBhbmQgdGhlIHJlc29sdmUtdGhlbi1vcGVuIHNlcXVlbmNlIGlzIHdoYXQgdGhlIGVkaXRvciBVSSBwZXJmb3Jtcy4gVGhlXG4gICAgICogYmVoYXZpb3VyYWwgaGFsZiDigJQgdGhhdCB0aGUgZWRpdG9yIGxhbmRzIGluIHByZWZhYi1lZGl0IG1vZGUg4oCUIGlzIGFzc2VydGVkIHRvIGJlXG4gICAgICogdW52ZXJpZmlhYmxlIHdpdGhvdXQgYSBsaXZlIGVkaXRvciwgYW5kIGlzIGNhbGxlZCBvdXQgYXMgc3VjaCBvbiB0aGUgaXNzdWUgcmF0aGVyXG4gICAgICogdGhhbiBjbGFpbWVkIGhlcmUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBsb2FkUHJlZmFiQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHV1aWQpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB1dWlkICcke3V1aWR9JyBub3QgZm91bmQgaW4gdGhlIGFzc2V0IERCYCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1ZlcmlmeSB0aGUgdXVpZCwgYW5kIHJlZnJlc2ggdGhlIGFzc2V0IERCIChtYW5hZ2VfYXNzZXQgYWN0aW9uPXJlZnJlc2gpIGlmIHRoZSAucHJlZmFiIGZpbGUgd2FzIHdyaXR0ZW4gb3V0c2lkZSB0aGUgZWRpdG9yLidcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBgdHlwZWAgaXMgdGhlIGltcG9ydGVyIHR5cGUg4oCUICdwcmVmYWInIGZvciBhIC5wcmVmYWIgYXNzZXQuIFJlZnVzZSBhIG5vbi1wcmVmYWJcbiAgICAgICAgLy8gcmF0aGVyIHRoYW4gb3BlbmluZywgc2F5LCBhIHRleHR1cmUgYW5kIHJlcG9ydGluZyBhIHByZWZhYiB3YXMgbG9hZGVkLlxuICAgICAgICBpZiAoYXNzZXRJbmZvLnR5cGUgJiYgYXNzZXRJbmZvLnR5cGUgIT09ICdwcmVmYWInKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgQXNzZXQgJyR7YXNzZXRJbmZvLnVybCB8fCB1dWlkfScgaXMgYSAnJHthc3NldEluZm8udHlwZX0nLCBub3QgYSBwcmVmYWJgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnUGFzcyB0aGUgdXVpZCBvZiBhIC5wcmVmYWIgYXNzZXQgKG1hbmFnZV9wcmVmYWIgYWN0aW9uPWxpc3QgcmV0dXJucyB0aGVtKS4nXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gYXNzZXRJbmZvLnVybCB8fCB1dWlkO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnb3Blbi1hc3NldCcsIHRhcmdldCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgQ291bGQgbm90IG9wZW4gcHJlZmFiICcke3RhcmdldH0nOiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBPcGVuICcke3RhcmdldH0nIGluIHRoZSBDb2NvcyBDcmVhdG9yIEFzc2V0IEJyb3dzZXIgKGRvdWJsZS1jbGljayBpdCkgdG8gZWRpdCB0aGUgcHJlZmFiLmBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICB1dWlkOiBhc3NldEluZm8udXVpZCB8fCB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgICAgIHVybDogdGFyZ2V0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgb3BlbmVkIGZvciBlZGl0aW5nJyxcbiAgICAgICAgICAgICAgICAvLyBQcmVmYWItZWRpdCBtb2RlIGlzIGFuIGVkaXRvci1zaWRlIHN0YXRlLiBUaGlzIHRvb2wgY2FuIGNvbmZpcm0gdGhlIG9wZW5cbiAgICAgICAgICAgICAgICAvLyByZXF1ZXN0IHdhcyBhY2NlcHRlZCwgbm90IHRoYXQgdGhlIGVkaXRvciBzd2l0Y2hlZCBtb2Rlcywgc28gdGhlIGNhbGxlciBpc1xuICAgICAgICAgICAgICAgIC8vIHRvbGQgd2hpY2ggaGFsZiB3YXMgdmVyaWZpZWQgcmF0aGVyIHRoYW4gZ2l2ZW4gYSBiYXJlIHN1Y2Nlc3MuXG4gICAgICAgICAgICAgICAgcHJlZmFiRWRpdE1vZGVWZXJpZmllZDogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGluc3RhbnRpYXRlUHJlZmFiQnlVdWlkKGFyZ3M6IHsgcHJlZmFiVXVpZDogc3RyaW5nOyBwYXJlbnRVdWlkPzogc3RyaW5nOyBwb3NpdGlvbj86IGFueTsgcm90YXRpb24/OiBhbnk7IHNjYWxlPzogYW55IH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkLCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlIH0gPSBhcmdzO1xuXG4gICAgICAgICAgICAvLyBBbiB1bnJlc29sdmFibGUgdXVpZCBtdXN0IGJlIGZhdGFsOiBjcmVhdGUtbm9kZSBzaWxlbnRseSByZXR1cm5zIG5vdGhpbmcgZm9yIGl0LFxuICAgICAgICAgICAgLy8gd2hpY2ggcHJldmlvdXNseSBwcm9kdWNlZCBhIHN1Y2Nlc3MgZW52ZWxvcGUgd2l0aCBubyBub2RlVXVpZCAoIzE1KS5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBwcmVmYWJVdWlkKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHV1aWQgJyR7cHJlZmFiVXVpZH0nIG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREJgLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1ZlcmlmeSB0aGUgdXVpZCwgYW5kIHJlZnJlc2ggdGhlIGFzc2V0IERCIChtYW5hZ2VfYXNzZXQgYWN0aW9uPXJlZnJlc2gpIGlmIHRoZSAucHJlZmFiIGZpbGUgd2FzIHdyaXR0ZW4gb3V0c2lkZSB0aGUgZWRpdG9yLidcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOb2RlT3B0aW9uczogYW55ID0ge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogcHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAvLyBgdHlwZWAgc2VsZWN0cyB0aGUgY3JlYXRlTm9kZUZyb21Bc3NldCgpIGJyYW5jaCB0aGF0IGluc3RhbnRpYXRlcyBhXG4gICAgICAgICAgICAgICAgLy8gbGlua2VkIFByZWZhYkluc3RhbmNlLiBXaXRob3V0IGl0LCAzLjguNydzIG5vZGUgbWFuYWdlciBmYWxscyBiYWNrIHRvXG4gICAgICAgICAgICAgICAgLy8gYnVpbGRpbmcgYSBwbGFpbiBub2RlIGZyb20gdGhlIGFzc2V0J3MgcmF3IGR1bXAg4oCUIGEgZmxhdHRlbmVkLFxuICAgICAgICAgICAgICAgIC8vIHVubGlua2VkIGNvcHkgdGhhdCByZXBvcnRzIHN1Y2Nlc3MgYnV0IGNhcnJpZXMgbm8gY2MuUHJlZmFiSW5mbyAoc2VlXG4gICAgICAgICAgICAgICAgLy8gTm9kZU1hbmFnZXIuY3JlYXRlTm9kZUZyb21Bc3NldCBqc2RvYzogXCJvcHRpb25zLnR5cGU6IOi1hOa6kOexu+Wei1wiKS5cbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldEluZm8udHlwZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSBwYXJlbnRVdWlkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBObyBjYWxsZXItc3VwcGxpZWQgcGFyZW50OiBwaW4gdGhlIHBsYWNlbWVudCB0byB0aGUgc2NlbmUgcm9vdC4gTGVhdmluZ1xuICAgICAgICAgICAgICAgIC8vIGBwYXJlbnRgIHVuc2V0IGhhbmRzIHRoZSBkZWNpc2lvbiB0byBgY3JlYXRlLW5vZGVgJ3MgaW1wbGljaXRcbiAgICAgICAgICAgICAgICAvLyBsYXN0LWNyZWF0ZWQvbGFzdC1zZWxlY3RlZCBoZXVyaXN0aWMsIHdoaWNoIG5lc3RzIHVucmVsYXRlZCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICAvLyAoIzEyMCBpdGVtIDEpLiBBIG51bGwgcmVzb2x2ZSBsZWF2ZXMgaXQgdW5zZXQg4oCUIHRoZSBvbGQgYmVoYXZpb3VyIOKAlCByYXRoZXJcbiAgICAgICAgICAgICAgICAvLyB0aGFuIHBhcmVudGluZyB1bmRlciBhIGd1ZXNzLlxuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IGF3YWl0IHRoaXMucmVzb2x2ZVNjZW5lUm9vdFV1aWQoKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NlbmVSb290KSBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSBzY2VuZVJvb3Q7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5uYW1lID0gYXNzZXRJbmZvLm5hbWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIGBwb3NpdGlvbmAgaXMgYSBkb2N1bWVudGVkIHRvcC1sZXZlbCBDcmVhdGVOb2RlT3B0aW9ucyBmaWVsZDsgYGR1bXBgXG4gICAgICAgICAgICAgICAgLy8gaXMgZXhwbGljaXRseSBjb21tZW50ZWQgb3V0IGFzIHVudXNlZCBpbiBAY29jb3MvY3JlYXRvci10eXBlcyDigJQgaXQgd2FzXG4gICAgICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlZCwgc28gaW5zdGFudGlhdGVkIHByZWZhYnMgbmV2ZXIgcGlja2VkIHVwIHRoaXMgcG9zaXRpb24uXG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIGNyZWF0ZU5vZGVPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBBcnJheS5pc0FycmF5KG5vZGVVdWlkKSA/IG5vZGVVdWlkWzBdIDogbm9kZVV1aWQ7XG5cbiAgICAgICAgICAgIC8vIE5ldmVyIHJlcG9ydCBzdWNjZXNzIHdpdGhvdXQgYSBub2RlIGlkIOKAlCB0aGUgY2FsbGVyIHdvdWxkIGJ1aWxkIG9uIGEgc2NlbmVcbiAgICAgICAgICAgIC8vIHRoYXQgc2lsZW50bHkgbGFja3MgdGhlIG5vZGUgKCMxNSkuXG4gICAgICAgICAgICBpZiAoIXV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBjcmVhdGUtbm9kZSByZXR1cm5lZCBubyBub2RlIHV1aWQgZm9yIHByZWZhYiAnJHtwcmVmYWJVdWlkfScg4oCUIG5vdGhpbmcgd2FzIGluc3RhbnRpYXRlZGAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnRW5zdXJlIGEgc2NlbmUgaXMgb3BlbiBhbmQgdGhlIHByZWZhYiBhc3NldCBpcyB2YWxpZCwgdGhlbiByZXRyeS4nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQXBwbHkgcm90YXRpb24gYW5kIHNjYWxlIGlmIHByb3ZpZGVkXG4gICAgICAgICAgICBpZiAocm90YXRpb24pIHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgICAgICAgICAgIHBhdGg6ICdldWxlckFuZ2xlcycsXG4gICAgICAgICAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IHJvdGF0aW9uLCB0eXBlOiAnY2MuVmVjMycgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHsvKiBub24tZmF0YWwgKi99KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzY2FsZSkge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogJ3NjYWxlJyxcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogc2NhbGUsIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gey8qIG5vbi1mYXRhbCAqL30pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBub2RlVXVpZDogdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHJvdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICBzY2FsZSxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZhYiBpbnN0YW50aWF0ZWQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgRmFpbGVkIHRvIGluc3RhbnRpYXRlIHByZWZhYjogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnQ2hlY2sgdGhhdCB0aGUgcHJlZmFiVXVpZCBpcyBjb3JyZWN0IGFuZCB0aGUgYXNzZXQgREIgaXMgcmVhZHkuJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlUHJlZmFiKGFyZ3M6IGFueSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXRoUGFyYW0gPSBhcmdzLnByZWZhYlBhdGggfHwgYXJncy5zYXZlUGF0aDtcbiAgICAgICAgICAgIGlmICghcGF0aFBhcmFtKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTWlzc2luZyBwcmVmYWIgcGF0aCBwYXJhbWV0ZXIuIFByb3ZpZGUgc2F2ZVBhdGguJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJOYW1lID0gYXJncy5wcmVmYWJOYW1lIHx8ICdOZXdQcmVmYWInO1xuICAgICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoUGFyYW0uZW5kc1dpdGgoJy5wcmVmYWInKSA/XG4gICAgICAgICAgICAgICAgcGF0aFBhcmFtIDogYCR7cGF0aFBhcmFtfS8ke3ByZWZhYk5hbWV9LnByZWZhYmA7XG5cbiAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVDaGlsZHJlbiA9IGFyZ3MuaW5jbHVkZUNoaWxkcmVuICE9PSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVDb21wb25lbnRzID0gYXJncy5pbmNsdWRlQ29tcG9uZW50cyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RGJSZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJXaXRoQXNzZXREQihcbiAgICAgICAgICAgICAgICBhcmdzLm5vZGVVdWlkLCBmdWxsUGF0aCwgcHJlZmFiTmFtZSwgaW5jbHVkZUNoaWxkcmVuLCBpbmNsdWRlQ29tcG9uZW50c1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGlmIChhc3NldERiUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhc3NldERiUmVzdWx0O1xuICAgICAgICAgICAgLy8gQSBkZWZlY3RpdmUgd3JpdGUgaXMgYSByZXN1bHQsIG5vdCBhbiB1bmF2YWlsYWJsZSBwYXRoIOKAlCByZXRyeWluZyB0aHJvdWdoXG4gICAgICAgICAgICAvLyB0aGUgZmFsbGJhY2sgY2hhaW4gd291bGQgcmUtc2VyaWFsaXplIHRoZSBzYW1lIGxvc3MgYW5kIG1hc2sgaXQgKCMyOCkuXG4gICAgICAgICAgICBpZiAoYXNzZXREYlJlc3VsdC5mYXRhbCkgcmV0dXJuIGFzc2V0RGJSZXN1bHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IG5hdGl2ZVJlc3VsdCA9IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYk5hdGl2ZVN0dWIoKTtcbiAgICAgICAgICAgIGlmIChuYXRpdmVSZXN1bHQuc3VjY2VzcykgcmV0dXJuIG5hdGl2ZVJlc3VsdDtcblxuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYkN1c3RvbShhcmdzLm5vZGVVdWlkLCBmdWxsUGF0aCwgcHJlZmFiTmFtZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSB0aGUgcHJlZmFiLWluc3RhbmNlIGNvbnRleHQgZm9yIGEgbm9kZS5cbiAgICAgKlxuICAgICAqIENvY29zIENyZWF0b3IgZHJpdmVzIGJvdGggcHJlZmFiIG1lc3NhZ2VzIGZyb20gdGhlIG5vZGUgZHVtcCdzIGBfX3ByZWZhYl9fYFxuICAgICAqIGJsb2NrIOKAlCBgcm9vdFV1aWRgICh0aGUgcHJlZmFiLWluc3RhbmNlIFJPT1QsIG5vdCB3aGljaGV2ZXIgZGVzY2VuZGFudCB0aGVcbiAgICAgKiBjYWxsZXIgaGFwcGVuZWQgdG8gcGFzcykgYW5kIGB1dWlkYCAodGhlIGJhY2tpbmcgcHJlZmFiIGFzc2V0KS4gU2VlIDMuOC43XG4gICAgICogYHJlc291cmNlcy8zZC9lbmdpbmUvZWRpdG9yL2luc3BlY3Rvci9jb250cmlidXRpb25zL25vZGUuanNgOlxuICAgICAqICAgcmVxdWVzdCgnc2NlbmUnLCAnYXBwbHktcHJlZmFiJywgcHJlZmFiLnJvb3RVdWlkKVxuICAgICAqICAgcmVxdWVzdCgnc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCBwcmVmYWIucm9vdFV1aWQsIHByZWZhYi51dWlkKVxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHF1ZXJ5IG5vZGUgJHtub2RlVXVpZH06ICR7ZXJyLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vZGUgbm90IGZvdW5kJyB9O1xuXG4gICAgICAgIGNvbnN0IHByZWZhYiA9IG5vZGVEYXRhLl9fcHJlZmFiX187XG4gICAgICAgIGlmICghcHJlZmFiKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IGlzIG5vdCBwYXJ0IG9mIGEgcHJlZmFiIGluc3RhbmNlYCB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgcm9vdFV1aWQ6IHByZWZhYi5yb290VXVpZCB8fCBub2RlVXVpZCxcbiAgICAgICAgICAgIGFzc2V0VXVpZDogcHJlZmFiLnV1aWQgfHwgcHJlZmFiLnByZWZhYlN0YXRlSW5mbz8uYXNzZXRVdWlkXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSBhIHByZWZhYiBhc3NldCdzIG9uLWRpc2sgcGF0aCwgb3IgbnVsbCB3aGVuIGl0IGNhbm5vdCBiZSBkZXRlcm1pbmVkLlxuICAgICAqXG4gICAgICogR29lcyB0aHJvdWdoIGBxdWVyeS1hc3NldC1pbmZvYCwgbm90IGBxdWVyeS1hc3NldC1tZXRhYDogdGhlIG1ldGEgcmVjb3JkIGhhcyBub1xuICAgICAqIGB1cmxgIGZpZWxkLCBzbyB0aGUgb2xkIGxvb2t1cCByZXNvbHZlZCB0byBudWxsIGZvciBldmVyeSBhc3NldCBhbmQgbGVmdCB0aGVcbiAgICAgKiBwb3N0LWFwcGx5IHdyaXRlIGNoZWNrIHBlcm1hbmVudGx5IGB1bnZlcmlmaWVkYCAoIzI1KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVQcmVmYWJGaWxlUGF0aChhc3NldFV1aWQ/OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgaWYgKCFhc3NldFV1aWQpIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gKGF3YWl0IHJlc29sdmVBc3NldChhc3NldFV1aWQpKS5maWxlUGF0aDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRNdGltZU1zKGZpbGVQYXRoOiBzdHJpbmcgfCBudWxsKTogbnVtYmVyIHwgbnVsbCB7XG4gICAgICAgIGlmICghZmlsZVBhdGgpIHJldHVybiBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGZzLnN0YXRTeW5jKGZpbGVQYXRoKS5tdGltZU1zO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqIFBvbGwgZm9yIHRoZSBwcmVmYWIgZmlsZSB0byBiZSByZXdyaXR0ZW47IGFzc2V0LWRiIG1heSBmbHVzaCBzaG9ydGx5IGFmdGVyIHRoZSBtZXNzYWdlIHJlc29sdmVzLiAqL1xuICAgIHByaXZhdGUgYXN5bmMgd2FpdEZvclByZWZhYldyaXRlKGZpbGVQYXRoOiBzdHJpbmcsIGJhc2VsaW5lTXM6IG51bWJlciwgdGltZW91dE1zID0gMjAwMCk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XG4gICAgICAgIGxldCBtdGltZSA9IHRoaXMuc3RhdE10aW1lTXMoZmlsZVBhdGgpO1xuICAgICAgICB3aGlsZSAobXRpbWUgIT09IG51bGwgJiYgbXRpbWUgPD0gYmFzZWxpbmVNcyAmJiBEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcbiAgICAgICAgICAgIG10aW1lID0gdGhpcy5zdGF0TXRpbWVNcyhmaWxlUGF0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG10aW1lO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlUHJlZmFiKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFjb250ZXh0LnN1Y2Nlc3MpIHJldHVybiBjb250ZXh0O1xuICAgICAgICAgICAgY29uc3QgeyByb290VXVpZCwgYXNzZXRVdWlkIH0gPSBjb250ZXh0O1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJQYXRoID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiRmlsZVBhdGgoYXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IG10aW1lQmVmb3JlID0gdGhpcy5zdGF0TXRpbWVNcyhwcmVmYWJQYXRoKTtcblxuICAgICAgICAgICAgLy8gYHNjZW5lOmFwcGx5LXByZWZhYmAgdGFrZXMgdGhlIGluc3RhbmNlIHJvb3QgdXVpZCBhcyBhIFBPU0lUSU9OQUwgc3RyaW5nXG4gICAgICAgICAgICAvLyBhbmQgcmVzb2x2ZXMgdG8gYSBib29sZWFuLiBUaGUgb2xkIGB7IG5vZGU6IHV1aWQgfWAgb2JqZWN0IGZvcm0gcmVzb2x2ZWRcbiAgICAgICAgICAgIC8vIHdpdGhvdXQgdGhyb3dpbmcgYnV0IG5ldmVyIHdyb3RlIHRoZSBhc3NldCDigJQgYSBzaWxlbnQgbm8tb3AgcmVwb3J0ZWQgYXNcbiAgICAgICAgICAgIC8vIHN1Y2Nlc3MgKCMxMikuXG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAnYXBwbHktcHJlZmFiJywgcm9vdFV1aWQpO1xuXG4gICAgICAgICAgICAvLyBWZXJpZnkgdGhlIGFzc2V0IHdhcyBhY3R1YWxseSB3cml0dGVuIHJhdGhlciB0aGFuIHRydXN0aW5nIHRoZSBib29sZWFuIHRoZVxuICAgICAgICAgICAgLy8gbWVzc2FnZSByZXNvbHZlcyB0byBlaXRoZXIgd2F5LiBgdW52ZXJpZmllZGAgbWVhbnMgdGhlIHBhdGggY291bGQgbm90IGJlXG4gICAgICAgICAgICAvLyByZXNvbHZlZCwgbm90IHRoYXQgdGhlIHdyaXRlIGZhaWxlZC4gVGhpcyBydW5zIGV2ZW4gd2hlbiBgYXBwbGllZCA9PT0gZmFsc2VgOlxuICAgICAgICAgICAgLy8gdGhlIGVkaXRvciBoYXMgYmVlbiBvYnNlcnZlZCByZXNvbHZpbmcgYGZhbHNlYCBvbiBzYXZlcyB0aGF0IERJRCByZXdyaXRlIHRoZVxuICAgICAgICAgICAgLy8gZmlsZSAoIzYzKSDigJQgdHJ1c3RpbmcgdGhhdCBzaWduYWwgYWxvbmUgdHVybnMgYSBzdWNjZXNzZnVsIHVwZGF0ZSBpbnRvIGFcbiAgICAgICAgICAgIC8vIHJlcG9ydGVkIGZhaWx1cmUuIFRoZSBtdGltZSBjaGVjayBpcyB0aGUgc291cmNlIG9mIHRydXRoOyBgYXBwbGllZGAgaXMgb25seVxuICAgICAgICAgICAgLy8gY29uc3VsdGVkIHdoZW4gdGhlIG10aW1lIGNhbm5vdCBjb25maXJtIG9uZSB3YXkgb3IgdGhlIG90aGVyLlxuICAgICAgICAgICAgbGV0IHBlcnNpc3RlZDogYm9vbGVhbiB8ICd1bnZlcmlmaWVkJyA9ICd1bnZlcmlmaWVkJztcbiAgICAgICAgICAgIGlmIChwcmVmYWJQYXRoICE9PSBudWxsICYmIG10aW1lQmVmb3JlICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbXRpbWVBZnRlciA9IGF3YWl0IHRoaXMud2FpdEZvclByZWZhYldyaXRlKHByZWZhYlBhdGgsIG10aW1lQmVmb3JlKTtcbiAgICAgICAgICAgICAgICBpZiAobXRpbWVBZnRlciAhPT0gbnVsbCkgcGVyc2lzdGVkID0gbXRpbWVBZnRlciA+IG10aW1lQmVmb3JlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBIHJlamVjdGVkIGFwcGx5IGlzIGEgSEFSRCBTVE9QLCB3aGF0ZXZlciB0aGUgbXRpbWUgZ3VhcmQgc2F5cyAoIzEyOCwgIzEyNykuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gIzYzIGVzdGFibGlzaGVkIHRoYXQgYGZhbHNlYCBhbG9uZSBkb2VzIG5vdCBtZWFuIHRoZSB3cml0ZSBmYWlsZWQg4oCUIHRoZSBmaWxlIGNhblxuICAgICAgICAgICAgLy8gYmUgcmV3cml0dGVuIGFueXdheSDigJQgc28gcmVqZWN0aW9uIHdhcyBkZW1vdGVkIGZyb20gXCJmYWlsdXJlXCIgdG8gXCJ1bmNvbmZpcm1lZFwiXG4gICAgICAgICAgICAvLyBhbmQgdGhlIG10aW1lIGNoZWNrIHdhcyBtYWRlIHRoZSBzb3VyY2Ugb2YgdHJ1dGguIFRoYXQgaXMgcmlnaHQgYWJvdXQgdGhlIFdSSVRFXG4gICAgICAgICAgICAvLyBhbmQgd3JvbmcgYWJvdXQgZXZlcnl0aGluZyBkb3duc3RyZWFtIG9mIGl0OiB0aGUgb3JwaGFuIHBhc3MgYmVsb3cgdHJlYXRzIHRoZVxuICAgICAgICAgICAgLy8gbGl2ZSBgcXVlcnktbm9kZWAgd2FsayBhcyBncm91bmQgdHJ1dGggZm9yIHdoYXQgbWF5IGxlZ2l0aW1hdGVseSBiZSBkZWxldGVkLCBhbmRcbiAgICAgICAgICAgIC8vIGEgcmVqZWN0ZWQgYXBwbHkgaXMgcHJlY2lzZWx5IHRoZSBzaWduYWwgdGhhdCBpdHMgdmlldyBvZiB0aGUgaW5zdGFuY2UgY2Fubm90IGJlXG4gICAgICAgICAgICAvLyB0cnVzdGVkLiBSdW5uaW5nIHRoZSBwYXNzIGFueXdheSBsZXQgYHVwZGF0ZWAgZGVsZXRlIGEgcHJlZmFiJ3MgRU5USVJFIGNoaWxkIHNldFxuICAgICAgICAgICAgLy8gd2hpbGUgcmVwb3J0aW5nIGBzdWNjZXNzOiB0cnVlYCDigJQgOCBjaGlsZHJlbiB0byAwIG9uIGRpc2sgaW4gIzEyOCwgYSBuZXN0ZWRcbiAgICAgICAgICAgIC8vIGluc3RhbmNlJ3Mgd2hvbGUgbG9jYWwgbm9kZSBtaXJyb3IgaW4gIzEyNy5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBOZXZlciB0b3VjaCB0aGUgYXNzZXQgYWdhaW4gb24gYSB3cml0ZSB3ZSB3ZXJlIHRvbGQgbm90IHRvIHRydXN0OiBubyBvcnBoYW5cbiAgICAgICAgICAgIC8vIGRldGVjdGlvbiwgbm8gcmVtb3ZhbCwgbm8gc3VjY2VzcyBlbnZlbG9wZS5cbiAgICAgICAgICAgIGNvbnN0IGFwcGxpZWRSZWplY3RlZCA9IGFwcGxpZWQgPT09IGZhbHNlO1xuXG4gICAgICAgICAgICBpZiAoYXBwbGllZFJlamVjdGVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgRWRpdG9yIHJlamVjdGVkIGFwcGx5LXByZWZhYiBmb3Igbm9kZSAke3Jvb3RVdWlkfSwgc28gaXRzIHJlc3VsdCBpcyBub3QgdHJ1c3R3b3J0aHkgYW5kIG5vIGNoaWxkIG5vZGVzIHdlcmUgcmVtb3ZlZC4gQ29uZmlybSBpdCBpcyBhIHByZWZhYi1pbnN0YW5jZSByb290IHdpdGggYSB2YWxpZCBhc3NldCBsaW5rLmAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgKHBlcnNpc3RlZCA9PT0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gYCBUaGUgcmVqZWN0ZWQgYXBwbHkgZGlkIHJld3JpdGUgJHtwcmVmYWJQYXRofSDigJQgZGlmZiBpdCBhZ2FpbnN0IGdpdCBiZWZvcmUgcmV0cnlpbmcuYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogJycpLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQsIGFwcGxpZWRSZWplY3RlZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBhcHBseS1wcmVmYWIgcmVwb3J0ZWQgbm8gZXJyb3IgYnV0ICR7cHJlZmFiUGF0aH0gd2FzIG5vdCByZXdyaXR0ZW4uIFRoZSBub2RlIG1heSBoYXZlIG5vIG92ZXJyaWRlcyB0byBhcHBseSwgb3IgaXRzIHByZWZhYiBsaW5rIGlzIHN0YWxlLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gYGFwcGx5LXByZWZhYmAgd3JpdGVzIHByb3BlcnR5IG92ZXJyaWRlcyBidXQgZG9lcyBub3QgcmVtb3ZlIGEgY2hpbGQgbm9kZVxuICAgICAgICAgICAgLy8gZGVsZXRlZCBmcm9tIHRoZSBpbnN0YW5jZSAoIzIxKSDigJQgdGhlIG10aW1lIGd1YXJkIGFib3ZlIGNhbm5vdCBzZWUgdGhpcyxcbiAgICAgICAgICAgIC8vIGJlY2F1c2UgYSBkZWxldGlvbiBzdGlsbCBwcm9kdWNlcyBvdmVycmlkZXMgZWxzZXdoZXJlLCBzbyB0aGUgZmlsZSBJU1xuICAgICAgICAgICAgLy8gcmV3cml0dGVuIGFuZCBgcGVyc2lzdGVkYCBpcyBnZW51aW5lbHkgYHRydWVgLiBDb21wYXJlIHRoZSBsaXZlIGluc3RhbmNlJ3NcbiAgICAgICAgICAgIC8vIGZpbGVJZHMgYWdhaW5zdCB0aGUgZnJlc2hseS13cml0dGVuIGFzc2V0J3MgdG8gY2F0Y2ggdGhlIHNwZWNpZmljIGZhaWx1cmVcbiAgICAgICAgICAgIC8vIG1vZGUgdGhlIG10aW1lIGNoZWNrIGNhbm5vdDogYSBjaGlsZCBzdGlsbCBwcmVzZW50IG9uIGRpc2sgdGhhdCBubyBsb25nZXJcbiAgICAgICAgICAgIC8vIGV4aXN0cyBpbiB0aGUgc2NlbmUuIEFueXRoaW5nIGZvdW5kIGlzIHRoZW4gcmVtb3ZlZCBmcm9tIHRoZSBhc3NldCwgc2luY2VcbiAgICAgICAgICAgIC8vIHJlcG9ydGluZyB0aGUgc3RhbGUgY2hpbGRyZW4gaXMgbm90IHRoZSBzYW1lIGFzIGhvbm91cmluZyB0aGUgZGVsZXRpb24uXG4gICAgICAgICAgICBsZXQgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gdHJ1ZSAmJiBwcmVmYWJQYXRoKSB7XG4gICAgICAgICAgICAgICAgb3JwaGFuZWRGaWxlSWRzID0gYXdhaXQgdGhpcy5maW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQsIHByZWZhYlBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IHJlbW92ZWRGaWxlSWRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKG9ycGhhbmVkRmlsZUlkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVtb3ZhbCA9IGF3YWl0IHRoaXMucmVtb3ZlT3JwaGFuZWRDaGlsZHJlbkZyb21Bc3NldChcbiAgICAgICAgICAgICAgICAgICAgcHJlZmFiUGF0aCBhcyBzdHJpbmcsIG9ycGhhbmVkRmlsZUlkcywgcm9vdFV1aWQsIGFzc2V0VXVpZFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgaWYgKCFyZW1vdmFsLnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBhcHBseS1wcmVmYWIgd3JvdGUgJHtwcmVmYWJQYXRofSwgYnV0IGl0IHN0aWxsIGNvbnRhaW5zICR7b3JwaGFuZWRGaWxlSWRzLmxlbmd0aH0gY2hpbGQgbm9kZShzKSAoZmlsZUlkOiAke29ycGhhbmVkRmlsZUlkcy5qb2luKCcsICcpfSkgdGhhdCBubyBsb25nZXIgZXhpc3QgaW4gdGhlIHNjZW5lIGluc3RhbmNlLiBDb2NvcyBDcmVhdG9yIDMuOC43J3MgYXBwbHktcHJlZmFiIGRvZXMgbm90IHJlbW92ZSBkZWxldGVkIGNoaWxkcmVuLCBhbmQgcmVtb3ZpbmcgdGhlbSBoZXJlIHdhcyBkZWNsaW5lZDogJHtyZW1vdmFsLmVycm9yfS4gVGhlIGFzc2V0IGlzIGJ5dGUtZm9yLWJ5dGUgdW5jaGFuZ2VkIOKAlCBkZWxldGUgYW5kIHJlY3JlYXRlIHRoZSBwcmVmYWIsIG9yIHJlbW92ZSB0aGUgc3RhbGUgZW50cmllcyBtYW51YWxseS5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkLCBvcnBoYW5lZEZpbGVJZHMgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZW1vdmVkRmlsZUlkcyA9IG9ycGhhbmVkRmlsZUlkcztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gT25seSBldmVyIHJlYWNoZWQgb24gYSBOT04tcmVqZWN0ZWQgYXBwbHk6IGEgcmVqZWN0aW9uIHJldHVybnMgYWJvdmUuIEtlZXBpbmdcbiAgICAgICAgICAgIC8vIGBhcHBsaWVkUmVqZWN0ZWRgIGluIHRoZSBwYXlsb2FkIChub3cgYWx3YXlzIGZhbHNlKSByYXRoZXIgdGhhbiBkcm9wcGluZyBpdCwgc29cbiAgICAgICAgICAgIC8vIGV4aXN0aW5nIGNhbGxlcnMgdGhhdCBicmFuY2ggb24gdGhlIGZpZWxkIGtlZXAgd29ya2luZyB1bmNoYW5nZWQuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogcmVtb3ZlZEZpbGVJZHMubGVuZ3RoID4gMFxuICAgICAgICAgICAgICAgICAgICA/IGBQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHk7IHJlbW92ZWQgJHtyZW1vdmVkRmlsZUlkcy5sZW5ndGh9IGNoaWxkIG5vZGUocykgYXBwbHktcHJlZmFiIGxlZnQgYmVoaW5kYFxuICAgICAgICAgICAgICAgICAgICA6ICdQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCwgYXBwbGllZFJlamVjdGVkLCByZW1vdmVkRmlsZUlkcyB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJuIHRoZSBmaWxlSWRzIG9mIHByZWZhYi10cmFja2VkIG5vZGVzIHByZXNlbnQgaW4gdGhlIHdyaXR0ZW4gYXNzZXQgYnV0IGFic2VudFxuICAgICAqIGZyb20gdGhlIGxpdmUgc2NlbmUgaW5zdGFuY2Ug4oCUIGNoaWxkcmVuIGBhcHBseS1wcmVmYWJgIGZhaWxlZCB0byByZW1vdmUgKCMyMSkuXG4gICAgICogRGV0ZWN0aW9uIGlzIGJlc3QtZWZmb3J0OiBhbnkgZmFpbHVyZSByZXR1cm5zIG5vIG9ycGhhbnMgcmF0aGVyIHRoYW4gYSBmYWxzZVxuICAgICAqIHBvc2l0aXZlLCBzaW5jZSB0aGlzIGNoZWNrIG11c3QgbmV2ZXIgbWFzayBhIGdlbnVpbmUgc3VjY2Vzcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGZpbmRPcnBoYW5lZENoaWxkRmlsZUlkcyhyb290VXVpZDogc3RyaW5nLCBwcmVmYWJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBsaXZlRmlsZUlkcyA9IGF3YWl0IHRoaXMuY29sbGVjdEluc3RhbmNlRmlsZUlkcyhyb290VXVpZCk7XG4gICAgICAgICAgICBpZiAobGl2ZUZpbGVJZHMuc2l6ZSA9PT0gMCkgcmV0dXJuIFtdO1xuICAgICAgICAgICAgY29uc3QgYXNzZXREYXRhID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMocHJlZmFiUGF0aCwgJ3V0Zi04JykpO1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGFzc2V0RGF0YSkpIHJldHVybiBbXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RmlsZUlkcyA9IHRoaXMuY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMoYXNzZXREYXRhKTtcbiAgICAgICAgICAgIHJldHVybiBbLi4uYXNzZXRGaWxlSWRzXS5maWx0ZXIoaWQgPT4gIWxpdmVGaWxlSWRzLmhhcyhpZCkpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFdhbGsgYSBsaXZlIHByZWZhYi1pbnN0YW5jZSBzdWJ0cmVlIGFuZCBjb2xsZWN0IHRoZSBgX19wcmVmYWJfXy5maWxlSWRgIG9mIGV2ZXJ5IG5vZGUuXG4gICAgICpcbiAgICAgKiBgcXVlcnktbm9kZWAgcmV0dXJucyBgY2hpbGRyZW5gIGFzIHByb3BlcnR5IGR1bXBzIChgeyB2YWx1ZTogeyB1dWlkIH0sIHR5cGUgfWApLCBub3RcbiAgICAgKiB1dWlkIHN0cmluZ3M7IHBhc3NpbmcgdGhlIGR1bXAgb24gYXMgYSB1dWlkIHJlYWNoZWQgbm8gY2hpbGQsIHNvIGV2ZXJ5IGxpdmUgY2hpbGRcbiAgICAgKiBsb29rZWQgb3JwaGFuZWQgYW5kIHdhcyBkZWxldGVkIGZyb20gdGhlIGFzc2V0LiBBbnkgbm9kZSB0aGF0IGNhbm5vdCBiZSByZXNvbHZlZCBvclxuICAgICAqIGNhcnJpZXMgbm8gZmlsZUlkIG1ha2VzIHRoZSB3YWxrIGluY29tcGxldGUsIGFuZCBhbiBpbmNvbXBsZXRlIHdhbGsgcmV0dXJucyBhbiBFTVBUWVxuICAgICAqIHNldCDigJQgdGhlIGNhbGxlciB0aGVuIHJlbW92ZXMgbm90aGluZyByYXRoZXIgdGhhbiBkZWxldGluZyBhIGNoaWxkIGl0IGZhaWxlZCB0byBzZWUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBjb2xsZWN0SW5zdGFuY2VGaWxlSWRzKHJvb3RVdWlkOiBzdHJpbmcpOiBQcm9taXNlPFNldDxzdHJpbmc+PiB7XG4gICAgICAgIGNvbnN0IGZpbGVJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgICAgbGV0IGNvbXBsZXRlID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgY2hpbGRVdWlkT2YgPSAoZW50cnk6IGFueSk6IHN0cmluZyA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGVudHJ5ID09PSAnc3RyaW5nJykgcmV0dXJuIGVudHJ5O1xuICAgICAgICAgICAgaWYgKGVudHJ5ICYmIHR5cGVvZiBlbnRyeSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGVudHJ5LnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gZW50cnkudXVpZDtcbiAgICAgICAgICAgICAgICBpZiAoZW50cnkudmFsdWUgJiYgdHlwZW9mIGVudHJ5LnZhbHVlLnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gZW50cnkudmFsdWUudXVpZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdmlzaXQgPSBhc3luYyAodXVpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBpZiAoIWNvbXBsZXRlKSByZXR1cm47XG4gICAgICAgICAgICBpZiAoIXV1aWQpIHsgY29tcGxldGUgPSBmYWxzZTsgcmV0dXJuOyB9XG4gICAgICAgICAgICBsZXQgbm9kZURhdGE6IGFueTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgbm9kZURhdGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICBjb21wbGV0ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGZpbGVJZCA9IG5vZGVEYXRhPy5fX3ByZWZhYl9fPy5maWxlSWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGZpbGVJZCAhPT0gJ3N0cmluZycgfHwgIWZpbGVJZCkgeyBjb21wbGV0ZSA9IGZhbHNlOyByZXR1cm47IH1cbiAgICAgICAgICAgIGZpbGVJZHMuYWRkKGZpbGVJZCk7XG4gICAgICAgICAgICBjb25zdCBjaGlsZHJlbjogYW55W10gPSBBcnJheS5pc0FycmF5KG5vZGVEYXRhLmNoaWxkcmVuKSA/IG5vZGVEYXRhLmNoaWxkcmVuIDogW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSBhd2FpdCB2aXNpdChjaGlsZFV1aWRPZihjaGlsZCkpO1xuICAgICAgICB9O1xuICAgICAgICBhd2FpdCB2aXNpdChyb290VXVpZCk7XG4gICAgICAgIHJldHVybiBjb21wbGV0ZSA/IGZpbGVJZHMgOiBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICB9XG5cbiAgICAvKiogRXh0cmFjdCBldmVyeSBgY2MuTm9kZWAgZW50cnkncyBmaWxlSWQgZnJvbSBhIHdyaXR0ZW4gYC5wcmVmYWJgIGFzc2V0J3MgSlNPTiBhcnJheS4gKi9cbiAgICBwcml2YXRlIGNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGE6IGFueVtdKTogU2V0PHN0cmluZz4ge1xuICAgICAgICBjb25zdCBmaWxlSWRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCkgZmlsZUlkcy5hZGQoZmlsZUlkKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZUlkcztcbiAgICB9XG5cbiAgICAvKiogVGhlIGZpbGVJZCByZWNvcmRlZCBvbiB0aGUgYGNjLk5vZGVgIGF0IGBpbmRleGAsIG9yIG51bGwgd2hlbiBpdCBoYXMgbm9uZS4gKi9cbiAgICBwcml2YXRlIGZpbGVJZE9mTm9kZShwcmVmYWJEYXRhOiBhbnlbXSwgaW5kZXg6IG51bWJlcik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBlbnRyeS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgIGlmICh0eXBlb2YgcHJlZmFiSW5mb0luZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgIGNvbnN0IGZpbGVJZCA9IHByZWZhYkRhdGFbcHJlZmFiSW5mb0luZGV4XT8uZmlsZUlkO1xuICAgICAgICByZXR1cm4gdHlwZW9mIGZpbGVJZCA9PT0gJ3N0cmluZycgJiYgZmlsZUlkID8gZmlsZUlkIDogbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2UgYXJyYXlzIHdob3NlIGVsZW1lbnQgb3JkZXIgaXMgc3RydWN0dXJhbCDigJQgYSByZW1vdmVkIGVudHJ5IG11c3QgYmUgc3BsaWNlZFxuICAgICAqIG91dCBvZiB0aGVtLCBuZXZlciBsZWZ0IGJlaGluZCBhcyBhIG51bGwgaG9sZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIHJlYWRvbmx5IHN0cnVjdHVyYWxSZWZBcnJheXMgPSBbJ19jaGlsZHJlbicsICdfY29tcG9uZW50cycsICduZXN0ZWRQcmVmYWJJbnN0YW5jZVJvb3RzJywgJ3RhcmdldE92ZXJyaWRlcyddO1xuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIHRoZSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlcyBgYXBwbHktcHJlZmFiYCBsZWZ0IGJlaGluZCwgdGhlbiBoYW5kIHRoZSByZXN1bHRcbiAgICAgKiB0byB0aGUgZWRpdG9yIGZvciBhY2NlcHRhbmNlICgjMjEpLlxuICAgICAqXG4gICAgICogVGhyZWUgZ2F0ZXMgZ3VhcmQgdGhlIHJld3JpdGUsIGFuZCB0aGUgcHJlLXN1cmdlcnkgYnl0ZXMgYXJlIHJlc3RvcmVkIGF0IGFueSBvZiB0aGVtOlxuICAgICAqIHRoZSBncmFwaCByZXdyaXRlIHJlZnVzZXMgYSBsYXlvdXQgaXQgZG9lcyBub3QgcmVjb2duaXNlLCB0aGUgcmV3cml0dGVuIGdyYXBoIGlzXG4gICAgICogdmFsaWRhdGVkIGJlZm9yZSBpdCBpcyB3cml0dGVuLCBhbmQgYGFzc2V0LWRiOnJlaW1wb3J0LWFzc2V0YCBpcyB0aGUgZW5naW5lJ3Mgb3duXG4gICAgICogdmVyZGljdCBvbiB0aGUgcmVzdWx0IOKAlCBhbiBpbnRlcm5hbGx5IGNvbnNpc3RlbnQgZ3JhcGggY2FuIHN0aWxsIGJlIG9uZSB0aGUgaW1wb3J0ZXJcbiAgICAgKiByZWplY3RzLCBhbmQgb25seSB0aGUgZWRpdG9yIGNhbiBzYXkgc28uIEEgZGVjbGluZWQgcmVtb3ZhbCBsZWF2ZXMgdGhlIGNhbGxlciBleGFjdGx5XG4gICAgICogd2hlcmUgaXQgc3Rvb2QgYmVmb3JlIHRoaXMgbWV0aG9kIGV4aXN0ZWQ6IGEgaGFyZCBmYWlsdXJlIG5hbWluZyB0aGUgc3RhbGUgZmlsZUlkcy5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlbW92ZU9ycGhhbmVkQ2hpbGRyZW5Gcm9tQXNzZXQoXG4gICAgICAgIHByZWZhYlBhdGg6IHN0cmluZyxcbiAgICAgICAgb3JwaGFuZWRGaWxlSWRzOiBzdHJpbmdbXSxcbiAgICAgICAgcm9vdFV1aWQ6IHN0cmluZyxcbiAgICAgICAgYXNzZXRVdWlkOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgZXJyb3I/OiBzdHJpbmcgfT4ge1xuICAgICAgICBsZXQgb3JpZ2luYWxUZXh0OiBzdHJpbmc7XG4gICAgICAgIGxldCBwcmVmYWJEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBvcmlnaW5hbFRleHQgPSBmcy5yZWFkRmlsZVN5bmMocHJlZmFiUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgICAgICBwcmVmYWJEYXRhID0gSlNPTi5wYXJzZShvcmlnaW5hbFRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgdGhlIGFzc2V0IGNvdWxkIG5vdCBiZSByZS1yZWFkICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByZWZhYkRhdGEpKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICd0aGUgYXNzZXQgaXMgbm90IGEgc2VyaWFsaXplZCBlbnRyeSBhcnJheScgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGxpdmVGaWxlSWRzID0gYXdhaXQgdGhpcy5jb2xsZWN0SW5zdGFuY2VGaWxlSWRzKHJvb3RVdWlkKTtcbiAgICAgICAgY29uc3QgZmlsZUlkc0JlZm9yZSA9IHRoaXMuY29sbGVjdEFzc2V0Tm9kZUZpbGVJZHMocHJlZmFiRGF0YSk7XG4gICAgICAgIGNvbnN0IHJld3JpdHRlbiA9IHRoaXMucHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGEsIG9ycGhhbmVkRmlsZUlkcywgbGl2ZUZpbGVJZHMpO1xuICAgICAgICBpZiAoIXJld3JpdHRlbikge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGFzc2V0IGdyYXBoIGRvZXMgbm90IG1hdGNoIHRoZSBsYXlvdXQgdGhpcyByZW1vdmFsIHVuZGVyc3RhbmRzJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW52YWxpZCA9IHRoaXMudmFsaWRhdGVQcmVmYWJHcmFwaChyZXdyaXR0ZW4sIG9ycGhhbmVkRmlsZUlkcywgZmlsZUlkc0JlZm9yZSk7XG4gICAgICAgIGlmIChpbnZhbGlkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGdyYXBoIGZhaWxlZCB2YWxpZGF0aW9uICgke2ludmFsaWR9KWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIEpTT04uc3RyaW5naWZ5KHJld3JpdHRlbiwgbnVsbCwgb3JpZ2luYWxUZXh0LmluY2x1ZGVzKCdcXG4nKSA/IDIgOiAwKSwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGB0aGUgcmV3cml0dGVuIGFzc2V0IGNvdWxkIG5vdCBiZSB3cml0dGVuICgke2Vyci5tZXNzYWdlfSlgIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgaW1wb3J0ZWQ6IGJvb2xlYW47XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IChhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFzc2V0VXVpZCkpICE9PSBmYWxzZTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBpbXBvcnRlZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW1wb3J0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZVByZWZhYkZpbGUocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3RoZSBlZGl0b3IgcmVqZWN0ZWQgdGhlIHJld3JpdHRlbiBhc3NldCBvbiByZWltcG9ydCcgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN1cnZpdm9ycyA9IGF3YWl0IHRoaXMuZmluZE9ycGhhbmVkQ2hpbGRGaWxlSWRzKHJvb3RVdWlkLCBwcmVmYWJQYXRoKTtcbiAgICAgICAgaWYgKHN1cnZpdm9ycy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0aGlzLnJlc3RvcmVQcmVmYWJGaWxlKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGByZW1vdmFsIHJhbiBidXQgZmlsZUlkKHMpICR7c3Vydml2b3JzLmpvaW4oJywgJyl9IGFyZSBzdGlsbCBvcnBoYW5lZGAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICB9XG5cbiAgICAvKiogUHV0IHRoZSBwcmUtc3VyZ2VyeSBieXRlcyBiYWNrLCBzbyBhIGRlY2xpbmVkIHJlbW92YWwgbGVhdmVzIHRoZSBhc3NldCB1bnRvdWNoZWQuICovXG4gICAgcHJpdmF0ZSByZXN0b3JlUHJlZmFiRmlsZShwcmVmYWJQYXRoOiBzdHJpbmcsIG9yaWdpbmFsVGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKHByZWZhYlBhdGgsIG9yaWdpbmFsVGV4dCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gTm90aGluZyBmdXJ0aGVyIHRvIGRvIGhlcmUg4oCUIHRoZSBjYWxsZXIgcmVwb3J0cyB0aGUgZmFpbHVyZSBlaXRoZXIgd2F5LlxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRHJvcCBldmVyeSBvcnBoYW5lZCBjaGlsZCBzdWJ0cmVlIGZyb20gYSBzZXJpYWxpemVkIHByZWZhYiBhcnJheSBhbmQgcmUtaW5kZXggdGhlIHdob2xlXG4gICAgICogZ3JhcGguIFJldHVybnMgbnVsbCDigJQgY2hhbmdpbmcgbm90aGluZyDigJQgd2hlbmV2ZXIgdGhlIGdyYXBoIGRvZXMgbm90IG1hdGNoIHdoYXQgdGhpc1xuICAgICAqIHJld3JpdGUgcmVsaWVzIG9uLCByYXRoZXIgdGhhbiBwcm9kdWNpbmcgYW4gYXNzZXQgbm9ib2R5IGNhbiBsb2FkLlxuICAgICAqL1xuICAgIHByaXZhdGUgcHJ1bmVPcnBoYW5lZE5vZGVzKHByZWZhYkRhdGE6IGFueVtdLCBvcnBoYW5lZEZpbGVJZHM6IHN0cmluZ1tdLCBsaXZlRmlsZUlkczogU2V0PHN0cmluZz4pOiBhbnlbXSB8IG51bGwge1xuICAgICAgICBjb25zdCBub2RlSW5kZXhCeUZpbGVJZCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcmVmYWJEYXRhLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGZpbGVJZCAhPT0gbnVsbCAmJiAhbm9kZUluZGV4QnlGaWxlSWQuaGFzKGZpbGVJZCkpIG5vZGVJbmRleEJ5RmlsZUlkLnNldChmaWxlSWQsIGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlbW92ZWQgPSBuZXcgU2V0PG51bWJlcj4oKTtcbiAgICAgICAgY29uc3QgcGVuZGluZzogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2Ygb3JwaGFuZWRGaWxlSWRzKSB7XG4gICAgICAgICAgICBjb25zdCBpbmRleCA9IG5vZGVJbmRleEJ5RmlsZUlkLmdldChmaWxlSWQpO1xuICAgICAgICAgICAgLy8gRGV0ZWN0aW9uIGFuZCByZW1vdmFsIGRpc2FncmVlIGFib3V0IHRoZSBhc3NldCDigJQgZG8gbm90IGd1ZXNzIGF0IHRoZSBncmFwaC5cbiAgICAgICAgICAgIGlmIChpbmRleCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIHBlbmRpbmcucHVzaChpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAocGVuZGluZy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBub2RlSW5kZXggPSBwZW5kaW5nLnNoaWZ0KCkgYXMgbnVtYmVyO1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKG5vZGVJbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IHByZWZhYkRhdGFbbm9kZUluZGV4XTtcbiAgICAgICAgICAgIGlmICghbm9kZSB8fCBub2RlLl9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcmVtb3ZlZC5hZGQobm9kZUluZGV4KTtcblxuICAgICAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gbm9kZS5fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICBpZiAodHlwZW9mIHByZWZhYkluZm9JbmRleCA9PT0gJ251bWJlcicpIHJlbW92ZWQuYWRkKHByZWZhYkluZm9JbmRleCk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkobm9kZS5fY29tcG9uZW50cykgPyBub2RlLl9jb21wb25lbnRzIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY29tcG9uZW50SW5kZXggIT09ICdudW1iZXInKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICByZW1vdmVkLmFkZChjb21wb25lbnRJbmRleCk7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcFByZWZhYkluZGV4ID0gcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF0/Ll9fcHJlZmFiPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wUHJlZmFiSW5kZXggPT09ICdudW1iZXInKSByZW1vdmVkLmFkZChjb21wUHJlZmFiSW5kZXgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJlZiBvZiBBcnJheS5pc0FycmF5KG5vZGUuX2NoaWxkcmVuKSA/IG5vZGUuX2NoaWxkcmVuIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgLy8gQSBkZXNjZW5kYW50IG9mIGEgZGVsZXRlZCBjaGlsZCBjYW5ub3Qgc3RpbGwgYmUgbGl2ZSBpbiB0aGUgaW5zdGFuY2UuIElmIG9uZVxuICAgICAgICAgICAgICAgIC8vIGlzLCB0aGUgb3JwaGFuIHNldCBpcyBub3Qgd2hhdCB0aGlzIHJld3JpdGUgYXNzdW1lcyBhbmQgaXQgbXVzdCBub3QgcHJvY2VlZC5cbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEZpbGVJZCA9IHRoaXMuZmlsZUlkT2ZOb2RlKHByZWZhYkRhdGEsIGNoaWxkSW5kZXgpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZEZpbGVJZCAhPT0gbnVsbCAmJiBsaXZlRmlsZUlkcy5oYXMoY2hpbGRGaWxlSWQpKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICBwZW5kaW5nLnB1c2goY2hpbGRJbmRleCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlbW92ZWQuc2l6ZSA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgY29uc3QgcHJ1bmVkOiBhbnlbXSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkocHJlZmFiRGF0YSkpO1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJ1bmVkLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKGluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHBydW5lZFtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgdGhpcy5zdHJ1Y3R1cmFsUmVmQXJyYXlzKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGVudHJ5W2tleV0pKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBlbnRyeVtrZXldID0gZW50cnlba2V5XS5maWx0ZXIoKGVsZW1lbnQ6IGFueSkgPT4gIXRoaXMucmVmZXJlbmNlc1JlbW92ZWQoZWxlbWVudCwgcmVtb3ZlZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gV2hhdGV2ZXIgc3RpbGwgcG9pbnRzIGF0IGEgcmVtb3ZlZCBlbnRyeSBiZWNvbWVzIG51bGwg4oCUIHRoaXMgaXMgdGhlIGRhbmdsaW5nXG4gICAgICAgIC8vIGNvbXBvbmVudCByZWZlcmVuY2UgdGhlIHJlcG9ydCBjYWxscyBvdXQgKGFuIGBPYmplY3RWaWV3LnRpY2tOb2RlYCBiaW5kaW5nIHRvIGFcbiAgICAgICAgLy8gY2hpbGQgdGhhdCBubyBsb25nZXIgZXhpc3RzKS5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHBydW5lZC5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkLmhhcyhpbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcHJ1bmVkW2luZGV4XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKHBydW5lZFtpbmRleF0sIHJlbW92ZWQpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtYXAgPSBuZXcgTWFwPG51bWJlciwgbnVtYmVyPigpO1xuICAgICAgICBjb25zdCBzdXJ2aXZvcnM6IGFueVtdID0gW107XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcnVuZWQubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMoaW5kZXgpKSBjb250aW51ZTtcbiAgICAgICAgICAgIHJlbWFwLnNldChpbmRleCwgc3Vydml2b3JzLmxlbmd0aCk7XG4gICAgICAgICAgICBzdXJ2aXZvcnMucHVzaChwcnVuZWRbaW5kZXhdKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3Vydml2b3JzLm1hcChlbnRyeSA9PiB0aGlzLnJlbWFwUmVmcyhlbnRyeSwgcmVtYXApKTtcbiAgICB9XG5cbiAgICAvKiogVHJ1ZSB3aGVuIGB2YWx1ZWAgaXMg4oCUIG9yIGNvbnRhaW5zIOKAlCBhbiBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeS4gKi9cbiAgICBwcml2YXRlIHJlZmVyZW5jZXNSZW1vdmVkKHZhbHVlOiBhbnksIHJlbW92ZWQ6IFNldDxudW1iZXI+KTogYm9vbGVhbiB7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pO1xuICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyh2YWx1ZSkuc29tZShuZXN0ZWQgPT4gdGhpcy5yZWZlcmVuY2VzUmVtb3ZlZChuZXN0ZWQsIHJlbW92ZWQpKTtcbiAgICB9XG5cbiAgICAvKiogUmVwbGFjZSBldmVyeSBgeyBfX2lkX18gfWAgcmVmZXJlbmNlIHRvIGEgcmVtb3ZlZCBlbnRyeSB3aXRoIG51bGwuICovXG4gICAgcHJpdmF0ZSBudWxsaWZ5UmVtb3ZlZFJlZnModmFsdWU6IGFueSwgcmVtb3ZlZDogU2V0PG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLm51bGxpZnlSZW1vdmVkUmVmcyhlbGVtZW50LCByZW1vdmVkKSk7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHZhbHVlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHJldHVybiByZW1vdmVkLmhhcyh2YWx1ZS5fX2lkX18pID8gbnVsbCA6IHZhbHVlO1xuICAgICAgICBjb25zdCByZXdyaXR0ZW46IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIG5lc3RlZF0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSByZXdyaXR0ZW5ba2V5XSA9IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKG5lc3RlZCwgcmVtb3ZlZCk7XG4gICAgICAgIHJldHVybiByZXdyaXR0ZW47XG4gICAgfVxuXG4gICAgLyoqIFBvaW50IGV2ZXJ5IHN1cnZpdmluZyBgX19pZF9fYCBhdCBpdHMgZW50cnkncyBzbG90IGluIHRoZSBjb21wYWN0ZWQgYXJyYXkuICovXG4gICAgcHJpdmF0ZSByZW1hcFJlZnModmFsdWU6IGFueSwgcmVtYXA6IE1hcDxudW1iZXIsIG51bWJlcj4pOiBhbnkge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZS5tYXAoZWxlbWVudCA9PiB0aGlzLnJlbWFwUmVmcyhlbGVtZW50LCByZW1hcCkpO1xuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiB2YWx1ZTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZS5fX2lkX18gPT09ICdudW1iZXInKSB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gcmVtYXAuZ2V0KHZhbHVlLl9faWRfXyk7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IHsgX19pZF9fOiBuZXh0IH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmV3cml0dGVuOiBhbnkgPSB7fTtcbiAgICAgICAgZm9yIChjb25zdCBba2V5LCBuZXN0ZWRdIG9mIE9iamVjdC5lbnRyaWVzKHZhbHVlKSkgcmV3cml0dGVuW2tleV0gPSB0aGlzLnJlbWFwUmVmcyhuZXN0ZWQsIHJlbWFwKTtcbiAgICAgICAgcmV0dXJuIHJld3JpdHRlbjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWplY3QgYSByZXdyaXR0ZW4gZ3JhcGggYmVmb3JlIGl0IHJlYWNoZXMgZGlzay4gUmV0dXJucyB0aGUgZmlyc3QgcHJvYmxlbSBmb3VuZCwgb3JcbiAgICAgKiBudWxsIHdoZW4gdGhlIGdyYXBoIGlzIHNvdW5kIOKAlCB0aGlzIGlzIHdoYXQgbWFrZXMgYSBtaXMtaW5kZXhlZCBhc3NldCBpbXBvc3NpYmxlIHRvXG4gICAgICogd3JpdGUgcmF0aGVyIHRoYW4gc29tZXRoaW5nIHRvIG5vdGljZSBhZnRlcndhcmRzLlxuICAgICAqL1xuICAgIHByaXZhdGUgdmFsaWRhdGVQcmVmYWJHcmFwaChwcmVmYWJEYXRhOiBhbnlbXSwgcmVtb3ZlZEZpbGVJZHM6IHN0cmluZ1tdLCBmaWxlSWRzQmVmb3JlOiBTZXQ8c3RyaW5nPik6IHN0cmluZyB8IG51bGwge1xuICAgICAgICBjb25zdCBkYW5nbGluZyA9IHRoaXMuZmluZERhbmdsaW5nUmVmKHByZWZhYkRhdGEsIHByZWZhYkRhdGEubGVuZ3RoKTtcbiAgICAgICAgaWYgKGRhbmdsaW5nICE9PSBudWxsKSByZXR1cm4gYF9faWRfXyAke2RhbmdsaW5nfSBpcyBvdXQgb2YgcmFuZ2VgO1xuXG4gICAgICAgIC8vIElkZW50aXR5LCBub3QgY291bnQ6IGV4YWN0bHkgdGhlIG9ycGhhbnMgZ28sIGFuZCBub3RoaW5nIGVsc2UgZG9lcy5cbiAgICAgICAgY29uc3QgcmVtYWluaW5nID0gdGhpcy5jb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhwcmVmYWJEYXRhKTtcbiAgICAgICAgZm9yIChjb25zdCBmaWxlSWQgb2YgcmVtb3ZlZEZpbGVJZHMpIHtcbiAgICAgICAgICAgIGlmIChyZW1haW5pbmcuaGFzKGZpbGVJZCkpIHJldHVybiBgb3JwaGFuZWQgZmlsZUlkICR7ZmlsZUlkfSBzdXJ2aXZlZCByZW1vdmFsYDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiBmaWxlSWRzQmVmb3JlKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZEZpbGVJZHMuaW5jbHVkZXMoZmlsZUlkKSkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoIXJlbWFpbmluZy5oYXMoZmlsZUlkKSkgcmV0dXJuIGBmaWxlSWQgJHtmaWxlSWR9IHdhcyByZW1vdmVkIGJ1dCBzaG91bGQgaGF2ZSBiZWVuIGtlcHRgO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBlbnRyeSA9IHByZWZhYkRhdGFbaW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NoaWxkcmVuKSA/IGVudHJ5Ll9jaGlsZHJlbiA6IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2hpbGRJbmRleCA9IHJlZj8uX19pZF9fO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NoaWxkcmVuIGVudHJ5YDtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZCA9IHByZWZhYkRhdGFbY2hpbGRJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCFjaGlsZCB8fCBjaGlsZC5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBub24tbm9kZSBjaGlsZCBhdCAke2NoaWxkSW5kZXh9YDtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQuX3BhcmVudCAmJiBjaGlsZC5fcGFyZW50Ll9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBub2RlICR7Y2hpbGRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBwYXJlbnQgJHtpbmRleH1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkoZW50cnkuX2NvbXBvbmVudHMpID8gZW50cnkuX2NvbXBvbmVudHMgOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnRJbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBgbm9kZSAke2luZGV4fSBoYXMgYSBtYWxmb3JtZWQgX2NvbXBvbmVudHMgZW50cnlgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHByZWZhYkRhdGFbY29tcG9uZW50SW5kZXhdO1xuICAgICAgICAgICAgICAgIGlmICghY29tcG9uZW50KSByZXR1cm4gYG5vZGUgJHtpbmRleH0gbGlzdHMgYSBtaXNzaW5nIGNvbXBvbmVudCBhdCAke2NvbXBvbmVudEluZGV4fWA7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXBvbmVudC5ub2RlICYmIGNvbXBvbmVudC5ub2RlLl9faWRfXyAhPT0gaW5kZXgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGBjb21wb25lbnQgJHtjb21wb25lbnRJbmRleH0gZG9lcyBub3QgcG9pbnQgYmFjayBhdCBub2RlICR7aW5kZXh9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLyoqIFRoZSBmaXJzdCBgX19pZF9fYCBvdXRzaWRlIGBbMCwgbGVuZ3RoKWAgYW55d2hlcmUgaW4gdGhlIGdyYXBoLCBvciBudWxsIHdoZW4gYWxsIHJlc29sdmUuICovXG4gICAgcHJpdmF0ZSBmaW5kRGFuZ2xpbmdSZWYodmFsdWU6IGFueSwgbGVuZ3RoOiBudW1iZXIpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2YgdmFsdWUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3VuZCA9IHRoaXMuZmluZERhbmdsaW5nUmVmKGVsZW1lbnQsIGxlbmd0aCk7XG4gICAgICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHJldHVybiBudWxsO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdmFsdWUuX19pZF9fO1xuICAgICAgICAgICAgcmV0dXJuIE51bWJlci5pc0ludGVnZXIoaWQpICYmIGlkID49IDAgJiYgaWQgPCBsZW5ndGggPyBudWxsIDogaWQ7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBuZXN0ZWQgb2YgT2JqZWN0LnZhbHVlcyh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYobmVzdGVkLCBsZW5ndGgpO1xuICAgICAgICAgICAgaWYgKGZvdW5kICE9PSBudWxsKSByZXR1cm4gZm91bmQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIGBxdWVyeS1hc3NldC1tZXRhYCBjYXJyaWVzIG5vIGB1cmxgL2BuYW1lYC90aW1lc3RhbXBzIOKAlCByZWFkaW5nIHRoZW0gb2ZmIHRoZVxuICAgICAgICAvLyBtZXRhIHJlY29yZCBwcm9kdWNlZCBhbiBhbGwtZW1wdHkgUHJlZmFiSW5mbyB0aGF0IHN0aWxsIHJlcG9ydGVkIHN1Y2Nlc3MgKCMyNSkuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHV1aWQpO1xuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogcmVzb2x2ZWQuZXJyb3IgfTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5pbmZvKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcmVmYWIgbm90IGZvdW5kOiAke3V1aWR9YCB9O1xuXG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IHJlc29sdmVkLmluZm87XG4gICAgICAgIGNvbnN0IHVybDogc3RyaW5nID0gYXNzZXRJbmZvLnVybCB8fCAnJztcbiAgICAgICAgY29uc3Qgc3RhdHMgPSByZXNvbHZlZC5maWxlUGF0aCA/IHRoaXMuc3RhdFRpbWVzKHJlc29sdmVkLmZpbGVQYXRoKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IGluZm86IFByZWZhYkluZm8gPSB7XG4gICAgICAgICAgICBuYW1lOiBhc3NldEluZm8ubmFtZSxcbiAgICAgICAgICAgIHV1aWQ6IGFzc2V0SW5mby51dWlkIHx8IHV1aWQsXG4gICAgICAgICAgICBwYXRoOiB1cmwsXG4gICAgICAgICAgICBmb2xkZXI6IHVybCA/IHVybC5zdWJzdHJpbmcoMCwgdXJsLmxhc3RJbmRleE9mKCcvJykpIDogJycsXG4gICAgICAgICAgICBjcmVhdGVUaW1lOiBzdGF0cz8uY3JlYXRlVGltZSxcbiAgICAgICAgICAgIG1vZGlmeVRpbWU6IHN0YXRzPy5tb2RpZnlUaW1lXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgLi4uaW5mbywgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGggfSB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdFRpbWVzKGZpbGVQYXRoOiBzdHJpbmcpOiB7IGNyZWF0ZVRpbWU6IHN0cmluZzsgbW9kaWZ5VGltZTogc3RyaW5nIH0gfCBudWxsIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBmcy5zdGF0U3luYyhmaWxlUGF0aCk7XG4gICAgICAgICAgICByZXR1cm4geyBjcmVhdGVUaW1lOiBzLmJpcnRodGltZS50b0lTT1N0cmluZygpLCBtb2RpZnlUaW1lOiBzLm10aW1lLnRvSVNPU3RyaW5nKCkgfTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gRWFjaCBzdGFnZSByZXBvcnRzIGl0c2VsZi4gVGhlIG9sZCBzaW5nbGUgb3V0ZXIgY2F0Y2ggY29sbGFwc2VkIGV2ZXJ5IGZhaWx1cmVcbiAgICAgICAgLy8gaW50byBgRXJyb3IgdmFsaWRhdGluZyBwcmVmYWI6IEVycm9yOiBwYXJhbWV0ZXIgZXJyb3JgLCB3aGljaCBoaWQgdGhhdCB0aGVcbiAgICAgICAgLy8gcmVqZWN0ZWQgY2FsbCB3YXMgYHF1ZXJ5LXBhdGgoJycpYCDigJQgYHF1ZXJ5LWFzc2V0LW1ldGFgIG5ldmVyIHJldHVybnMgYSBgdXJsYFxuICAgICAgICAvLyB0byByZXNvbHZlLCBzbyB0aGUgcGF0aCBsb29rdXAgd2FzIGFsd2F5cyBoYW5kZWQgYW4gZW1wdHkgc3RyaW5nICgjMjUpLlxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc29sdmVkLmVycm9yKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciB2YWxpZGF0aW5nIHByZWZhYjogJHtyZXNvbHZlZC5lcnJvcn1gIH07XG4gICAgICAgIGlmICghcmVzb2x2ZWQuZmlsZVBhdGgpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NvdWxkIG5vdCByZXNvbHZlIHByZWZhYiBmaWxlIHBhdGggb24gZGlzaycgfTtcblxuICAgICAgICBsZXQgY29udGVudDogc3RyaW5nO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhyZXNvbHZlZC5maWxlUGF0aCwgJ3V0Zi04Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZWFkIHByZWZhYiBmaWxlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZWZhYkRhdGE6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByZWZhYkRhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ByZWZhYiBmaWxlIGZvcm1hdCBlcnJvcjogY2Fubm90IHBhcnNlIEpTT04nIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB2YWxpZGF0aW9uUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UudmFsaWRhdGVQcmVmYWJGb3JtYXQocHJlZmFiRGF0YSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHZhbGlkYXRpb25SZXN1bHQuaXNWYWxpZCwgaXNzdWVzOiB2YWxpZGF0aW9uUmVzdWx0Lmlzc3VlcyxcbiAgICAgICAgICAgICAgICBub2RlQ291bnQ6IHZhbGlkYXRpb25SZXN1bHQubm9kZUNvdW50LCBjb21wb25lbnRDb3VudDogdmFsaWRhdGlvblJlc3VsdC5jb21wb25lbnRDb3VudCxcbiAgICAgICAgICAgICAgICAvLyBOYW1lZCBleHBsaWNpdGx5IHNvIGEgY2FsbGVyIGNhbiB0ZWxsIFwibm90aGluZyB3cm9uZ1wiIGZyb20gXCJub3RoaW5nIHRoZXJlXCI6XG4gICAgICAgICAgICAgICAgLy8gaXNzdWUgIzczJ3MgaG9sbG93IHByZWZhYiBwYXNzZWQgdGhpcyBhY3Rpb24gd2l0aCBgaXNWYWxpZDogdHJ1ZWAuXG4gICAgICAgICAgICAgICAgaG9sbG93Q29tcG9uZW50czogdmFsaWRhdGlvblJlc3VsdC5ob2xsb3dDb21wb25lbnRzLFxuICAgICAgICAgICAgICAgIC8vIElzc3VlICMxMTQgZGVmZWN0IDI6IGFuIGFjY2Vzc29yIGtleSBiZXNpZGUgaXRzIHVuZGVyc2NvcmUgdHdpbiBpcyBhIHByZWZhYlxuICAgICAgICAgICAgICAgIC8vIHRoZSBhc3NldCBpbXBvcnRlciByZWplY3RzLCBhbmQgYGlzVmFsaWQ6IHRydWVgIG9uIHRoYXQgZmlsZSBpcyB0aGUgZmFsc2VcbiAgICAgICAgICAgICAgICAvLyBncmVlbiB0aGlzIGFjdGlvbiBleGlzdGVkIHRvIHByZXZlbnQuXG4gICAgICAgICAgICAgICAgZHVwbGljYXRlQWNjZXNzb3JLZXlzOiB2YWxpZGF0aW9uUmVzdWx0LmR1cGxpY2F0ZUFjY2Vzc29yS2V5cyxcbiAgICAgICAgICAgICAgICB1cmw6IHJlc29sdmVkLnVybCwgZmlsZTogcmVzb2x2ZWQuZmlsZVBhdGgsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkID8gJ1ByZWZhYiBmb3JtYXQgaXMgdmFsaWQnIDogJ1ByZWZhYiBmb3JtYXQgaGFzIGlzc3VlcydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGR1cGxpY2F0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHV1aWQ6IHN0cmluZzsgbmV3TmFtZT86IHN0cmluZzsgdGFyZ2V0RGlyPzogc3RyaW5nIH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBQcmVmYWIgZHVwbGljYXRpb24gcmVxdWlyZXMgY29tcGxleCBzZXJpYWxpemF0aW9uIOKAlCBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHlcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdQcmVmYWIgZHVwbGljYXRpb24gaXMgbm90IGF2YWlsYWJsZSBwcm9ncmFtbWF0aWNhbGx5JyxcbiAgICAgICAgICAgIGluc3RydWN0aW9uOiAnVG8gZHVwbGljYXRlIGEgcHJlZmFiLCB1c2UgdGhlIENvY29zIENyZWF0b3IgZWRpdG9yOlxcbjEuIFNlbGVjdCB0aGUgcHJlZmFiIGluIHRoZSBBc3NldCBCcm93c2VyXFxuMi4gUmlnaHQtY2xpY2sgYW5kIHNlbGVjdCBDb3B5XFxuMy4gUGFzdGUgaW4gdGhlIHRhcmdldCBsb2NhdGlvbidcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlIChhLmsuYS4gcmV2ZXJ0KSBhIHByZWZhYiBpbnN0YW5jZSB0byBpdHMgYXNzZXQgc3RhdGUuXG4gICAgICpcbiAgICAgKiBCYWNrcyBib3RoIGBhY3Rpb249cmVzdG9yZWAgYW5kIGBhY3Rpb249cmV2ZXJ0YC4gQ29jb3MgQ3JlYXRvciAzLjguNyBleHBvc2VzXG4gICAgICogbm8gYHNjZW5lOnJldmVydC1wcmVmYWJgIG1lc3NhZ2UgYXQgYWxsIOKAlCBgcmVzdG9yZS1wcmVmYWJgIGlzIHdoYXQgdGhlIGVkaXRvclxuICAgICAqIGl0c2VsZiB1c2VzIGZvciB0aGUgaW5zcGVjdG9yJ3MgUmV2ZXJ0IGJ1dHRvbiAoIzEzKS4gSXQgdGFrZXMgcG9zaXRpb25hbFxuICAgICAqIGAocm9vdFV1aWQsIGFzc2V0VXVpZClgLCByZXR1cm5zIGEgYm9vbGVhbiwgYW5kIHJlY29yZHMgaXRzIG93biB1bmRvIGVudHJ5LlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQ6IHN0cmluZywgYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnbm9kZVV1aWQgaXMgcmVxdWlyZWQnIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHJvb3RVdWlkID0gY29udGV4dC5yb290VXVpZDtcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkQXNzZXRVdWlkID0gYXNzZXRVdWlkIHx8IGNvbnRleHQuYXNzZXRVdWlkO1xuICAgICAgICAgICAgaWYgKCFyZXNvbHZlZEFzc2V0VXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvdWxkIG5vdCByZXNvbHZlIHRoZSBwcmVmYWIgYXNzZXQgZm9yIG5vZGUgJHtub2RlVXVpZH0uIFBhc3MgYXNzZXRVdWlkIGV4cGxpY2l0bHkuYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXN0b3JlZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ3Jlc3RvcmUtcHJlZmFiJywgcm9vdFV1aWQsIHJlc29sdmVkQXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGlmIChyZXN0b3JlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgcmVzdG9yZS1wcmVmYWIgZm9yIG5vZGUgJHtyb290VXVpZH0uIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgaW5zdGFuY2UgcmVzdG9yZWQgZnJvbSBhc3NldCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcmVzdG9yZSBwcmVmYWIgbm9kZTogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==