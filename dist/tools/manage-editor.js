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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWVkaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtZWRpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBTSxZQUFZLEdBQUc7SUFDakIsU0FBUyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsUUFBUSxFQUFFLE9BQU87SUFDdEQsY0FBYyxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsa0JBQWtCO0lBQzFELFdBQVcsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLDBCQUEwQjtJQUMvRCwrQkFBK0I7Q0FDbEMsQ0FBQztBQUVGLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNhLFNBQUksR0FBRyxlQUFlLENBQUM7UUFDdkIsZ0JBQVcsR0FBRyw0S0FBNEssQ0FBQztRQUMzTCxZQUFPLEdBQUcsQ0FBQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxZQUFZLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDckcsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQztvQkFDaEcsV0FBVyxFQUFFLGdQQUFnUDtpQkFDaFE7Z0JBQ0QsU0FBUyxFQUFFO29CQUNQLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx1RkFBdUY7aUJBQ3ZHO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLElBQUksRUFBRSxD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TyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDcEMsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQVM7UUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4QyxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsVUFBVSxJQUFJLENBQUMsU0FBUyxVQUFVLENBQUMsQ0FBQztRQUM1RixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyx5QkFBeUIsSUFBSSxDQUFDLFNBQVMsTUFBTSxHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUNuRixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBeEVELG9DQXdFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG5jb25zdCBLTk9XTl9QQU5FTFMgPSBbXHJcbiAgICAnY29uc29sZScsICdoaWVyYXJjaHknLCAnaW5zcGVjdG9yJywgJ2Fzc2V0cycsICdzY2VuZScsXHJcbiAgICAnbm9kZS1saWJyYXJ5JywgJ2J1aWxkJywgJ3ByZWZlcmVuY2VzJywgJ3Byb2plY3Qtc2V0dGluZ3MnLFxyXG4gICAgJ2FuaW1hdGlvbicsICd0aW1lbGluZScsICdwcm9maWxlcicsICdjb2Nvcy1tY3Atc2VydmVyLmRlZmF1bHQnLFxyXG4gICAgJ2NvY29zLW1jcC1zZXJ2ZXIudG9vbC1tYW5hZ2VyJ1xyXG5dO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZUVkaXRvciBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2VkaXRvcic7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdDb250cm9sIENvY29zIENyZWF0b3IgZWRpdG9yIHN0YXRlLiBBY3Rpb25zOiBwbGF5LCBwYXVzZSwgc3RlcCwgc3RvcCwgZ2V0X3N0YXRlLCByZWxvYWRfc2NlbmUsIG9wZW5fcGFuZWwsIGdldF9wYW5lbHMuIFVzZXMgRWRpdG9yLk1lc3NhZ2UgZGlyZWN0bHkgd2l0aG91dCBzY2VuZSBzY3JpcHRzLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydwbGF5JywgJ3BhdXNlJywgJ3N0ZXAnLCAnc3RvcCcsICdnZXRfc3RhdGUnLCAncmVsb2FkX3NjZW5lJywgJ29wZW5fcGFuZWwnLCAnZ2V0X3BhbmVscyddO1xyXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XHJcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydwbGF5JywgJ3BhdXNlJywgJ3N0ZXAnLCAnc3RvcCcsICdnZXRfc3RhdGUnLCAncmVsb2FkX3NjZW5lJywgJ29wZW5fcGFuZWwnLCAnZ2V0X3BhbmVscyddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IHBsYXk9c3RhcnQgcHJldmlldywgcGF1c2U9cGF1c2UgcHJldmlldywgc3RlcD1hZHZhbmNlIG9uZSBmcmFtZSwgc3RvcD1zdG9wIHByZXZpZXcsIGdldF9zdGF0ZT1xdWVyeSBwcmV2aWV3IHN0YXRlLCByZWxvYWRfc2NlbmU9c29mdC1yZWxvYWQgY3VycmVudCBzY2VuZSwgb3Blbl9wYW5lbD1vcGVuIGVkaXRvciBwYW5lbCBieSBuYW1lLCBnZXRfcGFuZWxzPWxpc3QgYXZhaWxhYmxlIHBhbmVsIG5hbWVzJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwYW5lbE5hbWU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbb3Blbl9wYW5lbF0gUGFuZWwgbmFtZSB0byBvcGVuIChlLmcuLCBcImNvbnNvbGVcIiwgXCJoaWVyYXJjaHlcIiwgXCJpbnNwZWN0b3JcIiwgXCJhc3NldHNcIiknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIHBsYXk6IChfYXJncykgPT4gdGhpcy5wcmV2aWV3Q29udHJvbCgnb3BlbicpLFxyXG4gICAgICAgIHBhdXNlOiAoX2FyZ3MpID0+IHRoaXMucHJldmlld0NvbnRyb2woJ3BhdXNlJyksXHJcbiAgICAgICAgc3RlcDogKF9hcmdzKSA9PiB0aGlzLnByZXZpZXdDb250cm9sKCdzdGVwJyksXHJcbiAgICAgICAgc3RvcDogKF9hcmdzKSA9PiB0aGlzLnByZXZpZXdDb250cm9sKCdjbG9zZScpLFxyXG4gICAgICAgIGdldF9zdGF0ZTogKF9hcmdzKSA9PiB0aGlzLmdldFN0YXRlKCksXHJcbiAgICAgICAgcmVsb2FkX3NjZW5lOiAoX2FyZ3MpID0+IHRoaXMucmVsb2FkU2NlbmUoKSxcclxuICAgICAgICBvcGVuX3BhbmVsOiAoYXJncykgPT4gdGhpcy5vcGVuUGFuZWwoYXJncyksXHJcbiAgICAgICAgZ2V0X3BhbmVsczogYXN5bmMgKF9hcmdzKSA9PiBzdWNjZXNzUmVzdWx0KHsgcGFuZWxzOiBLTk9XTl9QQU5FTFMsIGNvdW50OiBLTk9XTl9QQU5FTFMubGVuZ3RoIH0pLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHByZXZpZXdDb250cm9sKGNvbW1hbmQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3ByZXZpZXcnLCBjb21tYW5kIGFzIGFueSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhYmVsczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgb3BlbjogJ3N0YXJ0ZWQnLCBwYXVzZTogJ3BhdXNlZCcsIHN0ZXA6ICdzdGVwcGVkIG9uZSBmcmFtZScsIGNsb3NlOiAnc3RvcHBlZCcgfTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjb21tYW5kIH0sIGBQcmV2aWV3ICR7bGFiZWxzW2NvbW1hbmRdIHx8IGNvbW1hbmR9YCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgLy8gU29tZSBwcmV2aWV3IGNvbW1hbmRzIG1heSBub3QgcmV0dXJuIGEgdmFsdWUg4oCUIHRyZWF0IGFzIHN1Y2Nlc3MgaWYgbm8gZXJyb3IgdGhyb3duXHJcbiAgICAgICAgICAgIGlmIChlcnIubWVzc2FnZT8uaW5jbHVkZXMoJ3RpbWVvdXQnKSB8fCBlcnIubWVzc2FnZT8uaW5jbHVkZXMoJ25vIGhhbmRsZXInKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjb21tYW5kIH0sIGBQcmV2aWV3ICR7Y29tbWFuZH0gc2VudCAobm8gY29uZmlybWF0aW9uKWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U3RhdGUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmV2aWV3JywgJ3F1ZXJ5LWluZm8nIGFzIGFueSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHN0YXRlID8/IHsgbm90ZTogJ1ByZXZpZXcgc3RhdGUgbm90IGF2YWlsYWJsZScgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub3RlOiAnQ291bGQgbm90IHF1ZXJ5IHByZXZpZXcgc3RhdGUnLCBlcnJvcjogZXJyLm1lc3NhZ2UgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgcmVsb2FkU2NlbmUoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc29mdC1yZWxvYWQnIGFzIGFueSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdTY2VuZSByZWxvYWRlZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgb3BlblBhbmVsKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5wYW5lbE5hbWUpIHJldHVybiBlcnJvclJlc3VsdCgncGFuZWxOYW1lIGlzIHJlcXVpcmVkIGZvciBvcGVuX3BhbmVsJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLlBhbmVsLm9wZW4oYXJncy5wYW5lbE5hbWUpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHBhbmVsTmFtZTogYXJncy5wYW5lbE5hbWUgfSwgYFBhbmVsICcke2FyZ3MucGFuZWxOYW1lfScgb3BlbmVkYCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gb3BlbiBwYW5lbCAnJHthcmdzLnBhbmVsTmFtZX0nOiAke2Vyci5tZXNzYWdlfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=