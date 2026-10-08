"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.readOverrideSnapshot = readOverrideSnapshot;
exports.describeOverrideLoss = describeOverrideLoss;
exports.statMtimeMs = statMtimeMs;
exports.waitForFileRewrite = waitForFileRewrite;
exports.readPrefabRootActive = readPrefabRootActive;
const fs = __importStar(require("fs"));
/** The serialized record type Cocos uses to persist a cross-prefab-boundary reference. */
const TARGET_OVERRIDE_TYPE = 'cc.TargetOverrideInfo';
/**
 * Count the `cc.TargetOverrideInfo` records in a serialized scene/prefab file.
 *
 * Returns `null` when the file cannot be read or is not JSON — "unreadable" is reported as
 * unreadable, never as "zero overrides", so an unreadable file cannot masquerade as a
 * clean one and silently disable the guard below.
 */
function readOverrideSnapshot(filePath) {
    if (!filePath)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch (_a) {
        return null;
    }
    const propertyPaths = [];
    const seen = new Set();
    const walk = (node) => {
        if (!node || typeof node !== 'object' || seen.has(node))
            return;
        seen.add(node);
        if (Array.isArray(node)) {
            for (const item of node)
                walk(item);
            return;
        }
        if (node.__type__ === TARGET_OVERRIDE_TYPE) {
            propertyPaths.push(Array.isArray(node.propertyPath) ? node.propertyPath.join('.') : '');
        }
        for (const value of Object.values(node))
            walk(value);
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
function describeOverrideLoss(before, after) {
    // An unreadable side makes the comparison inconclusive, not clean — say nothing here
    // and let the caller report the snapshot as unverifiable rather than as a pass.
    if (!before || !after)
        return null;
    const remaining = [...after.propertyPaths];
    const lost = [];
    for (const path of before.propertyPaths) {
        const idx = remaining.indexOf(path);
        if (idx === -1)
            lost.push(path);
        else
            remaining.splice(idx, 1);
    }
    if (lost.length === 0)
        return null;
    const named = [...new Set(lost)].map(p => (p ? `propertyPath ["${p.split('.').join('", "')}"]` : '(no propertyPath)'));
    return `${lost.length} cc.TargetOverrideInfo record(s) were present before the save and are absent after it: ` +
        `${named.join(', ')}. Cross-prefab references are stored only as these records — losing one silently re-aims ` +
        `the property at the prefab's own internal node.`;
}
/** File mtime in ms, or null when the path does not exist / cannot be stat'd. */
function statMtimeMs(filePath) {
    if (!filePath)
        return null;
    try {
        return fs.statSync(filePath).mtimeMs;
    }
    catch (_a) {
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
async function waitForFileRewrite(filePath, baselineMs, timeoutMs = 2000, pollMs = 50) {
    if (!filePath)
        return null;
    const deadline = Date.now() + timeoutMs;
    let mtime = statMtimeMs(filePath);
    while (mtime !== null && mtime <= baselineMs && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, pollMs));
        mtime = statMtimeMs(filePath);
    }
    return mtime;
}
/**
 * The persisted `_active` of a `.prefab` file's root node, or `null` when it cannot be read.
 *
 * Follows `cc.Prefab.data` to the root node entry (falling back to the first `cc.Node` when
 * `data` is absent) and returns its `_active` only when that is a real boolean — an
 * unreadable file, a non-prefab shape or a missing field is "unknown", never `false`, so it
 * cannot masquerade as a root that was saved inactive (#99 item 4).
 */
function readPrefabRootActive(filePath) {
    var _a, _b, _c;
    if (!filePath)
        return null;
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch (_d) {
        return null;
    }
    if (!Array.isArray(parsed))
        return null;
    const dataIndex = (_b = (_a = parsed[0]) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.__id__;
    const root = typeof dataIndex === 'number' && ((_c = parsed[dataIndex]) === null || _c === void 0 ? void 0 : _c.__type__) === 'cc.Node'
        ? parsed[dataIndex]
        : parsed.find((entry) => (entry === null || entry === void 0 ? void 0 : entry.__type__) === 'cc.Node');
    return typeof (root === null || root === void 0 ? void 0 : root._active) === 'boolean' ? root._active : null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2F2ZS1hcnRpZmFjdC1ndWFyZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS91dGlscy9zYXZlLWFydGlmYWN0LWd1YXJkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0FvQkc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBcUJILG9EQTZCQztBQVNELG9EQWtCQztBQUdELGtDQU9DO0FBVUQsZ0RBY0M7QUFVRCxvREFjQztBQXJJRCx1Q0FBeUI7QUFFekIsMEZBQTBGO0FBQzFGLE1BQU0sb0JBQW9CLEdBQUcsdUJBQXVCLENBQUM7QUFTckQ7Ozs7OztHQU1HO0FBQ0gsU0FBZ0Isb0JBQW9CLENBQUMsUUFBdUI7SUFDeEQsSUFBSSxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUUzQixJQUFJLE1BQVcsQ0FBQztJQUNoQixJQUFJLENBQUM7UUFDRCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFBQyxXQUFNLENBQUM7UUFDTCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBRUQsTUFBTSxhQUFhLEdBQWEsRUFBRSxDQUFDO0lBQ25DLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxFQUFPLENBQUM7SUFDNUIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFTLEVBQVEsRUFBRTtRQUM3QixJQUFJLENBQUMsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU87UUFDaEUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVmLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQ3RCLEtBQUssTUFBTSxJ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LFFBQVEsTUFBSyxTQUFTLENBQUMsQ0FBQztJQUNqRSxPQUFPLE9BQU8sQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsT0FBTyxDQUFBLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDcEUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2F2ZS10aW1lIGFydGlmYWN0IHZlcmlmaWNhdGlvbiBmb3Igc2NlbmUvcHJlZmFiIHdyaXRlcyAoIzYsICM3OCkuXG4gKlxuICogYHNjZW5lOnNhdmUtc2NlbmVgIHJlc29sdmluZyBgdHJ1ZWAsIGFuZCBgc2NlbmU6cXVlcnktZGlydHlgIHJlYWRpbmcgYGZhbHNlYCwgYXJlIGJvdGhcbiAqIHNpZ25hbHMgYWJvdXQgdGhlIEVESVRPUidzIGluLW1lbW9yeSB2aWV3LiBOZWl0aGVyIGlzIGEgc3RhdGVtZW50IGFib3V0IHRoZSBmaWxlIG9uIGRpc2ssXG4gKiBhbmQgYSBzYXZlIGNhbiBzZXJpYWxpc2UgdGhhdCB2aWV3IGxvc3NpbHkgd2hpbGUgYm90aCBzdGF5IGdyZWVuOlxuICpcbiAqICAtICM2ICB0aGUgcGVuZGluZyBlZGl0IGlzIG5ldmVyIHNlcmlhbGlzZWQgYXQgYWxsIOKAlCB0aGUgZmlsZSdzIG10aW1lIGRvZXMgbm90IGFkdmFuY2UsXG4gKiAgICAgICAgYGdpdCBkaWZmYCBzaG93cyBub3RoaW5nLCBhbmQgdGhlIGNhbGxlciBpcyB0b2xkIFwiU2NlbmUgc2F2ZWQgc3VjY2Vzc2Z1bGx5XCIuXG4gKiAgLSAjNzggYW4gVU5FRElURUQgcm91bmQtdHJpcCBkcm9wcyBgY2MuVGFyZ2V0T3ZlcnJpZGVJbmZvYCByZWNvcmRzIOKAlCB0aGUgZmlsZSBJU1xuICogICAgICAgIHJld3JpdHRlbiwgc28gdGhlIG10aW1lIHNpZ25hbCBpcyBncmVlbiB0b28sIGFuZCB0aGUgbG9zcyBpcyBidXJpZWQgaW4gYVxuICogICAgICAgIHdob2xlLWZpbGUgcmVzZXJpYWxpc2F0aW9uICh+MjcwMCBjaGFuZ2VkIGxpbmVzIGluIHRoZSByZXBvcnRlZCByZXBybykuXG4gKlxuICogVGhlIG9ubHkgc2lnbmFsIHRoYXQgZGVzY3JpYmVzIHRoZSBhcnRpZmFjdCBpcyB0aGUgYXJ0aWZhY3QuIFRoaXMgbW9kdWxlIHN1cHBsaWVzIHR3b1xuICogY2hlYXAgcmVhZHMgb2YgaXQg4oCUIGRpZCB0aGUgZmlsZSBnZXQgcmV3cml0dGVuLCBhbmQgZG9lcyBpdCBzdGlsbCBjYXJyeSB0aGUgb3ZlcnJpZGVcbiAqIHJlY29yZHMgaXQgY2FycmllZCBiZWZvcmUg4oCUIHNvIGBzYXZlU2NlbmVgIGNhbiByZXBvcnQgd2hhdCBhY3R1YWxseSBoYXBwZW5lZCBpbnN0ZWFkIG9mXG4gKiB3aGF0IHRoZSBlZGl0b3IgYmVsaWV2ZWQuXG4gKlxuICogS2VwdCBkZXBlbmRlbmN5LWZyZWUgKG5vIGBjY2AvYEVkaXRvcmAgaW1wb3J0KSBzbyBpdCBpcyB1bml0LXRlc3RhYmxlIGFnYWluc3QgcmVhbCBmaWxlc1xuICogd2l0aG91dCBhIENvY29zIENyZWF0b3IgZWRpdG9yIHByb2Nlc3MuXG4gKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuXG4vKiogVGhlIHNlcmlhbGl6ZWQgcmVjb3JkIHR5cGUgQ29jb3MgdXNlcyB0byBwZXJzaXN0IGEgY3Jvc3MtcHJlZmFiLWJvdW5kYXJ5IHJlZmVyZW5jZS4gKi9cbmNvbnN0IFRBUkdFVF9PVkVSUklERV9UWVBFID0gJ2NjLlRhcmdldE92ZXJyaWRlSW5mbyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3ZlcnJpZGVTbmFwc2hvdCB7XG4gICAgLyoqIE51bWJlciBvZiBgY2MuVGFyZ2V0T3ZlcnJpZGVJbmZvYCBvYmplY3RzIHNlcmlhbGl6ZWQgaW4gdGhlIGZpbGUuICovXG4gICAgdG90YWw6IG51bWJlcjtcbiAgICAvKiogVGhlaXIgYHByb3BlcnR5UGF0aGAgdmFsdWVzLCBzbyBhIGRpZmYgY2FuIG5hbWUgV0hJQ0ggcmVjb3JkIHdlbnQgbWlzc2luZy4gKi9cbiAgICBwcm9wZXJ0eVBhdGhzOiBzdHJpbmdbXTtcbn1cblxuLyoqXG4gKiBDb3VudCB0aGUgYGNjLlRhcmdldE92ZXJyaWRlSW5mb2AgcmVjb3JkcyBpbiBhIHNlcmlhbGl6ZWQgc2NlbmUvcHJlZmFiIGZpbGUuXG4gKlxuICogUmV0dXJucyBgbnVsbGAgd2hlbiB0aGUgZmlsZSBjYW5ub3QgYmUgcmVhZCBvciBpcyBub3QgSlNPTiDigJQgXCJ1bnJlYWRhYmxlXCIgaXMgcmVwb3J0ZWQgYXNcbiAqIHVucmVhZGFibGUsIG5ldmVyIGFzIFwiemVybyBvdmVycmlkZXNcIiwgc28gYW4gdW5yZWFkYWJsZSBmaWxlIGNhbm5vdCBtYXNxdWVyYWRlIGFzIGFcbiAqIGNsZWFuIG9uZSBhbmQgc2lsZW50bHkgZGlzYWJsZSB0aGUgZ3VhcmQgYmVsb3cuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkT3ZlcnJpZGVTbmFwc2hvdChmaWxlUGF0aDogc3RyaW5nIHwgbnVsbCk6IE92ZXJyaWRlU25hcHNob3QgfCBudWxsIHtcbiAgICBpZiAoIWZpbGVQYXRoKSByZXR1cm4gbnVsbDtcblxuICAgIGxldCBwYXJzZWQ6IGFueTtcbiAgICB0cnkge1xuICAgICAgICBwYXJzZWQgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBwcm9wZXJ0eVBhdGhzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PGFueT4oKTtcbiAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSk6IHZvaWQgPT4ge1xuICAgICAgICBpZiAoIW5vZGUgfHwgdHlwZW9mIG5vZGUgIT09ICdvYmplY3QnIHx8IHNlZW4uaGFzKG5vZGUpKSByZXR1cm47XG4gICAgICAgIHNlZW4uYWRkKG5vZGUpO1xuXG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KG5vZGUpKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2Ygbm9kZSkgd2FsayhpdGVtKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLl9fdHlwZV9fID09PSBUQVJHRVRfT1ZFUlJJREVfVFlQRSkge1xuICAgICAgICAgICAgcHJvcGVydHlQYXRocy5wdXNoKEFycmF5LmlzQXJyYXkobm9kZS5wcm9wZXJ0eVBhdGgpID8gbm9kZS5wcm9wZXJ0eVBhdGguam9pbignLicpIDogJycpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgT2JqZWN0LnZhbHVlcyhub2RlKSkgd2Fsayh2YWx1ZSk7XG4gICAgfTtcbiAgICB3YWxrKHBhcnNlZCk7XG5cbiAgICByZXR1cm4geyB0b3RhbDogcHJvcGVydHlQYXRocy5sZW5ndGgsIHByb3BlcnR5UGF0aHMgfTtcbn1cblxuLyoqXG4gKiBEZXNjcmliZSBhbiBvdmVycmlkZSBsb3NzLCBvciBudWxsIHdoZW4gbm90aGluZyB3YXMgbG9zdC5cbiAqXG4gKiBBIGRyb3AgaXMgcmVwb3J0ZWQgYnkgaWRlbnRpdHkgKGBwcm9wZXJ0eVBhdGhgKSwgbm90IG9ubHkgYnkgY291bnQ6IGEgc2F2ZSB0aGF0IGRyb3BzIG9uZVxuICogcmVjb3JkIGFuZCB3cml0ZXMgYSBkaWZmZXJlbnQgb25lIGtlZXBzIHRoZSBjb3VudCBzdGFibGUsIGFuZCB0aGUgY291bnQtb25seSBjaGVjayB3b3VsZFxuICogY2FsbCB0aGF0IGEgY2xlYW4gc2F2ZS4gR2FpbmVkIHJlY29yZHMgYXJlIG5vdCBhbiBlcnJvci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlc2NyaWJlT3ZlcnJpZGVMb3NzKGJlZm9yZTogT3ZlcnJpZGVTbmFwc2hvdCB8IG51bGwsIGFmdGVyOiBPdmVycmlkZVNuYXBzaG90IHwgbnVsbCk6IHN0cmluZyB8IG51bGwge1xuICAgIC8vIEFuIHVucmVhZGFibGUgc2lkZSBtYWtlcyB0aGUgY29tcGFyaXNvbiBpbmNvbmNsdXNpdmUsIG5vdCBjbGVhbiDigJQgc2F5IG5vdGhpbmcgaGVyZVxuICAgIC8vIGFuZCBsZXQgdGhlIGNhbGxlciByZXBvcnQgdGhlIHNuYXBzaG90IGFzIHVudmVyaWZpYWJsZSByYXRoZXIgdGhhbiBhcyBhIHBhc3MuXG4gICAgaWYgKCFiZWZvcmUgfHwgIWFmdGVyKSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHJlbWFpbmluZyA9IFsuLi5hZnRlci5wcm9wZXJ0eVBhdGhzXTtcbiAgICBjb25zdCBsb3N0OiBzdHJpbmdbXSA9IFtdO1xuICAgIGZvciAoY29uc3QgcGF0aCBvZiBiZWZvcmUucHJvcGVydHlQYXRocykge1xuICAgICAgICBjb25zdCBpZHggPSByZW1haW5pbmcuaW5kZXhPZihwYXRoKTtcbiAgICAgICAgaWYgKGlkeCA9PT0gLTEpIGxvc3QucHVzaChwYXRoKTtcbiAgICAgICAgZWxzZSByZW1haW5pbmcuc3BsaWNlKGlkeCwgMSk7XG4gICAgfVxuICAgIGlmIChsb3N0Lmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBuYW1lZCA9IFsuLi5uZXcgU2V0KGxvc3QpXS5tYXAocCA9PiAocCA/IGBwcm9wZXJ0eVBhdGggW1wiJHtwLnNwbGl0KCcuJykuam9pbignXCIsIFwiJyl9XCJdYCA6ICcobm8gcHJvcGVydHlQYXRoKScpKTtcbiAgICByZXR1cm4gYCR7bG9zdC5sZW5ndGh9IGNjLlRhcmdldE92ZXJyaWRlSW5mbyByZWNvcmQocykgd2VyZSBwcmVzZW50IGJlZm9yZSB0aGUgc2F2ZSBhbmQgYXJlIGFic2VudCBhZnRlciBpdDogYCArXG4gICAgICAgIGAke25hbWVkLmpvaW4oJywgJyl9LiBDcm9zcy1wcmVmYWIgcmVmZXJlbmNlcyBhcmUgc3RvcmVkIG9ubHkgYXMgdGhlc2UgcmVjb3JkcyDigJQgbG9zaW5nIG9uZSBzaWxlbnRseSByZS1haW1zIGAgK1xuICAgICAgICBgdGhlIHByb3BlcnR5IGF0IHRoZSBwcmVmYWIncyBvd24gaW50ZXJuYWwgbm9kZS5gO1xufVxuXG4vKiogRmlsZSBtdGltZSBpbiBtcywgb3IgbnVsbCB3aGVuIHRoZSBwYXRoIGRvZXMgbm90IGV4aXN0IC8gY2Fubm90IGJlIHN0YXQnZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdGF0TXRpbWVNcyhmaWxlUGF0aDogc3RyaW5nIHwgbnVsbCk6IG51bWJlciB8IG51bGwge1xuICAgIGlmICghZmlsZVBhdGgpIHJldHVybiBudWxsO1xuICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBmcy5zdGF0U3luYyhmaWxlUGF0aCkubXRpbWVNcztcbiAgICB9IGNhdGNoIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufVxuXG4vKipcbiAqIFBvbGwgZm9yIGBmaWxlUGF0aGAgdG8gYmUgcmV3cml0dGVuLCBpLmUuIGl0cyBtdGltZSB0byBtb3ZlIHBhc3QgYGJhc2VsaW5lTXNgLlxuICpcbiAqIFJldHVybnMgdGhlIG5ld2VzdCBvYnNlcnZlZCBtdGltZSDigJQgZXF1YWwgdG8gYGJhc2VsaW5lTXNgIHdoZW4gbm90aGluZyB3YXMgd3JpdHRlbiB3aXRoaW5cbiAqIHRoZSB0aW1lb3V0LiBUaGUgY2FsbGVyIGNvbXBhcmVzLCBzbyBcImRpZCBub3QgYWR2YW5jZVwiIGFuZCBcImFkdmFuY2VkXCIgYXJlIGRpc3Rpbmd1aXNoYWJsZVxuICogd2l0aG91dCB0aGlzIHJldHVybmluZyBhbiBhbWJpZ3VvdXMgbnVsbC4gQSBudWxsIHJldHVybiBtZWFucyB0aGUgZmlsZSBjb3VsZCBub3QgYmVcbiAqIHN0YXQnZCBhdCBhbGwgKG1pc3NpbmcgcGVybWlzc2lvbiwgZGVsZXRlZCksIHdoaWNoIGlzIGEgZGlmZmVyZW50IGFuc3dlciBhZ2Fpbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JGaWxlUmV3cml0ZShcbiAgICBmaWxlUGF0aDogc3RyaW5nIHwgbnVsbCxcbiAgICBiYXNlbGluZU1zOiBudW1iZXIsXG4gICAgdGltZW91dE1zID0gMjAwMCxcbiAgICBwb2xsTXMgPSA1MFxuKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIG51bGw7XG4gICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgdGltZW91dE1zO1xuICAgIGxldCBtdGltZSA9IHN0YXRNdGltZU1zKGZpbGVQYXRoKTtcbiAgICB3aGlsZSAobXRpbWUgIT09IG51bGwgJiYgbXRpbWUgPD0gYmFzZWxpbmVNcyAmJiBEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIHBvbGxNcykpO1xuICAgICAgICBtdGltZSA9IHN0YXRNdGltZU1zKGZpbGVQYXRoKTtcbiAgICB9XG4gICAgcmV0dXJuIG10aW1lO1xufVxuXG4vKipcbiAqIFRoZSBwZXJzaXN0ZWQgYF9hY3RpdmVgIG9mIGEgYC5wcmVmYWJgIGZpbGUncyByb290IG5vZGUsIG9yIGBudWxsYCB3aGVuIGl0IGNhbm5vdCBiZSByZWFkLlxuICpcbiAqIEZvbGxvd3MgYGNjLlByZWZhYi5kYXRhYCB0byB0aGUgcm9vdCBub2RlIGVudHJ5IChmYWxsaW5nIGJhY2sgdG8gdGhlIGZpcnN0IGBjYy5Ob2RlYCB3aGVuXG4gKiBgZGF0YWAgaXMgYWJzZW50KSBhbmQgcmV0dXJucyBpdHMgYF9hY3RpdmVgIG9ubHkgd2hlbiB0aGF0IGlzIGEgcmVhbCBib29sZWFuIOKAlCBhblxuICogdW5yZWFkYWJsZSBmaWxlLCBhIG5vbi1wcmVmYWIgc2hhcGUgb3IgYSBtaXNzaW5nIGZpZWxkIGlzIFwidW5rbm93blwiLCBuZXZlciBgZmFsc2VgLCBzbyBpdFxuICogY2Fubm90IG1hc3F1ZXJhZGUgYXMgYSByb290IHRoYXQgd2FzIHNhdmVkIGluYWN0aXZlICgjOTkgaXRlbSA0KS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlYWRQcmVmYWJSb290QWN0aXZlKGZpbGVQYXRoOiBzdHJpbmcgfCBudWxsKTogYm9vbGVhbiB8IG51bGwge1xuICAgIGlmICghZmlsZVBhdGgpIHJldHVybiBudWxsO1xuICAgIGxldCBwYXJzZWQ6IGFueTtcbiAgICB0cnkge1xuICAgICAgICBwYXJzZWQgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0Zi04JykpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHBhcnNlZCkpIHJldHVybiBudWxsO1xuICAgIGNvbnN0IGRhdGFJbmRleCA9IHBhcnNlZFswXT8uZGF0YT8uX19pZF9fO1xuICAgIGNvbnN0IHJvb3QgPSB0eXBlb2YgZGF0YUluZGV4ID09PSAnbnVtYmVyJyAmJiBwYXJzZWRbZGF0YUluZGV4XT8uX190eXBlX18gPT09ICdjYy5Ob2RlJ1xuICAgICAgICA/IHBhcnNlZFtkYXRhSW5kZXhdXG4gICAgICAgIDogcGFyc2VkLmZpbmQoKGVudHJ5OiBhbnkpID0+IGVudHJ5Py5fX3R5cGVfXyA9PT0gJ2NjLk5vZGUnKTtcbiAgICByZXR1cm4gdHlwZW9mIHJvb3Q/Ll9hY3RpdmUgPT09ICdib29sZWFuJyA/IHJvb3QuX2FjdGl2ZSA6IG51bGw7XG59XG4iXX0=