/**
 * Regression tests — an array of ASSET references could not be written at all.
 *
 * `AudioContainer.audioList` (`@property({ type: [AudioClip] })`) was unwritable: every
 * asset-reference propertyType rejects an array ("asset value must be a string UUID"),
 * and no array propertyType carried asset elements (nodeArray/componentArray resolve
 * nodes/components, not assets). `assetArray` takes a string[] of asset UUIDs and writes
 * the whole array in ONE set-property call with the property's DECLARED element type.
 */

import { applyPropertyToEditor } from '../tools/manage-component-editor-apply';
import { convertPropertyValue, SUPPORTED_PROPERTY_TYPES, verifyComponentPropertyChange } from '../tools/manage-component-property-helpers';
import { ActionToolResult, successResult, errorResult } from '../types';

declare const global: any;

const baseArgs = {
    nodeUuid: 'node-uuid-1',
    propertyPath: '__comps__.0.audioList',
    rawComponentIndex: 0,
    componentType: 'AudioContainer',
    property: 'audioList',
    propertyType: 'assetArray',
};

let requestMock: jest.Mock;
let getComponentInfo: jest.Mock;

function mockDeclaredMeta(meta: any) {
    getComponentInfo.mockImplementation((nodeUuid: string, type: string): Promise<ActionToolResult> => {
        if (nodeUuid === baseArgs.nodeUuid && type === baseArgs.componentType) {
            return Promise.resolve(successResult({ properties: { audioList: meta } }));
        }
        return Promise.resolve(errorResult('not found'));
    });
}

beforeEach(() => {
    requestMock = jest.fn().mockResolvedValue(undefined);
    global.Editor = { Message: { request: requestMock } };
    getComponentInfo = jest.fn();
});

describe('convertPropertyValue — assetArray', () => {
    it('is a supported propertyType (so the tool schema enum accepts it)', () => {
        expect(SUPPORTED_PROPERTY_TYPES).toContain('assetArray');
    });

    it('maps a string[] of uuids to { uuid } references, order preserved', () => {
        expect(convertPropertyValue('assetArray', ['a-1', 'b-2'])).toEqual([{ uuid: 'a-1' }, { uuid: 'b-2' }]);
    });

    it('accepts a JSON-encoded array string', () => {
        expect(convertPropertyValue('assetArray', '["a-1","b-2"]')).toEqual([{ uuid: 'a-1' }, { uuid: 'b-2' }]);
    });

    it('treats null / "" / [] as clearing the array', () => {
        expect(convertPropertyValue('assetArray', null)).toEqual([]);
        expect(convertPropertyValue('assetArray', '')).toEqual([]);
        expect(convertPropertyValue('assetArray', [])).toEqual([]);
    });

    it('rejects a non-string element, naming its type', () => {
        expect(() => convertPropertyValue('assetArray', ['a-1', 42])).toThrow(/assetArray items must be string asset UUIDs/);
    });

    it('rejects a bare (non-array) uuid string', () => {
        expect(() => convertPropertyValue('assetArray', 'a-1')).toThrow(/assetArray value must be an array/);
    });
});

describe('applyPropertyToEditor — assetArray', () => {
    // Live finding: a bare `{ uuid }` element makes the editor throw
    // "Cannot read properties of undefined (reading 'hasOwnProperty')" — each element must
    // be a full dump `{ value: { uuid }, type }`, the shape query-node itself returns.
    it('writes ONE array dump whose elements are typed element dumps', async () => {
        mockDeclaredMeta({ name: 'audioList', type: 'cc.AudioClip', isArray: true, elementTypeData: { type: 'cc.AudioClip' }, value: [] });
        const processedValue = [{ uuid: 'clip-1' }, { uuid: 'clip-2' }];

        await applyPropertyToEditor({ ...baseArgs, value: ['clip-1', 'clip-2'], processedValue }, getComponentInfo);

        expect(requestMock).toHaveBeenCalledTimes(1);
        const [channel, action, payload] = requestMock.mock.calls[0];
        expect([channel, action]).toEqual(['scene', 'set-property']);
        expect(payload).toEqual({
            uuid: 'node-uuid-1',
            path: '__comps__.0.audioList',
            dump: {
                value: [
                    { value: { uuid: 'clip-1' }, type: 'cc.AudioClip' },
                    { value: { uuid: 'clip-2' }, type: 'cc.AudioClip' }
                ],
                type: 'cc.AudioClip', isArray: true,
                elementTypeData: { value: { uuid: '' }, type: 'cc.AudioClip' }
            }
        });
    });

    it('falls back to the declared array type when the dump has no elementTypeData', async () => {
        mockDeclaredMeta({ name: 'audioList', type: 'cc.AudioClip', isArray: true, value: [] });
        await applyPropertyToEditor({ ...baseArgs, value: ['clip-1'], processedValue: [{ uuid: 'clip-1' }] }, getComponentInfo);
        expect(requestMock.mock.calls[0][2].dump.elementTypeData.type).toBe('cc.AudioClip');
    });

    it('falls back to cc.Asset when the declared type cannot be read', async () => {
        getComponentInfo.mockResolvedValue(errorResult('not found'));
        await applyPropertyToEditor({ ...baseArgs, value: [], processedValue: [] }, getComponentInfo);
        expect(requestMock.mock.calls[0][2].dump).toEqual({
            value: [], type: 'cc.Asset', isArray: true, elementTypeData: { value: { uuid: '' }, type: 'cc.Asset' }
        });
    });
});

describe('verifyComponentPropertyChange — asset array read-back', () => {
    // Live finding: the editor reads an asset array back as element DUMPS
    // (`{ value: { uuid }, type, ... }`), not bare `{ uuid }` refs. Comparing only the
    // top-level `uuid` key reported a write that landed as "did not verify".
    it('verifies when each read-back element wraps its ref in a dump', async () => {
        mockDeclaredMeta({
            name: 'audioList', type: 'cc.AudioClip', isArray: true,
            value: [
                { value: { uuid: 'clip-1' }, default: null, type: 'cc.AudioClip' },
                { value: { uuid: 'clip-2' }, default: null, type: 'cc.AudioClip' }
            ]
        });
        const result = await verifyComponentPropertyChange(
            baseArgs.nodeUuid, baseArgs.componentType, 'audioList', [], [{ uuid: 'clip-1' }, { uuid: 'clip-2' }], getComponentInfo
        );
        expect(result.verified).toBe(true);
    });

    it('still fails when a read-back element holds a different uuid', async () => {
        mockDeclaredMeta({
            name: 'audioList', type: 'cc.AudioClip', isArray: true,
            value: [{ value: { uuid: 'clip-1' }, type: 'cc.AudioClip' }, { value: { uuid: 'other' }, type: 'cc.AudioClip' }]
        });
        const result = await verifyComponentPropertyChange(
            baseArgs.nodeUuid, baseArgs.componentType, 'audioList', [], [{ uuid: 'clip-1' }, { uuid: 'clip-2' }], getComponentInfo
        );
        expect(result.verified).toBe(false);
    });
});
