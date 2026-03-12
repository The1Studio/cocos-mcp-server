import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

const DEFAULT_MATERIAL_JSON = JSON.stringify({
    "__type__": "cc.Material",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_native": "",
    "_effectAsset": null,
    "_techIdx": 0,
    "_defines": [{}],
    "_states": [{}],
    "_props": [{}]
}, null, 2);

export class ManageMaterial extends BaseActionTool {
    readonly name = 'manage_material';
    readonly description = 'Manage material assets. Actions: create, get_info, set_property, list. Materials control visual appearance of meshes. Use get_info to inspect current properties before modifying.';
    readonly actions = ['create', 'get_info', 'set_property', 'list'];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['create', 'get_info', 'set_property', 'list'],
                description: 'Action to perform: create=create new .mtl asset, get_info=query asset info and meta, set_property=modify a material property in meta, list=list all material assets'
            },
            url: {
                type: 'string',
                description: '[create, get_info, set_property] Asset DB URL (e.g., db://assets/materials/MyMaterial.mtl)'
            },
            property: {
                type: 'string',
                description: '[set_property] Property name to set on the material'
            },
            value: {
                description: '[set_property] Value to assign to the property'
            },
            pattern: {
                type: 'string',
                description: '[list] Glob pattern to filter materials (default: db://assets/**/*.mtl)',
                default: 'db://assets/**/*.mtl'
            }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        create: (args) => this.createMaterial(args),
        get_info: (args) => this.getMaterialInfo(args),
        set_property: (args) => this.setMaterialProperty(args),
        list: (args) => this.listMaterials(args),
    };

    private async createMaterial(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for create');
            const result = await Editor.Message.request('asset-db', 'create-asset', args.url, DEFAULT_MATERIAL_JSON);
            return successResult(
                { url: args.url, uuid: (result as any)?.uuid },
                `Material created at ${args.url}`
            );
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async getMaterialInfo(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for get_info');
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.url);
            let meta: any = null;
            try {
                meta = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            } catch {
                // meta may not be available for all assets
            }
            return successResult({ info, meta });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async setMaterialProperty(args: any): Promise<ActionToolResult> {
        try {
            if (!args.url) return errorResult('url is required for set_property');
            if (!args.property) return errorResult('property is required for set_property');
            if (args.value === undefined) return errorResult('value is required for set_property');

            let meta: any = await Editor.Message.request('asset-db', 'query-asset-meta', args.url);
            if (!meta) meta = {};
            if (!meta.userData) meta.userData = {};
            meta.userData[args.property] = args.value;

            const metaStr = typeof meta === 'string' ? meta : JSON.stringify(meta);
            await Editor.Message.request('asset-db', 'save-asset-meta', args.url, metaStr);
            return successResult(
                { url: args.url, property: args.property, value: args.value },
                `Property '${args.property}' set on material ${args.url}`
            );
        } catch (err: any) {
            return errorResult(err.message);
        }
    }

    private async listMaterials(args: any): Promise<ActionToolResult> {
        try {
            const pattern = args.pattern || 'db://assets/**/*.mtl';
            const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
            return successResult({ materials: assets, count: (assets as any[]).length });
        } catch (err: any) {
            return errorResult(err.message);
        }
    }
}
