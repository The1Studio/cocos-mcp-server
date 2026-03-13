import { ActionToolResult, successResult, errorResult } from '../types';
import { BaseActionTool } from './base-action-tool';

/**
 * Consolidated project management tool.
 * Covers build, run, preview, and settings from ProjectTools (non-asset methods).
 */
export class ManageProject extends BaseActionTool {
    readonly name = 'manage_project';
    readonly description = 'Manage project build, run, preview, and settings. Actions: run, build, get_info, get_settings, get_build_settings, open_build_panel, check_builder_status, start_preview, stop_preview. For asset operations use manage_asset instead.';
    readonly actions = [
        'run', 'build', 'get_info', 'get_settings', 'get_build_settings',
        'open_build_panel', 'check_builder_status', 'start_preview', 'stop_preview'
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        run: (args) => this.runProject(args.platform),
        build: (args) => this.buildProject(args),
        get_info: (_args) => this.getProjectInfo(),
        get_settings: (args) => this.getProjectSettings(args.type),
        get_build_settings: (_args) => this.getBuildSettings(),
        open_build_panel: (_args) => this.openBuildPanel(),
        check_builder_status: (_args) => this.checkBuilderStatus(),
        start_preview: (args) => this.startPreviewServer(
            args.port !== undefined ? parseInt(String(args.port), 10) : 7456
        ),
        stop_preview: (_args) => this.stopPreviewServer()
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
            // Building requires manual interaction through the build panel.
            await Editor.Message.request('builder', 'open');
            return successResult(
                { platform: args.platform, instruction: 'Use the build panel to configure and start the build process' },
                `Build panel opened for ${args.platform}. Please configure and start build manually.`
            );
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

    private async getProjectSettings(category: string = 'general'): Promise<ActionToolResult> {
        try {
            const configMap: Record<string, string> = {
                general: 'project', physics: 'physics', render: 'render', assets: 'asset-db'
            };
            const configName = configMap[category] || 'project';
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
                    'Check builder status with check_builder_status',
                    'Start preview server with start_preview',
                    'Stop preview server with stop_preview'
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
            const ready: boolean = await Editor.Message.request('builder', 'query-worker-ready') as boolean;
            return successResult({
                ready,
                status: ready ? 'Builder worker is ready' : 'Builder worker is not ready'
            }, 'Builder status checked successfully');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async startPreviewServer(_port: number = 7456): Promise<ActionToolResult> {
        return {
            success: false,
            error: 'Preview server control is not supported through MCP API',
            isError: true,
            data: {
                instruction: 'Please start the preview server manually using the editor menu: Project > Preview, or use the preview panel in the editor'
            }
        };
    }

    private async stopPreviewServer(): Promise<ActionToolResult> {
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
