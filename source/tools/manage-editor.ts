import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const KNOWN_PANELS = [
    'console', 'hierarchy', 'inspector', 'assets', 'scene',
    'node-library', 'build', 'preferences', 'project-settings',
    'animation', 'timeline', 'profiler', 'cocos-mcp-server.default',
    'cocos-mcp-server.tool-manager'
];

export class ManageEditor extends BaseActionTool {
    readonly name = 'manage_editor';
    readonly description = 'Control Cocos Creator editor state. Actions: play, pause, step, stop, get_state, reload_scene, open_panel, get_panels. Uses Editor.Message directly without scene scripts.';
    readonly actions = ['play', 'pause', 'step', 'stop', 'get_state', 'reload_scene', 'open_panel', 'get_panels'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['play', 'pause', 'step', 'stop', 'get_state', 'reload_scene', 'open_panel', 'get_panels'],
                description: 'Action: play=start preview, pause=pause preview, step=advance one frame, stop=stop preview, get_state=query preview state, reload_scene=soft-reload current scene, open_panel=open editor panel by name, get_panels=list available panel names'
            },
            panelName: {
                type: 'string',
                description: '[open_panel] Panel name to open (e.g., "console", "hierarchy", "inspector", "assets")'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        play: (_args) => this.previewControl('open'),
        pause: (_args) => this.previewControl('pause'),
        step: (_args) => this.previewControl('step'),
        stop: (_args) => this.previewControl('close'),
        get_state: (_args) => this.getState(),
        reload_scene: (_args) => this.reloadScene(),
        open_panel: (args) => this.openPanel(args),
        get_panels: async (_args) => successResult({ panels: KNOWN_PANELS, count: KNOWN_PANELS.length }),
    };

    private async previewControl(command: string): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('preview', command as any);
            const labels: Record<string, string> = { open: 'started', pause: 'paused', step: 'stepped one frame', close: 'stopped' };
            return successResult({ command }, `Preview ${labels[command] || command}`);
        } catch (err: any) {
            // Some preview commands may not return a value — treat as success if no error thrown
            if (err.message?.includes('timeout') || err.message?.includes('no handler')) {
                return successResult({ command }, `Preview ${command} sent (no confirmation)`);
            }
            return errorResult(err.message);
        }
    }

    private async getState(): Promise<ActionToolResult> {
        try {
            const state = await Editor.Message.request('preview', 'query-info' as any);
            return successResult(state ?? { note: 'Preview state not available' });
        } catch (err: any) {
            return successResult({ note: 'Could not query preview state', error: err.message });
        }
    }

    private async reloadScene(): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('scene', 'soft-reload' as any);
            return successResult(null, 'Scene reloaded');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async openPanel(args: any): Promise<ActionToolResult> {
        if (!args.panelName) return errorResult('panelName is required for open_panel');
        try {
            await Editor.Panel.open(args.panelName);
            return successResult({ panelName: args.panelName }, `Panel '${args.panelName}' opened`);
        } catch (err: any) {
            return errorResult(`Failed to open panel '${args.panelName}': ${err.message}`);
        }
    }
}
