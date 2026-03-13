/**
 * Pure helper functions for node transform and type detection.
 * Extracted from ManageNode to keep manage-node.ts under 200 lines.
 */

/** Determine if a node is a 2D node based on its components and position */
export function is2DNode(nodeInfo: any): boolean {
    const components = nodeInfo.components || [];

    const has2DComponents = components.some((comp: any) =>
        comp.type && (
            comp.type.includes('cc.Sprite') ||
            comp.type.includes('cc.Label') ||
            comp.type.includes('cc.Button') ||
            comp.type.includes('cc.Layout') ||
            comp.type.includes('cc.Widget') ||
            comp.type.includes('cc.Mask') ||
            comp.type.includes('cc.Graphics')
        )
    );
    if (has2DComponents) return true;

    const has3DComponents = components.some((comp: any) =>
        comp.type && (
            comp.type.includes('cc.MeshRenderer') ||
            comp.type.includes('cc.Camera') ||
            comp.type.includes('cc.Light') ||
            comp.type.includes('cc.DirectionalLight') ||
            comp.type.includes('cc.PointLight') ||
            comp.type.includes('cc.SpotLight')
        )
    );
    if (has3DComponents) return false;

    const position = nodeInfo.position;
    if (position && Math.abs(position.z) < 0.001) return true;
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

    if (componentType.includes('cc.Sprite') || componentType.includes('cc.Label') ||
        componentType.includes('cc.Button') || componentType.includes('cc.Layout') ||
        componentType.includes('cc.Widget') || componentType.includes('cc.Mask') ||
        componentType.includes('cc.Graphics')) {
        return '2D';
    }

    if (componentType.includes('cc.MeshRenderer') || componentType.includes('cc.Camera') ||
        componentType.includes('cc.Light') || componentType.includes('cc.DirectionalLight') ||
        componentType.includes('cc.PointLight') || componentType.includes('cc.SpotLight')) {
        return '3D';
    }

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
