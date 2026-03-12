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
            if (!this.currentConfiguration) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No configuration selected</h3>
                        <p>Please select a configuration or create a new one</p>
                    </div>
                `;
                return;
            }
            // v2: flat tool list — no categories
            container.innerHTML = '';
            const toolListDiv = document.createElement('div');
            toolListDiv.className = 'tool-list';
            const enabledCount = this.currentConfiguration.tools.filter((t) => t.enabled).length;
            const totalCount = this.currentConfiguration.tools.length;
            toolListDiv.innerHTML = `
                <div class="category-header">
                    <div class="category-name">All Tools</div>
                    <div class="category-toggle">
                        <span>${enabledCount}/${totalCount}</span>
                    </div>
                </div>
                ${this.currentConfiguration.tools.map((tool) => `
                    <div class="tool-item">
                        <div class="tool-info">
                            <div class="tool-name">${tool.name}</div>
                            <div class="tool-description">${tool.description}</div>
                        </div>
                        <div class="tool-toggle">
                            <input type="checkbox" class="checkbox tool-checkbox"
                                   data-name="${tool.name}"
                                   ${tool.enabled ? 'checked' : ''}>
                        </div>
                    </div>
                `).join('')}
            `;
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
                // Rollback on failure
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = false;
                });
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },
        async deselectAllTools() {
            if (!this.currentConfiguration)
                return;
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
                // Rollback on failure
                this.currentConfiguration.tools.forEach((tool) => {
                    tool.enabled = true;
                });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL3Rvb2wtbWFuYWdlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHVDQUF3QztBQUN4QywrQkFBNEI7QUFFNUIsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUU7UUFDUCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN2RDtJQUNELFFBQVEsRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLG9EQUFvRCxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3RHLEtBQUssRUFBRSxJQUFBLHVCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLEVBQUUsT0FBTyxDQUFDO0lBQ3hGLENBQUMsRUFBRTtRQUNDLFVBQVUsRUFBRSxhQUFhO1FBQ3pCLGVBQWUsRUFBRSxrQkFBa0I7UUFDbkMsZUFBZSxFQUFFLGtCQUFrQjtRQUNuQyxlQUFlLEVBQUUsa0JBQWtCO1FBQ25DLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsY0FBYyxFQUFFLGlCQUFpQjtRQUNqQyxhQUFhLEVBQUUsZ0JBQWdCO1FBQy9CLGVBQWUsRUFBRSxrQkFBa0I7UUFDbkMsY0FBYyxFQUFFLGlCQUFpQjtRQUNqQyxZQUFZLEVBQUUsZUFBZTtRQUM3QixjQUFjLEVBQUUsaUJBQWlCO1FBQ2pDLGNBQWMsRUFBRSxpQkFBaUI7UUFDakMsZUFBZSxFQUFFLGtCQUFrQjtRQUNuQyxpQkFBaUIsRUFBRSxvQkFBb0I7UUFDdkMsa0JBQWtCLEVBQUUscUJBQXFCO1FBQ3pDLFdBQVcsRUFB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O1FBQ0Qsc0JBQXNCO0lBQzFCLENBQUM7Q0FDRyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdmcy1leHRyYSc7XG5pbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5cbm1vZHVsZS5leHBvcnRzID0gRWRpdG9yLlBhbmVsLmRlZmluZSh7XG4gICAgbGlzdGVuZXJzOiB7XG4gICAgICAgIHNob3coKSB7IGNvbnNvbGUubG9nKCdUb29sIE1hbmFnZXIgcGFuZWwgc2hvd24nKTsgfSxcbiAgICAgICAgaGlkZSgpIHsgY29uc29sZS5sb2coJ1Rvb2wgTWFuYWdlciBwYW5lbCBoaWRkZW4nKTsgfVxuICAgIH0sXG4gICAgdGVtcGxhdGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy90ZW1wbGF0ZS9kZWZhdWx0L3Rvb2wtbWFuYWdlci5odG1sJyksICd1dGYtOCcpLFxuICAgIHN0eWxlOiByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvc3R5bGUvZGVmYXVsdC9pbmRleC5jc3MnKSwgJ3V0Zi04JyksXG4gICAgJDoge1xuICAgICAgICBwYW5lbFRpdGxlOiAnI3BhbmVsVGl0bGUnLFxuICAgICAgICBjcmVhdGVDb25maWdCdG46ICcjY3JlYXRlQ29uZmlnQnRuJyxcbiAgICAgICAgaW1wb3J0Q29uZmlnQnRuOiAnI2ltcG9ydENvbmZpZ0J0bicsXG4gICAgICAgIGV4cG9ydENvbmZpZ0J0bjogJyNleHBvcnRDb25maWdCdG4nLFxuICAgICAgICBjb25maWdTZWxlY3RvcjogJyNjb25maWdTZWxlY3RvcicsXG4gICAgICAgIGFwcGx5Q29uZmlnQnRuOiAnI2FwcGx5Q29uZmlnQnRuJyxcbiAgICAgICAgZWRpdENvbmZpZ0J0bjogJyNlZGl0Q29uZmlnQnRuJyxcbiAgICAgICAgZGVsZXRlQ29uZmlnQnRuOiAnI2RlbGV0ZUNvbmZpZ0J0bicsXG4gICAgICAgIHRvb2xzQ29udGFpbmVyOiAnI3Rvb2xzQ29udGFpbmVyJyxcbiAgICAgICAgc2VsZWN0QWxsQnRuOiAnI3NlbGVjdEFsbEJ0bicsXG4gICAgICAgIGRlc2VsZWN0QWxsQnRuOiAnI2Rlc2VsZWN0QWxsQnRuJyxcbiAgICAgICAgc2F2ZUNoYW5nZXNCdG46ICcjc2F2ZUNoYW5nZXNCdG4nLFxuICAgICAgICB0b3RhbFRvb2xzQ291bnQ6ICcjdG90YWxUb29sc0NvdW50JyxcbiAgICAgICAgZW5hYmxlZFRvb2xzQ291bnQ6ICcjZW5hYmxlZFRvb2xzQ291bnQnLFxuICAgICAgICBkaXNhYmxlZFRvb2xzQ291bnQ6ICcjZGlzYWJsZWRUb29sc0NvdW50JyxcbiAgICAgICAgY29uZmlnTW9kYWw6ICcjY29uZmlnTW9kYWwnLFxuICAgICAgICBtb2RhbFRpdGxlOiAnI21vZGFsVGl0bGUnLFxuICAgICAgICBjb25maWdGb3JtOiAnI2NvbmZpZ0Zvcm0nLFxuICAgICAgICBjb25maWdOYW1lOiAnI2NvbmZpZ05hbWUnLFxuICAgICAgICBjb25maWdEZXNjcmlwdGlvbjogJyNjb25maWdEZXNjcmlwdGlvbicsXG4gICAgICAgIGNsb3NlTW9kYWw6ICcjY2xvc2VNb2RhbCcsXG4gICAgICAgIGNhbmNlbENvbmZpZ0J0bjogJyNjYW5jZWxDb25maWdCdG4nLFxuICAgICAgICBzYXZlQ29uZmlnQnRuOiAnI3NhdmVDb25maWdCdG4nLFxuICAgICAgICBpbXBvcnRNb2RhbDogJyNpbXBvcnRNb2RhbCcsXG4gICAgICAgIGltcG9ydENvbmZpZ0pzb246ICcjaW1wb3J0Q29uZmlnSnNvbicsXG4gICAgICAgIGNsb3NlSW1wb3J0TW9kYWw6ICcjY2xvc2VJbXBvcnRNb2RhbCcsXG4gICAgICAgIGNhbmNlbEltcG9ydEJ0bjogJyNjYW5jZWxJbXBvcnRCdG4nLFxuICAgICAgICBjb25maXJtSW1wb3J0QnRuOiAnI2NvbmZpcm1JbXBvcnRCdG4nXG4gICAgfSxcbiAgICBtZXRob2RzOiB7XG4gICAgICAgIGFzeW5jIGxvYWRUb29sTWFuYWdlclN0YXRlKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB0aGlzLnRvb2xNYW5hZ2VyU3RhdGUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ2dldFRvb2xNYW5hZ2VyU3RhdGUnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uID0gdGhpcy50b29sTWFuYWdlclN0YXRlLmNvbmZpZ3VyYXRpb25zLmZpbmQoXG4gICAgICAgICAgICAgICAgICAgIChjOiBhbnkpID0+IGMuaWQgPT09IHRoaXMudG9vbE1hbmFnZXJTdGF0ZS5zZWxlY3RlZENvbmZpZ0lkXG4gICAgICAgICAgICAgICAgKSB8fCBudWxsO1xuICAgICAgICAgICAgICAgIHRoaXMuY29uZmlndXJhdGlvbnMgPSB0aGlzLnRvb2xNYW5hZ2VyU3RhdGUuY29uZmlndXJhdGlvbnM7XG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVUb29scyA9IHRoaXMudG9vbE1hbmFnZXJTdGF0ZS5hdmFpbGFibGVUb29scztcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVVJKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHRvb2wgbWFuYWdlciBzdGF0ZTonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ0ZhaWxlZCB0byBsb2FkIHRvb2wgbWFuYWdlciBzdGF0ZScpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIHVwZGF0ZVVJKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgdGhpcy51cGRhdGVDb25maWdTZWxlY3RvcigpO1xuICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sc0Rpc3BsYXkoKTtcbiAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG4gICAgICAgICAgICB0aGlzLnVwZGF0ZUJ1dHRvbnMoKTtcbiAgICAgICAgfSxcblxuICAgICAgICB1cGRhdGVDb25maWdTZWxlY3Rvcih0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdG9yID0gdGhpcy4kLmNvbmZpZ1NlbGVjdG9yO1xuICAgICAgICAgICAgc2VsZWN0b3IuaW5uZXJIVE1MID0gJzxvcHRpb24gdmFsdWU9XCJcIj5TZWxlY3QgY29uZmlndXJhdGlvbi4uLjwvb3B0aW9uPic7XG5cbiAgICAgICAgICAgIHRoaXMuY29uZmlndXJhdGlvbnMuZm9yRWFjaCgoY29uZmlnOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcbiAgICAgICAgICAgICAgICBvcHRpb24udmFsdWUgPSBjb25maWcuaWQ7XG4gICAgICAgICAgICAgICAgb3B0aW9uLnRleHRDb250ZW50ID0gY29uZmlnLm5hbWU7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24gJiYgY29uZmlnLmlkID09PSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmlkKSB7XG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbi5zZWxlY3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHNlbGVjdG9yLmFwcGVuZENoaWxkKG9wdGlvbik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICB1cGRhdGVUb29sc0Rpc3BsYXkodGhpczogYW55KSB7XG4gICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSB0aGlzLiQudG9vbHNDb250YWluZXI7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJlbXB0eS1zdGF0ZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGgzPk5vIGNvbmZpZ3VyYXRpb24gc2VsZWN0ZWQ8L2gzPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHA+UGxlYXNlIHNlbGVjdCBhIGNvbmZpZ3VyYXRpb24gb3IgY3JlYXRlIGEgbmV3IG9uZTwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgYDtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHYyOiBmbGF0IHRvb2wgbGlzdCDigJQgbm8gY2F0ZWdvcmllc1xuICAgICAgICAgICAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgICAgICBjb25zdCB0b29sTGlzdERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgdG9vbExpc3REaXYuY2xhc3NOYW1lID0gJ3Rvb2wtbGlzdCc7XG5cbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZWRDb3VudCA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMuZmlsdGVyKCh0OiBhbnkpID0+IHQuZW5hYmxlZCkubGVuZ3RoO1xuICAgICAgICAgICAgY29uc3QgdG90YWxDb3VudCA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMubGVuZ3RoO1xuXG4gICAgICAgICAgICB0b29sTGlzdERpdi5pbm5lckhUTUwgPSBgXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImNhdGVnb3J5LWhlYWRlclwiPlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2F0ZWdvcnktbmFtZVwiPkFsbCBUb29sczwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY2F0ZWdvcnktdG9nZ2xlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj4ke2VuYWJsZWRDb3VudH0vJHt0b3RhbENvdW50fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgJHt0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLm1hcCgodG9vbDogYW55KSA9PiBgXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b29sLWl0ZW1cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b29sLWluZm9cIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidG9vbC1uYW1lXCI+JHt0b29sLm5hbWV9PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cInRvb2wtZGVzY3JpcHRpb25cIj4ke3Rvb2wuZGVzY3JpcHRpb259PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJ0b29sLXRvZ2dsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxpbnB1dCB0eXBlPVwiY2hlY2tib3hcIiBjbGFzcz1cImNoZWNrYm94IHRvb2wtY2hlY2tib3hcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhLW5hbWU9XCIke3Rvb2wubmFtZX1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAke3Rvb2wuZW5hYmxlZCA/ICdjaGVja2VkJyA6ICcnfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICBgKS5qb2luKCcnKX1cbiAgICAgICAgICAgIGA7XG5cbiAgICAgICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0b29sTGlzdERpdik7XG4gICAgICAgICAgICB0aGlzLmJpbmRUb29sRXZlbnRzKCk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYmluZFRvb2xFdmVudHModGhpczogYW55KSB7XG4gICAgICAgICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcudG9vbC1jaGVja2JveCcpLmZvckVhY2goKGNoZWNrYm94OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5hbWUgPSBlLnRhcmdldC5kYXRhc2V0Lm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSBlLnRhcmdldC5jaGVja2VkO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRvb2xTdGF0dXMobmFtZSwgZW5hYmxlZCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyB1cGRhdGVUb29sU3RhdHVzKHRoaXM6IGFueSwgbmFtZTogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcblxuICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0aW5nIHRvb2wgc3RhdHVzOiAke25hbWV9ID0gJHtlbmFibGVkfWApO1xuXG4gICAgICAgICAgICAvLyBVcGRhdGUgbG9jYWwgc3RhdGUgZmlyc3RcbiAgICAgICAgICAgIGNvbnN0IHRvb2wgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZpbmQoKHQ6IGFueSkgPT4gdC5uYW1lID09PSBuYW1lKTtcbiAgICAgICAgICAgIGlmICghdG9vbCkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFRvb2wgbm90IGZvdW5kOiAke25hbWV9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9IGVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0ZWQgbG9jYWwgdG9vbCBzdGF0ZTogJHt0b29sLm5hbWV9ID0gJHt0b29sLmVuYWJsZWR9YCk7XG5cbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgVUkgaW1tZWRpYXRlbHkgKG9ubHkgc3RhdHMsIG5vdCBmdWxsIHJlLXJlbmRlcilcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xuXG4gICAgICAgICAgICAgICAgLy8gU2VuZCB0byBiYWNrZW5kXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICd1cGRhdGVUb29sU3RhdHVzJywgbmFtZSwgZW5hYmxlZCk7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0JhY2tlbmQgcmVzcG9uc2U6JywgcmVzdWx0KTtcblxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gdXBkYXRlIHRvb2wgc3RhdHVzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIHVwZGF0ZSB0b29sIHN0YXR1cycpO1xuXG4gICAgICAgICAgICAgICAgLy8gUm9sbGJhY2sgbG9jYWwgc3RhdGUgaWYgYmFja2VuZCB1cGRhdGUgZmFpbGVkXG4gICAgICAgICAgICAgICAgdG9vbC5lbmFibGVkID0gIWVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVTdGF0dXNCYXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICB1cGRhdGVTdGF0dXNCYXIodGhpczogYW55KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHtcbiAgICAgICAgICAgICAgICB0aGlzLiQudG90YWxUb29sc0NvdW50LnRleHRDb250ZW50ID0gJzAnO1xuICAgICAgICAgICAgICAgIHRoaXMuJC5lbmFibGVkVG9vbHNDb3VudC50ZXh0Q29udGVudCA9ICcwJztcbiAgICAgICAgICAgICAgICB0aGlzLiQuZGlzYWJsZWRUb29sc0NvdW50LnRleHRDb250ZW50ID0gJzAnO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdG90YWwgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbnN0IGVuYWJsZWQgPSB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZpbHRlcigodDogYW55KSA9PiB0LmVuYWJsZWQpLmxlbmd0aDtcbiAgICAgICAgICAgIGNvbnN0IGRpc2FibGVkID0gdG90YWwgLSBlbmFibGVkO1xuXG4gICAgICAgICAgICB0aGlzLiQudG90YWxUb29sc0NvdW50LnRleHRDb250ZW50ID0gdG90YWwudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHRoaXMuJC5lbmFibGVkVG9vbHNDb3VudC50ZXh0Q29udGVudCA9IGVuYWJsZWQudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHRoaXMuJC5kaXNhYmxlZFRvb2xzQ291bnQudGV4dENvbnRlbnQgPSBkaXNhYmxlZC50b1N0cmluZygpO1xuICAgICAgICB9LFxuXG4gICAgICAgIHVwZGF0ZUJ1dHRvbnModGhpczogYW55KSB7XG4gICAgICAgICAgICBjb25zdCBoYXNDdXJyZW50Q29uZmlnID0gISF0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uO1xuICAgICAgICAgICAgdGhpcy4kLmVkaXRDb25maWdCdG4uZGlzYWJsZWQgPSAhaGFzQ3VycmVudENvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJC5kZWxldGVDb25maWdCdG4uZGlzYWJsZWQgPSAhaGFzQ3VycmVudENvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJC5leHBvcnRDb25maWdCdG4uZGlzYWJsZWQgPSAhaGFzQ3VycmVudENvbmZpZztcbiAgICAgICAgICAgIHRoaXMuJC5hcHBseUNvbmZpZ0J0bi5kaXNhYmxlZCA9ICFoYXNDdXJyZW50Q29uZmlnO1xuICAgICAgICB9LFxuXG4gICAgICAgIGFzeW5jIGNyZWF0ZUNvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XG4gICAgICAgICAgICB0aGlzLmVkaXRpbmdDb25maWcgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy4kLm1vZGFsVGl0bGUudGV4dENvbnRlbnQgPSAnTmV3IENvbmZpZ3VyYXRpb24nO1xuICAgICAgICAgICAgdGhpcy4kLmNvbmZpZ05hbWUudmFsdWUgPSAnJztcbiAgICAgICAgICAgIHRoaXMuJC5jb25maWdEZXNjcmlwdGlvbi52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgdGhpcy5zaG93TW9kYWwoJ2NvbmZpZ01vZGFsJyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgZWRpdENvbmZpZ3VyYXRpb24odGhpczogYW55KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24pIHJldHVybjtcblxuICAgICAgICAgICAgdGhpcy5lZGl0aW5nQ29uZmlnID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbjtcbiAgICAgICAgICAgIHRoaXMuJC5tb2RhbFRpdGxlLnRleHRDb250ZW50ID0gJ0VkaXQgQ29uZmlndXJhdGlvbic7XG4gICAgICAgICAgICB0aGlzLiQuY29uZmlnTmFtZS52YWx1ZSA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24ubmFtZTtcbiAgICAgICAgICAgIHRoaXMuJC5jb25maWdEZXNjcmlwdGlvbi52YWx1ZSA9IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uZGVzY3JpcHRpb24gfHwgJyc7XG4gICAgICAgICAgICB0aGlzLnNob3dNb2RhbCgnY29uZmlnTW9kYWwnKTtcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBzYXZlQ29uZmlndXJhdGlvbih0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLiQuY29uZmlnTmFtZS52YWx1ZS50cmltKCk7XG4gICAgICAgICAgICBjb25zdCBkZXNjcmlwdGlvbiA9IHRoaXMuJC5jb25maWdEZXNjcmlwdGlvbi52YWx1ZS50cmltKCk7XG5cbiAgICAgICAgICAgIGlmICghbmFtZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdDb25maWd1cmF0aW9uIG5hbWUgY2Fubm90IGJlIGVtcHR5Jyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmVkaXRpbmdDb25maWcpIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICd1cGRhdGVUb29sQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmVkaXRpbmdDb25maWcuaWQsIHsgbmFtZSwgZGVzY3JpcHRpb24gfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdjcmVhdGVUb29sQ29uZmlndXJhdGlvbicsIG5hbWUsIGRlc2NyaXB0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aGlzLmhpZGVNb2RhbCgnY29uZmlnTW9kYWwnKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRUb29sTWFuYWdlclN0YXRlKCk7XG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzYXZlIGNvbmZpZ3VyYXRpb246JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdGYWlsZWQgdG8gc2F2ZSBjb25maWd1cmF0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgZGVsZXRlQ29uZmlndXJhdGlvbih0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCBjb25maXJtZWQgPSBhd2FpdCBFZGl0b3IuRGlhbG9nLndhcm4oJ0NvbmZpcm0gRGVsZXRlJywge1xuICAgICAgICAgICAgICAgIGRldGFpbDogYEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgY29uZmlndXJhdGlvbiBcIiR7dGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5uYW1lfVwiPyBUaGlzIGFjdGlvbiBjYW5ub3QgYmUgdW5kb25lLmBcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoY29uZmlybWVkKSB7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdkZWxldGVUb29sQ29uZmlndXJhdGlvbicsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5sb2FkVG9vbE1hbmFnZXJTdGF0ZSgpO1xuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBkZWxldGUgY29uZmlndXJhdGlvbjonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdGYWlsZWQgdG8gZGVsZXRlIGNvbmZpZ3VyYXRpb24nKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgYXBwbHlDb25maWd1cmF0aW9uKHRoaXM6IGFueSkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnSWQgPSB0aGlzLiQuY29uZmlnU2VsZWN0b3IudmFsdWU7XG4gICAgICAgICAgICBpZiAoIWNvbmZpZ0lkKSByZXR1cm47XG5cbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnY29jb3MtbWNwLXNlcnZlcicsICdzZXRDdXJyZW50VG9vbENvbmZpZ3VyYXRpb24nLCBjb25maWdJZCk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5sb2FkVG9vbE1hbmFnZXJTdGF0ZSgpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gYXBwbHkgY29uZmlndXJhdGlvbjonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ0ZhaWxlZCB0byBhcHBseSBjb25maWd1cmF0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgZXhwb3J0Q29uZmlndXJhdGlvbih0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnZXhwb3J0VG9vbENvbmZpZ3VyYXRpb24nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLmlkKTtcblxuICAgICAgICAgICAgICAgIEVkaXRvci5DbGlwYm9hcmQud3JpdGUoJ3RleHQnLCByZXN1bHQuY29uZmlnSnNvbik7XG4gICAgICAgICAgICAgICAgRWRpdG9yLkRpYWxvZy5pbmZvKCdFeHBvcnQgU3VjY2Vzc2Z1bCcsIHsgZGV0YWlsOiAnQ29uZmlndXJhdGlvbiBjb3BpZWQgdG8gY2xpcGJvYXJkJyB9KTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGV4cG9ydCBjb25maWd1cmF0aW9uOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIGV4cG9ydCBjb25maWd1cmF0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgaW1wb3J0Q29uZmlndXJhdGlvbih0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIHRoaXMuJC5pbXBvcnRDb25maWdKc29uLnZhbHVlID0gJyc7XG4gICAgICAgICAgICB0aGlzLnNob3dNb2RhbCgnaW1wb3J0TW9kYWwnKTtcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBjb25maXJtSW1wb3J0KHRoaXM6IGFueSkge1xuICAgICAgICAgICAgY29uc3QgY29uZmlnSnNvbiA9IHRoaXMuJC5pbXBvcnRDb25maWdKc29uLnZhbHVlLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICghY29uZmlnSnNvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdQbGVhc2UgZW50ZXIgY29uZmlndXJhdGlvbiBKU09OJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAnaW1wb3J0VG9vbENvbmZpZ3VyYXRpb24nLCBjb25maWdKc29uKTtcbiAgICAgICAgICAgICAgICB0aGlzLmhpZGVNb2RhbCgnaW1wb3J0TW9kYWwnKTtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmxvYWRUb29sTWFuYWdlclN0YXRlKCk7XG4gICAgICAgICAgICAgICAgRWRpdG9yLkRpYWxvZy5pbmZvKCdJbXBvcnQgU3VjY2Vzc2Z1bCcsIHsgZGV0YWlsOiAnQ29uZmlndXJhdGlvbiBpbXBvcnRlZCBzdWNjZXNzZnVsbHknIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gaW1wb3J0IGNvbmZpZ3VyYXRpb246JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdGYWlsZWQgdG8gaW1wb3J0IGNvbmZpZ3VyYXRpb24nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBzZWxlY3RBbGxUb29scyh0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVzID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5tYXAoKHRvb2w6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgICAgICAgfSkpO1xuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBsb2NhbCBzdGF0ZSBmaXJzdFxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24udG9vbHMuZm9yRWFjaCgodG9vbDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRvb2wuZW5hYmxlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgVUkgaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9vbHNEaXNwbGF5KCk7XG5cbiAgICAgICAgICAgICAgICAvLyBTZW5kIHRvIGJhY2tlbmRcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ3VwZGF0ZVRvb2xTdGF0dXNCYXRjaCcsIHVwZGF0ZXMpO1xuXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBzZWxlY3QgYWxsIHRvb2xzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIHNlbGVjdCBhbGwgdG9vbHMnKTtcblxuICAgICAgICAgICAgICAgIC8vIFJvbGxiYWNrIG9uIGZhaWx1cmVcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZvckVhY2goKHRvb2w6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0b29sLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9vbHNEaXNwbGF5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgYXN5bmMgZGVzZWxlY3RBbGxUb29scyh0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVzID0gdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29scy5tYXAoKHRvb2w6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogZmFsc2VcbiAgICAgICAgICAgIH0pKTtcblxuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAvLyBVcGRhdGUgbG9jYWwgc3RhdGUgZmlyc3RcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZvckVhY2goKHRvb2w6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0b29sLmVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBVSSBpbW1lZGlhdGVseVxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sc0Rpc3BsYXkoKTtcblxuICAgICAgICAgICAgICAgIC8vIFNlbmQgdG8gYmFja2VuZFxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2NvY29zLW1jcC1zZXJ2ZXInLCAndXBkYXRlVG9vbFN0YXR1c0JhdGNoJywgdXBkYXRlcyk7XG5cbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGRlc2VsZWN0IGFsbCB0b29sczonLCBlcnJvcik7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93RXJyb3IoJ0ZhaWxlZCB0byBkZXNlbGVjdCBhbGwgdG9vbHMnKTtcblxuICAgICAgICAgICAgICAgIC8vIFJvbGxiYWNrIG9uIGZhaWx1cmVcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnRDb25maWd1cmF0aW9uLnRvb2xzLmZvckVhY2goKHRvb2w6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0b29sLmVuYWJsZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUb29sc0Rpc3BsYXkoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcblxuICAgICAgICBzaG93TW9kYWwodGhpczogYW55LCBtb2RhbElkOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuJFttb2RhbElkXS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgfSxcblxuICAgICAgICBoaWRlTW9kYWwodGhpczogYW55LCBtb2RhbElkOiBzdHJpbmcpIHtcbiAgICAgICAgICAgIHRoaXMuJFttb2RhbElkXS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9LFxuXG4gICAgICAgIHNob3dFcnJvcih0aGlzOiBhbnksIG1lc3NhZ2U6IHN0cmluZykge1xuICAgICAgICAgICAgRWRpdG9yLkRpYWxvZy5lcnJvcignRXJyb3InLCB7IGRldGFpbDogbWVzc2FnZSB9KTtcbiAgICAgICAgfSxcblxuICAgICAgICBhc3luYyBzYXZlQ2hhbmdlcyh0aGlzOiBhbnkpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbikge1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0Vycm9yKCdObyBjb25maWd1cmF0aW9uIHNlbGVjdGVkJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIC8vIFNhdmUgY3VycmVudCBjb25maWd1cmF0aW9uIHRvIGJhY2tlbmRcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdjb2Nvcy1tY3Atc2VydmVyJywgJ3VwZGF0ZVRvb2xDb25maWd1cmF0aW9uJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5pZCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRoaXMuY3VycmVudENvbmZpZ3VyYXRpb24uZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sczogdGhpcy5jdXJyZW50Q29uZmlndXJhdGlvbi50b29sc1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIEVkaXRvci5EaWFsb2cuaW5mbygnU2F2ZSBTdWNjZXNzZnVsJywgeyBkZXRhaWw6ICdDb25maWd1cmF0aW9uIGNoYW5nZXMgc2F2ZWQnIH0pO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSBjaGFuZ2VzOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dFcnJvcignRmFpbGVkIHRvIHNhdmUgY2hhbmdlcycpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIGJpbmRFdmVudHModGhpczogYW55KSB7XG4gICAgICAgICAgICB0aGlzLiQuY3JlYXRlQ29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5jcmVhdGVDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLmVkaXRDb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmVkaXRDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLmRlbGV0ZUNvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuZGVsZXRlQ29uZmlndXJhdGlvbi5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHRoaXMuJC5hcHBseUNvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuYXBwbHlDb25maWd1cmF0aW9uLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLmV4cG9ydENvbmZpZ0J0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMuZXhwb3J0Q29uZmlndXJhdGlvbi5iaW5kKHRoaXMpKTtcbiAgICAgICAgICAgIHRoaXMuJC5pbXBvcnRDb25maWdCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmltcG9ydENvbmZpZ3VyYXRpb24uYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIHRoaXMuJC5zZWxlY3RBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnNlbGVjdEFsbFRvb2xzLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLmRlc2VsZWN0QWxsQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5kZXNlbGVjdEFsbFRvb2xzLmJpbmQodGhpcykpO1xuICAgICAgICAgICAgdGhpcy4kLnNhdmVDaGFuZ2VzQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5zYXZlQ2hhbmdlcy5iaW5kKHRoaXMpKTtcblxuICAgICAgICAgICAgdGhpcy4kLmNsb3NlTW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVNb2RhbCgnY29uZmlnTW9kYWwnKSk7XG4gICAgICAgICAgICB0aGlzLiQuY2FuY2VsQ29uZmlnQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5oaWRlTW9kYWwoJ2NvbmZpZ01vZGFsJykpO1xuICAgICAgICAgICAgdGhpcy4kLmNvbmZpZ0Zvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgKGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNhdmVDb25maWd1cmF0aW9uKCk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgdGhpcy4kLmNsb3NlSW1wb3J0TW9kYWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhpZGVNb2RhbCgnaW1wb3J0TW9kYWwnKSk7XG4gICAgICAgICAgICB0aGlzLiQuY2FuY2VsSW1wb3J0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5oaWRlTW9kYWwoJ2ltcG9ydE1vZGFsJykpO1xuICAgICAgICAgICAgdGhpcy4kLmNvbmZpcm1JbXBvcnRCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLmNvbmZpcm1JbXBvcnQuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIHRoaXMuJC5jb25maWdTZWxlY3Rvci5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLmFwcGx5Q29uZmlndXJhdGlvbi5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVhZHkoKSB7XG4gICAgICAgICh0aGlzIGFzIGFueSkudG9vbE1hbmFnZXJTdGF0ZSA9IG51bGw7XG4gICAgICAgICh0aGlzIGFzIGFueSkuY3VycmVudENvbmZpZ3VyYXRpb24gPSBudWxsO1xuICAgICAgICAodGhpcyBhcyBhbnkpLmNvbmZpZ3VyYXRpb25zID0gW107XG4gICAgICAgICh0aGlzIGFzIGFueSkuYXZhaWxhYmxlVG9vbHMgPSBbXTtcbiAgICAgICAgKHRoaXMgYXMgYW55KS5lZGl0aW5nQ29uZmlnID0gbnVsbDtcblxuICAgICAgICAodGhpcyBhcyBhbnkpLmJpbmRFdmVudHMoKTtcbiAgICAgICAgKHRoaXMgYXMgYW55KS5sb2FkVG9vbE1hbmFnZXJTdGF0ZSgpO1xuICAgIH0sXG4gICAgYmVmb3JlQ2xvc2UoKSB7XG4gICAgICAgIC8vIENsZWFudXBcbiAgICB9LFxuICAgIGNsb3NlKCkge1xuICAgICAgICAvLyBQYW5lbCBjbG9zZSBjbGVhbnVwXG4gICAgfVxufSBhcyBhbnkpO1xuIl19