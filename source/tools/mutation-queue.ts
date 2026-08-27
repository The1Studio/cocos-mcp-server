/**
 * Global serialization queue for scene-mutating editor calls (#6).
 *
 * `Editor.Message.request` calls issued concurrently interleave inside the editor: a
 * caller that fires `manage_node create` and `manage_scene save` in the same batch (rather
 * than awaiting the create first) can have the save run against a scene graph the create
 * has not finished committing to. The save then reports success while the created node is
 * never written — the data loss reported in #6. Verifying the save afterwards (the #59
 * fix) detects that after the fact; only serializing the calls prevents it.
 *
 * Every tool call is chained onto one promise tail, so at most one is in flight at a time
 * and a save cannot begin until the mutations ahead of it have settled. The chain is not
 * a lock a caller can hold across calls — it is released as soon as the enqueued function
 * settles, whether it resolves or rejects.
 */

/** Longest a queued call waits for its turn before proceeding unserialized. */
export const QUEUE_WAIT_TIMEOUT_MS = 120000;

/** Tail of the chain. Resolves when the most recently enqueued call has settled. */
let tail: Promise<void> = Promise.resolve();
/** Enqueued and waiting for a turn — excludes the call currently running. */
let queuedCount = 0;

/**
 * Waits for `predecessor` to settle, but never longer than {@link QUEUE_WAIT_TIMEOUT_MS}.
 * A tool whose editor request never settles would otherwise wedge the whole queue and
 * take every later call down with it, which is a worse failure than the race being fixed.
 * Never rejects — a rejected predecessor is still a released slot.
 */
function settleOrTimeout(predecessor: Promise<void>): Promise<void> {
    return new Promise<void>((resolve) => {
        let settled = false;
        const finish = (timedOut: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (timedOut) {
                console.warn(
                    `[mutation-queue] Previous scene call did not settle within ${QUEUE_WAIT_TIMEOUT_MS}ms; ` +
                    'proceeding unserialized to keep the server responsive.'
                );
            }
            resolve();
        };
        const timer = setTimeout(() => finish(true), QUEUE_WAIT_TIMEOUT_MS);
        if (typeof (timer as any).unref === 'function') (timer as any).unref();
        predecessor.then(() => finish(false), () => finish(false));
    });
}

/**
 * Runs `fn` once every call enqueued before it has settled. Returns whatever `fn` returns,
 * and propagates its rejection unchanged — enqueueing must be invisible to the caller
 * apart from the ordering it guarantees.
 */
export function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
    const predecessor = tail;
    let release: () => void = () => {};
    tail = new Promise<void>((resolve) => { release = resolve; });
    queuedCount++;

    return (async () => {
        await settleOrTimeout(predecessor);
        queuedCount--;
        try {
            return await fn();
        } finally {
            release();
        }
    })();
}

/**
 * Number of calls enqueued and still waiting for a turn. Deliberately excludes the call
 * currently running, so a handler asking this question does not count itself: from inside
 * `query_dirty` the answer is "how many mutations are still queued behind me", which is
 * exactly what makes a `dirty: false` reading from the editor untrustworthy (#6).
 */
export function pendingMutationCount(): number {
    return queuedCount;
}

/** Test-only: drop the chain so one suite's queue state cannot leak into the next. */
export function resetMutationQueue(): void {
    tail = Promise.resolve();
    queuedCount = 0;
}
