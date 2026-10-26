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
                    description: 'Scene Node UUID (for create, update, revert, restore actions). For update/revert/restore this may be any Node inside the prefab instance; the instance root is resolved from it.'
                },
                savePath: {
                    type: 'string',
                    description: 'Asset DB path to save prefab (for create action, e.g. db://assets/prefabs/MyPrefab.prefab)'
                },
                parentUuid: {
                    type: 'string',
                    description: 'Parent Node UUID for the instantiated prefab (for instantiate action, optional)'
                },
                position: {
                    type: 'object',
                    description: 'Initial position {x, y, z} for instantiated prefab, LOCAL to parentUuid (matching manage_node create); relative to the scene root when parentUuid is omitted (optional)',
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
                    description: 'Prefab asset UUID to restore from (for revert and restore actions, optional — resolved from the Node when omitted)'
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
            // `create-node`'s `position` option is applied in WORLD space, but this tool's
            // contract is parent-local (matching manage_node create), so under a transformed
            // parent the instance landed in the wrong place (#148). With no caller parent the
            // instance sits on the scene root, where world == local, and the option is kept.
            // With a caller parent the local position is written after creation instead.
            const applyLocalPosition = !!position && !!parentUuid;
            if (position && !applyLocalPosition) {
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
            if (applyLocalPosition) {
                const positionFailure = await this.applyLocalPosition(uuid, position, prefabUuid);
                if (positionFailure)
                    return positionFailure;
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
    /**
     * Write `position` as the node's LOCAL position and read it back (#148). Returns a
     * failure result — never a silent success — when the write is rejected or the node does
     * not read back at the requested position; the instance already exists in the scene by
     * then, so the failure names it. An unreadable read-back proves nothing either way and
     * is not treated as a failure.
     */
    async applyLocalPosition(uuid, position, prefabUuid) {
        var _a, _b;
        const fail = (reason) => ({
            success: false,
            error: `Prefab '${prefabUuid}' was instantiated as node ${uuid}, but its local position could not be applied: ${reason}`,
            instruction: `The node exists at the parent's origin. Set it with manage_node action=set_transform nodeUuid=${uuid}, or delete it and retry.`
        });
        try {
            await Editor.Message.request('scene', 'set-property', {
                uuid, path: 'position', dump: { value: position, type: 'cc.Vec3' }
            });
        }
        catch (err) {
            return fail((err === null || err === void 0 ? void 0 : err.message) || String(err));
        }
        let applied = null;
        try {
            const dump = await Editor.Message.request('scene', 'query-node', uuid);
            applied = (_b = (_a = dump === null || dump === void 0 ? void 0 : dump.position) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : null;
        }
        catch (_c) {
            return null;
        }
        if (!applied)
            return null;
        const differs = ['x', 'y', 'z'].some(axis => { var _a, _b; return Math.abs(((_a = applied[axis]) !== null && _a !== void 0 ? _a : 0) - ((_b = position[axis]) !== null && _b !== void 0 ? _b : 0)) > 1e-4; });
        return differs
            ? fail(`read back (${applied.x}, ${applied.y}, ${applied.z}) instead of (${position.x}, ${position.y}, ${position.z})`)
            : null;
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
            return { success: false, error: `Failed to query Node ${nodeUuid}: ${err.message}` };
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
                    error: `Editor rejected apply-prefab for Node ${rootUuid}, so its result is not trustworthy and no child nodes were removed. Confirm it is a prefab-instance root with a valid asset link.` +
                        (persisted === true
                            ? ` The rejected apply did rewrite ${prefabPath} — diff it against git before retrying.`
                            : ''),
                    data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted, appliedRejected }
                };
            }
            if (persisted === false) {
                return {
                    success: false,
                    error: `apply-prefab reported no error but ${prefabPath} was not rewritten. The Node may have no overrides to apply, or its prefab link is stale.`,
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
            // Declared void by the editor typings; the runtime can still return false.
            const response = await Editor.Message.request('asset-db', 'reimport-asset', assetUuid);
            imported = response !== false;
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
                    return `Node ${index} has a malformed _children entry`;
                const child = prefabData[childIndex];
                if (!child || child.__type__ !== 'cc.Node')
                    return `Node ${index} lists a non-Node child at ${childIndex}`;
                if (child._parent && child._parent.__id__ !== index) {
                    return `Node ${childIndex} does not point back at parent ${index}`;
                }
            }
            for (const ref of Array.isArray(entry._components) ? entry._components : []) {
                const componentIndex = ref === null || ref === void 0 ? void 0 : ref.__id__;
                if (typeof componentIndex !== 'number')
                    return `Node ${index} has a malformed _components entry`;
                const component = prefabData[componentIndex];
                if (!component)
                    return `Node ${index} lists a missing component at ${componentIndex}`;
                if (component.node && component.node.__id__ !== index) {
                    return `component ${componentIndex} does not point back at Node ${index}`;
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
                return { success: false, error: `Could not resolve the prefab asset for Node ${nodeUuid}. Pass assetUuid explicitly.` };
            }
            const restored = await Editor.Message.request('scene', 'restore-prefab', rootUuid, resolvedAssetUuid);
            if (restored === false) {
                return {
                    success: false,
                    error: `Editor rejected restore-prefab for Node ${rootUuid}. Confirm it is a prefab-instance root with a valid asset link.`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdXNCQUF1c0IsQ0FBQztRQUN0dEIsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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QUM5RCxDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLGtDQUFrQyxLQUFLLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztRQUN4RixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBbG9DRCxvQ0Frb0NDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQsIFByZWZhYkluZm8gfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBub3JtYWxpemVWZWMzIH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcbmltcG9ydCB7IHJlc29sdmVBc3NldCB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LXBhdGgnO1xuaW1wb3J0IHsgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9tYW5hZ2UtcHJlZmFiLWNyZWF0aW9uLXNlcnZpY2UnO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlUHJlZmFiIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHByaXZhdGUgcmVhZG9ubHkgY3JlYXRpb25TZXJ2aWNlID0gbmV3IFByZWZhYkNyZWF0aW9uU2VydmljZSgpO1xuXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJlZmFiJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgcHJlZmFicyBpbiB0aGUgcHJvamVjdC4gQWN0aW9uczogbGlzdD1saXN0IGFsbCBwcmVmYWJzLCBsb2FkPWxvYWQgcHJlZmFiIGJ5IHBhdGgsIGluc3RhbnRpYXRlPWluc3RhbnRpYXRlIHByZWZhYiBpbiBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBwcmVmYWIgZnJvbSBub2RlLCB1cGRhdGU9YXBwbHkgbm9kZSBjaGFuZ2VzIHRvIHRoZSBwcmVmYWIgYXNzZXQgKHZlcmlmaWVzIHRoZSBhc3NldCB3YXMgd3JpdHRlbiwgYW5kIHJlbW92ZXMgY2hpbGRyZW4gZGVsZXRlZCBmcm9tIHRoZSBpbnN0YW5jZSB0aGF0IGFwcGx5LXByZWZhYiBsZWF2ZXMgYmVoaW5kKSwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IHByZWZhYiBkZXRhaWxzLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBhc3NldCAod2l0aCB1bmRvKS4gRm9yIHVwZGF0ZS9yZXZlcnQvcmVzdG9yZSwgbm9kZVV1aWQgbWF5IGJlIGFueSBub2RlIGluIHRoZSBpbnN0YW5jZSDigJQgdGhlIGluc3RhbmNlIHJvb3QgaXMgcmVzb2x2ZWQgYXV0b21hdGljYWxseS4gUHJlcmVxdWlzaXRlczogcHJvamVjdCBtdXN0IGJlIG9wZW4gaW4gQ29jb3MgQ3JlYXRvci4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2xpc3QnLCAnbG9hZCcsICdpbnN0YW50aWF0ZScsICdjcmVhdGUnLCAndXBkYXRlJywgJ3JldmVydCcsICdnZXRfaW5mbycsICd2YWxpZGF0ZScsICdkdXBsaWNhdGUnLCAncmVzdG9yZSddO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2xpc3QnLCAnbG9hZCcsICdpbnN0YW50aWF0ZScsICdjcmVhdGUnLCAndXBkYXRlJywgJ3JldmVydCcsICdnZXRfaW5mbycsICd2YWxpZGF0ZScsICdkdXBsaWNhdGUnLCAncmVzdG9yZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGxpc3Q9bGlzdCBhbGwgcHJlZmFicyBpbiBwcm9qZWN0LCBsb2FkPWxvYWQgcHJlZmFiIGJ5IHV1aWQsIGluc3RhbnRpYXRlPWluc3RhbnRpYXRlIHByZWZhYiBpbiBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBwcmVmYWIgZnJvbSBub2RlLCB1cGRhdGU9YXBwbHkgbm9kZSBjaGFuZ2VzIHRvIGV4aXN0aW5nIHByZWZhYiwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IGRldGFpbGVkIHByZWZhYiBpbmZvLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBwcmVmYWIgYXNzZXQgKGJ1aWx0LWluIHVuZG8pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIChmb3IgbG9hZCwgZ2V0X2luZm8sIHZhbGlkYXRlLCBkdXBsaWNhdGUsIHJlc3RvcmVfbm9kZSBhY3Rpb25zKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcmVmYWJVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCAoZm9yIGluc3RhbnRpYXRlIGFjdGlvbiknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NjZW5lIE5vZGUgVVVJRCAoZm9yIGNyZWF0ZSwgdXBkYXRlLCByZXZlcnQsIHJlc3RvcmUgYWN0aW9ucykuIEZvciB1cGRhdGUvcmV2ZXJ0L3Jlc3RvcmUgdGhpcyBtYXkgYmUgYW55IE5vZGUgaW5zaWRlIHRoZSBwcmVmYWIgaW5zdGFuY2U7IHRoZSBpbnN0YW5jZSByb290IGlzIHJlc29sdmVkIGZyb20gaXQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNhdmVQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCBEQiBwYXRoIHRvIHNhdmUgcHJlZmFiIChmb3IgY3JlYXRlIGFjdGlvbiwgZS5nLiBkYjovL2Fzc2V0cy9wcmVmYWJzL015UHJlZmFiLnByZWZhYiknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFyZW50VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IE5vZGUgVVVJRCBmb3IgdGhlIGluc3RhbnRpYXRlZCBwcmVmYWIgKGZvciBpbnN0YW50aWF0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCBwb3NpdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIsIExPQ0FMIHRvIHBhcmVudFV1aWQgKG1hdGNoaW5nIG1hbmFnZV9ub2RlIGNyZWF0ZSk7IHJlbGF0aXZlIHRvIHRoZSBzY2VuZSByb290IHdoZW4gcGFyZW50VXVpZCBpcyBvbWl0dGVkIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByb3RhdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCByb3RhdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjYWxlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHNjYWxlIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9sZGVyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdGb2xkZXIgdG8gc2VhcmNoIHByZWZhYnMgaW4gKGZvciBsaXN0IGFjdGlvbiwgZGVmYXVsdDogZGI6Ly9hc3NldHMpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGI6Ly9hc3NldHMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbmV3TmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTmV3IHByZWZhYiBuYW1lIChmb3IgZHVwbGljYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRhcmdldERpcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IGRpcmVjdG9yeSBmb3IgZHVwbGljYXRlZCBwcmVmYWIgKGZvciBkdXBsaWNhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXNzZXRVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCB0byByZXN0b3JlIGZyb20gKGZvciByZXZlcnQgYW5kIHJlc3RvcmUgYWN0aW9ucywgb3B0aW9uYWwg4oCUIHJlc29sdmVkIGZyb20gdGhlIE5vZGUgd2hlbiBvbWl0dGVkKSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxpc3QoYXJncyksXG4gICAgICAgIGxvYWQ6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxvYWQoYXJncyksXG4gICAgICAgIGluc3RhbnRpYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVJbnN0YW50aWF0ZShhcmdzKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVDcmVhdGUoYXJncyksXG4gICAgICAgIHVwZGF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlVXBkYXRlKGFyZ3MpLFxuICAgICAgICByZXZlcnQ6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJldmVydChhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmhhbmRsZUdldEluZm8oYXJncyksXG4gICAgICAgIHZhbGlkYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVWYWxpZGF0ZShhcmdzKSxcbiAgICAgICAgZHVwbGljYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVEdXBsaWNhdGUoYXJncyksXG4gICAgICAgIHJlc3RvcmU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJlc3RvcmVOb2RlKGFyZ3MpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxpc3QoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdldFByZWZhYkxpc3QoYXJncy5mb2xkZXIpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBsaXN0IHByZWZhYnMnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxvYWQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubG9hZFByZWZhYkJ5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gbG9hZCBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUluc3RhbnRpYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXByZWZhYlV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgncHJlZmFiVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IG5vcm1hbGl6ZVZlYzMoYXJncy5wb3NpdGlvbik7XG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnJvdGF0aW9uKTtcbiAgICAgICAgY29uc3Qgc2NhbGUgPSBub3JtYWxpemVWZWMzKGFyZ3Muc2NhbGUpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmluc3RhbnRpYXRlUHJlZmFiQnlVdWlkKHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICBjb25zdCBmYWlsdXJlID0gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiJyk7XG4gICAgICAgIGlmIChyZXN1bHQuaW5zdHJ1Y3Rpb24pIGZhaWx1cmUuaW5zdHJ1Y3Rpb24gPSByZXN1bHQuaW5zdHJ1Y3Rpb247XG4gICAgICAgIHJldHVybiBmYWlsdXJlO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlQ3JlYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgc2F2ZVBhdGggfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgaWYgKCFzYXZlUGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KCdzYXZlUGF0aCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCBwcmVmYWJOYW1lID0gc2F2ZVBhdGguc3BsaXQoJy8nKS5wb3AoKT8ucmVwbGFjZSgnLnByZWZhYicsICcnKSB8fCAnTmV3UHJlZmFiJztcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5jcmVhdGVQcmVmYWIoeyBub2RlVXVpZCwgc2F2ZVBhdGgsIHByZWZhYk5hbWUgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVVwZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy51cGRhdGVQcmVmYWIobm9kZVV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byB1cGRhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXZlcnQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBhc3NldFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgLy8gYHJldmVydGAgYW5kIGByZXN0b3JlYCBhcmUgdGhlIHNhbWUgZWRpdG9yIG9wZXJhdGlvbiDigJQgc2VlIHJlc3RvcmVQcmVmYWJOb2RlLlxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byByZXZlcnQgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVHZXRJbmZvKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmdldFByZWZhYkluZm9CeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBwcmVmYWIgaW5mbycpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlVmFsaWRhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMudmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHZhbGlkYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlRHVwbGljYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyB1dWlkLCBuZXdOYW1lLCB0YXJnZXREaXIgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZHVwbGljYXRlUHJlZmFiQnlVdWlkKHsgdXVpZCwgbmV3TmFtZSwgdGFyZ2V0RGlyIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBkdXBsaWNhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVSZXN0b3JlTm9kZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGFzc2V0VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byByZXN0b3JlIHByZWZhYiBub2RlJyk7XG4gICAgfVxuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gUHJpdmF0ZSBpbXBsZW1lbnRhdGlvbiBtZXRob2RzIChwb3J0ZWQgZnJvbSBQcmVmYWJUb29scylcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJlZmFiTGlzdChmb2xkZXI6IHN0cmluZyA9ICdkYjovL2Fzc2V0cycpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGZvbGRlci5lbmRzV2l0aCgnLycpID8gYCR7Zm9sZGVyfSoqLyoucHJlZmFiYCA6IGAke2ZvbGRlcn0vKiovKi5wcmVmYWJgO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0czogYW55W10gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XG4gICAgICAgICAgICBjb25zdCBwcmVmYWJzOiBQcmVmYWJJbmZvW10gPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0Lm5hbWUsIHBhdGg6IGFzc2V0LnVybCwgdXVpZDogYXNzZXQudXVpZCxcbiAgICAgICAgICAgICAgICBmb2xkZXI6IGFzc2V0LnVybC5zdWJzdHJpbmcoMCwgYXNzZXQudXJsLmxhc3RJbmRleE9mKCcvJykpXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBwcmVmYWJzIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIHRoZSBjdXJyZW50IHNjZW5lJ3Mgcm9vdCBub2RlIHV1aWQuXG4gICAgICpcbiAgICAgKiBgc2NlbmU6Y3JlYXRlLW5vZGVgJ3Mgb3duIGRlZmF1bHQtcGFyZW50IGhldXJpc3RpYyBpcyBOT1QgdGhlIHNjZW5lIHJvb3Qg4oCUIG9ic2VydmVkXG4gICAgICogbGl2ZSBpdCBwYXJlbnRzIGEgbmV3IG5vZGUgdW5kZXIgd2hhdGV2ZXIgd2FzIGNyZWF0ZWQgb3Igc2VsZWN0ZWQgbGFzdCwgd2hpY2ggaXMgaG93XG4gICAgICogdGhyZWUgYmFjay10by1iYWNrIGBpbnN0YW50aWF0ZWAgY2FsbHMgd2l0aCBubyBgcGFyZW50VXVpZGAgZW5kZWQgdXAgbmVzdGVkIGluc2lkZVxuICAgICAqIG9uZSBhbm90aGVyIGluc3RlYWQgb2YgYXMgc2NlbmUtcm9vdCBzaWJsaW5ncyAoIzEyMCBpdGVtIDEpLiBSZXNvbHZpbmcgdGhlIHJvb3RcbiAgICAgKiBleHBsaWNpdGx5IGFuZCBwYXNzaW5nIGl0IG1ha2VzIHRoZSBwbGFjZW1lbnQgZGV0ZXJtaW5pc3RpYy5cbiAgICAgKlxuICAgICAqIGBxdWVyeS1ub2RlLXRyZWVgIHdpdGggbm8gYXJndW1lbnQgcmV0dXJucyB0aGUgc2NlbmUncyBub2RlIHRyZWU7IGl0cyByb290IGVudHJ5IG1heVxuICAgICAqIGJlIHRoZSBzY2VuZSBub2RlIGl0c2VsZiBvciBhbiBhcnJheSBvZiB0b3AtbGV2ZWwgbm9kZXMgZGVwZW5kaW5nIG9uIHRoZSBidWlsZCwgc29cbiAgICAgKiBib3RoIHNoYXBlcyBhcmUgYWNjZXB0ZWQuIFJldHVybnMgbnVsbCB3aGVuIHRoZSB0cmVlIGNhbm5vdCBiZSByZWFkIOKAlCB0aGUgY2FsbGVyIHRoZW5cbiAgICAgKiBsZWF2ZXMgYHBhcmVudGAgdW5zZXQgcmF0aGVyIHRoYW4gZ3Vlc3NpbmcsIHNvIGEgZmFpbGVkIGxvb2t1cCBkZWdyYWRlcyB0byB0aGUgb2xkXG4gICAgICogYmVoYXZpb3VyIGluc3RlYWQgb2YgcGFyZW50aW5nIHVuZGVyIHNvbWV0aGluZyBhcmJpdHJhcnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlU2NlbmVSb290VXVpZCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodHJlZSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJlZS5sZW5ndGggPiAwID8gKHRyZWVbMF0udXVpZCB8fCBudWxsKSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdHJlZT8udXVpZCB8fCBudWxsO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRW50ZXIgcHJlZmFiLWVkaXQgbW9kZSBmb3IgYSBwcmVmYWIgYXNzZXQuXG4gICAgICpcbiAgICAgKiBUaGUgcHJldmlvdXMgaW1wbGVtZW50YXRpb24gY2FsbGVkIGBzY2VuZTpsb2FkLWFzc2V0YCwgYSBtZXNzYWdlIHRoYXQgZG9lcyBub3QgZXhpc3RcbiAgICAgKiBpbiBDb2NvcyBDcmVhdG9yIDMuOC43IOKAlCBldmVyeSBjYWxsIHJlamVjdGVkIHdpdGggYE1lc3NhZ2UgZG9lcyBub3QgZXhpc3Q6IHNjZW5lIC1cbiAgICAgKiBsb2FkLWFzc2V0YCwgc28gYGxvYWRgIGNvdWxkIG5ldmVyIHN1Y2NlZWQgYW5kIHRoZSBwcmVmYWItZWRpdCBwYXRoIHRocm91Z2ggdGhpcyB0b29sXG4gICAgICogd2FzIHVucmVhY2hhYmxlICgjMTIwIGl0ZW0gMykuXG4gICAgICpcbiAgICAgKiBUaGVyZSBpcyBubyBgc2NlbmU6YCBtZXNzYWdlIHRoYXQgZW50ZXJzIHByZWZhYi1lZGl0IG1vZGU7IHRoZSBlZGl0b3Igb3BlbnMgdGhlIGFzc2V0XG4gICAgICogaXRzZWxmLiBUaGUgcGF0aCB0aGF0IHdvcmtzIGlzIGBhc3NldC1kYjpxdWVyeS1hc3NldC1pbmZvYCB0byBjb25maXJtIHRoZSB1dWlkIG5hbWVzIGFcbiAgICAgKiBwcmVmYWIsIHRoZW4gYGFzc2V0LWRiOm9wZW4tYXNzZXRgIChhIGRlY2xhcmVkIG1lc3NhZ2UsIGBhc3NldC1kYi9AdHlwZXMvbWVzc2FnZS5kLnRzYClcbiAgICAgKiB0byBoYW5kIHRoZSBhc3NldCB0byB0aGUgZWRpdG9yJ3Mgb3duIGFzc2V0LW9wZW5lciwgd2hpY2ggaXMgd2hhdCB0aGUgQXNzZXQgQnJvd3NlclxuICAgICAqIGRvdWJsZS1jbGljayBkb2VzLiBUaGUgdXVpZCBpcyByZXNvbHZlZCB0byBpdHMgYHVybGAgZmlyc3QgYmVjYXVzZSBgb3Blbi1hc3NldGAgaXNcbiAgICAgKiBkb2N1bWVudGVkIHRvIHRha2UgYSB1cmwuXG4gICAgICpcbiAgICAgKiBDb25maXJtZWQgdG8gYSBsZXZlbCB0aGlzIHJlcG8gY2FuIHJlYWNoOiB0aGUgbWVzc2FnZSBleGlzdHMgaW4gdGhlIGVkaXRvcidzIG93blxuICAgICAqIGRlY2xhcmF0aW9ucyBhbmQgdGhlIHJlc29sdmUtdGhlbi1vcGVuIHNlcXVlbmNlIGlzIHdoYXQgdGhlIGVkaXRvciBVSSBwZXJmb3Jtcy4gVGhlXG4gICAgICogYmVoYXZpb3VyYWwgaGFsZiDigJQgdGhhdCB0aGUgZWRpdG9yIGxhbmRzIGluIHByZWZhYi1lZGl0IG1vZGUg4oCUIGlzIGFzc2VydGVkIHRvIGJlXG4gICAgICogdW52ZXJpZmlhYmxlIHdpdGhvdXQgYSBsaXZlIGVkaXRvciwgYW5kIGlzIGNhbGxlZCBvdXQgYXMgc3VjaCBvbiB0aGUgaXNzdWUgcmF0aGVyXG4gICAgICogdGhhbiBjbGFpbWVkIGhlcmUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBsb2FkUHJlZmFiQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbzogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHV1aWQpLmNhdGNoKCgpID0+IG51bGwpO1xuICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB1dWlkICcke3V1aWR9JyBub3QgZm91bmQgaW4gdGhlIGFzc2V0IERCYCxcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1ZlcmlmeSB0aGUgdXVpZCwgYW5kIHJlZnJlc2ggdGhlIGFzc2V0IERCIChtYW5hZ2VfYXNzZXQgYWN0aW9uPXJlZnJlc2gpIGlmIHRoZSAucHJlZmFiIGZpbGUgd2FzIHdyaXR0ZW4gb3V0c2lkZSB0aGUgZWRpdG9yLidcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBgdHlwZWAgaXMgdGhlIGltcG9ydGVyIHR5cGUg4oCUICdwcmVmYWInIGZvciBhIC5wcmVmYWIgYXNzZXQuIFJlZnVzZSBhIG5vbi1wcmVmYWJcbiAgICAgICAgLy8gcmF0aGVyIHRoYW4gb3BlbmluZywgc2F5LCBhIHRleHR1cmUgYW5kIHJlcG9ydGluZyBhIHByZWZhYiB3YXMgbG9hZGVkLlxuICAgICAgICBpZiAoYXNzZXRJbmZvLnR5cGUgJiYgYXNzZXRJbmZvLnR5cGUgIT09ICdwcmVmYWInKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgQXNzZXQgJyR7YXNzZXRJbmZvLnVybCB8fCB1dWlkfScgaXMgYSAnJHthc3NldEluZm8udHlwZX0nLCBub3QgYSBwcmVmYWJgLFxuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnUGFzcyB0aGUgdXVpZCBvZiBhIC5wcmVmYWIgYXNzZXQgKG1hbmFnZV9wcmVmYWIgYWN0aW9uPWxpc3QgcmV0dXJucyB0aGVtKS4nXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gYXNzZXRJbmZvLnVybCB8fCB1dWlkO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnb3Blbi1hc3NldCcsIHRhcmdldCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgQ291bGQgbm90IG9wZW4gcHJlZmFiICcke3RhcmdldH0nOiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246IGBPcGVuICcke3RhcmdldH0nIGluIHRoZSBDb2NvcyBDcmVhdG9yIEFzc2V0IEJyb3dzZXIgKGRvdWJsZS1jbGljayBpdCkgdG8gZWRpdCB0aGUgcHJlZmFiLmBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICB1dWlkOiBhc3NldEluZm8udXVpZCB8fCB1dWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgICAgIHVybDogdGFyZ2V0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgb3BlbmVkIGZvciBlZGl0aW5nJyxcbiAgICAgICAgICAgICAgICAvLyBQcmVmYWItZWRpdCBtb2RlIGlzIGFuIGVkaXRvci1zaWRlIHN0YXRlLiBUaGlzIHRvb2wgY2FuIGNvbmZpcm0gdGhlIG9wZW5cbiAgICAgICAgICAgICAgICAvLyByZXF1ZXN0IHdhcyBhY2NlcHRlZCwgbm90IHRoYXQgdGhlIGVkaXRvciBzd2l0Y2hlZCBtb2Rlcywgc28gdGhlIGNhbGxlciBpc1xuICAgICAgICAgICAgICAgIC8vIHRvbGQgd2hpY2ggaGFsZiB3YXMgdmVyaWZpZWQgcmF0aGVyIHRoYW4gZ2l2ZW4gYSBiYXJlIHN1Y2Nlc3MuXG4gICAgICAgICAgICAgICAgcHJlZmFiRWRpdE1vZGVWZXJpZmllZDogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGluc3RhbnRpYXRlUHJlZmFiQnlVdWlkKGFyZ3M6IHsgcHJlZmFiVXVpZDogc3RyaW5nOyBwYXJlbnRVdWlkPzogc3RyaW5nOyBwb3NpdGlvbj86IGFueTsgcm90YXRpb24/OiBhbnk7IHNjYWxlPzogYW55IH0pOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkLCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlIH0gPSBhcmdzO1xuXG4gICAgICAgICAgICAvLyBBbiB1bnJlc29sdmFibGUgdXVpZCBtdXN0IGJlIGZhdGFsOiBjcmVhdGUtbm9kZSBzaWxlbnRseSByZXR1cm5zIG5vdGhpbmcgZm9yIGl0LFxuICAgICAgICAgICAgLy8gd2hpY2ggcHJldmlvdXNseSBwcm9kdWNlZCBhIHN1Y2Nlc3MgZW52ZWxvcGUgd2l0aCBubyBub2RlVXVpZCAoIzE1KS5cbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBwcmVmYWJVdWlkKS5jYXRjaCgoKSA9PiBudWxsKTtcbiAgICAgICAgICAgIGlmICghYXNzZXRJbmZvKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgUHJlZmFiIHV1aWQgJyR7cHJlZmFiVXVpZH0nIG5vdCBmb3VuZCBpbiB0aGUgYXNzZXQgREJgLFxuICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1ZlcmlmeSB0aGUgdXVpZCwgYW5kIHJlZnJlc2ggdGhlIGFzc2V0IERCIChtYW5hZ2VfYXNzZXQgYWN0aW9uPXJlZnJlc2gpIGlmIHRoZSAucHJlZmFiIGZpbGUgd2FzIHdyaXR0ZW4gb3V0c2lkZSB0aGUgZWRpdG9yLidcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOb2RlT3B0aW9uczogYW55ID0ge1xuICAgICAgICAgICAgICAgIGFzc2V0VXVpZDogcHJlZmFiVXVpZCxcbiAgICAgICAgICAgICAgICAvLyBgdHlwZWAgc2VsZWN0cyB0aGUgY3JlYXRlTm9kZUZyb21Bc3NldCgpIGJyYW5jaCB0aGF0IGluc3RhbnRpYXRlcyBhXG4gICAgICAgICAgICAgICAgLy8gbGlua2VkIFByZWZhYkluc3RhbmNlLiBXaXRob3V0IGl0LCAzLjguNydzIG5vZGUgbWFuYWdlciBmYWxscyBiYWNrIHRvXG4gICAgICAgICAgICAgICAgLy8gYnVpbGRpbmcgYSBwbGFpbiBub2RlIGZyb20gdGhlIGFzc2V0J3MgcmF3IGR1bXAg4oCUIGEgZmxhdHRlbmVkLFxuICAgICAgICAgICAgICAgIC8vIHVubGlua2VkIGNvcHkgdGhhdCByZXBvcnRzIHN1Y2Nlc3MgYnV0IGNhcnJpZXMgbm8gY2MuUHJlZmFiSW5mbyAoc2VlXG4gICAgICAgICAgICAgICAgLy8gTm9kZU1hbmFnZXIuY3JlYXRlTm9kZUZyb21Bc3NldCBqc2RvYzogXCJvcHRpb25zLnR5cGU6IOi1hOa6kOexu+Wei1wiKS5cbiAgICAgICAgICAgICAgICB0eXBlOiBhc3NldEluZm8udHlwZVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHBhcmVudFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSBwYXJlbnRVdWlkO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBObyBjYWxsZXItc3VwcGxpZWQgcGFyZW50OiBwaW4gdGhlIHBsYWNlbWVudCB0byB0aGUgc2NlbmUgcm9vdC4gTGVhdmluZ1xuICAgICAgICAgICAgICAgIC8vIGBwYXJlbnRgIHVuc2V0IGhhbmRzIHRoZSBkZWNpc2lvbiB0byBgY3JlYXRlLW5vZGVgJ3MgaW1wbGljaXRcbiAgICAgICAgICAgICAgICAvLyBsYXN0LWNyZWF0ZWQvbGFzdC1zZWxlY3RlZCBoZXVyaXN0aWMsIHdoaWNoIG5lc3RzIHVucmVsYXRlZCBpbnN0YW5jZXNcbiAgICAgICAgICAgICAgICAvLyAoIzEyMCBpdGVtIDEpLiBBIG51bGwgcmVzb2x2ZSBsZWF2ZXMgaXQgdW5zZXQg4oCUIHRoZSBvbGQgYmVoYXZpb3VyIOKAlCByYXRoZXJcbiAgICAgICAgICAgICAgICAvLyB0aGFuIHBhcmVudGluZyB1bmRlciBhIGd1ZXNzLlxuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lUm9vdCA9IGF3YWl0IHRoaXMucmVzb2x2ZVNjZW5lUm9vdFV1aWQoKTtcbiAgICAgICAgICAgICAgICBpZiAoc2NlbmVSb290KSBjcmVhdGVOb2RlT3B0aW9ucy5wYXJlbnQgPSBzY2VuZVJvb3Q7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChhc3NldEluZm8gJiYgYXNzZXRJbmZvLm5hbWUpIHtcbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5uYW1lID0gYXNzZXRJbmZvLm5hbWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGBjcmVhdGUtbm9kZWAncyBgcG9zaXRpb25gIG9wdGlvbiBpcyBhcHBsaWVkIGluIFdPUkxEIHNwYWNlLCBidXQgdGhpcyB0b29sJ3NcbiAgICAgICAgICAgIC8vIGNvbnRyYWN0IGlzIHBhcmVudC1sb2NhbCAobWF0Y2hpbmcgbWFuYWdlX25vZGUgY3JlYXRlKSwgc28gdW5kZXIgYSB0cmFuc2Zvcm1lZFxuICAgICAgICAgICAgLy8gcGFyZW50IHRoZSBpbnN0YW5jZSBsYW5kZWQgaW4gdGhlIHdyb25nIHBsYWNlICgjMTQ4KS4gV2l0aCBubyBjYWxsZXIgcGFyZW50IHRoZVxuICAgICAgICAgICAgLy8gaW5zdGFuY2Ugc2l0cyBvbiB0aGUgc2NlbmUgcm9vdCwgd2hlcmUgd29ybGQgPT0gbG9jYWwsIGFuZCB0aGUgb3B0aW9uIGlzIGtlcHQuXG4gICAgICAgICAgICAvLyBXaXRoIGEgY2FsbGVyIHBhcmVudCB0aGUgbG9jYWwgcG9zaXRpb24gaXMgd3JpdHRlbiBhZnRlciBjcmVhdGlvbiBpbnN0ZWFkLlxuICAgICAgICAgICAgY29uc3QgYXBwbHlMb2NhbFBvc2l0aW9uID0gISFwb3NpdGlvbiAmJiAhIXBhcmVudFV1aWQ7XG4gICAgICAgICAgICBpZiAocG9zaXRpb24gJiYgIWFwcGx5TG9jYWxQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIC8vIGBwb3NpdGlvbmAgaXMgYSBkb2N1bWVudGVkIHRvcC1sZXZlbCBDcmVhdGVOb2RlT3B0aW9ucyBmaWVsZDsgYGR1bXBgXG4gICAgICAgICAgICAgICAgLy8gaXMgZXhwbGljaXRseSBjb21tZW50ZWQgb3V0IGFzIHVudXNlZCBpbiBAY29jb3MvY3JlYXRvci10eXBlcyDigJQgaXQgd2FzXG4gICAgICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlZCwgc28gaW5zdGFudGlhdGVkIHByZWZhYnMgbmV2ZXIgcGlja2VkIHVwIHRoaXMgcG9zaXRpb24uXG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZVV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtbm9kZScsIGNyZWF0ZU5vZGVPcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBBcnJheS5pc0FycmF5KG5vZGVVdWlkKSA/IG5vZGVVdWlkWzBdIDogbm9kZVV1aWQ7XG5cbiAgICAgICAgICAgIC8vIE5ldmVyIHJlcG9ydCBzdWNjZXNzIHdpdGhvdXQgYSBub2RlIGlkIOKAlCB0aGUgY2FsbGVyIHdvdWxkIGJ1aWxkIG9uIGEgc2NlbmVcbiAgICAgICAgICAgIC8vIHRoYXQgc2lsZW50bHkgbGFja3MgdGhlIG5vZGUgKCMxNSkuXG4gICAgICAgICAgICBpZiAoIXV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBjcmVhdGUtbm9kZSByZXR1cm5lZCBubyBub2RlIHV1aWQgZm9yIHByZWZhYiAnJHtwcmVmYWJVdWlkfScg4oCUIG5vdGhpbmcgd2FzIGluc3RhbnRpYXRlZGAsXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnRW5zdXJlIGEgc2NlbmUgaXMgb3BlbiBhbmQgdGhlIHByZWZhYiBhc3NldCBpcyB2YWxpZCwgdGhlbiByZXRyeS4nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFwcGx5TG9jYWxQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBvc2l0aW9uRmFpbHVyZSA9IGF3YWl0IHRoaXMuYXBwbHlMb2NhbFBvc2l0aW9uKHV1aWQsIHBvc2l0aW9uLCBwcmVmYWJVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAocG9zaXRpb25GYWlsdXJlKSByZXR1cm4gcG9zaXRpb25GYWlsdXJlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcHBseSByb3RhdGlvbiBhbmQgc2NhbGUgaWYgcHJvdmlkZWRcbiAgICAgICAgICAgIGlmIChyb3RhdGlvbikge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogJ2V1bGVyQW5nbGVzJyxcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcm90YXRpb24sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gey8qIG5vbi1mYXRhbCAqL30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNjYWxlKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnc2NhbGUnLFxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBzY2FsZSwgdHlwZTogJ2NjLlZlYzMnIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7Lyogbm9uLWZhdGFsICovfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIGluc3RhbnRpYXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiOiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdDaGVjayB0aGF0IHRoZSBwcmVmYWJVdWlkIGlzIGNvcnJlY3QgYW5kIHRoZSBhc3NldCBEQiBpcyByZWFkeS4nXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV3JpdGUgYHBvc2l0aW9uYCBhcyB0aGUgbm9kZSdzIExPQ0FMIHBvc2l0aW9uIGFuZCByZWFkIGl0IGJhY2sgKCMxNDgpLiBSZXR1cm5zIGFcbiAgICAgKiBmYWlsdXJlIHJlc3VsdCDigJQgbmV2ZXIgYSBzaWxlbnQgc3VjY2VzcyDigJQgd2hlbiB0aGUgd3JpdGUgaXMgcmVqZWN0ZWQgb3IgdGhlIG5vZGUgZG9lc1xuICAgICAqIG5vdCByZWFkIGJhY2sgYXQgdGhlIHJlcXVlc3RlZCBwb3NpdGlvbjsgdGhlIGluc3RhbmNlIGFscmVhZHkgZXhpc3RzIGluIHRoZSBzY2VuZSBieVxuICAgICAqIHRoZW4sIHNvIHRoZSBmYWlsdXJlIG5hbWVzIGl0LiBBbiB1bnJlYWRhYmxlIHJlYWQtYmFjayBwcm92ZXMgbm90aGluZyBlaXRoZXIgd2F5IGFuZFxuICAgICAqIGlzIG5vdCB0cmVhdGVkIGFzIGEgZmFpbHVyZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGFwcGx5TG9jYWxQb3NpdGlvbihcbiAgICAgICAgdXVpZDogc3RyaW5nLCBwb3NpdGlvbjogeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyIH0sIHByZWZhYlV1aWQ6IHN0cmluZ1xuICAgICk6IFByb21pc2U8YW55IHwgbnVsbD4ge1xuICAgICAgICBjb25zdCBmYWlsID0gKHJlYXNvbjogc3RyaW5nKSA9PiAoe1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogYFByZWZhYiAnJHtwcmVmYWJVdWlkfScgd2FzIGluc3RhbnRpYXRlZCBhcyBub2RlICR7dXVpZH0sIGJ1dCBpdHMgbG9jYWwgcG9zaXRpb24gY291bGQgbm90IGJlIGFwcGxpZWQ6ICR7cmVhc29ufWAsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogYFRoZSBub2RlIGV4aXN0cyBhdCB0aGUgcGFyZW50J3Mgb3JpZ2luLiBTZXQgaXQgd2l0aCBtYW5hZ2Vfbm9kZSBhY3Rpb249c2V0X3RyYW5zZm9ybSBub2RlVXVpZD0ke3V1aWR9LCBvciBkZWxldGUgaXQgYW5kIHJldHJ5LmBcbiAgICAgICAgfSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgdXVpZCwgcGF0aDogJ3Bvc2l0aW9uJywgZHVtcDogeyB2YWx1ZTogcG9zaXRpb24sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWlsKGVycj8ubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGFwcGxpZWQ6IGFueSA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBkdW1wOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgdXVpZCk7XG4gICAgICAgICAgICBhcHBsaWVkID0gZHVtcD8ucG9zaXRpb24/LnZhbHVlID8/IG51bGw7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFhcHBsaWVkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgZGlmZmVycyA9IChbJ3gnLCAneScsICd6J10gYXMgY29uc3QpLnNvbWUoYXhpcyA9PiBNYXRoLmFicygoYXBwbGllZFtheGlzXSA/PyAwKSAtIChwb3NpdGlvbltheGlzXSA/PyAwKSkgPiAxZS00KTtcbiAgICAgICAgcmV0dXJuIGRpZmZlcnNcbiAgICAgICAgICAgID8gZmFpbChgcmVhZCBiYWNrICgke2FwcGxpZWQueH0sICR7YXBwbGllZC55fSwgJHthcHBsaWVkLnp9KSBpbnN0ZWFkIG9mICgke3Bvc2l0aW9uLnh9LCAke3Bvc2l0aW9uLnl9LCAke3Bvc2l0aW9uLnp9KWApXG4gICAgICAgICAgICA6IG51bGw7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVQcmVmYWIoYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGhQYXJhbSA9IGFyZ3MucHJlZmFiUGF0aCB8fCBhcmdzLnNhdmVQYXRoO1xuICAgICAgICAgICAgaWYgKCFwYXRoUGFyYW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdNaXNzaW5nIHByZWZhYiBwYXRoIHBhcmFtZXRlci4gUHJvdmlkZSBzYXZlUGF0aC4nIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYk5hbWUgPSBhcmdzLnByZWZhYk5hbWUgfHwgJ05ld1ByZWZhYic7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGhQYXJhbS5lbmRzV2l0aCgnLnByZWZhYicpID9cbiAgICAgICAgICAgICAgICBwYXRoUGFyYW0gOiBgJHtwYXRoUGFyYW19LyR7cHJlZmFiTmFtZX0ucHJlZmFiYDtcblxuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNoaWxkcmVuID0gYXJncy5pbmNsdWRlQ2hpbGRyZW4gIT09IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNvbXBvbmVudHMgPSBhcmdzLmluY2x1ZGVDb21wb25lbnRzICE9PSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgYXNzZXREYlJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYldpdGhBc3NldERCKFxuICAgICAgICAgICAgICAgIGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lLCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGFzc2V0RGJSZXN1bHQuc3VjY2VzcykgcmV0dXJuIGFzc2V0RGJSZXN1bHQ7XG4gICAgICAgICAgICAvLyBBIGRlZmVjdGl2ZSB3cml0ZSBpcyBhIHJlc3VsdCwgbm90IGFuIHVuYXZhaWxhYmxlIHBhdGgg4oCUIHJldHJ5aW5nIHRocm91Z2hcbiAgICAgICAgICAgIC8vIHRoZSBmYWxsYmFjayBjaGFpbiB3b3VsZCByZS1zZXJpYWxpemUgdGhlIHNhbWUgbG9zcyBhbmQgbWFzayBpdCAoIzI4KS5cbiAgICAgICAgICAgIGlmIChhc3NldERiUmVzdWx0LmZhdGFsKSByZXR1cm4gYXNzZXREYlJlc3VsdDtcblxuICAgICAgICAgICAgY29uc3QgbmF0aXZlUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpO1xuICAgICAgICAgICAgaWYgKG5hdGl2ZVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gbmF0aXZlUmVzdWx0O1xuXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiQ3VzdG9tKGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIGNyZWF0aW5nIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIHRoZSBwcmVmYWItaW5zdGFuY2UgY29udGV4dCBmb3IgYSBub2RlLlxuICAgICAqXG4gICAgICogQ29jb3MgQ3JlYXRvciBkcml2ZXMgYm90aCBwcmVmYWIgbWVzc2FnZXMgZnJvbSB0aGUgbm9kZSBkdW1wJ3MgYF9fcHJlZmFiX19gXG4gICAgICogYmxvY2sg4oCUIGByb290VXVpZGAgKHRoZSBwcmVmYWItaW5zdGFuY2UgUk9PVCwgbm90IHdoaWNoZXZlciBkZXNjZW5kYW50IHRoZVxuICAgICAqIGNhbGxlciBoYXBwZW5lZCB0byBwYXNzKSBhbmQgYHV1aWRgICh0aGUgYmFja2luZyBwcmVmYWIgYXNzZXQpLiBTZWUgMy44LjdcbiAgICAgKiBgcmVzb3VyY2VzLzNkL2VuZ2luZS9lZGl0b3IvaW5zcGVjdG9yL2NvbnRyaWJ1dGlvbnMvbm9kZS5qc2A6XG4gICAgICogICByZXF1ZXN0KCdzY2VuZScsICdhcHBseS1wcmVmYWInLCBwcmVmYWIucm9vdFV1aWQpXG4gICAgICogICByZXF1ZXN0KCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHByZWZhYi5yb290VXVpZCwgcHJlZmFiLnV1aWQpXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgbGV0IG5vZGVEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcXVlcnkgTm9kZSAke25vZGVVdWlkfTogJHtlcnIubWVzc2FnZX1gIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm9kZSBub3QgZm91bmQnIH07XG5cbiAgICAgICAgY29uc3QgcHJlZmFiID0gbm9kZURhdGEuX19wcmVmYWJfXztcbiAgICAgICAgaWYgKCFwcmVmYWIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gaXMgbm90IHBhcnQgb2YgYSBwcmVmYWIgaW5zdGFuY2VgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICByb290VXVpZDogcHJlZmFiLnJvb3RVdWlkIHx8IG5vZGVVdWlkLFxuICAgICAgICAgICAgYXNzZXRVdWlkOiBwcmVmYWIudXVpZCB8fCBwcmVmYWIucHJlZmFiU3RhdGVJbmZvPy5hc3NldFV1aWQsXG4gICAgICAgICAgICBub2RlRGF0YVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYSBwcmVmYWIgYXNzZXQncyBvbi1kaXNrIHBhdGgsIG9yIG51bGwgd2hlbiBpdCBjYW5ub3QgYmUgZGV0ZXJtaW5lZC5cbiAgICAgKlxuICAgICAqIEdvZXMgdGhyb3VnaCBgcXVlcnktYXNzZXQtaW5mb2AsIG5vdCBgcXVlcnktYXNzZXQtbWV0YWA6IHRoZSBtZXRhIHJlY29yZCBoYXMgbm9cbiAgICAgKiBgdXJsYCBmaWVsZCwgc28gdGhlIG9sZCBsb29rdXAgcmVzb2x2ZWQgdG8gbnVsbCBmb3IgZXZlcnkgYXNzZXQgYW5kIGxlZnQgdGhlXG4gICAgICogcG9zdC1hcHBseSB3cml0ZSBjaGVjayBwZXJtYW5lbnRseSBgdW52ZXJpZmllZGAgKCMyNSkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlUHJlZmFiRmlsZVBhdGgoYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgICAgIGlmICghYXNzZXRVdWlkKSByZXR1cm4gbnVsbDtcbiAgICAgICAgcmV0dXJuIChhd2FpdCByZXNvbHZlQXNzZXQoYXNzZXRVdWlkKSkuZmlsZVBhdGg7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0TXRpbWVNcyhmaWxlUGF0aDogc3RyaW5nIHwgbnVsbCk6IG51bWJlciB8IG51bGwge1xuICAgICAgICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBmcy5zdGF0U3luYyhmaWxlUGF0aCkubXRpbWVNcztcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKiBQb2xsIGZvciB0aGUgcHJlZmFiIGZpbGUgdG8gYmUgcmV3cml0dGVuOyBhc3NldC1kYiBtYXkgZmx1c2ggc2hvcnRseSBhZnRlciB0aGUgbWVzc2FnZSByZXNvbHZlcy4gKi9cbiAgICBwcml2YXRlIGFzeW5jIHdhaXRGb3JQcmVmYWJXcml0ZShmaWxlUGF0aDogc3RyaW5nLCBiYXNlbGluZU1zOiBudW1iZXIsIHRpbWVvdXRNcyA9IDIwMDApOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgICAgICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgdGltZW91dE1zO1xuICAgICAgICBsZXQgbXRpbWUgPSB0aGlzLnN0YXRNdGltZU1zKGZpbGVQYXRoKTtcbiAgICAgICAgd2hpbGUgKG10aW1lICE9PSBudWxsICYmIG10aW1lIDw9IGJhc2VsaW5lTXMgJiYgRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTAwKSk7XG4gICAgICAgICAgICBtdGltZSA9IHRoaXMuc3RhdE10aW1lTXMoZmlsZVBhdGgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtdGltZTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHVwZGF0ZVByZWZhYihub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghY29udGV4dC5zdWNjZXNzKSByZXR1cm4gY29udGV4dDtcbiAgICAgICAgICAgIGNvbnN0IHsgcm9vdFV1aWQsIGFzc2V0VXVpZCwgbm9kZURhdGEgfSA9IGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJGaWxlUGF0aChhc3NldFV1aWQpO1xuICAgICAgICAgICAgY29uc3QgbXRpbWVCZWZvcmUgPSB0aGlzLnN0YXRNdGltZU1zKHByZWZhYlBhdGgpO1xuXG4gICAgICAgICAgICAvLyBSZWZ1c2UgQkVGT1JFIHRoZSB3cml0ZTogYXBwbHktcHJlZmFiIHNlcmlhbGl6ZXMgZXZlcnl0aGluZyB1bmRlciB0aGUgcmVzb2x2ZWRcbiAgICAgICAgICAgIC8vIHJvb3QsIHNvIGEgZm9yZWlnbiBpbnN0YW5jZSBuZXN0ZWQgaW4gaXQgd291bGQgYmUgYWJzb3JiZWQgaW50byB0aGlzIGFzc2V0ICgjMTIwKS5cbiAgICAgICAgICAgIGlmIChhc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb3JlaWduID0gYXdhaXQgdGhpcy5maW5kRm9yZWlnblByZWZhYkluc3RhbmNlcyhcbiAgICAgICAgICAgICAgICAgICAgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcm9vdFV1aWQgPT09IG5vZGVVdWlkID8gbm9kZURhdGEgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmIChmb3JlaWduLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBSZWZ1c2luZyB0byBhcHBseSAke3Jvb3RVdWlkfSB0byBwcmVmYWIgJHthc3NldFV1aWR9OiBpdHMgc3VidHJlZSBjb250YWlucyBwcmVmYWIgaW5zdGFuY2UocykgJHtmb3JlaWduLmpvaW4oJywgJyl9IHRoYXQgdGhlIGFzc2V0IGRvZXMgbm90IGFscmVhZHkgcmVmZXJlbmNlLiBBcHBseWluZyB3b3VsZCB3cml0ZSB0aGVpciBjb250ZW50IGludG8gdGhpcyBwcmVmYWIuIE1vdmUgdGhvc2UgaW5zdGFuY2VzIG91dCBmcm9tIHVuZGVyIHRoZSByb290IChtYW5hZ2Vfbm9kZSBhY3Rpb249bW92ZSkgYW5kIHJldHJ5LmAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBmb3JlaWduUHJlZmFiQXNzZXRzOiBmb3JlaWduIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGBzY2VuZTphcHBseS1wcmVmYWJgIHRha2VzIHRoZSBpbnN0YW5jZSByb290IHV1aWQgYXMgYSBQT1NJVElPTkFMIHN0cmluZ1xuICAgICAgICAgICAgLy8gYW5kIHJlc29sdmVzIHRvIGEgYm9vbGVhbi4gVGhlIG9sZCBgeyBub2RlOiB1dWlkIH1gIG9iamVjdCBmb3JtIHJlc29sdmVkXG4gICAgICAgICAgICAvLyB3aXRob3V0IHRocm93aW5nIGJ1dCBuZXZlciB3cm90ZSB0aGUgYXNzZXQg4oCUIGEgc2lsZW50IG5vLW9wIHJlcG9ydGVkIGFzXG4gICAgICAgICAgICAvLyBzdWNjZXNzICgjMTIpLlxuICAgICAgICAgICAgY29uc3QgYXBwbGllZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYicsIHJvb3RVdWlkKTtcblxuICAgICAgICAgICAgLy8gVmVyaWZ5IHRoZSBhc3NldCB3YXMgYWN0dWFsbHkgd3JpdHRlbiByYXRoZXIgdGhhbiB0cnVzdGluZyB0aGUgYm9vbGVhbiB0aGVcbiAgICAgICAgICAgIC8vIG1lc3NhZ2UgcmVzb2x2ZXMgdG8gZWl0aGVyIHdheS4gYHVudmVyaWZpZWRgIG1lYW5zIHRoZSBwYXRoIGNvdWxkIG5vdCBiZVxuICAgICAgICAgICAgLy8gcmVzb2x2ZWQsIG5vdCB0aGF0IHRoZSB3cml0ZSBmYWlsZWQuIFRoaXMgcnVucyBldmVuIHdoZW4gYGFwcGxpZWQgPT09IGZhbHNlYDpcbiAgICAgICAgICAgIC8vIHRoZSBlZGl0b3IgaGFzIGJlZW4gb2JzZXJ2ZWQgcmVzb2x2aW5nIGBmYWxzZWAgb24gc2F2ZXMgdGhhdCBESUQgcmV3cml0ZSB0aGVcbiAgICAgICAgICAgIC8vIGZpbGUgKCM2Mykg4oCUIHRydXN0aW5nIHRoYXQgc2lnbmFsIGFsb25lIHR1cm5zIGEgc3VjY2Vzc2Z1bCB1cGRhdGUgaW50byBhXG4gICAgICAgICAgICAvLyByZXBvcnRlZCBmYWlsdXJlLiBUaGUgbXRpbWUgY2hlY2sgaXMgdGhlIHNvdXJjZSBvZiB0cnV0aDsgYGFwcGxpZWRgIGlzIG9ubHlcbiAgICAgICAgICAgIC8vIGNvbnN1bHRlZCB3aGVuIHRoZSBtdGltZSBjYW5ub3QgY29uZmlybSBvbmUgd2F5IG9yIHRoZSBvdGhlci5cbiAgICAgICAgICAgIGxldCBwZXJzaXN0ZWQ6IGJvb2xlYW4gfCAndW52ZXJpZmllZCcgPSAndW52ZXJpZmllZCc7XG4gICAgICAgICAgICBpZiAocHJlZmFiUGF0aCAhPT0gbnVsbCAmJiBtdGltZUJlZm9yZSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG10aW1lQWZ0ZXIgPSBhd2FpdCB0aGlzLndhaXRGb3JQcmVmYWJXcml0ZShwcmVmYWJQYXRoLCBtdGltZUJlZm9yZSk7XG4gICAgICAgICAgICAgICAgaWYgKG10aW1lQWZ0ZXIgIT09IG51bGwpIHBlcnNpc3RlZCA9IG10aW1lQWZ0ZXIgPiBtdGltZUJlZm9yZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQSByZWplY3RlZCBhcHBseSBpcyBhIEhBUkQgU1RPUCwgd2hhdGV2ZXIgdGhlIG10aW1lIGd1YXJkIHNheXMgKCMxMjgsICMxMjcpLlxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vICM2MyBlc3RhYmxpc2hlZCB0aGF0IGBmYWxzZWAgYWxvbmUgZG9lcyBub3QgbWVhbiB0aGUgd3JpdGUgZmFpbGVkIOKAlCB0aGUgZmlsZSBjYW5cbiAgICAgICAgICAgIC8vIGJlIHJld3JpdHRlbiBhbnl3YXkg4oCUIHNvIHJlamVjdGlvbiB3YXMgZGVtb3RlZCBmcm9tIFwiZmFpbHVyZVwiIHRvIFwidW5jb25maXJtZWRcIlxuICAgICAgICAgICAgLy8gYW5kIHRoZSBtdGltZSBjaGVjayB3YXMgbWFkZSB0aGUgc291cmNlIG9mIHRydXRoLiBUaGF0IGlzIHJpZ2h0IGFib3V0IHRoZSBXUklURVxuICAgICAgICAgICAgLy8gYW5kIHdyb25nIGFib3V0IGV2ZXJ5dGhpbmcgZG93bnN0cmVhbSBvZiBpdDogdGhlIG9ycGhhbiBwYXNzIGJlbG93IHRyZWF0cyB0aGVcbiAgICAgICAgICAgIC8vIGxpdmUgYHF1ZXJ5LW5vZGVgIHdhbGsgYXMgZ3JvdW5kIHRydXRoIGZvciB3aGF0IG1heSBsZWdpdGltYXRlbHkgYmUgZGVsZXRlZCwgYW5kXG4gICAgICAgICAgICAvLyBhIHJlamVjdGVkIGFwcGx5IGlzIHByZWNpc2VseSB0aGUgc2lnbmFsIHRoYXQgaXRzIHZpZXcgb2YgdGhlIGluc3RhbmNlIGNhbm5vdCBiZVxuICAgICAgICAgICAgLy8gdHJ1c3RlZC4gUnVubmluZyB0aGUgcGFzcyBhbnl3YXkgbGV0IGB1cGRhdGVgIGRlbGV0ZSBhIHByZWZhYidzIEVOVElSRSBjaGlsZCBzZXRcbiAgICAgICAgICAgIC8vIHdoaWxlIHJlcG9ydGluZyBgc3VjY2VzczogdHJ1ZWAg4oCUIDggY2hpbGRyZW4gdG8gMCBvbiBkaXNrIGluICMxMjgsIGEgbmVzdGVkXG4gICAgICAgICAgICAvLyBpbnN0YW5jZSdzIHdob2xlIGxvY2FsIG5vZGUgbWlycm9yIGluICMxMjcuXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gTmV2ZXIgdG91Y2ggdGhlIGFzc2V0IGFnYWluIG9uIGEgd3JpdGUgd2Ugd2VyZSB0b2xkIG5vdCB0byB0cnVzdDogbm8gb3JwaGFuXG4gICAgICAgICAgICAvLyBkZXRlY3Rpb24sIG5vIHJlbW92YWwsIG5vIHN1Y2Nlc3MgZW52ZWxvcGUuXG4gICAgICAgICAgICBjb25zdCBhcHBsaWVkUmVqZWN0ZWQgPSBhcHBsaWVkID09PSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKGFwcGxpZWRSZWplY3RlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYEVkaXRvciByZWplY3RlZCBhcHBseS1wcmVmYWIgZm9yIE5vZGUgJHtyb290VXVpZH0sIHNvIGl0cyByZXN1bHQgaXMgbm90IHRydXN0d29ydGh5IGFuZCBubyBjaGlsZCBub2RlcyB3ZXJlIHJlbW92ZWQuIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gICtcbiAgICAgICAgICAgICAgICAgICAgICAgIChwZXJzaXN0ZWQgPT09IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGAgVGhlIHJlamVjdGVkIGFwcGx5IGRpZCByZXdyaXRlICR7cHJlZmFiUGF0aH0g4oCUIGRpZmYgaXQgYWdhaW5zdCBnaXQgYmVmb3JlIHJldHJ5aW5nLmBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6ICcnKSxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkLCBhcHBsaWVkUmVqZWN0ZWQgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwZXJzaXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgYXBwbHktcHJlZmFiIHJlcG9ydGVkIG5vIGVycm9yIGJ1dCAke3ByZWZhYlBhdGh9IHdhcyBub3QgcmV3cml0dGVuLiBUaGUgTm9kZSBtYXkgaGF2ZSBubyBvdmVycmlkZXMgdG8gYXBwbHksIG9yIGl0cyBwcmVmYWIgbGluayBpcyBzdGFsZS5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGBhcHBseS1wcmVmYWJgIHdyaXRlcyBwcm9wZXJ0eSBvdmVycmlkZXMgYnV0IGRvZXMgbm90IHJlbW92ZSBhIGNoaWxkIG5vZGVcbiAgICAgICAgICAgIC8vIGRlbGV0ZWQgZnJvbSB0aGUgaW5zdGFuY2UgKCMyMSkg4oCUIHRoZSBtdGltZSBndWFyZCBhYm92ZSBjYW5ub3Qgc2VlIHRoaXMsXG4gICAgICAgICAgICAvLyBiZWNhdXNlIGEgZGVsZXRpb24gc3RpbGwgcHJvZHVjZXMgb3ZlcnJpZGVzIGVsc2V3aGVyZSwgc28gdGhlIGZpbGUgSVNcbiAgICAgICAgICAgIC8vIHJld3JpdHRlbiBhbmQgYHBlcnNpc3RlZGAgaXMgZ2VudWluZWx5IGB0cnVlYC4gQ29tcGFyZSB0aGUgbGl2ZSBpbnN0YW5jZSdzXG4gICAgICAgICAgICAvLyBmaWxlSWRzIGFnYWluc3QgdGhlIGZyZXNobHktd3JpdHRlbiBhc3NldCdzIHRvIGNhdGNoIHRoZSBzcGVjaWZpYyBmYWlsdXJlXG4gICAgICAgICAgICAvLyBtb2RlIHRoZSBtdGltZSBjaGVjayBjYW5ub3Q6IGEgY2hpbGQgc3RpbGwgcHJlc2VudCBvbiBkaXNrIHRoYXQgbm8gbG9uZ2VyXG4gICAgICAgICAgICAvLyBleGlzdHMgaW4gdGhlIHNjZW5lLiBBbnl0aGluZyBmb3VuZCBpcyB0aGVuIHJlbW92ZWQgZnJvbSB0aGUgYXNzZXQsIHNpbmNlXG4gICAgICAgICAgICAvLyByZXBvcnRpbmcgdGhlIHN0YWxlIGNoaWxkcmVuIGlzIG5vdCB0aGUgc2FtZSBhcyBob25vdXJpbmcgdGhlIGRlbGV0aW9uLlxuICAgICAgICAgICAgbGV0IG9ycGhhbmVkRmlsZUlkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIGlmIChwZXJzaXN0ZWQgPT09IHRydWUgJiYgcHJlZmFiUGF0aCkge1xuICAgICAgICAgICAgICAgIG9ycGhhbmVkRmlsZUlkcyA9IGF3YWl0IHRoaXMuZmluZE9ycGhhbmVkQ2hpbGRGaWxlSWRzKHJvb3RVdWlkLCBwcmVmYWJQYXRoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGxldCByZW1vdmVkRmlsZUlkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIGlmIChvcnBoYW5lZEZpbGVJZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlbW92YWwgPSBhd2FpdCB0aGlzLnJlbW92ZU9ycGhhbmVkQ2hpbGRyZW5Gcm9tQXNzZXQoXG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlBhdGggYXMgc3RyaW5nLCBvcnBoYW5lZEZpbGVJZHMsIHJvb3RVdWlkLCBhc3NldFV1aWRcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIGlmICghcmVtb3ZhbC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVycm9yOiBgYXBwbHktcHJlZmFiIHdyb3RlICR7cHJlZmFiUGF0aH0sIGJ1dCBpdCBzdGlsbCBjb250YWlucyAke29ycGhhbmVkRmlsZUlkcy5sZW5ndGh9IGNoaWxkIG5vZGUocykgKGZpbGVJZDogJHtvcnBoYW5lZEZpbGVJZHMuam9pbignLCAnKX0pIHRoYXQgbm8gbG9uZ2VyIGV4aXN0IGluIHRoZSBzY2VuZSBpbnN0YW5jZS4gQ29jb3MgQ3JlYXRvciAzLjguNydzIGFwcGx5LXByZWZhYiBkb2VzIG5vdCByZW1vdmUgZGVsZXRlZCBjaGlsZHJlbiwgYW5kIHJlbW92aW5nIHRoZW0gaGVyZSB3YXMgZGVjbGluZWQ6ICR7cmVtb3ZhbC5lcnJvcn0uIFRoZSBhc3NldCBpcyBieXRlLWZvci1ieXRlIHVuY2hhbmdlZCDigJQgZGVsZXRlIGFuZCByZWNyZWF0ZSB0aGUgcHJlZmFiLCBvciByZW1vdmUgdGhlIHN0YWxlIGVudHJpZXMgbWFudWFsbHkuYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCwgb3JwaGFuZWRGaWxlSWRzIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVtb3ZlZEZpbGVJZHMgPSBvcnBoYW5lZEZpbGVJZHM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE9ubHkgZXZlciByZWFjaGVkIG9uIGEgTk9OLXJlamVjdGVkIGFwcGx5OiBhIHJlamVjdGlvbiByZXR1cm5zIGFib3ZlLiBLZWVwaW5nXG4gICAgICAgICAgICAvLyBgYXBwbGllZFJlamVjdGVkYCBpbiB0aGUgcGF5bG9hZCAobm93IGFsd2F5cyBmYWxzZSkgcmF0aGVyIHRoYW4gZHJvcHBpbmcgaXQsIHNvXG4gICAgICAgICAgICAvLyBleGlzdGluZyBjYWxsZXJzIHRoYXQgYnJhbmNoIG9uIHRoZSBmaWVsZCBrZWVwIHdvcmtpbmcgdW5jaGFuZ2VkLlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHJlbW92ZWRGaWxlSWRzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICAgICAgPyBgUHJlZmFiIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5OyByZW1vdmVkICR7cmVtb3ZlZEZpbGVJZHMubGVuZ3RofSBjaGlsZCBub2RlKHMpIGFwcGx5LXByZWZhYiBsZWZ0IGJlaGluZGBcbiAgICAgICAgICAgICAgICAgICAgOiAnUHJlZmFiIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQsIGFwcGxpZWRSZWplY3RlZCwgcmVtb3ZlZEZpbGVJZHMgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgZmlsZUlkcyBvZiBwcmVmYWItdHJhY2tlZCBub2RlcyBwcmVzZW50IGluIHRoZSB3cml0dGVuIGFzc2V0IGJ1dCBhYnNlbnRcbiAgICAgKiBmcm9tIHRoZSBsaXZlIHNjZW5lIGluc3RhbmNlIOKAlCBjaGlsZHJlbiBgYXBwbHktcHJlZmFiYCBmYWlsZWQgdG8gcmVtb3ZlICgjMjEpLlxuICAgICAqIERldGVjdGlvbiBpcyBiZXN0LWVmZm9ydDogYW55IGZhaWx1cmUgcmV0dXJucyBubyBvcnBoYW5zIHJhdGhlciB0aGFuIGEgZmFsc2VcbiAgICAgKiBwb3NpdGl2ZSwgc2luY2UgdGhpcyBjaGVjayBtdXN0IG5ldmVyIG1hc2sgYSBnZW51aW5lIHN1Y2Nlc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBmaW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZywgcHJlZmFiUGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbGl2ZUZpbGVJZHMgPSBhd2FpdCB0aGlzLmNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQpO1xuICAgICAgICAgICAgaWYgKGxpdmVGaWxlSWRzLnNpemUgPT09IDApIHJldHVybiBbXTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RGF0YSA9IEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHByZWZhYlBhdGgsICd1dGYtOCcpKTtcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShhc3NldERhdGEpKSByZXR1cm4gW107XG4gICAgICAgICAgICBjb25zdCBhc3NldEZpbGVJZHMgPSB0aGlzLmNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKGFzc2V0RGF0YSk7XG4gICAgICAgICAgICByZXR1cm4gWy4uLmFzc2V0RmlsZUlkc10uZmlsdGVyKGlkID0+ICFsaXZlRmlsZUlkcy5oYXMoaWQpKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogQSBgcXVlcnktbm9kZWAgYGNoaWxkcmVuYCBlbnRyeSBpcyBhIHV1aWQgc3RyaW5nIG9yIGEgcHJvcGVydHkgZHVtcDsgcmV0dXJuIGl0cyB1dWlkIG9yICcnLiAqL1xuICAgIHByaXZhdGUgY2hpbGRVdWlkT2YoZW50cnk6IGFueSk6IHN0cmluZyB7XG4gICAgICAgIGlmICh0eXBlb2YgZW50cnkgPT09ICdzdHJpbmcnKSByZXR1cm4gZW50cnk7XG4gICAgICAgIGlmIChlbnRyeSAmJiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGVudHJ5LnV1aWQgPT09ICdzdHJpbmcnKSByZXR1cm4gZW50cnkudXVpZDtcbiAgICAgICAgICAgIGlmIChlbnRyeS52YWx1ZSAmJiB0eXBlb2YgZW50cnkudmFsdWUudXVpZCA9PT0gJ3N0cmluZycpIHJldHVybiBlbnRyeS52YWx1ZS51dWlkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQcmVmYWIgYXNzZXQgdXVpZHMgZm91bmQgaW4gdGhlIGxpdmUgc3VidHJlZSB1bmRlciBgcm9vdFV1aWRgIHRoYXQgYXJlIG5laXRoZXIgdGhlXG4gICAgICogdGFyZ2V0IGBhc3NldFV1aWRgIG5vciBhbHJlYWR5IHJlZmVyZW5jZWQgYnkgdGhlIHRhcmdldCBhc3NldCBmaWxlICgjMTIwIGl0ZW0gMikuXG4gICAgICpcbiAgICAgKiBgYXBwbHktcHJlZmFiYCBzZXJpYWxpemVzIHRoZSB3aG9sZSByZXNvbHZlZCByb290LiBXaGVuIHVucmVsYXRlZCBpbnN0YW5jZXMgd2VyZSBuZXN0ZWRcbiAgICAgKiB1bmRlciBpdCAodGhlIG9sZCBgaW5zdGFudGlhdGVgIHBhcmVudGluZyBidWcsIG9yIGEgaGFuZC1idWlsdCBoaWVyYXJjaHkpLCBhcHBseWluZ1xuICAgICAqIGFic29yYmVkIFRIRUlSIGNvbnRlbnQgaW50byB0aGUgdGFyZ2V0IGFzc2V0IC0gMzUgbGluZXMgYmVjYW1lIDY0NiwgYW5kIGEgd2hvbGUgc2NlbmVcbiAgICAgKiB3YXMgd3JpdHRlbiBpbnRvIGEgbGVhZiBwcmVmYWIuIEEgbmVzdGVkIGluc3RhbmNlIHRoZSBhc3NldCBhbHJlYWR5IGNhcnJpZXMgaXNcbiAgICAgKiBsZWdpdGltYXRlIGFuZCBoYXMgaXRzIHV1aWQgaW4gdGhlIGZpbGU7IGFuIGluc3RhbmNlIHRoZSBmaWxlIGhhcyBuZXZlciBoZWFyZCBvZiBpc1xuICAgICAqIGZvcmVpZ24uIFRoZSB3YWxrIGZhaWxzIGNsb3NlZCBvbiBhbiB1bnJlYWRhYmxlIGFzc2V0IGZpbGUgKG5vdGhpbmcgaXMgXCJhbHJlYWR5XG4gICAgICogY2FycmllZFwiKSBidXQgbm90IG9uIGFuIHVucXVlcnlhYmxlIG5vZGUgKGl0IG9ubHkgc2VlcyB3aGF0IHRoZSBlZGl0b3Igd2lsbCBzaG93KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGZpbmRGb3JlaWduUHJlZmFiSW5zdGFuY2VzKFxuICAgICAgICByb290VXVpZDogc3RyaW5nLFxuICAgICAgICBhc3NldFV1aWQ6IHN0cmluZyxcbiAgICAgICAgcHJlZmFiUGF0aDogc3RyaW5nIHwgbnVsbCxcbiAgICAgICAgcm9vdER1bXA/OiBhbnlcbiAgICApOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgICAgIGxldCBhc3NldFRleHQgPSAnJztcbiAgICAgICAgaWYgKHByZWZhYlBhdGgpIHtcbiAgICAgICAgICAgIHRyeSB7IGFzc2V0VGV4dCA9IGZzLnJlYWRGaWxlU3luYyhwcmVmYWJQYXRoLCAndXRmLTgnKTsgfSBjYXRjaCB7IGFzc2V0VGV4dCA9ICcnOyB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZm9yZWlnbiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCB2aXNpdCA9IGFzeW5jICh1dWlkOiBzdHJpbmcsIGtub3duPzogYW55KTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICAgICAgICBsZXQgbm9kZURhdGEgPSBrbm93bjtcbiAgICAgICAgICAgIGlmICghbm9kZURhdGEpIHtcbiAgICAgICAgICAgICAgICB0cnkgeyBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTsgfSBjYXRjaCB7IHJldHVybjsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFub2RlRGF0YSB8fCB0eXBlb2Ygbm9kZURhdGEgIT09ICdvYmplY3QnKSByZXR1cm47XG4gICAgICAgICAgICBjb25zdCBuZXN0ZWRBc3NldCA9IG5vZGVEYXRhLl9fcHJlZmFiX18/LnV1aWQ7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG5lc3RlZEFzc2V0ID09PSAnc3RyaW5nJyAmJiBuZXN0ZWRBc3NldCAmJiBuZXN0ZWRBc3NldCAhPT0gYXNzZXRVdWlkICYmICFhc3NldFRleHQuaW5jbHVkZXMobmVzdGVkQXNzZXQpKSB7XG4gICAgICAgICAgICAgICAgZm9yZWlnbi5hZGQobmVzdGVkQXNzZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW46IGFueVtdID0gQXJyYXkuaXNBcnJheShub2RlRGF0YS5jaGlsZHJlbikgPyBub2RlRGF0YS5jaGlsZHJlbiA6IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkVXVpZCA9IHRoaXMuY2hpbGRVdWlkT2YoY2hpbGQpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZFV1aWQpIGF3YWl0IHZpc2l0KGNoaWxkVXVpZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGF3YWl0IHZpc2l0KHJvb3RVdWlkLCByb290RHVtcCk7XG4gICAgICAgIHJldHVybiBbLi4uZm9yZWlnbl07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogV2FsayBhIGxpdmUgcHJlZmFiLWluc3RhbmNlIHN1YnRyZWUgYW5kIGNvbGxlY3QgdGhlIGBfX3ByZWZhYl9fLmZpbGVJZGAgb2YgZXZlcnkgbm9kZS5cbiAgICAgKlxuICAgICAqIGBxdWVyeS1ub2RlYCByZXR1cm5zIGBjaGlsZHJlbmAgYXMgcHJvcGVydHkgZHVtcHMgKGB7IHZhbHVlOiB7IHV1aWQgfSwgdHlwZSB9YCksIG5vdFxuICAgICAqIHV1aWQgc3RyaW5nczsgcGFzc2luZyB0aGUgZHVtcCBvbiBhcyBhIHV1aWQgcmVhY2hlZCBubyBjaGlsZCwgc28gZXZlcnkgbGl2ZSBjaGlsZFxuICAgICAqIGxvb2tlZCBvcnBoYW5lZCBhbmQgd2FzIGRlbGV0ZWQgZnJvbSB0aGUgYXNzZXQuIEFueSBub2RlIHRoYXQgY2Fubm90IGJlIHJlc29sdmVkIG9yXG4gICAgICogY2FycmllcyBubyBmaWxlSWQgbWFrZXMgdGhlIHdhbGsgaW5jb21wbGV0ZSwgYW5kIGFuIGluY29tcGxldGUgd2FsayByZXR1cm5zIGFuIEVNUFRZXG4gICAgICogc2V0IOKAlCB0aGUgY2FsbGVyIHRoZW4gcmVtb3ZlcyBub3RoaW5nIHJhdGhlciB0aGFuIGRlbGV0aW5nIGEgY2hpbGQgaXQgZmFpbGVkIHRvIHNlZS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIGNvbGxlY3RJbnN0YW5jZUZpbGVJZHMocm9vdFV1aWQ6IHN0cmluZyk6IFByb21pc2U8U2V0PHN0cmluZz4+IHtcbiAgICAgICAgY29uc3QgZmlsZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBsZXQgY29tcGxldGUgPSB0cnVlO1xuICAgICAgICBjb25zdCB2aXNpdCA9IGFzeW5jICh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgICAgICAgIGlmICghY29tcGxldGUpIHJldHVybjtcbiAgICAgICAgICAgIGlmICghdXVpZCkgeyBjb21wbGV0ZSA9IGZhbHNlOyByZXR1cm47IH1cbiAgICAgICAgICAgIGxldCBub2RlRGF0YTogYW55O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCB1dWlkKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIGNvbXBsZXRlID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgZmlsZUlkID0gbm9kZURhdGE/Ll9fcHJlZmFiX18/LmZpbGVJZDtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZmlsZUlkICE9PSAnc3RyaW5nJyB8fCAhZmlsZUlkKSB7IGNvbXBsZXRlID0gZmFsc2U7IHJldHVybjsgfVxuICAgICAgICAgICAgZmlsZUlkcy5hZGQoZmlsZUlkKTtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkcmVuOiBhbnlbXSA9IEFycmF5LmlzQXJyYXkobm9kZURhdGEuY2hpbGRyZW4pID8gbm9kZURhdGEuY2hpbGRyZW4gOiBbXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pIGF3YWl0IHZpc2l0KHRoaXMuY2hpbGRVdWlkT2YoY2hpbGQpKTtcbiAgICAgICAgfTtcbiAgICAgICAgYXdhaXQgdmlzaXQocm9vdFV1aWQpO1xuICAgICAgICByZXR1cm4gY29tcGxldGUgPyBmaWxlSWRzIDogbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgfVxuXG4gICAgLyoqIEV4dHJhY3QgZXZlcnkgYGNjLk5vZGVgIGVudHJ5J3MgZmlsZUlkIGZyb20gYSB3cml0dGVuIGAucHJlZmFiYCBhc3NldCdzIEpTT04gYXJyYXkuICovXG4gICAgcHJpdmF0ZSBjb2xsZWN0QXNzZXROb2RlRmlsZUlkcyhwcmVmYWJEYXRhOiBhbnlbXSk6IFNldDxzdHJpbmc+IHtcbiAgICAgICAgY29uc3QgZmlsZUlkcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJlZmFiRGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVJZCA9IHRoaXMuZmlsZUlkT2ZOb2RlKHByZWZhYkRhdGEsIGluZGV4KTtcbiAgICAgICAgICAgIGlmIChmaWxlSWQgIT09IG51bGwpIGZpbGVJZHMuYWRkKGZpbGVJZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZpbGVJZHM7XG4gICAgfVxuXG4gICAgLyoqIFRoZSBmaWxlSWQgcmVjb3JkZWQgb24gdGhlIGBjYy5Ob2RlYCBhdCBgaW5kZXhgLCBvciBudWxsIHdoZW4gaXQgaGFzIG5vbmUuICovXG4gICAgcHJpdmF0ZSBmaWxlSWRPZk5vZGUocHJlZmFiRGF0YTogYW55W10sIGluZGV4OiBudW1iZXIpOiBzdHJpbmcgfCBudWxsIHtcbiAgICAgICAgY29uc3QgZW50cnkgPSBwcmVmYWJEYXRhW2luZGV4XTtcbiAgICAgICAgaWYgKCFlbnRyeSB8fCBlbnRyeS5fX3R5cGVfXyAhPT0gJ2NjLk5vZGUnKSByZXR1cm4gbnVsbDtcbiAgICAgICAgY29uc3QgcHJlZmFiSW5mb0luZGV4ID0gZW50cnkuX3ByZWZhYj8uX19pZF9fO1xuICAgICAgICBpZiAodHlwZW9mIHByZWZhYkluZm9JbmRleCAhPT0gJ251bWJlcicpIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBmaWxlSWQgPSBwcmVmYWJEYXRhW3ByZWZhYkluZm9JbmRleF0/LmZpbGVJZDtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBmaWxlSWQgPT09ICdzdHJpbmcnICYmIGZpbGVJZCA/IGZpbGVJZCA6IG51bGw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVmZXJlbmNlIGFycmF5cyB3aG9zZSBlbGVtZW50IG9yZGVyIGlzIHN0cnVjdHVyYWwg4oCUIGEgcmVtb3ZlZCBlbnRyeSBtdXN0IGJlIHNwbGljZWRcbiAgICAgKiBvdXQgb2YgdGhlbSwgbmV2ZXIgbGVmdCBiZWhpbmQgYXMgYSBudWxsIGhvbGUuXG4gICAgICovXG4gICAgcHJpdmF0ZSByZWFkb25seSBzdHJ1Y3R1cmFsUmVmQXJyYXlzID0gWydfY2hpbGRyZW4nLCAnX2NvbXBvbmVudHMnLCAnbmVzdGVkUHJlZmFiSW5zdGFuY2VSb290cycsICd0YXJnZXRPdmVycmlkZXMnXTtcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSB0aGUgb3JwaGFuZWQgY2hpbGQgc3VidHJlZXMgYGFwcGx5LXByZWZhYmAgbGVmdCBiZWhpbmQsIHRoZW4gaGFuZCB0aGUgcmVzdWx0XG4gICAgICogdG8gdGhlIGVkaXRvciBmb3IgYWNjZXB0YW5jZSAoIzIxKS5cbiAgICAgKlxuICAgICAqIFRocmVlIGdhdGVzIGd1YXJkIHRoZSByZXdyaXRlLCBhbmQgdGhlIHByZS1zdXJnZXJ5IGJ5dGVzIGFyZSByZXN0b3JlZCBhdCBhbnkgb2YgdGhlbTpcbiAgICAgKiB0aGUgZ3JhcGggcmV3cml0ZSByZWZ1c2VzIGEgbGF5b3V0IGl0IGRvZXMgbm90IHJlY29nbmlzZSwgdGhlIHJld3JpdHRlbiBncmFwaCBpc1xuICAgICAqIHZhbGlkYXRlZCBiZWZvcmUgaXQgaXMgd3JpdHRlbiwgYW5kIGBhc3NldC1kYjpyZWltcG9ydC1hc3NldGAgaXMgdGhlIGVuZ2luZSdzIG93blxuICAgICAqIHZlcmRpY3Qgb24gdGhlIHJlc3VsdCDigJQgYW4gaW50ZXJuYWxseSBjb25zaXN0ZW50IGdyYXBoIGNhbiBzdGlsbCBiZSBvbmUgdGhlIGltcG9ydGVyXG4gICAgICogcmVqZWN0cywgYW5kIG9ubHkgdGhlIGVkaXRvciBjYW4gc2F5IHNvLiBBIGRlY2xpbmVkIHJlbW92YWwgbGVhdmVzIHRoZSBjYWxsZXIgZXhhY3RseVxuICAgICAqIHdoZXJlIGl0IHN0b29kIGJlZm9yZSB0aGlzIG1ldGhvZCBleGlzdGVkOiBhIGhhcmQgZmFpbHVyZSBuYW1pbmcgdGhlIHN0YWxlIGZpbGVJZHMuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmVPcnBoYW5lZENoaWxkcmVuRnJvbUFzc2V0KFxuICAgICAgICBwcmVmYWJQYXRoOiBzdHJpbmcsXG4gICAgICAgIG9ycGhhbmVkRmlsZUlkczogc3RyaW5nW10sXG4gICAgICAgIHJvb3RVdWlkOiBzdHJpbmcsXG4gICAgICAgIGFzc2V0VXVpZDogc3RyaW5nXG4gICAgKTogUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0+IHtcbiAgICAgICAgbGV0IG9yaWdpbmFsVGV4dDogc3RyaW5nO1xuICAgICAgICBsZXQgcHJlZmFiRGF0YTogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgb3JpZ2luYWxUZXh0ID0gZnMucmVhZEZpbGVTeW5jKHByZWZhYlBhdGgsICd1dGYtOCcpO1xuICAgICAgICAgICAgcHJlZmFiRGF0YSA9IEpTT04ucGFyc2Uob3JpZ2luYWxUZXh0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYHRoZSBhc3NldCBjb3VsZCBub3QgYmUgcmUtcmVhZCAoJHtlcnIubWVzc2FnZX0pYCB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcmVmYWJEYXRhKSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGFzc2V0IGlzIG5vdCBhIHNlcmlhbGl6ZWQgZW50cnkgYXJyYXknIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBsaXZlRmlsZUlkcyA9IGF3YWl0IHRoaXMuY29sbGVjdEluc3RhbmNlRmlsZUlkcyhyb290VXVpZCk7XG4gICAgICAgIGNvbnN0IGZpbGVJZHNCZWZvcmUgPSB0aGlzLmNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGEpO1xuICAgICAgICBjb25zdCByZXdyaXR0ZW4gPSB0aGlzLnBydW5lT3JwaGFuZWROb2RlcyhwcmVmYWJEYXRhLCBvcnBoYW5lZEZpbGVJZHMsIGxpdmVGaWxlSWRzKTtcbiAgICAgICAgaWYgKCFyZXdyaXR0ZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3RoZSBhc3NldCBncmFwaCBkb2VzIG5vdCBtYXRjaCB0aGUgbGF5b3V0IHRoaXMgcmVtb3ZhbCB1bmRlcnN0YW5kcycgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGludmFsaWQgPSB0aGlzLnZhbGlkYXRlUHJlZmFiR3JhcGgocmV3cml0dGVuLCBvcnBoYW5lZEZpbGVJZHMsIGZpbGVJZHNCZWZvcmUpO1xuICAgICAgICBpZiAoaW52YWxpZCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgdGhlIHJld3JpdHRlbiBncmFwaCBmYWlsZWQgdmFsaWRhdGlvbiAoJHtpbnZhbGlkfSlgIH07XG4gICAgICAgIH1cblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhwcmVmYWJQYXRoLCBKU09OLnN0cmluZ2lmeShyZXdyaXR0ZW4sIG51bGwsIG9yaWdpbmFsVGV4dC5pbmNsdWRlcygnXFxuJykgPyAyIDogMCksICd1dGYtOCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgdGhlIHJld3JpdHRlbiBhc3NldCBjb3VsZCBub3QgYmUgd3JpdHRlbiAoJHtlcnIubWVzc2FnZX0pYCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGltcG9ydGVkOiBib29sZWFuO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gRGVjbGFyZWQgdm9pZCBieSB0aGUgZWRpdG9yIHR5cGluZ3M7IHRoZSBydW50aW1lIGNhbiBzdGlsbCByZXR1cm4gZmFsc2UuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogdW5rbm93biA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0JywgYXNzZXRVdWlkKTtcbiAgICAgICAgICAgIGltcG9ydGVkID0gcmVzcG9uc2UgIT09IGZhbHNlO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIGltcG9ydGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbXBvcnRlZCkge1xuICAgICAgICAgICAgdGhpcy5yZXN0b3JlUHJlZmFiRmlsZShwcmVmYWJQYXRoLCBvcmlnaW5hbFRleHQpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAndGhlIGVkaXRvciByZWplY3RlZCB0aGUgcmV3cml0dGVuIGFzc2V0IG9uIHJlaW1wb3J0JyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3Vydml2b3JzID0gYXdhaXQgdGhpcy5maW5kT3JwaGFuZWRDaGlsZEZpbGVJZHMocm9vdFV1aWQsIHByZWZhYlBhdGgpO1xuICAgICAgICBpZiAoc3Vydml2b3JzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRoaXMucmVzdG9yZVByZWZhYkZpbGUocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYHJlbW92YWwgcmFuIGJ1dCBmaWxlSWQocykgJHtzdXJ2aXZvcnMuam9pbignLCAnKX0gYXJlIHN0aWxsIG9ycGhhbmVkYCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xuICAgIH1cblxuICAgIC8qKiBQdXQgdGhlIHByZS1zdXJnZXJ5IGJ5dGVzIGJhY2ssIHNvIGEgZGVjbGluZWQgcmVtb3ZhbCBsZWF2ZXMgdGhlIGFzc2V0IHVudG91Y2hlZC4gKi9cbiAgICBwcml2YXRlIHJlc3RvcmVQcmVmYWJGaWxlKHByZWZhYlBhdGg6IHN0cmluZywgb3JpZ2luYWxUZXh0OiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZzLndyaXRlRmlsZVN5bmMocHJlZmFiUGF0aCwgb3JpZ2luYWxUZXh0LCAndXRmLTgnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBOb3RoaW5nIGZ1cnRoZXIgdG8gZG8gaGVyZSDigJQgdGhlIGNhbGxlciByZXBvcnRzIHRoZSBmYWlsdXJlIGVpdGhlciB3YXkuXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEcm9wIGV2ZXJ5IG9ycGhhbmVkIGNoaWxkIHN1YnRyZWUgZnJvbSBhIHNlcmlhbGl6ZWQgcHJlZmFiIGFycmF5IGFuZCByZS1pbmRleCB0aGUgd2hvbGVcbiAgICAgKiBncmFwaC4gUmV0dXJucyBudWxsIOKAlCBjaGFuZ2luZyBub3RoaW5nIOKAlCB3aGVuZXZlciB0aGUgZ3JhcGggZG9lcyBub3QgbWF0Y2ggd2hhdCB0aGlzXG4gICAgICogcmV3cml0ZSByZWxpZXMgb24sIHJhdGhlciB0aGFuIHByb2R1Y2luZyBhbiBhc3NldCBub2JvZHkgY2FuIGxvYWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBwcnVuZU9ycGhhbmVkTm9kZXMocHJlZmFiRGF0YTogYW55W10sIG9ycGhhbmVkRmlsZUlkczogc3RyaW5nW10sIGxpdmVGaWxlSWRzOiBTZXQ8c3RyaW5nPik6IGFueVtdIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmRleEJ5RmlsZUlkID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHByZWZhYkRhdGEubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBjb25zdCBmaWxlSWQgPSB0aGlzLmZpbGVJZE9mTm9kZShwcmVmYWJEYXRhLCBpbmRleCk7XG4gICAgICAgICAgICBpZiAoZmlsZUlkICE9PSBudWxsICYmICFub2RlSW5kZXhCeUZpbGVJZC5oYXMoZmlsZUlkKSkgbm9kZUluZGV4QnlGaWxlSWQuc2V0KGZpbGVJZCwgaW5kZXgpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVtb3ZlZCA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuICAgICAgICBjb25zdCBwZW5kaW5nOiBudW1iZXJbXSA9IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiBvcnBoYW5lZEZpbGVJZHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGluZGV4ID0gbm9kZUluZGV4QnlGaWxlSWQuZ2V0KGZpbGVJZCk7XG4gICAgICAgICAgICAvLyBEZXRlY3Rpb24gYW5kIHJlbW92YWwgZGlzYWdyZWUgYWJvdXQgdGhlIGFzc2V0IOKAlCBkbyBub3QgZ3Vlc3MgYXQgdGhlIGdyYXBoLlxuICAgICAgICAgICAgaWYgKGluZGV4ID09PSB1bmRlZmluZWQpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgcGVuZGluZy5wdXNoKGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChwZW5kaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVJbmRleCA9IHBlbmRpbmcuc2hpZnQoKSBhcyBudW1iZXI7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMobm9kZUluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBub2RlID0gcHJlZmFiRGF0YVtub2RlSW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFub2RlIHx8IG5vZGUuX190eXBlX18gIT09ICdjYy5Ob2RlJykgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICByZW1vdmVkLmFkZChub2RlSW5kZXgpO1xuXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJJbmZvSW5kZXggPSBub2RlLl9wcmVmYWI/Ll9faWRfXztcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcHJlZmFiSW5mb0luZGV4ID09PSAnbnVtYmVyJykgcmVtb3ZlZC5hZGQocHJlZmFiSW5mb0luZGV4KTtcblxuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgQXJyYXkuaXNBcnJheShub2RlLl9jb21wb25lbnRzKSA/IG5vZGUuX2NvbXBvbmVudHMgOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjb21wb25lbnRJbmRleCAhPT0gJ251bWJlcicpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIHJlbW92ZWQuYWRkKGNvbXBvbmVudEluZGV4KTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wUHJlZmFiSW5kZXggPSBwcmVmYWJEYXRhW2NvbXBvbmVudEluZGV4XT8uX19wcmVmYWI/Ll9faWRfXztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbXBQcmVmYWJJbmRleCA9PT0gJ251bWJlcicpIHJlbW92ZWQuYWRkKGNvbXBQcmVmYWJJbmRleCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZvciAoY29uc3QgcmVmIG9mIEFycmF5LmlzQXJyYXkobm9kZS5fY2hpbGRyZW4pID8gbm9kZS5fY2hpbGRyZW4gOiBbXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkSW5kZXggPSByZWY/Ll9faWRfXztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkSW5kZXggIT09ICdudW1iZXInKSByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICAvLyBBIGRlc2NlbmRhbnQgb2YgYSBkZWxldGVkIGNoaWxkIGNhbm5vdCBzdGlsbCBiZSBsaXZlIGluIHRoZSBpbnN0YW5jZS4gSWYgb25lXG4gICAgICAgICAgICAgICAgLy8gaXMsIHRoZSBvcnBoYW4gc2V0IGlzIG5vdCB3aGF0IHRoaXMgcmV3cml0ZSBhc3N1bWVzIGFuZCBpdCBtdXN0IG5vdCBwcm9jZWVkLlxuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkRmlsZUlkID0gdGhpcy5maWxlSWRPZk5vZGUocHJlZmFiRGF0YSwgY2hpbGRJbmRleCk7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkRmlsZUlkICE9PSBudWxsICYmIGxpdmVGaWxlSWRzLmhhcyhjaGlsZEZpbGVJZCkpIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIHBlbmRpbmcucHVzaChjaGlsZEluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAocmVtb3ZlZC5zaXplID09PSAwKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCBwcnVuZWQ6IGFueVtdID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShwcmVmYWJEYXRhKSk7XG4gICAgICAgIGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBwcnVuZWQubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgICAgICBpZiAocmVtb3ZlZC5oYXMoaW5kZXgpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJ1bmVkW2luZGV4XTtcbiAgICAgICAgICAgIGlmICghZW50cnkgfHwgdHlwZW9mIGVudHJ5ICE9PSAnb2JqZWN0JykgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGtleSBvZiB0aGlzLnN0cnVjdHVyYWxSZWZBcnJheXMpIHtcbiAgICAgICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoZW50cnlba2V5XSkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGVudHJ5W2tleV0gPSBlbnRyeVtrZXldLmZpbHRlcigoZWxlbWVudDogYW55KSA9PiAhdGhpcy5yZWZlcmVuY2VzUmVtb3ZlZChlbGVtZW50LCByZW1vdmVkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBXaGF0ZXZlciBzdGlsbCBwb2ludHMgYXQgYSByZW1vdmVkIGVudHJ5IGJlY29tZXMgbnVsbCDigJQgdGhpcyBpcyB0aGUgZGFuZ2xpbmdcbiAgICAgICAgLy8gY29tcG9uZW50IHJlZmVyZW5jZSB0aGUgcmVwb3J0IGNhbGxzIG91dCAoYW4gYE9iamVjdFZpZXcudGlja05vZGVgIGJpbmRpbmcgdG8gYVxuICAgICAgICAvLyBjaGlsZCB0aGF0IG5vIGxvbmdlciBleGlzdHMpLlxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJ1bmVkLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgaWYgKHJlbW92ZWQuaGFzKGluZGV4KSkgY29udGludWU7XG4gICAgICAgICAgICBwcnVuZWRbaW5kZXhdID0gdGhpcy5udWxsaWZ5UmVtb3ZlZFJlZnMocHJ1bmVkW2luZGV4XSwgcmVtb3ZlZCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZW1hcCA9IG5ldyBNYXA8bnVtYmVyLCBudW1iZXI+KCk7XG4gICAgICAgIGNvbnN0IHN1cnZpdm9yczogYW55W10gPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHBydW5lZC5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkLmhhcyhpbmRleCkpIGNvbnRpbnVlO1xuICAgICAgICAgICAgcmVtYXAuc2V0KGluZGV4LCBzdXJ2aXZvcnMubGVuZ3RoKTtcbiAgICAgICAgICAgIHN1cnZpdm9ycy5wdXNoKHBydW5lZFtpbmRleF0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdXJ2aXZvcnMubWFwKGVudHJ5ID0+IHRoaXMucmVtYXBSZWZzKGVudHJ5LCByZW1hcCkpO1xuICAgIH1cblxuICAgIC8qKiBUcnVlIHdoZW4gYHZhbHVlYCBpcyDigJQgb3IgY29udGFpbnMg4oCUIGFuIGB7IF9faWRfXyB9YCByZWZlcmVuY2UgdG8gYSByZW1vdmVkIGVudHJ5LiAqL1xuICAgIHByaXZhdGUgcmVmZXJlbmNlc1JlbW92ZWQodmFsdWU6IGFueSwgcmVtb3ZlZDogU2V0PG51bWJlcj4pOiBib29sZWFuIHtcbiAgICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUuX19pZF9fID09PSAnbnVtYmVyJykgcmV0dXJuIHJlbW92ZWQuaGFzKHZhbHVlLl9faWRfXyk7XG4gICAgICAgIHJldHVybiBPYmplY3QudmFsdWVzKHZhbHVlKS5zb21lKG5lc3RlZCA9PiB0aGlzLnJlZmVyZW5jZXNSZW1vdmVkKG5lc3RlZCwgcmVtb3ZlZCkpO1xuICAgIH1cblxuICAgIC8qKiBSZXBsYWNlIGV2ZXJ5IGB7IF9faWRfXyB9YCByZWZlcmVuY2UgdG8gYSByZW1vdmVkIGVudHJ5IHdpdGggbnVsbC4gKi9cbiAgICBwcml2YXRlIG51bGxpZnlSZW1vdmVkUmVmcyh2YWx1ZTogYW55LCByZW1vdmVkOiBTZXQ8bnVtYmVyPik6IGFueSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcChlbGVtZW50ID0+IHRoaXMubnVsbGlmeVJlbW92ZWRSZWZzKGVsZW1lbnQsIHJlbW92ZWQpKTtcbiAgICAgICAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gdmFsdWU7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUuX19pZF9fID09PSAnbnVtYmVyJykgcmV0dXJuIHJlbW92ZWQuaGFzKHZhbHVlLl9faWRfXykgPyBudWxsIDogdmFsdWU7XG4gICAgICAgIGNvbnN0IHJld3JpdHRlbjogYW55ID0ge307XG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgbmVzdGVkXSBvZiBPYmplY3QuZW50cmllcyh2YWx1ZSkpIHJld3JpdHRlbltrZXldID0gdGhpcy5udWxsaWZ5UmVtb3ZlZFJlZnMobmVzdGVkLCByZW1vdmVkKTtcbiAgICAgICAgcmV0dXJuIHJld3JpdHRlbjtcbiAgICB9XG5cbiAgICAvKiogUG9pbnQgZXZlcnkgc3Vydml2aW5nIGBfX2lkX19gIGF0IGl0cyBlbnRyeSdzIHNsb3QgaW4gdGhlIGNvbXBhY3RlZCBhcnJheS4gKi9cbiAgICBwcml2YXRlIHJlbWFwUmVmcyh2YWx1ZTogYW55LCByZW1hcDogTWFwPG51bWJlciwgbnVtYmVyPik6IGFueSB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkgcmV0dXJuIHZhbHVlLm1hcChlbGVtZW50ID0+IHRoaXMucmVtYXBSZWZzKGVsZW1lbnQsIHJlbWFwKSk7XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIHZhbHVlO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlLl9faWRfXyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSByZW1hcC5nZXQodmFsdWUuX19pZF9fKTtcbiAgICAgICAgICAgIHJldHVybiBuZXh0ID09PSB1bmRlZmluZWQgPyBudWxsIDogeyBfX2lkX186IG5leHQgfTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXdyaXR0ZW46IGFueSA9IHt9O1xuICAgICAgICBmb3IgKGNvbnN0IFtrZXksIG5lc3RlZF0gb2YgT2JqZWN0LmVudHJpZXModmFsdWUpKSByZXdyaXR0ZW5ba2V5XSA9IHRoaXMucmVtYXBSZWZzKG5lc3RlZCwgcmVtYXApO1xuICAgICAgICByZXR1cm4gcmV3cml0dGVuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlamVjdCBhIHJld3JpdHRlbiBncmFwaCBiZWZvcmUgaXQgcmVhY2hlcyBkaXNrLiBSZXR1cm5zIHRoZSBmaXJzdCBwcm9ibGVtIGZvdW5kLCBvclxuICAgICAqIG51bGwgd2hlbiB0aGUgZ3JhcGggaXMgc291bmQg4oCUIHRoaXMgaXMgd2hhdCBtYWtlcyBhIG1pcy1pbmRleGVkIGFzc2V0IGltcG9zc2libGUgdG9cbiAgICAgKiB3cml0ZSByYXRoZXIgdGhhbiBzb21ldGhpbmcgdG8gbm90aWNlIGFmdGVyd2FyZHMuXG4gICAgICovXG4gICAgcHJpdmF0ZSB2YWxpZGF0ZVByZWZhYkdyYXBoKHByZWZhYkRhdGE6IGFueVtdLCByZW1vdmVkRmlsZUlkczogc3RyaW5nW10sIGZpbGVJZHNCZWZvcmU6IFNldDxzdHJpbmc+KTogc3RyaW5nIHwgbnVsbCB7XG4gICAgICAgIGNvbnN0IGRhbmdsaW5nID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYocHJlZmFiRGF0YSwgcHJlZmFiRGF0YS5sZW5ndGgpO1xuICAgICAgICBpZiAoZGFuZ2xpbmcgIT09IG51bGwpIHJldHVybiBgX19pZF9fICR7ZGFuZ2xpbmd9IGlzIG91dCBvZiByYW5nZWA7XG5cbiAgICAgICAgLy8gSWRlbnRpdHksIG5vdCBjb3VudDogZXhhY3RseSB0aGUgb3JwaGFucyBnbywgYW5kIG5vdGhpbmcgZWxzZSBkb2VzLlxuICAgICAgICBjb25zdCByZW1haW5pbmcgPSB0aGlzLmNvbGxlY3RBc3NldE5vZGVGaWxlSWRzKHByZWZhYkRhdGEpO1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGVJZCBvZiByZW1vdmVkRmlsZUlkcykge1xuICAgICAgICAgICAgaWYgKHJlbWFpbmluZy5oYXMoZmlsZUlkKSkgcmV0dXJuIGBvcnBoYW5lZCBmaWxlSWQgJHtmaWxlSWR9IHN1cnZpdmVkIHJlbW92YWxgO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZmlsZUlkIG9mIGZpbGVJZHNCZWZvcmUpIHtcbiAgICAgICAgICAgIGlmIChyZW1vdmVkRmlsZUlkcy5pbmNsdWRlcyhmaWxlSWQpKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmICghcmVtYWluaW5nLmhhcyhmaWxlSWQpKSByZXR1cm4gYGZpbGVJZCAke2ZpbGVJZH0gd2FzIHJlbW92ZWQgYnV0IHNob3VsZCBoYXZlIGJlZW4ga2VwdGA7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcHJlZmFiRGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gcHJlZmFiRGF0YVtpbmRleF07XG4gICAgICAgICAgICBpZiAoIWVudHJ5IHx8IGVudHJ5Ll9fdHlwZV9fICE9PSAnY2MuTm9kZScpIGNvbnRpbnVlO1xuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgQXJyYXkuaXNBcnJheShlbnRyeS5fY2hpbGRyZW4pID8gZW50cnkuX2NoaWxkcmVuIDogW10pIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gcmVmPy5fX2lkX187XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjaGlsZEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGBOb2RlICR7aW5kZXh9IGhhcyBhIG1hbGZvcm1lZCBfY2hpbGRyZW4gZW50cnlgO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNoaWxkID0gcHJlZmFiRGF0YVtjaGlsZEluZGV4XTtcbiAgICAgICAgICAgICAgICBpZiAoIWNoaWxkIHx8IGNoaWxkLl9fdHlwZV9fICE9PSAnY2MuTm9kZScpIHJldHVybiBgTm9kZSAke2luZGV4fSBsaXN0cyBhIG5vbi1Ob2RlIGNoaWxkIGF0ICR7Y2hpbGRJbmRleH1gO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZC5fcGFyZW50ICYmIGNoaWxkLl9wYXJlbnQuX19pZF9fICE9PSBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYE5vZGUgJHtjaGlsZEluZGV4fSBkb2VzIG5vdCBwb2ludCBiYWNrIGF0IHBhcmVudCAke2luZGV4fWA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCByZWYgb2YgQXJyYXkuaXNBcnJheShlbnRyeS5fY29tcG9uZW50cykgPyBlbnRyeS5fY29tcG9uZW50cyA6IFtdKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50SW5kZXggPSByZWY/Ll9faWRfXztcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNvbXBvbmVudEluZGV4ICE9PSAnbnVtYmVyJykgcmV0dXJuIGBOb2RlICR7aW5kZXh9IGhhcyBhIG1hbGZvcm1lZCBfY29tcG9uZW50cyBlbnRyeWA7XG4gICAgICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gcHJlZmFiRGF0YVtjb21wb25lbnRJbmRleF07XG4gICAgICAgICAgICAgICAgaWYgKCFjb21wb25lbnQpIHJldHVybiBgTm9kZSAke2luZGV4fSBsaXN0cyBhIG1pc3NpbmcgY29tcG9uZW50IGF0ICR7Y29tcG9uZW50SW5kZXh9YDtcbiAgICAgICAgICAgICAgICBpZiAoY29tcG9uZW50Lm5vZGUgJiYgY29tcG9uZW50Lm5vZGUuX19pZF9fICE9PSBpbmRleCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYGNvbXBvbmVudCAke2NvbXBvbmVudEluZGV4fSBkb2VzIG5vdCBwb2ludCBiYWNrIGF0IE5vZGUgJHtpbmRleH1gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvKiogVGhlIGZpcnN0IGBfX2lkX19gIG91dHNpZGUgYFswLCBsZW5ndGgpYCBhbnl3aGVyZSBpbiB0aGUgZ3JhcGgsIG9yIG51bGwgd2hlbiBhbGwgcmVzb2x2ZS4gKi9cbiAgICBwcml2YXRlIGZpbmREYW5nbGluZ1JlZih2YWx1ZTogYW55LCBsZW5ndGg6IG51bWJlcik6IG51bWJlciB8IG51bGwge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvdW5kID0gdGhpcy5maW5kRGFuZ2xpbmdSZWYoZWxlbWVudCwgbGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBpZiAoZm91bmQgIT09IG51bGwpIHJldHVybiBmb3VuZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0JykgcmV0dXJuIG51bGw7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUuX19pZF9fID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgY29uc3QgaWQgPSB2YWx1ZS5fX2lkX187XG4gICAgICAgICAgICByZXR1cm4gTnVtYmVyLmlzSW50ZWdlcihpZCkgJiYgaWQgPj0gMCAmJiBpZCA8IGxlbmd0aCA/IG51bGwgOiBpZDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IG5lc3RlZCBvZiBPYmplY3QudmFsdWVzKHZhbHVlKSkge1xuICAgICAgICAgICAgY29uc3QgZm91bmQgPSB0aGlzLmZpbmREYW5nbGluZ1JlZihuZXN0ZWQsIGxlbmd0aCk7XG4gICAgICAgICAgICBpZiAoZm91bmQgIT09IG51bGwpIHJldHVybiBmb3VuZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByZWZhYkluZm9CeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gYHF1ZXJ5LWFzc2V0LW1ldGFgIGNhcnJpZXMgbm8gYHVybGAvYG5hbWVgL3RpbWVzdGFtcHMg4oCUIHJlYWRpbmcgdGhlbSBvZmYgdGhlXG4gICAgICAgIC8vIG1ldGEgcmVjb3JkIHByb2R1Y2VkIGFuIGFsbC1lbXB0eSBQcmVmYWJJbmZvIHRoYXQgc3RpbGwgcmVwb3J0ZWQgc3VjY2VzcyAoIzI1KS5cbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlQXNzZXQodXVpZCk7XG4gICAgICAgIGlmIChyZXNvbHZlZC5lcnJvcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiByZXNvbHZlZC5lcnJvciB9O1xuICAgICAgICBpZiAoIXJlc29sdmVkLmluZm8pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByZWZhYiBub3QgZm91bmQ6ICR7dXVpZH1gIH07XG5cbiAgICAgICAgY29uc3QgYXNzZXRJbmZvID0gcmVzb2x2ZWQuaW5mbztcbiAgICAgICAgY29uc3QgdXJsOiBzdHJpbmcgPSBhc3NldEluZm8udXJsIHx8ICcnO1xuICAgICAgICBjb25zdCBzdGF0cyA9IHJlc29sdmVkLmZpbGVQYXRoID8gdGhpcy5zdGF0VGltZXMocmVzb2x2ZWQuZmlsZVBhdGgpIDogbnVsbDtcbiAgICAgICAgY29uc3QgaW5mbzogUHJlZmFiSW5mbyA9IHtcbiAgICAgICAgICAgIG5hbWU6IGFzc2V0SW5mby5uYW1lLFxuICAgICAgICAgICAgdXVpZDogYXNzZXRJbmZvLnV1aWQgfHwgdXVpZCxcbiAgICAgICAgICAgIHBhdGg6IHVybCxcbiAgICAgICAgICAgIGZvbGRlcjogdXJsID8gdXJsLnN1YnN0cmluZygwLCB1cmwubGFzdEluZGV4T2YoJy8nKSkgOiAnJyxcbiAgICAgICAgICAgIGNyZWF0ZVRpbWU6IHN0YXRzPy5jcmVhdGVUaW1lLFxuICAgICAgICAgICAgbW9kaWZ5VGltZTogc3RhdHM/Lm1vZGlmeVRpbWVcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyAuLi5pbmZvLCBmaWxlOiByZXNvbHZlZC5maWxlUGF0aCB9IH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0VGltZXMoZmlsZVBhdGg6IHN0cmluZyk6IHsgY3JlYXRlVGltZTogc3RyaW5nOyBtb2RpZnlUaW1lOiBzdHJpbmcgfSB8IG51bGwge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcyA9IGZzLnN0YXRTeW5jKGZpbGVQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiB7IGNyZWF0ZVRpbWU6IHMuYmlydGh0aW1lLnRvSVNPU3RyaW5nKCksIG1vZGlmeVRpbWU6IHMubXRpbWUudG9JU09TdHJpbmcoKSB9O1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVByZWZhYkJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBFYWNoIHN0YWdlIHJlcG9ydHMgaXRzZWxmLiBUaGUgb2xkIHNpbmdsZSBvdXRlciBjYXRjaCBjb2xsYXBzZWQgZXZlcnkgZmFpbHVyZVxuICAgICAgICAvLyBpbnRvIGBFcnJvciB2YWxpZGF0aW5nIHByZWZhYjogRXJyb3I6IHBhcmFtZXRlciBlcnJvcmAsIHdoaWNoIGhpZCB0aGF0IHRoZVxuICAgICAgICAvLyByZWplY3RlZCBjYWxsIHdhcyBgcXVlcnktcGF0aCgnJylgIOKAlCBgcXVlcnktYXNzZXQtbWV0YWAgbmV2ZXIgcmV0dXJucyBhIGB1cmxgXG4gICAgICAgIC8vIHRvIHJlc29sdmUsIHNvIHRoZSBwYXRoIGxvb2t1cCB3YXMgYWx3YXlzIGhhbmRlZCBhbiBlbXB0eSBzdHJpbmcgKCMyNSkuXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgcmVzb2x2ZUFzc2V0KHV1aWQpO1xuICAgICAgICBpZiAocmVzb2x2ZWQuZXJyb3IpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIHZhbGlkYXRpbmcgcHJlZmFiOiAke3Jlc29sdmVkLmVycm9yfWAgfTtcbiAgICAgICAgaWYgKCFyZXNvbHZlZC5maWxlUGF0aCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ291bGQgbm90IHJlc29sdmUgcHJlZmFiIGZpbGUgcGF0aCBvbiBkaXNrJyB9O1xuXG4gICAgICAgIGxldCBjb250ZW50OiBzdHJpbmc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHJlc29sdmVkLmZpbGVQYXRoLCAndXRmLTgnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHJlYWQgcHJlZmFiIGZpbGU6ICR7ZXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJlZmFiRGF0YTogYW55O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJlZmFiRGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnUHJlZmFiIGZpbGUgZm9ybWF0IGVycm9yOiBjYW5ub3QgcGFyc2UgSlNPTicgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHZhbGlkYXRpb25SZXN1bHQgPSB0aGlzLmNyZWF0aW9uU2VydmljZS52YWxpZGF0ZVByZWZhYkZvcm1hdChwcmVmYWJEYXRhKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgaXNWYWxpZDogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkLCBpc3N1ZXM6IHZhbGlkYXRpb25SZXN1bHQuaXNzdWVzLFxuICAgICAgICAgICAgICAgIG5vZGVDb3VudDogdmFsaWRhdGlvblJlc3VsdC5ub2RlQ291bnQsIGNvbXBvbmVudENvdW50OiB2YWxpZGF0aW9uUmVzdWx0LmNvbXBvbmVudENvdW50LFxuICAgICAgICAgICAgICAgIC8vIE5hbWVkIGV4cGxpY2l0bHkgc28gYSBjYWxsZXIgY2FuIHRlbGwgXCJub3RoaW5nIHdyb25nXCIgZnJvbSBcIm5vdGhpbmcgdGhlcmVcIjpcbiAgICAgICAgICAgICAgICAvLyBpc3N1ZSAjNzMncyBob2xsb3cgcHJlZmFiIHBhc3NlZCB0aGlzIGFjdGlvbiB3aXRoIGBpc1ZhbGlkOiB0cnVlYC5cbiAgICAgICAgICAgICAgICBob2xsb3dDb21wb25lbnRzOiB2YWxpZGF0aW9uUmVzdWx0LmhvbGxvd0NvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgLy8gSXNzdWUgIzExNCBkZWZlY3QgMjogYW4gYWNjZXNzb3Iga2V5IGJlc2lkZSBpdHMgdW5kZXJzY29yZSB0d2luIGlzIGEgcHJlZmFiXG4gICAgICAgICAgICAgICAgLy8gdGhlIGFzc2V0IGltcG9ydGVyIHJlamVjdHMsIGFuZCBgaXNWYWxpZDogdHJ1ZWAgb24gdGhhdCBmaWxlIGlzIHRoZSBmYWxzZVxuICAgICAgICAgICAgICAgIC8vIGdyZWVuIHRoaXMgYWN0aW9uIGV4aXN0ZWQgdG8gcHJldmVudC5cbiAgICAgICAgICAgICAgICBkdXBsaWNhdGVBY2Nlc3NvcktleXM6IHZhbGlkYXRpb25SZXN1bHQuZHVwbGljYXRlQWNjZXNzb3JLZXlzLFxuICAgICAgICAgICAgICAgIHVybDogcmVzb2x2ZWQudXJsLCBmaWxlOiByZXNvbHZlZC5maWxlUGF0aCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiB2YWxpZGF0aW9uUmVzdWx0LmlzVmFsaWQgPyAnUHJlZmFiIGZvcm1hdCBpcyB2YWxpZCcgOiAnUHJlZmFiIGZvcm1hdCBoYXMgaXNzdWVzJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZHVwbGljYXRlUHJlZmFiQnlVdWlkKGFyZ3M6IHsgdXVpZDogc3RyaW5nOyBuZXdOYW1lPzogc3RyaW5nOyB0YXJnZXREaXI/OiBzdHJpbmcgfSk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIFByZWZhYiBkdXBsaWNhdGlvbiByZXF1aXJlcyBjb21wbGV4IHNlcmlhbGl6YXRpb24g4oCUIG5vdCBhdmFpbGFibGUgcHJvZ3JhbW1hdGljYWxseVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogJ1ByZWZhYiBkdXBsaWNhdGlvbiBpcyBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHknLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdUbyBkdXBsaWNhdGUgYSBwcmVmYWIsIHVzZSB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3I6XFxuMS4gU2VsZWN0IHRoZSBwcmVmYWIgaW4gdGhlIEFzc2V0IEJyb3dzZXJcXG4yLiBSaWdodC1jbGljayBhbmQgc2VsZWN0IENvcHlcXG4zLiBQYXN0ZSBpbiB0aGUgdGFyZ2V0IGxvY2F0aW9uJ1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc3RvcmUgKGEuay5hLiByZXZlcnQpIGEgcHJlZmFiIGluc3RhbmNlIHRvIGl0cyBhc3NldCBzdGF0ZS5cbiAgICAgKlxuICAgICAqIEJhY2tzIGJvdGggYGFjdGlvbj1yZXN0b3JlYCBhbmQgYGFjdGlvbj1yZXZlcnRgLiBDb2NvcyBDcmVhdG9yIDMuOC43IGV4cG9zZXNcbiAgICAgKiBubyBgc2NlbmU6cmV2ZXJ0LXByZWZhYmAgbWVzc2FnZSBhdCBhbGwg4oCUIGByZXN0b3JlLXByZWZhYmAgaXMgd2hhdCB0aGUgZWRpdG9yXG4gICAgICogaXRzZWxmIHVzZXMgZm9yIHRoZSBpbnNwZWN0b3IncyBSZXZlcnQgYnV0dG9uICgjMTMpLiBJdCB0YWtlcyBwb3NpdGlvbmFsXG4gICAgICogYChyb290VXVpZCwgYXNzZXRVdWlkKWAsIHJldHVybnMgYSBib29sZWFuLCBhbmQgcmVjb3JkcyBpdHMgb3duIHVuZG8gZW50cnkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZDogc3RyaW5nLCBhc3NldFV1aWQ/OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdub2RlVXVpZCBpcyByZXF1aXJlZCcgfTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghY29udGV4dC5zdWNjZXNzKSByZXR1cm4gY29udGV4dDtcblxuICAgICAgICAgICAgY29uc3Qgcm9vdFV1aWQgPSBjb250ZXh0LnJvb3RVdWlkO1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRBc3NldFV1aWQgPSBhc3NldFV1aWQgfHwgY29udGV4dC5hc3NldFV1aWQ7XG4gICAgICAgICAgICBpZiAoIXJlc29sdmVkQXNzZXRVdWlkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ291bGQgbm90IHJlc29sdmUgdGhlIHByZWZhYiBhc3NldCBmb3IgTm9kZSAke25vZGVVdWlkfS4gUGFzcyBhc3NldFV1aWQgZXhwbGljaXRseS5gIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3RvcmVkID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCByb290VXVpZCwgcmVzb2x2ZWRBc3NldFV1aWQpO1xuICAgICAgICAgICAgaWYgKHJlc3RvcmVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYEVkaXRvciByZWplY3RlZCByZXN0b3JlLXByZWZhYiBmb3IgTm9kZSAke3Jvb3RVdWlkfS4gQ29uZmlybSBpdCBpcyBhIHByZWZhYi1pbnN0YW5jZSByb290IHdpdGggYSB2YWxpZCBhc3NldCBsaW5rLmAsXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQ6IHJlc29sdmVkQXNzZXRVdWlkIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQ6IHJlc29sdmVkQXNzZXRVdWlkIH0sXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZhYiBpbnN0YW5jZSByZXN0b3JlZCBmcm9tIGFzc2V0IHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZXN0b3JlIHByZWZhYiBub2RlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xuICAgICAgICB9XG4gICAgfVxufVxuIl19