import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const KNOWN_MENU_CATEGORIES = [
    'Cocos Creator', 'File', 'Edit', 'Node', 'Component',
    'Project', 'Panel', 'Extension', 'Developer', 'Help'
];

export class ExecuteMenuItem extends BaseActionTool {
    readonly name = 'execute_menu_item';
    readonly description = 'Execute or query Cocos Creator editor menu items. Actions: execute, list, search. Trigger menu commands by path (e.g. "Project/Build...").';
    readonly actions = ['execute', 'list', 'search'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        execute: (args) => this.executeMenuItem(args),
        list: (args) => this.listMenuCategories(args),
        search: (args) => this.searchMenuItems(args),
    };

    private async executeMenuItem(args: any): Promise<ActionToolResult> {
        if (!args.menuPath) return errorResult('menuPath is required for execute');
        try {
            // Try Editor.Message.send to trigger menu click
            Editor.Message.send('menu', 'click', args.menuPath);
            return successResult(
                { menuPath: args.menuPath },
                `Menu item '${args.menuPath}' executed`
            );
        } catch (err: any) {
            // Fallback: try Editor.Menu if available
            try {
                const menu = (Editor as any).Menu;
                if (menu && typeof menu.click === 'function') {
                    await menu.click(args.menuPath);
                    return successResult({ menuPath: args.menuPath }, `Menu item '${args.menuPath}' executed via Editor.Menu`);
                }
            } catch { /* ignore fallback errors */ }
            return errorResult(`Failed to execute menu item '${args.menuPath}': ${err.message}`);
        }
    }

    private async listMenuCategories(_args: any): Promise<ActionToolResult> {
        try {
            // Try to get menu list from Editor.Menu API
            const menu = (Editor as any).Menu;
            if (menu && typeof menu.getMenu === 'function') {
                const items = await menu.getMenu();
                if (items) {
                    return successResult({ categories: items });
                }
            }
        } catch { /* fall through to defaults */ }

        // Return known Cocos Creator menu categories as fallback
        return successResult({
            categories: KNOWN_MENU_CATEGORIES,
            note: 'Returned default categories — Editor.Menu.getMenu() not available in this version'
        });
    }

    private async searchMenuItems(args: any): Promise<ActionToolResult> {
        if (!args.keyword) return errorResult('keyword is required for search');
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

        return successResult({
            keyword: args.keyword,
            matches,
            count: matches.length,
            note: 'Results from known menu items list — not exhaustive'
        });
    }
}
