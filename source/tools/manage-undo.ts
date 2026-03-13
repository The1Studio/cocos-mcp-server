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
        try {
            const undoId: string = await Editor.Message.request('scene', 'begin-recording', nodeUuid) as string;
            return successResult({ undoId }, 'Undo recording started');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async endRecording(undoId: string): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('scene', 'end-recording', undoId);
            return successResult(null, 'Undo recording ended');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async cancelRecording(undoId: string): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('scene', 'cancel-recording', undoId);
            return successResult(null, 'Undo recording cancelled');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async undo(): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('scene', 'undo');
            return successResult(null, 'Undo performed');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }

    private async redo(): Promise<ActionToolResult> {
        try {
            await Editor.Message.request('scene', 'redo');
            return successResult(null, 'Redo performed');
        } catch (err: any) {
            return errorResult(err.message || String(err));
        }
    }
}
