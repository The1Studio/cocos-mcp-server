import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import {
    createWidget, createLabel, createButton, createSprite,
    createLayout, createScrollView, createEditBox
} from './manage-ui-create-helpers';

export class ManageUI extends BaseActionTool {
    readonly name = 'manage_ui';
    readonly description = 'Manage UI nodes and components in the scene. Actions: create_widget, create_label, create_button, create_sprite, create_layout, create_scrollview, create_editbox, set_widget, set_label_property, set_sprite_property, get_info, list_ui_nodes. Use this for building 2D UI layouts with Cocos Creator UI components.';
    readonly actions = [
        'create_widget', 'create_label', 'create_button', 'create_sprite',
        'create_layout', 'create_scrollview', 'create_editbox',
        'set_widget', 'set_label_property', 'set_sprite_property',
        'get_info', 'list_ui_nodes'
    ];

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: [
                    'create_widget', 'create_label', 'create_button', 'create_sprite',
                    'create_layout', 'create_scrollview', 'create_editbox',
                    'set_widget', 'set_label_property', 'set_sprite_property',
                    'get_info', 'list_ui_nodes'
                ],
                description: 'Action to perform on UI nodes and components'
            },
            parentUuid: {
                type: 'string',
                description: '[create_*] Parent node UUID. Use manage_node action=get_all to find UUIDs.'
            },
            nodeUuid: {
                type: 'string',
                description: '[set_widget, set_label_property, set_sprite_property, get_info] Target node UUID'
            },
            // create_widget
            alignment: {
                type: 'string',
                enum: ['top', 'bottom', 'left', 'right', 'center', 'stretch'],
                description: '[create_widget] Widget alignment preset',
                default: 'center'
            },
            margins: {
                type: 'object',
                properties: {
                    top: { type: 'number' },
                    bottom: { type: 'number' },
                    left: { type: 'number' },
                    right: { type: 'number' }
                },
                description: '[create_widget, set_widget] Margin values for alignment anchors'
            },
            // create_label
            text: {
                type: 'string',
                description: '[create_label, create_button] Label or button text content'
            },
            fontSize: {
                type: 'number',
                description: '[create_label] Font size in pixels',
                default: 20
            },
            color: {
                type: 'string',
                description: '[create_label, create_button] Hex color string (e.g., #FFFFFF)'
            },
            horizontalAlign: {
                type: 'number',
                description: '[create_label] Horizontal alignment: 0=LEFT, 1=CENTER, 2=RIGHT'
            },
            verticalAlign: {
                type: 'number',
                description: '[create_label] Vertical alignment: 0=TOP, 1=CENTER, 2=BOTTOM'
            },
            overflow: {
                type: 'number',
                description: '[create_label] Text overflow mode: 0=NONE, 1=CLAMP, 2=SHRINK, 3=RESIZE_HEIGHT'
            },
            // create_button
            normalColor: {
                type: 'string',
                description: '[create_button] Hex color for normal state'
            },
            hoverColor: {
                type: 'string',
                description: '[create_button] Hex color for hover state'
            },
            pressedColor: {
                type: 'string',
                description: '[create_button] Hex color for pressed state'
            },
            // create_sprite
            spriteFrameUuid: {
                type: 'string',
                description: '[create_sprite] UUID of the sprite frame asset'
            },
            type: {
                type: 'string',
                enum: ['SIMPLE', 'SLICED', 'TILED', 'FILLED'],
                description: '[create_sprite] Sprite render type'
            },
            sizeMode: {
                type: 'number',
                description: '[create_sprite] Size mode: 0=CUSTOM, 1=TRIMMED, 2=RAW'
            },
            // create_layout
            layoutType: {
                type: 'string',
                enum: ['HORIZONTAL', 'VERTICAL', 'GRID'],
                description: '[create_layout] Layout direction type',
                default: 'HORIZONTAL'
            },
            spacingX: {
                type: 'number',
                description: '[create_layout] Horizontal spacing between children',
                default: 0
            },
            spacingY: {
                type: 'number',
                description: '[create_layout] Vertical spacing between children',
                default: 0
            },
            padding: {
                type: 'number',
                description: '[create_layout] Uniform padding on all sides',
                default: 0
            },
            // create_scrollview
            direction: {
                type: 'string',
                enum: ['vertical', 'horizontal', 'both'],
                description: '[create_scrollview] Scroll direction',
                default: 'vertical'
            },
            // create_editbox
            placeholder: {
                type: 'string',
                description: '[create_editbox] Placeholder text'
            },
            maxLength: {
                type: 'number',
                description: '[create_editbox] Maximum character length',
                default: 20
            },
            // set_widget
            isAlignTop: { type: 'boolean', description: '[set_widget] Enable top alignment anchor' },
            top: { type: 'number', description: '[set_widget] Top anchor margin value' },
            isAlignBottom: { type: 'boolean', description: '[set_widget] Enable bottom alignment anchor' },
            bottom: { type: 'number', description: '[set_widget] Bottom anchor margin value' },
            isAlignLeft: { type: 'boolean', description: '[set_widget] Enable left alignment anchor' },
            left: { type: 'number', description: '[set_widget] Left anchor margin value' },
            isAlignRight: { type: 'boolean', description: '[set_widget] Enable right alignment anchor' },
            right: { type: 'number', description: '[set_widget] Right anchor margin value' },
            // set_label_property / set_sprite_property
            property: {
                type: 'string',
                description: '[set_label_property] Property name: string|fontSize|color|lineHeight|overflow. [set_sprite_property] Property name: spriteFrame|type|sizeMode|color'
            },
            value: {
                description: '[set_label_property, set_sprite_property] New property value'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        create_widget: (args) => createWidget(args),
        create_label: (args) => createLabel(args),
        create_button: (args) => createButton(args),
        create_sprite: (args) => createSprite(args),
        create_layout: (args) => createLayout({ ...args, type: args.layoutType || args.type }),
        create_scrollview: (args) => createScrollView(args),
        create_editbox: (args) => createEditBox(args),
        set_widget: (args) => this.setWidget(args),
        set_label_property: (args) => this.setLabelProperty(args),
        set_sprite_property: (args) => this.setSpriteProperty(args),
        get_info: (args) => this.getUIInfo(args.nodeUuid),
        list_ui_nodes: () => this.listUINodes()
    };

    private async setWidget(args: any): Promise<ActionToolResult> {
        const { nodeUuid, isAlignTop, top, isAlignBottom, bottom, isAlignLeft, left, isAlignRight, right } = args;
        if (!nodeUuid) return errorResult('nodeUuid is required for set_widget');
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeData?.__comps__) return errorResult('Node not found or has no components');

            const comps: any[] = nodeData.__comps__;
            const widgetIdx = comps.findIndex((c: any) => (c.__type__ || c.cid || c.type) === 'cc.Widget');
            if (widgetIdx < 0) return errorResult('cc.Widget component not found on node. Add it first with manage_component action=add.');

            const setP = async (prop: string, val: any) => {
                await Editor.Message.request('scene', 'set-property', {
                    uuid: nodeUuid,
                    path: `__comps__.${widgetIdx}.${prop}`,
                    dump: { value: val }
                });
            };

            if (isAlignTop !== undefined) await setP('isAlignTop', isAlignTop);
            if (top !== undefined) await setP('top', top);
            if (isAlignBottom !== undefined) await setP('isAlignBottom', isAlignBottom);
            if (bottom !== undefined) await setP('bottom', bottom);
            if (isAlignLeft !== undefined) await setP('isAlignLeft', isAlignLeft);
            if (left !== undefined) await setP('left', left);
            if (isAlignRight !== undefined) await setP('isAlignRight', isAlignRight);
            if (right !== undefined) await setP('right', right);

            return successResult({ nodeUuid }, 'Widget alignment updated successfully');
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async setLabelProperty(args: any): Promise<ActionToolResult> {
        const { nodeUuid, property, value } = args;
        if (!nodeUuid || !property || value === undefined) {
            return errorResult('nodeUuid, property, and value are required for set_label_property');
        }
        const allowed = ['string', 'fontSize', 'color', 'lineHeight', 'overflow'];
        if (!allowed.includes(property)) {
            return errorResult(`Invalid label property. Allowed: ${allowed.join(', ')}`);
        }
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeData?.__comps__) return errorResult('Node not found');

            const labelIdx = nodeData.__comps__.findIndex((c: any) => (c.__type__ || c.cid || c.type) === 'cc.Label');
            if (labelIdx < 0) return errorResult('cc.Label component not found on node');

            const finalValue = (property === 'color' && typeof value === 'string') ? hexToRgba(value) : value;
            await Editor.Message.request('scene', 'set-property', {
                uuid: nodeUuid,
                path: `__comps__.${labelIdx}.${property}`,
                dump: { value: finalValue }
            });
            return successResult({ nodeUuid, property, value: finalValue }, `Label.${property} updated`);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async setSpriteProperty(args: any): Promise<ActionToolResult> {
        const { nodeUuid, property, value } = args;
        if (!nodeUuid || !property || value === undefined) {
            return errorResult('nodeUuid, property, and value are required for set_sprite_property');
        }
        const allowed = ['spriteFrame', 'type', 'sizeMode', 'color'];
        if (!allowed.includes(property)) {
            return errorResult(`Invalid sprite property. Allowed: ${allowed.join(', ')}`);
        }
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeData?.__comps__) return errorResult('Node not found');

            const spriteIdx = nodeData.__comps__.findIndex((c: any) => (c.__type__ || c.cid || c.type) === 'cc.Sprite');
            if (spriteIdx < 0) return errorResult('cc.Sprite component not found on node');

            let finalValue = value;
            if (property === 'color' && typeof value === 'string') finalValue = hexToRgba(value);
            if (property === 'spriteFrame' && typeof value === 'string') finalValue = { __uuid__: value };

            await Editor.Message.request('scene', 'set-property', {
                uuid: nodeUuid,
                path: `__comps__.${spriteIdx}.${property}`,
                dump: { value: finalValue }
            });
            return successResult({ nodeUuid, property, value: finalValue }, `Sprite.${property} updated`);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async getUIInfo(nodeUuid: string): Promise<ActionToolResult> {
        if (!nodeUuid) return errorResult('nodeUuid is required for get_info');
        try {
            const nodeData: any = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeData?.__comps__) return errorResult('Node not found or has no components');

            const uiTypes = ['cc.UITransform', 'cc.Widget', 'cc.Label', 'cc.Sprite', 'cc.Button',
                'cc.Layout', 'cc.ScrollView', 'cc.EditBox', 'cc.Mask', 'cc.Graphics',
                'cc.RichText', 'cc.ProgressBar', 'cc.Slider', 'cc.Toggle', 'cc.ToggleContainer'];

            const uiComponents = nodeData.__comps__
                .filter((c: any) => uiTypes.includes(c.__type__ || c.cid || c.type))
                .map((c: any) => ({
                    type: c.__type__ || c.cid || c.type,
                    enabled: c.enabled !== undefined ? c.enabled : true
                }));

            return successResult({
                nodeUuid,
                name: nodeData.name?.value || 'Unknown',
                uiComponents,
                hasUITransform: uiComponents.some((c: any) => c.type === 'cc.UITransform'),
                hasWidget: uiComponents.some((c: any) => c.type === 'cc.Widget')
            });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async listUINodes(): Promise<ActionToolResult> {
        try {
            const tree: any = await Editor.Message.request('scene', 'query-node-tree');
            const uiNodes: any[] = [];
            const uiComponentTypes = ['cc.UITransform', 'cc.Widget', 'cc.Label', 'cc.Sprite',
                'cc.Button', 'cc.Layout', 'cc.ScrollView', 'cc.EditBox'];

            const traverse = async (node: any) => {
                try {
                    const nodeData: any = await Editor.Message.request('scene', 'query-node', node.uuid);
                    if (nodeData?.__comps__) {
                        const comps: string[] = nodeData.__comps__.map((c: any) => c.__type__ || c.cid || c.type || 'Unknown');
                        const isUINode = comps.some(t => uiComponentTypes.includes(t));
                        if (isUINode) {
                            uiNodes.push({ uuid: node.uuid, name: node.name, components: comps.filter(t => uiComponentTypes.includes(t)) });
                        }
                    }
                } catch {
                    // skip unreadable nodes
                }
                if (node.children) {
                    for (const child of node.children) await traverse(child);
                }
            };

            if (tree) await traverse(tree);
            return successResult({ uiNodes, count: uiNodes.length });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.substring(0, 2), 16) || 0,
        g: parseInt(clean.substring(2, 4), 16) || 0,
        b: parseInt(clean.substring(4, 6), 16) || 0,
        a: clean.length >= 8 ? parseInt(clean.substring(6, 8), 16) : 255
    };
}
