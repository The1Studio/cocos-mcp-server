"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageScript = void 0;
const base_action_tool_1 = require("./base-action-tool");
const types_1 = require("../types");
const fs = __importStar(require("fs"));
const COMPONENT_TEMPLATE = (name) => `import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('${name}')
export class ${name} extends Component {
    start() {

    }

    update(deltaTime: number) {

    }
}
`;
const EMPTY_TEMPLATE = (name) => `import { _decorator } from 'cc';
const { ccclass } = _decorator;

@ccclass('${name}')
export class ${name} {

}
`;
const SINGLETON_TEMPLATE = (name) => `import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

@ccclass('${name}')
export class ${name} extends Component {
    private static _instance: ${name} | null = null;

    static get instance(): ${name} {
        return this._instance!;
    }

    onLoad() {
        if (${name}._instance) {
            this.node.destroy();
            return;
        }
        ${name}._instance = this;
    }
}
`;
class ManageScript extends base_action_tool_1.BaseActionTool {
    constructor() {
        super(...arguments);
        this.name = 'manage_script';
        this.description = 'Manage TypeScript scripts in the project. Actions: create, get_info, list, read, write. Use create to generate new Component scripts with proper Cocos boilerplate. Use read/write to view and modify script source code. To attach a script to a node, use manage_component action=attach_script.';
        this.actions = ['create', 'get_info', 'list', 'read', 'write'];
        this.inputSchema = {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['create', 'get_info', 'list', 'read', 'write'],
                    description: 'Action to perform: create=create new TS script with boilerplate, get_info=query asset info, list=list all TS scripts, read=read script source, write=overwrite script source'
                },
                url: {
                    type: 'string',
                    description: '[create, get_info, read, write] Asset DB URL (e.g., db://assets/scripts/MyScript.ts)'
                },
                name: {
                    type: 'string',
                    description: '[create] Class name for the script (PascalCase, e.g., PlayerController)'
                },
                template: {
                    type: 'string',
                    enum: ['component', 'empty', 'singleton'],
                    description: '[create] Template to use (default: component)',
                    default: 'component'
                },
                content: {
                    type: 'string',
                    description: '[write] Full TypeScript source code to write to the file'
                },
                pattern: {
                    type: 'string',
                    description: '[list] Glob pattern to filter scripts (default: db://assets/**/*.ts)',
                    default: 'db://assets/**/*.ts'
                }
            },
            required: ['action']
        };
        this.actionHandlers = {
            create: (args) => this.createScript(args),
            get_info: (args) => this.getScriptInfo(args),
            list: (args) => this.listScripts(args),
            read: (args) => this.readScript(args),
            write: (args) => this.writeScript(args),
        };
    }
    async createScript(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for create');
            if (!args.name)
                return (0, types_1.errorResult)('name is required for create');
            const template = args.template || 'component';
            let source;
            switch (template) {
                case 'empty':
                    source = EMPTY_TEMPLATE(args.name);
                    break;
                case 'singleton':
                    source = SINGLETON_TEMPLATE(args.name);
                    break;
                case 'component':
                default:
                    source = COMPONENT_TEMPLATE(args.name);
                    break;
            }
            const result = await Editor.Message.request('asset-db', 'create-asset', args.url, source);
            return (0, types_1.successResult)({ url: args.url, name: args.name, template, uuid: result === null || result === void 0 ? void 0 : result.uuid }, `Script '${args.name}' created at ${args.url}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async getScriptInfo(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            return (0, types_1.successResult)(info);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async listScripts(args) {
        try {
            const pattern = args.pattern || 'db://assets/**/*.ts';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return (0, types_1.successResult)({ scripts: assets, count: assets.length });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async readScript(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for read');
            const filePath = await Editor.Message.request('asset-db', 'query-path', args.url);
            if (!filePath)
                return (0, types_1.errorResult)(`Could not resolve path for ${args.url}`);
            const content = fs.readFileSync(filePath, 'utf-8');
            return (0, types_1.successResult)({ url: args.url, path: filePath, content });
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
    async writeScript(args) {
        try {
            if (!args.url)
                return (0, types_1.errorResult)('url is required for write');
            if (args.content === undefined || args.content === null)
                return (0, types_1.errorResult)('content is required for write');
            await Editor.Message.request('asset-db', 'save-asset', args.url, args.content);
            return (0, types_1.successResult)({ url: args.url }, `Script saved to ${args.url}`);
        }
        catch (err) {
            return (0, types_1.errorResult)(err.message);
        }
    }
}
exports.ManageScript = ManageScript;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2Utc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsdUNBQXlCO0FBR3pCLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUFDOzs7WUFHakMsSUFBSTtlQUNELElBQUk7Ozs7Ozs7OztDQVNsQixDQUFDO0FBRUYsTUFBTSxjQUFjLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUFDOzs7WUFHN0IsSUFBSTtlQUNELElBQUk7OztDQUdsQixDQUFDO0FBRUYsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLElBQVksRUFBRSxFQUFFLENBQUM7OztZQUdqQyxJQUFJO2VBQ0QsSUFBSTtnQ0FDYSxJQUFJOzs2QkFFUCxJQUFJOzs7OztjQUtuQixJQUFJOzs7O1VBSVIsSUFBSTs7O0NBR2IsQ0FBQztBQUVGLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNhLFNBQUksR0FBRyxlQUFlLENBQUM7UUFDdkIsZ0JBQVcsR0FBRyxvU0FBb1MsQ0FBQztRQUNuVCxZQUFPLEdBQUcsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUQsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQztvQkFDckQsV0FBVyxFQUFFLDhLQUE4SztpQkFDOUw7Z0JBQ0QsR0FBRyxFQUFFO29CQUNELElBQUksRUFBRSxRQUFRO29C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Q0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzNFLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBdkhELG9DQXVIQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcbmltcG9ydCB7IEFjdGlvblRvb2xSZXN1bHQsIHN1Y2Nlc3NSZXN1bHQsIGVycm9yUmVzdWx0IH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuY29uc3QgQ09NUE9ORU5UX1RFTVBMQVRFID0gKG5hbWU6IHN0cmluZykgPT4gYGltcG9ydCB7IF9kZWNvcmF0b3IsIENvbXBvbmVudCwgTm9kZSB9IGZyb20gJ2NjJztcbmNvbnN0IHsgY2NjbGFzcywgcHJvcGVydHkgfSA9IF9kZWNvcmF0b3I7XG5cbkBjY2NsYXNzKCcke25hbWV9JylcbmV4cG9ydCBjbGFzcyAke25hbWV9IGV4dGVuZHMgQ29tcG9uZW50IHtcbiAgICBzdGFydCgpIHtcblxuICAgIH1cblxuICAgIHVwZGF0ZShkZWx0YVRpbWU6IG51bWJlcikge1xuXG4gICAgfVxufVxuYDtcblxuY29uc3QgRU1QVFlfVEVNUExBVEUgPSAobmFtZTogc3RyaW5nKSA9PiBgaW1wb3J0IHsgX2RlY29yYXRvciB9IGZyb20gJ2NjJztcbmNvbnN0IHsgY2NjbGFzcyB9ID0gX2RlY29yYXRvcjtcblxuQGNjY2xhc3MoJyR7bmFtZX0nKVxuZXhwb3J0IGNsYXNzICR7bmFtZX0ge1xuXG59XG5gO1xuXG5jb25zdCBTSU5HTEVUT05fVEVNUExBVEUgPSAobmFtZTogc3RyaW5nKSA9PiBgaW1wb3J0IHsgX2RlY29yYXRvciwgQ29tcG9uZW50IH0gZnJvbSAnY2MnO1xuY29uc3QgeyBjY2NsYXNzIH0gPSBfZGVjb3JhdG9yO1xuXG5AY2NjbGFzcygnJHtuYW1lfScpXG5leHBvcnQgY2xhc3MgJHtuYW1lfSBleHRlbmRzIENvbXBvbmVudCB7XG4gICAgcHJpdmF0ZSBzdGF0aWMgX2luc3RhbmNlOiAke25hbWV9IHwgbnVsbCA9IG51bGw7XG5cbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCk6ICR7bmFtZX0ge1xuICAgICAgICByZXR1cm4gdGhpcy5faW5zdGFuY2UhO1xuICAgIH1cblxuICAgIG9uTG9hZCgpIHtcbiAgICAgICAgaWYgKCR7bmFtZX0uX2luc3RhbmNlKSB7XG4gICAgICAgICAgICB0aGlzLm5vZGUuZGVzdHJveSgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgICR7bmFtZX0uX2luc3RhbmNlID0gdGhpcztcbiAgICB9XG59XG5gO1xuXG5leHBvcnQgY2xhc3MgTWFuYWdlU2NyaXB0IGV4dGVuZHMgQmFzZUFjdGlvblRvb2wge1xuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NjcmlwdCc7XG4gICAgcmVhZG9ubHkgZGVzY3JpcHRpb24gPSAnTWFuYWdlIFR5cGVTY3JpcHQgc2NyaXB0cyBpbiB0aGUgcHJvamVjdC4gQWN0aW9uczogY3JlYXRlLCBnZXRfaW5mbywgbGlzdCwgcmVhZCwgd3JpdGUuIFVzZSBjcmVhdGUgdG8gZ2VuZXJhdGUgbmV3IENvbXBvbmVudCBzY3JpcHRzIHdpdGggcHJvcGVyIENvY29zIGJvaWxlcnBsYXRlLiBVc2UgcmVhZC93cml0ZSB0byB2aWV3IGFuZCBtb2RpZnkgc2NyaXB0IHNvdXJjZSBjb2RlLiBUbyBhdHRhY2ggYSBzY3JpcHQgdG8gYSBub2RlLCB1c2UgbWFuYWdlX2NvbXBvbmVudCBhY3Rpb249YXR0YWNoX3NjcmlwdC4nO1xuICAgIHJlYWRvbmx5IGFjdGlvbnMgPSBbJ2NyZWF0ZScsICdnZXRfaW5mbycsICdsaXN0JywgJ3JlYWQnLCAnd3JpdGUnXTtcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcbiAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgIGFjdGlvbjoge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnY3JlYXRlJywgJ2dldF9pbmZvJywgJ2xpc3QnLCAncmVhZCcsICd3cml0ZSddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGNyZWF0ZT1jcmVhdGUgbmV3IFRTIHNjcmlwdCB3aXRoIGJvaWxlcnBsYXRlLCBnZXRfaW5mbz1xdWVyeSBhc3NldCBpbmZvLCBsaXN0PWxpc3QgYWxsIFRTIHNjcmlwdHMsIHJlYWQ9cmVhZCBzY3JpcHQgc291cmNlLCB3cml0ZT1vdmVyd3JpdGUgc2NyaXB0IHNvdXJjZSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB1cmw6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tjcmVhdGUsIGdldF9pbmZvLCByZWFkLCB3cml0ZV0gQXNzZXQgREIgVVJMIChlLmcuLCBkYjovL2Fzc2V0cy9zY3JpcHRzL015U2NyaXB0LnRzKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBuYW1lOiB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBDbGFzcyBuYW1lIGZvciB0aGUgc2NyaXB0IChQYXNjYWxDYXNlLCBlLmcuLCBQbGF5ZXJDb250cm9sbGVyKSdcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0ZW1wbGF0ZToge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIGVudW06IFsnY29tcG9uZW50JywgJ2VtcHR5JywgJ3NpbmdsZXRvbiddLFxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gVGVtcGxhdGUgdG8gdXNlIChkZWZhdWx0OiBjb21wb25lbnQpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnY29tcG9uZW50J1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1t3cml0ZV0gRnVsbCBUeXBlU2NyaXB0IHNvdXJjZSBjb2RlIHRvIHdyaXRlIHRvIHRoZSBmaWxlJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBhdHRlcm46IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1tsaXN0XSBHbG9iIHBhdHRlcm4gdG8gZmlsdGVyIHNjcmlwdHMgKGRlZmF1bHQ6IGRiOi8vYXNzZXRzLyoqLyoudHMpJyxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnZGI6Ly9hc3NldHMvKiovKi50cydcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgcmVxdWlyZWQ6IFsnYWN0aW9uJ11cbiAgICB9O1xuXG4gICAgcHJvdGVjdGVkIGFjdGlvbkhhbmRsZXJzOiBSZWNvcmQ8c3RyaW5nLCAoYXJnczogUmVjb3JkPHN0cmluZywgYW55PikgPT4gUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0Pj4gPSB7XG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlU2NyaXB0KGFyZ3MpLFxuICAgICAgICBnZXRfaW5mbzogKGFyZ3MpID0+IHRoaXMuZ2V0U2NyaXB0SW5mbyhhcmdzKSxcbiAgICAgICAgbGlzdDogKGFyZ3MpID0+IHRoaXMubGlzdFNjcmlwdHMoYXJncyksXG4gICAgICAgIHJlYWQ6IChhcmdzKSA9PiB0aGlzLnJlYWRTY3JpcHQoYXJncyksXG4gICAgICAgIHdyaXRlOiAoYXJncykgPT4gdGhpcy53cml0ZVNjcmlwdChhcmdzKSxcbiAgICB9O1xuXG4gICAgcHJpdmF0ZSBhc3luYyBjcmVhdGVTY3JpcHQoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgY3JlYXRlJyk7XG4gICAgICAgICAgICBpZiAoIWFyZ3MubmFtZSkgcmV0dXJuIGVycm9yUmVzdWx0KCduYW1lIGlzIHJlcXVpcmVkIGZvciBjcmVhdGUnKTtcblxuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBhcmdzLnRlbXBsYXRlIHx8ICdjb21wb25lbnQnO1xuICAgICAgICAgICAgbGV0IHNvdXJjZTogc3RyaW5nO1xuICAgICAgICAgICAgc3dpdGNoICh0ZW1wbGF0ZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ2VtcHR5JzpcbiAgICAgICAgICAgICAgICAgICAgc291cmNlID0gRU1QVFlfVEVNUExBVEUoYXJncy5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnc2luZ2xldG9uJzpcbiAgICAgICAgICAgICAgICAgICAgc291cmNlID0gU0lOR0xFVE9OX1RFTVBMQVRFKGFyZ3MubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgc291cmNlID0gQ09NUE9ORU5UX1RFTVBMQVRFKGFyZ3MubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBhcmdzLnVybCwgc291cmNlKTtcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KFxuICAgICAgICAgICAgICAgIHsgdXJsOiBhcmdzLnVybCwgbmFtZTogYXJncy5uYW1lLCB0ZW1wbGF0ZSwgdXVpZDogKHJlc3VsdCBhcyBhbnkpPy51dWlkIH0sXG4gICAgICAgICAgICAgICAgYFNjcmlwdCAnJHthcmdzLm5hbWV9JyBjcmVhdGVkIGF0ICR7YXJncy51cmx9YFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGdldFNjcmlwdEluZm8oYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcbiAgICAgICAgICAgIGNvbnN0IGluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgYXJncy51cmwpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoaW5mbyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBsaXN0U2NyaXB0cyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBhcmdzLnBhdHRlcm4gfHwgJ2RiOi8vYXNzZXRzLyoqLyoudHMnO1xuICAgICAgICAgICAgY29uc3QgYXNzZXRzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXRzJywgeyBwYXR0ZXJuIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBzY3JpcHRzOiBhc3NldHMsIGNvdW50OiAoYXNzZXRzIGFzIGFueVtdKS5sZW5ndGggfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkU2NyaXB0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIHJlYWQnKTtcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1wYXRoJywgYXJncy51cmwpIGFzIHN0cmluZztcbiAgICAgICAgICAgIGlmICghZmlsZVBhdGgpIHJldHVybiBlcnJvclJlc3VsdChgQ291bGQgbm90IHJlc29sdmUgcGF0aCBmb3IgJHthcmdzLnVybH1gKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGgsICd1dGYtOCcpO1xuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmw6IGFyZ3MudXJsLCBwYXRoOiBmaWxlUGF0aCwgY29udGVudCB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIHdyaXRlU2NyaXB0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgaWYgKCFhcmdzLnVybCkgcmV0dXJuIGVycm9yUmVzdWx0KCd1cmwgaXMgcmVxdWlyZWQgZm9yIHdyaXRlJyk7XG4gICAgICAgICAgICBpZiAoYXJncy5jb250ZW50ID09PSB1bmRlZmluZWQgfHwgYXJncy5jb250ZW50ID09PSBudWxsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2NvbnRlbnQgaXMgcmVxdWlyZWQgZm9yIHdyaXRlJyk7XG4gICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdzYXZlLWFzc2V0JywgYXJncy51cmwsIGFyZ3MuY29udGVudCk7XG4gICAgICAgICAgICByZXR1cm4gc3VjY2Vzc1Jlc3VsdCh7IHVybDogYXJncy51cmwgfSwgYFNjcmlwdCBzYXZlZCB0byAke2FyZ3MudXJsfWApO1xuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbiJdfQ==