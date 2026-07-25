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
        return (0, types_1.errorResult)(result.error || 'Failed to instantiate prefab');
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
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', prefabUuid).catch(() => null);
            const createNodeOptions = {
                assetUuid: prefabUuid
            };
            if (parentUuid) {
                createNodeOptions.parent = parentUuid;
            }
            if (assetInfo && assetInfo.name) {
                createNodeOptions.name = assetInfo.name;
            }
            if (position) {
                createNodeOptions.dump = {
                    position: { value: position }
                };
            }
            const nodeUuid = await Editor.Message.request('scene', 'create-node', createNodeOptions);
            const uuid = Array.isArray(nodeUuid) ? nodeUuid[0] : nodeUuid;
            // Apply rotation and scale if provided
            if (uuid) {
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
    /** Resolve a prefab asset's on-disk path, or null when it cannot be determined. */
    async resolvePrefabFilePath(assetUuid) {
        if (!assetUuid)
            return null;
        try {
            const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetUuid);
            if (!(meta === null || meta === void 0 ? void 0 : meta.url))
                return null;
            return (await Editor.Message.request('asset-db', 'query-path', meta.url));
        }
        catch (_a) {
            return null;
        }
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
        try {
            const metaInfo = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
            const info = {
                name: metaInfo.name, uuid: metaInfo.uuid, path: metaInfo.url || '',
                folder: metaInfo.url ? metaInfo.url.substring(0, metaInfo.url.lastIndexOf('/')) : '',
                createTime: metaInfo.createTime, modifyTime: metaInfo.modifyTime,
                dependencies: metaInfo.depends || []
            };
            return { success: true, data: info };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
    async validatePrefabByUuid(uuid) {
        try {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-meta', uuid);
            if (!assetInfo)
                return { success: false, error: 'Prefab not found' };
            const url = assetInfo.url || '';
            // asset-db has no 'read-asset' message; resolve the db URL to a
            // filesystem path and read the .prefab file directly (same pattern
            // as manage-script / manage-animation).
            const filePath = await Editor.Message.request('asset-db', 'query-path', url);
            if (!filePath)
                return { success: false, error: 'Could not resolve prefab file path on disk' };
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                try {
                    const prefabData = JSON.parse(content);
                    const validationResult = this.creationService.validatePrefabFormat(prefabData);
                    return {
                        success: true,
                        data: {
                            isValid: validationResult.isValid, issues: validationResult.issues,
                            nodeCount: validationResult.nodeCount, componentCount: validationResult.componentCount,
                            message: validationResult.isValid ? 'Prefab format is valid' : 'Prefab format has issues'
                        }
                    };
                }
                catch (_a) {
                    return { success: false, error: 'Prefab file format error: cannot parse JSON' };
                }
            }
            catch (error) {
                return { success: false, error: `Failed to read prefab file: ${error.message}` };
            }
        }
        catch (error) {
            return { success: false, error: `Error validating prefab: ${error}` };
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZhYi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtcHJlZmFiLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHVDQUF5QjtBQUN6QixvQ0FBb0Y7QUFDcEYseURBQW9EO0FBQ3BELGtEQUFtRDtBQUNuRCxxRkFBeUU7QUFFekUsTUFBYSxZQUFhLFNBQVEsaUNBQWM7SUFBaEQ7O1FBQ3FCLG9CQUFlLEdBQUcsSUFBSSxzREFBcUIsRUFBRSxDQUFDO1FBRXRELFNBQUksR0FBRyxlQUFlLENBQUM7UUFDdkIsZ0JBQVcsR0FBRyx1bkJBQXVuQixDQUFDO1FBQ3RvQixZQUFPLEdBQUcsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUV4SCxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxTQUFTLENBQUM7b0JBQ25ILFdBQVcsRUFBRSxrYkFBa2I7aUJBQ2xjO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUZBQW1GO2lCQUNuRztnQkFDRCxVQUFVLEVBQUU7b0JBQ1IsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDRDQUE0QztpQkFDNUQ7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29C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TyxFQUFFLElBQUk7Z0JBQ2IsSUFBSSxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsaUJBQWlCLEVBQUU7Z0JBQzFELE9BQU8sRUFBRSxrREFBa0Q7YUFDOUQsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxrQ0FBa0MsS0FBSyxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7UUFDeEYsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQTNmRCxvQ0EyZkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0LCBQcmVmYWJJbmZvIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IG5vcm1hbGl6ZVZlYzMgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xyXG5pbXBvcnQgeyBQcmVmYWJDcmVhdGlvblNlcnZpY2UgfSBmcm9tICcuL21hbmFnZS1wcmVmYWItY3JlYXRpb24tc2VydmljZSc7XHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlUHJlZmFiIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcHJpdmF0ZSByZWFkb25seSBjcmVhdGlvblNlcnZpY2UgPSBuZXcgUHJlZmFiQ3JlYXRpb25TZXJ2aWNlKCk7XHJcblxyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJlZmFiJztcclxuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBwcmVmYWJzIGluIHRoZSBwcm9qZWN0LiBBY3Rpb25zOiBsaXN0PWxpc3QgYWxsIHByZWZhYnMsIGxvYWQ9bG9hZCBwcmVmYWIgYnkgcGF0aCwgaW5zdGFudGlhdGU9aW5zdGFudGlhdGUgcHJlZmFiIGluIHNjZW5lLCBjcmVhdGU9Y3JlYXRlIHByZWZhYiBmcm9tIG5vZGUsIHVwZGF0ZT1hcHBseSBub2RlIGNoYW5nZXMgdG8gdGhlIHByZWZhYiBhc3NldCAodmVyaWZpZXMgdGhlIGFzc2V0IHdhcyB3cml0dGVuKSwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IHByZWZhYiBkZXRhaWxzLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBhc3NldCAod2l0aCB1bmRvKS4gRm9yIHVwZGF0ZS9yZXZlcnQvcmVzdG9yZSwgbm9kZVV1aWQgbWF5IGJlIGFueSBub2RlIGluIHRoZSBpbnN0YW5jZSDigJQgdGhlIGluc3RhbmNlIHJvb3QgaXMgcmVzb2x2ZWQgYXV0b21hdGljYWxseS4gUHJlcmVxdWlzaXRlczogcHJvamVjdCBtdXN0IGJlIG9wZW4gaW4gQ29jb3MgQ3JlYXRvci4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnbGlzdCcsICdsb2FkJywgJ2luc3RhbnRpYXRlJywgJ2NyZWF0ZScsICd1cGRhdGUnLCAncmV2ZXJ0JywgJ2dldF9pbmZvJywgJ3ZhbGlkYXRlJywgJ2R1cGxpY2F0ZScsICdyZXN0b3JlJ107XHJcblxyXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XHJcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydsaXN0JywgJ2xvYWQnLCAnaW5zdGFudGlhdGUnLCAnY3JlYXRlJywgJ3VwZGF0ZScsICdyZXZlcnQnLCAnZ2V0X2luZm8nLCAndmFsaWRhdGUnLCAnZHVwbGljYXRlJywgJ3Jlc3RvcmUnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGxpc3Q9bGlzdCBhbGwgcHJlZmFicyBpbiBwcm9qZWN0LCBsb2FkPWxvYWQgcHJlZmFiIGJ5IHV1aWQsIGluc3RhbnRpYXRlPWluc3RhbnRpYXRlIHByZWZhYiBpbiBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBwcmVmYWIgZnJvbSBub2RlLCB1cGRhdGU9YXBwbHkgbm9kZSBjaGFuZ2VzIHRvIGV4aXN0aW5nIHByZWZhYiwgcmV2ZXJ0PXJldmVydCBwcmVmYWIgaW5zdGFuY2UgdG8gdGhlIGFzc2V0IHN0YXRlIChhbGlhcyBvZiByZXN0b3JlKSwgZ2V0X2luZm89Z2V0IGRldGFpbGVkIHByZWZhYiBpbmZvLCB2YWxpZGF0ZT12YWxpZGF0ZSBwcmVmYWIgZmlsZSBmb3JtYXQsIGR1cGxpY2F0ZT1kdXBsaWNhdGUgYSBwcmVmYWIsIHJlc3RvcmU9cmVzdG9yZSBwcmVmYWIgbm9kZSB1c2luZyBwcmVmYWIgYXNzZXQgKGJ1aWx0LWluIHVuZG8pJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB1dWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKGZvciBsb2FkLCBnZXRfaW5mbywgdmFsaWRhdGUsIGR1cGxpY2F0ZSwgcmVzdG9yZV9ub2RlIGFjdGlvbnMpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwcmVmYWJVdWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgKGZvciBpbnN0YW50aWF0ZSBhY3Rpb24pJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBub2RlVXVpZDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NjZW5lIG5vZGUgVVVJRCAoZm9yIGNyZWF0ZSwgdXBkYXRlLCByZXZlcnQsIHJlc3RvcmUgYWN0aW9ucykuIEZvciB1cGRhdGUvcmV2ZXJ0L3Jlc3RvcmUgdGhpcyBtYXkgYmUgYW55IG5vZGUgaW5zaWRlIHRoZSBwcmVmYWIgaW5zdGFuY2U7IHRoZSBpbnN0YW5jZSByb290IGlzIHJlc29sdmVkIGZyb20gaXQuJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzYXZlUGF0aDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Fzc2V0IERCIHBhdGggdG8gc2F2ZSBwcmVmYWIgKGZvciBjcmVhdGUgYWN0aW9uLCBlLmcuIGRiOi8vYXNzZXRzL3ByZWZhYnMvTXlQcmVmYWIucHJlZmFiKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcGFyZW50VXVpZDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BhcmVudCBub2RlIFVVSUQgZm9yIHRoZSBpbnN0YW50aWF0ZWQgcHJlZmFiIChmb3IgaW5zdGFudGlhdGUgYWN0aW9uLCBvcHRpb25hbCknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHBvc2l0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSW5pdGlhbCBwb3NpdGlvbiB7eCwgeSwgen0gZm9yIGluc3RhbnRpYXRlZCBwcmVmYWIgKG9wdGlvbmFsKScsXHJcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgeDogeyB0eXBlOiAnbnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHk6IHsgdHlwZTogJ251bWJlcicgfSxcclxuICAgICAgICAgICAgICAgICAgICB6OiB7IHR5cGU6ICdudW1iZXInIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcm90YXRpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdJbml0aWFsIHJvdGF0aW9uIHt4LCB5LCB6fSBmb3IgaW5zdGFudGlhdGVkIHByZWZhYiAob3B0aW9uYWwpJyxcclxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICB4OiB7IHR5cGU6ICdudW1iZXInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgeTogeyB0eXBlOiAnbnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHo6IHsgdHlwZTogJ251bWJlcicgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzY2FsZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0luaXRpYWwgc2NhbGUge3gsIHksIHp9IGZvciBpbnN0YW50aWF0ZWQgcHJlZmFiIChvcHRpb25hbCknLFxyXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgIHg6IHsgdHlwZTogJ251bWJlcicgfSxcclxuICAgICAgICAgICAgICAgICAgICB5OiB7IHR5cGU6ICdudW1iZXInIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgejogeyB0eXBlOiAnbnVtYmVyJyB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGZvbGRlcjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0ZvbGRlciB0byBzZWFyY2ggcHJlZmFicyBpbiAoZm9yIGxpc3QgYWN0aW9uLCBkZWZhdWx0OiBkYjovL2Fzc2V0cyknLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2RiOi8vYXNzZXRzJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBuZXdOYW1lOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTmV3IHByZWZhYiBuYW1lIChmb3IgZHVwbGljYXRlIGFjdGlvbiwgb3B0aW9uYWwpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB0YXJnZXREaXI6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgZGlyZWN0b3J5IGZvciBkdXBsaWNhdGVkIHByZWZhYiAoZm9yIGR1cGxpY2F0ZSBhY3Rpb24sIG9wdGlvbmFsKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgYXNzZXRVdWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnUHJlZmFiIGFzc2V0IFVVSUQgdG8gcmVzdG9yZSBmcm9tIChmb3IgcmV2ZXJ0IGFuZCByZXN0b3JlIGFjdGlvbnMsIG9wdGlvbmFsIOKAlCByZXNvbHZlZCBmcm9tIHRoZSBub2RlIHdoZW4gb21pdHRlZCknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmhhbmRsZUxpc3QoYXJncyksXHJcbiAgICAgICAgbG9hZDogKGFyZ3MpID0+IHRoaXMuaGFuZGxlTG9hZChhcmdzKSxcclxuICAgICAgICBpbnN0YW50aWF0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlSW5zdGFudGlhdGUoYXJncyksXHJcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVDcmVhdGUoYXJncyksXHJcbiAgICAgICAgdXBkYXRlOiAoYXJncykgPT4gdGhpcy5oYW5kbGVVcGRhdGUoYXJncyksXHJcbiAgICAgICAgcmV2ZXJ0OiAoYXJncykgPT4gdGhpcy5oYW5kbGVSZXZlcnQoYXJncyksXHJcbiAgICAgICAgZ2V0X2luZm86IChhcmdzKSA9PiB0aGlzLmhhbmRsZUdldEluZm8oYXJncyksXHJcbiAgICAgICAgdmFsaWRhdGU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVZhbGlkYXRlKGFyZ3MpLFxyXG4gICAgICAgIGR1cGxpY2F0ZTogKGFyZ3MpID0+IHRoaXMuaGFuZGxlRHVwbGljYXRlKGFyZ3MpLFxyXG4gICAgICAgIHJlc3RvcmU6IChhcmdzKSA9PiB0aGlzLmhhbmRsZVJlc3RvcmVOb2RlKGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxpc3QoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0UHJlZmFiTGlzdChhcmdzLmZvbGRlcik7XHJcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xyXG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBsaXN0IHByZWZhYnMnKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUxvYWQoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGNvbnN0IHsgdXVpZCB9ID0gYXJncztcclxuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMubG9hZFByZWZhYkJ5VXVpZCh1dWlkKTtcclxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XHJcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGxvYWQgcHJlZmFiJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVJbnN0YW50aWF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgY29uc3QgeyBwcmVmYWJVdWlkLCBwYXJlbnRVdWlkIH0gPSBhcmdzO1xyXG4gICAgICAgIGlmICghcHJlZmFiVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcmVmYWJVdWlkIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSBub3JtYWxpemVWZWMzKGFyZ3MucG9zaXRpb24pO1xyXG4gICAgICAgIGNvbnN0IHJvdGF0aW9uID0gbm9ybWFsaXplVmVjMyhhcmdzLnJvdGF0aW9uKTtcclxuICAgICAgICBjb25zdCBzY2FsZSA9IG5vcm1hbGl6ZVZlYzMoYXJncy5zY2FsZSk7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5pbnN0YW50aWF0ZVByZWZhYkJ5VXVpZCh7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUgfSk7XHJcbiAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xyXG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQuZXJyb3IgfHwgJ0ZhaWxlZCB0byBpbnN0YW50aWF0ZSBwcmVmYWInKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUNyZWF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgc2F2ZVBhdGggfSA9IGFyZ3M7XHJcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmICghc2F2ZVBhdGgpIHJldHVybiBlcnJvclJlc3VsdCgnc2F2ZVBhdGggaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICBjb25zdCBwcmVmYWJOYW1lID0gc2F2ZVBhdGguc3BsaXQoJy8nKS5wb3AoKT8ucmVwbGFjZSgnLnByZWZhYicsICcnKSB8fCAnTmV3UHJlZmFiJztcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0ZVByZWZhYih7IG5vZGVVdWlkLCBzYXZlUGF0aCwgcHJlZmFiTmFtZSB9KTtcclxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XHJcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIGNyZWF0ZSBwcmVmYWInKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZVVwZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCB9ID0gYXJncztcclxuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy51cGRhdGVQcmVmYWIobm9kZVV1aWQpO1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcclxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gdXBkYXRlIHByZWZhYicpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUmV2ZXJ0KGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBhc3NldFV1aWQgfSA9IGFyZ3M7XHJcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIC8vIGByZXZlcnRgIGFuZCBgcmVzdG9yZWAgYXJlIHRoZSBzYW1lIGVkaXRvciBvcGVyYXRpb24g4oCUIHNlZSByZXN0b3JlUHJlZmFiTm9kZS5cclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkLCBhc3NldFV1aWQpO1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcclxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gcmV2ZXJ0IHByZWZhYicpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlR2V0SW5mbyhhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xyXG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRQcmVmYWJJbmZvQnlVdWlkKHV1aWQpO1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcclxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gZ2V0IHByZWZhYiBpbmZvJyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVWYWxpZGF0ZShhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgY29uc3QgeyB1dWlkIH0gPSBhcmdzO1xyXG4gICAgICAgIGlmICghdXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1dWlkIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy52YWxpZGF0ZVByZWZhYkJ5VXVpZCh1dWlkKTtcclxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XHJcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHZhbGlkYXRlIHByZWZhYicpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlRHVwbGljYXRlKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBjb25zdCB7IHV1aWQsIG5ld05hbWUsIHRhcmdldERpciB9ID0gYXJncztcclxuICAgICAgICBpZiAoIXV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgndXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZHVwbGljYXRlUHJlZmFiQnlVdWlkKHsgdXVpZCwgbmV3TmFtZSwgdGFyZ2V0RGlyIH0pO1xyXG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcclxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0LmVycm9yIHx8ICdGYWlsZWQgdG8gZHVwbGljYXRlIHByZWZhYicpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVzdG9yZU5vZGUoYXJnczogUmVjb3JkPHN0cmluZywgYW55Pik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIGFzc2V0VXVpZCB9ID0gYXJncztcclxuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkJyk7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZXN0b3JlUHJlZmFiTm9kZShub2RlVXVpZCwgYXNzZXRVdWlkKTtcclxuICAgICAgICBpZiAocmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XHJcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdC5lcnJvciB8fCAnRmFpbGVkIHRvIHJlc3RvcmUgcHJlZmFiIG5vZGUnKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIC8vIFByaXZhdGUgaW1wbGVtZW50YXRpb24gbWV0aG9kcyAocG9ydGVkIGZyb20gUHJlZmFiVG9vbHMpXHJcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFByZWZhYkxpc3QoZm9sZGVyOiBzdHJpbmcgPSAnZGI6Ly9hc3NldHMnKTogUHJvbWlzZTxhbnk+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwYXR0ZXJuID0gZm9sZGVyLmVuZHNXaXRoKCcvJykgPyBgJHtmb2xkZXJ9KiovKi5wcmVmYWJgIDogYCR7Zm9sZGVyfS8qKi8qLnByZWZhYmA7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdHM6IGFueVtdID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xyXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJzOiBQcmVmYWJJbmZvW10gPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xyXG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSwgcGF0aDogYXNzZXQudXJsLCB1dWlkOiBhc3NldC51dWlkLFxyXG4gICAgICAgICAgICAgICAgZm9sZGVyOiBhc3NldC51cmwuc3Vic3RyaW5nKDAsIGFzc2V0LnVybC5sYXN0SW5kZXhPZignLycpKVxyXG4gICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHByZWZhYnMgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgbG9hZFByZWZhYkJ5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByZWZhYkRhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2xvYWQtYXNzZXQnLCB7IHV1aWQgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdXVpZDogcHJlZmFiRGF0YS51dWlkLCBuYW1lOiBwcmVmYWJEYXRhLm5hbWUsIG1lc3NhZ2U6ICdQcmVmYWIgbG9hZGVkIHN1Y2Nlc3NmdWxseScgfSB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyLm1lc3NhZ2UgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBpbnN0YW50aWF0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHByZWZhYlV1aWQ6IHN0cmluZzsgcGFyZW50VXVpZD86IHN0cmluZzsgcG9zaXRpb24/OiBhbnk7IHJvdGF0aW9uPzogYW55OyBzY2FsZT86IGFueSB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB7IHByZWZhYlV1aWQsIHBhcmVudFV1aWQsIHBvc2l0aW9uLCByb3RhdGlvbiwgc2NhbGUgfSA9IGFyZ3M7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgcHJlZmFiVXVpZCkuY2F0Y2goKCkgPT4gbnVsbCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBjcmVhdGVOb2RlT3B0aW9uczogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgYXNzZXRVdWlkOiBwcmVmYWJVdWlkXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICBpZiAocGFyZW50VXVpZCkge1xyXG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMucGFyZW50ID0gcGFyZW50VXVpZDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKGFzc2V0SW5mbyAmJiBhc3NldEluZm8ubmFtZSkge1xyXG4gICAgICAgICAgICAgICAgY3JlYXRlTm9kZU9wdGlvbnMubmFtZSA9IGFzc2V0SW5mby5uYW1lO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAocG9zaXRpb24pIHtcclxuICAgICAgICAgICAgICAgIGNyZWF0ZU5vZGVPcHRpb25zLmR1bXAgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IHsgdmFsdWU6IHBvc2l0aW9uIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBjcmVhdGVOb2RlT3B0aW9ucyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHV1aWQgPSBBcnJheS5pc0FycmF5KG5vZGVVdWlkKSA/IG5vZGVVdWlkWzBdIDogbm9kZVV1aWQ7XHJcblxyXG4gICAgICAgICAgICAvLyBBcHBseSByb3RhdGlvbiBhbmQgc2NhbGUgaWYgcHJvdmlkZWRcclxuICAgICAgICAgICAgaWYgKHV1aWQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChyb3RhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogJ2V1bGVyQW5nbGVzJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogcm90YXRpb24sIHR5cGU6ICdjYy5WZWMzJyB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gey8qIG5vbi1mYXRhbCAqL30pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKHNjYWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc2V0LXByb3BlcnR5Jywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiAnc2NhbGUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBzY2FsZSwgdHlwZTogJ2NjLlZlYzMnIH1cclxuICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7Lyogbm9uLWZhdGFsICovfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxyXG4gICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiB1dWlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHByZWZhYlV1aWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50VXVpZCxcclxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbixcclxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbixcclxuICAgICAgICAgICAgICAgICAgICBzY2FsZSxcclxuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnUHJlZmFiIGluc3RhbnRpYXRlZCBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gaW5zdGFudGlhdGUgcHJlZmFiOiAke2Vyci5tZXNzYWdlfWAsXHJcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ0NoZWNrIHRoYXQgdGhlIHByZWZhYlV1aWQgaXMgY29ycmVjdCBhbmQgdGhlIGFzc2V0IERCIGlzIHJlYWR5LidcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVQcmVmYWIoYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwYXRoUGFyYW0gPSBhcmdzLnByZWZhYlBhdGggfHwgYXJncy5zYXZlUGF0aDtcclxuICAgICAgICAgICAgaWYgKCFwYXRoUGFyYW0pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ01pc3NpbmcgcHJlZmFiIHBhdGggcGFyYW1ldGVyLiBQcm92aWRlIHNhdmVQYXRoLicgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgcHJlZmFiTmFtZSA9IGFyZ3MucHJlZmFiTmFtZSB8fCAnTmV3UHJlZmFiJztcclxuICAgICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoUGFyYW0uZW5kc1dpdGgoJy5wcmVmYWInKSA/XHJcbiAgICAgICAgICAgICAgICBwYXRoUGFyYW0gOiBgJHtwYXRoUGFyYW19LyR7cHJlZmFiTmFtZX0ucHJlZmFiYDtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGluY2x1ZGVDaGlsZHJlbiA9IGFyZ3MuaW5jbHVkZUNoaWxkcmVuICE9PSBmYWxzZTtcclxuICAgICAgICAgICAgY29uc3QgaW5jbHVkZUNvbXBvbmVudHMgPSBhcmdzLmluY2x1ZGVDb21wb25lbnRzICE9PSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0RGJSZXN1bHQgPSBhd2FpdCB0aGlzLmNyZWF0aW9uU2VydmljZS5jcmVhdGVQcmVmYWJXaXRoQXNzZXREQihcclxuICAgICAgICAgICAgICAgIGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lLCBpbmNsdWRlQ2hpbGRyZW4sIGluY2x1ZGVDb21wb25lbnRzXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIGlmIChhc3NldERiUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBhc3NldERiUmVzdWx0O1xyXG5cclxuICAgICAgICAgICAgY29uc3QgbmF0aXZlUmVzdWx0ID0gdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiTmF0aXZlU3R1YigpO1xyXG4gICAgICAgICAgICBpZiAobmF0aXZlUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBuYXRpdmVSZXN1bHQ7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5jcmVhdGlvblNlcnZpY2UuY3JlYXRlUHJlZmFiQ3VzdG9tKGFyZ3Mubm9kZVV1aWQsIGZ1bGxQYXRoLCBwcmVmYWJOYW1lKTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBFcnJvciBjcmVhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlc29sdmUgdGhlIHByZWZhYi1pbnN0YW5jZSBjb250ZXh0IGZvciBhIG5vZGUuXHJcbiAgICAgKlxyXG4gICAgICogQ29jb3MgQ3JlYXRvciBkcml2ZXMgYm90aCBwcmVmYWIgbWVzc2FnZXMgZnJvbSB0aGUgbm9kZSBkdW1wJ3MgYF9fcHJlZmFiX19gXHJcbiAgICAgKiBibG9jayDigJQgYHJvb3RVdWlkYCAodGhlIHByZWZhYi1pbnN0YW5jZSBST09ULCBub3Qgd2hpY2hldmVyIGRlc2NlbmRhbnQgdGhlXHJcbiAgICAgKiBjYWxsZXIgaGFwcGVuZWQgdG8gcGFzcykgYW5kIGB1dWlkYCAodGhlIGJhY2tpbmcgcHJlZmFiIGFzc2V0KS4gU2VlIDMuOC43XHJcbiAgICAgKiBgcmVzb3VyY2VzLzNkL2VuZ2luZS9lZGl0b3IvaW5zcGVjdG9yL2NvbnRyaWJ1dGlvbnMvbm9kZS5qc2A6XHJcbiAgICAgKiAgIHJlcXVlc3QoJ3NjZW5lJywgJ2FwcGx5LXByZWZhYicsIHByZWZhYi5yb290VXVpZClcclxuICAgICAqICAgcmVxdWVzdCgnc2NlbmUnLCAncmVzdG9yZS1wcmVmYWInLCBwcmVmYWIucm9vdFV1aWQsIHByZWZhYi51dWlkKVxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIGxldCBub2RlRGF0YTogYW55O1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIG5vZGVEYXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcXVlcnkgbm9kZSAke25vZGVVdWlkfTogJHtlcnIubWVzc2FnZX1gIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghbm9kZURhdGEpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vZGUgbm90IGZvdW5kJyB9O1xyXG5cclxuICAgICAgICBjb25zdCBwcmVmYWIgPSBub2RlRGF0YS5fX3ByZWZhYl9fO1xyXG4gICAgICAgIGlmICghcHJlZmFiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gaXMgbm90IHBhcnQgb2YgYSBwcmVmYWIgaW5zdGFuY2VgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgIHJvb3RVdWlkOiBwcmVmYWIucm9vdFV1aWQgfHwgbm9kZVV1aWQsXHJcbiAgICAgICAgICAgIGFzc2V0VXVpZDogcHJlZmFiLnV1aWQgfHwgcHJlZmFiLnByZWZhYlN0YXRlSW5mbz8uYXNzZXRVdWlkXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKiogUmVzb2x2ZSBhIHByZWZhYiBhc3NldCdzIG9uLWRpc2sgcGF0aCwgb3IgbnVsbCB3aGVuIGl0IGNhbm5vdCBiZSBkZXRlcm1pbmVkLiAqL1xyXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlUHJlZmFiRmlsZVBhdGgoYXNzZXRVdWlkPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgICAgICAgaWYgKCFhc3NldFV1aWQpIHJldHVybiBudWxsO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1ldGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCBhc3NldFV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIW1ldGE/LnVybCkgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIHJldHVybiAoYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcGF0aCcsIG1ldGEudXJsKSkgYXMgc3RyaW5nIHwgbnVsbDtcclxuICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgc3RhdE10aW1lTXMoZmlsZVBhdGg6IHN0cmluZyB8IG51bGwpOiBudW1iZXIgfCBudWxsIHtcclxuICAgICAgICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gbnVsbDtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICByZXR1cm4gZnMuc3RhdFN5bmMoZmlsZVBhdGgpLm10aW1lTXM7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKiogUG9sbCBmb3IgdGhlIHByZWZhYiBmaWxlIHRvIGJlIHJld3JpdHRlbjsgYXNzZXQtZGIgbWF5IGZsdXNoIHNob3J0bHkgYWZ0ZXIgdGhlIG1lc3NhZ2UgcmVzb2x2ZXMuICovXHJcbiAgICBwcml2YXRlIGFzeW5jIHdhaXRGb3JQcmVmYWJXcml0ZShmaWxlUGF0aDogc3RyaW5nLCBiYXNlbGluZU1zOiBudW1iZXIsIHRpbWVvdXRNcyA9IDIwMDApOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcclxuICAgICAgICBjb25zdCBkZWFkbGluZSA9IERhdGUubm93KCkgKyB0aW1lb3V0TXM7XHJcbiAgICAgICAgbGV0IG10aW1lID0gdGhpcy5zdGF0TXRpbWVNcyhmaWxlUGF0aCk7XHJcbiAgICAgICAgd2hpbGUgKG10aW1lICE9PSBudWxsICYmIG10aW1lIDw9IGJhc2VsaW5lTXMgJiYgRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAxMDApKTtcclxuICAgICAgICAgICAgbXRpbWUgPSB0aGlzLnN0YXRNdGltZU1zKGZpbGVQYXRoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG10aW1lO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgdXBkYXRlUHJlZmFiKG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlc29sdmVQcmVmYWJDb250ZXh0KG5vZGVVdWlkKTtcclxuICAgICAgICAgICAgaWYgKCFjb250ZXh0LnN1Y2Nlc3MpIHJldHVybiBjb250ZXh0O1xyXG4gICAgICAgICAgICBjb25zdCB7IHJvb3RVdWlkLCBhc3NldFV1aWQgfSA9IGNvbnRleHQ7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwcmVmYWJQYXRoID0gYXdhaXQgdGhpcy5yZXNvbHZlUHJlZmFiRmlsZVBhdGgoYXNzZXRVdWlkKTtcclxuICAgICAgICAgICAgY29uc3QgbXRpbWVCZWZvcmUgPSB0aGlzLnN0YXRNdGltZU1zKHByZWZhYlBhdGgpO1xyXG5cclxuICAgICAgICAgICAgLy8gYHNjZW5lOmFwcGx5LXByZWZhYmAgdGFrZXMgdGhlIGluc3RhbmNlIHJvb3QgdXVpZCBhcyBhIFBPU0lUSU9OQUwgc3RyaW5nXHJcbiAgICAgICAgICAgIC8vIGFuZCByZXNvbHZlcyB0byBhIGJvb2xlYW4uIFRoZSBvbGQgYHsgbm9kZTogdXVpZCB9YCBvYmplY3QgZm9ybSByZXNvbHZlZFxyXG4gICAgICAgICAgICAvLyB3aXRob3V0IHRocm93aW5nIGJ1dCBuZXZlciB3cm90ZSB0aGUgYXNzZXQg4oCUIGEgc2lsZW50IG5vLW9wIHJlcG9ydGVkIGFzXHJcbiAgICAgICAgICAgIC8vIHN1Y2Nlc3MgKCMxMikuXHJcbiAgICAgICAgICAgIGNvbnN0IGFwcGxpZWQgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdhcHBseS1wcmVmYWInLCByb290VXVpZCk7XHJcbiAgICAgICAgICAgIGlmIChhcHBsaWVkID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYEVkaXRvciByZWplY3RlZCBhcHBseS1wcmVmYWIgZm9yIG5vZGUgJHtyb290VXVpZH0uIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGggfVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gVmVyaWZ5IHRoZSBhc3NldCB3YXMgYWN0dWFsbHkgd3JpdHRlbiByYXRoZXIgdGhhbiB0cnVzdGluZyBhIG5vbi10aHJvd2luZ1xyXG4gICAgICAgICAgICAvLyBtZXNzYWdlLiBgdW52ZXJpZmllZGAgbWVhbnMgdGhlIHBhdGggY291bGQgbm90IGJlIHJlc29sdmVkLCBub3QgdGhhdCB0aGVcclxuICAgICAgICAgICAgLy8gd3JpdGUgZmFpbGVkLlxyXG4gICAgICAgICAgICBsZXQgcGVyc2lzdGVkOiBib29sZWFuIHwgJ3VudmVyaWZpZWQnID0gJ3VudmVyaWZpZWQnO1xyXG4gICAgICAgICAgICBpZiAocHJlZmFiUGF0aCAhPT0gbnVsbCAmJiBtdGltZUJlZm9yZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbXRpbWVBZnRlciA9IGF3YWl0IHRoaXMud2FpdEZvclByZWZhYldyaXRlKHByZWZhYlBhdGgsIG10aW1lQmVmb3JlKTtcclxuICAgICAgICAgICAgICAgIGlmIChtdGltZUFmdGVyICE9PSBudWxsKSBwZXJzaXN0ZWQgPSBtdGltZUFmdGVyID4gbXRpbWVCZWZvcmU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChwZXJzaXN0ZWQgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBgYXBwbHktcHJlZmFiIHJlcG9ydGVkIG5vIGVycm9yIGJ1dCAke3ByZWZhYlBhdGh9IHdhcyBub3QgcmV3cml0dGVuLiBUaGUgbm9kZSBtYXkgaGF2ZSBubyBvdmVycmlkZXMgdG8gYXBwbHksIG9yIGl0cyBwcmVmYWIgbGluayBpcyBzdGFsZS5gLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQsIHByZWZhYlBhdGgsIHBlcnNpc3RlZCB9XHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmYWIgdXBkYXRlZCBzdWNjZXNzZnVsbHknLFxyXG4gICAgICAgICAgICAgICAgZGF0YTogeyBub2RlVXVpZCwgcm9vdFV1aWQsIGFzc2V0VXVpZCwgcHJlZmFiUGF0aCwgcGVyc2lzdGVkIH1cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJlZmFiSW5mb0J5VXVpZCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1ldGFJbmZvOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1tZXRhJywgdXVpZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGluZm86IFByZWZhYkluZm8gPSB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBtZXRhSW5mby5uYW1lLCB1dWlkOiBtZXRhSW5mby51dWlkLCBwYXRoOiBtZXRhSW5mby51cmwgfHwgJycsXHJcbiAgICAgICAgICAgICAgICBmb2xkZXI6IG1ldGFJbmZvLnVybCA/IG1ldGFJbmZvLnVybC5zdWJzdHJpbmcoMCwgbWV0YUluZm8udXJsLmxhc3RJbmRleE9mKCcvJykpIDogJycsXHJcbiAgICAgICAgICAgICAgICBjcmVhdGVUaW1lOiBtZXRhSW5mby5jcmVhdGVUaW1lLCBtb2RpZnlUaW1lOiBtZXRhSW5mby5tb2RpZnlUaW1lLFxyXG4gICAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzOiBtZXRhSW5mby5kZXBlbmRzIHx8IFtdXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGluZm8gfTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVQcmVmYWJCeVV1aWQodXVpZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBhc3NldEluZm86IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LW1ldGEnLCB1dWlkKTtcclxuICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ByZWZhYiBub3QgZm91bmQnIH07XHJcbiAgICAgICAgICAgIGNvbnN0IHVybCA9IGFzc2V0SW5mby51cmwgfHwgJyc7XHJcbiAgICAgICAgICAgIC8vIGFzc2V0LWRiIGhhcyBubyAncmVhZC1hc3NldCcgbWVzc2FnZTsgcmVzb2x2ZSB0aGUgZGIgVVJMIHRvIGFcclxuICAgICAgICAgICAgLy8gZmlsZXN5c3RlbSBwYXRoIGFuZCByZWFkIHRoZSAucHJlZmFiIGZpbGUgZGlyZWN0bHkgKHNhbWUgcGF0dGVyblxyXG4gICAgICAgICAgICAvLyBhcyBtYW5hZ2Utc2NyaXB0IC8gbWFuYWdlLWFuaW1hdGlvbikuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktcGF0aCcsIHVybCkgYXMgc3RyaW5nIHwgbnVsbDtcclxuICAgICAgICAgICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQ291bGQgbm90IHJlc29sdmUgcHJlZmFiIGZpbGUgcGF0aCBvbiBkaXNrJyB9O1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudDogc3RyaW5nID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmLTgnKTtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJlZmFiRGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsaWRhdGlvblJlc3VsdCA9IHRoaXMuY3JlYXRpb25TZXJ2aWNlLnZhbGlkYXRlUHJlZmFiRm9ybWF0KHByZWZhYkRhdGEpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzVmFsaWQ6IHZhbGlkYXRpb25SZXN1bHQuaXNWYWxpZCwgaXNzdWVzOiB2YWxpZGF0aW9uUmVzdWx0Lmlzc3VlcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVDb3VudDogdmFsaWRhdGlvblJlc3VsdC5ub2RlQ291bnQsIGNvbXBvbmVudENvdW50OiB2YWxpZGF0aW9uUmVzdWx0LmNvbXBvbmVudENvdW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogdmFsaWRhdGlvblJlc3VsdC5pc1ZhbGlkID8gJ1ByZWZhYiBmb3JtYXQgaXMgdmFsaWQnIDogJ1ByZWZhYiBmb3JtYXQgaGFzIGlzc3VlcydcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQcmVmYWIgZmlsZSBmb3JtYXQgZXJyb3I6IGNhbm5vdCBwYXJzZSBKU09OJyB9O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gcmVhZCBwcmVmYWIgZmlsZTogJHtlcnJvci5tZXNzYWdlfWAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRXJyb3IgdmFsaWRhdGluZyBwcmVmYWI6ICR7ZXJyb3J9YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGR1cGxpY2F0ZVByZWZhYkJ5VXVpZChhcmdzOiB7IHV1aWQ6IHN0cmluZzsgbmV3TmFtZT86IHN0cmluZzsgdGFyZ2V0RGlyPzogc3RyaW5nIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgICAgIC8vIFByZWZhYiBkdXBsaWNhdGlvbiByZXF1aXJlcyBjb21wbGV4IHNlcmlhbGl6YXRpb24g4oCUIG5vdCBhdmFpbGFibGUgcHJvZ3JhbW1hdGljYWxseVxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICBlcnJvcjogJ1ByZWZhYiBkdXBsaWNhdGlvbiBpcyBub3QgYXZhaWxhYmxlIHByb2dyYW1tYXRpY2FsbHknLFxyXG4gICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1RvIGR1cGxpY2F0ZSBhIHByZWZhYiwgdXNlIHRoZSBDb2NvcyBDcmVhdG9yIGVkaXRvcjpcXG4xLiBTZWxlY3QgdGhlIHByZWZhYiBpbiB0aGUgQXNzZXQgQnJvd3NlclxcbjIuIFJpZ2h0LWNsaWNrIGFuZCBzZWxlY3QgQ29weVxcbjMuIFBhc3RlIGluIHRoZSB0YXJnZXQgbG9jYXRpb24nXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlc3RvcmUgKGEuay5hLiByZXZlcnQpIGEgcHJlZmFiIGluc3RhbmNlIHRvIGl0cyBhc3NldCBzdGF0ZS5cclxuICAgICAqXHJcbiAgICAgKiBCYWNrcyBib3RoIGBhY3Rpb249cmVzdG9yZWAgYW5kIGBhY3Rpb249cmV2ZXJ0YC4gQ29jb3MgQ3JlYXRvciAzLjguNyBleHBvc2VzXHJcbiAgICAgKiBubyBgc2NlbmU6cmV2ZXJ0LXByZWZhYmAgbWVzc2FnZSBhdCBhbGwg4oCUIGByZXN0b3JlLXByZWZhYmAgaXMgd2hhdCB0aGUgZWRpdG9yXHJcbiAgICAgKiBpdHNlbGYgdXNlcyBmb3IgdGhlIGluc3BlY3RvcidzIFJldmVydCBidXR0b24gKCMxMykuIEl0IHRha2VzIHBvc2l0aW9uYWxcclxuICAgICAqIGAocm9vdFV1aWQsIGFzc2V0VXVpZClgLCByZXR1cm5zIGEgYm9vbGVhbiwgYW5kIHJlY29yZHMgaXRzIG93biB1bmRvIGVudHJ5LlxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlc3RvcmVQcmVmYWJOb2RlKG5vZGVVdWlkOiBzdHJpbmcsIGFzc2V0VXVpZD86IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnbm9kZVV1aWQgaXMgcmVxdWlyZWQnIH07XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVzb2x2ZVByZWZhYkNvbnRleHQobm9kZVV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIWNvbnRleHQuc3VjY2VzcykgcmV0dXJuIGNvbnRleHQ7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByb290VXVpZCA9IGNvbnRleHQucm9vdFV1aWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc29sdmVkQXNzZXRVdWlkID0gYXNzZXRVdWlkIHx8IGNvbnRleHQuYXNzZXRVdWlkO1xyXG4gICAgICAgICAgICBpZiAoIXJlc29sdmVkQXNzZXRVdWlkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb3VsZCBub3QgcmVzb2x2ZSB0aGUgcHJlZmFiIGFzc2V0IGZvciBub2RlICR7bm9kZVV1aWR9LiBQYXNzIGFzc2V0VXVpZCBleHBsaWNpdGx5LmAgfTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVzdG9yZWQgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHJvb3RVdWlkLCByZXNvbHZlZEFzc2V0VXVpZCk7XHJcbiAgICAgICAgICAgIGlmIChyZXN0b3JlZCA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGBFZGl0b3IgcmVqZWN0ZWQgcmVzdG9yZS1wcmVmYWIgZm9yIG5vZGUgJHtyb290VXVpZH0uIENvbmZpcm0gaXQgaXMgYSBwcmVmYWItaW5zdGFuY2Ugcm9vdCB3aXRoIGEgdmFsaWQgYXNzZXQgbGluay5gLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHsgbm9kZVV1aWQsIHJvb3RVdWlkLCBhc3NldFV1aWQ6IHJlc29sdmVkQXNzZXRVdWlkIH1cclxuICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBkYXRhOiB7IG5vZGVVdWlkLCByb290VXVpZCwgYXNzZXRVdWlkOiByZXNvbHZlZEFzc2V0VXVpZCB9LFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZhYiBpbnN0YW5jZSByZXN0b3JlZCBmcm9tIGFzc2V0IHN1Y2Nlc3NmdWxseSdcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYEZhaWxlZCB0byByZXN0b3JlIHByZWZhYiBub2RlOiAke2Vycm9yLm1lc3NhZ2V9YCB9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=