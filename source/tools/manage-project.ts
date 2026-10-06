import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';

/**
 * Consolidated project management tool.
 * Covers build, run, preview, and settings from ProjectTools (non-asset methods).
 */
export class ManageProject extends BaseActionTool {
    readonly name = 'manage_project';
    readonly description = 'Manage project build, run, preview, and settings. Actions: run, build, get_info, get_settings, set_settings, get_build_settings, open_build_panel, check_builder_status. For asset operations use manage_asset instead.';
    readonly actions = [
        'run', 'build', 'get_info', 'get_settings', 'set_settings', 'get_build_settings',
        'open_build_panel', 'check_builder_status'
    ];

    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        run: (args) => this.runProject(args.platform),
        build: (args) => this.buildProject(args),
        get_info: (_args) => this.getProjectInfo(),
        get_settings: (args) => this.getProjectSettings(args.type),
        set_settings: (args) => this.setProjectSettings(args.type, args.path, args.value),
        get_build_settings: (_args) => this.getBuildSettings(),
        open_build_panel: (_args) => this.openBuildPanel(),
        check_builder_status: (_args) => this.checkBuilderStatus()
    };

    private async runProject(platform: string = 'browser'): Promise<ActionToolResult> {
        try {
            // Note: Preview module is not documented in official API.
            // Using fallback approach — open build panel as alternative.
            await Editor.Message.request('builder', 'open');
            return successResult({ platform }, 'Build panel opened. Preview functionality requires manual setup.');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async buildProject(args: any): Promise<ActionToolResult> {
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
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getProjectInfo(): Promise<ActionToolResult> {
        const info: any = {
            name: Editor.Project.name,
            path: Editor.Project.path,
            uuid: Editor.Project.uuid,
            version: (Editor.Project as any).version || '1.0.0',
            cocosVersion: (Editor as any).versions?.cocos || 'Unknown'
        };
        try {
            // Note: 'query-info' API doesn't exist, using 'query-config' instead.
            const additionalInfo = await Editor.Message.request('project', 'query-config', 'project');
            if (additionalInfo) Object.assign(info, { config: additionalInfo });
        } catch {
            // Return basic info even if detailed query fails
        }
        return successResult(info);
    }

    private readonly settingsConfigMap: Record<string, string> = {
        general: 'project', physics: 'physics', render: 'render', assets: 'asset-db', engine: 'engine'
    };

    /**
     * Write one project-settings value through the editor's own `project:set-config`
     * (the call the Project Settings panel makes). Requires an explicit path and value; an
     * unknown category is an error, not a silent fall-through to `project`; a `false` reply
     * from the editor is a failure, not a success (#134).
     */
    private async setProjectSettings(category: string = 'general', path?: string, value?: any): Promise<ActionToolResult> {
        const configName = this.settingsConfigMap[category];
        if (!configName) {
            return errorResult(`Unknown settings category '${category}'. Valid: ${Object.keys(this.settingsConfigMap).join(', ')}`);
        }
        if (typeof path !== 'string' || path.trim() === '') {
            return errorResult("set_settings requires 'path' (dotted config path, e.g. renderPipeline)");
        }
        if (value === undefined) {
            return errorResult("set_settings requires 'value' (pass null explicitly to write null)");
        }
        try {
            const ok = await (Editor.Message.request as any)('project', 'set-config', configName, path, value);
            if (!ok) {
                return errorResult(`The editor refused to set ${configName}.${path} (project:set-config returned false)`);
            }
            return successResult({ category, config: configName, path, value }, `${configName}.${path} updated`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getProjectSettings(category: string = 'general'): Promise<ActionToolResult> {
        try {
            const configName = this.settingsConfigMap[category] || 'project';
            const settings = await Editor.Message.request('project', 'query-config', configName);
            return successResult({ category, config: settings }, `${category} settings retrieved successfully`);
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async getBuildSettings(): Promise<ActionToolResult> {
        try {
            const ready: boolean = await Editor.Message.request('builder', 'query-worker-ready') as boolean;
            return successResult({
                builderReady: ready,
                availableActions: [
                    'Open build panel with open_build_panel',
                    'Check builder status with check_builder_status'
                ],
                limitation: 'Full build configuration requires direct Editor UI access'
            }, 'Build settings are limited in MCP plugin environment');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async openBuildPanel(): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('builder', 'open');
            return successResult(null, 'Build panel opened successfully');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async checkBuilderStatus(): Promise<ActionToolResult> {
        try {
            // Note: 'query-worker-ready' reports only whether the build WORKER process is idle —
            // it never reports whether a build is running, finished, succeeded, or where its
            // output went. Do not read `workerReady` as build-task status.
            const workerReady: boolean = await Editor.Message.request('builder', 'query-worker-ready') as boolean;
            return successResult({
                workerReady,
                taskStatus: 'not-tracked',
                status: workerReady ? 'Builder worker is idle/ready' : 'Builder worker is busy/not ready'
            }, 'Reports build WORKER readiness only — no build task state (running/finished/output path) is observable through this action');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

}
