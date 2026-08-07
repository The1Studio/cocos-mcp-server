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
        this.description = 'Manage prefabs in the project. Actions: list=list all prefabs, load=load prefab by path, instantiate=instantiate prefab in scene, create=create prefab from node, update=apply node changes to the prefab asset (verifies the asset was written), revert=revert prefab instance to the asset state (alias of restore), get_info=get prefab details, validate=validate prefab file format, duplicate=duplicate a prefab, restore=restore prefab node using asset (with undo). For update/revert/restore, nodeUuid may be any node in the instance — the instance root is resolved automatically. Prerequisites: project must be open in Cocos Creator.';
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
            return {
                success: true,
                message: 'Prefab updated successfully',
                data: { nodeUuid, rootUuid, assetUuid, prefabPath, persisted }
            };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxvREFBbUQ7QUFDbkQscUZBQXlFO0FBRXpFLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNxQixvQkFBZSxHQUFHLElBQUksc0RBQXFCLEVBQUUsQ0FBQztRQUV0RCxTQUFJLEdBQUcsZUFBZSxDQUFDO1FBQ3ZCLGdCQUFXLEdBQUcsdW5CQUF1bkIsQ0FBQztRQUN0b0IsWUFBTyxHQUFHLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFFeEgsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsU0FBUyxDQUFDO29CQUNuSCxXQUFXLEVBQUUsa2JBQWtiO2lCQUNsYztnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1GQUFtRjtpQkFDbkc7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0Q0FBNEM7aUJBQzVEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJ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SUFDTCxDQUFDO0NBQ0o7QUF4aUJELG9DQXdpQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCwgUHJlZmFiSW5mbyB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IG5vcm1hbGl6ZVZlYzMgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQgeyBQcmVmYWJDcmVhdGlvblNlcnZpY2UgfSBmcm9tICcuL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZSc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VQcmVmYWIgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBjcmVhdGlvblNlcnZpY2UgPSBuZXcgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlKCk7XG5cbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9wcmVmYWInO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBwcmVmYWJzIGluIHRoZSBwcm9qZWN0LiBBY3Rpb25zOiBsaXN0PWxpc3QgYWxsIHByZWZhYnMsIGxvYWQ9bG9hZCBwcmVmYWIgYnkgcGF0aCwgaW5zdGFudGlhdGU9aW5zdGFudGlhdGUgcHJlZmFiIGluIHNjZW5lLCBjcmVhdGU9Y3JlYXRlIHByZWZhYiBmcm9tIG5vZGUsIHVwZGF0ZT1hcHBseSBub2RlIGNoYW5nZXMgdG8gdGhlIHByZWZhYiBhc3NldCAodmVyaWZpZXMgdGhlIGFzc2V0IHdhcyB3cml0dGVuKSwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IHByZWZhYiBkZXRhaWxzLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBhc3NldCAod2l0aCB1bmRvKS4gRm9yIHVwZGF0ZS9yZXZlcnQvcmVzdG9yZSwgbm9kZVV1aWQgbWF5IGJlIGFueSBub2RlIGluIHRoZSBpbnN0YW5jZSDigJQgdGhlIGluc3RhbmNlIHJvb3QgaXMgcmVzb2x2ZWQgYXV0b21hdGljYWxseS4gUHJlcmVxdWlzaXRlczogcHJvamVjdCBtdXN0IGJlIG9wZW4gaW4gQ29jb3MgQ3JlYXRvci4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2xpc3QnLCAnbG9hZCcsICdpbnN0YW50aWF0ZScsICdjcmVhdGUnLCAndXBkYXRlJywgJ3JldmVydCcsICdnZXRfaW5mbycsICd2YWxpZGF0ZScsICdkdXBsaWNhdGUnLCAncmVzdG9yZSddO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2xpc3QnLCAnbG9hZCcsICdpbnN0YW50aWF0ZScsICdjcmVhdGUnLCAndXBkYXRlJywgJ3JldmVydCcsICdnZXRfaW5mbycsICd2YWxpZGF0ZScsICdkdXBsaWNhdGUnLCAncmVzdG9yZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGxpc3Q9bGlzdCBhbGwgcHJlZmFicyBpbiBwcm9qZWN0LCBsb2FkPWxvYWQgcHJlZmFiIGJ5IHV1aWQsIGluc3RhbnRpYXRlPWluc3RhbnRpYXRlIHByZWZhYiBpbiBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBwcmVmYWIgZnJvbSBub2RlLCB1cGRhdGU9YXBwbHkgbm9kZSBjaGFuZ2VzIHRvIGV4aXN0aW5nIHByZWZhYiwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IGRldGFpbGVkIHByZWZhYiBpbmZvLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBwcmVmYWIgYXNzZXQgKGJ1aWx0LWluIHVuZG8pJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIChmb3IgbG9hZCwgZ2V0X2luZm8sIHZhbGlkYXRlLCBkdXBsaWNhdGUsIHJlc3RvcmVfbm9kZSBhY3Rpb25zKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcmVmYWJVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdQcmVmYWIgYXNzZXQgVVVJRCAoZm9yIGluc3RhbnRpYXRlIGFjdGlvbiknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NjZW5lIG5vZGUgVVVJRCAoZm9yIGNyZWF0ZSwgdXBkYXRlLCByZXZlcnQsIHJlc3RvcmUgYWN0aW9ucykuIEZvciB1cGRhdGUvcmV2ZXJ0L3Jlc3RvcmUgdGhpcyBtYXkgYmUgYW55IG5vZGUgaW5zaWRlIHRoZSBwcmVmYWIgaW5zdGFuY2U7IHRoZSBpbnN0YW5jZSByb290IGlzIHJlc29sdmVkIGZyb20gaXQuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNhdmVQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBc3NldCBEQiBwYXRoIHRvIHNhdmUgcHJlZmFiIChmb3IgY3JlYXRlIGFjdGlvbiwgZS5nLiBkYjovL2Fzc2V0cy9wcmVmYWJzL015UHJlZmFiLnByZWZhYiknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFyZW50VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUGFyZW50IG5vZGUgVVVJRCBmb3IgdGhlIGluc3RhbnRpYXRlZCBwcmVmYWIgKGZvciBpbnN0YW50aWF0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwb3NpdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCBwb3NpdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJvdGF0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHJvdGF0aW9uIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NhbGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgc2NhbGUge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBmb2xkZXI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZvbGRlciB0byBzZWFyY2ggcHJlZmFicyBpbiAoZm9yIGxpc3QgYWN0aW9uLCBkZWZhdWx0OiBkYjovL2Fzc2V0cyknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdkYjovL2Fzc2V0cydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuZXdOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdOZXcgcHJlZmFiIG5hbWUgKGZvciBkdXBsaWNhdGUgYWN0aW9uLCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdGFyZ2V0RGlyOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgZGlyZWN0b3J5IGZvciBkdXBsaWNhdGVkIHByZWZhYiAoZm9yIGR1cGxpY2F0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhc3NldFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZWZhYiBhc3NldCBVVUlEIHRvIHJlc3RvcmUgZnJvbSAoZm9yIHJldmVydCBhbmQgcmVzdG9yZSBhY3Rpb25zLCBvcHRpb25hbCDigJQgcmVzb2x2ZWQgZnJvbSB0aGUgbm9kZSB3aGVuIG9taXR0ZWQpJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlTGlzdChhcmdzKSxcbiAgICAgICAgbG9hZDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlTG9hZChhcmdzKSxcbiAgICAgICAgaW5zdGFudGlhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUluc3RhbnRpYXRlKGFyZ3MpLFxuICAgICAgICBjcmVhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUNyZWF0ZShhcmdzKSxcbiAgICAgICAgdXBkYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVVcGRhdGUoYXJncyksXG4gICAgICAgIHJldmVydDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlUmV2ZXJ0KGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuaGFuZGxlR2V0SW5mbyhhcmdzKSxcbiAgICAgICAgdmFsaWRhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVZhbGlkYXRlKGFyZ3MpLFxuICAgICAgICBkdXBsaWNhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUR1cGxpY2F0ZShhcmdzKSxcbiAgICAgICAgcmVzdG9yZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlUmVzdG9yZU5vZGUoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTGlzdChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0UHJlZmFiTGlzdChhcmdzLmZvbGRlcik7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGxpc3QgcHJlZmFicycpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTG9hZChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5sb2FkUHJlZmFiQnlVdWlkKHV1aWQpO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBsb2FkIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlSW5zdGFudGlhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghcHJlZmFiVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcmVmYWJVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnBvc2l0aW9uKTtcbiAgICAgICAgY29uc3Qgcm90YXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3Mucm90YXRpb24pO1xuICAgICAgICBjb25zdCBzY2FsZSA9IG5vcm1hbGl6ZVZlYzMoYXJncy5zY2FsZSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGVQcmVmYWJCeVV1aWQoeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkLCBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlIH0pO1xuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IGZhaWx1cmUgPSBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBpbnN0YW50aWF0ZSBwcmVmYWInKTtcbiAgICAgICAgaWYgKHJlc3VsdC5pbnN0cnVjdGlvbikgZmFpbHVyZS5pbnN0cnVjdGlvbiA9IHJlc3VsdC5pbnN0cnVjdGlvbjtcbiAgICAgICAgcmV0dXJuIGZhaWx1cmU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVDcmVhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBzYXZlUGF0aCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBpZiAoIXNhdmVQYXRoKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3NhdmVQYXRoIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHByZWZhYk5hbWUgPSBzYXZlUGF0aC5zcGxpdCgnLycpLnBvcCgpPy5yZXBsYWNlKCcucHJlZmFiJywgJycpIHx8ICdOZXdQcmVmYWInO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0ZVByZWZhYih7IG5vZGVVdWlkLCBzYXZlUGF0aCwgcHJlZmFiTmFtZSB9KTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gY3JlYXRlIHByZWZhYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlVXBkYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnVwZGF0ZVByZWZhYihub2RlVXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHVwZGF0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJldmVydChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGFzc2V0VXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xuICAgICAgICAvLyBgcmV2ZXJ0YCBhbmQgYHJlc3RvcmVgIGFyZSB0aGUgc2FtZSBlZGl0b3Igb3BlcmF0aW9uIOKAlCBzZWUgcmVzdG9yZVByZWZhYk5vZGUuXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQsIGFzc2V0VXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHJldmVydCBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUdldEluZm8oYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQgfSA9IGFyZ3M7XG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0UHJlZmFiSW5mb0J5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gZ2V0IHByZWZhYiBpbmZvJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVWYWxpZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy52YWxpZGF0ZVByZWZhYkJ5VXVpZCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gdmFsaWRhdGUgcHJlZmFiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVEdXBsaWNhdGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCB7IHV1aWQsIG5ld05hbWUsIHRhcmdldERpciB9ID0gYXJncztcbiAgICAgICAgaWYgKCF1dWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3V1aWQgaXMgcmVxdWlyZWQnKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kdXBsaWNhdGVQcmVmYWJCeVV1aWQoeyB1dWlkLCBuZXdOYW1lLCB0YXJnZXREaXIgfSk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGR1cGxpY2F0ZSBwcmVmYWInKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVJlc3RvcmVOb2RlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgYXNzZXRVdWlkIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVzdG9yZVByZWZhYk5vZGUobm9kZVV1aWQsIGFzc2V0VXVpZCk7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHJlc3RvcmUgcHJlZmFiIG5vZGUnKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBQcml2YXRlIGltcGxlbWVudGF0aW9uIG1ldGhvZHMgKHBvcnRlZCBmcm9tIFByZWZhYlRvb2xzKVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcmVmYWJMaXN0KGZvbGRlcjogc3RyaW5nID0gJ2RiOi8vYXNzZXRzJyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gZm9sZGVyLmVuZHNXaXRoKCcvJykgPyBgJHtmb2xkZXJ9KiovKi5wcmVmYWJgIDogYCR7Zm9sZGVyfS8qKi8qLnByZWZhYmA7XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzOiBhbnlbXSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYnM6IFByZWZhYkluZm9bXSA9IHJlc3VsdHMubWFwKGFzc2V0ID0+ICh7XG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSwgcGF0aDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLFxuICAgICAgICAgICAgICAgIGZvbGRlcjogYXNzZXQudXJsLnN1YnN0cmluZygwLCBhc3NldC51cmwubGFzdEluZGV4T2YoJy8nKSlcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHByZWZhYnMgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbG9hZFByZWZhYkJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHJlZmFiRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnbG9hZC1hc3NldCcsIHsgdXVpZCB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogcHJlZmFiRGF0YS51dWlkLCBuYW1lOiBwcmVmYWJEYXRhLm5hbWUsIG1lc3NhZ2U6ICdQcmVmYWIgbG9hZGVkIHN1Y2Nlc3NmdWxseScgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnIubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbnN0YW50aWF0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHByZWZhYlV1aWQ6IHN0cmluZzsgcGFyZW50VXVpZD86IHN0cmluZzsgcG9zaXRpb24/OiBhbnk7IHJvdGF0aW9uPzogYW55OyBzY2FsZT86IGFueSB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgcHJlZmFiVXVpZCwgcGFyZW50VXVpZCwgcG9zaXRpb24sIHJvdGF0aW9uLCBzY2FsZSB9ID0gYXJncztcblxuICAgICAgICAgICAgLy8gQW4gdW5yZXNvbHZhYmxlIHV1aWQgbXVzdCBiZSBmYXRhbDogY3JlYXRlLW5vZGUgc2lsZW50bHkgcmV0dXJucyBub3RoaW5nIGZvciBpdCxcbiAgICAgICAgICAgIC8vIHdoaWNoIHByZXZpb3VzbHkgcHJvZHVjZWQgYSBzdWNjZXNzIGVudmVsb3BlIHdpdGggbm8gbm9kZVV1aWQgKCMxNSkuXG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgcHJlZmFiVXVpZCkuY2F0Y2goKCkgPT4gbnVsbCk7XG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYFByZWZhYiB1dWlkICcke3ByZWZhYlV1aWR9JyBub3QgZm91bmQgaW4gdGhlIGFzc2V0IERCYCxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdWZXJpZnkgdGhlIHV1aWQsIGFuZCByZWZyZXNoIHRoZSBhc3NldCBEQiAobWFuYWdlX2Fzc2V0IGFjdGlvbj1yZWZyZXNoKSBpZiB0aGUgLnByZWZhYiBmaWxlIHdhcyB3cml0dGVuIG91dHNpZGUgdGhlIGVkaXRvci4nXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY3JlYXRlTm9kZU9wdGlvbnM6IGFueSA9IHtcbiAgICAgICAgICAgICAgICBhc3NldFV1aWQ6IHByZWZhYlV1aWQsXG4gICAgICAgICAgICAgICAgLy8gYHR5cGVgIHNlbGVjdHMgdGhlIGNyZWF0ZU5vZGVGcm9tQXNzZXQoKSBicmFuY2ggdGhhdCBpbnN0YW50aWF0ZXMgYVxuICAgICAgICAgICAgICAgIC8vIGxpbmtlZCBQcmVmYWJJbnN0YW5jZS4gV2l0aG91dCBpdCwgMy44LjcncyBub2RlIG1hbmFnZXIgZmFsbHMgYmFjayB0b1xuICAgICAgICAgICAgICAgIC8vIGJ1aWxkaW5nIGEgcGxhaW4gbm9kZSBmcm9tIHRoZSBhc3NldCdzIHJhdyBkdW1wIOKAlCBhIGZsYXR0ZW5lZCxcbiAgICAgICAgICAgICAgICAvLyB1bmxpbmtlZCBjb3B5IHRoYXQgcmVwb3J0cyBzdWNjZXNzIGJ1dCBjYXJyaWVzIG5vIGNjLlByZWZhYkluZm8gKHNlZVxuICAgICAgICAgICAgICAgIC8vIE5vZGVNYW5hZ2VyLmNyZWF0ZU5vZGVGcm9tQXNzZXQganNkb2M6IFwib3B0aW9ucy50eXBlOiDotYTmupDnsbvlnotcIikuXG4gICAgICAgICAgICAgICAgdHlwZTogYXNzZXRJbmZvLnR5cGVcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucGFyZW50ID0gcGFyZW50VXVpZDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKGFzc2V0SW5mbyAmJiBhc3NldEluZm8ubmFtZSkge1xuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLm5hbWUgPSBhc3NldEluZm8ubmFtZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgLy8gYHBvc2l0aW9uYCBpcyBhIGRvY3VtZW50ZWQgdG9wLWxldmVsIENyZWF0ZU5vZGVPcHRpb25zIGZpZWxkOyBgZHVtcGBcbiAgICAgICAgICAgICAgICAvLyBpcyBleHBsaWNpdGx5IGNvbW1lbnRlZCBvdXQgYXMgdW51c2VkIGluIEBjb2Nvcy9jcmVhdG9yLXR5cGVzIOKAlCBpdCB3YXNcbiAgICAgICAgICAgICAgICAvLyBzaWxlbnRseSBpZ25vcmVkLCBzbyBpbnN0YW50aWF0ZWQgcHJlZmFicyBuZXZlciBwaWNrZWQgdXAgdGhpcyBwb3NpdGlvbi5cbiAgICAgICAgICAgICAgICBjcmVhdGVOb2RlT3B0aW9ucy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlVXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2NyZWF0ZS1ub2RlJywgY3JlYXRlTm9kZU9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgdXVpZCA9IEFycmF5LmlzQXJyYXkobm9kZVV1aWQpID8gbm9kZVV1aWRbMF0gOiBub2RlVXVpZDtcblxuICAgICAgICAgICAgLy8gTmV2ZXIgcmVwb3J0IHN1Y2Nlc3Mgd2l0aG91dCBhIG5vZGUgaWQg4oCUIHRoZSBjYWxsZXIgd291bGQgYnVpbGQgb24gYSBzY2VuZVxuICAgICAgICAgICAgLy8gdGhhdCBzaWxlbnRseSBsYWNrcyB0aGUgbm9kZSAoIzE1KS5cbiAgICAgICAgICAgIGlmICghdXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYGNyZWF0ZS1ub2RlIHJldHVybmVkIG5vIG5vZGUgdXVpZCBmb3IgcHJlZmFiICcke3ByZWZhYlV1aWR9JyDigJQgbm90aGluZyB3YXMgaW5zdGFudGlhdGVkYCxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdFbnN1cmUgYSBzY2VuZSBpcyBvcGVuIGFuZCB0aGUgcHJlZmFiIGFzc2V0IGlzIHZhbGlkLCB0aGVuIHJldHJ5LidcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBBcHBseSByb3RhdGlvbiBhbmQgc2NhbGUgaWYgcHJvdmlkZWRcbiAgICAgICAgICAgIGlmIChyb3RhdGlvbikge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZCxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogJ2V1bGVyQW5nbGVzJyxcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcm90YXRpb24sIHR5cGU6ICdjYy5WZWMzJyB9XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gey8qIG5vbi1mYXRhbCAqL30pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNjYWxlKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xuICAgICAgICAgICAgICAgICAgICB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnc2NhbGUnLFxuICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBzY2FsZSwgdHlwZTogJ2NjLlZlYzMnIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7Lyogbm9uLWZhdGFsICovfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLFxuICAgICAgICAgICAgICAgICAgICBwcmVmYWJVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgICAgICAgICAgICAgcm90YXRpb24sXG4gICAgICAgICAgICAgICAgICAgIHNjYWxlLFxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIGluc3RhbnRpYXRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiOiAke2Vyci5tZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdDaGVjayB0aGF0IHRoZSBwcmVmYWJVdWlkIGlzIGNvcnJlY3QgYW5kIHRoZSBhc3NldCBEQiBpcyByZWFkeS4nXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVQcmVmYWIoYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdGhQYXJhbSA9IGFyZ3MucHJlZmFiUGF0aCB8fCBhcmdzLnNhdmVQYXRoO1xuICAgICAgICAgICAgaWYgKCFwYXRoUGFyYW0pIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdNaXNzaW5nIHByZWZhYiBwYXRoIHBhcmFtZXRlci4gUHJvdmlkZSBzYXZlUGF0aC4nIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYk5hbWUgPSBhcmdzLnByZWZhYk5hbWUgfHwgJ05ld1ByZWZhYic7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGhQYXJhbS5lbmRzV2l0aCgnLnByZWZhYicpID9cbiAgICAgICAgICAgICAgICBwYXRoUGFyYW0gOiBgJHtwYXRoUGFyYW19LyR7cHJlZmFiTmFtZX0ucHJlZmFiYDtcblxuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNoaWxkcmVuID0gYXJncy5pbmNsdWRlQ2hpbGRyZW4gIT09IGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNvbXBvbmVudHMgPSBhcmdzLmluY2x1ZGVDb21wb25lbnRzICE9PSBmYWxzZTtcblxuICAgICAgICAgICAgY29uc3QgYXNzZXREYlJlc3VsdCA9IGF3YWl0IHRoaXMuY3JlYXRpb25TZXJ2aWNlLmNyZWF0ZVByZWZhYldpdGhBc3NldERCKFxuICAgICAgICAgICAgICAgIGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lLCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKGFzc2V0RGJSZXN1bHQuc3VjY2VzcykgcmV0dXJuIGFzc2V0RGJSZXN1bHQ7XG4gICAgICAgICAgICAvLyBBIGRlZmVjdGl2ZSB3cml0ZSBpcyBhIHJlc3VsdCwgbm90IGFuIHVuYXZhaWxhYmxlIHBhdGgg4oCUIHJldHJ5aW5nIHRocm91Z2hcbiAgICAgICAgICAgIC8vIHRoZSBmYWxsYmFjayBjaGFpbiB3b3VsZCByZS1zZXJpYWxpemUgdGhlIHNhbWUgbG9zcyBhbmQgbWFzayBpdCAoIzI4KS5cbiAgICAgICAgICAgIGlmIChhc3NldERiUmVzdWx0LmZhdGFsKSByZXR1cm4gYXNzZXREYlJlc3VsdDtcblxuICAgICAgICAgICAgY29uc3QgbmF0aXZlUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpO1xuICAgICAgICAgICAgaWYgKG5hdGl2ZVJlc3VsdC5zdWNjZXNzKSByZXR1cm4gbmF0aXZlUmVzdWx0O1xuXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiQ3VzdG9tKGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEVycm9yIGNyZWF0aW5nIHByZWZhYjogJHtlcnJvcn1gIH07XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIHRoZSBwcmVmYWItaW5zdGFuY2UgY29udGV4dCBmb3IgYSBub2RlLlxuICAgICAqXG4gICAgICogQ29jb3MgQ3JlYXRvciBkcml2ZXMgYm90aCBwcmVmYWIgbWVzc2FnZXMgZnJvbSB0aGUgbm9kZSBkdW1wJ3MgYF9fcHJlZmFiX19gXG4gICAgICogYmxvY2sg4oCUIGByb290VXVpZGAgKHRoZSBwcmVmYWItaW5zdGFuY2UgUk9PVCwgbm90IHdoaWNoZXZlciBkZXNjZW5kYW50IHRoZVxuICAgICAqIGNhbGxlciBoYXBwZW5lZCB0byBwYXNzKSBhbmQgYHV1aWRgICh0aGUgYmFja2luZyBwcmVmYWIgYXNzZXQpLiBTZWUgMy44LjdcbiAgICAgKiBgcmVzb3VyY2VzLzNkL2VuZ2luZS9lZGl0b3IvaW5zcGVjdG9yL2NvbnRyaWJ1dGlvbnMvbm9kZS5qc2A6XG4gICAgICogICByZXF1ZXN0KCdzY2VuZScsICdhcHBseS1wcmVmYWInLCBwcmVmYWIucm9vdFV1aWQpXG4gICAgICogICByZXF1ZXN0KCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHByZWZhYi5yb290VXVpZCwgcHJlZmFiLnV1aWQpXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgbGV0IG5vZGVEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBub2RlRGF0YSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcXVlcnkgbm9kZSAke25vZGVVdWlkfTogJHtlcnIubWVzc2FnZX1gIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFub2RlRGF0YSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm9kZSBub3QgZm91bmQnIH07XG5cbiAgICAgICAgY29uc3QgcHJlZmFiID0gbm9kZURhdGEuX19wcmVmYWJfXztcbiAgICAgICAgaWYgKCFwcmVmYWIpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gaXMgbm90IHBhcnQgb2YgYSBwcmVmYWIgaW5zdGFuY2VgIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICByb290VXVpZDogcHJlZmFiLnJvb3RVdWlkIHx8IG5vZGVVdWlkLFxuICAgICAgICAgICAgYXNzZXRVdWlkOiBwcmVmYWIudXVpZCB8fCBwcmVmYWIucHJlZmFiU3RhdGVJbmZvPy5hc3NldFV1aWRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIGEgcHJlZmFiIGFzc2V0J3Mgb24tZGlzayBwYXRoLCBvciBudWxsIHdoZW4gaXQgY2Fubm90IGJlIGRldGVybWluZWQuXG4gICAgICpcbiAgICAgKiBHb2VzIHRocm91Z2ggYHF1ZXJ5LWFzc2V0LWluZm9gLCBub3QgYHF1ZXJ5LWFzc2V0LW1ldGFgOiB0aGUgbWV0YSByZWNvcmQgaGFzIG5vXG4gICAgICogYHVybGAgZmllbGQsIHNvIHRoZSBvbGQgbG9va3VwIHJlc29sdmVkIHRvIG51bGwgZm9yIGV2ZXJ5IGFzc2V0IGFuZCBsZWZ0IHRoZVxuICAgICAqIHBvc3QtYXBwbHkgd3JpdGUgY2hlY2sgcGVybWFuZW50bHkgYHVudmVyaWZpZWRgICgjMjUpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZVByZWZhYkZpbGVQYXRoKGFzc2V0VXVpZD86IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIWFzc2V0VXVpZCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiAoYXdhaXQgcmVzb2x2ZUFzc2V0KGFzc2V0VXVpZCkpLmZpbGVQYXRoO1xuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdE10aW1lTXMoZmlsZVBhdGg6IHN0cmluZyB8IG51bGwpOiBudW1iZXIgfCBudWxsIHtcbiAgICAgICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZnMuc3RhdFN5bmMoZmlsZVBhdGgpLm10aW1lTXM7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKiogUG9sbCBmb3IgdGhlIHByZWZhYiBmaWxlIHRvIGJlIHJld3JpdHRlbjsgYXNzZXQtZGIgbWF5IGZsdXNoIHNob3J0bHkgYWZ0ZXIgdGhlIG1lc3NhZ2UgcmVzb2x2ZXMuICovXG4gICAgcHJpdmF0ZSBhc3luYyB3YWl0Rm9yUHJlZmFiV3JpdGUoZmlsZVBhdGg6IHN0cmluZywgYmFzZWxpbmVNczogbnVtYmVyLCB0aW1lb3V0TXMgPSAyMDAwKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgICAgIGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIHRpbWVvdXRNcztcbiAgICAgICAgbGV0IG10aW1lID0gdGhpcy5zdGF0TXRpbWVNcyhmaWxlUGF0aCk7XG4gICAgICAgIHdoaWxlIChtdGltZSAhPT0gbnVsbCAmJiBtdGltZSA8PSBiYXNlbGluZU1zICYmIERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMCkpO1xuICAgICAgICAgICAgbXRpbWUgPSB0aGlzLnN0YXRNdGltZU1zKGZpbGVQYXRoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbXRpbWU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB1cGRhdGVQcmVmYWIobm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiQ29udGV4dChub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XG4gICAgICAgICAgICBjb25zdCB7IHJvb3RVdWlkLCBhc3NldFV1aWQgfSA9IGNvbnRleHQ7XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZhYlBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJGaWxlUGF0aChhc3NldFV1aWQpO1xuICAgICAgICAgICAgY29uc3QgbXRpbWVCZWZvcmUgPSB0aGlzLnN0YXRNdGltZU1zKHByZWZhYlBhdGgpO1xuXG4gICAgICAgICAgICAvLyBgc2NlbmU6YXBwbHktcHJlZmFiYCB0YWtlcyB0aGUgaW5zdGFuY2Ugcm9vdCB1dWlkIGFzIGEgUE9TSVRJT05BTCBzdHJpbmdcbiAgICAgICAgICAgIC8vIGFuZCByZXNvbHZlcyB0byBhIGJvb2xlYW4uIFRoZSBvbGQgYHsgbm9kZTogdXVpZCB9YCBvYmplY3QgZm9ybSByZXNvbHZlZFxuICAgICAgICAgICAgLy8gd2l0aG91dCB0aHJvd2luZyBidXQgbmV2ZXIgd3JvdGUgdGhlIGFzc2V0IOKAlCBhIHNpbGVudCBuby1vcCByZXBvcnRlZCBhc1xuICAgICAgICAgICAgLy8gc3VjY2VzcyAoIzEyKS5cbiAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdhcHBseS1wcmVmYWInLCByb290VXVpZCk7XG4gICAgICAgICAgICBpZiAoYXBwbGllZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgYXBwbHktcHJlZmFiIGZvciBub2RlICR7cm9vdFV1aWR9LiBDb25maXJtIGl0IGlzIGEgcHJlZmFiLWluc3RhbmNlIHJvb3Qgd2l0aCBhIHZhbGlkIGFzc2V0IGxpbmsuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gVmVyaWZ5IHRoZSBhc3NldCB3YXMgYWN0dWFsbHkgd3JpdHRlbiByYXRoZXIgdGhhbiB0cnVzdGluZyBhIG5vbi10aHJvd2luZ1xuICAgICAgICAgICAgLy8gbWVzc2FnZS4gYHVudmVyaWZpZWRgIG1lYW5zIHRoZSBwYXRoIGNvdWxkIG5vdCBiZSByZXNvbHZlZCwgbm90IHRoYXQgdGhlXG4gICAgICAgICAgICAvLyB3cml0ZSBmYWlsZWQuXG4gICAgICAgICAgICBsZXQgcGVyc2lzdGVkOiBib29sZWFuIHwgJ3VudmVyaWZpZWQnID0gJ3VudmVyaWZpZWQnO1xuICAgICAgICAgICAgaWYgKHByZWZhYlBhdGggIT09IG51bGwgJiYgbXRpbWVCZWZvcmUgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtdGltZUFmdGVyID0gYXdhaXQgdGhpcy53YWl0Rm9yUHJlZmFiV3JpdGUocHJlZmFiUGF0aCwgbXRpbWVCZWZvcmUpO1xuICAgICAgICAgICAgICAgIGlmIChtdGltZUFmdGVyICE9PSBudWxsKSBwZXJzaXN0ZWQgPSBtdGltZUFmdGVyID4gbXRpbWVCZWZvcmU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChwZXJzaXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgYXBwbHktcHJlZmFiIHJlcG9ydGVkIG5vIGVycm9yIGJ1dCAke3ByZWZhYlBhdGh9IHdhcyBub3QgcmV3cml0dGVuLiBUaGUgbm9kZSBtYXkgaGF2ZSBubyBvdmVycmlkZXMgdG8gYXBwbHksIG9yIGl0cyBwcmVmYWIgbGluayBpcyBzdGFsZS5gLFxuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkLCBwcmVmYWJQYXRoLCBwZXJzaXN0ZWQgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJlZmFiSW5mb0J5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuICAgICAgICAvLyBgcXVlcnktYXNzZXQtbWV0YWAgY2FycmllcyBubyBgdXJsYC9gbmFtZWAvdGltZXN0YW1wcyDigJQgcmVhZGluZyB0aGVtIG9mZiB0aGVcbiAgICAgICAgLy8gbWV0YSByZWNvcmQgcHJvZHVjZWQgYW4gYWxsLWVtcHR5IFByZWZhYkluZm8gdGhhdCBzdGlsbCByZXBvcnRlZCBzdWNjZXNzICgjMjUpLlxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBc3NldCh1dWlkKTtcbiAgICAgICAgaWYgKHJlc29sdmVkLmVycm9yKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IHJlc29sdmVkLmVycm9yIH07XG4gICAgICAgIGlmICghcmVzb2x2ZWQuaW5mbykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgUHJlZmFiIG5vdCBmb3VuZDogJHt1dWlkfWAgfTtcblxuICAgICAgICBjb25zdCBhc3NldEluZm8gPSByZXNvbHZlZC5pbmZvO1xuICAgICAgICBjb25zdCB1cmw6IHN0cmluZyA9IGFzc2V0SW5mby51cmwgfHwgJyc7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gcmVzb2x2ZWQuZmlsZVBhdGggPyB0aGlzLnN0YXRUaW1lcyhyZXNvbHZlZC5maWxlUGF0aCkgOiBudWxsO1xuICAgICAgICBjb25zdCBpbmZvOiBQcmVmYWJJbmZvID0ge1xuICAgICAgICAgICAgbmFtZTogYXNzZXRJbmZvLm5hbWUsXG4gICAgICAgICAgICB1dWlkOiBhc3NldEluZm8udXVpZCB8fCB1dWlkLFxuICAgICAgICAgICAgcGF0aDogdXJsLFxuICAgICAgICAgICAgZm9sZGVyOiB1cmwgPyB1cmwuc3Vic3RyaW5nKDAsIHVybC5sYXN0SW5kZXhPZignLycpKSA6ICcnLFxuICAgICAgICAgICAgY3JlYXRlVGltZTogc3RhdHM/LmNyZWF0ZVRpbWUsXG4gICAgICAgICAgICBtb2RpZnlUaW1lOiBzdGF0cz8ubW9kaWZ5VGltZVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IC4uLmluZm8sIGZpbGU6IHJlc29sdmVkLmZpbGVQYXRoIH0gfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRUaW1lcyhmaWxlUGF0aDogc3RyaW5nKTogeyBjcmVhdGVUaW1lOiBzdHJpbmc7IG1vZGlmeVRpbWU6IHN0cmluZyB9IHwgbnVsbCB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzID0gZnMuc3RhdFN5bmMoZmlsZVBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgY3JlYXRlVGltZTogcy5iaXJ0aHRpbWUudG9JU09TdHJpbmcoKSwgbW9kaWZ5VGltZTogcy5tdGltZS50b0lTT1N0cmluZygpIH07XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHZhbGlkYXRlUHJlZmFiQnlVdWlkKHV1aWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIC8vIEVhY2ggc3RhZ2UgcmVwb3J0cyBpdHNlbGYuIFRoZSBvbGQgc2luZ2xlIG91dGVyIGNhdGNoIGNvbGxhcHNlZCBldmVyeSBmYWlsdXJlXG4gICAgICAgIC8vIGludG8gYEVycm9yIHZhbGlkYXRpbmcgcHJlZmFiOiBFcnJvcjogcGFyYW1ldGVyIGVycm9yYCwgd2hpY2ggaGlkIHRoYXQgdGhlXG4gICAgICAgIC8vIHJlamVjdGVkIGNhbGwgd2FzIGBxdWVyeS1wYXRoKCcnKWAg4oCUIGBxdWVyeS1hc3NldC1tZXRhYCBuZXZlciByZXR1cm5zIGEgYHVybGBcbiAgICAgICAgLy8gdG8gcmVzb2x2ZSwgc28gdGhlIHBhdGggbG9va3VwIHdhcyBhbHdheXMgaGFuZGVkIGFuIGVtcHR5IHN0cmluZyAoIzI1KS5cbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlQXNzZXQodXVpZCk7XG4gICAgICAgIGlmIChyZXNvbHZlZC5lcnJvcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRXJyb3IgdmFsaWRhdGluZyBwcmVmYWI6ICR7cmVzb2x2ZWQuZXJyb3J9YCB9O1xuICAgICAgICBpZiAoIXJlc29sdmVkLmZpbGVQYXRoKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDb3VsZCBub3QgcmVzb2x2ZSBwcmVmYWIgZmlsZSBwYXRoIG9uIGRpc2snIH07XG5cbiAgICAgICAgbGV0IGNvbnRlbnQ6IHN0cmluZztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMocmVzb2x2ZWQuZmlsZVBhdGgsICd1dGYtOCcpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcmVhZCBwcmVmYWIgZmlsZTogJHtlcnJvci5tZXNzYWdlfWAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBwcmVmYWJEYXRhOiBhbnk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBwcmVmYWJEYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQcmVmYWIgZmlsZSBmb3JtYXQgZXJyb3I6IGNhbm5vdCBwYXJzZSBKU09OJyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgdmFsaWRhdGlvblJlc3VsdCA9IHRoaXMuY3JlYXRpb25TZXJ2aWNlLnZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkRhdGEpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBpc1ZhbGlkOiB2YWxpZGF0aW9uUmVzdWx0LmlzVmFsaWQsIGlzc3VlczogdmFsaWRhdGlvblJlc3VsdC5pc3N1ZXMsXG4gICAgICAgICAgICAgICAgbm9kZUNvdW50OiB2YWxpZGF0aW9uUmVzdWx0Lm5vZGVDb3VudCwgY29tcG9uZW50Q291bnQ6IHZhbGlkYXRpb25SZXN1bHQuY29tcG9uZW50Q291bnQsXG4gICAgICAgICAgICAgICAgdXJsOiByZXNvbHZlZC51cmwsIGZpbGU6IHJlc29sdmVkLmZpbGVQYXRoLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IHZhbGlkYXRpb25SZXN1bHQuaXNWYWxpZCA/ICdQcmVmYWIgZm9ybWF0IGlzIHZhbGlkJyA6ICdQcmVmYWIgZm9ybWF0IGhhcyBpc3N1ZXMnXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkdXBsaWNhdGVQcmVmYWJCeVV1aWQoYXJnczogeyB1dWlkOiBzdHJpbmc7IG5ld05hbWU/OiBzdHJpbmc7IHRhcmdldERpcj86IHN0cmluZyB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgLy8gUHJlZmFiIGR1cGxpY2F0aW9uIHJlcXVpcmVzIGNvbXBsZXggc2VyaWFsaXphdGlvbiDigJQgbm90IGF2YWlsYWJsZSBwcm9ncmFtbWF0aWNhbGx5XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiAnUHJlZmFiIGR1cGxpY2F0aW9uIGlzIG5vdCBhdmFpbGFibGUgcHJvZ3JhbW1hdGljYWxseScsXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1RvIGR1cGxpY2F0ZSBhIHByZWZhYiwgdXNlIHRoZSBDb2NvcyBDcmVhdG9yIGVkaXRvcjpcXG4xLiBTZWxlY3QgdGhlIHByZWZhYiBpbiB0aGUgQXNzZXQgQnJvd3NlclxcbjIuIFJpZ2h0LWNsaWNrIGFuZCBzZWxlY3QgQ29weVxcbjMuIFBhc3RlIGluIHRoZSB0YXJnZXQgbG9jYXRpb24nXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdG9yZSAoYS5rLmEuIHJldmVydCkgYSBwcmVmYWIgaW5zdGFuY2UgdG8gaXRzIGFzc2V0IHN0YXRlLlxuICAgICAqXG4gICAgICogQmFja3MgYm90aCBgYWN0aW9uPXJlc3RvcmVgIGFuZCBgYWN0aW9uPXJldmVydGAuIENvY29zIENyZWF0b3IgMy44LjcgZXhwb3Nlc1xuICAgICAqIG5vIGBzY2VuZTpyZXZlcnQtcHJlZmFiYCBtZXNzYWdlIGF0IGFsbCDigJQgYHJlc3RvcmUtcHJlZmFiYCBpcyB3aGF0IHRoZSBlZGl0b3JcbiAgICAgKiBpdHNlbGYgdXNlcyBmb3IgdGhlIGluc3BlY3RvcidzIFJldmVydCBidXR0b24gKCMxMykuIEl0IHRha2VzIHBvc2l0aW9uYWxcbiAgICAgKiBgKHJvb3RVdWlkLCBhc3NldFV1aWQpYCwgcmV0dXJucyBhIGJvb2xlYW4sIGFuZCByZWNvcmRzIGl0cyBvd24gdW5kbyBlbnRyeS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkOiBzdHJpbmcsIGFzc2V0VXVpZD86IHN0cmluZyk6IFByb21pc2U8YW55PiB7XG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyB9O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFjb250ZXh0LnN1Y2Nlc3MpIHJldHVybiBjb250ZXh0O1xuXG4gICAgICAgICAgICBjb25zdCByb290VXVpZCA9IGNvbnRleHQucm9vdFV1aWQ7XG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZEFzc2V0VXVpZCA9IGFzc2V0VXVpZCB8fCBjb250ZXh0LmFzc2V0VXVpZDtcbiAgICAgICAgICAgIGlmICghcmVzb2x2ZWRBc3NldFV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb3VsZCBub3QgcmVzb2x2ZSB0aGUgcHJlZmFiIGFzc2V0IGZvciBub2RlICR7bm9kZVV1aWR9LiBQYXNzIGFzc2V0VXVpZCBleHBsaWNpdGx5LmAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcmVzdG9yZWQgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHJvb3RVdWlkLCByZXNvbHZlZEFzc2V0VXVpZCk7XG4gICAgICAgICAgICBpZiAocmVzdG9yZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgRWRpdG9yIHJlamVjdGVkIHJlc3RvcmUtcHJlZmFiIGZvciBub2RlICR7cm9vdFV1aWR9LiBDb25maXJtIGl0IGlzIGEgcHJlZmFiLWluc3RhbmNlIHJvb3Qgd2l0aCBhIHZhbGlkIGFzc2V0IGxpbmsuYCxcbiAgICAgICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZDogcmVzb2x2ZWRBc3NldFV1aWQgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZDogcmVzb2x2ZWRBc3NldFV1aWQgfSxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIGluc3RhbmNlIHJlc3RvcmVkIGZyb20gYXNzZXQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIHJlc3RvcmUgcHJlZmFiIG5vZGU6ICR7ZXJyb3IubWVzc2FnZX1gIH07XG4gICAgICAgIH1cbiAgICB9XG59XG4iXX0=