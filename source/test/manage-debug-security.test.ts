import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ManageDebug } from '../tools/manage-debug';

/** Access private method via cast */
function validateScript(tool: ManageDebug, script: string): string | null {
    return (tool as any).validateScript(script);
}

describe('ManageDebug.validateScript security', () => {
    let tool: ManageDebug;

    beforeEach(() => {
        tool = new ManageDebug();
    });

    it('accepts a normal script', () => {
        expect(validateScript(tool, 'return cc.director.getScene().name;')).toBeNull();
    });

    it('blocks require("child_process") with double quotes', () => {
        const err = validateScript(tool, 'const cp = require("child_process");');
        expect(err).toMatch(/disallowed/i);
    });

    it("blocks require('child_process') with single quotes", () => {
        const err = validateScript(tool, "const cp = require('child_process');");
        expect(err).toMatch(/disallowed/i);
    });

    it('blocks process.exit calls', () => {
        const err = validateScript(tool, 'process.exit(0);');
        expect(err).toMatch(/disallowed/i);
    });

    it('blocks eval(', () => {
        const err = validateScript(tool, 'eval("alert(1)")');
        expect(err).toMatch(/disallowed/i);
    });

    it('blocks Function( constructor', () => {
        const err = validateScript(tool, 'new Function("return 1")()');
        expect(err).toMatch(/disallowed/i);
    });

    it('rejects script exceeding 10KB', () => {
        const big = 'x'.repeat(10241);
        const err = validateScript(tool, big);
        expect(err).toMatch(/exceeds/i);
    });

    it('accepts script at exactly 10240 chars', () => {
        const ok = 'x'.repeat(10240);
        expect(validateScript(tool, ok)).toBeNull();
    });

    it('rejects empty script', () => {
        expect(validateScript(tool, '')).toBeTruthy();
    });

    it('rejects null script', () => {
        expect(validateScript(tool, null as any)).toBeTruthy();
    });
});

describe('ManageDebug.execute action routing', () => {
    let tool: ManageDebug;

    beforeEach(() => {
        tool = new ManageDebug();
    });

    it('returns error result for missing action', async () => {
        const result = await tool.execute('', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    it('returns error result for unknown action', async () => {
        const result = await tool.execute('nonexistent_action', {});
        expect(result.success).toBe(false);
    });

    it('errors clearly when no project log file exists, instead of a fake-empty success', async () => {
        const result = await tool.execute('get_console_logs', { limit: 10 });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/project log file not found/i);
    });

    describe('get_console_logs reads temp/logs/project.log (#51)', () => {
        const logDir = path.join(os.tmpdir(), 'temp', 'logs');
        const logFile = path.join(logDir, 'project.log');

        beforeEach(() => {
            fs.mkdirSync(logDir, { recursive: true });
        });

        afterEach(() => {
            try { fs.unlinkSync(logFile); } catch { /* already gone */ }
        });

        it('returns real log lines classified by type — the buffer nothing ever wrote to (#51) reported total:0 here', async () => {
            fs.writeFileSync(logFile, [
                '[Scene] Missing class: RollicTopBannerView',
                'error: Script "RollicTopBannerView" attached to "RollicTopBanner" is missing or invalid',
                'warn: deprecated API used',
                'normal log line',
            ].join('\n'), 'utf-8');

            const result = await tool.execute('get_console_logs', { limit: 10 });

            expect(result.success).toBe(true);
            expect(result.data.total).toBe(4);
            expect(result.data.logs.some((l: any) => l.type === 'error')).toBe(true);
            expect(result.data.logs.some((l: any) => l.type === 'warn')).toBe(true);
        });

        it('filters by type', async () => {
            fs.writeFileSync(logFile, ['error: boom', 'warn: careful', 'plain line'].join('\n'), 'utf-8');

            const result = await tool.execute('get_console_logs', { limit: 10, filter: 'error' });

            expect(result.success).toBe(true);
            expect(result.data.total).toBe(1);
            expect(result.data.logs[0].type).toBe('error');
        });

        it('respects limit, keeping the most recent lines', async () => {
            fs.writeFileSync(logFile, ['line 1', 'line 2', 'line 3'].join('\n'), 'utf-8');

            const result = await tool.execute('get_console_logs', { limit: 2 });

            expect(result.success).toBe(true);
            expect(result.data.total).toBe(3);
            expect(result.data.returned).toBe(2);
            expect(result.data.logs.map((l: any) => l.message)).toEqual(['line 2', 'line 3']);
        });
    });

    it('execute_script rejects dangerous script via action handler', async () => {
        const result = await tool.execute('execute_script', { script: 'process.exit(1)' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/disallowed/i);
    });

    it('execute_script calls Editor.Message.request for valid script', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: true, data: { result: 42 } });

        const result = await tool.execute('execute_script', { script: 'return 42;' });
        expect(result.success).toBe(true);
        expect(result.data.result).toBe(42);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', {
            name: 'cocos-mcp-server',
            method: 'eval',
            args: ['return 42;']
        });
    });

    it('execute_script surfaces a scene-side eval failure as an error result', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ success: false, error: 'ReferenceError: foo is not defined' });

        const result = await tool.execute('execute_script', { script: 'return foo;' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/foo is not defined/);
    });
});
