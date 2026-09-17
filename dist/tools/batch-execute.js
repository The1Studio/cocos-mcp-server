"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchExecute = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const MAX_BATCH_CALLS = 50;
class BatchExecute extends base_action_tool_1.BaseActionTool {
    constructor(executor) {
        super();
        this.executor = executor;
        this.name = 'batch_execute';
        this.description = 'Execute multiple tool calls sequentially in a single request. Reduces round-trips when building complex scenes. Actions: execute. Max 50 calls per batch. Each call specifies tool name, action, and args. Use stopOnError=false to continue past failures.';
        this.actions = ['execute'];
        /** Re-enters the dispatcher for each of its own calls — must not be enqueued (#6). */
        this.reentrant = true;
        this.inputSchema = {
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
        this.actionHandlers = {
            execute: (args) => this.executeBatch(args)
        };
    }
    async executeBatch(args) {
        const calls = args.calls;
        const stopOnError = args.stopOnError !== false;
        if (!Array.isArray(calls) || calls.length === 0) {
            return (0, types_1.errorResult)('calls must be a non-empty array');
        }
        if (calls.length > MAX_BATCH_CALLS) {
            return (0, types_1.errorResult)(`Batch exceeds maximum of ${MAX_BATCH_CALLS} calls. Got ${calls.length}.`);
        }
        // Validate each call has required fields before executing
        for (let i = 0; i < calls.length; i++) {
            const call = calls[i];
            if (!call.tool || typeof call.tool !== 'string') {
                return (0, types_1.errorResult)(`calls[${i}].tool is required and must be a string`);
            }
            if (!call.action || typeof call.action !== 'string') {
                return (0, types_1.errorResult)(`calls[${i}].action is required and must be a string`);
            }
        }
        const results = [];
        let completedCount = 0;
        for (let i = 0; i < calls.length; i++) {
            const { tool, action, args: callArgs = {} } = calls[i];
            const mergedArgs = Object.assign({ action }, callArgs);
            try {
                const raw = await this.executor.executeToolCall(tool, mergedArgs);
                const toolResult = raw;
                const success = (toolResult === null || toolResult === void 0 ? void 0 : toolResult.success) !== false;
                results.push({
                    index: i,
                    tool,
                    action,
                    success,
                    result: toolResult
                });
                completedCount++;
                if (!success && stopOnError) {
                    return (0, types_1.errorResult)(`Batch stopped at call ${i} (${tool}.${action}) due to error`, {
                        results,
                        completedCount,
                        totalCount: calls.length,
                        stoppedAt: i,
                        stoppedDueToError: true
                    });
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                const entry = {
                    index: i,
                    tool,
                    action,
                    success: false,
                    result: null,
                    error: message
                };
                results.push(entry);
                if (stopOnError) {
                    return (0, types_1.errorResult)(`Batch stopped at call ${i} (${tool}.${action}) due to exception: ${message}`, {
                        results,
                        completedCount,
                        totalCount: calls.length,
                        stoppedAt: i,
                        stoppedDueToError: true
                    });
                }
            }
        }
        const allSucceeded = results.every(r => r.success);
        return (0, types_1.successResult)({
            results,
            completedCount,
            totalCount: calls.length,
            allSucceeded
        }, `Batch completed: ${completedCount}/${calls.length} calls executed, ${results.filter(r => r.success).length} succeeded`);
    }
}
exports.BatchExecute = BatchExecute;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtZXhlY3V0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9iYXRjaC1leGVjdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDO0FBcUIzQixNQUFhLFlBQWEsU0FBUSxpQ0FBYztJQWtENUMsWUFBNkIsUUFBc0I7UUFDL0MsS0FBSyxFQUFFLENBQUM7UUFEaUIsYUFBUSxHQUFSLFFBQVEsQ0FBYztRQWpEMUMsU0FBSSxHQUFHLGVBQWUsQ0FBQztRQUN2QixnQkFBVyxHQUFHLDZQQUE2UCxDQUFDO1FBQzVRLFlBQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQy9CLHNGQUFzRjtRQUM3RSxjQUFTLEdBQUcsSUFBSSxDQUFDO1FBRWpCLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsQ0FBQztvQkFDakIsV0FBVyxFQUFFLGlFQUFpRTtpQkFDakY7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxPQUFPO29CQUNiLFdBQVcsRUFBRSw4Q0FBOEM7b0JBQzNELEtBQUssRUFBRTt3QkFDSCxJQUFJLEVBQUUsUUFBUTt3QkFDZCxVQUFVLEVBQUU7NEJBQ1IsSUFBSSxFQUFFO2dDQUNGLElBQUksRUFBRSxRQUFRO2dDQUNkLFdBQVcsRUFBRSw0REFBNEQ7NkJBQzVFOzRCQUNELE1BQU0sRUFBRTtnQ0FDSixJQUFJLEVBQUUsUUFBUTtnQ0FDZCxXQUFXLEVBQUUsc0RBQXNEOzZCQUN0RTs0QkFDRCxJQUFJLEVBQUU7Z0NBQ0YsSUFBSSxFQUFFLFFBQVE7Z0NBQ2QsV0FBVyxFQUFFLHNDQUFzQzs2QkFDdEQ7eUJBQ0o7d0JBQ0QsUUFBUSxFQUFF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SSxPQUFPO1lBQ1AsY0FBYztZQUNkLFVBQVUsRUFBRSxLQUFLLENBQUMsTUFBTTtZQUN4QixZQUFZO1NBQ2YsRUFDRCxvQkFBb0IsY0FBYyxJQUFJLEtBQUssQ0FBQyxNQUFNLG9CQUFvQixPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sWUFBWSxDQUMxSCxDQUFDO0lBQ04sQ0FBQztDQUNKO0FBckpELG9DQXFKQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5jb25zdCBNQVhfQkFUQ0hfQ0FMTFMgPSA1MDtcblxuZXhwb3J0IGludGVyZmFjZSBUb29sRXhlY3V0b3Ige1xuICAgIGV4ZWN1dGVUb29sQ2FsbChuYW1lOiBzdHJpbmcsIGFyZ3M6IGFueSk6IFByb21pc2U8YW55Pjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCYXRjaENhbGwge1xuICAgIHRvb2w6IHN0cmluZztcbiAgICBhY3Rpb246IHN0cmluZztcbiAgICBhcmdzPzogUmVjb3JkPHN0cmluZywgYW55Pjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBCYXRjaFJlc3VsdEVudHJ5IHtcbiAgICBpbmRleDogbnVtYmVyO1xuICAgIHRvb2w6IHN0cmluZztcbiAgICBhY3Rpb246IHN0cmluZztcbiAgICBzdWNjZXNzOiBib29sZWFuO1xuICAgIHJlc3VsdDogYW55O1xuICAgIGVycm9yPzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgQmF0Y2hFeGVjdXRlIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnYmF0Y2hfZXhlY3V0ZSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnRXhlY3V0ZSBtdWx0aXBsZSB0b29sIGNhbGxzIHNlcXVlbnRpYWxseSBpbiBhIHNpbmdsZSByZXF1ZXN0LiBSZWR1Y2VzIHJvdW5kLXRyaXBzIHdoZW4gYnVpbGRpbmcgY29tcGxleCBzY2VuZXMuIEFjdGlvbnM6IGV4ZWN1dGUuIE1heCA1MCBjYWxscyBwZXIgYmF0Y2guIEVhY2ggY2FsbCBzcGVjaWZpZXMgdG9vbCBuYW1lLCBhY3Rpb24sIGFuZCBhcmdzLiBVc2Ugc3RvcE9uRXJyb3I9ZmFsc2UgdG8gY29udGludWUgcGFzdCBmYWlsdXJlcy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2V4ZWN1dGUnXTtcbiAgICAvKiogUmUtZW50ZXJzIHRoZSBkaXNwYXRjaGVyIGZvciBlYWNoIG9mIGl0cyBvd24gY2FsbHMg4oCUIG11c3Qgbm90IGJlIGVucXVldWVkICgjNikuICovXG4gICAgcmVhZG9ubHkgcmVlbnRyYW50ID0gdHJ1ZTtcblxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydleGVjdXRlJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogZXhlY3V0ZT1ydW4gbXVsdGlwbGUgdG9vbCBjYWxscyBzZXF1ZW50aWFsbHknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2FsbHM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTGlzdCBvZiB0b29sIGNhbGxzIHRvIGV4ZWN1dGUuIE1heCA1MCBjYWxscy4nLFxuICAgICAgICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUb29sIG5hbWUgKGUuZy4sIG1hbmFnZV9ub2RlLCBtYW5hZ2VfdWksIG1hbmFnZV9jb21wb25lbnQpJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIG5hbWUgd2l0aGluIHRoZSB0b29sIChlLmcuLCBjcmVhdGUsIGdldF9pbmZvKSdcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmdzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgdG9vbCBhY3Rpb24nXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Rvb2wnLCAnYWN0aW9uJ11cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3RvcE9uRXJyb3I6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTdG9wIGJhdGNoIGV4ZWN1dGlvbiBvbiBmaXJzdCBmYWlsdXJlIChkZWZhdWx0OiB0cnVlKScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nLCAnY2FsbHMnXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgZXhlY3V0ZTogKGFyZ3MpID0+IHRoaXMuZXhlY3V0ZUJhdGNoKGFyZ3MpXG4gICAgfTtcblxuICAgIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZXhlY3V0b3I6IFRvb2xFeGVjdXRvcikge1xuICAgICAgICBzdXBlcigpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZXhlY3V0ZUJhdGNoKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBjb25zdCBjYWxsczogQmF0Y2hDYWxsW10gPSBhcmdzLmNhbGxzO1xuICAgICAgICBjb25zdCBzdG9wT25FcnJvcjogYm9vbGVhbiA9IGFyZ3Muc3RvcE9uRXJyb3IgIT09IGZhbHNlO1xuXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjYWxscykgfHwgY2FsbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2NhbGxzIG11c3QgYmUgYSBub24tZW1wdHkgYXJyYXknKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY2FsbHMubGVuZ3RoID4gTUFYX0JBVENIX0NBTExTKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEJhdGNoIGV4Y2VlZHMgbWF4aW11bSBvZiAke01BWF9CQVRDSF9DQUxMU30gY2FsbHMuIEdvdCAke2NhbGxzLmxlbmd0aH0uYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBWYWxpZGF0ZSBlYWNoIGNhbGwgaGFzIHJlcXVpcmVkIGZpZWxkcyBiZWZvcmUgZXhlY3V0aW5nXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY2FsbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbGwgPSBjYWxsc1tpXTtcbiAgICAgICAgICAgIGlmICghY2FsbC50b29sIHx8IHR5cGVvZiBjYWxsLnRvb2wgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBjYWxsc1ske2l9XS50b29sIGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIGEgc3RyaW5nYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWNhbGwuYWN0aW9uIHx8IHR5cGVvZiBjYWxsLmFjdGlvbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYGNhbGxzWyR7aX1dLmFjdGlvbiBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBhIHN0cmluZ2ApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0czogQmF0Y2hSZXN1bHRFbnRyeVtdID0gW107XG4gICAgICAgIGxldCBjb21wbGV0ZWRDb3VudCA9IDA7XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgeyB0b29sLCBhY3Rpb24sIGFyZ3M6IGNhbGxBcmdzID0ge30gfSA9IGNhbGxzW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVyZ2VkQXJncyA9IHsgYWN0aW9uLCAuLi5jYWxsQXJncyB9O1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMuZXhlY3V0b3IuZXhlY3V0ZVRvb2xDYWxsKHRvb2wsIG1lcmdlZEFyZ3MpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xSZXN1bHQgPSByYXcgYXMgQWN0aW9uVG9vbFJlc3VsdDtcbiAgICAgICAgICAgICAgICBjb25zdCBzdWNjZXNzID0gdG9vbFJlc3VsdD8uc3VjY2VzcyAhPT0gZmFsc2U7XG5cbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgICAgdG9vbCxcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IHRvb2xSZXN1bHRcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNvbXBsZXRlZENvdW50Kys7XG5cbiAgICAgICAgICAgICAgICBpZiAoIXN1Y2Nlc3MgJiYgc3RvcE9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgYEJhdGNoIHN0b3BwZWQgYXQgY2FsbCAke2l9ICgke3Rvb2x9LiR7YWN0aW9ufSkgZHVlIHRvIGVycm9yYCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsQ291bnQ6IGNhbGxzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9wcGVkQXQ6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcHBlZER1ZVRvRXJyb3I6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVyciBpbnN0YW5jZW9mIEVycm9yID8gZXJyLm1lc3NhZ2UgOiBTdHJpbmcoZXJyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRyeTogQmF0Y2hSZXN1bHRFbnRyeSA9IHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IGksXG4gICAgICAgICAgICAgICAgICAgIHRvb2wsXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbixcbiAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChlbnRyeSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RvcE9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICAgICAgYEJhdGNoIHN0b3BwZWQgYXQgY2FsbCAke2l9ICgke3Rvb2x9LiR7YWN0aW9ufSkgZHVlIHRvIGV4Y2VwdGlvbjogJHttZXNzYWdlfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3RhbENvdW50OiBjYWxscy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcHBlZEF0OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0b3BwZWREdWVUb0Vycm9yOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsU3VjY2VlZGVkID0gcmVzdWx0cy5ldmVyeShyID0+IHIuc3VjY2Vzcyk7XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMsXG4gICAgICAgICAgICAgICAgY29tcGxldGVkQ291bnQsXG4gICAgICAgICAgICAgICAgdG90YWxDb3VudDogY2FsbHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGFsbFN1Y2NlZWRlZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGBCYXRjaCBjb21wbGV0ZWQ6ICR7Y29tcGxldGVkQ291bnR9LyR7Y2FsbHMubGVuZ3RofSBjYWxscyBleGVjdXRlZCwgJHtyZXN1bHRzLmZpbHRlcihyID0+IHIuc3VjY2VzcykubGVuZ3RofSBzdWNjZWVkZWRgXG4gICAgICAgICk7XG4gICAgfVxufVxuIl19