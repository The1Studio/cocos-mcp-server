import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageValidation extends BaseActionTool {
    readonly name = 'manage_validation';
    readonly description = 'JSON validation and formatting utilities. Actions: validate_json, safe_string, format_request. Use before sending complex parameters to other tools.';
    readonly actions = ['validate_json', 'safe_string', 'format_request'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        validate_json: (args) => this.validateJson(args.jsonString, args.expectedSchema),
        safe_string: (args) => this.safeString(args.value),
        format_request: (args) => this.formatRequest(args.toolName, args.arguments),
    };

    private async validateJson(jsonString: string, expectedSchema?: any): Promise<ActionToolResult> {
        if (!jsonString) {
            return errorResult('jsonString is required for validate_json action');
        }
        try {
            let parsed;
            try {
                parsed = JSON.parse(jsonString);
            } catch (error: any) {
                const fixed = this.fixJsonString(jsonString);
                try {
                    parsed = JSON.parse(fixed);
                } catch {
                    return errorResult(`Cannot fix JSON: ${error.message}`);
                }
            }

            if (expectedSchema) {
                const validation = this.validateAgainstSchema(parsed, expectedSchema);
                if (!validation.valid) {
                    return successResult({
                        parsedJson: parsed,
                        validationErrors: validation.errors,
                        suggestions: validation.suggestions
                    }, 'Schema validation failed');
                }
            }

            return successResult({
                parsedJson: parsed,
                fixedJson: JSON.stringify(parsed, null, 2),
                isValid: true
            });
        } catch (error: any) {
            return errorResult(error.message);
        }
    }

    private async safeString(value: string): Promise<ActionToolResult> {
        if (value === undefined || value === null) {
            return errorResult('value is required for safe_string action');
        }
        const safeValue = this.escapeJsonString(value);
        return successResult({
            originalValue: value,
            safeValue,
            jsonReady: JSON.stringify(safeValue),
            usage: `Use "${safeValue}" in your JSON parameters`
        });
    }

    private async formatRequest(toolName: string, toolArgs: any): Promise<ActionToolResult> {
        if (!toolName) {
            return errorResult('toolName is required for format_request action');
        }
        if (toolArgs === undefined || toolArgs === null) {
            return errorResult('arguments is required for format_request action');
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

            return successResult({
                request: mcpRequest,
                formattedJson,
                compactJson,
                curlCommand: this.generateCurlCommand(compactJson)
            });
        } catch (error: any) {
            return errorResult(`Failed to format MCP request: ${error.message}`);
        }
    }

    private fixJsonString(jsonStr: string): string {
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

    private escapeJsonString(str: string): string {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\f/g, '\\f')
            .replace(/\b/g, '\\b');
    }

    private validateAgainstSchema(data: any, schema: any): { valid: boolean; errors: string[]; suggestions: string[] } {
        const errors: string[] = [];
        const suggestions: string[] = [];

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

    private generateCurlCommand(jsonStr: string): string {
        const escapedJson = jsonStr.replace(/'/g, "'\"'\"'");
        // Port is read from MCP server default; adjust if your server uses a different port
        return `curl -X POST http://127.0.0.1:3000/mcp \\\n  -H "Content-Type: application/json" \\\n  -d '${escapedJson}'`;
    }
}
