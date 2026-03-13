/**
 * PrefabCreationService: handles the complex logic of creating Cocos Creator prefab files
 * programmatically. Extracted from ManagePrefab to keep manage-prefab.ts under 200 lines.
 *
 * Responsibilities:
 * - Fetching node data with component info from the scene
 * - Serializing node trees into Cocos Creator prefab JSON format
 * - Saving and re-importing asset files via asset-db
 * - Linking scene nodes to newly created prefab assets
 */
export class PrefabCreationService {

    async createPrefabWithAssetDB(nodeUuid: string, savePath: string, prefabName: string, includeChildren: boolean, includeComponents: boolean): Promise<any> {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData) return { success: false, error: 'Cannot get node data' };

            const tempPrefabContent = JSON.stringify([{ "__type__": "cc.Prefab", "_name": prefabName }], null, 2);
            const createResult = await this.createAssetWithAssetDB(savePath, tempPrefabContent);
            if (!createResult.success) return createResult;

            const actualPrefabUuid = createResult.data?.uuid;
            if (!actualPrefabUuid) return { success: false, error: 'Cannot get engine-assigned prefab UUID' };

            const prefabContent = await this.createStandardPrefabContent(nodeData, prefabName, actualPrefabUuid, includeChildren, includeComponents);
            await this.updateAssetWithAssetDB(savePath, JSON.stringify(prefabContent, null, 2));
            await this.createMetaWithAssetDB(savePath, this.createStandardMetaContent(prefabName, actualPrefabUuid));
            await this.reimportAssetWithAssetDB(savePath);
            const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, actualPrefabUuid, savePath);

            return {
                success: true,
                data: {
                    prefabUuid: actualPrefabUuid, prefabPath: savePath, nodeUuid, prefabName,
                    convertedToPrefabInstance: convertResult.success,
                    message: convertResult.success ? 'Prefab created and node converted' : 'Prefab created, node conversion failed'
                }
            };
        } catch (error) {
            return { success: false, error: `Failed to create prefab: ${error}` };
        }
    }

    createPrefabNativeStub(): any {
        return {
            success: false,
            error: 'Native prefab creation API not available',
            instruction: 'To create a prefab in Cocos Creator:\n1. Select a node in the scene\n2. Drag it to the Asset Browser\n3. Or right-click the node and select "Create Prefab"'
        };
    }

    async createPrefabCustom(nodeUuid: string, prefabPath: string, prefabName: string): Promise<any> {
        try {
            const nodeData = await this.getNodeData(nodeUuid);
            if (!nodeData) return { success: false, error: `Node not found: ${nodeUuid}` };

            const prefabUuid = this.generateUUID();
            const prefabJsonData = await this.createStandardPrefabContent(nodeData, prefabName, prefabUuid, true, true);
            const saveResult = await this.savePrefabWithMeta(prefabPath, prefabJsonData, this.createStandardMetaContent(prefabName, prefabUuid));

            if (saveResult.success) {
                const convertResult = await this.convertNodeToPrefabInstance(nodeUuid, prefabPath, prefabUuid);
                return {
                    success: true,
                    data: {
                        prefabUuid, prefabPath, nodeUuid, prefabName,
                        convertedToPrefabInstance: convertResult.success,
                        message: convertResult.success ? 'Custom prefab created and node converted' : 'Prefab created, node conversion failed'
                    }
                };
            }
            return { success: false, error: saveResult.error || 'Failed to save prefab file' };
        } catch (error) {
            return { success: false, error: `Error creating prefab: ${error}` };
        }
    }

    // ===== Node data retrieval =====

    private async getNodeData(nodeUuid: string): Promise<any> {
        try {
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo) return null;
            return await this.getNodeWithChildren(nodeUuid) || nodeInfo;
        } catch {
            return null;
        }
    }

    private async getNodeWithChildren(nodeUuid: string): Promise<any> {
        try {
            const tree = await Editor.Message.request('scene', 'query-node-tree');
            if (!tree) return null;
            const targetNode = this.findNodeInTree(tree, nodeUuid);
            return targetNode ? await this.enhanceTreeWithMCPComponents(targetNode) : null;
        } catch {
            return null;
        }
    }

    /**
     * Enhance node tree with accurate component info via direct Editor API.
     * Replaces previous HTTP self-call to localhost:8585 which was fragile and port-dependent.
     */
    private async enhanceTreeWithMCPComponents(node: any): Promise<any> {
        if (!node || !node.uuid) return node;
        try {
            const nodeData = await Editor.Message.request('scene', 'query-node', node.uuid);
            if (nodeData && nodeData.__comps__) {
                node.components = nodeData.__comps__.map((comp: any) => ({
                    type: comp.__type__ || comp.cid || comp.type || 'Unknown',
                    uuid: comp.uuid?.value || comp.uuid || null,
                    enabled: comp.enabled !== undefined ? comp.enabled : true
                }));
                console.log(`Node ${node.uuid} enhanced with ${node.components.length} components (incl. script types)`);
            }
        } catch (error) {
            console.warn(`Failed to get component info for node ${node.uuid}:`, error);
        }
        if (node.children && Array.isArray(node.children)) {
            for (let i = 0; i < node.children.length; i++) {
                node.children[i] = await this.enhanceTreeWithMCPComponents(node.children[i]);
            }
        }
        return node;
    }

    private findNodeInTree(node: any, targetUuid: string): any {
        if (!node) return null;
        if (node.uuid === targetUuid || node.value?.uuid === targetUuid) return node;
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                const found = this.findNodeInTree(child, targetUuid);
                if (found) return found;
            }
        }
        return null;
    }

    private getChildrenToProcess(nodeData: any): any[] {
        const children: any[] = [];
        if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const child of nodeData.children) {
                if (this.isValidNodeData(child)) children.push(child);
            }
        }
        return children;
    }

    private isValidNodeData(nodeData: any): boolean {
        if (!nodeData || typeof nodeData !== 'object') return false;
        return nodeData.hasOwnProperty('uuid') || nodeData.hasOwnProperty('name') || nodeData.hasOwnProperty('__type__') ||
            (nodeData.value && (nodeData.value.hasOwnProperty('uuid') || nodeData.value.hasOwnProperty('name') || nodeData.value.hasOwnProperty('__type__')));
    }

    private extractNodeUuid(nodeData: any): string | null {
        if (!nodeData) return null;
        if (typeof nodeData.uuid === 'string') return nodeData.uuid;
        if (nodeData.value && typeof nodeData.value.uuid === 'string') return nodeData.value.uuid;
        return null;
    }

    // ===== Prefab serialization =====

    private async createStandardPrefabContent(nodeData: any, prefabName: string, prefabUuid: string, includeChildren: boolean, includeComponents: boolean): Promise<any[]> {
        const prefabData: any[] = [];
        prefabData.push({
            "__type__": "cc.Prefab", "_name": prefabName || "", "_objFlags": 0, "__editorExtras__": {},
            "_native": "", "data": { "__id__": 1 }, "optimizationPolicy": 0, "persistent": false
        });

        const context = {
            prefabData, currentId: 2, prefabAssetIndex: 0,
            nodeFileIds: new Map<string, string>(),
            nodeUuidToIndex: new Map<string, number>(),
            componentUuidToIndex: new Map<string, number>()
        };

        await this.createCompleteNodeTree(nodeData, null, 1, context, includeChildren, includeComponents, prefabName);
        return prefabData;
    }

    private async createCompleteNodeTree(
        nodeData: any, parentNodeIndex: number | null, nodeIndex: number,
        context: { prefabData: any[]; currentId: number; prefabAssetIndex: number; nodeFileIds: Map<string, string>; nodeUuidToIndex: Map<string, number>; componentUuidToIndex: Map<string, number> },
        includeChildren: boolean, includeComponents: boolean, nodeName?: string
    ): Promise<void> {
        const { prefabData } = context;
        const node = this.createEngineStandardNode(nodeData, parentNodeIndex, nodeName);

        while (prefabData.length <= nodeIndex) prefabData.push(null);
        prefabData[nodeIndex] = node;

        const nodeUuid = this.extractNodeUuid(nodeData);
        const fileId = nodeUuid || this.generateFileId();
        context.nodeFileIds.set(nodeIndex.toString(), fileId);
        if (nodeUuid) context.nodeUuidToIndex.set(nodeUuid, nodeIndex);

        const childrenToProcess = this.getChildrenToProcess(nodeData);
        if (includeChildren && childrenToProcess.length > 0) {
            const childIndices: number[] = [];
            for (let i = 0; i < childrenToProcess.length; i++) {
                const childIndex = context.currentId++;
                childIndices.push(childIndex);
                node._children.push({ "__id__": childIndex });
            }
            for (let i = 0; i < childrenToProcess.length; i++) {
                await this.createCompleteNodeTree(
                    childrenToProcess[i], nodeIndex, childIndices[i], context,
                    includeChildren, includeComponents, childrenToProcess[i].name || `Child${i + 1}`
                );
            }
        }

        if (includeComponents && nodeData.components && Array.isArray(nodeData.components)) {
            for (const component of nodeData.components) {
                const componentIndex = context.currentId++;
                node._components.push({ "__id__": componentIndex });
                const componentUuid = component.uuid || (component.value && component.value.uuid);
                if (componentUuid) context.componentUuidToIndex.set(componentUuid, componentIndex);
                const componentObj = this.createComponentObject(component, nodeIndex, context);
                prefabData[componentIndex] = componentObj;
                const compPrefabInfoIndex = context.currentId++;
                prefabData[compPrefabInfoIndex] = { "__type__": "cc.CompPrefabInfo", "fileId": this.generateFileId() };
                if (componentObj && typeof componentObj === 'object') componentObj.__prefab = { "__id__": compPrefabInfoIndex };
            }
        }

        const prefabInfoIndex = context.currentId++;
        node._prefab = { "__id__": prefabInfoIndex };
        prefabData[prefabInfoIndex] = {
            "__type__": "cc.PrefabInfo", "root": { "__id__": 1 }, "asset": { "__id__": context.prefabAssetIndex },
            "fileId": fileId, "targetOverrides": null, "nestedPrefabInstanceRoots": null, "instance": null
        };
        context.currentId = prefabInfoIndex + 1;
    }

    private createEngineStandardNode(nodeData: any, parentNodeIndex: number | null, nodeName?: string): any {
        const name = nodeName || nodeData.name?.value || nodeData.name || 'Node';
        const lpos = nodeData.position?.value || nodeData.lpos?.value || nodeData._lpos || { x: 0, y: 0, z: 0 };
        const lrot = nodeData.rotation?.value || nodeData.lrot?.value || nodeData._lrot || { x: 0, y: 0, z: 0, w: 1 };
        const lscale = nodeData.scale?.value || nodeData.lscale?.value || nodeData._lscale || { x: 1, y: 1, z: 1 };
        return {
            "__type__": "cc.Node", "_name": name, "_objFlags": 0, "__editorExtras__": {},
            "_parent": parentNodeIndex !== null ? { "__id__": parentNodeIndex } : null,
            "_children": [], "_active": nodeData.active !== false, "_components": [], "_prefab": null,
            "_lpos": { "__type__": "cc.Vec3", "x": lpos.x || 0, "y": lpos.y || 0, "z": lpos.z || 0 },
            "_lrot": { "__type__": "cc.Quat", "x": lrot.x || 0, "y": lrot.y || 0, "z": lrot.z || 0, "w": lrot.w !== undefined ? lrot.w : 1 },
            "_lscale": { "__type__": "cc.Vec3", "x": lscale.x !== undefined ? lscale.x : 1, "y": lscale.y !== undefined ? lscale.y : 1, "z": lscale.z !== undefined ? lscale.z : 1 },
            "_mobility": 0, "_layer": 1073741824, "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 }, "_id": ""
        };
    }

    private createComponentObject(componentData: any, nodeIndex: number, context?: any): any {
        const componentType = componentData.type || componentData.__type__ || 'cc.Component';
        const enabled = componentData.enabled !== undefined ? componentData.enabled : true;
        const component: any = {
            "__type__": componentType, "_name": "", "_objFlags": 0, "__editorExtras__": {},
            "node": { "__id__": nodeIndex }, "_enabled": enabled, "__prefab": null
        };

        if (componentType === 'cc.UITransform') {
            const contentSize = componentData.properties?.contentSize?.value || { width: 100, height: 100 };
            const anchorPoint = componentData.properties?.anchorPoint?.value || { x: 0.5, y: 0.5 };
            component._contentSize = { "__type__": "cc.Size", "width": contentSize.width, "height": contentSize.height };
            component._anchorPoint = { "__type__": "cc.Vec2", "x": anchorPoint.x, "y": anchorPoint.y };
        } else if (componentType === 'cc.Sprite') {
            const spriteFrameProp = componentData.properties?._spriteFrame || componentData.properties?.spriteFrame;
            component._spriteFrame = spriteFrameProp ? this.processComponentProperty(spriteFrameProp, context) : null;
            component._type = componentData.properties?._type?.value ?? 0;
            component._fillType = componentData.properties?._fillType?.value ?? 0;
            component._sizeMode = componentData.properties?._sizeMode?.value ?? 1;
            component._fillCenter = { "__type__": "cc.Vec2", "x": 0, "y": 0 };
            component._fillStart = componentData.properties?._fillStart?.value ?? 0;
            component._fillRange = componentData.properties?._fillRange?.value ?? 0;
            component._isTrimmedMode = componentData.properties?._isTrimmedMode?.value ?? true;
            component._useGrayscale = componentData.properties?._useGrayscale?.value ?? false;
            component._atlas = null; component._id = "";
        } else if (componentType === 'cc.Button') {
            component._interactable = true; component._transition = 3;
            component._normalColor = { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 };
            component._hoverColor = { "__type__": "cc.Color", "r": 211, "g": 211, "b": 211, "a": 255 };
            component._pressedColor = { "__type__": "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 };
            component._disabledColor = { "__type__": "cc.Color", "r": 124, "g": 124, "b": 124, "a": 255 };
            component._normalSprite = null; component._hoverSprite = null;
            component._pressedSprite = null; component._disabledSprite = null;
            component._duration = 0.1; component._zoomScale = 1.2;
            const targetProp = componentData.properties?._target || componentData.properties?.target;
            component._target = targetProp ? this.processComponentProperty(targetProp, context) : { "__id__": nodeIndex };
            component._clickEvents = []; component._id = "";
        } else if (componentType === 'cc.Label') {
            component._string = componentData.properties?._string?.value || "Label";
            component._horizontalAlign = 1; component._verticalAlign = 1;
            component._actualFontSize = 20; component._fontSize = 20; component._fontFamily = "Arial";
            component._lineHeight = 25; component._overflow = 0; component._enableWrapText = true;
            component._font = null; component._isSystemFontUsed = true; component._spacingX = 0;
            component._isItalic = false; component._isBold = false; component._isUnderline = false;
            component._underlineHeight = 2; component._cacheMode = 0; component._id = "";
        } else if (componentData.properties) {
            for (const [key, value] of Object.entries(componentData.properties)) {
                if (['node', 'enabled', '__type__', 'uuid', 'name', '__scriptAsset', '_objFlags'].includes(key)) continue;
                const propValue = this.processComponentProperty(value, context);
                if (propValue !== undefined) component[key] = propValue;
            }
        }

        // Ensure _id is last (matches engine serialization order)
        const _id = component._id || "";
        delete component._id;
        component._id = _id;
        return component;
    }

    /**
     * Process component property values, ensuring format matches manually-created prefabs.
     * Handles node refs, asset refs, component refs, typed math/color objects, and arrays.
     */
    private processComponentProperty(propData: any, context?: {
        nodeUuidToIndex?: Map<string, number>;
        componentUuidToIndex?: Map<string, number>;
    }): any {
        if (!propData || typeof propData !== 'object') return propData;
        const value = propData.value;
        const type = propData.type;
        if (value === null || value === undefined) return null;
        if (value && typeof value === 'object' && value.uuid === '') return null;

        // Node references
        if (type === 'cc.Node' && value?.uuid) {
            if (context?.nodeUuidToIndex?.has(value.uuid)) return { "__id__": context.nodeUuidToIndex.get(value.uuid) };
            console.warn(`Node ref UUID ${value.uuid} not in prefab context (external), setting null`);
            return null;
        }

        // Asset references
        if (value?.uuid && ['cc.Prefab', 'cc.Texture2D', 'cc.SpriteFrame', 'cc.Material', 'cc.AnimationClip', 'cc.AudioClip', 'cc.Font', 'cc.Asset'].includes(type)) {
            const uuidToUse = type === 'cc.Prefab' ? value.uuid : this.uuidToCompressedId(value.uuid);
            return { "__uuid__": uuidToUse, "__expectedType__": type };
        }

        // Component references
        if (value?.uuid && (type === 'cc.Component' || type === 'cc.Label' || type === 'cc.Button' || type === 'cc.Sprite' ||
            type === 'cc.UITransform' || type === 'cc.RigidBody2D' || type === 'cc.BoxCollider2D' ||
            type === 'cc.Animation' || type === 'cc.AudioSource' || (type?.startsWith('cc.') && !type.includes('@')))) {
            if (context?.componentUuidToIndex?.has(value.uuid)) return { "__id__": context.componentUuidToIndex.get(value.uuid) };
            console.warn(`Component ref ${type} UUID ${value.uuid} not in prefab context (external), setting null`);
            return null;
        }

        // Typed math/color objects
        if (value && typeof value === 'object') {
            if (type === 'cc.Color') return { "__type__": "cc.Color", "r": Math.min(255, Math.max(0, Number(value.r) || 0)), "g": Math.min(255, Math.max(0, Number(value.g) || 0)), "b": Math.min(255, Math.max(0, Number(value.b) || 0)), "a": value.a !== undefined ? Math.min(255, Math.max(0, Number(value.a))) : 255 };
            if (type === 'cc.Vec3') return { "__type__": "cc.Vec3", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0 };
            if (type === 'cc.Vec2') return { "__type__": "cc.Vec2", "x": Number(value.x) || 0, "y": Number(value.y) || 0 };
            if (type === 'cc.Size') return { "__type__": "cc.Size", "width": Number(value.width) || 0, "height": Number(value.height) || 0 };
            if (type === 'cc.Quat') return { "__type__": "cc.Quat", "x": Number(value.x) || 0, "y": Number(value.y) || 0, "z": Number(value.z) || 0, "w": value.w !== undefined ? Number(value.w) : 1 };
        }

        // Array properties
        if (Array.isArray(value)) {
            if (propData.elementTypeData?.type === 'cc.Node') {
                return value.map((item: any) => {
                    if (item?.uuid && context?.nodeUuidToIndex?.has(item.uuid)) return { "__id__": context.nodeUuidToIndex.get(item.uuid) };
                    return null;
                }).filter(Boolean);
            }
            if (propData.elementTypeData?.type?.startsWith('cc.')) {
                return value.map((item: any) => item?.uuid ? { "__uuid__": this.uuidToCompressedId(item.uuid), "__expectedType__": propData.elementTypeData.type } : null).filter(Boolean);
            }
            return value.map((item: any) => item?.value !== undefined ? item.value : item);
        }

        // Other complex typed objects
        if (value && typeof value === 'object' && type?.startsWith('cc.')) return { "__type__": type, ...value };
        return value;
    }

    // ===== Asset DB operations =====

    private async convertNodeToPrefabInstance(nodeUuid: string, prefabRef: string, prefabUuid: string): Promise<any> {
        const methods = [
            () => Editor.Message.request('scene', 'connect-prefab-instance', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'set-prefab-connection', { node: nodeUuid, prefab: prefabRef }),
            () => Editor.Message.request('scene', 'apply-prefab-link', { node: nodeUuid, prefab: prefabRef })
        ];
        for (const method of methods) {
            try { await method(); return { success: true }; } catch { /* try next */ }
        }
        return { success: false, error: 'All prefab connection methods failed' };
    }

    private async savePrefabWithMeta(prefabPath: string, prefabData: any[], metaData: any): Promise<any> {
        try {
            await this.saveAssetFile(prefabPath, JSON.stringify(prefabData, null, 2));
            await this.saveAssetFile(`${prefabPath}.meta`, JSON.stringify(metaData, null, 2));
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to save prefab file' };
        }
    }

    private async saveAssetFile(filePath: string, content: string): Promise<void> {
        const methods = [
            () => Editor.Message.request('asset-db', 'create-asset', filePath, content),
            () => Editor.Message.request('asset-db', 'save-asset', filePath, content),
            () => Editor.Message.request('asset-db', 'write-asset', filePath, content)
        ];
        for (const method of methods) {
            try { await method(); return; } catch { /* try next */ }
        }
        throw new Error('All save methods failed');
    }

    private async createAssetWithAssetDB(assetPath: string, content: string): Promise<any> {
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'create-asset', assetPath, content, { overwrite: true, rename: false });
            return { success: true, data: assetInfo };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create asset file' };
        }
    }

    private async createMetaWithAssetDB(assetPath: string, metaContent: any): Promise<any> {
        try {
            const assetInfo: any = await Editor.Message.request('asset-db', 'save-asset-meta', assetPath, JSON.stringify(metaContent, null, 2));
            return { success: true, data: assetInfo };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to create meta file' };
        }
    }

    private async reimportAssetWithAssetDB(assetPath: string): Promise<any> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'reimport-asset', assetPath);
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to reimport asset' };
        }
    }

    private async updateAssetWithAssetDB(assetPath: string, content: string): Promise<any> {
        try {
            const result: any = await Editor.Message.request('asset-db', 'save-asset', assetPath, content);
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, error: error.message || 'Failed to update asset file' };
        }
    }

    // ===== Format validation =====

    validatePrefabFormat(prefabData: any): { isValid: boolean; issues: string[]; nodeCount: number; componentCount: number } {
        const issues: string[] = [];
        let nodeCount = 0;
        let componentCount = 0;
        if (!Array.isArray(prefabData)) {
            issues.push('Prefab data must be an array');
            return { isValid: false, issues, nodeCount, componentCount };
        }
        if (prefabData.length === 0) {
            issues.push('Prefab data is empty');
            return { isValid: false, issues, nodeCount, componentCount };
        }
        if (!prefabData[0] || prefabData[0].__type__ !== 'cc.Prefab') {
            issues.push('First element must be cc.Prefab type');
        }
        prefabData.forEach((item: any) => {
            if (item.__type__ === 'cc.Node') nodeCount++;
            else if (item.__type__ && item.__type__.includes('cc.')) componentCount++;
        });
        if (nodeCount === 0) issues.push('Prefab must contain at least one node');
        return { isValid: issues.length === 0, issues, nodeCount, componentCount };
    }

    createStandardMetaContent(prefabName: string, prefabUuid: string): any {
        return { "ver": "1.1.50", "importer": "prefab", "imported": true, "uuid": prefabUuid, "files": [".json"], "subMetas": {}, "userData": { "syncNodeName": prefabName } };
    }

    // ===== UUID utilities =====

    private generateUUID(): string {
        const chars = '0123456789abcdef';
        let uuid = '';
        for (let i = 0; i < 32; i++) {
            if (i === 8 || i === 12 || i === 16 || i === 20) uuid += '-';
            uuid += chars[Math.floor(Math.random() * chars.length)];
        }
        return uuid;
    }

    private generateFileId(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/';
        let fileId = '';
        for (let i = 0; i < 22; i++) fileId += chars[Math.floor(Math.random() * chars.length)];
        return fileId;
    }

    /**
     * Convert UUID to Cocos Creator compressed format.
     * First 5 hex chars kept as-is; remaining 27 chars compressed to 18 via base64 encoding.
     */
    private uuidToCompressedId(uuid: string): string {
        const BASE64_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        const cleanUuid = uuid.replace(/-/g, '').toLowerCase();
        if (cleanUuid.length !== 32) return uuid;
        let result = cleanUuid.substring(0, 5);
        const remainder = cleanUuid.substring(5);
        for (let i = 0; i < remainder.length; i += 3) {
            const value = parseInt((remainder[i] || '0') + (remainder[i + 1] || '0') + (remainder[i + 2] || '0'), 16);
            result += BASE64_KEYS[(value >> 6) & 63] + BASE64_KEYS[value & 63];
        }
        return result;
    }
}
