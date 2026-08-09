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
        this.description = 'Manage project build, run, preview, and settings. Actions: run, build, get_info, get_settings, get_build_settings, open_build_panel, check_builder_status, start_preview, stop_preview. For asset operations use manage_asset instead.';
        this.actions = [
            'run', 'build', 'get_info', 'get_settings', 'get_build_settings',
            'open_build_panel', 'check_builder_status', 'start_preview', 'stop_preview'
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
                },
                port: {
                    type: 'number',
                    description: 'Preview server port (for start_preview)',
                    default: 7456
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
            check_builder_status: (_args) => this.checkBuilderStatus(),
            start_preview: (args) => this.startPreviewServer(args.port !== undefined ? parseInt(String(args.port), 10) : 7456),
            stop_preview: (_args) => this.stopPreviewServer()
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
            // Building requires manual interaction through the build panel.
            await Editor.Message.request('builder', 'open');
            return (0, types_1.successResult)({ platform: args.platform, instruction: 'Use the build panel to configure and start the build process' }, `Build panel opened for ${args.platform}. Please configure and start build manually.`);
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
                    'Check builder status with check_builder_status',
                    'Start preview server with start_preview',
                    'Stop preview server with stop_preview'
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
            const ready = await Editor.Message.request('builder', 'query-worker-ready');
            return (0, types_1.successResult)({
                ready,
                status: ready ? 'Builder worker is ready' : 'Builder worker is not ready'
            }, 'Builder status checked successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async startPreviewServer(_port = 7456) {
        return {
            success: false,
            error: 'Preview server control is not supported through MCP API',
            isError: true,
            data: {
                instruction: 'Please start the preview server manually using the editor menu: Project > Preview, or use the preview panel in the editor'
            }
        };
    }
    async stopPreviewServer() {
        return {
            success: false,
            error: 'Preview server control is not supported through MCP API',
            isError: true,
            data: {
                instruction: 'Please stop the preview server manually using the preview panel in the editor'
            }
        };
    }
}
exports.ManageProject = ManageProject;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByb2plY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXByb2plY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsb0NBQXdFO0FBQ3hFLHlEQUFvRDtBQUVwRDs7O0dBR0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRyx3T0FBd08sQ0FBQztRQUN2UCxZQUFPLEdBQUc7WUFDZixLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsb0JBQW9CO1lBQ2hFLGtCQUFrQixFQUFFLHNCQUFzQixFQUFFLGVBQWUsRUFBRSxjQUFjO1NBQzlFLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsa0NBQWtDO29CQUMvQyxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQztpQkFDN0c7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSxnQ0FBZ0M7b0JBQzdDLE9BQU8sRUFBRSxJQUFJO2lCQUNoQjtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG9DQUFvQztvQkFDakQsSUFBSSxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMs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Q0FBQztZQUNELE1BQU0sS0FBSyxHQUFZLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFZLENBQUM7WUFDaEcsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLEtBQUs7Z0JBQ0wsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLDZCQUE2QjthQUM1RSxFQUFFLHFDQUFxQyxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxRQUFnQixJQUFJO1FBQ2pELE9BQU87WUFDSCxPQUFPLEVBQUUsS0FBSztZQUNkLEtBQUssRUFBRSx5REFBeUQ7WUFDaEUsT0FBTyxFQUFFLElBQUk7WUFDYixJQUFJLEVBQUU7Z0JBQ0YsV0FBVyxFQUFFLDJIQUEySDthQUMzSTtTQUNKLENBQUM7SUFDTixDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQjtRQUMzQixPQUFPO1lBQ0gsT0FBTyxFQUFFLEtBQUs7WUFDZCxLQUFLLEVBQUUseURBQXlEO1lBQ2hFLE9BQU8sRUFBRSxJQUFJO1lBQ2IsSUFBSSxFQUFFO2dCQUNGLFdBQVcsRUFBRSwrRUFBK0U7YUFDL0Y7U0FDSixDQUFDO0lBQ04sQ0FBQztDQUNKO0FBM0tELHNDQTJLQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBwcm9qZWN0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvdmVycyBidWlsZCwgcnVuLCBwcmV2aWV3LCBhbmQgc2V0dGluZ3MgZnJvbSBQcm9qZWN0VG9vbHMgKG5vbi1hc3NldCBtZXRob2RzKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZVByb2plY3QgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJvamVjdCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByb2plY3QgYnVpbGQsIHJ1biwgcHJldmlldywgYW5kIHNldHRpbmdzLiBBY3Rpb25zOiBydW4sIGJ1aWxkLCBnZXRfaW5mbywgZ2V0X3NldHRpbmdzLCBnZXRfYnVpbGRfc2V0dGluZ3MsIG9wZW5fYnVpbGRfcGFuZWwsIGNoZWNrX2J1aWxkZXJfc3RhdHVzLCBzdGFydF9wcmV2aWV3LCBzdG9wX3ByZXZpZXcuIEZvciBhc3NldCBvcGVyYXRpb25zIHVzZSBtYW5hZ2VfYXNzZXQgaW5zdGVhZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdydW4nLCAnYnVpbGQnLCAnZ2V0X2luZm8nLCAnZ2V0X3NldHRpbmdzJywgJ2dldF9idWlsZF9zZXR0aW5ncycsXG4gICAgICAgICdvcGVuX2J1aWxkX3BhbmVsJywgJ2NoZWNrX2J1aWxkZXJfc3RhdHVzJywgJ3N0YXJ0X3ByZXZpZXcnLCAnc3RvcF9wcmV2aWV3J1xuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9uc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBsYXRmb3JtOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgcGxhdGZvcm0gZm9yIHJ1biBvciBidWlsZCcsXG4gICAgICAgICAgICAgICAgZW51bTogWydicm93c2VyJywgJ3NpbXVsYXRvcicsICdwcmV2aWV3JywgJ3dlYi1tb2JpbGUnLCAnd2ViLWRlc2t0b3AnLCAnaW9zJywgJ2FuZHJvaWQnLCAnd2luZG93cycsICdtYWMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlYnVnOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRGVidWcgYnVpbGQgKGZvciBidWlsZCBhY3Rpb24pJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2V0dGluZ3MgY2F0ZWdvcnkgZm9yIGdldF9zZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZW5lcmFsJywgJ3BoeXNpY3MnLCAncmVuZGVyJywgJ2Fzc2V0cyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdnZW5lcmFsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvcnQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZXZpZXcgc2VydmVyIHBvcnQgKGZvciBzdGFydF9wcmV2aWV3KScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogNzQ1NlxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgcnVuOiAoYXJncykgPT4gdGhpcy5ydW5Qcm9qZWN0KGFyZ3MucGxhdGZvcm0pLFxuICAgICAgICBidWlsZDogKGFyZ3MpID0+IHRoaXMuYnVpbGRQcm9qZWN0KGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKF9hcmdzKSA9PiB0aGlzLmdldFByb2plY3RJbmZvKCksXG4gICAgICAgIGdldF9zZXR0aW5nczogKGFyZ3MpID0+IHRoaXMuZ2V0UHJvamVjdFNldHRpbmdzKGFyZ3MudHlwZSksXG4gICAgICAgIGdldF9idWlsZF9zZXR0aW5nczogKF9hcmdzKSA9PiB0aGlzLmdldEJ1aWxkU2V0dGluZ3MoKSxcbiAgICAgICAgb3Blbl9idWlsZF9wYW5lbDogKF9hcmdzKSA9PiB0aGlzLm9wZW5CdWlsZFBhbmVsKCksXG4gICAgICAgIGNoZWNrX2J1aWxkZXJfc3RhdHVzOiAoX2FyZ3MpID0+IHRoaXMuY2hlY2tCdWlsZGVyU3RhdHVzKCksXG4gICAgICAgIHN0YXJ0X3ByZXZpZXc6IChhcmdzKSA9PiB0aGlzLnN0YXJ0UHJldmlld1NlcnZlcihcbiAgICAgICAgICAgIGFyZ3MucG9ydCAhPT0gdW5kZWZpbmVkID8gcGFyc2VJbnQoU3RyaW5nKGFyZ3MucG9ydCksIDEwKSA6IDc0NTZcbiAgICAgICAgKSxcbiAgICAgICAgc3RvcF9wcmV2aWV3OiAoX2FyZ3MpID0+IHRoaXMuc3RvcFByZXZpZXdTZXJ2ZXIoKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIHJ1blByb2plY3QocGxhdGZvcm06IHN0cmluZyA9ICdicm93c2VyJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogUHJldmlldyBtb2R1bGUgaXMgbm90IGRvY3VtZW50ZWQgaW4gb2ZmaWNpYWwgQVBJLlxuICAgICAgICAgICAgLy8gVXNpbmcgZmFsbGJhY2sgYXBwcm9hY2gg4oCUIG9wZW4gYnVpbGQgcGFuZWwgYXMgYWx0ZXJuYXRpdmUuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ29wZW4nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgcGxhdGZvcm0gfSwgJ0J1aWxkIHBhbmVsIG9wZW5lZC4gUHJldmlldyBmdW5jdGlvbmFsaXR5IHJlcXVpcmVzIG1hbnVhbCBzZXR1cC4nKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGJ1aWxkUHJvamVjdChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIE5vdGU6IEJ1aWxkZXIgbW9kdWxlIG9ubHkgc3VwcG9ydHMgJ29wZW4nIGFuZCAncXVlcnktd29ya2VyLXJlYWR5Jy5cbiAgICAgICAgICAgIC8vIEJ1aWxkaW5nIHJlcXVpcmVzIG1hbnVhbCBpbnRlcmFjdGlvbiB0aHJvdWdoIHRoZSBidWlsZCBwYW5lbC5cbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAnb3BlbicpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgeyBwbGF0Zm9ybTogYXJncy5wbGF0Zm9ybSwgaW5zdHJ1Y3Rpb246ICdVc2UgdGhlIGJ1aWxkIHBhbmVsIHRvIGNvbmZpZ3VyZSBhbmQgc3RhcnQgdGhlIGJ1aWxkIHByb2Nlc3MnIH0sXG4gICAgICAgICAgICAgICAgYEJ1aWxkIHBhbmVsIG9wZW5lZCBmb3IgJHthcmdzLnBsYXRmb3JtfS4gUGxlYXNlIGNvbmZpZ3VyZSBhbmQgc3RhcnQgYnVpbGQgbWFudWFsbHkuYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFByb2plY3RJbmZvKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICBuYW1lOiBFZGl0b3IuUHJvamVjdC5uYW1lLFxuICAgICAgICAgICAgcGF0aDogRWRpdG9yLlByb2plY3QucGF0aCxcbiAgICAgICAgICAgIHV1aWQ6IEVkaXRvci5Qcm9qZWN0LnV1aWQsXG4gICAgICAgICAgICB2ZXJzaW9uOiAoRWRpdG9yLlByb2plY3QgYXMgYW55KS52ZXJzaW9uIHx8ICcxLjAuMCcsXG4gICAgICAgICAgICBjb2Nvc1ZlcnNpb246IChFZGl0b3IgYXMgYW55KS52ZXJzaW9ucz8uY29jb3MgfHwgJ1Vua25vd24nXG4gICAgICAgIH07XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiAncXVlcnktaW5mbycgQVBJIGRvZXNuJ3QgZXhpc3QsIHVzaW5nICdxdWVyeS1jb25maWcnIGluc3RlYWQuXG4gICAgICAgICAgICBjb25zdCBhZGRpdGlvbmFsSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKTtcbiAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsSW5mbykgT2JqZWN0LmFzc2lnbihpbmZvLCB7IGNvbmZpZzogYWRkaXRpb25hbEluZm8gfSk7XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gUmV0dXJuIGJhc2ljIGluZm8gZXZlbiBpZiBkZXRhaWxlZCBxdWVyeSBmYWlsc1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGluZm8pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJvamVjdFNldHRpbmdzKGNhdGVnb3J5OiBzdHJpbmcgPSAnZ2VuZXJhbCcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICBnZW5lcmFsOiAncHJvamVjdCcsIHBoeXNpY3M6ICdwaHlzaWNzJywgcmVuZGVyOiAncmVuZGVyJywgYXNzZXRzOiAnYXNzZXQtZGInXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgY29uZmlnTmFtZSA9IGNvbmZpZ01hcFtjYXRlZ29yeV0gfHwgJ3Byb2plY3QnO1xuICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ05hbWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yeSwgY29uZmlnOiBzZXR0aW5ncyB9LCBgJHtjYXRlZ29yeX0gc2V0dGluZ3MgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0QnVpbGRTZXR0aW5ncygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKSBhcyBib29sZWFuO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIGJ1aWxkZXJSZWFkeTogcmVhZHksXG4gICAgICAgICAgICAgICAgYXZhaWxhYmxlQWN0aW9uczogW1xuICAgICAgICAgICAgICAgICAgICAnT3BlbiBidWlsZCBwYW5lbCB3aXRoIG9wZW5fYnVpbGRfcGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAnQ2hlY2sgYnVpbGRlciBzdGF0dXMgd2l0aCBjaGVja19idWlsZGVyX3N0YXR1cycsXG4gICAgICAgICAgICAgICAgICAgICdTdGFydCBwcmV2aWV3IHNlcnZlciB3aXRoIHN0YXJ0X3ByZXZpZXcnLFxuICAgICAgICAgICAgICAgICAgICAnU3RvcCBwcmV2aWV3IHNlcnZlciB3aXRoIHN0b3BfcHJldmlldydcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIGxpbWl0YXRpb246ICdGdWxsIGJ1aWxkIGNvbmZpZ3VyYXRpb24gcmVxdWlyZXMgZGlyZWN0IEVkaXRvciBVSSBhY2Nlc3MnXG4gICAgICAgICAgICB9LCAnQnVpbGQgc2V0dGluZ3MgYXJlIGxpbWl0ZWQgaW4gTUNQIHBsdWdpbiBlbnZpcm9ubWVudCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkJ1aWxkUGFuZWwoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ29wZW4nKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsICdCdWlsZCBwYW5lbCBvcGVuZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja0J1aWxkZXJTdGF0dXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZWFkeTogYm9vbGVhbiA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAncXVlcnktd29ya2VyLXJlYWR5JykgYXMgYm9vbGVhbjtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICByZWFkeSxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHJlYWR5ID8gJ0J1aWxkZXIgd29ya2VyIGlzIHJlYWR5JyA6ICdCdWlsZGVyIHdvcmtlciBpcyBub3QgcmVhZHknXG4gICAgICAgICAgICB9LCAnQnVpbGRlciBzdGF0dXMgY2hlY2tlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHN0YXJ0UHJldmlld1NlcnZlcihfcG9ydDogbnVtYmVyID0gNzQ1Nik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogJ1ByZXZpZXcgc2VydmVyIGNvbnRyb2wgaXMgbm90IHN1cHBvcnRlZCB0aHJvdWdoIE1DUCBBUEknLFxuICAgICAgICAgICAgaXNFcnJvcjogdHJ1ZSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1BsZWFzZSBzdGFydCB0aGUgcHJldmlldyBzZXJ2ZXIgbWFudWFsbHkgdXNpbmcgdGhlIGVkaXRvciBtZW51OiBQcm9qZWN0ID4gUHJldmlldywgb3IgdXNlIHRoZSBwcmV2aWV3IHBhbmVsIGluIHRoZSBlZGl0b3InXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzdG9wUHJldmlld1NlcnZlcigpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdQcmV2aWV3IHNlcnZlciBjb250cm9sIGlzIG5vdCBzdXBwb3J0ZWQgdGhyb3VnaCBNQ1AgQVBJJyxcbiAgICAgICAgICAgIGlzRXJyb3I6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdQbGVhc2Ugc3RvcCB0aGUgcHJldmlldyBzZXJ2ZXIgbWFudWFsbHkgdXNpbmcgdGhlIHByZXZpZXcgcGFuZWwgaW4gdGhlIGVkaXRvcidcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG59XG4iXX0=