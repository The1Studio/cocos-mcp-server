/**
 * `propertyType: "component"` must accept BOTH spellings of the target.
 *
 * The resolver only ever called `query-node` on the value, so a caller who passed the
 * COMPONENT's own uuid — the `uuid` field that `manage_component get_all` / `get_info`
 * hand back, and the obvious thing to reach for when wiring a `@property(SomeComponent)`
 * reference — got `Target node <uuid> not found or has no components`. That error reads
 * as "wrong uuid" when the uuid was right and only the KIND was wrong, so the usual next
 * move is to go hunting for a uuid that does not exist.
 */

import { applyPropertyToEditor } from '../tools/manage-component-editor-apply';

declare const global: any;

const NODE_UUID = 'holder-node-uuid';
const TARGET_NODE_UUID = 'target-node-uuid';
const TARGET_COMPONENT_UUID = 'target-component-uuid';
const EXPECTED_TYPE = 'HeroDragController';

const baseArgs = {
    nodeUuid: NODE_UUID,
    propertyPath: '__comps__.0.heroDrag',
    rawComponentIndex: 0,
    componentType: 'GameBootstrap',
    property: 'heroDrag',
    propertyType: 'component'
};

/** The holder component's dump — supplies the @property declared type for `heroDrag`. */
const getComponentInfo = jest.fn().mockResolvedValue({
    success: true,
    data: { properties: { heroDrag: { name: 'heroDrag', value: { uuid: '' }, type: EXPECTED_TYPE } } }
});

/** A node dump holding one component of the expected type. */
function targetNodeDump() {
    return {
        __comps__: [
            { type: EXPECTED_TYPE, value: { uuid: { value: TARGET_COMPONENT_UUID } } }
        ]
    };
}

/** What `query-component` returns for the component's own uuid. */
function targetComponentDump() {
    return {
        type: EXPECTED_TYPE,
        value: {
            uuid: { value: TARGET_COMPONENT_UUID },
            name: { value: `Gameplay<${EXPECTED_TYPE}>` }
        }
    };
}

let requestMock: jest.Mock;

beforeEach(() => {
    requestMock = jest.fn();
    global.Editor = { Message: { request: requestMock } };
});

/** The dump payload of the single `set-property` call. */
function setPropertyPayload() {
    const calls = requestMock.mock.calls.filter((c: any[]) => c[1] === 'set-property');
    expect(calls).toHaveLength(1);
    return calls[0][2];
}

describe('applyPropertyToEditor — component references', () => {
    // Regression guard: the node-uuid spelling is the documented one and must not change.
    it('still resolves a NODE uuid to the component it holds', async () => {
        requestMock.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(targetNodeDump());
            return Promise.resolve(undefined);
        });

        const result = await applyPropertyToEditor(
            { ...baseArgs, value: TARGET_NODE_UUID, processedValue: TARGET_NODE_UUID },
            getComponentInfo
        );

        expect(setPropertyPayload().dump).toEqual({
            value: { uuid: TARGET_COMPONENT_UUID }, type: EXPECTED_TYPE
        });
        expect(result).toEqual({ uuid: TARGET_COMPONENT_UUID });
    });

    it('accepts the COMPONENT uuid when the value is not a node', async () => {
        requestMock.mockImplementation((_m: string, action: string, arg: any) => {
            if (action === 'query-node') return Promise.resolve(undefined);
            if (action === 'query-component' && arg === TARGET_COMPONENT_UUID) {
                return Promise.resolve(targetComponentDump());
            }
            return Promise.resolve(undefined);
        });

        const result = await applyPropertyToEditor(
            { ...baseArgs, value: TARGET_COMPONENT_UUID, processedValue: TARGET_COMPONENT_UUID },
            getComponentInfo
        );

        expect(setPropertyPayload().dump).toEqual({
            value: { uuid: TARGET_COMPONENT_UUID }, type: EXPECTED_TYPE
        });
        expect(result).toEqual({ uuid: TARGET_COMPONENT_UUID });
    });

    // `query-node` rejects rather than resolving falsy on some editor builds.
    it('accepts the COMPONENT uuid when query-node throws instead of returning nothing', async () => {
        requestMock.mockImplementation((_m: string, action: string, arg: any) => {
            if (action === 'query-node') return Promise.reject(new Error('node not found'));
            if (action === 'query-component' && arg === TARGET_COMPONENT_UUID) {
                return Promise.resolve(targetComponentDump());
            }
            return Promise.resolve(undefined);
        });

        const result = await applyPropertyToEditor(
            { ...baseArgs, value: TARGET_COMPONENT_UUID, processedValue: TARGET_COMPONENT_UUID },
            getComponentInfo
        );

        expect(result).toEqual({ uuid: TARGET_COMPONENT_UUID });
    });

    // Without a declared type on the property, the component's own dump supplies it.
    it('falls back to the target component own type when the property declares none', async () => {
        const untyped = jest.fn().mockResolvedValue({
            success: true, data: { properties: { heroDrag: { name: 'heroDrag', type: 'Unknown', extends: [] } } }
        });
        requestMock.mockImplementation((_m: string, action: string) => {
            if (action === 'query-node') return Promise.resolve(undefined);
            if (action === 'query-component') return Promise.resolve(targetComponentDump());
            return Promise.resolve(undefined);
        });

        await applyPropertyToEditor(
            { ...baseArgs, value: TARGET_COMPONENT_UUID, processedValue: TARGET_COMPONENT_UUID },
            untyped
        );

        expect(setPropertyPayload().dump.type).toBe(EXPECTED_TYPE);
    });

    // Regression: the node path below only ever links a component whose type EXACTLY
    // matches the declared property type — its search loop rejects anything else. The
    // direct component-uuid path computed `expectedComponentType || direct.type`, which
    // only falls back to direct.type when expectedComponentType is empty; it never
    // compared the two when expectedComponentType WAS known, so a wrong-typed component
    // (e.g. a cc.Sprite's own uuid handed to a property typed HeroDragController) linked
    // unrejected.
    it('rejects a component uuid whose type does not match the declared property type', async () => {
        requestMock.mockImplementation((_m: string, action: string, arg: any) => {
            if (action === 'query-node') return Promise.resolve(undefined);
            if (action === 'query-component' && arg === TARGET_COMPONENT_UUID) {
                return Promise.resolve({
                    type: 'cc.Sprite',
                    value: { uuid: { value: TARGET_COMPONENT_UUID } }
                });
            }
            return Promise.resolve(undefined);
        });

        await expect(
            applyPropertyToEditor(
                { ...baseArgs, value: TARGET_COMPONENT_UUID, processedValue: TARGET_COMPONENT_UUID },
                getComponentInfo
            )
        ).rejects.toThrow(/is a 'cc\.Sprite', but property 'heroDrag'.*requires a 'HeroDragController'/);

        expect(requestMock.mock.calls.filter((c: any[]) => c[1] === 'set-property')).toHaveLength(0);
    });

    // A genuinely bad uuid must still fail — and say which two spellings are valid.
    it('reports both accepted spellings when the uuid is neither', async () => {
        requestMock.mockImplementation(() => Promise.resolve(undefined));

        await expect(
            applyPropertyToEditor(
                { ...baseArgs, value: 'nonsense-uuid', processedValue: 'nonsense-uuid' },
                getComponentInfo
            )
        ).rejects.toThrow(/neither a node uuid nor a component uuid/i);
    });
});
