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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXVpLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS11aS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBQ3hFLHlFQUdvQztBQUVwQyxNQUFhLFFBQVMsU0FBUSxpQ0FBYztJQUE1Qzs7UUFDYSxTQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ25CLGdCQUFXLEdBQUcsd1RBQXdULENBQUM7UUFDdlUsWUFBTyxHQUFHO1lBQ2YsZUFBZSxFQUFFLGNBQWMsRUFBRSxlQUFlLEVBQUUsZUFBZTtZQUNqRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsZ0JBQWdCO1lBQ3RELFlBQVksRUFBRSxvQkFBb0IsRUFBRSxxQkFBcUI7WUFDekQsVUFBVSxFQUFFLGVBQWU7U0FDOUIsQ0FBQztRQUVPLGdCQUFXLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFFBQVE7WUFDZCxVQUFVLEVBQUU7Z0JBQ1IsTUFBTSxFQUFFO29CQUNKLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRTt3QkFDRixlQUFlLEVBQUUsY0FBYyxFQUFFLGVBQWUsRUFBRSxlQUFlO3dCQUNqRSxlQUFlLEVBQUUsbUJBQW1CLEVBQUUsZ0JBQWdCO3dCQUN0RCxZQUFZLEVBQUUsb0JBQW9CLEVBQUUscUJBQXFCO3dCQUN6RCxVQUFVLEVBQUUsZUFBZTtxQkFDOUI7b0JBQ0QsV0FBVyxFQUFFLDhDQUE4QztpQkFDOUQ7Z0JBQ0QsVUFBVSxFQUFFO29CQUNSLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw0RUFBNEU7aUJBQzVGO2dCQUNELFFBQVEsRUFBRTtvQkFDTixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsa0ZBQWtGO2lCQUNsRztnQkFDRCxnQkFBZ0I7Z0JBQ2hCLFNBQVMsRUFBRTtvQkFDUCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUs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QUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBQzdELENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBelVELDRCQXlVQztBQUVELFNBQVMsU0FBUyxDQUFDLEdBQVc7SUFDMUIsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbkMsT0FBTztRQUNILENBQUMsRUFBRSxRQUFRLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQztRQUMzQyxDQUFDLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUM7UUFDM0MsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDO1FBQzNDLENBQUMsRUFBRSxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHO0tBQ25FLENBQUM7QUFDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQge1xuICAgIGNyZWF0ZVdpZGdldCwgY3JlYXRlTGFiZWwsIGNyZWF0ZUJ1dHRvbiwgY3JlYXRlU3ByaXRlLFxuICAgIGNyZWF0ZUxheW91dCwgY3JlYXRlU2Nyb2xsVmlldywgY3JlYXRlRWRpdEJveFxufSBmcm9tICcuL21hbmFnZS11aS1jcmVhdGUtaGVscGVycyc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VVSSBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV91aSc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIFVJIG5vZGVzIGFuZCBjb21wb25lbnRzIGluIHRoZSBzY2VuZS4gQWN0aW9uczogY3JlYXRlX3dpZGdldCwgY3JlYXRlX2xhYmVsLCBjcmVhdGVfYnV0dG9uLCBjcmVhdGVfc3ByaXRlLCBjcmVhdGVfbGF5b3V0LCBjcmVhdGVfc2Nyb2xsdmlldywgY3JlYXRlX2VkaXRib3gsIHNldF93aWRnZXQsIHNldF9sYWJlbF9wcm9wZXJ0eSwgc2V0X3Nwcml0ZV9wcm9wZXJ0eSwgZ2V0X2luZm8sIGxpc3RfdWlfbm9kZXMuIFVzZSB0aGlzIGZvciBidWlsZGluZyAyRCBVSSBsYXlvdXRzIHdpdGggQ29jb3MgQ3JlYXRvciBVSSBjb21wb25lbnRzLic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFtcbiAgICAgICAgJ2NyZWF0ZV93aWRnZXQnLCAnY3JlYXRlX2xhYmVsJywgJ2NyZWF0ZV9idXR0b24nLCAnY3JlYXRlX3Nwcml0ZScsXG4gICAgICAgICdjcmVhdGVfbGF5b3V0JywgJ2NyZWF0ZV9zY3JvbGx2aWV3JywgJ2NyZWF0ZV9lZGl0Ym94JyxcbiAgICAgICAgJ3NldF93aWRnZXQnLCAnc2V0X2xhYmVsX3Byb3BlcnR5JywgJ3NldF9zcHJpdGVfcHJvcGVydHknLFxuICAgICAgICAnZ2V0X2luZm8nLCAnbGlzdF91aV9ub2RlcydcbiAgICBdO1xuXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICBhY3Rpb246IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbXG4gICAgICAgICAgICAgICAgICAgICdjcmVhdGVfd2lkZ2V0JywgJ2NyZWF0ZV9sYWJlbCcsICdjcmVhdGVfYnV0dG9uJywgJ2NyZWF0ZV9zcHJpdGUnLFxuICAgICAgICAgICAgICAgICAgICAnY3JlYXRlX2xheW91dCcsICdjcmVhdGVfc2Nyb2xsdmlldycsICdjcmVhdGVfZWRpdGJveCcsXG4gICAgICAgICAgICAgICAgICAgICdzZXRfd2lkZ2V0JywgJ3NldF9sYWJlbF9wcm9wZXJ0eScsICdzZXRfc3ByaXRlX3Byb3BlcnR5JyxcbiAgICAgICAgICAgICAgICAgICAgJ2dldF9pbmZvJywgJ2xpc3RfdWlfbm9kZXMnXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbiB0byBwZXJmb3JtIG9uIFVJIG5vZGVzIGFuZCBjb21wb25lbnRzJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhcmVudFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfKl0gUGFyZW50IG5vZGUgVVVJRC4gVXNlIG1hbmFnZV9ub2RlIGFjdGlvbj1nZXRfYWxsIHRvIGZpbmQgVVVJRHMuJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG5vZGVVdWlkOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldCwgc2V0X2xhYmVsX3Byb3BlcnR5LCBzZXRfc3ByaXRlX3Byb3BlcnR5LCBnZXRfaW5mb10gVGFyZ2V0IG5vZGUgVVVJRCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBjcmVhdGVfd2lkZ2V0XG4gICAgICAgICAgICBhbGlnbm1lbnQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ3RvcCcsICdib3R0b20nLCAnbGVmdCcsICdyaWdodCcsICdjZW50ZXInLCAnc3RyZXRjaCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV93aWRnZXRdIFdpZGdldCBhbGlnbm1lbnQgcHJlc2V0JyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnY2VudGVyJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1hcmdpbnM6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgICAgICAgIHRvcDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICBib3R0b206IHsgdHlwZTogJ251bWJlcicgfSxcbiAgICAgICAgICAgICAgICAgICAgbGVmdDogeyB0eXBlOiAnbnVtYmVyJyB9LFxuICAgICAgICAgICAgICAgICAgICByaWdodDogeyB0eXBlOiAnbnVtYmVyJyB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfd2lkZ2V0LCBzZXRfd2lkZ2V0XSBNYXJnaW4gdmFsdWVzIGZvciBhbGlnbm1lbnQgYW5jaG9ycydcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBjcmVhdGVfbGFiZWxcbiAgICAgICAgICAgIHRleHQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGFiZWwsIGNyZWF0ZV9idXR0b25dIExhYmVsIG9yIGJ1dHRvbiB0ZXh0IGNvbnRlbnQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZm9udFNpemU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGFiZWxdIEZvbnQgc2l6ZSBpbiBwaXhlbHMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDIwXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29sb3I6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGFiZWwsIGNyZWF0ZV9idXR0b25dIEhleCBjb2xvciBzdHJpbmcgKGUuZy4sICNGRkZGRkYpJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGhvcml6b250YWxBbGlnbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYWJlbF0gSG9yaXpvbnRhbCBhbGlnbm1lbnQ6IDA9TEVGVCwgMT1DRU5URVIsIDI9UklHSFQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdmVydGljYWxBbGlnbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYWJlbF0gVmVydGljYWwgYWxpZ25tZW50OiAwPVRPUCwgMT1DRU5URVIsIDI9Qk9UVE9NJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG92ZXJmbG93OiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2xhYmVsXSBUZXh0IG92ZXJmbG93IG1vZGU6IDA9Tk9ORSwgMT1DTEFNUCwgMj1TSFJJTkssIDM9UkVTSVpFX0hFSUdIVCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBjcmVhdGVfYnV0dG9uXG4gICAgICAgICAgICBub3JtYWxDb2xvcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9idXR0b25dIEhleCBjb2xvciBmb3Igbm9ybWFsIHN0YXRlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGhvdmVyQ29sb3I6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfYnV0dG9uXSBIZXggY29sb3IgZm9yIGhvdmVyIHN0YXRlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHByZXNzZWRDb2xvcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9idXR0b25dIEhleCBjb2xvciBmb3IgcHJlc3NlZCBzdGF0ZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBjcmVhdGVfc3ByaXRlXG4gICAgICAgICAgICBzcHJpdGVGcmFtZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfc3ByaXRlXSBVVUlEIG9mIHRoZSBzcHJpdGUgZnJhbWUgYXNzZXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgdHlwZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnU0lNUExFJywgJ1NMSUNFRCcsICdUSUxFRCcsICdGSUxMRUQnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfc3ByaXRlXSBTcHJpdGUgcmVuZGVyIHR5cGUnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2l6ZU1vZGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfc3ByaXRlXSBTaXplIG1vZGU6IDA9Q1VTVE9NLCAxPVRSSU1NRUQsIDI9UkFXJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIGNyZWF0ZV9sYXlvdXRcbiAgICAgICAgICAgIGxheW91dFR5cGU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ0hPUklaT05UQUwnLCAnVkVSVElDQUwnLCAnR1JJRCddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYXlvdXRdIExheW91dCBkaXJlY3Rpb24gdHlwZScsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ0hPUklaT05UQUwnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc3BhY2luZ1g6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfbGF5b3V0XSBIb3Jpem9udGFsIHNwYWNpbmcgYmV0d2VlbiBjaGlsZHJlbicsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogMFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHNwYWNpbmdZOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ251bWJlcicsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlX2xheW91dF0gVmVydGljYWwgc3BhY2luZyBiZXR3ZWVuIGNoaWxkcmVuJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAwXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcGFkZGluZzoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9sYXlvdXRdIFVuaWZvcm0gcGFkZGluZyBvbiBhbGwgc2lkZXMnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDBcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAvLyBjcmVhdGVfc2Nyb2xsdmlld1xuICAgICAgICAgICAgZGlyZWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZW51bTogWyd2ZXJ0aWNhbCcsICdob3Jpem9udGFsJywgJ2JvdGgnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGVfc2Nyb2xsdmlld10gU2Nyb2xsIGRpcmVjdGlvbicsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ3ZlcnRpY2FsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIC8vIGNyZWF0ZV9lZGl0Ym94XG4gICAgICAgICAgICBwbGFjZWhvbGRlcjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9lZGl0Ym94XSBQbGFjZWhvbGRlciB0ZXh0J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG1heExlbmd0aDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV9lZGl0Ym94XSBNYXhpbXVtIGNoYXJhY3RlciBsZW5ndGgnLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IDIwXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgLy8gc2V0X3dpZGdldFxuICAgICAgICAgICAgaXNBbGlnblRvcDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIEVuYWJsZSB0b3AgYWxpZ25tZW50IGFuY2hvcicgfSxcbiAgICAgICAgICAgIHRvcDogeyB0eXBlOiAnbnVtYmVyJywgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldF0gVG9wIGFuY2hvciBtYXJnaW4gdmFsdWUnIH0sXG4gICAgICAgICAgICBpc0FsaWduQm90dG9tOiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldF0gRW5hYmxlIGJvdHRvbSBhbGlnbm1lbnQgYW5jaG9yJyB9LFxuICAgICAgICAgICAgYm90dG9tOiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ1tzZXRfd2lkZ2V0XSBCb3R0b20gYW5jaG9yIG1hcmdpbiB2YWx1ZScgfSxcbiAgICAgICAgICAgIGlzQWxpZ25MZWZ0OiB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246ICdbc2V0X3dpZGdldF0gRW5hYmxlIGxlZnQgYWxpZ25tZW50IGFuY2hvcicgfSxcbiAgICAgICAgICAgIGxlZnQ6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIExlZnQgYW5jaG9yIG1hcmdpbiB2YWx1ZScgfSxcbiAgICAgICAgICAgIGlzQWxpZ25SaWdodDogeyB0eXBlOiAnYm9vbGVhbicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIEVuYWJsZSByaWdodCBhbGlnbm1lbnQgYW5jaG9yJyB9LFxuICAgICAgICAgICAgcmlnaHQ6IHsgdHlwZTogJ251bWJlcicsIGRlc2NyaXB0aW9uOiAnW3NldF93aWRnZXRdIFJpZ2h0IGFuY2hvciBtYXJnaW4gdmFsdWUnIH0sXG4gICAgICAgICAgICAvLyBzZXRfbGFiZWxfcHJvcGVydHkgLyBzZXRfc3ByaXRlX3Byb3BlcnR5XG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9sYWJlbF9wcm9wZXJ0eV0gUHJvcGVydHkgbmFtZTogc3RyaW5nfGZvbnRTaXplfGNvbG9yfGxpbmVIZWlnaHR8b3ZlcmZsb3cuIFtzZXRfc3ByaXRlX3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lOiBzcHJpdGVGcmFtZXx0eXBlfHNpemVNb2RlfGNvbG9yJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2xhYmVsX3Byb3BlcnR5LCBzZXRfc3ByaXRlX3Byb3BlcnR5XSBOZXcgcHJvcGVydHkgdmFsdWUnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXG4gICAgfTtcblxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xuICAgICAgICBjcmVhdGVfd2lkZ2V0OiAoYXJncykgPT4gY3JlYXRlV2lkZ2V0KGFyZ3MpLFxuICAgICAgICBjcmVhdGVfbGFiZWw6IChhcmdzKSA9PiBjcmVhdGVMYWJlbChhcmdzKSxcbiAgICAgICAgY3JlYXRlX2J1dHRvbjogKGFyZ3MpID0+IGNyZWF0ZUJ1dHRvbihhcmdzKSxcbiAgICAgICAgY3JlYXRlX3Nwcml0ZTogKGFyZ3MpID0+IGNyZWF0ZVNwcml0ZShhcmdzKSxcbiAgICAgICAgY3JlYXRlX2xheW91dDogKGFyZ3MpID0+IGNyZWF0ZUxheW91dCh7IC4uLmFyZ3MsIHR5cGU6IGFyZ3MubGF5b3V0VHlwZSB8fCBhcmdzLnR5cGUgfSksXG4gICAgICAgIGNyZWF0ZV9zY3JvbGx2aWV3OiAoYXJncykgPT4gY3JlYXRlU2Nyb2xsVmlldyhhcmdzKSxcbiAgICAgICAgY3JlYXRlX2VkaXRib3g6IChhcmdzKSA9PiBjcmVhdGVFZGl0Qm94KGFyZ3MpLFxuICAgICAgICBzZXRfd2lkZ2V0OiAoYXJncykgPT4gdGhpcy5zZXRXaWRnZXQoYXJncyksXG4gICAgICAgIHNldF9sYWJlbF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0TGFiZWxQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgc2V0X3Nwcml0ZV9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0U3ByaXRlUHJvcGVydHkoYXJncyksXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRVSUluZm8oYXJncy5ub2RlVXVpZCksXG4gICAgICAgIGxpc3RfdWlfbm9kZXM6ICgpID0+IHRoaXMubGlzdFVJTm9kZXMoKVxuICAgIH07XG5cbiAgICBwcml2YXRlIGFzeW5jIHNldFdpZGdldChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgaXNBbGlnblRvcCwgdG9wLCBpc0FsaWduQm90dG9tLCBib3R0b20sIGlzQWxpZ25MZWZ0LCBsZWZ0LCBpc0FsaWduUmlnaHQsIHJpZ2h0IH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBzZXRfd2lkZ2V0Jyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZURhdGE/Ll9fY29tcHNfXykgcmV0dXJuIGVycm9yUmVzdWx0KCdOb2RlIG5vdCBmb3VuZCBvciBoYXMgbm8gY29tcG9uZW50cycpO1xuXG4gICAgICAgICAgICBjb25zdCBjb21wczogYW55W10gPSBub2RlRGF0YS5fX2NvbXBzX187XG4gICAgICAgICAgICBjb25zdCB3aWRnZXRJZHggPSBjb21wcy5maW5kSW5kZXgoKGM6IGFueSkgPT4gKGMuX190eXBlX18gfHwgYy5jaWQgfHwgYy50eXBlKSA9PT0gJ2NjLldpZGdldCcpO1xuICAgICAgICAgICAgaWYgKHdpZGdldElkeCA8IDApIHJldHVybiBlcnJvclJlc3VsdCgnY2MuV2lkZ2V0IGNvbXBvbmVudCBub3QgZm91bmQgb24gbm9kZS4gQWRkIGl0IGZpcnN0IHdpdGggbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249YWRkLicpO1xuXG4gICAgICAgICAgICBjb25zdCBzZXRQID0gYXN5bmMgKHByb3A6IHN0cmluZywgdmFsOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgICAgICBwYXRoOiBgX19jb21wc19fLiR7d2lkZ2V0SWR4fS4ke3Byb3B9YCxcbiAgICAgICAgICAgICAgICAgICAgZHVtcDogeyB2YWx1ZTogdmFsIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChpc0FsaWduVG9wICE9PSB1bmRlZmluZWQpIGF3YWl0IHNldFAoJ2lzQWxpZ25Ub3AnLCBpc0FsaWduVG9wKTtcbiAgICAgICAgICAgIGlmICh0b3AgIT09IHVuZGVmaW5lZCkgYXdhaXQgc2V0UCgndG9wJywgdG9wKTtcbiAgICAgICAgICAgIGlmIChpc0FsaWduQm90dG9tICE9PSB1bmRlZmluZWQpIGF3YWl0IHNldFAoJ2lzQWxpZ25Cb3R0b20nLCBpc0FsaWduQm90dG9tKTtcbiAgICAgICAgICAgIGlmIChib3R0b20gIT09IHVuZGVmaW5lZCkgYXdhaXQgc2V0UCgnYm90dG9tJywgYm90dG9tKTtcbiAgICAgICAgICAgIGlmIChpc0FsaWduTGVmdCAhPT0gdW5kZWZpbmVkKSBhd2FpdCBzZXRQKCdpc0FsaWduTGVmdCcsIGlzQWxpZ25MZWZ0KTtcbiAgICAgICAgICAgIGlmIChsZWZ0ICE9PSB1bmRlZmluZWQpIGF3YWl0IHNldFAoJ2xlZnQnLCBsZWZ0KTtcbiAgICAgICAgICAgIGlmIChpc0FsaWduUmlnaHQgIT09IHVuZGVmaW5lZCkgYXdhaXQgc2V0UCgnaXNBbGlnblJpZ2h0JywgaXNBbGlnblJpZ2h0KTtcbiAgICAgICAgICAgIGlmIChyaWdodCAhPT0gdW5kZWZpbmVkKSBhd2FpdCBzZXRQKCdyaWdodCcsIHJpZ2h0KTtcblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCB9LCAnV2lkZ2V0IGFsaWdubWVudCB1cGRhdGVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0TGFiZWxQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgcHJvcGVydHksIHZhbHVlIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFwcm9wZXJ0eSB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkLCBwcm9wZXJ0eSwgYW5kIHZhbHVlIGFyZSByZXF1aXJlZCBmb3Igc2V0X2xhYmVsX3Byb3BlcnR5Jyk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsnc3RyaW5nJywgJ2ZvbnRTaXplJywgJ2NvbG9yJywgJ2xpbmVIZWlnaHQnLCAnb3ZlcmZsb3cnXTtcbiAgICAgICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBJbnZhbGlkIGxhYmVsIHByb3BlcnR5LiBBbGxvd2VkOiAke2FsbG93ZWQuam9pbignLCAnKX1gKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhPy5fX2NvbXBzX18pIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQnKTtcblxuICAgICAgICAgICAgY29uc3QgbGFiZWxJZHggPSBub2RlRGF0YS5fX2NvbXBzX18uZmluZEluZGV4KChjOiBhbnkpID0+IChjLl9fdHlwZV9fIHx8IGMuY2lkIHx8IGMudHlwZSkgPT09ICdjYy5MYWJlbCcpO1xuICAgICAgICAgICAgaWYgKGxhYmVsSWR4IDwgMCkgcmV0dXJuIGVycm9yUmVzdWx0KCdjYy5MYWJlbCBjb21wb25lbnQgbm90IGZvdW5kIG9uIG5vZGUnKTtcblxuICAgICAgICAgICAgY29uc3QgZmluYWxWYWx1ZSA9IChwcm9wZXJ0eSA9PT0gJ2NvbG9yJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSA/IGhleFRvUmdiYSh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcbiAgICAgICAgICAgICAgICB1dWlkOiBub2RlVXVpZCxcbiAgICAgICAgICAgICAgICBwYXRoOiBgX19jb21wc19fLiR7bGFiZWxJZHh9LiR7cHJvcGVydHl9YCxcbiAgICAgICAgICAgICAgICBkdW1wOiB7IHZhbHVlOiBmaW5hbFZhbHVlIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBub2RlVXVpZCwgcHJvcGVydHksIHZhbHVlOiBmaW5hbFZhbHVlIH0sIGBMYWJlbC4ke3Byb3BlcnR5fSB1cGRhdGVkYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTcHJpdGVQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgY29uc3QgeyBub2RlVXVpZCwgcHJvcGVydHksIHZhbHVlIH0gPSBhcmdzO1xuICAgICAgICBpZiAoIW5vZGVVdWlkIHx8ICFwcm9wZXJ0eSB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkLCBwcm9wZXJ0eSwgYW5kIHZhbHVlIGFyZSByZXF1aXJlZCBmb3Igc2V0X3Nwcml0ZV9wcm9wZXJ0eScpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFsbG93ZWQgPSBbJ3Nwcml0ZUZyYW1lJywgJ3R5cGUnLCAnc2l6ZU1vZGUnLCAnY29sb3InXTtcbiAgICAgICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGBJbnZhbGlkIHNwcml0ZSBwcm9wZXJ0eS4gQWxsb3dlZDogJHthbGxvd2VkLmpvaW4oJywgJyl9YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVEYXRhOiBhbnkgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlRGF0YT8uX19jb21wc19fKSByZXR1cm4gZXJyb3JSZXN1bHQoJ05vZGUgbm90IGZvdW5kJyk7XG5cbiAgICAgICAgICAgIGNvbnN0IHNwcml0ZUlkeCA9IG5vZGVEYXRhLl9fY29tcHNfXy5maW5kSW5kZXgoKGM6IGFueSkgPT4gKGMuX190eXBlX18gfHwgYy5jaWQgfHwgYy50eXBlKSA9PT0gJ2NjLlNwcml0ZScpO1xuICAgICAgICAgICAgaWYgKHNwcml0ZUlkeCA8IDApIHJldHVybiBlcnJvclJlc3VsdCgnY2MuU3ByaXRlIGNvbXBvbmVudCBub3QgZm91bmQgb24gbm9kZScpO1xuXG4gICAgICAgICAgICBsZXQgZmluYWxWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAnY29sb3InICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIGZpbmFsVmFsdWUgPSBoZXhUb1JnYmEodmFsdWUpO1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAnc3ByaXRlRnJhbWUnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIGZpbmFsVmFsdWUgPSB7IF9fdXVpZF9fOiB2YWx1ZSB9O1xuXG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzZXQtcHJvcGVydHknLCB7XG4gICAgICAgICAgICAgICAgdXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgcGF0aDogYF9fY29tcHNfXy4ke3Nwcml0ZUlkeH0uJHtwcm9wZXJ0eX1gLFxuICAgICAgICAgICAgICAgIGR1bXA6IHsgdmFsdWU6IGZpbmFsVmFsdWUgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IG5vZGVVdWlkLCBwcm9wZXJ0eSwgdmFsdWU6IGZpbmFsVmFsdWUgfSwgYFNwcml0ZS4ke3Byb3BlcnR5fSB1cGRhdGVkYCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXRVSUluZm8obm9kZVV1aWQ6IHN0cmluZyk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIW5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBnZXRfaW5mbycpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3Qgbm9kZURhdGE6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGVEYXRhPy5fX2NvbXBzX18pIHJldHVybiBlcnJvclJlc3VsdCgnTm9kZSBub3QgZm91bmQgb3IgaGFzIG5vIGNvbXBvbmVudHMnKTtcblxuICAgICAgICAgICAgY29uc3QgdWlUeXBlcyA9IFsnY2MuVUlUcmFuc2Zvcm0nLCAnY2MuV2lkZ2V0JywgJ2NjLkxhYmVsJywgJ2NjLlNwcml0ZScsICdjYy5CdXR0b24nLFxuICAgICAgICAgICAgICAgICdjYy5MYXlvdXQnLCAnY2MuU2Nyb2xsVmlldycsICdjYy5FZGl0Qm94JywgJ2NjLk1hc2snLCAnY2MuR3JhcGhpY3MnLFxuICAgICAgICAgICAgICAgICdjYy5SaWNoVGV4dCcsICdjYy5Qcm9ncmVzc0JhcicsICdjYy5TbGlkZXInLCAnY2MuVG9nZ2xlJywgJ2NjLlRvZ2dsZUNvbnRhaW5lciddO1xuXG4gICAgICAgICAgICBjb25zdCB1aUNvbXBvbmVudHMgPSBub2RlRGF0YS5fX2NvbXBzX19cbiAgICAgICAgICAgICAgICAuZmlsdGVyKChjOiBhbnkpID0+IHVpVHlwZXMuaW5jbHVkZXMoYy5fX3R5cGVfXyB8fCBjLmNpZCB8fCBjLnR5cGUpKVxuICAgICAgICAgICAgICAgIC5tYXAoKGM6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogYy5fX3R5cGVfXyB8fCBjLmNpZCB8fCBjLnR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGMuZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gYy5lbmFibGVkIDogdHJ1ZVxuICAgICAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoe1xuICAgICAgICAgICAgICAgIG5vZGVVdWlkLFxuICAgICAgICAgICAgICAgIG5hbWU6IG5vZGVEYXRhLm5hbWU/LnZhbHVlIHx8ICdVbmtub3duJyxcbiAgICAgICAgICAgICAgICB1aUNvbXBvbmVudHMsXG4gICAgICAgICAgICAgICAgaGFzVUlUcmFuc2Zvcm06IHVpQ29tcG9uZW50cy5zb21lKChjOiBhbnkpID0+IGMudHlwZSA9PT0gJ2NjLlVJVHJhbnNmb3JtJyksXG4gICAgICAgICAgICAgICAgaGFzV2lkZ2V0OiB1aUNvbXBvbmVudHMuc29tZSgoYzogYW55KSA9PiBjLnR5cGUgPT09ICdjYy5XaWRnZXQnKVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0VUlOb2RlcygpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRyZWU6IGFueSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScpO1xuICAgICAgICAgICAgY29uc3QgdWlOb2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHVpQ29tcG9uZW50VHlwZXMgPSBbJ2NjLlVJVHJhbnNmb3JtJywgJ2NjLldpZGdldCcsICdjYy5MYWJlbCcsICdjYy5TcHJpdGUnLFxuICAgICAgICAgICAgICAgICdjYy5CdXR0b24nLCAnY2MuTGF5b3V0JywgJ2NjLlNjcm9sbFZpZXcnLCAnY2MuRWRpdEJveCddO1xuXG4gICAgICAgICAgICBjb25zdCB0cmF2ZXJzZSA9IGFzeW5jIChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBub2RlRGF0YTogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIG5vZGUudXVpZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChub2RlRGF0YT8uX19jb21wc19fKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21wczogc3RyaW5nW10gPSBub2RlRGF0YS5fX2NvbXBzX18ubWFwKChjOiBhbnkpID0+IGMuX190eXBlX18gfHwgYy5jaWQgfHwgYy50eXBlIHx8ICdVbmtub3duJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpc1VJTm9kZSA9IGNvbXBzLnNvbWUodCA9PiB1aUNvbXBvbmVudFR5cGVzLmluY2x1ZGVzKHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1VJTm9kZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVpTm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCBjb21wb25lbnRzOiBjb21wcy5maWx0ZXIodCA9PiB1aUNvbXBvbmVudFR5cGVzLmluY2x1ZGVzKHQpKSB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAvLyBza2lwIHVucmVhZGFibGUgbm9kZXNcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSBhd2FpdCB0cmF2ZXJzZShjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKHRyZWUpIGF3YWl0IHRyYXZlcnNlKHRyZWUpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1aU5vZGVzLCBjb3VudDogdWlOb2Rlcy5sZW5ndGggfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBoZXhUb1JnYmEoaGV4OiBzdHJpbmcpOiB7IHI6IG51bWJlcjsgZzogbnVtYmVyOyBiOiBudW1iZXI7IGE6IG51bWJlciB9IHtcbiAgICBjb25zdCBjbGVhbiA9IGhleC5yZXBsYWNlKCcjJywgJycpO1xuICAgIHJldHVybiB7XG4gICAgICAgIHI6IHBhcnNlSW50KGNsZWFuLnN1YnN0cmluZygwLCAyKSwgMTYpIHx8IDAsXG4gICAgICAgIGc6IHBhcnNlSW50KGNsZWFuLnN1YnN0cmluZygyLCA0KSwgMTYpIHx8IDAsXG4gICAgICAgIGI6IHBhcnNlSW50KGNsZWFuLnN1YnN0cmluZyg0LCA2KSwgMTYpIHx8IDAsXG4gICAgICAgIGE6IGNsZWFuLmxlbmd0aCA+PSA4ID8gcGFyc2VJbnQoY2xlYW4uc3Vic3RyaW5nKDYsIDgpLCAxNikgOiAyNTVcbiAgICB9O1xufVxuIl19