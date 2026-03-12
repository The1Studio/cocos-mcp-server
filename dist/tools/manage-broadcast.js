"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageBroadcast = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const normalize_1 = require("../utils/normalize");
class ManageBroadcast extends base_action_tool_1.BaseActionTool {
    constructor() {
        super();
        this.name = 'manage_broadcast';
        this.description = 'Manage editor broadcast event listeners and message log. Actions: get_log, listen, stop, clear, get_listeners.';
        this.actions = ['get_log', 'listen', 'stop', 'clear', 'get_listeners'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: this.actions,
                    description: 'Action to perform'
                },
                limit: {
                    type: 'number',
                    description: 'Number of recent messages to return (get_log only)',
                    default: 50
                },
                messageType: {
                    type: 'string',
                    description: 'Broadcast message type to filter or target (get_log, listen, stop)'
                }
            },
            required: ['action']
        };
        this.listeners = new Map();
        this.messageLog = [];
        this.actionHandlers = {
            get_log: (args) => { var _a; return this.getLog((_a = (0, normalize_1.coerceInt)(args.limit)) !== null && _a !== void 0 ? _a : 50, args.messageType); },
            listen: (args) => this.listen(args.messageType),
            stop: (args) => this.stop(args.messageType),
            clear: () => this.clear(),
            get_listeners: () => this.getListeners(),
        };
        this.setupBroadcastListeners();
    }
    setupBroadcastListeners() {
        const importantMessages = [
            'build-worker:ready',
            'build-worker:closed',
            'scene:ready',
            'scene:close',
            'scene:light-probe-edit-mode-changed',
            'scene:light-probe-bounding-box-edit-mode-changed',
            'asset-db:ready',
            'asset-db:close',
            'asset-db:asset-add',
            'asset-db:asset-change',
            'asset-db:asset-delete'
        ];
        importantMessages.forEach(messageType => {
            this.addBroadcastListener(messageType);
        });
    }
    addBroadcastListener(messageType) {
        const listener = (data) => {
            this.messageLog.push({
                message: messageType,
                data,
                timestamp: Date.now()
            });
            // Keep log size reasonable
            if (this.messageLog.length > 1000) {
                this.messageLog = this.messageLog.slice(-500);
            }
            console.log(`[Broadcast] ${messageType}:`, data);
        };
        if (!this.listeners.has(messageType)) {
            this.listeners.set(messageType, []);
        }
        this.listeners.get(messageType).push(listener);
        // Editor.Message.on(messageType, listener); -- API may not support
        console.log(`[ManageBroadcast] Added listener for ${messageType} (simulated)`);
    }
    removeBroadcastListener(messageType) {
        const listeners = this.listeners.get(messageType);
        if (listeners) {
            listeners.forEach(() => {
                // Editor.Message.off(messageType, listener);
                console.log(`[ManageBroadcast] Removed listener for ${messageType} (simulated)`);
            });
            this.listeners.delete(messageType);
        }
    }
    async getLog(limit = 50, messageType) {
        let filteredLog = this.messageLog;
        if (messageType) {
            filteredLog = this.messageLog.filter(entry => entry.message === messageType);
        }
        const recentLog = filteredLog.slice(-limit).map(entry => (Object.assign(Object.assign({}, entry), { timestamp: new Date(entry.timestamp).toISOString() })));
        return (0, types_1.successResult)({
            log: recentLog,
            count: recentLog.length,
            totalCount: filteredLog.length,
            filter: messageType || 'all',
            message: 'Broadcast log retrieved successfully'
        });
    }
    async listen(messageType) {
        if (!messageType) {
            return (0, types_1.errorResult)('messageType is required for listen action');
        }
        if (!this.listeners.has(messageType)) {
            this.addBroadcastListener(messageType);
            return (0, types_1.successResult)({
                messageType,
                message: `Started listening for broadcast: ${messageType}`
            });
        }
        return (0, types_1.successResult)({
            messageType,
            message: `Already listening for broadcast: ${messageType}`
        });
    }
    async stop(messageType) {
        if (!messageType) {
            return (0, types_1.errorResult)('messageType is required for stop action');
        }
        if (this.listeners.has(messageType)) {
            this.removeBroadcastListener(messageType);
            return (0, types_1.successResult)({
                messageType,
                message: `Stopped listening for broadcast: ${messageType}`
            });
        }
        return (0, types_1.successResult)({
            messageType,
            message: `Was not listening for broadcast: ${messageType}`
        });
    }
    async clear() {
        const previousCount = this.messageLog.length;
        this.messageLog = [];
        return (0, types_1.successResult)({
            clearedCount: previousCount,
            message: 'Broadcast log cleared successfully'
        });
    }
    async getListeners() {
        const activeListeners = Array.from(this.listeners.keys()).map(messageType => {
            var _a;
            return ({
                messageType,
                listenerCount: ((_a = this.listeners.get(messageType)) === null || _a === void 0 ? void 0 : _a.length) || 0
            });
        });
        return (0, types_1.successResult)({
            listeners: activeListeners,
            count: activeListeners.length,
            message: 'Active listeners retrieved successfully'
        });
    }
}
exports.ManageBroadcast = ManageBroadcast;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWJyb2FkY2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtYnJvYWRjYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsa0RBQStDO0FBRS9DLE1BQWEsZUFBZ0IsU0FBUSxpQ0FBYztJQTRCL0M7UUFDSSxLQUFLLEVBQUUsQ0FBQztRQTVCSCxTQUFJLEdBQUcsa0JBQWtCLENBQUM7UUFDMUIsZ0JBQVcsR0FBRyxnSEFBZ0gsQ0FBQztRQUMvSCxZQUFPLEdBQUcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDbEUsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNsQixXQUFXLEVBQUUsbUJBQW1CO2lCQUNuQztnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG9EQUFvRDtvQkFDakUsT0FBTyxFQUFFLEVBQUU7aUJBQ2Q7Z0JBQ0QsV0FBVyxFQUFFO29CQUNULElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvRUFBb0U7aUJBQ3BGO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVNLGNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMvQyxlQUFVLEdBQTZELEVBQUUsQ0FBQztRQU94RSxtQkFBYyxHQUE2RTtZQUNqRyxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFDLE9BQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFBLElBQUEscUJBQVMsRUFBQyxJQUFJLENBQUMsS0FBSyxD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QkFBYSxFQUFDO1lBQ2pCLFNBQVMsRUFBRSxlQUFlO1lBQzFCLEtBQUssRUFBRSxlQUFlLENBQUMsTUFBTTtZQUM3QixPQUFPLEVBQUUseUNBQXlDO1NBQ3JELENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQTdLRCwwQ0E2S0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGNvZXJjZUludCB9IGZyb20gJy4uL3V0aWxzL25vcm1hbGl6ZSc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VCcm9hZGNhc3QgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfYnJvYWRjYXN0JztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgZWRpdG9yIGJyb2FkY2FzdCBldmVudCBsaXN0ZW5lcnMgYW5kIG1lc3NhZ2UgbG9nLiBBY3Rpb25zOiBnZXRfbG9nLCBsaXN0ZW4sIHN0b3AsIGNsZWFyLCBnZXRfbGlzdGVuZXJzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0X2xvZycsICdsaXN0ZW4nLCAnc3RvcCcsICdjbGVhcicsICdnZXRfbGlzdGVuZXJzJ107XG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiB0aGlzLmFjdGlvbnMsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBsaW1pdDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTnVtYmVyIG9mIHJlY2VudCBtZXNzYWdlcyB0byByZXR1cm4gKGdldF9sb2cgb25seSknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDUwXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWVzc2FnZVR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0Jyb2FkY2FzdCBtZXNzYWdlIHR5cGUgdG8gZmlsdGVyIG9yIHRhcmdldCAoZ2V0X2xvZywgbGlzdGVuLCBzdG9wKSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBsaXN0ZW5lcnM6IE1hcDxzdHJpbmcsIEZ1bmN0aW9uW10+ID0gbmV3IE1hcCgpO1xuICAgIHByaXZhdGUgbWVzc2FnZUxvZzogQXJyYXk8eyBtZXNzYWdlOiBzdHJpbmc7IGRhdGE6IGFueTsgdGltZXN0YW1wOiBudW1iZXIgfT4gPSBbXTtcblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnNldHVwQnJvYWRjYXN0TGlzdGVuZXJzKCk7XG4gICAgfVxuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGdldF9sb2c6IChhcmdzKSA9PiB0aGlzLmdldExvZyhjb2VyY2VJbnQoYXJncy5saW1pdCkgPz8gNTAsIGFyZ3MubWVzc2FnZVR5cGUpLFxuICAgICAgICBsaXN0ZW46IChhcmdzKSA9PiB0aGlzLmxpc3RlbihhcmdzLm1lc3NhZ2VUeXBlKSxcbiAgICAgICAgc3RvcDogKGFyZ3MpID0+IHRoaXMuc3RvcChhcmdzLm1lc3NhZ2VUeXBlKSxcbiAgICAgICAgY2xlYXI6ICgpID0+IHRoaXMuY2xlYXIoKSxcbiAgICAgICAgZ2V0X2xpc3RlbmVyczogKCkgPT4gdGhpcy5nZXRMaXN0ZW5lcnMoKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBzZXR1cEJyb2FkY2FzdExpc3RlbmVycygpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgaW1wb3J0YW50TWVzc2FnZXMgPSBbXG4gICAgICAgICAgICAnYnVpbGQtd29ya2VyOnJlYWR5JyxcbiAgICAgICAgICAgICdidWlsZC13b3JrZXI6Y2xvc2VkJyxcbiAgICAgICAgICAgICdzY2VuZTpyZWFkeScsXG4gICAgICAgICAgICAnc2NlbmU6Y2xvc2UnLFxuICAgICAgICAgICAgJ3NjZW5lOmxpZ2h0LXByb2JlLWVkaXQtbW9kZS1jaGFuZ2VkJyxcbiAgICAgICAgICAgICdzY2VuZTpsaWdodC1wcm9iZS1ib3VuZGluZy1ib3gtZWRpdC1tb2RlLWNoYW5nZWQnLFxuICAgICAgICAgICAgJ2Fzc2V0LWRiOnJlYWR5JyxcbiAgICAgICAgICAgICdhc3NldC1kYjpjbG9zZScsXG4gICAgICAgICAgICAnYXNzZXQtZGI6YXNzZXQtYWRkJyxcbiAgICAgICAgICAgICdhc3NldC1kYjphc3NldC1jaGFuZ2UnLFxuICAgICAgICAgICAgJ2Fzc2V0LWRiOmFzc2V0LWRlbGV0ZSdcbiAgICAgICAgXTtcblxuICAgICAgICBpbXBvcnRhbnRNZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2VUeXBlID0+IHtcbiAgICAgICAgICAgIHRoaXMuYWRkQnJvYWRjYXN0TGlzdGVuZXIobWVzc2FnZVR5cGUpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFkZEJyb2FkY2FzdExpc3RlbmVyKG1lc3NhZ2VUeXBlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB7XG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2VMb2cucHVzaCh7XG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVR5cGUsXG4gICAgICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IERhdGUubm93KClcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBLZWVwIGxvZyBzaXplIHJlYXNvbmFibGVcbiAgICAgICAgICAgIGlmICh0aGlzLm1lc3NhZ2VMb2cubGVuZ3RoID4gMTAwMCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnZUxvZyA9IHRoaXMubWVzc2FnZUxvZy5zbGljZSgtNTAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtCcm9hZGNhc3RdICR7bWVzc2FnZVR5cGV9OmAsIGRhdGEpO1xuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMuaGFzKG1lc3NhZ2VUeXBlKSkge1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnMuc2V0KG1lc3NhZ2VUeXBlLCBbXSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5saXN0ZW5lcnMuZ2V0KG1lc3NhZ2VUeXBlKSEucHVzaChsaXN0ZW5lcik7XG5cbiAgICAgICAgLy8gRWRpdG9yLk1lc3NhZ2Uub24obWVzc2FnZVR5cGUsIGxpc3RlbmVyKTsgLS0gQVBJIG1heSBub3Qgc3VwcG9ydFxuICAgICAgICBjb25zb2xlLmxvZyhgW01hbmFnZUJyb2FkY2FzdF0gQWRkZWQgbGlzdGVuZXIgZm9yICR7bWVzc2FnZVR5cGV9IChzaW11bGF0ZWQpYCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZW1vdmVCcm9hZGNhc3RMaXN0ZW5lcihtZXNzYWdlVHlwZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGNvbnN0IGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzLmdldChtZXNzYWdlVHlwZSk7XG4gICAgICAgIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGxpc3RlbmVycy5mb3JFYWNoKCgpID0+IHtcbiAgICAgICAgICAgICAgICAvLyBFZGl0b3IuTWVzc2FnZS5vZmYobWVzc2FnZVR5cGUsIGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgW01hbmFnZUJyb2FkY2FzdF0gUmVtb3ZlZCBsaXN0ZW5lciBmb3IgJHttZXNzYWdlVHlwZX0gKHNpbXVsYXRlZClgKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgdGhpcy5saXN0ZW5lcnMuZGVsZXRlKG1lc3NhZ2VUeXBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZ2V0TG9nKGxpbWl0OiBudW1iZXIgPSA1MCwgbWVzc2FnZVR5cGU/OiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgbGV0IGZpbHRlcmVkTG9nID0gdGhpcy5tZXNzYWdlTG9nO1xuXG4gICAgICAgIGlmIChtZXNzYWdlVHlwZSkge1xuICAgICAgICAgICAgZmlsdGVyZWRMb2cgPSB0aGlzLm1lc3NhZ2VMb2cuZmlsdGVyKGVudHJ5ID0+IGVudHJ5Lm1lc3NhZ2UgPT09IG1lc3NhZ2VUeXBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlY2VudExvZyA9IGZpbHRlcmVkTG9nLnNsaWNlKC1saW1pdCkubWFwKGVudHJ5ID0+ICh7XG4gICAgICAgICAgICAuLi5lbnRyeSxcbiAgICAgICAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoZW50cnkudGltZXN0YW1wKS50b0lTT1N0cmluZygpXG4gICAgICAgIH0pKTtcblxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICBsb2c6IHJlY2VudExvZyxcbiAgICAgICAgICAgIGNvdW50OiByZWNlbnRMb2cubGVuZ3RoLFxuICAgICAgICAgICAgdG90YWxDb3VudDogZmlsdGVyZWRMb2cubGVuZ3RoLFxuICAgICAgICAgICAgZmlsdGVyOiBtZXNzYWdlVHlwZSB8fCAnYWxsJyxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdCcm9hZGNhc3QgbG9nIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgbGlzdGVuKG1lc3NhZ2VUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFtZXNzYWdlVHlwZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdtZXNzYWdlVHlwZSBpcyByZXF1aXJlZCBmb3IgbGlzdGVuIGFjdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMuaGFzKG1lc3NhZ2VUeXBlKSkge1xuICAgICAgICAgICAgdGhpcy5hZGRCcm9hZGNhc3RMaXN0ZW5lcihtZXNzYWdlVHlwZSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgbWVzc2FnZVR5cGUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogYFN0YXJ0ZWQgbGlzdGVuaW5nIGZvciBicm9hZGNhc3Q6ICR7bWVzc2FnZVR5cGV9YFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgbWVzc2FnZVR5cGUsXG4gICAgICAgICAgICBtZXNzYWdlOiBgQWxyZWFkeSBsaXN0ZW5pbmcgZm9yIGJyb2FkY2FzdDogJHttZXNzYWdlVHlwZX1gXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc3RvcChtZXNzYWdlVHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghbWVzc2FnZVR5cGUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbWVzc2FnZVR5cGUgaXMgcmVxdWlyZWQgZm9yIHN0b3AgYWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMubGlzdGVuZXJzLmhhcyhtZXNzYWdlVHlwZSkpIHtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQnJvYWRjYXN0TGlzdGVuZXIobWVzc2FnZVR5cGUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2VUeXBlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBTdG9wcGVkIGxpc3RlbmluZyBmb3IgYnJvYWRjYXN0OiAke21lc3NhZ2VUeXBlfWBcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG1lc3NhZ2VUeXBlLFxuICAgICAgICAgICAgbWVzc2FnZTogYFdhcyBub3QgbGlzdGVuaW5nIGZvciBicm9hZGNhc3Q6ICR7bWVzc2FnZVR5cGV9YFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGNsZWFyKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBwcmV2aW91c0NvdW50ID0gdGhpcy5tZXNzYWdlTG9nLmxlbmd0aDtcbiAgICAgICAgdGhpcy5tZXNzYWdlTG9nID0gW107XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIGNsZWFyZWRDb3VudDogcHJldmlvdXNDb3VudCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdCcm9hZGNhc3QgbG9nIGNsZWFyZWQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldExpc3RlbmVycygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgYWN0aXZlTGlzdGVuZXJzID0gQXJyYXkuZnJvbSh0aGlzLmxpc3RlbmVycy5rZXlzKCkpLm1hcChtZXNzYWdlVHlwZSA9PiAoe1xuICAgICAgICAgICAgbWVzc2FnZVR5cGUsXG4gICAgICAgICAgICBsaXN0ZW5lckNvdW50OiB0aGlzLmxpc3RlbmVycy5nZXQobWVzc2FnZVR5cGUpPy5sZW5ndGggfHwgMFxuICAgICAgICB9KSk7XG5cbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgbGlzdGVuZXJzOiBhY3RpdmVMaXN0ZW5lcnMsXG4gICAgICAgICAgICBjb3VudDogYWN0aXZlTGlzdGVuZXJzLmxlbmd0aCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdBY3RpdmUgbGlzdGVuZXJzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdfQ==