import { ManageAsset } from '../tools/manage-asset';

/**
 * #80, #82, #96, #99 — `manage_asset` had four independent correctness bugs, all
 * traced to the same file: inconsistent parameter aliasing across actions (#80, #99
 * item 7), `reimport` silently no-op'ing (well, forwarding) a folder URL with no
 * directory check (#96), `save` able to corrupt a binary asset with string content
 * (#99 item 1), `delete` reporting success before verifying the file is actually gone
 * (#99 item 5), `create` unable to ever create a folder once `content` arrives as `''`
 * instead of `undefined`/`null` (#99 item 6), and `save_meta` forwarding a raw string
 * with no parse/merge, unlike the query-asset-meta -> mutate -> stringify -> save
 * pattern already used by `manage_material` / `manage_shader_effect` (#82).
 */
describe('ManageAsset param aliasing and guards (#80, #82, #96, #99)', () => {
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

    // ── A. Parameter aliasing (#80, #99 item 7) ─────────────────────────────

    describe('create — parameter aliasing', () => {
        it('accepts the documented `assetPath` alias, not just `url`', async () => {
            const created: any[] = [];
            routeMessages({
                'create-asset': (url: string, content: any, options: any) => {
                    created.push({ url, content, options });
                    return { uuid: 'new-uuid', url };
                },
            });

            const result = await tool.execute('create', {
                assetPath: 'db://assets/foo/Bar.ts', content: 'export class Bar {}',
            });

            expect(result.success).toBe(true);
            expect(created[0].url).toBe('db://assets/foo/Bar.ts');
        });

        it('names the missing field instead of forwarding undefined to the editor', async () => {
            const result = await tool.execute('create', { content: 'x' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/url|assetPath|urlOrUUID/i);
        });
    });

    describe('get_info — parameter aliasing', () => {
        it('accepts `url`, not just `assetPath`/`urlOrUUID`', async () => {
            routeMessages({
                'query-asset-info': (url: string) => ({ name: 'Bar.ts', uuid: 'u1', url, type: 'cc.Script', size: 10, isDirectory: false }),
            });

            const result = await tool.execute('get_info', { url: 'db://assets/foo/Bar.ts' });
            expect(result.success).toBe(true);
            expect(result.data.path).toBe('db://assets/foo/Bar.ts');
        });
    });

    describe('delete — parameter aliasing', () => {
        it('accepts `assetPath`/`urlOrUUID`, not just `url`', async () => {
            const deleted: string[] = [];
            routeMessages({
                'delete-asset': (url: string) => { deleted.push(url); return {}; },
                'query-asset-info': () => null,
            });

            const result = await tool.execute('delete', { assetPath: 'db://assets/foo/Bar.ts' });
            expect(result.success).toBe(true);
            expect(deleted).toEqual(['db://assets/foo/Bar.ts']);
        });

        it('names the missing field instead of forwarding undefined to the editor', async () => {
            const result = await tool.execute('delete', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/url|assetPath|urlOrUUID/i);
        });
    });

    describe('refresh — scope cannot silently widen', () => {
        it('refreshes only the given `url`, not the whole project, when `folder` is omitted', async () => {
            const refreshed: string[] = [];
            routeMessages({
                'refresh-asset': (target: string) => { refreshed.push(target); return true; },
            });

            const result = await tool.execute('refresh', { url: 'db://assets/foo' });
            expect(result.success).toBe(true);
            expect(refreshed).toEqual(['db://assets/foo']);
        });
    });

    // ── B. reimport on a folder URL must refuse, not recurse (#96) ──────────

    describe('reimport — folder URL', () => {
        it('refuses a directory URL instead of forwarding it to the editor as a no-op', async () => {
            routeMessages({
                'query-asset-info': (url: string) => ({ name: 'foo', uuid: 'dir-uuid', url, isDirectory: true, type: 'cc.Folder' }),
                'reimport-asset': () => true,
            });

            const result = await tool.execute('reimport', { url: 'db://assets/foo' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/folder|director/i);
        });

        it('still reimports a normal file URL', async () => {
            routeMessages({
                'query-asset-info': (url: string) => ({ name: 'Bar.ts', uuid: 'u1', url, isDirectory: false, type: 'cc.Script' }),
                'reimport-asset': () => true,
            });

            const result = await tool.execute('reimport', { url: 'db://assets/foo/Bar.ts' });
            expect(result.success).toBe(true);
        });

        it('reports failure when asset-db:reimport-asset returns false, instead of discarding the result', async () => {
            routeMessages({
                'query-asset-info': (url: string) => ({ name: 'Bar.ts', uuid: 'u1', url, isDirectory: false, type: 'cc.Script' }),
                'reimport-asset': () => false,
            });

            const result = await tool.execute('reimport', { url: 'db://assets/foo/Bar.ts' });
            expect(result.success).toBe(false);
        });
    });

    // ── C. save must not corrupt a binary asset (#99 item 1) ─────────────────

    describe('save — binary asset guard', () => {
        it('rejects string content over a binary (image) asset instead of corrupting it', async () => {
            const saveCalls: any[] = [];
            routeMessages({
                'query-asset-info': (url: string) => ({ name: 'icon.png', uuid: 'img-uuid', url, isDirectory: false, type: 'cc.ImageAsset', importer: 'image' }),
                'save-asset': (url: string, content: any) => { saveCalls.push({ url, content }); return {}; },
            });

            const result = await tool.execute('save', { url: 'db://assets/icon.png', content: 'not-a-png' });
            expect(result.success).toBe(false);
            expect(saveCalls.length).toBe(0);
        });

        it('still allows saving a legitimate text asset (.ts)', async () => {
            const saveCalls: any[] = [];
            routeMessages({
                'query-asset-info': (url: string) => ({ name: 'Bar.ts', uuid: 'ts-uuid', url, isDirectory: false, type: 'cc.Script', importer: 'typescript' }),
                'save-asset': (url: string, content: any) => { saveCalls.push({ url, content }); return { uuid: 'ts-uuid', url }; },
            });

            const result = await tool.execute('save', { url: 'db://assets/Bar.ts', content: 'export class Bar {}' });
            expect(result.success).toBe(true);
            expect(saveCalls.length).toBe(1);
        });
    });

    // ── D. delete must verify removal, not trust the resolved promise (#99 item 5) ──

    describe('delete — verifies removal before reporting success', () => {
        it('fails when the asset is still queryable immediately after delete-asset resolves', async () => {
            routeMessages({
                'delete-asset': () => ({}),
                'query-asset-info': (url: string) => ({ name: 'Bar.ts', uuid: 'u1', url, isDirectory: false }),
            });

            const result = await tool.execute('delete', { url: 'db://assets/Bar.ts' });
            expect(result.success).toBe(false);
        });

        it('succeeds when the asset is confirmed gone', async () => {
            routeMessages({
                'delete-asset': () => ({}),
                'query-asset-info': () => null,
            });

            const result = await tool.execute('delete', { url: 'db://assets/Bar.ts' });
            expect(result.success).toBe(true);
        });
    });

    // ── E. create must be able to create a folder even when content === '' (#99 item 6) ──

    describe('create — explicit isFolder', () => {
        it('creates a folder when isFolder=true, even though content arrives as an empty string', async () => {
            const created: any[] = [];
            routeMessages({
                'create-asset': (url: string, content: any, options: any) => {
                    created.push({ url, content, options });
                    return { uuid: 'folder-uuid', url };
                },
            });

            const result = await tool.execute('create', { url: 'db://assets/NewFolder', content: '', isFolder: true });
            expect(result.success).toBe(true);
            expect(created[0].content).toBeNull();
        });
    });

    // ── F. save_meta merges instead of blindly overwriting (#82) ─────────────

    describe('save_meta — merge via query-asset-meta', () => {
        it('requires urlOrUUID and content', async () => {
            expect((await tool.execute('save_meta', {})).success).toBe(false);
            expect((await tool.execute('save_meta', { urlOrUUID: 'db://assets/icon.png.meta' })).success).toBe(false);
        });

        it('rejects content that is not valid JSON', async () => {
            routeMessages({
                'query-asset-meta': () => ({ ver: '1.0.0', uuid: 'img-uuid', importer: 'image', userData: { wrapMode: 'clamp' } }),
            });

            const result = await tool.execute('save_meta', { urlOrUUID: 'db://assets/icon.png', content: 'not-json' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/json/i);
        });

        it('merges the patch onto the current meta instead of overwriting it wholesale', async () => {
            const savedContents: string[] = [];
            routeMessages({
                'query-asset-meta': () => ({ ver: '1.0.0', uuid: 'img-uuid', importer: 'image', userData: { wrapMode: 'clamp', filterMode: 'bilinear' } }),
                'save-asset-meta': (_url: string, content: string) => { savedContents.push(content); return { uuid: 'img-uuid' }; },
            });

            const patch = JSON.stringify({ userData: { wrapMode: 'repeat' } });
            const result = await tool.execute('save_meta', { urlOrUUID: 'db://assets/icon.png', content: patch });

            expect(result.success).toBe(true);
            expect(savedContents.length).toBe(1);
            const savedMeta = JSON.parse(savedContents[0]);
            // Fields the caller never touched must survive the round-trip.
            expect(savedMeta.ver).toBe('1.0.0');
            expect(savedMeta.importer).toBe('image');
        });

        it('errors when the asset has no current meta instead of writing a meta from scratch', async () => {
            routeMessages({
                'query-asset-meta': () => null,
            });

            const result = await tool.execute('save_meta', { urlOrUUID: 'db://assets/missing.png', content: '{}' });
            expect(result.success).toBe(false);
        });
    });
});
