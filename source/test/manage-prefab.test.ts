import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManagePrefab } from '../tools/manage-prefab';

describe('ManagePrefab', () => {
    let tool: ManagePrefab;

    beforeEach(() => {
        tool = new ManagePrefab();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_prefab');
        });

        it('lists validate as an action', () => {
            expect(tool.actions).toContain('validate');
        });
    });

    describe('validate action (#7 — invalid asset-db "read-asset" message)', () => {
        it('returns error when uuid is missing', async () => {
            const result = await tool.execute('validate', {});
            expect(result.success).toBe(false);
        });

        it('resolves the db url to a file path and reads it — never calls read-asset', async () => {
            const tmpFile = path.join(os.tmpdir(), `t1k-prefab-${process.pid}-${Date.now()}.prefab`);
            fs.writeFileSync(
                tmpFile,
                JSON.stringify([{ __type__: 'cc.Prefab' }, { __type__: 'cc.Node', _name: 'Root' }]),
                'utf-8',
            );
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ url: 'db://assets/ScoreUI.prefab' }) // query-asset-meta
                .mockResolvedValueOnce(tmpFile); // query-path

            const result = await tool.execute('validate', { uuid: 'da1db047-660d-407c-9aa3-cab9b4d1141b' });

            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('isValid');
            // The bug: the old code called a nonexistent 'read-asset' message.
            expect(mockRequest).toHaveBeenCalledWith('asset-db', 'query-path', 'db://assets/ScoreUI.prefab');
            const calledMessages = mockRequest.mock.calls.map((c: any[]) => c[1]);
            expect(calledMessages).not.toContain('read-asset');

            fs.unlinkSync(tmpFile);
        });

        it('errors clearly when the file path cannot be resolved on disk', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ url: 'db://assets/ScoreUI.prefab' }) // query-asset-meta
                .mockResolvedValueOnce(null); // query-path returns nothing

            const result = await tool.execute('validate', { uuid: 'some-uuid' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/could not resolve prefab file path/i);
        });

        it('reports a parse error on malformed prefab JSON', async () => {
            const tmpFile = path.join(os.tmpdir(), `t1k-prefab-bad-${process.pid}-${Date.now()}.prefab`);
            fs.writeFileSync(tmpFile, 'not-json{', 'utf-8');
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest
                .mockResolvedValueOnce({ url: 'db://assets/Bad.prefab' })
                .mockResolvedValueOnce(tmpFile);

            const result = await tool.execute('validate', { uuid: 'bad-uuid' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/cannot parse json/i);

            fs.unlinkSync(tmpFile);
        });
    });
});
