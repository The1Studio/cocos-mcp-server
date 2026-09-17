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
        this.description = 'Manage project build, run, preview, and settings. Actions: run, build, get_info, get_settings, get_build_settings, open_build_panel, check_builder_status. For asset operations use manage_asset instead.';
        this.actions = [
            'run', 'build', 'get_info', 'get_settings', 'get_build_settings',
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
                    description: 'Settings category for get_settings',
                    enum: ['general', 'physics', 'render', 'assets'],
                    default: 'general'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            run: (args) => this.runProject(args.platform),
            build: (args) => this.buildProject(args),
            get_info: (_args) => this.getProjectInfo(),
            get_settings: (args) => this.getProjectSettings(args.type),
            get_build_settings: (_args) => this.getBuildSettings(),
            open_build_panel: (_args) => this.openBuildPanel(),
            check_builder_status: (_args) => this.checkBuilderStatus()
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
    async getProjectSettings(category = 'general') {
        try {
            const configMap = {
                general: 'project', physics: 'physics', render: 'render', assets: 'asset-db'
            };
            const configName = configMap[category] || 'project';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByb2plY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXByb2plY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsb0NBQXdFO0FBQ3hFLHlEQUFvRDtBQUVwRDs7O0dBR0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRywyTUFBMk0sQ0FBQztRQUMxTixZQUFPLEdBQUc7WUFDZixLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsb0JBQW9CO1lBQ2hFLGtCQUFrQixFQUFFLHNCQUFzQjtTQUM3QyxDQUFDO1FBRU8sZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1CQUFtQjtvQkFDaEMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO2lCQUNyQjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGtDQUFrQztvQkFDL0MsSUFBSSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUM7aUJBQzdHO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVBQUUsZ0NBQWdDO29CQUM3QyxPQUFPLEVBQUUsSUFBSTtpQkFDaEI7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvQ0FBb0M7b0JBQ2pELElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFFBQVEs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QUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBdEpELHNDQXNKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBwcm9qZWN0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvdmVycyBidWlsZCwgcnVuLCBwcmV2aWV3LCBhbmQgc2V0dGluZ3MgZnJvbSBQcm9qZWN0VG9vbHMgKG5vbi1hc3NldCBtZXRob2RzKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZVByb2plY3QgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJvamVjdCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByb2plY3QgYnVpbGQsIHJ1biwgcHJldmlldywgYW5kIHNldHRpbmdzLiBBY3Rpb25zOiBydW4sIGJ1aWxkLCBnZXRfaW5mbywgZ2V0X3NldHRpbmdzLCBnZXRfYnVpbGRfc2V0dGluZ3MsIG9wZW5fYnVpbGRfcGFuZWwsIGNoZWNrX2J1aWxkZXJfc3RhdHVzLiBGb3IgYXNzZXQgb3BlcmF0aW9ucyB1c2UgbWFuYWdlX2Fzc2V0IGluc3RlYWQuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xuICAgICAgICAncnVuJywgJ2J1aWxkJywgJ2dldF9pbmZvJywgJ2dldF9zZXR0aW5ncycsICdnZXRfYnVpbGRfc2V0dGluZ3MnLFxuICAgICAgICAnb3Blbl9idWlsZF9wYW5lbCcsICdjaGVja19idWlsZGVyX3N0YXR1cydcbiAgICBdO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJyxcbiAgICAgICAgICAgICAgICBlbnVtOiB0aGlzLmFjdGlvbnNcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwbGF0Zm9ybToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IHBsYXRmb3JtIGZvciBydW4gb3IgYnVpbGQnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYnJvd3NlcicsICdzaW11bGF0b3InLCAncHJldmlldycsICd3ZWItbW9iaWxlJywgJ3dlYi1kZXNrdG9wJywgJ2lvcycsICdhbmRyb2lkJywgJ3dpbmRvd3MnLCAnbWFjJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWJ1Zzoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlYnVnIGJ1aWxkIChmb3IgYnVpbGQgYWN0aW9uKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NldHRpbmdzIGNhdGVnb3J5IGZvciBnZXRfc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2VuZXJhbCcsICdwaHlzaWNzJywgJ3JlbmRlcicsICdhc3NldHMnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2VuZXJhbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIHJ1bjogKGFyZ3MpID0+IHRoaXMucnVuUHJvamVjdChhcmdzLnBsYXRmb3JtKSxcbiAgICAgICAgYnVpbGQ6IChhcmdzKSA9PiB0aGlzLmJ1aWxkUHJvamVjdChhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChfYXJncykgPT4gdGhpcy5nZXRQcm9qZWN0SW5mbygpLFxuICAgICAgICBnZXRfc2V0dGluZ3M6IChhcmdzKSA9PiB0aGlzLmdldFByb2plY3RTZXR0aW5ncyhhcmdzLnR5cGUpLFxuICAgICAgICBnZXRfYnVpbGRfc2V0dGluZ3M6IChfYXJncykgPT4gdGhpcy5nZXRCdWlsZFNldHRpbmdzKCksXG4gICAgICAgIG9wZW5fYnVpbGRfcGFuZWw6IChfYXJncykgPT4gdGhpcy5vcGVuQnVpbGRQYW5lbCgpLFxuICAgICAgICBjaGVja19idWlsZGVyX3N0YXR1czogKF9hcmdzKSA9PiB0aGlzLmNoZWNrQnVpbGRlclN0YXR1cygpXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgcnVuUHJvamVjdChwbGF0Zm9ybTogc3RyaW5nID0gJ2Jyb3dzZXInKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiBQcmV2aWV3IG1vZHVsZSBpcyBub3QgZG9jdW1lbnRlZCBpbiBvZmZpY2lhbCBBUEkuXG4gICAgICAgICAgICAvLyBVc2luZyBmYWxsYmFjayBhcHByb2FjaCDigJQgb3BlbiBidWlsZCBwYW5lbCBhcyBhbHRlcm5hdGl2ZS5cbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAnb3BlbicpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBwbGF0Zm9ybSB9LCAnQnVpbGQgcGFuZWwgb3BlbmVkLiBQcmV2aWV3IGZ1bmN0aW9uYWxpdHkgcmVxdWlyZXMgbWFudWFsIHNldHVwLicpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYnVpbGRQcm9qZWN0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogQnVpbGRlciBtb2R1bGUgb25seSBzdXBwb3J0cyAnb3BlbicgYW5kICdxdWVyeS13b3JrZXItcmVhZHknLlxuICAgICAgICAgICAgLy8gTm8gYnVpbGQgY29uZmlnIGlzIGV2ZXIgc2VudCDigJQgdGhpcyBjYW5ub3Qgc3RhcnQsIHJ1biwgb3IgcmVwb3J0IG9uIGEgYnVpbGQuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ29wZW4nKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdidWlsZCBkb2VzIG5vdCBydW4gYSBidWlsZCDigJQgaXQgb25seSBvcGVucyB0aGUgQ29jb3MgQ3JlYXRvciBidWlsZCBwYW5lbC4gTm8gYnVpbGQgY29uZmlnIHdhcyBzZW50IGFuZCBubyBidWlsZCB0YXNrIHdhcyBzdGFydGVkLicsXG4gICAgICAgICAgICAgICAgaXNFcnJvcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdwYW5lbC1vcGVuZWQnLFxuICAgICAgICAgICAgICAgICAgICBwbGF0Zm9ybTogYXJncy5wbGF0Zm9ybSxcbiAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdDb25maWd1cmUgYW5kIHN0YXJ0IHRoZSBidWlsZCBtYW51YWxseSB0aHJvdWdoIHRoZSBvcGVuZWQgYnVpbGQgcGFuZWwnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByb2plY3RJbmZvKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICBuYW1lOiBFZGl0b3IuUHJvamVjdC5uYW1lLFxuICAgICAgICAgICAgcGF0aDogRWRpdG9yLlByb2plY3QucGF0aCxcbiAgICAgICAgICAgIHV1aWQ6IEVkaXRvci5Qcm9qZWN0LnV1aWQsXG4gICAgICAgICAgICB2ZXJzaW9uOiAoRWRpdG9yLlByb2plY3QgYXMgYW55KS52ZXJzaW9uIHx8ICcxLjAuMCcsXG4gICAgICAgICAgICBjb2Nvc1ZlcnNpb246IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uY29jb3MgfHwgJ1Vua25vd24nXG4gICAgICAgIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiAncXVlcnktaW5mbycgQVBJIGRvZXNuJ3QgZXhpc3QsIHVzaW5nICdxdWVyeS1jb25maWcnIGluc3RlYWQuXG4gICAgICAgICAgICBjb25zdCBhZGRpdGlvbmFsSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKTtcbiAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsSW5mbykgT2JqZWN0LmFzc2lnbihpbmZvLCB7IGNvbmZpZzogYWRkaXRpb25hbEluZm8gfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gUmV0dXJuIGJhc2ljIGluZm8gZXZlbiBpZiBkZXRhaWxlZCBxdWVyeSBmYWlsc1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGluZm8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJvamVjdFNldHRpbmdzKGNhdGVnb3J5OiBzdHJpbmcgPSAnZ2VuZXJhbCcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICBnZW5lcmFsOiAncHJvamVjdCcsIHBoeXNpY3M6ICdwaHlzaWNzJywgcmVuZGVyOiAncmVuZGVyJywgYXNzZXRzOiAnYXNzZXQtZGInXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgY29uZmlnTmFtZSA9IGNvbmZpZ01hcFtjYXRlZ29yeV0gfHwgJ3Byb2plY3QnO1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ05hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29uZmlnOiBzZXR0aW5ncyB9LCBgJHtjYXRlZ29yeX0gc2V0dGluZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QnVpbGRTZXR0aW5ncygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKSBhcyBib29sZWFuO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIGJ1aWxkZXJSZWFkeTogcmVhZHksXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlQWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAnT3BlbiBidWlsZCBwYW5lbCB3aXRoIG9wZW5fYnVpbGRfcGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAnQ2hlY2sgYnVpbGRlciBzdGF0dXMgd2l0aCBjaGVja19idWlsZGVyX3N0YXR1cydcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGxpbWl0YXRpb246ICdGdWxsIGJ1aWxkIGNvbmZpZ3VyYXRpb24gcmVxdWlyZXMgZGlyZWN0IEVkaXRvciBVSSBhY2Nlc3MnXG4gICAgICAgICAgICB9LCAnQnVpbGQgc2V0dGluZ3MgYXJlIGxpbWl0ZWQgaW4gTUNQIHBsdWdpbiBlbnZpcm9ubWVudCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkJ1aWxkUGFuZWwoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ29wZW4nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdCdWlsZCBwYW5lbCBvcGVuZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja0J1aWxkZXJTdGF0dXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiAncXVlcnktd29ya2VyLXJlYWR5JyByZXBvcnRzIG9ubHkgd2hldGhlciB0aGUgYnVpbGQgV09SS0VSIHByb2Nlc3MgaXMgaWRsZSDigJRcbiAgICAgICAgICAgIC8vIGl0IG5ldmVyIHJlcG9ydHMgd2hldGhlciBhIGJ1aWxkIGlzIHJ1bm5pbmcsIGZpbmlzaGVkLCBzdWNjZWVkZWQsIG9yIHdoZXJlIGl0c1xuICAgICAgICAgICAgLy8gb3V0cHV0IHdlbnQuIERvIG5vdCByZWFkIGB3b3JrZXJSZWFkeWAgYXMgYnVpbGQtdGFzayBzdGF0dXMuXG4gICAgICAgICAgICBjb25zdCB3b3JrZXJSZWFkeTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAncXVlcnktd29ya2VyLXJlYWR5JykgYXMgYm9vbGVhbjtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICB3b3JrZXJSZWFkeSxcbiAgICAgICAgICAgICAgICB0YXNrU3RhdHVzOiAnbm90LXRyYWNrZWQnLFxuICAgICAgICAgICAgICAgIHN0YXR1czogd29ya2VyUmVhZHkgPyAnQnVpbGRlciB3b3JrZXIgaXMgaWRsZS9yZWFkeScgOiAnQnVpbGRlciB3b3JrZXIgaXMgYnVzeS9ub3QgcmVhZHknXG4gICAgICAgICAgICB9LCAnUmVwb3J0cyBidWlsZCBXT1JLRVIgcmVhZGluZXNzIG9ubHkg4oCUIG5vIGJ1aWxkIHRhc2sgc3RhdGUgKHJ1bm5pbmcvZmluaXNoZWQvb3V0cHV0IHBhdGgpIGlzIG9ic2VydmFibGUgdGhyb3VnaCB0aGlzIGFjdGlvbicpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19