/**
 * Script attachment logic for the manage_component tool.
 * Extracted from ManageComponent.attachScript to keep manage-component.ts under 200 lines.
 */

import { ActionToolResult, successResult, errorResult } from '../types';

/**
 * Attach a TypeScript/JavaScript script component to a node.
 * @param getComponents - callback to query node components (avoids circular dep on ManageComponent)
 */
export async function attachScriptToNode(
    nodeUuid: string,
    scriptPath: string,
    getComponents: (nodeUuid: string) => Promise<ActionToolResult>
): Promise<ActionToolResult> {
    if (!nodeUuid || !scriptPath) {
        return errorResult('nodeUuid and scriptPath are required for action=attach_script');
    }

    const scriptName = scriptPath.split('/').pop()?.replace('.ts', '').replace('.js', '');
    if (!scriptName) {
        return errorResult('Invalid script path');
    }

    // Check if the script component already exists
    const existing = await getComponents(nodeUuid);
    if (existing.success && existing.data?.components) {
        const found = existing.data.components.find((comp: any) => comp.type === scriptName);
        if (found) {
            return successResult(
                { nodeUuid, componentName: scriptName, existing: true },
                `Script '${scriptName}' already exists on node`
            );
        }
    }

    // Try using the script name as a component type directly
    try {
        await Editor.Message.request('scene', 'create-component', { uuid: nodeUuid, component: scriptName });
        await new Promise(r => setTimeout(r, 100));

        const after = await getComponents(nodeUuid);
        if (after.success && after.data?.components) {
            const added = after.data.components.find((comp: any) => comp.type === scriptName);
            if (added) {
                return successResult(
                    { nodeUuid, componentName: scriptName, existing: false },
                    `Script '${scriptName}' attached successfully`
                );
            }
            return errorResult(`Script '${scriptName}' was not found on node after addition. Available components: ${after.data.components.map((c: any) => c.type).join(', ')}`);
        }
        return errorResult(`Failed to verify script addition: ${after.error || 'Unable to get node components'}`);

    } catch (err: any) {
        // Fallback: use scene script
        try {
            const result: any = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'attachScript', args: [nodeUuid, scriptPath]
            });
            if (result && result.success) {
                return successResult(result.data, result.message);
            }
        } catch {
            // ignore fallback error, fall through
        }
        return {
            success: false,
            error: `Failed to attach script '${scriptName}': ${err.message}`,
            instruction: 'Please ensure the script is properly compiled and exported as a Component class. You can also manually attach the script through the Properties panel in the editor.'
        };
    }
}
