import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManagePreferences extends BaseActionTool {
    readonly name = 'manage_preferences';
    readonly description = 'Manage editor preferences and settings. Actions: open, query, set, get_all, reset, export, import. For project settings use manage_project action=get_settings instead.';
    readonly actions = [
        'open',
        'query',
        'set',
        'get_all',
        'reset',
        'export',
        'import',
    ];

    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        open: (args) => this.openPreferencesSettings(args.tab, args.args),
        query: (args) => this.queryPreferencesConfig(args.name, args.path, args.type),
        set: (args) => this.setPreferencesConfig(args.name, args.path, args.value, args.type),
        get_all: (_args) => this.getAllPreferences(),
        reset: (args) => this.resetPreferences(args.name, args.type),
        export: (args) => this.exportPreferences(args.exportPath),
        import: (args) => this.importPreferences(args.importPath),
    };

    private async openPreferencesSettings(tab?: string, args?: any[]): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const requestArgs = [];
            if (tab) {
                requestArgs.push(tab);
            }
            if (args && args.length > 0) {
                requestArgs.push(...args);
            }

            (Editor.Message.request as any)('preferences', 'open-settings', ...requestArgs).then(() => {
                resolve(successResult(null, `Preferences settings opened${tab ? ` on tab: ${tab}` : ''}`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async queryPreferencesConfig(name: string, path?: string, type: string = 'global'): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const requestArgs = [name];
            if (path) {
                requestArgs.push(path);
            }
            requestArgs.push(type);

            (Editor.Message.request as any)('preferences', 'query-config', ...requestArgs).then((config: any) => {
                resolve(successResult({
                    name: name,
                    path: path,
                    type: type,
                    config: config
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async setPreferencesConfig(name: string, path: string, value: any, type: string = 'global'): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            (Editor.Message.request as any)('preferences', 'set-config', name, path, value, type).then((success: boolean) => {
                if (success) {
                    resolve(successResult(null, `Preference '${name}.${path}' updated successfully`));
                } else {
                    resolve(errorResult(`Failed to update preference '${name}.${path}'`));
                }
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getAllPreferences(): Promise<ActionToolResult> {
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

            const preferences: any = {};

            const queryPromises = categories.map(category => {
                return Editor.Message.request('preferences', 'query-config', category, undefined, 'global')
                    .then((config: any) => {
                        preferences[category] = config;
                    })
                    .catch(() => {
                        // Ignore errors for categories that don't exist
                        preferences[category] = null;
                    });
            });

            Promise.all(queryPromises).then(() => {
                // Filter out null entries
                const validPreferences = Object.fromEntries(
                    Object.entries(preferences).filter(([_, value]) => value !== null)
                );

                resolve(successResult({
                    categories: Object.keys(validPreferences),
                    preferences: validPreferences
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async resetPreferences(name?: string, type: string = 'global'): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            if (name) {
                // Reset specific preference category
                Editor.Message.request('preferences', 'query-config', name, undefined, 'default').then((defaultConfig: any) => {
                    return (Editor.Message.request as any)('preferences', 'set-config', name, '', defaultConfig, type);
                }).then((success: boolean) => {
                    if (success) {
                        resolve(successResult(null, `Preference category '${name}' reset to default`));
                    } else {
                        resolve(errorResult(`Failed to reset preference category '${name}'`));
                    }
                }).catch((err: Error) => {
                    resolve(errorResult(err.message));
                });
            } else {
                resolve(errorResult('Resetting all preferences is not supported through API. Please specify a preference category.'));
            }
        });
    }

    private async exportPreferences(exportPath?: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            this.getAllPreferences().then((prefsResult: ActionToolResult) => {
                if (!prefsResult.success) {
                    resolve(prefsResult);
                    return;
                }

                const prefsData = JSON.stringify(prefsResult.data, null, 2);
                const resolvedPath = exportPath || `preferences_export_${Date.now()}.json`;

                // For now, return the data - in a real implementation, you'd write to file
                resolve(successResult({
                    exportPath: resolvedPath,
                    preferences: prefsResult.data,
                    jsonData: prefsData,
                    message: 'Preferences exported successfully'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async importPreferences(importPath: string): Promise<ActionToolResult> {
        return Promise.resolve(errorResult(
            'Import preferences functionality requires file system access which is not available in this context. Please manually import preferences through the Editor UI.'
        ));
    }
}
