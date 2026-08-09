"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteMenuItem = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const KNOWN_MENU_CATEGORIES = [
    'Cocos Creator', 'File', 'Edit', 'Node', 'Component',
    'Project', 'Panel', 'Extension', 'Developer', 'Help'
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
        const knownItems = [
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
        const matches = knownItems.filter(item => item.toLowerCase().includes(keyword));
        return (0, types_1.successResult)({
            keyword: args.keyword,
            matches,
            count: matches.length,
            note: 'Results from known menu items list — not exhaustive'
        });
    }
}
exports.ExecuteMenuItem = ExecuteMenuItem;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZS1tZW51LWl0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvZXhlY3V0ZS1tZW51LWl0ZW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFNLHFCQUFxQixHQUFHO0lBQzFCLGVBQWUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXO0lBQ3BELFNBQVMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNO0NBQ3ZELENBQUM7QUFFRixNQUFhLGVBQWdCLFNBQVEsaUNBQWM7SUFBbkQ7O1FBQ2EsU0FBSSxHQUFHLG1CQUFtQixDQUFDO1FBQzNCLGdCQUFXLEdBQUcsNElBQTRJLENBQUM7UUFDM0osWUFBTyxHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN4QyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztvQkFDbkMsV0FBVyxFQUFFLG1IQUFtSDtpQkFDbkk7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwrR0FBK0c7aUJBQy9IO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsK0NBQStDO2lCQUMvRDthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO1lBQzdDLElBQUksRUFB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QTZCLEVBQUUsaUNBQWlDO1lBQzFGLGdDQUFnQyxFQUFFLGlDQUFpQztZQUNuRSwyQ0FBMkMsRUFBRSxxQ0FBcUM7WUFDbEYsa0JBQWtCLEVBQUUsOEJBQThCLEVBQUUsNkJBQTZCO1lBQ2pGLGNBQWMsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsYUFBYTtZQUNwRixnQ0FBZ0MsRUFBRSxrQkFBa0IsRUFBRSwyQkFBMkI7WUFDakYsa0JBQWtCLEVBQUUsWUFBWSxFQUFFLG9CQUFvQjtTQUN6RCxDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUVoRixPQUFPLElBQUEscUJBQWEsRUFBQztZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsT0FBTztZQUNQLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTTtZQUNyQixJQUFJLEVBQUUscURBQXFEO1NBQzlELENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQWpHRCwwQ0FpR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcblxuY29uc3QgS05PV05fTUVOVV9DQVRFR09SSUVTID0gW1xuICAgICdDb2NvcyBDcmVhdG9yJywgJ0ZpbGUnLCAnRWRpdCcsICdOb2RlJywgJ0NvbXBvbmVudCcsXG4gICAgJ1Byb2plY3QnLCAnUGFuZWwnLCAnRXh0ZW5zaW9uJywgJ0RldmVsb3BlcicsICdIZWxwJ1xuXTtcblxuZXhwb3J0IGNsYXNzIEV4ZWN1dGVNZW51SXRlbSBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ2V4ZWN1dGVfbWVudV9pdGVtJztcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdFeGVjdXRlIG9yIHF1ZXJ5IENvY29zIENyZWF0b3IgZWRpdG9yIG1lbnUgaXRlbXMuIEFjdGlvbnM6IGV4ZWN1dGUsIGxpc3QsIHNlYXJjaC4gVHJpZ2dlciBtZW51IGNvbW1hbmRzIGJ5IHBhdGggKGUuZy4gXCJQcm9qZWN0L0J1aWxkLi4uXCIpLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZXhlY3V0ZScsICdsaXN0JywgJ3NlYXJjaCddO1xuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWydleGVjdXRlJywgJ2xpc3QnLCAnc2VhcmNoJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IGV4ZWN1dGU9cnVuIGEgbWVudSBpdGVtIGJ5IHBhdGgsIGxpc3Q9bGlzdCB0b3AtbGV2ZWwgbWVudSBjYXRlZ29yaWVzLCBzZWFyY2g9c2VhcmNoIG1lbnUgaXRlbXMgYnkga2V5d29yZCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBtZW51UGF0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2V4ZWN1dGVdIEZ1bGwgbWVudSBwYXRoIHVzaW5nIFwiL1wiIHNlcGFyYXRvciAoZS5nLiBcIlByb2plY3QvQnVpbGQuLi5cIiwgXCJFZGl0L1VuZG9cIiwgXCJOb2RlL0NyZWF0ZSBFbXB0eSBOb2RlXCIpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGtleXdvcmQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZWFyY2hdIEtleXdvcmQgdG8gc2VhcmNoIG1lbnUgaXRlbXMgYnkgbmFtZSdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGV4ZWN1dGU6IChhcmdzKSA9PiB0aGlzLmV4ZWN1dGVNZW51SXRlbShhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdE1lbnVDYXRlZ29yaWVzKGFyZ3MpLFxuICAgICAgICBzZWFyY2g6IChhcmdzKSA9PiB0aGlzLnNlYXJjaE1lbnVJdGVtcyhhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlTWVudUl0ZW0oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5tZW51UGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KCdtZW51UGF0aCBpcyByZXF1aXJlZCBmb3IgZXhlY3V0ZScpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gVHJ5IEVkaXRvci5NZXNzYWdlLnNlbmQgdG8gdHJpZ2dlciBtZW51IGNsaWNrXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5zZW5kKCdtZW51JywgJ2NsaWNrJywgYXJncy5tZW51UGF0aCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChcbiAgICAgICAgICAgICAgICB7IG1lbnVQYXRoOiBhcmdzLm1lbnVQYXRoIH0sXG4gICAgICAgICAgICAgICAgYE1lbnUgaXRlbSAnJHthcmdzLm1lbnVQYXRofScgZXhlY3V0ZWRgXG4gICAgICAgICAgICApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHRyeSBFZGl0b3IuTWVudSBpZiBhdmFpbGFibGVcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVudSA9IChFZGl0b3IgYXMgYW55KS5NZW51O1xuICAgICAgICAgICAgICAgIGlmIChtZW51ICYmIHR5cGVvZiBtZW51LmNsaWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IG1lbnUuY2xpY2soYXJncy5tZW51UGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbWVudVBhdGg6IGFyZ3MubWVudVBhdGggfSwgYE1lbnUgaXRlbSAnJHthcmdzLm1lbnVQYXRofScgZXhlY3V0ZWQgdmlhIEVkaXRvci5NZW51YCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7IC8qIGlnbm9yZSBmYWxsYmFjayBlcnJvcnMgKi8gfVxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBGYWlsZWQgdG8gZXhlY3V0ZSBtZW51IGl0ZW0gJyR7YXJncy5tZW51UGF0aH0nOiAke2Vyci5tZXNzYWdlfWApO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0TWVudUNhdGVnb3JpZXMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gVHJ5IHRvIGdldCBtZW51IGxpc3QgZnJvbSBFZGl0b3IuTWVudSBBUElcbiAgICAgICAgICAgIGNvbnN0IG1lbnUgPSAoRWRpdG9yIGFzIGFueSkuTWVudTtcbiAgICAgICAgICAgIGlmIChtZW51ICYmIHR5cGVvZiBtZW51LmdldE1lbnUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpdGVtcyA9IGF3YWl0IG1lbnUuZ2V0TWVudSgpO1xuICAgICAgICAgICAgICAgIGlmIChpdGVtcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IGNhdGVnb3JpZXM6IGl0ZW1zIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCB7IC8qIGZhbGwgdGhyb3VnaCB0byBkZWZhdWx0cyAqLyB9XG5cbiAgICAgICAgLy8gUmV0dXJuIGtub3duIENvY29zIENyZWF0b3IgbWVudSBjYXRlZ29yaWVzIGFzIGZhbGxiYWNrXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIGNhdGVnb3JpZXM6IEtOT1dOX01FTlVfQ0FURUdPUklFUyxcbiAgICAgICAgICAgIG5vdGU6ICdSZXR1cm5lZCBkZWZhdWx0IGNhdGVnb3JpZXMg4oCUIEVkaXRvci5NZW51LmdldE1lbnUoKSBub3QgYXZhaWxhYmxlIGluIHRoaXMgdmVyc2lvbidcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZWFyY2hNZW51SXRlbXMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5rZXl3b3JkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2tleXdvcmQgaXMgcmVxdWlyZWQgZm9yIHNlYXJjaCcpO1xuICAgICAgICBjb25zdCBrZXl3b3JkID0gYXJncy5rZXl3b3JkLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgLy8gQnVpbGQgc2VhcmNoYWJsZSBtZW51IGl0ZW0gbGlzdCBmcm9tIGtub3duIENvY29zIENyZWF0b3IgbWVudSBzdHJ1Y3R1cmVcbiAgICAgICAgY29uc3Qga25vd25JdGVtcyA9IFtcbiAgICAgICAgICAgICdGaWxlL05ldyBTY2VuZScsICdGaWxlL09wZW4gU2NlbmUnLCAnRmlsZS9TYXZlIFNjZW5lJywgJ0ZpbGUvU2F2ZSBTY2VuZSBBcycsXG4gICAgICAgICAgICAnRWRpdC9VbmRvJywgJ0VkaXQvUmVkbycsICdFZGl0L0N1dCcsICdFZGl0L0NvcHknLCAnRWRpdC9QYXN0ZScsICdFZGl0L1NlbGVjdCBBbGwnLFxuICAgICAgICAgICAgJ05vZGUvQ3JlYXRlIEVtcHR5IE5vZGUnLCAnTm9kZS9DcmVhdGUgRW1wdHkgTm9kZSAoM0QpJywgJ05vZGUvQ3JlYXRlIFJlbmRlciBOb2Rlcy9TcHJpdGUnLFxuICAgICAgICAgICAgJ05vZGUvQ3JlYXRlIFJlbmRlciBOb2Rlcy9MYWJlbCcsICdOb2RlL0NyZWF0ZSBSZW5kZXIgTm9kZXMvQ2FudmFzJyxcbiAgICAgICAgICAgICdOb2RlL0NyZWF0ZSBMaWdodCBOb2Rlcy9EaXJlY3Rpb25hbCBMaWdodCcsICdOb2RlL0NyZWF0ZSBMaWdodCBOb2Rlcy9Qb2ludCBMaWdodCcsXG4gICAgICAgICAgICAnUHJvamVjdC9CdWlsZC4uLicsICdQcm9qZWN0L0dlbmVyYXRlIE5hdGl2ZSBDb2RlJywgJ1Byb2plY3QvUHJvamVjdCBTZXR0aW5ncy4uLicsXG4gICAgICAgICAgICAnUGFuZWwvQXNzZXRzJywgJ1BhbmVsL0NvbnNvbGUnLCAnUGFuZWwvSW5zcGVjdG9yJywgJ1BhbmVsL05vZGUgVHJlZScsICdQYW5lbC9TY2VuZScsXG4gICAgICAgICAgICAnRXh0ZW5zaW9uL0V4dGVuc2lvbiBNYW5hZ2VyLi4uJywgJ0RldmVsb3Blci9SZWxvYWQnLCAnRGV2ZWxvcGVyL0RldmVsb3BlciBUb29scycsXG4gICAgICAgICAgICAnSGVscC9Vc2VyIE1hbnVhbCcsICdIZWxwL0ZvcnVtJywgJ0hlbHAvUmVsZWFzZSBOb3RlcydcbiAgICAgICAgXTtcblxuICAgICAgICBjb25zdCBtYXRjaGVzID0ga25vd25JdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5d29yZCkpO1xuXG4gICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcbiAgICAgICAgICAgIGtleXdvcmQ6IGFyZ3Mua2V5d29yZCxcbiAgICAgICAgICAgIG1hdGNoZXMsXG4gICAgICAgICAgICBjb3VudDogbWF0Y2hlcy5sZW5ndGgsXG4gICAgICAgICAgICBub3RlOiAnUmVzdWx0cyBmcm9tIGtub3duIG1lbnUgaXRlbXMgbGlzdCDigJQgbm90IGV4aGF1c3RpdmUnXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbiJdfQ==