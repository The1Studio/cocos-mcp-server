import { ActionToolResult, successResult, errorResult } from '../types';

/** Create a basic UI node with UITransform, then add components one by one */
async function createNodeWithComponents(
    name: string,
    parentUuid: string | undefined,
    components: string[]
): Promise<{ uuid: string }> {
    const opts: any = { name };
    if (parentUuid) opts.parent = parentUuid;

    const raw = await Editor.Message.request('scene', 'create-node', opts);
    const uuid: string = Array.isArray(raw) ? raw[0] : raw as string;

    // Add components sequentially
    for (const comp of components) {
        try {
            await Editor.Message.request('scene', 'create-component', { uuid, component: comp });
            await new Promise(r => setTimeout(r, 50));
        } catch (e) {
            console.warn(`[manage-ui] Failed to add component ${comp}:`, e);
        }
    }
    return { uuid };
}

/** Set a component property via Editor.Message scene API */
async function setProp(nodeUuid: string, compIndex: number, prop: string, value: any): Promise<void> {
    const path = `__comps__.${compIndex}.${prop}`;
    try {
        await Editor.Message.request('scene', 'set-property', {
            uuid: nodeUuid,
            path,
            dump: { value }
        });
    } catch (e) {
        console.warn(`[manage-ui] Failed to set ${path}:`, e);
    }
}

/** Get raw node data with __comps__ array */
async function queryNode(uuid: string): Promise<any> {
    return Editor.Message.request('scene', 'query-node', uuid);
}

/** Find component index in __comps__ array by type string */
function findCompIndex(comps: any[], type: string): number {
    return comps.findIndex((c: any) => (c.__type__ || c.cid || c.type) === type);
}

export async function createWidget(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, alignment = 'center', margins = {} } = args;
        const { uuid } = await createNodeWithComponents('Widget', parentUuid, ['cc.UITransform', 'cc.Widget']);

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        if (!nodeData?.__comps__) return successResult({ uuid }, 'Widget node created');

        const widgetIdx = findCompIndex(nodeData.__comps__, 'cc.Widget');
        if (widgetIdx >= 0) {
            const m = { top: 0, bottom: 0, left: 0, right: 0, ...margins };
            const isStretch = alignment === 'stretch';
            const isTop = alignment === 'top' || isStretch;
            const isBottom = alignment === 'bottom' || isStretch;
            const isLeft = alignment === 'left' || isStretch;
            const isRight = alignment === 'right' || isStretch;

            await setProp(uuid, widgetIdx, 'isAlignTop', isTop);
            await setProp(uuid, widgetIdx, 'isAlignBottom', isBottom);
            await setProp(uuid, widgetIdx, 'isAlignLeft', isLeft);
            await setProp(uuid, widgetIdx, 'isAlignRight', isRight);
            if (isTop) await setProp(uuid, widgetIdx, 'top', m.top);
            if (isBottom) await setProp(uuid, widgetIdx, 'bottom', m.bottom);
            if (isLeft) await setProp(uuid, widgetIdx, 'left', m.left);
            if (isRight) await setProp(uuid, widgetIdx, 'right', m.right);
        }

        return successResult({ uuid, alignment, margins }, `Widget node created with alignment=${alignment}`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

export async function createLabel(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, text = '', fontSize = 20, color, horizontalAlign, verticalAlign, overflow } = args;
        const { uuid } = await createNodeWithComponents('Label', parentUuid, ['cc.UITransform', 'cc.Label']);

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        if (!nodeData?.__comps__) return successResult({ uuid }, 'Label node created');

        const labelIdx = findCompIndex(nodeData.__comps__, 'cc.Label');
        if (labelIdx >= 0) {
            await setProp(uuid, labelIdx, 'string', text);
            await setProp(uuid, labelIdx, 'fontSize', fontSize);
            if (color) {
                const c = typeof color === 'string' ? hexToRgba(color) : color;
                await setProp(uuid, labelIdx, 'color', c);
            }
            if (horizontalAlign !== undefined) await setProp(uuid, labelIdx, 'horizontalAlign', horizontalAlign);
            if (verticalAlign !== undefined) await setProp(uuid, labelIdx, 'verticalAlign', verticalAlign);
            if (overflow !== undefined) await setProp(uuid, labelIdx, 'overflow', overflow);
        }

        return successResult({ uuid, text, fontSize }, `Label node created`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

export async function createButton(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, text = 'Button', normalColor, hoverColor, pressedColor } = args;
        const { uuid } = await createNodeWithComponents(
            'Button',
            parentUuid,
            ['cc.UITransform', 'cc.Button', 'cc.Sprite']
        );

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        const buttonIdx = nodeData?.__comps__ ? findCompIndex(nodeData.__comps__, 'cc.Button') : -1;

        if (buttonIdx >= 0) {
            if (normalColor) await setProp(uuid, buttonIdx, 'normalColor', hexToRgba(normalColor));
            if (hoverColor) await setProp(uuid, buttonIdx, 'hoverColor', hexToRgba(hoverColor));
            if (pressedColor) await setProp(uuid, buttonIdx, 'pressedColor', hexToRgba(pressedColor));
        }

        // Create child Label
        const labelOpts: any = { name: 'Label', parent: uuid };
        const rawLabel = await Editor.Message.request('scene', 'create-node', labelOpts);
        const labelUuid: string = Array.isArray(rawLabel) ? rawLabel[0] : rawLabel as string;
        await Editor.Message.request('scene', 'create-component', { uuid: labelUuid, component: 'cc.UITransform' });
        await new Promise(r => setTimeout(r, 50));
        await Editor.Message.request('scene', 'create-component', { uuid: labelUuid, component: 'cc.Label' });
        await new Promise(r => setTimeout(r, 100));

        const labelNodeData = await queryNode(labelUuid);
        const childLabelIdx = labelNodeData?.__comps__ ? findCompIndex(labelNodeData.__comps__, 'cc.Label') : -1;
        if (childLabelIdx >= 0) {
            await setProp(labelUuid, childLabelIdx, 'string', text);
        }

        return successResult({ uuid, labelUuid, text }, `Button node created`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

export async function createSprite(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, spriteFrameUuid, type, sizeMode } = args;
        const { uuid } = await createNodeWithComponents('Sprite', parentUuid, ['cc.UITransform', 'cc.Sprite']);

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        if (!nodeData?.__comps__) return successResult({ uuid }, 'Sprite node created');

        const spriteIdx = findCompIndex(nodeData.__comps__, 'cc.Sprite');
        if (spriteIdx >= 0) {
            if (spriteFrameUuid) {
                await setProp(uuid, spriteIdx, 'spriteFrame', { __uuid__: spriteFrameUuid });
            }
            if (type) await setProp(uuid, spriteIdx, 'type', type);
            if (sizeMode !== undefined) await setProp(uuid, spriteIdx, 'sizeMode', sizeMode);
        }

        return successResult({ uuid, spriteFrameUuid, type }, `Sprite node created`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

export async function createLayout(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, type = 'HORIZONTAL', spacingX = 0, spacingY = 0, padding = 0 } = args;
        const { uuid } = await createNodeWithComponents('Layout', parentUuid, ['cc.UITransform', 'cc.Layout']);

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        if (!nodeData?.__comps__) return successResult({ uuid }, 'Layout node created');

        const layoutIdx = findCompIndex(nodeData.__comps__, 'cc.Layout');
        if (layoutIdx >= 0) {
            const layoutTypeMap: Record<string, number> = { NONE: 0, HORIZONTAL: 1, VERTICAL: 2, GRID: 3 };
            const layoutType = layoutTypeMap[type] ?? 1;
            await setProp(uuid, layoutIdx, 'type', layoutType);
            await setProp(uuid, layoutIdx, 'spacingX', spacingX);
            await setProp(uuid, layoutIdx, 'spacingY', spacingY);
            const p = typeof padding === 'number' ? padding : 0;
            await setProp(uuid, layoutIdx, 'paddingTop', p);
            await setProp(uuid, layoutIdx, 'paddingBottom', p);
            await setProp(uuid, layoutIdx, 'paddingLeft', p);
            await setProp(uuid, layoutIdx, 'paddingRight', p);
        }

        return successResult({ uuid, type, spacingX, spacingY }, `Layout node created with type=${type}`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

export async function createScrollView(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, direction = 'vertical' } = args;
        const { uuid } = await createNodeWithComponents('ScrollView', parentUuid, ['cc.UITransform', 'cc.ScrollView']);

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        if (nodeData?.__comps__) {
            const svIdx = findCompIndex(nodeData.__comps__, 'cc.ScrollView');
            if (svIdx >= 0) {
                const horizontal = direction === 'horizontal' || direction === 'both';
                const vertical = direction === 'vertical' || direction === 'both';
                await setProp(uuid, svIdx, 'horizontal', horizontal);
                await setProp(uuid, svIdx, 'vertical', vertical);
            }
        }

        return successResult({ uuid, direction }, `ScrollView node created with direction=${direction}`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

export async function createEditBox(args: any): Promise<ActionToolResult> {
    try {
        const { parentUuid, placeholder = '', maxLength = 20 } = args;
        const { uuid } = await createNodeWithComponents('EditBox', parentUuid, ['cc.UITransform', 'cc.EditBox']);

        await new Promise(r => setTimeout(r, 100));
        const nodeData = await queryNode(uuid);
        if (nodeData?.__comps__) {
            const ebIdx = findCompIndex(nodeData.__comps__, 'cc.EditBox');
            if (ebIdx >= 0) {
                await setProp(uuid, ebIdx, 'placeholder', placeholder);
                await setProp(uuid, ebIdx, 'maxLength', maxLength);
            }
        }

        return successResult({ uuid, placeholder, maxLength }, `EditBox node created`);
    } catch (err: any) {
        return errorResult(err.message);
    }
}

/** Convert hex color string (#RRGGBB or #RRGGBBAA) to {r,g,b,a} object */
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 0;
    const g = parseInt(clean.substring(2, 4), 16) || 0;
    const b = parseInt(clean.substring(4, 6), 16) || 0;
    const a = clean.length >= 8 ? parseInt(clean.substring(6, 8), 16) : 255;
    return { r, g, b, a };
}
