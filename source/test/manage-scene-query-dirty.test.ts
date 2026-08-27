import { ManageSceneQuery } from '../tools/manage-scene-query';
import { enqueueMutation, resetMutationQueue } from '../tools/mutation-queue';

/**
 * #6 — `query_dirty` proxied `scene:query-dirty` verbatim. The editor flag only covers
 * edits it has already committed, so a scene with mutating calls still queued reported
 * `dirty: false` — "clean" — and a caller trusting that skipped the save it needed.
 */
describe('ManageSceneQuery.query_dirty (#6)', () => {
    let tool: ManageSceneQuery;
    let mockRequest: jest.Mock;

    beforeEach(() => {
        resetMutationQueue();
        tool = new ManageSceneQuery();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
    });

    it('reports clean only when the editor flag is false AND nothing is queued', async () => {
        mockRequest.mockResolvedValue(false);

        const result = await tool.execute('query_dirty', {});

        expect(result.success).toBe(true);
        expect(result.data.dirty).toBe(false);
        expect(result.data.editorDirty).toBe(false);
        expect(result.data.pendingMutations).toBe(0);
    });

    it('reports dirty when calls are still queued even though the editor flag reads false', async () => {
        mockRequest.mockResolvedValue(false);

        // Hold the queue open so the two calls behind it are genuinely still pending.
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const held = enqueueMutation(async () => { await gate; });
        const queued = [
            enqueueMutation(async () => undefined),
            enqueueMutation(async () => undefined),
        ];
        await new Promise(r => setTimeout(r, 0));

        const result = await tool.execute('query_dirty', {});

        expect(result.data.dirty).toBe(true);
        expect(result.data.editorDirty).toBe(false);
        expect(result.data.pendingMutations).toBe(2);
        expect(result.message).toMatch(/still queued/i);

        release();
        await Promise.all([held, ...queued]);
    });

    it('still reports dirty from the editor flag alone', async () => {
        mockRequest.mockResolvedValue(true);

        const result = await tool.execute('query_dirty', {});

        expect(result.data.dirty).toBe(true);
        expect(result.data.editorDirty).toBe(true);
        expect(result.message).toMatch(/unsaved changes/i);
    });
});
