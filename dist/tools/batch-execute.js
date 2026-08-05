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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF0Y2gtZXhlY3V0ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9iYXRjaC1leGVjdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFFeEUsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDO0FBcUIzQixNQUFhLFlBQWEsU0FBUSxpQ0FBYztJQWdENUMsWUFBNkIsUUFBc0I7UUFDL0MsS0FBSyxFQUFFLENBQUM7UUFEaUIsYUFBUSxHQUFSLFFBQVEsQ0FBYztRQS9DMUMsU0FBSSxHQUFHLGVBQWUsQ0FBQztRQUN2QixnQkFBVyxHQUFHLDZQQUE2UCxDQUFDO1FBQzVRLFlBQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRXRCLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFNBQVMsQ0FBQztvQkFDakIsV0FBVyxFQUFFLGlFQUFpRTtpQkFDakY7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxPQUFPO29CQUNiLFdBQVcsRUFBRSw4Q0FBOEM7b0JBQzNELEtBQUssRUFBRTt3QkFDSCxJQUFJLEVBQUUsUUFBUTt3QkFDZCxVQUFVLEVBQUU7NEJBQ1IsSUFBSSxFQUFFO2dDQUNGLElBQUksRUFBRSxRQUFRO2dDQUNkLFdBQVcsRUFBRSw0REFBNEQ7NkJBQzVFOzRCQUNELE1BQU0sRUFBRTtnQ0FDSixJQUFJLEVBQUUsUUFBUTtnQ0FDZCxXQUFXLEVBQUUsc0RBQXNEOzZCQUN0RTs0QkFDRCxJQUFJLEVBQUU7Z0NBQ0YsSUFBSSxFQUFFLFFBQVE7Z0NBQ2QsV0FBVyxFQUFFLHNDQUFzQzs2QkFDdEQ7eUJBQ0o7d0JBQ0QsUUFBUSxFQUFFLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQztxQkFDL0I7aUJBQ0o7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QUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxZQUFZLENBQzFILENBQUM7SUFDTixDQUFDO0NBQ0o7QUFsSkQsb0NBa0pDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmNvbnN0IE1BWF9CQVRDSF9DQUxMUyA9IDUwO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBUb29sRXhlY3V0b3Ige1xyXG4gICAgZXhlY3V0ZVRvb2xDYWxsKG5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJhdGNoQ2FsbCB7XHJcbiAgICB0b29sOiBzdHJpbmc7XHJcbiAgICBhY3Rpb246IHN0cmluZztcclxuICAgIGFyZ3M/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEJhdGNoUmVzdWx0RW50cnkge1xyXG4gICAgaW5kZXg6IG51bWJlcjtcclxuICAgIHRvb2w6IHN0cmluZztcclxuICAgIGFjdGlvbjogc3RyaW5nO1xyXG4gICAgc3VjY2VzczogYm9vbGVhbjtcclxuICAgIHJlc3VsdDogYW55O1xyXG4gICAgZXJyb3I/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBCYXRjaEV4ZWN1dGUgZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XHJcbiAgICByZWFkb25seSBuYW1lID0gJ2JhdGNoX2V4ZWN1dGUnO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnRXhlY3V0ZSBtdWx0aXBsZSB0b29sIGNhbGxzIHNlcXVlbnRpYWxseSBpbiBhIHNpbmdsZSByZXF1ZXN0LiBSZWR1Y2VzIHJvdW5kLXRyaXBzIHdoZW4gYnVpbGRpbmcgY29tcGxleCBzY2VuZXMuIEFjdGlvbnM6IGV4ZWN1dGUuIE1heCA1MCBjYWxscyBwZXIgYmF0Y2guIEVhY2ggY2FsbCBzcGVjaWZpZXMgdG9vbCBuYW1lLCBhY3Rpb24sIGFuZCBhcmdzLiBVc2Ugc3RvcE9uRXJyb3I9ZmFsc2UgdG8gY29udGludWUgcGFzdCBmYWlsdXJlcy4nO1xyXG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZXhlY3V0ZSddO1xyXG5cclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnZXhlY3V0ZSddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybTogZXhlY3V0ZT1ydW4gbXVsdGlwbGUgdG9vbCBjYWxscyBzZXF1ZW50aWFsbHknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNhbGxzOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdMaXN0IG9mIHRvb2wgY2FsbHMgdG8gZXhlY3V0ZS4gTWF4IDUwIGNhbGxzLicsXHJcbiAgICAgICAgICAgICAgICBpdGVtczoge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdG9vbDoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1Rvb2wgbmFtZSAoZS5nLiwgbWFuYWdlX25vZGUsIG1hbmFnZV91aSwgbWFuYWdlX2NvbXBvbmVudCknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiBuYW1lIHdpdGhpbiB0aGUgdG9vbCAoZS5nLiwgY3JlYXRlLCBnZXRfaW5mbyknXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGFyZ3M6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBcmd1bWVudHMgdG8gcGFzcyB0byB0aGUgdG9vbCBhY3Rpb24nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3Rvb2wnLCAnYWN0aW9uJ11cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgc3RvcE9uRXJyb3I6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sZWFuJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnU3RvcCBiYXRjaCBleGVjdXRpb24gb24gZmlyc3QgZmFpbHVyZSAoZGVmYXVsdDogdHJ1ZSknLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogdHJ1ZVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nLCAnY2FsbHMnXVxyXG4gICAgfTtcclxuXHJcbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcclxuICAgICAgICBleGVjdXRlOiAoYXJncykgPT4gdGhpcy5leGVjdXRlQmF0Y2goYXJncylcclxuICAgIH07XHJcblxyXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBleGVjdXRvcjogVG9vbEV4ZWN1dG9yKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGV4ZWN1dGVCYXRjaChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBjb25zdCBjYWxsczogQmF0Y2hDYWxsW10gPSBhcmdzLmNhbGxzO1xyXG4gICAgICAgIGNvbnN0IHN0b3BPbkVycm9yOiBib29sZWFuID0gYXJncy5zdG9wT25FcnJvciAhPT0gZmFsc2U7XHJcblxyXG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShjYWxscykgfHwgY2FsbHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnY2FsbHMgbXVzdCBiZSBhIG5vbi1lbXB0eSBhcnJheScpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoY2FsbHMubGVuZ3RoID4gTUFYX0JBVENIX0NBTExTKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQmF0Y2ggZXhjZWVkcyBtYXhpbXVtIG9mICR7TUFYX0JBVENIX0NBTExTfSBjYWxscy4gR290ICR7Y2FsbHMubGVuZ3RofS5gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFZhbGlkYXRlIGVhY2ggY2FsbCBoYXMgcmVxdWlyZWQgZmllbGRzIGJlZm9yZSBleGVjdXRpbmdcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNhbGxzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNhbGwgPSBjYWxsc1tpXTtcclxuICAgICAgICAgICAgaWYgKCFjYWxsLnRvb2wgfHwgdHlwZW9mIGNhbGwudG9vbCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgY2FsbHNbJHtpfV0udG9vbCBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBhIHN0cmluZ2ApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghY2FsbC5hY3Rpb24gfHwgdHlwZW9mIGNhbGwuYWN0aW9uICE9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBjYWxsc1ske2l9XS5hY3Rpb24gaXMgcmVxdWlyZWQgYW5kIG11c3QgYmUgYSBzdHJpbmdgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcmVzdWx0czogQmF0Y2hSZXN1bHRFbnRyeVtdID0gW107XHJcbiAgICAgICAgbGV0IGNvbXBsZXRlZENvdW50ID0gMDtcclxuXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjYWxscy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCB7IHRvb2wsIGFjdGlvbiwgYXJnczogY2FsbEFyZ3MgPSB7fSB9ID0gY2FsbHNbaV07XHJcbiAgICAgICAgICAgIGNvbnN0IG1lcmdlZEFyZ3MgPSB7IGFjdGlvbiwgLi4uY2FsbEFyZ3MgfTtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByYXcgPSBhd2FpdCB0aGlzLmV4ZWN1dG9yLmV4ZWN1dGVUb29sQ2FsbCh0b29sLCBtZXJnZWRBcmdzKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xSZXN1bHQgPSByYXcgYXMgQWN0aW9uVG9vbFJlc3VsdDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3MgPSB0b29sUmVzdWx0Py5zdWNjZXNzICE9PSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXN1bHRzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBpLFxyXG4gICAgICAgICAgICAgICAgICAgIHRvb2wsXHJcbiAgICAgICAgICAgICAgICAgICAgYWN0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0OiB0b29sUmVzdWx0XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb21wbGV0ZWRDb3VudCsrO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghc3VjY2VzcyAmJiBzdG9wT25FcnJvcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVkQ291bnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b3RhbENvdW50OiBjYWxscy5sZW5ndGgsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9wcGVkQXQ6IGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdG9wcGVkRHVlVG9FcnJvcjogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBgQmF0Y2ggc3RvcHBlZCBhdCBjYWxsICR7aX0gKCR7dG9vbH0uJHthY3Rpb259KSBkdWUgdG8gZXJyb3JgXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbnRyeTogQmF0Y2hSZXN1bHRFbnRyeSA9IHtcclxuICAgICAgICAgICAgICAgICAgICBpbmRleDogaSxcclxuICAgICAgICAgICAgICAgICAgICB0b29sLFxyXG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbixcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IG51bGwsXHJcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGVyci5tZXNzYWdlXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0cy5wdXNoKGVudHJ5KTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoc3RvcE9uRXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcclxuICAgICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0cyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlZENvdW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdG90YWxDb3VudDogY2FsbHMubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcHBlZEF0OiBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RvcHBlZER1ZVRvRXJyb3I6IHRydWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgYEJhdGNoIHN0b3BwZWQgYXQgY2FsbCAke2l9ICgke3Rvb2x9LiR7YWN0aW9ufSkgZHVlIHRvIGV4Y2VwdGlvbjogJHtlcnIubWVzc2FnZX1gXHJcbiAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgYWxsU3VjY2VlZGVkID0gcmVzdWx0cy5ldmVyeShyID0+IHIuc3VjY2Vzcyk7XHJcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdHMsXHJcbiAgICAgICAgICAgICAgICBjb21wbGV0ZWRDb3VudCxcclxuICAgICAgICAgICAgICAgIHRvdGFsQ291bnQ6IGNhbGxzLmxlbmd0aCxcclxuICAgICAgICAgICAgICAgIGFsbFN1Y2NlZWRlZFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBgQmF0Y2ggY29tcGxldGVkOiAke2NvbXBsZXRlZENvdW50fS8ke2NhbGxzLmxlbmd0aH0gY2FsbHMgZXhlY3V0ZWQsICR7cmVzdWx0cy5maWx0ZXIociA9PiByLnN1Y2Nlc3MpLmxlbmd0aH0gc3VjY2VlZGVkYFxyXG4gICAgICAgICk7XHJcbiAgICB9XHJcbn1cclxuIl19