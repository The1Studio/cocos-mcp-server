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
        return new Promise((resolve) => {
            // Note: Preview module is not documented in official API.
            // Using fallback approach — open build panel as alternative.
            Editor.Message.request('builder', 'open').then(() => {
                resolve((0, types_1.successResult)({ platform }, `Build panel opened. Preview functionality requires manual setup.`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async buildProject(args) {
        const debug = args.debug !== false && args.debug !== 'false';
        return new Promise((resolve) => {
            // Note: Builder module only supports 'open' and 'query-worker-ready'.
            // Building requires manual interaction through the build panel.
            Editor.Message.request('builder', 'open').then(() => {
                resolve((0, types_1.successResult)({
                    platform: args.platform,
                    instruction: 'Use the build panel to configure and start the build process'
                }, `Build panel opened for ${args.platform}. Please configure and start build manually.`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getProjectInfo() {
        return new Promise((resolve) => {
            var _a;
            const info = {
                name: Editor.Project.name,
                path: Editor.Project.path,
                uuid: Editor.Project.uuid,
                version: Editor.Project.version || '1.0.0',
                cocosVersion: ((_a = Editor.versions) === null || _a === void 0 ? void 0 : _a.cocos) || 'Unknown'
            };
            // Note: 'query-info' API doesn't exist, using 'query-config' instead.
            Editor.Message.request('project', 'query-config', 'project').then((additionalInfo) => {
                if (additionalInfo) {
                    Object.assign(info, { config: additionalInfo });
                }
                resolve((0, types_1.successResult)(info));
            }).catch(() => {
                // Return basic info even if detailed query fails
                resolve((0, types_1.successResult)(info));
            });
        });
    }
    async getProjectSettings(category = 'general') {
        return new Promise((resolve) => {
            const configMap = {
                general: 'project',
                physics: 'physics',
                render: 'render',
                assets: 'asset-db'
            };
            const configName = configMap[category] || 'project';
            Editor.Message.request('project', 'query-config', configName).then((settings) => {
                resolve((0, types_1.successResult)({
                    category,
                    config: settings
                }, `${category} settings retrieved successfully`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getBuildSettings() {
        return new Promise((resolve) => {
            Editor.Message.request('builder', 'query-worker-ready').then((ready) => {
                resolve((0, types_1.successResult)({
                    builderReady: ready,
                    availableActions: [
                        'Open build panel with open_build_panel',
                        'Check builder status with check_builder_status',
                        'Start preview server with start_preview',
                        'Stop preview server with stop_preview'
                    ],
                    limitation: 'Full build configuration requires direct Editor UI access'
                }, 'Build settings are limited in MCP plugin environment'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async openBuildPanel() {
        return new Promise((resolve) => {
            Editor.Message.request('builder', 'open').then(() => {
                resolve((0, types_1.successResult)(null, 'Build panel opened successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async checkBuilderStatus() {
        return new Promise((resolve) => {
            Editor.Message.request('builder', 'query-worker-ready').then((ready) => {
                resolve((0, types_1.successResult)({
                    ready,
                    status: ready ? 'Builder worker is ready' : 'Builder worker is not ready'
                }, 'Builder status checked successfully'));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByb2plY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXByb2plY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsb0NBQXdFO0FBQ3hFLHlEQUFvRDtBQUVwRDs7O0dBR0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRyx3T0FBd08sQ0FBQztRQUN2UCxZQUFPLEdBQUc7WUFDZixLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsb0JBQW9CO1lBQ2hFLGtCQUFrQixFQUFFLHNCQUFzQixFQUFFLGVBQWUsRUFBRSxjQUFjO1NBQzlFLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsa0NBQWtDO29CQUMvQyxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQztpQkFDN0c7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxTQUFTO29CQUNmLFdBQVcsRUFBRSxnQ0FBZ0M7b0JBQzdDLE9BQU8sRUFBRSxJQUFJO2lCQUNoQjtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG9DQUFvQztvQkFDakQsSUFBSSxFQUFFLENBQUMsU0FBUyxFQUFFLFNBQVMs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SyxDQUFDLENBQUMsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsNkJBQTZCO2lCQUM1RSxFQUFFLHFDQUFxQyxDQUFDLENBQUMsQ0FBQztZQUMvQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFVLEVBQUUsRUFBRTtnQkFDcEIsT0FBTyxDQUFDLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxRQUFnQixJQUFJO1FBQ2pELE9BQU87WUFDSCxPQUFPLEVBQUUsS0FBSztZQUNkLEtBQUssRUFBRSx5REFBeUQ7WUFDaEUsT0FBTyxFQUFFLElBQUk7WUFDYixJQUFJLEVBQUU7Z0JBQ0YsV0FBVyxFQUFFLDJIQUEySDthQUMzSTtTQUNKLENBQUM7SUFDTixDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQjtRQUMzQixPQUFPO1lBQ0gsT0FBTyxFQUFFLEtBQUs7WUFDZCxLQUFLLEVBQUUseURBQXlEO1lBQ2hFLE9BQU8sRUFBRSxJQUFJO1lBQ2IsSUFBSSxFQUFFO2dCQUNGLFdBQVcsRUFBRSwrRUFBK0U7YUFDL0Y7U0FDSixDQUFDO0lBQ04sQ0FBQztDQUNKO0FBdE1ELHNDQXNNQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBwcm9qZWN0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvdmVycyBidWlsZCwgcnVuLCBwcmV2aWV3LCBhbmQgc2V0dGluZ3MgZnJvbSBQcm9qZWN0VG9vbHMgKG5vbi1hc3NldCBtZXRob2RzKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZVByb2plY3QgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJvamVjdCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByb2plY3QgYnVpbGQsIHJ1biwgcHJldmlldywgYW5kIHNldHRpbmdzLiBBY3Rpb25zOiBydW4sIGJ1aWxkLCBnZXRfaW5mbywgZ2V0X3NldHRpbmdzLCBnZXRfYnVpbGRfc2V0dGluZ3MsIG9wZW5fYnVpbGRfcGFuZWwsIGNoZWNrX2J1aWxkZXJfc3RhdHVzLCBzdGFydF9wcmV2aWV3LCBzdG9wX3ByZXZpZXcuIEZvciBhc3NldCBvcGVyYXRpb25zIHVzZSBtYW5hZ2VfYXNzZXQgaW5zdGVhZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdydW4nLCAnYnVpbGQnLCAnZ2V0X2luZm8nLCAnZ2V0X3NldHRpbmdzJywgJ2dldF9idWlsZF9zZXR0aW5ncycsXG4gICAgICAgICdvcGVuX2J1aWxkX3BhbmVsJywgJ2NoZWNrX2J1aWxkZXJfc3RhdHVzJywgJ3N0YXJ0X3ByZXZpZXcnLCAnc3RvcF9wcmV2aWV3J1xuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9uc1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBsYXRmb3JtOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUYXJnZXQgcGxhdGZvcm0gZm9yIHJ1biBvciBidWlsZCcsXG4gICAgICAgICAgICAgICAgZW51bTogWydicm93c2VyJywgJ3NpbXVsYXRvcicsICdwcmV2aWV3JywgJ3dlYi1tb2JpbGUnLCAnd2ViLWRlc2t0b3AnLCAnaW9zJywgJ2FuZHJvaWQnLCAnd2luZG93cycsICdtYWMnXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlYnVnOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRGVidWcgYnVpbGQgKGZvciBidWlsZCBhY3Rpb24pJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU2V0dGluZ3MgY2F0ZWdvcnkgZm9yIGdldF9zZXR0aW5ncycsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZW5lcmFsJywgJ3BoeXNpY3MnLCAncmVuZGVyJywgJ2Fzc2V0cyddLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdnZW5lcmFsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvcnQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZXZpZXcgc2VydmVyIHBvcnQgKGZvciBzdGFydF9wcmV2aWV3KScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogNzQ1NlxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgcnVuOiAoYXJncykgPT4gdGhpcy5ydW5Qcm9qZWN0KGFyZ3MucGxhdGZvcm0pLFxuICAgICAgICBidWlsZDogKGFyZ3MpID0+IHRoaXMuYnVpbGRQcm9qZWN0KGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKF9hcmdzKSA9PiB0aGlzLmdldFByb2plY3RJbmZvKCksXG4gICAgICAgIGdldF9zZXR0aW5nczogKGFyZ3MpID0+IHRoaXMuZ2V0UHJvamVjdFNldHRpbmdzKGFyZ3MudHlwZSksXG4gICAgICAgIGdldF9idWlsZF9zZXR0aW5nczogKF9hcmdzKSA9PiB0aGlzLmdldEJ1aWxkU2V0dGluZ3MoKSxcbiAgICAgICAgb3Blbl9idWlsZF9wYW5lbDogKF9hcmdzKSA9PiB0aGlzLm9wZW5CdWlsZFBhbmVsKCksXG4gICAgICAgIGNoZWNrX2J1aWxkZXJfc3RhdHVzOiAoX2FyZ3MpID0+IHRoaXMuY2hlY2tCdWlsZGVyU3RhdHVzKCksXG4gICAgICAgIHN0YXJ0X3ByZXZpZXc6IChhcmdzKSA9PiB0aGlzLnN0YXJ0UHJldmlld1NlcnZlcihcbiAgICAgICAgICAgIGFyZ3MucG9ydCAhPT0gdW5kZWZpbmVkID8gcGFyc2VJbnQoU3RyaW5nKGFyZ3MucG9ydCksIDEwKSA6IDc0NTZcbiAgICAgICAgKSxcbiAgICAgICAgc3RvcF9wcmV2aWV3OiAoX2FyZ3MpID0+IHRoaXMuc3RvcFByZXZpZXdTZXJ2ZXIoKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIHJ1blByb2plY3QocGxhdGZvcm06IHN0cmluZyA9ICdicm93c2VyJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIC8vIE5vdGU6IFByZXZpZXcgbW9kdWxlIGlzIG5vdCBkb2N1bWVudGVkIGluIG9mZmljaWFsIEFQSS5cbiAgICAgICAgICAgIC8vIFVzaW5nIGZhbGxiYWNrIGFwcHJvYWNoIOKAlCBvcGVuIGJ1aWxkIHBhbmVsIGFzIGFsdGVybmF0aXZlLlxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdvcGVuJykudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IHBsYXRmb3JtIH0sXG4gICAgICAgICAgICAgICAgICAgIGBCdWlsZCBwYW5lbCBvcGVuZWQuIFByZXZpZXcgZnVuY3Rpb25hbGl0eSByZXF1aXJlcyBtYW51YWwgc2V0dXAuYFxuICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBidWlsZFByb2plY3QoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGRlYnVnOiBib29sZWFuID0gYXJncy5kZWJ1ZyAhPT0gZmFsc2UgJiYgYXJncy5kZWJ1ZyAhPT0gJ2ZhbHNlJztcblxuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIC8vIE5vdGU6IEJ1aWxkZXIgbW9kdWxlIG9ubHkgc3VwcG9ydHMgJ29wZW4nIGFuZCAncXVlcnktd29ya2VyLXJlYWR5Jy5cbiAgICAgICAgICAgIC8vIEJ1aWxkaW5nIHJlcXVpcmVzIG1hbnVhbCBpbnRlcmFjdGlvbiB0aHJvdWdoIHRoZSBidWlsZCBwYW5lbC5cbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAnb3BlbicpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhdGZvcm06IGFyZ3MucGxhdGZvcm0sXG4gICAgICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbjogJ1VzZSB0aGUgYnVpbGQgcGFuZWwgdG8gY29uZmlndXJlIGFuZCBzdGFydCB0aGUgYnVpbGQgcHJvY2VzcydcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgYEJ1aWxkIHBhbmVsIG9wZW5lZCBmb3IgJHthcmdzLnBsYXRmb3JtfS4gUGxlYXNlIGNvbmZpZ3VyZSBhbmQgc3RhcnQgYnVpbGQgbWFudWFsbHkuYFxuICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcm9qZWN0SW5mbygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbmZvOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgbmFtZTogRWRpdG9yLlByb2plY3QubmFtZSxcbiAgICAgICAgICAgICAgICBwYXRoOiBFZGl0b3IuUHJvamVjdC5wYXRoLFxuICAgICAgICAgICAgICAgIHV1aWQ6IEVkaXRvci5Qcm9qZWN0LnV1aWQsXG4gICAgICAgICAgICAgICAgdmVyc2lvbjogKEVkaXRvci5Qcm9qZWN0IGFzIGFueSkudmVyc2lvbiB8fCAnMS4wLjAnLFxuICAgICAgICAgICAgICAgIGNvY29zVmVyc2lvbjogKEVkaXRvciBhcyBhbnkpLnZlcnNpb25zPy5jb2NvcyB8fCAnVW5rbm93bidcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIC8vIE5vdGU6ICdxdWVyeS1pbmZvJyBBUEkgZG9lc24ndCBleGlzdCwgdXNpbmcgJ3F1ZXJ5LWNvbmZpZycgaW5zdGVhZC5cbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKS50aGVuKChhZGRpdGlvbmFsSW5mbzogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGFkZGl0aW9uYWxJbmZvKSB7XG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oaW5mbywgeyBjb25maWc6IGFkZGl0aW9uYWxJbmZvIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoaW5mbykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFJldHVybiBiYXNpYyBpbmZvIGV2ZW4gaWYgZGV0YWlsZWQgcXVlcnkgZmFpbHNcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoaW5mbykpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJvamVjdFNldHRpbmdzKGNhdGVnb3J5OiBzdHJpbmcgPSAnZ2VuZXJhbCcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb25maWdNYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICAgICAgZ2VuZXJhbDogJ3Byb2plY3QnLFxuICAgICAgICAgICAgICAgIHBoeXNpY3M6ICdwaHlzaWNzJyxcbiAgICAgICAgICAgICAgICByZW5kZXI6ICdyZW5kZXInLFxuICAgICAgICAgICAgICAgIGFzc2V0czogJ2Fzc2V0LWRiJ1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgY29uZmlnTmFtZSA9IGNvbmZpZ01hcFtjYXRlZ29yeV0gfHwgJ3Byb2plY3QnO1xuXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3F1ZXJ5LWNvbmZpZycsIGNvbmZpZ05hbWUpLnRoZW4oKHNldHRpbmdzOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICAgICAgY29uZmlnOiBzZXR0aW5nc1xuICAgICAgICAgICAgICAgIH0sIGAke2NhdGVnb3J5fSBzZXR0aW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5YCkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRCdWlsZFNldHRpbmdzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAncXVlcnktd29ya2VyLXJlYWR5JykudGhlbigocmVhZHk6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBidWlsZGVyUmVhZHk6IHJlYWR5LFxuICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVBY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAnT3BlbiBidWlsZCBwYW5lbCB3aXRoIG9wZW5fYnVpbGRfcGFuZWwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0NoZWNrIGJ1aWxkZXIgc3RhdHVzIHdpdGggY2hlY2tfYnVpbGRlcl9zdGF0dXMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1N0YXJ0IHByZXZpZXcgc2VydmVyIHdpdGggc3RhcnRfcHJldmlldycsXG4gICAgICAgICAgICAgICAgICAgICAgICAnU3RvcCBwcmV2aWV3IHNlcnZlciB3aXRoIHN0b3BfcHJldmlldydcbiAgICAgICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICAgICAgbGltaXRhdGlvbjogJ0Z1bGwgYnVpbGQgY29uZmlndXJhdGlvbiByZXF1aXJlcyBkaXJlY3QgRWRpdG9yIFVJIGFjY2VzcydcbiAgICAgICAgICAgICAgICB9LCAnQnVpbGQgc2V0dGluZ3MgYXJlIGxpbWl0ZWQgaW4gTUNQIHBsdWdpbiBlbnZpcm9ubWVudCcpKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgb3BlbkJ1aWxkUGFuZWwoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdvcGVuJykudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsICdCdWlsZCBwYW5lbCBvcGVuZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBjaGVja0J1aWxkZXJTdGF0dXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKS50aGVuKChyZWFkeTogYm9vbGVhbikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIHJlYWR5LFxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IHJlYWR5ID8gJ0J1aWxkZXIgd29ya2VyIGlzIHJlYWR5JyA6ICdCdWlsZGVyIHdvcmtlciBpcyBub3QgcmVhZHknXG4gICAgICAgICAgICAgICAgfSwgJ0J1aWxkZXIgc3RhdHVzIGNoZWNrZWQgc3VjY2Vzc2Z1bGx5JykpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzdGFydFByZXZpZXdTZXJ2ZXIoX3BvcnQ6IG51bWJlciA9IDc0NTYpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgZXJyb3I6ICdQcmV2aWV3IHNlcnZlciBjb250cm9sIGlzIG5vdCBzdXBwb3J0ZWQgdGhyb3VnaCBNQ1AgQVBJJyxcbiAgICAgICAgICAgIGlzRXJyb3I6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdQbGVhc2Ugc3RhcnQgdGhlIHByZXZpZXcgc2VydmVyIG1hbnVhbGx5IHVzaW5nIHRoZSBlZGl0b3IgbWVudTogUHJvamVjdCA+IFByZXZpZXcsIG9yIHVzZSB0aGUgcHJldmlldyBwYW5lbCBpbiB0aGUgZWRpdG9yJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc3RvcFByZXZpZXdTZXJ2ZXIoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIGVycm9yOiAnUHJldmlldyBzZXJ2ZXIgY29udHJvbCBpcyBub3Qgc3VwcG9ydGVkIHRocm91Z2ggTUNQIEFQSScsXG4gICAgICAgICAgICBpc0Vycm9yOiB0cnVlLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIGluc3RydWN0aW9uOiAnUGxlYXNlIHN0b3AgdGhlIHByZXZpZXcgc2VydmVyIG1hbnVhbGx5IHVzaW5nIHRoZSBwcmV2aWV3IHBhbmVsIGluIHRoZSBlZGl0b3InXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxufVxuIl19