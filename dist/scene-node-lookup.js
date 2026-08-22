"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findNodeByUuidDeep = findNodeByUuidDeep;
/**
 * Recursively search a Cocos Creator scene-graph node (and all descendants) for the
 * node matching the given uuid.
 *
 * `Node.getChildByUuid()` only searches the DIRECT children of the node it is called
 * on (depth 1). `source/scene.ts` calls it against the scene ROOT (`scene.getChildByUuid`),
 * so any node nested two or more levels deep in the hierarchy — the overwhelming
 * majority of a real scene — silently resolved to "not found" for every tool routed
 * through the scene-script bridge (manage_camera, manage_physics, manage_terrain,
 * manage_component's script-name resolution, and ~20 others).
 *
 * Kept dependency-free (no `cc`/`Editor` import) so it is unit-testable without the
 * Cocos Creator editor process.
 */
function findNodeByUuidDeep(root, uuid) {
    if (!root || !uuid)
        return null;
    if (root.uuid === uuid)
        return root;
    const children = root.children;
    if (!children || !children.length)
        return null;
    for (const child of children) {
        if (child && child.uuid === uuid)
            return child;
        const found = findNodeByUuidDeep(child, uuid);
        if (found)
            return found;
    }
    return null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtbm9kZS1sb29rdXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUtbm9kZS1sb29rdXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFjQSxnREFXQztBQXpCRDs7Ozs7Ozs7Ozs7OztHQWFHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQUMsSUFBUyxFQUFFLElBQVk7SUFDdEQsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLElBQUk7UUFBRSxPQUFPLElBQUksQ0FBQztJQUNoQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSTtRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDL0IsSUFBSSxDQUFDLFFBQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFDL0MsS0FBSyxNQUFNLEtBQUssSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUMzQixJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLElBQUk7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUMvQyxNQUFNLEtBQUssR0FBRyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUMsSUFBSSxLQUFLO1lBQUUsT0FBTyxLQUFLLENBQUM7SUFDNUIsQ0FBQztJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJlY3Vyc2l2ZWx5IHNlYXJjaCBhIENvY29zIENyZWF0b3Igc2NlbmUtZ3JhcGggbm9kZSAoYW5kIGFsbCBkZXNjZW5kYW50cykgZm9yIHRoZVxuICogbm9kZSBtYXRjaGluZyB0aGUgZ2l2ZW4gdXVpZC5cbiAqXG4gKiBgTm9kZS5nZXRDaGlsZEJ5VXVpZCgpYCBvbmx5IHNlYXJjaGVzIHRoZSBESVJFQ1QgY2hpbGRyZW4gb2YgdGhlIG5vZGUgaXQgaXMgY2FsbGVkXG4gKiBvbiAoZGVwdGggMSkuIGBzb3VyY2Uvc2NlbmUudHNgIGNhbGxzIGl0IGFnYWluc3QgdGhlIHNjZW5lIFJPT1QgKGBzY2VuZS5nZXRDaGlsZEJ5VXVpZGApLFxuICogc28gYW55IG5vZGUgbmVzdGVkIHR3byBvciBtb3JlIGxldmVscyBkZWVwIGluIHRoZSBoaWVyYXJjaHkg4oCUIHRoZSBvdmVyd2hlbG1pbmdcbiAqIG1ham9yaXR5IG9mIGEgcmVhbCBzY2VuZSDigJQgc2lsZW50bHkgcmVzb2x2ZWQgdG8gXCJub3QgZm91bmRcIiBmb3IgZXZlcnkgdG9vbCByb3V0ZWRcbiAqIHRocm91Z2ggdGhlIHNjZW5lLXNjcmlwdCBicmlkZ2UgKG1hbmFnZV9jYW1lcmEsIG1hbmFnZV9waHlzaWNzLCBtYW5hZ2VfdGVycmFpbixcbiAqIG1hbmFnZV9jb21wb25lbnQncyBzY3JpcHQtbmFtZSByZXNvbHV0aW9uLCBhbmQgfjIwIG90aGVycykuXG4gKlxuICogS2VwdCBkZXBlbmRlbmN5LWZyZWUgKG5vIGBjY2AvYEVkaXRvcmAgaW1wb3J0KSBzbyBpdCBpcyB1bml0LXRlc3RhYmxlIHdpdGhvdXQgdGhlXG4gKiBDb2NvcyBDcmVhdG9yIGVkaXRvciBwcm9jZXNzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZE5vZGVCeVV1aWREZWVwKHJvb3Q6IGFueSwgdXVpZDogc3RyaW5nKTogYW55IHwgbnVsbCB7XG4gICAgaWYgKCFyb290IHx8ICF1dWlkKSByZXR1cm4gbnVsbDtcbiAgICBpZiAocm9vdC51dWlkID09PSB1dWlkKSByZXR1cm4gcm9vdDtcbiAgICBjb25zdCBjaGlsZHJlbiA9IHJvb3QuY2hpbGRyZW47XG4gICAgaWYgKCFjaGlsZHJlbiB8fCAhY2hpbGRyZW4ubGVuZ3RoKSByZXR1cm4gbnVsbDtcbiAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCAmJiBjaGlsZC51dWlkID09PSB1dWlkKSByZXR1cm4gY2hpbGQ7XG4gICAgICAgIGNvbnN0IGZvdW5kID0gZmluZE5vZGVCeVV1aWREZWVwKGNoaWxkLCB1dWlkKTtcbiAgICAgICAgaWYgKGZvdW5kKSByZXR1cm4gZm91bmQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xufVxuIl19