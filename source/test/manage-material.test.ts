import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManageMaterial } from '../tools/manage-material';

/**
 * #24 — `manage_material.set_property` reported success for a write that could not
 * affect the material: it only set `meta.userData[property]`. The serialized `_props`
 * entry was untouched, survived reimport, and the runtime kept resolving the stale
 * reference.
 */
describe('ManageMaterial.set_property (#24)', () => {
    let tool: ManageMaterial;
    let mockRequest: jest.Mock;
    const tmpFiles: string[] = [];

    const MTL_URL = 'db://assets/materials/Water.mtl';

    function writeMaterial(props: Record<string, any>, techIdx = 0): string {
        const file = path.join(os.tmpdir(), `t1k-material-${process.pid}-${Math.random().toString(36).slice(2)}.mtl`);
        const propsArray: any[] = [];
        for (let i = 0; i <= techIdx; i++) propsArray.push(i === techIdx ? props : {});
        fs.writeFileSync(file, JSON.stringify({
            __type__: 'cc.Material', _name: '', _objFlags: 0, __editorExtras__: {}, _native: '',
            _effectAsset: { __uuid__: 'effect-uuid' }, _techIdx: techIdx,
            _defines: [{}], _states: [{}], _props: propsArray,
        }, null, 2), 'utf-8');
        tmpFiles.push(file);
        return file;
    }

    /** Routes by message name so a wrong call order cannot pass by accident. */
    function routeMessages(handlers: Record<string, (...args: any[]) => any>) {
        mockRequest.mockReset();
        mockRequest.mockImplementation(async (pkg: string, message: string, ...args: any[]) => {
            const handler = handlers[message];
            if (!handler) throw new Error(`${pkg} - ${message} does not exist`);
            return handler(...args);
        });
    }

    /** asset-db handlers that persist `save-asset` to the backing file, like the editor. */
    function standaloneMaterial(file: string, extra: Record<string, (...a: any[]) => any> = {}) {
        return {
            'query-asset-info': () => ({ name: 'Water.mtl', url: MTL_URL, file, uuid: 'mat-uuid', importer: 'material', type: 'cc.Material' }),
            'save-asset': (_url: string, content: string) => { fs.writeFileSync(file, content, 'utf-8'); return {}; },
            'reimport-asset': () => true,
            ...extra,
        };
    }

    beforeEach(() => {
        tool = new ManageMaterial();
        mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockReset();
    });

    afterEach(() => {
        mockRequest.mockReset();
        mockRequest.mockResolvedValue({});
        while (tmpFiles.length) {
            const f = tmpFiles.pop()!;
            try { fs.unlinkSync(f); } catch { /* already gone */ }
        }
    });

    it('requires url, property and value', async () => {
        expect((await tool.execute('set_property', {})).success).toBe(false);
        expect((await tool.execute('set_property', { url: MTL_URL })).success).toBe(false);
        expect((await tool.execute('set_property', { url: MTL_URL, property: 'albedo' })).success).toBe(false);
    });

    it('writes the serialized _props entry, never meta.userData', async () => {
        const file = writeMaterial({ mainTexture: { __uuid__: 'old-tex' } });
        routeMessages(standaloneMaterial(file));

        const result = await tool.execute('set_property', {
            url: MTL_URL, property: 'roughness', value: 0.35,
        });

        expect(result.success).toBe(true);
        const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
        expect(saved._props[0].roughness).toBe(0.35);
        expect(saved._props[0].mainTexture).toEqual({ __uuid__: 'old-tex' });
        // The bug: the old implementation wrote the meta record instead.
        const messages = mockRequest.mock.calls.map((c: any[]) => c[1]);
        expect(messages).not.toContain('save-asset-meta');
    });

    it('clears a property by removing the key so the dangling reference is gone', async () => {
        const file = writeMaterial({ occlusionMap: { __uuid__: 'missing-uuid', __expectedType__: 'cc.Texture2D' } });
        routeMessages(standaloneMaterial(file));

        const result = await tool.execute('set_property', {
            url: MTL_URL, property: 'occlusionMap', value: null,
        });

        expect(result.success).toBe(true);
        expect(result.data.cleared).toBe(true);
        const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
        expect(saved._props[0]).not.toHaveProperty('occlusionMap');
    });

    it('writes into the technique the material actually uses', async () => {
        const file = writeMaterial({ albedo: 1 }, 2);
        routeMessages(standaloneMaterial(file));

        const result = await tool.execute('set_property', { url: MTL_URL, property: 'albedo', value: 7 });

        expect(result.success).toBe(true);
        expect(result.data.techniqueIndex).toBe(2);
        const saved = JSON.parse(fs.readFileSync(file, 'utf-8'));
        expect(saved._props[2].albedo).toBe(7);
        expect(saved._props[0]).toEqual({});
    });

    it('reports failure when the write did not persist after reimport', async () => {
        const file = writeMaterial({ occlusionMap: { __uuid__: 'missing-uuid' } });
        const original = fs.readFileSync(file, 'utf-8');
        routeMessages({
            'query-asset-info': () => ({ name: 'Water.mtl', url: MTL_URL, file, uuid: 'mat-uuid', importer: 'material', type: 'cc.Material' }),
            'save-asset': () => ({}),                                       // accepted but not written
            'reimport-asset': () => { fs.writeFileSync(file, original, 'utf-8'); return true; }, // importer reverts it
        });

        const result = await tool.execute('set_property', { url: MTL_URL, property: 'occlusionMap', value: null });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/still present in _props/i);
    });

    it('refuses a material embedded in an imported model instead of claiming success', async () => {
        const fbx = path.join(os.tmpdir(), `t1k-model-${process.pid}-${Math.random().toString(36).slice(2)}.fbx`);
        fs.writeFileSync(fbx, 'binary-ish', 'utf-8');
        tmpFiles.push(fbx);
        routeMessages({
            'query-asset-info': () => ({
                name: 'Water1.material', url: 'db://assets/game-assets/3D/BaseMap.fbx/Water1.material',
                file: fbx, uuid: 'sub-mat-uuid', importer: 'fbx', type: 'cc.Material',
            }),
        });

        const result = await tool.execute('set_property', {
            url: 'db://assets/game-assets/3D/BaseMap.fbx/Water1.material',
            property: 'occlusionMap', value: null,
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not a standalone \.mtl asset/i);
        const messages = mockRequest.mock.calls.map((c: any[]) => c[1]);
        expect(messages).not.toContain('save-asset');
        expect(messages).not.toContain('save-asset-meta');
    });

    it('refuses an asset the db does not know', async () => {
        routeMessages({ 'query-asset-info': () => null });

        const result = await tool.execute('set_property', { url: MTL_URL, property: 'albedo', value: 1 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found in the asset db/i);
    });

    it('refuses a .mtl whose contents are not a cc.Material', async () => {
        const file = path.join(os.tmpdir(), `t1k-notmat-${process.pid}-${Math.random().toString(36).slice(2)}.mtl`);
        fs.writeFileSync(file, JSON.stringify({ __type__: 'cc.EffectAsset' }), 'utf-8');
        tmpFiles.push(file);
        routeMessages(standaloneMaterial(file));

        const result = await tool.execute('set_property', { url: MTL_URL, property: 'albedo', value: 1 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not a cc\.Material asset/i);
    });
});
