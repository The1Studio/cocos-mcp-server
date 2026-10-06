import { ManageProject } from '../tools/manage-project';

describe('ManageProject', () => {
    let tool: ManageProject;

    beforeEach(() => {
        tool = new ManageProject();
        jest.clearAllMocks();
    });

    // Metadata tests
    it('has correct name', () => {
        expect(tool.name).toBe('manage_project');
    });

    it('has all actions defined', () => {
        expect(tool.actions).toEqual([
            'run', 'build', 'get_info', 'get_settings', 'set_settings', 'get_build_settings',
            'open_build_panel', 'check_builder_status'
        ]);
    });

    // Unknown action test
    it('returns error for unknown action', async () => {
        const result = await tool.execute('nonexistent', {});
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unknown action/i);
    });

    // build — honesty fix (issue #83)
    describe('build', () => {
        it('does not report success — it only opens the build panel, no build ever runs', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('build', { platform: 'web-mobile', debug: false });

            expect(result.success).toBe(false);
            expect((result.data as any).started).toBe(false);
        });

        it('calls builder open but never sends a build config', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            await tool.execute('build', { platform: 'android', debug: true });

            expect(mockRequest).toHaveBeenCalledWith('builder', 'open');
            expect(mockRequest).not.toHaveBeenCalledWith('builder', 'task-add', expect.anything());
        });

        it('reports the requested platform in the panel-opened data, not as a built platform', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('build', { platform: 'ios', debug: true });

            expect((result.data as any).platform).toBe('ios');
            expect((result.data as any).status).toBe('panel-opened');
        });

        it('still reports failure honestly when the editor request itself throws', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Editor unavailable'));

            const result = await tool.execute('build', { platform: 'web-mobile' });

            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Editor unavailable/);
        });
    });

    // check_builder_status — honesty fix (issue #83)
    describe('check_builder_status', () => {
        it('does not read as build-task status — no task/output-path fields are implied', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(true);

            const result = await tool.execute('check_builder_status', {});

            expect(result.success).toBe(true);
            expect((result.data as any).taskStatus).toBe('not-tracked');
            expect((result.data as any)).not.toHaveProperty('outputPath');
        });

        it('reports worker readiness under an unambiguous field name', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(true);

            const result = await tool.execute('check_builder_status', {});

            expect((result.data as any).workerReady).toBe(true);
            expect((result.data as any)).not.toHaveProperty('ready');
        });

        it('message states that no build task state is observable', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce(false);

            const result = await tool.execute('check_builder_status', {});

            expect(result.message).toMatch(/no build task state|not observable/i);
        });
    });
    // set_settings — project:set-config write path (issue #134)
    describe('set_settings', () => {
        const request = () => (global as any).Editor.Message.request as jest.Mock;

        it('writes through project:set-config with (config, path, value)', async () => {
            request().mockResolvedValueOnce(true);
            const result = await tool.execute('set_settings', { type: 'engine', path: 'renderPipeline', value: 'custom-pipeline' });
            expect(result.success).toBe(true);
            expect(request()).toHaveBeenCalledWith('project', 'set-config', 'engine', 'renderPipeline', 'custom-pipeline');
        });

        it('passes object values and nested dotted paths through untouched', async () => {
            request().mockResolvedValueOnce(true);
            await tool.execute('set_settings', { type: 'engine', path: 'customPipeline', value: { postProcess: true } });
            expect(request()).toHaveBeenCalledWith('project', 'set-config', 'engine', 'customPipeline', { postProcess: true });
        });

        it('treats a false reply from the editor as a failure', async () => {
            request().mockResolvedValueOnce(false);
            const result = await tool.execute('set_settings', { type: 'engine', path: 'renderPipeline', value: 'x' });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/returned false/);
        });

        it('rejects a missing path, a missing value and an unknown category without calling the editor', async () => {
            request().mockReset();
            expect((await tool.execute('set_settings', { type: 'engine', value: 1 })).success).toBe(false);
            expect((await tool.execute('set_settings', { type: 'engine', path: 'a' })).success).toBe(false);
            expect((await tool.execute('set_settings', { type: 'bogus', path: 'a', value: 1 })).success).toBe(false);
            expect(request()).not.toHaveBeenCalled();
        });

        it('makes engine.json readable via get_settings', async () => {
            request().mockResolvedValueOnce({ renderPipeline: 'custom-pipeline' });
            await tool.execute('get_settings', { type: 'engine' });
            expect(request()).toHaveBeenCalledWith('project', 'query-config', 'engine');
        });
    });
});
