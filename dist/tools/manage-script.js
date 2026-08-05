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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFuYWdlLXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS90b29scy9tYW5hZ2Utc2NyaXB0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHlEQUFvRDtBQUNwRCxvQ0FBd0U7QUFDeEUsdUNBQXlCO0FBR3pCLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUFDOzs7WUFHakMsSUFBSTtlQUNELElBQUk7Ozs7Ozs7OztDQVNsQixDQUFDO0FBRUYsTUFBTSxjQUFjLEdBQUcsQ0FBQyxJQUFZLEVBQUUsRUFBRSxDQUFDOzs7WUFHN0IsSUFBSTtlQUNELElBQUk7OztDQUdsQixDQUFDO0FBRUYsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLElBQVksRUFBRSxFQUFFLENBQUM7OztZQUdqQyxJQUFJO2VBQ0QsSUFBSTtnQ0FDYSxJQUFJOzs2QkFFUCxJQUFJOzs7OztjQUtuQixJQUFJOzs7O1VBSVIsSUFBSTs7O0NBR2IsQ0FBQztBQUVGLE1BQWEsWUFBYSxTQUFRLGlDQUFjO0lBQWhEOztRQUNhLFNBQUksR0FBRyxlQUFlLENBQUM7UUFDdkIsZ0JBQVcsR0FBRyxvU0FBb1MsQ0FBQztRQUNuVCxZQUFPLEdBQUcsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUQsZ0JBQVcsR0FBRztZQUNuQixJQUFJLEVBQUUsUUFBUTtZQUNkLFVBQVUsRUFBRTtnQkFDUixNQUFNLEVBQUU7b0JBQ0osSUFBSSxFQUFFLFFBQVE7b0JBQ2QsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQztvQkFDckQsV0FBVyxFQUFFLDhLQUE4SztpQkFDOUw7Z0JBQ0QsR0FBRyxFQUFFO29CQUNELElBQUksRUFBRSxRQUFRO29C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Q0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzNFLENBQUM7UUFBQyxPQUFPLEdBQVEsRUFBRSxDQUFDO1lBQ2hCLE9BQU8sSUFBQSxtQkFBVyxFQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBdkhELG9DQXVIQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2VBY3Rpb25Ub29sIH0gZnJvbSAnLi9iYXNlLWFjdGlvbi10b29sJztcclxuaW1wb3J0IHsgQWN0aW9uVG9vbFJlc3VsdCwgc3VjY2Vzc1Jlc3VsdCwgZXJyb3JSZXN1bHQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmNvbnN0IENPTVBPTkVOVF9URU1QTEFURSA9IChuYW1lOiBzdHJpbmcpID0+IGBpbXBvcnQgeyBfZGVjb3JhdG9yLCBDb21wb25lbnQsIE5vZGUgfSBmcm9tICdjYyc7XHJcbmNvbnN0IHsgY2NjbGFzcywgcHJvcGVydHkgfSA9IF9kZWNvcmF0b3I7XHJcblxyXG5AY2NjbGFzcygnJHtuYW1lfScpXHJcbmV4cG9ydCBjbGFzcyAke25hbWV9IGV4dGVuZHMgQ29tcG9uZW50IHtcclxuICAgIHN0YXJ0KCkge1xyXG5cclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUoZGVsdGFUaW1lOiBudW1iZXIpIHtcclxuXHJcbiAgICB9XHJcbn1cclxuYDtcclxuXHJcbmNvbnN0IEVNUFRZX1RFTVBMQVRFID0gKG5hbWU6IHN0cmluZykgPT4gYGltcG9ydCB7IF9kZWNvcmF0b3IgfSBmcm9tICdjYyc7XHJcbmNvbnN0IHsgY2NjbGFzcyB9ID0gX2RlY29yYXRvcjtcclxuXHJcbkBjY2NsYXNzKCcke25hbWV9JylcclxuZXhwb3J0IGNsYXNzICR7bmFtZX0ge1xyXG5cclxufVxyXG5gO1xyXG5cclxuY29uc3QgU0lOR0xFVE9OX1RFTVBMQVRFID0gKG5hbWU6IHN0cmluZykgPT4gYGltcG9ydCB7IF9kZWNvcmF0b3IsIENvbXBvbmVudCB9IGZyb20gJ2NjJztcclxuY29uc3QgeyBjY2NsYXNzIH0gPSBfZGVjb3JhdG9yO1xyXG5cclxuQGNjY2xhc3MoJyR7bmFtZX0nKVxyXG5leHBvcnQgY2xhc3MgJHtuYW1lfSBleHRlbmRzIENvbXBvbmVudCB7XHJcbiAgICBwcml2YXRlIHN0YXRpYyBfaW5zdGFuY2U6ICR7bmFtZX0gfCBudWxsID0gbnVsbDtcclxuXHJcbiAgICBzdGF0aWMgZ2V0IGluc3RhbmNlKCk6ICR7bmFtZX0ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9pbnN0YW5jZSE7XHJcbiAgICB9XHJcblxyXG4gICAgb25Mb2FkKCkge1xyXG4gICAgICAgIGlmICgke25hbWV9Ll9pbnN0YW5jZSkge1xyXG4gICAgICAgICAgICB0aGlzLm5vZGUuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgICR7bmFtZX0uX2luc3RhbmNlID0gdGhpcztcclxuICAgIH1cclxufVxyXG5gO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hbmFnZVNjcmlwdCBleHRlbmRzIEJhc2VBY3Rpb25Ub29sIHtcclxuICAgIHJlYWRvbmx5IG5hbWUgPSAnbWFuYWdlX3NjcmlwdCc7XHJcbiAgICByZWFkb25seSBkZXNjcmlwdGlvbiA9ICdNYW5hZ2UgVHlwZVNjcmlwdCBzY3JpcHRzIGluIHRoZSBwcm9qZWN0LiBBY3Rpb25zOiBjcmVhdGUsIGdldF9pbmZvLCBsaXN0LCByZWFkLCB3cml0ZS4gVXNlIGNyZWF0ZSB0byBnZW5lcmF0ZSBuZXcgQ29tcG9uZW50IHNjcmlwdHMgd2l0aCBwcm9wZXIgQ29jb3MgYm9pbGVycGxhdGUuIFVzZSByZWFkL3dyaXRlIHRvIHZpZXcgYW5kIG1vZGlmeSBzY3JpcHQgc291cmNlIGNvZGUuIFRvIGF0dGFjaCBhIHNjcmlwdCB0byBhIG5vZGUsIHVzZSBtYW5hZ2VfY29tcG9uZW50IGFjdGlvbj1hdHRhY2hfc2NyaXB0Lic7XHJcbiAgICByZWFkb25seSBhY3Rpb25zID0gWydjcmVhdGUnLCAnZ2V0X2luZm8nLCAnbGlzdCcsICdyZWFkJywgJ3dyaXRlJ107XHJcbiAgICByZWFkb25seSBpbnB1dFNjaGVtYSA9IHtcclxuICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgIGFjdGlvbjoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBlbnVtOiBbJ2NyZWF0ZScsICdnZXRfaW5mbycsICdsaXN0JywgJ3JlYWQnLCAnd3JpdGUnXSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQWN0aW9uIHRvIHBlcmZvcm06IGNyZWF0ZT1jcmVhdGUgbmV3IFRTIHNjcmlwdCB3aXRoIGJvaWxlcnBsYXRlLCBnZXRfaW5mbz1xdWVyeSBhc3NldCBpbmZvLCBsaXN0PWxpc3QgYWxsIFRTIHNjcmlwdHMsIHJlYWQ9cmVhZCBzY3JpcHQgc291cmNlLCB3cml0ZT1vdmVyd3JpdGUgc2NyaXB0IHNvdXJjZSdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgdXJsOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZSwgZ2V0X2luZm8sIHJlYWQsIHdyaXRlXSBBc3NldCBEQiBVUkwgKGUuZy4sIGRiOi8vYXNzZXRzL3NjcmlwdHMvTXlTY3JpcHQudHMpJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBuYW1lOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2NyZWF0ZV0gQ2xhc3MgbmFtZSBmb3IgdGhlIHNjcmlwdCAoUGFzY2FsQ2FzZSwgZS5nLiwgUGxheWVyQ29udHJvbGxlciknXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHRlbXBsYXRlOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGVudW06IFsnY29tcG9uZW50JywgJ2VtcHR5JywgJ3NpbmdsZXRvbiddLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdbY3JlYXRlXSBUZW1wbGF0ZSB0byB1c2UgKGRlZmF1bHQ6IGNvbXBvbmVudCknLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2NvbXBvbmVudCdcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgY29udGVudDoge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1t3cml0ZV0gRnVsbCBUeXBlU2NyaXB0IHNvdXJjZSBjb2RlIHRvIHdyaXRlIHRvIHRoZSBmaWxlJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBwYXR0ZXJuOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAnW2xpc3RdIEdsb2IgcGF0dGVybiB0byBmaWx0ZXIgc2NyaXB0cyAoZGVmYXVsdDogZGI6Ly9hc3NldHMvKiovKi50cyknLFxyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogJ2RiOi8vYXNzZXRzLyoqLyoudHMnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkOiBbJ2FjdGlvbiddXHJcbiAgICB9O1xyXG5cclxuICAgIHByb3RlY3RlZCBhY3Rpb25IYW5kbGVyczogUmVjb3JkPHN0cmluZywgKGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT4pID0+IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4+ID0ge1xyXG4gICAgICAgIGNyZWF0ZTogKGFyZ3MpID0+IHRoaXMuY3JlYXRlU2NyaXB0KGFyZ3MpLFxyXG4gICAgICAgIGdldF9pbmZvOiAoYXJncykgPT4gdGhpcy5nZXRTY3JpcHRJbmZvKGFyZ3MpLFxyXG4gICAgICAgIGxpc3Q6IChhcmdzKSA9PiB0aGlzLmxpc3RTY3JpcHRzKGFyZ3MpLFxyXG4gICAgICAgIHJlYWQ6IChhcmdzKSA9PiB0aGlzLnJlYWRTY3JpcHQoYXJncyksXHJcbiAgICAgICAgd3JpdGU6IChhcmdzKSA9PiB0aGlzLndyaXRlU2NyaXB0KGFyZ3MpLFxyXG4gICAgfTtcclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGNyZWF0ZVNjcmlwdChhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgY3JlYXRlJyk7XHJcbiAgICAgICAgICAgIGlmICghYXJncy5uYW1lKSByZXR1cm4gZXJyb3JSZXN1bHQoJ25hbWUgaXMgcmVxdWlyZWQgZm9yIGNyZWF0ZScpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBhcmdzLnRlbXBsYXRlIHx8ICdjb21wb25lbnQnO1xyXG4gICAgICAgICAgICBsZXQgc291cmNlOiBzdHJpbmc7XHJcbiAgICAgICAgICAgIHN3aXRjaCAodGVtcGxhdGUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgJ2VtcHR5JzpcclxuICAgICAgICAgICAgICAgICAgICBzb3VyY2UgPSBFTVBUWV9URU1QTEFURShhcmdzLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSAnc2luZ2xldG9uJzpcclxuICAgICAgICAgICAgICAgICAgICBzb3VyY2UgPSBTSU5HTEVUT05fVEVNUExBVEUoYXJncy5uYW1lKTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgJ2NvbXBvbmVudCc6XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHNvdXJjZSA9IENPTVBPTkVOVF9URU1QTEFURShhcmdzLm5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdjcmVhdGUtYXNzZXQnLCBhcmdzLnVybCwgc291cmNlKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoXHJcbiAgICAgICAgICAgICAgICB7IHVybDogYXJncy51cmwsIG5hbWU6IGFyZ3MubmFtZSwgdGVtcGxhdGUsIHV1aWQ6IChyZXN1bHQgYXMgYW55KT8udXVpZCB9LFxyXG4gICAgICAgICAgICAgICAgYFNjcmlwdCAnJHthcmdzLm5hbWV9JyBjcmVhdGVkIGF0ICR7YXJncy51cmx9YFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0U2NyaXB0SW5mbyhhcmdzOiBhbnkpOiBQcm9taXNlPEFjdGlvblRvb2xSZXN1bHQ+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAoIWFyZ3MudXJsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ3VybCBpcyByZXF1aXJlZCBmb3IgZ2V0X2luZm8nKTtcclxuICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhcmdzLnVybCk7XHJcbiAgICAgICAgICAgIHJldHVybiBzdWNjZXNzUmVzdWx0KGluZm8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBlcnJvclJlc3VsdChlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgbGlzdFNjcmlwdHMoYXJnczogYW55KTogUHJvbWlzZTxBY3Rpb25Ub29sUmVzdWx0PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGF0dGVybiA9IGFyZ3MucGF0dGVybiB8fCAnZGI6Ly9hc3NldHMvKiovKi50cyc7XHJcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0cyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0cycsIHsgcGF0dGVybiB9KTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyBzY3JpcHRzOiBhc3NldHMsIGNvdW50OiAoYXNzZXRzIGFzIGFueVtdKS5sZW5ndGggfSk7XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGVycm9yUmVzdWx0KGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkU2NyaXB0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciByZWFkJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoOiBzdHJpbmcgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1wYXRoJywgYXJncy51cmwpIGFzIHN0cmluZztcclxuICAgICAgICAgICAgaWYgKCFmaWxlUGF0aCkgcmV0dXJuIGVycm9yUmVzdWx0KGBDb3VsZCBub3QgcmVzb2x2ZSBwYXRoIGZvciAke2FyZ3MudXJsfWApO1xyXG4gICAgICAgICAgICBjb25zdCBjb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGZpbGVQYXRoLCAndXRmLTgnKTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmw6IGFyZ3MudXJsLCBwYXRoOiBmaWxlUGF0aCwgY29udGVudCB9KTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHdyaXRlU2NyaXB0KGFyZ3M6IGFueSk6IFByb21pc2U8QWN0aW9uVG9vbFJlc3VsdD4ge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmICghYXJncy51cmwpIHJldHVybiBlcnJvclJlc3VsdCgndXJsIGlzIHJlcXVpcmVkIGZvciB3cml0ZScpO1xyXG4gICAgICAgICAgICBpZiAoYXJncy5jb250ZW50ID09PSB1bmRlZmluZWQgfHwgYXJncy5jb250ZW50ID09PSBudWxsKSByZXR1cm4gZXJyb3JSZXN1bHQoJ2NvbnRlbnQgaXMgcmVxdWlyZWQgZm9yIHdyaXRlJyk7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQnLCBhcmdzLnVybCwgYXJncy5jb250ZW50KTtcclxuICAgICAgICAgICAgcmV0dXJuIHN1Y2Nlc3NSZXN1bHQoeyB1cmw6IGFyZ3MudXJsIH0sIGBTY3JpcHQgc2F2ZWQgdG8gJHthcmdzLnVybH1gKTtcclxuICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyb3JSZXN1bHQoZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufVxyXG4iXX0=