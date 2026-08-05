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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZS1tZW51LWl0ZW0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvZXhlY3V0ZS1tZW51LWl0ZW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFNLHFCQUFxQixHQUFHO0lBQzFCLGVBQWUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxXQUFXO0lBQ3BELFNBQVMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxNQUFNO0NBQ3ZELENBQUM7QUFFRixNQUFhLGVBQWdCLFNBQVEsaUNBQWM7SUFBbkQ7O1FBQ2EsU0FBSSxHQUFHLG1CQUFtQixDQUFDO1FBQzNCLGdCQUFXLEdBQUcsNElBQTRJLENBQUM7UUFDM0osWUFBTyxHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUN4QyxnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztvQkFDbkMsV0FBVyxFQUFFLG1IQUFtSDtpQkFDbkk7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSwrR0FBK0c7aUJBQy9IO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsK0NBQStDO2lCQUMvRDthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxPQUFPLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDO1lBQzdDLElBQUksRUFB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QTZCLEVBQUUsaUNBQWlDO1lBQzFGLGdDQUFnQyxFQUFFLGlDQUFpQztZQUNuRSwyQ0FBMkMsRUFBRSxxQ0FBcUM7WUFDbEYsa0JBQWtCLEVBQUUsOEJBQThCLEVBQUUsNkJBQTZCO1lBQ2pGLGNBQWMsRUFBRSxlQUFlLEVBQUUsaUJBQWlCLEVBQUUsaUJBQWlCLEVBQUUsYUFBYTtZQUNwRixnQ0FBZ0MsRUFBRSxrQkFBa0IsRUFBRSwyQkFBMkI7WUFDakYsa0JBQWtCLEVBQUUsWUFBWSxFQUFFLG9CQUFvQjtTQUN6RCxDQUFDO1FBRUYsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUVoRixPQUFPLElBQUEscUJBQWEsRUFBQztZQUNqQixPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDckIsT0FBTztZQUNQLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTTtZQUNyQixJQUFJLEVBQUUscURBQXFEO1NBQzlELENBQUMsQ0FBQztJQUNQLENBQUM7Q0FDSjtBQWpHRCwwQ0FpR0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQWN0aW9uVG9vbCB9IGZyb20gJy4vYmFzZS1hY3Rpb24tdG9vbCc7XHJcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5cclxuY29uc3QgS05PV05fTUVOVV9DQVRFR09SSUVTID0gW1xyXG4gICAgJ0NvY29zIENyZWF0b3InLCAnRmlsZScsICdFZGl0JywgJ05vZGUnLCAnQ29tcG9uZW50JyxcclxuICAgICdQcm9qZWN0JywgJ1BhbmVsJywgJ0V4dGVuc2lvbicsICdEZXZlbG9wZXInLCAnSGVscCdcclxuXTtcclxuXHJcbmV4cG9ydCBjbGFzcyBFeGVjdXRlTWVudUl0ZW0gZXh0ZW5kcyBCYXNlQWN0aW9uVG9vbCB7XHJcbiAgICByZWFkb25seSBuYW1lID0gJ2V4ZWN1dGVfbWVudV9pdGVtJztcclxuICAgIHJlYWRvbmx5IGRlc2NyaXB0aW9uID0gJ0V4ZWN1dGUgb3IgcXVlcnkgQ29jb3MgQ3JlYXRvciBlZGl0b3IgbWVudSBpdGVtcy4gQWN0aW9uczogZXhlY3V0ZSwgbGlzdCwgc2VhcmNoLiBUcmlnZ2VyIG1lbnUgY29tbWFuZHMgYnkgcGF0aCAoZS5nLiBcIlByb2plY3QvQnVpbGQuLi5cIikuJztcclxuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2V4ZWN1dGUnLCAnbGlzdCcsICdzZWFyY2gnXTtcclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnZXhlY3V0ZScsICdsaXN0JywgJ3NlYXJjaCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb246IGV4ZWN1dGU9cnVuIGEgbWVudSBpdGVtIGJ5IHBhdGgsIGxpc3Q9bGlzdCB0b3AtbGV2ZWwgbWVudSBjYXRlZ29yaWVzLCBzZWFyY2g9c2VhcmNoIG1lbnUgaXRlbXMgYnkga2V5d29yZCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbWVudVBhdGg6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbZXhlY3V0ZV0gRnVsbCBtZW51IHBhdGggdXNpbmcgXCIvXCIgc2VwYXJhdG9yIChlLmcuIFwiUHJvamVjdC9CdWlsZC4uLlwiLCBcIkVkaXQvVW5kb1wiLCBcIk5vZGUvQ3JlYXRlIEVtcHR5IE5vZGVcIiknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGtleXdvcmQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2VhcmNoXSBLZXl3b3JkIHRvIHNlYXJjaCBtZW51IGl0ZW1zIGJ5IG5hbWUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGV4ZWN1dGU6IChhcmdzKSA9PiB0aGlzLmV4ZWN1dGVNZW51SXRlbShhcmdzKSxcclxuICAgICAgICBsaXN0OiAoYXJncykgPT4gdGhpcy5saXN0TWVudUNhdGVnb3JpZXMoYXJncyksXHJcbiAgICAgICAgc2VhcmNoOiAoYXJncykgPT4gdGhpcy5zZWFyY2hNZW51SXRlbXMoYXJncyksXHJcbiAgICB9O1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZXhlY3V0ZU1lbnVJdGVtKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5tZW51UGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KCdtZW51UGF0aCBpcyByZXF1aXJlZCBmb3IgZXhlY3V0ZScpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFRyeSBFZGl0b3IuTWVzc2FnZS5zZW5kIHRvIHRyaWdnZXIgbWVudSBjbGlja1xyXG4gICAgICAgICAgICBFZGl0b3IuTWVzc2FnZS5zZW5kKCdtZW51JywgJ2NsaWNrJywgYXJncy5tZW51UGF0aCk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxyXG4gICAgICAgICAgICAgICAgeyBtZW51UGF0aDogYXJncy5tZW51UGF0aCB9LFxyXG4gICAgICAgICAgICAgICAgYE1lbnUgaXRlbSAnJHthcmdzLm1lbnVQYXRofScgZXhlY3V0ZWRgXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgLy8gRmFsbGJhY2s6IHRyeSBFZGl0b3IuTWVudSBpZiBhdmFpbGFibGVcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IG1lbnUgPSAoRWRpdG9yIGFzIGFueSkuTWVudTtcclxuICAgICAgICAgICAgICAgIGlmIChtZW51ICYmIHR5cGVvZiBtZW51LmNsaWNrID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgbWVudS5jbGljayhhcmdzLm1lbnVQYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG1lbnVQYXRoOiBhcmdzLm1lbnVQYXRoIH0sIGBNZW51IGl0ZW0gJyR7YXJncy5tZW51UGF0aH0nIGV4ZWN1dGVkIHZpYSBFZGl0b3IuTWVudWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIHsgLyogaWdub3JlIGZhbGxiYWNrIGVycm9ycyAqLyB9XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgRmFpbGVkIHRvIGV4ZWN1dGUgbWVudSBpdGVtICcke2FyZ3MubWVudVBhdGh9JzogJHtlcnIubWVzc2FnZX1gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0TWVudUNhdGVnb3JpZXMoX2FyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vIFRyeSB0byBnZXQgbWVudSBsaXN0IGZyb20gRWRpdG9yLk1lbnUgQVBJXHJcbiAgICAgICAgICAgIGNvbnN0IG1lbnUgPSAoRWRpdG9yIGFzIGFueSkuTWVudTtcclxuICAgICAgICAgICAgaWYgKG1lbnUgJiYgdHlwZW9mIG1lbnUuZ2V0TWVudSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaXRlbXMgPSBhd2FpdCBtZW51LmdldE1lbnUoKTtcclxuICAgICAgICAgICAgICAgIGlmIChpdGVtcykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgY2F0ZWdvcmllczogaXRlbXMgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGNhdGNoIHsgLyogZmFsbCB0aHJvdWdoIHRvIGRlZmF1bHRzICovIH1cclxuXHJcbiAgICAgICAgLy8gUmV0dXJuIGtub3duIENvY29zIENyZWF0b3IgbWVudSBjYXRlZ29yaWVzIGFzIGZhbGxiYWNrXHJcbiAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xyXG4gICAgICAgICAgICBjYXRlZ29yaWVzOiBLTk9XTl9NRU5VX0NBVEVHT1JJRVMsXHJcbiAgICAgICAgICAgIG5vdGU6ICdSZXR1cm5lZCBkZWZhdWx0IGNhdGVnb3JpZXMg4oCUIEVkaXRvci5NZW51LmdldE1lbnUoKSBub3QgYXZhaWxhYmxlIGluIHRoaXMgdmVyc2lvbidcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNlYXJjaE1lbnVJdGVtcyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoIWFyZ3Mua2V5d29yZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdrZXl3b3JkIGlzIHJlcXVpcmVkIGZvciBzZWFyY2gnKTtcclxuICAgICAgICBjb25zdCBrZXl3b3JkID0gYXJncy5rZXl3b3JkLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gICAgICAgIC8vIEJ1aWxkIHNlYXJjaGFibGUgbWVudSBpdGVtIGxpc3QgZnJvbSBrbm93biBDb2NvcyBDcmVhdG9yIG1lbnUgc3RydWN0dXJlXHJcbiAgICAgICAgY29uc3Qga25vd25JdGVtcyA9IFtcclxuICAgICAgICAgICAgJ0ZpbGUvTmV3IFNjZW5lJywgJ0ZpbGUvT3BlbiBTY2VuZScsICdGaWxlL1NhdmUgU2NlbmUnLCAnRmlsZS9TYXZlIFNjZW5lIEFzJyxcclxuICAgICAgICAgICAgJ0VkaXQvVW5kbycsICdFZGl0L1JlZG8nLCAnRWRpdC9DdXQnLCAnRWRpdC9Db3B5JywgJ0VkaXQvUGFzdGUnLCAnRWRpdC9TZWxlY3QgQWxsJyxcclxuICAgICAgICAgICAgJ05vZGUvQ3JlYXRlIEVtcHR5IE5vZGUnLCAnTm9kZS9DcmVhdGUgRW1wdHkgTm9kZSAoM0QpJywgJ05vZGUvQ3JlYXRlIFJlbmRlciBOb2Rlcy9TcHJpdGUnLFxyXG4gICAgICAgICAgICAnTm9kZS9DcmVhdGUgUmVuZGVyIE5vZGVzL0xhYmVsJywgJ05vZGUvQ3JlYXRlIFJlbmRlciBOb2Rlcy9DYW52YXMnLFxyXG4gICAgICAgICAgICAnTm9kZS9DcmVhdGUgTGlnaHQgTm9kZXMvRGlyZWN0aW9uYWwgTGlnaHQnLCAnTm9kZS9DcmVhdGUgTGlnaHQgTm9kZXMvUG9pbnQgTGlnaHQnLFxyXG4gICAgICAgICAgICAnUHJvamVjdC9CdWlsZC4uLicsICdQcm9qZWN0L0dlbmVyYXRlIE5hdGl2ZSBDb2RlJywgJ1Byb2plY3QvUHJvamVjdCBTZXR0aW5ncy4uLicsXHJcbiAgICAgICAgICAgICdQYW5lbC9Bc3NldHMnLCAnUGFuZWwvQ29uc29sZScsICdQYW5lbC9JbnNwZWN0b3InLCAnUGFuZWwvTm9kZSBUcmVlJywgJ1BhbmVsL1NjZW5lJyxcclxuICAgICAgICAgICAgJ0V4dGVuc2lvbi9FeHRlbnNpb24gTWFuYWdlci4uLicsICdEZXZlbG9wZXIvUmVsb2FkJywgJ0RldmVsb3Blci9EZXZlbG9wZXIgVG9vbHMnLFxyXG4gICAgICAgICAgICAnSGVscC9Vc2VyIE1hbnVhbCcsICdIZWxwL0ZvcnVtJywgJ0hlbHAvUmVsZWFzZSBOb3RlcydcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBjb25zdCBtYXRjaGVzID0ga25vd25JdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoa2V5d29yZCkpO1xyXG5cclxuICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7XHJcbiAgICAgICAgICAgIGtleXdvcmQ6IGFyZ3Mua2V5d29yZCxcclxuICAgICAgICAgICAgbWF0Y2hlcyxcclxuICAgICAgICAgICAgY291bnQ6IG1hdGNoZXMubGVuZ3RoLFxyXG4gICAgICAgICAgICBub3RlOiAnUmVzdWx0cyBmcm9tIGtub3duIG1lbnUgaXRlbXMgbGlzdCDigJQgbm90IGV4aGF1c3RpdmUnXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuIl19