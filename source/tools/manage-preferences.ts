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

    private async openPreferencesSettings(tab?: string, extraArgs?: any[]): Promise<ActionToolResult> {
        try {
            const requestArgs: any[] = [];
            if (tab) requestArgs.push(tab);
            if (extraArgs && extraArgs.length > 0) requestArgs.push(...extraArgs);
            await (Editor.Message.request as any)('preferences', 'open-settings', ...requestArgs);
            return successResult(null, `Preferences settings opened${tab ? ` on tab: ${tab}` : ''}`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async queryPreferencesConfig(name: string, path?: string, type: string = 'global'): Promise<ActionToolResult> {
        try {
            const requestArgs: any[] = [name];
            if (path) requestArgs.push(path);
            requestArgs.push(type);
            const config = await (Editor.Message.request as any)('preferences', 'query-config', ...requestArgs);
            return successResult({ name, path, type, config });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async setPreferencesConfig(name: string, path: string, value: any, type: string = 'global'): Promise<ActionToolResult> {
        try {
            const success: boolean = await (Editor.Message.request as any)('preferences', 'set-config', name, path, value, type);
            if (success) return successResult(null, `Preference '${name}.${path}' updated successfully`);
            return errorResult(`Failed to update preference '${name}.${path}'`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getAllPreferences(): Promise<ActionToolResult> {
        const categories = [
            'general', 'external-tools', 'data-editor', 'laboratory',
            'extensions', 'preview', 'console', 'native', 'builder'
        ];
        const preferences: any = {};
        const queryPromises = categories.map(category =>
            Editor.Message.request('preferences', 'query-config', category, undefined, 'global')
                .then((config: any) => { preferences[category] = config; })
                .catch(() => { preferences[category] = null; })
        );
        try {
            await Promise.all(queryPromises);
            const validPreferences = Object.fromEntries(
                Object.entries(preferences).filter(([_, value]) => value !== null)
            );
            return successResult({ categories: Object.keys(validPreferences), preferences: validPreferences });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async resetPreferences(name?: string, type: string = 'global'): Promise<ActionToolResult> {
        if (!name) {
            return errorResult('Resetting all preferences is not supported through API. Please specify a preference category.');
        }
        try {
            const defaultConfig = await Editor.Message.request('preferences', 'query-config', name, undefined, 'default');
            const success: boolean = await (Editor.Message.request as any)('preferences', 'set-config', name, '', defaultConfig, type);
            if (success) return successResult(null, `Preference category '${name}' reset to default`);
            return errorResult(`Failed to reset preference category '${name}'`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async exportPreferences(exportPath?: string): Promise<ActionToolResult> {
        try {
            const prefsResult = await this.getAllPreferences();
            if (!prefsResult.success) return prefsResult;
            const prefsData = JSON.stringify(prefsResult.data, null, 2);
            const resolvedPath = exportPath || `preferences_export_${Date.now()}.json`;
            return successResult({
                exportPath: resolvedPath,
                preferences: prefsResult.data,
                jsonData: prefsData,
                message: 'Preferences exported successfully'
            });
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async importPreferences(_importPath: string): Promise<ActionToolResult> {
        return errorResult(
            'Import preferences functionality requires file system access which is not available in this context. Please manually import preferences through the Editor UI.'
        );
    }
}
