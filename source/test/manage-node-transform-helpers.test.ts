import {
    is2DNode,
    is2DComponentType,
    is3DComponentType,
    normalizeTransformValue,
    getComponentCategory,
} from '../tools/manage-node-transform-helpers';

describe('is2DNode', () => {
    it('treats a node with a UITransform as 2D', () => {
        expect(is2DNode({ components: [{ type: 'cc.UITransform' }] })).toBe(true);
    });

    it('treats a node with a Sprite as 2D', () => {
        expect(is2DNode({ components: [{ type: 'cc.Sprite' }] })).toBe(true);
    });

    // Regression: theonekit-cocos#60 — a 3D node (DirectionalLight) at the origin
    // (z ≈ 0) was misclassified as 2D, silently stripping its x/y rotation and z.
    it('treats a DirectionalLight at the origin as 3D', () => {
        const node = { components: [{ type: 'cc.DirectionalLight' }], position: { x: 0, y: 0, z: 0 } };
        expect(is2DNode(node)).toBe(false);
    });

    it('does NOT use z≈0 position to infer 2D for a bare node', () => {
        const node = { components: [], position: { x: 0, y: 0, z: 0 } };
        expect(is2DNode(node)).toBe(false);
    });

    it('treats a bare node with no components as 3D regardless of position', () => {
        expect(is2DNode({ components: [], position: { x: 1, y: 2, z: 5 } })).toBe(false);
        expect(is2DNode({})).toBe(false);
    });
});

describe('is2DComponentType / is3DComponentType', () => {
    it('classifies canonical 2D markers', () => {
        expect(is2DComponentType('cc.UITransform')).toBe(true);
        expect(is2DComponentType('cc.Canvas')).toBe(true);
        expect(is2DComponentType('cc.Label')).toBe(true);
    });
    it('classifies 3D components', () => {
        expect(is3DComponentType('cc.DirectionalLight')).toBe(true);
        expect(is3DComponentType('cc.MeshRenderer')).toBe(true);
        expect(is3DComponentType('cc.UITransform')).toBe(false);
    });
});

describe('normalizeTransformValue', () => {
    it('preserves full x/y/z rotation for a 3D node', () => {
        const { value, warning } = normalizeTransformValue({ x: -50, y: -30, z: 0 }, 'rotation', false);
        expect(value).toEqual({ x: -50, y: -30, z: 0 });
        expect(warning).toBeUndefined();
    });

    it('preserves a non-zero z position for a 3D node', () => {
        const { value, warning } = normalizeTransformValue({ x: 0, y: 0, z: 10 }, 'position', false);
        expect(value.z).toBe(10);
        expect(warning).toBeUndefined();
    });

    it('strips x/y rotation and warns for a 2D node', () => {
        const { value, warning } = normalizeTransformValue({ x: -50, y: -30, z: 15 }, 'rotation', true);
        expect(value).toMatchObject({ x: 0, y: 0, z: 15 });
        expect(warning).toMatch(/x,y rotations ignored/);
    });
});

describe('getComponentCategory', () => {
    it('categorizes 2D, 3D, and generic components', () => {
        expect(getComponentCategory('cc.UITransform')).toBe('2D');
        expect(getComponentCategory('cc.DirectionalLight')).toBe('3D');
        expect(getComponentCategory('cc.MyCustomScript')).toBe('generic');
        expect(getComponentCategory('')).toBe('unknown');
    });
});
