import { ResourceProvider, MCPResource, MCPResourceContent } from './resource-provider';

export class CocosResources implements ResourceProvider {
    readonly resources: MCPResource[] = [
        {
            uri: 'cocos://editor/state',
            name: 'Editor State',
            description: 'Current editor state: open scene, version, project info, scene readiness',
            mimeType: 'application/json'
        },
        {
            uri: 'cocos://scene/hierarchy',
            name: 'Scene Hierarchy',
            description: 'Complete node tree of the current scene with UUIDs, names, active state, and component types',
            mimeType: 'application/json'
        },
        {
            uri: 'cocos://project/info',
            name: 'Project Info',
            description: 'Project name, path, Cocos version, available scenes, and project settings',
            mimeType: 'application/json'
        },
        {
            uri: 'cocos://scene/components',
            name: 'Component Types',
            description: 'All registered component types available in the current project',
            mimeType: 'application/json'
        }
    ];

    async read(uri: string): Promise<MCPResourceContent> {
        switch (uri) {
            case 'cocos://editor/state':    return this.readEditorState();
            case 'cocos://scene/hierarchy': return this.readSceneHierarchy();
            case 'cocos://project/info':    return this.readProjectInfo();
            case 'cocos://scene/components': return this.readComponentTypes();
            default: throw new Error(`Unknown resource URI: ${uri}`);
        }
    }

    // -------------------------------------------------------------------------
    // cocos://editor/state
    // -------------------------------------------------------------------------

    private async readEditorState(): Promise<MCPResourceContent> {
        const data: Record<string, any> = {};

        // Editor version info
        try {
            data.versions = (Editor as any).versions ?? {};
        } catch (e) {
            data.versions = { error: String(e) };
        }

        // Project info
        try {
            data.project = {
                name: Editor.Project.name,
                path: Editor.Project.path,
                uuid: Editor.Project.uuid
            };
        } catch (e) {
            data.project = { error: String(e) };
        }

        // Scene node tree (presence check — light)
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree') as any;
            data.scene = {
                open: !!(tree && tree.uuid),
                name: tree?.name ?? null,
                uuid: tree?.uuid ?? null,
                type: tree?.type ?? null
            };
        } catch (e) {
            data.scene = { open: false, error: String(e) };
        }

        // Scene ready / dirty flags
        try {
            const ready = await Editor.Message.request('scene', 'query-scene-ready') as boolean;
            data.sceneReady = ready;
        } catch {
            data.sceneReady = null;
        }

        try {
            const dirty = await Editor.Message.request('scene', 'query-scene-dirty') as boolean;
            data.sceneDirty = dirty;
        } catch {
            data.sceneDirty = null;
        }

        return this.toContent('cocos://editor/state', data);
    }

    // -------------------------------------------------------------------------
    // cocos://scene/hierarchy
    // -------------------------------------------------------------------------

    private async readSceneHierarchy(): Promise<MCPResourceContent> {
        let data: Record<string, any>;

        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree') as any;

            if (!tree || !tree.uuid) {
                data = { open: false, hierarchy: null, message: 'No scene is currently open' };
            } else {
                data = {
                    open: true,
                    hierarchy: this.buildNodeTree(tree)
                };
            }
        } catch (e) {
            data = { open: false, error: String(e), hierarchy: null };
        }

        return this.toContent('cocos://scene/hierarchy', data);
    }

    private buildNodeTree(node: any): any {
        const result: any = {
            uuid: node.uuid ?? null,
            name: node.name ?? null,
            active: node.active ?? true,
            type: node.type ?? null,
            components: [] as any[]
        };

        if (Array.isArray(node.__comps__)) {
            result.components = node.__comps__.map((c: any) => ({
                type: c.__type__ ?? 'Unknown',
                enabled: c.enabled !== undefined ? c.enabled : true
            }));
        }

        result.children = Array.isArray(node.children)
            ? node.children.map((child: any) => this.buildNodeTree(child))
            : [];

        return result;
    }

    // -------------------------------------------------------------------------
    // cocos://project/info
    // -------------------------------------------------------------------------

    private async readProjectInfo(): Promise<MCPResourceContent> {
        const data: Record<string, any> = {};

        // Basic project fields
        try {
            data.name    = Editor.Project.name;
            data.path    = Editor.Project.path;
            data.uuid    = Editor.Project.uuid;
            data.version = (Editor.Project as any).version ?? '1.0.0';
            data.cocosVersion = (Editor as any).versions?.cocos ?? 'Unknown';
        } catch (e) {
            data.projectError = String(e);
        }

        // Scene list
        try {
            const scenes = await Editor.Message.request('asset-db', 'query-assets', {
                pattern: 'db://assets/**/*.scene'
            }) as any[];

            data.scenes = scenes.map((s: any) => ({
                name: s.name,
                path: s.url,
                uuid: s.uuid
            }));
        } catch (e) {
            data.scenes = [];
            data.scenesError = String(e);
        }

        // Project settings (best-effort)
        try {
            const settings = await Editor.Message.request('project', 'query-config', 'project') as any;
            data.settings = settings ?? null;
        } catch {
            data.settings = null;
        }

        return this.toContent('cocos://project/info', data);
    }

    // -------------------------------------------------------------------------
    // cocos://scene/components
    // -------------------------------------------------------------------------

    private async readComponentTypes(): Promise<MCPResourceContent> {
        let data: Record<string, any>;

        try {
            const components = await Editor.Message.request('scene', 'query-components') as any[];
            data = {
                components: Array.isArray(components) ? components : [],
                count: Array.isArray(components) ? components.length : 0
            };
        } catch (e) {
            data = { components: [], count: 0, error: String(e) };
        }

        return this.toContent('cocos://scene/components', data);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private toContent(uri: string, data: unknown): MCPResourceContent {
        return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2)
        };
    }
}
