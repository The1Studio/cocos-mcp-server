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
exports.mockEditorObject = void 0;
const os = __importStar(require("os"));
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
exports.mockEditorObject = mockEditorObject;
// Attach to global so source files that reference `Editor` directly can access it
global.Editor = mockEditorObject;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLW1vY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvdGVzdC9tb2Nrcy9lZGl0b3ItbW9jay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx1Q0FBeUI7QUFFekI7Ozs7R0FJRztBQUVILE1BQU0sZ0JBQWdCLEdBQUc7SUFDckIsT0FBTyxFQUFFO1FBQ0wsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUM7UUFDeEMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDZixvQkFBb0IsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFO1FBQy9CLHVCQUF1QixFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7S0FDckM7SUFDRCxPQUFPLEVBQUU7UUFDTCxJQUFJLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRTtRQUNqQixJQUFJLEVBQUUsY0FBYztRQUNwQixJQUFJLEVBQUUsd0JBQXdCO0tBQ2pDO0lBQ0QsS0FBSyxFQUFFO1FBQ0gsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7UUFDZixLQUFLLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtLQUNuQjtJQUNELE1BQU0sRUFBRTtRQUNKLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO0tBQ3ZDO0lBQ0QsUUFBUSxFQUFFO1FBQ04sTUFBTSxFQUFFLE9BQU87UUFDZixLQUFLLEVBQUUsT0FBTztLQUNqQjtDQUNKLENBQUM7QUFLTyw0Q0FBZ0I7QUFIekIsa0ZBQWtGO0FBQ2pGLE1BQWMsQ0FBQyxNQUFNLEdBQUcsZ0JBQWdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5cbi8qKlxuICogR2xvYmFsIEVkaXRvciBtb2NrIGZvciBKZXN0IHRlc3RzLlxuICogU2ltdWxhdGVzIHRoZSBDb2NvcyBDcmVhdG9yIEVkaXRvciBBUEkgdGhhdCBpcyBvbmx5IGF2YWlsYWJsZSBpbnNpZGUgdGhlIGVkaXRvciBwcm9jZXNzLlxuICogTG9hZGVkIHZpYSBqZXN0LmNvbmZpZy5qcyBgc2V0dXBGaWxlc2AgYmVmb3JlIGVhY2ggdGVzdCBzdWl0ZS5cbiAqL1xuXG5jb25zdCBtb2NrRWRpdG9yT2JqZWN0ID0ge1xuICAgIE1lc3NhZ2U6IHtcbiAgICAgICAgcmVxdWVzdDogamVzdC5mbigpLm1vY2tSZXNvbHZlZFZhbHVlKHt9KSxcbiAgICAgICAgc2VuZDogamVzdC5mbigpLFxuICAgICAgICBhZGRCcm9hZGNhc3RMaXN0ZW5lcjogamVzdC5mbigpLFxuICAgICAgICByZW1vdmVCcm9hZGNhc3RMaXN0ZW5lcjogamVzdC5mbigpLFxuICAgIH0sXG4gICAgUHJvamVjdDoge1xuICAgICAgICBwYXRoOiBvcy50bXBkaXIoKSxcbiAgICAgICAgbmFtZTogJ3Rlc3QtcHJvamVjdCcsXG4gICAgICAgIHV1aWQ6ICdtb2NrLXByb2plY3QtdXVpZC0xMjM0JyxcbiAgICB9LFxuICAgIFBhbmVsOiB7XG4gICAgICAgIG9wZW46IGplc3QuZm4oKSxcbiAgICAgICAgY2xvc2U6IGplc3QuZm4oKSxcbiAgICB9LFxuICAgIERpYWxvZzoge1xuICAgICAgICB3YXJuOiBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUoMCksXG4gICAgICAgIGVycm9yOiBqZXN0LmZuKCkubW9ja1Jlc29sdmVkVmFsdWUoMCksXG4gICAgICAgIGluZm86IGplc3QuZm4oKS5tb2NrUmVzb2x2ZWRWYWx1ZSgwKSxcbiAgICB9LFxuICAgIHZlcnNpb25zOiB7XG4gICAgICAgIGVkaXRvcjogJzMuOC42JyxcbiAgICAgICAgY29jb3M6ICczLjguNicsXG4gICAgfSxcbn07XG5cbi8vIEF0dGFjaCB0byBnbG9iYWwgc28gc291cmNlIGZpbGVzIHRoYXQgcmVmZXJlbmNlIGBFZGl0b3JgIGRpcmVjdGx5IGNhbiBhY2Nlc3MgaXRcbihnbG9iYWwgYXMgYW55KS5FZGl0b3IgPSBtb2NrRWRpdG9yT2JqZWN0O1xuXG5leHBvcnQgeyBtb2NrRWRpdG9yT2JqZWN0IH07XG4iXX0=