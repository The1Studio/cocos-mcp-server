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

export interface SiblingOrderResult {
    /** True when the node sits at the requested index after the call. */
    applied: boolean;
    /** The index the node actually occupies under the parent, or null when it could not be read. */
    actualIndex: number | null;
    /** Why the order could not be applied or confirmed. Present only when `applied` is false. */
    reason?: string;
}

/** Extract a uuid from a `children` entry: a bare string, `{ uuid }`, or an editor dump `{ value: { uuid } }`. */
export function childUuidOf(entry: any): string {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return '';
    let ref = entry;
    if (!('uuid' in ref) && ref.value && typeof ref.value === 'object') ref = ref.value;
    const raw = ref.uuid;
    if (raw && typeof raw === 'object' && 'value' in raw) return raw.value || '';
    return typeof raw === 'string' ? raw : '';
}

async function readChildUuids(parentUuid: string): Promise<string[] | null> {
    const dump: any = await Editor.Message.request('scene', 'query-node', parentUuid);
    const children = dump?.children;
    if (!Array.isArray(children)) return null;
    return children.map(childUuidOf);
}

/**
 * Move `nodeUuid` to `targetIndex` among the children of `parentUuid`.
 * An index past the end clamps to the last position, matching `Node.setSiblingIndex`.
 */
export async function applySiblingIndex(parentUuid: string, nodeUuid: string, targetIndex: number): Promise<SiblingOrderResult> {
    try {
        const before = await readChildUuids(parentUuid);
        if (!before) return { applied: false, actualIndex: null, reason: `could not read the children of parent '${parentUuid}'` };
        const current = before.indexOf(nodeUuid);
        if (current < 0) return { applied: false, actualIndex: null, reason: `node '${nodeUuid}' is not listed under parent '${parentUuid}'` };

        const wanted = Math.min(targetIndex, before.length - 1);
        if (wanted !== current) {
            const accepted: any = await Editor.Message.request('scene', 'move-array-element', {
                uuid: parentUuid, path: 'children', target: current, offset: wanted - current
            });
            if (accepted === false) {
                return { applied: false, actualIndex: current, reason: `the editor rejected move-array-element on '${parentUuid}'.children` };
            }
        }

        const after = await readChildUuids(parentUuid);
        const actualIndex = after ? after.indexOf(nodeUuid) : -1;
        if (actualIndex < 0) return { applied: false, actualIndex: null, reason: 'the node order could not be read back after the move' };
        if (actualIndex !== wanted) {
            return { applied: false, actualIndex, reason: `expected index ${wanted} but the node is at index ${actualIndex}` };
        }
        return { applied: true, actualIndex };
    } catch (err: any) {
        return { applied: false, actualIndex: null, reason: err?.message || String(err) };
    }
}
