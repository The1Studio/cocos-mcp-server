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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZlcmVuY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmZXJlbmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsaUJBQWtCLFNBQVEsaUNBQWM7SUFBckQ7O1FBQ2EsU0FBSSxHQUFHLG9CQUFvQixDQUFDO1FBQzVCLGdCQUFXLEdBQUcseUtBQXlLLENBQUM7UUFDeEwsWUFBTyxHQUFHO1lBQ2YsTUFBTTtZQUNOLE9BQU87WUFDUCxLQUFLO1lBQ0wsU0FBUztZQUNULE9BQU87WUFDUCxRQUFRO1lBQ1IsUUFBUTtTQUNYLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELEdBQUcsRUFBRTtvQkFDRCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMkNBQTJDO29CQUN4RCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUM7aUJBQ2pGO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsT0FBTztvQkFDYixXQUFXLEVBQUUsZ0RBQWdEO2lCQUNoRTtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDZDQUE2QztvQkFDMUQsT0FBTyxFQUFFLFNBQVM7aUJBQ3JCO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsaUNBQWlDO2lCQUNqRDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFF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LENBQUMsQ0FBQyxDQUFDO1lBQzVELE1BQU0sWUFBWSxHQUFHLFVBQVUsSUFBSSxzQkFBc0IsSUFBSSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7WUFDM0UsT0FBTyxJQUFBLHFCQUFhLEVBQUM7Z0JBQ2pCLFVBQVUsRUFBRSxZQUFZO2dCQUN4QixXQUFXLEVBQUUsV0FBVyxDQUFDLElBQUk7Z0JBQzdCLFFBQVEsRUFBRSxTQUFTO2dCQUNuQixPQUFPLEVBQUUsbUNBQW1DO2FBQy9DLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsaUJBQWlCLENBQUMsV0FBbUI7UUFDL0MsT0FBTyxJQUFBLG1CQUFXLEVBQ2QsZ0tBQWdLLENBQ25LLENBQUM7SUFDTixDQUFDO0NBQ0o7QUFsS0QsOENBa0tDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VQcmVmZXJlbmNlcyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9wcmVmZXJlbmNlcyc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGVkaXRvciBwcmVmZXJlbmNlcyBhbmQgc2V0dGluZ3MuIEFjdGlvbnM6IG9wZW4sIHF1ZXJ5LCBzZXQsIGdldF9hbGwsIHJlc2V0LCBleHBvcnQsIGltcG9ydC4gRm9yIHByb2plY3Qgc2V0dGluZ3MgdXNlIG1hbmFnZV9wcm9qZWN0IGFjdGlvbj1nZXRfc2V0dGluZ3MgaW5zdGVhZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdvcGVuJyxcbiAgICAgICAgJ3F1ZXJ5JyxcbiAgICAgICAgJ3NldCcsXG4gICAgICAgICdnZXRfYWxsJyxcbiAgICAgICAgJ3Jlc2V0JyxcbiAgICAgICAgJ2V4cG9ydCcsXG4gICAgICAgICdpbXBvcnQnLFxuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0YWI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tvcGVuXSBQcmVmZXJlbmNlcyB0YWIgdG8gb3BlbiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2dlbmVyYWwnLCAnZXh0ZXJuYWwtdG9vbHMnLCAnZGF0YS1lZGl0b3InLCAnbGFib3JhdG9yeScsICdleHRlbnNpb25zJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXJnczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbb3Blbl0gQWRkaXRpb25hbCBhcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgdGFiJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcXVlcnksIHNldCwgcmVzZXRdIFBsdWdpbiBvciBjYXRlZ29yeSBuYW1lJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2VuZXJhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3F1ZXJ5LCBzZXRdIENvbmZpZ3VyYXRpb24gcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRdIENvbmZpZ3VyYXRpb24gdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1txdWVyeSwgc2V0LCByZXNldF0gQ29uZmlndXJhdGlvbiB0eXBlJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlZmF1bHQnLCAnZ2xvYmFsJywgJ2xvY2FsJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2dsb2JhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhwb3J0UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2V4cG9ydF0gUGF0aCB0byBleHBvcnQgcHJlZmVyZW5jZXMgZmlsZSAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbXBvcnRQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbaW1wb3J0XSBQYXRoIHRvIGltcG9ydCBwcmVmZXJlbmNlcyBmaWxlIGZyb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ10sXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBvcGVuOiAoYXJncykgPT4gdGhpcy5vcGVuUHJlZmVyZW5jZXNTZXR0aW5ncyhhcmdzLnRhYiwgYXJncy5hcmdzKSxcbiAgICAgICAgcXVlcnk6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5UHJlZmVyZW5jZXNDb25maWcoYXJncy5uYW1lLCBhcmdzLnBhdGgsIGFyZ3MudHlwZSksXG4gICAgICAgIHNldDogKGFyZ3MpID0+IHRoaXMuc2V0UHJlZmVyZW5jZXNDb25maWcoYXJncy5uYW1lLCBhcmdzLnBhdGgsIGFyZ3MudmFsdWUsIGFyZ3MudHlwZSksXG4gICAgICAgIGdldF9hbGw6IChfYXJncykgPT4gdGhpcy5nZXRBbGxQcmVmZXJlbmNlcygpLFxuICAgICAgICByZXNldDogKGFyZ3MpID0+IHRoaXMucmVzZXRQcmVmZXJlbmNlcyhhcmdzLm5hbWUsIGFyZ3MudHlwZSksXG4gICAgICAgIGV4cG9ydDogKGFyZ3MpID0+IHRoaXMuZXhwb3J0UHJlZmVyZW5jZXMoYXJncy5leHBvcnRQYXRoKSxcbiAgICAgICAgaW1wb3J0OiAoYXJncykgPT4gdGhpcy5pbXBvcnRQcmVmZXJlbmNlcyhhcmdzLmltcG9ydFBhdGgpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIG9wZW5QcmVmZXJlbmNlc1NldHRpbmdzKHRhYj86IHN0cmluZywgZXh0cmFBcmdzPzogYW55W10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RBcmdzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKHRhYikgcmVxdWVzdEFyZ3MucHVzaCh0YWIpO1xuICAgICAgICAgICAgaWYgKGV4dHJhQXJncyAmJiBleHRyYUFyZ3MubGVuZ3RoID4gMCkgcmVxdWVzdEFyZ3MucHVzaCguLi5leHRyYUFyZ3MpO1xuICAgICAgICAgICAgYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgncHJlZmVyZW5jZXMnLCAnb3Blbi1zZXR0aW5ncycsIC4uLnJlcXVlc3RBcmdzKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBQcmVmZXJlbmNlcyBzZXR0aW5ncyBvcGVuZWQke3RhYiA/IGAgb24gdGFiOiAke3RhYn1gIDogJyd9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBxdWVyeVByZWZlcmVuY2VzQ29uZmlnKG5hbWU6IHN0cmluZywgcGF0aD86IHN0cmluZywgdHlwZTogc3RyaW5nID0gJ2dsb2JhbCcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlcXVlc3RBcmdzOiBhbnlbXSA9IFtuYW1lXTtcbiAgICAgICAgICAgIGlmIChwYXRoKSByZXF1ZXN0QXJncy5wdXNoKHBhdGgpO1xuICAgICAgICAgICAgcmVxdWVzdEFyZ3MucHVzaCh0eXBlKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IChFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0IGFzIGFueSkoJ3ByZWZlcmVuY2VzJywgJ3F1ZXJ5LWNvbmZpZycsIC4uLnJlcXVlc3RBcmdzKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbmFtZSwgcGF0aCwgdHlwZSwgY29uZmlnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0UHJlZmVyZW5jZXNDb25maWcobmFtZTogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnksIHR5cGU6IHN0cmluZyA9ICdnbG9iYWwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBzdWNjZXNzOiBib29sZWFuID0gYXdhaXQgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgncHJlZmVyZW5jZXMnLCAnc2V0LWNvbmZpZycsIG5hbWUsIHBhdGgsIHZhbHVlLCB0eXBlKTtcbiAgICAgICAgICAgIGlmIChzdWNjZXNzKSByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCBgUHJlZmVyZW5jZSAnJHtuYW1lfS4ke3BhdGh9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWApO1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gdXBkYXRlIHByZWZlcmVuY2UgJyR7bmFtZX0uJHtwYXRofSdgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSB8fCBTdHJpbmcoZXJyKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFsbFByZWZlcmVuY2VzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gW1xuICAgICAgICAgICAgJ2dlbmVyYWwnLCAnZXh0ZXJuYWwtdG9vbHMnLCAnZGF0YS1lZGl0b3InLCAnbGFib3JhdG9yeScsXG4gICAgICAgICAgICAnZXh0ZW5zaW9ucycsICdwcmV2aWV3JywgJ2NvbnNvbGUnLCAnbmF0aXZlJywgJ2J1aWxkZXInXG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IHByZWZlcmVuY2VzOiBhbnkgPSB7fTtcbiAgICAgICAgY29uc3QgcXVlcnlQcm9taXNlcyA9IGNhdGVnb3JpZXMubWFwKGNhdGVnb3J5ID0+XG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBjYXRlZ29yeSwgdW5kZWZpbmVkLCAnZ2xvYmFsJylcbiAgICAgICAgICAgICAgICAudGhlbigoY29uZmlnOiBhbnkpID0+IHsgcHJlZmVyZW5jZXNbY2F0ZWdvcnldID0gY29uZmlnOyB9KVxuICAgICAgICAgICAgICAgIC5jYXRjaCgoKSA9PiB7IHByZWZlcmVuY2VzW2NhdGVnb3J5XSA9IG51bGw7IH0pXG4gICAgICAgICk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChxdWVyeVByb21pc2VzKTtcbiAgICAgICAgICAgIGNvbnN0IHZhbGlkUHJlZmVyZW5jZXMgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICAgICAgICAgICAgT2JqZWN0LmVudHJpZXMocHJlZmVyZW5jZXMpLmZpbHRlcigoW18sIHZhbHVlXSkgPT4gdmFsdWUgIT09IG51bGwpXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBjYXRlZ29yaWVzOiBPYmplY3Qua2V5cyh2YWxpZFByZWZlcmVuY2VzKSwgcHJlZmVyZW5jZXM6IHZhbGlkUHJlZmVyZW5jZXMgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UgfHwgU3RyaW5nKGVycikpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZXNldFByZWZlcmVuY2VzKG5hbWU/OiBzdHJpbmcsIHR5cGU6IHN0cmluZyA9ICdnbG9iYWwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdSZXNldHRpbmcgYWxsIHByZWZlcmVuY2VzIGlzIG5vdCBzdXBwb3J0ZWQgdGhyb3VnaCBBUEkuIFBsZWFzZSBzcGVjaWZ5IGEgcHJlZmVyZW5jZSBjYXRlZ29yeS4nKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgZGVmYXVsdENvbmZpZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3ByZWZlcmVuY2VzJywgJ3F1ZXJ5LWNvbmZpZycsIG5hbWUsIHVuZGVmaW5lZCwgJ2RlZmF1bHQnKTtcbiAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3M6IGJvb2xlYW4gPSBhd2FpdCAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdzZXQtY29uZmlnJywgbmFtZSwgJycsIGRlZmF1bHRDb25maWcsIHR5cGUpO1xuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBQcmVmZXJlbmNlIGNhdGVnb3J5ICcke25hbWV9JyByZXNldCB0byBkZWZhdWx0YCk7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZXNldCBwcmVmZXJlbmNlIGNhdGVnb3J5ICcke25hbWV9J2ApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZXhwb3J0UHJlZmVyZW5jZXMoZXhwb3J0UGF0aD86IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcHJlZnNSZXN1bHQgPSBhd2FpdCB0aGlzLmdldEFsbFByZWZlcmVuY2VzKCk7XG4gICAgICAgICAgICBpZiAoIXByZWZzUmVzdWx0LnN1Y2Nlc3MpIHJldHVybiBwcmVmc1Jlc3VsdDtcbiAgICAgICAgICAgIGNvbnN0IHByZWZzRGF0YSA9IEpTT04uc3RyaW5naWZ5KHByZWZzUmVzdWx0LmRhdGEsIG51bGwsIDIpO1xuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRQYXRoID0gZXhwb3J0UGF0aCB8fCBgcHJlZmVyZW5jZXNfZXhwb3J0XyR7RGF0ZS5ub3coKX0uanNvbmA7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgZXhwb3J0UGF0aDogcmVzb2x2ZWRQYXRoLFxuICAgICAgICAgICAgICAgIHByZWZlcmVuY2VzOiBwcmVmc1Jlc3VsdC5kYXRhLFxuICAgICAgICAgICAgICAgIGpzb25EYXRhOiBwcmVmc0RhdGEsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ1ByZWZlcmVuY2VzIGV4cG9ydGVkIHN1Y2Nlc3NmdWxseSdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlIHx8IFN0cmluZyhlcnIpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaW1wb3J0UHJlZmVyZW5jZXMoX2ltcG9ydFBhdGg6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAnSW1wb3J0IHByZWZlcmVuY2VzIGZ1bmN0aW9uYWxpdHkgcmVxdWlyZXMgZmlsZSBzeXN0ZW0gYWNjZXNzIHdoaWNoIGlzIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBjb250ZXh0LiBQbGVhc2UgbWFudWFsbHkgaW1wb3J0IHByZWZlcmVuY2VzIHRocm91Z2ggdGhlIEVkaXRvciBVSS4nXG4gICAgICAgICk7XG4gICAgfVxufVxuIl19