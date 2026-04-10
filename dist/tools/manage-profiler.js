"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageProfiler = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageProfiler extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_profiler';
        this.description = 'Access runtime performance profiling data. Actions: get_stats, get_memory, toggle_stats_display, get_draw_calls. Reads FPS, draw calls, triangles, node count, and memory usage from the running scene.';
        this.actions = ['get_stats', 'get_memory', 'toggle_stats_display', 'get_draw_calls'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_stats', 'get_memory', 'toggle_stats_display', 'get_draw_calls'],
                    description: 'Action: get_stats=get FPS/drawCalls/triangles/nodeCount, get_memory=get memory usage, toggle_stats_display=show/hide stats overlay, get_draw_calls=get draw call breakdown'
                },
                visible: { type: 'boolean', description: '[toggle_stats_display] Force show (true) or hide (false); omit to toggle' }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_stats: (args) => this.getStats(args),
            get_memory: (args) => this.getMemory(args),
            toggle_stats_display: (args) => this.toggleStatsDisplay(args),
            get_draw_calls: (args) => this.getDrawCalls(args),
        };
    }
    async getStats(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getPerformanceStats', args: []
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getMemory(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getMemoryStats', args: []
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async toggleStatsDisplay(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'toggleStatsDisplay', args: [args.visible]
            });
            return (0, types_1.successResult)(result, 'Stats display toggled');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getDrawCalls(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getDrawCallStats', args: []
            });
            return (0, types_1.successResult)(result);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageProfiler = ManageProfiler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXByb2ZpbGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1wcm9maWxlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsY0FBZSxTQUFRLGlDQUFjO0lBQWxEOztRQUNhLFNBQUksR0FBRyxpQkFBaUIsQ0FBQztRQUN6QixnQkFBVyxHQUFHLHlNQUF5TSxDQUFDO1FBQ3hOLFlBQU8sR0FBRyxDQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUsc0JBQXNCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUNoRixnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxXQUFXLEVBQUUsWUFBWSxFQUFFLHNCQUFzQixFQUFFLGdCQUFnQixDQUFDO29CQUMzRSxXQUFXLEVBQUUsNEtBQTRLO2lCQUM1TDtnQkFDRCxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSwwRUFBMEUsRUFBRTthQUN4SDtZQUNELFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO1FBRVEsbUJBQWMsR0FBNkU7WUFDakcsU0FBUyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztZQUN4QyxVQUFVLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1lBQzFDLG9CQUFvQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDO1lBQzdELGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUM7U0FDcEQsQ0FBQztJQXFDTixDQUFDO0lBbkNXLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBVTtRQUM3QixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxxQkFBcUIsRUFBRSxJQUFJLEVBQUUsRUFBRTthQUNwRSxDQUFDLENBQUM7WUFDSCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBVTtRQUM5QixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLEVBQUUsRUFBRTthQUMvRCxDQUFDLENBQUM7WUFDSCxPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxJQUFTO1FBQ3RDLElBQUksQ0FBQztZQUNELE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHNCQUFzQixFQUFFO2dCQUN6RSxJQUFJLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxFQUFFLG9CQUFvQixFQUFFLElBQUksRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUM7YUFDL0UsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxFQUFFLHVCQUF1QixDQUFDLENBQUM7UUFDMUQsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7SUFFTyxLQUFLLENBQUMsWUFBWSxDQUFDLEtBQVU7UUFDakMsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUU7Z0JBQ3pFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxFQUFFLEVBQUU7YUFDakUsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFBLHFCQUFhLEVBQUMsTUFBTSxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7Q0FDSjtBQTNERCx3Q0EyREMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVByb2ZpbGVyIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3Byb2ZpbGVyJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdBY2Nlc3MgcnVudGltZSBwZXJmb3JtYW5jZSBwcm9maWxpbmcgZGF0YS4gQWN0aW9uczogZ2V0X3N0YXRzLCBnZXRfbWVtb3J5LCB0b2dnbGVfc3RhdHNfZGlzcGxheSwgZ2V0X2RyYXdfY2FsbHMuIFJlYWRzIEZQUywgZHJhdyBjYWxscywgdHJpYW5nbGVzLCBub2RlIGNvdW50LCBhbmQgbWVtb3J5IHVzYWdlIGZyb20gdGhlIHJ1bm5pbmcgc2NlbmUuJztcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydnZXRfc3RhdHMnLCAnZ2V0X21lbW9yeScsICd0b2dnbGVfc3RhdHNfZGlzcGxheScsICdnZXRfZHJhd19jYWxscyddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydnZXRfc3RhdHMnLCAnZ2V0X21lbW9yeScsICd0b2dnbGVfc3RhdHNfZGlzcGxheScsICdnZXRfZHJhd19jYWxscyddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBnZXRfc3RhdHM9Z2V0IEZQUy9kcmF3Q2FsbHMvdHJpYW5nbGVzL25vZGVDb3VudCwgZ2V0X21lbW9yeT1nZXQgbWVtb3J5IHVzYWdlLCB0b2dnbGVfc3RhdHNfZGlzcGxheT1zaG93L2hpZGUgc3RhdHMgb3ZlcmxheSwgZ2V0X2RyYXdfY2FsbHM9Z2V0IGRyYXcgY2FsbCBicmVha2Rvd24nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmlzaWJsZTogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3RvZ2dsZV9zdGF0c19kaXNwbGF5XSBGb3JjZSBzaG93ICh0cnVlKSBvciBoaWRlIChmYWxzZSk7IG9taXQgdG8gdG9nZ2xlJyB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBnZXRfc3RhdHM6IChhcmdzKSA9PiB0aGlzLmdldFN0YXRzKGFyZ3MpLFxuICAgICAgICBnZXRfbWVtb3J5OiAoYXJncykgPT4gdGhpcy5nZXRNZW1vcnkoYXJncyksXG4gICAgICAgIHRvZ2dsZV9zdGF0c19kaXNwbGF5OiAoYXJncykgPT4gdGhpcy50b2dnbGVTdGF0c0Rpc3BsYXkoYXJncyksXG4gICAgICAgIGdldF9kcmF3X2NhbGxzOiAoYXJncykgPT4gdGhpcy5nZXREcmF3Q2FsbHMoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U3RhdHMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRQZXJmb3JtYW5jZVN0YXRzJywgYXJnczogW11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TWVtb3J5KF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0TWVtb3J5U3RhdHMnLCBhcmdzOiBbXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyB0b2dnbGVTdGF0c0Rpc3BsYXkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3RvZ2dsZVN0YXRzRGlzcGxheScsIGFyZ3M6IFthcmdzLnZpc2libGVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdCwgJ1N0YXRzIGRpc3BsYXkgdG9nZ2xlZCcpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXREcmF3Q2FsbHMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXREcmF3Q2FsbFN0YXRzJywgYXJnczogW11cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cbn1cbiJdfQ==