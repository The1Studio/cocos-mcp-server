"use strict";
/**
 * Script attachment logic for the manage_component tool.
 * Extracted from ManageComponent.attachScript to keep manage-component.ts under 200 lines.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachScriptToNode = attachScriptToNode;
const types_1 = require("../types");
/**
 * Attach a TypeScript/JavaScript script component to a node.
 * @param getComponents - callback to query node components (avoids circular dep on ManageComponent)
 */
async function attachScriptToNode(nodeUuid, scriptPath, getComponents) {
    var _a, _b, _c, _d;
    if (!nodeUuid || !scriptPath) {
        return (0, types_1.errorResult)('nodeUuid and scriptPath are required for action=attach_script');
    }
    const scriptName = (_a = scriptPath.split('/').pop()) === null || _a === void 0 ? void 0 : _a.replace('.ts', '').replace('.js', '');
    if (!scriptName) {
        return (0, types_1.errorResult)('Invalid script path');
    }
    // Snapshot components BEFORE attaching. This both detects an already-attached
    // script and gives the baseline used to verify the addition by delta below.
    const before = await getComponents(nodeUuid);
    const beforeComponents = (before.success && ((_b = before.data) === null || _b === void 0 ? void 0 : _b.components)) ? before.data.components : [];
    const alreadyAttached = beforeComponents.find((comp) => comp.type === scriptName);
    if (alreadyAttached) {
        return (0, types_1.successResult)({ nodeUuid, componentName: scriptName, existing: true }, `Script '${scriptName}' already exists on node`);
    }
    const beforeCount = beforeComponents.length;
    const knownTypes = new Set(beforeComponents.map((c) => c.type));
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
            if (!after.success || !((_c = after.data) === null || _c === void 0 ? void 0 : _c.components))
                continue;
            const components = after.data.components;
            const named = components.find((comp) => comp.type === scriptName);
            if (named) {
                return (0, types_1.successResult)({ nodeUuid, componentName: scriptName, existing: false }, `Script '${scriptName}' attached successfully`);
            }
            if (components.length > beforeCount) {
                const newComp = components.find((comp) => !knownTypes.has(comp.type));
                const reportedType = newComp === null || newComp === void 0 ? void 0 : newComp.type;
                return (0, types_1.successResult)({ nodeUuid, componentName: scriptName, componentType: reportedType, existing: false }, `Script '${scriptName}' attached successfully` +
                    (reportedType && reportedType !== scriptName ? ` (reported on node as cid '${reportedType}')` : ''));
            }
        }
        const list = (after.success && ((_d = after.data) === null || _d === void 0 ? void 0 : _d.components))
            ? after.data.components.map((c) => c.type).join(', ')
            : (after.error || 'unable to read node components');
        return (0, types_1.errorResult)(`Script '${scriptName}' was not found on node after addition. Available components: ${list}`);
    }
    catch (err) {
        // Fallback: use scene script
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'attachScript', args: [nodeUuid, scriptPath]
            });
            if (result && result.success) {
                return (0, types_1.successResult)(result.data, result.message);
            }
        }
        catch (_e) {
            // ignore fallback error, fall through
        }
        return {
            success: false,
            error: `Failed to attach script '${scriptName}': ${err.message}`,
            instruction: 'Please ensure the script is properly compiled and exported as a Component class. You can also manually attach the script through the Properties panel in the editor.'
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1zY3JpcHQtYXR0YWNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtc2NyaXB0LWF0dGFjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQVFILGdEQXdGQztBQTlGRCxvQ0FBd0U7QUFFeEU7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLGtCQUFrQixDQUNwQyxRQUFnQixFQUNoQixVQUFrQixFQUNsQixhQUE4RDs7SUFFOUQsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQzNCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtEQUErRCxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFHLE1BQUEsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsMENBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZCxPQUFPLElBQUEsbUJBQVcsRUFBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCw4RUFBOEU7SUFDOUUsNEVBQTRFO0lBQzVFLE1BQU0sTUFBTSxHQUFHLE1BQU0sYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sZ0JBQWdCLEdBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxLQUFJLE1BQUEsTUFBTSxDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUMxRyxNQUFNLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElB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ZV9jb21wb25lbnQgdG9vbC5cbiAqIEV4dHJhY3RlZCBmcm9tIE1hbmFnZUNvbXBvbmVudC5hdHRhY2hTY3JpcHQgdG8ga2VlcCBtYW5hZ2UtY29tcG9uZW50LnRzIHVuZGVyIDIwMCBsaW5lcy5cbiAqL1xuXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuLyoqXG4gKiBBdHRhY2ggYSBUeXBlU2NyaXB0L0phdmFTY3JpcHQgc2NyaXB0IGNvbXBvbmVudCB0byBhIG5vZGUuXG4gKiBAcGFyYW0gZ2V0Q29tcG9uZW50cyAtIGNhbGxiYWNrIHRvIHF1ZXJ5IG5vZGUgY29tcG9uZW50cyAoYXZvaWRzIGNpcmN1bGFyIGRlcCBvbiBNYW5hZ2VDb21wb25lbnQpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhdHRhY2hTY3JpcHRUb05vZGUoXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcbiAgICBzY3JpcHRQYXRoOiBzdHJpbmcsXG4gICAgZ2V0Q29tcG9uZW50czogKG5vZGVVdWlkOiBzdHJpbmcpID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD5cbik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgIGlmICghbm9kZVV1aWQgfHwgIXNjcmlwdFBhdGgpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBhbmQgc2NyaXB0UGF0aCBhcmUgcmVxdWlyZWQgZm9yIGFjdGlvbj1hdHRhY2hfc2NyaXB0Jyk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NyaXB0TmFtZSA9IHNjcmlwdFBhdGguc3BsaXQoJy8nKS5wb3AoKT8ucmVwbGFjZSgnLnRzJywgJycpLnJlcGxhY2UoJy5qcycsICcnKTtcbiAgICBpZiAoIXNjcmlwdE5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdJbnZhbGlkIHNjcmlwdCBwYXRoJyk7XG4gICAgfVxuXG4gICAgLy8gU25hcHNob3QgY29tcG9uZW50cyBCRUZPUkUgYXR0YWNoaW5nLiBUaGlzIGJvdGggZGV0ZWN0cyBhbiBhbHJlYWR5LWF0dGFjaGVkXG4gICAgLy8gc2NyaXB0IGFuZCBnaXZlcyB0aGUgYmFzZWxpbmUgdXNlZCB0byB2ZXJpZnkgdGhlIGFkZGl0aW9uIGJ5IGRlbHRhIGJlbG93LlxuICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IGdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgIGNvbnN0IGJlZm9yZUNvbXBvbmVudHM6IGFueVtdID0gKGJlZm9yZS5zdWNjZXNzICYmIGJlZm9yZS5kYXRhPy5jb21wb25lbnRzKSA/IGJlZm9yZS5kYXRhLmNvbXBvbmVudHMgOiBbXTtcbiAgICBjb25zdCBhbHJlYWR5QXR0YWNoZWQgPSBiZWZvcmVDb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBzY3JpcHROYW1lKTtcbiAgICBpZiAoYWxyZWFkeUF0dGFjaGVkKSB7XG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50TmFtZTogc2NyaXB0TmFtZSwgZXhpc3Rpbmc6IHRydWUgfSxcbiAgICAgICAgICAgIGBTY3JpcHQgJyR7c2NyaXB0TmFtZX0nIGFscmVhZHkgZXhpc3RzIG9uIG5vZGVgXG4gICAgICAgICk7XG4gICAgfVxuICAgIGNvbnN0IGJlZm9yZUNvdW50ID0gYmVmb3JlQ29tcG9uZW50cy5sZW5ndGg7XG4gICAgY29uc3Qga25vd25UeXBlcyA9IG5ldyBTZXQoYmVmb3JlQ29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKSk7XG5cbiAgICAvLyBUcnkgdXNpbmcgdGhlIHNjcmlwdCBuYW1lIGFzIGEgY29tcG9uZW50IHR5cGUgZGlyZWN0bHlcbiAgICB0cnkge1xuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjcmVhdGUtY29tcG9uZW50JywgeyB1dWlkOiBub2RlVXVpZCwgY29tcG9uZW50OiBzY3JpcHROYW1lIH0pO1xuXG4gICAgICAgIC8vIFZlcmlmeSBieSBwb2xsaW5nLiBUd28gcmVhc29ucyBhIHNpbmdsZSBzdHJpY3QgbmFtZSBjaGVjayBnaXZlcyBhIGZhbHNlXG4gICAgICAgIC8vIG5lZ2F0aXZlOiAoMSkgdGhlIGVkaXRvciBtYXkgc3VyZmFjZSB0aGUgbmV3IGNvbXBvbmVudCBhIG1vbWVudCBsYXRlciwgYW5kXG4gICAgICAgIC8vICgyKSBhIHVzZXIgc2NyaXB0J3MgcmVwb3J0ZWQgYHR5cGVgIGlzIGl0cyBjaWQgKGEgY29tcHJlc3NlZCBVVUlEKSwgTk9UIHRoZVxuICAgICAgICAvLyBiYXJlIGNsYXNzIG5hbWUg4oCUIHNvIGFuIGV4YWN0IGB0eXBlID09PSBzY3JpcHROYW1lYCBtYXRjaCBuZXZlciBmaXJlcyBldmVuXG4gICAgICAgIC8vIHRob3VnaCB0aGUgY29tcG9uZW50IElTIHByZXNlbnQuIEFjY2VwdCBlaXRoZXIgYW4gZXhhY3QgbmFtZSBtYXRjaCBPUiBhXG4gICAgICAgIC8vIG5ld2x5LWFwcGVhcmVkIGNvbXBvbmVudCAoZGVsdGEgYWdhaW5zdCB0aGUgcHJlLWF0dGFjaCBzbmFwc2hvdCkuXG4gICAgICAgIGNvbnN0IFZFUklGWV9BVFRFTVBUUyA9IDU7XG4gICAgICAgIGNvbnN0IFZFUklGWV9ERUxBWV9NUyA9IDEwMDtcbiAgICAgICAgbGV0IGFmdGVyID0gYmVmb3JlO1xuICAgICAgICBmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IFZFUklGWV9BVFRFTVBUUzsgYXR0ZW1wdCsrKSB7XG4gICAgICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgVkVSSUZZX0RFTEFZX01TKSk7XG4gICAgICAgICAgICBhZnRlciA9IGF3YWl0IGdldENvbXBvbmVudHMobm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFhZnRlci5zdWNjZXNzIHx8ICFhZnRlci5kYXRhPy5jb21wb25lbnRzKSBjb250aW51ZTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudHM6IGFueVtdID0gYWZ0ZXIuZGF0YS5jb21wb25lbnRzO1xuXG4gICAgICAgICAgICBjb25zdCBuYW1lZCA9IGNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiBjb21wLnR5cGUgPT09IHNjcmlwdE5hbWUpO1xuICAgICAgICAgICAgaWYgKG5hbWVkKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXG4gICAgICAgICAgICAgICAgICAgIHsgbm9kZVV1aWQsIGNvbXBvbmVudE5hbWU6IHNjcmlwdE5hbWUsIGV4aXN0aW5nOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgICBgU2NyaXB0ICcke3NjcmlwdE5hbWV9JyBhdHRhY2hlZCBzdWNjZXNzZnVsbHlgXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjb21wb25lbnRzLmxlbmd0aCA+IGJlZm9yZUNvdW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q29tcCA9IGNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiAha25vd25UeXBlcy5oYXMoY29tcC50eXBlKSk7XG4gICAgICAgICAgICAgICAgY29uc3QgcmVwb3J0ZWRUeXBlID0gbmV3Q29tcD8udHlwZTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50TmFtZTogc2NyaXB0TmFtZSwgY29tcG9uZW50VHlwZTogcmVwb3J0ZWRUeXBlLCBleGlzdGluZzogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgYFNjcmlwdCAnJHtzY3JpcHROYW1lfScgYXR0YWNoZWQgc3VjY2Vzc2Z1bGx5YCArXG4gICAgICAgICAgICAgICAgICAgICAgICAocmVwb3J0ZWRUeXBlICYmIHJlcG9ydGVkVHlwZSAhPT0gc2NyaXB0TmFtZSA/IGAgKHJlcG9ydGVkIG9uIG5vZGUgYXMgY2lkICcke3JlcG9ydGVkVHlwZX0nKWAgOiAnJylcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbGlzdCA9IChhZnRlci5zdWNjZXNzICYmIGFmdGVyLmRhdGE/LmNvbXBvbmVudHMpXG4gICAgICAgICAgICA/IGFmdGVyLmRhdGEuY29tcG9uZW50cy5tYXAoKGM6IGFueSkgPT4gYy50eXBlKS5qb2luKCcsICcpXG4gICAgICAgICAgICA6IChhZnRlci5lcnJvciB8fCAndW5hYmxlIHRvIHJlYWQgbm9kZSBjb21wb25lbnRzJyk7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgU2NyaXB0ICcke3NjcmlwdE5hbWV9JyB3YXMgbm90IGZvdW5kIG9uIG5vZGUgYWZ0ZXIgYWRkaXRpb24uIEF2YWlsYWJsZSBjb21wb25lbnRzOiAke2xpc3R9YCk7XG5cbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAvLyBGYWxsYmFjazogdXNlIHNjZW5lIHNjcmlwdFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2F0dGFjaFNjcmlwdCcsIGFyZ3M6IFtub2RlVXVpZCwgc2NyaXB0UGF0aF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gaWdub3JlIGZhbGxiYWNrIGVycm9yLCBmYWxsIHRocm91Z2hcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBhdHRhY2ggc2NyaXB0ICcke3NjcmlwdE5hbWV9JzogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdQbGVhc2UgZW5zdXJlIHRoZSBzY3JpcHQgaXMgcHJvcGVybHkgY29tcGlsZWQgYW5kIGV4cG9ydGVkIGFzIGEgQ29tcG9uZW50IGNsYXNzLiBZb3UgY2FuIGFsc28gbWFudWFsbHkgYXR0YWNoIHRoZSBzY3JpcHQgdGhyb3VnaCB0aGUgUHJvcGVydGllcyBwYW5lbCBpbiB0aGUgZWRpdG9yLidcbiAgICAgICAgfTtcbiAgICB9XG59XG4iXX0=