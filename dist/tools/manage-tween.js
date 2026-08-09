"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageTween = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const EASING_VALUES = ['linear', 'quadIn', 'quadOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut',
    'sineIn', 'sineOut', 'sineInOut', 'bounceIn', 'bounceOut', 'bounceInOut',
    'elasticIn', 'elasticOut', 'elasticInOut', 'backIn', 'backOut', 'backInOut'];
class ManageTween extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_tween';
        this.description = 'Manage Cocos Creator tweens for node animation. Actions: create, add_to, add_by, add_delay, stop_all, get_info. Tweens are runtime-only and control node properties like position, rotation, scale, opacity over time.';
        this.actions = ['create', 'add_to', 'add_by', 'add_delay', 'stop_all', 'get_info'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['create', 'add_to', 'add_by', 'add_delay', 'stop_all', 'get_info'],
                    description: 'Action: create=build+start tween from steps, add_to=absolute property tween, add_by=relative property tween, add_delay=delay step, stop_all=stop all tweens on node, get_info=tween system info'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[create, add_to, add_by, add_delay, stop_all] Target node UUID'
                },
                steps: {
                    type: 'array',
                    description: '[create] Tween step sequence. Each step: {type:"to"|"by"|"delay"|"call", duration?, properties?, easing?}',
                    items: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', enum: ['to', 'by', 'delay', 'call'] },
                            duration: { type: 'number' },
                            properties: { type: 'object', description: 'Node properties to animate: position{x,y,z}, rotation{x,y,z}, scale{x,y,z}, opacity' },
                            easing: { type: 'string', enum: EASING_VALUES }
                        }
                    }
                },
                properties: {
                    type: 'object',
                    description: '[add_to, add_by] Properties to animate. Supports: position{x,y,z}, rotation{x,y,z}, scale{x,y,z}, opacity (0-255)'
                },
                duration: {
                    type: 'number',
                    description: '[add_to, add_by, add_delay] Duration in seconds'
                },
                easing: {
                    type: 'string',
                    enum: EASING_VALUES,
                    description: '[add_to, add_by] Easing function name'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            create: (args) => this.createTween(args),
            add_to: (args) => this.sceneCall('addTweenTo', args, ['nodeUuid', 'properties', 'duration']),
            add_by: (args) => this.sceneCall('addTweenBy', args, ['nodeUuid', 'properties', 'duration']),
            add_delay: (args) => this.sceneCall('addTweenDelay', args, ['nodeUuid', 'duration']),
            stop_all: (args) => this.sceneCall('stopTweens', args, ['nodeUuid']),
            get_info: async (_args) => (0, types_1.successResult)({
                note: 'Tweens are runtime-only. No persistent tween state is exposed by Cocos Creator.',
                tip: 'Use create/add_to/add_by to start tweens. Use stop_all to stop by nodeUuid.'
            }),
        };
    }
    async createTween(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for create');
        if (!Array.isArray(args.steps) || args.steps.length === 0)
            return (0, types_1.errorResult)('steps array is required for create');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'createTween', args: [args.nodeUuid, args.steps]
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(result.data, 'Tween created and started') : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to create tween');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async sceneCall(method, args, required) {
        for (const r of required) {
            if (args[r] === undefined || args[r] === null)
                return (0, types_1.errorResult)(`${r} is required`);
        }
        try {
            const methodArgs = method === 'addTweenTo' || method === 'addTweenBy'
                ? [args.nodeUuid, args.properties, args.duration, args.easing || 'linear']
                : method === 'addTweenDelay'
                    ? [args.nodeUuid, args.duration]
                    : [args.nodeUuid];
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method, args: methodArgs
            });
            return (result === null || result === void 0 ? void 0 : result.success) ? (0, types_1.successResult)(result.data, result.message) : (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || `${method} failed`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageTween = ManageTween;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXR3ZWVuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS10d2Vlbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQU0sYUFBYSxHQUFHLENBQUMsUUFBUSxFQUFDLFFBQVEsRUFBQyxTQUFTLEVBQUMsV0FBVyxFQUFDLFNBQVMsRUFBQyxVQUFVLEVBQUMsWUFBWTtJQUM1RixRQUFRLEVBQUMsU0FBUyxFQUFDLFdBQVcsRUFBQyxVQUFVLEVBQUMsV0FBVyxFQUFDLGFBQWE7SUFDbkUsV0FBVyxFQUFDLFlBQVksRUFBQyxjQUFjLEVBQUMsUUFBUSxFQUFDLFNBQVMsRUFBQyxXQUFXLENBQUMsQ0FBQztBQUU1RSxNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsd05BQXdOLENBQUM7UUFDdk8sWUFBTyxHQUFHLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM5RSxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQztvQkFDekUsV0FBVyxFQUFFLGlNQUFpTTtpQkFDak47Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxnRUFBZ0U7aUJBQ2hGO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsT0FBTztvQkFDYixXQUFXLEVBQUUsMkdBQTJHO29CQUN4SCxLQUFLLEVBQUU7d0JB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QWtCLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVO2FBQ3JELENBQUMsQ0FBQztZQUNILE9BQU8sQ0FBQyxNQUFjLGFBQWQsTUFBTSx1QkFBTixNQUFNLENBQVUsT0FBTyxFQUFDLENBQUMsQ0FBQyxJQUFBLHFCQUFhLEVBQUUsTUFBYyxDQUFDLElBQUksRUFBRyxNQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQVcsRUFBQyxDQUFDLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxLQUFLLEtBQUksR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDO1FBQy9KLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0o7QUFyRkQsa0NBcUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmNvbnN0IEVBU0lOR19WQUxVRVMgPSBbJ2xpbmVhcicsJ3F1YWRJbicsJ3F1YWRPdXQnLCdxdWFkSW5PdXQnLCdjdWJpY0luJywnY3ViaWNPdXQnLCdjdWJpY0luT3V0JyxcbiAgICAnc2luZUluJywnc2luZU91dCcsJ3NpbmVJbk91dCcsJ2JvdW5jZUluJywnYm91bmNlT3V0JywnYm91bmNlSW5PdXQnLFxuICAgICdlbGFzdGljSW4nLCdlbGFzdGljT3V0JywnZWxhc3RpY0luT3V0JywnYmFja0luJywnYmFja091dCcsJ2JhY2tJbk91dCddO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlVHdlZW4gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfdHdlZW4nO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBDb2NvcyBDcmVhdG9yIHR3ZWVucyBmb3Igbm9kZSBhbmltYXRpb24uIEFjdGlvbnM6IGNyZWF0ZSwgYWRkX3RvLCBhZGRfYnksIGFkZF9kZWxheSwgc3RvcF9hbGwsIGdldF9pbmZvLiBUd2VlbnMgYXJlIHJ1bnRpbWUtb25seSBhbmQgY29udHJvbCBub2RlIHByb3BlcnRpZXMgbGlrZSBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlLCBvcGFjaXR5IG92ZXIgdGltZS4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2NyZWF0ZScsICdhZGRfdG8nLCAnYWRkX2J5JywgJ2FkZF9kZWxheScsICdzdG9wX2FsbCcsICdnZXRfaW5mbyddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydjcmVhdGUnLCAnYWRkX3RvJywgJ2FkZF9ieScsICdhZGRfZGVsYXknLCAnc3RvcF9hbGwnLCAnZ2V0X2luZm8nXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogY3JlYXRlPWJ1aWxkK3N0YXJ0IHR3ZWVuIGZyb20gc3RlcHMsIGFkZF90bz1hYnNvbHV0ZSBwcm9wZXJ0eSB0d2VlbiwgYWRkX2J5PXJlbGF0aXZlIHByb3BlcnR5IHR3ZWVuLCBhZGRfZGVsYXk9ZGVsYXkgc3RlcCwgc3RvcF9hbGw9c3RvcCBhbGwgdHdlZW5zIG9uIG5vZGUsIGdldF9pbmZvPXR3ZWVuIHN5c3RlbSBpbmZvJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlLCBhZGRfdG8sIGFkZF9ieSwgYWRkX2RlbGF5LCBzdG9wX2FsbF0gVGFyZ2V0IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGVwczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBUd2VlbiBzdGVwIHNlcXVlbmNlLiBFYWNoIHN0ZXA6IHt0eXBlOlwidG9cInxcImJ5XCJ8XCJkZWxheVwifFwiY2FsbFwiLCBkdXJhdGlvbj8sIHByb3BlcnRpZXM/LCBlYXNpbmc/fScsXG4gICAgICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsndG8nLCAnYnknLCAnZGVsYXknLCAnY2FsbCddIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbjogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczogeyB0eXBlOiAnb2JqZWN0JywgZGVzY3JpcHRpb246ICdOb2RlIHByb3BlcnRpZXMgdG8gYW5pbWF0ZTogcG9zaXRpb257eCx5LHp9LCByb3RhdGlvbnt4LHksen0sIHNjYWxle3gseSx6fSwgb3BhY2l0eScgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVhc2luZzogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogRUFTSU5HX1ZBTFVFUyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF90bywgYWRkX2J5XSBQcm9wZXJ0aWVzIHRvIGFuaW1hdGUuIFN1cHBvcnRzOiBwb3NpdGlvbnt4LHksen0sIHJvdGF0aW9ue3gseSx6fSwgc2NhbGV7eCx5LHp9LCBvcGFjaXR5ICgwLTI1NSknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZHVyYXRpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRfdG8sIGFkZF9ieSwgYWRkX2RlbGF5XSBEdXJhdGlvbiBpbiBzZWNvbmRzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGVhc2luZzoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IEVBU0lOR19WQUxVRVMsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkX3RvLCBhZGRfYnldIEVhc2luZyBmdW5jdGlvbiBuYW1lJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVUd2VlbihhcmdzKSxcbiAgICAgICAgYWRkX3RvOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ2FkZFR3ZWVuVG8nLCBhcmdzLCBbJ25vZGVVdWlkJywgJ3Byb3BlcnRpZXMnLCAnZHVyYXRpb24nXSksXG4gICAgICAgIGFkZF9ieTogKGFyZ3MpID0+IHRoaXMuc2NlbmVDYWxsKCdhZGRUd2VlbkJ5JywgYXJncywgWydub2RlVXVpZCcsICdwcm9wZXJ0aWVzJywgJ2R1cmF0aW9uJ10pLFxuICAgICAgICBhZGRfZGVsYXk6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnYWRkVHdlZW5EZWxheScsIGFyZ3MsIFsnbm9kZVV1aWQnLCAnZHVyYXRpb24nXSksXG4gICAgICAgIHN0b3BfYWxsOiAoYXJncykgPT4gdGhpcy5zY2VuZUNhbGwoJ3N0b3BUd2VlbnMnLCBhcmdzLCBbJ25vZGVVdWlkJ10pLFxuICAgICAgICBnZXRfaW5mbzogYXN5bmMgKF9hcmdzKSA9PiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG5vdGU6ICdUd2VlbnMgYXJlIHJ1bnRpbWUtb25seS4gTm8gcGVyc2lzdGVudCB0d2VlbiBzdGF0ZSBpcyBleHBvc2VkIGJ5IENvY29zIENyZWF0b3IuJyxcbiAgICAgICAgICAgIHRpcDogJ1VzZSBjcmVhdGUvYWRkX3RvL2FkZF9ieSB0byBzdGFydCB0d2VlbnMuIFVzZSBzdG9wX2FsbCB0byBzdG9wIGJ5IG5vZGVVdWlkLidcbiAgICAgICAgfSksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgY3JlYXRlVHdlZW4oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgY3JlYXRlJyk7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShhcmdzLnN0ZXBzKSB8fCBhcmdzLnN0ZXBzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGVycm9yUmVzdWx0KCdzdGVwcyBhcnJheSBpcyByZXF1aXJlZCBmb3IgY3JlYXRlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2NyZWF0ZVR3ZWVuJywgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3Muc3RlcHNdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCAnVHdlZW4gY3JlYXRlZCBhbmQgc3RhcnRlZCcpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIGNyZWF0ZSB0d2VlbicpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzY2VuZUNhbGwobWV0aG9kOiBzdHJpbmcsIGFyZ3M6IGFueSwgcmVxdWlyZWQ6IHN0cmluZ1tdKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGZvciAoY29uc3QgciBvZiByZXF1aXJlZCkge1xuICAgICAgICAgICAgaWYgKGFyZ3Nbcl0gPT09IHVuZGVmaW5lZCB8fCBhcmdzW3JdID09PSBudWxsKSByZXR1cm4gZXJyb3JSZXN1bHQoYCR7cn0gaXMgcmVxdWlyZWRgKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbWV0aG9kQXJncyA9IG1ldGhvZCA9PT0gJ2FkZFR3ZWVuVG8nIHx8IG1ldGhvZCA9PT0gJ2FkZFR3ZWVuQnknXG4gICAgICAgICAgICAgICAgPyBbYXJncy5ub2RlVXVpZCwgYXJncy5wcm9wZXJ0aWVzLCBhcmdzLmR1cmF0aW9uLCBhcmdzLmVhc2luZyB8fCAnbGluZWFyJ11cbiAgICAgICAgICAgICAgICA6IG1ldGhvZCA9PT0gJ2FkZFR3ZWVuRGVsYXknXG4gICAgICAgICAgICAgICAgPyBbYXJncy5ub2RlVXVpZCwgYXJncy5kdXJhdGlvbl1cbiAgICAgICAgICAgICAgICA6IFthcmdzLm5vZGVVdWlkXTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kLCBhcmdzOiBtZXRob2RBcmdzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCAocmVzdWx0IGFzIGFueSkubWVzc2FnZSkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8IGAke21ldGhvZH0gZmFpbGVkYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG59XG4iXX0=