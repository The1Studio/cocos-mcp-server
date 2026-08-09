"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('Tool Manager panel shown'); },
        hide() { console.log('Tool Manager panel hidden'); }
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/default/tool-manager.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
    $: {
        panelTitle: '#panelTitle',
        createConfigBtn: '#createConfigBtn',
        importConfigBtn: '#importConfigBtn',
        exportConfigBtn: '#exportConfigBtn',
        configSelector: '#configSelector',
        applyConfigBtn: '#applyConfigBtn',
        editConfigBtn: '#editConfigBtn',
        deleteConfigBtn: '#deleteConfigBtn',
        toolsContainer: '#toolsContainer',
        selectAllBtn: '#selectAllBtn',
        deselectAllBtn: '#deselectAllBtn',
        saveChangesBtn: '#saveChangesBtn',
        totalToolsCount: '#totalToolsCount',
        enabledToolsCount: '#enabledToolsCount',
        disabledToolsCount: '#disabledToolsCount',
        configModal: '#configModal',
        modalTitle: '#modalTitle',
        configForm: '#configForm',
        configName: '#configName',
        configDescription: '#configDescription',
        closeModal: '#closeModal',
        cancelConfigBtn: '#cancelConfigBtn',
        saveConfigBtn: '#saveConfigBtn',
        importModal: '#importModal',
        importConfigJson: '#importConfigJson',
        closeImportModal: '#closeImportModal',
        cancelImportBtn: '#cancelImportBtn',
        confirmImportBtn: '#confirmImportBtn'
    },
    methods: {
        async loadToolManagerState() {
            try {
                this.toolManagerState = await Editor.Message.request('cocos-mcp-server', 'getToolManagerState');
                this.currentConfiguration = this.toolManagerState.configurations.find((c) => c.id === this.toolManagerState.selectedConfigId) || null;
                this.configurations = this.toolManagerState.configurations;
                this.availableTools = this.toolManagerState.availableTools;
                this.updateUI();
            }
            catch (error) {
                console.error('Failed to load tool manager state:', error);
                this.showError('Failed to load tool manager state');
            }
        },
        updateUI() {
            this.updateConfigSelector();
            this.updateToolsDisplay();
            this.updateStatusBar();
            this.updateButtons();
        },
        updateConfigSelector() {
            const selector = this.$.configSelector;
            selector.innerHTML = '<option value="">Select configuration...</option>';
            this.configurations.forEach((config) => {
                const option = document.createElement('option');
                option.value = config.id;
                option.textContent = config.name;
                if (this.currentConfiguration && config.id === this.currentConfiguration.id) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });
        },
        updateToolsDisplay() {
            const container = this.$.toolsContainer;
            // Clear container safely
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            if (!this.currentConfiguration) {
                const emptyDiv = document.createElement('div');
                emptyDiv.className = 'empty-state';
                const h3 = document.createElement('h3');
                h3.textContent = 'No configuration selected';
                const p = document.createElement('p');
                p.textContent = 'Please select a configuration or create a new one';
                emptyDiv.appendChild(h3);
                emptyDiv.appendChild(p);
                container.appendChild(emptyDiv);
                return;
            }
            // v2: flat tool list — no categories
            const toolListDiv = document.createElement('div');
            toolListDiv.className = 'tool-list';
            const enabledCount = this.currentConfiguration.tools.filter((t) => t.enabled).length;
            const totalCount = this.currentConfiguration.tools.length;
            // Category header (safe DOM creation)
            const headerDiv = document.createElement('div');
            headerDiv.className = 'category-header';
            const nameDiv = document.createElement('div');
            nameDiv.className = 'category-name';
            nameDiv.textContent = 'All Tools';
            const toggleDiv = document.createElement('div');
            toggleDiv.className = 'category-toggle';
            const countSpan = document.createElement('span');
            countSpan.textContent = `${enabledCount}/${totalCount}`;
            toggleDiv.appendChild(countSpan);
            headerDiv.appendChild(nameDiv);
            headerDiv.appendChild(toggleDiv);
            toolListDiv.appendChild(headerDiv);
            // Tool items (safe DOM creation — no innerHTML with user data)
            for (const tool of this.currentConfiguration.tools) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'tool-item';
                const infoDiv = document.createElement('div');
                infoDiv.className = 'tool-info';
                const toolNameDiv = document.createElement('div');
                toolNameDiv.className = 'tool-name';
                toolNameDiv.textContent = tool.name;
                const toolDescDiv = document.createElement('div');
                toolDescDiv.className = 'tool-description';
                toolDescDiv.textContent = tool.description;
                infoDiv.appendChild(toolNameDiv);
                infoDiv.appendChild(toolDescDiv);
                const toolToggleDiv = document.createElement('div');
                toolToggleDiv.className = 'tool-toggle';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'checkbox tool-checkbox';
                checkbox.dataset.name = tool.name;
                checkbox.checked = !!tool.enabled;
                toolToggleDiv.appendChild(checkbox);
                itemDiv.appendChild(infoDiv);
                itemDiv.appendChild(toolToggleDiv);
                toolListDiv.appendChild(itemDiv);
            }
            container.appendChild(toolListDiv);
            this.bindToolEvents();
        },
        bindToolEvents() {
            document.querySelectorAll('.tool-checkbox').forEach((checkbox) => {
                checkbox.addEventListener('change', (e) => {
                    const name = e.target.dataset.name;
                    const enabled = e.target.checked;
                    this.updateToolStatus(name, enabled);
                });
            });
        },
        async updateToolStatus(name, enabled) {
            if (!this.currentConfiguration)
                return;
            console.log(`Updating tool status: ${name} = ${enabled}`);
            // Update local state first
            const tool = this.currentConfiguration.tools.find((t) => t.name === name);
            if (!tool) {
                console.error(`Tool not found: ${name}`);
                return;
            }
            try {
                tool.enabled = enabled;
                console.log(`Updated local tool state: ${tool.name} = ${tool.enabled}`);
                // Update UI immediately (only stats, not full re-render)
                this.updateStatusBar();
                // Send to backend
                const result = await Editor.Message.request('cocos-mcp-server', 'updateToolStatus', name, enabled);
                console.log('Backend response:', result);
            }
            catch (error) {
                console.error('Failed to update tool status:', error);
                this.showError('Failed to update tool status');
                // Rollback local state if backend update failed
                tool.enabled = !enabled;
                this.updateStatusBar();
            }
        },
        updateStatusBar() {
            if (!this.currentConfiguration) {
                this.$.totalToolsCount.textContent = '0';
                this.$.enabledToolsCount.textContent = '0';
                this.$.disabledToolsCount.textContent = '0';
                return;
            }
            const total = this.currentConfiguration.tools.length;
            const enabled = this.currentConfiguration.tools.filter((t) => t.enabled).length;
            const disabled = total - enabled;
            this.$.totalToolsCount.textContent = total.toString();
            this.$.enabledToolsCount.textContent = enabled.toString();
            this.$.disabledToolsCount.textContent = disabled.toString();
        },
        updateButtons() {
            const hasCurrentConfig = !!this.currentConfiguration;
            this.$.editConfigBtn.disabled = !hasCurrentConfig;
            this.$.deleteConfigBtn.disabled = !hasCurrentConfig;
            this.$.exportConfigBtn.disabled = !hasCurrentConfig;
            this.$.applyConfigBtn.disabled = !hasCurrentConfig;
        },
        async createConfiguration() {
            this.editingConfig = null;
            this.$.modalTitle.textContent = 'New Configuration';
            this.$.configName.value = '';
            this.$.configDescription.value = '';
            this.showModal('configModal');
        },
        async editConfiguration() {
            if (!this.currentConfiguration)
                return;
            this.editingConfig = this.currentConfiguration;
            this.$.modalTitle.textContent = 'Edit Configuration';
            this.$.configName.value = this.currentConfiguration.name;
            this.$.configDescription.value = this.currentConfiguration.description || '';
            this.showModal('configModal');
        },
        async saveConfiguration() {
            const name = this.$.configName.value.trim();
            const description = this.$.configDescription.value.trim();
            if (!name) {
                this.showError('Configuration name cannot be empty');
                return;
            }
            try {
                if (this.editingConfig) {
                    await Editor.Message.request('cocos-mcp-server', 'updateToolConfiguration', this.editingConfig.id, { name, description });
                }
                else {
                    await Editor.Message.request('cocos-mcp-server', 'createToolConfiguration', name, description);
                }
                this.hideModal('configModal');
                await this.loadToolManagerState();
            }
            catch (error) {
                console.error('Failed to save configuration:', error);
                this.showError('Failed to save configuration');
            }
        },
        async deleteConfiguration() {
            if (!this.currentConfiguration)
                return;
            const confirmed = await Editor.Dialog.warn('Confirm Delete', {
                detail: `Are you sure you want to delete configuration "${this.currentConfiguration.name}"? This action cannot be undone.`
            });
            if (confirmed) {
                try {
                    await Editor.Message.request('cocos-mcp-server', 'deleteToolConfiguration', this.currentConfiguration.id);
                    await this.loadToolManagerState();
                }
                catch (error) {
                    console.error('Failed to delete configuration:', error);
                    this.showError('Failed to delete configuration');
                }
            }
        },
        async applyConfiguration() {
            const configId = this.$.configSelector.value;
            if (!configId)
                return;
            try {
                await Editor.Message.request('cocos-mcp-server', 'setCurrentToolConfiguration', configId);
                await this.loadToolManagerState();
            }
            catch (error) {
                console.error('Failed to apply configuration:', error);
                this.showError('Failed to apply configuration');
            }
        },
        async exportConfiguration() {
            if (!this.currentConfiguration)
                return;
            try {
                const result = await Editor.Message.request('cocos-mcp-server', 'exportToolConfiguration', this.currentConfiguration.id);
                Editor.Clipboard.write('text', result.configJson);
                Editor.Dialog.info('Export Successful', { detail: 'Configuration copied to clipboard' });
            }
            catch (error) {
                console.error('Failed to export configuration:', error);
                this.showError('Failed to export configuration');
            }
        },
        async importConfiguration() {
            this.$.importConfigJson.value = '';
            this.showModal('importModal');
        },
        async confirmImport() {
            const configJson = this.$.importConfigJson.value.trim();
            if (!configJson) {
                this.showError('Please enter configuration JSON');
                return;
            }
            try {
                await Editor.Message.request('cocos-mcp-server', 'importToolConfiguration', configJson);
                this.hideModal('importModal');
                await this.loadToolManagerState();
                Editor.Dialog.info('Import Successful', { detail: 'Configuration imported successfully' });
            }
            catch (error) {
                console.error('Failed to import configuration:', error);
                this.showError('Failed to import configuration');
            }
        },
        async selectAllTools() {
            if (!this.currentConfiguration)
                return;
            // Snapshot current state BEFORE changing (for accurate rollback)
            const snapshot = this.currentConfiguration.tools.map((tool) => ({
                name: tool.name,
                enabled: tool.enabled
            }));
            const updates = this.currentConfiguration.tools.map((tool) => ({
                name: tool.name,
                enabled: true
            }));
            try {
                // Update local state first
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = true;
                });
                // Update UI immediately
                this.updateStatusBar();
                this.updateToolsDisplay();
                // Send to backend
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', updates);
            }
            catch (error) {
                console.error('Failed to select all tools:', error);
                this.showError('Failed to select all tools');
                // Rollback to actual previous state (not assumed inverse)
                for (const prev of snapshot) {
                    const tool = this.currentConfiguration.tools.find((t) => t.name === prev.name);
                    if (tool)
                        tool.enabled = prev.enabled;
                }
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },
        async deselectAllTools() {
            if (!this.currentConfiguration)
                return;
            // Snapshot current state BEFORE changing (for accurate rollback)
            const snapshot = this.currentConfiguration.tools.map((tool) => ({
                name: tool.name,
                enabled: tool.enabled
            }));
            const updates = this.currentConfiguration.tools.map((tool) => ({
                name: tool.name,
                enabled: false
            }));
            try {
                // Update local state first
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = false;
                });
                // Update UI immediately
                this.updateStatusBar();
                this.updateToolsDisplay();
                // Send to backend
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', updates);
            }
            catch (error) {
                console.error('Failed to deselect all tools:', error);
                this.showError('Failed to deselect all tools');
                // Rollback to actual previous state (not assumed inverse)
                for (const prev of snapshot) {
                    const tool = this.currentConfiguration.tools.find((t) => t.name === prev.name);
                    if (tool)
                        tool.enabled = prev.enabled;
                }
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },
        showModal(modalId) {
            this.$[modalId].style.display = 'block';
        },
        hideModal(modalId) {
            this.$[modalId].style.display = 'none';
        },
        showError(message) {
            Editor.Dialog.error('Error', { detail: message });
        },
        async saveChanges() {
            if (!this.currentConfiguration) {
                this.showError('No configuration selected');
                return;
            }
            try {
                // Save current configuration to backend
                await Editor.Message.request('cocos-mcp-server', 'updateToolConfiguration', this.currentConfiguration.id, {
                    name: this.currentConfiguration.name,
                    description: this.currentConfiguration.description,
                    tools: this.currentConfiguration.tools
                });
                Editor.Dialog.info('Save Successful', { detail: 'Configuration changes saved' });
            }
            catch (error) {
                console.error('Failed to save changes:', error);
                this.showError('Failed to save changes');
            }
        },
        bindEvents() {
            this.$.createConfigBtn.addEventListener('click', this.createConfiguration.bind(this));
            this.$.editConfigBtn.addEventListener('click', this.editConfiguration.bind(this));
            this.$.deleteConfigBtn.addEventListener('click', this.deleteConfiguration.bind(this));
            this.$.applyConfigBtn.addEventListener('click', this.applyConfiguration.bind(this));
            this.$.exportConfigBtn.addEventListener('click', this.exportConfiguration.bind(this));
            this.$.importConfigBtn.addEventListener('click', this.importConfiguration.bind(this));
            this.$.selectAllBtn.addEventListener('click', this.selectAllTools.bind(this));
            this.$.deselectAllBtn.addEventListener('click', this.deselectAllTools.bind(this));
            this.$.saveChangesBtn.addEventListener('click', this.saveChanges.bind(this));
            this.$.closeModal.addEventListener('click', () => this.hideModal('configModal'));
            this.$.cancelConfigBtn.addEventListener('click', () => this.hideModal('configModal'));
            this.$.configForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveConfiguration();
            });
            this.$.closeImportModal.addEventListener('click', () => this.hideModal('importModal'));
            this.$.cancelImportBtn.addEventListener('click', () => this.hideModal('importModal'));
            this.$.confirmImportBtn.addEventListener('click', this.confirmImport.bind(this));
            this.$.configSelector.addEventListener('change', this.applyConfiguration.bind(this));
        }
    },
    ready() {
        this.toolManagerState = null;
        this.currentConfiguration = null;
        this.configurations = [];
        this.availableTools = [];
        this.editingConfig = null;
        this.bindEvents();
        this.loadToolManagerState();
    },
    beforeClose() {
        // Cleanup
    },
    close() {
        // Panel close cleanup
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL3Rvb2wtbWFuYWdlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHVDQUF3QztBQUN4QywrQkFBNEI7QUFFNUIsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUU7UUFDUCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN2RDtJQUNELFFBQVEsRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLG9EQUFvRCxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3RHLEtBQUssRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3hGLENBQUMsRUFBRTtRQUNDLFVBQVUsRUFBRSxhQUFhO1FBQ3pCLGVBQWUsRUFBRSxrQkFBa0I7UUFDbkMsZUFBZSxFQUFFLGtCQUFrQjtRQUNuQyxlQUFlLEVBQUUsa0JBQWtCO1FBQ25DLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsY0FBYyxFQUFFLGlCQUFpQjtRQUNqQyxhQUFhLEVBQUUsZ0JBQWdCO1FBQy9CLGVBQWUsRUFBRSxrQkFBa0I7UUFDbkMsY0FBYyxFQUFFLGlCQUFpQjtRQUNqQyxZQUFZLEVBQUUsZUFBZTtRQUM3QixjQUFjLEVBQUUsaUJBQWlCO1FBQ2pDLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsZUFBZSxFQUFFLGtCQUFrQjtRQUNuQyxpQkFBaUIsRUFBRSxvQkFBb0I7UUFDdkMsa0JBQWtCLEVBQUUscUJBQXFCO1FBQ3pDLFdBQVcsRUFB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QU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUM7WUFDdkYsSUFBSSxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztZQUN0RixJQUFJLENBQUMsQ0FBQyxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRWpGLElBQUksQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDekYsQ0FBQztLQUNKO0lBQ0QsS0FBSztRQUNBLElBQVksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7UUFDckMsSUFBWSxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQztRQUN6QyxJQUFZLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUNqQyxJQUFZLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUNqQyxJQUFZLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUVsQyxJQUFZLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDMUIsSUFBWSxDQUFDLG9CQUFvQixFQUFFLENBQUM7SUFDekMsQ0FBQztJQUNELFdBQVc7UUFDUCxVQUFVO0lBQ2QsQ0FBQztJQUNELEtBQUs7UUFDRCxzQkFBc0I7SUFDMUIsQ0FBQztDQUNHLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcblxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3IuUGFuZWwuZGVmaW5lKHtcbiAgICBsaXN0ZW5lcnM6IHtcbiAgICAgICAgc2hvdygpIHsgY29uc29sZS5sb2coJ1Rvb2wgTWFuYWdlciBwYW5lbCBzaG93bicpOyB9LFxuICAgICAgICBoaWRlKCkgeyBjb25zb2xlLmxvZygnVG9vbCBNYW5hZ2VyIHBhbmVsIGhpZGRlbicpOyB9XG4gICAgfSxcbiAgICB0ZW1wbGF0ZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3RlbXBsYXRlL2RlZmF1bHQvdG9vbC1tYW5hZ2VyLmh0bWwnKSwgJ3V0Zi04JyksXG4gICAgc3R5bGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy9zdHlsZS9kZWZhdWx0L2luZGV4LmNzcycpLCAndXRmLTgnKSxcbiAgICAkOiB7XG4gICAgICAgIHBhbmVsVGl0bGU6ICcjcGFuZWxUaXRsZScsXG4gICAgICAgIGNyZWF0ZUNvbmZpZ0J0bjogJyNjcmVhdGVDb25maWdCdG4nLFxuICAgICAgICBpbXBvcnRDb25maWdCdG46ICcjaW1wb3J0Q29uZmlnQnRuJyxcbiAgICAgICAgZXhwb3J0Q29uZmlnQnRuOiAnI2V4cG9ydENvbmZpZ0J0bicsXG4gICAgICAgIGNvbmZpZ1NlbGVjdG9yOiAnI2NvbmZpZ1NlbGVjdG9yJyxcbiAgICAgICAgYXBwbHlDb25maWdCdG46ICcjYXBwbHlDb25maWdCdG4nLFxuICAgICAgICBlZGl0Q29uZmlnQnRuOiAnI2VkaXRDb25maWdCdG4nLFxuICAgICAgICBkZWxldGVDb25maWdCdG46ICcjZGVsZXRlQ29uZmlnQnRuJyxcbiAgICAgICAgdG9vbHNDb250YWluZXI6ICcjdG9vbHNDb250YWluZXInLFxuICAgICAgICBzZWxlY3RBbGxCdG46ICcjc2VsZWN0QWxsQnRuJyxcbiAgICAgICAgZGVzZWxlY3RBbGxCdG46ICcjZGVzZWxlY3RBbGxCdG4nLFxuICAgICAgICBzYXZlQ2hhbmdlc0J0bjogJyNzYXZlQ2hhbmdlc0J0bicsXG4gICAgICAgIHRvdGFsVG9vbHNDb3VudDogJyN0b3RhbFRvb2xzQ291bnQnLFxuICAgICAgICBlbmFibGVkVG9vbHNDb3VudDogJyNlbmFibGVkVG9vbHNDb3VudCcsXG4gICAgICAgIGRpc2FibGVkVG9vbHNDb3VudDogJyNkaXNhYmxlZFRvb2xzQ291bnQnLFxuICAgICAgICBjb25maWdNb2RhbDogJyNjb25maWdNb2RhbCcsXG4gICAgICAgIG1vZGFsVGl0bGU6ICcjbW9kYWxUaXRsZScsXG4gICAgICAgIGNvbmZpZ0Zvcm06ICcjY29uZmlnRm9ybScsXG4gICAgICAgIGNvbmZpZ05hbWU6ICcjY29uZmlnTmFtZScsXG4gICAgICAgIGNvbmZpZ0Rlc2NyaXB0aW9uOiAnI2NvbmZpZ0Rlc2NyaXB0aW9uJyxcbiAgICAgICAgY2xvc2VNb2RhbDogJyNjbG9zZU1vZGFsJyxcbiAgICAgICAgY2FuY2VsQ29uZmlnQnRuOiAnI2NhbmNlbENvbmZpZ0J0bicsXG4gICAgICAgIHNhdmVDb25maWdCdG46ICcjc2F2ZUNvbmZpZ0J0bicsXG4gICAgICAgIGltcG9ydE1vZGFsOiAnI2ltcG9ydE1vZGFsJyxcbiAgICAgICAgaW1wb3J0Q29uZmlnSnNvbjogJyNpbXBvcnRDb25maWdKc29uJyxcbiAgICAgICAgY2xvc2VJbXBvcnRNb2RhbDogJyNjbG9zZUltcG9ydE1vZGFsJyxcbiAgICAgICAgY2FuY2VsSW1wb3J0QnRuOiAnI2NhbmNlbEltcG9ydEJ0bicsXG4gICAgICAgIGNvbmZpcm1JbXBvcnRCdG46ICcjY29uZmlybUltcG9ydEJ0bidcbiAgICB9LFxuICAgIG1ldGhvZHM6IHtcbiAgICAgICAgYXN5bmMgbG9hZFRvb2xNYW5hZ2VyU3RhdGUodGhpczogYW55KSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRoaXMudG9vbE1hbmFnZXJTdGF0ZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnZ2V0VG9vbE1hbmFnZXJTdGF0ZScpO1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24gPSB0aGlzLnRvb2xNYW5hZ2VyU3RhdGUuY29uZmlndXJhdGlvbnMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgKGM6IGFueSkgPT4gYy5pZCA9PT0gdGhpcy50b29sTWFuYWdlclN0YXRlLnNlbGVjdGVkQ29uZmlnSWRcbiAgICAgICAgICAgICAgICApIHx8IG51bGw7XG4gICAgICAgICAgICAgICAgdGhpcy5jb25maWd1cmF0aW9ucyA9IHRoaXMudG9vbE1hbmFnZXJTdGF0ZS5jb25maWd1cmF0aW9ucztcbiAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZVRvb2xzID0gdGhpcy50b29sTWFuYWdlclN0YXRlLmF2YWlsYWJsZVRvb2xzO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVUkoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGxvYWQgdG9vbCBtYW5hZ2VyIHN0YXRlOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIGxvYWQgdG9vbCBtYW5hZ2VyIHN0YXRlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgdXBkYXRlVUkodGhpczogYW55KSB7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUNvbmZpZ1NlbGVjdG9yKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xzRGlzcGxheSgpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlQnV0dG9ucygpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHVwZGF0ZUNvbmZpZ1NlbGVjdG9yKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgY29uc3Qgc2VsZWN0b3IgPSB0aGlzLiQuY29uZmlnU2VsZWN0b3I7XG4gICAgICAgICAgICBzZWxlY3Rvci5pbm5lckhUTUwgPSAnPG9wdGlvbiB2YWx1ZT1cIlwiPlNlbGVjdCBjb25maWd1cmF0aW9uLi4uPC9vcHRpb24+JztcblxuICAgICAgICAgICAgdGhpcy5jb25maWd1cmF0aW9ucy5mb3JFYWNoKChjb25maWc6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ29wdGlvbicpO1xuICAgICAgICAgICAgICAgIG9wdGlvbi52YWx1ZSA9IGNvbmZpZy5pZDtcbiAgICAgICAgICAgICAgICBvcHRpb24udGV4dENvbnRlbnQgPSBjb25maWcubmFtZTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbiAmJiBjb25maWcuaWQgPT09IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uaWQpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uLnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2VsZWN0b3IuYXBwZW5kQ2hpbGQob3B0aW9uKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIHVwZGF0ZVRvb2xzRGlzcGxheSh0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuJC50b29sc0NvbnRhaW5lcjtcblxuICAgICAgICAgICAgLy8gQ2xlYXIgY29udGFpbmVyIHNhZmVseVxuICAgICAgICAgICAgd2hpbGUgKGNvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICAgICAgICAgICAgY29udGFpbmVyLnJlbW92ZUNoaWxkKGNvbnRhaW5lci5maXJzdENoaWxkKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZW1wdHlEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgICAgICBlbXB0eURpdi5jbGFzc05hbWUgPSAnZW1wdHktc3RhdGUnO1xuICAgICAgICAgICAgICAgIGNvbnN0IGgzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaDMnKTtcbiAgICAgICAgICAgICAgICBoMy50ZXh0Q29udGVudCA9ICdObyBjb25maWd1cmF0aW9uIHNlbGVjdGVkJztcbiAgICAgICAgICAgICAgICBjb25zdCBwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICAgICAgICAgICAgICAgIHAudGV4dENvbnRlbnQgPSAnUGxlYXNlIHNlbGVjdCBhIGNvbmZpZ3VyYXRpb24gb3IgY3JlYXRlIGEgbmV3IG9uZSc7XG4gICAgICAgICAgICAgICAgZW1wdHlEaXYuYXBwZW5kQ2hpbGQoaDMpO1xuICAgICAgICAgICAgICAgIGVtcHR5RGl2LmFwcGVuZENoaWxkKHApO1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbXB0eURpdik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyB2MjogZmxhdCB0b29sIGxpc3Qg4oCUIG5vIGNhdGVnb3JpZXNcbiAgICAgICAgICAgIGNvbnN0IHRvb2xMaXN0RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB0b29sTGlzdERpdi5jbGFzc05hbWUgPSAndG9vbC1saXN0JztcblxuICAgICAgICAgICAgY29uc3QgZW5hYmxlZENvdW50ID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maWx0ZXIoKHQ6IGFueSkgPT4gdC5lbmFibGVkKS5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCB0b3RhbENvdW50ID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5sZW5ndGg7XG5cbiAgICAgICAgICAgIC8vIENhdGVnb3J5IGhlYWRlciAoc2FmZSBET00gY3JlYXRpb24pXG4gICAgICAgICAgICBjb25zdCBoZWFkZXJEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIGhlYWRlckRpdi5jbGFzc05hbWUgPSAnY2F0ZWdvcnktaGVhZGVyJztcbiAgICAgICAgICAgIGNvbnN0IG5hbWVEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgIG5hbWVEaXYuY2xhc3NOYW1lID0gJ2NhdGVnb3J5LW5hbWUnO1xuICAgICAgICAgICAgbmFtZURpdi50ZXh0Q29udGVudCA9ICdBbGwgVG9vbHMnO1xuICAgICAgICAgICAgY29uc3QgdG9nZ2xlRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICB0b2dnbGVEaXYuY2xhc3NOYW1lID0gJ2NhdGVnb3J5LXRvZ2dsZSc7XG4gICAgICAgICAgICBjb25zdCBjb3VudFNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgICAgICBjb3VudFNwYW4udGV4dENvbnRlbnQgPSBgJHtlbmFibGVkQ291bnR9LyR7dG90YWxDb3VudH1gO1xuICAgICAgICAgICAgdG9nZ2xlRGl2LmFwcGVuZENoaWxkKGNvdW50U3Bhbik7XG4gICAgICAgICAgICBoZWFkZXJEaXYuYXBwZW5kQ2hpbGQobmFtZURpdik7XG4gICAgICAgICAgICBoZWFkZXJEaXYuYXBwZW5kQ2hpbGQodG9nZ2xlRGl2KTtcbiAgICAgICAgICAgIHRvb2xMaXN0RGl2LmFwcGVuZENoaWxkKGhlYWRlckRpdik7XG5cbiAgICAgICAgICAgIC8vIFRvb2wgaXRlbXMgKHNhZmUgRE9NIGNyZWF0aW9uIOKAlCBubyBpbm5lckhUTUwgd2l0aCB1c2VyIGRhdGEpXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2wgb2YgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1EaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgICAgICBpdGVtRGl2LmNsYXNzTmFtZSA9ICd0b29sLWl0ZW0nO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgaW5mb0RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIGluZm9EaXYuY2xhc3NOYW1lID0gJ3Rvb2wtaW5mbyc7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b29sTmFtZURpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIHRvb2xOYW1lRGl2LmNsYXNzTmFtZSA9ICd0b29sLW5hbWUnO1xuICAgICAgICAgICAgICAgIHRvb2xOYW1lRGl2LnRleHRDb250ZW50ID0gdG9vbC5uYW1lO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbERlc2NEaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgICAgICB0b29sRGVzY0Rpdi5jbGFzc05hbWUgPSAndG9vbC1kZXNjcmlwdGlvbic7XG4gICAgICAgICAgICAgICAgdG9vbERlc2NEaXYudGV4dENvbnRlbnQgPSB0b29sLmRlc2NyaXB0aW9uO1xuXG4gICAgICAgICAgICAgICAgaW5mb0Rpdi5hcHBlbmRDaGlsZCh0b29sTmFtZURpdik7XG4gICAgICAgICAgICAgICAgaW5mb0Rpdi5hcHBlbmRDaGlsZCh0b29sRGVzY0Rpdik7XG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b29sVG9nZ2xlRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICAgICAgdG9vbFRvZ2dsZURpdi5jbGFzc05hbWUgPSAndG9vbC10b2dnbGUnO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgY2hlY2tib3ggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LnR5cGUgPSAnY2hlY2tib3gnO1xuICAgICAgICAgICAgICAgIGNoZWNrYm94LmNsYXNzTmFtZSA9ICdjaGVja2JveCB0b29sLWNoZWNrYm94JztcbiAgICAgICAgICAgICAgICBjaGVja2JveC5kYXRhc2V0Lm5hbWUgPSB0b29sLm5hbWU7XG4gICAgICAgICAgICAgICAgY2hlY2tib3guY2hlY2tlZCA9ICEhdG9vbC5lbmFibGVkO1xuXG4gICAgICAgICAgICAgICAgdG9vbFRvZ2dsZURpdi5hcHBlbmRDaGlsZChjaGVja2JveCk7XG4gICAgICAgICAgICAgICAgaXRlbURpdi5hcHBlbmRDaGlsZChpbmZvRGl2KTtcbiAgICAgICAgICAgICAgICBpdGVtRGl2LmFwcGVuZENoaWxkKHRvb2xUb2dnbGVEaXYpO1xuICAgICAgICAgICAgICAgIHRvb2xMaXN0RGl2LmFwcGVuZENoaWxkKGl0ZW1EaXYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQodG9vbExpc3REaXYpO1xuICAgICAgICAgICAgdGhpcy5iaW5kVG9vbEV2ZW50cygpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGJpbmRUb29sRXZlbnRzKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLnRvb2wtY2hlY2tib3gnKS5mb3JFYWNoKChjaGVja2JveDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBuYW1lID0gZS50YXJnZXQuZGF0YXNldC5uYW1lO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbmFibGVkID0gZS50YXJnZXQuY2hlY2tlZDtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sU3RhdHVzKG5hbWUsIGVuYWJsZWQpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgdXBkYXRlVG9vbFN0YXR1cyh0aGlzOiBhbnksIG5hbWU6IHN0cmluZywgZW5hYmxlZDogYm9vbGVhbikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSByZXR1cm47XG5cbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGluZyB0b29sIHN0YXR1czogJHtuYW1lfSA9ICR7ZW5hYmxlZH1gKTtcblxuICAgICAgICAgICAgLy8gVXBkYXRlIGxvY2FsIHN0YXRlIGZpcnN0XG4gICAgICAgICAgICBjb25zdCB0b29sID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maW5kKCh0OiBhbnkpID0+IHQubmFtZSA9PT0gbmFtZSk7XG4gICAgICAgICAgICBpZiAoIXRvb2wpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGBUb29sIG5vdCBmb3VuZDogJHtuYW1lfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0b29sLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGVkIGxvY2FsIHRvb2wgc3RhdGU6ICR7dG9vbC5uYW1lfSA9ICR7dG9vbC5lbmFibGVkfWApO1xuXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIFVJIGltbWVkaWF0ZWx5IChvbmx5IHN0YXRzLCBub3QgZnVsbCByZS1yZW5kZXIpXG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcblxuICAgICAgICAgICAgICAgIC8vIFNlbmQgdG8gYmFja2VuZFxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbFN0YXR1cycsIG5hbWUsIGVuYWJsZWQpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdCYWNrZW5kIHJlc3BvbnNlOicsIHJlc3VsdCk7XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSB0b29sIHN0YXR1czonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgdG9vbCBzdGF0dXMnKTtcblxuICAgICAgICAgICAgICAgIC8vIFJvbGxiYWNrIGxvY2FsIHN0YXRlIGlmIGJhY2tlbmQgdXBkYXRlIGZhaWxlZFxuICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9ICFlbmFibGVkO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgdXBkYXRlU3RhdHVzQmFyKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy4kLnRvdGFsVG9vbHNDb3VudC50ZXh0Q29udGVudCA9ICcwJztcbiAgICAgICAgICAgICAgICB0aGlzLiQuZW5hYmxlZFRvb2xzQ291bnQudGV4dENvbnRlbnQgPSAnMCc7XG4gICAgICAgICAgICAgICAgdGhpcy4kLmRpc2FibGVkVG9vbHNDb3VudC50ZXh0Q29udGVudCA9ICcwJztcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRvdGFsID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCBlbmFibGVkID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maWx0ZXIoKHQ6IGFueSkgPT4gdC5lbmFibGVkKS5sZW5ndGg7XG4gICAgICAgICAgICBjb25zdCBkaXNhYmxlZCA9IHRvdGFsIC0gZW5hYmxlZDtcblxuICAgICAgICAgICAgdGhpcy4kLnRvdGFsVG9vbHNDb3VudC50ZXh0Q29udGVudCA9IHRvdGFsLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB0aGlzLiQuZW5hYmxlZFRvb2xzQ291bnQudGV4dENvbnRlbnQgPSBlbmFibGVkLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB0aGlzLiQuZGlzYWJsZWRUb29sc0NvdW50LnRleHRDb250ZW50ID0gZGlzYWJsZWQudG9TdHJpbmcoKTtcbiAgICAgICAgfSxcblxuICAgICAgICB1cGRhdGVCdXR0b25zKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgY29uc3QgaGFzQ3VycmVudENvbmZpZyA9ICEhdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuJC5lZGl0Q29uZmlnQnRuLmRpc2FibGVkID0gIWhhc0N1cnJlbnRDb25maWc7XG4gICAgICAgICAgICB0aGlzLiQuZGVsZXRlQ29uZmlnQnRuLmRpc2FibGVkID0gIWhhc0N1cnJlbnRDb25maWc7XG4gICAgICAgICAgICB0aGlzLiQuZXhwb3J0Q29uZmlnQnRuLmRpc2FibGVkID0gIWhhc0N1cnJlbnRDb25maWc7XG4gICAgICAgICAgICB0aGlzLiQuYXBwbHlDb25maWdCdG4uZGlzYWJsZWQgPSAhaGFzQ3VycmVudENvbmZpZztcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBjcmVhdGVDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgdGhpcy5lZGl0aW5nQ29uZmlnID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMuJC5tb2RhbFRpdGxlLnRleHRDb250ZW50ID0gJ05ldyBDb25maWd1cmF0aW9uJztcbiAgICAgICAgICAgIHRoaXMuJC5jb25maWdOYW1lLnZhbHVlID0gJyc7XG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnRGVzY3JpcHRpb24udmFsdWUgPSAnJztcbiAgICAgICAgICAgIHRoaXMuc2hvd01vZGFsKCdjb25maWdNb2RhbCcpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGVkaXRDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSByZXR1cm47XG5cbiAgICAgICAgICAgIHRoaXMuZWRpdGluZ0NvbmZpZyA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb247XG4gICAgICAgICAgICB0aGlzLiQubW9kYWxUaXRsZS50ZXh0Q29udGVudCA9ICdFZGl0IENvbmZpZ3VyYXRpb24nO1xuICAgICAgICAgICAgdGhpcy4kLmNvbmZpZ05hbWUudmFsdWUgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLm5hbWU7XG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnRGVzY3JpcHRpb24udmFsdWUgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmRlc2NyaXB0aW9uIHx8ICcnO1xuICAgICAgICAgICAgdGhpcy5zaG93TW9kYWwoJ2NvbmZpZ01vZGFsJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgc2F2ZUNvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XG4gICAgICAgICAgICBjb25zdCBuYW1lID0gdGhpcy4kLmNvbmZpZ05hbWUudmFsdWUudHJpbSgpO1xuICAgICAgICAgICAgY29uc3QgZGVzY3JpcHRpb24gPSB0aGlzLiQuY29uZmlnRGVzY3JpcHRpb24udmFsdWUudHJpbSgpO1xuXG4gICAgICAgICAgICBpZiAoIW5hbWUpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignQ29uZmlndXJhdGlvbiBuYW1lIGNhbm5vdCBiZSBlbXB0eScpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5lZGl0aW5nQ29uZmlnKSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbENvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5lZGl0aW5nQ29uZmlnLmlkLCB7IG5hbWUsIGRlc2NyaXB0aW9uIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnY3JlYXRlVG9vbENvbmZpZ3VyYXRpb24nLCBuYW1lLCBkZXNjcmlwdGlvbik7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlTW9kYWwoJ2NvbmZpZ01vZGFsJyk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5sb2FkVG9vbE1hbmFnZXJTdGF0ZSgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSBjb25maWd1cmF0aW9uOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIHNhdmUgY29uZmlndXJhdGlvbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGRlbGV0ZUNvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcblxuICAgICAgICAgICAgY29uc3QgY29uZmlybWVkID0gYXdhaXQgRWRpdG9yLkRpYWxvZy53YXJuKCdDb25maXJtIERlbGV0ZScsIHtcbiAgICAgICAgICAgICAgICBkZXRhaWw6IGBBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gZGVsZXRlIGNvbmZpZ3VyYXRpb24gXCIke3RoaXMuY3VycmVudENvbmZpZ3VyYXRpb24ubmFtZX1cIj8gVGhpcyBhY3Rpb24gY2Fubm90IGJlIHVuZG9uZS5gXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgaWYgKGNvbmZpcm1lZCkge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnZGVsZXRlVG9vbENvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubG9hZFRvb2xNYW5hZ2VyU3RhdGUoKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZGVsZXRlIGNvbmZpZ3VyYXRpb246JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIGRlbGV0ZSBjb25maWd1cmF0aW9uJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGFwcGx5Q29uZmlndXJhdGlvbih0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0lkID0gdGhpcy4kLmNvbmZpZ1NlbGVjdG9yLnZhbHVlO1xuICAgICAgICAgICAgaWYgKCFjb25maWdJZCkgcmV0dXJuO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnc2V0Q3VycmVudFRvb2xDb25maWd1cmF0aW9uJywgY29uZmlnSWQpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMubG9hZFRvb2xNYW5hZ2VyU3RhdGUoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGFwcGx5IGNvbmZpZ3VyYXRpb246JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdGYWlsZWQgdG8gYXBwbHkgY29uZmlndXJhdGlvbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGV4cG9ydENvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2V4cG9ydFRvb2xDb25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCk7XG5cbiAgICAgICAgICAgICAgICBFZGl0b3IuQ2xpcGJvYXJkLndyaXRlKCd0ZXh0JywgcmVzdWx0LmNvbmZpZ0pzb24pO1xuICAgICAgICAgICAgICAgIEVkaXRvci5EaWFsb2cuaW5mbygnRXhwb3J0IFN1Y2Nlc3NmdWwnLCB7IGRldGFpbDogJ0NvbmZpZ3VyYXRpb24gY29waWVkIHRvIGNsaXBib2FyZCcgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBleHBvcnQgY29uZmlndXJhdGlvbjonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ0ZhaWxlZCB0byBleHBvcnQgY29uZmlndXJhdGlvbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGltcG9ydENvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XG4gICAgICAgICAgICB0aGlzLiQuaW1wb3J0Q29uZmlnSnNvbi52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgdGhpcy5zaG93TW9kYWwoJ2ltcG9ydE1vZGFsJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgY29uZmlybUltcG9ydCh0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ0pzb24gPSB0aGlzLiQuaW1wb3J0Q29uZmlnSnNvbi52YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBpZiAoIWNvbmZpZ0pzb24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignUGxlYXNlIGVudGVyIGNvbmZpZ3VyYXRpb24gSlNPTicpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2ltcG9ydFRvb2xDb25maWd1cmF0aW9uJywgY29uZmlnSnNvbik7XG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlTW9kYWwoJ2ltcG9ydE1vZGFsJyk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5sb2FkVG9vbE1hbmFnZXJTdGF0ZSgpO1xuICAgICAgICAgICAgICAgIEVkaXRvci5EaWFsb2cuaW5mbygnSW1wb3J0IFN1Y2Nlc3NmdWwnLCB7IGRldGFpbDogJ0NvbmZpZ3VyYXRpb24gaW1wb3J0ZWQgc3VjY2Vzc2Z1bGx5JyB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGltcG9ydCBjb25maWd1cmF0aW9uOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIGltcG9ydCBjb25maWd1cmF0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgc2VsZWN0QWxsVG9vbHModGhpczogYW55KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcblxuICAgICAgICAgICAgLy8gU25hcHNob3QgY3VycmVudCBzdGF0ZSBCRUZPUkUgY2hhbmdpbmcgKGZvciBhY2N1cmF0ZSByb2xsYmFjaylcbiAgICAgICAgICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5tYXAoKHRvb2w6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdG9vbC5lbmFibGVkXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXMgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLm1hcCgodG9vbDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiB0cnVlXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIGxvY2FsIHN0YXRlIGZpcnN0XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5mb3JFYWNoKCh0b29sOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBVSSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sc0Rpc3BsYXkoKTtcblxuICAgICAgICAgICAgICAgIC8vIFNlbmQgdG8gYmFja2VuZFxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbFN0YXR1c0JhdGNoJywgdXBkYXRlcyk7XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHNlbGVjdCBhbGwgdG9vbHM6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdGYWlsZWQgdG8gc2VsZWN0IGFsbCB0b29scycpO1xuXG4gICAgICAgICAgICAgICAgLy8gUm9sbGJhY2sgdG8gYWN0dWFsIHByZXZpb3VzIHN0YXRlIChub3QgYXNzdW1lZCBpbnZlcnNlKVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcHJldiBvZiBzbmFwc2hvdCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b29sID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maW5kKCh0OiBhbnkpID0+IHQubmFtZSA9PT0gcHJldi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2wpIHRvb2wuZW5hYmxlZCA9IHByZXYuZW5hYmxlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xzRGlzcGxheSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGRlc2VsZWN0QWxsVG9vbHModGhpczogYW55KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcblxuICAgICAgICAgICAgLy8gU25hcHNob3QgY3VycmVudCBzdGF0ZSBCRUZPUkUgY2hhbmdpbmcgKGZvciBhY2N1cmF0ZSByb2xsYmFjaylcbiAgICAgICAgICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5tYXAoKHRvb2w6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdG9vbC5lbmFibGVkXG4gICAgICAgICAgICB9KSk7XG5cbiAgICAgICAgICAgIGNvbnN0IHVwZGF0ZXMgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLm1hcCgodG9vbDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgIG5hbWU6IHRvb2wubmFtZSxcbiAgICAgICAgICAgICAgICBlbmFibGVkOiBmYWxzZVxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBsb2NhbCBzdGF0ZSBmaXJzdFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMuZm9yRWFjaCgodG9vbDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIFVJIGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xzRGlzcGxheSgpO1xuXG4gICAgICAgICAgICAgICAgLy8gU2VuZCB0byBiYWNrZW5kXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICd1cGRhdGVUb29sU3RhdHVzQmF0Y2gnLCB1cGRhdGVzKTtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gZGVzZWxlY3QgYWxsIHRvb2xzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIGRlc2VsZWN0IGFsbCB0b29scycpO1xuXG4gICAgICAgICAgICAgICAgLy8gUm9sbGJhY2sgdG8gYWN0dWFsIHByZXZpb3VzIHN0YXRlIChub3QgYXNzdW1lZCBpbnZlcnNlKVxuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcHJldiBvZiBzbmFwc2hvdCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b29sID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5maW5kKCh0OiBhbnkpID0+IHQubmFtZSA9PT0gcHJldi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2wpIHRvb2wuZW5hYmxlZCA9IHByZXYuZW5hYmxlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xzRGlzcGxheSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIHNob3dNb2RhbCh0aGlzOiBhbnksIG1vZGFsSWQ6IHN0cmluZykge1xuICAgICAgICAgICAgdGhpcy4kW21vZGFsSWRdLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICB9LFxuXG4gICAgICAgIGhpZGVNb2RhbCh0aGlzOiBhbnksIG1vZGFsSWQ6IHN0cmluZykge1xuICAgICAgICAgICAgdGhpcy4kW21vZGFsSWRdLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH0sXG5cbiAgICAgICAgc2hvd0Vycm9yKHRoaXM6IGFueSwgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgICAgICAgICBFZGl0b3IuRGlhbG9nLmVycm9yKCdFcnJvcicsIHsgZGV0YWlsOiBtZXNzYWdlIH0pO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIHNhdmVDaGFuZ2VzKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ05vIGNvbmZpZ3VyYXRpb24gc2VsZWN0ZWQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gU2F2ZSBjdXJyZW50IGNvbmZpZ3VyYXRpb24gdG8gYmFja2VuZFxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbENvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmlkLCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xzOiB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgRWRpdG9yLkRpYWxvZy5pbmZvKCdTYXZlIFN1Y2Nlc3NmdWwnLCB7IGRldGFpbDogJ0NvbmZpZ3VyYXRpb24gY2hhbmdlcyBzYXZlZCcgfSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIGNoYW5nZXM6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdGYWlsZWQgdG8gc2F2ZSBjaGFuZ2VzJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYmluZEV2ZW50cyh0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIHRoaXMuJC5jcmVhdGVDb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmNyZWF0ZUNvbmZpZ3VyYXRpb24uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLiQuZWRpdENvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuZWRpdENvbmZpZ3VyYXRpb24uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLiQuZGVsZXRlQ29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5kZWxldGVDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLmFwcGx5Q29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5hcHBseUNvbmZpZ3VyYXRpb24uYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLiQuZXhwb3J0Q29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5leHBvcnRDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLmltcG9ydENvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuaW1wb3J0Q29uZmlndXJhdGlvbi5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgdGhpcy4kLnNlbGVjdEFsbEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuc2VsZWN0QWxsVG9vbHMuYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLiQuZGVzZWxlY3RBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmRlc2VsZWN0QWxsVG9vbHMuYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB0aGlzLiQuc2F2ZUNoYW5nZXNCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnNhdmVDaGFuZ2VzLmJpbmQodGhpcykpO1xuXG4gICAgICAgICAgICB0aGlzLiQuY2xvc2VNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuaGlkZU1vZGFsKCdjb25maWdNb2RhbCcpKTtcbiAgICAgICAgICAgIHRoaXMuJC5jYW5jZWxDb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVNb2RhbCgnY29uZmlnTW9kYWwnKSk7XG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnRm9ybS5hZGRFdmVudExpc3RlbmVyKCdzdWJtaXQnLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2F2ZUNvbmZpZ3VyYXRpb24oKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB0aGlzLiQuY2xvc2VJbXBvcnRNb2RhbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuaGlkZU1vZGFsKCdpbXBvcnRNb2RhbCcpKTtcbiAgICAgICAgICAgIHRoaXMuJC5jYW5jZWxJbXBvcnRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVNb2RhbCgnaW1wb3J0TW9kYWwnKSk7XG4gICAgICAgICAgICB0aGlzLiQuY29uZmlybUltcG9ydEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuY29uZmlybUltcG9ydC5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgdGhpcy4kLmNvbmZpZ1NlbGVjdG9yLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuYXBwbHlDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZWFkeSgpIHtcbiAgICAgICAgKHRoaXMgYXMgYW55KS50b29sTWFuYWdlclN0YXRlID0gbnVsbDtcbiAgICAgICAgKHRoaXMgYXMgYW55KS5jdXJyZW50Q29uZmlndXJhdGlvbiA9IG51bGw7XG4gICAgICAgICh0aGlzIGFzIGFueSkuY29uZmlndXJhdGlvbnMgPSBbXTtcbiAgICAgICAgKHRoaXMgYXMgYW55KS5hdmFpbGFibGVUb29scyA9IFtdO1xuICAgICAgICAodGhpcyBhcyBhbnkpLmVkaXRpbmdDb25maWcgPSBudWxsO1xuXG4gICAgICAgICh0aGlzIGFzIGFueSkuYmluZEV2ZW50cygpO1xuICAgICAgICAodGhpcyBhcyBhbnkpLmxvYWRUb29sTWFuYWdlclN0YXRlKCk7XG4gICAgfSxcbiAgICBiZWZvcmVDbG9zZSgpIHtcbiAgICAgICAgLy8gQ2xlYW51cFxuICAgIH0sXG4gICAgY2xvc2UoKSB7XG4gICAgICAgIC8vIFBhbmVsIGNsb3NlIGNsZWFudXBcbiAgICB9XG59IGFzIGFueSk7XG4iXX0=