"use strict";
/* eslint-disable vue/one-component-per-file */
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const vue_1 = require("vue");
const panelDataMap = new WeakMap();
module.exports = Editor.Panel.define({
    listeners: {
        show() {
            console.log('[MCP Panel] Panel shown');
        },
        hide() {
            console.log('[MCP Panel] Panel hidden');
        },
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/default/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        app: '#app',
        panelTitle: '#panelTitle',
    },
    ready() {
        if (this.$.app) {
            const app = (0, vue_1.createApp)({});
            app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('ui-');
            // Create main app component
            app.component('McpServerApp', (0, vue_1.defineComponent)({
                setup() {
                    // Reactive data
                    const activeTab = (0, vue_1.ref)('server');
                    const serverRunning = (0, vue_1.ref)(false);
                    const serverStatus = (0, vue_1.ref)('Stopped');
                    const connectedClients = (0, vue_1.ref)(0);
                    const httpUrl = (0, vue_1.ref)('');
                    const isProcessing = (0, vue_1.ref)(false);
                    const settings = (0, vue_1.ref)({
                        port: 3000,
                        autoStart: false,
                        debugLog: false,
                        maxConnections: 10
                    });
                    const availableTools = (0, vue_1.ref)([]);
                    // Computed properties
                    const statusClass = (0, vue_1.computed)(() => ({
                        'status-running': serverRunning.value,
                        'status-stopped': !serverRunning.value
                    }));
                    const totalTools = (0, vue_1.computed)(() => availableTools.value.length);
                    const enabledTools = (0, vue_1.computed)(() => availableTools.value.filter(t => t.enabled).length);
                    const disabledTools = (0, vue_1.computed)(() => totalTools.value - enabledTools.value);
                    const settingsChanged = (0, vue_1.ref)(false);
                    // Methods
                    const switchTab = (tabName) => {
                        activeTab.value = tabName;
                        if (tabName === 'tools') {
                            loadToolManagerState();
                        }
                    };
                    const toggleServer = async () => {
                        try {
                            if (serverRunning.value) {
                                await Editor.Message.request('cocos-mcp-server', 'stop-server');
                            }
                            else {
                                // Use current panel settings when starting server
                                const currentSettings = {
                                    port: settings.value.port,
                                    autoStart: settings.value.autoStart,
                                    enableDebugLog: settings.value.debugLog,
                                    maxConnections: settings.value.maxConnections
                                };
                                await Editor.Message.request('cocos-mcp-server', 'update-settings', currentSettings);
                                await Editor.Message.request('cocos-mcp-server', 'start-server');
                            }
                            console.log('[Vue App] Server toggled');
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to toggle server:', error);
                        }
                    };
                    const saveSettings = async () => {
                        try {
                            // Create a plain object to avoid clone errors
                            const settingsData = {
                                port: settings.value.port,
                                autoStart: settings.value.autoStart,
                                debugLog: settings.value.debugLog,
                                maxConnections: settings.value.maxConnections
                            };
                            const result = await Editor.Message.request('cocos-mcp-server', 'update-settings', settingsData);
                            console.log('[Vue App] Save settings result:', result);
                            settingsChanged.value = false;
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to save settings:', error);
                        }
                    };
                    const copyUrl = async () => {
                        try {
                            await navigator.clipboard.writeText(httpUrl.value);
                            console.log('[Vue App] URL copied to clipboard');
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to copy URL:', error);
                        }
                    };
                    const loadToolManagerState = async () => {
                        try {
                            const result = await Editor.Message.request('cocos-mcp-server', 'getToolManagerState');
                            if (result && result.success) {
                                // Always load backend state to ensure data is up to date
                                availableTools.value = result.availableTools || [];
                                console.log('[Vue App] Loaded tools:', availableTools.value.length);
                            }
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to load tool manager state:', error);
                        }
                    };
                    const updateToolStatus = async (name, enabled) => {
                        try {
                            console.log('[Vue App] updateToolStatus called:', name, enabled);
                            // Update local state first
                            const toolIndex = availableTools.value.findIndex(t => t.name === name);
                            if (toolIndex !== -1) {
                                availableTools.value[toolIndex].enabled = enabled;
                                // Force reactive update
                                availableTools.value = [...availableTools.value];
                                console.log('[Vue App] Local state updated, tool enabled:', availableTools.value[toolIndex].enabled);
                            }
                            // Call backend update
                            const result = await Editor.Message.request('cocos-mcp-server', 'updateToolStatus', name, enabled);
                            if (!result || !result.success) {
                                // Rollback local state if backend update failed
                                if (toolIndex !== -1) {
                                    availableTools.value[toolIndex].enabled = !enabled;
                                    availableTools.value = [...availableTools.value];
                                }
                                console.error('[Vue App] Backend update failed, rolled back local state');
                            }
                            else {
                                console.log('[Vue App] Backend update successful');
                            }
                        }
                        catch (error) {
                            // Rollback local state on error
                            const toolIndex = availableTools.value.findIndex(t => t.name === name);
                            if (toolIndex !== -1) {
                                availableTools.value[toolIndex].enabled = !enabled;
                                availableTools.value = [...availableTools.value];
                            }
                            console.error('[Vue App] Failed to update tool status:', error);
                        }
                    };
                    const selectAllTools = async () => {
                        try {
                            availableTools.value.forEach(tool => tool.enabled = true);
                            await saveChanges();
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to select all tools:', error);
                        }
                    };
                    const deselectAllTools = async () => {
                        try {
                            availableTools.value.forEach(tool => tool.enabled = false);
                            await saveChanges();
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to deselect all tools:', error);
                        }
                    };
                    const saveChanges = async () => {
                        try {
                            // Create plain objects to avoid Vue3 reactive object clone errors
                            const updates = availableTools.value.map(tool => ({
                                name: String(tool.name),
                                enabled: Boolean(tool.enabled)
                            }));
                            console.log('[Vue App] Sending updates:', updates.length, 'tools');
                            const result = await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', updates);
                            if (result && result.success) {
                                console.log('[Vue App] Tool changes saved successfully');
                            }
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to save tool changes:', error);
                        }
                    };
                    // Watch for settings changes
                    (0, vue_1.watch)(settings, () => {
                        settingsChanged.value = true;
                    }, { deep: true });
                    // Load data on mount
                    (0, vue_1.onMounted)(async () => {
                        // Load tool manager state
                        await loadToolManagerState();
                        // Load settings from server status
                        try {
                            const serverStatus = await Editor.Message.request('cocos-mcp-server', 'get-server-status');
                            if (serverStatus && serverStatus.settings) {
                                settings.value = {
                                    port: serverStatus.settings.port || 3000,
                                    autoStart: serverStatus.settings.autoStart || false,
                                    debugLog: serverStatus.settings.enableDebugLog || false,
                                    maxConnections: serverStatus.settings.maxConnections || 10
                                };
                                console.log('[Vue App] Server settings loaded from status:', serverStatus.settings);
                            }
                            else if (serverStatus && serverStatus.port) {
                                // Backward compatibility — only port info available
                                settings.value.port = serverStatus.port;
                                console.log('[Vue App] Port loaded from server status:', serverStatus.port);
                            }
                        }
                        catch (error) {
                            console.error('[Vue App] Failed to get server status:', error);
                            console.log('[Vue App] Using default server settings');
                        }
                        // Periodically update server status — store ID for cleanup
                        const statusIntervalId = setInterval(async () => {
                            try {
                                const result = await Editor.Message.request('cocos-mcp-server', 'get-server-status');
                                if (result) {
                                    serverRunning.value = result.running;
                                    serverStatus.value = result.running ? 'Running' : 'Stopped';
                                    connectedClients.value = result.clients || 0;
                                    httpUrl.value = result.running ? `http://localhost:${result.port}` : '';
                                    isProcessing.value = false;
                                }
                            }
                            catch (error) {
                                console.error('[Vue App] Failed to get server status:', error);
                            }
                        }, 2000);
                        // Expose cleanup for panel close
                        window.__mcpStatusInterval = statusIntervalId;
                    });
                    return {
                        // Data
                        activeTab,
                        serverRunning,
                        serverStatus,
                        connectedClients,
                        httpUrl,
                        isProcessing,
                        settings,
                        availableTools,
                        settingsChanged,
                        // Computed
                        statusClass,
                        totalTools,
                        enabledTools,
                        disabledTools,
                        // Methods
                        switchTab,
                        toggleServer,
                        saveSettings,
                        copyUrl,
                        loadToolManagerState,
                        updateToolStatus,
                        selectAllTools,
                        deselectAllTools,
                        saveChanges
                    };
                },
                template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/vue/mcp-server-app.html'), 'utf-8'),
            }));
            app.mount(this.$.app);
            panelDataMap.set(this, app);
            console.log('[MCP Panel] Vue3 app mounted successfully');
        }
    },
    beforeClose() { },
    close() {
        // Clear the status polling interval to prevent memory leaks
        const intervalId = window.__mcpStatusInterval;
        if (intervalId != null) {
            clearInterval(intervalId);
            delete window.__mcpStatusInterval;
        }
        const app = panelDataMap.get(this);
        if (app) {
            app.unmount();
        }
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2RlZmF1bHQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLCtDQUErQzs7QUFFL0MsdUNBQXdDO0FBQ3hDLCtCQUE0QjtBQUM1Qiw2QkFBaUc7QUFFakcsTUFBTSxZQUFZLEdBQUcsSUFBSSxPQUFPLEVBQVksQ0FBQztBQTJCN0MsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUU7UUFDUCxJQUFJO1lBQ0EsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFDRCxJQUFJO1lBQ0EsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1FBQzVDLENBQUM7S0FDSjtJQUNELFFBQVEsRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLDZDQUE2QyxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQy9GLEtBQUssRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3hGLENBQUMsRUFBRTtRQUNDLEdBQUcsRUFBRSxNQUFNO1FBQ1gsVUFBVSxFQUFFLGFBQWE7S0FDNUI7SUFDRCxLQUFLO1FBQ0QsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ2IsTUFBTSxHQUFHLEdBQUcsSUFBQSxlQUFTLEVBQUMsRUFBRSxDQUFDLENBQUM7WUFDMUIsR0FBRyxDQUFDLE1BQU0sQ0FBQyxlQUFlLENBQUMsZUFBZSxHQUFHLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRTVFLDRCQUE0QjtZQUM1QixHQUFHLENBQUMsU0FBUyxDQUFD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d0JBQ2hCLFdBQVc7cUJBQ2QsQ0FBQztnQkFDTixDQUFDO2dCQUNELFFBQVEsRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLGtEQUFrRCxDQUFDLEVBQUUsT0FBTyxDQUFDO2FBQ3ZHLENBQUMsQ0FBQyxDQUFDO1lBRUosR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3RCLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBRTVCLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkNBQTJDLENBQUMsQ0FBQztRQUM3RCxDQUFDO0lBQ0wsQ0FBQztJQUNELFdBQVcsS0FBSyxDQUFDO0lBQ2pCLEtBQUs7UUFDRCw0REFBNEQ7UUFDNUQsTUFBTSxVQUFVLEdBQUksTUFBYyxDQUFDLG1CQUFtQixDQUFDO1FBQ3ZELElBQUksVUFBVSxJQUFJLElBQUksRUFBRSxDQUFDO1lBQ3JCLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMxQixPQUFRLE1BQWMsQ0FBQyxtQkFBbUIsQ0FBQztRQUMvQyxDQUFDO1FBQ0QsTUFBTSxHQUFHLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ04sR0FBRyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2xCLENBQUM7SUFDTCxDQUFDO0NBQ0osQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgdnVlL29uZS1jb21wb25lbnQtcGVyLWZpbGUgKi9cblxuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgY3JlYXRlQXBwLCBBcHAsIGRlZmluZUNvbXBvbmVudCwgcmVmLCBjb21wdXRlZCwgb25Nb3VudGVkLCB3YXRjaCwgbmV4dFRpY2sgfSBmcm9tICd2dWUnO1xuXG5jb25zdCBwYW5lbERhdGFNYXAgPSBuZXcgV2Vha01hcDxhbnksIEFwcD4oKTtcblxuLy8gVG9vbCBjb25maWd1cmF0aW9uIGludGVyZmFjZSAodjIgZmxhdCDigJQgbm8gY2F0ZWdvcnkpXG5pbnRlcmZhY2UgVG9vbENvbmZpZyB7XG4gICAgbmFtZTogc3RyaW5nO1xuICAgIGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgZGVzY3JpcHRpb246IHN0cmluZztcbn1cblxuLy8gQ29uZmlndXJhdGlvbiBpbnRlcmZhY2VcbmludGVyZmFjZSBDb25maWd1cmF0aW9uIHtcbiAgICBpZDogc3RyaW5nO1xuICAgIG5hbWU6IHN0cmluZztcbiAgICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICAgIHRvb2xzOiBUb29sQ29uZmlnW107XG4gICAgY3JlYXRlZEF0OiBzdHJpbmc7XG4gICAgdXBkYXRlZEF0OiBzdHJpbmc7XG59XG5cbi8vIFNlcnZlciBzZXR0aW5ncyBpbnRlcmZhY2VcbmludGVyZmFjZSBTZXJ2ZXJTZXR0aW5ncyB7XG4gICAgcG9ydDogbnVtYmVyO1xuICAgIGF1dG9TdGFydDogYm9vbGVhbjtcbiAgICBkZWJ1Z0xvZzogYm9vbGVhbjtcbiAgICBtYXhDb25uZWN0aW9uczogbnVtYmVyO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEVkaXRvci5QYW5lbC5kZWZpbmUoe1xuICAgIGxpc3RlbmVyczoge1xuICAgICAgICBzaG93KCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1AgUGFuZWxdIFBhbmVsIHNob3duJyk7XG4gICAgICAgIH0sXG4gICAgICAgIGhpZGUoKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUCBQYW5lbF0gUGFuZWwgaGlkZGVuJyk7XG4gICAgICAgIH0sXG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL2RlZmF1bHQvaW5kZXguaHRtbCcpLCAndXRmLTgnKSxcbiAgICBzdHlsZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3N0eWxlL2RlZmF1bHQvaW5kZXguY3NzJyksICd1dGYtOCcpLFxuICAgICQ6IHtcbiAgICAgICAgYXBwOiAnI2FwcCcsXG4gICAgICAgIHBhbmVsVGl0bGU6ICcjcGFuZWxUaXRsZScsXG4gICAgfSxcbiAgICByZWFkeSgpIHtcbiAgICAgICAgaWYgKHRoaXMuJC5hcHApIHtcbiAgICAgICAgICAgIGNvbnN0IGFwcCA9IGNyZWF0ZUFwcCh7fSk7XG4gICAgICAgICAgICBhcHAuY29uZmlnLmNvbXBpbGVyT3B0aW9ucy5pc0N1c3RvbUVsZW1lbnQgPSAodGFnKSA9PiB0YWcuc3RhcnRzV2l0aCgndWktJyk7XG5cbiAgICAgICAgICAgIC8vIENyZWF0ZSBtYWluIGFwcCBjb21wb25lbnRcbiAgICAgICAgICAgIGFwcC5jb21wb25lbnQoJ01jcFNlcnZlckFwcCcsIGRlZmluZUNvbXBvbmVudCh7XG4gICAgICAgICAgICAgICAgc2V0dXAoKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJlYWN0aXZlIGRhdGFcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYWN0aXZlVGFiID0gcmVmKCdzZXJ2ZXInKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyUnVubmluZyA9IHJlZihmYWxzZSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlcnZlclN0YXR1cyA9IHJlZignU3RvcHBlZCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb25uZWN0ZWRDbGllbnRzID0gcmVmKDApO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBodHRwVXJsID0gcmVmKCcnKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNQcm9jZXNzaW5nID0gcmVmKGZhbHNlKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5ncyA9IHJlZjxTZXJ2ZXJTZXR0aW5ncz4oe1xuICAgICAgICAgICAgICAgICAgICAgICAgcG9ydDogMzAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1dG9TdGFydDogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWJ1Z0xvZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICBtYXhDb25uZWN0aW9uczogMTBcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXZhaWxhYmxlVG9vbHMgPSByZWY8VG9vbENvbmZpZ1tdPihbXSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gQ29tcHV0ZWQgcHJvcGVydGllc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdGF0dXNDbGFzcyA9IGNvbXB1dGVkKCgpID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAnc3RhdHVzLXJ1bm5pbmcnOiBzZXJ2ZXJSdW5uaW5nLnZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3N0YXR1cy1zdG9wcGVkJzogIXNlcnZlclJ1bm5pbmcudmFsdWVcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvdGFsVG9vbHMgPSBjb21wdXRlZCgoKSA9PiBhdmFpbGFibGVUb29scy52YWx1ZS5sZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmFibGVkVG9vbHMgPSBjb21wdXRlZCgoKSA9PiBhdmFpbGFibGVUb29scy52YWx1ZS5maWx0ZXIodCA9PiB0LmVuYWJsZWQpLmxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc2FibGVkVG9vbHMgPSBjb21wdXRlZCgoKSA9PiB0b3RhbFRvb2xzLnZhbHVlIC0gZW5hYmxlZFRvb2xzLnZhbHVlKTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXR0aW5nc0NoYW5nZWQgPSByZWYoZmFsc2UpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIE1ldGhvZHNcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3dpdGNoVGFiID0gKHRhYk5hbWU6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVGFiLnZhbHVlID0gdGFiTmFtZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0YWJOYW1lID09PSAndG9vbHMnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9hZFRvb2xNYW5hZ2VyU3RhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b2dnbGVTZXJ2ZXIgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJSdW5uaW5nLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnc3RvcC1zZXJ2ZXInKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVc2UgY3VycmVudCBwYW5lbCBzZXR0aW5ncyB3aGVuIHN0YXJ0aW5nIHNlcnZlclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50U2V0dGluZ3MgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3J0OiBzZXR0aW5ncy52YWx1ZS5wb3J0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXV0b1N0YXJ0OiBzZXR0aW5ncy52YWx1ZS5hdXRvU3RhcnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVEZWJ1Z0xvZzogc2V0dGluZ3MudmFsdWUuZGVidWdMb2csXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhDb25uZWN0aW9uczogc2V0dGluZ3MudmFsdWUubWF4Q29ubmVjdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICd1cGRhdGUtc2V0dGluZ3MnLCBjdXJyZW50U2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ3N0YXJ0LXNlcnZlcicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1Z1ZSBBcHBdIFNlcnZlciB0b2dnbGVkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBGYWlsZWQgdG8gdG9nZ2xlIHNlcnZlcjonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2F2ZVNldHRpbmdzID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDcmVhdGUgYSBwbGFpbiBvYmplY3QgdG8gYXZvaWQgY2xvbmUgZXJyb3JzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2V0dGluZ3NEYXRhID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3J0OiBzZXR0aW5ncy52YWx1ZS5wb3J0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdXRvU3RhcnQ6IHNldHRpbmdzLnZhbHVlLmF1dG9TdGFydCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVidWdMb2c6IHNldHRpbmdzLnZhbHVlLmRlYnVnTG9nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhDb25uZWN0aW9uczogc2V0dGluZ3MudmFsdWUubWF4Q29ubmVjdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICd1cGRhdGUtc2V0dGluZ3MnLCBzZXR0aW5nc0RhdGEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVnVlIEFwcF0gU2F2ZSBzZXR0aW5ncyByZXN1bHQ6JywgcmVzdWx0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXR0aW5nc0NoYW5nZWQudmFsdWUgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1Z1ZSBBcHBdIEZhaWxlZCB0byBzYXZlIHNldHRpbmdzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb3B5VXJsID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChodHRwVXJsLnZhbHVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1Z1ZSBBcHBdIFVSTCBjb3BpZWQgdG8gY2xpcGJvYXJkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBGYWlsZWQgdG8gY29weSBVUkw6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvYWRUb29sTWFuYWdlclN0YXRlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2dldFRvb2xNYW5hZ2VyU3RhdGUnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0ICYmIHJlc3VsdC5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEFsd2F5cyBsb2FkIGJhY2tlbmQgc3RhdGUgdG8gZW5zdXJlIGRhdGEgaXMgdXAgdG8gZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVUb29scy52YWx1ZSA9IHJlc3VsdC5hdmFpbGFibGVUb29scyB8fCBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWdWUgQXBwXSBMb2FkZWQgdG9vbHM6JywgYXZhaWxhYmxlVG9vbHMudmFsdWUubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBGYWlsZWQgdG8gbG9hZCB0b29sIG1hbmFnZXIgc3RhdGU6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZVRvb2xTdGF0dXMgPSBhc3luYyAobmFtZTogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVnVlIEFwcF0gdXBkYXRlVG9vbFN0YXR1cyBjYWxsZWQ6JywgbmFtZSwgZW5hYmxlZCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgbG9jYWwgc3RhdGUgZmlyc3RcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0b29sSW5kZXggPSBhdmFpbGFibGVUb29scy52YWx1ZS5maW5kSW5kZXgodCA9PiB0Lm5hbWUgPT09IG5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0b29sSW5kZXggIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZVRvb2xzLnZhbHVlW3Rvb2xJbmRleF0uZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvcmNlIHJlYWN0aXZlIHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVUb29scy52YWx1ZSA9IFsuLi5hdmFpbGFibGVUb29scy52YWx1ZV07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVnVlIEFwcF0gTG9jYWwgc3RhdGUgdXBkYXRlZCwgdG9vbCBlbmFibGVkOicsIGF2YWlsYWJsZVRvb2xzLnZhbHVlW3Rvb2xJbmRleF0uZW5hYmxlZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2FsbCBiYWNrZW5kIHVwZGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbFN0YXR1cycsIG5hbWUsIGVuYWJsZWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghcmVzdWx0IHx8ICFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSb2xsYmFjayBsb2NhbCBzdGF0ZSBpZiBiYWNrZW5kIHVwZGF0ZSBmYWlsZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2xJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZVRvb2xzLnZhbHVlW3Rvb2xJbmRleF0uZW5hYmxlZCA9ICFlbmFibGVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlVG9vbHMudmFsdWUgPSBbLi4uYXZhaWxhYmxlVG9vbHMudmFsdWVdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBCYWNrZW5kIHVwZGF0ZSBmYWlsZWQsIHJvbGxlZCBiYWNrIGxvY2FsIHN0YXRlJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWdWUgQXBwXSBCYWNrZW5kIHVwZGF0ZSBzdWNjZXNzZnVsJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBSb2xsYmFjayBsb2NhbCBzdGF0ZSBvbiBlcnJvclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xJbmRleCA9IGF2YWlsYWJsZVRvb2xzLnZhbHVlLmZpbmRJbmRleCh0ID0+IHQubmFtZSA9PT0gbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2xJbmRleCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXZhaWxhYmxlVG9vbHMudmFsdWVbdG9vbEluZGV4XS5lbmFibGVkID0gIWVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF2YWlsYWJsZVRvb2xzLnZhbHVlID0gWy4uLmF2YWlsYWJsZVRvb2xzLnZhbHVlXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1Z1ZSBBcHBdIEZhaWxlZCB0byB1cGRhdGUgdG9vbCBzdGF0dXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlbGVjdEFsbFRvb2xzID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVUb29scy52YWx1ZS5mb3JFYWNoKHRvb2wgPT4gdG9vbC5lbmFibGVkID0gdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgc2F2ZUNoYW5nZXMoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1Z1ZSBBcHBdIEZhaWxlZCB0byBzZWxlY3QgYWxsIHRvb2xzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkZXNlbGVjdEFsbFRvb2xzID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVUb29scy52YWx1ZS5mb3JFYWNoKHRvb2wgPT4gdG9vbC5lbmFibGVkID0gZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHNhdmVDaGFuZ2VzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBGYWlsZWQgdG8gZGVzZWxlY3QgYWxsIHRvb2xzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlQ2hhbmdlcyA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ3JlYXRlIHBsYWluIG9iamVjdHMgdG8gYXZvaWQgVnVlMyByZWFjdGl2ZSBvYmplY3QgY2xvbmUgZXJyb3JzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlcyA9IGF2YWlsYWJsZVRvb2xzLnZhbHVlLm1hcCh0b29sID0+ICh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IFN0cmluZyh0b29sLm5hbWUpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmFibGVkOiBCb29sZWFuKHRvb2wuZW5hYmxlZClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1Z1ZSBBcHBdIFNlbmRpbmcgdXBkYXRlczonLCB1cGRhdGVzLmxlbmd0aCwgJ3Rvb2xzJyk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ3VwZGF0ZVRvb2xTdGF0dXNCYXRjaCcsIHVwZGF0ZXMpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdCAmJiByZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW1Z1ZSBBcHBdIFRvb2wgY2hhbmdlcyBzYXZlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBGYWlsZWQgdG8gc2F2ZSB0b29sIGNoYW5nZXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFdhdGNoIGZvciBzZXR0aW5ncyBjaGFuZ2VzXG4gICAgICAgICAgICAgICAgICAgIHdhdGNoKHNldHRpbmdzLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzZXR0aW5nc0NoYW5nZWQudmFsdWUgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9LCB7IGRlZXA6IHRydWUgfSk7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gTG9hZCBkYXRhIG9uIG1vdW50XG4gICAgICAgICAgICAgICAgICAgIG9uTW91bnRlZChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBMb2FkIHRvb2wgbWFuYWdlciBzdGF0ZVxuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgbG9hZFRvb2xNYW5hZ2VyU3RhdGUoKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gTG9hZCBzZXR0aW5ncyBmcm9tIHNlcnZlciBzdGF0dXNcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2VydmVyU3RhdHVzID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdnZXQtc2VydmVyLXN0YXR1cycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXJ2ZXJTdGF0dXMgJiYgc2VydmVyU3RhdHVzLnNldHRpbmdzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldHRpbmdzLnZhbHVlID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9ydDogc2VydmVyU3RhdHVzLnNldHRpbmdzLnBvcnQgfHwgMzAwMCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGF1dG9TdGFydDogc2VydmVyU3RhdHVzLnNldHRpbmdzLmF1dG9TdGFydCB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlYnVnTG9nOiBzZXJ2ZXJTdGF0dXMuc2V0dGluZ3MuZW5hYmxlRGVidWdMb2cgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhDb25uZWN0aW9uczogc2VydmVyU3RhdHVzLnNldHRpbmdzLm1heENvbm5lY3Rpb25zIHx8IDEwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVnVlIEFwcF0gU2VydmVyIHNldHRpbmdzIGxvYWRlZCBmcm9tIHN0YXR1czonLCBzZXJ2ZXJTdGF0dXMuc2V0dGluZ3MpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc2VydmVyU3RhdHVzICYmIHNlcnZlclN0YXR1cy5wb3J0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHkg4oCUIG9ubHkgcG9ydCBpbmZvIGF2YWlsYWJsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXR0aW5ncy52YWx1ZS5wb3J0ID0gc2VydmVyU3RhdHVzLnBvcnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVnVlIEFwcF0gUG9ydCBsb2FkZWQgZnJvbSBzZXJ2ZXIgc3RhdHVzOicsIHNlcnZlclN0YXR1cy5wb3J0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tWdWUgQXBwXSBGYWlsZWQgdG8gZ2V0IHNlcnZlciBzdGF0dXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVnVlIEFwcF0gVXNpbmcgZGVmYXVsdCBzZXJ2ZXIgc2V0dGluZ3MnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUGVyaW9kaWNhbGx5IHVwZGF0ZSBzZXJ2ZXIgc3RhdHVzIOKAlCBzdG9yZSBJRCBmb3IgY2xlYW51cFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHVzSW50ZXJ2YWxJZCA9IHNldEludGVydmFsKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2dldC1zZXJ2ZXItc3RhdHVzJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlclJ1bm5pbmcudmFsdWUgPSByZXN1bHQucnVubmluZztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlclN0YXR1cy52YWx1ZSA9IHJlc3VsdC5ydW5uaW5nID8gJ1J1bm5pbmcnIDogJ1N0b3BwZWQnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29ubmVjdGVkQ2xpZW50cy52YWx1ZSA9IHJlc3VsdC5jbGllbnRzIHx8IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBodHRwVXJsLnZhbHVlID0gcmVzdWx0LnJ1bm5pbmcgPyBgaHR0cDovL2xvY2FsaG9zdDoke3Jlc3VsdC5wb3J0fWAgOiAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzUHJvY2Vzc2luZy52YWx1ZSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW1Z1ZSBBcHBdIEZhaWxlZCB0byBnZXQgc2VydmVyIHN0YXR1czonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSwgMjAwMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEV4cG9zZSBjbGVhbnVwIGZvciBwYW5lbCBjbG9zZVxuICAgICAgICAgICAgICAgICAgICAgICAgKHdpbmRvdyBhcyBhbnkpLl9fbWNwU3RhdHVzSW50ZXJ2YWwgPSBzdGF0dXNJbnRlcnZhbElkO1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGF0YVxuICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlVGFiLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2VydmVyUnVubmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlclN0YXR1cyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbm5lY3RlZENsaWVudHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBodHRwVXJsLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNQcm9jZXNzaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgc2V0dGluZ3MsXG4gICAgICAgICAgICAgICAgICAgICAgICBhdmFpbGFibGVUb29scyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldHRpbmdzQ2hhbmdlZCxcblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ29tcHV0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NsYXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgdG90YWxUb29scyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWRUb29scyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRpc2FibGVkVG9vbHMsXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1ldGhvZHNcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaFRhYixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZVNlcnZlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIHNhdmVTZXR0aW5ncyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvcHlVcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2FkVG9vbE1hbmFnZXJTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZVRvb2xTdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RBbGxUb29scyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2VsZWN0QWxsVG9vbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICBzYXZlQ2hhbmdlc1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgdGVtcGxhdGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy90ZW1wbGF0ZS92dWUvbWNwLXNlcnZlci1hcHAuaHRtbCcpLCAndXRmLTgnKSxcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgYXBwLm1vdW50KHRoaXMuJC5hcHApO1xuICAgICAgICAgICAgcGFuZWxEYXRhTWFwLnNldCh0aGlzLCBhcHApO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUCBQYW5lbF0gVnVlMyBhcHAgbW91bnRlZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgYmVmb3JlQ2xvc2UoKSB7IH0sXG4gICAgY2xvc2UoKSB7XG4gICAgICAgIC8vIENsZWFyIHRoZSBzdGF0dXMgcG9sbGluZyBpbnRlcnZhbCB0byBwcmV2ZW50IG1lbW9yeSBsZWFrc1xuICAgICAgICBjb25zdCBpbnRlcnZhbElkID0gKHdpbmRvdyBhcyBhbnkpLl9fbWNwU3RhdHVzSW50ZXJ2YWw7XG4gICAgICAgIGlmIChpbnRlcnZhbElkICE9IG51bGwpIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxJZCk7XG4gICAgICAgICAgICBkZWxldGUgKHdpbmRvdyBhcyBhbnkpLl9fbWNwU3RhdHVzSW50ZXJ2YWw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXBwID0gcGFuZWxEYXRhTWFwLmdldCh0aGlzKTtcbiAgICAgICAgaWYgKGFwcCkge1xuICAgICAgICAgICAgYXBwLnVubW91bnQoKTtcbiAgICAgICAgfVxuICAgIH0sXG59KTtcbiJdfQ==