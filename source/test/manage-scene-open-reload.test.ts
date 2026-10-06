import { ManageScene } from '../tools/manage-scene';
import { ManageSceneQuery } from '../tools/manage-scene-query';

/**
 * #65 — `open` and `soft_reload` resolved success while the editor kept its cached copy of
 * a scene edited out of band. `open` now reimports the scene asset first; `soft_reload`
 * says honestly that it does not re-read the file.
 */
describe('manage_scene open / manage_scene_query soft_reload (#65)', () => {
    let mockRequest: jest.Mock;
    const calls = () => mockRequest.mock.calls.map(c => `${c[0]}:${c[1]}`);

    beforeEach(() => {
        mockRequest = jest.fn(async (pkg: string, msg: string) => {
            if (msg === 'query-uuid') return 'scene-uuid';
            if (msg === 'query-is-ready') return true;
            return undefined;
        });
        (global as any).Editor = { Message: { request: mockRequest } };
    });

    it('open reimports the scene asset BEFORE opening it', async () => {
        const result = await new ManageScene().execute('open', { scenePath: 'db://assets/Main.scene' });
        expect(result.success).toBe(true);
        expect(calls().indexOf('asset-db:reimport-asset')).toBeGreaterThan(-1);
        expect(calls().indexOf('asset-db:reimport-asset')).toBeLessThan(calls().indexOf('scene:open-scene'));
        expect(result.data.reimported).toBe(true);
    });

    it('open with reimport=false skips the reimport and says it used the cached copy', async () => {
        const result = await new ManageScene().execute('open', { scenePath: 'db://assets/Main.scene', reimport: false });
        expect(calls()).not.toContain('asset-db:reimport-asset');
        expect(result.message).toMatch(/cached copy/);
    });

    it('open does not open anything when the reimport is rejected', async () => {
        mockRequest.mockImplementation(async (_p: string, msg: string) => {
            if (msg === 'query-uuid') return 'scene-uuid';
            if (msg === 'reimport-asset') return false;
            return undefined;
        });
        const result = await new ManageScene().execute('open', { scenePath: 'db://assets/Main.scene' });
        expect(result.success).toBe(false);
        expect(calls()).not.toContain('scene:open-scene');
    });

    it('open fails when the scene is not ready afterward', async () => {
        mockRequest.mockImplementation(async (_p: string, msg: string) => {
            if (msg === 'query-uuid') return 'scene-uuid';
            if (msg === 'query-is-ready') return false;
            return undefined;
        });
        const result = await new ManageScene().execute('open', { scenePath: 'db://assets/Main.scene' });
        expect(result.success).toBe(false);
    });

    it('soft_reload reports it did not re-read the file', async () => {
        const result = await new ManageSceneQuery().execute('soft_reload', {});
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ rereadFromDisk: false });
        expect(result.message).toMatch(/NOT re-read/);
    });

    it('soft_reload fails when the scene is not ready afterward', async () => {
        mockRequest.mockImplementation(async (_p: string, msg: string) => (msg === 'query-is-ready' ? false : undefined));
        const result = await new ManageSceneQuery().execute('soft_reload', {});
        expect(result.success).toBe(false);
    });
});
