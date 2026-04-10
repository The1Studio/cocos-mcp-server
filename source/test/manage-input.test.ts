import { ManageInput } from '../tools/manage-input';

describe('ManageInput', () => {
    let tool: ManageInput;

    beforeEach(() => {
        tool = new ManageInput();
        jest.clearAllMocks();
    });

    describe('metadata', () => {
        it('has correct name', () => {
            expect(tool.name).toBe('manage_input');
        });

        it('has actions array', () => {
            expect(tool.actions).toEqual(['get_config', 'set_touch_config', 'set_acceleration', 'get_event_types']);
        });

        it('has valid inputSchema', () => {
            expect(tool.inputSchema).toHaveProperty('properties.action');
            expect(tool.inputSchema.properties.action).toHaveProperty('enum');
        });
    });

    describe('action routing', () => {
        it('returns error for unknown action', async () => {
            const result = await tool.execute('unknown_input_action', {});
            expect(result.success).toBe(false);
        });
    });

    describe('get_config action', () => {
        it('calls Editor.Message.request to get input config', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                multiTouch: true,
                accelerometer: false,
                accelerometerInterval: 0.016667
            });

            const result = await tool.execute('get_config', {});
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'getInputConfig'
            }));
        });

        it('returns input configuration object', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({
                multiTouch: true,
                accelerometer: true,
                accelerometerInterval: 0.016667
            });

            const result = await tool.execute('get_config', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('multiTouch');
            expect(result.data).toHaveProperty('accelerometer');
        });
    });

    describe('set_touch_config action', () => {
        it('returns error when enabled is missing', async () => {
            const result = await tool.execute('set_touch_config', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/enabled is required/i);
        });

        it('enables multi-touch when enabled=true', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_touch_config', { enabled: true });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setTouchConfig',
                args: [true]
            }));
        });

        it('disables multi-touch when enabled=false', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_touch_config', { enabled: false });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [false]
            }));
        });

        it('returns success message indicating touch state', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_touch_config', { enabled: true });
            expect(result.success).toBe(true);
            expect(result.message).toMatch(/enabled/i);
        });

        it('returns disabled message when enabled=false', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_touch_config', { enabled: false });
            expect(result.message).toMatch(/disabled/i);
        });
    });

    describe('set_acceleration action', () => {
        it('returns error when enabled is missing', async () => {
            const result = await tool.execute('set_acceleration', { interval: 0.016667 });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/enabled is required/i);
        });

        it('enables accelerometer when enabled=true', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_acceleration', { enabled: true });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                method: 'setAccelerationConfig',
                args: [true, undefined]
            }));
        });

        it('disables accelerometer when enabled=false', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_acceleration', { enabled: false });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [false, undefined]
            }));
        });

        it('sets accelerometer with custom interval', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_acceleration', {
                enabled: true,
                interval: 0.033333
            });
            expect(result.success).toBe(true);
            expect(mockRequest).toHaveBeenCalledWith('scene', 'execute-scene-script', expect.objectContaining({
                args: [true, 0.033333]
            }));
        });

        it('returns success message indicating accelerometer state', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockResolvedValueOnce({});

            const result = await tool.execute('set_acceleration', { enabled: true });
            expect(result.success).toBe(true);
            expect(result.message).toMatch(/accelerometer/i);
        });
    });

    describe('get_event_types action', () => {
        it('returns event types array', async () => {
            const result = await tool.execute('get_event_types', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('eventTypes');
            expect(Array.isArray(result.data.eventTypes)).toBe(true);
        });

        it('includes touch event types', async () => {
            const result = await tool.execute('get_event_types', {});
            expect(result.success).toBe(true);
            const eventNames = (result.data.eventTypes as any[]).map(e => e.name);
            expect(eventNames).toContain('TOUCH_START');
            expect(eventNames).toContain('TOUCH_END');
            expect(eventNames).toContain('TOUCH_MOVE');
            expect(eventNames).toContain('TOUCH_CANCEL');
        });

        it('includes mouse event types', async () => {
            const result = await tool.execute('get_event_types', {});
            const eventNames = (result.data.eventTypes as any[]).map(e => e.name);
            expect(eventNames).toContain('MOUSE_DOWN');
            expect(eventNames).toContain('MOUSE_UP');
            expect(eventNames).toContain('MOUSE_MOVE');
            expect(eventNames).toContain('MOUSE_WHEEL');
        });

        it('includes keyboard event types', async () => {
            const result = await tool.execute('get_event_types', {});
            const eventNames = (result.data.eventTypes as any[]).map(e => e.name);
            expect(eventNames).toContain('KEY_DOWN');
            expect(eventNames).toContain('KEY_UP');
            expect(eventNames).toContain('KEY_PRESSING');
        });

        it('includes accelerometer and gamepad event types', async () => {
            const result = await tool.execute('get_event_types', {});
            const eventNames = (result.data.eventTypes as any[]).map(e => e.name);
            expect(eventNames).toContain('DEVICEMOTION');
            expect(eventNames).toContain('GAMEPAD_CHANGE');
        });

        it('includes XR event types', async () => {
            const result = await tool.execute('get_event_types', {});
            const eventNames = (result.data.eventTypes as any[]).map(e => e.name);
            expect(eventNames).toContain('HANDLE_INPUT');
            expect(eventNames).toContain('HMD_POSE_INPUT');
        });

        it('returns count of event types', async () => {
            const result = await tool.execute('get_event_types', {});
            expect(result.success).toBe(true);
            expect(result.data).toHaveProperty('count');
            expect(typeof result.data.count).toBe('number');
            expect(result.data.count).toBeGreaterThan(0);
        });

        it('each event type has name, value, and description', async () => {
            const result = await tool.execute('get_event_types', {});
            const eventTypes = result.data.eventTypes as any[];
            eventTypes.forEach(event => {
                expect(event).toHaveProperty('name');
                expect(event).toHaveProperty('value');
                expect(event).toHaveProperty('description');
                expect(typeof event.name).toBe('string');
                expect(typeof event.value).toBe('string');
                expect(typeof event.description).toBe('string');
            });
        });

        it('returns static event types without scene request', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;

            const result = await tool.execute('get_event_types', {});
            expect(result.success).toBe(true);
            expect(mockRequest).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('handles scene request errors gracefully', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Scene not initialized'));

            const result = await tool.execute('get_config', {});
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Scene not initialized/);
        });

        it('handles acceleration config errors', async () => {
            const mockRequest = (global as any).Editor.Message.request as jest.Mock;
            mockRequest.mockRejectedValueOnce(new Error('Accelerometer not supported'));

            const result = await tool.execute('set_acceleration', { enabled: true });
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/Accelerometer/);
        });
    });
});
