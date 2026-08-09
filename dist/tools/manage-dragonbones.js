"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageDragonBones = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
class ManageDragonBones extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_dragonbones';
        this.description = 'Manage DragonBones skeletal animation (ArmatureDisplay). Actions: get_info, set_animation, set_armature, set_property, list, add_to_node. Requires DragonBones runtime in project.';
        this.actions = ['get_info', 'set_animation', 'set_armature', 'set_property', 'list', 'add_to_node'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['get_info', 'set_animation', 'set_armature', 'set_property', 'list', 'add_to_node'],
                    description: 'Action: get_info=get ArmatureDisplay info, set_animation=play animation, set_armature=set armature, set_property=set property, list=list DragonBones nodes, add_to_node=add component'
                },
                nodeUuid: {
                    type: 'string',
                    description: '[get_info, set_animation, set_armature, set_property, add_to_node] UUID of the node'
                },
                animationName: {
                    type: 'string',
                    description: '[set_animation] Animation name to play'
                },
                playTimes: {
                    type: 'number',
                    description: '[set_animation] Play times: -1=loop, 0=use default, N=play N times (default: -1)',
                    default: -1
                },
                armatureName: {
                    type: 'string',
                    description: '[set_armature] Armature name to set'
                },
                property: {
                    type: 'string',
                    enum: ['timeScale', 'debugBones', 'playTimes'],
                    description: '[set_property] Property name to set'
                },
                value: {
                    description: '[set_property] Value to set for the property'
                },
                dragonBonesAssetUuid: {
                    type: 'string',
                    description: '[add_to_node] UUID of the DragonBones asset'
                },
                dragonBonesAtlasAssetUuid: {
                    type: 'string',
                    description: '[add_to_node] UUID of the DragonBones atlas asset'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            get_info: (args) => this.getDragonBonesInfo(args),
            set_animation: (args) => this.setDragonBonesAnimation(args),
            set_armature: (args) => this.setDragonBonesArmature(args),
            set_property: (args) => this.setDragonBonesProperty(args),
            list: (args) => this.listDragonBonesNodes(args),
            add_to_node: (args) => this.addDragonBonesToNode(args),
        };
    }
    async getDragonBonesInfo(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for get_info');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'getDragonBonesInfo', args: [args.nodeUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setDragonBonesAnimation(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_animation');
        if (!args.animationName)
            return (0, types_1.errorResult)('animationName is required for set_animation');
        try {
            const playTimes = typeof args.playTimes === 'number' ? args.playTimes : -1;
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setDragonBonesAnimation', args: [args.nodeUuid, args.animationName, playTimes]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Animation '${args.animationName}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setDragonBonesArmature(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_armature');
        if (!args.armatureName)
            return (0, types_1.errorResult)('armatureName is required for set_armature');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setDragonBonesArmature', args: [args.nodeUuid, args.armatureName]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Armature '${args.armatureName}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async setDragonBonesProperty(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for set_property');
        if (!args.property)
            return (0, types_1.errorResult)('property is required for set_property');
        if (args.value === undefined)
            return (0, types_1.errorResult)('value is required for set_property');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'setDragonBonesProperty', args: [args.nodeUuid, args.property, args.value]
            });
            return result.success ? (0, types_1.successResult)(result.data, `Property '${args.property}' set`) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listDragonBonesNodes(_args) {
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'listDragonBonesNodes', args: []
            });
            return result.success ? (0, types_1.successResult)(result.data) : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async addDragonBonesToNode(args) {
        if (!args.nodeUuid)
            return (0, types_1.errorResult)('nodeUuid is required for add_to_node');
        if (!args.dragonBonesAssetUuid)
            return (0, types_1.errorResult)('dragonBonesAssetUuid is required for add_to_node');
        if (!args.dragonBonesAtlasAssetUuid)
            return (0, types_1.errorResult)('dragonBonesAtlasAssetUuid is required for add_to_node');
        try {
            const result = await Editor.Message.request('scene', 'execute-scene-script', {
                name: 'cocos-mcp-server', method: 'addDragonBonesToNode',
                args: [args.nodeUuid, args.dragonBonesAssetUuid, args.dragonBonesAtlasAssetUuid]
            });
            return result.success ? (0, types_1.successResult)(result.data, 'DragonBones component added') : (0, types_1.errorResult)(result.error);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageDragonBones = ManageDragonBones;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLWRyYWdvbmJvbmVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc291cmNlL3Rvb2xzL21hbmFnZS1kcmFnb25ib25lcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSx5REFBb0Q7QUFDcEQsb0NBQXdFO0FBRXhFLE1BQWEsaUJBQWtCLFNBQVEsaUNBQWM7SUFBckQ7O1FBQ2EsU0FBSSxHQUFHLG9CQUFvQixDQUFDO1FBQzVCLGdCQUFXLEdBQUcsb0xBQW9MLENBQUM7UUFDbk0sWUFBTyxHQUFHLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxjQUFjLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxhQUFhLENBQUMsQ0FBQztRQUMvRixnQkFBVyxHQUFHO1lBQ25CLElBQUksRUFBRSxRQUFRO1lBQ2QsVUFBVSxFQUFFO2dCQUNSLE1BQU0sRUFBRTtvQkFDSixJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsQ0FBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsTUFBTSxFQUFFLGFBQWEsQ0FBQztvQkFDMUYsV0FBVyxFQUFFLHVMQUF1TDtpQkFDdk07Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSxxRkFBcUY7aUJBQ3JHO2dCQUNELGFBQWEsRUFBRTtvQkFDWCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsd0NBQXdDO2lCQUN4RDtnQkFDRCxTQUFTLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLGtGQUFrRjtvQkFDL0YsT0FBTyxFQUFFLENBQUMsQ0FBQztpQkFDZDtnQkFDRCxZQUFZLEVBQUU7b0JBQ1YsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsV0FBVyxFQUFFLHFDQUFxQztpQkFDckQ7Z0JBQ0QsUUFBUSxFQUFFO29CQUNOLElBQUksRUFBRSxRQUFRO29CQUNkLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxZQUFZLEVBQUUsV0FBVyxDQUFDO29CQUM5QyxXQUFXLEVBQUUscUNBQXFDO2lCQUNyRDtnQkFDRCxLQUFLLEVBQUU7b0JBQ0gsV0FBVyxFQUFFLDhDQUE4QztpQkFDOUQ7Z0JBQ0Qsb0JBQW9CLEVBQUU7b0JBQ2xCLElBQUksRUFBRSxRQUFRO29CQUNkLFdBQVcsRUFBRSw2Q0FBNkM7aUJBQzdEO2dCQUNELHlCQUF5QixFQUFFO29CQUN2QixJQUFJLEVBQUUsUUFBUTtvQkFDZCxXQUFXLEVBQUUsbURBQW1EO2lCQUNuRTthQUNKO1lBQ0QsUUFBUSxFQUFFLENBQUMsUUFBUSxDQUFDO1NBQ3ZCLENBQUM7UUFFUSxtQkFBYyxHQUE2RTtZQUNqRyxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7WUFDakQsYUFBYSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDO1lBQzNELFlBQVksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQztZQUN6RCxZQUFZLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUM7WUFDekQsSUFBSSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDO1lBQy9DLFdBQVcsRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQztTQUN6RCxDQUFDO0lBb0VOLENBQUM7SUFsRVcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQVM7UUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsbUNBQW1DLENBQUMsQ0FBQztRQUM1RSxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxvQkFBb0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO2FBQ2hGLENBQUMsQ0FBQztZQUNILE9BQVEsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBQSxxQkFBYSxFQUFFLE1BQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBQSxtQkFBVyxFQUFFLE1BQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUM5RyxDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxJQUFTO1FBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHdDQUF3QyxDQUFDLENBQUM7UUFDakYsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsNkNBQTZDLENBQUMsQ0FBQztRQUMzRixJQUFJLENBQUM7WUFDRCxNQUFNLFNBQVMsR0FBRyxPQUFPLElBQUksQ0FBQyxTQUFTLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzRSxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSx5QkFBeUIsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsU0FBUyxDQUFDO2FBQ3BILENBQUMsQ0FBQztZQUNILE9BQVEsTUFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBQSxxQkFBYSxFQUFFLE1BQWMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxJQUFJLENBQUMsYUFBYSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBQSxtQkFBVyxFQUFFLE1BQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2SixDQUFDO1FBQUMsT0FBTyxHQUFRLEVBQUUsQ0FBQztZQUFDLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVPLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxJQUFTO1FBQzFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUTtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHVDQUF1QyxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsMkNBQTJDLENBQUMsQ0FBQztRQUN4RixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSx3QkFBd0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUM7YUFDdkcsQ0FBQyxDQUFDO1lBQ0gsT0FBUSxNQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFBLHFCQUFhLEVBQUUsTUFBYyxDQUFDLElBQUksRUFBRSxhQUFhLElBQUksQ0FBQyxZQUFZLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFXLEVBQUUsTUFBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3JKLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQUMsQ0FBQztJQUMzRCxDQUFDO0lBRU8sS0FBSyxDQUFDLHNCQUFzQixDQUFDLElBQVM7UUFDMUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsdUNBQXVDLENBQUMsQ0FBQztRQUNoRixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyx1Q0FBdUMsQ0FBQyxDQUFDO1FBQ2hGLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSx3QkFBd0IsRUFBRSxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQzthQUMvRyxDQUFDLENBQUM7WUFDSCxPQUFRLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUEscUJBQWEsRUFBRSxNQUFjLENBQUMsSUFBSSxFQUFFLGFBQWEsSUFBSSxDQUFDLFFBQVEsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQVcsRUFBRSxNQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakosQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9CLENBQUMsS0FBVTtRQUN6QyxJQUFJLENBQUM7WUFDRCxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsRUFBRTtnQkFDekUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sRUFBRSxzQkFBc0IsRUFBRSxJQUFJLEVBQUUsRUFBRTthQUNyRSxDQUFDLENBQUM7WUFDSCxPQUFRLE1BQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUEscUJBQWEsRUFBRSxNQUFjLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUEsbUJBQVcsRUFBRSxNQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUcsQ0FBQztRQUFDLE9BQU8sR0FBUSxFQUFFLENBQUM7WUFBQyxPQUFPLElBQUEsbUJBQVcsRUFBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFBQyxDQUFDO0lBQzNELENBQUM7SUFFTyxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBUztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVE7WUFBRSxPQUFPLElBQUEsbUJBQVcsRUFBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQy9FLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CO1lBQUUsT0FBTyxJQUFBLG1CQUFXLEVBQUMsa0RBQWtELENBQUMsQ0FBQztRQUN2RyxJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUF5QjtZQUFFLE9BQU8sSUFBQSxtQkFBVyxFQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDakgsSUFBSSxDQUFDO1lBQ0QsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsc0JBQXNCLEVBQUU7Z0JBQ3pFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxNQUFNLEVBQUUsc0JBQXNCO2dCQUN4RCxJQUFJLEVBQUUsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMseUJBQXlCLENBQUM7YUFDbkYsQ0FBQyxDQUFDO1lBQ0gsT0FBUSxNQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFBLHFCQUFhLEVBQUUsTUFBYyxDQUFDLElBQUksRUFBRSw2QkFBNkIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFBLG1CQUFXLEVBQUUsTUFBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzdJLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQUMsT0FBTyxJQUFBLG1CQUFXLEVBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQUMsQ0FBQztJQUMzRCxDQUFDO0NBQ0o7QUE1SEQsOENBNEhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQmFzZUFjdGlvblRvb2wgfSBmcm9tICcuL2Jhc2UtYWN0aW9uLXRvb2wnO1xuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBjbGFzcyBNYW5hZ2VEcmFnb25Cb25lcyBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcbiAgICByZWFkb25seSBuYW1lID0gJ21hbmFnZV9kcmFnb25ib25lcyc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIERyYWdvbkJvbmVzIHNrZWxldGFsIGFuaW1hdGlvbiAoQXJtYXR1cmVEaXNwbGF5KS4gQWN0aW9uczogZ2V0X2luZm8sIHNldF9hbmltYXRpb24sIHNldF9hcm1hdHVyZSwgc2V0X3Byb3BlcnR5LCBsaXN0LCBhZGRfdG9fbm9kZS4gUmVxdWlyZXMgRHJhZ29uQm9uZXMgcnVudGltZSBpbiBwcm9qZWN0Lic7XG4gICAgcmVhZG9ubHkgYWN0aW9ucyA9IFsnZ2V0X2luZm8nLCAnc2V0X2FuaW1hdGlvbicsICdzZXRfYXJtYXR1cmUnLCAnc2V0X3Byb3BlcnR5JywgJ2xpc3QnLCAnYWRkX3RvX25vZGUnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnZ2V0X2luZm8nLCAnc2V0X2FuaW1hdGlvbicsICdzZXRfYXJtYXR1cmUnLCAnc2V0X3Byb3BlcnR5JywgJ2xpc3QnLCAnYWRkX3RvX25vZGUnXSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FjdGlvbjogZ2V0X2luZm89Z2V0IEFybWF0dXJlRGlzcGxheSBpbmZvLCBzZXRfYW5pbWF0aW9uPXBsYXkgYW5pbWF0aW9uLCBzZXRfYXJtYXR1cmU9c2V0IGFybWF0dXJlLCBzZXRfcHJvcGVydHk9c2V0IHByb3BlcnR5LCBsaXN0PWxpc3QgRHJhZ29uQm9uZXMgbm9kZXMsIGFkZF90b19ub2RlPWFkZCBjb21wb25lbnQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgbm9kZVV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tnZXRfaW5mbywgc2V0X2FuaW1hdGlvbiwgc2V0X2FybWF0dXJlLCBzZXRfcHJvcGVydHksIGFkZF90b19ub2RlXSBVVUlEIG9mIHRoZSBub2RlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGFuaW1hdGlvbk5hbWU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tzZXRfYW5pbWF0aW9uXSBBbmltYXRpb24gbmFtZSB0byBwbGF5J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBsYXlUaW1lczoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9hbmltYXRpb25dIFBsYXkgdGltZXM6IC0xPWxvb3AsIDA9dXNlIGRlZmF1bHQsIE49cGxheSBOIHRpbWVzIChkZWZhdWx0OiAtMSknLFxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IC0xXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYXJtYXR1cmVOYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X2FybWF0dXJlXSBBcm1hdHVyZSBuYW1lIHRvIHNldCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwcm9wZXJ0eToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsndGltZVNjYWxlJywgJ2RlYnVnQm9uZXMnLCAncGxheVRpbWVzJ10sXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbc2V0X3Byb3BlcnR5XSBQcm9wZXJ0eSBuYW1lIHRvIHNldCdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB2YWx1ZToge1xuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW3NldF9wcm9wZXJ0eV0gVmFsdWUgdG8gc2V0IGZvciB0aGUgcHJvcGVydHknXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZHJhZ29uQm9uZXNBc3NldFV1aWQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1thZGRfdG9fbm9kZV0gVVVJRCBvZiB0aGUgRHJhZ29uQm9uZXMgYXNzZXQnXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZDoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2FkZF90b19ub2RlXSBVVUlEIG9mIHRoZSBEcmFnb25Cb25lcyBhdGxhcyBhc3NldCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXREcmFnb25Cb25lc0luZm8oYXJncyksXG4gICAgICAgIHNldF9hbmltYXRpb246IChhcmdzKSA9PiB0aGlzLnNldERyYWdvbkJvbmVzQW5pbWF0aW9uKGFyZ3MpLFxuICAgICAgICBzZXRfYXJtYXR1cmU6IChhcmdzKSA9PiB0aGlzLnNldERyYWdvbkJvbmVzQXJtYXR1cmUoYXJncyksXG4gICAgICAgIHNldF9wcm9wZXJ0eTogKGFyZ3MpID0+IHRoaXMuc2V0RHJhZ29uQm9uZXNQcm9wZXJ0eShhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdERyYWdvbkJvbmVzTm9kZXMoYXJncyksXG4gICAgICAgIGFkZF90b19ub2RlOiAoYXJncykgPT4gdGhpcy5hZGREcmFnb25Cb25lc1RvTm9kZShhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBnZXREcmFnb25Cb25lc0luZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnZ2V0RHJhZ29uQm9uZXNJbmZvJywgYXJnczogW2FyZ3Mubm9kZVV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEpIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0RHJhZ29uQm9uZXNBbmltYXRpb24oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIGlmICghYXJncy5ub2RlVXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdub2RlVXVpZCBpcyByZXF1aXJlZCBmb3Igc2V0X2FuaW1hdGlvbicpO1xuICAgICAgICBpZiAoIWFyZ3MuYW5pbWF0aW9uTmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCdhbmltYXRpb25OYW1lIGlzIHJlcXVpcmVkIGZvciBzZXRfYW5pbWF0aW9uJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBwbGF5VGltZXMgPSB0eXBlb2YgYXJncy5wbGF5VGltZXMgPT09ICdudW1iZXInID8gYXJncy5wbGF5VGltZXMgOiAtMTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnc2V0RHJhZ29uQm9uZXNBbmltYXRpb24nLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5hbmltYXRpb25OYW1lLCBwbGF5VGltZXNdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIGBBbmltYXRpb24gJyR7YXJncy5hbmltYXRpb25OYW1lfScgc2V0YCkgOiBlcnJvclJlc3VsdCgocmVzdWx0IGFzIGFueSkuZXJyb3IpO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkgeyByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpOyB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBzZXREcmFnb25Cb25lc0FybWF0dXJlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIHNldF9hcm1hdHVyZScpO1xuICAgICAgICBpZiAoIWFyZ3MuYXJtYXR1cmVOYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2FybWF0dXJlTmFtZSBpcyByZXF1aXJlZCBmb3Igc2V0X2FybWF0dXJlJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldERyYWdvbkJvbmVzQXJtYXR1cmUnLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5hcm1hdHVyZU5hbWVdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsIGBBcm1hdHVyZSAnJHthcmdzLmFybWF0dXJlTmFtZX0nIHNldGApIDogZXJyb3JSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmVycm9yKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHsgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTsgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgc2V0RHJhZ29uQm9uZXNQcm9wZXJ0eShhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgaWYgKCFhcmdzLm5vZGVVdWlkKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25vZGVVdWlkIGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcbiAgICAgICAgaWYgKCFhcmdzLnByb3BlcnR5KSByZXR1cm4gZXJyb3JSZXN1bHQoJ3Byb3BlcnR5IGlzIHJlcXVpcmVkIGZvciBzZXRfcHJvcGVydHknKTtcbiAgICAgICAgaWYgKGFyZ3MudmFsdWUgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGVycm9yUmVzdWx0KCd2YWx1ZSBpcyByZXF1aXJlZCBmb3Igc2V0X3Byb3BlcnR5Jyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnY29jb3MtbWNwLXNlcnZlcicsIG1ldGhvZDogJ3NldERyYWdvbkJvbmVzUHJvcGVydHknLCBhcmdzOiBbYXJncy5ub2RlVXVpZCwgYXJncy5wcm9wZXJ0eSwgYXJncy52YWx1ZV1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgYXMgYW55KS5zdWNjZXNzID8gc3VjY2Vzc1Jlc3VsdCgocmVzdWx0IGFzIGFueSkuZGF0YSwgYFByb3BlcnR5ICcke2FyZ3MucHJvcGVydHl9JyBzZXRgKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGxpc3REcmFnb25Cb25lc05vZGVzKF9hcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnbGlzdERyYWdvbkJvbmVzTm9kZXMnLCBhcmdzOiBbXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCBhcyBhbnkpLnN1Y2Nlc3MgPyBzdWNjZXNzUmVzdWx0KChyZXN1bHQgYXMgYW55KS5kYXRhKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGFkZERyYWdvbkJvbmVzVG9Ob2RlKGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICBpZiAoIWFyZ3Mubm9kZVV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnbm9kZVV1aWQgaXMgcmVxdWlyZWQgZm9yIGFkZF90b19ub2RlJyk7XG4gICAgICAgIGlmICghYXJncy5kcmFnb25Cb25lc0Fzc2V0VXVpZCkgcmV0dXJuIGVycm9yUmVzdWx0KCdkcmFnb25Cb25lc0Fzc2V0VXVpZCBpcyByZXF1aXJlZCBmb3IgYWRkX3RvX25vZGUnKTtcbiAgICAgICAgaWYgKCFhcmdzLmRyYWdvbkJvbmVzQXRsYXNBc3NldFV1aWQpIHJldHVybiBlcnJvclJlc3VsdCgnZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZCBpcyByZXF1aXJlZCBmb3IgYWRkX3RvX25vZGUnKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjb2Nvcy1tY3Atc2VydmVyJywgbWV0aG9kOiAnYWRkRHJhZ29uQm9uZXNUb05vZGUnLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLm5vZGVVdWlkLCBhcmdzLmRyYWdvbkJvbmVzQXNzZXRVdWlkLCBhcmdzLmRyYWdvbkJvbmVzQXRsYXNBc3NldFV1aWRdXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAocmVzdWx0IGFzIGFueSkuc3VjY2VzcyA/IHN1Y2Nlc3NSZXN1bHQoKHJlc3VsdCBhcyBhbnkpLmRhdGEsICdEcmFnb25Cb25lcyBjb21wb25lbnQgYWRkZWQnKSA6IGVycm9yUmVzdWx0KChyZXN1bHQgYXMgYW55KS5lcnJvcik7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7IHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7IH1cbiAgICB9XG59XG4iXX0=