import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageParticle extends BaseActionTool {
    readonly name = 'manage_particle';
    readonly description = 'Manage ParticleSystem components (3D and 2D). Actions: add, set_property, set_emission, set_shape, set_renderer, get_info, list, remove.';
    readonly actions = ['add', 'set_property', 'set_emission', 'set_shape', 'set_renderer', 'get_info', 'list', 'remove'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['add', 'set_property', 'set_emission', 'set_shape', 'set_renderer', 'get_info', 'list', 'remove'],
                description: 'Action: add=add ParticleSystem, set_property=set particle props, set_emission=emission rate/bursts, set_shape=emitter shape, set_renderer=render mode/material, get_info=get all props, list=list particle nodes, remove=remove component'
            },
            nodeUuid: {
                type: 'string',
                description: '[add, set_property, set_emission, set_shape, set_renderer, get_info, remove] Target node UUID'
            },
            is2d: {
                type: 'boolean',
                description: '[add] Use ParticleSystem2D instead of 3D ParticleSystem (default: false)',
                default: false
            },
            property: {
                type: 'string',
                enum: ['duration', 'startLifetime', 'startSpeed', 'startSize', 'startColor', 'loop', 'playOnAwake', 'maxParticles'],
                description: '[set_property] Property name to set'
            },
            value: {
                description: '[set_property] Property value'
            },
            rateOverTime: {
                type: 'number',
                description: '[set_emission] Emission rate per second'
            },
            bursts: {
                type: 'array',
                description: '[set_emission] Array of burst configs [{time, count}]',
                items: { type: 'object', properties: { time: { type: 'number' }, count: { type: 'number' } } }
            },
            shapeType: {
                type: 'string',
                enum: ['cone', 'sphere', 'box'],
                description: '[set_shape] Emitter shape type'
            },
            radius: {
                type: 'number',
                description: '[set_shape] Shape radius'
            },
            angle: {
                type: 'number',
                description: '[set_shape] Cone angle in degrees'
            },
            renderMode: {
                type: 'number',
                description: '[set_renderer] Render mode (0=billboard, 1=stretchedBillboard, 2=horizontalBillboard, 3=verticalBillboard, 4=mesh)'
            },
            materialUuid: {
                type: 'string',
                description: '[set_renderer] Material asset UUID'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        add: (args) => this.sceneCall('addParticleSystem', [args.nodeUuid, args.is2d ?? false], 'nodeUuid'),
        set_property: (args) => this.sceneCall('setParticleProperty', [args.nodeUuid, args.property, args.value], 'nodeUuid', 'property', 'value'),
        set_emission: (args) => this.sceneCall('setParticleEmission', [args.nodeUuid, args.rateOverTime, args.bursts], 'nodeUuid'),
        set_shape: (args) => this.sceneCall('setParticleShape', [args.nodeUuid, args.shapeType, args.radius, args.angle], 'nodeUuid'),
        set_renderer: (args) => this.sceneCall('setParticleRenderer', [args.nodeUuid, args.renderMode, args.materialUuid], 'nodeUuid'),
        get_info: (args) => this.sceneCall('getParticleInfo', [args.nodeUuid], 'nodeUuid'),
        list: (_args) => this.sceneCall('listParticleSystems', []),
        remove: (args) => this.sceneCall('removeParticleSystem', [args.nodeUuid], 'nodeUuid'),
    };

    private async sceneCall(method: string, methodArgs: any[], ...required: string[]): Promise<ActionToolResult> {
        if (required.includes('nodeUuid') && !methodArgs[0]) return errorResult('nodeUuid is required');
        if (required.includes('property') && !methodArgs[1]) return errorResult('property is required');
        if (required.includes('value') && methodArgs[2] === undefined) return errorResult('value is required');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method, args: methodArgs
            });
            return (result as any)?.success ? successResult((result as any).data, (result as any).message) : errorResult((result as any)?.error || `${method} failed`);
        } catch (err: any) { return errorResult(err.message); }
    }
}
