import { BaseActionTool } from './base-action-tool';
import { ActionToolResult, successResult, errorResult } from '../types';

export class ManageUndo extends BaseActionTool {
    readonly name = 'manage_undo';
    readonly description = 'Undo/redo recording and execution. Actions: begin_recording, end_recording, cancel_recording, undo, redo. Call begin_recording before multi-step modifications, end_recording after, to group them as one undo entry.';
    readonly actions = [
        'begin_recording',
        'end_recording',
        'cancel_recording',
        'undo',
        'redo',
    ];
    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: this.actions,
                description: 'Operation to perform'
            },
            nodeUuid: { type: 'string', description: 'Node UUID to record (begin_recording)' },
            undoId: { type: 'string', description: 'Undo recording ID from begin_recording (end_recording, cancel_recording)' }
        },
        required: ['action']
    };

    protected actionHandlers: Record<string, (args: Record<string, any>) => Promise<ActionToolResult>> = {
        begin_recording: (args) => this.beginRecording(args.nodeUuid),
        end_recording: (args) => this.endRecording(args.undoId),
        cancel_recording: (args) => this.cancelRecording(args.undoId),
        undo: () => this.undo(),
        redo: () => this.redo(),
    };

    private async beginRecording(nodeUuid: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'begin-recording', nodeUuid).then((undoId: string) => {
                resolve(successResult({ undoId }, 'Undo recording started'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async endRecording(undoId: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'end-recording', undoId).then(() => {
                resolve(successResult(null, 'Undo recording ended'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async cancelRecording(undoId: string): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'cancel-recording', undoId).then(() => {
                resolve(successResult(null, 'Undo recording cancelled'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async undo(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'undo').then(() => {
                resolve(successResult(null, 'Undo performed'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }

    private async redo(): Promise<ActionToolResult> {
        return new Promise((resolve) => {
            Editor.Message.request('scene', 'redo').then(() => {
                resolve(successResult(null, 'Redo performed'));
            }).catch((err: Error) => {
                resolve(errorResult(err.message));
            });
        });
    }
}
