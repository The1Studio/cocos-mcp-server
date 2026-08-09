"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageEditor = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const KNOWN_PANELS = [
    'console', 'hierarchy', 'inspector', 'assets', 'scene',
    'node-library', 'build', 'preferences', 'project-settings',
    'animation', 'timeline', 'profiler', 'cocos-mcp-server.default',
    'cocos-mcp-server.tool-manager'
];
class ManageEditor extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_editor';
        this.description = 'Control Cocos Creator editor state. Actions: play, pause, step, stop, get_state, reload_scene, open_panel, get_panels. Uses Editor.Message directly without scene scripts.';
        this.actions = ['play', 'pause', 'step', 'stop', 'get_state', 'reload_scene', 'open_panel', 'get_panels'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['play', 'pause', 'step', 'stop', 'get_state', 'reload_scene', 'open_panel', 'get_panels'],
                    description: 'Action: play=start preview, pause=pause preview, step=advance one frame, stop=stop preview, get_state=query preview state, reload_scene=soft-reload current scene, open_panel=open editor panel by name, get_panels=list available panel names'
                },
                panelName: {
                    type: 'string',
                    description: '[open_panel] Panel name to open (e.g., "console", "hierarchy", "inspector", "assets")'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            play: (_args) => this.previewControl('open'),
            pause: (_args) => this.previewControl('pause'),
            step: (_args) => this.previewControl('step'),
            stop: (_args) => this.previewControl('close'),
            get_state: (_args) => this.getState(),
            reload_scene: (_args) => this.reloadScene(),
            open_panel: (args) => this.openPanel(args),
            get_panels: async (_args) => (0, types_1.successResult)({ panels: KNOWN_PANELS, count: KNOWN_PANELS.length }),
        };
    }
    async previewControl(command) {
        var _a, _b;
        try {
            await Editor.Message.request('preview', command);
            const labels = { open: 'started', pause: 'paused', step: 'stepped one frame', close: 'stopped' };
            return (0, types_1.successResult)({ command }, `Preview ${labels[command] || command}`);
        }
        catch (err) {
            // Some preview commands may not return a value — treat as success if no error thrown
            if (((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('timeout')) || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('no handler'))) {
                return (0, types_1.successResult)({ command }, `Preview ${command} sent (no confirmation)`);
            }
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getState() {
        try {
            const state = await Editor.Message.request('preview', 'query-info');
            return (0, types_1.successResult)(state !== null && state !== void 0 ? state : { note: 'Preview state not available' });
        }
        catch (err) {
            return (0, types_1.successResult)({ note: 'Could not query preview state', error: err.message });
        }
    }
    async reloadScene() {
        try {
            await Editor.Message.request('scene', 'soft-reload');
            return (0, types_1.successResult)(null, 'Scene reloaded');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async openPanel(args) {
        if (!args.panelName)
            return (0, types_1.errorResult)('panelName is required for open_panel');
        try {
            await Editor.Panel.open(args.panelName);
            return (0, types_1.successResult)({ panelName: args.panelName }, `Panel '${args.panelName}' opened`);
        }
        catch (err) {
            return (0, types_1.errorResult)(`Failed to open panel '${args.panelName}': ${err.message}`);
        }
    }
}
exports.ManageEditor = ManageEditor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtZWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBTSxZQUFZLEdBQUc7SUFDakIsU0FBUyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLE9BQU87SUFDdEQsY0FBYyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsa0JBQWtCO0lBQzFELFdBQVcsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLDBCQUEwQjtJQUMvRCwrQkFBK0I7Q0FDbEMsQ0FBQztBQUVGLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNhLFNBQUksR0FBRyxlQUFlLENBQUM7UUFDdkIsZ0JBQVcsR0FBRyw0S0FBNEssQ0FBQztRQUMzTCxZQUFPLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDckcsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQztvQkFDaEcsV0FBVyxFQUFFLGdQQUFnUDtpQkFDaFE7Z0JBQ0QsU0FBUyxFQUFFO29CQUNQLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx1RkFBdUY7aUJBQ3ZHO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLElBQUksRUFBRSxD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TyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQVM7UUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4QyxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsVUFBVSxJQUFJLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQztRQUM1RixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyx5QkFBeUIsSUFBSSxDQUFDLFNBQVMsTUFBTSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNuRixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBeEVELG9DQXdFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5jb25zdCBLTk9XTl9QQU5FTFMgPSBbXG4gICAgJ2NvbnNvbGUnLCAnaGllcmFyY2h5JywgJ2luc3BlY3RvcicsICdhc3NldHMnLCAnc2NlbmUnLFxuICAgICdub2RlLWxpYnJhcnknLCAnYnVpbGQnLCAncHJlZmVyZW5jZXMnLCAncHJvamVjdC1zZXR0aW5ncycsXG4gICAgJ2FuaW1hdGlvbicsICd0aW1lbGluZScsICdwcm9maWxlcicsICdjb2Nvcy1tY3Atc2VydmVyLmRlZmF1bHQnLFxuICAgICdjb2Nvcy1tY3Atc2VydmVyLnRvb2wtbWFuYWdlcidcbl07XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VFZGl0b3IgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfZWRpdG9yJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdDb250cm9sIENvY29zIENyZWF0b3IgZWRpdG9yIHN0YXRlLiBBY3Rpb25zOiBwbGF5LCBwYXVzZSwgc3RlcCwgc3RvcCwgZ2V0X3N0YXRlLCByZWxvYWRfc2NlbmUsIG9wZW5fcGFuZWwsIGdldF9wYW5lbHMuIFVzZXMgRWRpdG9yLk1lc3NhZ2UgZGlyZWN0bHkgd2l0aG91dCBzY2VuZSBzY3JpcHRzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsncGxheScsICdwYXVzZScsICdzdGVwJywgJ3N0b3AnLCAnZ2V0X3N0YXRlJywgJ3JlbG9hZF9zY2VuZScsICdvcGVuX3BhbmVsJywgJ2dldF9wYW5lbHMnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsncGxheScsICdwYXVzZScsICdzdGVwJywgJ3N0b3AnLCAnZ2V0X3N0YXRlJywgJ3JlbG9hZF9zY2VuZScsICdvcGVuX3BhbmVsJywgJ2dldF9wYW5lbHMnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogcGxheT1zdGFydCBwcmV2aWV3LCBwYXVzZT1wYXVzZSBwcmV2aWV3LCBzdGVwPWFkdmFuY2Ugb25lIGZyYW1lLCBzdG9wPXN0b3AgcHJldmlldywgZ2V0X3N0YXRlPXF1ZXJ5IHByZXZpZXcgc3RhdGUsIHJlbG9hZF9zY2VuZT1zb2Z0LXJlbG9hZCBjdXJyZW50IHNjZW5lLCBvcGVuX3BhbmVsPW9wZW4gZWRpdG9yIHBhbmVsIGJ5IG5hbWUsIGdldF9wYW5lbHM9bGlzdCBhdmFpbGFibGUgcGFuZWwgbmFtZXMnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFuZWxOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbb3Blbl9wYW5lbF0gUGFuZWwgbmFtZSB0byBvcGVuIChlLmcuLCBcImNvbnNvbGVcIiwgXCJoaWVyYXJjaHlcIiwgXCJpbnNwZWN0b3JcIiwgXCJhc3NldHNcIiknXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBwbGF5OiAoX2FyZ3MpID0+IHRoaXMucHJldmlld0NvbnRyb2woJ29wZW4nKSxcbiAgICAgICAgcGF1c2U6IChfYXJncykgPT4gdGhpcy5wcmV2aWV3Q29udHJvbCgncGF1c2UnKSxcbiAgICAgICAgc3RlcDogKF9hcmdzKSA9PiB0aGlzLnByZXZpZXdDb250cm9sKCdzdGVwJyksXG4gICAgICAgIHN0b3A6IChfYXJncykgPT4gdGhpcy5wcmV2aWV3Q29udHJvbCgnY2xvc2UnKSxcbiAgICAgICAgZ2V0X3N0YXRlOiAoX2FyZ3MpID0+IHRoaXMuZ2V0U3RhdGUoKSxcbiAgICAgICAgcmVsb2FkX3NjZW5lOiAoX2FyZ3MpID0+IHRoaXMucmVsb2FkU2NlbmUoKSxcbiAgICAgICAgb3Blbl9wYW5lbDogKGFyZ3MpID0+IHRoaXMub3BlblBhbmVsKGFyZ3MpLFxuICAgICAgICBnZXRfcGFuZWxzOiBhc3luYyAoX2FyZ3MpID0+IHN1Y2Nlc3NSZXN1bHQoeyBwYW5lbHM6IEtOT1dOX1BBTkVMUywgY291bnQ6IEtOT1dOX1BBTkVMUy5sZW5ndGggfSksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgcHJldmlld0NvbnRyb2woY29tbWFuZDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmV2aWV3JywgY29tbWFuZCBhcyBhbnkpO1xuICAgICAgICAgICAgY29uc3QgbGFiZWxzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0geyBvcGVuOiAnc3RhcnRlZCcsIHBhdXNlOiAncGF1c2VkJywgc3RlcDogJ3N0ZXBwZWQgb25lIGZyYW1lJywgY2xvc2U6ICdzdG9wcGVkJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjb21tYW5kIH0sIGBQcmV2aWV3ICR7bGFiZWxzW2NvbW1hbmRdIHx8IGNvbW1hbmR9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAvLyBTb21lIHByZXZpZXcgY29tbWFuZHMgbWF5IG5vdCByZXR1cm4gYSB2YWx1ZSDigJQgdHJlYXQgYXMgc3VjY2VzcyBpZiBubyBlcnJvciB0aHJvd25cbiAgICAgICAgICAgIGlmIChlcnIubWVzc2FnZT8uaW5jbHVkZXMoJ3RpbWVvdXQnKSB8fCBlcnIubWVzc2FnZT8uaW5jbHVkZXMoJ25vIGhhbmRsZXInKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY29tbWFuZCB9LCBgUHJldmlldyAke2NvbW1hbmR9IHNlbnQgKG5vIGNvbmZpcm1hdGlvbilgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFN0YXRlKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmV2aWV3JywgJ3F1ZXJ5LWluZm8nIGFzIGFueSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChzdGF0ZSA/PyB7IG5vdGU6ICdQcmV2aWV3IHN0YXRlIG5vdCBhdmFpbGFibGUnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub3RlOiAnQ291bGQgbm90IHF1ZXJ5IHByZXZpZXcgc3RhdGUnLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlbG9hZFNjZW5lKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc29mdC1yZWxvYWQnIGFzIGFueSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCAnU2NlbmUgcmVsb2FkZWQnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIG9wZW5QYW5lbChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLnBhbmVsTmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwYW5lbE5hbWUgaXMgcmVxdWlyZWQgZm9yIG9wZW5fcGFuZWwnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5QYW5lbC5vcGVuKGFyZ3MucGFuZWxOYW1lKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgcGFuZWxOYW1lOiBhcmdzLnBhbmVsTmFtZSB9LCBgUGFuZWwgJyR7YXJncy5wYW5lbE5hbWV9JyBvcGVuZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIG9wZW4gcGFuZWwgJyR7YXJncy5wYW5lbE5hbWV9JzogJHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==