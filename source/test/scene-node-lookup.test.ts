import { findNodeByUuidDeep } from '../scene-node-lookup';

/**
 * Regression tests for issue #31 — `scene.getChildByUuid()` only searches direct
 * children (depth 1) of the node it's called on. `source/scene.ts` called it against
 * the scene ROOT for ~20 tools routed through the scene-script bridge, so any node
 * nested two or more levels deep silently resolved to "not found".
 */
describe('findNodeByUuidDeep', () => {
    function makeNode(uuid: string, children: any[] = []) {
        return { uuid, children };
    }

    it('finds a direct child (depth 1)', () => {
        const child = makeNode('child-1');
        const root = makeNode('root', [child]);
        expect(findNodeByUuidDeep(root, 'child-1')).toBe(child);
    });

    it('finds a node nested 4 levels deep', () => {
        const leaf = makeNode('leaf');
        const depth3 = makeNode('depth-3', [leaf]);
        const depth2 = makeNode('depth-2', [depth3]);
        const depth1 = makeNode('depth-1', [depth2]);
        const root = makeNode('root', [depth1]);

        expect(findNodeByUuidDeep(root, 'leaf')).toBe(leaf);
    });

    it('finds a node among several siblings at each level', () => {
        const target = makeNode('target');
        const root = makeNode('root', [
            makeNode('sibling-a', [makeNode('nested-a1'), makeNode('nested-a2')]),
            makeNode('sibling-b', [makeNode('nested-b1'), target]),
            makeNode('sibling-c'),
        ]);

        expect(findNodeByUuidDeep(root, 'target')).toBe(target);
    });

    it('returns null when the uuid does not exist anywhere in the tree', () => {
        const root = makeNode('root', [makeNode('child-1', [makeNode('grandchild-1')])]);
        expect(findNodeByUuidDeep(root, 'does-not-exist')).toBeNull();
    });

    it('returns the root itself when the root matches', () => {
        const root = makeNode('root', [makeNode('child-1')]);
        expect(findNodeByUuidDeep(root, 'root')).toBe(root);
    });

    it('returns null for a null/undefined root or uuid', () => {
        expect(findNodeByUuidDeep(null, 'x')).toBeNull();
        expect(findNodeByUuidDeep(makeNode('root'), '')).toBeNull();
    });

    it('handles nodes with no children array gracefully', () => {
        const root = { uuid: 'root' }; // no `children` property at all
        expect(findNodeByUuidDeep(root, 'anything')).toBeNull();
    });
});
