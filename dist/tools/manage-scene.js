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
            open: (args) => this.openScene(args.scenePath),
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
    async openScene(scenePath) {
        if (!scenePath) {
            return (0, types_1.errorResult)('scenePath is required for action=open');
        }
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-uuid', scenePath).then((uuid) => {
                if (!uuid) {
                    throw new Error('Scene not found');
                }
                return Editor.Message.request('scene', 'open-scene', uuid);
            }).then(() => {
                resolve((0, types_1.successResult)(null, `Scene opened: ${scenePath}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjZW5lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1zY2VuZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQW1GO0FBQ25GLGtEQUFnRDtBQUNoRCxvREFBbUQ7QUFDbkQsc0VBRXNDO0FBRXRDLHdHQUF3RztBQUN4RyxNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQztBQVFuQyxNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsMFRBQTBULENBQUM7UUFDelUsWUFBTyxHQUFHLENBQUMsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ2pHLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLGFBQWEsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxlQUFlLENBQUM7b0JBQzVGLFdBQVcsRUFBRSxxU0FBcVM7aUJBQ3JUO2dCQUNELFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsOERBQThEO2lCQUM5RTtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGdDQUFnQztpQkFDaEQ7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwyRUFBMkU7aUJBQzNGO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxX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QyxJQUFJO1lBQ2YsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1lBQ2YsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO1lBQ25CLFFBQVEsRUFBRSxFQUFFO1NBQ2YsQ0FBQztRQUVGLElBQUksaUJBQWlCLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3RDLFFBQVEsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQ3JELElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLFNBQVM7Z0JBQ2hDLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSTthQUM1RCxDQUFDLENBQUMsQ0FBQztRQUNSLENBQUM7UUFFRCxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQixRQUFRLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBVSxFQUFFLEVBQUUsQ0FDakQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLENBQUMsQ0FDaEQsQ0FBQztRQUNOLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNwQixDQUFDO0NBQ0o7QUFqZkQsa0NBaWZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgU2NlbmVJbmZvLCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUJvb2wgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xuaW1wb3J0IHsgcmVzb2x2ZUFzc2V0IH0gZnJvbSAnLi4vdXRpbHMvYXNzZXQtcGF0aCc7XG5pbXBvcnQge1xuICAgIHJlYWRPdmVycmlkZVNuYXBzaG90LCBkZXNjcmliZU92ZXJyaWRlTG9zcywgc3RhdE10aW1lTXMsIHdhaXRGb3JGaWxlUmV3cml0ZVxufSBmcm9tICcuLi91dGlscy9zYXZlLWFydGlmYWN0LWd1YXJkJztcblxuLyoqIExvbmdlc3QgYHNhdmVTY2VuZWAgd2FpdHMgZm9yIHRoZSBzY2VuZSBmaWxlIHRvIGJlIHJld3JpdHRlbiBiZWZvcmUgY2FsbGluZyB0aGUgc2F2ZSB1bmNvbmZpcm1lZC4gKi9cbmNvbnN0IFNBVkVfV1JJVEVfVElNRU9VVF9NUyA9IDIwMDA7XG5cbi8qKlxuICogV2hhdCB0aGUgYXJ0aWZhY3Qgc2F5cyBhYm91dCBhIHJlcG9ydGVkLXN1Y2Nlc3NmdWwgc2F2ZS4gYHVudmVyaWZpZWRgIGlzIGEgZmlyc3QtY2xhc3NcbiAqIG91dGNvbWUsIG5vdCBhIHNvZnQgZmFpbHVyZSDigJQgXCJ3ZSBjb3VsZCBub3QgY2hlY2tcIiBtdXN0IG5ldmVyIHJlbmRlciBhcyBcIml0IHdvcmtlZFwiLlxuICovXG50eXBlIEFydGlmYWN0VmVyZGljdCA9ICd2ZXJpZmllZCcgfCAnZHJvcHBlZCcgfCAndW52ZXJpZmllZCc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VTY2VuZSBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9zY2VuZSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHNjZW5lcyBpbiB0aGUgcHJvamVjdC4gQWN0aW9uczogZ2V0X2N1cnJlbnQsIGxpc3QsIG9wZW4sIHNhdmUsIGNyZWF0ZSwgc2F2ZV9hcywgY2xvc2UsIGdldF9oaWVyYXJjaHkuIFVzZSBnZXRfY3VycmVudCB0byBjaGVjayBpZiBhIHNjZW5lIGlzIG9wZW4gYmVmb3JlIG5vZGUvY29tcG9uZW50IG9wZXJhdGlvbnMuIFVzZSBnZXRfaGllcmFyY2h5IHRvIHVuZGVyc3RhbmQgc2NlbmUgc3RydWN0dXJlIGJlZm9yZSBtb2RpZnlpbmcgbm9kZXMuIFByZXJlcXVpc2l0ZXM6IHByb2plY3QgbXVzdCBiZSBvcGVuIGluIENvY29zIENyZWF0b3IuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydnZXRfY3VycmVudCcsICdsaXN0JywgJ29wZW4nLCAnc2F2ZScsICdjcmVhdGUnLCAnc2F2ZV9hcycsICdjbG9zZScsICdnZXRfaGllcmFyY2h5J107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2dldF9jdXJyZW50JywgJ2xpc3QnLCAnb3BlbicsICdzYXZlJywgJ2NyZWF0ZScsICdzYXZlX2FzJywgJ2Nsb3NlJywgJ2dldF9oaWVyYXJjaHknXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBnZXRfY3VycmVudD1nZXQgb3BlbiBzY2VuZSBpbmZvLCBsaXN0PWxpc3QgYWxsIHNjZW5lcyBpbiBwcm9qZWN0LCBvcGVuPW9wZW4gYSBzY2VuZSBieSBwYXRoLCBzYXZlPXNhdmUgY3VycmVudCBzY2VuZSwgY3JlYXRlPWNyZWF0ZSBuZXcgc2NlbmUgYXNzZXQsIHNhdmVfYXM9c2F2ZSBzY2VuZSBhcyBuZXcgZmlsZSAob3BlbnMgZGlhbG9nKSwgY2xvc2U9Y2xvc2UgY3VycmVudCBzY2VuZSwgZ2V0X2hpZXJhcmNoeT1nZXQgZnVsbCBub2RlIHRyZWUgb2YgY3VycmVudCBzY2VuZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY2VuZVBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tvcGVuXSBTY2VuZSBmaWxlIHBhdGggKGUuZy4sIGRiOi8vYXNzZXRzL3NjZW5lcy9NYWluLnNjZW5lKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzY2VuZU5hbWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIE5hbWUgb2YgdGhlIG5ldyBzY2VuZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzYXZlUGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gUGF0aCB0byBzYXZlIHRoZSBzY2VuZSAoZS5nLiwgZGI6Ly9hc3NldHMvc2NlbmVzL05ld1NjZW5lLnNjZW5lKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2F2ZV9hc10gUGF0aCB0byBzYXZlIHRoZSBzY2VuZSBhcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbmNsdWRlQ29tcG9uZW50czoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfaGllcmFyY2h5XSBJbmNsdWRlIGNvbXBvbmVudCBpbmZvcm1hdGlvbiBpbiBoaWVyYXJjaHkgb3V0cHV0JyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiBmYWxzZVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2N1cnJlbnQ6IChhcmdzKSA9PiB0aGlzLmdldEN1cnJlbnRTY2VuZSgpLFxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5nZXRTY2VuZUxpc3QoKSxcbiAgICAgICAgb3BlbjogKGFyZ3MpID0+IHRoaXMub3BlblNjZW5lKGFyZ3Muc2NlbmVQYXRoKSxcbiAgICAgICAgc2F2ZTogKGFyZ3MpID0+IHRoaXMuc2F2ZVNjZW5lKCksXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlU2NlbmUoYXJncy5zY2VuZU5hbWUsIGFyZ3Muc2F2ZVBhdGgpLFxuICAgICAgICBzYXZlX2FzOiAoYXJncykgPT4gdGhpcy5zYXZlU2NlbmVBcyhhcmdzLnBhdGgpLFxuICAgICAgICBjbG9zZTogKGFyZ3MpID0+IHRoaXMuY2xvc2VTY2VuZSgpLFxuICAgICAgICBnZXRfaGllcmFyY2h5OiAoYXJncykgPT4gdGhpcy5nZXRTY2VuZUhpZXJhcmNoeShjb2VyY2VCb29sKGFyZ3MuaW5jbHVkZUNvbXBvbmVudHMpID8/IGZhbHNlKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEN1cnJlbnRTY2VuZSgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKS50aGVuKCh0cmVlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHJlZSAmJiB0cmVlLnV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IHRyZWUubmFtZSB8fCAnQ3VycmVudCBTY2VuZScsXG4gICAgICAgICAgICAgICAgICAgICAgICB1dWlkOiB0cmVlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB0cmVlLnR5cGUgfHwgJ2NjLlNjZW5lJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogdHJlZS5hY3RpdmUgIT09IHVuZGVmaW5lZCA/IHRyZWUuYWN0aXZlIDogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGVDb3VudDogdHJlZS5jaGlsZHJlbiA/IHRyZWUuY2hpbGRyZW4ubGVuZ3RoIDogMFxuICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnTm8gc2NlbmUgZGF0YSBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ2dldEN1cnJlbnRTY2VuZUluZm8nLFxuICAgICAgICAgICAgICAgICAgICBhcmdzOiBbXVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCBvcHRpb25zKS50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKSk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KHJlc3VsdD8uZXJyb3IgfHwgJ1Vua25vd24gZXJyb3InKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoZXJyMjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChgRGlyZWN0IEFQSSBmYWlsZWQ6ICR7ZXJyLm1lc3NhZ2V9LCBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2VycjIubWVzc2FnZX1gKSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRTY2VuZUxpc3QoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywge1xuICAgICAgICAgICAgICAgIHBhdHRlcm46ICdkYjovL2Fzc2V0cy8qKi8qLnNjZW5lJ1xuICAgICAgICAgICAgfSkudGhlbigocmVzdWx0czogYW55W10pID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzY2VuZXM6IFNjZW5lSW5mb1tdID0gcmVzdWx0cy5tYXAoYXNzZXQgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogYXNzZXQudXJsLFxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBhc3NldC51dWlkXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChzY2VuZXMpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlblNjZW5lKHNjZW5lUGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghc2NlbmVQYXRoKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3NjZW5lUGF0aCBpcyByZXF1aXJlZCBmb3IgYWN0aW9uPW9wZW4nKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LXV1aWQnLCBzY2VuZVBhdGgpLnRoZW4oKHV1aWQ6IHN0cmluZyB8IG51bGwpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXV1aWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdTY2VuZSBub3QgZm91bmQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ29wZW4tc2NlbmUnLCB1dWlkKTtcbiAgICAgICAgICAgIH0pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgU2NlbmUgb3BlbmVkOiAke3NjZW5lUGF0aH1gKSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBgc2NlbmU6c2F2ZS1zY2VuZWAgcmVzb2x2ZXMgdG8gYSBgYm9vbGVhbmAgKHBlciB0aGUgc2hpcHBlZCAzLjguNyBtZXNzYWdlIHR5cGVzLFxuICAgICAqIGBub2RlX21vZHVsZXMvQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9tZXNzYWdlLmQudHNgKSxcbiAgICAgKiBub3QgYHZvaWRgIOKAlCB0aGUgb2xkIGNvZGUgZGlzY2FyZGVkIHRoYXQgcmVzdWx0IGFuZCByZXBvcnRlZCBzdWNjZXNzIHVuY29uZGl0aW9uYWxseVxuICAgICAqIG9uY2UgdGhlIHByb21pc2Ugc2V0dGxlZCwgd2l0aCBubyB2ZXJpZmljYXRpb24gYW5kIG5vIGAuY2F0Y2hgIGZvciBhIHJlamVjdGVkIHNhdmUuXG4gICAgICogQSBgZmFsc2VgIHJlc3VsdCBpcyB0cmVhdGVkIGFzIGEgZmFpbGVkIHNhdmUgKCM2KS5cbiAgICAgKlxuICAgICAqIEEgcmVzb2x2ZWQgYHRydWVgLCBhbmQgYSBgcXVlcnktZGlydHlgIHJlYWRpbmcgb2YgYGZhbHNlYCBpbW1lZGlhdGVseSBhZnRlciBpdCwgYXJlXG4gICAgICogYm90aCBzdGF0ZW1lbnRzIGFib3V0IHRoZSBFRElUT1IncyBpbi1tZW1vcnkgdmlldyDigJQgbmVpdGhlciBpcyBhIHN0YXRlbWVudCBhYm91dCB0aGVcbiAgICAgKiBmaWxlLiAjNidzIHJlZ3Jlc3Npb24gcmVwb3J0ICgyMDI2LTA5LTIxKSBpcyBleGFjdGx5IHRoYXQgZ2FwOiBzdHJpY3RseSBzZXF1ZW50aWFsXG4gICAgICogY2FsbHMsIGBzYXZlYCByZXR1cm5pbmcgYHRydWVgIHRocmVlIHRpbWVzLCBgcXVlcnlfZGlydHlgIHJlYWRpbmcgYGZhbHNlYCwgYW5kIHRoZVxuICAgICAqIGAuc2NlbmVgIGZpbGUncyBtdGltZSBmcm96ZW4gYXQgaXRzIHByZS1lZGl0IHRpbWVzdGFtcCB3aXRoIHRoZSBlZGl0IGFic2VudCBmcm9tIHRoZVxuICAgICAqIEpTT04uIFRoZSBlZGl0b3IgYmVsaWV2ZWQgaXQgaGFkIHNhdmVkOyBpdCBoYWQgbm90LlxuICAgICAqXG4gICAgICogU28gdGhlIGFydGlmYWN0IGl0c2VsZiBpcyB0aGUgYXJiaXRlciwgb24gdHdvIHJlYWRzIG9mIGl0OlxuICAgICAqXG4gICAgICogIC0gKiptdGltZSBkaWQgbm90IGFkdmFuY2UqKiDihpIgbm90aGluZyB3YXMgc2VyaWFsaXNlZC4gSGFyZCBmYWlsdXJlICgjNikuXG4gICAgICogIC0gKipgY2MuVGFyZ2V0T3ZlcnJpZGVJbmZvYCByZWNvcmRzIGRyb3BwZWQqKiDihpIgdGhlIGZpbGUgd2FzIHJld3JpdHRlbiwgYnV0IGxvc3NpbHkuXG4gICAgICogICAgUmVwb3J0ZWQgYXMgYSBsb3VkIG5vbi1zdWNjZXNzIHdpdGggdGhlIGxvc3QgYHByb3BlcnR5UGF0aGBzIG5hbWVkICgjNzgpLiBBXG4gICAgICogICAgbm8tZWRpdCByb3VuZC10cmlwIGxvc2luZyB0aGVzZSByZWNvcmRzIGlzIHRoZSByZXBvcnRlZCByZXBybzogMjUgYmVmb3JlLCAyMyBhZnRlcixcbiAgICAgKiAgICBhbmQgdGhlIG9sZCByZXNwb25zZSB3YXMgYnl0ZS1pZGVudGljYWwgdG8gYSBsb3NzbGVzcyBzYXZlJ3MuXG4gICAgICpcbiAgICAgKiBCb3RoIGNoZWNrcyBhcmUgYmVzdC1lZmZvcnQgaW4gdGhlIHNlbnNlIHRoYXQgYW4gdW5yZWFkYWJsZSBhcnRpZmFjdCB5aWVsZHNcbiAgICAgKiBcInVudmVyaWZpYWJsZVwiIHJhdGhlciB0aGFuIGEgcGFzcyDigJQgdGhlIHJlc3VsdCBzYXlzIHdoaWNoIGl0IHdhcywgc28gYSBjYWxsZXIgaXMgbmV2ZXJcbiAgICAgKiB0b2xkIFwidmVyaWZpZWRcIiBvbiB0aGUgc3RyZW5ndGggb2YgYSByZWFkIHRoYXQgZGlkIG5vdCBoYXBwZW4uIFRoZSBtdXRhdGluZyBjYWxsc1xuICAgICAqIGFoZWFkIG9mIHRoaXMgc2F2ZSBhcmUgc2VyaWFsaXNlZCBvbiBvbmUgY2hhaW4gKGB0b29scy9tdXRhdGlvbi1xdWV1ZS50c2ApLCBhbmRcbiAgICAgKiBgbWFuYWdlX3NjZW5lX3F1ZXJ5YCByZWNvbmNpbGVzIHRoZSByYXcgZGlydHkgZmxhZyBhZ2FpbnN0IHRoYXQgcXVldWUuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlU2NlbmUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IHNjZW5lUGF0aCA9IGF3YWl0IHRoaXMucmVzb2x2ZUN1cnJlbnRTY2VuZUZpbGVQYXRoKCk7XG4gICAgICAgIGNvbnN0IG10aW1lQmVmb3JlID0gc3RhdE10aW1lTXMoc2NlbmVQYXRoKTtcbiAgICAgICAgY29uc3Qgb3ZlcnJpZGVzQmVmb3JlID0gcmVhZE92ZXJyaWRlU25hcHNob3Qoc2NlbmVQYXRoKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc2F2ZWQ6IGJvb2xlYW4gPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdzYXZlLXNjZW5lJyk7XG4gICAgICAgICAgICBpZiAoc2F2ZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdzY2VuZTpzYXZlLXNjZW5lIHJldHVybmVkIGZhbHNlIOKAlCB0aGUgZWRpdG9yIHJlamVjdGVkIHRoZSBzYXZlLiBOb3RoaW5nIHdhcyB3cml0dGVuLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIDEuIERpcnR5LWZsYWcgYmFja3N0b3Ag4oCUIHRoZSBlZGl0b3Igc3RpbGwgaG9sZHMgdW5jb21taXR0ZWQgZWRpdHMuXG4gICAgICAgIGxldCBlZGl0b3JEaXJ0eTogYm9vbGVhbiB8IG51bGwgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZWRpdG9yRGlydHkgPSAoYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZGlydHknKSkgPT09IHRydWU7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gQmVzdC1lZmZvcnQ6IHVucmVhZGFibGUgZGlydHkgc3RhdGUgbXVzdCBub3QgdHVybiBhIHJlYWwgc2F2ZSBpbnRvIGEgZmFpbHVyZS5cbiAgICAgICAgfVxuICAgICAgICBpZiAoZWRpdG9yRGlydHkgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcbiAgICAgICAgICAgICAgICAnc2F2ZS1zY2VuZSByZXBvcnRlZCBzdWNjZXNzLCBidXQgdGhlIHNjZW5lIGlzIHN0aWxsIGRpcnR5IGltbWVkaWF0ZWx5IGFmdGVyd2FyZCDigJQgJyArXG4gICAgICAgICAgICAgICAgJ2EgcGVuZGluZyBlZGl0IHdhcyBub3QgY2FwdHVyZWQgaW4gdGhpcyBzYXZlLiBUaGlzIHR5cGljYWxseSBtZWFucyBhIG11dGF0aW5nIGNhbGwgJyArXG4gICAgICAgICAgICAgICAgJyhtYW5hZ2Vfbm9kZS9tYW5hZ2VfY29tcG9uZW50L2V0Yy4pIHdhcyBpc3N1ZWQgY29uY3VycmVudGx5IG9yIGJhdGNoZWQgd2l0aCB0aGlzIHNhdmUgJyArXG4gICAgICAgICAgICAgICAgJ2luc3RlYWQgb2YgYXdhaXRlZCBmaXJzdDsgaXNzdWUgY2FsbHMgc2VxdWVudGlhbGx5IGFuZCByZXRyeSBzYXZlLidcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyAyLiBBcnRpZmFjdCBjaGVja3MuIGBzY2VuZVBhdGggPT09IG51bGxgIG1lYW5zIHRoZSBvbi1kaXNrIGZpbGUgY291bGQgbm90IGJlXG4gICAgICAgIC8vIHJlc29sdmVkICh1bnNhdmVkIHNjZW5lLCB1bmtub3duIGFzc2V0KTsgdGhhdCBpcyByZXBvcnRlZCBhcyB1bnZlcmlmaWVkLCBuZXZlclxuICAgICAgICAvLyBmb2xkZWQgaW50byBlaXRoZXIgYSBwYXNzIG9yIGEgZmFpbHVyZS5cbiAgICAgICAgY29uc3QgYXJ0aWZhY3Q6IHsgdmVyaWZpZWQ6IGJvb2xlYW47IHZlcmRpY3Q6IEFydGlmYWN0VmVyZGljdDsgcmVhc29uOiBzdHJpbmcgfCBudWxsOyBtdGltZU1zOiBudW1iZXIgfCBudWxsOyBsb3N0T3ZlcnJpZGVzOiBzdHJpbmcgfCBudWxsIH0gPVxuICAgICAgICAgICAgc2NlbmVQYXRoID09PSBudWxsXG4gICAgICAgICAgICAgICAgPyB7IHZlcmlmaWVkOiBmYWxzZSwgdmVyZGljdDogJ3VudmVyaWZpZWQnLCByZWFzb246IG51bGwsIG10aW1lTXM6IG51bGwsIGxvc3RPdmVycmlkZXM6IG51bGwgfVxuICAgICAgICAgICAgICAgIDogYXdhaXQgdGhpcy52ZXJpZnlTYXZlZEFydGlmYWN0KHNjZW5lUGF0aCwgbXRpbWVCZWZvcmUsIG92ZXJyaWRlc0JlZm9yZSk7XG5cbiAgICAgICAgaWYgKGFydGlmYWN0Lmxvc3RPdmVycmlkZXMpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBTY2VuZSBzYXZlZCB0byAke3NjZW5lUGF0aH0sIGJ1dCB0aGUgc2F2ZSBXQVMgTE9TU1k6ICR7YXJ0aWZhY3QubG9zdE92ZXJyaWRlc31gLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgZmlsZTogc2NlbmVQYXRoLCBkaXJ0eTogZmFsc2UsIGVkaXRvckRpcnR5LCBwZXJzaXN0ZW5jZVZlcmlmaWVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAuLi4oYXJ0aWZhY3QubXRpbWVNcyAhPT0gbnVsbCA/IHsgbXRpbWVNczogYXJ0aWZhY3QubXRpbWVNcyB9IDoge30pXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBpc0Vycm9yOiB0cnVlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGFydGlmYWN0LnZlcmRpY3QgPT09ICdkcm9wcGVkJykge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgIGBzYXZlLXNjZW5lIHJlcG9ydGVkIHN1Y2Nlc3MgYnV0IHRoZSB3cml0ZSBkaWQgbm90IHJlYWNoIGRpc2s6ICR7YXJ0aWZhY3QucmVhc29ufS4gYCArXG4gICAgICAgICAgICAgICAgJ1RoaXMgaXMgdGhlICM2IGZhbHNlLXN1Y2Nlc3Mgc2hhcGUg4oCUIHZlcmlmeSB0aGUgZmlsZSB5b3Vyc2VsZiwgYW5kIGlmIHRoZSBlZGl0IGlzIGFic2VudCwgJyArXG4gICAgICAgICAgICAgICAgJ3ByZXNzIEN0cmwrUyBpbiB0aGUgQ29jb3MgQ3JlYXRvciBlZGl0b3IgYW5kIHJlcG9ydCB0aGUgb2NjdXJyZW5jZSBvbiAjNi4nXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZGlydHk6IGZhbHNlLCBlZGl0b3JEaXJ0eSwgZmlsZTogc2NlbmVQYXRoLFxuICAgICAgICAgICAgICAgIHBlcnNpc3RlbmNlVmVyaWZpZWQ6IGFydGlmYWN0LnZlcmRpY3QgPT09ICd2ZXJpZmllZCcsXG4gICAgICAgICAgICAgICAgLi4uKGFydGlmYWN0Lm10aW1lTXMgIT09IG51bGwgPyB7IG10aW1lTXM6IGFydGlmYWN0Lm10aW1lTXMgfSA6IHt9KVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFydGlmYWN0LnZlcmRpY3QgPT09ICd2ZXJpZmllZCdcbiAgICAgICAgICAgICAgICA/ICdTY2VuZSBzYXZlZCBzdWNjZXNzZnVsbHkgKGZpbGUgcmV3cml0dGVuIGFuZCBvdmVycmlkZSByZWNvcmRzIHByZXNlcnZlZCknXG4gICAgICAgICAgICAgICAgOiAnU2NlbmUgc2F2ZWQgc3VjY2Vzc2Z1bGx5IChkaXJ0eSBzdGF0ZSB1bnZlcmlmaWFibGUpJ1xuICAgICAgICApO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbmZpcm0gdGhlIHNhdmUgYWN0dWFsbHkgcmVhY2hlZCB0aGUgYXJ0aWZhY3QsIGFuZCB0aGF0IGl0IGRpZCBub3QgbG9zZSBvdmVycmlkZVxuICAgICAqIHJlY29yZHMgb24gdGhlIHdheS5cbiAgICAgKlxuICAgICAqIFRocmVlIG91dGNvbWVzLCBkZWxpYmVyYXRlbHkgbm90IHR3byDigJQgXCJ3ZSBjb3VsZCBub3QgY2hlY2tcIiBtdXN0IHN0YXkgZGlzdGluZ3Vpc2hhYmxlXG4gICAgICogZnJvbSBib3RoIFwid2UgY2hlY2tlZCBhbmQgaXQgbGFuZGVkXCIgYW5kIFwid2UgY2hlY2tlZCBhbmQgaXQgZGlkIG5vdFwiOlxuICAgICAqXG4gICAgICogIC0gYHZlcmlmaWVkYCAg4oCUIHRoZSB3cml0ZSBpcyBjb25maXJtZWQsIGFuZCBubyBvdmVycmlkZSByZWNvcmQgd2FzIGxvc3QuXG4gICAgICogIC0gYGRyb3BwZWRgICAg4oCUIHRoZSB3cml0ZSBpcyBjb25maXJtZWQgQUJTRU5UIChhbiBleGlzdGluZyBmaWxlIHdob3NlIG10aW1lIGRpZCBub3RcbiAgICAgKiAgICAgICAgICAgICAgICAgIGFkdmFuY2UpLiBFdmlkZW5jZSBvZiB0aGUgIzYgZmFsc2Ugc3VjY2VzczsgcmVwb3J0ZWQgYXMgYSBmYWlsdXJlLlxuICAgICAqICAtIGB1bnZlcmlmaWVkYOKAlCBubyBhcnRpZmFjdCBldmlkZW5jZSBlaXRoZXIgd2F5IChubyBmaWxlIGF0IHRoZSByZXNvbHZlZCBwYXRoLCBmaWxlXG4gICAgICogICAgICAgICAgICAgICAgICB1bnJlYWRhYmxlKS4gUmVwb3J0ZWQgYXMgZXhwbGljaXRseSB1bnZlcmlmaWVkLCBuZXZlciBhcyBhIHBhc3MuXG4gICAgICovXG4gICAgcHJpdmF0ZSBhc3luYyB2ZXJpZnlTYXZlZEFydGlmYWN0KFxuICAgICAgICBzY2VuZVBhdGg6IHN0cmluZyxcbiAgICAgICAgbXRpbWVCZWZvcmU6IG51bWJlciB8IG51bGwsXG4gICAgICAgIG92ZXJyaWRlc0JlZm9yZTogeyB0b3RhbDogbnVtYmVyOyBwcm9wZXJ0eVBhdGhzOiBzdHJpbmdbXSB9IHwgbnVsbFxuICAgICk6IFByb21pc2U8eyB2ZXJpZmllZDogYm9vbGVhbjsgdmVyZGljdDogQXJ0aWZhY3RWZXJkaWN0OyByZWFzb246IHN0cmluZyB8IG51bGw7IG10aW1lTXM6IG51bWJlciB8IG51bGw7IGxvc3RPdmVycmlkZXM6IHN0cmluZyB8IG51bGwgfT4ge1xuICAgICAgICBjb25zdCBtdGltZUFmdGVyID0gbXRpbWVCZWZvcmUgPT09IG51bGxcbiAgICAgICAgICAgID8gbnVsbFxuICAgICAgICAgICAgOiBhd2FpdCB3YWl0Rm9yRmlsZVJld3JpdGUoc2NlbmVQYXRoLCBtdGltZUJlZm9yZSwgU0FWRV9XUklURV9USU1FT1VUX01TKTtcblxuICAgICAgICBsZXQgbG9zdE92ZXJyaWRlczogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIGlmIChvdmVycmlkZXNCZWZvcmUgJiYgb3ZlcnJpZGVzQmVmb3JlLnRvdGFsID4gMCkge1xuICAgICAgICAgICAgbG9zdE92ZXJyaWRlcyA9IGRlc2NyaWJlT3ZlcnJpZGVMb3NzKG92ZXJyaWRlc0JlZm9yZSwgcmVhZE92ZXJyaWRlU25hcHNob3Qoc2NlbmVQYXRoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXdyaXR0ZW4gPSBtdGltZUJlZm9yZSAhPT0gbnVsbCAmJiBtdGltZUFmdGVyICE9PSBudWxsICYmIG10aW1lQWZ0ZXIgPiBtdGltZUJlZm9yZTtcbiAgICAgICAgLy8gQW4gb3ZlcnJpZGUgbG9zcyBwcm92ZXMgdGhlIGZpbGUgd2FzIHJld3JpdHRlbjsgZG8gbm90IGFsc28gZGVtYW5kIGEgbW92ZWQgbXRpbWUsXG4gICAgICAgIC8vIHdoaWNoIGEgY29hcnNlIGZpbGVzeXN0ZW0gdGltZXN0YW1wIGNvdWxkIGZhaWwgdG8gc2hvdy5cbiAgICAgICAgaWYgKHJld3JpdHRlbiB8fCBsb3N0T3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2ZXJpZmllZDogdHJ1ZSwgdmVyZGljdDogJ3ZlcmlmaWVkJywgcmVhc29uOiBudWxsLCBtdGltZU1zOiBtdGltZUFmdGVyLCBsb3N0T3ZlcnJpZGVzIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBObyBmaWxlIGF0IHRoZSByZXNvbHZlZCBwYXRoIOKAlCBiZWZvcmUgQU5EIGFmdGVyLiBUaGVyZSBpcyBub3RoaW5nIHRvIGNvbXBhcmUsIHNvXG4gICAgICAgIC8vIHRoaXMgaXMgXCJ1bnZlcmlmaWFibGVcIiwgbm90IGEgZHJvcHBlZCB3cml0ZTogYSBzY2VuZSB0aGF0IGhhcyBuZXZlciBiZWVuIHdyaXR0ZW5cbiAgICAgICAgLy8gdG8gZGlzayBsZWdpdGltYXRlbHkgaGFzIG5vIGFydGlmYWN0LCBhbmQgYSBtaXMtcmVzb2x2ZWQgcGF0aCBtdXN0IG5vdCBiZSByZXBvcnRlZFxuICAgICAgICAvLyBhcyBhIGRhdGEgbG9zcy5cbiAgICAgICAgaWYgKG10aW1lQmVmb3JlID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4geyB2ZXJpZmllZDogZmFsc2UsIHZlcmRpY3Q6ICd1bnZlcmlmaWVkJywgcmVhc29uOiBudWxsLCBtdGltZU1zOiBudWxsLCBsb3N0T3ZlcnJpZGVzOiBudWxsIH07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBBIGZpbGUgZXhpc3RlZCBhbmQgdGhlIHNhdmUgZGlkIG5vdCB0b3VjaCBpdC4gVGhhdCBpcyB0aGUgIzYgZGVmZWN0OiB0aGUgZWRpdG9yXG4gICAgICAgIC8vIHJlcG9ydGVkIHN1Y2Nlc3Mgb3ZlciBhIHdyaXRlIHRoYXQgbmV2ZXIgaGFwcGVuZWQuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB2ZXJpZmllZDogZmFsc2UsIHZlcmRpY3Q6ICdkcm9wcGVkJywgbXRpbWVNczogbXRpbWVBZnRlciwgbG9zdE92ZXJyaWRlczogbnVsbCxcbiAgICAgICAgICAgIHJlYXNvbjogYCR7c2NlbmVQYXRofSBleGlzdGVkIGJlZm9yZSB0aGUgc2F2ZSBhbmQgd2FzIG5vdCByZXdyaXR0ZW4gYnkgaXQgKG10aW1lIHVuY2hhbmdlZCksIHNvIHRoZSByZXBvcnRlZC1zdWNjZXNzZnVsIHNhdmUgZGlkIG5vdCBzZXJpYWxpc2UgYW55dGhpbmdgXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzb2x2ZSB0aGUgb24tZGlzayBwYXRoIG9mIHRoZSBzY2VuZSBjdXJyZW50bHkgb3BlbiBpbiB0aGUgZWRpdG9yLlxuICAgICAqXG4gICAgICogYHNjZW5lOnF1ZXJ5LW5vZGUtdHJlZWAgeWllbGRzIHRoZSBvcGVuIHNjZW5lJ3MgUk9PVCBub2RlLCB3aG9zZSB1dWlkIGlzIHRoZSBzY2VuZVxuICAgICAqIGFzc2V0J3MgdXVpZCBmb3IgYSBzYXZlZCBzY2VuZSDigJQgZW5vdWdoIHRvIHJlc29sdmUgdGhlIGZpbGUgdGhyb3VnaCBgYXNzZXQtZGJgLiBBXG4gICAgICogbmV2ZXItc2F2ZWQgc2NlbmUgaGFzIG5vIGFzc2V0IGZpbGUsIHNvIHRoaXMgcmV0dXJucyBudWxsIGFuZCB0aGUgY2FsbGVyIHJlcG9ydHMgdGhlXG4gICAgICogYXJ0aWZhY3QgYXMgdW52ZXJpZmlhYmxlIHJhdGhlciB0aGFuIGd1ZXNzaW5nIGEgcGF0aC5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHJlc29sdmVDdXJyZW50U2NlbmVGaWxlUGF0aCgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcbiAgICAgICAgbGV0IHNjZW5lVXVpZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0cmVlOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRyZWUpKSBzY2VuZVV1aWQgPSB0cmVlWzBdPy51dWlkIHx8IG51bGw7XG4gICAgICAgICAgICBlbHNlIGlmICh0cmVlICYmIHR5cGVvZiB0cmVlID09PSAnb2JqZWN0Jykgc2NlbmVVdWlkID0gdHJlZS51dWlkIHx8IG51bGw7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgc2NlbmVVdWlkID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXNjZW5lVXVpZCkgcmV0dXJuIG51bGw7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiAoYXdhaXQgcmVzb2x2ZUFzc2V0KHNjZW5lVXVpZCkpLmZpbGVQYXRoO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVTY2VuZShzY2VuZU5hbWU6IHN0cmluZywgc2F2ZVBhdGg6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIXNjZW5lTmFtZSB8fCAhc2F2ZVBhdGgpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnc2NlbmVOYW1lIGFuZCBzYXZlUGF0aCBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1jcmVhdGUnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGxQYXRoID0gc2F2ZVBhdGguZW5kc1dpdGgoJy5zY2VuZScpID8gc2F2ZVBhdGggOiBgJHtzYXZlUGF0aH0vJHtzY2VuZU5hbWV9LnNjZW5lYDtcblxuICAgICAgICAgICAgY29uc3Qgc2NlbmVDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlNjZW5lQXNzZXRcIixcbiAgICAgICAgICAgICAgICAgICAgXCJfbmFtZVwiOiBzY2VuZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgIFwiX29iakZsYWdzXCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX19lZGl0b3JFeHRyYXNfX1wiOiB7fSxcbiAgICAgICAgICAgICAgICAgICAgXCJfbmF0aXZlXCI6IFwiXCIsXG4gICAgICAgICAgICAgICAgICAgIFwic2NlbmVcIjogeyBcIl9faWRfX1wiOiAxIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlNjZW5lXCIsXG4gICAgICAgICAgICAgICAgICAgIFwiX25hbWVcIjogc2NlbmVOYW1lLFxuICAgICAgICAgICAgICAgICAgICBcIl9vYmpGbGFnc1wiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9fZWRpdG9yRXh0cmFzX19cIjoge30sXG4gICAgICAgICAgICAgICAgICAgIFwiX3BhcmVudFwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9jaGlsZHJlblwiOiBbXSxcbiAgICAgICAgICAgICAgICAgICAgXCJfYWN0aXZlXCI6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIFwiX2NvbXBvbmVudHNcIjogW10sXG4gICAgICAgICAgICAgICAgICAgIFwiX3ByZWZhYlwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9scG9zXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IDAsIFwieVwiOiAwLCBcInpcIjogMCB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9scm90XCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlF1YXRcIiwgXCJ4XCI6IDAsIFwieVwiOiAwLCBcInpcIjogMCwgXCJ3XCI6IDEgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfbHNjYWxlXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IDEsIFwieVwiOiAxLCBcInpcIjogMSB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9tb2JpbGl0eVwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9sYXllclwiOiAxMDczNzQxODI0LFxuICAgICAgICAgICAgICAgICAgICBcIl9ldWxlclwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWMzXCIsIFwieFwiOiAwLCBcInlcIjogMCwgXCJ6XCI6IDAgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJhdXRvUmVsZWFzZUFzc2V0c1wiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfZ2xvYmFsc1wiOiB7IFwiX19pZF9fXCI6IDIgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJfaWRcIjogXCJzY2VuZVwiXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5TY2VuZUdsb2JhbHNcIixcbiAgICAgICAgICAgICAgICAgICAgXCJhbWJpZW50XCI6IHsgXCJfX2lkX19cIjogMyB9LFxuICAgICAgICAgICAgICAgICAgICBcInNreWJveFwiOiB7IFwiX19pZF9fXCI6IDQgfSxcbiAgICAgICAgICAgICAgICAgICAgXCJmb2dcIjogeyBcIl9faWRfX1wiOiA1IH0sXG4gICAgICAgICAgICAgICAgICAgIFwib2N0cmVlXCI6IHsgXCJfX2lkX19cIjogNiB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIFwiX190eXBlX19cIjogXCJjYy5BbWJpZW50SW5mb1wiLFxuICAgICAgICAgICAgICAgICAgICBcIl9za3lDb2xvckhEUlwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWM0XCIsIFwieFwiOiAwLjIsIFwieVwiOiAwLjUsIFwielwiOiAwLjgsIFwid1wiOiAwLjUyMDgzMyB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9za3lDb2xvclwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWM0XCIsIFwieFwiOiAwLjIsIFwieVwiOiAwLjUsIFwielwiOiAwLjgsIFwid1wiOiAwLjUyMDgzMyB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9za3lJbGx1bUhEUlwiOiAyMDAwMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfc2t5SWxsdW1cIjogMjAwMDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX2dyb3VuZEFsYmVkb0hEUlwiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWM0XCIsIFwieFwiOiAwLjIsIFwieVwiOiAwLjIsIFwielwiOiAwLjIsIFwid1wiOiAxIH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX2dyb3VuZEFsYmVkb1wiOiB7IFwiX190eXBlX19cIjogXCJjYy5WZWM0XCIsIFwieFwiOiAwLjIsIFwieVwiOiAwLjIsIFwielwiOiAwLjIsIFwid1wiOiAxIH1cbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLlNreWJveEluZm9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJfZW52TGlnaHRpbmdUeXBlXCI6IDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX2Vudm1hcEhEUlwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9lbnZtYXBcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZW52bWFwTG9kQ291bnRcIjogMCxcbiAgICAgICAgICAgICAgICAgICAgXCJfZGlmZnVzZU1hcEhEUlwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9kaWZmdXNlTWFwXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX2VuYWJsZWRcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwiX3VzZUhEUlwiOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBcIl9lZGl0YWJsZU1hdGVyaWFsXCI6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIFwiX3JlZmxlY3Rpb25IRFJcIjogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgXCJfcmVmbGVjdGlvbk1hcFwiOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBcIl9yb3RhdGlvbkFuZ2xlXCI6IDBcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLkZvZ0luZm9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJfdHlwZVwiOiAwLFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dDb2xvclwiOiB7IFwiX190eXBlX19cIjogXCJjYy5Db2xvclwiLCBcInJcIjogMjAwLCBcImdcIjogMjAwLCBcImJcIjogMjAwLCBcImFcIjogMjU1IH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX2VuYWJsZWRcIjogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ0RlbnNpdHlcIjogMC4zLFxuICAgICAgICAgICAgICAgICAgICBcIl9mb2dTdGFydFwiOiAwLjUsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ0VuZFwiOiAzMDAsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ0F0dGVuXCI6IDUsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ1RvcFwiOiAxLjUsXG4gICAgICAgICAgICAgICAgICAgIFwiX2ZvZ1JhbmdlXCI6IDEuMixcbiAgICAgICAgICAgICAgICAgICAgXCJfYWNjdXJhdGVcIjogZmFsc2VcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgXCJfX3R5cGVfX1wiOiBcImNjLk9jdHJlZUluZm9cIixcbiAgICAgICAgICAgICAgICAgICAgXCJfZW5hYmxlZFwiOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgXCJfbWluUG9zXCI6IHsgXCJfX3R5cGVfX1wiOiBcImNjLlZlYzNcIiwgXCJ4XCI6IC0xMDI0LCBcInlcIjogLTEwMjQsIFwielwiOiAtMTAyNCB9LFxuICAgICAgICAgICAgICAgICAgICBcIl9tYXhQb3NcIjogeyBcIl9fdHlwZV9fXCI6IFwiY2MuVmVjM1wiLCBcInhcIjogMTAyNCwgXCJ5XCI6IDEwMjQsIFwielwiOiAxMDI0IH0sXG4gICAgICAgICAgICAgICAgICAgIFwiX2RlcHRoXCI6IDhcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICBdLCBudWxsLCAyKTtcblxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY3JlYXRlLWFzc2V0JywgZnVsbFBhdGgsIHNjZW5lQ29udGVudCkudGhlbigocmVzdWx0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmdldFNjZW5lTGlzdCgpLnRoZW4oKHNjZW5lTGlzdCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkU2NlbmUgPSBzY2VuZUxpc3QuZGF0YT8uZmluZCgoc2NlbmU6IGFueSkgPT4gc2NlbmUudXVpZCA9PT0gcmVzdWx0LnV1aWQpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdXVpZDogcmVzdWx0LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IHJlc3VsdC51cmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBzY2VuZU5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBgU2NlbmUgJyR7c2NlbmVOYW1lfScgY3JlYXRlZCBzdWNjZXNzZnVsbHlgLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2NlbmVWZXJpZmllZDogISFjcmVhdGVkU2NlbmVcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWQ6IHJlc3VsdC51dWlkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiByZXN1bHQudXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogc2NlbmVOYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYFNjZW5lICcke3NjZW5lTmFtZX0nIGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5ICh2ZXJpZmljYXRpb24gZmFpbGVkKWBcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYXZlU2NlbmVBcyhwYXRoOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdzY2VuZScsICdzYXZlLWFzLXNjZW5lJykudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KHsgcGF0aCwgbWVzc2FnZTogJ1NjZW5lIHNhdmUtYXMgZGlhbG9nIG9wZW5lZCcgfSkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjbG9zZVNjZW5lKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2Nsb3NlLXNjZW5lJykudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsICdTY2VuZSBjbG9zZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYHF1ZXJ5LW5vZGUtdHJlZWAncyByZXNvbHZlZCBub2RlcyBuZXZlciBjYXJyeSBgX19jb21wc19fYCwgc28gYGJ1aWxkSGllcmFyY2h5YCdzXG4gICAgICogY29tcG9uZW50IGJyYW5jaCBiZWxvdyBjYW4gbmV2ZXIgcG9wdWxhdGUgcmVhbCBkYXRhIGZyb20gaXQuIGBzb3VyY2Uvc2NlbmUudHNgJ3Mgb3duXG4gICAgICogYGdldFNjZW5lSGllcmFyY2h5YCB3YWxrcyB0aGUgTElWRSBgY2MuTm9kZWAgdHJlZSBpbnN0ZWFkIGFuZCBhbHdheXMgaGFzIHJlYWxcbiAgICAgKiBjb21wb25lbnQgZGF0YSDigJQgZ28gc3RyYWlnaHQgdGhlcmUgd2hlbiBjb21wb25lbnRzIGFyZSBhY3R1YWxseSByZXF1ZXN0ZWQuXG4gICAgICovXG4gICAgcHJpdmF0ZSBxdWVyeUhpZXJhcmNoeVZpYVNjcmlwdChpbmNsdWRlQ29tcG9uZW50czogYm9vbGVhbik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBvcHRpb25zID0ge1xuICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgbWV0aG9kOiAnZ2V0U2NlbmVIaWVyYXJjaHknLFxuICAgICAgICAgICAgYXJnczogW2luY2x1ZGVDb21wb25lbnRzXVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCBvcHRpb25zKS50aGVuKChyZXN1bHQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQocmVzdWx0Py5lcnJvciB8fCAnVW5rbm93biBlcnJvcicpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFNjZW5lSGllcmFyY2h5KGluY2x1ZGVDb21wb25lbnRzOiBib29sZWFuID0gZmFsc2UpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgLy8gSXNzdWUgIzg1OiBgaW5jbHVkZUNvbXBvbmVudHM6IHRydWVgIHdhcyBsZWZ0IGFzIGFuIGVycm9yLW9ubHkgZmFsbGJhY2sgdGhhdFxuICAgICAgICAvLyBvbmx5IHJhbiB3aGVuIGBxdWVyeS1ub2RlLXRyZWVgIFJFSkVDVEVEIOKAlCBuZXZlciB3aGVuIGl0IHJlc29sdmVkIHN1Y2Nlc3NmdWxseVxuICAgICAgICAvLyB3aXRob3V0IGBfX2NvbXBzX19gLCB3aGljaCBpcyB0aGUgY29tbW9uIGNhc2UuIFJvdXRlIHN0cmFpZ2h0IHRvIHRoZVxuICAgICAgICAvLyBzY2VuZS1zY3JpcHQgcGF0aCB3aGVuZXZlciBjb21wb25lbnRzIGFyZSByZXF1ZXN0ZWQ7IHRoZSBgaW5jbHVkZUNvbXBvbmVudHM6XG4gICAgICAgIC8vIGZhbHNlYCBwYXRoIGJlbG93IGlzIFVOQ0hBTkdFRC5cbiAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnF1ZXJ5SGllcmFyY2h5VmlhU2NyaXB0KGluY2x1ZGVDb21wb25lbnRzKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBTY2VuZSBzY3JpcHQgZmFpbGVkOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKS50aGVuKCh0cmVlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHJlZSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBoaWVyYXJjaHkgPSB0aGlzLmJ1aWxkSGllcmFyY2h5KHRyZWUsIGluY2x1ZGVDb21wb25lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KGhpZXJhcmNoeSkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoJ05vIHNjZW5lIGhpZXJhcmNoeSBhdmFpbGFibGUnKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnF1ZXJ5SGllcmFyY2h5VmlhU2NyaXB0KGluY2x1ZGVDb21wb25lbnRzKS50aGVuKHJlc29sdmUpLmNhdGNoKChlcnIyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGBEaXJlY3QgQVBJIGZhaWxlZDogJHtlcnIubWVzc2FnZX0sIFNjZW5lIHNjcmlwdCBmYWlsZWQ6ICR7ZXJyMi5tZXNzYWdlfWApKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGJ1aWxkSGllcmFyY2h5KG5vZGU6IGFueSwgaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4pOiBhbnkge1xuICAgICAgICBjb25zdCBub2RlSW5mbzogYW55ID0ge1xuICAgICAgICAgICAgdXVpZDogbm9kZS51dWlkLFxuICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLFxuICAgICAgICAgICAgYWN0aXZlOiBub2RlLmFjdGl2ZSxcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChpbmNsdWRlQ29tcG9uZW50cyAmJiBub2RlLl9fY29tcHNfXykge1xuICAgICAgICAgICAgbm9kZUluZm8uY29tcG9uZW50cyA9IG5vZGUuX19jb21wc19fLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuX190eXBlX18gfHwgJ1Vua25vd24nLFxuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gY29tcC5lbmFibGVkIDogdHJ1ZVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIG5vZGVJbmZvLmNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbi5tYXAoKGNoaWxkOiBhbnkpID0+XG4gICAgICAgICAgICAgICAgdGhpcy5idWlsZEhpZXJhcmNoeShjaGlsZCwgaW5jbHVkZUNvbXBvbmVudHMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5vZGVJbmZvO1xuICAgIH1cbn1cbiJdfQ==