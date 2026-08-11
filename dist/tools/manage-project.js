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
}
exports.ManageProject = ManageProject;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByb2plY3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXByb2plY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsb0NBQXdFO0FBQ3hFLHlEQUFvRDtBQUVwRDs7O0dBR0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRywyTUFBMk0sQ0FBQztRQUMxTixZQUFPLEdBQUc7WUFDZixLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsb0JBQW9CO1lBQ2hFLGtCQUFrQixFQUFFLHNCQUFzQjtTQUM3QyxDQUFDO1FBRU8sZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG1CQUFtQjtvQkFDaEMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO2lCQUNyQjtnQkFDRCxRQUFRLEVBQUU7b0JBQ04sSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGtDQUFrQztvQkFDL0MsSUFBSSxFQUFFLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUM7aUJBQzdHO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsU0FBUztvQkFDZixXQUFXLEVBQUUsZ0NBQWdDO29CQUM3QyxPQUFPLEVBQUUsSUFBSTtpQkFDaEI7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvQ0FBb0M7b0JBQ2pELElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQztvQkFDaEQsT0FBTyxFQUFFLFNBQVM7aUJBQ3JCO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVRLG1CQUFjLEdBQTZFO1lBQ2pHLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQzdDLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7WUFDeEMsUUFBUSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQzFDLFlBQVksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDMUQsa0JBQWtCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUN0RCxnQkFBZ0IsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtZQUNsRCxvQkFBb0IsRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLGtCQUFrQixFQUFFO1NBQzdELENBQUM7SUErRk4sQ0FBQztJQTdGVyxLQUFLLENBQUMsVUFBVSxDQUFDLFdBQW1CLFNBQVM7UUFDakQsSUFBSSxDQUFDO1lBQ0QsMERBQTBEO1lBQzFELDZEQUE2RDtZQUM3RCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNoRCxPQUFPLElBQUEscUJBQWEsRUFBQyxFQUFFLFFBQVEsRUFBRSxFQUFFLGtFQUFrRSxDQUFDLENBQUM7UUFDM0csQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBUztRQUNoQyxJQUFJLENBQUM7WUFDRCxzRUFBc0U7WUFDdEUsZ0VBQWdFO1lBQ2hFLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ2hELE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSw4REFBOEQsRUFBRSxFQUN4RywwQkFBMEIsSUFBSSxDQUFDLFFBQVEsOENBQThDLENBQ3hGLENBQUM7UUFDTixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGNBQWM7O1FBQ3hCLE1BQU0sSUFBSSxHQUFRO1lBQ2QsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSTtZQUN6QixJQUFJLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJO1lBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUk7WUFDekIsT0FBTyxFQUFHLE1BQU0sQ0FBQyxPQUFlLENBQUMsT0FBTyxJQUFJLE9BQU87WUFDbkQsWUFBWSxFQUFFLENBQUEsTUFBQyxNQUFjLENBQUMsUUFBUSwwQ0FBRSxLQUFLLEtBQUksU0FBUztTQUM3RCxDQUFDO1FBQ0YsSUFBSSxDQUFDO1lBQ0Qsc0VBQXNFO1lBQ3RFLE1BQU0sY0FBYyxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUMxRixJQUFJLGNBQWM7Z0JBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQUMsV0FBTSxDQUFDO1lBQ0wsaURBQWlEO1FBQ3JELENBQUM7UUFDRCxPQUFPLElBQUEscUJBQWEsRUFBQyxJQUFJLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRU8sS0FBSyxDQUFDLGtCQUFrQixDQUFDLFdBQW1CLFNBQVM7UUFDekQsSUFBSSxDQUFDO1lBQ0QsTUFBTSxTQUFTLEdBQTJCO2dCQUN0QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsVUFBVTthQUMvRSxDQUFDO1lBQ0YsTUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLFNBQVMsQ0FBQztZQUNwRCxNQUFNLFFBQVEsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxjQUFjLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDckYsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxFQUFFLEdBQUcsUUFBUSxrQ0FBa0MsQ0FBQyxDQUFDO1FBQ3hHLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsZ0JBQWdCO1FBQzFCLElBQUksQ0FBQztZQUNELE1BQU0sS0FBSyxHQUFZLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFZLENBQUM7WUFDaEcsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLFlBQVksRUFBRSxLQUFLO2dCQUNuQixnQkFBZ0IsRUFBRTtvQkFDZCx3Q0FBd0M7b0JBQ3hDLGdEQUFnRDtpQkFDbkQ7Z0JBQ0QsVUFBVSxFQUFFLDJEQUEyRDthQUMxRSxFQUFFLHNEQUFzRCxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxjQUFjO1FBQ3hCLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ2hELE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCO1FBQzVCLElBQUksQ0FBQztZQUNELE1BQU0sS0FBSyxHQUFZLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLG9CQUFvQixDQUFZLENBQUM7WUFDaEcsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLEtBQUs7Z0JBQ0wsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLDZCQUE2QjthQUM1RSxFQUFFLHFDQUFxQyxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztDQUVKO0FBM0lELHNDQTJJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuXG4vKipcbiAqIENvbnNvbGlkYXRlZCBwcm9qZWN0IG1hbmFnZW1lbnQgdG9vbC5cbiAqIENvdmVycyBidWlsZCwgcnVuLCBwcmV2aWV3LCBhbmQgc2V0dGluZ3MgZnJvbSBQcm9qZWN0VG9vbHMgKG5vbi1hc3NldCBtZXRob2RzKS5cbiAqL1xuZXhwb3J0IGNsYXNzIE1hbmFnZVByb2plY3QgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcHJvamVjdCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIHByb2plY3QgYnVpbGQsIHJ1biwgcHJldmlldywgYW5kIHNldHRpbmdzLiBBY3Rpb25zOiBydW4sIGJ1aWxkLCBnZXRfaW5mbywgZ2V0X3NldHRpbmdzLCBnZXRfYnVpbGRfc2V0dGluZ3MsIG9wZW5fYnVpbGRfcGFuZWwsIGNoZWNrX2J1aWxkZXJfc3RhdHVzLiBGb3IgYXNzZXQgb3BlcmF0aW9ucyB1c2UgbWFuYWdlX2Fzc2V0IGluc3RlYWQuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xuICAgICAgICAncnVuJywgJ2J1aWxkJywgJ2dldF9pbmZvJywgJ2dldF9zZXR0aW5ncycsICdnZXRfYnVpbGRfc2V0dGluZ3MnLFxuICAgICAgICAnb3Blbl9idWlsZF9wYW5lbCcsICdjaGVja19idWlsZGVyX3N0YXR1cydcbiAgICBdO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJyxcbiAgICAgICAgICAgICAgICBlbnVtOiB0aGlzLmFjdGlvbnNcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwbGF0Zm9ybToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVGFyZ2V0IHBsYXRmb3JtIGZvciBydW4gb3IgYnVpbGQnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnYnJvd3NlcicsICdzaW11bGF0b3InLCAncHJldmlldycsICd3ZWItbW9iaWxlJywgJ3dlYi1kZXNrdG9wJywgJ2lvcycsICdhbmRyb2lkJywgJ3dpbmRvd3MnLCAnbWFjJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBkZWJ1Zzoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0RlYnVnIGJ1aWxkIChmb3IgYnVpbGQgYWN0aW9uKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1NldHRpbmdzIGNhdGVnb3J5IGZvciBnZXRfc2V0dGluZ3MnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2VuZXJhbCcsICdwaHlzaWNzJywgJ3JlbmRlcicsICdhc3NldHMnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2VuZXJhbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIHJ1bjogKGFyZ3MpID0+IHRoaXMucnVuUHJvamVjdChhcmdzLnBsYXRmb3JtKSxcbiAgICAgICAgYnVpbGQ6IChhcmdzKSA9PiB0aGlzLmJ1aWxkUHJvamVjdChhcmdzKSxcbiAgICAgICAgZ2V0X2luZm86IChfYXJncykgPT4gdGhpcy5nZXRQcm9qZWN0SW5mbygpLFxuICAgICAgICBnZXRfc2V0dGluZ3M6IChhcmdzKSA9PiB0aGlzLmdldFByb2plY3RTZXR0aW5ncyhhcmdzLnR5cGUpLFxuICAgICAgICBnZXRfYnVpbGRfc2V0dGluZ3M6IChfYXJncykgPT4gdGhpcy5nZXRCdWlsZFNldHRpbmdzKCksXG4gICAgICAgIG9wZW5fYnVpbGRfcGFuZWw6IChfYXJncykgPT4gdGhpcy5vcGVuQnVpbGRQYW5lbCgpLFxuICAgICAgICBjaGVja19idWlsZGVyX3N0YXR1czogKF9hcmdzKSA9PiB0aGlzLmNoZWNrQnVpbGRlclN0YXR1cygpXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgcnVuUHJvamVjdChwbGF0Zm9ybTogc3RyaW5nID0gJ2Jyb3dzZXInKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBOb3RlOiBQcmV2aWV3IG1vZHVsZSBpcyBub3QgZG9jdW1lbnRlZCBpbiBvZmZpY2lhbCBBUEkuXG4gICAgICAgICAgICAvLyBVc2luZyBmYWxsYmFjayBhcHByb2FjaCDigJQgb3BlbiBidWlsZCBwYW5lbCBhcyBhbHRlcm5hdGl2ZS5cbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAnb3BlbicpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBwbGF0Zm9ybSB9LCAnQnVpbGQgcGFuZWwgb3BlbmVkLiBQcmV2aWV3IGZ1bmN0aW9uYWxpdHkgcmVxdWlyZXMgbWFudWFsIHNldHVwLicpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgYnVpbGRQcm9qZWN0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gTm90ZTogQnVpbGRlciBtb2R1bGUgb25seSBzdXBwb3J0cyAnb3BlbicgYW5kICdxdWVyeS13b3JrZXItcmVhZHknLlxuICAgICAgICAgICAgLy8gQnVpbGRpbmcgcmVxdWlyZXMgbWFudWFsIGludGVyYWN0aW9uIHRocm91Z2ggdGhlIGJ1aWxkIHBhbmVsLlxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdvcGVuJyk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICB7IHBsYXRmb3JtOiBhcmdzLnBsYXRmb3JtLCBpbnN0cnVjdGlvbjogJ1VzZSB0aGUgYnVpbGQgcGFuZWwgdG8gY29uZmlndXJlIGFuZCBzdGFydCB0aGUgYnVpbGQgcHJvY2VzcycgfSxcbiAgICAgICAgICAgICAgICBgQnVpbGQgcGFuZWwgb3BlbmVkIGZvciAke2FyZ3MucGxhdGZvcm19LiBQbGVhc2UgY29uZmlndXJlIGFuZCBzdGFydCBidWlsZCBtYW51YWxseS5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UHJvamVjdEluZm8oKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGluZm86IGFueSA9IHtcbiAgICAgICAgICAgIG5hbWU6IEVkaXRvci5Qcm9qZWN0Lm5hbWUsXG4gICAgICAgICAgICBwYXRoOiBFZGl0b3IuUHJvamVjdC5wYXRoLFxuICAgICAgICAgICAgdXVpZDogRWRpdG9yLlByb2plY3QudXVpZCxcbiAgICAgICAgICAgIHZlcnNpb246IChFZGl0b3IuUHJvamVjdCBhcyBhbnkpLnZlcnNpb24gfHwgJzEuMC4wJyxcbiAgICAgICAgICAgIGNvY29zVmVyc2lvbjogKEVkaXRvciBhcyBhbnkpLnZlcnNpb25zPy5jb2NvcyB8fCAnVW5rbm93bidcbiAgICAgICAgfTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIE5vdGU6ICdxdWVyeS1pbmZvJyBBUEkgZG9lc24ndCBleGlzdCwgdXNpbmcgJ3F1ZXJ5LWNvbmZpZycgaW5zdGVhZC5cbiAgICAgICAgICAgIGNvbnN0IGFkZGl0aW9uYWxJbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpO1xuICAgICAgICAgICAgaWYgKGFkZGl0aW9uYWxJbmZvKSBPYmplY3QuYXNzaWduKGluZm8sIHsgY29uZmlnOiBhZGRpdGlvbmFsSW5mbyB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAvLyBSZXR1cm4gYmFzaWMgaW5mbyBldmVuIGlmIGRldGFpbGVkIHF1ZXJ5IGZhaWxzXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRQcm9qZWN0U2V0dGluZ3MoY2F0ZWdvcnk6IHN0cmluZyA9ICdnZW5lcmFsJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICAgICAgICAgICAgIGdlbmVyYWw6ICdwcm9qZWN0JywgcGh5c2ljczogJ3BoeXNpY3MnLCByZW5kZXI6ICdyZW5kZXInLCBhc3NldHM6ICdhc3NldC1kYidcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBjb25maWdOYW1lID0gY29uZmlnTWFwW2NhdGVnb3J5XSB8fCAncHJvamVjdCc7XG4gICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgY29uZmlnTmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGNhdGVnb3J5LCBjb25maWc6IHNldHRpbmdzIH0sIGAke2NhdGVnb3J5fSBzZXR0aW5ncyByZXRyaWV2ZWQgc3VjY2Vzc2Z1bGx5YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRCdWlsZFNldHRpbmdzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVhZHk6IGJvb2xlYW4gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdidWlsZGVyJywgJ3F1ZXJ5LXdvcmtlci1yZWFkeScpIGFzIGJvb2xlYW47XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgYnVpbGRlclJlYWR5OiByZWFkeSxcbiAgICAgICAgICAgICAgICBhdmFpbGFibGVBY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgICAgICdPcGVuIGJ1aWxkIHBhbmVsIHdpdGggb3Blbl9idWlsZF9wYW5lbCcsXG4gICAgICAgICAgICAgICAgICAgICdDaGVjayBidWlsZGVyIHN0YXR1cyB3aXRoIGNoZWNrX2J1aWxkZXJfc3RhdHVzJ1xuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgbGltaXRhdGlvbjogJ0Z1bGwgYnVpbGQgY29uZmlndXJhdGlvbiByZXF1aXJlcyBkaXJlY3QgRWRpdG9yIFVJIGFjY2VzcydcbiAgICAgICAgICAgIH0sICdCdWlsZCBzZXR0aW5ncyBhcmUgbGltaXRlZCBpbiBNQ1AgcGx1Z2luIGVudmlyb25tZW50Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBvcGVuQnVpbGRQYW5lbCgpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2J1aWxkZXInLCAnb3BlbicpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgJ0J1aWxkIHBhbmVsIG9wZW5lZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNoZWNrQnVpbGRlclN0YXR1cygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYnVpbGRlcicsICdxdWVyeS13b3JrZXItcmVhZHknKSBhcyBib29sZWFuO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHJlYWR5LFxuICAgICAgICAgICAgICAgIHN0YXR1czogcmVhZHkgPyAnQnVpbGRlciB3b3JrZXIgaXMgcmVhZHknIDogJ0J1aWxkZXIgd29ya2VyIGlzIG5vdCByZWFkeSdcbiAgICAgICAgICAgIH0sICdCdWlsZGVyIHN0YXR1cyBjaGVja2VkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxufVxuIl19