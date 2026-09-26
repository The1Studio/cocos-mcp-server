/**
 * Save-time artifact verification for scene/prefab writes (#6, #78).
 *
 * `scene:save-scene` resolving `true`, and `scene:query-dirty` reading `false`, are both
 * signals about the EDITOR's in-memory view. Neither is a statement about the file on disk,
 * and a save can serialise that view lossily while both stay green:
 *
 *  - #6  the pending edit is never serialised at all — the file's mtime does not advance,
 *        `git diff` shows nothing, and the caller is told "Scene saved successfully".
 *  - #78 an UNEDITED round-trip drops `cc.TargetOverrideInfo` records — the file IS
 *        rewritten, so the mtime signal is green too, and the loss is buried in a
 *        whole-file reserialisation (~2700 changed lines in the reported repro).
 *
 * The only signal that describes the artifact is the artifact. This module supplies two
 * cheap reads of it — did the file get rewritten, and does it still carry the override
 * records it carried before — so `saveScene` can report what actually happened instead of
 * what the editor believed.
 *
 * Kept dependency-free (no `cc`/`Editor` import) so it is unit-testable against real files
 * without a Cocos Creator editor process.
 */

import * as fs from 'fs';

/** The serialized record type Cocos uses to persist a cross-prefab-boundary reference. */
const TARGET_OVERRIDE_TYPE = 'cc.TargetOverrideInfo';

export interface OverrideSnapshot {
    /** Number of `cc.TargetOverrideInfo` objects serialized in the file. */
    total: number;
    /** Their `propertyPath` values, so a diff can name WHICH record went missing. */
    propertyPaths: string[];
}

/**
 * Count the `cc.TargetOverrideInfo` records in a serialized scene/prefab file.
 *
 * Returns `null` when the file cannot be read or is not JSON — "unreadable" is reported as
 * unreadable, never as "zero overrides", so an unreadable file cannot masquerade as a
 * clean one and silently disable the guard below.
 */
export function readOverrideSnapshot(filePath: string | null): OverrideSnapshot | null {
    if (!filePath) return null;

    let parsed: any;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }

    const propertyPaths: string[] = [];
    const seen = new Set<any>();
    const walk = (node: any): void => {
        if (!node || typeof node !== 'object' || seen.has(node)) return;
        seen.add(node);

        if (Array.isArray(node)) {
            for (const item of node) walk(item);
            return;
        }

        if (node.__type__ === TARGET_OVERRIDE_TYPE) {
            propertyPaths.push(Array.isArray(node.propertyPath) ? node.propertyPath.join('.') : '');
        }
        for (const value of Object.values(node)) walk(value);
    };
    walk(parsed);

    return { total: propertyPaths.length, propertyPaths };
}

/**
 * Describe an override loss, or null when nothing was lost.
 *
 * A drop is reported by identity (`propertyPath`), not only by count: a save that drops one
 * record and writes a different one keeps the count stable, and the count-only check would
 * call that a clean save. Gained records are not an error.
 */
export function describeOverrideLoss(before: OverrideSnapshot | null, after: OverrideSnapshot | null): string | null {
    // An unreadable side makes the comparison inconclusive, not clean — say nothing here
    // and let the caller report the snapshot as unverifiable rather than as a pass.
    if (!before || !after) return null;

    const remaining = [...after.propertyPaths];
    const lost: string[] = [];
    for (const path of before.propertyPaths) {
        const idx = remaining.indexOf(path);
        if (idx === -1) lost.push(path);
        else remaining.splice(idx, 1);
    }
    if (lost.length === 0) return null;

    const named = [...new Set(lost)].map(p => (p ? `propertyPath ["${p.split('.').join('", "')}"]` : '(no propertyPath)'));
    return `${lost.length} cc.TargetOverrideInfo record(s) were present before the save and are absent after it: ` +
        `${named.join(', ')}. Cross-prefab references are stored only as these records — losing one silently re-aims ` +
        `the property at the prefab's own internal node.`;
}

/** File mtime in ms, or null when the path does not exist / cannot be stat'd. */
export function statMtimeMs(filePath: string | null): number | null {
    if (!filePath) return null;
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch {
        return null;
    }
}

/**
 * Poll for `filePath` to be rewritten, i.e. its mtime to move past `baselineMs`.
 *
 * Returns the newest observed mtime — equal to `baselineMs` when nothing was written within
 * the timeout. The caller compares, so "did not advance" and "advanced" are distinguishable
 * without this returning an ambiguous null. A null return means the file could not be
 * stat'd at all (missing permission, deleted), which is a different answer again.
 */
export async function waitForFileRewrite(
    filePath: string | null,
    baselineMs: number,
    timeoutMs = 2000,
    pollMs = 50
): Promise<number | null> {
    if (!filePath) return null;
    const deadline = Date.now() + timeoutMs;
    let mtime = statMtimeMs(filePath);
    while (mtime !== null && mtime <= baselineMs && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, pollMs));
        mtime = statMtimeMs(filePath);
    }
    return mtime;
}
