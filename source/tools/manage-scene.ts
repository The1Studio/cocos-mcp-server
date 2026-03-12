import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, SceneInfo, successResult, errorResult } from '../types';
import { coerceBool } from '../utils/normalize';

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

    private async saveScene(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'save-scene').then(() => {
                resolve(successResult(null, 'Scene saved successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
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

    private async getSceneHierarchy(includeComponents: boolean = false): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'query-node-tree').then((tree: any) => {
                if (tree) {
                    const hierarchy = this.buildHierarchy(tree, includeComponents);
                    resolve(successResult(hierarchy));
                } else {
                    resolve(errorResult('No scene hierarchy available'));
                }
            }).catch((err: Error) => {
                const options = {
                    name: 'cocos-mcp-server',
                    method: 'getSceneHierarchy',
                    args: [includeComponents]
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
