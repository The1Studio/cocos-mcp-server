"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CocosResources = void 0;
class CocosResources {
    constructor() {
        this.resources = [
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
    }
    async read(uri) {
        switch (uri) {
            case 'cocos://editor/state': return this.readEditorState();
            case 'cocos://scene/hierarchy': return this.readSceneHierarchy();
            case 'cocos://project/info': return this.readProjectInfo();
            case 'cocos://scene/components': return this.readComponentTypes();
            default: throw new Error(`Unknown resource URI: ${uri}`);
        }
    }
    // -------------------------------------------------------------------------
    // cocos://editor/state
    // -------------------------------------------------------------------------
    async readEditorState() {
        var _a, _b, _c, _d;
        const data = {};
        // Editor version info
        try {
            data.versions = (_a = Editor.versions) !== null && _a !== void 0 ? _a : {};
        }
        catch (e) {
            data.versions = { error: String(e) };
        }
        // Project info
        try {
            data.project = {
                name: Editor.Project.name,
                path: Editor.Project.path,
                uuid: Editor.Project.uuid
            };
        }
        catch (e) {
            data.project = { error: String(e) };
        }
        // Scene node tree (presence check — light)
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            data.scene = {
                open: !!(tree && tree.uuid),
                name: (_b = tree === null || tree === void 0 ? void 0 : tree.name) !== null && _b !== void 0 ? _b : null,
                uuid: (_c = tree === null || tree === void 0 ? void 0 : tree.uuid) !== null && _c !== void 0 ? _c : null,
                type: (_d = tree === null || tree === void 0 ? void 0 : tree.type) !== null && _d !== void 0 ? _d : null
            };
        }
        catch (e) {
            data.scene = { open: false, error: String(e) };
        }
        // Scene ready / dirty flags
        try {
            const ready = await Editor.Message.request('scene', 'query-scene-ready');
            data.sceneReady = ready;
        }
        catch (_e) {
            data.sceneReady = null;
        }
        try {
            const dirty = await Editor.Message.request('scene', 'query-scene-dirty');
            data.sceneDirty = dirty;
        }
        catch (_f) {
            data.sceneDirty = null;
        }
        return this.toContent('cocos://editor/state', data);
    }
    // -------------------------------------------------------------------------
    // cocos://scene/hierarchy
    // -------------------------------------------------------------------------
    async readSceneHierarchy() {
        let data;
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (!tree || !tree.uuid) {
                data = { open: false, hierarchy: null, message: 'No scene is currently open' };
            }
            else {
                data = {
                    open: true,
                    hierarchy: this.buildNodeTree(tree)
                };
            }
        }
        catch (e) {
            data = { open: false, error: String(e), hierarchy: null };
        }
        return this.toContent('cocos://scene/hierarchy', data);
    }
    buildNodeTree(node) {
        var _a, _b, _c, _d;
        const result = {
            uuid: (_a = node.uuid) !== null && _a !== void 0 ? _a : null,
            name: (_b = node.name) !== null && _b !== void 0 ? _b : null,
            active: (_c = node.active) !== null && _c !== void 0 ? _c : true,
            type: (_d = node.type) !== null && _d !== void 0 ? _d : null,
            components: []
        };
        if (Array.isArray(node.__comps__)) {
            result.components = node.__comps__.map((c) => {
                var _a;
                return ({
                    type: (_a = c.__type__) !== null && _a !== void 0 ? _a : 'Unknown',
                    enabled: c.enabled !== undefined ? c.enabled : true
                });
            });
        }
        result.children = Array.isArray(node.children)
            ? node.children.map((child) => this.buildNodeTree(child))
            : [];
        return result;
    }
    // -------------------------------------------------------------------------
    // cocos://project/info
    // -------------------------------------------------------------------------
    async readProjectInfo() {
        var _a, _b, _c;
        const data = {};
        // Basic project fields
        try {
            data.name = Editor.Project.name;
            data.path = Editor.Project.path;
            data.uuid = Editor.Project.uuid;
            data.version = (_a = Editor.Project.version) !== null && _a !== void 0 ? _a : '1.0.0';
            data.cocosVersion = (_c = (_b = Editor.versions) === null || _b === void 0 ? void 0 : _b.cocos) !== null && _c !== void 0 ? _c : 'Unknown';
        }
        catch (e) {
            data.projectError = String(e);
        }
        // Scene list
        try {
            const scenes = await Editor.Message.request('asset-db', 'query-assets', {
                pattern: 'db://assets/**/*.scene'
            });
            data.scenes = scenes.map((s) => ({
                name: s.name,
                path: s.url,
                uuid: s.uuid
            }));
        }
        catch (e) {
            data.scenes = [];
            data.scenesError = String(e);
        }
        // Project settings (best-effort)
        try {
            const settings = await Editor.Message.request('project', 'query-config', 'project');
            data.settings = settings !== null && settings !== void 0 ? settings : null;
        }
        catch (_d) {
            data.settings = null;
        }
        return this.toContent('cocos://project/info', data);
    }
    // -------------------------------------------------------------------------
    // cocos://scene/components
    // -------------------------------------------------------------------------
    async readComponentTypes() {
        let data;
        try {
            const components = await Editor.Message.request('scene', 'query-components');
            data = {
                components: Array.isArray(components) ? components : [],
                count: Array.isArray(components) ? components.length : 0
            };
        }
        catch (e) {
            data = { components: [], count: 0, error: String(e) };
        }
        return this.toContent('cocos://scene/components', data);
    }
    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    toContent(uri, data) {
        return {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(data, null, 2)
        };
    }
}
exports.CocosResources = CocosResources;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29jb3MtcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Jlc291cmNlcy9jb2Nvcy1yZXNvdXJjZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUEsTUFBYSxjQUFjO0lBQTNCO1FBQ2EsY0FBUyxHQUFrQjtZQUNoQztnQkFDSSxHQUFHLEVBQUUsc0JBQXNCO2dCQUMzQixJQUFJLEVBQUUsY0FBYztnQkFDcEIsV0FBVyxFQUFFLDBFQUEwRTtnQkFDdkYsUUFBUSxFQUFFLGtCQUFrQjthQUMvQjtZQUNEO2dCQUNJLEdBQUcsRUFBRSx5QkFBeUI7Z0JBQzlCLElBQUksRUFBRSxpQkFBaUI7Z0JBQ3ZCLFdBQVcsRUFBRSw4RkFBOEY7Z0JBQzNHLFFBQVEsRUFBRSxrQkFBa0I7YUFDL0I7WUFDRDtnQkFDSSxHQUFHLEVBQUUsc0JBQXNCO2dCQUMzQixJQUFJLEVBQUUsY0FBYztnQkFDcEIsV0FBVyxFQUFFLDJFQUEyRTtnQkFDeEYsUUFBUSxFQUFFLGtCQUFrQjthQUMvQjtZQUNEO2dCQUNJLEdBQUcsRUFBRSwwQkFBMEI7Z0JBQy9CLElBQUksRUFBRSxpQkFBaUI7Z0JBQ3ZCLFdBQVcsRUFBRSxpRUFBaUU7Z0JBQzlFLFFBQVEsRUFBRSxrQkFBa0I7YUFDL0I7U0FDSixDQUFDO0lBZ01OLENBQUM7SUE5TEcsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFXO1FBQ2xCLFFBQVEsR0FBRyxFQUFFLENBQUM7WUFDVixLQUFLLHNCQUFzQixDQUFDLENBQUksT0FBTyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUQsS0FBSyx5QkFBeUIsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDakUsS0FBSyxzQkFBc0IsQ0FBQyxDQUFJLE9BQU8sSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQzlELEtBQUssMEJBQTBCLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxrQkFBa0Is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eyBSZXNvdXJjZVByb3ZpZGVyLCBNQ1BSZXNvdXJjZSwgTUNQUmVzb3VyY2VDb250ZW50IH0gZnJvbSAnLi9yZXNvdXJjZS1wcm92aWRlcic7XHJcblxyXG5leHBvcnQgY2xhc3MgQ29jb3NSZXNvdXJjZXMgaW1wbGVtZW50cyBSZXNvdXJjZVByb3ZpZGVyIHtcclxuICAgIHJlYWRvbmx5IHJlc291cmNlczogTUNQUmVzb3VyY2VbXSA9IFtcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHVyaTogJ2NvY29zOi8vZWRpdG9yL3N0YXRlJyxcclxuICAgICAgICAgICAgbmFtZTogJ0VkaXRvciBTdGF0ZScsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQ3VycmVudCBlZGl0b3Igc3RhdGU6IG9wZW4gc2NlbmUsIHZlcnNpb24sIHByb2plY3QgaW5mbywgc2NlbmUgcmVhZGluZXNzJyxcclxuICAgICAgICAgICAgbWltZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB1cmk6ICdjb2NvczovL3NjZW5lL2hpZXJhcmNoeScsXHJcbiAgICAgICAgICAgIG5hbWU6ICdTY2VuZSBIaWVyYXJjaHknLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0NvbXBsZXRlIG5vZGUgdHJlZSBvZiB0aGUgY3VycmVudCBzY2VuZSB3aXRoIFVVSURzLCBuYW1lcywgYWN0aXZlIHN0YXRlLCBhbmQgY29tcG9uZW50IHR5cGVzJyxcclxuICAgICAgICAgICAgbWltZVR5cGU6ICdhcHBsaWNhdGlvbi9qc29uJ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB1cmk6ICdjb2NvczovL3Byb2plY3QvaW5mbycsXHJcbiAgICAgICAgICAgIG5hbWU6ICdQcm9qZWN0IEluZm8nLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Byb2plY3QgbmFtZSwgcGF0aCwgQ29jb3MgdmVyc2lvbiwgYXZhaWxhYmxlIHNjZW5lcywgYW5kIHByb2plY3Qgc2V0dGluZ3MnLFxyXG4gICAgICAgICAgICBtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHVyaTogJ2NvY29zOi8vc2NlbmUvY29tcG9uZW50cycsXHJcbiAgICAgICAgICAgIG5hbWU6ICdDb21wb25lbnQgVHlwZXMnLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FsbCByZWdpc3RlcmVkIGNvbXBvbmVudCB0eXBlcyBhdmFpbGFibGUgaW4gdGhlIGN1cnJlbnQgcHJvamVjdCcsXHJcbiAgICAgICAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgICB9XHJcbiAgICBdO1xyXG5cclxuICAgIGFzeW5jIHJlYWQodXJpOiBzdHJpbmcpOiBQcm9taXNlPE1DUFJlc291cmNlQ29udGVudD4ge1xyXG4gICAgICAgIHN3aXRjaCAodXJpKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NvY29zOi8vZWRpdG9yL3N0YXRlJzogICAgcmV0dXJuIHRoaXMucmVhZEVkaXRvclN0YXRlKCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NvY29zOi8vc2NlbmUvaGllcmFyY2h5JzogcmV0dXJuIHRoaXMucmVhZFNjZW5lSGllcmFyY2h5KCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NvY29zOi8vcHJvamVjdC9pbmZvJzogICAgcmV0dXJuIHRoaXMucmVhZFByb2plY3RJbmZvKCk7XHJcbiAgICAgICAgICAgIGNhc2UgJ2NvY29zOi8vc2NlbmUvY29tcG9uZW50cyc6IHJldHVybiB0aGlzLnJlYWRDb21wb25lbnRUeXBlcygpO1xyXG4gICAgICAgICAgICBkZWZhdWx0OiB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gcmVzb3VyY2UgVVJJOiAke3VyaX1gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gY29jb3M6Ly9lZGl0b3Ivc3RhdGVcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlYWRFZGl0b3JTdGF0ZSgpOiBQcm9taXNlPE1DUFJlc291cmNlQ29udGVudD4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGE6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcclxuXHJcbiAgICAgICAgLy8gRWRpdG9yIHZlcnNpb24gaW5mb1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGRhdGEudmVyc2lvbnMgPSAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnMgPz8ge307XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICBkYXRhLnZlcnNpb25zID0geyBlcnJvcjogU3RyaW5nKGUpIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQcm9qZWN0IGluZm9cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBkYXRhLnByb2plY3QgPSB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiBFZGl0b3IuUHJvamVjdC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgcGF0aDogRWRpdG9yLlByb2plY3QucGF0aCxcclxuICAgICAgICAgICAgICAgIHV1aWQ6IEVkaXRvci5Qcm9qZWN0LnV1aWRcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGRhdGEucHJvamVjdCA9IHsgZXJyb3I6IFN0cmluZyhlKSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gU2NlbmUgbm9kZSB0cmVlIChwcmVzZW5jZSBjaGVjayDigJQgbGlnaHQpXHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdHJlZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpIGFzIGFueTtcclxuICAgICAgICAgICAgZGF0YS5zY2VuZSA9IHtcclxuICAgICAgICAgICAgICAgIG9wZW46ICEhKHRyZWUgJiYgdHJlZS51dWlkKSxcclxuICAgICAgICAgICAgICAgIG5hbWU6IHRyZWU/Lm5hbWUgPz8gbnVsbCxcclxuICAgICAgICAgICAgICAgIHV1aWQ6IHRyZWU/LnV1aWQgPz8gbnVsbCxcclxuICAgICAgICAgICAgICAgIHR5cGU6IHRyZWU/LnR5cGUgPz8gbnVsbFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgZGF0YS5zY2VuZSA9IHsgb3BlbjogZmFsc2UsIGVycm9yOiBTdHJpbmcoZSkgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFNjZW5lIHJlYWR5IC8gZGlydHkgZmxhZ3NcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZWFkeSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LXNjZW5lLXJlYWR5JykgYXMgYm9vbGVhbjtcclxuICAgICAgICAgICAgZGF0YS5zY2VuZVJlYWR5ID0gcmVhZHk7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIGRhdGEuc2NlbmVSZWFkeSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBkaXJ0eSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LXNjZW5lLWRpcnR5JykgYXMgYm9vbGVhbjtcclxuICAgICAgICAgICAgZGF0YS5zY2VuZURpcnR5ID0gZGlydHk7XHJcbiAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIGRhdGEuc2NlbmVEaXJ0eSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdGhpcy50b0NvbnRlbnQoJ2NvY29zOi8vZWRpdG9yL3N0YXRlJywgZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gY29jb3M6Ly9zY2VuZS9oaWVyYXJjaHlcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlYWRTY2VuZUhpZXJhcmNoeSgpOiBQcm9taXNlPE1DUFJlc291cmNlQ29udGVudD4ge1xyXG4gICAgICAgIGxldCBkYXRhOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCB0cmVlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJykgYXMgYW55O1xyXG5cclxuICAgICAgICAgICAgaWYgKCF0cmVlIHx8ICF0cmVlLnV1aWQpIHtcclxuICAgICAgICAgICAgICAgIGRhdGEgPSB7IG9wZW46IGZhbHNlLCBoaWVyYXJjaHk6IG51bGwsIG1lc3NhZ2U6ICdObyBzY2VuZSBpcyBjdXJyZW50bHkgb3BlbicgfTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGRhdGEgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3BlbjogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgICBoaWVyYXJjaHk6IHRoaXMuYnVpbGROb2RlVHJlZSh0cmVlKVxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgZGF0YSA9IHsgb3BlbjogZmFsc2UsIGVycm9yOiBTdHJpbmcoZSksIGhpZXJhcmNoeTogbnVsbCB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXMudG9Db250ZW50KCdjb2NvczovL3NjZW5lL2hpZXJhcmNoeScsIGRhdGEpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYnVpbGROb2RlVHJlZShub2RlOiBhbnkpOiBhbnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdDogYW55ID0ge1xyXG4gICAgICAgICAgICB1dWlkOiBub2RlLnV1aWQgPz8gbnVsbCxcclxuICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lID8/IG51bGwsXHJcbiAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUgPz8gdHJ1ZSxcclxuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlID8/IG51bGwsXHJcbiAgICAgICAgICAgIGNvbXBvbmVudHM6IFtdIGFzIGFueVtdXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobm9kZS5fX2NvbXBzX18pKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdC5jb21wb25lbnRzID0gbm9kZS5fX2NvbXBzX18ubWFwKChjOiBhbnkpID0+ICh7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiBjLl9fdHlwZV9fID8/ICdVbmtub3duJyxcclxuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGMuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gYy5lbmFibGVkIDogdHJ1ZVxyXG4gICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXN1bHQuY2hpbGRyZW4gPSBBcnJheS5pc0FycmF5KG5vZGUuY2hpbGRyZW4pXHJcbiAgICAgICAgICAgID8gbm9kZS5jaGlsZHJlbi5tYXAoKGNoaWxkOiBhbnkpID0+IHRoaXMuYnVpbGROb2RlVHJlZShjaGlsZCkpXHJcbiAgICAgICAgICAgIDogW107XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gY29jb3M6Ly9wcm9qZWN0L2luZm9cclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlYWRQcm9qZWN0SW5mbygpOiBQcm9taXNlPE1DUFJlc291cmNlQ29udGVudD4ge1xyXG4gICAgICAgIGNvbnN0IGRhdGE6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcclxuXHJcbiAgICAgICAgLy8gQmFzaWMgcHJvamVjdCBmaWVsZHNcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBkYXRhLm5hbWUgICAgPSBFZGl0b3IuUHJvamVjdC5uYW1lO1xyXG4gICAgICAgICAgICBkYXRhLnBhdGggICAgPSBFZGl0b3IuUHJvamVjdC5wYXRoO1xyXG4gICAgICAgICAgICBkYXRhLnV1aWQgICAgPSBFZGl0b3IuUHJvamVjdC51dWlkO1xyXG4gICAgICAgICAgICBkYXRhLnZlcnNpb24gPSAoRWRpdG9yLlByb2plY3QgYXMgYW55KS52ZXJzaW9uID8/ICcxLjAuMCc7XHJcbiAgICAgICAgICAgIGRhdGEuY29jb3NWZXJzaW9uID0gKEVkaXRvciBhcyBhbnkpLnZlcnNpb25zPy5jb2NvcyA/PyAnVW5rbm93bic7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICBkYXRhLnByb2plY3RFcnJvciA9IFN0cmluZyhlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFNjZW5lIGxpc3RcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzY2VuZXMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7XHJcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiAnZGI6Ly9hc3NldHMvKiovKi5zY2VuZSdcclxuICAgICAgICAgICAgfSkgYXMgYW55W107XHJcblxyXG4gICAgICAgICAgICBkYXRhLnNjZW5lcyA9IHNjZW5lcy5tYXAoKHM6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IHMubmFtZSxcclxuICAgICAgICAgICAgICAgIHBhdGg6IHMudXJsLFxyXG4gICAgICAgICAgICAgICAgdXVpZDogcy51dWlkXHJcbiAgICAgICAgICAgIH0pKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGRhdGEuc2NlbmVzID0gW107XHJcbiAgICAgICAgICAgIGRhdGEuc2NlbmVzRXJyb3IgPSBTdHJpbmcoZSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBQcm9qZWN0IHNldHRpbmdzIChiZXN0LWVmZm9ydClcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKSBhcyBhbnk7XHJcbiAgICAgICAgICAgIGRhdGEuc2V0dGluZ3MgPSBzZXR0aW5ncyA/PyBudWxsO1xyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICBkYXRhLnNldHRpbmdzID0gbnVsbDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLnRvQ29udGVudCgnY29jb3M6Ly9wcm9qZWN0L2luZm8nLCBkYXRhKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAvLyBjb2NvczovL3NjZW5lL2NvbXBvbmVudHNcclxuICAgIC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJlYWRDb21wb25lbnRUeXBlcygpOiBQcm9taXNlPE1DUFJlc291cmNlQ29udGVudD4ge1xyXG4gICAgICAgIGxldCBkYXRhOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktY29tcG9uZW50cycpIGFzIGFueVtdO1xyXG4gICAgICAgICAgICBkYXRhID0ge1xyXG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogQXJyYXkuaXNBcnJheShjb21wb25lbnRzKSA/IGNvbXBvbmVudHMgOiBbXSxcclxuICAgICAgICAgICAgICAgIGNvdW50OiBBcnJheS5pc0FycmF5KGNvbXBvbmVudHMpID8gY29tcG9uZW50cy5sZW5ndGggOiAwXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICBkYXRhID0geyBjb21wb25lbnRzOiBbXSwgY291bnQ6IDAsIGVycm9yOiBTdHJpbmcoZSkgfTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLnRvQ29udGVudCgnY29jb3M6Ly9zY2VuZS9jb21wb25lbnRzJywgZGF0YSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgLy8gSGVscGVyc1xyXG4gICAgLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgIHByaXZhdGUgdG9Db250ZW50KHVyaTogc3RyaW5nLCBkYXRhOiB1bmtub3duKTogTUNQUmVzb3VyY2VDb250ZW50IHtcclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICB1cmksXHJcbiAgICAgICAgICAgIG1pbWVUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgICAgIHRleHQ6IEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpXHJcbiAgICAgICAgfTtcclxuICAgIH1cclxufVxyXG4iXX0=