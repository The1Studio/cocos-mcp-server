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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1zY3JpcHQtYXR0YWNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtc2NyaXB0LWF0dGFjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQVFILGdEQXdGQztBQTlGRCxvQ0FBd0U7QUFFeEU7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLGtCQUFrQixDQUNwQyxRQUFnQixFQUNoQixVQUFrQixFQUNsQixhQUE4RDs7SUFFOUQsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQzNCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtEQUErRCxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFHLE1BQUEsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsMENBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZCxPQUFPLElBQUEsbUJBQVcsRUFBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCw4RUFBOEU7SUFDOUUsNEVBQTRFO0lBQzVFLE1BQU0sTUFBTSxHQUFHLE1BQU0sYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sZ0JBQWdCLEdBQVUsQ0FBQyxNQUFNLENBQUMsT0FBTyxLQUFJLE1BQUEsTUFBTSxDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUMxRyxNQUFNLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElB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YWdlX2NvbXBvbmVudCB0b29sLlxyXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQuYXR0YWNoU2NyaXB0IHRvIGtlZXAgbWFuYWdlLWNvbXBvbmVudC50cyB1bmRlciAyMDAgbGluZXMuXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogQXR0YWNoIGEgVHlwZVNjcmlwdC9KYXZhU2NyaXB0IHNjcmlwdCBjb21wb25lbnQgdG8gYSBub2RlLlxyXG4gKiBAcGFyYW0gZ2V0Q29tcG9uZW50cyAtIGNhbGxiYWNrIHRvIHF1ZXJ5IG5vZGUgY29tcG9uZW50cyAoYXZvaWRzIGNpcmN1bGFyIGRlcCBvbiBNYW5hZ2VDb21wb25lbnQpXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXR0YWNoU2NyaXB0VG9Ob2RlKFxyXG4gICAgbm9kZVV1aWQ6IHN0cmluZyxcclxuICAgIHNjcmlwdFBhdGg6IHN0cmluZyxcclxuICAgIGdldENvbXBvbmVudHM6IChub2RlVXVpZDogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XHJcbik6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgaWYgKCFub2RlVXVpZCB8fCAhc2NyaXB0UGF0aCkge1xyXG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIHNjcmlwdFBhdGggYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249YXR0YWNoX3NjcmlwdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjcmlwdE5hbWUgPSBzY3JpcHRQYXRoLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy50cycsICcnKS5yZXBsYWNlKCcuanMnLCAnJyk7XHJcbiAgICBpZiAoIXNjcmlwdE5hbWUpIHtcclxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ0ludmFsaWQgc2NyaXB0IHBhdGgnKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTbmFwc2hvdCBjb21wb25lbnRzIEJFRk9SRSBhdHRhY2hpbmcuIFRoaXMgYm90aCBkZXRlY3RzIGFuIGFscmVhZHktYXR0YWNoZWRcclxuICAgIC8vIHNjcmlwdCBhbmQgZ2l2ZXMgdGhlIGJhc2VsaW5lIHVzZWQgdG8gdmVyaWZ5IHRoZSBhZGRpdGlvbiBieSBkZWx0YSBiZWxvdy5cclxuICAgIGNvbnN0IGJlZm9yZSA9IGF3YWl0IGdldENvbXBvbmVudHMobm9kZVV1aWQpO1xyXG4gICAgY29uc3QgYmVmb3JlQ29tcG9uZW50czogYW55W10gPSAoYmVmb3JlLnN1Y2Nlc3MgJiYgYmVmb3JlLmRhdGE/LmNvbXBvbmVudHMpID8gYmVmb3JlLmRhdGEuY29tcG9uZW50cyA6IFtdO1xyXG4gICAgY29uc3QgYWxyZWFkeUF0dGFjaGVkID0gYmVmb3JlQ29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gc2NyaXB0TmFtZSk7XHJcbiAgICBpZiAoYWxyZWFkeUF0dGFjaGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXHJcbiAgICAgICAgICAgIHsgbm9kZVV1aWQsIGNvbXBvbmVudE5hbWU6IHNjcmlwdE5hbWUsIGV4aXN0aW5nOiB0cnVlIH0sXHJcbiAgICAgICAgICAgIGBTY3JpcHQgJyR7c2NyaXB0TmFtZX0nIGFscmVhZHkgZXhpc3RzIG9uIG5vZGVgXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGJlZm9yZUNvdW50ID0gYmVmb3JlQ29tcG9uZW50cy5sZW5ndGg7XHJcbiAgICBjb25zdCBrbm93blR5cGVzID0gbmV3IFNldChiZWZvcmVDb21wb25lbnRzLm1hcCgoYzogYW55KSA9PiBjLnR5cGUpKTtcclxuXHJcbiAgICAvLyBUcnkgdXNpbmcgdGhlIHNjcmlwdCBuYW1lIGFzIGEgY29tcG9uZW50IHR5cGUgZGlyZWN0bHlcclxuICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHsgdXVpZDogbm9kZVV1aWQsIGNvbXBvbmVudDogc2NyaXB0TmFtZSB9KTtcclxuXHJcbiAgICAgICAgLy8gVmVyaWZ5IGJ5IHBvbGxpbmcuIFR3byByZWFzb25zIGEgc2luZ2xlIHN0cmljdCBuYW1lIGNoZWNrIGdpdmVzIGEgZmFsc2VcclxuICAgICAgICAvLyBuZWdhdGl2ZTogKDEpIHRoZSBlZGl0b3IgbWF5IHN1cmZhY2UgdGhlIG5ldyBjb21wb25lbnQgYSBtb21lbnQgbGF0ZXIsIGFuZFxyXG4gICAgICAgIC8vICgyKSBhIHVzZXIgc2NyaXB0J3MgcmVwb3J0ZWQgYHR5cGVgIGlzIGl0cyBjaWQgKGEgY29tcHJlc3NlZCBVVUlEKSwgTk9UIHRoZVxyXG4gICAgICAgIC8vIGJhcmUgY2xhc3MgbmFtZSDigJQgc28gYW4gZXhhY3QgYHR5cGUgPT09IHNjcmlwdE5hbWVgIG1hdGNoIG5ldmVyIGZpcmVzIGV2ZW5cclxuICAgICAgICAvLyB0aG91Z2ggdGhlIGNvbXBvbmVudCBJUyBwcmVzZW50LiBBY2NlcHQgZWl0aGVyIGFuIGV4YWN0IG5hbWUgbWF0Y2ggT1IgYVxyXG4gICAgICAgIC8vIG5ld2x5LWFwcGVhcmVkIGNvbXBvbmVudCAoZGVsdGEgYWdhaW5zdCB0aGUgcHJlLWF0dGFjaCBzbmFwc2hvdCkuXHJcbiAgICAgICAgY29uc3QgVkVSSUZZX0FUVEVNUFRTID0gNTtcclxuICAgICAgICBjb25zdCBWRVJJRllfREVMQVlfTVMgPSAxMDA7XHJcbiAgICAgICAgbGV0IGFmdGVyID0gYmVmb3JlO1xyXG4gICAgICAgIGZvciAobGV0IGF0dGVtcHQgPSAwOyBhdHRlbXB0IDwgVkVSSUZZX0FUVEVNUFRTOyBhdHRlbXB0KyspIHtcclxuICAgICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIFZFUklGWV9ERUxBWV9NUykpO1xyXG4gICAgICAgICAgICBhZnRlciA9IGF3YWl0IGdldENvbXBvbmVudHMobm9kZVV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIWFmdGVyLnN1Y2Nlc3MgfHwgIWFmdGVyLmRhdGE/LmNvbXBvbmVudHMpIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRzOiBhbnlbXSA9IGFmdGVyLmRhdGEuY29tcG9uZW50cztcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVkID0gY29tcG9uZW50cy5maW5kKChjb21wOiBhbnkpID0+IGNvbXAudHlwZSA9PT0gc2NyaXB0TmFtZSk7XHJcbiAgICAgICAgICAgIGlmIChuYW1lZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXHJcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50TmFtZTogc2NyaXB0TmFtZSwgZXhpc3Rpbmc6IGZhbHNlIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgYFNjcmlwdCAnJHtzY3JpcHROYW1lfScgYXR0YWNoZWQgc3VjY2Vzc2Z1bGx5YFxyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoY29tcG9uZW50cy5sZW5ndGggPiBiZWZvcmVDb3VudCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3Q29tcCA9IGNvbXBvbmVudHMuZmluZCgoY29tcDogYW55KSA9PiAha25vd25UeXBlcy5oYXMoY29tcC50eXBlKSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZXBvcnRlZFR5cGUgPSBuZXdDb21wPy50eXBlO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXHJcbiAgICAgICAgICAgICAgICAgICAgeyBub2RlVXVpZCwgY29tcG9uZW50TmFtZTogc2NyaXB0TmFtZSwgY29tcG9uZW50VHlwZTogcmVwb3J0ZWRUeXBlLCBleGlzdGluZzogZmFsc2UgfSxcclxuICAgICAgICAgICAgICAgICAgICBgU2NyaXB0ICcke3NjcmlwdE5hbWV9JyBhdHRhY2hlZCBzdWNjZXNzZnVsbHlgICtcclxuICAgICAgICAgICAgICAgICAgICAgICAgKHJlcG9ydGVkVHlwZSAmJiByZXBvcnRlZFR5cGUgIT09IHNjcmlwdE5hbWUgPyBgIChyZXBvcnRlZCBvbiBub2RlIGFzIGNpZCAnJHtyZXBvcnRlZFR5cGV9JylgIDogJycpXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBsaXN0ID0gKGFmdGVyLnN1Y2Nlc3MgJiYgYWZ0ZXIuZGF0YT8uY29tcG9uZW50cylcclxuICAgICAgICAgICAgPyBhZnRlci5kYXRhLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKVxyXG4gICAgICAgICAgICA6IChhZnRlci5lcnJvciB8fCAndW5hYmxlIHRvIHJlYWQgbm9kZSBjb21wb25lbnRzJyk7XHJcbiAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBTY3JpcHQgJyR7c2NyaXB0TmFtZX0nIHdhcyBub3QgZm91bmQgb24gbm9kZSBhZnRlciBhZGRpdGlvbi4gQXZhaWxhYmxlIGNvbXBvbmVudHM6ICR7bGlzdH1gKTtcclxuXHJcbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgIC8vIEZhbGxiYWNrOiB1c2Ugc2NlbmUgc2NyaXB0XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnYXR0YWNoU2NyaXB0JywgYXJnczogW25vZGVVdWlkLCBzY3JpcHRQYXRoXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQocmVzdWx0LmRhdGEsIHJlc3VsdC5tZXNzYWdlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAvLyBpZ25vcmUgZmFsbGJhY2sgZXJyb3IsIGZhbGwgdGhyb3VnaFxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgZXJyb3I6IGBGYWlsZWQgdG8gYXR0YWNoIHNjcmlwdCAnJHtzY3JpcHROYW1lfSc6ICR7ZXJyLm1lc3NhZ2V9YCxcclxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdQbGVhc2UgZW5zdXJlIHRoZSBzY3JpcHQgaXMgcHJvcGVybHkgY29tcGlsZWQgYW5kIGV4cG9ydGVkIGFzIGEgQ29tcG9uZW50IGNsYXNzLiBZb3UgY2FuIGFsc28gbWFudWFsbHkgYXR0YWNoIHRoZSBzY3JpcHQgdGhyb3VnaCB0aGUgUHJvcGVydGllcyBwYW5lbCBpbiB0aGUgZWRpdG9yLidcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG59XHJcbiJdfQ==