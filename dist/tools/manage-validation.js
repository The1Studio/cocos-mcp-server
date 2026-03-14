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
        // Port is read from MCP server default; adjust if your server uses a different port
        return `curl -X POST http://127.0.0.1:3000/mcp \\\n  -H "Content-Type: application/json" \\\n  -d '${escapedJson}'`;
    }
}
exports.ManageValidation = ManageValidation;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXZhbGlkYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXZhbGlkYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLGdCQUFpQixTQUFRLGlDQUFjO0lBQXBEOztRQUNhLFNBQUksR0FBRyxtQkFBbUIsQ0FBQztRQUMzQixnQkFBVyxHQUFHLHNKQUFzSixDQUFDO1FBQ3JLLFlBQU8sR0FBRyxDQUFDLGVBQWUsRUFBRSxhQUFhLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztRQUM3RCxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU87b0JBQ2xCLFdBQVcsRUFBRSxtQkFBbUI7aUJBQ25DO2dCQUNELFVBQVUsRUFBRTtvQkFDUixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsc0RBQXNEO2lCQUN0RTtnQkFDRCxjQUFjLEVBQUU7b0JBQ1osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHlFQUF5RTtpQkFDekY7Z0JBQ0QsS0FBSyxFQUFFO29CQUNILElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw4Q0FBOEM7aUJBQzlEO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUseUNBQXlDO2lCQUN6RDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHNDQUFzQztpQkFDdEQ7YUFDSjtZQUNELFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO1FBRVEsbUJBQWMsR0FBNkU7WUFDakcsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQztZQUNoRixXQUFXLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUNsRCxjQUFjLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO1NBQzlFLENBQUM7SUE2SU4sQ0FBQztJQTNJVyxLQUFLLENBQUMsWUFBWSxDQUFDLFVBQWtCLEVBQUUsY0FBb0I7UUFDL0QsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2QsT0FBTyxJQUFBLG1CQUFXLEVBQUMsaURBQWlELENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0QsSUFBSSxNQUFNLENBQUM7WUFDWCxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDcEMsQ0FBQztZQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7Z0JBQ2xCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7Z0JBQzdDLElBQUksQ0FBQztvQkFDRCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDL0IsQ0FBQztnQkFBQyxXQUFNLENBQUM7b0JBQ0wsT0FBTyxJQUFBLG1CQUFXLEVBQUMsb0JBQW9CLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO2dCQUM1RCxDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksY0FBYyxFQUFFLENBQUM7Z0JBQ2pCLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsY0FBYyxDQUFDLENBQUM7Z0JBQ3RFLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7b0JBQ3BCLE9BQU8sSUFBQSxxQkFBYSxFQUFDO3dCQUNqQixVQUFVLEVBQUUsTUFBTTt3QkFDbEIsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLE1BQU07d0JBQ25DLFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVztxQkFDdEMsRUFBRSwwQkFBMEIsQ0FBQyxDQUFDO2dCQUNuQyxDQUFDO1lBQ0wsQ0FBQztZQUVELE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixVQUFVLEVBQUUsTUFBTTtnQkFDbEIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7Z0JBQzFDLE9BQU8sRUFBRSxJQUFJO2FBQ2hCLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0wsQ0FBQztJQUVPLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBYTtRQUNsQyxJQUFJLEtBQUssS0FBSyxTQUFTLElBQUksS0FBSyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQ3hDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLDBDQUEwQyxDQUFDLENBQUM7UUFDbkUsQ0FBQztRQUNELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxPQUFPLElBQUEscUJBQWEsRUFBQztZQUNqQixhQUFhLEVBQUUsS0FBSztZQUNwQixTQUFTO1lBQ1QsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDO1lBQ3BDLEtBQUssRUFBRSxRQUFRLFNBQVMsMkJBQTJCO1NBQ3RELENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxLQUFLLENBQUMsYUFBYSxDQUFDLFFBQWdCLEVBQUUsUUFBYTtRQUN2RCxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDWixPQUFPLElBQUEsbUJBQVcsRUFBQyxnREFBZ0QsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFDRCxJQUFJLFFBQVEsS0FBSyxTQUFTLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzlDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGlEQUFpRCxDQUFDLENBQUM7UUFDMUUsQ0FBQztRQUNELElBQUksQ0FBQztZQUNELE1BQU0sVUFBVSxHQUFHO2dCQUNmLE9BQU8sRUFBRSxLQUFLO2dCQUNkLEVBQUUsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFO2dCQUNkLE1BQU0sRUFBRSxZQUFZO2dCQUNwQixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsU0FBUyxFQUFFLFFBQVE7aUJBQ3RCO2FBQ0osQ0FBQztZQUVGLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMxRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBRS9DLE9BQU8sSUFBQSxxQkFBYSxFQUFDO2dCQUNqQixPQUFPLEVBQUUsVUFBVTtnQkFDbkIsYUFBYTtnQkFDYixXQUFXO2dCQUNYLFdBQVcsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDO2FBQ3JELENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGlDQUFpQyxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN6RSxDQUFDO0lBQ0wsQ0FBQztJQUVPLGFBQWEsQ0FBQyxPQUFlO1FBQ2pDLElBQUksS0FBSyxHQUFHLE9BQU8sQ0FBQztRQUNwQixLQUFLLEdBQUcsS0FBSzthQUNSLE9BQU8sQ0FBQyxpREFBaUQsRUFBRSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsRUFBRTtZQUNoRyxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNwRCxPQUFPLE1BQU0sR0FBRyxjQUFjLEdBQUcsTUFBTSxHQUFHLEdBQUcsQ0FBQztRQUNsRCxDQUFDLENBQUM7YUFDRCxPQUFPLENBQUMsNEJBQTRCLEVBQUUsVUFBVSxDQUFDO2FBQ2pELE9BQU8sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDO2FBQzdCLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDeEIsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztJQUVPLGdCQUFnQixDQUFDLEdBQVc7UUFDaEMsT0FBTyxHQUFHO2FBQ0wsT0FBTyxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUM7YUFDdEIsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUM7YUFDcEIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7YUFDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7YUFDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7YUFDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7YUFDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRU8scUJBQXFCLENBQUMsSUFBUyxFQUFFLE1BQVc7UUFDaEQsTUFBTSxNQUFNLEdBQWEsRUFBRSxDQUFDO1FBQzVCLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUVqQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNkLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxJQUFJLENBQUM7WUFDL0QsSUFBSSxVQUFVLEtBQUssTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUM3QixNQUFNLENBQUMsSUFBSSxDQUFDLGlCQUFpQixNQUFNLENBQUMsSUFBSSxTQUFTLFVBQVUsRUFBRSxDQUFDLENBQUM7Z0JBQy9ELFdBQVcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQ3hELENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxNQUFNLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDcEQsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7b0JBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLEtBQUssRUFBRSxDQUFDLENBQUM7b0JBQ2hELFdBQVcsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLEtBQUssR0FBRyxDQUFDLENBQUM7Z0JBQ3RELENBQUM7WUFDTCxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDO0lBQy9ELENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxPQUFlO1FBQ3ZDLE1BQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ3JELG9GQUFvRjtRQUNwRixPQUFPLDhGQUE4RixXQUFXLEdBQUcsQ0FBQztJQUN4SCxDQUFDO0NBQ0o7QUFyTEQsNENBcUxDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VWYWxpZGF0aW9uIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3ZhbGlkYXRpb24nO1xuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ0pTT04gdmFsaWRhdGlvbiBhbmQgZm9ybWF0dGluZyB1dGlsaXRpZXMuIEFjdGlvbnM6IHZhbGlkYXRlX2pzb24sIHNhZmVfc3RyaW5nLCBmb3JtYXRfcmVxdWVzdC4gVXNlIGJlZm9yZSBzZW5kaW5nIGNvbXBsZXggcGFyYW1ldGVycyB0byBvdGhlciB0b29scy4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ3ZhbGlkYXRlX2pzb24nLCAnc2FmZV9zdHJpbmcnLCAnZm9ybWF0X3JlcXVlc3QnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IHRoaXMuYWN0aW9ucyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGpzb25TdHJpbmc6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0pTT04gc3RyaW5nIHRvIHZhbGlkYXRlIGFuZCBmaXggKHZhbGlkYXRlX2pzb24gb25seSknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZXhwZWN0ZWRTY2hlbWE6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0V4cGVjdGVkIHBhcmFtZXRlciBzY2hlbWEgZm9yIHZhbGlkYXRpb24gKHZhbGlkYXRlX2pzb24gb25seSwgb3B0aW9uYWwpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdTdHJpbmcgdmFsdWUgdG8gbWFrZSBzYWZlIChzYWZlX3N0cmluZyBvbmx5KSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0b29sTmFtZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVG9vbCBuYW1lIHRvIGNhbGwgKGZvcm1hdF9yZXF1ZXN0IG9ubHkpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFyZ3VtZW50czoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnVG9vbCBhcmd1bWVudHMgKGZvcm1hdF9yZXF1ZXN0IG9ubHkpJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxuICAgIH07XG5cbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcbiAgICAgICAgdmFsaWRhdGVfanNvbjogKGFyZ3MpID0+IHRoaXMudmFsaWRhdGVKc29uKGFyZ3MuanNvblN0cmluZywgYXJncy5leHBlY3RlZFNjaGVtYSksXG4gICAgICAgIHNhZmVfc3RyaW5nOiAoYXJncykgPT4gdGhpcy5zYWZlU3RyaW5nKGFyZ3MudmFsdWUpLFxuICAgICAgICBmb3JtYXRfcmVxdWVzdDogKGFyZ3MpID0+IHRoaXMuZm9ybWF0UmVxdWVzdChhcmdzLnRvb2xOYW1lLCBhcmdzLmFyZ3VtZW50cyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgdmFsaWRhdGVKc29uKGpzb25TdHJpbmc6IHN0cmluZywgZXhwZWN0ZWRTY2hlbWE/OiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFqc29uU3RyaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2pzb25TdHJpbmcgaXMgcmVxdWlyZWQgZm9yIHZhbGlkYXRlX2pzb24gYWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCBwYXJzZWQ7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHBhcnNlZCA9IEpTT04ucGFyc2UoanNvblN0cmluZyk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZml4ZWQgPSB0aGlzLmZpeEpzb25TdHJpbmcoanNvblN0cmluZyk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyc2VkID0gSlNPTi5wYXJzZShmaXhlZCk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgQ2Fubm90IGZpeCBKU09OOiAke2Vycm9yLm1lc3NhZ2V9YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoZXhwZWN0ZWRTY2hlbWEpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2YWxpZGF0aW9uID0gdGhpcy52YWxpZGF0ZUFnYWluc3RTY2hlbWEocGFyc2VkLCBleHBlY3RlZFNjaGVtYSk7XG4gICAgICAgICAgICAgICAgaWYgKCF2YWxpZGF0aW9uLnZhbGlkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnNlZEpzb246IHBhcnNlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbGlkYXRpb25FcnJvcnM6IHZhbGlkYXRpb24uZXJyb3JzLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnM6IHZhbGlkYXRpb24uc3VnZ2VzdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgfSwgJ1NjaGVtYSB2YWxpZGF0aW9uIGZhaWxlZCcpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHBhcnNlZEpzb246IHBhcnNlZCxcbiAgICAgICAgICAgICAgICBmaXhlZEpzb246IEpTT04uc3RyaW5naWZ5KHBhcnNlZCwgbnVsbCwgMiksXG4gICAgICAgICAgICAgICAgaXNWYWxpZDogdHJ1ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnJvci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2FmZVN0cmluZyh2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ3ZhbHVlIGlzIHJlcXVpcmVkIGZvciBzYWZlX3N0cmluZyBhY3Rpb24nKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzYWZlVmFsdWUgPSB0aGlzLmVzY2FwZUpzb25TdHJpbmcodmFsdWUpO1xuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XG4gICAgICAgICAgICBvcmlnaW5hbFZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgIHNhZmVWYWx1ZSxcbiAgICAgICAgICAgIGpzb25SZWFkeTogSlNPTi5zdHJpbmdpZnkoc2FmZVZhbHVlKSxcbiAgICAgICAgICAgIHVzYWdlOiBgVXNlIFwiJHtzYWZlVmFsdWV9XCIgaW4geW91ciBKU09OIHBhcmFtZXRlcnNgXG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZm9ybWF0UmVxdWVzdCh0b29sTmFtZTogc3RyaW5nLCB0b29sQXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghdG9vbE5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgndG9vbE5hbWUgaXMgcmVxdWlyZWQgZm9yIGZvcm1hdF9yZXF1ZXN0IGFjdGlvbicpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0b29sQXJncyA9PT0gdW5kZWZpbmVkIHx8IHRvb2xBcmdzID09PSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ2FyZ3VtZW50cyBpcyByZXF1aXJlZCBmb3IgZm9ybWF0X3JlcXVlc3QgYWN0aW9uJyk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG1jcFJlcXVlc3QgPSB7XG4gICAgICAgICAgICAgICAganNvbnJwYzogJzIuMCcsXG4gICAgICAgICAgICAgICAgaWQ6IERhdGUubm93KCksXG4gICAgICAgICAgICAgICAgbWV0aG9kOiAndG9vbHMvY2FsbCcsXG4gICAgICAgICAgICAgICAgcGFyYW1zOiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHRvb2xOYW1lLFxuICAgICAgICAgICAgICAgICAgICBhcmd1bWVudHM6IHRvb2xBcmdzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkSnNvbiA9IEpTT04uc3RyaW5naWZ5KG1jcFJlcXVlc3QsIG51bGwsIDIpO1xuICAgICAgICAgICAgY29uc3QgY29tcGFjdEpzb24gPSBKU09OLnN0cmluZ2lmeShtY3BSZXF1ZXN0KTtcblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIHJlcXVlc3Q6IG1jcFJlcXVlc3QsXG4gICAgICAgICAgICAgICAgZm9ybWF0dGVkSnNvbixcbiAgICAgICAgICAgICAgICBjb21wYWN0SnNvbixcbiAgICAgICAgICAgICAgICBjdXJsQ29tbWFuZDogdGhpcy5nZW5lcmF0ZUN1cmxDb21tYW5kKGNvbXBhY3RKc29uKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGZvcm1hdCBNQ1AgcmVxdWVzdDogJHtlcnJvci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBmaXhKc29uU3RyaW5nKGpzb25TdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGxldCBmaXhlZCA9IGpzb25TdHI7XG4gICAgICAgIGZpeGVkID0gZml4ZWRcbiAgICAgICAgICAgIC5yZXBsYWNlKC8oXFx7W159XSpcIlteXCJdKlwiOlxccypcIikoW15cIl0qXCIpKFteXCJdKlwiKShbXn1dKlxcfSkvZywgKG1hdGNoLCBwcmVmaXgsIGNvbnRlbnQsIHN1ZmZpeCwgZW5kKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXNjYXBlZENvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1wiL2csICdcXFxcXCInKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJlZml4ICsgZXNjYXBlZENvbnRlbnQgKyBzdWZmaXggKyBlbmQ7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoLyhbXlxcXFxdKVxcXFwoW15cIlxcXFxcXC9iZm5ydHVdKS9nLCAnJDFcXFxcXFxcXCQyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC8sKFxccypbfVxcXV0pL2csICckMScpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxuL2csICdcXFxcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICdcXFxcdCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvJy9nLCAnXCInKTtcbiAgICAgICAgcmV0dXJuIGZpeGVkO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXNjYXBlSnNvblN0cmluZyhzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIHJldHVybiBzdHJcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvXCIvZywgJ1xcXFxcIicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxuL2csICdcXFxcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxyL2csICdcXFxccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICdcXFxcdCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxmL2csICdcXFxcZicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxiL2csICdcXFxcYicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgdmFsaWRhdGVBZ2FpbnN0U2NoZW1hKGRhdGE6IGFueSwgc2NoZW1hOiBhbnkpOiB7IHZhbGlkOiBib29sZWFuOyBlcnJvcnM6IHN0cmluZ1tdOyBzdWdnZXN0aW9uczogc3RyaW5nW10gfSB7XG4gICAgICAgIGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3Qgc3VnZ2VzdGlvbnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgaWYgKHNjaGVtYS50eXBlKSB7XG4gICAgICAgICAgICBjb25zdCBhY3R1YWxUeXBlID0gQXJyYXkuaXNBcnJheShkYXRhKSA/ICdhcnJheScgOiB0eXBlb2YgZGF0YTtcbiAgICAgICAgICAgIGlmIChhY3R1YWxUeXBlICE9PSBzY2hlbWEudHlwZSkge1xuICAgICAgICAgICAgICAgIGVycm9ycy5wdXNoKGBFeHBlY3RlZCB0eXBlICR7c2NoZW1hLnR5cGV9LCBnb3QgJHthY3R1YWxUeXBlfWApO1xuICAgICAgICAgICAgICAgIHN1Z2dlc3Rpb25zLnB1c2goYENvbnZlcnQgdmFsdWUgdG8gJHtzY2hlbWEudHlwZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzY2hlbWEucmVxdWlyZWQgJiYgQXJyYXkuaXNBcnJheShzY2hlbWEucmVxdWlyZWQpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIHNjaGVtYS5yZXF1aXJlZCkge1xuICAgICAgICAgICAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGRhdGEsIGZpZWxkKSkge1xuICAgICAgICAgICAgICAgICAgICBlcnJvcnMucHVzaChgTWlzc2luZyByZXF1aXJlZCBmaWVsZDogJHtmaWVsZH1gKTtcbiAgICAgICAgICAgICAgICAgICAgc3VnZ2VzdGlvbnMucHVzaChgQWRkIHJlcXVpcmVkIGZpZWxkIFwiJHtmaWVsZH1cImApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IHZhbGlkOiBlcnJvcnMubGVuZ3RoID09PSAwLCBlcnJvcnMsIHN1Z2dlc3Rpb25zIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUN1cmxDb21tYW5kKGpzb25TdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgICAgIGNvbnN0IGVzY2FwZWRKc29uID0ganNvblN0ci5yZXBsYWNlKC8nL2csIFwiJ1xcXCInXFxcIidcIik7XG4gICAgICAgIC8vIFBvcnQgaXMgcmVhZCBmcm9tIE1DUCBzZXJ2ZXIgZGVmYXVsdDsgYWRqdXN0IGlmIHlvdXIgc2VydmVyIHVzZXMgYSBkaWZmZXJlbnQgcG9ydFxuICAgICAgICByZXR1cm4gYGN1cmwgLVggUE9TVCBodHRwOi8vMTI3LjAuMC4xOjMwMDAvbWNwIFxcXFxcXG4gIC1IIFwiQ29udGVudC1UeXBlOiBhcHBsaWNhdGlvbi9qc29uXCIgXFxcXFxcbiAgLWQgJyR7ZXNjYXBlZEpzb259J2A7XG4gICAgfVxufVxuIl19