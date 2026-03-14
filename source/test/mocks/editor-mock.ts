import * as os from 'os';

/**
 * Global Editor mock for Jest tests.
 * Simulates the Cocos Creator Editor API that is only available inside the editor process.
 * Loaded via jest.config.js `setupFiles` before each test suite.
 */

const mockEditorObject = {
    Message: {
        request: jest.fn().mockResolvedValue({}),
        send: jest.fn(),
        addBroadcastListener: jest.fn(),
        removeBroadcastListener: jest.fn(),
    },
    Project: {
        path: os.tmpdir(),
        name: 'test-project',
        uuid: 'mock-project-uuid-1234',
    },
    Panel: {
        open: jest.fn(),
        close: jest.fn(),
    },
    Dialog: {
        warn: jest.fn().mockResolvedValue(0),
        error: jest.fn().mockResolvedValue(0),
        info: jest.fn().mockResolvedValue(0),
    },
    versions: {
        editor: '3.8.6',
        cocos: '3.8.6',
    },
};

// Attach to global so source files that reference `Editor` directly can access it
(global as any).Editor = mockEditorObject;

export { mockEditorObject };
