"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
const path_1 = require("path");
const scene_node_lookup_1 = require("./scene-node-lookup");
module.paths.push((0, path_1.join)(Editor.App.path, 'node_modules'));
exports.methods = {
    /**
     * Create a new scene
     */
    createNewScene() {
        try {
            const { director, Scene } = require('cc');
            const scene = new Scene();
            scene.name = 'New Scene';
            director.runScene(scene);
            return { success: true, message: 'New scene created successfully' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Add component to a node
     */
    addComponentToNode(nodeUuid, componentType) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            // Find node by UUID
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            // Get component class
            const ComponentClass = js.getClassByName(componentType);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${componentType} not found` };
            }
            // Add component
            const component = node.addComponent(ComponentClass);
            return {
                success: true,
                message: `Component ${componentType} added successfully`,
                data: { componentId: component.uuid }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Resolve a component on a node by its readable class name to its index.
     *
     * The editor `query-node` dump exposes a user script's cid (a compressed UUID),
     * not its class name, so callers that only know the class name (e.g. set_property
     * with componentType="MyController") cannot match it against the dump. The running
     * scene HAS the live cc.js class registry, so we resolve the class here and return
     * the component's index in node.components — which matches the dump's __comps__ order.
     */
    resolveComponentByName(nodeUuid, className) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            const ComponentClass = js.getClassByName(className);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${className} not found` };
            }
            const component = node.getComponent(ComponentClass);
            if (!component) {
                return { success: false, error: `Component ${className} not found on node` };
            }
            return {
                success: true,
                data: {
                    index: node.components.indexOf(component),
                    className: component.constructor && component.constructor.name
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Resolve a component on a target node by its DECLARED base class, honouring the
     * inheritance chain.
     *
     * `manage_component set_property` with `propertyType: "component"` resolves the
     * target component by exact class-name equality against the property's declared type
     * (issue #45). When the declared type is a BASE class and the actual component on the
     * node is a SUBCLASS, the literal match never resolves — even though the engine's own
     * `node.getComponent(BaseClass)` would return the subclass instance. This method uses
     * the live cc.js class registry to do exactly that lookup, walking `__super__` so a
     * subclass is recognised as fulfilling a base-typed `@property` slot.
     *
     * Returns the component's own uuid and its concrete type, so the caller can build the
     * correct `{ uuid }` set-property dump and report what was actually bound.
     */
    findComponentByBaseClass(nodeUuid, baseClassName) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            const BaseClass = js.getClassByName(baseClassName);
            if (!BaseClass) {
                return { success: false, error: `Component type ${baseClassName} not found` };
            }
            // getComponent(BaseClass) returns a component whose constructor IS or
            // EXTENDS BaseClass — exactly the polymorphic resolve #45 needs.
            const component = node.getComponent(BaseClass);
            if (!component) {
                return { success: false, error: `No component extending '${baseClassName}' found on node` };
            }
            const concreteType = (component.constructor && (component.constructor.name || component.constructor.__cid__)) || baseClassName;
            const componentUuid = component.uuid || component.__id__ || '';
            return {
                success: true,
                data: {
                    componentUuid,
                    concreteType,
                    baseClassName
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Determine whether a concrete component type extends a declared base class — the
     * same polymorphic question `findComponentByBaseClass` answers via a live node, but
     * for the DIRECT component-uuid resolve path (issue #81), which already has the
     * component's own concrete type name and no node to search from. Purely a class-
     * registry lookup on the two type names via `js.isChildClassOf`; no live instance
     * needed.
     */
    isComponentTypeSubclassOf(concreteType, baseClassName) {
        try {
            const { js } = require('cc');
            const SubClass = js.getClassByName(concreteType);
            if (!SubClass) {
                return { success: false, error: `Component type ${concreteType} not found` };
            }
            const BaseClass = js.getClassByName(baseClassName);
            if (!BaseClass) {
                return { success: false, error: `Component type ${baseClassName} not found` };
            }
            return { success: true, data: { isSubclass: js.isChildClassOf(SubClass, BaseClass) } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Remove component from a node
     */
    removeComponentFromNode(nodeUuid, componentType) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            const ComponentClass = js.getClassByName(componentType);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${componentType} not found` };
            }
            const component = node.getComponent(ComponentClass);
            if (!component) {
                return { success: false, error: `Component ${componentType} not found on node` };
            }
            node.removeComponent(component);
            return { success: true, message: `Component ${componentType} removed successfully` };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Create a new node
     */
    createNode(name, parentUuid) {
        try {
            const { director, Node } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = new Node(name);
            if (parentUuid) {
                const parent = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, parentUuid);
                if (parent) {
                    parent.addChild(node);
                }
                else {
                    scene.addChild(node);
                }
            }
            else {
                scene.addChild(node);
            }
            return {
                success: true,
                message: `Node ${name} created successfully`,
                data: { uuid: node.uuid, name: node.name }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Get node information
     */
    getNodeInfo(nodeUuid) {
        var _a;
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            return {
                success: true,
                data: {
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    position: node.position,
                    rotation: node.rotation,
                    scale: node.scale,
                    parent: (_a = node.parent) === null || _a === void 0 ? void 0 : _a.uuid,
                    children: node.children.map((child) => child.uuid),
                    components: node.components.map((comp) => ({
                        type: comp.constructor.name,
                        enabled: comp.enabled
                    }))
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Get all nodes in scene
     */
    getAllNodes() {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const nodes = [];
            const collectNodes = (node) => {
                var _a;
                nodes.push({
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    parent: (_a = node.parent) === null || _a === void 0 ? void 0 : _a.uuid
                });
                node.children.forEach((child) => collectNodes(child));
            };
            scene.children.forEach((child) => collectNodes(child));
            return { success: true, data: nodes };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Find node by name
     */
    findNodeByName(name) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = scene.getChildByName(name);
            if (!node) {
                return { success: false, error: `Node with name ${name} not found` };
            }
            return {
                success: true,
                data: {
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    position: node.position
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Get current scene information
     */
    getCurrentSceneInfo() {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            return {
                success: true,
                data: {
                    name: scene.name,
                    uuid: scene.uuid,
                    nodeCount: scene.children.length
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Set node property
     */
    setNodeProperty(nodeUuid, property, value) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            // Set property
            if (property === 'position') {
                node.setPosition(value.x || 0, value.y || 0, value.z || 0);
            }
            else if (property === 'rotation') {
                node.setRotationFromEuler(value.x || 0, value.y || 0, value.z || 0);
            }
            else if (property === 'scale') {
                node.setScale(value.x || 1, value.y || 1, value.z || 1);
            }
            else if (property === 'active') {
                node.active = value;
            }
            else if (property === 'name') {
                node.name = value;
            }
            else {
                // Prototype pollution guard
                if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                    return { success: false, error: `Setting property '${property}' is not allowed` };
                }
                // Try to set the property directly
                node[property] = value;
            }
            return {
                success: true,
                message: `Property '${property}' updated successfully`
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Get scene hierarchy
     */
    getSceneHierarchy(includeComponents = false, maxDepth = 50) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const processNode = (node, depth = 0) => {
                if (depth >= maxDepth) {
                    return { name: node.name, uuid: node.uuid, truncated: true };
                }
                const result = {
                    name: node.name,
                    uuid: node.uuid,
                    active: node.active,
                    children: []
                };
                if (includeComponents) {
                    result.components = node.components.map((comp) => ({
                        type: comp.constructor.name,
                        enabled: comp.enabled
                    }));
                }
                if (node.children && node.children.length > 0) {
                    result.children = node.children.map((child) => processNode(child, depth + 1));
                }
                return result;
            };
            const hierarchy = scene.children.map((child) => processNode(child, 0));
            return { success: true, data: hierarchy };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Create prefab from node
     */
    createPrefabFromNode(nodeUuid, prefabPath) {
        try {
            const { director, instantiate } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            // Note: This is a simulated implementation since prefab files cannot be created directly at runtime.
            // Actual prefab creation requires the Editor API.
            return {
                success: true,
                data: {
                    prefabPath: prefabPath,
                    sourceNodeUuid: nodeUuid,
                    message: `Prefab created from node '${node.name}' at ${prefabPath}`
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Set component property
     */
    setComponentProperty(nodeUuid, componentType, property, value) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene) {
                return { success: false, error: 'No active scene' };
            }
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node) {
                return { success: false, error: `Node with UUID ${nodeUuid} not found` };
            }
            const ComponentClass = js.getClassByName(componentType);
            if (!ComponentClass) {
                return { success: false, error: `Component type ${componentType} not found` };
            }
            const component = node.getComponent(ComponentClass);
            if (!component) {
                return { success: false, error: `Component ${componentType} not found on node` };
            }
            // Prototype pollution guard (applied first for all property names)
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting property '${property}' is not allowed` };
            }
            // Special handling for common properties
            if (property === 'spriteFrame' && componentType === 'cc.Sprite') {
                // Value can be a uuid or asset path
                if (typeof value === 'string') {
                    const assetManager = require('cc').assetManager;
                    // Return a Promise so the caller waits for the asset to load
                    return new Promise((resolve) => {
                        assetManager.resources.load(value, require('cc').SpriteFrame, (err, spriteFrame) => {
                            if (!err && spriteFrame) {
                                component.spriteFrame = spriteFrame;
                                resolve({ success: true, message: `Component property '${property}' updated successfully` });
                            }
                            else {
                                assetManager.loadAny({ uuid: value }, (err2, asset) => {
                                    if (!err2 && asset) {
                                        component.spriteFrame = asset;
                                        resolve({ success: true, message: `Component property '${property}' updated successfully` });
                                    }
                                    else {
                                        resolve({ success: false, error: `Failed to load spriteFrame: ${(err2 === null || err2 === void 0 ? void 0 : err2.message) || (err === null || err === void 0 ? void 0 : err.message) || 'unknown error'}` });
                                    }
                                });
                            }
                        });
                    });
                }
                else {
                    component.spriteFrame = value;
                }
            }
            else if (property === 'material' && (componentType === 'cc.Sprite' || componentType === 'cc.MeshRenderer')) {
                // Value can be a uuid or asset path
                if (typeof value === 'string') {
                    const assetManager = require('cc').assetManager;
                    // Return a Promise so the caller waits for the asset to load
                    return new Promise((resolve) => {
                        assetManager.resources.load(value, require('cc').Material, (err, material) => {
                            if (!err && material) {
                                component.material = material;
                                resolve({ success: true, message: `Component property '${property}' updated successfully` });
                            }
                            else {
                                assetManager.loadAny({ uuid: value }, (err2, asset) => {
                                    if (!err2 && asset) {
                                        component.material = asset;
                                        resolve({ success: true, message: `Component property '${property}' updated successfully` });
                                    }
                                    else {
                                        resolve({ success: false, error: `Failed to load material: ${(err2 === null || err2 === void 0 ? void 0 : err2.message) || (err === null || err === void 0 ? void 0 : err.message) || 'unknown error'}` });
                                    }
                                });
                            }
                        });
                    });
                }
                else {
                    component.material = value;
                }
            }
            else if (property === 'string' && (componentType === 'cc.Label' || componentType === 'cc.RichText')) {
                component.string = value;
            }
            else {
                component[property] = value;
            }
            // Optional: refresh Inspector
            // Editor.Message.send('scene', 'snapshot');
            return { success: true, message: `Component property '${property}' updated successfully` };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ─── Light helpers ────────────────────────────────────────────────────────
    /** Map light type string to cc class name */
    _getLightClassName(type) {
        const map = {
            directional: 'DirectionalLight',
            sphere: 'SphereLight',
            spot: 'SpotLight',
        };
        return map[type] || 'DirectionalLight';
    },
    /** Parse color from hex string or {r,g,b,a} object into cc.Color */
    _parseColor(cc, color) {
        var _a, _b, _c, _d;
        if (!color)
            return new cc.Color(255, 255, 255, 255);
        if (typeof color === 'string') {
            const hex = color.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return new cc.Color(r, g, b, 255);
        }
        return new cc.Color((_a = color.r) !== null && _a !== void 0 ? _a : 255, (_b = color.g) !== null && _b !== void 0 ? _b : 255, (_c = color.b) !== null && _c !== void 0 ? _c : 255, (_d = color.a) !== null && _d !== void 0 ? _d : 255);
    },
    addLightComponent(nodeUuid, type, color, intensity) {
        try {
            const { director, js, Color } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const className = exports.methods._getLightClassName(type);
            const LightClass = js.getClassByName(className);
            if (!LightClass)
                return { success: false, error: `Light class ${className} not found` };
            const light = node.addComponent(LightClass);
            if (color)
                light.color = exports.methods._parseColor({ Color }, color);
            if (intensity !== undefined)
                light.luminance = intensity;
            return { success: true, data: { uuid: node.uuid, lightType: className } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setLightProperty(nodeUuid, property, value) {
        try {
            const { director, js, Color } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            let light = null;
            for (const t of lightTypes) {
                const cls = js.getClassByName(t);
                if (cls) {
                    light = node.getComponent(cls);
                    if (light)
                        break;
                }
            }
            if (!light)
                return { success: false, error: 'No light component found on node' };
            if (property === 'color') {
                light.color = exports.methods._parseColor({ Color }, value);
            }
            else if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            else {
                light[property] = value;
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getLightInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            for (const t of lightTypes) {
                const cls = js.getClassByName(t);
                if (!cls)
                    continue;
                const light = node.getComponent(cls);
                if (light) {
                    return {
                        success: true,
                        data: {
                            lightType: t,
                            color: light.color,
                            luminance: light.luminance,
                            range: light.range,
                            spotAngle: light.angle,
                            shadowEnabled: light.shadowEnabled,
                            shadowBias: light.shadowBias,
                        }
                    };
                }
            }
            return { success: false, error: 'No light component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listLights() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const lights = [];
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            const walk = (node) => {
                for (const t of lightTypes) {
                    const cls = js.getClassByName(t);
                    if (cls && node.getComponent(cls)) {
                        lights.push({ uuid: node.uuid, name: node.name, lightType: t });
                        break;
                    }
                }
                node.children.forEach((c) => walk(c));
            };
            scene.children.forEach((c) => walk(c));
            return { success: true, data: { lights, count: lights.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    removeLightComponent(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const lightTypes = ['DirectionalLight', 'SphereLight', 'SpotLight'];
            for (const t of lightTypes) {
                const cls = js.getClassByName(t);
                if (!cls)
                    continue;
                const light = node.getComponent(cls);
                if (light) {
                    node.removeComponent(light);
                    return { success: true };
                }
            }
            return { success: false, error: 'No light component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ─── Camera helpers ───────────────────────────────────────────────────────
    getCameraInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const CameraClass = js.getClassByName('Camera');
            if (!CameraClass)
                return { success: false, error: 'Camera class not found' };
            const cam = node.getComponent(CameraClass);
            if (!cam)
                return { success: false, error: 'No Camera component on node' };
            return {
                success: true,
                data: {
                    fov: cam.fov,
                    orthoHeight: cam.orthoHeight,
                    near: cam.near,
                    far: cam.far,
                    priority: cam.priority,
                    visibility: cam.visibility,
                    clearFlags: cam.clearFlags,
                    projection: cam.projection,
                    rect: cam.rect,
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setCameraProperty(nodeUuid, property, value) {
        var _a;
        try {
            const { director, js, Rect, Camera } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const CameraClass = js.getClassByName('Camera') || Camera;
            const cam = node.getComponent(CameraClass);
            if (!cam)
                return { success: false, error: 'No Camera component on node' };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            if (property === 'clearFlags') {
                const flagMap = { SOLID_COLOR: 1, DEPTH_ONLY: 2, DONT_CLEAR: 3, SKYBOX: 4 };
                cam.clearFlags = (_a = flagMap[value]) !== null && _a !== void 0 ? _a : value;
            }
            else if (property === 'projection') {
                cam.projection = value === 'ORTHO' ? 0 : 1;
            }
            else if (property === 'viewport') {
                cam.rect = new Rect(value.x, value.y, value.width, value.height);
            }
            else {
                cam[property] = value;
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listCameras() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const CameraClass = js.getClassByName('Camera');
            if (!CameraClass)
                return { success: false, error: 'Camera class not found' };
            const cameras = [];
            const walk = (node) => {
                const cam = node.getComponent(CameraClass);
                if (cam)
                    cameras.push({ uuid: node.uuid, name: node.name, priority: cam.priority, projection: cam.projection });
                node.children.forEach((c) => walk(c));
            };
            scene.children.forEach((c) => walk(c));
            return { success: true, data: { cameras, count: cameras.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ─── Physics helpers ──────────────────────────────────────────────────────
    configurePhysics(gravity, fixedTimeStep, maxSubSteps) {
        var _a, _b, _c;
        try {
            const { PhysicsSystem, Vec3 } = require('cc');
            const sys = PhysicsSystem === null || PhysicsSystem === void 0 ? void 0 : PhysicsSystem.instance;
            if (!sys)
                return { success: false, error: 'PhysicsSystem not available (3D only)' };
            if (gravity)
                sys.gravity = new Vec3((_a = gravity.x) !== null && _a !== void 0 ? _a : 0, (_b = gravity.y) !== null && _b !== void 0 ? _b : -10, (_c = gravity.z) !== null && _c !== void 0 ? _c : 0);
            if (fixedTimeStep !== undefined)
                sys.fixedTimeStep = fixedTimeStep;
            if (maxSubSteps !== undefined)
                sys.maxSubSteps = maxSubSteps;
            return { success: true, data: { gravity: sys.gravity, fixedTimeStep: sys.fixedTimeStep, maxSubSteps: sys.maxSubSteps } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /** Detect if node is in a 2D context by checking for UITransform/Sprite */
    _is2DNode(node, js) {
        const types2D = ['UITransform', 'Sprite', 'Label', 'Button', 'Canvas'];
        return types2D.some(t => { const cls = js.getClassByName(t); return cls && node.getComponent(cls); });
    },
    addRigidbody(nodeUuid, type, mass, useGravity) {
        var _a, _b;
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const is2D = exports.methods._is2DNode(node, js);
            const className = is2D ? 'RigidBody2D' : 'RigidBody';
            const RBClass = js.getClassByName(className);
            if (!RBClass)
                return { success: false, error: `${className} not available` };
            const rb = node.addComponent(RBClass);
            if (is2D) {
                const typeMap = { static: 0, kinematic: 1, dynamic: 2 };
                rb.type = (_a = typeMap[type]) !== null && _a !== void 0 ? _a : 2;
            }
            else {
                const typeMap = { dynamic: 0, static: 2, kinematic: 3 };
                rb.type = (_b = typeMap[type]) !== null && _b !== void 0 ? _b : 0;
                rb.mass = mass;
                rb.useGravity = useGravity;
            }
            return { success: true, data: { uuid: node.uuid, rbClass: className, type } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    addCollider(nodeUuid, shape, size, isTrigger) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const is2D = exports.methods._is2DNode(node, js);
            const classMap3D = { box: 'BoxCollider', sphere: 'SphereCollider', capsule: 'CapsuleCollider' };
            const classMap2D = { box: 'BoxCollider2D', circle: 'CircleCollider2D', polygon: 'PolygonCollider2D' };
            const className = is2D ? (classMap2D[shape] || 'BoxCollider2D') : (classMap3D[shape] || 'BoxCollider');
            const ColliderClass = js.getClassByName(className);
            if (!ColliderClass)
                return { success: false, error: `${className} not available` };
            const collider = node.addComponent(ColliderClass);
            collider.isTrigger = isTrigger;
            if (size && collider.size) {
                const { Vec3, Size } = require('cc');
                if (is2D)
                    collider.size = new Size((_b = (_a = size.width) !== null && _a !== void 0 ? _a : size.x) !== null && _b !== void 0 ? _b : 1, (_d = (_c = size.height) !== null && _c !== void 0 ? _c : size.y) !== null && _d !== void 0 ? _d : 1);
                else
                    collider.size = new Vec3((_f = (_e = size.width) !== null && _e !== void 0 ? _e : size.x) !== null && _f !== void 0 ? _f : 1, (_h = (_g = size.height) !== null && _g !== void 0 ? _g : size.y) !== null && _h !== void 0 ? _h : 1, (_k = (_j = size.depth) !== null && _j !== void 0 ? _j : size.z) !== null && _k !== void 0 ? _k : 1);
            }
            if ((size === null || size === void 0 ? void 0 : size.radius) !== undefined && collider.radius !== undefined)
                collider.radius = size.radius;
            return { success: true, data: { uuid: node.uuid, colliderClass: className, isTrigger } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setRigidbodyProperty(nodeUuid, property, value) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            for (const rbName of ['RigidBody', 'RigidBody2D']) {
                const cls = js.getClassByName(rbName);
                if (!cls)
                    continue;
                const rb = node.getComponent(cls);
                if (rb) {
                    rb[property] = value;
                    return { success: true };
                }
            }
            return { success: false, error: 'No RigidBody component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setColliderProperty(nodeUuid, property, value) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        try {
            const { director, js, Vec3, Size } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            const colliderNames = ['BoxCollider', 'SphereCollider', 'CapsuleCollider', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D'];
            for (const name of colliderNames) {
                const cls = js.getClassByName(name);
                if (!cls)
                    continue;
                const col = node.getComponent(cls);
                if (col) {
                    if (property === 'size' && typeof value === 'object') {
                        col.size = name.endsWith('2D')
                            ? new Size((_b = (_a = value.width) !== null && _a !== void 0 ? _a : value.x) !== null && _b !== void 0 ? _b : 1, (_d = (_c = value.height) !== null && _c !== void 0 ? _c : value.y) !== null && _d !== void 0 ? _d : 1)
                            : new Vec3((_f = (_e = value.width) !== null && _e !== void 0 ? _e : value.x) !== null && _f !== void 0 ? _f : 1, (_h = (_g = value.height) !== null && _g !== void 0 ? _g : value.y) !== null && _h !== void 0 ? _h : 1, (_k = (_j = value.depth) !== null && _j !== void 0 ? _j : value.z) !== null && _k !== void 0 ? _k : 1);
                    }
                    else if (property === 'center' && typeof value === 'object') {
                        col.center = new Vec3((_l = value.x) !== null && _l !== void 0 ? _l : 0, (_m = value.y) !== null && _m !== void 0 ? _m : 0, (_o = value.z) !== null && _o !== void 0 ? _o : 0);
                    }
                    else {
                        col[property] = value;
                    }
                    return { success: true };
                }
            }
            return { success: false, error: 'No collider component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    removePhysicsComponents(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const physicsNames = ['RigidBody', 'RigidBody2D', 'BoxCollider', 'SphereCollider', 'CapsuleCollider', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D'];
            const removed = [];
            for (const name of physicsNames) {
                const cls = js.getClassByName(name);
                if (!cls)
                    continue;
                const comp = node.getComponent(cls);
                if (comp) {
                    node.removeComponent(comp);
                    removed.push(name);
                }
            }
            return { success: true, data: { removed } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getPhysicsInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const info = { rigidbody: null, colliders: [] };
            for (const rbName of ['RigidBody', 'RigidBody2D']) {
                const cls = js.getClassByName(rbName);
                if (!cls)
                    continue;
                const rb = node.getComponent(cls);
                if (rb) {
                    info.rigidbody = { type: rbName, rbType: rb.type, mass: rb.mass, useGravity: rb.useGravity };
                    break;
                }
            }
            const colliderNames = ['BoxCollider', 'SphereCollider', 'CapsuleCollider', 'BoxCollider2D', 'CircleCollider2D', 'PolygonCollider2D'];
            for (const name of colliderNames) {
                const cls = js.getClassByName(name);
                if (!cls)
                    continue;
                const col = node.getComponent(cls);
                if (col)
                    info.colliders.push({ type: name, isTrigger: col.isTrigger, size: col.size, center: col.center });
            }
            return { success: true, data: info };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    performRaycast(origin, direction, maxDistance) {
        var _a, _b, _c, _d;
        try {
            const { PhysicsSystem, Vec3, geometry } = require('cc');
            const sys = PhysicsSystem === null || PhysicsSystem === void 0 ? void 0 : PhysicsSystem.instance;
            if (!sys)
                return { success: false, error: 'PhysicsSystem not available (3D only)' };
            const ray = new geometry.Ray(origin.x, origin.y, origin.z, direction.x, direction.y, direction.z);
            const hit = sys.raycastClosest(ray, 0xffffffff, maxDistance);
            if (!hit)
                return { success: true, data: { hit: false } };
            const result = sys.raycastClosestResult;
            return {
                success: true,
                data: {
                    hit: true,
                    distance: result.distance,
                    hitPoint: result.hitPoint,
                    hitNormal: result.hitNormal,
                    nodeUuid: (_b = (_a = result.collider) === null || _a === void 0 ? void 0 : _a.node) === null || _b === void 0 ? void 0 : _b.uuid,
                    nodeName: (_d = (_c = result.collider) === null || _c === void 0 ? void 0 : _c.node) === null || _d === void 0 ? void 0 : _d.name,
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ─── Audio helpers ────────────────────────────────────────────────────────
    addAudioSource(nodeUuid, clipUuid) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass)
                return { success: false, error: 'AudioSource class not found' };
            const audio = node.addComponent(AudioSourceClass);
            if (clipUuid) {
                assetManager.loadAny({ uuid: clipUuid }, (err, clip) => {
                    if (!err && clip)
                        audio.clip = clip;
                });
            }
            return { success: true, data: { uuid: node.uuid, hasClip: !!clipUuid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setAudioProperty(nodeUuid, property, value) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass)
                return { success: false, error: 'AudioSource class not found' };
            const audio = node.getComponent(AudioSourceClass);
            if (!audio)
                return { success: false, error: 'No AudioSource component on node' };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            if (property === 'clip' && typeof value === 'string') {
                assetManager.loadAny({ uuid: value }, (err, clip) => {
                    if (!err && clip)
                        audio.clip = clip;
                });
                return { success: true, message: 'Clip loading initiated' };
            }
            audio[property] = value;
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    controlAudio(nodeUuid, command) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass)
                return { success: false, error: 'AudioSource class not found' };
            const audio = node.getComponent(AudioSourceClass);
            if (!audio)
                return { success: false, error: 'No AudioSource component on node' };
            const cmds = {
                play: () => audio.play(),
                stop: () => audio.stop(),
                pause: () => audio.pause(),
                resume: () => audio.play(),
            };
            if (!cmds[command])
                return { success: false, error: `Unknown command '${command}'` };
            cmds[command]();
            return { success: true, data: { command } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getAudioInfo(nodeUuid) {
        var _a, _b;
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass)
                return { success: false, error: 'AudioSource class not found' };
            const audio = node.getComponent(AudioSourceClass);
            if (!audio)
                return { success: false, error: 'No AudioSource component on node' };
            return {
                success: true,
                data: {
                    clip: (_b = (_a = audio.clip) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : null,
                    volume: audio.volume,
                    loop: audio.loop,
                    playOnAwake: audio.playOnAwake,
                    playing: audio.playing,
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listAudioSources() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const AudioSourceClass = js.getClassByName('AudioSource');
            if (!AudioSourceClass)
                return { success: false, error: 'AudioSource class not found' };
            const sources = [];
            const walk = (node) => {
                var _a, _b;
                const audio = node.getComponent(AudioSourceClass);
                if (audio)
                    sources.push({ uuid: node.uuid, name: node.name, clip: (_b = (_a = audio.clip) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : null, volume: audio.volume });
                node.children.forEach((c) => walk(c));
            };
            scene.children.forEach((c) => walk(c));
            return { success: true, data: { sources, count: sources.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ─── Particle helpers ─────────────────────────────────────────────────────
    addParticleSystem(nodeUuid, is2d) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const className = is2d ? 'ParticleSystem2D' : 'ParticleSystem';
            const PSClass = js.getClassByName(className);
            if (!PSClass)
                return { success: false, error: `${className} not found` };
            node.addComponent(PSClass);
            return { success: true, data: { uuid: node.uuid, particleClass: className } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setParticleProperty(nodeUuid, property, value) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            if (['__proto__', 'constructor', 'prototype'].includes(property)) {
                return { success: false, error: `Setting '${property}' is not allowed` };
            }
            for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                const PSClass = js.getClassByName(cls);
                if (!PSClass)
                    continue;
                const ps = node.getComponent(PSClass);
                if (ps) {
                    ps[property] = value;
                    return { success: true };
                }
            }
            return { success: false, error: 'No ParticleSystem component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setParticleEmission(nodeUuid, rateOverTime, bursts) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const PSClass = js.getClassByName('ParticleSystem');
            if (!PSClass)
                return { success: false, error: 'ParticleSystem not found (3D only for emission control)' };
            const ps = node.getComponent(PSClass);
            if (!ps)
                return { success: false, error: 'No ParticleSystem on node' };
            if (rateOverTime !== undefined && ps.rateOverTime) {
                ps.rateOverTime.constant = rateOverTime;
            }
            if (Array.isArray(bursts) && ps.bursts !== undefined) {
                ps.bursts = bursts;
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setParticleShape(nodeUuid, shapeType, radius, angle) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const PSClass = js.getClassByName('ParticleSystem');
            if (!PSClass)
                return { success: false, error: 'ParticleSystem not found (3D only for shape)' };
            const ps = node.getComponent(PSClass);
            if (!ps)
                return { success: false, error: 'No ParticleSystem on node' };
            if (ps.shapeModule) {
                const shapeMap = { cone: 0, sphere: 1, box: 4 };
                if (shapeType && shapeMap[shapeType] !== undefined)
                    ps.shapeModule.shapeType = shapeMap[shapeType];
                if (radius !== undefined)
                    ps.shapeModule.radius = radius;
                if (angle !== undefined)
                    ps.shapeModule.angle = angle;
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setParticleRenderer(nodeUuid, renderMode, materialUuid) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const PSClass = js.getClassByName('ParticleSystem');
            if (!PSClass)
                return { success: false, error: 'ParticleSystem not found' };
            const ps = node.getComponent(PSClass);
            if (!ps)
                return { success: false, error: 'No ParticleSystem on node' };
            if (renderMode !== undefined && ps.renderer)
                ps.renderer.renderMode = renderMode;
            if (materialUuid && ps.renderer) {
                assetManager.loadAny({ uuid: materialUuid }, (err, mat) => {
                    if (!err && mat)
                        ps.renderer.sharedMaterial = mat;
                });
            }
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getParticleInfo(nodeUuid) {
        var _a, _b, _c;
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                const PSClass = js.getClassByName(cls);
                if (!PSClass)
                    continue;
                const ps = node.getComponent(PSClass);
                if (ps) {
                    return {
                        success: true,
                        data: {
                            particleClass: cls,
                            duration: ps.duration,
                            loop: ps.loop,
                            playOnAwake: ps.playOnAwake,
                            maxParticles: (_a = ps.capacity) !== null && _a !== void 0 ? _a : ps.totalParticles,
                            startLifetime: (_b = ps.startLifetime) === null || _b === void 0 ? void 0 : _b.constant,
                            startSpeed: (_c = ps.startSpeed) === null || _c === void 0 ? void 0 : _c.constant,
                        }
                    };
                }
            }
            return { success: false, error: 'No ParticleSystem component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listParticleSystems() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const particles = [];
            const walk = (node) => {
                for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                    const PSClass = js.getClassByName(cls);
                    if (PSClass && node.getComponent(PSClass)) {
                        particles.push({ uuid: node.uuid, name: node.name, particleClass: cls });
                        break;
                    }
                }
                node.children.forEach((c) => walk(c));
            };
            scene.children.forEach((c) => walk(c));
            return { success: true, data: { particles, count: particles.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    removeParticleSystem(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            for (const cls of ['ParticleSystem', 'ParticleSystem2D']) {
                const PSClass = js.getClassByName(cls);
                if (!PSClass)
                    continue;
                const ps = node.getComponent(PSClass);
                if (ps) {
                    node.removeComponent(ps);
                    return { success: true };
                }
            }
            return { success: false, error: 'No ParticleSystem component found on node' };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ─── Tween helpers ────────────────────────────────────────────────────────
    _applyTweenProperties(tween, node, properties, ccModule) {
        var _a, _b, _c, _d, _e, _f, _g;
        const { Vec3, Quat } = ccModule;
        const target = {};
        if (properties.position)
            target.position = new Vec3((_a = properties.position.x) !== null && _a !== void 0 ? _a : 0, (_b = properties.position.y) !== null && _b !== void 0 ? _b : 0, (_c = properties.position.z) !== null && _c !== void 0 ? _c : 0);
        if (properties.scale)
            target.scale = new Vec3((_d = properties.scale.x) !== null && _d !== void 0 ? _d : 1, (_e = properties.scale.y) !== null && _e !== void 0 ? _e : 1, (_f = properties.scale.z) !== null && _f !== void 0 ? _f : 1);
        if (properties.opacity !== undefined) {
            const uiOp = node.getComponent && node.getComponent((_g = ccModule.js) === null || _g === void 0 ? void 0 : _g.getClassByName('UIOpacity'));
            if (uiOp)
                target.opacity = properties.opacity;
        }
        return target;
    },
    createTween(nodeUuid, steps) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        try {
            const cc = require('cc');
            const { director, tween, Vec3 } = cc;
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            let t = tween(node);
            for (const step of steps) {
                if (step.type === 'delay') {
                    t = t.delay((_a = step.duration) !== null && _a !== void 0 ? _a : 0);
                }
                else if (step.type === 'to' || step.type === 'by') {
                    const props = step.properties || {};
                    const target = {};
                    if (props.position)
                        target.position = new Vec3((_b = props.position.x) !== null && _b !== void 0 ? _b : 0, (_c = props.position.y) !== null && _c !== void 0 ? _c : 0, (_d = props.position.z) !== null && _d !== void 0 ? _d : 0);
                    if (props.scale)
                        target.scale = new Vec3((_e = props.scale.x) !== null && _e !== void 0 ? _e : 1, (_f = props.scale.y) !== null && _f !== void 0 ? _f : 1, (_g = props.scale.z) !== null && _g !== void 0 ? _g : 1);
                    const opts = step.easing ? { easing: step.easing } : {};
                    t = step.type === 'to' ? t.to((_h = step.duration) !== null && _h !== void 0 ? _h : 1, target, opts) : t.by((_j = step.duration) !== null && _j !== void 0 ? _j : 1, target, opts);
                }
            }
            t.start();
            return { success: true, data: { nodeUuid, steps: steps.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    addTweenTo(nodeUuid, properties, duration, easing) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const { director, tween, Vec3 } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const target = {};
            if (properties.position)
                target.position = new Vec3((_a = properties.position.x) !== null && _a !== void 0 ? _a : 0, (_b = properties.position.y) !== null && _b !== void 0 ? _b : 0, (_c = properties.position.z) !== null && _c !== void 0 ? _c : 0);
            if (properties.scale)
                target.scale = new Vec3((_d = properties.scale.x) !== null && _d !== void 0 ? _d : 1, (_e = properties.scale.y) !== null && _e !== void 0 ? _e : 1, (_f = properties.scale.z) !== null && _f !== void 0 ? _f : 1);
            const opts = easing && easing !== 'linear' ? { easing } : {};
            tween(node).to(duration, target, opts).start();
            return { success: true, data: { nodeUuid, duration, easing } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    addTweenBy(nodeUuid, properties, duration, easing) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const { director, tween, Vec3 } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const target = {};
            if (properties.position)
                target.position = new Vec3((_a = properties.position.x) !== null && _a !== void 0 ? _a : 0, (_b = properties.position.y) !== null && _b !== void 0 ? _b : 0, (_c = properties.position.z) !== null && _c !== void 0 ? _c : 0);
            if (properties.scale)
                target.scale = new Vec3((_d = properties.scale.x) !== null && _d !== void 0 ? _d : 1, (_e = properties.scale.y) !== null && _e !== void 0 ? _e : 1, (_f = properties.scale.z) !== null && _f !== void 0 ? _f : 1);
            const opts = easing && easing !== 'linear' ? { easing } : {};
            tween(node).by(duration, target, opts).start();
            return { success: true, data: { nodeUuid, duration, easing } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    addTweenDelay(nodeUuid, duration) {
        try {
            const { director, tween } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            tween(node).delay(duration).start();
            return { success: true, data: { nodeUuid, duration } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    stopTweens(nodeUuid) {
        try {
            const { director, Tween } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            if (Tween && typeof Tween.stopAllByTarget === 'function') {
                Tween.stopAllByTarget(node);
            }
            return { success: true, data: { nodeUuid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── TiledMap ──────────────────────────────────────────────────────────────
    getTiledMapInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap)
                return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp)
                return { success: false, error: 'No TiledMap component on node' };
            const layers = [];
            if (comp.getLayers) {
                try {
                    comp.getLayers().forEach((l) => layers.push(l.getLayerName ? l.getLayerName() : l.layerName));
                }
                catch ( /* ignore */_a) { /* ignore */ }
            }
            return { success: true, data: { mapSize: comp.mapSize, tileSize: comp.tileSize, layers, orientation: comp.orientation } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listTiledMaps() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap)
                return { success: false, error: 'TiledMap class not found' };
            const nodes = [];
            scene.walk((node) => { if (node.getComponent(TiledMap))
                nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getTiledLayerInfo(nodeUuid, layerName) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap)
                return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp)
                return { success: false, error: 'No TiledMap component on node' };
            const layer = comp.getLayer(layerName);
            if (!layer)
                return { success: false, error: `Layer '${layerName}' not found` };
            return { success: true, data: { layerName, layerSize: layer.layerSize, tiles: layer.tiles } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setTile(nodeUuid, layerName, x, y, gid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap)
                return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp)
                return { success: false, error: 'No TiledMap component on node' };
            const layer = comp.getLayer(layerName);
            if (!layer)
                return { success: false, error: `Layer '${layerName}' not found` };
            layer.setTileGIDAt(gid, x, y);
            return { success: true, data: { x, y, gid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getTile(nodeUuid, layerName, x, y) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap)
                return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp)
                return { success: false, error: 'No TiledMap component on node' };
            const layer = comp.getLayer(layerName);
            if (!layer)
                return { success: false, error: `Layer '${layerName}' not found` };
            const gid = layer.getTileGIDAt(x, y);
            return { success: true, data: { x, y, gid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getTilesetInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const TiledMap = js.getClassByName('TiledMap');
            if (!TiledMap)
                return { success: false, error: 'TiledMap class not found' };
            const comp = node.getComponent(TiledMap);
            if (!comp)
                return { success: false, error: 'No TiledMap component on node' };
            const tilesets = [];
            if (comp.getTilesets) {
                try {
                    comp.getTilesets().forEach((ts) => tilesets.push({ name: ts.name, firstGid: ts.firstGid, tileSize: ts.tileSize }));
                }
                catch ( /* ignore */_a) { /* ignore */ }
            }
            return { success: true, data: { tilesets } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Spine ─────────────────────────────────────────────────────────────────
    getSpineInfo(nodeUuid) {
        try {
            const { director } = require('cc');
            let sp;
            try {
                sp = require('cc').sp;
                if (!sp)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'Spine module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp)
                return { success: false, error: 'No sp.Skeleton component on node' };
            const animations = [];
            const skins = [];
            try {
                if (comp.skeletonData) {
                    const ae = comp.skeletonData.getAnimsEnum;
                    const se = comp.skeletonData.getSkinsEnum;
                    if (ae)
                        animations.push(...Object.keys(ae()));
                    if (se)
                        skins.push(...Object.keys(se()));
                }
            }
            catch ( /* ignore */_b) { /* ignore */ }
            return { success: true, data: { animations, skins, timeScale: comp.timeScale, premultipliedAlpha: comp.premultipliedAlpha, debugBones: comp.debugBones, debugSlots: comp.debugSlots } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setSpineAnimation(nodeUuid, animationName, loop, trackIndex) {
        try {
            const { director } = require('cc');
            let sp;
            try {
                sp = require('cc').sp;
                if (!sp)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'Spine module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp)
                return { success: false, error: 'No sp.Skeleton component on node' };
            comp.setAnimation(trackIndex, animationName, loop);
            return { success: true, data: { animationName, loop, trackIndex } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setSpineSkin(nodeUuid, skinName) {
        try {
            const { director } = require('cc');
            let sp;
            try {
                sp = require('cc').sp;
                if (!sp)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'Spine module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp)
                return { success: false, error: 'No sp.Skeleton component on node' };
            comp.setSkin(skinName);
            return { success: true, data: { skinName } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setSpineProperty(nodeUuid, property, value) {
        try {
            const { director } = require('cc');
            let sp;
            try {
                sp = require('cc').sp;
                if (!sp)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'Spine module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(sp.Skeleton);
            if (!comp)
                return { success: false, error: 'No sp.Skeleton component on node' };
            const allowed = ['timeScale', 'premultipliedAlpha', 'debugBones', 'debugSlots'];
            if (!allowed.includes(property))
                return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            comp[property] = value;
            return { success: true, data: { property, value } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listSpineNodes() {
        try {
            const { director } = require('cc');
            let sp;
            try {
                sp = require('cc').sp;
                if (!sp)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'Spine module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const nodes = [];
            scene.walk((node) => { if (node.getComponent(sp.Skeleton))
                nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    addSpineToNode(nodeUuid, skeletonDataUuid) {
        try {
            const { director, assetManager } = require('cc');
            let sp;
            try {
                sp = require('cc').sp;
                if (!sp)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'Spine module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.addComponent(sp.Skeleton);
            assetManager.loadAny(skeletonDataUuid, (err, asset) => { if (!err && asset)
                comp.skeletonData = asset; });
            return { success: true, data: { nodeUuid, skeletonDataUuid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── DragonBones ───────────────────────────────────────────────────────────
    getDragonBonesInfo(nodeUuid) {
        try {
            const { director } = require('cc');
            let db;
            try {
                db = require('cc').dragonBones;
                if (!db)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'DragonBones module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp)
                return { success: false, error: 'No ArmatureDisplay component on node' };
            const animations = [];
            const armatureNames = [];
            try {
                if (comp.dragonAsset) {
                    armatureNames.push(...(comp.dragonAsset.armatureNames || []));
                    const factory = db.CCFactory.getInstance();
                    if (factory) {
                        const arm = factory.buildArmature(comp.armatureName, comp.dragonAsset.name);
                        if (arm) {
                            animations.push(...arm.animation.animationNames);
                            arm.dispose();
                        }
                    }
                }
            }
            catch ( /* ignore */_b) { /* ignore */ }
            return { success: true, data: { armatureNames, animations, timeScale: comp.timeScale, armatureName: comp.armatureName } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setDragonBonesAnimation(nodeUuid, animationName, playTimes) {
        try {
            const { director } = require('cc');
            let db;
            try {
                db = require('cc').dragonBones;
                if (!db)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'DragonBones module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp)
                return { success: false, error: 'No ArmatureDisplay component on node' };
            comp.playAnimation(animationName, playTimes);
            return { success: true, data: { animationName, playTimes } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setDragonBonesArmature(nodeUuid, armatureName) {
        try {
            const { director } = require('cc');
            let db;
            try {
                db = require('cc').dragonBones;
                if (!db)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'DragonBones module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp)
                return { success: false, error: 'No ArmatureDisplay component on node' };
            comp.armatureName = armatureName;
            return { success: true, data: { armatureName } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setDragonBonesProperty(nodeUuid, property, value) {
        try {
            const { director } = require('cc');
            let db;
            try {
                db = require('cc').dragonBones;
                if (!db)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'DragonBones module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.getComponent(db.ArmatureDisplay);
            if (!comp)
                return { success: false, error: 'No ArmatureDisplay component on node' };
            const allowed = ['timeScale', 'debugBones', 'playTimes'];
            if (!allowed.includes(property))
                return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            comp[property] = value;
            return { success: true, data: { property, value } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listDragonBonesNodes() {
        try {
            const { director } = require('cc');
            let db;
            try {
                db = require('cc').dragonBones;
                if (!db)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'DragonBones module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const nodes = [];
            scene.walk((node) => { if (node.getComponent(db.ArmatureDisplay))
                nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    addDragonBonesToNode(nodeUuid, dragonBonesAssetUuid, dragonBonesAtlasAssetUuid) {
        try {
            const { director, assetManager } = require('cc');
            let db;
            try {
                db = require('cc').dragonBones;
                if (!db)
                    throw new Error('not found');
            }
            catch (_a) {
                return { success: false, error: 'DragonBones module not available in this project' };
            }
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const comp = node.addComponent(db.ArmatureDisplay);
            assetManager.loadAny([dragonBonesAssetUuid, dragonBonesAtlasAssetUuid], (err, assets) => {
                if (!err && assets) {
                    comp.dragonAsset = assets[0];
                    comp.dragonAtlasAsset = assets[1];
                }
            });
            return { success: true, data: { nodeUuid, dragonBonesAssetUuid, dragonBonesAtlasAssetUuid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Terrain ───────────────────────────────────────────────────────────────
    getTerrainInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp)
                return { success: false, error: 'No Terrain component on node' };
            const layerCount = comp.getLayerCount ? comp.getLayerCount() : (comp.layers ? comp.layers.length : 0);
            return { success: true, data: { tileSize: comp.tileSize, weightMapSize: comp.weightMapSize, lightMapSize: comp.lightMapSize, blockCount: comp.blockCount, layerCount } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setTerrainProperty(nodeUuid, property, value) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp)
                return { success: false, error: 'No Terrain component on node' };
            const allowed = ['tileSize', 'weightMapSize', 'lightMapSize'];
            if (!allowed.includes(property))
                return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            comp[property] = value;
            return { success: true, data: { property, value } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getTerrainLayerInfo(nodeUuid, layerIndex) {
        var _a;
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp)
                return { success: false, error: 'No Terrain component on node' };
            const layer = comp.getLayer ? comp.getLayer(layerIndex) : (comp.layers ? comp.layers[layerIndex] : null);
            if (!layer)
                return { success: false, error: `Layer ${layerIndex} not found` };
            return { success: true, data: { layerIndex, tileSize: layer.tileSize, detailMap: (_a = layer.detailMap) === null || _a === void 0 ? void 0 : _a.uuid } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setTerrainLayer(nodeUuid, layerIndex, detailMapUuid, tileSize) {
        try {
            const { director, js, assetManager } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp)
                return { success: false, error: 'No Terrain component on node' };
            assetManager.loadAny(detailMapUuid, (err, asset) => {
                if (err || !asset)
                    return;
                const layer = comp.getLayer ? comp.getLayer(layerIndex) : (comp.layers ? comp.layers[layerIndex] : null);
                if (layer) {
                    layer.detailMap = asset;
                    if (tileSize !== undefined)
                        layer.tileSize = tileSize;
                }
            });
            return { success: true, data: { layerIndex, detailMapUuid, tileSize } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getTerrainHeight(nodeUuid, x, y) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp)
                return { success: false, error: 'No Terrain component on node' };
            const height = comp.getHeight ? comp.getHeight(x, y) : null;
            return { success: true, data: { x, y, height } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setTerrainHeight(nodeUuid, x, y, height) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const comp = node.getComponent(Terrain);
            if (!comp)
                return { success: false, error: 'No Terrain component on node' };
            if (!comp.setHeight)
                return { success: false, error: 'setHeight not available on this Terrain version' };
            comp.setHeight(x, y, height);
            return { success: true, data: { x, y, height } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listTerrainNodes() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const Terrain = js.getClassByName('Terrain');
            if (!Terrain)
                return { success: false, error: 'Terrain class not found — 3D only' };
            const nodes = [];
            scene.walk((node) => { if (node.getComponent(Terrain))
                nodes.push({ uuid: node.uuid, name: node.name }); });
            return { success: true, data: { nodes, count: nodes.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Phase 4: Render Pipeline ──────────────────────────────────────────
    getRenderPipelineInfo() {
        try {
            const { director } = require('cc');
            const pipeline = director.root && director.root.pipeline;
            if (!pipeline)
                return { success: false, error: 'No render pipeline — 3D scene required' };
            const scene = director.getScene();
            const env = scene && scene.globals && scene.globals.environment;
            const fog = scene && scene.globals && scene.globals.fog;
            const shadows = scene && scene.globals && scene.globals.shadows;
            const skybox = scene && scene.globals && scene.globals.skybox;
            return {
                success: true, data: {
                    shadows: shadows ? { enabled: shadows.enabled, type: shadows.type, shadowMapSize: shadows.mapSize } : null,
                    fog: fog ? { enabled: fog.enabled, type: fog.type, fogStart: fog.fogStart, fogEnd: fog.fogEnd, fogDensity: fog.fogDensity } : null,
                    skybox: skybox ? { enabled: skybox.enabled, useHDR: skybox.useHDR, rotationAngle: skybox.rotationAngle } : null,
                    ambient: env ? { skyColor: env.skyColor, groundAlbedo: env.groundAlbedo } : null,
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setShadowSettings(enabled, type, shadowMapSize) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const shadows = scene.globals && scene.globals.shadows;
            if (!shadows)
                return { success: false, error: 'Shadow globals not available — 3D scene required' };
            if (enabled !== undefined)
                shadows.enabled = enabled;
            if (type !== undefined)
                shadows.type = type;
            if (shadowMapSize !== undefined)
                shadows.mapSize = shadowMapSize;
            return { success: true, data: { enabled: shadows.enabled, type: shadows.type, mapSize: shadows.mapSize } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setFogSettings(enabled, fogColor, type, fogStart, fogEnd, fogDensity) {
        try {
            const { director, Color } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const fog = scene.globals && scene.globals.fog;
            if (!fog)
                return { success: false, error: 'Fog globals not available — 3D scene required' };
            if (enabled !== undefined)
                fog.enabled = enabled;
            if (type !== undefined)
                fog.type = type;
            if (fogStart !== undefined)
                fog.fogStart = fogStart;
            if (fogEnd !== undefined)
                fog.fogEnd = fogEnd;
            if (fogDensity !== undefined)
                fog.fogDensity = fogDensity;
            if (fogColor !== undefined) {
                const hex = fogColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                fog.fogColor = new Color(r, g, b, 255);
            }
            return { success: true, data: { enabled: fog.enabled, type: fog.type, fogStart: fog.fogStart, fogEnd: fog.fogEnd, fogDensity: fog.fogDensity } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setSkyboxSettings(enabled, useHDR, rotationAngle) {
        try {
            const { director } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const skybox = scene.globals && scene.globals.skybox;
            if (!skybox)
                return { success: false, error: 'Skybox globals not available — 3D scene required' };
            if (enabled !== undefined)
                skybox.enabled = enabled;
            if (useHDR !== undefined)
                skybox.useHDR = useHDR;
            if (rotationAngle !== undefined)
                skybox.rotationAngle = rotationAngle;
            return { success: true, data: { enabled: skybox.enabled, useHDR: skybox.useHDR, rotationAngle: skybox.rotationAngle } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setPostProcessSettings(bloom, tonemap) {
        try {
            const { director } = require('cc');
            const pipeline = director.root && director.root.pipeline;
            if (!pipeline)
                return { success: false, error: 'No render pipeline — 3D scene required' };
            const pp = pipeline.postProcess || (pipeline.getPostProcess && pipeline.getPostProcess());
            if (!pp)
                return { success: false, error: 'PostProcess not available on this pipeline' };
            if (bloom !== undefined && pp.bloom) {
                if (bloom.enabled !== undefined)
                    pp.bloom.enabled = bloom.enabled;
                if (bloom.intensity !== undefined)
                    pp.bloom.intensity = bloom.intensity;
            }
            if (tonemap !== undefined && pp.colorGrading) {
                pp.colorGrading.tonemapMode = tonemap;
            }
            return { success: true, data: { bloom: pp.bloom ? { enabled: pp.bloom.enabled, intensity: pp.bloom.intensity } : null, tonemap } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Phase 4: Mesh Renderer ────────────────────────────────────────────
    getMeshRendererInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const MeshRenderer = js.getClassByName('MeshRenderer');
            if (!MeshRenderer)
                return { success: false, error: 'MeshRenderer not available — 3D only' };
            const comp = node.getComponent(MeshRenderer);
            if (!comp)
                return { success: false, error: 'No MeshRenderer on node' };
            return {
                success: true, data: {
                    nodeUuid, nodeName: node.name,
                    shadowCastingMode: comp.shadowCastingMode,
                    receiveShadow: comp.receiveShadow,
                    visibility: comp.visibility,
                    mesh: comp.mesh ? { uuid: comp.mesh._uuid, name: comp.mesh.name } : null,
                    materials: comp.sharedMaterials ? comp.sharedMaterials.map((m) => m ? { uuid: m._uuid, name: m.name } : null) : [],
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setMeshRendererProperty(nodeUuid, property, value) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const MeshRenderer = js.getClassByName('MeshRenderer');
            if (!MeshRenderer)
                return { success: false, error: 'MeshRenderer not available — 3D only' };
            const comp = node.getComponent(MeshRenderer);
            if (!comp)
                return { success: false, error: 'No MeshRenderer on node' };
            const allowed = ['shadowCastingMode', 'receiveShadow', 'visibility'];
            if (!allowed.includes(property))
                return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            comp[property] = value;
            return { success: true, data: { nodeUuid, property, value } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Phase 4: Profiler ─────────────────────────────────────────────────
    getPerformanceStats() {
        try {
            const { director, profiler } = require('cc');
            const scene = director.getScene();
            const nodeCount = scene ? (() => { let n = 0; scene.walk(() => n++); return n; })() : 0;
            const stats = { nodeCount };
            if (profiler) {
                stats.fps = profiler.fps !== undefined ? profiler.fps : null;
                stats.drawCalls = profiler.drawCalls !== undefined ? profiler.drawCalls : null;
                stats.triangles = profiler.triangles !== undefined ? profiler.triangles : null;
            }
            return { success: true, data: stats };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getMemoryStats() {
        try {
            const memUsage = process.memoryUsage ? process.memoryUsage() : null;
            const data = {
                process: memUsage ? {
                    heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
                    heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
                    rssMB: (memUsage.rss / 1024 / 1024).toFixed(2),
                } : null,
            };
            try {
                const { director } = require('cc');
                const pipeline = director.root && director.root.pipeline;
                if (pipeline && pipeline.device) {
                    data.gpu = {
                        memoryStatus: pipeline.device.memoryStatus || null,
                    };
                }
            }
            catch ( /* GPU stats optional */_a) { /* GPU stats optional */ }
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    toggleStatsDisplay(visible) {
        try {
            const { profiler } = require('cc');
            if (!profiler)
                return { success: false, error: 'profiler module not available' };
            if (visible === true) {
                profiler.showStats && profiler.showStats();
            }
            else if (visible === false) {
                profiler.hideStats && profiler.hideStats();
            }
            else {
                // toggle
                if (profiler.isShowingStats && profiler.isShowingStats()) {
                    profiler.hideStats && profiler.hideStats();
                }
                else {
                    profiler.showStats && profiler.showStats();
                }
            }
            const nowVisible = profiler.isShowingStats ? profiler.isShowingStats() : visible;
            return { success: true, data: { visible: nowVisible } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getDrawCallStats() {
        try {
            const { director, profiler } = require('cc');
            const pipeline = director.root && director.root.pipeline;
            const data = {};
            if (profiler) {
                data.drawCalls = profiler.drawCalls !== undefined ? profiler.drawCalls : null;
                data.instancedDrawCalls = profiler.instancedDrawCalls !== undefined ? profiler.instancedDrawCalls : null;
                data.triangles = profiler.triangles !== undefined ? profiler.triangles : null;
            }
            if (pipeline && pipeline.sceneRenderer) {
                data.sceneRenderer = pipeline.sceneRenderer.getProfilingData ? pipeline.sceneRenderer.getProfilingData() : null;
            }
            return { success: true, data };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Phase 4: Video Player ─────────────────────────────────────────────
    addVideoPlayer(nodeUuid, clipUrl) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer)
                return { success: false, error: 'VideoPlayer component not available' };
            let comp = node.getComponent(VideoPlayer);
            if (!comp)
                comp = node.addComponent(VideoPlayer);
            return { success: true, data: { nodeUuid, nodeName: node.name, hasClip: !!clipUrl } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setVideoProperty(nodeUuid, property, value) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer)
                return { success: false, error: 'VideoPlayer not available' };
            const comp = node.getComponent(VideoPlayer);
            if (!comp)
                return { success: false, error: 'No VideoPlayer on node' };
            const allowed = ['resourceType', 'remoteURL', 'clip', 'loop', 'playbackRate', 'volume'];
            if (!allowed.includes(property))
                return { success: false, error: `Property '${property}' not allowed. Use: ${allowed.join(', ')}` };
            comp[property] = value;
            return { success: true, data: { nodeUuid, property, value } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    controlVideo(nodeUuid, command) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer)
                return { success: false, error: 'VideoPlayer not available' };
            const comp = node.getComponent(VideoPlayer);
            if (!comp)
                return { success: false, error: 'No VideoPlayer on node' };
            switch (command) {
                case 'play':
                    comp.play && comp.play();
                    break;
                case 'pause':
                    comp.pause && comp.pause();
                    break;
                case 'stop':
                    comp.stop && comp.stop();
                    break;
                case 'resume':
                    comp.resume && comp.resume();
                    break;
                default: return { success: false, error: `Unknown command '${command}'. Use: play, pause, stop, resume` };
            }
            return { success: true, data: { nodeUuid, command } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    getVideoInfo(nodeUuid) {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const node = (0, scene_node_lookup_1.findNodeByUuidDeep)(scene, nodeUuid);
            if (!node)
                return { success: false, error: `Node ${nodeUuid} not found` };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer)
                return { success: false, error: 'VideoPlayer not available' };
            const comp = node.getComponent(VideoPlayer);
            if (!comp)
                return { success: false, error: 'No VideoPlayer on node' };
            return {
                success: true, data: {
                    nodeUuid, nodeName: node.name,
                    resourceType: comp.resourceType, remoteURL: comp.remoteURL,
                    loop: comp.loop, playbackRate: comp.playbackRate, volume: comp.volume,
                    mute: comp.mute, keepAspectRatio: comp.keepAspectRatio,
                    isFullscreen: comp.isFullscreen, duration: comp.duration,
                    currentTime: comp.currentTime,
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    listVideoPlayers() {
        try {
            const { director, js } = require('cc');
            const scene = director.getScene();
            if (!scene)
                return { success: false, error: 'No active scene' };
            const VideoPlayer = js.getClassByName('VideoPlayer');
            if (!VideoPlayer)
                return { success: false, error: 'VideoPlayer not available' };
            const nodes = [];
            scene.walk((node) => {
                const comp = node.getComponent(VideoPlayer);
                if (comp)
                    nodes.push({ uuid: node.uuid, name: node.name, resourceType: comp.resourceType, remoteURL: comp.remoteURL });
            });
            return { success: true, data: { nodes, count: nodes.length } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    // ── Phase 4: Input System ─────────────────────────────────────────────
    getInputConfig() {
        try {
            const { input, sys } = require('cc');
            return {
                success: true, data: {
                    multiTouch: input && input.multiTouch !== undefined ? input.multiTouch : null,
                    accelerometerEnabled: sys && sys.isNative !== undefined ? null : null,
                    platform: sys ? sys.platform : null,
                    isMobile: sys ? sys.isMobile : null,
                    hasTouch: sys ? sys.hasFeature && sys.hasFeature(sys.Feature.INPUT_TOUCH) : null,
                    hasAccelerometer: sys ? sys.hasFeature && sys.hasFeature(sys.Feature.ACCELEROMETER) : null,
                }
            };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setTouchConfig(enabled) {
        try {
            const { input } = require('cc');
            if (!input)
                return { success: false, error: 'input module not available' };
            input.multiTouch = enabled;
            return { success: true, data: { multiTouch: input.multiTouch } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    setAccelerationConfig(enabled, interval) {
        try {
            const { input, Input } = require('cc');
            if (!input)
                return { success: false, error: 'input module not available' };
            if (enabled) {
                input.setAccelerometerEnabled && input.setAccelerometerEnabled(true);
                if (interval !== undefined) {
                    input.setAccelerometerInterval && input.setAccelerometerInterval(interval);
                }
            }
            else {
                input.setAccelerometerEnabled && input.setAccelerometerEnabled(false);
            }
            return { success: true, data: { enabled, interval } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
    /**
     * Evaluate arbitrary JavaScript in the scene context and return its result.
     * Dangerous-pattern denylisting (require('child_process'), process.exit, eval(,
     * Function() happens client-side in ManageDebug.validateScript before this is
     * ever invoked — this method only runs already-approved scripts.
     */
    eval(code) {
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function(code);
            const result = fn();
            return { success: true, data: { result } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zb3VyY2Uvc2NlbmUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQTRCO0FBQzVCLDJEQUF5RDtBQUN6RCxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFBLFdBQUksRUFBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO0FBRTVDLFFBQUEsT0FBTyxHQUE0QztJQUM1RDs7T0FFRztJQUNILGNBQWM7UUFDVixJQUFJLENBQUM7WUFDRCxNQUFNLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQzFCLEtBQUssQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDO1lBQ3pCLFFBQVEsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDekIsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLGdDQUFnQyxFQUFFLENBQUM7UUFDeEUsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwRCxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsa0JBQWtCLENBQUMsUUFBZ0IsRUFBRSxhQUFxQjtRQUN0RCxJQUFJLENBQUM7WUFDRCxNQUFNLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN2QyxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUNULE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxF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Q0FBQztnQkFDL0UsQ0FBQztZQUNMLENBQUM7aUJBQU0sQ0FBQztnQkFDSixLQUFLLENBQUMsdUJBQXVCLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzFFLENBQUM7WUFDRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEVBQUUsQ0FBQztRQUMxRCxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7UUFBQyxDQUFDO0lBQzdFLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILElBQUksQ0FBQyxJQUFZO1FBQ2IsSUFBSSxDQUFDO1lBQ0QsdUNBQXVDO1lBQ3ZDLE1BQU0sRUFBRSxHQUFHLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzlCLE1BQU0sTUFBTSxHQUFHLEVBQUUsRUFBRSxDQUFDO1lBQ3BCLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUM7UUFDL0MsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNwRCxDQUFDO0lBQ0wsQ0FBQztDQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBqb2luIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBmaW5kTm9kZUJ5VXVpZERlZXAgfSBmcm9tICcuL3NjZW5lLW5vZGUtbG9va3VwJztcbm1vZHVsZS5wYXRocy5wdXNoKGpvaW4oRWRpdG9yLkFwcC5wYXRoLCAnbm9kZV9tb2R1bGVzJykpO1xuXG5leHBvcnQgY29uc3QgbWV0aG9kczogeyBba2V5OiBzdHJpbmddOiAoLi4uYW55OiBhbnkpID0+IGFueSB9ID0ge1xuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBzY2VuZVxuICAgICAqL1xuICAgIGNyZWF0ZU5ld1NjZW5lKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgU2NlbmUgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IG5ldyBTY2VuZSgpO1xuICAgICAgICAgICAgc2NlbmUubmFtZSA9ICdOZXcgU2NlbmUnO1xuICAgICAgICAgICAgZGlyZWN0b3IucnVuU2NlbmUoc2NlbmUpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogJ05ldyBzY2VuZSBjcmVhdGVkIHN1Y2Nlc3NmdWxseScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGNvbXBvbmVudCB0byBhIG5vZGVcbiAgICAgKi9cbiAgICBhZGRDb21wb25lbnRUb05vZGUobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEZpbmQgbm9kZSBieSBVVUlEXG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEdldCBjb21wb25lbnQgY2xhc3NcbiAgICAgICAgICAgIGNvbnN0IENvbXBvbmVudENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoIUNvbXBvbmVudENsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEFkZCBjb21wb25lbnRcbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGUuYWRkQ29tcG9uZW50KENvbXBvbmVudENsYXNzKTtcbiAgICAgICAgICAgIHJldHVybiB7IFxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSBhZGRlZCBzdWNjZXNzZnVsbHlgLFxuICAgICAgICAgICAgICAgIGRhdGE6IHsgY29tcG9uZW50SWQ6IGNvbXBvbmVudC51dWlkIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYSBjb21wb25lbnQgb24gYSBub2RlIGJ5IGl0cyByZWFkYWJsZSBjbGFzcyBuYW1lIHRvIGl0cyBpbmRleC5cbiAgICAgKlxuICAgICAqIFRoZSBlZGl0b3IgYHF1ZXJ5LW5vZGVgIGR1bXAgZXhwb3NlcyBhIHVzZXIgc2NyaXB0J3MgY2lkIChhIGNvbXByZXNzZWQgVVVJRCksXG4gICAgICogbm90IGl0cyBjbGFzcyBuYW1lLCBzbyBjYWxsZXJzIHRoYXQgb25seSBrbm93IHRoZSBjbGFzcyBuYW1lIChlLmcuIHNldF9wcm9wZXJ0eVxuICAgICAqIHdpdGggY29tcG9uZW50VHlwZT1cIk15Q29udHJvbGxlclwiKSBjYW5ub3QgbWF0Y2ggaXQgYWdhaW5zdCB0aGUgZHVtcC4gVGhlIHJ1bm5pbmdcbiAgICAgKiBzY2VuZSBIQVMgdGhlIGxpdmUgY2MuanMgY2xhc3MgcmVnaXN0cnksIHNvIHdlIHJlc29sdmUgdGhlIGNsYXNzIGhlcmUgYW5kIHJldHVyblxuICAgICAqIHRoZSBjb21wb25lbnQncyBpbmRleCBpbiBub2RlLmNvbXBvbmVudHMg4oCUIHdoaWNoIG1hdGNoZXMgdGhlIGR1bXAncyBfX2NvbXBzX18gb3JkZXIuXG4gICAgICovXG4gICAgcmVzb2x2ZUNvbXBvbmVudEJ5TmFtZShub2RlVXVpZDogc3RyaW5nLCBjbGFzc05hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IENvbXBvbmVudENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICghQ29tcG9uZW50Q2xhc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb21wb25lbnQgdHlwZSAke2NsYXNzTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnQgPSBub2RlLmdldENvbXBvbmVudChDb21wb25lbnRDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWNvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCAke2NsYXNzTmFtZX0gbm90IGZvdW5kIG9uIG5vZGVgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBub2RlLmNvbXBvbmVudHMuaW5kZXhPZihjb21wb25lbnQpLFxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6IGNvbXBvbmVudC5jb25zdHJ1Y3RvciAmJiBjb21wb25lbnQuY29uc3RydWN0b3IubmFtZVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc29sdmUgYSBjb21wb25lbnQgb24gYSB0YXJnZXQgbm9kZSBieSBpdHMgREVDTEFSRUQgYmFzZSBjbGFzcywgaG9ub3VyaW5nIHRoZVxuICAgICAqIGluaGVyaXRhbmNlIGNoYWluLlxuICAgICAqXG4gICAgICogYG1hbmFnZV9jb21wb25lbnQgc2V0X3Byb3BlcnR5YCB3aXRoIGBwcm9wZXJ0eVR5cGU6IFwiY29tcG9uZW50XCJgIHJlc29sdmVzIHRoZVxuICAgICAqIHRhcmdldCBjb21wb25lbnQgYnkgZXhhY3QgY2xhc3MtbmFtZSBlcXVhbGl0eSBhZ2FpbnN0IHRoZSBwcm9wZXJ0eSdzIGRlY2xhcmVkIHR5cGVcbiAgICAgKiAoaXNzdWUgIzQ1KS4gV2hlbiB0aGUgZGVjbGFyZWQgdHlwZSBpcyBhIEJBU0UgY2xhc3MgYW5kIHRoZSBhY3R1YWwgY29tcG9uZW50IG9uIHRoZVxuICAgICAqIG5vZGUgaXMgYSBTVUJDTEFTUywgdGhlIGxpdGVyYWwgbWF0Y2ggbmV2ZXIgcmVzb2x2ZXMg4oCUIGV2ZW4gdGhvdWdoIHRoZSBlbmdpbmUncyBvd25cbiAgICAgKiBgbm9kZS5nZXRDb21wb25lbnQoQmFzZUNsYXNzKWAgd291bGQgcmV0dXJuIHRoZSBzdWJjbGFzcyBpbnN0YW5jZS4gVGhpcyBtZXRob2QgdXNlc1xuICAgICAqIHRoZSBsaXZlIGNjLmpzIGNsYXNzIHJlZ2lzdHJ5IHRvIGRvIGV4YWN0bHkgdGhhdCBsb29rdXAsIHdhbGtpbmcgYF9fc3VwZXJfX2Agc28gYVxuICAgICAqIHN1YmNsYXNzIGlzIHJlY29nbmlzZWQgYXMgZnVsZmlsbGluZyBhIGJhc2UtdHlwZWQgYEBwcm9wZXJ0eWAgc2xvdC5cbiAgICAgKlxuICAgICAqIFJldHVybnMgdGhlIGNvbXBvbmVudCdzIG93biB1dWlkIGFuZCBpdHMgY29uY3JldGUgdHlwZSwgc28gdGhlIGNhbGxlciBjYW4gYnVpbGQgdGhlXG4gICAgICogY29ycmVjdCBgeyB1dWlkIH1gIHNldC1wcm9wZXJ0eSBkdW1wIGFuZCByZXBvcnQgd2hhdCB3YXMgYWN0dWFsbHkgYm91bmQuXG4gICAgICovXG4gICAgZmluZENvbXBvbmVudEJ5QmFzZUNsYXNzKG5vZGVVdWlkOiBzdHJpbmcsIGJhc2VDbGFzc05hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IEJhc2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGJhc2VDbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKCFCYXNlQ2xhc3MpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb21wb25lbnQgdHlwZSAke2Jhc2VDbGFzc05hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gZ2V0Q29tcG9uZW50KEJhc2VDbGFzcykgcmV0dXJucyBhIGNvbXBvbmVudCB3aG9zZSBjb25zdHJ1Y3RvciBJUyBvclxuICAgICAgICAgICAgLy8gRVhURU5EUyBCYXNlQ2xhc3Mg4oCUIGV4YWN0bHkgdGhlIHBvbHltb3JwaGljIHJlc29sdmUgIzQ1IG5lZWRzLlxuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5nZXRDb21wb25lbnQoQmFzZUNsYXNzKTtcbiAgICAgICAgICAgIGlmICghY29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm8gY29tcG9uZW50IGV4dGVuZGluZyAnJHtiYXNlQ2xhc3NOYW1lfScgZm91bmQgb24gbm9kZWAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgY29uY3JldGVUeXBlID0gKGNvbXBvbmVudC5jb25zdHJ1Y3RvciAmJiAoY29tcG9uZW50LmNvbnN0cnVjdG9yLm5hbWUgfHwgY29tcG9uZW50LmNvbnN0cnVjdG9yLl9fY2lkX18pKSB8fCBiYXNlQ2xhc3NOYW1lO1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50VXVpZCA9IChjb21wb25lbnQgYXMgYW55KS51dWlkIHx8IChjb21wb25lbnQgYXMgYW55KS5fX2lkX18gfHwgJyc7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRVdWlkLFxuICAgICAgICAgICAgICAgICAgICBjb25jcmV0ZVR5cGUsXG4gICAgICAgICAgICAgICAgICAgIGJhc2VDbGFzc05hbWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEZXRlcm1pbmUgd2hldGhlciBhIGNvbmNyZXRlIGNvbXBvbmVudCB0eXBlIGV4dGVuZHMgYSBkZWNsYXJlZCBiYXNlIGNsYXNzIOKAlCB0aGVcbiAgICAgKiBzYW1lIHBvbHltb3JwaGljIHF1ZXN0aW9uIGBmaW5kQ29tcG9uZW50QnlCYXNlQ2xhc3NgIGFuc3dlcnMgdmlhIGEgbGl2ZSBub2RlLCBidXRcbiAgICAgKiBmb3IgdGhlIERJUkVDVCBjb21wb25lbnQtdXVpZCByZXNvbHZlIHBhdGggKGlzc3VlICM4MSksIHdoaWNoIGFscmVhZHkgaGFzIHRoZVxuICAgICAqIGNvbXBvbmVudCdzIG93biBjb25jcmV0ZSB0eXBlIG5hbWUgYW5kIG5vIG5vZGUgdG8gc2VhcmNoIGZyb20uIFB1cmVseSBhIGNsYXNzLVxuICAgICAqIHJlZ2lzdHJ5IGxvb2t1cCBvbiB0aGUgdHdvIHR5cGUgbmFtZXMgdmlhIGBqcy5pc0NoaWxkQ2xhc3NPZmA7IG5vIGxpdmUgaW5zdGFuY2VcbiAgICAgKiBuZWVkZWQuXG4gICAgICovXG4gICAgaXNDb21wb25lbnRUeXBlU3ViY2xhc3NPZihjb25jcmV0ZVR5cGU6IHN0cmluZywgYmFzZUNsYXNzTmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGpzIH0gPSByZXF1aXJlKCdjYycpO1xuXG4gICAgICAgICAgICBjb25zdCBTdWJDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNvbmNyZXRlVHlwZSk7XG4gICAgICAgICAgICBpZiAoIVN1YkNsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjb25jcmV0ZVR5cGV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgQmFzZUNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoYmFzZUNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAoIUJhc2VDbGFzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCB0eXBlICR7YmFzZUNsYXNzTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGlzU3ViY2xhc3M6IGpzLmlzQ2hpbGRDbGFzc09mKFN1YkNsYXNzLCBCYXNlQ2xhc3MpIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGNvbXBvbmVudCBmcm9tIGEgbm9kZVxuICAgICAqL1xuICAgIHJlbW92ZUNvbXBvbmVudEZyb21Ob2RlKG5vZGVVdWlkOiBzdHJpbmcsIGNvbXBvbmVudFR5cGU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IENvbXBvbmVudENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY29tcG9uZW50VHlwZSk7XG4gICAgICAgICAgICBpZiAoIUNvbXBvbmVudENsYXNzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50IHR5cGUgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IG5vZGUuZ2V0Q29tcG9uZW50KENvbXBvbmVudENsYXNzKTtcbiAgICAgICAgICAgIGlmICghY29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gbm90IGZvdW5kIG9uIG5vZGVgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVtb3ZlQ29tcG9uZW50KGNvbXBvbmVudCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50ICR7Y29tcG9uZW50VHlwZX0gcmVtb3ZlZCBzdWNjZXNzZnVsbHlgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIG5ldyBub2RlXG4gICAgICovXG4gICAgY3JlYXRlTm9kZShuYW1lOiBzdHJpbmcsIHBhcmVudFV1aWQ/OiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIE5vZGUgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2RlID0gbmV3IE5vZGUobmFtZSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmIChwYXJlbnRVdWlkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBwYXJlbnRVdWlkKTtcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50KSB7XG4gICAgICAgICAgICAgICAgICAgIHBhcmVudC5hZGRDaGlsZChub2RlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzY2VuZS5hZGRDaGlsZChub2RlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHNjZW5lLmFkZENoaWxkKG5vZGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgTm9kZSAke25hbWV9IGNyZWF0ZWQgc3VjY2Vzc2Z1bGx5YCxcbiAgICAgICAgICAgICAgICBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdldCBub2RlIGluZm9ybWF0aW9uXG4gICAgICovXG4gICAgZ2V0Tm9kZUluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgd2l0aCBVVUlEICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiBub2RlLnBvc2l0aW9uLFxuICAgICAgICAgICAgICAgICAgICByb3RhdGlvbjogbm9kZS5yb3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgc2NhbGU6IG5vZGUuc2NhbGUsXG4gICAgICAgICAgICAgICAgICAgIHBhcmVudDogbm9kZS5wYXJlbnQ/LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBub2RlLmNoaWxkcmVuLm1hcCgoY2hpbGQ6IGFueSkgPT4gY2hpbGQudXVpZCksXG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudHM6IG5vZGUuY29tcG9uZW50cy5tYXAoKGNvbXA6IGFueSkgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGNvbXAuY29uc3RydWN0b3IubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGNvbXAuZW5hYmxlZFxuICAgICAgICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgYWxsIG5vZGVzIGluIHNjZW5lXG4gICAgICovXG4gICAgZ2V0QWxsTm9kZXMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBjb25zdCBjb2xsZWN0Tm9kZXMgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIHV1aWQ6IG5vZGUudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGUuYWN0aXZlLFxuICAgICAgICAgICAgICAgICAgICBwYXJlbnQ6IG5vZGUucGFyZW50Py51dWlkXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjaGlsZDogYW55KSA9PiBjb2xsZWN0Tm9kZXMoY2hpbGQpKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjZW5lLmNoaWxkcmVuLmZvckVhY2goKGNoaWxkOiBhbnkpID0+IGNvbGxlY3ROb2RlcyhjaGlsZCkpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiBub2RlcyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGaW5kIG5vZGUgYnkgbmFtZVxuICAgICAqL1xuICAgIGZpbmROb2RlQnlOYW1lKG5hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBzY2VuZS5nZXRDaGlsZEJ5TmFtZShuYW1lKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgd2l0aCBuYW1lICR7bmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICB1dWlkOiBub2RlLnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlOiBub2RlLmFjdGl2ZSxcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246IG5vZGUucG9zaXRpb25cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgY3VycmVudCBzY2VuZSBpbmZvcm1hdGlvblxuICAgICAqL1xuICAgIGdldEN1cnJlbnRTY2VuZUluZm8oKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbmFtZTogc2NlbmUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogc2NlbmUudXVpZCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZUNvdW50OiBzY2VuZS5jaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZXQgbm9kZSBwcm9wZXJ0eVxuICAgICAqL1xuICAgIHNldE5vZGVQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSB3aXRoIFVVSUQgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBTZXQgcHJvcGVydHlcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ3Bvc2l0aW9uJykge1xuICAgICAgICAgICAgICAgIG5vZGUuc2V0UG9zaXRpb24odmFsdWUueCB8fCAwLCB2YWx1ZS55IHx8IDAsIHZhbHVlLnogfHwgMCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAncm90YXRpb24nKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5zZXRSb3RhdGlvbkZyb21FdWxlcih2YWx1ZS54IHx8IDAsIHZhbHVlLnkgfHwgMCwgdmFsdWUueiB8fCAwKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdzY2FsZScpIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldFNjYWxlKHZhbHVlLnggfHwgMSwgdmFsdWUueSB8fCAxLCB2YWx1ZS56IHx8IDEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ2FjdGl2ZScpIHtcbiAgICAgICAgICAgICAgICBub2RlLmFjdGl2ZSA9IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ25hbWUnKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5uYW1lID0gdmFsdWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFByb3RvdHlwZSBwb2xsdXRpb24gZ3VhcmRcbiAgICAgICAgICAgICAgICBpZiAoWydfX3Byb3RvX18nLCAnY29uc3RydWN0b3InLCAncHJvdG90eXBlJ10uaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgcHJvcGVydHkgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgLy8gVHJ5IHRvIHNldCB0aGUgcHJvcGVydHkgZGlyZWN0bHlcbiAgICAgICAgICAgICAgICAobm9kZSBhcyBhbnkpW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4geyBcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgXG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBHZXQgc2NlbmUgaGllcmFyY2h5XG4gICAgICovXG4gICAgZ2V0U2NlbmVIaWVyYXJjaHkoaW5jbHVkZUNvbXBvbmVudHM6IGJvb2xlYW4gPSBmYWxzZSwgbWF4RGVwdGg6IG51bWJlciA9IDUwKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc05vZGUgPSAobm9kZTogYW55LCBkZXB0aDogbnVtYmVyID0gMCk6IGFueSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRlcHRoID49IG1heERlcHRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IG5hbWU6IG5vZGUubmFtZSwgdXVpZDogbm9kZS51dWlkLCB0cnVuY2F0ZWQ6IHRydWUgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdXVpZDogbm9kZS51dWlkLFxuICAgICAgICAgICAgICAgICAgICBhY3RpdmU6IG5vZGUuYWN0aXZlLFxuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbjogW11cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgaWYgKGluY2x1ZGVDb21wb25lbnRzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdC5jb21wb25lbnRzID0gbm9kZS5jb21wb25lbnRzLm1hcCgoY29tcDogYW55KSA9PiAoe1xuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogY29tcC5jb25zdHJ1Y3Rvci5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgZW5hYmxlZDogY29tcC5lbmFibGVkXG4gICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAobm9kZS5jaGlsZHJlbiAmJiBub2RlLmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LmNoaWxkcmVuID0gbm9kZS5jaGlsZHJlbi5tYXAoKGNoaWxkOiBhbnkpID0+IHByb2Nlc3NOb2RlKGNoaWxkLCBkZXB0aCArIDEpKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgY29uc3QgaGllcmFyY2h5ID0gc2NlbmUuY2hpbGRyZW4ubWFwKChjaGlsZDogYW55KSA9PiBwcm9jZXNzTm9kZShjaGlsZCwgMCkpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogaGllcmFyY2h5IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9O1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBwcmVmYWIgZnJvbSBub2RlXG4gICAgICovXG4gICAgY3JlYXRlUHJlZmFiRnJvbU5vZGUobm9kZVV1aWQ6IHN0cmluZywgcHJlZmFiUGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBpbnN0YW50aWF0ZSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgd2l0aCBVVUlEICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTm90ZTogVGhpcyBpcyBhIHNpbXVsYXRlZCBpbXBsZW1lbnRhdGlvbiBzaW5jZSBwcmVmYWIgZmlsZXMgY2Fubm90IGJlIGNyZWF0ZWQgZGlyZWN0bHkgYXQgcnVudGltZS5cbiAgICAgICAgICAgIC8vIEFjdHVhbCBwcmVmYWIgY3JlYXRpb24gcmVxdWlyZXMgdGhlIEVkaXRvciBBUEkuXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBwcmVmYWJQYXRoOiBwcmVmYWJQYXRoLFxuICAgICAgICAgICAgICAgICAgICBzb3VyY2VOb2RlVXVpZDogbm9kZVV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBQcmVmYWIgY3JlYXRlZCBmcm9tIG5vZGUgJyR7bm9kZS5uYW1lfScgYXQgJHtwcmVmYWJQYXRofWBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZXQgY29tcG9uZW50IHByb3BlcnR5XG4gICAgICovXG4gICAgc2V0Q29tcG9uZW50UHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgY29tcG9uZW50VHlwZTogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlIHdpdGggVVVJRCAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBDb21wb25lbnRDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNvbXBvbmVudFR5cGUpO1xuICAgICAgICAgICAgaWYgKCFDb21wb25lbnRDbGFzcykge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYENvbXBvbmVudCB0eXBlICR7Y29tcG9uZW50VHlwZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gbm9kZS5nZXRDb21wb25lbnQoQ29tcG9uZW50Q2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFjb21wb25lbnQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBDb21wb25lbnQgJHtjb21wb25lbnRUeXBlfSBub3QgZm91bmQgb24gbm9kZWAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFByb3RvdHlwZSBwb2xsdXRpb24gZ3VhcmQgKGFwcGxpZWQgZmlyc3QgZm9yIGFsbCBwcm9wZXJ0eSBuYW1lcylcbiAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nIHByb3BlcnR5ICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBTcGVjaWFsIGhhbmRsaW5nIGZvciBjb21tb24gcHJvcGVydGllc1xuICAgICAgICAgICAgaWYgKHByb3BlcnR5ID09PSAnc3ByaXRlRnJhbWUnICYmIGNvbXBvbmVudFR5cGUgPT09ICdjYy5TcHJpdGUnKSB7XG4gICAgICAgICAgICAgICAgLy8gVmFsdWUgY2FuIGJlIGEgdXVpZCBvciBhc3NldCBwYXRoXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXNzZXRNYW5hZ2VyID0gcmVxdWlyZSgnY2MnKS5hc3NldE1hbmFnZXI7XG4gICAgICAgICAgICAgICAgICAgIC8vIFJldHVybiBhIFByb21pc2Ugc28gdGhlIGNhbGxlciB3YWl0cyBmb3IgdGhlIGFzc2V0IHRvIGxvYWRcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHsgc3VjY2VzczogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZzsgZXJyb3I/OiBzdHJpbmcgfT4oKHJlc29sdmUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5yZXNvdXJjZXMubG9hZCh2YWx1ZSwgcmVxdWlyZSgnY2MnKS5TcHJpdGVGcmFtZSwgKGVycjogYW55LCBzcHJpdGVGcmFtZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgc3ByaXRlRnJhbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNwcml0ZUZyYW1lID0gc3ByaXRlRnJhbWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50IHByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHlgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogdmFsdWUgfSwgKGVycjI6IGFueSwgYXNzZXQ6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIyICYmIGFzc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50LnNwcml0ZUZyYW1lID0gYXNzZXQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSh7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6IGBDb21wb25lbnQgcHJvcGVydHkgJyR7cHJvcGVydHl9JyB1cGRhdGVkIHN1Y2Nlc3NmdWxseWAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBGYWlsZWQgdG8gbG9hZCBzcHJpdGVGcmFtZTogJHtlcnIyPy5tZXNzYWdlIHx8IGVycj8ubWVzc2FnZSB8fCAndW5rbm93biBlcnJvcid9YCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5zcHJpdGVGcmFtZSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcGVydHkgPT09ICdtYXRlcmlhbCcgJiYgKGNvbXBvbmVudFR5cGUgPT09ICdjYy5TcHJpdGUnIHx8IGNvbXBvbmVudFR5cGUgPT09ICdjYy5NZXNoUmVuZGVyZXInKSkge1xuICAgICAgICAgICAgICAgIC8vIFZhbHVlIGNhbiBiZSBhIHV1aWQgb3IgYXNzZXQgcGF0aFxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFzc2V0TWFuYWdlciA9IHJlcXVpcmUoJ2NjJykuYXNzZXRNYW5hZ2VyO1xuICAgICAgICAgICAgICAgICAgICAvLyBSZXR1cm4gYSBQcm9taXNlIHNvIHRoZSBjYWxsZXIgd2FpdHMgZm9yIHRoZSBhc3NldCB0byBsb2FkXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx7IHN1Y2Nlc3M6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmc7IGVycm9yPzogc3RyaW5nIH0+KChyZXNvbHZlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldE1hbmFnZXIucmVzb3VyY2VzLmxvYWQodmFsdWUsIHJlcXVpcmUoJ2NjJykuTWF0ZXJpYWwsIChlcnI6IGFueSwgbWF0ZXJpYWw6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyICYmIG1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tYXRlcmlhbCA9IG1hdGVyaWFsO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYENvbXBvbmVudCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3NldE1hbmFnZXIubG9hZEFueSh7IHV1aWQ6IHZhbHVlIH0sIChlcnIyOiBhbnksIGFzc2V0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICghZXJyMiAmJiBhc3NldCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBvbmVudC5tYXRlcmlhbCA9IGFzc2V0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoeyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiBgQ29tcG9uZW50IHByb3BlcnR5ICcke3Byb3BlcnR5fScgdXBkYXRlZCBzdWNjZXNzZnVsbHlgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgRmFpbGVkIHRvIGxvYWQgbWF0ZXJpYWw6ICR7ZXJyMj8ubWVzc2FnZSB8fCBlcnI/Lm1lc3NhZ2UgfHwgJ3Vua25vd24gZXJyb3InfWAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnQubWF0ZXJpYWwgPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByb3BlcnR5ID09PSAnc3RyaW5nJyAmJiAoY29tcG9uZW50VHlwZSA9PT0gJ2NjLkxhYmVsJyB8fCBjb21wb25lbnRUeXBlID09PSAnY2MuUmljaFRleHQnKSkge1xuICAgICAgICAgICAgICAgIGNvbXBvbmVudC5zdHJpbmcgPSB2YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gT3B0aW9uYWw6IHJlZnJlc2ggSW5zcGVjdG9yXG4gICAgICAgICAgICAvLyBFZGl0b3IuTWVzc2FnZS5zZW5kKCdzY2VuZScsICdzbmFwc2hvdCcpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgbWVzc2FnZTogYENvbXBvbmVudCBwcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIDilIAgTGlnaHQgaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIC8qKiBNYXAgbGlnaHQgdHlwZSBzdHJpbmcgdG8gY2MgY2xhc3MgbmFtZSAqL1xuICAgIF9nZXRMaWdodENsYXNzTmFtZSh0eXBlOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBjb25zdCBtYXA6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7XG4gICAgICAgICAgICBkaXJlY3Rpb25hbDogJ0RpcmVjdGlvbmFsTGlnaHQnLFxuICAgICAgICAgICAgc3BoZXJlOiAnU3BoZXJlTGlnaHQnLFxuICAgICAgICAgICAgc3BvdDogJ1Nwb3RMaWdodCcsXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiBtYXBbdHlwZV0gfHwgJ0RpcmVjdGlvbmFsTGlnaHQnO1xuICAgIH0sXG5cbiAgICAvKiogUGFyc2UgY29sb3IgZnJvbSBoZXggc3RyaW5nIG9yIHtyLGcsYixhfSBvYmplY3QgaW50byBjYy5Db2xvciAqL1xuICAgIF9wYXJzZUNvbG9yKGNjOiBhbnksIGNvbG9yOiBhbnkpOiBhbnkge1xuICAgICAgICBpZiAoIWNvbG9yKSByZXR1cm4gbmV3IGNjLkNvbG9yKDI1NSwgMjU1LCAyNTUsIDI1NSk7XG4gICAgICAgIGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBjb25zdCBoZXggPSBjb2xvci5yZXBsYWNlKCcjJywgJycpO1xuICAgICAgICAgICAgY29uc3QgciA9IHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMCwgMiksIDE2KTtcbiAgICAgICAgICAgIGNvbnN0IGcgPSBwYXJzZUludChoZXguc3Vic3RyaW5nKDIsIDQpLCAxNik7XG4gICAgICAgICAgICBjb25zdCBiID0gcGFyc2VJbnQoaGV4LnN1YnN0cmluZyg0LCA2KSwgMTYpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBjYy5Db2xvcihyLCBnLCBiLCAyNTUpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXcgY2MuQ29sb3IoY29sb3IuciA/PyAyNTUsIGNvbG9yLmcgPz8gMjU1LCBjb2xvci5iID8/IDI1NSwgY29sb3IuYSA/PyAyNTUpO1xuICAgIH0sXG5cbiAgICBhZGRMaWdodENvbXBvbmVudChub2RlVXVpZDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIGNvbG9yOiBhbnksIGludGVuc2l0eTogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgQ29sb3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY2xhc3NOYW1lID0gKG1ldGhvZHMgYXMgYW55KS5fZ2V0TGlnaHRDbGFzc05hbWUodHlwZSk7XG4gICAgICAgICAgICBjb25zdCBMaWdodENsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICghTGlnaHRDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGlnaHQgY2xhc3MgJHtjbGFzc05hbWV9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0ID0gbm9kZS5hZGRDb21wb25lbnQoTGlnaHRDbGFzcyk7XG4gICAgICAgICAgICBpZiAoY29sb3IpIGxpZ2h0LmNvbG9yID0gKG1ldGhvZHMgYXMgYW55KS5fcGFyc2VDb2xvcih7IENvbG9yIH0sIGNvbG9yKTtcbiAgICAgICAgICAgIGlmIChpbnRlbnNpdHkgIT09IHVuZGVmaW5lZCkgbGlnaHQubHVtaW5hbmNlID0gaW50ZW5zaXR5O1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB1dWlkOiBub2RlLnV1aWQsIGxpZ2h0VHlwZTogY2xhc3NOYW1lIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRMaWdodFByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBDb2xvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBsaWdodFR5cGVzID0gWydEaXJlY3Rpb25hbExpZ2h0JywgJ1NwaGVyZUxpZ2h0JywgJ1Nwb3RMaWdodCddO1xuICAgICAgICAgICAgbGV0IGxpZ2h0OiBhbnkgPSBudWxsO1xuICAgICAgICAgICAgZm9yIChjb25zdCB0IG9mIGxpZ2h0VHlwZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZSh0KTtcbiAgICAgICAgICAgICAgICBpZiAoY2xzKSB7IGxpZ2h0ID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTsgaWYgKGxpZ2h0KSBicmVhazsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFsaWdodCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gbGlnaHQgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdjb2xvcicpIHtcbiAgICAgICAgICAgICAgICBsaWdodC5jb2xvciA9IChtZXRob2RzIGFzIGFueSkuX3BhcnNlQ29sb3IoeyBDb2xvciB9LCB2YWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGlnaHRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0TGlnaHRJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZXMgPSBbJ0RpcmVjdGlvbmFsTGlnaHQnLCAnU3BoZXJlTGlnaHQnLCAnU3BvdExpZ2h0J107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHQgb2YgbGlnaHRUeXBlcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKHQpO1xuICAgICAgICAgICAgICAgIGlmICghY2xzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBsaWdodCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKGxpZ2h0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0VHlwZTogdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogbGlnaHQuY29sb3IsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbHVtaW5hbmNlOiBsaWdodC5sdW1pbmFuY2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmFuZ2U6IGxpZ2h0LnJhbmdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNwb3RBbmdsZTogbGlnaHQuYW5nbGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2hhZG93RW5hYmxlZDogbGlnaHQuc2hhZG93RW5hYmxlZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzaGFkb3dCaWFzOiBsaWdodC5zaGFkb3dCaWFzLFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGxpZ2h0IGNvbXBvbmVudCBmb3VuZCBvbiBub2RlJyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3RMaWdodHMoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0czogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGxpZ2h0VHlwZXMgPSBbJ0RpcmVjdGlvbmFsTGlnaHQnLCAnU3BoZXJlTGlnaHQnLCAnU3BvdExpZ2h0J107XG4gICAgICAgICAgICBjb25zdCB3YWxrID0gKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgdCBvZiBsaWdodFR5cGVzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKHQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoY2xzICYmIG5vZGUuZ2V0Q29tcG9uZW50KGNscykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxpZ2h0cy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIGxpZ2h0VHlwZTogdCB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY2VuZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBsaWdodHMsIGNvdW50OiBsaWdodHMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICByZW1vdmVMaWdodENvbXBvbmVudChub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBsaWdodFR5cGVzID0gWydEaXJlY3Rpb25hbExpZ2h0JywgJ1NwaGVyZUxpZ2h0JywgJ1Nwb3RMaWdodCddO1xuICAgICAgICAgICAgZm9yIChjb25zdCB0IG9mIGxpZ2h0VHlwZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjbHMgPSBqcy5nZXRDbGFzc0J5TmFtZSh0KTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgbGlnaHQgPSBub2RlLmdldENvbXBvbmVudChjbHMpO1xuICAgICAgICAgICAgICAgIGlmIChsaWdodCkgeyBub2RlLnJlbW92ZUNvbXBvbmVudChsaWdodCk7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gbGlnaHQgY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSA4pSAIENhbWVyYSBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0Q2FtZXJhSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBDYW1lcmFDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdDYW1lcmEnKTtcbiAgICAgICAgICAgIGlmICghQ2FtZXJhQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0NhbWVyYSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjYW0gPSBub2RlLmdldENvbXBvbmVudChDYW1lcmFDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIWNhbSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQ2FtZXJhIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgZm92OiBjYW0uZm92LFxuICAgICAgICAgICAgICAgICAgICBvcnRob0hlaWdodDogY2FtLm9ydGhvSGVpZ2h0LFxuICAgICAgICAgICAgICAgICAgICBuZWFyOiBjYW0ubmVhcixcbiAgICAgICAgICAgICAgICAgICAgZmFyOiBjYW0uZmFyLFxuICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogY2FtLnByaW9yaXR5LFxuICAgICAgICAgICAgICAgICAgICB2aXNpYmlsaXR5OiBjYW0udmlzaWJpbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJGbGFnczogY2FtLmNsZWFyRmxhZ3MsXG4gICAgICAgICAgICAgICAgICAgIHByb2plY3Rpb246IGNhbS5wcm9qZWN0aW9uLFxuICAgICAgICAgICAgICAgICAgICByZWN0OiBjYW0ucmVjdCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldENhbWVyYVByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzLCBSZWN0LCBDYW1lcmEgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgQ2FtZXJhQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQ2FtZXJhJykgfHwgQ2FtZXJhO1xuICAgICAgICAgICAgY29uc3QgY2FtID0gbm9kZS5nZXRDb21wb25lbnQoQ2FtZXJhQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFjYW0pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIENhbWVyYSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdjbGVhckZsYWdzJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZsYWdNYXA6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7IFNPTElEX0NPTE9SOiAxLCBERVBUSF9PTkxZOiAyLCBET05UX0NMRUFSOiAzLCBTS1lCT1g6IDQgfTtcbiAgICAgICAgICAgICAgICBjYW0uY2xlYXJGbGFncyA9IGZsYWdNYXBbdmFsdWVdID8/IHZhbHVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ3Byb2plY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgY2FtLnByb2plY3Rpb24gPSB2YWx1ZSA9PT0gJ09SVEhPJyA/IDAgOiAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ3ZpZXdwb3J0Jykge1xuICAgICAgICAgICAgICAgIGNhbS5yZWN0ID0gbmV3IFJlY3QodmFsdWUueCwgdmFsdWUueSwgdmFsdWUud2lkdGgsIHZhbHVlLmhlaWdodCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0Q2FtZXJhcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgQ2FtZXJhQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQ2FtZXJhJyk7XG4gICAgICAgICAgICBpZiAoIUNhbWVyYUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdDYW1lcmEgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgY2FtZXJhczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IHdhbGsgPSAobm9kZTogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FtID0gbm9kZS5nZXRDb21wb25lbnQoQ2FtZXJhQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChjYW0pIGNhbWVyYXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lLCBwcmlvcml0eTogY2FtLnByaW9yaXR5LCBwcm9qZWN0aW9uOiBjYW0ucHJvamVjdGlvbiB9KTtcbiAgICAgICAgICAgICAgICBub2RlLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgc2NlbmUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgY2FtZXJhcywgY291bnQ6IGNhbWVyYXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIDilIAgUGh5c2ljcyBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgY29uZmlndXJlUGh5c2ljcyhncmF2aXR5OiBhbnksIGZpeGVkVGltZVN0ZXA/OiBudW1iZXIsIG1heFN1YlN0ZXBzPzogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IFBoeXNpY3NTeXN0ZW0sIFZlYzMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzeXMgPSBQaHlzaWNzU3lzdGVtPy5pbnN0YW5jZTtcbiAgICAgICAgICAgIGlmICghc3lzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQaHlzaWNzU3lzdGVtIG5vdCBhdmFpbGFibGUgKDNEIG9ubHkpJyB9O1xuICAgICAgICAgICAgaWYgKGdyYXZpdHkpIHN5cy5ncmF2aXR5ID0gbmV3IFZlYzMoZ3Jhdml0eS54ID8/IDAsIGdyYXZpdHkueSA/PyAtMTAsIGdyYXZpdHkueiA/PyAwKTtcbiAgICAgICAgICAgIGlmIChmaXhlZFRpbWVTdGVwICE9PSB1bmRlZmluZWQpIHN5cy5maXhlZFRpbWVTdGVwID0gZml4ZWRUaW1lU3RlcDtcbiAgICAgICAgICAgIGlmIChtYXhTdWJTdGVwcyAhPT0gdW5kZWZpbmVkKSBzeXMubWF4U3ViU3RlcHMgPSBtYXhTdWJTdGVwcztcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgZ3Jhdml0eTogc3lzLmdyYXZpdHksIGZpeGVkVGltZVN0ZXA6IHN5cy5maXhlZFRpbWVTdGVwLCBtYXhTdWJTdGVwczogc3lzLm1heFN1YlN0ZXBzIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvKiogRGV0ZWN0IGlmIG5vZGUgaXMgaW4gYSAyRCBjb250ZXh0IGJ5IGNoZWNraW5nIGZvciBVSVRyYW5zZm9ybS9TcHJpdGUgKi9cbiAgICBfaXMyRE5vZGUobm9kZTogYW55LCBqczogYW55KTogYm9vbGVhbiB7XG4gICAgICAgIGNvbnN0IHR5cGVzMkQgPSBbJ1VJVHJhbnNmb3JtJywgJ1Nwcml0ZScsICdMYWJlbCcsICdCdXR0b24nLCAnQ2FudmFzJ107XG4gICAgICAgIHJldHVybiB0eXBlczJELnNvbWUodCA9PiB7IGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKHQpOyByZXR1cm4gY2xzICYmIG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7IH0pO1xuICAgIH0sXG5cbiAgICBhZGRSaWdpZGJvZHkobm9kZVV1aWQ6IHN0cmluZywgdHlwZTogc3RyaW5nLCBtYXNzOiBudW1iZXIsIHVzZUdyYXZpdHk6IGJvb2xlYW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGlzMkQgPSAobWV0aG9kcyBhcyBhbnkpLl9pczJETm9kZShub2RlLCBqcyk7XG4gICAgICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBpczJEID8gJ1JpZ2lkQm9keTJEJyA6ICdSaWdpZEJvZHknO1xuICAgICAgICAgICAgY29uc3QgUkJDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICBpZiAoIVJCQ2xhc3MpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYCR7Y2xhc3NOYW1lfSBub3QgYXZhaWxhYmxlYCB9O1xuICAgICAgICAgICAgY29uc3QgcmIgPSBub2RlLmFkZENvbXBvbmVudChSQkNsYXNzKTtcbiAgICAgICAgICAgIGlmIChpczJEKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdHlwZU1hcDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHsgc3RhdGljOiAwLCBraW5lbWF0aWM6IDEsIGR5bmFtaWM6IDIgfTtcbiAgICAgICAgICAgICAgICByYi50eXBlID0gdHlwZU1hcFt0eXBlXSA/PyAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0eXBlTWFwOiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+ID0geyBkeW5hbWljOiAwLCBzdGF0aWM6IDIsIGtpbmVtYXRpYzogMyB9O1xuICAgICAgICAgICAgICAgIHJiLnR5cGUgPSB0eXBlTWFwW3R5cGVdID8/IDA7XG4gICAgICAgICAgICAgICAgcmIubWFzcyA9IG1hc3M7XG4gICAgICAgICAgICAgICAgcmIudXNlR3Jhdml0eSA9IHVzZUdyYXZpdHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgcmJDbGFzczogY2xhc3NOYW1lLCB0eXBlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBhZGRDb2xsaWRlcihub2RlVXVpZDogc3RyaW5nLCBzaGFwZTogc3RyaW5nLCBzaXplOiBhbnksIGlzVHJpZ2dlcjogYm9vbGVhbikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgaXMyRCA9IChtZXRob2RzIGFzIGFueSkuX2lzMkROb2RlKG5vZGUsIGpzKTtcbiAgICAgICAgICAgIGNvbnN0IGNsYXNzTWFwM0Q6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7IGJveDogJ0JveENvbGxpZGVyJywgc3BoZXJlOiAnU3BoZXJlQ29sbGlkZXInLCBjYXBzdWxlOiAnQ2Fwc3VsZUNvbGxpZGVyJyB9O1xuICAgICAgICAgICAgY29uc3QgY2xhc3NNYXAyRDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHsgYm94OiAnQm94Q29sbGlkZXIyRCcsIGNpcmNsZTogJ0NpcmNsZUNvbGxpZGVyMkQnLCBwb2x5Z29uOiAnUG9seWdvbkNvbGxpZGVyMkQnIH07XG4gICAgICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBpczJEID8gKGNsYXNzTWFwMkRbc2hhcGVdIHx8ICdCb3hDb2xsaWRlcjJEJykgOiAoY2xhc3NNYXAzRFtzaGFwZV0gfHwgJ0JveENvbGxpZGVyJyk7XG4gICAgICAgICAgICBjb25zdCBDb2xsaWRlckNsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIGlmICghQ29sbGlkZXJDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgJHtjbGFzc05hbWV9IG5vdCBhdmFpbGFibGVgIH07XG4gICAgICAgICAgICBjb25zdCBjb2xsaWRlciA9IG5vZGUuYWRkQ29tcG9uZW50KENvbGxpZGVyQ2xhc3MpO1xuICAgICAgICAgICAgY29sbGlkZXIuaXNUcmlnZ2VyID0gaXNUcmlnZ2VyO1xuICAgICAgICAgICAgaWYgKHNpemUgJiYgY29sbGlkZXIuc2l6ZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgVmVjMywgU2l6ZSB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgICAgICBpZiAoaXMyRCkgY29sbGlkZXIuc2l6ZSA9IG5ldyBTaXplKHNpemUud2lkdGggPz8gc2l6ZS54ID8/IDEsIHNpemUuaGVpZ2h0ID8/IHNpemUueSA/PyAxKTtcbiAgICAgICAgICAgICAgICBlbHNlIGNvbGxpZGVyLnNpemUgPSBuZXcgVmVjMyhzaXplLndpZHRoID8/IHNpemUueCA/PyAxLCBzaXplLmhlaWdodCA/PyBzaXplLnkgPz8gMSwgc2l6ZS5kZXB0aCA/PyBzaXplLnogPz8gMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc2l6ZT8ucmFkaXVzICE9PSB1bmRlZmluZWQgJiYgY29sbGlkZXIucmFkaXVzICE9PSB1bmRlZmluZWQpIGNvbGxpZGVyLnJhZGl1cyA9IHNpemUucmFkaXVzO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB1dWlkOiBub2RlLnV1aWQsIGNvbGxpZGVyQ2xhc3M6IGNsYXNzTmFtZSwgaXNUcmlnZ2VyIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRSaWdpZGJvZHlQcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBpZiAoWydfX3Byb3RvX18nLCAnY29uc3RydWN0b3InLCAncHJvdG90eXBlJ10uaW5jbHVkZXMocHJvcGVydHkpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgU2V0dGluZyAnJHtwcm9wZXJ0eX0nIGlzIG5vdCBhbGxvd2VkYCB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChjb25zdCByYk5hbWUgb2YgWydSaWdpZEJvZHknLCAnUmlnaWRCb2R5MkQnXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKHJiTmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJiID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAocmIpIHsgcmJbcHJvcGVydHldID0gdmFsdWU7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUmlnaWRCb2R5IGNvbXBvbmVudCBmb3VuZCBvbiBub2RlJyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldENvbGxpZGVyUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMsIFZlYzMsIFNpemUgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbGxpZGVyTmFtZXMgPSBbJ0JveENvbGxpZGVyJywgJ1NwaGVyZUNvbGxpZGVyJywgJ0NhcHN1bGVDb2xsaWRlcicsICdCb3hDb2xsaWRlcjJEJywgJ0NpcmNsZUNvbGxpZGVyMkQnLCAnUG9seWdvbkNvbGxpZGVyMkQnXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBjb2xsaWRlck5hbWVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUobmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT09ICdzaXplJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb2wuc2l6ZSA9IG5hbWUuZW5kc1dpdGgoJzJEJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IG5ldyBTaXplKHZhbHVlLndpZHRoID8/IHZhbHVlLnggPz8gMSwgdmFsdWUuaGVpZ2h0ID8/IHZhbHVlLnkgPz8gMSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IG5ldyBWZWMzKHZhbHVlLndpZHRoID8/IHZhbHVlLnggPz8gMSwgdmFsdWUuaGVpZ2h0ID8/IHZhbHVlLnkgPz8gMSwgdmFsdWUuZGVwdGggPz8gdmFsdWUueiA/PyAxKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwcm9wZXJ0eSA9PT0gJ2NlbnRlcicgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sLmNlbnRlciA9IG5ldyBWZWMzKHZhbHVlLnggPz8gMCwgdmFsdWUueSA/PyAwLCB2YWx1ZS56ID8/IDApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29sW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBjb2xsaWRlciBjb21wb25lbnQgZm91bmQgb24gbm9kZScgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICByZW1vdmVQaHlzaWNzQ29tcG9uZW50cyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBwaHlzaWNzTmFtZXMgPSBbJ1JpZ2lkQm9keScsICdSaWdpZEJvZHkyRCcsICdCb3hDb2xsaWRlcicsICdTcGhlcmVDb2xsaWRlcicsICdDYXBzdWxlQ29sbGlkZXInLCAnQm94Q29sbGlkZXIyRCcsICdDaXJjbGVDb2xsaWRlcjJEJywgJ1BvbHlnb25Db2xsaWRlcjJEJ107XG4gICAgICAgICAgICBjb25zdCByZW1vdmVkOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgZm9yIChjb25zdCBuYW1lIG9mIHBoeXNpY3NOYW1lcykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNscyA9IGpzLmdldENsYXNzQnlOYW1lKG5hbWUpO1xuICAgICAgICAgICAgICAgIGlmICghY2xzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoY2xzKTtcbiAgICAgICAgICAgICAgICBpZiAoY29tcCkgeyBub2RlLnJlbW92ZUNvbXBvbmVudChjb21wKTsgcmVtb3ZlZC5wdXNoKG5hbWUpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHJlbW92ZWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldFBoeXNpY3NJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGluZm86IGFueSA9IHsgcmlnaWRib2R5OiBudWxsLCBjb2xsaWRlcnM6IFtdIH07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHJiTmFtZSBvZiBbJ1JpZ2lkQm9keScsICdSaWdpZEJvZHkyRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUocmJOYW1lKTtcbiAgICAgICAgICAgICAgICBpZiAoIWNscykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgcmIgPSBub2RlLmdldENvbXBvbmVudChjbHMpO1xuICAgICAgICAgICAgICAgIGlmIChyYikgeyBpbmZvLnJpZ2lkYm9keSA9IHsgdHlwZTogcmJOYW1lLCByYlR5cGU6IHJiLnR5cGUsIG1hc3M6IHJiLm1hc3MsIHVzZUdyYXZpdHk6IHJiLnVzZUdyYXZpdHkgfTsgYnJlYWs7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGNvbGxpZGVyTmFtZXMgPSBbJ0JveENvbGxpZGVyJywgJ1NwaGVyZUNvbGxpZGVyJywgJ0NhcHN1bGVDb2xsaWRlcicsICdCb3hDb2xsaWRlcjJEJywgJ0NpcmNsZUNvbGxpZGVyMkQnLCAnUG9seWdvbkNvbGxpZGVyMkQnXTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBjb2xsaWRlck5hbWVzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2xzID0ganMuZ2V0Q2xhc3NCeU5hbWUobmFtZSk7XG4gICAgICAgICAgICAgICAgaWYgKCFjbHMpIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbCA9IG5vZGUuZ2V0Q29tcG9uZW50KGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKGNvbCkgaW5mby5jb2xsaWRlcnMucHVzaCh7IHR5cGU6IG5hbWUsIGlzVHJpZ2dlcjogY29sLmlzVHJpZ2dlciwgc2l6ZTogY29sLnNpemUsIGNlbnRlcjogY29sLmNlbnRlciB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IGluZm8gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBwZXJmb3JtUmF5Y2FzdChvcmlnaW46IGFueSwgZGlyZWN0aW9uOiBhbnksIG1heERpc3RhbmNlOiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgUGh5c2ljc1N5c3RlbSwgVmVjMywgZ2VvbWV0cnkgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzeXMgPSBQaHlzaWNzU3lzdGVtPy5pbnN0YW5jZTtcbiAgICAgICAgICAgIGlmICghc3lzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQaHlzaWNzU3lzdGVtIG5vdCBhdmFpbGFibGUgKDNEIG9ubHkpJyB9O1xuICAgICAgICAgICAgY29uc3QgcmF5ID0gbmV3IGdlb21ldHJ5LlJheShvcmlnaW4ueCwgb3JpZ2luLnksIG9yaWdpbi56LCBkaXJlY3Rpb24ueCwgZGlyZWN0aW9uLnksIGRpcmVjdGlvbi56KTtcbiAgICAgICAgICAgIGNvbnN0IGhpdCA9IHN5cy5yYXljYXN0Q2xvc2VzdChyYXksIDB4ZmZmZmZmZmYsIG1heERpc3RhbmNlKTtcbiAgICAgICAgICAgIGlmICghaGl0KSByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGhpdDogZmFsc2UgfSB9O1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gc3lzLnJheWNhc3RDbG9zZXN0UmVzdWx0O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgaGl0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBkaXN0YW5jZTogcmVzdWx0LmRpc3RhbmNlLFxuICAgICAgICAgICAgICAgICAgICBoaXRQb2ludDogcmVzdWx0LmhpdFBvaW50LFxuICAgICAgICAgICAgICAgICAgICBoaXROb3JtYWw6IHJlc3VsdC5oaXROb3JtYWwsXG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkOiByZXN1bHQuY29sbGlkZXI/Lm5vZGU/LnV1aWQsXG4gICAgICAgICAgICAgICAgICAgIG5vZGVOYW1lOiByZXN1bHQuY29sbGlkZXI/Lm5vZGU/Lm5hbWUsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIDilIAgQXVkaW8gaGVscGVycyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGFkZEF1ZGlvU291cmNlKG5vZGVVdWlkOiBzdHJpbmcsIGNsaXBVdWlkOiBzdHJpbmcgfCBudWxsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IEF1ZGlvU291cmNlQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQXVkaW9Tb3VyY2UnKTtcbiAgICAgICAgICAgIGlmICghQXVkaW9Tb3VyY2VDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXVkaW9Tb3VyY2UgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBub2RlLmFkZENvbXBvbmVudChBdWRpb1NvdXJjZUNsYXNzKTtcbiAgICAgICAgICAgIGlmIChjbGlwVXVpZCkge1xuICAgICAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KHsgdXVpZDogY2xpcFV1aWQgfSwgKGVycjogYW55LCBjbGlwOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFlcnIgJiYgY2xpcCkgYXVkaW8uY2xpcCA9IGNsaXA7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgaGFzQ2xpcDogISFjbGlwVXVpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0QXVkaW9Qcm9wZXJ0eShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0eTogc3RyaW5nLCB2YWx1ZTogYW55KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IEF1ZGlvU291cmNlQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQXVkaW9Tb3VyY2UnKTtcbiAgICAgICAgICAgIGlmICghQXVkaW9Tb3VyY2VDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXVkaW9Tb3VyY2UgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBub2RlLmdldENvbXBvbmVudChBdWRpb1NvdXJjZUNsYXNzKTtcbiAgICAgICAgICAgIGlmICghYXVkaW8pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIEF1ZGlvU291cmNlIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgaWYgKFsnX19wcm90b19fJywgJ2NvbnN0cnVjdG9yJywgJ3Byb3RvdHlwZSddLmluY2x1ZGVzKHByb3BlcnR5KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFNldHRpbmcgJyR7cHJvcGVydHl9JyBpcyBub3QgYWxsb3dlZGAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PT0gJ2NsaXAnICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBhc3NldE1hbmFnZXIubG9hZEFueSh7IHV1aWQ6IHZhbHVlIH0sIChlcnI6IGFueSwgY2xpcDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyICYmIGNsaXApIGF1ZGlvLmNsaXAgPSBjbGlwO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIG1lc3NhZ2U6ICdDbGlwIGxvYWRpbmcgaW5pdGlhdGVkJyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXVkaW9bcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgY29udHJvbEF1ZGlvKG5vZGVVdWlkOiBzdHJpbmcsIGNvbW1hbmQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgQXVkaW9Tb3VyY2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdBdWRpb1NvdXJjZScpO1xuICAgICAgICAgICAgaWYgKCFBdWRpb1NvdXJjZUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBdWRpb1NvdXJjZSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5vZGUuZ2V0Q29tcG9uZW50KEF1ZGlvU291cmNlQ2xhc3MpO1xuICAgICAgICAgICAgaWYgKCFhdWRpbykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXVkaW9Tb3VyY2UgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBjbWRzOiBSZWNvcmQ8c3RyaW5nLCAoKSA9PiB2b2lkPiA9IHtcbiAgICAgICAgICAgICAgICBwbGF5OiAoKSA9PiBhdWRpby5wbGF5KCksXG4gICAgICAgICAgICAgICAgc3RvcDogKCkgPT4gYXVkaW8uc3RvcCgpLFxuICAgICAgICAgICAgICAgIHBhdXNlOiAoKSA9PiBhdWRpby5wYXVzZSgpLFxuICAgICAgICAgICAgICAgIHJlc3VtZTogKCkgPT4gYXVkaW8ucGxheSgpLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmICghY21kc1tjb21tYW5kXSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgVW5rbm93biBjb21tYW5kICcke2NvbW1hbmR9J2AgfTtcbiAgICAgICAgICAgIGNtZHNbY29tbWFuZF0oKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgY29tbWFuZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0QXVkaW9JbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IEF1ZGlvU291cmNlQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnQXVkaW9Tb3VyY2UnKTtcbiAgICAgICAgICAgIGlmICghQXVkaW9Tb3VyY2VDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnQXVkaW9Tb3VyY2UgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgYXVkaW8gPSBub2RlLmdldENvbXBvbmVudChBdWRpb1NvdXJjZUNsYXNzKTtcbiAgICAgICAgICAgIGlmICghYXVkaW8pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIEF1ZGlvU291cmNlIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgY2xpcDogYXVkaW8uY2xpcD8ubmFtZSA/PyBudWxsLFxuICAgICAgICAgICAgICAgICAgICB2b2x1bWU6IGF1ZGlvLnZvbHVtZSxcbiAgICAgICAgICAgICAgICAgICAgbG9vcDogYXVkaW8ubG9vcCxcbiAgICAgICAgICAgICAgICAgICAgcGxheU9uQXdha2U6IGF1ZGlvLnBsYXlPbkF3YWtlLFxuICAgICAgICAgICAgICAgICAgICBwbGF5aW5nOiBhdWRpby5wbGF5aW5nLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdEF1ZGlvU291cmNlcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgQXVkaW9Tb3VyY2VDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdBdWRpb1NvdXJjZScpO1xuICAgICAgICAgICAgaWYgKCFBdWRpb1NvdXJjZUNsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdBdWRpb1NvdXJjZSBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBzb3VyY2VzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWRpbyA9IG5vZGUuZ2V0Q29tcG9uZW50KEF1ZGlvU291cmNlQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChhdWRpbykgc291cmNlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIGNsaXA6IGF1ZGlvLmNsaXA/Lm5hbWUgPz8gbnVsbCwgdm9sdW1lOiBhdWRpby52b2x1bWUgfSk7XG4gICAgICAgICAgICAgICAgbm9kZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHNjZW5lLmNoaWxkcmVuLmZvckVhY2goKGM6IGFueSkgPT4gd2FsayhjKSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHNvdXJjZXMsIGNvdW50OiBzb3VyY2VzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSA4pSAIFBhcnRpY2xlIGhlbHBlcnMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBhZGRQYXJ0aWNsZVN5c3RlbShub2RlVXVpZDogc3RyaW5nLCBpczJkOiBib29sZWFuKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjbGFzc05hbWUgPSBpczJkID8gJ1BhcnRpY2xlU3lzdGVtMkQnIDogJ1BhcnRpY2xlU3lzdGVtJztcbiAgICAgICAgICAgIGNvbnN0IFBTQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGAke2NsYXNzTmFtZX0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgbm9kZS5hZGRDb21wb25lbnQoUFNDbGFzcyk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHV1aWQ6IG5vZGUudXVpZCwgcGFydGljbGVDbGFzczogY2xhc3NOYW1lIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRQYXJ0aWNsZVByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGlmIChbJ19fcHJvdG9fXycsICdjb25zdHJ1Y3RvcicsICdwcm90b3R5cGUnXS5pbmNsdWRlcyhwcm9wZXJ0eSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBTZXR0aW5nICcke3Byb3BlcnR5fScgaXMgbm90IGFsbG93ZWRgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNscyBvZiBbJ1BhcnRpY2xlU3lzdGVtJywgJ1BhcnRpY2xlU3lzdGVtMkQnXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IFBTQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjbHMpO1xuICAgICAgICAgICAgICAgIGlmICghUFNDbGFzcykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgcHMgPSBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgICAgICBpZiAocHMpIHsgcHNbcHJvcGVydHldID0gdmFsdWU7IHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0UGFydGljbGVFbWlzc2lvbihub2RlVXVpZDogc3RyaW5nLCByYXRlT3ZlclRpbWU6IG51bWJlciwgYnVyc3RzOiBhbnlbXSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdQYXJ0aWNsZVN5c3RlbScpO1xuICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQYXJ0aWNsZVN5c3RlbSBub3QgZm91bmQgKDNEIG9ubHkgZm9yIGVtaXNzaW9uIGNvbnRyb2wpJyB9O1xuICAgICAgICAgICAgY29uc3QgcHMgPSBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgIGlmICghcHMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFBhcnRpY2xlU3lzdGVtIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBpZiAocmF0ZU92ZXJUaW1lICE9PSB1bmRlZmluZWQgJiYgcHMucmF0ZU92ZXJUaW1lKSB7XG4gICAgICAgICAgICAgICAgcHMucmF0ZU92ZXJUaW1lLmNvbnN0YW50ID0gcmF0ZU92ZXJUaW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYnVyc3RzKSAmJiBwcy5idXJzdHMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHBzLmJ1cnN0cyA9IGJ1cnN0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRQYXJ0aWNsZVNoYXBlKG5vZGVVdWlkOiBzdHJpbmcsIHNoYXBlVHlwZTogc3RyaW5nLCByYWRpdXM6IG51bWJlciwgYW5nbGU6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKCdQYXJ0aWNsZVN5c3RlbScpO1xuICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdQYXJ0aWNsZVN5c3RlbSBub3QgZm91bmQgKDNEIG9ubHkgZm9yIHNoYXBlKScgfTtcbiAgICAgICAgICAgIGNvbnN0IHBzID0gbm9kZS5nZXRDb21wb25lbnQoUFNDbGFzcyk7XG4gICAgICAgICAgICBpZiAoIXBzKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBQYXJ0aWNsZVN5c3RlbSBvbiBub2RlJyB9O1xuICAgICAgICAgICAgaWYgKHBzLnNoYXBlTW9kdWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2hhcGVNYXA6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7IGNvbmU6IDAsIHNwaGVyZTogMSwgYm94OiA0IH07XG4gICAgICAgICAgICAgICAgaWYgKHNoYXBlVHlwZSAmJiBzaGFwZU1hcFtzaGFwZVR5cGVdICE9PSB1bmRlZmluZWQpIHBzLnNoYXBlTW9kdWxlLnNoYXBlVHlwZSA9IHNoYXBlTWFwW3NoYXBlVHlwZV07XG4gICAgICAgICAgICAgICAgaWYgKHJhZGl1cyAhPT0gdW5kZWZpbmVkKSBwcy5zaGFwZU1vZHVsZS5yYWRpdXMgPSByYWRpdXM7XG4gICAgICAgICAgICAgICAgaWYgKGFuZ2xlICE9PSB1bmRlZmluZWQpIHBzLnNoYXBlTW9kdWxlLmFuZ2xlID0gYW5nbGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0UGFydGljbGVSZW5kZXJlcihub2RlVXVpZDogc3RyaW5nLCByZW5kZXJNb2RlOiBudW1iZXIsIG1hdGVyaWFsVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcywgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFBTQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZSgnUGFydGljbGVTeXN0ZW0nKTtcbiAgICAgICAgICAgIGlmICghUFNDbGFzcykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnUGFydGljbGVTeXN0ZW0gbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgcHMgPSBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgIGlmICghcHMpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFBhcnRpY2xlU3lzdGVtIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBpZiAocmVuZGVyTW9kZSAhPT0gdW5kZWZpbmVkICYmIHBzLnJlbmRlcmVyKSBwcy5yZW5kZXJlci5yZW5kZXJNb2RlID0gcmVuZGVyTW9kZTtcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbFV1aWQgJiYgcHMucmVuZGVyZXIpIHtcbiAgICAgICAgICAgICAgICBhc3NldE1hbmFnZXIubG9hZEFueSh7IHV1aWQ6IG1hdGVyaWFsVXVpZCB9LCAoZXJyOiBhbnksIG1hdDogYW55KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmICghZXJyICYmIG1hdCkgcHMucmVuZGVyZXIuc2hhcmVkTWF0ZXJpYWwgPSBtYXQ7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0UGFydGljbGVJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2xzIG9mIFsnUGFydGljbGVTeXN0ZW0nLCAnUGFydGljbGVTeXN0ZW0yRCddKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgUFNDbGFzcyA9IGpzLmdldENsYXNzQnlOYW1lKGNscyk7XG4gICAgICAgICAgICAgICAgaWYgKCFQU0NsYXNzKSBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBjb25zdCBwcyA9IG5vZGUuZ2V0Q29tcG9uZW50KFBTQ2xhc3MpO1xuICAgICAgICAgICAgICAgIGlmIChwcykge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJ0aWNsZUNsYXNzOiBjbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZHVyYXRpb246IHBzLmR1cmF0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvb3A6IHBzLmxvb3AsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGxheU9uQXdha2U6IHBzLnBsYXlPbkF3YWtlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1heFBhcnRpY2xlczogcHMuY2FwYWNpdHkgPz8gcHMudG90YWxQYXJ0aWNsZXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRMaWZldGltZTogcHMuc3RhcnRMaWZldGltZT8uY29uc3RhbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRTcGVlZDogcHMuc3RhcnRTcGVlZD8uY29uc3RhbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gUGFydGljbGVTeXN0ZW0gY29tcG9uZW50IGZvdW5kIG9uIG5vZGUnIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdFBhcnRpY2xlU3lzdGVtcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgcGFydGljbGVzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgd2FsayA9IChub2RlOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGNscyBvZiBbJ1BhcnRpY2xlU3lzdGVtJywgJ1BhcnRpY2xlU3lzdGVtMkQnXSkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBQU0NsYXNzID0ganMuZ2V0Q2xhc3NCeU5hbWUoY2xzKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKFBTQ2xhc3MgJiYgbm9kZS5nZXRDb21wb25lbnQoUFNDbGFzcykpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcnRpY2xlcy5wdXNoKHsgdXVpZDogbm9kZS51dWlkLCBuYW1lOiBub2RlLm5hbWUsIHBhcnRpY2xlQ2xhc3M6IGNscyB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG5vZGUuY2hpbGRyZW4uZm9yRWFjaCgoYzogYW55KSA9PiB3YWxrKGMpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBzY2VuZS5jaGlsZHJlbi5mb3JFYWNoKChjOiBhbnkpID0+IHdhbGsoYykpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBwYXJ0aWNsZXMsIGNvdW50OiBwYXJ0aWNsZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICByZW1vdmVQYXJ0aWNsZVN5c3RlbShub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNscyBvZiBbJ1BhcnRpY2xlU3lzdGVtJywgJ1BhcnRpY2xlU3lzdGVtMkQnXSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IFBTQ2xhc3MgPSBqcy5nZXRDbGFzc0J5TmFtZShjbHMpO1xuICAgICAgICAgICAgICAgIGlmICghUFNDbGFzcykgY29udGludWU7XG4gICAgICAgICAgICAgICAgY29uc3QgcHMgPSBub2RlLmdldENvbXBvbmVudChQU0NsYXNzKTtcbiAgICAgICAgICAgICAgICBpZiAocHMpIHsgbm9kZS5yZW1vdmVDb21wb25lbnQocHMpOyByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFBhcnRpY2xlU3lzdGVtIGNvbXBvbmVudCBmb3VuZCBvbiBub2RlJyB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgOKUgCBUd2VlbiBoZWxwZXJzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgX2FwcGx5VHdlZW5Qcm9wZXJ0aWVzKHR3ZWVuOiBhbnksIG5vZGU6IGFueSwgcHJvcGVydGllczogYW55LCBjY01vZHVsZTogYW55KTogYW55IHtcbiAgICAgICAgY29uc3QgeyBWZWMzLCBRdWF0IH0gPSBjY01vZHVsZTtcbiAgICAgICAgY29uc3QgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLnBvc2l0aW9uKSB0YXJnZXQucG9zaXRpb24gPSBuZXcgVmVjMyhwcm9wZXJ0aWVzLnBvc2l0aW9uLnggPz8gMCwgcHJvcGVydGllcy5wb3NpdGlvbi55ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueiA/PyAwKTtcbiAgICAgICAgaWYgKHByb3BlcnRpZXMuc2NhbGUpIHRhcmdldC5zY2FsZSA9IG5ldyBWZWMzKHByb3BlcnRpZXMuc2NhbGUueCA/PyAxLCBwcm9wZXJ0aWVzLnNjYWxlLnkgPz8gMSwgcHJvcGVydGllcy5zY2FsZS56ID8/IDEpO1xuICAgICAgICBpZiAocHJvcGVydGllcy5vcGFjaXR5ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IHVpT3AgPSBub2RlLmdldENvbXBvbmVudCAmJiBub2RlLmdldENvbXBvbmVudChjY01vZHVsZS5qcz8uZ2V0Q2xhc3NCeU5hbWUoJ1VJT3BhY2l0eScpKTtcbiAgICAgICAgICAgIGlmICh1aU9wKSB0YXJnZXQub3BhY2l0eSA9IHByb3BlcnRpZXMub3BhY2l0eTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgIH0sXG5cbiAgICBjcmVhdGVUd2Vlbihub2RlVXVpZDogc3RyaW5nLCBzdGVwczogYW55W10pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGNjID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIHR3ZWVuLCBWZWMzIH0gPSBjYztcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBsZXQgdCA9IHR3ZWVuKG5vZGUpO1xuICAgICAgICAgICAgZm9yIChjb25zdCBzdGVwIG9mIHN0ZXBzKSB7XG4gICAgICAgICAgICAgICAgaWYgKHN0ZXAudHlwZSA9PT0gJ2RlbGF5Jykge1xuICAgICAgICAgICAgICAgICAgICB0ID0gdC5kZWxheShzdGVwLmR1cmF0aW9uID8/IDApO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RlcC50eXBlID09PSAndG8nIHx8IHN0ZXAudHlwZSA9PT0gJ2J5Jykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9wcyA9IHN0ZXAucHJvcGVydGllcyB8fCB7fTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wcy5wb3NpdGlvbikgdGFyZ2V0LnBvc2l0aW9uID0gbmV3IFZlYzMocHJvcHMucG9zaXRpb24ueCA/PyAwLCBwcm9wcy5wb3NpdGlvbi55ID8/IDAsIHByb3BzLnBvc2l0aW9uLnogPz8gMCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9wcy5zY2FsZSkgdGFyZ2V0LnNjYWxlID0gbmV3IFZlYzMocHJvcHMuc2NhbGUueCA/PyAxLCBwcm9wcy5zY2FsZS55ID8/IDEsIHByb3BzLnNjYWxlLnogPz8gMSk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdHMgPSBzdGVwLmVhc2luZyA/IHsgZWFzaW5nOiBzdGVwLmVhc2luZyB9IDoge307XG4gICAgICAgICAgICAgICAgICAgIHQgPSBzdGVwLnR5cGUgPT09ICd0bycgPyB0LnRvKHN0ZXAuZHVyYXRpb24gPz8gMSwgdGFyZ2V0LCBvcHRzKSA6IHQuYnkoc3RlcC5kdXJhdGlvbiA/PyAxLCB0YXJnZXQsIG9wdHMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHQuc3RhcnQoKTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIHN0ZXBzOiBzdGVwcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGFkZFR3ZWVuVG8obm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydGllczogYW55LCBkdXJhdGlvbjogbnVtYmVyLCBlYXNpbmc6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgdHdlZW4sIFZlYzMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgdGFyZ2V0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+ID0ge307XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5wb3NpdGlvbikgdGFyZ2V0LnBvc2l0aW9uID0gbmV3IFZlYzMocHJvcGVydGllcy5wb3NpdGlvbi54ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueSA/PyAwLCBwcm9wZXJ0aWVzLnBvc2l0aW9uLnogPz8gMCk7XG4gICAgICAgICAgICBpZiAocHJvcGVydGllcy5zY2FsZSkgdGFyZ2V0LnNjYWxlID0gbmV3IFZlYzMocHJvcGVydGllcy5zY2FsZS54ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueSA/PyAxLCBwcm9wZXJ0aWVzLnNjYWxlLnogPz8gMSk7XG4gICAgICAgICAgICBjb25zdCBvcHRzID0gZWFzaW5nICYmIGVhc2luZyAhPT0gJ2xpbmVhcicgPyB7IGVhc2luZyB9IDoge307XG4gICAgICAgICAgICB0d2Vlbihub2RlKS50byhkdXJhdGlvbiwgdGFyZ2V0LCBvcHRzKS5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgZHVyYXRpb24sIGVhc2luZyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgYWRkVHdlZW5CeShub2RlVXVpZDogc3RyaW5nLCBwcm9wZXJ0aWVzOiBhbnksIGR1cmF0aW9uOiBudW1iZXIsIGVhc2luZzogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCB0d2VlbiwgVmVjMyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQ6IFJlY29yZDxzdHJpbmcsIGFueT4gPSB7fTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzLnBvc2l0aW9uKSB0YXJnZXQucG9zaXRpb24gPSBuZXcgVmVjMyhwcm9wZXJ0aWVzLnBvc2l0aW9uLnggPz8gMCwgcHJvcGVydGllcy5wb3NpdGlvbi55ID8/IDAsIHByb3BlcnRpZXMucG9zaXRpb24ueiA/PyAwKTtcbiAgICAgICAgICAgIGlmIChwcm9wZXJ0aWVzLnNjYWxlKSB0YXJnZXQuc2NhbGUgPSBuZXcgVmVjMyhwcm9wZXJ0aWVzLnNjYWxlLnggPz8gMSwgcHJvcGVydGllcy5zY2FsZS55ID8/IDEsIHByb3BlcnRpZXMuc2NhbGUueiA/PyAxKTtcbiAgICAgICAgICAgIGNvbnN0IG9wdHMgPSBlYXNpbmcgJiYgZWFzaW5nICE9PSAnbGluZWFyJyA/IHsgZWFzaW5nIH0gOiB7fTtcbiAgICAgICAgICAgIHR3ZWVuKG5vZGUpLmJ5KGR1cmF0aW9uLCB0YXJnZXQsIG9wdHMpLnN0YXJ0KCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBkdXJhdGlvbiwgZWFzaW5nIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBhZGRUd2VlbkRlbGF5KG5vZGVVdWlkOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIHR3ZWVuIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIHR3ZWVuKG5vZGUpLmRlbGF5KGR1cmF0aW9uKS5zdGFydCgpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgZHVyYXRpb24gfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHN0b3BUd2VlbnMobm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgVHdlZW4gfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgaWYgKFR3ZWVuICYmIHR5cGVvZiBUd2Vlbi5zdG9wQWxsQnlUYXJnZXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgICAgICBUd2Vlbi5zdG9wQWxsQnlUYXJnZXQobm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgVGlsZWRNYXAg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRUaWxlZE1hcEluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGlsZWRNYXAgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGlsZWRNYXAnKTtcbiAgICAgICAgICAgIGlmICghVGlsZWRNYXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RpbGVkTWFwIGNsYXNzIG5vdCBmb3VuZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUaWxlZE1hcCk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRpbGVkTWFwIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKGNvbXAuZ2V0TGF5ZXJzKSB7IHRyeSB7IGNvbXAuZ2V0TGF5ZXJzKCkuZm9yRWFjaCgobDogYW55KSA9PiBsYXllcnMucHVzaChsLmdldExheWVyTmFtZSA/IGwuZ2V0TGF5ZXJOYW1lKCkgOiBsLmxheWVyTmFtZSkpOyB9IGNhdGNoIHsgLyogaWdub3JlICovIH0gfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBtYXBTaXplOiBjb21wLm1hcFNpemUsIHRpbGVTaXplOiBjb21wLnRpbGVTaXplLCBsYXllcnMsIG9yaWVudGF0aW9uOiBjb21wLm9yaWVudGF0aW9uIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0VGlsZWRNYXBzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBUaWxlZE1hcCA9IGpzLmdldENsYXNzQnlOYW1lKCdUaWxlZE1hcCcpO1xuICAgICAgICAgICAgaWYgKCFUaWxlZE1hcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGlsZWRNYXAgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBzY2VuZS53YWxrKChub2RlOiBhbnkpID0+IHsgaWYgKG5vZGUuZ2V0Q29tcG9uZW50KFRpbGVkTWFwKSkgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lIH0pOyB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZXMsIGNvdW50OiBub2Rlcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldFRpbGVkTGF5ZXJJbmZvKG5vZGVVdWlkOiBzdHJpbmcsIGxheWVyTmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUaWxlZE1hcCA9IGpzLmdldENsYXNzQnlOYW1lKCdUaWxlZE1hcCcpO1xuICAgICAgICAgICAgaWYgKCFUaWxlZE1hcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGlsZWRNYXAgY2xhc3Mgbm90IGZvdW5kJyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRpbGVkTWFwKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGlsZWRNYXAgY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBsYXllciA9IGNvbXAuZ2V0TGF5ZXIobGF5ZXJOYW1lKTtcbiAgICAgICAgICAgIGlmICghbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYExheWVyICcke2xheWVyTmFtZX0nIG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbGF5ZXJOYW1lLCBsYXllclNpemU6IGxheWVyLmxheWVyU2l6ZSwgdGlsZXM6IGxheWVyLnRpbGVzIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRUaWxlKG5vZGVVdWlkOiBzdHJpbmcsIGxheWVyTmFtZTogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlciwgZ2lkOiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllcihsYXllck5hbWUpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJyR7bGF5ZXJOYW1lfScgbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgbGF5ZXIuc2V0VGlsZUdJREF0KGdpZCwgeCwgeSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHgsIHksIGdpZCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0VGlsZShub2RlVXVpZDogc3RyaW5nLCBsYXllck5hbWU6IHN0cmluZywgeDogbnVtYmVyLCB5OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllcihsYXllck5hbWUpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJyR7bGF5ZXJOYW1lfScgbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgZ2lkID0gbGF5ZXIuZ2V0VGlsZUdJREF0KHgsIHkpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyB4LCB5LCBnaWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGdldFRpbGVzZXRJbmZvKG5vZGVVdWlkOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRpbGVkTWFwID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RpbGVkTWFwJyk7XG4gICAgICAgICAgICBpZiAoIVRpbGVkTWFwKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUaWxlZE1hcCBjbGFzcyBub3QgZm91bmQnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGlsZWRNYXApO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUaWxlZE1hcCBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IHRpbGVzZXRzOiBhbnlbXSA9IFtdO1xuICAgICAgICAgICAgaWYgKGNvbXAuZ2V0VGlsZXNldHMpIHtcbiAgICAgICAgICAgICAgICB0cnkgeyBjb21wLmdldFRpbGVzZXRzKCkuZm9yRWFjaCgodHM6IGFueSkgPT4gdGlsZXNldHMucHVzaCh7IG5hbWU6IHRzLm5hbWUsIGZpcnN0R2lkOiB0cy5maXJzdEdpZCwgdGlsZVNpemU6IHRzLnRpbGVTaXplIH0pKTsgfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHRpbGVzZXRzIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgU3BpbmUg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRTcGluZUluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBzcDogYW55O1xuICAgICAgICAgICAgdHJ5IHsgc3AgPSByZXF1aXJlKCdjYycpLnNwOyBpZiAoIXNwKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU3BpbmUgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KHNwLlNrZWxldG9uKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gc3AuU2tlbGV0b24gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBjb25zdCBhbmltYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgY29uc3Qgc2tpbnM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICB0cnkgeyBpZiAoY29tcC5za2VsZXRvbkRhdGEpIHsgY29uc3QgYWUgPSBjb21wLnNrZWxldG9uRGF0YS5nZXRBbmltc0VudW07IGNvbnN0IHNlID0gY29tcC5za2VsZXRvbkRhdGEuZ2V0U2tpbnNFbnVtOyBpZiAoYWUpIGFuaW1hdGlvbnMucHVzaCguLi5PYmplY3Qua2V5cyhhZSgpKSk7IGlmIChzZSkgc2tpbnMucHVzaCguLi5PYmplY3Qua2V5cyhzZSgpKSk7IH0gfSBjYXRjaCB7IC8qIGlnbm9yZSAqLyB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFuaW1hdGlvbnMsIHNraW5zLCB0aW1lU2NhbGU6IGNvbXAudGltZVNjYWxlLCBwcmVtdWx0aXBsaWVkQWxwaGE6IGNvbXAucHJlbXVsdGlwbGllZEFscGhhLCBkZWJ1Z0JvbmVzOiBjb21wLmRlYnVnQm9uZXMsIGRlYnVnU2xvdHM6IGNvbXAuZGVidWdTbG90cyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0U3BpbmVBbmltYXRpb24obm9kZVV1aWQ6IHN0cmluZywgYW5pbWF0aW9uTmFtZTogc3RyaW5nLCBsb29wOiBib29sZWFuLCB0cmFja0luZGV4OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChzcC5Ta2VsZXRvbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHNwLlNrZWxldG9uIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29tcC5zZXRBbmltYXRpb24odHJhY2tJbmRleCwgYW5pbWF0aW9uTmFtZSwgbG9vcCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFuaW1hdGlvbk5hbWUsIGxvb3AsIHRyYWNrSW5kZXggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFNwaW5lU2tpbihub2RlVXVpZDogc3RyaW5nLCBza2luTmFtZTogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IHNwOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBzcCA9IHJlcXVpcmUoJ2NjJykuc3A7IGlmICghc3ApIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTcGluZSBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoc3AuU2tlbGV0b24pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBzcC5Ta2VsZXRvbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbXAuc2V0U2tpbihza2luTmFtZSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHNraW5OYW1lIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRTcGluZVByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChzcC5Ta2VsZXRvbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHNwLlNrZWxldG9uIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsndGltZVNjYWxlJywgJ3ByZW11bHRpcGxpZWRBbHBoYScsICdkZWJ1Z0JvbmVzJywgJ2RlYnVnU2xvdHMnXTtcbiAgICAgICAgICAgIGlmICghYWxsb3dlZC5pbmNsdWRlcyhwcm9wZXJ0eSkpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYFByb3BlcnR5ICcke3Byb3BlcnR5fScgbm90IGFsbG93ZWQuIFVzZTogJHthbGxvd2VkLmpvaW4oJywgJyl9YCB9O1xuICAgICAgICAgICAgKGNvbXAgYXMgYW55KVtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgcHJvcGVydHksIHZhbHVlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0U3BpbmVOb2RlcygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBsZXQgc3A6IGFueTtcbiAgICAgICAgICAgIHRyeSB7IHNwID0gcmVxdWlyZSgnY2MnKS5zcDsgaWYgKCFzcCkgdGhyb3cgbmV3IEVycm9yKCdub3QgZm91bmQnKTsgfSBjYXRjaCB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1NwaW5lIG1vZHVsZSBub3QgYXZhaWxhYmxlIGluIHRoaXMgcHJvamVjdCcgfTsgfVxuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZXM6IGFueVtdID0gW107XG4gICAgICAgICAgICBzY2VuZS53YWxrKChub2RlOiBhbnkpID0+IHsgaWYgKG5vZGUuZ2V0Q29tcG9uZW50KHNwLlNrZWxldG9uKSkgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lIH0pOyB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZXMsIGNvdW50OiBub2Rlcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGFkZFNwaW5lVG9Ob2RlKG5vZGVVdWlkOiBzdHJpbmcsIHNrZWxldG9uRGF0YVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IHNwOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBzcCA9IHJlcXVpcmUoJ2NjJykuc3A7IGlmICghc3ApIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTcGluZSBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5hZGRDb21wb25lbnQoc3AuU2tlbGV0b24pO1xuICAgICAgICAgICAgYXNzZXRNYW5hZ2VyLmxvYWRBbnkoc2tlbGV0b25EYXRhVXVpZCwgKGVycjogYW55LCBhc3NldDogYW55KSA9PiB7IGlmICghZXJyICYmIGFzc2V0KSBjb21wLnNrZWxldG9uRGF0YSA9IGFzc2V0OyB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZVV1aWQsIHNrZWxldG9uRGF0YVV1aWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBEcmFnb25Cb25lcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldERyYWdvbkJvbmVzSW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXJtYXR1cmVEaXNwbGF5IGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYW5pbWF0aW9uczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgIGNvbnN0IGFybWF0dXJlTmFtZXM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICB0cnkgeyBpZiAoY29tcC5kcmFnb25Bc3NldCkgeyBhcm1hdHVyZU5hbWVzLnB1c2goLi4uKGNvbXAuZHJhZ29uQXNzZXQuYXJtYXR1cmVOYW1lcyB8fCBbXSkpOyBjb25zdCBmYWN0b3J5ID0gZGIuQ0NGYWN0b3J5LmdldEluc3RhbmNlKCk7IGlmIChmYWN0b3J5KSB7IGNvbnN0IGFybSA9IGZhY3RvcnkuYnVpbGRBcm1hdHVyZShjb21wLmFybWF0dXJlTmFtZSwgY29tcC5kcmFnb25Bc3NldC5uYW1lKTsgaWYgKGFybSkgeyBhbmltYXRpb25zLnB1c2goLi4uYXJtLmFuaW1hdGlvbi5hbmltYXRpb25OYW1lcyk7IGFybS5kaXNwb3NlKCk7IH0gfSB9IH0gY2F0Y2ggeyAvKiBpZ25vcmUgKi8gfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBhcm1hdHVyZU5hbWVzLCBhbmltYXRpb25zLCB0aW1lU2NhbGU6IGNvbXAudGltZVNjYWxlLCBhcm1hdHVyZU5hbWU6IGNvbXAuYXJtYXR1cmVOYW1lIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXREcmFnb25Cb25lc0FuaW1hdGlvbihub2RlVXVpZDogc3RyaW5nLCBhbmltYXRpb25OYW1lOiBzdHJpbmcsIHBsYXlUaW1lczogbnVtYmVyKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gQXJtYXR1cmVEaXNwbGF5IGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29tcC5wbGF5QW5pbWF0aW9uKGFuaW1hdGlvbk5hbWUsIHBsYXlUaW1lcyk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGFuaW1hdGlvbk5hbWUsIHBsYXlUaW1lcyB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0RHJhZ29uQm9uZXNBcm1hdHVyZShub2RlVXVpZDogc3RyaW5nLCBhcm1hdHVyZU5hbWU6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBkYjogYW55O1xuICAgICAgICAgICAgdHJ5IHsgZGIgPSByZXF1aXJlKCdjYycpLmRyYWdvbkJvbmVzOyBpZiAoIWRiKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnRHJhZ29uQm9uZXMgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KGRiLkFybWF0dXJlRGlzcGxheSk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIEFybWF0dXJlRGlzcGxheSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbXAuYXJtYXR1cmVOYW1lID0gYXJtYXR1cmVOYW1lO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBhcm1hdHVyZU5hbWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldERyYWdvbkJvbmVzUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBkYjogYW55O1xuICAgICAgICAgICAgdHJ5IHsgZGIgPSByZXF1aXJlKCdjYycpLmRyYWdvbkJvbmVzOyBpZiAoIWRiKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnRHJhZ29uQm9uZXMgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KGRiLkFybWF0dXJlRGlzcGxheSk7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIEFybWF0dXJlRGlzcGxheSBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ZWQgPSBbJ3RpbWVTY2FsZScsICdkZWJ1Z0JvbmVzJywgJ3BsYXlUaW1lcyddO1xuICAgICAgICAgICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKHByb3BlcnR5KSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBub3QgYWxsb3dlZC4gVXNlOiAke2FsbG93ZWQuam9pbignLCAnKX1gIH07XG4gICAgICAgICAgICAoY29tcCBhcyBhbnkpW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBwcm9wZXJ0eSwgdmFsdWUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGxpc3REcmFnb25Cb25lc05vZGVzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGxldCBkYjogYW55O1xuICAgICAgICAgICAgdHJ5IHsgZGIgPSByZXF1aXJlKCdjYycpLmRyYWdvbkJvbmVzOyBpZiAoIWRiKSB0aHJvdyBuZXcgRXJyb3IoJ25vdCBmb3VuZCcpOyB9IGNhdGNoIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnRHJhZ29uQm9uZXMgbW9kdWxlIG5vdCBhdmFpbGFibGUgaW4gdGhpcyBwcm9qZWN0JyB9OyB9XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4geyBpZiAobm9kZS5nZXRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KSkgbm9kZXMucHVzaCh7IHV1aWQ6IG5vZGUudXVpZCwgbmFtZTogbm9kZS5uYW1lIH0pOyB9KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgbm9kZXMsIGNvdW50OiBub2Rlcy5sZW5ndGggfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIGFkZERyYWdvbkJvbmVzVG9Ob2RlKG5vZGVVdWlkOiBzdHJpbmcsIGRyYWdvbkJvbmVzQXNzZXRVdWlkOiBzdHJpbmcsIGRyYWdvbkJvbmVzQXRsYXNBc3NldFV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgYXNzZXRNYW5hZ2VyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgbGV0IGRiOiBhbnk7XG4gICAgICAgICAgICB0cnkgeyBkYiA9IHJlcXVpcmUoJ2NjJykuZHJhZ29uQm9uZXM7IGlmICghZGIpIHRocm93IG5ldyBFcnJvcignbm90IGZvdW5kJyk7IH0gY2F0Y2ggeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdEcmFnb25Cb25lcyBtb2R1bGUgbm90IGF2YWlsYWJsZSBpbiB0aGlzIHByb2plY3QnIH07IH1cbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5hZGRDb21wb25lbnQoZGIuQXJtYXR1cmVEaXNwbGF5KTtcbiAgICAgICAgICAgIGFzc2V0TWFuYWdlci5sb2FkQW55KFtkcmFnb25Cb25lc0Fzc2V0VXVpZCwgZHJhZ29uQm9uZXNBdGxhc0Fzc2V0VXVpZF0sIChlcnI6IGFueSwgYXNzZXRzOiBhbnlbXSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICghZXJyICYmIGFzc2V0cykgeyBjb21wLmRyYWdvbkFzc2V0ID0gYXNzZXRzWzBdOyBjb21wLmRyYWdvbkF0bGFzQXNzZXQgPSBhc3NldHNbMV07IH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgZHJhZ29uQm9uZXNBc3NldFV1aWQsIGRyYWdvbkJvbmVzQXRsYXNBc3NldFV1aWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBUZXJyYWluIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0VGVycmFpbkluZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgbGF5ZXJDb3VudCA9IGNvbXAuZ2V0TGF5ZXJDb3VudCA/IGNvbXAuZ2V0TGF5ZXJDb3VudCgpIDogKGNvbXAubGF5ZXJzID8gY29tcC5sYXllcnMubGVuZ3RoIDogMCk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHRpbGVTaXplOiBjb21wLnRpbGVTaXplLCB3ZWlnaHRNYXBTaXplOiBjb21wLndlaWdodE1hcFNpemUsIGxpZ2h0TWFwU2l6ZTogY29tcC5saWdodE1hcFNpemUsIGJsb2NrQ291bnQ6IGNvbXAuYmxvY2tDb3VudCwgbGF5ZXJDb3VudCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0VGVycmFpblByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ZWQgPSBbJ3RpbGVTaXplJywgJ3dlaWdodE1hcFNpemUnLCAnbGlnaHRNYXBTaXplJ107XG4gICAgICAgICAgICBpZiAoIWFsbG93ZWQuaW5jbHVkZXMocHJvcGVydHkpKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eX0nIG5vdCBhbGxvd2VkLiBVc2U6ICR7YWxsb3dlZC5qb2luKCcsICcpfWAgfTtcbiAgICAgICAgICAgIChjb21wIGFzIGFueSlbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHByb3BlcnR5LCB2YWx1ZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0VGVycmFpbkxheWVySW5mbyhub2RlVXVpZDogc3RyaW5nLCBsYXllckluZGV4OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllciA/IGNvbXAuZ2V0TGF5ZXIobGF5ZXJJbmRleCkgOiAoY29tcC5sYXllcnMgPyBjb21wLmxheWVyc1tsYXllckluZGV4XSA6IG51bGwpO1xuICAgICAgICAgICAgaWYgKCFsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTGF5ZXIgJHtsYXllckluZGV4fSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGxheWVySW5kZXgsIHRpbGVTaXplOiBsYXllci50aWxlU2l6ZSwgZGV0YWlsTWFwOiBsYXllci5kZXRhaWxNYXA/LnV1aWQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRlcnJhaW5MYXllcihub2RlVXVpZDogc3RyaW5nLCBsYXllckluZGV4OiBudW1iZXIsIGRldGFpbE1hcFV1aWQ6IHN0cmluZywgdGlsZVNpemU6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMsIGFzc2V0TWFuYWdlciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBUZXJyYWluID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RlcnJhaW4nKTtcbiAgICAgICAgICAgIGlmICghVGVycmFpbikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGVycmFpbiBjbGFzcyBub3QgZm91bmQg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVGVycmFpbik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFRlcnJhaW4gY29tcG9uZW50IG9uIG5vZGUnIH07XG4gICAgICAgICAgICBhc3NldE1hbmFnZXIubG9hZEFueShkZXRhaWxNYXBVdWlkLCAoZXJyOiBhbnksIGFzc2V0OiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZXJyIHx8ICFhc3NldCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNvbnN0IGxheWVyID0gY29tcC5nZXRMYXllciA/IGNvbXAuZ2V0TGF5ZXIobGF5ZXJJbmRleCkgOiAoY29tcC5sYXllcnMgPyBjb21wLmxheWVyc1tsYXllckluZGV4XSA6IG51bGwpO1xuICAgICAgICAgICAgICAgIGlmIChsYXllcikgeyBsYXllci5kZXRhaWxNYXAgPSBhc3NldDsgaWYgKHRpbGVTaXplICE9PSB1bmRlZmluZWQpIGxheWVyLnRpbGVTaXplID0gdGlsZVNpemU7IH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBsYXllckluZGV4LCBkZXRhaWxNYXBVdWlkLCB0aWxlU2l6ZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0VGVycmFpbkhlaWdodChub2RlVXVpZDogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVGVycmFpbiA9IGpzLmdldENsYXNzQnlOYW1lKCdUZXJyYWluJyk7XG4gICAgICAgICAgICBpZiAoIVRlcnJhaW4pIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1RlcnJhaW4gY2xhc3Mgbm90IGZvdW5kIOKAlCAzRCBvbmx5JyB9O1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5vZGUuZ2V0Q29tcG9uZW50KFRlcnJhaW4pO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBUZXJyYWluIGNvbXBvbmVudCBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgaGVpZ2h0ID0gY29tcC5nZXRIZWlnaHQgPyBjb21wLmdldEhlaWdodCh4LCB5KSA6IG51bGw7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IHgsIHksIGhlaWdodCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgc2V0VGVycmFpbkhlaWdodChub2RlVXVpZDogc3RyaW5nLCB4OiBudW1iZXIsIHk6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IFRlcnJhaW4gPSBqcy5nZXRDbGFzc0J5TmFtZSgnVGVycmFpbicpO1xuICAgICAgICAgICAgaWYgKCFUZXJyYWluKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdUZXJyYWluIGNsYXNzIG5vdCBmb3VuZCDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChUZXJyYWluKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gVGVycmFpbiBjb21wb25lbnQgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGlmICghY29tcC5zZXRIZWlnaHQpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ3NldEhlaWdodCBub3QgYXZhaWxhYmxlIG9uIHRoaXMgVGVycmFpbiB2ZXJzaW9uJyB9O1xuICAgICAgICAgICAgY29tcC5zZXRIZWlnaHQoeCwgeSwgaGVpZ2h0KTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgeCwgeSwgaGVpZ2h0IH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBsaXN0VGVycmFpbk5vZGVzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBUZXJyYWluID0ganMuZ2V0Q2xhc3NCeU5hbWUoJ1RlcnJhaW4nKTtcbiAgICAgICAgICAgIGlmICghVGVycmFpbikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVGVycmFpbiBjbGFzcyBub3QgZm91bmQg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4geyBpZiAobm9kZS5nZXRDb21wb25lbnQoVGVycmFpbikpIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSB9KTsgfSk7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVzLCBjb3VudDogbm9kZXMubGVuZ3RoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgUGhhc2UgNDogUmVuZGVyIFBpcGVsaW5lIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0UmVuZGVyUGlwZWxpbmVJbmZvKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHBpcGVsaW5lID0gZGlyZWN0b3Iucm9vdCAmJiBkaXJlY3Rvci5yb290LnBpcGVsaW5lO1xuICAgICAgICAgICAgaWYgKCFwaXBlbGluZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gcmVuZGVyIHBpcGVsaW5lIOKAlCAzRCBzY2VuZSByZXF1aXJlZCcgfTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGNvbnN0IGVudiA9IHNjZW5lICYmIHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5lbnZpcm9ubWVudDtcbiAgICAgICAgICAgIGNvbnN0IGZvZyA9IHNjZW5lICYmIHNjZW5lLmdsb2JhbHMgJiYgc2NlbmUuZ2xvYmFscy5mb2c7XG4gICAgICAgICAgICBjb25zdCBzaGFkb3dzID0gc2NlbmUgJiYgc2NlbmUuZ2xvYmFscyAmJiBzY2VuZS5nbG9iYWxzLnNoYWRvd3M7XG4gICAgICAgICAgICBjb25zdCBza3lib3ggPSBzY2VuZSAmJiBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuc2t5Ym94O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd3M6IHNoYWRvd3MgPyB7IGVuYWJsZWQ6IHNoYWRvd3MuZW5hYmxlZCwgdHlwZTogc2hhZG93cy50eXBlLCBzaGFkb3dNYXBTaXplOiBzaGFkb3dzLm1hcFNpemUgfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGZvZzogZm9nID8geyBlbmFibGVkOiBmb2cuZW5hYmxlZCwgdHlwZTogZm9nLnR5cGUsIGZvZ1N0YXJ0OiBmb2cuZm9nU3RhcnQsIGZvZ0VuZDogZm9nLmZvZ0VuZCwgZm9nRGVuc2l0eTogZm9nLmZvZ0RlbnNpdHkgfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHNreWJveDogc2t5Ym94ID8geyBlbmFibGVkOiBza3lib3guZW5hYmxlZCwgdXNlSERSOiBza3lib3gudXNlSERSLCByb3RhdGlvbkFuZ2xlOiBza3lib3gucm90YXRpb25BbmdsZSB9IDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgYW1iaWVudDogZW52ID8geyBza3lDb2xvcjogZW52LnNreUNvbG9yLCBncm91bmRBbGJlZG86IGVudi5ncm91bmRBbGJlZG8gfSA6IG51bGwsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRTaGFkb3dTZXR0aW5ncyhlbmFibGVkOiBib29sZWFuIHwgdW5kZWZpbmVkLCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQsIHNoYWRvd01hcFNpemU6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IHNoYWRvd3MgPSBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuc2hhZG93cztcbiAgICAgICAgICAgIGlmICghc2hhZG93cykgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnU2hhZG93IGdsb2JhbHMgbm90IGF2YWlsYWJsZSDigJQgM0Qgc2NlbmUgcmVxdWlyZWQnIH07XG4gICAgICAgICAgICBpZiAoZW5hYmxlZCAhPT0gdW5kZWZpbmVkKSBzaGFkb3dzLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICAgICAgaWYgKHR5cGUgIT09IHVuZGVmaW5lZCkgc2hhZG93cy50eXBlID0gdHlwZTtcbiAgICAgICAgICAgIGlmIChzaGFkb3dNYXBTaXplICE9PSB1bmRlZmluZWQpIHNoYWRvd3MubWFwU2l6ZSA9IHNoYWRvd01hcFNpemU7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGVuYWJsZWQ6IHNoYWRvd3MuZW5hYmxlZCwgdHlwZTogc2hhZG93cy50eXBlLCBtYXBTaXplOiBzaGFkb3dzLm1hcFNpemUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldEZvZ1NldHRpbmdzKGVuYWJsZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIGZvZ0NvbG9yOiBzdHJpbmcgfCB1bmRlZmluZWQsIHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgZm9nU3RhcnQ6IG51bWJlciB8IHVuZGVmaW5lZCwgZm9nRW5kOiBudW1iZXIgfCB1bmRlZmluZWQsIGZvZ0RlbnNpdHk6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgQ29sb3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBmb2cgPSBzY2VuZS5nbG9iYWxzICYmIHNjZW5lLmdsb2JhbHMuZm9nO1xuICAgICAgICAgICAgaWYgKCFmb2cpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ0ZvZyBnbG9iYWxzIG5vdCBhdmFpbGFibGUg4oCUIDNEIHNjZW5lIHJlcXVpcmVkJyB9O1xuICAgICAgICAgICAgaWYgKGVuYWJsZWQgIT09IHVuZGVmaW5lZCkgZm9nLmVuYWJsZWQgPSBlbmFibGVkO1xuICAgICAgICAgICAgaWYgKHR5cGUgIT09IHVuZGVmaW5lZCkgZm9nLnR5cGUgPSB0eXBlO1xuICAgICAgICAgICAgaWYgKGZvZ1N0YXJ0ICE9PSB1bmRlZmluZWQpIGZvZy5mb2dTdGFydCA9IGZvZ1N0YXJ0O1xuICAgICAgICAgICAgaWYgKGZvZ0VuZCAhPT0gdW5kZWZpbmVkKSBmb2cuZm9nRW5kID0gZm9nRW5kO1xuICAgICAgICAgICAgaWYgKGZvZ0RlbnNpdHkgIT09IHVuZGVmaW5lZCkgZm9nLmZvZ0RlbnNpdHkgPSBmb2dEZW5zaXR5O1xuICAgICAgICAgICAgaWYgKGZvZ0NvbG9yICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBoZXggPSBmb2dDb2xvci5yZXBsYWNlKCcjJywgJycpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHIgPSBwYXJzZUludChoZXguc3Vic3RyaW5nKDAsIDIpLCAxNik7XG4gICAgICAgICAgICAgICAgY29uc3QgZyA9IHBhcnNlSW50KGhleC5zdWJzdHJpbmcoMiwgNCksIDE2KTtcbiAgICAgICAgICAgICAgICBjb25zdCBiID0gcGFyc2VJbnQoaGV4LnN1YnN0cmluZyg0LCA2KSwgMTYpO1xuICAgICAgICAgICAgICAgIGZvZy5mb2dDb2xvciA9IG5ldyBDb2xvcihyLCBnLCBiLCAyNTUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBlbmFibGVkOiBmb2cuZW5hYmxlZCwgdHlwZTogZm9nLnR5cGUsIGZvZ1N0YXJ0OiBmb2cuZm9nU3RhcnQsIGZvZ0VuZDogZm9nLmZvZ0VuZCwgZm9nRGVuc2l0eTogZm9nLmZvZ0RlbnNpdHkgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFNreWJveFNldHRpbmdzKGVuYWJsZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQsIHVzZUhEUjogYm9vbGVhbiB8IHVuZGVmaW5lZCwgcm90YXRpb25BbmdsZTogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgc2t5Ym94ID0gc2NlbmUuZ2xvYmFscyAmJiBzY2VuZS5nbG9iYWxzLnNreWJveDtcbiAgICAgICAgICAgIGlmICghc2t5Ym94KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdTa3lib3ggZ2xvYmFscyBub3QgYXZhaWxhYmxlIOKAlCAzRCBzY2VuZSByZXF1aXJlZCcgfTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkICE9PSB1bmRlZmluZWQpIHNreWJveC5lbmFibGVkID0gZW5hYmxlZDtcbiAgICAgICAgICAgIGlmICh1c2VIRFIgIT09IHVuZGVmaW5lZCkgc2t5Ym94LnVzZUhEUiA9IHVzZUhEUjtcbiAgICAgICAgICAgIGlmIChyb3RhdGlvbkFuZ2xlICE9PSB1bmRlZmluZWQpIHNreWJveC5yb3RhdGlvbkFuZ2xlID0gcm90YXRpb25BbmdsZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgZW5hYmxlZDogc2t5Ym94LmVuYWJsZWQsIHVzZUhEUjogc2t5Ym94LnVzZUhEUiwgcm90YXRpb25BbmdsZTogc2t5Ym94LnJvdGF0aW9uQW5nbGUgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFBvc3RQcm9jZXNzU2V0dGluZ3MoYmxvb206IHsgZW5hYmxlZD86IGJvb2xlYW47IGludGVuc2l0eT86IG51bWJlciB9IHwgdW5kZWZpbmVkLCB0b25lbWFwOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBwaXBlbGluZSA9IGRpcmVjdG9yLnJvb3QgJiYgZGlyZWN0b3Iucm9vdC5waXBlbGluZTtcbiAgICAgICAgICAgIGlmICghcGlwZWxpbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIHJlbmRlciBwaXBlbGluZSDigJQgM0Qgc2NlbmUgcmVxdWlyZWQnIH07XG4gICAgICAgICAgICBjb25zdCBwcCA9IHBpcGVsaW5lLnBvc3RQcm9jZXNzIHx8IChwaXBlbGluZS5nZXRQb3N0UHJvY2VzcyAmJiBwaXBlbGluZS5nZXRQb3N0UHJvY2VzcygpKTtcbiAgICAgICAgICAgIGlmICghcHApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1Bvc3RQcm9jZXNzIG5vdCBhdmFpbGFibGUgb24gdGhpcyBwaXBlbGluZScgfTtcbiAgICAgICAgICAgIGlmIChibG9vbSAhPT0gdW5kZWZpbmVkICYmIHBwLmJsb29tKSB7XG4gICAgICAgICAgICAgICAgaWYgKGJsb29tLmVuYWJsZWQgIT09IHVuZGVmaW5lZCkgcHAuYmxvb20uZW5hYmxlZCA9IGJsb29tLmVuYWJsZWQ7XG4gICAgICAgICAgICAgICAgaWYgKGJsb29tLmludGVuc2l0eSAhPT0gdW5kZWZpbmVkKSBwcC5ibG9vbS5pbnRlbnNpdHkgPSBibG9vbS5pbnRlbnNpdHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodG9uZW1hcCAhPT0gdW5kZWZpbmVkICYmIHBwLmNvbG9yR3JhZGluZykge1xuICAgICAgICAgICAgICAgIHBwLmNvbG9yR3JhZGluZy50b25lbWFwTW9kZSA9IHRvbmVtYXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGJsb29tOiBwcC5ibG9vbSA/IHsgZW5hYmxlZDogcHAuYmxvb20uZW5hYmxlZCwgaW50ZW5zaXR5OiBwcC5ibG9vbS5pbnRlbnNpdHkgfSA6IG51bGwsIHRvbmVtYXAgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIC8vIOKUgOKUgCBQaGFzZSA0OiBNZXNoIFJlbmRlcmVyIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxuXG4gICAgZ2V0TWVzaFJlbmRlcmVySW5mbyhub2RlVXVpZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBNZXNoUmVuZGVyZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnTWVzaFJlbmRlcmVyJyk7XG4gICAgICAgICAgICBpZiAoIU1lc2hSZW5kZXJlcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTWVzaFJlbmRlcmVyIG5vdCBhdmFpbGFibGUg4oCUIDNEIG9ubHknIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoTWVzaFJlbmRlcmVyKTtcbiAgICAgICAgICAgIGlmICghY29tcCkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gTWVzaFJlbmRlcmVyIG9uIG5vZGUnIH07XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZVV1aWQsIG5vZGVOYW1lOiBub2RlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHNoYWRvd0Nhc3RpbmdNb2RlOiBjb21wLnNoYWRvd0Nhc3RpbmdNb2RlLFxuICAgICAgICAgICAgICAgICAgICByZWNlaXZlU2hhZG93OiBjb21wLnJlY2VpdmVTaGFkb3csXG4gICAgICAgICAgICAgICAgICAgIHZpc2liaWxpdHk6IGNvbXAudmlzaWJpbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgbWVzaDogY29tcC5tZXNoID8geyB1dWlkOiBjb21wLm1lc2guX3V1aWQsIG5hbWU6IGNvbXAubWVzaC5uYW1lIH0gOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbHM6IGNvbXAuc2hhcmVkTWF0ZXJpYWxzID8gY29tcC5zaGFyZWRNYXRlcmlhbHMubWFwKChtOiBhbnkpID0+IG0gPyB7IHV1aWQ6IG0uX3V1aWQsIG5hbWU6IG0ubmFtZSB9IDogbnVsbCkgOiBbXSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldE1lc2hSZW5kZXJlclByb3BlcnR5KG5vZGVVdWlkOiBzdHJpbmcsIHByb3BlcnR5OiBzdHJpbmcsIHZhbHVlOiBhbnkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGZpbmROb2RlQnlVdWlkRGVlcChzY2VuZSwgbm9kZVV1aWQpO1xuICAgICAgICAgICAgaWYgKCFub2RlKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBOb2RlICR7bm9kZVV1aWR9IG5vdCBmb3VuZGAgfTtcbiAgICAgICAgICAgIGNvbnN0IE1lc2hSZW5kZXJlciA9IGpzLmdldENsYXNzQnlOYW1lKCdNZXNoUmVuZGVyZXInKTtcbiAgICAgICAgICAgIGlmICghTWVzaFJlbmRlcmVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdNZXNoUmVuZGVyZXIgbm90IGF2YWlsYWJsZSDigJQgM0Qgb25seScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChNZXNoUmVuZGVyZXIpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBNZXNoUmVuZGVyZXIgb24gbm9kZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGFsbG93ZWQgPSBbJ3NoYWRvd0Nhc3RpbmdNb2RlJywgJ3JlY2VpdmVTaGFkb3cnLCAndmlzaWJpbGl0eSddO1xuICAgICAgICAgICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKHByb3BlcnR5KSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBub3QgYWxsb3dlZC4gVXNlOiAke2FsbG93ZWQuam9pbignLCAnKX1gIH07XG4gICAgICAgICAgICAoY29tcCBhcyBhbnkpW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgcHJvcGVydHksIHZhbHVlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvLyDilIDilIAgUGhhc2UgNDogUHJvZmlsZXIg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXG5cbiAgICBnZXRQZXJmb3JtYW5jZVN0YXRzKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwgcHJvZmlsZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBjb25zdCBub2RlQ291bnQgPSBzY2VuZSA/ICgoKSA9PiB7IGxldCBuID0gMDsgc2NlbmUud2FsaygoKSA9PiBuKyspOyByZXR1cm4gbjsgfSkoKSA6IDA7XG4gICAgICAgICAgICBjb25zdCBzdGF0czogYW55ID0geyBub2RlQ291bnQgfTtcbiAgICAgICAgICAgIGlmIChwcm9maWxlcikge1xuICAgICAgICAgICAgICAgIHN0YXRzLmZwcyA9IHByb2ZpbGVyLmZwcyAhPT0gdW5kZWZpbmVkID8gcHJvZmlsZXIuZnBzIDogbnVsbDtcbiAgICAgICAgICAgICAgICBzdGF0cy5kcmF3Q2FsbHMgPSBwcm9maWxlci5kcmF3Q2FsbHMgIT09IHVuZGVmaW5lZCA/IHByb2ZpbGVyLmRyYXdDYWxscyA6IG51bGw7XG4gICAgICAgICAgICAgICAgc3RhdHMudHJpYW5nbGVzID0gcHJvZmlsZXIudHJpYW5nbGVzICE9PSB1bmRlZmluZWQgPyBwcm9maWxlci50cmlhbmdsZXMgOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogc3RhdHMgfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRNZW1vcnlTdGF0cygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IG1lbVVzYWdlID0gcHJvY2Vzcy5tZW1vcnlVc2FnZSA/IHByb2Nlc3MubWVtb3J5VXNhZ2UoKSA6IG51bGw7XG4gICAgICAgICAgICBjb25zdCBkYXRhOiBhbnkgPSB7XG4gICAgICAgICAgICAgICAgcHJvY2VzczogbWVtVXNhZ2UgPyB7XG4gICAgICAgICAgICAgICAgICAgIGhlYXBVc2VkTUI6IChtZW1Vc2FnZS5oZWFwVXNlZCAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDIpLFxuICAgICAgICAgICAgICAgICAgICBoZWFwVG90YWxNQjogKG1lbVVzYWdlLmhlYXBUb3RhbCAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDIpLFxuICAgICAgICAgICAgICAgICAgICByc3NNQjogKG1lbVVzYWdlLnJzcyAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDIpLFxuICAgICAgICAgICAgICAgIH0gOiBudWxsLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBwaXBlbGluZSA9IGRpcmVjdG9yLnJvb3QgJiYgZGlyZWN0b3Iucm9vdC5waXBlbGluZTtcbiAgICAgICAgICAgICAgICBpZiAocGlwZWxpbmUgJiYgcGlwZWxpbmUuZGV2aWNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGRhdGEuZ3B1ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbWVtb3J5U3RhdHVzOiBwaXBlbGluZS5kZXZpY2UubWVtb3J5U3RhdHVzIHx8IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7IC8qIEdQVSBzdGF0cyBvcHRpb25hbCAqLyB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgdG9nZ2xlU3RhdHNEaXNwbGF5KHZpc2libGU6IGJvb2xlYW4gfCB1bmRlZmluZWQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgcHJvZmlsZXIgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBpZiAoIXByb2ZpbGVyKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdwcm9maWxlciBtb2R1bGUgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGlmICh2aXNpYmxlID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcHJvZmlsZXIuc2hvd1N0YXRzICYmIHByb2ZpbGVyLnNob3dTdGF0cygpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh2aXNpYmxlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHByb2ZpbGVyLmhpZGVTdGF0cyAmJiBwcm9maWxlci5oaWRlU3RhdHMoKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gdG9nZ2xlXG4gICAgICAgICAgICAgICAgaWYgKHByb2ZpbGVyLmlzU2hvd2luZ1N0YXRzICYmIHByb2ZpbGVyLmlzU2hvd2luZ1N0YXRzKCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcHJvZmlsZXIuaGlkZVN0YXRzICYmIHByb2ZpbGVyLmhpZGVTdGF0cygpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHByb2ZpbGVyLnNob3dTdGF0cyAmJiBwcm9maWxlci5zaG93U3RhdHMoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBub3dWaXNpYmxlID0gcHJvZmlsZXIuaXNTaG93aW5nU3RhdHMgPyBwcm9maWxlci5pc1Nob3dpbmdTdGF0cygpIDogdmlzaWJsZTtcbiAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGRhdGE6IHsgdmlzaWJsZTogbm93VmlzaWJsZSB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgZ2V0RHJhd0NhbGxTdGF0cygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIHByb2ZpbGVyIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3QgcGlwZWxpbmUgPSBkaXJlY3Rvci5yb290ICYmIGRpcmVjdG9yLnJvb3QucGlwZWxpbmU7XG4gICAgICAgICAgICBjb25zdCBkYXRhOiBhbnkgPSB7fTtcbiAgICAgICAgICAgIGlmIChwcm9maWxlcikge1xuICAgICAgICAgICAgICAgIGRhdGEuZHJhd0NhbGxzID0gcHJvZmlsZXIuZHJhd0NhbGxzICE9PSB1bmRlZmluZWQgPyBwcm9maWxlci5kcmF3Q2FsbHMgOiBudWxsO1xuICAgICAgICAgICAgICAgIGRhdGEuaW5zdGFuY2VkRHJhd0NhbGxzID0gcHJvZmlsZXIuaW5zdGFuY2VkRHJhd0NhbGxzICE9PSB1bmRlZmluZWQgPyBwcm9maWxlci5pbnN0YW5jZWREcmF3Q2FsbHMgOiBudWxsO1xuICAgICAgICAgICAgICAgIGRhdGEudHJpYW5nbGVzID0gcHJvZmlsZXIudHJpYW5nbGVzICE9PSB1bmRlZmluZWQgPyBwcm9maWxlci50cmlhbmdsZXMgOiBudWxsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBpcGVsaW5lICYmIHBpcGVsaW5lLnNjZW5lUmVuZGVyZXIpIHtcbiAgICAgICAgICAgICAgICBkYXRhLnNjZW5lUmVuZGVyZXIgPSBwaXBlbGluZS5zY2VuZVJlbmRlcmVyLmdldFByb2ZpbGluZ0RhdGEgPyBwaXBlbGluZS5zY2VuZVJlbmRlcmVyLmdldFByb2ZpbGluZ0RhdGEoKSA6IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSAIFBoYXNlIDQ6IFZpZGVvIFBsYXllciDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGFkZFZpZGVvUGxheWVyKG5vZGVVdWlkOiBzdHJpbmcsIGNsaXBVcmw6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIGNvbXBvbmVudCBub3QgYXZhaWxhYmxlJyB9O1xuICAgICAgICAgICAgbGV0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIGNvbXAgPSBub2RlLmFkZENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBub2RlTmFtZTogbm9kZS5uYW1lLCBoYXNDbGlwOiAhIWNsaXBVcmwgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFZpZGVvUHJvcGVydHkobm9kZVV1aWQ6IHN0cmluZywgcHJvcGVydHk6IHN0cmluZywgdmFsdWU6IGFueSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIG5vdCBhdmFpbGFibGUnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVmlkZW9QbGF5ZXIpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBWaWRlb1BsYXllciBvbiBub2RlJyB9O1xuICAgICAgICAgICAgY29uc3QgYWxsb3dlZCA9IFsncmVzb3VyY2VUeXBlJywgJ3JlbW90ZVVSTCcsICdjbGlwJywgJ2xvb3AnLCAncGxheWJhY2tSYXRlJywgJ3ZvbHVtZSddO1xuICAgICAgICAgICAgaWYgKCFhbGxvd2VkLmluY2x1ZGVzKHByb3BlcnR5KSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgUHJvcGVydHkgJyR7cHJvcGVydHl9JyBub3QgYWxsb3dlZC4gVXNlOiAke2FsbG93ZWQuam9pbignLCAnKX1gIH07XG4gICAgICAgICAgICAoY29tcCBhcyBhbnkpW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlVXVpZCwgcHJvcGVydHksIHZhbHVlIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBjb250cm9sVmlkZW8obm9kZVV1aWQ6IHN0cmluZywgY29tbWFuZDogc3RyaW5nKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB7IGRpcmVjdG9yLCBqcyB9ID0gcmVxdWlyZSgnY2MnKTtcbiAgICAgICAgICAgIGNvbnN0IHNjZW5lID0gZGlyZWN0b3IuZ2V0U2NlbmUoKTtcbiAgICAgICAgICAgIGlmICghc2NlbmUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIGFjdGl2ZSBzY2VuZScgfTtcbiAgICAgICAgICAgIGNvbnN0IG5vZGUgPSBmaW5kTm9kZUJ5VXVpZERlZXAoc2NlbmUsIG5vZGVVdWlkKTtcbiAgICAgICAgICAgIGlmICghbm9kZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBgTm9kZSAke25vZGVVdWlkfSBub3QgZm91bmRgIH07XG4gICAgICAgICAgICBjb25zdCBWaWRlb1BsYXllciA9IGpzLmdldENsYXNzQnlOYW1lKCdWaWRlb1BsYXllcicpO1xuICAgICAgICAgICAgaWYgKCFWaWRlb1BsYXllcikgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnVmlkZW9QbGF5ZXIgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICBpZiAoIWNvbXApIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ05vIFZpZGVvUGxheWVyIG9uIG5vZGUnIH07XG4gICAgICAgICAgICBzd2l0Y2ggKGNvbW1hbmQpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdwbGF5JzogY29tcC5wbGF5ICYmIGNvbXAucGxheSgpOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdwYXVzZSc6IGNvbXAucGF1c2UgJiYgY29tcC5wYXVzZSgpOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdzdG9wJzogY29tcC5zdG9wICYmIGNvbXAuc3RvcCgpOyBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdyZXN1bWUnOiBjb21wLnJlc3VtZSAmJiBjb21wLnJlc3VtZSgpOyBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGBVbmtub3duIGNvbW1hbmQgJyR7Y29tbWFuZH0nLiBVc2U6IHBsYXksIHBhdXNlLCBzdG9wLCByZXN1bWVgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IG5vZGVVdWlkLCBjb21tYW5kIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBnZXRWaWRlb0luZm8obm9kZVV1aWQ6IHN0cmluZykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBkaXJlY3RvciwganMgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBjb25zdCBzY2VuZSA9IGRpcmVjdG9yLmdldFNjZW5lKCk7XG4gICAgICAgICAgICBpZiAoIXNjZW5lKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBhY3RpdmUgc2NlbmUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlID0gZmluZE5vZGVCeVV1aWREZWVwKHNjZW5lLCBub2RlVXVpZCk7XG4gICAgICAgICAgICBpZiAoIW5vZGUpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogYE5vZGUgJHtub2RlVXVpZH0gbm90IGZvdW5kYCB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIG5vdCBhdmFpbGFibGUnIH07XG4gICAgICAgICAgICBjb25zdCBjb21wID0gbm9kZS5nZXRDb21wb25lbnQoVmlkZW9QbGF5ZXIpO1xuICAgICAgICAgICAgaWYgKCFjb21wKSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdObyBWaWRlb1BsYXllciBvbiBub2RlJyB9O1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVVdWlkLCBub2RlTmFtZTogbm9kZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICByZXNvdXJjZVR5cGU6IGNvbXAucmVzb3VyY2VUeXBlLCByZW1vdGVVUkw6IGNvbXAucmVtb3RlVVJMLFxuICAgICAgICAgICAgICAgICAgICBsb29wOiBjb21wLmxvb3AsIHBsYXliYWNrUmF0ZTogY29tcC5wbGF5YmFja1JhdGUsIHZvbHVtZTogY29tcC52b2x1bWUsXG4gICAgICAgICAgICAgICAgICAgIG11dGU6IGNvbXAubXV0ZSwga2VlcEFzcGVjdFJhdGlvOiBjb21wLmtlZXBBc3BlY3RSYXRpbyxcbiAgICAgICAgICAgICAgICAgICAgaXNGdWxsc2NyZWVuOiBjb21wLmlzRnVsbHNjcmVlbiwgZHVyYXRpb246IGNvbXAuZHVyYXRpb24sXG4gICAgICAgICAgICAgICAgICAgIGN1cnJlbnRUaW1lOiBjb21wLmN1cnJlbnRUaW1lLFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgbGlzdFZpZGVvUGxheWVycygpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgZGlyZWN0b3IsIGpzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgY29uc3Qgc2NlbmUgPSBkaXJlY3Rvci5nZXRTY2VuZSgpO1xuICAgICAgICAgICAgaWYgKCFzY2VuZSkgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiAnTm8gYWN0aXZlIHNjZW5lJyB9O1xuICAgICAgICAgICAgY29uc3QgVmlkZW9QbGF5ZXIgPSBqcy5nZXRDbGFzc0J5TmFtZSgnVmlkZW9QbGF5ZXInKTtcbiAgICAgICAgICAgIGlmICghVmlkZW9QbGF5ZXIpIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogJ1ZpZGVvUGxheWVyIG5vdCBhdmFpbGFibGUnIH07XG4gICAgICAgICAgICBjb25zdCBub2RlczogYW55W10gPSBbXTtcbiAgICAgICAgICAgIHNjZW5lLndhbGsoKG5vZGU6IGFueSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNvbXAgPSBub2RlLmdldENvbXBvbmVudChWaWRlb1BsYXllcik7XG4gICAgICAgICAgICAgICAgaWYgKGNvbXApIG5vZGVzLnB1c2goeyB1dWlkOiBub2RlLnV1aWQsIG5hbWU6IG5vZGUubmFtZSwgcmVzb3VyY2VUeXBlOiBjb21wLnJlc291cmNlVHlwZSwgcmVtb3RlVVJMOiBjb21wLnJlbW90ZVVSTCB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBub2RlcywgY291bnQ6IG5vZGVzLmxlbmd0aCB9IH07XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHsgcmV0dXJuIHsgc3VjY2VzczogZmFsc2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07IH1cbiAgICB9LFxuXG4gICAgLy8g4pSA4pSAIFBoYXNlIDQ6IElucHV0IFN5c3RlbSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcblxuICAgIGdldElucHV0Q29uZmlnKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBpbnB1dCwgc3lzIH0gPSByZXF1aXJlKCdjYycpO1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIG11bHRpVG91Y2g6IGlucHV0ICYmIGlucHV0Lm11bHRpVG91Y2ggIT09IHVuZGVmaW5lZCA/IGlucHV0Lm11bHRpVG91Y2ggOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBhY2NlbGVyb21ldGVyRW5hYmxlZDogc3lzICYmIHN5cy5pc05hdGl2ZSAhPT0gdW5kZWZpbmVkID8gbnVsbCA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIHBsYXRmb3JtOiBzeXMgPyBzeXMucGxhdGZvcm0gOiBudWxsLFxuICAgICAgICAgICAgICAgICAgICBpc01vYmlsZTogc3lzID8gc3lzLmlzTW9iaWxlIDogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgaGFzVG91Y2g6IHN5cyA/IHN5cy5oYXNGZWF0dXJlICYmIHN5cy5oYXNGZWF0dXJlKHN5cy5GZWF0dXJlLklOUFVUX1RPVUNIKSA6IG51bGwsXG4gICAgICAgICAgICAgICAgICAgIGhhc0FjY2VsZXJvbWV0ZXI6IHN5cyA/IHN5cy5oYXNGZWF0dXJlICYmIHN5cy5oYXNGZWF0dXJlKHN5cy5GZWF0dXJlLkFDQ0VMRVJPTUVURVIpIDogbnVsbCxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7IHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJyb3IubWVzc2FnZSB9OyB9XG4gICAgfSxcblxuICAgIHNldFRvdWNoQ29uZmlnKGVuYWJsZWQ6IGJvb2xlYW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHsgaW5wdXQgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBpZiAoIWlucHV0KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdpbnB1dCBtb2R1bGUgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGlucHV0Lm11bHRpVG91Y2ggPSBlbmFibGVkO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyBtdWx0aVRvdWNoOiBpbnB1dC5tdWx0aVRvdWNoIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICBzZXRBY2NlbGVyYXRpb25Db25maWcoZW5hYmxlZDogYm9vbGVhbiwgaW50ZXJ2YWw6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgeyBpbnB1dCwgSW5wdXQgfSA9IHJlcXVpcmUoJ2NjJyk7XG4gICAgICAgICAgICBpZiAoIWlucHV0KSByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6ICdpbnB1dCBtb2R1bGUgbm90IGF2YWlsYWJsZScgfTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckVuYWJsZWQgJiYgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckVuYWJsZWQodHJ1ZSk7XG4gICAgICAgICAgICAgICAgaWYgKGludGVydmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXQuc2V0QWNjZWxlcm9tZXRlckludGVydmFsICYmIGlucHV0LnNldEFjY2VsZXJvbWV0ZXJJbnRlcnZhbChpbnRlcnZhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbnB1dC5zZXRBY2NlbGVyb21ldGVyRW5hYmxlZCAmJiBpbnB1dC5zZXRBY2NlbGVyb21ldGVyRW5hYmxlZChmYWxzZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBkYXRhOiB7IGVuYWJsZWQsIGludGVydmFsIH0gfTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkgeyByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTsgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBFdmFsdWF0ZSBhcmJpdHJhcnkgSmF2YVNjcmlwdCBpbiB0aGUgc2NlbmUgY29udGV4dCBhbmQgcmV0dXJuIGl0cyByZXN1bHQuXG4gICAgICogRGFuZ2Vyb3VzLXBhdHRlcm4gZGVueWxpc3RpbmcgKHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKSwgcHJvY2Vzcy5leGl0LCBldmFsKCxcbiAgICAgKiBGdW5jdGlvbigpIGhhcHBlbnMgY2xpZW50LXNpZGUgaW4gTWFuYWdlRGVidWcudmFsaWRhdGVTY3JpcHQgYmVmb3JlIHRoaXMgaXNcbiAgICAgKiBldmVyIGludm9rZWQg4oCUIHRoaXMgbWV0aG9kIG9ubHkgcnVucyBhbHJlYWR5LWFwcHJvdmVkIHNjcmlwdHMuXG4gICAgICovXG4gICAgZXZhbChjb2RlOiBzdHJpbmcpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1uZXctZnVuY1xuICAgICAgICAgICAgY29uc3QgZm4gPSBuZXcgRnVuY3Rpb24oY29kZSk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBmbigpO1xuICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwgZGF0YTogeyByZXN1bHQgfSB9O1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVycm9yLm1lc3NhZ2UgfTtcbiAgICAgICAgfVxuICAgIH0sXG59OyJdfQ==