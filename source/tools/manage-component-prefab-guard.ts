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
 * Report whether a reference write crosses a prefab-instance boundary.
 *
 * At risk when the component's node and a referenced node resolve to DIFFERENT
 * prefab-instance roots — including the plain-scene-to-instance and
 * instance-to-plain-scene directions. Two nodes inside the same instance, and two
 * nodes both outside any instance, serialize normally and are not flagged.
 */
export async function detectPrefabOverrideRisk(
    nodeUuid: string,
    propertyType: string,
    processedValue: any,
    queryNode: (uuid: string) => Promise<any>
): Promise<PrefabOverrideRisk> {
    const targetUuids = extractReferencedNodeUuids(propertyType, processedValue);
    if (targetUuids.length === 0) return { atRisk: false };

    const sourceRoot = await prefabInstanceRoot(nodeUuid, queryNode);
    for (const targetUuid of targetUuids) {
        if (targetUuid === nodeUuid) continue;
        const targetRoot = await prefabInstanceRoot(targetUuid, queryNode);
        if (targetRoot !== sourceRoot) {
            return { atRisk: true, warning: WARNING };
        }
    }
    return { atRisk: false };
}
