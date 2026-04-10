import { ExecuteMenuItem } from '../tools/execute-menu-item';

describe('ExecuteMenuItem', () => {
    let tool: ExecuteMenuItem;

    beforeEach(() => {
        tool = new ExecuteMenuItem();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('execute_menu_item');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['execute', 'list', 'search']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown', {});
            expect(result.success).toBe(false);
        });
    });

    describe('execute action', () => {
        it('returns error when menuPath is missing', async () => {
            const result = await tool.execute('execute', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/menuPath is required/i);
        });

        it('calls Editor.Message.send to execute menu item', async () => {
            const mockSend = (global as any).Editor.Message.send as jest.Mock;

            const result = await tool.execute('execute', { menuPath: 'File/Save Scene' });
            expect(result.success).toBe(true);
            expect(mockSend).toHaveBeenCalledWith('menu', 'click', 'File/Save Scene');
        });

        it('returns success result with menu path', async () => {
            const mockSend = (global as any).Editor.Message.send as jest.Mock;

            const result = await tool.execute('execute', { menuPath: 'Edit/Undo' });
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ menuPath: 'Edit/Undo' });
        });
    });

    describe('list action', () => {
        it('returns known menu categories', async () => {
            const result = await tool.execute('list', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('categories');
            expect(Array.isArray(result.data.categories)).toBe(true);
            expect(result.data.categories.length).toBeGreaterThan(0);
        });

        it('includes default Cocos Creator categories', async () => {
            const result = await tool.execute('list', {});
            const categories = result.data.categories as string[];
            expect(categories).toContain('File');
            expect(categories).toContain('Edit');
            expect(categories).toContain('Node');
            expect(categories).toContain('Project');
        });
    });

    describe('search action', () => {
        it('returns error when keyword is missing', async () => {
            const result = await tool.execute('search', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/keyword is required/i);
        });

        it('searches menu items by keyword', async () => {
            const result = await tool.execute('search', { keyword: 'save' });
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('keyword');
            expect(result.data).toHaveProperty('matches');
            expect(result.data).toHaveProperty('count');
        });

        it('returns matches array with menu items containing keyword', async () => {
            const result = await tool.execute('search', { keyword: 'Scene' });
            expect(result.success).toBe(true);
            const matches = result.data.matches as string[];
            expect(Array.isArray(matches)).toBe(true);
            matches.forEach(match => {
                expect(match.toLowerCase()).toContain('scene');
            });
        });

        it('case-insensitive search', async () => {
            const result = await tool.execute('search', { keyword: 'BUILD' });
            expect(result.success).toBe(true);
            expect((result.data.count as number) > 0).toBe(true);
        });

        it('returns 0 matches for non-matching keyword', async () => {
            const result = await tool.execute('search', { keyword: 'nonexistentkeyword123456' });
            expect(result.success).toBe(true);
            expect(result.data.count).toBe(0);
        });

        it('searches for create node items', async () => {
            const result = await tool.execute('search', { keyword: 'Create Empty Node' });
            expect(result.success).toBe(true);
            expect((result.data.count as number) >= 1).toBe(true);
        });

        it('searches for panel menu items', async () => {
            const result = await tool.execute('search', { keyword: 'Console' });
            expect(result.success).toBe(true);
            expect((result.data.count as number) >= 1).toBe(true);
        });

        it('returns empty matches for partial word with no results', async () => {
            const result = await tool.execute('search', { keyword: 'xyz' });
            expect(result.success).toBe(true);
            expect(result.data.count).toBe(0);
            expect(result.data.matches).toEqual([]);
        });
    });
});
