import { ManageEditor } from '../tools/manage-editor';

describe('ManageEditor', () => {
    let tool: ManageEditor;

    beforeEach(() => {
        tool = new ManageEditor();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_editor');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual(['play', 'pause', 'step', 'stop', 'get_state', 'reload_scene', 'open_panel', 'get_panels']);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        expect((tool.inputSchema as any).properties.action.enum).toEqual(['play', 'pause', 'step', 'stop', 'get_state', 'reload_scene', 'open_panel', 'get_panels']);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Play action tests
    it('play calls Editor.Message.request with preview open', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('play', {});

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('preview', 'open');
    });

    it('play returns success message with started status', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('play', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/started/i);
    });

    // Pause action tests
    it('pause calls Editor.Message.request with preview pause', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('pause', {});

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('preview', 'pause');
    });

    it('pause returns success message with paused status', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('pause', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/paused/i);
    });

    // Step action tests
    it('step calls Editor.Message.request with preview step', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('step', {});

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('preview', 'step');
    });

    it('step returns success message with frame advance info', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('step', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/step/i);
    });

    // Stop action tests
    it('stop calls Editor.Message.request with preview close', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('stop', {});

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('preview', 'close');
    });

    it('stop returns success message with stopped status', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('stop', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/stopped/i);
    });

    // Get state action tests
    it('get_state calls Editor.Message.request with preview query-info', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const stateData = { playing: true, currentTime: 5.5 };
        mockRequest.mockResolvedValueOnce(stateData);

        const result = await tool.execute('get_state', {});

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('preview', 'query-info');
        expect(result.data).toEqual(stateData);
    });

    it('get_state returns note when preview state unavailable', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce(null);

        const result = await tool.execute('get_state', {});

        expect(result.success).toBe(true);
        expect((result.data as any).note).toMatch(/not available/i);
    });

    it('get_state handles errors gracefully', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockRejectedValueOnce(new Error('timeout'));

        const result = await tool.execute('get_state', {});

        expect(result.success).toBe(true);
        expect((result.data as any).note).toBeDefined();
    });

    // Reload scene action tests
    it('reload_scene calls Editor.Message.request with scene soft-reload', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('reload_scene', {});

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'soft-reload');
    });

    it('reload_scene returns success message', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({});

        const result = await tool.execute('reload_scene', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/reloaded/i);
    });

    it('reload_scene returns error when scene call fails', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockRejectedValueOnce(new Error('No scene loaded'));

        const result = await tool.execute('reload_scene', {});

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No scene loaded/);
    });

    // Open panel action tests
    it('open_panel returns error when panelName is missing', async () => {
        const result = await tool.execute('open_panel', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/panelName.*required/i);
    });

    it('open_panel calls Editor.Panel.open correctly', async () => {
        const mockPanelOpen = (global as any).Editor.Panel.open as jest.Mock;
        mockPanelOpen.mockResolvedValueOnce({});

        const result = await tool.execute('open_panel', { panelName: 'inspector' });

        expect(result.success).toBe(true);
        expect(mockPanelOpen).toHaveBeenCalledWith('inspector');
    });

    it('open_panel returns success with panel name', async () => {
        const mockPanelOpen = (global as any).Editor.Panel.open as jest.Mock;
        mockPanelOpen.mockResolvedValueOnce({});

        const result = await tool.execute('open_panel', { panelName: 'assets' });

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/assets/);
    });

    it('open_panel returns error when panel open fails', async () => {
        const mockPanelOpen = (global as any).Editor.Panel.open as jest.Mock;
        mockPanelOpen.mockRejectedValueOnce(new Error('Invalid panel name'));

        const result = await tool.execute('open_panel', { panelName: 'nonexistent' });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Failed to open panel/);
    });

    // Get panels action tests
    it('get_panels returns array of known panels', async () => {
        const result = await tool.execute('get_panels', {});

        expect(result.success).toBe(true);
        expect(Array.isArray((result.data as any).panels)).toBe(true);
    });

    it('get_panels includes common Cocos panels', async () => {
        const result = await tool.execute('get_panels', {});

        const panels = (result.data as any).panels;
        expect(panels).toContain('console');
        expect(panels).toContain('hierarchy');
        expect(panels).toContain('inspector');
        expect(panels).toContain('assets');
        expect(panels).toContain('scene');
    });

    it('get_panels includes MCP server panels', async () => {
        const result = await tool.execute('get_panels', {});

        const panels = (result.data as any).panels;
        expect(panels).toContain('cocos-mcp-server.default');
        expect(panels).toContain('cocos-mcp-server.tool-manager');
    });

    it('get_panels returns count of panels', async () => {
        const result = await tool.execute('get_panels', {});

        expect((result.data as any).count).toBeGreaterThan(0);
        expect((result.data as any).count).toBe((result.data as any).panels.length);
    });

    it('get_panels does not call Editor.Message.request', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;

        await tool.execute('get_panels', {});

        expect(mockRequest).not.toHaveBeenCalled();
    });

    // Preview command error handling
    it('play handles preview timeout gracefully', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockRejectedValueOnce(new Error('timeout'));

        const result = await tool.execute('play', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/no confirmation/i);
    });

    it('pause handles preview no handler error gracefully', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockRejectedValueOnce(new Error('no handler'));

        const result = await tool.execute('pause', {});

        expect(result.success).toBe(true);
        expect(result.message).toMatch(/no confirmation/i);
    });
});
