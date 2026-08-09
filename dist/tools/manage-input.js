"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageInput = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
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
class ManageInput extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_input';
        this.description = 'Manage input system configuration. Actions: get_config, set_touch_config, set_acceleration, get_event_types. Configure multi-touch, accelerometer, and query available input event types.';
        this.actions = ['get_config', 'set_touch_config', 'set_acceleration', 'get_event_types'];
        this.inputSchema = {
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
        this.actionHandlers = {
            get_config: (args) => this.getConfig(args),
            set_touch_config: (args) => this.setTouchConfig(args),
            set_acceleration: (args) => this.setAcceleration(args),
            get_event_types: (_args) => this.getEventTypes(),
        };
    }
    async getConfig(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getInputConfig', args: []
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setTouchConfig(args) {
        try {
            if (args.enabled === undefined)
                return (0, types_1.errorResult)('enabled is required for set_touch_config');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setTouchConfig', args: [args.enabled]
            });
            return (0, types_1.successResult)(result, `Multi-touch ${args.enabled ? 'enabled' : 'disabled'}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setAcceleration(args) {
        try {
            if (args.enabled === undefined)
                return (0, types_1.errorResult)('enabled is required for set_acceleration');
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setAccelerationConfig',
                args: [args.enabled, args.interval]
            });
            return (0, types_1.successResult)(result, `Accelerometer ${args.enabled ? 'enabled' : 'disabled'}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getEventTypes() {
        return (0, types_1.successResult)({ eventTypes: INPUT_EVENT_TYPES, count: INPUT_EVENT_TYPES.length });
    }
}
exports.ManageInput = ManageInput;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWlucHV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1pbnB1dC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQU0saUJBQWlCLEdBQUc7SUFDdEIsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLDZCQUE2QixFQUFFO0lBQ3pGLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIsRUFBRTtJQUMvRSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsc0JBQXNCLEVBQUU7SUFDaEYsRUFBRSxJQUFJLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxjQUFjLEVBQUUsV0FBVyxFQUFFLGlCQUFpQixFQUFFO0lBQy9FLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxzQkFBc0IsRUFBRTtJQUNoRixFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsdUJBQXVCLEVBQUU7SUFDN0UsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBRTtJQUN2RSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsc0JBQXNCLEVBQUU7SUFDbEYsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLHNCQUFzQixFQUFFO0lBQzNFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFdBQVcsRUFBRSx1QkFBdUIs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QUFFLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUM3RixDQUFDO0NBQ0o7QUExREQsa0NBMERDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmNvbnN0IElOUFVUX0VWRU5UX1RZUEVTID0gW1xuICAgIHsgbmFtZTogJ1RPVUNIX1NUQVJUJywgdmFsdWU6ICd0b3VjaC1zdGFydCcsIGRlc2NyaXB0aW9uOiAnRmluZ2VyL3BvaW50ZXIgcHJlc3NlZCBkb3duJyB9LFxuICAgIHsgbmFtZTogJ1RPVUNIX0VORCcsIHZhbHVlOiAndG91Y2gtZW5kJywgZGVzY3JpcHRpb246ICdGaW5nZXIvcG9pbnRlciBsaWZ0ZWQnIH0sXG4gICAgeyBuYW1lOiAnVE9VQ0hfTU9WRScsIHZhbHVlOiAndG91Y2gtbW92ZScsIGRlc2NyaXB0aW9uOiAnRmluZ2VyL3BvaW50ZXIgbW92ZWQnIH0sXG4gICAgeyBuYW1lOiAnVE9VQ0hfQ0FOQ0VMJywgdmFsdWU6ICd0b3VjaC1jYW5jZWwnLCBkZXNjcmlwdGlvbjogJ1RvdWNoIGNhbmNlbGxlZCcgfSxcbiAgICB7IG5hbWU6ICdNT1VTRV9ET1dOJywgdmFsdWU6ICdtb3VzZS1kb3duJywgZGVzY3JpcHRpb246ICdNb3VzZSBidXR0b24gcHJlc3NlZCcgfSxcbiAgICB7IG5hbWU6ICdNT1VTRV9VUCcsIHZhbHVlOiAnbW91c2UtdXAnLCBkZXNjcmlwdGlvbjogJ01vdXNlIGJ1dHRvbiByZWxlYXNlZCcgfSxcbiAgICB7IG5hbWU6ICdNT1VTRV9NT1ZFJywgdmFsdWU6ICdtb3VzZS1tb3ZlJywgZGVzY3JpcHRpb246ICdNb3VzZSBtb3ZlZCcgfSxcbiAgICB7IG5hbWU6ICdNT1VTRV9XSEVFTCcsIHZhbHVlOiAnbW91c2Utd2hlZWwnLCBkZXNjcmlwdGlvbjogJ01vdXNlIHdoZWVsIHNjcm9sbGVkJyB9LFxuICAgIHsgbmFtZTogJ0tFWV9ET1dOJywgdmFsdWU6ICdrZXlkb3duJywgZGVzY3JpcHRpb246ICdLZXlib2FyZCBrZXkgcHJlc3NlZCcgfSxcbiAgICB7IG5hbWU6ICdLRVlfVVAnLCB2YWx1ZTogJ2tleXVwJywgZGVzY3JpcHRpb246ICdLZXlib2FyZCBrZXkgcmVsZWFzZWQnIH0sXG4gICAgeyBuYW1lOiAnS0VZX1BSRVNTSU5HJywgdmFsdWU6ICdrZXktcHJlc3NpbmcnLCBkZXNjcmlwdGlvbjogJ0tleWJvYXJkIGtleSBoZWxkJyB9LFxuICAgIHsgbmFtZTogJ0RFVklDRU1PVElPTicsIHZhbHVlOiAnZGV2aWNlbW90aW9uJywgZGVzY3JpcHRpb246ICdEZXZpY2UgYWNjZWxlcm9tZXRlciBtb3Rpb24nIH0sXG4gICAgeyBuYW1lOiAnR0FNRVBBRF9DSEFOR0UnLCB2YWx1ZTogJ2dhbWVwYWQtaW5wdXQnLCBkZXNjcmlwdGlvbjogJ0dhbWVwYWQgYnV0dG9uL2F4aXMgY2hhbmdlZCcgfSxcbiAgICB7IG5hbWU6ICdIQU5ETEVfSU5QVVQnLCB2YWx1ZTogJ2hhbmRsZS1pbnB1dCcsIGRlc2NyaXB0aW9uOiAnWFIgaGFuZGxlIGNvbnRyb2xsZXIgaW5wdXQnIH0sXG4gICAgeyBuYW1lOiAnSE1EX1BPU0VfSU5QVVQnLCB2YWx1ZTogJ2htZC1wb3NlLWlucHV0JywgZGVzY3JpcHRpb246ICdYUiBITUQgcG9zZSBpbnB1dCcgfSxcbl07XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VJbnB1dCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9pbnB1dCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIGlucHV0IHN5c3RlbSBjb25maWd1cmF0aW9uLiBBY3Rpb25zOiBnZXRfY29uZmlnLCBzZXRfdG91Y2hfY29uZmlnLCBzZXRfYWNjZWxlcmF0aW9uLCBnZXRfZXZlbnRfdHlwZXMuIENvbmZpZ3VyZSBtdWx0aS10b3VjaCwgYWNjZWxlcm9tZXRlciwgYW5kIHF1ZXJ5IGF2YWlsYWJsZSBpbnB1dCBldmVudCB0eXBlcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2dldF9jb25maWcnLCAnc2V0X3RvdWNoX2NvbmZpZycsICdzZXRfYWNjZWxlcmF0aW9uJywgJ2dldF9ldmVudF90eXBlcyddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZXRfY29uZmlnJywgJ3NldF90b3VjaF9jb25maWcnLCAnc2V0X2FjY2VsZXJhdGlvbicsICdnZXRfZXZlbnRfdHlwZXMnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogZ2V0X2NvbmZpZz1nZXQgY3VycmVudCBpbnB1dCBjb25maWcsIHNldF90b3VjaF9jb25maWc9ZW5hYmxlL2Rpc2FibGUgbXVsdGktdG91Y2gsIHNldF9hY2NlbGVyYXRpb249Y29uZmlndXJlIGFjY2VsZXJvbWV0ZXIsIGdldF9ldmVudF90eXBlcz1saXN0IGFsbCBjYy5JbnB1dCBldmVudCB0eXBlcydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBlbmFibGVkOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3RvdWNoX2NvbmZpZy9zZXRfYWNjZWxlcmF0aW9uXSBFbmFibGUgb3IgZGlzYWJsZSB0aGUgZmVhdHVyZScgfSxcbiAgICAgICAgICAgIGludGVydmFsOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfYWNjZWxlcmF0aW9uXSBBY2NlbGVyb21ldGVyIHVwZGF0ZSBpbnRlcnZhbCBpbiBzZWNvbmRzIChkZWZhdWx0OiAxLzYwKScgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZ2V0X2NvbmZpZzogKGFyZ3MpID0+IHRoaXMuZ2V0Q29uZmlnKGFyZ3MpLFxuICAgICAgICBzZXRfdG91Y2hfY29uZmlnOiAoYXJncykgPT4gdGhpcy5zZXRUb3VjaENvbmZpZyhhcmdzKSxcbiAgICAgICAgc2V0X2FjY2VsZXJhdGlvbjogKGFyZ3MpID0+IHRoaXMuc2V0QWNjZWxlcmF0aW9uKGFyZ3MpLFxuICAgICAgICBnZXRfZXZlbnRfdHlwZXM6IChfYXJncykgPT4gdGhpcy5nZXRFdmVudFR5cGVzKCksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0Q29uZmlnKF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0SW5wdXRDb25maWcnLCBhcmdzOiBbXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRUb3VjaENvbmZpZyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChhcmdzLmVuYWJsZWQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdlbmFibGVkIGlzIHJlcXVpcmVkIGZvciBzZXRfdG91Y2hfY29uZmlnJyk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldFRvdWNoQ29uZmlnJywgYXJnczogW2FyZ3MuZW5hYmxlZF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LCBgTXVsdGktdG91Y2ggJHthcmdzLmVuYWJsZWQgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnfWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRBY2NlbGVyYXRpb24oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoYXJncy5lbmFibGVkID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgnZW5hYmxlZCBpcyByZXF1aXJlZCBmb3Igc2V0X2FjY2VsZXJhdGlvbicpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdzZXRBY2NlbGVyYXRpb25Db25maWcnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLmVuYWJsZWQsIGFyZ3MuaW50ZXJ2YWxdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgYEFjY2VsZXJvbWV0ZXIgJHthcmdzLmVuYWJsZWQgPyAnZW5hYmxlZCcgOiAnZGlzYWJsZWQnfWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRFdmVudFR5cGVzKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGV2ZW50VHlwZXM6IElOUFVUX0VWRU5UX1RZUEVTLCBjb3VudDogSU5QVVRfRVZFTlRfVFlQRVMubGVuZ3RoIH0pO1xuICAgIH1cbn1cbiJdfQ==