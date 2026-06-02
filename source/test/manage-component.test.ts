import { ManageComponent } from '../tools/manage-component';

/**
 * Tests for ManageComponent — focused on the set_properties_batch action (issue #44)
 * and dotted nested-CCClass path support shared by set_property and the batch variant.
 */
describe('ManageComponent', () => {
    let tool: ManageComponent;

    const NODE_UUID = 'node-1';
    const COMP_TYPE = 'TestController';

    // A node dump with one TestController component exposing:
    //  - a flat field `title` (string)
    //  - a nested CCClass group `cameraSection` containing `mainCamera` (node ref) and `fov` (number)
    function makeNodeDump() {
        return {
            __comps__: [
                {
                    __type__: COMP_TYPE,
                    type: COMP_TYPE,
                    enabled: true,
                    value: {
                        uuid: { value: 'comp-uuid-1' },
                        title: { name: 'title', value: 'Hello', type: 'String' },
                        cameraSection: {
                            name: 'cameraSection',
                            type: 'CameraSection',
                            value: {
                                mainCamera: { name: 'mainCamera', value: null, type: 'cc.Node' },
                                fov: { name: 'fov', value: 60, type: 'Number' }
                            }
                        }
                    }
                }
            ]
        };
    }

    beforeEach(() => {
        tool = new ManageComponent();
        jest.clearAllMocks();
    });

    it('has correct name', () => {
        expect(tool.name).toBe('manage_component');
    });

    it('exposes set_properties_batch in actions and schema enum', () => {
        expect(tool.actions).toContain('set_properties_batch');
        const actionEnum = (tool.inputSchema as any).properties.action.enum;
        expect(actionEnum).toContain('set_properties_batch');
        expect((tool.inputSchema as any).properties).toHaveProperty('properties');
        expect((tool.inputSchema as any).properties.properties.type).toBe('array');
    });

    it('still exposes set_property', () => {
        expect(tool.actions).toContain('set_property');
    });

    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    it('set_properties_batch requires a non-empty properties array', async () => {
        const result = await tool.execute('set_properties_batch', { nodeUuid: NODE_UUID, componentType: COMP_TYPE });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/non-empty array/i);
    });

    it('set_properties_batch sets multiple fields in one call and reports per-field success', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        // Every query-node returns the same dump; set-property resolves; verification re-reads dump.
        mockRequest.mockImplementation((_module: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeNodeDump());
            if (action === 'set-property') return Promise.resolve({});
            return Promise.resolve({});
        });

        const result = await tool.execute('set_properties_batch', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            properties: [
                { property: 'title', propertyType: 'string', value: 'New Title' },
                { property: 'cameraSection.fov', propertyType: 'number', value: 90 }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.data.total).toBe(2);
        expect(result.data.succeeded).toBe(2);
        expect(result.data.failed).toBe(0);
        expect(result.data.results.map((r: any) => r.property)).toEqual(['title', 'cameraSection.fov']);
        // A dotted-path field must have been applied via the nested __comps__ path.
        const setCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'set-property');
        const paths = setCalls.map((c: any[]) => c[2].path);
        expect(paths).toContain('__comps__.0.cameraSection.fov');
        expect(paths).toContain('__comps__.0.title');
    });

    it('set_properties_batch does not abort on a single bad field', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockImplementation((_module: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeNodeDump());
            if (action === 'set-property') return Promise.resolve({});
            return Promise.resolve({});
        });

        const result = await tool.execute('set_properties_batch', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            properties: [
                { property: 'title', propertyType: 'string', value: 'OK' },
                { property: 'doesNotExist', propertyType: 'string', value: 'X' }, // bad: not on component
                { property: 'cameraSection.fov', propertyType: 'number', value: 75 }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.data.total).toBe(3);
        expect(result.data.succeeded).toBe(2);
        expect(result.data.failed).toBe(1);
        const bad = result.data.results.find((r: any) => r.property === 'doesNotExist');
        expect(bad.success).toBe(false);
        expect(bad.error).toMatch(/not found/i);
        // The good fields after the bad one still ran.
        const good = result.data.results.find((r: any) => r.property === 'cameraSection.fov');
        expect(good.success).toBe(true);
    });

    it('set_properties_batch errors cleanly when the component is missing', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockImplementation((_module: string, action: string) => {
            if (action === 'query-node') return Promise.resolve({ __comps__: [] });
            return Promise.resolve({});
        });

        const result = await tool.execute('set_properties_batch', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            properties: [{ property: 'title', propertyType: 'string', value: 'X' }]
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found on node/i);
    });

    it('set_property still supports a dotted nested CCClass path end-to-end', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockImplementation((_module: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeNodeDump());
            if (action === 'set-property') return Promise.resolve({});
            return Promise.resolve({});
        });

        const result = await tool.execute('set_property', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            property: 'cameraSection.fov',
            propertyType: 'number',
            value: 120
        });

        expect(result.success).toBe(true);
        expect(result.data.property).toBe('cameraSection.fov');
        const setCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'set-property');
        expect(setCalls.some((c: any[]) => c[2].path === '__comps__.0.cameraSection.fov')).toBe(true);
    });
});
