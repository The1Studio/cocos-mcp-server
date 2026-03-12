"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageValidation = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageValidation extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_validation';
        this.description = 'JSON validation and formatting utilities. Actions: validate_json, safe_string, format_request. Use before sending complex parameters to other tools.';
        this.actions = ['validate_json', 'safe_string', 'format_request'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: this.actions,
                    description: 'Action to perform'
                },
                jsonString: {
                    type: 'string',
                    description: 'JSON string to validate and fix (validate_json only)'
                },
                expectedSchema: {
                    type: 'object',
                    description: 'Expected parameter schema for validation (validate_json only, optional)'
                },
                value: {
                    type: 'string',
                    description: 'String value to make safe (safe_string only)'
                },
                toolName: {
                    type: 'string',
                    description: 'Tool name to call (format_request only)'
                },
                arguments: {
                    type: 'object',
                    description: 'Tool arguments (format_request only)'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            validate_json: (args) => this.validateJson(args.jsonString, args.expectedSchema),
            safe_string: (args) => this.safeString(args.value),
            format_request: (args) => this.formatRequest(args.toolName, args.arguments),
        };
    }
    async validateJson(jsonString, expectedSchema) {
        if (!jsonString) {
            return (0, types_1.errorResult)('jsonString is required for validate_json action');
        }
        try {
            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            }
            catch (error) {
                const fixed = this.fixJsonString(jsonString);
                try {
                    parsed = JSON.parse(fixed);
                }
                catch (_a) {
                    return (0, types_1.errorResult)(`Cannot fix JSON: ${error.message}`);
                }
            }
            if (expectedSchema) {
                const validation = this.validateAgainstSchema(parsed, expectedSchema);
                if (!validation.valid) {
                    return (0, types_1.successResult)({
                        parsedJson: parsed,
                        validationErrors: validation.errors,
                        suggestions: validation.suggestions
                    }, 'Schema validation failed');
                }
            }
            return (0, types_1.successResult)({
                parsedJson: parsed,
                fixedJson: JSON.stringify(parsed, null, 2),
                isValid: true
            });
        }
        catch (error) {
            return (0, types_1.errorResult)(error.message);
        }
    }
    async safeString(value) {
        if (value === undefined || value === null) {
            return (0, types_1.errorResult)('value is required for safe_string action');
        }
        const safeValue = this.escapeJsonString(value);
        return (0, types_1.successResult)({
            originalValue: value,
            safeValue,
            jsonReady: JSON.stringify(safeValue),
            usage: `Use "${safeValue}" in your JSON parameters`
        });
    }
    async formatRequest(toolName, toolArgs) {
        if (!toolName) {
            return (0, types_1.errorResult)('toolName is required for format_request action');
        }
        if (toolArgs === undefined || toolArgs === null) {
            return (0, types_1.errorResult)('arguments is required for format_request action');
        }
        try {
            const mcpRequest = {
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: {
                    name: toolName,
                    arguments: toolArgs
                }
            };
            const formattedJson = JSON.stringify(mcpRequest, null, 2);
            const compactJson = JSON.stringify(mcpRequest);
            return (0, types_1.successResult)({
                request: mcpRequest,
                formattedJson,
                compactJson,
                curlCommand: this.generateCurlCommand(compactJson)
            });
        }
        catch (error) {
            return (0, types_1.errorResult)(`Failed to format MCP request: ${error.message}`);
        }
    }
    fixJsonString(jsonStr) {
        let fixed = jsonStr;
        fixed = fixed
            .replace(/(\{[^}]*"[^"]*":\s*")([^"]*")([^"]*")([^}]*\})/g, (match, prefix, content, suffix, end) => {
            const escapedContent = content.replace(/"/g, '\\"');
            return prefix + escapedContent + suffix + end;
        })
            .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2')
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/'/g, '"');
        return fixed;
    }
    escapeJsonString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f')
            .replace(/\b/g, '\\b');
    }
    validateAgainstSchema(data, schema) {
        const errors = [];
        const suggestions = [];
        if (schema.type) {
            const actualType = Array.isArray(data) ? 'array' : typeof data;
            if (actualType !== schema.type) {
                errors.push(`Expected type ${schema.type}, got ${actualType}`);
                suggestions.push(`Convert value to ${schema.type}`);
            }
        }
        if (schema.required && Array.isArray(schema.required)) {
            for (const field of schema.required) {
                if (!Object.prototype.hasOwnProperty.call(data, field)) {
                    errors.push(`Missing required field: ${field}`);
                    suggestions.push(`Add required field "${field}"`);
                }
            }
        }
        return { valid: errors.length === 0, errors, suggestions };
    }
    generateCurlCommand(jsonStr) {
        const escapedJson = jsonStr.replace(/'/g, "'\"'\"'");
        return `curl -X POST http://127.0.0.1:8585/mcp \\\n  -H "Content-Type: application/json" \\\n  -d '${escapedJson}'`;
    }
}
exports.ManageValidation = ManageValidation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXZhbGlkYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXZhbGlkYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLGdCQUFpQixTQUFRLGlDQUFjO0lBQXBEOztRQUNhLFNBQUksR0FBRyxtQkFBbUIsQ0FBQztRQUMzQixnQkFBVyxHQUFHLHNKQUFzSixDQUFDO1FBQ3JLLFlBQU8sR0FBRyxDQUFDLGVBQWUsRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUM3RCxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87b0JBQ2xCLFdBQVcsRUFBRSxtQkFBbUI7aUJBQ25DO2dCQUNELFVBQVUsRUFBRTtvQkFDUixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsc0RBQXNEO2lCQUN0RTtnQkFDRCxjQUFjLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHlFQUF5RTtpQkFDekY7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw4Q0FBOEM7aUJBQzlEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUseUNBQXlDO2lCQUN6RDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHNDQUFzQztpQkFDdEQ7YUFDSjtZQUNELFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO1FBRVEsbUJBQWMsR0FBNkU7WUFDakcsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUs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SSxVQUFVLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUM3QixNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixNQUFNLENBQUMsSUFBSSxTQUFTLFVBQVUsRUFBRSxDQUFDLENBQUM7Z0JBQy9ELFdBQVcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3hELENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxNQUFNLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDcEQsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQ2hELFdBQVcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ3RELENBQUM7WUFDTCxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQy9ELENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxPQUFlO1FBQ3ZDLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELE9BQU8sOEZBQThGLFdBQVcsR0FBRyxDQUFDO0lBQ3hILENBQUM7Q0FDSjtBQXBMRCw0Q0FvTEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGNsYXNzIE1hbmFnZVZhbGlkYXRpb24gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfdmFsaWRhdGlvbic7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnSlNPTiB2YWxpZGF0aW9uIGFuZCBmb3JtYXR0aW5nIHV0aWxpdGllcy4gQWN0aW9uczogdmFsaWRhdGVfanNvbiwgc2FmZV9zdHJpbmcsIGZvcm1hdF9yZXF1ZXN0LiBVc2UgYmVmb3JlIHNlbmRpbmcgY29tcGxleCBwYXJhbWV0ZXJzIHRvIG90aGVyIHRvb2xzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsndmFsaWRhdGVfanNvbicsICdzYWZlX3N0cmluZycsICdmb3JtYXRfcmVxdWVzdCddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogdGhpcy5hY3Rpb25zLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0nXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAganNvblN0cmluZzoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnSlNPTiBzdHJpbmcgdG8gdmFsaWRhdGUgYW5kIGZpeCAodmFsaWRhdGVfanNvbiBvbmx5KSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBleHBlY3RlZFNjaGVtYToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnRXhwZWN0ZWQgcGFyYW1ldGVyIHNjaGVtYSBmb3IgdmFsaWRhdGlvbiAodmFsaWRhdGVfanNvbiBvbmx5LCBvcHRpb25hbCknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmFsdWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1N0cmluZyB2YWx1ZSB0byBtYWtlIHNhZmUgKHNhZmVfc3RyaW5nIG9ubHkpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRvb2xOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUb29sIG5hbWUgdG8gY2FsbCAoZm9ybWF0X3JlcXVlc3Qgb25seSknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXJndW1lbnRzOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdUb29sIGFyZ3VtZW50cyAoZm9ybWF0X3JlcXVlc3Qgb25seSknXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICB2YWxpZGF0ZV9qc29uOiAoYXJncykgPT4gdGhpcy52YWxpZGF0ZUpzb24oYXJncy5qc29uU3RyaW5nLCBhcmdzLmV4cGVjdGVkU2NoZW1hKSxcbiAgICAgICAgc2FmZV9zdHJpbmc6IChhcmdzKSA9PiB0aGlzLnNhZmVTdHJpbmcoYXJncy52YWx1ZSksXG4gICAgICAgIGZvcm1hdF9yZXF1ZXN0OiAoYXJncykgPT4gdGhpcy5mb3JtYXRSZXF1ZXN0KGFyZ3MudG9vbE5hbWUsIGFyZ3MuYXJndW1lbnRzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyB2YWxpZGF0ZUpzb24oanNvblN0cmluZzogc3RyaW5nLCBleHBlY3RlZFNjaGVtYT86IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWpzb25TdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnanNvblN0cmluZyBpcyByZXF1aXJlZCBmb3IgdmFsaWRhdGVfanNvbiBhY3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0IHBhcnNlZDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgcGFyc2VkID0gSlNPTi5wYXJzZShqc29uU3RyaW5nKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBmaXhlZCA9IHRoaXMuZml4SnNvblN0cmluZyhqc29uU3RyaW5nKTtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBwYXJzZWQgPSBKU09OLnBhcnNlKGZpeGVkKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBDYW5ub3QgZml4IEpTT046ICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChleHBlY3RlZFNjaGVtYSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHZhbGlkYXRpb24gPSB0aGlzLnZhbGlkYXRlQWdhaW5zdFNjaGVtYShwYXJzZWQsIGV4cGVjdGVkU2NoZW1hKTtcbiAgICAgICAgICAgICAgICBpZiAoIXZhbGlkYXRpb24udmFsaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgcGFyc2VkSnNvbjogcGFyc2VkLFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsaWRhdGlvbkVycm9yczogdmFsaWRhdGlvbi5lcnJvcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9uczogdmFsaWRhdGlvbi5zdWdnZXN0aW9uc1xuICAgICAgICAgICAgICAgICAgICB9LCAnU2NoZW1hIHZhbGlkYXRpb24gZmFpbGVkJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgcGFyc2VkSnNvbjogcGFyc2VkLFxuICAgICAgICAgICAgICAgIGZpeGVkSnNvbjogSlNPTi5zdHJpbmdpZnkocGFyc2VkLCBudWxsLCAyKSxcbiAgICAgICAgICAgICAgICBpc1ZhbGlkOiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVycm9yLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzYWZlU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQgZm9yIHNhZmVfc3RyaW5nIGFjdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNhZmVWYWx1ZSA9IHRoaXMuZXNjYXBlSnNvblN0cmluZyh2YWx1ZSk7XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIG9yaWdpbmFsVmFsdWU6IHZhbHVlLFxuICAgICAgICAgICAgc2FmZVZhbHVlLFxuICAgICAgICAgICAganNvblJlYWR5OiBKU09OLnN0cmluZ2lmeShzYWZlVmFsdWUpLFxuICAgICAgICAgICAgdXNhZ2U6IGBVc2UgXCIke3NhZmVWYWx1ZX1cIiBpbiB5b3VyIEpTT04gcGFyYW1ldGVyc2BcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBmb3JtYXRSZXF1ZXN0KHRvb2xOYW1lOiBzdHJpbmcsIHRvb2xBcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCF0b29sTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCd0b29sTmFtZSBpcyByZXF1aXJlZCBmb3IgZm9ybWF0X3JlcXVlc3QgYWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRvb2xBcmdzID09PSB1bmRlZmluZWQgfHwgdG9vbEFyZ3MgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnYXJndW1lbnRzIGlzIHJlcXVpcmVkIGZvciBmb3JtYXRfcmVxdWVzdCBhY3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgbWNwUmVxdWVzdCA9IHtcbiAgICAgICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgICAgICBpZDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICd0b29scy9jYWxsJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50czogdG9vbEFyZ3NcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWRKc29uID0gSlNPTi5zdHJpbmdpZnkobWNwUmVxdWVzdCwgbnVsbCwgMik7XG4gICAgICAgICAgICBjb25zdCBjb21wYWN0SnNvbiA9IEpTT04uc3RyaW5naWZ5KG1jcFJlcXVlc3QpO1xuXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICAgICAgcmVxdWVzdDogbWNwUmVxdWVzdCxcbiAgICAgICAgICAgICAgICBmb3JtYXR0ZWRKc29uLFxuICAgICAgICAgICAgICAgIGNvbXBhY3RKc29uLFxuICAgICAgICAgICAgICAgIGN1cmxDb21tYW5kOiB0aGlzLmdlbmVyYXRlQ3VybENvbW1hbmQoY29tcGFjdEpzb24pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZm9ybWF0IE1DUCByZXF1ZXN0OiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGZpeEpzb25TdHJpbmcoanNvblN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgbGV0IGZpeGVkID0ganNvblN0cjtcbiAgICAgICAgZml4ZWQgPSBmaXhlZFxuICAgICAgICAgICAgLnJlcGxhY2UoLyhcXHtbXn1dKlwiW15cIl0qXCI6XFxzKlwiKShbXlwiXSpcIikoW15cIl0qXCIpKFtefV0qXFx9KS9nLCAobWF0Y2gsIHByZWZpeCwgY29udGVudCwgc3VmZml4LCBlbmQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkQ29udGVudCA9IGNvbnRlbnQucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpO1xuICAgICAgICAgICAgICAgIHJldHVybiBwcmVmaXggKyBlc2NhcGVkQ29udGVudCArIHN1ZmZpeCArIGVuZDtcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvKFteXFxcXF0pXFxcXChbXlwiXFxcXFxcL2JmbnJ0dV0pL2csICckMVxcXFxcXFxcJDInKVxuICAgICAgICAgICAgLnJlcGxhY2UoLywoXFxzKlt9XFxdXSkvZywgJyQxJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgJ1xcXFx0JylcbiAgICAgICAgICAgIC5yZXBsYWNlKC8nL2csICdcIicpO1xuICAgICAgICByZXR1cm4gZml4ZWQ7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBlc2NhcGVKc29uU3RyaW5nKHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgcmV0dXJuIHN0clxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFwvZywgJ1xcXFxcXFxcJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgJ1xcXFx0JylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXGYvZywgJ1xcXFxmJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXGIvZywgJ1xcXFxiJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB2YWxpZGF0ZUFnYWluc3RTY2hlbWEoZGF0YTogYW55LCBzY2hlbWE6IGFueSk6IHsgdmFsaWQ6IGJvb2xlYW47IGVycm9yczogc3RyaW5nW107IHN1Z2dlc3Rpb25zOiBzdHJpbmdbXSB9IHtcbiAgICAgICAgY29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBzdWdnZXN0aW9uczogc3RyaW5nW10gPSBbXTtcblxuICAgICAgICBpZiAoc2NoZW1hLnR5cGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGFjdHVhbFR5cGUgPSBBcnJheS5pc0FycmF5KGRhdGEpID8gJ2FycmF5JyA6IHR5cGVvZiBkYXRhO1xuICAgICAgICAgICAgaWYgKGFjdHVhbFR5cGUgIT09IHNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICAgICAgZXJyb3JzLnB1c2goYEV4cGVjdGVkIHR5cGUgJHtzY2hlbWEudHlwZX0sIGdvdCAke2FjdHVhbFR5cGV9YCk7XG4gICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgQ29udmVydCB2YWx1ZSB0byAke3NjaGVtYS50eXBlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHNjaGVtYS5yZXF1aXJlZCAmJiBBcnJheS5pc0FycmF5KHNjaGVtYS5yZXF1aXJlZCkpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZmllbGQgb2Ygc2NoZW1hLnJlcXVpcmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZGF0YSwgZmllbGQpKSB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGBNaXNzaW5nIHJlcXVpcmVkIGZpZWxkOiAke2ZpZWxkfWApO1xuICAgICAgICAgICAgICAgICAgICBzdWdnZXN0aW9ucy5wdXNoKGBBZGQgcmVxdWlyZWQgZmllbGQgXCIke2ZpZWxkfVwiYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgdmFsaWQ6IGVycm9ycy5sZW5ndGggPT09IDAsIGVycm9ycywgc3VnZ2VzdGlvbnMgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybENvbW1hbmQoanNvblN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgICAgICAgY29uc3QgZXNjYXBlZEpzb24gPSBqc29uU3RyLnJlcGxhY2UoLycvZywgXCInXFxcIidcXFwiJ1wiKTtcbiAgICAgICAgcmV0dXJuIGBjdXJsIC1YIFBPU1QgaHR0cDovLzEyNy4wLjAuMTo4NTg1L21jcCBcXFxcXFxuICAtSCBcIkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvblwiIFxcXFxcXG4gIC1kICcke2VzY2FwZWRKc29ufSdgO1xuICAgIH1cbn1cbiJdfQ==