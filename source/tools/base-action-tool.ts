import { ActionToolExecutor, ActionToolResult, errorResult } from '../types';

/**
 * Base class for action-based tools.
 * Subclasses define actions in a map and the base class handles routing.
 */
export abstract class BaseActionTool implements ActionToolExecutor {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly inputSchema: object;
    abstract readonly actions: string[];

    /** Map of action name -> handler method */
    protected abstract actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>>;

    async execute(action: string, args: Record<string, any>): Promise<ActionToolResult> {
        const handler = this.actionHandlers[action];
        if (!handler) {
            return errorResult(
                `Unknown action '${action}' for tool '${this.name}'. ` +
                `Available actions: ${this.actions.join(', ')}`
            );
        }
        try {
            return await handler.call(this, args);
        } catch (err: any) {
            return errorResult(`${this.name}.${action} failed: ${err.message}`);
        }
    }
}
