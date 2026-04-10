import { ManageUI } from '../tools/manage-ui';

describe('ManageUI', () => {
    let tool: ManageUI;

    beforeEach(() => {
        tool = new ManageUI();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_ui');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toContain('create_widget');
        expect(tool.actions).toContain('create_label');
        expect(tool.actions).toContain('create_button');
        expect(tool.actions).toContain('create_sprite');
        expect(tool.actions).toContain('create_layout');
        expect(tool.actions).toContain('create_scrollview');
        expect(tool.actions).toContain('create_editbox');
        expect(tool.actions).toContain('set_widget');
        expect(tool.actions).toContain('set_label_property');
        expect(tool.actions).toContain('set_sprite_property');
        expect(tool.actions).toContain('get_info');
        expect(tool.actions).toContain('list_ui_nodes');
        expect(tool.actions.length).toBe(12);
    });

    it('has valid inputSchema with action property', () => {
        expect(tool.inputSchema).toHaveProperty('properties.action');
        const actionEnum = (tool.inputSchema as any).properties.action.enum;
        expect(actionEnum).toContain('create_widget');
        expect(actionEnum).toContain('create_label');
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // Create widget action tests
    it('create_widget succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('widget-node-1'); // create-node returns uuid
        mockRequest.mockResolvedValueOnce({}); // create-component returns success

        const result = await tool.execute('create_widget', { alignment: 'center' });
        expect(result.success).toBe(true);
    });

    it('create_widget calls Editor.Message.request to create node and components', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('widget-node-1'); // create-node returns uuid
        mockRequest.mockResolvedValueOnce({}); // create-component returns success

        const result = await tool.execute('create_widget', {
            parentUuid: 'parent-123',
            alignment: 'center'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.objectContaining({
            name: expect.any(String),
            parent: 'parent-123'
        }));
    });

    // Create label action tests
    it('create_label succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('label-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_label', { text: 'Label Text' });
        expect(result.success).toBe(true);
    });

    it('create_label calls Editor.Message.request to create node and label component', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('label-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_label', {
            parentUuid: 'parent-123',
            text: 'My Label',
            fontSize: 24,
            color: '#FFFFFF'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.objectContaining({
            parent: 'parent-123'
        }));
    });

    // Create button action tests
    it('create_button succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('button-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component
        mockRequest.mockResolvedValueOnce({}); // queryNode
        mockRequest.mockResolvedValueOnce({}); // create-node for label
        mockRequest.mockResolvedValueOnce({}); // create-component UITransform
        mockRequest.mockResolvedValueOnce({}); // create-component Label

        const result = await tool.execute('create_button', { text: 'Click Me' });
        expect(result.success).toBe(true);
    });

    it('create_button calls Editor.Message.request to create button node', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('button-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component
        mockRequest.mockResolvedValueOnce({ __comps__: [{ __type__: 'cc.Button' }] }); // queryNode
        mockRequest.mockResolvedValueOnce('label-1'); // create-node for label
        mockRequest.mockResolvedValueOnce({}); // create-component UITransform
        mockRequest.mockResolvedValueOnce({}); // create-component Label

        const result = await tool.execute('create_button', {
            parentUuid: 'parent-123',
            text: 'OK Button',
            normalColor: '#CCCCCC'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalled();
    });

    // Create sprite action tests
    it('create_sprite succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('sprite-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component
        mockRequest.mockResolvedValueOnce({ __comps__: [{ __type__: 'cc.Sprite' }] }); // queryNode

        const result = await tool.execute('create_sprite', { spriteFrameUuid: 'frame-123' });
        expect(result.success).toBe(true);
    });

    it('create_sprite calls Editor.Message.request to create sprite node', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('sprite-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component
        mockRequest.mockResolvedValueOnce({ __comps__: [{ __type__: 'cc.Sprite' }] }); // queryNode

        const result = await tool.execute('create_sprite', {
            parentUuid: 'parent-123',
            spriteFrameUuid: 'frame-123'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.any(Object));
    });

    // Create layout action tests
    it('create_layout succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('layout-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_layout', { layoutType: 'HORIZONTAL' });
        expect(result.success).toBe(true);
    });

    it('create_layout calls Editor.Message.request to create layout node', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('layout-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_layout', {
            parentUuid: 'parent-123',
            layoutType: 'VERTICAL',
            spacingX: 5,
            spacingY: 10
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalled();
    });

    // Create scrollview action tests
    it('create_scrollview succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('scroll-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_scrollview', {
            direction: 'vertical'
        });

        expect(result.success).toBe(true);
    });

    it('create_scrollview calls Editor.Message.request to create scrollview node', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('scroll-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_scrollview', {
            parentUuid: 'parent-123',
            direction: 'both'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'create-node', expect.any(Object));
    });

    // Create editbox action tests
    it('create_editbox succeeds without parentUuid (optional)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('edit-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_editbox', { placeholder: 'Enter text' });
        expect(result.success).toBe(true);
    });

    it('create_editbox calls Editor.Message.request to create editbox node', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce('edit-node-1'); // create-node
        mockRequest.mockResolvedValueOnce({}); // create-component

        const result = await tool.execute('create_editbox', {
            parentUuid: 'parent-123',
            placeholder: 'Type here...',
            maxLength: 50
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalled();
    });

    // Set widget action tests
    it('set_widget returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_widget', { alignment: 'center' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid.*required/i);
    });

    it('set_widget calls Editor.Message.request to query and set properties', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ __comps__: [{ __type__: 'cc.Widget' }] }); // query-node response
        mockRequest.mockResolvedValueOnce({}); // set-property response

        const result = await tool.execute('set_widget', {
            nodeUuid: 'widget-123',
            isAlignTop: true,
            top: 20
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'query-node', 'widget-123');
        expect(mockRequest).toHaveBeenCalledWith('scene', 'set-property', expect.objectContaining({
            uuid: 'widget-123'
        }));
    });

    // Set label property action tests
    it('set_label_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_label_property', { property: 'string', value: 'New Text' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_label_property returns error when property is missing', async () => {
        const result = await tool.execute('set_label_property', { nodeUuid: 'label-123', value: 'New Text' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property.*required/i);
    });

    it('set_label_property returns error when value is undefined', async () => {
        const result = await tool.execute('set_label_property', { nodeUuid: 'label-123', property: 'string' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property.*value.*required/i);
    });

    it('set_label_property calls Editor.Message.request to query and set properties', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ __comps__: [{ __type__: 'cc.Label' }] }); // query-node
        mockRequest.mockResolvedValueOnce({}); // set-property

        const result = await tool.execute('set_label_property', {
            nodeUuid: 'label-123',
            property: 'string',
            value: 'Updated Text'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'query-node', 'label-123');
    });

    // Set sprite property action tests
    it('set_sprite_property returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('set_sprite_property', { property: 'spriteFrame', value: 'frame-456' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('set_sprite_property returns error when property is missing', async () => {
        const result = await tool.execute('set_sprite_property', { nodeUuid: 'sprite-123', value: 'frame-456' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/property.*required/i);
    });

    it('set_sprite_property calls Editor.Message.request to query and set properties', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ __comps__: [{ __type__: 'cc.Sprite' }] }); // query-node
        mockRequest.mockResolvedValueOnce({}); // set-property

        const result = await tool.execute('set_sprite_property', {
            nodeUuid: 'sprite-123',
            property: 'spriteFrame',
            value: 'new-frame-uuid'
        });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'query-node', 'sprite-123');
    });

    // Get info action tests
    it('get_info returns error when nodeUuid is missing', async () => {
        const result = await tool.execute('get_info', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/nodeUuid/i);
    });

    it('get_info calls Editor.Message.request to query node', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const nodeData = { name: 'UINode', __comps__: [{ __type__: 'cc.Label', string: 'Hello' }] };
        mockRequest.mockResolvedValueOnce(nodeData);

        const result = await tool.execute('get_info', { nodeUuid: 'ui-node-123' });

        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'query-node', 'ui-node-123');
    });

    // List UI nodes action tests
    it('list_ui_nodes calls Editor.Message.request to query node tree', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        // query-node-tree returns the tree structure
        mockRequest.mockResolvedValueOnce({ uuid: 'root', name: 'Scene', children: [] });

        const result = await tool.execute('list_ui_nodes', {});

        expect(result.success).toBe(true);
        expect((result.data as any).uiNodes).toBeDefined();
        expect((result.data as any).count).toBeDefined();
        expect(mockRequest).toHaveBeenCalledWith('scene', 'query-node-tree');
    });
});
