import { enqueueMutation, pendingMutationCount, resetMutationQueue } from '../tools/mutation-queue';

/**
 * #6 — concurrent scene calls interleaved inside the editor, so a save could run while a
 * `manage_node create` was still committing and silently drop it. The queue is the
 * primitive that prevents that interleaving.
 */
describe('mutation-queue (#6)', () => {
    beforeEach(() => {
        resetMutationQueue();
    });

    it('runs concurrently enqueued calls one at a time, in enqueue order', async () => {
        const events: string[] = [];
        const slow = (label: string, delayMs: number) => enqueueMutation(async () => {
            events.push(`${label}:start`);
            await new Promise(r => setTimeout(r, delayMs));
            events.push(`${label}:end`);
            return label;
        });

        // Fired together and NOT awaited in turn — exactly the caller pattern #6 reproduces.
        // Unserialized, 'create' (slower) would still be running when 'save' starts.
        const results = await Promise.all([slow('create', 30), slow('save', 0)]);

        expect(results).toEqual(['create', 'save']);
        expect(events).toEqual(['create:start', 'create:end', 'save:start', 'save:end']);
    });

    it('releases the queue when a call rejects, and propagates that rejection', async () => {
        const failing = enqueueMutation(async () => { throw new Error('editor rejected the call'); });
        const following = enqueueMutation(async () => 'ran anyway');

        await expect(failing).rejects.toThrow('editor rejected the call');
        await expect(following).resolves.toBe('ran anyway');
    });

    it('counts calls still queued behind the running one, and excludes the running one', async () => {
        let observedFromInside = -1;
        let release: () => void = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });

        const first = enqueueMutation(async () => {
            observedFromInside = pendingMutationCount();
            await gate;
        });
        const second = enqueueMutation(async () => undefined);
        const third = enqueueMutation(async () => undefined);

        // Let `first` reach its body before asserting.
        await new Promise(r => setTimeout(r, 0));
        expect(pendingMutationCount()).toBe(2);
        expect(observedFromInside).toBe(2);

        release();
        await Promise.all([first, second, third]);
        expect(pendingMutationCount()).toBe(0);
    });
});
