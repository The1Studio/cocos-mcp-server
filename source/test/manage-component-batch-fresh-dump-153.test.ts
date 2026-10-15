import { ManageComponent } from '../tools/manage-component';

/**
 * Issue #153 — `set_properties_batch` resolved the target component ONCE and then analysed
 * every entry against that pre-batch dump, so an entry that depended on an earlier entry's
 * write (the second element appended to an array, a field of a just-grown structure) was
 * judged against state the editor no longer had and failed with "index N is out of range"
 * while the same writes issued as separate `set_property` calls succeeded.
 *
 * The batch now re-reads the component after a write before it analyses the next entry.
 */
describe('ManageComponent set_properties_batch — each entry sees the previous entry\'s write (#153)', () => {
    const NODE_UUID = 'node-1';
    const COMP_TYPE = 'TestController';
    let tool: ManageComponent;

    function emptyLabelsDump() {
        return {
            __comps__: [{
                __type__: COMP_TYPE, type: COMP_TYPE, enabled: true,
                value: {
                    uuid: { value: 'comp-uuid-1' },
                    labels: { name: 'labels', type: 'String', isArray: true, value: [] as any[] }
                }
            }]
        };
    }

    /** query-node returns the live dump; set-property grows (`.length`) or writes an element. */
    function arrayMock(mockRequest: jest.Mock) {
        const dump = emptyLabelsDump();
        const labels = dump.__comps__[0].value.labels.value;
        mockRequest.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node') return Promise.resolve(JSON.parse(JSON.stringify(dump)));
            if (action === 'set-property') {
                const last = payload.path.split('.').pop() as string;
                if (last === 'length') {
                    while (labels.length < payload.dump.value) labels.push({ value: '', type: 'String' });
                } else {
                    labels[Number(last)].value = payload.dump.value;
                }
            }
            return Promise.resolve({});
        });
        return labels;
    }

    beforeEach(() => {
        tool = new ManageComponent();
        jest.clearAllMocks();
    });

    it('appends two elements to an array in one batch', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const labels = arrayMock(mockRequest);

        const result = await tool.execute('set_properties_batch', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            properties: [
                { property: 'labels.0', propertyType: 'string', value: 'first' },
                { property: 'labels.1', propertyType: 'string', value: 'second' }
            ]
        });

        expect(result.data.results.map((r: any) => [r.property, r.success, r.error])).toEqual([
            ['labels.0', true, undefined],
            ['labels.1', true, undefined]
        ]);
        expect(result.data.failed).toBe(0);
        expect(labels.map((l: any) => l.value)).toEqual(['first', 'second']);
    });

    it('the same two writes issued as set_property calls succeed (baseline)', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        const labels = arrayMock(mockRequest);

        const first = await tool.execute('set_property', { nodeUuid: NODE_UUID, componentType: COMP_TYPE, property: 'labels.0', propertyType: 'string', value: 'first' });
        const second = await tool.execute('set_property', { nodeUuid: NODE_UUID, componentType: COMP_TYPE, property: 'labels.1', propertyType: 'string', value: 'second' });

        expect(first.success).toBe(true);
        expect(second.success).toBe(true);
        expect(labels.map((l: any) => l.value)).toEqual(['first', 'second']);
    });

    it('reports an unreadable component between entries as that entry\'s error, not a stale success', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        arrayMock(mockRequest);
        const base = mockRequest.getMockImplementation() as (...a: any[]) => Promise<any>;
        let setWrites = 0;
        mockRequest.mockImplementation((m: string, action: string, payload: any) => {
            if (action === 'set-property') setWrites++;
            // After the first entry's writes, the component disappears from the node.
            if (action === 'query-node' && setWrites >= 2) return Promise.resolve({ __comps__: [] });
            return base(m, action, payload);
        });

        const result = await tool.execute('set_properties_batch', {
            nodeUuid: NODE_UUID,
            componentType: COMP_TYPE,
            properties: [
                { property: 'labels.0', propertyType: 'string', value: 'first' },
                { property: 'labels.1', propertyType: 'string', value: 'second' }
            ]
        });

        const second = result.data.results.find((r: any) => r.property === 'labels.1');
        expect(second.success).toBe(false);
        expect(second.error).toMatch(/not found on node/i);
    });
});
