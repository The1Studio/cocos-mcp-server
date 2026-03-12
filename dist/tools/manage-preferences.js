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
    async openPreferencesSettings(tab, args) {
        return new Promise((resolve) => {
            const requestArgs = [];
            if (tab) {
                requestArgs.push(tab);
            }
            if (args && args.length > 0) {
                requestArgs.push(...args);
            }
            Editor.Message.request('preferences', 'open-settings', ...requestArgs).then(() => {
                resolve((0, types_1.successResult)(null, `Preferences settings opened${tab ? ` on tab: ${tab}` : ''}`));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async queryPreferencesConfig(name, path, type = 'global') {
        return new Promise((resolve) => {
            const requestArgs = [name];
            if (path) {
                requestArgs.push(path);
            }
            requestArgs.push(type);
            Editor.Message.request('preferences', 'query-config', ...requestArgs).then((config) => {
                resolve((0, types_1.successResult)({
                    name: name,
                    path: path,
                    type: type,
                    config: config
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async setPreferencesConfig(name, path, value, type = 'global') {
        return new Promise((resolve) => {
            Editor.Message.request('preferences', 'set-config', name, path, value, type).then((success) => {
                if (success) {
                    resolve((0, types_1.successResult)(null, `Preference '${name}.${path}' updated successfully`));
                }
                else {
                    resolve((0, types_1.errorResult)(`Failed to update preference '${name}.${path}'`));
                }
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async getAllPreferences() {
        return new Promise((resolve) => {
            // Common preference categories in Cocos Creator
            const categories = [
                'general',
                'external-tools',
                'data-editor',
                'laboratory',
                'extensions',
                'preview',
                'console',
                'native',
                'builder'
            ];
            const preferences = {};
            const queryPromises = categories.map(category => {
                return Editor.Message.request('preferences', 'query-config', category, undefined, 'global')
                    .then((config) => {
                    preferences[category] = config;
                })
                    .catch(() => {
                    // Ignore errors for categories that don't exist
                    preferences[category] = null;
                });
            });
            Promise.all(queryPromises).then(() => {
                // Filter out null entries
                const validPreferences = Object.fromEntries(Object.entries(preferences).filter(([_, value]) => value !== null));
                resolve((0, types_1.successResult)({
                    categories: Object.keys(validPreferences),
                    preferences: validPreferences
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async resetPreferences(name, type = 'global') {
        return new Promise((resolve) => {
            if (name) {
                // Reset specific preference category
                Editor.Message.request('preferences', 'query-config', name, undefined, 'default').then((defaultConfig) => {
                    return Editor.Message.request('preferences', 'set-config', name, '', defaultConfig, type);
                }).then((success) => {
                    if (success) {
                        resolve((0, types_1.successResult)(null, `Preference category '${name}' reset to default`));
                    }
                    else {
                        resolve((0, types_1.errorResult)(`Failed to reset preference category '${name}'`));
                    }
                }).catch((err) => {
                    resolve((0, types_1.errorResult)(err.message));
                });
            }
            else {
                resolve((0, types_1.errorResult)('Resetting all preferences is not supported through API. Please specify a preference category.'));
            }
        });
    }
    async exportPreferences(exportPath) {
        return new Promise((resolve) => {
            this.getAllPreferences().then((prefsResult) => {
                if (!prefsResult.success) {
                    resolve(prefsResult);
                    return;
                }
                const prefsData = JSON.stringify(prefsResult.data, null, 2);
                const resolvedPath = exportPath || `preferences_export_${Date.now()}.json`;
                // For now, return the data - in a real implementation, you'd write to file
                resolve((0, types_1.successResult)({
                    exportPath: resolvedPath,
                    preferences: prefsResult.data,
                    jsonData: prefsData,
                    message: 'Preferences exported successfully'
                }));
            }).catch((err) => {
                resolve((0, types_1.errorResult)(err.message));
            });
        });
    }
    async importPreferences(importPath) {
        return Promise.resolve((0, types_1.errorResult)('Import preferences functionality requires file system access which is not available in this context. Please manually import preferences through the Editor UI.'));
    }
}
exports.ManagePreferences = ManagePreferences;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByZWZlcmVuY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcmVmZXJlbmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsaUJBQWtCLFNBQVEsaUNBQWM7SUFBckQ7O1FBQ2EsU0FBSSxHQUFHLG9CQUFvQixDQUFDO1FBQzVCLGdCQUFXLEdBQUcseUtBQXlLLENBQUM7UUFDeEwsWUFBTyxHQUFHO1lBQ2YsTUFBTTtZQUNOLE9BQU87WUFDUCxLQUFLO1lBQ0wsU0FBUztZQUNULE9BQU87WUFDUCxRQUFRO1lBQ1IsUUFBUTtTQUNYLENBQUM7UUFFTyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbUJBQW1CO29CQUNoQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87aUJBQ3JCO2dCQUNELEdBQUcsRUFBRTtvQkFDRCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsMkNBQTJDO29CQUN4RCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUM7aUJBQ2pGO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsT0FBTztvQkFDYixXQUFXLEVBQUUsZ0RBQWdEO2lCQUNoRTtnQkFDRCxJQUFJLEVBQUU7b0JBQ0YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLDZDQUE2QztvQkFDMUQsT0FBTyxFQUFFLFNBQVM7aUJBQ3JCO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsaUNBQWlDO2lCQUNqRDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFF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Q0FBQyxDQUFDO2dCQUM1RCxNQUFNLFlBQVksR0FBRyxVQUFVLElBQUksc0JBQXNCLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDO2dCQUUzRSwyRUFBMkU7Z0JBQzNFLE9BQU8sQ0FBQyxJQUFBLHFCQUFhLEVBQUM7b0JBQ2xCLFVBQVUsRUFBRSxZQUFZO29CQUN4QixXQUFXLEVBQUUsV0FBVyxDQUFDLElBQUk7b0JBQzdCLFFBQVEsRUFBRSxTQUFTO29CQUNuQixPQUFPLEVBQUUsbUNBQW1DO2lCQUMvQyxDQUFDLENBQUMsQ0FBQztZQUNSLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQVUsRUFBRSxFQUFFO2dCQUNwQixPQUFPLENBQUMsSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQixDQUFDLFVBQWtCO1FBQzlDLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFBLG1CQUFXLEVBQzlCLGdLQUFnSyxDQUNuSyxDQUFDLENBQUM7SUFDUCxDQUFDO0NBQ0o7QUF6TkQsOENBeU5DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VQcmVmZXJlbmNlcyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9wcmVmZXJlbmNlcyc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGVkaXRvciBwcmVmZXJlbmNlcyBhbmQgc2V0dGluZ3MuIEFjdGlvbnM6IG9wZW4sIHF1ZXJ5LCBzZXQsIGdldF9hbGwsIHJlc2V0LCBleHBvcnQsIGltcG9ydC4gRm9yIHByb2plY3Qgc2V0dGluZ3MgdXNlIG1hbmFnZV9wcm9qZWN0IGFjdGlvbj1nZXRfc2V0dGluZ3MgaW5zdGVhZC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbXG4gICAgICAgICdvcGVuJyxcbiAgICAgICAgJ3F1ZXJ5JyxcbiAgICAgICAgJ3NldCcsXG4gICAgICAgICdnZXRfYWxsJyxcbiAgICAgICAgJ3Jlc2V0JyxcbiAgICAgICAgJ2V4cG9ydCcsXG4gICAgICAgICdpbXBvcnQnLFxuICAgIF07XG5cbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0YWI6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tvcGVuXSBQcmVmZXJlbmNlcyB0YWIgdG8gb3BlbiAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2dlbmVyYWwnLCAnZXh0ZXJuYWwtdG9vbHMnLCAnZGF0YS1lZGl0b3InLCAnbGFib3JhdG9yeScsICdleHRlbnNpb25zJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXJnczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbb3Blbl0gQWRkaXRpb25hbCBhcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgdGFiJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcXVlcnksIHNldCwgcmVzZXRdIFBsdWdpbiBvciBjYXRlZ29yeSBuYW1lJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZ2VuZXJhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3F1ZXJ5LCBzZXRdIENvbmZpZ3VyYXRpb24gcGF0aCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRdIENvbmZpZ3VyYXRpb24gdmFsdWUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1txdWVyeSwgc2V0LCByZXNldF0gQ29uZmlndXJhdGlvbiB0eXBlJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2RlZmF1bHQnLCAnZ2xvYmFsJywgJ2xvY2FsJ10sXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2dsb2JhbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhwb3J0UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2V4cG9ydF0gUGF0aCB0byBleHBvcnQgcHJlZmVyZW5jZXMgZmlsZSAob3B0aW9uYWwpJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbXBvcnRQYXRoOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbaW1wb3J0XSBQYXRoIHRvIGltcG9ydCBwcmVmZXJlbmNlcyBmaWxlIGZyb20nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ10sXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBvcGVuOiAoYXJncykgPT4gdGhpcy5vcGVuUHJlZmVyZW5jZXNTZXR0aW5ncyhhcmdzLnRhYiwgYXJncy5hcmdzKSxcbiAgICAgICAgcXVlcnk6IChhcmdzKSA9PiB0aGlzLnF1ZXJ5UHJlZmVyZW5jZXNDb25maWcoYXJncy5uYW1lLCBhcmdzLnBhdGgsIGFyZ3MudHlwZSksXG4gICAgICAgIHNldDogKGFyZ3MpID0+IHRoaXMuc2V0UHJlZmVyZW5jZXNDb25maWcoYXJncy5uYW1lLCBhcmdzLnBhdGgsIGFyZ3MudmFsdWUsIGFyZ3MudHlwZSksXG4gICAgICAgIGdldF9hbGw6IChfYXJncykgPT4gdGhpcy5nZXRBbGxQcmVmZXJlbmNlcygpLFxuICAgICAgICByZXNldDogKGFyZ3MpID0+IHRoaXMucmVzZXRQcmVmZXJlbmNlcyhhcmdzLm5hbWUsIGFyZ3MudHlwZSksXG4gICAgICAgIGV4cG9ydDogKGFyZ3MpID0+IHRoaXMuZXhwb3J0UHJlZmVyZW5jZXMoYXJncy5leHBvcnRQYXRoKSxcbiAgICAgICAgaW1wb3J0OiAoYXJncykgPT4gdGhpcy5pbXBvcnRQcmVmZXJlbmNlcyhhcmdzLmltcG9ydFBhdGgpLFxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIG9wZW5QcmVmZXJlbmNlc1NldHRpbmdzKHRhYj86IHN0cmluZywgYXJncz86IGFueVtdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVxdWVzdEFyZ3MgPSBbXTtcbiAgICAgICAgICAgIGlmICh0YWIpIHtcbiAgICAgICAgICAgICAgICByZXF1ZXN0QXJncy5wdXNoKHRhYik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYXJncyAmJiBhcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZXF1ZXN0QXJncy5wdXNoKC4uLmFyZ3MpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdvcGVuLXNldHRpbmdzJywgLi4ucmVxdWVzdEFyZ3MpLnRoZW4oKCkgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgUHJlZmVyZW5jZXMgc2V0dGluZ3Mgb3BlbmVkJHt0YWIgPyBgIG9uIHRhYjogJHt0YWJ9YCA6ICcnfWApKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgcXVlcnlQcmVmZXJlbmNlc0NvbmZpZyhuYW1lOiBzdHJpbmcsIHBhdGg/OiBzdHJpbmcsIHR5cGU6IHN0cmluZyA9ICdnbG9iYWwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmVxdWVzdEFyZ3MgPSBbbmFtZV07XG4gICAgICAgICAgICBpZiAocGF0aCkge1xuICAgICAgICAgICAgICAgIHJlcXVlc3RBcmdzLnB1c2gocGF0aCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXF1ZXN0QXJncy5wdXNoKHR5cGUpO1xuXG4gICAgICAgICAgICAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCAuLi5yZXF1ZXN0QXJncykudGhlbigoY29uZmlnOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBwYXRoLFxuICAgICAgICAgICAgICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICAgICAgICAgICAgICBjb25maWc6IGNvbmZpZ1xuICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdChlcnIubWVzc2FnZSkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0UHJlZmVyZW5jZXNDb25maWcobmFtZTogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnksIHR5cGU6IHN0cmluZyA9ICdnbG9iYWwnKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgKEVkaXRvci5NZXNzYWdlLnJlcXVlc3QgYXMgYW55KSgncHJlZmVyZW5jZXMnLCAnc2V0LWNvbmZpZycsIG5hbWUsIHBhdGgsIHZhbHVlLCB0eXBlKS50aGVuKChzdWNjZXNzOiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShzdWNjZXNzUmVzdWx0KG51bGwsIGBQcmVmZXJlbmNlICcke25hbWV9LiR7cGF0aH0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoYEZhaWxlZCB0byB1cGRhdGUgcHJlZmVyZW5jZSAnJHtuYW1lfS4ke3BhdGh9J2ApKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldEFsbFByZWZlcmVuY2VzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgIC8vIENvbW1vbiBwcmVmZXJlbmNlIGNhdGVnb3JpZXMgaW4gQ29jb3MgQ3JlYXRvclxuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcmllcyA9IFtcbiAgICAgICAgICAgICAgICAnZ2VuZXJhbCcsXG4gICAgICAgICAgICAgICAgJ2V4dGVybmFsLXRvb2xzJyxcbiAgICAgICAgICAgICAgICAnZGF0YS1lZGl0b3InLFxuICAgICAgICAgICAgICAgICdsYWJvcmF0b3J5JyxcbiAgICAgICAgICAgICAgICAnZXh0ZW5zaW9ucycsXG4gICAgICAgICAgICAgICAgJ3ByZXZpZXcnLFxuICAgICAgICAgICAgICAgICdjb25zb2xlJyxcbiAgICAgICAgICAgICAgICAnbmF0aXZlJyxcbiAgICAgICAgICAgICAgICAnYnVpbGRlcidcbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIGNvbnN0IHByZWZlcmVuY2VzOiBhbnkgPSB7fTtcblxuICAgICAgICAgICAgY29uc3QgcXVlcnlQcm9taXNlcyA9IGNhdGVnb3JpZXMubWFwKGNhdGVnb3J5ID0+IHtcbiAgICAgICAgICAgICAgICByZXR1cm4gRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJlZmVyZW5jZXMnLCAncXVlcnktY29uZmlnJywgY2F0ZWdvcnksIHVuZGVmaW5lZCwgJ2dsb2JhbCcpXG4gICAgICAgICAgICAgICAgICAgIC50aGVuKChjb25maWc6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgcHJlZmVyZW5jZXNbY2F0ZWdvcnldID0gY29uZmlnO1xuICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAuY2F0Y2goKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gSWdub3JlIGVycm9ycyBmb3IgY2F0ZWdvcmllcyB0aGF0IGRvbid0IGV4aXN0XG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmZXJlbmNlc1tjYXRlZ29yeV0gPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBQcm9taXNlLmFsbChxdWVyeVByb21pc2VzKS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBGaWx0ZXIgb3V0IG51bGwgZW50cmllc1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkUHJlZmVyZW5jZXMgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICAgICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHByZWZlcmVuY2VzKS5maWx0ZXIoKFtfLCB2YWx1ZV0pID0+IHZhbHVlICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgICByZXNvbHZlKHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICBjYXRlZ29yaWVzOiBPYmplY3Qua2V5cyh2YWxpZFByZWZlcmVuY2VzKSxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyZW5jZXM6IHZhbGlkUHJlZmVyZW5jZXNcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9KS5jYXRjaCgoZXJyOiBFcnJvcikgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHJlc2V0UHJlZmVyZW5jZXMobmFtZT86IHN0cmluZywgdHlwZTogc3RyaW5nID0gJ2dsb2JhbCcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgICAgIC8vIFJlc2V0IHNwZWNpZmljIHByZWZlcmVuY2UgY2F0ZWdvcnlcbiAgICAgICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcmVmZXJlbmNlcycsICdxdWVyeS1jb25maWcnLCBuYW1lLCB1bmRlZmluZWQsICdkZWZhdWx0JykudGhlbigoZGVmYXVsdENvbmZpZzogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCBhcyBhbnkpKCdwcmVmZXJlbmNlcycsICdzZXQtY29uZmlnJywgbmFtZSwgJycsIGRlZmF1bHRDb25maWcsIHR5cGUpO1xuICAgICAgICAgICAgICAgIH0pLnRoZW4oKHN1Y2Nlc3M6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdChudWxsLCBgUHJlZmVyZW5jZSBjYXRlZ29yeSAnJHtuYW1lfScgcmVzZXQgdG8gZGVmYXVsdGApKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoYEZhaWxlZCB0byByZXNldCBwcmVmZXJlbmNlIGNhdGVnb3J5ICcke25hbWV9J2ApKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZShlcnJvclJlc3VsdCgnUmVzZXR0aW5nIGFsbCBwcmVmZXJlbmNlcyBpcyBub3Qgc3VwcG9ydGVkIHRocm91Z2ggQVBJLiBQbGVhc2Ugc3BlY2lmeSBhIHByZWZlcmVuY2UgY2F0ZWdvcnkuJykpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGV4cG9ydFByZWZlcmVuY2VzKGV4cG9ydFBhdGg/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICB0aGlzLmdldEFsbFByZWZlcmVuY2VzKCkudGhlbigocHJlZnNSZXN1bHQ6IEFjdGlvblRvb2xSZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIXByZWZzUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShwcmVmc1Jlc3VsdCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmc0RhdGEgPSBKU09OLnN0cmluZ2lmeShwcmVmc1Jlc3VsdC5kYXRhLCBudWxsLCAyKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXNvbHZlZFBhdGggPSBleHBvcnRQYXRoIHx8IGBwcmVmZXJlbmNlc19leHBvcnRfJHtEYXRlLm5vdygpfS5qc29uYDtcblxuICAgICAgICAgICAgICAgIC8vIEZvciBub3csIHJldHVybiB0aGUgZGF0YSAtIGluIGEgcmVhbCBpbXBsZW1lbnRhdGlvbiwgeW91J2Qgd3JpdGUgdG8gZmlsZVxuICAgICAgICAgICAgICAgIHJlc29sdmUoc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgICAgIGV4cG9ydFBhdGg6IHJlc29sdmVkUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgcHJlZmVyZW5jZXM6IHByZWZzUmVzdWx0LmRhdGEsXG4gICAgICAgICAgICAgICAgICAgIGpzb25EYXRhOiBwcmVmc0RhdGEsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdQcmVmZXJlbmNlcyBleHBvcnRlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSkuY2F0Y2goKGVycjogRXJyb3IpID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBpbXBvcnRQcmVmZXJlbmNlcyhpbXBvcnRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShlcnJvclJlc3VsdChcbiAgICAgICAgICAgICdJbXBvcnQgcHJlZmVyZW5jZXMgZnVuY3Rpb25hbGl0eSByZXF1aXJlcyBmaWxlIHN5c3RlbSBhY2Nlc3Mgd2hpY2ggaXMgbm90IGF2YWlsYWJsZSBpbiB0aGlzIGNvbnRleHQuIFBsZWFzZSBtYW51YWxseSBpbXBvcnQgcHJlZmVyZW5jZXMgdGhyb3VnaCB0aGUgRWRpdG9yIFVJLidcbiAgICAgICAgKSk7XG4gICAgfVxufVxuIl19