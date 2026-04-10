import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManagePhysics extends BaseActionTool {
    readonly name = 'manage_physics';
    readonly description = 'Manage physics components and system settings. Actions: configure=set physics system settings, add_rigidbody=add RigidBody to node, add_collider=add collider shape, set_rigidbody_property=set rigidbody prop, set_collider_property=set collider prop, remove_physics=remove all physics from node, get_info=get physics info, raycast=cast ray in 3D scene.';
    readonly actions = ['configure', 'add_rigidbody', 'add_collider', 'set_rigidbody_property', 'set_collider_property', 'remove_physics', 'get_info', 'raycast'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        configure: (args) => this.configurePhysics(args),
        add_rigidbody: (args) => this.addRigidbody(args),
        add_collider: (args) => this.addCollider(args),
        set_rigidbody_property: (args) => this.setRigidbodyProperty(args),
        set_collider_property: (args) => this.setColliderProperty(args),
        remove_physics: (args) => this.removePhysics(args),
        get_info: (args) => this.getPhysicsInfo(args),
        raycast: (args) => this.raycast(args),
    };

    private async configurePhysics(args: any): Promise<ActionToolResult> {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'configurePhysics',
                args: [args.gravity, args.fixedTimeStep, args.maxSubSteps]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to configure physics');
            return successResult((result as any).data, 'Physics system configured');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async addRigidbody(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addRigidbody',
                args: [args.nodeUuid, args.type || 'dynamic', args.mass ?? 1, args.useGravity ?? true]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to add rigidbody');
            return successResult((result as any).data, 'Rigidbody added');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async addCollider(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.shape) return errorResult('shape is required (box/sphere/capsule for 3D, box/circle/polygon for 2D)');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addCollider',
                args: [args.nodeUuid, args.shape, args.size, args.isTrigger ?? false]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to add collider');
            return successResult((result as any).data, `${args.shape} collider added`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setRigidbodyProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.property) return errorResult('property is required');
        if (args.value === undefined) return errorResult('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setRigidbodyProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set rigidbody property');
            return successResult(null, `Rigidbody property '${args.property}' updated`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async setColliderProperty(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        if (!args.property) return errorResult('property is required');
        if (args.value === undefined) return errorResult('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setColliderProperty',
                args: [args.nodeUuid, args.property, args.value]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to set collider property');
            return successResult(null, `Collider property '${args.property}' updated`);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async removePhysics(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'removePhysicsComponents',
                args: [args.nodeUuid]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to remove physics components');
            return successResult((result as any).data, 'Physics components removed');
        } catch (err: any) { return errorResult(err.message); }
    }

    private async getPhysicsInfo(args: any): Promise<ActionToolResult> {
        if (!args.nodeUuid) return errorResult('nodeUuid is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getPhysicsInfo',
                args: [args.nodeUuid]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Failed to get physics info');
            return successResult((result as any).data);
        } catch (err: any) { return errorResult(err.message); }
    }

    private async raycast(args: any): Promise<ActionToolResult> {
        if (!args.origin) return errorResult('origin {x,y,z} is required');
        if (!args.direction) return errorResult('direction {x,y,z} is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'performRaycast',
                args: [args.origin, args.direction, args.maxDistance ?? 100]
            });
            if (!(result as any)?.success) return errorResult((result as any)?.error || 'Raycast failed');
            return successResult((result as any).data);
        } catch (err: any) { return errorResult(err.message); }
    }
}
