"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteMenuItem = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const KNOWN_MENU_CATEGORIES = [
    'Cocos Creator', 'File', 'Edit', 'Node', 'Component',
    'Project', 'Panel', 'Extension', 'Developer', 'Help'
];
// Known Cocos Creator menu structure. Shared by `search` and by the `execute` pre-check —
// the editor exposes no API to query a menu path, so this list is the only thing that can
// tell a real menu item from a typo. Not exhaustive: see `executeMenuItem` for how a
// category with no items listed here is handled.
const KNOWN_MENU_ITEMS = [
    'File/New Scene', 'File/Open Scene', 'File/Save Scene', 'File/Save Scene As',
    'Edit/Undo', 'Edit/Redo', 'Edit/Cut', 'Edit/Copy', 'Edit/Paste', 'Edit/Select All',
    'Node/Create Empty Node', 'Node/Create Empty Node (3D)', 'Node/Create Render Nodes/Sprite',
    'Node/Create Render Nodes/Label', 'Node/Create Render Nodes/Canvas',
    'Node/Create Light Nodes/Directional Light', 'Node/Create Light Nodes/Point Light',
    'Project/Build...', 'Project/Generate Native Code', 'Project/Project Settings...',
    'Panel/Assets', 'Panel/Console', 'Panel/Inspector', 'Panel/Node Tree', 'Panel/Scene',
    'Extension/Extension Manager...', 'Developer/Reload', 'Developer/Developer Tools',
    'Help/User Manual', 'Help/Forum', 'Help/Release Notes'
];
class ExecuteMenuItem extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'execute_menu_item';
        this.description = 'Execute or query Cocos Creator editor menu items. Actions: execute, list, search. Trigger menu commands by path (e.g. "Project/Build...").';
        this.actions = ['execute', 'list', 'search'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['execute', 'list', 'search'],
                    description: 'Action: execute=run a menu item by path, list=list top-level menu categories, search=search menu items by keyword'
                },
                menuPath: {
                    type: 'string',
                    description: '[execute] Full menu path using "/" separator (e.g. "Project/Build...", "Edit/Undo", "Node/Create Empty Node")'
                },
                keyword: {
                    type: 'string',
                    description: '[search] Keyword to search menu items by name'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            execute: (args) => this.executeMenuItem(args),
            list: (args) => this.listMenuCategories(args),
            search: (args) => this.searchMenuItems(args),
        };
    }
    async executeMenuItem(args) {
        if (!args.menuPath)
            return (0, types_1.errorResult)('menuPath is required for execute');
        // The editor exposes no API to query a menu path, and `Editor.Message.send` is
        // fire-and-forget — a typo'd path resolves nothing and never rejects, so an
        // unchecked call reports success while the editor does nothing. Reject a path
        // that is neither a known item nor under a known top-level category before sending.
        const menuPath = String(args.menuPath);
        const category = menuPath.split('/')[0];
        if (!KNOWN_MENU_ITEMS.includes(menuPath) && !KNOWN_MENU_CATEGORIES.includes(category)) {
            return (0, types_1.errorResult)(`Unknown menu path '${menuPath}' — no such top-level category '${category}'. ` +
                `Known categories: ${KNOWN_MENU_CATEGORIES.join(', ')}. ` +
                `Use action 'search' to find a valid menu path.`);
        }
        try {
            // Try Editor.Message.send to trigger menu click
            Editor.Message.send('menu', 'click', args.menuPath);
            return (0, types_1.successResult)({ menuPath: args.menuPath }, `Menu item '${args.menuPath}' executed`);
        }
        catch (err) {
            // Fallback: try Editor.Menu if available
            try {
                const menu = Editor.Menu;
                if (menu && typeof menu.click === 'function') {
                    await menu.click(args.menuPath);
                    return (0, types_1.successResult)({ menuPath: args.menuPath }, `Menu item '${args.menuPath}' executed via Editor.Menu`);
                }
            }
            catch ( /* ignore fallback errors */_a) { /* ignore fallback errors */ }
            return (0, types_1.errorResult)(`Failed to execute menu item '${args.menuPath}': ${err.message}`);
        }
    }
    async listMenuCategories(_args) {
        try {
            // Try to get menu list from Editor.Menu API
            const menu = Editor.Menu;
            if (menu && typeof menu.getMenu === 'function') {
                const items = await menu.getMenu();
                if (items) {
                    return (0, types_1.successResult)({ categories: items });
                }
            }
        }
        catch ( /* fall through to defaults */_a) { /* fall through to defaults */ }
        // Return known Cocos Creator menu categories as fallback
        return (0, types_1.successResult)({
            categories: KNOWN_MENU_CATEGORIES,
            note: 'Returned default categories — Editor.Menu.getMenu() not available in this version'
        });
    }
    async searchMenuItems(args) {
        if (!args.keyword)
            return (0, types_1.errorResult)('keyword is required for search');
        const keyword = args.keyword.toLowerCase();
        // Build searchable menu item list from known Cocos Creator menu structure
        const matches = KNOWN_MENU_ITEMS.filter(item => item.toLowerCase().includes(keyword));
        return (0, types_1.successResult)({
            keyword: args.keyword,
            matches,
            count: matches.length,
            note: 'Results from known menu items list — not exhaustive'
        });
    }
}
exports.ExecuteMenuItem = ExecuteMenuItem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZS1tZW51LWl0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvZXhlY3V0ZS1tZW51LWl0ZW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFNLHFCQUFxQixHQUFHO0lBQzFCLGVBQWUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXO0lBQ3BELFNBQVMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNO0NBQ3ZELENBQUM7QUFFRiwwRkFBMEY7QUFDMUYsMEZBQTBGO0FBQzFGLHFGQUFxRjtBQUNyRixpREFBaUQ7QUFDakQsTUFBTSxnQkFBZ0IsR0FBRztJQUNyQixnQkFBZ0IsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxvQkFBb0I7SUFDNUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxpQkFBaUI7SUFDbEYsd0JBQXdCLEVBQUUsNkJBQTZCLEVBQUUsaUNBQWlDO0lBQzFGLGdDQUFnQyxFQUFFLGlDQUFpQztJQUNuRSwyQ0FBMkMsRUFBRSxxQ0FBcUM7SUFDbEYsa0JBQWtCLEVBQUUsOEJBQThCLEVBQUUsNkJBQTZCO0lBQ2pGLGNBQWMsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsYUFBYTtJQUNwRixnQ0FBZ0MsRUFBRSxrQkFBa0IsRUFBRSwyQkFBMkI7SUFDakYsa0JBQWtCLEVBQUUsWUFBWSxFQUFFLG9CQUFvQjtDQUN6RCxDQUFDO0FBRUYsTUFBYSxlQUFnQixTQUFRLGlDQUFjO0lBQW5EOztRQUNhLFNBQUksR0FBRyxtQkFBbUIsQ0FBQztRQUMzQixnQkFBVyxHQUFHLDRJQUE0SSxDQUFDO1FBQzNKLFlBQU8sR0FBRyxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDeEMsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUM7b0JBQ25DLFdBQVcsRUFBRSxtSEFBbUg7aUJBQ25JO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsK0dBQStHO2lCQUMvSDtnQkFDRCxPQUFPLEVBQUU7b0JBQ0wsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLCtDQUErQztpQkFDL0Q7YUFDSjtZQUNELFFBQVEsRUFBRSxDQUFDLFFBQVEsQ0FBQztTQUN2QixDQUFDO1FBRVEsbUJBQWMsR0FBNkU7WUFDakcsT0FBTyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQztZQUM3QyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7WUFDN0MsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQztTQUMvQyxDQUFDO0lBc0VOLENBQUM7SUFwRVcsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFTO1FBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLGtDQUFrQyxDQUFDLENBQUM7UUFDM0UsK0VBQStFO1FBQy9FLDRFQUE0RTtRQUM1RSw4RUFBOEU7UUFDOUUsb0ZBQW9GO1FBQ3BGLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDcEYsT0FBTyxJQUFBLG1CQUFXLEVBQ2Qsc0JBQXNCLFFBQVEsbUNBQW1DLFFBQVEsS0FBSztnQkFDOUUscUJBQXFCLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSTtnQkFDekQsZ0RBQWdELENBQ25ELENBQUM7UUFDTixDQUFDO1FBQ0QsSUFBSSxDQUFDO1lBQ0QsZ0RBQWdEO1lBQ2hELE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3BELE9BQU8sSUFBQSxxQkFBYSxFQUNoQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQzNCLGNBQWMsSUFBSSxDQUFDLFFBQVEsWUFBWSxDQUMxQyxDQUFDO1FBQ04sQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFDaEIseUNBQXlDO1lBQ3pDLElBQUksQ0FBQztnQkFDRCxNQUFNLElBQUksR0FBSSxNQUFjLENBQUMsSUFBSSxDQUFDO2dCQUNsQyxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssVUFBVSxFQUFFLENBQUM7b0JBQzNDLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBQ2hDLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxjQUFjLElBQUksQ0FBQyxRQUFRLDRCQUE0QixDQUFDLENBQUM7Z0JBQy9HLENBQUM7WUFDTCxDQUFDO1lBQUMsUUFBUSw0QkFBNEIsSUFBOUIsQ0FBQyxDQUFDLDRCQUE0QixDQUFDLENBQUM7WUFDeEMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsZ0NBQWdDLElBQUksQ0FBQyxRQUFRLE1BQU0sR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7UUFDekYsQ0FBQztJQUNMLENBQUM7SUFFTyxLQUFLLENBQUMsa0JBQWtCLENBQUMsS0FBVTtRQUN2QyxJQUFJLENBQUM7WUFDRCw0Q0FBNEM7WUFDNUMsTUFBTSxJQUFJLEdBQUksTUFBYyxDQUFDLElBQUksQ0FBQztZQUNsQyxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQzdDLE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNuQyxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNSLE9BQU8sSUFBQSxxQkFBYSxFQUFDLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7Z0JBQ2hELENBQUM7WUFDTCxDQUFDO1FBQ0wsQ0FBQztRQUFDLFFBQVEsOEJBQThCLElBQWhDLENBQUMsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBRTFDLHlEQUF5RDtRQUN6RCxPQUFPLElBQUEscUJBQWEsRUFBQztZQUNqQixVQUFVLEVBQUUscUJBQXFCO1lBQ2pDLElBQUksRUFBRSxtRkFBbUY7U0FDNUYsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBUztRQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxnQ0FBZ0MsQ0FBQyxDQUFDO1FBQ3hFLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFM0MsMEVBQTBFO1FBQzFFLE1BQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUV0RixPQUFPLElBQUEscUJBQWEsRUFBQztZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsT0FBTztZQUNQLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTTtZQUNyQixJQUFJLEVBQUUscURBQXFEO1NBQzlELENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQWxHRCwwQ0FrR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuY29uc3QgS05PV05fTUVOVV9DQVRFR09SSUVTID0gW1xuICAgICdDb2NvcyBDcmVhdG9yJywgJ0ZpbGUnLCAnRWRpdCcsICdOb2RlJywgJ0NvbXBvbmVudCcsXG4gICAgJ1Byb2plY3QnLCAnUGFuZWwnLCAnRXh0ZW5zaW9uJywgJ0RldmVsb3BlcicsICdIZWxwJ1xuXTtcblxuLy8gS25vd24gQ29jb3MgQ3JlYXRvciBtZW51IHN0cnVjdHVyZS4gU2hhcmVkIGJ5IGBzZWFyY2hgIGFuZCBieSB0aGUgYGV4ZWN1dGVgIHByZS1jaGVjayDigJRcbi8vIHRoZSBlZGl0b3IgZXhwb3NlcyBubyBBUEkgdG8gcXVlcnkgYSBtZW51IHBhdGgsIHNvIHRoaXMgbGlzdCBpcyB0aGUgb25seSB0aGluZyB0aGF0IGNhblxuLy8gdGVsbCBhIHJlYWwgbWVudSBpdGVtIGZyb20gYSB0eXBvLiBOb3QgZXhoYXVzdGl2ZTogc2VlIGBleGVjdXRlTWVudUl0ZW1gIGZvciBob3cgYVxuLy8gY2F0ZWdvcnkgd2l0aCBubyBpdGVtcyBsaXN0ZWQgaGVyZSBpcyBoYW5kbGVkLlxuY29uc3QgS05PV05fTUVOVV9JVEVNUyA9IFtcbiAgICAnRmlsZS9OZXcgU2NlbmUnLCAnRmlsZS9PcGVuIFNjZW5lJywgJ0ZpbGUvU2F2ZSBTY2VuZScsICdGaWxlL1NhdmUgU2NlbmUgQXMnLFxuICAgICdFZGl0L1VuZG8nLCAnRWRpdC9SZWRvJywgJ0VkaXQvQ3V0JywgJ0VkaXQvQ29weScsICdFZGl0L1Bhc3RlJywgJ0VkaXQvU2VsZWN0IEFsbCcsXG4gICAgJ05vZGUvQ3JlYXRlIEVtcHR5IE5vZGUnLCAnTm9kZS9DcmVhdGUgRW1wdHkgTm9kZSAoM0QpJywgJ05vZGUvQ3JlYXRlIFJlbmRlciBOb2Rlcy9TcHJpdGUnLFxuICAgICdOb2RlL0NyZWF0ZSBSZW5kZXIgTm9kZXMvTGFiZWwnLCAnTm9kZS9DcmVhdGUgUmVuZGVyIE5vZGVzL0NhbnZhcycsXG4gICAgJ05vZGUvQ3JlYXRlIExpZ2h0IE5vZGVzL0RpcmVjdGlvbmFsIExpZ2h0JywgJ05vZGUvQ3JlYXRlIExpZ2h0IE5vZGVzL1BvaW50IExpZ2h0JyxcbiAgICAnUHJvamVjdC9CdWlsZC4uLicsICdQcm9qZWN0L0dlbmVyYXRlIE5hdGl2ZSBDb2RlJywgJ1Byb2plY3QvUHJvamVjdCBTZXR0aW5ncy4uLicsXG4gICAgJ1BhbmVsL0Fzc2V0cycsICdQYW5lbC9Db25zb2xlJywgJ1BhbmVsL0luc3BlY3RvcicsICdQYW5lbC9Ob2RlIFRyZWUnLCAnUGFuZWwvU2NlbmUnLFxuICAgICdFeHRlbnNpb24vRXh0ZW5zaW9uIE1hbmFnZXIuLi4nLCAnRGV2ZWxvcGVyL1JlbG9hZCcsICdEZXZlbG9wZXIvRGV2ZWxvcGVyIFRvb2xzJyxcbiAgICAnSGVscC9Vc2VyIE1hbnVhbCcsICdIZWxwL0ZvcnVtJywgJ0hlbHAvUmVsZWFzZSBOb3Rlcydcbl07XG5cbmV4cG9ydCBjbGFzcyBFeGVjdXRlTWVudUl0ZW0gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XG4gICAgcmVhZG9ubHkgbmFtZSA9ICdleGVjdXRlX21lbnVfaXRlbSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnRXhlY3V0ZSBvciBxdWVyeSBDb2NvcyBDcmVhdG9yIGVkaXRvciBtZW51IGl0ZW1zLiBBY3Rpb25zOiBleGVjdXRlLCBsaXN0LCBzZWFyY2guIFRyaWdnZXIgbWVudSBjb21tYW5kcyBieSBwYXRoIChlLmcuIFwiUHJvamVjdC9CdWlsZC4uLlwiKS4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2V4ZWN1dGUnLCAnbGlzdCcsICdzZWFyY2gnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZXhlY3V0ZScsICdsaXN0JywgJ3NlYXJjaCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uOiBleGVjdXRlPXJ1biBhIG1lbnUgaXRlbSBieSBwYXRoLCBsaXN0PWxpc3QgdG9wLWxldmVsIG1lbnUgY2F0ZWdvcmllcywgc2VhcmNoPXNlYXJjaCBtZW51IGl0ZW1zIGJ5IGtleXdvcmQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbWVudVBhdGg6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tleGVjdXRlXSBGdWxsIG1lbnUgcGF0aCB1c2luZyBcIi9cIiBzZXBhcmF0b3IgKGUuZy4gXCJQcm9qZWN0L0J1aWxkLi4uXCIsIFwiRWRpdC9VbmRvXCIsIFwiTm9kZS9DcmVhdGUgRW1wdHkgTm9kZVwiKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBrZXl3b3JkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2VhcmNoXSBLZXl3b3JkIHRvIHNlYXJjaCBtZW51IGl0ZW1zIGJ5IG5hbWUnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBleGVjdXRlOiAoYXJncykgPT4gdGhpcy5leGVjdXRlTWVudUl0ZW0oYXJncyksXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmxpc3RNZW51Q2F0ZWdvcmllcyhhcmdzKSxcbiAgICAgICAgc2VhcmNoOiAoYXJncykgPT4gdGhpcy5zZWFyY2hNZW51SXRlbXMoYXJncyksXG4gICAgfTtcblxuICAgIHByaXZhdGUgYXN5bmMgZXhlY3V0ZU1lbnVJdGVtKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3MubWVudVBhdGgpIHJldHVybiBlcnJvclJlc3VsdCgnbWVudVBhdGggaXMgcmVxdWlyZWQgZm9yIGV4ZWN1dGUnKTtcbiAgICAgICAgLy8gVGhlIGVkaXRvciBleHBvc2VzIG5vIEFQSSB0byBxdWVyeSBhIG1lbnUgcGF0aCwgYW5kIGBFZGl0b3IuTWVzc2FnZS5zZW5kYCBpc1xuICAgICAgICAvLyBmaXJlLWFuZC1mb3JnZXQg4oCUIGEgdHlwbydkIHBhdGggcmVzb2x2ZXMgbm90aGluZyBhbmQgbmV2ZXIgcmVqZWN0cywgc28gYW5cbiAgICAgICAgLy8gdW5jaGVja2VkIGNhbGwgcmVwb3J0cyBzdWNjZXNzIHdoaWxlIHRoZSBlZGl0b3IgZG9lcyBub3RoaW5nLiBSZWplY3QgYSBwYXRoXG4gICAgICAgIC8vIHRoYXQgaXMgbmVpdGhlciBhIGtub3duIGl0ZW0gbm9yIHVuZGVyIGEga25vd24gdG9wLWxldmVsIGNhdGVnb3J5IGJlZm9yZSBzZW5kaW5nLlxuICAgICAgICBjb25zdCBtZW51UGF0aCA9IFN0cmluZyhhcmdzLm1lbnVQYXRoKTtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBtZW51UGF0aC5zcGxpdCgnLycpWzBdO1xuICAgICAgICBpZiAoIUtOT1dOX01FTlVfSVRFTVMuaW5jbHVkZXMobWVudVBhdGgpICYmICFLTk9XTl9NRU5VX0NBVEVHT1JJRVMuaW5jbHVkZXMoY2F0ZWdvcnkpKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoXG4gICAgICAgICAgICAgICAgYFVua25vd24gbWVudSBwYXRoICcke21lbnVQYXRofScg4oCUIG5vIHN1Y2ggdG9wLWxldmVsIGNhdGVnb3J5ICcke2NhdGVnb3J5fScuIGAgK1xuICAgICAgICAgICAgICAgIGBLbm93biBjYXRlZ29yaWVzOiAke0tOT1dOX01FTlVfQ0FURUdPUklFUy5qb2luKCcsICcpfS4gYCArXG4gICAgICAgICAgICAgICAgYFVzZSBhY3Rpb24gJ3NlYXJjaCcgdG8gZmluZCBhIHZhbGlkIG1lbnUgcGF0aC5gXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBUcnkgRWRpdG9yLk1lc3NhZ2Uuc2VuZCB0byB0cmlnZ2VyIG1lbnUgY2xpY2tcbiAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLnNlbmQoJ21lbnUnLCAnY2xpY2snLCBhcmdzLm1lbnVQYXRoKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgIHsgbWVudVBhdGg6IGFyZ3MubWVudVBhdGggfSxcbiAgICAgICAgICAgICAgICBgTWVudSBpdGVtICcke2FyZ3MubWVudVBhdGh9JyBleGVjdXRlZGBcbiAgICAgICAgICAgICk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICAvLyBGYWxsYmFjazogdHJ5IEVkaXRvci5NZW51IGlmIGF2YWlsYWJsZVxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZW51ID0gKEVkaXRvciBhcyBhbnkpLk1lbnU7XG4gICAgICAgICAgICAgICAgaWYgKG1lbnUgJiYgdHlwZW9mIG1lbnUuY2xpY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgbWVudS5jbGljayhhcmdzLm1lbnVQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBtZW51UGF0aDogYXJncy5tZW51UGF0aCB9LCBgTWVudSBpdGVtICcke2FyZ3MubWVudVBhdGh9JyBleGVjdXRlZCB2aWEgRWRpdG9yLk1lbnVgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGNhdGNoIHsgLyogaWdub3JlIGZhbGxiYWNrIGVycm9ycyAqLyB9XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoYEZhaWxlZCB0byBleGVjdXRlIG1lbnUgaXRlbSAnJHthcmdzLm1lbnVQYXRofSc6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxpc3RNZW51Q2F0ZWdvcmllcyhfYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBUcnkgdG8gZ2V0IG1lbnUgbGlzdCBmcm9tIEVkaXRvci5NZW51IEFQSVxuICAgICAgICAgICAgY29uc3QgbWVudSA9IChFZGl0b3IgYXMgYW55KS5NZW51O1xuICAgICAgICAgICAgaWYgKG1lbnUgJiYgdHlwZW9mIG1lbnUuZ2V0TWVudSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1zID0gYXdhaXQgbWVudS5nZXRNZW51KCk7XG4gICAgICAgICAgICAgICAgaWYgKGl0ZW1zKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY2F0ZWdvcmllczogaXRlbXMgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGNhdGNoIHsgLyogZmFsbCB0aHJvdWdoIHRvIGRlZmF1bHRzICovIH1cblxuICAgICAgICAvLyBSZXR1cm4ga25vd24gQ29jb3MgQ3JlYXRvciBtZW51IGNhdGVnb3JpZXMgYXMgZmFsbGJhY2tcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgY2F0ZWdvcmllczogS05PV05fTUVOVV9DQVRFR09SSUVTLFxuICAgICAgICAgICAgbm90ZTogJ1JldHVybmVkIGRlZmF1bHQgY2F0ZWdvcmllcyDigJQgRWRpdG9yLk1lbnUuZ2V0TWVudSgpIG5vdCBhdmFpbGFibGUgaW4gdGhpcyB2ZXJzaW9uJ1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHNlYXJjaE1lbnVJdGVtcyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLmtleXdvcmQpIHJldHVybiBlcnJvclJlc3VsdCgna2V5d29yZCBpcyByZXF1aXJlZCBmb3Igc2VhcmNoJyk7XG4gICAgICAgIGNvbnN0IGtleXdvcmQgPSBhcmdzLmtleXdvcmQudG9Mb3dlckNhc2UoKTtcblxuICAgICAgICAvLyBCdWlsZCBzZWFyY2hhYmxlIG1lbnUgaXRlbSBsaXN0IGZyb20ga25vd24gQ29jb3MgQ3JlYXRvciBtZW51IHN0cnVjdHVyZVxuICAgICAgICBjb25zdCBtYXRjaGVzID0gS05PV05fTUVOVV9JVEVNUy5maWx0ZXIoaXRlbSA9PiBpdGVtLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5d29yZCkpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIGtleXdvcmQ6IGFyZ3Mua2V5d29yZCxcbiAgICAgICAgICAgIG1hdGNoZXMsXG4gICAgICAgICAgICBjb3VudDogbWF0Y2hlcy5sZW5ndGgsXG4gICAgICAgICAgICBub3RlOiAnUmVzdWx0cyBmcm9tIGtub3duIG1lbnUgaXRlbXMgbGlzdCDigJQgbm90IGV4aGF1c3RpdmUnXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdfQ==