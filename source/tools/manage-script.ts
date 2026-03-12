import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const COMPONENT_TEMPLATE = (name: string) => `import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('${name}')
export class ${name} extends Component {
    start() {

    }

    update(deltaTime: number) {

    }
}
`;

const EMPTY_TEMPLATE = (name: string) => `import { _decorator } from 'cc';
const { ccclass } = _decorator;

@ccclass('${name}')
export class ${name} {

}
`;

const SINGLETON_TEMPLATE = (name: string) => `import { _decorator, Component } from 'cc';
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

export class ManageScript extends BaseActionTool {
    readonly name = 'manage_script';
    readonly description = 'Manage TypeScript scripts in the project. Actions: create, get_info, list, read, write. Use create to generate new Component scripts with proper Cocos boilerplate. Use read/write to view and modify script source code. To attach a script to a node, use manage_component action=attach_script.';
    readonly actions = ['create', 'get_info', 'list', 'read', 'write'];
    readonly inputSchema = {
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

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        create: (args) => this.createScript(args),
        get_info: (args) => this.getScriptInfo(args),
        list: (args) => this.listScripts(args),
        read: (args) => this.readScript(args),
        write: (args) => this.writeScript(args),
    };

    private async createScript(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for create');
            if (!args.name) return errorResult('name is required for create');

            const template = args.template || 'component';
            let source: string;
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
            return successResult(
                { url: args.url, name: args.name, template, uuid: (result as any)?.uuid },
                `Script '${args.name}' created at ${args.url}`
            );
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async getScriptInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            return successResult(info);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async listScripts(args: any): Promise<ActionToolResult> {
        try {
            const pattern = args.pattern || 'db://assets/**/*.ts';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return successResult({ scripts: assets, count: (assets as any[]).length });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async readScript(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for read');
            const filePath: string = await Editor.Message.request('asset-db', 'query-path', args.url) as string;
            if (!filePath) return errorResult(`Could not resolve path for ${args.url}`);
            const content = fs.readFileSync(filePath, 'utf-8');
            return successResult({ url: args.url, path: filePath, content });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async writeScript(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for write');
            if (args.content === undefined || args.content === null) return errorResult('content is required for write');
            await Editor.Message.request('asset-db', 'save-asset', args.url, args.content);
            return successResult({ url: args.url }, `Script saved to ${args.url}`);
        } catch (err: any) {
            return errorResult(err.message);
        }
    }
}
