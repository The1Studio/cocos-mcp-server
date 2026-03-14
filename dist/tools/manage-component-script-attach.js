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
    var _a, _b, _c;
    if (!nodeUuid || !scriptPath) {
        return (0, types_1.errorResult)('nodeUuid and scriptPath are required for action=attach_script');
    }
    const scriptName = (_a = scriptPath.split('/').pop()) === null || _a === void 0 ? void 0 : _a.replace('.ts', '').replace('.js', '');
    if (!scriptName) {
        return (0, types_1.errorResult)('Invalid script path');
    }
    // Check if the script component already exists
    const existing = await getComponents(nodeUuid);
    if (existing.success && ((_b = existing.data) === null || _b === void 0 ? void 0 : _b.components)) {
        const found = existing.data.components.find((comp) => comp.type === scriptName);
        if (found) {
            return (0, types_1.successResult)({ nodeUuid, componentName: scriptName, existing: true }, `Script '${scriptName}' already exists on node`);
        }
    }
    // Try using the script name as a component type directly
    try {
        await Editor.Message.request('scene', 'create-component', { uuid: nodeUuid, component: scriptName });
        await new Promise(r => setTimeout(r, 100));
        const after = await getComponents(nodeUuid);
        if (after.success && ((_c = after.data) === null || _c === void 0 ? void 0 : _c.components)) {
            const added = after.data.components.find((comp) => comp.type === scriptName);
            if (added) {
                return (0, types_1.successResult)({ nodeUuid, componentName: scriptName, existing: false }, `Script '${scriptName}' attached successfully`);
            }
            return (0, types_1.errorResult)(`Script '${scriptName}' was not found on node after addition. Available components: ${after.data.components.map((c) => c.type).join(', ')}`);
        }
        return (0, types_1.errorResult)(`Failed to verify script addition: ${after.error || 'Unable to get node components'}`);
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
        catch (_d) {
            // ignore fallback error, fall through
        }
        return {
            success: false,
            error: `Failed to attach script '${scriptName}': ${err.message}`,
            instruction: 'Please ensure the script is properly compiled and exported as a Component class. You can also manually attach the script through the Properties panel in the editor.'
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWNvbXBvbmVudC1zY3JpcHQtYXR0YWNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1jb21wb25lbnQtc2NyaXB0LWF0dGFjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOztBQVFILGdEQThEQztBQXBFRCxvQ0FBd0U7QUFFeEU7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLGtCQUFrQixDQUNwQyxRQUFnQixFQUNoQixVQUFrQixFQUNsQixhQUE4RDs7SUFFOUQsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQzNCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLCtEQUErRCxDQUFDLENBQUM7SUFDeEYsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFHLE1BQUEsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsMENBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN0RixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDZCxPQUFPLElBQUEsbUJBQVcsRUFBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRCwrQ0FBK0M7SUFDL0MsTUFBTSxRQUFRLEdBQUcsTUFBTSxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDL0MsSUFBSSxRQUFRLENBQUMsT0FBTyxLQUFJLE1BQUEsUUFBUSxDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLEVBQUUsQ0FBQztRQUNoRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUM7UUFDckYsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNSLE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsRUFDdkQsV0FBVyxVQUFVLDBCQUEwQixDQUNsRCxDQUFDO1FBQ04sQ0FBQztJQUNMLENBQUM7SUFFRCx5REFBeUQ7SUFDekQsSUFBSSxDQUFDO1FBQ0QsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQ3JHLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFFM0MsTUFBTSxLQUFLLEdBQUcsTUFBTSxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUMsSUFBSSxLQUFLLENBQUMsT0FBTyxLQUFJLE1BQUEsS0FBSyxDQUFDLElBQUksMENBQUUsVUFBVSxDQUFBLEVBQUUsQ0FBQztZQUMxQyxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUM7WUFDbEYsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDUixPQUFPLElBQUEscUJBQWEsRUFDaEIsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLFVBQVUsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEVBQ3hELFdBQVcsVUFBVSx5QkFBeUIsQ0FDakQsQ0FBQztZQUNOLENBQUM7WUFDRCxPQUFPLElBQUEsbUJBQVcsRUFBQyxXQUFXLFVBQVUsaUVBQWlFLEtBQUssQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDekssQ0FBQztRQUNELE9BQU8sSUFBQSxtQkFBVyxFQUFDLHFDQUFxQyxLQUFLLENBQUMsS0FBSyxJQUFJLCtCQUErQixFQUFFLENBQUMsQ0FBQztJQUU5RyxDQUFDO0lBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztRQUNoQiw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQVEsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUU7Z0JBQzlFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsY0FBYyxFQUFFLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUM7YUFDakYsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUMzQixPQUFPLElBQUEscUJBQWEsRUFBQyxNQUFNLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN0RCxDQUFDO1FBQ0wsQ0FBQztRQUFDLFdBQU0sQ0FBQztZQUNMLHNDQUFzQztRQUMxQyxDQUFDO1FBQ0QsT0FBTztZQUNILE9BQU8sRUFBRSxLQUFLO1lBQ2QsS0FBSyxFQUFFLDRCQUE0QixVQUFVLE1BQU0sR0FBRyxDQUFDLE9BQU8sRUFBRTtZQUNoRSxXQUFXLEVBQUUsc0tBQXNLO1NBQ3RMLENBQUM7SUFDTixDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2NyaXB0IGF0dGFjaG1lbnQgbG9naWMgZm9yIHRoZSBtYW5hZ2VfY29tcG9uZW50IHRvb2wuXG4gKiBFeHRyYWN0ZWQgZnJvbSBNYW5hZ2VDb21wb25lbnQuYXR0YWNoU2NyaXB0IHRvIGtlZXAgbWFuYWdlLWNvbXBvbmVudC50cyB1bmRlciAyMDAgbGluZXMuXG4gKi9cblxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbi8qKlxuICogQXR0YWNoIGEgVHlwZVNjcmlwdC9KYXZhU2NyaXB0IHNjcmlwdCBjb21wb25lbnQgdG8gYSBub2RlLlxuICogQHBhcmFtIGdldENvbXBvbmVudHMgLSBjYWxsYmFjayB0byBxdWVyeSBub2RlIGNvbXBvbmVudHMgKGF2b2lkcyBjaXJjdWxhciBkZXAgb24gTWFuYWdlQ29tcG9uZW50KVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXR0YWNoU2NyaXB0VG9Ob2RlKFxuICAgIG5vZGVVdWlkOiBzdHJpbmcsXG4gICAgc2NyaXB0UGF0aDogc3RyaW5nLFxuICAgIGdldENvbXBvbmVudHM6IChub2RlVXVpZDogc3RyaW5nKSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+XG4pOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICBpZiAoIW5vZGVVdWlkIHx8ICFzY3JpcHRQYXRoKSB7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgYW5kIHNjcmlwdFBhdGggYXJlIHJlcXVpcmVkIGZvciBhY3Rpb249YXR0YWNoX3NjcmlwdCcpO1xuICAgIH1cblxuICAgIGNvbnN0IHNjcmlwdE5hbWUgPSBzY3JpcHRQYXRoLnNwbGl0KCcvJykucG9wKCk/LnJlcGxhY2UoJy50cycsICcnKS5yZXBsYWNlKCcuanMnLCAnJyk7XG4gICAgaWYgKCFzY3JpcHROYW1lKSB7XG4gICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnSW52YWxpZCBzY3JpcHQgcGF0aCcpO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIHRoZSBzY3JpcHQgY29tcG9uZW50IGFscmVhZHkgZXhpc3RzXG4gICAgY29uc3QgZXhpc3RpbmcgPSBhd2FpdCBnZXRDb21wb25lbnRzKG5vZGVVdWlkKTtcbiAgICBpZiAoZXhpc3Rpbmcuc3VjY2VzcyAmJiBleGlzdGluZy5kYXRhPy5jb21wb25lbnRzKSB7XG4gICAgICAgIGNvbnN0IGZvdW5kID0gZXhpc3RpbmcuZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBzY3JpcHROYW1lKTtcbiAgICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnROYW1lOiBzY3JpcHROYW1lLCBleGlzdGluZzogdHJ1ZSB9LFxuICAgICAgICAgICAgICAgIGBTY3JpcHQgJyR7c2NyaXB0TmFtZX0nIGFscmVhZHkgZXhpc3RzIG9uIG5vZGVgXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gVHJ5IHVzaW5nIHRoZSBzY3JpcHQgbmFtZSBhcyBhIGNvbXBvbmVudCB0eXBlIGRpcmVjdGx5XG4gICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLWNvbXBvbmVudCcsIHsgdXVpZDogbm9kZVV1aWQsIGNvbXBvbmVudDogc2NyaXB0TmFtZSB9KTtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xuXG4gICAgICAgIGNvbnN0IGFmdGVyID0gYXdhaXQgZ2V0Q29tcG9uZW50cyhub2RlVXVpZCk7XG4gICAgICAgIGlmIChhZnRlci5zdWNjZXNzICYmIGFmdGVyLmRhdGE/LmNvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGFkZGVkID0gYWZ0ZXIuZGF0YS5jb21wb25lbnRzLmZpbmQoKGNvbXA6IGFueSkgPT4gY29tcC50eXBlID09PSBzY3JpcHROYW1lKTtcbiAgICAgICAgICAgIGlmIChhZGRlZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgICAgICB7IG5vZGVVdWlkLCBjb21wb25lbnROYW1lOiBzY3JpcHROYW1lLCBleGlzdGluZzogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgICAgYFNjcmlwdCAnJHtzY3JpcHROYW1lfScgYXR0YWNoZWQgc3VjY2Vzc2Z1bGx5YFxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYFNjcmlwdCAnJHtzY3JpcHROYW1lfScgd2FzIG5vdCBmb3VuZCBvbiBub2RlIGFmdGVyIGFkZGl0aW9uLiBBdmFpbGFibGUgY29tcG9uZW50czogJHthZnRlci5kYXRhLmNvbXBvbmVudHMubWFwKChjOiBhbnkpID0+IGMudHlwZSkuam9pbignLCAnKX1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byB2ZXJpZnkgc2NyaXB0IGFkZGl0aW9uOiAke2FmdGVyLmVycm9yIHx8ICdVbmFibGUgdG8gZ2V0IG5vZGUgY29tcG9uZW50cyd9YCk7XG5cbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAvLyBGYWxsYmFjazogdXNlIHNjZW5lIHNjcmlwdFxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2F0dGFjaFNjcmlwdCcsIGFyZ3M6IFtub2RlVXVpZCwgc2NyaXB0UGF0aF1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHJlc3VsdC5kYXRhLCByZXN1bHQubWVzc2FnZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLy8gaWdub3JlIGZhbGxiYWNrIGVycm9yLCBmYWxsIHRocm91Z2hcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICBlcnJvcjogYEZhaWxlZCB0byBhdHRhY2ggc2NyaXB0ICcke3NjcmlwdE5hbWV9JzogJHtlcnIubWVzc2FnZX1gLFxuICAgICAgICAgICAgaW5zdHJ1Y3Rpb246ICdQbGVhc2UgZW5zdXJlIHRoZSBzY3JpcHQgaXMgcHJvcGVybHkgY29tcGlsZWQgYW5kIGV4cG9ydGVkIGFzIGEgQ29tcG9uZW50IGNsYXNzLiBZb3UgY2FuIGFsc28gbWFudWFsbHkgYXR0YWNoIHRoZSBzY3JpcHQgdGhyb3VnaCB0aGUgUHJvcGVydGllcyBwYW5lbCBpbiB0aGUgZWRpdG9yLidcbiAgICAgICAgfTtcbiAgICB9XG59XG4iXX0=