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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXR3ZWVuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS10d2Vlbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQU0sYUFBYSxHQUFHLENBQUMsUUFBUSxFQUFDLFFBQVEsRUFBQyxTQUFTLEVBQUMsV0FBVyxFQUFDLFNBQVMsRUFBQyxVQUFVLEVBQUMsWUFBWTtJQUM1RixRQUFRLEVBQUMsU0FBUyxFQUFDLFdBQVcsRUFBQyxVQUFVLEVBQUMsV0FBVyxFQUFDLGFBQWE7SUFDbkUsV0FBVyxFQUFDLFlBQVksRUFBQyxjQUFjLEVBQUMsUUFBUSxFQUFDLFNBQVMsRUFBQyxXQUFXLENBQUMsQ0FBQztBQUU1RSxNQUFhLFdBQVksU0FBUSxpQ0FBYztJQUEvQzs7UUFDYSxTQUFJLEdBQUcsY0FBYyxDQUFDO1FBQ3RCLGdCQUFXLEdBQUcsd05BQXdOLENBQUM7UUFDdk8sWUFBTyxHQUFHLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM5RSxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQztvQkFDekUsV0FBVyxFQUFFLGlNQUFpTTtpQkFDak47Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxnRUFBZ0U7aUJBQ2hGO2dCQUNELEtBQUssRUFBRTtvQkFDSCxJQUFJLEVBQUUsT0FBTztvQkFDYixXQUFXLEVBQUUsMkdBQTJHO29CQUN4SCxLQUFLLEVBQUU7d0JB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QWtCLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVO2FBQ3JELENBQUMsQ0FBQztZQUNILE9BQU8sQ0FBQyxNQUFjLGFBQWQsTUFBTSx1QkFBTixNQUFNLENBQVUsT0FBTyxFQUFDLENBQUMsQ0FBQyxJQUFBLHFCQUFhLEVBQUUsTUFBYyxDQUFDLElBQUksRUFBRyxNQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQVcsRUFBQyxDQUFDLE1BQWMsYUFBZCxNQUFNLHVCQUFOLE1BQU0sQ0FBVSxLQUFLLEtBQUksR0FBRyxNQUFNLFNBQVMsQ0FBQyxDQUFDO1FBQy9KLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0o7QUFyRkQsa0NBcUZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmNvbnN0IEVBU0lOR19WQUxVRVMgPSBbJ2xpbmVhcicsJ3F1YWRJbicsJ3F1YWRPdXQnLCdxdWFkSW5PdXQnLCdjdWJpY0luJywnY3ViaWNPdXQnLCdjdWJpY0luT3V0JyxcclxuICAgICdzaW5lSW4nLCdzaW5lT3V0Jywnc2luZUluT3V0JywnYm91bmNlSW4nLCdib3VuY2VPdXQnLCdib3VuY2VJbk91dCcsXHJcbiAgICAnZWxhc3RpY0luJywnZWxhc3RpY091dCcsJ2VsYXN0aWNJbk91dCcsJ2JhY2tJbicsJ2JhY2tPdXQnLCdiYWNrSW5PdXQnXTtcclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VUd2VlbiBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3R3ZWVuJztcclxuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ01hbmFnZSBDb2NvcyBDcmVhdG9yIHR3ZWVucyBmb3Igbm9kZSBhbmltYXRpb24uIEFjdGlvbnM6IGNyZWF0ZSwgYWRkX3RvLCBhZGRfYnksIGFkZF9kZWxheSwgc3RvcF9hbGwsIGdldF9pbmZvLiBUd2VlbnMgYXJlIHJ1bnRpbWUtb25seSBhbmQgY29udHJvbCBub2RlIHByb3BlcnRpZXMgbGlrZSBwb3NpdGlvbiwgcm90YXRpb24sIHNjYWxlLCBvcGFjaXR5IG92ZXIgdGltZS4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnY3JlYXRlJywgJ2FkZF90bycsICdhZGRfYnknLCAnYWRkX2RlbGF5JywgJ3N0b3BfYWxsJywgJ2dldF9pbmZvJ107XHJcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcclxuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NyZWF0ZScsICdhZGRfdG8nLCAnYWRkX2J5JywgJ2FkZF9kZWxheScsICdzdG9wX2FsbCcsICdnZXRfaW5mbyddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IGNyZWF0ZT1idWlsZCtzdGFydCB0d2VlbiBmcm9tIHN0ZXBzLCBhZGRfdG89YWJzb2x1dGUgcHJvcGVydHkgdHdlZW4sIGFkZF9ieT1yZWxhdGl2ZSBwcm9wZXJ0eSB0d2VlbiwgYWRkX2RlbGF5PWRlbGF5IHN0ZXAsIHN0b3BfYWxsPXN0b3AgYWxsIHR3ZWVucyBvbiBub2RlLCBnZXRfaW5mbz10d2VlbiBzeXN0ZW0gaW5mbydcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlLCBhZGRfdG8sIGFkZF9ieSwgYWRkX2RlbGF5LCBzdG9wX2FsbF0gVGFyZ2V0IG5vZGUgVVVJRCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3RlcHM6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVdIFR3ZWVuIHN0ZXAgc2VxdWVuY2UuIEVhY2ggc3RlcDoge3R5cGU6XCJ0b1wifFwiYnlcInxcImRlbGF5XCJ8XCJjYWxsXCIsIGR1cmF0aW9uPywgcHJvcGVydGllcz8sIGVhc2luZz99JyxcclxuICAgICAgICAgICAgICAgIGl0ZW1zOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ3RvJywgJ2J5JywgJ2RlbGF5JywgJ2NhbGwnXSB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbjogeyB0eXBlOiAnbnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7IHR5cGU6ICdvYmplY3QnLCBkZXNjcmlwdGlvbjogJ05vZGUgcHJvcGVydGllcyB0byBhbmltYXRlOiBwb3NpdGlvbnt4LHksen0sIHJvdGF0aW9ue3gseSx6fSwgc2NhbGV7eCx5LHp9LCBvcGFjaXR5JyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlYXNpbmc6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IEVBU0lOR19WQUxVRVMgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRfdG8sIGFkZF9ieV0gUHJvcGVydGllcyB0byBhbmltYXRlLiBTdXBwb3J0czogcG9zaXRpb257eCx5LHp9LCByb3RhdGlvbnt4LHksen0sIHNjYWxle3gseSx6fSwgb3BhY2l0eSAoMC0yNTUpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBkdXJhdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRfdG8sIGFkZF9ieSwgYWRkX2RlbGF5XSBEdXJhdGlvbiBpbiBzZWNvbmRzJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBlYXNpbmc6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogRUFTSU5HX1ZBTFVFUyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF90bywgYWRkX2J5XSBFYXNpbmcgZnVuY3Rpb24gbmFtZSdcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cclxuICAgIH07XHJcblxyXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XHJcbiAgICAgICAgY3JlYXRlOiAoYXJncykgPT4gdGhpcy5jcmVhdGVUd2VlbihhcmdzKSxcclxuICAgICAgICBhZGRfdG86IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnYWRkVHdlZW5UbycsIGFyZ3MsIFsnbm9kZVV1aWQnLCAncHJvcGVydGllcycsICdkdXJhdGlvbiddKSxcclxuICAgICAgICBhZGRfYnk6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnYWRkVHdlZW5CeScsIGFyZ3MsIFsnbm9kZVV1aWQnLCAncHJvcGVydGllcycsICdkdXJhdGlvbiddKSxcclxuICAgICAgICBhZGRfZGVsYXk6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnYWRkVHdlZW5EZWxheScsIGFyZ3MsIFsnbm9kZVV1aWQnLCAnZHVyYXRpb24nXSksXHJcbiAgICAgICAgc3RvcF9hbGw6IChhcmdzKSA9PiB0aGlzLnNjZW5lQ2FsbCgnc3RvcFR3ZWVucycsIGFyZ3MsIFsnbm9kZVV1aWQnXSksXHJcbiAgICAgICAgZ2V0X2luZm86IGFzeW5jIChfYXJncykgPT4gc3VjY2Vzc1Jlc3VsdCh7XHJcbiAgICAgICAgICAgIG5vdGU6ICdUd2VlbnMgYXJlIHJ1bnRpbWUtb25seS4gTm8gcGVyc2lzdGVudCB0d2VlbiBzdGF0ZSBpcyBleHBvc2VkIGJ5IENvY29zIENyZWF0b3IuJyxcclxuICAgICAgICAgICAgdGlwOiAnVXNlIGNyZWF0ZS9hZGRfdG8vYWRkX2J5IHRvIHN0YXJ0IHR3ZWVucy4gVXNlIHN0b3BfYWxsIHRvIHN0b3AgYnkgbm9kZVV1aWQuJ1xyXG4gICAgICAgIH0pLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVR3ZWVuKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgY3JlYXRlJyk7XHJcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGFyZ3Muc3RlcHMpIHx8IGFyZ3Muc3RlcHMubGVuZ3RoID09PSAwKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3N0ZXBzIGFycmF5IGlzIHJlcXVpcmVkIGZvciBjcmVhdGUnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnY3JlYXRlVHdlZW4nLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5zdGVwc11cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCAnVHdlZW4gY3JlYXRlZCBhbmQgc3RhcnRlZCcpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIGNyZWF0ZSB0d2VlbicpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNjZW5lQ2FsbChtZXRob2Q6IHN0cmluZywgYXJnczogYW55LCByZXF1aXJlZDogc3RyaW5nW10pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBmb3IgKGNvbnN0IHIgb2YgcmVxdWlyZWQpIHtcclxuICAgICAgICAgICAgaWYgKGFyZ3Nbcl0gPT09IHVuZGVmaW5lZCB8fCBhcmdzW3JdID09PSBudWxsKSByZXR1cm4gZXJyb3JSZXN1bHQoYCR7cn0gaXMgcmVxdWlyZWRgKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgbWV0aG9kQXJncyA9IG1ldGhvZCA9PT0gJ2FkZFR3ZWVuVG8nIHx8IG1ldGhvZCA9PT0gJ2FkZFR3ZWVuQnknXHJcbiAgICAgICAgICAgICAgICA/IFthcmdzLm5vZGVVdWlkLCBhcmdzLnByb3BlcnRpZXMsIGFyZ3MuZHVyYXRpb24sIGFyZ3MuZWFzaW5nIHx8ICdsaW5lYXInXVxyXG4gICAgICAgICAgICAgICAgOiBtZXRob2QgPT09ICdhZGRUd2VlbkRlbGF5J1xyXG4gICAgICAgICAgICAgICAgPyBbYXJncy5ub2RlVXVpZCwgYXJncy5kdXJhdGlvbl1cclxuICAgICAgICAgICAgICAgIDogW2FyZ3Mubm9kZVV1aWRdO1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kLCBhcmdzOiBtZXRob2RBcmdzXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSwgKHJlc3VsdCBhcyBhbnkpLm1lc3NhZ2UpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCBgJHttZXRob2R9IGZhaWxlZGApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxufVxyXG4iXX0=