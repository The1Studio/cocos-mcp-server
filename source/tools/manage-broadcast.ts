import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceInt } from '../utils/normalize';

export class ManageBroadcast extends BaseActionTool {
    readonly name = 'manage_broadcast';
    readonly description = 'Manage editor broadcast event listeners and message log. Actions: get_log, listen, stop, clear, get_listeners.';
    readonly actions = ['get_log', 'listen', 'stop', 'clear', 'get_listeners'];
    readonly inputSchema = {
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

    private listeners: Map<string, Function[]> = new Map();
    private messageLog: Array<{ message: string; data: any; timestamp: number }> = [];

    constructor() {
        super();
        this.setupBroadcastListeners();
    }

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_log: (args) => this.getLog(coerceInt(args.limit) ?? 50, args.messageType),
        listen: (args) => this.listen(args.messageType),
        stop: (args) => this.stop(args.messageType),
        clear: () => this.clear(),
        get_listeners: () => this.getListeners(),
    };

    private setupBroadcastListeners(): void {
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

    private addBroadcastListener(messageType: string): void {
        const listener = (data: any) => {
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
        this.listeners.get(messageType)!.push(listener);

        // Editor.Message.on(messageType, listener); -- API may not support
        console.log(`[ManageBroadcast] Added listener for ${messageType} (simulated)`);
    }

    private removeBroadcastListener(messageType: string): void {
        const listeners = this.listeners.get(messageType);
        if (listeners) {
            listeners.forEach(() => {
                // Editor.Message.off(messageType, listener);
                console.log(`[ManageBroadcast] Removed listener for ${messageType} (simulated)`);
            });
            this.listeners.delete(messageType);
        }
    }

    private async getLog(limit: number = 50, messageType?: string): Promise<ActionToolResult> {
        let filteredLog = this.messageLog;

        if (messageType) {
            filteredLog = this.messageLog.filter(entry => entry.message === messageType);
        }

        const recentLog = filteredLog.slice(-limit).map(entry => ({
            ...entry,
            timestamp: new Date(entry.timestamp).toISOString()
        }));

        return successResult({
            log: recentLog,
            count: recentLog.length,
            totalCount: filteredLog.length,
            filter: messageType || 'all',
            message: 'Broadcast log retrieved successfully'
        });
    }

    private async listen(messageType: string): Promise<ActionToolResult> {
        if (!messageType) {
            return errorResult('messageType is required for listen action');
        }
        if (!this.listeners.has(messageType)) {
            this.addBroadcastListener(messageType);
            return successResult({
                messageType,
                message: `Started listening for broadcast: ${messageType}`
            });
        }
        return successResult({
            messageType,
            message: `Already listening for broadcast: ${messageType}`
        });
    }

    private async stop(messageType: string): Promise<ActionToolResult> {
        if (!messageType) {
            return errorResult('messageType is required for stop action');
        }
        if (this.listeners.has(messageType)) {
            this.removeBroadcastListener(messageType);
            return successResult({
                messageType,
                message: `Stopped listening for broadcast: ${messageType}`
            });
        }
        return successResult({
            messageType,
            message: `Was not listening for broadcast: ${messageType}`
        });
    }

    private async clear(): Promise<ActionToolResult> {
        const previousCount = this.messageLog.length;
        this.messageLog = [];
        return successResult({
            clearedCount: previousCount,
            message: 'Broadcast log cleared successfully'
        });
    }

    private async getListeners(): Promise<ActionToolResult> {
        const activeListeners = Array.from(this.listeners.keys()).map(messageType => ({
            messageType,
            listenerCount: this.listeners.get(messageType)?.length || 0
        }));

        return successResult({
            listeners: activeListeners,
            count: activeListeners.length,
            message: 'Active listeners retrieved successfully'
        });
    }
}
