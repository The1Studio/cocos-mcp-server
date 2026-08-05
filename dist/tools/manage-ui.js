"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageUI = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const manage_ui_create_helpers_1 = require("./manage-ui-create-helpers");
class ManageUI extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_ui';
        this.description = 'Manage UI nodes and components in the scene. Actions: create_widget, create_label, create_button, create_sprite, create_layout, create_scrollview, create_editbox, set_widget, set_label_property, set_sprite_property, get_info, list_ui_nodes. Use this for building 2D UI layouts with Cocos Creator UI components.';
        this.actions = [
            'create_widget', 'create_label', 'create_button', 'create_sprite',
            'create_layout', 'create_scrollview', 'create_editbox',
            'set_widget', 'set_label_property', 'set_sprite_property',
            'get_info', 'list_ui_nodes'
        ];
        this.inputSchema = {
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
        this.actionHandlers = {
            create_widget: (args) => (0, manage_ui_create_helpers_1.createWidget)(args),
            create_label: (args) => (0, manage_ui_create_helpers_1.createLabel)(args),
            create_button: (args) => (0, manage_ui_create_helpers_1.createButton)(args),
            create_sprite: (args) => (0, manage_ui_create_helpers_1.createSprite)(args),
            create_layout: (args) => (0, manage_ui_create_helpers_1.createLayout)(Object.assign(Object.assign({}, args), { type: args.layoutType || args.type })),
            create_scrollview: (args) => (0, manage_ui_create_helpers_1.createScrollView)(args),
            create_editbox: (args) => (0, manage_ui_create_helpers_1.createEditBox)(args),
            set_widget: (args) => this.setWidget(args),
            set_label_property: (args) => this.setLabelProperty(args),
            set_sprite_property: (args) => this.setSpriteProperty(args),
            get_info: (args) => this.getUIInfo(args.nodeUuid),
            list_ui_nodes: () => this.listUINodes()
        };
    }
    async setWidget(args) {
        const { nodeUuid, isAlignTop, top, isAlignBottom, bottom, isAlignLeft, left, isAlignRight, right } = args;
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_widget');
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!(nodeData === null || nodeData === void 0 ? void 0 : nodeData.__comps__))
                return (0, types_1.errorResult)('Node not found or has no components');
            const comps = nodeData.__comps__;
            const widgetIdx = comps.findIndex((c) => (c.__type__ || c.cid || c.type) === 'cc.Widget');
            if (widgetIdx < 0)
                return (0, types_1.errorResult)('cc.Widget component not found on node. Add it first with manage_component action=add.');
            const setP = async (prop, val) => {
                await Editor.Message.request('scene', 'set-property', {
                    uuid: nodeUuid,
                    path: `__comps__.${widgetIdx}.${prop}`,
                    dump: { value: val }
                });
            };
            if (isAlignTop !== undefined)
                await setP('isAlignTop', isAlignTop);
            if (top !== undefined)
                await setP('top', top);
            if (isAlignBottom !== undefined)
                await setP('isAlignBottom', isAlignBottom);
            if (bottom !== undefined)
                await setP('bottom', bottom);
            if (isAlignLeft !== undefined)
                await setP('isAlignLeft', isAlignLeft);
            if (left !== undefined)
                await setP('left', left);
            if (isAlignRight !== undefined)
                await setP('isAlignRight', isAlignRight);
            if (right !== undefined)
                await setP('right', right);
            return (0, types_1.successResult)({ nodeUuid }, 'Widget alignment updated successfully');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setLabelProperty(args) {
        const { nodeUuid, property, value } = args;
        if (!nodeUuid || !property || value === undefined) {
            return (0, types_1.errorResult)('nodeUuid, property, and value are required for set_label_property');
        }
        const allowed = ['string', 'fontSize', 'color', 'lineHeight', 'overflow'];
        if (!allowed.includes(property)) {
            return (0, types_1.errorResult)(`Invalid label property. Allowed: ${allowed.join(', ')}`);
        }
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!(nodeData === null || nodeData === void 0 ? void 0 : nodeData.__comps__))
                return (0, types_1.errorResult)('Node not found');
            const labelIdx = nodeData.__comps__.findIndex((c) => (c.__type__ || c.cid || c.type) === 'cc.Label');
            if (labelIdx < 0)
                return (0, types_1.errorResult)('cc.Label component not found on node');
            const finalValue = (property === 'color' && typeof value === 'string') ? hexToRgba(value) : value;
            await Editor.Message.request('scene', 'set-property', {
                uuid: nodeUuid,
                path: `__comps__.${labelIdx}.${property}`,
                dump: { value: finalValue }
            });
            return (0, types_1.successResult)({ nodeUuid, property, value: finalValue }, `Label.${property} updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setSpriteProperty(args) {
        const { nodeUuid, property, value } = args;
        if (!nodeUuid || !property || value === undefined) {
            return (0, types_1.errorResult)('nodeUuid, property, and value are required for set_sprite_property');
        }
        const allowed = ['spriteFrame', 'type', 'sizeMode', 'color'];
        if (!allowed.includes(property)) {
            return (0, types_1.errorResult)(`Invalid sprite property. Allowed: ${allowed.join(', ')}`);
        }
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!(nodeData === null || nodeData === void 0 ? void 0 : nodeData.__comps__))
                return (0, types_1.errorResult)('Node not found');
            const spriteIdx = nodeData.__comps__.findIndex((c) => (c.__type__ || c.cid || c.type) === 'cc.Sprite');
            if (spriteIdx < 0)
                return (0, types_1.errorResult)('cc.Sprite component not found on node');
            let finalValue = value;
            if (property === 'color' && typeof value === 'string')
                finalValue = hexToRgba(value);
            if (property === 'spriteFrame' && typeof value === 'string')
                finalValue = { __uuid__: value };
            await Editor.Message.request('scene', 'set-property', {
                uuid: nodeUuid,
                path: `__comps__.${spriteIdx}.${property}`,
                dump: { value: finalValue }
            });
            return (0, types_1.successResult)({ nodeUuid, property, value: finalValue }, `Sprite.${property} updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getUIInfo(nodeUuid) {
        var _a;
        if (!nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_info');
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!(nodeData === null || nodeData === void 0 ? void 0 : nodeData.__comps__))
                return (0, types_1.errorResult)('Node not found or has no components');
            const uiTypes = ['cc.UITransform', 'cc.Widget', 'cc.Label', 'cc.Sprite', 'cc.Button',
                'cc.Layout', 'cc.ScrollView', 'cc.EditBox', 'cc.Mask', 'cc.Graphics',
                'cc.RichText', 'cc.ProgressBar', 'cc.Slider', 'cc.Toggle', 'cc.ToggleContainer'];
            const uiComponents = nodeData.__comps__
                .filter((c) => uiTypes.includes(c.__type__ || c.cid || c.type))
                .map((c) => ({
                type: c.__type__ || c.cid || c.type,
                enabled: c.enabled !== undefined ? c.enabled : true
            }));
            return (0, types_1.successResult)({
                nodeUuid,
                name: ((_a = nodeData.name) === null || _a === void 0 ? void 0 : _a.value) || 'Unknown',
                uiComponents,
                hasUITransform: uiComponents.some((c) => c.type === 'cc.UITransform'),
                hasWidget: uiComponents.some((c) => c.type === 'cc.Widget')
            });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listUINodes() {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            const uiNodes = [];
            const uiComponentTypes = ['cc.UITransform', 'cc.Widget', 'cc.Label', 'cc.Sprite',
                'cc.Button', 'cc.Layout', 'cc.ScrollView', 'cc.EditBox'];
            const traverse = async (node) => {
                try {
                    const nodeData = await Editor.Message.request('scene', 'query-node', node.uuid);
                    if (nodeData === null || nodeData === void 0 ? void 0 : nodeData.__comps__) {
                        const comps = nodeData.__comps__.map((c) => c.__type__ || c.cid || c.type || 'Unknown');
                        const isUINode = comps.some(t => uiComponentTypes.includes(t));
                        if (isUINode) {
                            uiNodes.push({ uuid: node.uuid, name: node.name, components: comps.filter(t => uiComponentTypes.includes(t)) });
                        }
                    }
                }
                catch (_a) {
                    // skip unreadable nodes
                }
                if (node.children) {
                    for (const child of node.children)
                        await traverse(child);
                }
            };
            if (tree)
                await traverse(tree);
            return (0, types_1.successResult)({ uiNodes, count: uiNodes.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageUI = ManageUI;
function hexToRgba(hex) {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.substring(0, 2), 16) || 0,
        g: parseInt(clean.substring(2, 4), 16) || 0,
        b: parseInt(clean.substring(4, 6), 16) || 0,
        a: clean.length >= 8 ? parseInt(clean.substring(6, 8), 16) : 255
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXVpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS11aS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLHlFQUdvQztBQUVwQyxNQUFhLFFBQVMsU0FBUSxpQ0FBYztJQUE1Qzs7UUFDYSxTQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ25CLGdCQUFXLEdBQUcsd1RBQXdULENBQUM7UUFDdlUsWUFBTyxHQUFHO1lBQ2YsZUFBZSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsZUFBZTtZQUNqRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsZ0JBQWdCO1lBQ3RELFlBQVksRUFBRSxvQkFBb0IsRUFBRSxxQkFBcUI7WUFDekQsVUFBVSxFQUFFLGVBQWU7U0FDOUIsQ0FBQztRQUVPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRTt3QkFDRixlQUFlLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxlQUFlO3dCQUNqRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsZ0JBQWdCO3dCQUN0RCxZQUFZLEVBQUUsb0JBQW9CLEVBQUUscUJBQXFCO3dCQUN6RCxVQUFVLEVBQUUsZUFBZTtxQkFDOUI7b0JBQ0QsV0FBVyxFQUFFLDhDQUE4QztpQkFDOUQ7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0RUFBNEU7aUJBQzVGO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsa0ZBQWtGO2lCQUNsRztnQkFDRCxnQkFBZ0I7Z0JBQ2hCLFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUs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QUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQzdELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBelVELDRCQXlVQztBQUVELFNBQVMsU0FBUyxDQUFDLEdBQVc7SUFDMUIsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbkMsT0FBTztRQUNILENBQUMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQztRQUMzQyxDQUFDLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUM7UUFDM0MsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDO1FBQzNDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHO0tBQ25FLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHtcclxuICAgIGNyZWF0ZVdpZGdldCwgY3JlYXRlTGFiZWwsIGNyZWF0ZUJ1dHRvbiwgY3JlYXRlU3ByaXRlLFxyXG4gICAgY3JlYXRlTGF5b3V0LCBjcmVhdGVTY3JvbGxWaWV3LCBjcmVhdGVFZGl0Qm94XHJcbn0gZnJvbSAnLi9tYW5hZ2UtdWktY3JlYXRlLWhlbHBlcnMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZVVJIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfdWknO1xyXG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIFVJIG5vZGVzIGFuZCBjb21wb25lbnRzIGluIHRoZSBzY2VuZS4gQWN0aW9uczogY3JlYXRlX3dpZGdldCwgY3JlYXRlX2xhYmVsLCBjcmVhdGVfYnV0dG9uLCBjcmVhdGVfc3ByaXRlLCBjcmVhdGVfbGF5b3V0LCBjcmVhdGVfc2Nyb2xsdmlldywgY3JlYXRlX2VkaXRib3gsIHNldF93aWRnZXQsIHNldF9sYWJlbF9wcm9wZXJ0eSwgc2V0X3Nwcml0ZV9wcm9wZXJ0eSwgZ2V0X2luZm8sIGxpc3RfdWlfbm9kZXMuIFVzZSB0aGlzIGZvciBidWlsZGluZyAyRCBVSSBsYXlvdXRzIHdpdGggQ29jb3MgQ3JlYXRvciBVSSBjb21wb25lbnRzLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gW1xyXG4gICAgICAgICdjcmVhdGVfd2lkZ2V0JywgJ2NyZWF0ZV9sYWJlbCcsICdjcmVhdGVfYnV0dG9uJywgJ2NyZWF0ZV9zcHJpdGUnLFxyXG4gICAgICAgICdjcmVhdGVfbGF5b3V0JywgJ2NyZWF0ZV9zY3JvbGx2aWV3JywgJ2NyZWF0ZV9lZGl0Ym94JyxcclxuICAgICAgICAnc2V0X3dpZGdldCcsICdzZXRfbGFiZWxfcHJvcGVydHknLCAnc2V0X3Nwcml0ZV9wcm9wZXJ0eScsXHJcbiAgICAgICAgJ2dldF9pbmZvJywgJ2xpc3RfdWlfbm9kZXMnXHJcbiAgICBdO1xyXG5cclxuICAgIHJlYWRvbmx5IGlucHV0U2NoZW1hID0ge1xyXG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgYWN0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFtcclxuICAgICAgICAgICAgICAgICAgICAnY3JlYXRlX3dpZGdldCcsICdjcmVhdGVfbGFiZWwnLCAnY3JlYXRlX2J1dHRvbicsICdjcmVhdGVfc3ByaXRlJyxcclxuICAgICAgICAgICAgICAgICAgICAnY3JlYXRlX2xheW91dCcsICdjcmVhdGVfc2Nyb2xsdmlldycsICdjcmVhdGVfZWRpdGJveCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3NldF93aWRnZXQnLCAnc2V0X2xhYmVsX3Byb3BlcnR5JywgJ3NldF9zcHJpdGVfcHJvcGVydHknLFxyXG4gICAgICAgICAgICAgICAgICAgICdnZXRfaW5mbycsICdsaXN0X3VpX25vZGVzJ1xyXG4gICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm0gb24gVUkgbm9kZXMgYW5kIGNvbXBvbmVudHMnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHBhcmVudFV1aWQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXypdIFBhcmVudCBub2RlIFVVSUQuIFVzZSBtYW5hZ2Vfbm9kZSBhY3Rpb249Z2V0X2FsbCB0byBmaW5kIFVVSURzLidcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldCwgc2V0X2xhYmVsX3Byb3BlcnR5LCBzZXRfc3ByaXRlX3Byb3BlcnR5LCBnZXRfaW5mb10gVGFyZ2V0IG5vZGUgVVVJRCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gY3JlYXRlX3dpZGdldFxyXG4gICAgICAgICAgICBhbGlnbm1lbnQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWyd0b3AnLCAnYm90dG9tJywgJ2xlZnQnLCAncmlnaHQnLCAnY2VudGVyJywgJ3N0cmV0Y2gnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV93aWRnZXRdIFdpZGdldCBhbGlnbm1lbnQgcHJlc2V0JyxcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdjZW50ZXInXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG1hcmdpbnM6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgICAgIHRvcDogeyB0eXBlOiAnbnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGJvdHRvbTogeyB0eXBlOiAnbnVtYmVyJyB9LFxyXG4gICAgICAgICAgICAgICAgICAgIGxlZnQ6IHsgdHlwZTogJ251bWJlcicgfSxcclxuICAgICAgICAgICAgICAgICAgICByaWdodDogeyB0eXBlOiAnbnVtYmVyJyB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX3dpZGdldCwgc2V0X3dpZGdldF0gTWFyZ2luIHZhbHVlcyBmb3IgYWxpZ25tZW50IGFuY2hvcnMnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZV9sYWJlbFxyXG4gICAgICAgICAgICB0ZXh0OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYWJlbCwgY3JlYXRlX2J1dHRvbl0gTGFiZWwgb3IgYnV0dG9uIHRleHQgY29udGVudCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZm9udFNpemU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2xhYmVsXSBGb250IHNpemUgaW4gcGl4ZWxzJyxcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDIwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGNvbG9yOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYWJlbCwgY3JlYXRlX2J1dHRvbl0gSGV4IGNvbG9yIHN0cmluZyAoZS5nLiwgI0ZGRkZGRiknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGhvcml6b250YWxBbGlnbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGFiZWxdIEhvcml6b250YWwgYWxpZ25tZW50OiAwPUxFRlQsIDE9Q0VOVEVSLCAyPVJJR0hUJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB2ZXJ0aWNhbEFsaWduOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYWJlbF0gVmVydGljYWwgYWxpZ25tZW50OiAwPVRPUCwgMT1DRU5URVIsIDI9Qk9UVE9NJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBvdmVyZmxvdzoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGFiZWxdIFRleHQgb3ZlcmZsb3cgbW9kZTogMD1OT05FLCAxPUNMQU1QLCAyPVNIUklOSywgMz1SRVNJWkVfSEVJR0hUJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvLyBjcmVhdGVfYnV0dG9uXHJcbiAgICAgICAgICAgIG5vcm1hbENvbG9yOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9idXR0b25dIEhleCBjb2xvciBmb3Igbm9ybWFsIHN0YXRlJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBob3ZlckNvbG9yOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9idXR0b25dIEhleCBjb2xvciBmb3IgaG92ZXIgc3RhdGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHByZXNzZWRDb2xvcjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfYnV0dG9uXSBIZXggY29sb3IgZm9yIHByZXNzZWQgc3RhdGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZV9zcHJpdGVcclxuICAgICAgICAgICAgc3ByaXRlRnJhbWVVdWlkOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9zcHJpdGVdIFVVSUQgb2YgdGhlIHNwcml0ZSBmcmFtZSBhc3NldCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdHlwZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ1NJTVBMRScsICdTTElDRUQnLCAnVElMRUQnLCAnRklMTEVEJ10sXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfc3ByaXRlXSBTcHJpdGUgcmVuZGVyIHR5cGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNpemVNb2RlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9zcHJpdGVdIFNpemUgbW9kZTogMD1DVVNUT00sIDE9VFJJTU1FRCwgMj1SQVcnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZV9sYXlvdXRcclxuICAgICAgICAgICAgbGF5b3V0VHlwZToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ0hPUklaT05UQUwnLCAnVkVSVElDQUwnLCAnR1JJRCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2xheW91dF0gTGF5b3V0IGRpcmVjdGlvbiB0eXBlJyxcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6ICdIT1JJWk9OVEFMJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzcGFjaW5nWDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGF5b3V0XSBIb3Jpem9udGFsIHNwYWNpbmcgYmV0d2VlbiBjaGlsZHJlbicsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNwYWNpbmdZOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYXlvdXRdIFZlcnRpY2FsIHNwYWNpbmcgYmV0d2VlbiBjaGlsZHJlbicsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHBhZGRpbmc6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2xheW91dF0gVW5pZm9ybSBwYWRkaW5nIG9uIGFsbCBzaWRlcycsXHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIC8vIGNyZWF0ZV9zY3JvbGx2aWV3XHJcbiAgICAgICAgICAgIGRpcmVjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3ZlcnRpY2FsJywgJ2hvcml6b250YWwnLCAnYm90aCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX3Njcm9sbHZpZXddIFNjcm9sbCBkaXJlY3Rpb24nLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ3ZlcnRpY2FsJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAvLyBjcmVhdGVfZWRpdGJveFxyXG4gICAgICAgICAgICBwbGFjZWhvbGRlcjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfZWRpdGJveF0gUGxhY2Vob2xkZXIgdGV4dCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbWF4TGVuZ3RoOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9lZGl0Ym94XSBNYXhpbXVtIGNoYXJhY3RlciBsZW5ndGgnLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMjBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgLy8gc2V0X3dpZGdldFxyXG4gICAgICAgICAgICBpc0FsaWduVG9wOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldF0gRW5hYmxlIHRvcCBhbGlnbm1lbnQgYW5jaG9yJyB9LFxyXG4gICAgICAgICAgICB0b3A6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIFRvcCBhbmNob3IgbWFyZ2luIHZhbHVlJyB9LFxyXG4gICAgICAgICAgICBpc0FsaWduQm90dG9tOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldF0gRW5hYmxlIGJvdHRvbSBhbGlnbm1lbnQgYW5jaG9yJyB9LFxyXG4gICAgICAgICAgICBib3R0b206IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIEJvdHRvbSBhbmNob3IgbWFyZ2luIHZhbHVlJyB9LFxyXG4gICAgICAgICAgICBpc0FsaWduTGVmdDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIEVuYWJsZSBsZWZ0IGFsaWdubWVudCBhbmNob3InIH0sXHJcbiAgICAgICAgICAgIGxlZnQ6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIExlZnQgYW5jaG9yIG1hcmdpbiB2YWx1ZScgfSxcclxuICAgICAgICAgICAgaXNBbGlnblJpZ2h0OiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldF0gRW5hYmxlIHJpZ2h0IGFsaWdubWVudCBhbmNob3InIH0sXHJcbiAgICAgICAgICAgIHJpZ2h0OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfd2lkZ2V0XSBSaWdodCBhbmNob3IgbWFyZ2luIHZhbHVlJyB9LFxyXG4gICAgICAgICAgICAvLyBzZXRfbGFiZWxfcHJvcGVydHkgLyBzZXRfc3ByaXRlX3Byb3BlcnR5XHJcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9sYWJlbF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZTogc3RyaW5nfGZvbnRTaXplfGNvbG9yfGxpbmVIZWlnaHR8b3ZlcmZsb3cuIFtzZXRfc3ByaXRlX3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lOiBzcHJpdGVGcmFtZXx0eXBlfHNpemVNb2RlfGNvbG9yJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2xhYmVsX3Byb3BlcnR5LCBzZXRfc3ByaXRlX3Byb3BlcnR5XSBOZXcgcHJvcGVydHkgdmFsdWUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGNyZWF0ZV93aWRnZXQ6IChhcmdzKSA9PiBjcmVhdGVXaWRnZXQoYXJncyksXHJcbiAgICAgICAgY3JlYXRlX2xhYmVsOiAoYXJncykgPT4gY3JlYXRlTGFiZWwoYXJncyksXHJcbiAgICAgICAgY3JlYXRlX2J1dHRvbjogKGFyZ3MpID0+IGNyZWF0ZUJ1dHRvbihhcmdzKSxcclxuICAgICAgICBjcmVhdGVfc3ByaXRlOiAoYXJncykgPT4gY3JlYXRlU3ByaXRlKGFyZ3MpLFxyXG4gICAgICAgIGNyZWF0ZV9sYXlvdXQ6IChhcmdzKSA9PiBjcmVhdGVMYXlvdXQoeyAuLi5hcmdzLCB0eXBlOiBhcmdzLmxheW91dFR5cGUgfHwgYXJncy50eXBlIH0pLFxyXG4gICAgICAgIGNyZWF0ZV9zY3JvbGx2aWV3OiAoYXJncykgPT4gY3JlYXRlU2Nyb2xsVmlldyhhcmdzKSxcclxuICAgICAgICBjcmVhdGVfZWRpdGJveDogKGFyZ3MpID0+IGNyZWF0ZUVkaXRCb3goYXJncyksXHJcbiAgICAgICAgc2V0X3dpZGdldDogKGFyZ3MpID0+IHRoaXMuc2V0V2lkZ2V0KGFyZ3MpLFxyXG4gICAgICAgIHNldF9sYWJlbF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TGFiZWxQcm9wZXJ0eShhcmdzKSxcclxuICAgICAgICBzZXRfc3ByaXRlX3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRTcHJpdGVQcm9wZXJ0eShhcmdzKSxcclxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0VUlJbmZvKGFyZ3Mubm9kZVV1aWQpLFxyXG4gICAgICAgIGxpc3RfdWlfbm9kZXM6ICgpID0+IHRoaXMubGlzdFVJTm9kZXMoKVxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldFdpZGdldChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBjb25zdCB7IG5vZGVVdWlkLCBpc0FsaWduVG9wLCB0b3AsIGlzQWxpZ25Cb3R0b20sIGJvdHRvbSwgaXNBbGlnbkxlZnQsIGxlZnQsIGlzQWxpZ25SaWdodCwgcmlnaHQgfSA9IGFyZ3M7XHJcbiAgICAgICAgaWYgKCFub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3Igc2V0X3dpZGdldCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhPy5fX2NvbXBzX18pIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3IgaGFzIG5vIGNvbXBvbmVudHMnKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbXBzOiBhbnlbXSA9IG5vZGVEYXRhLl9fY29tcHNfXztcclxuICAgICAgICAgICAgY29uc3Qgd2lkZ2V0SWR4ID0gY29tcHMuZmluZEluZGV4KChjOiBhbnkpID0+IChjLl9fdHlwZV9fIHx8IGMuY2lkIHx8IGMudHlwZSkgPT09ICdjYy5XaWRnZXQnKTtcclxuICAgICAgICAgICAgaWYgKHdpZGdldElkeCA8IDApIHJldHVybiBlcnJvclJlc3VsdCgnY2MuV2lkZ2V0IGNvbXBvbmVudCBub3QgZm91bmQgb24gbm9kZS4gQWRkIGl0IGZpcnN0IHdpdGggbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249YWRkLicpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgc2V0UCA9IGFzeW5jIChwcm9wOiBzdHJpbmcsIHZhbDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aDogYF9fY29tcHNfXy4ke3dpZGdldElkeH0uJHtwcm9wfWAsXHJcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogdmFsIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKGlzQWxpZ25Ub3AgIT09IHVuZGVmaW5lZCkgYXdhaXQgc2V0UCgnaXNBbGlnblRvcCcsIGlzQWxpZ25Ub3ApO1xyXG4gICAgICAgICAgICBpZiAodG9wICE9PSB1bmRlZmluZWQpIGF3YWl0IHNldFAoJ3RvcCcsIHRvcCk7XHJcbiAgICAgICAgICAgIGlmIChpc0FsaWduQm90dG9tICE9PSB1bmRlZmluZWQpIGF3YWl0IHNldFAoJ2lzQWxpZ25Cb3R0b20nLCBpc0FsaWduQm90dG9tKTtcclxuICAgICAgICAgICAgaWYgKGJvdHRvbSAhPT0gdW5kZWZpbmVkKSBhd2FpdCBzZXRQKCdib3R0b20nLCBib3R0b20pO1xyXG4gICAgICAgICAgICBpZiAoaXNBbGlnbkxlZnQgIT09IHVuZGVmaW5lZCkgYXdhaXQgc2V0UCgnaXNBbGlnbkxlZnQnLCBpc0FsaWduTGVmdCk7XHJcbiAgICAgICAgICAgIGlmIChsZWZ0ICE9PSB1bmRlZmluZWQpIGF3YWl0IHNldFAoJ2xlZnQnLCBsZWZ0KTtcclxuICAgICAgICAgICAgaWYgKGlzQWxpZ25SaWdodCAhPT0gdW5kZWZpbmVkKSBhd2FpdCBzZXRQKCdpc0FsaWduUmlnaHQnLCBpc0FsaWduUmlnaHQpO1xyXG4gICAgICAgICAgICBpZiAocmlnaHQgIT09IHVuZGVmaW5lZCkgYXdhaXQgc2V0UCgncmlnaHQnLCByaWdodCk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkIH0sICdXaWRnZXQgYWxpZ25tZW50IHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5Jyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRMYWJlbFByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGNvbnN0IHsgbm9kZVV1aWQsIHByb3BlcnR5LCB2YWx1ZSB9ID0gYXJncztcclxuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFwcm9wZXJ0eSB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQsIHByb3BlcnR5LCBhbmQgdmFsdWUgYXJlIHJlcXVpcmVkIGZvciBzZXRfbGFiZWxfcHJvcGVydHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsnc3RyaW5nJywgJ2ZvbnRTaXplJywgJ2NvbG9yJywgJ2xpbmVIZWlnaHQnLCAnb3ZlcmZsb3cnXTtcclxuICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChgSW52YWxpZCBsYWJlbCBwcm9wZXJ0eS4gQWxsb3dlZDogJHthbGxvd2VkLmpvaW4oJywgJyl9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhPy5fX2NvbXBzX18pIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQnKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGxhYmVsSWR4ID0gbm9kZURhdGEuX19jb21wc19fLmZpbmRJbmRleCgoYzogYW55KSA9PiAoYy5fX3R5cGVfXyB8fCBjLmNpZCB8fCBjLnR5cGUpID09PSAnY2MuTGFiZWwnKTtcclxuICAgICAgICAgICAgaWYgKGxhYmVsSWR4IDwgMCkgcmV0dXJuIGVycm9yUmVzdWx0KCdjYy5MYWJlbCBjb21wb25lbnQgbm90IGZvdW5kIG9uIG5vZGUnKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGZpbmFsVmFsdWUgPSAocHJvcGVydHkgPT09ICdjb2xvcicgJiYgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgPyBoZXhUb1JnYmEodmFsdWUpIDogdmFsdWU7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcclxuICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxyXG4gICAgICAgICAgICAgICAgcGF0aDogYF9fY29tcHNfXy4ke2xhYmVsSWR4fS4ke3Byb3BlcnR5fWAsXHJcbiAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBmaW5hbFZhbHVlIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHsgbm9kZVV1aWQsIHByb3BlcnR5LCB2YWx1ZTogZmluYWxWYWx1ZSB9LCBgTGFiZWwuJHtwcm9wZXJ0eX0gdXBkYXRlZGApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0U3ByaXRlUHJvcGVydHkoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgcHJvcGVydHksIHZhbHVlIH0gPSBhcmdzO1xyXG4gICAgICAgIGlmICghbm9kZVV1aWQgfHwgIXByb3BlcnR5IHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCwgcHJvcGVydHksIGFuZCB2YWx1ZSBhcmUgcmVxdWlyZWQgZm9yIHNldF9zcHJpdGVfcHJvcGVydHknKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsnc3ByaXRlRnJhbWUnLCAndHlwZScsICdzaXplTW9kZScsICdjb2xvciddO1xyXG4gICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBJbnZhbGlkIHNwcml0ZSBwcm9wZXJ0eS4gQWxsb3dlZDogJHthbGxvd2VkLmpvaW4oJywgJyl9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhPy5fX2NvbXBzX18pIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQnKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUlkeCA9IG5vZGVEYXRhLl9fY29tcHNfXy5maW5kSW5kZXgoKGM6IGFueSkgPT4gKGMuX190eXBlX18gfHwgYy5jaWQgfHwgYy50eXBlKSA9PT0gJ2NjLlNwcml0ZScpO1xyXG4gICAgICAgICAgICBpZiAoc3ByaXRlSWR4IDwgMCkgcmV0dXJuIGVycm9yUmVzdWx0KCdjYy5TcHJpdGUgY29tcG9uZW50IG5vdCBmb3VuZCBvbiBub2RlJyk7XHJcblxyXG4gICAgICAgICAgICBsZXQgZmluYWxWYWx1ZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdjb2xvcicgJiYgdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgZmluYWxWYWx1ZSA9IGhleFRvUmdiYSh2YWx1ZSk7XHJcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ3Nwcml0ZUZyYW1lJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSBmaW5hbFZhbHVlID0geyBfX3V1aWRfXzogdmFsdWUgfTtcclxuXHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcclxuICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxyXG4gICAgICAgICAgICAgICAgcGF0aDogYF9fY29tcHNfXy4ke3Nwcml0ZUlkeH0uJHtwcm9wZXJ0eX1gLFxyXG4gICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogZmluYWxWYWx1ZSB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBwcm9wZXJ0eSwgdmFsdWU6IGZpbmFsVmFsdWUgfSwgYFNwcml0ZS4ke3Byb3BlcnR5fSB1cGRhdGVkYCk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRVSUluZm8obm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghbm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGdldF9pbmZvJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XHJcbiAgICAgICAgICAgIGlmICghbm9kZURhdGE/Ll9fY29tcHNfXykgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBoYXMgbm8gY29tcG9uZW50cycpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgdWlUeXBlcyA9IFsnY2MuVUlUcmFuc2Zvcm0nLCAnY2MuV2lkZ2V0JywgJ2NjLkxhYmVsJywgJ2NjLlNwcml0ZScsICdjYy5CdXR0b24nLFxyXG4gICAgICAgICAgICAgICAgJ2NjLkxheW91dCcsICdjYy5TY3JvbGxWaWV3JywgJ2NjLkVkaXRCb3gnLCAnY2MuTWFzaycsICdjYy5HcmFwaGljcycsXHJcbiAgICAgICAgICAgICAgICAnY2MuUmljaFRleHQnLCAnY2MuUHJvZ3Jlc3NCYXInLCAnY2MuU2xpZGVyJywgJ2NjLlRvZ2dsZScsICdjYy5Ub2dnbGVDb250YWluZXInXTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHVpQ29tcG9uZW50cyA9IG5vZGVEYXRhLl9fY29tcHNfX1xyXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoYzogYW55KSA9PiB1aVR5cGVzLmluY2x1ZGVzKGMuX190eXBlX18gfHwgYy5jaWQgfHwgYy50eXBlKSlcclxuICAgICAgICAgICAgICAgIC5tYXAoKGM6IGFueSkgPT4gKHtcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiBjLl9fdHlwZV9fIHx8IGMuY2lkIHx8IGMudHlwZSxcclxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBjLmVuYWJsZWQgIT09IHVuZGVmaW5lZCA/IGMuZW5hYmxlZCA6IHRydWVcclxuICAgICAgICAgICAgICAgIH0pKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KHtcclxuICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxyXG4gICAgICAgICAgICAgICAgbmFtZTogbm9kZURhdGEubmFtZT8udmFsdWUgfHwgJ1Vua25vd24nLFxyXG4gICAgICAgICAgICAgICAgdWlDb21wb25lbnRzLFxyXG4gICAgICAgICAgICAgICAgaGFzVUlUcmFuc2Zvcm06IHVpQ29tcG9uZW50cy5zb21lKChjOiBhbnkpID0+IGMudHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyksXHJcbiAgICAgICAgICAgICAgICBoYXNXaWRnZXQ6IHVpQ29tcG9uZW50cy5zb21lKChjOiBhbnkpID0+IGMudHlwZSA9PT0gJ2NjLldpZGdldCcpXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgbGlzdFVJTm9kZXMoKTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgdHJlZTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZS10cmVlJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHVpTm9kZXM6IGFueVtdID0gW107XHJcbiAgICAgICAgICAgIGNvbnN0IHVpQ29tcG9uZW50VHlwZXMgPSBbJ2NjLlVJVHJhbnNmb3JtJywgJ2NjLldpZGdldCcsICdjYy5MYWJlbCcsICdjYy5TcHJpdGUnLFxyXG4gICAgICAgICAgICAgICAgJ2NjLkJ1dHRvbicsICdjYy5MYXlvdXQnLCAnY2MuU2Nyb2xsVmlldycsICdjYy5FZGl0Qm94J107XHJcblxyXG4gICAgICAgICAgICBjb25zdCB0cmF2ZXJzZSA9IGFzeW5jIChub2RlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlLnV1aWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YT8uX19jb21wc19fKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBzOiBzdHJpbmdbXSA9IG5vZGVEYXRhLl9fY29tcHNfXy5tYXAoKGM6IGFueSkgPT4gYy5fX3R5cGVfXyB8fCBjLmNpZCB8fCBjLnR5cGUgfHwgJ1Vua25vd24nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNVSU5vZGUgPSBjb21wcy5zb21lKHQgPT4gdWlDb21wb25lbnRUeXBlcy5pbmNsdWRlcyh0KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1VJTm9kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdWlOb2Rlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIGNvbXBvbmVudHM6IGNvbXBzLmZpbHRlcih0ID0+IHVpQ29tcG9uZW50VHlwZXMuaW5jbHVkZXModCkpIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gc2tpcCB1bnJlYWRhYmxlIG5vZGVzXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbikge1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikgYXdhaXQgdHJhdmVyc2UoY2hpbGQpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgaWYgKHRyZWUpIGF3YWl0IHRyYXZlcnNlKHRyZWUpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVpTm9kZXMsIGNvdW50OiB1aU5vZGVzLmxlbmd0aCB9KTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gaGV4VG9SZ2JhKGhleDogc3RyaW5nKTogeyByOiBudW1iZXI7IGc6IG51bWJlcjsgYjogbnVtYmVyOyBhOiBudW1iZXIgfSB7XHJcbiAgICBjb25zdCBjbGVhbiA9IGhleC5yZXBsYWNlKCcjJywgJycpO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgICByOiBwYXJzZUludChjbGVhbi5zdWJzdHJpbmcoMCwgMiksIDE2KSB8fCAwLFxyXG4gICAgICAgIGc6IHBhcnNlSW50KGNsZWFuLnN1YnN0cmluZygyLCA0KSwgMTYpIHx8IDAsXHJcbiAgICAgICAgYjogcGFyc2VJbnQoY2xlYW4uc3Vic3RyaW5nKDQsIDYpLCAxNikgfHwgMCxcclxuICAgICAgICBhOiBjbGVhbi5sZW5ndGggPj0gOCA/IHBhcnNlSW50KGNsZWFuLnN1YnN0cmluZyg2LCA4KSwgMTYpIDogMjU1XHJcbiAgICB9O1xyXG59XHJcbiJdfQ==