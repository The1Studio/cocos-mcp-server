import { readFileSync } from 'fs-extra';
import { join } from 'path';

module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('Tool Manager panel shown'); },
        hide() { console.log('Tool Manager panel hidden'); }
    },
    template: readFileSync(join(__dirname, '../../../static/template/default/tool-manager.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/default/index.css'), 'utf-8'),
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
        async loadToolManagerState(this: any) {
            try {
                this.toolManagerState = await Editor.Message.request('cocos-mcp-server', 'getToolManagerState');
                this.currentConfiguration = this.toolManagerState.configurations.find(
                    (c: any) => c.id === this.toolManagerState.selectedConfigId
                ) || null;
                this.configurations = this.toolManagerState.configurations;
                this.availableTools = this.toolManagerState.availableTools;
                this.updateUI();
            } catch (error) {
                console.error('Failed to load tool manager state:', error);
                this.showError('Failed to load tool manager state');
            }
        },

        updateUI(this: any) {
            this.updateConfigSelector();
            this.updateToolsDisplay();
            this.updateStatusBar();
            this.updateButtons();
        },

        updateConfigSelector(this: any) {
            const selector = this.$.configSelector;
            selector.innerHTML = '<option value="">Select configuration...</option>';

            this.configurations.forEach((config: any) => {
                const option = document.createElement('option');
                option.value = config.id;
                option.textContent = config.name;
                if (this.currentConfiguration && config.id === this.currentConfiguration.id) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });
        },

        updateToolsDisplay(this: any) {
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

            const enabledCount = this.currentConfiguration.tools.filter((t: any) => t.enabled).length;
            const totalCount = this.currentConfiguration.tools.length;

            toolListDiv.innerHTML = `
                <div class="category-header">
                    <div class="category-name">All Tools</div>
                    <div class="category-toggle">
                        <span>${enabledCount}/${totalCount}</span>
                    </div>
                </div>
                ${this.currentConfiguration.tools.map((tool: any) => `
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

        bindToolEvents(this: any) {
            document.querySelectorAll('.tool-checkbox').forEach((checkbox: any) => {
                checkbox.addEventListener('change', (e: any) => {
                    const name = e.target.dataset.name;
                    const enabled = e.target.checked;
                    this.updateToolStatus(name, enabled);
                });
            });
        },

        async updateToolStatus(this: any, name: string, enabled: boolean) {
            if (!this.currentConfiguration) return;

            console.log(`Updating tool status: ${name} = ${enabled}`);

            // Update local state first
            const tool = this.currentConfiguration.tools.find((t: any) => t.name === name);
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

            } catch (error) {
                console.error('Failed to update tool status:', error);
                this.showError('Failed to update tool status');

                // Rollback local state if backend update failed
                tool.enabled = !enabled;
                this.updateStatusBar();
            }
        },

        updateStatusBar(this: any) {
            if (!this.currentConfiguration) {
                this.$.totalToolsCount.textContent = '0';
                this.$.enabledToolsCount.textContent = '0';
                this.$.disabledToolsCount.textContent = '0';
                return;
            }

            const total = this.currentConfiguration.tools.length;
            const enabled = this.currentConfiguration.tools.filter((t: any) => t.enabled).length;
            const disabled = total - enabled;

            this.$.totalToolsCount.textContent = total.toString();
            this.$.enabledToolsCount.textContent = enabled.toString();
            this.$.disabledToolsCount.textContent = disabled.toString();
        },

        updateButtons(this: any) {
            const hasCurrentConfig = !!this.currentConfiguration;
            this.$.editConfigBtn.disabled = !hasCurrentConfig;
            this.$.deleteConfigBtn.disabled = !hasCurrentConfig;
            this.$.exportConfigBtn.disabled = !hasCurrentConfig;
            this.$.applyConfigBtn.disabled = !hasCurrentConfig;
        },

        async createConfiguration(this: any) {
            this.editingConfig = null;
            this.$.modalTitle.textContent = 'New Configuration';
            this.$.configName.value = '';
            this.$.configDescription.value = '';
            this.showModal('configModal');
        },

        async editConfiguration(this: any) {
            if (!this.currentConfiguration) return;

            this.editingConfig = this.currentConfiguration;
            this.$.modalTitle.textContent = 'Edit Configuration';
            this.$.configName.value = this.currentConfiguration.name;
            this.$.configDescription.value = this.currentConfiguration.description || '';
            this.showModal('configModal');
        },

        async saveConfiguration(this: any) {
            const name = this.$.configName.value.trim();
            const description = this.$.configDescription.value.trim();

            if (!name) {
                this.showError('Configuration name cannot be empty');
                return;
            }

            try {
                if (this.editingConfig) {
                    await Editor.Message.request('cocos-mcp-server', 'updateToolConfiguration',
                        this.editingConfig.id, { name, description });
                } else {
                    await Editor.Message.request('cocos-mcp-server', 'createToolConfiguration', name, description);
                }

                this.hideModal('configModal');
                await this.loadToolManagerState();
            } catch (error) {
                console.error('Failed to save configuration:', error);
                this.showError('Failed to save configuration');
            }
        },

        async deleteConfiguration(this: any) {
            if (!this.currentConfiguration) return;

            const confirmed = await Editor.Dialog.warn('Confirm Delete', {
                detail: `Are you sure you want to delete configuration "${this.currentConfiguration.name}"? This action cannot be undone.`
            });

            if (confirmed) {
                try {
                    await Editor.Message.request('cocos-mcp-server', 'deleteToolConfiguration',
                        this.currentConfiguration.id);
                    await this.loadToolManagerState();
                } catch (error) {
                    console.error('Failed to delete configuration:', error);
                    this.showError('Failed to delete configuration');
                }
            }
        },

        async applyConfiguration(this: any) {
            const configId = this.$.configSelector.value;
            if (!configId) return;

            try {
                await Editor.Message.request('cocos-mcp-server', 'setCurrentToolConfiguration', configId);
                await this.loadToolManagerState();
            } catch (error) {
                console.error('Failed to apply configuration:', error);
                this.showError('Failed to apply configuration');
            }
        },

        async exportConfiguration(this: any) {
            if (!this.currentConfiguration) return;

            try {
                const result = await Editor.Message.request('cocos-mcp-server', 'exportToolConfiguration',
                    this.currentConfiguration.id);

                Editor.Clipboard.write('text', result.configJson);
                Editor.Dialog.info('Export Successful', { detail: 'Configuration copied to clipboard' });
            } catch (error) {
                console.error('Failed to export configuration:', error);
                this.showError('Failed to export configuration');
            }
        },

        async importConfiguration(this: any) {
            this.$.importConfigJson.value = '';
            this.showModal('importModal');
        },

        async confirmImport(this: any) {
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
            } catch (error) {
                console.error('Failed to import configuration:', error);
                this.showError('Failed to import configuration');
            }
        },

        async selectAllTools(this: any) {
            if (!this.currentConfiguration) return;

            const updates = this.currentConfiguration.tools.map((tool: any) => ({
                name: tool.name,
                enabled: true
            }));

            try {
                // Update local state first
                this.currentConfiguration.tools.forEach((tool: any) => {
                    tool.enabled = true;
                });

                // Update UI immediately
                this.updateStatusBar();
                this.updateToolsDisplay();

                // Send to backend
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', updates);

            } catch (error) {
                console.error('Failed to select all tools:', error);
                this.showError('Failed to select all tools');

                // Rollback on failure
                this.currentConfiguration.tools.forEach((tool: any) => {
                    tool.enabled = false;
                });
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },

        async deselectAllTools(this: any) {
            if (!this.currentConfiguration) return;

            const updates = this.currentConfiguration.tools.map((tool: any) => ({
                name: tool.name,
                enabled: false
            }));

            try {
                // Update local state first
                this.currentConfiguration.tools.forEach((tool: any) => {
                    tool.enabled = false;
                });

                // Update UI immediately
                this.updateStatusBar();
                this.updateToolsDisplay();

                // Send to backend
                await Editor.Message.request('cocos-mcp-server', 'updateToolStatusBatch', updates);

            } catch (error) {
                console.error('Failed to deselect all tools:', error);
                this.showError('Failed to deselect all tools');

                // Rollback on failure
                this.currentConfiguration.tools.forEach((tool: any) => {
                    tool.enabled = true;
                });
                this.updateStatusBar();
                this.updateToolsDisplay();
            }
        },

        showModal(this: any, modalId: string) {
            this.$[modalId].style.display = 'block';
        },

        hideModal(this: any, modalId: string) {
            this.$[modalId].style.display = 'none';
        },

        showError(this: any, message: string) {
            Editor.Dialog.error('Error', { detail: message });
        },

        async saveChanges(this: any) {
            if (!this.currentConfiguration) {
                this.showError('No configuration selected');
                return;
            }

            try {
                // Save current configuration to backend
                await Editor.Message.request('cocos-mcp-server', 'updateToolConfiguration',
                    this.currentConfiguration.id, {
                        name: this.currentConfiguration.name,
                        description: this.currentConfiguration.description,
                        tools: this.currentConfiguration.tools
                    });

                Editor.Dialog.info('Save Successful', { detail: 'Configuration changes saved' });
            } catch (error) {
                console.error('Failed to save changes:', error);
                this.showError('Failed to save changes');
            }
        },

        bindEvents(this: any) {
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
            this.$.configForm.addEventListener('submit', (e: any) => {
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
        (this as any).toolManagerState = null;
        (this as any).currentConfiguration = null;
        (this as any).configurations = [];
        (this as any).availableTools = [];
        (this as any).editingConfig = null;

        (this as any).bindEvents();
        (this as any).loadToolManagerState();
    },
    beforeClose() {
        // Cleanup
    },
    close() {
        // Panel close cleanup
    }
} as any);
