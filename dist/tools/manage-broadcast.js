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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWJyb2FkY2FzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2UtYnJvYWRjYXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsa0RBQStDO0FBRS9DLE1BQWEsZUFBZ0IsU0FBUSxpQ0FBYztJQTRCL0M7UUFDSSxLQUFLLEVBQUUsQ0FBQztRQTVCSCxTQUFJLEdBQUcsa0JBQWtCLENBQUM7UUFDMUIsZ0JBQVcsR0FBRyxnSEFBZ0gsQ0FBQztRQUMvSCxZQUFPLEdBQUcsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsZUFBZSxDQUFDLENBQUM7UUFDbEUsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPO29CQUNsQixXQUFXLEVBQUUsbUJBQW1CO2lCQUNuQztnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLG9EQUFvRDtvQkFDakUsT0FBTyxFQUFFLEVBQUU7aUJBQ2Q7Z0JBQ0QsV0FBVyxFQUFFO29CQUNULElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxvRUFBb0U7aUJBQ3BGO2FBQ0o7WUFDRCxRQUFRLEVBQUUsQ0FBQyxRQUFRLENBQUM7U0FDdkIsQ0FBQztRQUVNLGNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUMvQyxlQUFVLEdBQTZELEVBQUUsQ0FBQztRQU94RSxtQkFBYyxHQUE2RTtZQUNqRyxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxXQUFDLE9BQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFBLElBQUEscUJBQVMsRUFBQyxJQUFJLENBQUMsS0FBSyxD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QkFBYSxFQUFDO1lBQ2pCLFNBQVMsRUFBRSxlQUFlO1lBQzFCLEtBQUssRUFBRSxlQUFlLENBQUMsTUFBTTtZQUM3QixPQUFPLEVBQUUseUNBQXlDO1NBQ3JELENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQTdLRCwwQ0E2S0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBjb2VyY2VJbnQgfSBmcm9tICcuLi91dGlscy9ub3JtYWxpemUnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZUJyb2FkY2FzdCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX2Jyb2FkY2FzdCc7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgZWRpdG9yIGJyb2FkY2FzdCBldmVudCBsaXN0ZW5lcnMgYW5kIG1lc3NhZ2UgbG9nLiBBY3Rpb25zOiBnZXRfbG9nLCBsaXN0ZW4sIHN0b3AsIGNsZWFyLCBnZXRfbGlzdGVuZXJzLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydnZXRfbG9nJywgJ2xpc3RlbicsICdzdG9wJywgJ2NsZWFyJywgJ2dldF9saXN0ZW5lcnMnXTtcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGxpbWl0OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTnVtYmVyIG9mIHJlY2VudCBtZXNzYWdlcyB0byByZXR1cm4gKGdldF9sb2cgb25seSknLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogNTBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbWVzc2FnZVR5cGU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdCcm9hZGNhc3QgbWVzc2FnZSB0eXBlIHRvIGZpbHRlciBvciB0YXJnZXQgKGdldF9sb2csIGxpc3Rlbiwgc3RvcCknXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByaXZhdGUgbGlzdGVuZXJzOiBNYXA8c3RyaW5nLCBGdW5jdGlvbltdPiA9IG5ldyBNYXAoKTtcclxuICAgIHByaXZhdGUgbWVzc2FnZUxvZzogQXJyYXk8eyBtZXNzYWdlOiBzdHJpbmc7IGRhdGE6IGFueTsgdGltZXN0YW1wOiBudW1iZXIgfT4gPSBbXTtcclxuXHJcbiAgICBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgIHRoaXMuc2V0dXBCcm9hZGNhc3RMaXN0ZW5lcnMoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcclxuICAgICAgICBnZXRfbG9nOiAoYXJncykgPT4gdGhpcy5nZXRMb2coY29lcmNlSW50KGFyZ3MubGltaXQpID8/IDUwLCBhcmdzLm1lc3NhZ2VUeXBlKSxcclxuICAgICAgICBsaXN0ZW46IChhcmdzKSA9PiB0aGlzLmxpc3RlbihhcmdzLm1lc3NhZ2VUeXBlKSxcclxuICAgICAgICBzdG9wOiAoYXJncykgPT4gdGhpcy5zdG9wKGFyZ3MubWVzc2FnZVR5cGUpLFxyXG4gICAgICAgIGNsZWFyOiAoKSA9PiB0aGlzLmNsZWFyKCksXHJcbiAgICAgICAgZ2V0X2xpc3RlbmVyczogKCkgPT4gdGhpcy5nZXRMaXN0ZW5lcnMoKSxcclxuICAgIH07XHJcblxyXG4gICAgcHJpdmF0ZSBzZXR1cEJyb2FkY2FzdExpc3RlbmVycygpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBpbXBvcnRhbnRNZXNzYWdlcyA9IFtcclxuICAgICAgICAgICAgJ2J1aWxkLXdvcmtlcjpyZWFkeScsXHJcbiAgICAgICAgICAgICdidWlsZC13b3JrZXI6Y2xvc2VkJyxcclxuICAgICAgICAgICAgJ3NjZW5lOnJlYWR5JyxcclxuICAgICAgICAgICAgJ3NjZW5lOmNsb3NlJyxcclxuICAgICAgICAgICAgJ3NjZW5lOmxpZ2h0LXByb2JlLWVkaXQtbW9kZS1jaGFuZ2VkJyxcclxuICAgICAgICAgICAgJ3NjZW5lOmxpZ2h0LXByb2JlLWJvdW5kaW5nLWJveC1lZGl0LW1vZGUtY2hhbmdlZCcsXHJcbiAgICAgICAgICAgICdhc3NldC1kYjpyZWFkeScsXHJcbiAgICAgICAgICAgICdhc3NldC1kYjpjbG9zZScsXHJcbiAgICAgICAgICAgICdhc3NldC1kYjphc3NldC1hZGQnLFxyXG4gICAgICAgICAgICAnYXNzZXQtZGI6YXNzZXQtY2hhbmdlJyxcclxuICAgICAgICAgICAgJ2Fzc2V0LWRiOmFzc2V0LWRlbGV0ZSdcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBpbXBvcnRhbnRNZXNzYWdlcy5mb3JFYWNoKG1lc3NhZ2VUeXBlID0+IHtcclxuICAgICAgICAgICAgdGhpcy5hZGRCcm9hZGNhc3RMaXN0ZW5lcihtZXNzYWdlVHlwZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhZGRCcm9hZGNhc3RMaXN0ZW5lcihtZXNzYWdlVHlwZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgbGlzdGVuZXIgPSAoZGF0YTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZUxvZy5wdXNoKHtcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgICAgICAgZGF0YSxcclxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vIEtlZXAgbG9nIHNpemUgcmVhc29uYWJsZVxyXG4gICAgICAgICAgICBpZiAodGhpcy5tZXNzYWdlTG9nLmxlbmd0aCA+IDEwMDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubWVzc2FnZUxvZyA9IHRoaXMubWVzc2FnZUxvZy5zbGljZSgtNTAwKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYFtCcm9hZGNhc3RdICR7bWVzc2FnZVR5cGV9OmAsIGRhdGEpO1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMuaGFzKG1lc3NhZ2VUeXBlKSkge1xyXG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVycy5zZXQobWVzc2FnZVR5cGUsIFtdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5saXN0ZW5lcnMuZ2V0KG1lc3NhZ2VUeXBlKSEucHVzaChsaXN0ZW5lcik7XHJcblxyXG4gICAgICAgIC8vIEVkaXRvci5NZXNzYWdlLm9uKG1lc3NhZ2VUeXBlLCBsaXN0ZW5lcik7IC0tIEFQSSBtYXkgbm90IHN1cHBvcnRcclxuICAgICAgICBjb25zb2xlLmxvZyhgW01hbmFnZUJyb2FkY2FzdF0gQWRkZWQgbGlzdGVuZXIgZm9yICR7bWVzc2FnZVR5cGV9IChzaW11bGF0ZWQpYCk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByZW1vdmVCcm9hZGNhc3RMaXN0ZW5lcihtZXNzYWdlVHlwZTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnMuZ2V0KG1lc3NhZ2VUeXBlKTtcclxuICAgICAgICBpZiAobGlzdGVuZXJzKSB7XHJcbiAgICAgICAgICAgIGxpc3RlbmVycy5mb3JFYWNoKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIEVkaXRvci5NZXNzYWdlLm9mZihtZXNzYWdlVHlwZSwgbGlzdGVuZXIpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNYW5hZ2VCcm9hZGNhc3RdIFJlbW92ZWQgbGlzdGVuZXIgZm9yICR7bWVzc2FnZVR5cGV9IChzaW11bGF0ZWQpYCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB0aGlzLmxpc3RlbmVycy5kZWxldGUobWVzc2FnZVR5cGUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldExvZyhsaW1pdDogbnVtYmVyID0gNTAsIG1lc3NhZ2VUeXBlPzogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgbGV0IGZpbHRlcmVkTG9nID0gdGhpcy5tZXNzYWdlTG9nO1xyXG5cclxuICAgICAgICBpZiAobWVzc2FnZVR5cGUpIHtcclxuICAgICAgICAgICAgZmlsdGVyZWRMb2cgPSB0aGlzLm1lc3NhZ2VMb2cuZmlsdGVyKGVudHJ5ID0+IGVudHJ5Lm1lc3NhZ2UgPT09IG1lc3NhZ2VUeXBlKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHJlY2VudExvZyA9IGZpbHRlcmVkTG9nLnNsaWNlKC1saW1pdCkubWFwKGVudHJ5ID0+ICh7XHJcbiAgICAgICAgICAgIC4uLmVudHJ5LFxyXG4gICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKGVudHJ5LnRpbWVzdGFtcCkudG9JU09TdHJpbmcoKVxyXG4gICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xyXG4gICAgICAgICAgICBsb2c6IHJlY2VudExvZyxcclxuICAgICAgICAgICAgY291bnQ6IHJlY2VudExvZy5sZW5ndGgsXHJcbiAgICAgICAgICAgIHRvdGFsQ291bnQ6IGZpbHRlcmVkTG9nLmxlbmd0aCxcclxuICAgICAgICAgICAgZmlsdGVyOiBtZXNzYWdlVHlwZSB8fCAnYWxsJyxcclxuICAgICAgICAgICAgbWVzc2FnZTogJ0Jyb2FkY2FzdCBsb2cgcmV0cmlldmVkIHN1Y2Nlc3NmdWxseSdcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGxpc3RlbihtZXNzYWdlVHlwZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKCFtZXNzYWdlVHlwZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ21lc3NhZ2VUeXBlIGlzIHJlcXVpcmVkIGZvciBsaXN0ZW4gYWN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMuaGFzKG1lc3NhZ2VUeXBlKSkge1xyXG4gICAgICAgICAgICB0aGlzLmFkZEJyb2FkY2FzdExpc3RlbmVyKG1lc3NhZ2VUeXBlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xyXG4gICAgICAgICAgICAgICAgbWVzc2FnZVR5cGUsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgU3RhcnRlZCBsaXN0ZW5pbmcgZm9yIGJyb2FkY2FzdDogJHttZXNzYWdlVHlwZX1gXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XHJcbiAgICAgICAgICAgIG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgICBtZXNzYWdlOiBgQWxyZWFkeSBsaXN0ZW5pbmcgZm9yIGJyb2FkY2FzdDogJHttZXNzYWdlVHlwZX1gXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzdG9wKG1lc3NhZ2VUeXBlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoIW1lc3NhZ2VUeXBlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbWVzc2FnZVR5cGUgaXMgcmVxdWlyZWQgZm9yIHN0b3AgYWN0aW9uJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmxpc3RlbmVycy5oYXMobWVzc2FnZVR5cGUpKSB7XHJcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQnJvYWRjYXN0TGlzdGVuZXIobWVzc2FnZVR5cGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlVHlwZSxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBTdG9wcGVkIGxpc3RlbmluZyBmb3IgYnJvYWRjYXN0OiAke21lc3NhZ2VUeXBlfWBcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcclxuICAgICAgICAgICAgbWVzc2FnZVR5cGUsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6IGBXYXMgbm90IGxpc3RlbmluZyBmb3IgYnJvYWRjYXN0OiAke21lc3NhZ2VUeXBlfWBcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNsZWFyKCk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGNvbnN0IHByZXZpb3VzQ291bnQgPSB0aGlzLm1lc3NhZ2VMb2cubGVuZ3RoO1xyXG4gICAgICAgIHRoaXMubWVzc2FnZUxvZyA9IFtdO1xyXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcclxuICAgICAgICAgICAgY2xlYXJlZENvdW50OiBwcmV2aW91c0NvdW50LFxyXG4gICAgICAgICAgICBtZXNzYWdlOiAnQnJvYWRjYXN0IGxvZyBjbGVhcmVkIHN1Y2Nlc3NmdWxseSdcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldExpc3RlbmVycygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBjb25zdCBhY3RpdmVMaXN0ZW5lcnMgPSBBcnJheS5mcm9tKHRoaXMubGlzdGVuZXJzLmtleXMoKSkubWFwKG1lc3NhZ2VUeXBlID0+ICh7XHJcbiAgICAgICAgICAgIG1lc3NhZ2VUeXBlLFxyXG4gICAgICAgICAgICBsaXN0ZW5lckNvdW50OiB0aGlzLmxpc3RlbmVycy5nZXQobWVzc2FnZVR5cGUpPy5sZW5ndGggfHwgMFxyXG4gICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xyXG4gICAgICAgICAgICBsaXN0ZW5lcnM6IGFjdGl2ZUxpc3RlbmVycyxcclxuICAgICAgICAgICAgY291bnQ6IGFjdGl2ZUxpc3RlbmVycy5sZW5ndGgsXHJcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdBY3RpdmUgbGlzdGVuZXJzIHJldHJpZXZlZCBzdWNjZXNzZnVsbHknXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuIl19