"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageProject = void 0;
const types_1 = require("../types");
const base_action_tool_1 = require("./base-action-tool");
/**
 * Consolidated project management tool.
 * Covers build, run, preview, and settings from ProjectTools (non-asset methods).
 */
class ManageProject extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_project';
        this.description = 'Manage project build, run, preview, and settings. Actions: run, build, get_info, get_settings, set_settings, get_build_settings, open_build_panel, check_builder_status. For asset operations use manage_asset instead.';
        this.actions = [
            'run', 'build', 'get_info', 'get_settings', 'set_settings', 'get_build_settings',
            'open_build_panel', 'check_builder_status'
        ];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform',
                    enum: this.actions
                },
                platform: {
                    type: 'string',
                    description: 'Target platform for run or build',
                    enum: ['browser', 'simulator', 'preview', 'web-mobile', 'web-desktop', 'ios', 'android', 'windows', 'mac']
                },
                debug: {
                    type: 'boolean',
                    description: 'Debug build (for build action)',
                    default: true
                },
                type: {
                    type: 'string',
                    description: 'Settings category for get_settings / set_settings (engine = settings/v2/packages/engine.json, e.g. renderPipeline)',
                    enum: ['general', 'physics', 'render', 'assets', 'engine'],
                    default: 'general'
                },
                path: {
                    type: 'string',
                    description: 'Dotted config path inside the category (set_settings), e.g. renderPipeline or customPipeline.postProcess'
                },
                value: {
                    description: 'New value to write at path (set_settings); any JSON value'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            run: (args) => this.runProject(args.platform),
            build: (args) => this.buildProject(args),
            get_info: (_args) => this.getProjectInfo(),
            get_settings: (args) => this.getProjectSettings(args.type),
            set_settings: (args) => this.setProjectSettings(args.type, args.path, args.value),
            get_build_settings: (_args) => this.getBuildSettings(),
            open_build_panel: (_args) => this.openBuildPanel(),
            check_builder_status: (_args) => this.checkBuilderStatus()
        };
        this.settingsConfigMap = {
            general: 'project', physics: 'physics', render: 'render', assets: 'asset-db', engine: 'engine'
        };
    }
    async runProject(platform = 'browser') {
        try {
            // Note: Preview module is not documented in official API.
            // Using fallback approach — open build panel as alternative.
            await Editor.Message.request('builder', 'open');
            return (0, types_1.successResult)({ platform }, 'Build panel opened. Preview functionality requires manual setup.');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async buildProject(args) {
        try {
            // Note: Builder module only supports 'open' and 'query-worker-ready'.
            // No build config is ever sent — this cannot start, run, or report on a build.
            await Editor.Message.request('builder', 'open');
            return {
                success: false,
                error: 'build does not run a build — it only opens the Cocos Creator build panel. No build config was sent and no build task was started.',
                isError: true,
                data: {
                    started: false,
                    status: 'panel-opened',
                    platform: args.platform,
                    instruction: 'Configure and start the build manually through the opened build panel'
                }
            };
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getProjectInfo() {
        var _a;
        const info = {
            name: Editor.Project.name,
            path: Editor.Project.path,
            uuid: Editor.Project.uuid,
            version: Editor.Project.version || '1.0.0',
            cocosVersion: ((_a = Editor.versions) === null || _a === void 0 ? void 0 : _a.cocos) || 'Unknown'
        };
        try {
            // Note: 'query-info' API doesn't exist, using 'query-config' instead.
            const additionalInfo = await Editor.Message.request('project', 'query-config', 'project');
            if (additionalInfo)
                Object.assign(info, { config: additionalInfo });
        }
        catch (_b) {
            // Return basic info even if detailed query fails
        }
        return (0, types_1.successResult)(info);
    }
    /**
     * Write one project-settings value through the editor's own `project:set-config`
     * (the call the Project Settings panel makes). Requires an explicit path and value; an
     * unknown category is an error, not a silent fall-through to `project`; a `false` reply
     * from the editor is a failure, not a success (#134).
     */
    async setProjectSettings(category = 'general', path, value) {
        const configName = this.settingsConfigMap[category];
        if (!configName) {
            return (0, types_1.errorResult)(`Unknown settings category '${category}'. Valid: ${Object.keys(this.settingsConfigMap).join(', ')}`);
        }
        if (typeof path !== 'string' || path.trim() === '') {
            return (0, types_1.errorResult)("set_settings requires 'path' (dotted config path, e.g. renderPipeline)");
        }
        if (value === undefined) {
            return (0, types_1.errorResult)("set_settings requires 'value' (pass null explicitly to write null)");
        }
        try {
            const ok = await Editor.Message.request('project', 'set-config', configName, path, value);
            if (!ok) {
                return (0, types_1.errorResult)(`The editor refused to set ${configName}.${path} (project:set-config returned false)`);
            }
            return (0, types_1.successResult)({ category, config: configName, path, value }, `${configName}.${path} updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getProjectSettings(category = 'general') {
        try {
            const configName = this.settingsConfigMap[category] || 'project';
            const settings = await Editor.Message.request('project', 'query-config', configName);
            return (0, types_1.successResult)({ category, config: settings }, `${category} settings retrieved successfully`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getBuildSettings() {
        try {
            const ready = await Editor.Message.request('builder', 'query-worker-ready');
            return (0, types_1.successResult)({
                builderReady: ready,
                availableActions: [
                    'Open build panel with open_build_panel',
                    'Check builder status with check_builder_status'
                ],
                limitation: 'Full build configuration requires direct Editor UI access'
            }, 'Build settings are limited in MCP plugin environment');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async openBuildPanel() {
        try {
            await Editor.Message.request('builder', 'open');
            return (0, types_1.successResult)(null, 'Build panel opened successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async checkBuilderStatus() {
        try {
            // Note: 'query-worker-ready' reports only whether the build WORKER process is idle —
            // it never reports whether a build is running, finished, succeeded, or where its
            // output went. Do not read `workerReady` as build-task status.
            const workerReady = await Editor.Message.request('builder', 'query-worker-ready');
            return (0, types_1.successResult)({
                workerReady,
                taskStatus: 'not-tracked',
                status: workerReady ? 'Builder worker is idle/ready' : 'Builder worker is busy/not ready'
            }, 'Reports build WORKER readiness only — no build task state (running/finished/output path) is observable through this action');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
}
exports.ManageProject = ManageProject;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByb2plY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXByb2plY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsb0NBQXdFO0FBQ3hFLHlEQUFvRDtBQUVwRDs7O0dBR0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRyx5TkFBeU4sQ0FBQztRQUN4TyxZQUFPLEdBQUc7WUFDZixLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLG9CQUFvQjtZQUNoRixrQkFBa0IsRUFBRSxzQkFBc0I7U0FDN0MsQ0FBQztRQUVPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxtQkFBbUI7b0JBQ2hDLElBQUksRUFBRSxJQUFJLENBQUMsT0FBTztpQkFDckI7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxrQ0FBa0M7b0JBQy9DLElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxXQUFXLEVBQUUsU0FBUyxFQUFFLFlBQVksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsS0FBSyxDQUFDO2lCQUM3RztnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsSUFBSSxFQUFFLFNBQVM7b0JBQ2YsV0FBVyxFQUFFLGdDQUFnQztvQkFDN0MsT0FBTyxFQUFFLElBQUk7aUJBQ2hCO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsb0hBQW9IO29CQUNqSSxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEs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QUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQkFBa0I7UUFDNUIsSUFBSSxDQUFDO1lBQ0QscUZBQXFGO1lBQ3JGLGlGQUFpRjtZQUNqRiwrREFBK0Q7WUFDL0QsTUFBTSxXQUFXLEdBQVksTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsb0JBQW9CLENBQVksQ0FBQztZQUN0RyxPQUFPLElBQUEscUJBQWEsRUFBQztnQkFDakIsV0FBVztnQkFDWCxVQUFVLEVBQUUsYUFBYTtnQkFDekIsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsOEJBQThCLENBQUMsQ0FBQyxDQUFDLGtDQUFrQzthQUM1RixFQUFFLDRIQUE0SCxDQUFDLENBQUM7UUFDckksQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBM0xELHNDQTJMQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBwcm9qZWN0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvdmVycyBidWlsZCwgcnVuLCBwcmV2aWV3LCBhbmQgc2V0dGluZ3MgZnJvbSBQcm9qZWN0VG9vbHMgKG5vbi1hc3NldCBtZXRob2RzKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZVByb2plY3QgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJvamVjdCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByb2plY3QgYnVpbGQsIHJ1biwgcHJldmlldywgYW5kIHNldHRpbmdzLiBBY3Rpb25zOiBydW4sIGJ1aWxkLCBnZXRfaW5mbywgZ2V0X3NldHRpbmdzLCBzZXRfc2V0dGluZ3MsIGdldF9idWlsZF9zZXR0aW5ncywgb3Blbl9idWlsZF9wYW5lbCwgY2hlY2tfYnVpbGRlcl9zdGF0dXMuIEZvciBhc3NldCBvcGVyYXRpb25zIHVzZSBtYW5hZ2VfYXNzZXQgaW5zdGVhZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdydW4nLCAnYnVpbGQnLCAnZ2V0X2luZm8nLCAnZ2V0X3NldHRpbmdzJywgJ3NldF9zZXR0aW5ncycsICdnZXRfYnVpbGRfc2V0dGluZ3MnLFxuICAgICAgICAnb3Blbl9idWlsZF9wYW5lbCcsICdjaGVja19idWlsZGVyX3N0YXR1cydcbiAgICBdO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJyxcbiAgICAgICAgICAgICAgICBlbnVtOiB0aGlzLmFjdGlvbnNcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwbGF0Zm9ybToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IHBsYXRmb3JtIGZvciBydW4gb3IgYnVpbGQnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYnJvd3NlcicsICdzaW11bGF0b3InLCAncHJldmlldycsICd3ZWItbW9iaWxlJywgJ3dlYi1kZXNrdG9wJywgJ2lvcycsICdhbmRyb2lkJywgJ3dpbmRvd3MnLCAnbWFjJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWJ1Zzoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlYnVnIGJ1aWxkIChmb3IgYnVpbGQgYWN0aW9uKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NldHRpbmdzIGNhdGVnb3J5IGZvciBnZXRfc2V0dGluZ3MgLyBzZXRfc2V0dGluZ3MgKGVuZ2luZSA9IHNldHRpbmdzL3YyL3BhY2thZ2VzL2VuZ2luZS5qc29uLCBlLmcuIHJlbmRlclBpcGVsaW5lKScsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZW5lcmFsJywgJ3BoeXNpY3MnLCAncmVuZGVyJywgJ2Fzc2V0cycsICdlbmdpbmUnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2VuZXJhbCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdEb3R0ZWQgY29uZmlnIHBhdGggaW5zaWRlIHRoZSBjYXRlZ29yeSAoc2V0X3NldHRpbmdzKSwgZS5nLiByZW5kZXJQaXBlbGluZSBvciBjdXN0b21QaXBlbGluZS5wb3N0UHJvY2VzcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTmV3IHZhbHVlIHRvIHdyaXRlIGF0IHBhdGggKHNldF9zZXR0aW5ncyk7IGFueSBKU09OIHZhbHVlJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgcnVuOiAoYXJncykgPT4gdGhpcy5ydW5Qcm9qZWN0KGFyZ3MucGxhdGZvcm0pLFxuICAgICAgICBidWlsZDogKGFyZ3MpID0+IHRoaXMuYnVpbGRQcm9qZWN0KGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKF9hcmdzKSA9PiB0aGlzLmdldFByb2plY3RJbmZvKCksXG4gICAgICAgIGdldF9zZXR0aW5nczogKGFyZ3MpID0+IHRoaXMuZ2V0UHJvamVjdFNldHRpbmdzKGFyZ3MudHlwZSksXG4gICAgICAgIHNldF9zZXR0aW5nczogKGFyZ3MpID0+IHRoaXMuc2V0UHJvamVjdFNldHRpbmdzKGFyZ3MudHlwZSwgYXJncy5wYXRoLCBhcmdzLnZhbHVlKSxcbiAgICAgICAgZ2V0X2J1aWxkX3NldHRpbmdzOiAoX2FyZ3MpID0+IHRoaXMuZ2V0QnVpbGRTZXR0aW5ncygpLFxuICAgICAgICBvcGVuX2J1aWxkX3BhbmVsOiAoX2FyZ3MpID0+IHRoaXMub3BlbkJ1aWxkUGFuZWwoKSxcbiAgICAgICAgY2hlY2tfYnVpbGRlcl9zdGF0dXM6IChfYXJncykgPT4gdGhpcy5jaGVja0J1aWxkZXJTdGF0dXMoKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIHJ1blByb2plY3QocGxhdGZvcm06IHN0cmluZyA9ICdicm93c2VyJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogUHJldmlldyBtb2R1bGUgaXMgbm90IGRvY3VtZW50ZWQgaW4gb2ZmaWNpYWwgQVBJLlxuICAgICAgICAgICAgLy8gVXNpbmcgZmFsbGJhY2sgYXBwcm9hY2gg4oCUIG9wZW4gYnVpbGQgcGFuZWwgYXMgYWx0ZXJuYXRpdmUuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ29wZW4nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgcGxhdGZvcm0gfSwgJ0J1aWxkIHBhbmVsIG9wZW5lZC4gUHJldmlldyBmdW5jdGlvbmFsaXR5IHJlcXVpcmVzIG1hbnVhbCBzZXR1cC4nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJ1aWxkUHJvamVjdChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIE5vdGU6IEJ1aWxkZXIgbW9kdWxlIG9ubHkgc3VwcG9ydHMgJ29wZW4nIGFuZCAncXVlcnktd29ya2VyLXJlYWR5Jy5cbiAgICAgICAgICAgIC8vIE5vIGJ1aWxkIGNvbmZpZyBpcyBldmVyIHNlbnQg4oCUIHRoaXMgY2Fubm90IHN0YXJ0LCBydW4sIG9yIHJlcG9ydCBvbiBhIGJ1aWxkLlxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdvcGVuJyk7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAnYnVpbGQgZG9lcyBub3QgcnVuIGEgYnVpbGQg4oCUIGl0IG9ubHkgb3BlbnMgdGhlIENvY29zIENyZWF0b3IgYnVpbGQgcGFuZWwuIE5vIGJ1aWxkIGNvbmZpZyB3YXMgc2VudCBhbmQgbm8gYnVpbGQgdGFzayB3YXMgc3RhcnRlZC4nLFxuICAgICAgICAgICAgICAgIGlzRXJyb3I6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBzdGFydGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAncGFuZWwtb3BlbmVkJyxcbiAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm06IGFyZ3MucGxhdGZvcm0sXG4gICAgICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnQ29uZmlndXJlIGFuZCBzdGFydCB0aGUgYnVpbGQgbWFudWFsbHkgdGhyb3VnaCB0aGUgb3BlbmVkIGJ1aWxkIHBhbmVsJ1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcm9qZWN0SW5mbygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgaW5mbzogYW55ID0ge1xuICAgICAgICAgICAgbmFtZTogRWRpdG9yLlByb2plY3QubmFtZSxcbiAgICAgICAgICAgIHBhdGg6IEVkaXRvci5Qcm9qZWN0LnBhdGgsXG4gICAgICAgICAgICB1dWlkOiBFZGl0b3IuUHJvamVjdC51dWlkLFxuICAgICAgICAgICAgdmVyc2lvbjogKEVkaXRvci5Qcm9qZWN0IGFzIGFueSkudmVyc2lvbiB8fCAnMS4wLjAnLFxuICAgICAgICAgICAgY29jb3NWZXJzaW9uOiAoRWRpdG9yIGFzIGFueSkudmVyc2lvbnM/LmNvY29zIHx8ICdVbmtub3duJ1xuICAgICAgICB9O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogJ3F1ZXJ5LWluZm8nIEFQSSBkb2Vzbid0IGV4aXN0LCB1c2luZyAncXVlcnktY29uZmlnJyBpbnN0ZWFkLlxuICAgICAgICAgICAgY29uc3QgYWRkaXRpb25hbEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsICdwcm9qZWN0Jyk7XG4gICAgICAgICAgICBpZiAoYWRkaXRpb25hbEluZm8pIE9iamVjdC5hc3NpZ24oaW5mbywgeyBjb25maWc6IGFkZGl0aW9uYWxJbmZvIH0pO1xuICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIFJldHVybiBiYXNpYyBpbmZvIGV2ZW4gaWYgZGV0YWlsZWQgcXVlcnkgZmFpbHNcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChpbmZvKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlYWRvbmx5IHNldHRpbmdzQ29uZmlnTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICBnZW5lcmFsOiAncHJvamVjdCcsIHBoeXNpY3M6ICdwaHlzaWNzJywgcmVuZGVyOiAncmVuZGVyJywgYXNzZXRzOiAnYXNzZXQtZGInLCBlbmdpbmU6ICdlbmdpbmUnXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFdyaXRlIG9uZSBwcm9qZWN0LXNldHRpbmdzIHZhbHVlIHRocm91Z2ggdGhlIGVkaXRvcidzIG93biBgcHJvamVjdDpzZXQtY29uZmlnYFxuICAgICAqICh0aGUgY2FsbCB0aGUgUHJvamVjdCBTZXR0aW5ncyBwYW5lbCBtYWtlcykuIFJlcXVpcmVzIGFuIGV4cGxpY2l0IHBhdGggYW5kIHZhbHVlOyBhblxuICAgICAqIHVua25vd24gY2F0ZWdvcnkgaXMgYW4gZXJyb3IsIG5vdCBhIHNpbGVudCBmYWxsLXRocm91Z2ggdG8gYHByb2plY3RgOyBhIGBmYWxzZWAgcmVwbHlcbiAgICAgKiBmcm9tIHRoZSBlZGl0b3IgaXMgYSBmYWlsdXJlLCBub3QgYSBzdWNjZXNzICgjMTM0KS5cbiAgICAgKi9cbiAgICBwcml2YXRlIGFzeW5jIHNldFByb2plY3RTZXR0aW5ncyhjYXRlZ29yeTogc3RyaW5nID0gJ2dlbmVyYWwnLCBwYXRoPzogc3RyaW5nLCB2YWx1ZT86IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBjb25maWdOYW1lID0gdGhpcy5zZXR0aW5nc0NvbmZpZ01hcFtjYXRlZ29yeV07XG4gICAgICAgIGlmICghY29uZmlnTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBVbmtub3duIHNldHRpbmdzIGNhdGVnb3J5ICcke2NhdGVnb3J5fScuIFZhbGlkOiAke09iamVjdC5rZXlzKHRoaXMuc2V0dGluZ3NDb25maWdNYXApLmpvaW4oJywgJyl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJyB8fCBwYXRoLnRyaW0oKSA9PT0gJycpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcInNldF9zZXR0aW5ncyByZXF1aXJlcyAncGF0aCcgKGRvdHRlZCBjb25maWcgcGF0aCwgZS5nLiByZW5kZXJQaXBlbGluZSlcIik7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChcInNldF9zZXR0aW5ncyByZXF1aXJlcyAndmFsdWUnIChwYXNzIG51bGwgZXhwbGljaXRseSB0byB3cml0ZSBudWxsKVwiKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgb2sgPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcm9qZWN0JywgJ3NldC1jb25maWcnLCBjb25maWdOYW1lLCBwYXRoLCB2YWx1ZSk7XG4gICAgICAgICAgICBpZiAoIW9rKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBUaGUgZWRpdG9yIHJlZnVzZWQgdG8gc2V0ICR7Y29uZmlnTmFtZX0uJHtwYXRofSAocHJvamVjdDpzZXQtY29uZmlnIHJldHVybmVkIGZhbHNlKWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29uZmlnOiBjb25maWdOYW1lLCBwYXRoLCB2YWx1ZSB9LCBgJHtjb25maWdOYW1lfS4ke3BhdGh9IHVwZGF0ZWRgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByb2plY3RTZXR0aW5ncyhjYXRlZ29yeTogc3RyaW5nID0gJ2dlbmVyYWwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBjb25maWdOYW1lID0gdGhpcy5zZXR0aW5nc0NvbmZpZ01hcFtjYXRlZ29yeV0gfHwgJ3Byb2plY3QnO1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ05hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29uZmlnOiBzZXR0aW5ncyB9LCBgJHtjYXRlZ29yeX0gc2V0dGluZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QnVpbGRTZXR0aW5ncygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKSBhcyBib29sZWFuO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIGJ1aWxkZXJSZWFkeTogcmVhZHksXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlQWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAnT3BlbiBidWlsZCBwYW5lbCB3aXRoIG9wZW5fYnVpbGRfcGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAnQ2hlY2sgYnVpbGRlciBzdGF0dXMgd2l0aCBjaGVja19idWlsZGVyX3N0YXR1cydcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGxpbWl0YXRpb246ICdGdWxsIGJ1aWxkIGNvbmZpZ3VyYXRpb24gcmVxdWlyZXMgZGlyZWN0IEVkaXRvciBVSSBhY2Nlc3MnXG4gICAgICAgICAgICB9LCAnQnVpbGQgc2V0dGluZ3MgYXJlIGxpbWl0ZWQgaW4gTUNQIHBsdWdpbiBlbnZpcm9ubWVudCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkJ1aWxkUGFuZWwoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ29wZW4nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdCdWlsZCBwYW5lbCBvcGVuZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja0J1aWxkZXJTdGF0dXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiAncXVlcnktd29ya2VyLXJlYWR5JyByZXBvcnRzIG9ubHkgd2hldGhlciB0aGUgYnVpbGQgV09SS0VSIHByb2Nlc3MgaXMgaWRsZSDigJRcbiAgICAgICAgICAgIC8vIGl0IG5ldmVyIHJlcG9ydHMgd2hldGhlciBhIGJ1aWxkIGlzIHJ1bm5pbmcsIGZpbmlzaGVkLCBzdWNjZWVkZWQsIG9yIHdoZXJlIGl0c1xuICAgICAgICAgICAgLy8gb3V0cHV0IHdlbnQuIERvIG5vdCByZWFkIGB3b3JrZXJSZWFkeWAgYXMgYnVpbGQtdGFzayBzdGF0dXMuXG4gICAgICAgICAgICBjb25zdCB3b3JrZXJSZWFkeTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAncXVlcnktd29ya2VyLXJlYWR5JykgYXMgYm9vbGVhbjtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICB3b3JrZXJSZWFkeSxcbiAgICAgICAgICAgICAgICB0YXNrU3RhdHVzOiAnbm90LXRyYWNrZWQnLFxuICAgICAgICAgICAgICAgIHN0YXR1czogd29ya2VyUmVhZHkgPyAnQnVpbGRlciB3b3JrZXIgaXMgaWRsZS9yZWFkeScgOiAnQnVpbGRlciB3b3JrZXIgaXMgYnVzeS9ub3QgcmVhZHknXG4gICAgICAgICAgICB9LCAnUmVwb3J0cyBidWlsZCBXT1JLRVIgcmVhZGluZXNzIG9ubHkg4oCUIG5vIGJ1aWxkIHRhc2sgc3RhdGUgKHJ1bm5pbmcvZmluaXNoZWQvb3V0cHV0IHBhdGgpIGlzIG9ic2VydmFibGUgdGhyb3VnaCB0aGlzIGFjdGlvbicpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19