"use strict";
/**
 * Sibling ordering for manage_node create/move (issue #99 items 2-3).
 *
 * `scene:set-parent` always appends the node as the LAST child, and `siblingIndex` is not a
 * settable node property in the editor, so the earlier `set-property { path: 'siblingIndex' }`
 * attempt (and the create path's second `set-parent`) never changed the order while the tool
 * reported success. The editor's own hierarchy drag reorders through `scene:move-array-element`
 * on the parent's `children` array — the same message `manage_node_hierarchy move_array_element`
 * uses and which is known to work. This module drives it and reads the parent back, so the
 * caller learns whether the order actually changed instead of being told it did.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.childUuidOf = childUuidOf;
exports.applySiblingIndex = applySiblingIndex;
/** Extract a uuid from a `children` entry: a bare string, `{ uuid }`, or an editor dump `{ value: { uuid } }`. */
function childUuidOf(entry) {
    if (typeof entry === 'string')
        return entry;
    if (!entry || typeof entry !== 'object')
        return '';
    let ref = entry;
    if (!('uuid' in ref) && ref.value && typeof ref.value === 'object')
        ref = ref.value;
    const raw = ref.uuid;
    if (raw && typeof raw === 'object' && 'value' in raw)
        return raw.value || '';
    return typeof raw === 'string' ? raw : '';
}
async function readChildUuids(parentUuid) {
    const dump = await Editor.Message.request('scene', 'query-node', parentUuid);
    const children = dump === null || dump === void 0 ? void 0 : dump.children;
    if (!Array.isArray(children))
        return null;
    return children.map(childUuidOf);
}
/**
 * Move `nodeUuid` to `targetIndex` among the children of `parentUuid`.
 * An index past the end clamps to the last position, matching `Node.setSiblingIndex`.
 */
async function applySiblingIndex(parentUuid, nodeUuid, targetIndex) {
    try {
        const before = await readChildUuids(parentUuid);
        if (!before)
            return { applied: false, actualIndex: null, reason: `could not read the children of parent '${parentUuid}'` };
        const current = before.indexOf(nodeUuid);
        if (current < 0)
            return { applied: false, actualIndex: null, reason: `node '${nodeUuid}' is not listed under parent '${parentUuid}'` };
        const wanted = Math.min(targetIndex, before.length - 1);
        if (wanted !== current) {
            const accepted = await Editor.Message.request('scene', 'move-array-element', {
                uuid: parentUuid, path: 'children', target: current, offset: wanted - current
            });
            if (accepted === false) {
                return { applied: false, actualIndex: current, reason: `the editor rejected move-array-element on '${parentUuid}'.children` };
            }
        }
        const after = await readChildUuids(parentUuid);
        const actualIndex = after ? after.indexOf(nodeUuid) : -1;
        if (actualIndex < 0)
            return { applied: false, actualIndex: null, reason: 'the node order could not be read back after the move' };
        if (actualIndex !== wanted) {
            return { applied: false, actualIndex, reason: `expected index ${wanted} but the node is at index ${actualIndex}` };
        }
        return { applied: true, actualIndex };
    }
    catch (err) {
        return { applied: false, actualIndex: null, reason: (err === null || err === void 0 ? void 0 : err.message) || String(err) };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLW5vZGUtc2libGluZy1vcmRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2Utbm9kZS1zaWJsaW5nLW9yZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7OztHQVVHOztBQVlILGtDQVFDO0FBYUQsOENBMkJDO0FBakRELGtIQUFrSDtBQUNsSCxTQUFnQixXQUFXLENBQUMsS0FBVTtJQUNsQyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVE7UUFBRSxPQUFPLEtBQUssQ0FBQztJQUM1QyxJQUFJLENBQUMsS0FBSyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVE7UUFBRSxPQUFPLEVBQUUsQ0FBQztJQUNuRCxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7SUFDaEIsSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxLQUFLLElBQUksT0FBTyxHQUFHLENBQUMsS0FBSyxLQUFLLFFBQVE7UUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQztJQUNwRixNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO0lBQ3JCLElBQUksR0FBRyxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksR0FBRztRQUFFLE9BQU8sR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7SUFDN0UsT0FBTyxPQUFPLEdBQUcsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO0FBQzlDLENBQUM7QUFFRCxLQUFLLFVBQVUsY0FBYyxDQUFDLFVBQWtCO0lBQzVDLE1BQU0sSUFBSSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNsRixNQUFNLFFBQVEsR0FBRyxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsUUFBUSxDQUFDO0lBQ2hDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQzFDLE9BQU8sUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQ7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLGlCQUFpQixDQUFDLFVBQWtCLEVBQUUsUUFBZ0IsRUFBRSxXQUFtQjtJQUM3RixJQUFJLENBQUM7UUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRCxJQUFJLENBQUMsTUFBTTtZQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLDBDQUEwQyxVQUFVLEdBQUcsRUFBRSxDQUFDO1FBQzNILE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDekMsSUFBSSxPQUFPLEdBQUcsQ0FBQztZQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLFNBQVMsUUFBUSxpQ0FBaUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUV2SSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3hELElBQUksTUFBTSxLQUFLLE9BQU8sRUFBRSxDQUFDO1lBQ3JCLE1BQU0sUUFBUSxHQUFRLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLG9CQUFvQixFQUFFO2dCQUM5RSxJQUFJLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxHQUFHLE9BQU87YUFDaEYsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxRQUFRLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ3JCLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLDhDQUE4QyxVQUFVLFlBQVksRUFBRSxDQUFDO1lBQ2xJLENBQUM7UUFDTCxDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDL0MsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6RCxJQUFJLFdBQVcsR0FBRyxDQUFDO1lBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsc0RBQXNELEVBQUUsQ0FBQztRQUNsSSxJQUFJLFdBQVcsS0FBSyxNQUFNLEVBQUUsQ0FBQztZQUN6QixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsTUFBTSxFQUFFLGtCQUFrQixNQUFNLDZCQUE2QixXQUFXLEVBQUUsRUFBRSxDQUFDO1FBQ3ZILENBQUM7UUFDRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsQ0FBQztJQUMxQyxDQUFDO0lBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztRQUNoQixPQUFPLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFBLEdBQUcsYUFBSCxHQUFHLHVCQUFILEdBQUcsQ0FBRSxPQUFPLEtBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7SUFDdEYsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNpYmxpbmcgb3JkZXJpbmcgZm9yIG1hbmFnZV9ub2RlIGNyZWF0ZS9tb3ZlIChpc3N1ZSAjOTkgaXRlbXMgMi0zKS5cbiAqXG4gKiBgc2NlbmU6c2V0LXBhcmVudGAgYWx3YXlzIGFwcGVuZHMgdGhlIG5vZGUgYXMgdGhlIExBU1QgY2hpbGQsIGFuZCBgc2libGluZ0luZGV4YCBpcyBub3QgYVxuICogc2V0dGFibGUgbm9kZSBwcm9wZXJ0eSBpbiB0aGUgZWRpdG9yLCBzbyB0aGUgZWFybGllciBgc2V0LXByb3BlcnR5IHsgcGF0aDogJ3NpYmxpbmdJbmRleCcgfWBcbiAqIGF0dGVtcHQgKGFuZCB0aGUgY3JlYXRlIHBhdGgncyBzZWNvbmQgYHNldC1wYXJlbnRgKSBuZXZlciBjaGFuZ2VkIHRoZSBvcmRlciB3aGlsZSB0aGUgdG9vbFxuICogcmVwb3J0ZWQgc3VjY2Vzcy4gVGhlIGVkaXRvcidzIG93biBoaWVyYXJjaHkgZHJhZyByZW9yZGVycyB0aHJvdWdoIGBzY2VuZTptb3ZlLWFycmF5LWVsZW1lbnRgXG4gKiBvbiB0aGUgcGFyZW50J3MgYGNoaWxkcmVuYCBhcnJheSDigJQgdGhlIHNhbWUgbWVzc2FnZSBgbWFuYWdlX25vZGVfaGllcmFyY2h5IG1vdmVfYXJyYXlfZWxlbWVudGBcbiAqIHVzZXMgYW5kIHdoaWNoIGlzIGtub3duIHRvIHdvcmsuIFRoaXMgbW9kdWxlIGRyaXZlcyBpdCBhbmQgcmVhZHMgdGhlIHBhcmVudCBiYWNrLCBzbyB0aGVcbiAqIGNhbGxlciBsZWFybnMgd2hldGhlciB0aGUgb3JkZXIgYWN0dWFsbHkgY2hhbmdlZCBpbnN0ZWFkIG9mIGJlaW5nIHRvbGQgaXQgZGlkLlxuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgU2libGluZ09yZGVyUmVzdWx0IHtcbiAgICAvKiogVHJ1ZSB3aGVuIHRoZSBub2RlIHNpdHMgYXQgdGhlIHJlcXVlc3RlZCBpbmRleCBhZnRlciB0aGUgY2FsbC4gKi9cbiAgICBhcHBsaWVkOiBib29sZWFuO1xuICAgIC8qKiBUaGUgaW5kZXggdGhlIG5vZGUgYWN0dWFsbHkgb2NjdXBpZXMgdW5kZXIgdGhlIHBhcmVudCwgb3IgbnVsbCB3aGVuIGl0IGNvdWxkIG5vdCBiZSByZWFkLiAqL1xuICAgIGFjdHVhbEluZGV4OiBudW1iZXIgfCBudWxsO1xuICAgIC8qKiBXaHkgdGhlIG9yZGVyIGNvdWxkIG5vdCBiZSBhcHBsaWVkIG9yIGNvbmZpcm1lZC4gUHJlc2VudCBvbmx5IHdoZW4gYGFwcGxpZWRgIGlzIGZhbHNlLiAqL1xuICAgIHJlYXNvbj86IHN0cmluZztcbn1cblxuLyoqIEV4dHJhY3QgYSB1dWlkIGZyb20gYSBgY2hpbGRyZW5gIGVudHJ5OiBhIGJhcmUgc3RyaW5nLCBgeyB1dWlkIH1gLCBvciBhbiBlZGl0b3IgZHVtcCBgeyB2YWx1ZTogeyB1dWlkIH0gfWAuICovXG5leHBvcnQgZnVuY3Rpb24gY2hpbGRVdWlkT2YoZW50cnk6IGFueSk6IHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiBlbnRyeSA9PT0gJ3N0cmluZycpIHJldHVybiBlbnRyeTtcbiAgICBpZiAoIWVudHJ5IHx8IHR5cGVvZiBlbnRyeSAhPT0gJ29iamVjdCcpIHJldHVybiAnJztcbiAgICBsZXQgcmVmID0gZW50cnk7XG4gICAgaWYgKCEoJ3V1aWQnIGluIHJlZikgJiYgcmVmLnZhbHVlICYmIHR5cGVvZiByZWYudmFsdWUgPT09ICdvYmplY3QnKSByZWYgPSByZWYudmFsdWU7XG4gICAgY29uc3QgcmF3ID0gcmVmLnV1aWQ7XG4gICAgaWYgKHJhdyAmJiB0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHJhdykgcmV0dXJuIHJhdy52YWx1ZSB8fCAnJztcbiAgICByZXR1cm4gdHlwZW9mIHJhdyA9PT0gJ3N0cmluZycgPyByYXcgOiAnJztcbn1cblxuYXN5bmMgZnVuY3Rpb24gcmVhZENoaWxkVXVpZHMocGFyZW50VXVpZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmdbXSB8IG51bGw+IHtcbiAgICBjb25zdCBkdW1wOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgcGFyZW50VXVpZCk7XG4gICAgY29uc3QgY2hpbGRyZW4gPSBkdW1wPy5jaGlsZHJlbjtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoY2hpbGRyZW4pKSByZXR1cm4gbnVsbDtcbiAgICByZXR1cm4gY2hpbGRyZW4ubWFwKGNoaWxkVXVpZE9mKTtcbn1cblxuLyoqXG4gKiBNb3ZlIGBub2RlVXVpZGAgdG8gYHRhcmdldEluZGV4YCBhbW9uZyB0aGUgY2hpbGRyZW4gb2YgYHBhcmVudFV1aWRgLlxuICogQW4gaW5kZXggcGFzdCB0aGUgZW5kIGNsYW1wcyB0byB0aGUgbGFzdCBwb3NpdGlvbiwgbWF0Y2hpbmcgYE5vZGUuc2V0U2libGluZ0luZGV4YC5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFwcGx5U2libGluZ0luZGV4KHBhcmVudFV1aWQ6IHN0cmluZywgbm9kZVV1aWQ6IHN0cmluZywgdGFyZ2V0SW5kZXg6IG51bWJlcik6IFByb21pc2U8U2libGluZ09yZGVyUmVzdWx0PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYmVmb3JlID0gYXdhaXQgcmVhZENoaWxkVXVpZHMocGFyZW50VXVpZCk7XG4gICAgICAgIGlmICghYmVmb3JlKSByZXR1cm4geyBhcHBsaWVkOiBmYWxzZSwgYWN0dWFsSW5kZXg6IG51bGwsIHJlYXNvbjogYGNvdWxkIG5vdCByZWFkIHRoZSBjaGlsZHJlbiBvZiBwYXJlbnQgJyR7cGFyZW50VXVpZH0nYCB9O1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gYmVmb3JlLmluZGV4T2Yobm9kZVV1aWQpO1xuICAgICAgICBpZiAoY3VycmVudCA8IDApIHJldHVybiB7IGFwcGxpZWQ6IGZhbHNlLCBhY3R1YWxJbmRleDogbnVsbCwgcmVhc29uOiBgbm9kZSAnJHtub2RlVXVpZH0nIGlzIG5vdCBsaXN0ZWQgdW5kZXIgcGFyZW50ICcke3BhcmVudFV1aWR9J2AgfTtcblxuICAgICAgICBjb25zdCB3YW50ZWQgPSBNYXRoLm1pbih0YXJnZXRJbmRleCwgYmVmb3JlLmxlbmd0aCAtIDEpO1xuICAgICAgICBpZiAod2FudGVkICE9PSBjdXJyZW50KSB7XG4gICAgICAgICAgICBjb25zdCBhY2NlcHRlZDogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnbW92ZS1hcnJheS1lbGVtZW50Jywge1xuICAgICAgICAgICAgICAgIHV1aWQ6IHBhcmVudFV1aWQsIHBhdGg6ICdjaGlsZHJlbicsIHRhcmdldDogY3VycmVudCwgb2Zmc2V0OiB3YW50ZWQgLSBjdXJyZW50XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChhY2NlcHRlZCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBhcHBsaWVkOiBmYWxzZSwgYWN0dWFsSW5kZXg6IGN1cnJlbnQsIHJlYXNvbjogYHRoZSBlZGl0b3IgcmVqZWN0ZWQgbW92ZS1hcnJheS1lbGVtZW50IG9uICcke3BhcmVudFV1aWR9Jy5jaGlsZHJlbmAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFmdGVyID0gYXdhaXQgcmVhZENoaWxkVXVpZHMocGFyZW50VXVpZCk7XG4gICAgICAgIGNvbnN0IGFjdHVhbEluZGV4ID0gYWZ0ZXIgPyBhZnRlci5pbmRleE9mKG5vZGVVdWlkKSA6IC0xO1xuICAgICAgICBpZiAoYWN0dWFsSW5kZXggPCAwKSByZXR1cm4geyBhcHBsaWVkOiBmYWxzZSwgYWN0dWFsSW5kZXg6IG51bGwsIHJlYXNvbjogJ3RoZSBub2RlIG9yZGVyIGNvdWxkIG5vdCBiZSByZWFkIGJhY2sgYWZ0ZXIgdGhlIG1vdmUnIH07XG4gICAgICAgIGlmIChhY3R1YWxJbmRleCAhPT0gd2FudGVkKSB7XG4gICAgICAgICAgICByZXR1cm4geyBhcHBsaWVkOiBmYWxzZSwgYWN0dWFsSW5kZXgsIHJlYXNvbjogYGV4cGVjdGVkIGluZGV4ICR7d2FudGVkfSBidXQgdGhlIG5vZGUgaXMgYXQgaW5kZXggJHthY3R1YWxJbmRleH1gIH07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgYXBwbGllZDogdHJ1ZSwgYWN0dWFsSW5kZXggfTtcbiAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICByZXR1cm4geyBhcHBsaWVkOiBmYWxzZSwgYWN0dWFsSW5kZXg6IG51bGwsIHJlYXNvbjogZXJyPy5tZXNzYWdlIHx8IFN0cmluZyhlcnIpIH07XG4gICAgfVxufVxuIl19