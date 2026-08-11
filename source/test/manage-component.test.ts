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

    /**
     * A `query-node` mock that mutates a cloned dump in place when `set-property` is
     * called, so the tool's post-write verification re-read (issue #34 — `set_property`
     * previously reported success without checking the write actually persisted)
     * reflects the write instead of always reading back the pre-write value.
     *
     * `path` is of the form `__comps__.<index>.<segment>[.<segment>...]`. Flat fields
     * store their value directly (`{ name, value, type }`); nested CCClass groups nest
     * one level deeper under `.value` (see `makeNodeDump()`'s `cameraSection`).
     */
    function statefulComponentMock(mockRequest: jest.Mock, initialDump: any, extra?: (action: string, payload: any) => any) {
        const dump = JSON.parse(JSON.stringify(initialDump));
        mockRequest.mockImplementation((_module: string, action: string, payload: any) => {
            if (action === 'query-node') return Promise.resolve(dump);
            if (action === 'set-property') {
                const segments: string[] = payload.path.split('.');
                const compIndex = Number(segments[1]);
                let cursor: any = dump.__comps__[compIndex].value;
                for (let i = 2; i < segments.length; i++) {
                    const isLeaf = i === segments.length - 1;
                    const seg = segments[i];
                    if (isLeaf) {
                        cursor[seg].value = payload.dump.value;
                    } else {
                        cursor = cursor[seg].value;
                    }
                }
                return Promise.resolve({});
            }
            if (extra) {
                const result = extra(action, payload);
                if (result !== undefined) return Promise.resolve(result);
            }
            return Promise.resolve({});
        });
        return dump;
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
        // query-node reflects each set-property write, so post-write verification passes.
        statefulComponentMock(mockRequest, makeNodeDump());

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
        statefulComponentMock(mockRequest, makeNodeDump());

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
        statefulComponentMock(mockRequest, dump);

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
        statefulComponentMock(mockRequest, dump, (action, payload) => {
            if (action === 'execute-scene-script' && payload?.method === 'resolveComponentByName') {
                return { success: true, data: { index: 0, className: 'Match3BoardController' } };
            }
            return undefined;
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
        statefulComponentMock(mockRequest, makeNodeDump());

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

    // Regression: issue #34 — applySingleProperty returned `{ success: true }` unconditionally,
    // discarding the verification.verified read-back it had just computed. A write that the
    // editor silently did not persist (e.g. a resolved `set-property` promise on a readonly-in-
    // this-context field) was reported as a success.
    it('set_property reports failure when the write does not verify', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        // query-node ALWAYS returns the original dump — simulates a set-property call that
        // resolves but never actually persists on the editor side.
        mockRequest.mockImplementation((_module: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(makeNodeDump());
            if (action === 'set-property') return Promise.resolve({});
            return Promise.resolve({});
        });

        const result = await tool.execute('set_property', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            property: 'title',
            propertyType: 'string',
            value: 'New Title'
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/did not verify/i);
    });
});
