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
                    return (0, types_1.successResult)({
                        results,
                        completedCount,
                        totalCount: calls.length,
                        stoppedAt: i,
                        stoppedDueToError: true
                    }, `Batch stopped at call ${i} (${tool}.${action}) due to error`);
                }
            }
            catch (err) {
                const entry = {
                    index: i,
                    tool,
                    action,
                    success: false,
                    result: null,
                    error: err.message
                };
                results.push(entry);
                if (stopOnError) {
                    return (0, types_1.successResult)({
                        results,
                        completedCount,
                        totalCount: calls.length,
                        stoppedAt: i,
                        stoppedDueToError: true
                    }, `Batch stopped at call ${i} (${tool}.${action}) due to exception: ${err.message}`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtZXhlY3V0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9iYXRjaC1leGVjdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDO0FBcUIzQixNQUFhLFlBQWEsU0FBUSxpQ0FBYztJQWdENUMsWUFBNkIsUUFBc0I7UUFDL0MsS0FBSyxFQUFFLENBQUM7UUFEaUIsYUFBUSxHQUFSLFFBQVEsQ0FBYztRQS9DMUMsU0FBSSxHQUFHLGVBQWUsQ0FBQztRQUN2QixnQkFBVyxHQUFHLDZQQUE2UCxDQUFDO1FBQzVRLFlBQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXRCLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsQ0FBQztvQkFDakIsV0FBVyxFQUFFLGlFQUFpRTtpQkFDakY7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxPQUFPO29CQUNiLFdBQVcsRUFBRSw4Q0FBOEM7b0JBQzNELEtBQUssRUFBRTt3QkFDSCxJQUFJLEVBQUUsUUFBUTt3QkFDZCxVQUFVLEVBQUU7NEJBQ1IsSUFBSSxFQUFFO2dDQUNGLElBQUksRUFBRSxRQUFRO2dDQUNkLFdBQVcsRUFBRSw0REFBNEQ7NkJBQzVFOzRCQUNELE1BQU0sRUFBRTtnQ0FDSixJQUFJLEVBQUUsUUFBUTtnQ0FDZCxXQUFXLEVBQUUsc0RBQXNEOzZCQUN0RTs0QkFDRCxJQUFJLEVBQUU7Z0NBQ0YsSUFBSSxFQUFFLFFBQVE7Z0NBQ2QsV0FBVyxFQUFFLHNDQUFzQzs2QkFDdEQ7eUJBQ0o7d0JBQ0QsUUFBUSxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztxQkFDL0I7aUJBQ0o7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QUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxZQUFZLENBQzFILENBQUM7SUFDTixDQUFDO0NBQ0o7QUFsSkQsb0NBa0pDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmNvbnN0IE1BWF9CQVRDSF9DQUxMUyA9IDUwO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xFeGVjdXRvciB7XG4gICAgZXhlY3V0ZVRvb2xDYWxsKG5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJhdGNoQ2FsbCB7XG4gICAgdG9vbDogc3RyaW5nO1xuICAgIGFjdGlvbjogc3RyaW5nO1xuICAgIGFyZ3M/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJhdGNoUmVzdWx0RW50cnkge1xuICAgIGluZGV4OiBudW1iZXI7XG4gICAgdG9vbDogc3RyaW5nO1xuICAgIGFjdGlvbjogc3RyaW5nO1xuICAgIHN1Y2Nlc3M6IGJvb2xlYW47XG4gICAgcmVzdWx0OiBhbnk7XG4gICAgZXJyb3I/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBCYXRjaEV4ZWN1dGUgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdiYXRjaF9leGVjdXRlJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdFeGVjdXRlIG11bHRpcGxlIHRvb2wgY2FsbHMgc2VxdWVudGlhbGx5IGluIGEgc2luZ2xlIHJlcXVlc3QuIFJlZHVjZXMgcm91bmQtdHJpcHMgd2hlbiBidWlsZGluZyBjb21wbGV4IHNjZW5lcy4gQWN0aW9uczogZXhlY3V0ZS4gTWF4IDUwIGNhbGxzIHBlciBiYXRjaC4gRWFjaCBjYWxsIHNwZWNpZmllcyB0b29sIG5hbWUsIGFjdGlvbiwgYW5kIGFyZ3MuIFVzZSBzdG9wT25FcnJvcj1mYWxzZSB0byBjb250aW51ZSBwYXN0IGZhaWx1cmVzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZXhlY3V0ZSddO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2V4ZWN1dGUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtOiBleGVjdXRlPXJ1biBtdWx0aXBsZSB0b29sIGNhbGxzIHNlcXVlbnRpYWxseSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjYWxsczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdMaXN0IG9mIHRvb2wgY2FsbHMgdG8gZXhlY3V0ZS4gTWF4IDUwIGNhbGxzLicsXG4gICAgICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2w6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Rvb2wgbmFtZSAoZS5nLiwgbWFuYWdlX25vZGUsIG1hbmFnZV91aSwgbWFuYWdlX2NvbXBvbmVudCknXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gbmFtZSB3aXRoaW4gdGhlIHRvb2wgKGUuZy4sIGNyZWF0ZSwgZ2V0X2luZm8pJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSB0b29sIGFjdGlvbidcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWQ6IFsndG9vbCcsICdhY3Rpb24nXVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdG9wT25FcnJvcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1N0b3AgYmF0Y2ggZXhlY3V0aW9uIG9uIGZpcnN0IGZhaWx1cmUgKGRlZmF1bHQ6IHRydWUpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbicsICdjYWxscyddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBleGVjdXRlOiAoYXJncykgPT4gdGhpcy5leGVjdXRlQmF0Y2goYXJncylcbiAgICB9O1xuXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBleGVjdXRvcjogVG9vbEV4ZWN1dG9yKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlQmF0Y2goYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGNvbnN0IGNhbGxzOiBCYXRjaENhbGxbXSA9IGFyZ3MuY2FsbHM7XG4gICAgICAgIGNvbnN0IHN0b3BPbkVycm9yOiBib29sZWFuID0gYXJncy5zdG9wT25FcnJvciAhPT0gZmFsc2U7XG5cbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGNhbGxzKSB8fCBjYWxscy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnY2FsbHMgbXVzdCBiZSBhIG5vbi1lbXB0eSBhcnJheScpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjYWxscy5sZW5ndGggPiBNQVhfQkFUQ0hfQ0FMTFMpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQmF0Y2ggZXhjZWVkcyBtYXhpbXVtIG9mICR7TUFYX0JBVENIX0NBTExTfSBjYWxscy4gR290ICR7Y2FsbHMubGVuZ3RofS5gKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIGVhY2ggY2FsbCBoYXMgcmVxdWlyZWQgZmllbGRzIGJlZm9yZSBleGVjdXRpbmdcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYWxscy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY2FsbCA9IGNhbGxzW2ldO1xuICAgICAgICAgICAgaWYgKCFjYWxsLnRvb2wgfHwgdHlwZW9mIGNhbGwudG9vbCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYGNhbGxzWyR7aX1dLnRvb2wgaXMgcmVxdWlyZWQgYW5kIG11c3QgYmUgYSBzdHJpbmdgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICghY2FsbC5hY3Rpb24gfHwgdHlwZW9mIGNhbGwuYWN0aW9uICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgY2FsbHNbJHtpfV0uYWN0aW9uIGlzIHJlcXVpcmVkIGFuZCBtdXN0IGJlIGEgc3RyaW5nYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCByZXN1bHRzOiBCYXRjaFJlc3VsdEVudHJ5W10gPSBbXTtcbiAgICAgICAgbGV0IGNvbXBsZXRlZENvdW50ID0gMDtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhbGxzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCB7IHRvb2wsIGFjdGlvbiwgYXJnczogY2FsbEFyZ3MgPSB7fSB9ID0gY2FsbHNbaV07XG4gICAgICAgICAgICBjb25zdCBtZXJnZWRBcmdzID0geyBhY3Rpb24sIC4uLmNhbGxBcmdzIH07XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgdGhpcy5leGVjdXRvci5leGVjdXRlVG9vbENhbGwodG9vbCwgbWVyZ2VkQXJncyk7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbFJlc3VsdCA9IHJhdyBhcyBBY3Rpb25Ub29sUmVzdWx0O1xuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSB0b29sUmVzdWx0Py5zdWNjZXNzICE9PSBmYWxzZTtcblxuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxuICAgICAgICAgICAgICAgICAgICB0b29sLFxuICAgICAgICAgICAgICAgICAgICBhY3Rpb24sXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDogdG9vbFJlc3VsdFxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgY29tcGxldGVkQ291bnQrKztcblxuICAgICAgICAgICAgICAgIGlmICghc3VjY2VzcyAmJiBzdG9wT25FcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZENvdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsQ291bnQ6IGNhbGxzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9wcGVkQXQ6IGksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcHBlZER1ZVRvRXJyb3I6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBgQmF0Y2ggc3RvcHBlZCBhdCBjYWxsICR7aX0gKCR7dG9vbH0uJHthY3Rpb259KSBkdWUgdG8gZXJyb3JgXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5OiBCYXRjaFJlc3VsdEVudHJ5ID0ge1xuICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcbiAgICAgICAgICAgICAgICAgICAgdG9vbCxcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0OiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogZXJyLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJlc3VsdHMucHVzaChlbnRyeSk7XG5cbiAgICAgICAgICAgICAgICBpZiAoc3RvcE9uRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWRDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3RhbENvdW50OiBjYWxscy5sZW5ndGgsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcHBlZEF0OiBpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0b3BwZWREdWVUb0Vycm9yOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgYEJhdGNoIHN0b3BwZWQgYXQgY2FsbCAke2l9ICgke3Rvb2x9LiR7YWN0aW9ufSkgZHVlIHRvIGV4Y2VwdGlvbjogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsU3VjY2VlZGVkID0gcmVzdWx0cy5ldmVyeShyID0+IHIuc3VjY2Vzcyk7XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHJlc3VsdHMsXG4gICAgICAgICAgICAgICAgY29tcGxldGVkQ291bnQsXG4gICAgICAgICAgICAgICAgdG90YWxDb3VudDogY2FsbHMubGVuZ3RoLFxuICAgICAgICAgICAgICAgIGFsbFN1Y2NlZWRlZFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGBCYXRjaCBjb21wbGV0ZWQ6ICR7Y29tcGxldGVkQ291bnR9LyR7Y2FsbHMubGVuZ3RofSBjYWxscyBleGVjdXRlZCwgJHtyZXN1bHRzLmZpbHRlcihyID0+IHIuc3VjY2VzcykubGVuZ3RofSBzdWNjZWVkZWRgXG4gICAgICAgICk7XG4gICAgfVxufVxuIl19