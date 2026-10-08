/**
 * Prefab-instance boundary detection for component reference writes (issue #48).
 *
 * A reference that crosses a prefab-instance boundary does NOT persist through the
 * normal serialized field. Cocos Creator stores it as a `cc.TargetOverrideInfo`
 * record on the owning instance's `cc.PrefabInfo.targetOverrides`; the field itself
 * serializes as `null` by design. `scene:set-property` writes only the live value —
 * it creates no override record — so the write is real in memory, verifies against a
 * live read-back, and is then lost on save.
 *
 * The post-write check in `applySingleProperty` re-reads the LIVE scene, so it cannot
 * observe this class of loss by construction. This module supplies the missing signal:
 * it does not change the write, it tells the caller the write may not survive a save.
 *
 * Issue #76 widened the scope: the loss is not specific to references. A plain-value or
 * asset write on a component that lives inside a prefab instance reads back verified from the
 * live scene yet was reported as absent from both the prefab asset and the scene's
 * `propertyOverrides` after a save. Whether an instance write lands as an override cannot be
 * observed from a live read-back, so ANY write on a prefab-instance node is reported as
 * live-verified but not persistence-verified (advisory; never changes the write).
 *
 * Detection uses the node dump's `__prefab__` block — the same discriminator
 * `ManageComponent`'s sibling `ManagePrefab.resolvePrefabContext` already drives both
 * `apply-prefab` and `restore-prefab` from.
 */

/** Reference propertyTypes whose value is one or more node UUIDs — the only ones that can cross a prefab boundary. */
export const PREFAB_SENSITIVE_PROPERTY_TYPES = ['node', 'component', 'nodeArray', 'componentArray'] as const;

export interface PrefabOverrideRisk {
    /** True when the reference crosses a prefab-instance boundary and needs a cc.TargetOverrideInfo to survive a save. */
    atRisk: boolean;
    /** Caller-facing explanation. Present only when `atRisk`. */
    warning?: string;
}

const WARNING =
    'Live value set and verified, but this reference crosses a prefab-instance boundary. ' +
    'A cross-prefab reference persists only as a cc.TargetOverrideInfo record on the instance\'s ' +
    'cc.PrefabInfo.targetOverrides — this write does not create one, so the field may read back null ' +
    'after the scene or prefab is saved. Verify the saved asset before relying on this reference.';

const INSTANCE_WARNING =
    'Live value set and verified, but this component sits inside a prefab instance. A property write on ' +
    'an instance persists only if the editor records it as a propertyOverride on the instance, and the ' +
    'live read-back used for changeVerified cannot observe that — reports show such writes verifying ' +
    'live and then missing from the saved scene and prefab (issue #76). Treat the write as ' +
    'persistence-unverified: save, then read the scene/prefab file (or re-query after a reload) before relying on it.';

/**
 * Pull the referenced node UUIDs out of an already-converted property value.
 * `convertPropertyValue` normalises `node`/`nodeArray` to `{ uuid }` shapes and
 * `component`/`componentArray` to bare node-UUID strings, so both spellings land here.
 */
export function extractReferencedNodeUuids(propertyType: string, processedValue: any): string[] {
    if (!(PREFAB_SENSITIVE_PROPERTY_TYPES as readonly string[]).includes(propertyType)) return [];

    const items = Array.isArray(processedValue) ? processedValue : [processedValue];
    const uuids: string[] = [];
    for (const item of items) {
        if (typeof item === 'string' && item) {
            uuids.push(item);
        } else if (item && typeof item === 'object' && typeof item.uuid === 'string' && item.uuid) {
            uuids.push(item.uuid);
        }
    }
    return uuids;
}

/**
 * Identify the prefab instance a node belongs to, or null when it sits in plain scene space.
 * Returns the instance ROOT uuid so two nodes inside the same instance compare equal.
 * A query failure yields null — this check is advisory and must never break a write.
 */
async function prefabInstanceRoot(
    nodeUuid: string,
    queryNode: (uuid: string) => Promise<any>
): Promise<string | null> {
    let dump: any;
    try {
        dump = await queryNode(nodeUuid);
    } catch {
        return null;
    }
    const prefab = dump?.__prefab__;
    if (!prefab) return null;
    return prefab.rootUuid || nodeUuid;
}

/**
 * Report whether a property write may not survive a save because of prefab-instance semantics.
 *
 * Two independent signals, the first more specific so it wins:
 *  1. A REFERENCE write whose component node and referenced node resolve to DIFFERENT
 *     prefab-instance roots (including plain-scene-to-instance and back) needs a
 *     cc.TargetOverrideInfo the editor never creates (issue #48).
 *  2. ANY write on a component whose node is inside a prefab instance may not be recorded as a
 *     propertyOverride (issue #76) — including references between nodes of the SAME instance
 *     and plain values/assets, which signal 1 deliberately did not cover.
 * Nodes outside any instance serialize normally and are not flagged.
 */
export async function detectPrefabOverrideRisk(
    nodeUuid: string,
    propertyType: string,
    processedValue: any,
    queryNode: (uuid: string) => Promise<any>
): Promise<PrefabOverrideRisk> {
    const sourceRoot = await prefabInstanceRoot(nodeUuid, queryNode);

    for (const targetUuid of extractReferencedNodeUuids(propertyType, processedValue)) {
        if (targetUuid === nodeUuid) continue;
        const targetRoot = await prefabInstanceRoot(targetUuid, queryNode);
        if (targetRoot !== sourceRoot) {
            return { atRisk: true, warning: WARNING };
        }
    }

    if (sourceRoot !== null) {
        return { atRisk: true, warning: INSTANCE_WARNING };
    }
    return { atRisk: false };
}
