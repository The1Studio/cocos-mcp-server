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

    it('get_console_logs returns empty logs on fresh instance', async () => {
        const result = await tool.execute('get_console_logs', { limit: 10 });
        expect(result.success).toBe(true);
        expect(result.data.logs).toEqual([]);
        expect(result.data.total).toBe(0);
    });

    it('execute_script rejects dangerous script via action handler', async () => {
        const result = await tool.execute('execute_script', { script: 'process.exit(1)' });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/disallowed/i);
    });

    it('execute_script calls Editor.Message.request for valid script', async () => {
        const mockRequest = (global as any).Editor.Message.request as jest.Mock;
        mockRequest.mockResolvedValueOnce({ result: 42 });

        const result = await tool.execute('execute_script', { script: 'return 42;' });
        expect(result.success).toBe(true);
        expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.any(Object));
    });
});
