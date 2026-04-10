import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const INPUT_EVENT_TYPES = [
    { name: 'TOUCH_START', value: 'touch-start', description: 'Finger/pointer pressed down' },
    { name: 'TOUCH_END', value: 'touch-end', description: 'Finger/pointer lifted' },
    { name: 'TOUCH_MOVE', value: 'touch-move', description: 'Finger/pointer moved' },
    { name: 'TOUCH_CANCEL', value: 'touch-cancel', description: 'Touch cancelled' },
    { name: 'MOUSE_DOWN', value: 'mouse-down', description: 'Mouse button pressed' },
    { name: 'MOUSE_UP', value: 'mouse-up', description: 'Mouse button released' },
    { name: 'MOUSE_MOVE', value: 'mouse-move', description: 'Mouse moved' },
    { name: 'MOUSE_WHEEL', value: 'mouse-wheel', description: 'Mouse wheel scrolled' },
    { name: 'KEY_DOWN', value: 'keydown', description: 'Keyboard key pressed' },
    { name: 'KEY_UP', value: 'keyup', description: 'Keyboard key released' },
    { name: 'KEY_PRESSING', value: 'key-pressing', description: 'Keyboard key held' },
    { name: 'DEVICEMOTION', value: 'devicemotion', description: 'Device accelerometer motion' },
    { name: 'GAMEPAD_CHANGE', value: 'gamepad-input', description: 'Gamepad button/axis changed' },
    { name: 'HANDLE_INPUT', value: 'handle-input', description: 'XR handle controller input' },
    { name: 'HMD_POSE_INPUT', value: 'hmd-pose-input', description: 'XR HMD pose input' },
];

export class ManageInput extends BaseActionTool {
    readonly name = 'manage_input';
    readonly description = 'Manage input system configuration. Actions: get_config, set_touch_config, set_acceleration, get_event_types. Configure multi-touch, accelerometer, and query available input event types.';
    readonly actions = ['get_config', 'set_touch_config', 'set_acceleration', 'get_event_types'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['get_config', 'set_touch_config', 'set_acceleration', 'get_event_types'],
                description: 'Action: get_config=get current input config, set_touch_config=enable/disable multi-touch, set_acceleration=configure accelerometer, get_event_types=list all cc.Input event types'
            },
            enabled: { type: 'boolean', description: '[set_touch_config/set_acceleration] Enable or disable the feature' },
            interval: { type: 'number', description: '[set_acceleration] Accelerometer update interval in seconds (default: 1/60)' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_config: (args) => this.getConfig(args),
        set_touch_config: (args) => this.setTouchConfig(args),
        set_acceleration: (args) => this.setAcceleration(args),
        get_event_types: (_args) => this.getEventTypes(),
    };

    private async getConfig(_args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getInputConfig', args: []
            });
            return successResult(result);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setTouchConfig(args: any): Promise<ActionToolResult> {
        try {
            if (args.enabled === undefined) return errorResult('enabled is required for set_touch_config');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTouchConfig', args: [args.enabled]
            });
            return successResult(result, `Multi-touch ${args.enabled ? 'enabled' : 'disabled'}`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setAcceleration(args: any): Promise<ActionToolResult> {
        try {
            if (args.enabled === undefined) return errorResult('enabled is required for set_acceleration');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setAccelerationConfig',
                args: [args.enabled, args.interval]
            });
            return successResult(result, `Accelerometer ${args.enabled ? 'enabled' : 'disabled'}`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getEventTypes(): Promise<ActionToolResult> {
        return successResult({ eventTypes: INPUT_EVENT_TYPES, count: INPUT_EVENT_TYPES.length });
    }
}
