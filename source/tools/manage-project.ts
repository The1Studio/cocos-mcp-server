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
        return new Promise((resolve) => {
            // Note: Preview module is not documented in official API.
            // Using fallback approach — open build panel as alternative.
            Editor.Message.request('builder', 'open').then(() => {
                resolve(successResult(
                    { platform },
                    `Build panel opened. Preview functionality requires manual setup.`
                ));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async buildProject(args: any): Promise<ActionToolResult> {
        const debug: boolean = args.debug !== false && args.debug !== 'false';

        return new Promise((resolve) => {
            // Note: Builder module only supports 'open' and 'query-worker-ready'.
            // Building requires manual interaction through the build panel.
            Editor.Message.request('builder', 'open').then(() => {
                resolve(successResult(
                    {
                        platform: args.platform,
                        instruction: 'Use the build panel to configure and start the build process'
                    },
                    `Build panel opened for ${args.platform}. Please configure and start build manually.`
                ));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getProjectInfo(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const info: any = {
                name: Editor.Project.name,
                path: Editor.Project.path,
                uuid: Editor.Project.uuid,
                version: (Editor.Project as any).version || '1.0.0',
                cocosVersion: (Editor as any).versions?.cocos || 'Unknown'
            };

            // Note: 'query-info' API doesn't exist, using 'query-config' instead.
            Editor.Message.request('project', 'query-config', 'project').then((additionalInfo: any) => {
                if (additionalInfo) {
                    Object.assign(info, { config: additionalInfo });
                }
                resolve(successResult(info));
            }).catch(() => {
                // Return basic info even if detailed query fails
                resolve(successResult(info));
            });
        });
    }

    private async getProjectSettings(category: string = 'general'): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            const configMap: Record<string, string> = {
                general: 'project',
                physics: 'physics',
                render: 'render',
                assets: 'asset-db'
            };

            const configName = configMap[category] || 'project';

            Editor.Message.request('project', 'query-config', configName).then((settings: any) => {
                resolve(successResult({
                    category,
                    config: settings
                }, `${category} settings retrieved successfully`));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getBuildSettings(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('builder', 'query-worker-ready').then((ready: boolean) => {
                resolve(successResult({
                    builderReady: ready,
                    availableActions: [
                        'Open build panel with open_build_panel',
                        'Check builder status with check_builder_status',
                        'Start preview server with start_preview',
                        'Stop preview server with stop_preview'
                    ],
                    limitation: 'Full build configuration requires direct Editor UI access'
                }, 'Build settings are limited in MCP plugin environment'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async openBuildPanel(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('builder', 'open').then(() => {
                resolve(successResult(null, 'Build panel opened successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async checkBuilderStatus(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('builder', 'query-worker-ready').then((ready: boolean) => {
                resolve(successResult({
                    ready,
                    status: ready ? 'Builder worker is ready' : 'Builder worker is not ready'
                }, 'Builder status checked successfully'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
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
