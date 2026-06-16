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

    // Snapshot components BEFORE attaching. This both detects an already-attached
    // script and gives the baseline used to verify the addition by delta below.
    const before = await getComponents(nodeUuid);
    const beforeComponents: any[] = (before.success && before.data?.components) ? before.data.components : [];
    const alreadyAttached = beforeComponents.find((comp: any) => comp.type === scriptName);
    if (alreadyAttached) {
        return successResult(
            { nodeUuid, componentName: scriptName, existing: true },
            `Script '${scriptName}' already exists on node`
        );
    }
    const beforeCount = beforeComponents.length;
    const knownTypes = new Set(beforeComponents.map((c: any) => c.type));

    // Try using the script name as a component type directly
    try {
        await Editor.Message.request('scene', 'create-component', { uuid: nodeUuid, component: scriptName });

        // Verify by polling. Two reasons a single strict name check gives a false
        // negative: (1) the editor may surface the new component a moment later, and
        // (2) a user script's reported `type` is its cid (a compressed UUID), NOT the
        // bare class name — so an exact `type === scriptName` match never fires even
        // though the component IS present. Accept either an exact name match OR a
        // newly-appeared component (delta against the pre-attach snapshot).
        const VERIFY_ATTEMPTS = 5;
        const VERIFY_DELAY_MS = 100;
        let after = before;
        for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
            await new Promise(r => setTimeout(r, VERIFY_DELAY_MS));
            after = await getComponents(nodeUuid);
            if (!after.success || !after.data?.components) continue;
            const components: any[] = after.data.components;

            const named = components.find((comp: any) => comp.type === scriptName);
            if (named) {
                return successResult(
                    { nodeUuid, componentName: scriptName, existing: false },
                    `Script '${scriptName}' attached successfully`
                );
            }
            if (components.length > beforeCount) {
                const newComp = components.find((comp: any) => !knownTypes.has(comp.type));
                const reportedType = newComp?.type;
                return successResult(
                    { nodeUuid, componentName: scriptName, componentType: reportedType, existing: false },
                    `Script '${scriptName}' attached successfully` +
                        (reportedType && reportedType !== scriptName ? ` (reported on node as cid '${reportedType}')` : '')
                );
            }
        }

        const list = (after.success && after.data?.components)
            ? after.data.components.map((c: any) => c.type).join(', ')
            : (after.error || 'unable to read node components');
        return errorResult(`Script '${scriptName}' was not found on node after addition. Available components: ${list}`);

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
