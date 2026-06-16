/**
 * Pure helper functions for node transform and type detection.
 * Extracted from ManageNode to keep manage-node.ts under 200 lines.
 */

/**
 * Component type substrings that identify a 2D (UI) node.
 * `cc.UITransform` is the canonical marker — Cocos auto-adds it to every UI
 * component (Sprite/Label/Button/...), so its presence is the reliable 2D signal.
 */
const COMPONENT_TYPES_2D = [
    'cc.UITransform',
    'cc.Canvas',
    'cc.Sprite',
    'cc.Label',
    'cc.Button',
    'cc.Layout',
    'cc.Widget',
    'cc.Mask',
    'cc.Graphics'
];

/** Component type substrings that identify a 3D node. */
const COMPONENT_TYPES_3D = [
    'cc.MeshRenderer',
    'cc.Camera',
    'cc.Light',
    'cc.DirectionalLight',
    'cc.PointLight',
    'cc.SpotLight'
];

function matchesAnyType(componentType: string, list: string[]): boolean {
    return !!componentType && list.some(t => componentType.includes(t));
}

/** True if the component type is a 2D/UI component. */
export function is2DComponentType(componentType: string): boolean {
    return matchesAnyType(componentType, COMPONENT_TYPES_2D);
}

/** True if the component type is a 3D component. */
export function is3DComponentType(componentType: string): boolean {
    return matchesAnyType(componentType, COMPONENT_TYPES_3D);
}

/**
 * Determine if a node is a 2D node based on its components.
 *
 * In Cocos Creator 3.x every Node has a full 3D transform; "2D" is a UI context
 * proven by the presence of a 2D/UI component. A 3D node legitimately sits at the
 * origin (z = 0), so node position MUST NOT be used to infer 2D-ness — doing so
 * misclassifies any 3D node at z≈0 (e.g. a DirectionalLight at the origin) and
 * silently strips its z position and x/y rotation. Default is therefore 3D.
 */
export function is2DNode(nodeInfo: any): boolean {
    const components = nodeInfo.components || [];
    if (components.some((comp: any) => is2DComponentType(comp.type))) return true;
    return false;
}

/** Normalize a transform value for 2D/3D mode. Returns value and optional warning message. */
export function normalizeTransformValue(
    value: any,
    type: 'position' | 'rotation' | 'scale',
    is2D: boolean
): { value: any; warning?: string } {
    const result = { ...value };
    let warning: string | undefined;

    if (is2D) {
        switch (type) {
            case 'position':
                if (value.z !== undefined && Math.abs(value.z) > 0.001) {
                    warning = `2D node: z position (${value.z}) ignored, set to 0`;
                    result.z = 0;
                } else if (value.z === undefined) {
                    result.z = 0;
                }
                break;
            case 'rotation':
                if ((value.x !== undefined && Math.abs(value.x) > 0.001) ||
                    (value.y !== undefined && Math.abs(value.y) > 0.001)) {
                    warning = `2D node: x,y rotations ignored, only z rotation applied`;
                    result.x = 0;
                    result.y = 0;
                } else {
                    result.x = result.x || 0;
                    result.y = result.y || 0;
                }
                result.z = result.z || 0;
                break;
            case 'scale':
                if (value.z === undefined) {
                    result.z = 1;
                }
                break;
        }
    } else {
        result.x = result.x !== undefined ? result.x : (type === 'scale' ? 1 : 0);
        result.y = result.y !== undefined ? result.y : (type === 'scale' ? 1 : 0);
        result.z = result.z !== undefined ? result.z : (type === 'scale' ? 1 : 0);
    }

    return { value: result, warning };
}

/** Classify a component type as '2D', '3D', or 'generic' */
export function getComponentCategory(componentType: string): string {
    if (!componentType) return 'unknown';
    if (is2DComponentType(componentType)) return '2D';
    if (is3DComponentType(componentType)) return '3D';
    return 'generic';
}

/** Build a slash-separated node path from root to the given node */
export function getNodePath(node: any): string {
    const path = [node.name];
    let current = node.parent;
    while (current && current.parent !== null && current.parent !== undefined) {
        path.unshift(current.name);
        current = current.parent;
    }
    return path.join('/');
}

/** Recursively search a node tree for a node matching targetName */
export function searchNodeInTree(node: any, targetName: string): any {
    if (node.name === targetName) return node;
    if (node.children) {
        for (const child of node.children) {
            const found = searchNodeInTree(child, targetName);
            if (found) return found;
        }
    }
    return null;
}
