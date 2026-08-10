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

    // Regression: theonekit-cocos#62 — set_property with a vec3 {x,y,z} object value.
    // set_property and set_properties_batch share applySingleProperty/convertPropertyValue,
    // so a valid vec3 object must be accepted (it was previously rejected on this path).
    it('set_property accepts a vec3 {x,y,z} object value', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const dump = {
            __comps__: [
                {
                    __type__: 'cc.BoxCollider', type: 'cc.BoxCollider', enabled: true,
                    value: { uuid: { value: 'c1' }, size: { name: 'size', value: { x: 1, y: 1, z: 1 }, type: 'cc.Vec3' } }
                }
            ]
        };
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(dump);
            return Promise.resolve({});
        });

        const result = await tool.execute('set_property', {
            nodeUuid: NODE_UUID, componentType: 'cc.BoxCollider',
            property: 'size', propertyType: 'vec3', value: { x: 2, y: 3, z: 4 }
        });

        expect(result.success).toBe(true);
        const setCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'set-property');
        expect(setCalls.length).toBeGreaterThan(0);
    });

    // Regression: theonekit-cocos#62 — set_property with the script CLASS NAME as
    // componentType. The dump exposes a cid, so the class name is resolved via the
    // scene script (resolveComponentByName) and mapped to the raw __comps__ index.
    it('set_property resolves a class-name componentType via the scene script', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const CID = '8575caQ9/JPuZXXSk7zJTxS';
        const dump = {
            __comps__: [
                {
                    __type__: CID, type: CID, enabled: true,
                    value: { uuid: { value: 'c1' }, speed: { name: 'speed', value: 1, type: 'Number' } }
                }
            ]
        };
        mockRequest.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node') return Promise.resolve(dump);
            if (action === 'execute-scene-script' && payload?.method === 'resolveComponentByName') {
                return Promise.resolve({ success: true, data: { index: 0, className: 'Match3BoardController' } });
            }
            return Promise.resolve({});
        });

        const result = await tool.execute('set_property', {
            nodeUuid: NODE_UUID, componentType: 'Match3BoardController',
            property: 'speed', propertyType: 'number', value: 5
        });

        expect(result.success).toBe(true);
        const setCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'set-property');
        expect(setCalls.some((c: any[]) => c[2].path === '__comps__.0.speed')).toBe(true);
    });

    it('set_property errors when a class-name componentType resolves to nothing', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const dump = { __comps__: [{ __type__: 'cc.Sprite', type: 'cc.Sprite', enabled: true, value: {} }] };
        mockRequest.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node') return Promise.resolve(dump);
            if (action === 'execute-scene-script' && payload?.method === 'resolveComponentByName') {
                return Promise.resolve({ success: false, error: 'Component type NopeController not found' });
            }
            return Promise.resolve({});
        });

        const result = await tool.execute('set_property', {
            nodeUuid: NODE_UUID, componentType: 'NopeController',
            property: 'speed', propertyType: 'number', value: 5
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found on node/i);
    });

    // Regression: 'remove' passed the NODE uuid to the editor's remove-component, but
    // RemoveComponentOptions is { uuid: <COMPONENT uuid> } (its `component` field is an
    // unused parameter), so the editor rejected every removal. The tool must resolve the
    // component's own uuid from the dump and send THAT.
    function makeRemovableDump(remaining?: string[]) {
        const comps = [
            { __type__: 'cc.UITransform', enabled: true, value: { uuid: { value: 'comp-uitransform' } } },
            { __type__: 'cc.MissingScript', enabled: true, value: { uuid: { value: 'comp-missing' } } }
        ];
        if (!remaining) return { __comps__: comps };
        return { __comps__: comps.filter(c => remaining.includes(c.value.uuid.value)) };
    }

    it('get_all exposes each component own uuid from the dump', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeRemovableDump());
            return Promise.resolve({});
        });

        const result = await tool.execute('get_all', { nodeUuid: NODE_UUID });

        expect(result.success).toBe(true);
        expect(result.data.components.map((c: any) => c.uuid)).toEqual(['comp-uitransform', 'comp-missing']);
    });

    it('remove sends the COMPONENT uuid (not the node uuid) to remove-component', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        let removed = false;
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(removed ? makeRemovableDump(['comp-uitransform']) : makeRemovableDump());
            if (action === 'remove-component') { removed = true; return Promise.resolve({}); }
            return Promise.resolve({});
        });

        const result = await tool.execute('remove', { nodeUuid: NODE_UUID, componentType: 'cc.MissingScript' });

        expect(result.success).toBe(true);
        expect(result.data.componentUuid).toBe('comp-missing');
        const removeCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'remove-component');
        expect(removeCalls.length).toBe(1);
        expect(removeCalls[0][2]).toEqual({ uuid: 'comp-missing' });
    });

    it('remove also accepts a component uuid directly (backward compatible)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        let removed = false;
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(removed ? makeRemovableDump(['comp-uitransform']) : makeRemovableDump());
            if (action === 'remove-component') { removed = true; return Promise.resolve({}); }
            return Promise.resolve({});
        });

        const result = await tool.execute('remove', { nodeUuid: NODE_UUID, componentType: 'comp-missing' });

        expect(result.success).toBe(true);
        const removeCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'remove-component');
        expect(removeCalls[0][2]).toEqual({ uuid: 'comp-missing' });
    });

    it('remove reports failure when the component is still present afterwards', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeRemovableDump());
            return Promise.resolve({});
        });

        const result = await tool.execute('remove', { nodeUuid: NODE_UUID, componentType: 'cc.MissingScript' });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/was not removed/i);
    });

    it('remove errors with the available list when the component is absent', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeRemovableDump(['comp-uitransform']));
            return Promise.resolve({});
        });

        const result = await tool.execute('remove', { nodeUuid: NODE_UUID, componentType: 'cc.MissingScript' });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found on node/i);
        expect(result.error).toMatch(/cc\.UITransform/);
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

    /**
     * action=add on a custom `@ccclass` script.
     *
     * The editor's `create-component` accepts the readable class name, but `query-node`
     * lists the component under its COMPRESSED CID — the first five hex characters of the
     * script asset uuid plus a base64 tail. Matching the caller's class name against that
     * cid never succeeds, so a successful add was reported as a failure and the "already
     * exists" pre-check never fired either. The class name survives in exactly one place
     * in the dump: `value.name`, formatted `${nodeName}<${className}>`.
     */
    describe('add — custom @ccclass scripts listed by cid', () => {
        const SCRIPT_CLASS = 'HeroDragController';
        const SCRIPT_CID = '24d05TGdPBKkICc8RTV2vQZ';

        /** A node dump whose only script component is exposed under its cid. */
        function dumpWithScript() {
            return {
                __comps__: [
                    {
                        __type__: SCRIPT_CID,
                        enabled: true,
                        value: {
                            uuid: { value: 'script-comp-uuid' },
                            name: { value: `Gameplay<${SCRIPT_CLASS}>` }
                        }
                    }
                ]
            };
        }

        it('reports success when the added script is listed under its cid, not its class name', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            let created = false;
            mockRequest.mockImplementation((_module: string, action: string) => {
                if (action === 'create-component') {
                    created = true;
                    return Promise.resolve({});
                }
                if (action === 'query-node') {
                    return Promise.resolve(created ? dumpWithScript() : { __comps__: [] });
                }
                return Promise.resolve({});
            });

            const result = await tool.execute('add', { nodeUuid: NODE_UUID, componentType: SCRIPT_CLASS });

            expect(result.success).toBe(true);
            expect(result.data.componentVerified).toBe(true);
            expect(result.data.existing).toBe(false);
        });

        // The caller's next call needs the cid (get_info / set_property / remove all take it),
        // so returning it here is what stops them going hunting for it.
        it('returns the resolved cid and the component uuid so the caller can address it', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            let created = false;
            mockRequest.mockImplementation((_module: string, action: string) => {
                if (action === 'create-component') {
                    created = true;
                    return Promise.resolve({});
                }
                if (action === 'query-node') {
                    return Promise.resolve(created ? dumpWithScript() : { __comps__: [] });
                }
                return Promise.resolve({});
            });

            const result = await tool.execute('add', { nodeUuid: NODE_UUID, componentType: SCRIPT_CLASS });

            expect(result.data.resolvedType).toBe(SCRIPT_CID);
            expect(result.data.componentUuid).toBe('script-comp-uuid');
        });

        // The dangerous half of the bug: a caller who reads the false failure and retries
        // silently ends up with two copies of the component on the node.
        it('does not add a duplicate when the script is already present under its cid', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockImplementation((_module: string, action: string) => {
                if (action === 'query-node') return Promise.resolve(dumpWithScript());
                return Promise.resolve({});
            });

            const result = await tool.execute('add', { nodeUuid: NODE_UUID, componentType: SCRIPT_CLASS });

            expect(result.success).toBe(true);
            expect(result.data.existing).toBe(true);
            const createCalls = mockRequest.mock.calls.filter((c: any[]) => c[1] === 'create-component');
            expect(createCalls).toHaveLength(0);
        });

        it('still matches a built-in component by its exact type', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockImplementation((_module: string, action: string) => {
                if (action === 'query-node') {
                    return Promise.resolve({
                        __comps__: [{ __type__: 'cc.Sprite', enabled: true, value: { uuid: { value: 'sprite-uuid' } } }]
                    });
                }
                return Promise.resolve({});
            });

            const result = await tool.execute('add', { nodeUuid: NODE_UUID, componentType: 'cc.Sprite' });

            expect(result.success).toBe(true);
            expect(result.data.existing).toBe(true);
        });

        // A genuinely failed add must stay a failure — the fix must not make `add` optimistic.
        it('still reports a failure when the component really is absent afterwards', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockImplementation((_module: string, action: string) => {
                if (action === 'query-node') return Promise.resolve({ __comps__: [] });
                return Promise.resolve({});
            });

            const result = await tool.execute('add', { nodeUuid: NODE_UUID, componentType: SCRIPT_CLASS });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found on node after addition/i);
        });
    });
});
