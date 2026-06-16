import { attachScriptToNode } from '../tools/manage-component-script-attach';
import { successResult } from '../types';

const NODE = 'node-uuid-1';
const mockRequest = (global as any).Editor.Message.request as jest.Mock;

beforeEach(() => {
    mockRequest.mockReset();
    mockRequest.mockResolvedValue({});
});

/** Build a getComponents callback that returns a fixed list, then a second list after attach. */
function makeGetComponents(before: any[], after: any[]) {
    let calls = 0;
    return jest.fn(async () => {
        const components = calls++ === 0 ? before : after;
        return successResult({ components });
    });
}

describe('attachScriptToNode', () => {
    it('validates required args', async () => {
        const get = makeGetComponents([], []);
        expect((await attachScriptToNode('', 'db://x/Foo.ts', get)).success).toBe(false);
        expect((await attachScriptToNode(NODE, '', get)).success).toBe(false);
    });

    it('reports an already-attached script (matched by name) without adding', async () => {
        const get = makeGetComponents([{ type: 'Foo' }], [{ type: 'Foo' }]);
        const res = await attachScriptToNode(NODE, 'db://assets/Foo.ts', get);
        expect(res.success).toBe(true);
        expect(res.data?.existing).toBe(true);
        expect(mockRequest).not.toHaveBeenCalledWith('scene', 'create-component', expect.anything());
    });

    it('succeeds when the reported type equals the script class name', async () => {
        const get = makeGetComponents([{ type: 'cc.Sprite' }], [{ type: 'cc.Sprite' }, { type: 'Foo' }]);
        const res = await attachScriptToNode(NODE, 'db://assets/Foo.ts', get);
        expect(res.success).toBe(true);
        expect(res.data?.existing).toBe(false);
    });

    // Regression: theonekit-cocos#61 — a user script's reported `type` is its cid
    // (compressed UUID), not the class name, so `type === scriptName` never matched
    // and attach_script returned success:false even though the component WAS added.
    it('succeeds via delta when the new component reports a cid instead of the class name', async () => {
        const get = makeGetComponents(
            [{ type: 'cc.UITransform' }],
            [{ type: 'cc.UITransform' }, { type: 'a1b2c3d4xYZ==' }] // cid, not "Match3Element"
        );
        const res = await attachScriptToNode(NODE, 'db://assets/Match3Element.ts', get);
        expect(res.success).toBe(true);
        expect(res.data?.existing).toBe(false);
        expect(res.data?.componentType).toBe('a1b2c3d4xYZ==');
        expect(res.message).toContain('cid');
    });

    it('fails only when no new component appears after the add', async () => {
        const get = makeGetComponents([{ type: 'cc.UITransform' }], [{ type: 'cc.UITransform' }]);
        const res = await attachScriptToNode(NODE, 'db://assets/Missing.ts', get);
        expect(res.success).toBe(false);
        expect(res.error).toContain('was not found on node after addition');
    });
});
