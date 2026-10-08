import { ManageComponent } from '../tools/manage-component';

/**
 * #76: a plain-value write (`playOnAwake`) or an asset write (`brandSprite`) on a component
 * that lives inside a prefab instance returned `changeVerified: true` — the live read-back
 * matched — while the value was missing from the saved scene and prefab. The #48 guard only
 * covered node/component reference types crossing an instance boundary, so these were never
 * flagged. Any write on a prefab-instance node must now carry `persistenceVerified: false`.
 */
describe('ManageComponent set_property on a prefab-instance node (#76)', () => {
    const NODE = 'instance-child';
    const TYPE = 'TestController';
    let host: any;

    function wire(prefab: any) {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        host = {
            __comps__: [{
                __type__: TYPE, type: TYPE, enabled: true,
                value: {
                    uuid: { value: 'comp-1' },
                    playOnAwake: { name: 'playOnAwake', value: false, type: 'Boolean' },
                    brandSprite: { name: 'brandSprite', value: { uuid: '' }, type: 'cc.SpriteFrame' }
                }
            }]
        };
        if (prefab) host.__prefab__ = prefab;
        mockRequest.mockReset();
        mockRequest.mockImplementation((_m: string, action: string, payload: any) => {
            if (action === 'query-node') return Promise.resolve(host);
            if (action === 'set-property') {
                const seg: string[] = payload.path.split('.');
                host.__comps__[Number(seg[1])].value[seg[2]].value = payload.dump.value;
            }
            return Promise.resolve({});
        });
    }

    const set = (property: string, propertyType: string, value: any) =>
        new ManageComponent().execute('set_property', { nodeUuid: NODE, componentType: TYPE, property, propertyType, value });

    afterAll(() => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('flags a plain boolean write on an instance node as persistence-unverified', async () => {
        wire({ rootUuid: 'instance-root', uuid: 'prefab-asset' });
        const result = await set('playOnAwake', 'boolean', true);

        expect(result.success).toBe(true);
        expect(result.data.changeVerified).toBe(true);
        expect(result.data.persistenceVerified).toBe(false);
        expect(result.data.warning).toMatch(/inside a prefab instance/);
    });

    it('flags an asset write on an instance node', async () => {
        wire({ rootUuid: 'instance-root', uuid: 'prefab-asset' });
        const result = await set('brandSprite', 'spriteFrame', 'sprite-uuid');

        expect(result.data.persistenceVerified).toBe(false);
        expect(result.data.warning).toMatch(/inside a prefab instance/);
    });

    it('flags an instance ROOT write too (the reporter\'s second occurrence)', async () => {
        wire({ uuid: 'prefab-asset' }); // root: no rootUuid, falls back to the node itself
        const result = await set('playOnAwake', 'boolean', true);

        expect(result.data.persistenceVerified).toBe(false);
    });

    it('does not flag the same write on a plain scene node', async () => {
        wire(null);
        const result = await set('playOnAwake', 'boolean', true);

        expect(result.success).toBe(true);
        expect(result.data.changeVerified).toBe(true);
        expect(result.data.persistenceVerified).toBeUndefined();
        expect(result.data.warning).toBeUndefined();
    });

    it('propagates through set_properties_batch per entry', async () => {
        wire({ rootUuid: 'instance-root', uuid: 'prefab-asset' });
        const result = await new ManageComponent().execute('set_properties_batch', {
            nodeUuid: NODE, componentType: TYPE,
            properties: [{ property: 'playOnAwake', propertyType: 'boolean', value: true }]
        });

        expect(result.data.results[0].persistenceVerified).toBe(false);
        expect(result.data.results[0].warning).toMatch(/inside a prefab instance/);
    });
});
