import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, SceneInfo, successResult, errorResult } from '../types';
import { coerceBool } from '../utils/normalize';
import { resolveAsset } from '../utils/asset-path';
import {
    readOverrideSnapshot, describeOverrideLoss, statMtimeMs, waitForFileRewrite
} from '../utils/save-artifact-guard';

/** Longest `saveScene` waits for the scene file to be rewritten before calling the save unconfirmed. */
const SAVE_WRITE_TIMEOUT_MS = 2000;

/**
 * What the artifact says about a reported-successful save. `unverified` is a first-class
 * outcome, not a soft failure — "we could not check" must never render as "it worked".
 */
type ArtifactVerdict = 'verified' | 'dropped' | 'unverified';

export class ManageScene extends BaseActionTool {
    readonly name = 'manage_scene';
    readonly description = 'Manage scenes in the project. Actions: get_current, list, open, save, create, save_as, close, get_hierarchy. Use get_current to check if a scene is open before node/component operations. Use get_hierarchy to understand scene structure before modifying nodes. Prerequisites: project must be open in Cocos Creator.';
    readonly actions = ['get_current', 'list', 'open', 'save', 'create', 'save_as', 'close', 'get_hierarchy'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_current: (args) => this.getCurrentScene(),
        list: (args) => this.getSceneList(),
        open: (args) => this.openScene(args.scenePath),
        save: (args) => this.saveScene(),
        create: (args) => this.createScene(args.sceneName, args.savePath),
        save_as: (args) => this.saveSceneAs(args.path),
        close: (args) => this.closeScene(),
        get_hierarchy: (args) => this.getSceneHierarchy(coerceBool(args.includeComponents) ?? false)
    };

    private async getCurrentScene(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                if (tree && tree.uuid) {
                    resolve(successResult({
                        name: tree.name || 'Current Scene',
                        uuid: tree.uuid,
                        type: tree.type || 'cc.Scene',
                        active: tree.active !== undefined ? tree.active : true,
                        nodeCount: tree.children ? tree.children.length : 0
                    }));
                } else {
                    resolve(errorResult('No scene data available'));
                }
            }).catch((err: Error) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getCurrentSceneInfo',
                    args: []
                };
                Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
                    if (result && result.success) {
                        resolve(successResult(result.data, result.message));
                    } else {
                        resolve(errorResult(result?.error || 'Unknown error'));
                    }
                }).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private async getSceneList(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-assets', {
                pattern: 'db://assets/**/*.scene'
            }).then((results: any[]) => {
                const scenes: SceneInfo[] = results.map(asset => ({
                    name: asset.name,
                    path: asset.url,
                    uuid: asset.uuid
                }));
                resolve(successResult(scenes));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async openScene(scenePath: string): Promise<ActionToolResult> {
        if (!scenePath) {
            return errorResult('scenePath is required for action=open');
        }
        return new Promise((resolve) => {
            Editor.Message.request('asset-db', 'query-uuid', scenePath).then((uuid: string | null) => {
                if (!uuid) {
                    throw new Error('Scene not found');
                }
                return Editor.Message.request('scene', 'open-scene', uuid);
            }).then(() => {
                resolve(successResult(null, `Scene opened: ${scenePath}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
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
    private async saveScene(): Promise<ActionToolResult> {
        const scenePath = await this.resolveCurrentSceneFilePath();
        const mtimeBefore = statMtimeMs(scenePath);
        const overridesBefore = readOverrideSnapshot(scenePath);

        try {
            const saved: boolean = await (Editor.Message.request as any)('scene', 'save-scene');
            if (saved === false) {
                return errorResult('scene:save-scene returned false — the editor rejected the save. Nothing was written.');
            }
        } catch (err: any) {
            return errorResult(err.message);
        }

        // 1. Dirty-flag backstop — the editor still holds uncommitted edits.
        let editorDirty: boolean | null = null;
        try {
            editorDirty = (await Editor.Message.request('scene', 'query-dirty')) === true;
        } catch {
            // Best-effort: unreadable dirty state must not turn a real save into a failure.
        }
        if (editorDirty === true) {
            return errorResult(
                'save-scene reported success, but the scene is still dirty immediately afterward — ' +
                'a pending edit was not captured in this save. This typically means a mutating call ' +
                '(manage_node/manage_component/etc.) was issued concurrently or batched with this save ' +
                'instead of awaited first; issue calls sequentially and retry save.'
            );
        }

        // 2. Artifact checks. `scenePath === null` means the on-disk file could not be
        // resolved (unsaved scene, unknown asset); that is reported as unverified, never
        // folded into either a pass or a failure.
        const artifact: { verified: boolean; verdict: ArtifactVerdict; reason: string | null; mtimeMs: number | null; lostOverrides: string | null } =
            scenePath === null
                ? { verified: false, verdict: 'unverified', reason: null, mtimeMs: null, lostOverrides: null }
                : await this.verifySavedArtifact(scenePath, mtimeBefore, overridesBefore);

        if (artifact.lostOverrides) {
            return {
                success: false,
                error: `Scene saved to ${scenePath}, but the save WAS LOSSY: ${artifact.lostOverrides}`,
                data: {
                    file: scenePath, dirty: false, editorDirty, persistenceVerified: true,
                    ...(artifact.mtimeMs !== null ? { mtimeMs: artifact.mtimeMs } : {})
                },
                isError: true
            };
        }

        if (artifact.verdict === 'dropped') {
            return errorResult(
                `save-scene reported success but the write did not reach disk: ${artifact.reason}. ` +
                'This is the #6 false-success shape — verify the file yourself, and if the edit is absent, ' +
                'press Ctrl+S in the Cocos Creator editor and report the occurrence on #6.'
            );
        }

        return successResult(
            {
                dirty: false, editorDirty, file: scenePath,
                persistenceVerified: artifact.verdict === 'verified',
                ...(artifact.mtimeMs !== null ? { mtimeMs: artifact.mtimeMs } : {})
            },
            artifact.verdict === 'verified'
                ? 'Scene saved successfully (file rewritten and override records preserved)'
                : 'Scene saved successfully (dirty state unverifiable)'
        );
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
    private async verifySavedArtifact(
        scenePath: string,
        mtimeBefore: number | null,
        overridesBefore: { total: number; propertyPaths: string[] } | null
    ): Promise<{ verified: boolean; verdict: ArtifactVerdict; reason: string | null; mtimeMs: number | null; lostOverrides: string | null }> {
        const mtimeAfter = mtimeBefore === null
            ? null
            : await waitForFileRewrite(scenePath, mtimeBefore, SAVE_WRITE_TIMEOUT_MS);

        let lostOverrides: string | null = null;
        if (overridesBefore && overridesBefore.total > 0) {
            lostOverrides = describeOverrideLoss(overridesBefore, readOverrideSnapshot(scenePath));
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
    private async resolveCurrentSceneFilePath(): Promise<string | null> {
        let sceneUuid: string | null = null;
        try {
            const tree: any = await Editor.Message.request('scene', 'query-node-tree');
            if (Array.isArray(tree)) sceneUuid = tree[0]?.uuid || null;
            else if (tree && typeof tree === 'object') sceneUuid = tree.uuid || null;
        } catch {
            sceneUuid = null;
        }
        if (!sceneUuid) return null;

        try {
            return (await resolveAsset(sceneUuid)).filePath;
        } catch {
            return null;
        }
    }

    private async createScene(sceneName: string, savePath: string): Promise<ActionToolResult> {
        if (!sceneName || !savePath) {
            return errorResult('sceneName and savePath are required for action=create');
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

            Editor.Message.request('asset-db', 'create-asset', fullPath, sceneContent).then((result: any) => {
                this.getSceneList().then((sceneList) => {
                    const createdScene = sceneList.data?.find((scene: any) => scene.uuid === result.uuid);
                    resolve(successResult({
                        uuid: result.uuid,
                        url: result.url,
                        name: sceneName,
                        message: `Scene '${sceneName}' created successfully`,
                        sceneVerified: !!createdScene
                    }));
                }).catch(() => {
                    resolve(successResult({
                        uuid: result.uuid,
                        url: result.url,
                        name: sceneName,
                        message: `Scene '${sceneName}' created successfully (verification failed)`
                    }));
                });
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async saveSceneAs(path: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            (Editor.Message.request as any)('scene', 'save-as-scene').then(() => {
                resolve(successResult({ path, message: 'Scene save-as dialog opened' }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async closeScene(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'close-scene').then(() => {
                resolve(successResult(null, 'Scene closed successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    /**
     * `query-node-tree`'s resolved nodes never carry `__comps__`, so `buildHierarchy`'s
     * component branch below can never populate real data from it. `source/scene.ts`'s own
     * `getSceneHierarchy` walks the LIVE `cc.Node` tree instead and always has real
     * component data — go straight there when components are actually requested.
     */
    private queryHierarchyViaScript(includeComponents: boolean): Promise<ActionToolResult> {
        const options = {
            name: 'cocos-mcp-server',
            method: 'getSceneHierarchy',
            args: [includeComponents]
        };
        return Editor.Message.request('scene', 'execute-scene-script', options).then((result: any) => {
            if (result && result.success) {
                return successResult(result.data, result.message);
            }
            return errorResult(result?.error || 'Unknown error');
        });
    }

    private async getSceneHierarchy(includeComponents: boolean = false): Promise<ActionToolResult> {
        // Issue #85: `includeComponents: true` was left as an error-only fallback that
        // only ran when `query-node-tree` REJECTED — never when it resolved successfully
        // without `__comps__`, which is the common case. Route straight to the
        // scene-script path whenever components are requested; the `includeComponents:
        // false` path below is UNCHANGED.
        if (includeComponents) {
            try {
                return await this.queryHierarchyViaScript(includeComponents);
            } catch (err: any) {
                return errorResult(`Scene script failed: ${err.message}`);
            }
        }

        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                if (tree) {
                    const hierarchy = this.buildHierarchy(tree, includeComponents);
                    resolve(successResult(hierarchy));
                } else {
                    resolve(errorResult('No scene hierarchy available'));
                }
            }).catch((err: Error) => {
                this.queryHierarchyViaScript(includeComponents).then(resolve).catch((err2: Error) => {
                    resolve(errorResult(`Direct API failed: ${err.message}, Scene script failed: ${err2.message}`));
                });
            });
        });
    }

    private buildHierarchy(node: any, includeComponents: boolean): any {
        const nodeInfo: any = {
            uuid: node.uuid,
            name: node.name,
            type: node.type,
            active: node.active,
            children: []
        };

        if (includeComponents && node.__comps__) {
            nodeInfo.components = node.__comps__.map((comp: any) => ({
                type: comp.__type__ || 'Unknown',
                enabled: comp.enabled !== undefined ? comp.enabled : true
            }));
        }

        if (node.children) {
            nodeInfo.children = node.children.map((child: any) =>
                this.buildHierarchy(child, includeComponents)
            );
        }

        return nodeInfo;
    }
}
