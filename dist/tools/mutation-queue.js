"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_WAIT_TIMEOUT_MS = void 0;
exports.enqueueMutation = enqueueMutation;
exports.pendingMutationCount = pendingMutationCount;
exports.resetMutationQueue = resetMutationQueue;
/** Longest a queued call waits for its turn before proceeding unserialized. */
exports.QUEUE_WAIT_TIMEOUT_MS = 120000;
/** Tail of the chain. Resolves when the most recently enqueued call has settled. */
let tail = Promise.resolve();
/** Enqueued and waiting for a turn — excludes the call currently running. */
let queuedCount = 0;
/**
 * Waits for `predecessor` to settle, but never longer than {@link QUEUE_WAIT_TIMEOUT_MS}.
 * A tool whose editor request never settles would otherwise wedge the whole queue and
 * take every later call down with it, which is a worse failure than the race being fixed.
 * Never rejects — a rejected predecessor is still a released slot.
 */
function settleOrTimeout(predecessor) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (timedOut) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (timedOut) {
                console.warn(`[mutation-queue] Previous scene call did not settle within ${exports.QUEUE_WAIT_TIMEOUT_MS}ms; ` +
                    'proceeding unserialized to keep the server responsive.');
            }
            resolve();
        };
        const timer = setTimeout(() => finish(true), exports.QUEUE_WAIT_TIMEOUT_MS);
        if (typeof timer.unref === 'function')
            timer.unref();
        predecessor.then(() => finish(false), () => finish(false));
    });
}
/**
 * Runs `fn` once every call enqueued before it has settled. Returns whatever `fn` returns,
 * and propagates its rejection unchanged — enqueueing must be invisible to the caller
 * apart from the ordering it guarantees.
 */
function enqueueMutation(fn) {
    const predecessor = tail;
    let release = () => { };
    tail = new Promise((resolve) => { release = resolve; });
    queuedCount++;
    return (async () => {
        await settleOrTimeout(predecessor);
        queuedCount--;
        try {
            return await fn();
        }
        finally {
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
function pendingMutationCount() {
    return queuedCount;
}
/** Test-only: drop the chain so one suite's queue state cannot leak into the next. */
function resetMutationQueue() {
    tail = Promise.resolve();
    queuedCount = 0;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXV0YXRpb24tcXVldWUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbXV0YXRpb24tcXVldWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7OztHQWNHOzs7QUEwQ0gsMENBZUM7QUFRRCxvREFFQztBQUdELGdEQUdDO0FBdkVELCtFQUErRTtBQUNsRSxRQUFBLHFCQUFxQixHQUFHLE1BQU0sQ0FBQztBQUU1QyxvRkFBb0Y7QUFDcEYsSUFBSSxJQUFJLEdBQWtCLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUM1Qyw2RUFBNkU7QUFDN0UsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBRXBCOzs7OztHQUtHO0FBQ0gsU0FBUyxlQUFlLENBQUMsV0FBMEI7SUFDL0MsT0FBTyxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQ2pDLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQixNQUFNLE1BQU0sR0FBRyxDQUFDLFFBQWlCLEVBQUUsRUFBRTtZQUNqQyxJQUFJLE9BQU87Z0JBQUUsT0FBTztZQUNwQixPQUFPLEdBQUcsSUFBSSxDQUFDO1lBQ2YsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3BCLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ1gsT0FBTyxDQUFDLElBQUksQ0FDUiw4REFBOEQsNkJBQXFCLE1BQU07b0JBQ3pGLHdEQUF3RCxDQUMzRCxDQUFDO1lBQ04sQ0FBQztZQUNELE9BQU8sRUFBRSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO1FBQ0YsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSw2QkFBcUIsQ0FBQyxDQUFDO1FBQ3BFLElBQUksT0FBUSxLQUFhLENBQUMsS0FBSyxLQUFLLFVBQVU7WUFBRyxLQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDdkUsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDL0QsQ0FBQyxDQUFDLENBQUM7QUFDUCxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLGVBQWUsQ0FBSSxFQUFvQjtJQUNuRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDekIsSUFBSSxPQUFPLEdBQWUsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDO0lBQ25DLElBQUksR0FBRyxJQUFJLE9BQU8sQ0FBTyxDQUFDLE9BQU8sRUFBRSxFQUFFLEdBQUcsT0FBTyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzlELFdBQVcsRUFBRSxDQUFDO0lBRWQsT0FBTyxDQUFDLEtBQUssSUFBSSxFQUFFO1FBQ2YsTUFBTSxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDbkMsV0FBVyxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUM7WUFDRCxPQUFPLE1BQU0sRUFBRSxFQUFFLENBQUM7UUFDdEIsQ0FBQztnQkFBUyxDQUFDO1lBQ1AsT0FBTyxFQUFFLENBQUM7UUFDZCxDQUFDO0lBQ0wsQ0FBQyxDQUFDLEVBQUUsQ0FBQztBQUNULENBQUM7QUFFRDs7Ozs7R0FLRztBQUNILFNBQWdCLG9CQUFvQjtJQUNoQyxPQUFPLFdBQVcsQ0FBQztBQUN2QixDQUFDO0FBRUQsc0ZBQXNGO0FBQ3RGLFNBQWdCLGtCQUFrQjtJQUM5QixJQUFJLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ3pCLFdBQVcsR0FBRyxDQUFDLENBQUM7QUFDcEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogR2xvYmFsIHNlcmlhbGl6YXRpb24gcXVldWUgZm9yIHNjZW5lLW11dGF0aW5nIGVkaXRvciBjYWxscyAoIzYpLlxuICpcbiAqIGBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0YCBjYWxscyBpc3N1ZWQgY29uY3VycmVudGx5IGludGVybGVhdmUgaW5zaWRlIHRoZSBlZGl0b3I6IGFcbiAqIGNhbGxlciB0aGF0IGZpcmVzIGBtYW5hZ2Vfbm9kZSBjcmVhdGVgIGFuZCBgbWFuYWdlX3NjZW5lIHNhdmVgIGluIHRoZSBzYW1lIGJhdGNoIChyYXRoZXJcbiAqIHRoYW4gYXdhaXRpbmcgdGhlIGNyZWF0ZSBmaXJzdCkgY2FuIGhhdmUgdGhlIHNhdmUgcnVuIGFnYWluc3QgYSBzY2VuZSBncmFwaCB0aGUgY3JlYXRlXG4gKiBoYXMgbm90IGZpbmlzaGVkIGNvbW1pdHRpbmcgdG8uIFRoZSBzYXZlIHRoZW4gcmVwb3J0cyBzdWNjZXNzIHdoaWxlIHRoZSBjcmVhdGVkIG5vZGUgaXNcbiAqIG5ldmVyIHdyaXR0ZW4g4oCUIHRoZSBkYXRhIGxvc3MgcmVwb3J0ZWQgaW4gIzYuIFZlcmlmeWluZyB0aGUgc2F2ZSBhZnRlcndhcmRzICh0aGUgIzU5XG4gKiBmaXgpIGRldGVjdHMgdGhhdCBhZnRlciB0aGUgZmFjdDsgb25seSBzZXJpYWxpemluZyB0aGUgY2FsbHMgcHJldmVudHMgaXQuXG4gKlxuICogRXZlcnkgdG9vbCBjYWxsIGlzIGNoYWluZWQgb250byBvbmUgcHJvbWlzZSB0YWlsLCBzbyBhdCBtb3N0IG9uZSBpcyBpbiBmbGlnaHQgYXQgYSB0aW1lXG4gKiBhbmQgYSBzYXZlIGNhbm5vdCBiZWdpbiB1bnRpbCB0aGUgbXV0YXRpb25zIGFoZWFkIG9mIGl0IGhhdmUgc2V0dGxlZC4gVGhlIGNoYWluIGlzIG5vdFxuICogYSBsb2NrIGEgY2FsbGVyIGNhbiBob2xkIGFjcm9zcyBjYWxscyDigJQgaXQgaXMgcmVsZWFzZWQgYXMgc29vbiBhcyB0aGUgZW5xdWV1ZWQgZnVuY3Rpb25cbiAqIHNldHRsZXMsIHdoZXRoZXIgaXQgcmVzb2x2ZXMgb3IgcmVqZWN0cy5cbiAqL1xuXG4vKiogTG9uZ2VzdCBhIHF1ZXVlZCBjYWxsIHdhaXRzIGZvciBpdHMgdHVybiBiZWZvcmUgcHJvY2VlZGluZyB1bnNlcmlhbGl6ZWQuICovXG5leHBvcnQgY29uc3QgUVVFVUVfV0FJVF9USU1FT1VUX01TID0gMTIwMDAwO1xuXG4vKiogVGFpbCBvZiB0aGUgY2hhaW4uIFJlc29sdmVzIHdoZW4gdGhlIG1vc3QgcmVjZW50bHkgZW5xdWV1ZWQgY2FsbCBoYXMgc2V0dGxlZC4gKi9cbmxldCB0YWlsOiBQcm9taXNlPHZvaWQ+ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG4vKiogRW5xdWV1ZWQgYW5kIHdhaXRpbmcgZm9yIGEgdHVybiDigJQgZXhjbHVkZXMgdGhlIGNhbGwgY3VycmVudGx5IHJ1bm5pbmcuICovXG5sZXQgcXVldWVkQ291bnQgPSAwO1xuXG4vKipcbiAqIFdhaXRzIGZvciBgcHJlZGVjZXNzb3JgIHRvIHNldHRsZSwgYnV0IG5ldmVyIGxvbmdlciB0aGFuIHtAbGluayBRVUVVRV9XQUlUX1RJTUVPVVRfTVN9LlxuICogQSB0b29sIHdob3NlIGVkaXRvciByZXF1ZXN0IG5ldmVyIHNldHRsZXMgd291bGQgb3RoZXJ3aXNlIHdlZGdlIHRoZSB3aG9sZSBxdWV1ZSBhbmRcbiAqIHRha2UgZXZlcnkgbGF0ZXIgY2FsbCBkb3duIHdpdGggaXQsIHdoaWNoIGlzIGEgd29yc2UgZmFpbHVyZSB0aGFuIHRoZSByYWNlIGJlaW5nIGZpeGVkLlxuICogTmV2ZXIgcmVqZWN0cyDigJQgYSByZWplY3RlZCBwcmVkZWNlc3NvciBpcyBzdGlsbCBhIHJlbGVhc2VkIHNsb3QuXG4gKi9cbmZ1bmN0aW9uIHNldHRsZU9yVGltZW91dChwcmVkZWNlc3NvcjogUHJvbWlzZTx2b2lkPik6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgICBsZXQgc2V0dGxlZCA9IGZhbHNlO1xuICAgICAgICBjb25zdCBmaW5pc2ggPSAodGltZWRPdXQ6IGJvb2xlYW4pID0+IHtcbiAgICAgICAgICAgIGlmIChzZXR0bGVkKSByZXR1cm47XG4gICAgICAgICAgICBzZXR0bGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICAgICAgICBpZiAodGltZWRPdXQpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgICAgIGBbbXV0YXRpb24tcXVldWVdIFByZXZpb3VzIHNjZW5lIGNhbGwgZGlkIG5vdCBzZXR0bGUgd2l0aGluICR7UVVFVUVfV0FJVF9USU1FT1VUX01TfW1zOyBgICtcbiAgICAgICAgICAgICAgICAgICAgJ3Byb2NlZWRpbmcgdW5zZXJpYWxpemVkIHRvIGtlZXAgdGhlIHNlcnZlciByZXNwb25zaXZlLidcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gZmluaXNoKHRydWUpLCBRVUVVRV9XQUlUX1RJTUVPVVRfTVMpO1xuICAgICAgICBpZiAodHlwZW9mICh0aW1lciBhcyBhbnkpLnVucmVmID09PSAnZnVuY3Rpb24nKSAodGltZXIgYXMgYW55KS51bnJlZigpO1xuICAgICAgICBwcmVkZWNlc3Nvci50aGVuKCgpID0+IGZpbmlzaChmYWxzZSksICgpID0+IGZpbmlzaChmYWxzZSkpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIFJ1bnMgYGZuYCBvbmNlIGV2ZXJ5IGNhbGwgZW5xdWV1ZWQgYmVmb3JlIGl0IGhhcyBzZXR0bGVkLiBSZXR1cm5zIHdoYXRldmVyIGBmbmAgcmV0dXJucyxcbiAqIGFuZCBwcm9wYWdhdGVzIGl0cyByZWplY3Rpb24gdW5jaGFuZ2VkIOKAlCBlbnF1ZXVlaW5nIG11c3QgYmUgaW52aXNpYmxlIHRvIHRoZSBjYWxsZXJcbiAqIGFwYXJ0IGZyb20gdGhlIG9yZGVyaW5nIGl0IGd1YXJhbnRlZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBlbnF1ZXVlTXV0YXRpb248VD4oZm46ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCBwcmVkZWNlc3NvciA9IHRhaWw7XG4gICAgbGV0IHJlbGVhc2U6ICgpID0+IHZvaWQgPSAoKSA9PiB7fTtcbiAgICB0YWlsID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHsgcmVsZWFzZSA9IHJlc29sdmU7IH0pO1xuICAgIHF1ZXVlZENvdW50Kys7XG5cbiAgICByZXR1cm4gKGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgc2V0dGxlT3JUaW1lb3V0KHByZWRlY2Vzc29yKTtcbiAgICAgICAgcXVldWVkQ291bnQtLTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBmbigpO1xuICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgcmVsZWFzZSgpO1xuICAgICAgICB9XG4gICAgfSkoKTtcbn1cblxuLyoqXG4gKiBOdW1iZXIgb2YgY2FsbHMgZW5xdWV1ZWQgYW5kIHN0aWxsIHdhaXRpbmcgZm9yIGEgdHVybi4gRGVsaWJlcmF0ZWx5IGV4Y2x1ZGVzIHRoZSBjYWxsXG4gKiBjdXJyZW50bHkgcnVubmluZywgc28gYSBoYW5kbGVyIGFza2luZyB0aGlzIHF1ZXN0aW9uIGRvZXMgbm90IGNvdW50IGl0c2VsZjogZnJvbSBpbnNpZGVcbiAqIGBxdWVyeV9kaXJ0eWAgdGhlIGFuc3dlciBpcyBcImhvdyBtYW55IG11dGF0aW9ucyBhcmUgc3RpbGwgcXVldWVkIGJlaGluZCBtZVwiLCB3aGljaCBpc1xuICogZXhhY3RseSB3aGF0IG1ha2VzIGEgYGRpcnR5OiBmYWxzZWAgcmVhZGluZyBmcm9tIHRoZSBlZGl0b3IgdW50cnVzdHdvcnRoeSAoIzYpLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGVuZGluZ011dGF0aW9uQ291bnQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gcXVldWVkQ291bnQ7XG59XG5cbi8qKiBUZXN0LW9ubHk6IGRyb3AgdGhlIGNoYWluIHNvIG9uZSBzdWl0ZSdzIHF1ZXVlIHN0YXRlIGNhbm5vdCBsZWFrIGludG8gdGhlIG5leHQuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzZXRNdXRhdGlvblF1ZXVlKCk6IHZvaWQge1xuICAgIHRhaWwgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICBxdWV1ZWRDb3VudCA9IDA7XG59XG4iXX0=