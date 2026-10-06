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
        return (0, types_1.successResult)(Object.assign({ dirty: false, editorDirty, file: scenePath, persistenceVerified: artifact.verdict === 'verified' }, (artifact.mtimeMs !== null ? { mtimeMs: artifact.mtimeMs } : {})), artifact.verdict === 'verified'
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjZW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1zY2VuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQW1GO0FBQ25GLGtEQUFnRDtBQUNoRCxvREFBbUQ7QUFDbkQsc0VBRXNDO0FBRXRDLHdHQUF3RztBQUN4RyxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQztBQVFuQyxNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsMFRBQTBULENBQUM7UUFDelUsWUFBTyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2pHLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLGFBQWEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxlQUFlLENBQUM7b0JBQzVGLFdBQVcsRUFBRSxxU0FBcVM7aUJBQ3JUO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsOERBQThEO2lCQUM5RTtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFNBQVM7b0JBQ2YsV0FBVyxFQUFFLDBKQUEwSjtvQkFDdkssT0FBTyxFQUFFLElBQUk7aUJBQ2hCO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsZ0NBQWdDO2lCQUNoRDtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDJFQUEyRTtpQkFDM0Y7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxxQ0FBcUM7aUJBQ3JEO2dCQUNELGlCQUFpQixFQUFFO29CQUNmLElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSxtRUFBbUU7b0JBQ2hGLE9BQU8sRUFBRSxLQUFLO2lCQUNqQjthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDN0MsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ25DLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUEsc0JBQVUsRUFBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssS0FBSyxDQUFDO1lBQ25GLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNoQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQ2pFLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQzlDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNsQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFDLE9BQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQUEsSUFBQSxzQkFBVSxFQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQ0FBSSxLQUFLLENBQUMsQ0FBQSxFQUFBO1NBQy9GLENBQUM7SUEyZE4sQ0FBQztJQXpkVyxLQUFLLENBQUMsZUFBZTtRQUN6QixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDM0IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUU7Z0JBQ2xFLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDcEIsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQzt3QkFDbEIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUksZUFBZTt3QkFDbEMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLFVBQVU7d0JBQzdCLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSTt3QkFDdEQsU0FBUyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO3FCQUN0RCxDQUFDLENBQUMsQ0FBQztnQkFDUixDQUFDO3FCQUFNLENBQUM7b0JBQ0osT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BELENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsTUFBTSxPQUFPLEdBQUc7b0JBQ1osSUFBSSxFQUFFLGtCQUFrQjtvQkFDeEIsTUFBTSxFQUFFLHFCQUFxQjtvQkFDN0IsSUFBSSxFQUFFLEVBQUU7aUJBQ1gsQ0FBQztnQkFDRixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBVyxFQUFFLEVBQUU7b0JBQ2xGLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQzt3QkFDM0IsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO29CQUN4RCxDQUFDO3lCQUFNLENBQUM7d0JBQ0osT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxDQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxLQUFLLEtBQUksZUFBZSxDQUFDLENBQUMsQ0FBQztvQkFDM0QsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFXLEVBQUUsRUFBRTtvQkFDckIsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxzQkFBc0IsR0FBRyxDQUFDLE9BQU8sMEJBQTBCLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BHLENBQUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWTtRQUN0QixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDM0IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRTtnQkFDL0MsT0FBTyxFQUFFLHdCQUF3QjthQUNwQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBYyxFQUFFLEVBQUU7Z0JBQ3ZCLE1BQU0sTUFBTSxHQUFnQixPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztvQkFDOUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJO29CQUNoQixJQUFJLEVBQUUsS0FBSyxDQUFDLEdBQUc7b0JBQ2YsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJO2lCQUNuQixDQUFDLENBQUMsQ0FBQztnQkFDSixPQUFPLENBQUMsSUFBQSxxQkFBYSxFQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDbkMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0ssS0FBSyxDQUFDLFNBQVMsQ0FBQyxTQUFpQixFQUFFLFdBQW9CLElBQUk7UUFDL0QsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2IsT0FBTyxJQUFBLG1CQUFXLEVBQUMsdUNBQXVDLENBQUMsQ0FBQztRQUNoRSxDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0QsTUFBTSxJQUFJLEdBQWtCLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztZQUM5RixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1IsT0FBTyxJQUFBLG1CQUFXLEVBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUMxQyxDQUFDO1lBQ0QsSUFBSSxRQUFRLEVBQUUsQ0FBQztnQkFDWCxNQUFNLFVBQVUsR0FBRyxNQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBZSxDQUFDLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsQ0FBQztnQkFDbEcsSUFBSSxVQUFVLEtBQUssS0FBSyxFQUFFLENBQUM7b0JBQ3ZCLE9BQU8sSUFBQSxtQkFBVyxFQUNkLCtDQUErQyxTQUFTLHdDQUF3Qzt3QkFDaEcsa0lBQWtJLENBQ3JJLENBQUM7Z0JBQ04sQ0FBQztZQUNMLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDMUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0YsSUFBSSxLQUFLLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ2xCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLDRCQUE0QixTQUFTLHFFQUFxRSxDQUFDLENBQUM7WUFDbkksQ0FBQztZQUNELE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsRUFDeEIsUUFBUTtnQkFDSixDQUFDLENBQUMsaUJBQWlCLFNBQVMsa0VBQWtFO2dCQUM5RixDQUFDLENBQUMsaUJBQWlCLFNBQVMsNkVBQTZFLENBQ2hILENBQUM7UUFDTixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09BMkJHO0lBQ0ssS0FBSyxDQUFDLFNBQVM7UUFDbkIsTUFBTSxTQUFTLEdBQUcsTUFBTSxJQUFJLENBQUMsMkJBQTJCLEVBQUUsQ0FBQztRQUMzRCxNQUFNLFdBQVcsR0FBRyxJQUFBLGlDQUFXLEVBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0MsTUFBTSxlQUFlLEdBQUcsSUFBQSwwQ0FBb0IsRUFBQyxTQUFTLENBQUMsQ0FBQztRQUV4RCxJQUFJLENBQUM7WUFDRCxNQUFNLEtBQUssR0FBWSxNQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBZSxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztZQUNwRixJQUFJLEtBQUssS0FBSyxLQUFLLEVBQUUsQ0FBQztnQkFDbEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsc0ZBQXNGLENBQUMsQ0FBQztZQUMvRyxDQUFDO1FBQ0wsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFFRCxxRUFBcUU7UUFDckUsSUFBSSxXQUFXLEdBQW1CLElBQUksQ0FBQztRQUN2QyxJQUFJLENBQUM7WUFDRCxXQUFXLEdBQUcsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQztRQUNsRixDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ0wsZ0ZBQWdGO1FBQ3BGLENBQUM7UUFDRCxJQUFJLFdBQVcsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUN2QixPQUFPLElBQUEsbUJBQVcsRUFDZCxvRkFBb0Y7Z0JBQ3BGLHFGQUFxRjtnQkFDckYsd0ZBQXdGO2dCQUN4RixvRUFBb0UsQ0FDdkUsQ0FBQztRQUNOLENBQUM7UUFFRCwrRUFBK0U7UUFDL0UsaUZBQWlGO1FBQ2pGLDBDQUEwQztRQUMxQyxNQUFNLFFBQVEsR0FDVixTQUFTLEtBQUssSUFBSTtZQUNkLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRTtZQUM5RixDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxlQUFlLENBQUMsQ0FBQztRQUVsRixJQUFJLFFBQVEsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUN6QixPQUFPO2dCQUNILE9BQU8sRUFBRSxLQUFLO2dCQUNkLEtBQUssRUFBRSxrQkFBa0IsU0FBUyw2QkFBNkIsUUFBUSxDQUFDLGFBQWEsRUFBRTtnQkFDdkYsSUFBSSxrQkFDQSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLG1CQUFtQixFQUFFLElBQUksSUFDbEUsQ0FBQyxRQUFRLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FDdEU7Z0JBQ0QsT0FBTyxFQUFFLElBQUk7YUFDaEIsQ0FBQztRQUNOLENBQUM7UUFFRCxJQUFJLFFBQVEsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDakMsT0FBTyxJQUFBLG1CQUFXLEVBQ2QsaUVBQWlFLFFBQVEsQ0FBQyxNQUFNLElBQUk7Z0JBQ3BGLDRGQUE0RjtnQkFDNUYsMkVBQTJFLENBQzlFLENBQUM7UUFDTixDQUFDO1FBRUQsT0FBTyxJQUFBLHFCQUFhLGtCQUVaLEtBQUssRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQzFDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQyxPQUFPLEtBQUssVUFBVSxJQUNqRCxDQUFDLFFBQVEsQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUV2RSxRQUFRLENBQUMsT0FBTyxLQUFLLFVBQVU7WUFDM0IsQ0FBQyxDQUFDLDBFQUEwRTtZQUM1RSxDQUFDLENBQUMscURBQXFELENBQzlELENBQUM7SUFDTixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7OztPQVlHO0lBQ0ssS0FBSyxDQUFDLG1CQUFtQixDQUM3QixTQUFpQixFQUNqQixXQUEwQixFQUMxQixlQUFrRTtRQUVsRSxNQUFNLFVBQVUsR0FBRyxXQUFXLEtBQUssSUFBSTtZQUNuQyxDQUFDLENBQUMsSUFBSTtZQUNOLENBQUMsQ0FBQyxNQUFNLElBQUEsd0NBQWtCLEVBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxxQkFBcUIsQ0FBQyxDQUFDO1FBRTlFLElBQUksYUFBYSxHQUFrQixJQUFJLENBQUM7UUFDeEMsSUFBSSxlQUFlLElBQUksZUFBZSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUMvQyxhQUFhLEdBQUcsSUFBQSwwQ0FBb0IsRUFBQyxlQUFlLEVBQUUsSUFBQSwwQ0FBb0IsRUFBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQzNGLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxXQUFXLEtBQUssSUFBSSxJQUFJLFVBQVUsS0FBSyxJQUFJLElBQUksVUFBVSxHQUFHLFdBQVcsQ0FBQztRQUMxRixvRkFBb0Y7UUFDcEYsMERBQTBEO1FBQzFELElBQUksU0FBUyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQzdCLE9BQU8sRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLGFBQWEsRUFBRSxDQUFDO1FBQ3JHLENBQUM7UUFFRCxtRkFBbUY7UUFDbkYsbUZBQW1GO1FBQ25GLHFGQUFxRjtRQUNyRixrQkFBa0I7UUFDbEIsSUFBSSxXQUFXLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDdkIsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDO1FBQ3hHLENBQUM7UUFFRCxrRkFBa0Y7UUFDbEYscURBQXFEO1FBQ3JELE9BQU87WUFDSCxRQUFRLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxhQUFhLEVBQUUsSUFBSTtZQUM3RSxNQUFNLEVBQUUsR0FBRyxTQUFTLG9JQUFvSTtTQUMzSixDQUFDO0lBQ04sQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSyxLQUFLLENBQUMsMkJBQTJCOztRQUNyQyxJQUFJLFNBQVMsR0FBa0IsSUFBSSxDQUFDO1FBQ3BDLElBQUksQ0FBQztZQUNELE1BQU0sSUFBSSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDM0UsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztnQkFBRSxTQUFTLEdBQUcsQ0FBQSxNQUFBLElBQUksQ0FBQyxDQUFDLENBQUMsMENBQUUsSUFBSSxLQUFJLElBQUksQ0FBQztpQkFDdEQsSUFBSSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUTtnQkFBRSxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUM7UUFDN0UsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNMLFNBQVMsR0FBRyxJQUFJLENBQUM7UUFDckIsQ0FBQztRQUNELElBQUksQ0FBQyxTQUFTO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFNUIsSUFBSSxDQUFDO1lBQ0QsT0FBTyxDQUFDLE1BQU0sSUFBQSx5QkFBWSxFQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO1FBQ3BELENBQUM7UUFBQyxXQUFNLENBQUM7WUFDTCxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBaUIsRUFBRSxRQUFnQjtRQUN6RCxJQUFJLENBQUMsU0FBUyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDMUIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsdURBQXVELENBQUMsQ0FBQztRQUNoRixDQUFDO1FBQ0QsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzNCLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLElBQUksU0FBUyxRQUFRLENBQUM7WUFFM0YsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDaEM7b0JBQ0ksVUFBVSxFQUFFLGVBQWU7b0JBQzNCLE9BQU8sRUFBRSxTQUFTO29CQUNsQixXQUFXLEVBQUUsQ0FBQztvQkFDZCxrQkFBa0IsRUFBRSxFQUFFO29CQUN0QixTQUFTLEVBQUUsRUFBRTtvQkFDYixPQUFPLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFO2lCQUMzQjtnQkFDRDtvQkFDSSxVQUFVLEVBQUUsVUFBVTtvQkFDdEIsT0FBTyxFQUFFLFNBQVM7b0JBQ2xCLFdBQVcsRUFBRSxDQUFDO29CQUNkLGtCQUFrQixFQUFFLEVBQUU7b0JBQ3RCLFNBQVMsRUFBRSxJQUFJO29CQUNmLFdBQVcsRUFBRSxFQUFFO29CQUNmLFNBQVMsRUFBRSxJQUFJO29CQUNmLGFBQWEsRUFBRSxFQUFFO29CQUNqQixTQUFTLEVBQUUsSUFBSTtvQkFDZixPQUFPLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO29CQUMxRCxPQUFPLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7b0JBQ2xFLFNBQVMsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7b0JBQzVELFdBQVcsRUFBRSxDQUFDO29CQUNkLFFBQVEsRUFBRSxVQUFVO29CQUNwQixRQUFRLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO29CQUMzRCxtQkFBbUIsRUFBRSxLQUFLO29CQUMxQixVQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFO29CQUMzQixLQUFLLEVBQUUsT0FBTztpQkFDakI7Z0JBQ0Q7b0JBQ0ksVUFBVSxFQUFFLGlCQUFpQjtvQkFDN0IsU0FBUyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtvQkFDMUIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtvQkFDekIsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtvQkFDdEIsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtpQkFDNUI7Z0JBQ0Q7b0JBQ0ksVUFBVSxFQUFFLGdCQUFnQjtvQkFDNUIsY0FBYyxFQUFFLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsUUFBUSxFQUFFO29CQUN0RixXQUFXLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUU7b0JBQ25GLGNBQWMsRUFBRSxLQUFLO29CQUNyQixXQUFXLEVBQUUsS0FBSztvQkFDbEIsa0JBQWtCLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7b0JBQ25GLGVBQWUsRUFBRSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtpQkFDbkY7Z0JBQ0Q7b0JBQ0ksVUFBVSxFQUFFLGVBQWU7b0JBQzNCLGtCQUFrQixFQUFFLENBQUM7b0JBQ3JCLFlBQVksRUFBRSxJQUFJO29CQUNsQixTQUFTLEVBQUUsSUFBSTtvQkFDZixpQkFBaUIsRUFBRSxDQUFDO29CQUNwQixnQkFBZ0IsRUFBRSxJQUFJO29CQUN0QixhQUFhLEVBQUUsSUFBSTtvQkFDbkIsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLFNBQVMsRUFBRSxJQUFJO29CQUNmLG1CQUFtQixFQUFFLElBQUk7b0JBQ3pCLGdCQUFnQixFQUFFLElBQUk7b0JBQ3RCLGdCQUFnQixFQUFFLElBQUk7b0JBQ3RCLGdCQUFnQixFQUFFLENBQUM7aUJBQ3RCO2dCQUNEO29CQUNJLFVBQVUsRUFBRSxZQUFZO29CQUN4QixPQUFPLEVBQUUsQ0FBQztvQkFDVixXQUFXLEVBQUUsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUU7b0JBQy9FLFVBQVUsRUFBRSxLQUFLO29CQUNqQixhQUFhLEVBQUUsR0FBRztvQkFDbEIsV0FBVyxFQUFFLEdBQUc7b0JBQ2hCLFNBQVMsRUFBRSxHQUFHO29CQUNkLFdBQVcsRUFBRSxDQUFDO29CQUNkLFNBQVMsRUFBRSxHQUFHO29CQUNkLFdBQVcsRUFBRSxHQUFHO29CQUNoQixXQUFXLEVBQUUsS0FBSztpQkFDckI7Z0JBQ0Q7b0JBQ0ksVUFBVSxFQUFFLGVBQWU7b0JBQzNCLFVBQVUsRUFBRSxLQUFLO29CQUNqQixTQUFTLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFO29CQUN4RSxTQUFTLEVBQUUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO29CQUNyRSxRQUFRLEVBQUUsQ0FBQztpQkFDZDthQUNKLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBRVosTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUUsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBVyxFQUFFLEVBQUU7Z0JBQzVGLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEVBQUUsRUFBRTs7b0JBQ25DLE1BQU0sWUFBWSxHQUFHLE1BQUEsU0FBUyxDQUFDLElBQUksMENBQUUsSUFBSSxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDdEYsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQzt3QkFDbEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO3dCQUNqQixHQUFHLEVBQUUsTUFBTSxDQUFDLEdBQUc7d0JBQ2YsSUFBSSxFQUFFLFNBQVM7d0JBQ2YsT0FBTyxFQUFFLFVBQVUsU0FBUyx3QkFBd0I7d0JBQ3BELGFBQWEsRUFBRSxDQUFDLENBQUMsWUFBWTtxQkFDaEMsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRTtvQkFDVixPQUFPLENBQUMsSUFBQSxxQkFBYSxFQUFDO3dCQUNsQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUk7d0JBQ2pCLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRzt3QkFDZixJQUFJLEVBQUUsU0FBUzt3QkFDZixPQUFPLEVBQUUsVUFBVSxTQUFTLDhDQUE4QztxQkFDN0UsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBWTtRQUNsQyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDMUIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLENBQUMsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUU7Z0JBQ2hFLE9BQU8sQ0FBQyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLDZCQUE2QixFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzdFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQVUsRUFBRSxFQUFFO2dCQUNwQixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRU8sS0FBSyxDQUFDLFVBQVU7UUFDcEIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQzNCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUNyRCxPQUFPLENBQUMsSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSwyQkFBMkIsQ0FBQyxDQUFDLENBQUM7WUFDOUQsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBVSxFQUFFLEVBQUU7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDdEMsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNLLHVCQUF1QixDQUFDLGlCQUEwQjtRQUN0RCxNQUFNLE9BQU8sR0FBRztZQUNaLElBQUksRUFBRSxrQkFBa0I7WUFDeEIsTUFBTSxFQUFFLG1CQUFtQjtZQUMzQixJQUFJLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztTQUM1QixDQUFDO1FBQ0YsT0FBTyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBVyxFQUFFLEVBQUU7WUFDekYsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUMzQixPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN0RCxDQUFDO1lBQ0QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsQ0FBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsS0FBSyxLQUFJLGVBQWUsQ0FBQyxDQUFDO1FBQ3pELENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBNkIsS0FBSztRQUM5RCwrRUFBK0U7UUFDL0UsaUZBQWlGO1FBQ2pGLHVFQUF1RTtRQUN2RSwrRUFBK0U7UUFDL0Usa0NBQWtDO1FBQ2xDLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixJQUFJLENBQUM7Z0JBQ0QsT0FBTyxNQUFNLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ2pFLENBQUM7WUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO2dCQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyx3QkFBd0IsR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDOUQsQ0FBQztRQUNMLENBQUM7UUFFRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDM0IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUU7Z0JBQ2xFLElBQUksSUFBSSxFQUFFLENBQUM7b0JBQ1AsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztvQkFDL0QsT0FBTyxDQUFDLElBQUEscUJBQWEsRUFBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUN0QyxDQUFDO3FCQUFNLENBQUM7b0JBQ0osT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pELENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsSUFBSSxDQUFDLHVCQUF1QixDQUFDLGlCQUFpQixDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQVcsRUFBRSxFQUFFO29CQUNoRixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLHNCQUFzQixHQUFHLENBQUMsT0FBTywwQkFBMEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDcEcsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLGNBQWMsQ0FBQyxJQUFTLEVBQUUsaUJBQTBCO1FBQ3hELE1BQU0sUUFBUSxHQUFRO1lBQ2xCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNuQixRQUFRLEVBQUUsRUFBRTtTQUNmLENBQUM7UUFFRixJQUFJLGlCQUFpQixJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN0QyxRQUFRLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsSUFBSSxTQUFTO2dCQUNoQyxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUk7YUFDNUQsQ0FBQyxDQUFDLENBQUM7UUFDUixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDaEIsUUFBUSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQVUsRUFBRSxFQUFFLENBQ2pELElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLGlCQUFpQixDQUFDLENBQ2hELENBQUM7UUFDTixDQUFDO1FBRUQsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztDQUNKO0FBOWdCRCxrQ0E4Z0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgU2NlbmVJbmZvLCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQge1xuICAgIHJlYWRPdmVycmlkZVNuYXBzaG90LCBkZXNjcmliZU92ZXJyaWRlTG9zcywgc3RhdE10aW1lTXMsIHdhaXRGb3JGaWxlUmV3cml0ZVxufSBmcm9tICcuLi91dGlscy9zYXZlLWFydGlmYWN0LWd1YXJkJztcblxuLyoqIExvbmdlc3QgYHNhdmVTY2VuZWAgd2FpdHMgZm9yIHRoZSBzY2VuZSBmaWxlIHRvIGJlIHJld3JpdHRlbiBiZWZvcmUgY2FsbGluZyB0aGUgc2F2ZSB1bmNvbmZpcm1lZC4gKi9cbmNvbnN0IFNBVkVfV1JJVEVfVElNRU9VVF9NUyA9IDIwMDA7XG5cbi8qKlxuICogV2hhdCB0aGUgYXJ0aWZhY3Qgc2F5cyBhYm91dCBhIHJlcG9ydGVkLXN1Y2Nlc3NmdWwgc2F2ZS4gYHVudmVyaWZpZWRgIGlzIGEgZmlyc3QtY2xhc3NcbiAqIG91dGNvbWUsIG5vdCBhIHNvZnQgZmFpbHVyZSDigJQgXCJ3ZSBjb3VsZCBub3QgY2hlY2tcIiBtdXN0IG5ldmVyIHJlbmRlciBhcyBcIml0IHdvcmtlZFwiLlxuICovXG50eXBlIEFydGlmYWN0VmVyZGljdCA9ICd2ZXJpZmllZCcgfCAnZHJvcHBlZCcgfCAndW52ZXJpZmllZCc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VTY2VuZSBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9zY2VuZSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHNjZW5lcyBpbiB0aGUgcHJvamVjdC4gQWN0aW9uczogZ2V0X2N1cnJlbnQsIGxpc3QsIG9wZW4sIHNhdmUsIGNyZWF0ZSwgc2F2ZV9hcywgY2xvc2UsIGdldF9oaWVyYXJjaHkuIFVzZSBnZXRfY3VycmVudCB0byBjaGVjayBpZiBhIHNjZW5lIGlzIG9wZW4gYmVmb3JlIG5vZGUvY29tcG9uZW50IG9wZXJhdGlvbnMuIFVzZSBnZXRfaGllcmFyY2h5IHRvIHVuZGVyc3RhbmQgc2NlbmUgc3RydWN0dXJlIGJlZm9yZSBtb2RpZnlpbmcgbm9kZXMuIFByZXJlcXVpc2l0ZXM6IHByb2plY3QgbXVzdCBiZSBvcGVuIGluIENvY29zIENyZWF0b3IuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydnZXRfY3VycmVudCcsICdsaXN0JywgJ29wZW4nLCAnc2F2ZScsICdjcmVhdGUnLCAnc2F2ZV9hcycsICdjbG9zZScsICdnZXRfaGllcmFyY2h5J107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2dldF9jdXJyZW50JywgJ2xpc3QnLCAnb3BlbicsICdzYXZlJywgJ2NyZWF0ZScsICdzYXZlX2FzJywgJ2Nsb3NlJywgJ2dldF9oaWVyYXJjaHknXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBnZXRfY3VycmVudD1nZXQgb3BlbiBzY2VuZSBpbmZvLCBsaXN0PWxpc3QgYWxsIHNjZW5lcyBpbiBwcm9qZWN0LCBvcGVuPW9wZW4gYSBzY2VuZSBieSBwYXRoLCBzYXZlPXNhdmUgY3VycmVudCBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBuZXcgc2NlbmUgYXNzZXQsIHNhdmVfYXM9c2F2ZSBzY2VuZSBhcyBuZXcgZmlsZSAob3BlbnMgZGlhbG9nKSwgY2xvc2U9Y2xvc2UgY3VycmVudCBzY2VuZSwgZ2V0X2hpZXJhcmNoeT1nZXQgZnVsbCBub2RlIHRyZWUgb2YgY3VycmVudCBzY2VuZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY2VuZVBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tvcGVuXSBTY2VuZSBmaWxlIHBhdGggKGUuZy4sIGRiOi8vYXNzZXRzL3NjZW5lcy9NYWluLnNjZW5lKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICByZWltcG9ydDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tvcGVuXSBSZWltcG9ydCB0aGUgc2NlbmUgYXNzZXQgZmlyc3Qgc28gb3V0LW9mLWJhbmQgZWRpdHMgdG8gdGhlIC5zY2VuZSBmaWxlIGFyZSByZWFkIGZyb20gZGlzayAoZGVmYXVsdCB0cnVlKS4gZmFsc2UgPSBvcGVuIHRoZSBlZGl0b3JcXCdzIGNhY2hlZCBjb3B5LicsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNjZW5lTmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gTmFtZSBvZiB0aGUgbmV3IHNjZW5lJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNhdmVQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBQYXRoIHRvIHNhdmUgdGhlIHNjZW5lIChlLmcuLCBkYjovL2Fzc2V0cy9zY2VuZXMvTmV3U2NlbmUuc2NlbmUpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzYXZlX2FzXSBQYXRoIHRvIHNhdmUgdGhlIHNjZW5lIGFzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGluY2x1ZGVDb21wb25lbnRzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2dldF9oaWVyYXJjaHldIEluY2x1ZGUgY29tcG9uZW50IGluZm9ybWF0aW9uIGluIGhpZXJhcmNoeSBvdXRwdXQnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IGZhbHNlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBnZXRfY3VycmVudDogKGFyZ3MpID0+IHRoaXMuZ2V0Q3VycmVudFNjZW5lKCksXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmdldFNjZW5lTGlzdCgpLFxuICAgICAgICBvcGVuOiAoYXJncykgPT4gdGhpcy5vcGVuU2NlbmUoYXJncy5zY2VuZVBhdGgsIGNvZXJjZUJvb2woYXJncy5yZWltcG9ydCkgIT09IGZhbHNlKSxcbiAgICAgICAgc2F2ZTogKGFyZ3MpID0+IHRoaXMuc2F2ZVNjZW5lKCksXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlU2NlbmUoYXJncy5zY2VuZU5hbWUsIGFyZ3Muc2F2ZVBhdGgpLFxuICAgICAgICBzYXZlX2FzOiAoYXJncykgPT4gdGhpcy5zYXZlU2NlbmVBcyhhcmdzLnBhdGgpLFxuICAgICAgICBjbG9zZTogKGFyZ3MpID0+IHRoaXMuY2xvc2VTY2VuZSgpLFxuICAgICAgICBnZXRfaGllcmFyY2h5OiAoYXJncykgPT4gdGhpcy5nZXRTY2VuZUhpZXJhcmNoeShjb2VyY2VCb29sKGFyZ3MuaW5jbHVkZUNvbXBvbmVudHMpID8/IGZhbHNlKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEN1cnJlbnRTY2VuZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKS50aGVuKCh0cmVlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHJlZSAmJiB0cmVlLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRyZWUubmFtZSB8fCAnQ3VycmVudCBTY2VuZScsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiB0cmVlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB0cmVlLnR5cGUgfHwgJ2NjLlNjZW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogdHJlZS5hY3RpdmUgIT09IHVuZGVmaW5lZCA/IHRyZWUuYWN0aXZlIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVDb3VudDogdHJlZS5jaGlsZHJlbiA/IHRyZWUuY2hpbGRyZW4ubGVuZ3RoIDogMFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnTm8gc2NlbmUgZGF0YSBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldEN1cnJlbnRTY2VuZUluZm8nLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCBvcHRpb25zKS50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyMjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRTY2VuZUxpc3QoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywge1xuICAgICAgICAgICAgICAgIHBhdHRlcm46ICdkYjovL2Fzc2V0cy8qKi8qLnNjZW5lJ1xuICAgICAgICAgICAgfSkudGhlbigocmVzdWx0czogYW55W10pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZXM6IFNjZW5lSW5mb1tdID0gcmVzdWx0cy5tYXAoYXNzZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogYXNzZXQudXJsLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBhc3NldC51dWlkXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChzY2VuZXMpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBzY2VuZTpvcGVuLXNjZW5lYCBzZXJ2ZXMgdGhlIGVkaXRvcidzIENBQ0hFRCBjb3B5IG9mIGEgc2NlbmUgYXNzZXQ6IGFmdGVyIHRoZSBgLnNjZW5lYFxuICAgICAqIGZpbGUgaXMgZWRpdGVkIG91dCBvZiBiYW5kIGl0IHJlc29sdmVzIHN1Y2Nlc3NmdWxseSB3aGlsZSB0aGUgZWRpdG9yIGtlZXBzIHNob3dpbmcgdGhlXG4gICAgICogb2xkIGNvbnRlbnQsIGFuZCB0aGUgbmV4dCBlZGl0b3ItZHJpdmVuIHNhdmUgc2lsZW50bHkgb3ZlcndyaXRlcyB0aGUgZGlzayBlZGl0ICgjNjUsXG4gICAgICogbGl2ZS1jb25maXJtZWQg4oCUIG9ubHkgYG1hbmFnZV9hc3NldCByZWltcG9ydGAgZm9yY2VkIGEgcmUtcmVhZCkuIE9wZW4gdGhlcmVmb3JlXG4gICAgICogcmVpbXBvcnRzIHRoZSBzY2VuZSBhc3NldCBmaXJzdCBzbyB0aGUgZWRpdG9yIHJlYWRzIHRoZSBmaWxlIGFzIGl0IGlzIG9uIGRpc2ssIGFuZFxuICAgICAqIHJlcG9ydHMgdGhhdCBpdCBkaWQuIGByZWltcG9ydDogZmFsc2VgIG9wdHMgb3V0IChrZWVwcyB0aGUgZWRpdG9yJ3MgaW4tbWVtb3J5IGNvcHkpLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgb3BlblNjZW5lKHNjZW5lUGF0aDogc3RyaW5nLCByZWltcG9ydDogYm9vbGVhbiA9IHRydWUpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFzY2VuZVBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnc2NlbmVQYXRoIGlzIHJlcXVpcmVkIGZvciBhY3Rpb249b3BlbicpO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB1dWlkOiBzdHJpbmcgfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXVpZCcsIHNjZW5lUGF0aCk7XG4gICAgICAgICAgICBpZiAoIXV1aWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ1NjZW5lIG5vdCBmb3VuZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlaW1wb3J0KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVpbXBvcnRlZCA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ2Fzc2V0LWRiJywgJ3JlaW1wb3J0LWFzc2V0Jywgc2NlbmVQYXRoKTtcbiAgICAgICAgICAgICAgICBpZiAocmVpbXBvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgYGFzc2V0LWRiOnJlaW1wb3J0LWFzc2V0IHJldHVybmVkIGZhbHNlIGZvciAnJHtzY2VuZVBhdGh9JyDigJQgdGhlIGVkaXRvciByZWplY3RlZCB0aGUgcmVpbXBvcnQsIGAgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ3NvIHRoZSBzY2VuZSB3b3VsZCBiZSBvcGVuZWQgZnJvbSBpdHMgY2FjaGVkIGNvcHkuIE5vdGhpbmcgd2FzIG9wZW5lZC4gUGFzcyByZWltcG9ydD1mYWxzZSB0byBvcGVuIHRoZSBjYWNoZWQgY29weSBkZWxpYmVyYXRlbHkuJ1xuICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ29wZW4tc2NlbmUnLCB1dWlkKTtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktaXMtcmVhZHknKS5jYXRjaCgoKSA9PiB1bmRlZmluZWQpO1xuICAgICAgICAgICAgaWYgKHJlYWR5ID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgb3Blbi1zY2VuZSByZXNvbHZlZCBmb3IgJyR7c2NlbmVQYXRofScgYnV0IHRoZSBzY2VuZSBpcyBub3QgcmVhZHkgYWZ0ZXJ3YXJkIOKAlCBpdCBkaWQgbm90IGZpbmlzaCBsb2FkaW5nLmApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgeyByZWltcG9ydGVkOiByZWltcG9ydCB9LFxuICAgICAgICAgICAgICAgIHJlaW1wb3J0XG4gICAgICAgICAgICAgICAgICAgID8gYFNjZW5lIG9wZW5lZDogJHtzY2VuZVBhdGh9IChhc3NldCByZWltcG9ydGVkIGZpcnN0LCBzbyB0aGUgZWRpdG9yIHJlYWQgdGhlIGZpbGUgZnJvbSBkaXNrKWBcbiAgICAgICAgICAgICAgICAgICAgOiBgU2NlbmUgb3BlbmVkOiAke3NjZW5lUGF0aH0gKGZyb20gdGhlIGVkaXRvcidzIGNhY2hlZCBjb3B5IOKAlCBvdXQtb2YtYmFuZCBkaXNrIGVkaXRzIGFyZSBOT1QgcGlja2VkIHVwKWBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYHNjZW5lOnNhdmUtc2NlbmVgIHJlc29sdmVzIHRvIGEgYGJvb2xlYW5gIChwZXIgdGhlIHNoaXBwZWQgMy44LjcgbWVzc2FnZSB0eXBlcyxcbiAgICAgKiBgbm9kZV9tb2R1bGVzL0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9zY2VuZS9AdHlwZXMvbWVzc2FnZS5kLnRzYCksXG4gICAgICogbm90IGB2b2lkYCDigJQgdGhlIG9sZCBjb2RlIGRpc2NhcmRlZCB0aGF0IHJlc3VsdCBhbmQgcmVwb3J0ZWQgc3VjY2VzcyB1bmNvbmRpdGlvbmFsbHlcbiAgICAgKiBvbmNlIHRoZSBwcm9taXNlIHNldHRsZWQsIHdpdGggbm8gdmVyaWZpY2F0aW9uIGFuZCBubyBgLmNhdGNoYCBmb3IgYSByZWplY3RlZCBzYXZlLlxuICAgICAqIEEgYGZhbHNlYCByZXN1bHQgaXMgdHJlYXRlZCBhcyBhIGZhaWxlZCBzYXZlICgjNikuXG4gICAgICpcbiAgICAgKiBBIHJlc29sdmVkIGB0cnVlYCwgYW5kIGEgYHF1ZXJ5LWRpcnR5YCByZWFkaW5nIG9mIGBmYWxzZWAgaW1tZWRpYXRlbHkgYWZ0ZXIgaXQsIGFyZVxuICAgICAqIGJvdGggc3RhdGVtZW50cyBhYm91dCB0aGUgRURJVE9SJ3MgaW4tbWVtb3J5IHZpZXcg4oCUIG5laXRoZXIgaXMgYSBzdGF0ZW1lbnQgYWJvdXQgdGhlXG4gICAgICogZmlsZS4gIzYncyByZWdyZXNzaW9uIHJlcG9ydCAoMjAyNi0wOS0yMSkgaXMgZXhhY3RseSB0aGF0IGdhcDogc3RyaWN0bHkgc2VxdWVudGlhbFxuICAgICAqIGNhbGxzLCBgc2F2ZWAgcmV0dXJuaW5nIGB0cnVlYCB0aHJlZSB0aW1lcywgYHF1ZXJ5X2RpcnR5YCByZWFkaW5nIGBmYWxzZWAsIGFuZCB0aGVcbiAgICAgKiBgLnNjZW5lYCBmaWxlJ3MgbXRpbWUgZnJvemVuIGF0IGl0cyBwcmUtZWRpdCB0aW1lc3RhbXAgd2l0aCB0aGUgZWRpdCBhYnNlbnQgZnJvbSB0aGVcbiAgICAgKiBKU09OLiBUaGUgZWRpdG9yIGJlbGlldmVkIGl0IGhhZCBzYXZlZDsgaXQgaGFkIG5vdC5cbiAgICAgKlxuICAgICAqIFNvIHRoZSBhcnRpZmFjdCBpdHNlbGYgaXMgdGhlIGFyYml0ZXIsIG9uIHR3byByZWFkcyBvZiBpdDpcbiAgICAgKlxuICAgICAqICAtICoqbXRpbWUgZGlkIG5vdCBhZHZhbmNlKiog4oaSIG5vdGhpbmcgd2FzIHNlcmlhbGlzZWQuIEhhcmQgZmFpbHVyZSAoIzYpLlxuICAgICAqICAtICoqYGNjLlRhcmdldE92ZXJyaWRlSW5mb2AgcmVjb3JkcyBkcm9wcGVkKiog4oaSIHRoZSBmaWxlIHdhcyByZXdyaXR0ZW4sIGJ1dCBsb3NzaWx5LlxuICAgICAqICAgIFJlcG9ydGVkIGFzIGEgbG91ZCBub24tc3VjY2VzcyB3aXRoIHRoZSBsb3N0IGBwcm9wZXJ0eVBhdGhgcyBuYW1lZCAoIzc4KS4gQVxuICAgICAqICAgIG5vLWVkaXQgcm91bmQtdHJpcCBsb3NpbmcgdGhlc2UgcmVjb3JkcyBpcyB0aGUgcmVwb3J0ZWQgcmVwcm86IDI1IGJlZm9yZSwgMjMgYWZ0ZXIsXG4gICAgICogICAgYW5kIHRoZSBvbGQgcmVzcG9uc2Ugd2FzIGJ5dGUtaWRlbnRpY2FsIHRvIGEgbG9zc2xlc3Mgc2F2ZSdzLlxuICAgICAqXG4gICAgICogQm90aCBjaGVja3MgYXJlIGJlc3QtZWZmb3J0IGluIHRoZSBzZW5zZSB0aGF0IGFuIHVucmVhZGFibGUgYXJ0aWZhY3QgeWllbGRzXG4gICAgICogXCJ1bnZlcmlmaWFibGVcIiByYXRoZXIgdGhhbiBhIHBhc3Mg4oCUIHRoZSByZXN1bHQgc2F5cyB3aGljaCBpdCB3YXMsIHNvIGEgY2FsbGVyIGlzIG5ldmVyXG4gICAgICogdG9sZCBcInZlcmlmaWVkXCIgb24gdGhlIHN0cmVuZ3RoIG9mIGEgcmVhZCB0aGF0IGRpZCBub3QgaGFwcGVuLiBUaGUgbXV0YXRpbmcgY2FsbHNcbiAgICAgKiBhaGVhZCBvZiB0aGlzIHNhdmUgYXJlIHNlcmlhbGlzZWQgb24gb25lIGNoYWluIChgdG9vbHMvbXV0YXRpb24tcXVldWUudHNgKSwgYW5kXG4gICAgICogYG1hbmFnZV9zY2VuZV9xdWVyeWAgcmVjb25jaWxlcyB0aGUgcmF3IGRpcnR5IGZsYWcgYWdhaW5zdCB0aGF0IHF1ZXVlLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgc2F2ZVNjZW5lKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBzY2VuZVBhdGggPSBhd2FpdCB0aGlzLnJlc29sdmVDdXJyZW50U2NlbmVGaWxlUGF0aCgpO1xuICAgICAgICBjb25zdCBtdGltZUJlZm9yZSA9IHN0YXRNdGltZU1zKHNjZW5lUGF0aCk7XG4gICAgICAgIGNvbnN0IG92ZXJyaWRlc0JlZm9yZSA9IHJlYWRPdmVycmlkZVNuYXBzaG90KHNjZW5lUGF0aCk7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHNhdmVkOiBib29sZWFuID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAnc2F2ZS1zY2VuZScpO1xuICAgICAgICAgICAgaWYgKHNhdmVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnc2NlbmU6c2F2ZS1zY2VuZSByZXR1cm5lZCBmYWxzZSDigJQgdGhlIGVkaXRvciByZWplY3RlZCB0aGUgc2F2ZS4gTm90aGluZyB3YXMgd3JpdHRlbi4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAxLiBEaXJ0eS1mbGFnIGJhY2tzdG9wIOKAlCB0aGUgZWRpdG9yIHN0aWxsIGhvbGRzIHVuY29tbWl0dGVkIGVkaXRzLlxuICAgICAgICBsZXQgZWRpdG9yRGlydHk6IGJvb2xlYW4gfCBudWxsID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGVkaXRvckRpcnR5ID0gKGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LWRpcnR5JykpID09PSB0cnVlO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIEJlc3QtZWZmb3J0OiB1bnJlYWRhYmxlIGRpcnR5IHN0YXRlIG11c3Qgbm90IHR1cm4gYSByZWFsIHNhdmUgaW50byBhIGZhaWx1cmUuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVkaXRvckRpcnR5ID09PSB0cnVlKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgJ3NhdmUtc2NlbmUgcmVwb3J0ZWQgc3VjY2VzcywgYnV0IHRoZSBzY2VuZSBpcyBzdGlsbCBkaXJ0eSBpbW1lZGlhdGVseSBhZnRlcndhcmQg4oCUICcgK1xuICAgICAgICAgICAgICAgICdhIHBlbmRpbmcgZWRpdCB3YXMgbm90IGNhcHR1cmVkIGluIHRoaXMgc2F2ZS4gVGhpcyB0eXBpY2FsbHkgbWVhbnMgYSBtdXRhdGluZyBjYWxsICcgK1xuICAgICAgICAgICAgICAgICcobWFuYWdlX25vZGUvbWFuYWdlX2NvbXBvbmVudC9ldGMuKSB3YXMgaXNzdWVkIGNvbmN1cnJlbnRseSBvciBiYXRjaGVkIHdpdGggdGhpcyBzYXZlICcgK1xuICAgICAgICAgICAgICAgICdpbnN0ZWFkIG9mIGF3YWl0ZWQgZmlyc3Q7IGlzc3VlIGNhbGxzIHNlcXVlbnRpYWxseSBhbmQgcmV0cnkgc2F2ZS4nXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gMi4gQXJ0aWZhY3QgY2hlY2tzLiBgc2NlbmVQYXRoID09PSBudWxsYCBtZWFucyB0aGUgb24tZGlzayBmaWxlIGNvdWxkIG5vdCBiZVxuICAgICAgICAvLyByZXNvbHZlZCAodW5zYXZlZCBzY2VuZSwgdW5rbm93biBhc3NldCk7IHRoYXQgaXMgcmVwb3J0ZWQgYXMgdW52ZXJpZmllZCwgbmV2ZXJcbiAgICAgICAgLy8gZm9sZGVkIGludG8gZWl0aGVyIGEgcGFzcyBvciBhIGZhaWx1cmUuXG4gICAgICAgIGNvbnN0IGFydGlmYWN0OiB7IHZlcmlmaWVkOiBib29sZWFuOyB2ZXJkaWN0OiBBcnRpZmFjdFZlcmRpY3Q7IHJlYXNvbjogc3RyaW5nIHwgbnVsbDsgbXRpbWVNczogbnVtYmVyIHwgbnVsbDsgbG9zdE92ZXJyaWRlczogc3RyaW5nIHwgbnVsbCB9ID1cbiAgICAgICAgICAgIHNjZW5lUGF0aCA9PT0gbnVsbFxuICAgICAgICAgICAgICAgID8geyB2ZXJpZmllZDogZmFsc2UsIHZlcmRpY3Q6ICd1bnZlcmlmaWVkJywgcmVhc29uOiBudWxsLCBtdGltZU1zOiBudWxsLCBsb3N0T3ZlcnJpZGVzOiBudWxsIH1cbiAgICAgICAgICAgICAgICA6IGF3YWl0IHRoaXMudmVyaWZ5U2F2ZWRBcnRpZmFjdChzY2VuZVBhdGgsIG10aW1lQmVmb3JlLCBvdmVycmlkZXNCZWZvcmUpO1xuXG4gICAgICAgIGlmIChhcnRpZmFjdC5sb3N0T3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiBgU2NlbmUgc2F2ZWQgdG8gJHtzY2VuZVBhdGh9LCBidXQgdGhlIHNhdmUgV0FTIExPU1NZOiAke2FydGlmYWN0Lmxvc3RPdmVycmlkZXN9YCxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGZpbGU6IHNjZW5lUGF0aCwgZGlydHk6IGZhbHNlLCBlZGl0b3JEaXJ0eSwgcGVyc2lzdGVuY2VWZXJpZmllZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgLi4uKGFydGlmYWN0Lm10aW1lTXMgIT09IG51bGwgPyB7IG10aW1lTXM6IGFydGlmYWN0Lm10aW1lTXMgfSA6IHt9KVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgaXNFcnJvcjogdHJ1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhcnRpZmFjdC52ZXJkaWN0ID09PSAnZHJvcHBlZCcpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICBgc2F2ZS1zY2VuZSByZXBvcnRlZCBzdWNjZXNzIGJ1dCB0aGUgd3JpdGUgZGlkIG5vdCByZWFjaCBkaXNrOiAke2FydGlmYWN0LnJlYXNvbn0uIGAgK1xuICAgICAgICAgICAgICAgICdUaGlzIGlzIHRoZSAjNiBmYWxzZS1zdWNjZXNzIHNoYXBlIOKAlCB2ZXJpZnkgdGhlIGZpbGUgeW91cnNlbGYsIGFuZCBpZiB0aGUgZWRpdCBpcyBhYnNlbnQsICcgK1xuICAgICAgICAgICAgICAgICdwcmVzcyBDdHJsK1MgaW4gdGhlIENvY29zIENyZWF0b3IgZWRpdG9yIGFuZCByZXBvcnQgdGhlIG9jY3VycmVuY2Ugb24gIzYuJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGRpcnR5OiBmYWxzZSwgZWRpdG9yRGlydHksIGZpbGU6IHNjZW5lUGF0aCxcbiAgICAgICAgICAgICAgICBwZXJzaXN0ZW5jZVZlcmlmaWVkOiBhcnRpZmFjdC52ZXJkaWN0ID09PSAndmVyaWZpZWQnLFxuICAgICAgICAgICAgICAgIC4uLihhcnRpZmFjdC5tdGltZU1zICE9PSBudWxsID8geyBtdGltZU1zOiBhcnRpZmFjdC5tdGltZU1zIH0gOiB7fSlcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhcnRpZmFjdC52ZXJkaWN0ID09PSAndmVyaWZpZWQnXG4gICAgICAgICAgICAgICAgPyAnU2NlbmUgc2F2ZWQgc3VjY2Vzc2Z1bGx5IChmaWxlIHJld3JpdHRlbiBhbmQgb3ZlcnJpZGUgcmVjb3JkcyBwcmVzZXJ2ZWQpJ1xuICAgICAgICAgICAgICAgIDogJ1NjZW5lIHNhdmVkIHN1Y2Nlc3NmdWxseSAoZGlydHkgc3RhdGUgdW52ZXJpZmlhYmxlKSdcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDb25maXJtIHRoZSBzYXZlIGFjdHVhbGx5IHJlYWNoZWQgdGhlIGFydGlmYWN0LCBhbmQgdGhhdCBpdCBkaWQgbm90IGxvc2Ugb3ZlcnJpZGVcbiAgICAgKiByZWNvcmRzIG9uIHRoZSB3YXkuXG4gICAgICpcbiAgICAgKiBUaHJlZSBvdXRjb21lcywgZGVsaWJlcmF0ZWx5IG5vdCB0d28g4oCUIFwid2UgY291bGQgbm90IGNoZWNrXCIgbXVzdCBzdGF5IGRpc3Rpbmd1aXNoYWJsZVxuICAgICAqIGZyb20gYm90aCBcIndlIGNoZWNrZWQgYW5kIGl0IGxhbmRlZFwiIGFuZCBcIndlIGNoZWNrZWQgYW5kIGl0IGRpZCBub3RcIjpcbiAgICAgKlxuICAgICAqICAtIGB2ZXJpZmllZGAgIOKAlCB0aGUgd3JpdGUgaXMgY29uZmlybWVkLCBhbmQgbm8gb3ZlcnJpZGUgcmVjb3JkIHdhcyBsb3N0LlxuICAgICAqICAtIGBkcm9wcGVkYCAgIOKAlCB0aGUgd3JpdGUgaXMgY29uZmlybWVkIEFCU0VOVCAoYW4gZXhpc3RpbmcgZmlsZSB3aG9zZSBtdGltZSBkaWQgbm90XG4gICAgICogICAgICAgICAgICAgICAgICBhZHZhbmNlKS4gRXZpZGVuY2Ugb2YgdGhlICM2IGZhbHNlIHN1Y2Nlc3M7IHJlcG9ydGVkIGFzIGEgZmFpbHVyZS5cbiAgICAgKiAgLSBgdW52ZXJpZmllZGDigJQgbm8gYXJ0aWZhY3QgZXZpZGVuY2UgZWl0aGVyIHdheSAobm8gZmlsZSBhdCB0aGUgcmVzb2x2ZWQgcGF0aCwgZmlsZVxuICAgICAqICAgICAgICAgICAgICAgICAgdW5yZWFkYWJsZSkuIFJlcG9ydGVkIGFzIGV4cGxpY2l0bHkgdW52ZXJpZmllZCwgbmV2ZXIgYXMgYSBwYXNzLlxuICAgICAqL1xuICAgIHByaXZhdGUgYXN5bmMgdmVyaWZ5U2F2ZWRBcnRpZmFjdChcbiAgICAgICAgc2NlbmVQYXRoOiBzdHJpbmcsXG4gICAgICAgIG10aW1lQmVmb3JlOiBudW1iZXIgfCBudWxsLFxuICAgICAgICBvdmVycmlkZXNCZWZvcmU6IHsgdG90YWw6IG51bWJlcjsgcHJvcGVydHlQYXRoczogc3RyaW5nW10gfSB8IG51bGxcbiAgICApOiBQcm9taXNlPHsgdmVyaWZpZWQ6IGJvb2xlYW47IHZlcmRpY3Q6IEFydGlmYWN0VmVyZGljdDsgcmVhc29uOiBzdHJpbmcgfCBudWxsOyBtdGltZU1zOiBudW1iZXIgfCBudWxsOyBsb3N0T3ZlcnJpZGVzOiBzdHJpbmcgfCBudWxsIH0+IHtcbiAgICAgICAgY29uc3QgbXRpbWVBZnRlciA9IG10aW1lQmVmb3JlID09PSBudWxsXG4gICAgICAgICAgICA/IG51bGxcbiAgICAgICAgICAgIDogYXdhaXQgd2FpdEZvckZpbGVSZXdyaXRlKHNjZW5lUGF0aCwgbXRpbWVCZWZvcmUsIFNBVkVfV1JJVEVfVElNRU9VVF9NUyk7XG5cbiAgICAgICAgbGV0IGxvc3RPdmVycmlkZXM6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgICAgICBpZiAob3ZlcnJpZGVzQmVmb3JlICYmIG92ZXJyaWRlc0JlZm9yZS50b3RhbCA+IDApIHtcbiAgICAgICAgICAgIGxvc3RPdmVycmlkZXMgPSBkZXNjcmliZU92ZXJyaWRlTG9zcyhvdmVycmlkZXNCZWZvcmUsIHJlYWRPdmVycmlkZVNuYXBzaG90KHNjZW5lUGF0aCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmV3cml0dGVuID0gbXRpbWVCZWZvcmUgIT09IG51bGwgJiYgbXRpbWVBZnRlciAhPT0gbnVsbCAmJiBtdGltZUFmdGVyID4gbXRpbWVCZWZvcmU7XG4gICAgICAgIC8vIEFuIG92ZXJyaWRlIGxvc3MgcHJvdmVzIHRoZSBmaWxlIHdhcyByZXdyaXR0ZW47IGRvIG5vdCBhbHNvIGRlbWFuZCBhIG1vdmVkIG10aW1lLFxuICAgICAgICAvLyB3aGljaCBhIGNvYXJzZSBmaWxlc3lzdGVtIHRpbWVzdGFtcCBjb3VsZCBmYWlsIHRvIHNob3cuXG4gICAgICAgIGlmIChyZXdyaXR0ZW4gfHwgbG9zdE92ZXJyaWRlcykge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmVyaWZpZWQ6IHRydWUsIHZlcmRpY3Q6ICd2ZXJpZmllZCcsIHJlYXNvbjogbnVsbCwgbXRpbWVNczogbXRpbWVBZnRlciwgbG9zdE92ZXJyaWRlcyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTm8gZmlsZSBhdCB0aGUgcmVzb2x2ZWQgcGF0aCDigJQgYmVmb3JlIEFORCBhZnRlci4gVGhlcmUgaXMgbm90aGluZyB0byBjb21wYXJlLCBzb1xuICAgICAgICAvLyB0aGlzIGlzIFwidW52ZXJpZmlhYmxlXCIsIG5vdCBhIGRyb3BwZWQgd3JpdGU6IGEgc2NlbmUgdGhhdCBoYXMgbmV2ZXIgYmVlbiB3cml0dGVuXG4gICAgICAgIC8vIHRvIGRpc2sgbGVnaXRpbWF0ZWx5IGhhcyBubyBhcnRpZmFjdCwgYW5kIGEgbWlzLXJlc29sdmVkIHBhdGggbXVzdCBub3QgYmUgcmVwb3J0ZWRcbiAgICAgICAgLy8gYXMgYSBkYXRhIGxvc3MuXG4gICAgICAgIGlmIChtdGltZUJlZm9yZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHsgdmVyaWZpZWQ6IGZhbHNlLCB2ZXJkaWN0OiAndW52ZXJpZmllZCcsIHJlYXNvbjogbnVsbCwgbXRpbWVNczogbnVsbCwgbG9zdE92ZXJyaWRlczogbnVsbCB9O1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQSBmaWxlIGV4aXN0ZWQgYW5kIHRoZSBzYXZlIGRpZCBub3QgdG91Y2ggaXQuIFRoYXQgaXMgdGhlICM2IGRlZmVjdDogdGhlIGVkaXRvclxuICAgICAgICAvLyByZXBvcnRlZCBzdWNjZXNzIG92ZXIgYSB3cml0ZSB0aGF0IG5ldmVyIGhhcHBlbmVkLlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmVyaWZpZWQ6IGZhbHNlLCB2ZXJkaWN0OiAnZHJvcHBlZCcsIG10aW1lTXM6IG10aW1lQWZ0ZXIsIGxvc3RPdmVycmlkZXM6IG51bGwsXG4gICAgICAgICAgICByZWFzb246IGAke3NjZW5lUGF0aH0gZXhpc3RlZCBiZWZvcmUgdGhlIHNhdmUgYW5kIHdhcyBub3QgcmV3cml0dGVuIGJ5IGl0IChtdGltZSB1bmNoYW5nZWQpLCBzbyB0aGUgcmVwb3J0ZWQtc3VjY2Vzc2Z1bCBzYXZlIGRpZCBub3Qgc2VyaWFsaXNlIGFueXRoaW5nYFxuICAgICAgICB9O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgdGhlIG9uLWRpc2sgcGF0aCBvZiB0aGUgc2NlbmUgY3VycmVudGx5IG9wZW4gaW4gdGhlIGVkaXRvci5cbiAgICAgKlxuICAgICAqIGBzY2VuZTpxdWVyeS1ub2RlLXRyZWVgIHlpZWxkcyB0aGUgb3BlbiBzY2VuZSdzIFJPT1Qgbm9kZSwgd2hvc2UgdXVpZCBpcyB0aGUgc2NlbmVcbiAgICAgKiBhc3NldCdzIHV1aWQgZm9yIGEgc2F2ZWQgc2NlbmUg4oCUIGVub3VnaCB0byByZXNvbHZlIHRoZSBmaWxlIHRocm91Z2ggYGFzc2V0LWRiYC4gQVxuICAgICAqIG5ldmVyLXNhdmVkIHNjZW5lIGhhcyBubyBhc3NldCBmaWxlLCBzbyB0aGlzIHJldHVybnMgbnVsbCBhbmQgdGhlIGNhbGxlciByZXBvcnRzIHRoZVxuICAgICAqIGFydGlmYWN0IGFzIHVudmVyaWZpYWJsZSByYXRoZXIgdGhhbiBndWVzc2luZyBhIHBhdGguXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyByZXNvbHZlQ3VycmVudFNjZW5lRmlsZVBhdGgoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgICAgIGxldCBzY2VuZVV1aWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgdHJlZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XG4gICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0cmVlKSkgc2NlbmVVdWlkID0gdHJlZVswXT8udXVpZCB8fCBudWxsO1xuICAgICAgICAgICAgZWxzZSBpZiAodHJlZSAmJiB0eXBlb2YgdHJlZSA9PT0gJ29iamVjdCcpIHNjZW5lVXVpZCA9IHRyZWUudXVpZCB8fCBudWxsO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHNjZW5lVXVpZCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFzY2VuZVV1aWQpIHJldHVybiBudWxsO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gKGF3YWl0IHJlc29sdmVBc3NldChzY2VuZVV1aWQpKS5maWxlUGF0aDtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlU2NlbmUoc2NlbmVOYW1lOiBzdHJpbmcsIHNhdmVQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFzY2VuZU5hbWUgfHwgIXNhdmVQYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NjZW5lTmFtZSBhbmQgc2F2ZVBhdGggYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249Y3JlYXRlJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHNhdmVQYXRoLmVuZHNXaXRoKCcuc2NlbmUnKSA/IHNhdmVQYXRoIDogYCR7c2F2ZVBhdGh9LyR7c2NlbmVOYW1lfS5zY2VuZWA7XG5cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lQ29udGVudCA9IEpTT04uc3RyaW5naWZ5KFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5TY2VuZUFzc2V0XCIsXG4gICAgICAgICAgICAgICAgICAgIFwiX25hbWVcIjogc2NlbmVOYW1lLFxuICAgICAgICAgICAgICAgICAgICBcIl9vYmpGbGFnc1wiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICAgICAgICAgIFwiX25hdGl2ZVwiOiBcIlwiLFxuICAgICAgICAgICAgICAgICAgICBcInNjZW5lXCI6IHsgXCJfX2lkX19cIjogMSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5TY2VuZVwiLFxuICAgICAgICAgICAgICAgICAgICBcIl9uYW1lXCI6IHNjZW5lTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfb2JqRmxhZ3NcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfX2VkaXRvckV4dHJhc19fXCI6IHt9LFxuICAgICAgICAgICAgICAgICAgICBcIl9wYXJlbnRcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfY2hpbGRyZW5cIjogW10sXG4gICAgICAgICAgICAgICAgICAgIFwiX2FjdGl2ZVwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcIl9jb21wb25lbnRzXCI6IFtdLFxuICAgICAgICAgICAgICAgICAgICBcIl9wcmVmYWJcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfbHBvc1wiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiAwLCBcInlcIjogMCwgXCJ6XCI6IDAgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfbHJvdFwiOiB7IFwiX190eXBlX19cIjogXCJjYy5RdWF0XCIsIFwieFwiOiAwLCBcInlcIjogMCwgXCJ6XCI6IDAsIFwid1wiOiAxIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX2xzY2FsZVwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiAxLCBcInlcIjogMSwgXCJ6XCI6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfbW9iaWxpdHlcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfbGF5ZXJcIjogMTA3Mzc0MTgyNCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZXVsZXJcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogMCwgXCJ5XCI6IDAsIFwielwiOiAwIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiYXV0b1JlbGVhc2VBc3NldHNcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwiX2dsb2JhbHNcIjogeyBcIl9faWRfX1wiOiAyIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX2lkXCI6IFwic2NlbmVcIlxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuU2NlbmVHbG9iYWxzXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiYW1iaWVudFwiOiB7IFwiX19pZF9fXCI6IDMgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJza3lib3hcIjogeyBcIl9faWRfX1wiOiA0IH0sXG4gICAgICAgICAgICAgICAgICAgIFwiZm9nXCI6IHsgXCJfX2lkX19cIjogNSB9LFxuICAgICAgICAgICAgICAgICAgICBcIm9jdHJlZVwiOiB7IFwiX19pZF9fXCI6IDYgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBcIl9fdHlwZV9fXCI6IFwiY2MuQW1iaWVudEluZm9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJfc2t5Q29sb3JIRFJcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjNFwiLCBcInhcIjogMC4yLCBcInlcIjogMC41LCBcInpcIjogMC44LCBcIndcIjogMC41MjA4MzMgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfc2t5Q29sb3JcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjNFwiLCBcInhcIjogMC4yLCBcInlcIjogMC41LCBcInpcIjogMC44LCBcIndcIjogMC41MjA4MzMgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfc2t5SWxsdW1IRFJcIjogMjAwMDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX3NreUlsbHVtXCI6IDIwMDAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9ncm91bmRBbGJlZG9IRFJcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjNFwiLCBcInhcIjogMC4yLCBcInlcIjogMC4yLCBcInpcIjogMC4yLCBcIndcIjogMSB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9ncm91bmRBbGJlZG9cIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjNFwiLCBcInhcIjogMC4yLCBcInlcIjogMC4yLCBcInpcIjogMC4yLCBcIndcIjogMSB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5Ta3lib3hJbmZvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiX2VudkxpZ2h0aW5nVHlwZVwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9lbnZtYXBIRFJcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZW52bWFwXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX2Vudm1hcExvZENvdW50XCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX2RpZmZ1c2VNYXBIRFJcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZGlmZnVzZU1hcFwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9lbmFibGVkXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcIl91c2VIRFJcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZWRpdGFibGVNYXRlcmlhbFwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9yZWZsZWN0aW9uSERSXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX3JlZmxlY3Rpb25NYXBcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfcm90YXRpb25BbmdsZVwiOiAwXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5Gb2dJbmZvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiX3R5cGVcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nQ29sb3JcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuQ29sb3JcIiwgXCJyXCI6IDIwMCwgXCJnXCI6IDIwMCwgXCJiXCI6IDIwMCwgXCJhXCI6IDI1NSB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9lbmFibGVkXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dEZW5zaXR5XCI6IDAuMyxcbiAgICAgICAgICAgICAgICAgICAgXCJfZm9nU3RhcnRcIjogMC41LFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dFbmRcIjogMzAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dBdHRlblwiOiA1LFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dUb3BcIjogMS41LFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dSYW5nZVwiOiAxLjIsXG4gICAgICAgICAgICAgICAgICAgIFwiX2FjY3VyYXRlXCI6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5PY3RyZWVJbmZvXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiX2VuYWJsZWRcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwiX21pblBvc1wiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiAtMTAyNCwgXCJ5XCI6IC0xMDI0LCBcInpcIjogLTEwMjQgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfbWF4UG9zXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IDEwMjQsIFwieVwiOiAxMDI0LCBcInpcIjogMTAyNCB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9kZXB0aFwiOiA4XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgXSwgbnVsbCwgMik7XG5cbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIGZ1bGxQYXRoLCBzY2VuZUNvbnRlbnQpLnRoZW4oKHJlc3VsdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5nZXRTY2VuZUxpc3QoKS50aGVuKChzY2VuZUxpc3QpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY3JlYXRlZFNjZW5lID0gc2NlbmVMaXN0LmRhdGE/LmZpbmQoKHNjZW5lOiBhbnkpID0+IHNjZW5lLnV1aWQgPT09IHJlc3VsdC51dWlkKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IHJlc3VsdC51dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiByZXN1bHQudXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogc2NlbmVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFNjZW5lICcke3NjZW5lTmFtZX0nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5YCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNjZW5lVmVyaWZpZWQ6ICEhY3JlYXRlZFNjZW5lXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiByZXN1bHQudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVybDogcmVzdWx0LnVybCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHNjZW5lTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBTY2VuZSAnJHtzY2VuZU5hbWV9JyBjcmVhdGVkIHN1Y2Nlc3NmdWxseSAodmVyaWZpY2F0aW9uIGZhaWxlZClgXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2F2ZVNjZW5lQXMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgnc2NlbmUnLCAnc2F2ZS1hcy1zY2VuZScpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7IHBhdGgsIG1lc3NhZ2U6ICdTY2VuZSBzYXZlLWFzIGRpYWxvZyBvcGVuZWQnIH0pKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgY2xvc2VTY2VuZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjbG9zZS1zY2VuZScpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCAnU2NlbmUgY2xvc2VkIHN1Y2Nlc3NmdWxseScpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGBxdWVyeS1ub2RlLXRyZWVgJ3MgcmVzb2x2ZWQgbm9kZXMgbmV2ZXIgY2FycnkgYF9fY29tcHNfX2AsIHNvIGBidWlsZEhpZXJhcmNoeWAnc1xuICAgICAqIGNvbXBvbmVudCBicmFuY2ggYmVsb3cgY2FuIG5ldmVyIHBvcHVsYXRlIHJlYWwgZGF0YSBmcm9tIGl0LiBgc291cmNlL3NjZW5lLnRzYCdzIG93blxuICAgICAqIGBnZXRTY2VuZUhpZXJhcmNoeWAgd2Fsa3MgdGhlIExJVkUgYGNjLk5vZGVgIHRyZWUgaW5zdGVhZCBhbmQgYWx3YXlzIGhhcyByZWFsXG4gICAgICogY29tcG9uZW50IGRhdGEg4oCUIGdvIHN0cmFpZ2h0IHRoZXJlIHdoZW4gY29tcG9uZW50cyBhcmUgYWN0dWFsbHkgcmVxdWVzdGVkLlxuICAgICAqL1xuICAgIHByaXZhdGUgcXVlcnlIaWVyYXJjaHlWaWFTY3JpcHQoaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3Qgb3B0aW9ucyA9IHtcbiAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJyxcbiAgICAgICAgICAgIG1ldGhvZDogJ2dldFNjZW5lSGllcmFyY2h5JyxcbiAgICAgICAgICAgIGFyZ3M6IFtpbmNsdWRlQ29tcG9uZW50c11cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywgb3B0aW9ucykudGhlbigocmVzdWx0OiBhbnkpID0+IHtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgJiYgcmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQuZGF0YSwgcmVzdWx0Lm1lc3NhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRTY2VuZUhpZXJhcmNoeShpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIC8vIElzc3VlICM4NTogYGluY2x1ZGVDb21wb25lbnRzOiB0cnVlYCB3YXMgbGVmdCBhcyBhbiBlcnJvci1vbmx5IGZhbGxiYWNrIHRoYXRcbiAgICAgICAgLy8gb25seSByYW4gd2hlbiBgcXVlcnktbm9kZS10cmVlYCBSRUpFQ1RFRCDigJQgbmV2ZXIgd2hlbiBpdCByZXNvbHZlZCBzdWNjZXNzZnVsbHlcbiAgICAgICAgLy8gd2l0aG91dCBgX19jb21wc19fYCwgd2hpY2ggaXMgdGhlIGNvbW1vbiBjYXNlLiBSb3V0ZSBzdHJhaWdodCB0byB0aGVcbiAgICAgICAgLy8gc2NlbmUtc2NyaXB0IHBhdGggd2hlbmV2ZXIgY29tcG9uZW50cyBhcmUgcmVxdWVzdGVkOyB0aGUgYGluY2x1ZGVDb21wb25lbnRzOlxuICAgICAgICAvLyBmYWxzZWAgcGF0aCBiZWxvdyBpcyBVTkNIQU5HRUQuXG4gICAgICAgIGlmIChpbmNsdWRlQ29tcG9uZW50cykge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5xdWVyeUhpZXJhcmNoeVZpYVNjcmlwdChpbmNsdWRlQ29tcG9uZW50cyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgU2NlbmUgc2NyaXB0IGZhaWxlZDogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJykudGhlbigodHJlZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRyZWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaGllcmFyY2h5ID0gdGhpcy5idWlsZEhpZXJhcmNoeSh0cmVlLCBpbmNsdWRlQ29tcG9uZW50cyk7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChoaWVyYXJjaHkpKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KCdObyBzY2VuZSBoaWVyYXJjaHkgYXZhaWxhYmxlJykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5xdWVyeUhpZXJhcmNoeVZpYVNjcmlwdChpbmNsdWRlQ29tcG9uZW50cykudGhlbihyZXNvbHZlKS5jYXRjaCgoZXJyMjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBidWlsZEhpZXJhcmNoeShub2RlOiBhbnksIGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuKTogYW55IHtcbiAgICAgICAgY29uc3Qgbm9kZUluZm86IGFueSA9IHtcbiAgICAgICAgICAgIHV1aWQ6IG5vZGUudXVpZCxcbiAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZSxcbiAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXG4gICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoaW5jbHVkZUNvbXBvbmVudHMgJiYgbm9kZS5fX2NvbXBzX18pIHtcbiAgICAgICAgICAgIG5vZGVJbmZvLmNvbXBvbmVudHMgPSBub2RlLl9fY29tcHNfXy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICB0eXBlOiBjb21wLl9fdHlwZV9fIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiBjb21wLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGNvbXAuZW5hYmxlZCA6IHRydWVcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBub2RlSW5mby5jaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW4ubWFwKChjaGlsZDogYW55KSA9PlxuICAgICAgICAgICAgICAgIHRoaXMuYnVpbGRIaWVyYXJjaHkoY2hpbGQsIGluY2x1ZGVDb21wb25lbnRzKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub2RlSW5mbztcbiAgICB9XG59XG4iXX0=