import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const MAX_BATCH_CALLS = 50;

export interface ToolExecutor {
    executeToolCall(name: string, args: any): Promise<any>;
}

export interface BatchCall {
    tool: string;
    action: string;
    args?: Record<string, any>;
}

export interface BatchResultEntry {
    index: number;
    tool: string;
    action: string;
    success: boolean;
    result: any;
    error?: string;
}

export class BatchExecute extends BaseActionTool {
    readonly name = 'batch_execute';
    readonly description = 'Execute multiple tool calls sequentially in a single request. Reduces round-trips when building complex scenes. Actions: execute. Max 50 calls per batch. Each call specifies tool name, action, and args. Use stopOnError=false to continue past failures.';
    readonly actions = ['execute'];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['execute'],
                description: 'Action to perform: execute=run multiple tool calls sequentially'
            },
            calls: {
                type: 'array',
                description: 'List of tool calls to execute. Max 50 calls.',
                items: {
                    type: 'object',
                    properties: {
                        tool: {
                            type: 'string',
                            description: 'Tool name (e.g., manage_node, manage_ui, manage_component)'
                        },
                        action: {
                            type: 'string',
                            description: 'Action name within the tool (e.g., create, get_info)'
                        },
                        args: {
                            type: 'object',
                            description: 'Arguments to pass to the tool action'
                        }
                    },
                    required: ['tool', 'action']
                }
            },
            stopOnError: {
                type: 'boolean',
                description: 'Stop batch execution on first failure (default: true)',
                default: true
            }
        },
        required: ['action', 'calls']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        execute: (args) => this.executeBatch(args)
    };

    constructor(private readonly executor: ToolExecutor) {
        super();
    }

    private async executeBatch(args: any): Promise<ActionToolResult> {
        const calls: BatchCall[] = args.calls;
        const stopOnError: boolean = args.stopOnError !== false;

        if (!Array.isArray(calls) || calls.length === 0) {
            return errorResult('calls must be a non-empty array');
        }
        if (calls.length > MAX_BATCH_CALLS) {
            return errorResult(`Batch exceeds maximum of ${MAX_BATCH_CALLS} calls. Got ${calls.length}.`);
        }

        // Validate each call has required fields before executing
        for (let i = 0; i < calls.length; i++) {
            const call = calls[i];
            if (!call.tool || typeof call.tool !== 'string') {
                return errorResult(`calls[${i}].tool is required and must be a string`);
            }
            if (!call.action || typeof call.action !== 'string') {
                return errorResult(`calls[${i}].action is required and must be a string`);
            }
        }

        const results: BatchResultEntry[] = [];
        let completedCount = 0;

        for (let i = 0; i < calls.length; i++) {
            const { tool, action, args: callArgs = {} } = calls[i];
            const mergedArgs = { action, ...callArgs };

            try {
                const raw = await this.executor.executeToolCall(tool, mergedArgs);
                const toolResult = raw as ActionToolResult;
                const success = toolResult?.success !== false;

                results.push({
                    index: i,
                    tool,
                    action,
                    success,
                    result: toolResult
                });

                completedCount++;

                if (!success && stopOnError) {
                    return successResult(
                        {
                            results,
                            completedCount,
                            totalCount: calls.length,
                            stoppedAt: i,
                            stoppedDueToError: true
                        },
                        `Batch stopped at call ${i} (${tool}.${action}) due to error`
                    );
                }

            } catch (err: any) {
                const entry: BatchResultEntry = {
                    index: i,
                    tool,
                    action,
                    success: false,
                    result: null,
                    error: err.message
                };
                results.push(entry);

                if (stopOnError) {
                    return successResult(
                        {
                            results,
                            completedCount,
                            totalCount: calls.length,
                            stoppedAt: i,
                            stoppedDueToError: true
                        },
                        `Batch stopped at call ${i} (${tool}.${action}) due to exception: ${err.message}`
                    );
                }
            }
        }

        const allSucceeded = results.every(r => r.success);
        return successResult(
            {
                results,
                completedCount,
                totalCount: calls.length,
                allSucceeded
            },
            `Batch completed: ${completedCount}/${calls.length} calls executed, ${results.filter(r => r.success).length} succeeded`
        );
    }
}
