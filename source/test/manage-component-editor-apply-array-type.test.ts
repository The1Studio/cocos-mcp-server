/**
 * Regression tests for issue #18 — array-valued propertyTypes silently fail to apply.
 *
 * `nodeArray` sent `dump: { value: processedValue }` with no `type`/`isArray`/
 * `elementTypeData` — the editor's set-property dump has no way to know this is an
 * array of cc.Node references, so it silently did not apply (same failure mode the
 * asset-reference types had before they gained an explicit `type` field).
 *
 * `componentArray` did not exist at all — there was no way to set an array of
 * component references (only a single one via propertyType "component").
 */

import { applyPropertyToEditor } from '../tools/manage-component-editor-apply';
import { ActionToolResult, successResult, errorResult } from '../types';

declare const global: any;

const baseArgs = {
    nodeUuid: 'node-uuid-1',
    propertyPath: '__comps__.0.someProp',
    rawComponentIndex: 0,
    componentType: 'MyScript',
};

let requestMock: jest.Mock;
let getComponentInfo: jest.Mock;

beforeEach(() => {
    requestMock = jest.fn().mockResolvedValue(undefined);
    global.Editor = { Message: { request: requestMock } };
    getComponentInfo = jest.fn();
});

describe('applyPropertyToEditor — nodeArray carries an explicit array dump (issue #18)', () => {
    it('sends type/isArray/elementTypeData instead of a bare value', async () => {
        const processedValue = [{ uuid: 'node-a' }, { uuid: 'node-b' }];
        await applyPropertyToEditor(
            { ...baseArgs, property: 'linkedNodes', propertyType: 'nodeArray', value: ['node-a', 'node-b'], processedValue },
            getComponentInfo
        );

        expect(requestMock).toHaveBeenCalledTimes(1);
        const payload = requestMock.mock.calls[0][2];
        expect(payload.dump).toEqual({
            value: processedValue,
            type: 'cc.Node',
            isArray: true,
            elementTypeData: { value: null, type: 'cc.Node' }
        });
    });

    it('applies an empty nodeArray with the same explicit shape', async () => {
        await applyPropertyToEditor(
            { ...baseArgs, property: 'linkedNodes', propertyType: 'nodeArray', value: [], processedValue: [] },
            getComponentInfo
        );

        const payload = requestMock.mock.calls[0][2];
        expect(payload.dump).toEqual({ value: [], type: 'cc.Node', isArray: true, elementTypeData: { value: null, type: 'cc.Node' } });
    });
});

describe('applyPropertyToEditor — componentArray (new propertyType, issue #18)', () => {
    function mockSourcePropertyMeta(componentType: string) {
        getComponentInfo.mockImplementation((nodeUuid: string, type: string): Promise<ActionToolResult> => {
            if (nodeUuid === baseArgs.nodeUuid && type === baseArgs.componentType) {
                return Promise.resolve(successResult({
                    properties: { waypoints: { name: 'waypoints', type: componentType, value: [] } }
                }));
            }
            return Promise.resolve(errorResult('not found'));
        });
    }

    it('resolves each target node to its component id and writes ONE array set-property call', async () => {
        mockSourcePropertyMeta('WaypointMarker');
        requestMock.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node' && payload === 'target-node-1') {
                return Promise.resolve({ __comps__: [{ type: 'WaypointMarker', value: { uuid: { value: 'comp-id-1' } } }] });
            }
            if (action === 'query-node' && payload === 'target-node-2') {
                return Promise.resolve({ __comps__: [{ type: 'WaypointMarker', value: { uuid: { value: 'comp-id-2' } } }] });
            }
            return Promise.resolve({});
        });

        const result = await applyPropertyToEditor(
            {
                ...baseArgs, property: 'waypoints', propertyType: 'componentArray',
                value: ['target-node-1', 'target-node-2'], processedValue: ['target-node-1', 'target-node-2']
            },
            getComponentInfo
        );

        // Exactly one set-property call carrying the whole resolved array — NOT N separate writes.
        const setCalls = requestMock.mock.calls.filter((c: any[]) => c[1] === 'set-property');
        expect(setCalls.length).toBe(1);
        expect(setCalls[0][2].dump).toEqual({
            value: [{ uuid: 'comp-id-1' }, { uuid: 'comp-id-2' }],
            isArray: true,
            elementTypeData: { value: null, type: 'WaypointMarker' }
        });
        expect(result).toEqual([{ uuid: 'comp-id-1' }, { uuid: 'comp-id-2' }]);
    });

    it('guards the empty-array case: writes an empty array without resolving any element', async () => {
        mockSourcePropertyMeta('WaypointMarker');

        const result = await applyPropertyToEditor(
            { ...baseArgs, property: 'waypoints', propertyType: 'componentArray', value: [], processedValue: [] },
            getComponentInfo
        );

        expect(getComponentInfo).not.toHaveBeenCalled();
        expect(requestMock).toHaveBeenCalledTimes(1);
        const payload = requestMock.mock.calls[0][2];
        expect(payload.dump).toEqual({ value: [], isArray: true, elementTypeData: { value: null, type: 'cc.Component' } });
        expect(result).toEqual([]);
    });

    it('throws when a componentArray item is not a string node UUID', async () => {
        mockSourcePropertyMeta('WaypointMarker');

        await expect(applyPropertyToEditor(
            { ...baseArgs, property: 'waypoints', propertyType: 'componentArray', value: [123], processedValue: [123] },
            getComponentInfo
        )).rejects.toThrow(/must be string node UUIDs/);
    });
});
