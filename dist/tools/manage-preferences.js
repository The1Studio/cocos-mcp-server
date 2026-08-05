"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagePreferences = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManagePreferences extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_preferences';
        this.description = 'Manage editor preferences and settings. Actions: open, query, set, get_all, reset, export, import. For project settings use manage_project action=get_settings instead.';
        this.actions = [
            'open',
            'query',
            'set',
            'get_all',
            'reset',
            'export',
            'import',
        ];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action to perform',
                    enum: this.actions,
                },
                tab: {
                    type: 'string',
                    description: '[open] Preferences tab to open (optional)',
                    enum: ['general', 'external-tools', 'data-editor', 'laboratory', 'extensions'],
                },
                args: {
                    type: 'array',
                    description: '[open] Additional arguments to pass to the tab',
                },
                name: {
                    type: 'string',
                    description: '[query, set, reset] Plugin or category name',
                    default: 'general',
                },
                path: {
                    type: 'string',
                    description: '[query, set] Configuration path',
                },
                value: {
                    description: '[set] Configuration value',
                },
                type: {
                    type: 'string',
                    description: '[query, set, reset] Configuration type',
                    enum: ['default', 'global', 'local'],
                    default: 'global',
                },
                exportPath: {
                    type: 'string',
                    description: '[export] Path to export preferences file (optional)',
                },
                importPath: {
                    type: 'string',
                    description: '[import] Path to import preferences file from',
                },
            },
            required: ['action'],
        };
        this.actionHandlers = {
            open: (args) => this.openPreferencesSettings(args.tab, args.args),
            query: (args) => this.queryPreferencesConfig(args.name, args.path, args.type),
            set: (args) => this.setPreferencesConfig(args.name, args.path, args.value, args.type),
            get_all: (_args) => this.getAllPreferences(),
            reset: (args) => this.resetPreferences(args.name, args.type),
            export: (args) => this.exportPreferences(args.exportPath),
            import: (args) => this.importPreferences(args.importPath),
        };
    }
    async openPreferencesSettings(tab, extraArgs) {
        try {
            const requestArgs = [];
            if (tab)
                requestArgs.push(tab);
            if (extraArgs && extraArgs.length > 0)
                requestArgs.push(...extraArgs);
            await Editor.Message.request('preferences', 'open-settings', ...requestArgs);
            return (0, types_1.successResult)(null, `Preferences settings opened${tab ? ` on tab: ${tab}` : ''}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async queryPreferencesConfig(name, path, type = 'global') {
        try {
            const requestArgs = [name];
            if (path)
                requestArgs.push(path);
            requestArgs.push(type);
            const config = await Editor.Message.request('preferences', 'query-config', ...requestArgs);
            return (0, types_1.successResult)({ name, path, type, config });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async setPreferencesConfig(name, path, value, type = 'global') {
        try {
            const success = await Editor.Message.request('preferences', 'set-config', name, path, value, type);
            if (success)
                return (0, types_1.successResult)(null, `Preference '${name}.${path}' updated successfully`);
            return (0, types_1.errorResult)(`Failed to update preference '${name}.${path}'`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async getAllPreferences() {
        const categories = [
            'general', 'external-tools', 'data-editor', 'laboratory',
            'extensions', 'preview', 'console', 'native', 'builder'
        ];
        const preferences = {};
        const queryPromises = categories.map(category => Editor.Message.request('preferences', 'query-config', category, undefined, 'global')
            .then((config) => { preferences[category] = config; })
            .catch(() => { preferences[category] = null; }));
        try {
            await Promise.all(queryPromises);
            const validPreferences = Object.fromEntries(Object.entries(preferences).filter(([_, value]) => value !== null));
            return (0, types_1.successResult)({ categories: Object.keys(validPreferences), preferences: validPreferences });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async resetPreferences(name, type = 'global') {
        if (!name) {
            return (0, types_1.errorResult)('Resetting all preferences is not supported through API. Please specify a preference category.');
        }
        try {
            const defaultConfig = await Editor.Message.request('preferences', 'query-config', name, undefined, 'default');
            const success = await Editor.Message.request('preferences', 'set-config', name, '', defaultConfig, type);
            if (success)
                return (0, types_1.successResult)(null, `Preference category '${name}' reset to default`);
            return (0, types_1.errorResult)(`Failed to reset preference category '${name}'`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async exportPreferences(exportPath) {
        try {
            const prefsResult = await this.getAllPreferences();
            if (!prefsResult.success)
                return prefsResult;
            const prefsData = JSON.stringify(prefsResult.data, null, 2);
            const resolvedPath = exportPath || `preferences_export_${Date.now()}.json`;
            return (0, types_1.successResult)({
                exportPath: resolvedPath,
                preferences: prefsResult.data,
                jsonData: prefsData,
                message: 'Preferences exported successfully'
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message || String(err));
        }
    }
    async importPreferences(_importPath) {
        return (0, types_1.errorResult)('Import preferences functionality requires file system access which is not available in this context. Please manually import preferences through the Editor UI.');
    }
}
exports.ManagePreferences = ManagePreferences;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZlcmVuY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmZXJlbmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsaUJBQWtCLFNBQVEsaUNBQWM7SUFBckQ7O1FBQ2EsU0FBSSxHQUFHLG9CQUFvQixDQUFDO1FBQzVCLGdCQUFXLEdBQUcseUtBQXlLLENBQUM7UUFDeEwsWUFBTyxHQUFHO1lBQ2YsTUFBTTtZQUNOLE9BQU87WUFDUCxLQUFLO1lBQ0wsU0FBUztZQUNULE9BQU87WUFDUCxRQUFRO1lBQ1IsUUFBUTtTQUNYLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELEdBQUcsRUFBRTtvQkFDRCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMkNBQTJDO29CQUN4RCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUM7aUJBQ2pGO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsT0FBTztvQkFDYixXQUFXLEVBQUUsZ0RBQWdEO2lCQUNoRTtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDZDQUE2QztvQkFDMUQsT0FBTyxFQUFFLFNBQVM7aUJBQ3JCO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsaUNBQWlDO2lCQUNqRDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLDJCQUEyQjtpQkFDM0M7Z0JBQ0QsSUFBSSxFQUFFO29CQUNGLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx3Q0FBd0M7b0JBQ3JELElBQUksRUFBRSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDO29CQUNwQyxPQUFPLEVBQUUsUUFBUTtpQkFDcEI7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxxREFBcUQ7aUJBQ3JFO2dCQUNELFVBQVUsRUFBRTtvQkFDUixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsK0NBQStDO2lCQUMvRDthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDakUsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDN0UsR0FBRyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQztZQUNyRixPQUFPLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUM1QyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUM7WUFDNUQsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUN6RCxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO1NBQzVELENBQUM7SUE4Rk4sQ0FBQztJQTVGVyxLQUFLLENBQUMsdUJBQXVCLENBQUMsR0FBWSxFQUFFLFNBQWlCO1FBQ2pFLElBQUksQ0FBQztZQUNELE1BQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztZQUM5QixJQUFJLEdBQUc7Z0JBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUMvQixJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUM7Z0JBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO1lBQ3RFLE1BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLENBQUMsYUFBYSxFQUFFLGVBQWUsRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDO1lBQ3RGLE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSw4QkFBOEIsR0FBRyxDQUFDLENBQUMsQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzdGLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsc0JBQXNCLENBQUMsSUFBWSxFQUFFLElBQWEsRUFBRSxPQUFlLFFBQVE7UUFDckYsSUFBSSxDQUFDO1lBQ0QsTUFBTSxXQUFXLEdBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxJQUFJLElBQUk7Z0JBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNqQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3ZCLE1BQU0sTUFBTSxHQUFHLE1BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLENBQUMsYUFBYSxFQUFFLGNBQWMsRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDO1lBQ3BHLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUNoQixPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxJQUFJLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLG9CQUFvQixDQUFDLElBQVksRUFBRSxJQUFZLEVBQUUsS0FBVSxFQUFFLE9BQWUsUUFBUTtRQUM5RixJQUFJLENBQUM7WUFDRCxNQUFNLE9BQU8sR0FBWSxNQUFPLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBZSxDQUFDLGFBQWEsRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDckgsSUFBSSxPQUFPO2dCQUFFLE9BQU8sSUFBQSxxQkFBYSxFQUFDLElBQUksRUFBRSxlQUFlLElBQUksSUFBSSxJQUFJLHdCQUF3QixDQUFDLENBQUM7WUFDN0YsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0NBQWdDLElBQUksSUFBSSxJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCO1FBQzNCLE1BQU0sVUFBVSxHQUFHO1lBQ2YsU0FBUyxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxZQUFZO1lBQ3hELFlBQVksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTO1NBQzFELENBQUM7UUFDRixNQUFNLFdBQVcsR0FBUSxFQUFFLENBQUM7UUFDNUIsTUFBTSxhQUFhLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUM1QyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsY0FBYyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxDQUFDO2FBQy9FLElBQUksQ0FBQyxDQUFDLE1BQVcsRUFBRSxFQUFFLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUMxRCxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUN0RCxDQUFDO1FBQ0YsSUFBSSxDQUFDO1lBQ0QsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2pDLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FDdkMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUNyRSxDQUFDO1lBQ0YsT0FBTyxJQUFBLHFCQUFhLEVBQUMsRUFBRSxVQUFVLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLFdBQVcsRUFBRSxnQkFBZ0IsRUFBRSxDQUFDLENBQUM7UUFDdkcsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFhLEVBQUUsT0FBZSxRQUFRO1FBQ2pFLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNSLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtGQUErRixDQUFDLENBQUM7UUFDeEgsQ0FBQztRQUNELElBQUksQ0FBQztZQUNELE1BQU0sYUFBYSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQzlHLE1BQU0sT0FBTyxHQUFZLE1BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFlLENBQUMsYUFBYSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUMzSCxJQUFJLE9BQU87Z0JBQUUsT0FBTyxJQUFBLHFCQUFhLEVBQUMsSUFBSSxFQUFFLHdCQUF3QixJQUFJLG9CQUFvQixDQUFDLENBQUM7WUFDMUYsT0FBTyxJQUFBLG1CQUFXLEVBQUMsd0NBQXdDLElBQUksR0FBRyxDQUFDLENBQUM7UUFDeEUsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuRCxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxVQUFtQjtRQUMvQyxJQUFJLENBQUM7WUFDRCxNQUFNLFdBQVcsR0FBRyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQ25ELElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTztnQkFBRSxPQUFPLFdBQVcsQ0FBQztZQUM3QyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzVELE1BQU0sWUFBWSxHQUFHLFVBQVUsSUFBSSxzQkFBc0IsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7WUFDM0UsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLFVBQVUsRUFBRSxZQUFZO2dCQUN4QixXQUFXLEVBQUUsV0FBVyxDQUFDLElBQUk7Z0JBQzdCLFFBQVEsRUFBRSxTQUFTO2dCQUNuQixPQUFPLEVBQUUsbUNBQW1DO2FBQy9DLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsV0FBbUI7UUFDL0MsT0FBTyxJQUFBLG1CQUFXLEVBQ2QsZ0tBQWdLLENBQ25LLENBQUM7SUFDTixDQUFDO0NBQ0o7QUFsS0QsOENBa0tDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VQcmVmZXJlbmNlcyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3ByZWZlcmVuY2VzJztcclxuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBlZGl0b3IgcHJlZmVyZW5jZXMgYW5kIHNldHRpbmdzLiBBY3Rpb25zOiBvcGVuLCBxdWVyeSwgc2V0LCBnZXRfYWxsLCByZXNldCwgZXhwb3J0LCBpbXBvcnQuIEZvciBwcm9qZWN0IHNldHRpbmdzIHVzZSBtYW5hZ2VfcHJvamVjdCBhY3Rpb249Z2V0X3NldHRpbmdzIGluc3RlYWQuJztcclxuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXHJcbiAgICAgICAgJ29wZW4nLFxyXG4gICAgICAgICdxdWVyeScsXHJcbiAgICAgICAgJ3NldCcsXHJcbiAgICAgICAgJ2dldF9hbGwnLFxyXG4gICAgICAgICdyZXNldCcsXHJcbiAgICAgICAgJ2V4cG9ydCcsXHJcbiAgICAgICAgJ2ltcG9ydCcsXHJcbiAgICBdO1xyXG5cclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxyXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB0YWI6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbb3Blbl0gUHJlZmVyZW5jZXMgdGFiIHRvIG9wZW4gKG9wdGlvbmFsKScsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2dlbmVyYWwnLCAnZXh0ZXJuYWwtdG9vbHMnLCAnZGF0YS1lZGl0b3InLCAnbGFib3JhdG9yeScsICdleHRlbnNpb25zJ10sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGFyZ3M6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tvcGVuXSBBZGRpdGlvbmFsIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSB0YWInLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBuYW1lOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3F1ZXJ5LCBzZXQsIHJlc2V0XSBQbHVnaW4gb3IgY2F0ZWdvcnkgbmFtZScsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2VuZXJhbCcsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHBhdGg6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcXVlcnksIHNldF0gQ29uZmlndXJhdGlvbiBwYXRoJyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF0gQ29uZmlndXJhdGlvbiB2YWx1ZScsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHR5cGU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcXVlcnksIHNldCwgcmVzZXRdIENvbmZpZ3VyYXRpb24gdHlwZScsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlZmF1bHQnLCAnZ2xvYmFsJywgJ2xvY2FsJ10sXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2xvYmFsJyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZXhwb3J0UGF0aDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tleHBvcnRdIFBhdGggdG8gZXhwb3J0IHByZWZlcmVuY2VzIGZpbGUgKG9wdGlvbmFsKScsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGltcG9ydFBhdGg6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbaW1wb3J0XSBQYXRoIHRvIGltcG9ydCBwcmVmZXJlbmNlcyBmaWxlIGZyb20nLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ10sXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIG9wZW46IChhcmdzKSA9PiB0aGlzLm9wZW5QcmVmZXJlbmNlc1NldHRpbmdzKGFyZ3MudGFiLCBhcmdzLmFyZ3MpLFxyXG4gICAgICAgIHF1ZXJ5OiAoYXJncykgPT4gdGhpcy5xdWVyeVByZWZlcmVuY2VzQ29uZmlnKGFyZ3MubmFtZSwgYXJncy5wYXRoLCBhcmdzLnR5cGUpLFxyXG4gICAgICAgIHNldDogKGFyZ3MpID0+IHRoaXMuc2V0UHJlZmVyZW5jZXNDb25maWcoYXJncy5uYW1lLCBhcmdzLnBhdGgsIGFyZ3MudmFsdWUsIGFyZ3MudHlwZSksXHJcbiAgICAgICAgZ2V0X2FsbDogKF9hcmdzKSA9PiB0aGlzLmdldEFsbFByZWZlcmVuY2VzKCksXHJcbiAgICAgICAgcmVzZXQ6IChhcmdzKSA9PiB0aGlzLnJlc2V0UHJlZmVyZW5jZXMoYXJncy5uYW1lLCBhcmdzLnR5cGUpLFxyXG4gICAgICAgIGV4cG9ydDogKGFyZ3MpID0+IHRoaXMuZXhwb3J0UHJlZmVyZW5jZXMoYXJncy5leHBvcnRQYXRoKSxcclxuICAgICAgICBpbXBvcnQ6IChhcmdzKSA9PiB0aGlzLmltcG9ydFByZWZlcmVuY2VzKGFyZ3MuaW1wb3J0UGF0aCksXHJcbiAgICB9O1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgb3BlblByZWZlcmVuY2VzU2V0dGluZ3ModGFiPzogc3RyaW5nLCBleHRyYUFyZ3M/OiBhbnlbXSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RBcmdzOiBhbnlbXSA9IFtdO1xyXG4gICAgICAgICAgICBpZiAodGFiKSByZXF1ZXN0QXJncy5wdXNoKHRhYik7XHJcbiAgICAgICAgICAgIGlmIChleHRyYUFyZ3MgJiYgZXh0cmFBcmdzLmxlbmd0aCA+IDApIHJlcXVlc3RBcmdzLnB1c2goLi4uZXh0cmFBcmdzKTtcclxuICAgICAgICAgICAgYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgncHJlZmVyZW5jZXMnLCAnb3Blbi1zZXR0aW5ncycsIC4uLnJlcXVlc3RBcmdzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgYFByZWZlcmVuY2VzIHNldHRpbmdzIG9wZW5lZCR7dGFiID8gYCBvbiB0YWI6ICR7dGFifWAgOiAnJ31gKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHF1ZXJ5UHJlZmVyZW5jZXNDb25maWcobmFtZTogc3RyaW5nLCBwYXRoPzogc3RyaW5nLCB0eXBlOiBzdHJpbmcgPSAnZ2xvYmFsJyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RBcmdzOiBhbnlbXSA9IFtuYW1lXTtcclxuICAgICAgICAgICAgaWYgKHBhdGgpIHJlcXVlc3RBcmdzLnB1c2gocGF0aCk7XHJcbiAgICAgICAgICAgIHJlcXVlc3RBcmdzLnB1c2godHlwZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3ByZWZlcmVuY2VzJywgJ3F1ZXJ5LWNvbmZpZycsIC4uLnJlcXVlc3RBcmdzKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBuYW1lLCBwYXRoLCB0eXBlLCBjb25maWcgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRQcmVmZXJlbmNlc0NvbmZpZyhuYW1lOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgdmFsdWU6IGFueSwgdHlwZTogc3RyaW5nID0gJ2dsb2JhbCcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzOiBib29sZWFuID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgncHJlZmVyZW5jZXMnLCAnc2V0LWNvbmZpZycsIG5hbWUsIHBhdGgsIHZhbHVlLCB0eXBlKTtcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBQcmVmZXJlbmNlICcke25hbWV9LiR7cGF0aH0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCk7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIHVwZGF0ZSBwcmVmZXJlbmNlICcke25hbWV9LiR7cGF0aH0nYCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRBbGxQcmVmZXJlbmNlcygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gW1xyXG4gICAgICAgICAgICAnZ2VuZXJhbCcsICdleHRlcm5hbC10b29scycsICdkYXRhLWVkaXRvcicsICdsYWJvcmF0b3J5JyxcclxuICAgICAgICAgICAgJ2V4dGVuc2lvbnMnLCAncHJldmlldycsICdjb25zb2xlJywgJ25hdGl2ZScsICdidWlsZGVyJ1xyXG4gICAgICAgIF07XHJcbiAgICAgICAgY29uc3QgcHJlZmVyZW5jZXM6IGFueSA9IHt9O1xyXG4gICAgICAgIGNvbnN0IHF1ZXJ5UHJvbWlzZXMgPSBjYXRlZ29yaWVzLm1hcChjYXRlZ29yeSA9PlxyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBjYXRlZ29yeSwgdW5kZWZpbmVkLCAnZ2xvYmFsJylcclxuICAgICAgICAgICAgICAgIC50aGVuKChjb25maWc6IGFueSkgPT4geyBwcmVmZXJlbmNlc1tjYXRlZ29yeV0gPSBjb25maWc7IH0pXHJcbiAgICAgICAgICAgICAgICAuY2F0Y2goKCkgPT4geyBwcmVmZXJlbmNlc1tjYXRlZ29yeV0gPSBudWxsOyB9KVxyXG4gICAgICAgICk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocXVlcnlQcm9taXNlcyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkUHJlZmVyZW5jZXMgPSBPYmplY3QuZnJvbUVudHJpZXMoXHJcbiAgICAgICAgICAgICAgICBPYmplY3QuZW50cmllcyhwcmVmZXJlbmNlcykuZmlsdGVyKChbXywgdmFsdWVdKSA9PiB2YWx1ZSAhPT0gbnVsbClcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yaWVzOiBPYmplY3Qua2V5cyh2YWxpZFByZWZlcmVuY2VzKSwgcHJlZmVyZW5jZXM6IHZhbGlkUHJlZmVyZW5jZXMgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZXNldFByZWZlcmVuY2VzKG5hbWU/OiBzdHJpbmcsIHR5cGU6IHN0cmluZyA9ICdnbG9iYWwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKCFuYW1lKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnUmVzZXR0aW5nIGFsbCBwcmVmZXJlbmNlcyBpcyBub3Qgc3VwcG9ydGVkIHRocm91Z2ggQVBJLiBQbGVhc2Ugc3BlY2lmeSBhIHByZWZlcmVuY2UgY2F0ZWdvcnkuJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGRlZmF1bHRDb25maWcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBuYW1lLCB1bmRlZmluZWQsICdkZWZhdWx0Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3M6IGJvb2xlYW4gPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdzZXQtY29uZmlnJywgbmFtZSwgJycsIGRlZmF1bHRDb25maWcsIHR5cGUpO1xyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcykgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQobnVsbCwgYFByZWZlcmVuY2UgY2F0ZWdvcnkgJyR7bmFtZX0nIHJlc2V0IHRvIGRlZmF1bHRgKTtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gcmVzZXQgcHJlZmVyZW5jZSBjYXRlZ29yeSAnJHtuYW1lfSdgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydFByZWZlcmVuY2VzKGV4cG9ydFBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBwcmVmc1Jlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0QWxsUHJlZmVyZW5jZXMoKTtcclxuICAgICAgICAgICAgaWYgKCFwcmVmc1Jlc3VsdC5zdWNjZXNzKSByZXR1cm4gcHJlZnNSZXN1bHQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHByZWZzRGF0YSA9IEpTT04uc3RyaW5naWZ5KHByZWZzUmVzdWx0LmRhdGEsIG51bGwsIDIpO1xyXG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBleHBvcnRQYXRoIHx8IGBwcmVmZXJlbmNlc19leHBvcnRfJHtEYXRlLm5vdygpfS5qc29uYDtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xyXG4gICAgICAgICAgICAgICAgZXhwb3J0UGF0aDogcmVzb2x2ZWRQYXRoLFxyXG4gICAgICAgICAgICAgICAgcHJlZmVyZW5jZXM6IHByZWZzUmVzdWx0LmRhdGEsXHJcbiAgICAgICAgICAgICAgICBqc29uRGF0YTogcHJlZnNEYXRhLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZlcmVuY2VzIGV4cG9ydGVkIHN1Y2Nlc3NmdWxseSdcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBpbXBvcnRQcmVmZXJlbmNlcyhfaW1wb3J0UGF0aDogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxyXG4gICAgICAgICAgICAnSW1wb3J0IHByZWZlcmVuY2VzIGZ1bmN0aW9uYWxpdHkgcmVxdWlyZXMgZmlsZSBzeXN0ZW0gYWNjZXNzIHdoaWNoIGlzIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBjb250ZXh0LiBQbGVhc2UgbWFudWFsbHkgaW1wb3J0IHByZWZlcmVuY2VzIHRocm91Z2ggdGhlIEVkaXRvciBVSS4nXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxufVxyXG4iXX0=