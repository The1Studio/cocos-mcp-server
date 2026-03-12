import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import { coerceInt } from '../utils/normalize';

export class ManageServer extends BaseActionTool {
    readonly name = 'manage_server';
    readonly description = 'Server network and connectivity information. Actions: get_ip_list, get_sorted_ip_list, get_port, get_status, check_connectivity, get_interfaces.';
    readonly actions = ['get_ip_list', 'get_sorted_ip_list', 'get_port', 'get_status', 'check_connectivity', 'get_interfaces'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: this.actions,
                description: 'Action to perform'
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (check_connectivity only)',
                default: 5000
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        get_ip_list: () => this.getIpList(),
        get_sorted_ip_list: () => this.getSortedIpList(),
        get_port: () => this.getPort(),
        get_status: () => this.getStatus(),
        check_connectivity: (args) => this.checkConnectivity(coerceInt(args.timeout) ?? 5000),
        get_interfaces: () => this.getInterfaces(),
    };

    private async getIpList(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('server', 'query-ip-list').then((ipList: string[]) => {
                resolve(successResult({
                    ipList,
                    count: ipList.length,
                    message: 'IP list retrieved successfully'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getSortedIpList(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('server', 'query-sort-ip-list').then((sortedIPList: string[]) => {
                resolve(successResult({
                    sortedIPList,
                    count: sortedIPList.length,
                    message: 'Sorted IP list retrieved successfully'
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getPort(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('server', 'query-port').then((port: number) => {
                resolve(successResult({
                    port,
                    message: `Editor server is running on port ${port}`
                }));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async getStatus(): Promise<ActionToolResult> {
        try {
            const [ipListResult, portResult] = await Promise.allSettled([
                this.getIpList(),
                this.getPort()
            ]);

            const status: any = {
                timestamp: new Date().toISOString(),
                serverRunning: true
            };

            if (ipListResult.status === 'fulfilled' && ipListResult.value.success) {
                status.availableIPs = ipListResult.value.data.ipList;
                status.ipCount = ipListResult.value.data.count;
            } else {
                status.availableIPs = [];
                status.ipCount = 0;
                status.ipError = ipListResult.status === 'rejected' ? ipListResult.reason : ipListResult.value.error;
            }

            if (portResult.status === 'fulfilled' && portResult.value.success) {
                status.port = portResult.value.data.port;
            } else {
                status.port = null;
                status.portError = portResult.status === 'rejected' ? portResult.reason : portResult.value.error;
            }

            status.mcpServerPort = 3000;
            status.editorVersion = (Editor as any).versions?.cocos || 'Unknown';
            status.platform = process.platform;
            status.nodeVersion = process.version;

            return successResult(status);
        } catch (err: any) {
            return errorResult(`Failed to get server status: ${err.message}`);
        }
    }

    private async checkConnectivity(timeout: number = 5000): Promise<ActionToolResult> {
        const startTime = Date.now();
        try {
            const testPromise = Editor.Message.request('server', 'query-port');
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout')), timeout);
            });

            await Promise.race([testPromise, timeoutPromise]);

            const responseTime = Date.now() - startTime;
            return successResult({
                connected: true,
                responseTime,
                timeout,
                message: `Server connectivity confirmed in ${responseTime}ms`
            });
        } catch (err: any) {
            const responseTime = Date.now() - startTime;
            return successResult({
                connected: false,
                responseTime,
                timeout,
                error: err.message
            });
        }
    }

    private async getInterfaces(): Promise<ActionToolResult> {
        try {
            const os = require('os');
            const interfaces = os.networkInterfaces();

            const networkInfo = Object.entries(interfaces).map(([name, addresses]: [string, any]) => ({
                name,
                addresses: addresses.map((addr: any) => ({
                    address: addr.address,
                    family: addr.family,
                    internal: addr.internal,
                    cidr: addr.cidr
                }))
            }));

            const serverIPResult = await this.getIpList();

            return successResult({
                networkInterfaces: networkInfo,
                serverAvailableIPs: serverIPResult.success ? serverIPResult.data.ipList : [],
                message: 'Network interfaces retrieved successfully'
            });
        } catch (err: any) {
            return errorResult(`Failed to get network interfaces: ${err.message}`);
        }
    }
}
