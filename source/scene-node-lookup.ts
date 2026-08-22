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
export function findNodeByUuidDeep(root: any, uuid: string): any | null {
    if (!root || !uuid) return null;
    if (root.uuid === uuid) return root;
    const children = root.children;
    if (!children || !children.length) return null;
    for (const child of children) {
        if (child && child.uuid === uuid) return child;
        const found = findNodeByUuidDeep(child, uuid);
        if (found) return found;
    }
    return null;
}
