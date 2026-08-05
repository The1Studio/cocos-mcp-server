"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagePhysics = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManagePhysics extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_physics';
        this.description = 'Manage physics components and system settings. Actions: configure=set physics system settings, add_rigidbody=add RigidBody to node, add_collider=add collider shape, set_rigidbody_property=set rigidbody prop, set_collider_property=set collider prop, remove_physics=remove all physics from node, get_info=get physics info, raycast=cast ray in 3D scene.';
        this.actions = ['configure', 'add_rigidbody', 'add_collider', 'set_rigidbody_property', 'set_collider_property', 'remove_physics', 'get_info', 'raycast'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['configure', 'add_rigidbody', 'add_collider', 'set_rigidbody_property', 'set_collider_property', 'remove_physics', 'get_info', 'raycast'],
                    description: 'Action to perform'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[add_rigidbody, add_collider, set_rigidbody_property, set_collider_property, remove_physics, get_info] Target node UUID'
                },
                gravity: {
                    description: '[configure] Gravity vector {x, y, z} for 3D or {x, y} for 2D',
                },
                fixedTimeStep: {
                    type: 'number',
                    description: '[configure] Fixed time step for physics simulation (e.g. 1/60)'
                },
                maxSubSteps: {
                    type: 'number',
                    description: '[configure] Maximum substeps per frame'
                },
                type: {
                    type: 'string',
                    enum: ['dynamic', 'static', 'kinematic'],
                    description: '[add_rigidbody] Rigidbody type'
                },
                mass: {
                    type: 'number',
                    description: '[add_rigidbody] Rigidbody mass (default: 1)'
                },
                useGravity: {
                    type: 'boolean',
                    description: '[add_rigidbody] Whether rigidbody is affected by gravity (default: true)'
                },
                shape: {
                    type: 'string',
                    enum: ['box', 'sphere', 'capsule', 'circle', 'polygon'],
                    description: '[add_collider] Collider shape: box/sphere/capsule for 3D, box/circle/polygon for 2D'
                },
                size: {
                    description: '[add_collider] Collider size: {width,height,depth} for box, {radius} for sphere/capsule/circle'
                },
                isTrigger: {
                    type: 'boolean',
                    description: '[add_collider] Whether collider is a trigger (no physics response)'
                },
                property: {
                    type: 'string',
                    description: '[set_rigidbody_property] Property: mass/linearDamping/angularDamping/useGravity/type. [set_collider_property] Property: size/center/isTrigger'
                },
                value: {
                    description: '[set_rigidbody_property, set_collider_property] Value to set'
                },
                origin: {
                    description: '[raycast] Ray origin {x, y, z}'
                },
                direction: {
                    description: '[raycast] Ray direction {x, y, z}'
                },
                maxDistance: {
                    type: 'number',
                    description: '[raycast] Maximum ray distance (default: 100)'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            configure: (args) => this.configurePhysics(args),
            add_rigidbody: (args) => this.addRigidbody(args),
            add_collider: (args) => this.addCollider(args),
            set_rigidbody_property: (args) => this.setRigidbodyProperty(args),
            set_collider_property: (args) => this.setColliderProperty(args),
            remove_physics: (args) => this.removePhysics(args),
            get_info: (args) => this.getPhysicsInfo(args),
            raycast: (args) => this.raycast(args),
        };
    }
    async configurePhysics(args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'configurePhysics',
                args: [args.gravity, args.fixedTimeStep, args.maxSubSteps]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to configure physics');
            return (0, types_1.successResult)(result.data, 'Physics system configured');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async addRigidbody(args) {
        var _a, _b;
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addRigidbody',
                args: [args.nodeUuid, args.type || 'dynamic', (_a = args.mass) !== null && _a !== void 0 ? _a : 1, (_b = args.useGravity) !== null && _b !== void 0 ? _b : true]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to add rigidbody');
            return (0, types_1.successResult)(result.data, 'Rigidbody added');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async addCollider(args) {
        var _a;
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.shape)
            return (0, types_1.errorResult)('shape is required (box/sphere/capsule for 3D, box/circle/polygon for 2D)');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addCollider',
                args: [args.nodeUuid, args.shape, args.size, (_a = args.isTrigger) !== null && _a !== void 0 ? _a : false]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to add collider');
            return (0, types_1.successResult)(result.data, `${args.shape} collider added`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setRigidbodyProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.property)
            return (0, types_1.errorResult)('property is required');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setRigidbodyProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set rigidbody property');
            return (0, types_1.successResult)(null, `Rigidbody property '${args.property}' updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setColliderProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        if (!args.property)
            return (0, types_1.errorResult)('property is required');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setColliderProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to set collider property');
            return (0, types_1.successResult)(null, `Collider property '${args.property}' updated`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async removePhysics(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'removePhysicsComponents',
                args: [args.nodeUuid]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to remove physics components');
            return (0, types_1.successResult)(result.data, 'Physics components removed');
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getPhysicsInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getPhysicsInfo',
                args: [args.nodeUuid]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Failed to get physics info');
            return (0, types_1.successResult)(result.data);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async raycast(args) {
        var _a;
        if (!args.origin)
            return (0, types_1.errorResult)('origin {x,y,z} is required');
        if (!args.direction)
            return (0, types_1.errorResult)('direction {x,y,z} is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'performRaycast',
                args: [args.origin, args.direction, (_a = args.maxDistance) !== null && _a !== void 0 ? _a : 100]
            });
            if (!(result === null || result === void 0 ? void 0 : result.success))
                return (0, types_1.errorResult)((result === null || result === void 0 ? void 0 : result.error) || 'Raycast failed');
            return (0, types_1.successResult)(result.data);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManagePhysics = ManagePhysics;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXBoeXNpY3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdG9vbHMvbWFuYWdlLXBoeXNpY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEseURBQW9EO0FBQ3BELG9DQUF3RTtBQUV4RSxNQUFhLGFBQWMsU0FBUSxpQ0FBYztJQUFqRDs7UUFDYSxTQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDeEIsZ0JBQVcsR0FBRyxnV0FBZ1csQ0FBQztRQUMvVyxZQUFPLEdBQUcsQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSx3QkFBd0IsRUFBRSx1QkFBdUIsRUFBRSxnQkFBZ0IsRUFBRSxVQUFVLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDckosZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLGVBQWUsRUFBRSxjQUFjLEVBQUUsd0JBQXdCLEVBQUUsdUJBQXVCLEVBQUUsZ0JBQWdCLEVBQUUsVUFBVSxFQUFFLFNBQVMsQ0FBQztvQkFDaEosV0FBVyxFQUFFLG1CQUFtQjtpQkFDbkM7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx5SEFBeUg7aUJBQ3pJO2dCQUNELE9BQU8sRUFBRTtvQkFDTCxXQUFXLEVBQUUsOERBQThEO2lCQUM5RTtnQkFDRCxhQUFhLEVBQUU7b0JBQ1gsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGdFQUFnRTtpQkFDaEY7Z0JBQ0QsV0FBVyxFQUFFO29CQUNULElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSx3Q0FBd0M7aUJBQ3hEO2dCQUNELElBQUksRUFBRTtvQkFDRixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxTQUFTLEVB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YWN0aW9uLXRvb2wnO1xyXG5pbXBvcnQgeyBBY3Rpb25Ub29sUmVzdWx0LCBzdWNjZXNzUmVzdWx0LCBlcnJvclJlc3VsdCB9IGZyb20gJy4uL3R5cGVzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VQaHlzaWNzIGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xyXG4gICAgcmVhZG9ubHkgbmFtZSA9ICdtYW5hZ2VfcGh5c2ljcyc7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgcGh5c2ljcyBjb21wb25lbnRzIGFuZCBzeXN0ZW0gc2V0dGluZ3MuIEFjdGlvbnM6IGNvbmZpZ3VyZT1zZXQgcGh5c2ljcyBzeXN0ZW0gc2V0dGluZ3MsIGFkZF9yaWdpZGJvZHk9YWRkIFJpZ2lkQm9keSB0byBub2RlLCBhZGRfY29sbGlkZXI9YWRkIGNvbGxpZGVyIHNoYXBlLCBzZXRfcmlnaWRib2R5X3Byb3BlcnR5PXNldCByaWdpZGJvZHkgcHJvcCwgc2V0X2NvbGxpZGVyX3Byb3BlcnR5PXNldCBjb2xsaWRlciBwcm9wLCByZW1vdmVfcGh5c2ljcz1yZW1vdmUgYWxsIHBoeXNpY3MgZnJvbSBub2RlLCBnZXRfaW5mbz1nZXQgcGh5c2ljcyBpbmZvLCByYXljYXN0PWNhc3QgcmF5IGluIDNEIHNjZW5lLic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjb25maWd1cmUnLCAnYWRkX3JpZ2lkYm9keScsICdhZGRfY29sbGlkZXInLCAnc2V0X3JpZ2lkYm9keV9wcm9wZXJ0eScsICdzZXRfY29sbGlkZXJfcHJvcGVydHknLCAncmVtb3ZlX3BoeXNpY3MnLCAnZ2V0X2luZm8nLCAncmF5Y2FzdCddO1xyXG4gICAgcmVhZG9ubHkgaW5wdXRTY2hlbWEgPSB7XHJcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICBhY3Rpb246IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydjb25maWd1cmUnLCAnYWRkX3JpZ2lkYm9keScsICdhZGRfY29sbGlkZXInLCAnc2V0X3JpZ2lkYm9keV9wcm9wZXJ0eScsICdzZXRfY29sbGlkZXJfcHJvcGVydHknLCAncmVtb3ZlX3BoeXNpY3MnLCAnZ2V0X2luZm8nLCAncmF5Y2FzdCddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdBY3Rpb24gdG8gcGVyZm9ybSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkX3JpZ2lkYm9keSwgYWRkX2NvbGxpZGVyLCBzZXRfcmlnaWRib2R5X3Byb3BlcnR5LCBzZXRfY29sbGlkZXJfcHJvcGVydHksIHJlbW92ZV9waHlzaWNzLCBnZXRfaW5mb10gVGFyZ2V0IG5vZGUgVVVJRCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZ3Jhdml0eToge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY29uZmlndXJlXSBHcmF2aXR5IHZlY3RvciB7eCwgeSwgen0gZm9yIDNEIG9yIHt4LCB5fSBmb3IgMkQnLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBmaXhlZFRpbWVTdGVwOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NvbmZpZ3VyZV0gRml4ZWQgdGltZSBzdGVwIGZvciBwaHlzaWNzIHNpbXVsYXRpb24gKGUuZy4gMS82MCknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG1heFN1YlN0ZXBzOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NvbmZpZ3VyZV0gTWF4aW11bSBzdWJzdGVwcyBwZXIgZnJhbWUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHR5cGU6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgZW51bTogWydkeW5hbWljJywgJ3N0YXRpYycsICdraW5lbWF0aWMnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF9yaWdpZGJvZHldIFJpZ2lkYm9keSB0eXBlJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBtYXNzOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF9yaWdpZGJvZHldIFJpZ2lkYm9keSBtYXNzIChkZWZhdWx0OiAxKSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdXNlR3Jhdml0eToge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkX3JpZ2lkYm9keV0gV2hldGhlciByaWdpZGJvZHkgaXMgYWZmZWN0ZWQgYnkgZ3Jhdml0eSAoZGVmYXVsdDogdHJ1ZSknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHNoYXBlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnYm94JywgJ3NwaGVyZScsICdjYXBzdWxlJywgJ2NpcmNsZScsICdwb2x5Z29uJ10sXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRfY29sbGlkZXJdIENvbGxpZGVyIHNoYXBlOiBib3gvc3BoZXJlL2NhcHN1bGUgZm9yIDNELCBib3gvY2lyY2xlL3BvbHlnb24gZm9yIDJEJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBzaXplOiB7XHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRfY29sbGlkZXJdIENvbGxpZGVyIHNpemU6IHt3aWR0aCxoZWlnaHQsZGVwdGh9IGZvciBib3gsIHtyYWRpdXN9IGZvciBzcGhlcmUvY2Fwc3VsZS9jaXJjbGUnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGlzVHJpZ2dlcjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbYWRkX2NvbGxpZGVyXSBXaGV0aGVyIGNvbGxpZGVyIGlzIGEgdHJpZ2dlciAobm8gcGh5c2ljcyByZXNwb25zZSknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHByb3BlcnR5OiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9yaWdpZGJvZHlfcHJvcGVydHldIFByb3BlcnR5OiBtYXNzL2xpbmVhckRhbXBpbmcvYW5ndWxhckRhbXBpbmcvdXNlR3Jhdml0eS90eXBlLiBbc2V0X2NvbGxpZGVyX3Byb3BlcnR5XSBQcm9wZXJ0eTogc2l6ZS9jZW50ZXIvaXNUcmlnZ2VyJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3JpZ2lkYm9keV9wcm9wZXJ0eSwgc2V0X2NvbGxpZGVyX3Byb3BlcnR5XSBWYWx1ZSB0byBzZXQnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG9yaWdpbjoge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcmF5Y2FzdF0gUmF5IG9yaWdpbiB7eCwgeSwgen0nXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGRpcmVjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbcmF5Y2FzdF0gUmF5IGRpcmVjdGlvbiB7eCwgeSwgen0nXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIG1heERpc3RhbmNlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnbnVtYmVyJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3JheWNhc3RdIE1heGltdW0gcmF5IGRpc3RhbmNlIChkZWZhdWx0OiAxMDApJ1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXF1aXJlZDogWydhY3Rpb24nXVxyXG4gICAgfTtcclxuXHJcbiAgICBwcm90ZWN0ZWQgYWN0aW9uSGFuZGxlcnM6IFJlY29yZDxzdHJpbmcsIChhcmdzOiBSZWNvcmQ8c3RyaW5nLCBhbnk+KSA9PiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+PiA9IHtcclxuICAgICAgICBjb25maWd1cmU6IChhcmdzKSA9PiB0aGlzLmNvbmZpZ3VyZVBoeXNpY3MoYXJncyksXHJcbiAgICAgICAgYWRkX3JpZ2lkYm9keTogKGFyZ3MpID0+IHRoaXMuYWRkUmlnaWRib2R5KGFyZ3MpLFxyXG4gICAgICAgIGFkZF9jb2xsaWRlcjogKGFyZ3MpID0+IHRoaXMuYWRkQ29sbGlkZXIoYXJncyksXHJcbiAgICAgICAgc2V0X3JpZ2lkYm9keV9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0UmlnaWRib2R5UHJvcGVydHkoYXJncyksXHJcbiAgICAgICAgc2V0X2NvbGxpZGVyX3Byb3BlcnR5OiAoYXJncykgPT4gdGhpcy5zZXRDb2xsaWRlclByb3BlcnR5KGFyZ3MpLFxyXG4gICAgICAgIHJlbW92ZV9waHlzaWNzOiAoYXJncykgPT4gdGhpcy5yZW1vdmVQaHlzaWNzKGFyZ3MpLFxyXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRQaHlzaWNzSW5mbyhhcmdzKSxcclxuICAgICAgICByYXljYXN0OiAoYXJncykgPT4gdGhpcy5yYXljYXN0KGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNvbmZpZ3VyZVBoeXNpY3MoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2NvbmZpZ3VyZVBoeXNpY3MnLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3MuZ3Jhdml0eSwgYXJncy5maXhlZFRpbWVTdGVwLCBhcmdzLm1heFN1YlN0ZXBzXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYgKCEocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gY29uZmlndXJlIHBoeXNpY3MnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsICdQaHlzaWNzIHN5c3RlbSBjb25maWd1cmVkJyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgYWRkUmlnaWRib2R5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdhZGRSaWdpZGJvZHknLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MudHlwZSB8fCAnZHluYW1pYycsIGFyZ3MubWFzcyA/PyAxLCBhcmdzLnVzZUdyYXZpdHkgPz8gdHJ1ZV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIGFkZCByaWdpZGJvZHknKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsICdSaWdpZGJvZHkgYWRkZWQnKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBhZGRDb2xsaWRlcihhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICBpZiAoIWFyZ3Muc2hhcGUpIHJldHVybiBlcnJvclJlc3VsdCgnc2hhcGUgaXMgcmVxdWlyZWQgKGJveC9zcGhlcmUvY2Fwc3VsZSBmb3IgM0QsIGJveC9jaXJjbGUvcG9seWdvbiBmb3IgMkQpJyk7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZXhlY3V0ZS1zY2VuZS1zY3JpcHQnLCB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ2FkZENvbGxpZGVyJyxcclxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLnNoYXBlLCBhcmdzLnNpemUsIGFyZ3MuaXNUcmlnZ2VyID8/IGZhbHNlXVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgaWYgKCEocmVzdWx0IGFzIGFueSk/LnN1Y2Nlc3MpIHJldHVybiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSk/LmVycm9yIHx8ICdGYWlsZWQgdG8gYWRkIGNvbGxpZGVyJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhLCBgJHthcmdzLnNoYXBlfSBjb2xsaWRlciBhZGRlZGApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldFJpZ2lkYm9keVByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmIChhcmdzLnZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0UmlnaWRib2R5UHJvcGVydHknLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mubm9kZVV1aWQsIGFyZ3MucHJvcGVydHksIGFyZ3MudmFsdWVdXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ0ZhaWxlZCB0byBzZXQgcmlnaWRib2R5IHByb3BlcnR5Jyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KG51bGwsIGBSaWdpZGJvZHkgcHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIHVwZGF0ZWRgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRDb2xsaWRlclByb3BlcnR5KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmICghYXJncy5wcm9wZXJ0eSkgcmV0dXJuIGVycm9yUmVzdWx0KCdwcm9wZXJ0eSBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmIChhcmdzLnZhbHVlID09PSB1bmRlZmluZWQpIHJldHVybiBlcnJvclJlc3VsdCgndmFsdWUgaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0Q29sbGlkZXJQcm9wZXJ0eScsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5wcm9wZXJ0eSwgYXJncy52YWx1ZV1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHNldCBjb2xsaWRlciBwcm9wZXJ0eScpO1xyXG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdChudWxsLCBgQ29sbGlkZXIgcHJvcGVydHkgJyR7YXJncy5wcm9wZXJ0eX0nIHVwZGF0ZWRgKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZW1vdmVQaHlzaWNzKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdyZW1vdmVQaHlzaWNzQ29tcG9uZW50cycsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIHJlbW92ZSBwaHlzaWNzIGNvbXBvbmVudHMnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsICdQaHlzaWNzIGNvbXBvbmVudHMgcmVtb3ZlZCcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFBoeXNpY3NJbmZvKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLCBtZXRob2Q6ICdnZXRQaHlzaWNzSW5mbycsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbYXJncy5ub2RlVXVpZF1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIGlmICghKHJlc3VsdCBhcyBhbnkpPy5zdWNjZXNzKSByZXR1cm4gZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpPy5lcnJvciB8fCAnRmFpbGVkIHRvIGdldCBwaHlzaWNzIGluZm8nKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHJheWNhc3QoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgaWYgKCFhcmdzLm9yaWdpbikgcmV0dXJuIGVycm9yUmVzdWx0KCdvcmlnaW4ge3gseSx6fSBpcyByZXF1aXJlZCcpO1xyXG4gICAgICAgIGlmICghYXJncy5kaXJlY3Rpb24pIHJldHVybiBlcnJvclJlc3VsdCgnZGlyZWN0aW9uIHt4LHksen0gaXMgcmVxdWlyZWQnKTtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAncGVyZm9ybVJheWNhc3QnLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW2FyZ3Mub3JpZ2luLCBhcmdzLmRpcmVjdGlvbiwgYXJncy5tYXhEaXN0YW5jZSA/PyAxMDBdXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBpZiAoIShyZXN1bHQgYXMgYW55KT8uc3VjY2VzcykgcmV0dXJuIGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KT8uZXJyb3IgfHwgJ1JheWNhc3QgZmFpbGVkJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XHJcbiAgICB9XHJcbn1cclxuIl19