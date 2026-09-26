import { ManageAsset } from '../tools/manage-asset';

/**
 * Regression tests for issue #124 — `manage_asset` advertised three actions whose
 * handlers were unconditional stubs, and the surviving one resolved its target through
 * a parameter alias set the rest of the tool does not use.
 *
 * The failure being pinned is the ADVERTISED SURFACE, not the stub body: an action named
 * in the tool description and in the `action` enum is selected by a caller, costs a round
 * trip, and its error text ("requires additional APIs not available… Consider using the
 * Editor UI") reads as "the editor cannot do this" rather than "this server never
 * implemented it". The triage on the issue named the resolution explicitly — either
 * implement it or remove the lie — and `#35`/`#38` are the closed precedents that removed
 * theirs.
 *
 * The alias case is separate and independent: `get_dependencies` dispatched on
 * `args.urlOrUUID` only, bypassing the `resolveAssetArg` alias resolver (#80 / #106) that
 * `delete`/`save`/`get_info` all route through, so a caller using the schema-documented
 * `url` spelling would reach the handler with `undefined` even after the stub was
 * implemented.
 */

declare const global: any;

describe('ManageAsset — advertised actions must be reachable or absent (#124)', () => {
    let tool: ManageAsset;
    let mockRequest: jest.Mock;

    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    beforeEach(() => {
        tool = new ManageAsset();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    /** Every action the tool advertises in its schema enum must be dispatchable. */
    it('does not advertise an action whose handler is a permanent unimplemented stub', () => {
        const advertised: string[] = (tool as any).inputSchema.properties.action.enum;

        // The three stubs the issue named. `get_unused` and `compress_textures` cannot be
        // implemented from the editor's own APIs (no reverse-reference index, no image
        // codec), so their resolution is removal; `get_dependencies` gains a real
        // implementation, so it must STAY advertised and actually work (covered below).
        expect(advertised).not.toContain('compress_textures');
        expect(advertised).not.toContain('get_unused');
    });

    it('keeps get_dependencies advertised and never answers with the not-implemented stub', async () => {
        const advertised: string[] = (tool as any).inputSchema.properties.action.enum;
        expect(advertised).toContain('get_dependencies');

        // A real implementation queries the editor; a stub returns without ever touching
        // Editor.Message. Asserting "the editor was consulted" is what distinguishes an
        // implementation from an error string that happens to be success-shaped.
        routeMessages({
            'query-asset-info': () => ({ uuid: 'dep-uuid', url: 'db://assets/Bar.mat', name: 'Bar' }),
            'query-assets': () => [],
        });

        const result = await tool.execute('get_dependencies', {
            url: 'db://assets/Bar.mat', direction: 'dependencies',
        });

        expect(String(result.error || '')).not.toMatch(/not available in current Cocos Creator MCP implementation/i);
        expect(mockRequest).toHaveBeenCalled();
    });

    it('resolves get_dependencies through the shared alias set, not urlOrUUID alone', async () => {
        // The bypass: dispatch read `args.urlOrUUID` while the schema documents `url` and
        // `assetPath`. A caller passing `url` reached the handler with `undefined`.
        const queried: string[] = [];
        routeMessages({
            'query-asset-info': (url: string) => {
                queried.push(url);
                return { uuid: 'dep-uuid', url, name: 'Bar' };
            },
            'query-assets': () => [],
        });

        const viaUrl = await tool.execute('get_dependencies', {
            url: 'db://assets/ViaUrl.mat', direction: 'dependencies',
        });
        expect(queried).toContain('db://assets/ViaUrl.mat');
        expect(viaUrl.success).toBe(true);

        const viaAssetPath = await tool.execute('get_dependencies', {
            assetPath: 'db://assets/ViaAssetPath.mat', direction: 'dependencies',
        });
        expect(queried).toContain('db://assets/ViaAssetPath.mat');
        expect(viaAssetPath.success).toBe(true);
    });

    it('names the missing asset reference instead of querying for undefined', async () => {
        const result = await tool.execute('get_dependencies', { direction: 'dependencies' });

        expect(result.success).toBe(false);
        expect(String(result.error)).toMatch(/url|urlOrUUID|assetPath/);
    });

    it('reports the dependents of an asset from the editor query, not an error string', async () => {
        routeMessages({
            'query-asset-info': (url: string) => ({ uuid: 'target-uuid', url, name: 'Target' }),
            // `query-asset-users` is the asset DB's declared reverse message
            // (`@cocos/creator-types/.../asset-db/@types/protected/message.d.ts`).
            'query-asset-users': (uuid: string) => (uuid === 'target-uuid'
                ? [{ url: 'db://assets/truck.prefab', uuid: 'referrer-uuid', name: 'truck' }]
                : []),
        });

        const result = await tool.execute('get_dependencies', {
            urlOrUUID: 'db://assets/Target.fbx', direction: 'dependents',
        });

        expect(result.success).toBe(true);
        const dependents = (result.data as any).dependents || [];
        expect(dependents.map((d: any) => d.url)).toEqual(['db://assets/truck.prefab']);
        expect((result.data as any).dependentCount).toBe(1);
    });

    it('still reports the scene-node reverse lookup when the asset DB reverse index is absent', async () => {
        // Both reverse sources are attempted independently: an editor build without
        // `query-asset-users` must still answer via the live scene, and the reported
        // source list must say which one answered.
        routeMessages({
            'query-asset-info': (url: string) => ({ uuid: 'target-uuid', url, name: 'Target' }),
            'query-nodes-by-asset-uuid': (uuid: string) => (uuid === 'target-uuid' ? ['node-uuid-1'] : []),
        });

        const result = await tool.execute('get_dependencies', {
            urlOrUUID: 'db://assets/Target.fbx', direction: 'dependents',
        });

        expect(result.success).toBe(true);
        expect((result.data as any).referencingNodes).toEqual(['node-uuid-1']);
        expect((result.data as any).dependentsSource).toMatch(/query-nodes-by-asset-uuid/);
    });

    it('distinguishes "no dependents found" from "no reverse query was reachable"', async () => {
        // The whole point of reporting a source: an empty list that means "nothing
        // references this" and one that means "nothing could be asked" must not read the
        // same to a caller deciding whether a delete is safe.
        routeMessages({
            'query-asset-info': (url: string) => ({ uuid: 'target-uuid', url, name: 'Target' }),
            'query-asset-users': () => [],
            'query-nodes-by-asset-uuid': () => [],
        });

        const result = await tool.execute('get_dependencies', {
            urlOrUUID: 'db://assets/Target.fbx', direction: 'dependents',
        });

        expect(result.success).toBe(true);
        expect((result.data as any).dependentCount).toBe(0);
        // Reachable-and-empty: the source names the query that answered.
        expect((result.data as any).dependentsSource).toMatch(/query-asset-users/);
        expect((result.data as any).dependentsSource).not.toMatch(/no reverse-reference query available/);
    });
});
