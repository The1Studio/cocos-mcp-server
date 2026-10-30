import { ManageNodeHierarchy } from '../tools/manage-node-hierarchy';

/**
 * #1649: `reset_property` / `reset_component` on a node that sits INSIDE a prefab instance.
 *
 * The editor message takes no "revert to prefab value" parameter (`SetPropertyOptions` is
 * `{ uuid, path, dump, record? }`; `ResetComponentOptions` is `{ uuid }`), so these actions
 * reset to the CLASS DEFAULT. On an instance node the class default is not the value the
 * prefab carries — the caller reads a plain success and silently loses the prefab's value.
 *
 * The fix cannot invent a revert the editor does not expose; it must stop reporting a
 * bare success. `manage-component-prefab-guard.ts` already owns the instance detection
 * (`__prefab__` on the node dump) and the `persistenceVerified: false` + `warning`
 * vocabulary issues #48/#76 established, so these actions reuse it rather than
 * reimplementing it.
 */
describe('reset_* on a prefab-instance node (#1649)', () => {
    const INSTANCE_NODE = 'instance-node-uuid';
    const PLAIN_NODE = 'plain-scene-node-uuid';
    const COMPONENT = 'component-uuid';

    let tool: ManageNodeHierarchy;
    let mockRequest: jest.Mock;

    /** Route scripted answers by message name so the tool sees a realistic editor. */
    const script = (routes: Record<string, any>) => {
        mockRequest.mockImplementation((_domain: string, message: string) => {
            if (message in routes) {
                const answer = routes[message];
                return Promise.resolve(typeof answer === 'function' ? answer() : answer);
            }
            return Promise.resolve({});
        });
    };

    const instanceDump = { uuid: INSTANCE_NODE, __prefab__: { rootUuid: 'instance-root-uuid' } };
    const plainDump = { uuid: PLAIN_NODE };

    beforeEach(() => {
        tool = new ManageNodeHierarchy();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    describe('reset_property', () => {
        it('still forwards the reset to the editor', async () => {
            script({ 'reset-property': true, 'query-node': instanceDump });

            await tool.execute('reset_property', { uuid: INSTANCE_NODE, path: 'speed' });

            expect(mockRequest).toHaveBeenCalledWith('scene', 'reset-property', {
                uuid: INSTANCE_NODE, path: 'speed', dump: { value: null }
            });
        });

        it('flags an instance node as NOT persistence-verified and explains why', async () => {
            script({ 'reset-property': true, 'query-node': instanceDump });

            const result = await tool.execute('reset_property', { uuid: INSTANCE_NODE, path: 'speed' });

            expect(result.success).toBe(true);
            expect(result.data.persistenceVerified).toBe(false);
            expect(result.message).toMatch(/class default/i);
            expect(result.message).toMatch(/prefab/i);
        });

        it('reports a plain scene node as an ordinary verified class-default reset', async () => {
            script({ 'reset-property': true, 'query-node': plainDump });

            const result = await tool.execute('reset_property', { uuid: PLAIN_NODE, path: 'speed' });

            expect(result.success).toBe(true);
            expect(result.data.persistenceVerified).toBe(true);
            expect(result.message).toMatch(/class default/i);
        });

        it('does not reword an editor rejection into a prefab caveat', async () => {
            script({ 'reset-property': false, 'query-node': instanceDump });

            const result = await tool.execute('reset_property', { uuid: INSTANCE_NODE, path: 'speed' });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/rejected reset-property/i);
        });

        it('never lets a failed query-node break the reset (#48 precedent: advisory only)', async () => {
            script({
                'reset-property': true,
                'query-node': () => Promise.reject(new Error('query blew up'))
            });

            const result = await tool.execute('reset_property', { uuid: INSTANCE_NODE, path: 'speed' });

            expect(result.success).toBe(true);
            expect(result.data.persistenceVerified).toBe(true);
        });
    });

    describe('reset_component', () => {
        it('still forwards the reset to the editor', async () => {
            script({ 'reset-component': undefined, 'query-node': instanceDump });

            await tool.execute('reset_component', { uuid: COMPONENT });

            expect(mockRequest).toHaveBeenCalledWith('scene', 'reset-component', { uuid: COMPONENT });
        });

        it('flags an instance node as NOT persistence-verified and explains why', async () => {
            script({ 'reset-component': undefined, 'query-node': instanceDump });

            const result = await tool.execute('reset_component', { uuid: COMPONENT });

            expect(result.success).toBe(true);
            expect(result.data.persistenceVerified).toBe(false);
            expect(result.message).toMatch(/class default/i);
            expect(result.message).toMatch(/prefab/i);
        });

        it('reports a plain scene node as an ordinary verified class-default reset', async () => {
            script({ 'reset-component': undefined, 'query-node': plainDump });

            const result = await tool.execute('reset_component', { uuid: PLAIN_NODE });

            expect(result.success).toBe(true);
            expect(result.data.persistenceVerified).toBe(true);
        });

        it('never lets a failed query-node break the reset (#48 precedent: advisory only)', async () => {
            script({
                'reset-component': undefined,
                'query-node': () => Promise.reject(new Error('query blew up'))
            });

            const result = await tool.execute('reset_component', { uuid: PLAIN_NODE });

            expect(result.success).toBe(true);
            expect(result.data.persistenceVerified).toBe(true);
        });
    });
});
