"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageScene = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
const asset_path_1 = require("../utils/asset-path");
const save_artifact_guard_1 = require("../utils/save-artifact-guard");
/** Longest `saveScene` waits for the scene file to be rewritten before calling the save unconfirmed. */
const SAVE_WRITE_TIMEOUT_MS = 2000;
class ManageScene extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_scene';
        this.description = 'Manage scenes in the project. Actions: get_current, list, open, save, create, save_as, close, get_hierarchy. Use get_current to check if a scene is open before node/component operations. Use get_hierarchy to understand scene structure before modifying nodes. Prerequisites: project must be open in Cocos Creator.';
        this.actions = ['get_current', 'list', 'open', 'save', 'create', 'save_as', 'close', 'get_hierarchy'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_current', 'list', 'open', 'save', 'create', 'save_as', 'close', 'get_hierarchy'],
                    description: 'Action to perform: get_current=get open scene info, list=list all scenes in project, open=open a scene by path, save=save current scene, create=create new scene asset, save_as=save scene as new file (opens dialog), close=close current scene, get_hierarchy=get full node tree of current scene'
                },
                scenePath: {
                    type: 'string',
                    description: '[open] Scene file path (e.g., db://assets/scenes/Main.scene)'
                },
                reimport: {
                    type: 'boolean',
                    description: '[open] Reimport the scene asset first so out-of-band edits to the .scene file are read from disk (default true). false = open the editor\'s cached copy.',
                    default: true
                },
                sceneName: {
                    type: 'string',
                    description: '[create] Name of the new scene'
                },
                savePath: {
                    type: 'string',
                    description: '[create] Path to save the scene (e.g., db://assets/scenes/NewScene.scene)'
                },
                path: {
                    type: 'string',
                    description: '[save_as] Path to save the scene as'
                },
                includeComponents: {
                    type: 'boolean',
                    description: '[get_hierarchy] Include component information in hierarchy output',
                    default: false
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_current: (args) => this.getCurrentScene(),
            list: (args) => this.getSceneList(),
            open: (args) => this.openScene(args.scenePath, (0, normalize_1.coerceBool)(args.reimport) !== false),
            save: (args) => this.saveScene(),
            create: (args) => this.createScene(args.sceneName, args.savePath),
            save_as: (args) => this.saveSceneAs(args.path),
            close: (args) => this.closeScene(),
            get_hierarchy: (args) => { var _a; return this.getSceneHierarchy((_a = (0, normalize_1.coerceBool)(args.includeComponents)) !== null && _a !== void 0 ? _a : false); }
        };
    }
    async getCurrentScene() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree) => {
                if (tree && tree.uuid) {
                    resolve((0, types_1.successResult)({
                        name: tree.name || 'Current Scene',
                        uuid: tree.uuid,
                        type: tree.type || 'cc.Scene',
                        active: tree.active !== undefined ? tree.active : true,
                        nodeCount: tree.children ? tree.children.length : 0
                    }));
                }
                else {
                    resolve((0, types_1.errorResult)('No scene data available'));
                }
            }).catch((err) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getCurrentSceneInfo',
                    args: []
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result) => {
                    if (result && result.success) {
                        resolve((0, types_1.successResult)(result.data, result.message));
                    }
                    else {
                        resolve((0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error'));
                    }
                }).catch((err2) => {
                    resolve((0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }
    async getSceneList() {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-assets', {
                pattern: 'db://assets/**/*.scene'
            }).then((results) => {
                const scenes = results.map(asset => ({
                    name: asset.name,
                    path: asset.url,
                    uuid: asset.uuid
                }));
                resolve((0, types_1.successResult)(scenes));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    /**
     * `scene:open-scene` serves the editor's CACHED copy of a scene asset: after the `.scene`
     * file is edited out of band it resolves successfully while the editor keeps showing the
     * old content, and the next editor-driven save silently overwrites the disk edit (#65,
     * live-confirmed — only `manage_asset reimport` forced a re-read). Open therefore
     * reimports the scene asset first so the editor reads the file as it is on disk, and
     * reports that it did. `reimport: false` opts out (keeps the editor's in-memory copy).
     */
    async openScene(scenePath, reimport = true) {
        if (!scenePath) {
            return (0, types_1.errorResult)('scenePath is required for action=open');
        }
        try {
            const uuid = await Editor.Message.request('asset-db', 'query-uuid', scenePath);
            if (!uuid) {
                return (0, types_1.errorResult)('Scene not found');
            }
            if (reimport) {
                const reimported = await Editor.Message.request('asset-db', 'reimport-asset', scenePath);
                if (reimported === false) {
                    return (0, types_1.errorResult)(`asset-db:reimport-asset returned false for '${scenePath}' — the editor rejected the reimport, ` +
                        'so the scene would be opened from its cached copy. Nothing was opened. Pass reimport=false to open the cached copy deliberately.');
                }
            }
            await Editor.Message.request('scene', 'open-scene', uuid);
            const ready = await Editor.Message.request('scene', 'query-is-ready').catch(() => undefined);
            if (ready === false) {
                return (0, types_1.errorResult)(`open-scene resolved for '${scenePath}' but the scene is not ready afterward — it did not finish loading.`);
            }
            return (0, types_1.successResult)({ reimported: reimport }, reimport
                ? `Scene opened: ${scenePath} (asset reimported first, so the editor read the file from disk)`
                : `Scene opened: ${scenePath} (from the editor's cached copy — out-of-band disk edits are NOT picked up)`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    /**
     * `scene:save-scene` resolves to a `boolean` (per the shipped 3.8.7 message types,
     * `node_modules/@cocos/creator-types/editor/packages/scene/@types/message.d.ts`),
     * not `void` — the old code discarded that result and reported success unconditionally
     * once the promise settled, with no verification and no `.catch` for a rejected save.
     * A `false` result is treated as a failed save (#6).
     *
     * A resolved `true`, and a `query-dirty` reading of `false` immediately after it, are
     * both statements about the EDITOR's in-memory view — neither is a statement about the
     * file. #6's regression report (2026-09-21) is exactly that gap: strictly sequential
     * calls, `save` returning `true` three times, `query_dirty` reading `false`, and the
     * `.scene` file's mtime frozen at its pre-edit timestamp with the edit absent from the
     * JSON. The editor believed it had saved; it had not.
     *
     * So the artifact itself is the arbiter, on two reads of it:
     *
     *  - **mtime did not advance** → nothing was serialised. Hard failure (#6).
     *  - **`cc.TargetOverrideInfo` records dropped** → the file was rewritten, but lossily.
     *    Reported as a loud non-success with the lost `propertyPath`s named (#78). A
     *    no-edit round-trip losing these records is the reported repro: 25 before, 23 after,
     *    and the old response was byte-identical to a lossless save's.
     *
     * Both checks are best-effort in the sense that an unreadable artifact yields
     * "unverifiable" rather than a pass — the result says which it was, so a caller is never
     * told "verified" on the strength of a read that did not happen. The mutating calls
     * ahead of this save are serialised on one chain (`tools/mutation-queue.ts`), and
     * `manage_scene_query` reconciles the raw dirty flag against that queue.
     */
    async saveScene() {
        const scenePath = await this.resolveCurrentSceneFilePath();
        const mtimeBefore = (0, save_artifact_guard_1.statMtimeMs)(scenePath);
        const overridesBefore = (0, save_artifact_guard_1.readOverrideSnapshot)(scenePath);
        try {
            const saved = await Editor.Message.request('scene', 'save-scene');
            if (saved === false) {
                return (0, types_1.errorResult)('scene:save-scene returned false — the editor rejected the save. Nothing was written.');
            }
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
        // 1. Dirty-flag backstop — the editor still holds uncommitted edits.
        let editorDirty = null;
        try {
            editorDirty = (await Editor.Message.request('scene', 'query-dirty')) === true;
        }
        catch (_a) {
            // Best-effort: unreadable dirty state must not turn a real save into a failure.
        }
        if (editorDirty === true) {
            return (0, types_1.errorResult)('save-scene reported success, but the scene is still dirty immediately afterward — ' +
                'a pending edit was not captured in this save. This typically means a mutating call ' +
                '(manage_node/manage_component/etc.) was issued concurrently or batched with this save ' +
                'instead of awaited first; issue calls sequentially and retry save.');
        }
        // 2. Artifact checks. `scenePath === null` means the on-disk file could not be
        // resolved (unsaved scene, unknown asset); that is reported as unverified, never
        // folded into either a pass or a failure.
        const artifact = scenePath === null
            ? { verified: false, verdict: 'unverified', reason: null, mtimeMs: null, lostOverrides: null }
            : await this.verifySavedArtifact(scenePath, mtimeBefore, overridesBefore);
        if (artifact.lostOverrides) {
            return {
                success: false,
                error: `Scene saved to ${scenePath}, but the save WAS LOSSY: ${artifact.lostOverrides}`,
                data: Object.assign({ file: scenePath, dirty: false, editorDirty, persistenceVerified: true }, (artifact.mtimeMs !== null ? { mtimeMs: artifact.mtimeMs } : {})),
                isError: true
            };
        }
        if (artifact.verdict === 'dropped') {
            return (0, types_1.errorResult)(`save-scene reported success but the write did not reach disk: ${artifact.reason}. ` +
                'This is the #6 false-success shape — verify the file yourself, and if the edit is absent, ' +
                'press Ctrl+S in the Cocos Creator editor and report the occurrence on #6.');
        }
        // 3. Prefab-edit mode (#99 item 4): the editor's own prefab serializer was reported to
        // write the root as `_active: true` whatever the live root's state. The artifact is
        // read back and compared with the live root; a disagreement fails the save instead of
        // being reported as "Scene saved successfully".
        const rootActive = scenePath !== null && scenePath.endsWith('.prefab')
            ? await this.verifyPrefabRootActive(scenePath)
            : null;
        if (rootActive && rootActive.flip) {
            return {
                success: false,
                error: rootActive.flip,
                data: Object.assign({ file: scenePath, dirty: false, editorDirty, rootActiveVerified: false }, rootActive.detail),
                isError: true
            };
        }
        return (0, types_1.successResult)(Object.assign(Object.assign({ dirty: false, editorDirty, file: scenePath, persistenceVerified: artifact.verdict === 'verified' }, (rootActive ? { rootActiveVerified: rootActive.verified } : {})), (artifact.mtimeMs !== null ? { mtimeMs: artifact.mtimeMs } : {})), artifact.verdict === 'verified'
            ? 'Scene saved successfully (file rewritten and override records preserved)'
            : 'Scene saved successfully (dirty state unverifiable)');
    }
    /**
     * Confirm the save actually reached the artifact, and that it did not lose override
     * records on the way.
     *
     * Three outcomes, deliberately not two — "we could not check" must stay distinguishable
     * from both "we checked and it landed" and "we checked and it did not":
     *
     *  - `verified`  — the write is confirmed, and no override record was lost.
     *  - `dropped`   — the write is confirmed ABSENT (an existing file whose mtime did not
     *                  advance). Evidence of the #6 false success; reported as a failure.
     *  - `unverified`— no artifact evidence either way (no file at the resolved path, file
     *                  unreadable). Reported as explicitly unverified, never as a pass.
     */
    async verifySavedArtifact(scenePath, mtimeBefore, overridesBefore) {
        const mtimeAfter = mtimeBefore === null
            ? null
            : await (0, save_artifact_guard_1.waitForFileRewrite)(scenePath, mtimeBefore, SAVE_WRITE_TIMEOUT_MS);
        let lostOverrides = null;
        if (overridesBefore && overridesBefore.total > 0) {
            lostOverrides = (0, save_artifact_guard_1.describeOverrideLoss)(overridesBefore, (0, save_artifact_guard_1.readOverrideSnapshot)(scenePath));
        }
        const rewritten = mtimeBefore !== null && mtimeAfter !== null && mtimeAfter > mtimeBefore;
        // An override loss proves the file was rewritten; do not also demand a moved mtime,
        // which a coarse filesystem timestamp could fail to show.
        if (rewritten || lostOverrides) {
            return { verified: true, verdict: 'verified', reason: null, mtimeMs: mtimeAfter, lostOverrides };
        }
        // No file at the resolved path — before AND after. There is nothing to compare, so
        // this is "unverifiable", not a dropped write: a scene that has never been written
        // to disk legitimately has no artifact, and a mis-resolved path must not be reported
        // as a data loss.
        if (mtimeBefore === null) {
            return { verified: false, verdict: 'unverified', reason: null, mtimeMs: null, lostOverrides: null };
        }
        // A file existed and the save did not touch it. That is the #6 defect: the editor
        // reported success over a write that never happened.
        return {
            verified: false, verdict: 'dropped', mtimeMs: mtimeAfter, lostOverrides: null,
            reason: `${scenePath} existed before the save and was not rewritten by it (mtime unchanged), so the reported-successful save did not serialise anything`
        };
    }
    /**
     * Compare the saved `.prefab`'s root `_active` with the live root node's `active`.
     *
     * In prefab-edit mode `scene:query-node-tree` yields a wrapper whose single child is the
     * prefab's root node; with any other shape there is no unambiguous live root to compare,
     * so the result is `verified: false` (unknown) rather than a guess. Unknown on either side
     * never fails the save — only a confirmed disagreement does.
     */
    async verifyPrefabRootActive(prefabPath) {
        var _a, _b, _c, _d, _e;
        const unknown = { verified: false, flip: null, detail: {} };
        const persisted = (0, save_artifact_guard_1.readPrefabRootActive)(prefabPath);
        if (persisted === null)
            return unknown;
        let live = null;
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            const children = Array.isArray(tree === null || tree === void 0 ? void 0 : tree.children) ? tree.children : [];
            const rootUuid = children.length === 1 ? (((_a = children[0]) === null || _a === void 0 ? void 0 : _a.uuid) || ((_c = (_b = children[0]) === null || _b === void 0 ? void 0 : _b.value) === null || _c === void 0 ? void 0 : _c.uuid)) : null;
            if (!rootUuid)
                return unknown;
            const dump = await Editor.Message.request('scene', 'query-node', rootUuid);
            const active = (_e = (_d = dump === null || dump === void 0 ? void 0 : dump.active) === null || _d === void 0 ? void 0 : _d.value) !== null && _e !== void 0 ? _e : dump === null || dump === void 0 ? void 0 : dump.active;
            if (typeof active === 'boolean')
                live = active;
        }
        catch (_f) {
            return unknown;
        }
        if (live === null)
            return unknown;
        if (live === persisted)
            return { verified: true, flip: null, detail: {} };
        return {
            verified: false,
            detail: { liveRootActive: live, persistedRootActive: persisted },
            flip: `Prefab saved to ${prefabPath}, but the saved root node has _active=${persisted} while the live root is ` +
                `${live ? 'active' : 'inactive'} (active=${live}). The editor's prefab-mode serializer rewrote the root's ` +
                `activation state (#99 item 4); the .prefab on disk does not match what you edited. Fix the root's ` +
                `active flag in the editor and save again, or correct _active in the file.`
        };
    }
    /**
     * Resolve the on-disk path of the scene currently open in the editor.
     *
     * `scene:query-node-tree` yields the open scene's ROOT node, whose uuid is the scene
     * asset's uuid for a saved scene — enough to resolve the file through `asset-db`. A
     * never-saved scene has no asset file, so this returns null and the caller reports the
     * artifact as unverifiable rather than guessing a path.
     */
    async resolveCurrentSceneFilePath() {
        var _a;
        let sceneUuid = null;
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (Array.isArray(tree))
                sceneUuid = ((_a = tree[0]) === null || _a === void 0 ? void 0 : _a.uuid) || null;
            else if (tree && typeof tree === 'object')
                sceneUuid = tree.uuid || null;
        }
        catch (_b) {
            sceneUuid = null;
        }
        if (!sceneUuid)
            return null;
        try {
            return (await (0, asset_path_1.resolveAsset)(sceneUuid)).filePath;
        }
        catch (_c) {
            return null;
        }
    }
    async createScene(sceneName, savePath) {
        if (!sceneName || !savePath) {
            return (0, types_1.errorResult)('sceneName and savePath are required for action=create');
        }
        return new Promise((resolve) => {
            const fullPath = savePath.endsWith('.scene') ? savePath : `${savePath}/${sceneName}.scene`;
            const sceneContent = JSON.stringify([
                {
                    "__type__": "cc.SceneAsset",
                    "_name": sceneName,
                    "_objFlags": 0,
                    "__editorExtras__": {},
                    "_native": "",
                    "scene": { "__id__": 1 }
                },
                {
                    "__type__": "cc.Scene",
                    "_name": sceneName,
                    "_objFlags": 0,
                    "__editorExtras__": {},
                    "_parent": null,
                    "_children": [],
                    "_active": true,
                    "_components": [],
                    "_prefab": null,
                    "_lpos": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
                    "_lrot": { "__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1 },
                    "_lscale": { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 },
                    "_mobility": 0,
                    "_layer": 1073741824,
                    "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
                    "autoReleaseAssets": false,
                    "_globals": { "__id__": 2 },
                    "_id": "scene"
                },
                {
                    "__type__": "cc.SceneGlobals",
                    "ambient": { "__id__": 3 },
                    "skybox": { "__id__": 4 },
                    "fog": { "__id__": 5 },
                    "octree": { "__id__": 6 }
                },
                {
                    "__type__": "cc.AmbientInfo",
                    "_skyColorHDR": { "__type__": "cc.Vec4", "x": 0.2, "y": 0.5, "z": 0.8, "w": 0.520833 },
                    "_skyColor": { "__type__": "cc.Vec4", "x": 0.2, "y": 0.5, "z": 0.8, "w": 0.520833 },
                    "_skyIllumHDR": 20000,
                    "_skyIllum": 20000,
                    "_groundAlbedoHDR": { "__type__": "cc.Vec4", "x": 0.2, "y": 0.2, "z": 0.2, "w": 1 },
                    "_groundAlbedo": { "__type__": "cc.Vec4", "x": 0.2, "y": 0.2, "z": 0.2, "w": 1 }
                },
                {
                    "__type__": "cc.SkyboxInfo",
                    "_envLightingType": 0,
                    "_envmapHDR": null,
                    "_envmap": null,
                    "_envmapLodCount": 0,
                    "_diffuseMapHDR": null,
                    "_diffuseMap": null,
                    "_enabled": false,
                    "_useHDR": true,
                    "_editableMaterial": null,
                    "_reflectionHDR": null,
                    "_reflectionMap": null,
                    "_rotationAngle": 0
                },
                {
                    "__type__": "cc.FogInfo",
                    "_type": 0,
                    "_fogColor": { "__type__": "cc.Color", "r": 200, "g": 200, "b": 200, "a": 255 },
                    "_enabled": false,
                    "_fogDensity": 0.3,
                    "_fogStart": 0.5,
                    "_fogEnd": 300,
                    "_fogAtten": 5,
                    "_fogTop": 1.5,
                    "_fogRange": 1.2,
                    "_accurate": false
                },
                {
                    "__type__": "cc.OctreeInfo",
                    "_enabled": false,
                    "_minPos": { "__type__": "cc.Vec3", "x": -1024, "y": -1024, "z": -1024 },
                    "_maxPos": { "__type__": "cc.Vec3", "x": 1024, "y": 1024, "z": 1024 },
                    "_depth": 8
                }
            ], null, 2);
            Editor.Message.request('asset-db', 'create-asset', fullPath, sceneContent).then((result) => {
                this.getSceneList().then((sceneList) => {
                    var _a;
                    const createdScene = (_a = sceneList.data) === null || _a === void 0 ? void 0 : _a.find((scene) => scene.uuid === result.uuid);
                    resolve((0, types_1.successResult)({
                        uuid: result.uuid,
                        url: result.url,
                        name: sceneName,
                        message: `Scene '${sceneName}' created successfully`,
                        sceneVerified: !!createdScene
                    }));
                }).catch(() => {
                    resolve((0, types_1.successResult)({
                        uuid: result.uuid,
                        url: result.url,
                        name: sceneName,
                        message: `Scene '${sceneName}' created successfully (verification failed)`
                    }));
                });
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async saveSceneAs(path) {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'save-as-scene').then(() => {
                resolve((0, types_1.successResult)({ path, message: 'Scene save-as dialog opened' }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async closeScene() {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'close-scene').then(() => {
                resolve((0, types_1.successResult)(null, 'Scene closed successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    /**
     * `query-node-tree`'s resolved nodes never carry `__comps__`, so `buildHierarchy`'s
     * component branch below can never populate real data from it. `source/scene.ts`'s own
     * `getSceneHierarchy` walks the LIVE `cc.Node` tree instead and always has real
     * component data — go straight there when components are actually requested.
     */
    queryHierarchyViaScript(includeComponents) {
        const options = {
            name: 'cocos-mcp-server',
            method: 'getSceneHierarchy',
            args: [includeComponents]
        };
        return Editor.Message.request('scene', 'execute-scene-script', options).then((result) => {
            if (result && result.success) {
                return (0, types_1.successResult)(result.data, result.message);
            }
            return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Unknown error');
        });
    }
    async getSceneHierarchy(includeComponents = false) {
        // Issue #85: `includeComponents: true` was left as an error-only fallback that
        // only ran when `query-node-tree` REJECTED — never when it resolved successfully
        // without `__comps__`, which is the common case. Route straight to the
        // scene-script path whenever components are requested; the `includeComponents:
        // false` path below is UNCHANGED.
        if (includeComponents) {
            try {
                return await this.queryHierarchyViaScript(includeComponents);
            }
            catch (err) {
                return (0, types_1.errorResult)(`Scene script failed: ${err.message}`);
            }
        }
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree) => {
                if (tree) {
                    const hierarchy = this.buildHierarchy(tree, includeComponents);
                    resolve((0, types_1.successResult)(hierarchy));
                }
                else {
                    resolve((0, types_1.errorResult)('No scene hierarchy available'));
                }
            }).catch((err) => {
                this.queryHierarchyViaScript(includeComponents).then(resolve).catch((err2) => {
                    resolve((0, types_1.errorResult)(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }
    buildHierarchy(node, includeComponents) {
        const nodeInfo = {
            uuid: node.uuid,
            name: node.name,
            type: node.type,
            active: node.active,
            children: []
        };
        if (includeComponents && node.__comps__) {
            nodeInfo.components = node.__comps__.map((comp) => ({
                type: comp.__type__ || 'Unknown',
                enabled: comp.enabled !== undefined ? comp.enabled : true
            }));
        }
        if (node.children) {
            nodeInfo.children = node.children.map((child) => this.buildHierarchy(child, includeComponents));
        }
        return nodeInfo;
    }
}
exports.ManageScene = ManageScene;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjZW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1zY2VuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQW1GO0FBQ25GLGtEQUFnRDtBQUNoRCxvREFBbUQ7QUFDbkQsc0VBRXNDO0FBRXRDLHdHQUF3RztBQUN4RyxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQztBQVFuQyxNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsMFRBQTBULENBQUM7UUFDelUsWUFBTyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2pHLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLGFBQWEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxlQUFlLENBQUM7b0JBQzVGLFdBQVcsRUFBRSxxU0FBcVM7aUJBQ3JUO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsOERBQThEO2lCQUM5RTtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFNBQVM7b0JBQ2YsV0FBVyxFQUFFLDBKQUEwSjtvQkFDdkssT0FBTyxFQUFFLElBQUk7aUJBQ2hCO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsZ0NBQWdDO2lCQUNoRDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDJFQUEyRTtpQkFDM0Y7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxxQ0FBcUM7aUJBQ3JEO2dCQUNELGlCQUFpQixFQUFFO29CQUNmLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSxtRUFBbUU7b0JBQ2hGLE9BQU8sRUFBRSxLQUFLO2lCQUNqQjthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDN0MsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ25DLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUEsc0JBQVUsRUFBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssS0FBSyxDQUFDO1lBQ25GLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNoQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ2pFLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQzlDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNsQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFDLE9BQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQUEsSUFBQSxzQkFBVSxFQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQ0FBSSxLQUFLLENBQUMsQ0FBQSxFQUFBO1NBQy9GLENBQUM7SUFvaEJOLENBQUM7SUFsaEJXLEtBQUssQ0FBQyxlQUFlO1FBQ3pCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUMzQixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRTtnQkFDbEUsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUNwQixPQUFPLENBQUMsSUFBQSxxQkFBYSxFQUFDO3dCQUNsQixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxlQUFlO3dCQUNsQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7d0JBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksVUFBVTt3QkFDN0IsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJO3dCQUN0RCxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7cUJBQ3RELENBQUMsQ0FBQyxDQUFDO2dCQUNSLENBQUM7cUJBQU0sQ0FBQztvQkFDSixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQztnQkFDcEQsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQVUsRUFBRSxFQUFFO2dCQUNwQixNQUFNLE9BQU8sR0FBRztvQkFDWixJQUFJLEVBQUUsa0JBQWtCO29CQUN4QixNQUFNLEVBQUUscUJBQXFCO29CQUM3QixJQUFJLEVBQUUsRUFBRTtpQkFDWCxDQUFDO2dCQUNGLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFXLEVBQUUsRUFBRTtvQkFDbEYsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO3dCQUMzQixPQUFPLENBQUMsSUFBQSxxQkFBYSxFQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7b0JBQ3hELENBQUM7eUJBQU0sQ0FBQzt3QkFDSixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLENBQUEsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUssS0FBSSxlQUFlLENBQUMsQ0FBQyxDQUFDO29CQUMzRCxDQUFDO2dCQUNMLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQVcsRUFBRSxFQUFFO29CQUNyQixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLHNCQUFzQixHQUFHLENBQUMsT0FBTywwQkFBMEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEcsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZO1FBQ3RCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUMzQixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFO2dCQUMvQyxPQUFPLEVBQUUsd0JBQXdCO2FBQ3BDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFjLEVBQUUsRUFBRTtnQkFDdkIsTUFBTSxNQUFNLEdBQWdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUM5QyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7b0JBQ2hCLElBQUksRUFBRSxLQUFLLENBQUMsR0FBRztvQkFDZixJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUk7aUJBQ25CLENBQUMsQ0FBQyxDQUFDO2dCQUNKLE9BQU8sQ0FBQyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNuQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSyxLQUFLLENBQUMsU0FBUyxDQUFDLFNBQWlCLEVBQUUsV0FBb0IsSUFBSTtRQUMvRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDYixPQUFPLElBQUEsbUJBQVcsRUFBQyx1Q0FBdUMsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7UUFDRCxJQUFJLENBQUM7WUFDRCxNQUFNLElBQUksR0FBa0IsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzlGLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDUixPQUFPLElBQUEsbUJBQVcsRUFBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQzFDLENBQUM7WUFDRCxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUNYLE1BQU0sVUFBVSxHQUFHLE1BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLENBQUMsVUFBVSxFQUFFLGdCQUFnQixFQUFFLFNBQVMsQ0FBQyxDQUFDO2dCQUNsRyxJQUFJLFVBQVUsS0FBSyxLQUFLLEVBQUUsQ0FBQztvQkFDdkIsT0FBTyxJQUFBLG1CQUFXLEVBQ2QsK0NBQStDLFNBQVMsd0NBQXdDO3dCQUNoRyxrSUFBa0ksQ0FDckksQ0FBQztnQkFDTixDQUFDO1lBQ0wsQ0FBQztZQUNELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMxRCxNQUFNLEtBQUssR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM3RixJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDbEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsNEJBQTRCLFNBQVMscUVBQXFFLENBQUMsQ0FBQztZQUNuSSxDQUFDO1lBQ0QsT0FBTyxJQUFBLHFCQUFhLEVBQ2hCLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxFQUN4QixRQUFRO2dCQUNKLENBQUMsQ0FBQyxpQkFBaUIsU0FBUyxrRUFBa0U7Z0JBQzlGLENBQUMsQ0FBQyxpQkFBaUIsU0FBUyw2RUFBNkUsQ0FDaEgsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0EyQkc7SUFDSyxLQUFLLENBQUMsU0FBUztRQUNuQixNQUFNLFNBQVMsR0FBRyxNQUFNLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO1FBQzNELE1BQU0sV0FBVyxHQUFHLElBQUEsaUNBQVcsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUMzQyxNQUFNLGVBQWUsR0FBRyxJQUFBLDBDQUFvQixFQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXhELElBQUksQ0FBQztZQUNELE1BQU0sS0FBSyxHQUFZLE1BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3BGLElBQUksS0FBSyxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUNsQixPQUFPLElBQUEsbUJBQVcsRUFBQyxzRkFBc0YsQ0FBQyxDQUFDO1lBQy9HLENBQUM7UUFDTCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztRQUVELHFFQUFxRTtRQUNyRSxJQUFJLFdBQVcsR0FBbUIsSUFBSSxDQUFDO1FBQ3ZDLElBQUksQ0FBQztZQUNELFdBQVcsR0FBRyxDQUFDLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDO1FBQ2xGLENBQUM7UUFBQyxXQUFNLENBQUM7WUFDTCxnRkFBZ0Y7UUFDcEYsQ0FBQztRQUNELElBQUksV0FBVyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3ZCLE9BQU8sSUFBQSxtQkFBVyxFQUNkLG9GQUFvRjtnQkFDcEYscUZBQXFGO2dCQUNyRix3RkFBd0Y7Z0JBQ3hGLG9FQUFvRSxDQUN2RSxDQUFDO1FBQ04sQ0FBQztRQUVELCtFQUErRTtRQUMvRSxpRkFBaUY7UUFDakYsMENBQTBDO1FBQzFDLE1BQU0sUUFBUSxHQUNWLFNBQVMsS0FBSyxJQUFJO1lBQ2QsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFO1lBQzlGLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBRWxGLElBQUksUUFBUSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3pCLE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLGtCQUFrQixTQUFTLDZCQUE2QixRQUFRLENBQUMsYUFBYSxFQUFFO2dCQUN2RixJQUFJLGtCQUNBLElBQUksRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxJQUNsRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUN0RTtnQkFDRCxPQUFPLEVBQUUsSUFBSTthQUNoQixDQUFDO1FBQ04sQ0FBQztRQUVELElBQUksUUFBUSxDQUFDLE9BQU8sS0FBSyxTQUFTLEVBQUUsQ0FBQztZQUNqQyxPQUFPLElBQUEsbUJBQVcsRUFDZCxpRUFBaUUsUUFBUSxDQUFDLE1BQU0sSUFBSTtnQkFDcEYsNEZBQTRGO2dCQUM1RiwyRUFBMkUsQ0FDOUUsQ0FBQztRQUNOLENBQUM7UUFFRCx1RkFBdUY7UUFDdkYsb0ZBQW9GO1FBQ3BGLHNGQUFzRjtRQUN0RixnREFBZ0Q7UUFDaEQsTUFBTSxVQUFVLEdBQUcsU0FBUyxLQUFLLElBQUksSUFBSSxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztZQUNsRSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDO1lBQzlDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDWCxJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEMsT0FBTztnQkFDSCxPQUFPLEVBQUUsS0FBSztnQkFDZCxLQUFLLEVBQUUsVUFBVSxDQUFDLElBQUk7Z0JBQ3RCLElBQUksa0JBQUksSUFBSSxFQUFFLFNBQVMsRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLElBQUssVUFBVSxDQUFDLE1BQU0sQ0FBRTtnQkFDckcsT0FBTyxFQUFFLElBQUk7YUFDaEIsQ0FBQztRQUNOLENBQUM7UUFFRCxPQUFPLElBQUEscUJBQWEsZ0NBRVosS0FBSyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFDMUMsbUJBQW1CLEVBQUUsUUFBUSxDQUFDLE9BQU8sS0FBSyxVQUFVLElBQ2pELENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxFQUFFLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBQy9ELENBQUMsUUFBUSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEdBRXZFLFFBQVEsQ0FBQyxPQUFPLEtBQUssVUFBVTtZQUMzQixDQUFDLENBQUMsMEVBQTBFO1lBQzVFLENBQUMsQ0FBQyxxREFBcUQsQ0FDOUQsQ0FBQztJQUNOLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7O09BWUc7SUFDSyxLQUFLLENBQUMsbUJBQW1CLENBQzdCLFNBQWlCLEVBQ2pCLFdBQTBCLEVBQzFCLGVBQWtFO1FBRWxFLE1BQU0sVUFBVSxHQUFHLFdBQVcsS0FBSyxJQUFJO1lBQ25DLENBQUMsQ0FBQyxJQUFJO1lBQ04sQ0FBQyxDQUFDLE1BQU0sSUFBQSx3Q0FBa0IsRUFBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLHFCQUFxQixDQUFDLENBQUM7UUFFOUUsSUFBSSxhQUFhLEdBQWtCLElBQUksQ0FBQztRQUN4QyxJQUFJLGVBQWUsSUFBSSxlQUFlLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQy9DLGFBQWEsR0FBRyxJQUFBLDBDQUFvQixFQUFDLGVBQWUsRUFBRSxJQUFBLDBDQUFvQixFQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDM0YsQ0FBQztRQUVELE1BQU0sU0FBUyxHQUFHLFdBQVcsS0FBSyxJQUFJLElBQUksVUFBVSxLQUFLLElBQUksSUFBSSxVQUFVLEdBQUcsV0FBVyxDQUFDO1FBQzFGLG9GQUFvRjtRQUNwRiwwREFBMEQ7UUFDMUQsSUFBSSxTQUFTLElBQUksYUFBYSxFQUFFLENBQUM7WUFDN0IsT0FBTyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLENBQUM7UUFDckcsQ0FBQztRQUVELG1GQUFtRjtRQUNuRixtRkFBbUY7UUFDbkYscUZBQXFGO1FBQ3JGLGtCQUFrQjtRQUNsQixJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUN2QixPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUM7UUFDeEcsQ0FBQztRQUVELGtGQUFrRjtRQUNsRixxREFBcUQ7UUFDckQsT0FBTztZQUNILFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxJQUFJO1lBQzdFLE1BQU0sRUFBRSxHQUFHLFNBQVMsb0lBQW9JO1NBQzNKLENBQUM7SUFDTixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNLLEtBQUssQ0FBQyxzQkFBc0IsQ0FDaEMsVUFBa0I7O1FBRWxCLE1BQU0sT0FBTyxHQUFHLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsQ0FBQztRQUM1RCxNQUFNLFNBQVMsR0FBRyxJQUFBLDBDQUFvQixFQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ25ELElBQUksU0FBUyxLQUFLLElBQUk7WUFBRSxPQUFPLE9BQU8sQ0FBQztRQUV2QyxJQUFJLElBQUksR0FBbUIsSUFBSSxDQUFDO1FBQ2hDLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDM0UsTUFBTSxRQUFRLEdBQVUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUMzRSxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBLE1BQUEsUUFBUSxDQUFDLENBQUMsQ0FBQywwQ0FBRSxJQUFJLE1BQUksTUFBQSxNQUFBLFFBQVEsQ0FBQyxDQUFDLENBQUMsMENBQUUsS0FBSywwQ0FBRSxJQUFJLENBQUEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDaEcsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTyxPQUFPLENBQUM7WUFDOUIsTUFBTSxJQUFJLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1lBQ2hGLE1BQU0sTUFBTSxHQUFHLE1BQUEsTUFBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsTUFBTSwwQ0FBRSxLQUFLLG1DQUFJLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxNQUFNLENBQUM7WUFDbkQsSUFBSSxPQUFPLE1BQU0sS0FBSyxTQUFTO2dCQUFFLElBQUksR0FBRyxNQUFNLENBQUM7UUFDbkQsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNMLE9BQU8sT0FBTyxDQUFDO1FBQ25CLENBQUM7UUFDRCxJQUFJLElBQUksS0FBSyxJQUFJO1lBQUUsT0FBTyxPQUFPLENBQUM7UUFDbEMsSUFBSSxJQUFJLEtBQUssU0FBUztZQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBRTFFLE9BQU87WUFDSCxRQUFRLEVBQUUsS0FBSztZQUNmLE1BQU0sRUFBRSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUUsU0FBUyxFQUFFO1lBQ2hFLElBQUksRUFBRSxtQkFBbUIsVUFBVSx5Q0FBeUMsU0FBUywwQkFBMEI7Z0JBQzNHLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsWUFBWSxJQUFJLDREQUE0RDtnQkFDM0csb0dBQW9HO2dCQUNwRywyRUFBMkU7U0FDbEYsQ0FBQztJQUNOLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0ssS0FBSyxDQUFDLDJCQUEyQjs7UUFDckMsSUFBSSxTQUFTLEdBQWtCLElBQUksQ0FBQztRQUNwQyxJQUFJLENBQUM7WUFDRCxNQUFNLElBQUksR0FBUSxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQzNFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7Z0JBQUUsU0FBUyxHQUFHLENBQUEsTUFBQSxJQUFJLENBQUMsQ0FBQyxDQUFDLDBDQUFFLElBQUksS0FBSSxJQUFJLENBQUM7aUJBQ3RELElBQUksSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVE7Z0JBQUUsU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDO1FBQzdFLENBQUM7UUFBQyxXQUFNLENBQUM7WUFDTCxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3JCLENBQUM7UUFDRCxJQUFJLENBQUMsU0FBUztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBRTVCLElBQUksQ0FBQztZQUNELE9BQU8sQ0FBQyxNQUFNLElBQUEseUJBQVksRUFBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUNwRCxDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ0wsT0FBTyxJQUFJLENBQUM7UUFDaEIsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsV0FBVyxDQUFDLFNBQWlCLEVBQUUsUUFBZ0I7UUFDekQsSUFBSSxDQUFDLFNBQVMsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQzFCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDaEYsQ0FBQztRQUNELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUMzQixNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxJQUFJLFNBQVMsUUFBUSxDQUFDO1lBRTNGLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ2hDO29CQUNJLFVBQVUsRUFBRSxlQUFlO29CQUMzQixPQUFPLEVBQUUsU0FBUztvQkFDbEIsV0FBVyxFQUFFLENBQUM7b0JBQ2Qsa0JBQWtCLEVBQUUsRUFBRTtvQkFDdEIsU0FBUyxFQUFFLEVBQUU7b0JBQ2IsT0FBTyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtpQkFDM0I7Z0JBQ0Q7b0JBQ0ksVUFBVSxFQUFFLFVBQVU7b0JBQ3RCLE9BQU8sRUFBRSxTQUFTO29CQUNsQixXQUFXLEVBQUUsQ0FBQztvQkFDZCxrQkFBa0IsRUFBRSxFQUFFO29CQUN0QixTQUFTLEVBQUUsSUFBSTtvQkFDZixXQUFXLEVBQUUsRUFBRTtvQkFDZixTQUFTLEVBQUUsSUFBSTtvQkFDZixhQUFhLEVBQUUsRUFBRTtvQkFDakIsU0FBUyxFQUFFLElBQUk7b0JBQ2YsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtvQkFDMUQsT0FBTyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO29CQUNsRSxTQUFTLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO29CQUM1RCxXQUFXLEVBQUUsQ0FBQztvQkFDZCxRQUFRLEVBQUUsVUFBVTtvQkFDcEIsUUFBUSxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtvQkFDM0QsbUJBQW1CLEVBQUUsS0FBSztvQkFDMUIsVUFBVSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtvQkFDM0IsS0FBSyxFQUFFLE9BQU87aUJBQ2pCO2dCQUNEO29CQUNJLFVBQVUsRUFBRSxpQkFBaUI7b0JBQzdCLFNBQVMsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7b0JBQzFCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7b0JBQ3pCLEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7b0JBQ3RCLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUU7aUJBQzVCO2dCQUNEO29CQUNJLFVBQVUsRUFBRSxnQkFBZ0I7b0JBQzVCLGNBQWMsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRTtvQkFDdEYsV0FBVyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO29CQUNuRixjQUFjLEVBQUUsS0FBSztvQkFDckIsV0FBVyxFQUFFLEtBQUs7b0JBQ2xCLGtCQUFrQixFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO29CQUNuRixlQUFlLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7aUJBQ25GO2dCQUNEO29CQUNJLFVBQVUsRUFBRSxlQUFlO29CQUMzQixrQkFBa0IsRUFBRSxDQUFDO29CQUNyQixZQUFZLEVBQUUsSUFBSTtvQkFDbEIsU0FBUyxFQUFFLElBQUk7b0JBQ2YsaUJBQWlCLEVBQUUsQ0FBQztvQkFDcEIsZ0JBQWdCLEVBQUUsSUFBSTtvQkFDdEIsYUFBYSxFQUFFLElBQUk7b0JBQ25CLFVBQVUsRUFBRSxLQUFLO29CQUNqQixTQUFTLEVBQUUsSUFBSTtvQkFDZixtQkFBbUIsRUFBRSxJQUFJO29CQUN6QixnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QixnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QixnQkFBZ0IsRUFBRSxDQUFDO2lCQUN0QjtnQkFDRDtvQkFDSSxVQUFVLEVBQUUsWUFBWTtvQkFDeEIsT0FBTyxFQUFFLENBQUM7b0JBQ1YsV0FBVyxFQUFFLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFO29CQUMvRSxVQUFVLEVBQUUsS0FBSztvQkFDakIsYUFBYSxFQUFFLEdBQUc7b0JBQ2xCLFdBQVcsRUFBRSxHQUFHO29CQUNoQixTQUFTLEVBQUUsR0FBRztvQkFDZCxXQUFXLEVBQUUsQ0FBQztvQkFDZCxTQUFTLEVBQUUsR0FBRztvQkFDZCxXQUFXLEVBQUUsR0FBRztvQkFDaEIsV0FBVyxFQUFFLEtBQUs7aUJBQ3JCO2dCQUNEO29CQUNJLFVBQVUsRUFBRSxlQUFlO29CQUMzQixVQUFVLEVBQUUsS0FBSztvQkFDakIsU0FBUyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRTtvQkFDeEUsU0FBUyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRTtvQkFDckUsUUFBUSxFQUFFLENBQUM7aUJBQ2Q7YUFDSixFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUVaLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQVcsRUFBRSxFQUFFO2dCQUM1RixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUU7O29CQUNuQyxNQUFNLFlBQVksR0FBRyxNQUFBLFNBQVMsQ0FBQyxJQUFJLDBDQUFFLElBQUksQ0FBQyxDQUFDLEtBQVUsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ3RGLE9BQU8sQ0FBQyxJQUFBLHFCQUFhLEVBQUM7d0JBQ2xCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSTt3QkFDakIsR0FBRyxFQUFFLE1BQU0sQ0FBQyxHQUFHO3dCQUNmLElBQUksRUFBRSxTQUFTO3dCQUNmLE9BQU8sRUFBRSxVQUFVLFNBQVMsd0JBQXdCO3dCQUNwRCxhQUFhLEVBQUUsQ0FBQyxDQUFDLFlBQVk7cUJBQ2hDLENBQUMsQ0FBQyxDQUFDO2dCQUNSLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUU7b0JBQ1YsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQzt3QkFDbEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO3dCQUNqQixHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUc7d0JBQ2YsSUFBSSxFQUFFLFNBQVM7d0JBQ2YsT0FBTyxFQUFFLFVBQVUsU0FBUyw4Q0FBOEM7cUJBQzdFLENBQUMsQ0FBQyxDQUFDO2dCQUNSLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQVk7UUFDbEMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzFCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBZSxDQUFDLE9BQU8sRUFBRSxlQUFlLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUNoRSxPQUFPLENBQUMsSUFBQSxxQkFBYSxFQUFDLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM3RSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxVQUFVO1FBQ3BCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRTtZQUMzQixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsYUFBYSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtnQkFDckQsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQyxJQUFJLEVBQUUsMkJBQTJCLENBQUMsQ0FBQyxDQUFDO1lBQzlELENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQVUsRUFBRSxFQUFFO2dCQUNwQixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSyx1QkFBdUIsQ0FBQyxpQkFBMEI7UUFDdEQsTUFBTSxPQUFPLEdBQUc7WUFDWixJQUFJLEVBQUUsa0JBQWtCO1lBQ3hCLE1BQU0sRUFBRSxtQkFBbUI7WUFDM0IsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUM7U0FDNUIsQ0FBQztRQUNGLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQVcsRUFBRSxFQUFFO1lBQ3pGLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDM0IsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDdEQsQ0FBQztZQUNELE9BQU8sSUFBQSxtQkFBVyxFQUFDLENBQUEsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLEtBQUssS0FBSSxlQUFlLENBQUMsQ0FBQztRQUN6RCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsb0JBQTZCLEtBQUs7UUFDOUQsK0VBQStFO1FBQy9FLGlGQUFpRjtRQUNqRix1RUFBdUU7UUFDdkUsK0VBQStFO1FBQy9FLGtDQUFrQztRQUNsQyxJQUFJLGlCQUFpQixFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDO2dCQUNELE9BQU8sTUFBTSxJQUFJLENBQUMsdUJBQXVCLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNqRSxDQUFDO1lBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztnQkFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsd0JBQXdCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQzlELENBQUM7UUFDTCxDQUFDO1FBRUQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzNCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFO2dCQUNsRSxJQUFJLElBQUksRUFBRSxDQUFDO29CQUNQLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGlCQUFpQixDQUFDLENBQUM7b0JBQy9ELE9BQU8sQ0FBQyxJQUFBLHFCQUFhLEVBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztxQkFBTSxDQUFDO29CQUNKLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7Z0JBQ3BCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFXLEVBQUUsRUFBRTtvQkFDaEYsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BHLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxjQUFjLENBQUMsSUFBUyxFQUFFLGlCQUEwQjtRQUN4RCxNQUFNLFFBQVEsR0FBUTtZQUNsQixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDZixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbkIsUUFBUSxFQUFFLEVBQUU7U0FDZixDQUFDO1FBRUYsSUFBSSxpQkFBaUIsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDdEMsUUFBUSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQztnQkFDckQsSUFBSSxFQUFFLElBQUksQ0FBQyxRQUFRLElBQUksU0FBUztnQkFDaEMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJO2FBQzVELENBQUMsQ0FBQyxDQUFDO1FBQ1IsQ0FBQztRQUVELElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2hCLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFVLEVBQUUsRUFBRSxDQUNqRCxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxDQUNoRCxDQUFDO1FBQ04sQ0FBQztRQUVELE9BQU8sUUFBUSxDQUFDO0lBQ3BCLENBQUM7Q0FDSjtBQXZrQkQsa0NBdWtCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIFNjZW5lSW5mbywgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBjb2VyY2VCb29sIH0gZnJvbSAnLi4vdXRpbHMvbm9ybWFsaXplJztcbmltcG9ydCB7IHJlc29sdmVBc3NldCB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LXBhdGgnO1xuaW1wb3J0IHtcbiAgICByZWFkT3ZlcnJpZGVTbmFwc2hvdCwgZGVzY3JpYmVPdmVycmlkZUxvc3MsIHN0YXRNdGltZU1zLCB3YWl0Rm9yRmlsZVJld3JpdGUsIHJlYWRQcmVmYWJSb290QWN0aXZlXG59IGZyb20gJy4uL3V0aWxzL3NhdmUtYXJ0aWZhY3QtZ3VhcmQnO1xuXG4vKiogTG9uZ2VzdCBgc2F2ZVNjZW5lYCB3YWl0cyBmb3IgdGhlIHNjZW5lIGZpbGUgdG8gYmUgcmV3cml0dGVuIGJlZm9yZSBjYWxsaW5nIHRoZSBzYXZlIHVuY29uZmlybWVkLiAqL1xuY29uc3QgU0FWRV9XUklURV9USU1FT1VUX01TID0gMjAwMDtcblxuLyoqXG4gKiBXaGF0IHRoZSBhcnRpZmFjdCBzYXlzIGFib3V0IGEgcmVwb3J0ZWQtc3VjY2Vzc2Z1bCBzYXZlLiBgdW52ZXJpZmllZGAgaXMgYSBmaXJzdC1jbGFzc1xuICogb3V0Y29tZSwgbm90IGEgc29mdCBmYWlsdXJlIOKAlCBcIndlIGNvdWxkIG5vdCBjaGVja1wiIG11c3QgbmV2ZXIgcmVuZGVyIGFzIFwiaXQgd29ya2VkXCIuXG4gKi9cbnR5cGUgQXJ0aWZhY3RWZXJkaWN0ID0gJ3ZlcmlmaWVkJyB8ICdkcm9wcGVkJyB8ICd1bnZlcmlmaWVkJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVNjZW5lIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NjZW5lJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2Ugc2NlbmVzIGluIHRoZSBwcm9qZWN0LiBBY3Rpb25zOiBnZXRfY3VycmVudCwgbGlzdCwgb3Blbiwgc2F2ZSwgY3JlYXRlLCBzYXZlX2FzLCBjbG9zZSwgZ2V0X2hpZXJhcmNoeS4gVXNlIGdldF9jdXJyZW50IHRvIGNoZWNrIGlmIGEgc2NlbmUgaXMgb3BlbiBiZWZvcmUgbm9kZS9jb21wb25lbnQgb3BlcmF0aW9ucy4gVXNlIGdldF9oaWVyYXJjaHkgdG8gdW5kZXJzdGFuZCBzY2VuZSBzdHJ1Y3R1cmUgYmVmb3JlIG1vZGlmeWluZyBub2Rlcy4gUHJlcmVxdWlzaXRlczogcHJvamVjdCBtdXN0IGJlIG9wZW4gaW4gQ29jb3MgQ3JlYXRvci4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2dldF9jdXJyZW50JywgJ2xpc3QnLCAnb3BlbicsICdzYXZlJywgJ2NyZWF0ZScsICdzYXZlX2FzJywgJ2Nsb3NlJywgJ2dldF9oaWVyYXJjaHknXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2N1cnJlbnQnLCAnbGlzdCcsICdvcGVuJywgJ3NhdmUnLCAnY3JlYXRlJywgJ3NhdmVfYXMnLCAnY2xvc2UnLCAnZ2V0X2hpZXJhcmNoeSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGdldF9jdXJyZW50PWdldCBvcGVuIHNjZW5lIGluZm8sIGxpc3Q9bGlzdCBhbGwgc2NlbmVzIGluIHByb2plY3QsIG9wZW49b3BlbiBhIHNjZW5lIGJ5IHBhdGgsIHNhdmU9c2F2ZSBjdXJyZW50IHNjZW5lLCBjcmVhdGU9Y3JlYXRlIG5ldyBzY2VuZSBhc3NldCwgc2F2ZV9hcz1zYXZlIHNjZW5lIGFzIG5ldyBmaWxlIChvcGVucyBkaWFsb2cpLCBjbG9zZT1jbG9zZSBjdXJyZW50IHNjZW5lLCBnZXRfaGllcmFyY2h5PWdldCBmdWxsIG5vZGUgdHJlZSBvZiBjdXJyZW50IHNjZW5lJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjZW5lUGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW29wZW5dIFNjZW5lIGZpbGUgcGF0aCAoZS5nLiwgZGI6Ly9hc3NldHMvc2NlbmVzL01haW4uc2NlbmUpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlaW1wb3J0OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW29wZW5dIFJlaW1wb3J0IHRoZSBzY2VuZSBhc3NldCBmaXJzdCBzbyBvdXQtb2YtYmFuZCBlZGl0cyB0byB0aGUgLnNjZW5lIGZpbGUgYXJlIHJlYWQgZnJvbSBkaXNrIChkZWZhdWx0IHRydWUpLiBmYWxzZSA9IG9wZW4gdGhlIGVkaXRvclxcJ3MgY2FjaGVkIGNvcHkuJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2NlbmVOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBOYW1lIG9mIHRoZSBuZXcgc2NlbmUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2F2ZVBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIFBhdGggdG8gc2F2ZSB0aGUgc2NlbmUgKGUuZy4sIGRiOi8vYXNzZXRzL3NjZW5lcy9OZXdTY2VuZS5zY2VuZSknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NhdmVfYXNdIFBhdGggdG8gc2F2ZSB0aGUgc2NlbmUgYXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgaW5jbHVkZUNvbXBvbmVudHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZ2V0X2hpZXJhcmNoeV0gSW5jbHVkZSBjb21wb25lbnQgaW5mb3JtYXRpb24gaW4gaGllcmFyY2h5IG91dHB1dCcsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGdldF9jdXJyZW50OiAoYXJncykgPT4gdGhpcy5nZXRDdXJyZW50U2NlbmUoKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMuZ2V0U2NlbmVMaXN0KCksXG4gICAgICAgIG9wZW46IChhcmdzKSA9PiB0aGlzLm9wZW5TY2VuZShhcmdzLnNjZW5lUGF0aCwgY29lcmNlQm9vbChhcmdzLnJlaW1wb3J0KSAhPT0gZmFsc2UpLFxuICAgICAgICBzYXZlOiAoYXJncykgPT4gdGhpcy5zYXZlU2NlbmUoKSxcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVTY2VuZShhcmdzLnNjZW5lTmFtZSwgYXJncy5zYXZlUGF0aCksXG4gICAgICAgIHNhdmVfYXM6IChhcmdzKSA9PiB0aGlzLnNhdmVTY2VuZUFzKGFyZ3MucGF0aCksXG4gICAgICAgIGNsb3NlOiAoYXJncykgPT4gdGhpcy5jbG9zZVNjZW5lKCksXG4gICAgICAgIGdldF9oaWVyYXJjaHk6IChhcmdzKSA9PiB0aGlzLmdldFNjZW5lSGllcmFyY2h5KGNvZXJjZUJvb2woYXJncy5pbmNsdWRlQ29tcG9uZW50cykgPz8gZmFsc2UpXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q3VycmVudFNjZW5lKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpLnRoZW4oKHRyZWU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0cmVlICYmIHRyZWUudXVpZCkge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdHJlZS5uYW1lIHx8ICdDdXJyZW50IFNjZW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IHRyZWUudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IHRyZWUudHlwZSB8fCAnY2MuU2NlbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlOiB0cmVlLmFjdGl2ZSAhPT0gdW5kZWZpbmVkID8gdHJlZS5hY3RpdmUgOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgbm9kZUNvdW50OiB0cmVlLmNoaWxkcmVuID8gdHJlZS5jaGlsZHJlbi5sZW5ndGggOiAwXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KCdObyBzY2VuZSBkYXRhIGF2YWlsYWJsZScpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnZ2V0Q3VycmVudFNjZW5lSW5mbycsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFtdXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIG9wdGlvbnMpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnIyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFNjZW5lTGlzdCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7XG4gICAgICAgICAgICAgICAgcGF0dGVybjogJ2RiOi8vYXNzZXRzLyoqLyouc2NlbmUnXG4gICAgICAgICAgICB9KS50aGVuKChyZXN1bHRzOiBhbnlbXSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHNjZW5lczogU2NlbmVJbmZvW10gPSByZXN1bHRzLm1hcChhc3NldCA9PiAoe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBhc3NldC5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBhc3NldC51cmwsXG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IGFzc2V0LnV1aWRcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHNjZW5lcykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYHNjZW5lOm9wZW4tc2NlbmVgIHNlcnZlcyB0aGUgZWRpdG9yJ3MgQ0FDSEVEIGNvcHkgb2YgYSBzY2VuZSBhc3NldDogYWZ0ZXIgdGhlIGAuc2NlbmVgXG4gICAgICogZmlsZSBpcyBlZGl0ZWQgb3V0IG9mIGJhbmQgaXQgcmVzb2x2ZXMgc3VjY2Vzc2Z1bGx5IHdoaWxlIHRoZSBlZGl0b3Iga2VlcHMgc2hvd2luZyB0aGVcbiAgICAgKiBvbGQgY29udGVudCwgYW5kIHRoZSBuZXh0IGVkaXRvci1kcml2ZW4gc2F2ZSBzaWxlbnRseSBvdmVyd3JpdGVzIHRoZSBkaXNrIGVkaXQgKCM2NSxcbiAgICAgKiBsaXZlLWNvbmZpcm1lZCDigJQgb25seSBgbWFuYWdlX2Fzc2V0IHJlaW1wb3J0YCBmb3JjZWQgYSByZS1yZWFkKS4gT3BlbiB0aGVyZWZvcmVcbiAgICAgKiByZWltcG9ydHMgdGhlIHNjZW5lIGFzc2V0IGZpcnN0IHNvIHRoZSBlZGl0b3IgcmVhZHMgdGhlIGZpbGUgYXMgaXQgaXMgb24gZGlzaywgYW5kXG4gICAgICogcmVwb3J0cyB0aGF0IGl0IGRpZC4gYHJlaW1wb3J0OiBmYWxzZWAgb3B0cyBvdXQgKGtlZXBzIHRoZSBlZGl0b3IncyBpbi1tZW1vcnkgY29weSkuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBvcGVuU2NlbmUoc2NlbmVQYXRoOiBzdHJpbmcsIHJlaW1wb3J0OiBib29sZWFuID0gdHJ1ZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXNjZW5lUGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzY2VuZVBhdGggaXMgcmVxdWlyZWQgZm9yIGFjdGlvbj1vcGVuJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHV1aWQ6IHN0cmluZyB8IG51bGwgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgc2NlbmVQYXRoKTtcbiAgICAgICAgICAgIGlmICghdXVpZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnU2NlbmUgbm90IGZvdW5kJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVpbXBvcnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWltcG9ydGVkID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnYXNzZXQtZGInLCAncmVpbXBvcnQtYXNzZXQnLCBzY2VuZVBhdGgpO1xuICAgICAgICAgICAgICAgIGlmIChyZWltcG9ydGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICBgYXNzZXQtZGI6cmVpbXBvcnQtYXNzZXQgcmV0dXJuZWQgZmFsc2UgZm9yICcke3NjZW5lUGF0aH0nIOKAlCB0aGUgZWRpdG9yIHJlamVjdGVkIHRoZSByZWltcG9ydCwgYCArXG4gICAgICAgICAgICAgICAgICAgICAgICAnc28gdGhlIHNjZW5lIHdvdWxkIGJlIG9wZW5lZCBmcm9tIGl0cyBjYWNoZWQgY29weS4gTm90aGluZyB3YXMgb3BlbmVkLiBQYXNzIHJlaW1wb3J0PWZhbHNlIHRvIG9wZW4gdGhlIGNhY2hlZCBjb3B5IGRlbGliZXJhdGVseS4nXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnb3Blbi1zY2VuZScsIHV1aWQpO1xuICAgICAgICAgICAgY29uc3QgcmVhZHkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1pcy1yZWFkeScpLmNhdGNoKCgpID0+IHVuZGVmaW5lZCk7XG4gICAgICAgICAgICBpZiAocmVhZHkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBvcGVuLXNjZW5lIHJlc29sdmVkIGZvciAnJHtzY2VuZVBhdGh9JyBidXQgdGhlIHNjZW5lIGlzIG5vdCByZWFkeSBhZnRlcndhcmQg4oCUIGl0IGRpZCBub3QgZmluaXNoIGxvYWRpbmcuYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICB7IHJlaW1wb3J0ZWQ6IHJlaW1wb3J0IH0sXG4gICAgICAgICAgICAgICAgcmVpbXBvcnRcbiAgICAgICAgICAgICAgICAgICAgPyBgU2NlbmUgb3BlbmVkOiAke3NjZW5lUGF0aH0gKGFzc2V0IHJlaW1wb3J0ZWQgZmlyc3QsIHNvIHRoZSBlZGl0b3IgcmVhZCB0aGUgZmlsZSBmcm9tIGRpc2spYFxuICAgICAgICAgICAgICAgICAgICA6IGBTY2VuZSBvcGVuZWQ6ICR7c2NlbmVQYXRofSAoZnJvbSB0aGUgZWRpdG9yJ3MgY2FjaGVkIGNvcHkg4oCUIG91dC1vZi1iYW5kIGRpc2sgZWRpdHMgYXJlIE5PVCBwaWNrZWQgdXApYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgc2NlbmU6c2F2ZS1zY2VuZWAgcmVzb2x2ZXMgdG8gYSBgYm9vbGVhbmAgKHBlciB0aGUgc2hpcHBlZCAzLjguNyBtZXNzYWdlIHR5cGVzLFxuICAgICAqIGBub2RlX21vZHVsZXMvQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9tZXNzYWdlLmQudHNgKSxcbiAgICAgKiBub3QgYHZvaWRgIOKAlCB0aGUgb2xkIGNvZGUgZGlzY2FyZGVkIHRoYXQgcmVzdWx0IGFuZCByZXBvcnRlZCBzdWNjZXNzIHVuY29uZGl0aW9uYWxseVxuICAgICAqIG9uY2UgdGhlIHByb21pc2Ugc2V0dGxlZCwgd2l0aCBubyB2ZXJpZmljYXRpb24gYW5kIG5vIGAuY2F0Y2hgIGZvciBhIHJlamVjdGVkIHNhdmUuXG4gICAgICogQSBgZmFsc2VgIHJlc3VsdCBpcyB0cmVhdGVkIGFzIGEgZmFpbGVkIHNhdmUgKCM2KS5cbiAgICAgKlxuICAgICAqIEEgcmVzb2x2ZWQgYHRydWVgLCBhbmQgYSBgcXVlcnktZGlydHlgIHJlYWRpbmcgb2YgYGZhbHNlYCBpbW1lZGlhdGVseSBhZnRlciBpdCwgYXJlXG4gICAgICogYm90aCBzdGF0ZW1lbnRzIGFib3V0IHRoZSBFRElUT1IncyBpbi1tZW1vcnkgdmlldyDigJQgbmVpdGhlciBpcyBhIHN0YXRlbWVudCBhYm91dCB0aGVcbiAgICAgKiBmaWxlLiAjNidzIHJlZ3Jlc3Npb24gcmVwb3J0ICgyMDI2LTA5LTIxKSBpcyBleGFjdGx5IHRoYXQgZ2FwOiBzdHJpY3RseSBzZXF1ZW50aWFsXG4gICAgICogY2FsbHMsIGBzYXZlYCByZXR1cm5pbmcgYHRydWVgIHRocmVlIHRpbWVzLCBgcXVlcnlfZGlydHlgIHJlYWRpbmcgYGZhbHNlYCwgYW5kIHRoZVxuICAgICAqIGAuc2NlbmVgIGZpbGUncyBtdGltZSBmcm96ZW4gYXQgaXRzIHByZS1lZGl0IHRpbWVzdGFtcCB3aXRoIHRoZSBlZGl0IGFic2VudCBmcm9tIHRoZVxuICAgICAqIEpTT04uIFRoZSBlZGl0b3IgYmVsaWV2ZWQgaXQgaGFkIHNhdmVkOyBpdCBoYWQgbm90LlxuICAgICAqXG4gICAgICogU28gdGhlIGFydGlmYWN0IGl0c2VsZiBpcyB0aGUgYXJiaXRlciwgb24gdHdvIHJlYWRzIG9mIGl0OlxuICAgICAqXG4gICAgICogIC0gKiptdGltZSBkaWQgbm90IGFkdmFuY2UqKiDihpIgbm90aGluZyB3YXMgc2VyaWFsaXNlZC4gSGFyZCBmYWlsdXJlICgjNikuXG4gICAgICogIC0gKipgY2MuVGFyZ2V0T3ZlcnJpZGVJbmZvYCByZWNvcmRzIGRyb3BwZWQqKiDihpIgdGhlIGZpbGUgd2FzIHJld3JpdHRlbiwgYnV0IGxvc3NpbHkuXG4gICAgICogICAgUmVwb3J0ZWQgYXMgYSBsb3VkIG5vbi1zdWNjZXNzIHdpdGggdGhlIGxvc3QgYHByb3BlcnR5UGF0aGBzIG5hbWVkICgjNzgpLiBBXG4gICAgICogICAgbm8tZWRpdCByb3VuZC10cmlwIGxvc2luZyB0aGVzZSByZWNvcmRzIGlzIHRoZSByZXBvcnRlZCByZXBybzogMjUgYmVmb3JlLCAyMyBhZnRlcixcbiAgICAgKiAgICBhbmQgdGhlIG9sZCByZXNwb25zZSB3YXMgYnl0ZS1pZGVudGljYWwgdG8gYSBsb3NzbGVzcyBzYXZlJ3MuXG4gICAgICpcbiAgICAgKiBCb3RoIGNoZWNrcyBhcmUgYmVzdC1lZmZvcnQgaW4gdGhlIHNlbnNlIHRoYXQgYW4gdW5yZWFkYWJsZSBhcnRpZmFjdCB5aWVsZHNcbiAgICAgKiBcInVudmVyaWZpYWJsZVwiIHJhdGhlciB0aGFuIGEgcGFzcyDigJQgdGhlIHJlc3VsdCBzYXlzIHdoaWNoIGl0IHdhcywgc28gYSBjYWxsZXIgaXMgbmV2ZXJcbiAgICAgKiB0b2xkIFwidmVyaWZpZWRcIiBvbiB0aGUgc3RyZW5ndGggb2YgYSByZWFkIHRoYXQgZGlkIG5vdCBoYXBwZW4uIFRoZSBtdXRhdGluZyBjYWxsc1xuICAgICAqIGFoZWFkIG9mIHRoaXMgc2F2ZSBhcmUgc2VyaWFsaXNlZCBvbiBvbmUgY2hhaW4gKGB0b29scy9tdXRhdGlvbi1xdWV1ZS50c2ApLCBhbmRcbiAgICAgKiBgbWFuYWdlX3NjZW5lX3F1ZXJ5YCByZWNvbmNpbGVzIHRoZSByYXcgZGlydHkgZmxhZyBhZ2FpbnN0IHRoYXQgcXVldWUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlU2NlbmUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHNjZW5lUGF0aCA9IGF3YWl0IHRoaXMucmVzb2x2ZUN1cnJlbnRTY2VuZUZpbGVQYXRoKCk7XG4gICAgICAgIGNvbnN0IG10aW1lQmVmb3JlID0gc3RhdE10aW1lTXMoc2NlbmVQYXRoKTtcbiAgICAgICAgY29uc3Qgb3ZlcnJpZGVzQmVmb3JlID0gcmVhZE92ZXJyaWRlU25hcHNob3Qoc2NlbmVQYXRoKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc2F2ZWQ6IGJvb2xlYW4gPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdzYXZlLXNjZW5lJyk7XG4gICAgICAgICAgICBpZiAoc2F2ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzY2VuZTpzYXZlLXNjZW5lIHJldHVybmVkIGZhbHNlIOKAlCB0aGUgZWRpdG9yIHJlamVjdGVkIHRoZSBzYXZlLiBOb3RoaW5nIHdhcyB3cml0dGVuLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDEuIERpcnR5LWZsYWcgYmFja3N0b3Ag4oCUIHRoZSBlZGl0b3Igc3RpbGwgaG9sZHMgdW5jb21taXR0ZWQgZWRpdHMuXG4gICAgICAgIGxldCBlZGl0b3JEaXJ0eTogYm9vbGVhbiB8IG51bGwgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZWRpdG9yRGlydHkgPSAoYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZGlydHknKSkgPT09IHRydWU7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gQmVzdC1lZmZvcnQ6IHVucmVhZGFibGUgZGlydHkgc3RhdGUgbXVzdCBub3QgdHVybiBhIHJlYWwgc2F2ZSBpbnRvIGEgZmFpbHVyZS5cbiAgICAgICAgfVxuICAgICAgICBpZiAoZWRpdG9yRGlydHkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAnc2F2ZS1zY2VuZSByZXBvcnRlZCBzdWNjZXNzLCBidXQgdGhlIHNjZW5lIGlzIHN0aWxsIGRpcnR5IGltbWVkaWF0ZWx5IGFmdGVyd2FyZCDigJQgJyArXG4gICAgICAgICAgICAgICAgJ2EgcGVuZGluZyBlZGl0IHdhcyBub3QgY2FwdHVyZWQgaW4gdGhpcyBzYXZlLiBUaGlzIHR5cGljYWxseSBtZWFucyBhIG11dGF0aW5nIGNhbGwgJyArXG4gICAgICAgICAgICAgICAgJyhtYW5hZ2Vfbm9kZS9tYW5hZ2VfY29tcG9uZW50L2V0Yy4pIHdhcyBpc3N1ZWQgY29uY3VycmVudGx5IG9yIGJhdGNoZWQgd2l0aCB0aGlzIHNhdmUgJyArXG4gICAgICAgICAgICAgICAgJ2luc3RlYWQgb2YgYXdhaXRlZCBmaXJzdDsgaXNzdWUgY2FsbHMgc2VxdWVudGlhbGx5IGFuZCByZXRyeSBzYXZlLidcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAyLiBBcnRpZmFjdCBjaGVja3MuIGBzY2VuZVBhdGggPT09IG51bGxgIG1lYW5zIHRoZSBvbi1kaXNrIGZpbGUgY291bGQgbm90IGJlXG4gICAgICAgIC8vIHJlc29sdmVkICh1bnNhdmVkIHNjZW5lLCB1bmtub3duIGFzc2V0KTsgdGhhdCBpcyByZXBvcnRlZCBhcyB1bnZlcmlmaWVkLCBuZXZlclxuICAgICAgICAvLyBmb2xkZWQgaW50byBlaXRoZXIgYSBwYXNzIG9yIGEgZmFpbHVyZS5cbiAgICAgICAgY29uc3QgYXJ0aWZhY3Q6IHsgdmVyaWZpZWQ6IGJvb2xlYW47IHZlcmRpY3Q6IEFydGlmYWN0VmVyZGljdDsgcmVhc29uOiBzdHJpbmcgfCBudWxsOyBtdGltZU1zOiBudW1iZXIgfCBudWxsOyBsb3N0T3ZlcnJpZGVzOiBzdHJpbmcgfCBudWxsIH0gPVxuICAgICAgICAgICAgc2NlbmVQYXRoID09PSBudWxsXG4gICAgICAgICAgICAgICAgPyB7IHZlcmlmaWVkOiBmYWxzZSwgdmVyZGljdDogJ3VudmVyaWZpZWQnLCByZWFzb246IG51bGwsIG10aW1lTXM6IG51bGwsIGxvc3RPdmVycmlkZXM6IG51bGwgfVxuICAgICAgICAgICAgICAgIDogYXdhaXQgdGhpcy52ZXJpZnlTYXZlZEFydGlmYWN0KHNjZW5lUGF0aCwgbXRpbWVCZWZvcmUsIG92ZXJyaWRlc0JlZm9yZSk7XG5cbiAgICAgICAgaWYgKGFydGlmYWN0Lmxvc3RPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBTY2VuZSBzYXZlZCB0byAke3NjZW5lUGF0aH0sIGJ1dCB0aGUgc2F2ZSBXQVMgTE9TU1k6ICR7YXJ0aWZhY3QubG9zdE92ZXJyaWRlc31gLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZTogc2NlbmVQYXRoLCBkaXJ0eTogZmFsc2UsIGVkaXRvckRpcnR5LCBwZXJzaXN0ZW5jZVZlcmlmaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAuLi4oYXJ0aWZhY3QubXRpbWVNcyAhPT0gbnVsbCA/IHsgbXRpbWVNczogYXJ0aWZhY3QubXRpbWVNcyB9IDoge30pXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpc0Vycm9yOiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFydGlmYWN0LnZlcmRpY3QgPT09ICdkcm9wcGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgIGBzYXZlLXNjZW5lIHJlcG9ydGVkIHN1Y2Nlc3MgYnV0IHRoZSB3cml0ZSBkaWQgbm90IHJlYWNoIGRpc2s6ICR7YXJ0aWZhY3QucmVhc29ufS4gYCArXG4gICAgICAgICAgICAgICAgJ1RoaXMgaXMgdGhlICM2IGZhbHNlLXN1Y2Nlc3Mgc2hhcGUg4oCUIHZlcmlmeSB0aGUgZmlsZSB5b3Vyc2VsZiwgYW5kIGlmIHRoZSBlZGl0IGlzIGFic2VudCwgJyArXG4gICAgICAgICAgICAgICAgJ3ByZXNzIEN0cmwrUyBpbiB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3IgYW5kIHJlcG9ydCB0aGUgb2NjdXJyZW5jZSBvbiAjNi4nXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gMy4gUHJlZmFiLWVkaXQgbW9kZSAoIzk5IGl0ZW0gNCk6IHRoZSBlZGl0b3IncyBvd24gcHJlZmFiIHNlcmlhbGl6ZXIgd2FzIHJlcG9ydGVkIHRvXG4gICAgICAgIC8vIHdyaXRlIHRoZSByb290IGFzIGBfYWN0aXZlOiB0cnVlYCB3aGF0ZXZlciB0aGUgbGl2ZSByb290J3Mgc3RhdGUuIFRoZSBhcnRpZmFjdCBpc1xuICAgICAgICAvLyByZWFkIGJhY2sgYW5kIGNvbXBhcmVkIHdpdGggdGhlIGxpdmUgcm9vdDsgYSBkaXNhZ3JlZW1lbnQgZmFpbHMgdGhlIHNhdmUgaW5zdGVhZCBvZlxuICAgICAgICAvLyBiZWluZyByZXBvcnRlZCBhcyBcIlNjZW5lIHNhdmVkIHN1Y2Nlc3NmdWxseVwiLlxuICAgICAgICBjb25zdCByb290QWN0aXZlID0gc2NlbmVQYXRoICE9PSBudWxsICYmIHNjZW5lUGF0aC5lbmRzV2l0aCgnLnByZWZhYicpXG4gICAgICAgICAgICA/IGF3YWl0IHRoaXMudmVyaWZ5UHJlZmFiUm9vdEFjdGl2ZShzY2VuZVBhdGgpXG4gICAgICAgICAgICA6IG51bGw7XG4gICAgICAgIGlmIChyb290QWN0aXZlICYmIHJvb3RBY3RpdmUuZmxpcCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogcm9vdEFjdGl2ZS5mbGlwLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgZmlsZTogc2NlbmVQYXRoLCBkaXJ0eTogZmFsc2UsIGVkaXRvckRpcnR5LCByb290QWN0aXZlVmVyaWZpZWQ6IGZhbHNlLCAuLi5yb290QWN0aXZlLmRldGFpbCB9LFxuICAgICAgICAgICAgICAgIGlzRXJyb3I6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBkaXJ0eTogZmFsc2UsIGVkaXRvckRpcnR5LCBmaWxlOiBzY2VuZVBhdGgsXG4gICAgICAgICAgICAgICAgcGVyc2lzdGVuY2VWZXJpZmllZDogYXJ0aWZhY3QudmVyZGljdCA9PT0gJ3ZlcmlmaWVkJyxcbiAgICAgICAgICAgICAgICAuLi4ocm9vdEFjdGl2ZSA/IHsgcm9vdEFjdGl2ZVZlcmlmaWVkOiByb290QWN0aXZlLnZlcmlmaWVkIH0gOiB7fSksXG4gICAgICAgICAgICAgICAgLi4uKGFydGlmYWN0Lm10aW1lTXMgIT09IG51bGwgPyB7IG10aW1lTXM6IGFydGlmYWN0Lm10aW1lTXMgfSA6IHt9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFydGlmYWN0LnZlcmRpY3QgPT09ICd2ZXJpZmllZCdcbiAgICAgICAgICAgICAgICA/ICdTY2VuZSBzYXZlZCBzdWNjZXNzZnVsbHkgKGZpbGUgcmV3cml0dGVuIGFuZCBvdmVycmlkZSByZWNvcmRzIHByZXNlcnZlZCknXG4gICAgICAgICAgICAgICAgOiAnU2NlbmUgc2F2ZWQgc3VjY2Vzc2Z1bGx5IChkaXJ0eSBzdGF0ZSB1bnZlcmlmaWFibGUpJ1xuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpcm0gdGhlIHNhdmUgYWN0dWFsbHkgcmVhY2hlZCB0aGUgYXJ0aWZhY3QsIGFuZCB0aGF0IGl0IGRpZCBub3QgbG9zZSBvdmVycmlkZVxuICAgICAqIHJlY29yZHMgb24gdGhlIHdheS5cbiAgICAgKlxuICAgICAqIFRocmVlIG91dGNvbWVzLCBkZWxpYmVyYXRlbHkgbm90IHR3byDigJQgXCJ3ZSBjb3VsZCBub3QgY2hlY2tcIiBtdXN0IHN0YXkgZGlzdGluZ3Vpc2hhYmxlXG4gICAgICogZnJvbSBib3RoIFwid2UgY2hlY2tlZCBhbmQgaXQgbGFuZGVkXCIgYW5kIFwid2UgY2hlY2tlZCBhbmQgaXQgZGlkIG5vdFwiOlxuICAgICAqXG4gICAgICogIC0gYHZlcmlmaWVkYCAg4oCUIHRoZSB3cml0ZSBpcyBjb25maXJtZWQsIGFuZCBubyBvdmVycmlkZSByZWNvcmQgd2FzIGxvc3QuXG4gICAgICogIC0gYGRyb3BwZWRgICAg4oCUIHRoZSB3cml0ZSBpcyBjb25maXJtZWQgQUJTRU5UIChhbiBleGlzdGluZyBmaWxlIHdob3NlIG10aW1lIGRpZCBub3RcbiAgICAgKiAgICAgICAgICAgICAgICAgIGFkdmFuY2UpLiBFdmlkZW5jZSBvZiB0aGUgIzYgZmFsc2Ugc3VjY2VzczsgcmVwb3J0ZWQgYXMgYSBmYWlsdXJlLlxuICAgICAqICAtIGB1bnZlcmlmaWVkYOKAlCBubyBhcnRpZmFjdCBldmlkZW5jZSBlaXRoZXIgd2F5IChubyBmaWxlIGF0IHRoZSByZXNvbHZlZCBwYXRoLCBmaWxlXG4gICAgICogICAgICAgICAgICAgICAgICB1bnJlYWRhYmxlKS4gUmVwb3J0ZWQgYXMgZXhwbGljaXRseSB1bnZlcmlmaWVkLCBuZXZlciBhcyBhIHBhc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyB2ZXJpZnlTYXZlZEFydGlmYWN0KFxuICAgICAgICBzY2VuZVBhdGg6IHN0cmluZyxcbiAgICAgICAgbXRpbWVCZWZvcmU6IG51bWJlciB8IG51bGwsXG4gICAgICAgIG92ZXJyaWRlc0JlZm9yZTogeyB0b3RhbDogbnVtYmVyOyBwcm9wZXJ0eVBhdGhzOiBzdHJpbmdbXSB9IHwgbnVsbFxuICAgICk6IFByb21pc2U8eyB2ZXJpZmllZDogYm9vbGVhbjsgdmVyZGljdDogQXJ0aWZhY3RWZXJkaWN0OyByZWFzb246IHN0cmluZyB8IG51bGw7IG10aW1lTXM6IG51bWJlciB8IG51bGw7IGxvc3RPdmVycmlkZXM6IHN0cmluZyB8IG51bGwgfT4ge1xuICAgICAgICBjb25zdCBtdGltZUFmdGVyID0gbXRpbWVCZWZvcmUgPT09IG51bGxcbiAgICAgICAgICAgID8gbnVsbFxuICAgICAgICAgICAgOiBhd2FpdCB3YWl0Rm9yRmlsZVJld3JpdGUoc2NlbmVQYXRoLCBtdGltZUJlZm9yZSwgU0FWRV9XUklURV9USU1FT1VUX01TKTtcblxuICAgICAgICBsZXQgbG9zdE92ZXJyaWRlczogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChvdmVycmlkZXNCZWZvcmUgJiYgb3ZlcnJpZGVzQmVmb3JlLnRvdGFsID4gMCkge1xuICAgICAgICAgICAgbG9zdE92ZXJyaWRlcyA9IGRlc2NyaWJlT3ZlcnJpZGVMb3NzKG92ZXJyaWRlc0JlZm9yZSwgcmVhZE92ZXJyaWRlU25hcHNob3Qoc2NlbmVQYXRoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXdyaXR0ZW4gPSBtdGltZUJlZm9yZSAhPT0gbnVsbCAmJiBtdGltZUFmdGVyICE9PSBudWxsICYmIG10aW1lQWZ0ZXIgPiBtdGltZUJlZm9yZTtcbiAgICAgICAgLy8gQW4gb3ZlcnJpZGUgbG9zcyBwcm92ZXMgdGhlIGZpbGUgd2FzIHJld3JpdHRlbjsgZG8gbm90IGFsc28gZGVtYW5kIGEgbW92ZWQgbXRpbWUsXG4gICAgICAgIC8vIHdoaWNoIGEgY29hcnNlIGZpbGVzeXN0ZW0gdGltZXN0YW1wIGNvdWxkIGZhaWwgdG8gc2hvdy5cbiAgICAgICAgaWYgKHJld3JpdHRlbiB8fCBsb3N0T3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2ZXJpZmllZDogdHJ1ZSwgdmVyZGljdDogJ3ZlcmlmaWVkJywgcmVhc29uOiBudWxsLCBtdGltZU1zOiBtdGltZUFmdGVyLCBsb3N0T3ZlcnJpZGVzIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBObyBmaWxlIGF0IHRoZSByZXNvbHZlZCBwYXRoIOKAlCBiZWZvcmUgQU5EIGFmdGVyLiBUaGVyZSBpcyBub3RoaW5nIHRvIGNvbXBhcmUsIHNvXG4gICAgICAgIC8vIHRoaXMgaXMgXCJ1bnZlcmlmaWFibGVcIiwgbm90IGEgZHJvcHBlZCB3cml0ZTogYSBzY2VuZSB0aGF0IGhhcyBuZXZlciBiZWVuIHdyaXR0ZW5cbiAgICAgICAgLy8gdG8gZGlzayBsZWdpdGltYXRlbHkgaGFzIG5vIGFydGlmYWN0LCBhbmQgYSBtaXMtcmVzb2x2ZWQgcGF0aCBtdXN0IG5vdCBiZSByZXBvcnRlZFxuICAgICAgICAvLyBhcyBhIGRhdGEgbG9zcy5cbiAgICAgICAgaWYgKG10aW1lQmVmb3JlID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIHZlcmRpY3Q6ICd1bnZlcmlmaWVkJywgcmVhc29uOiBudWxsLCBtdGltZU1zOiBudWxsLCBsb3N0T3ZlcnJpZGVzOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBIGZpbGUgZXhpc3RlZCBhbmQgdGhlIHNhdmUgZGlkIG5vdCB0b3VjaCBpdC4gVGhhdCBpcyB0aGUgIzYgZGVmZWN0OiB0aGUgZWRpdG9yXG4gICAgICAgIC8vIHJlcG9ydGVkIHN1Y2Nlc3Mgb3ZlciBhIHdyaXRlIHRoYXQgbmV2ZXIgaGFwcGVuZWQuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsIHZlcmRpY3Q6ICdkcm9wcGVkJywgbXRpbWVNczogbXRpbWVBZnRlciwgbG9zdE92ZXJyaWRlczogbnVsbCxcbiAgICAgICAgICAgIHJlYXNvbjogYCR7c2NlbmVQYXRofSBleGlzdGVkIGJlZm9yZSB0aGUgc2F2ZSBhbmQgd2FzIG5vdCByZXdyaXR0ZW4gYnkgaXQgKG10aW1lIHVuY2hhbmdlZCksIHNvIHRoZSByZXBvcnRlZC1zdWNjZXNzZnVsIHNhdmUgZGlkIG5vdCBzZXJpYWxpc2UgYW55dGhpbmdgXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ29tcGFyZSB0aGUgc2F2ZWQgYC5wcmVmYWJgJ3Mgcm9vdCBgX2FjdGl2ZWAgd2l0aCB0aGUgbGl2ZSByb290IG5vZGUncyBgYWN0aXZlYC5cbiAgICAgKlxuICAgICAqIEluIHByZWZhYi1lZGl0IG1vZGUgYHNjZW5lOnF1ZXJ5LW5vZGUtdHJlZWAgeWllbGRzIGEgd3JhcHBlciB3aG9zZSBzaW5nbGUgY2hpbGQgaXMgdGhlXG4gICAgICogcHJlZmFiJ3Mgcm9vdCBub2RlOyB3aXRoIGFueSBvdGhlciBzaGFwZSB0aGVyZSBpcyBubyB1bmFtYmlndW91cyBsaXZlIHJvb3QgdG8gY29tcGFyZSxcbiAgICAgKiBzbyB0aGUgcmVzdWx0IGlzIGB2ZXJpZmllZDogZmFsc2VgICh1bmtub3duKSByYXRoZXIgdGhhbiBhIGd1ZXNzLiBVbmtub3duIG9uIGVpdGhlciBzaWRlXG4gICAgICogbmV2ZXIgZmFpbHMgdGhlIHNhdmUg4oCUIG9ubHkgYSBjb25maXJtZWQgZGlzYWdyZWVtZW50IGRvZXMuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyB2ZXJpZnlQcmVmYWJSb290QWN0aXZlKFxuICAgICAgICBwcmVmYWJQYXRoOiBzdHJpbmdcbiAgICApOiBQcm9taXNlPHsgdmVyaWZpZWQ6IGJvb2xlYW47IGZsaXA6IHN0cmluZyB8IG51bGw7IGRldGFpbDogUmVjb3JkPHN0cmluZywgYW55PiB9PiB7XG4gICAgICAgIGNvbnN0IHVua25vd24gPSB7IHZlcmlmaWVkOiBmYWxzZSwgZmxpcDogbnVsbCwgZGV0YWlsOiB7fSB9O1xuICAgICAgICBjb25zdCBwZXJzaXN0ZWQgPSByZWFkUHJlZmFiUm9vdEFjdGl2ZShwcmVmYWJQYXRoKTtcbiAgICAgICAgaWYgKHBlcnNpc3RlZCA9PT0gbnVsbCkgcmV0dXJuIHVua25vd247XG5cbiAgICAgICAgbGV0IGxpdmU6IGJvb2xlYW4gfCBudWxsID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3QgY2hpbGRyZW46IGFueVtdID0gQXJyYXkuaXNBcnJheSh0cmVlPy5jaGlsZHJlbikgPyB0cmVlLmNoaWxkcmVuIDogW107XG4gICAgICAgICAgICBjb25zdCByb290VXVpZCA9IGNoaWxkcmVuLmxlbmd0aCA9PT0gMSA/IChjaGlsZHJlblswXT8udXVpZCB8fCBjaGlsZHJlblswXT8udmFsdWU/LnV1aWQpIDogbnVsbDtcbiAgICAgICAgICAgIGlmICghcm9vdFV1aWQpIHJldHVybiB1bmtub3duO1xuICAgICAgICAgICAgY29uc3QgZHVtcDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHJvb3RVdWlkKTtcbiAgICAgICAgICAgIGNvbnN0IGFjdGl2ZSA9IGR1bXA/LmFjdGl2ZT8udmFsdWUgPz8gZHVtcD8uYWN0aXZlO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBhY3RpdmUgPT09ICdib29sZWFuJykgbGl2ZSA9IGFjdGl2ZTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gdW5rbm93bjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGl2ZSA9PT0gbnVsbCkgcmV0dXJuIHVua25vd247XG4gICAgICAgIGlmIChsaXZlID09PSBwZXJzaXN0ZWQpIHJldHVybiB7IHZlcmlmaWVkOiB0cnVlLCBmbGlwOiBudWxsLCBkZXRhaWw6IHt9IH07XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHZlcmlmaWVkOiBmYWxzZSxcbiAgICAgICAgICAgIGRldGFpbDogeyBsaXZlUm9vdEFjdGl2ZTogbGl2ZSwgcGVyc2lzdGVkUm9vdEFjdGl2ZTogcGVyc2lzdGVkIH0sXG4gICAgICAgICAgICBmbGlwOiBgUHJlZmFiIHNhdmVkIHRvICR7cHJlZmFiUGF0aH0sIGJ1dCB0aGUgc2F2ZWQgcm9vdCBub2RlIGhhcyBfYWN0aXZlPSR7cGVyc2lzdGVkfSB3aGlsZSB0aGUgbGl2ZSByb290IGlzIGAgK1xuICAgICAgICAgICAgICAgIGAke2xpdmUgPyAnYWN0aXZlJyA6ICdpbmFjdGl2ZSd9IChhY3RpdmU9JHtsaXZlfSkuIFRoZSBlZGl0b3IncyBwcmVmYWItbW9kZSBzZXJpYWxpemVyIHJld3JvdGUgdGhlIHJvb3QncyBgICtcbiAgICAgICAgICAgICAgICBgYWN0aXZhdGlvbiBzdGF0ZSAoIzk5IGl0ZW0gNCk7IHRoZSAucHJlZmFiIG9uIGRpc2sgZG9lcyBub3QgbWF0Y2ggd2hhdCB5b3UgZWRpdGVkLiBGaXggdGhlIHJvb3QncyBgICtcbiAgICAgICAgICAgICAgICBgYWN0aXZlIGZsYWcgaW4gdGhlIGVkaXRvciBhbmQgc2F2ZSBhZ2Fpbiwgb3IgY29ycmVjdCBfYWN0aXZlIGluIHRoZSBmaWxlLmBcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXNvbHZlIHRoZSBvbi1kaXNrIHBhdGggb2YgdGhlIHNjZW5lIGN1cnJlbnRseSBvcGVuIGluIHRoZSBlZGl0b3IuXG4gICAgICpcbiAgICAgKiBgc2NlbmU6cXVlcnktbm9kZS10cmVlYCB5aWVsZHMgdGhlIG9wZW4gc2NlbmUncyBST09UIG5vZGUsIHdob3NlIHV1aWQgaXMgdGhlIHNjZW5lXG4gICAgICogYXNzZXQncyB1dWlkIGZvciBhIHNhdmVkIHNjZW5lIOKAlCBlbm91Z2ggdG8gcmVzb2x2ZSB0aGUgZmlsZSB0aHJvdWdoIGBhc3NldC1kYmAuIEFcbiAgICAgKiBuZXZlci1zYXZlZCBzY2VuZSBoYXMgbm8gYXNzZXQgZmlsZSwgc28gdGhpcyByZXR1cm5zIG51bGwgYW5kIHRoZSBjYWxsZXIgcmVwb3J0cyB0aGVcbiAgICAgKiBhcnRpZmFjdCBhcyB1bnZlcmlmaWFibGUgcmF0aGVyIHRoYW4gZ3Vlc3NpbmcgYSBwYXRoLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgcmVzb2x2ZUN1cnJlbnRTY2VuZUZpbGVQYXRoKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xuICAgICAgICBsZXQgc2NlbmVVdWlkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkodHJlZSkpIHNjZW5lVXVpZCA9IHRyZWVbMF0/LnV1aWQgfHwgbnVsbDtcbiAgICAgICAgICAgIGVsc2UgaWYgKHRyZWUgJiYgdHlwZW9mIHRyZWUgPT09ICdvYmplY3QnKSBzY2VuZVV1aWQgPSB0cmVlLnV1aWQgfHwgbnVsbDtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICBzY2VuZVV1aWQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGlmICghc2NlbmVVdWlkKSByZXR1cm4gbnVsbDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIChhd2FpdCByZXNvbHZlQXNzZXQoc2NlbmVVdWlkKSkuZmlsZVBhdGg7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVNjZW5lKHNjZW5lTmFtZTogc3RyaW5nLCBzYXZlUGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghc2NlbmVOYW1lIHx8ICFzYXZlUGF0aCkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzY2VuZU5hbWUgYW5kIHNhdmVQYXRoIGFyZSByZXF1aXJlZCBmb3IgYWN0aW9uPWNyZWF0ZScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZnVsbFBhdGggPSBzYXZlUGF0aC5lbmRzV2l0aCgnLnNjZW5lJykgPyBzYXZlUGF0aCA6IGAke3NhdmVQYXRofS8ke3NjZW5lTmFtZX0uc2NlbmVgO1xuXG4gICAgICAgICAgICBjb25zdCBzY2VuZUNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShbXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuU2NlbmVBc3NldFwiLFxuICAgICAgICAgICAgICAgICAgICBcIl9uYW1lXCI6IHNjZW5lTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfb2JqRmxhZ3NcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgICAgICAgICBcIl9uYXRpdmVcIjogXCJcIixcbiAgICAgICAgICAgICAgICAgICAgXCJzY2VuZVwiOiB7IFwiX19pZF9fXCI6IDEgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuU2NlbmVcIixcbiAgICAgICAgICAgICAgICAgICAgXCJfbmFtZVwiOiBzY2VuZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIFwiX29iakZsYWdzXCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgXCJfcGFyZW50XCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX2NoaWxkcmVuXCI6IFtdLFxuICAgICAgICAgICAgICAgICAgICBcIl9hY3RpdmVcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfY29tcG9uZW50c1wiOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgXCJfcHJlZmFiXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX2xwb3NcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogMCwgXCJ5XCI6IDAsIFwielwiOiAwIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX2xyb3RcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuUXVhdFwiLCBcInhcIjogMCwgXCJ5XCI6IDAsIFwielwiOiAwLCBcIndcIjogMSB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9sc2NhbGVcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogMSwgXCJ5XCI6IDEsIFwielwiOiAxIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX21vYmlsaXR5XCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX2xheWVyXCI6IDEwNzM3NDE4MjQsXG4gICAgICAgICAgICAgICAgICAgIFwiX2V1bGVyXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IDAsIFwieVwiOiAwLCBcInpcIjogMCB9LFxuICAgICAgICAgICAgICAgICAgICBcImF1dG9SZWxlYXNlQXNzZXRzXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcIl9nbG9iYWxzXCI6IHsgXCJfX2lkX19cIjogMiB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9pZFwiOiBcInNjZW5lXCJcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlNjZW5lR2xvYmFsc1wiLFxuICAgICAgICAgICAgICAgICAgICBcImFtYmllbnRcIjogeyBcIl9faWRfX1wiOiAzIH0sXG4gICAgICAgICAgICAgICAgICAgIFwic2t5Ym94XCI6IHsgXCJfX2lkX19cIjogNCB9LFxuICAgICAgICAgICAgICAgICAgICBcImZvZ1wiOiB7IFwiX19pZF9fXCI6IDUgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJvY3RyZWVcIjogeyBcIl9faWRfX1wiOiA2IH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLkFtYmllbnRJbmZvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiX3NreUNvbG9ySERSXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzRcIiwgXCJ4XCI6IDAuMiwgXCJ5XCI6IDAuNSwgXCJ6XCI6IDAuOCwgXCJ3XCI6IDAuNTIwODMzIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX3NreUNvbG9yXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzRcIiwgXCJ4XCI6IDAuMiwgXCJ5XCI6IDAuNSwgXCJ6XCI6IDAuOCwgXCJ3XCI6IDAuNTIwODMzIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX3NreUlsbHVtSERSXCI6IDIwMDAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9za3lJbGx1bVwiOiAyMDAwMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZ3JvdW5kQWxiZWRvSERSXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzRcIiwgXCJ4XCI6IDAuMiwgXCJ5XCI6IDAuMiwgXCJ6XCI6IDAuMiwgXCJ3XCI6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZ3JvdW5kQWxiZWRvXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzRcIiwgXCJ4XCI6IDAuMiwgXCJ5XCI6IDAuMiwgXCJ6XCI6IDAuMiwgXCJ3XCI6IDEgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuU2t5Ym94SW5mb1wiLFxuICAgICAgICAgICAgICAgICAgICBcIl9lbnZMaWdodGluZ1R5cGVcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZW52bWFwSERSXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX2Vudm1hcFwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9lbnZtYXBMb2RDb3VudFwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9kaWZmdXNlTWFwSERSXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX2RpZmZ1c2VNYXBcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZW5hYmxlZFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfdXNlSERSXCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwiX2VkaXRhYmxlTWF0ZXJpYWxcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfcmVmbGVjdGlvbkhEUlwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9yZWZsZWN0aW9uTWFwXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX3JvdGF0aW9uQW5nbGVcIjogMFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuRm9nSW5mb1wiLFxuICAgICAgICAgICAgICAgICAgICBcIl90eXBlXCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ0NvbG9yXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLkNvbG9yXCIsIFwiclwiOiAyMDAsIFwiZ1wiOiAyMDAsIFwiYlwiOiAyMDAsIFwiYVwiOiAyNTUgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZW5hYmxlZFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nRGVuc2l0eVwiOiAwLjMsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ1N0YXJ0XCI6IDAuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nRW5kXCI6IDMwMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nQXR0ZW5cIjogNSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nVG9wXCI6IDEuNSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nUmFuZ2VcIjogMS4yLFxuICAgICAgICAgICAgICAgICAgICBcIl9hY2N1cmF0ZVwiOiBmYWxzZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuT2N0cmVlSW5mb1wiLFxuICAgICAgICAgICAgICAgICAgICBcIl9lbmFibGVkXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcIl9taW5Qb3NcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogLTEwMjQsIFwieVwiOiAtMTAyNCwgXCJ6XCI6IC0xMDI0IH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX21heFBvc1wiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiAxMDI0LCBcInlcIjogMTAyNCwgXCJ6XCI6IDEwMjQgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZGVwdGhcIjogOFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0sIG51bGwsIDIpO1xuXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBmdWxsUGF0aCwgc2NlbmVDb250ZW50KS50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZ2V0U2NlbmVMaXN0KCkudGhlbigoc2NlbmVMaXN0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNyZWF0ZWRTY2VuZSA9IHNjZW5lTGlzdC5kYXRhPy5maW5kKChzY2VuZTogYW55KSA9PiBzY2VuZS51dWlkID09PSByZXN1bHQudXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiByZXN1bHQudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybDogcmVzdWx0LnVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHNjZW5lTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBTY2VuZSAnJHtzY2VuZU5hbWV9JyBjcmVhdGVkIHN1Y2Nlc3NmdWxseWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBzY2VuZVZlcmlmaWVkOiAhIWNyZWF0ZWRTY2VuZVxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBzY2VuZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgU2NlbmUgJyR7c2NlbmVOYW1lfScgY3JlYXRlZCBzdWNjZXNzZnVsbHkgKHZlcmlmaWNhdGlvbiBmYWlsZWQpYFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNhdmVTY2VuZUFzKHBhdGg6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3NjZW5lJywgJ3NhdmUtYXMtc2NlbmUnKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoeyBwYXRoLCBtZXNzYWdlOiAnU2NlbmUgc2F2ZS1hcyBkaWFsb2cgb3BlbmVkJyB9KSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNsb3NlU2NlbmUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY2xvc2Utc2NlbmUnKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ1NjZW5lIGNsb3NlZCBzdWNjZXNzZnVsbHknKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgcXVlcnktbm9kZS10cmVlYCdzIHJlc29sdmVkIG5vZGVzIG5ldmVyIGNhcnJ5IGBfX2NvbXBzX19gLCBzbyBgYnVpbGRIaWVyYXJjaHlgJ3NcbiAgICAgKiBjb21wb25lbnQgYnJhbmNoIGJlbG93IGNhbiBuZXZlciBwb3B1bGF0ZSByZWFsIGRhdGEgZnJvbSBpdC4gYHNvdXJjZS9zY2VuZS50c2AncyBvd25cbiAgICAgKiBgZ2V0U2NlbmVIaWVyYXJjaHlgIHdhbGtzIHRoZSBMSVZFIGBjYy5Ob2RlYCB0cmVlIGluc3RlYWQgYW5kIGFsd2F5cyBoYXMgcmVhbFxuICAgICAqIGNvbXBvbmVudCBkYXRhIOKAlCBnbyBzdHJhaWdodCB0aGVyZSB3aGVuIGNvbXBvbmVudHMgYXJlIGFjdHVhbGx5IHJlcXVlc3RlZC5cbiAgICAgKi9cbiAgICBwcml2YXRlIHF1ZXJ5SGllcmFyY2h5VmlhU2NyaXB0KGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IG9wdGlvbnMgPSB7XG4gICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsXG4gICAgICAgICAgICBtZXRob2Q6ICdnZXRTY2VuZUhpZXJhcmNoeScsXG4gICAgICAgICAgICBhcmdzOiBbaW5jbHVkZUNvbXBvbmVudHNdXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIG9wdGlvbnMpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChyZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yJyk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U2NlbmVIaWVyYXJjaHkoaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4gPSBmYWxzZSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICAvLyBJc3N1ZSAjODU6IGBpbmNsdWRlQ29tcG9uZW50czogdHJ1ZWAgd2FzIGxlZnQgYXMgYW4gZXJyb3Itb25seSBmYWxsYmFjayB0aGF0XG4gICAgICAgIC8vIG9ubHkgcmFuIHdoZW4gYHF1ZXJ5LW5vZGUtdHJlZWAgUkVKRUNURUQg4oCUIG5ldmVyIHdoZW4gaXQgcmVzb2x2ZWQgc3VjY2Vzc2Z1bGx5XG4gICAgICAgIC8vIHdpdGhvdXQgYF9fY29tcHNfX2AsIHdoaWNoIGlzIHRoZSBjb21tb24gY2FzZS4gUm91dGUgc3RyYWlnaHQgdG8gdGhlXG4gICAgICAgIC8vIHNjZW5lLXNjcmlwdCBwYXRoIHdoZW5ldmVyIGNvbXBvbmVudHMgYXJlIHJlcXVlc3RlZDsgdGhlIGBpbmNsdWRlQ29tcG9uZW50czpcbiAgICAgICAgLy8gZmFsc2VgIHBhdGggYmVsb3cgaXMgVU5DSEFOR0VELlxuICAgICAgICBpZiAoaW5jbHVkZUNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMucXVlcnlIaWVyYXJjaHlWaWFTY3JpcHQoaW5jbHVkZUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpLnRoZW4oKHRyZWU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0cmVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhpZXJhcmNoeSA9IHRoaXMuYnVpbGRIaWVyYXJjaHkodHJlZSwgaW5jbHVkZUNvbXBvbmVudHMpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoaGllcmFyY2h5KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnTm8gc2NlbmUgaGllcmFyY2h5IGF2YWlsYWJsZScpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMucXVlcnlIaWVyYXJjaHlWaWFTY3JpcHQoaW5jbHVkZUNvbXBvbmVudHMpLnRoZW4ocmVzb2x2ZSkuY2F0Y2goKGVycjI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoYERpcmVjdCBBUEkgZmFpbGVkOiAke2Vyci5tZXNzYWdlfSwgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIyLm1lc3NhZ2V9YCkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYnVpbGRIaWVyYXJjaHkobm9kZTogYW55LCBpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IGFueSB7XG4gICAgICAgIGNvbnN0IG5vZGVJbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICB1dWlkOiBub2RlLnV1aWQsXG4gICAgICAgICAgICBuYW1lOiBub2RlLm5hbWUsXG4gICAgICAgICAgICB0eXBlOiBub2RlLnR5cGUsXG4gICAgICAgICAgICBhY3RpdmU6IG5vZGUuYWN0aXZlLFxuICAgICAgICAgICAgY2hpbGRyZW46IFtdXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzICYmIG5vZGUuX19jb21wc19fKSB7XG4gICAgICAgICAgICBub2RlSW5mby5jb21wb25lbnRzID0gbm9kZS5fX2NvbXBzX18ubWFwKChjb21wOiBhbnkpID0+ICh7XG4gICAgICAgICAgICAgICAgdHlwZTogY29tcC5fX3R5cGVfXyB8fCAnVW5rbm93bicsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkICE9PSB1bmRlZmluZWQgPyBjb21wLmVuYWJsZWQgOiB0cnVlXG4gICAgICAgICAgICB9KSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgbm9kZUluZm8uY2hpbGRyZW4gPSBub2RlLmNoaWxkcmVuLm1hcCgoY2hpbGQ6IGFueSkgPT5cbiAgICAgICAgICAgICAgICB0aGlzLmJ1aWxkSGllcmFyY2h5KGNoaWxkLCBpbmNsdWRlQ29tcG9uZW50cylcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbm9kZUluZm87XG4gICAgfVxufVxuIl19